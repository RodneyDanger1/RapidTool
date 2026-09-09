# 25 — Wild Mode Debug: Autonomous-Loop Patterns + Failure Modes (B6 contract, cited) with Fix Specs

- **File:** `research/multiagent/25_debug_wildmode.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
- **Date / agent:** 2026-09-06 · Flash debug-helper **F2** (task 1 of `deleg_ba077749`) — **STRICTLY read-only on source**; this file is the only write this pass.
- **Host:** Windows 10 (git-bash), Node `v22.23.2`. Repo is NOT git.
- **Scope:** the P13 Wild Mode autonomous loop (`engine.wildStep` + `wild-mode.server.ts` classifier + the `wildRun` surface + its missing store driver), researched against cited external patterns (Manus-style verifier loops, OpenAI Codex review posture, Gemini/Google agentic design patterns, OpenHands sandboxing, AutoGPT failure post-mortems, LLM-judge calibration literature, agent-governance guidance).
- **0-hallucination rule:** every `file:line` anchor below was re-verified against on-disk bytes on 2026-09-06 by direct read. Every external claim carries a bracketed source id `[n]` mapped in the Sources block; quotes are verbatim from pages I extracted this pass. Nothing is from memory.
- **Audience:** parent orchestrator + the final-wave builder that lands the Wild-Mode driver (this doc's specs are type-level: signatures + invariants + test list — no fabricated code).
- **Sibling coordination:** docs 24 (F1) landed mid-pass; 26/27/28 (F3/F4/F5) are in flight; 22/23 absent at write time. This doc stays out of CLI/error-code/chat territory (§9 merge notes).

---

## 0. TL;DR verdicts

| # | Pattern (external) | RapidTool land state (verified) | Verdict | Top fix specs |
|---|---|---|---|---|
| P1 | Auto-review / judge classifier with calibration + false-approval controls | **Landed, well-built** at engine + classifier layers: configured-only reviewer, parse-or-error, 12-char feedback floor, verbatim logging, evidence-only context | VIABLE-WITH-CHANGES | F-2 (sampling), F-3 (classifier-review audit rows), F-7 (same-model separation note) |
| P2 | Watchdog / pause / emergency-stop semantics + bounded loops | **Half-landed**: pause semantics, stop-on-hydrate, per-call boundedness exist; **the driver loop (start/stop/pause/resume) is declared but NOT implemented** — `startWildRun`/`stopWildRun`/`toggleWildPause`/`setWildMode` have no implementation anywhere in `src/` | NOT-VIABLE until driver lands | F-1 (driver, the critical path), F-4 (cap/backoff), F-6 (stop semantics) |
| P3 | Honest ledgers (append-only, auditable) | **Largely landed** (`wild.*` events append-only, feedback verbatim, mirror on `wildRun`); one structural gap: ledger ring `slice(-200)` can evict old `wild.*` entries | VIABLE-WITH-CHANGES | F-5 (ring sizing / eviction honesty) |
| P4 | Determinism preservation under autonomy | **Landed**: deterministic `applyPhaseResult` floor, DoD-floor verdict when unconfigured, no LLM in the execution path, pure prompt/parser, injectable reviewer | VIABLE (hold the line) | F-8 (driver serialization), F-9 (concurrency tests) |
| P5 | Known failures (infinite loops, self-approval cascades, hallucinated completions, runaway spend) | Engine-side protections exist (pause-not-retry, forceHuman, cap is driver-side and missing) | PARTIAL — residual risks registered | F-1, F-4, F-6, F-10 (DoD test battery) |

**The one-sentence finding:** the Wild-Mode *autonomy brain* (bounded step, classifier, pause ledger) is implemented to a high honesty standard, but the *autonomy body* — the bounded driver loop that starts, steps, caps, pauses, resumes and stops a run — is **unwired**: `src/lib/store.ts` imports `wildStep` (store.ts:13) and declares the four lifecycle actions (store.ts:94-98) but implements none of them, and zero test files touch Wild Mode. The final wave's critical path is therefore **F-1 (implement the store driver against the B6 surface the console B7 UI already expects)**, not classifier or engine rework.

---

## 1. Verified landscape — the B6 contract and what exists today

### 1.1 What "B6" means in this codebase (contract terminology)

The console's Wild-Mode pillar explicitly names the canonical shapes "B6" and itself "B7": `console.tsx:246` *"Canonical (B6 types.ts WildRunState) pause flag — legacy alias `paused` also accepted"*, `console.tsx:251` *"Frontier phase the unattended loop is at (B6 WildRunState.phase)"*, `console.tsx:341` *"Full-stop actions (B6 stopWildRun)"*. `types.ts:122-124` in turn says the console (B7) streams the run from `Project.wildRun`. So the **B6 contract = the `WildRunState` field set (`types.ts:129-137`), the `Project.wildMode`/`wildRun` surface (`types.ts:328-336`), its pause semantics (`types.ts:125-127`), and the ≥12-char auto-log rule** (`wild-mode.server.ts:10-17,34`; engine floor `engine.ts:2100-2109`). B7 = the console stream/UI (`console.tsx:225-262`). Everything below is anchored to those definitions.

### 1.2 Landed P13 surface (verified anchors)

| Component | Verified fact | Anchor |
|---|---|---|
| `WildRunState` | exact fields `{ active, phase, startedAt, lastAutoLog, lastAutoAt, stoppedAt, pause }` | `src/lib/types.ts:129-137` |
| Pause semantics | *"a PAUSED run keeps `active: true` + `pause: true` until the operator resumes (`toggleWildPause`) or stops (`stopWildRun`)"* | `types.ts:126-127` |
| Project opt-in | `wildMode?: boolean` (default OFF, never inferred on legacy) + `wildRun?: WildRunState \| null` | `types.ts:328-336` |
| Fresh-project defaults | `emptyProject` stamps `wildMode: false, wildRun: null` | `src/lib/engine.ts:1127-1128` |
| Persist-hydration guard | persisted ACTIVE run is force-stopped on hydrate (`{active:false, pause:false, stoppedAt}`) — *"the driver loop is a session artifact and dies with the page, so an active surface would be a lie after reload"*; scalar coercion so hand-edited payloads cannot crash the B7 stream | `engine.ts:1289-1332`, wired at `engine.ts:1419-1431` |
| Classifier (configured-only) | deepseek-v4-flash tier; **never fabricates a judgment when unconfigured** — returns `{ok:false, reason:"not-configured"}` | `src/lib/wild-mode.server.ts:4-8, 30-31, 143-144` |
| 12-char auto-log contract | `WILD_FEEDBACK_MIN = 12`; ok:true reviews must carry ≥12 chars of feedback, logged verbatim; too-short output is an honest error, never padded | `wild-mode.server.ts:10-17, 34, 163-170`; engine defense-in-depth floor `engine.ts:2100-2109` |
| Prompt shape | fixed `VERDICT: approve\|reject` + `FEEDBACK:` markers, judge-on-evidence-only system prompt, artifacts capped at 8 × 320 chars, brief 400, DoD verdict + unmet criteria + lastTest included; **model never shown invented evidence** | `wild-mode.server.ts:67-109` |
| Parser | strict: explicit verdict token required, empty feedback → null → caller error | `wild-mode.server.ts:116-125` |
| One call = one macro-action | execute ≤1 phase + its review/gate resolution per `wildStep`; headless driver can loop with a hard cap | `engine.ts:1978-2004, 2304-2394` |
| ≤1 classifier call per step | every path through `wildStep` resolves at most one classifier decision (gate approve OR leave review; the DoD floor fires only when unconfigured) — so **N driver iterations bound LLM calls by N** | `engine.ts:2335-2380` |
| Pause reasons | `wild.paused_human` (forceHuman gate), `wild.paused_classifier` (not configured at a gate), `wild.reject` (classifier reject), `wild.paused_dod` (hard-DoD block), `wild.paused` (blocked/rejected project), `wild.error` (any engine/classifier error) — all pause, none retry | `engine.ts:2147-2175, 2178-2187, 2204-2213, 2237-2253, 2315-2355, 2381-2393` |
| Deterministic floor | execution uses `applyPhaseResult` — the same synthesis the sync store run uses; unconfigured advance reviews degrade to the machine-checkable DoD verdict (`approve iff runGate passes`) | `engine.ts:2357-2380, 2111-2129` |
| Completion | P12 sealed → `wildFinalize`: `active:false, pause:false, stoppedAt`, `wild.complete` log | `engine.ts:2283-2296` |
| Console B7 UI (defensive) | full Wild-Mode panel reads `wildMode`/`wildRun` structurally (pre/post contract safe), accepts multiple legacy action names, returns honest `{ok:false, error:"not-wired"}` when the store lacks actions | `console.tsx:225-262, 296-314, 325-408, 493, 518-521, 734-738` |

### 1.3 Verified gaps (the fix-spec surface)

| Gap id | Verified fact | Anchor |
|---|---|---|
| **G-1 driver unwired (critical)** | `store.ts` declares `setWildMode`, `startWildRun` (→ `Promise<WildRunResult>`), `stopWildRun`, `toggleWildPause` in the interface ("P13: Wild Mode opt-in + run lifecycle (B7 contract names)") but **no implementation exists anywhere in `src/`** (repo-wide grep: only the interface, the `wildStep` import at store.ts:13, the console's defensive name lookup, engine/types/classifier). `wildStep` is never called. | `src/lib/store.ts:13, 34-41, 94-98`; `console.tsx:325-343` |
| **G-2 no tests** | zero test files reference `wildStep`/`wildRun`/`wildMode` (`grep src/lib/*.test.ts`: 0 hits) | repo grep 2026-09-06 |
| **G-3 driver cap spec exists but is unused** | the B-24 sync-runner pattern derives the bound from the graph: `maxRuns = (13 - start.currentPhase) * 2 + 2` with an honest visible `stoppedReason:"cap"`; `WildRunResult` (store.ts:39-41) already promises `stoppedReason: "paused" \| "complete" \| "cap"` and "ok requires progress" — all waiting on an implementer | `src/lib/store.ts:39-41, 511-558` |
| **G-4 ledger ring can evict wild events** | every log append runs `[...logs, entry].slice(-200)` — append-only per event but a rolling 200-entry window; long/repeatedly-resumed runs can silently evict early `wild.*` rows | `src/lib/engine.ts:2019-2024` |
| **G-5 no spend/call telemetry** | the classifier call carries `maxTokens: 320` only (no cumulative budget counter anywhere; driver absent so none can exist); `lastAutoLog` mirrors only the latest decision | `wild-mode.server.ts:145-149`; `engine.ts:2050` |
| **G-6 no consecutive-error circuit breaker** | every classifier/engine error pauses (good), but there is no strike counter for a human resume → re-error cycle; telemetry impossible until driver lands | `engine.ts:2381-2393, 2173-2176` |

**Implication for the final wave:** because `wildStep` is bounded per call and ≤1 classifier call per step, the missing driver is *the* control point where the external "bounded loop" pattern must be enforced (G-1/G-3), and where pause/resume/stop semantics become reachable by a human (G-1). All other gaps are secondary.

## 2. Pattern 1 — Auto-review / judge classifiers (prompt shape, calibration, false-approval risk)

### 2.1 What the field proves

- **A separate judging layer is the standard architecture.** OpenAI's governance paper explicitly endorses a *"second 'monitoring' AI system that automatically reviews the primary agentic system's reasoning and actions … This monitoring AI system could be a classifier, or a generative AI system"* [4]. Manus operationalizes exactly this as a Planner/Execution/**Verification** agent triad where the *"Verification agent … checks results for accuracy and completeness, ensuring that each step meets the requirements before finalizing the output or moving on. The Verification agent can correct errors or trigger re-planning if needed"* [10]. Anthropic's evaluator-optimizer workflow — *"one LLM call generates a response while another provides evaluation and feedback in a loop"* — is its two-call primitive [5]. RapidTool's split (deterministic `applyPhaseResult` executor + configured-only Auto-Review classifier that may only *approve or reject leaving the phase*) matches all three.
- **Judge outputs are biased and need calibration.** The MT-Bench/Chatbot-Arena study identifies *"position, verbosity, and self-enhancement biases, as well as limited reasoning ability"* in LLM judges and proposes mitigations (order swapping, reference answers, fine-tuned judge models); strong judges can still match human agreement (~80%) *after* those fixes [1].
- **False-approval is asymmetric and compounding.** The same paper's self-enhancement bias — a judge favors outputs from its own family/model [1] — is the direct citation for the "self-approval cascade" risk: when the *same model* executes and judges, rejections that would catch real defects are the first thing the bias erodes. Industry practice (independent review layers, e.g. OpenHands' requirement of a custom code-review guide for contributors' agents [12]; Codex's posture of *"verifiable evidence of its actions through citations of terminal logs and test outputs"* plus *"it still remains essential for users to manually review and validate all agent-generated code"* [6]) all separate the reviewer from the maker.
- **Prompt shape matters more than model choice for verdict reliability**: explicit markers/rubric + evidence-only context + honest-failure parsing beats freeform critique [1][5]. Codex's own AGENTS.md spec pushes the same direction mechanically: *"If the AGENTS.md includes programmatic checks to verify your work, you MUST run all of them and make a best effort to validate that the checks pass AFTER all code changes have been made"* — machine-checkable gates riding alongside the model judgment [6].

### 2.2 RapidTool mapping (already landed)

RapidTool's classifier layer already encodes most of this: judge-on-evidence-only prompt (`wild-mode.server.ts:67-109`), strict parse-or-error (`:116-125`), configured-only honesty (`:4-8,143-144`), 12-char feedback floor enforced twice (`:163-170`, engine floor `engine.ts:2100-2109`), verbatim feedback into the ledger (`engine.ts:2134-2137`), and — the strongest anti-cascade property — **a classifier reject pauses the run and retry is a human decision** (`engine.ts:2178-2187, 2245-2254`; `wild.paused` on rejected phases `2315-2323`). There is no autonomous retry loop to spiral in.

### 2.3 Fix specs (wave 4)

- **F-2 · Classifier sampling knob (calibration).** `wild-mode.server.ts:145-149` passes only `{model, system, maxTokens}` — the shared `complete()` client (`src/lib/llm.ts`) exposes no temperature/sampling field. Spec: add an optional `temperature?: number` to the `WildCompleter` opts type (additive; default preserved) and call the classifier at a low fixed temperature (e.g. `0`) so same-input re-reviews are stable. Type-level only — do not invent provider behavior; verify `llm.ts` forwards the field before merging.
- **F-3 · Per-run review audit row (calibration telemetry).** Additive store-level (not persisted-shape) counter: each driver iteration records `{reviewSource: "classifier"|"dod", verdict, chars: feedback.length, ms}` into the run's driver result; a run that ends with `approve`-rate 100% across ≥6 classifier reviews is surfaced in the result envelope as a calibration warning (`flagged: "monotone-approval"`) — matches the MT-Bench "watch the judge, not just the verdict" discipline [1]. Do NOT auto-block on it (would violate pause-only semantics); surface only.
- **F-7 · Model-separation note (documented risk, no code).** `WILD_CLASSIFIER_MODEL` (`wild-mode.server.ts:31`) equals the chat model tier; self-enhancement bias [1] is mitigated here by evidence-only context + the deterministic DoD floor, but record the residual risk in the driver header comment and keep the reviewer seam (`opts.reviewer`, `engine.ts:2017`) available for a future different-model judge.

---

## 3. Pattern 2 — Watchdog / pause / emergency-stop semantics + bounded loops

### 3.1 What the field proves

- **Interruptibility is a governance baseline.** OpenAI: *"Interruptibility (the ability to 'turn an agent off'), while crude, is a critical backstop for preventing an AI system from causing accidental or intentional harm … a user can always activate a graceful shutdown procedure for its agent at any time"*; agents must not be able to *"halt or tamper with the user's attempt to shut them down"*; and shutdown should *"extend recursively to any other sub-agents the agent has initiated"* [4]. Google's agentic design catalogue makes the pause point a first-class pattern: the human-in-the-loop pattern *"integrates points for human intervention directly into an agent's workflow. At a predefined checkpoint, the agent pauses its execution and calls an external system to wait for a person to review its work"* [9]. OpenAI's agent guide: on failure the agent *"can halt execution and transfer control back to the user"*, and *"high-risk actions … should trigger human oversight"* [11].
- **Bounded loops are a real, measured failure class.** The 2026 IAL study defines *Infinite Agentic Loops* — *"an agentic feedback path repeatedly triggers LLM calls, tool invocations, agent executions, or workflow transitions without an effective termination condition"* — and found **68 confirmed IAL failures across 47 of 6,549 real agent repos (91.9% precision)**; framework caps (LangChain `max_iterations`, LangGraph recursion limits, Agents SDK max turn limit, CrewAI `max_iter`) exist but *"do not eliminate IAL risks in practice. Developers may omit them, misuse them, configure them with ineffective bounds, or place them outside the actual feedback path"* [2]. AutoGPT's 2023 post-mortem documents the same class in the wild: recursive self-verification loops, hundreds of API calls with no deliverable, and GitHub issue #2726 warning that continuous mode could *"run forever or carry out actions you would not usually authorise"* [3].
- **Watchdog enforcement must be deterministic, not prompt-level.** Claude Code's hook system exists precisely because *"certain actions always happen rather than relying on the LLM to choose to run them"* — `PreToolUse` fires *before* a tool executes and **can block it**; `Stop` can prevent the agent from ending a turn [7]. The lesson: loop bounds, blocks and stops live in code outside the model's control.
- **Caps need a visible reason.** AutoGPT users' surviving workarounds were exactly *manual interruption, token limits, time bounds, specific measurable goals* [3]; Google's loop pattern terminates on *"a maximum number of iterations or a custom state"* evaluated by the orchestrator, not the model [9]. RapidTool's own B-24 sync runner already encodes the house version: graph-derived bound + honest `stoppedReason:"cap"` (store.ts:511-548).

### 3.2 RapidTool mapping

Pause semantics land (types.ts:126-127; engine 2312-2314; pause reasons enumerated in §1.2); hydrate force-stop is a session-break watchdog (`engine.ts:1289-1332`); per-call boundedness is structural (`engine.ts:1978-2004`). **Missing:** the driver that would let a human start/pause/resume/stop (G-1), the iteration cap (G-3), error-backoff/circuit telemetry (G-6), and any test (G-2).

### 3.3 Fix specs (wave 4)

- **F-1 · Implement the Wild-Mode store driver (CRITICAL PATH).** Implement exactly the four declared actions (`store.ts:94-98`) with canonical names — `setWildMode(id, on)`, `startWildRun(id): Promise<WildRunResult>`, `toggleWildPause(id)`, `stopWildRun(id)` — because the console B7 UI (`console.tsx:325-343`) tries canonical names first and degrades to `"not-wired"` today (`console.tsx:373`). Contract, type-level:
  - `startWildRun`: guard `wildMode===true`; stamp `wildRun = {active:true, pause:false, phase: currentPhase, startedAt, lastAutoLog:"Wild run started (Auto-Review <configured|deterministic floor>)", lastAutoAt, stoppedAt:null}`; log `wild.start`; then loop `wildStep` bounded by the B-24 graph-derived formula `maxRuns = (13 - currentPhase) * 2 + 2` (reuse `store.ts:513`); serialize per project with the existing `serialized()` pattern (`store.ts:563`) so an overlap can never commit a stale snapshot (ST-6; `rebaseUserFields` on commit, `store.ts:583-589`).
  - Outcomes map 1:1 to the already-spec'd `WildRunResult` (`store.ts:35-41`): any `outcome:"paused"`/`"completed"`/driver ceiling → `stoppedReason:"paused"|"complete"|"cap"`; **ok requires progress** (`ran>0`, store.ts:552-558); 0-progress runs return `ok:false` with the honest reason. The cap pause must set `pause:true` + log `wild.cap` with the reason (B-24 parity: *"visible stop reason, never a silent truncation"*, store.ts:547).
  - `stopWildRun`: sets `active:false, pause:false, stoppedAt` (the exact shape `hydrateWildRun` already force-produces on reload, `engine.ts:1315-1319`), logs `wild.stop`; must be callable from any state incl. paused (types.ts:125-127 says operator stops end the run).
  - `toggleWildPause`: flips `pause` only; `active` stays true while paused (types.ts:126-127); while paused `wildStep` is a zero-mutation noop (`engine.ts:2312-2314`) so no extra engine guard is needed.
  - Every auto decision already mirrors onto `wildRun.lastAutoLog/lastAutoAt` by the engine (`engine.ts:2050, 2216-2218, 2277-2278, 2290-2291`) — the driver must NOT add a second mirror; it only reads `outcome` + stamps start/stop/cap rows.
- **F-4 · Error backoff + circuit breaker in the driver.** Track consecutive `wild.error` outcomes per phase; after **3** consecutive errors on the same phase the driver pauses with `wild.cap` (detail: "circuit open — N consecutive Auto-Review errors on P{x}") instead of looping to the ceiling — a code-level Stop-hook analog [7] and a direct answer to AutoGPT's "no automatic circuit breakers" lesson [3]. Human resume resets the counter (pause-only retry semantics preserved).
- **F-6 · Stop-before-start and stop-while-running semantics (watchdog).** `startWildRun` on an already-active run returns `ok:false` (never a second concurrent driver); `stopWildRun` on an inactive run is an idempotent noop. Rationale: OpenAI's *"user can always activate a graceful shutdown procedure at any time"* [4] — the stop path must exist and be reachable even mid-iteration (check `pause`/`stop` flags between steps, never inside a step).
- **F-4b · Session-budget telemetry (no new persisted fields).** Driver closure (not persisted — it dies with the page, matching the hydrate honesty rule `engine.ts:1289-1292`) counts classifier calls + wall-clock ms per run and includes them in `WildRunResult` (`ran` already exists; add `classifierCalls`, `elapsedMs` — additive result fields, NOT `WildRunState` fields, so the B6 shape is untouched). This gives AutoGPT-issue-#6-style cost awareness [3] without a schema change.

---

## 4. Pattern 3 — Honest ledgers (append-only decision logs, auditability)

### 4.1 What the field proves

- OpenAI's governance paper makes the ledger a first-class practice: *"It may be particularly important that system deployers provide the user with a ledger of actions taken by the agent. This is a lighter-touch method than requiring human approval … Actions that can only be reviewed after the fact should be more easily reversible than those that require approval"* — and it warns that retroactive justification is unreliable: *"It is unfortunately not possible to simply 'ask' the agent to retroactively justify its behavior, as this is likely to produce confabulated reasoning"* [4]. So: log the *action + the contemporaneous reason*, never a post-hoc story.
- Codex ships the same idea as verifiability: *"Codex provides verifiable evidence of its actions through citations of terminal logs and test outputs, allowing you to trace each step taken during task completion"* [6]. Cognition's context-engineering principles add the multi-actor variant — *"Actions carry implicit decisions, and conflicting decisions carry bad results"* — which is why a single linear agent with a shared trace beats parallel actors that cannot see each other's decisions [8].
- Ledger entries must survive the run — every external reference above logs decisions where a reviewer can replay them ([6] citations-to-logs; [9] checkpoints that wait). RapidTool's persisted `logs[]` + `wildRun` mirror is that replay surface (§4.2).

### 4.2 RapidTool mapping

`wildLog` appends `{ts, phase, level, event, detail}` with `event` namespaced `wild.*` (`engine.ts:2019-2024`); reviews are logged verbatim with source (`wild.review`, `engine.ts:2134-2137`); approvals record the machine actor + classifier note via `approveHitl(…, {decidedBy:"autopilot", note})` (`engine.ts:2191`) — *"nothing fabricated, nothing deleted"*; decision rows get real timestamps (`requestedAt` think-time discipline exists for HITL, `types.ts:146-151`). The engine never asks the model to justify retroactively — the classifier's contemporaneous feedback IS the ledger text.

### 4.3 Fix specs

- **F-5 · Ring-buffer eviction honesty.** `engine.ts:2022` (`slice(-200)`) is the only gap: long runs or repeated pause/resume cycles can evict early `wild.*` rows while `lastAutoLog` still points at a newer event. Options, ranked: (a) **smallest change** — extract the `LOG_CAP` magic 200 into a named constant and raise the cap to ≥500 for `wildMode` projects only (wild runs log ~4-6 rows/phase × 13 phases ≈ 60-80, plus pause/resume chatter; 200 is survivable but tight under resume cycles); (b) when the ring evicts a `wild.*` row, append one `wild.compacted` row noting the eviction window (auditability: the user can see history was truncated, matching "lighter-touch than approval, still visible" [4]); (c) out of scope for this wave: a separate persisted wild ledger. Do (a)+(b) — both are engine-local, additive, and testable.
- **F-3 (again) · decision rows already carry `decidedBy:"autopilot"`** — keep it; add the classifier `source` ("classifier"|"dod") to the review log detail if not already implicit (it is: `wildReviewLog` prefixes `(classifier)`/`(dod)`, `engine.ts:2136`). No change needed — verified.

---

## 5. Pattern 4 — Determinism preservation when adding autonomy

### 5.1 What the field proves

- The field's structural rule is: **keep the deterministic core deterministic; add model judgment only at named seams.** Anthropic: use workflows for *"predictability and consistency"* and add *"programmatic checks (see 'gate') on any intermediate steps to ensure that the process is still on track"*; agents only when *"flexibility and model-driven decision-making are needed at scale"* — and *"agentic systems often trade latency and cost for better task performance"* [5]. OpenAI's guide is blunter about when NOT to build agents: *"Otherwise, a deterministic solution may suffice"* [11].
- **Sandboxes/verifiable steps are the autonomy enabler.** OpenHands runs agents in Docker sandboxes or on controlled backends and warns plainly that without a sandbox *"the agent will have full access to your filesystem"* [12]; Manus executes inside *"a controlled runtime environment (a kind of cloud-based sandbox)"* [10]; Codex runs *"each task … in its own cloud sandbox environment"* [6]. Verifiable checkpoints (tests/linters/typechecks that MUST run — Codex AGENTS.md rule [6]) are what make sandboxed autonomy auditable.
- **Context discipline is determinism's cousin.** Cognition: share *full agent traces*, not fragments — the main failure of decomposed agents is *"actions … based on conflicting assumptions not prescribed upfront"* [8]. A linear, single-context loop (RapidTool's phase machine) is the recommended shape over parallel freeform actors.

### 5.2 RapidTool mapping

RapidTool already follows this precisely: execution is the deterministic `applyPhaseResult` floor, identical to the sync store run (`engine.ts:2357-2370`) — model judgment is confined to the reviewer seam; unconfigured advance reviews degrade to the machine-checkable DoD verdict, never to fabricated prose (`engine.ts:2111-2129`); context for the judge is built only from real project state (`wild-mode.server.ts:15-17, 77-109`); pure prompt/parser functions are unit-testable (`wild-mode.server.ts:76, 116`); the classifier is a DI seam (`opts.reviewer`, `engine.ts:2017, 2328`); hydration coerces/repairs hostile persisted shapes (`engine.ts:1296-1332`); enforceDod post-checks run on the post-approval shape before commit (`engine.ts:2201-2214`). This is the "deterministic spine + judged gates" architecture the sources describe.

### 5.3 Fix specs

- **F-8 · Driver serialization + stale-snapshot guard.** The driver must run inside the existing `serialized(id, …)` wrapper (pattern: `store.ts:563`, comment *"serialized per project so an overlap never commits a stale snapshot over a newer run"*) and commit via the `rebaseUserFields(next, live)` merge (`store.ts:583-589`) — do NOT write a second commit path.
- **F-9 · Determinism regression tests.** New `src/lib/wild-step.test.ts` (G-2): (1) same paused project → `wildStep` returns `noop` with zero mutation (byte-compare project); (2) unconfigured-classifier advance = deterministic DoD verdict, same output twice; (3) classifier stub returning approve/reject/too-short/unparseable maps to the four honest outcomes; (4) hydrate force-stop of an active persisted run; (5) cap formula `(13-phase)*2+2` behavior on a never-advancing project → `stoppedReason:"cap"` + pause flag set; (6) stop-mid-run → `active:false, stoppedAt` stamped. All stub the completer (factory pattern `wild-mode.server.ts:131-175`) — no network in tests.
- **Do-not list (determinism hold-the-line):** never let the driver call `complete()` directly (classifier only through `wildStep`); never let `wildStep` execute more than one phase per call; never let the classifier see invented evidence (extend the existing code comment into a test that asserts prompt context is built only from `ctx.project` fields).

## 6. Pattern 5 — Known failures, mapped to RapidTool (evidence + residual risk)

| Known failure (field evidence) | RapidTool defense (landed) | Residual risk after F-1/F-4/F-6 | Verdict |
|---|---|---|---|
| **Infinite loops / no termination.** AutoGPT's recursive self-verification loops with hundreds of API calls and no deliverable [3]; IAL-Scan: 68 confirmed unbounded feedback paths across 47 real repos, including in retry/repair logic [2] | `wildStep` is one macro-action with a strict phase machine (P0→P12, no self-verification sub-loop exists); any reject/error pauses instead of retrying; `wildFinalize` seals P12 (`engine.ts:2283-2296`); hydrate force-stops orphaned runs (`engine.ts:1315-1319`) | The *driver* loop does not exist yet, so today no one can even construct an unbounded loop — after F-1 lands, the F-4 circuit + F-1 cap (graph-derived, `store.ts:513`) are the only things between a stuck classifier and a ceiling; both must land in the same wave as F-1 | Defended-by-construction + F-1/F-4 |
| **Self-approval cascades.** Judge favors own-model outputs (self-enhancement bias) [1]; maker-checker separation is the industry answer [6][12] | Gate approval requires explicit classifier verdict with ≥12-char feedback logged verbatim; forceHuman gates can NEVER be machine-approved (`engine.ts:2150-2161`); unconfigured gates pause rather than fabricate (`engine.ts:2162-2172`); classifier reject → pause, human retry only (`engine.ts:2178-2187`); hard-DoD post-check discards an approved-but-failing candidate without committing (`engine.ts:2201-2214`) | Same-model judge (F-7) — mitigate by evidence-only context (landed) + monotone-approval telemetry (F-3); approve-rate-only warning, no auto-block | Strong; F-3/F-7 close the tail |
| **Hallucinated completions / fabricated reviews.** Governance paper: post-hoc justification "likely to produce confabulated reasoning" [4]; Codex: uncertain states must be communicated, evidence cited [6] | Configured-only classifier (`wild-mode.server.ts:4-8`); unparseable payload = honest error (`:116-125, 155-162`); short feedback = honest error, never padded (`:163-170` + engine floor `engine.ts:2100-2109`); review context built only from real artifacts/DoD/lastTest (`:77-109`); every `wild.*` row is contemporaneous, never retroactive | No residual: fabrication paths are error paths, and errors pause | Closed |
| **Runaway API spend.** AutoGPT issue #6: "lack of cost awareness"; users resorted to token limits and time bounds [3]; IALs cause "cost exhaustion, model denial of service, context growth" [2] | ≤1 classifier call per `wildStep` (verified §1.2); no classifier call at all when unconfigured (deterministic floor); `maxTokens: 320` per review (`wild-mode.server.ts:148`) | No cumulative accounting exists (G-5) — after F-1, a run is bounded to ≤ `maxRuns` calls ≈ 2/phase, but there is no surfaced number; F-4b adds `classifierCalls`/`elapsedMs` to the run result (no schema change) | F-4b (cheap, additive) |
| **Conflicting parallel decisions.** Cognition: decomposed actors act on "conflicting assumptions not prescribed upfront" [8] | Single linear phase machine; one frontier phase; classifier sees the whole project object (`WildReviewContext.project`, `wild-mode.server.ts:43-49`) | None (architecture already linear) | Closed |
| **Orphaned/unstoppable runs.** Interruptibility is a governance baseline; shutdown must be graceful and always reachable [4]; session runs must not outlive their driver | Hydrate force-stop + `wild.stop` by caller (`engine.ts:1289-1332`); engine catch-all pauses with `wild.error` (`engine.ts:2381-2393`) | `stopWildRun`/`toggleWildPause` have no implementation (G-1) — an operator literally cannot stop a run today because no run can start; F-1/F-6 close this | F-1/F-6 |

---

## 7. Ranked fix-spec wave (build order, effort, acceptance)

Wave order rationale: F-1 is the critical path (everything else either rides on it or is engine-local and independent); F-9 (tests) must land with F-1 (same wave, same file family); F-4/F-6 are F-1 sub-contracts; F-5/F-2/F-3/F-4b are independent engine/classifier touches.

| id | Fix (one-liner) | File targets (anchors) | Effort | Acceptance (DoD) |
|---|---|---|---|---|
| **F-1** | Implement Wild-Mode store driver: `setWildMode`/`startWildRun`/`toggleWildPause`/`stopWildRun` with graph-derived cap, serialized, honest `WildRunResult` | `src/lib/store.ts:94-98` (interface, exists), implementation in `create()` near `runUntilHitl` (`store.ts:504-559` as the shape template), reuse `serialized()`/`rebaseUserFields` (`store.ts:563, 583-589`) | L | B6 fields untouched; cap `(13-phase)*2+2`; every outcome maps to `WildRunResult`; console B7 "not-wired" path (`console.tsx:373`) becomes unreachable for the canonical names |
| **F-9** | Wild-Mode test battery (6 named cases in §5.3) | new `src/lib/wild-step.test.ts` + `store.test.ts` additions | M | All 6 cases green with stubbed completer; 0 network; `npm run typecheck` + `npm test` green |
| **F-4** | Driver circuit breaker: 3 consecutive `wild.error` on one phase → pause + `wild.cap` log; resume resets counter | driver (F-1) | S | Never loops to ceiling on a stuck classifier; log row present; test in F-9 |
| **F-6** | Stop semantics: no double-start; stop idempotent; stop reachable mid-run between steps | driver (F-1) | S | `stopWildRun` from paused/running states ends run (`active:false`, `stoppedAt`, `wild.stop`); double-start `ok:false` |
| **F-5** | Log-ring honesty: named `LOG_CAP`, ≥500 for wild projects; `wild.compacted` row on eviction | `src/lib/engine.ts:2019-2024` | S | Long-run test: >cap wild events → eviction row present; wild rows not silently dropped |
| **F-4b** | Session-budget telemetry on run result (`classifierCalls`, `elapsedMs`; not persisted) | driver (F-1) result type `WildRunResult` (`store.ts:39-41` — additive optional fields) | S | Result envelope carries numbers; persisted shape unchanged (`_v` untouched) |
| **F-2** | Optional `temperature` on `WildCompleter` opts; classifier at fixed low value | `wild-mode.server.ts:55-58, 145-149`; `src/lib/llm.ts` opts type (verify forwarding) | S | Additive type; no behavior change when absent |
| **F-3** | Per-run review audit rows + monotone-approval calibration warning (surface-only) | driver (F-1) + result envelope | M | ≥6-review 100%-approve run flags `monotone-approval`; never blocks |
| **F-7** | Model-separation residual-risk note (no code) | driver header comment | XS | Comment cites self-enhancement bias + mitigation list |

**Explicitly NOT in this wave (coordinate, don't build):** CLI wild commands (doc 26 owns the headless wiring map — F-1 should expose the driver at lib level so a later CLI command can call it); error-code taxonomy for wild pause reasons (doc 27); wild-pause chat surfacing (doc 24/28).

---

## 8. Appendix A — file:line verification log (read-only, 2026-09-06)

Verification method: direct `read_file`/`grep` of on-disk bytes; every anchor above re-checked once during writing. Key anchors: `types.ts:121-137, 328-336`; `engine.ts:1127-1128, 1289-1332, 1978-2394` (block: 1978-2004, helpers 2019-2052, resolve 2076-2132, gates 2140-2222, leave 2228-2280, finalize 2283-2296, step 2304-2394); `wild-mode.server.ts:1-178`; `store.ts:13, 34-41, 94-98, 504-559, 563, 583-589`; `console.tsx:225-262, 296-409, 493, 518-521, 734-738`. Repo-wide greps (2026-09-06): `startWildRun|toggleWildPause|stopWildRun|setWildMode` — implementation count **0**; `wildStep|wildRun|wildMode` in `src/lib/*.test.ts` — **0**. `phases.ts` STOCK_HITL and P0-P12 titles unchanged (cross-checked via `phaseDef` consumer at `wild-mode.server.ts:78`).

## 9. Appendix B — wave merge notes

- Doc 24 (F1) landed mid-pass; docs 22/23 absent at write time; 26/27/28 in flight under the same delegation (`deleg_ba077749`). No numbered-doc collisions: this write is 25 only.
- Ownership seams for the wave: F-1 driver is store/engine territory — if doc 26 specs a CLI `wild run` command, it consumes the driver F-1 lands; if doc 27 assigns `RT_E_*` codes to wild pause reasons, they wrap the `WildRunResult`/`error` strings F-1 emits (codes belong in `errors.ts`, not this surface). Keep F-1's result strings stable prose until both land.
- Cleanup: file ends with a single trailing newline; no APPEND-POINT markers remain.

---

## Sources

| # | Source | URL |
|---|---|---|
| [1] | Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (Zheng et al. 2023) | https://arxiv.org/abs/2306.05685 |
| [2] | When Agents Do Not Stop: Infinite Agentic Loops (Hou et al. 2026) | https://arxiv.org/html/2607.01641v1 |
| [3] | AutoGPT Planning Failures case study (vectara/awesome-agent-failures) | https://raw.githubusercontent.com/vectara/awesome-agent-failures/main/docs/case-studies/autogpt-planning-failures.md |
| [4] | Practices for Governing Agentic AI Systems (OpenAI, Dec 2023) | https://cdn.openai.com/papers/practices-for-governing-agentic-ai-systems.pdf |
| [5] | Building Effective Agents (Anthropic, Dec 2024) | https://www.anthropic.com/engineering/building-effective-agents |
| [6] | Introducing Codex (OpenAI, May 2025) | https://openai.com/index/introducing-codex/ |
| [7] | Automate actions with hooks (Claude Code docs) | https://code.claude.com/docs/en/hooks-guide |
| [8] | Don't Build Multi-Agents (Cognition/Walden Yan, 2025) | https://cognition.com/blog/dont-build-multi-agents |
| [9] | Choose a design pattern for your agentic AI system (Google Cloud) | https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system |
| [10] | From Mind to Machine: The Rise of Manus AI (Shen et al. 2025) | https://arxiv.org/html/2505.02024v2 |
| [11] | A practical guide to building agents (OpenAI) | https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/ |
| [12] | OpenHands Agent Canvas README | https://raw.githubusercontent.com/OpenHands/OpenHands/main/README.md |

*All URLs extracted (not just snippet-seen) on 2026-09-06; quotes verbatim from the extracted pages. Citations are hand-written to match the ledger order registered at retrieval time.*
