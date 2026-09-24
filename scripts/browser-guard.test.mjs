// ---------------------------------------------------------------------------
// browser-guard.test.mjs — pins the four target-check cases for
// scripts/browser-guard.mjs. W15-L1 port of W14-L3's scratch harness
// (WD-α finding R2: the cases lived only in C:/Users/mnril/w14l3_scratch/).
//
// checkedOutputPath's fail() calls process.exit(1) — an in-process refusal
// would kill the test runner — so every case runs in a child of this same file
// (`node <this file> --case <name>`); the child imports the REAL guard
// (relative to this file), prints one JSON line and exits.
//
// Cases (allowedDirs is the literal ["/workspace"] the real callers pass —
// scripts/browser-smoke.mjs:30-41 — so the accept case pins the Windows fix
// that resolves BOTH sides before the prefix compare):
//   1. accept  C:/workspace/screenshots/w15.png  → exit 0, resolved abs path
//   2. refuse  C:/workspace/../secret/x.png      → exit 1 (`..`-escape)
//   3. refuse  C:/Users/mnril/x.png              → exit 1 (outside every allowed dir)
//   4. refuse  C:/workspace                      → exit 1 (the strict allowed dir itself)
//
// Windows-shaped by design (drive-letter paths, the C: drive, same literals as
// the scratch harness): the guard's resolve-both-sides bug is a Windows path
// semantics defect, so the cases skip on non-Windows hosts. Run:
//   node --experimental-strip-types --test scripts/browser-guard.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkedOutputPath } from "./browser-guard.mjs";

const self = fileURLToPath(import.meta.url);
const CASE_FLAG = "--case";
const caseIdx = process.argv.indexOf(CASE_FLAG);
const caseArg = caseIdx === -1 ? null : process.argv[caseIdx + 1];

/** One entry per case; the child dispatches on `--case <name>`. */
const CASES = {
  "accept-windows-scratch": () => checkedOutputPath("C:/workspace/screenshots/w15.png", ["/workspace"]),
  "reject-escape": () => checkedOutputPath("C:/workspace/../secret/x.png", ["/workspace"]),
  "reject-outside": () => checkedOutputPath("C:/Users/mnril/x.png", ["/workspace"]),
  "strict-dir-itself": () => checkedOutputPath("C:/workspace", ["/workspace"]),
};

if (caseArg) {
  // Child mode: one case, then exit. Never reached under `--test` (no --case).
  const result = CASES[caseArg]();
  console.log(JSON.stringify({ case: caseArg, exit: 0, result }));
} else {
  // resolve("/workspace") is cwd-drive-relative on Windows: pin the child cwd
  // to the C: root so the accept case is deterministic (the repo lives on C:).
  const CHILD_CWD = resolve("C:/");
  const SKIP = process.platform !== "win32" ? "Windows-shaped C:/ cases (see header)" : false;

  function runCase(name) {
    try {
      const stdout = execFileSync(process.execPath, [self, CASE_FLAG, name], { cwd: CHILD_CWD, encoding: "utf8" });
      return { exit: 0, stdout, stderr: "" };
    } catch (err) {
      return { exit: err.status, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
    }
  }

  test("accepts a screenshot path under the POSIX-literal allowed dir (Windows resolve-both-sides)", { skip: SKIP }, () => {
    const r = runCase("accept-windows-scratch");
    assert.equal(r.exit, 0, `accept case must exit 0; stderr: ${r.stderr}`);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.exit, 0);
    assert.equal(typeof parsed.result, "string", "checkedOutputPath returns the resolved absolute path");
    assert.match(parsed.result, /screenshots[\\/]w15\.png$/, "the accepted path is returned resolved");
    assert.match(
      parsed.result.toLowerCase(),
      /^c:\\workspace\\screenshots\\/,
      "resolved INSIDE the allowed dir — the fix resolves both sides before the prefix compare",
    );
  });

  const REFUSALS = [
    ["reject-escape", "refuses a `..`-escape that resolves outside the allowed dir"],
    ["reject-outside", "refuses a path outside every allowed dir"],
    ["strict-dir-itself", "refuses the allowed dir itself (strict containment, never a bare prefix)"],
  ];
  for (const [name, description] of REFUSALS) {
    test(description, { skip: SKIP }, () => {
      const r = runCase(name);
      assert.equal(r.exit, 1, `refusal "${name}" must exit 1 (fail-closed)`);
      assert.equal(r.stdout, "", "a refused path must never print the success JSON");
      const parsed = JSON.parse(r.stderr);
      assert.equal(parsed.ok, false);
      assert.match(parsed.error, /must be under \/workspace/, "the refusal names the allowed dir");
      assert.match(parsed.error, /screenshot/, "the refusal labels the target kind");
    });
  }
}
