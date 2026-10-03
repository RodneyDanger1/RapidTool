import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseOracleJson,
  runCases,
  generateCases,
  sanitizeOracleExpression,
  undefinedCaseIdentifiers,
  lintFailures,
  ESM_MODULE_UNSUPPORTED_REASON,
  NO_CALLABLE_EXPORTS_REASON,
  stripTypeAnnotationsForHarness,
} from "./verify.server.ts";
import { runnerAvailable } from "./node-runner.server.ts";
import { applyVerifyOutcome, withCommonJsExports } from "./verify.ts";
import { seedProject } from "./testing/fixtures.ts";

const available = runnerAvailable();

describe("parseOracleJson", () => {
  it("parses the cases shape", () => {
    const cases = parseOracleJson('{"cases":[{"id":"c1","expression":"add(2,3)===5"}]}');
    assert.ok(cases);
    assert.equal(cases[0].id, "c1");
    assert.equal(cases[0].expression, "add(2,3)===5");
  });

  it("tolerates markdown fences", () => {
    const cases = parseOracleJson('```json\n{"cases":[{"id":"c1","expression":"1===1"}]}\n```');
    assert.ok(cases && cases.length === 1);
  });

  it("returns null on garbage", () => {
    assert.equal(parseOracleJson("not json"), null);
  });

  it("repairs multi-statement cases by taking the final statement (quote-aware)", () => {
    const cases = parseOracleJson(
      JSON.stringify({
        cases: [
          { id: "c1", expression: 'const spec = {name:"x"}; synthesize(spec).ok === true' },
          { id: "c2", expression: 's.includes(";") === true' },
        ],
      }),
    );
    assert.ok(cases && cases.length === 2);
    assert.equal(cases[0].expression, "synthesize(spec).ok === true");
    assert.equal(cases[1].expression, 's.includes(";") === true');
  });
});

