# 326 · T2 APP MONITOR — W44 FINAL RUN (T1 operator drives exp2/01..10)

Lane T2 (app-response monitor). Trial dir `C:/Users/mnril/w44_trial`; operator T1 drives ten keyed
builds `exp2/01..10` via `rt.sh` (keyed — **T2 never invokes keyed verbs**). Repo
`C:\Users\mnril\Desktop\RapidTool Main` **READ-ONLY** (the tree stays frozen during keyed builds; my
only repo write = this log). Siblings: T3 backend (`fixes/326_t3_backend.md`), F1/F2 standby fixers
(prep-only), operator log `fixes/326_t1_run.md`.

Mission (~3-4 min cadence): (1) scan `exp2/*/build.json` + `.rapidtool/` + `.out` envelopes for
status / currentPhase / parks / hitl / decisions / lastTest; (2) per newly completed or newly parked
exp: read-only `rt.sh diagnose --project <build.json>` (independent re-run) + P6 record (phase 6 gate
passed/unmet/evidenceHash) + tree file count (generatedTree + emitted dir); (3) spend ledger = sum of
per-envelope `budget.spent` vs the 5,000,000 cap; (4) plain-language chronological account per exp;
[NEW-BUG] flags with byte-anchored evidence. No fixes; no keyed calls.

- Baseline t0: **2026-09-30 20:26 CDT**
- Repo HEAD `6924dde`; `git status --short` = `?? fixes/326_f2_watch.md` `?? fixes/326_t3_backend.md` (+ this log once written)
- Cap: `RAPIDTOOL_TOKEN_CAP=5000000` armed per keyed process by `rt.sh`; campaign metric = Σ per-envelope `budget.spent` (E2-verified semantics — `fixes/322_e2_monitor.md`:17).
- `exp2/` absent at t0; keyed node procs 0 → campaign not started yet.
- Scratch (outside repo, tooling only): `w44_trial/t2_scratch/`; reader adapted from `exp/jsum.py`.

Status: **LIVE** — campaign running (2/10 exps done as of Oct 1 10:12, both STOP_RED honest); poll log below.

## Spend ledger — Σ envelope `budget.spent` vs cap 5,000,000

| # | time | exp · tag | spent | running total | notes |
|---|---|---|---|---|---|
| 1 | 20:27 | exp01 `02_gate_c0` | 537 | 537 | P4 park |
| 2 | 20:28 | exp01 `06_gate_c2` | 11901 | 12,438 | P6 synthesis (36.5s leg) |
| 3 | 20:31 | exp02 `02_gate_c0` | 626 | 13,064 | P6 leg in flight |
| 4 | Oct1 10:01 | exp02 `06_gate_c2` | 23242 | 36,306 | leg wall 48,617s includes overnight suspension (OBS-326-3) |

## Poll log (timestamped)

| # | time | exp2 state | node | notes |
|---|---|---|---|---|
| P0 | 20:26 | absent | 0 | baseline; repo clean @6924dde; sibling lanes open |
| P1 | 20:26 | absent | 0 | T1 log `326_t1_run.md` not yet created; t2 scan helper operational |
| P2 | 20:30 | exp2 LIVE — `01_website` STOP_RED done (8 legs, wall 52.5s); `02_game` starting | 1 keyed node | T1 started ~20:27; driver `exp2/drive_exp.py` |
| P3 | 20:31 | `02_game` at P6 keyed leg (`06` 0B); exp01 full QA done | 1 | exp01: diagnose match ✓ · fit 7/8 (one short) |
| P4 | 20:32 | `02_game` P6 leg still running; no new anomalies | 1 | Σ spend 13,064 |
| P5 | Oct1 10:05 | env resumed after overnight suspension; `02_game` STOP_RED done (06–08 @10:01); no exp03 yet | 0 | gap Sep30 ~20:32 → Oct1 ~10:01 (OBS-326-3) |
| P6 | Oct1 10:12 | exp02 QA done (diagnose match ✓; fit 6/7 one-short; arch missing track/drag/drop/persist) | 0 | exp03 not started |
| P7 | Oct1 10:11 | T1 **idle since 10:01:44** (~10 min): no exp03 dir, no node proc, T1 log stale @20:31 | 0 | T3 resumed 10:04; F2 log still stale @20:28; watch: if idle > 3 polls → flag |
| P8 | Oct1 10:18 | T1 still idle (~17 min); env live — F1/F2/T3 all resumed (F1 10:12 · F2 10:11 · T3 10:04) | 0 | no exp03; T1-only silence |
| P9 | Oct1 10:21 | T1 idle continues (~20 min); nothing new in exp2; per-exp table prep + mechanics addenda done | 0 | flagged for parent: campaign paused at 2/10 pending T1 |

