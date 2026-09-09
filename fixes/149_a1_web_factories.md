# 149 — A1 (WEB): Autonomous Software Factories — CODE-LEVEL Truth

> Lane: **A1-WEB** (code-level research, analysis-only). All URLs fetched/verified **2026-09-08** via direct
> HTTP (Firecrawl web tools are disabled in this environment; every fetch below is `curl`/python against
> `raw.githubusercontent.com` HEAD, GitHub API, arXiv API, or server-rendered doc pages). Repo was
> READ-ONLY except this file. Quotes are verbatim from fetched content; line/file anchors are given per quote.
> Companion lanes (A2 codegen, A3 headless, tests) ran concurrently — nothing in this file depends on their edits.

## 0. TL;DR — what real factories actually do (code level)

Across 15 repos/docs (disler SSSF, Vercel eve/Foreman template, MetaGPT, ChatDev 1.0 + 2.0-DevAll,
OpenHands/AgentCanvas, Claude Code, OpenAI Codex, SWE-agent, Attractor, Fabro, Fusion, Machinist,
Aider, gpt-pilot), the code-level convergence is unambiguous:

1. **Deterministic code owns the loop; the LLM is a bounded worker inside it.** Every 2025-26 "software
   factory" that ships actual code moved the control plane OUT of the model prompt: Python phase
   context-managers + typed envelopes (disler), Graphviz/DOT workflow graphs (Fabro), YAML node graphs
   (ChatDev 2.0), four fixed "stations" with structured outputs (eve Foreman), role/action/Team state
   machines (MetaGPT), JSON chat chains (ChatDev 1.0). Nobody credible ships "one agent owns the whole
   SDLC loop."
2. **Produce-and-verify gates are deterministic (shell/tests/CI/hooks) where possible, and an
   independent reviewer agent where not.** Gates check artifacts/diffs/exit codes *after the fact* —
   `artifacts_exist`, `files_non_empty`, `diff_matches_claims`, `tests_pass(...)`, shell exit codes,
   Claude Code hooks `exit code 2`, CI suites. Reviewer agents are explicitly forbidden from judging
   their own work and run on different models/vendors/sandboxes.
3. **Repair = bounded, same-context re-prompt; cold restarts are named as the anti-pattern.** Max-attempt
   caps are hard constants everywhere (2 revision cycles, `max_iterations`, `chat_turn_limit`, `maxTurns`,
   rollout budgets).
4. **"Verify the run" is real but narrow**: repos are checked out in sandboxes, deps installed
   (`pnpm install` at template build), and the *repo's own* lint/typecheck/tests are executed — nobody in
   this set claims product-level "it runs" verification beyond tests/CI. Honest docs admit test phases are
   "theater" until real commands are wired in.
5. **Memory = bounded, durable, human-gated notes — not learned behavior.** factory brain / CLAUDE.md /
   AGENTS.md / memory stores. Writes to shared memory are approval-gated so untrusted/unattended runs
   cannot poison future runs. No repo ships a mechanism where a *failure changes future behavior*
   autonomously; the closest are review-finding notes and skills that a human curates.
6. **Human gates are universal and placed at ship/merge** (draft PR → human marks ready; hexagon
   approval nodes; "Machinist hands back a pull request. It does not decide what ships"), not at every
   tool call.
7. **Published failure modes are candid**: cold-restart retries, placeholder test commands that "exit 0",
   agents editing protected files, gates passing while output is bad, unmaintained repos, even a
   supply-chain worm (gpt-pilot).

---

## 1. disler/super-simple-software-factory — "Agent proposes, code disposes"

URL: https://github.com/disler/super-simple-software-factory (README.md @ main, fetched 2026-09-08; stars 816, pushed 2026-08-04)

**Loop ownership (code, not LLM).** Tagline: *"Repeatable agents-plus-code workflows, packaged as one
skill, stamped into any repo. Deterministic Python owns the graph. Coding agents are bounded nodes
inside it."* And: *"This fixes that by moving the control plane out of the prompt and into Python. An ADW
script (AI Developer Workflow) owns sequencing, retries, and acceptance. Agents work inside named phases.
Typed JSON envelopes carry context across the seams. ... **Agent proposes, code disposes.**"*

