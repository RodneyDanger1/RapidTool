// ---------------------------------------------------------------------------
// zero-byte-guard.test.ts — OV-19 (W17 LANE 5): the zero-byte SOURCE guard.
//
// Field evidence (research/multiagent/225_field_failures_forensics.md, hunt 2):
// 12 zero-byte files across 6 competitor clones — four of them modules a doc
// claimed were implemented (Devika's `src/sandbox/*.py` — the very "sandbox" the
// architecture doc advertises), and two named TEST files that silently assert
// nothing (opencode `test/config/plugin.test.ts` 0 B while a same-path sibling =
// 9003 B; SWE-agent `tests/tools/test_edit_replace.py`). The class is invisible
// to every current gate: a 0-byte module still typechecks, still lints, and a
// 0-byte test file contributes zero cases while the suite stays green.
//
// Scope (per fixes/228 §3's OV-19 verdict — "scope to source+test extensions
// with an explicit allowlist"): tracked files whose extension is code-bearing
// (SOURCE_TEST_EXTS below). Data/config/asset extensions (.md/.json/.css/
// .gitkeep/.lock) are OUT of scope on purpose — a legitimate placeholder is not
// this failure class (225's own self-rejection of the naive version).
//
// This file IS the check (it runs in the `src/lib/**/*.test.ts` leg of
// scripts/gate.sh), and it carries its own detector self-tests so the guard
// cannot pass vacuously. The row's second clause ("a named test file contains
// >= 1 case") is ALREADY mechanically owned by the T-17 assertion-gap lint
// (scripts/check-assertion-gaps.mjs, gate 3: "zero-assertion test blocks") —
// this guard deliberately does not duplicate it.
//
// Run: node --experimental-strip-types --test src/lib/zero-byte-guard.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root, located from this file — same convention as headless.test.ts:1066. */
const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** Code-bearing extensions: the repo's source + test surface. `.sh` is included
 *  because scripts/*.sh is executable surface (a 0-byte gate.sh would break the
 *  entire pipeline). Deliberately EXCLUDED: .md/.json/.yaml/.css/.gitkeep/.lock
 *  — config/data/asset files where 0 B can be legitimate. */
const SOURCE_TEST_EXTS: readonly string[] = [
  ".ts", ".tsx", ".mts", ".cts",
  ".js", ".jsx", ".mjs", ".cjs",
  ".sh",
];

/** Explicit allowlist — an entry here is exempt from the guard. Keep it honest:
 *  add a file ONLY with a one-line reason, and the last test in this file fails
 *  if an entry stops being a tracked file (no stale exemptions). Both entries
 *  below are already OUT of extension scope today; they are listed so a future
 *  scope widening cannot silently turn them into offenders. */
const ALLOWLIST: readonly string[] = [
  "screenshots/.gitkeep", // placeholder that keeps the screenshots/ dir in git
  ".node_modules.lock", // lock marker file; its 0 bytes carry no code
];

type TrackedFile = { path: string; bytes: number };

/** Tracked (git ls-files) paths with their on-disk byte size.
 *  A tracked path missing from the worktree is SKIPPED, not flagged: deletions
 *  are `git status`'s class, not this guard's. Throws if git is unavailable —
 *  a guard that cannot scan must fail loudly, never pass vacuously. */
function statTrackedFiles(root: string): TrackedFile[] {
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const files: TrackedFile[] = [];
  for (const rel of out.split("\0")) {
    if (!rel) continue;
    let bytes: number;
    try {
      bytes = statSync(join(root, rel)).size;
    } catch {
      continue;
    }
    files.push({ path: rel, bytes });
  }
  return files;
}

/** True iff the path carries a code-bearing (source/test) extension. */
function isSourceOrTest(path: string): boolean {
  return SOURCE_TEST_EXTS.includes(extname(path).toLowerCase());
}

/** The guard: 0-byte files in scope, minus the explicit allowlist. */
function zeroByteOffenders(
  files: readonly TrackedFile[],
  opts?: { allowlist?: readonly string[] },
): string[] {
  const allow = new Set(opts?.allowlist ?? ALLOWLIST);
  return files
    .filter((f) => f.bytes === 0 && isSourceOrTest(f.path) && !allow.has(f.path))
    .map((f) => f.path);
}

describe("OV-19 — zero-byte source/test guard (W17 LANE 5)", () => {
  it("this repo carries 0 zero-byte source/test files (the field class: 12 files across 6 clones)", () => {
    const tracked = statTrackedFiles(REPO_ROOT);
    assert.ok(
      tracked.length >= 300,
      `the scan must not be vacuous — tracked files seen: ${tracked.length}`,
    );
    const offenders = zeroByteOffenders(tracked);
    assert.deepEqual(
      offenders,
      [],
      `zero-byte source/test files found (fix the file or add a reasoned allowlist entry): ${offenders.join(", ")}`,
    );
  });

  it("the detector flags a 0-byte source file AND a 0-byte test file — and nothing out of scope", () => {
    const dir = mkdtempSync(join(tmpdir(), "rapidtool-zero-byte-"));
    try {
      // The Devika case (empty module), the opencode case (empty test),
      // plus out-of-scope decoys and a non-empty control.
      const bodies: Array<[string, string]> = [
        ["empty.ts", ""],
        ["empty.test.mjs", ""],
        ["empty.txt", ""],
        ["keep.gitkeep", ""],
        ["nonempty.ts", "export const a = 1;\n"],
      ];
      for (const [rel, body] of bodies) writeFileSync(join(dir, rel), body, "utf8");
      const files: TrackedFile[] = bodies.map(([rel]) => ({
        path: rel,
        bytes: statSync(join(dir, rel)).size,
      }));
      assert.deepEqual(zeroByteOffenders(files), ["empty.ts", "empty.test.mjs"]);
      assert.deepEqual(
        zeroByteOffenders(files, { allowlist: ["empty.ts"] }),
        ["empty.test.mjs"],
        "an allowlisted path is exempt; the mechanism is pinned here",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the scope is extension-based and explicit (placeholders are not this class)", () => {
    assert.equal(isSourceOrTest("screenshots/.gitkeep"), false);
    assert.equal(isSourceOrTest(".node_modules.lock"), false);
    assert.equal(isSourceOrTest("README.md"), false);
    assert.equal(isSourceOrTest("package.json"), false);
    assert.equal(isSourceOrTest("src/lib/engine.ts"), true);
    assert.equal(isSourceOrTest("scripts/gate.sh"), true);
    assert.equal(isSourceOrTest("src/lib/zero-byte-guard.test.ts"), true);
  });

  it("the allowlist holds no stale entries — every entry is a tracked file", () => {
    const tracked = statTrackedFiles(REPO_ROOT);
    const paths = new Set(tracked.map((f) => f.path));
    for (const entry of ALLOWLIST) {
      assert.ok(paths.has(entry), `allowlist entry is not a tracked file: ${entry}`);
    }
  });
});
