// W359 PAUSED 2026-10-15 - work in progress; see wave_plans/W359/HANDOFF.md for what landed, what is half-done and what is left.
export const PHASE_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type PhaseId = (typeof PHASE_IDS)[number];

export type PhaseStatus = "locked" | "ready" | "running" | "awaiting_hitl" | "complete" | "rejected";

export type ProjectStatus =
  | "intake"
  | "running"
  | "awaiting_hitl"
  | "complete"
  | "blocked";

/**
 * Which model backend actually produced this project's LLM content (E-14).
 * The live backend is DeepSeek (llm.ts / deepseek.server.ts) â€” the old
 * "grok-4.5" | "local-edge" | "failover" labels described a target
 * architecture that was never implemented. Legacy persisted values hydrate
 * to "deterministic" (engine.ts hydrateProject) unless a logs entry shows a
 * real LLM call. "deterministic" = no LLM ever ran for this project.
 */
export type ModelRoute = "deepseek-flash" | "deepseek-pro" | "deterministic" | "none";

/**
 * The ONE stored delivery-kind taxonomy (342-4). engine.deliveryKindOf decides
 * it from the brief ONCE, withDeliveryKind stamps it at the keyed P6 seam, and
 * every resolver (engine.uiKindOf's 3-way P8 projection, scaffold.projectKindOf)
 * reads it back â€” never re-inferring from brief nouns. "app" = end-user web app,
 * "tool" = agent/CLI utility, "game" = playable game, "library" = importable
 * package, "service" = hosted API/worker.
 */
export const DELIVERY_KINDS = ["app", "tool", "game", "library", "service"] as const;
export type DeliveryKind = (typeof DELIVERY_KINDS)[number];

/**
 * W359 (resolve-kind): ONE matched signal behind a kind decision â€” the word, the
 * weight the weighted table carries for it, where it was read, and whether it
 * actually counted (`false` = a declared UI surface damped the library/tool rows).
 * Exported so an audit can re-derive a decision from the record alone.
 */
export type KindEvidence = {
  /** The kind this signal argues for. */
  kind: DeliveryKind;
  /** The matched table signal (already matched through the plural forms). */
  signal: string;
  /** The table weight; `null` for a `declared` row (an explicit kind is not a score). */
  weight: number | null;
  /** Where the signal was read. `"declared"` = the project's own stored kind. */
  source: "declared" | "brief" | "domain" | "lattice";
  /** False when the signal matched but was damped (never silently dropped). */
  counted: boolean;
};

/**
 * W359 (resolve-kind): the RECORDED delivery-kind decision â€” `kind` plus the
 * evidence that produced it, so no consumer and no audit has to re-infer why.
 *
 * The resolution is pure, deterministic and MODEL-FREE (no keyed call), so this
 * record is evidence, never a cache: `briefHash` is an FNV-1a of the exact
 * decision input, and a record whose hash no longer matches the live input is
 * STALE (readable as such) rather than a wrong answer. `kind` is never read back
 * out of this record â€” the decision is re-derived from the brief on every call.
 *
 * `basis` describes the decision the record was WRITTEN from: `"declared"` when
 * the project already carried a legal kind, `"scored"` when the weighted table
 * decided it, `"default"` when nothing matched (â‡’ `app`).
 */
export type KindResolution = {
  kind: DeliveryKind;
  /** How the RECORDED decision was made: a stored kind, a scored win, or the default. */
  basis: "declared" | "scored" | "default";
  /** Winning total (sum of the counted weights); 0 for `declared`/`default`. */
  score: number;
  /** The best-scoring OTHER kind, or null when nothing else scored. */
  runnerUp: { kind: DeliveryKind; score: number } | null;
  /** Winner score Ã· (winner + runner-up) â€” a normalized MARGIN, never a probability.
   *  1 = certain (a declared kind, or no competing kind scored); 0 = the bare default. */
  confidence: number;
  /** Every signal that matched, winner and losers alike, in the table's own order. */
  evidence: KindEvidence[];
  /** Rows damped by the declared-UI-surface rule (library/tool), when it applied. */
  damped: DeliveryKind[];
  /** FNV-1a over the exact decision input â€” the staleness key. */
  briefHash: string;
};

