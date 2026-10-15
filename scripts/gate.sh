#!/usr/bin/env bash
# =============================================================================
# scripts/gate.sh — RapidTool stability gate.
#
# Gates, in order (each gate's exit code is recorded; every gate runs even if
# an earlier one fails, so one invocation reports the whole picture):
#   1. typecheck   npm run typecheck                        (tsc --noEmit)
#   2. lint        npm run lint                             (eslint .)
#   3. gaps        node scripts/check-assertion-gaps.mjs    (T-17 assertion-gap
#                  lint — tautological assertions + zero-assertion tests; exits
#                  1 on findings, and its exit is folded into the verdict)
#   3b. prevention node scripts/prevention/verify-prevention.mjs --all --selftest
#                  (PR-26, ADDITIVE): the keyless two-signal proof layer. Fails on
#                  fixture-integrity missed, fix-presence pending, any skip, or a
#                  guard count below the pinned floor.
#   3c. moduleCov  node scripts/check-module-coverage.mjs --json
#                  (ADDITIVE): every src/lib module must be reached by a test (or
#                  named on the reviewed allowlist); an unallowlisted gap or a
#                  stale allowlist entry fails the gate. Exists precisely to catch
#                  untested modules, so it is wired in rather than left dormant.
#   3d. skipReg    scripts/skip-registry.json — every skipped test must be an
#                  explicitly registered, justified skip. A skipped test whose
#                  exact leaf name is not in the registry is a hard failure and a
#                  runner that reports `# skipped` with no parsed `# SKIP` line
#                  fails closed. Sits inside the verdict program (see legStats).
#   3e. ratchet    node scripts/quality-ratchet.mjs --all --gate <this run's own
#                  stage readings> (W356, ADDITIVE): the pinned-floor quality
#                  ratchet. It re-reads each metric from THIS run's own results +
#                  logs (never a re-run) and hard-fails on a beaten pinned floor, a
#                  reader-canary failure (a reader whose shape changed), or an
#                  ENFORCED metric that cannot be produced. Additive only: it can
#                  make the verdict stricter, never looser, and it masks no other
#                  stage's exit.
#   4. tests       scripts leg, then the src suite leg (`src/lib/**/*.test.ts`
#                  AND `src/components/**/*.test.ts` — the components UI-shape
#                  pins ran in NO leg and rotted silently before B1-COORD) —
#                  same globs, order and commands as `npm test`, so gate.sh
#                  stays honest about the chain npm test `&&`-s together
#   5. build       npm run build                            (vite build +
#                  db:migrate; slowest and least diagnostic, so it runs last)
#
# --double  Re-run both test legs a second time in the same invocation.
#           Any test that flips between run 1 and run 2 (pass->fail or
#           fail->pass) is a flake: exit 3. Targeted at the flaky-sensitive
#           suites (watcher/exec/real-timer tests) but applied to the whole
#           legs so a flake anywhere is caught. A test that fails BOTH runs
#           is a hard failure (exit 1), not a flake.
#           BOTH runs' exit codes are folded: a run-2 runner-level red (non-zero
#           exit with no TAP failure lines — a crash, unresolvable glob, OOM) is
#           a hard failure even when run 1 was green. Run-1-green/run-2-crash can
#           no longer read as `ok:true`, exit 0 (fixes/173 §F-H11: a runner-level
#           red is never a flake, in either run).
#
# --quarantine  BOUNDED, HONEST quarantine for the known load-sensitive
#           child-spawn class (fixes/344 F-20). When a test whose EXACT name is
#           in KNOWN_LOAD_FLAKES fails, it is re-run ALONE (its own file, a
#           --test-name-pattern for that one name) and, only if the isolated run
#           shows that test's own `ok N - <name>` line with `# fail 0`, it is
#           reported under `quarantined` (with the reason) instead of forcing a
#           red gate. This is NOT flake laundering: it is bounded (one isolated
#           re-run), the failure must reproduce as green in isolation, the
#           allowlist is explicit and named, and it is LOUD (verdict
#           `quarantined[]` + stderr). A second failure, or any test NOT on the
#           allowlist, stays a hard red. Default OFF — without the flag the
#           candidates are still diagnosed and reported, but the exit code is
#           unchanged. Follow-up: root-cause the spawn-starvation race (see
#           fixes/346_e3_orchestrator.md §F-20) and delete the allowlist.
#
# Format gate (fixes/344 F-16): `prettier --check src scripts` is NOT a gate
#           here — measured 2026-10-03: 244 files drift, and scripts/gate.sh
#           itself has no inferable parser. A red formatter gate would be a
#           permanent red. `npm run format:check` is the scoped, honest check.
#
# Exit codes:
#   0  every gate green (skips are allowed and reported, never silently)
#   1  a gate hard-failed (a test failed both runs, or typecheck/lint/gaps/build red)
#   2  usage error
#   3  flake detected under --double (run-1/run-2 disagreement)
#
# Stdout: exactly one JSON verdict object, always:
#   {"ok":bool,"double":bool,"flakes":[names],"hardFails":[names],"skips":N,
#    "wallMs":N,"gates":{"typecheck":{"ok":bool,"exit":N,"ms":N}, ...}}
# Diagnostics go to stderr only, so the JSON can be piped/parsed directly.
# =============================================================================
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)" || exit 2
cd "$ROOT" || exit 2

