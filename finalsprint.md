# finalssprint — the shell sprint (W30): every remaining capability, coded to a real seam

**Created:** 2026-09-26 ~17:55 (HEAD `0f85c32` + W29/W29b uncommitted edits). **Authors:** the W30 shell lanes S1-S4 + the delegator.
**Purpose:** code the SHELL of everything still missing for RapidTool to be a truly autonomous software factory — the
interfaces, seams, wiring points, types, honest refusals and TODO markers — fast, so the full logic has a real home.
**A shell is DONE when:** it compiles, it is wired to at least one real call site (or honestly refuses with a coded
reason), and its gap is marked `TODO(<row-id>)` at the exact line the logic goes. **A shell must never fake behavior.**

## THE MASTER TABLE — every remaining item: what it is · why · where · shell status · what's needed AFTER

| ID | Item | Why it matters (the mission) | Shell status | Needed after the shell (to make it WORK) |
|---|---|---|---|---|
| W-01/02/03 | wildStep keyed seam · mint reachability · emit materialization | The autonomy spine: the loop must call the model, run/gate must EARN p6-verified, the artifact must load | **LANDING (E1b)** | keyed boundary run on a funded key (O-1/O-4): wild → synthesis → mint → ship, end-to-end |
| R14-f01 | Wild supervisor Node-side completer | the "auto-review" capability is a ghost on every real driver | **S1** | bind `completeDeepSeek`-based reviewer at store.ts:1105 + headless wild macros; keyed wild run logs `wild.review (classifier)` |
| R13-f01/W-47 | Unattended end-to-end run | "walk away and it ships" — the definition of autonomous | **S1** | scheduler/daemon host (Task Scheduler/cron) + the keyed journey's completion; then one real overnight run |
| R13-f02 | plan-before-execute (`wild.plan`) | every best-in-class harness plans first | **S1** | prompt + store field + UI surfacing of the plan; pin: plan exists before phase 1 mutates |
| T-107.7 | checkpoint + `resume` | crash = restart-from-zero today; the 756s keyed journey demands it | **S1** | serialize after each phase commit; `resume` re-enters at the checkpoint; pin: kill mid-run → resume completes |
| A3-f06/R3-f06 | 4 kind emitters (game/CLI/library/service) | "any kind of software" — today: throwing stubs, webapp-only depth | **S2** | real per-kind entry wiring + package.json fields (`bin`/`exports`/`files`/`main`) + game vite.config; one green fixture each |
| A3-f05/R11-f12 | Real graders + the `verification` label | the acceptance layer must grade the PRODUCT, not package.json's presence | **S2** | per-kind behavioral assertions (entry runs, exports resolve) + label naming what was asserted |
| A3-f07 | Emitted UI seam | "perfect UI/UX for the software it makes" is structurally out of reach today | **S2** | UI-generation stage hook after P6 (template or model) + the kind-aware shell |
| R3-f02/R3-f03 | Prompt ESM reword · partial-synthesis semantics | the artifact must pass its own advertised `typecheck`; partials must skip-with-reason | **S2** | reword + `redTree`/`partial` envelope field + `capability.N` skip rows |
| T5.7 | Deterministic cassette | replay = tests without the network; wired to nothing today | **S3** | record/replay around the provider seam + a miss = coded refusal; pin: identical bytes across replay |
| T5.1 | Streaming surface | lib exists; no `--stream`/SSE surface | **S3** | CLI flag + SSE route + console pane wiring; pin: first-token < request-done |
| F1 | MCP runtime client | the field's best speak MCP; gated on the owner's trust call | **S3** | a client seam + one read-only tool round-trip; owner decision gates enablement |
| F2 | Second provider (step 2) | provider breadth = the growth lever | **S3** | after OV-1: registry entry + key env + a wire probe; DeepSeek stays default |
| F4 | Per-action allow-lists | the overlay exists; the engine never consults it | **S3** | engine consult at `policy.ts:170`-class seams + `wild.paused_policy` events + UI surface |
| ledger | Per-run token ledger | `RAPIDTOOL_TOKEN_CAP` can't stop a runaway today | **S3** | thread ONE ledger through codegen+verify; pin: sub-cap calls trip on run total (P lane partial-landed) |
| R11-f01 | Dev-server exposure | unauthenticated RCE surface on 0.0.0.0:8080 | **S4** | loopback default + the Origin-gate/auth seam; a doc line naming the deliberate exception |
| R11-f08 | `--force` quarantine | foreign files currently survive into a minted "tested" tree | **S4** | quarantine-move + report; pin: forced emit → foreign files moved, never judged |
| R6-f12 | Pane error boundary + `ui.pane_crash` | one pane's throw currently unmounts the whole screen | **S4** | class boundary + reportRt emitter; pin: forced throw keeps the shell mounted, one row lands |
| seat | Human-seat console surface | the governance high-water mark needs a real surface | **S4** | console approve path using the CLI's two-channel seam (never both-sides-same-env) |
| R13-f04 | Isolation boundary | needs a host isolator that does not exist here | **S4 · BLOCKED-SHELL** | honest refusal + the precise host requirement (documented, never faked); revisit if an isolator lands |

## §S1 — autonomy shells (lane S1 appends what it ACTUALLY landed here)
_(pending — lane S1: R14-f01 · W-47 · R13-f02 · T-107.7; log `fixes/272_s1_autonomy.md`)_

## §S2 — universality + quality shells (lane S2)
_(pending — lane S2: the 4 kinds · graders · UI seam · prompt/partial semantics; log `fixes/272_s2_universality.md`)_

## §S3 — depth shells (lane S3)
_(pending — lane S3: cassette · streaming · MCP · F2 · F4 · ledger; log `fixes/272_s3_depth.md`)_

## §S4 — floor + governance shells (lane S4)
_(pending — lane S4: dev-server bind · force-quarantine · pane boundary · seat surface · isolation refusal; log `fixes/272_s4_floor.md`)_

## RULES (all lanes)
Shells compile; wired to ≥1 real call site OR an honest coded refusal; `TODO(<row-id>)` marks the logic gap at the exact line; NO fake behavior, NO removed controls; targeted checks only (no full gates — the boundary follows); no keyed calls; append your section above the marker; write your lane log early.

## §WDX-1 · THE LANE WATCHER — W31 T1–T5 + the S-lanes · lane log `fixes/274_wdx1.md`
_(WDX-1 = task-5 of `deleg_4dcf615f` (17:58:14). READ-ONLY watch; every append re-reads this file first; rows = timestamp · actor · action · why · status · source.)_