export type ArtifactKind =
  | "scorecard"
  | "graph"
  | "memory"
  | "mcp"
  | "security"
  | "validation"
  | "code"
  | "research"
  | "ui"
  | "cicd"
  | "edge"
  | "tools"
  | "docs"
  | "packet"
  | "algorithm"
  | "gate";

export type Artifact = {
  id: string;
  phase: PhaseId;
  kind: ArtifactKind;
  title: string;
  body: string;
  language?: string;
};

export type ScoreAxis = {
  key: string;
  label: string;
  score: number;
  note: string;
};

export type FeasibilityScorecard = {
  overall: number;
  verdict: "proceed" | "proceed-with-guards" | "reframe";
  axes: ScoreAxis[];
  bottlenecks: string[];
  attackVectors: string[];
  libraries: { name: string; role: string }[];
};

export type Competitor = {
  name: string;
  class: string;
  strength: string;
  gap: string;
  /**
   * "illustrative" = deterministic template row (never present research as fact).
   * Rows are NEVER promoted to "cited" (M-01): template prose carries no per-row
   * evidence, so real research lives in `Project.research` instead. "cited" stays
   * reserved for hypothetical future rows backed by per-row URL evidence.
   */
  source?: "illustrative" | "cited";
};

/** One real fetched finding (M-01/M-06) â€” the unit that may ground a claim. */
export type ResearchSource = {
  title: string;
  url: string;
  content: string;
};

/** One research phase's live corpus entry â€” persisted on Project (not artifact bodies)
 *  so packet citations survive artifact trimming (M-06). */
export type ResearchCorpusEntry = {
  /** The exact query that produced these items (engine researchQueryFor output). */
  query: string;
  /** Backend that served the items: tavily | duckduckgo | wikipedia | searxng. */
  provider?: string;
  items: ResearchSource[];
};

export type MemoryEntry = {
  id: string;
  kind: "episodic" | "semantic" | "procedural";
  phase: PhaseId;
  text: string;
  score: number;
  /** E-18 provenance: where this row came from (engine templates, agent
   *  reports, human HITL decisions, live research). Absent on legacy rows. */
  source?: "engine" | "agent-report" | "human" | "research";
  /** E-18: backing URL when the row is research-derived (copied into vault
   *  memory-note frontmatter so the 2nd brain keeps its sources). */
  url?: string;
  /** E-18: free-form tags (vault memory notes, search facets). */
  tags?: string[];
  /** Learning-loop retirement (fixes/136 F5, A3-04): ids of older memory rows
   *  this row supersedes â€” a supersede is an append, never a delete; the
   *  retireMemory() pass drops the declared-dead rows at the next merge.
   *  Mirrors KnowledgeEntry.supersedes. Absent on legacy rows (no-op). */
  supersedes?: string[];
  /** Learning-loop retirement: counter-evidence units against this row.
   *  retireMemory() drops a row once it reaches LESSON_RETIRE_COUNTER (3).
   *  Absent/0/NaN read as 0. Absent on legacy rows (no-op). */
  counterEvidence?: number;
  /** 216i (112 Â§3.1/Â§4.2 â€” T1): how many LATER recurrences independently
   *  reproduced this row's claim. TELEMETRY, like counterEvidence: mutated by
   *  the merge accrual (engine.accrueReproducedCounts) and never part of any
   *  content fingerprint or id â€” lesson ids hash the failure signature
   *  (knowledge.lessonRow), so a repeated identical failure maps to the ONE
   *  existing row and only this counter moves. Absent/0/NaN read as 0.
   *  Absent on legacy rows (no-op). */
  reproducedCount?: number;
};