DOUBLE=0
QUARANTINE=0
for arg in "$@"; do
  case "$arg" in
    --double) DOUBLE=1 ;;
    --quarantine) QUARANTINE=1 ;;
    *) printf 'usage: scripts/gate.sh [--double] [--quarantine]\n' >&2; exit 2 ;;
  esac
done

TMP="$(mktemp -d "${TMPDIR:-/tmp}/rapidtool-gate-XXXXXX")" || exit 2
trap 'rm -rf "$TMP"' EXIT
# node.exe is a native Windows binary: it does not see MSYS's /tmp mapping.
# Convert the workspace path once and hand node the Windows form.
WINTMP="$(cygpath -m "$TMP" 2>/dev/null || printf '%s' "$TMP")"
# The skip registry is a workspace file (not a temp file); convert it too so the
# native node.exe in the verdict program can read it.
SKIPREG="$(cygpath -m "$ROOT/scripts/skip-registry.json" 2>/dev/null || printf '%s' "$ROOT/scripts/skip-registry.json")"
RESULTS="$TMP/results"
: > "$RESULTS"

now_ms() { node -e "process.stdout.write(String(Date.now()))"; }

# add <key> <value> — record a scalar for the verdict builder.
add() { printf '%s\t%s\n' "$1" "$2" >> "$RESULTS"; }

# run <gate-id> <log-file> <command...> — run the command, record exit + ms.
run() {
  local id="$1" log="$2" t0 t1 code
  shift 2
  printf '[gate] %-14s running...\n' "$id" >&2
  t0="$(now_ms)"
  "$@" > "$log" 2>&1
  code=$?
  t1="$(now_ms)"
  add "$id.exit" "$code"
  add "$id.ms" "$((t1 - t0))"
  printf '[gate] %-14s exit %s (%sms)\n' "$id" "$code" "$((t1 - t0))" >&2
  echo "$code"
}

# tail_log <gate-id> <log-file> — print the tail of a failed gate's log.
tail_log() {
  printf '\n--- %s log tail (last 30 lines) ---\n' "$1" >&2
  tail -n 30 "$2" >&2
}

START="$(now_ms)"

run typecheck "$TMP/typecheck.log" npm run typecheck > /dev/null
run lint "$TMP/lint.log" npm run lint > /dev/null
run assertionGaps "$TMP/assertionGaps.log" node scripts/check-assertion-gaps.mjs > /dev/null
run prevention "$TMP/prevention.log" node scripts/prevention/verify-prevention.mjs --all --selftest > /dev/null
run moduleCoverage "$TMP/moduleCoverage.log" node scripts/check-module-coverage.mjs --json > /dev/null
run testsScripts "$TMP/testsScripts.log" node --test --test-reporter=tap "scripts/**/*.test.mjs" > /dev/null
run testsLib "$TMP/testsLib.log" node --experimental-strip-types --test --test-reporter=tap \
  "src/lib/**/*.test.ts" "src/components/**/*.test.ts" > /dev/null
