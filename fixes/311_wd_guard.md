# fixes/311_wd_guard.md — GUARD-WATCHDOG report · batch `deleg_4b86736f`

**Role:** guard-watchdog over the 4 auditors (DA1 · DA2 · SE1 · SE2). **Scope:** live monitoring + independent byte spot-checks + NO-LOSS rescue + merge-coverage. No product edits; no keyed calls.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · HEAD `b3161da` · batch ran 16:02:42 → ~16:12 (2026-09-29).
**Raw finals (authoritative, full text):** Hermes `~/AppData/Local/hermes/state.db` → messages `DA1 #112344` · `DA2 #112470` · `SE1 #112164` · `SE2 #112410` (sessions `20260929_160242_{d78873, a6fdb2, 8da8aa, 559ef9}`).

---

## 0 · EXECUTIVE — READ FIRST

1. **ALL FOUR AUDITORS HIT THE ITERATION CAP at write-time (16:08–16:12) — but all four deliverables have SINCE LANDED.** They were absent when each task ended; at **16:16 the parent pasted each final summary verbatim into its file** (`fixes/311_da1_claims.md` 4,719B · `311_da2_data.md` 8,329B · `311_se1_pipeline.md` 7,336B · `311_se2_surfaces.md` 14,318B — each headed "RESCUED from the auditor's final summary"). Watchdog **read & diff-verified all four against the `state.db` finals at 16:17: complete, nothing dropped.** The digest sections below (§3) are the WD's independent rescue/insurance layer; **nothing is summary-only** (see §5). Cosmetic: the pasted files still contain stale self-references ("was never created / deliverable missing") — parent may tidy.
2. **Audit-only honored by all four** — scratch writes only; `git status` shows zero product modifications from this batch (untracked only: `fixes/311_wd_guard.md`, the four `fixes/311_*` deliverables (parent paste), `wave_plans/W43/`, + other-batch files `fixes/311_ui_shots/`, `probe_311_shots.mjs`).
3. **Spot-checks: 17 independent checks — 16 VERIFIED, 1 VERIFIED-with-time-drift, 0 WRONG, 0 UNSUPPORTED** (§2). The batch's headline findings (browser wild-arm hang, `meanAtLeast` unreachability, park catalogue, P6/P7 early-returns) all survived byte re-verification.
4. **Merge coverage:** F1 ✅ · F2 ✅ · F3 ✅ · F4 ✅ · **F5 PARTIAL (cron T5.2 uncovered)** · F6 ✅ · **F7 ❌ NO COVERAGE** (§4).

---

## 1 · MONITORING LOG (sweeps)

All four transcripts live-monitored; all four tasks **completed by ~16:12** (each terminated by the iteration cap, not by choice).

| Sweep | Time | task-0 DA1 | task-1 DA2 | task-2 SE1 | task-3 SE2 |
|---|---|---|---|---|---|
| s0 | 16:06:35 | 24,241B live | 29,446B live | 36,187B live | 37,908B live |
| s1 | 16:10:39 | 40,715B; **done 16:09:44 (cap)** | 45,091B live | 40,387B; **done 16:08:07 (cap)** | 43,950B live |
| s2 | 16:12:30 | 40,813B final | 49,368B final; **done ~16:12 (cap)** | 40,485B final | 44,530B final; **done ~16:12 (cap)** |
| s3 | 16:16:00 | **frozen** md5 `b9f34cfa24` | **frozen** md5 `3be43b3e1e` | **frozen** md5 `a8d4df3ce4` | **frozen** md5 `621b9fd00d` |
| s4 | 16:16:38 | frozen | frozen | frozen | frozen | **4/4 deliverables LANDED 16:16** (parent paste of the finals; 4,719 / 8,329 / 7,336 / 14,318 B); WD diff-verified complete @16:17 |

Hash-stable across ≥3 min apart reads ⇒ sessions truly ended. **The audit-run defect to fix next time: 4/4 iteration-cap deaths before the write step** — these tasks need the file-write reserved up front (or a longer cap).

---

## 2 · ACCURACY SPOT-CHECKS (independent, against bytes)

