# fixes/307_u2_pipeline.md — U2 · PIPELINE-VIEW COMPLETION (UI second)

> Wave 307 · U-lane. HEAD `84784b5` (clean on entry). Box (sole writer): `src/routes/**` ·
> `src/lib/rt-client.ts` · `src/lib/rt-timeline.ts` · `src/lib/rt-ring.ts` · NEW
> `src/components/pipeline-rail.tsx` (F2's spec completed as a real component — console.tsx is
> U1's, untouched here). Mandate: bugs/non-wired/partial only · no keyed calls · legs FOREGROUND.
> (Log opened pre-edit per wave brief — 2026-09-29, U2.)

## 0 — Status board

| Item | Status |
|---|---|
| Early log | DONE (this file) |
| §1 Build `pipeline-rail.tsx` (rail + now-line + per-phase detail, real fields only) | IN PROGRESS |
| §2 Field ledger (every pixel → named real field) | DONE (draft in §2 below) |
| §3 Wire routes/panes lacking it — or hand U1 the import note | TODO (§5 handoff drafted) |
| §4 Sweep `src/routes/**` + rt-* libs for non-wired/partial items | TODO |
| §5 eslint 0 + scoped tsc on touched files | TODO |

## 1 — F2 spec → build mapping (byte-verified against HEAD `84784b5`)

- Rail P0→P12: `PHASES` (phases.ts:3-108) × `project.phases: PhaseRecord[]` (types.ts:325-335),
  `project.currentPhase` (types.ts:428), `project.status` (:427).
- Now-line: `rtSnapshot().tail[0]` (rt-client.ts:576-589; `rtTail` = NEWEST-first, rt-ring.ts:239)
  → fallback `project.logs.at(-1)` (`JsonLog{ts,phase,level,event,detail}` types.ts:130-136)
  → fallback `project.wildRun.lastAutoLog/lastAutoAt` (types.ts:229-241).
- Coded reason / parked run: `WildRunState.park: WildParkInfo` (types.ts:170-186, F5 landed at
  84784b5) → `code` · `reason` · `unlockText` · `resumePhase` · `resumeAction`; and
  `WildRunState.lastStep: WildStepSummary` (types.ts:196-214).
- Per-phase detail: replicating console's `PhaseRecordView` real-field reads 1:1 (console.tsx:6356
  is module-PRIVATE — importing it from a sibling component would create a console↔pipeline-rail
  import cycle; per one-writer rule console.tsx is U1's this wave. Fields reused exactly:
  `PHASE_BY_ID` def code/title/summary/hitl · rec.status · rec.startedAt/completedAt ·
  rec.rejectionNote · rec.rejectionHistory[{note,at}] · rec.gate{passed,unmet,evidenceHash,checkedAt}
  · `project.decisions` filtered by phase · `project.artifacts` filtered by phase).

## 2 — Field ledger (every rendered pixel reads one of these)

(to be filled with the final component line refs at §4)

## 3 — Ledger

### [t0] open — recon read (306 F2 spec + HEAD diff); log landed before edits.
