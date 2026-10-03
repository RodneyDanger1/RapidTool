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
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkEntryContract, validateExpectedBehavior } from "./entry-oracle.ts";

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
