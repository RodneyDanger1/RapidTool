# 95 — LEAPFROG Continuation: post-wave gap + continuation plan + acceptance scorecard

- **File:** `research/multiagent/95_leapfrog_continuation.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`).
- **Pass / agent:** 2026-09-06 · Flash planner **A2 (LEAPFROG CONTINUATION)**. **Strictly read-only on RapidTool source** — this file is the only output. Sibling planners may own 94/96 concurrently (neither was on disk at this pass's tail check, 17:19 CDT).
- **Mission:** re-derive the competitor-superiority gap **post-waves**, accounting for the **in-flight Pro wave** (`deleg_ee964d63`, three Pro fixers, started 2026-09-06 17:13, **still running at this pass's 17:19-17:22 snapshot**) and the earlier same-day fix waves (P-A/P-B Pro lanes, M-08, audit-88, implementationSpec, chatLog foundations). Output = the remaining P0/P1/P2 items needed to be SUPERIOR to Codex / Cursor / Devin / Bolt / Lovable / v0, the shipping-grade definition of the five axis-win accelerators, the final acceptance suite ("superior to all of its kind" in testable terms), and one recommended execution order.
- **Method / 0-hallucination rule:** every internal RapidTool claim is `file:line`-verified against on-disk bytes **this pass** (terminal grep/sed/read, 2026-09-06 17:19-17:22 CDT). Every competitor claim is **inherited** from 90_LEAPFROG.md's same-day registers ([Cx]/[Dx]/[Gx]/[Ax] from 42; ✓TODAY pages from §8/§9.8/§10.7/§12.7; [F#]/[H#]/[Q#]/[Q2-#]) — **not re-fetched this pass** (flagged honestly in §6). In-flight wave items are marked **PENDING** with the owning delegate task; nothing pending is scored as done.
- **Anchor recency:** this pass is the newest measurement of `src/` — line numbers below win over all earlier sections (90 §11.2 rule 2). The in-flight wave edits `src/lib` while this file is written: anchors are accurate at the stamped snapshot time, ±drift afterwards.

---

## 1. Post-wave gap re-derivation — what the accumulated waves CLOSED vs what remains

> Snapshot: 2026-09-06 17:22 CDT. Earlier waves = P-A/P-B Pro lanes (~15:05-15:16, `fixes/100_profix_P0.md` / `fixes/101_profix_loop.md` headers exist but their FIX logs are empty — the log discipline lagged the code), M-08 write-back, audit-88 verify retry, audit-31 wild convergence, chatLog foundations, implementationSpec. **In-flight wave = `deleg_ee964d63` (3 tasks, status "running"):** T0 = P-A3 "WIRE THE CODEGEN CORE" (`codegen.server.ts` NEW + engine P6 + verify/wild seams); T1 = P-B3 "FINISH THE LEARNING LOOP" (prompt-engine lesson injection, vault/harvest lesson writers, report-intake stamps); T2 = P-C3 "WIRE THE UX/VERIFICATION TAIL" (chat ticker, Oracle-tab verify visibility, RT_E seam + inventory test, chatLog UI persistence).

### 1.1 LANDED — verified on disk this pass (waves closed these)

| Item | Where it landed (verified this pass) | What it closes |
|---|---|---|
| `p6-brief-fit` DoD probe (90 §10.5 Phase-0 #1, 88 §7.1-7) | `dod.ts:199` (additive AFTER `p6-verified` :172; `p6-test` floor :145, `p6-artifact` :159) | P6 can no longer seal without brief-conformance evidence; the DF-01 toy's gate path |
| `p0-brief-grounded` probe + `briefHasVocabulary` (Phase-0 #2 probe half) | `dod.ts:34` (`briefHasVocabulary`), `dod.ts:80-83` (probe: vague ∧ vocabulary-carrying brief ⇒ unmet) | "vague must block" for non-empty briefs (87 H1, 88 §7.1) |
| Capability ledger + B-18 honesty tail (Phase-0 #4 half; DF-04/06) | `dod.ts:453` (`CAPABILITIES`), `:493` (`capabilityLine`), `:501` (`b18Tail`) | Unimplemented-capability-as-fact gets a machine-readable declaration surface |
| `implementationSpec` on Project + engine consumption | `types.ts:352`; `engine.ts:438` (P3 dataFlow), `engine.ts:682` (P6 spec) | 86 §4-4 / 87 S7 "expandBrief output never persisted" — CLOSED |
| M-08 memory write-back (G-39) | `report-intake.ts` M-08 block (applyReport → semantic+episodic rows, dedupe, `slice(-80)`; 90 §10.1 P0-5 half) | The §2/§5-stale "write-back missing" row |
| L2 template-emission lesson capture (98 writer 2(a)) | `report-intake.ts:344-347` (content-addressed lesson row, source "agent-report", `lesson.capture` ledger event; dynamic-import seam `:44-58` keeps node:fs out of the client bundle) | H43-P3-3; 86 §1's failure class now self-captures |
| Lesson decay + supersede (89/§9.3 evaluate stage) | `knowledge.ts:51` (`counterEvidence`), `:54` (`supersededBy`), `:256` (decay = 0.5^counterEvidence), `:408-431` (`counterOf`/supersede ledger, idempotent-safe) | The "no competitor ships eviction" gap (90 §9.2) — now on disk, keyless-deterministic |
| Prompt-engine lesson injection (98 §5 Tier 3) | `prompt-engine.ts:131/149/183-186` (`expandBrief(brief, policies?, lessons?)`), `:198-209` (advisory-only list, omitted lessons ⇒ byte-identical) | 90 §9.3 Tier-3 retrieval half |
| Verify lint advisory (90 §14.6 #2, Pillar 4 B4) | `verify.server.ts:284` (`lintFailures`), `:324` (`formatLintSummary`), `:524-543` (evidence string carries `; lint advisory: …`; repair loop stays the only fixer) | Partial: lint findings visible in evidence — **not** a blocking gate yet |
| audit-88 one-bounded verify parse retry | `verify.server.ts` (per 90 §9.7) | 88 §5.11's no-retry crash path |
| audit-31 wild convergence (re-stamp on wild advance) | `engine.ts:2580-2600` (`recordGateInto` + `stampPacket` before `wildLeavePhase`) | P6 stale-gate/packet re-stamp in wild |
| chatLog persistence foundations (P0-2 half) | `types.ts:343` (`chatLog?: ChatLogRow[]`), `:368` (`ChatLogRow`); `store.ts:74/1310-1316` (`appendChatRows`, cap 40); `store.ts:566-578` (H4 quota-salvage); `console.tsx:4420-4499` (UI persistence + ≤12-row render) | 90 §3 row 3 (persist chat) — UI + store + type all present |
| Chat liveness ticker | `console.tsx:4439` ("99 §2.4.1: honest liveness ticker — live elapsed counter") | The busy-pulse placeholder (90 §3 row 1 partial) |

### 1.2 PENDING — in-flight wave (`deleg_ee964d63`), do not count as done

| Item | Owner | Transcript evidence (last activity ~17:19) |
|---|---|---|
| **`src/lib/codegen.server.ts` (liveP6Synthesis) — file does NOT exist yet** | T0 / P-A3 | `ls src/lib | grep codegen` → empty at 17:19. P-A3 finished recon (engine P6 region 581-689, runPhaseAsync/runP6Real 2091-2134, applyPhaseResult 933-1052, verify.server.ts, deepseek.server.ts) and was building the test harness (`fixtures.ts` read at 17:19:49). Not landed. |
| Engine P6 live-generation path + verify/wild convergence seams | T0 / P-A3 | P-A3 note: "P0-08 holes A & B are still open in engine.ts (lines 2391, 2581)" — pre-wave numbering; still open at snapshot. |
| Vault/harvest lesson writers + remaining report-intake stamps | T1 / P-B3 | Prompt-engine injection verified landed (above); vault/harvest writers not yet patched at snapshot (P-B3 last seen reading vault.test.ts at 17:18:04). |
| Oracle-tab verification visibility (verify.server.ts is UI-invisible, 93 DF-16) | T2 / P-C3 | `console.tsx:2321-2332` still renders the case list with "No oracle cases — run a phase…" and zero verdict UI at snapshot; **no `verify` button exists in console.tsx** (grep empty). |
| RT_E seam completion + inventory test (99's RT_E coverage) | T2 / P-C3 | `errors.ts:22-37` still lists exactly **14 codes** at snapshot; no inventory code/test landed. |

### 1.3 OPEN — no landed code and no in-flight owner (the continuation plan's real workload)

| # | Gap | Verified absence (this pass) | Why it still loses (competitor evidence inherited from 90) |
|---|---|---|---|
| G1 | **Streaming chat + stop/steer** (P0-1) | `deepseek.server.ts:233` `stream: false` unchanged; no `streamDeepSeek`, no AbortController in ChatPane | Codex `codex.sse_event` [C2]; Gemini `--output-format stream-json` [✓TODAY 90 §8]; Cursor Enter/Cmd+Enter steering [✓TODAY] |
| G2 | **LEX consumer/dev-tool register** (Phase-0 #2 LEX half) | `algorithms.ts:24-111` — grep for `rename|kanban|regex|cli` hits only "clinician"/"client" (false positives); the register still has zero CLI/library/dev-tool terms | 86 §6-C, 87 H1: vocabulary-starved briefs → `deliver-core-workflow` fallback → wrong product |
| G3 | **approveHitl note guard** (Phase-0 #3 / P0-06 engine half) | `approveHitl` (engine.ts, read this pass) still accepts `note: undefined` on approval; no ≥12-char guard | 87 S2: "Reframe the brief" approved in ~15 s with `note:null` |
| G4 | **`enforceDod` default decision** (Phase-0 #4 / 90 §10.2 #3) | Advisory-by-default unchanged; no explicit flip-and-date decision anywhere (90 §13.5.4's flag-expiry discipline absent) | 86/88 runs sealed 13/13 with `passed:false` gates |
| G5 | **Orphaned-trio wiring** (Phase-0 #4: `algo-tools.ts`/`arch-tools.ts`/`gate-stats.ts` → dod criteria) | No engine/dod/store import of the trio (90 §10.1 P1-1, re-verified this pass: dod.ts has only p6-*/p0-* probes) | Claude Code Stop hooks + `/goal` evaluator [✓TODAY]; Copilot runs tests/linters in-env [✓TODAY] |
| G6 | **Eval harness** (`npm run eval`, Phase-0 #5, 93 DF-38) | `package.json:9-21` scripts = dev/build/typecheck/check:auth/test/lint/format only — no `eval`, no `ci`, no `test:cov`, no `audit:deps` | SWE-bench grader pattern [F11]; OpenAI "evals before features" [F10] |
| G7 | **Checkpoints per wild step** (P0-3, delta-snapshot re-spec) | No `checkpoints`/`restoreCheckpoint` anywhere (types/engine/store) | Gemini shadow-git `/restore` [G4]; Cline checkpoints [✓TODAY] |
| G8 | **Plan-first Wild Mode** (P0-4 + P1-6 one change set) | No `wild.plan` event, no `autoPlan` in engine (grep empty); `planning.ts` still crew-only | Codex `/plan` [C1]; Cursor Plan Mode [✓TODAY]; Antigravity Planning Mode [A1]; Copilot plan artifact [✓TODAY] |
| G9 | **Critique persistence G-25 + L1/L3/L4/L5 writers** (P0-5 second half) | `verify.server.ts` `verifyAndFixServer` exit paths carry no `{symptom, hypothesis, fix}` critique artifact; no L1 (vague-brief), L4 (verified procedure / procedural-kind first writer), L5 (user-correction) rows | Devin "reads past session trajectories" [✓TODAY]; Reflexion/ExpeL patterns [89 S13] |
| G10 | **Cross-project wiring** (P0-5 third half) | `knowledge.ts injectProven` + `headless.ts:1476-1483` (`knowledgeSave/Find`) still have **no production consumer** (CLI only); Tier-1 packet injection and Tier-2 vague-brief brake not wired | Devin Knowledge trigger-recall [✓TODAY]; the §9.3 loop's retrieve half |
| G11 | **Executable oracle closes `p6-test`** (P1-1 core: machine evidence blocks advancement) | `verify.server.ts:503-577` `verifyAndFixServer` persists nothing into gates; `runCases` evidence not threaded into `dod.ts:145` probe | The single highest-leverage item in the whole register (90 §3 row 5, impact 10) |
| G12 | **Property/metrics/arch gates + secret scan** (P1-1 rest; §14.6 #1) | No fast-check-style property criteria, no `complexityOf` criteria, no `dependencyGraph` cycle check in dod.ts; no `p6-secrets` probe; "never emit secrets" is prompt prose only (`crew.server.ts:86-108`, `packet.ts:336`) | Claude Code Stop hooks [✓TODAY]; gitleaks pre-commit [Q2-7]; Aider auto-lint [Q2-15] |
| G13 | **Trace recorder + replay** (P1-2, DB/vault-backed re-spec) | `tracing.ts` pure model still has zero engine/crew/verify recorder call sites; no snapshots; no replay (90 §10.2 #6 C-1 re-spec unmet) | OpenHands replay [G-40]; Copilot "every step… viewable" [✓TODAY] |
| G14 | **Approval-diff UI / evidence tree / checklist** (P1-3) | HITL dock still prose prompt + note input; no artifact diff cards, no per-phase review checklist (§14.6 #8) | Antigravity Review Changes [A2][A3]; Cursor Agent Review [✓TODAY] |
| G15 | **Permission allowlist + ADR minting** (P1-4) | No `wildPolicy`; binary `forceHuman` (`engine.ts:2316+` region); `arch-tools.ts adrRecord` unwired | Antigravity `action(target)` allowlists [A5]; Codex `approval_policy` [C5] |
| G16 | **Context meter + compaction chip** (P1-5 S4) | `chat.server.ts:48` 2 500-char budget still invisible in ChatPane header | Codex "100% context left" [C3]; DSH 0.8/0.16 compaction [D6] |
| G17 | **Fresh-model/pro-tier refutation pass** (P1/§14.6 #4) | `crew.server.ts` ROLE_SPECS all flash; reviewer same-tier same-context as tester | Claude Code verification subagent [✓TODAY]; Codex `auto_review` [C2] |
| G18 | **P2 breadth** (conditional runtime, MCP through phase machine, MCP/ACP server, git/vault export, catalogs, preview) | All absent (90 §10.1 P2-1…P2-6 unchanged) | Devin fleets [✓TODAY]; DSH MCP naming [D6]; ACP consolidation (OpenHands/Cursor/DSH ✓TODAY) |
| G19 | **Production gates on the repo itself** (90 §13.10 rows 1-12) | No `npm run ci`, no coverage floor, no `check-fix-register.mjs`, no domain eslint rules, no golden packet locks, no corpus seeding | Every mature-team practice [Q1]-[Q20] — zero-dep first steps all specified |
| G20 | **Null-note approval mirrors** (P0-06 store/headless/UI halves) | Engine guard absent (G3); store/headless/console mirrors therefore not landed either | 88 §4.11 class |

**Reading the post-wave gap:** the waves converted the *plan* into probes (p6-brief-fit, p0-brief-grounded, capability ledger) and the *loop's skeleton* (decay, supersede, L2 capture, Tier-3 injection) — i.e. the machine now **detects** the wrong-product class and **records** it, but the *consumption* edges are still open: G5/G11 (evidence → blocking gates), G9/G10 (lessons → next run's prompt), G6 (the measurement that proves any of it works). The parity face (G1 streaming) and the safety face (G7/G8) are untouched by any wave. That ordering gap is exactly what §5's execution order fixes.

---

## 2. LEAPFROG CONTINUATION PLAN — remaining items to be SUPERIOR

> Format per item: **capability → who has it → RapidTool current state (file:line) → concrete step → effort/impact → kill criterion.** Effort S ≤ half-day, M ≤ 2 days, L > 2 days (90 §3 scale, §10.1 re-costing applied). Competitor evidence inherited from 90's ✓TODAY registers. PENDING items are listed first because they gate the rest.

### 2.1 In-flight wave (finish it — these are already staffed)

| # | Item | Owner | Landing check (do not start downstream work until) |
|---|---|---|---|
| W-0 | `codegen.server.ts` liveP6Synthesis + engine P6 wiring + P0-08 holes A/B + verify/wild seams | P-A3 (T0) | File exists; `npm run typecheck` clean; a brief-faithful keyed generation passes `p6-brief-fit` on a live-proved run; gates green. **Kill:** if the live path can't pass p6-brief-fit honestly, keep the deterministic floor and mark the live path `RT_E_LLM_NOT_CONFIGURED`-grade (never a silent fallback) |
| W-1 | Vault/harvest lesson writers + report-intake stamp completion | P-B3 (T1) | Lesson rows appear in vault phase spine; harvest writers tested; `fixes/101` fix log non-empty. **Kill:** lesson noise guard — a bad row injected into P6 is worse than none (90 §9.6.1); keep advisory-only law |
| W-2 | Oracle-tab verification visibility + RT_E seam + inventory test | P-C3 (T2) | Verify verdicts render in the Oracle tab; the RT_E inventory code lands with its test; chatLog UI persistence confirmed. **Kill:** any RT_E code without a doc row fails `errors.test.ts` (existing law) |

### 2.2 P0 — truth wave completion + trust wave (do now, ~1 week, after W-0…W-2 land green)

| # | Capability | Who has it | Current state | Concrete step | Eff/Impact | Kill criterion |
|---|---|---|---|---|---|---|
| P0-A | **LEX consumer/dev-tool register** (G2) | Every competitor ships whatever brief it's given (no fixed-vocab fallback trap) | `algorithms.ts:24-111` zero CLI/library/dev-tool terms; `p0-brief-grounded` probe (dod.ts:80) now *fails* such briefs honestly | Add job/object/constraint terms for cli/library/webapp/game/consumer from 91/92's kind taxonomy (86 §6-C, 88 §7.1-1/2); keep fallback honest | S / 9 | `intentLattice` stops returning `deliver-core-workflow` for every non-empty brief with real vocabulary; RenamePro/StatKit briefs no longer `vague:true` |
| P0-B | **approveHitl note symmetry** (G3) | — (this is the anti-pattern nobody else even sees) | `approveHitl` accepts null note | ≥12-char note on approvals of `forceHuman` gates + gate-override approvals (ADR-002 mirror, 87 S2); land mirrors in store/headless/UI in the same change set | S / 8 | Null-note reframe approval impossible at every layer (engine throw + store + UI) |
| P0-C | **`enforceDod` default decision** (G4) | — (governance law is the differentiator) | Advisory default, silent advance | Decide explicitly: flip default to true with a dated expiry flag (90 §13.5.4), or make unmet-gate advance a *loud, ledgered, surfaced* event. Write the decision into `fixes/` | S / 9 | A corpus run with `passed:false` gates cannot reach `complete` without a recorded, noted human override |
| P0-D | **Wire the orphaned trio + eval harness** (G5+G6) | Claude Code Stop hooks [✓TODAY]; SWE-bench pattern [F11] | `algo-tools.ts`/`arch-tools.ts`/`gate-stats.ts` consumer-less; no eval script | (1) dod.ts criteria consuming `complexityOf`, `dependencyGraph` (named cycle fail), gate-stats health; (2) `npm run eval` over the 86/87/88 corpus briefs → headless run → machine-scored conformance → verdict; (3) `npm run ci` = typecheck→lint→test→check:auth→audit:deps→test:cov (90 §13.10 #1-2) | M / 10 | `npm run eval` prints a per-run conformance score; baseline = RenamePro ≈1/10; **wrong-product `complete` = 0** |
| P0-E | **Streaming chat + stop** (G1) | Codex [C2]; Gemini [✓TODAY]; Cursor [✓TODAY] | `deepseek.server.ts:233` stream:false; no AbortController | `streamDeepSeek` AsyncGenerator beside `completeDeepSeek`; NDJSON `chatStreamServer` beside `chat.ts:17`; Stop = AbortController in ChatPane (ticker already landed at console.tsx:4439); keep honesty envelope (streaming errors → `RT_E_*`, never partial fabrications) | M / 10 (parity, not moat) | Tokens stream end-to-end in a live turn; Stop cancels the fetch and leaves an honest `RT_E_*` row; keyless path unchanged |
| P0-F | **Delta checkpoints per wild step** (G7) | Gemini `/restore` [G4] | No checkpoint type; wildLog irreversible | Artifact/memory-level content-hashed deltas (NOT full-JSON — ≈84-92 KB/project would be ~0.9 MB×10 in the hosted DB, 90 §10.1 P0-3 caveat); `restoreCheckpoint` = ledgered `wild.restore` event | L / 8 | Restore replays to the same gate verdict; restore itself is a ledger event |
| P0-G | **Plan-first Wild Mode** (G8) | Codex `/plan` [C1]; Cursor Plan Mode [✓TODAY]; Copilot plan artifact [✓TODAY] | `wildStep` (engine.ts:2492) executes-then-reviews; `planning.ts` exists but crew-only | Emit `wild.plan` from `wildStep` pre-execute using `planning.ts`'s step shape; classifier reviews the **plan**; pause unless `autoPlan`; store plan rows on Project (P1-6 = same change set) | M (re-costed S-M, 90 §10.1) / 9 | No execution without an approved plan or explicit `autoPlan`; plan labeled template-vs-real (93 DF-07) |
| P0-H | **Critique persistence + L1/L3/L4/L5 writers + cross-project wiring** (G9+G10) | Devin trajectory reading [✓TODAY]; Reflexion [89 S13] | verify exits persist nothing; L2 only capture landed; `injectProven` consumer-less | (1) `verifyAndFixServer` failed-exit → `{symptom, hypothesis, fix}` critique artifact threaded into next `generateCases` prompt (87 H6 grounding); (2) L1 at the vague-lattice site (algorithms.ts:200 region), L4 at `recordGateInto` (dod.ts:362), L5 at HITL decision seams; (3) Tier-1: packet FusionRank query + `injectProven` (knowledge.ts:302) rows; Tier-2: top-2 `[vague-brief]` rows into the reframe HITL prompt | M / 9 | Attempt N+1's packet "Ranked memory" (`packet.ts:292`) demonstrably contains run N's lessons; next verify prompt contains attempt N's critique |
| P0-I | **HITL-gated cross-project promotion** (with P0-H) | Devin Knowledge Suggestions [✓TODAY] | `savePattern` CLI-only; no HITL surface | "Proposed knowledge — edit/dismiss/promote" in the HITL dock + vault edit surface (90 §9.3 HITL path; vault already renders memory) | S / 7 | A human accept is the ONLY path to cross-project `savePattern`; every promotion is a ledger event |

### 2.3 P1 — verification lattice + governance UX (next, ~2 weeks)

| # | Capability | Who has it | Current state | Concrete step | Eff/Impact | Kill criterion |
|---|---|---|---|---|---|---|
| P1-A | **Executable oracle closes `p6-test`** (G11) | Claude Code `/goal` evaluator + Stop hooks [✓TODAY] | `runCases` evidence never reaches gates | Thread `verifyAndFixServer` outcomes (status/evidence/iterations) into the `p6-test` probe (`dod.ts:145`); a failing machine run opens HITL with hashed evidence; keep `p6-brief-fit` as the conformance floor | M / 10 | A generated module cannot reach `complete` without machine-run evidence; evidence is a hash, not prose |
| P1-B | **Property + metrics + arch + secrets gates** (G12) | Stop hooks [✓TODAY]; gitleaks [Q2-7]; Aider auto-lint [Q2-15] | lint advisory only (verify.server.ts:524-543); no probe rows | dod.ts additive rows: `p6-metrics` (`complexityOf`), `p6-arch` (`dependencyGraph` cycle → named fail), `p6-secrets` (deterministic regex set over artifact bodies + generatedSource), `p6-lint` promotion decision (advisory → blocking) | M / 10 | A circular import in generated code fails P6 with a named cycle; a secret-shaped literal in any artifact fails P6 before any deploy HITL |
| P1-C | **Trace recorder + DB/vault-backed replay** (G13) | OpenHands replay [G-40]; LangGraph checkpointer [H12] | `tracing.ts` unwired; no snapshots | Record spans at 3 call sites (engine wild/phase step, crew turn, verify pass) into the frozen v1 schema; replay = re-run from persisted span set + compare verdict hashes (C-1 re-spec: no fs, DB/vault-backed) | M / 8 | Kill mid-P6, resume → same state hash, same next phase, same verdict; trace schema never churns (frozen) |
| P1-D | **Approval-diff UI + evidence tree + checklist** (G14) | Antigravity Review Changes [A2][A3] | HITL dock prose-only | Artifact cards per phase + per-probe evidence (id, hash, machine output) + Google 8-lens checklist rendered per phase role (§14.6 #8) | M / 8 | A rejection screen shows the failing criterion, its hash, and the machine output that produced it |
| P1-E | **Permission allowlist + ADR minting** (G15) | Antigravity `action(target)` [A5]; Codex granular policy [C5] | Binary forceHuman | `project.wildPolicy = {autoApprovePhases, alwaysAsk, denyCommands}` consulted at the guard sites; `adrRecord()` call in approve/reject paths; default = today's behavior | M / 7 | Default unchanged until configured; every HITL decision mints a numbered ADR with the evidence hash |
| P1-F | **Context meter + fresh-model refutation** (G16+G17) | Codex meter [C3]; Claude verification subagent [✓TODAY] | Budget invisible; crew single-tier | Meter = `buildChatContext(project).length / 2500` in ChatPane header; pro-tier (or fresh-context) reviewer seat on P6 (one extra call per phase) | S-M / 6-7 | Meter visible with a compact chip; P6 review runs on a model distinct from the coder |

### 2.4 P2 — breadth + orchestration (later, ~3 weeks; sequence law from 90 §6/§11.4 C.4)

| # | Capability | Who has it | Current state | Concrete step | Eff/Impact | Kill criterion |
|---|---|---|---|---|---|---|
| P2-A | **Conditional graph runtime** (G-22) | LangGraph durable execution [H12]; Antigravity worktrees [A4] | Fixed 13-phase linear | `next(state)` edges over Project JSON, default-linear — LAST multiplier, only on snapshots+replay (P0-F + P1-C) | L / 9 | `cli replay` catches any determinism regression introduced by the runtime |
| P2-B | **Governed MCP client + MCP/ACP server** (S7 + G-40 rest) | DSH MCP naming [D6]; ACP everywhere (OpenHands/Cursor ✓TODAY) | P3 demo artifact only; headless verb surface real | MCP tools through the phase machine's gate/ledger path (research-phase tool gate as the model); wrap the 27 headless verbs as MCP tools; git/vault export DB-backed | H / 8 | An external MCP client completes `approve` on a HITL phase end-to-end; no ungoverned tool surface |
| P2-C | **Hierarchical crew + fan-out + catalogs + preview** | Devin fleets [✓TODAY]; Bolt preview [✓TODAY] | Crew sequential advisory; no catalogs | Manager task-list JSON + flash-tier fan-out (2500 concurrency, 90 §12.3.3); G-35 catalog + G-34/G-37/G-38 design kit; G-18 preview only if the design tab earns usage | M-H / 6-7 | Crew stays advisory by law (`crew.server.ts:16` unchanged); no new runtime dep without a feasibility note |

---

## 3. Axis-win accelerators — what makes each SHIPPING-grade

> The five things RapidTool can 10× (90 §4's axes, re-read post-wave). For each: **shipping-grade definition** = the smallest verified state at which the axis is a product claim, not a promise; current on-disk state verified this pass; and the last missing step.

### 3.1 Governed determinism (Axis 2: the keyless floor)

- **Current (verified):** deterministic floor everywhere (`scaffold.ts`, `design.ts`, `algorithms.ts:398/510`, byte-identical vault/design/diagram contracts); `p6-brief-fit` (dod.ts:199) + `p0-brief-grounded` (dod.ts:80) now block the *wrong* deterministic output; `implementationSpec` persisted (types.ts:352).
- **Shipping-grade =** (1) replay-deterministic runs: kill mid-P6, resume → same state hash + same verdict (P0-F + P1-C); (2) CI byte-stability: a no-LLM run is hash-identical across two clean runs, and **hash drift = P0 bug** (90 §10.6 Axis 2); (3) golden packet/verdict locks on the corpus (90 §13.10 #7).
- **The 10× statement becomes true when:** `npm run eval` prints a deterministic conformance score, and the RenamePro corpus brief re-runs to ≥ floor **with the API key deleted**.

### 3.2 Honest verification (Axis 1: governance as protocol)

- **Current (verified):** typed honesty envelopes everywhere (`chat.server.ts:277`-class `not-configured` paths, `wild-mode.server.ts` ≥12-char verdict contract, classifier refuses to fabricate); FNV-1a evidence hashes (`dod.ts`); capability ledger + B-18 tail (dod.ts:453-502); lint advisory in verify evidence (verify.server.ts:524-543); wild convergence re-stamp (engine.ts:2580-2600).
- **Shipping-grade =** (1) machine checks block advancement (P1-A), not just record it; (2) the `enforceDod` default decision is made and dated (P0-C); (3) secrets/lint/arch fail before any deploy HITL (P1-B); (4) null-note approval is impossible at every layer (P0-B); (5) fresh-model refutation on P6 (P1-F).
- **The 10× statement becomes true when:** a corpus run where a gate is `passed:false` **cannot** reach `complete` without a recorded, noted human override — and a PR that drops an `{ok:false}` fallback fails CI (90 §13.1.1 domain lint).

### 3.3 Paper trail as product (Axis 4: the audit axis)

- **Current (verified):** append-only decision journal; `wild.*` ledger (engine.ts:2033-2038 region); gate verdict logs + evidence hashes (`dod.ts:362`-class); chatLog now persisted (types.ts:343, store.ts:1310, console.tsx:4420-4499); provenance stamps on chat rows; machine-readable packet (`packet.ts:137/292`); vault export.
- **Shipping-grade =** (1) trace recorder wired at the 3 call sites with the frozen schema (P1-C); (2) ADR minted per HITL decision (P1-E); (3) per-gate evidence viewer (P1-D); (4) MCP/ACP server + DB-backed git/vault export so external agents drive governed builds (P2-B); (5) contract locks on the headless verb JSON shapes (90 §13.10 #10) — the portability-of-the-record switching cost (90 §10.3).
- **The 10× statement becomes true when:** "the audit log IS the build" — every artifact re-derivable from evidence, every run replayable to the same verdict, and an external client can complete an `approve` end-to-end.

### 3.4 Headless drive surface (the agent-drivable governed builder)

- **Current (verified):** 27-verb CLI over `headless.ts` (create/run/gate/approve/reject/ingest/packet/export/summary/vault/crew/verify/design/diagram/artifacts/doctor/harvest/swarm/prompt/bench/mine/knowledge/wild/chat/deepen); single-JSON-envelope + `RT_E_*` exit contract (14 codes, errors.ts:22-37).
- **Shipping-grade =** (1) the persist-verb ok-shape bug class closed (90 §11.4 D.4: every persist verb's ok-shape MUST carry `project`); (2) contract tests over every verb shape (90 §13.10 #10); (3) RT_E inventory completion with test (in-flight W-2); (4) MCP/ACP wrapper over the same surface (P2-B); (5) `--autopilot` gate loop remains barred from stock HITL phases (R3/B-03 law, verified unchanged).
- **The 10× statement becomes true when:** an external agent (any harness, any model) can drive a governed build start-to-finish over the verb surface and get typed, machine-branchable verdicts at every step — which no Codex/Devin/Bolt API offers.

### 3.5 Self-learning store (Axis 5: the compounding axis)

- **Current (verified):** `KnowledgeStore` append-only + atomic (knowledge.ts:122-class); decay 0.5^counterEvidence + supersede ledger (knowledge.ts:51/54/256/408-431); L2 capture with `lesson.capture` ledger event (report-intake.ts:344-347); Tier-3 lesson injection (prompt-engine.ts:131/149/183-209); M-08 write-back; FusionRank into every packet.
- **Shipping-grade =** (1) L1/L3/L4/L5 writers + critique persistence (P0-H); (2) Tier-1/2 retrieval wiring — `injectProven` production consumer + vague-brief brake (P0-H); (3) HITL-gated cross-project promotion (P0-I); (4) the falsification gate: `npm run eval` prints the rejection-rate-per-failure-mode trend across ≥6 runs (P0-D).
- **The 10× statement becomes true when:** run 6+ on the same domain shows measurably fewer gate rejections than run 1 — **and is ripped out if it doesn't** (90 §5/§10.6 Axis 5 kill, the honesty feature itself).

---

## 4. Final acceptance suite — "superior to all of its kind" in testable terms

> What the phrase means: pass EVERY row below. Rows are the eval-harness spec from 90 §10 (corpus, conformance, honesty, determinism) + the production-check gates from §13.10/§14.6 + the axis kill criteria from §10.6, folded into one scorecard. Each row: metric → how it's measured → passing threshold → current state at snapshot.

### 4.1 Product-truth scorecard (the 86/87/88 corpus: the metric to beat is RenamePro ≈1/10)

| # | Metric | Measurement | PASS threshold | Now |
|---|---|---|---|---|
| A1 | Wrong-product completion | Corpus runs (Team Kanban ≈2.2/10, RenamePro ≈1/10, StatKit ≈1.2/10 briefs) → headless run → brief-conformance scan | **wrong-product `complete` = 0** | ❌ no eval script exists (G6) |
| A2 | Brief conformance floor | Brief-named exports/JSDoc/zero-dep present in P6 output; no template prose with 0 brief-noun hits | ≥ floor per kind (91/92 taxonomy), all 3 corpus briefs | ◐ `p6-brief-fit` probe landed (dod.ts:199) but never exercised by an eval run |
| A3 | Vague must block | `vague:true` ∧ non-empty brief with real vocabulary ⇒ P0 unmet | Never silently falls back | ◐ probe landed (dod.ts:80); LEX still empty of dev-tool terms (G2) → currently honest-fails instead |
| A4 | Conformance rises run-over-run | Rejection-rate-per-failure-mode trend over ≥6 same-domain runs | Down-trend by run 6; flat/up ⇒ **rip the loop out** | ❌ no harness (G6) |

### 4.2 Governance-law scorecard (Axis 1/3)

| # | Metric | Measurement | PASS threshold | Now |
|---|---|---|---|---|
| B1 | Gates block | `enforceDod` semantics decided + enforced; corpus run with `passed:false` cannot seal | 0 silent advances | ❌ advisory default (G4) |
| B2 | Null-note approval impossible | Attempt approve of forceHuman/override with no ≥12-char note | Throws at engine + blocked at store + UI | ❌ (G3) |
| B3 | No fabricated verdicts | Classifier unparseable/unconfigured paths | Typed honest error, never a guessed approve | ✔ (wild-mode.server.ts contract, verified) |
| B4 | Machine evidence on P6 | `p6-test` closes only on `runCases` evidence | No module `complete` without machine-run evidence; evidence is hashed | ❌ (G11; lint advisory is the current best) |
| B5 | Bounded autonomy | wild: one macro-action/step, cap 20, `forceHuman` never self-approved, plan-first | 0 bypass incidents; no execution without approved plan or `autoPlan` | ◐ bound+cap ✔ (engine.ts:2492, store.ts:611); plan-first ❌ (G8) |
| B6 | Restore integrity | `restoreCheckpoint` replay | Restore → same gate verdict; restore is a ledger event | ❌ (G7) |
| B7 | Secrets | Deterministic scan over generatedSource + artifact bodies | Secret-shaped literal fails P6 before deploy HITL | ❌ (G12) |

### 4.3 Determinism + honesty scorecard (Axis 2)

| # | Metric | Measurement | PASS threshold | Now |
|---|---|---|---|---|
| C1 | Keyless byte-stability | Two clean no-LLM runs of a corpus brief | Byte-identical artifacts + verdicts; hash drift = P0 bug | ◐ per-module tests exist; no run-level CI fixture |
| C2 | Typed honesty | Every server seam returns `{ok:false, reason:"not-configured"}` pre-network | 0 fabricated results; `RT_E_*` codes for all failures | ✔ (seam contract verified in chat/crew/verify/wild/harvest/prompt-engine) |
| C3 | Replay determinism | Kill mid-P6, resume (DB/vault-backed) | Same state hash, same next phase, same verdict | ❌ (G13) |
| C4 | Golden locks | Packet + verdict JSON for the 3 corpus briefs | Byte-for-byte stable (committed fixtures) | ❌ (90 §13.10 #7) |

### 4.4 Parity + production scorecard (table stakes + repo hygiene)

| # | Metric | Measurement | PASS threshold | Now |
|---|---|---|---|---|
| D1 | Streaming + stop | Live turn | Tokens stream; Stop cancels with honest `RT_E_*` row | ❌ stream:false (deepseek.server.ts:233) |
| D2 | Chat persistence | Reload | Thread survives; ≤40 rows, quota-salvaged | ✔ types:343 + store:1310 + console:4420-4499 + ticker :4439 |
| D3 | Oracle visibility | UI | Verify verdicts visible in the Oracle tab; run button exists | ❌ PENDING (W-2) |
| D4 | `npm run ci` | One command | typecheck→lint→test→check:auth→audit:deps→test:cov all pass in order | ❌ no script (package.json:9-21) |
| D5 | Coverage floor | `--experimental-test-coverage` on governance core | Threshold on `engine.ts`/`dod.ts`/`verify.server.ts` | ❌ (90 §13.10 #1) |
| D6 | Postmortem→guardrail | `check-fix-register.mjs` | Every `fixes/*.md` names a `*.test.ts` regression anchor | ❌ (90 §13.10 #3) |
| D7 | Zero-dep law | package.json diff per PR | No new runtime dep without a feasibility note | ✔ (law held by all waves) |
| D8 | Headless contract | Contract fixtures over approve/reject/ingest/packet/summary shapes | Shapes locked; MCP wrapper = adapter over tested contract | ❌ (90 §13.10 #10) |
| D9 | Learning-loop ledger | Every lesson row/promotion/decay/supersede | Appears as a `wildLog`-style event; never a silent write | ◐ L2 + decay landed; L1/L3/L4/L5 + promotion pending |
| D10 | Trace recorder | Spans at engine-wild/crew/verify | All 3 call sites recorded into frozen schema | ❌ (G13) |

**Verdict rule:** "superior to all of its kind" = A1-A4, B1-B7, C1-C4, D1-D10 **all PASS** on a clean run of `npm run eval && npm run ci`, with the axis kill criteria (§10.6) as the go/kill gates. Today: **6 ✔ / 6 ◐ / 18 ❌** (✔ = A-n/a, B3, B5-half, C2, D2, D7). Any row that a competitor can also pass is *parity*; the superiority claim rests on rows **B1-B7 + C1-C4 + A4 + D9** — the ones no Codex/Cursor/Devin/Bolt/Lovable/v0 product can honestly pass (their governance is configuration, theirs is law — 90 §4 moat argument, unchanged by the waves).

---

## 5. Single recommended execution order

> Accounts for the in-flight wave (mark **PENDING** items as wave-blocked, not started). Each step's exit gate = the kill criterion from §2 + the scorecard rows it must flip. Sequence law: truth before features; P1-1-class items before trace; G-22 last (90 §11.4 C).

1. **S0 — Land the in-flight wave** (do not start S1 until green): W-0 (codegen + P0-08 holes + seams) → W-1 (loop writers) → W-2 (Oracle tab + RT_E + chatLog). Gate: `npm run test` + `typecheck` green; codegen.server.ts live-proves brief-faithful against `p6-brief-fit`; `fixes/100`/`101` logs non-empty.
2. **S1 — Truth wave completion** (the unfinished Phase-0, ~3-5 days): P0-A (LEX) → P0-B (note symmetry) → P0-C (enforceDod decision, dated) → P0-D (wire trio + `npm run eval` + `npm run ci`). Gate: scorecard A1-A4 measurable; B1-B2 flip to ✔; D4-D6 ✔. **Any step failing its check freezes P0 feature work** (90 §10.5).
3. **S2 — P0 trust wave remainder** (~1 week): P0-E (streaming) → P0-F (delta checkpoints) → P0-G (plan-first wild) → P0-H (critique + L1/L3/L4/L5 + wiring) → P0-I (HITL promotion). Gate: D1 ✔, B5-B6 ✔, D9 ✔; Axis 5's eval can now print its first trend line.
4. **S3 — P1 verification lattice + governance UX** (~2 weeks, order within phase is law): P1-A (oracle closes p6-test) → P1-B (property/metrics/arch/secrets probes) → P1-C (trace recorder + replay) → P1-D (approval-diff UI) → P1-E (allowlist + ADR) → P1-F (meter + fresh-model review). Gate: B4-B7 ✔, C3 ✔; P1-C strictly after P1-A (trace records machine verdicts, not prose) and P1-D after P1-A (reviewer sees hashed evidence).
5. **S4 — P2 breadth** (~3 weeks): P2-B (MCP through the phase machine — the differentiator with no competitor) → P2-A (conditional runtime, LAST multiplier, only on snapshots+replay) → P2-C (crew fan-out + catalogs + preview if earned). Gate: C3 still green under the new runtime (`cli replay` is the regression catcher); no ungoverned tool surface; zero-dep law intact.
6. **S5 — The axis verdict:** run the §4 scorecard end-to-end. If Axis 5's trend is flat by run 6 → rip the loop out (kill criterion is the feature). If every row passes → "superior to all of its kind" is now a *measured* claim with a public scorecard.

---

## 6. Honest negatives + anchor drift log (this pass)

- **Competitor pages were NOT re-fetched this pass** — every external claim is inherited from 90's same-day ✓TODAY/[Cx]/[Dx]/[Gx]/[Ax]/[F#]/[H#]/[Q#]/[Q2-#] registers (90 §8/§9.8/§10.7/§12.7/§13.8/§14.7). Inherited claims are marked as such in the text.
- **In-flight wave snapshot is point-in-time** (17:19-17:22 CDT, 2026-09-06): `deleg_ee964d63` T0/T1/T2 were actively editing `src/lib` while this file was written. §1.2's PENDING rows may flip to LANDED within minutes; re-verify with `ls src/lib/codegen.server.ts` and `grep -n "verify" src/components/console.tsx` before trusting this dossier's PENDING markers.
- **Anchor drift (this pass's numbers beat §15/§16):** `wildStep` at **`engine.ts:2492`** (was 2330/2329) · `wildApproveGate` **`:2316`** · `wildLeavePhase` **`:2404`** · `runPhaseAsync` **`:2091`** · `runP6Real` **`:2112`** · engine.ts total **2601 lines**. `p6-brief-fit` **`dod.ts:199`** (90 §9.5 said "next to :126-165" — landed additively after `p6-verified` :172). `implementationSpec` **`types.ts:352`** (was "absent" in 90 §10.2 #8 — that correction is now stale). `chatLog` **`types.ts:343`** (90 §10.1 P0-2 row "Project has no chatLog" is now stale). `stream:false` still **`deepseek.server.ts:233`** (unchanged).
- **`fixes/100_profix_P0.md` / `fixes/101_profix_loop.md` fix logs were EMPTY at snapshot** (headers + spec maps only, `<!-- FIXES -->` / `<!-- APPEND -->` unfilled) — the P-A/P-B lanes' spec maps tell us intent; the verified-on-disk state in §1.1 is the only ground truth I scored against.
- **Sibling planners 94/96 were not on disk at tail check** (17:19) — if they land, treat this file's §1.3 G-numbering as local to 95 only; cross-reference rather than renumber.
- **Not verified this pass:** the exact inventory-test shape W-2 will land; P-A3's final codegen.server.ts API (file absent at snapshot); whether `p0-brief-grounded` has a regression test in `dod.test.ts`/`gates.test.ts` (probe verified, its test not re-grepped). All three are marked PENDING accordingly.