| # | Auditor | Claim checked | Method (re-run) | Verdict |
|---|---|---|---|---|
| 1 | DA1 | `store.ts:1231` = `for (let step = 0; step < 20; step++)` | grep src/lib/store.ts | **VERIFIED** (verbatim @1231) |
| 2 | DA1 | expandBrief = 3 attempts (`P6_EXPAND_MAX_ATTEMPTS`), synth = 2 | grep codegen.server.ts | **VERIFIED** (`=3` @2429, `=2` @2468 — the "2 attempts" sub-claim is indeed wrong) |
| 3 | DA1 | `headless.ts:500` routes P6 → `runP6Edge`; `engine.ts:1474` green-seal gate | grep/read | **VERIFIED** (both, verbatim) |
| 4 | DA1 | "28KB checkpoint" exists | stat `~/b4_scratch/.rapidtool/checkpoint.json` = **28,181B**; DA1's own fresh one later superseded (now 39,989B @16:09:09, p2 advanced) | **VERIFIED** (time-drift noted) |
| 5 | DA2 | history.json = 40 rows / 10 keyed / 30 keyless; last row 2026-09-25T00:03:43Z | python json read | **VERIFIED** (exact) |
| 6 | DA2 | `run-in-progress.json`: keyed, done, `balance-exhausted`, meanOfNine 2.9997, `retrace-first` | python json read | **VERIFIED** (exact) |
| 7 | DA2 | results.json: `generatedAt 2026-09-25T00:03:43Z`; summary.meanTotal 0.3333; acceptance passReason "mean 0.3333 < 1 …" | python json read | **VERIFIED** (exact) |
| 8 | DA2 | 11/11 graders carry `"meanAtLeast": 1` | grep `research/eval-corpus/graders/*.json` | **VERIFIED** (11 files, value 1) |
| 9 | DA2 | `run-eval.mjs` never imports `rt-events` (diagnose blind spot) | grep -c = 0 | **VERIFIED** |
| 10 | DA2 | 9/9 artifact discredited by `fixes/154_f1.md:62-79` | read fixes/154_f1.md | **VERIFIED** (9/9 + `RT_E_LLM_REJECTED` context @8-10, table @72) |
| 11 | SE1 | `engine.ts:3946` `gate.forceHuman` park site | read 3934-3955 | **VERIFIED** (verbatim + R3/B-03 comment) |
| 12 | SE1 | `phases.ts:151` `STOCK_HITL = [4, 5, 8, 9]` | read | **VERIFIED** (verbatim) |
| 13 | SE1 | `headless.ts:533-547` canAutopilot (forceHuman/STOCK_HITL/DoD/tightness<7.2) | read | **VERIFIED** (all clauses @535/:536/:544-545/:546) |
| 14 | SE1 | store cap 20 + wild latch release | grep store.ts | **VERIFIED** (`releaseWildStart` @1296; "blocks startWildRun … until reload" @1868) |
| 15 | SE2 | Browser wild: `wild-review.ts:70-80` host-guard → null; `store.ts:1229-1240` no reviewer; `engine.ts:4332-4334` `clientSafeServerSpecifier("wild-mode")`; import-protection denies `**/*.server.*` | reads + grep defaults.js | **VERIFIED** (all four; deny rule @defaults.js:17) |
| 16 | SE2 | Mock arm = never-settling thenable (hang) | replicated `virtualModules.js:75-82` traps in Node (`~/wd_mockcheck.mjs`); `await proxy` under `timeout -k 2 5` | **VERIFIED — EXIT=124, never settled** (mechanism real) |
| 17 | SE2 | `token-ledger.ts:145-154` strict `^\d+$` cap parse; junk spelling ⇒ unmetered | read | **VERIFIED** (verbatim @151) |

Any claim caught wrong: **none material**; one sub-claim falsified by DA1 itself (expandBrief 3≠2) — survived my re-check, so DA1's correction is trustworthy. SE2's own flagged unverified hinge stays flagged (§3-SE2).

---

### 3 · RESCUES / DIGEST — every finding (all 4 deliverables were summary-only until the 16:16 parent paste; sections below diff-verified against the landed files)

### 3·DA1 — the 10-claim truth-table (parent-report claims vs today's bytes) · severity mix H/M

HEAD confirmed `b3161da`. Truth-table verbatim-condensed:

