# fixes/264 — W25 LANE A1 · deep audit of THE FACTORY CORE (engine · phases · gates/DoD · P6 keyed synthesis · codegen/emit · tree-run · mint)

**Lane:** W25-A1 (auditor — NO product edits). **Log:** `research/multiagent/thoroughanalysis.md` §A1 (appended via the end-marker protocol).
**Scope:** `src/lib/engine.ts` (13-phase engine, wildStep, liveLayer, upgradeP6Keyed) · `src/lib/phases.ts` · `src/lib/dod.ts` (DoD registry + runGate; note: **there is no `src/lib/gates.ts`** — gate code lives in dod.ts/engine.ts) · `src/lib/codegen.server.ts` (liveP6Synthesis, chunked tree, partialTreeRefuse, treeUpgraded, mintTreeRunTested) · `src/lib/deepseek.server.ts` + `src/lib/llm/providers/deepseek.ts` (provider) · `src/lib/scaffold.ts` (emit/oracle spec) · `src/lib/compile-check.server.ts` (treeRun) · `src/lib/headless.ts` (runUntilGate, driveP6Journey, emitProject, wildStartRun) · `scripts/run-eval.mjs` + `scripts/rapidtool-cli.mjs` (read-only trace) · `src/lib/store.ts` (console drivers).
**Rule honoured:** no keyed calls (account unfunded — every call 402), no full-gate runs, no product edits, append-only.

**STATUS: audit complete — findings appended (A1-f01…A1-f09), evidence read 2026-09-26 15:30–15:50 CDT while W24/W25 siblings are mid-edit.**

---

## What the functional trace established (keyed run TODAY)

Trace chain (all read today): CLI/eval `create` → floor drain (`runUntilGate` → `runPhase(live)` → `runPhaseAsync` → `liveLayer` → `upgradeP6Keyed` → `codegen liveP6Synthesis`, `engine.ts:2869/2920`, `headless.ts:1887`) → P6 journey (`driveP6Journey`, `headless.ts:2001`) → emit + treeRun + `mintTreeRunTested` (`codegen.server.ts:3450`) → `recordGateInto` → emit handover (`emitProject`, `headless.ts:1560`).

Two structural gaps make the mission-critical sentence — "given a brief and a DeepSeek-keyed model it creates software with GOOD code" — unreachable through the product's own verbs:

1. **Wild Mode (the autonomous loop) never calls the model.** `wildStep` executes only `applyPhaseResult` (deterministic floor, `engine.ts:3986`); `upgradeP6Keyed` has exactly one caller — `liveLayer:2920`. The comment at `engine.ts:2853-2856` claiming the seam is "shared by liveLayer AND the wild P6 step" is drift. CLI `wild --start` (`headless.ts:3805`) and the console loop (`store.ts:1105`) therefore ship placeholder code, and with `enforceDod` ON (keyed default `engine.ts:1902`) the run hard-blocks at P6 (`engine.ts:3760-3772`) — exactly the committed stall (`results.json` notes: `P6 DoD unmet — hard gate blocks advance: p6-verified, p6-brief-fit.` / `RT_E_GATE_PENDING`).
2. **The "tested" mint is reachable only from `eval`/`repair`.** `treeUpgraded` nulls `lastTest` (`codegen.server.ts:3383`); `mintTreeRunTested` is called solely from `driveP6Journey` (`headless.ts:2100/2142`) and `repairTreeDir` (`headless.ts:2681`). `run --live` / `gate --live` / console phase-run never tree-run or mint → any chunked (app/game/tool) keyed run hard-stops at `p6-verified` even with a perfect tree.

Honesty-surface corollaries: the mint counts assertions that never exercise behavior (throwing stubs pass, `scaffold.ts:1596-1615` + `codegen.server.ts:3416-3431`); a hard-DoD stall writes no red gate record (`dod.ts:865-870`) so the census reads "nothing to hide"; `partialTreeRefuse` keeps a stale green `lastTest` over a replaced artifact; emit refuses over stale dirs unless force (which keeps them) outside the eval driver.

## Findings index (full text in research/multiagent/thoroughanalysis.md §A1)

