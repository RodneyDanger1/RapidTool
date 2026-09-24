# 219 · WATCHDOG B — lanes 3 & 4 corrections (autonomy blockers + self-improvement reality)

*WD-B · 2026-09-24 · delegation `deleg_b77255e7` (task-2 = lane 3 → `research/multiagent/219c_autonomy_blockers.md`;
task-3 = lane 4 → `research/multiagent/219d_self_improvement_reality.md`). Watchdog plan: `wave_plans/W13/wd-b.md`.
Read-only on `src/`/`scripts/`; no git mutations. Writes: this file + the two dossiers under the correction protocol only (5 attributable
markers — §6).*

---

## §0 · BOTTOM LINE (per lane)

| | Lane 3 — autonomy blockers (`219c`) | Lane 4 — self-improvement reality (`219d`) |
|---|---|---|
| Claims checked | **6 / 6** | **6 / 6** |
| Confirmed | **6** (all load-bearing claims; every live number independently reproduced) | **5** (hops 1–5, PARTIAL verdict, absences list, wired-audit) |
| Contradicted | 0 | **1 partial** — "`edit --write` is policy/human-gated" is FALSE; corrected in place |
| Unverified by WD-B | 0 (its own §7 UNVERIFIED items are correctly labelled; item (iii) now upgraded to VERIFIED — see §7) | 0 (hop 6 "behaviour delta" is self-declared UNVERIFIED — WD-B concurs: unmeasurable keyless) |
| Verdict | **TRUSTWORTHY-AS-WRITTEN** (2 support-anchor corrections applied; no claim weakened) | **NEEDS-CORRECTION → corrected; TRUSTWORTHY WITH the WD-B marker read** |

**The one thing the parent must know before quoting:**

- **Lane 3:** the file is a **parent-recovery paste** — the lane ran out of tool budget and never wrote it; everything below the file's own
  header is the lane's delivered text, and §7 of it honestly splits verified / traced-not-run / UNVERIFIED. WD-B re-verified the load-bearing
  set against the code AND re-ran the live evidence on fresh scratch (doctor, a full keyless drain's artifacts `dgate1-6`/`dappr1-5`, emit →
  17 files · webapp · exit 0) — the numbers match to the digit. Quote it; the keyless-key verdict is grounded.
- **Lane 4:** same recovery status. Its one load-bearing error OVER-RESTRICTS the product: the in-place `edit --write` verb is **not**
  human-gated (`repair.apply` allows the autopilot seat — `policy.ts:98` + `:223-225`), so the machine's repair reach is **larger** than the
  dossier states. Corrections applied (§6, items 3–5). Its upgrade estimate needs ≈+4 seam lines beyond the stated "~6" (§6 item 4). After
  the markers, quote it.

---

## §1 · Baseline (plan step 1 — raw output)

```
@ 11:19:15 — HEAD 7582771 (W12 close). git status --short:
?? research/multiagent/219b_defects_live_status.md
?? wave_plans/W13/lane-6.md   ?? wave_plans/W13/wd-a.md   ?? wave_plans/W13/wd-b.md   ?? wave_plans/W13/wd-c.md
dossiers 219c/219d: "No such file or directory" (lanes still mid-run)
transcripts: task-2.log 35734 B mtime 11:18 · task-3.log 32212 B mtime 11:18
```

## §2 · Poll log (plan step 2 — 3 polls, real timestamps; transcripts truncate tool output at ~450 chars/line, so
## scratch artifacts were re-read directly for counts)

```
POLL 1 @ 2026-09-24 11:24:27 — task-2.log 47612 B mtime 11:23:21 · task-3.log 47288 B mtime 11:23:01
  lane 2/3 finals ALREADY PRESENT (11:23:20 / 11:23:01, status=completed): BOTH DIED PRE-WRITE —
  "the dossier was NOT written ... paste it verbatim" — tool budget exhausted. Dossiers absent.
  git: untracked only; NO modified src/scripts. Lanes' last activity: lane 3 draining gates (11:22:18,
  captured "sealed complete with 2 failed DoD gate(s): P6(...), P7(...)"), lane 4 grep deepseek.server (11:22:35).

POLL 2 @ 2026-09-24 11:28:32 — delegation CLOSED 11:27:28 (task-0 exit max_iterations / task-1 completed).
  Summary files appeared 11:27: subagent-summary-2 = 18,359 B (lane 3 full body), -3 = 6,693 B (lane 4),
  -0/-1/-4 also present. DOSSIERS NOW ON DISK (parent-recovery paste with its own header):
  219c 18,017 B @ 11:28:06 · 219d 6,870 B @ 11:28:07 · 219a 36,398 B @ 11:26.

POLL 3 @ 2026-09-24 11:33:56 — transcripts frozen @ 11:27:28 (final sizes 47,710 / 47,386 B). Dossiers unchanged
  (11:28:06/07). git: HEAD still 7582771; the ONLY tracked-file change in the window is
  " M research/multiagent/219a_inventory_and_reality.md" (+414/−16 vs HEAD, mtime 11:30 — lane-1's dossier fill,
  a research/ file, not src/scripts; NOT one of my lanes). Nothing else tracked-modified;
  219b/c/d/e are untracked new files. NOTHING WRITTEN OUTSIDE THE ALLOWED SET by lanes 3/4:
  grep of both transcripts' write_file calls = only C:\Users\mnril\w13l3_scratch\drain.sh and
  C:\Users\mnril\w13l4_scratch\probeA.mjs / probeB.mjs (scratch, outside repo).
```

