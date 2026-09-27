/**
 * W23 L6 (T4.3 · research/multiagent/249_define_first_specs.md §SPEC 2, Host 2)
 * — the preservation probe: the repair cycle over a USER-EDITED emitted tree.
 *
 * The guarantee under test (the row's done-when, unchanged): the edit/repair
 * cycle either PRESERVES the user's edit or REFUSES LOUDLY — it never silently
 * overwrites. This is the row's "scratch edit-cycle probe" as a committed,
 * CI-able temp-dir test: the REAL `repairTreeDir` runs in-process (no mocks) on
 * a fixture tree whose `generatedTree` hashes were taken BEFORE the user's edit,
 * keyless so the deterministic floor refuses to synthesize (no key ⇒ no
 * fabricated repair, and therefore nothing to write over the edit).
 *
 * Why the keyless precondition is part of the design: with a key the cycle may
 * legitimately LAND an accounting delta (PASS-A names it), so the keyless leg is
 * the one that must end with `applied.written: []` and the edit byte-intact —
 * the strongest form of "the edited dir stands as-is".
 *
 * Path discipline (headless.ts repairTreePathRefusal, allowed roots
 * `src/api/ src/domain/ src/jobs/ src/state/ src/ui/ src/generated/ tests/`):
 * the fixture MUST use `src/domain/…`, or the probe would silently measure the
 * path refusal instead of the preservation guarantee.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repairTreeDir } from "./headless.ts";
import { fnv1a } from "./algorithms.ts";
import { seedProject } from "./testing/fixtures.ts";
import type { Project } from "./types.ts";

/** The user's own module — clean, importable, and about to be hand-edited. */
const CLEAN_APP = [
  "// src/domain/app.ts — the user's own module (T4.3 fixture).",
  "export function greet(name: string): string {",
  "  return `hello ${name}`;",
  "}",
  "",
].join("\n");
/** Parse-broken on purpose: the tree-run must go RED (the real compile seam). */
const BROKEN = "export function broken( {\n";
/** THE user edit — appended AFTER the ledger hash was taken (a REAL edit). */
const USER_EDIT = "\n// USER-EDIT-MARKER-249\n";

/** Keyless precondition: the deterministic floor must refuse to synthesize. */
async function withoutKey<T>(fn: () => Promise<T>): Promise<T> {
  const saved = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = saved;
  }
}

describe("W23 L6 — T4.3 preservation probe (repair cycle over a user-edited tree)", () => {
  it("a keyless repair cycle over the edited tree ends FAILED with the edit byte-intact and NOTHING written", async () => {
    const dir = mkdtempSync(join(tmpdir(), "t43-"));
    try {
      mkdirSync(join(dir, "src", "domain"), { recursive: true });
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "t43-fixture", private: true, type: "module" }),
        "utf8",
      );
      writeFileSync(join(dir, "src", "domain", "app.ts"), CLEAN_APP, "utf8");
      writeFileSync(join(dir, "src", "domain", "broken.ts"), BROKEN, "utf8");

      // The ledger: real fnv1a hashes of the PRE-EDIT bytes — the same hashing
      // seam `importTreeDir` re-checks, so the append below reads as a REAL edit.
      const project: Project = {
        ...seedProject(),
        generatedTree: [
          { path: "src/domain/app.ts", source: CLEAN_APP, hash: String(fnv1a(CLEAN_APP)), attempt: 0 },
          { path: "src/domain/broken.ts", source: BROKEN, hash: String(fnv1a(BROKEN)), attempt: 0 },
        ],
      };

      // THE USER EDIT — after the hash snapshot, never before.
      appendFileSync(join(dir, "src", "domain", "app.ts"), USER_EDIT, "utf8");

      const res = await withoutKey(() => repairTreeDir(project, dir, { budget: 1 }));

      // The six assertions of the spec, each pinned so the probe cannot pass
      // vacuously (it FAILS if the cycle clobbers, silently rewrites, or lies).
      assert.equal(res.ok, false, "a red tree-run + keyless synthesis must end FAILED, never a claimed repair");
      assert.equal(res.outcome, "failed", "the honest outcome (no converged claim)");
      assert.equal(res.cycles, 1, "the single budgeted cycle ran, then the budget was exhausted");
      assert.deepEqual(
        res.import.changed,
        ["src/domain/app.ts"],
        "the hash-checked census sees exactly the user's edit — broken.ts is unchanged",
      );
      assert.deepEqual(res.applied.written, [], "nothing was written over the edited dir (no silent clobber)");
      const after = readFileSync(join(dir, "src", "domain", "app.ts"), "utf8");
      assert.equal(after, CLEAN_APP + USER_EDIT, "the user's edit survives the cycle BYTE-FOR-BYTE");
      assert.ok(
        res.events.some((e) =>
          e.includes("budget exhausted after 1 repair cycle(s) — repair FAILED, the edited dir stands as-is"),
        ),
        "the loud refusal is in the envelope — the failure is announced, never a silent overwrite",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
