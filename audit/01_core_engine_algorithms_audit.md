# RapidTool — Core Engine, Algorithms & Data Layer Audit

| | |
|---|---|
| **Audit scope** | Core engine + algorithms + data layer (`src/lib/{engine,algorithms,phases,packet,sandbox,templates,types,store,ai,db,error-component}.ts(x)`, `src/routes/*`, `src/router.tsx`, `src/routeTree.gen.ts`) |
| **Reviewed against** | `attachments/RapidTool_Complete_Master.md` (12-phase vision) · `AGENTS.md` (Grok Build platform contract) |
| **Method** | Every line of every file read and cross-referenced; claims verified by code reading (line refs quoted). No runtime execution (per task rules). Findings marked "code-reading confidence" vs "runtime-unverified" where relevant. |
| **Files NOT in scope** | `src/lib/auth/`, `src/lib/app-data/`, `src/lib/multiplayer/`, `src/lib/og/`, `scripts/`, `server/`, `migrations/auth/` |
| **Date** | 2026-09-04 |

---

## 1. Purpose & architecture of the core

### 1.1 What the engine is

RapidTool's core is a **stateful, deterministic phase machine** — a strict linear state graph over 13 phases (`P0`–`P12`, ids `0..12`) — wrapped in a **client-side Zustand store** (`useRapid`, persisted to `localStorage`), where each phase "execution" calls a pure synthesizer that manufactures **markdown/JSON artifacts, memory entries, logs, HITL requests, and one canned, executable JS test module**. It is a *console/simulator* of the autonomous software factory described in the vision doc: **no LLM is ever invoked, no files are written, no server route exists, and the database layer is never touched by the engine.**

The vision doc (`RapidTool_Complete_Master.md:2`) promises "a stateful, deterministic graph architecture to transform high-level software concepts into fully functional codebases and architecture specs." What shipped is a deterministic *artifact generator* + a paste-ready **"Agent Packet"** (A4) that a human copies into an external agent. That gap is the single most important architectural finding of this audit (see §8, §9).

### 1.2 Core loop (who calls whom)

The engine is not a background process/loop. The "loop" is the user clicking buttons:

```
console.tsx (HomeScreen / RunScreen)
  └─ useRapid (zustand + persist, localStorage key "rapidtool.v4")   [store.ts]
       ├─ create()        → emptyProject()          [engine.ts]
       ├─ execute() / runUntilHitl()
       │    └─ advanceOnce() → runReady()           [store.ts:48-109]
       │         └─ applyPhaseResult()              [engine.ts:647-713]
       │              ├─ attachAlgorithms()         [engine.ts:622-645]
       │              │    └─ runAlgorithms()       [algorithms.ts:527-591]  (A1,A2,A3,A5,A6,A7,A8)
       │              └─ synthesizePhase()          [engine.ts:116-620]  (switch over 13 phases)
       │                   └─ runGenerated()/healSource()  [sandbox.ts]  (phase 6 only)
       │         compileAgentPacket()  ← A4, re-run after every mutation  [packet.ts:6]
       ├─ approve()/reject()/retry() → approveHitl/rejectHitl/unlockRetry [engine.ts]
       ├─ refreshPacket() → compileAgentPacket()    [store.ts:223-241]
       └─ seedIfEmpty()  → emptyProject() sample / hydrateProject() [store.ts:242-254]
```

### 1.3 The three layers

1. **Types layer** (`types.ts`) — 30+ type aliases describing the entire domain: `Project` is the single root aggregate that everything reads and writes. No runtime validation (no zod anywhere in core).
2. **Logic layer** (`phases.ts` phase table + transition predicates; `algorithms.ts` A1–A3/A5–A8; `packet.ts` A4; `engine.ts` orchestration/synthesis; `sandbox.ts` code exec/heal) — all **pure** functions over `Project` (side effects: `Date.now()`, `crypto.randomUUID()`, and `new Function` execution in phase 6).
3. **State layer** (`store.ts`) — the only impure state holder. Persists whole `Project` objects into `localStorage`. The engine's "data layer" is therefore **not `db.ts`** — it is the browser's `localStorage`.

### 1.4 `db.ts` is orphaned from the engine

`getSql()`/`getPglite()`/`ensureDbReady()` (Neon/PGLite) exist and are well-engineered, but **no core-engine module imports `@/lib/db`**. Grep across `src/` shows the only references are inside `db.ts` itself, a comment in `lib/auth/middleware.ts:11`, and the auth subsystem (owned by another agent). The engine runs 100% client-side; persistence = `localStorage` (`store.ts:257` `name: "rapidtool.v4"`). §4 details the data-layer state.

### 1.5 What a phase execution actually produces

`applyPhaseResult(project, phase)` (engine.ts:647):
1. `primed = attachAlgorithms(project)` — runs A1–A8, compiles packet A4 (engine.ts:622-645).
2. `synthesizePhase(primed, phase)` — a big `switch` (engine.ts:154-619) returning `{artifacts, memory, logs, scorecard?, competitors?, openapi?, adr?, generatedSource?, lastTest?, hitl?}`.
3. Merges: marks the phase `complete` or `awaiting_hitl` (engine.ts:661-670), advances project status, replaces that phase's artifacts, prepends memory (capped 80, engine.ts:682), appends logs (capped 200, engine.ts:693), sets `hitl`.
4. `packed = attachAlgorithms(merged)` — recompute algorithms + packet with post-merge state, then swaps the last "packet" artifact (engine.ts:700-711).

Phases whose definition has `hitl: true` (P4, P5, P8, P9 — `phases.ts:127` `STOCK_HITL`) plus dynamically-scheduled extras (P6 when the sandbox fails or scheduler demands; P11 when `apiDelta >= 2`; P0 "reframe" gate — **unreachable**, see bug B-02) produce a `hitl` request. The store then parks the project in `awaiting_hitl` until the human approves (→ `approveHitl`) or rejects with ≥12 chars (→ `rejectHitl` → status `blocked` → `retry()` unlocks).

### 1.6 State machine summary

- `PhaseStatus`: `locked | ready | running | awaiting_hitl | complete | rejected` (types.ts:4).
- `ProjectStatus`: `intake | running | awaiting_hitl | complete | blocked` (types.ts:6-11).
- Transitions enforced in the store (`advanceOnce`, store.ts:48-78): only from the *current* phase; `canEnter` requires `to === from + 1` (phases.ts:114-116); `priorsSealed` requires every earlier phase `complete` (phases.ts:118-124). Phase 0 starts `ready`, all others `locked` (engine.ts:798-801).

---

## 2. Real import graph

```
src/router.tsx  ──> routeTree.gen.ts ──> routes/__root.tsx (AuthProvider, PreviewHostBridge)
                └─> lib/error-component.tsx
routes/__root.tsx  ──> styles.css?url ; components/preview-host-bridge ; lib/auth/provider  (auth out of scope)
routes/index.tsx   ──> components/console.tsx (HomeScreen)
routes/run.$id.tsx ──> components/console.tsx (RunScreen)
components/console.tsx ──> lib/store (useRapid) · lib/phases (PHASES) · lib/templates (BRIEF_TEMPLATES)
                        · lib/algorithms (estimateTokens) · lib/types (type-only)
lib/store.ts ──> lib/engine (applyPhaseResult, approveHitl, emptyProject, hydrateProject,
                            inferName, rejectHitl, unlockRetry)
              ──> lib/packet (compileAgentPacket) · lib/phases (canEnter, priorsSealed, STOCK_HITL)
              ──> lib/types · zustand/middleware (persist)
lib/engine.ts ──> lib/phases (PHASES) · lib/packet (compileAgentPacket)
              ──> lib/algorithms (bootstrapMemory, feasibilityScorecard, runAlgorithms)
              ──> lib/sandbox (healSource, runGenerated) · lib/types
lib/algorithms.ts ──> lib/phases (PHASES) · lib/types
lib/packet.ts ──> lib/phases (PHASES) · lib/algorithms (fusionRank) · lib/types
lib/sandbox.ts ──> (no imports — standalone)
lib/templates.ts ──> (none)
lib/ai.ts ──> @tanstack/react-start (createServerFn) — **no importers anywhere in src/** (dead code)
lib/db.ts ──> scripts/migration-plan.mjs (pendingMigrations) — **no core importers**
lib/error-component.tsx ──> @tanstack/react-router, lucide-react
```

Observation: the dependency graph is a clean acyclic fan-in toward `types.ts`. `engine.ts`/`algorithms.ts` have zero imports from `store.ts` (pure functions) — good separation. Conversely `ai.ts` and `db.ts` hang off the graph with no edges into it (see §7).

---

## 3. Per-file deep walkdown

### 3.1 `src/lib/types.ts` (208 lines) — the domain vocabulary

Pure type module. No code. Key shapes:

- `PHASE_IDS = [0..12]`, `PhaseId` (types.ts:1-2); `PhaseStatus` (types.ts:4); `ProjectStatus` (types.ts:6-11); `ModelRoute = "grok-4.5" | "local-edge" | "failover"` (types.ts:13) — **no code ever sets "grok-4.5" or "failover"**; `emptyProject` hard-codes `"local-edge"` (engine.ts:816).
- `ArtifactKind` — 15 kinds incl. `"packet"`, `"algorithm"` (types.ts:15-30); `Artifact` `{id, phase, kind, title, body, language?}` (types.ts:32-39).
- `FeasibilityScorecard` (48-55), `Competitor` (57-62), `MemoryEntry` `{id, kind: episodic|semantic|procedural, phase, text, score}` (64-70), `JsonLog` (72-78), `HitlRequest` `{phase,title,prompt,stakes}` (80-85) — **no id/decision fields; a HITL is ephemeral, replaced wholesale**.
- `PhaseRecord` `{id,status,startedAt?,completedAt?,rejectionNote?}` (87-93).
- Algorithm I/O types: `IntentNode` (95-99), `IntentLattice` (101-108), `SchedulerPlan` (110-116), `AlgorithmTrace` `{id:"A1".."A8", name, ranAt, summary}` (118-123), `CrewRole` (125), `SpecNode`/`SpecGraph` (127-138), `DataContract` (140-146), `OracleTest` (148-154), `CrewSeat` (156-163).
- **`Project`** (165-200) — the root aggregate: 30 fields incl. nested `sandbox: {runtime:"wasm"|"cgroups-v2"|"gvisor", ramMb:256, timeoutS:30, isolated}` (181-186). The sandbox values are **aspirational literals** — real execution is `new Function` in the browser (§9). Also `lattice`, `schedule`, `traces`, `packet`, `specGraph`, `contracts`, `oracle`, `crew`, `generatedSource`, `lastTest`.
- `PhaseDef` (202-208).

No unions are discriminated with literal `status` narrowing helpers; every consumer re-checks strings. No comments describe invariants (e.g. "phases array is index-ordered by id and length 13" is an **unwritten invariant** relied on everywhere: `phases[phase]`, `priorsSealed` loop `phases[i]`).

### 3.2 `src/lib/phases.ts` (127 lines) — phase table + transition predicates