## §3 · Lane 3 — independent verification of the 6 load-bearing claims

| # | Claim (as in 219c) | WD-B method | Verdict |
|---|---|---|---|
| 1 | Latch = 4-term conjunction `doctor.ts:218-224`; four `FACTORY_GAP` strings `:183-188`; frozen all-false evidence `:175-181`; `gapsOf :190-201`; fixture gap has NO producer; `productComplete` sole caller passes no `extra` (`headless.ts:3207`) | Read `doctor.ts` in full (WD-B); re-ran `doctor` → exit 0, `autonomousSoftwareFactory:false`, all four gap strings VERBATIM, `inventory:null`, `tokenCap:null`, `isolation{sandbox:false,kind:none,docker:false,bwrap:false}`, `runner{available:true,sandbox:false}`; `grep -rn humanFixtures` (non-test) → only `doctor.ts`; `grep evidenceFromJobInventory` → `headless.ts:3207` (no extra) | **CONFIRMED** (all anchors exact; live proof reproduced by WD-B 11:31:02) |
| 2 | `enforceDod` defaults to the keyed probe: `engine.ts:1802-1808` + `:1884-1885` | Read both regions (WD-B) | **CONFIRMED** exact |
| 3 | Exit 3 pins `RT_E_LLM_NOT_CONFIGURED`: `rapidtool-cli.mjs:127-128`; example site prompt verb `:1725-1741` | Read `respond()` + prompt verb region (WD-B) | **CONFIRMED** exact |
| 4 | Step table: P0–P3 machine; four stock gates human (`STOCK_HITL=[4,5,8,9]`, `headless.ts:346`); P11 from `schedule.extraHitl` (`engine.ts:1109-1116`); seal keyless → `sealedWithFailures:true`, exit 1 (`headless.ts:669-691`); wild asymmetry = `wildApproveGate` blocks on `forceHuman` ONLY (`:3511`), pauses keyless (`:3522-3530`) | Read all cited code (WD-B); re-read the lane's scratch artifacts: `dgate1..6.json` = parks at P4/P5/P8/P9/P11 (exit 2) then final exit 1 complete P12; `dappr1..5.json` = 5 approvals; read `phases.ts:151`, `engine.ts:1646-1648`, `policy.ts:88-96`; `grep -rn STOCK_HITL src/` → zero hits in `engine.ts` | **CONFIRMED** — every park/source verified; the one support-grep parenthetical was inexact → correction §6.1 |
| 5 | "NO isolator on this host" (docker/bwrap exit 127; WSL no distros); register slot `fixes/217c:592` still UNKNOWN | **Re-ran the probes myself**: `docker --version` rc=127 · `bwrap --version` rc=127 · `wsl.exe -l -v` → "no installed distributions"; read `fixes/217c:19` + drop-in slot `:591-594` | **CONFIRMED** |
| 6 | Highest-leverage blocker = the missing model key (0 engineering) | Keyless P6 floor: `engine.ts:2848-2856` (`if (!configured) return floor`) + `:2896-2897` (placeholder fails `p6-brief-fit` by construction); keyed wild crosses stock gates (no `STOCK_HITL` in `engine.ts`; classifier configured-only `wild-mode.server.ts:255-264`; advance floor `engine.ts:3470-3488`) | **CONFIRMED** — the ranking is judgment, but every factual prop behind it re-verified by WD-B |

**Bonus re-verifications (numbers):** the dossier's drain counts "6 gate invocations / 5 approvals / parks at P4→P5→P8→P9→P11" are
directly readable in the re-read artifacts; `emit` (which the dossier itself flags UNVERIFIED in §7-iii) **WD-B re-ran @11:31:29**:
`ok:true, count:17, moduleEmbedded:true, "17 files · kind webapp", exit 0` — reproduced exactly.