**BOTTOM LINE (provisional — append-only; the FINAL bottom line lands in my CLOSING BLOCK at the end of this section):**
polls 3 · claims byte-checked 12: 8 CONFIRMED · 3 confirmed-in-flight (re-check next poll) · 0 WRONG · 1 ahead-of-bytes flag (S1's log board vs its landings — WDX-2 independently reached the same finding) · marker violations 0 · silent lanes (>6 min) 0 · counter-findings 1.

### WDX-1 · POLLS 1–3 · read 2026-09-26 18:00:58 → 18:04:32 — baseline; all 13 watched lanes fresh at every read; first bytes verified

**FLEET MAP [18:00:58]** — W31 `deleg_4dcf615f` (17:58:14, t=8): T1=task-0 · T2=task-1 · T3=task-2 · T4=task-3 · T5=task-4 · WDX-1=task-5 (this lane) · WDX-2=task-6 · WDX-3=task-7 — all `running`. S-lanes live: `deleg_143915d4` (17:54:56, S1–S4) + `deleg_a71fe9fb` (17:56:34, S5). NEW sibling delegation seen at poll 2: `deleg_0acc0d7d` (18:00) = W32 ORGANIZER + its own watchdog (logs `fixes/275_organizer.md` / `fixes/275_watchdog_organizer.md`) — NOT in my watch scope; recorded for the fleet picture only. **SOURCE:** the manifest.json files @18:00–18:04.

**LANE LIVENESS [18:00:58 · 18:03:26 · 18:04:32]** — 13/13 watched transcripts writing at every read (ages ≤ 30 s): T1 12,438→21,223→24,565 B · T2 12,414→18,291→20,583 · T3 14,376→22,926→26,250 · T4 10,771→17,459→19,759 · T5 9,502→16,215→19,393 · WDX-2 15,398→24,060→26,247 · WDX-3 17,390→22,947→25,148 · S1 38,920→44,084→44,084 · S2 34,671→42,096→45,464 · S3 32,846→33,398→34,052 · S4 36,530→43,630→44,329 · S5 21,699→23,910→24,913. **Silent >6 min: 0** (cumulative 0). **SOURCE:** `stat -c '%y | %s'` on all task logs @ each poll.

**LANE ROWS (own-words quotes from the live transcripts):**
- **[18:00:37→18:04:33] T1** · ACTION: verifying the keyed-run-feeding register rows IN CODE (W-18 `store.create enforceDod`; W-19/20/22/30 batch; `vault.ts backlinksFor`; W-38 `runP6Journey` callers; W-04 `treeRunTestedEvidence`); then **lane log `fixes/273_t1_register_rows.md` LANDED @18:04:12** — "Log written. Re-checking mtimes, then landing the small patches" · STATUS: in-flight (patches imminent) · SOURCE: task-0.log @18:00:37–18:04:33.
- **[18:00:50→18:04:36] T2** · ACTION: R15 sweep — "R15 mentions in live logs"; read `db.ts`; read `errors.ts` + `verify.server.ts L36-115`; "pin down the auth predicates (server.ts/verify.ts head), the RT_E doc…" · STATUS: in-flight · SOURCE: task-1.log.
- **[18:00:22→18:04:27] T3** · ACTION: `console.tsx L3802-3926`; `git diff --stat`; "lessons in run-eval" sweep; f10 verdict line "f10 Step A confirmed landed; Step B (`p6.lessons.readback` + `--taught`) is the…"; checked the `openai-compatible R4-f01 diff`; then `evidenceHash` in types/dod · STATUS: in-flight · **lane log landed @18:02 (FIRST 273_* log)** · SOURCE: task-2.log + `fixes/273_t3_r13.md` (3,338 B).
- **[18:00:40→18:04:30] T4** · ACTION: ran targeted `honesty-guards.test.ts`; README-cli state; `runToGate` def; read `README-cli.test.mjs`; "Console note-wiring is committed (HEAD:2086 = worktree:2193), README parity 11/1…"; then `headless.ts L2340-2539` + the write/refusal row scan · STATUS: in-flight · SOURCE: task-3.log.
- **[18:00:39→18:04:34] T5** · ACTION: read `240_missing_tasks_audit.md`; `255_lane3_ov13.md`/`252_lane1_ov13.md`; engine 3020-3075; then the **board-wide OV sweep wave** (OV-41/30/20/14/11/7/3/4/5/38/39/40 · F3 · T5.4 · T5.5 · T4.3 · G4 · OV-28/19 · DF-04 · TA-21 · G5, 25+ commands in one call) · STATUS: in-flight · SOURCE: task-4.log.
- **S-SWEEP [18:00–18:04]** · S1: `errors.ts` patched ×2 (17:59:35/18:00:13) → "Now patching types.ts with the `wild.plan` types and the Project field" (18:03:18) · S2: `scaffold.ts` reads → `write-set.ts L120-159` + `271_laneB_builds.md` reads (18:04) · S3: `token-ledger.ts` ×2 (18:00:47/18:02:14) → `codegen.server.ts` (18:03:35; "Patches applied (lint message is a path-with-space artifact…)") · S4: `humanSeatClaim` greps → **lane log `272_s4_floor.md` landed 18:03 (5,148 B)** · S5: wrote `scripts/path-safety.mjs` (18:00:51) → patched `write-set.ts` + `scripts/write-atomic.mjs` (18:02:56) · WDX-3: **landing WIRE-1 on `src/lib/wild-step.test.ts`** (patch @18:04:24) · WDX-2: **lane log `fixes/274_wdx2.md` landed @18:04:14** ("Now let me write my lane log early (per protocol), with the master-table audit f…") · SOURCE: the S/peer transcripts + `ls fixes/`.

**BYTE-VERIFICATIONS (claims ⇄ bytes — every item below read the actual file, never the log):**
1. **S1 claims 3 new RT_E codes (errors.ts)** → **CONFIRMED (registration)**: `git diff src/lib/errors.ts` shows `RT_E_UNATTENDED_UNSUPPORTED` · `RT_E_CHECKPOINT_MISSING` · `RT_E_NOT_IMPLEMENTED` appended + full `ERROR_CODE_DOC` rows (additive). **BUT usage outside errors.ts = ZERO at 18:02** (`grep -rn` over src+scripts) — not-yet-thrown; the CLI verbs + `unattended-shell.mjs` that must throw them are not in bytes yet.
2. **S1 claims `wild-review.ts` (new) + `createNodeWildReviewer` + 3 call sites** → **PARTIAL**: file exists (5,712 B @18:02), `createNodeWildReviewer` @:79 ✓, `WildReviewer` type re-export ✓; claimed call sites in `store.ts`/`headless.ts` = **0 hits** outside wild-review.ts (in-flight).
3. **S1 claims `checkpoint.server.ts` (new)** → **NOT ON DISK at 18:03** (`ls` fails). Mid-landing watch.
4. **S1 claims `readWildPlan` @engine + `wildPlan` types in types.ts** → **NOT in bytes at 18:03** (0 grep hits) — its own transcript shows the types.ts patch starting 18:03:18 → landing in flight.
5. **S3 claims R4-f03 non-Node hardening** → **CONFIRMED**: diff adds `defaultEnv()` (`typeof process === "undefined" || !process.env ? {} : process.env`) as the `tokenCapFromEnv` default (token-ledger.ts) — browser bundles can't ReferenceError.
6. **S3 recon claim "`sessionTokenBudget` → ZERO hits"** → first glance CONTRADICTED (hits :336/:343/:349), then **RESOLVED**: those hits are S3's OWN new landing in the same diff; `git show HEAD:src/lib/token-ledger.ts` has only `createTokenBudget` :298 → claim was true at recon; landing confirmed.
7. **S3 recon "cassette ZERO consumers (only cassette.test.ts imports)"** → **CONFIRMED with nuance**: `io.ts:53-55` + `io.test.ts:810` reference the cassette in comment/test-name text only; no real importers.
8. **S3 recon "`DeepSeekCompleteOptions` has NO `onToken`"** → **CONFIRMED** (clean `\bonToken\b` grep over deepseek.ts = 0; the earlier hits were `completionTokens` substring noise).
9. **S3 recon "console `policyAllowListsOf` @:327/:2180/:3836"** → **CONFIRMED ±1**: actual :326/:2181/:3836 (console.tsx churns under other writers — drift expected, keep re-anchoring).
10. **T3 claim "R4-f01 present (openai-compatible.ts + registry.test case) → f09(a) ALREADY-DONE-BY-P"** → **CONFIRMED**: `openai-compatible.ts:504` `code: noBalance ? "RT_E_LLM_NO_BALANCE" : "RT_E_LLM_REJECTED"`; `registry.test.ts:957` test "R4-f01: a 402 balance refusal maps to RT_E_LLM_NO_BALANCE…".
11. **S5 claims `path-safety.mjs` = ONE shared helper, THREE named consumers** → **CONFIRMED-in-progress**: helper on disk (3,344 B; `physicalPath` = realpath-deepest-ancestor + explicit honesty contract "null must NEVER be silently treated as inside"); consumer 1 `write-set.ts:19` import + **:71 real call** ✓; consumer 2 `scripts/write-atomic.mjs` import landed (18:02:56) ✓; consumer 3 CLI = **pending**.
12. **S3 claim "`Project.wildPolicy` NOT in types.ts"** → **CONFIRMED at 18:02** (0 hits) — but S1 patched types.ts @18:03 (wildPlan family); `wildPolicy` (S3's F4 field) re-checked next poll (S1∩S3 types.ts overlap = watch).

**GIT / BOX [18:03:26–18:04:32]** — HEAD `0f85c32` (no commits; parent owns). Tree deltas attributable: S1→`errors.ts`·`types.ts`·`wild-review.ts`(new) · S3→`token-ledger.ts`·`codegen.server.ts` · S5→`write-set.ts`·`scripts/write-atomic.mjs`·`scripts/path-safety.mjs`(new) · WDX-3→`wild-step.test.ts` · lane logs 272_s1/s3/s4/s5 + 273_t1/t3 + 274_wdx1/wdx2/wdx3. **T1/T2/T4/T5: no product edits yet** (analysis-first mandate — expected at this age). **Box violations: 0** (S5's write-set/write-atomic edits ride its "W29 B-rows leftovers" mandate — R11-f07 is Lane B's row; its UI-surfacing box not yet touched). **SOURCE:** `git status --short` @18:03:26 + per-file `git diff`.

### WDX-1 · POLLS 4–5 · read 2026-09-26 18:06:08 → 18:07:31 — T1's log lands (its verdict table under byte-check); T2/T3 begin LANDING; S1's wildPlan types reach disk

**LANE LIVENESS [18:06:08 · 18:07:31]** — 13/13 watched lanes fresh at both reads (slowest S2/S4 ≈ 2.1 min at the second read — under threshold): T1 26,490→27,034 B · T2 24,823→26,421 · T3 30,204→32,361 · T4 23,070→26,340 · T5 23,173→25,896 · WDX-2 30,813→35,220 · WDX-3 25,703→29,747 · S1 44,630→45,570 · S2 46,943 · S3 34,601→35,954 · S4 44,949 · S5 27,197→30,475. **Silent >6 min: 0.**

**T-LANE ROWS:**
- **[18:04:12→18:07:01] T1** · patches: `handoff.ts` ×2 (18:05:15, 18:07:01; diff = +16/−1 — the null-project guard, per its own comment "W-16: phaseHandoff is also called on foreign objects (console paste flows / hand-imports)…") · STATUS: in-flight · SOURCE: task-0.log + `git diff src/lib/handoff.ts`.
- **[18:06:32→18:06:56] T2** · **LANDING the R15 batch**: wrote `fixes/273_t2_r15.md`; created **`migrations/auth/0002_account_unique.sql`** (NEW); patched `scripts/migration-plan.mjs` · WHY (think, quoted): "Now the ERROR_CODE_DOC shape, then I'll start landing the migration batch (f02)" · STATUS: in-flight (bytes verified next poll) · SOURCE: task-1.log.
- **[18:06:49] T3** · "Coast is clear on scaffold.ts. Landing f13 — per-kind deploy handoff in DEPLOY.m…" → patched `src/lib/scaffold.ts` · STATUS: in-flight · SOURCE: task-2.log.
- **[18:07:33] T4** · **lane log `fixes/273_t4_defined.md` LANDED** ("Writing the lane log EARLY (§0 = as-found state), then…") + CLI L3320-3369 read · STATUS: in-flight · SOURCE: task-3.log.
- **[18:07:01→18:07:27] T5** · OV-16 shortfall surfaces sweep + `247_lane4` head + "E1b log size + tail" + "WDX-1 E1b/S1 checks" + "console fixtures usage" (its own evidence pass for board verdicts) · STATUS: in-flight · SOURCE: task-4.log.
- **[18:07:17→18:07:35] WDX-2 · WDX-3** · WDX-2: deep-verifying the ledger row ("can the cap stop a runaway tod…"; `codegen.server.ts:2280-2335`); WDX-3: "T1 deferred W-18 (the enforceDod flag wire) purely because console.tsx was hot —" → `console.tsx:6260-6290` + `store.test` greps (possible WIRE landing on W-18 — **overlap watch vs T1's deferred row**) · STATUS: in-flight · SOURCE: task-6/7.log.

**BYTE-VERIFICATIONS — T1's verdict table** (its log self-labels the table "draft as of lane open — refined in §Landings"; each row below = MY OWN read of the bytes, not the log):
- **V13 · W-09 ✓ CONFIRMED**: `gate.sh:193-198` exit condition carries `gates.testsScripts.ok && gates.testsLib.ok` (+ assertionGaps) — read :188-200.
- **V14 · W-11 ✓ CONFIRMED**: `grep -rn 'autonomous software agency'` over src+README+AGENT_GUIDE = exactly 2 hits, both rule-comments (`console.tsx:267`, `routes/index.tsx:7`); `og/site.json:1` = `"description":"governed delivery harness"`.
- **V15 · W-22 ✓ CONFIRMED**: busy union :1906-1908 includes `"module"`; `setBusyAction("module")` :2234.
- **V16 · W-18 ✓ CONFIRMED (still-open claim)**: `store.ts:1164-1167` `create` → `emptyProject({ brief, name: … })` only — no `llmStatus.configured` threading (browser create stays `enforceDod:false`).
- **V17 · W-20 ✓ CONFIRMED**: `engine.ts:2959-2962` ternary literally stamps `"deepseek-flash"` on `llmRan`; `llm-tasks.ts:127 / :157 / :188` request `model: "deepseek-v4-pro"` (exact line hits) → served-model threading absent.
- **V18 · W-23b ✓ CONFIRMED (absence)**: `keepLiveWildRun` = 0 hits in `store.ts` at 18:07 — consistent with "I land the helper + 6 sites" (in-flight).
- **V19 · W-16a ✓ CONFIRMED-with-drift**: `handoff.ts:110` `out.push(text(project.brief).trim() || "(no brief recorded)")`; the +15 offset vs the claimed :95 = exactly its own guard insertion above (diff +16/−1) → anchor consistent.
- **V20 · W-16b ⚠ NOT-YET**: `vault.ts` unmodified (`git diff` empty) at 18:07 — the claimed ":442 junk-row skip in `backlinksFor`" is not in bytes; the table self-labels "draft" → re-check next poll (NOT counted wrong yet).
- **V4-update · S1's wildPlan types**: NOW on disk — `types.ts:433` `wildPlan?: WildPlan | null;` ✓; engine `readWildPlan`, `checkpoint.server.ts`, `scripts/unattended-shell.mjs` + the CLI verbs **still absent @18:07** → **AHEAD-OF-BYTES FLAG PERSISTS** (S1 last transcript write 18:06:39; its log board already lists these as landed).

**RUNNING TALLY (this poll):** claims byte-checked **20 → 15 CONFIRMED · 5 in-flight/partial (re-check) · 0 WRONG.**

**FINALSPRINT PROTOCOL** — §WDX-1 (this section) landed 18:05:26 (6,266→14,992 B; marker intact = last line). WDX-2 observed diffing "baseline vs current (first 49 lines should be identical; 49+ pure append)" @18:06 — an external integrity check of my own append is live. §WDX-2/§WDX-3 + §T1..§T5 not yet appended by their authors at 18:07:31.

### WDX-1 · POLLS 6–7 · read 2026-09-26 18:09:20 → 18:11:40 (verification reads to ~18:13) — S1 + WDX-2 END early (both capped; WDX-2's § never landed); T2's auth-schema seam verified end-to-end; S5's helper reaches full wiring; FIRST silent-lane flag (S2)

**LANE LIVENESS [18:09:20 · 18:11:40]** — deltas: T1 27,679→28,825 B · T2 27,063→29,713 · T3 32,907→35,707 · T4 27,621→29,352 · T5 29,263→31,383 · WDX-2 39,724→40,670 **ENDED 18:09:37** · WDX-3 32,656→34,193 · S1 45,570 **ENDED 18:06:39** · S2 46,943 **FROZEN since 18:05:17** · S3 37,148→37,703 · S4 44,949→47,617 (recovered, active) · S5 30,962→34,690. **Silent >6 min: 1 — S2 (FIRST flag of the watch).**

**END-OF-LANE ROWS:**
- **[18:06:39] S1 — ENDED, PARTIAL** (duration 700.94 s; own summary: "## LANE S1 — partial landing (hit the iteration cap mid-sprint)"). **Byte census (my deliberate re-checks @18:09–18:11): LANDED = (i) `errors.ts` 3 codes + DOC rows; (ii) `types.ts` `wildPlan` :433 (+ the WildPlan/WildPlanRow types); (iii) `wild-review.ts` (5,712 B, `createNodeWildReviewer` :79). NOT-LANDED = `checkpoint.server.ts` (ls fails) · `scripts/unattended-shell.mjs` (ls fails) · CLI `unattended`/`resume` verbs (case-count 0) · engine `readWildPlan` (0 hits; the word `wildPlan` absent from engine.ts) · store/headless reviewer call sites (0 hits; the word "reviewer" absent from both).** → **CF-1 FINAL: `fixes/272_s1_autonomy.md`'s "as-landed" board (unchanged since 17:59) lists ALL FOUR items with call sites + TODO markers; 3 of 4 are not in the bytes and the lane is closed. Recovery of items 2–4 (or a §S1 correction + re-dispatch) is owed — parent/WDX-3/next wave.** WDX-2's independent census matched (its log §S1 items + final message).
- **[18:09:37] WDX-2 — ENDED, capped pre-append** (duration 680.45 s; own words: "**Iteration cap hit before the §WDX-2 append to finalsprint.md.** Everything below is backed by bytes I actually read; the audit content lives in the lane log (written early, per protocol). Nothing was fabricated."). Deliverable on disk = `fixes/274_wdx2.md` (9.4 KB): master-table 20/20 byte-audit + **corrections RS-01..RS-04** (RS-01 W-01/02/03 = LANDED-by-E1b, not "LANDING"; RS-02 F2 entry ALREADY landed (registry.ts:116/:119/:201), missing only mint/failover/OV-1; RS-03 F4 needs `wild.paused_policy` registered first + real consult at `engine.ts:3668` (policy.ts:170 is NOT a consult seam); RS-04 R6-f12 = PARTIALLY LANDED (PaneBoundary console.tsx:1633/:1648, RunScreen unwrapped, no forced-throw pin)) + protocol baseline (49-line snapshot md5 `b57bb4c3304efd0af4d9e5b5e08383df` kept at `C:/Users/mnril/wdx2_work/baseline_finalsprint.md`). **§WDX-2 in finalsprint.md = NOT LANDED → OWED (parent-scribe, W25-precedent).** WDX-2 also re-ran WDX-3's wild-step fix → **14/14 green** (after E1b left it 13/14).

**T-LANE ROWS (deltas):**
- **T1** · adding the W-16 pins to `vault.test.ts` @18:11:22 (handoff pins before) · SOURCE task-0.log.
- **T2** · ran `errors.test.ts` → **37/37 pass** @18:10:44 ("Guard behaves exactly to spec (silent when off / copy-up present; coded refusal…)"); then `npx tsc --noEmit` → **tsc exit 2 @18:12:28, errors "all in sibling-lane files (headless.test.ts, llm.test.ts, r…"** — log-and-continue per contract; **recording CF-2: the tree's typecheck is RED (in sibling files) at this read; the sprint boundary gate will need a fix pass — not independently re-run by me (no full gates).** · SOURCE task-1.log + its own transcript line.
- **T3** · f13 verified in bytes (V21 below); then the f09 leg — `registry.ts` greps + **patch @18:11:41** · SOURCE task-2.log.
- **T4** · **teeth proofs underway** — scratch copy `.t4scratch` (13/13), "Teeth proof #1 — disable the engine guard in the cop…" (mutation-style proof that the DF-09 pin can fail); `.t4scratch/lib` still present @18:11 (in-repo scratch — cleanup owed at close) · SOURCE task-3.log.
- **T5** · `node scripts/docs-module-parity.mjs` + OV-20 probe ("runs clean (exit 0; its one \"finding\" is the known false-positive…"); read `257_error_ledger_v3.md`; **its log `fixes/273_t5_board.md` landed 15,648 B @18:10** · SOURCE task-4.log.
- **WDX-3** · **landed the W-18 store half** — `store.ts` `create()` spreads `...(get().llmStatus.configured ? { enforceDod: true } : {})` + full comment @18:08:25 (own words: "T1's deferral was console.tsx-side only; the store.ts half is clean and unowned."); adding the `store.test.ts` pin @18:11:08 · **overlap note: console half of W-18 still unowned — watch.** · SOURCE task-7.log.

**BYTE-VERIFICATIONS V20-resolved/V21–V28 (my own reads):**
- **V21 · T3 f13 ✓ CONFIRMED**: `scaffold.ts` diff — `kindHandoff: Record<ProjectKind, string[]>` per-kind command block in `deplyNotes()` + honesty bullet "Handoff commands (a TEMPLATE — none of it ran here…)" + ```text emit; commands reference only declared PKG_SCRIPTS. Real content, no fake.
- **V22 · T2 code ✓**: errors.ts diff — `"RT_E_AUTH_SCHEMA_MISSING"` + full DOC row (meaning: sign-in enabled but no migration creates the Better Auth `user` table; action: copy-up or `VITE_AUTH_ENABLED=false`).
- **V23 · T2 helper ✓**: `migration-plan.mjs` — `AUTH_SCHEMA_MIGRATION`, `createsAuthUserTable()`, `authSchemaRefusal()` (coded refusal or null; callers named).
- **V24 · T2 applier 1 ✓**: `scripts/migrate.mjs:19` import → **:55 call** `authSchemaRefusal({ authEnabled, names: entries, sql: sqlTexts })` (refuses BEFORE touching the DB).
- **V25 · T2 applier 2 ✓**: `src/lib/db.ts:1` import → **:159 call**.
- **V26 · T2 migration file ✓**: `migrations/auth/0002_account_unique.sql` — real idempotent `create unique index if not exists "account_providerId_accountId_uq" on "account" ("providerId","accountId")` + duplicate-resolution guidance. (The register's account-index row = genuinely landed.)
- **V27 · T4 DF-09 pin ✓**: honesty-guards.test.ts diff — snapshot `decisionsBefore` + non-vacuous precondition assert + `assert.equal(gated.decisions.length, decisionsBefore, …)` replacing the W23 literal `=== 0` ("found red: 2 !== 0, fixes/273 §0").
- **V28 · WDX-3 W-18 store wire ✓**: store.ts diff above — honest conditional spread (keyless/unprobed behavior unchanged).
- **V20-resolved · T1 W-16b ✓ (late-landed)**: `vault.ts` diff @18:08:59 — `!Array.isArray(notes) → []` + `row(n)` coercion + title/links guards (matches the claimed ":442 junk-row skip").
- **V11-resolved · S5 ✓ FULL**: consumer 3 landed — `rapidtool-cli.mjs:61-63` (comment + `import { physicalInside } from "./path-safety.mjs"`) + **:1507 call** `if (physicalInside(dirPath, targetPath) === false)`. All 3 named consumers wired + genuinely called.

**RUNNING TALLY:** claims byte-checked **28 → 23 CONFIRMED · 0 WRONG · 3 NOT-LANDED (S1 items — CF-1) · 2 pending (WDX-3 store-pin proof; T2's tsc-red scope).** polls 7 · marker violations 0 · silent lanes 1 (S2, first flag) · counter-findings 2 (CF-1 final; CF-2 typecheck-red in sibling files).

**FLAGS:**
- **FLAG-1 (silent, first of the watch): S2** (`deleg_143915d4` task-1, universality) — transcript frozen since 18:05:17 (6m23s at the 18:11:40 read); lane log landed 18:05 (4,298 B). Deliverables = master-table §S2 set. If still frozen next poll → recovery needed. (Possible transcript write-lag — hedged.)
- **CF-2 (boundary smoking gun):** T2's `npx tsc --noEmit` = exit 2 @18:12:28, errors in sibling files (headless.test.ts, llm.test.ts, r…). Recorded as observed; boundary fix pass owed before the wave gate.

**FINALSPRINT PROTOCOL** — 19,934 B @18:09:00; §WDX-1 = the only live section (this one); §T1–§T5/§WDX-2/§WDX-3 still not appended; marker intact = last line. WDX-2's separate 49-line baseline (md5 b57bb4c3…) enables its own audit.

### WDX-1 · POLL 8 + CORRECTIONS · read 2026-09-26 18:13:57 → 18:15:30 — CORRECTION: S2 was TERMINAL, not silent; T5 ENDS capped pre-append; no §T/§S/§WDX-2/3 headers landed yet

**CORRECTION ROW (append-only — corrects my POLLS 6–7 FLAG-1):** S2 is **NOT a silent lane**. Its transcript's last line (read 18:13:57, via the wake-check) is a **FINAL: `status=completed duration=618.97s` @18:05:17**, own words: "## W30 LANE S2 — status: **reconnaissance complete, code edits NOT landed** ⚠️ I hit the iteration cap during the read/design phase. Honest state below — no fabricated completion." → **Reclassified: S2 = TERMINAL (capped during read/design; ZERO code edits; only its 4,298 B recon log `fixes/272_s2_universality.md` exists). The master-table §S2 set (4-kind wiring, per-kind graders, uiGeneration hook, prompt reword) is NOT BUILT → recovery/re-dispatch owed.** Silent-lane count returns to **0** (S2's freeze = closure; no lane silent at any read). FLAG-1 closed-as-terminal.

**END-OF-LANE ROW · [18:12:45] T5 — ENDED, capped pre-append** (duration 868.05 s). Own words: "## W31 T5 — OV Board Sweep: summary (iteration cap hit before the final append) **Honest gap first:** I completed the sweep, wrote the …". Deliverables verified on disk: `fixes/273_t5_board.md` (15,648 B — the board-wide verdict table) + **`scripts/docs-module-parity.mjs` (4,674 B, NEW — the OV-20 advisory probe, V29)**. **§T5 in finalsprint.md = NOT LANDED at 18:15 (grep: no `§T` header anywhere) → OWED.**

**POLL-8 LANE ROWS:**
- **T1** · `vault.test.ts` pins ×2 (18:11:22, 18:13:26) + `handoff.test.ts` pin (18:13:26) — the W-16 pins complete its landing pair.
- **T2** · auth batch closed (errors.test 37/37; tsc run); moved to "the config-hygiene batch" — `DEEPSEEK_MODEL*` reader sweeps @18:13:46–59.
- **T3** · **landed the R13-f09 failover shell** — `registry.ts`: `FALLBACK_PROVIDERS_ENV_VAR` + `resolveFallbackChain()` (pure; coded `RT_E_VALIDATION` on unknown/duplicate ids; resolved-but-NOT-ARMED with the loud call-site refusal; unset ⇒ byte-identical) — after collision-checking siblings ("A sibling touched registry.ts — verifying no collision before the callModel patc…") — **S3∩T3 share registry.ts: watch, no clobber observed at this read.**
- **T4** · teeth proofs in scratch (`.t4scratch`, 4 min without a transcript write at this read — under threshold; re-check next poll).
- **WDX-3** · **running E1b's owed headless leg** — "The background run never started properly. Re-run the headless leg in foreground" → `node --experimental-strip-types --test src/lib/headless.test.ts` (closing the debt WDX-2 flagged in RS-01).
- **S-lanes** · S3 38,832 B · S4 48,605 · S5 38,175 (all hot); S1/S2 terminal.

**BYTE-VERIFICATIONS V29–V30:**
- **V29 · T5's OV-20 probe ✓ (re-run BY ME)**: `node scripts/docs-module-parity.mjs` → **exit 0**; structured report incl. self-checks `"missingDetected": true`, `"existingNotFlagged": true`; **not referenced by `scripts/gate.sh` / package.json** → the advisory-only claim holds.
- **V30 · T3's failover shell ✓**: `registry.ts` diff read — matches its own honesty description (resolved, not armed, loud refusal, byte-identical unset path).

**RUNNING TALLY:** claims byte-checked **30 → 25 CONFIRMED · 0 WRONG · 3 NOT-LANDED (S1 items) · 2 pending.** polls 8 · marker violations 0 · silent lanes 0 (FLAG-1 closed) · counter-findings 2.

**WAVE-WIDE STATUS SNAPSHOT (for the completion map):** ENDED — S1 (partial: 3 items on disk of ~10 claimed), S2 (recon only, 0 edits), T5 (sweep + log + probe; §T5 unappended), WDX-2 (audit log complete; §WDX-2 unappended). LIVE — T1, T2, T3, T4, WDX-1 (this lane), WDX-3, S3, S4, S5. **OWED AT CLOSE (running list):** §S1 recovery (items 2–4 or correction), §S2 build-or-de-scope, §T5 append, §WDX-2 append; + T2's tsc-red sibling files (CF-2) before any boundary gate.

### WDX-1 · POLLS 9–10 · read 2026-09-26 18:16:33 → 18:17:26 — T2's R15 landing wave-2 (file-set byte-verified); T5's register-continuation block in 257; T4 FIRST REAL SILENT FLAG; T1/T3 in pin-and-test phase

**LANE LIVENESS [18:16:33 · 18:17:26]** — T1 32,991→33,740 B · T2 38,257→40,176 · T3 38,007→39,150 · T4 29,352 **FROZEN since 18:11:11** · T5 33,488 (final @18:12:45) · WDX-3 37,004→37,466 (re-activated — headless leg write landed) · S3 40,036 · S4 49,650 · S5 38,732. **Silent: T4 = 6m15s at the 18:17:26 read → FLAG-2 (first REAL silent flag).**

**LANE ROWS:**
- **T2** · **wave-2 landings** (all byte-verified): `tsconfig.scripts.json` (NEW, R15-f04 staged) · `.prettierignore` (NEW, R15-f05) · `.env.example` (M — advanced-knobs block, R15-f09) · `package.json` (M — `version`+`engines`, R15-f10) · `AGENTS.md` (M correction) · `public/__grok/install/styles.css` (M — `:focus-visible`, R15-f12) · `agentnotes.md` + `attachments/RapidTool_Complete_Master.md` (M — HISTORICAL banners, R15-f13); its lane log carries the complete f01–f14 row table (this is the §T2 record); its own measurement: "Staged scripts-program measured: **1030 errors** (cli 299, run-eval 284, tests ~280…)" · SOURCE task-1.log + the files themselves.
- **T5** · patched `fixes/257_error_ledger_v3.md` (+10 lines: "### F · W31 · lane T5 register continuations" — OV-30 REGISTERED (registered limit, no code) · OV-13 residuals (2 sites) · OV-42 residual (append discipline owed) · OV-16/OV-41/OV-43 residuals (hot-file halves deferred, named) · T5.2-A residual (store action = 0 hits) · T-107.6 residual · G5 boundary note) · SOURCE task-4.log + `git diff`.
- **T1** · `scripts/README-cli.test.mjs` patched ×3 (18:16:43–18:17:27) — "Checking which README lines match the widened regex (false-positive risk)" (verb-count parity hardening) · SOURCE task-0.log.
- **T3** · wrote **`src/lib/llm/providers/registry-failover.test.ts`** (NEW @18:16:52) — the f09 shell's test leg · SOURCE task-2.log.
- **WDX-3** · headless leg (E1b's owed debt) — transcript re-activated @18:17:22; result read next poll · SOURCE task-7.log.

**BYTE-VERIFICATIONS V31–V33:**
- **V31 · T2 tsconfig.scripts.json ✓**: 552 B, exact honesty comment — "STAGED, NOT IN gate.sh … Measured at land time (2026-09-26): 1030 errors (rapidtool-cli.mjs 299, run-eval.mjs 284, test files ~280; mostly TS7006 implicit-any under checkJs) · TODO(R15-f04): fold into gate.sh step 1 the moment it is green." → staged exactly as claimed (no fake-green).
- **V32 · T5 "grep -i fixtur store.ts = 0" ✓**: re-ran → 0.
- **V33 · T2 file-set ✓**: `.prettierignore` (600 B, new) · `M .env.example` · `M package.json` · `M AGENTS.md` · `M public/__grok/install/styles.css` · `M agentnotes.md` · `M attachments/RapidTool_Complete_Master.md` — all present in `git status`.

**RUNNING TALLY:** claims byte-checked **33 → 28 CONFIRMED · 0 WRONG · 3 NOT-LANDED (S1) · 2 pending.** polls 10 · marker violations 0 · silent lanes 1 (T4 — first real flag).

**FLAG-2 (silent): T4** — no transcript write since 18:11:11 (6m15s at read; last action = the `.t4scratch` teeth-proof python heredoc → possibly one long foreground tool call). **Escalate next poll if unchanged.** T4's landed pieces so far are real (DF-09 pin fix V27; log `273_t4_defined.md` 6,282 B).

### WDX-1 · POLLS 11–12 · read 2026-09-26 18:18:22 → 18:19:30 — T4 RECOVERED (FLAG-2 closed: one long tool call); WDX-3's headless debt-run at 93/96 (3 failures, capture in flight); T3's f14 de-scope + its failover test passes 7/7 (re-run by me)

**LANE LIVENESS [18:18:22]** — T1 37,795 B @18:18:21 · T2 40,652 @18:17:28 · T3 42,185 @18:18:18 · T4 30,007 @18:17:33 (**recovered**) · T5 terminal (33,488) · WDX-3 37,666 @18:17:26 · S3 42,817 @18:18:16 · S4 49,650 @18:15:04 (age ≈3m at read — slow, watch) · S5 39,566 @18:17:33. **Silent >6 min: 0.**

**LANE ROWS:**
- **[18:17:32] T4 · RECOVERED — FLAG-2 CLOSED.** Own words: "Teeth #1 proven (A2 red, A1 green — store pre-check holds independently)." → the 6m15s write-gap was ONE long foreground tool call (the python mutation + proof run in `.t4scratch`); writes resumed @18:17:33 (`cp src/lib/engine.ts .t4scratch/lib/engine.ts` — restoring the mutated scratch copy). **Teeth proof #1 result: the DF-09 pin genuinely fails when the engine guard is disabled** (A2 red) while the A1 leg stays green — i.e. the pin is non-vacuous.
- **[18:17:26] WDX-3 · headless leg (E1b's owed debt): "93/96 — need the 3 failure details. Re-running with full capture."** → 3 failing tests in `headless.test.ts` at this read; full capture in flight (result read next poll). **POTENTIAL BOUNDARY ITEM — watch.**
- **[18:18:18] T3 · landed f14 de-scope + marker** in `subagent.ts` (V34 below).
- **[18:18:08→18:18:21] T1 · deeper register rows** — W-29b sandbox sites sweep; mtime-stat on `rt-client.ts`/`diagnose.ts`/`store.ts`/`llm.ts`/`llm/providers/deepseek.ts`; W-25g `upgradeP6Keyed` catch.
- **T2 · docs patches** @18:17:27–28 (`agentnotes.md`, `attachments/RapidTool_Complete_Master.md`, `public/__grok/install/styles.css`) — its wave-2 set complete as recorded.

**BYTE-VERIFICATIONS V34–V35:**
- **V34 · T3 f14 de-scope ✓**: `subagent.ts` diff — "W31 · T3 (R13-f14) — STATUS: DE-SCOPED FOR THIS WAVE, explicitly … WIRE PLAN when the sequence opens … TODO(R13-f14): add that call site … once R13-f01 + R13-f11 land — this contract already satisfies what they will consume; nothing here is fake, it is simply not yet wired." Exactly the mandated de-scope shape.
- **V35 · T3's failover test ✓ (run BY ME)**: `node --experimental-strip-types --test src/lib/llm/providers/registry-failover.test.ts` → **7 tests · 7 pass · 0 fail** (1.29 s).

**RUNNING TALLY:** claims byte-checked **35 → 30 CONFIRMED · 0 WRONG · 3 NOT-LANDED (S1) · 2 pending.** polls 12 · marker violations 0 · silent lanes 0 (FLAG-2 closed same-cycle; lifetime silent flags: 2 raised, both closed as non-stalls — S2 terminal, T4 long-call) · counter-findings 2.

### WDX-1 · POLLS 13–14 · read 2026-09-26 18:19:57 → 18:20:15 — THE CAP WAVE: T3 + WDX-3 + S4 END capped (deleg_143915d4 fully closed @18:20:05); T1's W-23b helper lands; CF-3 (headless 93/96 — failures named)

**LANE LIVENESS [18:19:57 · 18:20:15]** — T1 40,367 B @18:19:06 · T2 43,119 @18:20:03 · T3 **ENDED 18:20:15** · T4 30,007 @18:17:33 · T5 terminal · WDX-2 terminal · WDX-3 **ENDED 18:20:09** · S1/S2/S3/S4 **all final-written @18:20:05 (delegation closed)** · S5 39,566 @18:17:33 (still live).

**END-OF-LANE ROWS:**
- **[18:20:15] T3 — ENDED capped** (1318.97 s; own words: "**Iteration limit reached — reporting honestly. 3 of my 6 rows landed in code; the two RECORD deliverables (lane log final + §T3 appe[nd]) …**"). Landed-in-code = f13 (V21) · f14 (V34) · f09 failover + 7/7 tests (V30/V35). **§T3 NOT appended → OWED.**
- **[18:20:09] WDX-3 — ENDED capped** (1312.25 s; own words: "**Iteration cap reached — reporting honestly. Two wires LANDED with proofs; the §WDX-3 / lane-log appends did NOT persist (I ran out of calls) …**"). Wires on disk = wild-step.test.ts normalize fix (E1b 13/14 → 14/14, WDX-2-verified) + store.ts W-18 spread (V28) + its store.test pin (ran green @18:13:29). **§WDX-3 NOT appended → OWED; lane log = early skeleton (3,328 B).**
- **[18:15:04 / exit 18:20:05] S4 — ENDED capped** (1206.08 s; own words: "## W30 LANE S4 — status summary (hit iteration cap mid-implementation) **Landed & verified** — **R11-f01 dev-serve…**"); wrote `src/lib/quarantine.test.ts` @18:14. §S4 + log finals owed.
- **[18:20:05] deleg_143915d4 = ALL FOUR TERMINAL** (S1/S2/S3/S4; S4's exit line read = `max_iterations`; S1/S2/S3 finals written the same second). **NONE of the S-lanes landed a §S append in finalsprint.md** (grep: only the parent's `_(pending)_` placeholders exist).
- **[18:19:06] T1** · **W-23b batch 1 landed** — `keepLiveWildRun` helper ON DISK (`store.ts:278`); own words: "Applying W-23b patches — batch 1 (helper + first two sites)". **Overlap watch: store.ts is shared with WDX-3's W-18 hunk — no clobber observed; T1 re-read the file first (sed + 14 cmds).**

**CF-3 (NEW — headless.test.ts = 93/96):** 3 failures named from WDX-3's capture: `not ok 2 — keyless without a seam keeps the deterministic floor path byte-for-byte (parity pin)` · `not ok 10 — fixes/144 (M4-2) — driveP6Journey (fake-deps: deterministic, no key/fs/runner)` · `not ok 19 — E-25 — CLI machine contract (exit codes + envelope + doctor)`. WDX-3 re-ran with full capture (`%TEMP%/wdx3_headless2.log`) but capped before writing the detail → **details owed**; consistent with E1b's unrun 17:55 pins (WDX-2's RS-01 debt) and/or live-edits. **Boundary item.**

**RUNNING TALLY:** claims byte-checked **35 → 30 CONFIRMED · 0 WRONG · 3 NOT-LANDED (S1) · 2 pending (T1 W-23b completion; CF-3 details).** polls 14 · marker violations 0 · silent lanes 0 · **CAP CENSUS (ended with §/log appends owed): S1 · S2 · S3 · S4 · T3 · T5 · WDX-2 · WDX-3 = 8.**

### WDX-1 · CLOSING BLOCK · 2026-09-26 18:22:55 — the watch, closed

**FINAL BOTTOM LINE:** polls 15 (18:00:58 → 18:22:55, ~90 s cadence, every read timestamped; 8 appends by me, each after a re-read) · claims byte-checked **35: 30 CONFIRMED · 0 WRONG · 3 NOT-LANDED (S1 items) · 2 pending-at-close** · **marker violations 0** (END-OF-FILE-MARKER-SPRINT intact = last line after all 8 appends; my section = §WDX-1 only) · **silent lanes standing: 0** (2 flags raised — S2, T4 — both closed as non-stalls) · **counter-findings 3 (CF-1 · CF-2 · CF-3)** · **box violations 0** · keyed calls 0 · full gates 0.

**TERMINAL-WITH-OWED CENSUS (8 lanes):** S1 (partial build; log board overstates — CF-1; recovery owed) · S2 (recon only, zero edits; build-or-de-scope owed) · S3 (capped; §S3 owed) · S4 (capped mid-implementation; §S4 owed) · T3 (3/6 rows landed; §T3 owed) · T5 (sweep + log + probe landed; §T5 owed) · WDX-2 (audit complete in `fixes/274_wdx2.md` incl. RS-01..RS-04; §WDX-2 owed) · WDX-3 (2 wires with proofs; §WDX-3 owed; lane log = skeleton).

**LIVE AT CLOSE (4 lanes):** T1 42,129 B @18:22:19 (W-23b batch patching `store.ts`; "Sibling warning noted — I read fresh bytes right before patching") · T2 43,909 @18:22:53 (R15 batch active; 8+ files landed + verified V22–V26, V31–V33) · T4 30,662 @18:22:00 (teeth proofs; DF-09 pin fixed V27; `.t4scratch` cleanup owed) · S5 44,277 @18:22:53 (W29-leftovers finishing; all 3 path-safety consumers wired V11-full).

**COUNTER-FINDINGS (final):**
- **CF-1** — `fixes/272_s1_autonomy.md`: "as-landed" board vs bytes (3 of 4 items absent; lane closed capped; WDX-2 concurred independently). Recovery owed.
- **CF-2** — the tree's typecheck is RED in sibling files (T2's `npx tsc --noEmit` = exit 2 @18:12:28: headless.test.ts, llm.test.ts, r…). Boundary fix pass owed.
- **CF-3** — `headless.test.ts` = 93/96 @~18:16; 3 failures named (`keyless … parity pin` · `fixes/144 M4-2 driveP6Journey` · `E-25 CLI machine contract`); full-capture detail at `%TEMP%/wdx3_headless2.log` (WDX-3 capped before reporting it).

**HANDOVER (for the parent / next wave):**
1. **Scribe the owed §-appends from each lane's own log/transcript** (W25 A2/A3 precedent): §S1 (+correction), §S3, §S4, §T3, §T5, §WDX-2 (RS-01..RS-04 + the master-table corrections), §WDX-3.
2. **§S2** — re-dispatch or explicit de-scope (zero code edits; its 4,298 B recon log is the only artifact).
3. **Boundary blockers before any gate:** CF-2 (typecheck) · CF-3 (headless 3 failures) · T2's measured 1030-error scripts program (staged `tsconfig.scripts.json`, deliberately NOT gated — `TODO(R15-f04)`).
4. **Unowned halves:** W-18 console half · R13-f01/f02 + T-107.7 recovery (`checkpoint.server.ts`, `scripts/unattended-shell.mjs`, CLI `unattended`/`resume` verbs, engine `readWildPlan` — never built by S1).
5. **Verify at boundary:** T1's W-23b completion + tests · T2's tsc-red attribution · T4's teeth #2 · S5's UI surfacing set.

**HYGIENE (final):** READ-ONLY on product code (only my lane log + this §WDX-1 were written); no git mutations; scratch `C:\Users\mnril\wdx1_poll.sh` (outside the repo); 0 keyed calls; 0 full-gate runs; every number above sourced from the poll blocks + `fixes/274_wdx1.md`; no other lane's section was edited; evidence for every byte-claim = the `file:line` read at poll time.

## §S5 — the UI surfacing (W36 lane N3 · `console.tsx` additive read-only surfaces · log `fixes/281_n3_ui.md`)

**Landed:** ONE additive read-only card — `ShellSurfacesCard` (defined `src/components/console.tsx:6714`; rendered in the right sidebar at `:3546`, between `<GateHealthCard/>` and Diagnostics) + one render line with a 5-line comment. File grew 6,677 → 6,832 lines (**+155, pure additions** — both patch hunks added lines only; no control, tab or pane was removed or repointed). Scoped check at lane close: `npx eslint src/components/console.tsx -f json` → `messages: []` (exit 0). FixturesPanel doctrine held: state visible · refusal named · coded reason in `title`; every row is text, so the card contains no enabled no-op.

| # | Item (row at `console.tsx:`) | Honest state SHOWN | Coded reason / row cited (`title` + text) |
|---|---|---|---|
| 1 | Wild plan `:6736` | With a stored plan: `source` · N step(s) · goal · note (clipped). Without one: "no plan on record — the planner is not wired yet; the wired reader returns an honest empty plan (`source: "empty"`), never invented steps." | R13-f02 — `Project.wildPlan` (types.ts:172-183); stored-plan guard mirrors `engine.readWildPlan`'s (`steps` must be an array) |
| 2 | Checkpoint · resume `:6762` | Store-level line from `project.wildRun`: paused → "resume available — paused in-session … (Resume above)"; active → "nothing to resume"; stopped → "a session artifact; a reload cannot resume"; none → "no run on record". Plus the constant line: "cross-session resume: checkpoint reads are server-side — no console read seam yet (TODO(N2))." | T-107.7 / N2 — `checkpoint.server.ts` is server-only (node:fs; atomic + corrupt-safe; `RT_E_CHECKPOINT_MISSING` / `RT_E_VALIDATION`); a client import would violate the H2 no-`node:fs`-in-client rule, hence the store-level line + TODO(N2) |
| 3 | Unattended runs `:6775` | "refused by design — no scheduler/daemon host (`RT_E_UNATTENDED_UNSUPPORTED`)" | W-47 — errors.ts:508 (blockers W-01/W-02 unlanded keyed; supervised wild/gate runs remain available) |
| 4 | Token streaming `:6787` | "not wired — one-shot transport; replies render whole" | T5.1 — lib leg only (`chatStreamNdjson`); CLI has no `--stream` (grep: 0 hits); no console stream pane |
| 5 | Cassette record/replay `:6798` | "library only — no wire points; recording is not available" | T5.7 — `cassette.ts` on disk + tested, ZERO consumers; no run-eval/CLI flags; replay can never pass as live |
| 6 | Human seat `:6809` | "no console delivery seam yet — the CLI carries the out-of-band token; TODO(seat)" | R8-f09 — S4's `seat.ts` never landed (not on disk; no `RT_E_HUMAN_SEAT_UNAVAILABLE` registry entry); the approval dock's policy-fallback text is today's only seat surface |
| 7 | Isolation boundary `:6820` | "none — runs are bounded local, not OS-sandboxed; TODO(R13-f04)" | R13-f04 — no isolator shipped (`isolation.server.ts` not on disk); never labelled sandboxed |

**Byte-state basis (all verified on disk this session; full table in `fixes/281_n3_ui.md` §[t0]):** `engine.readWildPlan` EXISTS (`engine.ts:3538` — stored plan else the honest empty `source:"empty"` shape with a note naming R13-f02) · `store.wildPlanFor` (`store.ts:183` decl / `:1503` impl) · `checkpoint.server.ts` EXISTS 9,105 B, server-only by design · `RT_E_UNATTENDED_UNSUPPORTED` registered (`errors.ts:79` + doc `:508`) · `seat.ts` / `isolation.server.ts` NOT on disk (S4 capped) and their planned codes NOT in the registry → those rows name the row, never an unlanded code · console had ZERO `wildPlan` hits before this lane · tabs byte-untouched (no hunk outside the two additive sites).

**Not claimed:** the checkpoint console seam (TODO(N2)) · seat/isolation/stream/cassette wirings (labels name the unwired state, not a landed capability) · §S1–§S4 stay `_(pending)_` (the capped S-lanes' debt — NOT this lane).

<!-- END-OF-FILE-MARKER-SPRINT · every lane appends ABOVE this line · never edit or delete this line -->