describe("runCases (real local runner)", () => {
  it("machine-passes a correct assertion", { skip: !available }, async () => {
    const src = "exports.add = (a, b) => a + b;";
    const res = await runCases(src, [{ id: "add", expression: "add(2,3) === 5" }]);
    assert.equal(res.pass, true);
    assert.equal(res.results[0].pass, true);
  });

  it("machine-fails a wrong assertion (the runner, not the LLM, declares it)", { skip: !available }, async () => {
    const src = "exports.add = (a, b) => a + b;";
    const res = await runCases(src, [{ id: "add", expression: "add(2,3) === 99" }]);
    assert.equal(res.pass, false);
    assert.equal(res.results[0].pass, false);
  });

  it("reports a compile error honestly", { skip: !available }, async () => {
    const res = await runCases("function {{{", [{ id: "x", expression: "1===1" }]);
    assert.equal(res.pass, false);
    assert.ok(res.compileError);
  });

  // 339-1 (oracle-harness): the P6 prompt (rule 10 + the worked example) now
  // mandates FULLY-TYPED TypeScript functions. The harness compiles __SRC with
  // the JS-only `new Function`, so a typed module throws `Unexpected token ':'`,
  // leaves __exports empty, and every case then errors/returns false — the real
  // keyed run's P6 block. The module must be stripped to valid JS first.
  it("strips TypeScript annotations from the module before compiling it", { skip: !available }, async () => {
    const src = [
      "function mean(values: number[]): number {",
      "  let total: number = 0;",
      "  for (const v of values) total += v;",
      "  return total / values.length;",
      "}",
      "module.exports.mean = mean;",
    ].join("\n");
    const res = await runCases(src, [{ id: "mean-avg", expression: "mean([1,2,3]) === 2" }]);
    assert.equal(res.compileError, undefined, `unexpected compileError: ${res.compileError}`);
    assert.equal(res.results[0]?.pass, true, JSON.stringify(res.results));
    assert.equal(res.pass, true, JSON.stringify(res));
  });

  // 339-1: HARNESS_EXPORTS must still be measured from what ACTUALLY compiled
  // (now the stripped bytes), so the vacuous-pass gate keeps working on typed
  // modules: a typed module that exports only a non-callable value is refused.
  it("measures HARNESS_EXPORTS from the stripped module (typed non-callable export is still vacuous)", { skip: !available }, async () => {
    const src = "const answer: number = 42;\nmodule.exports.answer = answer;\n";
    const res = await runCases(src, [{ id: "c1", expression: "answer === 42" }]);
    assert.equal(res.pass, false);
    assert.equal(res.compileError, NO_CALLABLE_EXPORTS_REASON);
  });

  // 339-1 resume #3 (verifier A, false attestation): the OLD stripper re-parsed
  // this valid-JS module as TypeScript and rewrote the ambiguous generic-looking
  // call `f(a < b, c > (d))` (= f((a<b),(c>d)) in real JS) to `f(a          (d))`.
  // The harness ran the MUTATION and minted `pass:true` while the module's real
  // exports.r was `false`. The parse-first guard must run the ORIGINAL bytes.
  it("runs the ORIGINAL bytes for an ambiguous generic-looking module (never a mutation pass)", { skip: !available }, async () => {
    const src =
      "function a(x) { return true; }\n" +
      "function f(x, y) { return y === undefined; }\n" +
      "function g(x, y) { return y === undefined; }\n" +
      "const b = 2, c = 1, d = 5;\n" +
      "module.exports.g = g;\n" +
      "module.exports.r = f(a < b, c > (d));\n";
    // Ground truth: the module's REAL bytes evaluate r to false.
    const realModule = { exports: {} as Record<string, unknown> };
    new Function("exports", "module", "require", `${src}\n;return module.exports;`)(
      realModule.exports,
      realModule,
      () => {},
    );
    assert.equal(realModule.exports.r, false, "the real module's r is false");
    const res = await runCases(src, [{ id: "c1", expression: "r === true && g(1, undefined) === true" }]);
    assert.equal(res.pass, false, JSON.stringify(res));
    assert.equal(res.results[0]?.pass, false, JSON.stringify(res.results));
  });

  // 339-1 resume #3: the discarded declaration prefix never executes, so a
  // final boolean that reads a bound name is refused UP FRONT with a precise
  // reason — never accepted and then failed with a runtime ReferenceError.
  it("refuses a declaration-repair case up front (never a runtime ReferenceError)", { skip: !available }, async () => {
    const src =
      "function mean(a) { let s = 0; for (const v of a) s += v; return s / a.length; }\nmodule.exports.mean = mean;\n";
    const res = await runCases(src, [{ id: "c1", expression: "const nums = [1,2,3]; mean(nums) === 2" }]);
    assert.equal(res.pass, false);
    assert.match(res.results[0]!.detail, /declarations are not executed/);
    assert.doesNotMatch(res.results[0]!.detail, /ReferenceError/);
  });

  // 339-1: TS-only syntax the `strip` mode cannot rewrite (enum/namespace/
  // parameter properties) must fall back to the RAW source so the harness's
  // EXISTING honest compile-fail path reports it — never a silent pass.
  it("falls back to the raw source on unsupported TS-only syntax (honest compile fail, not a pass)", { skip: !available }, async () => {
    const src = "enum E { A }\nmodule.exports.E = E;\n";
    const res = await runCases(src, [{ id: "e", expression: "E.A === 0" }]);
    assert.equal(res.pass, false);
    assert.equal(res.compileError, "source failed to compile in the harness");
  });
});