- `PHASES: PhaseDef[]` (3-108): 13 static defs mirroring the vision's phases 0–12. Each carries `hitl` flag — true for **P4 (Security/Isolation), P5 (Validation/HITL), P8 (UI/UX), P9 (Deploy)** (42, 45, 74, 82).
- `phaseDef(id)` (110-112): `return PHASES[id]` — order-index coupling; works because the array is in id order. **Unused anywhere in the codebase** (dead export, §7).
- `canEnter(from, to)` (114-116): `to === from + 1` — the *entire* "state transition validation" the vision (Phase 1 / "State Transition Validation" fixes, master doc:67) demands; no skip-ahead, no retreat, no schema table.
- `priorsSealed(phases, target)` (118-124): all `phases[i].status === "complete"` for `i < target`; `target===0 → true`. Note it checks **status only**, not `startedAt/completedAt` ordering.
- `HITL_PHASES` (126) — **dead export** (never imported; `STOCK_HITL` is used instead).
- `STOCK_HITL = [4,5,8,9]` (127) — the 4 hard human gates.

Weakness: `PHASES[phase]` indexing (also engine.ts:129, packet.ts:7, store console) is safe only while the array stays ordered & complete; a future "insert phase" edit silently mislabels everything. A `Map<PhaseId,PhaseDef>` or `Record` would be robust.

### 3.3 `src/lib/algorithms.ts` (596 lines) — A1, A2, A3, A5, A6, A7, A8 + helpers

Module-level static knowledge:
- `STOP` stopword set (16-20).
- `LEX` vocabulary per node kind: actor/job/object/constraint/risk (22-109). Note **"job" and "jobs" both appear**; domain-specific seed words (field service, clinic, finance, marketplace flavor).
- `DOMAIN_RISK` per domain → `{security, api, hitlBias}` (111-121). `custom-software` = all zeros; health/finance highest security.

Internal helpers:
- `tokens(text)` (123-129): lowercase, strip non `[a-z0-9+- ]`, split, drop 1-char and stopwords.
- `phraseHits(text, vocab)` (131-134): **substring containment** (`low.includes(v)`) — not word-boundary matching. Consequences: brief "tech support" hits actor term `"tech"`; "billable hours" hits `"bill"`; "scanning" hits `"scan"`. False positives propagate into lattice jobs/entities/constraints.
- `rrfScore(rank, k=60)` (177-179): `1/(60+rank)`.
- `overlap(a,b)` (181-187): Jaccard-ish cosine on token sets: `hits / sqrt(|a|*|b|)` — normalizes empty to 0; both-empty → 0 (guard at 182).

**A1 — `intentLattice(brief, domain): IntentLattice`** (137-175)
1. Tokenize brief; for each of 5 kinds, find vocab terms contained in the brief (141).
2. Weight = `min(1, 0.35 + freq*0.2 + (kind==="constraint" ? 0.15 : 0))` where `freq` counts bag tokens that contain the term or its first word (142-147). Substring collisions over-count (see B-register weaknesses).
3. Dedupe on `kind:label` (150-156), sort desc by weight (157).
4. Health domain bootstrap: injects `hipaa` constraint + `phi` risk at 0.9 if **both** are missing (158-163) — note: a brief that names "hipaa" but not "phi" suppresses the `phi` risk node entirely (the `some` requires both labels absent).
5. Builds `jobs/entities/constraints` arrays with fallbacks (`["deliver-core-workflow"]`, `["operator","record"]`, 169-170), caps nodes at 18 (172), `complexity = min(10, 3 + unique.length*0.45 + constraints.length)` (173).

**A2 — `fusionRank(query, memory, limit=6)`** (190-231)
1. Bucket memory by kind (196-201).
2. Within each kind, sort by `overlap(queryTokens, textTokens) + score*0.15` desc (205-209).
3. Each item gets a heuristic "cross-encoder" proxy `ce = 0.55*overlap + 0.25*score + 0.2*(kindPrior)` (211-214) and an RRF contribution `1/(60+rank_i+1)` (216).
4. Merge into a map keyed by `memory.id`; **the `else` branch accumulating `prev.rrf + rrf` (217-218) is structurally dead** — every item sits in exactly one kind bucket, so it can never be seen twice.
5. Final score `0.6*rrf*10 + 0.4*ce` rounded to 3 dp (227), sort desc, slice `limit` (229-230).

Genuine weaknesses: (a) not real Reciprocal Rank Fusion across multiple *retrievers* — it is one ranking per memory-kind merged by a weighted heuristic; the vision's "RRF + cross-encoder re-ranking via Vertex AI" (master doc:21, 68) is **simulated with static constants**; (b) because each item is scored only within its kind bucket, kind with 1 entry always beats kind with 100 (rank 0 → rrf 1/61 regardless of absolute quality); (c) max achievable score ≈ `0.6*(1/61)*10 + 0.4*1 ≈ 0.5`, so packet output shows scores like `0.312` with no documented meaning (packet.ts:85 prints `m.score.toFixed(3)`).

**A3 — `scheduleConstraints(lattice, domain): SchedulerPlan`** (234-254)
1. `securityDelta = base.security + (any regulatory constraint ? 1 : 0)` (237) — regulatory test is substring `/hipaa|pci|gdpr|soc2|phi/` over constraint labels.
2. `apiDelta = base.api + (constraintLoad > 2 ? 1 : 0)` (238).
3. `extraHitl`: add P6 if `hitlBias || securityDelta >= 2` (240); add P11 if `apiDelta >= 2` (241).
4. `tightness = min(10, 4 + securityDelta*1.5 + apiDelta + complexity*0.25)` rounded to 1 dp (242-246). Range ≈ 4.6–10.

**A5 — `planSpecGraph(lattice, domain): SpecGraph`** (296-344) + `topo()` (264-293)
Kahn's algorithm over a synthetic DAG: `schema → {api, store}`; jobs `job-0..job-4` depend on api+store; `ui` depends store+jobs; `tests` depends api+ui (299-342). `topo()` (264-293) computes in-degrees, seeds a queue with zero-in-degree nodes in insertion order, pops with `q.shift()` (FIFO — stable deterministic order), decrements successors, throws `"Spec graph contains a cycle"` (289-291) if any node never entered order. The throw is defensive dead code — the synthetic graph is acyclic by construction (no caller passes arbitrary nodes). Unused `dependsOn` targets are silently skipped (`if (!incoming.has(d)) continue`, 273).

**A6 — `synthesizeContracts(lattice): DataContract`** (376-388)
1. Entity names = dedup of `entities ∪ jobs`, sliced to 6 (377).
2. Per name, pick `FIELD_BANK` template by **substring** key match (`name.includes(k)`, 379): e.g. entity "jobs" matches key "job" → gets `assigneeId/slaDue`. Fallback `default` (id/status/updatedAt). **`fields` arrays are shared by reference** across entities (380) — safe today, mutation hazard tomorrow.
3. Endpoints: one per job (≤6), method GET if job matches `/report|search|track/` else POST (383), path `/v1/<slug>` (384).

**A7 — `buildTestOracle(lattice): OracleTest[]`** (391-416)
1. Happy-path test per job (≤5) (392-398).
2. Constraint-violation tests for ≤3 constraints (399-407).
3. One graph-safety test `orc-phase` "Agent requests P9 while P4 is open → Illegal transition" (408-414). Note: it says P9/P4, but the transition table (phases.ts:114-116) only forbids non-sequential jumps; P4→P9 would also trip `priorsSealed` — oracle phrasing is illustrative.

**A8 — `routeCrew(lattice, schedule, phaseTitle, phase=0): CrewSeat[]`** (419-462)
Four seats (architect/implementer/reviewer/tester), each `{role, mandate, tools, budgetTokens, handoff, active}`. `tight = tightness >= 7` shrinks budgets (425, 431, 439, 455). `active` per phase: architect ≤3, implementer ∈ {6,8,10}, reviewer ∈ {5,9,12}, tester ∈ {5,6} (433, 441, 449, 457). **Fallback line 460: if no seat is active (phases 4, 7, 11), `seats[0].active = true`** — so on P4 (the security/isolation phase) the *architect* is force-labeled `[ACTIVE]` in the packet even though the phase is about sandboxing, and implementer never shows active on P7. Cosmetic but misleading.

**`bootstrapMemory(lattice)`** (464-488): three fixed entries (semantic/procedural/episodic) with fixed ids `boot-sem/boot-proc/boot-epi`.

**`feasibilityScorecard(lattice, schedule)`** (490-525)
- `feas = max(4, min(10, round(9 − complexity*0.15)))` (497)
- `scale = max(4, min(10, 8 − (realtime ? 1 : 0)))` (498)
- `sec = max(3, min(10, 8 + securityDelta))` (499)
- `api = max(3, min(10, 7 − apiDelta))` (500)
- `delivery = jobs.length ? 8 : 5` (501)
- `overall = mean(axes)` rounded 1dp (509); `verdict = overall ≥ 7.5 ? "proceed" : overall ≥ 6 ? "proceed-with-guards" : "reframe"` (512).

**Critical arithmetic finding (bug B-02):** with the real ranges (complexity ∈ [~3,10] → feas ∈ {8,9}; scale ∈ {7,8}; sec = 8+Δ ∈ [8,10]; api = 7−Δ ∈ [4,7]; jobs can never be empty because A1 injects `["deliver-core-workflow"]`, so delivery = 8 always), the minimum achievable overall is (8+7+8+4+8)/5 = **7.0**, so the verdict is *never* `"reframe"` — the P0 reframe HITL gate in engine.ts:208-216 can never fire.

**`runAlgorithms(project)`** (527-591): runs A1→A8 in order (lattice, schedule, ranked (discarded by caller), specGraph, contracts, oracle, crew, traces). `traces` array ids skip A4 (A4 is appended later by `attachAlgorithms`, engine.ts:634-639). Query for A2 uses `PHASES[currentPhase].title + brief + jobs` (540).

**`estimateTokens(packet)`** (593-596): `tokensEst = max(1, round(len/4))`; `usd = round(tokensEst * 0.000003 * 10000)/10000`. Only `tokensEst` is consumed by the UI (console.tsx:291); `usd` is dead output.

### 3.4 `src/lib/engine.ts` (867 lines) — orchestrator/synthesizer

Non-exported helpers:
- `marketFor(domain)` (15-41): canned competitor matrix — 2 universal rows (Cursor, v0/Bolt/Lovable) + domain extras. Deterministic strings.
- `slug(s)` (43-49): lowercase, non-alnum runs → `-`, strip edge dashes, cap 32 chars.
- `scorecard(project)` (73-97): if `lattice`/`schedule` missing returns placeholder `{overall:6, verdict:"proceed-with-guards", axes:[], bottlenecks:["Run algorithms before scoring."]}`; else `feasibilityScorecard(...)` plus a **hard-coded `libraries` list** (TanStack Start, Zod, LiteLLM, FastMCP, Ollama — engine.ts:89-95) — these "recommended libraries" are marketing copy, not a real analysis; note the placeholder branch is **dead** because `attachAlgorithms` always computes lattice/schedule before any synthesize call.
- `art(phase, kind, title, body, language?)` (99-114): builds `Artifact` with deterministic id `${phase}-${kind}-${slug(title)}`.

Exports:

