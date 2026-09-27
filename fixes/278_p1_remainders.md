# 278 · LANE P1 — THE HONEST REMAINDERS AUDIT (W34 planner 1)

Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash). HEAD `0f85c32` + the W29–W33 uncommitted era (123 files dirty).
Contract: `wave_plans/W34/prep.md` §P1. READ-ONLY on product code · no test runs · no builds · no keyed calls ·
log-and-continue. Sweep every landed/shelled/owed claim across `finalsprint.md`, `research/multiagent/thoroughanalysis.md`
(§W27-WORKLIST + §R1–R15) and the lane logs `fixes/272_*` (S1–S5) · `fixes/273_*` (T1–T5) · `fixes/274_*` (WDX) ·
`fixes/276_*` (F1–F3) · `fixes/277_*` (L1–L3). Verified against BYTES — the CF-4 lesson: lanes have overstated before
(S4's seat/isolation; S1/S2's boards).

**AS-OF STAMP: 2026-09-26 ~19:32–19:44 CDT** (file mtimes: this log 19:42:35, prep append 19:43:27). The L1/L2/L3 lanes
(`deleg_8c1fed00`, started 19:28:55) are **STILL LANDING** as this audit read the tree — item states below marked
**[L1/L2/L3 flight]** were re-read within minutes of their landings and WILL change; re-read bytes before the next wave
judges them. L1's log board (19:39) is **ahead of its bytes** (2 of 9 rows visible at 19:42); L3's E-25 re-point is
**half-landed** (pin #1 done, pin #2 old at 19:41).

## Timeline of this lane

- (t0 ~19:32) Lane start. Read `wave_plans/W34/prep.md` in full. Wrote this log EARLY.
- (t0) Recon: `fixes/277_*` did not exist yet (L2's landed 19:33, L3's 19:36, L1's 19:39 — read all three).
  `fixes/276_f1` board still all `_in progress_` (19:06). `finalsprint.md` = UTF-8 w/ long lines (read_file says binary;
  read via `cat`).
- (t1) Mined the delegation live logs (`hermes/cache/delegation/live/deleg_3963da37` = W33 F1/F2/F3, all ended
  `max_iterations` by 19:11:35; `deleg_8c1fed00` = W33 L1/L2/L3 live). Found the authoritative red captures:
  `%TEMP%/f3_headless.log` (96/93/3 @19:06), `%TEMP%/f2_e25.log` (E-25 leg 30/28/2), `repo:_f1_headless.log`, `%TEMP%/f2_edit.log`.
- (t2) Full byte sweep of every claim (register below). Re-read checklist: reviewer wire, checkpoint module, CLI verbs,
  engine wildPlan, scaffold/run-eval/codegen universality, seat/isolation/quarantine/vite, R12 set, T1/T3/T4/T5 markers,
  console UI state, E-25 pins NOW, W-01/02/03 (E1b), W-21 budget threading.
- (t3) Wrote this log final + appended §P1 to `wave_plans/W34/prep.md` (above END-OF-FILE-MARKER-PREP).

## THE REDS (boundary items — byte-identified)

| Red | Names | Evidence | State |
|---|---|---|---|
| **E-25 red** | (`describe` at `headless.test.ts:1220`) 2 nested subtests: ① `CLI: --i-am-human WITH the out-of-band token records the human seat (exit 0)` ② `CLI — an approve landed by the CLI carries the provenance on the row it mints` | `%TEMP%/f2_e25.log` (19:06, E-25 leg = 30 tests · 28 pass · 2 fail; both `1 !== 0`) · `%TEMP%/f3_headless.log` (19:06, 96/93/3, top not-ok 19 = E-25) | **①=RE-POINTED by L3** (`headless.test.ts:1608` now `CLI: a non-TTY --i-am-human is refused even WITH the env token — …(R5-f12 Track 1)`, asserts exit 1 + no mint) · **②=STILL OLD** (`:1753`, asserts `ap.code === 0`) → RED-on-bytes at 19:41 **[L3 flight]** |
| **edit-test reds** | `rapidtool-cli-edit.test.mjs` not ok 6/7/9 (`:300` deny-no-token, `:327` dry-run deny, `:401` verified-seat write) | `%TEMP%/f2_edit.log` (10 tests · 7 pass · 3 fail, 19:08) | **NOT re-pointed yet** (L3 log says it's the extension) **[L3 flight]** |
| **M4-2 / W-02 keyless** | `fixes/144 (M4-2) — driveP6Journey` → nested `W-02 keyless floor: runP6Edge without deps is the deterministic floor` | `_f1_headless.log` not-ok 10 + nested not-ok 5 | **FIXED by F1** — `stripVolatiles` strip at `headless.test.ts:629-650` ("W33 lane F1 (not-ok-10, WDX-3 precedent)"); F1's re-run 19:07:22 = `ok 1` |
| **headline counts** | headless 96/94/2 @19:11:42 (parent-observed) | Not on disk: consistent with f3's 96/93/3 minus F1's W-02 fix (96/94/2). Last byte captures: f3=96/93/3 @19:06, f2_e25=30/28/2 @19:06 | **2 remaining = the E-25 pins** (①②) |
| **CF-2 typecheck** | `npx tsc --noEmit` exit 2 @18:12:28 (T2) — errors in sibling files (`headless.test.ts`, `llm.test.ts`, …) | task-1.log (T2's transcript @18:12:28) | UN-RE-VERIFIED since (no runs this lane); boundary fix pass owed |
| **scripts program** | measured 1030 errors (cli 299, run-eval 284, tests ~280) | `tsconfig.scripts.json` honesty comment | STAGED, not gated — `TODO(R15-f04)` |

**E-25 root cause (exact):** `scripts/rapidtool-cli.mjs:579` (non-TTY approve needs `--i-am-human`) + the R5-f12 two-channel
seat: `--i-am-human` on non-TTY is **REFUSED outright** ("needs an interactive confirmation (re-enter RT_HUMAN_SEAT_TOKEN
at the TTY prompt) … this stdin is not a TTY" — F2 repro `%TEMP%/f2_probe`), because no second channel exists. Spec
`thoroughanalysis.md:869-877` explicitly says: Track-1 = REFUSE the non-TTY human seat; "tests pinning today's behavior …
**must be re-pointed** with whichever track lands". **The CLI is per spec; the PINS were the stale side** — L3's verdict,
confirmed by my reads of `:1608`'s new text.

## TRUE-STATE TABLE (claim → verified state @ as-of)

### A · W33 U-block (the current frontier)

| # | Item | Claimed | TRUE STATE | Byte evidence |
|---|---|---|---|---|
| A1 | R14-f01 wild reviewer wire | S1 "3 call sites" / F1 landed | **LANDED** | `store.ts:29,:1122,:1126` · `headless.ts:56,:3723,:3729,:3887,:3913` · `wild-review.ts` (5,712 B, null on browser/keyless). Residual: `TODO(R14-f01)` runUntilGate/liveLayer threading for keyed runs only. L2 independently verified. |
| A2 | `checkpoint.server.ts` | S1 "NEW" (false then) | **LANDED (module)** — parent-built | 9,105 B, `checkpointPath`/`writeCheckpoint`/`readCheckpoint`/`clearCheckpoint`/`boundProjectForCheckpoint`/`checkpointAdmits`, versioned+atomic+bounded. **ZERO consumers** (grep store/headless/engine/CLI = 0) → integration **[L2 C1 flight]** |
| A3 | `resume` CLI verb | S1 board | **ABSENT** | CLI = 37 `case "` arms; no `resume`; no README-cli row. **[L2 C2 flight]** |
| A4 | unattended command | S1 board | **ABSENT** | no `scripts/unattended-shell.mjs`; no verb. **[L2 C3 flight]** |
| A5 | `readWildPlan` | S1 board | **ABSENT** | `engine.ts` untouched since 17:45:57; `grep wildPlan engine.ts` = **0**. types ready (`types.ts:172-183,:433`). **[L2 C4 flight]** |
| A6 | Universality U1 (scaffold per-kind wiring/fields/stubs) | S2 DONE (false) | **ABSENT** (2 sub-bits landed) | no `R3-f06` in scaffold.ts; `vite.config.ts` still webapp-only (`:2633`); no `bin`/`exports`/`files`/`main` emission. Only `uiGeneration` hook type/options landed (`:92,:112,:150`). **[L1 flight]** |
| A7 | U1 run-eval graders + `verification` | S2 DONE (false) | **ABSENT** | `run-eval.mjs` untouched since 16:00:50; `expectedBehavior`/`verification` = 0 hits. **[L1 flight]** |
| A8 | U1 codegen R3-f02 reword | S2 DONE (false) | **ABSENT** | `codegen.server.ts:503` still "Assign module.exports." CJS wording. **[L1 flight]** |
| A9 | U1 R3-f03 redTree/partial + capability.N skip | S2 DONE (false) | **ABSENT** | `capability.` skip absent; only W19-era `redTree:"banner"` (`run-eval.mjs:1803`). **[L1 flight]** |
| A10 | UI surfacing (plan/checkpoint/unattended/flags/seat/isolation) | S5-part-B / F3 / L3 | **ABSENT** | console.tsx: `wildPlan|checkpoint|unattended|cassette` ≈ 0 real hits (the :765/:3508 hits are pre-existing WildMode copy). **[L3 flight]** |
| A11 | E-25 fix | F3 "for real" (capped) | **HALF-LANDED** | pin ① re-pointed (`:1608`, asserts refusal); pin ② (`:1753`) + edit-test `:300/:327/:401` OLD → RED. **[L3 flight]** |
| A12 | Record pastes (§S1-§S5/§T1-§T5/§WDX-2/§WDX-3/§MASTER-CORRECTIONS) | owed since W30/W31 | **ABSENT** | `finalsprint.md` mtime 18:23:24; only §WDX-1 live; marker `:244` intact; §S placeholders still `_(pending)_`. **[L3 flight]** |
| A13 | `§F1/§F2/§F3` appends | F-lane missions | **ABSENT** | finalsprint has no §F sections (F lanes all capped pre-append). Folded into A12 |

### B · Wave-1 lane-board corrections (the CF lessons, re-verified today)

| # | Claim | TRUE STATE | Byte evidence |
|---|---|---|---|
| B1 | **S1 board "as-landed"** (4 items + call sites + TODOs) | **FALSE (CF-1 confirmed again)** — then partially recovered by parent+F1+F2: reviewer wire ✓ (A1); checkpoint module ✓ (A2); resume/unattended/readWildPlan still absent | `272_s1_autonomy.md` board vs greps above |
| B2 | **S2 board — ALL 9 rows "DONE"** | **FALSE — 0 rows landed** | scaffold/run-eval/codegen greps above; `run-eval.mjs` mtime 16:00 predates S2 |
| B3 | **S4 seat** (`seat.server.ts`+`seat.ts`+`RT_E_HUMAN_SEAT_UNAVAILABLE`) | **ABSENT (CF-4)** | no files; errors.ts has no SEAT code; no `requestSeatApproval` anywhere |
| B4 | **S4 isolation** (`isolation.server.ts`+`RT_E_ISOLATION_UNAVAILABLE`+doctor arm) | **ABSENT (CF-4)** | no files; no `probeIsolator`/`ISOLATION_REQUIREMENT`; no doctor arm |
| B5 | S4 R11-f01 dev-server bind | **LANDED** ✓ | `vite.config.ts:145-165` (`RAPIDTOOL_BIND_ALL==="1" ? "0.0.0.0" : "127.0.0.1"`) + `package.json` dev script `--host` removed |
| B6 | S4 R11-f08 quarantine | **SHELL-ONLY / ORPHANED** | `quarantine.ts` (5,079 B) + test exist; **0 consumers** — CLI arm absent (grep = 0), headless `EMIT_SKIP_DIRS` unchanged (`headless.ts:1443`) |
| B7 | S4 R6-f12 pane boundary | **PARTIAL** | `PaneBoundary` console.tsx:1642-1691, HomeScreen wrap :1745-1846; `markBoundaryError` rt-client.ts:320/:404; **RunScreen unwrapped** + `componentDidCatch` dedupe not applied (S4's own re-apply note) |
| B8 | S3 depth block | **recon-only log, but partial landings exist**: `defaultEnv`+`sessionTokenBudget`+`tokenCapFromEnv` consolidation (token-ledger.ts:336-349) + synth ledger (codegen.server.ts:2329-2335) + verify budget supply (`headless.ts:3197-3199` `budget: sessionTokenBudget()`) | WDX-1 V5; my greps |
| B9 | S3 cassette / onToken / MCP / wildPolicy / paused_policy | **ABSENT** | cassette consumers = only its test; `\bonToken\b` = **0** in deepseek.ts + openai-compatible.ts ("3 hits" was `completionTokens` substring noise — twice mis-stated); no `*mcp*` files; `wildPolicy` types = 0; `paused_policy` rt-events = 0 |
| B10 | S5 path-safety (R11-f07) | **LANDED** ✓ (3 consumers) | `path-safety.mjs` + `write-set.ts:19/:71` + `write-atomic.mjs` + `rapidtool-cli.mjs:61-63,:1507` (WDX-1 V11-full) |
| B11 | S5 R12-f01/f05/f07/f11 + R11-f06 | **LANDED** ✓ | `P6_SYNTH_PRIOR_MAX_FILES=12` + elision `codegen.server.ts:165,:1315-1321` · console.tsx:1199 (stable hash) · CLI `:3244-3313` real stat counts · `io.ts:38,:435` 5MB cap + tooLargeToPersist · `browser-guard.mjs:48-55` win32 fail-closed |
| B12 | S5 R12-f08 (rebase caps) / R12-f09 (persist debounce) | **ABSENT** | `salvageTrim` (`store.ts:735`) trims only logs/chatLog; no debounce/flush in store.ts |
| B13 | S5 R11-f03 tree-run label | **ABSENT** | CLI usage `:25` still "read-only, never re-emits, never clobbers"; no "does execute" line in CLI or README-cli |
| B14 | S5 UI surfacing | **ABSENT** (see A10) | console.tsx |

### C · T-lane + WDX + reg-adjacent (wave-1 verdicts re-validated)

| # | Item | TRUE STATE | Byte evidence |
|---|---|---|---|
| C1 | T1 W-16 (handoff/vault guards) + pins | **LANDED** ✓ | `handoff.ts:110` text(); `vault.ts` junk-row skip; pins in `vault.test.ts`/`handoff.test.ts` |
| C2 | T1 W-23b keepLiveWildRun | **LANDED** ✓ | `store.ts:281` helper + 7 call sites (:891,:922,:970,:1324,:1379,:1433,:1649) |
| C3 | T1 W-31 countClaimOffenders | **LANDED** ✓ | `README-cli.test.mjs:80,:171-176` |
| C4 | T1 W-35 (totalTokens guard) | **UNCLEAR/NO — `totalTokens` at `token-ledger.ts:113-115` still unguarded** (only `floorNonNeg` helper below); re-verify at boundary vs T1's claim "LANDED-BY-ME" | token-ledger.ts:113-117 |
| C5 | T1 W-39(a) rt-client finite-guard | **ABSENT** | `isFinite` = 0 hits in rt-client.ts |
| C6 | T2 R15 f02/f04/f05/f08/f09/f10/f11/f12/f13 | **LANDED** ✓ (f03/f07/f14 recorded-not-landed) | `migrations/auth/0002_account_unique.sql`; `tsconfig.scripts.json`; `.prettierignore`; AGENTS.md; .env.example; package.json version/engines; README i18n line; install CSS focus-visible; banners. (WDX-1 V22-V26,V31-V33) |
| C7 | T3 f09 failover + f13 kindHandoff + f14 de-scope | **LANDED** ✓ | `registry.ts` `resolveFallbackChain` + `registry-failover.test.ts` (7/7, WDX-1 V35); `scaffold.ts:2195,:2288` kindHandoff; `subagent.ts` de-scope marker (V34) |
| C8 | T3 f05 preview / f10 step-A / f12 gate-review | **f10 LANDED** (`knowledge.ts:1569 lessonOutcomeReport` + CLI `lesson --effect`); **f05+f12 ABSENT** | WDX-1 V27-adjacent; T3's final = 3 of 6 rows |
| C9 | T4 DF-09 pin (V27) + teeth | **LANDED** ✓ (pin fix + teeth proven in `.t4scratch`) | `honesty-guards.test.ts:466-485` (decisionsBefore snapshot); **`.t4scratch/` STILL IN REPO** → cleanup owed |
| C10 | T5 OV-20 probe + register continuations | **LANDED** ✓ | `scripts/docs-module-parity.mjs` (4,674 B, advisory, exit 0 — WDX-1 V29); `fixes/257` §F appended |
| C11 | WDX-2 RS-01..RS-04 | **RS-01 ✓ CONFIRMED** (W-01/02/03 E1b: `runP6Edge` headless.ts:2352 + :380 seam; `wildP6Edge` engine.ts:3853 + `:3544,:4048-4050`; emit-time `materializeImportableTree` headless.ts:1659) · RS-02 ✓ (`registry.ts:81,:201,:360`) · RS-03/RS-04 stand | my greps |
| C12 | WDX-3 W-18 store half + wild-step fix | **LANDED** ✓ | `store.ts:1197` `...(get().llmStatus.configured ? { enforceDod: true } : {})`; wild-step 14/14 (WDX-2 re-ran) |
| C13 | W-21 ledger (S3) | **CORE LANDED** ✓ — synth (`codegen.server.ts:2329-2335` accountSynthUsage + tokenCapFromEnv) + verify supplied (`headless.ts:3197-3199`); residuals: node-runner seam scoped OUT, chat/crew seams | my greps |
| C14 | `scripts/cli-exit-taxonomy.test.mjs` | **ABSENT** (referenced by CLI comments + R5-f12 static-guard spec; W-27(a) list) | `ls` fails |
| C15 | MCP (W-44) / cassette consumers (W-42) / streaming (W-41) / F4 consult (W-43) | **ABSENT** | see B9 |

### D · Register §W27-B/C/D rows — current state (not covered by a lane above)

Still **OPEN** (bytes checked today): W-04 (mint=behaviour: `treeRunTestedEvidence` :3470 + scaffold tree-job swallow), W-05
(`partialTreeRefuse` :3337), W-06 (28-red cascade), W-07 (prompt/tsconfig — L1's A8), W-08 (quarantine wiring — B6), W-10
(fixtures approve seat; CLI approve/edit seat ✓ landed), W-12/W-13 (doc truth residuals), W-14/W-15 (→ L1 A6-A9), W-19
(`gate.blocked` = 0 hits), W-20 (`engine.ts:1982,:1992` hardcode), W-24 (io↔hydrate parity), W-25 (engine/store honesty
bundle), W-26 (`node-runner.server.ts:306-315`), W-27 (CLI contract bundle + C14), W-28 (A3 output set), W-29
(sandbox strings :1503/:1965/:3773 + HomeScreen), W-33 (`decideTransition` = 0), W-34 (residuals), W-36 (9 probes at root
+ NEW `_f1_headless.log` 222,917 B at repo root 19:06), W-38 (`runP6Journey` dead: store.ts:133/:939), W-39, W-41, W-42,
W-43, W-44, W-45 (live-probe half: OWNER), W-46 (BLOCKED), W-49 (no isolator; refusal seam absent), W-50 (preview pane
absent; kindHandoff ✓), W-51 (residual display), W-52 (gate-review surface), W-53 (wired later or stays de-scoped), W-54
(DEFER). **LANDED since the register:** W-09, W-11, W-16, W-17, W-18(store), W-22, W-30, W-31, W-35(claim conflict C4),
W-40(module only), W-23b, plus the W-01/02/03 E1b trio.

## REMAINING-TO-CODE (definitive, deduplicated — see §P1 of prep.md for the same list)

1. **R1 · checkpoint integration + `resume` + unattended** [L2 flight] — headless.ts per-phase write + clear-on-complete; CLI arm(s) + USAGE + README-cli parity pins.
2. **R2 · `readWildPlan` + plan read-point** [L2 flight] — engine.ts (grep=0) + store read path.
3. **R3 · Universality U1** [L1 flight] — scaffold per-kind (game config, bin/exports/files/main, structured stubs), run-eval expectedBehavior+verification, uiGeneration call point, codegen reword, redTree/partial + capability.N.
4. **R4 · E-25 p2 pin + edit-test 3 pins re-point** [L3 flight].
5. **R5 · UI surfacing + RunScreen boundary wrap** [L3 flight].
6. **R6 · Record pastes + §MASTER-CORRECTIONS (CF-4)** [L3 flight].
7. **R7 · W-08 quarantine wiring** (quarantine.ts orphan → emitProject + EMIT_SKIP_DIRS + CLI envelope + docs).
8. **R8 · W-04/W-05/W-06 mint+partial semantics.**
9. **R9 · W-10 fixtures seat + W-12/W-13 doc residuals.**
10. **R10 · W-19/W-20/W-24/W-25/W-26/W-27/W-28/W-29/W-33/W-34/W-38/W-39/W-41/W-42/W-43/W-44/W-45/W-49/W-50-preview/W-52/W-53** (each with its register spec).
11. **R11 · Boundary**: typecheck pass (CF-2), headless leg → 96/96, scripts edit-test re-points, tsconfig.scripts fold (R15-f04).
12. **R12 · Hygiene**: `.t4scratch` + `_f1_headless.log` + root probes (W-36/O-2a).

## HYGIENE

- READ-ONLY respected: product code untouched; wrote only this lane log + the §P1 append to `wave_plans/W34/prep.md`.
- No test runs, no builds, no keyed calls, no git mutations.
- Every claim above carries its byte source; nothing judged from a log's words alone. Parent-observed numbers not on
  disk (96/94/2 @19:11:42) are labeled as such.
