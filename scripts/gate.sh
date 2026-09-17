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
for arg in "$@"; do
  case "$arg" in
    --double) DOUBLE=1 ;;
    *) printf 'usage: scripts/gate.sh [--double]\n' >&2; exit 2 ;;
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
run testsScripts "$TMP/testsScripts.log" node --test "scripts/**/*.test.mjs" > /dev/null
run testsLib "$TMP/testsLib.log" node --experimental-strip-types --test \
  "src/lib/*.test.ts" "src/lib/app-data/app-data.test.ts" "src/lib/auth/*.test.ts" > /dev/null
run build "$TMP/build.log" npm run build > /dev/null

# --double: second pass over both test legs for the flake detector.
LOGS2_SCRIPTS=""
LOGS2_LIB=""
if [ "$DOUBLE" = 1 ]; then
  run testsScripts2 "$TMP/testsScripts2.log" node --test "scripts/**/*.test.mjs" > /dev/null
  run testsLib2 "$TMP/testsLib2.log" node --experimental-strip-types --test \
    "src/lib/*.test.ts" "src/lib/app-data/app-data.test.ts" "src/lib/auth/*.test.ts" > /dev/null
  LOGS2_SCRIPTS="$WINTMP/testsScripts2.log"
  LOGS2_LIB="$WINTMP/testsLib2.log"
fi

node - \
  "$WINTMP/results" "$START" "$DOUBLE" \
  "$WINTMP/typecheck.log" "$WINTMP/lint.log" \
  "$WINTMP/testsScripts.log" "$WINTMP/testsLib.log" \
  "$LOGS2_SCRIPTS" "$LOGS2_LIB" \
  "$WINTMP/build.log" <<'NODE'
const fs = require("node:fs");
// Script comes from stdin (`node -`), so argv = [node, "-", ...args].
const [resultsPath, startMs, doubleStr, tclog, lintlog, s1, l1, s2, l2, bldlog] =
  process.argv.slice(2);
const double = doubleStr === "1";

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
  if (!double) {
    hardFails.push(...run1.failNames);
    continue;
  }
  const run2 = legStats(log2);
  const f1 = new Set(run1.failNames);
  const f2 = new Set(run2.failNames);
  for (const n of f1) if (f2.has(n)) hardFails.push(n); else flakes.push(n);
  for (const n of f2) if (!f1.has(n)) flakes.push(n);
}

let code = 0;
if (hardFails.length > 0) code = 1;
else if (flakes.length > 0) code = 3;
else if (!(gates.typecheck.ok && gates.lint.ok && gates.assertionGaps.ok && gates.build.ok)) code = 1;

const verdict = {
  ok: code === 0,
  double,
  flakes: [...new Set(flakes)],
  hardFails: [...new Set(hardFails)],
  skips: (gates.testsScripts ? gates.testsScripts.skipped : 0) +
         (gates.testsLib ? gates.testsLib.skipped : 0),
  wallMs: Date.now() - Number(startMs),
  gates,
};
// fs.writeSync + exitCode (not process.exit): on Windows, process.exit can
// truncate a pending async stdout-pipe write, which would drop the verdict.
fs.writeSync(process.stdout.fd, JSON.stringify(verdict) + "\n");
process.exitCode = code;
NODE
code=$?

# Diagnosis on stderr for any red gate (stdout stays JSON-only).
for id in typecheck lint assertionGaps testsScripts testsLib build; do
  ext="$(awk -F'\t' -v k="$id.exit" '$1 == k { print $2 }' "$RESULTS")"
  if [ "$ext" != "0" ]; then tail_log "$id" "$TMP/$id.log"; fi
done
if [ "$code" = 3 ]; then
  printf '\nFLAKES (run-1/run-2 disagreement, see verdict JSON):\n' >&2
fi

exit "$code"