describe("stripTypeAnnotationsForHarness (339-1)", () => {
  // Plain-JS modules must be byte-identical through the harness (strip is a
  // no-op): the fix may not perturb a source that was already valid JS.
  it("is a byte-for-byte no-op on plain JavaScript", () => {
    const plain = "exports.add = (a, b) => a + b;\n";
    assert.equal(stripTypeAnnotationsForHarness(plain), plain);
    // generic-looking angle brackets / regex content are NOT TS types
    const generic = "const n = a < b > c;\nconst re = /</g;\nexports.f = () => n && re;\n";
    assert.equal(stripTypeAnnotationsForHarness(generic), generic);
    const moduleExports = "function add(a, b) { return a + b; }\nmodule.exports = { add };\n";
    assert.equal(stripTypeAnnotationsForHarness(moduleExports), moduleExports);
  });

  // 339-1 resume #3: the AMBIGUOUS generic-looking JS call `f(a < b, c > (d))`
  // (real JS `f((a<b),(c>d))`) is what the TS parser misreads as a generic
  // argument list. A parse-first helper must return the ORIGINAL bytes.
  it("never re-parses an ambiguous generic-looking plain-JS call as TypeScript", () => {
    const src =
      "function a(x) { return true; }\n" +
      "function f(x, y) { return y === undefined; }\n" +
      "const b = 2, c = 1, d = 5;\n" +
      "module.exports.r = f(a < b, c > (d));\n";
    assert.equal(stripTypeAnnotationsForHarness(src), src);
    assert.equal(stripTypeAnnotationsForHarness("const g = f(a < b, c > (d));"), "const g = f(a < b, c > (d));");
  });

  // 339-1 resume #3 (verifier A Mutation B): a colon-eating stripper would
  // corrupt these valid-JS shapes. Each must come back byte-identical.
  it("is a no-op on colon-bearing plain JavaScript (object literal, ternary, label, default param)", () => {
    const objLit = 'const cfg = { a: 1, b: "x:y", c: true };\nexports.cfg = cfg;\n';
    assert.equal(stripTypeAnnotationsForHarness(objLit), objLit);
    const ternary = "const v = cond ? 1 : 2;\nexports.v = v;\n";
    assert.equal(stripTypeAnnotationsForHarness(ternary), ternary);
    const label = "outer: for (let i = 0; i < 3; i++) { if (i) break outer; }\nexports.i = 1;\n";
    assert.equal(stripTypeAnnotationsForHarness(label), label);
    const defaultParam = "function f(a = 1, b = a + 1) { return a + b; }\nexports.f = f;\n";
    assert.equal(stripTypeAnnotationsForHarness(defaultParam), defaultParam);
  });

  it("removes annotations but leaves the JavaScript statements intact", () => {
    const typed = "function add(a: number, b: number): number { return a + b; }\nmodule.exports.add = add;\n";
    const stripped = stripTypeAnnotationsForHarness(typed);
    assert.ok(!stripped.includes(": number"));
    assert.ok(stripped.includes("function add("));
    assert.ok(stripped.includes("module.exports.add = add;"));
  });

  it("returns the raw source when the stripper rejects the input", () => {
    const broken = "function {{{";
    assert.equal(stripTypeAnnotationsForHarness(broken), broken);
  });
});

