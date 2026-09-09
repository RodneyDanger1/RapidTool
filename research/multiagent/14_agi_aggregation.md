# 14 — Aggregating Open Source Toward "Near-AGI" on a Single DeepSeek Key: An Honest Engineering Analysis

- **File:** `research/multiagent/14_agi_aggregation.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
- **Date / agent:** 2026-09-06 · deepseek-v4-pro subagent (DEEP RESEARCHER). **Strictly read-only on source**; this file and the G-21…G-40 extension of `13_top20_gaps.md` are the only outputs of this pass.
- **Question:** if "near-AGI" means *aggregating open-source components behind one DeepSeek API key into something approaching an autonomous software-production system* — what can that honestly mean, what can it not mean, what is the 5-layer roadmap, and what is the critical path?
- **Method:** every external claim cites a source fetched/verified 2026-09-06 (DeepSeek API docs, GitHub API license checks, framework docs); every RapidTool claim is file:line-verified. Where a claim is engineering judgment rather than evidence, it is labeled as such.

---

## 0. Executive answer (read this first)

**What you can honestly build** is not AGI. It is an **agentic harness** — a bounded, deterministic, self-verifying, self-remembering pipeline for producing governed software artifacts, whose LLM-dependent steps degrade to a keyless deterministic floor. The aggregation thesis is real but modest: open-source pieces supply *structure* (orchestration graphs, plan ledgers, property tests, ADRs, tracing), and one DeepSeek key supplies *judgment* — but only as **text**. The quality ceiling is the model; the quality *floor* is the harness, and a harness that verifies its own work is the only honest way to get "more than the model" out of one key.

**What it cannot be:** a mind, a general reasoner, a multimodal designer (text-only key — §2), an unbounded autonomous operator (bounded local runner), or a magic quality multiplier (aggregation adds loops, not intelligence).

**The single highest-leverage sentence:** "near-AGI" on this budget is achieved by making **failure visible and looped** (verify → critique → memory → retry), not by stacking models. That loop is exactly what RapidTool's governance philosophy already demands — and exactly what it does not yet have (§3, L4/L5).

---

## 1. Working definition: what "aggregation toward near-AGI" can REALLY mean here

Definition used in this document (engineering scope, not philosophy):

> **Near-AGI-for-software-production** = an agentic system that, given a natural-language brief, can (L1) *perceive/spec* the problem, (L2) *plan* a decomposition, (L3) *act* by generating code and artifacts, (L4) *verify* its own outputs with machine checks, and (L5) *remember and improve* across runs — with a human gate on the consequential edges, a bounded execution environment, and an honest fallback when the model is absent.

### 1.1 CAN (honest, buildable with today's verified pieces)

| Capability | Evidence it is buildable | RapidTool state today |
|---|---|---|
| Spec from brief, deterministic | RapidTool already does this: lattice + `planSpecGraph` (`algorithms.ts:337-384`), `buildTestOracle` (`algorithms.ts:449-467`) | **HAVE (A-series, 02)** |
| Text-based planning, revisable | Sequential-thinking ledger pattern (MCP `sequentialthinking`, MIT→Apache-2.0; G-24) | **MISSING** (fixed 13-phase array, `phases.ts:3-109`) |
| Multi-agent orchestration with budgets | CrewAI hierarchical + MetaGPT fan-out patterns (MIT; G-21/G-23); RapidTool has a flat advisory crew (`crew.server.ts:51-76`) | **PARTIAL** |
| Stateful execution with checkpoints | LangGraph durability semantics (MIT; G-22); RapidTool project JSON is a full state but has no resume/edges | **PARTIAL** |
| Machine verification of own output | Executable oracle + fast-check properties + complexity gate (G-10/G-28/G-29; TDD-Bench shows LLMs can write fail-to-pass tests and that doing so improves fix correctness — arXiv:2412.02883, cited in 02 §C) | **PARTIAL** (`verify.server.ts` expression cases only) |
| Cross-run memory | mem0/Letta *patterns* (Apache-2.0, 07 §2.6) over the existing `MemoryEntry` + FusionRank (`algorithms.ts:214-261`); G-39 | **MISSING** (M-08: `report-intake.ts:142-147` writes no memory) |
| Self-critique loop | Reflexion (MIT; G-25): critique → revise → retry | **PARTIAL** (`verifyAndFixServer` iterates, persists nothing) |
| Vector/logo design on the same key | LLM-as-designer SVG emission (DeepSeek is text-only, §2; G-37) | **MISSING** |
| Observability/replay | Span-trace + OpenHands-style replay pattern (MIT; G-40) | **MISSING** (E-28 open) |

### 1.2 CANNOT (hard limits — do not roadmap against these)

1. **No image/video/audio generation.** The DeepSeek API exposes exactly `/chat/completions` with text output; the only non-text tier is `deepseek-v4-flash-vision-exp`, which "additionally accepts image **input**" — input, not output (https://api-docs.deepseek.com/, fetched 2026-09-06; mirrored locally at `deepseek.server.ts:13-14,174`). All "design" must be **code emission** (SVG/CSS) rendered by a deterministic layer — never pixels from the model. (Engineering consequence, not a workaround: the SVG route is *better* for this product anyway — editable, diffable, governable.)
2. **No "more intelligence than the model."** Aggregation of open-source *scaffolding* cannot raise reasoning quality; it can only raise process quality (verification, memory, determinism). Any claim that stacking CrewAI+LangGraph+Reflexion makes a weak model "smarter" is marketing, not engineering. The honest gain is **reliability per token**, not IQ per token.
3. **No unbounded autonomy.** RapidTool executes through a bounded local runner (`node-runner.server.ts`, surfaced at `console.tsx:1120`) and a fixed phase machine; OS-level autonomy (install packages, browse, deploy at will) is deliberately absent — and for a governed product, that is the feature. Near-AGI hype versions (fully autonomous internet agents) are out of scope by design.
4. **No emergent consciousness / general world competence.** Nothing in this stack changes the model's world knowledge. Judgment call, not a citation — but it bounds every roadmap item below to *software production*, where the loop (not the mind) carries the quality.
5. **No free lunch on determinism.** Every LLM step inserted into the engine breaks byte-reproducibility; the invariant that protects RapidTool (B.3.3, `engine.ts` attachAlgorithms determinism; honesty contract `crew.server.ts:18-21`) must be preserved by keeping an always-available **keyless deterministic floor** under every LLM layer — the pattern already established (`llm.ts` `{ok:false}` → engine falls back).

---

## 2. Ground truth: the single-key constraint

- **One key = one token budget.** Every agent, crew member, critique, and eval shares the same account. A 13-phase run with a crew of 6 roles is already 6 calls/phase minimum in the current sequential design (`crew.server.ts:9-10`); hierarchical fan-out (G-21) and parallel branches (G-23) multiply cost linearly. **Budget arbitration is a first-class feature, not an afterthought**: per-project token budget field in the packet System JSON (the E-11 seam already planned, 08 E-11), per-task budgets in the manager's task list (G-21), flash-vs-pro tiering per role (both tiers already typed: `llm.ts:14`, `DEEPSEEK_MODELS` `deepseek.server.ts:25-37` — flash for coder/tester volume, pro for planner/manager judgment).
- **Thinking is already on.** Both V4 models default to thinking enabled (`deepseek.server.ts:37`), so sequential-thinking quality is free at the model level; the *missing* part is making the thinking **visible and persisted** (G-24 ledger), not enabling it.
- **The keyless floor is the moat.** Competitors die without a model; RapidTool already degrades honestly (`crew.server.ts:18-21`). Every aggregation layer below must keep that property — this is the single most important design constraint of the whole roadmap.

---

## 3. The five capability layers: what fills each, what RapidTool has, what's missing

### L1 — Perceive / Spec (turn a brief into a checked problem statement)

- **Open-source pieces:** web-research grounding patterns (RapidTool's own `research.ts` + `websearch.server.ts` + optional Tavily, `tavily.server.ts`); competitor/domain intelligence from the survey corpus (06).
- **RapidTool has (file:line):** P0 research phase (`phases.ts:5-10`), `inferDomain`/`inferName` (`engine.ts:93-123`), lattice + constraints (`algorithms.ts` planSpecGraph/scheduleConstraints), feasibility scorecard (`algorithms.ts:578+`).
- **Gap:** research citations decay before the code phase (M-06, `packet.ts:80-87,242-244` per 02); false `cited` promotion (M-01). → G-12 (grounding lifecycle) is the L1 critical item, plus honest per-row source columns.

### L2 — Plan (turn the spec into a revisable execution plan)

- **Open-source pieces:** sequential-thinking ledger (MCP `sequentialthinking`, MIT→Apache-2.0 — G-24); LangGraph plan-and-execute semantics (MIT — graph + conditional edges, G-22); Cline Plan/Act discipline (Apache-2.0 — human alignment between plan and act, G-24b).
- **RapidTool has:** the *fixed* 13-phase graph (`phases.ts:3-109`) and the deterministic spec-graph order (`algorithms.ts:305-384`).
- **Gap:** no plan object, no revision, no conditional edges, no backtracking. → G-24 (ledger) + G-22 (graph runtime) + G-26 (rollback) are the L2 layer. **The deterministic plan (topo() of the spec graph) remains the keyless floor.**

### L3 — Act (generate code and artifacts under budget)

- **Open-source pieces:** CrewAI hierarchical/sequential processes (MIT — G-21); MetaGPT parallel fan-out (MIT — G-23); OpenAI Swarm handoff verb (MIT — G-21b); scaffold emitters (RapidTool's own `scaffold.ts:971`); algorithm corpus (TheAlgorithms, MIT — G-27).
- **RapidTool has:** the flat advisory crew (`crew.server.ts:51-76`) and the bounded runner (`node-runner.server.ts`).
- **Gap:** no manager/delegation, no parallel branches, no algorithm-aware synthesis. → G-21 + G-23 + G-27. **Constraint:** crew stays advisory (`crew.server.ts:15-16` — never approves/advances); the engine gates remain the only authority.

### L4 — Verify (machine checks that block bad output)

- **Open-source pieces:** executable-oracle loop (02 §C E1; `verify.server.ts:152-219` exists — extend per G-10); fast-check properties (MIT — G-28); complexity gate (G-29); dependency-cruiser arch rules (MIT — G-30); madge graph (MIT — G-31); promptfoo evals (MIT — G-40). Industry anchor: Anthropic's verification-driven development — give the agent "a check it can run… the difference between a session you watch and one you walk away from" (https://code.claude.com/docs/en/best-practices, cited in 02 §C with corroborating sources); TDD-Bench Verified (arXiv:2412.02883) shows fail-to-pass test generation improves fix correctness.
- **RapidTool has:** DoD gates with FNV-1a evidence hashes (`dod.ts`), the append-only ledger (`engine.ts:969-1016`), machine-run expression cases (`verify.server.ts:21-94`).
- **Gap:** the oracle is prose, not executable (`algorithms.ts:449-467`); gates are recorded but never consulted to block autopilot (M-09); no properties, no metrics, no evals. → **This is the most underbuilt layer and the highest-leverage one** (02 §C's core finding, confirmed this pass). G-10 + G-28 + G-29 + G-30 + G-40-evals.

### L5 — Remember / Improve (persist lessons and shape the next run)

- **Open-source pieces:** mem0/Letta memory patterns (Apache-2.0 — steal pattern only, 07 §2.6); Reflexion critique loop (MIT — G-25); Langfuse span model (core MIT — G-40); OpenHands event-stream replay (MIT — G-40).
- **RapidTool has:** `MemoryEntry` types + FusionRank (`algorithms.ts:214-261`, `packet.ts:75-79,203-206`), vault notes (`vault.ts:564-580`), ledger.
- **Gap:** memory write-back doesn't exist (M-08: `report-intake.ts:142-147`); no critique persistence; no trace/replay; P5 "Self-Learning" is a title with no loop (`phases.ts:47-51`). → G-39 + G-25 + G-40. **This layer is what makes the system improve per run — the only honest claim to "approaching" anything.**

---

## 4. The 5-layer roadmap (phases with exit criteria)

> Effort: **S** ≤ half day · **M** ≤ 2 days · **L** > 2 days. Each phase keeps the keyless deterministic floor intact (non-negotiable invariant).

### Phase 1 — "Make failure visible" (observability spine) — M
Ship `trace.ts` (G-40) + crew transcript persistence (08 E-28). Exit: every run writes an append-only trace; a failed run replays to the same verdict. *Why first: you cannot improve what you cannot see; every later phase's success is measured against traces.*

### Phase 2 — "Make checks real" (verification layer) — M–L
Executable oracle + fail-to-pass loop (G-10/02 E1, `verify.server.ts`), fast-check properties (G-28), complexity gate (G-29), arch rules (G-30/G-31). Exit: an agent-built module cannot reach "complete" without machine-run evidence; gate evidence carries hashes + shrunk counterexamples.

### Phase 3 — "Make plans real" (planning layer) — M
Plan-then-act ledger (G-24 `think.ts`) + graph runtime with checkpoints and conditional edges (G-22 `plan.ts`) + snapshot rollback (G-26). Exit: conditional edge demo (skip P10 on offline brief); crash-resume replay is deterministic; ledger is machine-readable in the packet.

### Phase 4 — "Make the crew an orchestrator" (delegation layer) — M
Hierarchical manager with per-task budgets + handoffs (G-21), parallel fan-out with merge (G-23), algorithm synthesis + benchmark harness (G-27). Exit: a manager-produced task list artifact with per-task reports and honored budgets; parallel turn latency ≈ longest branch; crew remains advisory.

### Phase 5 — "Close the learning loop + showcase" (memory + design) — M–L
Memory write-back + provenance (G-39), Reflexion critique persistence (G-25), eval harness over traces (G-40), and the flagship honest demo: LLM-as-designer vector/logo/palette on the same key (G-37/G-38) + token pipeline (G-34). Exit: run N+1 demonstrably consults run N's lessons (memory rows ranked into the packet); a zero-key run still produces the full deterministic brand kit (monogram fallback).

*Deferred (build only if usage demands):* G-35 component catalog (M–L), G-36 open canvas (L, high risk), G-32 ADR automation (S — cheap, schedule whenever P4 lands).

---

## 5. Critical path — the first five items to build (ordered, with acceptance)

1. **Trace spine (`src/lib/trace.ts`, G-40).** NDJSON spans {phase, role, model, tokens, latency, verdict} appended like the ledger. Acceptance: every engine/crew call traced; `cli trace show <run>` renders a waterfall; secrets redacted.
2. **Executable oracle loop (02 §C E1; G-10).** Thread `runCases` evidence into `lastTest` so the DoD `p6-test` gate (`dod.ts:111-114`) reflects real runs; open HITL on red. Acceptance: a failing oracle blocks autopilot advancement with evidence (M-09 closure).
3. **Plan ledger (`src/lib/think.ts`, G-24).** Deterministic floor = spec-graph order; LLM rows when key present. Acceptance: P1 emits a JSON plan artifact; deviations logged as revised rows.
4. **Memory write-back (`report-intake.ts` applyReport, G-39 + M-08).** Approved reports append semantic/episodic memory with provenance; rejected reports append lessons. Acceptance: lesson rows ranked into the next packet by FusionRank; idempotent re-ingest.
5. **Hierarchical crew with budgets (G-21, `crew.server.ts`).** Manager task-list JSON + per-task token budgets; crew stays advisory. Acceptance: task-list artifact + per-task reports; zero-key → honest `{ok:false}` transcript unchanged.

**Why these five:** items 1–2 create the feedback signal (visibility + verification), items 3–5 create the adaptation machinery (plan + memory + delegation) that the signal steers. Everything else in the register is either a consumer of these (G-25 critique, G-26 rollback, G-30/G-31 arch checks), a quality amplifier (G-27/G-28/G-29), or a demo/surface (G-34…G-38). Total estimated effort: ~6–9 focused days to the first *demonstrable* "self-improving governed builder", followed by continuous hardening.

---

## 6. Honest risks & failure modes (what actually kills this)

1. **Determinism regression.** The single most valuable RapidTool property (02 A-series) breaks the moment an LLM step writes into engine state without a fallback. Mitigation: every LLM layer ships with its deterministic sibling (ledger floor, monogram fallback, template critique), and the honesty lint (08 E-23) becomes a CI gate.
2. **Cost blowup.** Hierarchical + parallel fan-out multiplies a single key's spend; an unattended manager loop can exhaust a budget silently. Mitigation: per-project and per-task token budgets in the packet System JSON; flash-for-volume/pro-for-judgment tiering (`llm.ts:14`).
3. **Fabrication dressed as verification.** A critique or test report written by the model is *not evidence*; only machine-run outcomes are. Mitigation: evidence strings must reference run artifacts with hashes (the existing `dod.ts` philosophy); promptfoo-style evals sample-check that LLM claims match trace facts.
4. **Scope creep toward "real AGI" features** (browser autonomy, deployment autonomy, persistent personas). Each removes a governance guarantee. Mitigation: the bounded runner and fixed gate authority stay; new autonomy only behind new gates.
5. **Silent quality ceiling.** Aggregation cannot lift model capability; users may expect GPT-5-class output from a flash-tier budget. Mitigation: honest UI labeling (modelRoute honesty, 08 E-14) and the packet's System JSON stating the model tier per artifact.

---

## 7. How you'd know it ISN'T working (falsification plan)

- **Run the same brief 10× across 10 projects:** if lesson-ranked memory (L5) doesn't measurably reduce repeated gate rejections by run 6+, the learning loop is decorative.
- **Compare pass rates:** if the executable-oracle gate (L4) doesn't catch ≥ 1 failure per run that the prose oracle missed, verification isn't earning its cost.
- **Budget ledger:** if per-task budgets (L3) are exceeded > 5% of tasks without an audit row, arbitration is a fiction.
- **Trace replay:** if a replayed run ever diverges from its recorded verdict (L1/L2), determinism is broken and the whole value proposition regressed.
- **Zero-key runs:** if any new layer fails to produce a complete (if plainer) artifact without a key, the honesty contract is violated — an immediate revert trigger.

---

## 8. References (all fetched / API-verified 2026-09-06)

- DeepSeek API docs — models & endpoints, text-only + vision-*input* tier: https://api-docs.deepseek.com/ (fetched; mirrors `deepseek.server.ts:13-14,174`, `llm.ts:14`).
- CrewAI processes (sequential/hierarchical, manager_llm): https://docs.crewai.com/concepts/processes (fetched); repo crewAIInc/crewAI, MIT (API).
- LangGraph overview (durable execution, persistence, HITL, mixing deterministic+agentic): https://docs.langchain.com/oss/python/langgraph/overview (fetched); repo langchain-ai/langgraph, MIT (API).
- MetaGPT (role collaboration, message pool): https://github.com/FoundationAgents/MetaGPT README (fetched); MIT (API).
- OpenAI Swarm (handoffs): https://github.com/openai/swarm; MIT (raw LICENSE read).
- Sequential Thinking MCP server: https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking (README fetched); MIT→Apache-2.0 (raw LICENSE read).
- Cline (Plan/Act, checkpoints): https://github.com/cline/cline; Apache-2.0 (API).
- Reflexion (NeurIPS 2023, verbal RL): https://github.com/noahshinn/reflexion; MIT (API).
- fast-check: https://github.com/dubzzz/fast-check; MIT (API). dependency-cruiser: https://github.com/sverweij/dependency-cruiser; MIT (API). madge: https://github.com/pahen/madge; MIT (API). ts-morph: https://github.com/dsherret/ts-morph; MIT (API).
- Style Dictionary: https://github.com/amzn/style-dictionary; Apache-2.0 (API). CVA: https://github.com/joe-bell/cva; Apache-2.0 (API). html-to-react: https://github.com/aknuds1/html-to-react; MIT (API). fabric.js: https://github.com/fabricjs/fabric.js; MIT (API). Penpot: https://github.com/penpot/penpot; **MPL-2.0 — pattern-only** (API).
- Iconify: https://github.com/iconify/iconify; MIT (API). heroicons: https://github.com/tailwindlabs/heroicons; MIT (API). simple-icons: https://github.com/simple-icons/simple-icons; **CC0-1.0 — flag** (API). SVG-ORA-Studio: https://github.com/seeb4coding/SVG-ORA-Studio; **no license — pattern-only** (API). OmniSVG: arXiv:2504.06263, https://omnisvg.github.io/.
- mem0: https://github.com/mem0ai/mem0, Apache-2.0; Letta: https://github.com/letta-ai/letta, Apache-2.0 (both per 07 §2.6, API-verified 2026-09-05).
- Langfuse: https://github.com/langfuse/langfuse; core MIT, ee/ flagged (raw LICENSE read). promptfoo: https://github.com/promptfoo/promptfoo; MIT (API). OpenHands: https://github.com/All-Hands-AI/OpenHands; MIT (API). MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk; MIT→Apache-2.0 (raw LICENSE read). isomorphic-git: https://github.com/isomorphic-git/isomorphic-git; MIT (API).
- Anthropic verification-driven development: https://code.claude.com/docs/en/best-practices (corroborated in 02 §C with https://www.datacamp.com/tutorial/claude-code-best-practices, https://harper.blog/2025/05/08/basic-claude-code/); TDD-Bench Verified: https://arxiv.org/abs/2412.02883.
- RapidTool sibling research (file:line-verified, read this pass): `02_capability_audit.md` (A1–A9/B1–B7/E1–E4, M-01…M-12), `06_competitor_survey.md`, `07_opensource_steal_catalog.md`, `08_enhancement_register.md`, `13_top20_gaps.md` (G-01…G-40, this pass).
