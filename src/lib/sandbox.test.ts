import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import {
  buildPhase6Module,
  FORBIDDEN_PRIMITIVES,
  healSource,
  identifierHits,
  maskLiteralsAndComments,
  runGenerated,
  runSandboxed,
  sandboxWorkerSource,
} from "./sandbox.ts";
import { briefFitCoverage, briefFitSubstancePasses, briefNounCore } from "./sandbox.ts";
import type { SandboxWorker } from "./sandbox.ts";

// ---------------------------------------------------------------------------
// Helpers: a fake worker that exercises runSandboxed WITHOUT a real web Worker
// (Node has none). It mirrors the real worker protocol exactly: the host posts
// {id, code}; the fake evaluates the code the way sandboxWorkerSource() does
// (same throwing network stubs, same test_happy/test_no_skip tail), then
// delivers {id, ok, detail} through onmessage. Strategy knobs let tests
// exercise silence (timeout/terminate) and stale (id-mismatched) replies.
// ---------------------------------------------------------------------------

const STUB_ERROR = "network primitives are stubbed in the sandbox worker";
const TEST_TAIL =
  '\n;if (typeof test_happy === "function") test_happy();\nif (typeof test_no_skip === "function") test_no_skip();';

type HostMessage = { id: number; code: string };
type Reply = { id: number; ok: boolean; detail: string };

