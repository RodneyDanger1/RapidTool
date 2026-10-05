# 350 · LANE F1 — per-phase telemetry into the record

Branch `rt350-phase`, base `3436866`. Isolated worktree `rt_final_wt/phase` only;
the concurrent `RapidTool Main` tree was never touched.

## The seam

The persisted `PhaseRecord` (`src/lib/types.ts`) carried only status/gate, so the
per-stage audit (`diagnose.projectDiagnosisStages`) and the run report
(`run-report.renderRunReport`) read `keyed` as `unknown` / "not recorded per
phase". The P6 tree-run/substance verdict was persisted project-level by
`headless.withTreeRunVerdict` but never attributed to phase 6.

The real per-phase boundary is **`headless.runReady` → `runPhase` → `finishPhase`**
(the CLI `run`/`gate`/`resume`/`unattended` loop that writes `build.json`), with the
console twin **`engine.runPhaseAsync`**. Both already have the process session
ledger (`sessionTokenBudget`) that every model call meters into via
`recordSessionSpend`; the measured delta across the phase's own run is exactly the
phase's spend.

## The change (file:line)

- `src/lib/types.ts`
  - `PhaseRecord.spend?: SpendSlice` (added after `gate`) — the measured per-phase
    keyed spend. Additive/optional; absent ⇒ legacy behavior byte-for-byte.
  - `Project.treeRun?` / `Project.substance?` — TYPES the fields `withTreeRunVerdict`
    already wrote on disk (they were untyped before).
- `src/lib/headless.ts`
  - `recordPhaseSpend(project, phase, baseline)` (new export, above `runReady`) —
    `spendDelta(sessionTokenBudget().ledger, baseline)`, accumulated with
    `accumulateSpend` onto any existing slice; an empty delta returns the SAME
    project (no field, no fabricated 0). Never reads/sets a cap.
  - `runReady` (line ~913) snapshots `normalizeLedger(sessionTokenBudget().ledger)`
    before `runPhase`, then folds the finished project through `recordPhaseSpend`.
- `src/lib/engine.ts`
  - `recordPhaseSpend(...)` (new export, above `runPhaseAsync`) — same arithmetic
    for the console/UI path.
  - `runPhaseAsync` (line ~4140) wraps its whole body (P6 edge, `liveLayer`, and the
    deterministic catch floor) in a session-ledger baseline + `recordPhaseSpend`.
  - imports extended with `accumulateSpend`, `totalTokens`, `TokenLedger`.
- `src/lib/diagnose.ts`
  - `projectDiagnosisStages`: reads `phases[].spend` first (`keyedOf(o.spend) ??
    keyedOf(o.keyed)`); project-level `treeRun`/`substance` are attributed to their
    owning phase 6 when the blob carries no explicit `phase`.
  - `auditFromProject`: passes the persisted `treeRun`/`substance` through only when
    present (so the CLI `diagnose --project` path carries them).
- `src/lib/run-report.ts`
  - `persistedPhaseSpend(project, phase)` reads `PhaseRecord.spend`; the phase loop
    prefers caller `opts.spendByPhase[phase]` then the persisted slice, so `Keyed
    spend` is the real measured numbers instead of the run-total notice.
  - `treeRunText` / `substanceText` render `Project.treeRun` / `Project.substance`
    on the P6 section (`**Tree run:** pass (evidence hash …)`, `**Substance:** real`),
    or an honest "not recorded" when absent.

## What became real vs. honestly absent

| field | before | after |
|---|---|---|
| `DiagnosisStage.keyed` | `null` + `unknown:["keyed"]` | the measured `PhaseRecord.spend`, verbatim |
| `DiagnosisStage.treeRun` (P6) | `null` + `unknown` | persisted `Project.treeRun` verdict + hash |
| `DiagnosisStage.substance` (P6) | `null` + `unknown` | persisted `Project.substance.verdict` |
| report per-phase `Keyed spend` | "not recorded per phase (run total: …)" | the measured slice |
| report P6 `Tree run` / `Substance` | not rendered | persisted verdict / census label, else "not recorded" |

Honestly absent (unchanged): a phase with no measured call (delta empty) records no
`spend`; a record whose `treeRun`/`substance` was never persisted still reads
`unknown`/"not recorded". Nothing is estimated or invented. No cap is fed by the
persisted spend; no gate was weakened; no keyed LLM call was made.

## Commands + results

```
node_modules\.bin\tsc.cmd --noEmit        -> TSC_EXIT:0
node --experimental-strip-types --test --test-reporter=tap src/lib/diagnose.test.ts src/lib/run-report.test.ts
                                          -> 46 pass, 0 fail
node --experimental-strip-types --test --test-reporter=tap src/lib/engine.test.ts
                                          -> 61 pass, 0 fail
node --experimental-strip-types --test --test-reporter=tap src/lib/headless.test.ts
                                          -> 193 pass, 0 fail (incl. the REAL campaign-3 fixture round-trip, ran not skipped)
```

New tests:
- `run-report.test.ts`: measured `PhaseRecord.spend` renders as real numbers; absent
  stays "not recorded per phase"; P6 tree-run/substance render real vs "not recorded".
- `diagnose.test.ts`: `spend` clears the `keyed` unknown; `auditFromProject` carries
  `treeRun`/`substance` and the projector attributes them to P6; explicit `phase` wins;
  junk blobs never throw.
- `headless.test.ts`: the `recordPhaseSpend` seam (measured delta recorded, empty delta
  no-op, a re-run accumulates); a REAL persisted-fixture round-trip
  (`campaign3/bakery-florist-orders/build.json` → measured spend + P6 verdicts →
  `saveProject` → `loadProject`).
- `engine.test.ts`: `engine.recordPhaseSpend` folds a measured delta, no-ops an empty one.

## Residuals (not faked)

- The CLI `diagnose` wiring (`scripts/rapidtool-cli.mjs`, FORBIDDEN) must still pass
  `auditFromProject(project)` for live envelopes to carry the audit; the mapper is
  ready the moment it does.
- `rt-client.projectToDiagnosis` (`src/lib/rt-client.ts`, FORBIDDEN) builds its audit
  from `{phases, artifacts, tokenUsage}` only, so the UI path does not yet pass
  `treeRun`/`substance`; the projector reads them the moment it does.
- The `engine.runPhaseAsync` spend fold is exercised directly (unit) because a keyless
  host records no session spend; with a keyed call it is the same measured delta.