## §4 · Lane 4 — independent verification of the 6 load-bearing claims

| # | Claim (as in 219d) | WD-B method | Verdict |
|---|---|---|---|
| 1 | Lesson loop hop-by-hop; hops 1–5 code-anchored, hop 6 (behaviour delta) UNVERIFIED | Read every hop-1 site (`engine.ts:1452-1496`, `headless.ts:615-663`, `report-intake.ts:374-405`, `verify.server.ts:899-921/:992/:1012`, `engine.ts:547-551`, `headless.ts:692`), hop-2 (`knowledge.ts:881-898/:830/:963`), hop-3 (`engine.ts:1430-1434`, `verify.ts:207-227`), hop-4 (`knowledge.ts:1012-1033`), hop-5 (`engine.ts:649-660→:667-673`, `codegen.server.ts:2473-2480/:2553/:2846-2851`, `prompt-engine.ts:200-205/:213-216`); **re-ran `lesson-writers.test.ts` → 18/18 pass**; **re-ran probeA + probeB** → byte-identical to the lane's recorded output (same id `lesson-verify-failure-1346afac`, same probe tags, same `refuse:no-proof`, same `PRIOR LESSONS` block, reframe prompt carries the lesson line) | **CONFIRMED** (5 hops verified by WD-B; hop 6 correctly left UNVERIFIED — no key, no behavioural measurement exists) |
| 2 | Loop verdict **PARTIAL**; red seal is OPEN by construction (T-11 mints no lesson; `p6.seal.unmet` is a LOG `selectLessons` can never see) | Read `engine.ts:1452-1496` (comment + code exact: red seal → log only, dedup `:1492`; "a RED seal never mints a lesson row"); `selectLessons` filters memory rows on `LESSON_TAG` | **CONFIRMED** |
| 3 | Repair loop: "YES for the machine loop; NO for the edit seat"; `repairTreeDir` anchor chain; keyless no-op; edit `--write` "policy/human-gated" | Read every anchor (all exact: `:2486`, `:2516`, `:2630`, `:2639`, `:2643`, `:2654-2656`, `:2704-2710`, `:1626`, `:1664`, `:1559`, `:1578`, `patch.ts:279`, `codegen.server.ts:906`, `verify.server.ts:923-1055/:1015`); `driveP6Journey` keyless no-op `:1837-1850` exact; CLI `repair` `:1030-1121` + `RT_E_REPAIR_FAILED` + ledger-persist-on-failure; **edit-seat sub-claim FALSIFIED**: `policy.ts:98` `requiresHumanSeat:false` + `:223-225` allows autopilot seat → machine `edit --write` allowed | **PARTIALLY CONTRADICTED → corrected** (§6.3, §6.5). The headline answer "can it fix its own artifact without a human: YES (machine, keyed)" stands; the edit seat is ALSO machine-reachable |
| 4 | "What self-improving would require" — 7 absences | Verified each: no training code; `run-eval.mjs` writes only its own result JSON (no savePattern/lesson writes); `oracleToCaseSeeds()` zero call sites (all hits = comments + def); `p6.repair.delta` reader `repairPatchRecords` called once at `headless.ts:2626` (one-cycle telemetry); `selectLessons` sorts on static score only; `scoreMaker` called only at `run-eval.mjs:898`; **dead-surface list (9 items) each grep-verified zero production callers** (`driftLesson`, `correctionLesson`, `consolidatedRunNote`, `manualLesson`, `dismissLessonRows`, `harvestResultLesson`, `lessonLog`, `provenRowsFromStore`, `verifyFailureLesson`-direct) | **CONFIRMED** (nuance on "no machine writer" noted in §7) |
| 5 | Smallest upgrade: call `failureLessonFromRecord` in the red-seal branch; "~6 lines" | Branch exists `engine.ts:1464-1496`; builder handles `gate-unmet` + project (`knowledge.ts:1385-1406`); floor `:1365-1369`, tags `:952`, recurrence `:963` all exist — BUT `engine.ts:63-67` forbids static knowledge import → needs `LessonSurface` seam additions (`:68-108`), so ~+4 lines beyond "~6" | **CONFIRMED + scope corrected** (§6.4) |
| 6 | "Wired" claims audit (the W11 trap) | Every wired mechanism given a call site: `probeTagsFromSignature` NOW CALLED (`knowledge.ts:952`, post-217l repair — the dossier correctly reflects the fixed state, no stale falsified claim); `repairTreeDir` ← CLI `:1065`; `driveP6Journey` ← `store.ts:945`, `run-eval.mjs:774/:789`; `applyStrReplace` ← `codegen.server.ts:906`; `repairCycleLiveDeps` ← `headless.ts:1731-1733` | **CONFIRMED** — zero wired-but-never-called overstatements found in either dossier |

