// ---------------------------------------------------------------------------
// browser-guard.test.mjs — pins the target-check cases for
// scripts/browser-guard.mjs.
//
// checkedOutputPath's fail() calls process.exit(1) — an in-process refusal
// would kill the test runner — so every case runs in a child of this same file
// (`node <this file> --case <name>`); the child imports the REAL guard
// (relative to this file), prints one JSON line and exits.
//
// R11-f06 (S-04) rewrite of the W15 pins: the old "accept-windows-scratch"
// case pinned the drive-root mapping (allowed dir "/workspace" → C:\workspace
// accepted on win32) — the exact S-04 hole the audit row declares unsafe. The
// guard now fails closed on win32 for POSIX-literal allow-dirs, and the
// accept/refuse cases run against a REAL tmp dir (platform-neutral):
//   1. accept  <tmp>/screenshots/w15.png under [<tmp>]   → exit 0, resolved
//   2. refuse  <tmp>/../secret/x.png                      → exit 1 (`..` escape)
//   3. refuse  <other-tmp>/x.png                          → exit 1 (outside every allowed dir)
//   4. refuse  <tmp> (the allowed dir itself)             → exit 1 (strict containment)
//   5. refuse  ["/workspace"] on win32                    → exit 1 (fail-closed, never C:\workspace)
// Case 5 is win32-only by construction (on POSIX, "/workspace" may be a real
// path and is judged physically).
// Run:
//   node --test scripts/browser-guard.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkedOutputPath } from "./browser-guard.mjs";

const self = fileURLToPath(import.meta.url);
const CASE_FLAG = "--case";
const caseIdx = process.argv.indexOf(CASE_FLAG);
const caseArg = caseIdx === -1 ? null : process.argv[caseIdx + 1];

const realDir = () => mkdtempSync(join(tmpdir(), "browser-guard-"));

/** One entry per case; the child dispatches on `--case <name>`. */
const CASES = {
  "accept-real-dir": () => {
    const dir = realDir();
    return checkedOutputPath(join(dir, "screenshots", "w15.png"), [dir]);
  },
  "reject-escape": () => {
    const dir = realDir();
    return checkedOutputPath(join(dir, "..", "secret", "x.png"), [dir]);
  },
  "reject-outside": () => {
    const dir = realDir();
    const other = realDir();
    return checkedOutputPath(join(other, "x.png"), [dir]);
  },
  "strict-dir-itself": () => {
    const dir = realDir();
    return checkedOutputPath(dir, [dir]);
  },
  "reject-posix-literal-win32": () => checkedOutputPath("C:/workspace/screenshots/w15.png", ["/workspace"]),
};

if (caseArg) {
  // Child mode: one case, then exit. Never reached under `--test` (no --case).
  const result = CASES[caseArg]();
  console.log(JSON.stringify({ case: caseArg, exit: 0, result }));
} else {
  const SKIP_WIN32 = process.platform !== "win32" ? "win32-only case (R11-f06 fail-closed branch)" : false;

  function runCase(name) {
    try {
      const stdout = execFileSync(process.execPath, [self, CASE_FLAG, name], { encoding: "utf8" });
      return { exit: 0, stdout, stderr: "" };
    } catch (err) {
      return { exit: err.status, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
    }
  }

  test("accepts a screenshot path under a real allowed dir (physical + lexical containment)", () => {
    const r = runCase("accept-real-dir");
    assert.equal(r.exit, 0, `accept case must exit 0; stderr: ${r.stderr}`);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.exit, 0);
    assert.equal(typeof parsed.result, "string", "checkedOutputPath returns the resolved absolute path");
    assert.match(parsed.result, /screenshots[\\/]w15\.png$/, "the accepted path is returned resolved");
  });

  const REFUSALS = [
    ["reject-escape", "refuses a `..`-escape that resolves outside the allowed dir"],
    ["reject-outside", "refuses a path outside every allowed dir"],
    ["strict-dir-itself", "refuses the allowed dir itself (strict containment, never a bare prefix)"],
  ];
  for (const [name, description] of REFUSALS) {
    test(description, () => {
      const r = runCase(name);
      assert.equal(r.exit, 1, `refusal "${name}" must exit 1 (fail-closed)`);
      assert.equal(r.stdout, "", "a refused path must never print the success JSON");
      const parsed = JSON.parse(r.stderr);
      assert.equal(parsed.ok, false);
      assert.match(parsed.error, /must be under/, "the refusal names the containment rule");
      assert.match(parsed.error, /screenshot/, "the refusal labels the target kind");
    });
  }

  test(
    "R11-f06: fails closed on win32 instead of mapping a POSIX-literal allowed dir onto a drive root",
    { skip: SKIP_WIN32 },
    () => {
      const r = runCase("reject-posix-literal-win32");
      assert.equal(r.exit, 1, "the old C:\\workspace accept must now exit 1 (fail closed)");
      assert.equal(r.stdout, "", "a refused path must never print the success JSON");
      const parsed = JSON.parse(r.stderr);
      assert.equal(parsed.ok, false);
      assert.match(parsed.error, /failed closed on win32/, "the refusal names the fail-closed branch");
      assert.match(parsed.error, /POSIX-style path/, "the refusal names WHY (POSIX literal on win32)");
      assert.match(parsed.error, /screenshot/, "the refusal labels the target kind");
    },
  );
}