export type JsonLog = {
  ts: number;
  phase: PhaseId;
  level: "info" | "warn" | "error";
  event: string;
  detail: string;
};

/**
 * 306 F5 (fixes/306_f5_pipeline.md) â€” coded unlock class for a parked wild run:
 * WHAT lets the run continue. Mapped to print-ready copy in engine.ts's
 * WILD_UNLOCK_TEXT (carried on every park as `unlockText`) so a UI/agent never
 * invents its own mapping:
 *  - "configure-key": configure the LLM key so Auto-Review can verdict, then resume.
 *  - "human-gate":    a human must approve/reject the open gate, then resume.
 *  - "human-retry":   a human decision is required (fix/regenerate/retry), then resume.
 *  - "resume":        plain resume retries the step (no repair named).
 *  - "operator":      the run state itself looks wrong â€” inspect, repair, resume.
 *  - "agent-seal":    resume the sealed run with a working keyed classifier
 *                     (313 D1) â€” the agent seal's Auto-Review classifier must
 *                     consent before THIS gate can be approved unattended.
 */
export type WildParkUnlock = "configure-key" | "human-gate" | "human-retry" | "resume" | "operator" | "agent-seal";

/** What the NEXT wild step acts on (the re-entry edge). "park" = the next call
 *  parks again (locked/rejected edges); "none" = terminal / nothing to do. */
export type WildNextAction = "execute" | "gate" | "advance" | "finalize" | "park" | "none";

/**
 * 306 F5 â€” the machine-readable PARK RECORD of a wild run, present on
 * `WildRunState.park` whenever `pause === true`. It answers the three
 * questions a driver, a UI and an agent all ask of a parked run without
 * reading prose:
 *   WHY                  â€” `code` (the `WildStepResult.code` RT_E_* class;
 *                          null for uncoded pauses: operator toggles and the
 *                          store's defensive step cap), plus `reason`.
 *   WHAT UNLOCKS         â€” `unlock` (coded class) + `unlockText` (same class,
 *                          one ready-to-print sentence).
 *   WHERE resume re-enters â€” `resumePhase` + `resumeAction`: the edge the next
 *                          wild step acts on after a resume. For checkpointed
 *                          runs this is the same edge the checkpoint records
 *                          as `run.phase` (headless.loadResumableCheckpoint).
 */
export type WildParkInfo = {
  /** Why (coded): the RT_E_* class of the pause; null when the pause carries no
   *  code (operator pause, store step cap). */
  code: import("./errors.ts").ErrorCode | null;
  /** Ledger event that recorded the park; null for uncoded operator pauses. */
  event: string | null;
  /** One-line reason â€” bounded copy of the park's own ledger detail. */
  reason: string;
  unlock: WildParkUnlock;
  /** Print-ready sentence for `unlock` (engine.ts WILD_UNLOCK_TEXT). */
  unlockText: string;
  /** Where a resume re-enters: the edge (phase id) the next wild step acts on. */
  resumePhase: number;
  resumeAction: WildNextAction;
  /** When the park was stamped (epoch ms). */
  at: number;
};

/**
 * 306 F5 â€” the machine-readable summary of ONE executed wild step: what ran,
 * what it produced, what's next. Stamped on `WildRunState.lastStep` by every
 * executed step so the console/CLI/agents read the SAME truth from the
 * persisted record; also carried on `WildStepResult.summary` and (flattened)
 * in the `wild.step_*` telemetry payloads. Prose (`lastAutoLog`) is for humans;
 * this is what drivers branch on.
 */
