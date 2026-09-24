# fixes/243 · W15 WD-2 — the W14 closure certifier (independent certification)

**Run:** 2026-09-24 13:13:55 → 13:19:14 (-05:00) by W15-WD-2 (read-only subagent; wrote ONLY this file + `C:/Users/mnril/w15wd2_backup/`). Task ref: `wave_plans/W15/watchdogs.md` §WD-2.
**Base:** HEAD `7582771f175b3af4502e4e90b3c90648b9c59acd`, uncommitted W14+W15 tree.

**BOTTOM LINE (at top, per plan):**
> `W14 closures: 2 certified / 0 asserted-only (both WD-β §5 close conditions; 7/7 W14 task rows corroborated) · P1-α-01: RATIFIABLE · repo+corpus: ONLY-EXPECTED (corpus: 2 parent folds mid-watch, growth only, zero shrink; repo: in-box lane files + watchdog reports only) · bad-code findings: 4 open precision/doc items (3×P3 + 1×P4; behavior defects: 0)`
> **→ YES — the wave is safe to fold and commit.** No blocking condition found. The 4 items are pre-merge polish, not gates (each has file:line below). The P1-α-01/02 process incident is correctly ratified *and* its root cause (the imprecise box) is already corrected on disk (13:15:06).

## 0 · Method & budget
- Read-only: reads/greps, `git status/diff/show` (no mutations), md5/sha256/stat, `node --check`, ≤2 targeted test runs (`--test-concurrency=2`). Forbidden ops untouched: `npm run typecheck`, `npm test`, `npm run build`.
- **Runs used (2/2):** (1) `node --experimental-strip-types --test --test-concurrency=2 scripts/run-eval.test.mjs` → **exit 0, 17/17**; (2) same on `src/lib/headless.test.ts` → **exit 0, 92/92**. Logs: `C:/Users/mnril/w15wd2_backup/run1_run_eval.txt`, `run2_headless.txt`.
- Corpus snapshot + manifests: `C:/Users/mnril/w15wd2_backup/` (`manifest_start/mid/end.txt`, `key_md5_end.txt`, `gitstatus_end.txt`, `corpus/`).

## 1 · P1-α-01 — L2's out-of-box edit of `scripts/rapidtool-cli.mjs` → **RATIFIABLE**

**The parent's reasoning, verified myself, claim by claim:**

| # | Parent's claim | My verification | Verdict |
|---|---|---|---|
| 1 | The playbook names `rapidtool-cli.mjs` as TA-3's HOT file | `230_task_execution_playbook.md:281-282` — "(3) **HOT: `rapidtool-cli.mjs`** if USAGE is touched — one lane." Also TA-3's block states the USAGE gap as TA-3's own task (`:266-269`), and its test seam is `scripts/README-cli.test.mjs` (`:272-273`) | **REAL** |
| 2 | OV-15 designates the same file | `230:494` "**Files + seam:** `scripts/rapidtool-cli.mjs` (emit arm :781)"; `230:501` "(1) HOT: `rapidtool-cli.mjs`"; canonical row `220_tasklist_canonical.md:113` files = `scripts/rapidtool-cli.mjs` | **REAL** |
| 3 | The W14 brief's box was stricter (the imprecision) | `wave_plans/W14/lanes.md` LANE 2 as issued (my 13:13 read): owns = docs only, no CLI file — while assigning TA-3 ("add `diagnose` to USAGE") and OV-15 ("make it reachable"), both of which *live in* that file. Internally inconsistent box, exactly as WD-α/β wrote | **REAL** |
| 4 | The box text was corrected in place | `wave_plans/W14/lanes.md` mtime **13:15:06** (during my watch, +304 B); new `:46-50`: owns now includes `scripts/rapidtool-cli.mjs` **+** `scripts/README-cli.test.mjs` "(added 2026-09-24 by parent correction — the playbook designates the CLI file for TA-3/OV-15 and its doc-contract test is the receipt…)" | **DONE** |
| 5 | The result was boundary-verified | README-cli.test.mjs: parent 11/11 at 13:10; I verified statically **11 top-level tests** incl. the 3 new pins (`scripts/README-cli.test.mjs:218/:237/:246`) — parent-asserted for the run itself (not in my budget). `node --check scripts/rapidtool-cli.mjs` → **CHECK_OK** (I re-ran). typecheck 0 = parent-only (forbidden to me, as designed) | **CORROBORATED** (one parent-asserted item) |