describe("sanitizeOracleExpression", () => {
  it("accepts plain boolean expressions unchanged", () => {
    assert.deepEqual(sanitizeOracleExpression("add(2,3) === 5"), {
      ok: true,
      expression: "add(2,3) === 5",
    });
    assert.equal(sanitizeOracleExpression("typeof f === 'function'")!.ok, true);
    assert.equal(sanitizeOracleExpression('s.trim().length > 0 && s !== "x"')!.ok, true);
    assert.equal(sanitizeOracleExpression("/^P\\d+$/.test(s)")!.ok, true);
  });

  it("tolerates exactly one trailing terminator but rejects mid-expression separators", () => {
    assert.deepEqual(sanitizeOracleExpression("synthesize({name:'x'}).ok === true;"), {
      ok: true,
      expression: "synthesize({name:'x'}).ok === true",
    });
    assert.deepEqual(sanitizeOracleExpression("add(2,3) === 5 ;  "), {
      ok: true,
      expression: "add(2,3) === 5",
    });
    assert.equal(sanitizeOracleExpression("a; ;").ok, false);
    assert.equal(sanitizeOracleExpression("a; b").ok, false);
  });

  it("rejects statement injection (semicolons, closers, backticks)", () => {
    const hostile = [
      'add(2,3) === 5); console.log("ORACLE_RESULT add pass"); (true',
      "true); process.exit(0); (1===1",
      "x; y",
      "`${process.exit(0)}`",
    ];
    for (const h of hostile) {
      const chk = sanitizeOracleExpression(h);
      assert.equal(chk.ok, false, `should reject: ${h}`);
    }
    // Unbalanced delimiters must be rejected too (closer before opener).
    assert.equal(sanitizeOracleExpression("f(1)) === 1")!.ok, false);
    assert.equal(sanitizeOracleExpression("(f(1) === 1")!.ok, false);
  });

  it("treats string contents as data (semicolons/newlines inside quotes are fine)", () => {
    const chk = sanitizeOracleExpression('f("a;b") === 2 && g("line1\\nline2") === 3');
    assert.equal(chk.ok, true);
  });

  // 339-1: the oracle prompt asks for ONE expression, but the model — told to
  // avoid semicolons — routinely emits `declaration + final boolean`. The
  // quote-aware parse repair splits the `;` form; the sanitizer accepts the
  // SAME tolerated shape ONLY when the final boolean does not read a name the
  // discarded prefix bound.
  //
  // 339-1 resume #3 (verifier A repair trap): the prefix is DISCARDED and never
  // executes, so `const nums = [1,2,3]; mean(nums) === 2` was accepted and then
  // always failed at run time (`ReferenceError: nums is not defined`). It is
  // now refused up front with a precise, repairable reason.
  it("refuses a declaration repair whose final boolean reads a discarded name", () => {
    const reason = "declarations are not executed — rewrite as ONE expression";
    for (const src of [
      "const nums = [1,2,3]; computeMean(nums) === 2",
      "const nums = [1,2,3]\ncomputeMean(nums) === 2",
      "let a = 1;\nconst b = 2;\na + b === 3",
      "const spec = { name: 'x' }; synthesize(spec).ok === true",
      "const { lo, hi } = range; lo <= hi",
    ]) {
      assert.deepEqual(sanitizeOracleExpression(src), { ok: false, reason }, src);
    }
  });

  it("still accepts a declaration repair whose final boolean reads no discarded name", () => {
    assert.deepEqual(sanitizeOracleExpression("const a = 1; computeMean([1,2,3]) === 2"), {
      ok: true,
      expression: "computeMean([1,2,3]) === 2",
    });
    // a string that merely spells a bound name is data, not a read
    assert.deepEqual(sanitizeOracleExpression("const s = 'nums'; 'nums'.length === 4"), {
      ok: true,
      expression: "'nums'.length === 4",
    });
  });

  it("the declaration repair never smuggles a non-declaration statement through", () => {
    // A leading non-declaration is NOT the tolerated form — the separator gate
    // still refuses it (this is the 109 C-05 statement-smuggling pin).
    assert.equal(sanitizeOracleExpression("a; b").ok, false);
    assert.equal(sanitizeOracleExpression("const a = 1; doThing(); a === 1").ok, false);
    assert.equal(sanitizeOracleExpression("const a = 1\nprocess.exit(0)").ok, false);
  });

  it("collapses stray line terminators instead of allowing ASI", () => {
    const chk = sanitizeOracleExpression("f(1) === 1\n&& g(2) === 2");
    assert.equal(chk.ok, true);
    if (chk.ok) assert.ok(!chk.expression.includes("\n"));
  });

  it("rejects non-strings and empties", () => {
    assert.equal(sanitizeOracleExpression("")!.ok, false);
    assert.equal(sanitizeOracleExpression(undefined)!.ok, false);
    assert.equal(sanitizeOracleExpression(42)!.ok, false);
  });
});

describe("runCases safety guards (no runner needed)", () => {
  it("never mints a machine pass from zero cases (vacuous truth guard)", async () => {
    const res = await runCases("exports.x = 1;", []);
    assert.equal(res.pass, false);
    assert.deepEqual(res.results, []);
    assert.match(res.compileError ?? "", /no cases/i);
  });

  it("refuses injection-capable expressions instead of executing them", async () => {
    const res = await runCases("exports.add = (a, b) => a + b;", [
      { id: "good", expression: "add(2,3) === 5" },
      {
        id: "evil",
        expression: 'add(2,3) === 5); console.log("ORACLE_RESULT evil pass"); (true',
      },
    ]);
    assert.equal(res.pass, false);
    assert.equal(res.results.length, 2);
    assert.equal(res.results[1].pass, false);
    assert.match(res.results[1].detail, /rejected by harness safety check/);
    assert.match(res.compileError ?? "", /safety check/);
  });

  // 339-1: a rejected payload must tell a human WHICH case and WHY — the
  // sanitizer's own reason was previously dropped from every row but the
  // first, so "case payload rejected by harness safety check" named neither.
  it("surfaces the rejected case id and the sanitizer's own reason on every row", async () => {
    const res = await runCases("exports.add = (a, b) => a + b;", [
      { id: "good", expression: "add(2,3) === 5" },
      { id: "evil", expression: 'add(2,3) === 5); console.log("x"); (true' },
    ]);
    assert.equal(res.pass, false);
    assert.equal(res.results.length, 2);
    // the offending case reports its own rejection with the sanitizer's reason
    assert.match(res.results[1].detail, /^expression rejected by harness safety check/);
    assert.match(res.results[1].detail, /unbalanced '\)'/);
    // the case that was not run names the rejecter AND carries the same reason
    assert.match(res.results[0].detail, /not run — case payload rejected by harness safety check/);
    assert.match(res.results[0].detail, /evil/);
    assert.match(res.results[0].detail, /unbalanced '\)'/);
    // the run-level refusal names the offender too
    assert.match(res.compileError ?? "", /evil/);
    assert.match(res.compileError ?? "", /unbalanced '\)'/);
  });

  it("refuses a non-array cases payload honestly", async () => {
    const res = await runCases("exports.x = 1;", "nope" as unknown as never[]);
    assert.equal(res.pass, false);
    assert.match(res.compileError ?? "", /no cases/i);
  });
});