## Per-exp QA (appended per experiment)

_(as experiments appear)_

## Plain-language accounts (what each build actually did)

_(as experiments complete/park)_

## Independent re-runs (my diagnose vs T1 records)

_(per experiment)_

## Per-exp table (final)

_(pending)_

## [NEW-BUG] flags

- **[OBS-326-1 · harness/cosmetic — no product impact]** T1 `drive_exp.py` reads `failedGates` top-level only, but envelopes nest it under `summary.failedGates` (same shape as E1 era) → T1's summary VERDICT line prints `unmet=None` while the P6 block below carries the real criterion. Monitors must read `summary.failedGates` (my `scan.py` now does). Evidence: `exp2/01_website/summary.txt` L5 `unmet=None` vs L7 P6 unmet list; `exp2/01_website/06_gate_c2.out` `summary.failedGates=[P6:1un]`.
- **[OBS-326-2 · informational]** `p6-brief-fit` one-hit near-miss on the live exp01 re-run (hits 7 / need 8 at the 0.35 bar). NOT a regression: old-era trees clear the bar (T2 re-verified independently: 01→9/8 PASS · 02→9/7 PASS · 03→0/6 FAIL · 04→8/5 PASS; byte-matches T1's cross-check) — fresh keyed synthesis is stochastic; this tree fell one noun short. Recorded so it isn't misread as a heuristic defect.
- **[OBS-326-3 · ENV — no product impact]** Overnight environment suspension: **Sep 30 ~20:32 → Oct 1 ~10:01 CDT** (whole environment frozen — all lanes + T1). Evidence: exp02 `06_gate_c2.out` written `2026-10-01 10:01:37` while legs 01–05 are `2026-09-30 20:31`; T1 summary `06_gate_c2 WALL=48617.1s`; sibling logs stale across the gap. Consequence: T1's `wall_total` for exp02 includes ~13.5h suspension — real active work for leg 06 ≈ 90s (first P6 event 20:31:22 → last pre-gap 20:32:34; resume tail 10:01:20→10:01:37). Watch rule: any leg whose wall ≫ its spend pattern is a suspension artifact, not a hang.
- **[OBS-326-4 · edge — suspension artifact]** Immediately after resume, exp02 cycle-3 chunk 2/5 refused `RT_E_INTERNAL · "DeepSeek returned a non-JSON 200 response"` (10:01:20) — consistent with a stale dead TCP connection after 13.5h; coded + honest; the journey still landed a green tree-run + tested-equivalent mint (`fnv1a 14863388`). No repro in normal runs; flag only if it recurs without a suspension.
- **[OBS-326-5 · doc text vs red-path reality — carried OBS-5 class, LOW]** `diagnose.actions[1]` for both exps: `Route the project through the open HITL prompt (approve/reject with feedback); do not auto-advance and never fabricate a decision.` while project state is `hitl=None` and `approve` hard-refuses (`RT_E_GATE_PENDING · "No pending gate to approve (status: running)."`). Source: `ERROR_CODE_DOC.RT_E_GATE_PENDING.agentAction` (`src/lib/errors.ts:403-407`; meaning line "a HITL gate is still pending") — accurate for pending-gate arms, misleading for the hard-DoD-red arm (both raise the same code). The envelope `remedy` was fixed for red ("no HITL accept/reject door exists for a red gate"); this doc path was not. Byte evidence: `t2_scratch/exp01_diag_t2.out` + `exp02_diag_t2.out` actions[1]; `exp2/02_game/06_gate_c2.out` (remedy) vs `07_approve_on_red.out` (refusal). Not fixed by T2 (monitor); parent/fixer adjudication.
- No product-side [NEW-BUG] yet in the final run.

---

## QA — EXP 01 `01_website` (re-run) — verdict STOP_RED at P6 `p6-brief-fit` · FULL QA ✓

Envelope QA — all 8 legs read (note: `budget` / `failedGates` / `lastGate` nest under `summary` in both eras; top-level = cmd/exit_code/ok/outcome/events/remedy/…):

| file | verb | exit | cursor / outcome | spent | verdict |
|---|---|---|---|---|---|
| 01_create.out | create | 0 | intake P0 | 0 | OK |
| 02_gate_c0.out | gate --live --autopilot | 2 | awaiting_hitl P4 park "Approve isolation policy" (forceHuman absent) | 537 | OK park |
| 03_approve_c1.out | approve --seat autopilot | 0 | P4→P5; lastGate 4:approve:autopilot | 0 | OK |
| 04_gate_c1.out | gate | 2 | awaiting_hitl P5 park "Approve validation contract" | 0 | OK park |
| 05_approve_c2.out | approve | 0 | P5→P6; lastGate 5:approve:autopilot | 0 | OK |
| 06_gate_c2.out | gate (P6 keyed) | 1 | RT_E_GATE_PENDING, outcome=dod; events ["P6 DoD unmet — …p6-brief-fit."]; fg=[P6:1un] | 11901 | OK red |
| 07_approve_on_red.out | approve | 1 | RT_E_GATE_PENDING "No pending gate to approve (status: running)." | — | OK refusal |
| 08_diagnose_stop.out | diagnose | 0 | ok | — | OK |

- Disk truth @20:28: `status=running cur=6 counts{complete:7,locked:6}`; `hitl=None`; decisions 2, both `decidedBy:"autopilot"` note "[seat harness] … no human decision claimed" (zero fabricated humans); P6 `{passed:false, unmet:[p6-brief-fit], evidenceHash:"1246104519", checkedAt:1790818113615}`; tree **3 files** `src/generated.ts` · `src/generated/render-menu-page.ts` · `src/jobs/publish.ts` (attempts [0,0,0]; E1-era tree had 4 — fresh stochastic synthesis); `lastTest {ok:true, label:"tested", hash:"4153181541"}` — **T9.3 stamp present** (p6-verified green this run; only brief-fit red).
- My independent diagnose (`t2_scratch/exp01_diag_t2.out`, EXIT 0): projection == T1's `08_diagnose_stop.out` — ok, 4 errors (2× codeless "gate exit 2" park rows [F-3 class carried], 2× RT_E_GATE_PENDING); cause unclassified-errors. No divergence.
- P6 fit replication (`exp2/check_fit.mjs` — the same probe the gate uses, imports `src/lib/sandbox.ts`): requiredN=22, need=8 (ceil 22×0.35), hitsN=**7** → FAIL by ONE hit; `no` no longer counts (string-only-noun fix holds).
- Old-tree recheck under the new bar (my independent run, matches T1's): 01→9 PASS · 02→9 PASS · 03→0 FAIL · 04→8 PASS ⇒ near-miss is synthesis stochasticity, not a checker regression. No [NEW-BUG].
- Remedy text now honest: "A hard DoD red is repaired, not approved: … no HITL accept/reject door exists for a red gate." — **E2-era OBS-5 RESOLVED** (points at `summary.failedGates`; no phantom door).
- Wall legs (T1 summary, cross-checked vs file mtimes): create 1.6s · gate_c0 5.5s · approve_c1 2.1s · gate_c1 1.8s · approve_c2 1.4s · **gate_c2 36.5s** · approve_on_red 1.8s · diag 1.8s ⇒ **52.5s** total.

## Plain-language — EXP 01 "coffee-shop website"

The website builder ran its first four checkpoints cleanly; the machine signed off the two standard gates itself, each time openly labeling it "autopilot seat — no human decision claimed". At the P6 "does the generated code match the brief?" check, the keyed code-writer wrote a small 3-file module (page renderer, publish job, barrel). The gate compared the brief's key words against the code: 7 of 22 found vs a bar of 8 — **one word short**, so it stopped honestly. The tool then said plainly that there is no door to "approve" a red gate — it must be repaired (and the old misleading message pointing at a nonexistent door is gone). Total cost 12,438 tokens, wall 52.5s. Nothing claimed that isn't on disk.

---

## QA — EXP 02 `02_game` (re-run) — verdict STOP_RED at P6 `p6-brief-fit` + `p6-arch` · FULL QA ✓

Envelope QA — all 8 legs read (01–05 @ Sep30 20:31; 06–08 @ Oct1 10:01 — see OBS-326-3):

| file | verb | exit | cursor / outcome | spent | verdict |
|---|---|---|---|---|---|
| 01_create.out | create | 0 | intake P0 | 0 | OK |
| 02_gate_c0.out | gate --live --autopilot | 2 | awaiting_hitl P4 park (stock) | 626 | OK park |
| 03_approve_c1.out | approve | 0 | P4→P5; autopilot | 0 | OK |
| 04_gate_c1.out | gate | 2 | awaiting_hitl P5 park (stock) | 0 | OK park |
| 05_approve_c2.out | approve | 0 | P5→P6; autopilot | 0 | OK |
| 06_gate_c2.out | gate (P6 keyed) | 1 | RT_E_GATE_PENDING outcome=dod; fg=[P6:2un] | 23242 | OK red |
| 07_approve_on_red.out | approve | 1 | RT_E_GATE_PENDING "No pending gate…(status: running)." | — | OK refusal |
| 08_diagnose_stop.out | diagnose | 0 | ok | — | OK |

- Disk truth: `status=running cur=6 counts{complete:7,locked:6}`; `hitl=None`; decisions 2 autopilot (zero human claims); P6 `{passed:false, unmet:[p6-brief-fit, p6-arch], evidenceHash:"3490116578", checkedAt:1790866897610}`; tree **2 files** `src/generated.ts` · `src/generated/create-initial-game.ts` (attempts [0,0]); `lastTest {ok:true, label:"tested", hash:"1486338807"}`.
- My independent diagnose (`t2_scratch/exp02_diag_t2.out`) == T1's `08_diagnose_stop.out`: ok, 4 errors (2 codeless parks [F-3 class], 2 RT_E_GATE_PENDING), cause unclassified-errors. No divergence.
- Fit replication (live tree): requiredN=18, need=7 (ceil 18×0.35), hitsN=**6** → FAIL by ONE hit (`game, blocks, clear, board, score, high`; `as` no longer counts). Old-era tree = 9/7 PASS ⇒ synthesis stochasticity again, no checker regression.
- P6 journey forensics (build.json `logs`, 15 p6 rows): cycle 1 (20:31) refusal `typeSignature functions not exported: createGame, renderBoard, clearLines, …` → cycle 2 (20:32) refusal `… initGame, saveHighScore, handleKeyDown, …` → cycle 3 chunk 1/5 ok, then **frozen across the suspension** → resume 10:01:20 chunk 2/5 refused `RT_E_INTERNAL · DeepSeek returned a non-JSON 200 response` → 10:01:37 `p6.tree.tested` (compile 9/9 · oracle spec pass · entry ui-shell skip · fnv1a 14863388) → `p6.journey.failed · tree-run ok after 3/3 cycle(s) but P6 gate FAIL · 2 unmet`.
- reqTrace artifact (`6-docs-p6-architecture-trace-reqtrace`): `p6-arch: FAIL · tree (2 files) · missing capabilities: track, drag, drop, persist` (E1 era: track, drop).
- No `decidedBy:"human"` anywhere; no cap warnings; all failures coded. Wall legs: create 2.1s · gate_c0 5.1s · approve 2.0s · gate_c1 1.7s · approve 2.0s · **gate_c2 48,617.1s (suspension-inflated; ~90s active)** · approve_on_red 2.3s · diag 3.8s.

## Plain-language — EXP 02 "browser arcade game"

The arcade-game build passed the same two machine sign-offs as exp01 (again openly labeled as the autopilot seat — never as a human). At the code-writing stage the keyed model was asked for the game code in chunks; the checker bounced the first two drafts because the promised functions weren't exported ("createGame, renderBoard…", then "initGame, saveHighScore…"). On the third attempt it got one chunk in, then the whole machine went to sleep overnight mid-request. When it woke up, the very next call came back garbled (the classic "stale connection after sleep" failure, reported honestly with a code), so that attempt was refused too — the three-cycle allowance was spent. The system still assembled and ran what it had: the code compiled and passed its test (stamped "tested"), but the final brief-match checks said (a) only 6 of the brief's 18 key words appear as code identifiers (bar is 7) and (b) four required capabilities — track, drag, drop, persist — have no matching file/identifier. It stopped honestly, reasons attached. Cost 23,868 tokens (626 + 23,242); wall ≈ 2 min of real work + the overnight sleep.

## Mechanics addenda — exp01/exp02 (post-QA cross-checks, T2)

- **Park-log + verdict fix VERIFIED live** (323 FIX-2c / E2-era F-3 + OBS-7): parks now log `level:"warn"`, `code:null`, payload `{cmd, exitCode, parked:true}` (no longer `level:"error"`). `diagnose` excludes them from the unclassified count: `mostLikelyCause.evidence = errors[2],[3]` = only the 2 coded rows; a park-only window classes as `"honest-park"` ("a park is the designed outcome, not an error") — `diagnose.ts:186-202, 383-397`. Parks remain *listed* in `errors[]` (as level:warn rows) but are never misnamed. For our exps the verdict "not a clean bill of health" is correct — the projects are genuinely red (P6).
- **No silent failures / no orphan rows**: `.rapidtool/logs/rapidtool.ndjson` = 8 rows/exp: 2 warn parks, 2 coded errors (`RT_E_GATE_PENDING` red + refusal; exp02 @10:01:37/40), 4 info (approves + diagnoses incl. my re-runs). Nothing unaccounted.
- **Tree sizes (my read)**: exp01 — barrel 84B + `render-menu-page.ts` 13,610B + `publish.ts` 11,299B (attempts [0,0,0]). exp02 — barrel 52B + `create-initial-game.ts` **3,446B** (attempts [0,0]; E1-era twin `create-game.ts` was 21,951B — much thinner; consistent with its 6/7 near-miss + 4 missing reqTrace identifiers).
- **T1 idle watch (status, not product)**: last T1 write 10:01:44 (exp02 summary); no further activity as of P9 10:21 (~20 min) while F1/F2/T3 lanes are live. Parent may need to check the T1 lane.

<!-- T2-ANCHOR -->

## Final closure (parent-appended from T2's capped record; T2 verified every row independently)

| exp | status | P6 | fit | tree | spend Σ | verdict |
|---|---|---|---|---|---|---|
| 01_website | STOP_RED (8/8 legs, ~52.5s) | `p6-brief-fit` (hash 1246104519) | 7/8 — one short | 3 files (84B + 13,610B + 11,299B) | 12,438 | honest red |
| 02_game | STOP_RED (8/8 legs; suspend-affected) | `p6-brief-fit` + `p6-arch` (hash 3490116578) | 6/7 — one short | 2 files (52B + 3,446B thin) | 23,868 | honest red |

**Spend ledger: 36,306 / 5,000,000 (0.73%)** · Campaign reached 2/10 (T1 capped at its tool-call limit; resumes under T1b on the window-#5 tree).
**Live-verified fixes (T2's QA across both exps):** park rows `warn`+`parked:true`; `diagnose` names park-only windows `"honest-park"` + excludes parks from the red count; P6-red remedy no longer points at a phantom door; envelope shape unchanged vs the E1 era; no silent failures / no orphan rows (8 NDJSON rows/exp, all accounted).
**OBS carried:** OBS-326-1 `failedGates` nesting (trial driver display; fixed in window #5 PREP-3) · OBS-326-2 stochastic near-miss class (product; gate-repair cycle fix in window #5 PREP-1) · OBS-326-3 host suspend ≈13h29m (environment) · OBS-326-4 post-resume non-JSON 200 (external; handled honestly).

=== END 326_t2_monitor — PARTIAL (parent-closed; campaign cut short by T1's tool-call cap + the host suspend, not by any monitored-build failure) ===