**`inferDomain(brief): string`** (51-62): regex ladder — `crm|pipeline|lead` → revenue-ops; `inventory|warehouse|sku` → operations; `marketplace|listing|buyer` → marketplace; `agent|orchestrat|mcp|llm` → agent-platform; `clinic|patient|health` → health-ops; `fleet|dispatch|route` → logistics; `invoice|billing|ledger` → finance-ops; `dashboard|analytics|kpi` → analytics; else `custom-software`. Substring matching: a brief containing the word "customer" does **not** match `clinic|patient|health`, fine — but "healthcheck tool for fleets" hits health-ops before logistics. Order matters and is undocumented.

**`inferName(brief): string`** (64-71): first sentence (`split(/[.\n]/)`), strip leading `build|create|make|design|develop` verbs (case-insensitive), capitalize first ≤4 words; `"Untitled system"` fallback.

**`synthesizePhase(project, phase)`** (116-620): giant switch; each case returns `{artifacts, memory, logs, ...}`. Content per case:
- **P0** (155-218): scorecard artifact + lattice JSON artifact; memory 2 entries; if verdict `reframe` → HITL (dead — B-02).
- **P1** (219-248): "Dispatcher topology" ASCII graph artifact (state machine description, text); procedural memory.
- **P2** (249-275): checkpoint/retrieval plan artifact (RRF k=60 + cross-encoder claims); memory.
- **P3** (276-302): MCP+A2A JSON artifact (`a2a v1.0`, websocket 250ms frames) — all text.
- **P4** (303-333): isolation policy text; **always HITL** (326-332).
- **P5** (334-362): adversarial suite + HITL contract; **always HITL** (355-361).
- **P6** (363-423): **the only executable case.** Builds a JS source string (368-387) declaring `JOBS`, `REJECTION` (from rejection notes), `synthesize(spec)` with phase/job/rejection guards, plus `test_happy`/`test_no_skip`. Runs it via `runGenerated(code)`; if it fails, `code = healSource(code, detail)` and re-runs **once** (388-392). `extra` HITL if `schedule.extraHitl.includes(6) || !result.ok` (393) → either "Approve generated module" (passed, scheduler-flagged) or "Sandbox failed — review" (412-421). `generatedSource` + `lastTest` returned (395-396).
- **P7** (424-445): competitor matrix markdown from `marketFor`.
- **P8** (446-470): interface contract text; **always HITL** (464-469).
- **P9** (471-515): GitHub Actions YAML artifact + IaC sketch; **always HITL** (509-514).
- **P10** (516-533): tiered-inference text artifact.
- **P11** (534-567): Brave-search MCP binding JSON; conditional HITL when `extraHitl.includes(11)` (559-566).
- **P12** (568-618): builds OpenAPI 3.1 string (paths from contracts or a placeholder `POST /projects`), ADR markdown (3 canned ADRs), delivery log; no HITL.

Design observations: every case is **deterministic template text** — the same brief+domain always produces byte-identical artifacts (only timestamps differ). Nothing is LLM-generated, nothing reads the DB, nothing writes the filesystem. Phase 6's "code" is a fixed self-test harness that validates its own guards, not a build of the user's app.

**`attachAlgorithms(project): Project`** (622-645): runs `runAlgorithms`, spreads results into project, **replaces** `traces` with 7 new A1..A8 entries + 1 A4 entry (traces do not accumulate), resets `packet: ""`, then `packet = compileAgentPacket(next)`. Called on every mutation — 1× at creation/hydration, 2× per `applyPhaseResult`, 1× per approve.

**`applyPhaseResult(project, phase): Project`** (647-713): sequence described in §1.5. Details worth quoting:
- Post-synthesis safety net (651-658): `if (phase === 6 && result.lastTest && !result.lastTest.ok && !hitl) hitl = {...}` — unreachable in practice because P6 already sets a HITL when tests fail (engine.ts:393+412).
- Phase record update (661-670): status `awaiting_hitl` or `complete`; `startedAt` kept, `completedAt` only when complete.
- Project status (674): `awaiting_hitl` | `complete` (phase 12) | `running`.
- Artifact replacement: drops artifacts of that phase and any `kind === "packet"` (679), then re-packs a fresh packet artifact (701-711).
- `memory: [...result.memory, ...primed.memory].slice(0, 80)` (682) — newest-first, hard cap.
- `logs: [...].slice(-200)` (693).

**`approveHitl(project): Project`** (715-740): `phase = currentPhase`; `next = min(12, phase+1)`; marks current `complete` (+completedAt), marks next `ready`; clears `hitl`; status `complete` iff phase 12 else `running`; currentPhase → next; appends `hitl.approved` log; re-runs `attachAlgorithms`. **It does not check the failure state of `lastTest`** — approving a failed P6 sandbox seals the phase with `lastTest.ok === false` and the packet continuing to print `Sandbox: FAIL` (B-03).

**`rejectHitl(project, note): Project`** (742-775): marks phase `rejected` + stores `rejectionNote`; clears `hitl`; status `blocked`; log `hitl.rejected`; prepends an episodic memory entry with score 1. **The note does not flow into any regeneration logic** except P6's canned `REJECTION` constant (B-04).

**`unlockRetry(project)`** (777-783): rejected phase → `ready`; status `running`; hitl null. Re-running a rejected phase replays the **same** deterministic synthesis — for P0/P4/P5/P8/P9 rejection cannot change the outcome; the human must approve the identical content (B-04).

**`emptyProject({name,brief}): Project`** (785-840): domain inference, UUID (`crypto.randomUUID()` w/ `p-<ts>` fallback), `modelRoute: "local-edge"` (816), `sandbox {runtime:"wasm",256MB,30s,isolated:true}` (817-822), phases array with P0 ready (798-801), then `attachAlgorithms(base)` and `ready.memory = bootstrapMemory(...)` **after** packet compilation (837-839) — the fresh project's packet was compiled against empty memory, then memory was replaced: packet says "(empty — treat Phase 0 research as first write)" while the store now shows 3 bootstrap memory rows (B-05).

**`hydrateProject(raw): Project`** (842-867): default-fills every nullable field for legacy persisted rows; rebuilds `phases` if length ≠ 13 (860-863) — note this **silently resets** all phase history if the stored array is malformed; if `packet && lattice && specGraph` present returns as-is, otherwise re-runs `attachAlgorithms` (865-866).

### 3.5 `src/lib/packet.ts` (118 lines) — A4 Agent Packet compiler

`compileAgentPacket(project): string` (6-118). Rebuilds a paste-ready markdown brief for an external agent:
1. Header + system prompt rules (27-35) — "You are a governed implementation agent… Illegal graph jumps… forbidden."
2. Mission = brief (36-37); intent lattice section (39-44); scheduler Δ (46-49); crew seats (51-54); spec-graph order resolved to node details (56-62); contracts (64-68); oracle tests capped at 8 (70-71).
3. Current edge + status + sandbox claims (73-82) — includes the hard-coded line `Sandbox: ${runtime}, ${ramMb}MB, ${timeoutS}s, net-deny on generated exec` (77) which is **false for the actual browser `new Function` sandbox** (no net deny).
4. Ranked memory via **re-running `fusionRank`** (10-14, 83-86) — the second call per phase run (A2 already ran inside `runAlgorithms`); its result is discarded there, so this recompute is the only consumer.
5. Scorecard, artifacts trimmed to last 8 with bodies truncated to 900 chars (15-18, 98-99), ADRs/OpenAPI if present (101-102).
6. Required output schema for the agent (104-111), incl. `Next legal edge — only P${Math.min(12, project.currentPhase + 1)}` (111) — prints `P12` at phase 12 ("only P12 if this phase completes") which is nonsense for the terminal phase.
7. `.filter(line => line !== "")` + `.join("\n")` then **`.slice(0, 14000)`** (115-117) — hard char cap; can cut mid-sentence/mid-code-fence.

Side effects: none (pure). Weakness: it bakes in **current** `project.currentPhase`, but the store advances `currentPhase` after a non-HITL phase *without* recompiling the packet (store.ts:96-103), so a freshly copied packet can describe the *previous* phase as "current edge" (B-06).

### 3.6 `src/lib/sandbox.ts` (23 lines) — "isolated execution"

- `FORBIDDEN` (line 1): regex banning literals `process`, `require`, `globalThis`, `window.fetch`, `XMLHttpRequest`, `eval`, `Function`, `import<space>`, `document.`, `localStorage`, `indexedDB`.
- `runGenerated(source)` (3-16): regex gate → builds `source + ";if (typeof test_happy === 'function') test_happy();\nif (typeof test_no_skip === 'function') test_no_skip();"` (8) → `new Function(body)` (10) → call (11); returns `{ok, detail}`; exceptions → `{ok:false, detail:message}` (13-15).
- `healSource(source, error)` (18-23): appends a missing `test_happy` **only if** `error.includes("test_happy") && !source.includes("function test_happy")`.

Findings: (a) this is a **toy sandbox** — `new Function` runs in the page's global scope with full access to globals; the FORBIDDEN list is trivially bypassable (`[].filter.constructor("...")()`, dynamic `import(` — not banned because the regex needs a whitespace after `import`, bare `fetch(` is not banned, `setTimeout`/`while(1)` not banned) (B-01, §9); (b) **no timeout** despite `sandbox.timeoutS: 30` in the model — an infinite loop freezes the tab; (c) `healSource` is effectively dead: the P6 template always contains `function test_happy`, so the condition is never true and the second `runGenerated` call is a byte-identical replay (B-07).

### 3.7 `src/lib/templates.ts` (26 lines)

`BRIEF_TEMPLATES` — 4 demo briefs (field dispatch, shop quoting, clinic ops, marketplace) with ids `dispatch/quote/clinic/market`. Consumed only by console.tsx:114-123 (buttons that fill the textarea). Pure data.

### 3.8 `src/lib/store.ts` (269 lines) — the state machine driver + persistence

`RapidState` interface (16-36): `projects`, `activeId`, `hydrated`, `autopilot` + actions `create/select/execute/runUntilHitl/approve/reject/retry/remove/clone/rename/setNotes/refreshPacket/seedIfEmpty`.

- `byId` (38-40).
- `canAutopilot(project, enabled)` (42-46): requires `enabled && hitl`, returns **false** for `STOCK_HITL` phases (4,5,8,9), true when `(schedule?.tightness ?? 10) < 7.2`. I.e., autopilot auto-approves *extra* gates (P6 fail/P6 scheduler, P11) on low-tightness projects but never the four stock gates.
- **`advanceOnce(project, autopilot)`** (48-78) — the machine step. Decision table:
  - missing record → `{error:"Unknown phase."}`.
  - `blocked && rejected` → `{error:"Phase rejected — retry with the note applied.", stopped:true}`.
  - `locked` → `{error:"Phase is locked."}`.
  - `awaiting_hitl` → autopilot? `approveHitl` : `{error:"Waiting on human approval.", stopped:true}`.
  - `complete && phase<12` → validate `canEnter` + `priorsSealed`, mark next `ready`, `runReady(next)` — i.e. **one Execute click runs exactly one *new* phase**, auto-advancing past completed ones (65-75).
  - `complete` at 12 → `{error:"Pipeline complete.", stopped:true}`.
  - else `runReady(phase)`.