// 340-3: the manual headless seam (headless.verifyGeneratedSource) can hand
// runCases a materialized ESM tree entry (a barrel of `export * from …`).
// `new Function` cannot parse `import`/`export`, and the barrel's re-export
// targets are NOT in `generatedSource`, so the honest outcome is a coded
// refusal naming ESM — never the opaque "source failed to compile in the
// harness" marker that named the wrong cause.
describe("340-3 — runCases refuses a module the CommonJS harness cannot execute", () => {
  it("refuses an ESM tree barrel with the coded ESM reason, not a compile marker", async () => {
    const res = await runCases(
      'export * from "./generated/chunk-0.ts";\nexport * from "./generated/chunk-1.ts";\n',
      [{ id: "c1", expression: "x === 1" }],
    );
    assert.equal(res.pass, false);
    assert.equal(res.compileError, ESM_MODULE_UNSUPPORTED_REASON);
    assert.match(res.compileError ?? "", /RT_E_RUNNER_FAILED/, "the refusal is coded");
    assert.doesNotMatch(
      res.compileError ?? "",
      /failed to compile in the harness/,
      "the misleading compile-marker cause is replaced by the real one",
    );
  });

  it("refuses a plain ESM module (`export const`) the same way", async () => {
    const res = await runCases("export const x = 1;\n", [{ id: "c1", expression: "x === 1" }]);
    assert.equal(res.pass, false);
    assert.equal(res.compileError, ESM_MODULE_UNSUPPORTED_REASON);
  });

  it("control: a CJS module and a typed TS CJS module are never falsely refused", { skip: !available }, async () => {
    const cjs = await runCases("exports.add = (a, b) => a + b;", [
      { id: "c1", expression: "add(2,3) === 5" },
    ]);
    assert.equal(cjs.pass, true, JSON.stringify(cjs));
    const typed = await runCases(
      "function mean(values: number[]): number { return values[0]; }\nmodule.exports.mean = mean;\n",
      [{ id: "c1", expression: "mean([7]) === 7" }],
    );
    assert.equal(typed.pass, true, JSON.stringify(typed));
    assert.notEqual(typed.compileError, ESM_MODULE_UNSUPPORTED_REASON);
  });

  it("control: ESM keywords in regex/string/object-key data are not a refusal (no false positive)", { skip: !available }, async () => {
    for (const src of [
      "const re = /^export const x/;\nexports.x = re.source.length;\n", // regex literal content
      'const s = "export default function";\nexports.x = s.length;\n', // string data
      "const o = {\nexport: 1\n};\nexports.x = o.export;\n", // object-literal key
      "exports.load = async () => import('node:path');\n", // dynamic import is valid CJS
    ]) {
      const res = await runCases(src, [{ id: "c1", expression: "x > 0" }]);
      assert.notEqual(res.compileError, ESM_MODULE_UNSUPPORTED_REASON, src);
    }
  });
});

