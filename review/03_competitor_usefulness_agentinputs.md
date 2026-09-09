# 03 — Usefulness Verdict, Competitive Grading & Agent-Guide Inputs (review)

> Review date: 2026-09-05 · Scope: honest usefulness assessment of RapidTool (as-built), a
> graded comparison vs 12 competitor classes, and concrete protocol inputs for an
> `AGENT_GUIDE.md` plus packet-consumption rules for external AI agents.
> Evidence base: **source-code reading** (paths cited below, read-only; repo is NOT git, so all
> claims are about the code on disk at review time) + the three research dossiers
> (`research/01_parallel_repos_research.md`, `research/02_industry_sdlc_grading_research.md`,
> `research/03_tech_deep_dives_research.md`), which are cited by file + section/line offset.
> Companion deliverables: review/01 (…) and review/02 (…) if produced by the same series.

---

## 1. What RapidTool actually is (as-built ground truth)

Before any verdict, the as-built reality — verified in source, because several marketing-shaped
claims in the research baseline are stale or aspirational:

| Claim-shaped thing | What the code actually does (evidence) |
|---|---|
| "13-phase governed delivery console" | A client-side React/TanStack app (`src/`), zustand + localStorage persistence (`src/lib/store.ts`, persist key `rapidtool.v4`), executing a deterministic linear phase machine P0–P12 (`src/lib/phases.ts`; `canEnter` allows only `to === from + 1`). No network, no server, no LLM call anywhere in the engine (`ai.ts` is dead code per research/01 §1). |
| "Agent packet v2" | `compileAgentPacket()` in `src/lib/packet.ts` renders a ≤14,000-char markdown contract: System rules → Mission → operator notes → intent lattice → scheduler → crew → spec-graph order → contracts → oracle → current edge → pending-HITL → decision ledger → rejection-loop counter → ranked memory → scorecard → last-8 artifacts (900 chars each) → ADRs → OpenAPI → required output schema. Version-stamped (`packet_version: 2`), timestamped, truncation announces itself ("…[TRUNCATED]"). Stored as artifact kind `packet`, refreshed on every stamp. |
| "Decision ledger" | Append-only `decisions: HitlDecision[]` — phase, title, approve/reject, note, `decidedBy: human|autopilot`, timestamps (`types.ts`; written in `approveHitl`/`rejectHitl` in `store.ts`). Rejection requires ≥12 chars (enforced in `reject()`). |
| "Rejection loop" | Per-phase `rejectionHistory[]` (append-only notes+timestamps); packet prints attempt count + last note quoted; regeneration applies keyword-matched `REJECTION_DELTAS` boilerplate lines to the artifact text (`engine.ts` ~L141–168). Keyword matching, not semantic repair. |
| "DoD gate records" | `dod.ts` registry: per-phase exit criteria as deterministic probes over project fields (artifact presence, scorecard shape, lastTest ok, memory kinds…). `runGate()` returns pass/unmet + **FNV-1a evidence hash** over sorted `id:pass|fail` pairs; verdict recorded in `PhaseRecord.gate` + as a `gate` artifact. **Critical: advisory only** — `recordGate()` comment states "gates never block a run; they make the exit criteria visible and auditable" (`store.ts` L52–56). A FAILing phase still advances/auto-completes. |
| "Feasibility scorecard" | Deterministic formula from lattice + scheduler (`algorithms.ts` `feasibilityScorecard`); axis notes are canned strings ("Typed contracts + sequential graph.", "Scheduler ΔX.", "Phased graph prevents skipped work."). `reframe` verdict is now reachable and raises a P0 HITL. |
| "Research / competitive analysis" | Canned. `marketFor(domain)` returns static table rows (Cursor, v0/Bolt/Lovable + up to 2 domain rows) with `source: "illustrative"` (`engine.ts` L25–52). The **marker is not rendered into artifact text or the packet** — prose presents strengths/gaps as findings. Memory rows, P7 research artifact, P1–P3/P8–P11 "architecture" artifacts are all deterministic template markdown. |
| "Code generation + sandbox" | P6 synthesizes an **engine-authored template module** (`buildPhase6Module`: a `JOBS` array + self-tests `test_happy`/`test_no_skip`), runs it via `new Function` (sync-template default) or the blob-Worker `runSandboxed()`; `healSource` patches a missing `test_happy`. `sandboxClaim()` honestly reports "Engine-template runner (bounded, engine-authored code only)". No LLM-produced code ever executes. |
| "HITL / autopilot" | Stock gates P4/P5/P8/P9 are **never** autopilot-approved (`canAutopilot` excludes `STOCK_HITL`); scheduler `extraHitl` (P6/P11) may be auto-approved only when `tightness < 7.2`; `forceHuman` (failing P6 sandbox) blocks autopilot and requires an explicit override checkbox. |
| Human-facing console | 5 tabs (Artifacts / Agent packet / Spec graph / Crew / Oracle), memory rail, diagnostics log, token estimate, copy-packet button, packet **download as .md**, autopilot toggle, multi-project list with clone/rename/remove, route `/run/$id` deep link, operator-notes override field. |