| # | Claim | Verdict | Evidence (key cites) | Sev |
|---|---|---|---|---|
| 1 | Keyless e2e + 28KB checkpoint + NDJSON | **PARTIAL** | Fresh create exit 0; `.rapidtool/logs/rapidtool.ndjson` written; checkpoint ≈28KB keyless; 2nd brief advanced P0→P4 then parked (stock HITL); 39 `case "` CLI verbs. Full 13-phase seal NOT driven | M |
| 2 | Autonomy spine W-01/W-02/green-seal @`engine.ts:1474` | **TRUE** | `engine.ts:1474` "GREEN-SEAL GATE: a RED seal never mints a lesson row" (red @1486-1517 → log, no row); W-01 `engine.ts:4416`; W-02 `headless.ts:500`→`:2563`→`driveP6Journey` | — |
| 3 | p6.repair.delta/refused + per-row attempts; **expandBrief "2 attempts"** | **PARTIAL — sub-claim FALSE** | delta @`codegen.server.ts:777-788`, refusal @:790-801, per-row `attempt` @:1866; **expandBrief = 3 attempts** (`:2429`), backoff 500/1000ms; synthesis = 2 (`:2468`) | M (claim correction) |
| 4 | `step < 20` @store.ts:1231 | **TRUE** | verbatim | — |
| 5 | Guards: 20+ throws, reclaimable locks, byte-parity, real entry-runs | **PARTIAL** | commit-message evidence only (`1af7f88`, `b3161da`, `4af061a`); probes not re-run | L |
| 6 | 2649 tests / 0 fail / typecheck 0 / lint 0 / build 0 | **UNVERIFIED (honest gap)** | not run by the auditor | M (for merge: needs a gates run) |
| 7 | "No structural blocker remains" | **AGAINST found** | (a) `headless.ts:533-547` canAutopilot: `forceHuman` or STOCK_HITL=[4,5,8,9] never machine-approvable; reframe brief → `forceHuman:true` ⇒ P0 park; non-TTY `approve --force` → `RT_E_VALIDATION` exit 1. (b) Newest keyed run 09-25 = 3/9, `balance-exhausted`, "all synthesis calls refused"; M6 0 foreign files | **H** |
| 8 | "Funded keyed run never happened post-overhaul" | **TRUE (caveat)** | history n=40 = 10 keyed/30 keyless; keyed 09-08×2, 09-09×2, 09-10×2, 09-24×2 (5/9, 6/9), 09-25 (3/9); `results.json` @09-25T00:03:43Z; `run-in-progress` 09-25 `retrace-first`; overhaul = `220_overhaul_plan.md` (09-24); **no keyed run after 09-25**; "never" too strong — keyed runs occurred at overhaul onset | M |
| 9 | No iterate-until-satisfaction driver | **TRUE** | nearest = bounded tree-run repair `headless.ts:2576-2587` (budget 3) + `synthWithBackoff` (2) — keyed on tree-run failure, not score | — |
| 10 | No self-modification loop | **TRUE (as searched)** | write paths restricted: `REPAIR_TREE_ALLOWED_ROOTS` `headless.ts:2592-2600`; `emit` targets `<home>/RapidTool Software/<slug>/`; `edit --write` gated by `evaluatePolicy("repair.apply")` — writes emitted dir, never harness repo. Exhaustive write-path grep NOT done | M (gap) |

