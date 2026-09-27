# fixes/273_t1_register_rows.md — W31 · T1 · THE REGISTER'S UNTOUCHED ROWS

**Lane:** T1 (`wave_plans/W31/gap-finshers.md` §T1). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`.
**HEAD at open:** `0f85c32` + W29/W29b/W30/E1b uncommitted edits (siblings S1–S5 + E1b live; every row below re-verified against bytes at open time ~18:00–18:20 CDT, not against logs).
**Job:** sweep §W27-B/C/D (`research/multiagent/thoroughanalysis.md:1144-1306`) for rows with NO lane reference; verify each in the code; land the safe ones (smallest honest patch); deliver the per-row verdict table (§T1 into `finalsprint.md`).
**Rules honoured:** targeted checks only · NO full gates · NO keyed calls · log-and-continue ([EXT-FAIL]) · no removals · no fake wiring · never edit a file visibly mid-edit by another lane.

## Sweep method

1. Read §W27-B/C/D in full + §W27-WORKLIST ADDITIONS (WD-δ, lines 1388-1420) + `finalsprint.md` master table + the S1/S5 lane logs + W29 lane logs (`fixes/271_lane*`).
2. For every B/C/D row: mapped its fix spec → grepped the CURRENT bytes → verdict: LANDED-BY-ME / ALREADY-DONE (with byte proof) / FOR-LANE-X (named lane + why) / OWNER / BLOCKED.
3. "Already done" claims verified by bytes (grep/sed), not by logs.

## Verdict table (draft as of lane open — refined in §Landings + §T1)

| Row | § | Verdict at open | Byte evidence / reason |
|---|---|---|---|
| W-04 | B | FOR-LANE (E1/S2) | `codegen.server.ts` mint: `treeRunTestedEvidence` still `specs>0 && assertions>0` (~:3416-3431); `scaffold.ts:1596-1615` tree-job row still swallows non-ReferenceError throws (`catch (e) { if (e instanceof ReferenceError) throw e; }`) — W-04(a)/(b) intact. Both files actively edited (E1b). |
| W-05 | B | FOR-LANE-S2 | `partialTreeRefuse` lastTest-null = R3-f03 fold; S2's brief covers "partial-synthesis semantics". codegen.server.ts hot (17:42). |
| W-06 | B | FOR-LANE-S2 | partial-synthesis cascade semantics; S2 brief. |
| W-07 | B | FOR-LANE-S2 | prompt-vs-tsconfig reword; S2 brief. |
| W-08 | B | FOR-LANE-S4 | master table: R11-f08 `--force` quarantine → S4. Headless.ts hot. |
| W-09 | B | **ALREADY-DONE** | `gate.sh:193-198` exit condition now includes `gates.testsScripts.ok && gates.testsLib.ok` + synthetic no-TAP hardFails (:164-184); `scripts/gate-verdict.test.mjs` shipped (W29-H). Verified by running the fixture (see landings). |
| W-10 | B | FOR-LANE-S4 | seat surface → S4 (master table). |
| W-11 | B | **ALREADY-DONE** | 4 surfaces: grep `autonomous software agency` → only rule-comments left; `og/site.json` = `"governed delivery harness"`; console/routes carry the R6-f02 rule comments. |
| W-12 | B | ALREADY-DONE (verify) | README:116-118 now quotes the measured `{stubs:0, reexports:4, real:1}` census. |
| W-13 | B | PARTIAL → FOR-LANE (docs) | AGENT_GUIDE/README-cli items still owned by docs lanes; re-check at T1 close. |
| W-14 | B | FOR-LANE-S2 | graders v2 → S2 (master table). |
| W-15 | B | FOR-LANE-S2 | 4 kinds → S2. |
| W-16 | B | **LANDED-BY-ME** | (a) `handoff.ts:95` `text(project.brief)`; (b) `vault.ts:442` junk-row skip in `backlinksFor`. Pins added. |
| W-17 | B | **ALREADY-DONE** | `openai-compatible.ts:499-504`: `noBalance = 402 || /insufficient balance/i` → `RT_E_LLM_NO_BALANCE` (W29-P). Verified by targeted test run. |
| W-18 | B | FOR-LANE (open; needs console.tsx quiet) | `store.ts:1164` `create` still `emptyProject({brief,name})`; no `llmStatus.configured` threaded → browser create stays `enforceDod:false`. Exact 2-file fix recorded in §T1. |
| W-19 | B | FOR-LANE (engine.ts hot) | `dod.ts:865-868` `recordGateInto` still complete-only; no `gate.blocked` row anywhere (grep). engine.ts 17:45 mid-edit (E1b). |
| W-20 | B | FOR-LANE (engine.ts hot) | `engine.ts:2958-2968` still hardcodes `deepseek-flash` on `llmRan`; `llm-tasks.ts:127/157/188` still request `deepseek-v4-pro`. Served-model threading not landed. |
| W-21 | C | FOR-LANE-S3 | ledger → S3 (master table). |
| W-22 | C | **ALREADY-DONE** | `console.tsx:1906-1908` union has `"module"`; `setBusyAction("module")` :2234 + finally :2253. |
| W-23 | B | PARTIAL → **b LANDED-BY-ME**; a-engine-half FOR-LANE | packet half (`isoFromMs` clamp, packet.ts:189-231) landed W29-S. **b: `keepLiveWildRun` NOT in store.ts** → I land the helper + 6 sites. a-engine-half: `engine.ts:2021-2037 wellFormedDecisionRow` still typeof-only → 1-line, engine.ts hot. |
| W-24 | B | FOR-LANE (engine.ts hot) | hydrate still keeps crew/oracle/chatLog rows raw (`engine.ts:2238/2405-2406`); research item filter partially aligned but import/reload parity not. |
| W-25 | C | OPEN sub-items → FOR-LANE (engine/store) | (a) bare `catch {}` at engine.ts:2790-2792 intact; (e) packet `str()/rows()` helpers absent. Engine.ts hot. |
| W-26 | C | FOR-LANE (node-runner; open) | `node-runner.server.ts:306-315` — maxBuffer passed via cast, not a real SpawnOption; comment admits; no streaming kill. |
| W-27 | C | PARTIAL → FOR-LANE (harness) | no `cli-exit-taxonomy.test.mjs` yet; several (a)-(i) items open. rapidtool-cli.mjs hot (17:56). |
| W-28 | C | (a) FOR-LANE (E1/B); (b) FOR-LANE-S2 | scaffold.ts hot; emitted-UI seam = S2 per master table. |
| W-29 | C | PARTIAL → ALREADY-DONE(a) + FOR-LANE-S5 (rest) | fixtures label rewritten on ALL THREE paths (fixtures.ts:20, fixtures.server.ts:26, fixtures.review.ts:36); "sandbox" sites + HomeScreen items still open. |
| W-30 | C | **ALREADY-DONE** | `applyTheme` (:1471-1480) now syncs `meta[name="theme-color"]` in-session (W30 marker present). |
| W-31 | D | **LANDED-BY-ME** | `README-cli.test.mjs` widened: `countClaimOffenders` helper + every-line scan + ALL `**N subcommands**` + in-file fixtures. |
| W-32 | D | OWNER | descope-vs-keep decision = O-3; "no removals" rule during the wave. |
| W-33 | C | OPEN → FOR-LANE | no `decideTransition`/`stopReasonFor` in store.ts; 4 site families + 2 twins still duplicated. |
| W-34 | D | PARTIAL → **subsets LANDED-BY-ME** (backlinksFor/handoff/token-ledger pins); rest FOR-LANE | vault.backlinksFor now tested (was "its file's only untested export"). |
| W-35 | D | **LANDED-BY-ME** | `totalTokens` null/junk guard (`token-ledger.ts:113-118`). |
| W-36 | D | OWNER (O-2a) | probe keep/delete is an owner ratification; "no removals" forbids deleting during the wave. |
| W-37 | D | OWNER/parent | recording debts (scribe pass) — not code. |
| W-38 | B | OPEN → FOR-LANE (UI) | `runP6Journey` still definition-only (store.ts:130/:923; zero call sites). console.tsx hot. |
| W-39 | C | (a) OPEN → check; (b,c,d) FOR-LANE (provider) | rt-client finite-guard grep → 0 (re-verify); rt-ring hydrate caps; import-boundary headers. |
| W-40 | B | ALREADY-DONE (shell by S1) | checkpoint.server.ts + resume verb + `TODO(T-107.7)` per fixes/272_s1_autonomy.md; spot-verify bytes at close. |
| W-41 | B | FOR-LANE-S3 | streaming → S3. |
| W-42 | B | FOR-LANE-S3 | cassette → S3. |
| W-43 | B | FOR-LANE-S3 | F4 allow-lists → S3. |
| W-44 | C | FOR-LANE-S3 | MCP → S3. |
| W-45 | C | FOR-LANE-S3 | F2 → S3. |
| W-46 | C | **BLOCKED (ON W-02 + O-1)** | acceptance chain — register says so; no keyed calls allowed. |
| W-48 | B | ALREADY-DONE (shell by S1) | R13-f02 wildPlan + engine read-point per fixes/272_s1_autonomy.md; spot-verify at close. |
| W-49 | B | FOR-LANE-S4 | isolation refusal = S4 BLOCKED-SHELL. |
| W-50 | B | FOR-LANE-T3 | R13-f05/f13 → T3 owns "R13's remaining rows f05→f15". |
| W-51 | D | FOR-LANE-T3 | R13-f10. |
| W-52 | D | FOR-LANE-T3 | R13-f12. |
| W-53 | D | FOR-LANE-T3 | R13-f14. |
| W-54 | D | DEFER (recorded, no action) | register explicitly defers. |

## Landings (append as they complete)

_(in progress — see below)_

## [EXT-FAIL] / deviations log

_(filled during the run)_
