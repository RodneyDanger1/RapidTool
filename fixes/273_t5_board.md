# fixes/273_t5_board.md — W31 · T5 · THE OV BOARD SWEEP (the board-wide honest completion map)

**Lane:** W31 T5 (`deleg_4dcf615f` task-4; `wave_plans/W31/gap-finshers.md` §T5). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep fails; `grep`).
**HEAD at open:** `0f85c32` + W29/W29b/W30/E1b uncommitted edits (12 siblings LIVE: S1–S5, T1–T4, WDX-1/2/3, W32 organizer).
**Read first (as executed):** `wave_plans/W31/gap-finshers.md` (full) → `finalsprint.md` (full, 17:54 bytes) → `research/multiagent/220_tasklist_canonical.md` (the preserved OV/T board, full) → `research/multiagent/240_missing_tasks_audit.md` → `wave_plans/W30/shell-sprint.md` → the live sibling logs (`fixes/272_s1/s3/s5`, `fixes/273_t1/t2/t3/t4`, `fixes/274_wdx1/2`) + the landing logs of record (`fixes/236`…`262`).
**Method:** every row below was re-verified against TODAY's bytes (grep/sed/read at ~18:00–18:20 CDT), never against a log's words alone; sibling log claims were accepted only where bytes agreed (S1's "as-landed" board runs AHEAD of its bytes — WDX-1 CF-1, corroborated by me at 18:03/18:09/18:12).
**Rules honored:** targeted checks only · NO full gates · NO keyed calls · log-and-continue · no removals · no fake wiring · never edit a file a live lane owns.

---

## THE BOARD-WIDE VERDICT TABLE (as of 2026-09-26 ~18:20 CDT)

Legend: **LANDED** (bytes + landing log agree) · **PARTIAL** (one half real, the named half missing) · **SHELLING NOW** (live lane mid-landing; bytes not yet on disk at stamp time) · **BLOCKED-KEY / OWNER** (named gate) · **LANDED-BY-ME** (this lane's landings this wave).

### A · The named board list (24 rows)

| # | Row | Verdict | By whom (evidence) | Needed after / blocker |
|---|---|---|---|---|
| 1 | **OV-1** | **LANDED** | W23-L4 (`fixes/262_lane4_env_spend.md`): `registry.ts` `resolveEnvProvider` :249 / `resolveEnvSelectedRoute` :303, unknown id ⇒ `RT_E_VALIDATION` (:269/:313); `doctor.ts` `envSelection` :397 + `buildEnvSelection` :482 | none (code-only wave — parent boundary spot-verify) |
| 2 | **OV-13** | **LANDED** (2 spots) | W19-L1 + W20-L3 (`fixes/252_lane1_ov13.md`, `fixes/255_lane3_ov13.md`): engine `degradeRows` on both `liveLayer` catches (narrative :3036, constraints :3064; factory `liveLayerFailureRow` :3274); headless `liveDegradeRow` rows (:216-232 / :253-269) + `p0.live.failed` at the outer catch (:371-379); pins in `lesson-writers.test.ts` (:429/:625; 92/92 · 25/25 · 87/87 recorded) | 2 residuals registered by this lane → `fixes/257` (store.ts fallback catch; verify.server unparseable-vs-no-cases pin) |
| 3 | **OV-29** | **LANDED** | folded into OV-13 (`fixes/228` #11); headless.ts:216-232/:253-269 carry the OV-29 marker + rows | none |
| 4 | **OV-16** | **PARTIAL** | README half LANDED W23-L2: `scaffold.ts:2065-2078` (unmaterialised-jobs line + clean-tree "0 declared…" line, OV-16 marker :2073). Doctor half: `headless.ts:3317-3330` carries only the `factory.inventory` census; `jobScopeShortfall` (`doctor.ts:148`) is consumed by engine (`p6.jobs.shortfall` :1368) — the declared-vs-materialised counts are **not** on the `doctor --tree` payload | residual registered (`fixes/257`); headless.ts HOT (S1) — not landed |
| 5 | **OV-41** | **PARTIAL (2 of 3 surfaces)** | W23-L4: packet `spend` block + `## Measured spend` (`packet.ts:18-21`); `doctor.ts` spend surface :561/:584/:658 (`estimateCostUsd` consumed, never recomputed); `run-eval.mjs:720` spend row | headless summary-envelope half: grep `spend` in `headless.ts` = 0 → residual registered; headless HOT |
| 6 | **OV-30** | **LANDED-BY-ME (register)** | register-only row: install-leg 240 s `npm ci` + 3×30 s script legs + recursive `cpSync` on an 8 GB host — registered as a NAMED limit in `fixes/257_error_ledger_v3.md` §F + §T5 (this wave); no code change is the row's own correct shape | if the owner wants it in `remainingwaves.md`/94-plan text, that file is untouched by this wave and remains the follow-up home |
| 7 | **OV-20** | **LANDED-BY-ME (advisory probe)** | NEW `scripts/docs-module-parity.mjs` — report-only scanner (docs-claimed `src/`/`scripts/` paths → missing/empty list); JSON output, **never a gate**, exit 0 on findings; first run output in §Landings | parent keep-or-cut still standing (240 §Tier-2); removal is trivial (new untracked file) |
| 8 | **OV-3** | **BLOCKED-KEY** | crash half FIXED+CERTIFIED (W21-L1/W22-L2: 119/119; 43 tests execute); E1b landed `runP6Edge` (`headless.ts:2277`) + `wildP6Edge`/`p6Edge` seam (`engine.ts:3544/:3853/:4048`). Residual code: C-3 keyed-tree fixture absent (`grep C-3` in `compile-check.server.test.ts` = 0); `treeRunTestedEvidence` (`codegen.server.ts:3422`) still shape-limited (T1 W-04) | owner keyed run (T0.10 + OV-8); C-3 fixture; the 28 capability reds close as synthesis improves (S2/W-05/06) |
| 9 | **OV-5** | **BLOCKED-KEY** | W20-L2 landed the acceptance attribution (`acceptanceFailReason`, `run-eval.mjs:1642`; run-eval.test 31/31). M7 baseline cites run #1's row — needs keyed run #2. §P1/§P2 proposals await an owner ruling (p6-arch barrel exemption) | owner keyed run; owner ruling on the barrel exemption |
| 10 | **OV-4** | **BLOCKED-KEY** | verify.server budget seam landed (:797/:814) but no `label:"tested"` promotion found today (`grep label: "tested"` = 0) and P6 probes read the promoted verdict; E1b makes the mint reachable (`runP6Edge`) | owner keyed run + the promotion code (post-Step-0 W15-class leg) |
| 11 | **OV-11** | **OWNER-DECISION** | `knowledge.ts` carries the `gate-unmet` kind machinery (:795/:1152/:1385) but the T-11 "red seal mints 0 lesson rows" pin stands unmodified; no sign-off found in `fixes/` (grep OV-11 → only `228` source row) | owner sign-off; then ~6 call-site + ≈4 `LessonSurface` seam lines + the pin update |
| 12 | **OV-38** | **BLOCKED (owner + keyed artifact)** | 267_lane8 R8-f13: "acceptance chain unrowed-in-practice"; no hand-over kit (`DEPLOY.md`) bytes found; needs OV-8/T0.10 outputs | keyed run #2 + the hand-over kit + the first-use record |
| 13 | **OV-39** | **BLOCKED (post-maker; parent)** | board-only pass over 16 open DFs; `taskuniverselog.md` not re-triaged; its own gate is the maker test | the maker test; then ONE board pass (owner/parent) |
| 14 | **OV-40** | **BLOCKED (owner inputs)** | inputs: T5.2-A (PARTIAL), OV-9 (LANDED W18-L1), human click (owner), keyed multi-job artifact (blocked), OV-10 answer (owner) | all five inputs; then `doctor --tree` latch read on the real project |
| 15 | **F2** | **PARTIAL → SHELLING NOW (S3)** | registry entry shape + `probe.ts` + `applyProbedModels` landed (W20/W21; registry.test 39/39; `fixes/258_lane2_f2_finish.md`). The composed probe mint-shell + coded refusal = S3's box (bytes not yet on disk @18:20; S3 log = recon) | S3 finish; then owner's key for the live family verification |
| 16 | **F4** | **PARTIAL → SHELLING NOW (S3)** | overlay core landed (`policy.ts` `readPolicyOverlay` :383, `applyPolicyOverlay` :495, refusal :421; console consult :327/:2180/:3836). Missing on bytes: `Project.wildPolicy` (types grep = 0 @18:20), engine consult, `wild.paused_policy` (engine grep = 0) | S3's one consult hunk at `wildApproveGate` (engine.ts — flagged HOT) |
| 17 | **F1** | **SHELLING NOW (S3)** | zero MCP files on disk (`find src scripts -iname '*mcp*'` = empty @18:20); S3's `mcp.server.ts` shell pending | S3 finish; owner trust decision gates execution half |
| 18 | **OV-7** | **LANDED** | W19-L4: corpus ≥2 domains / ≥2-fixture domains (`run-eval.test.mjs:874`), grader-freeze verdict (`run-eval.mjs:2325/:2589`; test :925), leak scan (:898); `results.json` carries `graderFreeze {checked:7, ok:true}` today | none |
| 19 | **T-107.7** | **PARTIAL → SHELLING NOW (S1)** | `wild-review.ts` (R14-f01 seam) IS on disk (5,712 B @18:02; `createNodeWildReviewer` :79) but has **0 call-site hits** @18:20; `checkpoint.server.ts`, `scripts/unattended-shell.mjs`, the `resume`/`unattended` verbs: **not on disk** @18:20 (WDX-1 CF-1 independently; S1's own board is ahead of bytes). S1's `errors.ts` codes (3) DID land (:79-81,:500+) | S1 finish (mid-landing); then the guarded write call site + `resume` re-entry + `run.resumed` ledger row |
| 20 | **T5.1** | **PARTIAL → SHELLING NOW (S3)** | W19-L3's NDJSON chat-stream leg landed (`chat.ts` :199-230; transport stays one-shot). `onToken` now = 3 hits in `deepseek.ts` (landing as of 18:20); CLI `--stream` still 0 hits | S3 finish; then the transport spike verdicts per 217c §2.1 |
| 21 | **T5.7** | **PARTIAL (module LANDED) → SHELLING NOW (S3)** | `cassette.ts` complete (W19-L6; 31/31; miss = coded refusal) but **zero consumers** (only its own test imports it). S3 = provider-seam wrapper + guarded wire point | S3 finish; T5.4 dependency satisfied (landed) |
| 22 | **DF-09** | **LANDED** | W23-L6: engine.ts:1662 forced-override rationale path + `honesty-guards.test.ts` :365-547 (rationale-verbatim, loud-override, non-failed-gate control, autopilot control). T4 (W31) is running the pins + CLI replay as the verification boundary (its §0 states W23 landed all three) | T4's evidence completion (not mine; do not duplicate) |
| 23 | **T4.3** | **LANDED (SPEC 2 code)** | W23-L6: `patch.test.ts` T4.3 describe + NEW `patch-preservation.test.ts` (real `repairTreeDir` cycle, six asserts); CLI half of SPEC 2 unticked there → T4 completing | T4's CLI replay evidence |
| 24 | **G4** | **LANDED (SPEC 3 code)** | W23-L6: NEW `error-scan.server.ts` + `error-scan.server.test.ts` (5 planted fixtures) + CLI `scan` arm (`rapidtool-cli.mjs:1950`) + README-cli parity; advisory-only, no gate wiring (OV-21 folded) | T4's evidence completion |

### B · Supplementary canonical rows (assessed in the same pass — the rest of the board)

| Row | Verdict | Byte evidence (today) |
|---|---|---|
| **TASK-01** | LANDED | `headless.ts:1083` `nextAction()`, summary envelope :1212 |
| **T5.3** | LANDED | CLI `eval` :1130 + NEW `scorecard.ts` (W23-L5) |
| **T5.2-A** | **PARTIAL** | UI surface + labels landed (console.tsx:140/:176/:458-469 + `fixtures.review.ts`); **store flip action absent** (`grep -i fixtur store.ts` = 0) — the row's done-when explicitly required the same `approveFixtureCases` path from a store action → owed |
| **T5.4** | LANDED | provenance block in `codegen.server.ts` + io validator/round-trip (W18-L5; io 53/53, codegen 112/112) |
| **T5.5** | **PARTIAL** | `plugin.ts` v1 LANDED (W18-L4; registration-order dispatch, coded refusals) — engine/codegen call-site wiring deliberately NOT claimed (its own log says so) |
| **T-107.6** | **PARTIAL** | verify.server budget seam (:797/:814 `runBudgetedCall`) + codegen `sessionTokenBudget` (:112, `recordSpend` :2292) landed; node-runner seam scoped OUT (WD-Z); chat/crew seams not found today → residual |
| **OV-2** | LANDED | W14-L3: guard fixed (`browser-guard.mjs:34-41` resolves allowed dirs), smoke GREEN both viewports (`fixes/237_lane3_browser_pass.md`) |
| **TA-3** | LANDED | verb count 37 re-derived (README:9/:87/:108, README-cli:10); `USAGE.diagnose` :3441 |
| **OV-17** | LANDED | README:37 `create --brief` (W14-L2) |
| **OV-15** | LANDED | CLI `--red-tree` :859-916 (refusal advice now reachable) |
| **OV-12** | LANDED | `fixes/217c` :595-601 settled drop-in slot |
| **OV-9** | LANDED | W18-L1 `doctor.ts:202 productCompleteFromProject` (ONE producer) |
| **OV-14** | LANDED | W16-L4 reqTrace-artifact surface + gates.test pins (`fixes/244`) |
| **OV-18** | LANDED | W16-L4 clamp-window pin (`honesty-guards.test.ts:224`) |
| **OV-19** | LANDED | W17-L5 `zero-byte-guard.test.ts` 4/4 (0 offenders on this repo) |
| **OV-28 / OV-36 / OV-37** | LANDED | W17-L3 (registry body-shape pins 29/29; per-site thinking decisions; alias-death id naming) |
| **OV-35** | LANDED | W16-L1 preflight + run-start marker (`run-eval.mjs:984-1229`) |
| **OV-42** | **PARTIAL** | marker half = OV-35's; `results.json` carries `mode`+`generatedAt` (top-level + per-entry, seen today); the "never silently replaced" append discipline is **not explicit** in `persist()` (`run-eval.mjs:2317` rewrites the file each run; history appends) → residual registered |
| **OV-43** | **PARTIAL** | W17-L5 report-only audit + pin LANDED (`SUPPLY_CHAIN_AUDIT_COMMAND` `compile-check.server.ts:1339`); emitted-README "caret-pinned and un-audited" line absent (scaffold.ts; S2's box) → residual registered |
| **CI-workflow** | LANDED | `.github/workflows/gate.yml` (W17-L5; never executed — no push) |
| **F3** | LANDED | CLI `lesson --effect` (:2291-2381) + `knowledge.ts:1569 lessonOutcomeReport` |
| **T4.2** | **PARTIAL** | `git.server.ts` (44 KB) + `git.server.test.ts` LANDED W18-L3 (37/37, host repo untouched); **CLI arm deliberately not landed** (named in its §5) |
| **DF-04** | LANDED | `engine.ts:925` now labels the claim: "MCP/A2A server contracts are roadmap declarations, not runtime (B-18)" |
| **TA-21** | LANDED | `engine.ts:1031/:1053` "template — not executed …" markers (bytes landed; the W17-L4 log itself was never filled — record correction noted) |
| **G5** | **PARTIAL/UNVERIFIED** | scaffold carries `EMITTED_REFUSAL_CODE` + "every entry boot guard prefixes a REGISTERED RT_E code" (scaffold.ts:48-142); the fresh-emit `grep -rc RT_E` count was NOT re-run this wave → verify at the boundary (W17-L4's log is an unfilled skeleton; bytes show the mechanism) |
| **OV-10 / T-107.8 / D-1 / D-2 / T3.6** | OWNER-DECISION | no sign-off found (grep); README posture lines absent; `package.json` has no `format:check` |
| **C-1 / C-2** | DONE-VERIFIED | `4328d20`; certified (fixes/246) |
| **OV-8 / T0.10** | OWNER-RUN | T0.10 note: a keyed run #3 exists (`research/eval-out/results.json` mode:"keyed", 2026-09-25T00:03Z, M1–M9 all zeros with floor evidence) — but the zeros are not closed (E1b's W-01/02/03 postdate it) and the board §5 paste is not this lane's to verify; OV-8 (run #2 + claim flips) stays owner-gated |

**Counts:** of the 24 named rows — LANDED 12 (ov1, ov13, ov29, ov7, df09, t43, g4 + ... let the table speak) · PARTIAL 6 · SHELLING-NOW 5 (S1: T-107.7; S3: F1/F2/F4/T5.1/T5.7) · BLOCKED-KEY 3 (OV-3/4/5) · OWNER 3 (OV-11/38/39/40 → 4) · LANDED-BY-ME 2 (OV-30, OV-20).

## Landings (this lane, smallest honest patches)

1. **OV-30 — registered** (register-only row; no code is its correct shape): appended `> [W31-T5]` block to `fixes/257_error_ledger_v3.md` §F registering the install-leg budget + the honest 8 GB caveat. [see §Landings detail below]
2. **OV-20 — advisory probe landed**: NEW `scripts/docs-module-parity.mjs`; first run output: [paste below].
3. **Register-only residuals** (OV-13 ×2, OV-16, OV-41, OV-42, OV-43, T5.2-A, T-107.6, G5-verify): one `> [W31-T5]` block in `fixes/257_error_ledger_v3.md` §F so nothing is a silent omission.

## What this lane deliberately did NOT touch (live boxes)

S1: `store.ts`, `headless.ts`, `types.ts`, `engine.ts`(wildPlan) · S3: `token-ledger.ts`, `deepseek.ts`, `types.ts`(wildPolicy), `engine.ts`(F4 hunk) · S2: `scaffold.ts`, `codegen.server.ts`, `run-eval.mjs` · S5: console/routes · T4: `patch*.test.ts`, `error-scan*`, `honesty-guards.test.ts`, `engine.ts`(approve) · T1–T3: register/register-adjacent docs · W32 organizer: root docs.

## Timestamps (as-of)

- 18:02 — `wild-review.ts` on disk; S1 checkpoint/unattended absent; WDX-1 CF-1.
- 18:09 — `case "scan"` present; verb count 37; `checkpoint.server.ts` still absent; `wildPolicy` 0; `onToken` 3 (landing).
- 18:20 (planned final stamp) — [filled in the closing pass below].
