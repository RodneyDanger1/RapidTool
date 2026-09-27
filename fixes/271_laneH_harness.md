# fixes/271_laneH_harness.md — W29 LANE H · THE HARNESS (scripts/**, package.json, migrations/**)

**Lane:** W29 · LANE H. **Scope:** `scripts/**`, `package.json`, `migrations/**` (+ the src/lib leaves my rows require: `policy.ts`, `scorecard.ts`, `brief-fixtures.ts` — no other lane owns them).
**HEAD at start:** `0f85c32`. **Rules followed:** targeted single-file/leg checks only; NO full-gate runs; NO keyed calls; log-and-continue (`[EXT-FAIL]` on blockers); RED-first where §R5 says so.

## Row checklist (from wave_plans/W29/coders.md LANE H)

| Row | Status | Notes |
|---|---|---|
| A2-f02 / R5-f01 · gate.sh exit-condition + `scripts/gate-verdict.test.mjs` (4 cases, A RED-first) | IN PROGRESS | |
| A2-f01 / R5-f02 · fixtures `--approve` → `evaluatePolicy` seat + `decidedBy` provenance | TODO | |
| R11-f04 / C2-f02 / R5-f12 · human-seat two-channel (TTY re-entry; non-TTY refuse; static no-same-env guard) | TODO | |
| A2-f03 / R5-f03 · 14 verbs exit 1→4 + `scripts/cli-exit-taxonomy.test.mjs` + doc sync | TODO | |
| A2-f04 / R5-f04 · narrow the eval "no writes" claim (4 spots) | TODO | |
| A2-f05 / R5-f05 · `balance-exhausted` legacy alias resolver + `preflightLimits` case + `scorecard.test.ts` | TODO | |
| A2-f06 / R5-f06 · envelope `measurement:false` from the marker | TODO | |
| C2-f03 / R5-f13 · widen `README-cli.test.mjs` (countClaimOffenders + fixtures) — counts already read 37 (0×"35") | TODO | |
| R12-f10 · run-marker crash path must not clobber prior `results.json` | TODO | |
| A2-f08 / R5-f07 · README-cli verify-kind stale ×6 (LANDED rewrite) | TODO | README-cli.md nominally D's box — see "for D" note below |
| A2-f09 / R5-f08 · `## Fixtures` + `## Eval` sections + `--effect` + doc-test assertions | TODO | same |
| A2-f10 / R5-f09 · fixtures stamp consistency (`--draft`/`--approve` predicate) + `rapidtool-cli-fixtures.test.mjs` | TODO | |
| A2-f11 / R5-f10 · valueless `--out` guards ×5 verbs (packet/export/create/diagram/design) | TODO | |
| R11-f13 · emit `--force`/valueless-flag asymmetry | TODO | |

## Evidence — RED repro (A2-f02, live at HEAD)

(`node --test scripts/gate-verdict.test.mjs` before the patch — recorded here once run.)

## Changes landed

(pending)

## for other lanes / notes

- `scripts/README-cli.md` is nominally LANE D's box; my rows (A2-f03 doc sync, A2-f04 claim, A2-f08 rewrite, A2-f09 sections) name README-cli.md edits explicitly, and the file lives under `scripts/**` (my box per the brief). I will make ONLY the spec'd R5 edits and list them here so the parent can detect overlap with D.
