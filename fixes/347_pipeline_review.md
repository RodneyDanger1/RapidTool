# 347 — LANE B: pipeline review + learning-loop visibility + testruns analysis

- **Branch:** `rt347-pipeline` (worktree `rt_final_wt\pipeline`) · base `841383d`.
- **Owned files:** `src/lib/pipeline-review.ts` (new), `src/lib/pipeline-review.test.ts` (new),
  `src/lib/maker-score.ts`, `src/lib/maker-score.test.ts`.
- **Scope:** a read-only per-stage review of a persisted project record + a written analysis of the
  real `testruns/**` campaigns. No LLM calls; no I/O beyond the passed record.

> Naming note: this lane's brief said `src/lib/make-score.ts`; no such file exists in the repo. The
> real owned module is `src/lib/maker-score.ts` (the pure M1..M9 rubric) — treated as the intended
> file. No other file was touched.

---

## 1. Analysis of the real test runs (per stage P0–P12)

Sources: `testruns/_report/CAMPAIGN2.md`, `testruns/_report/CAMPAIGN1.md`,
`testruns/RUNBOOK/IMPROVEMENTS.md`, `testruns/campaign2/ledger.json`,
`testruns/campaign2/guard-campaign2.json`, and the persisted projects under
`testruns/campaign2/<slug>/build.json`.

Headline (CAMPAIGN2.md §9): **`workingApp` 2/8 (flower-shop-website, office-scheduler)** vs the
≥5/8 target. Delivery honesty held (**0 empty-substance commits**, 0 red-banner commits); the core
P6 synthesis wall did not move.

