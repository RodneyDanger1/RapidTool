# W34 · THE PREP WAVE — 3 planners audit what remains and pre-digest it for the coders who come next.
**All readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`). HEAD `0f85c32` + the W29–W33 uncommitted era (~2,700+ insertions). **NOTE: lanes L1/L2/L3 (deleg_8c1fed00) may still be LANDING as you read — re-read the bytes before judging any item; their returns will change the "remaining" set and your PREP must say so explicitly where relevant.**
**PURPOSE:** not to code — to **think hard, sequentially, for the coders.** Every remaining task, issue and bug → analyzed into a coder-ready card: WHAT is wrong/shelled/missing · WHERE (file:line, seams) · HOW to code it (the approach + the constraints that must hold) · DONE-WHEN (the proof the coder will produce) · RISK (what it collides with). The next wave should need ZERO re-analysis.
**READ FIRST:** `START-HERE.md` · `finalsprint.md` (master table + §S/§T/§WDX + corrections) · `research/multiagent/thoroughanalysis.md` (§W27-WORKLIST + §R1–R15) · the newest lane logs `fixes/276_*` + `fixes/277_*` (as they land) · `fixes/274_wdx2.md` (the truth-audit + its corrections).
**APPEND PROTOCOL:** `wave_plans/W34/prep.md` — append-only via its END-OF-FILE-MARKER-PREP; sections §P1/§P2/§P3 are yours; re-read before EVERY append. Lane logs `fixes/278_p<n>_*.md` EARLY.
**CONSTRAINTS on all: READ-ONLY on product code** (no edits — you plan); no test runs; no builds; no keyed calls; log-and-continue. Verify claims against BYTES (grep/read), never against logs' words — the CF-4 lesson: lanes have overstated before.

## P1 — THE HONEST REMAINDERS AUDIT (what is truly left to code)
Sweep EVERY claim of "landed/shelled/owed" across `finalsprint.md`, the register, and the logs of W29–W33 (incl. any overstatement, like CF-4's seat/isolation). For each item produce: **TRUE STATE** (LANDED / SHELL-ONLY / ABSENT / OWED / BLOCKED-on-<X>) + the byte evidence (file:line that proves it). End with the definitive, deduplicated **"REMAINING TO CODE" list** — every line coder-actionable, none vague, no item claimed done without its bytes.
Include at minimum: the shell-sprint's known gaps (checkpoint integration/resume/unattended read `fixes/276_f1_real_autonomy.md` + L2's log when it lands · universality read `fixes/272_s2_universality.md` + L1's log · UI surfacing S5-Part-B/L3), the E-25 red + the nested subtest (their names + the last observed counts: headless 96/94/2 at 19:11:42), the pasted-records debt, and everything §W27-B/C/D still lists.

## P2 — THE HOW-TO FIX ANALYSIS (the deep thinking per task)
For every item in P1's list: a **coder card** — (a) ROOT CAUSE / exact gap (why it exists; what the code does today, quoted); (b) THE FILES (file:line + the seams to use; name the test contracts that constrain the change, e.g. `scaffold.test.ts:338`'s E-15 sweep, `emitted-honesty.test.ts:42`'s prefix, the doc-parity test); (c) THE APPROACH (2–6 concrete steps, the smallest honest shape, where the TODO goes, what must stay byte-compatible); (d) DONE-WHEN (the exact leg/command/assert a verifier will run); (e) TRAPS (the ways a coder could break something — collisions, contracts, the box's 8GB rules, the no-tty quirk for test legs). Think SEQUENTIALLY: read the actual code for each (grep/read) — never plan from memory of the logs.

## P3 — THE NEXT-WAVE SHAPE + RISK/DEPENDENCY MAP
Turn P1+P2 into **the next wave's plan**: (a) the lane cut (which tasks share files → same lane; which parallelize safely — name the file-ownership boundaries); (b) the ORDER (what first: the boundary reds? the L-lane gaps? the universality? — justify); (c) the BOUNDARY LOAD (what the parent must run after: typecheck/lint/suites legs + their current known reds); (d) BLOCKERS (owner items O-1/O-4, the AGENTS.md consent, the isolation host gap, anything new you found); (e) THE COMMIT SHAPE (what rides in the next commit; the message skeleton). End with the **single recommended dispatch** (N lanes, each with a one-line charter + its file box) the parent can execute verbatim.

---

## §P1 — THE HONEST REMAINDERS AUDIT (lane P1 · read 2026-09-26 ~19:32–19:44 CDT)

**Method.** Every claim re-read at the BYTES (grep/read against the working tree), never from a log's words. Swept: `finalsprint.md` (full) · `thoroughanalysis.md` §W27-A…H + §R3/§R6/§WD-δ/§R9–§R12/§R13/§R15 · `fixes/272_s1–s5` · `fixes/273_t1–t5` · `fixes/274_wdx2/wdx3` · `fixes/276_f1–f3` · `fixes/277_l1–l3` (all landed 19:33–19:39) · delegation transcripts (`deleg_3963da37` F-lanes all ended `max_iterations` by 19:11:35; `deleg_8c1fed00` L-lanes LIVE) · the red captures `%TEMP%/f3_headless.log`, `%TEMP%/f2_e25.log`, `%TEMP%/f2_edit.log`, repo `_f1_headless.log`. Full register + per-item table: **`fixes/278_p1_remainders.md`**.

**⚠ THE L-LANE CAVEAT, EXPLICIT.** L1/L2/L3 (`deleg_8c1fed00`, 19:28:55) were **STILL LANDING during this audit**; every "[L# flight]" item was re-read within minutes of its landing and **will move again**. Confirmed in-flight at 19:36–19:42: `scaffold.ts` (L1 — `uiGeneration` type/options landed at `:92/:112/:150`; per-kind wiring NOT yet; **L1's 19:39 log board is ahead of its bytes, 2 of 9 rows visible**) · `headless.ts`+`checkpoint.server.ts` (L2) · `headless.test.ts` (L3 — E-25 pin ① re-pointed, pin ② still old). **The next wave must re-derive the "remaining" set from the tree, not from this section.**

### §P1.1 — THE REDS (boundary; names + last counts)

| Red | Exact names | Evidence |
|---|---|---|
| headless E-25 | `E-25 — CLI machine contract (exit codes + envelope + doctor)` (describe `headless.test.ts:1220`) fails with **2 nested subtests**: ① `CLI: --i-am-human WITH the out-of-band token records the human seat (exit 0)` ② `CLI — an approve landed by the CLI carries the provenance on the row it mints` | `%TEMP%/f2_e25.log` (19:06): E-25 leg 30 tests · 28 pass · **2 fail**, both `1 !== 0`. Full-file `%TEMP%/f3_headless.log` (19:06): **96 · 93 · 3** (the 2 E-25 + W-02 keyless). F1 fixed W-02 (`stripVolatiles` @ `headless.test.ts:629-650`; re-run ok 19:07:22) ⇒ the parent-observed **96/94/2 @19:11:42 = exactly these 2 E-25 pins**. |
| edit-test | `rapidtool-cli-edit.test.mjs` not ok 6 · 7 · 9 (`:300` deny-no-token / `:327` dry-run deny / `:401` verified-seat write) | `%TEMP%/f2_edit.log` (10 tests · 7 pass · 3 fail) — same drift class. |
| typecheck (CF-2) | `npx tsc --noEmit` exit 2 @18:12:28, errors in sibling files (`headless.test.ts`, `llm.test.ts`, …) | T2's transcript; **un-re-verified since** (no runs this lane). |
| scripts program | 1030 errors staged (`tsconfig.scripts.json`, `TODO(R15-f04)`) | staged, deliberately NOT in gate.sh. |

**E-25 root cause (resolved):** the CLI implements **R5-f12 Track-1 two-channel seat** — `rapidtool-cli.mjs:579` requires `--i-am-human` on non-TTY, and `--i-am-human` on a non-TTY is then **refused outright** ("needs an interactive confirmation … not a TTY" — F2 repro), because no second channel exists. Spec `thoroughanalysis.md:869-877`: Track-1 = REFUSE the non-TTY human seat; tests "**must be re-pointed** with whichever track lands". **The CLI is per spec; the 2 headless pins + 3 edit-test pins are the stale side.** L3 re-pointed pin ① (`headless.test.ts:1608` now asserts exit 1 + no mint + parked); **pin ② (`:1753`) + the edit-test three were still old at 19:41 [L3 flight].**

### §P1.2 — TRUE STATE per claim (evidence inline; full table in the lane log)

**LANDED (bytes confirmed):** reviewer wire (`store.ts:29/:1122/:1126` · `headless.ts:56/:3723/:3729/:3887/:3913`) · W-01/02/03 E1b trio (`runP6Edge` `headless.ts:2352`+`:380`; `wildP6Edge` `engine.ts:3853`+`:3544/:4048-4050`; emit materialization `headless.ts:1659`) · `checkpoint.server.ts` module (9,105 B — **but zero consumers ⇒ SHELL-ONLY**) · W-18 store (`store.ts:1197`) · W-21 core (synth `codegen.server.ts:2329-2335`; verify budget supplied `headless.ts:3197-3199`) · T1 W-16/W-23b (`store.ts:281`+7 sites)/W-31 (`README-cli.test.mjs:80/:171-176`) · T2 R15 (9 rows: migration+guard, tsconfig.scripts, prettierignore, AGENTS, .env.example, version/engines, README i18n, CSS focus, banners) · T3 f09 failover (`registry.ts` chain+7/7 test)/f10 (`knowledge.ts:1569`)/f13 (`scaffold.ts:2195/:2288` kindHandoff)/f14 de-scope · T4 DF-09 (`honesty-guards.test.ts:466-485`) · T5 OV-20 probe (`scripts/docs-module-parity.mjs`) + register rows · S5's R11-f01 (`vite.config.ts:145-165` + `--host` removed from dev script)/R11-f06 (`browser-guard.mjs:48-55` win32 fail-closed)/R11-f07 (`path-safety.mjs` ×3 consumers)/R12-f01 (`P6_SYNTH_PRIOR_MAX_FILES=12` `codegen.server.ts:165,:1315-1321`)/R12-f05 (console.tsx:1199)/R12-f07 (CLI `:3244-3313`)/R12-f11 (`io.ts:38,:435`) · WDX-3 W-18+wild-step fix.

**SHELL-ONLY / ORPHANED:** `quarantine.ts` (**0 consumers** — CLI arm absent, `EMIT_SKIP_DIRS` unchanged `headless.ts:1443`) · `docs-module-parity.mjs` (advisory; keep/cut = parent) · `subagent.ts` (de-scoped with marker, T3).

**ABSENT (claimed done somewhere, not in bytes — the CF class):** **S1's resume/unattended/`readWildPlan`** (CLI = 37 verbs; `engine.ts` untouched since 17:45:57; `grep wildPlan engine.ts` = 0) · **S2's ENTIRE board (9 rows, 0 landed)** — no `R3-f06`/`uiGeneration`-wiring in `scaffold.ts`; no `bin`/`exports`/`files`; `run-eval.mjs` untouched since 16:00:50; `codegen.server.ts:503` still "Assign module.exports" · **S4's seat + isolation** (no `seat.ts`/`seat.server.ts`/`isolation.server.ts`; no `RT_E_HUMAN_SEAT_UNAVAILABLE`/`RT_E_ISOLATION_UNAVAILABLE` — **CF-4 CONFIRMED**) · S5's R12-f08/R12-f09 (`salvageTrim` `store.ts:735` trims only logs/chatLog; no debounce) + R11-f03 label (`rapidtool-cli.mjs:25` still "read-only, never re-emits"; no "does execute" line) · S3's cassette/`onToken`/MCP/`wildPolicy`/`wild.paused_policy` (`\bonToken\b` = **0** in deepseek.ts + openai-compatible.ts — the "3 hits" were `completionTokens` substring noise, twice mis-stated) · `scripts/cli-exit-taxonomy.test.mjs` (**absent**; referenced by CLI comment + R5-f12 static guard) · finalsprint §S/§T/§WDX-2/§WDX-3/§MASTER-CORRECTIONS (mtime 18:23:24; only §WDX-1 live; marker `:244`) · T-107.6 residuals · `T1-W35` claim conflict (`totalTokens` `token-ledger.ts:113-115` still unguarded).

**OWED/BLOCKED:** W-04/05/06 mint+partial semantics · W-08 wiring · W-10 fixtures seat · W-12/W-13 doc residuals · W-14/W-15 (→L1) · W-19/W-20/W-24…W-29/W-33/W-34/W-38/W-39/W-41–W-45/W-52/W-53 (register specs, all byte-checked today) · W-46 BLOCKED(W-02+O-1) · W-49 BLOCKED(host) · W-50 preview half · W-51 display residual · W-36 hygiene (9 probes at root + **NEW `_f1_headless.log` 222,917 B, 19:06** + `.t4scratch/` still in-repo).

### §P1.3 — THE DEFINITIVE REMAINING-TO-CODE LIST (deduplicated; every line coder-actionable)

**A. Finish the W33 block (the L-lanes' charters — verify/re-read, don't re-charter if they land):**
1. **[L1]** Universality: scaffold per-kind wiring (`vite.config.ts` for game — still webapp-only `scaffold.ts:2633`; `bin`+launcher cli-tool; `main`/`exports`/`files` library; PORT+start service; structured stubs keeping `TODO(E-15) stub` + `RT_E_VALIDATION · ` — contracts `scaffold.test.ts:338`, `emitted-honesty.test.ts:42`) · run-eval `expectedBehavior`+`verification` (additive keys OUTSIDE `checked`; `run-eval.test.mjs:381`) · `uiGeneration` call point + record (type landed `scaffold.ts:92/:112/:150`) · codegen rule-2 reword (`codegen.server.ts:465/:482`; keep worked example `:491` + CJS harness `verify.server.ts:417`) · `redTree`/`partial` + `capability.N` skip.
2. **[L2]** checkpoint consumers (guarded per-phase write + clear-on-complete in `runUntilGate`, `headless.ts`) · `resume` verb (CLI + USAGE + README-cli; `README-cli.test.mjs` count/list/USAGE parity pins) · `run --unattended` · `readWildPlan` accessor + read-point + keyed-only `planning.planSteps` gen (`types.ts:172-183/:433` ready).
3. **[L3]** E-25 pin ② (`headless.test.ts:1753`) + edit-test `:300/:327/:401` re-point to the two-channel contract (no weakening) · UI surfaces (plan/checkpoint/resume/unattended/stream/cassette/seat/isolation in `console.tsx`; FixturesPanel pattern; never name absent codes) + RunScreen `PaneBoundary` wrap + `componentDidCatch` dedupe · **record pastes**: §S1(+corr)/§S2/§S3/§S4/§S5 + §T1–§T5 + §WDX-2 (+RS-01..04) + §WDX-3 + §MASTER-CORRECTIONS (CF-4 = S4 seat/isolation) above `finalsprint.md:244`.

**B. The register's open rows (each has a §W27/§R spec; no re-analysis needed):**
4. **W-04** mint=behaviour (`treeRunTestedEvidence` `codegen.server.ts:3470`; scaffold tree-job swallow) · **W-05** null `lastTest` on partial (`partialTreeRefuse` `:3337`) · **W-06** partial cascade (28-red) · **W-07** = item 1 (L1).
5. **W-08** quarantine wiring (orphaned module → `emitProject` + skip dirs + envelope + docs).
6. **W-10** fixtures `--approve` seat + README claim (CLI approve/edit seat ✓ landed).
7. **W-12/W-13** docs truth residuals (README:109-115/:146/:171, AGENT_GUIDE, remainingwaves/taskuniverselog dated corrections).
8. **W-19** `gate.blocked` row (0 hits; `dod.ts:865-870`) · **W-20** served-model threading (`engine.ts:1982/:1992`) · **W-24** io↔hydrate parity (`io.ts:213-221` vs `engine.ts:2221-2227/:2238/:2405-2406`) · **W-25** honesty bundle (a/e/g/h/i + `llm.ts:79-84` + model-id validation) · **W-26** node-runner maxBuffer (`:306-315`) · **W-27** CLI contract bundle + `cli-exit-taxonomy.test.mjs` · **W-28** readmeBody annotation + emitted-UI bar · **W-29** sandbox strings (`console.tsx:1503/:1965/:3773`) + HomeScreen + a11y · **W-33** `decideTransition` (0 hits) · **W-34** async-tap twin (§R4-f02) · **W-38** console P6-journey trigger (`store.runP6Journey` dead `:133/:939`) · **W-39** rt-client finite guard (0 hits) + rt-ring caps + headers.
9. **W-41** streaming (`\bonToken\b`=0; no `--stream`) · **W-42** cassette consumers · **W-43** `wildPolicy`+consult+`wild.paused_policy` (0 hits each) · **W-44** MCP (no files) · **W-45** live-probe half (OWNER) + `callModel` failover arm · **W-49** isolation refusal seam (no host isolator) · **W-50** preview pane (kindHandoff ✓) · **W-51** eval display residual · **W-52** gate-review surface · **W-53** wire-or-keep-de-scoped.
10. **Owner/blocked:** W-46 (W-02+O-1) · W-54 (defer) · O-1 key · O-3 descopes · O-4 boundary · O-5 R3/R6 scribes · O-6 (R9–R12 land + re-consolidate).

**C. Boundary + hygiene (do FIRST):**
11. Typecheck pass (CF-2 scope: `headless.test.ts`, `llm.test.ts`, siblings) · headless leg to **96/96** (after item 3) · edit-test re-points green · `tsconfig.scripts.json` fold (`TODO(R15-f04)`, 1030 errors) · T1-W35 conflict check.
12. `.t4scratch/` removal · root sweep (9 probes + `_f1_headless.log` + `_el217g/_tc217g` logs) — W-36/O-2a keep-list.

**Nothing above is claimed done without its bytes; every "[L# flight]" item must be re-read at the next boundary.**

---

## §P3 — THE NEXT-WAVE SHAPE + RISK/DEPENDENCY MAP (lane P3 · byte reads 2026-09-26 19:31–19:47 CDT)

**§P2 caveat:** §P2 was NOT on disk at this append (prep.md = §P1 + this block); full working notes in `fixes/278_p3_waveplan.md`. §P3 derives from the same sources §P1 used + §P1 itself + my own byte reads (every claim carries its file:line / capture path + read time). The lane cut below is file-ownership-stable, so a later §P2 refines card text, not boxes.
**⚠ MOVING TARGET, EVIDENCE-STAMPED:** at 19:44–19:46 the L-lanes were still writing (`headless.ts` 19:44:32 · `scaffold.ts` 19:45:00 · `console.tsx` quiet since 18:21 · `rapidtool-cli.mjs` quiet since 18:12). W35 F1–F5 analysis lanes are live (`wave_plans/W35/factory-notes.md`; logs `fixes/280_f1/f2/f4/f5`; F3's log not yet on disk). **The next wave MUST re-read bytes before crediting any "[L# flight]" item — L1's board claims 9/9 DONE while `scaffold.ts` at 19:41 still pushed `vite.config.ts` webapp-only (`:2633`) and had no `"bin"`/`"exports"`/`"files"` (it changed again 19:45:00 — re-check).**

### §P3.1 — THE STANDING REDS: CURRENT TRUTH (reasoned from bytes, NOT run; confidence recorded)

**Red 1 — E-25 (headless suite + its 2 nested pins).** Last observed: `%TEMP%/f2_e25.log` (19:06): E-25 leg 30 tests · 28 pass · **2 fail**, both `1 !== 0` — ① `CLI: --i-am-human WITH the out-of-band token records the human seat (exit 0)` (loc `headless.test.ts:1581`, old numbering) · ② `CLI — an approve landed by the CLI carries the provenance on the row it mints` (loc `:1714`). Full-file `%TEMP%/f3_headless.log` (19:06): 96 · 93 · 3 (the 2 + `W-02 keyless floor`); the parent census **96/94/2 @19:11:42 = exactly these 2 E-25 pins** (W-02 fixed by F1's strip).
**Byte verdict (read 19:33–19:44):** the product is PER SPEC (R5-f12 Track-1 two-channel seat): `scripts/rapidtool-cli.mjs:579-586` (non-TTY without `--i-am-human` refuses) · `:3408-3422` `humanSeatClaim` refuses any non-TTY outright — "…needs an interactive confirmation … this stdin is not a TTY…" — surfaced at `:615-621` as `RT_E_VALIDATION`, exit 1. Both pins were STALE (expected exit 0/write). Both have since been re-pointed:
· ① → `headless.test.ts:1608` (edit 19:06:58) `CLI: a non-TTY --i-am-human is refused even WITH the env token — the two-channel seat needs the TTY re-entry (R5-f12 Track 1)` — asserts exit 1 + `RT_E_VALIDATION` + `/needs an interactive confirmation/` + `/not a TTY/` + `/RT_HUMAN_SEAT_TOKEN/` + no row + parked; every asserted byte exists in the product strings above (and `runCli` scrubs `NODE_TEST_CONTEXT`, merges env, spawns non-TTY) → **EXPECTED GREEN · confidence HIGH.**
· ② → `headless.test.ts:1753` (edit 19:39:11) `CLI — a non-TTY approve mints NO row: no provenance may land from a machine` — same refusal + ledger BEFORE/AFTER snapshot + `no machine path may mint decidedBy:human` → **EXPECTED GREEN · confidence HIGH.**
Residual: **no capture newer than 19:06 is on disk** (the 19:11:42 census predates pin ②'s 19:39 re-point); and the `262` no-op-trap doctrine applies to any filtered re-run (require the pin's own `ok N - <name>` line, never the exit code alone). **The boundary must re-run the leg; until then "green" is reasoned, not observed.**

**Red 2 — `W-02 keyless floor` parity leaf (`headless.test.ts:606`, inside the `fixes/144 (M4-2)` suite).** 19:06 diff = exactly: packet `compiled_at` (text + JSON, in artifact bodies + packet string) · `phases[6].startedAt/completedAt` · `traces[].ranAt` (5 hunks). `stripVolatiles` (`headless.test.ts:627-656`) masks exactly those + `logs[].ts` + `gate.checkedAt` → **EXPECTED GREEN · confidence MEDIUM-HIGH** (the capture's elided middle was not fully visible; one un-masked volatile byte keeps it red — a ~90 s re-run settles it).

**Red 3 — `scripts/rapidtool-cli-edit.test.mjs` (NOT in the parent's count; same drift class, still live).** `%TEMP%/f2_edit.log` (19:08): 10 tests · 7 pass · **3 fail** — `:300` deny-no-token · `:327` dry-run deny · `:401` verified-seat write. File mtime = **Sep 17** → not re-pointed yet (L3's log flags it) → **STILL RED until re-pointed · confidence HIGH.** The two-channel contract makes these pins unwinnable as written.

**Red 4 — typecheck (CF-2).** Last run exit 2 @18:12:28 (siblings). **UN-re-verified since**; L-lanes have rewritten `headless.ts`/`headless.test.ts`/`scaffold.ts` after that. **UNKNOWN — run at freeze; it gates everything.**

### §P3.2 — THE LANE CUT (file-ownership boundaries — no two lanes share a file)

| Lane | One-line charter | File box (exclusive) | Legs it must leave green |
|---|---|---|---|
| **C1 · AUTONOMY CLOSE** | Finish/verify `resume` + `run --unattended` + `readWildPlan` to bytes; re-point edit-test pins; create-or-strike the missing exit-taxonomy guard | `scripts/rapidtool-cli.mjs` · `scripts/README-cli.md` · `scripts/README-cli.test.mjs` · `scripts/rapidtool-cli-edit.test.mjs` · `src/lib/headless.ts` · `src/lib/headless.test.ts` · (new) `scripts/cli-exit-taxonomy.test.mjs` | headless **96/96** · E-25 filtered leg all-`ok` · edit-test **10/10** · README-cli 12/12 (+ new-resume count parity) |
| **C2 · PIPELINE HONESTY** | W-19 `gate.blocked` · W-20 served-model · W-24 io↔hydrate parity · W-33 `decideTransition` · W-43 `wildPolicy`+`wild.paused_policy` consult · the `p6-behavior`/park-split dod shell | `src/lib/engine.ts` · `src/lib/dod.ts` · `src/lib/store.ts` · `src/lib/io.ts` · `src/lib/packet.ts` · `src/lib/rt-events.ts` · `src/lib/types.ts` | engine/store/packet/rt-events suites + the per-row §-spec pins |
| **C3 · OUTPUT FACTORY** | Verify/complete L1's 9 rows · W-04 mint=behaviour · W-05/W-06 partial semantics · W-14 grader v2 · W-15 4 kind fixtures · W-08 quarantine wiring | `src/lib/scaffold.ts` · `src/lib/codegen.server.ts` · `src/lib/compile-check.server.ts` · `scripts/run-eval.mjs` · `research/eval-corpus/**` | run-eval **35/35** · codegen/scaffold/compile-check suites · per-kind `doctor --tree` |
| **C4 · UI SURFACING** | The six surfaces (plan/checkpoint/unattended/stream/cassette/seat-isolation) + RunScreen `PaneBoundary` wrap + W-11/W-29 strings | `src/components/console.tsx` · `src/routes/**` | console render probe; grep-honesty; **never name** `RT_E_HUMAN_SEAT_UNAVAILABLE`/`RT_E_ISOLATION_UNAVAILABLE` (absent codes) |
| **C5 · RECORDS + DOCS** | Paste the owed §-appends + §MASTER-CORRECTIONS; W-12/W-13 doc truth; W-37 record debts | `finalsprint.md` · `fixes/**` · `README.md` · `AGENT_GUIDE.md` · `remainingwaves.md` · `taskuniverselog.md` | every owed section above `finalsprint.md:244` with source-log attribution; marker intact |
| **Parent** | freeze → hygiene → boundary legs → commit | repo root · `.gitignore` · `AGENTS.md` (CONSENT ONLY — see §P3.5) | §P3.4 |

**Why these boxes:** `headless.ts`/`headless.test.ts` ride ONE lane (C1) because the E-25 pins and the resume wiring are the same driver's bytes; `scaffold.ts` vs `console.tsx` vs `rapidtool-cli.mjs` are disjoint siblings with distinct test contracts (`scaffold.test.ts:338`, FixturesPanel render pattern, README-cli parity) — never two writers. `dod.ts` is C2's; C3 requests the `p6-behavior` row via a pre-specified interface (row id + evidence shape), landed by C2 first or as a C2-blessed patch. `types.ts`/`rt-events.ts` stay single-writer (C2).
**Dependencies:** C4's labels read `project.wildPlan` (typed `types.ts:433` — safe today) and the checkpoint file (C1/L2); C3's mint work sits BEHIND C2's `dod.ts` shell; C5 appends only after the marker re-read and never while another lane appends to finalsprint.md.

### §P3.3 — THE ORDER (reds first; evidence-justified)

0. **FREEZE + RE-READ (parent):** L-lanes stop; snapshot `git status --porcelain` + mtimes; re-read `fixes/276_*` + `277_*`; strike every charter line the bytes already carry (CF discipline — boards have overstated twice).
1. **TYPECHECK/LINT PASS FIRST** (CF-2): it is the cheapest gate, currently RED-risk from L-edits, and every other done-when assumes it — one `npm run typecheck` + `npm run lint` (unpiped) tells you whether the wave starts clean.
2. **THE STANDING REDS (test-side) — BEFORE new feature bytes in the same files:** the product is per spec; the pins are stale; the re-points are small, already half-landed (pin ①②), and they gate the headless + edit-test legs the boundary must certify. Doing them first also gives C1 a clean `headless.test.ts` baseline before its `resume` leg extends the same file.
3. **THE L-GAP COMPLETIONS (C1–C4)** on the frozen boxes — in any order except C3-behind-C2's dod shell and C4-after-C1's accessors.
4. **C5 SCRIBE IN PARALLEL** — it touches no product bytes and no other lane's box; the marker discipline is the only constraint.
5. **BOUNDARY + HYGIENE + COMMIT (parent, §P3.4/§P3.6).**
Justification vs the alternative ("L-gaps first"): the L-gaps are the bigger substance but they were *still landing* during this audit — starting them before the freeze guarantees re-work and mixed drift; the reds, by contrast, are a same-day test-side re-point whose fix is already 2/3 on disk and whose absence blocks step 5 outright.

### §P3.4 — THE BOUNDARY LOAD (what the parent runs after the wave — exact legs + last-observed counts)

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
npm run typecheck        # must be 0            (CF-2: last run exit 2 @18:12:28 — un-re-verified)
npm run lint             # UNPIPED (pipe hides the exit code)  (19:31: exit 0 + 1 warning `scaffold.ts kindHandoff unused`; kindHandoff now used `scaffold.ts:2345` → expect 0)
node --experimental-strip-types --test src/lib/errors.test.ts               # 37/37
node --experimental-strip-types --test src/lib/wild-step.test.ts            # 14/14
node --experimental-strip-types --test src/lib/llm/providers/registry.test.ts  # 40/40
node --experimental-strip-types --test src/lib/honesty-guards.test.ts       # 13/13
node --test scripts/README-cli.test.mjs                                     # 12/12 (+ the resume count/USAGE parity lines once C1 lands)
node --test scripts/run-eval.test.mjs                                       # 35/35
node --test scripts/rapidtool-cli-edit.test.mjs                             # 10/10  (7/10 @19:08 — red 3)
node --experimental-strip-types --test src/lib/headless.test.ts             # 96/96  (96/94/2 @19:11:42 — reds 1–2)
node --experimental-strip-types --test --test-name-pattern="E-25" src/lib/headless.test.ts   # the E-25 leg — REQUIRE the `ok N - <name>` lines (262 doctrine), not the exit code
bash scripts/gate.sh     # full boundary (typecheck→lint→scripts→src→build + verdict); never mid-edit
```
**Known current reds (all must be re-derived at freeze):** headless **96/94/2 @19:11:42** (= the 2 E-25 pins; both re-pointed since, unre-run) · edit-test **7/10 @19:08** (3 stale pins, untouched) · **typecheck CF-2 UNKNOWN** · `tsconfig.scripts.json` staged 1030 errors — deliberately NOT gated (`TODO(R15-f04)`); folding it is a separate owner-scoped step, not part of this boundary.

### §P3.5 — BLOCKERS (owner items + consent + host + new)

- **O-1 (funding) / O-4 (keyed boundary runs):** every funded done-when (W-01/02/03 keyed verify, W-14/W-15 per-kind grader runs, W-17 probe, W-44/W-45, W-46/OV-38/39/40) stays blocked; DeepSeek account unfunded → 402. Code + fake-seam tests are READY now; mark keyed legs as pending at the boundary.
- **The AGENTS.md consent (two writes pending, one act needed):** (i) ledger #50 doctrine — `research/multiagent/262_agents_md_proposal.md` (the `--test-name-pattern` no-op trap + `NODE_TEST_CONTEXT` scrub; exact patch text ready; the prior attempt was **correctly BLOCKED** — "silence is not consent", do NOT retry from a lane); (ii) R15-f08 — `.grok/` is partially load-bearing; AGENTS.md's blanket "not the contract" claim is false + the descope map. **Byte check: `git status --porcelain AGENTS.md` = CLEAN at 19:43 — no AGENTS.md correction is on disk (the V33/T2 "M AGENTS.md" claim is not in bytes).** Both writes + the START-HERE cold-start entry belong in ONE owner-consented act.
- **R13-f04 host gap (W-49):** no isolator exists on this host (no docker/bwrap); the claim stays frozen (`sandbox:false` everywhere); the console may not name an isolation code that isn't in `errors.ts`. Needs a real host isolator (Linux user-ns/bwrap or Docker/WSL2) before the executor swap.
- **NEW (found this lane):** · `scripts/cli-exit-taxonomy.test.mjs` is **cited by the CLI's own comments (`rapidtool-cli.mjs:598-603`) but does not exist** → create it (static: two-channel same-env degeneracy + exit taxonomy) or strike the citation — C1 owns the call. · `W-36` hygiene debt live at root: `.t4scratch/`, `_f1_headless.log` (222,917 B), `_el217g*.log`, `_tc217g*.log` ×4, probes — clear/ignore BEFORE the commit. · W35 F1–F5 (**analysis** lanes) are running and will claim edges of the same files — dedupe, don't collide; their appends go to `wave_plans/W35/factory-notes.md`. · §P2 not landed; the next wave may hit it mid-read. · **Do not run `hermes verify` as-is** (`fixes/228 D2.4`: its recipe runs write-mode `npm run format` — needs the owner's `format:check` decision, T3.6). · Keyed runs OFF; full gates OFF until freeze (hard rule 2).

### §P3.6 — THE COMMIT SHAPE (what rides the next commit + the message skeleton)

**Rides (`git status --porcelain` @19:43 = 65 M + 58 ??):** the whole W29–W35 era —
- **Tracked M (65, ~+2,821/−289):** the engine/UI/harness/state edits (src/lib/* incl. engine/store/headless/codegen/scaffold/policy/packet/io/rt-*/types; `console.tsx`; `scripts/*` incl. cli/gate/run-eval/guards; docs edits; `package.json`/`vite.config.ts`/`.env.example`; `research/multiagent/thoroughanalysis.md`; `agentnotes.md`; `migrations` …).
- **Untracked NEW product+tooling:** `src/lib/checkpoint.server.ts` · `wild-review.ts` · `quarantine.ts` · `scripts/path-safety.mjs` · `docs-module-parity.mjs` · `gate-verdict.test.mjs` · `src/lib/llm/providers/registry-failover.test.ts` · `src/lib/quarantine.test.ts` · `migrations/auth/0002_account_unique.sql` · `tsconfig.scripts.json` · `.prettierignore`.
- **Untracked RECORDS (must ride):** `START-HERE.md` · `finalsprint.md` · `docs-FOLDER-MAP.md` · `fixes/271…280` (all lane logs, incl. this wave's 277/278/279/280) · `wave_plans/W29…W35` (incl. `W34/prep.md` with §P1+§P3 and `W35/factory-notes.md`).
- **NOT riding (clean/ignore first):** `.t4scratch/`, `_f1_headless.log`, `_el217g*.log`, `_tc217g*.log`, root probes outside the W-36 keep-list, `.audit-g2/`, anything under `%TEMP%` (outside the repo). AGENTS.md is clean; do not sneak the consent edits in.
**Message skeleton (repo style — the era's title, then cluster lines, then the boundary evidence, then what stayed owed):**
```
W29–W35: shell sprint → landing era → factory audit — keyed spine, autonomy wires, universality kinds, two-channel seat, records

- W29/W29b: state guards (wipe chain, wild clobber, W-18), wild-step tests, quarantine+path-safety, seat/policy seams, gate.sh red-leg gate
- W30/W31: the shell sprint (S1–S5) + the T1–T5/WDX audits + master-table corrections RS-01..04
- W32/W33: organizer (START-HERE, folder map) + F1–F3 + L1–L3 close-out: universality per-kind wiring · checkpoint+resume+unattended · UI surfaces · E-25 pins re-pointed
- W34/W35: the prep wave (§P1/§P3 in wave_plans/W34/prep.md) + the factory-process analysis (§F1–§F5)
- Boundary: typecheck 0 · lint 0 (unpiped) · errors/wild-step/registry/honesty-guards/README-cli/run-eval/edit-test/headless legs green · gate.sh clean  [paste real counts]
- Owed, NOT in this commit: keyed boundary runs (O-1/O-4) · isolation host (R13-f04) · AGENTS.md consent writes (262 proposal + R15-f08)
```
(The commit is the parent's first since `0f85c32`; it is the era's memory — keep the cluster lines true and the owed list honest.)

### §P3.7 — THE RECOMMENDED DISPATCH — the close-out wave (parent executes verbatim)

**PRE-FLIGHT (parent):** freeze writers · `git status --porcelain` + mtimes snapshot · re-read `fixes/276_*` + `fixes/277_l1/l2/l3` + the L-lane logs' final boards · strike from the charters below every item the bytes already carry (bytes > boards).

**LANE C1 — THE AUTONOMY CLOSE (CLI + headless).**
CHARTER: to bytes: `resume` (read → `checkpointAdmits` → re-enter at `cp.run.phase`; USAGE + README-cli row + count-parity) · `run --unattended` (real drive; name the host scheduler; `RT_E_UNATTENDED_UNSUPPORTED` only if it genuinely can't) · `readWildPlan` accessor + read path · verify L2's checkpoint per-phase write + clear-on-complete · re-point the 3 edit-test pins IF still stale · create-or-strike `scripts/cli-exit-taxonomy.test.mjs`.
BOX: `scripts/rapidtool-cli.mjs` · `scripts/README-cli.md` · `scripts/README-cli.test.mjs` · `scripts/rapidtool-cli-edit.test.mjs` · `src/lib/headless.ts` · `src/lib/headless.test.ts` · (new) `scripts/cli-exit-taxonomy.test.mjs`.
DONE-WHEN: headless 96/96 · E-25 filtered all-`ok` · edit-test 10/10 · README-cli 12/12 + parity.

**LANE C2 — THE PIPELINE HONESTY (engine/store/gates).**
CHARTER: W-19 `gate.blocked` row (`dod.ts:865-870`; teach M5) · W-20 served-model threading (`engine.ts:1982/:1992` + `llm-tasks.ts`) · W-24 io↔hydrate parity (ONE `scorecardUsable`, single research predicate, parity pins) · W-33 `decideTransition` consolidation · W-43 `Project.wildPolicy` + ONE consult at `wildApproveGate` (`engine.ts:~3668`) + register `wild.paused_policy` in `rt-events.ts` · land the `p6-behavior`/park-split dod shell C3 feeds.
BOX: `src/lib/engine.ts` · `src/lib/dod.ts` · `src/lib/store.ts` · `src/lib/io.ts` · `src/lib/packet.ts` · `src/lib/rt-events.ts` · `src/lib/types.ts`.
DONE-WHEN: engine/store/packet/rt-events suites + the §W27/§R spec pins per row.

**LANE C3 — THE OUTPUT FACTORY (emit/codegen/eval).**
CHARTER: verify/complete L1's 9 rows (per-kind `vite.config.ts`/`bin`/`main`/`exports`/`files`/PORT + structured stubs keeping `TODO(E-15) stub` + `RT_E_VALIDATION · ` · `uiGeneration` call point · run-eval `expectedBehavior`+`verification` · rule-2 reword · `redTree`/`partial` skip) · W-04 mint=behaviour · W-05/W-06 partial semantics · W-14 grader v2 + behavioral channel · W-15 4 kind fixtures · W-08 quarantine wiring.
BOX: `src/lib/scaffold.ts` · `src/lib/codegen.server.ts` · `src/lib/compile-check.server.ts` · `scripts/run-eval.mjs` · `research/eval-corpus/**`.
DONE-WHEN: run-eval 35/35 · codegen/scaffold/compile-check green · per-kind `doctor --tree` + keyless fixture runs.

**LANE C4 — THE UI SURFACING (console).**
CHARTER: the six surfaces per `fixes/272_s5_finish_ui.md` with FixturesPanel honesty (state visible · refusal named · disabled+reason in `title`) · RunScreen `PaneBoundary` wrap + `componentDidCatch` dedupe (`markBoundaryError`) · W-11 residuals · W-29 strings as cheap.
BOX: `src/components/console.tsx` · `src/routes/**`.
DONE-WHEN: grep-honesty on the labels; no invented error codes; console render probe.

**LANE C5 — THE RECORDS + DOCS SCRIBE.**
CHARTER: paste the owed §-appends VERBATIM from their logs above `finalsprint.md:244` — §S1(+CF-1 corr) · §S2 · §S3 · §S4(+CF-4 corr) · §S5 · §T1–§T5 · §WDX-2(+RS-01..04) · §WDX-3 · §MASTER-CORRECTIONS (each block attributed to its source log; "already live" where reflected) — then W-12/W-13 doc truth + W-37 record debts (`266_lane1..4_bugs`).
BOX: `finalsprint.md` · `fixes/**` · `README.md` · `AGENT_GUIDE.md` · `remainingwaves.md` · `taskuniverselog.md`.
DONE-WHEN: every owed section present above the marker; source paths attributed; marker intact; single-writer honored.

**PARENT — CLOSE:** hygiene sweep (root strays/`.t4scratch`; W-36 keep-list) → §P3.4 legs in order (typecheck → lint UNPIPED → legs → gate.sh) → §P3.6 commit → then the owner items (O-1/O-4 keyed runs, AGENTS.md consent act, R13-f04 host decision).

## §P2 — THE CODER CARDS (W34 lane P2 · read-only planner) — appended 2026-09-27 by W40 K8 (N4 → Z4 payout)

**Status:** OWED SINCE W34 — the lane burned its budget on byte-level recon across 12 items and **never wrote `fixes/278_p2_howto.md` nor appended §P2** ("Outcome: recon complete, deliverable NOT written — honest gap first"). This block is the lane's verified analysis verbatim from its delegation summary (`~/AppData/Local/hermes/cache/delegation/subagent-summary-1-20260926_194745_119606.txt`), re-landed as the owed record. **Critical caveat (verbatim):** "L2 landed WHILE I read — the item set moved" — the mtimes/state below were as of that read (2026-09-26 ~19:45 CDT); re-verify before coding.

### P2 · THE ITEM SET MOVED (bytes at lane read)

| File | mtime | State at my read |
|---|---|---|
| `src/lib/checkpoint.server.ts` | 19:28 | COMPLETE (203 ln) — full API, **zero consumers** |
| `src/lib/headless.ts` | **19:41** | L2 LANDED `checkpointDir?` opt at `:676`, `commitRunCheckpoint` `:640`, `clearRunCheckpoint` `:652` |
| `scripts/rapidtool-cli.mjs` | **18:12** | still **NO `resume` / `unattended` verb** (37 arms) |
| `src/lib/engine.ts` | 17:45 | **NO `readWildPlan`** (only types.ts prose) |
| `src/lib/store.ts` | 19:07 | wild reviewer LANDED `:29/:1122/:1126` |
| `scripts/README-cli.md` | 15:44 | not yet updated for a new arm |

`fixes/277_l2_integration.md` (19:33) is a plan-only board, all rows `_in progress_` — **do not trust it as landed**. His A1 verification matches bytes.

### P2 · BYTE-VERIFIED CODER CARDS (condensed — cause / files / done-when)

**C1 · checkpoint wiring (half-landed)**
- Cause: `headless.ts:663 runUntilGate` commits at `:691`, but only CLI `run`/`gate` (`rapidtool-cli.mjs:480-551`) has a real dir; the browser/store path never does. Nothing calls `commitRunCheckpoint`.
- Files: `scripts/rapidtool-cli.mjs:485` (`h.runUntilGate(project, { autopilot, live, maxSteps })`) → add `checkpointDir: dirname(requireProjectPath(args, cmd))`; `headless.ts:640/:652`. Also `wildStartRun`/`wildStartHeadless`.
- Done-when: `node --experimental-strip-types scripts/rapidtool-cli.mjs run --project tmp.json` → `.rapidtool/checkpoint.json` exists with `{version:1,run:{phase,mode},project:{...}}`; complete run clears it.
- Traps: `boundProjectForCheckpoint` **slices** `logs/decisions/memory/artifacts/research` → a resume that hydrates from the checkpoint silently LOSES older rows. `types.ts` `Project` must stay byte-compatible; browser path must remain a no-op.

**C2 · `resume` verb**
- Files: new `case "resume"` in `rapidtool-cli.mjs`; **four** doc-parity contracts in `scripts/README-cli.test.mjs`: headline `**N subcommands**` (`:99-105`), the verb list block, lines quoting `grep -c 'case "'` (`:158`, `:119`), and `USAGE.commands === case-arm set` (`:260-276`, `assert.equal(keys.length, realCount)`).
- Approach: `readCheckpoint` → `checkpointAdmits(cp, {projectId, mode})` → `RT_E_CHECKPOINT_MISSING` / `RT_E_VALIDATION`; re-entry = `runUntilGate(hydrateFromCheckpoint(cp))`. Phase range 1..13 belongs to the caller (the module is deliberately table-free, `checkpoint.server.ts:184-187`).
- Done-when: `resume --project <no-cp>` exit 1 + code; `--list` read-only; `node --test scripts/README-cli.test.mjs` green.

**C3 · `run --unattended`**
- Cause: `scripts/unattended-shell.mjs` **does not exist**; no `unattended` verb in the 37 arms.
- Approach: `--unattended` flag on the real `run` arm (U2's verb was already upgraded to "real drive; host scheduler named in help"), refuse `RT_E_UNATTENDED_UNSUPPORTED` naming W-01/W-02; **do not recreate** the never-built `unattended-shell.mjs`.
- Traps: exit class must be **2** (blocked), `errors.ts:80`/`:514` carries the code; real unattended needs a non-TTY-safe gate path — the non-TTY approve guard at `rapidtool-cli.mjs:579-589` is load-bearing.

**C4 · `readWildPlan` + plan gen**
- Cause: `WildPlan`/`WildPlanStep`/`Project.wildPlan` exist (`types.ts:172-183/:433`), `readWildPlan` does not; `planning.ts` IS callable (`planSteps` `:326`, `MAX_PLAN_STEPS=8`).
- Files: `engine.ts` (near `wildStep`), `headless.ts:33` (already imports it — **build is currently broken**), `store.ts` read path.
- Done-when: keyless → `{steps:[], source:"empty", note:"…R13-f02"}` byte-identical; keyed → `source:"planner"`.

**C5 · the E-25 red + the TWO hidden reds (the "nested subtest")**
- `src/lib/headless.test.ts:606` **"W-02 keyless floor: runP6Edge without deps is the deterministic floor (no mint, no journey rows)"** is the nested subtest. Capture `/tmp/wdx3_headless2.log:265` proves the only diff is volatile bytes: `compiled_at` in packet text **and** embedded JSON, `phases[].startedAt/completedAt`, `traces[].ranAt`. The strip at `:633-655` misses `compiled_at` inside the **packet artifact bodies**.
- **The 96/94/2 = 96 tests / 94 pass / 2 fail tally the top-level only.** There are **FOUR** reds, three of them nested: (1) `headless.test.ts:606`; (2) `headless.test.ts:1608` "CLI: --i-am-human WITH the out-of-band token records the human seat (exit 0)" → **1 !== 0**; (3) `headless.test.ts:1741` "CLI — an approve landed by the CLI carries the provenance on the row it mints" → **1 !== 0**; (4) `describe "E-25 — CLI machine contract"` (`:1220`).
- **ROOT CAUSE (2)+(3) = the same one bug — the biggest find.** `scripts/rapidtool-cli.mjs:3408 humanSeatClaim` (W29 R5-f12 two-channel) does `if (process.stdin.isTTY !== true) return { error }`. Spawned CLI children have **no TTY** → the human seat is **unreachable from any subprocess**. HEAD's tests pass `RT_HUMAN_SEAT_TOKEN` in the child env and expect exit 0. Confirmed: `scripts/rapidtool-cli-edit.test.mjs:401-427` still pins the OLD allow contract.
- **The owner is owed a Track-1 vs Track-2 ruling** (§R5-f12 track 2 = "keep + strike the README claim"). Either flip those pins to expect exit 1 `/human-seat-unverified/` (honest, fail-closed) **or** exempt the scripts leg — but `cliJson` (`rapidtool-cli-edit.test.mjs:78`) asserts `envelope.exit_code === process.exit code`, so a fake-TTY can't be faked inside a child.
- Two stale comments to fix regardless: `rapidtool-cli.mjs:602` and `:1567` claim the statically forbidden same-env degenerate guard lives in `scripts/cli-exit-taxonomy.test.mjs` — **that file does not exist**.

**C6 · the 4 kind emitters**
- Bytes: `PKG_SCRIPTS:552-579` (game declares `build:"vite build"` at `:560-566` with **no config**); `packageJson:581-605` has no `bin`/`main`/`exports`/`files`; boot files pushed only for webapp|game at `:2573-2578` with `if (kind === "webapp") push("vite.config.ts", …)` at `:2576` (function `emitViteConfig:1817` — game may reuse it, drop the react plugin); throwing entries at `emitUi:936-962` (`service`/`cli-tool` flavors).
- Contracts: `scaffold.test.ts:338` sweeps **every** file mentioning `E-15` for the canonical `TODO(E-15) stub` form (paren closes after 15); `emitted-honesty.test.ts:42` requires `RT_E_VALIDATION · ` on every stub throw; `doctor.ts:90` classifies anything containing `TODO(E-15)` as a **stub** — so the structured stub must KEEP the marker or the census flips.
- Traps: `PKG_SCRIPTS` is `Partial<Record<…>>` — adding `start` to `service` changes the emitted `package.json` bytes; `scaffold.test.ts:221-232` pins an exact 10-file path list for intake-only webapp, so any unconditional new push breaks it.

**C7 · graders + `verification` label**
- Bytes: `run-eval.mjs:318 parseGrader` / `:370 loadGrader` / `:561 checkAcceptance` → returns exactly `checked:{expectedFiles,expectedContent}` (`:593`), pinned by `run-eval.test.mjs:381` `assert.deepEqual(res.checked, {expectedFiles:3, expectedContent:1})`. `verification` grep = **0 hits**.
- Approach: `expectedBehavior` + `verification` ride as **ADDITIVE envelope/row keys** (`entryRow` `:2002` already seeds `acceptance:{...acceptance, pass:false}` at `:2042`) — never inside `checked`. `passesAcceptance:2083` is the four-clause predicate; keep it adjacent to `acceptanceFailReason`.
- Done-when: `node --test scripts/run-eval.test.mjs` green incl. the pinned deepEqual.

**C8 · UI panes**
- Bytes: `RUN_TABS` `console.tsx:161-177` (11 entries, primary/advanced tiers); `Tabs.Content` blocks `:3261-3474`; Wild Mode block `:765-772` explicitly claims "no local-only fallback, **no 'not wired' labels remain**" while `setWildMode/startWildRun/toggleWildPause` are called statically at `:963/:970/:1248/:1263/:1276`; `:3508` renders "Empty until Phase 0 writes a checkpoint" for `project.memory` — **a write-time checkpoint, unrelated to `runCheckpoint`; the trap is a coder "surfacing the checkpoint" by editing that string.**
- Honesty pattern to copy: `:3915-3932` — `disabled={… || allowListRefusal !== null}` + `title={\`Approve disabled — ${code} refuses…\`}` and the `:3954` fallback label ladder.
- Console is **browser-only**: it cannot read a checkpoint file → read-only line must come from a store/server-fn read path, or be a disabled-with-reason label.

**C9 · the records-paste mechanics**
- `finalsprint.md` is uncommitted (untracked at lane time) and read_file flagged it binary → use terminal `sed`. Marker = `<!-- END-OF-FILE-MARKER-SPRINT … -->` **last line**; §S1–§S4 placeholders at `:34/:37/:40/:43`.
- 8 owed appends, each VERBATIM in its lane log: §S1 (but **its board is false**: 3/4 items absent), §S2, §S3, §S4, §T1–§T5, §WDX-2 (incl. **RS-01…RS-04**), §WDX-3. Plus a `§MASTER-CORRECTIONS` block (append-only; never edit the table in place).
- Traps: `prep.md` append marker is `<!-- END-OF-FILE-MARKER-PREP … -->` last line; re-read before every append; §P1 (`fixes/278_p1_remainders.md`, 19:32) is **also plan-only** — no true-state table yet.

### P2 · PROCESS NOTES (verbatim)

- **`grep -c 'case "'` will move 37→39** the moment C2+C3 land → §T/README headline must be re-derived, not copied (W-31 class of drift).
- `scripts/README-cli.test.mjs` already carries `countClaimOffenders` (`:80-81`, `:171-180`) — R5-f13's widening has landed.
- The no-tty quirk is not just a *test-leg* hazard (foreground legs) — it is the **root cause of two of the four reds** and blocks all headless human-seat approvals.
- 8GB box: `docs-module-parity.mjs` (T5's V29) + full `arm -parity` scans are fine; avoid `npm test` (both legs) mid-wave — the src leg alone took 137s in the WDX-3 capture.
<!-- END-OF-FILE-MARKER-PREP · every planner appends ABOVE this line · never edit or delete this line -->
