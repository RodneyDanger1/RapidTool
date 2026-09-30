# fixes/316_h6_spend.md — H6: the spend + truth closer (T5.5 · T5.2 · T7.1)

**Lane:** H6 (headless spend envelope + cron diagnosis + lesson-consumption trace). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`.
**HEAD at entry:** `564db1f` ("V-round cured: seal provenance stored (approveHitl decidedVia one-liner), wild-seal.test.ts 10/10, forge-refused pin"). **Tree at entry:** clean; siblings live (H1/H4/H5/H7 logs at entry; H2/H3/WD3 landed during the lane) — one writer per file.
**Owns (per lane brief):** `src/lib/headless.ts` spend-envelope region (+ its pin in `src/lib/headless.test.ts`), the T5.2 verdict (host-scheduler, read-only), the T7.1 trace (grep-chain; wire only if a hop is missing). **No keyed calls. All legs FOREGROUND.**

## Scope (from `wave_plans/W43/COMPLETION-TASKS.md`)

- **T5.5** · Headless spend-envelope surfacing (OV-41 PARTIAL): the summary envelope's spend half owed · box: `headless.ts` envelope · done-when: a headless summary carries spend (`{spent, cap, stop_reason}`) + pin.
- **T5.2** · Cron `last_status:error` diagnosis (2 fires errored): root-cause + fix · box: host scheduler (no scheduler file in-repo) · done-when: both fires root-caused with the scheduler config named, or an honest external-scheduler verdict recorded.
- **T7.1** · The lesson-consumption trace: mint site → packet → synthesis prompt · box: `engine.ts`/`packet.ts`/`codegen.server.ts`/`knowledge.ts` · done-when: a grep-proven chain showing minted rows reaching the next synthesis input, OR the named missing hop logged.

## Status board

- [x] T5.5 — summary envelope carries `{spent, cap, stop_reason}` from the session ledger (additive field) + pin — **LANDED** (evidence below)
- [x] T5.2 — cron root-cause done (verdict below); config OR verdict written — **DONE (verdict)**
- [x] T7.1 — grep-chain proven, executed probe exit 0 — **PROVEN** (evidence below)
- [x] Gates — scoped (all foreground): headless **104/104** · token-ledger+packet **93/93** · next-action-arm-parity **4/4** · lint **0 errors** (1 pre-existing warning, `wild-seal.test.ts`) · `tsc --noEmit` clean **except ONE sibling in-flight red**: `engine.ts:4012` (H3's 180-line wild-edge wire — not this lane's file)

## T5.2 — Cron `513c8746d96e` verdict (read-only, from the host store)

**Evidence (all read-only):**
- `~/AppData/Local/hermes/cron/jobs.json` — job `513c8746d96e` "RapidTool 6-coder improvement round": `schedule {kind:"interval", minutes:30, display:"every 30m"}`, `repeat {times:null, completed:15}` (∞), `provider_snapshot:"xai-oauth"` / `model_snapshot:"grok-4.6"`, `state:"paused"` (`paused_at 2026-09-29T17:56:47`), `last_status:"error"`, `last_error`: HTTP 402 `personal-team-blocked:spending-limit` ("run out of credits or need a Grok subscription").
- `hermes cron list --all` — same record ("paused · every 30m · repeat ∞ · last run error: HTTP 402 …").
- `hermes cron runs 513c8746d96e` — **15** durable executions, ALL `failed`, ALL the identical 402 error (08:35:45 → 17:43:16; ~30-min cadence).
- `~/AppData/Local/hermes/logs/agent.log` — per-fire: `cron.scheduler: Running job …`, `credential_pool: marking device_code exhausted (status=402), rotating` → `no available entries` → `Non-retryable client error: Error code: 402 - personal-team-blocked:spending-limit` (provider `xai-oauth`, `base_url=https://api.x.ai/v1`, `model=grok-4.6`).
- `executions.db` — each fire: `claimed_at ≈ started_at` (≤40 ms), finished in 0.7–2.5 s. No fire attempted while paused (`fire_claim` null; last fire 17:43:16 < pause 17:56:47).