export type WildStepSummary = {
  outcome: "advanced" | "completed" | "paused";
  /** What the call did: executed a phase, resolved an open gate, left a
   *  complete phase, finalized P12 â€” or parked. */
  action: "execute" | "gate" | "advance" | "finalize" | "park";
  /** The edge the step acted on (the project's current phase at call time). */
  phase: number;
  /** A phase this step sealed (gate approval / execution); null otherwise. */
  completedPhase: number | null;
  /** The cursor moved here; null when the edge held (execute/park paths). */
  advancedTo: number | null;
  /** Net artifacts this step appended (never negative). */
  artifacts: number;
  /** What's next: the edge the next call acts on. */
  nextPhase: number;
  nextAction: WildNextAction;
  /** Present iff `action === "park"` â€” the same object as `WildRunState.park`. */
  park?: WildParkInfo;
};

/**
 * Live Wild Mode autonomous-run surface (Pillar 13) â€” the exact field set the
 * console (B7) streams: active/paused lifecycle, the frontier `phase`, and the
 * latest auto decision (`lastAutoLog`/`lastAutoAt`) so every step is observable
 * without paging the ledger. `stoppedAt` is set on natural completion (P12)
 * and on operator stops; a PAUSED run keeps `active: true` + `pause: true`
 * until the operator resumes (toggleWildPause) or stops (stopWildRun).
 *
 * 306 F5 additions (additive; absent on legacy payloads): `lastStep` carries
 * the last executed step's machine summary and `park` the coded why/unlock/
 * re-entry record of the current pause. Both are optional â€” hydrate keeps them
 * only when shaped right (engine.hydrateWildRun).
 */
export type WildRunState = {
  active: boolean;
  phase: number;
  startedAt: number | null;
  lastAutoLog: string;
  lastAutoAt: number | null;
  stoppedAt: number | null;
  pause: boolean;
  /** 306 F5: the last executed step's machine-readable summary. */
  lastStep?: WildStepSummary | null;
  /** 306 F5: why/unlock/re-entry of the current pause â€” present iff `pause`. */
  park?: WildParkInfo | null;
};

/**
 * R13-f02 (W30 lane S1 Â· fixes/272_s1_autonomy.md Â· spec Â§R13-f02) â€” the
 * plan-before-execute SHELL. Mirrors `planning.ts`'s `Plan`/`PlanStep` shape
 * (the register's "wild.plan pre-execute from planning.ts's step shape") as an
 * inline type reference so this module never statically imports the
 * server-side planner (client-safe `types.ts` stays node:fs-free).
 *
 * Honesty semantics: the planner is NOT wired yet, so `engine.readWildPlan`
 * returns an EMPTY plan (`steps: []`, `source: "empty"`) with a note naming
 * the owning row â€” never fabricated steps. The full implementation fills
 * `steps` from a real planning pass, has the classifier review them, and
 * pauses before the first mutation unless `autoPlan`/policy approves (the
 * pin: a plan exists before phase 1 mutates).
 */
export type WildPlanStep = import("./planning.ts").PlanStep;

export type WildPlan = {
  /** The goal the plan executes against (the project brief in the empty shell). */
  goal: string;
  /** Ordered steps â€” `[]` while the planner is unwired (never invented). */
  steps: WildPlanStep[];
  /** Provenance: "empty" = the shell's honest placeholder; "planner" = a real planning pass. */
  source: "empty" | "planner";
  /** Epoch ms of the planning pass; null while the shell holds no real plan. */
  plannedAt: number | null;
  /** Human-readable gap note (names the TODO row) â€” never blank on `source:"empty"`. */
  note: string;
};

export type HitlRequest = {
  phase: PhaseId;
  title: string;
  prompt: string;
  stakes: string;
  /** Human-only gate: autopilot may never auto-approve (failed-sandbox reviews, B-03/R3). */
  forceHuman?: boolean;
  /**
   * When the gate opened (epoch ms). Stamped at gate-open so the decision ledger
   * records true think-time, not `requestedAt === decidedAt` (A03). Optional for
   * legacy persisted payloads that predate the field.
   */
  requestedAt?: number;
};

