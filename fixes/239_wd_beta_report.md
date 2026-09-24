# fixes/239 — W14 WD-β report: the delegator's C-1 audited · repo + plan corpus guarded

**Run:** 2026-09-24 ~12:53–13:03 (-05:00) by W14-WD-β (read-only subagent; wrote ONLY this file + `C:/Users/mnril/w14wd_beta_backup/`). Task ref: `wave_plans/W14/watchdogs.md` §WD-β.
**Amendment (final read ~13:03):** ONE late out-of-box modification found after my first end-capture — §3.1 (P1 incident; the file was still being edited at report write). Bottom line and findings count updated accordingly.

## BOTTOM LINE (at top, per plan)

- **C-1: CONFIRMED.** My own run of the mandated command: `# tests 91 · # pass 91 · # fail 0`, exit 0 (`headless_test_run2.txt` in the backup dir). The mint is REALLY before the gate in **both** seams (`headless.ts:1928`→`:1929` journey; `:2515`→`:2516` repair). `mintTreeRunTested` preserves **never-mint-on-red** (`codegen.server.ts:3210`) and **never-mint-unexecuted** (`:3215` → coded warn log, no stamp). The surviving post-gate mint is idempotent for the minted case (`:3212`). The `:489` "no conflict" explanation is **TRUE** (`greenVerdict.tests: []` at `headless.test.ts:411-417`). **No falsification found.**
- **repo: ONE unexpected change — P1 ownership incident (§3.1).** Start→first-end `git status --short` delta contained only in-box lane files (L1: `scripts/run-eval.mjs`, `run-eval.test.mjs`; L3: `scripts/browser-guard.mjs`; logs `fixes/237_lane1|2|3_*.md`, `fixes/238_wd_alpha_report.md`); **but at the final read, `scripts/rapidtool-cli.mjs` was modified at 13:01:25 by W14-L2 (self-marked in the diff) — a lane whose box is docs-only → out-of-box edit, unlogged, unverified.** 0 deletions, no shrinking files otherwise. The two other ` M` files (`fixes/218`, `research/multiagent/219a`) **predate the wave** (mtime 11:40 / 11:30 vs wave start 12:52) and are W13 WD-A corrections by their own content — not W14 incidents.
- **plan corpus: intact** — md5s AND sizes identical at start (12:53) / mid (12:58) / end (12:59); re-confirmed through the final read. Snapshot + manifest in `C:/Users/mnril/w14wd_beta_backup/`; restorability proven.
- **bad-code findings: 6** — 5 P3/P4 precision/doc items (zero behavior defects in C-1) + **1 P1 ownership incident (§3.1: L2 out-of-box edit of `scripts/rapidtool-cli.mjs`)**. Watch items: L1/L3 still in flight; WD-α report still a skeleton.
- **Verdict: the delegator's (parent's) work is sound and the wave is safe to continue — but the parent must adjudicate §3.1 before close** (retro-authorize + verify, or revert), alongside the close conditions in §5 (L1's drain evidence, L3's smoke evidence).

## 1 · C-1 adversarial audit

### 1.1 My own test run (the mandated command)
- `cd "/c/Users/mnril/Desktop/RapidTool Main" && node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` → tail: `# tests 91 · # suites 27 · # pass 91 · # fail 0 · # cancelled 0 · # skipped 0 · # duration_ms 86903.89`, process exit 0. Full log saved: `C:/Users/mnril/w14wd_beta_backup/headless_test_run2.txt`.
- Honesty note (declare-or-strike applied to myself): an identical run launched inside my first background/redirect wrapper died with only `stdin is not a tty` / `TEST_EXIT=1` and produced **zero test output** — a wrapper artifact, not the suite. The foreground run is the authoritative one. Run budget used: 1 wrapper no-op + 1 real run.
- Bytes stability: `src/lib/headless.ts` md5 `36d0a670e6eafc295644730156004a08`, `src/lib/headless.test.ts` md5 `5685f7e203887bb9062bd152188a9748` — identical before the run, after it, and at end-of-watch. The 91/91 reflects exactly the bytes audited here; no lane touched them during the watch (`headless.ts` mtime 12:43:23 unchanged).

