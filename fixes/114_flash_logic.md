# 114 — Flash logic/algorithms fix log (executor F3)

**Role**: FLASH EXECUTOR F3 — logic + algorithms lane.
**Owned files**: `src/lib/algorithms.ts`, `src/lib/dod.ts`, `src/lib/knowledge.ts`,
`src/lib/vault.ts`, `src/lib/report-intake.ts`, `src/lib/prompt-engine.ts`,
`src/lib/scaffold.ts`, `src/lib/store.ts`, `src/lib/types.ts` (additive only),
`src/lib/rt-client.ts`, `src/lib/rt-ring.ts`, `src/lib/rt-events.ts`,
`src/lib/watchdog.ts`, `src/lib/diagnose.ts`, `src/lib/runtime-log.server.ts`
(+ their tests) — patch-only, no export renames, zero-dep.
**Spec source**: `fixes/110_*.md` (pipeline-adjacent logic, live PA specs) +
`fixes/111_*.md` (algorithm/UI-adjacent logic, live PB specs) — implement AS
THEY LAND, P0-ranked first.
**Lane suites** (baseline 258/258 pass, 11.5 s @ ~19:55):
`algorithms`, `knowledge`, `vault`, `report-intake`, `scaffold`, `store`,
`rt-client`, `rt-ring`, `rt-events`, `watchdog`, `diagnose`,
`runtime-log.server` test files.
**Gates**: lane suites green · repo typecheck (`npx tsc --noEmit`) · no export
renames · patch-only on existing files.

## Baseline (before any PA/PB spec landed)

- Lane suites: 258/258 pass (run @ ~19:55, node --experimental-strip-types).
- fixes/110_*.md, fixes/111_*.md: **not yet created** at first polls (19:40–20:10).
- Wiring state observed in-lane (read-only survey): rt-events/rt-ring/watchdog/
  diagnose/runtime-log.server + rt-client landed w/ tests; `store.ts:22`
  imports `reportRt` (CAP-8 persist rows @ ~633); `startWildRun` driver
  (store.ts ~710–810) does **not** yet wrap watchdog pause-on-resolve
  (109 §5.2/§8.2 Batch E store part unwired); boundedStepWatch has no prod
  call sites outside watchdog.ts/rt-client.ts yet.

## Applied fixes

| # | Spec | File:line | Patch | Test | Status |
|---|------|-----------|-------|------|--------|
| _(none yet)_ | | | | | |

## Verifications & notes

_(none yet)_