**The diff — ONLY legitimate hunks (I read all 5; `git diff -- scripts/rapidtool-cli.mjs`, numstat +31/−3):**
1. `:797-819` — emit arm: `--red-tree` read + fail-closed validation (junk → `RT_E_VALIDATION`, exit 1; `probe` deliberately NOT exposed, comment says so). OV-15.
2. `:821-825` — passes `redTree` through to the existing `h.emitProject(...)` option. OV-15 ("wires the EXISTING option").
3. `:836-842` — success envelope stamps `redTreeBanner:true` + `redTree` when banner was used ("an agent driver can never read this as a quietly-clean emit"). OV-15.
4. `:2928-2940` — USAGE: `approve` line gains `[--i-am-human]` + the token note; `emit` line gains `[--red-tree refuse|banner]` + the banner contract. **Judgment call stated:** the approve line is not literally TA-3/OV-15 — it is the same lane's OV-17 probe finding (the old line omitted a real flag), fixed one line over in the same USAGE object under the same "make every count on disk match the code" mandate. I rule it **not a drive-by** (same file, same class, one line, falsified by the lane's own probe, logged).
5. `:2952` — USAGE gains the missing `diagnose:` key. TA-3 (the core fix).

**No drive-by edits:** no logic outside the emit arm + USAGE; no other verbs touched; no silent catches; hyphenated key `args["red-tree"]` follows the file's own convention (`args["knowledge-file"]` at `:2213`/`:2311`/`:2370`); `grep -n 'redTree' scripts/README-cli.md` documents it (`:94/:96/:347/:353`). Bytes audited = md5 `072aadd6c73f6ad298bb7ebafaf91927` — **identical to WD-β's post-close reading**, i.e. frozen since 13:02:24. No collision with L1/L3 hunks.
- **P1-α-02 (same class):** `scripts/README-cli.test.mjs` (+53/0) is also named by TA-3's playbook block as the test seam (`230:272-273`) — same ratification logic; statically confirmed the 3 new pins + 11 tests.
- **Disclosure:** `fixes/237_lane2_doc_truth.md` §Gaps-3 now self-reports the out-of-box edit (parent-completed from the lane's closing summary; WD-β's "unlogged" complaint is remediated).

**VERDICT: RATIFIABLE** — the plan-level designation is real at three independent places (playbook TA-3, playbook OV-15, canonical row), the box was the erroneous artifact, the diff is clean, and the correction is already on disk. Residual: none required; recommend the fold commit record the ratification + the 4 findings below.

## 2 · WD-β's §5 close conditions

### 2a · L1's drain evidence — **CERTIFIED**
- **My re-run (mandated):** `node --experimental-strip-types --test --test-concurrency=2 scripts/run-eval.test.mjs` → `RUN1_EXIT=0` · `# tests 17 · # pass 17 · # fail 0 · duration_ms 4422.7647` — byte-bound to `scripts/run-eval.test.mjs` md5 `000b07d6…` + `run-eval.mjs` md5 `18b4423c…` (both unchanged through 13:19).
- **The "80 → 1" claim is SHOWN, not asserted** (`fixes/237_lane1_c2_dod_terminal.md`): §Bottom line states the before/after; **§Evidence.2 is a measured table with `dodRows | 80 | 1`**, `position stalled→dod`, `onTime false→true`, `code null→RT_E_GATE_PENDING`, plus the **raw pre-fix JSON** (`"dodRows":80`) and the probe path+command (`C:/Users/mnril/w14l1_scratch/probe-c2.mjs`, `node --experimental-strip-types probe-c2.mjs`). I verified the probe file exists (mtime 12:57, 1595 B) and read it — it drives the real `drainPipeline` and counts `dod.blocked` rows, exactly as described.
- **Independent corroboration of the after-leg:** the new pin `scripts/run-eval.test.mjs:521` asserts `rowsAfter === 1` ("exactly ONE drain round ran the hard-DoD block — got N (80 before this fix)") — it **passed in my run 1**. Seam anchors all real: predicate `run-eval.mjs:656-660`, used `:707`, dod branch `:708+`, `stopCode` `:939/:962/:1043`.
- Honest limit (mine): the pre-fix leg cannot be re-run read-only without reverting the fix; it is probe-attested (probe + raw JSON + the RED-first `not ok 17` at duration 128.17 ms). Declared, not glossed.

