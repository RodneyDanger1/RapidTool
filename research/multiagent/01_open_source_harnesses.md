# 01 — Open-Source Multi-Agent & Agentic-Coding Harnesses: What to Steal for RapidTool

> **Scope.** Cited survey of open-source multi-agent / agentic-coding frameworks, written for the
> RapidTool multi-agent research thread. Purpose: extract **reusable patterns** (roles, delegation
> protocols, memory, planning, anti-hallucination, verification) and map each to a concrete home in
> RapidTool's existing deterministic engine (`src/lib/engine.ts`, `src/lib/algorithms.ts`,
> `src/lib/packet.ts`, `src/lib/types.ts`) — the phase machine (P0–P12), `routeCrew`/`ACTIVE_BY_PHASE`
> crew router, spec-graph/contracts/oracle artifacts, DoD gates + decision ledger, and memory rows.
> Every "framework X does Y" claim below comes from a fetched page; URLs are inline and repeated in
> [Sources](#sources). Licenses are noted where stated on the fetched page — re-use the **concept**,
> not code; check each repo's LICENSE before copying anything.
>
> **Read-only research:** no RapidTool source was modified; this is the only file written
> (`research/multiagent/01_open_source_harnesses.md`).

---

## 1. Framework digests (pattern-oriented)

Legend for the six extraction lenses: **[R]** roles · **[P]** delegation/message-passing ·
**[M]** memory/context management · **[PL]** planning/decomposition · **[AH]** anti-hallucination ·
**[V]** verification/self-correction.

---

### 1.1 MetaGPT — "software company" SOP assembly line (MIT; 70k★ GitHub)
https://arxiv.org/abs/2308.00352 · https://github.com/FoundationAgents/MetaGPT

The founding "multi-agent software company": five specialized roles (Product Manager, Architect,
Project Manager, Engineer, QA Engineer) execute human-style **Standardized Operating Procedures**
(SOPs) on an assembly line.

- **[R]** Role specialization per SOP; each role produces a **structured intermediate artifact**
  (PRD → design doc → flowchart/interface spec → code → tests). The paper argues structured
  intermediate outputs "significantly increase the success rate of target code generation" because
  they keep handovers consistent and minimize ambiguity (arXiv 2308.00352, §1).
- **[P]** **Global message pool + publish–subscribe**: agents don't read everything — they
  subscribe to the message types they need (e.g., Architect subscribes to the PM's PRD, not QA
  chatter). This is explicitly an "information overload" countermeasure (arXiv 2308.00352, §E.2)
  and an anti-hallucination device: it stops "idle chatter between LLMs" ("Hi, have you had
  lunch?") that corrupts role-play chains (§1).
- **[V]** **Executive feedback mechanism**: code is debugged and executed at runtime; runtime
  feedback loops back into generation (+5.4% absolute on MBPP, §Abstract/§1). Runtime error → fix
  is built into the flow.
- **[AH]** Granular task decomposition ("requirement analysis, package selection") is framed as
  guided thinking that reduces code hallucination vs. one-shot whole-program generation (§E.1).
- Repo re-licensed MIT (GitHub page). Worth noting: the QA/verifier role exists *inside* the
  company — verification is a first-class seat, not an afterthought.

**Steal:** phase→role→structured-artifact contracts; publish–subscribe scoping of *what context each
seat receives*; a QA seat that runs the code.

---

### 1.2 CrewAI — role-playing crews: sequential / hierarchical + event-driven Flows (license: see repo)
https://github.com/crewAIInc/crewAI · https://docs.crewai.com (hierarchical-process docs)

CrewAI popularized the **Crew = Agents + Tasks + Process** model where each `Agent` declares
`role`, `goal`, `backstory`, and each `Task` declares a templated `description`, `expected_output`
and optionally `context` (explicit upstream task outputs) — the `expected_output` string doubles as
the quality bar the manager validates against.

- **[R]** Agents are pure role prompts (role/goal/backstory); tasks are bound to agents and to
  **prior tasks via `context: [...]`** (data-flow edges, from the README's own JSON example: the
  reporting task lists `"context": ["research_task"]`).
- **[P]** Two built-in processes: **sequential** (task list in order) and **hierarchical** — an
  auto-created **manager agent** "coordinates the planning and execution of tasks through
  delegation and validation of results" (CrewAI hierarchical docs). Custom manager agents can be
  supplied; `planning=True` adds a planning step. CrewAI **Flows** add `@start/@listen/@router`
  decorators over a **typed Pydantic state object** (e.g. `MarketState`), so you get
  deterministic control flow + conditional routing between crews with structured shared state
  (GitHub README example).
- **[V]** Hierarchical manager **validates outcomes**; `expected_output` is the contract it checks.
- **[AH]** Task `context` edges mean the writer sees only its inputs — same anti-context-blob idea
  as MetaGPT pub-sub, exposed as a simple declarative list.

**Steal:** `context: [prior_task]` edges as the *only* cross-seat data flow; manager agent that
delegates *and validates*; Flows-style typed state + router between crews (RapidTool already has a
router — see table).

---

### 1.3 Microsoft AutoGen — conversable agents, group chat, actor runtime (MIT; see repo)
0.2 docs: https://microsoft.github.io/autogen/0.2/docs/tutorial/conversation-patterns/ ·
stable core: https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html ·
MSR blog: https://www.microsoft.com/en-us/research/blog/autogen-enabling-next-generation-large-language-model-applications/

AutoGen's core abstraction is a **conversation** between "conversable agents"; work is done by
choosing a conversation pattern and a speaker-selection policy.

- **[P]** **Group chat manager**: a `GroupChatManager` selects the next speaker, asks it to
  respond, and broadcasts the message to all agents (MSR blog). Speaker selection strategies:
  `round_robin`, `random`, `manual` (human), and `auto` (an LLM picks) — and **constrained
  speaker selection** via an explicit `allowed_transitions` graph (agent → permitted next agents),
  which the docs present as building deterministic **StateFlow**-style pipelines (0.2 docs).
- **[P]** AutoGen core (v0.4+) is an **actor model**: `RoutedAgent`s communicate by
  publish/subscribe over typed topics (`TypeSubscription`), each agent keeps its own
  `_chat_history`, and a runtime (`SingleThreadedAgentRuntime`) delivers messages — i.e.,
  decentralized message passing rather than one big prompt (stable group-chat pattern page).
- **[R]** Roles emerge from *system messages + descriptions*; a two-agent pattern (assistant +
  user proxy) is the baseline; Magentic-One (below) is the managed multi-agent shape.
- **[AH/V]** Constraining *who may speak to whom* (transition graph) is a control mechanism that
  keeps reviewers from drifting into implementation and vice-versa.

**Steal:** speaker-selection *policies* (esp. constrained transitions = an explicit control-flow
graph over roles); broadcast-vs-point-to-point choice; per-agent chat-history separation.

---

### 1.4 Magentic-One (AutoGen/Microsoft) — Orchestrator + ledgers + stall detection
Paper: https://arxiv.org/abs/2411.04468 · framework docs: https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/magentic

Magentic-One is Microsoft's open-source generalist multi-agent system: one lead agent, the
**Orchestrator**, does all planning/coordination and hands work to swappable specialist agents
(web browser, file navigator, Python coder).

- **[R]** **Orchestrator / worker split**: the lead "plans, tracks progress, and re-plans to
  recover from errors"; workers are modular and can be added/removed **without prompt tuning**
  (arXiv abstract) — the closest production analog to RapidTool's crew-router idea.
- **[PL/P]** The Orchestrator maintains two ledgers: a **Task Ledger** (what remains) and a
  **Progress Ledger** (what was done) — it "reflects on current progress, checks completion
  status, assigns subtasks… updates the Progress Ledger… until completion or replanning"
  (cloudsummit summary of the official docs; ledger fields incl. `IsRequestSatisfied`,
  `IsInLoop`, `IsProgressBeingMade` appear in Microsoft's Agent Framework Magentic API docs).
- **[V/PL]** **Stall detection → replan**: a plan is "Replanned… because of stall detection or
  because a human revised the plan via plan review" (learn.microsoft.com). Loops/stalls are
  *measured*, not felt — bounded by `max_rounds / max_stalls / max_resets`.
- **[V]** **Human-in-the-loop plan review**: plan sign-off interrupts execution; the human can
  approve or `revise(...)` with feedback, and execution **resumes from a checkpoint** (same docs).
- **[V]** Ships **AutoGenBench**: benchmark runner with "controls for repetition and isolation to
  run agentic benchmarks in a rigorous and contained manner… when agents' actions have
  side-effects" (arXiv abstract) — evaluation as a first-class engineering artifact.

**Steal:** task+progress ledgers with *explicit stall predicates*; measured replan budgets instead
of unbounded retry; checkpoint-resume on human revision; isolated benchmark/QA runner.

---

### 1.5 LangGraph / LangChain — stateful graph runtime: checkpoints, HITL, memory
https://docs.langchain.com/oss/python/langgraph/overview ·
https://docs.langchain.com/oss/python/concepts/memory

LangGraph is a low-level **orchestration runtime**: agents are nodes in a `StateGraph` over a
typed `State`; edges can be deterministic or LLM-chosen. It deliberately does **not** dictate
roles or prompts — it provides the state/persistence substrate.

- **[PL]** Graphs = nodes + edges + (conditional) routing; core selling point: "mix deterministic,
  hand-coded steps with LLM-driven agentic steps in the same graph" so parts of a pipeline are
  "fully predictable and auditable" while others are model-driven (overview page).
- **[M]** **Short-term memory = thread-scoped state** persisted by a **checkpointer** (the graph
  can be resumed at any time); **long-term memory = a store** of JSON documents under custom
  `namespace`s, searchable by content filter and vector similarity (memory docs). The docs split
  memory into **semantic** (facts), **episodic** (past actions/experiences), **procedural**
  (instructions/system prompts) and warn that full chat history degrades LLMs over long
  contexts — "most LLMs still perform poorly over long contexts… distracted by stale or
  off-topic content" — hence trimming/filtering techniques (memory docs).
- **[V]** **Human-in-the-loop interrupts**: "inspect and modify agent state at any point"
  (overview) — LangGraph's answer to approval gates is *state inspection before continuation*.

**Steal:** typed state schema flowing through every node (RapidTool's `runAlgorithms` output
object is this shape already); checkpointer-style resume (RapidTool's JSON export/import +
repair); semantic/episodic/procedural taxonomy for memory rows; explicit "context bloat hurts
accuracy" motivation for trimming.

---

### 1.6 HuggingFace smolagents — "agents that think in code" (Apache-2.0; 29k★)
https://github.com/huggingface/smolagents · https://huggingface.co/docs/smolagents/guided_tour

smolagents is the cleanest statement of the **CodeAgent** idea: instead of emitting JSON tool
calls, the agent *writes Python* that calls tools as functions.

- **[P/AH]** Two agent types, explicitly contrasted (guided tour): **CodeAgent** (actions as
  Python — highly expressive, can compose tools/loop/transform, but needs a **secure sandbox**)
  vs **ToolCallingAgent** (actions as structured JSON tool calls — "less prone to hallucination,
  outputs are structured and validated", but inflexible). The docs' guidance: use
  ToolCalling-style for a "dispatcher/controller", CodeAgent for a "problem solver".
- **[V/AH]** Code execution is *sandboxed by policy*: default allow-list of imports +
  `additional_authorized_imports`; executors in Docker/E2B/Modal; illegal op or Python error
  stops the run (guided tour). Executing then observing output = built-in verification loop.
- **[M]** `agent.run(..., reset=False)` keeps conversation memory across calls; multi-agent
  support is via **`managed_agents`** — a manager CodeAgent that calls a sub-agent "like a tool",
  each sub-agent carrying its own name+description (guided tour, GAIA-winning multi-agent blog).
- **[R]** Sub-agents are tools with a *description the manager can read to decide when to
  delegate* — routing by declared capability, not by hard-coded phase.

**Steal:** "code/JSON tool-call" trade-off table (controllers = strict JSON; implementers = code);
executor import allow-list policy; sub-agent-as-tool delegation with capability descriptions.

---

### 1.7 OpenHands (ex-OpenDevin) — event-stream platform + CodeAct agents (MIT; 32k★ at paper time)
https://arxiv.org/abs/2407.16741 (arXiv HTML v3) · https://github.com/All-Hands-AI/OpenHands

OpenHands is a platform: **agent abstraction + event stream + runtime**, plus an agent hub and a
15-benchmark evaluation framework.

- **[P/M]** **Event stream architecture**: all actions and observations (agent's own actions,
  user messages, delegation metadata) are appended to a chronological, typed event stream; the
  agent's context is *rebuilt from the stream* at each step (State = event stream + cost
  accumulator + delegation metadata). This is the *transcript-as-memory* pattern — nothing
  happens outside the log.
- **[R]** Minimal agent = a `step(state) -> action` function over that state (arXiv §2.1 code
  sample) — roles are *prompt + allowed action set*, easy to specialize ("micro agents" reuse a
  generalist agent with task-specific prompts, §3).
- **[P/V]** **CodeAct actions**: the agent acts by writing Python/bash/browser DSL that the
  **runtime executes** in an isolated sandbox and returns observations — combining tools,
  creating its own tools (generating a Python function as a tool), and self-debugging (§2.1,
  CodeAct paper 2402.01030). Runtime is where actions become verified observations.
- **[V]** Bundled **evaluation framework over 15 benchmarks** used to grade agent versions
  (§1/§4) — agents are shipped with a repeatable grading harness.

**Steal:** append-only typed event stream as the single context source (RapidTool's traces/ledger
are close); CodeAct-style "run code, feed back real output" loop; evaluation harness discipline.

---

### 1.8 ChatDev — waterfall phases as chat chains with dual-role verification (Apache-2.0; 34k★)
https://arxiv.org/abs/2307.07924 (arXiv HTML v3) · https://github.com/OpenBMB/ChatDev

ChatDev simulates a software company over the **waterfall**: designing → coding → testing →
documenting, each stage run by a pair/trio of agents.

- **[PL/R]** Stages are split by a **chat chain into atomic subtasks**; each subtask is executed
  by **dual roles** (e.g., CEO/CTO, CTO/programmer, programmer/test-engineer, code
  reviewer + reviewer) so every proposal is examined by a counterpart — "proposing and
  validating solutions through context-aware communication" (abstract).
- **[V]** The test engineer runs the code and reports; the programmer **modifies based on the test
  report**; a reviewer passes/fails the result; the paper attributes hallucination reduction to
  this **cross-examination/mutual verification** ("absence of cross-examination in
  decision-making poses significant risks", §1) plus granular task decomposition.
- **[M]** Each atomic chat is short and scoped — context stays small per subtask.
- Whole software artifact in <7 minutes, <$1 (abstract) — evidence that *scoped sub-tasks +
  cheap verification loops* beat one giant generation.

**Steal:** every seat gets an explicit counterpart that must verify its output before the phase
advances; granular decomposition *because* whole-system generation hallucinates (§1's two causes:
lack of task specificity + no cross-examination).

---

### 1.9 gpt-engineer — natural-language prompt file → generate, execute, improve (MIT; 55k★, archived Apr 2026)
https://github.com/AntonOsika/gpt-engineer

The original "describe an app, get a codebase" CLI. Now archived (Apr 2026, page banner) and
superseded commercially, but its *loop shape* is instructive.

- **[PL]** Workflow is: put a plain-text `prompt` file in a project dir → `gpte <dir>` generates;
  `gpte <dir> -i` **improves existing code** in place; "the AI writes **and executes** the code"
  (README).
- **[V]** Execution of generated code is part of the advertised contract — generation without
  running is not the product (README). Community benchmark CLI (`bench`) against APPS/MBPP
  encouraged agent authors to measure (README).
- **[AH]** Honest limitation framing in README ("If you are looking for a well maintained hackable
  CLI… check out aider") — a rare example of a repo *telling you its failure mode*.

**Steal:** `prompt` file as the immutable input artifact (RapidTool's brief → packet is the same
idea); "improve existing code" as a first-class mode.

---

### 1.10 Aider — repo map + auto lint/test-and-fix loop (Apache-2.0; 48k★)
https://github.com/Aider-AI/aider · https://aider.chat/docs/repomap.html

Aider is the terminal pair-programmer whose two most stealable mechanisms are the **repository
map** and the **run-tests-on-every-change loop**.

- **[M/AH]** **Repo map**: before each edit request, aider sends the LLM a *concise map of the
  whole repo* — files + the most-referenced classes/functions with signatures and critical
  definition lines — so new code "respects and utilizes existing libraries, modules and
  abstractions" instead of inventing parallel ones (repomap docs = grounding in the real code).
- **[M]** For big repos the map is too large, so aider **ranks map content with a graph-ranking
  algorithm over the file-dependency graph** (files = nodes, edges = dependencies) and ships only
  the highest-ranked portion that fits a **token budget** (`--map-tokens`, default 1k) — it
  expands dynamically when no files are in context yet (repomap docs).
- **[V]** "Automatically lint and test your code every time aider makes changes. Aider can fix
  problems detected by your linters and test suites" (README §Linting & testing) — a
  verification-then-fix inner loop bound to the edit lifecycle.
- Tree-sitter extracts symbols per language (README language stats + repo file history).

**Steal:** dependency-graph-ranked context selection under a token budget (maps directly to
RapidTool's `estimateTokens` + lattice edges); mandatory lint/test gate after every mutation.

---

### 1.11 AlphaCodium — test-based, multi-stage *flow* engineering (paper CC-BY; repo Codium-ai/AlphaCodium)
https://arxiv.org/abs/2401.08500 (arXiv HTML v1)

Not a repo-harness but the canonical **"flow beats prompt"** paper for code correctness: GPT-4
pass@5 on CodeContests rose 19% → 44% from a better *process*, not a better prompt.

- **[PL]** Two phases: (1) **pre-processing** — the model reasons about the problem *in natural
  language* (problem reflection, bullet-point analysis, test reasoning) before writing code;
  (2) **iterative codegen** — generate, run against tests, fix, repeat.
- **[V]** **Test anchors**: iterate on public tests *and on AI-generated tests*. Key insight:
  "generating additional useful tests is easier than generating a correct code solution" —
  producing edge-case tests needs only problem understanding, not a full solution.
- **[AH]** Code-specific tricks (list, §Abstract/§1): **YAML structured output** (fewer tokens
  than JSON, fewer syntax errors); bullet-point semantic reasoning; **"soft decisions with double
  validation"** (don't commit to a direction on one model call); "encouraging exploration and
  postponing direct decisions"; generating **modular code**. Appendix C is an honest negative-
  results list: injecting failed traces / last-K failures / git diffs did **not** help.
- **[AH]** It frames *lengthy-spec misreading* (ignoring small details) as the core failure mode,
  which structured reflection directly attacks.

**Steal:** test-authoring is cheaper than coding → make the *tester* produce the hard cases;
run-fix loops bounded by tests; YAML/JSON-structured reasoning artifacts; double-validation
before committing a design decision.

---

### 1.12 Reflexion — verbal self-reflection in an episodic buffer (paper arXiv 2303.11366)
https://arxiv.org/abs/2303.11366

Reflexion reinforces agents **without weight updates**: after a failed trial the agent writes a
*verbal reflection* (what went wrong, why, what to change) into an **episodic memory buffer**
that is re-read on the next trial. Hit 91% pass@1 on HumanEval vs 80% for GPT-4 at the time
(abstract). This is the cleanest published justification for RapidTool's rejection-note steering:
**failure text is training signal**, and it must persist *across attempts* in memory, not just in
the current prompt.

---

### 1.13 CodeAct — executable-code action space (paper arXiv 2402.01030; ICML 2024)
https://arxiv.org/abs/2402.01030

CodeAct replaces JSON/text tool calls with **executable Python as the unified action space**:
the model can compose tools, revise prior actions, and self-debug across turns inside a Python
interpreter; +up to 20% success rate over JSON actions across 17 LLMs (abstract). Backs
OpenHands' `IPythonRunCellAction` design. Stealable claim for RapidTool: for *implementation*
seats, "act by running code and reading real output" beats "act by describing a tool call".

---

## 2. What to steal → where it maps in RapidTool

RapidTool targets named below (verified in source): `routeCrew`/`ACTIVE_BY_PHASE` + `CrewSeat`
(`role/mandate/tools/budgetTokens/handoff/active`) in `algorithms.ts`; `runAlgorithms` output
(`intentLattice` → jobs/constraints, `scheduleConstraints` → tightness, `planSpecGraph`,
`synthesizeContracts`, `buildTestOracle`, `bootstrapMemory`, `feasibilityScorecard`); engine
`approveHitl`/`rejectHitl`/`rejectionResponseBlock`/`unlockRetry`/`dedupeMemoryIds`/`stampPacket`;
DoD gates (`gate.verdict`, FNV-1a evidence hash, advisory today), decision ledger (actor
human/autopilot), append-only `rejectionHistory` (T9), packet `System JSON`, "illustrative vs
cited" honesty contract, P6 denylist-clean bounded local runner (`runP6Real`), `estimateTokens`,
`inferDomain`/`inferName`, `extraHitl`.

| # | Idea to steal | Source repo/framework | Where it maps in RapidTool |
|---|---|---|---|
| 1 | **Structured intermediate artifacts per role** (PRD→design→spec→code→tests); handovers are documents, not chatter | MetaGPT | P0–P3 already emit spec-graph/contract/oracle artifacts. Extend: every seat's `handoff` in `routeCrew` must name the *artifact id* it consumes/produces; gate `PASS` only on artifact presence + shape (spec-graph order, contracts A6, oracle A7). |
| 2 | **Publish–subscribe context scoping**: a seat only receives the message/artifact types it subscribed to (info-overload + idle-chatter filter) | MetaGPT | `CrewSeat.tools` + a new `subscribesTo: ArtifactKind[]` field; packet/phase-handoff builder renders only subscribed artifacts instead of whole project context. |
| 3 | **`context: [prior_task]` data-flow edges** on tasks | CrewAI | Spec-graph edges already order jobs; add explicit task→upstream-task context lists so phase handoff prompts carry only direct inputs. |
| 4 | **Manager seat that delegates AND validates** (`Process.hierarchical`, `planning=True`) | CrewAI | When `scheduleConstraints.tightness` is high, `routeCrew` inserts a manager seat over the ACTIVE_BY_PHASE seats; manager's `handoff` = validate each seat's artifact before next. |
| 5 | **Typed state + router events between crews** (Pydantic `MarketState`, `@router`) | CrewAI Flows | `runAlgorithms` state object is already typed; add explicit router decision points (scorecard `proceed / proceed-with-guards / reframe` already exists — wire it as a real control-flow fork between phase runs). |
| 6 | **Speaker-selection policy = constrained transition graph** (`allowed_transitions`) | AutoGen | New deterministic table `role → next roles` per phase; auto-speaker selection stays deterministic (RapidTool is engine-first), matching StateFlow philosophy. |
| 7 | **Orchestrator with Task Ledger + Progress Ledger; explicit stall predicates** (`IsInLoop`, `IsProgressBeingMade`), bounded `max_stalls/max_resets` | Magentic-One | RapidTool has the *decision ledger* (who approved/rejected) but no *progress* ledger. Add stall counters per phase (consecutive rejects with same signature); escalate verdict instead of unbounded `unlockRetry` regen. |
| 8 | **Replan on stall or human plan-revision, resume from checkpoint** | Magentic-One | `rejectHitl(note)` → recompile packet at new edge (already done); add: rejections that match a prior stall signature route to `reframe` scorecard, not to the same regenerate path. |
| 9 | **Isolated, repeatable agent evaluation (AutoGenBench: repetition + isolation for side-effectful runs)** | Magentic-One / OpenHands (15-benchmark harness) | P6 bounded local runner already isolates (hard timeout, no network, temp dir, output caps); formalize as a repeatable QA mode + per-version pass-rate ledger on oracle tests. |
| 10 | **Mix deterministic + agentic nodes in one graph; auditable parts stay deterministic** | LangGraph | RapidTool *is* this philosophy (deterministic scaffold + optional LLM narrative when `DEEPSEEK_API_KEY`). Keep any LLM additions on clearly-marked nodes; never let an LLM decide gate verdicts. |
| 11 | **Thread-scoped short-term state + checkpoint resume; long-term store with namespaces** | LangGraph | Short-term = packet + phase records (export/import JSON + `repairPhases` already round-trips = checkpoint). Long-term = memory rows; add namespace = (project, phase) and split kinds: semantic facts, episodic past-run failures, procedural DoD rules. |
| 12 | **Context-window discipline: trim/filter stale history — long context degrades accuracy** | LangGraph memory docs | Phase-handoff builder already sends bounded artifacts; enforce `estimateTokens` budget per seat (budgetTokens field exists) and drop/roll-up older memory rows before compile. |
| 13 | **Code-as-action for implementer seats: act by running code and reading output** (vs JSON tool-call prose) | smolagents CodeAgent / CodeAct / OpenHands | P6 `runP6Real` runner = the code-execution loop; implementer seat's "tools" list already includes `run_tests`/`sandbox.exec` — document CodeAct as the *behavioral contract* for the P6 module self-test. |
| 14 | **ToolCalling-vs-CodeAgent split: controllers use strict structured calls, implementers use code** | smolagents guided tour | Crew-seat `tools` taxonomy: architect/reviewer seats = ToolCalling-style (structured, "less prone to hallucination"); implementer/tester = code-exec. |
| 15 | **Executor import allow-list / sandbox policy** (`additional_authorized_imports`) | smolagents | P6 denylist exists; add an *allow-list* of imports the generated module may use; deny by default (mirrors the honesty contract: bounded runner ≠ OS sandbox). |
| 16 | **Append-only typed event stream as the single context source** | OpenHands | `runAlgorithms` traces + decision ledger + phase logs converge on this; make the event stream the *canonical* input the packet compiler reads. |
| 17 | **Atomic-scoped dual roles: every proposal gets a verifying counterpart** (reviewer must pass/fail before next stage) | ChatDev | P4/P5/P9/P12 already route to `reviewer`; add the *counterpart rule*: implementer output cannot reach next phase without a reviewer record whose verdict references the oracle result (currently reviewer seats are advisory). |
| 18 | **`prompt` file = immutable input; `-i` improve-existing mode** | gpt-engineer | Brief → `emptyProject` → packet already treats brief as input artifact; add "improve existing export" entry that imports JSON (`hydrateProject`) and re-runs phases as an explicit mode. |
| 19 | **Repo map: dependency-graph-ranked symbol context under a token budget** | Aider | New deterministic algorithm: rank memory rows/prior artifacts by graph centrality over lattice job-dependency edges; select top-N within seat `budgetTokens` via `estimateTokens` (algorithm fits `algorithms.ts` style). |
| 20 | **Auto lint/test every mutation; fix what the checker flags** | Aider | P6 runner already does this; extend DoD gate record to store checker evidence (lint output + test run) as the FNV-1a-hashed evidence (hash field exists). |
| 21 | **Test-first flow: AI-generated edge-case tests anchor the fix loop; writing tests is easier than writing code** | AlphaCodium | `buildTestOracle` is the anchor; enrich oracle with adversarial cases from constraints + a tester-generated edge list; gate PASS = oracle green (public + adversarial), never a self-report. |
| 22 | **YAML/structured reasoning artifacts; soft decisions w/ double validation; modular code** | AlphaCodium | Phase narrative (LLM) artifact should be structured (not prose-only); design decisions that flip-flop get "two independent checks" before committing (map to double-validation). |
| 23 | **Verbal reflection episodes persisted in episodic memory between attempts** | Reflexion | `rejectHitl(note)` already requires 12+ chars and appends to `rejectionHistory`; upgrade to structured reflection rows (error class, cause, constraint to honor) surfaced in the next phase handoff + reviewer mandate. |
| 24 | **Sub-agents as tools with capability descriptions the manager routes on** | smolagents `managed_agents` | `routeCrew` seat `mandate`/`tools` text already serves this; add a `capability` summary per seat so future auto-routing can pick by capability, not just by phase. |
| 25 | **Honest negative-results reporting (what did NOT help) | AlphaCodium App. C / gpt-engineer README | RapidTool's "illustrative ≠ fact" honesty contract is the same culture; keep a per-phase "failed approaches" list in memory so seats don't repeat dead ends (feeds #23). |

---

## 3. Ranked enhancement proposals for RapidTool

Ranked by expected contribution to **zero-hallucination, verifiably-correct code output** for the
least engine churn. Each is implementable deterministically; the optional LLM hooks only light up
when `DEEPSEEK_API_KEY`/`TAVILY_API_KEY` are set (consistent with the existing honesty contract).

### E1 — Verifier-led gates with stall detection and replay budget  *(rank 1)*
**Why it matters.** Today DoD gates are *advisory* records (AGENT_GUIDE §1/§5: "they never block a
run") and `unlockRetry` regenerates on rejection. The strongest signal across Magentic-One, ChatDev
and AlphaCodium is that *verification must be structural and bounded*: every output requires an
independent check before the phase advances, and stalls are detected and re-planned rather than
retried forever.
**How.** (a) Split the gate verdict into two independently-recorded checks — **deterministic
evidence** (oracle/lint/denylist run in the P6 runner) **and a reviewer-seat verdict** referencing
that evidence (ChatDev counterpart rule; Magentic-One ledger): `gate.PASS` requires both rows, each
FNV-1a-hashed. (b) Add a **progress ledger** (per phase: attempt, verdict, evidence hash,
stall-predicate) beside the decision ledger, with Magentic-One-style predicates
(`isLooping`, `isProgressing`) computed from rejection signatures (same error class repeated → loop).
(c) When stall counter ≥ threshold, escalate scorecard `proceed → proceed-with-guards → reframe`
instead of re-running the same phase (feasibilityScorecard verdict already exists as the escalation
vocabulary). Maps to: gate records, decision ledger, `approveHitl`/`rejectHitl`/`unlockRetry`,
`feasibilityScorecard`, reviewer seats in `ACTIVE_BY_PHASE`.

### E2 — Reflection episodes: structured rejection memory that steers the next attempt  *(rank 2)*
**Why it matters.** Reflexion's 91%-pass@1 result is the strongest published evidence that *verbal
reflection persisted across attempts* is the cheapest accuracy lever available; RapidTool already
collects the raw material (rejection notes) but stores it as opaque append-only text.
**How.** On each `rejectHitl`, derive a **ReflectionEpisode** row (deterministic classification from
the note + phase artifacts, or an LLM-written reflection when the DeepSeek key is set): fields =
error class, likely cause, constraint-to-honor, "do not repeat" pointer. Store as episodic memory
(namespaced per project+phase, deduped by `dedupeMemoryIds`), and **auto-inject the last N
episodes into the next phase-handoff prompt** (as prior-failure constraints) and into the reviewer
seat's mandate (ChatDev: reviewer checks the fix actually addresses the recorded failure). Also
surface episodes in the packet `System JSON` so the *external* coding agent inherits them.
Maps to: memory rows/`bootstrapMemory`, `rejectionResponseBlock`, packet compile/`stampPacket`,
phase-handoff prompt builder.

### E3 — Test-anchored adversarial oracle enrichment (tester authors the hard cases)  *(rank 3)*
**Why it matters.** AlphaCodium's central, counter-intuitive finding: **generating hard tests is
easier than generating correct code**, and iterating against AI-generated edge cases is what moved
GPT-4 from 19%→44%. RapidTool already generates a deterministic oracle (`buildTestOracle`) but the
DoD checks it once; the *tester seat has no way to contribute harder cases*, which is where spec
misreadings and hallucinated endpoints actually get caught.
**How.** Give the tester seat an **oracle-enrichment step** in P5/P6: from `synthesizeContracts`
and `lattice.constraints`, generate an adversarial checklist (one case per constraint + per
contract field: empty input, missing dependency, unauthorized endpoint, PHI/PII leakage —
mirroring the reviewer mandate's existing rejection vocabulary). Enriched cases are appended to
the oracle artifact and the DoD gate becomes **"public oracle + adversarial oracle both green"**
(test anchors). Runs happen in the existing bounded P6 runner. When an LLM is configured, the
enrichment prompt follows AlphaCodium's "soft decision, double validation": no case is admitted
until two checks agree it is legal under the contract. Maps to: `buildTestOracle`, tester seat
tools/mandate in `routeCrew`, DoD gate evidence, `runP6Real`.

### E4 — Grounded-citation enforcement for research phases (facts must carry a source)  *(rank 4)*
**Why it matters.** The zero-hallucination goal fails first in P0/P7/P11 research: the honest
`illustrative vs cited` flag exists, but nothing *forces* the LLM narrative to attach verifiable
sources, so plausible-but-false rows can slip through as "cited". smolagents' WebSearchTool +
tool-call-verification and AlphaCodium's structured-YAML discipline both attack exactly this.
**How.** (a) When live research is enabled (`TAVILY_API_KEY`), the research seat becomes a
**ToolCalling-style agent** (smolagents guidance: structured calls = less hallucination-prone):
each research row must be emitted as structured JSON with `claim`, `source_url`, `quote` fields —
rows without a source URL are downgraded to `illustrative` automatically at compile time.
(b) Prompt contract: "return only facts found in fetched pages; no synthesis without a source"
(grounding rule) and cross-check: claims citing the same URL must match its extracted text
(verifiable via the same fetch pipeline). (c) Record per-row `source` in the memory rows so later
phases and the external agent can trace every claim. Maps to: research phase LLM narrative
artifact, illustrative/cited honesty contract, packet System JSON, memory schema; reuses
CrewAI `expected_output`-style schema validation for the narrative artifact.

---

## Sources
- MetaGPT paper: https://arxiv.org/abs/2308.00352 · repo: https://github.com/FoundationAgents/MetaGPT
- CrewAI repo: https://github.com/crewAIInc/crewAI · hierarchical process docs: https://docs.crewai.com/v1.15.17/en/learn/hierarchical-process
- AutoGen 0.2 conversation patterns: https://microsoft.github.io/autogen/0.2/docs/tutorial/conversation-patterns/ · stable core group chat: https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html · MSR blog: https://www.microsoft.com/en-us/research/blog/autogen-enabling-next-generation-large-language-model-applications/
- Magentic-One paper: https://arxiv.org/abs/2411.04468 · Magentic orchestration docs (ledgers, stall detection, plan review, checkpoints): https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/magentic
- LangGraph overview: https://docs.langchain.com/oss/python/langgraph/overview · LangChain memory concepts (short/long-term, semantic/episodic/procedural, context degradation): https://docs.langchain.com/oss/python/concepts/memory
- smolagents repo: https://github.com/huggingface/smolagents · guided tour (CodeAgent vs ToolCallingAgent, sandboxing, managed agents, reset=False): https://huggingface.co/docs/smolagents/guided_tour
- OpenHands paper: https://arxiv.org/abs/2407.16741 · project site: https://www.openhands.dev/
- ChatDev paper: https://arxiv.org/abs/2307.07924 · repo: https://github.com/OpenBMB/ChatDev
- gpt-engineer repo (archived): https://github.com/AntonOsika/gpt-engineer
- Aider repo: https://github.com/Aider-AI/aider · repo-map docs: https://aider.chat/docs/repomap.html
- AlphaCodium paper: https://arxiv.org/abs/2401.08500
- Reflexion paper: https://arxiv.org/abs/2303.11366
- CodeAct paper: https://arxiv.org/abs/2402.01030
- RapidTool source read (read-only): `src/lib/engine.ts`, `src/lib/algorithms.ts`, `src/lib/packet.ts`, `src/lib/types.ts`, `AGENT_GUIDE.md`
