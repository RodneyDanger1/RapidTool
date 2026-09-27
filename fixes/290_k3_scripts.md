# 290 — K3 scripts sweep (finishing B3's guard-script recon + Q1's naming sweep)

Lane: K3 (W39). HEAD 2fa3cd9. CODE-ONLY — `node --check` on every file edited; no gates, no keyed calls.
B3 (task-2 of deleg_5f2a88c4, log `fixes/288_b3_scripts.md`) completed recon but died before landing fixes;
Q1 (task-4) died early (no log). This file finishes both: guard-script correctness + fail-closed discipline,
then the naming/dead-code sweep with before/after grep counts.

Sibling lanes K1–K9 live; reads keep "for <lane>" handoff notes.

## Box
Guard scripts in `scripts/**`: path-safety · browser-guard · write-atomic · docs-module-parity · lesson checkers ·
bench utilities (bench.projectedTime / stripStringsAndComments / minutesForPhase / phaseStatusWeight — W26-H1 untested) ·
assertion-gap/auth-invariant checkers · install/exec helpers (with-app-env, app-env-plugin, migrate) · gate.sh · preview/browser-smoke.
Not mine: `rapidtool-cli.mjs` (Z1/Z3), `*.test.mjs` (Z-waves).

B3's recon log `fixes/288_b3_scripts.md` held only the header; its final summary (recovered from state.db,
msg 98254, session 20260927_000626_e209c7 — the transcript truncated it at "+98 chars") lists 7 read-verified,
unpatched findings. They are my worklist §1–§7 below. Q1's transcript (`deleg_5f2a88c4/task-4.log`) shows its
scans + scratch (`~/w39q1_scratch/`: naming-survey, dead-exports, dead-fns, refs, test-name-scan) — worklist §8.

## Findings + fix log (append-only)
| # | file:line | bug | patch | evidence |
|---|---|---|---|---|
| B3-1 | run-eval.mjs:354-415,349-352 | `expectedBehavior` parsed+validated, never evaluated; comment claims `checkExpectedBehavior`/`behavior.rows`/`verification` which do not exist | see §1 | grep: only comment mentions verbatim:0 |

