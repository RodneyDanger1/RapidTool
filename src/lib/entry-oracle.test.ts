// ---------------------------------------------------------------------------
// entry-oracle.test.ts - 337-3 Trust: the entry/behavior contract record.
//
// The module had NO test of its own. This suite pins the completeness rule:
// `complete` must be able to be FALSE. Before this it was
// `rows.every((r) => r.status !== "pending")` over a status no row can carry,
// so it was vacuously true for EVERY contract - including one that declared
// nothing at all (a verifier that cannot fail).
//
// Run: node --experimental-strip-types --test src/lib/entry-oracle.test.ts
// ---------------------------------------------------------------------------
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkEntryContract, runEntryOracle, validateExpectedBehavior } from "./entry-oracle.ts";

const DIR = process.cwd();

describe("checkEntryContract - completeness is falsifiable (337-3)", () => {
  it("a declaration with ZERO rows is NOT complete (an empty every() must not claim completeness)", () => {
    const rec = checkEntryContract([], DIR, () => true);
    assert.equal(rec.declared, 0);
    assert.equal(rec.pending, 0);
    assert.equal(rec.complete, false, "nothing declared = nothing verified = not complete");
    assert.equal(rec.note !== null, true, "and the zero-row state says so");
  });

  it("a declared, evaluated contract is complete", () => {
    const rec = checkEntryContract([{ id: "a", check: "file-exists", path: "x.ts" }], DIR, () => true);
    assert.equal(rec.declared, 1);
    assert.equal(rec.complete, true);
    assert.equal(rec.ok, true);
    assert.equal(rec.passed, 1);
  });

  it("a FAILED row is terminal evidence (complete) but not ok", () => {
    const rec = checkEntryContract([{ id: "a", check: "file-exists", path: "x.ts" }], DIR, () => false);
    assert.equal(rec.complete, true, "a fail is evaluated evidence, not a pending state");
    assert.equal(rec.ok, false);
    assert.equal(rec.failed, 1);
  });

  it("a verified ui-shell skip is terminal (complete, not a failure)", () => {
    const rec = checkEntryContract([{ id: "u", check: "entry-runs", uiShell: true }], DIR, (p) => p === "index.html");
    assert.equal(rec.uiShell, 1);
    assert.equal(rec.pending, 0);
    assert.equal(rec.complete, true);
    assert.equal(rec.ok, true);
  });

  // A1-E16: the ui-shell status is a correct STRUCTURAL pass, but it bypasses
  // the only behavioural oracle (`entry-runs`) for exactly the emitted webapp/
  // game kinds — so a `p6-*` advisory makes that visible and "treeRun green"
  // never reads as product evidence.
  it("A1-E16: a ui-shell row is a structural pass that carries a p6-* advisory", () => {
    const rec = checkEntryContract([{ id: "u", check: "entry-runs", uiShell: true }], DIR, (p) => p === "index.html");
    assert.equal(rec.ok, true, "the structural status is kept (it is correct)");
    assert.ok(rec.advisory, "the bypassed behavioural oracle is made visible");
    assert.equal(rec.advisory!.event, "p6-oracle-ui-shell-bypassed");
    assert.match(rec.advisory!.detail, /\bu\b/, "the skipped row id is named");
    assert.match(rec.advisory!.detail, /behavioural entry oracle was NOT run/);
    assert.match(rec.advisory!.detail, /never product evidence/);
  });

  it("A1-E16: no advisory when no ui-shell row was evaluated (legacy record unchanged)", () => {
    const rec = checkEntryContract([{ id: "a", check: "file-exists", path: "x.ts" }], DIR, () => true);
    assert.equal(rec.advisory, undefined);
  });

  it("a declared uiShell whose tree carries no index.html FAILS (never a free pass)", () => {
    const rec = checkEntryContract([{ id: "u", check: "entry-runs", uiShell: true }], DIR, () => false);
    assert.equal(rec.failed, 1);
    assert.equal(rec.ok, false);
  });

  it("pending is structurally 0 - no evaluated row ever awaits evidence", () => {
    const rec = checkEntryContract(
      [
        { id: "a", check: "file-exists", path: "x.ts" },
        { id: "u", check: "entry-runs", uiShell: true },
      ],
      DIR,
      (p) => p === "index.html" || p === "x.ts",
    );
    assert.equal(rec.pending, 0);
    assert.equal(rec.complete, true);
  });
});

describe("validateExpectedBehavior - the declaration contract", () => {
  it("normalizes a valid entry-runs row and refuses a uiShell+entry contradiction", () => {
    const ok = validateExpectedBehavior([
      { id: "e", check: "entry-runs", entry: "./src/main.ts", mode: "exec" },
    ]);
    assert.equal(ok.ok, true);
    const bad = validateExpectedBehavior([{ id: "e", check: "entry-runs", uiShell: true, entry: "src/main.ts" }]);
    assert.equal(bad.ok, false);
  });

  it("refuses an unknown check and an entry-runs row that names nothing", () => {
    assert.equal(validateExpectedBehavior([{ id: "x", check: "nope" }]).ok, false);
    assert.equal(validateExpectedBehavior([{ id: "x", check: "entry-runs" }]).ok, false);
  });

  it("an absent declaration is zero rows, not an error", () => {
    const r = validateExpectedBehavior(undefined);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.rows, []);
  });
});

