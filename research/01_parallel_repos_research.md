# 01 — Parallel Repos & Products Research: Autonomous Software Builders vs. RapidTool

> Research snapshot: 2026-09-04 · Purpose: compare external agentic-dev platforms / "software factories" against **RapidTool**'s governed 13-phase console, and extract mechanisms RapidTool lacks. Every factual claim carries its source URL. Code snippets are verbatim from the cited sources (excerpts marked with `…`). Product-marketing pages are flagged as such where used.

---

## 1. RapidTool baseline (the subject being compared)

RapidTool is a client-side "autonomous software agency" console (TanStack Start, React 19, Tailwind v4) that runs inside an iframe preview inside Grok chat. Human pastes a brief; a **deterministic 13-phase graph P0–P12** executes phase-by-phase with **HITL approval gates** and per-phase artifact synthesis.

| Engine fact | RapidTool today |
|---|---|
| Orchestration | Deterministic phase machine P0–P12 (deep research/feasibility → orchestration graph → memory consolidation → MCP/A2A tooling → security isolation [HITL] → validation [HITL] → codegen → market research → UI prototyping [HITL] → CI/CD routing [HITL] → local-edge inference → real-time web tools → docs/specs) |
| HITL | 4 approval gates (P4 security, P5 validation, P8 UI proto, P9 CI/CD); rejection feedback requires ≥12 chars |
| Feasibility | 5-axis scorecard (feasibility/scale/security/api-risk/delivery) → /10 → verdict `proceed \| proceed-with-guards` (`reframe` exists but is unreachable) |
| Algorithms | A1 Intent Lattice (lexicon brief parse); A2 FusionRank (kind-bucketed pseudo-RRF k=60 + heuristic "cross-encoder" constant); A3 Constraint Scheduler (security/api deltas, tightness score, extra gates); A4 Agent Packet (paste-ready markdown ≤14000 chars for external agents: system rules/mission/lattice/schedule/crew/spec order/contracts/oracle tests/ranked memory); A5 Spec Graph (Kahn topological order: schema→api→store→ui→tests); A6 Contract Synth (entity banks + REST endpoints); A7 Test Oracle (happy-path + constraint-violation + graph-safety tests); A8 Crew Router (architect/implementer/reviewer/tester seats, token budgets, active per phase) |
| State | zustand + localStorage only; `db.ts` (PGlite/Neon dual driver + migrations) is **orphaned from the engine**; `ai.ts` (xAI grok server fn) is **dead code** |
| Execution sandbox | `sandbox.ts`: generated JS via `new Function` + denylist; **no timeout, no OS isolation** |
| Testing | **No unit tests** exist for engine/algorithms/store/sandbox/packet |
| Console UX | 5 tabs (Artifacts / Agent packet / Spec graph / Crew / Oracle), memory rail (episodic/procedural/semantic + score), diagnostics log, autopilot toggle |

External-agent philosophy: RapidTool is deliberately an **orchestrator + prompt compiler**, not a coder — it emits A4 "agent packets" that external agents execute, then validates results. That makes the mechanisms below relevant in two modes: (a) things RapidTool's *own engine* should do (durability, checkpoints, eval), and (b) things the *external agents it drives* expect (AGENTS.md/CLAUDE.md conventions, sandboxes, approval UX, structured handoffs).

---

## 2. Method & evidence rules

- Sources: official GitHub READMEs (raw), official docs, engineering blogs, product pages, and — only where marked — reputable third-party analysis.
- Open-source claims were extracted from the repos themselves; framework claims from official docs; SaaS marketing claims are explicitly labelled "vendor claims".
- Snapshot caveats: the ecosystem moves fast. Two notable changes surfaced during research: **gpt-pilot is now unmaintained and was the victim of a supply-chain worm** (see §3.6), and **OpenHands reorganized** into the `OpenHands` org with its flagship UI now "Agent Canvas" (§3.1).
- Later sections: §3 per-project one-pagers → §4 mechanisms RapidTool lacks (2+ projects each, with snippets) → §5 gap table → §6 ranked borrow list → §7 URL inventory.

---

## 3. Per-project one-pagers

### 3.1 OpenHands / Agent Canvas (All-Hands-AI → OpenHands)

- **What it is**: Open-source "AI software engineer" platform. As of the 2026 snapshot, the flagship surface is **Agent Canvas — "the self-hosted developer control center for coding agents and automations"** — that runs OpenHands *and* any ACP-compatible agent (Claude Code, Codex, Gemini) across local/Docker/VM/cloud backends. Repo: https://github.com/OpenHands/OpenHands · README: https://raw.githubusercontent.com/All-Hands-AI/OpenHands/main/README.md · docs: https://docs.openhands.dev/openhands/usage/agent-canvas/backends
- **Architecture pattern**: **control plane + agent server + automation server**. "Agent Canvas is powered by the OpenHands Agent Server, a REST API for running multiple agents on a single machine… often paired with an Automation Server, which lets you set up agents that run on a schedule or in response to events." (README)
- **State / checkpoints / events**: conversational sessions + typed **events**; conversations/workspaces/events are first-class server concepts (per repo-boundary table: software-agent-sdk owns "conversations, workspaces, events").
- **HITL**: user in the loop from the Canvas UI; approval is conversational.
- **Spec→code**: issue decomposition ("automatically decomposing GitHub issues into tasks") is a listed automation use case.
- **Sandboxing**: default Docker sandbox (`docker run … -v "$PROJECTS_PATH:/projects" ghcr.io/openhands/agent-canvas`), with an explicit warning that running the agent-server without a sandbox gives "full access to your filesystem".
- **Artifact handoff**: ACP (Agent-Client Protocol) is the interchange layer between the canvas and third-party agents — a *protocol*, not a paste-able prompt.
- **RapidTool parallel**: RapidTool's console ↔ Agent Canvas's control center; RapidTool's A4 packet ↔ ACP/backends. Gap: OpenHands persists run history and automation state server-side; RapidTool is localStorage-only.

### 3.2 Aider (Aider-AI/aider)

- **What it is**: terminal AI pair-programmer; edits code in your git repo. Repo: https://github.com/Aider-AI/aider · docs: https://aider.chat/docs/repomap.html · features: https://aider.chat/docs/usage/lint-test.html
- **Architecture pattern**: single-agent, edit-format driven, **git-native**: "automatically commits changes with sensible commit messages. Use familiar git tools to easily diff, manage and undo AI changes." (README)
- **Context engineering (repo map)**: builds "a concise map of your whole git repository that includes the most important classes and functions along with their types and call signatures"; sends only the most relevant portion, ranked by "a graph ranking algorithm, computed on a graph where each source file is a node and edges connect files which have dependencies", sized by a **token budget** (`--map-tokens`, default 1k) that expands dynamically when no files are pinned. (repomap docs)
- **Verification loop**: "Automatically lint and test your code every time aider makes changes. Aider can fix problems detected by your linters and test suites." (README)
- **RapidTool parallel**: A2 FusionRank ≈ repo-map ranking (but Aider ranks *code symbols for context injection*, RapidTool ranks *memory for a packet*); Aider proves the "rank → budget → inject" discipline RapidTool's fixed 14k packet lacks.

### 3.3 MetaGPT (FoundationAgents/MetaGPT)

- **What it is**: "MetaGPT: The Multi-Agent Framework… Assign different roles to GPTs to form a collaborative entity for complex tasks." Repo: https://github.com/FoundationAgents/MetaGPT · README: https://raw.githubusercontent.com/FoundationAgents/MetaGPT/main/README.md
- **Architecture pattern**: **Software-company-as-multi-agent-system with materialized SOPs**. "`Code = SOP(Team)` is the core philosophy. We materialize SOP and apply it to teams composed of LLMs." Roles: product managers / architects / project managers / engineers. One line of requirements → "user stories / competitive analysis / requirements / data structures / APIs / documents".
- **Spec→code**: role outputs are *structured intermediate documents* (PRD, design doc, tasks) — the same artifact chain RapidTool's P2–P6 synthesize.
- **Recent research**: AFlow (ICLR 2025 oral) — automated agentic workflow generation; SPO/AOT papers; MGX product ("world's first AI agent development team").
- Library usage (README): `from metagpt.software_company import generate_repo; repo = generate_repo("Create a 2048 game")`
- **RapidTool parallel**: MetaGPT is the closest academic ancestor of RapidTool's role/SOP graph (A8 seats ↔ role agents). Gap: MetaGPT teams are *autonomous chat loops* — no HITL gates, no checkpoints, no sandbox; RapidTool's governance is the differentiator, but it lacks MetaGPT's *intermediate-document quality bar* (structured PRDs that human PMs can review).

### 3.4 ChatDev (OpenBMB/ChatDev)