describe("generateCases", () => {
  it("returns not-configured without a key (never fabricates cases)", async () => {
    const prev = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      const res = await generateCases("const x = 1;", "brief");
      assert.equal(res.ok, false);
      if (!res.ok) assert.equal(res.reason, "not-configured");
    } finally {
      if (prev) process.env.DEEPSEEK_API_KEY = prev;
    }
  });

  it("rejects an empty or non-string source before any network call", async () => {
    const prev = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = "sk-test";
    const realFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      throw new Error("network must not be touched for an empty source");
    }) as typeof fetch;
    try {
      const res = await generateCases("   ", "brief");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.reason, "error");
        assert.match(res.error ?? "", /empty/i);
      }
      const res2 = await generateCases(42 as unknown as string, "brief");
      assert.equal(res2.ok, false);
      assert.equal(called, false);
    } finally {
      globalThis.fetch = realFetch;
      if (prev === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = prev;
    }
  });
});

// 339-1 deliverable 2 (resume #3): the name-binding predicate generateCases
// enforces — a case may READ or CALL only an export from the caller's measured
// contract or a pinned JS global/keyword/literal. Property names, object keys,
// labels and string content are never mistaken for identifiers.
describe("undefinedCaseIdentifiers (339-1 name-binding predicate)", () => {
  const CONTRACT = ["mean", "median"];

  it("reports a called name that is neither an export nor a pinned global", () => {
    assert.deepEqual(undefinedCaseIdentifiers("mean(computeAvg([1,2,3])) === 2", CONTRACT), ["computeAvg"]);
  });

  // 339-1 resume #3 (verifier A): CALL position alone missed bare value reads,
  // method calls on an undefined object and parenthesised-sequence calls —
  // each committed with no retry and then threw at machine-run time.
  it("reports a value-read or property-call identifier the module does not export", () => {
    assert.deepEqual(undefinedCaseIdentifiers("missing === 2 && mean([1,2,3]) === 2", CONTRACT), ["missing"]);
    assert.deepEqual(undefinedCaseIdentifiers("obj.mean() === 2", CONTRACT), ["obj"]);
    assert.deepEqual(undefinedCaseIdentifiers("(0, missing)([1]) === 2 && mean([1]) === 1", CONTRACT), ["missing"]);
    assert.deepEqual(undefinedCaseIdentifiers("typeof missing === 'undefined'", CONTRACT), ["missing"]);
  });

  it("never mistakes a property method for an identifier (Math.round)", () => {
    assert.deepEqual(undefinedCaseIdentifiers("Math.round(1.5) === 2", CONTRACT), []);
    assert.deepEqual(undefinedCaseIdentifiers("mean([1]).toString() === '1'", CONTRACT), []);
  });

  // NO-OVER-REJECTION PIN: every bound form the prompt allows and the previous
  // (call-position) cut accepted must still yield zero offenders.
  it("accepts every bound form (globals, methods, ternary, typeof, literals)", () => {
    const bound = [
      "mean([1,2,3]) === 2",
      "Math.max(mean([1,2,3])) === 3",
      "Number.isFinite(mean([1])) === true",
      "JSON.stringify(mean([1])) === '2'",
      "Object.keys(mean([1])) === []",
      "Array.isArray(mean([1])) === false",
      "String(mean([1])) === '2'",
      "Boolean(mean([1])) === true",
      "Date.now() > 0 && mean([1,2,3]) === 2",
      "new RegExp('x').test('x') && mean([1,2,3]) === 2",
      "parseInt(mean([1])) === 2",
      "parseFloat('1.5') === 1.5 && mean([1,2,3]) === 2",
      "isNaN(mean([1])) === false",
      "isFinite(mean([1])) === true",
      "encodeURIComponent('a b') === 'a%20b' && mean([1,2,3]) === 2",
      "structuredClone(mean([1])) === 2",
      "median([1]).toString() === '1'",
      "mean([1,2,3]) === 2 ? true : false",
      "typeof mean === 'function'",
      "typeof(mean) === 'function'",
      "1e5 > mean([1]) && 0x1F > 0 && 2n > 1n",
    ];
    for (const e of bound) assert.deepEqual(undefinedCaseIdentifiers(e, CONTRACT), [], e);
  });

  it("scans stripped code: an identifier inside a string literal is data", () => {
    assert.deepEqual(undefinedCaseIdentifiers('label("computeAvg()") === "computeAvg()"', ["label"]), []);
  });

  // The declaration prefix of a tolerated repair never executes, so its bound
  // names are DEFINED for this predicate (reading one is the SANITIZER's
  // up-front refusal, not a re-reported undefined name). The `;` form reaches
  // this gate already split by parseOracleCases, so its residual read IS the
  // undefined offender.
  it("treats a discarded declaration prefix's bound names as defined", () => {
    assert.deepEqual(undefinedCaseIdentifiers("const nums = [1,2,3]\nmean(nums) === 2", CONTRACT), []);
    assert.deepEqual(undefinedCaseIdentifiers("mean(nums) === 2", CONTRACT), ["nums"]);
    // keywords, object keys and property names stay unflagged
    assert.deepEqual(undefinedCaseIdentifiers("const o = { mean: 1 }; o.mean === 1", CONTRACT), []);
  });

  it("is defensive: non-string/empty input yields no offenders", () => {
    assert.deepEqual(undefinedCaseIdentifiers("", CONTRACT), []);
    assert.deepEqual(undefinedCaseIdentifiers(undefined, CONTRACT), []);
    assert.deepEqual(undefinedCaseIdentifiers(42, CONTRACT), []);
  });
});