export type HitlDecision = {
  id: string;
  phase: PhaseId;
  title: string;
  decision: "approve" | "reject";
  note?: string;
  decidedBy: "human" | "autopilot";
  requestedAt: number;
  decidedAt: number;
  /**
   * 216o (T-107.3 Â· P0-02/P0-06 Â· W6-L2): WHERE this decision came from â€” the
   * ONE policy seam's (`src/lib/policy.ts`) verdict that allowed it, recorded at
   * mint time by the headless approval path (`headless.ts` `approve`). ADDITIVE
   * and optional: rows minted before this field (engine autopilot steps, store
   * approvals, fixtures, pre-216o payloads) parse and stay readable â€” `dod.ts`
   * cross-checks the field against the row's own `[seat â€¦]` tag when present and
   * fails closed on a contradiction, never inventing provenance for old rows.
   *
   *   Â· `action`    â€” the registered policy action the verdict covered
   *                   (`hitl.approve` or `hitl.force`).
   *   Â· `resource`  â€” the resource it covered (`gate:P<phase>`).
   *   Â· `reason`    â€” the verdict's reason (`"<kebab-id> â€” <clause>"`, per the
   *                   policy.ts reason contract).
   *   Â· `label`     â€” the seat label in `policy.seatLabel` vocabulary
   *                   (`human/human-cli-i-am-human`, `autopilot/harness`, â€¦).
   *   Â· `tokenPath` â€” true iff the out-of-band `RT_HUMAN_SEAT_TOKEN` path
   *                   verified the human seat (the seam only ever allows a
   *                   human-seat allow through that path).
   */
  decidedVia?: {
    action: string;
    resource: string;
    reason: string;
    label: string;
    tokenPath: boolean;
  };
};

export type PhaseRecord = {
  id: PhaseId;
  status: PhaseStatus;
  startedAt?: number;
  completedAt?: number;
  rejectionNote?: string;
  /** Every rejection this phase ever received (append-only; drives regeneration steering, T9). */
  rejectionHistory?: { note: string; at: number }[];
  /** Machine-checkable DoD gate verdict recorded at phase completion (T8). */
  gate?: { passed: boolean; unmet: string[]; evidenceHash: string; checkedAt: number } | null;
  /**
   * 350 (F1): the keyed spend THIS phase MEASURED while it ran â€” the process
   * session-ledger delta across the phase's own run boundary, recorded verbatim
   * by the driver (`headless.recordPhaseSpend` at runReady / `engine.recordPhaseSpend`
   * at runPhaseAsync). ADDITIVE and optional: a phase that made no measured call
   * carries no slice (absent â‡’ "not recorded per phase", never a fabricated 0),
   * and legacy records without it parse and read exactly as before. Persisting
   * spend NEVER feeds the cap â€” the cap stays the process ledger's business.
   */
  spend?: import("./token-ledger.ts").SpendSlice;
};

export type IntentNode = {
  kind: "actor" | "job" | "object" | "constraint" | "risk";
  label: string;
  weight: number;
};

export type IntentLattice = {
  domain: string;
  jobs: string[];
  entities: string[];
  constraints: string[];
  nodes: IntentNode[];
  complexity: number;
  /** True when neither jobs nor entities came from brief vocabulary (both fallbacks fired) â€” lets the scorecard call reframe. */
  vague?: boolean;
  /**
   * The brief's own repeated content nouns (frequency â‰¥2, generic words
   * removed), frequency-ranked â€” product vocabulary the LEX bank does not
   * carry (a bakery's `donut`/`bread`/`menu`/`order`, a retailer's `cart`).
   * ADDITIVE: `entities`/`jobs`/`nodes`/`complexity`/`vague` stay the LEX-only
   * values, so no existing lattice consumer changes; product-facing artifact
   * builders merge this in (engine.productNouns). Absent for a vocabulary-free
   * brief (no repeated content noun) â†’ the deterministic fallback stands.
   */
  briefNouns?: string[];
};

export type SchedulerPlan = {
  securityDelta: number;
  apiDelta: number;
  tightness: number;
  extraHitl: PhaseId[];
  notes: string[];
};

