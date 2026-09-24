# 219 · WATCHDOG A — independent verification of lanes 1 & 2 (inventory + defects)

> WD-A · 2026-09-24 · delegation `deleg_b77255e7` (task-0 = lane 1 → `research/multiagent/219a_inventory_and_reality.md`;
> task-1 = lane 2 → `research/multiagent/219b_defects_live_status.md`). Watchdog plan: `wave_plans/W13/wd-a.md`.
> Read-only on src/scripts; no git mutations. Writes made: this file + the two dossiers under the §Protocol correction
> form only (4 attributable markers — §5 below). Both lanes went **status=completed** (11:26:48 / 11:27:27) before
> any correction was applied; dossiers were stable when edited.

---

## §0 · Bottom line (per lane)

### Lane 1 — `219a_inventory_and_reality.md` → **TRUSTWORTHY-AS-WRITTEN** (1 WD-A correction marker)

| | |
|---|---|
| Headline claims checked | **6 / 6 CONFIRMED** (verb count; doctor-gaps decode; Quickstart `new`/`--until-hitl` BROKEN; w1 emit census; reference census; banner/refusal findings) |
| Auxiliary checks | **~16 further claims re-derived, all CONFIRMED** (137 lib files; 78 dossiers; 112/21/27 `it(` counts; HITL phase lines; 13 phases; keyless artifact; enforceDod; USAGE fixture line; no git spawn; …) |
| Contradicted | **1 statement** — its §0 provenance snapshot ("HEAD `aa12c6c`, tree dirty") is **stale**: measured 11:14:58, but the parent committed that working tree as `7582771` at **11:15:16**. Corrected in place (§5/C1). No product claim was wrong. |
| Unverified | none material; its test-count rows are explicitly labelled *taken-from `fixes/218` §5* (I too did not re-run the gates — forbidden). |
| Fabrications found | **0** (no invented count, no anchor that fails to contain what is claimed, no memory-sourced claim) |

**The one thing the parent must know before quoting:** lane 1's two headline negatives are real and
reproduced by me — README's Quickstart is **BROKEN** (`new` → `Unknown subcommand`, exit 1, ran today;
`--until-hitl` exists **only** at `README.md:37`), and today's emits genuinely produce **no multi-job
product** (census `{0,5,0}` / `{0,2,1}` / `{0,0,0}` — all three re-run by me). Its bottom line
("solid honest governance harness + P6 module pipeline — not yet an autonomous software factory") can
be quoted as-is. Carry one caveat: the gate/test numbers in it are taken-from `fixes/218` §5, not re-run.

### Lane 2 — `219b_defects_live_status.md` → **TRUSTWORTHY-AS-WRITTEN** (after 2 WD-A in-place corrections)