## §5 · Hallucination-shape hunt (plan step 4)

1. **Round numbers no command produced:** NONE. Every number in both dossiers was re-derived or reproduced by WD-B: lane 3 — 4 gaps,
   127/127, 6 gates / 5 approvals / P4·P5·P8·P9·P11 (scratch artifacts re-read), 17 files / exit 0 (re-run), 48,000 / 1 MB (source read);
   lane 4 — 18/18 (re-run), `1346afac` (re-run), budget 3 (`:1626`), caps 240 / 80-FIFO (source read), ≤5 rank limit (source read).
2. **`file:line` not containing the claimed symbol:** 3 in 219c (`node-runner.server.ts` `MAX_BUFFER :60`→`:57`, `RUNNER_OUTPUT_MAX_CHARS
   :78`→`:74`, sandbox stamp `:66-68`→`:49/:53`) + 1 inexact support-grep parenthetical (`STOCK_HITL` list) — all corrected (§6.1–6.2).
   All 30+ anchors checked in 219d were exact. Also 1 near-miss logged: `rapidtool-cli.mjs:531-547` contains the non-TTY approve guard
   only from `:543` (substance present; no marker).
3. **Mechanism asserted with no call site:** NONE FOUND — the inverse holds: 219d's "dead lesson surface" list is accurate and exhaustive
   (verified item by item); 219c's wiring claims (`doctorStatus` ← CLI `:2768`; inventory path; wild asymmetry) all have call sites.
4. **Keyed behaviour described as run:** NONE FOUND. `doctor` re-confirms `llm.configured:false` on this host; 219c labels every keyed seam
   traced-not-run (§7) and marks its attended drain explicitly; 219d's probes are keyless and hop 6 is honestly UNVERIFIED.

## §6 · Corrections applied (attributable markers — the ONLY edits to the dossiers)

1. **219c §4** — `[WD-B] CORRECTED (support-grep only)`: the STOCK_HITL grep set also includes `phases.ts:151` + `store.ts:20,382,399`
   (zero hits in `engine.ts` — substantive claim unaffected).
2. **219c §5** — `[WD-B] CORRECTED (anchors only)`: `MAX_BUFFER:57`, `RUNNER_OUTPUT_MAX_CHARS:74`, sandbox stamps `:49/:53`.
3. **219d "REPAIR LOOP"** — `[WD-B] CONTRADICTED (partial)`: `edit --write` is policy-gated but NOT human-gated (`policy.ts:98` +
   `:223-225`; CLI `:1233-1235`, `:1242-1259`) → repair reach is larger than stated; rest of the section confirmed exact.
4. **219d "SMALLEST UPGRADE"** — `[WD-B] CORRECTED (scope)`: ≈+4 `LessonSurface` seam lines beyond the "~6" (static import impossible,
   `engine.ts:63-67`); all other mechanics confirmed exact.
5. **219d "BOTTOM LINE"** — `[WD-B] CROSS-REFERENCE`: flags the contradicted sentence + verified repair facts (green-dir converge
   `cycles:0` keyless at `headless.ts:2531-2554`; red-tree synthesis repair needs the key, honest budget-exhausted at `:2609-2621`).

## §7 · Notes, upgraded flags, residual risk

- **Dossier provenance:** both files are parent-recovered pastes of the lanes' delivered summaries (lanes died pre-write). WD-B verified
  the load-bearing claims + spot-checked 30+ anchors; the remaining prose is the lane's as-delivered content (not exhaustively re-derived).
- **219c §7 (iii) upgraded:** "emit exit 0 on a red-sealed project" — WD-B re-ran it: exit 0, 17 files, `moduleEmbedded:true` (VERIFIED).
  219c §7 (i) (P7 corpus root cause) stays UNVERIFIED — WD-B confirms the premise (`research.configured:true, probed:true`).
- **219d "no machine writer" nuance:** the CLI exposes a manual one-shot store append (`knowledge --save` → `headless.knowledgeSave`
  `:3397-3400` ← `rapidtool-cli.mjs:1852`); the AUTOMATIC lesson loop still has no store writer, so the claim stands within its scope.
- **WD-B budget:** read-only greps/reads + 3 polls (sleep 90) + 1 targeted test run (`lesson-writers.test.ts` 18/18) + 3 scratch probes
  + CLI `doctor` + CLI `emit` (scratch-only writes, outside repo). No `npm` gates run; no git mutations.
- **Tree discipline:** no `src/`/`scripts/` file was modified during the watch; HEAD unchanged at `7582771`.