The phase primitive is a Python context manager with three lane kinds:
```python
with run.phase(PhaseParams(name="plan", kind="agent", owner="planner", ...)) as ph:
    plan = ph.call(AgentCall(output_type=PlanOutput, prompt=prompt,
                             gates=[gates.artifacts_exist, gates.files_non_empty]))
with run.phase(PhaseParams(name="commit", kind="code", owner="git", ...)) as ph:
    ...
return run.finish(accepted=review.approved, reason="the reviewer never approved")
```
*(README "Phases: three lanes, one primitive"; note the agent never runs `git commit` itself — "The agent
proposes the message as a field on its envelope. Code decides whether to use it ... and performs the
write.")*

**Typed envelopes between phases:** *"An agent has exactly two output channels: reference files written
into `context_handoff/`, and a final valid-JSON response parsed against the output type the call
declared. Code persists that response as `envelope.json`, records it, and injects it into the next
agent's prompt. Context transfers in code, not in conversation."* `EnvelopeBase` carries
`status: Literal["success","fail"]`, `summary`, `artifacts`, `notes_for_next_agent`.

**Gates verify claims, not predictions (post-hoc):** *"Gates verify claims, never predictions. Nobody
knows which files an agent will touch before it finishes, so gates run **after** the fact against the
envelope's own declarations: `artifacts_exist`, `files_non_empty`, `json_parses`, `diff_matches_claims`,
`tests_pass(...)`. A gate is a callable with the signature `gate(envelope, run) -> GateReport`"* — a green
gate reports *what* it verified.

**Boundary enforcement in code:** *"`tools` is a capability list. `writes` is the boundary. ... `bash` runs
anything ... So 'this agent changes nothing' is enforced in code, after every call, by comparing the repo
before and after. Unauthorized changes are rolled back and the phase fails."* `protected_files` keeps
agents off the machinery that grades them.

**Repair = same-session correction, not cold restart:** *"When JSON does not parse or a gate returns
violations, **nothing restarts**. The harness re-prompts the same session with a correction naming
exactly what was wrong, and the context window stays intact."* `--adw-id` makes runs join a session so each
agent *"resumes its existing context window ... instead of starting cold."*

**Failure modes (own "Honest edges" table):** *"The test phase reports green on a fresh install — `quality.py`
ships placeholder commands that exit 0. Three ADWs run them as their test phase"* → *"Wire your real
commands into `quality.py` before trusting ... This is the first thing to customize"*; *"Gates pass, output
is bad — Gates check what a predicate can check, not plan quality or code taste. Run the `reviewer`, or
read it yourself"*; *"An agent edits something it should not — Detected and rolled back after the call, and
the phase fails. Expected."*

**Deliberately absent:** *"It runs on your current branch. There is no sandbox, no branch per run, no merge
step, no cloud, and no human-in-the-loop approval phase. Those are the obvious next things to build. They
are left out so the core stays small..."* — i.e., human gate = the engineer watching; nothing automated.

**Memory:** per-`adw_id` sessions + `context_handoff/` + SQLite trace (`sessions`, `phases`, `envelopes`,
`gate_results`, `processes` tables) — *observability*, not run-to-run learning.

## 2. Vercel eve — "Foreman" Software Factory template (GitHub work items → reviewed draft PR)

URLs: https://github.com/vercel-labs/eve-software-factory-template (README, AGENTS.md, agent/instructions.ts,
agent/agent.ts, agent/lib/factory-brain.ts, agent/lib/github/approval.ts, agent/lib/github/repo-sandbox.ts,
agent/subagents/reviewer/instructions.md, agent/subagents/implementer/instructions.md,
evals/safety/no-direct-push-to-main.eval.ts @ main; stars 1110, pushed 2026-08-20).
NOTE: the old `vercel-labs/eve` repo now 404s (framework is closed; `eve.dev`); this template + its code is
the authoritative open code-level artifact. The Vercel blog page is JS-only (curl returned 1 char) — not cited.

**Loop owner = eve runtime + declarative TS; deterministic station order.** `agent/instructions.ts` (the
orchestrator system prompt, injected with `FACTORY_REPO`): *"You are Foreman, the orchestrator of a software
factory ... move each one through four stations: classifier, analyst, implementer, reviewer. The finished
product is a reviewed draft pull request ... You never write code or perform deep analysis yourself: you
route work, verify handoffs, and assemble the result."* Hard rules: *"Run the stations strictly in order:
`classifier`, then `analyst`, then `implementer`, then `reviewer`."* / *"Never skip a station, even for
'trivial' requests."* / *"Never let the implementer judge its own work; the reviewer's independence is the
point of the station."*

**Structured envelopes between stations:** `AGENTS.md`: each station's `agent.ts` *"declares an
`outputSchema`, which makes every delegation run in **task mode**: structured output, no parking."* Subagents
*"inherit nothing from the root"*; long context moves as **handoff artifacts** (`save_artifact`/`read_artifact`
by id, reserved Blob prefix) rather than through the orchestrator. Sessions budgeted in code:
`agent/agent.ts`: *"Conversation history is compacted once it reaches 75% of the context window. The
per-session output token limit caps runaway sessions ... `maxOutputTokensPerSession: 100_000`."*

