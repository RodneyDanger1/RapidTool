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

---

## §T1 — THE REGISTER'S UNTOUCHED ROWS (W31 · T1) — lane log `fixes/273_t1_register_rows.md`

**Status:** OWED SINCE W31 — T1 died capped **pre-append** (WDX-1 poll log, §WDX-1 above). Appended 2026-09-27 by **W40 K8** as the N4 → Z4 payout, verbatim from the lane log. **Source-state:** byte-verified at lane time (2026-09-26 ~18:00–18:20 CDT, tree `0f85c32` + W29/W29b/W30/E1b uncommitted edits); close-states live in §WDX-1's polls. This block is T1's record of record.

**Job (verbatim):** sweep §W27-B/C/D (`research/multiagent/thoroughanalysis.md:1144-1306`) for rows with NO lane reference; verify each in the code; land the safe ones (smallest honest patch); deliver the per-row verdict table (§T1 into `finalsprint.md`).

### T1 · VERDICT TABLE (as of lane open — the table the lane died with)

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

### T1 · STATE AT LANE DEATH (read by K8 2026-09-27)

- The `Landings` and `[EXT-FAIL] / deviations` sections were still placeholders at the K8 read — T1's own record stops at the table above. Landings visible in it: W-16 · W-23b · W-31 · W-34 · W-35 (**LANDED-BY-ME** rows). T1 stayed LIVE at WDX-1's close (18:22:55, "no finals" — §WDX-1) with its W-23b helper observed on disk (`store.ts:278`).

## §T2 — R15'S EVERYTHING-ELSE (14 rows) (W31 · T2) — lane log `fixes/273_t2_r15.md`

**Status:** OWED SINCE W31 → appended 2026-09-27 by **W40 K8** (N4 → Z4 payout), verbatim from the lane log. **Source rows:** §R15 (`research/multiagent/thoroughanalysis.md`, f01–f14) + W28-WORKLIST residual dispositions (O-6/WA-02/WA-03). Verified against today's bytes at lane time (18:00–18:30 CDT).

### T2 · ROW STATUS (final — the record-of-record)

| Row | What | Verdict | Where |
|---|---|---|---|
| R15-f01 | og/site.json share-card claim | **ALREADY-DONE (sibling, W30/S5-era + R6-f02)** — `site.json` now `"governed delivery harness"`; grep = 2 intentional guard comments only | verify-only |
| R15-f02 | auth schema never migrated (recursion) + `account` unique index | **LANDED (guard + index)** | `migrations/auth/0002_account_unique.sql` (new) · `migration-plan.mjs` helper · `migrate.mjs` + `db.ts` refusals · `errors.ts` `RT_E_AUTH_SCHEMA_MISSING` · 5 new pins in `migration-plan.test.mjs` |
| R15-f03 | ~30 unused prod deps | RECORDED (census refreshed today; prune requires full build+test → next wave) | §T2 |
| R15-f04 | tsconfig chain cannot see `scripts/**` | LANDED (staged) — `tsconfig.scripts.json` + measured error count | §T2 |
| R15-f05 | no `.prettierignore`; format unenforced | LANDED (`.prettierignore`) + RECORDED (format pass/gate row) | `.prettierignore` |
| R15-f06 | CI verdict integrity | **ALREADY-FIXED (Lane H A2-f02/R5-f01 in tree)** + residual RECORDED (SHA pins, first green run) | verify-only |
| R15-f07 | 10 root scratch probes | RECORDED (owner-only consolidation; W32 organizer live on root) | §T2 |
| R15-f08 | `.grok/` legacy map | LANDED (AGENTS.md live-reads correction) + RECORDED (94 §B1 / `.grok/status` owner calls) | `AGENTS.md` |
| R15-f09 | `.env.example` 2/~20 vars | LANDED (advanced-knobs block, census-driven) + RECORDED (CLI/platform nuance) | `.env.example` |
| R15-f10 | no version identity | LANDED (`version` + `engines` in package.json (+lock root); doctor surfacing RECORDED) | `package.json`, `package-lock.json` |
| R15-f11 | i18n boundary undeclared | LANDED (one honest-limit line in README) | `README.md` |
| R15-f12 | no a11y guard; install CSS 0 focus rules | LANDED (install-CSS `:focus-visible`) + RECORDED (axe pass) | `public/__grok/install/styles.css` |
| R15-f13 | stale unindexed docs | LANDED (HISTORICAL banners) | `attachments/RapidTool_Complete_Master.md`, `agentnotes.md` |
| R15-f14 | origin-era residue | RECORDED (removals = owner call; W32 organizer owns root hygiene) | §T2 |

### T2 · COLLISION NOTES (live-lane census, 18:01)

- `scripts/gate.sh`, `scripts/rapidtool-cli.mjs`, `README.md`, `src/lib/og/site.json`, `src/routes/*` are mid-edit by W29/W30 lanes in the working tree — my edits avoid them except README (small additive line, re-read first at edit time).
- W29 LANE H owns `scripts/**`/`package.json`/`migrations/**` but its log is stale since 17:26; S5 (17:56) is finishing W29 leftovers B/P/H/D — none of its checklist rows touch `migrate.mjs`/`migrations/auth/`/`db.ts`/`migration-plan.mjs`** geometry, so the R15-f02 landing went first.
- `package.json`/`package-lock.json`: edited by me ONLY with `version`/`engines` (no scripts block touched).