- **What it is**: "Virtual Software Company" using CEO/CTO/Programmer-style agents in phase pipelines (1.0), now also **ChatDev 2.0 "DevAll"**, a zero-code multi-agent orchestration platform (agents/workflows defined by config, no code). Repo: https://github.com/OpenBMB/ChatDev · README: https://raw.githubusercontent.com/OpenBMB/ChatDev/main/README.md · paper: https://arxiv.org/abs/2307.07924
- **Architecture pattern**: chain-shaped **chat chain of phases**; each phase = instructor/assistant seminars; fully configurable "ChatChain, Phase and Role settings".
- **Mechanisms of interest**:
  - **Human-Agent-Interaction mode**: human plays *reviewer* and sends suggestions back to the programmer (`python3 run.py --task … --config "Human"`).
  - **Git mode**: `"git_management": "True"` in ChatChainConfig.json — programmer uses git for version control.
  - **Docker mode** for "safe execution".
  - **Log + replay mode** (2023 news): runs are logged and *replayable*.
  - **Incremental development** on existing code.
  - **Experiential Co-Learning (ECL)** and **Iterative Experience Refinement (IER)**: instructor/assistant agents accumulate "shortcut-oriented experiences" to adapt to new tasks (arxiv 2312.17025, 2405.04219) — the research ancestor of RapidTool's memory rail (episodic/procedural/semantic + score).
  - **MacNet**: DAG collaboration topologies scaling to 1000+ agents; **puppeteer**: RL-learned central orchestrator that dynamically activates agents (arxiv 2505.19591, NeurIPS 2025).
- **RapidTool parallel**: phase pipeline + reviewer HITL + experience memory — nearly the same skeleton. Gap: ChatDev ships replay/log mode and Docker isolation; RapidTool has neither.

### 3.5 GPT Pilot (Pythagora-IO/gpt-pilot)

- **What it is**: research-y "AI developer companion that builds full apps step-by-step with a human dev in the loop". ⚠️ README now carries a **security advisory**: a supply-chain worm (credential stealer) hidden in `core/telemetry/` from Aug 2025 to 11 Jun 2026; **repo is no longer maintained**. Repo+README: https://raw.githubusercontent.com/Pythagora-IO/gpt-pilot/main/README.md · blog lessons: https://blog.pythagora.ai/2024/02/19/gpt-pilot-what-did-we-learn-in-6-months-of-working-on-a-codegen-pair-programmer/
- **Architecture pattern**: **role pipeline with persistence**: Specification Writer → Architect → Tech Lead → Developer → **Code Monkey** → **Reviewer (sends work back to Code Monkey)** → Troubleshooter → Debugger → Technical Writer. "GPT Pilot codes the app step by step just like a developer would in real life."
- **State / resume**: sqlite (or Postgres) stores project steps; `python main.py --project <app_id> --step <step>` resumes at a step (deleting later progress — explicit rollback semantics).
- **Context filtering**: "it has mechanisms that filter out the code, so in each LLM conversation… it shows the LLM only the relevant code for the current task" — an early repo-map-style filter.
- **Security lesson for RapidTool**: gpt-pilot's worm rode in through a *telemetry hook* in an unmaintained OSS repo. RapidTool's A4 packet pushes prompts to *external agents*, so it inherits supply-chain exposure (a compromised agent tool could exfiltrate the brief/artifacts). Borrow: pin versions, audit deps, treat generated code as untrusted.

### 3.6 Smol developer / GPT-Engineer (context anchors)

- gpt-pilot's README explicitly contrasts itself with **Smol developer** (https://github.com/smol-ai/developer) and GPT-Engineer: those emit the whole codebase in one shot; gpt-pilot's incremental step loop exists because one-shot generation is hard to debug. RapidTool's phase machine already chose the incremental camp; the smol-dev one-shot pattern survives only in RapidTool's P7 codegen blast.

### 3.7 Bolt.new (StackBlitz)

- **What it is**: "AI-powered web development agent… prompt, run, edit, and deploy full-stack applications directly from your browser" — **open source**. Repo: https://github.com/stackblitz/bolt.new
- **Architecture pattern**: **environment control as the differentiator**: "Bolt.new gives AI models complete control over the entire environment including the filesystem, node server, package manager, terminal, and browser console" via **WebContainers** (in-browser Node).
- **Sandboxing**: WebContainers = browser-sandboxed execution (no cloud VM needed).
- **RapidTool parallel**: RapidTool runs in an iframe inside Grok chat — a natural host for a WebContainers-style in-browser execution sandbox instead of `new Function`. StackBlitz's WebContainer API: https://webcontainers.io

---

### 3.8 LangGraph (LangChain) — state-graph HITL reference

- **What it is**: low-level orchestration framework where agents are **graphs with typed state, checkpointed persistence, interrupts, and streaming**. Docs (2026): interrupts https://docs.langchain.com/oss/python/langgraph/interrupts (canonical URL redirects from https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/) · persistence https://docs.langchain.com/oss/python/langgraph/persistence · repo https://github.com/langchain-ai/langgraph
- **State**: typed `State` schema; nodes return state deltas; reducers (e.g. `Annotated[list, operator.add]`) define merges.
- **Checkpoints**: "Checkpointers persist a thread's graph state as checkpoints. Use them for short-term, thread-scoped memory, including conversation continuity, human-in-the-loop workflows, **time travel**, and fault tolerance." A durable checkpointer (Postgres/SQLite) is required in production; `thread_id` is the resume cursor. Long-term cross-thread memory is a separate **Store**.
- **HITL**: dynamic `interrupt()` inside nodes + `Command(resume=…)`; static breakpoints `interrupt_before/after` at compile time; streaming loop surfaces interrupts via `stream.interrupts` / `stream.interrupted`.
- **RapidTool parallel**: RapidTool's P0–P12 graph is *implicit* (hand-rolled phase machine in zustand); LangGraph makes graph structure, state, checkpoints and resume points *explicit data*. RapidTool's 4 gates are static-equivalent breakpoints; LangGraph's `interrupt()` is a dynamic mid-node pause RapidTool cannot express today.

### 3.9 CrewAI — crews (autonomy) vs flows (determinism)

- **What it is**: "open-source Python framework with high-level abstractions and low-level APIs for building production-ready multi-agent workflows… autonomous agent collaboration through Crews and precise, event-driven control through Flows." Repo: https://github.com/crewAIInc/crewAI · docs: https://docs.crewai.com
- **Architecture pattern**: dual abstraction — **Crews** (role-based agents, autonomous delegation) and **Flows** (deterministic, event-driven, "secure, consistent state management between tasks", conditional branching, native Python).
- **Config-as-code**: `crewai create crew` produces a JSON-first project: `agents/*.jsonc` (role, goal, backstory, LLM, tools, **guardrails**) + `crew.jsonc`; `crewai run` executes it. (README project tree.)
- **HITL & structured output**: tasks support human review and `output_pydantic`/`output_json` structured outputs; guardrails are a first-class agent property (README skills table).
- **Observability**: tracing/observability is pushed to the commercial CrewAI AMP "Crew Control Plane" (metrics, logs, traces).
- **RapidTool parallel**: RapidTool's A8 Crew Router (seats with token budgets per phase) ≈ a Crew; RapidTool's P0–P12 phase machine ≈ a Flow. Gap: RapidTool hardcodes the crew policy in JS; CrewAI externalizes crews/tasks/guardrails into reviewable JSONC artifacts.

### 3.10 Temporal — durable execution (workflow-as-code)

- **What it is**: open-source durable execution platform; the industry's canonical answer to "long-running multi-step process that must survive crashes, restarts, and human delays". Landing: https://temporal.io · understanding doc: https://docs.temporal.io/evaluate/understanding-temporal · event-history doc: https://docs.temporal.io/workflow-execution/event
- **Core mechanism**: workflows are deterministic code re-executed from an **Event History** — "a complete and durable log of everything that has happened in the lifecycle of a Workflow Execution" — during **Replay**: "a Worker requests the Event History and re-executes the Workflow code with the original input… Commands the Worker creates during Replay are matched against the Event History instead of being issued, so Activities don't run again." (docs)
- **Why it matters for RapidTool**: a 13-phase run with 4 human gates can take hours/days; today any tab refresh or browser GC can lose RapidTool's run (localStorage). Temporal-style *event-sourced phase history + replay* is the durable-execution pattern that makes governed pipelines auditable and resumable. (Not a JS-embedded fit; the *pattern* is the borrow — see §4.1.)

### 3.11 Vercel AI SDK — typed tools, approvals, loop caps, sandboxes