DA1 honest gaps: gates not run (#6), probes not re-run (#5), full seal not achieved (#1), write-path grep incomplete (#10).

### 3·DA2 — history table + newest-run evidence + meanAtLeast verdict · severity H

**THE RUN TABLE — 40 rows / 13 batches (`research/eval-out/history.json`, complete):**

| Batch | UTC | key | slugs | total | acc | mint |
|---|---|---|---|---|---|---|
| 1-6 | 09-08 13:38 | keyless | L,F,H,C,R,S | 4/9 ×6 | unscored | no |
| 7-9 | 09-08→09-09 | keyed | L | 6/9 ×3 | unscored | no |
| **10-11** | **09-09 00:59 / 02:16** | **keyed** | **L** | **9/9 ×2 — ARTIFACTS (discredited)** | unscored(mean=1) | "YES" ← artifact |
| 12-17 | 09-10 05:29 | keyless | all 6 | 5/9–6/9 | unscored | no |
| 18-19 | 09-10 05:46/06:05 | keyed | L | 6/9, 4/9 | unscored | no |
| 20-25 | 09-17 02:41 | keyless | all 6 | 3/9–6/9 | fail | no |
| 26-37 | 09-17 02:49 | keyless | all 6 ×2 trials | 6/9 ×12 | fail | no |
| 38-39 | 09-24 19:43/19:49 | keyed | L | 5/9, 6/9 | fail | no |
| **40** | **09-25 00:03:43 ← NEWEST** | **keyed** | **L** | **3/9** | fail | no |

- 30 keyless / 10 keyed. **Keyless band wins: M1 0, M2 22, M3 0, M4 0**, M5 30, M6 28, M7 21, M8 30, M9 30 ⇒ **keyless ceiling 6/9** (M1/M3/M4 never fire). Keyed: M1 6, M2 6, M3 2, M4 2, M5 10, M6 8, M7 8, M8 10, M9 8.
- **The two 9/9s are discredited artifacts** — `fixes/154_direction.md` + `154_f1.md:62-79`: carded 9/9 while every synthesis call refused (`RT_E_LLM_REJECTED`), tree = 1-file deterministic floor; post-fix re-cards **5/9**. **No valid high-score sample exists.**
- **NEWEST-RUN (09-25T00:03:43Z) evidence:** marker keyed/done/`balance-exhausted`/meanOfNine 2.9997/`retrace-first`; results entry mean 0.3333, M1-M4=0 with the refusal sentinel, M6 0 (emit refused: foreign file `src/generated/get-property.ts`), **M7 0 (regression vs prior)**, total 3/9, status `dod`, `journey:"failed"`, `stopCode:"RT_E_GATE_PENDING"`, stall "P6 DoD unmet — p6-verified, p6-brief-fit", `p6Refused:true`; acceptance fail "mean 0.3333 < 1"; CLI `eval` scorecard: endClass **absent 1** (results predate the key), pass 0/fail 1; **CLI `diagnose` sees NOTHING (0 errors) — `run-eval.mjs` imports no `rt-events` ⇒ eval runs write no telemetry; diagnose can never audit an eval run**; mint ground truth: no mint field in history; 19 surviving emitted `project.json`s have `lastTest {ok:true,"tests.pass"}` and **zero** `tested` labels (the old mint came from pre-20:13 code over the floor tree; surviving `mintTreeRunTested` @`codegen.server.ts:3766` self-guards).
- **`meanAtLeast:F4#3` REACHABILITY: CONFIRMED STRUCTURAL (stronger than the card).** All 11 graders pin `passWhen:{meanAtLeast:1, requireExpectedFiles, requireExpectedContent}`; consumer `passesAcceptance` @`run-eval.mjs:2596-2630`; `mean=total/9`. Two independent floors: (1) **first run of any slug** → M7=0 ("no prior same-domain run — no learning claim without data", `maker-score.ts:566-584`) ⇒ ceiling 8/9; (2) **any keyless run** → M1/M3/M4=0⇒ ceiling 6/9. ⇒ **`acceptance.pass` unachievable on a first funded run and on any keyless run; no honest pass on record.** Not a loosening candidate (`wave_plans/W42/SPEC.md:83` pins "record-don't-fix"; remedies = F4#7 per-kind expectedFiles or M7 semantics — out of scope). **Cross-ref correction:** `296_q4_output.md`/`308_map*` are dead sources; real sources = `W35/factory-notes.md:102`, `W42/SPEC.md:83/196/227/403`, `216q:149`, `255:14`, `256:80`, `257:67`, `292:13`, `303:42`, `304:28`.
- DA2 caveats: results.json stale vs HEAD (pre-endClass); no keyed run since 09-25 (wallet 402 balance-exhausted); artifacts held in `C:\Users\mnril\da2_scratch\` (`eval-scorecard.json`, `diagnose-root/-project.json`, `table.md`, `batches.md`).

### 3·SE1 — "no structural blocker" FALSIFIED · severity H

**Wiring CONFIRMED complete; the claim is FALSIFIED for three code-shaped paths** (all policy/DoD-shaped, hence they read as "no blocker"):

**Park catalogue (`engine.ts` wildStep 4213-4472):**

| Park site | Condition | Keyed clears? |
|---|---|---|
| `3946` `gate.forceHuman` | P0 reframe / P6 failed sandbox — HUMAN-ONLY | **NO** |
| `3957` unconfigured-gate | classifier absent + open gate | yes (keyed) |
| `3967`/`4037` classifier error | LLM error / feedback <12 chars | retry only |
| `3972`/`4042` reject | classifier rejects | **NO — parks** |
| `3995-4008` / `4053-4065` DoD red | `enforceDod` && gate red | NO |
| `4070` illegal advance | priors unsealed / canEnter false | NO |
| `4306/4356/4365/4387/4441` | blocked/locked/rejected/unsealed/throw | NO |
| `store.ts:1269` | 20-iteration cap | human resume |

`forceHuman` set sites: `engine.ts:694` (P0 reframe: feasibility<6 or vague lattice), `:915`/`:1412` (P6 sandbox fail); guarded at `:1668` (autopilot approve throws). **Key asymmetry: wild checks ONLY `forceHuman` — never STOCK_HITL/tightness/DoD pre-check ⇒ wild is strictly MORE autonomous than `unattended`.**

**Step budget:** `store.ts:1231` cap 20; min steps = 4 gates×2 + 9 gapless×1 = **17 ⇒ margin 3**; adding P6+P11 opt-in gates = 21 → **CAP HIT**; no in-loop repair (reject parks; only `driveP6Journey` budget 3 inside one step). CLI roomier: wild 24 (clamp 1-48 @`headless.ts:4125,4291`), runUntilGate 40, run-eval 60. **Verdict: CONDITIONAL-PASS.**

**P6→materialize→treeRun→acceptance→mint early-returns:** `liveP6Synthesis` (`codegen.server.ts:2888`) bails keyless/missing/forceHuman, `refuse()` mints refusal row; **`upgradeP6Keyed` (`engine.ts:3028-3064`) bare catch → silent floor (no refusal log)**; `runP6Edge` "failed" returns project as-is; `materializeEmitTree` silences import failure; `emitProject` default `redTree:"refuse"` → `RT_E_TREE_RUN_FAILED` + `RT_E_FOREIGN_FILES` + `RT_E_BUSY`; **`mintTreeRunTested` (`codegen.server.ts:3766-3805`) mints only on green tree + ≥1 spec + ≥1 assertion; no-spec/UI-shell emits `p6.tree.tested.skipped` ⇒ never mints ⇒ `p6-verified` red ⇒ P6 hard-stop**; **`p7-research` (`dod.ts:676-681`) needs `research.length>0 || liveUnavailable` — the WILD PATH NEVER CALLS liveLayer ⇒ high-confidence P7 hard-DoD stop on any keyed+enforceDod run** (not executed — probe-priority; only unverified link = whether `attachAlgorithms` seeds research).

**Driver capability diff (condensed):** store-driver cap 20, no live layer, self-approves (forceHuman only); CLI `wild` cap 24, no live layer, self-approves + `attachWildPlan`; CLI `unattended` cap 40/60, **has live layer, but parks at every stock gate**. Neither is a superset.

**Blocker verdicts:** sequential CONDITIONAL (stops on forceHuman P0/P6 + any DoD-red); synthesis CONDITIONAL-PASS; tree-green CONDITIONAL; acceptance CONDITIONAL; mint CONDITIONAL (narrow). **Cheapest falsification test (keyless-safe): injected-reviewer `wildStep` on a seeded `enforceDod:true` project — assert whether it pauses at P7.**

### 3·SE2 — surfaces / unattended / economics + the two vision-gap designs · severity H/M

**§1 UI-keyed parity — CONDITIONAL.** Server-side transport fine (`llm.ts:83/:106/:141` server fns; `store.ts:1440/:1483` → `synthesizeAsync` → `engine.ts:3066/:3176`). **Browser wild/auto loop BLOCKED — and it STALLS, it does not degrade:** `createNodeWildReviewer()` → null in browser (`wild-review.ts:70-80`) → store passes no reviewer (`store.ts:1229-1240`) → engine default specifier `clientSafeServerSpecifier("wild-mode")` (`engine.ts:4332-4334`) → import-protection denies (`**/*.server.*`) → rewritten to the access-mock proxy → **its `get`-trap `then` arms are never-settling thenables ⇒ `await reviewer(ctx)` HANGS forever** (verified by my replication, §2#16) ⇒ first wild step never returns ⇒ `finally { releaseWildStart }` (`store.ts:1290-1297`) never runs ⇒ **wild-start latch stays held until reload**. Same hazard in `upgradeP6Keyed` (`engine.ts:3028-3064`). **Unverified hinge (SE2's own flag):** client `process` shim → `keyedDeepSeekConfigured()` client-false — **contradicts `finalsprint:576` "console P6 Execute already reaches the E1b edge"; needs re-verification/correction.** Console lacks: keyed P6→mint, wild loop, emit/tree-run/repair, checkpoint-resume (`store.runP6Journey` still a mirror face decl `store.ts:130` / impl `:1041-1080`).

**§2 unattended — BLOCKED by design (policy, not plumbing).** `unattended` = resume-else-fresh → `runUntilGate({autopilot:true, live:true})` (`headless.ts:842`), checkpoint per committed phase (:886-893), taxonomy dod/hitl/blocked/complete/error/progress/cap. Fresh brief **parks at P4, exit 2** (canAutopilot refuses STOCK_HITL; machine approval needs TTY or `--i-am-human`, `rapidtool-cli.mjs:859-869`). **10 human touchpoints (fresh→built):** P4/P5/P8/P9 approvals (×4+) · blocked→human retry (`engine.ts:4310-4325`) · hard-DoD park repair · wild start/pause/resume verbs · cron/Task-Scheduler arming (**no scheduler file in-repo — grep cron = comments/docs only**) · host key provisioning · deploy handoff. `RT_E_UNATTENDED_UNSUPPORTED` registered-but-unthrown. Verdict: "machine drives to first gate + resumes after each click" WORKS today; "zero humans, brief→app" does NOT.

**§3 economics — CONDITIONAL.** Real process-scoped cap: strict `^\d+$` parse (`token-ledger.ts:145-154`), singleton budget (`:349-352`), `isBudgetExhausted` `>` / `assertBudgetHeadroom` `>=` (`:370/:384`), coded stop `SessionBudgetExceeded`/`RT_E_BUDGET_EXHAUSTED` (`:403-427`), `runBudgetedCall`/`budgetStopRefusal` (`:443-500`); wired: codegen `synthWithBackoff` + `accountSynthUsage` (`codegen.server.ts:2480-2538`), repair (:2514-2525), crew/verify/packet/headless/doctor. No silent overrun on covered seams (overshoot ≤ 1 already-paid call ≤ 32k tokens). **Three holes:** **(a) unmetered by default** (no cap unless operator sets one; nothing arms a ceiling); **(b) coverage gap (~unverified):** engine narrative/research path (`engine.ts:2955-2977` → `llm.ts complete`) + auto-review classifier NOT shown to record spend — a 13-phase keyed run can under-report; **(c) surfacing:** headless spend-envelope owed (OV-41 PARTIAL). Doc/disk mismatch: `token-ledger.ts:12` names non-existent `recordSpendWithinCap`.

**§4a DESIGN — iterate-until-satisfaction (PASS design):** driver at the phase-edge — `dod.runGate` as predicate; engine = existing cycle machinery (`driveP6Journey`/`runP6Edge`, `verifyAndFix`, `deps.treeFailure` as residual-work carrier). New: `src/lib/iterate.ts` `iteratePhaseToSatisfaction(project, phase, {maxCycles=3..5})` → run phase → runGate → pass⇒return / fail⇒rebuild treeFailure from `unmet`+tail → re-run keyed → stamp `iterate.cycle` + terminal `iterate.stopped` (coded). Surfaces: 1 store mirror action + 1 CLI verb (`iterate` or fold into `repair`) + 1 test; reuse `PipelineRail`/`RunScreen`. **Files: 1 new + 3 patched; Effort M (L if scorecard-graded).**

**§4b DESIGN — self-modification honest minimum (PASS design):** pipeline already a delegate (`create --brief` → 13 phases → `emit` → `tree-run`/`repair` → `git.server.ts`); point it at this repo with gap dossiers as brief. Guards: ① path allow-list `physicalInside` (`rapidtool-cli.mjs:1507`) **+ the owed F4 overlay consult in `wildApproveGate` (`engine.ts:3668`; RS-03: `wild.paused_policy` unregistered)**; ② git worktree + branch, land only via `git.server.ts`; ③ **self-DoD = `scripts/gate.sh` before+after** (non-LLM verdict); ④ stock gates stay human (never `--i-am-human`); ⑤ mandatory `RAPIDTOOL_TOKEN_CAP` + enforceDoD; ⑥ forbidden-path manifest (engine/codegen/cli/gate.sh/dod.ts); ⑦ honest limit: bounded local runner, not an OS sandbox (R13-f04/CF-4). Shape: `selfmod` CLI arm + `src/lib/selfmod.server.ts` (~150-250 lines) composing existing verbs. **Effort M (L end-to-end keyed).**

**§5 counter-findings for the parent:**
- **CF-SE2-1 (H):** browser wild driver stalls on the never-settling import-protection mock and holds the wild-start latch. S fix: refuse denied specifiers by host check, never trust a proxy.
- **CF-SE2-2 (M):** `finalsprint:576` "console P6 Execute already reaches the E1b edge" contradicted by client-false `keyedDeepSeekConfigured()` — re-verify/correct.
- **CF-SE2-3 (M):** budget cap unmetered-by-default; narrative/research/reviewer spend unproven in the ledger.
- **CF-SE2-4 (L):** `token-ledger.ts:12` doc names non-existent `recordSpendWithinCap`.
- **Side effects to clean:** background dev server session `proc_03d5bc8b2e80` (pid 12908, `npm run dev`, port 8080 never bound; **still running at my 16:14 check — parent to kill if unwanted**) + temp probe `C:\Users\mnril\AppData\Local\Temp\se2_mock_probe.mjs` (outside repo).

---

## 4 · MERGE-COVERAGE — the seven factors (`wave_plans/W43/COMPLETION-TASKS.md`)

| Factor | Verdict source per W43 doc | Actual coverage (post-rescue) | Status |
|---|---|---|---|
| **F1 · PROVE (keyed E2E)** | DA1 #8 + DA2 run-table + SE1 chain | DA1 rows 1/7/8 (no post-09-25 keyed run; P0/park walls; 3/9 balance-exhausted) + DA2 newest-run block + SE1 park catalogue & blocker verdicts | ✅ **COVERED** |
| **F2 · COMPLETE LOOP (iterate driver)** | SE2 #4a + DA1 #9 | SE2 §4a concrete design (iterate.ts, 1+3 files, M) + DA1 #9 (no score-driven driver; bounded tree-repair ≠ it) | ✅ **COVERED** |
| **F3 · SELF (self-improve)** | DA1 #10 (+SE2 #4b) | DA1 #10 (no self-mod loop; write-path restrictions) + SE2 §4b design + guards | ✅ **COVERED** |
| **F4 · SURFACES (UI parity + unattended)** | SE2 #1/#2 | SE2 §1 (wild stalls + latch; console capability diff) + §2 (parks P4; 10 touchpoints) + CF-SE2-1/2 | ✅ **COVERED** |
| **F5 · OPS (budget/telemetry/cron)** | SE2 #3 | Budget ✅ (SE2 §3 a/b/c) · telemetry value ✅ (DA2 diagnose blindspot) · **cron `last_status:error` diagnosis (T5.2): NO coverage — SE2 found no scheduler file in-repo; the 2 errored fires were never diagnosed** · spend-ledger completeness PARTIAL (holes a/b named, not byte-closed) | ⚠️ **PARTIAL** |
| **F6 · QUALITY (tree green / meanAtLeast)** | DA2 #3 + SE1 #3 | DA2 meanAtLeast CONFIRMED-STRUCTURAL (two floors) + SE1 §3 (mint narrow, P7 hard-stop, early-returns) | ✅ **COVERED** |
| **F7 · LEARNING (lesson consumption)** | none named — "Nobody has audited this end" | **NOTHING in any of the four outputs traces mint→packet→synthesis lesson consumption** | ❌ **NO COVERAGE** |

**What the audit did NOT cover (parent: assign or accept):** (1) **F7 entirely**; (2) **F5 cron T5.2** (2 errored fires undiagnosed); (3) gates run for the parent's own report (DA1 #6 never run); (4) DA1 #5 probes not re-run (commit-message evidence only); (5) SE2's client-`process` hinge + `finalsprint:576` contradiction; (6) SE1's P7 probe not executed (probe-priority); (7) no full 13-phase keyed seal executed anywhere (impossible without key); (8) exhaustive write-path grep for DA1 #10; (9) SE2 budget coverage-gap (b) left unverified by SE2's own cap; (10) mint-field historical ground truth vs pre-20:13 code.

---

## 5 · NO-LOSS INVENTORY (final)

| Auditor | Findings in final summary | Written to its 311 file? | Rescued here? | Message id (raw) | Spot-check verdicts |
|---|---|---|---|---|---|
| DA1 | 10 claims + 4 gaps | ✅ landed 16:16 (parent paste; WD-verified complete vs final) | digest §3·DA1 (all 10 — insurance) | `state.db #112344` | 4/4 VERIFIED |
| DA2 | 40-row table (13 batches) + band stats + artifact proof + newest-run block + meanAtLeast verdict + 4 caveats + cross-ref correction | ✅ landed 16:16 (paste; WD-verified) | digest §3·DA2 (all — insurance) | `#112470` | 6/6 VERIFIED |
| SE1 | Park catalogue (~10 sites) + forceHuman sites + asymmetry + step-budget math + 6 early-return classes + driver diff + 5 verdicts + falsification test | ✅ landed 16:16 (paste; WD-verified) | digest §3·SE1 (all — insurance) | `#112164` | 4/4 VERIFIED |
| SE2 | Parity (§1 incl. capability diff) + unattended (§2, 10 touchpoints) + economics (§3 a/b/c) + designs §4a/§4b + verdict table + CF-1..4 + side-effects | ✅ landed 16:16 (paste; WD-verified) | digest §3·SE2 (all — insurance) | `#112410` | 3/3 VERIFIED (mock hang replicated EXIT=124) |

**Nothing found by any auditor is summary-only.** Final state = triple-redundant: (a) the full output is on disk in each 311 file (16:16 parent paste, WD-diff-verified complete), (b) digested in §3 here, (c) raw in `state.db` at the message ids above. Loss-proof.

---

*Guard-watchdog log ends. Writes: this file only (`fixes/311_wd_guard.md`) + temp probe `~/wd_mockcheck.mjs` (spot-check #16 evidence; deletable). No product edits. No keyed calls.*

**Auditor scratch/evidence locations (not mine to clean):** DA1 → `~/rt311_da1/` (`p.json`, `p2.json`, `create.out`, `gate*.out`, `.rapidtool/` with checkpoint 39,989B + `logs/rapidtool.ndjson`); DA2 → `C:\Users\mnril\da2_scratch\` (`eval-scorecard.json`, `diagnose-root.json`, `diagnose-project.json`, `table.md`, `batches.md`, `gen_table.mjs`); SE1 → none (reads only); SE2 → temp `C:\Users\mnril\AppData\Local\Temp\se2_mock_probe.mjs` + orphan dev server `proc_03d5bc8b2e80` (pid 12908).
# fixes/311_wd_guard.md — GUARD-WATCHDOG final (rescues + 17 spot-checks)

Guard-watchdog duty complete. Final summary:

## Outcomes

**⚠️ Headline: 4/4 auditors hit the iteration cap before their write step — zero files written at batch end.** I caught this live, extracted all four full finals from `state.db` (raws: DA1 `#112344`, DA2 `#112470`, SE1 `#112164`, SE2 `#112410`), and built the rescue. The parent then pasted all four finals into their files at 16:16 — **I diff-verified all four landed files against the finals: complete, nothing dropped.** Final state is triple-redundant (files + digest + state.db).

**Spot-checks (special duty): 17 independent byte checks — 16 VERIFIED, 1 VERIFIED-with-time-drift, 0 WRONG / 0 UNSUPPORTED.**
- DA1 ×4: store.ts:1231 loop, expandBrief=3-vs-synth=2 attempts (their falsification held), P6 route + green-seal cite, 28KB checkpoint class.
- DA2 ×6: 40 rows/10 keyed exact, run-in-progress fields exact, results.json figures exact, 11/11 graders `meanAtLeast:1`, run-eval has 0 rt-events imports, 154_f1 artifact proof.
- SE1 ×4: forceHuman park @engine.ts:3946, STOCK_HITL @phases.ts:151, canAutopilot clauses, store latch release.
- SE2 ×3: wild-review null-guard chain + import-protection deny rule; **replicated the mock-arm hang myself → killed by `timeout` (EXIT=124) = never-settling confirmed**; token-cap parse.

**Merge coverage published** (in `fixes/311_wd_guard.md` §4): F1 ✅ · F2 ✅ · F3 ✅ · F4 ✅ · **F5 ⚠️ PARTIAL — cron `last_status:error` diagnosis (T5.2) has NO coverage** · F6 ✅ · **F7 ❌ NO COVERAGE — nobody traced lesson consumption (mint→packet→synthesis)**. Full "not covered" list (10 items) included.

## Files created/changed
- **`fixes/311_wd_guard.md` (26.5KB)** — monitoring log (4 sweeps + hash-stability proof), spot-check table, full rescues/digest §3·DA1/DA2/SE1/SE2, F1–F7 coverage, no-loss inventory, artifact pointers.
- `~/wd_mockcheck.mjs` (spot-check evidence, deletable). No product edits; no keyed calls.

## Flags for the parent
- **Orphan dev server** `proc_03d5bc8b2e80` (pid 12908, `npm run dev` — port never bound, still running) + temp probe `%TEMP%\se2_mock_probe.mjs` (SE2's side effects; left for you to kill).
- Pasted 311 files contain stale self-references ("was never created / deliverable missing") — cosmetic tidy-up only.
- Batch defect to fix next time: reserve each auditor's file-write step up front (4/4 cap deaths); recovery path otherwise = state.db full finals (already documented in the `parallel-subagent-deployment` skill, which I confirmed covers this).