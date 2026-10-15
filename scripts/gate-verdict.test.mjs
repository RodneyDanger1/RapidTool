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
//      node - results startMs double tclog lintlog s1 l1 s2 l2 bldlog prevlog quarantine
//   4. assert the four cases A/B/C/D below.
//
// The stage set mirrors gate.sh's real `run` sequence, including the PR-26
// `prevention` stage (its JSON fields ok/missed/pending/skipped/count/countFloor
// are what the program parses). A fixture that omits a real stage would spell
// that stage's exit as 1 (missing ⇒ red) and no longer describe an all-green run.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE_SH = path.join(HERE, "gate.sh");

const GATE_IDS = ["typecheck", "lint", "assertionGaps", "prevention", "moduleCoverage", "testsScripts", "testsLib", "build", "ratchet"];

// The W356 lane `ratchet` stage's shape, exactly as `quality-ratchet.mjs` prints
// it (one JSON object on the last stdout line; gate.sh folds `ratchet.exit` into
// `gates.ratchet.ok` and parses the named causes). A fixture that omits the
// stage spells its exit as 1 (missing ⇒ red, fail-closed) and stops describing a
// green run — the same rule the header states for every real stage.
const RATCHET_GREEN = JSON.stringify({
  ok: true,
  tool: "quality-ratchet",
  schema: 1,
  mode: "gate",
  regressions: [],
  canaryFailures: [],
  unavailableEnforced: [],
  pendingFirstGreen: [],
  uncovered: [],
  estimatedCostUsd: null,
});

// The PR-26 prevention stage's two shapes, exactly as `verify-prevention.mjs`
// prints them (one JSON object on the last stdout line).
const PREVENTION_GREEN = JSON.stringify({ ok: true, guards: 15, count: 15, countFloor: 15, missed: [], pending: [], skipped: [] });
const PREVENTION_RED = JSON.stringify({ ok: false, guards: 15, count: 15, countFloor: 15, missed: [], pending: ["C-04"], skipped: [] });

// The module-coverage stage's shape, exactly as `check-module-coverage.mjs
// --json` prints it (one pretty-printed JSON object, the whole log).
const MODULE_COVERAGE_GREEN = JSON.stringify({ total: 120, covered: 108, gaps: [], allowlisted: [], unallowlisted: [], stale: [] }, null, 2);
const MODULE_COVERAGE_RED = JSON.stringify(
  { total: 120, covered: 107, gaps: ["src/lib/orphan.ts"], allowlisted: [], unallowlisted: ["src/lib/orphan.ts"], stale: [] },
  null,
  2,
);

// The reviewed skip registry the verdict program reads. The fixture writes a
// small one so a case can exercise both a registered and an unregistered skip.
const SKIP_REGISTRY_FIXTURE = JSON.stringify({
  schema_version: 1,
  skips: [{ name: "216z opt-in: the REAL npm install leg runs (RT_VERIFYKIND_INSTALL=1)", file: "src/lib/compile-check.server.test.ts", reason: "opt-in real-npm leg" }],
});
const REAL_SKIP_REGISTRY = path.join(HERE, "skip-registry.json");

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
/**
 * Run the extracted verdict program against one fixture.
 * @param {{ exits?: Record<string, number>, exits2?: Record<string, number>, double?: boolean, logs?: Record<string, string>, quarantine?: boolean, env?: Record<string, string>, skipRegistry?: string }} [opts]
 */
