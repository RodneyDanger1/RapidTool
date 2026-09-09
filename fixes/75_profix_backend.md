# 75 — Pro Fixer P2: coding-process / backend / CLI / UI lane fixes (wave: 3-hunter chat/coding-backend/delegation sweep)

**Role**: Pro fixer P2 — applies CONFIRMED findings from `research/multiagent/41_verified_bugs.md`
(H39-xx coding/backend; H38-xx console-UI; any CLI/backend findings triaged into this lane).
Every fix = surgical `patch` + regression test. No renamed/removed exports.

**Owned files**: engine.ts · store.ts · dod.ts · packet.ts · report-intake.ts · verify.server.ts ·
verify.ts · node-runner.server.ts · sandbox.ts · io.ts · handoff.ts · gate-stats.ts · headless.ts ·
scripts/rapidtool-cli.mjs · src/components/console.tsx (+ their test files).

## Baseline (2026-09-06, before any edits this wave)

- `npm run typecheck` → 0
- lib suite → 963 tests, 962 pass / 1 skipped / 0 fail
- (`npm run lint` / `npm run build` re-run at end)

## Applied fixes

| # | Finding | File:line | Test added | Status |
|---|---------|-----------|------------|--------|
| _(none yet — waiting on register 41)_ | | | | |

## Spec corrections

_(findings where the register's patch spec was wrong and I applied a corrected version)_

<!-- APPEND -->
