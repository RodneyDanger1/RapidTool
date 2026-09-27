import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseOracleJson,
  runCases,
  generateCases,
  sanitizeOracleExpression,
  lintFailures,
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

  it("refuses a non-array cases payload honestly", async () => {
    const res = await runCases("exports.x = 1;", "nope" as unknown as never[]);
    assert.equal(res.pass, false);
    assert.match(res.compileError ?? "", /no cases/i);
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
