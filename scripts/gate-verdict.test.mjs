// scripts/gate-verdict.test.mjs — W29 LANE H · R5-f01 (A2-f02 · W-09 · R15-f06).
//
// Proves the ONE property gate.sh's embedded verdict program must have: a
// non-zero test-leg exit can NEVER produce a green verdict. At HEAD the exit
// condition consulted typecheck/lint/assertionGaps/build only, so a leg that
// died WITHOUT emitting TAP `not ok` lines (runner crash, unresolvable glob,
// missing file, OOM) yielded `ok:true` + exit 0 — reproduced live in §R5-f01.
//
// Method (mirrors §R5-f01's fixture spec byte-for-byte):
//   1. extract the verdict program from gate.sh's `<<'NODE'` … `NODE` heredoc
//      (fail loudly if the markers move — never silently skip);
//   2. write fixture `results` + gate logs into a temp dir;
//   3. invoke the program exactly as gate.sh does:
//      node - results startMs double tclog lintlog s1 l1 s2 l2 bldlog
//   4. assert the four cases A/B/C/D below.
//
// Case A is RED at HEAD (the P1 proof) and green after the exit-condition fix.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE_SH = path.join(HERE, "gate.sh");

const GATE_IDS = ["typecheck", "lint", "assertionGaps", "testsScripts", "testsLib", "build"];

// ---------------------------------------------------------------------------
// gate.sh program extraction — the heredoc between `<<'NODE'` and a line `NODE`.
// ---------------------------------------------------------------------------
function extractVerdictProgram() {
  const src = fs.readFileSync(GATE_SH, "utf8");
  const marker = src.indexOf("<<'NODE'");
  assert.notEqual(
    marker,
    -1,
    "gate.sh: the `<<'NODE'` heredoc marker moved — the verdict program can no longer be extracted; update this fixture together with gate.sh",
  );
  const after = src.indexOf("\n", marker) + 1;
  assert.ok(after > 0, "gate.sh: no newline after the heredoc marker");
  const rest = src.slice(after);
  const terminator = /^NODE$/m.exec(rest);
  assert.ok(
    terminator,
    "gate.sh: the heredoc terminator line `NODE` is missing — the verdict program can no longer be extracted",
  );
  const program = rest.slice(0, terminator.index);
  assert.ok(
    program.includes("process.exitCode = code"),
    "gate.sh: the extracted block does not look like the verdict program (missing exitCode write)",
  );
  return program;
}

// ---------------------------------------------------------------------------
// Fixture harness — one temp dir per case; every gate exit must be spelled out
// (the program defaults a MISSING exit to 1, so a partial results file would
// silently pin a red pre-state).
// ---------------------------------------------------------------------------
function runVerdict({ exits, double = false, logs = {} }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-verdict-"));
  const row = (id, code) => `${id}.exit\t${code}\n${id}.ms\t1`;
  const resultsPath = path.join(dir, "results");
  fs.writeFileSync(
    resultsPath,
    `${GATE_IDS.map((id) => row(id, exits[id] ?? 0)).join("\n")}\n`,
  );
  const logPath = (name, fallbackText) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, logs[name] ?? fallbackText);
    return p;
  };
  const typecheckLog = logPath("typecheck.log", "");
  const lintLog = logPath("lint.log", "");
  // Unspecified test legs default to a GREEN log: the exit-0 / zero-`# pass`
  // guard (W42 L4-G1) lifts a fully silent clean-exit leg into hardFails, and
  // a case only speaks about the legs it names — every other leg ran green.
  const s1 = logPath("testsScripts.log", TAP_GREEN);
  const l1 = logPath("testsLib.log", TAP_GREEN);
  const s2 = double ? logPath("testsScripts2.log", "") : "";
  const l2 = double ? logPath("testsLib2.log", "") : "";
  const buildLog = logPath("build.log", "");

  const program = extractVerdictProgram();
  const startMs = String(Date.now());
  const res = spawnSync(
    process.execPath,
    [
      "-",
      resultsPath,
      startMs,
      double ? "1" : "0",
      typecheckLog,
      lintLog,
      s1,
      l1,
      s2,
      l2,
      buildLog,
    ],
    { input: program, encoding: "utf8" },
  );
  assert.equal(res.error, undefined, `spawn failed: ${res.error}`);
  let verdict = null;
  const out = res.stdout.trim();
  if (out) {
    try {
      verdict = JSON.parse(out);
    } catch (err) {
      assert.fail(`verdict stdout is not one JSON object: ${err.message}\nstdout: ${out.slice(0, 400)}`);
    }
  }
  return { status: res.status, verdict, stderr: res.stderr };
}

const TAP_RED = "TAP version 13\nnot ok 1 - some failing test\n# fail 1\n";
const CRASH_NO_TAP =
  "node:internal/modules/cjs/loader:1215\nError: Cannot find module 'some-missing-suite'\n";
