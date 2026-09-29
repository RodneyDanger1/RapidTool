# fixes/306_f2_display.md — W43 · LANE F2 · THE PIPELINE-VISIBILITY SURFACE

**Lane:** F2 (pipeline-display modernizer). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`.
**Contract:** additive-only in `src/components/console.tsx` (SOLE writer this wave); every pixel reads a REAL field; no keyed calls; no mock/fake; eslint 0.
**Baseline HEAD on entry:** `79f35b1` (clean tree; suite 2611/2610/0; lint 0).

## Mission
Make the pipeline process VISIBLE and alive: (1) phase rail P0→P12 with per-phase truth incl. blocked/refused + coded reason; (2) now-line = newest REAL ring event rendered as a human line + honest idle/awaiting states; (3) per-phase detail on click from real store/telemetry.

## Recon (byte-verified, t0)
- Store run state: `Project.phases: PhaseRecord[]` (types.ts:238-248: status/startedAt/completedAt/rejectionNote/rejectionHistory/gate{passed,unmet,evidenceHash,checkedAt}), `currentPhase` (:341), `status` (:340), `wildRun: WildRunState` (:146-154: active/phase/startedAt/lastAutoLog/lastAutoAt/stoppedAt/pause), `hitl: HitlRequest` (:364), `decisions: HitlDecision[]` (:366).
- Ring: `rtSnapshot()` (rt-client.ts:576) → `{ring, stats, tail: RtEvent[]}` (`tail` NEWEST-first, RT_ERROR_TAIL=200); `RtEvent` fields incl. `phase`, `code`, `message`, `event`, `ts`, `scope` (rt-events.ts:62-96). Event catalogue `RT_EVENT_NAMES` (rt-events.ts:127-202); wild names emitted by the store's wild loop + watchdog.
- Existing rail: `PhaseProgressRail` (console.tsx:3617) covers done/current/upcoming; `PhaseRail` (3723) is the left nav with click→viewPhase. `WildConsole` (1026) streams wild ledger activity. Mounted in RunScreen: rail 3209, WildConsole 3211, RuntimeLogPane 3492, RuntimeTimelinePane 3498.
- F2 adds a NEW sibling surface (no removal): `PipelineRail`/pipeline visibility panel mounted next to `PhaseProgressRail`.

## Ledger (append-only — file:line → before → after)

### [t0] open — recon read; log landed before edits
(entries below appended as edits land)