**One-paragraph essence.** RapidTool is not an agentic builder and does not pretend (in code) to be
one: it is a *deterministic governance simulator + spec scaffold + prompt-contract compiler*. It
turns a human brief into (a) a simulated 13-phase governed run with visible gates, a real
append-only decision journal, and advisory DoD verdicts, and (b) a paste-ready, version-stamped
markdown contract (packet v2) that a real external agent (Claude Code, Codex, CrewAI, …) can be
asked to execute phase by phase. Its entire output surface is *text*: artifacts, memory rows,
packets, scorecards. The only code it ever runs is its own template self-test. The genuine value —
and the genuine risk — both live in how that text is labeled and consumed.

---

## 2. Usefulness for an AI agent that receives a packet v2

### 2.1 What a packet v2 gives an agent that a raw brief does not

1. **Legal-edge confinement.** "You may only work the current phase (P6 Code Generation…) unless
   the human approved an earlier HITL gate. Illegal graph jumps… are forbidden." A raw brief invites
   an agent to do everything at once; the packet bounds the *scope of this turn* and names the next
   legal edge. This is genuinely useful for phase-disciplined delivery and maps onto the
   explore→plan→implement conventions Claude Code/Kiro/Spec Kit standardized.
2. **Steering history without re-litigating.** The decision ledger (who approved/rejected what,
   when, with the ≥12-char note) plus the rejection-loop line ("retry attempt #2 after 1
   rejection(s). Last rejection note: …") tells the agent *why the human pushed back before* — the
   single most valuable thing a fresh session cannot know. A raw brief contains none of it.
3. **Exit criteria and a reply contract.** The "Required output schema" (Phase work / Files /
   Patch / Tests / Risks / Next legal edge) is a parseable response envelope, and DoD-style
   criteria are embedded per phase. This is what turns "do a good job" into "return a diff I can
   check".
4. **Deterministic scaffolding the agent would otherwise have to invent.** Lattice (jobs,
   entities, constraints), spec-graph order (schema→api→store→ui→tests), contracts, oracle tests,
   crew seats with token budgets, ADR trail, OpenAPI skeleton. Even when imperfect, this pre-built
   skeleton *anchors* the agent's plan and reduces the token cost of re-deriving structure from the
   brief. Research/01 §3.3 (MetaGPT) shows the same bet: intermediate structured documents improve
   downstream execution.
5. **Honesty affordances — some real.** Operator notes are declared to override earlier
   instructions; the packet says out loud when it was truncated; the execution line honestly says
   the sandbox is an engine-template runner; autopilot decisions are labeled with their actor.
   These reduce the "trust everything in context" failure mode — *if the agent is trained to look
   for them*.
6. **Ranked memory with provenance kinds.** Memory rows carry kind (episodic/semantic/procedural)
   and a score; the packet tells the agent which are first-writes vs. accumulated lessons.

### 2.2 What a packet v2 does NOT give an agent

- **No live feedback loop.** The packet is a static compile. The agent's reply is pasted back by a
  human; nothing machine-validates the reply against the oracle or the phase DoD; no artifact the
  agent produces is hashed back into the ledger. The loop is *copy-paste-manual*. (Research/01 §4
  M3/G3: the industry pattern is runnable checks the agent itself closes — Aider lint/test, Claude
  Code hooks, Spec Kit converge.)
- **No repo state.** No filesystem, no diff base, no AGENTS.md of the target project, no CI
  output. The packet describes a project that lives only in localStorage tabs.
- **No grounded research.** Competitor analysis, scorecard notes, and "research" artifacts are
  template prose with no URLs, no dates, no evidence hashes over sources. An agent that treats them
  as findings will confidently repeat boilerplate as market intelligence.
- **No truthful build status.** P6's "Sandbox: pass" refers to a template self-test, not a working
  application. Nothing in the packet's output schema tells the agent that "generated source" is a
  harness stub, not product code.
- **No model/context reality.** Fixed 14k budget with no rank-to-token allocation (research/01 G8),
  no notion of the receiving agent's own tooling, and no instruction to read reference files
  on demand (research/03 T8 recommends exactly this; RapidTool's own AGENTS.md already uses the
  `.grok/references/` pattern and could teach the packet the same discipline).

### 2.3 Failure modes when an agent consumes a packet naively

| Failure mode | Mechanism | Severity |
|---|---|---|
| **Canned research presented as real** | P7 matrix, memory rows, scorecard notes are template text; the `source:"illustrative"` tag never reaches the packet. An agent asked to "continue after research phase" inherits invented competitor intel. | High |
| **Template artifacts mistaken for spec decisions** | "RRF + cross-encoder re-rank", "MCP + A2A contracts", "cgroups v2 / gVisor isolates" are boilerplate for *any* brief — an HVAC dispatch app gets them too. A compliant agent will over-engineer: building MCP servers the product never needed. The packet contains no "template-derived vs. human-approved" marker on artifacts (only the DoD gate artifact and the P4 text's B-18 honesty clause carry any such signal). | High |
| **Sandbox-pass = code-exists illusion** | P6 gate criteria include `lastTest.ok` — satisfied by the template self-test. An agent told "tests pass" may skip writing real tests. | Medium |
| **Rejection-note false precision** | Regeneration "deltas" are keyword-matched canned lines ("- Data contract revised…"). The agent sees attempt counters and may assume the artifact was substantively repaired. | Medium |
| **Fake-precision scores** | Scorecard /10 and axis notes are formula output from keyword deltas, but read like assessment findings. | Medium |
| **Truncated tail** | >14k packets cut the tail (artifacts/openapi/scorecard) with a visible marker; a naive agent proceeds without the missing sections. | Low (marker exists, but no instruction to request regeneration) |
| **No reply-channel contract** | Nothing tells the agent *how to hand results back* (paste format, file layout, or expected evidence), so the human becomes the integration layer with no parseable artifact. | Medium |

### 2.4 Agent-side verdict

For an agent, packet v2 is useful **as a scope-and-history contract**, roughly useless **as a
content source**. The highest-value lines are: Mission + operator notes, current edge + legal-edge
rule, decision ledger + rejection note, required output schema, and the DoD criteria for the
current phase. The lowest-value, highest-risk lines are the research artifacts, memory prose,
scorecard notes, and any architecture prose that claims the target system has MCP/A2A/gVisor
properties. An agent that consumes the contract and ignores the boilerplate gets a real
head-start; an agent that consumes both gets steered into a fictional architecture. That split —
**contract yes, content no** — must be taught, because nothing in the packet currently teaches it.

---

## 3. Usefulness for a human operator

### 3.1 Where RapidTool is genuinely net-positive for a human

- **Phase discipline and a visible gate rail.** Most humans never write a DoR/DoD down; RapidTool
  makes "what must be true to enter/exit a phase" machine-checkable and visible (dod.ts) and
  refuses illegal skips structurally (`canEnter`, `priorsSealed`). As a *habit-forcing* layer this
  has real value — research/02 §1.1 confirms stage-gate value lives in explicit, pre-agreed
  criteria, and RapidTool now has a per-phase registry (the research/01 baseline's "no published
  DoD" gap G3 is partially closed in current code).
- **A real audit trail.** Append-only decisions with actor (human vs. autopilot), timestamps,
  ≥12-char rejection reasons, per-phase rejection history, gate verdicts with evidence hashes,
  and a JSON diagnostics log. This is the NIST-style "capture overrides and rationale" primitive
  research/02 §10.1 recommends, and it is honest-by-construction (autopilot cannot forge a human
  actor, and forceHuman gates cannot be auto-approved). For compliance-adjacent workflows this is
  the strongest thing RapidTool ships.
- **HITL with friction where it matters.** Mandatory rejection notes, evidence-hash-verifiable
  gate records, forceHuman on failing sandboxes, and stock gates that autopilot can never skip —
  the *governance machinery* is well-designed even where the *content* is thin.
- **The packet is a shareable work product.** Copy/download a version-stamped contract that names
  the phase, the decisions, the constraints, and the expected reply shape. That is more than most
  teams produce before handing work to an AI coder.

### 3.2 Where it wastes the operator's time

- **Cold-start ceremony on canned phases.** P1–P3 and P10–P11 produce boilerplate (dispatcher
  topology, checkpoint plans, MCP contracts, Ollama tiering) for every app, including ones that
  need none of it. The human pays review attention on meta-architecture fiction before the real
  work (spec → build) even starts. For a typical CRUD/utility brief, 7 of 13 phases are noise.
- **Gate-recorded ≠ gate-enforced.** A FAILing DoD still advances. An operator who trusts the rail
  ("it passed P5!") gets false confidence; the gate is a dashboard lamp, not a brake. This is the
  single most important honesty gap for a *human* consumer too.
- **Approval fatigue by design.** Four stock gates + scorecard reframe gates + scheduler extras;
  each approval UI shows no evidence bundle by default (research/02 §10.2 weaker-list item) and
  there is no risk-tiering or rubber-stamp telemetry, so the human oscillates between blind
  approval and deep-dive — exactly the failure mode Monperrus documents.
- **Autopilot is a trap-shaped feature.** It can only skip *non-stock* gates under tightness<7.2,
  which means it mostly runs the boilerplate phases nobody should supervise — yet it gives the
  console an "autonomous run" feel that outruns its actual determinism. The run-until-HITL loop is
  a simulation of autonomy over simulated work.
- **The operator is the integration layer.** Every packet must be pasted into a real agent, the
  reply pasted back, notes transcribed. No import/export of project state, no agent-report intake
  field, no JSON envelope. Multi-hour runs live in localStorage and die with one cache clear
  (research/01 M1/G1: durability gap unchanged).
- **No execution feedback ever re-enters the graph.** The scorecard, DoD, and memory never hear
  about what the external agent actually built or whether tests really passed, so the console
  *cannot learn* — it can only re-simulate with new text.

### 3.3 Plain answer: useful or toy?

**Not a toy — but it is a governance-and-contract console, not an agentic builder, and its
usefulness is conditional.** It is net-positive when ALL of these hold:

1. The operator wants **spec-before-code discipline and an audit trail** for work that will
   actually be executed by a real external agent (paste-packet workflow).
2. The operator understands that **artifact text is scaffolding, research is illustrative, and
   DoD is advisory** — i.e., uses the console for *structure and history*, not *facts*.
3. The brief is a real software build (complexity where 13 phases of thought add value), not a
   toy or one-shot scaffold.
4. The operator is willing to be the integration layer (or the app gains the import/export +
   reply-intake artifacts proposed in §6.2).

It wastes time when: the brief is trivial (ceremony >> value); the operator expects autonomy or
real research; the artifacts are treated as spec truth; or no external agent is ever used (the
console alone produces zero runnable software — its "code generation" is a template self-test).
**Verdict: conditionally useful, honestly scoped — provided the honesty markers are extended from
the engine internals into the packet prose itself** (the biggest single fix; §6.3).

---

## 4. Competitive grading

Method: RapidTool and 12 competitor classes, 9 dimensions, scored 1–5 (5 = best). Scores
synthesize the cited research dossiers; vendor-marketing claims were treated as unverified
(research/01 §2 method rules). RapidTool scored against its *intended job* (governed pre-flight +
agent handoff), not as a coder — dimensions where it has no execution are honestly low.

### 4.1 Score matrix

| Competitor | Spec quality | Governance/HITL | Audit trail | Build capability | Research honesty | Agent-handoff format | Human UX | Learning curve (5=easy) | Uniqueness |
|---|---|---|---|---|---|---|---|---|---|
| **RapidTool** | 3 | 4 | 4 | 1 | 2 | 4 | 3 | 4 | 5 |
| Claude Code | 3 | 3 | 2 | 5 | 4 | 3 | 4 | 4 | 2 |
| OpenAI Codex | 2 | 3 | 2 | 5 | 4 | 3 | 4 | 4 | 2 |
| Devin | 3 | 2 | 3 | 4 | 2 | 2 | 3 | 3 | 3 |
| Aider | 1 | 1 | 3 | 4 | 4 | 1 | 3 | 5 | 1 |
| CrewAI | 2 | 2 | 2 | 3 | 3 | 4 | 2 | 3 | 3 |
| MetaGPT | 4 | 1 | 1 | 2 | 2 | 2 | 2 | 2 | 3 |
| gpt-pilot | 2 | 2 | 2 | 3 | 2 | 1 | 2 | 2 | 2 |
| ChatDev | 3 | 2 | 3 | 3 | 2 | 2 | 2 | 2 | 3 |
| Spec Kit | 4 | 3 | 3 | 3 | 4 | 4 | 3 | 3 | 3 |
| Cursor | 2 | 2 | 1 | 4 | 3 | 2 | 5 | 5 | 1 |
| LangGraph platforms | 3 | 4 | 4 | 3 | 3 | 4 | 2 | 1 | 4 |
| Factory / Genie | 3 | 3 | 3 | 4 | 2 | 2 | 3 | 3 | 3 |

Sources for competitor facts: research/01 §3 one-pagers (Claude Code §3.12 L132–145; Codex §3.18
L175–179; Devin §3.13 L146–150; Aider §3.2 L48–55; CrewAI §3.9 L108–116; MetaGPT §3.3 L56–64;
gpt-pilot §3.5 L79–86; ChatDev §3.4 L65–78; Spec Kit §3.16 L162–168; Cursor = market row in
research/01 §1 + engine competitor tables; LangGraph §3.8 L100–107; Factory/Genie §3.19 L180–185)
and research/01 §5 gap table L467–495, research/02 §1/§10.

### 4.2 Per-dimension justification (2–4 sentences each)

- **Spec quality** — RapidTool earns 3: deterministic lattice/schedule/spec-graph/contract/oracle
  scaffolding is real pre-build structure, but it is lexicon-derived and template-heavy, so depth
  is low. MetaGPT and Spec Kit score 4 because their intermediate documents (PRD → design → tasks;
  specify → plan → tasks → converge) are the *actual industry bar* for spec quality (research/01
  §3.3, §3.16); Spec Kit additionally runs consistency analysis across artifacts. Aider scores 1:
  it deliberately carries no spec layer at all.
- **Governance/HITL** — RapidTool and LangGraph lead at 4: RapidTool because gates are structurally
  enforced (no skips), stock gates are human-only, rejection requires a reason, and autopilot is
  bounded by forceHuman; LangGraph because `interrupt()`/`Command(resume)` give *dynamic mid-node*
  HITL with typed payloads (research/01 §3.8) — the primitive RapidTool's static phase-modal gates
  cannot express (gap G2). Claude Code (3) has permission modes and stop hooks but no decision
  journal; MetaGPT (1) has no gates at all.
- **Audit trail** — RapidTool at 4 for the append-only ledger + actor-stamped decisions +
  rejection history + gate evidence hashes + JSON logs; LangGraph/Temporal-class systems at 4 via
  durable event-sourced checkpoints and time travel (research/01 §3.8, §3.10). Note RapidTool's
  FNV-1a hashes are non-cryptographic and localStorage is fragile — 5 would require durable,
  tamper-evident history. Cursor at 1: chat history, not governance records.
- **Build capability** — Claude Code/Codex/Cursor at 4–5 execute real multi-file edits in real
  repos with verification loops; Devin at 4 with PR/CI pickup (vendor claims, §3.13); Aider at 4
  git-native edit+lint/test. RapidTool at 1: it runs only its own template self-test; nothing it
  produces is runnable software until an external agent executes the packet. This is the honest
  floor of the whole comparison.
- **Research honesty** — Claude Code/Codex/Aider/Spec Kit at 4: web-grounded, URL-cited, or
  verify-by-running cultures. RapidTool at 2: canned P7 matrix + scorecard prose presented as
  findings, with illustrative markers trapped in the state model and never rendered into the
  packet; the reframe gate and vague flag exist but do not reach consumers. Devin/Factory/Genie at
  2 (vendor marketing; DeepWiki/knowledge claims unverified per research/01 §3.13/§3.19).
- **Agent-handoff format** — RapidTool at 4 for a version-stamped, self-describing, paste-ready
  markdown contract with a reply schema — more than most tools ship; Spec Kit at 4 for
  checked-in spec files consumed by 30+ agents; CrewAI/LangGraph at 4 for JSONC configs and typed
  graph state (process-as-data, research/01 G13). Aider at 1: no handoff concept, which is fine
  for its direct-edit model. RapidTool's format loses points because it is prose-only with no JSON
  envelope (research/03 T8 hybrid recommendation) and no A2A/ACP interchange (research/01 §3.17,
  gap G19).
- **Human UX** — Cursor at 5 (in-IDE, instant); Claude Code/Codex at 4 (terminal + permission
  modes, low ceremony); RapidTool at 3: a clean tabbed console, but no evidence bundles at gates,
  no risk-tiered approvals, no rubber-stamp telemetry (research/02 §10.2 weaker-list) and 13
  phases of click-through. LangGraph at 2: developer framework, not an end-user product.
- **Learning curve (5 = easiest)** — Cursor/Aider at 5 (minutes); RapidTool at 4: the console is
  simple, but *using it well* requires learning the packet→external-agent loop and the
  contract-vs-content distinction; that hidden curriculum is real. LangGraph at 1: typed state,
  reducers, checkpointer, interrupts is a serious platform commitment.
- **Uniqueness** — RapidTool at 5 in this field: no competitor ships a *deterministic,
  zero-LLM, governed pre-flight that compiles a decision-ledger-carrying prompt contract for other
  agents to execute*. LangGraph (4) is the closest philosophical cousin but is an execution
  platform, not a governance console. MetaGPT/ChatDev/CrewAI duplicate the role/SOP idea with real
  LLMs but no human-governance layer; Spec Kit duplicates spec-led process but lives inside
  agents, not around them. Cursor/Codex/Claude Code are executors, not governors — which is
  exactly why RapidTool is a complement, not a competitor, for most of them.

### 4.3 Overall positioning

- **Where RapidTool wins (the defensible niche):** deterministic governed pre-flight and
  prompt-contract compilation with a real HITL decision ledger, rejection-loop memory, advisory
  but machine-checkable DoD records, and honest actor attribution. No execution competitor offers
  a *governance shell you can place in front of any* executor (Claude Code, Codex, CrewAI, Spec
  Kit flows, …). The console is tool-agnostic by construction — its packet is the interchange
  layer, and the research baseline (research/01 §3.12/§3.18) confirms both Claude Code and Codex
  are happy to consume exactly such governed instructions.
- **Where RapidTool loses (and must stop pretending otherwise):** any dimension requiring real
  execution, live research, or a feedback loop. It cannot build, test, or deploy anything; its
  research is illustrative; its gates do not block; its runs are not durable. Competing head-on
  with Devin/Codex/Cursor on "who builds the app" is a guaranteed loss — competing on "who
  governs the build and hands the baton" is currently uncontested.
- **Three-sentence position:** RapidTool is a *governed pre-flight and handoff compiler for
  agentic coding*, not an agentic coder: it makes phase discipline, human decisions, and exit
  criteria explicit, durable-in-text, and paste-able, then steps aside while a real agent builds.
  Its moat is the decision ledger + rejection loop + version-stamped packet — governance memory
  that no executor natively keeps. Its existential risk is that every artifact it produces is
  simulation-grade text, so the entire product reduces to the honesty of its labels; the fix is
  therefore labeling (§6.3), integration artifacts (§6.2), and enforcement options (gate-as-brake)
  rather than more features.

---

## 5. Agent-guide protocol inputs

This section is written to be lifted almost verbatim into two places: an `AGENT_GUIDE.md` in the
repo (exact numbered outline in §5.3) and the consumption rules an external agent should follow
when handed a packet v2.

### 5.1 How an AI agent SHOULD consume a RapidTool packet v2 (the protocol)

**Parse order (front-loaded contract first, content last):**

1. `## System` block — packet version, project id, compiled_at, the legal-edge sentence ("You may
   only work the current phase…"), and prohibitions (no illegal jumps, no unsigned deploys, no
   invented APIs). These are the only *binding* rules in the packet.
2. `## Mission` + `## Operator notes` — mission is the goal; operator notes **override** all
   earlier instructions (the packet says so itself; treat them as highest-priority steering).
3. `## Current edge` — the phase you are actually asked to work, its summary, status/model line,
   execution claim, and the `PENDING HITL` block if any. If a HITL is pending on the current
   phase, **your first deliverable is a recommendation for that gate, not phase work**.
4. `## Decision ledger (HITL)` + `## Rejection loop` — read every row before planning. Rules:
   - Approvals are facts about *history*: the human accepted the phase's plan. Do not re-open
     approved decisions unless new evidence demands it — and if it does, say so explicitly in
     `Risks`.
   - **Rejections are constraints**: the note is the human's actual complaint; the attempt
     counter tells you how many times the human has already been dissatisfied. Treat the *note*
     as the requirement. Do NOT treat the artifact's "Deltas applied this regeneration" block as
     proof the complaint was addressed — those lines are keyword-matched boilerplate; verify
     against the note yourself.
   - If `decidedBy: autopilot` appears on a stock phase (P4/P5/P8/P9) it is a contradiction of the
     engine's own rules — flag it in Risks.
5. `## Required output schema` — the reply contract. Follow it exactly (Phase work / Files /
   Patch / Tests / Risks / Next legal edge). Your turn ends with a verdict on whether the phase's
   DoD criteria (see the gate artifact or the phase criteria implied by the scorecard + oracle)
   are met by your patch — do not claim completion otherwise.
6. **Then and only then** read the reference sections in this order: `## Intent lattice` →
   `## Scheduler` → `## Contracts` → `## Oracle` → `## Spec graph order` → `## Crew`. These
   constrain your plan (entity names, endpoint verbs, test expectations, file ownership).
7. `## Artifacts (trimmed)`, `## Ranked memory`, `## Scorecard`, ADRs, OpenAPI — **read as context,
   never as ground truth** (rules below).

**Honesty rules for template-derived content (the contract-vs-content split):**

- Artifacts whose titles match phase boilerplate (Dispatcher topology, MCP + A2A contracts,
  Isolation policy, Adversarial suite, Tiered inference, Live search MCP binding, GitHub Actions
  workflow, Interface contract, ADRs) are **engine-authored template prose** derived from your
  brief's keywords. Treat them as *suggested scaffolding*, not decisions, unless a decision-ledger
  row or operator note explicitly approved them. If a template artifact contradicts the brief,
  the brief wins — say so in Risks.
- Competitor/research artifacts and scorecard axis notes are **illustrative placeholders** (the
  engine tags them `source: "illustrative"` internally). Never cite them as market research; if
  your phase requires real competitive intelligence, perform it live and report URLs.
- The `Execution:` line ("Engine-template runner…") means RapidTool itself ran only a bounded
  self-test module. A `Sandbox: pass` line is **not** evidence that product code exists or works.
- A `…[TRUNCATED]` marker means the packet exceeded 14k chars; request the full tail sections
  (artifacts/scorecard/openapi) before finalizing a plan that depends on them.
- DoD gate records are **advisory**: a recorded PASS means artifact-presence probes fired, not
  that a human verified quality. Your phase work is what actually earns completion.

**Exit-criteria behavior:** map the phase's DoD criteria (visible in the `gate` artifact and
implied by the scorecard verdict + oracle rows) onto your Required-output-schema reply. If your
patch would leave a criterion unmet (e.g., P6: no real test run), say so in `Risks` and propose
the HITL/next-edge handling — do not silently advance, and do not claim a gate the console will
record as FAIL as if it were a PASS.

### 5.2 Integration artifacts the app should offer (concrete list)

| # | Artifact | What it is | Why |
|---|---|---|---|
| I1 | **Packet export to file at every gate** | Auto-download `packet-<phase>.md` whenever a phase parks on HITL or completes (manual download + copy already exist; make it automatic + named with phase/timestamp) | The audit trail is currently invisible outside the tab; the packet is the only durable artifact and should be produced at every resting point. |
| I2 | **Project JSON export/import** | Full `Project` state dump/restore (versioned `_v` marker), file-based | localStorage dies; operators need portability, backup, and the ability to move a run between machines/preview hosts. |
| I3 | **Per-phase handoff prompts** | A 4–8 line "advance prompt" per phase: *"Continue governed build X. You are at P5 (Validation). Packet below. Reply per its output schema. Do not touch P6."* | Pasting a 14k packet into a chat CLI every phase is operator friction; short prompts + one reference to the packet file make the loop usable. |
| I4 | **Deep links** | Hash/anchor links per phase, gate, and decision: `/run/<id>#p9-gate`, `/run/<id>#decision-<n>` | Auditability requires *pointing at* a decision/gate, not describing it. |
| I5 | **Audit bundle export** | Per phase: gate verdict + evidence hash + decision rows + artifacts snapshot + diagnostics, zipped/markdown | Turns the ledger into a compliance deliverable; pairs with I1. |
| I6 | **Agent report intake** | A textarea/upload for the external agent's reply, plus a lightweight validator: headings present per output schema, oracle rows addressed, files listed | Closes the loop *at least manually*: the console can record "P6 reply received, tests claimed pass" into the log/memory so the next packet knows the handoff happened. |
| I7 | **Machine envelope (packet JSON sidecar)** | Alongside the markdown packet, a small JSON: `{meta, mission, constraints, output:{schema}, ground:[]}` | Research/03 T8: prose for judgment, JSON for tooling. Enables I6 validation and future A2A-style interchange (research/01 §3.17). |
| I8 | **AGENTS.md emission (G9/G20)** | When P6–P12 complete, emit an `AGENTS.md` for the generated project (30+ tools consume the format) | Downstream agents self-govern instead of relying on re-pasted packets (research/01 §3.16). |
| I9 | **Label pass on packet prose** | Render `source:"illustrative"`, "template-derived", and "advisory gate" markers into artifact/memory/scorecard text inside the packet | The single cheapest honesty upgrade; currently markers exist in state but vanish in the compiled contract (§2.3). |

### 5.3 Exact contents of an `AGENT_GUIDE.md` in the repo (numbered sections)

1. **What RapidTool is and is not** — one paragraph each: governed pre-flight + packet compiler;
   not a coder, not a research tool, not an execution sandbox. Redirect claims to §3.
2. **The packet v2 contract** — anatomy table of the 16 sections; which are binding (System,
   Mission, Operator notes, Current edge, Required output schema), which are steering (ledger,
   rejection loop, lattice, scheduler, contracts, oracle, spec graph, crew), which are context
   (artifacts, memory, scorecard, ADRs, OpenAPI).
3. **The 13 phases and their DoD** — phase table with code/title/HITL flag + the DoD probe list
   per phase (mirror dod.ts) + the advisory-gate warning.
4. **HITL protocol** — what gates exist, what approve/reject mean, the ≥12-char rule, actor
   attribution (human vs autopilot), forceHuman cases, what the decision ledger records.
5. **Decision ledger & rejection-loop semantics** — approvals = history, rejections = constraints;
   attempt counters; keyword-delta boilerplate caveat.
6. **Contract vs. content discipline** — template-derived artifact list (by title/kind), the
   illustrative-competitor rule, sandbox-pass meaning, truncation marker handling. The honesty
   core of the guide.
7. **Parsing order** — the §5.1 sequence as a numbered checklist.
8. **Reply contract** — the Required output schema, expanded: what each of the 6 headings must
   contain, DoD-mapping expectations, when to say "gate would FAIL".
9. **Phase-by-phase agent instructions** — P0–P12: what the external agent actually must produce
   at each phase (P0: real research + scorecard evidence; P6: real code + real tests; P7: live
   competitive matrix with URLs; P8: runnable UI preview; P9: CI files only after HITL; …).
10. **Handoff & loop mechanics** — how to return work (paste format, file layout, evidence
    hashes of produced artifacts if re-imported), what the operator does next, when to request a
    fresh packet (after every gate/decision).
11. **Honesty obligations of the agent** — never claim tests run that you did not run; never
    present template research as verified; flag contradictions between brief and artifacts; list
    HITL-triggering risks explicitly.
12. **Integration artifacts** — where exported packets/bundles/JSON live and their naming
    (I1–I9).
13. **Known limitations** — localStorage-only state, advisory gates, template sandbox, no live
    feedback loop, FNV-1a (non-cryptographic) hashes; what to do when each bites.
14. **Tool-specific notes** — Claude Code (CLAUDE.md interplay, hooks as gate enforcement),
    Codex (AGENTS.md consumption), CrewAI (map packet sections onto crew/task JSONC), Spec Kit
    (converge loop as P5/P7 closure) — one short paragraph each.
15. **Glossary & version markers** — packet_version, `_v`, source kinds, gate evidence hash
    format, rejection delta vocabulary.

---

## 6. Conditions for net-positive use — summary verdict

| Condition | Net-positive? | Notes |
|---|---|---|
| Brief is a real software build; operator wants governed handoff to a real agent | **Yes** | The intended use; packet + ledger genuinely add structure and memory that raw briefs lack. |
| Operator treats artifact text as scaffolding and DoD as advisory | **Yes** | Requires the labeling pass (I9) to be safe at scale; today it relies on operator savvy. |
| Compliance/audit context (who decided, when, why) | **Yes** | Decision ledger is the standout deliverable; pair with I5 audit bundles. |
| Trivial/toy briefs | **No** | 13-phase ceremony dominates; use a raw prompt. |
| Expectation of autonomous building or real research | **No** | Console produces no runnable software and no verified intel; pairing with Devin/Codex expectations will disappoint. |
| Sole persistence = localStorage, runs must survive weeks | **No (today)** | Adopt I2 + I1; durability is the load-bearing gap (research/01 G1). |

**Bottom line:** RapidTool is genuinely useful as a *deterministic governance shell + prompt-contract
compiler* that standardizes spec-before-code, captures human decisions with reasons, and hands a
scoped, history-carrying contract to real coding agents — a niche none of the 12 graded
competitors occupies. It is a toy only if judged on the dimensions it deliberately does not
implement (build, research, execution). Its two non-negotiable debts: (1) make the honesty labels
visible in everything a human or agent reads (I9 + AGENT_GUIDE §6), and (2) decide whether gates
are lamps or brakes — advisory DoD recorded as PASS/FAIL next to an advancing pipeline is the one
feature most likely to mislead its own users.

---

## 7. Evidence & caveats

- Code evidence paths (read at review time): `src/lib/{packet,phases,dod,types,engine,store,
  algorithms,sandbox,templates}.ts`, `src/components/console.tsx`, `src/routes/{index,run.$id}.tsx`.
- Research dossiers: `research/01_parallel_repos_research.md` (baseline §1 L7–25; one-pagers §3
  L35–218; mechanisms §4; gap table §5 L467–495; borrow list §6), `research/02_industry_sdlc_
  grading_research.md` (stage-gate §1; approval fatigue §10 L703–765), `research/03_tech_deep_
  dives_research.md` (T8 packet structure L488–566).
- Staleness caveat: research/01's baseline snapshot predates current code in places (it reports
  "no unit tests", "reframe unreachable", "no DoD registry" — all since remediated: `*.test.ts`
  suites exist, reframe HITL exists, dod.ts gate registry + DoR exist). Claims about RapidTool in
  this review were verified against source, not the dossiers, and discrepancies are noted inline.
- Competitor scores inherit the dossiers' evidence rules: open-source claims from repos, framework
  claims from docs, SaaS claims flagged as vendor marketing (Devin, Factory/Genie, Codex Web).
- Limitations of this review: no live hands-on runs of RapidTool UI; static reading of ~10 core
  modules + research dossiers; no external-agent end-to-end test of a real packet (recommended as
  the next validation step before AGENT_GUIDE.md is finalized).