- **What it is**: TS toolkit for AI apps/agents (v7 docs): typed `tool()` with Zod `inputSchema` (validated tool calls), `stopWhen` loop control, tool approvals, lifecycle callbacks, `experimental_sandbox`, MCP tools, and an AI SDK Workflow reference. Docs: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling · tool approvals: https://ai-sdk.dev/docs/agents/tool-approvals · workflow ref: https://ai-sdk.dev/docs/reference/ai-sdk-workflow
- **HITL granularity**: per-tool approval config — `toolApproval: { runCommand: 'user-approval' }` — plus a "policy-based tool approvals" page (https://ai-sdk.dev/docs/agents/policy-tool-approvals), i.e. approval *policies*, not all-or-nothing modes.
- **Loop caps**: `stopWhen: isStepCount(5)` — the model loop terminates after N steps (antidote to runaway autopilot).
- **Sandbox plumbing**: tools receive an `experimental_sandbox` handle and *throw when absent* (`if (!experimental_sandbox) throw new Error('Experimental sandbox is not available')`).
- **Observability**: `onToolExecutionStart/End` lifecycle hooks emit toolCallId/inputs/durations/errors.
- **RapidTool parallel**: RapidTool's HITL gates are *phase-level*; AI SDK shows tool-level approval policies + step caps that map directly onto autopilot-mode RapidTool runs.

### 3.12 Anthropic — Claude Code, CLAUDE.md, hooks, verification (agentic-coding conventions)

- **What it is**: Anthropic's agentic coding environment + the *conventions* it created (CLAUDE.md) that the whole industry now mirrors (AGENTS.md, §3.16). Best-practices doc: https://www.anthropic.com/engineering/claude-code-best-practices (mirror: https://code.claude.com/docs/en/best-practices) · multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system · context engineering: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- **Verification-first**: "Give Claude a way to verify its work… a check it can run: tests, a build, a screenshot to compare… the loop closes on its own." Escalation ladder: in-prompt checks → `/goal` (separate evaluator re-checks after every turn) → **Stop hooks** (deterministic gate; "Claude Code overrides the hook and ends the turn after 8 consecutive blocks") → verification subagent ("a fresh model tries to refute the result, so the agent doing the work isn't the one grading it").
- **Explore→plan→code→commit**: plan mode (`claude --permission-mode plan`) forces read-only exploration + an editable plan before implementation.
- **Adversarial review**: run `/code-review` or a custom reviewer subagent "in a fresh context [that] sees only the diff and the criteria you give it, not the reasoning that produced the change".
- **Permissions & sandboxing**: Manual mode asks per risky action; **permission allowlists** pre-approve known-safe commands; auto mode runs "a separate classifier model [that] reviews most actions… and blocks only what looks risky"; OS-level sandboxing restricts filesystem/network.
- **CLAUDE.md**: auto-loaded persistent instruction file — "Include Bash commands, code style, and workflow rules… keep it short"; `/init` scaffolds it; on-demand knowledge moves to **skills** ("Claude loads them on demand without bloating every conversation").
- **Context engineering** (post): context rot as context fills; treat context as a finite "attention budget"; subagents explore with big contexts and "return only a condensed, distilled summary of its work (often 1,000–2,000 tokens)"; compaction vs note-taking vs sub-agents; file-based memory tool for knowledge across sessions.
- **Multi-agent research system**: orchestrator–worker: lead agent plans, spawns parallel subagents, subagents write artifacts; measured ~4× tokens vs chat and ~15× for multi-agent; "multi-agent systems use about 15× more tokens than chats"; internal eval: Opus-4-lead/Sonnet-4-workers beat single Opus 4 by **90.2%** on breadth-first research; **end-state evaluation** ("evaluate whether it achieved the correct final state" rather than turn-by-turn); "Subagent output to a filesystem to minimize the 'game of telephone'… implement artifact systems where specialized agents can create outputs that persist independently… then pass lightweight references back to the coordinator."
- **RapidTool parallel**: A4 packet ≈ a curated system prompt; RapidTool's 14k budget and memory rail ≈ context engineering, but the packet is static (no dynamic repo-map-style rank-to-budget). RapidTool's validation phase ≈ verification-first, but without runnable check gates. Its A8 "reviewer seat" is the adversarial-review idea, minus fresh-context isolation.

---

### 3.13 Devin (Cognition)

- **What it is**: commercial autonomous AI software engineer ("Devin, the AI software engineer"). Product claims (vendor page): plans/executes complex engineering tasks; "Devin can spin up a team of Devins for large tasks"; "Devin gets better over time by reading past session trajectories"; approved **knowledge** entries are context-injected per repo ("Approved new knowledge: When working in the backend repo"); ships PRs and "pick[s] up review feedback and CI results"; scheduled chores, Devin API + Automations; DeepWiki for auto-docs. https://devin.ai · docs: https://docs.devin.ai (knowledge model) — vendor marketing unless noted.
- **RapidTool parallel**: trajectory-learning + curated knowledge bank = the *same ambition* as RapidTool's episodic/procedural memory rail — but Devin's is server-side and per-repo, and *rejected knowledge never gets injected* (approval-before-use — RapidTool memory scores everything into packets without an approval step).

### 3.14 Google Jules

- **What it is**: Google's async coding agent ("Jules is your end-to-end agentic product development platform… then ships a PR" per its own tagline; vendor claims + third-party analysis: https://dev.to/jubinsoni/jules-googles-async-coding-agent-is-changing-how-we-think-about-ai-and-software-development-3j0d). Google blog (official): https://blog.google/innovation-and-ai/models-and-research/google-labs/jules-tools-jules-api/ · product: https://jules.google.com/session
- **Architecture pattern (third-party analysis, marked)**: task pool → per-task isolated cloud VM (repo cloned in) → planner model (Gemini Pro) writes plan → executor (Gemini Flash) implements → self-review → PR; two-model plan/execute split; async queue model rather than chat.
- **RapidTool parallel**: P1/P2 feasibility + A8 crew model-choice echoes Jules's planner/executor split; RapidTool's CI/CD routing phase (P9) is conceptually the "deliver as PR with test output" step.

### 3.15 Amazon Kiro — spec-driven agentic IDE

- **What it is**: AWS's agentic IDE built around **spec-driven development**. AWS docs: "Kiro is an agentic coding service that works alongside you to turn prompts into detailed specs, then into working code, docs, and tests." https://aws.amazon.com/documentation-overview/kiro/ · product site: https://kiro.dev/ · announcement coverage: https://www.infoq.com/news/2025/08/aws-kiro-spec-driven-agent/ ("Beyond Vibe Coding: Amazon Introduces Kiro, the Spec-Driven Agentic AI IDE", Aug 2025)
- **RapidTool parallel**: Kiro productized the exact pipeline RapidTool runs serverlessly in a chat iframe: prompt → spec → plan → code/docs/tests. Its existence validates RapidTool's P0/P2/P5/P6/P12 emphasis on spec-before-code artifacts.

### 3.16 GitHub Spec Kit + agents.md + AGENTS.md conventions (spec-driven & agent-instruction standards)

- **Spec Kit** (github/spec-kit): "An open source toolkit for building high-quality software with any AI coding agent — a ready-to-use spec-driven process… Specify → Plan → Tasks → Implement → **Converge**", where implement/converge repeat "until `/speckit-converge` reports **Converged**"; plus `/speckit-constitution` (project principles), optional `/speckit.clarify`, `/speckit.analyze` (cross-artifact consistency), `/speckit.checklist` ("like 'unit tests for English'"), an **assess extension** (intake → research → define → shape → decide with a documented **go / needs-clarification / kill** decision), a **bug extension** (assess → fix → test), and an extension/preset/bundle system layered over `.specify/templates/`. Repo: https://github.com/github/spec-kit · docs: https://github.github.io/spec-kit/
- **agents.md** (OpenAI): "a simple, open format for guiding coding agents… a README for agents: a dedicated, predictable place to provide context and instructions." Repo: https://github.com/openai/agents.md · site: https://agents.md
- **Claude Code AGENTS.md/CLAUDE.md conventions**: §3.12. Cross-tool convention now consumed by Claude Code, Codex, Copilot, Gemini, Grok, Cursor (spec-kit integration list: "Spec Kit works with 30+ AI coding agents").
- **RapidTool parallel**: RapidTool's A4 packet re-invents what the ecosystem standardized as *checked-in instruction files*: CLAUDE.md/AGENTS.md should become a *compiled output of phase P0/P2/P6* (write AGENTS.md into the generated project), and Spec Kit's converge loop is the missing closure condition for RapidTool's P5/P7 validation (compare codebase vs spec → append remaining work as new tasks).

### 3.17 A2A (Agent2Agent) + MCP (Model Context Protocol)

- **A2A**: "An open protocol enabling communication and interoperability between opaque agentic applications" — JSON-RPC 2.0 over HTTP(S), agent discovery via **Agent Cards**, streaming (SSE) + async push, long-running **Tasks**, rich parts (text/files/structured JSON), agents stay opaque ("Operate without exposing their internal state, memory, or tools"). Linux Foundation project (contributed by Google). Repo: https://github.com/a2aproject/A2A · spec: https://a2a-protocol.org/latest/specification/
- **MCP**: open standard (Anthropic, Nov 2024) giving agents tools/resources/prompts over JSON-RPC 2.0 client–server; now the de-facto tool bus (Claude Code `claude mcp add --transport http …`, AI SDK MCP tools). https://modelcontextprotocol.io · https://spec.modelcontextprotocol.io
- **RapidTool parallel**: RapidTool's P3 phase consumes MCP/A2A tools, but its *output* to external agents is a markdown packet, not an A2A task/message or MCP tool. Borrow: wrap the packet dispatch as an A2A-style `task/send` with typed message parts + artifact references so agents can return structured results RapidTool can machine-validate (contracts, test output) instead of prose.

### 3.18 OpenAI Codex (CLI + cloud)

- **What it is**: OpenAI's coding agent. CLI is open source (Apache-2.0), runs locally; **Codex Web** is the cloud agent at https://chatgpt.com/codex. Repo: https://github.com/OpenAI/codex · docs: https://developers.openai.com/codex · IDE: https://developers.openai.com/codex/ide
- **RapidTool parallel**: Codex (per its docs) consumes AGENTS.md conventions and runs in approval modes — another external target for RapidTool packets; the cloud version is a queue-based runner (parallel sessions) RapidTool's P9 CI/CD phase could target.

### 3.19 Factory Droids, Cosine Genie (frontier autonomous engineers — vendor claims)

- **Factory**: platform of "Droids" — supervised AI engineers (you "Droid" a repo; Droid Mode marketed as "Deep Research for your enterprise engineering system" per https://x.com/FactoryAI/status/1894447062206615868); site https://www.factory.ai. Vendor claims only.
- **Cosine Genie**: "the first AI software engineer"; early Genie scored ~30% on SWE-bench (widely reported; e.g. https://uk.linkedin.com/in/samstenner summary); marketed CLI/product at https://cosine.sh/genie and https://cosine.sh. Vendor claims only; notable *pattern*: agentic validation (runs tests, iterates) is a core Genie claim (https://www.youtube.com/watch?v=zKwXTZhfH1U, marketing).
- **RapidTool parallel**: these confirm the market direction (supervised autonomy + validation loops) and RapidTool's niche: *governance + artifact compilation* around any such agent.

### 3.20 GitHub Spark + v0 + Lovable + Replit Agent (prompt-to-app wave — brief)

- **GitHub Spark**: GitHub's experiment in natural-language, spec-driven app building with GitHub integration; open example gallery at https://github.com/githubnext/spark-examples. Light claims.
- **v0** (Vercel): prompt→UI/app product, now with its own agent loop and AI SDK underneath: https://v0.dev · **Lovable**: prompt-to-fullstack-app SaaS (uses Bolt-derived scaffolding; heavy UX on "chat → deploy"): https://lovable.dev · **Replit Agent**: agentic builder inside Replit's cloud IDE: https://replit.com/agent · Bolt.new §3.7 is the open-source member of this wave.
- These products compete on *demo-to-deploy velocity* with human-in-the-loop chat; none expose a governed 13-phase artifact graph like RapidTool's. Their shared lesson: instant preview + one-click deploy is table stakes for P8/P9 UX.

### 3.21 E2B — sandboxed code execution for agents

- **What it is**: "open-source infrastructure that allows you to run AI-generated code in secure isolated sandboxes in the cloud" + self-hostable infra (Terraform, AWS/GCP). Repo: https://github.com/e2b-dev/E2B · docs: https://e2b.dev/docs · infra: https://github.com/e2b-dev/infra
- **APIs**: JS/Python SDKs, `commands.run` shell, Code Interpreter SDK (`runCode`), Desktop SDK (computer use). Sandboxes are cloud microVMs — network-isolated by default policies.
- **RapidTool parallel**: direct upgrade path for `sandbox.ts` (currently `new Function` + denylist, no timeout). See §4.6.

### 3.22 SWE-bench / Terminal-Bench — agent evaluation harnesses

- **SWE-bench** (Princeton + OpenAI Verified subset): "benchmark for evaluating LLMs on real world software issues… Given a codebase and an issue, a model generates a patch"; **fully containerized Docker evaluation harness**, result caching by `run_id`, `sb-cli` for cloud runs. Repo: https://github.com/SWE-bench/SWE-bench · verified: https://openai.com/index/introducing-swe-bench-verified/ · CLI: https://github.com/SWE-bench/sb-cli
- **Terminal-Bench** (now Harbor/Laude): "benchmark designed to measure the frontier of agent work… All frontier agent builders use Terminal-Bench to track progress"; tasks run inside sandboxed terminal environments (oracle solutions verified 5×); CLI: `uv run harbor run -d terminal-bench/terminal-bench@latest --agent claude-code --model …`. Repo: https://github.com/harbor-framework/terminal-bench · site: https://www.tbench.ai · paper: https://openreview.net/forum?id=a7Qa4CcHak
- **RapidTool parallel**: RapidTool's A7 Test Oracle generates tests but nothing *runs them against a harness with gold comparison*. The SWE-bench "issue → patch → run tests in container → compare" loop is exactly what RapidTool's validation phase needs to become for its own outputs (§4.5).

### 3.23 OpenTelemetry GenAI conventions + LangSmith (agent observability)

- **OTel GenAI semantic conventions**: standardized spans/events/metrics for LLM & agent calls; moved to https://github.com/open-telemetry/semantic-conventions-genai (incl. `gen-ai-agent-spans`, `gen-ai-events`, and MCP conventions; index: https://opentelemetry.io/docs/specs/semconv/gen-ai/).
- **LangSmith**: observability for LangGraph/LangChain runs — tracing, and UI breakpoints/state inspection for graphs ("To debug your interrupts, use LangSmith", from LangGraph docs; https://docs.langchain.com/langsmith/observability).
- **RapidTool parallel**: RapidTool has a stringly diagnostics log; the industry pattern is structured span trees (phase/step/tool call with ids, inputs, latency, tokens, errors) replayable in a trace UI.

### 3.24 Anthropic / industry research anchors (concepts)

- **"Building effective agents"** (Anthropic, Dec 2024) — workflows vs agents taxonomy: https://www.anthropic.com/research/building-effective-agents
- **Verification-driven development** concept write-ups (community/industry, e.g. https://www.zenml.io/llmops-database/scaling-ai-coding-agents-through-automated-verification-and-specification-driven-development): shift emphasis from specs to *rigorous automated validation criteria* (tests, opinionated linters, docs, feedback loops) that agents must satisfy — convergent with Claude Code's verification-first and Spec Kit's converge.
- **SWE-smith** (data engine for SWE tasks): https://github.com/SWE-bench/SWE-smith
- **Mini-SWE-Agent**: minimal reference agent used by benchmarks: https://github.com/SWE-agent/Mini-SWE-Agent

---

## 4. Mechanisms RapidTool LACKS (each proven valuable by 2+ projects)

Each entry: mechanism → who proves it → why RapidTool lacks it → snippet (verbatim from the cited source).

### M1. Durable phase checkpoints with a resume cursor (`thread_id`), not browser-local state

- **Proven by**: LangGraph (checkpointers + stores), Temporal (event history + replay), GPT Pilot (sqlite step DB + `--step` resume), ChatDev (log + replay mode).
- **RapidTool gap**: state = zustand + localStorage. A refresh, tab close, or Grok iframe reload silently kills a multi-hour 13-phase run. The PGlite/Neon dual-driver `db.ts` is orphaned. RapidTool has *gates* but no *checkpoints* — nothing can resume mid-phase or rewind to a prior phase.
- LangGraph — persistence quickstart (https://docs.langchain.com/oss/python/langgraph/persistence):

```python
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.store.memory import InMemoryStore

checkpointer = InMemorySaver()
store = InMemoryStore()

graph = builder.compile(checkpointer=checkpointer, store=store)
```

- LangGraph docs: "the checkpointer writes the exact graph state so you can resume later, even when in an error state… `thread_id` is your pointer… Reusing it resumes the same checkpoint." Production guidance: use PostgresSaver/SqliteSaver ("Use a durable checkpointer in production").
- Temporal — event history replay (https://docs.temporal.io/evaluate/understanding-temporal, https://docs.temporal.io/workflow-execution/event): Event History is "a complete and durable log of everything that has happened in the lifecycle of a Workflow Execution"; on resume "a Worker requests the Event History and re-executes the Workflow code… Commands the Worker creates during Replay are matched against the Event History instead of being issued, so Activities don't run again."
- GPT Pilot CLI (README): `python main.py --project <app_id> --step <step>` — "Load and continue from a specific step… this will delete all progress after the specified step!" (explicit rewind-to-step semantics).
- **Borrow shape for RapidTool**: persist an append-only `phase_events[]` (phase id, input artifact refs, output artifact refs, gate verdict, timestamps, token spend) to IndexedDB/PGlite; store `run_id` + `cursor`; make every phase handler a pure `(state) → (state, events)` reducer so runs can replay, rewind, and fork.

### M2. Dynamic HITL primitive (`interrupt()`) with typed payloads + resume — vs static phase-modal gates

- **Proven by**: LangGraph (interrupt/Command resume), Vercel AI SDK (per-tool `toolApproval`), Claude Code (permission modes, allowlists), CrewAI (task-level human review).
- **RapidTool gap**: gates are *phase-boundary modals* with a ≥12-char rejection rule. RapidTool cannot pause *inside* a phase when an agent emits something risky mid-flight (e.g., P7 codegen proposes a network call; P10 wants to execute an LLM locally); every HITL decision is binary approve/reject-with-comment — no "edit the payload and resume", no policy-based auto-approval of known-safe items.
- LangGraph — interrupt (https://docs.langchain.com/oss/python/langgraph/interrupts):

```python
from langgraph.types import interrupt

def approval_node(state: State):
    # Pause and ask for approval
    approved = interrupt("Do you approve this action?")

    # When you resume, Command(resume=...) returns that value here
    return {"approved": approved}
```

- LangGraph — resume loop (same page, excerpt):

```python
while True:
    stream = graph.stream_events(stream_input, config=config, version="v3")
    for message in stream.messages:
        for token in message.text:
            display_streaming_content(token)
    if not stream.interrupted:
        final_state = stream.output
        break
    interrupt_info = stream.interrupts[0].value
    user_response = get_user_input(interrupt_info)
    stream_input = Command(resume=user_response)
```

- Vercel AI SDK — per-tool approval (https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling):

```ts
const result = await generateText({
  model: "xai/grok-4.6",
  tools: { runCommand },
  toolApproval: {
    runCommand: 'user-approval',
  },
  prompt: 'Remove the most recent file in the downloads folder',
});
```

- **Borrow shape**: model every gate as `interrupt({ kind, payload, policy })` on an event bus; allow resume values of `{approve, reject(reason≥12), edit(payload)}`; add a per-tool/per-phase approval-policy table (always-ask / allowlist / classifier) so autopilot mode isn't all-or-nothing.

### M3. Verification loop: runnable checks as hard gates (test/build/screenshot), iterate until green

- **Proven by**: Claude Code ("give Claude a way to verify its work" + `/goal` + Stop hooks), Aider (auto lint/test + fix), Spec Kit (implement→converge loop), GPT Pilot (Reviewer→Code Monkey retry loop), SWE-bench/Terminal-Bench (containerized test verdicts).
- **RapidTool gap**: P5 validation and A7 Test Oracle *synthesize* tests, but nothing executes them with a pass/fail signal that loops back into the graph; "autopilot" can therefore declare victory on an unrun test. Anthropic: "Claude stops when the work looks done. Without a check it can run, 'looks done' is the only signal available, and you become the verification loop." (https://www.anthropic.com/engineering/claude-code-best-practices)
- Claude Code — deterministic gate via Stop hook (same page): "a Stop hook runs your check as a script and blocks the turn from ending until it passes. Claude Code overrides the hook and ends the turn after 8 consecutive blocks."
- Spec Kit — converge loop (https://github.com/github/spec-kit README): repeat `implement`/`converge` "until `/speckit-converge` reports **Converged**", where converge is defined as "Assess the codebase against spec/plan/tasks and append remaining work as new tasks."
- Aider — README feature: "Automatically lint and test your code every time aider makes changes. Aider can fix problems detected by your linters and test suites."
- **Borrow shape**: P7/P10 outputs enter a `run-check → verdict → fix-loop (max N=3, then human)` subgraph; each check records real command output as evidence in the artifact; gate verdicts require evidence, not assertion (Anthropic: "Have Claude show evidence rather than asserting success: the test output, the command it ran and what it returned").

### M4. Fresh-context adversarial review before "done" (reviewer ≠ implementer)

- **Proven by**: Claude Code (/code-review + reviewer subagent guidance), GPT Pilot (Reviewer role sends work back to Code Monkey), ChatDev (reviewer phase; human-as-reviewer mode), MetaGPT (role-separated outputs), Devin (PR review + CI feedback loop, vendor claim).
- **RapidTool gap**: A8 has a "reviewer" seat but the review happens in the same run/context lineage; the industry pattern is a reviewer *in a fresh context* that sees only the diff + criteria, so it "evaluates the result on its own terms" (Anthropic). RapidTool's external-agent packets make this cheap: emit a *second* packet (reviewer persona, diff-only context).
- Claude Code — adversarial review prompt (https://www.anthropic.com/engineering/claude-code-best-practices):

```
Use a subagent to review the rate limiter diff against PLAN.md. Check that
every requirement is implemented, the listed edge cases have tests, and
nothing outside the task's scope changed. Report gaps, not style preferences.
```

- Claude Code same page: "A reviewer prompted to find gaps will usually report some, even when the work is sound… Tell the reviewer to flag only gaps that affect correctness or the stated requirements, and treat the rest as optional."
- **Borrow shape**: P8 (UI prototype gate) and the post-P7 review become a mandatory second-opinion packet with scope discipline; reviewer findings are structured (severity, file, requirement id) and loop into a bounded fix cycle.

### M5. Self-evaluation harness: the console grades its own outputs (issue → patch → container → verdict)

- **Proven by**: SWE-bench (Docker harness, gold-patch comparison), Terminal-Bench (sandboxed terminal tasks, oracle solutions), Anthropic (end-state evaluation advice), Claude Code (/goal evaluator), Spec Kit (checklist "unit tests for English").
- **RapidTool gap**: **zero unit tests** for engine/algorithms/store/sandbox/packet, and no regression harness for generated projects. If RapidTool is a "software agency", the agency itself needs CI. Anthropic — end-state eval (https://www.anthropic.com/engineering/multi-agent-research-system): "Instead of judging whether the agent followed a specific process, evaluate whether it achieved the correct final state… break evaluation into discrete checkpoints where specific state changes should have occurred."
- SWE-bench — CLI (https://raw.githubusercontent.com/SWE-bench/SWE-bench/main/README.md):

```bash
swebench eval verified -p <path_to_predictions> --run-id <run_id> -j <num_workers>
# result caching: the harness caches results by run_id and instance_id
```

- Terminal-Bench / Harbor — CLI (https://raw.githubusercontent.com/harbor-framework/terminal-bench/main/README.md):

```bash
uv run harbor run -d terminal-bench/terminal-bench@latest \
   --agent claude-code --model anthropic/claude-fable-5 \
   --n-concurrent 100 --env modal
```

- **Borrow shape**: add a `harness/` module: fixture briefs → run P0–P12 headless → execute A7 oracle tests in a sandbox → score; run it in CI on every engine change (the equivalent of SWE-bench for a *builder of software*, not just a patch model).

### M6. Real sandboxing: OS isolation, timeouts, network policy — not `new Function` + denylist

- **Proven by**: E2B (cloud microVM sandboxes), Claude Code (OS-level sandboxing + permission allowlists), Bolt.new (WebContainers), SWE-bench (Docker), OpenHands (Docker default w/ filesystem warning), AI SDK (`experimental_sandbox`).
- **RapidTool gap**: `sandbox.ts` runs generated JS via `new Function` with a denylist and **no timeout** — a generated infinite loop or prototype-polluting payload freezes the host console (which lives inside Grok's chat iframe). Also: the gpt-pilot worm episode (README advisory) is a live reminder that "code you run from agent output" is a supply-chain surface.
- E2B — code interpreter (https://raw.githubusercontent.com/e2b-dev/E2B/main/README.md):

```ts
import { Sandbox } from '@e2b/code-interpreter'

const sandbox = await Sandbox.create()
const execution = await sandbox.runCode('x = 1; x += 1; x')
console.log(execution.text)  // outputs 2
```

- AI SDK — tools must refuse to run without a sandbox (https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling, excerpt):

```ts
execute: async ({ command }, { experimental_sandbox }) => {
  if (!experimental_sandbox) {
    throw new Error('Experimental sandbox is not available');
  }
  return experimental_sandbox.run({ command });
},
```

- OpenHands README: without the Docker sandbox "the agent will have full access to your filesystem!" — their Docker run mounts only `$PROJECTS_PATH` into the container.
- **Borrow shape**: wrap every generated-code execution in an artifact-scoped sandbox with (a) hard timeout, (b) allowlist imports/APIs, (c) no access to parent iframe storage/network unless P3/P9 approved, (d) full stdin/stdout capture as evidence. In-browser: WebWorker + CSP + postMessage protocol; heavy runs: E2B-style cloud sandbox behind the P9 gate.

### M7. Artifact handoff through a filesystem/registry, not conversation copying or one big paste

- **Proven by**: Anthropic multi-agent research system ("subagent output to a filesystem to minimize the 'game of telephone'"), OpenHands (conversation + event + workspace server model), A2A (typed tasks/messages with artifact parts between opaque agents), MetaGPT (structured docs per role), Spec Kit (specs/ artifacts as files), ChatDev (phase output files passed to next phase).
- **RapidTool gap**: A4 is a single ≤14k-char paste-ready packet and results come back as chat prose. There is no typed artifact registry with references; a 14k packet cannot carry large artifacts, so RapidTool compresses instead of referencing. Anthropic: "Subagents call tools to store their work in external systems, then pass lightweight references back to the coordinator. This prevents information loss during multi-stage processing and reduces token overhead from copying large outputs through conversation history." (https://www.anthropic.com/engineering/multi-agent-research-system)
- Anthropic multi-agent system, context-condensation guidance (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents): subagents "might explore extensively, using tens of thousands of tokens or more, but return only a condensed, distilled summary of its work (often 1,000–2,000 tokens)."
- A2A (https://raw.githubusercontent.com/a2aproject/A2A/main/README.md): agents "securely collaborate on long-running tasks… Operate without exposing their internal state, memory, or tools"; interaction via JSON-RPC 2.0, streaming (SSE), async push; "Rich Data Exchange: Handles text, files, and structured JSON data."
- **Borrow shape**: make the artifact store the backbone — every phase writes artifacts (spec.md, contracts.json, oracle-tests/, packet.md, gate-evidence/) to an artifact registry; packets carry *references + condensed summaries* instead of full payloads; agent replies are parsed into typed result envelopes (status, artifacts[], test-output[], findings[]) — the A2A task lifecycle (https://a2a-protocol.org/latest/specification/) is a ready-made envelope schema.

### M8. Context engineering discipline: rank-to-token-budget injection + persistent instruction files

- **Proven by**: Aider (repo map w/ graph ranking + `--map-tokens` budget), Claude Code (CLAUDE.md + skills-on-demand + `/init`), OpenAI (agents.md), Anthropic context-engineering post (context rot, attention budget, compaction/note-taking/subagents), Spec Kit (constitution + spec files as standing context), Devin (approved-knowledge injection per repo, vendor claim).
- **RapidTool gap**: A2 FusionRank ranks memory, but the A4 packet is a fixed ≤14k-char compile with no token-budget allocator; memory rails (episodic/procedural/semantic) are all injected without an approval filter, and nothing is written back as *checked-in agent instructions* (CLAUDE.md/AGENTS.md) in the generated project. Anthropic context post: "Context… must be treated as a finite resource… find the smallest possible set of high-signal tokens" (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents).
- Aider repo-map rationale (https://aider.chat/docs/repomap.html): "Aider solves this problem by sending just the most relevant portions of the repo map… selecting the most important parts of the codebase which will fit into the active token budget." (Aider's budget is `--map-tokens`, default 1k tokens.)
- Claude Code CLAUDE.md example (https://www.anthropic.com/engineering/claude-code-best-practices):

```
# Code style
- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible (eg. import { foo } from 'bar')

# Workflow
- Be sure to typecheck when you're done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance
```

- OpenAI agents.md (https://github.com/openai/agents.md): "Think of AGENTS.md as a README for agents: a dedicated, predictable place to provide context and instructions" — now consumed across Claude Code, Codex, Copilot, Gemini et al. (30+ agents per Spec Kit's integration list: https://github.github.io/spec-kit/reference/integrations.html).
- **Borrow shape**: (1) replace fixed 14k compile with a budgeted packet builder: rank memory/context items (FusionRank), allocate tokens by section (Aider-style), spill overflow to file references; (2) P6/P12 should *emit AGENTS.md + CLAUDE.md* into the generated repo so any downstream agent honors the same conventions; (3) add an approval filter before procedural/episodic memories enter packets (Devin-style "approved knowledge", vendor claim: https://devin.ai).

### M9. Explicit loop caps, retry bounds, and tool-call repair (bounded autonomy)

- **Proven by**: Vercel AI SDK (`stopWhen: isStepCount(5)`, tool-call repair), Claude Code (hook override after 8 consecutive blocks; "after two failed corrections, `/clear` and write a better prompt"), SWE-bench (result caching by run_id — determinism guard), gpt-pilot (task-size sensitivity research).
- **RapidTool gap**: autopilot mode advances phases with no per-phase iteration cap and no repair pass when an agent's tool calls fail schema validation; a stuck phase can retry forever or silently degrade.
- Vercel AI SDK — step cap (https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling):

```ts
const result = await generateText({
  model: "xai/grok-4.6",
  tools: { /* ... */ },
  stopWhen: isStepCount(5),
  prompt: 'What is the weather in San Francisco?',
});
```

- Anthropic failure-pattern fix (https://www.anthropic.com/engineering/claude-code-best-practices): "After two failed corrections, `/clear` and write a better initial prompt incorporating what you learned" — i.e. escalation by fresh start, not infinite in-place retry.
- **Borrow shape**: every phase and fix-loop carries `maxAttempts` + `escalation` (retry → narrower task → fresh packet → halt-for-human); validate agent tool-call JSON against schemas and feed failures back as repair context rather than failing the phase.

### M10. Structured event/trace streaming: lifecycle callbacks + GenAI telemetry semantics

- **Proven by**: Vercel AI SDK (onToolExecutionStart/End lifecycle hooks), OpenTelemetry GenAI semantic conventions (agent spans/events, MCP conventions), LangSmith (trace UI + state inspection for LangGraph), CrewAI AMP (metrics/logs/traces — commercial), OpenHands (typed conversation events).
- **RapidTool gap**: diagnostics log is a string stream; phases, gates, token spends, and tool calls are not emitted as structured events, so there is nothing to replay, search, or trace. AI SDK — tool lifecycle (https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling):

```ts
onToolExecutionEnd({ toolCall, toolExecutionMs, toolOutput }) {
  if (toolOutput.type === 'tool-error') {
    console.error(`Tool ${toolCall.toolName} failed after ${toolExecutionMs}ms:`, toolOutput.error);
  } else {
    console.log(`Tool ${toolCall.toolName} completed in ${toolExecutionMs}ms`, { output: toolOutput.output });
  }
}
```

- OTel GenAI conventions now include agent spans and events plus MCP instrumentation (https://github.com/open-telemetry/semantic-conventions-genai; index: https://opentelemetry.io/docs/specs/semconv/gen-ai/).
- **Borrow shape**: emit `{type:'phase'|'gate'|'tool'|'packet'|'artifact', id, runId, ts, meta}` events through a tiny pub/sub; render the existing diagnostics tab from the same stream; keep an in-memory ring buffer per run (M1's `phase_events[]` becomes the trace source).

### M11. Deterministic-flow/autonomous-crew duality, externalized as reviewable config

- **Proven by**: CrewAI (Crews vs Flows + JSON-first projects), ChatDev 2.0 (zero-code agent/workflow configs), MetaGPT (SOP materialization), LangGraph (graph-as-data), OpenAI Codex/Claude Code (AGENTS.md/CLAUDE.md as convention files).
- **RapidTool gap**: the 13-phase graph and A8 crew policy live in JS; there is no editable, reviewable artifact describing *the process itself*. Industry direction: process as data (crew.jsonc / graph definition / phase configs) so humans and agents can inspect and tune governance without code changes. CrewAI scaffold (https://raw.githubusercontent.com/crewAIInc/crewAI/main/README.md):

```
my_project/
├── .gitignore
├── .env
├── agents/
│   └── researcher.jsonc
├── crew.jsonc
├── knowledge/
├── pyproject.toml
├── README.md
├── skills/
└── tools/
```

- CrewAI README: Crews = "role-based AI agents… autonomous decision-making"; Flows = "precise, event-driven control… secure, consistent state management between tasks" — the same duality as RapidTool's A8 (crew) inside P0–P12 (flow), but CrewAI externalizes both as data + Python events.
- **Borrow shape**: export `rapidtool.flow.jsonc` (phases, gates, policies) + `crew.seats.jsonc` (roles, models, token budgets — the A8 seat plan) at P1 time; render them in the Crew/Spec tabs; let power users edit before P4.

### M12. Idea-assessment gate with a real "kill / reframe" path, and spec-ledgers as git artifacts

- **Proven by**: GitHub Spec Kit (assess extension: intake → research → define → shape → decide → documented **go / needs-clarification / kill**; SDD artifacts committed as files), Amazon Kiro (prompts → specs → code/docs/tests as its core loop, vendor docs: https://aws.amazon.com/documentation-overview/kiro/), ChatDev (git mode), Aider (auto-commit per change), Devin (PR-based delivery, vendor claim).
- **RapidTool gap**: the feasibility scorecard hard-codes `reframe` as unreachable — there is no *research-informed second pass* (the Spec Kit assess flow exists precisely to convert a weak idea into a clarified one or kill it). And RapidTool artifacts live in zustand tabs instead of a git-committable spec ledger, so phases aren't reviewable as diffs. Spec Kit flow (README): "Assess the bug (`/speckit-bug-assess "<bug report>" slug=login-crash`)… Fix… Test" and assess extension steps "Intake → Research → Define → Shape → Decide (go / needs-clarification / kill)… If you choose to build an idea with a **go** decision, you can hand it off to `/speckit-specify`."
- ChatDev git mode (README): `"git_management": "True"` in `ChatChainConfig.json` — "enabling the programmer to utilize Git for version control."
- **Borrow shape**: make `reframe` a first-class verdict that forks a sub-run (keep scorecard + research; re-run P0 with guardrail deltas appended — RapidTool's A3 Constraint Scheduler already computes deltas); commit each phase's artifacts (`01-brief.md … 13-spec.md`, packet.md, contracts.json, gate evidence) to an in-memory git repo (isomorphic-git) with auto-commit per phase like Aider ("automatically commits changes with sensible commit messages" — https://aider.chat/docs/git.html) so every gate is a reviewable diff.

### M13. Planner/executor model split + token-budget governance (who spends, where)

- **Proven by**: Anthropic research system (lead plans, workers execute; token use explains ~80% of eval variance; agents ~4× / multi-agent ~15× chat tokens), Google Jules (planner model vs executor model split — third-party analysis: https://dev.to/jubinsoni/…; official: https://blog.google/innovation-and-ai/models-and-research/google-labs/jules-tools-jules-api/), MetaGPT (role-specialized models per phase).
- **RapidTool gap**: A8 seats carry token budgets per phase, but there is no accounting *after the fact* — no per-phase/per-seat spend ledger, no "expensive model only for planning phases" routing policy, no budget-breakdown visualization at gates.
- Anthropic (https://www.anthropic.com/engineering/multi-agent-research-system): "agents typically use about 4× more tokens than chat interactions, and multi-agent systems use about 15× more tokens than chats… token usage by itself explains 80% of the variance" in BrowseComp performance.
- **Borrow shape**: record token spend per phase + seat + packet into M1's event log; add a routing table (frontier model for P0/P1/P5 review synthesis; cheap model for P7 implementation drafting when tightness score is low) — deterministic counterpart of Jules's two-model split; surface a per-run "token burn" strip at every gate so HITL approvals are cost-informed.

---

## 5. Gap table: capability | RapidTool today | industry pattern | effort-to-adopt

| # | Capability | RapidTool today | Industry pattern (sources §3/§4) | Effort to adopt |
|---|---|---|---|---|
| G1 | Run durability | zustand + localStorage; iframe reload loses run | Event-sourced checkpoints + `thread_id` resume (LangGraph, Temporal, gpt-pilot) | Medium (indexeddb/PGlite via orphaned db.ts; reducer refactor) |
| G2 | Mid-phase dynamic HITL | Phase-boundary modals; approve/reject(≥12 chars) | `interrupt()` + `Command(resume)`; per-tool approval policies (LangGraph, AI SDK) | Medium |
| G3 | Executable verification gates | Oracle *generates* tests; nothing runs them | Run check → iterate until green; Stop hooks; `/goal`; converge loop (Claude Code, Aider, Spec Kit) | Medium |
| G4 | Fresh-context adversarial review | A8 "reviewer" seat in same context lineage | Reviewer subagent sees diff-only fresh context (/code-review; gpt-pilot Reviewer; ChatDev) | Low (second packet) |
| G5 | Self-eval/regression harness for engine | Zero unit tests; no fixture runs | Docker harness + gold verdicts; end-state eval (SWE-bench, Terminal-Bench, Anthropic) | Medium |
| G6 | Execution sandbox | `new Function` + denylist, no timeout | OS-isolated sandbox, timeout, network policy (E2B, Claude Code sandboxing, WebContainers, Docker) | Medium |
| G7 | Artifact registry + typed handoffs | Single ≤14k packet; prose replies | Filesystem artifacts + lightweight refs; A2A task/message envelopes | Medium |
| G8 | Budgeted context injection | Fixed 14k compile; all memory injected | Rank-to-token-budget (Aider repo map); compacted 1–2k subagent summaries (Anthropic) | Medium |
| G9 | Persistent instruction files | None emitted | Emit AGENTS.md/CLAUDE.md into generated repos (OpenAI agents.md, Claude Code, 30+ agents) | Low |
| G10 | Memory approval filter | Memories auto-scored into packets | Approved-knowledge gates before injection (Devin, vendor) | Low |
| G11 | Loop caps / retry bounds | Autopilot unbounded per phase | `stopWhen` step caps; hook override at 8; fresh-start escalation (AI SDK, Claude Code) | Low |
| G12 | Structured trace events | String diagnostics log | Typed lifecycle events; OTel GenAI agent spans; trace UI (AI SDK, OTel, LangSmith) | Low–Medium |
| G13 | Process-as-data | Phase graph hard-coded in JS | Flow/crew JSONC config; graph-as-data (CrewAI, ChatDev 2.0, LangGraph) | Medium |
| G14 | Reframe/kill path | `reframe` unreachable | assess extension go/clarify/kill; research-informed second pass (Spec Kit) | Low |
| G15 | Spec ledger in git | Artifacts in tabs only | Auto-commit per change; PR delivery (Aider, ChatDev git mode, Devin) | Low–Medium |
| G16 | Token accounting | Seat budgets pre-set, no post-hoc ledger | Spend events; planner/executor model split (Anthropic, Jules) | Low |
| G17 | Running generated app for UI gate | Static prototype review at P8 | Live preview + visual QA screenshots vs design (Claude Code, Devin, Bolt/v0 previews) | Medium |
| G18 | Approval *policies* | Single always-ask mode | Allowlists, auto-mode classifier, sandbox presets (Claude Code, AI SDK policies) | Medium |
| G19 | External-agent interchange | Paste-into-chat packets | ACP/agent-server API; MCP tools; A2A tasks (OpenHands, MCP, A2A) | High |
| G20 | Agent-convention inputs | A4 re-invents conventions ad hoc | Consume repo AGENTS.md/CLAUDE.md when packetizing (agents.md ecosystem) | Low |
| G21 | Replay/debug of past runs | None | Log+replay; time travel over checkpoints (ChatDev, LangGraph, LangSmith) | Medium |
| G22 | CI/CD of the console itself | None | Harness runs headless phases in CI (SWE-bench-style; §M5) | Medium |

---

## 6. Borrow list — ranked by value-for-effort for a governed 13-phase console

Ranking logic: leverage against RapidTool's existing artifacts (gates, packets, memory rail, tabs) × industry evidence strength. Each item = §4 mechanism or gap-table row.

1. **Executable verification loop with evidence** (M3/G3) — closest to RapidTool's mission (validation-first agency); turns P5/P7/A7 from generators into gates. Aider + Claude Code + Spec Kit all converge on it.
2. **Durable checkpoints + event-sourced phase log** (M1/G1) — kills the "lost run on iframe reload" class of bugs; enables every later mechanism (traces, replay, token accounting). LangGraph + Temporal + gpt-pilot.
3. **Artifact registry with reference-based packets** (M7/G7) — preserves A4's paste-ability while ending the 14k ceiling; A2A envelope for typed replies. Anthropic + A2A + OpenHands.
4. **Dynamic HITL with resume values + policy table** (M2/G2/G18) — approve / reject / *edit-and-resume*; per-tool approval policies for autopilot. LangGraph + AI SDK + Claude Code.
5. **Fresh-context reviewer packet before every "done"** (M4/G4) — cheapest high-value add: a second packet persona with diff-only context. Claude Code + gpt-pilot + ChatDev.
6. **Real sandbox (timeout + allowlist + isolation) for sandbox.ts** (M6/G6) — safety-critical inside a chat iframe. E2B + AI SDK + Claude Code + WebContainers.
7. **AGENTS.md/CLAUDE.md emission into generated projects** (M8-2/G9/G20) — downstream agents then self-govern; 30+ tools consume the format. OpenAI + Anthropic + Spec Kit.
8. **Self-eval harness + unit tests** (M5/G5/G22) — "software agency needs CI"; fixture briefs through headless P0–P12 with A7 oracle execution. SWE-bench + Terminal-Bench + Anthropic end-state eval.
9. **Budgeted packet builder (rank→tokens→spill-to-refs)** (M8-1/G8) — upgrades A2 FusionRank from ranking to *allocation*. Aider + Anthropic context engineering.
10. **Memory approval filter** (M10/G10) — knowledge enters packets only after passing a gate; prevents poisoned procedural memory. Devin (vendor) + Claude Code permission ethos.
11. **Structured event stream feeding the diagnostics tab** (M10/G12) — one pub/sub refactor; unblocks traces, replay, and spend dashboards. AI SDK + OTel GenAI + LangSmith.
12. **Loop caps + escalation on every phase** (M9/G11) — bounded autonomy for autopilot. AI SDK + Claude Code.
13. **Process-as-data: export flow.jsonc + seats.jsonc** (M11/G13) — reviewable governance; Crew tab renders real config. CrewAI + ChatDev 2.0 + LangGraph.
14. **Reframe as a fork sub-run** (M12/G14) — re-run P0 with A3 guardrail deltas; kill path for low scorecards. Spec Kit assess + Kiro spec loop.
15. **Per-phase git ledger (auto-commit artifacts)** (M12-2/G15) — every gate becomes a diff; rollback = checkout. Aider + ChatDev git mode + Devin PRs.
16. **Token spend ledger + model routing table** (M13/G16) — cost-aware gates; frontier model only for plan/synthesis phases. Anthropic + Jules.
17. **Live preview for P8 UI gate (screenshot diff)** (G17) — evidence-based UI approval; the Grok iframe host already supports previews. Claude Code screenshots + Bolt/v0.
18. **Log + replay mode** (G21) — rewatch any past run step-by-step; pairs with M1. ChatDev + LangGraph time travel + LangSmith.

> Note on effort labels: Low ≈ days (single-module), Medium ≈ 1–3 weeks (touches engine/state), High ≈ architecture change. M1 is the load-bearing refactor — most other items consume its event log or checkpoints.

---

## 7. URL inventory (source list, grouped)

**OpenHands / OpenAgent ecosystem**
- https://github.com/OpenHands/OpenHands · https://raw.githubusercontent.com/All-Hands-AI/OpenHands/main/README.md · https://docs.openhands.dev/openhands/usage/agent-canvas/backends · https://github.com/OpenHands/software-agent-sdk · https://github.com/OpenHands/automation · https://docs.openhands.dev/openhands/usage/agent-canvas/acp-agents

**Aider**
- https://github.com/Aider-AI/aider · https://aider.chat/docs/repomap.html · https://aider.chat/docs/git.html · https://aider.chat/docs/usage/lint-test.html · https://aider.chat/2023/10/22/repomap.html

**MetaGPT**
- https://github.com/FoundationAgents/MetaGPT · https://raw.githubusercontent.com/FoundationAgents/MetaGPT/main/README.md · https://openreview.net/forum?id=z5uVAKwmjf (AFlow) · https://mgx.dev · https://openreview.net/forum?id=VtmBAGCN7o (paper)

**ChatDev**
- https://github.com/OpenBMB/ChatDev · https://raw.githubusercontent.com/OpenBMB/ChatDev/main/README.md · https://arxiv.org/abs/2307.07924 · https://arxiv.org/abs/2312.17025 (ECL) · https://arxiv.org/abs/2405.04219 (IER) · https://arxiv.org/abs/2406.07155 (MacNet) · https://arxiv.org/abs/2505.19591 (puppeteer)

**GPT Pilot / smol dev**
- https://github.com/Pythagora-IO/gpt-pilot · https://raw.githubusercontent.com/Pythagora-IO/gpt-pilot/main/README.md · https://blog.pythagora.ai/2024/02/19/gpt-pilot-what-did-we-learn-in-6-months-of-working-on-a-codegen-pair-programmer/ · https://github.com/smol-ai/developer · https://github.com/Pythagora-IO/gpt-pilot/commit/065ee8ebee7385cb644fd1608587a18edb91f4fb

**CrewAI**
- https://github.com/crewAIInc/crewAI · https://raw.githubusercontent.com/crewAIInc/crewAI/main/README.md · https://docs.crewai.com · https://crewai.com/amp · https://github.com/crewAIInc/skills

**LangGraph / LangChain / LangSmith**
- https://github.com/langchain-ai/langgraph · https://docs.langchain.com/oss/python/langgraph/interrupts · https://docs.langchain.com/oss/python/langgraph/persistence · https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/ (legacy redirect) · https://langchain-ai.github.io/langgraph/concepts/persistence/ · https://docs.langchain.com/langsmith/observability

**Temporal**
- https://temporal.io · https://docs.temporal.io/evaluate/understanding-temporal · https://docs.temporal.io/workflow-execution/event

**Vercel AI SDK**
- https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling · https://ai-sdk.dev/docs/agents/tool-approvals · https://ai-sdk.dev/docs/agents/policy-tool-approvals · https://ai-sdk.dev/docs/reference/ai-sdk-workflow · https://vercel.com/docs/ai-sdk

**Anthropic (Claude Code, engineering posts)**
- https://www.anthropic.com/engineering/claude-code-best-practices · https://code.claude.com/docs/en/best-practices · https://www.anthropic.com/engineering/multi-agent-research-system · https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents · https://www.anthropic.com/research/building-effective-agents

**GitHub Spec Kit + conventions**
- https://github.com/github/spec-kit · https://raw.githubusercontent.com/github/spec-kit/main/README.md · https://github.github.io/spec-kit/ · https://github.github.io/spec-kit/concepts/sdd.html · https://github.github.io/spec-kit/reference/integrations.html · https://github.com/openai/agents.md · https://agents.md · https://developer.microsoft.com/blog/spec-driven-development-spec-kit/

**A2A + MCP**
- https://github.com/a2aproject/A2A · https://raw.githubusercontent.com/a2aproject/A2A/main/README.md · https://a2a-protocol.org/latest/specification/ · https://modelcontextprotocol.io · https://spec.modelcontextprotocol.io

**OpenAI Codex**
- https://github.com/OpenAI/codex · https://developers.openai.com/codex · https://developers.openai.com/codex/ide · https://chatgpt.com/codex

**Products (vendor pages & coverage)**
- Devin: https://devin.ai · https://docs.devin.ai · Jules: https://jules.google.com/session · https://blog.google/innovation-and-ai/models-and-research/google-labs/jules-tools-jules-api/ · https://dev.to/jubinsoni/jules-googles-async-coding-agent-is-changing-how-we-think-about-ai-and-software-development-3j0d (third-party) · Kiro: https://aws.amazon.com/documentation-overview/kiro/ · https://kiro.dev/ · https://www.infoq.com/news/2025/08/aws-kiro-spec-driven-agent/ · Factory: https://www.factory.ai · https://x.com/FactoryAI/status/1894447062206615868 · Genie/Cosine: https://cosine.sh/genie · https://cosine.sh · https://uk.linkedin.com/in/samstenner · Bolt: https://github.com/stackblitz/bolt.new · https://webcontainers.io · Spark: https://github.com/githubnext/spark-examples · v0: https://v0.dev · Lovable: https://lovable.dev · Replit: https://replit.com/agent

**Sandboxing & eval**
- E2B: https://github.com/e2b-dev/E2B · https://raw.githubusercontent.com/e2b-dev/E2B/main/README.md · https://e2b.dev/docs · https://github.com/e2b-dev/infra · SWE-bench: https://github.com/SWE-bench/SWE-bench · https://raw.githubusercontent.com/SWE-bench/SWE-bench/main/README.md · https://openai.com/index/introducing-swe-bench-verified/ · https://github.com/SWE-bench/sb-cli · Terminal-Bench: https://github.com/harbor-framework/terminal-bench · https://raw.githubusercontent.com/harbor-framework/terminal-bench/main/README.md · https://www.tbench.ai · https://harborframework.com/docs · https://openreview.net/forum?id=a7Qa4CcHak · Mini-SWE-Agent: https://github.com/SWE-agent/Mini-SWE-Agent · SWE-smith: https://github.com/SWE-bench/SWE-smith

**Observability**
- https://github.com/open-telemetry/semantic-conventions-genai · https://opentelemetry.io/docs/specs/semconv/gen-ai/ · https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/

**Concept anchors**
- https://www.zenml.io/llmops-database/scaling-ai-coding-agents-through-automated-verification-and-specification-driven-development (verification-driven development write-up)

**Notable dead/redirected URLs encountered** (avoid): https://docs.temporal.io/encyclopedia/durable-execution (404), https://www.temporal.io/durable-execution (404) — Temporal content now at /evaluate/ and /workflow-execution/.

---

## 8. Caveats & confidence notes

1. **Snapshot date 2026-09-04.** Repos/products drift fast (OpenHands → Agent Canvas; terminal-bench → Harbor org; gpt-pilot → unmaintained+compromised). Re-verify before acting on any specific claim.
2. **Vendor marketing** is explicitly flagged (§3.13–3.15, 3.19–3.20): Devin/Jules/Kiro/Factory/Genie/v0/Lovable/Replit claims come from their own pages or coverage, not independent eval.
3. **Code snippets** are verbatim from cited docs/READMEs except where marked "excerpt" (ellipsis/comment elisions). Pseudocode appears only inside "Borrow shape" prescriptions, which are RapidTool-specific proposals, not external quotes.
4. RapidTool facts in §1 come from the product digest provided by the parent task (codebase read optional; not required for this comparison).




