# 276 · LANE F1 — MAKE THE AUTONOMY + UNIVERSALITY SHELLS REAL (W33 fused U1+U2)

Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash). HEAD `0f85c32` + the W29–W33 uncommitted era.
Spec: `wave_plans/W33/unlanded-block.md` (§U1 + §U2 = this lane) · `wave_plans/W30/shell-sprint.md` (§S1/§S2
shell contract) · `fixes/272_s1_autonomy.md` · `fixes/272_s2_universality.md` (touch-point map + the TEST
CONSTRAINTS) · `research/multiagent/thoroughanalysis.md` §R3-f06/§A3-f05/f07/§R3-f02/f03/§R14-f01.
Contract: smallest honest patches · additive only · no fake behavior · targeted checks only (no full gates,
no keyed calls) · log-and-continue.

## Recon findings (state at lane start — IMPORTANT)

- **`fixes/272_s1_autonomy.md` and `fixes/272_s2_universality.md` both claim DONE/have-landed status boards —
  the CODE IS NOT IN THE TREE.** Verified on disk: `src/lib/checkpoint.server.ts` missing ·
  `scripts/unattended-shell.mjs` missing · no `case "resume"` arm · no `reviewer` at any wild call site ·
  `scaffold.ts` has no `R3-f06` markers / no `bin`/`exports`/`files` work / no `uiGeneration` ·
  `run-eval.mjs` has no `expectedBehavior`/`verification` · `codegen.server.ts` rule 2 is still the old CJS
  wording. Only genuinely landed from S1: `errors.ts`'s 3 codes + docs, and `src/lib/wild-review.ts` (the
  unreferenced seam module). This lane lands BOTH blocks for real.
- Test constraints confirmed fresh: `scaffold.test.ts:338` sweeps every E-15 mention for
  `TODO(E-15) stub`; `emitted-honesty.test.ts:42` needs `RT_E_VALIDATION · ` on every stub throw;
  `run-eval.test.mjs:381` pins `checked` to exactly `{expectedFiles, expectedContent}` (new fields ride as
  ADDITIVE envelope keys); `codegen.server.test.ts` pins `module.exports.add = add` in the worked example.
- `headless.test.ts` "not ok 10" reproduced locally: the ONE failing subtest is `W-02 keyless floor:
  runP6Edge without deps is the deterministic floor` (:606) — drift is EXACTLY the volatile byte class
  (packet `compiled_at` text+embed, `phases[].startedAt/completedAt`, `traces[].ranAt`); the test already
  strips `logs[].ts` but not those. Fix = extend the strip to the WDX-3 volatile set (precedent:
  `wild-step.test.ts` `stripVolatiles`), assertion intent untouched.
- `runP6Edge` (W-01) + `runUntilGate(… p6Deps)` (W-02) are landed — the unattended command can be REAL.

## Status board (as-landed)

| Item | Files | State | Proof |
|---|---|---|---|
| A1 wild reviewer wire | `src/lib/store.ts` · `src/lib/headless.ts` | _in progress_ | — |
| A2 checkpoint + `resume` | `src/lib/checkpoint.server.ts` (new) · `headless.ts` · `rapidtool-cli.mjs` · `README-cli.md` | _in progress_ | — |
| A3 `run --unattended` | `rapidtool-cli.mjs` · `headless.ts` | _in progress_ | — |
| A4 `readWildPlan` + real plan gen | `engine.ts` · `headless.ts` | _in progress_ | — |
| A5 headless not-ok-10 | `headless.test.ts` | _in progress_ | — |
| B universality (S2) | `scaffold.ts` · `run-eval.mjs` · `codegen.server.ts` | _in progress_ | — |

## Log

- (t0) Lane start. Read `wave_plans/W33/unlanded-block.md` in full, `wave_plans/W30/shell-sprint.md`,
  `fixes/272_s1_autonomy.md`, `fixes/272_s2_universality.md`, the §R3-f06/§A3-f05/f07/§R3-f02/f03/§R14-f01
  rows in `thoroughanalysis.md` (line map: A3-f05 :331 · A3-f07 :333 · R8-f10 :715 · R8-f17 :731 ·
  R14-f01 :1106 · R3-f02/03/06 :1365-1367 · R11-f12 :1444).
- (t0) Recon greps + the headless leg run (fail census above). Wrote this log early.

## What remains (to fill at the end)

- (filled as items land)