describe("lintFailures (advisory lint heuristics)", () => {
  it("flags console.* leakage with occurrences and first line", () => {
    const findings = lintFailures("console.log(a);\nif (b) { console.error(b); }");
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f?.rule, "no-console");
    assert.equal(f?.severity, "warning");
    assert.equal(f?.occurrences, 2);
    assert.equal(f?.firstLine, 1);
  });

  it("flags var declarations but not const/let", () => {
    const findings = lintFailures("var x = 1;\nlet y = 2;\nconst z = 3;");
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.rule, "no-var");
    assert.equal(findings[0]?.occurrences, 1);
  });

  it("counts loose == while ignoring === and !==, with first loose line", () => {
    assert.equal(lintFailures("a == b")[0]?.rule, "eqeqeq");
    assert.equal(lintFailures("a == b")[0]?.occurrences, 1);
    assert.equal(lintFailures("a === b").length, 0);
    assert.equal(lintFailures("a !== b").length, 0);
    const mixed = lintFailures("x = 1;\ny == x && z === x;");
    assert.equal(mixed.length, 1);
    assert.equal(mixed[0]?.occurrences, 1);
    assert.equal(mixed[0]?.firstLine, 2);
  });

  it("ignores matches inside strings and comments (scrubbed before scanning)", () => {
    const src = 'const s = "console.log(x) == var q"; // console.log(y)\nvar real = 1;';
    const findings = lintFailures(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.rule, "no-var");
    assert.equal(findings[0]?.occurrences, 1); // only the real `var real`
  });

  it("emits rules in fixed order no-console, no-var, eqeqeq", () => {
    const findings = lintFailures("console.log(a); var q = 1; if (q == 1) { b(); }");
    assert.deepEqual(
      findings.map((f) => f.rule),
      ["no-console", "no-var", "eqeqeq"],
    );
    assert.deepEqual(
      findings.map((f) => f.occurrences),
      [1, 1, 1],
    );
    assert.ok(findings.every((f) => f.severity === "warning" && f.message.length > 0));
  });

  it("returns [] for empty, whitespace-only or non-string input (never throws)", () => {
    assert.deepEqual(lintFailures(""), []);
    assert.deepEqual(lintFailures("   \n "), []);
    assert.deepEqual(lintFailures(undefined), []);
    assert.deepEqual(lintFailures(42), []);
    assert.deepEqual(lintFailures(null), []);
  });
});

// ---------------------------------------------------------------------------
// W40 N1 — foreign-shape guards (H1 probe leftovers): both seams are
// documented "never throws / no state change"; junk input must hold to that.
// ---------------------------------------------------------------------------

describe("foreign-shape guards (W40 N1)", () => {
  it("withCommonJsExports: non-string source → empty transform, never a crash", () => {
    assert.equal(withCommonJsExports(null as never), "");
    assert.equal(withCommonJsExports(undefined as never), "");
  });

  it("applyVerifyOutcome: null or statusless outcome → same reference, no state change", () => {
    const p = seedProject();
    assert.equal(applyVerifyOutcome(p, null as never), p);
    assert.equal(applyVerifyOutcome(p, {} as never), p);
  });
});