function evaluateLikeWorker(code: string): { ok: boolean; detail: string } {
  const stub = (): never => {
    throw new Error(STUB_ERROR);
  };
  const quietConsole = { log() {}, warn() {}, error() {} };
  try {
    const fn = new Function("fetch", "WebSocket", "XMLHttpRequest", "console", `${code}${TEST_TAIL}`);
    fn(stub, stub, stub, quietConsole);
    return { ok: true, detail: "tests.pass" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

type FakeBehavior = "eval" | "silent" | "wrong-id-only" | "wrong-id-then-eval" | "crash";

class FakeWorker implements SandboxWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  terminated = false;
  posted: HostMessage[] = [];
  private readonly behavior: FakeBehavior;

  constructor(behavior: FakeBehavior) {
    this.behavior = behavior;
  }

  postMessage(data: unknown): void {
    const msg = data as HostMessage;
    this.posted.push(msg);
    const deliver = (payload: Reply): void => {
      queueMicrotask(() => {
        this.onmessage?.({ data: payload });
      });
    };
    if (this.behavior === "silent") return;
    if (this.behavior === "crash") {
      // Worker dies before ever replying (CSP block / blob parse failure):
      // fire onerror only — the host must settle via the A14 error path.
      queueMicrotask(() => {
        this.onerror?.(new Error("worker exploded"));
      });
      return;
    }
    if (this.behavior === "wrong-id-only") {
      deliver({ id: msg.id + 1000, ok: true, detail: "stale-worker reply" });
      return;
    }
    const real = evaluateLikeWorker(msg.code);
    if (this.behavior === "wrong-id-then-eval") {
      deliver({ id: msg.id + 1000, ok: true, detail: "stale-worker reply" });
    }
    deliver({ id: msg.id, ok: real.ok, detail: real.detail });
  }

  terminate(): void {
    this.terminated = true;
  }
}

function fakeWorker(behavior: FakeBehavior): FakeWorker {
  return new FakeWorker(behavior);
}

const NON_TEMPLATE_MSG = "non-template source requires runSandboxed()";

// ---------------------------------------------------------------------------
// runGenerated — honest sync template gate (B-01)
// ---------------------------------------------------------------------------

describe("runGenerated (sync template gate)", () => {
  it("refuses arbitrary non-template code (console.log only)", () => {
    const res = runGenerated('console.log("hello");');
    assert.equal(res.ok, false);
    assert.equal(res.detail, NON_TEMPLATE_MSG);
  });

  it("refuses code containing fetch()", () => {
    const res = runGenerated('fetch("https://example.com");');
    assert.equal(res.ok, false);
    assert.equal(res.detail, NON_TEMPLATE_MSG);
  });

  it("refuses dynamic import() code", () => {
    const res = runGenerated('import("./lazy.js");');
    assert.equal(res.ok, false);
    assert.equal(res.detail, NON_TEMPLATE_MSG);
  });

  it("keeps the denylist message for forbidden tokens even inside template-shaped code", () => {
    const res = runGenerated('const JOBS = ["a"];\nfunction test_no_skip() {}\nprocess.exit(0);');
    assert.equal(res.ok, false);
    assert.equal(res.detail, "Forbidden primitive in generated module.");
  });

  it("accepts and executes buildPhase6Module output", () => {
    const code = buildPhase6Module({ name: "demo", jobs: ["job-a"] });
    const res = runGenerated(code);
    assert.equal(res.ok, true);
    assert.equal(res.detail, "tests.pass");
  });

  it("accepts and executes buildPhase6Module variant 1 output", () => {
    const code = buildPhase6Module({ name: "demo", jobs: ["job-a"], rejectionNote: "needs work", variant: 1 });
    const res = runGenerated(code);
    assert.equal(res.ok, true);
    assert.equal(res.detail, "tests.pass");
  });

  // --- A02 regression: the denylist must never scan engine-injected prose ---

  it("passes a module whose rejection-note prose contains 'process'/'fetch'/'require' (A02)", () => {
    const code = buildPhase6Module({
      name: "Tracker",
      jobs: ["dispatch"],
      rejectionNote: "Please document the flow and process each job in order; no fetch of remote state before require sign-off, eval the diff.",
      variant: 1,
    });
    const res = runGenerated(code);
    assert.equal(res.ok, true, `A02 false positive: ${res.detail}`);
    assert.equal(res.detail, "tests.pass");
  });

  it("treats denylist words inside string literals of template-shaped code as text (A02)", () => {
    const code = 'const JOBS = ["process", "fetch"];\nfunction test_no_skip() { if (JOBS.length !== 2) throw new Error("x"); }';
    const res = runGenerated(code);
    assert.equal(res.ok, true, res.detail);
  });

  it("does not flag denylist words inside comments of template-shaped code (A02)", () => {
    const code =
      'const JOBS = ["a"];\n// prose: process, fetch, require, eval, import — a human note\nfunction test_no_skip() { var ok = true; if (!ok) throw new Error("x"); }';
    const res = runGenerated(code);
    assert.equal(res.ok, true, res.detail);
  });

  it("still refuses REAL process/require identifiers outside literals (A02 keeps its teeth)", () => {
    const processExit = 'const JOBS = ["a"];\nfunction test_no_skip() {}\nprocess.exit(0);';
    const viaRequire = 'const JOBS = ["a"];\nfunction test_no_skip() {}\nvar fs = require("fs");';
    for (const code of [processExit, viaRequire]) {
      const res = runGenerated(code);
      assert.equal(res.ok, false);
      assert.equal(res.detail, "Forbidden primitive in generated module.");
    }
  });

  // --- A13 regression: bare page-global escapes are blocked in the sync path ---

  it("blocks bare fetch()/WebSocket/self.* in template-shaped code (A13)", () => {
    const sources = [
      'const JOBS = ["a"];\nfunction test_no_skip() {}\nfetch("https://example.com");',
      'const JOBS = ["a"];\nfunction test_no_skip() {}\nnew WebSocket("wss://example.com");',
      'const JOBS = ["a"];\nfunction test_no_skip() {}\nself.fetch("https://example.com");',
      'const JOBS = ["a"];\nfunction test_no_skip() {}\nwindow.location.href = "https://example.com";',
    ];
    for (const code of sources) {
      const res = runGenerated(code);
      assert.equal(res.ok, false, `must refuse: ${code.split("\n")[2]}`);
      assert.equal(res.detail, "Forbidden primitive in generated module.");
    }
  });
});

// ---------------------------------------------------------------------------
// 350 — forbidden-primitive filter hardening: BOTH error classes are pinned.
//   FALSE NEGATIVE (a bad primitive was ACCEPTED): TS `enum` (a runtime
//   construct type-stripping cannot erase -> ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX)
//   and a primitive that lived only inside a template `${…}` interpolation
//   (real code the legacy masker blanked with the template text).
//   FALSE POSITIVE (legit code was REFUSED): a regex literal as an if/while
//   body whose PATTERN mentions a banned word was read as division, leaving the
//   pattern visible. Closing the hole must not mask a genuine division.
// ---------------------------------------------------------------------------
describe("350 — forbidden-primitive filter hardening", () => {
  it("FALSE NEGATIVE: refuses a TS `enum` (strip-types cannot erase it)", () => {
    const code = 'const JOBS = ["a"];\nfunction test_no_skip() {}\nenum Color { Red }\n';
    const res = runGenerated(code);
    assert.equal(res.ok, false, "an enum-bearing module must be refused, never shipped to a red tree");
    assert.equal(res.detail, "Forbidden primitive in generated module.");
    assert.equal(res.code, "RT_E_VALIDATION");
  });

  it("FALSE NEGATIVE: a template `${…}` interpolation body is CODE, scrutinized like code", () => {
    for (const expr of ["`${globalThis.a}`", "`${window.location.href}`", "`${fetch('/x')}`"]) {
      const masked = maskLiteralsAndComments(`const v = ${expr};`);
      assert.ok(
        FORBIDDEN_PRIMITIVES.test(masked),
        `an interpolation body must stay visible to the scan: ${expr} -> ${masked}`,
      );
    }
    // The template TEXT is still masked (a prose "window process fetch" is data).
    assert.equal(
      FORBIDDEN_PRIMITIVES.test(maskLiteralsAndComments("const s = `window process fetch`;")),
      false,
      "literal text inside a template is still masked",
    );
  });

  it("FALSE NEGATIVE: runGenerated refuses a template-shaped module escaping only via an interpolation", () => {
    const code = 'const JOBS = ["a"];\nfunction test_no_skip() {}\nconst u = `${globalThis.x}`;';
    const res = runGenerated(code);
    assert.equal(res.ok, false);
    assert.equal(res.detail, "Forbidden primitive in generated module.");
  });

  it("FALSE POSITIVE: a regex literal as a control-statement body is not read as division", () => {
    const sources = [
      'const JOBS = ["a"];\nfunction test_no_skip() {}\nif (1) /window/i.test("x");',
      'const JOBS = ["a"];\nfunction test_no_skip() {}\nfor (var i = 0; i < 1; i++) /globalThis/.test("x");',
    ];
    for (const code of sources) {
      assert.equal(
        FORBIDDEN_PRIMITIVES.test(maskLiteralsAndComments(code)),
        false,
        `a regex pattern naming a banned word is masked, not refused: ${code.split("\n")[2]}`,
      );
      assert.equal(runGenerated(code).ok, true, `legit code must be accepted: ${code.split("\n")[2]}`);
    }
  });

  it("FALSE-POSITIVE guard: a genuine division after `)` stays code (no over-masking)", () => {
    const division = "const a = (b + c) / 2; const y = total / 3;";
    assert.equal(maskLiteralsAndComments(division), division, "division is never masked as a regex");
  });
});

// ---------------------------------------------------------------------------
// buildPhase6Module — deterministic template builder
// ---------------------------------------------------------------------------

describe("buildPhase6Module", () => {
  it("is deterministic: identical args yield byte-identical output", () => {
    const args = { name: "demo", jobs: ["job-a", "job-b"], rejectionNote: "n/a" };
    const a = buildPhase6Module(args);
    const b = buildPhase6Module(args);
    assert.equal(a, b);
    assert.equal(buildPhase6Module({ name: "demo", jobs: ["job-a"] }), buildPhase6Module({ name: "demo", jobs: ["job-a"] }));
  });

  it("different inputs yield different output", () => {
    const a = buildPhase6Module({ name: "demo", jobs: ["job-a"] });
    const b = buildPhase6Module({ name: "demo", jobs: ["job-b"] });
    assert.notEqual(a, b);
  });

  it("variant 1 adds test_rejection_addressed; variant 0 does not", () => {
    const base = buildPhase6Module({ name: "demo", jobs: ["job-a"], variant: 0 });
    const v1 = buildPhase6Module({ name: "demo", jobs: ["job-a"], variant: 1 });
    assert.ok(!base.includes("test_rejection_addressed"));
    assert.ok(v1.includes("test_rejection_addressed"));
  });
});

// ---------------------------------------------------------------------------
// healSource — unchanged semantics, output must still pass the sync gate
// ---------------------------------------------------------------------------

describe("healSource", () => {
  it("no-ops when test_happy is already present", () => {
    const code = buildPhase6Module({ name: "demo", jobs: ["job-a"] });
    const healed = healSource(code, "ReferenceError: test_happy is not defined");
    assert.equal(healed, code);
  });

  it("repairs a module missing test_happy and the repaired output passes the gate", () => {
    const code = buildPhase6Module({ name: "demo", jobs: ["job-a"] });
    const stripped = code.replace(/function test_happy\(\) \{\n[\s\S]*?\n\}/, "");
    assert.ok(!stripped.includes("function test_happy"));
    // Stripped module is still template-shaped and passes on its own.
    assert.equal(runGenerated(stripped).ok, true);
    // healSource appends a template-shaped test_happy (B-07 flow)…
    const healed = healSource(stripped, "ReferenceError: test_happy is not defined");
    assert.notEqual(healed, stripped);
    assert.ok(healed.includes("function test_happy"));
    // …and the healed source still passes the sync gate and runs green.
    const res = runGenerated(healed);
    assert.equal(res.ok, true);
    assert.equal(res.detail, "tests.pass");
  });
});

// ---------------------------------------------------------------------------
// sandboxWorkerSource — real worker body contents
// ---------------------------------------------------------------------------

describe("sandboxWorkerSource", () => {
  it("defines throwing fetch/WebSocket/XMLHttpRequest stubs and console capture", () => {
    const src = sandboxWorkerSource();
    assert.ok(src.includes("fetch"), "worker source mentions fetch stub");
    assert.ok(src.includes("WebSocket"), "worker source mentions WebSocket stub");
    assert.ok(src.includes("XMLHttpRequest"), "worker source mentions XMLHttpRequest stub");
    assert.ok(src.includes("network primitives are stubbed"), "stubs throw a network-denied error");
    assert.ok(src.includes("onmessage"), "worker registers a message handler");
    assert.ok(src.includes("console"), "worker shadows console for capture");
  });
});

// ---------------------------------------------------------------------------
// runSandboxed — real async sandbox protocol, exercised via injected fakes
// ---------------------------------------------------------------------------

describe("runSandboxed", () => {
  it("reports worker unavailable when the factory throws (no web Worker in Node)", async () => {
    const res = await runSandboxed("whatever();", {
      timeoutMs: 100,
      workerFactory: () => {
        throw new Error("no worker");
      },
    });
    assert.equal(res.ok, false);
    assert.equal(res.detail, "worker unavailable");
  });

  // 337-3 Trust: if createObjectURL succeeds and the factory then throws, the
  // catch returned without revoking the blob URL (small leak on the failure
  // path). The URL API is stubbed so the assertions are deterministic.
  it("revokes the blob URL when the worker factory throws", async () => {
    const realCreate = URL.createObjectURL;
    const realRevoke = URL.revokeObjectURL;
    let created = 0;
    let revoked = 0;
    try {
      URL.createObjectURL = (() => {
        created += 1;
        return "blob:test-worker";
      }) as typeof URL.createObjectURL;
      URL.revokeObjectURL = (() => {
        revoked += 1;
      }) as typeof URL.revokeObjectURL;
      const res = await runSandboxed("whatever();", {
        timeoutMs: 100,
        workerFactory: () => {
          throw new Error("factory boom");
        },
      });
      assert.equal(res.ok, false);
      assert.equal(res.detail, "worker unavailable");
      assert.equal(created, 1, "the blob URL was created");
      assert.equal(revoked, 1, "and must be revoked when the worker factory throws");
    } finally {
      URL.createObjectURL = realCreate;
      URL.revokeObjectURL = realRevoke;
    }
  });

  it("happy path: template module passes inside the worker", async () => {
    const code = buildPhase6Module({ name: "demo", jobs: ["job-a"] });
    const worker = fakeWorker("eval");
    const res = await runSandboxed(code, { timeoutMs: 2000, workerFactory: () => worker });
    assert.equal(res.ok, true);
    assert.ok(res.detail.includes("tests.pass"));
    assert.equal(worker.posted.length, 1);
    assert.equal(worker.posted[0].code, code);
    assert.equal(typeof worker.posted[0].id, "number");
  });

  it("surfaces thrown test errors as ok:false with the error text", async () => {
    const worker = fakeWorker("eval");
    const res = await runSandboxed('function test_happy() { throw new Error("boom-in-worker"); }', {
      timeoutMs: 2000,
      workerFactory: () => worker,
    });
    assert.equal(res.ok, false);
    assert.ok(res.detail.includes("boom-in-worker"), `detail was: ${res.detail}`);
  });

  it("blocks fetch() inside the worker via the throwing stub", async () => {
    const worker = fakeWorker("eval");
    const res = await runSandboxed('fetch("https://example.com");', {
      timeoutMs: 2000,
      workerFactory: () => worker,
    });
    assert.equal(res.ok, false);
    assert.ok(res.detail.includes("stubbed"), `detail was: ${res.detail}`);
  });

  it("kills a never-replying worker via terminate() and reports the timeout", async () => {
    const worker = fakeWorker("silent");
    const res = await runSandboxed("while (true) {}", {
      timeoutMs: 20,
      workerFactory: () => worker,
    });
    assert.equal(res.ok, false);
    assert.ok(res.detail.includes("killed"), `detail was: ${res.detail}`);
    assert.equal(worker.terminated, true, "terminate() must have been called");
  });

  it("ignores id-mismatched (stale) replies and only resolves via the timeout", async () => {
    const worker = fakeWorker("wrong-id-only");
    const res = await runSandboxed('console.log("x");', {
      timeoutMs: 20,
      workerFactory: () => worker,
    });
    // The stale reply claimed ok:true; it must NOT have resolved the promise.
    assert.equal(res.ok, false);
    assert.ok(res.detail.includes("killed"), `detail was: ${res.detail}`);
    assert.ok(!res.detail.includes("stale-worker reply"));
    assert.equal(worker.terminated, true);
  });

  it("still resolves once a matching-id reply arrives after a stale one", async () => {
    const code = buildPhase6Module({ name: "demo", jobs: ["job-a"] });
    const worker = fakeWorker("wrong-id-then-eval");
    const res = await runSandboxed(code, { timeoutMs: 2000, workerFactory: () => worker });
    assert.equal(res.ok, true);
    assert.ok(res.detail.includes("tests.pass"), `detail was: ${res.detail}`);
  });

  it("settles fast with 'worker crashed' when the worker fires onerror before replying (A14)", async () => {
    const worker = fakeWorker("crash");
    const res = await runSandboxed("worker dies before this ever executes", {
      // Long timeout on purpose: without the onerror path this test would hang
      // ~5s and lie with "killed after 5s" (it was never killed — it crashed).
      timeoutMs: 5000,
      workerFactory: () => worker,
    });
    assert.equal(res.ok, false);
    assert.equal(res.detail, "worker crashed");
    assert.equal(worker.terminated, true, "terminate() must follow a crash settle");
  });
});

// fixes/152 (steal #2): post-hoc claim gates — verifyClaims against an artifact map.
import { verifyClaims, type ClaimRow } from "./sandbox.ts";
describe("verifyClaims (post-hoc claim gates)", () => {
  const artifacts = {
    "src/generated.ts": "export function createBoard() { return 1 }",
    "src/api/routes.ts": "// placeholder",
  };
  it("all claims met → ok, no unmet", () => {
    const claims: ClaimRow[] = [
      { kind: "file-exists", target: "src/generated.ts" },
      { kind: "dir-non-empty", target: "src/" },
      { kind: "contains-identifier", target: "src/generated.ts", expect: "createBoard" },
    ];
    assert.deepEqual(verifyClaims(claims, artifacts), { ok: true, unmet: [] });
  });
  it("missing file / empty dir / absent identifier → honest unmet list, never silent", () => {
    const claims: ClaimRow[] = [
      { kind: "file-exists", target: "src/nope.ts" },
      { kind: "dir-non-empty", target: "src/jobs/" },
      { kind: "contains-identifier", target: "src/generated.ts", expect: "rentRoll" },
    ];
    const r = verifyClaims(claims, artifacts);
    assert.equal(r.ok, false);
    assert.equal(r.unmet.length, 3);
    assert.match(r.unmet[0]!, /missing file: src\/nope\.ts/);
    assert.match(r.unmet[1]!, /empty dir: src\/jobs\//);
    assert.match(r.unmet[2]!, /identifier absent: rentRoll/);
  });
  it("junk claims and absent maps are unmet, never thrown", () => {
    const r = verifyClaims([null, { kind: "file-exists" }] as unknown as ClaimRow[], {});
    assert.equal(r.ok, false);
    assert.equal(r.unmet.length, 2);
  });

  // 337-3 Trust: `kind` and `target` are validated, but `c.expect.toLowerCase()`
  // was called unguarded, so a hostile contains-identifier claim with a
  // non-string expect threw out of a function documented pure/hostile-tolerant.
  it("a non-string expect on a contains-identifier claim is unmet, never a throw", () => {
    const r = verifyClaims(
      [{ kind: "contains-identifier", target: "src/generated.ts", expect: 42 }] as unknown as ClaimRow[],
      artifacts,
    );
    assert.equal(r.ok, false);
    assert.equal(r.unmet.length, 1);
    assert.match(r.unmet[0]!, /malformed claim row/);
  });
});

// ---------------------------------------------------------------------------
// 322 X1 (P6-A/P6-B): masker regex-awareness + stem-tolerant identifierHits.
// The masker legs are ground-truthed against the repo's own TS lexer (keyless):
// strings + regex literals come from the parser AST, comments from the raw
// scanner with its regex-context misreads (`//` inside `:\/\//`) dropped when
// they overlap an AST string/regex range.
// ---------------------------------------------------------------------------

/** TS-lexer truth mask — what maskLiteralsAndComments must produce. */
function tsTruthMask(src: string): string {
  const sf = ts.createSourceFile("truth.ts", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const astRanges: Array<[number, number]> = [];
  (function walk(n: ts.Node): void {
    const isRegex = ts.isRegularExpressionLiteral
      ? ts.isRegularExpressionLiteral(n)
      : n.kind === ts.SyntaxKind.RegularExpressionLiteral;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || isRegex) {
      astRanges.push([n.getStart(sf), n.getEnd()]);
    }
    ts.forEachChild(n, walk);
  })(sf);
  const comments: Array<[number, number]> = [];
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, src);
  let tok: ts.SyntaxKind;
  while ((tok = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    if (tok === ts.SyntaxKind.SingleLineCommentTrivia || tok === ts.SyntaxKind.MultiLineCommentTrivia) {
      comments.push([scanner.getTokenStart(), scanner.getTokenEnd()]);
    }
  }
  const out = src.split("");
  for (const [x, y] of astRanges) for (let i = x; i < y; i++) out[i] = " ";
  for (const [x, y] of comments) {
    if (!astRanges.some(([a, b]) => x < b && y > a)) for (let i = x; i < y; i++) out[i] = " ";
  }
  return out.join("");
}

describe("maskLiteralsAndComments (322 X1 · P6-A regex awareness)", () => {
  it("masks the escape-regex class (update.ts:692) exactly like the TS lexer", () => {
    // Pre-fix, the `"` inside `/"/g` opened a runaway string: 1610 chars of
    // real code masked and pairing shifted to EOF in the same file.
    const sample = `function esc(s) { return String(s).replace(/"/g, '&quot;'); }\nconst label = esc("menu");`;
    assert.equal(maskLiteralsAndComments(sample), tsTruthMask(sample));
    assert.deepEqual(identifierHits(["menu"], sample), [], "string content never counts");
    assert.deepEqual(identifierHits(["label"], sample), ["label"], "real code identifiers still count");
  });

  it("division is not a regex: a `/` after an identifier stays code", () => {
    const sample = 'const half = total / 2; const label = "menu";';
    assert.equal(maskLiteralsAndComments(sample), tsTruthMask(sample));
    assert.deepEqual(identifierHits(["menu"], sample), []);
    assert.deepEqual(identifierHits(["total", "half"], sample), ["total", "half"]);
  });

  it("325 A3: postfix `++`/`--` — the following `/` is division, not a regex open", () => {
    // Pre-fix the sign pair sat in the regex-opener set, so `i++ / 2` opened a
    // phantom regex: the scanner consumed to the next `/` on the line, masking
    // REAL code — `fetch` went invisible to the FORBIDDEN scan (an anti-gaming
    // hole) and to identifierHits — and, in the mirror shape, left a real
    // regex's body VISIBLE (a false forbidden refusal).
    const division = "const a = i++ / 2; const y = fetch / z;";
    assert.equal(maskLiteralsAndComments(division), tsTruthMask(division), "postfix division stays code");
    assert.equal(maskLiteralsAndComments(division), division, "nothing to mask — no literals present");
    assert.deepEqual(
      identifierHits(["fetch", "window"], division),
      ["fetch"],
      "a real `fetch` reference must stay visible to the FORBIDDEN scan",
    );
    const mirror = "let n = 3; const q = n-- / 2; const re = /\\bfetch\\b/;";
    assert.equal(maskLiteralsAndComments(mirror), tsTruthMask(mirror), "the real regex body is masked");
    assert.deepEqual(identifierHits(["fetch"], mirror), [], "masked regex body: never a false forbidden hit");
    const prefix = "const a = ++i / 2;";
    assert.equal(maskLiteralsAndComments(prefix), tsTruthMask(prefix), "prefix `++i / 2` unchanged");
  });

  it("masks `:\\/\\//`-style escaped regexes without cascade", () => {
    // The trailing comment sits on its own line: the raw scanner's regex-blind
    // comment pass swallows a same-line comment into the regex misread, and the
    // overlap filter would drop both. The masker itself has no such blindspot.
    const sample = `if (/^[A-Za-z][A-Za-z0-9+.-]*:\\/\\//.test(filePath)) { return false; }\n// keep rest\nconst menu = "shop";`;
    assert.equal(maskLiteralsAndComments(sample), tsTruthMask(sample));
    assert.deepEqual(identifierHits(["menu"], sample), ["menu"], "code after the regex survives");
    assert.deepEqual(identifierHits(["shop"], sample), [], "string after the regex is still masked");
  });
});

describe("identifierHits (322 X1 · P6-B stem tolerance)", () => {
  it("inflectional tolerance: brief nouns prove implementation through stems", () => {
    assert.deepEqual(identifierHits(["updates"], "export function UpdateItem() {}"), ["updates"]);
    assert.deepEqual(identifierHits(["publishes"], "function publishStaticSite() {}"), ["publishes"]);
    assert.deepEqual(identifierHits(["menus"], "const menuItems = [];"), ["menus"]);
  });

  it("short-stem guard: stems < 4 chars never match (uses ≁ user)", () => {
    // canonicalStem("uses") → "use" (3 chars) — guarded out of the stem rule.
    assert.deepEqual(identifierHits(["uses"], "const user = 1;"), []);
    // Plain sub-identifier behavior is unchanged (createBoard proves board).
    assert.deepEqual(identifierHits(["board"], "function createBoard() {}"), ["board"]);
  });
});

// ---------------------------------------------------------------------------
// fixes/346 C3 — the sandbox's SURFACED failures carry a registry code. The
// `throw new Error(...)` sites inside emitted template/worker source are
// product code (pinned by checked-in artifacts), not sandbox machine failures;
// what a caller receives is a SandboxResult, and every ok:false envelope now
// names its class (errors.ts). Success stays code-free.
// ---------------------------------------------------------------------------
describe("sandbox failure envelopes carry an RT_E code (346 C3)", () => {
  it("runGenerated: refusals and an executed-test failure are coded; success is not", () => {
    assert.deepEqual(runGenerated('console.log("x");'), {
      ok: false,
      detail: NON_TEMPLATE_MSG,
      code: "RT_E_VALIDATION",
    });
    assert.deepEqual(
      runGenerated('const JOBS = ["a"];\nfunction test_no_skip() {}\nprocess.exit(0);'),
      { ok: false, detail: "Forbidden primitive in generated module.", code: "RT_E_VALIDATION" },
    );
    const failed = runGenerated(
      'const JOBS = ["a"];\nfunction test_happy() { throw new Error("boom"); }\nfunction test_no_skip() {}',
    );
    assert.equal(failed.ok, false);
    assert.equal(failed.code, "RT_E_RUNNER_FAILED");
    const okRun = runGenerated(buildPhase6Module({ name: "demo", jobs: ["job-a"] }));
    assert.equal(okRun.ok, true);
    assert.equal(okRun.code, undefined, "success carries no code");
  });

  it("runSandboxed: empty source, unavailable worker, timeout, crash and a failed turn are all coded", async () => {
    const empty = await runSandboxed("");
    assert.equal(empty.code, "RT_E_VALIDATION");

    const noWorker = await runSandboxed("whatever();", {
      timeoutMs: 100,
      workerFactory: () => {
        throw new Error("no worker");
      },
    });
    assert.equal(noWorker.code, "RT_E_RUNNER_UNAVAILABLE");

    const timedOut = await runSandboxed("while (true) {}", {
      timeoutMs: 20,
      workerFactory: () => fakeWorker("silent"),
    });
    assert.equal(timedOut.code, "RT_E_RUNNER_FAILED");

    const crashed = await runSandboxed("x", { timeoutMs: 5000, workerFactory: () => fakeWorker("crash") });
    assert.equal(crashed.code, "RT_E_RUNNER_FAILED");

    const failedTurn = await runSandboxed('function test_happy() { throw new Error("boom-in-worker"); }', {
      timeoutMs: 2000,
      workerFactory: () => fakeWorker("eval"),
    });
    assert.equal(failedTurn.code, "RT_E_RUNNER_FAILED");

    const passed = await runSandboxed(buildPhase6Module({ name: "demo", jobs: ["job-a"] }), {
      timeoutMs: 2000,
      workerFactory: () => fakeWorker("eval"),
    });
    assert.equal(passed.ok, true);
    assert.equal(passed.code, undefined, "success carries no code");
  });
});

// ---------------------------------------------------------------------------
// fixes/348 — the p6-brief-fit CORE-noun MEASUREMENT (not the bar): the core is
// the brief's REAL product vocabulary plus the project's declared capabilities.
// Scaffold-owned file stems, URL/email host tokens, sub-3-char tokens and bold
// SENTENCE FRAGMENTS are excluded. The bar (0.6) and the requirement of real
// product nouns are unchanged — a generic tree still fails.
// ---------------------------------------------------------------------------
describe("fixes/348 briefNounCore core measurement", () => {
  const BAKERY_BRIEF =
    "# Bloedow Bakery — Winona, MN — Full Website Redesign + Ordering Platform\n\n" +
    "Build a website for **Bloedow Bakery**. Replace the current WordPress/Elementor site at https://www.bloedows.com/.\n" +
    "The current website publishes **no prices anywhere** (verified).\n";

  it("drops scaffold-owned file stems, URL/host tokens, sub-3-char tokens and bold sentence fragments", () => {
    const context = {
      lattice: { jobs: ["show", "close"], entities: ["home", "page"] },
      contracts: { entities: [{ name: "Text" }, { name: "Home" }] },
      specGraph: {
        nodes: [
          { id: "ui", file: "src/ui/console.tsx", purpose: "Operator surfaces" },
          { id: "tests", file: "tests/oracle.spec.ts", purpose: "Acceptance tests" },
          { id: "job-0", file: "src/jobs/show.ts", purpose: "Implement job \u201cshow\u201d" },
        ],
      },
    };
    const { core } = briefNounCore(BAKERY_BRIEF, context);
    for (const bad of ["console", "oracle", "spec", "www", "bloedows", "com", "no", "anywhere", "prices", "full", "wordpress", "elementor", "replace", "build"]) {
      assert.ok(!core.includes(bad), `pollution "${bad}" is not core (got ${core.join(",")})`);
    }
    for (const good of ["bakery", "bloedow", "website", "winona", "home", "show", "close", "text"]) {
      assert.ok(core.includes(good), `real product noun "${good}" stays core (got ${core.join(",")})`);
    }
    // H1 title only: a competitor named in the intro PROSE is not a core noun.
    assert.ok(!core.includes("crumbl"), "a prose competitor is not core");
  });

  it("a URL PATH noun is preserved (only the authority is stripped)", () => {
    const brief = "# Shop\n\nSee https://example.com/menu/ here.\n";
    const { core } = briefNounCore(brief, { lattice: { jobs: [], entities: [] } });
    assert.ok(core.includes("menu"), "a path noun survives (menu)");
    assert.ok(!core.includes("example") && !core.includes("com"), "the host tokens are excluded");
  });

  it("a bold SENTENCE FRAGMENT contributes nothing; a bold LABEL does", () => {
    const frag = "# Shop\n\nWe publish **no prices anywhere** here.\n";
    const label = "# Shop\n\nSee **Purchase requests** and **Staff**.\n";
    const f = briefNounCore(frag, { lattice: { jobs: [], entities: [] } });
    const l = briefNounCore(label, { lattice: { jobs: [], entities: [] } });
    for (const t of ["no", "prices", "anywhere"]) assert.ok(!f.core.includes(t), `fragment token ${t} excluded`);
    assert.ok(l.core.includes("purchaserequests") || l.core.includes("purchase"), "a bold label is core");
    assert.ok(l.core.includes("staff"), "a bold label is core");
  });
});

describe("fixes/348 p6-brief-fit still fails a generic tree, passes a faithful one", () => {
  // The exact predicate the p6-brief-fit DoD probe calls (sandbox.briefFitSubstancePasses).
  const BRIEF =
    "# Ledgerly - Rent Ledger\n\n## Core domain\n- **Lease**, **Tenant**, **Payment**.\n\n## Features\n- **RentCollection** and **RenewalReminder**.";
  const CONTEXT = {
    lattice: { jobs: ["collect", "remind"], entities: ["lease", "tenant", "payment"] },
    contracts: { entities: [{ name: "Lease" }, { name: "Tenant" }, { name: "Payment" }] },
    specGraph: { nodes: [{ id: "job-0", file: "src/jobs/collect.ts", purpose: "Implement job \u201ccollect\u201d" }] },
  };

  it("a generic tree that implements none of the brief's nouns FAILS the core bar", () => {
    const generic = [
      "export function genericHandler(): number { return 1; }",
      "export function doThing(): string { return \"x\"; }",
      "export function placeholder(): void {}",
    ].join("\n");
    const cov = briefFitCoverage(BRIEF, generic, CONTEXT);
    assert.ok(cov.core.length > 0, "the brief grounds a measured core");
    assert.ok(cov.missingCore.length > 0, "the generic tree misses the core nouns");
    assert.equal(briefFitSubstancePasses(BRIEF, generic, CONTEXT), false, "p6-brief-fit fails the generic tree");
  });

  it("a brief-faithful tree that implements the core nouns PASSES", () => {
    const { core } = briefNounCore(BRIEF, CONTEXT);
    const faithful = core.map((n) => `export function ${n}Handler(): number { return 1; }`).join("\n");
    const cov = briefFitCoverage(BRIEF, faithful, CONTEXT);
    assert.ok(cov.coreHits.length >= Math.max(1, Math.ceil(cov.core.length * 0.6)), `faithful coverage ${cov.coreHits.length}/${cov.core.length} clears 0.6`);
    assert.equal(briefFitSubstancePasses(BRIEF, faithful, CONTEXT), true, "p6-brief-fit passes the faithful tree");
  });

  it("the bar itself is unchanged at 0.6 and the need scales with the measured core", () => {
    const cov = briefFitCoverage(BRIEF, "export function unrelated(): void {}", CONTEXT);
    assert.equal(cov.need, Math.max(1, Math.ceil(cov.core.length * 0.6)), "ceil(core x 0.6)");
  });
});