### T2 · CLOSE-STATE (from §WDX-1's poll log)

T2's wave-2 landings (all byte-verified, §WDX-1 `:175`): `tsconfig.scripts.json` (NEW, R15-f04 staged) · `.prettierignore` (NEW, R15-f05) · `.env.example` (M — advanced-knobs block, R15-f09) · `package.json` (M — `version`+`engines`, R15-f10) · `AGENTS.md` (M correction) · `public/__grok/install/styles.css` (M — `:focus-visible`, R15-f12) · `agentnotes.md` + `attachments/RapidTool_Complete_Master.md` (M — HISTORICAL banners, R15-f13). Its own measurement: "Staged scripts-program measured: **1030 errors** (cli 299, run-eval 284, tests ~280…)". T2 stayed LIVE at WDX-1's close.
## §T3 — R13'S REMAINING BEST-IN-WORLD ROWS (W31 · T3) — lane log `fixes/273_t3_r13.md`

**Status:** OWED SINCE W31 — T3 ENDED capped at 18:20:15 ("**3 of my 6 rows landed in code; the two RECORD deliverables (lane log final + §T3 appe[nd]) …**" — §WDX-1 `:212`). Appended 2026-09-27 by **W40 K8** as the N4 → Z4 payout, verbatim from the lane log. **Box (verbatim):** §R13 rows NOT covered by S1/S3/S5 — the best-in-world differentiators. Contract = W30 shell-sprint (compiles · wired to ≥1 real call site OR honest coded refusal · `TODO(<id>)` at the exact logic line · no fake behavior · additive only).

### T3 · A) TRIAGE AT LANE START (read 2026-09-26 ~18:00 CDT; finalsprint.md read fresh)

| §R13 row | Owner per finalsprint/W30 brief | T3 verdict (to verify in bytes) |
|---|---|---|
| f01 unattended (W-47/R13-f01) | S1 | NOT MINE (S1 shell pending — record only if S1 dies) |
| f02 plan-first | S1 | NOT MINE |
| f03 checkpoint/resume (T-107.7) | S1 | NOT MINE |
| f04 isolation boundary | S4 (BLOCKED-SHELL) | NOT MINE |
| **f05 running-product verification + preview** | **nobody** | **T3 — land preview shell / record E2E leg** |
| f06 MCP client (F1) | S3 | NOT MINE |
| f07 streaming (T5.1) | S3 | NOT MINE |
| f08 allow-lists (F4) | S3 | NOT MINE |
| f09 provider failover + cross-family judge | **part S3 (F2 step-2); failover+judge nobody** | **T3 — record (a) 402=done-by-P; land/record judge+failover** |
| f10 learning-loop measurement sliver (221 §F3) | **nobody** | **T3 — land Step A per spec** |
| f11 run-budget invest semantics | part S3 (ledger threading); invest/salvage nobody | **T3 — record tail (S3 mid-surgery in token-ledger.ts)** |
| **f12 gate-review surface** | **nobody** | **T3 — land cards/hash surface (console) or record precisely** |
| **f13 deploy/preview node** | **nobody** | **T3 — land per-kind DEPLOY.md handoff (scaffold.ts, cold)** |
| **f14 subagent fan-out** | **nobody** | **T3 — wire-or-de-scope: de-scope record + code marker** |
| **f15 repo index at scale** | **nobody** | **T3 — DEFER record only (221 §F5 NOT-RECOMMENDED)** |

**Live-edit evidence at lane start (mtimes, 18:01):** token-ledger.ts 18:00 (S3 mid-surgery), CLI 17:56, headless 17:50, engine 17:45, codegen 17:42, packet 17:41, compile-check 17:39, console 17:33, policy 17:29. → T3 will NOT touch token-ledger/packet/engine/headless/codegen/compile-check; console only if needed + cold enough; preferred landing files: `knowledge.ts` (14:10), `scaffold.ts` (15:27), `subagent.ts` (08:35), `registry.ts` (15:06).

**W29 leftovers verified mid-flight:** Lane P's R4-f01 (402 → `RT_E_LLM_NO_BALANCE` in openai-compatible.ts + registry.test case) present in working copy → f09(a) = ALREADY-DONE-BY-P (re-verify bytes before recording).

### T3 · B) LANE LOG (append-only — verbatim)

- [t0] Lane start. Read: `wave_plans/W31/gap-finshers.md` (full), `finalsprint.md` (fresh — §S1-§S4 still pending; S5 log exists), §R13 (`thoroughanalysis.md:495-670`), §R8 tail (`:671-739`), W30 shell-sprint contract.
- [t0] KEY: finalsprint master table covers f01/f02/f03 (S1), f04 (S4), f06/f07/f08 (S3), f09-partial (S3 F2), f11-partial (S3 ledger). Rows with NO owner: **f05 · f10 · f12 · f13 · f14 · f15** + f09's failover/judge tail + f11's invest/salvage tail. That is T3's exact scope.

### T3 · CLOSE-STATE (from §WDX-1 + WDX-1 poll notes)

Landed-in-code before the cap: **f13** (V21) · **f14** (V34, de-scope record + code marker) · **f09 failover** + `registry-failover.test` **7/7** (V30/V35). The lane-log final + this §T3 append did NOT persist — this block is the owed record.