const TAP_GREEN = "TAP version 13\n# pass 5\n# fail 0\n";

// ---------------------------------------------------------------------------
// A · the P1 proof — leg exit 1 with ZERO `not ok` lines, all others green.
// RED at HEAD: `ok:true` + exit 0. After the fix: `ok:false` + exit 1 + a
// synthetic hardFails entry naming the leg (so the red is loud, not nameless).
// ---------------------------------------------------------------------------
test("A: a test leg that exits non-zero without TAP failure lines is never a green verdict", () => {
  const { status, verdict } = runVerdict({
    exits: { testsScripts: 1 },
    logs: { "testsScripts.log": CRASH_NO_TAP },
  });
  assert.equal(status, 1, "gate.sh verdict must exit 1 when a leg exits non-zero without TAP lines");
  assert.equal(verdict.ok, false, "verdict.ok must be false");
  assert.equal(verdict.gates.testsScripts.ok, false, "the failed leg is recorded red");
  assert.equal(verdict.flakes.length, 0, "a runner-level failure is not a flake");
  assert.ok(
    verdict.hardFails.some((n) => n.startsWith("testsScripts (exit 1") && n.includes("runner produced no TAP failure lines")),
    `hardFails must name the silent leg; got ${JSON.stringify(verdict.hardFails)}`,
  );
});

// ---------------------------------------------------------------------------
// B · the classic path stays intact — a named TAP failure is a hard fail.
// ---------------------------------------------------------------------------
test("B: a named TAP failure is a hard fail (unchanged behavior)", () => {
  const { status, verdict } = runVerdict({
    exits: { testsScripts: 1 },
    logs: { "testsScripts.log": TAP_RED },
  });
  assert.equal(status, 1);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.hardFails.includes("some failing test"));
});

// ---------------------------------------------------------------------------
// C · a genuinely green run still reads green.
// ---------------------------------------------------------------------------
test("C: all gates green → ok:true, exit 0", () => {
  const { status, verdict } = runVerdict({
    exits: {},
    logs: { "testsScripts.log": TAP_GREEN, "testsLib.log": TAP_GREEN },
  });
  assert.equal(status, 0);
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.hardFails, []);
  assert.deepEqual(verdict.flakes, []);
});

// ---------------------------------------------------------------------------
// D · --double disagreement is a flake (exit 3), never a hard fail.
// ---------------------------------------------------------------------------
test("D: --double run-1/run-2 disagreement → exit 3 with both names as flakes", () => {
  const { status, verdict } = runVerdict({
    exits: { testsScripts: 1 },
    double: true,
    logs: {
      "testsScripts.log": "TAP version 13\nnot ok 1 - flakey X\n# fail 1\n",
      "testsScripts2.log": "TAP version 13\nnot ok 1 - flakey Y\n# fail 1\n",
    },
  });
  assert.equal(status, 3, "run-1-only / run-2-only failures are flakes (exit 3)");
  assert.ok(verdict.flakes.includes("flakey X"));
  assert.ok(verdict.flakes.includes("flakey Y"));
  assert.deepEqual(verdict.hardFails, [], "a disagreement is not a hard fail");
});

// ---------------------------------------------------------------------------
// E · --double, run-1 crash without TAP lines / run-2 produced none either:
// still exit 1 (fixes/173 §F-H11 — a runner-level red is never a flake).
// ---------------------------------------------------------------------------
test("E: --double, leg crashed in run 1 with no TAP names → exit 1 (never 3)", () => {
  const { status, verdict } = runVerdict({
    exits: { testsScripts: 1 },
    double: true,
    logs: { "testsScripts.log": CRASH_NO_TAP },
  });
  assert.equal(status, 1, "a crash with no test names must read as a hard fail, never a flake");
  assert.equal(verdict.ok, false);
  assert.equal(verdict.flakes.length, 0);
});

// ---------------------------------------------------------------------------
// F · W42 L4-G1: a leg that EXITS 0 while reporting ZERO `# pass` lines ran
// nothing (empty glob, early bail) — the verdict must not read green off an
// empty leg. Named `F` because the letter `E` above already owns the
// --double crash case (F-H11); the two guards are independent.
// ---------------------------------------------------------------------------
test("F: exit-0 leg with zero '# pass' lines → ok:false, exit 1 (no green off an empty leg)", () => {
  const { status, verdict } = runVerdict({
    exits: {},
    logs: { "testsScripts.log": "", "testsLib.log": TAP_GREEN },
  });
  assert.equal(status, 1, "a clean-exit leg with zero '# pass' lines must read as a hard fail");
  assert.equal(verdict.ok, false, "verdict.ok must be false");
  assert.ok(
    verdict.hardFails.some((n) => n.startsWith("testsScripts (exit 0 but zero '# pass' lines")),
    `hardFails must name the silent leg; got ${JSON.stringify(verdict.hardFails)}`,
  );
});
