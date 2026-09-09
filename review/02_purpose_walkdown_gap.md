# 02 — Purpose Walkdown & Capability Gap Analysis

> **What RapidTool actually is, how it works front to back, and what it does
> and doesn't do against its own master vision.**
>
> Method: direct reads of the product source at
> `C:/Users/mnril/Desktop/RapidTool Main/` (src/lib/*, src/components/console.tsx,
> src/routes/*), the vision document (`attachments/RapidTool_Complete_Master.md`),
> `AGENTS.md` / `AGENTS.project.md`, and agentnotes.md Parts 0–1. Every claim
> below is grounded in a file:line reference or a direct quote. Nothing here is
> inferred from screenshots alone. Companion files: `audit/01..03` (per-domain
> audits), `proposals/01..03`, `research/01..03`.

---

## 0. TL;DR — the one-paragraph answer

RapidTool is a **client-side, browser-only "governed delivery" console**: a
human operator pastes a software brief, and the app walks that brief through a
deterministic 13-phase graph (P0 Deep Research & Feasibility → P12 Docs) whose
phases are synthesized by **pure, deterministic TypeScript functions** (no LLM,
no network), gated at P4/P5/P8/P9 by human approval docks, and compiled at every
step into a **paste-ready "Agent Packet"** markdown document intended to be
handed to a *real* AI coding agent elsewhere. Everything the "agency" claims to
do — research, architecture, code generation, sandboxed testing, market
analysis, CI/CD — is **simulated by template-and-lexicon algorithms** that
produce honest, self-labeled artifacts; the actual intelligence is the
**operator** (who writes notes and approves/rejects) and the **downstream agent**
(who receives the packet). The product is a *spec-and-governance workbench with
an agency costume*, not an autonomous software factory. Its own code is
scrupulously honest about this (e.g. `source: "illustrative"` competitor rows,
`sandboxClaim()` text in the P4 artifact, the `"sync-template"` runtime label);
the marketing copy on the landing screen is what over-promises.

---

## 1. Purpose: what the product is FOR

### 1.1 The vision it claims to implement

`attachments/RapidTool_Complete_Master.md` is a **system-role directive for an
autonomous AI agent** (written as if to an LLM: "You are RapidTool, an
autonomous AI agent engineered to rapidly research, architect, design, and
develop new software applications…"). It promises, per phase:

| Phase | Vision promise |
|---|---|
| P0 | Deep-dive domain landscape, SOTA libraries, competing architectures, feasibility/security analysis; structured scorecard *before code* |
| P1 | Real orchestration: `LlmAgent` intent nodes, `WorkflowAgents`, dispatcher `transfer_to_agent`, LiteLLM failover |
| P2 | Durable checkpointing, hierarchical episodic/semantic/procedural memory, RRF + cross-encoder re-ranking |
| P3 | MCP client abstraction, FastMCP microservices, A2A v1.0, async WebSocket tool streams |
| P4 | Process isolation (cgroups v2 / gVisor / WASM, 256 MB / 30 s), user-level OAuth on every tool call |
| P5 | HITL with mandatory qualitative feedback, adversarial verification, structured JSON diagnostics |
| P6 | Pydantic-constrained code synthesis, isolated sandboxed execution, self-healing refactor loops, PR self-review |
| P7 | RAG ingestion of docs/papers/GitHub, competitive matrix, feasibility/risk scoring |
| P8 | Component-based UI generation (React/Vue/Tailwind), live canvas preview, HITL layout approval |
| P9 | Generated CI/CD (GitHub Actions), IaC for GCP/Firebase, GPU allocation scripts |
| P10 | Tiered inference: local open-weight models (Ollama) for draft/format, sync back to orchestrator |
| P11 | Live search MCP (Brave), dynamic tool binding mid-run |
| P12 | Automatic ADRs, OpenAPI + DB schemas, frontend/backend parity |

### 1.2 What the product actually is

The delivered app (TanStack Start + React 19 + Tailwind v4 + zustand, scaffolded
in an xAI Grok "App Builder" workspace — see AGENTS.md platform rules) is a
**faithful, deterministic *simulation* of that directive's *governance shell***:
the phase graph, the scorecard verdicts, the gates, the memory types, the crew
roster, the artifacts, and the paper trail all exist as real, inspectable data
structures — but every "cognition" step is a pure function over the brief
string. The product is built **entirely from local heuristics**:

- `intentLattice()` matches the brief against a hardcoded lexicon of actor/job/
  object/constraint/risk words (`src/lib/algorithms.ts:24-111`).
- `feasibilityScorecard()` computes five axis scores and a verdict from
  arithmetic on lattice complexity + constraint counts (`algorithms.ts:554-603`).
- Competitor rows are **template rows per domain**, explicitly flagged
  `source: "illustrative"` (`engine.ts:25-52`, comment at :50).
- P6 "code generation" emits a **bounded engine-authored test module** from a
  fixed template (`src/lib/sandbox.ts:49-85`, `buildPhase6Module`), never code
  for the user's actual brief-domain.
- The one real LLM call that exists — `src/lib/ai.ts` `enrichBrief`, a server
  function POSTing to `api.x.ai` with `XAI_API_KEY` — is **orphaned**: no
  component or store function imports it (verified: zero references outside
  ai.ts itself). The app runs with zero LLM traffic and zero network calls.

### 1.3 Who uses it (the real operating model)

**Primary user: a human operator / delivery lead** — someone who takes a client
brief, wants to (a) get a structured, scored read on feasibility before any code
is committed, (b) see a file-level build order + data contracts + test oracle
drafted for that brief, (c) consciously approve high-stakes boundaries
(security policy, validation contract, UI lock, deploy routing), and (d) leave a
rejection/steering trail that a downstream implementer can actually read.

**Secondary "user": the downstream AI agent** — explicitly designed-for: the
Agent Packet (`src/lib/packet.ts`) is a version-stamped markdown handoff whose
`## System` section addresses "a governed implementation agent for RapidTool"
and whose `## Required output schema` demands `Phase work / Files / Patch /
Tests / Risks / Next legal edge`. The packet is the product's real output
surface: copied to clipboard or exported as `.md` (`console.tsx:358-369, 553-578`).

**What it is NOT for:** end-to-end autonomous delivery inside the app. Nothing
in the app writes real files, runs real tests against real code, talks to
GitHub, deploys, or calls a model.

---

## 2. Front-to-back walkdown: data flow from brief to finished packet

### 2.1 Domain vocabulary (terms used below)

- **Project** — the single persisted unit: brief, domain, status, currentPhase,
  13 `PhaseRecord`s, scorecard, competitors, artifacts[], memory[], logs[],
  pending hitl, decisions[], lattice, schedule, traces[], packet, specGraph,
  contracts, oracle, crew, notes, generatedSource, lastTest, sandbox policy,
  openapi, adr (`src/lib/types.ts:187-226`).
- **PhaseRecord** — `{ id, status, startedAt?, completedAt?, rejectionNote?,
  rejectionHistory?, gate? }`; status ∈ locked | ready | running |
  awaiting_hitl | complete | rejected (`types.ts:103-113`).
- **Artifact** — `{ id, phase, kind, title, body, language? }`; kind ∈
  scorecard | graph | memory | mcp | security | validation | code | research |
  ui | cicd | edge | tools | docs | packet | algorithm | gate (`types.ts:15-40`).
- **Algorithm trace** — `{ id: A1..A8, name, ranAt, summary }` (`types.ts:140-145`).
- **HitlDecision** — append-only journal row `{ phase, title, decision,
  note?, decidedBy: human|autopilot, requestedAt, decidedAt }` (`types.ts:92-101`).

### 2.2 Step 0 — Intake (landing screen)

1. Operator types (or picks one of four template pills: Field dispatch / Shop
   quoting / Clinics / Marketplace — `src/lib/templates.ts`) a **client brief**
   ≥ 12 chars (`console.tsx:158, 205`; button disabled below that).
2. `Open intake` → store `create(brief)` (`src/lib/store.ts:190-200`) →
   `emptyProject()` (`src/lib/engine.ts:934-997`):
   - `inferDomain(brief)` — stemmed keyword vote over 9 domain vocabularies,
     default `custom-software` (`engine.ts:63-96`).
   - `inferName(brief)` — first-sentence, first-4-words Title Case
     (`engine.ts:98-105`).
   - 13 `PhaseRecord`s: P0 `ready`, P1–P12 `locked` (`engine.ts:947-950`).
   - `sandbox.runtime = "sync-template"`, timeout 30 s, `isolated: true`
     (`engine.ts:967-974`); `modelRoute: "local-edge"`; `_v: 2`.
3. Immediately `attachAlgorithms(base)` runs **A1, A3, A5, A6, A7, A8** once
   (`engine.ts:990`; algorithm firing order recorded in `traces[]`): this is the
   **priming pass** — the lattice/schedule/specGraph/contracts/oracle/crew
   exist *before* any phase runs. Then `bootstrapMemory()` writes three
   memory rows (semantic 0.8 / procedural 0.95 / episodic 0.7) and the packet
   is compiled once (`engine.ts:991-996`, `algorithms.ts:523-547`).
   → A project exists in state with `status: "intake"`, `currentPhase: 0`.

### 2.3 The transform chain (which algorithm feeds what)

- **A1 Intent Lattice** (`intentLattice`, algorithms.ts:145-192): brief tokens
  vs. lexicon → weighted nodes (actor/job/object/constraint/risk), and derived
  `jobs[]`, `entities[]`, `constraints[]`, `complexity 1-10`, plus a **`vague`
  honesty flag** = true when neither jobs nor entities matched brief vocabulary
  (fallbacks `deliver-core-workflow` / `operator, record` are then injected,
  algorithms.ts:182-190). Health-ops briefs get hipaa/phi nodes force-injected
  (:170-175). **Output lands on** `project.lattice`, rendered as chips and as
  the `P0 · algorithm · Intent Lattice (A1)` JSON artifact (`engine.ts:265-271`).
- **A3 Constraint Scheduler** (`scheduleConstraints`, algorithms.ts:255-275):
  domain risk table + constraint load → `securityDelta`, `apiDelta`,
  `tightness`, and **`extraHitl[]`** (adds P6 when securityΔ≥2 or hitlBias;
  adds P11 when apiΔ≥2) — this is the mechanism that can raise *additional*
  HITL gates beyond the stock four. Output lands on `project.schedule`.
- **A5 Spec Graph** (`planSpecGraph`, algorithms.ts:317-365): fixed 5+ node
  topology (schema → api, store; job-N per job; ui; tests) with a real Kahn
  topological sort that **throws on cycles** (:310-312). Output lands on
  `project.specGraph` (nodes + `order`), consumed by the Spec graph tab and the
  packet's `## Spec graph order (A5)`.
- **A6 Contract Synth** (`synthesizeContracts`, algorithms.ts:397-426): entity
  names from lattice entities+jobs (≤6), each matched to a **copied** field
  bank row (job/patient/invoice/order/default) by stemmed token; endpoints from
  jobs (GET when job matches report|search|track, else POST). Output lands on
  `project.contracts`, consumed by the Oracle tab footer and packet.
- **A7 Test Oracle** (`buildTestOracle`, algorithms.ts:429-454): one
  happy-path case per job, one constraint-violation case per constraint (≤3),
  plus the invariant `graph.no-skip` case. Output lands on `project.oracle`.
- **A8 Crew Router** (`routeCrew`, algorithms.ts:478-521): four seats
  (architect/implementer/reviewer/tester) with mandates, tool chips, token
  budgets (tightness ≥ 7 shrinks budgets), handoffs — and **`active` derived
  from an explicit phase→roles table** (`ACTIVE_BY_PHASE`, :461-475: P0-P3,7 =
  architect; P4,9,12 = reviewer; P5 = reviewer+tester; P6 = implementer+tester;
  P8,10,11 = implementer). Output lands on `project.crew`.
- **A2 FusionRank** (`fusionRank`, algorithms.ts:214-252) is deliberately NOT
  in the priming pass (`runAlgorithms`, :616-617 comment): its single consumer
  is the packet compiler, which re-runs it at compile time over the packet
  context query (packet.ts:20-24). Kind-partitioned lexical-overlap + prior
  score blend with an RRF-flavored rank term — a **simulation** of multi-retriever
  RRF (code comment at :204-212 says real multi-retriever RRF is deferred).
- **A4 Agent Packet** (`compileAgentPacket`, packet.ts:16-180) — see §2.7.
- A2/A4 therefore have no stored "run" side effect except the trace row and the
  packet artifact (A4 trace appended in `attachAlgorithms`, engine.ts:714-721).

### 2.4 Phase execution (the state machine)

Store API (`store.ts:181-400`): `execute(id)` runs exactly one step;
`runUntilHitl(id)` loops steps until hitl/complete/blocked/error with a
graph-derived cap `(13 − currentPhase) × 2 + 2` (:219-221, B-24); `approve`,
`reject`, `retry`, `clone`, `remove`, `rename`, `setNotes`, `refreshPacket`.

`advanceOnce` (store.ts:109-140) is the single-step kernel:
- `blocked` + rejected phase → hard stop ("retry with the note applied").
- `locked` → error.
- `awaiting_hitl` → either `canAutopilot` approves silently, or stop ("Waiting
  on human approval").
- `complete` → **only** advance if `canEnter(from, to)` (to === from+1,
  phases.ts:118-120) **and** `priorsSealed` (every phase below target is
  complete, phases.ts:122-128). Illegal jumps are rejected with explicit errors
  ("Illegal transition", "P# must stay sealed") — the *graph lock* is real code.
- else `runReady(phase)`.

`runReady` (store.ts:142-179): marks phase `running`, calls
`applyPhaseResult` (engine.ts:729-798), then `recordGate` — a **machine-
checkable DoD verdict** (see §2.6) — then either auto-advances to the next
phase (`ready`) and re-stamps the packet, or parks at `awaiting_hitl` /
`complete` / `blocked`.

### 2.5 What each phase *produces* (synthesizePhase, engine.ts:189-702)

Each case builds its artifacts, memory rows, logs, and optionally a `hitl`
request. Run in sequence (all deterministic):

- **P0** — computes scorecard (5 axes + verdict + bottlenecks + attack vectors
  + libraries), writes the `Feasibility & Architecture Scorecard` artifact and
  the A1 JSON artifact; memory: episodic brief ingestion (0.91) + semantic rule
  (0.97); log `scorecard.ready`. **If verdict is `reframe`** → a P0 HITL gate
  "Reframe the brief" is raised (engine.ts:287-295) — feasibility gates the
  graph at P0 itself. (DoD: scorecard ≥5 axes + proceed verdict + ≥1 job.)
- **P1** — `Dispatcher topology` text artifact (root coordinator, workflow
  nodes, LiteLLM failover, transfer rules), procedural memory 0.99.
- **P2** — `Checkpoint + retrieval plan` artifact; semantic + episodic memory
  rows (0.94/0.88). (DoD requires all three memory kinds present — satisfied by
  bootstrap + P0/P1 rows.)
- **P3** — `MCP + A2A contracts` JSON artifact (brave.search / repo.fs /
  sandbox.exec servers, a2a v1.0, WS progress frames); procedural memory.
- **P4 (HITL)** — `Isolation policy` artifact whose last line is the honest
  claim: `Implementation today: ${sandboxClaim(...)}` (engine.ts:401) — the UI
  says "Wasm · 256MB"; the artifact says the executor is an engine-template
  runner. Raises HITL `Approve isolation policy` (high stakes).
- **P5 (HITL)** — `Adversarial suite + HITL contract` artifact (4 simulated user
  paths), raises HITL `Approve validation contract`.
- **P6** — the only phase with an *execution* step: `buildPhase6Module` emits a
  template JS module over the lattice jobs (variant 0/1 chosen by
  `fnv1a(rejectionNote)+attempt % 2`, engine.ts:449-450), then
  `runGenerated(code)` executes it synchronously (sandbox.ts:5-27: regex-blocked
  primitives; source must start `const JOBS = [` and contain `test_no_skip`,
  else refused; new Function in isolated scope runs test_happy + test_no_skip).
  On failure, `healSource` (sandbox.ts:29-34) patches in the missing
  `test_happy` once and re-runs — the **self-healing loop is real but template-
  scoped**; a second failure logs `heal.noop` and refuses a blind identical
  re-run (engine.ts:453-471, B-07). Artifacts: `Typed synthesis module`
  (javascript) + `Sandbox result` (json). Logs `tests.pass` / `tests.fail`.
  **HITL escalation**: if the scheduler's `extraHitl` includes 6 *or* the test
  failed → HITL `Approve generated module` / `Sandbox failed — review` with
  **`forceHuman: true` on failure** (engine.ts:461-503) — autopilot can never
  approve a failing sandbox (store.ts:101-107, 272-285; requires an explicit
  "I reviewed the failure" override tick). Otherwise P6 completes silently.
- **P7** — `Competitive analysis matrix` artifact from `marketFor(domain)`
  template rows (illustrative, engine.ts:25-52); semantic memory. (DoD: ≥2
  competitors — always true.)
- **P8 (HITL)** — `Interface contract` artifact (framework/state/sync/surfaces),
  raises HITL `Approve interface layout` ("Locks the human-facing
  architecture."). No canvas, no generated UI code — just the contract text.
- **P9 (HITL)** — two artifacts: a literal `GitHub Actions workflow` YAML and an
  `IaC sketch` (Firebase preview channels / Cloud Run scale-to-zero). Raises
  HITL `Approve production routing` (external deployment, high stakes).
- **P10** — `Tiered inference` artifact (grok-4.5 primary, Ollama edge, failover
  route, sync-before-promote rule); procedural memory. No local model ever runs.
- **P11** — `Live search MCP binding` JSON (brave.search, two canned queries);
  **extra HITL here if scheduler flagged apiΔ≥2** (engine.ts:641-648). No
  search ever happens.
- **P12** — builds a real **OpenAPI 3.1.0 YAML string** from the A6 endpoints
  (or a placeholder path) and real **ADR-001/002/003 markdown** (ADR-003 embeds
  the domain + tightness + extra HITL of *this* run); logs `delivery.complete`;
  project flips to `complete` — 13 phases sealed. (DoD: openapi contains
  `openapi: 3.1.0`; adr contains `ADR-`.)

After every phase: `attachAlgorithms` re-primes A1/A3/A5/A6/A7/A8 + A4 trace,
artifacts list keeps per-phase payloads (old `packet` kind filtered and
re-sealed, engine.ts:774-777, 167-181), memory deduped to ≤80 rows, logs capped
at 200, and the packet is recompiled + re-sealed (`sealPacketArtifact`,
engine.ts:796-797).

### 2.6 Gate mechanics (two distinct gate systems — don't conflate)

1. **HITL approval gates** — the *operator* gates. Raised at P4/P5/P8/P9
   (stock, `STOCK_HITL = [4,5,8,9]`, phases.ts:131), plus scheduler-driven
   extras at P6/P11 (A3 `extraHitl`), plus P0 on `reframe` verdict, plus P6 on
   sandbox failure (`forceHuman`). Behavior (`store.ts:101-107` `canAutopilot`):
   autopilot may ONLY approve non-stock, non-forceHuman gates when
   `schedule.tightness < 7.2` — i.e. **autopilot can never rubber-stamp the
   four constitutional gates**, and autopilot approvals are journaled as
   `decidedBy: "autopilot"`. **Reject** requires ≥12 chars of feedback
   (store.ts:301); the phase record goes `rejected` with the note appended to
   `rejectionHistory[]` (append-only), project → `blocked` (engine.ts:877-924).
   **Approve** seals the phase `complete`, un-parks the next phase, appends a
   `HitlDecision` to `project.decisions` (journal capped at 100,
   engine.ts:831), and logs `hitl.approved` / `hitl.rejected`. A rejected phase
   is re-run only via `retry` ("Retry phase with notes", console.tsx:482-487),
   which flips it back to `ready` (engine.ts:926-932); regeneration is then
   *steered* by the note: deterministic keyword-delta lines are appended to the
   phase artifact (`rejectionResponseBlock`, engine.ts:141-155, applied at
   :747-754) and P6's module variant flips with the note hash. There is no
   infinite loop possible — each retry appends one attempt marker.
2. **DoD gates** (`src/lib/dod.ts`) — the *machine* gates. Every phase has
   deterministic exit criteria expressed as probes over project content
   (`DOD`, dod.ts:40-188). On phase completion `recordGate` (store.ts:58-99)
   evaluates them, stores `PhaseRecord.gate = { passed, unmet,
   evidenceHash, checkedAt }` where evidenceHash = FNV-1a over sorted
   `id:pass|fail` pairs (reproducible re-verification), logs `gate.verdict`,
   and swaps in a `gate` artifact. **Explicitly advisory** ("gates never block a
   run; they make the exit criteria visible and auditable", store.ts:53-57) —
   the DoD cannot stop a phase that completed with unmet criteria; it records
   FAIL loudly. DoR (`readyFor`, dod.ts:225-251) is enforced separately by the
   graph in §2.4.

### 2.7 The Agent Packet (A4 — the product's real deliverable)

`compileAgentPacket` (packet.ts:16-180) assembles, at every state change
(priming, each phase result, each auto-advance, each HITL approval — via
`stampPacket`, engine.ts:184-187), a single markdown document
`# RapidTool Agent Packet v2 — <Project>` containing: `## System` governance
rules ("You are a governed implementation agent… You may only work the current
phase… Illegal graph jumps, unsigned deploys, and tool calls outside user scope
are forbidden… Do not invent APIs."), `## Mission` (brief), operator notes
(overriding clause), A1 lattice summary, A3 scheduler row, A8 crew list with
ACTIVE markers + token budgets, A5 file order with owners, A6 entities/
endpoints, A7 oracle cases (≤8), `## Current edge` (phase + status + model +
honest `sandboxClaim`), pending-HITL block, prior-rejection pointer, last sandbox
result, scorecard verdict, **full `## Decision ledger (HITL)`** (one row per
journal entry; rejects quote the note, :33-37), `## Rejection loop` warning when
the current phase is in a retry loop, A2 ranked memory, scorecard axes, trimmed
artifacts (last 8, 900 chars each), ADRs/OpenAPI once written, and a strict
`## Required output schema` (Phase work / Files / Patch / Tests / Risks / Next
legal edge). Overlong packets are truncated loudly with an explicit marker
(packet.ts:176-178). The packet string lives on `project.packet` and in a
`packet` artifact, is copyable and exportable as `<name>-packet.md`
(console.tsx:358-369, 553-578), and is what the operator hands to a real agent.

### 2.8 Persistence and lifecycle

- Single source of truth: **zustand store with `persist` middleware, key
  `rapidtool.v4`, localStorage** (store.ts:387-398). Partialized: projects,
  activeId, autopilot. Hydration repair: `hydrateProject` (engine.ts:1037-1084)
  repairs phase records per-id (first-wins, inserts missing, drops duplicates —
  loud `hydrate.repaired` log), fills missing fields, backfills algorithms if
  the packet/lattice/specGraph are absent; `seedIfEmpty` seeds the demo
  "Northwind Dispatch" project on first load (store.ts:373-385).
- **No server state, no DB, no auth.** PGlite/better-auth/kysely/pg exist in
  package.json and `src/lib/auth/*`, `src/lib/app-data/*` (Grok platform
  pre-wires), but the RapidTool console never imports them. `server/` routes
  and `migrations/` belong to platform chrome.
- Lifecycle actions: Clone (deep copy + fresh UUID + `project.cloned` log,
  store.ts:324-351), Archive (= `remove`, destructive to that browser's storage
  — the dialog says so explicitly, console.tsx:595-597), rename inline
  (console.tsx:390-418), export packet.
- Multi-tab / multi-device: nothing. A second tab reads the same localStorage
  but there is no cross-tab sync beyond storage events zustand does not
  subscribe to.

---

## 3. Full UI map (every screen, panel, button — with code refs)

Two routes only (`src/router.tsx` / routeTree): `/` → `HomeScreen`,
`/run/$id` → `RunScreen`.

### 3.1 Home / intake (`HomeScreen`, console.tsx:142-265)

- Header: 3-bar dot-grid `Mark` logo (bars of declining height,
  console.tsx:132-140), "RapidTool — autonomous software agency", status chip
  `phases 0–12 · graph locked`.
- Hero: eyebrow "GOVERNED DELIVERY.", headline "Research first. Code second.
  Ship with a paper trail.", elevator paragraph naming the graph + four
  algorithms + illegal-jump rejection.
- **Client brief** textarea (≥12 chars to enable) + `Open intake ->` button
  (:203-211); helper "Phase 0 starts locked to the brief".
- Four **template pills** that prefill the textarea (:214-225).
- **Builds** panel: count badge, one card per project (name, `domain · P# ·
  status`, chevron → `/run/$id`), empty state "No builds yet…" (:228-261).

### 3.2 Console shell (`RunScreen`, console.tsx:267-891)

Three-column layout (rail / workspace / aside) + bottom tab strip
(`lg:grid-cols-[240px_minmax(0,1fr)_300px]`, :445).

**Top bar** (:383-443): logo+name, inline-editable project name, then mono
chips: `domain`, `modelRoute` (`local-edge`), sandbox chip (`sync-template ·
30s` or `worker · N MB`), live packet token estimate `≈N tok` (real BPE
cl100k_base count via gpt-tokenizer with ±15% band — algorithms.ts:674-693),
and **Autopilot · extra gates** checkbox (label at :440).

**Left — PhaseRail** (:893-937): 13 buttons; per row: glyph by status
(complete ✓ / locked 🔒 / running pulse / awaiting HITL shield / rejected ✗ /
ready — `PHASE_STATUS_META`, :28-48), `P# · HITL` mono tag when phase has a
gate, title. Clicking a non-current phase opens the read-only **PhaseRecordView**
(:1113-1200: banner "Viewing P# · read-only", rejection note, that phase's
artifacts in the pane, scorecard block at P0, and that phase's **gate
decisions + full rejection history**). "Back to live" returns.

**Center workspace** (per current phase): status line `P0 · ready` +
phase title + summary + the live brief; then action row conditioned on state:
- `blocked` → **"Retry phase with notes"** + rejected-note line (:478-493).
- pending hitl → amber "Human approval required" banner (:494-498).
- `complete` project → green "Delivery sealed" (:499-503).
- else → **Execute P#** (primary) + **Run to next gate** (secondary,
  :506-523); `running…` pulse while busy.
- Always: **Copy agent packet** (refreshes then clipboard; failure surfaces a
  real error, :366-368), **Clone**, **Export** (downloads `.md` packet +
  operator notes), **Archive** (Radix AlertDialog with explicit deletion
  warning, :588-619).
- Inline `error` alert; sandbox pass/fail mono line (:626-630); lattice chips
  (`job:` accent / entity muted / constraint amber, :631-654).
- **Onboard algorithms** card grid from `traces[]` (:657-670): A1..A8 tile,
  each `{id, name, summary}`.
- **Scorecard block** (:939-987) once P0 ran: overall `n / 10` + verdict chip,
  5 axis cards (score + note), competitor table (name/class/gap) when present.
- **HitlDock** (:989-1065) while a gate is pending: `HITL · <stakes>` header,
  gate title + prompt, an **Evidence for this gate (n)** details block
  (evidenceForGate :67-117: sandbox result, oracle cases, contracts, phase
  artifacts, spec order, reviewer mandate), rejection textarea with live
  `n/12` counter, **Approve** / **Reject** (Reject disabled < 12 chars).

**Bottom tab strip** (RunTab, :684-820; all panels forceMounted so future live
streams survive tab switches, :718):
- **Artifacts** — filter input + per-phase count `<select>` + two-pane
  list/viewer (mono `P# · kind`, title, body in `<pre>`) (:719-759,
  ArtifactPane :1067-1110).
- **Agent packet** — full packet markdown in `<pre>` (:761-765).
- **Spec graph** — ordered `<ol>` of `n · owner / file / purpose` rows
  (:767-786).
- **Crew** — 2×2 seat cards: `role · active · N tok`, mandate, handoff, tool
  chips (:788-801).
- **Oracle** — test-case list `name / given / expect` + contracts summary line
  (:803-819).

**Right aside** (:825-887): **Notes** textarea (operator notes → packet
`## Operator notes (human steering)`, packet.ts:76-83); **Memory** list (kind ·
P# · score + text, ≤8, empty state until P0 writes); **Gate log** (last 6
decisions reversed: `P# · approve/reject · human/autopilot · ago` + clipped
note, :850-876); **Diagnostics** (last 10 `JsonLog` rows reversed: `event
detail`, :878-886).

**Deliberately absent from the UI:** any "chat with the agency", any LLM
stream, any live canvas, any real file tree, any real test output beyond the
sandbox pass/fail line. The Oracle tab is a *contract viewer*, not a test
runner. The Crew tab is a *roster*, not an agent process list.

---

## 4. Capability delta: vision promises vs. implemented reality

Legend: **REAL** = genuinely does what the vision says (maybe scaled down);
**SIMULATED** = deterministic stand-in producing vision-shaped output without
the underlying capability; **ABSENT** = not present at all; **DORMANT** = code
exists but is not wired to the product.

| # | Vision promise | Verdict | Implemented reality (evidence) | What it would take to make it genuine (client-side-first) |
|---|---|---|---|---|
| 1 | **Deep research** (P0/P7/P11: live domain research, RAG over docs/GitHub, Brave live search) | **SIMULATED** | Scorecard axes, bottleneck/attack-vector boilerplate, and per-domain template competitor rows all derived from brief keywords; rows self-labeled `illustrative` (engine.ts:25-52, :50 comment); P11 artifact is a canned JSON binding with two queries that never executes (engine.ts:616-649) | Wire real retrieval: a server function (already possible via TanStack Start `createServerFn`, exactly like the orphaned `ai.ts`) that queries a search API (Brave/Tavily/SerpAPI) + fetches docs, then summarize/score with an LLM call. Needs an API key server-side; the *client alone* cannot do cross-origin research without a proxy — CORS + secret custody make pure-client genuinely impossible |
| 2 | **Real code generation** (P6: typed, schema-constrained synthesis of the user's actual app) | **SIMULATED** | `buildPhase6Module` emits a fixed 8-15 line template test module over lattice jobs; source must match template signature or be refused (sandbox.ts:15-17); the artifact is labeled "Typed synthesis module" but is not the client's system | LLM server function generating real files per the A5 spec-graph order + A6 contracts, validated against a zod schema (schema lock = zod, already a dependency) before display/export. The files can be *delivered* client-side as a download; *writing them into a real repo* cannot happen in-browser without a GitHub/API integration |
| 3 | **Real sandboxed execution** (P4: 256 MB cgroups/gVisor/WASM isolate, network deny, 30 s) | **SIMULATED** (executor) / REAL (browser isolate, dormant) | Production path = synchronous `runGenerated` template gate (regex blocklist + `new Function` in isolated scope) — bounded only because the source is engine-authored (sandbox.ts:5-27). A real blob-Worker sandbox `runSandboxed` with stubbed network primitives, terminate() timeout, console capture **exists and is fully tested** (sandbox.ts:107-240, sandbox.test.ts:201-274) but **nothing calls it** — dormant; UI chip shows `sync-template · 30s` honestly | Swap engine.ts:452/458 from `runGenerated` to `runSandboxed` when producers are generative; RAM capping of a JS isolate is not meaningfully enforceable in-browser (no cgroups; workers share process memory) — state that honestly as "wall-clock + network deny + no host scope", which the worker already delivers. cgroups/gVisor/Firecracker are server-only, genuinely impossible client-side |
| 4 | **LLM agency** (P1: LlmAgent classification, LiteLLM failover, dispatcher, tool use) | **ABSENT** (one orphaned call) | `ai.ts` `enrichBrief` calls x.ai grok-4.5 with `XAI_API_KEY` and returns name+note; zero importers (verified). modelRoute chip `local-edge` is a static label; crew token budgets are constants | Either delete `ai.ts` (dead weight) or connect it: P0 intake name enrichment is the natural pilot (fits "local-edge→failover" route semantics: edge when no key, failover on HTTP error — the function already returns `{ok:false,error:"edge"|"failover"}`). Full LlmAgent/dispatcher graph semantics remain genuinely impossible client-side without a keyed model API |
| 5 | **Persistence / database** (P2 "durable checkpoints to resume instantly") | **PARTIAL / SIMULATED** | Real durable persistence *per browser*: zustand persist → localStorage `rapidtool.v4` with hydrate repair + version marker `_v:2` (store.ts:387-398, engine.ts:1037-1084). But "checkpoint" semantics are cosmetic: the P2 artifact *describes* durable checkpoint keys (`project:<id>:phase:{n}`) that nothing implements; no cross-session resume of a *mid-phase* run exists beyond whole-project state | localStorage is genuinely sufficient for single-operator single-browser (the app's honest scope). For cross-device: PGlite (already in deps!) or a small server DB + auth; that crosses into server territory but is the platform's pre-wired path (auth/, db.ts exist unused). Multi-tab sync via BroadcastChannel/storage events is cheap and purely client-side |
| 6 | **Multiplayer / collaboration** | **ABSENT** (platform code dormant) | `src/lib/multiplayer/p2p.ts` (WebRTC full-mesh room client, perfect negotiation) + `index.ts` exist but are imported by nothing (verified). No sharing, no co-op console | Genuinely achievable client-side (WebRTC data channels need only a tiny signaling relay; the file even documents `/api/rtc`). Value is real — a second human/agent watching the run — but it is a platform leftover, not a product feature |
| 7 | **Crew / oracle as agents** (A7/A8: roles that execute, review, test) | **SIMULATED** | Crew = deterministic seat cards with phase-scoped `active` flags and token budgets (algorithms.ts:461-521); oracle = generated Gherkin-ish case *text*; neither executes anything; "right log stream" of phase.enter/hitl.approved/algo.run is the engine's own log array | The packet's crew section already makes seats consumable by real agents (paste packet into Claude/Codex/Cursor). In-app: route oracle cases to a sandboxed runner (worker) or an LLM review call at P5/P8 gates. Feasible client-side for execution; review quality needs an LLM key |
| 8 | **Real P6 modules** (varied, meaningful generated code per brief) | **ABSENT** (template only) | Two variants total, differing by one extra test function when a rejection exists (sandbox.ts:76-83); "code" is always the same skeleton regardless of domain — a HVAC dispatch brief and a clinic brief produce byte-identical shapes differing only in job strings | Any generative producer (LLM or a larger deterministic code-template library per domain × constraint combos). Purely client-side deterministic generation can get much richer (real per-domain templates) without keys; genuine novelty requires LLM |
| 9 | **Checkpointing** (P2: resume after failure without restart) | **SIMULATED** | Run-level state is always fully persisted (single Project blob), so *crash resume* actually works by accident of design — reload mid-awaiting_hitl and the gate is still there. But no step-level journal/replay, no per-phase snapshots, no resume-into-interrupted-run affordance; DoD gates re-verify from content hashes (real, dod.ts) | Real value-add client-side: per-step append-only run log (event sourcing the JsonLog already approximates) + "resume" button that re-enters the interrupted step. Feasible entirely client-side |
| 10 | **Publish / deploy** (P9: GitHub Actions, IaC, deploy routing) | **SIMULATED** | Artifacts are literal YAML/markdown *templates* (engine.ts:553-597) — writing them is the deliverable; nothing creates repos, PRs, or deployments | The artifacts are already paste-ready for a human; a "create GitHub PR" flow via fine-grained PAT/OAuth is feasible client-side (GitHub REST, CORS-enabled) and would make P9 a REAL gate with a real side effect; cloud deploys (Firebase/GCP) need service accounts/keys — server-side |
| 11 | **Graph governance** (illegal-jump rejection, phase sealing, HITL-with-feedback, DoD) | **REAL** | `canEnter`/`priorsSealed` hard enforcement (phases.ts:118-128, store.ts:127-130), ≥12-char rejection law (store.ts:301), append-only rejectionHistory + decision ledger (engine.ts:831, 881), autopilot exclusions for stock gates & forceHuman (store.ts:101-107), FNV-1a DoD evidence hashes (dod.ts:207-219). This is the product's genuine core and it works | — (keep; it is the moat) |
| 12 | **Memory (A2)** (RRF + cross-encoder re-ranking over RAG + LTM) | **SIMULATED** | Real typed memory store (episodic/semantic/procedural, confidence scores, dedup, ≤80 rows) + deterministic FusionRank lexical blend used by the packet (algorithms.ts:214-252); cross-encoder/Vertex AI and true multi-list RRF explicitly deferred in-code | Swap the lexical blend's re-rank term for a real embedding/rerank API call when a key exists; client-side-only improvement = better lexical retrieval (BM25-ish) — marginal. The *store* is genuine; only the ranking is simulated |
| 13 | **Sandbox isolation policy fidelity** (256 MB RAM cap, OAuth-scoped tools, secrets policy) | **SIMULATED as policy / REAL as honesty** | P4 artifact and packet quote the policy, then append `sandboxClaim` stating the actual executor (engine.ts:401, packet.ts:123) — the *UI label* "Wasm · 256MB" (agentnotes §1.2) overstates what the chip next to it admits | Memory caps and per-tool OAuth scoping cannot exist in a client-only app (no OS primitives, no user directory); the honest fix already started: label UI chips from `sandboxClaim()` so display == claim |
| 14 | **HITL gates at P4/P5/P8/P9** | **REAL** (with autopilot nuance) | Stock gates + dynamic extras (P6/P11 via A3, P0-reframe) all materialize real approval docks; autopilot can only clear *non-stock* gates under tightness < 7.2 — the checkbox is labeled "Autopilot · extra gates", which is exactly its scope | — |
| 15 | **UI/UX prototyping** (P8: component generation + live canvas preview) | **ABSENT (shell only)** | P8 produces a text "Interface contract" (engine.ts:528-552); no components, no canvas, no preview | P8 is the cheapest high-value REAL upgrade: the app *itself* is a React+Tailwind reference; deterministic scaffold generation (routes/store/screens per A5/A6) + an iframe preview of the generated scaffold is entirely client-side-feasible |
| 16 | **Self-healing loops** (P6 refactor on test failure; PR self-review) | **PARTIAL / SIMULATED** | One deterministic `healSource` patch (missing test_happy) then honest no-op (engine.ts:453-471, B-07 "no blind identical re-run"); "PR bot self-review" appears nowhere | LLM-keyed refactor loop on real generated code; client-side can only do the template-patch it already does |

---

## 5. Ranked capability gaps (value to user × feasibility client-side)

Scoring: **V** = user value if shipped (1-5), **F** = feasibility purely
client-side given current stack (1-5), **P** = priority = V × F.
"Client-side" here means: no server code beyond what TanStack Start already
permits, no paid keys required for the core loop.

| Rank | Gap | V | F | P | Why / what it is |
|---|---|---|---|---|---|
| 1 | **Wire real execution into P6's existing worker sandbox** | 5 | 5 | 25 | `runSandboxed` is built, tested, dormant. Point P6 at it (or use it for any user-pasted/oracle code), surface console capture + wall-clock kill in the Sandbox result artifact. Turns "sandbox failed — review" from theater into a real boundary. Pure client-side swap |
| 2 | **Deterministic per-domain code scaffolds** (real P6/P8 substance) | 5 | 4 | 20 | Replace the single template module with a per-domain × per-constraint scaffold library (routes, store, schema per A5 order + A6 contracts + A7 oracle as actual test files), previewable in an iframe, exportable as a zip. No keys needed; transforms the product from "agency costume" to "scaffold factory with governance" |
| 3 | **Connect the one orphaned LLM call** (`ai.ts` enrichBrief) | 3 | 5 | 15 | First real "agentic" beat (model-names the project + flags primary risk at intake), exercises the local-edge→failover route semantics, zero new infra — requires only an `XAI_API_KEY` env on the host running the dev server |
| 4 | **Honest capability labeling pass** (UI vs. claim) | 4 | 4 | 16 | The code is honest; the landing page and chips are not ("four onboard algorithms… paste-ready prompt for other agents" is accurate, but nothing says "deterministic simulator; no live research or codegen happens here"). Derive chips from `sandboxClaim()`; add a `sources: illustrative` caption to competitor table (row flag exists, table doesn't show it). Cheap trust repair |
| 5 | **Export/import + multi-tab sync of runs** | 3 | 5 | 15 | localStorage is fragile (cleared storage = lost delivery). JSON export/import of a Project + BroadcastChannel live sync between two tabs is fully client-side and makes the console feel like a workbench, not a demo |
| 6 | **P8 live preview of a generated scaffold** | 4 | 3 | 12 | If scaffolds land (rank 2), render them in a sandboxed iframe (srcdoc/blob) with the P4 policy text — the vision's "interactive canvas preview" achieved client-side. Depends on rank 2 for substance |
| 7 | **Step-level checkpointing / resume UX** | 3 | 4 | 12 | Event-sourced run journal + explicit "resume interrupted run" (re-enter the phase that was running when you left). Content already exists in logs[]; add per-step intent |
| 8 | **Real research feeds (search + docs ingestion)** | 5 | 2 | 10 | Highest raw value, lowest client feasibility: needs an API key + server proxy (CORS/secrets). Doable in this stack via `createServerFn` once a key exists; the P7/P11 artifacts and `Competitor.source: "cited"` field (types.ts:64) are already pre-designed for it — the schema anticipates truth |
| 9 | **GitHub PR handoff from P9** | 4 | 2 | 8 | P9 artifacts are paste-ready; a fine-grained-PAT "open PR with these files" flow makes the deploy gate real. Feasible client-side with a token the user pastes, but friction + scope creep |
| 10 | **Cross-device/team persistence + auth** | 4 | 2 | 8 | Real multi-operator governed delivery needs a server DB. PGlite (in-browser Postgres, already a dependency!) gives a credible single-browser upgrade; true sharing needs the platform's pre-wired better-auth/neon path — a different deployment |
| 11 | **LLM review at gates (P5/P8 "reviewer" seat)** | 3 | 2 | 6 | Make the reviewer/tester crew seats actually call a model on gate evidence before the human decides. Keyed; genuinely valuable for the "governed" claim but not client-only |
| 12 | **Multiplayer console (WebRTC)** | 2 | 2 | 4 | Dormant platform code is real but signaling needs a relay; value is niche until team persistence (rank 10) exists |

### 5.1 What genuinely CANNOT be done client-side (no keys/services)

1. **Live web research / RAG over the open web** — cross-origin fetching of
   arbitrary pages is blocked; search APIs need keys; a server function or
   proxy is mandatory. (TanStack Start server functions are the intended
   escape hatch — see `ai.ts` pattern.)
2. **Real model calls** (any LLM agency, embedding reranking, review) — needs
   an API key held server-side; the client alone cannot hold or hide one.
3. **OS-level isolation** (cgroups v2, gVisor, Firecracker, enforced 256 MB
   RAM caps, per-process privilege drop) — browser workers give wall-clock
   limits + no network + no host scope; they cannot give real memory caps or
   kernel isolation. The honest equivalent is the existing blob-Worker.
4. **GitHub/cloud side effects without user tokens** — repo creation, PRs,
   Firebase/GCP deploys require OAuth/PATs; only a user-supplied token makes
   them client-feasible, and service-account deploys are server-only.
5. **True multi-device persistence & shared state** — localStorage is
   single-browser; anything else is a server/DB or PGlite-with-sync.

### 5.2 The strategic read (what this product should become)

The governance machinery — graph lock, phase sealing, DoD hashes, decision
ledger, rejection loops with mandatory feedback, honest claims, the packet
compiler — is **real, tested, and differentiated** (see store.test.ts,
algorithms.test.ts, sandbox.test.ts, gates.test.ts, packet.test.ts). What is
simulated is *intelligence*, and the app already knows it (its own
commentary: "illustrative" rows, `sandboxClaim`, "run algorithms first"
placeholders, `vague` flags). Two coherent futures:

- **A: Deterministic scaffold workbench** (cheapest, all client-side): ranks
  1+2+5+6 turn it into "paste brief → review scored plan → approve gates →
  download a governed, contract-consistent scaffold + packet" — a genuinely
  useful, honest product with no keys.
- **B: Governed delivery hub for real agents** (the packet is the wedge):
  keep determinism for governance, add keyed LLM steps at intake (rank 3),
  research (8), and gate review (11), and let the packet be the artifact real
  agents consume — the "agency" becomes a dispatcher that never lies about
  what it did itself.

Either path requires the same first move: **make the UI speak the code's
honest dialect** (rank 4), because today the landing screen promises an
autonomous agency and the console delivers an exceptionally well-governed
simulation of one.

---

*Sources: attachments/RapidTool_Complete_Master.md (98 lines); AGENTS.md /
AGENTS.project.md (platform contract); agentnotes.md Parts 0–1 (lines 1–203);
src/lib/types.ts · phases.ts · algorithms.ts · engine.ts · packet.ts · store.ts
· sandbox.ts · dod.ts · ai.ts · templates.ts · multiplayer/* · src/components/
console.tsx · src/routes/*. All reads direct; no repo files were modified.*