run build "$TMP/build.log" npm run build > /dev/null
# W356 lane `ratchet` (ADDITIVE stage; `--gate "$WINTMP"` points at THIS run's own
# results file + stage logs, so the ratchet reads the real producers and re-runs
# nothing). Its exit is folded into the verdict as `gates.ratchet.ok`.
run ratchet "$TMP/ratchet.log" node scripts/quality-ratchet.mjs --all --gate "$WINTMP" --quiet > /dev/null

# --double: second pass over both test legs for the flake detector.
LOGS2_SCRIPTS=""
LOGS2_LIB=""
if [ "$DOUBLE" = 1 ]; then
  run testsScripts2 "$TMP/testsScripts2.log" node --test --test-reporter=tap "scripts/**/*.test.mjs" > /dev/null
  run testsLib2 "$TMP/testsLib2.log" node --experimental-strip-types --test --test-reporter=tap \
    "src/lib/**/*.test.ts" "src/components/**/*.test.ts" > /dev/null
  LOGS2_SCRIPTS="$WINTMP/testsScripts2.log"
  LOGS2_LIB="$WINTMP/testsLib2.log"
fi

node - \
  "$WINTMP/results" "$START" "$DOUBLE" \
  "$WINTMP/typecheck.log" "$WINTMP/lint.log" \
  "$WINTMP/testsScripts.log" "$WINTMP/testsLib.log" \
  "$LOGS2_SCRIPTS" "$LOGS2_LIB" \
  "$WINTMP/build.log" "$WINTMP/prevention.log" "$WINTMP/moduleCoverage.log" "$SKIPREG" "$QUARANTINE" \
  "$WINTMP/ratchet.log" <<'NODE'
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
// Script comes from stdin (`node -`), so argv = [node, "-", ...args].
const [resultsPath, startMs, doubleStr, tclog, lintlog, s1, l1, s2, l2, bldlog, prevlog, mcovlog, skipreg, quarantineStr, ratchetlog] =
  process.argv.slice(2);
const double = doubleStr === "1";
const quarantine = quarantineStr === "1";

const map = new Map();
for (const line of fs.readFileSync(resultsPath, "utf8").trim().split("\n")) {
  if (!line) continue;
  const i = line.indexOf("\t");
  map.set(line.slice(0, i), line.slice(i + 1));
}
const get = (k) => (map.has(k) ? map.get(k) : "");
const exitOf = (id) => Number(get(id + ".exit") || 1);
const msOf = (id) => Number(get(id + ".ms") || 0);