**Verify gate = independent reviewer agent on the real diff (separate sandbox, different vendor).**
`agent/subagents/reviewer/instructions.md`: *"You are the quality gate of a software factory. ... You never
write or fix code yourself: you produce findings for the implementer."* / *"Review the real diff ... Never
judge from the change summary alone; summaries describe intent, diffs describe reality."* / *"Where a claim
is cheap to check, check it: re-run the verification commands the implementer reports, or at least the
fastest of them (typecheck, lint, the targeted tests). Distrust 'it should work'; look for actual output."*
Verdicts: `approve` / `request_changes` / `reject`. Independence is structural: different model vendor
(AGENTS.md: *"implementer runs the strongest coding model on a different vendor than `reviewer`, so the
review stays independent"*) and different sandbox (`reviewer/sandbox.ts`: *"the reviewer sees the pushed
branch, not the implementer's working state"*).

**Bounded repair:** instructions.ts *"The review loop ... If the reviewer returns `request_changes`, send
the work back to the implementer ... Allow at most 2 revision cycles. If the work still doesn't pass, stop,
report the unresolved findings on the originating thread, and don't open a pull request."* Malformed station
output → *"retry it once with a clarified message before surfacing the failure."*

**Multi-file/run reality:** real repo cloned in Vercel sandboxes at template build; deps installed by
`FACTORY_SETUP_COMMAND` (repo-sandbox.ts: *"the clone and dependency install are paid once and every session
inherits the filesystem"*); implementer instructions: *"Verify with the repository's own checks: the lint,
typecheck, and test commands the analysis names ... Run them and record exactly what you ran and what it
produced. If something could not be verified, say so explicitly rather than implying it works."* Implementer
pushes a feature branch; orchestrator opens a **draft** PR.

**Memory = factory brain (bounded, gated):** `factory-brain.ts`: *"The brain is the factory's shared, durable
memory of the target repository: build quirks, verification gotchas, recurring review findings, and
conventions learned on earlier runs."* `MAX_FACTORY_BRAIN_LENGTH = 40_000`, key = sha256(`FACTORY_REPO`).
Write-gated: instructions.ts — *"An unattended run cannot write the brain. When one surfaces a fact worth
keeping, include it in your final reply on the intake issue under a 'Suggested factory brain note' line, so
a maintainer can review it"* — a real *failure→future-behavior* mechanism, but human-curated.

**Human gates = code-level approval policies** (`agent/lib/github/approval.ts`): `shipPolicy` — *"marking a
pull request ready for review ... parks for every human caller, trusted or not; shipping is the factory's
human gate. Unattended runs are denied outright."* `createPullRequestPolicy`: draft PRs auto-allowed,
*"anything that can be merged follows `shipPolicy`"*. `factoryBrainPolicy` and `writePolicy`: unattended
runs **denied** (never parked — *"an approval card would strand the session forever"*). Trust stamped at
dispatch; issue-body injection cannot widen scope (`commentPolicy` scopes unattended comments to the intake
issue). Safety eval as regression gate: `evals/safety/no-direct-push-to-main.eval.ts` asserts the agent
refuses to bypass PR flow; CI `pnpm eval` guards routing/safety; `pipeline` evals push a real branch to a
scratch repo deliberately.

## 3. MetaGPT — SOP assembly line (roles as state machines; review is an action, tests default OFF)

URLs: https://github.com/geekan/MetaGPT (README.md, metagpt/software_company.py, metagpt/roles/engineer.py @ main; fetched 2026-09-08). Paper: arXiv:2308.00352.

**Loop owner = Team + Roles + Actions (code), n_round budget.** `software_company.py` CLI: `n_round: int =
5` ("Number of rounds for the simulation"), `code_review: bool = True`, `run_tests: bool = False`, hires
`TeamLeader, ProductManager, Architect, Engineer2, DataAnalyst` into a `Team`; *"company.invest(investment)"*
(then `asyncio.run(company.run(n_round=n_round, idea=idea))`). Crash recovery by serialized state:
`recover_path` → `Team.deserialize(stg_path=...)` ("not endswith `team`" → FileNotFoundError). Paper
abstract: *"MetaGPT encodes Standardized Operating Procedures (SOPs) into prompt sequences ... allowing
agents with human-like domain expertise to verify intermediate results and reduce errors."*

**Produce-and-verify:** code review is an in-loop action, not a separate process. `engineer.py`: Engineer
watches `[WriteTasks, SummarizeCode, WriteCode, WriteCodeReview, FixBug, WriteCodePlanAndChange]`;
`_act_sp_with_cr(review=...)`: after each coding todo, *"# Code review — if review: action =
WriteCodeReview(...) ... coding_context = await action.run()"*, then files saved to `repo.srcs` with
dependency tracking. **Tests are NOT default**: in `software_company.py` the `QaEngineer` hire is commented
out with *"if run_tests: company.hire([QaEngineer()]); if n_round < 8: n_round = 8 # If `--run-tests` is
enabled, at least 8 rounds are required to run all QA actions."* — QA/run-tests is opt-in and the code says
so. Auto-summarize loop capped: `max_auto_summarize_code` (0 default; -1 = unlimited) with `_is_pass(summary)`
gating.

**Multi-file reality:** emits a project tree into a workspace (docs/resources/workspace shows generated
apps). No built-in sandboxed run verification in the default pipeline (run_tests=False).

## 4. ChatDev 1.0 (classic, branch `chatdev1.0`) — Virtual Software Company: JSON chain, role-play loops, review phases

URLs: https://github.com/OpenBMB/ChatDev/blob/chatdev1.0/chatdev/{chat_chain,phase,chat_env,codes,eval_quality}.py and run.py (fetched 2026-09-08). Paper: arXiv:2307.07924.
NOTE: current `main` is the rewritten **ChatDev 2.0 "DevAll"** platform (released 2026-01-07; classic moved to `chatdev1.0`) — see §5. No mid-edit corruption observed on either branch.

**Loop owner = JSON ChatChain config + Python `Phase` objects (code), inside an LLM role-play.** `chat_chain.py`:
*"self.chain = self.config["chain"]; self.recruitments = self.config["recruitments"]"*; `execute_chain()` is a
plain `for phase_item in self.chain: self.execute_step(phase_item)`. Each step resolves a `Phase` class by
name (`getattr(self.phase_module, phase)`); `phaseType: "SimplePhase"` → `Phase.execute(...)` with
`max_turn_step` override else a default turn limit; `"ComposedPhase"` → `cycle_num` composition.
`phase.py execute()`: *"execute the chatting in this phase 1. receive information ... 2. execute the
chatting 3. change the environment"* and the inner dialogue is a **bounded for-loop**: *"for i in
range(chat_turn_limit)"* with `assert 1 <= chat_turn_limit <= 100` (default `chat_turn_limit=10`).
Phase classes encode the SDLC as code classes: `DemandAnalysis`, `LanguageChoose`, `CodeReviewComment`,
`CodeReviewModification`, `Human-Agent-Interaction` (interactive `input()` loop, "Type 'end' on a separate
line to submit").

**Review = two chained phases, not an LLM "verdict" type:** `CodeReviewComment` writes
`chat_env.env_dict['review_comments']` from its seminar conclusion; `CodeReviewModification` consumes them —
review comments are parsed by the following phase, and `codes.py` diffs/rewrites files with git
management (`git init; git add .; git commit -m "v{version} {phase_info}"`, and "nothing to commit" rolls
the version back). Multi-file emission is concrete: `_rewrite_codes` writes every `codebooks[filename]` to
disk; `eval_quality.py` exists to score outputs. Memory: `ChatEnvConfig.with_memory` flag
("Whether to use memory in the interaction between agents"). Paper: communicative dehallucination +
chat chain guide "what to communicate and how" (arXiv:2307.07924). No CI/sandbox run verification: code is
written to `WareHouse/` and best-effort run by the human.

## 5. ChatDev 2.0 "DevAll" (current `main`) — graph executor with human nodes, loop counters, memory stores

URLs: https://github.com/OpenBMB/ChatDev (README.md; docs/user_guide/en/{execution_logic.md, nodes/human.md,
nodes/loop_counter.md, modules/memory.md} @ main; fetched 2026-09-08). README: *"ChatDev has evolved from a
specialized software development multi-agent system into a comprehensive multi-agent orchestration
platform."* (ChatDev 2.0 (DevAll), "Zero-Code Multi-Agent Platform"; news item 2026-01-07.)

**Loop owner = deterministic graph engine.** `execution_logic.md`: DAG → *"Topological sort + parallel layer
execution"*; cycles → Tarjan SCC detection → *"Super Node"* abstraction → recursive execution; loop exit
conditions: *"Exit edge triggered / Maximum iterations reached (default 100) / Time limit reached / Initial
node not re-triggered"*. Edge `condition` types: `true` | `keyword` (contains/excludes) | `function`.

**Human gate as a first-class node:** `nodes/human.md`: *"The Human node is used to introduce human
interaction during workflow execution ... This node blocks workflow execution until the user submits a
response."* Example "Human-Machine Collaboration Loop": agent writes → human reviews → *edge condition
`keyword none: [ACCEPT]`* routes back to the writer until ACCEPT.

**Hard iteration caps as a node:** `nodes/loop_counter.md`: *"The Loop Counter node ... suppress-release
mechanism ... `max_iterations` (default 10) ... Prevents infinite loops ... Iteration control: Limit the
maximum number of self-improvement iterations for an Agent ... Timeout protection: circuit breaker."*
(Wiring requirement: counter must connect in-loop AND to an End node outside the loop.)

**Memory stores (run→run persistence, no autonomous self-modification):** `modules/memory.md`: stores =
`simple` (JSON + FAISS), `file` (vector index of docs), `blackboard` (append-only), `mem0`
(*"Cloud-managed by Mem0 ... Memories persist across runs and sessions automatically"*); attachments read at
stages `pre/plan/gen/critique`; writes only user input to mem0 — *"Assistant output is excluded to prevent
noise memories from the LLM's responses being extracted as facts"*.

## 6. OpenHands / Agent Canvas (All-Hands-AI) — the loop moved OUT of the UI into ACP agent subprocesses

URLs: https://github.com/All-Hands-AI/OpenHands (docs/architecture.md, docs/ACP_AGENTS.md, AGENTS.md @ main; fetched 2026-09-08) and https://github.com/OpenHands/software-agent-sdk (README @ main).
HONEST STATE: the `All-Hands-AI/OpenHands` repo HEAD is now the **Agent Canvas** desktop client
(`bin/agent-canvas.mjs`, Electron, npm `@openhands/agent-canvas`), not the old event-loop controller; the
org's agent runtime lives in `OpenHands/software-agent-sdk` (badge cites SWE-bench 77.6). A `docs/AGENTS.md`
(120 KB dev guide) and `docs/CANVAS_EXTENSIONS_TESTING.md` confirm the pivot.

**Who owns the loop:** `docs/architecture.md` (repo HEAD): *"Agent Canvas is a React and TypeScript frontend
for running and monitoring OpenHands agents across local, remote, and hosted environments."* / *"Agent Canvas
is not responsible for: Executing agent actions directly. Providing the sandbox or workspace isolation
layer."* The engine is the Agent Server (`OpenHands/software-agent-sdk/.../openhands/agent_server`).
`docs/ACP_AGENTS.md`: *"The [Agent Client Protocol (ACP)] is a standard for talking to coding agents over
JSON-RPC on stdio. Instead of Agent Canvas calling an LLM directly, the Agent Server spawns the agent's own
CLI as a subprocess and relays each turn to it. The external agent manages its own LLM, tools, and
execution"* — supported ACP agents: Claude Code (`@agentclientprotocol/claude-agent-acp`), Codex
(`codex-acp`), Gemini CLI (`--acp`). So the 2025-26 answer from OpenHands is: **the UI owns human steering,
the agent CLI owns its own loop, and the protocol is the seam.**

**Gates:** quality gates are CI on the client itself (docs/architecture.md): typecheck, ESLint, unit tests,
builds, `npm pack --dry-run`; runtime sandboxing is delegated (*"Docker sandbox mode for laptop usage"*).
SDK README: agents *"can either use the local machine as their workspace, or run inside ephemeral
workspaces (e.g. in Docker or Kubernetes) using the Agent Server"* — run-verification sandboxing lives in
the server layer.

## 7. Claude Code — hooks as deterministic gates; subagents; CLAUDE.md memory; human at the edges

URLs (fetched 2026-09-08): https://code.claude.com/docs/en/hooks , https://code.claude.com/docs/en/sub-agents ,
https://www.anthropic.com/engineering/claude-code-best-practices (docs content), https://github.com/anthropics/claude-code (AGENTS.md absent; README 2.9 KB pointer), https://github.com/anthropics/claude-agent-sdk-python (README).
The core loop binary is closed — code-level control is exposed as **hooks, permissions, subagents, plan mode, checkpoints**.

**Deterministic gates = hooks (code, not prompt):** best-practices: *"Unlike CLAUDE.md instructions which
are advisory, hooks are deterministic and guarantee the action happens. ... 'Write a hook that runs eslint
after every file edit' or 'Write a hook that blocks writes to the migrations folder.'"* Hooks reference: the
event set includes `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `UserPromptSubmit`, `Stop`,
`SubagentStart/Stop`, `TaskCreated/Completed`, `PermissionRequest`, `PermissionDenied`, `SessionStart/End`;
decision control exists on most; *"Exit code 2"* = block (the docs table: PreToolUse output
`permissionDecision (allow/deny/ask/defer)`; Stop decision *"Prevents Claude from stopping, continues the
conversation"*; TaskCompleted *"Prevents the task from being marked as completed"*). Hook kinds: shell
commands, HTTP endpoints, MCP tool calls, LLM prompts, or subagents.

**Verify-the-run guidance (the human is told to stop being the verification loop):** best-practices: *"Give
Claude a check it can run: tests, a build, a screenshot to compare. It's the difference between a session
you watch and one you walk away from. ... Without a check it can run, 'looks done' is the only signal
available, and you become the verification loop: every mistake waits for you to notice it. Give Claude
something that produces a pass or fail, and the loop closes on its own. Claude does the work, runs the
check, reads the result, and iterates."* Recommended workflow = explore→plan→code separated by **plan mode**
(*"Use plan mode to separate exploration from execution"*, `claude --permission-mode plan`); plus *"Add an
adversarial review step"* and *"Rewind with checkpoints"* / `/rewind` message checkpoints (rollback = repair).

**Subagent isolation + hard turn caps:** sub-agents docs: *"Each subagent runs in its own context window
with a custom system prompt, specific tool access, and independent permissions."* `maxTurns` field: *"Maximum
number of agentic turns before the subagent stops. When the subagent reaches the limit, Claude Code returns
its output marked as partial, and Claude can resume it to continue."* `permissionMode` per subagent;
`.claude/agents/` definitions are version-controlled. Memory = `CLAUDE.md` read *"at the start of every
conversation"* (advisory) vs hooks (deterministic) — Anthropic itself frames the distinction.

**Human gates:** permission modes (`default/plan/acceptEdits/auto/dontAsk/bypassPermissions` per hooks
docs), `PermissionRequest` events, and best-practices "stop and ask" workflow; SDK options expose
`permission_mode`, `allowed_tools`, `canUseTool` callbacks (https://github.com/anthropics/claude-agent-sdk-python).

## 8. OpenAI Codex — Rust loop, sandbox + approval policies, AGENTS.md as memory, Guardian review (cloud)

URLs: https://github.com/openai/codex (README.md, AGENTS.md, codex-rs/core/src/{agent/control.rs,
apply_patch.rs, agents_md_manager.rs, guardian_review.rs, exec_policy} @ main; fetched 2026-09-08) and https://developers.openai.com/codex (nav: "Sandboxing", "Auto-review", "Agent approvals & security", "AGENTS.md", "Subagents", "Hooks", "Non-interactive mode").

**Loop owner = Rust code (codex-core thread/turn machinery), LLM as tool-caller.** `agent/control.rs` shows
the turn control surface (`TurnInputRequest/TurnInputSubmission/TurnStartOptions`, `AgentRegistry`,
`AgentStatus`, `is_final`, `RolloutBudgetConfig`, `thread_rollout_truncation`) — deterministic thread/rollout
code around model turns. Repo AGENTS.md imposes *code-level* loop discipline on agents editing codex itself
(e.g., context budget rules: *"No unbounded items — everything injected in the model context must have a
bounded size and a hard cap. No items larger than 10K tokens"*).

**Edit gate = safety assessment in code:** `apply_patch.rs`: `assess_patch_safety(...)` →
`SafetyCheck::AutoApprove` (with `ExecApprovalRequirement::Skip { bypass_sandbox: false, ... }`) or
`SafetyCheck::AskUser` — *"Delegate the approval prompt (including cached approvals) to the tool runtime,
consistent with how shell/unified_exec approvals"*. Sandboxing: exec policy modules + per-OS sandboxes
(AGENTS.md notes the repo's own agents run under `CODEX_SANDBOX_NETWORK_DISABLED=1` and Seatbelt
(`/usr/bin/sandbox-exec`)); Windows sandbox/app-container modules exist in the tree.

**Memory = AGENTS.md loading with trust levels:** `agents_md_manager.rs`: *"Owns the inputs and cached
result of AGENTS.md discovery for a session"*, caching by `TurnEnvironmentSelection` +
`active_project_trust_level: Option<TrustLevel>` → `load_project_instructions(config, ...)`; docs nav has a
dedicated "AGENTS.md" page. Codex CLI also persists sessions (resume).

**Review/verify = Guardian (cloud) + approvals:** `guardian_review.rs` types: `GuardianApprovalRequest`,
`GuardianAssessment`, `GuardianReviewDecision`, `GUARDIAN_REVIEW_TIMEOUT`, `AUTO_REVIEW_DENIAL_WINDOW_SIZE`,
and the doc comment: *"Whether this turn should route allowed approval prompts through the guardian reviewer
instead of surfacing them to the user. ARC may still block actions earlier in the flow."* — approvals
normally surfaced to the human can be auto-reviewed by a separate reviewer model in autonomous mode.
`apply_patch.rs` + `mcp_tool_approval_templates.rs` + docs "Agent approvals & security" = tiered approval
policies are the human gate. Multi-agent: `agent_communication.rs`, `codex-delegate`, `agent-roles`,
`MultiAgentMode`/`CollabAgentState` protocol types.

## 9. SWE-agent (Princeton) — ACI over Docker; the "review on submit" prompt IS the self-gate

URLs: https://github.com/princeton-nlp/SWE-agent (config/default.yaml, sweagent/agent/reviewer.py,
sweagent/environment/swe_env.py @ main; fetched 2026-09-08). Paper: arXiv:2405.15793 (*"custom
agent-computer interface (ACI) ... navigate entire repositories, and execute tests and other programs ...
pass@1 rate of 12.5%"* on SWE-bench, 2024).

**Loop owner = agent loop code (python) + config templates; LLM chooses tool calls in a Docker env.**
`config/default.yaml` system template instructs the model itself: *"2. Create a script to reproduce the
error and execute it with `python <filename.py>` using the bash tool, to confirm the error 3. Edit the
sourcecode ... 4. Rerun your reproduce script and confirm that the error is fixed! 5. Think about edgecases"*
— verify-by-execution is *prompted*, not enforced by a gate; enforcement is external (SWE-bench eval hooks).

**Submit gate = diffed self-review prompt:** the same config's `SUBMIT_REVIEW_MESSAGES` (tool bundle
`tools/review_on_submit_m`) forces a checklist before the model submits: re-run the reproduction script,
*"3. If you have modified any TEST files, please revert them ... `git checkout -- /path/to/test/file.py`"*,
then *"Run the submit command again to confirm"* with *"Here is a list of all of your changes: <diff>
{{diff}}"* — the agent re-checks its own work against its own diff before the loop yields. There is also an
agent-level `sweagent/agent/reviewer.py` (a reviewer role in the harness) and `run/hooks/swe_bench_evaluate.py`
for out-of-loop test evaluation. Environments are containerized (`swe_env.py`); no built-in run-to-run
memory; trajectories are recorded for analysis.

## 10. strongdm/attractor — a *spec* for a factory coding agent (nlspec; no code shipped)

URLs: https://github.com/strongdm/attractor (attractor-spec.md, coding-agent-loop-spec.md,
unified-llm-spec.md @ main; fetched 2026-09-08; "nlspec of StrongDM's Attractor, a non-interactive Coding
Agent sufficient for use in a Software Factory"). Honest caveat: docs only (5 files, no implementation).

`coding-agent-loop-spec.md`: *"a language-agnostic specification for building a coding agent — an autonomous
system that pairs a large language model with developer tools through an agentic loop."* Deterministic
bounds spelled out in spec records: `SessionConfig { max_turns: Integer = 0 -- 0 = unlimited;
max_tool_rounds_per_input: Integer = 0; default_command_timeout_ms: Integer = 10000 }`; `patch` tool errors
include *"verification failure"*; subagents for *"Test execution: Spawn an agent to run and fix tests while
the parent continues other work."* — i.e., an industrial buyer specifying the same code-owned-loop shape.

## 11. Fabro — "the open source dark software factory" (workflow graphs: deterministic gates + human nodes)

URLs: https://github.com/fabro-sh/fabro (README.md, apps/marketing/src/content/blog/introducing-fabro.md,
docs/internal/error-handling-strategy.md @ main; fetched 2026-09-08; Rust, pushed same day). Blog dated 2026-03-16 by Bryan Helmkamp.

**Loop owner = Graphviz DOT workflow graphs** (blog): *"you define your engineering process as a Graphviz
graph — diffable, reviewable, and version-controlled just like the code it produces. ... Node shapes
determine behavior — `box` for agents with tool access, `hexagon` for human decision gates, `diamond` for
conditionals, `parallelogram` for shell commands. The graph supports loops, not just DAGs, so you can build
implement-test-fix cycles that repeat until verification passes. **The process is deterministic, even though
the AI execution within each stage is not.**"* README: *"Deterministic workflow graphs — Define pipelines in
Graphviz DOT with branching, loops, parallelism, and human gates."*

**Two gate layers:** blog — *"**Deterministic verification.** Goal gates confirm that the code compiles,
tests pass, and linting is clean before the workflow advances. These aren't LLM judgments — they're shell
commands with pass/fail exit codes."* and *"**Human-in-the-loop gates.** Hexagon nodes pause the workflow for
human approval, rejection, or freeform input. ... When you trust the process, `--auto-approve` skips gates
entirely."* README feature list: *"Layer deterministic verifications — test suites, linters, type checkers,
LLM-as-judge — into your workflow graph. Failures trigger fix loops automatically."*

**Repair/checkpoint:** *"Every stage is checkpointed to Git. If a run fails at stage 7 of 12, you don't
start over — you fix the issue and resume from the checkpoint."* Sandboxes: local/Docker/SSH/Daytona cloud
VMs. Memory/learning: none beyond durable run events/checkpoints ("Inspect every run — durable event streams,
checkpoints, conclusions"); roadmap has `human-in-the-loop.yaml`.

## 12. Runfusion/Fusion — multi-agent orchestrator with quality gates & planner oversight

URL: https://github.com/Runfusion/Fusion (README.md @ main; fetched 2026-09-08; TS; badge "status: early
preview"; 1.2k stars). README: *"A software factory, run by a multi-agent orchestrator ... a team of AI
agents plans, builds, reviews, and ships it for you."* / *"A planning agent reads your project ... and writes
a full `PROMPT.md` plan — steps, file scope, acceptance criteria. Then Fusion plans, reviews, executes, and
reviews again, in an isolated git [worktree]."* Code-level gate vocabulary: *"Workflow Steps — Configurable
quality gates (pre-merge: blocks merge; post-merge: informational)"*; *"Planner oversight — Workflow-native
`plannerOversightLevel` (`off`/`observe`/`steer`/`autonomous`)"* — human oversight is a typed per-workflow
setting, not a prompt. Claims are marketing-grade in places; treat as early-preview evidence.

## 13. Machinist (owainlewis) — minimal factory: approved commands, human keeps the ship decision

URL: https://github.com/owainlewis/machinist (README.md @ main; fetched 2026-09-08; Go). *"The open source
AI software factory for agentic coders."* / *"**Keep the human gate.** Machinist hands back a pull request.
It does not decide what ships."* / *"**One controlled entrypoint.** Workers expose named commands and
repositories, never arbitrary shell text"* (config `[commands.foreman] executor = "codex" timeout = "45m"`).
Honest about non-magic: *"Scripts are intentionally opaque. Their internal stages appear in logs, but
Machinist does not invent child runs, graphs, checkpoints, or resumable stages. A killed script restarts
from the beginning unless the script owns checkpointing."* — an explicit refusal to fake loop features.

## 14. Aider — lightweight in-loop lint/test gates (no factory)

URLs: https://github.com/Aider-AI/aider (README.md @ main) and https://aider.chat/docs/usage/lint-test.html
(fetched 2026-09-08). Docs: *"Aider can automatically lint and test your code every time it makes changes."*
/ *"You can run tests with `/test <test-command>`. Aider will run the test command ... If there are test
errors ... return a non-zero exit code. Aider will try and fix any errors if the command returns a non-zero
exit code."* / *"configure aider to run your test suite after each time the AI edits your code using the
`--test-cmd <test-command>` and `--auto-test` switch."* → same-session repair driven by exit codes; loop
owner is the interactive session (human in the loop by design); no multi-file factory graph, no run-to-run
memory (repo map is per-session context).

## 15. gpt-pilot — the cautionary tale (unmaintained, supply-chain worm)

URL: https://github.com/Pythagora-io/gpt-pilot (README.md @ main; fetched 2026-09-08). README top (verbatim):
*"Malicious code was found in this repository and has been removed. A supply-chain worm (a credential
stealer) was hidden in `core/telemetry/` from **August 2025** until **11 June 2026**."* / *"This repository
is **no longer actively maintained**, which is why the malicious commit went unnoticed for an extended
period."* — the canonical failure mode for "autonomous builder" repos: no human gate on dependencies, no
maintainer, credential-stealing payload shipped for 10 months. (It did generate multi-file apps with
human-checkpointed task trees in its day; that code path is now suspect-by-default.)

---

## Comparison table (code-level)

| Factory (URL) | Loop owner | Produce-and-verify gate mechanism | Verify the RUN? | Memory / learning | Human gates & stop |
|---|---|---|---|---|---|
| **disler/super-simple-software-factory** | Python ADW phase contexts; agent = bounded node ("Agent proposes, code disposes") | Post-hoc gates on typed envelope: `artifacts_exist`, `files_non_empty`, `json_parses`, `diff_matches_claims`, `tests_pass(...)`; rollback of unauthorized writes; `protected_files` | Repo's own test/lint commands as `code` phases (placeholder `quality.py` exits 0 until wired — admitted) | Sessions by `adw_id`, `context_handoff/`, SQLite trace (no learning) | None built in (admitted); engineer watches; finish = `review.approved` flag |
| **vercel-labs/eve-software-factory-template (Foreman)** | eve runtime + deterministic 4-station pipeline (classifier→analyst→implementer→reviewer); `outputSchema` task-mode envelopes | Independent reviewer agent on real diff in own sandbox, different model vendor; re-runs implementer's commands; approve/request_changes/reject | Real repo clone + `FACTORY_SETUP_COMMAND` install in sandbox; implementer runs repo's lint/typecheck/tests & records output; draft PR per run | **Factory brain** (≤40k chars, keyed per repo): durable notes fed to every run; writes denied to unattended runs, human-curated | shipPolicy: draft PR auto, "mark ready"/merge = human only; approvals `denied` (not parked) on unattended runs; CI evals (no-direct-push) |
| **geekan/MetaGPT** | Team/Role/Action Python state machine; `n_round=5` rounds | `WriteCodeReview` action after each code todo (default `code_review=True`); `_is_pass` gating on summaries | `run_tests=False` default; QaEngineer hire commented out (≥8 rounds if enabled) | Serialized `Team` storage for resume; role memory flags (mostly off: `enable_memory=False` in Engineer) | None in pipeline; human = boss issuing idea/investment |
| **OpenBMB/ChatDev 1.0 (chatdev1.0)** | JSON `chain` config; Python Phase classes; inner `for i in range(chat_turn_limit)` role-play (limit 10, ≤100) | CodeReviewComment→CodeReviewModification phase pair over git-diffed multi-file code; `eval_quality.py` | Writes files + git commits to `WareHouse/`; no sandbox/test gate | `with_memory` env flag (message memory) | Human-Agent-Interaction phase (`input()`); otherwise unattended waterfall |
| **OpenBMB/ChatDev 2.0 DevAll (main)** | Graph engine: DAG topo-sort / Tarjan SCC super-nodes (code) | Edge conditions (keyword ACCEPT etc.) route loops; exit on max iterations (default 100), timer, exit-edge | Agent/human/python nodes; human review loops in YAML | Memory stores: simple/file/blackboard/mem0 (persists across sessions) | `human` node blocks until user input; `loop_counter` node caps iterations (circuit breaker) |
| **All-Hands-AI/OpenHands → Agent Canvas + software-agent-sdk** | ACP subprocess owns the loop (Claude Code/Codex/Gemini CLIs or OpenHands agents); server spawns + relays turns; Canvas = UI | Client CI gates (typecheck/lint/tests/build/`npm pack --dry-run`); sandboxing delegated to Agent Server (Docker/K8s) | Agents run in ephemeral Docker/K8s workspaces; SWE-bench 77.6 badge | SDK sessions; (per-agent memory delegated to the CLI) | Canvas = human steering/monitoring UI; ACP `permission` flow |
| **Claude Code (docs/SDK)** | Closed binary loop; user code controls it via hooks/settings | **Hooks**: PreToolUse/PostToolUse/Stop/...; exit code 2 blocks; permission decisions allow/deny/ask/defer | Best-practice: give it a check (tests/build/screenshot) or "you become the verification loop" | `CLAUDE.md` read every session (advisory); skills; `/rewind` checkpoints | Permission modes incl. plan mode; PermissionRequest; subagents `maxTurns` cap returns partial; "auto mode" + adversarial review recommended |
| **openai/codex** | Rust codex-core thread/turn machinery; model calls tools | `assess_patch_safety` AutoApprove/AskUser; sandbox exec policies; Guardian review routes approvals to reviewer model (cloud); CI on repo | Shell in sandbox (`CODEX_SANDBOX_NETWORK_DISABLED`, Seatbelt, Windows sandbox); `apply_patch` + shell; tests are out-of-loop | AGENTS.md loader with `TrustLevel`; session resume; agent-graph-store | Tiered approvals (AskUser etc.); non-interactive mode only where policy allows |
| **princeton-nlp/SWE-agent** | Python agent loop + template prompts; Docker env (ACI) | Submit self-review message w/ own `<diff>`; must re-run repro; reviewer.py role; SWE-bench eval hooks | Repro script run inside Docker (`python file.py`); tests runnable via bash tool | Trajectories recorded (analysis only) | None (benchmark agent); stop = submit command |
| **strongdm/attractor (spec)** | Spec: deterministic loop config (`max_turns`, `max_tool_rounds_per_input`, timeouts) | patch tool reports verification failure; subagent "run and fix tests" | Shell tool w/ timeouts & permissions (spec) | Spec-level only | Spec'd permission/approval surfaces |
| **fabro-sh/fabro** | Graphviz DOT graphs executed by Rust engine; agents in box nodes | Deterministic goal gates = shell exit codes (tests/lint/build); LLM-as-judge optional | Sandboxes: local/Docker/SSH/Daytona VMs; every stage git-checkpointed, resume mid-run | Durable events/checkpoints; no learning | Hexagon human nodes; `--auto-approve` skips them |
| **Runfusion/Fusion** | Multi-agent orchestrator; PROMPT.md plan + acceptance criteria | Quality gates pre-merge (block) / post-merge; review steps | "Isolated git worktree"; Browser Verification step (opt-in) | Sessions/board state | `plannerOversightLevel` off/observe/steer/autonomous; review/approval columns |
| **owainlewis/machinist** | Scripts/executors (codex etc.); no invented graphs | None beyond script exit; approved-command allowlist | Worker keeps repos/creds local; hands back PR | Events/artifacts logged | "Keeps the human gate ... does not decide what ships"; killed script restarts from beginning |
| **Aider** | Interactive session (LLM+repo map) | `--test-cmd`/`--auto-test`/`/test`: non-zero exit → "try and fix" same session | Runs test/lint commands locally on edits | None (repo map per session) | Interactive; human confirms |
| **Pythagora-io/gpt-pilot** | (historical) human-checkpointed task tree | — | Ran dev server/tests (historical) | — | Unmaintained; worm in `core/telemetry` Aug 2025–Jun 2026 |

---

## The 5 hard requirements the code-level evidence supports

For anything to honestly be called an "autonomous software factory" (as opposed to a chat loop with extra
steps), the shipped code must show:

1. **Code owns the loop; agents own bounded phases.** Sequencing, retries, and acceptance live in
   deterministic code/state/graph (Python contexts + typed envelopes — disler; station pipeline with
   `outputSchema` task-mode delegations — eve; DOT graph engine — Fabro; graph executor w/ Tarjan SCC —
   DevAll; Team/Role/action rounds — MetaGPT; chain config + `Phase.execute` — ChatDev 1.0). Evidence:
   "Deterministic Python owns the graph. Coding agents are bounded nodes inside it."
   (github.com/disler/super-simple-software-factory README) — supported by every other row above.
2. **Produce-and-verify gates check the artifact/diff/run after the fact, by mechanism — and an
   independent agent where judgment is required.** Post-hoc `artifacts_exist/files_non_empty/
   diff_matches_claims/tests_pass` (disler), reviewer that "never write[s] or fix[es] code" and re-runs
   the implementer's commands on the pushed branch in a separate sandbox/vendor (eve), hooks with
   blocking exit codes (Claude Code), shell-exit-code goal gates (Fabro), code-review actions after every
   write (MetaGPT), `assess_patch_safety` + Guardian (Codex). Evidence: "Gates verify claims, never
   predictions" and "Never let the implementer judge its own work."
3. **Repair is a bounded same-context correction, with a hard iteration cap and an explicit stop that
   reports, not a silent cold restart.** "nothing restarts ... re-prompts the same session ... A cold
   restart throws away everything the agent just learned" (disler); "Allow at most 2 revision cycles. If
   the work still doesn't pass, stop, report ... and don't open a pull request" (eve instructions.ts);
   `loop_counter`/default max 100 (DevAll); `chat_turn_limit` with `assert 1..100` (ChatDev 1.0);
   `maxTurns` partial-output cap (Claude Code subagents); `max_turns` config (attractor); fix loops
   triggered by gate failure (Fabro). Cold restart is repeatedly named the failure to avoid.
4. **Multi-file reality with RUN verification in an isolated environment — with the honest distinction
   between executed and claimed.** Real checkouts + dependency install at build (eve `FACTORY_SETUP_COMMAND`),
   sandboxes (eve, Fabro, Codex, SWE-agent Docker, OpenHands Agent Server Docker/K8s), verification via
   the repo's own lint/typecheck/tests, and reviewers told "Distrust 'it should work'; look for actual
   output" (eve). Counter-evidence to keep honesty: disler's shipped placeholder `quality.py` "exit 0"
   admits gates can be theater until real commands are wired; MetaGPT defaults `run_tests=False`;
   SWE-agent's verify is *prompted* and enforced out-of-loop by SWE-bench eval.
5. **Durable, bounded, human-gated memory — and a universal human gate at ship.** Factory brain: shared
   per-repo notes read every run, writes approval-gated so unattended/untrusted runs cannot poison them
   (eve: "an untrusted issue body can't poison the context every future run reads"); CLAUDE.md/AGENTS.md
   loaded at session start (Claude Code; Codex `agents_md_manager` with `TrustLevel`); persistent mem0
   stores (DevAll). Ship/merge stays human in every shippable system: draft-PR-only + shipPolicy (eve),
   "Machinist hands back a pull request. It does not decide what ships" (machinist), hexagon human nodes
   (Fabro), permission/approval policies (Codex), plan/permission modes (Claude Code), human node +
   ACCEPT keywords (DevAll). And nothing ships autonomous self-modifying behavior: eve's brain is the
   closest, and it explicitly routes unattended discoveries to a human "Suggested factory brain note".

---

## Appendix — evidence honesty & method

- Fetched 2026-09-08 (UTC) via `curl`/python: `raw.githubusercontent.com/<owner>/<repo>/HEAD/...`
  (12 READMEs + ~40 source/doc files), GitHub REST API (repo metadata, trees, branches/tags, org lists,
  search), arXiv API (MetaGPT 2308.00352, ChatDev 2307.07924, SWE-agent 2405.15793), and SSR pages
  (code.claude.com hooks/sub-agents; developers.openai.com/codex nav; aider.chat docs). `web_search`/
  `web_extract` were unavailable (Firecrawl not configured) — no Firecrawl-dependent evidence used.
- Attribution of current state, verified at read time: `All-Hands-AI/OpenHands` HEAD is the Agent Canvas
  client (loop in external agent server/ACP CLIs); `OpenBMB/ChatDev` main = ChatDev 2.0 "DevAll" platform,
  classic code on branch `chatdev1.0`; `vercel-labs/eve` repo 404s (framework closed) → evidence taken from
  `vercel-labs/eve-software-factory-template`; vercel.com/blog/eve is JS-only (curl → 1 char) → not cited;
  `strongdm/attractor` is a spec, not code (said so); gpt-pilot unmaintained + worm disclosure quoted.
- No fetch returned evidence of mid-edit instability; two repos (fabro, Fusion) were pushed on the fetch
  date and their HEAD docs were internally consistent.