### Step 0 — arming the cross-process ledger (KD-8), PASS
- `campaign2/ledger.json`: cap 3,000,000 · spent 616,329 · 109 calls · 9 cross-process entries ·
  bound never tripped. The pre-dispatch refusal (a `cap:10` throwaway ledger) returned
  `RT_E_BUDGET_EXHAUSTED` before any verb dispatched — no tokens burned (CAMPAIGN2.md §1b,
  `scripts/rapidtool-cli.mjs:1237-1283` in the analysis' own citation).

### P0–P5 (intake → validation): what went right
- All 8 `create --brief <plain path>` invocations exit 0 — **C1-09 fixed** (CAMPAIGN2.md §2).
- Classifier **C1-07 fixed**: held-out reads `custom-software`/`app` (`Rivertown Tool Library`) vs
  campaign #1's `analytics`/`library` (CAMPAIGN2.md §6, §7). Seven others keep expected labels.
- Every project reaches P6; P0–P5 gates pass on all 8 (`campaign2/<slug>/build.json` phases 0–5
  `gate.passed:true`; e.g. `campaign2/office-invoice-tracker/build.json` P0 hash `3269632901`).

### P6 (implementation / synthesis): the quality-loss epicentre
Evidence: `campaign2/<slug>/build.json`; `campaign2/guard-campaign2.json`; CAMPAIGN2.md §4, §8.
- **6/8 stall at the P6 DoD** (5× `RT_E_GATE_PENDING`, 1× parked HITL `awaiting_hitl`).
- **Floor refusal is reachable but not surfaced**: `p6.synthesis.refused` with
  `RT_E_PLAN_UNDERPRODUCED · chunk 2/8 refused … missing module(s): src/jobs/show.ts …` is in
  **8/8 `build.json` + 8/8 emitted `project.json`**, but the emit seal envelope only echoes
  `RT_E_TREE_RUN_FAILED` / `RT_E_SUBSTANCE_EMPTY` — **defect R2-01** (P0),
  `codegen.server.ts:5898-5920` vs `scripts/rapidtool-cli.mjs:2650` (analysis citations).
- **Jobs unmaterialised (R2-04)**: `jobsMapped=false` on 6 trees, 5 job files missing each
  (`specGraph` declares `job-0..job-4` → `src/jobs/*.ts`; e.g.
  `campaign2/flower-shop-website/build.json` specGraph has 10 nodes but the accepted tree is
  short of job modules).
- **Vacuous oracle specs (R2-05)** still generated (1 live / 7–9 skip) — but C1-05 is
  **gate-fixed**: the tree-run now grades `behavioural:false`, `run:"fail"` and **no `tested`
  verdict is minted** (CAMPAIGN2.md §6). This is the single most important honesty win.
- **R2-03**: `bakery-website` own `tsc` fails TS2503 (`Cannot find namespace 'JSX'`) — generated
  `.ts` still emits JSX (`generated src/generated/validate-order-form.ts`).
- Parked HITL for `office-invoice-tracker` is honest: `status:"awaiting_hitl"`, P6 `gate:null` — no
  fabricated decision (CAMPAIGN2.md §4.1).

### P7 / P11 (research / live grounding)
- Artifacts persist; `research` corpus is carried on `Project` (CAMPAIGN2.md §6 artifact list). No
  per-stage defect logged this wave.

### P8 (UI)
- **R2-02 (P0)**: two seams disagree. `headless.emittedUiWiring` reads wired **4/8**
  (flower-shop, scheduler, bakery-website, bfo — real generated exports reachable through
  `src/generated.ts`); the guard's `realModuleSet` census fires `RT_E_UI_UNWIRED` on **8/8**
  because it only accepts *job* exports, not *render* exports
  (`headless.ts:5104-5159` vs `scripts/guards/campaign-invariants.mjs:393-506`).

### P9 / P10 (CI-CD / edge)
- No opened defect this wave; gates pass only when P6 completes (so only the 2 P12 trees carry
  green P9/P10).

### P12 (delivery / handover)
- Only **flower-shop-website** and **office-scheduler** reach P12, both `substance:"real"` (5 real
  modules) with `jobsMapped:true` and a real commit carrying `git.verification`
  (`treeRunVerdictHash`, `uiWired`, `unverifiedReasons`) — C1-06/C1-08 fixed (CAMPAIGN2.md §4.2,
  §6). `git.verification.verifiedProduct` is still `false` (R2-06, unverified UI shell).

### Learning loop
- `lesson.capture` rows are journaled on every run (e.g. `campaign2/flower-shop-website/build.json`
  `event:"lesson.capture"`, detail `L2 template-emission lesson-template-emission-96c804dc`).
- The M7 learning criterion is honest by construction (`maker-score.ts:703-724`): a first run cannot
  score it; a floor-only prior (M2 green, M1/M3 zero) no longer mints a learning point.
- **Visibility gap closed by this lane:** nothing previously gave a single per-stage view of coded
  refusals + lesson rows + gates + spend. `buildPipelineReview` now does (see §2).

Quality-loss summary (ranked): **P6 synthesis wall (R2-07)** → **R2-01 floor code not surfaced at
delivery** → **R2-02 UI-wiring seam disagreement** → **R2-04 unmaterialised jobs** → **R2-03
generated tsc red** → **R2-05 vacuous oracle template** → **R2-06 unverifiedProduct**.

---

## 2. Code added

### `src/lib/pipeline-review.ts` (new)
- `buildPipelineReview(project, opts?)` (`pipeline-review.ts:210-262`): assembles
  `{ project, stages[13], stageCount, losses[], treeRun, spend, artifacts, learning }`.
  - `stages` carry `id,title,status,gate{passed,unmet,evidenceHash},codedRefusals[],lessons[],
    lessonDetails[],artifacts[]` (`pipeline-review.ts:34`).
  - `treeRun` (`pipeline-review.ts:100-165`): verdict from caller `opts.treeRun` else
    `project.lastTest` (`label==="tested" && ok` ⇒ pass, `tested` but not ok ⇒ fail, otherwise
    **unknown** — never invented); substance proxy over `treeFilesOf` + `isStubSource`
    (`real`/`stub`/`empty`/`unknown`).
  - `spend` (`pipeline-review.ts:167-180`): persisted `tokenUsage` only; `measured:false` + nulls
    when absent.
  - `losses` (`pipeline-review.ts:182-215`): `no-record`, `gate-unmet`, `coded-refusal`,
    `tree-run-red`, `insufficient-substance`, `spend-unmetered`.
  - `learning`: `lessonEvents` (count of `lesson.capture` log rows), `lessonsPersisted`
    (`Project.memory` rows whose `source !== "engine"`), `priorRun: null` (not on the record).
  - Pure/deterministic: no fs, clock, randomness, network, or LLM.

### `src/lib/maker-score.ts` (additive)
- Import widened to `PhaseStatus` (`maker-score.ts:45`).
- `PIPELINE_STAGE_IDS`, `StageQualitySignal`, `codedRefusalsIn`, `stageQualitySignals(project,
  stageIds?)` (`maker-score.ts:941-1032`). **No change to `scoreMaker` / M1..M9 / bars** — the card's
  `total` and `mean` are byte-identical; the new function is a separate, shared derivation that
  `pipeline-review.ts` imports so the two views cannot drift.

### Tests
- `src/lib/pipeline-review.test.ts` (new): **15 tests**, incl. a **verbatim fixture** extracted by
  script from the real persisted record `testruns/campaign2/office-invoice-tracker/build.json`
  (parked-at-P6 `Ledgeline`, `awaiting_hitl`). Read fields are byte-identical to the artifact; only
  unread fields (`artifact.body`, `memory.text`, `brief`) are omitted from the extracted subset.
  Asserts: header scalars, 13-stage statuses/gates, P6 coded refusals
  `RT_E_PLAN_UNDERPRODUCED`/`RT_E_LLM_REJECTED` (deduped), no fabricated `gate-unmet` on a null gate,
  treeRun verdict/substance, opts override, exact spend `20104+17495`, learning counts, per-stage
  artifact titles, and byte-identical determinism.
- `src/lib/maker-score.test.ts`: added `describe("stageQualitySignals (347)")` — code dedup/order,
  null-on-missing, and non-mutation. Existing 102 tests untouched.

---

## 3. Test commands + results

```
node --experimental-strip-types --test --test-reporter=tap src/lib/pipeline-review.test.ts
# tests 15 · pass 15 · fail 0 · skipped 0

node --experimental-strip-types --test --test-reporter=tap src/lib/maker-score.test.ts
# tests 105 · pass 105 · fail 0 · skipped 0
```

---

## 4. Residuals / follow-ups

- **Wiring is a forbidden cross-file change.** The CLI (`scripts/rapidtool-cli.mjs`) and the console
  are owned by the concurrent session, so `buildPipelineReview` is **not** yet surfaced in a verb or
  view. Follow-up for the owner: import `buildPipelineReview` into the CLI/console read-only
  surface (e.g. a `review --project <build.json>` verb) to render `stages`/`losses`. Not landed here.
- `treeRun.substance` derived here is the `isStubSource` **proxy**, not compile-check's
  `TreeSubstance` census; callers who have the census should pass `opts.treeRun.substance` for the
  authoritative verdict (the module prefers it).
- `lessonsPersisted` counts non-engine `Project.memory` rows; the shipped campaign records carry
  only engine rows, so it reads `0` there — an honest zero, not a missing signal (the
  `lesson.capture` trail is surfaced separately).
- **Do not** wire this module to any network/LLM path: it is deliberately pure.