## §T4 — THE DEFINED SPECS (W31 · T4) — lane log `fixes/273_t4_defined.md`

**Status:** OWED SINCE W31 → appended 2026-09-27 by **W40 K8** (N4 → Z4 payout), verbatim from the lane log. **Spec source:** `research/multiagent/249_define_first_specs.md` (SPEC 1 DF-09 · SPEC 2 T4.3 · SPEC 3 G4 / OV-21). The lane's job: run every pin, fix what is broken, complete the missing evidence (CLI replay, teeth proofs), record.

### T4 · §0 AS-FOUND (byte-verified before any edit, 2026-09-26)

The W31 planner's premise — "three DEFINED rows, not yet implemented" — is **stale by one wave**: W23 LANE 6 landed all three in commit `b721f9c` ("W18–W23: the code-all wave — … defined checks") under that wave's **CODE ONLY** rule ("no test/typecheck/build/lint runs"), and its lane-close record (`fixes/262` §5 landing table + the RED-by-design note) was never written. So the *code* existed; the *verification boundary* did not. This lane's job became: run every pin, fix what is broken, complete the missing evidence (CLI replay, teeth proofs), and record.

| host | state found today |
|---|---|
| `src/lib/engine.ts:1660-1675` | DF-09 guard landed: `forcedOverride` (force + P6 + `lastTest.ok===false`) + `decidedBy==="human"` + note < 12 trimmed ⇒ throws coded `RT_E_VALIDATION` |
| `src/lib/store.ts:1528-1547` | store pre-check `{ok:false, error:"… requires a rationale — at least 12 characters …"}` + forwards `note` to `approveHitl` |
| `src/components/console.tsx:2193` (= `git show HEAD:…` line 2086) | override path passes `note: force ? note.trim() : undefined` — the spec's "console half" is committed |
| `src/lib/honesty-guards.test.ts:437-550` | DF-09 block (A1/A2/A3a/A3b) — **RUN: 12 pass / 1 fail** (A2 red — a pin bug, §1) |
| `src/lib/patch.test.ts:270+` + `src/lib/patch-preservation.test.ts` | T4.3 hosts — **RUN: green** (combined leg below) |
| `src/lib/error-scan.server.ts` + `.test.ts` + CLI `scan` arm `scripts/rapidtool-cli.mjs:1932` | G4 landed — **RUN: green** |
| `scripts/README-cli.md` (`**37 subcommands**` incl. `scan` + `## Scan (scan)` section) | parity bound by `scripts/README-cli.test.mjs` — **RUN: 11/11 green** |

**Baselines run by this lane (targeted, foreground):**

- `node --experimental-strip-types --test --test-concurrency=2 src/lib/honesty-guards.test.ts` → `# tests 13 · # pass 12 · # fail 1` — the red is `honesty-guards.test.ts:473` (A2), `2 !== 0`.
- `node --experimental-strip-types --test --test-concurrency=2 src/lib/patch.test.ts src/lib/patch-preservation.test.ts src/lib/error-scan.server.test.ts` → `# tests 31 · # pass 31 · # fail 0`.
- `node --test scripts/README-cli.test.mjs` → `# tests 11 · # pass 11 · # fail 0` (count/list/USAGE parity intact).

Also verified: `scan` is **not** in `scripts/gate.sh` (0 hits) and `scanTreeErrorSignals` has exactly ONE call site — the CLI arm (`rapidtool-cli.mjs:1962`) — never `emit`, never a gate (the 218 §3.4 / OV-21 advisory posture holds).

### T4 · §1 DF-09 — the as-found RED explained, fixed, teeth proven

**The as-found failure is a PIN bug, not a guard gap.** `l6Gated()` builds its fixture via `runToGate(seedProject(), 6)` (`testing/fixtures.ts:99`), which journals decision rows for every below-target HITL gate it clears (fixtures.ts:114 `approveHitl(cur, { decidedBy: "human" })`). The fixture therefore arrives with **2** decision rows. A2 then asserted `gated.decisions.length === 0` — "a thrown refusal journals nothing" — which can never pass against a fixture that legitimately carries history. The honest pin is a BEFORE/AFTER snapshot: the engine throw must leave the input project untouched (pure-function contract), which is exactly what "journals nothing" means when the call never returns a project.

