# fixes/272_s1_autonomy.md — W30 SHELL SPRINT · LANE S1 (AUTONOMY SHELLS)

**Lane:** S1 — autonomy shells (`wave_plans/W30/shell-sprint.md` §S1). **HEAD at open:** `0f85c32` + W29 edits (uncommitted).
**Scope (shells only):** R14-f01 supervisor completer seam · W-47/R13-f01 unattended command + coded refusal · R13-f02 `wild.plan` field + read-point · T-107.7 checkpoint + `resume` shells.
**Contract honoured:** compiles (`node --experimental-strip-types --check` on every touched/created `.ts`) · ≥1 real call site each (or honest coded refusal) · `TODO(<row-id>)` at the exact logic line · no fake behavior · additive only · no full gates, no keyed calls.

## Status board (as-landed)

| Item | Files | Seam shape | Call site / refusal | TODO markers |
|---|---|---|---|---|
| R14-f01 | `src/lib/wild-review.ts` (new) · `src/lib/store.ts` · `src/lib/headless.ts` | `createNodeWildReviewer(): Promise<WildReviewer \| null>` — bare-Node-only builder that injects `completeDeepSeek` + `isDeepSeekConfigured`/`deepSeekModelIds` (direct-env probe, parity `engine.ts:2871-2873`) into `createWildClassifier` (the injected-`WildCompleter` factory) | **3 real call sites**: `store.ts` `startWildRun` (wildStep loop), `headless.ts` `wildStartHeadless` + `headless.ts` `wildStartRun` — each builds the reviewer once and passes `opts.reviewer` | `TODO(R14-f01)` in `wild-review.ts` (keyed evidence run + driver-threading remainder) |
| W-47/R13-f01 | `scripts/unattended-shell.mjs` (new) · `scripts/rapidtool-cli.mjs` (`unattended` verb + USAGE + header) · `src/lib/errors.ts` (`RT_E_UNATTENDED_UNSUPPORTED`) | `unattendedRefusal(intent)` frames the host requirement (Task Scheduler/cron hook, comment + payload) and REFUSES naming W-01/W-02 | **honest coded refusal**: exit 2, `RT_E_UNATTENDED_UNSUPPORTED`, `blockers:[W-01,W-02]`, `hostRequirement`, `wouldRun` (parsed intent) | `TODO(W-47)` in `unattended-shell.mjs` (arm the hook only after W-01/W-02 keyed) |
| R13-f02 | `src/lib/types.ts` (`WildPlan`/`WildPlanRow` + `Project.wildPlan?`) · `src/lib/engine.ts` (`readWildPlan` + read-point) | `readWildPlan(p)` returns the stored plan or an HONEST EMPTY plan (`rows: []`, `source:"empty"`, note names the row) — called before wildStep's execution edge (before any phase mutation) | **engine read-point call site** in `wildStep` (pre-execution); no mutation, no fake rows | `TODO(R13-f02)` in `engine.ts` (planner rows + classifier review + pause-until-approved + UI/packet render) |
| T-107.7 | `src/lib/checkpoint.server.ts` (new) · `src/lib/engine.ts` (guarded call) · `scripts/rapidtool-cli.mjs` (`resume` verb + USAGE + header) · `src/lib/errors.ts` (`RT_E_CHECKPOINT_MISSING`, `RT_E_NOT_IMPLEMENTED`) | `checkpoint.server.ts`: `checkpointDirFor(projectPath)` (`<dir>/.rapidtool/checkpoints`), `stateHashOf` (fnv1a), bounded `writeCheckpoint`, `readLatestCheckpoint`, `listCheckpoints`, guarded `maybeWriteCheckpoint` (OFF unless `RAPIDTOOL_CHECKPOINT=1` + `RAPIDTOOL_CHECKPOINT_DIR`) | **guarded call site** at `wildStep`'s per-phase commit (`stampPacket(recordGateInto(...))` exit); **`resume` verb** parses → validates → refuses `RT_E_CHECKPOINT_MISSING` (none) / `RT_E_NOT_IMPLEMENTED` (found, re-entry unwired) | `TODO(T-107.7)` in `checkpoint.server.ts` (full state set / delta snapshots) + `engine.ts` (threading the project dir + `run.resumed` ledger) |

## Design notes / decisions

- **R14-f01 host guard.** The builder returns `null` on non-Node hosts (no `process.versions.node`) and when `isDeepSeekConfigured()` is false → every existing keyless/browser path keeps its EXACT bytes (engine default `.server` binding + deterministic DoD floor). Keyed bare-Node now binds the classifier to `completeDeepSeek` — the one host where the wild loop actually runs.
- **W-47 exit class.** `unattended` refuses with exit **2** (the blocked class; W-47's own register status is BLOCKED(ON W-01+W-02)) — documented in README-cli.md's table row.
- **T-107.7 checkpoint record.** The shell writes a BOUNDED, explicitly-partial record (`stateSet:"shell-partial"`): id/name/status/currentPhase/phase-verdict/stateHash/logs-tail — NOT the full project JSON (R8-f05's 84–92 KB/project anti-pattern). `resume` can therefore find/parse a checkpoint but will not pretend to re-enter.
- **Guards.** Checkpoint writing is OFF by default (`RAPIDTOOL_CHECKPOINT=1` + `RAPIDTOOL_CHECKPOINT_DIR`), so every existing run stays byte-identical; the write call never throws into a wild step.
- **errors.ts.** 3 codes appended (additive): `RT_E_UNATTENDED_UNSUPPORTED`, `RT_E_CHECKPOINT_MISSING`, `RT_E_NOT_IMPLEMENTED` — each with `ERROR_CODE_DOC` rows (errors.test.ts contract).

## Verification performed (targeted only)

- `node --experimental-strip-types --check` on every created/touched `.ts` file — result logged below.
- `node --check scripts/rapidtool-cli.mjs` + `node --check scripts/unattended-shell.mjs`.
- `scripts/README-cli.test.mjs` verb-count/USAGE/list parity + `src/lib/errors.test.ts` doc-parity (contract tests my edits touch) — results below.
- CLI dogfood: `unattended --project <tmp>` → coded refusal; `resume --project <tmp>` → coded no-checkpoint refusal; `resume --list` read-only.
- No keyed calls. No full gates.

## [EXT-FAIL] / deviations log

- _(filled during the run)_

## What's needed after (the work this shell makes possible)

- **R14-f01:** one funded bare-Node wild run must log `wild.review (classifier)`; thread the same reviewer through any remaining driver (runUntilGate/liveLayer path) if the boundary run shows a gap.
- **W-47:** land W-01/W-02 keyed; then arm the Task Scheduler/cron hook (the verb swaps its refusal for the real `wild --start` driver + a run cap + policy routing).
- **R13-f02:** generate plan rows from `planning.ts`, review them with the classifier, pause before mutation unless `autoPlan`/policy approves; render on Project/packet/dock.
- **T-107.7:** replace the partial record with the capped delta set, thread the project dir from the CLI/headless into the engine's commit seam, implement `resume` re-entry (newest checkpoint → same next phase) + the `run.resumed` ledger row.