- **`runReady(project, phase, autopilot)`** (80-109): seals check → sets `running` + `startedAt` → `applyPhaseResult` → if result not `awaiting_hitl` and phase<12, advance `currentPhase` to next & mark it `ready` **without recompiling the packet** (96-103) → autopilot gate → returns `stopped` iff awaiting/complete/blocked.
- `execute(id)` (132-141): runs one `advanceOnce`; errors surface only when the project object is unchanged (`next.error && next.project === project`).
- `runUntilHitl(id)` (142-163): bounded loop **`for (let i = 0; i < 16; i++)`** (148) of `advanceOnce`; stops at awaiting-non-autopilot/complete/blocked, or 16 executions; returns `{ok, ran}`; a mid-loop error with progress made is swallowed into `ok:true` (150-155) — no error surfaced to the UI for partial runs.
- `approve(id)` (164-176): guards `hitl` exists and `hitl.phase === project.currentPhase` (168-170) before `approveHitl`.
- `reject(id, note)` (177-187): **`note.trim().length < 12` → error** (178) — the vision's "≥12 characters qualitative feedback" (master doc:70) is enforced here.
- `retry` → `unlockRetry` (188-195); `remove` (196-200); `clone(id)` (201-211): **builds a brand-new `emptyProject` from name+brief only** — the clone carries zero progress/artifacts (B-08); `rename` (212-218); `setNotes` (219-222); `refreshPacket(id)` (223-241): recompiles packet and **replaces** the A4 trace entry.
- `seedIfEmpty()` (242-254): if `!hydrated` return; if projects exist → `hydrateProject` each (migration-on-load); else **auto-creates a demo project "Northwind Dispatch"** (248-253).
- Persist config (256-268): `name:"rapidtool.v4"`, `partialize` drops `hydrated` only (258-262), `onRehydrateStorage` → `setHydrated(true)` + `seedIfEmpty()` (263-266).

State-shape notes: hydration is synchronous-at-import in the browser (localStorage is sync), which seeds the demo project **before first render**, while SSR rendered an empty list — see B-09 (hydration mismatch). `clone` semantics and swallowed partial-run errors are UX-level findings.

### 3.9 `src/lib/ai.ts` (39 lines) — the only LLM hook (unused)

`enrichBrief = createServerFn({method:"POST"}).validator(...).handler(...)` (3-39): if no `XAI_API_KEY` → `{ok:false,error:"edge"}`; else POSTs to `https://api.x.ai/v1/chat/completions` (verified byte-level: header is `` Authorization: `Bearer ${apiKey}` `` — an earlier display artifact showed `***`, raw bytes confirmed `Bearer`) with `model:"grok-4.5"`, `max_tokens:220` (16-17); non-OK → `{ok:false,error:"failover"}`; parses two lines → `{ok:true, name, note}` (34-38).