function runVerdict(opts = {}) {
  const {
    exits = {},
    exits2 = {},
    double = false,
    logs = {},
    quarantine = false,
    env = {},
    skipRegistry,
  } = opts;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-verdict-"));
  const row = (id, code) => `${id}.exit\t${code}\n${id}.ms\t1`;
  const resultsPath = path.join(dir, "results");
  const rows = GATE_IDS.map((id) => row(id, exits[id] ?? 0));
  // --double writes the run-2 exit keys too (the program folds them). When a
  // case does not name a run-2 exit, it defaults to run 1's — the "same leg,
  // same exit" fallback that keeps the pre-existing cases' intent.
  if (double) {
    for (const id of ["testsScripts", "testsLib"]) rows.push(row(`${id}2`, exits2[id] ?? exits[id] ?? 0));
  }
  fs.writeFileSync(resultsPath, `${rows.join("\n")}\n`);
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
  // Run-2 legs default GREEN for the same reason run 1 does: a case only speaks
  // about the legs it names, and an empty run-2 log would (correctly) trip the
  // run-2 zero-`# pass` guard now that run 2's exit is folded.
  const s2 = double ? logPath("testsScripts2.log", TAP_GREEN) : "";
  const l2 = double ? logPath("testsLib2.log", TAP_GREEN) : "";
  const buildLog = logPath("build.log", "");
  // PR-26: the prevention stage runs for real in gate.sh; a case that does not
  // name it defaults to the legitimately-green 15/15 JSON, so an "all green"
  // simulation is genuinely all-green.
  const preventionLog = logPath("prevention.log", PREVENTION_GREEN);
  // Module coverage: a case that does not name it is genuinely covered.
  const moduleCoverageLog = logPath("moduleCoverage.log", MODULE_COVERAGE_GREEN);
  // The ADDITIVE `ratchet` stage (W356) belongs to the real stage set too: a
  // case that does not name it defaults to a green ratchet verdict.
  const ratchetLog = logPath("ratchet.log", RATCHET_GREEN);
  // The skip registry: a small fixture in the temp dir (so a case can exercise
  // an unregistered skip) unless the case points at the real reviewed one.
  let skipRegistryPath = skipRegistry || path.join(dir, "skip-registry.json");
  if (!skipRegistry) fs.writeFileSync(skipRegistryPath, SKIP_REGISTRY_FIXTURE);
  else if (skipRegistry === "__real__") skipRegistryPath = REAL_SKIP_REGISTRY;

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
      preventionLog,
      moduleCoverageLog,
      skipRegistryPath,
      quarantine ? "1" : "0",
      ratchetLog,
    ],
    { input: program, encoding: "utf8", env: { ...process.env, ...env } },
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
  // PR-26: the prevention stage is part of the all-green simulation and its
  // parsed two-signal fields are green.
  assert.equal(verdict.gates.prevention.ok, true, "the prevention stage is green");
  assert.deepEqual(verdict.gates.prevention.missed, []);
  assert.deepEqual(verdict.gates.prevention.pending, []);
  assert.deepEqual(verdict.gates.prevention.skipped, []);
  assert.equal(verdict.gates.prevention.count, 15);
  assert.equal(verdict.gates.prevention.countFloor, 15);
  // The ADDITIVE module-coverage stage is part of the all-green simulation.
  assert.equal(verdict.gates.moduleCoverage.ok, true, "the module-coverage stage is green");
  assert.deepEqual(verdict.gates.moduleCoverage.unallowlisted, []);
  assert.deepEqual(verdict.gates.moduleCoverage.stale, []);
  // W356's ADDITIVE `ratchet` stage is part of the all-green simulation: its
  // exit folds into `nonTestGatesOk`, so a fixture that omits it reads red.
  assert.equal(verdict.gates.ratchet.ok, true, "the ratchet stage is green");
  assert.deepEqual(verdict.gates.ratchet.regressions, []);
  assert.deepEqual(verdict.gates.ratchet.canaryFailures, []);
  assert.deepEqual(verdict.gates.ratchet.unavailableEnforced, []);
});