| ID | Area | Sev | One-line |
|---|---|---|---|
| A1-f01 | engine/wildStep | **P0** | Wild Mode never calls keyed P6 synthesis; the autonomous loop cannot produce LLM code (comment drift says otherwise). |
| A1-f02 | engine/gates/mint | **P0** | Chunked (app/game/tool) keyed runs can never pass `p6-verified` outside `eval`/`repair` — run/gate/console hard-stop at P6. |
| A1-f03 | P6 synthesis/verification | **P1** | "Machine-verified (tested)" mint is earned by load+presence: hollow/throwing trees pass (tree-job row swallows throws). |
| A1-f04 | DoD registry | **P1** | No DoD criterion measures behavior/quality; P6 content gates are identifier-presence proxies (over-credit + over-block). |
| A1-f05 | codegen refusal | **P1** | `partialTreeRefuse` keeps the floor's green `lastTest` while swapping `generatedSource` — stale evidence over a different artifact. |
| A1-f06 | gates/honesty | **P2** | Hard-DoD stall records no gate row → M5 "no red DoD gate records — nothing to hide" while the run is stalled on unmet criteria. |
| A1-f07 | emit/handover | **P2** | Emit refuses over any stale dir; `--force` keeps the foreign files (mixed tree); pre-clean exists only in run-eval. |
| A1-f08 | codegen/docs drift | **P3** | Comments claim P6 synthesis runs on pro tier; code requests/stamps flash (`P6_SYNTH_MODEL`, `codegen.server.ts:150`). |
| A1-f09 | create/console | **P2** | Console-created projects are never `enforceDod=true`; the "on by default when keyed" caption is false in-app. |

## Evidence base used

- Committed run evidence (read today): `research/eval-out/results.json` (generatedAt 2026-09-25T00:03:43Z; keyed row 3/9, `p6Refused:true`, `synthesisSucceeded:false`, `emitError: foreign files…`, M5 "no red DoD gate records"), `research/eval-out/history.json` (last keyed rows: 2026-09-24T19:49:11Z m1=1/m6=1/m7=1 mean 0.667; 2026-09-25T00:03:43Z mean 0.333), `research/eval-out/_keyed-run.log` (2026-09-10, 4/9, M1=1), `research/eval-out/run-in-progress.json` (`preflightClass:"balance-exhausted"`), stale emit tree `research/eval-out/coffeehouse2home-property-ledger/` (mtime Sep 24 14:48, incl. the `src/generated/get-property.ts` that tripped the refusal), `fixes/262_lane1_keyed_infra.md` (W23-L1 design + run #1–#3 context).
- Code read today (line-cited in each finding): engine.ts 1798-1935, 2845-2970, 3400-3454, 3641-3735, 3819-4033; dod.ts 255-450, 450-780, 779-875; codegen.server.ts 126-230, 463-560, 2511-2760, 2761-2900, 2991-3489; scaffold.ts 1320-1700, 2289-2428; headless.ts 350-600, 1560-1690, 1850-2190, 3755-3823; compile-check.server.ts header + spec-run region; store.ts 540-660, 1060-1130, 1160-1180; phases.ts full; llm/providers/deepseek.ts 42-443 (402→`RT_E_LLM_NO_BALANCE` present).

## Trace limits (honest)

- No keyed call was made (account unfunded) — A1-f01/f02/f03 are code traces, not funded observations; the last funded evidence is the 2026-09-24 keyed rows.
- The brief's `_step0_run*.log` files do not exist in the repo (`find . -iname '*step0*'` → only `src/lib/wild-step.test.ts`).
- `src/lib/gates.ts` does not exist (brief/Grep assumption); recorded so sibling lanes don't chase a phantom file.

## BOTTOM LINE

The factory core can emit LLM code **only through the eval/repair journey**; every other driver (Wild Mode, CLI `run`/`gate`, console) either cannot call the model at all (A1-f01) or cannot pass the P6 verification gate it is required to pass (A1-f02). And the verification evidence the product celebrates ("machine-verified / tested") is satisfied by load + identifier presence, not behaviour (A1-f03/f04) — while two honesty surfaces read cleaner than the run actually is (A1-f05/f06) and re-emits into an existing workspace either refuse or mix trees (A1-f07). Fixing f01+f02 is the precondition for THE MISSION; f03/f04 are the precondition for "GOOD code" being a measured claim.