### 1.2 The diff — mint REALLY before the gate, both seams
`git diff -- src/lib/headless.ts` = exactly 2 hunks (diffstat 20 insertions, 1 deletion; frozen copy `c1_headless_diff.txt`):
- **Journey seam:** `finalProject = await applyTreeRunTestedMint(finalProject, verdict);` at `:1928`, immediately before `recordGate(finalProject)` at `:1929` — inside the green block (`:1902 if (verdict.ok === true)`) and the `rec6?.status === "complete"` guard (`:1916`).
- **Repair seam:** same call at `:2515`, immediately before `recordGateInto(finalProject, 6)` at `:2516`, inside `recordGreen` (def `:2503`), which is only called from green branches (`:2549`, `:2672` — both `if (verdict.ok === true)`).
- Base cross-check (adversarial): `git show HEAD:src/lib/headless.ts` (saved `headless_BASE.ts`) shows the OLD order at `:1917` recordGate / `:1958` mint and `:2498` recordGateInto / `:2509` mint — the fix genuinely flipped both, and the diff contains no other hunks.

### 1.3 The mint's self-guards — never mint on red / unexecuted (the P1 falsification target)
`mintTreeRunTested` (`codegen.server.ts:3209-3248`):
- `:3210` `if (!outcome || outcome.ok !== true) return project;` → a RED tree-run mints nothing. ✓
- `:3212` `if (current && current.label === "tested") return project;` → idempotent once minted. ✓
- `:3215` `if (!ev.executed) { … p6.tree.tested.skipped … return {…, logs} }` → an unexecuted green run gets **no stamp**, only a coded warn note; `treeRunTestedEvidence` (`:3175-3190`) sets `executed` only when ≥1 spec `run === "pass"` AND ≥1 executed assertion. ✓
- The new pre-gate call sites are green-only **by construction** as well. **No path mints from a red or unexecuted run. C-1 is NOT falsified.**
- Nuance (log-only, benign — see F2): for a green-but-**unexecuted** run the `!ev.executed` branch APPENDS a warn log and so is not a strict no-op on a second call; with the post-gate call kept (`:1970` journey, `:2527` repair), such a run now emits `p6.tree.tested.skipped` twice (or once where it was zero on a red gate). No stamp, no claim, logs bounded (`.slice(-200)`).

### 1.4 Idempotency of the surviving post-gate mint
- Journey: post-gate mint remains at `:1970` (inside `gate !== null && gate.passed === true`); the already-minted case early-returns at `:3212` → no double stamp, no extra log. ✓
- Repair: post-gate mint remains at `:2527`; same early-return. ✓
- (Only the unexecuted case re-logs; noted above.)

### 1.5 The "no conflict with :489" explanation — TRUE
- `headless.test.ts:411-417` (`const greenVerdict`): carries `tests: []` → `treeRunTestedEvidence().executed === false` → the mint refuses regardless of ordering, so the F4 test's assertion at `:489` (`assert.notEqual(lt?.label, "tested")`) still passes. Verified the F4 test's cycle-3 verdict IS that fixture (`:454 return greenVerdict;`). The delegator's self-correction in `fixes/236` §Corrections is accurate — the originally-flagged "direct conflict" would not have existed, and is not hidden.