// ---------------------------------------------------------------------------
// 338-6 — no oracle row may carry a declaration its check never evaluates.
// The 337-3 fix closed the vacuous `complete`; this closes the same class one
// layer down: a field the evaluator silently ignores makes the row read green
// without the thing it declared. A `uiShell` row is a structural skip, so a
// declared exit/stdout expectation on it can never be enforced; likewise a
// runtime field on a file-exists / package-target-exists row.
// ---------------------------------------------------------------------------
describe("validateExpectedBehavior - a declaration is never silently dropped (338-6)", () => {
  it("refuses runtime expectations on a uiShell structural-skip row", () => {
    for (const stray of [
      { expectExit: 1 },
      { expectStdout: "MUST_APPEAR" },
      { expectStderr: "MUST_APPEAR" },
      { args: ["--x"] },
      { mode: "exec" },
      { timeoutMs: 1000 },
    ]) {
      const r = validateExpectedBehavior([{ id: "u", check: "entry-runs", uiShell: true, ...stray }]);
      assert.equal(r.ok, false, `uiShell + ${JSON.stringify(stray)} must be refused, not silently ignored`);
    }
  });

  it("refuses a runtime field on a non-runtime check", () => {
    const cases: unknown[] = [
      [{ id: "f", check: "file-exists", path: "x.ts", expectExit: 1 }],
      [{ id: "f", check: "file-exists", path: "x.ts", target: "main" }],
      [{ id: "p", check: "package-target-exists", target: "main", path: "x.ts" }],
      [{ id: "p", check: "package-target-exists", target: "main", entry: "src/main.ts" }],
    ];
    for (const rows of cases) {
      assert.equal(validateExpectedBehavior(rows).ok, false, `${JSON.stringify(rows)} must be refused`);
    }
  });

  it("still accepts every legal field set (control: the corpus row shapes)", () => {
    const ok = validateExpectedBehavior([
      { id: "f", check: "file-exists", path: "x.ts", note: "n" },
      { id: "p", check: "package-target-exists", target: "bin", note: "n" },
      { id: "u", check: "entry-runs", uiShell: true, note: "n" },
      { id: "e", check: "entry-runs", entry: "src/main.ts", mode: "exec", args: ["--x"], expectExit: 0, expectStdout: "ok", expectStderr: "warn", timeoutMs: 5000, note: "n" },
    ]);
    assert.equal(ok.ok, true);
  });
});

// ---------------------------------------------------------------------------
// 339-6 — the sibling hunt for the 338-6 class, one layer down at the RUNNER
// (runEntryOracle is the shared truth `evaluateEntryRunsRow` + every tree-side
// declaration reader consume). A declaration that can never be violated is a
// verifier that cannot fail:
//   - an empty-string expectStdout/expectStderr pin is satisfied by
//     `String(out).includes("")` for EVERY run, so it proves nothing;
//   - a non-integer expectExit was silently coerced to the default 0, so the
//     declared exit was never evaluated.
// The validator refuses both through the normal path; the runner must refuse
// them too, so a direct caller can never mint a green from a hollow row.
// ---------------------------------------------------------------------------
describe("runEntryOracle — a declared pin must be able to fail (339-6)", () => {
  let dir = "";
  before(() => {
    dir = mkdtempSync(join(tmpdir(), "rt3396-oracle-"));
    writeFileSync(join(dir, "main.js"), 'console.log("ok");\n');
  });
  after(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });
  const has = (p: string): boolean => p === "main.js";
  const row = (extra: Record<string, unknown>) =>
    ({ id: "e", check: "entry-runs", entry: "main.js", ...extra }) as unknown as Parameters<
      typeof runEntryOracle
    >[0];

  it("an empty-string stdout pin is refused, never vacuously satisfied", () => {
    const v = runEntryOracle(row({ expectStdout: "" }), dir, has);
    assert.equal(v.status, "fail", "includes('') is always true — the pin must be refused");
    assert.match(v.detail, /empty/i);
  });

  it("an empty-string stderr pin is refused, never vacuously satisfied", () => {
    const v = runEntryOracle(row({ expectStderr: "" }), dir, has);
    assert.equal(v.status, "fail");
    assert.match(v.detail, /empty/i);
  });

  it("a non-integer expectExit is refused, never silently defaulted to 0", () => {
    const v = runEntryOracle(row({ expectExit: "1" }), dir, has);
    assert.equal(v.status, "fail", "a declared exit the runner never evaluates must not read green");
    assert.match(v.detail, /expectExit/i);
  });

  it("control: a real pin on the same entry still passes", () => {
    const v = runEntryOracle(row({ expectStdout: "ok", expectExit: 0 }), dir, has);
    assert.equal(v.status, "pass", v.detail);
  });
});