// ---------------------------------------------------------------------------
// D · --double disagreement is a flake (exit 3), never a hard fail.
// ---------------------------------------------------------------------------
test("D: --double run-1/run-2 disagreement → exit 3 with both names as flakes", () => {
  const { status, verdict } = runVerdict({
    exits: { testsScripts: 1 },
    exits2: { testsScripts: 1 },
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
// J · a red NON-TEST gate outranks a --double flake: exit 1, never 3.
// Pre-fix the flake branch returned 3 and masked a permanently-red typecheck/
// build behind a "retry" verdict — the documented taxonomy puts a hard-failed
// gate at 1, which must dominate a flake.
// ---------------------------------------------------------------------------
test("J: --double flake + red typecheck → exit 1 (hard gate dominates the flake, never 3)", () => {
  const { status, verdict } = runVerdict({
    exits: { typecheck: 1, testsScripts: 1 },
    exits2: { testsScripts: 0 },
    double: true,
    logs: {
      "testsScripts.log": "TAP version 13\nnot ok 1 - flakey X\n# fail 1\n",
      "testsScripts2.log": "TAP version 13\n# pass 5\n# fail 0\n",
    },
  });
  assert.equal(status, 1, "a red typecheck outranks a flake — exit 1, never 3");
  assert.equal(verdict.ok, false);
  assert.equal(verdict.gates.typecheck.ok, false, "the red gate is recorded");
  assert.deepEqual(verdict.flakes, ["flakey X"], "the flake is still named");
});

test("J2: --double flake + red build → exit 1 (a red gate cannot be masked by a flake)", () => {
  const { status, verdict } = runVerdict({
    exits: { build: 1, testsScripts: 1 },
    exits2: { testsScripts: 0 },
    double: true,
    logs: {
      "testsScripts.log": "TAP version 13\nnot ok 1 - flakey X\n# fail 1\n",
      "testsScripts2.log": "TAP version 13\n# pass 5\n# fail 0\n",
    },
  });
  assert.equal(status, 1, "a red build outranks a flake — exit 1, never 3");
  assert.equal(verdict.gates.build.ok, false, "the red gate is recorded");
  assert.deepEqual(verdict.flakes, ["flakey X"]);
});

// ---------------------------------------------------------------------------
// E · --double, run-1 crash without TAP lines / run-2 produced none either:
// still exit 1 (fixes/173 §F-H11 — a runner-level red is never a flake).
// ---------------------------------------------------------------------------
test("E: --double, leg crashed in run 1 with no TAP names → exit 1 (never 3)", () => {
  const { status, verdict } = runVerdict({
    exits: { testsScripts: 1 },
    exits2: { testsScripts: 1 },
    double: true,
    logs: { "testsScripts.log": CRASH_NO_TAP, "testsScripts2.log": CRASH_NO_TAP },
  });
  assert.equal(status, 1, "a crash with no test names must read as a hard fail, never a flake");
  assert.equal(verdict.ok, false);
  assert.equal(verdict.flakes.length, 0);
  assert.ok(
    verdict.hardFails.some((n) => n.startsWith("testsScripts run 2 (exit 1")),
    "the run-2 crash is named too; got " + JSON.stringify(verdict.hardFails),
  );
});

// ---------------------------------------------------------------------------
// F · W42 L4-G1: a leg that EXITS 0 while reporting ZERO `# pass` lines ran
// nothing (empty glob, early bail) — the verdict must not read green off an
// empty leg. Named `F` because the letter `E` above already owns the
// --double crash case (F-H11); the two guards are independent.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// G/H/I · fixes/344 F-20 — the bounded, honest load-flake quarantine.
//
// The known child-spawn class is allowlisted by EXACT test name. An isolated
// re-run is injected here via GATE_QUARANTINE_RUNNER (a tiny node script) so the
// classification is deterministic across hosts; the production default spawns
// the real test file. The contract: quarantine ONLY an isolated-GREEN candidate,
// ONLY with --quarantine, and always LOUDLY (verdict.quarantined + candidates).
// ---------------------------------------------------------------------------
const FLAKE = "settles when a pipe-holding grandchild outlives the child (no 'close' hang)";
const FLAKE_TAP = `TAP version 13\nnot ok 1 - ${FLAKE}\n# fail 1\n`;

function quarantineEnv(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-quar-"));
  const runner = path.join(dir, "fake-runner.mjs");
  fs.writeFileSync(
    runner,
    [
      "const name = process.argv[3];",
      'if ((process.env.FAKE_QUARANTINE_MODE ?? "green") === "green") {',
      "  process.stdout.write(`TAP version 13\\nok 1 - ${name}\\n# pass 1\\n# fail 0\\n`);",
      "} else {",
      "  process.stdout.write(`TAP version 13\\nnot ok 1 - ${name}\\n# pass 0\\n# fail 1\\n`);",
      "  process.exitCode = 1;",
      "}",
    ].join("\n"),
    "utf8",
  );
  return { GATE_QUARANTINE_RUNNER: runner, FAKE_QUARANTINE_MODE: mode };
}

test("G: an allowlisted load-flake GREEN in isolation is quarantined (loud) — exit 0 with --quarantine", () => {
  const { status, verdict } = runVerdict({
    exits: { testsLib: 1 },
    logs: { "testsLib.log": FLAKE_TAP },
    quarantine: true,
    env: quarantineEnv("green"),
  });
  assert.equal(status, 0, "an isolated-green known flake is relieved only under --quarantine");
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.hardFails, [], "the quarantined name leaves hardFails");
  assert.equal(verdict.quarantined.length, 1, "the quarantine is LOUD in the verdict");
  assert.equal(verdict.quarantined[0].name, FLAKE);
  assert.equal(verdict.quarantined[0].isolated, true);
  assert.match(String(verdict.quarantined[0].reason), /spawn starvation/);
});

test("G2: without --quarantine the same isolated-green candidate stays a hard fail (default unchanged)", () => {
  const { status, verdict } = runVerdict({
    exits: { testsLib: 1 },
    logs: { "testsLib.log": FLAKE_TAP },
    env: quarantineEnv("green"),
  });
  assert.equal(status, 1, "the default gate is byte-for-byte unchanged");
  assert.ok(verdict.hardFails.includes(FLAKE));
  assert.deepEqual(verdict.quarantined, []);
  assert.equal(verdict.quarantineCandidates[0].isolated, true, "the diagnosis is still reported");
});

test("H: an allowlisted flake RED in isolation is never quarantined (no laundering)", () => {
  const { status, verdict } = runVerdict({
    exits: { testsLib: 1 },
    logs: { "testsLib.log": FLAKE_TAP },
    quarantine: true,
    env: quarantineEnv("red"),
  });
  assert.equal(status, 1, "a test that fails in isolation is a real red");
  assert.ok(verdict.hardFails.includes(FLAKE));
  assert.deepEqual(verdict.quarantined, []);
});

test("I: a test NOT on the allowlist is never quarantined", () => {
  const { status, verdict } = runVerdict({
    exits: { testsLib: 1 },
    logs: { "testsLib.log": TAP_RED },
    quarantine: true,
    env: quarantineEnv("green"),
  });
  assert.equal(status, 1);
  assert.ok(verdict.hardFails.includes("some failing test"));
  assert.deepEqual(verdict.quarantineCandidates, [], "only allowlisted names are ever candidates");
});

// ---------------------------------------------------------------------------
// K · --double --quarantine: an allowlisted test that fails BOTH runs (a hard
// fail, not a flake) but is isolated-GREEN is relieved in double mode too.
// Pre-fix `relieved` was computed only in single mode, so the quarantined test
// left hardFails empty yet the gate still exited 1 with no named cause.
// ---------------------------------------------------------------------------
test("K: --double --quarantine relieves an isolated-green allowlisted hard fail (exit 0, not a nameless red)", () => {
  const { status, verdict } = runVerdict({
    exits: { testsLib: 1 },
    double: true,
    logs: { "testsLib.log": FLAKE_TAP, "testsLib2.log": FLAKE_TAP },
    quarantine: true,
    env: quarantineEnv("green"),
  });
  assert.equal(status, 0, "a quarantined isolated-green test must relieve the gate in --double mode too");
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.hardFails, []);
  assert.equal(verdict.quarantined.length, 1, "the quarantine is LOUD in the verdict");
  assert.equal(verdict.quarantined[0].name, FLAKE);
});

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

// ---------------------------------------------------------------------------
// L · PR-26 — the prevention stage's failure semantics. A non-green prevention
// stage (missed/pending/skipped/count-below-floor) is a red NON-TEST gate: the
// whole verdict is ok:false + exit 1 and the parsed two-signal fields name the
// outstanding guards. Missing/unparseable likewise never reads green.
// ---------------------------------------------------------------------------
test("L: a non-green prevention stage (pending guard) → ok:false, exit 1, reason named", () => {
  const { status, verdict } = runVerdict({
    exits: { prevention: 1 },
    logs: { "prevention.log": PREVENTION_RED },
  });
  assert.equal(status, 1, "a red prevention stage fails the whole gate");
  assert.equal(verdict.ok, false, "the verdict is red");
  assert.equal(verdict.gates.prevention.ok, false, "the red stage is recorded");
  assert.deepEqual(verdict.gates.prevention.pending, ["C-04"], "the outstanding guard is named");
  assert.deepEqual(verdict.gates.prevention.missed, []);
  assert.deepEqual(verdict.gates.prevention.skipped, []);
  assert.equal(verdict.gates.prevention.count, 15);
  assert.equal(verdict.gates.prevention.countFloor, 15);
});

test("L2: a prevention stage with no parseable verdict line is still red (never silently green)", () => {
  const { status, verdict } = runVerdict({
    exits: { prevention: 1 },
    logs: { "prevention.log": "harness crashed before printing a verdict\n" },
  });
  assert.equal(status, 1, "an unparseable prevention log cannot read green");
  assert.equal(verdict.ok, false);
  assert.equal(verdict.gates.prevention.ok, false);
});

// ---------------------------------------------------------------------------
// M · the module-coverage stage is wired in (ADDITIVE gate). A gap is red and
// the unallowlisted module is named; the gate can no longer pass while a
// src/lib module is reached by no test.
// ---------------------------------------------------------------------------
test("M: a red module-coverage stage → ok:false, exit 1, the unallowlisted module named", () => {
  const { status, verdict } = runVerdict({
    exits: { moduleCoverage: 1 },
    logs: { "moduleCoverage.log": MODULE_COVERAGE_RED },
  });
  assert.equal(status, 1, "a red module-coverage stage fails the whole gate");
  assert.equal(verdict.ok, false, "the verdict is red");
  assert.equal(verdict.gates.moduleCoverage.ok, false, "the red stage is recorded");
  assert.deepEqual(verdict.gates.moduleCoverage.unallowlisted, ["src/lib/orphan.ts"], "the orphan is named");
});

// ---------------------------------------------------------------------------
// N/O · the skipped-test registry (ADDITIVE). A skipped test must be an
// explicitly registered, justified skip; an unregistered one is a hard failure,
// and a registered one passes.
// ---------------------------------------------------------------------------
const SKIP_TAP = (name) => `TAP version 13\nok 1 - ${name} # SKIP because reasons\n# pass 0\n# fail 0\n# skipped 1\n`;

test("N: an unregistered skipped test → ok:false, exit 1, the skip named", () => {
  const { status, verdict } = runVerdict({
    exits: {},
    logs: { "testsLib.log": SKIP_TAP("a brand new skip nobody justified") },
  });
  assert.equal(status, 1, "an unregistered skip must fail the gate");
  assert.equal(verdict.ok, false, "the verdict is red");
  assert.deepEqual(verdict.unregisteredSkips, [{ leg: "testsLib", name: "a brand new skip nobody justified" }]);
  assert.ok(
    verdict.hardFails.some((n) => n.startsWith("a brand new skip nobody justified (unregistered skip")),
    `hardFails must name the unregistered skip; got ${JSON.stringify(verdict.hardFails)}`,
  );
});

test("O: a registered, justified skipped test passes (registry keyed on the exact leaf name)", () => {
  const registered = "216z opt-in: the REAL npm install leg runs (RT_VERIFYKIND_INSTALL=1)";
  const { status, verdict } = runVerdict({
    exits: {},
    logs: { "testsLib.log": SKIP_TAP(registered) },
  });
  assert.equal(status, 0, "a registered skip is allowed");
  assert.equal(verdict.ok, true, "the gate stays green");
  assert.deepEqual(verdict.registeredSkips, [registered]);
  assert.deepEqual(verdict.unregisteredSkips, []);
});

// ---------------------------------------------------------------------------
// P · --double run-2 exit folding (the defect this lane fixes). Run 1 green,
// run 2 runner-level crash (non-zero exit, no TAP failure lines) must read red
// — NOT ok:true/exit 0 as it did before the fix.
// ---------------------------------------------------------------------------
test("P: --double run-1-green / run-2 runner-crash → ok:false, exit 1 (run 2's exit is folded)", () => {
  const { status, verdict } = runVerdict({
    exits: { testsScripts: 0 },
    exits2: { testsScripts: 1 },
    double: true,
    logs: {
      "testsScripts.log": TAP_GREEN,
      "testsScripts2.log": CRASH_NO_TAP,
    },
  });
  assert.equal(status, 1, "a run-2 runner crash must not read green behind a green run 1");
  assert.equal(verdict.ok, false, "verdict.ok must be false");
  assert.equal(verdict.gates.testsScripts.exit2, 1, "run 2's exit is recorded");
  assert.equal(verdict.gates.testsScripts.ok, false, "the leg is red once run 2 is folded");
  assert.ok(
    verdict.hardFails.some((n) => n.startsWith("testsScripts run 2 (exit 1")),
    `hardFails must name the run-2 crash; got ${JSON.stringify(verdict.hardFails)}`,
  );
});
