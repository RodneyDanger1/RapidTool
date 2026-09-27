# 277 · LANE L2 (W33) — CHECKPOINT INTEGRATION + `resume` + UNATTENDED + `readWildPlan`

Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → `grep` not ripgrep). HEAD `0f85c32` + the W29–W33 uncommitted era.
Spec: `wave_plans/W33/unlanded-block.md` §U2 · `fixes/276_f1_real_autonomy.md` (F1's log) · `fixes/272_s1_autonomy.md` (S1's seam map).
**Sprint rule (this lane): CODE ONLY — no test runs, no typecheck, no builds, no gates, no keyed calls.** Parse-only checks (`node --check`) are used as a syntax tripwire, nothing else.

## Recon findings (state at lane start — IMPORTANT)

- **`src/lib/checkpoint.server.ts` IS complete on disk** (parent-built): `checkpointPath`/`writeCheckpoint`/`readCheckpoint`/`clearCheckpoint`/`boundProjectForCheckpoint`/`checkpointAdmits` + `CHECKPOINT_VERSION`/`CHECKPOINT_CAPS`. Path = `<dir>/.rapidtool/checkpoint.json` (atomic write-then-rename; corrupt-safe reads). This lane is the INTEGRATION only.
- **A1 (wild reviewer wire) is FULLY LANDED** — verified bytes, not just F1's claim:
  - `store.ts:29` import `createNodeWildReviewer`; `:1122` `const reviewer = await createNodeWildReviewer();`; `:1126` `wildStep(cur, reviewer ? { reviewer } : undefined)`.
  - `headless.ts:56` import; `:3723` + `:3729` (wildStartHeadless); `:3887` + `:3913` (wildStartRun).
  - `wild-review.ts` returns null on browser/keyless ⇒ keyless bytes unchanged. **No remaining call site needed at this wave** (runUntilGate/liveLayer surfaces only matter once a keyed run is actually driven — TODO(R14-f01) stands in wild-review.ts).
- **No checkpoint consumer existed anywhere** (`engine.ts`/`store.ts`/`headless.ts`/CLI: zero refs) — F1's row was left `in progress`; this lane lands the integration.
- **No `readWildPlan` function existed** (only `types.ts`'s `WildPlan` + prose). `planning.ts` IS callable server-side (keyed: one flash json call; keyless: honest `{ok:false, reason:"not-configured"}`) ⇒ a minimal REAL generation is possible, keyed-only.
- **Doc-parity constraints (verified in `scripts/README-cli.test.mjs`):** a new `case "resume"` arm ⇒ (a) every `**N subcommands**` headline must read the new real arm count; (b) the headline verb list must name `resume` (and no non-arm token may sit in the list block); (c) every line quoting `grep -c 'case "'`/`N case arms` must cite the new count; (d) the USAGE `commands` keys must equal the case-arm set exactly. README's `rapidtool-cli.mjs:768` refs are prose and must be re-pointed after line shifts.
- **Run driver for the CLI = `headless.runUntilGate`** (`run` = 1 step, `gate` = until parked) — that is where `applyPhaseResult`'s result is committed for CLI/headless runs, and the only place a project working dir is actually known (the browser/store path has no filesystem ⇒ the guard's no-op branch).

## Status board (as-landed)

| Item | Files | State | Notes |
|---|---|---|---|
| C1 checkpoint call site | `src/lib/headless.ts` | _in progress_ | guarded per-phase write + clear-on-complete in `runUntilGate` |
| C2 `resume` verb | `scripts/rapidtool-cli.mjs` · `scripts/README-cli.md` | _in progress_ | reads → admits → re-enters at `cp.run.phase` |
| C3 unattended | `scripts/rapidtool-cli.mjs` · `scripts/README-cli.md` | _in progress_ | `run --unattended` (real drive; host-scheduler named in help) |
| C4 `readWildPlan` + real plan gen | `src/lib/engine.ts` · `src/lib/headless.ts` · `src/lib/store.ts` | _in progress_ | accessor + store read path + keyed-only `planning.planSteps` generation |
| C5 reviewer wire | — | **VERIFIED DONE** | A1 already landed (bytes above) |

## Log

- (t0) Lane start. Read `wave_plans/W33/unlanded-block.md`, `fixes/276_f1_real_autonomy.md`, `fixes/272_s1_autonomy.md`, `src/lib/checkpoint.server.ts` (full), `wild-review.ts`, and the touch-points (`store.ts` run/wild drivers, `engine.ts` wildStep/runPhaseAsync/applyPhaseResult, `headless.ts` run loop + wild macros, `scripts/rapidtool-cli.mjs` verbs/USAGE, `scripts/README-cli.test.mjs`, `scripts/README-cli.md`, `planning.ts`).
- (t0) Wrote this log early.

## What remains (filled at the end)

- (filled as items land)
