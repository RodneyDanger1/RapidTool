# 13 — Top-40 Competitor & Capability Gap Register (G-01…G-40)

- **File:** `research/multiagent/13_top20_gaps.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
- **Date / agent:** 2026-09-06 · deepseek-v4-pro subagent (DEEP RESEARCHER — register extension G-21…G-40). **Strictly read-only on source**; this file and `14_agi_aggregation.md` are the only outputs of this pass.
- **Mission:** extend the gap register from 20 to 40 items across seven priority areas: (1) agent delegation & orchestration, (2) sequential thinking / planning, (3) algorithm-building tools, (4) architectural tools, (5) open-design UI, (6) DeepSeek-key-powered vector/logo generation, (7) other open-source steals.
- **Method (this pass):** every external repo is license-verified via the GitHub REST API (`license.spdx_id`, `stargazers_count`, `pushed_at`) on 2026-09-06; raw LICENSE text read where the API reports NOASSERTION; competitor/product claims cite fetched docs pages. Every RapidTool claim is file:line-verified against `src/` on disk today. Only MIT / Apache-2.0 / BSD-\* are accepted as code-steals; anything else is flagged in place and pattern-only. Zero hallucinations — anything that could not be fetched/verified is either omitted or explicitly marked.

---

## ⚠️ Recovery note (read first — disk corruption)

On 2026-09-06 the on-disk file `research/multiagent/13_top20_gaps.md` was found to contain **81,230 bytes of zeroes** — the original G-01…G-20 prose was lost to a failed write (no git history exists in this workspace; no backup or copy was found anywhere in the tree). The register seed is therefore **reconstructed in §1 as a compact table derived from the sibling research files** that the original register was cross-linked with (`06_competitor_survey.md`, `07_opensource_steal_catalog.md`, `08_enhancement_register.md`, `02_capability_audit.md`, `audit-bugs/05_multiagent.md` M-01…M-12). Rows are labeled with their derivation source; no fabricated detail is added. G-21…G-40 below are **new, fully verified content from this pass**.

---

## 0. Register at a glance (G-01…G-40)

| ID | Area | Item | Source / pattern | License (verified) | Rank (value÷effort) |
|----|------|------|------------------|--------------------|---------------------|
| G-01 | 7 | Markdown rendering (packet + artifacts) | marked + DOMPurify | MIT / Apache-2.0 (07 §2.1) | recovered §1 |
| G-02 | 7 | Syntax highlighting | shiki (server-side) | MIT (07 §2.4) | recovered §1 |
| G-03 | 7 | Fuzzy full-text search | minisearch | MIT (07 §2.3) | recovered §1 |
| G-04 | 7 | Diff views (P6 variants, HITL patches) | jsdiff | BSD-3-Clause (07 §2.4) | recovered §1 |
| G-05 | 7 | PDF export | print-CSS → pdfmake | MIT (07 §2.10) | recovered §1 |
| G-06 | 7 | DOCX export | docx | MIT (07 §2.10) | recovered §1 |
| G-07 | 7 | Diagram rendering | mermaid (lazy) | MIT (07 §2.2) | recovered §1 |
| G-08 | 7 | Spec-graph visualization | xyflow | MIT (07 §2.7) | recovered §1 |
| G-09 | 7 | Live terminal output | xterm.js (needs push channel) | MIT (07 §2.5) | recovered §1 |
| G-10 | 4 | Executable oracle + fail-to-pass loop | 02 §C E1 · 08 E-07/E-08 | zero-dep | recovered §1 |
| G-11 | 4 | Evidence-carrying report contract | 02 E2 · 08 E-16/E-22 | zero-dep | recovered §1 |
| G-12 | 1 | Research grounding lifecycle | 02 E3 · 08 E-13/E-24 | zero-dep | recovered §1 |
| G-13 | 4 | Regression-protected advancement + autopilot enforcement | 02 E4 · 08 E-19/E-20 | zero-dep | recovered §1 |
| G-14 | 7 | Memory write-back (self-learning loop) | 02 E4 · 08 E-18 (→ superseded by G-39) | zero-dep | recovered §1 |
| G-15 | 1 | Headless gate parity | 08 E-02/E-12 (M-10) | zero-dep | recovered §1 |
| G-16 | 4 | Honesty-lattice lint | 08 E-23/E-24 | zero-dep | recovered §1 |
| G-17 | 1 | CLI machine contract | 08 E-25 | zero-dep | recovered §1 |
| G-18 | 7 | In-browser bundling / live preview | esbuild-wasm | MIT (07 §2.8) | recovered §1 |
| G-19 | 7 | Streaming / live-output plumbing | Vercel AI SDK patterns | Apache-2.0 (07 §2.9) | recovered §1 |
| G-20 | 4 | Shipped-artifact pass (build + DEPLOY.md) | 08 E-27 | zero-dep | recovered §1 |
| **G-21** | 1 | Hierarchical crew orchestration (manager → workers, budgets, handoffs) | CrewAI hierarchical · OpenAI Swarm handoffs | MIT (API-verified) | **#2** |
| **G-22** | 1 | Stateful graph runtime: durable checkpoints, HITL interrupts, branching | LangGraph | MIT (API-verified) | **#1** |
| **G-23** | 1 | Parallel role fan-out with merge (message pool) | MetaGPT | MIT (API-verified) | #6 |
| **G-24** | 2 | Plan-then-act ledger (sequential-thinking scaffold) | MCP sequentialthinking · Cline Plan/Act | MIT→Apache-2.0 (raw-read) | #5 |
| **G-25** | 2 | Reflexion self-critique → revise → retry loop | Reflexion (NeurIPS 2023) | MIT (API-verified) | #4 |
| **G-26** | 2 | Snapshot/rollback backtracking | Cline checkpoints | Apache-2.0 (API-verified) | #9 |
| **G-27** | 3 | Algorithm template library + spec→algorithm synthesis + benchmark harness | TheAlgorithms/Python | MIT (API-verified) | #8 |
| **G-28** | 3 | Property-based test generation | fast-check | MIT (API-verified) | #7 |
| **G-29** | 3 | Complexity & code-metrics gate | eslint complexity rule | MIT (API-verified) | #11 |
| **G-30** | 4 | Dependency graph + architecture rules | dependency-cruiser | MIT (API-verified) | #12 |
| **G-31** | 4 | Module graph image auto-generation | madge | MIT (API-verified) | #13 |
| **G-32** | 4 | ADR automation | phodal/adr (+ npryce pattern, flagged) | MIT (API-verified) | #10 |
| **G-33** | 4 | AST codebase map + refactor planning | ts-morph | MIT (API-verified) | #14 |
| **G-34** | 5 | Design-token pipeline upgrade (Style-Dictionary compatible) | Style Dictionary | Apache-2.0 (API-verified) | #15 |
| **G-35** | 5 | Component-generation catalog + HTML→React | shadcn pattern · CVA · html-to-react | MIT/Apache-2.0 (API-verified) | #16 |
| **G-36** | 5 | Open canvas (Figma-like) editor | fabric.js (Penpot flagged MPL-2.0) | MIT (API-verified) | #20 |
| **G-37** | 6 | LLM-as-designer SVG logo/icon/badge generation on the SAME DeepSeek key | Iconify · heroicons · SVG-ORA-Studio · OmniSVG | MIT (API-verified) | **#3** |
| **G-38** | 6 | Palette→UI ramp mapping | open-color · chroma.js · culori | MIT/BSD (verified) | #17 |
| **G-39** | 7 | Agent memory consolidation (write-back + ranking) | mem0 / Letta patterns | Apache-2.0 (07 §2.6) | #4 |
| **G-40** | 7 | Agent observability, evals & replay (+ MCP server, git export) | Langfuse core · promptfoo · OpenHands · MCP TS SDK · isomorphic-git | MIT/Apache-2.0 (verified) | **#2** |

Areas: 1 = delegation/orchestration · 2 = sequential thinking · 3 = algorithm tools · 4 = architecture tools · 5 = open-design UI · 6 = vector/logo on DeepSeek key · 7 = other steals. "Recovered §1" rows are compact reconstructions (see recovery note); ranks for G-21…G-40 are assigned in §3.

---

## 1. G-01…G-20 — recovered register seed (compact, derived from siblings)

> Original prose lost to disk corruption (see recovery note). Each row is derived from the named sibling section, which carries the full verified detail. Do not treat these rows as the lost text — treat the sibling section as authoritative.

| ID | Derived from | Gap in one line |
|----|--------------|-----------------|
| G-01 | `07_opensource_steal_catalog.md` §2.1 | Packet & artifacts render as raw `<pre>` (`console.tsx:2240`); no markdown. |
| G-02 | 07 §2.4 | No syntax highlighting for agent code artifacts. |
| G-03 | 07 §2.3 · 08 E-17 | Vault/artifact search is token-overlap only (`vault.ts:564-580`). |
| G-04 | 07 §2.4 | No unified diff view for P6 variants / HITL patches. |
| G-05 | 07 §2.10 | No PDF export of the paper trail (`io.ts:25/93/118`). |
| G-06 | 07 §2.10 | No DOCX export (same pipeline). |
| G-07 | 07 §2.2 | No diagram rendering of spec/phase graphs. |
| G-08 | 07 §2.7 | Spec graph is a flat ordered list; no node-edge view. |
| G-09 | 07 §2.5 | Bounded run output is request/response; no live terminal. |
| G-10 | 02 §C E1 · 08 E-07/E-08 | Oracle is prose, not executable; no fail-to-pass loop (`verify.server.ts:21-94`, `algorithms.ts:449-467`). |
| G-11 | 02 E2 · 08 E-16/E-22 | Report schema accepts no test evidence (`report-intake.ts:20-26`, M-05). |
| G-12 | 02 E3 · 08 E-13/E-24 | Citations decay before the code phase; false `cited` promotion (M-01/M-06/M-07). |
| G-13 | 02 E4 · 08 E-19/E-20 | Gates recorded but never consulted; autopilot approves against `gate.passed:false` (M-09). |
| G-14 | 02 E4 · 08 E-18 | No memory write-back from agent outcomes (M-08) — **superseded by G-39 this pass**. |
| G-15 | 08 E-02/E-12 | Headless path lacks DoD gate parity; duplicated live layer (M-10). |
| G-16 | 08 E-23/E-24 | Honesty is comment-enforced; no lint. |
| G-17 | 08 E-25 | CLI lacks machine contract (exit codes, stdin, doctor). |
| G-18 | 07 §2.8 | No in-browser compile/preview surface. |
| G-19 | 07 §2.5/§2.9 | No streaming/token-level output plumbing (`engine.ts` phase calls are non-streaming). |
| G-20 | 08 E-27 | No shipped-artifact pass (real build + DEPLOY.md). |

---

## 2. New register entries — G-21…G-40 (full format, all claims verified 2026-09-06)

### G-21 — Hierarchical crew orchestration: manager → workers, per-agent budgets, handoffs — area 1 · M · med · rank #2

- **Competitor / source:** **CrewAI hierarchical process** — https://docs.crewai.com/concepts/processes (fetched 2026-09-06): the hierarchical `Process` "emulates a corporate hierarchy… a manager agent oversees task execution, including planning, delegation, and validation. Tasks are not pre-assigned; the manager allocates tasks to agents based on their capabilities, reviews outputs, and assesses task completion" (a `manager_llm` or custom `manager_agent` is required). Repo: https://github.com/crewAIInc/crewAI — **MIT** (GitHub API 2026-09-06), 58.1k★, pushed 2026-09-04. Handoff-pattern complement: **OpenAI Swarm** — https://github.com/openai/swarm — **MIT** (raw LICENSE read: "MIT License, Copyright (c) 2024 OpenAI"), 21.9k★ — lightweight agent **handoff** primitives (transfer control + context to another agent mid-conversation).
- **What they do / why it beats us:** an LLM manager decomposes a phase goal into tasks and *delegates* them to specialized workers, reviews each output, and decides completion — i.e. dynamic task allocation instead of a fixed role pipeline. Swarm adds explicit inter-agent handoff calls.
- **RapidTool gap (file:line):** the crew is a **flat, fixed role table** — `crew.server.ts:51-76` (`JSON_ROLES`, `DEFAULT_MESSAGE_TYPE`, `MANDATE`) with "One DeepSeek call per turn over a deterministic phase → role table (never an LLM speaker selector)" (`crew.server.ts:9-10`), and it is deliberately advisory: "it never approves, rejects, advances, or deploys" (`crew.server.ts:15-16`). There is **no manager agent, no dynamic task allocation, no per-agent budget, and no handoff verb** beyond the message envelope (`CrewMessageType` includes `handoff` but nothing consumes it as a transfer).
- **Borrow:** **pattern-steal (zero-dep recode)** — CrewAI is Python; vendoring is not possible, and a new orchestration runtime is exactly the opposite of RapidTool's deterministic core. Steal: (a) manager task-list JSON schema (id, goal, owner, budget, accept-criteria), (b) delegation-as-planned-messages (manager emits task rows; workers claim by role), (c) Swarm's handoff = a typed `CrewMessage { type:"handoff", to, context }` that *changes the next dispatcher* instead of being a transcript entry.
- **Integration spec (.ts):** `src/lib/crew.ts`: add `CrewProcess = "sequential" | "hierarchical"` and `CrewTask = { id; goal; owner: CrewRole; tokenBudget; accept }`. `src/lib/crew.server.ts`: add `dispatchManagerTurn()` (planner role prompt upgraded to emit a JSON task list validated by the existing `JSON_SCHEMA` envelope machinery at `crew.server.ts:78+`) and `delegateTurn(task)`; per-task `tokenBudget` enforced by the existing cost/max-steps stops (`CrewStopReason = "cost-limit"`). Manager approval is still **advisory** — the engine gates stay the only approver (honesty contract `crew.server.ts:18-21`).
- **UI wiring:** crew tab already exists (`console.tsx:91` RunTab `"crew"`, `CrewMsgView` `console.tsx:94-111`); render hierarchical runs as an org-tree (manager node → task rows → worker messages) instead of the flat transcript; per-task budget meter.
- **Headless/agent wiring:** expose `runCrew` through the existing `headless.ts` verb surface (`headless.ts:441 runUntilGate` pattern); `cli crew --process hierarchical`; the external-agent handoff stays the packet (unchanged).
- **Acceptance criteria:** (1) hierarchical run produces a machine-readable task-list artifact + one report per task; (2) every dispatch honors `tokenBudget`; (3) zero-key run degrades to the current sequential transcript with `{ok:false}` (no fabrication); (4) manager cannot advance phases (gate authority unchanged).
- **Effort / risk:** M (prompt + schema + UI tree) · med (manager LLM quality varies; budgets mitigate cost blowups).
- **Rank (value ÷ effort):** #2 — turns the flat crew into the orchestrator the 14-roadmap (see `14_agi_aggregation.md` L3) needs.

### G-22 — Stateful graph runtime: durable checkpoints, HITL interrupts, conditional branching — area 1 · L · med · rank #1

- **Competitor / source:** **LangGraph** — https://github.com/langchain-ai/langgraph — **MIT** (GitHub API 2026-09-06), 41.1k★, pushed 2026-09-06. Docs (fetched): "low-level orchestration framework and runtime for building, managing, and deploying long-running, stateful agents… durable execution, streaming, human-in-the-loop, and more… mix deterministic, hand-coded steps with LLM-driven agentic steps in the same graph" (https://docs.langchain.com/oss/python/langgraph/overview — fetched 2026-09-06; also names persistence/checkpointing and interrupt-based HITL).
- **What they do / why it beats us:** the phase machine is a *graph with typed state*, checkpointed after every step, resumable after crash, interruptible mid-node for human input, with conditional edges (the *next* node is a function of state, not a fixed index).
- **RapidTool gap (file:line):** the phase machine is a **fixed 13-phase linear array** — `phases.ts:3-109` (`PHASES: PhaseDef[]`, P0–P12) — advanced by a **scalar** `currentPhase` that repair clamps linearly: `currentPhase = Math.max(0, Math.min(12, highest + 1))` (`engine.ts:1226, 1246`; scalar validation `engine.ts:1211-1259`). No conditional edges, no branching, no checkpointing beyond whole-file save (`headless.ts:50-63`), and HITL phases are a fixed stock list (`phases.ts:133-134`).
- **Borrow:** **pattern-steal (zero-dep recode preferred)**. LangGraph is Python; porting it wholesale would replace the deterministic engine RapidTool's entire value rests on (02 §A1–A9). Steal the *semantics*: state machine with checkpoint + conditional `next(state)` + interrupt semantics, implemented over the existing `Project` JSON (which is already a full serializable state — the checkpoint exists, only the resume/edge logic is missing).
- **Integration spec (.ts):** new `src/lib/plan.ts`: `PlanNode = { id: PhaseId; run(state): State; next(state): PhaseId | "hitl" | "end" }`; `snapshot(state): string` (content-hash the project JSON with the existing FNV-1a, `algorithms.ts`); `resume(snapshot)`. `phases.ts` gains an optional `edges` override map (default = linear, preserving all invariants B.3.3). `engine.ts` `advance` (`engine.ts:963`) consults `plan.next` instead of `phase + 1`. Snapshots land under a `snapshots/` dir next to the project file.
- **UI wiring:** PhaseRail (`console.tsx` phase rail) renders branch arrows from `plan.next`; "Resume from snapshot" dialog in the Builds list; HITL interrupts already exist as phase status `awaiting_hitl` (runtime mirror `engine.ts:40`).
- **Headless/agent wiring:** `headless.ts` `runUntilGate` contract unchanged; add `cli resume <snapshot-hash>` and `cli plan` (prints the compiled graph as mermaid — pairs with G-07).
- **Acceptance criteria:** (1) a conditional edge (e.g. skip P10 when brief declares offline-only) runs without touching the fixed array; (2) kill mid-P6, resume → same state hash + same next phase (deterministic replay); (3) all 27 existing engine/headless tests pass unmodified (default edges = current behavior).
- **Effort / risk:** L (touches the core invariant) · med — mitigated by default-linear edges + the existing repair clamp as fallback.
- **Rank (value ÷ effort):** #1 — this is the single architectural unlock for every other delegation/planning item (G-21, G-23, G-24, G-26) and for the 14-roadmap's L2/L3.

### G-23 — Parallel role fan-out with merge (message pool) — area 1 · M · low-med · rank #6

- **Competitor / source:** **MetaGPT** — https://github.com/FoundationAgents/MetaGPT — **MIT** (GitHub API 2026-09-06), 70.2k★, pushed 2026-01-21; README (fetched): "Assign different roles to GPTs to form a collaborative entity for complex tasks" — its message pool lets multiple roles work concurrently and publish into one shared transcript.
- **What they do / why it beats us:** parallel role execution (one DeepSeek call per role fired concurrently, results merged) instead of sequential turns — latency ≈ longest branch, not sum of branches.
- **RapidTool gap (file:line):** "One DeepSeek call per turn" (`crew.server.ts:9-10`); roles are dispatched in a fixed order and each turn's output becomes the next turn's context — inherently serial.
- **Borrow:** **pattern-steal (zero-dep recode)** — no new dependency; `Promise.all` over the existing `dispatchRole()`.
- **Integration spec (.ts):** `crew.server.ts`: add `runParallelTurn(roles: CrewRole[], budget: number)` — build each role's scoped context from the same prior transcript (existing builder), dispatch via `Promise.all`, then a **synthesis turn** (reviewer role, existing `MANDATE` reviewer) merges branch messages into ordered `CrewMessage[]`; per-branch budget = `budget / roles.length` reusing the existing cost-limit stop.
- **UI wiring:** crew tab (`console.tsx:91`) renders branch lanes (parallel columns) with a merge node; the existing `CrewRunView` (`console.tsx:104-111`) gains `lanes`.
- **Headless/agent wiring:** `cli crew --parallel roles=architect,reviewer,tester` via the `headless.ts` verb surface.
- **Acceptance criteria:** (1) wall-clock of a 3-role parallel turn < 1.5× longest branch; (2) synthesis message only cites real branch message ids (no fabricated cross-agent claims — honesty contract); (3) zero-key → honest `{ok:false}` per branch.
- **Effort / risk:** M · low-med (context duplication between branches can drift; synthesis prompt is the risk point).
- **Rank (value ÷ effort):** #6 — meaningful speedup, contained blast radius.

### G-24 — Plan-then-act ledger (sequential-thinking scaffold) — area 2 · S–M · low · rank #5

- **Competitor / source:** **Sequential Thinking MCP server** — https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking (README fetched 2026-09-06): tool state `{thought, nextThoughtNeeded, thoughtNumber, totalThoughts, branchFromThought…}` enabling "break down complex problems… revise and refine… branch into alternative paths… generate and verify solution hypotheses". Repo license: **MIT → Apache-2.0 transition** (raw LICENSE read 2026-09-06: "undergoing a licensing transition from the MIT License to the Apache License, Version 2.0" — both allowed). Also **Cline Plan/Act mode** — https://github.com/cline/cline — **Apache-2.0** (API), 67.5k★, pushed 2026-09-05: explore-and-plan before executing, with human alignment between the modes.
- **What they do / why it beats us:** an explicit, revisable **plan object** that execution is measured against — not a fixed phase list and not chat prose.
- **RapidTool gap (file:line):** the planner role exists (`crew.server.ts:54-65, 63-65 MANDATE.planner`) but its plan is a **transcript message**, never machine state; the phase graph is fixed (`phases.ts:3-109`); nothing consumes or revises a plan artifact during execution.
- **Borrow:** **pattern-steal (zero-dep recode)** — the MCP server is a prompt+state toy; the valuable part is the ledger schema.
- **Integration spec (.ts):** new `src/lib/think.ts`: `ThinkingLedger = { thoughts: { n; text; branchOf?; status: "draft"|"used"|"revised"|"discarded" }[]; budget; version }`; deterministic floor = the spec-graph order (`algorithms.ts:305-384 topo()/planSpecGraph`) as pre-seeded rows; LLM option = planner emits JSON plan rows (validated by the existing JSON envelope machinery) with `thinking: enabled` already default on DeepSeek V4 (`deepseek.server.ts:37`).
- **UI wiring:** new "Plan" tab (RunTab union at `console.tsx:91`) rendering the ledger as a numbered, branchable list with status chips; deviations during execution append `status:"revised"` rows.
- **Headless/agent wiring:** `cli think --phase 6` prints/patches the ledger; the ledger is emitted into the packet (packet compile path `packet.ts`) so external agents get a real plan instead of prose.
- **Acceptance criteria:** (1) P1 run produces a JSON plan artifact; (2) execution deviations are logged as revised rows; (3) zero-key run produces the deterministic topo() plan; (4) revision count surfaced in packet System JSON (E-11 seam, 08).
- **Effort / risk:** S–M · low.
- **Rank (value ÷ effort):** #5.

### G-25 — Reflexion self-critique → revise → retry loop — area 2 · M · med · rank #4

- **Competitor / source:** **Reflexion** — https://github.com/noahshinn/reflexion — **MIT** (GitHub API 2026-09-06), 3.3k★, pushed 2025-01-14; "Language Agents with Verbal Reinforcement Learning" (NeurIPS 2023): on failure, the agent writes a structured **self-critique** (what went wrong, hypothesis, fix) that is fed back into the next attempt — a verbal-RL loop over *episodic memory*.
- **What they do / why it beats us:** failures become *persisted lessons that shape the next attempt*, instead of raw retries.
- **RapidTool gap (file:line):** `verifyAndFixServer` (`verify.server.ts:152-219`) does iterate oracle→fix→retry up to `maxIterations`, but the critique is **not persisted** into memory or the packet; P5 "Validation, HITL & Self-Learning" (`phases.ts:47-51`) "has no loop behind it" (02 §B6); memory rows originate only in engine code (M-08: `report-intake.ts:142-147` writes no memory).
- **Borrow:** **pattern-steal (zero-dep recode)** — the repo is research code (Python); the pattern is 40 lines in `verify.server.ts`.
- **Integration spec (.ts):** `verify.server.ts`: on a failed `runCases`, add a `critique()` step that emits `{ symptom; hypothesis; fix }` (LLM via `llm.ts complete()` when configured, deterministic template otherwise) into a new `Artifact` kind `"critique"`; thread the critique text into the next `generateCases` prompt (existing seam at `verify.server.ts:122-135`). `report-intake.ts:142-147` (`applyReport`) appends an episodic `MemoryEntry` with the critique (closes M-08; see G-39).
- **UI wiring:** artifacts tab renders critique artifacts (ArtifactPane at `console.tsx:2011+`); packet System JSON gains `critique_count`.
- **Headless/agent wiring:** `cli verify --apply` (08 E-06 seam) persists critiques; external agents read them from the packet.
- **Acceptance criteria:** (1) a failing oracle case produces a critique artifact; (2) attempt N+1's prompt demonstrably contains attempt N's critique text; (3) critique rows flow into FusionRank on next compile (`algorithms.ts:214-261`).
- **Effort / risk:** M · med (critique quality = model quality; deterministic fallback keeps the floor).
- **Rank (value ÷ effort):** #4 — this is the "improvement loop" half of the 14-roadmap's L5.

### G-26 — Snapshot/rollback backtracking — area 2 · M · med · rank #9

- **Competitor / source:** **Cline checkpoints** — https://github.com/cline/cline — **Apache-2.0** (API-verified), 67.5k★, pushed 2026-09-05 (repo + https://cline.bot/): snapshot the workspace before/after actions and roll back a bad trajectory (checkpoint docs page moved since; repo README fetched 2026-09-06 confirms the product).
- **What they do / why it beats us:** cheap branch-and-rollback lets an agent *explore* rejected paths without corrupting the accepted state.
- **RapidTool gap (file:line):** rejection → retry is the only "backtrack" (`headless.ts:518-523 retry`); repair only advances (`engine.ts:1226, 1246` clamps); the ledger is append-only (`engine.ts:969-1016`); no snapshot history exists (project JSON save overwrites, `headless.ts:58-63`).
- **Borrow:** **zero-dep recode** — snapshots are just content-hashed project JSON (G-22's `snapshot()`); reuse pglite/kysely (installed) only if snapshot history should be queryable.
- **Integration spec (.ts):** `src/lib/snapshots.ts`: `takeSnapshot(project)` before each phase run (write `snapshots/<fnv1a-hash>.json` via the existing io export `io.ts`); `rollback(hash)`; extend `headless.ts retry` with `--from-snapshot`; HITL rejection gains an optional "fork alternative" that creates a variant project file referencing the parent (ledger link row).
- **UI wiring:** rejection panel (`HitlDock`, `console.tsx:705-758` per audit 02) gains "Try alternative approach (fork)"; Builds list shows variant badges.
- **Headless/agent wiring:** `cli rollback <hash>`, `cli fork`.
- **Acceptance criteria:** (1) rollback restores byte-identical JSON; (2) forks never mutate the parent file (determinism invariant B.3.3); (3) rollback events append ledger rows with the snapshot hash as evidence.
- **Effort / risk:** M · med (file identity/fork bookkeeping is the trap; keep hashes in ledger).
- **Rank (value ÷ effort):** #9.

### G-27 — Algorithm template library + spec→algorithm synthesis + benchmark harness — area 3 · M · low · rank #8

- **Competitor / source:** **TheAlgorithms/Python** — https://github.com/TheAlgorithms/Python — **MIT** (GitHub API 2026-09-06), 224.3k★, pushed 2026-09-06: the canonical open corpus of implemented classic algorithms, each with complexity notes — the reference set an "algorithm-aware" generator is expected to draw on.
- **What they do / why it beats us:** turn a brief that mentions a computational job ("schedule jobs by deadline", "rank by match") into an *algorithm module with a stated complexity and a runnable benchmark*, instead of a CRUD scaffold.
- **RapidTool gap (file:line):** `scaffold.ts` emits only CRUD/game/console templates (`scaffold.ts:458-590`, `projectKindOf` `scaffold.ts:229`, `scaffoldProject` `scaffold.ts:971`); `buildTestOracle` produces static job-shaped cases (`algorithms.ts:449-467`); nothing synthesizes or tags algorithms, and nothing generates timing harnesses.
- **Borrow:** **vendor curated subset (MIT)** — TheAlgorithms is Python; port ~20 canonical TypeScript implementations (sorting, greedy, DP, graph, hashing) with Big-O docstring tags into one new file (MIT allows redistribution with notice).
- **Integration spec (.ts):** new `src/lib/algolib.ts` (~600 lines vendored/ported, MIT notice header): `ALGO_INDEX: { name; class: "sort"|"greedy"|"dp"|"graph"|"hash"; bigO; code }[]`. `scaffold.ts` gains a `"algorithm"` project kind whose emitter wraps the matched template with a docstring complexity claim and a `benchmark()` function (generated timing harness, zero-dep `performance.now()`). `crew.server.ts` coder mandate (`crew.server.ts:70-71`) gains: "when a job maps to an ALGO_INDEX class, reuse the library template and state its complexity."
- **UI wiring:** scaffold preview unchanged; artifacts tab gains the generated module with complexity caption (G-02 highlight applies).
- **Headless/agent wiring:** `cli scaffold --kind algorithm` (extends `headless.ts` create/run verbs).
- **Acceptance criteria:** (1) brief "schedule jobs by deadline" → scaffold includes greedy module + Big-O claim + benchmark harness; (2) oracle case (existing `buildTestOracle`) executes against it; (3) no Python anywhere — TS-only output.
- **Effort / risk:** M · low (pure content + one emitter branch).
- **Rank (value ÷ effort):** #8.

### G-28 — Property-based test generation — area 3 · M · low-med · rank #7

- **Competitor / source:** **fast-check** — https://github.com/dubzzz/fast-check — **MIT** (GitHub API 2026-09-06), 5.1k★, pushed 2026-09-05: QuickCheck-style property-based testing in TypeScript — generators, shrinking, deterministic replay via seed.
- **What they do / why it beats us:** verification by *invariant over random inputs* (with automatic shrink to a minimal counterexample) instead of a handful of hand-written example cases.
- **RapidTool gap (file:line):** `VerifyCase` is a single boolean **expression** (`verify.server.ts:21-94` — e.g. `add(2,3) === 5`; harness at `verify.server.ts:68-91` wraps exports via `new Function`); no generators, no shrinking, no seed.
- **Borrow:** **real dependency (MIT, ~zero transitive risk)** — `fast-check` in `verify.server.ts` only (server-side), keeping the client bundle untouched.
- **Integration spec (.ts):** `verify.server.ts`: add `generatePropertyCases(source)` — parse the exported function signatures from the harness context, emit `fc.property(fc.integer(), …)` cases for numeric/tuple-shaped exports; extend `runCases` (`verify.server.ts:94+`) with a property runner that executes `fc.check` with a fixed seed and renders the **shrunk counterexample** into `evidence`. Deterministic seed → same verdict, preserving the FNV-1a evidence-hash philosophy (`dod.ts` gates).
- **UI wiring:** oracle tab (RunTab `"oracle"`, `console.tsx:91`) shows property results with the minimal failing input.
- **Headless/agent wiring:** `cli verify --properties` (extends the `verifyAndFixServer` seam `verify.server.ts:152-219`).
- **Acceptance criteria:** (1) "sort output is a permutation of input and nondecreasing" is expressible and runs; (2) failure evidence includes the shrunk counterexample; (3) same seed replays to the same verdict; (4) zero-key fallback still runs deterministic expression cases.
- **Effort / risk:** M · low-med (generator selection is heuristic; cap attempts/size for bounded runs).
- **Rank (value ÷ effort):** #7.

### G-29 — Complexity & code-metrics gate — area 3 · S · low · rank #11

- **Competitor / source:** **eslint `complexity` rule** — https://eslint.org/docs/latest/rules/complexity (eslint/eslint — **MIT**, GitHub API 2026-09-06, 27.5k★, pushed 2026-09-05): cyclomatic-complexity thresholds enforced in CI. (Note: the standalone `simonrenoult/codecomplex` repo returns 404 as of 2026-09-06 — excluded.)
- **What they do / why it beats us:** a machine number on generated-code quality that can gate a phase — "complex" is no longer a reviewer's opinion.
- **RapidTool gap (file:line):** nothing measures agent/scaffold code — `node-runner.server.ts` executes it, the DoD gates (`dod.ts`) never consult code metrics, and the feasibility scorecard is lattice-based, not code-based (`algorithms.ts:578-600`).
- **Borrow:** **zero-dep recode (~80 lines)** — `src/lib/metrics.ts` implementing cyclomatic complexity via a token-level counter (function bodies: count `if/for/while/case/&&/||/?` decision points + 1) plus LOC/comment ratio. (eslint programmatic API is the heavyweight alternative — MIT but a large dep for one number.)
- **Integration spec (.ts):** `metrics.ts` exports `scoreModule(source): { loc; complexity; maxComplexity; exports }`; wire into the P6 review gate: after scaffold (`scaffold.ts:971`) or agent-code ingest, run `scoreModule` per generated file; violations (`complexity > 10`) append gate evidence with file:line; add a `code_metrics` block to the packet System JSON (E-11 seam).
- **UI wiring:** gate verdict drill-down (08 E-21 seam) lists per-file complexity; artifact code pane captions the metric.
- **Headless/agent wiring:** `cli metrics <dir>` — deterministic, keyless.
- **Acceptance criteria:** (1) a 15-decision function is flagged with exact line refs; (2) gate row `p6-metrics` exists in DoD registry; (3) zero LLM calls involved.
- **Effort / risk:** S · low.
- **Rank (value ÷ effort):** #11.

### G-30 — Dependency graph + architecture rules on REAL generated code — area 4 · M · low · rank #12

- **Competitor / source:** **dependency-cruiser** — https://github.com/sverweij/dependency-cruiser — **MIT** (GitHub API 2026-09-06), 7.1k★, pushed 2026-09-05: "Validate and visualize dependencies. Your rules." — rule-based architecture checks (no-circular, no-orphans, layer boundaries) plus graph output.
- **What they do / why it beats us:** architecture is enforced on the *actual* code the pipeline produced, not just planned on the spec graph.
- **RapidTool gap (file:line):** `planSpecGraph` builds the *planned* module graph (`algorithms.ts:337-384`) but nothing graphs or checks the **actual** scaffold/agent output (`scaffold.ts:971`); the architect mandate says "Lock schema, routes and ADRs" (`crew.server.ts:68-69`) yet no machine enforces it on files.
- **Borrow:** **real dependency (MIT)** — server-side ESM import of dependency-cruiser's `cruise()` API in a new `src/lib/archcheck.ts`, called only after P6 output exists; bundle impact zero (server-only).
- **Integration spec (.ts):** `archcheck.ts`: `runArchCheck(dir, rulesFile)` with a RapidTool ruleset (no-circular, no-orphans, `types.ts` may not import UI); output = violations list + DOT/SVG (mermaid cross-ref G-07, xyflow G-08); violations become gate evidence on P6.
- **UI wiring:** diagram tab (RunTab `"diagram"`, `console.tsx:91`) renders the dependency SVG; gate drill-down lists violations.
- **Headless/agent wiring:** `cli archcheck <dir>` — keyless and deterministic.
- **Acceptance criteria:** (1) a circular import in scaffold output fails the P6 gate with named cycle; (2) SVG artifact attached and viewable; (3) run completes with zero LLM calls.
- **Effort / risk:** M · low.
- **Rank (value ÷ effort):** #12.

### G-31 — Module-graph image auto-generation — area 4 · S–M · low · rank #13

- **Competitor / source:** **madge** — https://github.com/pahen/madge — **MIT** (GitHub API 2026-09-06), 10.2k★, pushed 2026-01-21: module dependency graph → image (SVG/PNG) with zero config.
- **What they do / why it beats us:** a *picture* of the codebase for reviewers and agents, generated deterministically.
- **RapidTool gap (file:line):** `diagram.ts` (deterministic diagram generator) exists but takes no real-code input; the spec tab's graph is a flat list (per 07 §2.7: `console.tsx` spec `<ol>`).
- **Borrow:** **real dependency (MIT)** — madge complements G-30 (madge = images, dependency-cruiser = rules); both in `archcheck.ts` so the two adds share one review.
- **Integration spec (.ts):** `archcheck.ts` gains `renderModuleGraph(dir): Promise<{svg}>` via madge; artifact id `p6-dependency-graph`; deterministic layout pinned by version.
- **UI wiring:** diagram tab renders the SVG (same surface as G-30).
- **Headless/agent wiring:** `cli graph <dir>`.
- **Acceptance criteria:** (1) same input → byte-identical SVG (determinism); (2) zero LLM calls.
- **Effort / risk:** S–M · low.
- **Rank (value ÷ effort):** #13 (do together with G-30).

### G-32 — ADR automation (machine-minted decision records) — area 4 · S · low · rank #10

- **Competitor / source:** **phodal/adr** — https://github.com/phodal/adr — **MIT** (GitHub API 2026-09-06), 271★, pushed 2026-07-13 (Node ADR generator, Windows/Linux/macOS). Pattern origin: **npryce/adr-tools** — https://github.com/npryce/adr-tools — ⚠️ license "Other"/NOASSERTION via API, no LICENSE file on main/master (2026-09-06); the project README historically declares **CC-BY-SA-4.0 — NOT in the allowed set: pattern-only, do not copy code.**
- **What they do / why it beats us:** every architectural decision becomes a numbered, status-tracked record file — the ADR trail RapidTool's philosophy already promises ("Lock schema, routes and ADRs", `crew.server.ts:68-69`) but never emits.
- **RapidTool gap (file:line):** decisions live only as packet prose and ledger rows (`engine.ts:969-1016`); no ADR file is ever produced, exported, or versioned.
- **Borrow:** **pattern-steal (zero-dep recode, ~60 lines)** — the ADR format (context/decision/consequences/status) is unencumbered; phodal/adr (MIT) is the code fallback if richer tooling is wanted.
- **Integration spec (.ts):** new `src/lib/adr.ts`: `mintAdr(project, event): string` — emits `adr/NNNN-<slug>.md` from (a) HITL approvals/rejections (`headless.ts:498-518 approve/reject`, rejection note = consequences), (b) architect JSON artifacts when present, (c) gate verdicts (evidence hashes from `dod.ts`); exported via the project download path (`io.ts` exportProjectJson pattern).
- **UI wiring:** new "ADR" tab or artifact list filter; packet links ADR ids in the decisions section.
- **Headless/agent wiring:** `cli adr list|show|new` — deterministic, keyless.
- **Acceptance criteria:** (1) every HITL approve/reject mints exactly one ADR row; (2) ADR files export with the project; (3) ids are monotonic and deduplicated by event hash.
- **Effort / risk:** S · low.
- **Rank (value ÷ effort):** #10.

### G-33 — AST codebase map + refactor planning — area 4 · M · med · rank #14

- **Competitor / source:** **ts-morph** — https://github.com/dsherret/ts-morph — **MIT** (GitHub API 2026-09-06), 6.2k★, pushed 2026-09-02: TypeScript Compiler API wrapper for static analysis and programmatic refactors.
- **What they do / why it beats us:** a real symbol-level map of generated code (exports/imports/references), enabling module-boundary analysis and refactor proposals — beyond planned-graph and beyond regex.
- **RapidTool gap (file:line):** no AST tooling anywhere; the only "map" is the planned spec graph (`algorithms.ts:337-384`); nothing detects oversized modules, dead exports, or boundary violations in actual output.
- **Borrow:** **real dependency (MIT, server-only)** — heavyweight (~depends on typescript), so isolate it in `src/lib/codemap.ts` and call only post-P6.
- **Integration spec (.ts):** `codemap.ts`: `buildCodeMap(dir): CodeMap` — per-file export/import/symbol inventory + sizes; artifacts: `p6-codemap.json` (machine-readable for agents) and boundary analysis (files > 400 LOC, > 7 exports, orphan exports) feeding the G-29 metrics gate and G-30 graph; optional `proposeRefactors(map)` (deterministic rules: extract shared literals, hoist duplicates) surfaced as review suggestions — never auto-applied.
- **UI wiring:** spec tab gains an "actual vs planned" toggle (planned = `project.specGraph`, actual = codemap); review gate lists boundary findings.
- **Headless/agent wiring:** `cli codemap <dir>` — keyless.
- **Acceptance criteria:** (1) codemap JSON matches a hand-verified 3-file sample exactly; (2) boundary violations appear as gate evidence; (3) zero LLM calls.
- **Effort / risk:** M · med (dep weight + AST edge cases).
- **Rank (value ÷ effort):** #14.

### G-34 — Design-token pipeline upgrade (Style-Dictionary-compatible export) — area 5 · M · low · rank #15

- **Competitor / source:** **Style Dictionary** — https://github.com/amzn/style-dictionary — **Apache-2.0** (GitHub API 2026-09-06), 4.8k★, pushed 2026-09-04: "A build system for creating cross-platform styles" — one token JSON → CSS variables, Android/iOS, Figma-token format.
- **What they do / why it beats us:** generated apps ship a *real token layer* (CSS vars + platform formats) instead of inline values; tokens round-trip to design tools.
- **RapidTool gap (file:line):** RapidTool already has a deterministic token layer — `designTokens()`/`designHtml()` (`design.ts:15-16`), fixed `palette.name` "<family> · <cast>" pairs (`design.ts:19-22`), 20 fixed `TOKEN_KEYS` (`design.ts:20-22, 57-63`) — but: the key set is fixed, there is **no LLM-informed branding from the brief**, and no Style-Dictionary-shaped export for the scaffolded app to consume.
- **Borrow:** **pattern-steal first, optional dep second** — the SD JSON format is trivial to emit by hand (~30 lines in `design.ts`); import `style-dictionary` (Apache-2.0) only if cross-platform transforms (iOS/Android) become a product goal.
- **Integration spec (.ts):** `design.ts`: add `designTokensFromBrief(brief, project)` — optional LLM pass (`llm.ts complete()`, `json:true`) returning `{ base, accent, neutral, family }` hexes, validated against the existing 20-key contract (CI-guarded by `design.test.ts`); add `exportTokenJson(tokens)` (SD-format) written into scaffold output (`scaffold.ts:971` emitter) as `tokens.json` + generated `tokens.css`.
- **UI wiring:** design tab (RunTab `"design"`) shows the brief-derived palette swatches with a "regenerate (deterministic)" fallback button.
- **Headless/agent wiring:** `cli design --brief "<brief>"` — zero-key falls back to `designTokens()` (honesty floor).
- **Acceptance criteria:** (1) LLM palette validates against `design.test.ts` constraints; (2) scaffolded `tokens.css` consumed by the generated Console; (3) zero-key run produces the deterministic palette unchanged.
- **Effort / risk:** M · low.
- **Rank (value ÷ effort):** #15.

### G-35 — Component-generation catalog + HTML→React conversion — area 5 · M–L · med · rank #16

- **Competitor / source:** **shadcn/ui** — https://github.com/shadcn-ui/ui — **MIT** (123.1k★, per 07 §2.11 — pattern-steal: RapidTool already owns the Radix base); **CVA** — https://github.com/joe-bell/cva — **Apache-2.0** (GitHub API 2026-09-06), 6.9k★, pushed 2026-09-06 (variant-class composition); **html-to-react** — https://github.com/aknuds1/html-to-react — **MIT** (API), 798★, pushed 2026-08-31 (raw HTML → React element tree).
- **What they do / why it beats us:** generated UIs are built from a *variant-typed component catalog* (buttons/cards/forms with design-token classes), and agent/LLM HTML drafts convert losslessly to React for the design tab.
- **RapidTool gap (file:line):** the scaffolded Console is a **hand-rolled JSX string** (`scaffold.ts:566` `export function Console()` emitter); there is no variant system and no HTML→React intake path.
- **Borrow:** **real deps (MIT/Apache-2.0, tiny)** — `cva` (0 deps) and `html-to-react` for the intake; shadcn is pattern-only (already decided in 07 §2.11).
- **Integration spec (.ts):** new `src/lib/components-catalog.ts`: 12–15 recipes (`button/card/field/table/badge`) emitting TSX via cva-style variant records, consumed by the `scaffold.ts` Console emitter (`scaffold.ts:566`); `src/lib/html-intake.ts` wraps html-to-react behind a DOMPurify-style allowlist (G-01 companion) to convert agent HTML drafts into React elements for preview.
- **UI wiring:** design tab gains "Component catalog" (variant gallery) and "Import HTML draft" (paste → rendered tree).
- **Headless/agent wiring:** `cli scaffold` gains `--components` selection; agent HTML intake via report ingestion (`report-intake.ts`).
- **Acceptance criteria:** (1) scaffolded Button ships 3 variants with focus-visible + token classes; (2) an HTML draft with a table/form renders as a React tree with no raw `dangerouslySetInnerHTML` outside the sanitized path; (3) catalog is TypeScript-typed (no stringly JSX in new emitters).
- **Effort / risk:** M–L · med (emitter refactor is the risk; keep the old emitter until parity).
- **Rank (value ÷ effort):** #16.

### G-36 — Open canvas (Figma-like) editor — area 5 · L · high · rank #20

- **Competitor / source:** **fabric.js** — https://github.com/fabricjs/fabric.js — **MIT** (GitHub API 2026-09-06), 31.4k★, pushed 2026-08-18 (canvas object model: shapes, groups, SVG export). ⚠️ **Penpot** — https://github.com/penpot/penpot — **MPL-2.0** (API-verified), 59.6k★ — **NOT in the allowed set (copyleft file-scoped): pattern-only, do not vendor any Penpot code**; its pattern (token-aware, code-exporting open design tool) is the benchmark.
- **What they do / why it beats us:** a visual editing surface for the design system — drag wireframes, export SVG/PNG — closing the loop between P8 prototyping and P6 scaffold.
- **RapidTool gap (file:line):** P8 "Dynamic UI/UX Prototyping" (`phases.ts:69-74`) is artifact **text**; the design system is JSON only (`design.ts:15-16`); no visual surface exists.
- **Borrow:** **real dependency (MIT)** — fabric.js, **lazy-loaded behind the design tab only** (bundle weight is the known failure mode, same rule as 07 §2.2 for mermaid).
- **Integration spec (.ts):** new `src/components/DesignCanvas.tsx` — renders token swatches (`design.ts` tokens), spec-graph wireframe boxes (`algorithms.ts:337-384`), draggable/resizable; exports SVG/PNG into artifacts via the existing download plumbing (`io.ts`).
- **UI wiring:** design tab hosts the canvas behind `React.lazy`; the packet download menu gains "Export wireframe PNG".
- **Headless/agent wiring:** none required (visual-only surface); agent side stays the token JSON.
- **Acceptance criteria:** (1) canvas module loads only on tab open (main bundle +≤ 50KB gz); (2) exported PNG/SVG lands in the artifacts list; (3) zero LLM calls.
- **Effort / risk:** L · high (bundle + scope creep + canvas a11y).
- **Rank (value ÷ effort):** #20 — build last, and only if the design tab earns usage.

### G-37 — LLM-as-designer vector/logo/icon/badge generation on the SAME DeepSeek key — area 6 · M · med · rank #3

- **Competitor / source (honest architecture first):** the DeepSeek API is **text-only**. Fetched 2026-09-06: https://api-docs.deepseek.com/ documents exactly one generation endpoint family (`/chat/completions`) and three models — `deepseek-v4-flash`, `deepseek-v4-pro`, and the experimental `deepseek-v4-flash-vision-exp` which "additionally accepts image **input**" (Vision guide) — **there is no image-generation endpoint**. RapidTool's own provider module mirrors this: `deepseek.server.ts:174` posts only to `/chat/completions`, and the vision tier is explicitly excluded from chat usage (`deepseek.server.ts:13-14`). Therefore the only honest way to get "logo generation" from this key is **LLM-as-designer**: the model emits SVG path *code* + palette hexes; a deterministic sanitizer/validator and the browser render them. Precedents (all verified 2026-09-06): **iconify/iconify** — MIT, 6.3k★, pushed 2026-09-06 (universal SVG icon framework: one syntax for 200k+ icons — the *renderer/asset* half); **tailwindlabs/heroicons** — MIT, 23.8k★ (hand-tuned 24×24 icon grammar — the *quality bar* for LLM-emitted paths); **simple-icons** — ⚠️ **CC0-1.0** (public-domain dedication; usable with attribution care, but NOT in the MIT/Apache/BSD set — flag in vendor notes), 25.8k★ (brand logos); **seeb4coding/SVG-ORA-Studio** — ⚠️ **no LICENSE file** (API 2026-09-06), 74★ — cited only as existence proof of the "AI-powered SVG generator & editor" UX; pattern-only, do not copy code. Research proof the capability class exists: **OmniSVG** (arXiv:2504.06263, https://omnisvg.github.io/) — unified SVG generation model.
- **What they do / why it beats us:** one key produces brand assets (logo, icon set, badges, monogram) as *code* — editable, deterministic-rendered, zero new services, zero image-API cost.
- **RapidTool gap (file:line):** no vector/image artifact of any kind exists; `llm.ts:14` types exactly two text tiers (`LlmModel = "deepseek-v4-flash" | "deepseek-v4-pro"`); `design.ts` palette is deterministic-only (`design.ts:19-22`).
- **Borrow:** **zero-dep recode + optional asset vendoring.** Iconify (MIT) supplies the renderer/data pattern and, optionally, a vendored icon subset as the deterministic floor; the LLM prompt + sanitizer are new code. (Iconify's full JSON data sets are CC-licensed per set — vendor only MIT/CC-BY-licensed subsets or, safer, reuse installed lucide.)
- **Integration spec (.ts):** new `src/lib/vector.ts`: (1) `promptLogo(brief, tokens)` — strict prompt: single `<svg viewBox="0 0 96 96">`, ≤ 12 `<path>`/`<circle>`/`<rect>` elements, fills from the project palette only, no gradients/defs v1; (2) `sanitizeSvg(svg): string` — zero-dep whitelist parser (~120 lines): allowed tags `svg/path/circle/rect/polygon/g/defs/linearGradient/stop`, allowed attrs `viewBox/fill/stroke/d/r/cx/cy/x/y/width/height/points/transform/stroke-width/fill-opacity`, **strip `<script>`, `<foreignObject>`, event attrs, `url()`/`href` refs**, reject unbalanced/oversized input; (3) `renderSvgToDataUrl(svg)` for `<img>` preview; (4) deterministic fallback `geometricMonogram(name, seed)` — initials-in-circle + seeded geometric variation, keyless, byte-stable (mirrors the honesty contract `crew.server.ts:18-21`: never fabricate).
- **UI wiring:** design tab "Brand kit": logo preview (`<img>` on data URL — DOMPurify rules apply, G-01 companion), monogram fallback toggle, icon-set picker (lucide installed / vendored subset), "Export SVG" via `io.ts` download (`Ext` union widened per 07 §2.10, `io.ts:118`).
- **Headless/agent wiring:** `cli vector --kind logo|icon|badge|monogram --out brand.svg` via the `headless.ts` live-overlay pattern (`headless.ts:130-231`); agents receive SVG *text* in artifacts (packet-safe).
- **Acceptance criteria:** (1) LLM output parses under `sanitizeSvg` or is rejected with evidence; (2) fuzz corpus (script tags, foreignObject, event attrs) all stripped — security test in CI; (3) zero-key run emits a byte-identical monogram for the same seed; (4) rendered logo visible in the design tab; (5) zero new services — only `llm.ts`/`deepseek.server.ts` calls.
- **Effort / risk:** M · med (SVG injection is the real risk — sanitizer + existing CSP; LLM path quality varies — deterministic floor guarantees a usable asset).
- **Rank (value ÷ effort):** #3 — flagship demo that costs one prompt, not a new subscription.

### G-38 — Palette→UI ramp mapping — area 6 · S · low · rank #17

- **Competitor / source:** **open-color** — https://github.com/yeun/open-color — **MIT** (GitHub API 2026-09-06), 5.6k★, pushed 2023-12-10 (curated 13-color × 10-step ramps); **chroma.js** — https://github.com/gka/chroma.js — **BSD-3-Clause + Apache-2.0 dual** (raw LICENSE read 2026-09-06: BSD redistribution terms; repo 10.6k★, pushed 2026-06-01 — allowed); **culori** — https://github.com/Evercoder/culori — **MIT** (API), 1.2k★, pushed 2026-07-02 (tree-shakeable color math, LCH interpolation).
- **What they do / why it beats us:** any base hex becomes a full accessible UI ramp (hover/active/disabled steps), so LLM-chosen brand colors produce *usable* UIs instead of flat fills.
- **RapidTool gap (file:line):** `design.ts` palette is fixed family·cast pairs (`design.ts:19-22`, `57-63`) — a new brief never yields a new palette, and no ramp derivation exists for scaffolded apps.
- **Borrow:** **real deps (MIT/BSD, tiny)** — `culori` for LCH ramp math (tree-shaken to ~2KB) OR zero-dep HSL fallback; vendor open-color ramps (MIT) as the deterministic seed set.
- **Integration spec (.ts):** new `src/lib/palette.ts`: `deriveRamp(baseHex, steps=10)` (culori `interpolate("lch")`), `rampFromBrief(brief)` (LLM JSON → `{ base, accent, neutral }` hexes, validated), `accessiblePair(bg, fg)` (WCAG contrast math, zero-dep); feed results into `designTokens` (`design.ts:15`) and G-37's vector fills.
- **UI wiring:** design tab ramp strip per token key with contrast badges.
- **Headless/agent wiring:** `cli palette <hex>` — deterministic.
- **Acceptance criteria:** (1) any valid hex → 10-step ramp; (2) each ramp passes a contrast pair assertion (extend `design.test.ts`); (3) invalid LLM palette falls back to the deterministic cast.
- **Effort / risk:** S · low.
- **Rank (value ÷ effort):** #17 (ship alongside G-37).

### G-39 — Agent memory consolidation: write-back + ranking — area 7 · M · low-med · rank #4

- **Competitor / source:** **mem0** — https://github.com/mem0ai/mem0 — **Apache-2.0**, 64.8k★, pushed 2026-09-04 (per 07 §2.6 — verdict: SKIP as a dependency, **steal the pattern**: extract decision summaries into persistent memory); **Letta** — https://github.com/letta-ai/letta — **Apache-2.0**, 24.6k★ (07 §2.6).
- **What they do / why it beats us:** cross-run agent memory — what worked/failed last run shapes this run's context automatically.
- **RapidTool gap (file:line):** M-08 open: `applyReport` writes **no memory** (`report-intake.ts:142-147`); `MemoryEntry` rows originate only in engine code (02 §B6: `engine.ts` synthesis rows, `algorithms.ts:543-578 bootstrapMemory`, override/reject rows); P5 "Self-Learning" has no loop (`phases.ts:47-51`); the vault is manual notes with token search (`vault.ts:564-580`).
- **Borrow:** **zero-dep recode** — the memory store already exists (`project.memory`, `types.ts:97-100`, dedupe + `dedupeMemoryIds` in `engine.ts:976`); mem0/Letta are Python services RapidTool must not take on (07 §2.6 rationale).
- **Integration spec (.ts):** `report-intake.ts`: `applyReport` appends episodic/semantic rows on approved complete reports (summary + artifact titles + provenance fields per 08 E-18); rejected reports append lesson rows linked to the rejection ledger row (G-25 critiques included); `vault.ts`: add `exportMemoryNotes()` emitting learned lessons into the vault MOC export (existing MOC export `vault.ts:340-375` per 07 §1); FusionRank already ranks memory into every packet (`algorithms.ts:214-261`, `packet.ts:75-79,203-206`) — no new ranking needed.
- **UI wiring:** vault tab shows memory-derived notes with provenance; packet memory section lists new rows.
- **Headless/agent wiring:** automatic on `ingest` (`headless.ts:544`).
- **Acceptance criteria:** (1) approved report → memory rows ranked into next packet; (2) rejected report → lesson row with ledger evidence hash; (3) idempotent re-ingest (content fingerprint, 08 E-09 pattern) creates no duplicates.
- **Effort / risk:** M · low-med.
- **Rank (value ÷ effort):** #4 — the memory half of the 14-roadmap's L5; makes the self-learning loop real.

### G-40 — Agent observability, evals & replay (+ MCP server + git export) — area 7 · M–L · med · rank #2

- **Competitor / source:** **Langfuse** — https://github.com/langfuse/langfuse — core **MIT** (raw LICENSE read 2026-09-06: "Portions… under the ee/… directories… licensed under ee/LICENSE" — use core-only, flag EE parts; 34.2k★, pushed 2026-09-06): LLM tracing/evals/metrics; **promptfoo** — https://github.com/promptfoo/promptfoo — **MIT** (API), 24.9k★, pushed 2026-09-06: prompt/agent evals + red-teaming; **OpenHands** — https://github.com/All-Hands-AI/OpenHands — **MIT** (API), 86.3k★, pushed 2026-09-05: event-stream agent runtime whose runs can be **replayed** step-by-step; **MCP TypeScript SDK** — https://github.com/modelcontextprotocol/typescript-sdk — **MIT→Apache-2.0 transition** (raw LICENSE read), 13.3k★ — expose RapidTool as an MCP server; **isomorphic-git** — https://github.com/isomorphic-git/isomorphic-git — **MIT** (API), 8.3k★, pushed 2026-09-03 — pure-JS git for snapshot history export.
- **What they do / why it beats us:** you can *see* every agent step (tracing), *measure* prompt/agent quality (evals), *rewind* a run (replay), and let other agents *drive* RapidTool (MCP) — the infrastructure that makes all other loops improvable.
- **RapidTool gap (file:line):** crew transcripts are **not persisted** (08 E-28 open); no trace UI; no eval harness (tests exist for the deterministic core, nothing evaluates LLM output quality); no replay path; no MCP surface; project history has no git export.
- **Borrow:** **zero-dep-first trace + pattern-steals; deps only for MCP/git.** Langfuse self-hosting is a service RapidTool doesn't need — steal the *span model* (trace → spans → generations, input/output/tokens/latency/verdict). promptfoo = pattern + optional real dep (MIT) for the eval runner. OpenHands = replay pattern (event stream + snapshot replay), not a dependency (its runtime is a parallel universe to the engine).
- **Integration spec (.ts):** new `src/lib/trace.ts`: `traceStart/span/log` writing append-only NDJSON into `<project>.trace` (append-only like the ledger `engine.ts:969-1016`), spans `{ id; parent; phase; role; model; tokensIn; tokensOut; latencyMs; verdict }`; new `src/lib/eval-runner.ts`: promptfoo-style assertion cases (contains / zod JSON-schema via the installed zod `toJSONSchema` per 07 §2.9) over stored traces + packet outputs, runnable via a new `npm run eval`; `src/lib/mcp-server.ts`: wrap the `headless.ts` verb surface (create/run/approve/reject/ingest/packet) as MCP tools via the TypeScript SDK — external agents (Claude Code etc.) can drive a governed build; `io.ts` optional `exportGitHistory()` via isomorphic-git from G-26 snapshots.
- **UI wiring:** new "Trace" tab — waterfall of spans (color by verdict), click-through to prompt/response; eval results in a "Quality" panel (E-21 seam).
- **Headless/agent wiring:** `cli trace show <run>`, `cli replay <run>` (re-runs from snapshot + replays trace to same verdict — pairs with G-22/G-26), MCP: `npx rapidtool-mcp`.
- **Acceptance criteria:** (1) every engine/crew run writes a trace; (2) a failed run replays from trace+snapshots to the same gate verdict; (3) eval suite asserts ≥ 1 case per crew role against stored traces; (4) an external MCP client completes `approve` on a HITL phase end-to-end; (5) zero secrets in trace files (prompts redacted config).
- **Effort / risk:** M–L · med (trace schema churn is the main risk — freeze v1 schema in `types.ts`).
- **Rank (value ÷ effort):** #2 — observability is the precondition for every improvement loop in `14_agi_aggregation.md`; without it, G-21…G-39 are unmeasurable.

---

## 3. Roll-up: G-21…G-40 licenses & ranks (all verified 2026-09-06)

| Gap | Repo (owner/repo) | License (source) | Stars | Pushed | Verdict |
|-----|-------------------|------------------|-------|--------|---------|
| G-21 | crewAIInc/crewAI | MIT (API) | 58.1k | 2026-09-04 | pattern-steal (Python) |
| G-21b | openai/swarm | MIT (raw LICENSE) | 21.9k | 2026-04-15 | handoff pattern |
| G-22 | langchain-ai/langgraph | MIT (API) | 41.1k | 2026-09-06 | pattern-steal; zero-dep recode |
| G-23 | FoundationAgents/MetaGPT | MIT (API) | 70.2k | 2026-01-21 | fan-out pattern |
| G-24 | modelcontextprotocol/servers (sequentialthinking) | MIT→Apache-2.0 (raw LICENSE) | 90.1k | 2026-09-03 | ledger schema pattern |
| G-24b/26 | cline/cline | Apache-2.0 (API) | 67.5k | 2026-09-05 | Plan/Act + checkpoints pattern |
| G-25 | noahshinn/reflexion | MIT (API) | 3.3k | 2025-01-14 | critique-loop pattern |
| G-27 | TheAlgorithms/Python | MIT (API) | 224.3k | 2026-09-06 | vendor subset (port to TS) |
| G-28 | dubzzz/fast-check | MIT (API) | 5.1k | 2026-09-05 | **real dep (server)** |
| G-29 | eslint/eslint (complexity rule) | MIT (API) | 27.5k | 2026-09-05 | zero-dep recode preferred |
| G-30 | sverweij/dependency-cruiser | MIT (API) | 7.1k | 2026-09-05 | **real dep (server)** |
| G-31 | pahen/madge | MIT (API) | 10.2k | 2026-01-21 | **real dep (server)** |
| G-32 | phodal/adr | MIT (API) | 271 | 2026-07-13 | zero-dep recode first |
| G-32 ⚠️ | npryce/adr-tools | Other / NOASSERTION (API); no LICENSE file; README CC-BY-SA-4.0 | 5.7k | 2024-04-25 | **pattern-only, NOT allowed as code** |
| G-33 | dsherret/ts-morph | MIT (API) | 6.2k | 2026-09-02 | **real dep (server)** |
| G-34 | amzn/style-dictionary | Apache-2.0 (API) | 4.8k | 2026-09-04 | pattern first; dep optional |
| G-35 | joe-bell/cva · aknuds1/html-to-react | Apache-2.0 · MIT (API) | 6.9k / 798 | 2026-09-06 / 2026-08-31 | **real deps (tiny)** |
| G-35b | shadcn-ui/ui | MIT (07 §2.11) | 123.1k | — | pattern only |
| G-36 | fabricjs/fabric.js | MIT (API) | 31.4k | 2026-08-18 | **real dep (lazy-loaded)** |
| G-36 ⚠️ | penpot/penpot | **MPL-2.0** (API) | 59.6k | 2026-09-04 | **pattern-only, flagged** |
| G-37 | iconify/iconify · tailwindlabs/heroicons | MIT · MIT (API) | 6.3k / 23.8k | 2026-09-06 | pattern + optional asset vendoring |
| G-37 ⚠️ | simple-icons/simple-icons | **CC0-1.0** (API) | 25.8k | 2026-09-06 | usable w/ attribution care — flag |
| G-37 ⚠️ | seeb4coding/SVG-ORA-Studio | **no LICENSE file** (API) | 74 | 2026-08-10 | existence-proof only, pattern-only |
| G-38 | yeun/open-color · gka/chroma.js · Evercoder/culori | MIT · BSD-3(+Apache-2.0, raw) · MIT | 5.6k / 10.6k / 1.2k | — | **real deps (tiny)** or zero-dep |
| G-39 | mem0ai/mem0 · letta-ai/letta | Apache-2.0 · Apache-2.0 (07 §2.6) | 64.8k / 24.6k | — | pattern-steal (zero-dep recode) |
| G-40 | langfuse/langfuse | core MIT, ee/ portions flagged (raw LICENSE) | 34.2k | 2026-09-06 | span-model pattern |
| G-40 | promptfoo/promptfoo | MIT (API) | 24.9k | 2026-09-06 | pattern or real dep |
| G-40 | All-Hands-AI/OpenHands | MIT (API) | 86.3k | 2026-09-05 | replay pattern |
| G-40 | modelcontextprotocol/typescript-sdk | MIT→Apache-2.0 (raw LICENSE) | 13.3k | 2026-09-06 | **real dep** (MCP server) |
| G-40 | isomorphic-git/isomorphic-git | MIT (API) | 8.3k | 2026-09-03 | optional dep |

**License hygiene:** every code-steal is MIT / Apache-2.0 / BSD-3-Clause. Flagged and excluded from code-steal: `microsoft/autogen` now reports **CC-BY-4.0** (API 2026-09-06 — creative-commons, pattern-only; do not vendor), Penpot (MPL-2.0), adr-tools (CC-BY-SA-4.0), simple-icons (CC0-1.0, attribution care), SVG-ORA-Studio (no license), Langfuse `ee/` portions.

**Ranking (value ÷ effort), G-21…G-40:** #1 G-22 (graph runtime) · #2 G-40 + G-21 (observability, orchestration) · #3 G-37 (vector/logo on the same key) · #4 G-25 + G-39 (critique + memory = the learning loop) · #5 G-24 · #6 G-23 · #7 G-28 · #8 G-27 · #9 G-26 · #10 G-32 · #11 G-29 · #12 G-30 · #13 G-31 · #14 G-33 · #15 G-34 · #16 G-35 · #17 G-38 · #20 G-36. (Ties share ranks; #18/#19 intentionally unused pending next pass.)

---

## 4. Cross-file index

- `01_open_source_harnesses.md` — harness landscape (MetaGPT/CrewAI/AutoGen/LangGraph digests) the delegation entries extend.
- `02_capability_audit.md` — A1–A9 strengths, B1–B7 gaps, E1–E4 proposals (source of recovered G-10…G-14, M-01…M-12).
- `03_crew_design.md` — v1 crew architecture this pass proposes to evolve (G-21/G-23).
- `04_verification_design.md` — oracle/verification design (G-25/G-28 extend it).
- `06_competitor_survey.md` — commercial competitor digests (family A/B/C).
- `07_opensource_steal_catalog.md` — license-verified steal catalog (source of recovered G-01…G-09, G-18, G-19; cross-refs for G-31/G-34/G-37).
- `08_enhancement_register.md` — build-ready enhancements E-01…E-30 (source of recovered G-10…G-17, G-20).
- `14_agi_aggregation.md` — **this register feeds it**: which of G-21…G-40 compose the 5-layer near-AGI aggregation roadmap and the critical path.
