# W35 · FACTORY-PROCESS ANALYSIS — 5 lanes: find EVERY issue in how the factory, the agents, the delegation and the AI model work together; prep them as coder cards.
**Readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`). HEAD `0f85c32` + the W29–W35-in-flight era (L1–L3, P1–P3, A1–A2 may be landing beside you — re-read bytes; NEVER touch product code; no test runs; no builds; no keyed calls; log-and-continue).
**MISSION:** analyze YOUR slice of the software-factory process END-TO-END — how RapidTool actually works with the AI API model, how its agent/ delegation surfaces work, how the pipeline runs — and find **EVERY issue** (bugs, silent failures, mislabels, dead paths, bad writing, contract drift, gaps vs the mission "truly autonomous software factory / best-in-class harness"). For EACH issue produce a **coder card**: ① WHAT & WHERE (file:line, code quoted) · ② WHY IT'S WRONG (the failure mode — what breaks, when, for whom) · ③ HOW TO FIX (concrete steps, the seams, the contracts to respect, a mini sketch) · ④ DONE-WHEN (the exact proof a verifier runs) · ⑤ TRAPS (collisions/contracts/box rules). Be EXTENSIVE and SEQUENTIAL — think item by item through the real code; every claim byte-checked TODAY.
**RECORD:** `wave_plans/W35/factory-notes.md` — append-only via END-OF-FILE-MARKER-FACTORY; §F1–§F5 are yours; re-read before EVERY append. Lane logs `fixes/280_f<n>_factory.md` EARLY.
**READ FIRST (all lanes):** `START-HERE.md` · `finalsprint.md` · `research/multiagent/thoroughanalysis.md` (§W27-WORKLIST + §R1–R15) · the newest lane logs (`fixes/276_*`, `277_*`, `278_*`, `279_*` as they land) · `wave_plans/W34/prep.md` + `code-notes.md` (dedupe against them — cite, don't repeat).

## F1 — THE MODEL PATH (how RapidTool talks to the AI)
`src/lib/llm/**` (providers, registry, failover, cassette seam, streaming seam) · `codegen.server.ts`'s synthesis chain (prompts, chunking, `materializeImportableTree`, the CJS-residue guard, partial semantics) · the token ledger/budget (`token-ledger.ts`, `synthWithBackoff`) · `wild-review.ts` + the reviewer path · `deepseek.server.ts` facade · redaction · model-id routing. EVERY issue: is the right model asked for; is the answer validated; are failures coded; can a runaway spend happen; does the served-model honesty hold; do the refusals name the truth.

## F2 — THE AGENT + DELEGATION LAYER (how "agents" work with RapidTool)
The packet (`packet.ts` — the compiled Agent Packet RapidTool ships to downstream agents) · the agent-facing docs (`AGENTS.md`, `AGENT_GUIDE.md`, `START-HERE.md`, the crew/`crew.ts`, `subagent.ts` de-scope) · the HITL/seat/approval/policy chain (policy.ts, seats, the two-channel token) · the handoff (`handoff.ts`, `io.ts` export paths) · the ingest loop (`report-intake.ts`). EVERY issue: does the packet still describe the run truthfully; does the agent get what it needs; do the governance paths actually govern; where do the docs and the code disagree.

## F3 — THE PHASE PIPELINE (the factory floor)
`engine.ts` · `phases.ts` · `store.ts` · `dod.ts` · the drivers (`liveLayer`, `wildStep`, `runPhaseAsync/runPhase`, console driver) · the gates/mint/promote · the NEW `checkpoint.server.ts` + its integration (as it lands) · `runUntilGate`/`resume`. EVERY issue: any path that can silently no-op; any state that can be clobbered; any gate that can pass hollow; any driver that diverges from its siblings; the mint reachability story post-W-01/02.

## F4 — THE OUTPUT FACTORY (emit → artifact)
`scaffold.ts` (incl. the 4-kind block as L1 lands it) · `compile-check.server.ts` (treeRun/install/script execution) · `run-eval.mjs` (graders/acceptance/verification label) · `research/eval-corpus/**` · `tree-run` semantics · the emitted artifact's typecheck story (R3-f02/f03). EVERY issue: can a broken artifact pass; is the emitted tree honest; do the kinds work; do the graders grade the product.

## F5 — THE OPERATIONS LAYER (CLI · telemetry · diagnostics · the process itself)
`scripts/**` (every verb incl. resume/unattended as they land) · `rt-*` telemetry · `doctor.ts`/`diagnose.ts`/`error-scan` · `report-intake` edges · the error taxonomy + exit codes · the docs-as-process (README-cli parity, START-HERE) · the boundary process itself (gate.sh, the legs, the standing reds). EVERY issue: any verb that lies; any envelope that misreports; any diagnostic that reports zeros for unknown; any doc claim the bytes don't back.

## §Y1 — W37 LANE Y1 · THE MODEL-PATH LANDINGS (attribution `fixes/282_y1_model.md`)
_Appended by W39 Z2 (`fixes/287_z2_contracts.md`): Y1's owed §Y1 record never landed here — and N4's §F1–§F5 paste was still pending at this read — so this is the full record, not the delta-only form Y1's log conditioned on §F1 being live._

**Y1's landing list (each re-verified against the tree at the W39 Z2 read; line numbers = that read, post-Z2's own patch):**
- **FM-01 LANDED** — single-module synthesis materializes ESM at SYNTHESIS time (`materializeImportableTree` at `codegen.server.ts:3257`, the chunked-path seam mirrored); the emit-time residue guard (`headless.ts` `materializeEmitTree`) stays a backstop. Done-when met: a fresh single-file synthesis is ESM before emit.
- **FM-03 LANDED** — every bounded repair re-prompt meters spend (`accountRepairUsage`, markers `:956/:2481/:2506`; metered at `:3078/:3170/:3190/:3470/:3547`), and a stop is served as the coded `RT_E_BUDGET_EXHAUSTED` refusal, never model-failure prose. `TODO(FM-03b)` names the remaining terminal-threading item (`:959`).
- **FM-04 LANDED** — `modelRoute` derives from the SERVED model id (`modelRouteForServed` `:2758`; stamped at `:2836` (upgraded) / `:3602` (treeUpgraded) / `:3690` (partialTreeRefuse)), never the hardcoded constant. `TODO(FM-04b)` names the union-widening item (`:2755`).
- **FM-08 LANDED** — DATA FLOW + ERROR HANDLING render in both user-prompt builders behind non-empty gates (`codegen.server.ts`, markers `:1388/:1420`), so a spec without them keeps the legacy prompt bytes.
- **FM-05 / FM-12 (llm/providers) · FM-09 (reviewer) · FM-10 (token-ledger): NOT LANDED at this read** — no attribution markers in their target files (`src/lib/llm/**`, `token-ledger.ts`, `wild-review.ts`); carried forward (Y1's "window permitting" row).
- **Log-only per Y1's plan (outside the lane's box): FM-02** (rt-events/cli pins) · **FM-06 / FM-07** (prompt-engine/llm-tasks) · **FM-11** (OWNER/keys — the `RAPIDTOOL_PROVIDER=xai` refusal-by-construction note lives at `codegen.server.ts:2754-2756`).
- **Cross-file:** `src/lib/llm.ts:42` carries Y1's I2 contract note (a REFUSAL may still report usage — the result type reflects it).

## §F3 — THE PHASE PIPELINE (W35 lane F3) — appended 2026-09-27 by W40 K8 (N4 → Z4 payout)

**Status:** OWED SINCE W35 — the lane hit the tool-iteration cap **before writing**: `fixes/280_f3_factory_pipeline.md` never existed and **§F3 was not appended** ("⚠️ Honesty first … The cards below are the deliverable"). This block is the lane's analysis verbatim from its delegation summary (`~/AppData/Local/hermes/cache/delegation/subagent-summary-2-20260926_195114_772471.txt`), re-landed as the owed record. **Environment note (verbatim):** `src/lib/headless.ts` mtime advanced *during* the read (19:42:57, L2 landing beside it) — all anchors were byte-checked at that read; **re-verify headless.ts lines before fixing**. **Note:** F1's record lives in §Y1 above (Z2's append); F2's record was outside this payout's mandate — see the closing note.

### F3 · P0 — BLOCKING

**F3-01 · P0 · `headless.ts` imports a non-existent `readWildPlan` ⇒ every CLI verb dies at import.**
- `headless.ts:33` `readWildPlan,` inside the `import {…} from "./engine.ts"` block (`:25-40`); also unused `WildPlan` type (`:71`).
- Repo-wide proof: `grep -rn readWildPlan src/ scripts/` → only `headless.ts:33` + doc-comments `types.ts:163/:429`. `grep -n readWildPlan src/lib/engine.ts` → **0**. `store.ts` → 0.
- Node 22 type-stripping does no link-time checking of *unused* names, but **any** CLI verb dynamically imports headless (`rapidtool-cli.mjs:226/231`) → module link fails for all 37 verbs.
- **Fix:** land `export function readWildPlan(project: Project): WildPlan` in `engine.ts` (honest empty plan per `types.ts:163`: `rows:[]`, `source:"empty"`, note naming R13-f02) *or* drop the import. **Done-when:** `grep -n readWildPlan src/lib/engine.ts` ≥1 export; headless imports cleanly; typecheck has no TS2305. **Trap:** L2 in-flight — coordinate before editing.

**F3-02 · P0 · checkpoint writer's only call site is unreachable ⇒ `resume` is dead-on-arrival.**
- `headless.ts:640/707/714` (`commitRunCheckpoint`, the per-step call, clear-on-complete) — the **only** CLI `runUntilGate` caller is `scripts/rapidtool-cli.mjs:487`, which passes `{autopilot, live, maxSteps}` — **no `checkpointDir`**. `grep -n checkpointDir scripts/rapidtool-cli.mjs` → 0; repo-wide `checkpointDir` exists only in headless.ts.
- `checkpointAdmits` → **0 call sites**; no `case "resume"` (case count still 37).
- **Fix:** pass `checkpointDir` from the CLI (`dirname(--project)`) on `run`/`gate`; add the `resume` arm. **Done-when:** `grep -c 'case "'` = 38 incl. `resume`; `grep -n checkpointDir scripts/rapidtool-cli.mjs` ≥1.

### F3 · P1

**F3-03 · registry lie — `RT_E_CHECKPOINT_MISSING` documents a guard + path that don't exist.** `errors.ts:514-519` cites `<projectDir>/.rapidtool/checkpoints/` (plural) and "enable the writer's guard (`RAPIDTOOL_CHECKPOINT=1` + `RAPIDTOOL_CHECKPOINT_DIR`)". Bytes: `checkpoint.server.ts:40` path = `.rapidtool/checkpoint.json` (a file); `grep -rn RAPIDTOOL_CHECKPOINT src/ scripts/` → **only that doc line**. Fix: strike the env-guard sentence, correct the path.

**F3-04 · `run --unattended` documented, no arm.** `errors.ts:508-513` describes it; `grep -n unattended scripts/rapidtool-cli.mjs` → a comment at `:577` only. Fix: strike the claim (declare-or-strike) or land the arm.

**F3-05 · wild driver reports `stoppedReason: null` on honest stops.** `store.ts` startWildRun loop: `if (!cur.wildRun?.active) return { ok:true, ran, stoppedReason:null }` — siblings name `paused`/`complete`/`cap`. Fix: name the class.

**F3-06 · wild driver dual-channel violation.** `startWildRun` returns `{ ok:true, ran, stoppedReason:"paused", code: res.code }` — a machine `code` on `ok:true`, against repo rule 185-H1 ("ok:true never dual-channel") that headless/CLI honor (`"detail rides as note"`). Fix: move to `note`, keep codes only on `ok:false`.

**F3-07 · CLI `wild` arm flattens every failure to `RT_E_PHASE_ILLEGAL`, exit 1.** `rapidtool-cli.mjs` wild arm: `code:"RT_E_PHASE_ILLEGAL"` hard-coded for `res.ok===false`, always exit 1 — erases `RT_E_LLM_NOT_CONFIGURED` etc. and never emits 2 (parked) / 3 (not-configured) despite the doc taxonomy. Fix: thread `res.code ?? map(res.reason)`, use taxonomy exits.

**F3-08 · `runModuleReal` (store.ts:1391-1442) discards `out.project` on the `!out.ok` branch.** Success path commits the re-stamped project; the guard branch returns a generic "bounded runner unavailable or no generated module" and drops the project + the coded reason. Fix: return the coded `RT_E_RUNNER_UNAVAILABLE` and stop discarding state.

**F3-09 · `store.runP6Journey` still has ZERO console callers.** `grep -n runP6Journey src/components/console.tsx` → 0; console destructures only `executeAsync/runUntilHitlAsync/runModuleReal` (`console.tsx:1901-1903`). R1-f05 / W-38 stands: the console's only mint-reaching control does not exist. Fix: wire the RunControl (honest browser-refusal verbatim — browser can never mint, see F3-19).

**F3-10 · unguarded whole-project commit at `store.ts:1309` (the keepLiveWildRun class — the 174-1 fix holds at 5/6 sites, not this one).** In `executeAsync`'s `(next.gateDenied || next.dodBlocked) && next.project !== project` branch: `projects: s.projects.map((p) => (p.id === id ? next.project : p))` — a **raw** commit, no `rebaseUserFields`/`keepLiveWildRun`. Every sibling wraps (store.ts:891/922/970/1324/1379/1433/1649). A hard-DoD block or gate-denial during an async execute can clobber `name/notes/enforceDod/wildMode/chatLog/kind` and an in-flight `wildRun`. **Fix:** `keepLiveWildRun(rebaseUserFields(next.project, live), live)` inside the updater (the sync `:1219` twin is lower risk — no await). **Done-when:** a regression pin where a gateDenied execute lands mid-wild-run and both the operator note and `wildRun.active` survive.

### F3 · P2

**F3-11 · `checkpoint.server.ts` cap-drift + false parity comment.** `:29-36` claims caps are "kept identical to store.ts's salvageTrim" — but `salvageTrim` (`store.ts:735-748`) trims only `logs(200)`/`chatLog(40)`. `CHECKPOINT_CAPS` invents `artifacts:120, research:24` with no engine counterpart (engine `artifacts` is unbounded; `research` unbounded; `p7-research` gate reads `research.length > 0`). A resumed run can lose research/artifact rows a gate depends on. Fix: use real engine caps or state honestly that they're checkpoint-only bounds + that resume may re-run a trimmed phase.

**F3-12 · the resume gate never validates the phase ⇒ a phase-99 snapshot is admitted.** `writeCheckpoint:114` only `Number.isFinite(run.phase)` (accepts 3.7/99/-1); `isRunCheckpoint:94` only `typeof` (NaN passes); `checkpointAdmits:188-203` checks **only** projectId + mode — the module explicitly defers the 1..13 check to a caller that doesn't exist. A hand-edited checkpoint reads `ok:true` and resume re-enters at phase 99 → `applyPhaseResult` throws (`engine.ts:1378`). Fix: range/int check in `checkpointAdmits` (+ `s.step` finite-int).

**F3-13 · a resumed checkpoint is NEVER hydrated/validated.** `readCheckpoint` returns raw parsed JSON; `loadProject` runs `importProject` (validate+hydrate) but the resume path bypasses it. Junk rows/partial arrays flow straight into the engine. Fix: run the resumed project through `engine.hydrateProject` (+`repairPhases`) before re-entry.

**F3-14 · `commitRunCheckpoint` swallows the *coded* failure.** `headless.ts:642-646` catches and discards `writeCheckpoint`'s `{ok:false, code, error}` — the "coded" part lands nowhere: no log row, no event. A disk-full failure silently means "no resume" with zero trail, against the OV-13 record-every-degrade discipline. Fix: append a bounded warn row (`checkpoint.write.failed` + code/detail).

**F3-15 · `mode` probe divergence risk.** `runModeFor()` (`headless.ts:1963`) reads `process.env.DEEPSEEK_API_KEY` (trim) and claims parity with `engine.keyedDeepSeekConfigured()` (`engine.ts:1820` — same read ✔) **and** `p6JourneyIsKeyed()` (`headless.ts:1946` → `deepseek.server.isDeepSeekConfigured`). If the server probe ever diverges (base-url/provider routing), a checkpoint is stamped with the wrong mode ⇒ wrong admit/refuse. Fix: one shared probe; **verify `deepseek.server.isDeepSeekConfigured`** (not read — out of iterations).

**F3-16 · `p6-verified` can pass hollow.** `dod.ts:583-600` accepts any `label:"tested"` + non-empty `evidenceHash`. The tree-run mint's hash is `fnv1a(summary)` over **prose counts** (`codegen.server.ts:3528`, `treeRunTestedEvidence:3470-3485` = "compile N/M · K specs · J assertions") — no tree bytes, no spec names; two different products with equal counts mint the same hash. And `executed` (`:3484`) is satisfied by one trivial passing assertion. Fix: hash the tree bytes + spec file names into the evidence digest. **Reachability (asked):** reachable keyed from CLI `run/gate --live` (`headless.runPhase:380` → `runP6Edge`) and from wild (`engine.ts:4048-4050`, keyed only) and console-node (`runPhaseAsync:3420` → `viaHeadlessP6Edge`); **never** in-browser (`keyedDeepSeekConfigured` is `process.env`-based and vite has no client `define`). Honest, but the UI must say so (F3-09).

**F3-17 · `runPhase` phase-6 bypasses the rest of `liveLayer`'s P6 work.** `headless.ts:380` routes phase-6 live straight to `runP6Edge` and **never** calls `liveLayer(project,6)`, so `upgradeP6Keyed` + `stampP6ReqTrace` (the liveLayer P6 branch, `engine.ts:2916-2928`) reach run/gate **only** via `driveP6Journey`'s default synthesize. Parity holds today by construction; any future liveLayer-P6 stamp silently won't reach run/gate/wild. Fix: comment the coupling or funnel through one seam.

**F3-18 · journey-gate vs finishPhase-gate verdict divergence.** `driveP6Journey:2258` records via `recordGateInto`, which **no-ops unless `rec.status==="complete"`** (`dod.ts:870`) ⇒ on an `awaiting_hitl`/`running` record the journey returns `failed` with `gate:null`; `runReady`→`finishPhase` then records a *fresh* verdict on the same project. Two evidence hashes for one phase. Note/decide explicitly in the landing log.

**F3-19 · positional phase indexing survives at 2 store sites.** `store.ts:436` + `:626` `project.phases[phase]` — against the repo's own id-indexed discipline (`phases.ts:141-144` "Index by record id, not array position (A20)"; `phaseCoverage:202`). Low risk (hydrated projects are sorted/complete) but the exact latent class A20 exists to kill. Fix: `.find(p => p.id === phase)`.

**F3-20 · `phases.ts:226` `PHASES[coverage.tailStart]`** assumes index==id; `phases.ts:150 HITL_PHASES` export consumption unverified.

### F3 · VERIFIED HOLDING (no card)

`keepLiveWildRun` at 5/6+ sites ✔ (F3-10 is the exception) · `repairPhases`/`hydrateProject` id-matching ✔ · `recordGateInto` id-lookup ✔ · `runP6Edge` keyless→floor byte-parity ✔ (`headless.ts:2359-2362`) · keyed P6 seam reachable on run/gate/wild ✔ post-W-01/02 · `mintTreeRunTested` self-guards (`ok===true` + `executed`) ✔ (hollow-able only per F3-16) · browser genuinely cannot mint ✔.

## §F4 — THE OUTPUT FACTORY (W35 lane F4) — appended 2026-09-27 by W40 K8 (N4 → Z4 payout)

**Status:** OWED SINCE W35 — "the required writes did NOT complete. `fixes/280_f4_factory_output.md` — created but still a skeleton; **§F4 — NOT appended**. The analysis below is **unrecorded** and must be re-committed" — verbatim honesty line from the lane's summary (`~/AppData/Local/hermes/cache/delegation/subagent-summary-3-20260926_195114_773501.txt`). This block is that analysis, re-landed as the owed record. All items byte-checked at lane time; re-verify before fixing (L1 was landing in `scaffold.ts`).

### F4 · A. Can a broken artifact pass acceptance? YES — on two independent channels
1. `run-eval.mjs:2083-2089` `passesAcceptance` = `mean ≥ passWhen.meanAtLeast` ∧ `filesOk` ∧ `contentOk`. All 7 graders (`research/eval-corpus/graders/*.json`) carry the *identical* bar: `expectedFiles:[package.json,index.html,README.md]`, `expectedContent:[{package.json, contains:'"test"'}]`. The scaffold **always** emits all three and always declares `test` when oracle rows exist (`scaffold.ts:2845` + `PKG_SCRIPTS`) ⇒ the gate is satisfied by any emission and never inspects generated code.
2. `scaffold.ts:1667-1671` (emitted oracle `tree-job` row) calls one export inside `try{…}catch(e){ if (e instanceof ReferenceError) throw e; }` — every other throw is swallowed by design ⇒ a tree whose functions all `throw` passes treeRun → mint `lastTest:"tested"` → `p6-verified`. `capability.N` rows are pure text-presence (`scaffold.ts:1734-1744`).
3. **`meanAtLeast: 1` + `m7Learning` returns 0 with no prior (`maker-score.ts:567-570`) ⇒ `mean ≥ 1` is unreachable on a slug's FIRST run** (max 8/9 = 0.8889). No first run of any fixture can ever `pass` acceptance. Structural contradiction between the grader threshold and the rubric.

### F4 · B. The graders don't grade the product
4. Behavioral channel has **zero suppliers**: `m1Substance`/`m2Runs` read `input.behavioral` (`maker-score.ts:336-345,409-420`) but `scoreMaker` is never passed it (`run-eval.mjs:1942-1960`) — M1/M2 always take the stem/path branch.
5. `requiredIdentifiers` is **never scored**: `scoringCorpusFor` maps it to `expectedNouns` (`run-eval.mjs:401-408`) and `m1Substance` reads only `expectedCapabilities`. Recorded in the row (`grader.requiredIdentifiers.length`) but never asserted.
6. `capabilityCoverage` matches against **file paths too** (`maker-score.ts:305-310`) ⇒ a file *named* `rentRoll.ts` "covers" the rent-roll capability with zero implementation.
7. `index.html` is demanded of **every** kind, but only webapp/game emit it (`scaffold.ts:2852-2857`) ⇒ a cli-tool/library/service run can never satisfy `requireExpectedFiles`.

### F4 · C. Artifact honesty / emission byte-stability
8. **`moduleEmbedded` is a false-negative post-W-03**: `headless.ts:1778` tests emitted bodies against `emitProjectInput.generatedSource`, but `materializeEmitTree` (`headless.ts:1660-1679`) replaces both tree and `generatedSource` — a real tree-mode emit can still report `moduleEmbedded:false`, surfaced at `rapidtool-cli.mjs:913` and documented at `scripts/README-cli.md:355`. No consumer/test pins it.
9. **Walk-set asymmetry leaks the scratch dir**: `EMIT_SKIP_DIRS = {node_modules,.git,.vercel}` (`headless.ts:1503`) vs emitted `.gitignore` ignoring `node_modules/ dist/ .rapidtool/logs/` (`scaffold.ts:644-650`). After a verify run, `dist/**` becomes FOREIGN ⇒ `RT_E_FOREIGN_FILES` refusal, and `tests/**` misc → silently **deleted as ghosts** (`:1737,1770-1777`). The eval driver documents this exact class (`run-eval.mjs:819-822`).
10. `--force` keeps foreign files and the tree-run then judges a mixed tree (`headless.ts:1739-1746,1786`).
11. `graderLeakScan` bounds at 500 files / 512 KB (`run-eval.mjs:823-824`) ⇒ `leaked:false` can mean **not scanned**; the record does not distinguish.
12. `llmEvidenceFromCallRecords`: `records.length === 0` with the tap *installed* still records `usage:{0,0,0}` + `estimatedCostUsd:0` (`run-eval.mjs:701-716`) — null-out is only applied by the caller when the tap is *uninstalled* (`:1904-1906`).
13. `run-eval` crash handler **overwrites** `results.json` and exits 0 (`:2787-2799`) — the file is neither the prior run nor a real result; keyless runs write no marker, so a keyless kill leaves a stale `results.json` with no signal (the exact misread the keyed marker exists to prevent).

### F4 · D. Semantics/pipeline
14. `deliveryKindOf` maps `library`/`service` → `undefined` (`run-eval.mjs:1699-1712`) ⇒ those corpus kinds are driven down the single-module *library* path — latent for R7-f04's planned fixtures.
15. `priorFor` returns the **last trial row** of the previous run, not the case mean (`:428-434`) — M7 compares against one trial.
16. Partial synthesis (R3-f03): at the final read, `scaffold.ts:129-153` has the **types** (`redTree?`, `partial?`, `uiGeneration?`) but **no implementation** — no `trailVerdictOf`, no `defaultUiGeneration`, no `capability.N` skip-with-reason. `partialTreeRefuse` still never nulls `lastTest`.
17. **W-07 not landed**: `codegen.server.ts:486,503` still mandates "TypeScript-style **CommonJS**" + "Assign module.exports" while the emitted tsconfig is `"type":"module"` + `strict:true` (`scaffold.ts:650,691-711`) ⇒ the shipped artifact's own `npm run typecheck` stays red (partially offset by W-03 materialization).

### F4 · E. In-flight L1 state at the lane's last read (`scaffold.ts` md5 `d62cdc20…`, 3039 lines, 19:48)
18. `packageJson` now declares `bin:{<slug>:"bin/<slug>.mjs"}` / `main`/`exports`/`files` for cli-tool/library/service (`:672-687`) and `start` (`:638`) — but at that read `emitKindEntry`/`emitBinLauncher` were **defined and never called** from `scaffoldProject` (no `push` for `src/main.ts` for those kinds, none for `bin/`), and `emitViteConfig` was still invoked with zero args at `:2855` while its new signature is `emitViteConfig(kind)`. If L1 does not finish, the emitted non-webapp trees declare entries that do not exist on disk. **Re-verify the call sites before treating L1 as landed.**

### F4 · F. Verified-improved (do not re-file as open)
19. R11-f02 largely landed: `installToolFor` now carries `--ignore-scripts` (`compile-check.server.ts:1323,1329`); the argv-only script plan + `scriptPolicy` verdict field are in place (`:524-678,977-1012`); R12-f03's `node_modules` copy is replaced by a junction (`:1109-1118`). **New sub-issue:** the junction points the run copy at the *subject's* `node_modules`, so a declared script that writes there mutates the subject; and a junction-creation failure degrades silently to the skip note.

## §F5 — THE OPERATIONS LAYER (W35 lane F5) — appended 2026-09-27 by W40 K8 (N4 → Z4 payout)

**Status:** OWED SINCE W35 — "analysis is complete and byte-checked, but I hit the iteration cap **before the two record files were updated** … §F5 was **not appended**" — verbatim from the lane's summary (`~/AppData/Local/hermes/cache/delegation/subagent-summary-4-20260926_195114_775540.txt`). This block is its findings, re-landed as the owed record.

### F5 · P0 — bugs verified against bytes
**OPS-1 · `fixtures` returns an envelope with no `exit_code` (2 sites).** `scripts/rapidtool-cli.mjs:1030` (`--draft`) and `:1108` (`--approve`) call `respond({…})` with **one argument**; `respond` then sets `out.exit_code = undefined` → `JSON.stringify` drops the key entirely (`:146`). Verified with a TypeScript-AST scan: **177 `respond` calls, exactly 2 with 1 arg**. This is the verb whose policy-gated approval is the lane's contract; every test helper (`cliJson` in `rapidtool-cli-lesson.test.mjs:83`) asserts `typeof out.json.exit_code === "number"`.
**OPS-2 · `fixtures` has zero CLI test coverage.** `grep -rn "fixtures" src/lib/headless.test.ts scripts/rapidtool-cli-{edit,lesson}.test.mjs` = 0 hits → OPS-1 could never be caught, and neither can its Track-1 seat refusals.
**OPS-3 · The CLI cites a guard that does not exist.** `:600-605`/`:1562-1567` state the same-env-both-sides degeneracy "is statically forbidden by `scripts/cli-exit-taxonomy.test.mjs`" — that file is **not on disk** (`ls scripts/` = 43 files, none by that name). An unenforced claim inside the product.
**OPS-4 · `cliLogEvent` mints events its own catalogue forbids.** `:156` emits `cli.${CMD}.ok` / `cli.${CMD}.exit` on scope `cli-command`; `RT_EVENT_NAMES` (`rt-events.ts:124-198`) has only `cli.invocation` (cli-command) and `cli.error` (**cli-log**). `isKnownRtEvent` is never consulted at the appender — the catalogue's "call sites must NOT invent free-form event strings" is unenforced, and **the CLI's dominant telemetry event name fails it**. `cli.invocation` is catalogued and never emitted.

### F5 · P1 — drift / silent degradation
- **OPS-5** `gate.sh` is now a **six-leg** gate (typecheck/lint/assertionGaps/testsScripts/testsLib/build) but AGENTS.md:53,101 still call it "the four-gate stability script"/"the four gates". Doc-vs-bytes.
- **OPS-6** AGENTS.md:50 "**35 verbs** dispatched today" — `grep -c 'case "'` = **37** (START-HERE:28/91, README.md:9/89/110 are right). The repo working contract is stale.
- **OPS-7** START-HERE.md:26 "`src/lib/` (191 files)" → actual **196**; :29 "`scripts/` (40)" → actual **43**.
- **OPS-8** `doctor` computes and **discards** data: `doctorFactory` returns `spend` (OV-41) but `DoctorStatus`/`doctorStatus` never carries it (`headless.ts:3390-3414`, `doctor.ts:275-302`).
- **OPS-9** `diagnose` misorders its own evidence: `readRtTail` returns **newest-first** (`runtime-log.server.ts:159`); the CLI feeds `rows.slice(-50)` as a timeline and `rows.filter(...)` as `errors` while `DiagnosisInput` documents errors as **oldest-first** and `buildDiagnosis`'s evidence row indices assume that order (`diagnose.ts:81`). The timeline is reported inverted.
- **OPS-10** `diagnose` hardcodes `watchdog` to nulls (`:3303-3309`) although the same read already holds heartbeat/`sys.*` rows; and duplicates budget constants as literals `255_000/60_000` with a "keep in sync" comment while `diagnose.ts` already imports `WILD_STEP_BUDGET_MS`/`CHAT_STEP_BUDGET_MS` (equal today).
- **OPS-11** `readRtTail` claims "read at most the last 256 KB" but calls `readFileSync(file)` on the **whole** file, then character-slices (`:139-140`) — a 5 MB rotated log is fully allocated per `diagnose`.
- **OPS-12** `tree-run --project` swallows every `importTreeDir` error with `catch { /* advisory only */ }` (`:1305-1307`) — an unreadable/broken ledger yields no `dirDirty` **and no note**.
- **OPS-13** `classifyError` passes through any `^RT_E_` string (`errors.ts:230`), and the CLI's `safe()` guard only shape-tests (`/^RT_E_[A-Z0-9_]+$/`), so an envelope can carry a code with **no `ERROR_CODE_DOC` entry**; `diagnose`'s `codes` map then silently omits it. Registry↔doc parity is pinned by `errors.test.ts`; envelope-side is not.
- **OPS-14** **No `resume`/`unattended` verb exists** on disk (grep = only `wild --resume`), yet `errors.ts:508-519` documents `RT_E_UNATTENDED_UNSUPPORTED`/`RT_E_CHECKPOINT_MISSING` as reachable refusals and the docs never mention them.
- **OPS-15 · Standing-red list is STALE on bytes.** The three `rapidtool-cli-edit.test.mjs` cases (non-TTY `--i-am-human`: `:317` and `:340` expect `j.policy.decision === "deny"`, `:412` expects `status 0`) are still pre-Track-1 and cannot pass — the two-channel refusal fires in `humanSeatClaim` **before** the seam, so `j.policy` is undefined. But both E-25 pins in `headless.test.ts` **are already re-pointed** (`:1608` asserts refusal; the `:1753` block now asserts `ap.code === 1` + no ledger row), so the "headless 96/94/2 @19:11:42" count predates L3's landing and should not be repeated as current.

### F5 · P2 — docs-as-process
- **OPS-16** README-cli.md:826-828 shows a wild envelope with `ok: true` **and** `error: "…"` — the dual-channel shape the same file's 185-H1 rule and the arm (`note`) forbid.
- **OPS-17** README-cli.md §Vault/§Design/§Agent-contract claim a missing module → **exit 1**; a missing dynamic import throws → outer catch → **exit 4**.
- **OPS-18** README-cli.md:483 says "no `verifyKind` seam on disk" — false: `verifyKindDir` is at `compile-check.server.ts:1566` and the CLI calls it (`:938`). Its `rapidtool-cli.mjs:768` pointer now lands on `case "packet"`.
- **OPS-19** README-cli.md §The `approve` seat documents only Channel A (env token); the documented positive example can never succeed post-Track-1.
- **OPS-20** `reject`'s 12-character minimum (`:668-677`) is undocumented; USAGE's `emit` line omits `--verify-kind` and `--force`.
- **OPS-21** `docs-module-parity.mjs`'s `DOCS` list omits **START-HERE.md** — the doc carrying the file-count claims that just drifted (OPS-7).

### F3/F4/F5 · CLOSING NOTE (K8, 2026-09-27)

- **F1's record = §Y1 above** (Z2's append, verified in WD-2's claim-check) — not duplicated here.
- **F2's record was NOT in this payout's mandate and remains owed** at K8 write; its source summaries are on disk (`~/AppData/Local/hermes/cache/delegation/subagent-summary-0-20260926_195114_767464.txt` / `-1-…767464.txt`). Re-check bytes before pasting if taken up.
<!-- END-OF-FILE-MARKER-FACTORY · every lane appends ABOVE this line · never edit or delete this line -->