export type AlgorithmTrace = {
  id: "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8";
  name: string;
  ranAt: number;
  summary: string;
};

export type CrewRole = "architect" | "implementer" | "reviewer" | "tester";

export type SpecNode = {
  id: string;
  file: string;
  purpose: string;
  dependsOn: string[];
  owner: CrewRole;
};

export type SpecGraph = {
  nodes: SpecNode[];
  order: string[];
};

export type ContractField = { name: string; type: string };
export type ContractEntity = { name: string; fields: ContractField[] };
export type ContractEndpoint = { method: "GET" | "POST" | "PATCH"; path: string; job: string };
export type DataContract = {
  entities: ContractEntity[];
  endpoints: ContractEndpoint[];
};

export type OracleTest = {
  id: string;
  name: string;
  given: string;
  expect: string;
  job: string;
};

/** fixes/144 (M2): one emitted source file of the multi-file generation tree. */
export type GeneratedTreeFile = {
  /** Repo-relative path, e.g. "src/domain/property.ts". */
  path: string;
  /** Full file source. */
  source: string;
  /** Content-addressed hash (fnv1a of the source) â€” integrity, not crypto. */
  hash: string;
  /** Synthesis attempt that produced this file (0 = first pass; repairs bump). */
  attempt: number;
};

export type CrewSeat = {
  role: CrewRole;
  mandate: string;
  tools: string[];
  budgetTokens: number;
  handoff: string;
  active: boolean;
};