| | |
|---|---|
| Headline claims checked | **6 / 6 CONFIRMED** (G1 FIXED; G3 FIXED; F1 FIXED; DF-09 OPEN; DF-26 OPEN; DF-18 OPEN) + its re-derived scan numbers are **byte-identical** to my independent run (md5 `a8e5b42f…`) |
| Auxiliary checks | **~16 further claims re-derived, all CONFIRMED** (G2/G6 fixed bytes; G4 0 hits; G5 all-zero RT_E count; file sizes 6203/3891/2938; console mtime 11:09:23; popup catch lines 163/169/173; §3's 8 doc line-refs 8/8 exact; `nextAction` 0 hits; 218 §2.6-vs-§3.5 self-contradiction; archProductComplete test-only; verify.server null-return; …) |
| Contradicted | **1 file:line anchor** — "`note: opts?.note` (`engine.ts:1650`)" is actually at **`engine.ts:1663`** (`:1650` is `const next = Math.min(12, phase + 1)…`); substance of DF-09 verified. Corrected in place ×2 occurrences (§5/C3+C4). Plus 1 stale header (same commit issue as lane 1) corrected (§5/C2). |
| Unverified | its own honest limits stand (F2 not re-probed; `verify.server` caller tracing incomplete; DF-29 not re-derived; full-gate status of current bytes). Its `errors.test.ts 34/34` is verified only via its raw transcript, not re-run by me (test-run budget used elsewhere). |
| Fabrications found | **0** |

**The one thing the parent must know before quoting:** the three "loudest" items are all **real, verified
end-to-end** (approval-with-no-note hole DF-09; silent packet truncation DF-26; scorecard caveat dropped
in UI DF-18) — but do **not** quote the residual "JSON-parse → RT_E_UNKNOWN" line from the old probe as a
defect: I tested the classifier directly and all 7 G3 families are genuinely fixed for real error objects
(`SyntaxError` → `RT_E_VALIDATION`; EACCES/ENOSPC/EADDRINUSE/fetch-failed → their own codes). Strings
passed as errors never carry `.name`, which is why the legacy probe still prints UNKNOWN for that one row.

### Cross-lane integrity

- **No src/scripts file was modified during the watch** (`git status --short` sampled at every poll; final check 11:30: `rc=1`, none). The only tracked-file modification is **lane 1's own dossier** (its allowed write — its skeleton was committed inside `7582771` and it kept patching after; ` M research/multiagent/219a_inventory_and_reality.md`).
- Neither dossier contradicts the authoritative gate numbers (`fixes/218` §5: **261 scripts / 1957 lib +1 by-design skip**). Lane 1 uses them as taken-from; lane 2 collides with none.

---

## §1 · Baseline snapshot (raw, pasted)

`date` → `2026-09-24 11:19:07 CDT`

```
=== git status --short ===               (11:19)
?? research/multiagent/219b_defects_live_status.md
?? wave_plans/W13/lane-6.md
?? wave_plans/W13/wd-a.md
?? wave_plans/W13/wd-b.md
?? wave_plans/W13/wd-c.md
=== git log -1 ===
7582771 2026-09-24 11:15:16 -0500 W12 close: bug hunt + UI simplification + W11 verification (boundary gate GREEN)
=== dossier mtimes (11:19) ===
-rw-r--r-- 1 mnril 197609 1016  2026-09-24 11:15:05 research/multiagent/219a_inventory_and_reality.md   (skeleton)
-rw-r--r-- 1 mnril 197609 1842  2026-09-24 11:16:05 research/multiagent/219b_defects_live_status.md   (skeleton)
=== transcript mtimes (11:19) ===
task-0.log 2026-09-24 11:19:07 · task-1.log 2026-09-24 11:19:03
```

**Git timeline forensics (why the two "dirty tree" headers exist):** `git reflog` → `HEAD@{0}` =
`commit: W12 close…` at **11:15:16**; `HEAD@{1}` = `aa12c6c W9 close` (2026-09-17). Both lanes
snapshotted `git` **before** the commit (lane 1 at 11:14:58, lane 2 at 11:15:03 — transcript-timestamped)
and wrote their headers from that snapshot; by the time they *wrote* (11:15:05 / 11:16:05) the tree had
already been committed clean. Both headers were true-when-measured, stale-when-written → attributable
corrections C1/C2 (not "fabrications").

**Final state (11:30:27):** 219a 37 141 B @ 11:30:03; 219b 36 575 B @ 11:30:12; transcripts frozen at
11:27:28 (both lanes completed); `git rev-parse HEAD` = `7582771f175b3af4502e4e90b3c90648b9c59acd`.

---

## §2 · Poll log (real timestamps)

| # | Time (CDT) | Lane 1 (task-0) | Lane 2 (task-1) | Dossier sizes | git/notes |
|---|---|---|---|---|---|
| 1 | 11:20:14 | emitting `emit-w1` (18 files, moduleEmbedded) done 11:19:07; reading scaffold job logic | batch4/5 greps (store/engine/headless silents) | 1016 / 1842 (skeletons) | clean; wd-b/wd-c report files appearing |
| 2 | 11:22:13 | scaffold.ts job-emission / `p6.jobs.shortfall` decode | engine synthesis floor + packet caveats (batch10) | 1016 / 1842 | clean; `fixes/219_wdB|wdC` + `219e` appear |
| 3 | 11:25:11 | "**All evidence is in** — writing the dossier" (11:24:36); final counts (USAGE 34) | batch14 probing engine P1 vocab; ran `errors.test.ts` 34/34 (11:24:18) | 1016 / 1842 | clean |
| 4 | 11:26:05 | dossier **landed 36 207 B** (11:26:02), patching precisely | still sweeping (batch15) | 36 207 / 1842 | clean |
| 5 | 11:27:12 | 36 398 B (11:26:37), finishing; **final status=completed 11:26:48** | dossier **landed 34 705 B** (11:27:10), precision patches; **completed 11:27:27** | 36 398 / 34 705 | ` M 219a` (its own allowed write) |
| 6 | 11:29:03 | stopped | stopped | 36 398 / 34 705 | only research/wave_plans untracked + 219a M; **no src/scripts M** |
| 7 | 11:29:27 | stopped; final log line `end status=completed exit_reason=max_iterations` (11:27:28) | stopped | stable | same |

Between polls I ran read-only verification batches (grep/sed/node one-offs); one explicit `sleep 90`
separated polls 2→3 as the plan requires. No lane wrote outside its allowed set (dossier) + its briefed
scratch (`C:/Users/mnril/w13l1_scratch/`, `C:/Users/mnril/w13l2_scratch/`).

---

## §3 · Verification tables (12 headline claims; each with the real command + result)

### Lane 1 — 6 load-bearing claims

| # | Claim (as written) | My command | Result | Verdict |
|---|---|---|---|---|
| L1-1 | "`grep -c 'case "'` = **35** … USAGE has **34** keys — `diagnose` (case :2783) missing from USAGE … `README-cli.md:10` says 35; README.md says 34" | `grep -c 'case "'`; indent audit; `grep -n '^ *case "'`; read README-cli 1–14; live `new` probe (usage dump) | 35 case labels, all 6-space indent, single `switch (cmd)` @420 (run/gate share 444–445); USAGE 2898–2938 = 34 keys ending `deepen`, **no `diagnose`**; README-cli.md:10 = "*35 subcommands (verified on disk: `grep -c … = 35`)*" | **VERIFIED** |
| L1-2 | Doctor §2.2 decode: gaps from `FACTORY_GAP` (:183), `gapsOf` (:190), rules `:161/:162/:167`, latch `:175`, `factoryClaim` (:211–224), `runnerIsSandbox:false` (:230), `coerceFactoryClaim` (:243), `classifyJobSource` (:65), `inventoryFromJobSources` (:85); `headless.ts` `doctorStatus` (:3132), `collectJobSources` (:3094) | `grep -n` + `sed` on `doctor.ts` and `headless.ts` | Every cited anchor contains exactly what is claimed (leftover rule `stubs+reexports>0||real===0`; realMulti ≥2/0/0; productComplete extra; AND-latch; frozen evidence constant; classify: stub/reexport/regex) | **VERIFIED** |
| L1-3 | Matrix rows 6–7: `new` **BROKEN**; `run --until-hitl` **BROKEN/STALE** | `node … rapidtool-cli.mjs new "your brief here"`; `grep -rn "until-hitl"` across README/scripts/src/wave_plans/fixes/research | `{"ok":false,"error":"Unknown subcommand: new","code":"RT_E_VALIDATION","exit_code":1}`; `--until-hitl` → single hit at `README.md:37` only; `maxSteps = cmd === "run" ? 1 : undefined` @450 | **VERIFIED** |
| L1-4 | §5.1 w1 emit → **18 files, moduleEmbedded:true**, census `{stubs:0, reexports:2, real:1}` (dispatch=real, reroute/scan=reexport) | `doctor --tree C:/Users/mnril/w13l1_scratch/emit-w1` (my own run); transcript emit JSON | census `{0,2,1}` with exactly those three files/kinds; emit output `count:18, moduleEmbedded:true, exit 0` (@11:19:07 transcript) | **VERIFIED** |
| L1-5 | Matrix row 11: reference tree census `{stubs:0, reexports:5, real:0}` "**exact match**" | `doctor --tree research/eval-out/coffeehouse2home-property-ledger` (my own run) | `{0,5,0}`; files flip/publish/record/show/track all `reexport`; README.md:108–110 quote matches | **VERIFIED** |
| L1-6 | §5.2/5.3: C2H emit **REFUSED** (red trail, nothing written): banner emit = **20 files**, README top `[!CAUTION] RED TREE-RUN…`, census `{0,0,0}, files:[]`; **F1**: no CLI flag for `redTree:"banner"` | `doctor --tree …/emit-c2h-banner`; `ls emit-c2h`; `head README.md`; `find | wc -l`; `grep redTree rapidtool-cli.mjs`; `sed cli 800-812`; `grep -n redTree run-eval.mjs`; `node -e` on `c2h-project.json` | census `{0,0,0} files:[]`; banner tree = 20 files; CAUTION block + "3 failed tree-runs … no green tree-run since" exact; `emit-c2h/` **does not exist** (nothing written); `redTree` **absent** from CLI (rc=1), CLI passes only `{force}` @807; run-eval uses `redTree:"banner"` @809; project trail = exactly 3 `p6.tree.failure` rows; `lattice.jobs` = 10 (track…bid); `p6.jobs.shortfall` rows = 0 | **VERIFIED** |
| L1-aux | 137 lib files · 78 dossiers · `it(` counts 112/21/27 · hitl @42/50/74/82 → P4/P5/P8/P9 · PHASES.length 13 · keyless artifact (P0–P3 complete, P4 awaiting_hitl, generatedSource 0 B, modelRoute deterministic) · enforceDod @1802/:1885 · USAGE fixtures line @2911 · "no git spawn in src/lib" | direct counts/seds | all exact | **VERIFIED** |

*Minor anchor drift (report-only, §4): "run-eval.mjs:805 uses `emitProject(…{redTree:'banner'})`" — :805 is the comment; the call is :809. Substance true.*

### Lane 2 — 6 load-bearing claims

| # | Claim (as written) | My command | Result | Verdict |
|---|---|---|---|---|
| L2-1 | **G1 FIXED**: probe → exit 1, one coded envelope, stderr 0 B; `return respond(...)` on both branches (:381,:388) | `node … summary --project C:/nonexistent_nope.json` from a neutral cwd (stdout/stderr split) + `sed` cli 360-395 | **EXIT=1 · stdout 204 B** (`RT_E_PROJECT_MISSING`) **· stderr 0 B** — byte-exact to its §0; both refusal branches are `return respond(...)` | **VERIFIED** |
| L2-2 | **G3 FIXED**: new codes registered (`errors.ts:53-56`), branches `:196-204`; `errors.test.ts` 34/34 | re-ran the old probe; then a **direct classifier test** with real error objects via `classifyError` | `SyntaxError('Unexpected token…')` → `RT_E_VALIDATION`; real `JSON.parse` throw → `RT_E_VALIDATION`; EACCES→`RT_E_PERMISSION_DENIED`; ENOSPC→`RT_E_DISK_FULL`; EADDRINUSE→`RT_E_PORT_IN_USE`; ECONNREFUSED/ENOTFOUND/fetch-failed→`RT_E_NETWORK_UNREACHABLE` (all 7 legs). The old probe's lone `UNKNOWN` is a string-input artifact (no `.name`). 34/34 = raw in its transcript @11:24:18 | **VERIFIED** |
| L2-3 | **F1 FIXED**: `probeTagsFromSignature` spread into `lessonRow` tags (`knowledge.ts:952`); `honesty-guards` 5/5 | `sed knowledge.ts 905-960`; **ran** `node --experimental-strip-types --test --test-concurrency=2 src/lib/honesty-guards.test.ts` | spread present @952; test run **# tests 5 / # pass 5 / # fail 0** | **VERIFIED** |
| L2-4 | **DF-09 OPEN (loud)**: note optional, no caller passes one; rejection-only ≥12-char guard | `sed` engine 1620-1668, store 1525-1550, console 1836-1855; `grep -n "note:" engine.ts` | `note?: string` @1631; `note: opts?.note,` @**1663** (cited as :1650 → **CORRECTED**); store passes `{decidedBy,force,requestedAt}` @1529-1534; console `approve(projectId, { force })` @1838-1841; rejection guard @1547 | **VERIFIED** (1 anchor corrected) |
| L2-5 | **DF-26 OPEN (loud)**: hard truncate 14 000 + `TRUNC_MARKER` @`packet.ts:17,545-569`; console has **0** truncation UI | `sed packet.ts 15-18 / 543-570`; `grep -c TRUNC console.tsx` | `PACKET_MAX_CHARS = 14_000`; `TRUNC_MARKER = "…[TRUNCATED — regenerate at a HITL gate for the full plan]"` @17; `truncateToBudget` @545+; grep TRUNC → **0** | **VERIFIED** |
| L2-6 | **DF-18 OPEN (loud)**: packet carries the caveat @`packet.ts:498`; `ScorecardBlock` renders none (`console.tsx:3303-3362`); grep 0 in console | `sed packet.ts 496-500`; `grep -c "feasibility\|template-derived\|not live research" console.tsx`; `sed console 3300-3310` | caveat EXACT @498; grep → **0**; `function ScorecardBlock` @3303 | **VERIFIED** |
| L2-aux | scan md5 · G2 row @3232/:3239/:3266 · G6 sink `:565-750`, call sites `:897,:2605,:2608,:2857-2869`, event `:749` · G4 0 hits · G5 RT_E=0 in every file · F3/F4 · sizes 6203/3891/2938 · console mtime 11:09:23 · popup catch (e) {} @163/169/173 · DF-01 @872-873 · DF-04 @922 + no MCP module · DF-25 test-only · DF-38 no cases · archProductComplete (gates.test only) · verify.server `catch{return null}` @~273 · §3 doc refs 8/8 exact · 218 §2.6-vs-§3.5 · `nextAction` 0 hits, uiNextAction @311/:1806 · CHAT_CONTEXT_MAX_CHARS @chat.server.ts:53 · DF-13 @5383 | direct counts/seds/greps | all exact (incl. **md5 `a8e5b42f3007e9a6d2e926289c200f1e`** for both its `scan_today.json` and my independent re-scan → its scan was real, not quoted) | **VERIFIED** |

*Minor anchor drift (report-only, §4): "`wave_plans/W11/README.md:7` now cites `fixes/216z`" — the citation is on :8 (:7 is the sentence's start). Substance true (dead `217_w10_close` citation gone).*

---

## §4 · Hallucination-shape hunt (plan step 4 — instance by instance)

1. **Round numbers no command produced** → **none found.** Every count I re-derived matched: 35/34 verbs; USAGE 34; 137 lib files; 68 test files; 78 dossiers; 112/21/27 `it(`; 377/89/126/24/162/24 scan; 6203/3891/2938 lines; 20 files; 18 files; 204 B/0 B; 10 jobs → 5 materialised; `PHASES.length` 13. (Two byte-level coincidences even held: the G1 stdout was exactly 204 B as claimed, and lane 2's scan file is byte-identical to mine.)
2. **`file:line` that does not contain what is claimed** → **3 instances, 1 requiring correction:**
   - **`engine.ts:1650` for the note write (lane 2, 2 occurrences) → CORRECTED** (actual :1663; :1650 = `const next = Math.min(12, …)`). This is the only anchor that points at unrelated code.
   - `run-eval.mjs:805` vs actual call `:809` (lane 1) — the cited line is the comment that documents `redTree:"banner"`; substance true → **report-only**.
   - `wave_plans/W11/README.md:7` vs citation on `:8` (lane 2) — same-sentence ±1 line; substance true → **report-only**.
   - All other sampled anchors (~60+) contain exactly what is claimed — including hard ones (`packet.ts:498`, `:17`; `console.tsx:1838-1841`, `:2004`, `:5383`; `store.ts:1547`; `chat.server.ts:53`; `engine.ts:252`, `:922`, `:872-873`; `errors.ts` regions; README-cli.md:10; AGENTS.md:70/76/85/91; AGENT_GUIDE.md:13/81; README.md:93).
3. **A "FIXED" verdict with no command behind it** → **none found.** Every FIXED row I could independently test passed live: G1 (re-probe), G3 (classifier test), G6 (sink wired at both live call sites), F1 (test 5/5), T-11 (same), F3/F4 (annotations/dead-citation actually present). G4/G5 are marked OPEN and re-verified OPEN (0-hit greps / RT_E=0).
4. **Competitor/summary claims from memory** → **none present** in either dossier (the only "competitor" content is RapidTool's own illustrative templates inside its artifacts, which lane 2 marks `source:"illustrative"` — verified at `engine.ts:116-149` residual level via its DF-21 row).
5. **A count that contradicts `fixes/218` §5 (261 scripts / 1957 lib)** → **none.** Lane 1 quotes exactly those numbers, labelled taken-from; lane 2 quotes no conflicting suite counts.
6. **Extra shape check (self-referential claims):** lane 2's freshness caveat ("console.tsx mtime 11:09:23 postdates the 11:08 gate") — mtime exact (`11:09:23.461`). Lane 1's "The repo was not written to" — checked at every poll: only its own dossier was written in-repo. Both honest.

---

## §5 · Corrections applied (attributable, in-place — 4 markers total)

| # | File | Where | Marker (as applied) |
|---|---|---|---|
| C1 | `research/multiagent/219a_inventory_and_reality.md` | end of §0, after "not a clean checkout." | `> [WD-A · 2026-09-24] CORRECTED: "HEAD aa12c6c; tree dirty" → true when measured (11:14:58) but committed as `7582771` at 11:15:16; HEAD now `7582771`, no modified src/scripts files. — evidence: transcript 11:14:58; `git reflog` HEAD@{0}; `git status --short`. (verified by WD-A, not by the lane)` |
| C2 | `research/multiagent/219b_defects_live_status.md` | header, after "Tree drift…" line | `> [WD-A · 2026-09-24] CORRECTED: "HEAD aa12c6c + uncommitted W10/W11/W12 work" → true when measured (11:14:58–11:15:03) but committed as `7582771` at 11:15:16; anchors below were read from the same bytes, now committed. (verified by WD-A…)` |
| C3 | `research/multiagent/219b_defects_live_status.md` | after §1.1 table (before §1.2) | `> [WD-A · 2026-09-24] CORRECTED (DF-09 row anchor): "note optional (engine.ts:1650)" → note field :1631, write :1663; :1650 is unrelated. DF-09 substance VERIFIED. (verified by WD-A…)` |
| C4 | `research/multiagent/219b_defects_live_status.md` | §4 item 1, after the paragraph | `> [WD-A · 2026-09-24] CORRECTED: "writes note: opts?.note (engine.ts:1650)" → write at :1663; all other refs in the item verified exact. (verified by WD-A…)` |

No lane prose was rewritten; no finding was deleted; nothing unverified was added. Dossiers re-read after
the edits; markers render as blockquotes and no table structure was touched.

---

## §6 · Method, budget, and what I did NOT verify

- **Commands used:** read-only greps/seds/counts; `git status/log/reflog/rev-parse` (no mutations); `doctor` + `doctor --tree` (3 runs, incl. one reference tree and the two lane-1 scratch emits); one `emit`-adjacent classifier/one-off `node -e` probes; **2 targeted test runs** within budget: `honesty-guards.test.ts` (5/5) and `lesson-writers.test.ts` (18/18, `--test-concurrency=2`). No `npm test`, `npm run typecheck`, `npm run build` (forbidden). All scratch outputs under `C:/Users/mnril/w13wda_scratch/`.
- **Not verified (honest limits):** full gate/typecheck/build on current bytes (forbidden); `errors.test.ts 34/34` only via lane 2's raw transcript; F2's clamp window (register-only, same as lane 2); `verify.server` callers beyond the null-return site; DF-29 (cosmetic, both sides UNVERIFIED); any keyed/browser behavior. Test-count claims (261/1957) are taken-from `fixes/218` §5 by both me and lane 1.
- **Why the two dirty-tree headers happened (no fault found):** the commit `7582771` landed 11:15:16, mid-run (delegation started 11:14:48); both lanes summarized a snapshot taken 18–27 s earlier. Worth knowing for future waves: give lane briefs a "re-check HEAD at write time" line.