**Root-cause:** every fire reached the provider and was refused **HTTP 402 spending-limit** by the xAI account (credits/subscription exhausted) — an **external funding state**, not a scheduler defect. The job's firing config is **sound**: recurring interval "every 30m" (the bare-`25m` one-shot parse class is NOT present; `repeat.times:null` ⇒ forever), prompt cadence fired on schedule.
**Hypotheses disposed (both NO):** · *paused-vs-fire contention* — pause (17:56) came after the last fire (17:43); no fire row while paused. · *one-shot parse* — stored spec is `kind:"interval"`, not a one-shot; 15 fires prove recurrence.
**Fix path (owner action, external):** (a) fund the xAI account / Grok subscription, or (b) re-point the job's provider+model to a funded provider before resuming, e.g. `hermes cron edit 513c8746d96e --provider deepseek --model deepseek-v4-flash` (owner call; not made here). Resume only after funding: `hermes cron resume 513c8746d96e`. Keep paused during manual waves (one-tree collisions — MEMORY).
**Operational gotchas recorded:** · `hermes cron list` (no `--all`) HIDES paused jobs ("No scheduled jobs") — read with `--all`. · `hermes cron status` warns "Gateway is not running" while the cron ticker is demonstrably alive (`cron/ticker_heartbeat` fresh) — the ticker, not the messaging gateway, fires; verify heartbeat before trusting a fire.

## T5.5 — summary envelope spend half: LANDED

**Change (additive — no existing key touched):**
- `src/lib/headless.ts` — imports `sessionTokenBudget` (token-ledger.ts) + `packetBudgetBoundary, type PacketBudget` (packet.ts); packet.ts was already in the CLI graph via engine.ts — no cycle, both modules client-safe/pure (no node:fs).
- `ProjectSummary` gains `budget: PacketBudget` — the SAME triple KEY and semantics as the packet envelope's `budget:` block (F2-04): `{spent: totalTokens(ledger), cap: number|null, stop_reason: "budget_exhausted"|null}`; `cap: null` states unmetered EXPLICITLY (CF-SE2-3a), `stop_reason` fires only on a strict `>` crossing (landing exactly on the cap stays ok). Always present: `sessionTokenBudget()` lazily creates the budget, so the reader's null arm is unreachable; the documented floor keeps the key always-present.
- `summary()` computes it through packet.ts's ONE boundary reader (`packetBudgetBoundary(sessionTokenBudget())`) — one semantics, no drift between the two envelopes. Read-only: never spends/records/throws.
- Every `h.summary(...)` consumer (CLI `summary`/`run`/`gate`/`approve`/`reject`/`retry`/`unattended`/`wild` envelopes; agent consumers) now carries the spend half.

**Pin (`src/lib/headless.test.ts` — new describe "fixes/316_h6 (T5.5) …", 3 tests):** unmetered ⇒ explicit `{0,null,null}`; recorded spend no cap ⇒ `{150,null,null}`; cap=100 landing exactly ⇒ `{100,100,null}`, one token past ⇒ `{101,100,"budget_exhausted"}`. Env + singleton saved/restored per test.

**Live smoke (real CLI, keyless):**
- `node --experimental-strip-types scripts/rapidtool-cli.mjs summary --project w1-source-project.json` → `budget {"spent": 0, "cap": null, "stop_reason": null}`
- `RAPIDTOOL_TOKEN_CAP=424242 … summary …` → `budget {"spent": 0, "cap": 424242, "stop_reason": null}` (env → session accessor → envelope proven live)

## T7.1 — the lesson-consumption trace: PROVEN (chain complete; no hole to wire)