export type Project = {
  id: string;
  name: string;
  brief: string;
  domain: string;
  createdAt: number;
  status: ProjectStatus;
  currentPhase: PhaseId;
  phases: PhaseRecord[];
  /** Feasibility scorecard (P0 output) â€” null until Phase 0 runs. */
  scorecard: FeasibilityScorecard | null;
  /**
   * Optional delivery-kind of the build (E-15 wave; WIDENED 342-4 to the
   * 5-way DeliveryKind so "library" is expressible instead of overloading
   * kind-absence). Additive â€” absent on legacy/imported projects. The engine
   * decides it once (engine.deliveryKindOf, a deterministic keyless resolution)
   * and stamps it with its evidence (engine.withDeliveryKind) on EVERY P6 path
   * (W359: keyless and non-DeepSeek runs included, not just the keyed one); every
   * resolver then READS it â€” consumers needing the scaffold names map it
   * (scaffold.projectKindOf).
   */
  kind?: DeliveryKind;
  /**
   * W359 (resolve-kind): the recorded decision behind `kind` â€” `{kind, basis,
   * score, runnerUp, confidence, evidence[], damped, briefHash}`. Written by
   * `withDeliveryKind` at the same seam as the stamp it explains, and validated
   * (never repaired) by `hydrateProject`. An absent record is honest for a
   * legacy/imported project; a present one must name the kind the project
   * carries or it is dropped.
   */
  kindResolution?: KindResolution;
  competitors: Competitor[];
  /**
   * Live-research corpus (M-01/M-06): real fetched findings per research phase,
   * kept OUTSIDE artifact bodies so packet citations survive artifact trimming.
   * Absent/empty on deterministic-only runs. Competitor template rows stay
   * source:"illustrative" regardless â€” this field is their honest counterpart.
   */
  research?: ResearchCorpusEntry[];
  artifacts: Artifact[];
  memory: MemoryEntry[];
  logs: JsonLog[];
  hitl: HitlRequest | null;
  /** Append-only gate decision journal (T2): who decided, when, and why. */
  decisions: HitlDecision[];
  modelRoute: ModelRoute;
  sandbox: {
    runtime: "worker" | "sync-template";
    ramMb: number | null;
    timeoutS: number;
    isolated: boolean;
  };
  openapi: string;
  adr: string;
  lattice: IntentLattice | null;
  schedule: SchedulerPlan | null;
  traces: AlgorithmTrace[];
  packet: string;
  specGraph: SpecGraph | null;
  contracts: DataContract | null;
  oracle: OracleTest[];
  crew: CrewSeat[];
  notes: string;
  generatedSource: string;
  /** fixes/144 (M2): multi-file generation tree â€” additive; absent on legacy
   * / deterministic payloads. Assembly + p6-arch probes consume this. */
  generatedTree?: GeneratedTreeFile[];
  /**
   * fixes/353 â€” the emitter's OWN surface modules (pages, router, game shell,
   * runnable entry), stamped by the driver immediately before the P6 gate is
   * recorded. `dod`'s kind-aware criteria read `generatedTree âˆª emittedSurface`
   * because those files are written by `scaffold.ts`, never by synthesis; the
   * field is additive and absent on legacy records (byte-identical reading).
   */
  emittedSurface?: GeneratedTreeFile[];
  /**
   * Provenance label for the last module verdict (E-07 additive; absent =
   * legacy payloads / the deterministic template self-test): "self-test" is
   * the engine-template run, "real-run" the bounded real execution of the
   * generated module (store real-run convergence, E-03), "tested" a promoted
   * machine verification pass. UI + p6 probes read `ok`/`detail` unchanged.
   */
  lastTest: { ok: boolean; detail: string; label?: "self-test" | "real-run" | "tested" } | null;
  /**
   * E-13: machine-explained engine state. `liveUnavailable` is set by
   * engine.liveLayer / deepenResearch when a research phase (0/7/11) ran but
   * live web research could not execute (backend not configured / call
   * failed) â€” the DoD p7-research waiver key. Deterministic applyPhaseResult
   * runs leave it unset so a never-attempted live phase stays an honest
   * unmet gate.
   */
  meta?: { liveUnavailable?: boolean };
  /**
   * P10: per-project Hard-DoD opt-in. Default OFF (absent/undefined) â€” gates
   * stay advisory exactly as before; when `true`, a machine advance may not
   * LEAVE phase N unless runGate(N) passes (store auto-advance guard +
   * engine wild-loop leave check). Blocked advances append a "Hard DoD block"
   * artifact + `dod.blocked` log and stop the run. Human HITL approval is
   * itself the completion act for gate phases (their DoD includes "HITL
   * approved") â€” the recorded verdict surfaces that path in the ledger.
   */
  enforceDod?: boolean;
  /**
   * P13: Wild Mode opt-in (autonomous loop). Default OFF. The engine loop
   * (`engine.wildStep`) executes the current legal phase, the Auto-Review
   * classifier judges outputs, self-approves gates and loops P0â†’P12; all state
   * rides the `wildRun` surface below. Never inferred on legacy payloads.
   */
  wildMode?: boolean;
  /** P13: live Wild Mode run state (null until a run starts). */
  wildRun?: WildRunState | null;
  /**
   * R13-f02 (W30 lane S1 Â· fixes/272_s1_autonomy.md): the plan the wild loop
   * must hold BEFORE it mutates phase 1 ("no execution without an approved
   * plan or an explicit auto-plan policy"). Additive â€” absent on legacy
   * payloads; the engine read-point (`engine.readWildPlan`) then returns an
   * honest EMPTY plan and never fabricates steps. UI/packet surfacing is
   * TODO(R13-f02).
   */
  wildPlan?: WildPlan | null;
  /**
   * P0-2: persisted chat thread (console ChatPane). Absent on legacy/imported
   * payloads; additive â€” never inferred. Rows mirror the console's ChatMsgView
   * minus the local id counter. `error` rows are display-only, never replayed
   * as model speech (chat.ts chatHistoryTurns filter is the replay law).
   */
  chatLog?: ChatLogRow[];
  /**
   * Brief-faithful implementation spec (prompt-engine expandBrief output,
   * E-30 / fixes/97 P0-01 Part B). `source` records who wrote it
   * ("prompt-verb" = the CLI prompt verb, "p6" = keyed P6 synthesis);
   * `briefHash` (fnv1a of the brief) is the staleness guard â€” a spec whose
   * hash no longer matches the current brief is discarded and re-expanded.
   * Absent/null on keyless runs.
   */
  implementationSpec?: {
    requirements: string[];
    edgeCases: string[];
    errorHandling: string[];
    typeSignatures: string[];
    dataFlow: string[];
    negativeConstraints: string[];
    source: "prompt-verb" | "p6";
    briefHash: string;
    createdAt: number;
  } | null;
  /**
   * A1 (fixes/162): human-approved (or pending) brief-derived acceptance
   * fixtures. Additive â€” ABSENCE on legacy/keyless payloads, never `[]`.
   * Hydrate + io drop invalid rows; a briefHash mismatch pending-ifies
   * every approved row (never silently re-approves).
   */
  acceptanceFixtures?: import("./brief-fixtures.ts").BriefFixtureCase[];
  /** Epoch ms of the last human approve of the fixture set. Absent until approved. */
  acceptanceApprovedAt?: number;
  /** C6: fnv1a(brief) the set was drafted against. Stale vs live brief â†’ pending. */
  acceptanceBriefHash?: string;
  /** B5: single-writer terminal run stamp (accepted|failed|aborted). Absence = no stamp. */
  acceptance?: "accepted" | "failed" | "aborted";
  /** B3: accumulated DeepSeek token usage for this run. Absence = unmetered. */
  /** W46 Â· 332-2: the persisted run spend. `SpendSlice` (token-ledger.ts) is
   *  the writer's own shape â€” widening it here stops the type under-describing
   *  what `accumulateSpend` actually stores (`calls` / cache keys). Optional
   *  keys stay optional: a legacy 2-key slice is a valid measured spend. */
  tokenUsage?: import("./token-ledger.ts").SpendSlice;

  /**
   * 348 (W2) persisted the P6 tree-run verdict here (`headless.withTreeRunVerdict`
   * â€” `ok`/`verdict` mirror the TreeRunOutcome, `verdictHash` only when the run
   * minted one); 350 (F1) TYPES it so the run report + diagnosis can attribute
   * the P6 verdict to phase 6. Absent on legacy/deterministic records â‡’ unknown.
   */
  treeRun?: { ok: boolean; verdict: "pass" | "fail"; verdictHash?: string };
  /** 348 (W2): the P6 generated-tree substance census label (`"real"`/`"stub"`/
   *  `"empty"`/`"unknown"`), persisted only when the run produced a census. */
  substance?: { verdict: string };

  /** W48 Â· 334-2: the last keyed-call outcome, persisted so a FRESH process can
   *  see that the previous run's key was refused. The tap is process-local, so
   *  without this a new `doctor` could only report `keyState: "unverified"`.
   *  Written by `headless.foldLastKeyedOutcome` (the only writer); read by
   *  `headless.resolveDoctorKeyState` and `doctor.readLastKeyedOutcome`.
   *  `keySource` is tail-only (a path/scope plus the last 4 chars) â€” never a key.
   *  Absent on legacy records stays absent; a junk blob is dropped by readers. */
  lastKeyedOutcome?: { code: string; at: number; keySource?: string };
  /** Persisted-shape version marker (B-25/R9): 2 = post-repair shape. */
  _v?: number;
};

/** One persisted chat row (display shape minus the local id counter). */
export type ChatLogRow = {
  role: "user" | "assistant";
  text: string;
  ts: number;
  /** true â‡’ a failed-send display row, never replayed as model speech. */
  error?: boolean;
  /** Normalized "RT_E_*" code when the turn failed. */
  code?: string;
  /** Grounded stamp of an assistant row ("Grounded in build context vâ€¦ â€¦"). */
  provenance?: string;
};

export type PhaseDef = {
  id: PhaseId;
  code: string;
  title: string;
  summary: string;
  hitl: boolean;
};