**Fix (this lane):** `src/lib/honesty-guards.test.ts:458-478` — snapshot `decisionsBefore` before `assert.throws`, assert `decisionsBefore > 0` (documents the fixture's own history so the compare is non-vacuous), then compare `gated.decisions.length === decisionsBefore` "a thrown refusal journals nothing (the input project is untouched)". Teeth unchanged: with the guard removed the call no longer throws and `assert.throws` fails FIRST — red.

### T4 · §4 THE RED-BY-DESIGN NOTE (kept honest — verbatim)

SPEC 1's A4 required the DF-09 block to be RED on the pre-guard tree and GREEN after the store+engine guard. On today's tree the guard IS landed (W23), so the honest end-state is **GREEN with mutation teeth** — the RED is reproduced as the teeth proof (guard removed in a scratch copy ⇒ block red), and the as-found red (the A2 pin bug) is recorded above with its exact cause. No assertion was weakened: the A2 fix replaces a can-never-pass literal compare with a strictly stronger non-vacuity precondition + snapshot compare. Nothing here is claimed as red that runs green, and nothing green that has not been run.

### T4 · CLOSE-STATE (from WDX-1 poll notes)

- §1.1/§1.2/§2.1/§2.2/§3.1 result slots remained `_(results appended below …)_` placeholders at the K8 read; the lane's poll trace (WDX-1): **DF-09 pin fix V27 ✓ (non-vacuous)** · **teeth #1 proven ✓** · T4 silent-flag #2 raised P10 → recovered P11–P12 and closed as a long tool call (non-stall).
## §T5 — THE OV BOARD SWEEP · THE BOARD-WIDE HONEST COMPLETION MAP (W31 · T5) — lane log `fixes/273_t5_board.md`

**Status:** OWED SINCE W31 — T5 ENDED capped pre-append ("iteration cap hit before the final append … cycle: sweep + log + probe landed; §T5 unappended" — §WDX-1). Appended 2026-09-27 by **W40 K8** as the N4 → Z4 payout, verbatim from the lane log. **Method (verbatim):** every row below was re-verified against TODAY's bytes (grep/sed/read at ~18:00–18:20 CDT), never against a log's words alone; sibling log claims were accepted only where bytes agreed (S1's "as-landed" board runs AHEAD of its bytes — WDX-1 CF-1, corroborated by me at 18:03/18:09/18:12). Deliverables: this verdict table + **NEW `scripts/docs-module-parity.mjs`** (the OV-20 advisory probe, 4,674 B).

### T5 · THE BOARD-WIDE VERDICT TABLE (as of 2026-09-26 ~18:20 CDT)

Legend: **LANDED** (bytes + landing log agree) · **PARTIAL** (one half real, the named half missing) · **SHELLING NOW** (live lane mid-landing; bytes not yet on disk at stamp time) · **BLOCKED-KEY / OWNER** (named gate) · **LANDED-BY-ME** (this lane's landings this wave).

#### A · The named board list (24 rows)

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

#### B · Supplementary canonical rows (assessed in the same pass — the rest of the board)

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

**Counts:** of the 24 named rows — LANDED 12 (ov1, ov13, ov29, ov7, df09, t43, g4 + … let the table speak) · PARTIAL 6 · SHELLING-NOW 5 (S1: T-107.7; S3: F1/F2/F4/T5.1/T5.7) · BLOCKED-KEY 3 (OV-3/4/5) · OWNER 3 (OV-11/38/39/40 → 4) · LANDED-BY-ME 2 (OV-30, OV-20).

### T5 · LANDINGS (this lane, smallest honest patches)

1. **OV-30 — registered** (register-only row; no code is its correct shape): appended `> [W31-T5]` block to `fixes/257_error_ledger_v3.md` §F registering the install-leg budget + the honest 8 GB caveat.
2. **OV-20 — advisory probe landed**: NEW `scripts/docs-module-parity.mjs`; first run output: [paste below — not persisted at the cap].
3. **Register-only residuals** (OV-13 ×2, OV-16, OV-41, OV-42, OV-43, T5.2-A, T-107.6, G5-verify): one `> [W31-T5]` block in `fixes/257_error_ledger_v3.md` §F so nothing is a silent omission.

### T5 · WHAT THIS LANE DELIBERATELY DID NOT TOUCH (live boxes)

S1: `store.ts`, `headless.ts`, `types.ts`, `engine.ts`(wildPlan) · S3: `token-ledger.ts`, `deepseek.ts`, `types.ts`(wildPolicy), `engine.ts`(F4 hunk) · S2: `scaffold.ts`, `codegen.server.ts`, `run-eval.mjs` · S5: console/routes · T4: `patch*.test.ts`, `error-scan*`, `honesty-guards.test.ts`, `engine.ts`(approve) · T1–T3: register/register-adjacent docs · W32 organizer: root docs.

### T5 · TIMESTAMPS (as-of — verbatim)

- 18:02 — `wild-review.ts` on disk; S1 checkpoint/unattended absent; WDX-1 CF-1.
- 18:09 — `case "scan"` present; verb count 37; `checkpoint.server.ts` still absent; `wildPolicy` 0; `onToken` 3 (landing).
- 18:20 (planned final stamp) — [filled in the closing pass below — not persisted at the cap; this block is the owed record].
## §WDX-2 · THE TRUTH AUDITOR OF THE SPRINT MD FILES (W31 · WDX-2) — lane log `fixes/274_wdx2.md`

**Status:** OWED SINCE W31 — WDX-2 ENDED capped pre-append ("**Iteration cap hit before the §WDX-2 append to finalsprint.md.** Everything below is backed by bytes I actually read; the audit content lives in the lane log (written early, per protocol). Nothing was fabricated." — §WDX-1 `:118`). Appended 2026-09-27 by **W40 K8** as the N4 → Z4 payout, verbatim from the lane log. **Scope:** verify EVERY entry in `finalsprint.md` is TRUE + COMPLETE against the actual bytes; anything false/overstated → correction row; missing → addition row. READ-ONLY on product code.

**BOTTOM LINE (as of the lane's audit):** master table 20/20 rows byte-checked · verdicts: 16 TRUE/accurate · 4 needing correction (RS-01..RS-04 below) · protocol: 0 violations · baseline snapshot kept at `C:/Users/mnril/wdx2_work/baseline_finalsprint.md` (md5 `b57bb4c3304efd0af4d9e5b5e08383df`, 49 lines @18:03).

### WDX-2 · AUDIT OF THE MASTER TABLE (finalsprint.md:11-32) — byte evidence

| # | Row | Claim audited | Verdict | Evidence (bytes read at audit time) |
|---|---|---|---|---|
| 1 | W-01/02/03 | status **LANDING (E1b)**; "needed after: keyed boundary run (O-1/O-4)" | **STALE (understates)** | E1b COMPLETED 17:56 (deleg_d12394b7, exit=max_iterations). Bytes: W-01 `WildStepOptions.p6Edge` engine.ts:3544 + `wildP6Edge` :3853 + guard :4047-4058 ("keyed synthesis edge"/"injected edge seam"); W-02 `runP6Edge` headless.ts:2277, `runPhase` phase-6 :368, p6Deps threading :462-475/:529-584/:619-634, console branch `viaHeadlessP6Edge` engine.ts:3394-3421; W-03 `materializeEmitTree` + `CJS_RESIDUE_RE` headless.ts:~1593-1622, wired in `emitProject` :1650; R12-f04 `WILD_STEP_BUDGET_MS = P6_PHASE_MAX_MS + 15_000` rt-events.ts:218 + `P6_SYNTH_TIMEOUT_MS = P6_PHASE_MAX_MS` codegen.server.ts:140. → Correction RS-01. |
| 2 | R14-f01 | status S1; "bind completeDeepSeek-based reviewer at store.ts:1105 + headless wild macros" | TRUE (as target) | store.ts:1105 IS the `startWildRun` wildStep loop call (`const res = await wildStep(cur);` — no opts yet); engine.ts:3527/:3538 already carries the `WildReviewer`/`reviewer?` injection point; headless wild macros at headless.ts:3714/:3895. S1 mid-flight: `src/lib/wild-review.ts` (new, 18:02) has `createNodeWildReviewer` + `TODO(R14-f01)`; call sites not yet passing it at audit time. |
| 3 | R13-f01/W-47 | status S1; refusal must name blockers | TRUE | No scheduler/daemon in repo; `scripts/unattended-shell.mjs` not yet created at audit time (S1 in flight). Register W-47: BLOCKED(ON W-01+W-02) — consistent. |
| 4 | R13-f02 | status S1; "plan exists before phase 1 mutates" | TRUE | No `wild.plan` in bytes yet at audit time (grep clean); S1's types.ts/engine.ts shells pending. |
| 5 | T-107.7 | status S1; "756s keyed journey" | TRUE | Register W-40 corroborates ("keyed journey scale 756s+"); no checkpoint subsystem in bytes yet at audit time (`src/lib/checkpoint.server.ts` absent). |
| 6 | A3-f06/R3-f06 | "today: throwing stubs, webapp-only depth" | TRUE | scaffold.ts:914-955: game block + `main(ctx)` throwing `TODO(E-15) stub: implement the service/cli entry` stubs; per-kind depth webapp/game-only. |
| 7 | A3-f05/R11-f12 | "graders … not package.json's presence" | TRUE | Register A3-f05 re-verified; graders demand scaffold presence (research/eval-corpus/graders/*.json all 7). |
| 8 | A3-f07 | "structurally out of reach today" | TRUE | `scaffold.ts` states webapp/game UI deliberately never machine-generated (register A3-f07: :2567-2570); emitted UI = names dump. |
| 9 | R3-f02/R3-f03 | "reword + redTree/partial + capability.N skips" needed | TRUE (note: (a) null-lastTest ALREADY landed) | codegen.server.ts:3305-3311 diff hunk adds `lastTest: null` in `partialTreeRefuse` (E1b/W29 W-05, R9-f02). Prompt still CJS: rule 2 "Assign module.exports" at :482 (reword pending — TRUE as needed-after). |
| 10 | T5.7 | "wired to nothing today" | TRUE | grep `selectCassette|createCassette` → module+test only (cassette.ts/cassette.test.ts); no run-eval flags. |
| 11 | T5.1 | "no --stream/SSE surface" | TRUE | No `--stream` in rapidtool-cli.mjs; `chatStreamNdjson` lib leg exists (register R8-f06). |
| 12 | F1 | "gated on the owner's trust call" | TRUE | No mcp module in src/lib at audit time. |
| 13 | F2 | "after OV-1: registry entry + key env + a wire probe" | **PARTIALLY STALE** | registry.ts ALREADY carries the `xai` second family ("F2 · W19-L5", LlmProviderId includes "xai", XAI_PROVIDER registered :201). Missing is live mint + failover + the OV-1 enablement decision (register §R8-UPDATES). → Correction RS-02. |
| 14 | F4 | "engine consult at `policy.ts:170`-class seams + wild.paused_policy events + UI surface" | **VAGUE + one FALSE sub-claim** | Overlay core IS in policy.ts (`applyPolicyOverlay` :495, `readPolicyOverlay` :383, `policyOverlayRefusal` :421) consumed ONLY by console.tsx:45/:2180/:3836 — engine/wild never consult (TRUE). But: `wild.paused_policy` is NOT a registered RT event today (0 grep hits in rt-events.ts) — it must be ADDED to the registry first; and policy.ts:170 is `parseSeatClaim`'s human-seat branch — NOT a consult seam. The real consult point is `wildApproveGate` engine.ts:3668 / the store gate-approval path. → Correction RS-03. |
| 15 | ledger | "thread ONE ledger through codegen+verify … (P lane partial-landed)" | TRUE (partial-landed corroborated) | token-ledger.ts full module (createTokenBudget :307, tokenCapFromEnv/RAPIDTOOL_TOKEN_CAP :137, "one CLI run" doc :322-328); codegen.server.ts `accountSynthUsage` :2293-2306 (cap enforcement "Session token budget exhausted"); run-eval.mjs:686-704 folds its own T-107.6 ledger. Threading of ONE budget through codegen+verify still partial — as claimed. |
| 16 | R11-f01 | "unauthenticated RCE surface on 0.0.0.0:8080" | TRUE | vite.config.ts:150 `host: "0.0.0.0"` (+ :145 "live-preview contract — don't change host/port" — S4 must reconcile honestly). |
| 17 | R11-f08 | "foreign files currently survive into a minted 'tested' tree" | TRUE | headless.ts:1722 `survivors: opts.force === true ? foreign : []` — no quarantine in bytes yet. |
| 18 | R6-f12 | status S4; "needed after: class boundary + reportRt emitter; pin: forced throw …" | **STALE (overstates the gap — most already landed)** | `PaneBoundary` EXISTS console.tsx:1633, emits `ui.pane_crash` :1648 (registered rt-events.ts:141, asserted rt-events.test.ts:82), wraps Home screen :1736-1837. Remaining: RunScreen (routes/run.$id.tsx:16) NOT wrapped + no forced-throw pin. → Correction RS-04. |
| 19 | seat | "the governance high-water mark needs a real surface"; two-channel seam | TRUE | console.tsx:458-475/:573-585 = read-only banner; "store action that would make this a human seat registered in fixes/263 §3"; flip path = `brief-fixtures.ts approveFixtureCases` via CLI `fixtures --approve`. |
| 20 | R13-f04 | "BLOCKED-SHELL … honest refusal + precise host requirement" | TRUE | No isolator seam in bytes yet; register R13-f04/T-107.8: executor swap behind `node-runner.server.ts`, claim flips only when a probe proves it. |

### WDX-2 · CORRECTIONS / ADDITIONS (RS-01 … RS-04 — verbatim from the lane log)

- **RS-01** (W-01/02/03 status): "LANDING (E1b)" → **LANDED-by-E1b in bytes** (evidence above; keyed boundary run still owed, O-1). Audit trail: E1b's OWN exit state was **PARTIAL** — final summary (deleg_d12394b7 task-0.log 17:56:03): "2 of 4 verification legs run (rt-client 14/14 green; **wild-step 13/14**)" + "two deliverables remain unfished (landing log + the headless leg)". The red pin was the keyless byte-parity test; **WDX-3 (W31) fixed it** (wild-step.test.ts:264-271 normalize extension + comment "WDX-3 (fixes/274 · W31)"); re-run by WDX-2 at 18:07: **14/14 green**. Remaining debts: (i) E1b's `fixes/271_laneE1_p0s.md` still has NO landing entries (plan checkboxes unchecked; exit=max_iterations) — the W-03 "failed-with-fixtures branch" decision the register demands is recorded NOWHERE; (ii) the headless leg (headless.test.ts W-02/W-03 pins, added 17:55) was never run by E1b and no lane has claimed it.
- **RS-02** (F2): needed-after should read: "OV-1 enablement decision; then live mint (`mintTreeRunTested` reachable for the second family) + failover; registry entry + probe ALREADY landed (W19-L5, registry.ts:116/:119/:201)".
- **RS-03** (F4): precise needed-after: (a) register `wild.paused_policy` in rt-events.ts (not present today), (b) consult `applyPolicyOverlay`/`policyOverlayRefusal` from the engine's `wildApproveGate` (engine.ts:3668) + store gate path, (c) emit the event on deny, (d) UI surface (console has the refusal rendering at :3836 already — extend).
- **RS-04** (R6-f12): status → **PARTIALLY LANDED (W29/W29b)**: boundary+emitter in console.tsx:1633/:1648/:1736; RunScreen unwrapped (routes/run.$id.tsx:16); no forced-throw pin. Needed-after = wrap RunScreen + the pin.

### WDX-2 · PROTOCOL CHECK (append-only, 0 obliteration)

- finalsprint.md is UNTRACKED in git → baseline snapshot kept at `C:/Users/mnril/wdx2_work/baseline_finalsprint.md` (md5 `b57bb4c3304efd0af4d9e5b5e08383df`) for diffing on every poll.
- At snapshot: master table intact (20 rows), §S1-S4 pending placeholders intact, marker line intact, no §S5/§T/§WDX sections yet. 0 violations.

## §WDX-3 · THE WIRING HELPER (W31 · WDX-3) — lane log `fixes/274_wdx3.md`

**Status:** OWED SINCE W31 — WDX-3 ENDED capped ("**Two wires LANDED with proofs; the §WDX-3 / lane-log appends did NOT persist (I ran out of calls)**" — §WDX-1 `:213`). Appended 2026-09-27 by **W40 K8** (N4 → Z4 payout), verbatim from the lane log. **Job:** hunt shells ONE WIRE away from working; land the smallest honest wire (targeted check); NEVER a wire that turns an honest refusal into a fake success. Log every wire: file+line · before → after · proof.

### WDX-3 · LOG (append-only — verbatim)

- [t0 ~18:02] Mandatory reads done: `wave_plans/W31/gap-finshers.md` (full), `finalsprint.md` (full — 49 lines, §S1–§S4 pending, no §WDX yet), `wave_plans/W30/shell-sprint.md` (contract), `thoroughanalysis.md` §R13 (495–670) + §R8 (671–741) in full, E1b lane log `fixes/271_laneE1_p0s.md` (skeleton only).
- [t0 ~18:05] **WIRE-1 (candidate → investigated): E1b's red pin.** `wild-step.test.ts` 13/14 — "keyless without a seam keeps the deterministic floor path byte-for-byte (parity pin)" red. Ran a byte-level classifier (`%TEMP%/wdx3_parity_diff.mjs`, targeted): 26 diffs ⇒ **25 volatile** (id/createdAt/ts/ranAt/startedAt/checkedAt/completedAt + embedded packet text inside `artifacts[3].body`) + **1 real** = the seam-naming detail string ("deterministic floor" vs "injected edge seam") which the test *intends* to mask ("modulo the seam-naming detail"). Verdict: NOT a product regression — the pin's normalize missed `phases[].completedAt` + artifact bodies (volatile class only). Fix = extend the pin's own normalize (test-side, honest).
- [t1] LANDED WIRE-1: `src/lib/wild-step.test.ts` normalize gains `stripVolatiles()` (shared with the packet replace) applied to `artifacts[].body` + `phases[].completedAt` masking. Proof: `node --experimental-strip-types --test src/lib/wild-step.test.ts` → 14/14 green (was 13/14).
- [t1] WIRE-2 verdict: **console P6 Execute already reaches the E1b edge** — `console.tsx:2165` calls `executeAsync` → store `advanceOnceAsync(configured=llmStatus||researchStatus)` → `engine.runPhaseAsync` → phase-6 keyed branch → `headless.runP6Edge`. No wire needed; recorded as verified (R8-f01(b) satisfied by the executeAsync path; `store.runP6Journey` remains the mirror face for a later UI).
- [t1] **WIRE-3 (candidate): `store.create` never threads `llmStatus.configured`** → console-created projects are `enforceDod:false` even on a keyed server (R8-f04/A1-f09). `emptyProject` already accepts `input.enforceDod` (engine.ts:1902–1903); the wire is one field at store.ts `create` (~:1169). CLEARED TO LAND pending store.ts non-collision with S1 (store.ts:1105 region is S1's) — decided: LAND (create() untouched by any lane, additive one-liner, verified fresh right before patch).

### WDX-3 · STATE AT LANE DEATH

Wires on disk = **WIRE-1** (wild-step.test.ts normalize fix; E1b's 13/14 → **14/14**, WDX-2-verified) + **store.ts W-18 spread** (the WIRE-3-class store landing) + its `store.test` pin (ran green @18:13:29). The §WDX-3 append + the lane-log final did NOT persist — this block is the owed record.

## §MASTER-CORRECTIONS — the audited corrections overlay (trust this over the master table where they differ)

**What this is:** the corrections that MUST be applied on top of the master table above when reading it. Sources: **WDX-2's RS-01…RS-04** (audit of the master table, byte evidence in §WDX-2; lane log `fixes/274_wdx2.md`) + **CF-4** (the S4 seat/isolation counter-finding — recorded in `fixes/277_l3_ui_records.md:30`, `fixes/278_p1_remainders.md` §B3/B4; cf. `wave_plans/W34/prep.md:52`). Appended 2026-09-27 by **W40 K8** as the owed N4 → Z4 payout; the master table itself is NOT edited (append-only doctrine).

| # | Row (master table) | Correction to apply | State at K8 write (byte-checked on `2fa3cd9`, 2026-09-27) |
|---|---|---|---|
| RS-01 | W-01/02/03 | Status is not "LANDING (E1b)" — **LANDED-by-E1b in bytes** (evidence: §WDX-2 row 1). Keyed boundary run still owed (O-1/O-4). E1b's own exit was PARTIAL: its landing log `fixes/271_laneE1_p0s.md` never gained entries; the headless leg was not run by E1b. | The spine is REAL on committed bytes (`2fa3cd9` "spine real"); the keyed run remains owner-gated — see `fixes/283_final_ledger.md`. |
| RS-02 | F2 | Needed-after reads: "OV-1 enablement decision; then live mint (`mintTreeRunTested` reachable for the second family) + failover". Registry entry + probe **ALREADY landed** (W19-L5, registry.ts:116/:119/:201). | Enablement + live mint + failover still owed (owner-gated on OV-1/key). |
| RS-03 | F4 | Needed-after: (a) register `wild.paused_policy` in rt-events.ts FIRST, (b) engine consult from `wildApproveGate` (engine.ts:3668) + store gate path — NOT `policy.ts:170` (that is `parseSeatClaim`'s seat branch), (c) emit on deny, (d) extend the console refusal surface (:3836). | `wild.paused_policy` **still unregistered** (K8 grep on rt-events.ts = 0); engine consult still owed. |
| RS-04 | R6-f12 | Status → **PARTIALLY LANDED (W29/W29b)**: `PaneBoundary` + `ui.pane_crash` emitter + Home-screen wrap landed (console.tsx:1633/:1648/:1736). Remaining: RunScreen wrap + the forced-throw pin. | RunScreen **still unwrapped** (K8 grep: only the Home wrap at `console.tsx:1745`; `RunScreen` defined `:1885`); pin state unverified by K8. |
| CF-4 | seat · R13-f04 (isolation) | The S4 seat/isolation seams were **claimed somewhere, absent from bytes**: `src/lib/seat.ts` · `seat.server.ts` · `isolation.server.ts` NOT on disk; `RT_E_HUMAN_SEAT_UNAVAILABLE` / `RT_E_ISOLATION_UNAVAILABLE` NOT registered. The seat surface stays the existing read-only banners; isolation is named **without an invented code**; never label a run sandboxed. (The live counter-findings CF-1 · CF-2 · CF-3 belong to §WDX-1's own bottom line.) | **STILL ABSENT at K8 write** (ls: all three files missing; errors.ts grep for both codes = 0). R13-f04 remains owner/host-gated — see `fixes/283_final_ledger.md`. |
## §C5-TRUST — 312 C5 lane corrections (fixes/312_c5_trust.md)

**CF-SE2-2 correction — the §WDX-3 WIRE-2 entry above (`finalsprint.md:576`) is FALSE on the browser host.** WIRE-2 read: *"console P6 Execute already reaches the E1b edge"* (`console.tsx:2165` → `executeAsync` → store `advanceOnceAsync` → `engine.runPhaseAsync` → phase-6 keyed branch → `headless.runP6Edge`). Re-verified by C5 on the 2026-09-29 bytes: `engine.runPhaseAsync`'s phase-6 branch is gated on `keyedDeepSeekConfigured()` (`engine.ts:3618` that day), a plain `process.env` read that is **client-false** in the browser bundle (`engine.ts:1856` — `typeof process === "undefined"` ⇒ false; no `versions.node`). The console's Execute path on the browser is `liveLayer` — **never** `headless.runP6Edge`; the E1b edge through this wire is reachable only on a keyed **bare-Node** host (tests / CLI-hosted). If a browser bundle ever DID define a keyed `process` shim, the `"./head"+"less.ts"` import (`viaHeadlessP6Edge`, `engine.ts:3593` that day) still fails in the client graph and lands the honest deterministic floor + coded row (SE2's hinge).
**Corrected WIRE-2 status: the wire exists in bytes (`runPhaseAsync` routes P6 to `runP6Edge` when keyed), but its console reach is NOT present today — the browser P6 keyed parity remains OPEN** (the R14-f01-class server-fn wire). Line numbers drift with the 312 wave (the console `executeAsync` call sat at `:2227` on 2026-09-29); all citations above were re-derived that day.

**Also filed by this lane (not finalsprint rows):** (a) CF-SE2-4's premise is falsified — `token-ledger.ts`'s `recordSpendWithinCap` EXISTS (`:533`, exported, test-pinned; added `673e349`), so the line-12 doc names a real seam; (b) the "expandBrief retries 2 attempts" claim stood in a live comment (`codegen.server.ts:2463`) and is corrected in place — expandBrief = 3 (`P6_EXPAND_MAX_ATTEMPTS`), synthesis = 2 (`P6_SYNTH_MAX_ATTEMPTS`); (c) `research/eval-out/results.json` stamped stale in place (pre-`endClass`; no read-only re-render mode exists in `run-eval.mjs`).

Appended 2026-09-29 by C5 (312) · sources: `fixes/311_se2_surfaces.md` CF-SE2-2 + C5 re-verification on the live bytes.

## §W47-RECORD-AUDIT — appended 2026-10-02 (333-2 Registrar) — the "keyed run owed / owner-gated" rows are now historical

- **RS-01** (W-01/02/03 "keyed boundary run still owed, O-1/O-4") and **RS-02** ("owner-gated on OV-1/key"):
  a keyed run has since landed and **completes P6**. The 331 wave's keyed run emitted **7 real job
  modules** (`fixes/331_0_parent.md` §2); the 332 wave's addendum records the first keyed run in the record
  to clear P6 — `P6 DoD: PASS`, `lastTest.label:"tested"`, `emit --run ok:true`,
  `leftoverJobsAreReexportsOrStubs:false` (`fixes/332_0_parent.md` §4). The account is **funded**; the
  earlier 401/402s were a stale Windows User-scope `DEEPSEEK_API_KEY` shadowing `.env` while nothing loaded
  it (register `AW45-c01`; `START-HERE.md` §CORRECTION). The **remaining** honest gap is the keyed run's
  generated-code async defect (fixed by 332-1) plus `no human-approved fixtures` / partial job coverage.
- **Counts:** the W31 snapshots ("verb count 37" at line ~521, etc.) are historical. Today (HEAD `6575669`)
  the CLI reads **39** verbs (`grep -c 'case "'`), `npm test` = **scripts 398/398 · src 2736 tests / 2726
  pass / 10 skipped**, `npm run typecheck` exit 0 (both legs), `npm run lint` exit 0 / 0 warnings. The master
  table above is left in place per the append-only doctrine; trust this section over it where they differ.

<!-- END-OF-FILE-MARKER-SPRINT · every lane appends ABOVE this line · never edit or delete this line -->