Grep-chain with real line hits (run against the working tree at HEAD `564db1f` + this lane's edits):

| Hop | Site | Line-hit evidence |
|---|---|---|
| Mint | `engine.ts` L1 (P0 seal) | `:575-581` `vagueBriefLesson(project, absent)` mint → `:632` into result memory → `:1468` `memory: dedupeMemoryIds(accrueReproducedCounts([...result.memory, ...primed.memory]))`; `lesson.capture` log `:654-661` |
| Mint | `headless.ts` L2/L5 | `:999-1021` `templateEmissionLesson` → `memory: [...(finalProject.memory ?? []), l2]` `:1010`; `:1051-1066` `runSummaryLesson` → memory `:1055` (both `lesson.capture` logged) |
| Mint builder | `knowledge.ts` | `:953-987` `lessonRow()` — id `lesson-<classShort>-<fnv8>`, tags always carry `lesson` (`:970-977`) |
| Packet | `packet.ts` compile | `:558` `memoryRows = project.memory ?? []` → `:593` rankPool → `:594` `fusionRank(...)` → `:838` `## Ranked memory (A2 FusionRank)` renders the ranked rows |
| Synthesis | `codegen.server.ts` | `:2944-2951` expansion read-back · `:3027-3034` single-module prompt · `:3361-3367` chunked-tree prompt — all `lessonLinesForBrief(brief, selectLessons(project.memory ?? [], 6, EXPAND_LESSON_RANK_LIMIT))` → `p6SynthesisUserPrompt` / `p6SynthesisChunkUserPrompt`, rendered as the `PRIOR LESSONS` block `:1491-1496` |
| Selectors | `knowledge.ts` | `:1028-1049` `selectLessons` (lesson-tag filter, phase-6 preferred, score-desc); `:90-134` `rankBriefLessons` / `lessonLinesForBrief` |

**Executed probe** (`probe-h6-lessonchain.mjs`, keyless/deterministic, exit **0**): a real row minted via `knowledge.lessonRow` → `memoryCarriesRow: true · packetCarriesLesson: true · lessonLines: 1 · linesCarryLesson: true · promptHasPriorLessonsBlock: true · promptCarriesLesson: true` (row `lesson-template-emission-8eedcc92`).

**Existing pins on the hops:** `codegen.server.test.ts:596-628` (lesson lines reach `deps.expand`; lesson-free memory keeps the 2nd arg `undefined`) · `:963` (nonempty lessons append `PRIOR LESSONS`; empty keeps legacy bytes) · `knowledge.test.ts:360-380` (lessonRow ids/tags) · `:433-460` (selectLessons) · `:600-610`, `:891-892`, `:970` (mint builders) · `:1024-1030` (lessonLinesForBrief).

**Verdict:** minted lessons DO reach the next synthesis input — every hop wired and pinned; nothing missing, nothing newly wired by this lane (trace-only, as scoped).

## Log (append-only, timestamped)

- [t0] Entry: HEAD `564db1f` confirmed; clean tree. Sibling untracked logs visible (316_h1/h4/h5/h7). This log written FIRST.
- [t1] Cron recon complete → verdict above (T5.2 DONE).
- [t2] T5.5: `packet.ts` already ships the exact triple (`packetBudgetBoundary` F2-04: `{spent, cap, stop_reason}`, stop_reason fires only via `isBudgetExhausted` strict `>`; present-but-unmetered stated as `cap:null`). `headless.ts` `summary()` (line 1467) has NO spend field — the owed half. Mirror the same triple, sourced from `sessionTokenBudget()` (the T-107.6 process session accessor; `recordSessionSpend` E2 is its recorder).
- [t3] T7.1: codegen read-back visible at 3 synthesis sites (`codegen.server.ts:2944` legacy expand, `:3027` single-module prompt, `:3361` chunked-tree prompt) via `selectLessons` + `lessonLinesForBrief` from `project.memory`. Need: mint-side proof (engine seal mint → memory) + packet-side proof (compile renders lesson rows) with line hits.
- [t4] T5.5 LANDED: `headless.ts` (imports + `ProjectSummary.budget` + `summary()` compute via `packetBudgetBoundary(sessionTokenBudget())`), pin = 3 tests in `headless.test.ts`. CLI smoke green (unmetered `{0,null,null}`; `RAPIDTOOL_TOKEN_CAP=424242` → `{0,424242,null}`). Hops: codegen knowledge.test/codegen.server.test pins verified by grep (see T7.1 section).
- [t5] T7.1 PROVEN: full grep-chain table above (mint L1 engine :575-581/:632/:1468, L2/L5 headless :999-1021/:1051-1066, packet :558/:593-594/:838, synthesis :2944/:3027/:3361 + PRIOR LESSONS :1491-1496) + executed probe `probe-h6-lessonchain.mjs` exit **0** + existing per-hop pins named. No wire needed.
- [t6] Scoped gates: headless **104/104** · token-ledger+packet **93/93** · next-action-arm-parity **4/4** · lint **0 errors** (1 pre-existing warning) · `tsc --noEmit` = single red `engine.ts:4012` — H3's in-flight 180-line wild-edge wire, **not this lane's file** (tsc reports the whole program; no error in headless.ts/headless.test.ts). Parent: full gate at the boundary after H3 lands.
- [t7] Coordination note: H3 also writes `src/lib/headless.ts` (disjoint region: the wild P6 edge fn vs this lane's imports+summary). Verified both edits coexist in the working tree and the headless leg is green after H3's edit. Probe kept at repo root (`probe-h6-lessonchain.mjs`) as evidence (repo probe-file convention). No commits (parent banks).