### 2b · L3's smoke evidence — **CERTIFIED**
- **Every durable output re-verified byte-exact by me** (sha256 of the live files vs the log §2.4 claims): `C:/workspace/screenshots/w14.png` 68 200 B `02b817f2…` ✓ · `w14-mobile.png` 49 584 B `e175b8c2…` ✓ · `w14.json` 1 662 B `b542a3f4…` ✓ — all mtime 13:05; scratch copy `w14-verdict-RAPIDTOOL-8090.json` md5-identical to the live JSON.
- **The verdict JSON I read directly** (`C:/workspace/screenshots/w14.json`): both viewports `status 200`, title `"RapidTool — autonomous software agency"`, `consoleErrors: []`, `pageErrors: []`, `horizontalOverflow: false`, `authWarnings: []`, screenshot paths under `C:\workspace` — i.e. the guard fix is exercised *in the run itself* (the smoke could not have written there pre-fix).
- The smoke command + `SMOKE_EXIT=0` + port-8090 context (R1: 8080 held by foreign `contractorapp`) are lane-recorded; WD-α independently verified the same hashes, and `scripts/browser-smoke-verdict.test.mjs` (40/40) was re-run in WD-α's pass. I could not re-run the browser smoke within my 2-run budget (it needs a live server + chromium); the artifacts are the durable evidence and they match exactly. `scripts/browser-guard.mjs` diff = the single claimed hunk (+7/−1, resolve-both-sides), `browser-smoke.mjs` untouched.
- Residuals R1-R7 in the L3 log are honestly registered, not claimed fixed — no misreport.

### The other W14 rows (corroborated, briefly)
C-1 ✓ (WD-β adversarial audit + my green re-runs; `headless.ts` md5 `36d0a670…` byte-stable since 12:43) · C-2 ✓ (run 1) · OV-2 ✓ (above) · TA-3 ✓ (`grep -c 'case "'` = **35**; `diagnose:` key present `:2952`; README `:9/:82/:103` + AGENTS `:50` all say 35; README-cli `:10` 35) · OV-17 ✓ (README diff rewrites the Quickstart to real arms — `create --brief`, `gate`, `approve --i-am-human`+token, `emit`, `doctor --tree`; USAGE approve line now matches `:561-595`) · OV-15 ✓ (diff + docs + pins) · OV-12 ✓ (`SETTLED` occurrences 4 vs 0 at HEAD; slot `fixes/217c:595` "Drop-in slot … FILLED (settled)").

## 3 · The `TEST_EXIT=1` anomaly — RECONCILED: **environmental, not code** (CONFIRMED)
- The artifact is exactly what WD-β said (`C:/Users/mnril/w14wd_beta_backup/headless_test_run1.txt`, 31 B): `stdin is not a tty` / `TEST_EXIT=1` — **zero TAP output**: the process died before running a single test, so no code path was ever exercised by it.
- Same-bytes counter-evidence: WD-β's authoritative foreground run = `# tests 91 · # pass 91 · # fail 0` (`headless_test_run2.txt:738-745`, duration 86 903 ms); parent re-runs 91/91 ×2; WD-α's runs also green.
- **My own run:** the W14 close-condition target bytes changed *during my watch* — W15-L1 landed its repair-seam test (in-box; additive `+60/−0`; `headless.test.ts` md5 `5685f7e2…` → `57fb08f5…`, mtime 13:16:37). My run on the **new** bytes: **exit 0, 92/92, suites 28, duration 70 209 ms**, md5 byte-identical before/after the run. The suite executes and passes in foreground; the only failure ever recorded on this file is C-1's *deliberate* RED (90/91, documented). Env-level death under load/pty (cf. L3's R7 traps) is the only consistent explanation. **No further action.**
- Note for the record: 92 ≠ 91 is expected W15 progress (`wave_plans/W15/lanes.md` L1 done-when "91 → ≥92"), not a W14 regression.

