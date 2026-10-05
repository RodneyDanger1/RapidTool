# fixes/348 — console/client wiring: per-stage audit is real and reviewable

Wave: RapidTool wiring wave, LANE 3 (client/console). Branch `rt348-console`, base `1395624`.
Worktree: `C:\Users\mnril\AppData\Local\Temp\rt_final_wt\console`.

## The seam

`buildClientDiagnosis` (src/lib/rt-client.ts) called `buildDiagnosis` without an `audit`,
so — like the CLI — the diagnosis carried `project.stages: []` plus a named `stagesGap`
("no per-phase audit supplied ..."), and the stage review had no user-facing surface.
The projector `projectDiagnosisStages` (src/lib/diagnose.ts) and `DiagnosisAudit` already
existed; nothing new was invented — both were imported/consumed read-only.

## Change

1. Data path — `src/lib/rt-client.ts`
   - `projectAudit(project)` helper (`rt-client.ts:810`) builds a `DiagnosisAudit` from the
     state the client already holds: `project.phases`, `project.artifacts`,
     `project.tokenUsage`. Absent project → `undefined` (no fabrication).
   - `buildClientDiagnosis` now passes `audit: projectAudit(input.project ?? null)` into
     `buildDiagnosis` (`rt-client.ts:876`). The ring's coded error rows already flow in as
     `errors`, so the projector attributes refusals by `row.phase`.
2. UI — `src/components/pipeline-rail.tsx` (no `console.tsx` change needed — `PipelineRail`
   already receives `project`)
   - Imports the shared projector: `import { projectDiagnosisStages, type DiagnosisStage }`
     (`pipeline-rail.tsx:54`).
   - `PipelineRail` projects `{ phases, artifacts, tokenUsage }` + the ring tail
     (`snap.tail`) once per render (`pipeline-rail.tsx:398`).
   - `PhaseRecordDetail` gains a `stage: DiagnosisStage | null` prop (`pipeline-rail.tsx:520`)
     and renders a "Machine audit" block (`pipeline-rail.tsx:245-317`): status, gate
     PASS/FAIL + unmet rows, coded refusals, keyed/treeRun/substance when observed, and the
     `unknown` list verbatim. Missing facts render as "unknown" / "not observed" / an
     explicit "No audit row observed for this phase".
   - The projector's `gap` is surfaced as "Stage audit incomplete — {gap}"
     (`pipeline-rail.tsx:485`).

No `console.tsx` edit; no other file touched; `diagnose.ts` read-only.

## Verification (real commands, from the worktree root)

```
node --experimental-strip-types --test --test-reporter=tap src/lib/rt-client.test.ts
# tests 21 / pass 21 / fail 0   (2 new: per-stage projection; absent-project gap)

node --experimental-strip-types --test --test-reporter=tap src/components/console.guards.test.ts
# tests 6 / pass 6 / fail 0     (1 new: PipelineRail audit pin)

node_modules/.bin/tsc.cmd --noEmit
# EXIT=0
```

New `rt-client.test.ts` case proves the projection is real end to end: a project with a
P5 phase (`status:"running"`, `gate{passed:false, unmet:["p5-research"]}`) + an artifact, plus
a ring `RT_E_DOD_UNMET`/phase 5 row, yields exactly one `project.stages[0]` with the status,
gate, refusal code, artifact name, and `observed:true`; `stagesGap` is `null`. Per-phase
`keyed` is asserted `null` because today's `PhaseRecord` carries no keyed slice
(diagnose.ts:264-266) — project-level `tokenUsage` maps to `project.keyed` instead (asserted).

## Residuals / blockers

- Per-phase `keyed`/`treeRun`/`substance` remain `null` on real data — the persisted
  `PhaseRecord` does not yet carry those slices (forward-compatible in the projector). The
  UI renders them only when observed, otherwise names them under "not observed". No blocker;
  this is an emitter gap outside this lane's owned files.
- Refusals the UI shows come from the bounded ring tail (`rtTail`, `RT_ERROR_TAIL`), the same
  window the diagnose pane uses — rows older than the tail are not attributed. No blocker.
- No blocker prevented landing; the UI wiring shipped (did not need to fall back to
  data-path-only).