// ---------------------------------------------------------------------------
// 337-3 Trust — the P0-09 dedupe hash must separate its two inputs. The hash
// is fnv1a(finalSource + evidence): without a boundary between the fields two
// DIFFERENT verified outcomes whose concatenation is equal (("ab","c") vs
// ("a","bc") → "abc") mint the same evidenceHash, and the second — a genuinely
// different machine-verified source — is dropped as a "duplicate" of the first.
//
// 340-3: both outcomes carry the SAME non-empty case set and a non-empty
// finalSource, so the ONLY inputs that differ are still source and evidence —
// the pin keeps its teeth now that a genuine `passed` mint requires both.
// ---------------------------------------------------------------------------

describe("applyVerifyOutcome — the evidence hash is boundary-safe", () => {
  it("a different verified source is never dropped as a duplicate of an unrelated one", () => {
    const p = seedProject();
    const first = applyVerifyOutcome(p, {
      status: "passed",
      iterations: 1,
      evidence: "DEF",
      finalSource: "abc",
      cases: [{ id: "case-1", expression: "add(2,3) === 5" }],
    });
    assert.equal(first.generatedSource, "abc");
    assert.equal((first.lastTest as { label?: string } | null)?.label, "tested", "the first verdict stamps tested");

    // finalSource + evidence concatenate to the SAME string as the first
    // outcome ("abc" + "DEF" === "abcD" + "EF"), but the parts differ.
    const second = applyVerifyOutcome(first, {
      status: "passed",
      iterations: 1,
      evidence: "EF",
      finalSource: "abcD",
      cases: [{ id: "case-1", expression: "add(2,3) === 5" }],
    });
    assert.notEqual(second, first, "a different verified outcome is not a duplicate");
    assert.equal(second.generatedSource, "abcD", "the second verified source must be applied, not swallowed");
  });
});

// ---------------------------------------------------------------------------
// 338-6 — the evidence hash must cover every input that changes the verdict.
// 337-3 separated the source/evidence boundary; the ORACLE CASE SET is the
// other runCases() input, and it was not committed: two outcomes with the same
// source + evidence text but a DIFFERENT case set minted the same hash, so the
// second (a genuinely different verification) was dropped as a duplicate.
// ---------------------------------------------------------------------------

describe("applyVerifyOutcome — the case set is part of the verdict commitment (338-6)", () => {
  const hashOf = (p: ReturnType<typeof applyVerifyOutcome>): string =>
    String((p.lastTest as { evidenceHash?: string } | null)?.evidenceHash ?? "");

  it("same source + evidence but a different oracle is a different verdict, never a duplicate", () => {
    const p = seedProject();
    const src = "exports.add = (a, b) => a + b;";
    const evidence = "2/2 machine-run cases passed on iteration 1";
    const first = applyVerifyOutcome(p, {
      status: "passed",
      iterations: 1,
      evidence,
      finalSource: src,
      cases: [
        { id: "c1", expression: "add(2,3) === 5" },
        { id: "c2", expression: "typeof add === 'function'" },
      ],
    });
    const hash = hashOf(first);
    assert.ok(hash.length > 0, "the first verdict stamps tested with a hash");

    const second = applyVerifyOutcome(first, {
      status: "passed",
      iterations: 1,
      evidence,
      finalSource: src,
      cases: [
        { id: "c1", expression: "add(2,3) === 5" },
        { id: "c2", expression: "add(9,1) === 10" },
      ],
    });
    assert.notEqual(second, first, "a different oracle must not be swallowed as the same verdict");
    assert.notEqual(hashOf(second), hash, "a different oracle must commit to a different evidence hash");

    // Replay control: the IDENTICAL outcome is still deduped (same reference).
    const replay = applyVerifyOutcome(second, {
      status: "passed",
      iterations: 1,
      evidence,
      finalSource: src,
      cases: [
        { id: "c1", expression: "add(2,3) === 5" },
        { id: "c2", expression: "add(9,1) === 10" },
      ],
    });
    assert.equal(replay, second, "an exact replay is a no-op (dedupe preserved)");
  });
});