## 4 · Repo + corpus guard (start 13:13:55 → end 13:19:14)
**Corpus (frozen set, md5+size tracked at start/mid/end; full tables in the backup dir):**
| file | start → end | verdict |
|---|---|---|
| 220_tasklist_canonical.md | 56593 `b39d5484` → same | byte-intact |
| 220_overhaul_plan.md | 32970 `8480bde0` → same | intact (its 32187→32970 delta *predates* my watch; = parent's 13:07:10 `[PARENT] CORRECTED` insertion per WD-α P1-α-03 — a **grow**) |
| 230_task_execution_playbook.md | 98773 `37289c05` → same | byte-intact |
| 235_execution_readiness_audit.md / 240_missing_tasks_audit.md | 41352 / 31414 → same | byte-intact |
| fixes/228_ledger_and_risk_register.md | 46027 `e8f0a0c2` → same | byte-intact |
| fixes/236_c1_wb1_deadlock_fix.md | **3686 → 5692** (mtime 13:15:23) | **grow** — parent appended the WD-β post-audit + close-condition dispositions |
| fixes/237_lane1 / lane2 / lane3 | 8650 / 5772 / 14427 → same | byte-intact |
| fixes/238_wd_alpha_report.md | **6987 → 14403** (mtime 13:14:31) | **grow** — parent appended WD-α's final report + the actions taken |
| fixes/239_wd_beta_report.md | 17546 `68c868cf` → same | byte-intact |

**Sizes only grow: YES. Zero shrink, zero deletions, zero lane-attributable corpus mutations.** The two mid-watch mutations are parent-only folds (the "parent about to fold" pattern), fully captured in `manifest_start/mid/end.txt`; backup copies md5 == live (restorability proven for the changed files; unchanged files identical by construction).
- Also grew (non-corpus, parent artifact): `wave_plans/W14/lanes.md` 6721→7025 @13:15:06 = the P1-α-01 box correction (§1 #4).

**Repo `git status --short`:** 13 `M` + 58 `?` at start → 15 `M` + 62 `?` at end (counts re-verified from the saved capture; live status identical at my last check). **Every delta is an expected in-box W15 file:** `+ M src/lib/errors.ts`, `+ M src/lib/errors.test.ts` (W15-L2's box); `+ ?? scripts/browser-guard.test.mjs`, `+ ?? fixes/241_lane1_c1_repair_seam.md` (W15-L1's box); `+ ?? fixes/242_wd1_w15_report.md` (WD-1's report); `+ ?? fixes/243_wd2_closure_report.md` (mine). Nothing outside boxes; no deletions; the two pre-existing `M` (fixes/218, 219a) remain the W13-parent-era edits (mtimes 11:40/11:30, pre-wave).

## 5 · Bad-code findings open at fold time — 4 (none behavior-breaking)
1. **F1 (P3, output honesty):** `src/lib/headless.ts:2592` and `:2712` hardcode `minted: false` on the repair **FAILED** returns while the success returns correctly carry `minted: green.minted` (`:2568`, `:2688`); post-C-1 the returned project can genuinely carry a fresh `lastTest:"tested"` (green executed tree-run + red gate). CLI surfaces `minted` (`scripts/rapidtool-cli.mjs`), so the field can under-report a real mint. Suggested: `minted: green.minted`. Re-verified still present today.
2. **F3 (P3, stale comment):** `headless.ts:1912` still says `NEVER mint lastTest:"tested" (T0.6 — mint-after-gate)` — directly above code that now mints before the gate (C-1's own comment above corrects the record; the old block contradicts it).
3. **F4 (P3, stale comment):** `headless.ts:2550-2552` "tree-green + red gate is FAILED, never ok:true / minted tested." — the "minted tested" half is false post-C-1.
4. **F5 (P4, doc):** `headless.ts:1812-1816` function doc still implies the mint belongs to the gate-passed→CONVERGED branch only.
- Dispositioned, not counted: **P1-α-01/02** (ratified; box corrected on disk); **P1-α-03** (overhaul-plan md5 = parent's own edit); WD-β's earlier F2/strike items (fixed in place per `fixes/236` post-audit); corpus folds (allowed).
- Behavior defects found by me: **0**. No new `catch`/`skip`/`.only(`; guard fix not weakened; no test would pass on revert (L1's pins assert state, not surface).

## 6 · Fold-and-commit verdict — **SAFE (with non-blocking polish)**
- All close conditions resolved: drain evidence CERTIFIED (my 17/17 + shown 80→1), smoke CERTIFIED (byte-exact artifacts), anomaly = environmental (my 92/92), corpus+repo guarded, P1 ratifiable and root-caused fixed.
- Parent-asserted items I could not re-run (declared): `typecheck 0` (forbidden), `README-cli 11/11` (corroborated statically: 11 tests, 3 new pins on disk), `browser-verdict 40/40` (WD-α re-ran 51/51 incl. it). None is contradicted by anything I found.
- Recommend in the fold commit, in order: (1) record the P1-α-01/02 ratification + this certification; (2) sweep F1/F3/F4/F5 in the same commit if cheap (all 4 are ≤2-line edits, zero behavior change — F1 is the only one with any output surface); (3) nothing else blocks.

## 7 · Honest limits (declare-or-strike, self-applied)
- Not run by me (budget/forbidden): typecheck, lint, README-cli/browser-verdict/headless-verdict suites beyond my 2 runs, the browser smoke, any keyed run; the pre-fix drain leg (probe-attested); lane-probe exit codes (OV-15 x3, OV-17 block) — read from logs, consistent with on-disk artifacts.
- Capture window ends 13:19:14; W15 lanes were still writing after it (e.g. `fixes/241_lane2_rt_codes.md` grew at 13:17; `browser-guard.test.mjs` appeared ~13:18) — their in-box progress is outside this report's guarantee.
- Every claim above carries file:line / md5 / command; backups + logs under `C:/Users/mnril/w15wd2_backup/`.
