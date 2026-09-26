# fixes/257 — W20 · WD-β · THE ERROR LEDGER v3 (append-only continuation of fixes/254; v1/v2 never rewritten)

**OWNER:** WD-β (error-ledger keeper, W20) · **built:** 2026-09-24 17:58 → 18:07 CDT · **STATUS: COMPLETE** (v3 snapshot; W20 lanes are live — their landings belong to the wave's close-out / v4).
**Scope:** READ-ONLY everywhere else; this file + `C:/Users/mnril/w20wd_b_scratch/` are the only writes. **No git mutations.** ≤2 owned FOREGROUND runs — used exactly 2: **E5** (headless suite) + **E6** (lint).
**Continuation rule (inherited):** v1 (`fixes/251_error_ledger.md`) and v2 (`fixes/254_error_ledger_v2.md`) are **never rewritten**. This file **appends** rows `#63+` and **supersedes v2 rows only by marking** (§SUPERSEDE MARKS — v2's bytes stay as they were). v1 owns #1–#51, v2 owns #52–#62 and its method notes.
**Sources:** `fixes/254` (v2 baseline) · W19 batch-death forensics (disk: `fixes/252_lane{1..6}_*.md` line counts + mtimes; W20 pickup triage `fixes/255_lane{1,2,3,4}*.md`) · `_step0_run.log` + `_step0_run2.log` + `_step0_run2.sh` (the two keyed runs' own logs, home dir) · `research/eval-out/history.json` · `research/eval-out/results.json` (run #2 row) · `research/eval-out/run-in-progress.json` · `src/lib/headless.ts` / `scripts/run-eval.mjs` byte reads · W20 lane logs `fixes/255_*` · the two living diagnostics this watchdog owns (E5/E6) · direct byte reads timestamped 17:58–18:07.
**Host artifact rule (inherited; v1 #1–#3):** node under the Hermes BACKGROUND harness dies `stdin is not a tty`, exit 1, zero output — never a code failure. Everything here ran FOREGROUND.

---

## BOTTOM LINE (final)

```text
total: 69 · open: 19 · fixed: 43 · env-artifact: 6 · ready-to-fix-now: 6
```
- **Buckets:** open = OPEN + MID-EDIT · fixed = FIXED-APPLIED + FIXED-STRKED · env-artifact rows were never code failures · **observed = 1** (row #64, a run-record delta closed as measurement; counted in `total`, in neither open nor fixed). Arithmetic: **19 + 43 + 6 + 1 = 69** ✓.
- **THE ONE THING (v3):** row **#63** — W19's batch died mid-flight ("delegation owner exited before recording a terminal result", last lane write 14:51:47) with **3 lanes LANDED / 3 SKELETONS-with-partial-edits**; the skeletons' partial edits are now W20 pickups L3/L4, and the keyed run's remaining zeros are three: M2/M3/M4 (6/9, `pass:false` by design — see #66).
- **Gate status at this snapshot:** **E5 headless 92/92 GREEN**; **E6 lint exit 0 but NOT zero problems — 5 warnings (row #68, W20-L4 in-lane)**. The last open typecheck item remains **#52** (`git.server.ts:152` TS2345, byte-inference — parent/boundary-only).
- **Delta vs v2:** **+7 rows** (#63–#69: 3 fixed-closed, 4 open) · **1 v2 row superseded by marking** (#61 → FIXED-APPLIED) · **0 v1/v2 bytes changed.**
- **READY-TO-FIX-NOW (6, ordered):** **#52** → **#24** → **#14** → **#62** → **#50** → **#28**. Flagged-awaiting-dispatch: **#37**, **#51**. Held by W20 lane boxes: #15–#18, #31 (headless.ts — L3), #68 (registry.test.ts — L4), #69 (W20-L1).
- **Brief's bottom-line check:** the parent asked for "git.server.ts's 2 TS + 1 lint errors (W18-L3)": **#53/#54 (the 2 TS) are FIXED-APPLIED, #55 (lint) is FIXED-APPLIED (E4 = 0)** — only **#52** (the third TS, measured at the 14:16 boundary) stays open. The `[fill]` items: **one marker remains** (`fixes/241_lane3_browser_residuals.md:38` = #24).

## Living evidence — the two diagnostic runs (WD-β, W20)

| # | exact command | ts (CDT) | result | capture |
|---|---|---|---|---|
| E5 | `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` (FOREGROUND) | 18:01:56 → 18:03:15 (79 s) | **exit 0 · `# tests 92 · # suites 28 · # pass 92 · # fail 0 · # cancelled 0 · # skipped 0 · # todo 0`** — `grep -c "not ok"` → **0** | `C:/Users/mnril/w20wd_b_scratch/headless_v3.txt` (27,323 B) |
| E6 | `npm run lint` (FOREGROUND) | 18:03:15 → 18:03:39 (24 s) | **exit 0 · 5 problems (0 errors, 5 warnings)** in `src/lib/llm/providers/registry.test.ts` — **NOT zero problems** (v2's E4 was 0) → row **#68** | `C:/Users/mnril/w20wd_b_scratch/lint_v3.txt` (877 B) |

**Evidence notes (honesty):** E5 ran against `headless.ts` at its **18:01:51 bytes** (167,372 B — 5 s before start; **W20-L3 is editing it live**, `w20l3_scratch/headless.ts.bak` exists). E6 ran 18:03:15–18:03:39; `registry.test.ts` was rewritten again at **18:03:47** (8 s after E6 ended — W20-L4 live), so #68's five warnings are the bytes as of E6. Both captures are the run's raw TAP/eslint output. v2's E3/E4 remain the prior measurement (E3: 92/92 @117.8 s; E4: 0 problems).

## §ADDENDUM — new rows (v3, `#63+`; v1/v2 registers untouched)

Status vocabulary (inherited): `OPEN` · `FIXED-STRIKED` · `FIXED-APPLIED` · `MID-EDIT` · `ENV-ARTIFACT` · **`OBSERVED`** (v3 addition: run-record measurements that are neither code fixes nor failures).

### (1) THE BATCH-DEATH INCIDENT — row #63 (process anchor) + the per-lane disposition table

**#63** | W19 ~14:51 | `deleg_c1b9ddfc` | the W19 delegation **died mid-flight**: "**delegation owner exited before recording a terminal result**" | evidence: the three landed logs' last writes 14:50:27 / 14:51:15 / 14:51:47; the three skeletons last written 14:33:10–14:34:02; v2 `fixes/254` froze 14:42 **pre-death** so nothing after 14:42 was ever ledgered | **OPEN** | parent + W20-L3/L4 | process — the skeletons are W20 pickups; the landed lanes were never watchdog-certified (their own WD-α died too) → **inherited by W20 WD-α**. Clause: HARNESS/process artifact, not a code failure.

**Per-lane disposition (exact disk evidence — `wc -l` + `stat` read 17:58–18:00 CDT):**

| W19 lane | box | log file | log lines | log mtime (CDT) | log state | code-on-disk state |
|---|---|---|---|---|---|---|
| L1 | OV-13 + OV-29 (silent degrades → coded rows) | `fixes/252_lane1_ov13.md` | **37** | 14:33:10 | **SKELETON** ("STATUS: IN PROGRESS", sites TBD) | **PARTIAL EDITS**: `engine.ts` +134 / `headless.ts` +91 / `lesson-writers.test.ts` +210 (W20-L3's `git diff` triage, `fixes/255_lane3_ov13.md:11-14`); last writes 14:39:41 / ~14:44:05 / **14:51:21** |
| L2 | F4 (per-action allow-lists, narrow-only) | `fixes/252_lane2_f4.md` | **122** | 14:50:27 | **LANDED** (bottom line + evidence table complete) | landed: `policy.ts` +247, `policy-overlay.test.ts` 25/25, `console.tsx` +55/-3 |
| L3 | T5.1 (chat streaming NDJSON) | `fixes/252_lane3_t51.md` | **23** | 14:34:02 | **SKELETON** ("IN PROGRESS (skeleton…)") | **PARTIAL EDITS**: `chat.ts` (14:44:09), `chat.test.ts`, `scripts/chat-stream.test.mjs` (W20-L4 triage, `fixes/255_lane4_t51_f2.md` §pickup) |
| L4 | OV-7 (briefLeak — agent-facing leak audit) | `fixes/252_lane4_ov7.md` | **194** | 14:51:47 | **LANDED** (last write of the whole batch) | landed (briefLeak in run-eval.mjs + tests) |
| L5 | F2 (2nd provider family) | `fixes/252_lane5_f2.md` | **31** | 14:33:10 | **SKELETON** ("IN PROGRESS (skeleton…)") | **PARTIAL EDITS**: `registry.ts` (14:46:05), `registry.test.ts`, `openai-compatible.ts` (14:37:48), `probe.ts` (14:38:36) |
| L6 | T5.7 (cassette record/replay) | `fixes/252_lane6_t57.md` | **200** | 14:51:15 | **LANDED** (includes an `[EXT-FAIL]` ledger — see #67) | landed: `cassette.ts` + test |

- Ledger arithmetic: **122 + 194 + 200 = 516 lines** of landed-lane evidence vs **37 + 23 + 31 = 91 lines** of skeleton. The three skeletons' mtimes (14:33–14:34) precede the death (~14:51) by ~17 min → written at lane start, **never re-filled** (the #60 class, now escalated: the lanes themselves died).
- **Recovery already dispatched:** W20-L3 owns L1's pickup (reads its skeleton + `git diff`, completes the partial edits); W20-L4 owns L3+L5's pickups (both partial-edit sets confirmed on disk).

### (2) run #1 → run #2 — rows #64 (the delta) + #65 (the stale-dir root cause) + #69 (what the tree-run still fails on)

**#64** | W20 14:43→14:49 | keyed pair | **the two keyed runs' measured delta** | sources: `_step0_run.log` (run #1), `_step0_run2.log` + `results.json` (run #2), `history.json` rows @19:43:05.238Z / @19:49:11.015Z | **OBSERVED** | — | run-record delta: totals **5/9 → 6/9** (mean 0.5556 → 0.6667; both `status:"dod"`, both `pass:false`, both stopped `RT_E_GATE_PENDING`); **M6 0 → 1**; **emitError non-null (refused emit) → `null`**; **acceptance `missing package.json; missing index.html; missing README.md` → `filesOk:true` + `contentOk:true`** (`checked:{expectedFiles:3,expectedContent:1}`). Run #2 marker (`run-in-progress.json`): started 19:45:35.962Z, `done:true`, `meanOfNine:6.0003`, `decision:"band-expected"`, `resultsWritten/historyWritten:true`. Residual zeros unchanged: **M2/M3/M4 = 0** (`treeRunOk:false` · `journey:"failed"` · stall „P6 DoD unmet: p6-verified, p6-brief-fit, p6-arch" · `p6Refused:true` · `synthesisSucceeded:true`).
- **Byte context (honesty):** run #2 executed with W19's in-flight lane edits already on disk (`policy.ts` 14:39:13 · `headless.ts` 14:44:05 · `run-eval.mjs` 14:40:48 · `chat.ts` 14:44:09 — all before run #2's 14:45:35 start). The m6/acceptance flip traces to the **clean emit dir** (#65), not to those edits.

**#65** | W20 14:44 | step0 run #2 | **the stale-dir root cause, named**: run #1's emit was **refused over the Sep-10 leftover tree** at `research/eval-out/coffeehouse2home-property-ledger/` → m6=0 + all three expected files reported missing; the operator preserved the old dir (`mv … .run-2026-09-10`, `_step0_run2.sh:5-8` — comment: "preserve the 09-10 evidence, then re-run keyed on a clean emit dir") and run #2 emitted **fresh** (all files 14:48) → m6=1 | **mechanism (code-cited):** `src/lib/headless.ts:1586-1599` — `existing = walkEmitRel(target)`; leftovers not in the intended set and not ghost-specs/tests = **foreign**; `if (foreign.length > 0 && opts.force !== true) return { ok:false, code:"RT_E_FOREIGN_FILES", error:"foreign files in emit dir (pass --force to keep): …" }`; run-eval passes only `{redTree:"banner"}` (no force, `run-eval.mjs:1403`) | **disk proof:** the preserved dir vs the fresh dir differ by **9 leftovers** — `src/generated/{check-reorder-flags,chunk-0,compute-rent-roll,create-flip-project}.ts` + `src/jobs/{flip,publish,record,show,track}.ts` (none ghost-class, none in run #2's intended set) | **FIXED-APPLIED** (environment/process) | parent | **the emitter's refusal is correct by design** (it protects foreign files); residual = the benchmark run-book must record the preserve step for any re-run over an existing emit dir. Run #1's literal emitError string is unrecorded (results.json #1 was overwritten) → **classified by code-path + disk inference**, corroborated by the operator's own script comment + the A7 suite's pin ("refuses foreign leftover without --force", `rt_verify_final.test.txt:8490`).

**#69** | W20 14:49 | run #2 record | **what the tree-run still fails on (M2=0, exact evidence, NEW precision)**: the emitted project's own `npm run test` exits 1 in temp dir `rt-treerun-SAj3yQ` at **`src/generated/get-property.ts:250` — `module.exports.getProperty = getProperty;`** (CommonJS export in the ESM-shaped generated module; `results.json` M2 evidence) | `research/eval-out/results.json` (M2 block) + the on-disk emitted tree | **OPEN** | **W20-L1** (critical path) | THE critical-path row: once the emitted tree's run is genuinely green, the C-1 mint fires and `p6-verified` can be satisfied — that is the gate to M2/M3/M4 and to `pass` (with the mean bar of #66). |

> **[W22-L3] UPDATE — the import-crash half of this row is FIXED-APPLIED:** W21-L1 made **every** tree (N=1 included) materialize as real ESM (`materializeImportableTree`, `codegen.server.ts`); certified by W22-L2 (`fixes/260_lane2_certify_fix.md`): suite **119/119** (the W21 “118” is corrected there — base 112 ✓ statically), pre-fix tenant `ReferenceError: module is not defined` → post-fix the spec’s 43 tests execute, `TREE_IMPORT_OK` + `BARREL_IMPORT_OK`. The row stays **OPEN** on the honest residual: run #2’s 1-file partial tree fails **28 of 36 capability rows** (8/36 present) — a `treeRun()` of those bytes still returns `ok:false`; green needs run #3’s synthesis to cover the capabilities the emitted spec asserts. `p6-brief-fit` / `p6-arch` §P1/§P2 remain unresolved (register: `fixes/260_lane3_ledger_corrections.md` §3).

### (3) the acceptance oddity — row #66

**#66** | W20 | run #2 record | **`acceptance.pass:false` with `filesOk:true`+`contentOk:true` — SOLVED: it is NOT an oddity.** The third clause is the **mean bar**: `passesAcceptance` (`scripts/run-eval.mjs:1625-1631`) = (1) mean finite, (2) **`row.mean >= grader.passWhen.meanAtLeast`**, (3) filesOk if required, (4) contentOk if required. The grader (`research/eval-corpus/graders/coffeehouse2home-property-ledger.grader.json` → `passWhen: {meanAtLeast: 1, requireExpectedFiles: true, requireExpectedContent: true}`) demands **all nine bands**; the measured mean is **0.6667** → clause (2) fails first, while clauses (3)/(4) hold. Domain-match is **not** part of `passesAcceptance` | **FIXED-STRKED** (the "oddity" claim is struck — `pass:false` is correct behavior; the fix path is the three zeros, not the predicate) | — | cross-ref: W20-L2's lane will reach the same file:line. |

### (4) `[EXT-FAIL]` accounting — row #67

**#67** | W19→W20 | L6 + W20 lanes | **EXT-FAIL ledger read:** (a) **W19-L6** logged an `[EXT-FAIL]` ledger (`fixes/252_lane6_t57.md:192-200`): other lanes' in-flight typecheck state (**52 program diagnostics** — the #52/#53/#54 class, "not read into, not chased"), host artifacts (`write_file`'s tsc hook fails on the spaced path, TS6053; one approval-scanner misclass), and explicitly **no test/eval failures in-lane**. (b) **W19-L2/L4: none logged** (L2 explicit-none in-lane; L4's 194-line log carries no EXT-FAIL section). (c) **W20: zero EXT-FAILs logged at this snapshot** — `255_lane4 §6 "Notes / risks / EXT-FAIL"` is still a placeholder; `255_lane1/2/3` are skeletons | **OPEN** (accounting live — lanes fill at close) | W20 lanes | completeness note: nothing dropped; the 52-diagnostic figure is the same boundary-only typecheck state #52 names. |

### (5) the W20 measurement regression — row #68

**#68** | W20 18:03 | E6 (this watchdog) | **lint regressed from "0 problems" (v2 E4) to `5 problems (0 errors, 5 warnings)`**, all in `src/lib/llm/providers/registry.test.ts`: `:35 resolveExplicitProvider`, `:42 XAI_BASE_URL`, `:43 XAI_MODELS_ENDPOINT`, `:45 applyProbedModels`, `:47 probeProviderModels` — all `@typescript-eslint/no-unused-vars` (allowed-unused must match `/^_/u`) | `C:/Users/mnril/w20wd_b_scratch/lint_v3.txt` (exact bytes) | **MID-EDIT** | **W20-L4** (F2 pickup) | the unused symbols are F2's probe scaffolding mid-wiring (the W19-L5 partial edits at `registry.test.ts` + the live W20-L4 work). Exit code stays 0 (warnings), but the repo's standing bar is **zero problems** — clear in-lane before the boundary; the file was rewritten again 18:03:47 (live). |

> **[W22-L3] CORRECTED — “29 vs 1”:** W20-L4’s handoff for this box claimed **29 latent type errors** (relayed by the parent’s W21 brief, `wave_plans/W21/fix-wave.md:46`); the W21 watchdog’s independent scoped typecheck of the union of W21 boxes found **EXACTLY 1** — `C:/Users/mnril/w21wd_scratch/tsc_baseline_union.txt` (551 B · 3 lines · md5 `6aacb5bbc5f1b5652c4b881a00ef4365` · 18:24:32 CDT), the single `TS2322 openai-compatible.ts(163,3)` (`id: string` ⊄ `LlmProviderId`). Cross-evidence: W21-L2’s arrival tsc (`w21l2_scratch/tsc_before.txt`, 577 B — the same one error) → after a type-only fix `exit 0 · 0 errors`. W22-L3 re-derivation on current bytes (18:40:32): same scoped config → **exit 0**; box eslint → **exit 0 · 0 problems**. The “29” was INFLATED; no artifact ever enumerated it (`fixes/258_lane2_f2_finish.md` §0/§1). This row’s MID-EDIT state is RESOLVED. Never propagate an unchecked count again.

## §SUPERSEDE MARKS — v2 rows whose state changed since v2's freeze (v2 bytes untouched)

| v2 # | v2 state | NEW state | evidence |
|---|---|---|---|
| 61 | MID-EDIT (W19-L2's proposed `RT_E_POLICY_ACTION_DENIED/ASK` not in errors.ts; out-of-box errors.ts edit would be the P1 screen) | **FIXED-APPLIED (by design decision)** | F4 **landed** (`fixes/252_lane2_f4.md`, 122 ln) with `policy.*` action-scoped refusal codes (`policy.action-off-list:<action>` etc.) and §4.2's rationale (`:107-112`): a policy refusal is a **verdict**, not a thrown failure; minting an unregistered `RT_E_*` would be the "unregistered RT_E" defect class, registering one an out-of-box edit — **no errors.ts change** (re-verified: `grep RT_E_POLICY src/lib/errors.ts` → 0). **Flag:** parent/owner should ratify the `policy.*` code family as contract-conformant at close (flagged, not silently closed). |

**Stand-as-is (v2 rows re-verified 17:58–18:00 — still OPEN):**
- **#14** `fixes/236:51` typo `verifyAndServever` — **still present** (grep → 1 hit).
- **#24** `fixes/241_lane3_browser_residuals.md:38` stale `[fill]` — **still present**; it is the **only remaining `[fill]` in `fixes/`** (grep across all logs).
- **#15** repair-FAILED `minted: false` pair — **drifted +39**: defect sites now **`:2756` / `:2876`** (context `gate: green.gate, treeRun: verdict, minted: false`); truth sites now `:2732` / `:2852` (`minted: green.minted`). Two further `minted: false` sites enumerated: `:2650` (default/base object, `gate:null, treeRun:null`) and `:2904` (failed-outcome return, `gate:null, treeRun:verdict`) — adjudication pending. `headless.ts` is **under live edit by W20-L3** (mtime 18:02:42) → final re-pin at close.
- **#16** stale "NEVER mint lastTest" comment — **still present at `:2076`** (drift from v2's :2037). **#17** stale "minted tested" comment — **still present at `:2716`** (v2: :2677). **#18** stale fn doc — **not re-read** (same file, live edits).
- **#37** `chat.server.ts:561` + `crew.server.ts:877` bare `callModel` seams — **still present** (grep 18:00).
- **#51** `src/lib/types.ts` still has **no** `ArtifactProvenance` (grep → 0; `io.ts` carries 3 refs) — unchanged.
- **#52** `git.server.ts:152` TS2345 — **byte-inference still OPEN**: file unchanged since v2's read (mtime 14:28:09; uncommitted delta +20/-4 vs HEAD); typecheck is parent/boundary-only — the next boundary re-measures.
- **#59** `fixes/250_w18_wd_alpha.md` still `INTERIM (final at close)` (§6 interim; unchanged).
- **#60** `fixes/249_lane1_ov9.md` 28 ln / `lane2_f3.md` 18 ln / `lane5_t54.md` 55 ln — **still skeletons**.
- **#62** `wave_plans/W19/lanes-and-watchdogs.md:12` still carries the stale "unregistered RT_E_GIT_UNAVAILABLE + a type mismatch at :763" text — **still present**.
- **#31 / #50 / #28 / #27-if-strict** — not re-measured this pass (labelled); #50 re-checked as "still not codified" (`grep test-name-pattern` across scripts/src/README → 0 hits).

## §STILL-OPEN register (v3 = 19 rows)

**open list (19):** #14 · #15 · #16 · #17 · #18 · #24 · #28 · #31 · #37 · #50 · #51 · #52 · #59 · #60 · #62 (**v2 carry, 15**) · **#63 · #67 · #68 · #69** (v3 additions).

> **[W22-L3] CONFIRMED — open-list re-derivation:** the enumeration above counts **19** ✓ (15 v2-carry + #63/#67/#68/#69); master arithmetic **19 + 43 + 6 + 1 = 69** ✓; ready-to-fix shortlist = **6** ✓ (all independently re-counted W22-L3, 18:39–18:45 — see `fixes/260_lane3_ledger_corrections.md` §2). The complete W20/W21 residuals register (every still-open item with owner + status — incl. WD-α I1–I4 with the P1-flagged `run-eval.mjs` touch, the p6 §P1/§P2 proposals, all log-debt skeletons, the live-artifact doctor red) is `fixes/260_lane3_ledger_corrections.md` §3.

## §MASTER TOTALS (v1 + v2 + v3)

| component | total | open | fixed | env | observed |
|---|---|---|---|---|---|
| v1 (`fixes/251`) | 51 | 23 | 22 | 6 | — |
| + v2 addendum #52–#62 | +11 | +5 | +6 | +0 | — |
| − v2 supersedes (#38–#49) | 0 | −12 | +12 | 0 | — |
| = v2 (`fixes/254`) | 62 | 16 | 40 | 6 | — |
| + v3 addendum #63–#69 (7 rows) | +7 | +4 (#63,#67,#68,#69) | +2 (#65,#66) | +0 | +1 (#64) |
| − v3 supersede (#61) | 0 | −1 | +1 | 0 | — |
| **v3 (this file)** | **69** | **19** | **43** | **6** | **1** |

- Arithmetic: **19 + 43 + 6 + 1 = 69** ✓.
- fixed added in v3 (3): #65 · #66 · #61 (supersede). #64 is the observed row (closed as measurement, in neither bucket).

## §BATCH-FIX ORDER (severity first)

1. **GATE-CLASS (boundary blockers):**
   a. **#68** — clear `registry.test.ts`'s 5 warnings in-lane (W20-L4); the repo bar is zero problems at every boundary.
   b. **#52** — `git.server.ts:152` TS2345: the single open typecheck item; fix at the boundary (the run confirms #53/#54 in one pass) and commit the W18-late set with per-file attribution. **Boundary hygiene: 71 uncommitted files** (v2: 64) — keep `.hermes-tmp.*` tool temps out.
2. **CRITICAL PATH (the wave's named purpose):** **#69** (W20-L1 — tree-run green) → then a keyed run **#3** re-measures M2/M3/M4 against the #64 baseline (6/9); **#66** shows `pass` additionally needs the mean bar (all nine), so tree-green alone moves M2 (and M4/M3 via verified/brief-fit); **#67** (lane EXT-FAIL fills) closes the accounting at the same time.
3. **PRECISION ITEMS:** **#15** (re-pinned `:2756`/`:2876` + truth sites + add the pin — after W20-L3 stops editing headless.ts) · **#16/#17/#18** (stale comments/doc, same file) · **#14** (typo) · **#24** (`[fill]`) · **#31** (citation re-pin) · **#50** (codification) · **#51** (types.ts provenance — dispatch item) · **#37** (chat/crew seams — dispatch item).
4. **PROCESS / COSMETICS:** **#63** (incident close-out: pickups verified + landed lanes certified by W20 WD-α) · **#62** (plan header) · **#59** (finalize 250) · **#60** (fill W18 L1/L2/L5 logs) · **#28** (skill file) · #27 (only if strict).

## §READY-TO-FIX-NOW (ordered shortlist)

**Rubric (inherited):** OPEN row ∧ owner has landed ∧ files stable ∧ no live lane box owns the file. Read at 18:00–18:06.

**Count = 6:**
1. **#52** — `git.server.ts:152` TS2345 (W18-L3 landed; file stable since 14:28; no W20 box) — *the* gate-class fix.
2. **#24** — `fixes/241_lane3_browser_residuals.md:38` stale `[fill]` — one line; the only `[fill]` left.
3. **#14** — `fixes/236:51` typo `verifyAndServever` — one word.
4. **#62** — `wave_plans/W19/lanes-and-watchdogs.md:12` stale plan text — cosmetic rewrite at close.
5. **#50** — `--test-name-pattern` no-op-trap codification (additive doc + guard; still uncodified, 0 hits repo-wide).
6. **#28** — skill-file size/split (non-repo; house work).

**Flagged, awaiting dispatch (files stable, no owner):** **#37** (chat.server.ts:561 / crew.server.ts:877) · **#51** (types.ts additive field).
**Held by W20 lane boxes (do NOT fix mid-wave):** #15/#16/#17/#18 (+#31) — headless.ts/console.tsx/run-eval.mjs, W20-L3 live · **#68** — registry.test.ts, W20-L4 · **#69** — W20-L1.
**Process (parent/wave close):** #63 · #59 · #60 · #67.
**#27-if-strict (console.tsx):** no longer held by a live box (F4 landed its console region) — still optional/strict-only.

## §WAVE LANDING STATUS (as read 17:58–18:07; HEAD `8e25180`, 71 uncommitted)

| wave | state | note |
|---|---|---|
| W19 batch | **DEAD mid-flight** (see #63): 3 landed / 3 skeletons | landed lanes' logs 122/194/200 ln; skeletons 37/23/31 ln; never watchdog-certified → W20 WD-α |
| W20 L1 (OV-3/OV-4, tree-run green) | **LIVE** — `fixes/255_lane1_tree_green.md` (894 B, 17:58, skeleton) | owns scaffold.ts/engine.ts; W20-L3 shares engine.ts |
| W20 L2 (OV-5 + acceptance oddity) | **LIVE** — `fixes/255_lane2_probe_truth.md` (677 B, 17:58, skeleton) | my #66 gives it the file:line it needs |
| W20 L3 (pickup OV-13+OV-29) | **LIVE** — `fixes/255_lane3_ov13.md` (1,471 B, 17:59) — partial-edit triage recorded; `headless.ts` being edited (18:02:42) | backup at `w20l3_scratch/headless.ts.bak` |
| W20 L4 (pickup T5.1+F2) | **LIVE** — `fixes/255_lane4_t51_f2.md` (1,476 B, 17:58, skeleton) | `registry.test.ts` live (18:03:47); owns #68 |
| W20 WD-α (`fixes/256`) | **not on disk yet** at 18:00 (only 257 exists) | watch out for it |
| W20 WD-β | **this file** | read-only elsewhere |

## §Method, honesty limits

- Read-only on everything but this file + `C:/Users/mnril/w20wd_b_scratch/`; **no git mutations**; exactly **2 foreground runs** (E5, E6) — the named diagnostics; no other suite was executed.
- **Measurement vs inference, labelled:** E5/E6 = measurements (exit codes + counts above). #52 = **byte-read inference** (typecheck forbidden to watchdogs). #64's "emitError non-null" half + #65's exact run-#1 error string = **code-path + disk inference** (results.json #1 overwritten; corroborated by `_step0_run2.sh`'s own comment and the A7 refusal pin). #15's final line-pin is pending W20-L3's live edits. #18/#28/#31/#50 not re-measured (labelled).
- The W19 incident (#63) is a **harness/process artifact** — same family as the stdin-tty host rule; it is recorded as a process row, never as a code failure.
- Host/house artifacts (never failures, no rows): `.hermes-tmp.*` tool temps (`providers/` seen at 14:41; exclude from any commit) · the stdin-not-a-tty rule stands (v1 #1–#3) · the `LF → CRLF` autocrlf notices in `git diff` are working-copy noise (F4 §5.5) · `write_file`'s tsc hook TS6053 on the spaced path (#67).
- This snapshot freezes **mid-wave** (18:07 CDT): W20 lanes keep moving; their landings/findings belong to the close-out (v4), not to this file.

## §W22-L1 STATUS MARKERS (append-only; added by the W22 Lane-1 ready-queue pass; never rewrite rows above)

> [W22-L1] **#52 → FIXED-APPLIED (W22-L1)**. `git.server.ts:152` TS2345 cleared by widening the policy seam's accepted input type (`policy.ts` gains `PolicyCtxInput`; `evaluatePolicy(…, ctx?: PolicyCtx | PolicyCtxInput)`), NOT by caller-side narrowing — narrowing changed the denial bytes for malformed claims (erased the "claimed seat (…)" echo); the seam's documented total contract is now type-true with **zero runtime drift**. Evidence: scoped tsc (`C:/Users/mnril/w22l1_scratch/tsconfig.fix52.json`, RED 5 diagnostics → GREEN **exit 0**); `git.server.test.ts` + `policy.test.ts` **65/65** + one new pin ("accepts an untrusted, unknown-typed actor claim verbatim and ECHOES it"); scoped eslint (3 files) exit 0.
> [W22-L1] **NEW, unledgered find (same box):** `git.server.ts:953` + `:1112` carried **two more typecheck error sites** no prior measurement saw (TS2554 "Expected 2 arguments, but got 3" — a vestigial `(f) => f` third arg on the 2-param `gateSeatAndTarget`; present in committed HEAD `8e25180` bytes, introduced after the W18 14:16 boundary read, never re-measured because typecheck is boundary-only). Both fixed (arg deleted; runtime identical at JS level). Same scoped tsc: 5 diagnostics → 0. ← Lane 3 / v4: please assign a row number for this find.
> [W22-L1] **#24 → FIXED-APPLIED (W22-L1)**. The stale `[fill]` at `fixes/241_lane3_browser_residuals.md:38` is filled with the byte-verified lane-end re-check (parent, 13:26 — `LISTENING 14140`, the unchanged foreign holder; re-corroborated by W22-L1's own `netstat` read at 18:47:13 — still `LISTENING 14140`). Pin: `grep -c "\[fill\]" fixes/241_lane3_browser_residuals.md` → **0**; 0 `[fill]` placeholders remain across all lane logs.
> [W22-L1] **#14 → FIXED-APPLIED (W22-L1)**. `fixes/236_c1_wb1_deadlock_fix.md:51` typo corrected to the real symbol `verifyAndFixServer` (defined at `verify.server.ts:946`; correction per WD-β's 239 note). Pin: `grep -c "verifyAndServever" fixes/236_c1_wb1_deadlock_fix.md` → **0**; `grep -c "verifyAndFixServer"` → 1.
> [W22-L1] **#62 → FIXED-APPLIED (W22-L1)**. `wave_plans/W19/lanes-and-watchdogs.md`'s stale KNOWN-ERRORS note rewritten to the measured truth — 3 typecheck errors + 1 lint error at the W18 14:16 boundary (:703/:763/:152 + lint), ALL RESOLVED since (#53–#55 by W18-L3; #52 + the unledgered :953/:1112 pair in W22-L1) — tagged `[corrected W22-L1 · ledger #62]`. Pin: `grep -c "has 2 typecheck errors"` → **0**; `grep -c "corrected W22-L1"` → 1.


---

## §W22-L3 ADDENDUM — the “29 vs 1” correction + the count sweep (append-only; W22 · LANE 3; read 2026-09-24 18:37–18:47 CDT)

> **[W22-L3] CORRECTED — the “29 latent type errors” claim was INFLATED; never propagate it again.** Chain: W20-L4’s handoff reported 29 → **the parent’s W21 brief carried it verbatim** (`wave_plans/W21/fix-wave.md:46` “29 latent type errors”, `:48` “Enumerate the 29 errors”) → W21-L2 measured **exactly 1** on arrival and said so (`fixes/258_lane2_f2_finish.md` bottom line 1 + §0/§1, incl. the provenance note: no on-disk “29” exists anywhere searched) → the W22 brief §“TWO CORRECTIONS” records it. **Independent evidence:** the W21 watchdog’s scoped typecheck of the union of W21 boxes — `C:/Users/mnril/w21wd_scratch/tsc_baseline_union.txt` (551 B · md5 `6aacb5bbc5f1b5652c4b881a00ef4365` · 18:24:32 CDT) = **exactly one** diagnostic, `TS2322 openai-compatible.ts(163,3)`; W21-L2’s own arrival tsc = the same single error, then `exit 0 · 0 errors` after the type-only fix; W22-L3 re-derivation on current bytes (18:40:32) = scoped tsc **exit 0**, box eslint **exit 0 · 0 problems**. **True count: 1 (now 0).** Rule for future briefs: never propagate an unchecked count — re-derive it or mark it unverified.

> **[W22-L3] CORRECTED — adjacent count, same wave: “118/118 (base 112)” is actually 119/119.** Base 112 ✓ (static, `git show HEAD:` = 112 test rows); current = **119/119** (W22-L2 foreground ×2, exit 0 — `fixes/260_lane2_certify_fix.md` §1a; W22-L3 static re-derivation = 119). The corrected count travels with the certification.

> **[W22-L3] SWEEP — 10 handoff-propagated counts re-derived (commands + raw results: `fixes/260_lane3_ledger_corrections.md` §2):** CONFIRMED — registry base **29/29** (HEAD static) · **39/39 · 14/14 · 12/12** (65/65 foreground) · **headless 92/92** (foreground) · **run-eval 31 · cassette 31 · policy-overlay 25 · policy 27** (114/114 foreground; WD-α’s 113 was pre-L2-delta) · run-#2 record **6/9, mean 0.6667** (5/9 → 6/9; `results.json`/`history.json` bytes) · W19 batch **3 landed / 3 skeletons** + line counts ✓ · ledger arithmetic **19+43+6+1=69** ✓ · (bonus) p6 §P1/§P2 measured numbers re-reproduced by probe re-run: **16 < 49**, **missing 28/36**, **0 vs 63 union**, `stubFiles=["src/generated.ts"]`. CORRECTED — “29” → 1; “118” → 119. LABELLED unverified/not re-derivable in-lane — “52 program diagnostics” (#67; whole-program typecheck parent/WD-owned).

> **[W22-L3] REGISTER — the complete W20/W21 residuals register** (every still-open item, owner + status: W21-L1’s finished items + its log skeleton, WD-α’s 4 incidents I1–I4 incl. the P1-flagged `run-eval.mjs` touch, WD-β’s 6 ready-to-fix items’ post-W22-L1 status, the p6-brief-fit/p6-arch §P1/§P2 proposals, W20 incident/disposition rows, the live-artifact `doctor.test.ts` red, all log-debt skeletons): `fixes/260_lane3_ledger_corrections.md` §3. This file received ONLY additive markers (no row rewritten — proof recorded in that log §4).

---

## §v4 CLOSE-OUT — the W20 → W21 → W22 → W23 arc (APPEND-ONLY; written by W23 · LANE 7 (recorder), read 2026-09-26; docs-only — no test/typecheck/build/lint runs)

**Append-only proof.** PRE: **184 lines · md5 `5d15e23acc8dc951690c82357555ff80`** (copy: `C:/Users/mnril/w23l7_scratch/257_pre.md`; mtime 2026-09-24 18:47:44, unchanged since W22-L1's last patch). POST: **225 lines · md5 `3b87012bdd7d2c0f585de215dbeafed2`** (point-in-time, read 2026-09-26 immediately before this proof line's own finalization — any subsequent append changes a file hash; **the durable append-only proof is the frozen PRE copy + the `diff`: 41 added · 0 removed · 1 hunk**, `C:/Users/mnril/w23l7_scratch/257_diff.txt`). (Honesty note: the W22-WD's 18:53 read logged md5 `8868b6e5…` for the same 184 lines — unreconciled; mtime + line count are the anchors and both match.) Scope: process close-out only — no row above is rewritten; the live open-items register remains `fixes/260_lane3_ledger_corrections.md` §3 as amended by this block.

### A · The run #1 → #2 → #3 arc — one keyed benchmark, three states

| run | at (CDT) | total / mean | what it measured |
|---|---|---|---|
| **#1** | 2026-09-24 ~14:45 | **5/9 · 0.5556** | emit **refused over the Sep-10 leftover tree** → m6=0 + all 3 expected files reported missing (#65: stale-dir root cause; `RT_E_FOREIGN_FILES` by design; fixed by preserving the old dir and re-running on a clean one) |
| **#2** | 2026-09-24 14:49 | **6/9 · 0.6667** | fresh clean-dir emit: **m6 0→1**; acceptance `filesOk:true` + `contentOk:true`; `pass:false` **only on the mean bar** (#66: rubric needs all nine; mean 0.6667 < 1 — `passesAcceptance` clause 2). Residual zeros M2/M3/M4 = the tree-run crash (#69 → the W21-L1 fix) |
| **#3** | 2026-09-24 19:03:40 | **3/9 · 0.3333** | **the account, not the tree** (below) |

**RULING (v4): run #3's 3/9 is NOT a regression — it is an UNFUNDED ACCOUNT.** DeepSeek balance = 0 → every keyed synthesis call returned **HTTP 402 "Insufficient Balance"** → all bands ran against the deterministic floor (`results.json` M1–M4 evidence: "all synthesis calls refused — tree/run/mint evidence is the deterministic floor … no LLM-produced software exists"). The run's own marker: `preflightClass: "balance-exhausted"`, `meanOfNine: 2.9997`, `decision: "retrace-first"`, duration **2.6 s** (no model call could complete) — `research/eval-out/{results.json, history.json, run-in-progress.json}`. M7's "regression" flag compares against run #2's funded band means — it is the rubric noticing the account, not the code. **Same-day corroboration:** the W22-WD lane's transcript ends on the same 402 (`HTTP 402: Insufficient Balance`, request_id `c978d9be-…`, 18:57:19). **Corollary: run #3 delivered ZERO tree signal and must never be cited as tree evidence** — the tree evidence of record is §B. **Remediation dispatched:** W23 LANE 1 (`RT_E_LLM_NO_BALANCE` first-class, funded preflight, no-balance trial ending, honest results rows, per-trial clean emit target) — a broke account must never again produce a scored `dod` row.

### B · The tree evidence of record (unchanged by run #3)

- **Crash half — FIXED + CERTIFIED.** W21-L1's fix (single-file identity path removed + `neutralizeResidualCjsExports`; `scaffold.ts` untouched); certified by W22-L2: suite **119/119** (foreground ×2, exit 0), both probes exit 0, PRE-fix tenant crash (`ReferenceError: module is not defined`) → POST-fix **43 tests execute**; `TREE_IMPORT_OK` + `BARREL_IMPORT_OK`; `treeRun()` on run #2's bytes = `ok:false` **only** on the 28 capability reds (capability.9–36). Log `fixes/258_lane1_single_chunk_esm.md` was FILLED by the W23 recorder (§D) — the register's "its log is a skeleton" note is resolved.
- **Coverage half — OPEN.** The 28 reds (B1) = W23 LANE 2's box; p6-brief-fit/p6-arch §P1/§P2 = W23 LANE 3; the live-artifact `doctor.test.ts` red = W23 LANE 6.

### C · W22 landings · the two count corrections (ACKNOWLEDGED) · the W22-WD absence

- **W22-L1** — 5 of 6 queue items FIXED with append-only markers in this file (**#52** + the two unledgered TS2554 sites `git.server.ts:953/:1112`; **#24**; **#14**; **#62**). **#50 half-landed**: guard test `scripts/test-name-pattern-guard.test.mjs` (3/3); the **AGENTS.md doc note was correctly BLOCKED** by file protection (approval timed out at 18:53:52 — silence is not consent; not retried). Proposed patch text: **`research/multiagent/262_agents_md_proposal.md`** (W23-L7). #50's ledger marker was never appended; #28/#37/#51 remain owner decisions.
- **W22-L2** — the certification (§B) + the honest conditional ("not by itself" — 28/36). **W22-L3** — 7 `> [W22-L3]` marker blocks (under #68, #69, the open register, + the 4-marker addendum) and the 28-row residuals register.
- **The two count corrections — ACKNOWLEDGED as the standing record:** (i) **"29 latent type errors" → 1 → 0** — INFLATED; never propagate an unchecked count (rule adopted); (ii) **"118/118" → 119/119** — travels with the certification. The two bonus re-derivations (W20-L1's "fix landed" claim unsupported by bytes; "scaffold.ts is DIRTY" false) are resolved ON DISK: both logs now carry explicit correction notes (W23 recorder fills, §D).
- **W22-WD — NEVER LANDED:** `fixes/261_w22_wd.md` does not exist; the lane's transcript ends with the same 402 (18:57:19). The RUN3-readiness re-certification it owed was therefore never formally delivered; readiness evidence of record = W21-L1 (landing) + W22-L2 (certification) + W22-L3 (counts/register), and the armed watcher (`proc_e87697cee804`) fired run #3 on its own ≥5-min-quiescence trigger. Register row #25 update: *re-certification delivered by substitute evidence, never formally* — parent may flip to closed-on-evidence.
- **Process rows:** **#63** (W19 batch death) — close-out satisfied: pickups landed (W20-L3/L4), all three W19 landings certified (WD-α RUN #1; re-measured 114/114), their logs filled (§D). **#59** (250_W18 WD) — filled from its own summary; the two test re-runs remain never-executed (labelled). **#67** EXT-FAIL accounting — closed as-labelled ("52 program diagnostics" remains the one un-re-derivable count; parent/WD-owned). **#23** (log debt) — discharged in §D.

### D · Log-debt discharge (W23 · LANE 7; docs-only, authors' own summaries only)

Filled in place, each marked `[RECORDER-FILLED from the author's own summary; author absent]`:
`fixes/258_lane1_single_chunk_esm.md` (W21-L1) · `fixes/260_lane1_ready_queue.md` (W22-L1) · `fixes/255_lane1_tree_green.md` §4/§5 + claim correction (W20-L1) · `fixes/255_lane3_ov13.md` (W20-L3) · `fixes/255_lane4_t51_f2.md` (W20-L4) · `fixes/259_w21_wd.md` §2/§5/§6/§7 (W21-WD) · `fixes/249_lane1_ov9.md` (W18-L1) · `fixes/249_lane5_t54.md` (W18-L5) · `fixes/250_w18_wd_alpha.md` markers (W18-WD-α). **Not fillable (no author summary exists on disk):** `fixes/252_lane1/3/5_*.md` (W19 batch-death skeletons — their record is the W20 pickup logs) · `fixes/249_lane2_f3.md` (summary not preserved) · `fixes/216h_ui_wave.md` + `fixes/216j_honesty_tooling.md` (pre-W20). Detail + scan table: `fixes/262_lane7_recorder.md`.

### E · The W23 wave — file list (in flight at this write; code-only per `wave_plans/W23/code-all.md`)

**L1** `src/lib/errors.ts` · `src/lib/llm/providers/deepseek.ts` · `scripts/run-eval.mjs` · `src/lib/headless.ts` (emit-dir/hygiene regions) — 402 first-class + funded preflight + honest results rows + per-trial clean emit target · **L2** `src/lib/codegen.server.ts` · `src/lib/scaffold.ts` — the 28 coverage reds + OV-16 README truth · **L3** `src/lib/dod.ts` · `src/lib/gates.ts` — p6-brief-fit §P1 + p6-arch §P2 · **L4** `src/lib/doctor.ts` · `src/lib/llm/providers/registry.ts` · `src/lib/packet.ts` — OV-1 + OV-41 · **L5** `scripts/rapidtool-cli.mjs` · NEW `src/lib/scorecard.ts` · `src/components/console.tsx` — T5.3 `eval` verb + T5.2-A fixtures review · **L6** `src/lib/honesty-guards.test.ts` · `src/lib/engine.ts` (approve path) · `src/lib/doctor.test.ts` — DF-09 + T4.3 + G4 + the doctor red · **L7 (recorder)** `fixes/` logs · this file · NEW `research/multiagent/262_agents_md_proposal.md`.
Landed lane logs at this write: `fixes/262_lane2_emit_templates.md` · `fixes/262_lane5_eval_ui.md` · `fixes/262_lane6_defined_checks.md` (+ `fixes/262_lane7_recorder.md`); L1/L3/L4 logs as they land. **Verification = the parent boundary** (no runs this wave).

> *(End of v4 close-out block. v1/v2/v3 bytes above are untouched; future continuations append below this line.)*