### 1.6 `fixes/236` vs bytes — verified claims, UNVERIFIED list, strike-list
VERIFIED (my reads/commands):
- "Files changed: headless.ts (2 seams) · headless.test.ts (+1 test)" ✓ (2 hunks, +36 test lines = one test at `:513-547`).
- Base cites "`:1917` then `:1958`" and the repair mirror "`:2493-2510`" ✓ exact against `git show HEAD` (`:1917`/`:1958`/`:2498`/`:2509`).
- "`dod.ts:500-517`" (p6-verified needs `label==="tested"` + non-empty evidenceHash) ✓ exact.
- "`codegen.server.ts:3210/3215`" ✓; "`:3212`" ✓; "`:3142`" (`lastTest: null`; "ONLY re-mint path" comment at `:3139-3141`) ✓ exact.
- "2026-09-10 keyed ledger … P6 complete, no green gate, 50+ `dod.blocked`" ✓ substantiated: `research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json` (mtime 2026-09-10) → **80** `dod.blocked` rows, phase 6 `complete`, `gate` null, `lastTest {"ok":true,"detail":"tests.pass"}` (never `"tested"`), `enforceDod:true`.
- "91/91" ✓ (my run). "no conflict at :489" ✓ (§1.5).
NOT INDEPENDENTLY VERIFIED (labelled, not faults): `typecheck_errors=0` (the command is forbidden to me); the RED observation "`not ok 3` · 90/91" (reverting src was impossible read-only — but consistent: under the old order the red default gate on this fixture suppresses its only mint, so the new test's assertion can only pass via the pre-gate call); "Step 0 is still unrun" (not checked); M3/M4 flip claims (future keyed runs).
STRIKE-LIST (overstatements found in `fixes/236`):
- §The fix, "**Only the ORDER changed**" → STRIKE / reword: the order change also alters the `p6.tree.tested.skipped` log COUNT on green-unexecuted runs (0→1 on a red gate; 1→2 when the gate passes) — log-only and benign, but "only the order" is not byte-true (details F2 below).
- Nit: "a red gate returns `failed` (`:1968-1984`)" — in base the return statement is `:1986` (range 2 lines short; substance true).
- Typo: "verifyAndServever" → `verifyAndFixServer`.

## 2 · Bad-code findings (any actor) — 6 (5 precision/doc + 1 P1 incident)

- **F1 (P3, output honesty — the one worth a 2-word fix before close):** `headless.ts:2592` and `:2712` hardcode `minted: false` on the repair FAILED returns, but their `project` is `p6JourneyLog(green.project, …)` (`:2574-2575`, `:2694-2695`) and post-C-1 that project can genuinely carry a FRESH `lastTest:"tested"` (green tree-run + executed spec + red gate). The result — and the CLI output (`scripts/rapidtool-cli.mjs:1085` `minted: res.minted`) — now under-report a mint the ledger actually holds; also contradicts the field's own doc at `:2271-2273` ("True when this repair flipped … via the tested-equivalent mint (never on a red / no-spec **run**)" — still true for *runs*, false for the *field value*). Recommended: `minted: green.minted`. No test covers this corner (91/91 does not catch it).
- **F2 (P3, strike against 236):** see strike-list §1.6.
- **F3 (P3, stale comment adjacent to C-1):** `headless.ts:1908-1912` still says "record the P6 DoD gate honestly **FIRST**" / "**NEVER** mint lastTest:\"tested\" (T0.6 — mint-after-gate)" — directly above code that now does the opposite (`:1928-1929`). C-1's new comment `:1917-1927` corrects the record, but the stale block should be updated when merging.
- **F4 (P3):** `headless.ts:2550-2552` "tree-green + red gate is FAILED, **never ok:true / minted tested**" — the ok:true half stands; the "minted tested" half is false post-C-1.
- **F5 (P4, info):** `headless.ts:1812-1816` (function doc) still implies the mint is exclusive to the gate-passed→CONVERGED branch.
- **F6 (P1, ownership incident): the out-of-box edit — see §3.1.**

## 3 · Repo-state guard (start / first-end / final)

- Start (12:53, `gitstatus_start.txt`, 52 entries) → first end (12:59:29, `gitstatus_end.txt`): delta = `+ M scripts/browser-guard.mjs` (L3 box) · `+ M scripts/run-eval.mjs` · `+ M scripts/run-eval.test.mjs` (L1 box) · `+ ?? fixes/237_lane1_c2_dod_terminal.md` · `+ ?? fixes/237_lane2_doc_truth.md` · `+ ?? fixes/237_lane3_browser_pass.md` · `+ ?? fixes/238_wd_alpha_report.md`. **0 deleted entries; no shrinking tracked files.**
- Ownership (at first end): nothing outside the lanes' declared boxes (`wave_plans/W14/lanes.md`) was modified; C-1's seams were untouched by others for the whole watch; L1 has not (yet) used its headless.ts "dod region" allowance.
- Pre-existing, NOT incidents: ` M fixes/218_w12_close_record.md` (mtime 11:40; its diff self-describes as "corrected … W13's WD-A") and ` M research/multiagent/219a_inventory_and_reality.md` (mtime 11:30; contains "[WD-A · 2026-09-24] CORRECTED" blocks). Both predate wave start (`watchdogs.md` mtime 12:52:56).

### 3.1 P1 INCIDENT — Lane 2 out-of-box edit of `scripts/rapidtool-cli.mjs`

- **What:** `scripts/rapidtool-cli.mjs` is modified (at first sight +24/−3, md5 `3d4e1e78…`; **mtime 13:01:25**) — after my 12:59:29 end-capture; caught at the final read (~13:03). **Still in motion at report write:** edited again at **13:02:24** (now +31/−3, md5 `072aadd6c73f6ad298bb7ebafaf91927`; the second write adds `payload.redTreeBanner`/`payload.redTree` on the emit result).
- **Who:** self-identified in the diff: `// W14-L2 (OV-15): expose headless.emitProject's own redTree policy…` → W14-Lane 2.
- **Why it's an incident:** `wave_plans/W14/lanes.md` L2 box is explicit — "**No src/scripts code edits**" — and the wave rule is "you own ONLY the files in your box… If you need a file outside it, **stop and report** instead of editing." (The lane briefs' task text and box are in tension — TA-3's "add `diagnose` to USAGE" literally needs this file — but the operative rule was stop-and-report; the parent must adjudicate.)
- **Content (for adjudication), statically reviewed:**
  - `emit` verb (~:797-815): validates `--red-tree refuse|banner` (else `RT_E_VALIDATION`), passes `redTree` into `h.emitProject(project, target, {force, redTree})` — `headless.ts:1373` (`redTree?: "refuse" | "banner" | "probe"`) and `:1397` (`opts.redTree ?? "refuse"`) confirm the option is real and plumbed. This is a plausible OV-15 "make it reachable" fix.
  - `USAGE`: adds `diagnose` key (TA-3's missing key), adds `--red-tree refuse|banner` to `emit`'s line, and corrects `approve` to include `[--i-am-human]` (that flag is real: `:543-595`, incl. the non-TTY guard + `RT_HUMAN_SEAT_TOKEN`) — a genuine doc-truth fix by content.
  - No silent catches introduced; validation is fail-closed.
- **Process problems:** (a) out of box (above); (b) **unlogged** — L2's landing log `fixes/237_lane2_doc_truth.md` (mtime 12:53:50) still reads "No src/scripts code edits" with every section "(pending)" and does NOT claim or evidence this edit (nor the later README/README-cli writes; log untouched as of ≈13:04); (c) **unverified** — no test run/evidence for the CLI change anywhere at my read time (and `scripts/rapidtool-cli.test.mjs` exists and is the natural gate). (d) It also makes one more HOT file unowned mid-wave, the exact class the ownership rule exists to prevent.
- **Parent options:** retro-authorize (then require L2 evidence: `node --experimental-strip-types --test --test-concurrency=2 scripts/rapidtool-cli.test.mjs` + the USAGE-count re-derivation) or revert the file and keep TA-3 as a registered gap. My report is read-only on this — no fix applied.

## 4 · Plan-corpus guard

| file | size | md5 (start 12:53 = mid 12:58 = end 12:59 = final read) |
|---|---|---|
| research/multiagent/220_tasklist_canonical.md | 56593 | b39d5484d242539cea9b1159b3ab71d8 |
| research/multiagent/220_overhaul_plan.md | 32187 | 1b140aacd5d034b3cabf040361399246 |
| research/multiagent/230_task_execution_playbook.md | 98773 | 37289c05c710f07bfdcb9acf27ae331e |
| fixes/228_ledger_and_risk_register.md | 46027 | e8f0a0c2f8d25d6b0254d874df6dc0d3 |

- No shrink; no mutation (four measurements: 12:53 → 12:58 → 12:59 → 13:03). Snapshot at `C:/Users/mnril/w14wd_beta_backup/corpus/…` + `manifest_start.txt`; **restorability proven** (backup-copy md5s == live md5s, re-checked).

## 5 · Watch items for wave close (not findings)

- **§3.1's P1 incident: parent adjudication required before close** (retro-authorize + evidence, or revert).
- **L1 (C-2): in flight during my watch.** First read (12:58, md5 `5cc7f87…`): predicate only. By ~13:01 (md5 `18b4423c…`): drain wiring landed — `run-eval.mjs:656` predicate, `:707` use, `:708-732` dod branch (`position:"dod"`, `onTime:true`, `stall=dodMsg` from the "DoD unmet" event, `code:"RT_E_GATE_PENDING"`), `:929-949` stopCode precedence, `:1038-1041` row field. Its own log still says IN PROGRESS with evidence PENDING; its new (d) test expectations now statically match the wiring, but **runtime verification is NOT done** (my 2-run budget was spent on the mandated C-1 file; lane test re-runs are WD-α's mandate). **Close condition: L1 RED-first + GREEN evidence pasted; `scripts/run-eval.test.mjs` green.**
- **L3:** guard fix diff (`scripts/browser-guard.mjs:34-47`, resolve-both-sides; `..`-escape prefix logic preserved) reads sound statically; smoke run + pixels still TODO in its skeleton log.
- **L2:** besides §3.1, its doc landing has since begun — by the last glance (≈13:04) `README.md` (+24/−14) and `scripts/README-cli.md` (+21/−3) are modified (in box), while its landing log `fixes/237_lane2_doc_truth.md` is STILL the 12:53:50 skeleton with every section "(pending)" and no mention of the §3.1 CLI edit — bytes are landing silently; parent should require the full evidence pass (every count re-derived by command) before close.
- **WD-α report (`fixes/238`) was still a skeleton** at 12:54–13:00 (`lanes polled: 0`); expect it filled before close.

## 6 · Method & limits (declare-or-strike applied to me)

- Ran: read-only `git status/diff/show`, `grep`/`read_file`, `md5sum`/`stat`, one `node -e` ledger read, and my one real test run (§1.1). Snapshot/manifest/evidence copies → `C:/Users/mnril/w14wd_beta_backup/` (`manifest_start.txt`, `gitstatus_start/mid/end.txt`, `c1_headless_diff.txt`, `c1_test_diff.txt`, `c1_diffstat.txt`, `headless_BASE.ts`, `headless_test_run1.txt`, `headless_test_run2.txt`, `236_c1_wb1_deadlock_fix.md`, `corpus/`).
- Timing note: "first end" capture = 12:59:29 (predates the §3.1 edit mtime 13:01:25); "final" reads ≈13:03. The incident was found in the final pass, not missed-and-ignored.
- NOT run (forbidden / out of budget): `npm run typecheck`, `npm test`, `npm run build`; lanes' own test files; any git mutation. No files edited except this report; no src/scripts/plan files touched.
- Every claim above carries its `file:line` or command; the UNVERIFIED list is explicit in §1.6.
