# fixes/260 — W22 · LANE 3 · LEDGER CORRECTIONS + THE W20/W21 RESIDUALS REGISTER

**Status: LANDED.** Owner: W22-L3. **Box:** `fixes/257_error_ledger_v3.md` (append-only `> [W22-L3] …` markers ONLY — never a rewritten row) + this log. **Scratch:** `C:/Users/mnril/w22l3_scratch/`.
**Read first:** `wave_plans/W22/bugfix-wave.md` §LANE 3 · `fixes/257_error_ledger_v3.md` · `C:/Users/mnril/w21wd_scratch/tsc_baseline_union.txt` (the watchdog's evidence).
**Read window:** 2026-09-24 18:37–18:47 CDT (a **live snapshot** — W22 L1/L2 were in flight; every live-state claim is timestamped or labelled). **Host rule obeyed:** all node/tsc/eslint runs FOREGROUND; **no `npm run typecheck|test|build`** anywhere — scoped direct commands only.

## BOTTOM LINE

1. **The “29 vs 1” correction IS IN `fixes/257`** — 7 marker blocks in 4 additive insertions (3 inline: under #69, under #68, under the open register; + a 4-marker end addendum), all `> [W22-L3] …`: (a) W20-L4's handoff claim (“29 latent type errors”) was **INFLATED** — the watchdog's independent scoped typecheck found **exactly 1** (TS2322 `openai-compatible.ts(163,3)`, since fixed → **0**), evidence cited byte-for-byte; (b) the **parent's W21 brief propagated the inflated count** (`wave_plans/W21/fix-wave.md:46` + `:48`) — marked.
2. **Count sweep: 10 load-bearing handoff-propagated counts re-derived with one scoped command each → 8 CONFIRMED · 2 CORRECTED** (“29”→1, now 0; “118”→119) · 1 labelled not-re-derivable (“52 program diagnostics”, whole-program typecheck parent-owned). Plus 3 bonus re-derivations (p6 §P1/§P2 numbers; W19 batch counts; the W20-L1 scaffold claim — **corrected**).
3. **Residuals register: complete** (§3 below — 28 rows covering every still-open W20/W21 item: W21-L1's finished items, WD-α's 4 incidents incl. the P1-flagged one, WD-β's 6 ready-to-fix items' post-W22-L1 status, p6 §P1/§P2, all log-debt skeletons, the live-artifact doctor red), each with owner + status.
4. **Append-only proof:** `fixes/257` **157 → 175 lines**; `diff` vs the pre-edit copy = **18 added · 0 removed · 0 changed · 4 hunks** (`w22l3_scratch/257_diff.txt`); pre md5 `32705c4ea87071e3da690b696ecfb426`, post md5 `d3f31a2380f448a9f717158d68ebcf1f`.

---

## 1 · The “29 vs 1” correction (evidence chain)

**The claim:** “the dead W19 lane left **29 latent type errors** in your box” — W20-L4's handoff, **relayed verbatim by the parent's W21 brief** (`wave_plans/W21/fix-wave.md:46`; `:48` “Enumerate the 29 errors with a SCOPED typecheck”), and the starting fact of W21-L2's lane. The W22 brief §“TWO CORRECTIONS” (item 1) records the refutation.

**The independent evidence (three measurements, one number):**

| # | measurement | file / command | result |
|---|---|---|---|
| a | **W21 watchdog's scoped typecheck** of the union of W21 boxes (the brief's cited evidence) | `C:/Users/mnril/w21wd_scratch/tsc_baseline_union.txt` — 551 B · 3 physical lines · md5 `6aacb5bbc5f1b5652c4b881a00ef4365` · mtime 2026-09-24 18:24:32 CDT (raw tsc output, verbatim) | **EXACTLY 1 diagnostic:** `error TS2322 … openai-compatible.ts(163,3)` — `Type 'string' is not assignable to type 'LlmProviderId'` |
| b | **W21-L2's own arrival typecheck** (scoped config, same box) | `w21l2_scratch/tsc_before.txt` (577 B — the same single error) → after the type-only fix, `tsc_final2.txt` | **1 → 0** (exit 0) |
| c | **W22-L3 re-derivation on current bytes** (this lane) | `cd /c/Users/mnril/w21l2_scratch && node ".../typescript/bin/tsc" -p tsconfig.scoped.json` (18:40:32) | **exit 0 · 0 errors** (no output) — plus eslint on the box **exit 0 · 0 problems** |

**Provenance note (why no “29” can be reproduced):** W21-L2 searched for it and recorded the finding in its own log — `grep -rn "29 latent|latent type" fixes/` → only W21's own plan; `fixes/256` (W20-WD-α) captures lint/TAP, never a tsc list (`fixes/258_lane2_f2_finish.md` §0). W22-L3 re-searched repo-wide (`grep -rn "latent" --include=*.md .` → the phrase exists only in `wave_plans/W21/fix-wave.md:46` + `wave_plans/W22/bugfix-wave.md:18`): **the 29 traces to lane-report prose, not to any re-runnable artifact.** Honest reading: W19 left some set of latent errors; W20-L4 fixed what it found and died before verifying; the surviving measurable count was **1**.

**Markers landed in `fixes/257` (all additive):**

| marker | placement | content |
|---|---|---|
| `> [W22-L3] CORRECTED — “29 vs 1”` | directly under row **#68** (W20-L4's box / registry.test.ts) | the inflated claim + watchdog file citation (bytes/md5/mtime) + W21-L2 cross-evidence + W22-L3 re-derivation; also records #68's MID-EDIT state as RESOLVED (eslint 0) |
| `> [W22-L3] UPDATE` | directly under row **#69** | the import-crash half is FIXED-APPLIED (W21-L1/W22-L2 certification, 119/119); row stays OPEN on the 28/36 coverage red + p6 §P1/§P2 |
| `> [W22-L3] CONFIRMED` | under §STILL-OPEN register (open list = 19) | re-derived count + arithmetic + shortlist + register pointer |
| `§W22-L3 ADDENDUM` (4 markers) | end of file, after §Method | the full chain (W20-L4 handoff → W21 brief propagation → W21-L2/watchdog refutation → W22 record); the 118→119 adjacent correction; the sweep summary; the register pointer; the rule: *never propagate an unchecked count* |

**Append-only proof** (the requirement: “verifiable via git diff line counts”): pre-edit copy `w22l3_scratch/257_pre.md` (md5 `32705c4e…`, 157 lines) vs post (`md5 d3f31a23…`, 175 lines) → `diff` output contains **only `>` lines (18)**, zero `<` lines, 4 insertion hunks; no existing byte altered. `fixes/257` is untracked in git (`??`), so the pre-copy is the reference for any re-check.

## 2 · The count sweep — 10 most load-bearing handoff-propagated counts (one scoped command each)

| # | claim (where it was propagated) | re-derivation (command → result) | verdict |
|---|---|---|---|
| 1 | **“29 latent type errors”** — W20-L4 handoff → W21 brief:46/:48 | scoped tsc on the current providers box (`tsconfig.scoped.json`, 18:40:32) → **exit 0 · 0 errors**; watchdog baseline file = exactly 1 (raw, 551 B) | **CORRECTED → 1 (now 0)** |
| 2 | **“registry 29/29 base”** — W19 plan:70 · W20 plan:74 · W21 brief:50 | `git show HEAD:src/lib/llm/providers/registry.test.ts \| grep -cE '^\s*(it\|test)\('` → **29** (now 39: +8 F2 +2 W21-L2) | **CONFIRMED** |
| 3 | **“registry 39/39 · llm 14/14 · mock 12/12”** — W21 brief:15 · W21-L2 §3 | ONE foreground run of the three files (18:40:11) → **# tests 65 · # pass 65 · # fail 0 · exit 0**; static 39+14+12 = 65 ✓ (`R1R2_raw.txt`) | **CONFIRMED** |
| 4 | **“codegen.server.test.ts 118/118 (base 112)”** — W21 brief:14 · W22 brief | static: `git show HEAD:` = **112** ✓; current file = **119** test rows; W22-L2 foreground ×2 = **119/119 exit 0** (`fixes/260_lane2_certify_fix.md` §1a) | **CORRECTED → 119/119** (W21-L1's 118 off by one) |
| 5 | **“headless 92/92”** — W20-L3 §3 · WD-α E5 + WL3-3 · ledger #68-era | foreground run of `src/lib/headless.test.ts` (18:40:49) → **# tests 92 · # suites 28 · # pass 92 · # fail 0 · exit 0** (`R3_headless_raw.txt`) | **CONFIRMED** |
| 6 | **W19 cert run “113/113” = run-eval 30 · cassette 31 · policy-overlay 25 · policy 27** — WD-α RUN #1 (`fixes/256` §4) | static counts 31·31·25·27 = **114**; one foreground run of the same 4 files (18:40:15) → **114/114 · 0 fail · exit 0** | **CONFIRMED (+1 drift explained:** run-eval gained L2's `acceptanceFailReason` test after RUN #1) |
| 7 | **“run #2 = 6/9, mean 0.6667; run #1 5/9 → #2 6/9; acceptance filesOk+contentOk, pass:false; emitError null; stall ‘P6 DoD unmet: p6-verified, p6-brief-fit, p6-arch’”** — ledger #64/#66 + all briefs | node read of `research/eval-out/results.json` + `history.json` (18:42:27) → mean **0.6667**; history totals **5 → 6** (0.5556 → 0.6667); acceptance + notes fields **exact** | **CONFIRMED** |
| 8 | **“W19 batch: 3 landed / 3 skeletons; 122/194/200 vs 37/23/31 lines”** — ledger #63 | `wc -l` on `fixes/252_lane{1..6}_*.md` → **37 / 122 / 23 / 194 / 31 / 200** exact; lanes 1/3/5 still carry “IN PROGRESS” | **CONFIRMED** |
| 9 | **“71 uncommitted files”** — ledger §BATCH-FIX-ORDER (and 64→74→75→76 across W20/W21 logs) | `git status --porcelain \| wc -l` → **80** @18:39 CDT (trajectory consistent: lane logs + scratch-side artifacts keep landing) | **CONFIRMED (dynamic snapshot)** |
| 10 | **ledger arithmetic “total 69 · open 19 · fixed 43 · env 6 · observed 1” + shortlist 6** — ledger §BOTTOM LINE / §MASTER TOTALS / §READY-TO-FIX-NOW | enumeration + arithmetic → 19+43+6+1 = **69** ✓; open list = **19 items** ✓; shortlist = **6** ✓ | **CONFIRMED** |

**Bonus re-derivations (beyond the cap, kept because they were cited downstream):**

- **p6 §P1/§P2 measured numbers** (`fixes/255_lane2_probe_truth.md`; re-relayed by W21-L2 §5) — re-ran W20-L2's own probes (`w20l2_scratch/probe_p6.ts` + `probe_union.ts`, 18:42:30): run #2 artifact **identifierHits 16 < bar 49** ✓, **missing 28 of 36** capabilities ✓, `stubFiles []` ✓; full 2026-09-10 tree: **current 0 vs union 63** ✓, `missing=0` + `stubFiles ["src/generated.ts"]` (reexportOnly) ✓ — **CONFIRMED, byte-for-byte.**
- **“W20-L1 fix landed (in-box, scaffold emission)”** (`fixes/255_lane1_tree_green.md` bottom line) — **NOT supported by surviving bytes:** `git status src/lib/scaffold.ts` → clean vs HEAD; no `commonjs` declaration in the file (only `type: "module"` at :588); W21-WD T0 recorded scaffold.ts clean (sha256 `ddd08e7c…`). The fix that survives is W21-L1's `codegen.server.ts` route (W21 brief: “scaffold.ts untouched”). **→ claim needs a close-out correction (register row 24).**
- **“scaffold.ts is DIRTY from prior waves”** (W21 brief:29) — **FALSE as of W21** (clean vs HEAD at T0 and now). Same register row.

**Labelled NOT re-derived (honesty):** “52 program diagnostics” (#67 — needs the whole-program typecheck; parent/WD-owned, and scoped runs cannot reproduce it) · W19-L6's `[EXT-FAIL]` ledger detail (read, not re-run) · #15's exact `minted: false` line pins (headless.ts drifted since; not re-measured) · #18/#31 (not re-measured — labelled, same as the ledger's own method note).

## 3 · The W20/W21 RESIDUALS REGISTER (complete; owner + status @ 2026-09-24 18:47 CDT, live)

**W21-L1 (THE FIX) — finished items, for the record:** the single-chunk ESM fix is **FIXED + CERTIFIED at unit/probe level** (suite **119/119**, both probes green, pre/post tenant import proof, `TREE_IMPORT_OK exports=[…]` — `fixes/260_lane2_certify_fix.md`); the two “un-run items” from W21 are now **run** (that certification). Residuals from this lane are only: its **log skeleton** (row 5), the **118→119 count correction** (done, §2), and the **layer-2 coverage red** (row 2).

| # | item (still open unless marked) | source (bytes) | owner | status |
|---|---|---|---|---|
| 1 | Run #3 tree-run green-ness: **NO — not by itself** (fix removes the crash; run #2's partial tree fails 28 of 36 capability rows; `treeRun()` on those bytes = `ok:false`) | `fixes/260_lane2_certify_fix.md` §3 | parent / run #3 | **OPEN** — awaiting run #3's synthesis coverage; no greenwash |
| 2 | **p6-brief-fit §P1** — tree-aware read of `generatedSource` (4-line `dod.ts` proposal; 0→63 hits on a full tree, no rescue of refused runs) | `fixes/255_lane2_probe_truth.md` §P1 | parent (dispatch) | **OPEN** — proposal only; recommended AFTER run #3; gate-suite pins to re-run |
| 3 | **p6-arch §P2** — barrel-as-stub exemption; **needs an owner ruling** (conflicts `doctor.test.ts:383-395` W18-OV-9 pin; companion edit required if changed) | `fixes/255_lane2_probe_truth.md` §P2 | parent (ruling) | **OPEN** — blocked on the ruling |
| 4 | EXT-FAIL rows 2/3 (tree-mode probe mismatch; engine barrel classified stub) | `fixes/255_lane2` [EXT-FAIL] | parent | **OPEN** — same defects as #2/#3 |
| 5 | EXT-FAIL row 4 (journey burn: 2×240 s/chunk attempt, failed pass overwrites full tree with partial) | `fixes/255_lane2` [EXT-FAIL] | parent | **OPEN** — context/known cost |
| 6 | EXT-FAIL row 1 — **`doctor.test.ts` RED on the live worktree** (pin reads the live eval artifact; run #2 overwrote the tracked tree) | re-derived TODAY: 19 pass / 1 fail, exit 1; failing at `doctor.test.ts:382` → `[] vs ['src/generated.ts']` (`R9_doctor_raw.txt`) | parent / lane | **OPEN (live red)** — fix proposal = committed fixture copy |
| 7 | **WD-α I1 (P1-FLAGGED)** — W20-L2 edited W19-landed `scripts/run-eval.mjs` + `run-eval.test.mjs` (declared box; wave plan's box text differed) → adjudication requested | `fixes/256_w20_wd_alpha.md` §3 | parent | **OPEN** — no ruling recorded in W21 or W22 briefs; mitigation on disk (additive, tested: now 31/31 inside the 114/114 run) |
| 8 | WD-α I2 — inherited red (mock.test.ts census pin, red ~14:46→18:01) | `fixes/256` W19-19 | W20-L4 (done) | **CLOSED** — repaired; re-verified 12/12 today |
| 9 | WD-α I3 — `headless.ts` no-op touch 18:02:42 | `fixes/256` §3 | — | **CLOSED (benign)** |
| 10 | WD-α I4 (carry-forward) — W19's `.env` rewrite, attribution open | re-checked: `.env` unchanged 14:38:42 · 250 B | parent/house | **OPEN (benign)** — never re-triggered |
| 11 | **#52** `git.server.ts:152` TS2345 | ledger shortlist #1 | **W22-L1** | **in flight** @18:47 (its log still all-TBD; ledger row unchanged) |
| 12 | **#24** `fixes/241_lane3_browser_residuals.md:38` `[fill]` | ledger shortlist #2 | W22-L1 | in flight (same) |
| 13 | **#14** `fixes/236:51` typo | ledger shortlist #3 | W22-L1 | in flight (same) |
| 14 | **#62** `wave_plans/W19/lanes-and-watchdogs.md:12` stale text | ledger shortlist #4 | W22-L1 | in flight (same) |
| 15 | **#50** `--test-name-pattern` no-op-trap codification | ledger shortlist #5 | W22-L1 | in flight (same) |
| 16 | **#28** skill-file size/split (non-repo) | ledger shortlist #6 | W22-L1 | in flight (same) |
| 17 | **#37** flagged (chat.server.ts:561 / crew.server.ts:877 seams) | ledger §flagged | parent (dispatch) | **OPEN** — not dispatched |
| 18 | **#51** flagged (`types.ts` `ArtifactProvenance`) | ledger §flagged | parent (dispatch) | **OPEN** — not dispatched |
| 19 | **#68** registry.test.ts 5 warnings | ledger row #68 | W21-L2 (done) | **CLEARED** — eslint exit 0 · 0 problems re-derived today; marker added |
| 20 | **#69** import-crash half | ledger row #69 | W21-L1 (done) | **UPDATED** — FIXED-APPLIED marker; residual = row 1 here |
| 21 | **#15/#16/#17/#18** headless precision items (repair-FAILED pins, stale comments/doc) | ledger §stand-as-is | parent / close-out | **OPEN — dispatchable now** (headless.ts stable since W20-L3 landed; no live box) |
| 22 | **#63** W19 batch-death close-out (pickups verified + landed lanes certified) | ledger row #63 · `fixes/256` §0 (all three W19 landings **certified**) | parent / WD close | **OPEN (process)** — certification done; the WD-α report is still INTERIM @p7/18:12 and the formal close-out marker is absent |
| 23 | **#59** `fixes/250` interim · **#60** skeleton logs (`249_lane1/2/5`, `252_lane1/3/5`, `255_lane3/4`) · **#67** EXT-FAIL accounting | ledger §still-open | parent / close-out | **OPEN** — log debt; note **new**: `258_lane1` joins the list (row 24) |
| 24 | **W21-L1's log `fixes/258_lane1_single_chunk_esm.md` is a SKELETON** (all sections pending; numbers live only in briefs/scratch) + **W20-L1's log claim** (“fix landed — scaffold emission”) unsupported by bytes + **W21 brief:29 “scaffold.ts is DIRTY”** false | `fixes/258_lane1` (30 ln) · `fixes/255_lane1` §4 · W21 brief:29 · re-checks §2-bonus | parent / close-out | **OPEN** — flagged by W22-L2 §4 and this register; correction recorded here (not a 257 row — 257 never carried these claims) |
| 25 | **W21 WD report `fixes/259` INTERIM** — claims/§5/§6/§7 pending; **RUN3-readiness never certified by it**; W22 brief: its precondition is now satisfied (L1's evidence) | `fixes/259_w21_wd.md` | **W22 WD** | **SUPERSEDED → W22-WD re-certifies** (the gate for run #3) |
| 26 | **#61-flag** — `policy.*` code family ratification (F4 verdict-refusal design decision) | ledger §SUPERSEDE MARKS | parent / close-out | **OPEN** — flagged, not silently closed |
| 27 | W21-L2 “next-wave candidates”: xAI-specific 429/5xx retry/timeout pin absent; adapter inner guard unreachable via typed call sites (defense-in-depth, deliberately untested) | `fixes/258_lane2_f2_finish.md` §5 | next wave | **OPEN (candidate, no claim made)** |
| 28 | v3 → v4 ledger close-out (W20/W21/W22 landings + these corrections) | this file + `fixes/257` | parent / wave close | **OPEN (process)** — the ledger still freezes @18:07 2026-09-24 |

**Closed/finished (for contrast, not register rows):** W19 landings F4/OV-7/T5.7 — **certified** (WD-α RUN #1, 113/113; re-measured 114/114 today) · T5.1+F2 pickup — **landed + green** (65/65, tsc 0, eslint 0 today) · G2 silent-skip rows (W20-L3) — **landed + 92/92** · the single-chunk ESM fix — **certified** (row 1) · #61 (superseded by design), #65, #66 — fixed per ledger.

## 4 · Run ledger (all FOREGROUND; no `npm run …`; scratch = `C:/Users/mnril/w22l3_scratch/`)

| run | command (scope) | ts CDT | result | capture |
|---|---|---|---|---|
| R1 | `node --experimental-strip-types --test --test-concurrency=2 registry.test.ts llm.test.ts mock.test.ts` | 18:40:11 | 65/65 · 0 fail · exit 0 | `R1R2_raw.txt` |
| R2 | same runner · `scripts/run-eval.test.mjs cassette.test.ts policy-overlay.test.ts policy.test.ts` | 18:40:15 | 114/114 · 0 fail · exit 0 | `R1R2_raw.txt` |
| R3 | same runner · `src/lib/headless.test.ts` | 18:40:49 | 92/92 · 0 fail · exit 0 | `R3_headless_raw.txt` |
| R7 | scoped `tsc -p w21l2_scratch/tsconfig.scoped.json` | 18:40:32 | exit 0 · 0 diagnostics | (inline) |
| R8 | direct `eslint registry.test.ts openai-compatible.ts` | ~18:40:3x | exit 0 · 0 problems | (inline) |
| R9 | same runner · `src/lib/doctor.test.ts` | 18:42:17 | 19 pass / 1 fail · **exit 1** (live-artifact red, expected) | `R9_doctor_raw.txt` |
| R5a/b | W20-L2 probes `probe_p6.ts` + `probe_union.ts` re-run | 18:42:30 | all cited numbers exact | `P1_probe_p6.txt` · `P2_probe_union.txt` |
| R6 | `node read_run2.cjs` (results.json + history.json read) | 18:42:27 | all cited numbers exact | (inline) |
| — | statics: HEAD-vs-NOW test counts · W19 log `wc -l` · uncommitted count · md5s · append-only `diff` | 18:39–18:47 | §2/§3 + proof | `257_pre.md` · `257_diff.txt` |

**Honesty limits:** the register is a **live snapshot** — W22-L1's six-item queue was mid-flight at my read (log all-TBD; a recheck before close is advised; the ledgers' markers will tell). “52 diagnostics” and #15/#18/#31 are labelled not-re-derived (above). Counts were re-derived by static read and/or scoped runs only — never by the forbidden full-gate commands. The watcher owns run #3; nothing here asserts run #3's outcome beyond W22-L2's evidence-backed “not by itself”.
