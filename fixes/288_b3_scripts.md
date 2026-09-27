# 288 — B3 scripts sweep (`scripts/**` guard utilities, non-CLI)

Lane: B3 (owner of `scripts/**` EXCEPT `rapidtool-cli.mjs` [Z1/Z3] and the `*.test.mjs` files the Z-waves edit).
Started: 2026-09-27 (W39). CODE-ONLY — no test runs, no gates, no keyed calls; `node --check` on every file edited.
Read fresh; byte-verify every claim.

## Box
Guard scripts: path-safety · browser-guard · write-atomic (write-set) · docs-module-parity · arm-parity ·
lesson checkers · the 4 bench utilities (W26-H1 flagged untested: `bench.projectedTime` /
`stripStringsAndComments` / `minutesForPhase` / `phaseStatusWeight`) · scaffold/emit guards (assertion-gaps,
auth-invariant) · install/exec helpers (with-app-env, app-env-plugin, migrate) + gate.sh + preview/browser-smoke.
Not mine: `rapidtool-cli.mjs` → handoff lines "for Z1/Z3"; `*.test.mjs` → "for Z-waves".

## Findings + fix log (append-only)
| # | file:line | bug | patch | evidence |
|---|---|---|---|---|
