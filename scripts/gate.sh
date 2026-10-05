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
#   4. tests       scripts leg, then the src/lib suite ("lib suite") — same
#                  order and commands as `npm test`, so gate.sh stays honest
#                  about the chain npm test `&&`-s together
#   5. build       npm run build                            (vite build +
#                  db:migrate; slowest and least diagnostic, so it runs last)
#
# --double  Re-run both test legs a second time in the same invocation.
#           Any test that flips between run 1 and run 2 (pass->fail or
#           fail->pass) is a flake: exit 3. Targeted at the flaky-sensitive
#           suites (watcher/exec/real-timer tests) but applied to the whole
#           legs so a flake anywhere is caught. A test that fails BOTH runs
#           is a hard failure (exit 1), not a flake.
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
run testsScripts "$TMP/testsScripts.log" node --test --test-reporter=tap "scripts/**/*.test.mjs" > /dev/null
run testsLib "$TMP/testsLib.log" node --experimental-strip-types --test --test-reporter=tap \
  "src/lib/**/*.test.ts" > /dev/null
run build "$TMP/build.log" npm run build > /dev/null

# --double: second pass over both test legs for the flake detector.
LOGS2_SCRIPTS=""
LOGS2_LIB=""
if [ "$DOUBLE" = 1 ]; then
  run testsScripts2 "$TMP/testsScripts2.log" node --test --test-reporter=tap "scripts/**/*.test.mjs" > /dev/null
  run testsLib2 "$TMP/testsLib2.log" node --experimental-strip-types --test --test-reporter=tap \
    "src/lib/**/*.test.ts" > /dev/null
  LOGS2_SCRIPTS="$WINTMP/testsScripts2.log"
  LOGS2_LIB="$WINTMP/testsLib2.log"
fi

node - \
  "$WINTMP/results" "$START" "$DOUBLE" \
  "$WINTMP/typecheck.log" "$WINTMP/lint.log" \
  "$WINTMP/testsScripts.log" "$WINTMP/testsLib.log" \
  "$LOGS2_SCRIPTS" "$LOGS2_LIB" \
  "$WINTMP/build.log" "$QUARANTINE" <<'NODE'
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
// Script comes from stdin (`node -`), so argv = [node, "-", ...args].
const [resultsPath, startMs, doubleStr, tclog, lintlog, s1, l1, s2, l2, bldlog, quarantineStr] =
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
  return { pass: grab("pass"), fail: grab("fail"), skipped: grab("skipped"), failNames };
}

const gates = {};
for (const id of ["typecheck", "lint", "assertionGaps", "build"]) {
  gates[id] = { ok: exitOf(id) === 0, exit: exitOf(id), ms: msOf(id) };
}
gates.lint.problems =
  Number((readLog(lintlog).match(/([0-9]+) problems/) || [])[1] || 0) || null;

const flakes = [];
const hardFails = [];
for (const [id, log1, log2] of [["testsScripts", s1, s2], ["testsLib", l1, l2]]) {
  const run1 = legStats(log1);
  gates[id] = {
    ok: exitOf(id) === 0,
    exit: exitOf(id),
    ms: msOf(id),
    pass: run1.pass,
    fail: run1.fail,
    skipped: run1.skipped,
  };
  // W42 L4-G1 (A-89, q2 row 9): an exit-0 leg that reported ZERO `# pass`
  // lines ran no tests at all (empty glob, early bail, wrong reporter) — a
  // green verdict off a silent leg is a vacuous green. A skipped-only leg is
  // activity (skipped > 0), so only the fully silent clean-exit leg is lifted.
  // Deliberately a hardFail, not a flake: it is a runner-level fact about the
  // leg, present in run 1 itself (fixes/173 §F-H11's rule).
  if (exitOf(id) === 0 && run1.pass === 0 && run1.skipped === 0) {
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
    if (exitOf(id) !== 0 && noTapNames(run1)) {
      hardFails.push(`${id} (exit ${exitOf(id)} — runner produced no TAP failure lines; read the gate log tail)`);
    }
    continue;
  }
  const run2 = legStats(log2);
  const f1 = new Set(run1.failNames);
  const f2 = new Set(run2.failNames);
  for (const n of f1) if (f2.has(n)) hardFails.push(n); else flakes.push(n);
  for (const n of f2) if (!f1.has(n)) flakes.push(n);
  if (exitOf(id) !== 0 && noTapNames(run1) && noTapNames(run2)) {
    hardFails.push(`${id} (exit ${exitOf(id)} — runner produced no TAP failure lines; read the gate log tail)`);
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
  gates.typecheck.ok && gates.lint.ok && gates.assertionGaps.ok && gates.build.ok;
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
for id in typecheck lint assertionGaps testsScripts testsLib testsScripts2 testsLib2 build; do
  ext="$(awk -F'\t' -v k="$id.exit" '$1 == k { print $2 }' "$RESULTS")"
  if [ -n "$ext" ] && [ "$ext" != "0" ]; then tail_log "$id" "$TMP/$id.log"; fi
done
if [ "$code" = 3 ]; then
  printf '\nFLAKES (run-1/run-2 disagreement, see verdict JSON):\n' >&2
fi

exit "$code"
