# fixes/311_da2_data.md — RESCUED from the auditor's final summary (file write hit the iteration cap; content verbatim)
> **RESCUED-header correction (2026-09-29):** this file is on disk and complete — content verbatim from the auditor's final summary as pasted by the parent; the stale "file not written / not yet on disk" self-references below describe the original iteration-cap moment, not this file's state.
# DA2 — the historical run table + meanAtLeast

I hit the iteration cap before writing `fixes/311_da2_data.md`. **The audit is complete; the file is NOT yet on disk.** Below is the full deliverable content — land it verbatim (or hand me one more turn).

## What I did (all read-only; zero product edits; no keyed calls)
- Read `research/eval-out/history.json` (40 rows, complete), `results.json`, `run-in-progress.json`, the 19 emitted `project.json`s, `_keyed-run.log`.
- Ran the two read-only CLI verbs on the newest run (`eval` → 24.8 KB scorecard, exit 0; `diagnose` default + `--project`, exit 0). Outputs held in `C:\Users\mnril\da2_scratch\` (`eval-scorecard.json`, `diagnose-root.json`, `diagnose-project.json`, `table.md`, `batches.md`, `gen_table.mjs`).
- Traced `meanAtLeast` through 11 grader JSONs + `run-eval.mjs` + `maker-score.ts`.

## THE RUN TABLE — 40 rows, 13 batches (`research/eval-out/history.json`)
Bands = M1..M9 as a 9-char string. Acc = `acceptance.pass` (absent⇒unscored). Mint proxy = M4 (needs `lastTest.label==="tested"`+hash).
L=coffeehouse2home-property-ledger F=field-ops-suite H=house-flip-manager C=real-estate-crm R=rental-portfolio S=showing-booking

| # | UTC | key | slug | bands | total | acc | mint |
|---|---|---|---|---|---|---|---|
|1-6|09-08 13:38:50|keyless|L,F,H,C,R,S|000011011|4/9 ×6|unscored|no|
|7|09-08 22:29:44|keyed|L|010011111|6/9|unscored|no|
|8|09-08 22:29:51|keyed|L|010011111|6/9|unscored|no|
|9|09-09 00:44:57|keyed|L|010011111|6/9|unscored|no|
|**10**|**09-09 00:59:27**|**keyed**|**L**|**111111111**|**9/9**|unscored(mean=1)|**YES←artifact**|
|**11**|**09-09 02:16:22**|**keyed**|**L**|**111111111**|**9/9**|unscored(mean=1)|**YES←artifact**|
|12-17|09-10 05:29:29|keyless|L 5/9(010011011); F,H,C,R,S 6/9(010011111)|—|—|unscored|no|
|18|09-10 05:46:13|keyed|L|110011110|6/9|unscored|no|
|19|09-10 06:05:29|keyed|L|100011010|4/9|unscored|no|
|20-25|09-17 02:41:43|keyless|L,C 3/9(000010011); F,H,R,S 6/9|1/1 trial|—|**fail**|no|
|26-37|09-17 02:49:36|keyless|L,F,H,C,R,S ×2 trials|010011111|6/9 ×12|**fail**|no|
|38|09-24 19:43:05|keyed|L|100010111|5/9|fail|no|
|39|09-24 19:49:11|keyed|L|100011111|6/9|fail|no|
|**40**|**09-25 00:03:43**|**keyed**|**L**|**000010011**|**3/9**|**fail**|**no** ←NEWEST|

- 40 rows = 30 keyless / 10 keyed. Band wins — keyless: **M1 0, M2 22, M3 0, M4 0**, M5 30, M6 28, M7 21, M8 30, M9 30. Keyed: M1 6, M2 6, M3 2, M4 2, M5 10, M6 8, M7 8, M8 10, M9 8.
- Keyless totals: 3×2, 4×6, 5×1, **6×21** → keyless ceiling = **6/9** (M1/M3/M4 never fire: 0/30 rows).
- M7=0 on 11 rows; **no honest row has mean=1** — the only two 9/9s are fictitious (below).
- **The two 9/9 rows are discredited artifacts, not data.** `fixes/154_direction.md` (whole file) + `fixes/154_f1.md:62-79` prove run 10 carded 9/9 while *every* synthesis call refused (`RT_E_LLM_REJECTED`), the "tree" was the 1-file deterministic floor at 0.995 similarity to `generatedSource`, and the scorer credited it (M1-M4). Post-F1 it re-cards **5/9**. `fixes/163_b.md:13,302` cites the 02:16Z run as the same artifact. **No valid sample of a high score exists.**

## NEWEST-RUN EVIDENCE (2026-09-25T00:03:43Z)
- **Marker** (`run-in-progress.json`): `mode:keyed`, `done:true`, `preflightClass:"balance-exhausted"`, `meanOfNine:2.9997`, `decision:"retrace-first"`, entries 1, results+history written.
- **results.json**: 1 entry, `meanTotal 0.3333`; L scores M1-M4=0 with the sentinel `"all synthesis calls refused — tree/run/mint evidence is the deterministic floor"`, M5=1, M6=0 (emit refused: foreign file `src/generated/get-property.ts`), **M7=0** (`"M1+M2+M3 0 < prior same-domain 1 — regression"`), M8=1, M9=1, total **3/9**, status `dod`, `journey:"failed"`, `stopCode:"RT_E_GATE_PENDING"`, stall `"P6 DoD unmet — p6-verified, p6-brief-fit"`, `p6Refused:true`, `synthesisSucceeded:false`.
- **Acceptance**: `pass:false`, filesOk false (missing package.json/index.html/README.md), passReason `"mean 0.3333 < 1 (rubric threshold — files/content are not the cause)"`, `verification:null`.
- **CLI `eval` scorecard says**: `endClass` census **funded 0 · unfunded 0 · unmeasured 0 · absent 1** (results.json predates the endClass key — added `8418b04`, 2026-09-28); acceptance census pass 0 · **fail 1** · unscored 0; `derived.passCount 0`; entry `endClass:null`, `behaviorOk/kindOk:null`; trends L=15 rows, `bestMean:1` (the artifact!).
- **CLI `diagnose` on the newest run sees NOTHING**: `--project …/coffeehouse2home-property-ledger/.rapidtool/project.json` → 0 errors, only 3 unrelated rows (`cli.swarm.ok/bench.ok/chat.ok` from 09-26), `checkpoint.present:false`. Root-cause: `run-eval.mjs` never imports `rt-events` (grep 0 hits) — **the eval harness writes no run telemetry at all**, so `diagnose` can never audit an eval run. (Default `diagnose` on repo root reports 63 unclassified errors, 62× `cli.invocation|RT_E_VALIDATION` + 1 `RT_E_PROJECT_MISSING` — unrelated agent churn.)
- **Mint column ground truth**: `history.json` carries no mint field. All 19 surviving emitted `project.json`s have `lastTest:{"ok":true,"detail":"tests.pass"}` — **zero** `p6.tree.tested` / `tested-equivalent` / `label:"tested"` strings. The mint that M4 credits came from `headless.ts:1269-1279` (pre-20:13 code, no longer on disk) over the *floor* tree; the surviving `mintTreeRunTested` (`codegen.server.ts:3766`) self-guards on `ok===true && executed`.

## meanAtLeast:F4#3 — REACHABILITY VERDICT: **CONFIRMED STRUCTURAL — and stronger than the card claims**
- **Definition**: every grader JSON carries `passWhen:{meanAtLeast:1, requireExpectedFiles:true, requireExpectedContent:true}` (11/11 checked). Consumer `passesAcceptance` (`run-eval.mjs:2596-2630`) = 4 clauses: finite mean → `row.mean >= meanAtLeast` → filesOk → contentOk; `mean = total/9`.
- **Two independent arithmetic floors make `mean>=1` impossible:**
  1. **First run of any slug**: `M7` (`maker-score.ts:566-584`) = 0 when `priorFor(slug)` finds no history row — *"no prior same-domain run — no learning claim without data."* ⇒ first-run ceiling **8/9 = 0.8889 < 1**. One-time, per-slug, mode-independent (funded first run included).
  2. **Any keyless run, ever**: keyless structurally scores M1=0, M3=0, M4=0 (0/30 rows; floor-gate evidence on every keyless card) ⇒ keyless ceiling **6/9**. Permanent, not first-run-only.
- **Verdict**: `acceptance.pass` is **unachievable on a first funded run** (M7) and **unachievable on any keyless run** (M1/M3/M4) — never a matter of score quality. **No run on record has ever passed it honestly**; the only two 9/9s are the discredited artifacts, and even they were `unscored` (mean=1, pre-verdict).
- **Not a loosening candidate**: `wave_plans/W42/SPEC.md:83` explicitly pins F4#3/A-14 as *pre-existing, record-don't-fix* ("never weaken existing 35"); `SPEC.md:403` B-24 already VERIFIED the machinery is live. Real remedies (not mine to make): per-kind `expectedFiles` (F4#7 — `index.html` demanded of every kind, impossible for cli/library/service), or M7 semantics — both out of scope.
- **Cross-ref correction**: the task cited `fixes/296_q4_output.md` + `308_map*`; **both are dead** — `296_q4_output.md` has zero `meanAtLeast/F4` hits and 308_map* has none either. Actual sources: `wave_plans/W35/factory-notes.md:102` (§F4 item 3), `wave_plans/W42/SPEC.md:83/196/227/403`, `fixes/216q_eval_fixtures.md:149`, `255_lane2_probe_truth.md:14`, `256_w20_wd_alpha.md:80`, `257_error_ledger_v3.md:67`, `292_l3_eval.md:13`, `303_c1_accept.md:42`, `304_d1_accept.md:28`.

## Issues / caveats
- **`fixes/311_da2_data.md` was never written** (iteration cap) — this summary is the payload; needs one write action.
- **No keyed run since 2026-09-25T00:03** (the wallet returned 402 `balance-exhausted`); HEAD `b3161da` is 4 days of untested-against-a-key changes.
- `git status`: only `fixes/311_wd_guard.md` + `wave_plans/W43/` untracked — my audit changed nothing.
- `results.json` is stale vs HEAD (pre-`endClass`, hence `absent 1`); history rows are capped at `MAX_HISTORY_ROWS:200` but 40 is well under.