Findings: (a) **no importer anywhere in `src/`** — dead code (§7); (b) no fetch timeout/AbortController; (c) LLM output is parsed heuristically, not schema-validated (AGENTS.md's "never mock AI responses" and capped usage are moot while nothing calls it); (d) the name/domain enrichment it would provide is instead done by `inferName/inferDomain` regexes.

### 3.10 `src/lib/db.ts` (238 lines) — server DB layer (orphaned from core)

Detailed in §4. Exports: `DbSource`, `dbSource`, `interface Sql`, `getSql()`, `getPglite()`, `ensureDbReady()`.

### 3.11 `src/lib/error-component.tsx` (21 lines)

`AppErrorComponent({error})` (4-21): centered fallback UI, `error.message || "An unexpected error occurred..."` (17), dark/light classes. Wired as `defaultErrorComponent` in router.tsx:6. Keeps the framework contract from AGENTS.md §1 ("restyle that component but keep error.message visible"). Clean.

### 3.12 Routes + router + route tree

**`src/router.tsx`** (7 lines): `getRouter()` named export — required shape per AGENTS.md ("a named `export function getRouter()` … passing `defaultErrorComponent: AppErrorComponent`"). Creates `createRouter({routeTree, defaultErrorComponent})`.

**`src/routes/__root.tsx`** (48 lines): root route; head meta (charset, viewport, title "RapidTool", description, theme-color #0b0c0e) (9-20); links: `/favicon.svg`, `styles.css?url` (appCss via `import appCss from "../styles.css?url"`, line 4), `__grok/manifest.webmanifest`, icon-180, Google Fonts (IBM Plex Mono + Instrument Sans) (21-32). Body: `<PreviewHostBridge />` + `<AuthProvider><Outlet /></AuthProvider>` + `<Scripts />` (34-47) — honors AGENTS.md hard rules (bridge mounted near top of body; no og tags in root; suppressHydrationWarning on `<html>`, 35).

**`src/routes/index.tsx`** (8 lines): `createFileRoute("/")`, renders `<HomeScreen />`.

**`src/routes/run.$id.tsx`** (11 lines): `createFileRoute("/run/$id")`, `Route.useParams().id` → `<RunScreen id={id} />`.

**`src/routeTree.gen.ts`** (86 lines): generated (header 1-9), routes `/` and `/run/$id`, parent `__root__`, module augmentation for TanStack Start (79-86). Nothing hand-edited. Only two leaf routes exist — no `/login`, no API routes, no 404 route.

---

## 4. Data layer

### 4.1 The two "data layers"

1. **Engine persistence = `localStorage`** via zustand `persist` (store.ts:256-268), key `rapidtool.v4`. Whole `Project[]` objects serialized. `partialize` excludes only `hydrated`. No version/migration schema on the persisted blob — `hydrateProject()` (engine.ts:842-867) is the *ad hoc* migration path for older shapes; if `phases.length !== 13` the phase history is silently rebuilt from scratch (860-863).
2. **Server DB = `db.ts`** (Neon or PGLite) — not referenced by engine, console, store, algorithms, packet, or sandbox. In this app the db layer's only real consumers live in `src/lib/auth/` (out of scope). The audit records it because the task names it the data layer, and its lifecycle contract is important for anyone wiring the engine to it later.

### 4.2 `db.ts` connection lifecycle (read every line)

- Backend selection (4-19): whitespace-only `DATABASE_URL` is treated as unset (comment 6-7 and guard 10-11); `dbSource = databaseUrl ? "neon" : "pglite"` (19).
- `Sql` interface (29-38): tagged-template form + `.query(text, params)` form; both resolve to `T[]` row arrays.
- Type normalization (53-86): `OID_INT8=20`, `OID_DATE=1082`, `OID_INTERVAL=1186`; int8 → `Number`, date → identity (keeps PG text `YYYY-MM-DD`), interval → text. Purpose: pg and PGlite disagree on JS types (BigInt breaks `JSON.stringify`). Comments (41-46, 54-64) document HMR racing and precision loss past 2^53 (cast `::text` for huge ints).
- `toSql(run)` (73-86): tagged template re-emits `$1..$n` positional placeholders (79-81) so values stay parameterized; both forms route to the same `run`.
- **Neon path `createNeonSql()`** (88-106): lazy `import("pg")`; `types.setTypeParser(20, Number)` etc. — **process-global** parser mutation affecting every `pg` consumer in the process (93-95); one `Pool` per process; failure clears the global promise slot (101-104).
- **PGLite path `createPgliteSql()`** (108-168): instance stored on `globalThis.__pgliteInstance__` (HMR-proof), **in-memory** (comment 110-111: data survives source edits, resets on dev-server restart); per-instance `parsers` (114-119); `_migrations` table ensured (122-124); then migration pass: `import.meta.glob("/migrations/*.sql", {query:"?raw", eager:true})` (140-144) — bundler-inlined SQL, no runtime fs; glob **does not descend** so `migrations/auth/` stays out (comment 133-136); applies each pending file inside `pg.transaction` with the tracking insert in the same tx (152-155) — atomic apply+record, parity with the CLI migrator; passes serialized on a global chain `__pgliteMigrateChain__` with `.catch(()=>undefined)` so a failed pass doesn't wedge the chain (158-162).
- `createSql()` (172-180): throws in the browser ("server-only"); routes to Neon/PGLite.
- `getSql()` (189-195): memoized on module-level `sqlPromise` (HMR can create several module instances, but the globals dedupe the heavy resources; failure resets the memo).
- `getPglite()` (202-210): throws if Neon; awaits `getSql()` then returns the shared instance (used by auth's Kysely dialect — out of scope).
- `ensureDbReady()` (222-225): Neon → no-op (pool is lazy); PGLite → `getSql()`. Vite `configureServer` awaits it at dev startup; plus an **eager module-load bootstrap** for Node when pglite (229-238), failure clears the slot and rethrows after `console.error("[db] PGLite bootstrap failed:", err)`.

### 4.3 Migrations contract

- Schema source of truth: `migrations/*.sql` (top level only). **Currently the top level of `migrations/` contains no `*.sql` files at all** — only `migrations/auth/0001_auth.sql` exists, which the non-recursive glob deliberately ignores. So the PGLite migration machinery is inert for the core app today; the auth schema is applied by the auth subsystem.
- Neon note (B-10): `getSql()`'s docstring claims "Schema comes from migrations/*.sql, auto-applied before the first query on both backends" (183-188), but `createNeonSql()` never applies migrations — production relies on `npm run build` → `db:migrate` (package.json) having run. Dev-with-`DATABASE_URL` gets no auto-migration.
- Rollback story: none (forward-only table `_migrations`).
- In-memory PGLite means preview DB content is ephemeral per dev-server process — fine for demo, impossible for cross-restart data; auth sessions (owned elsewhere) share this instance via `getPglite`.

### 4.4 Kysely / PGlite dialect

`kysely ^0.28.5` and `@electric-sql/pglite ^0.5.4` are in package.json; the Kysely PGlite *dialect* lives in `src/lib/auth/pglite-dialect.ts` (auth-owned). `db.ts` itself exposes the raw `Sql` surface and the raw `PGlite` instance — no Kysely in the core files audited.

---

## 5. UI / routes: what index.tsx and run.$id.tsx render and wire to

Both routes are thin shells over `components/console.tsx` (the component file is not in this audit's file list but is the wiring target, so its top-level behavior is summarized).

### 5.1 `/` (index.tsx:1-8) → `HomeScreen` (console.tsx:41-164)

- Header: logo mark + "phases 0–12 · graph locked" (74).
- Left: marketing copy (79-88 — states "four onboard algorithms: Intent Lattice, FusionRank memory, Constraint Scheduler, and an Agent Packet compiler" — the UI itself only *names* four of the eight A-algorithms), brief `<textarea>` with a **12-character minimum launch gate** (57, 104), template chips from `BRIEF_TEMPLATES` (114-123), "Open intake" button.
- Right: "Builds" list from `useRapid().projects` (43, 130-158) — count + per-project `name / domain · P{currentPhase} · status`.
- Wiring: `create(brief)` then `nav("/run/$id", {id})` (56-62); clicking a build does `select(p.id)` + nav (142-145).
- Hydration safety-net effect (47-54): after 80ms, if `!hydrated` force `setHydrated(true)` + `seedIfEmpty()` — a fallback for environments where the persist rehydrate callback never fired.

### 5.2 `/run/$id` (run.$id.tsx:1-11) → `RunScreen` (console.tsx:166-616)

- Lookup by param `id` in `projects` (183); miss → "That build is not on this station." + link home (200-209). **No `select(id)` on mount** — activeId is not synced to the URL (minor: header nav state vs URL).
- Header (253-302): editable name (rename on blur/Enter), domain chip, `modelRoute` chip, sandbox chip (`runtime · ramMb`), live `~{estimateTokens(packet).tokensEst} tok`, **Autopilot checkbox** (293-300, label "Autopilot · extra gates").
- Primary controls (319-409): when `status === "blocked"` → "Retry phase with notes" (`retry`); when `hitl` → "Human approval required" badge; when complete → "Delivery sealed"; otherwise → **"Execute {phase.code}"** (`execute`) and **"Run to next gate"** (`runUntilHitl`); plus "Copy agent packet" (`refreshPacket` then `navigator.clipboard.writeText` of the fresh packet, 238-249), "Clone" (→ new empty project from brief), "Export" (downloads a Blob of packet + operator notes, 377-396), "Archive" (`remove`, 402-408).
- Error line from store action failures (410); `lastTest` pass/fail line (411-415); lattice chips jobs/entities/constraints (416-434); trace cards (437-450); scorecard + competitor table (`ScorecardBlock`, 452, 655-703); **HITL dock** (`HitlDock`, 454-462, 705-758) — title/stakes/prompt, rejection textarea with live `{note.length}/12` counter and disabled Reject under 12 chars (736, 749).
- Tabs (464-573): Artifacts (filterable by local `query`; list + `<pre>` body viewer, `ArtifactPane` 760-801), Agent packet (`<pre>` of `project.packet`, 501-504), Spec graph (ordered file list, 505-523), Crew (seat cards, 524-536), Oracle (test cases + contract summary, 537-552).
- Right rail (576-612): operator Notes (`setNotes`, 578-584 — persisted with the project; appended to packet export but **never to the compiled packet**), Memory list (keyed by `m.id`, capped display 8, 588-598), Diagnostics = last 10 logs reversed (keyed `${ts}-${i}`, 605-610).
- `PhaseRail` (618-646): all 13 phases with `StatusGlyph` (648-653); `project.phases[p.id]` indexing requires the length-13 invariant.

### 5.3 UI observations

- All mutation goes through store actions; components hold only ephemeral local state (textarea, tab, filter, selected artifact, note, error, copied).
- Error UX: `execute` failures print red text; `runUntilHitl` partial-run errors are swallowed inside the store (store.ts:150-155) so the UI shows success.
- No loading/async anywhere: everything is synchronous CPU work on the main thread; a future slow algorithm/AI call would freeze the UI (no worker, no suspense).

---

## 6. Bugs register

Severity: **P0** = breaks core function/data integrity; **P1** = serious defect with workaround or high-impact latent risk; **P2** = real defect, moderate impact; **P3** = cosmetic/minor/edge. (No P0 found — none of these corrupts data irrecoverably; closest are B-01/B-03.)

| # | Sev | Location | Bug | Impact | Suggested fix |
|---|-----|----------|-----|--------|---------------|
| B-01 | P1 | sandbox.ts:1-16 | "Sandbox" is `new Function` in the page global scope: FORBIDDEN regex bans literal substrings only; bypasses: `[].filter.constructor("…")()`, dynamic `import(` (regex requires whitespace: `import\s` doesn't match `import(`), bare `fetch(`, `while(1){}`. **No timeout** — `timeoutS:30` (types.ts:184) is never enforced. Currently only engine-authored template code runs (low exploitability), but the moment any LLM/injected text flows here it is RCE-in-browser. | Freeze/DoS of the tab; latent full sandbox escape | Run in a Web Worker with `setTimeout` kill + `postMessage` results; or iframe `sandbox`; enforce a wall-clock cap; keep the denylist only as defense-in-depth; never feed untrusted text into it |
| B-02 | P2 | algorithms.ts:497-512 + engine.ts:208-216 | `verdict:"reframe"` is **unreachable**: with A1 guaranteeing ≥1 job and the axis formulas, `overall ∈ [7.0, 8.4]` always (min = (8+7+8+4+8)/5 = 7.0), and thresholds are ≥7.5 proceed / ≥6 guards / else reframe. The entire P0 "Reframe the brief" HITL branch (engine.ts:208-216) and its autopilot interaction are dead code. | The feasibility "checkpoint" can never actually block or reframe a bad brief; phase-0 gate is illusory | Widen score ranges (e.g. allow feas < 4 when complexity high), or lower reframe threshold to ~6.5 with a real low-range axis, or drive verdict from a real model |
| B-03 | P2 | engine.ts:715-740 (approveHitl) + store.ts:42-46 (canAutopilot) | (a) Approving a **failed** P6 sandbox seals the phase complete; packet keeps printing `Sandbox: FAIL` — contradictory project state. (b) Autopilot auto-approves *non-stock* HITL gates when `tightness < 7.2` — this includes the "Sandbox failed — review" gate, so autopilot silently waves through failing generated-code tests for typical (low-tightness) domains. | Failed code can be promoted through the graph with no human eyes | In `approveHitl`, if `phase===6 && lastTest && !lastTest.ok` require explicit confirmation or force a regeneration cycle; exclude "test failed" HITL prompts from `canAutopilot` |
| B-04 | P2 | engine.ts:742-783, 363-423 | Rejection feedback cannot steer regeneration: `rejectHitl` stores a note and blocks; `unlockRetry` re-runs the **same deterministic** `synthesizePhase`, which produces byte-identical artifacts for every phase except P6, where the note only becomes a `REJECTION` constant in the demo module. The vision's "Rejection forces loop iteration" (master doc:33) and "mandatory qualitative feedback…preventing infinite aimless regeneration" (master doc:70) is a UI loop with no generative effect. | Human rejections are theatrical — retry always regenerates the same content | Thread the note into synthesis (e.g. P6 should regenerate/alter the module; other phases should at least annotate artifacts with "regenerated after: <note>" and vary content) |
| B-05 | P2 | engine.ts:837-839 (emptyProject) | Packet compiled **before** `bootstrapMemory` replaces memory: a brand-new project's packet says `(empty — treat Phase 0 research as first write)` while the memory rail shows 3 bootstrap entries. Packet/memory disagree out of the box. | Confusing packet for every fresh run | Swap order: set memory first, then `attachAlgorithms` |
| B-06 | P3 | store.ts:96-103 + packet.ts:73-82,111 | After a non-HITL phase completes, `currentPhase` advances to next but `packet` is **not** recompiled until the next action; copying the packet right after a run describes the *just-completed* phase as the "Current edge" and prints the wrong "Next legal edge" (also prints `P12` when already at 12). | Stale/self-contradictory agent instructions | Recompile packet whenever `currentPhase` changes (extract a store helper) |
| B-07 | P3 | sandbox.ts:18-23 + engine.ts:388-392 | `healSource` is a no-op for every real input: P6's template always defines `test_happy`, so `!source.includes("function test_happy")` is always false; the second `runGenerated` replays identical bytes. The "self-healing refactor loop" (master doc:52) exists only as scaffolding. | False sense of retry robustness | Make heal actually mutate (e.g. strip the offending construct, add a fallback definition) or delete the double-run |
| B-08 | P3 | store.ts:201-211 (clone) | "Clone" creates a fresh `emptyProject` from name+brief — **no artifacts, phases, memory, or packet copied**. UI label implies duplicating the build. | Users lose the run when expecting a copy | Deep-copy the project with a new id + `copy` suffix, or rename the action |
| B-09 | P2 | store.ts:263-266 + console.tsx:47-54 + index.tsx | SSR/client mismatch risk: server renders `projects: []` (no localStorage in Node), client store hydrates synchronously at module import and `seedIfEmpty()` creates the demo "Northwind Dispatch" before first client render ⇒ hydration text mismatch (count "0", "No builds yet." vs the seeded list) on every fresh visit. Runtime-unverified (app not run per task rules) but follows from the code paths. | Console hydration errors in dev; possible repaint flicker in prod; demo project appears for all visitors | Gate seeding to a `useEffect`/`useLayoutEffect` + client-only flag, or render the list with a mounted-state guard; keep `suppressHydrationWarning` scoped |
| B-10 | P2 | db.ts:88-106 vs 183-188 | Docstring claims migrations "auto-applied before the first query on both backends", but the Neon path never applies `migrations/*.sql` (only PGLite does, 139-157). Dev or preview with `DATABASE_URL` set silently gets an **unmigrated** schema; prod depends on the build script having run `db:migrate`. | Schema drift / runtime "relation does not exist" on Neon if deploy skips migrate | Run the same pending-migration pass against the Neon pool (guarded, idempotent) or fix the comment |
| B-11 | P2 | engine.ts:622-645, 700-712 + store.ts:242-254 | `attachAlgorithms` runs on **every** mutation (1× seed/hydrate, 2× per phase result, 1× per approve); each run re-executes 8 algorithms and recompiles the full packet (~14 KB) synchronously on the main thread; `runAlgorithms` also computes `ranked` that the caller discards, then `compileAgentPacket` recomputes `fusionRank` a second time (packet.ts:10-14). | Redundant CPU + repeated Date.now trace churn; grows with project count on every boot via seedIfEmpty→hydrateProject | Memoize per `(brief, domain, memoryVersion, phase)`; drop `ranked` from runAlgorithms or pass it through |
| B-12 | P3 | engine.ts:147-152 (mem id) | Memory ids are `\`${phase}-${kind}-${score}\`` — two memory rows in the same phase with equal kind+score collide (e.g. re-running a rejected P6 can recreate an identical id). React keys (console.tsx:588) and FusionRank's id-keyed map (algorithms.ts:203) then see duplicates. | Duplicate-key warnings; ranking dedupe treats distinct thoughts as one | Include a counter/timestamp or content hash in the id |
| B-13 | P3 | store.ts:150-155 (runUntilHitl) | Mid-loop errors after progress are swallowed: loop `break`s and returns `{ok:true, ran:n}` — the UI shows success with no hint the run stopped early on an error (as opposed to a HITL stop). | Confusing partial runs | Return `stoppedReason`/`error` on partial stop |
| B-14 | P3 | phases.ts:110-112 + engine.ts:129 + console.tsx:309 | `PHASES[phase]` and `project.phases[phase]` rely on the unwritten invariant "array index === phase id, length 13". `hydrateProject` (engine.ts:860-863) silently wipes phase history when the invariant breaks (e.g. corrupted localStorage). | Undefined-phase crash or silent history loss on malformed storage | Index by `Map`; on hydrate, repair per-id instead of wholesale reset and log it |
| B-15 | P3 | algorithms.ts:141-148, 205-209, 379 | Substring matching everywhere: phraseHits (`includes`) mis-lexes words ("tech"⊂"technology", "scan"⊂"scanning", "bill"⊂"billable"); `name.includes(k)` field-bank keys collide ("jobs"→job fields, any name containing "order" gets order fields); tokens/overlap double-count stems ("job"/"jobs" distinct). | Noise in lattice/entities/fields → downstream artifacts | Word-boundary regex or stemming + longest-match key selection |
| B-16 | P3 | algorithms.ts:217-218 | FusionRank's multi-list RRF accumulation branch is dead: items are partitioned by kind, so each id appears in exactly one list; `prev.rrf + rrf` can never fire for distinct entries (only for duplicate ids, which B-12 can create). | Claimed RRF-over-lists not actually implemented | Merge per-kind ranks into a true multi-list RRF or document single-list behavior |
| B-17 | P3 | algorithms.ts:420-462 (routeCrew) | Fallback `if (!seats.some(active)) seats[0].active = true` (460) force-activates the **architect** on P4 (security/isolation) and P7 and P11 — phases where the architect's mandate doesn't match the work; implementer is never active on P7 despite P7 building nothing new. Packet crew section misrepresents who is working. | Cosmetic misinformation in the packet | Pick active by phase→role map with a sensible default per phase |
| B-18 | P3 | engine.ts:77 vs types.ts:181-186 vs sandbox.ts | Packet claims `net-deny on generated exec` (packet.ts:77) and sandbox claims `wasm/256MB/30s` — none of these exist in the real `new Function` execution path. | The "governed sandbox" narrative is fiction in the current implementation | Align copy with reality or implement real isolation (worker + caps) |
| B-19 | P3 | store.ts:96-103 + packet.ts:74-77 | After auto-advance the store's `status` can say `running` with currentPhase N+1 ready while packet artifact still describes N — same root cause as B-06; listed separately for the artifact-vs-store divergence it produces in the Artifacts tab. | Stale "Current edge" packet artifact | See B-06 fix |
| B-20 | P3 | db.ts:93-95 | `types.setTypeParser(20, Number)` mutates the process-global `pg` type parsers — any other `pg` user in the process (incl. auth if it shares the driver) silently gets int8-as-number; >2^53 ids lose precision. | Cross-module global side effect | Scope parsers to the pool/query or document the shared-driver contract |
| B-21 | P3 | algorithms.ts:593-596 | `estimateTokens().usd` computed (3e-6 $/token) but never consumed; `tokensEst = len/4` is a crude heuristic presented as "~N tok" in the header (console.tsx:291). | Misleading token budget display | Use a real tokenizer for the displayed number, drop or use `usd` |
| B-22 | P3 | engine.ts:73-97 | `scorecard()` fallback (overall 6, "Run algorithms before scoring") is dead — `attachAlgorithms` always pre-populates lattice/schedule; and its `libraries` block is hard-coded marketing, not derived from anything. | Dead branch + fabricated "recommendation" | Remove fallback or derive libraries from the lattice |
| B-23 | P3 | engine.ts:51-62, 15-41 | `inferDomain` regex order gives "healthcheck tool for fleets" → health-ops; `marketFor` always appends Cursor/v0 to every domain including competitors-of-itself cases; competitor rows are static strings pretending to be research. | Domain misrouting cascades into risk profile, HITL set, and competitors | Order-specificity scoring; mark market data as illustrative |
| B-24 | P3 | store.ts:147-163 | `runUntilHitl` 16-iteration cap is enough today (≤4 phases between stock gates) but unlabeled magic number; if HITL topology changes (e.g. all gates removed), 16 silently truncates a full run at P? with `ok:true`. | Silent truncation risk | Loop until terminal state with a max derived from PHASES.length + guard |
| B-25 | P3 | engine.ts:842-867 | `hydrateProject` mutates legacy rows on **every** boot (seedIfEmpty maps over all projects), and rewrites `phases` from scratch when length ≠ 13 — no log/notice of the reset. | Repeated rewrite churn + silent history loss | Version the persisted payload; one-shot migration with a log entry |

---

## 7. Dead code / TODOs / stubs / half-implemented features

### Dead exports & modules (verified by whole-tree grep, excluding auth/app-data/multiplayer)
- **`src/lib/ai.ts` — `enrichBrief`**: zero importers in `src/`. The only AI call in the app is unused; AGENTS.md's XAI_API_KEY guidance is moot for the core.
- **`phaseDef()`** (phases.ts:110-112): zero callers (PHASES direct indexing used instead).
- **`HITL_PHASES`** (phases.ts:126): zero callers (`STOCK_HITL` used).
- **`estimateTokens().usd`** (algorithms.ts:594): computed, never read.
- **`runAlgorithms().ranked`** (algorithms.ts:530, 590): computed then discarded by `attachAlgorithms` (engine.ts:623-640 destructures without it); A2 is re-run inside `compileAgentPacket` (packet.ts:10).
- `phaseDef`/`usd` are type-checked and tree-shaken harmlessly — but they are dead weight and signal unfinished wiring.

### Stubs / half-implemented behavior (quoted)
- sandbox.ts:18-23 — `healSource` only handles "test_happy missing", which never happens (B-07). The "self-healing loop" is a stub.
- engine.ts:368-387 — Phase 6 "generated code" is a fixed template module whose only dynamic inputs are `JOBS`, `REJECTION`, and the project name; it does not implement the user's software. `generatedSource` is a demo artifact.
- engine.ts:89-95 — the scorecard's `libraries` list ("LiteLLM-compatible router", "FastMCP", "Ollama"…) is aspirational copy; none of these are integrated.
- engine.ts:208-216 — P0 reframe HITL (dead by arithmetic, B-02).
- engine.ts:651-658 — P6 failure HITL fallback (unreachable; P6 sets its own, B-03 context).
- engine.ts:73-85 — placeholder scorecard branch (dead, B-22).
- algorithms.ts:264-293 — `topo()`'s cycle throw is defensive dead code for the synthetic DAG.
- models: `runtime:"wasm"/"cgroups-v2"/"gvisor"`, `ramMb:256`, `timeoutS:30`, `isolated:true` (types.ts:181-186, engine.ts:817-822) — **configuration theater**: nothing enforces any of it (sandbox.ts has no caps).
- `modelRoute` (types.ts:13, engine.ts:816): hard-coded `"local-edge"`; the `"grok-4.5"`/`"failover"` routes exist only as labels and in ai.ts's error strings.
- phases.ts P2 summary promises "Durable checkpoints … RRF + cross-encoder re-rank" — implemented as text artifacts + heuristic score only.
- `Autopilot · extra gates` (console.tsx:299): implemented but semantically dangerous for failed tests (B-03).

### TODOs / markers
- No `TODO/FIXME/XXX/HACK` comments anywhere in the audited files (grep-verified).
- No tests exist for engine/algorithms/store/sandbox/packet (package.json `test` covers `scripts/**` + app-data + auth only). The most logic-dense files — `advanceOnce`, `applyPhaseResult`, `fusionRank`, `topo`, `feasibilityScorecard` — are untested, which is how B-02 (unreachable verdict) and B-07 (no-op heal) shipped unnoticed.

---

## 8. Potentiality analysis — what the architecture enables but does not use

1. **The 13-phase graph machine is real and sound.** The store's `advanceOnce/runReady` transition logic, `priorsSealed`/`canEnter` guards, HITL parking, and rejection-note plumbing are a credible skeleton for a governed pipeline. The missing piece is a **generative backend**: today `synthesizePhase` returns canned strings. Swapping each case to call an LLM/agent (as `ai.ts` was starting to do) with zod-validated output would activate the whole graph with no structural changes. The deterministic fallback content also gives a graceful degrade path — a genuinely good design property.
2. **`db.ts` is a ready-made server data layer** (Neon in prod, PGLite in preview, atomic migrations, HMR-proof globals) that the engine never calls. Wiring engine events (project.created, phase.complete, hitl.decided) into it would deliver the vision's "durable checkpointing" and cross-device runs; the store's `hydrateProject` already anticipates versioned persistence.
3. **A2's plumbing supports a real re-ranker**: `fusionRank` is a pure, unit-testable function whose `ce` term is a placeholder constant — swap in a cross-encoder call and the signature holds.
4. **The packet (A4) is the under-leveraged killer feature**: it is the only artifact meant to leave the app. Unused capabilities: (a) `ai.ts:enrichBrief` could name/domain-tag the project at creation; (b) nothing server-side can fetch a packet (no API route) so external agents must be fed manually; (c) `project.notes` — the operator's steering channel — is exported to the file but **never embedded in the compiled packet**, so a copied packet omits exactly the human corrections the rejection policy depends on (B-04 family).
5. **Traces are disposable**: `AlgorithmTrace` exists and the UI renders trace cards, but traces are replaced on every mutation (engine.ts:632-640) — no history, no drift analysis, no "self-optimization" loop the vision (master doc:35) describes.
6. **Artifact set is browsable but not consumable**: `Artifact.body` for P9 (GitHub Actions YAML), P12 (OpenAPI/ADR) could be written to a real repo by a future executor; today they are read-only text in a `<pre>`.
7. **Weak/absent**: `modelRoute` failover fiction; crew-seat `active` mislabeling (B-17); scorecard "verdict" never reframes (B-02); competitor research is static (B-23); UI claims "four onboard algorithms" while eight exist (A1-A8) — the four named in the copy are the four the vision doc's summary highlights, but A5-A8 (spec graph, contracts, oracle, crew) are silent in marketing while fully wired into the packet.

---

## 9. Security review of the audited files

1. **`sandbox.ts` (highest-risk surface).** `new Function(body)` executes engine-built source in the page's global scope (sandbox.ts:10). The denylist (line 1) is substring-based: `Function` and `eval` banned as literals but reachable via `[].filter.constructor("…")` or `(0,eval)` — wait, `eval` literal banned, but `globalThis.eval` is banned too via `globalThis`; `this.constructor.constructor("…")()` is not banned; dynamic `import(` is not banned (`import\s` requires whitespace); bare `fetch(` is not banned (only `window.fetch`); `WebSocket`, `Worker`, `navigator`, `location`, `postMessage`, `indexedDB` (banned literal), `crypto.subtle` all reachable. No timeout ⇒ `while(1){}` freezes the tab (B-01). **Mitigating fact**: today the only producer of `source` is engine.ts:368-387 template code whose dynamic inserts are `JSON.stringify`-escaped strings (name/note/jobs), and lattice jobs come from the closed `LEX` vocabulary — direct injection from a user brief is not currently possible. Do not feed model output here without real isolation (worker + CSP + caps).
2. **Secrets/tokens.** Only `XAI_API_KEY` (server env, ai.ts:6) — sent as `Authorization: Bearer …` over TLS to `api.x.ai` (verified byte-exact), server-only via `createServerFn`; no client exposure, no logging of the key. `db.ts` reads `DATABASE_URL` server-side (db.ts:8-11). No other credentials in the audited tree. localStorage holds project content only (briefs, notes, artifacts) — no secrets by construction; packet text may echo brief content, so users pasting secrets into briefs would persist them in localStorage — worth a doc note, not a code flaw.
3. **Injection.** SQL: all queries parameterized — tagged template rebuilds `$1..$n` (db.ts:79-81); migration SQL is bundler-embedded trusted files executed via `exec` inside transactions (152-155); no string-concatenated user input reaches SQL. DOM: no `dangerouslySetInnerHTML` in any audited component; artifacts/briefs/packet render inside `{...}` text nodes, `<pre>`, `<textarea>` — React-escaped. Packet is markdown for *external* agents — a hostile brief could prompt-inject the downstream agent (packet.ts:30-34 instructs "you may only work the current phase…"), which is inherent to the copy-paste design; the "attack vectors" section of the scorecard (algorithms.ts:519-523) even acknowledges prompt injection via ingested pages.
4. **AuthN/Z.** Engine has none — by design: no server endpoints, no user data, local-only state. AGENTS.md's auth-off rules are respected (no auth import in core; no `requireUserId`; migrations/auth left to the auth subsystem).
5. **HITL integrity.** Rejection requires ≥12 chars (store.ts:178 + UI disable, console.tsx:749). Approve guard checks `hitl.phase === currentPhase` (store.ts:168-170). Weakness: `approveHitl` itself (engine.ts:715-740) does not verify a pending HITL exists or that `lastTest` passed (B-03) — it is only safe because the store pre-checks; any future caller (server route, autopilot change) must re-implement those checks.
6. **Denial-of-service.** `compileAgentPacket` and the algorithm suite run synchronously on every mutation; pathological briefs are bounded (packet slice 14000, artifacts 900-char bodies, memory 80, logs 200), so worst-case CPU per click is small and bounded. No unbounded loops found: `runUntilHitl` capped at 16 (store.ts:148), `topo` terminates (each pop decrements), `fusionRank` linear-ish. LocalStorage payload per project is bounded (~tens of KB); many projects could approach the ~5 MB quota over months — `remove()` exists; no quota handling.
7. **SSR/client consistency** is the main *reliability* (not security) wrinkle — B-09.
8. **Supply chain**: package.json pins/overrides (`nf3: 0.3.17`) and the app ships the Grok PWA injector per AGENTS.md platform contract; outside audit scope to change, but the core adds no new runtime deps beyond the platform stack.

Net: no exploitable injection or secret leak in the audited core **today**; the two things to fix before this ever executes untrusted or model-generated code are the fake sandbox (B-01) and the process-global pg parser mutation (B-20).

---

## 10. Audit method & confidence notes

- All line numbers refer to the files as read on 2026-09-04. Paths: `C:\Users\mnril\Desktop\RapidTool Main\src\…`.
- Findings marked "runtime-unverified" (B-09, plus any SSR behavior) follow from code reading but the app was not executed, per task rules.
- `scripts/migration-plan.mjs` (imported by db.ts:1) was not read (scripts/ is owned by another agent); its contract was inferred from call site (db.ts:149): `pendingMigrations(names, done) → {name, path}[]`.
- The `Authorization: ***` shown in one earlier text dump of ai.ts was a display-redaction artifact; raw bytes confirm `Bearer ${apiKey}` (od -c verified).
- Cross-file usage counts were established by whole-tree grep; auth/app-data/multiplayer/scripts were excluded from content analysis but included in the import-graph grep.

---

## 11. Headline verdict

The core is a **well-structured, pure-function state machine with an honest, readable data model and a clean store layer — but it is a deterministic simulator of the vision, not the vision itself**: no LLM call is wired (ai.ts dead), no code is generated for the user's brief (P6 is a canned self-test), the "sandbox" is an unconstrained `new Function`, and the database layer that would give it durability is orphaned from the engine. The strongest assets to build on: the phase/HITL machine in `store.ts`+`engine.ts`, the pure algorithm suite in `algorithms.ts`, the packet compiler, and `db.ts`'s Neon/PGLite dual-backend readiness. Priority fixes: B-01 (sandbox honesty/isolation), B-02 (unreachable reframe verdict), B-03 (approve/fail semantics + autopilot), B-04 (rejection steering), B-09 (hydration), B-10 (Neon migrations), then wiring `ai.ts` + `db.ts` into the graph to make the factory real.

---

# Appendix A — Algorithm reference cards (step-by-step pseudocode + line refs)

Each card lists: inputs → numbered transformation steps (with real `algorithms.ts` line refs) → output → edge cases → linked bugs.

## A0-support — tokenizers & scoring primitives

**`tokens(text)`** (algorithms.ts:123-129)
1. lowercase; 2. replace every char outside `[a-z0-9+\- ]` with a space; 3. split on whitespace; 4. drop length-1 tokens and stopwords (`STOP`, :16-20). Output: string[].
Edge: hyphenated terms survive as one token ("same-day"); punctuation glues nothing ("sla" from "SLA" fine, "2fa" kept — length 3).
Linked: B-15 (stem/substring noise downstream).

**`phraseHits(text, vocab)`** (algorithms.ts:131-134)
1. lowercase text once; 2. return every vocab term v where `text.includes(v)` (substring!). Output: string[] in vocab order.
Edge: term "job" matches "jobs/jobber/unjobbed"; term "scan" matches "scanning/scanner"; multi-token vocab terms would never match (none exist today). Linked: B-15.

**`overlap(a,b)`** (algorithms.ts:181-187)
1. if either empty → 0; 2. count tokens of `a` present in set(b); 3. divide by `sqrt(|a|*|b|)`. Output: 0..1 cosine-lite.
Edge: duplicates in `a` count repeatedly; symmetric only when both have unique tokens (a=[x,x],b=[x] → 1/√2 ≠ √2/2 asymmetry… actually 1/√2 both ways → symmetric for this pair; a=[x,x],b=[x,y] → 1/√4=0.5 vs b-over-a: 1/√4=0.5 — symmetric, fine). Pure.

**`rrfScore(rank, k=60)`** (algorithms.ts:177-179): `1/(60+rank)`, rank 0-based → 1/61 max. Mirrors vision's "RRF(k=60)" (master doc:21) but with a single list (see A2 card).

## A1 — Intent Lattice (algorithms.ts:137-175)

Input: `brief: string`, `domain: string`. Output: `IntentLattice {domain, jobs[], entities[], constraints[], nodes[], complexity}`.
1. `bag = tokens(brief)` (:138).
2. For each kind in `actor|job|object|constraint|risk` (order of `Object.keys(LEX)`, :140): for each vocab term contained in the brief (:141), compute `freq` = count of bag tokens containing the term or its first word (:142).
3. weight = `min(1, 0.35 + freq*0.2 + (kind==="constraint" ? 0.15 : 0))` (:146).
4. Dedupe on `kind:label`, keep first (:150-156); sort nodes by weight desc (:157).
5. Domain bootstrap: health-ops without both `hipaa` constraint and `phi` risk gets both injected at 0.9 (:158-163).
6. Split nodes into jobs (kind=job) / entities (kinds actor|object) / constraints (:164-166).
7. Fallbacks: no jobs → `["deliver-core-workflow"]`; no entities → `["operator","record"]` (:169-170).
8. Cap `nodes` at 18 (:172); `complexity = min(10, 3 + unique.length*0.45 + constraints.length)` (:173).
Edge: substring lexing noise; a label appearing as both actor and object is kept twice under different kinds (intended dual-role); weight ceiling 1.0 collapses high-frequency terms.
Linked: B-15; supplies inputs to A3/A5/A6/A7/A8.

## A2 — FusionRank (algorithms.ts:190-231)

Input: `query: string`, `memory: MemoryEntry[]`, `limit=6`. Output: `{id,score,text,kind}[]` desc by score.
1. `q = tokens(query)` (:195); bucket memory into episodic/semantic/procedural (:196-201).
2. Per kind: sort entries by `overlap(q, tokens(text)) + score*0.15` desc (stable) (:205-209).
3. Per entry at rank i: `ce = 0.55*overlap + 0.25*score + 0.2*kindPrior` with kindPrior 0.9/0.7/0.5 for procedural/semantic/episodic (:211-214); `rrf = rrfScore(i+1)` (1-based rank) (:216).
4. Merge into map keyed by memory id — accumulation branch `prev.rrf + rrf` (:217-218) fires only if one id exists in two kind buckets, which partitioning makes impossible (dead branch; see B-16).
5. Score each: `round((0.6*rrf*10 + 0.4*ce)*1000)/1000` (:227); sort desc (:229); slice limit (:230).
Edge: empty query → all overlap 0, ranking degenerates to `score*0.15` ordering within kind, then static ce; kind-population imbalance (1-entry kind always outranks its singleton vs a crowded kind's tail); max score ≈ 0.5 so printed scores look arbitrary (packet.ts:85).
Linked: B-12 (id collisions), B-16; recomputed twice per phase run (engine.ts:runAlgorithms + packet.ts:10-14, B-11).

## A3 — Constraint Scheduler (algorithms.ts:234-254)

Input: `lattice`, `domain`. Output: `SchedulerPlan {securityDelta, apiDelta, tightness, extraHitl[], notes[]}`.
1. `base = DOMAIN_RISK[domain] ?? custom-software` (:235).
2. `securityDelta = base.security + (any constraint matching /hipaa|pci|gdpr|soc2|phi/ ? 1 : 0)` (:237).
3. `apiDelta = base.api + (constraints.length > 2 ? 1 : 0)` (:238).
4. `extraHitl`: += P6 if `hitlBias || securityDelta >= 2` (:240); += P11 if `apiDelta >= 2` (:241).
5. `tightness = round1(min(10, 4 + securityDelta*1.5 + apiDelta + complexity*0.25))` (:242-246); notes text per delta (:248-252).
Edge: regulatory regex is substring over already-substring-matched constraint labels — "soc2" label only exists if brief contained it verbatim-ish; health-ops briefs without the word HIPAA still get the node injected by A1 step 5, so Δ rises. tightness range ≈ 4.6–10.
Linked: drives P6/P11 extra HITL (engine.ts:393, 559) and autopilot eligibility (store.ts:45).

## A5 — Spec Graph Planner (algorithms.ts:264-293, 296-344)

Input: `lattice`, `domain`. Output: `SpecGraph {nodes, order}`.
1. jobs = lattice.jobs capped 5; job node ids `job-0..job-4` (:297-298).
2. Build 5+N+2 synthetic nodes: schema (root, architect), api/store (depend schema), one node per job (depend api+store), ui (depend store + all job ids), tests (depend api+ui) (:299-342); file paths derive from domain/job slugs (:302, 323).
3. `topo()` (:264-293): in-degree map + adjacency; seed FIFO queue with in-degree 0 in node-insertion order (:278); loop: shift node, append to order, decrement successors, enqueue at 0 (:280-288).
4. Any node never ordered → throw `"Spec graph contains a cycle"` (:289-291).
5. Return nodes + order (:343).
Edge: nonexistent `dependsOn` targets skipped silently (:273); deterministic order (insertion-ordered queue); cycle throw unreachable for the synthetic graph (defensive).
Linked: order consumed by packet (packet.ts:56-62) and Spec tab (console.tsx:505-523).

## A6 — Contract Synthesizer (algorithms.ts:346-388)

Input: `lattice`. Output: `DataContract {entities, endpoints}`.
1. `names = unique(entities ∪ jobs)`, cap 6 (:377).
2. Per name: `key = first FIELD_BANK key contained in name` else "default" (:379); entity = `{name: pascal(name), fields: FIELD_BANK[key]}` — **shared array reference** (:380).
3. Per job (cap 6): method = GET if job matches `/report|search|track/` else POST (:383); path `/v1/<job slug>` (:384).
Edge: substring key pick ("jobs"→job bank with assigneeId/slaDue; "order"→order bank); entities named e.g. "patient-order" → first matching key wins; pascal() mangles hyphenated labels (:256-262).
Linked: B-15; consumed by packet (packet.ts:64-68) and P12 OpenAPI paths (engine.ts:569-585).

## A7 — Test Oracle (algorithms.ts:391-416)

Input: `lattice`. Output: `OracleTest[]`.
1. One happy test per job (cap 5): given "Authorized operator submits <job> with a valid <first entity>", expect "200 + persisted entity + checkpoint written" (:392-398).
2. One constraint test per constraint (cap 3): expect "403 or 422; no side effect; diagnostic JSON" (:399-407).
3. Always append `graph.no-skip` (:408-414).
Edge: constraint labels may be empty → no extra tests; oracle ids `orc-c-<constraint>` can collide with `orc-<n>` only if constraint named like a number (impossible).
Linked: rendered in Tests tab + packet (packet.ts:70-71); never executed against real code (only the P6 canned module runs, engine.ts:388-392).

## A8 — Crew Router (algorithms.ts:419-462)

Input: `lattice, schedule, phaseTitle, phase`. Output: `CrewSeat[]` (4 seats).
1. `tight = tightness >= 7` (:425) → budgets architect 1800/implementer 3200/tester 900 else 2600/4800/1400; reviewer fixed 1400 (:431, 439, 447, 455).
2. Mandates/handoffs/tools are static strings templated with jobs/phase/constraints (:429-458).
3. `active` by phase: architect `phase<=3`; implementer ∈{6,8,10}; reviewer ∈{5,9,12}; tester ∈{5,6} (:433, 441, 449, 457).
4. If none active → force `seats[0].active = true` (:460) — architect wrongly flagged on P4/P7/P11.
Edge: phase 4 (isolation) shows architect ACTIVE; implementer never active on P7.
Linked: B-17; seats serialized into packet (packet.ts:51-54) and Crew tab.

## A-support — bootstrapMemory / feasibilityScorecard / runAlgorithms / estimateTokens

- **`bootstrapMemory(lattice)`** (:464-488): returns exactly 3 fixed entries (`boot-sem/boot-proc/boot-epi`) summarizing domain/jobs, graph rules, constraints.
- **`feasibilityScorecard`** (:490-525): per-axis clamps/arithmetic at :497-501; `overall` = rounded mean (:509); verdict thresholds ≥7.5/≥6/:512. See B-02 for the unreachable-`reframe` arithmetic: min overall = (8+7+8+4+8)/5 = 7.0 given A1 guarantees jobs.length ≥ 1 (delivery=8, :501) and axis ranges.
- **`runAlgorithms(project)`** (:527-591): ordered pipeline A1→A3, A2 (result discarded by caller — engine.ts:623-640), A5→A8; assembles 7 traces (ids A1,A2,A3,A5,A6,A7,A8 — note **no A4**, added later by attachAlgorithms engine.ts:634-639); A2 query = `PHASES[currentPhase].title + brief + jobs` (:540).
- **`estimateTokens(packet)`** (:593-596): `len/4` char-heuristic; `usd` = tokens × $3e-6, rounded to 4 dp — never consumed (B-21).

---

# Appendix B — Consolidated export inventory & worked end-to-end trace

## B.1 Export inventory (per audited file)

**`engine.ts`**
- `inferDomain(brief: string): string` — :51
- `inferName(brief: string): string` — :64
- `synthesizePhase(project: Project, phase: PhaseId): { artifacts; memory; logs; scorecard?; competitors?; openapi?; adr?; generatedSource?; lastTest?; hitl? }` — :116
- `applyPhaseResult(project: Project, phase: PhaseId): Project` — :647
- `approveHitl(project: Project): Project` — :715
- `rejectHitl(project: Project, note: string): Project` — :742
- `unlockRetry(project: Project): Project` — :777
- `emptyProject(input: { name: string; brief: string }): Project` — :785
- `hydrateProject(raw: Project): Project` — :842
- (private) `marketFor(domain): Competitor[]` :15 · `slug(s): string` :43 · `scorecard(project): FeasibilityScorecard` :73 · `art(phase,kind,title,body,language?): Artifact` :99 · `attachAlgorithms(project): Project` :622

**`algorithms.ts`** — `intentLattice(brief, domain): IntentLattice` :137 · `fusionRank(query, memory, limit=6): {id,score,text,kind}[]` :190 · `scheduleConstraints(lattice, domain): SchedulerPlan` :234 · `planSpecGraph(lattice, domain): SpecGraph` :296 · `synthesizeContracts(lattice): DataContract` :376 · `buildTestOracle(lattice): OracleTest[]` :391 · `routeCrew(lattice, schedule, phaseTitle, phase=0): CrewSeat[]` :419 · `bootstrapMemory(lattice): MemoryEntry[]` :464 · `feasibilityScorecard(lattice, schedule): {overall;verdict;axes;bottlenecks;attackVectors}` :490 · `runAlgorithms(project): {lattice;schedule;ranked;specGraph;contracts;oracle;crew;traces}` :527 · `estimateTokens(packet): {tokensEst;usd}` :593 · (private) `tokens` :123 · `phraseHits` :131 · `rrfScore` :177 · `overlap` :181 · `pascal` :256 · `topo` :264

**`phases.ts`** — `PHASES: PhaseDef[]` :3 · `phaseDef(id): PhaseDef` :110 (dead) · `canEnter(from,to): boolean` :114 · `priorsSealed(phases, target): boolean` :118 · `HITL_PHASES` :126 (dead) · `STOCK_HITL` :127

**`packet.ts`** — `compileAgentPacket(project): string` :6

**`sandbox.ts`** — `runGenerated(source): {ok:boolean; detail:string}` :3 · `healSource(source, error): string` :18 · (const) `FORBIDDEN` :1

**`store.ts`** — `useRapid: zustand store` :111 with `RapidState` :16-36 · (private) `byId` :38 · `canAutopilot` :42 · `advanceOnce` :48 · `runReady` :80

**`templates.ts`** — `BRIEF_TEMPLATES: {id;label;brief}[]` :1 (4 entries)

**`ai.ts`** — `enrichBrief: createServerFn` :3 (dead)

**`db.ts`** — `dbSource: DbSource` :19 · `interface Sql` :29 · `getSql(): Promise<Sql>` :189 · `getPglite(): Promise<PGlite>` :202 · `ensureDbReady(): Promise<void>` :222 · (private) `toSql` :73 · `createNeonSql` :88 · `createPgliteSql` :108 · `createSql` :172

**`error-component.tsx`** — `AppErrorComponent({error}: ErrorComponentProps)` :4

**Routes/router** — `router.tsx: getRouter()` :5 · `__root.tsx: Route` :8 · `index.tsx: Route` :4 · `run.$id.tsx: Route` :4 · `routeTree.gen.ts: routeTree` :75 (generated)

## B.2 Worked end-to-end trace (seed project, Northwind Dispatch)

State legend: `P{n}.{status}`; actions on the left. Behavior derived from code paths above; no runtime executed.

1. **Boot, empty storage.** SSR renders `projects=[]`; client hydrates `rapidtool.v4` (nothing) → `onRehydrateStorage` (store.ts:263-266) → `seedIfEmpty()` (:242-254) creates demo project via `emptyProject` (engine.ts:785): domain=logistics (brief contains "dispatch", engine.ts:58), P0 ready, P1-12 locked, modelRoute `local-edge`, sandbox `{wasm,256,30,isolated}`; `attachAlgorithms` runs A1-A8 + packet A4 (packet claims memory empty — B-05), then memory is replaced by `bootstrapMemory` (engine.ts:837-839). [B-09 hydration mismatch risk.]
2. **Click "Execute P0"** → store `execute` → `advanceOnce` (store.ts:48): rec P0.ready → `runReady` (:80) → status running, `applyPhaseResult` (engine.ts:647) → `synthesizePhase(0)` (scorecard `overall`≈7.2-8.0 → verdict proceed-with-guards or proceed → **no HITL**, B-02) → P0 complete, logs `scorecard.ready`; since not awaiting and phase<12 → currentPhase:=1, P1 ready (:96-103); **packet NOT recompiled** (B-06). UI shows P1 as edge.
3. **Click "Execute P1"…"Execute P3"** (P1: artifact "Dispatcher topology"; P2: checkpoint plan; P3: MCP/A2A JSON) — same non-HITL pattern; each adds artifacts, 1-2 memory rows (ids `phase-kind-score`, B-12), logs; memory trimmed to 80 newest-first (engine.ts:682).
4. **"Execute P4"** → synthesizePhase(4) → hitl `{phase:4, "Approve isolation policy"}` (engine.ts:326-332) → P4 awaiting_hitl; project.status awaiting_hitl; UI HITL dock appears. `execute` again while awaiting → error "Waiting on human approval." (store.ts:63).
5. **Approve** → store `approve` checks hitl.phase===currentPhase (store.ts:168) → `approveHitl` (engine.ts:715): P4 complete, P5 ready, currentPhase 5, packet recompiled (now accurate).
6. **"Run to next gate"** (`runUntilHitl`) → advanceOnce loop (≤16): P5 runs → always HITL (engine.ts:355-361) → stop awaiting. Approve P5 → P6 ready.
7. **Execute P6** → synthesizes canned module with JOBS from lattice jobs (engine.ts:364-366), runs `runGenerated` (sandbox.ts) → tests pass → `generatedSource` + `lastTest {ok:true}` artifacts; no HITL unless schedule.extraHitl⊇6 (logistics: base.hitlBias 0, securityDelta 0 → no extra; tightness ≈ 5.0-5.9 < 7.2). P6 complete → P7 ready. If instead the module threw, `healSource` no-ops (B-07), second run fails → HITL "Sandbox failed — review" (engine.ts:393,412-421) — and autopilot could auto-approve it (B-03).
8. **Execute P7** → competitor matrix artifact (marketFor logistics: ServiceTitan + Housecall Pro + Cursor + v0/Bolt/Lovable). P8 next.
9. **Execute P8** → always HITL (engine.ts:464-469). Reject with 9 chars → store error (store.ts:178); reject with ≥12 → P8 rejected, status blocked, memory note score 1.0 prepended. UI "Retry phase with notes" → `unlockRetry` → P8 ready → Execute → **identical artifact + identical HITL prompt** (B-04). Approve → P9.
10. **Execute P9** → always HITL "Approve production routing" (engine.ts:509-514). Approve → P10. Execute P10 (edge artifact) → P11; P11 HITL only if extraHitl⊇11 (logistics: apiDelta = base.api 1 + (constraints>2?1:0); brief has 1 constraint ("offline") → apiDelta 1 → no HITL) → P12.
11. **Execute P12** → OpenAPI 3.1 + ADR artifacts (engine.ts:568-618), log `delivery.complete` "All 13 phases sealed."; status complete; currentPhase 12. UI shows "Delivery sealed"; `execute` → error "Pipeline complete." (store.ts:76). Run is a fully local, deterministic record — the "delivered software" exists only as artifacts + the packet a human must copy out.

## B.3 Cross-cutting invariants the code relies on (unwritten)

1. `project.phases` is index-ordered by id with length 13 (engine.ts:860, console.tsx:623, store.ts:53).
2. `PHASES` array order matches ids (phases.ts:110-112, engine.ts:129).
3. Every mutation path funnels through `attachAlgorithms`, so lattice/schedule/specGraph/contracts/oracle/crew/packet are always present post-creation (engine.ts:837, 865-866).
4. `Project` is serializable & JSON-safe (localStorage) — hence no BigInt/Date objects; sandbox fields are the only nested literal object.
5. HITL is single-slot (project.hitl is one request, replaced not queued, types.ts:80-85).
6. Engine executes only on the client main thread; nothing async except zustand persistence.