function readLog(p) {
  if (!p) return "";
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

// Parse node --test's TAP-ish output for one leg: summary counts + names of
// failing tests (names key the flake detector across the two runs).
function legStats(log) {
  const text = readLog(log);
  const grab = (tok) => {
    const m = text.match(new RegExp("^# " + tok + " ([0-9]+)$", "m"));
    return m ? Number(m[1]) : 0;
  };
  const failNames = [
    ...text.matchAll(/^[ \t]*not ok [0-9]+ - (.*)$/gm),
  ].map((m) => m[1]);
  // A skipped test carries its own `ok N - <name> # SKIP [reason]` line. The
  // leaf name is what the registry keys on (node --test reports the leaf).
  const skipNames = [
    ...text.matchAll(/^[ \t]*ok [0-9]+ - (.*?)[ \t]*# SKIP\b/gm),
  ].map((m) => m[1].trim()).filter(Boolean);
  return { pass: grab("pass"), fail: grab("fail"), skipped: grab("skipped"), failNames, skipNames };
}

const gates = {};
for (const id of ["typecheck", "lint", "assertionGaps", "build"]) {
  gates[id] = { ok: exitOf(id) === 0, exit: exitOf(id), ms: msOf(id) };
}
gates.lint.problems =
  Number((readLog(lintlog).match(/([0-9]+) problems/) || [])[1] || 0) || null;
// PR-26: the keyless prevention harness is an ADDITIVE gate. It fails on
// fixture-integrity missed, fix-presence pending, any skip, or a guard count
// below the pinned floor; its JSON is parsed so the cause is named in the verdict.
gates.prevention = { ok: exitOf("prevention") === 0, exit: exitOf("prevention"), ms: msOf("prevention") };
{
  const lines = readLog(prevlog).trim().split("\n").filter(Boolean);
  try {
    const j = JSON.parse(lines[lines.length - 1] || "");
    gates.prevention.missed = j.missed ?? (j.fixtureIntegrity ? j.fixtureIntegrity.missed : []) ?? [];
    gates.prevention.pending = j.pending ?? (j.fixPresence ? j.fixPresence.pending : []) ?? [];
    gates.prevention.skipped = j.skipped ?? [];
    gates.prevention.count = j.count ?? null;
    gates.prevention.countFloor = j.countFloor ?? null;
  } catch {
    // No parseable verdict line: the exit code alone fails the gate (fail closed).
  }
}

// W356 lane `ratchet` (ADDITIVE gate): the pinned-floor quality ratchet. It
// re-reads each metric from this run's own stage readings and fails on a beaten
// floor, a reader-canary failure, or an ENFORCED metric it could not produce. Its
// JSON is parsed so the cause is NAMED in the verdict; no parseable verdict line
// leaves the exit code alone to fail the gate (fail closed). It is ADDITIVE: no
// existing stage's exit, order or threshold is touched, and folding it in can
// only make `ok` stricter.
gates.ratchet = { ok: exitOf("ratchet") === 0, exit: exitOf("ratchet"), ms: msOf("ratchet") };
{
  let parsed = null;
  const lines = readLog(ratchetlog).split("\n");
  for (let i = lines.length - 1; i >= 0 && parsed === null; i--) {
    try {
      const j = JSON.parse(lines[i]);
      if (j && j.tool === "quality-ratchet") parsed = j;
    } catch {
      /* keep walking back */
    }
  }
  if (parsed) {
    gates.ratchet.regressions = Array.isArray(parsed.regressions) ? parsed.regressions : [];
    gates.ratchet.canaryFailures = Array.isArray(parsed.canaryFailures) ? parsed.canaryFailures : [];
    gates.ratchet.unavailableEnforced = Array.isArray(parsed.unavailableEnforced) ? parsed.unavailableEnforced : [];
    gates.ratchet.pendingFirstGreen = Array.isArray(parsed.pendingFirstGreen) ? parsed.pendingFirstGreen : [];
    gates.ratchet.uncovered = Array.isArray(parsed.uncovered) ? parsed.uncovered : [];
  }
}

// Module coverage (ADDITIVE gate): `check-module-coverage.mjs --json` prints one
// JSON object with the unallowlisted gaps and stale allowlist entries. Its exit
// code already fails on a gap; the fields are parsed so the verdict names WHY.
gates.moduleCoverage = { ok: exitOf("moduleCoverage") === 0, exit: exitOf("moduleCoverage"), ms: msOf("moduleCoverage") };
{
  try {
    const j = JSON.parse(readLog(mcovlog));
    gates.moduleCoverage.unallowlisted = Array.isArray(j.unallowlisted) ? j.unallowlisted : [];
    gates.moduleCoverage.stale = Array.isArray(j.stale) ? j.stale : [];
    gates.moduleCoverage.total = Number.isFinite(j.total) ? j.total : null;
    gates.moduleCoverage.covered = Number.isFinite(j.covered) ? j.covered : null;
  } catch {
    // No parseable JSON: the exit code alone fails the gate (fail closed).
  }
}

// The reviewed skip registry. Every skipped test must be registered here.
function loadSkipRegistry(p) {
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
    const list = Array.isArray(raw && raw.skips) ? raw.skips : [];
    const names = new Set(list.filter((s) => s && typeof s.name === "string" && s.name.trim()).map((s) => s.name.trim()));
    return { ok: true, names, count: list.length };
  } catch (e) {
    return { ok: false, names: new Set(), count: 0, error: String((e && e.message) || e) };
  }
}
// When a caller omits the path, resolve the workspace default (gate.sh always
// passes it; the fallback keeps the program usable in isolation). A missing
// registry is still a hard failure — fail closed, never "no registry, no skips".
const skipRegPath = skipreg || require("node:path").join(process.cwd(), "scripts", "skip-registry.json");
const skipRegistry = loadSkipRegistry(skipRegPath);

const flakes = [];
const hardFails = [];
// A run-2 results key is written only under --double; when it is absent (not a
// --double run, or a fixture that omits it) fall back to run 1's exit so the
// single-run semantics are unchanged.
const exit2Of = (id) => (get(id + "2.exit") === "" ? exitOf(id) : Number(get(id + "2.exit")));
for (const [id, log1, log2] of [["testsScripts", s1, s2], ["testsLib", l1, l2]]) {
  const run1 = legStats(log1);
  const exit1 = exitOf(id);
  const exit2 = double ? exit2Of(id) : exit1;
  gates[id] = {
    ok: exit1 === 0 && (!double || exit2 === 0),
    exit: exit1,
    ms: msOf(id),
    pass: run1.pass,
    fail: run1.fail,
    skipped: run1.skipped,
    ...(double ? { exit2 } : {}),
  };
  // W42 L4-G1 (A-89, q2 row 9): an exit-0 leg that reported ZERO `# pass`
  // lines ran no tests at all (empty glob, early bail, wrong reporter) — a
  // green verdict off a silent leg is a vacuous green. A skipped-only leg is
  // activity (skipped > 0), so only the fully silent clean-exit leg is lifted.
  // Deliberately a hardFail, not a flake: it is a runner-level fact about the
  // leg, present in run 1 itself (fixes/173 §F-H11's rule).
  if (exit1 === 0 && run1.pass === 0 && run1.skipped === 0) {
    hardFails.push(`${id} (exit 0 but zero '# pass' lines — no tests actually ran; read the gate log tail)`);
  }
  // R5-f01 (W29 · A2-f02 · W-09): a leg can exit non-zero WITHOUT a TAP
  // `not ok` line (runner crash, unresolvable glob, missing file, OOM) — the
  // flake detector has no test name to key on, but the red must still be loud
  // and NAMED. Record a synthetic hardFail for the leg. Deliberately NOT a
  // flake: fixes/173 §F-H11 forbids classifying a runner-level red as one
  // (--double run-1-crash/run-2-clean must read exit 1, never 3).
  const noTapNames = (run) => run.failNames.length === 0;
  if (!double) {
    hardFails.push(...run1.failNames);
    if (exit1 !== 0 && noTapNames(run1)) {
      hardFails.push(`${id} (exit ${exit1} — runner produced no TAP failure lines; read the gate log tail)`);
    }
    continue;
  }
  const run2 = legStats(log2);
  const f1 = new Set(run1.failNames);
  const f2 = new Set(run2.failNames);
  for (const n of f1) if (f2.has(n)) hardFails.push(n); else flakes.push(n);
  for (const n of f2) if (!f1.has(n)) flakes.push(n);
  if (exit1 !== 0 && noTapNames(run1) && noTapNames(run2)) {
    hardFails.push(`${id} (exit ${exit1} — runner produced no TAP failure lines; read the gate log tail)`);
  }
  // Run 2's exit is folded independently of run 1's. A run-2 runner-level red
  // (non-zero exit, no TAP failure lines) is ALWAYS a hard failure — even when
  // run 1 was green — so a flake-free crash in the second pass cannot hide
  // behind a green first pass (--double must catch a mid-run runner crash).
  if (exit2 !== 0 && noTapNames(run2)) {
    hardFails.push(`${id} run 2 (exit ${exit2} — runner produced no TAP failure lines; read the gate log tail)`);
  }
  if (exit2 === 0 && run2.pass === 0 && run2.skipped === 0) {
    hardFails.push(`${id} run 2 (exit 0 but zero '# pass' lines — no tests actually ran)`);
  }
}

// --- skipped-test registry (ADDITIVE): a skip must be explicitly justified. ---
// A `# skipped N` summary with no parseable `# SKIP` line is a reporter/leg
// mismatch — fail closed. Any skipped test whose exact leaf name is not on the
// reviewed registry is a hard failure, in BOTH --double runs.
const registeredSkips = [];
const unregisteredSkips = [];
{
  const legs = [["testsScripts", s1], ["testsLib", l1]];
  if (double) legs.push(["testsScripts2", s2], ["testsLib2", l2]);
  const seenRegistered = new Set();
  const seenUnregistered = new Set();
  for (const [id, log] of legs) {
    const run = legStats(log);
    if (run.skipped > 0 && run.skipNames.length === 0) {
      hardFails.push(`${id} (# skipped ${run.skipped} but no per-test '# SKIP' line parsed — reporter mismatch)`);
    }
    for (const name of run.skipNames) {
      if (skipRegistry.names.has(name)) {
        if (!seenRegistered.has(name)) { seenRegistered.add(name); registeredSkips.push(name); }
      } else if (!seenUnregistered.has(name)) {
        seenUnregistered.add(name);
        unregisteredSkips.push({ leg: id, name });
      }
    }
  }
  for (const u of unregisteredSkips) {
    hardFails.push(`${u.name} (unregistered skip in ${u.leg} — a skipped test must be an explicitly registered, justified skip in scripts/skip-registry.json)`);
  }
  if (!skipRegistry.ok) {
    hardFails.push(`skip-registry (${skipRegPath}) missing or unreadable — every skip must be registered (fail closed): ${skipRegistry.error || ""}`);
  }
}

// fixes/344 F-20 — the known load-sensitive child-spawn class. EXACT leaf test
// names (node --test reports the leaf name); each maps to its file + reason.
// The allowlist is deliberate and small; delete an entry once its race is fixed.
const KNOWN_LOAD_FLAKES = new Map([
  [
    "settles when a pipe-holding grandchild outlives the child (no 'close' hang)",
    {
      file: "src/lib/exec.test.ts",
      reason:
        "child-spawn starvation: under parallel suite load the grandchild's pipe release / kill-grace settlement can exceed the wall-clock assertion",
    },
  ],
  [
    "does not delay a normal run whose pipes close promptly",
    {
      file: "src/lib/exec.test.ts",
      reason:
        "child-spawn starvation: the prompt-close bound (CLOSE_GRACE_MS*4) can be crossed by spawn latency alone under load",
    },
  ],
  [
    "commits a fresh emitted tree with feat(<slug>): <brief>, then a second land is a clean no-op",
    {
      file: "src/lib/headless.test.ts",
      reason:
        "git-spawn starvation: spawnSync git can return null status under CPU contention, failing the commit-count assertions",
    },
  ],
  [
    "a foreign file added after emit is left untracked and reported (not silently committed)",
    {
      file: "src/lib/headless.test.ts",
      reason: "git-spawn starvation: spawnSync git can return null status under CPU contention",
    },
  ],
]);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ONE isolated re-run of a single named test. Green ONLY when that test's own
// `ok N - <name>` line appears AND the summary says `# fail 0` — a filtered run
// that matches nothing exits 0 (the no-op pattern trap), which is never green.
function isolatedRetryGreen(name, file) {
  // A spawn problem must NEVER break the verdict program: the conservative
  // answer is "not green" (the gate stays red), never a crash.
  try {
    const injected = process.env.GATE_QUARANTINE_RUNNER;
    const runner = process.execPath;
    const args = injected
      ? [injected, file, name]
      : [
          ...(file.endsWith(".ts") ? ["--experimental-strip-types"] : []),
          "--test",
          "--test-reporter=tap",
          file,
          "--test-name-pattern",
          escapeRegex(name),
        ];
    const r = spawnSync(runner, args, { encoding: "utf8", timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
    const out = `${r.stdout || ""}${r.stderr || ""}`;
    const okLine = new RegExp("^[ \\t]*ok [0-9]+ - " + escapeRegex(name) + "\\s*$", "m");
    return r.status === 0 && okLine.test(out) && /^# fail 0$/m.test(out);
  } catch {
    return false;
  }
}

const quarantineCandidates = hardFails
  .filter((n) => KNOWN_LOAD_FLAKES.has(n))
  .map((n) => {
    const info = KNOWN_LOAD_FLAKES.get(n);
    return { name: n, file: info.file, reason: info.reason, isolated: isolatedRetryGreen(n, info.file) };
  });
const quarantined = quarantine ? quarantineCandidates.filter((q) => q.isolated) : [];
const quarantinedNames = new Set(quarantined.map((q) => q.name));
const effectiveHardFails = hardFails.filter((n) => !quarantinedNames.has(n));
// A leg whose ONLY failures are quarantined counts as relieved. This applies in
// BOTH modes: the --double disagreement path only owns run-1/run-2 FLAKES, while
// a test that fails both runs is a hard fail — leaving it unnamed in hardFails
// yet still forcing exit 1 (the pre-fix --double --quarantine behavior) reported
// a quarantined test and a red gate with no cause.
const relieved = new Set();
for (const [id, log1] of [["testsScripts", s1], ["testsLib", l1]]) {
  const fails = legStats(log1).failNames;
  if (fails.length > 0 && fails.every((n) => quarantinedNames.has(n))) relieved.add(id);
}

// A red NON-TEST gate (typecheck/lint/gaps/build) is a hard failure that
// OUTRANKS a --double flake: the flake branch must never mask a permanently-red
// gate behind an exit-3 "retry" verdict (pre-fix, flake+red typecheck read 3).
const nonTestGatesOk =
  gates.typecheck.ok && gates.lint.ok && gates.assertionGaps.ok && gates.prevention.ok &&
  gates.moduleCoverage.ok && gates.build.ok && gates.ratchet.ok;
const testLegsOk =
  (gates.testsScripts.ok || relieved.has("testsScripts")) &&
  (gates.testsLib.ok || relieved.has("testsLib"));

let code = 0;
if (effectiveHardFails.length > 0) code = 1;
else if (!nonTestGatesOk) code = 1;
else if (flakes.length > 0) code = 3;
else if (!testLegsOk) code = 1;

const verdict = {
  ok: code === 0,
  double,
  flakes: [...new Set(flakes)],
  hardFails: [...new Set(effectiveHardFails)],
  quarantined,
  quarantineCandidates,
  skips: (gates.testsScripts ? gates.testsScripts.skipped : 0) +
         (gates.testsLib ? gates.testsLib.skipped : 0),
  registeredSkips,
  unregisteredSkips,
  wallMs: Date.now() - Number(startMs),
  gates,
};
// fixes/344 F-20: LOUD diagnosis on stderr (stdout stays JSON-only) — a known
// load-flake candidate is always named, with its isolated re-run verdict.
if (quarantineCandidates.length > 0) {
  const lines = quarantineCandidates.map(
    (q) => `  - ${q.name} (${q.file}) — isolated re-run ${q.isolated ? "GREEN" : "RED"}: ${q.reason}`,
  );
  fs.writeSync(
    2,
    `\n[gate] known load-flake candidate(s):\n${lines.join("\n")}\n` +
      (quarantine
        ? `[gate] quarantined ${quarantined.length} of ${quarantineCandidates.length} (--quarantine)\n`
        : "[gate] none quarantined — pass --quarantine to accept an isolated-GREEN candidate\n"),
  );
}
// fs.writeSync + exitCode (not process.exit): on Windows, process.exit can
// truncate a pending async stdout-pipe write, which would drop the verdict.
fs.writeSync(process.stdout.fd, JSON.stringify(verdict) + "\n");
process.exitCode = code;
NODE
code=$?

# Diagnosis on stderr for any red gate (stdout stays JSON-only).
# W42 L4-G1(b): the --double legs (testsScripts2/testsLib2) are tailed too, but
# ONLY when their .exit key exists — a missing key means the leg never ran
# (single mode), which has no log to read and is not a failure.
for id in typecheck lint assertionGaps prevention moduleCoverage testsScripts testsLib testsScripts2 testsLib2 build ratchet; do
  ext="$(awk -F'\t' -v k="$id.exit" '$1 == k { print $2 }' "$RESULTS")"
  if [ -n "$ext" ] && [ "$ext" != "0" ]; then tail_log "$id" "$TMP/$id.log"; fi
done
if [ "$code" = 3 ]; then
  printf '\nFLAKES (run-1/run-2 disagreement, see verdict JSON):\n' >&2
fi

exit "$code"
