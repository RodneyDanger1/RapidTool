# fixes/271 — LANE E1 · THE P0 LANE (W29 Stage-1: the three PROVEN repairs + the watchdog budget)

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD at start:** `0f85c32` · **Lane:** E1 (owns `engine.ts`, `headless.ts`, `store.ts:1105` region, `wild-step.test.ts`; also `rt-events.ts` watchdog budget with W-01).
**Rows:** W-01 (R1-f01) · W-02 (R1-f02 + R8-f01/f02 + §R10 cross-confirm) · W-03 (R3-f01 PROVEN REPAIR) · R12-f04 (watchdog budget, lands WITH W-01).
**Rules honored:** pins written RED-first where specified; RUN ONLY targeted single-file/leg checks; NO full-gate runs; NO keyed calls (O-1 unfunded). Log-and-continue.

## Plan
- [ ] W-01 · `WildStepOptions.p6Edge` additive seam + `wildP6Edge` helper (dynamic `"./head"+"less.ts"` import → `hl.runP6Edge`), call-site guard `phase===6 && (opts.p6Edge || keyed)`, edge-naming log; keyless byte-parity pin.
- [ ] W-02 · ONE `runP6Edge(project, deps?)` export in headless.ts (driveP6Journey wrapper; keyless ⇒ floor); `runPhase` `p6Deps` + phase-6 branch; reachable from run/gate/console(`runPhaseAsync` P6 branch) + wild (W-01). Decide driveP6Journey "failed-with-fixtures" branch explicitly.
- [ ] W-03 · emit-time materialization in `emitProject` (headless.ts:1584): `materializeImportableTree` on differing bytes, `exports:[]`, conditional (`≠` guard load-bearing); materialize the `.rapidtool/project.json` record (`scaffold.ts:2521`) too; chunk-0 relocation consequence handled in tree-mode tests; RED-first pins: 0-`module.exports` + import-smoke.
- [ ] R12-f04 · raise `WILD_STEP_BUDGET_MS` (rt-events.ts) with W-01 — derive the P6 budget from the phase max (`P6_SYNTH_TIMEOUT_MS = 240_000`) so a legal 240s keyed step can't auto-pause at 90s.

## Landing log (append-only)
_(filled as work lands — one entry per fix with exact commands run + results)_
