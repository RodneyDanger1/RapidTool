// W359 PAUSED 2026-10-15 - work in progress; see wave_plans/W359/HANDOFF.md for what landed, what is half-done and what is left.
import { PHASES, PHASE_BY_ID, PHASE_LAST, canEnter, phaseDef, priorsSealed, stageWiringReading } from "./phases.ts";
import { DELIVERY_KINDS } from "./types.ts";
// W359 (resolve-kind): the recorded decision shape.
import type { KindEvidence, KindResolution } from "./types.ts";
import { clientSafeServerSpecifier } from "./server-spec.ts";
// 312 C3 (CF-SE2-1): bounded settlement + trust gates for the wild-review /
// P6-synthesis awaits. See settle.ts for the measured mock-starvation proof.
import { isBareNodeHost, isTrustedCallable, settleWithin } from "./settle.ts";
import type { ErrorCode } from "./errors.ts";
// T4 (112 Â§4.4 / 216g): the proven cross-project lesson-row shape the journey
// threads through LiveLayerDeps into codegen. TYPE-ONLY â€” erased at runtime, so
// this adds no static edge to knowledge.ts (which engine loads lazily above).
import type { RankableLessonRow } from "./knowledge.ts";
import { classifyError, ERROR_CODES } from "./errors.ts";
import { WILD_STEP_BUDGET_MS, flattenStack } from "./rt-events.ts";
import type { RtEventSeed } from "./rt-events.ts";
// 346 P2-6 (finishing the watchdog wiring): `boundedStepWatch` + its pure
// decision `shouldAutopause` wrap the wild step's phase-execution await below
// â€” the LAST watchdog export without a production consumer. watchdog.ts is
// zero-dep pure (rt-events + the StallLatch type), so this is no cycle.
import { boundedStepWatch, shouldAutopause } from "./watchdog.ts";
import { compileAgentPacket } from "./packet.ts";
// 313 D1 (312 C1 design): the seat-label vocabulary for the agent-seal
// provenance rows â€” policy.ts is a pure leaf (no engine import), so this pulls
// no cycle in. The seal's approval arms below mint `decidedVia.label` from
// here ("autopilot/agent-seal"), the SAME vocabulary dod.ts cross-checks
// against the row's `[seat agent-seal]` tag.
import { policyOverlayRefusal, seatLabel } from "./policy.ts";
import {
  bootstrapMemory,
  feasibilityScorecard,
  fnv1a,
  librariesFor,
  runAlgorithms,
  stemToken,
  tokenizeWords,
} from "./algorithms.ts";
import { BRIEF_CORE_REGISTER, briefTokens, buildPhase6Module, healSource, runGenerated, sandboxClaim } from "./sandbox.ts";
import {
  archTrace,
  failedGates,
  hardDodBlockInto,
  hardDodMessage,
  recordGateInto,
  runGate,
} from "./dod.ts";
// fixes/216k Â§3 (106 T-13 / F-10): doctor.ts's counted declared-vs-materialised
// job census â€” the ONE derivation (fixes/216k Â§3) now has its production
// caller at the P6 apply below. doctor.ts is client-safe by contract
// (sandbox-policy + token-ledger only â€” no node:fs) and imports no engine
// code, so this edge adds neither an engineâ†”doctor cycle nor a hydration risk
// (H2 rule).
import { jobScopeShortfall } from "./doctor.ts";
// P13 Wild Mode: the Auto-Review Supervisor classifier (configured-only â€”
// deepseek-v4-flash). Loaded lazily inside wildStep (server boundary â€” a
// static import would pull server-only code into the client bundle).
import type { WildClassifierResult, WildReviewContext } from "./wild-mode.server.ts";
// Optional real-backend integration (concurrently-authored modules). Imported
// read-only; when the underlying backend is not configured each resolves to a
// typed `{ ok: false, reason: "not-configured" }` and the engine falls back to
// its deterministic path (honesty contract â€” never fabricate live output).
import { complete, llmStatus } from "./llm.ts";
import { RESEARCH_RELEVANCE_FLOOR, research, relevanceScore } from "./research.ts";
// CF-SE2-3b (312 Â· E2): process-ledger completeness for the research narrative
// (recordSessionSpend; client-safe pure module â€” no node:fs). 346 K3 adds the
// read-only session-ledger delta the `wildStep` wrapper surfaces to a caller's
// spend sink (`onUsage`) â€” same pure module, no new dependency.
import {
  accumulateSpend,
  normalizeLedger,
  recordSessionSpend,
  sessionTokenBudget,
  spendDelta,
  totalTokens,
  type TokenLedger,
  type TokenSpend,
} from "./token-ledger.ts";
import { runCode } from "./exec.ts";
import type { ExecResult } from "./exec.ts";
import { createLlmTasks, phaseNarrative, type Completer } from "./llm-tasks.ts";
import { coerceAcceptanceFixtures } from "./brief-fixtures.ts";
import type {
  Artifact,
  Competitor,
  DataContract,
  DeliveryKind,
  FeasibilityScorecard,
  HitlDecision,
  HitlRequest,
  IntentLattice,
  JsonLog,
  MemoryEntry,
  ModelRoute,
  PhaseId,
  PhaseRecord,
  Project,
  ResearchCorpusEntry,
  SchedulerPlan,
  WildNextAction,
  WildParkInfo,
  WildParkUnlock,
  WildPlan,
  WildStepSummary,
} from "./types";

// knowledge.ts is disk-backed (statically imports node:fs) â€” a static import
// here would drag node:fs into the client bundle and crash hydration (audit H2
// P0; report-intake.ts uses the same lazy seam). The pure lesson builders are
// resolved lazily: available on server/headless paths, null on the client where
// the disk-backed lesson store cannot exist anyway. Honest, never throws.
type LessonSurface = {
  vagueBriefLesson: (project: Project, absentNouns?: readonly string[]) => MemoryEntry;
  templateEmissionLesson: (
    project: Project,
    phase: PhaseId,
    unmet: readonly string[],
    nouns?: readonly string[],
    evidenceHash?: string,
    source?: MemoryEntry["source"],
  ) => MemoryEntry;
  absentLexNouns: (brief: string, lattice: IntentLattice | null) => string[];
  /** L5 (98 Â§2.3): the user-correction lesson minted from a HITL decision row.
   *  Its production caller is `rejectHitl`; the next regeneration reads it back
   *  (lessonSteeringBlock) so a failed P1-P5 run's lesson changes the next run. */
  correctionLesson: (project: Project, decision: HitlDecision) => MemoryEntry;
  selectLessons: (
    memory: readonly MemoryEntry[],
    phase: PhaseId,
    limit?: number,
    onlyClass?: readonly string[],
  ) => MemoryEntry[];
  // fixes/144 (D2): tier-2 read-back helpers â€” pure, resolved through the same
  // lazy knowledge seam (never a static prompt-engine import â€” its static
  // deepseek.server graph is server-only and would trip import-protection).
  lessonLinesForBrief: (
    brief: string,
    memory: readonly MemoryEntry[],
    opts?: { limit?: number },
  ) => string[];
  lessonRankLimit: number;
};
let lessonSurface: LessonSurface | null = null;
void import("./knowledge.ts")
  .then((m) => {
    lessonSurface = {
      vagueBriefLesson: m.vagueBriefLesson,
      templateEmissionLesson: m.templateEmissionLesson,
      absentLexNouns: m.absentLexNouns,
      correctionLesson: m.correctionLesson,
      selectLessons: m.selectLessons,
      lessonLinesForBrief: m.lessonLinesForBrief,
      lessonRankLimit: m.EXPAND_LESSON_RANK_LIMIT,
    };
  })
  .catch(() => {
    lessonSurface = null;
  });

/** Runtime mirrors of the PhaseStatus / MemoryEntry.kind unions (A16/A15): used to
 *  validate persisted rows whose on-disk shape may not match the current types. */
const PHASE_STATUSES = new Set<string>(["locked", "ready", "running", "awaiting_hitl", "complete", "rejected"]);
const MEMORY_KINDS = new Set<string>(["episodic", "semantic", "procedural"]);

function marketFor(domain: string): Competitor[] {
  const shared: Competitor[] = [
    { name: "Cursor", class: "IDE-attached agent", strength: "Repo-aware multi-file edits", gap: "No agency lifecycle or HITL graph" },
    { name: "v0 / Bolt / Lovable", class: "Prompt-to-app", strength: "Fast UI scaffolds", gap: "Skips isolation policy and ADR trail" },
  ];
  const extra: Record<string, Competitor[]> = {
    logistics: [
      { name: "ServiceTitan", class: "Field-service suite", strength: "Dispatch + invoicing at scale", gap: "Heavy, not agent-governed, weak offline isolate" },
      { name: "Housecall Pro", class: "SMB field ops", strength: "Simple job board", gap: "No typed job lattice or sandbox regen" },
    ],
    "health-ops": [
      { name: "Epic / Athena add-ons", class: "EHR satellite", strength: "Clinical system of record", gap: "No client-side isolate; PHI often leaks into logs" },
      { name: "SimplePractice", class: "Clinic ops", strength: "Scheduling + notes", gap: "No sequential delivery graph or oracle" },
    ],
    "finance-ops": [
      { name: "QuickBooks + extras", class: "Ledger suite", strength: "Tax-ready books", gap: "Quote-to-job handoff is bolted on" },
      { name: "Stripe Billing", class: "Payments", strength: "Collections", gap: "Not an operator desk" },
    ],
    marketplace: [
      { name: "Shopify", class: "Storefront", strength: "Listings + checkout", gap: "Two-sided dispute flow is an app, not a graph" },
    ],
    operations: [
      { name: "Fishbowl / Cin7", class: "Inventory", strength: "SKU truth", gap: "No same-day dispatch loop" },
    ],
    "real-estate": [
      { name: "DealMachine / PropStream", class: "REI deal flow", strength: "Driving-for-dollars + comps", gap: "No flip/renovation lifecycle or ARV grounding" },
      { name: "Follow Up Boss", class: "Agent CRM", strength: "Lead nurture", gap: "Not a governed delivery graph; no escrow/title handoff" },
    ],
    construction: [
      { name: "Buildertrend", class: "Construction management", strength: "Scheduling + client comms", gap: "Heavy; no trade-level bid/punch-list lattice" },
      { name: "CoConstruct", class: "Remodeler CRM", strength: "Estimating + selections", gap: "No agent-governed delivery graph" },
    ],
  };
  // Deterministic template rows â€” never present as live research (B-23: source:"illustrative").
  return [...(extra[domain] ?? []), ...shared].map((c) => ({ ...c, source: "illustrative" as const }));
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}

/**
 * 342-4 / W359: the ONE delivery-kind decision (the single source of truth).
 * Returns the STORED `Project.kind` when it is a legal member of the widened
 * `DeliveryKind` taxonomy, otherwise SCORES the brief against the weighted
 * signal table below. Every resolver reads THIS â€” `uiKindOf` (the P8 3-way
 * projection), `scaffold.projectKindOf` (the 5-way scaffold mapping) and
 * `dod.briefDeliveryKind` (the gate's surface contract) delegate here â€” so they
 * cannot drift.
 *
 * W359 replaced the pre-342-4-style ORDERED FIRST-HIT table: whoever's keyword
 * appeared first in the prose decided the product's entire shape, so the noun
 * "screen" made the only game corpus brief an `app` and "agent" (a real-estate
 * agent) made a bookings website a `tool`. Weights are now SUMMED and the
 * highest total wins, so no single ambiguous noun can decide alone, and the
 * decision is recorded with its evidence (see `kindResolutionOf`).
 *
 * Precedence mirrors the pre-342-4 scaffold register: an explicit delivery-kind
 * noun (library/sdk/packageâ€¦) still out-scores a generic surface noun.
 */
const DELIVERY_KIND_SIGNALS: Record<DeliveryKind, Record<string, number>> = {
  // 5 = the kind's own name / a contract-defining noun; 4 = near-unambiguous
  // structural noun; 3 = strong supporting noun; 2/1 = weak, widely colliding.
  library: { library: 5, sdk: 5, npm: 4, package: 4, importable: 4, module: 3, statistics: 3 },
  tool: {
    cli: 5, commandline: 4, argv: 4, stdin: 4, stdout: 4, subcommand: 4,
    terminal: 3, command: 3,
    // "tool"/"script"/"agent" are generic deliverable prose ("an internal tool",
    // "a real-estate agent"): they can support a CLI but must never decide one.
    tool: 2, parse: 2, convert: 2, flag: 1, script: 1, agent: 1,
  },
  game: {
    game: 5, gameplay: 5, arcade: 4, playable: 4, platformer: 4, shooter: 4, roguelike: 4,
    canvas: 3, sprite: 3, respawn: 3, play: 3,
    paddle: 2, brick: 2, ball: 2, score: 2, lives: 2, pause: 2,
  },
  service: {
    webhook: 4, worker: 4, endpoint: 3, http: 3, daemon: 3, socket: 3, cron: 3,
    port: 3, listen: 3, api: 3, queue: 2, retry: 2, health: 2,
    // A business that "does property services" is not a shipped service.
    service: 1,
  },
  app: {
    website: 5, webapp: 5, ui: 4, dashboard: 4, crm: 4,
    web: 3, screen: 3, portal: 3, storefront: 3, page: 3, mobile: 3, scheduler: 3, booking: 3,
    board: 2, menu: 2, catalogue: 2, catalog: 2, shop: 2, tab: 2, form: 2, suite: 2,
    ledger: 2, pipeline: 2, listing: 2, portfolio: 2, tracker: 2, checkout: 2, app: 2, site: 2,
    // W61 C2 carried these as app surface nouns too; kept at their measured
    // (weak) strength so a marketing/mobile brief never falls to the default.
    desk: 2, ios: 2, android: 2, retail: 1,
    reminder: 1, manager: 1,
  },
};

/**
 * The final tie-break order, first member wins. `app` leads deliberately: an
 * exact tie on BOTH the total and the strongest single signal keeps the
 * documented default (`app`) when it is one of the tied kinds, and otherwise the
 * earlier member below â€” so the resolution is a pure function of the input and
 * never of iteration luck.
 */
const KIND_FINAL_TIE_ORDER: readonly DeliveryKind[] = ["app", "game", "library", "service", "tool"];

/**
 * W61 C2: strip out-of-scope / negated text before any classifier reads the
 * brief. A line under an "out of scope"-style heading (or carrying an inline
 * negation) must not donate its nouns â€” the residual defect where a bakery
 * brief's *"Out of scope: multi-tenant"* line matched `tenant` and typed the
 * project real-estate (R1 BL-001). Deterministic; newlines preserved so the H1
 * region is unaffected.
 */
export function stripOutOfScope(text: string): string {
  const NEG_INLINE =
    /\b(?:out\s+of\s+scope|not\s+(?:required|included|needed|supported|part\s+of)|no\s+longer|excluded?|excluding|non-?goals?)\b/i;
  const OOS_HEADING =
    /^#{1,6}\s*.*(?:out\s+of\s+scope|non-?goals?|not\s+in\s+scope|excluded|will\s+not|won'?t)/i;
  const HEADING = /^#{1,6}\s/;
  const out: string[] = [];
  let inOos = false;
  for (const line of String(text ?? "").split(/\r?\n/)) {
    if (HEADING.test(line)) {
      inOos = OOS_HEADING.test(line);
      out.push(line);
      continue;
    }
    if (inOos) {
      out.push("");
      continue;
    }
    // Drop only the negated SENTENCE/CLAUSE, never the whole line: an inline
    // "â€¦ take orders, manage inventory and stock. Multi-tenant is out of scope."
    // must keep its first sentence's nouns while losing the negated one.
    out.push(
      line
        .split(/(?<=[.;!?])\s+/)
        .map((sentence) => (NEG_INLINE.test(sentence) ? "" : sentence))
        .join(" "),
    );
  }
  // A hyphenated `multi-<scope>` qualifier is a cross-cutting scope modifier,
  // not a domain noun ("multi-tenant"/"multi-branch" must not match `tenant`
  // and type the project real-estate). `multifamily` (no hyphen) is untouched.
  return out.join("\n").replace(/\bmulti-[a-z][a-z-]*\b/gi, " ");
}

/**
 * W62 Â· C1-07 (R-08): the explicit UI/app SURFACE vocabulary. A brief that
 * declares one of these has a user-facing surface â€” proof it is a product to
 * USE, not an importable package. Deliberately NARROWER than the `app` keyword
 * row: generic container nouns a library brief also writes ("board", "tab",
 * "module") are excluded so a kanban *library* that declares a "board" stays a
 * library (scaffold 341-1). Domain-agnostic â€” the SURFACE is detected, not the
 * vertical.
 */
const UI_SURFACE_WORDS = [
  "ui", "screen", "screens", "dashboard", "desk", "portal",
  "site", "website", "web", "page", "pages", "menu",
  "catalogue", "catalog", "shop", "storefront",
];

/** True when the brief (minus out-of-scope / negated text) declares an explicit
 *  UI/app surface. The brief's own spec is the surface context `deliveryKindOf`
 *  carries: planSpecGraph (algorithms.ts) always emits a `ui` node, so the real
 *  SpecGraph cannot discriminate â€” the brief's declared surfaces can. */
export function declaresUiSurface(brief: string): boolean {
  const tokens = new Set(
    stripOutOfScope(typeof brief === "string" ? brief : "").toLowerCase().match(/[a-z0-9]+/g) ?? [],
  );
  const hit = (h: string): boolean =>
    tokens.has(h) ||
    tokens.has(`${h}s`) ||
    tokens.has(`${h}es`) ||
    (h.endsWith("y") && tokens.has(`${h.slice(0, -1)}ies`));
  return UI_SURFACE_WORDS.some(hit);
}

/**
 * W359: the decision input, tokenized once per SOURCE so the evidence can name
 * where a signal was read. A hyphen between alphanumerics is elided, so a
 * phrase signal ("command-line" â‡’ `commandline`) is matchable as one token
 * while the plain tokens stay available.
 */
function kindTokens(text: string): Set<string> {
  const lowered = String(text ?? "").toLowerCase();
  const out = new Set<string>(lowered.match(/[a-z0-9]+/g) ?? []);
  for (const t of lowered.replace(/(?<=[a-z0-9])-(?=[a-z0-9])/g, "").match(/[a-z0-9]+/g) ?? []) {
    out.add(t);
  }
  return out;
}

/** 346 T1: match the words the brief actually WROTE (plus a simple plural), never
 *  stemmed forms â€” `tokenizeWords` canonicalizes, so a stem match fired on
 *  unrelated words ("packaging"â†’package(library), "works"â†’worker(service)). */
function hasSignal(tokens: Set<string>, word: string): boolean {
  return (
    tokens.has(word) ||
    tokens.has(`${word}s`) ||
    tokens.has(`${word}es`) ||
    (word.endsWith("y") && tokens.has(`${word.slice(0, -1)}ies`))
  );
}

/** The exact text a scored decision is read from â€” hashed into the record so a
 *  stale resolution is detectable rather than silently wrong. */
function kindDecisionInput(
  project: Pick<Project, "kind" | "brief" | "domain" | "lattice">,
): string {
  return [
    stripOutOfScope(String(project.brief ?? "")),
    project.domain ?? "",
    Array.isArray(project.lattice?.jobs) ? project.lattice.jobs.join(" ") : "",
  ].join(" ");
}

/**
 * W359 (resolve-kind): the full, evidence-recording decision behind
 * `deliveryKindOf`. PURE and model-free â€” no keyed call, no memo, no cache: the
 * same project always resolves to the same kind, and the returned record carries
 * the evidence (`score`, `runnerUp`, `confidence`, every matched signal) so a
 * consumer or an audit can re-derive the decision from the record alone.
 *
 * Scoring: each row's matched signals are summed (a signal counts ONCE per row,
 * so repeating a word cannot buy a decision); the highest total wins. Ties break
 * on the strongest single signal (the more specific row), then on
 * `KIND_FINAL_TIE_ORDER` â€” an exact tie involving `app` is `app` (the documented
 * default). No signal at all â‡’ `app`, recorded as `basis: "default"` â€” never
 * silently.
 *
 * The C1-07 rule is kept: a brief that DECLARES a UI surface (`declaresUiSurface`)
 * zeroes the `library`/`tool` rows, and the damped matches are still recorded
 * with `counted: false` â€” a "tool library" with a catalogue is a product to use,
 * not an importable package, and the record says so.
 */
export function kindResolutionOf(
  project: Pick<Project, "kind" | "brief" | "domain" | "lattice">,
): KindResolution {
  const declared = project.kind;
  const legal =
    declared !== undefined && declared !== null && (DELIVERY_KINDS as readonly string[]).includes(declared);
  const briefHash = String(fnv1a(kindDecisionInput(project)));
  if (legal) {
    return {
      kind: declared,
      basis: "declared",
      score: 0,
      runnerUp: null,
      confidence: 1,
      evidence: [{ kind: declared, signal: "stored kind", weight: null, source: "declared", counted: true }],
      damped: [],
      briefHash,
    };
  }

  const brief = String(project.brief ?? "");
  const sources: { source: KindEvidence["source"]; tokens: Set<string> }[] = [
    { source: "brief", tokens: kindTokens(stripOutOfScope(brief)) },
    { source: "domain", tokens: kindTokens(project.domain ?? "") },
    {
      source: "lattice",
      tokens: kindTokens(Array.isArray(project.lattice?.jobs) ? project.lattice.jobs.join(" ") : ""),
    },
  ];
  // C1-07: a declared UI/app surface is proof of a user-facing product, so the
  // library/tool rows may not capture it ("A kanban board library that ships a
  // dashboard screen" is a UI product). Genuine library briefs carry no UI
  // surface, so they keep their library kind.
  const uiSurface = declaresUiSurface(brief);
  const damped: DeliveryKind[] = [];
  const evidence: KindEvidence[] = [];
  const totals: Record<DeliveryKind, { score: number; best: number }> = {
    app: { score: 0, best: 0 },
    tool: { score: 0, best: 0 },
    game: { score: 0, best: 0 },
    library: { score: 0, best: 0 },
    service: { score: 0, best: 0 },
  };
  for (const kind of KIND_FINAL_TIE_ORDER) {
    const suppressed = uiSurface && (kind === "library" || kind === "tool");
    if (suppressed) damped.push(kind);
    for (const [signal, weight] of Object.entries(DELIVERY_KIND_SIGNALS[kind])) {
      const from = sources.find((s) => hasSignal(s.tokens, signal));
      if (!from) continue;
      evidence.push({ kind, signal, weight, source: from.source, counted: !suppressed });
      if (suppressed) continue;
      totals[kind].score += weight;
      totals[kind].best = Math.max(totals[kind].best, weight);
    }
  }

  // Highest total wins; a tie goes to the more specific row (strongest single
  // signal), then to KIND_FINAL_TIE_ORDER â€” so an exact tie is `app`.
  let winner: DeliveryKind = KIND_FINAL_TIE_ORDER[0]!;
  for (const kind of KIND_FINAL_TIE_ORDER) {
    const a = totals[kind];
    const b = totals[winner];
    if (a.score > b.score || (a.score === b.score && a.best > b.best)) winner = kind;
  }
  let runnerUp: DeliveryKind | null = null;
  for (const kind of KIND_FINAL_TIE_ORDER) {
    if (kind === winner) continue;
    if (runnerUp === null) {
      runnerUp = kind;
      continue;
    }
    const a = totals[kind];
    const b = totals[runnerUp];
    if (a.score > b.score || (a.score === b.score && a.best > b.best)) runnerUp = kind;
  }
  const win = totals[winner].score;
  const runnerScore = runnerUp === null ? 0 : totals[runnerUp].score;
  return {
    kind: winner,
    basis: win > 0 ? "scored" : "default",
    score: win,
    runnerUp: runnerScore > 0 && runnerUp !== null ? { kind: runnerUp, score: runnerScore } : null,
    // A MARGIN, not a probability: 1 when nothing competed (or the kind was
    // declared), 0 for the bare default.
    confidence: win === 0 ? 0 : runnerScore === 0 ? 1 : Number((win / (win + runnerScore)).toFixed(3)),
    evidence,
    damped,
    briefHash,
  };
}

/** The ONE delivery-kind decision. See `kindResolutionOf` for the scoring model;
 *  this is the value every consumer reads. */
export function deliveryKindOf(
  project: Pick<Project, "kind" | "brief" | "domain" | "lattice">,
): DeliveryKind {
  return kindResolutionOf(project).kind;
}

/**
 * The one STAMP of the decision onto a project (the P6 seam calls this before
 * synthesis so the routing signal and the emitted shape share the single decided
 * value). The KIND is never re-derived over a stored one â€” a legal `kind` is
 * returned verbatim. The RECORD is (re)written only when it is absent or STALE
 * (`briefHash` no longer matches the live decision input: the brief, domain or
 * lattice jobs changed), because a record that outlives its brief is not
 * evidence. A project already carrying the decided kind and its current record
 * is returned UNCHANGED (same reference) â€” so the stamp is idempotent.
 *
 * `kindResolutionOf` is re-READ here, never cached: on a project that already
 * carries a kind the returned record is the `declared` one (the kind came from
 * the project), which is exactly the decision `deliveryKindOf` makes. The
 * record never re-kinds anything.
 */
export function withDeliveryKind<P extends Project>(project: P): P {
  const resolution = kindResolutionOf(project);
  const current = project.kindResolution;
  if (
    project.kind === resolution.kind &&
    current !== undefined &&
    current.briefHash === resolution.briefHash
  ) {
    return project;
  }
  return { ...project, kind: resolution.kind, kindResolution: resolution };
}

/** Every `KindEvidence.source` a persisted record may carry. */
const KIND_EVIDENCE_SOURCES = ["declared", "brief", "domain", "lattice"] as const;

/**
 * W359 (resolve-kind) / H-03 (io half): coerce-or-drop a persisted
 * `kindResolution`. A resolution is EVIDENCE, so a malformed one is dropped with
 * `undefined` and never repaired into shape â€” and a record that names a kind the
 * project does not carry is dropped with it (evidence for a claim the project no
 * longer makes is not evidence). An absent record stays absent: a legacy payload
 * is never stamped here.
 */
function coerceKindResolution(raw: unknown, kind: DeliveryKind | undefined): KindResolution | undefined {
  if (!isPlainObject(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (kind === undefined || r.kind !== kind) return undefined;
  if (r.basis !== "declared" && r.basis !== "scored" && r.basis !== "default") return undefined;
  const score = r.score;
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) return undefined;
  const confidence = r.confidence;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return undefined;
  }
  if (typeof r.briefHash !== "string" || r.briefHash.length === 0) return undefined;
  if (!Array.isArray(r.evidence)) return undefined;
  const evidence: KindEvidence[] = [];
  for (const row of r.evidence) {
    if (!isPlainObject(row)) return undefined;
    const e = row as Record<string, unknown>;
    if (!(DELIVERY_KINDS as readonly string[]).includes(e.kind as string)) return undefined;
    if (typeof e.signal !== "string" || e.signal.length === 0) return undefined;
    if (e.weight !== null && (typeof e.weight !== "number" || !Number.isFinite(e.weight))) return undefined;
    if (!(KIND_EVIDENCE_SOURCES as readonly string[]).includes(e.source as string)) return undefined;
    if (typeof e.counted !== "boolean") return undefined;
    evidence.push({
      kind: e.kind as DeliveryKind,
      signal: e.signal,
      weight: e.weight as number | null,
      source: e.source as KindEvidence["source"],
      counted: e.counted,
    });
  }
  if (!Array.isArray(r.damped)) return undefined;
  const damped: DeliveryKind[] = [];
  for (const k of r.damped) {
    if (!(DELIVERY_KINDS as readonly string[]).includes(k as string)) return undefined;
    damped.push(k as DeliveryKind);
  }
  let runnerUp: KindResolution["runnerUp"] = null;
  if (r.runnerUp !== null && r.runnerUp !== undefined) {
    if (!isPlainObject(r.runnerUp)) return undefined;
    const ru = r.runnerUp as Record<string, unknown>;
    if (!(DELIVERY_KINDS as readonly string[]).includes(ru.kind as string)) return undefined;
    if (typeof ru.score !== "number" || !Number.isFinite(ru.score) || ru.score <= 0) return undefined;
    runnerUp = { kind: ru.kind as DeliveryKind, score: ru.score };
  }
  return {
    kind: kind as DeliveryKind,
    basis: r.basis,
    score,
    runnerUp,
    confidence,
    evidence,
    damped,
    briefHash: r.briefHash,
  };
}

/**
 * P0-03 (fixes/97): the P8 3-way projection of the single delivery-kind
 * decision â€” `uiKindOf` reads `deliveryKindOf` (never the brief itself), so a
 * stored library kind and a kind-absent library brief resolve identically.
 * "library" and "cli-tool" are their own surface contracts; app/game/service
 * are UI-bearing at P8.
 */
function uiKindOf(project: Project): "cli-tool" | "library" | "ui" {
  const kind = deliveryKindOf(project);
  if (kind === "library") return "library";
  if (kind === "tool") return "cli-tool";
  return "ui";
}

/** Domain vocabulary. 346 T1: `inferDomain` matches these as SURFACE forms
 *  (the word the brief wrote, plus a simple plural/s/es/ies) â€” see inferDomain.
 *  Register terms must therefore be words a brief of that domain actually
 *  uses; a generic English noun here hijacks every unrelated brief. */
export const DOMAIN_TERMS: Record<string, string[]> = {
  "revenue-ops": ["crm", "pipeline", "lead", "sales"],
  operations: ["inventory", "warehouse", "sku", "stock"],
  marketplace: ["marketplace", "listing", "buyer", "seller", "storefront", "checkout"],
  "agent-platform": ["agent", "orchestrat", "mcp", "llm", "crew"],
  "health-ops": ["clinic", "patient", "health", "clinician", "hipaa", "phi", "intake"],
  logistics: ["fleet", "dispatch", "route", "driver", "tech"],
  "finance-ops": ["invoice", "billing", "ledger", "quote", "payments"],
  // W62 Â· C1-07: "dashboard"/"report" are generic UI SURFACE nouns, not
  // analytics-domain nouns. Keeping them here typed any brief with a status
  // dashboard or a damage report as `analytics` (PREVENTION INC-07, the
  // office-stock-tracker v1 mis-catch; the held-out tool-library brief).
  // Analytics now needs its own vocabulary.
  analytics: ["analytics", "kpi"],
  // 118 P-D3: real-estate / property + construction/trades registers. A flipper
  // brief ("flip houses, track ARV, run comps, renovate") must classify here,
  // never as analytics/finance-ops â€” the previous register had zero REI vocab so
  // "track/estimate/report" in such briefs landed on analytics (maker-loop bug).
  "real-estate": [
    // 346 T1: "home" and "title" were removed. Both are ordinary web/form
    // words â€” a marketing site's "Home" page classified as real-estate, and an
    // office scheduler's appointment "title" field did too. Genuine property
    // briefs still carry house/property/rental/tenant/lease/landlord.
    "house", "property", "estate", "showing", "flip", "arv", "rental",
    "tenant", "lease", "landlord", "mortgage", "appraisal", "escrow", "closing",
    "deed", "condo", "duplex", "multifamily", "comps", "beds", "baths",
    "sqft", "realtor", "listing", "agent", "buyer", "seller",
  ],
  construction: [
    "contractor", "renovation", "renovate", "rehab", "trades", "electrician",
    "plumber", "carpenter", "framing", "drywall", "roofing", "hvac", "permit",
    "subcontractor", "punch", "bid", "material",
  ],
  // W61 C2 (R1): the missing web/retail/mobile registers. Deliberately narrow â€”
  // only words a brief of that domain actually names (no bare "phone"/"app",
  // which appear in marketing briefs and would hijack them). Added LAST so an
  // existing specific register still wins a tie.
  "web-marketing": [
    "website", "site", "marketing", "landing", "seo", "brand", "content",
    "blog", "catalogue", "catalog", "brochure",
  ],
  retail: [
    "shop", "retail", "storefront", "checkout", "basket", "cart", "pos",
    "till", "counter", "shelf",
  ],
  mobile: [
    "mobile", "ios", "android", "tablet", "native", "touchscreen", "viewport",
    "one-handed", "tab-bar",
  ],
};
const DOMAIN_ORDER = Object.keys(DOMAIN_TERMS);

/** W62 Â· C1-07 remediation: register terms that NAME their vertical, so a lone
 *  hit is decisive for a UI-surface brief instead of being demoted to
 *  `custom-software`. Every term here is unambiguous (a "website"/"marketing"
 *  brief is a web-marketing brief; a "storefront"/"till" brief is retail; an
 *  "ios"/"android"/"mobile" brief is mobile). Generic-capable nouns that could
 *  belong to another vertical are deliberately EXCLUDED â€” "site" (a construction
 *  site), "catalogue" (a tool-library catalogue, the held-out brief),
 *  "checkout"/"cart"/"basket" (marketplace), "native" (ordinary adjective). A
 *  non-decisive lone hit keeps the C1-07 â‰¥2 rule, so an incidental noun still
 *  cannot claim a whole vertical. */
const DOMAIN_DECISIVE: ReadonlySet<string> = new Set([
  // web-marketing
  "website", "marketing", "seo", "landing",
  // retail
  "retail", "storefront", "till", "pos",
  // mobile
  "mobile", "ios", "android", "tablet", "touchscreen", "viewport", "one-handed", "tab-bar",
]);

export function inferDomain(brief: string): string {
  // 346 T1: surface-form matching (raw brief words + a simple plural/s/es/ies),
  // NOT canonicalStem. tokenizeWords stems every brief word, and comparing
  // stemmed tokens to stemmed register terms conflated unrelated words â€”
  // "shows" matched "showing" (both stem `show`), "list" matched "listing",
  // "multi-tenant" matched "tenant", "packaging" matched "package". Real keyed
  // runs were mislabeled (a bakery marketing site became real-estate and its
  // P0/P7/P11 research returned rental/lease sources). A register term now only
  // fires on itself (or its plural).
  // W61 C2: an out-of-scope / negated line never donates a domain term (the
  // "Out of scope: multi-tenant" line typed a bakery brief real-estate).
  const tokens = new Set(stripOutOfScope(typeof brief === "string" ? brief : "").toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const hit = (term: string): boolean =>
    tokens.has(term) ||
    tokens.has(`${term}s`) ||
    tokens.has(`${term}es`) ||
    (term.endsWith("y") && tokens.has(`${term.slice(0, -1)}ies`));
  let best = "custom-software";
  let bestCount = 0;
  let bestHits: string[] = [];
  // First domain in DOMAIN_ORDER wins a tie (deterministic, and additive-only:
  // a domain still needs strictly more matches than the current best). The old
  // longest-matched-term tie-break let a longer generic term ("dashboard")
  // outrank a shorter specific one ("stock") and typed an office inventory
  // tracker as analytics.
  for (const domain of DOMAIN_ORDER) {
    const hits: string[] = [];
    for (const raw of DOMAIN_TERMS[domain]) {
      if (hit(raw)) hits.push(raw);
    }
    if (hits.length > bestCount) {
      best = domain;
      bestCount = hits.length;
      bestHits = hits;
    }
  }
  // W62 Â· C1-07 (BUGLEDGER root cause): a single incidental register noun must
  // not claim a whole vertical â€” "One incidental word therefore wins the whole
  // brief with count=1 vs 0." For a brief that declares a UI/app surface (the
  // software context), a vertical needs â‰¥2 distinct register hits; a lone
  // incidental noun otherwise drops to the honest `custom-software` default.
  // Remediation: a lone hit on a DOMAIN_DECISIVE term (see above) is not
  // incidental â€” a "bakery website" brief is a web-marketing brief, and the
  // pre-fix â‰¥2 rule demoted it to `custom-software`, which then killed the
  // domain-aware research topic, P3's surface and the domain label.
  const soleDecisive = bestCount === 1 && bestHits.some((h) => DOMAIN_DECISIVE.has(h));
  return declaresUiSurface(typeof brief === "string" ? brief : "") && bestCount < 2 && !soleDecisive
    ? "custom-software"
    : best;
}

/**
 * C3 (R1 BL-013): derive a product name from a brief without leaking raw
 * markdown. Every stored `name` used to begin with `# ` (`"# Golden Crust
 * Bakery"`, `"# Wildstem Florist â€”"`) because the H1 heading marker was taken
 * as a token. Strip the leading heading marker / list bullet, then take the H1
 * product name â€” the text BEFORE a ` â€” ` subtitle separator (so `"# Crumb &
 * Bloom â€” Combined â€¦"` names `"Crumb & Bloom"`), else the heading with any
 * trailing separator removed â€” and cap at the first 4 WORDS (never mid-word).
 */
export function inferName(brief: string): string {
  const firstLine = String(brief ?? "").split(/\r?\n/)[0] ?? "";
  const heading = firstLine
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/^\s*[-*+]\s+/, "")
    .trim();
  const beforeSubtitle = heading.split(/\s+[â€”â€“-]\s+/)[0] ?? heading;
  const firstSentence = beforeSubtitle.split(".")[0]?.trim() || beforeSubtitle;
  const cleaned = firstSentence
    .replace(/^(build|create|make|design|develop)\s+/i, "")
    .replace(/[\sâ€”â€“\-|:,]+$/, "")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 4);
  const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return name || "Untitled system";
}

function scorecard(project: Project): FeasibilityScorecard {
  const lat = project.lattice;
  const sched = project.schedule;
  // Precondition: lattice && schedule are always present â€” attachAlgorithms primes them at
  // creation, hydration and every mutation (invariant B.3.3). The old placeholder branch was
  // unreachable and is deleted per B-22.
  if (!lat || !sched) {
    // Internal invariant violation (the comment above proves the branch
    // unreachable on every live path) â€” coded RT_E_INTERNAL so a caller never
    // has to string-match to classify it.
    const err = new Error("scorecard requires a primed project (run algorithms first)") as Error & {
      code?: string;
    };
    err.code = "RT_E_INTERNAL";
    throw err;
  }
  const core = feasibilityScorecard(lat, sched);
  return {
    ...core,
    libraries: librariesFor(project.domain, lat),
  };
}

function art(
  phase: PhaseId,
  kind: Artifact["kind"],
  title: string,
  body: string,
  language?: string,
): Artifact {
  return {
    id: `${phase}-${kind}-${slug(title)}`,
    phase,
    kind,
    title,
    body,
    language,
  };
}

/** Deterministic note-keyword â†’ delta mapping for regenerated text artifacts (B-04/T9). */
const REJECTION_DELTAS: { re: RegExp; line: string }[] = [
  { re: /security|auth|oauth|token|scope|permission/i, line: "- Isolation and authorization section tightened; scopes enumerated per role." },
  { re: /ui|screen|layout|surface|console|view/i, line: "- Surface contract updated; controls enumerated and bound to store fields." },
  { re: /test|coverage|oracle|case|verif/i, line: "- Test oracle expanded; the failing case became a named oracle entry." },
  { re: /schema|data|entit|field|model/i, line: "- Data contract revised; entities/fields reconciled with the note." },
  { re: /deploy|prod|publish|release|go-live/i, line: "- Deployment guard kept explicit; promotion conditions restated." },
  { re: /perf|latency|slow|scale/i, line: "- Scale assumptions reduced; a latency budget was added to the plan." },
];

/** Markdown block appended to a regenerated phase's primary artifact (visible, deterministic steering). */
export function rejectionResponseBlock(attempt: number, note: string): string {
  const hits = REJECTION_DELTAS.filter((d) => d.re.test(note)).map((d) => d.line);
  const deltas = (hits.length ? hits : ["- Scope tightened per operator note; affected sections regenerated deterministically."]).slice(0, 3);
  return [`## Rejection response (attempt #${attempt})`, `> ${note}`, "", "Deltas applied this regeneration:", ...deltas].join("\n");
}

/** Deterministic unique-id pass for memory rows sharing phase+kind+score (B-12). */
export function dedupeMemoryIds(rows: MemoryEntry[]): MemoryEntry[] {
  const seen = new Map<string, number>();
  // Ids already occupied in the INCOMING list. An earlier pass may already have
  // parked an older duplicate at `${id}-${n}` (the B-12 rename scheme), so the
  // naive nth-occurrence suffix can collide with it on the 3rd+ regeneration of
  // a phase (run 1: X; run 2: X + X-2; run 3: X + X-2(new) + X-2(old)). Skip
  // occupied suffixes so ids stay globally unique and stable across passes.
  const occupied = new Set(rows.map((m) => m.id));
  return rows.map((m) => {
    const n = (seen.get(m.id) ?? 0) + 1;
    seen.set(m.id, n);
    if (n === 1) return m;
    let suffix = n;
    let id = `${m.id}-${suffix}`;
    // A1-46: the window used to be capped at 10_000 â€” on exhaustion the loop
    // exited with `id` STILL colliding (a duplicate id, the exact invariant
    // H-02 protects). Unbounded now: `occupied` is finite and suffix grows
    // monotonically, so this always terminates with a unique id.
    while (occupied.has(id)) {
      suffix += 1;
      id = `${m.id}-${suffix}`;
    }
    occupied.add(id); // H-02 (fixes/115): register the minted id so a later
    // occurrence of the same base cannot mint it again (suffix collision).
    return { ...m, id };
  });
}

/** 216i (112 Â§4.2 â€” T1): the lesson-row identity convention (knowledge.lessonRow
 *  mints `lesson-<classShort>-<fnv8(signature||text)>`). Engine-side modules use
 *  this to gate the reproduction accrual WITHOUT importing the disk-backed
 *  knowledge.ts (H2 lazy-seam rule). Non-lesson rows are never touched. */
export function isLessonMemoryId(id: unknown): boolean {
  return typeof id === "string" && id.startsWith("lesson-");
}

/**
 * 216i (112 Â§3.1/Â§4.2 â€” T1): the reproduction accrual. A repeated identical
 * failure re-derives the SAME signature-based lesson id (216g), so when the
 * merge sites see the same lesson id twice, the honest record is: ONE row whose
 * `reproducedCount` accrues â€” NOT a forked `-2` twin (dedupeMemoryIds' rename
 * semantics stay intact for every other row) and NOT a silently dropped
 * occurrence. The FIRST occurrence's content wins (a fresher mint keeps its
 * text/tags); the count = the sum of both sides' counts + 1 for the fold.
 *
 * Pure and deterministic: non-lesson duplicates pass through untouched (an
 * earlier copy already counted is never re-counted â€” only a genuine twin pair
 * folds). Callers run this BEFORE dedupeMemoryIds at merge sites.
 */
export function accrueReproducedCounts(rows: MemoryEntry[]): MemoryEntry[] {
  const out: MemoryEntry[] = [];
  const at = new Map<string, number>();
  for (const m of rows) {
    if (!m || typeof m !== "object") {
      out.push(m);
      continue;
    }
    const i = isLessonMemoryId(m.id) ? at.get(m.id) : undefined;
    if (i !== undefined) {
      const prev = out[i];
      if (!prev) continue;
      const a = Number.isFinite(prev.reproducedCount) ? (prev.reproducedCount as number) : 0;
      const b = Number.isFinite(m.reproducedCount) ? (m.reproducedCount as number) : 0;
      out[i] = { ...prev, reproducedCount: a + b + 1 };
      continue;
    }
    if (isLessonMemoryId(m.id)) at.set(m.id, out.length);
    out.push(m);
  }
  return out;
}

/** Swap the packet artifact body for the freshly compiled packet (B-19/R10). */
function sealPacketArtifact(project: Project): Project {
  // A1-27: immutable spread â€” every other engine write builds a fresh object;
  // assigning through the parameter aliased the caller's array (React memo
  // deps and reused test fixtures saw mutations they never asked for).
  return {
    ...project,
    artifacts: [
      ...project.artifacts.filter((a) => a.kind !== "packet"),
      {
        id: `packet-${project.currentPhase}`,
        phase: project.currentPhase,
        kind: "packet",
        title: "Agent packet (A4)",
        body: project.packet,
        language: "markdown",
      },
    ],
  };
}

/** Recompile packet + A4 trace and refresh the packet artifact (B-06/B-19/R10 â€” store call sites). */
export function stampPacket(project: Project): Project {
  const packed = attachAlgorithms(project);
  return sealPacketArtifact(packed);
}

// ---------------------------------------------------------------------------
// 118 P-D3: brief-driven synthesis helpers. Product-shaped phase bodies derive
// their narrative from the brief's own nouns/verbs (the P0 lattice), never from
// RapidTool's engine internals â€” so a real-estate brief's architecture reads as
// "contacts / leads / flips", not "root_coordinator / FusionRank / deepseek".
// ---------------------------------------------------------------------------

/** Human-readable label for a domain id (product-shaped artifact bodies). */
function domainLabel(domain: string): string {
  const labels: Record<string, string> = {
    "real-estate": "real estate",
    construction: "construction / trades",
    "health-ops": "health operations",
    "finance-ops": "finance operations",
    "revenue-ops": "revenue operations",
    "agent-platform": "agent platform",
    marketplace: "marketplace",
    logistics: "logistics",
    operations: "operations",
    analytics: "analytics",
  };
  return labels[domain] ?? "custom software";
}

/** Lattice entities minus the vague-input fallbacks (the product's nouns).
 *  The brief's own content nouns (`lattice.briefNouns`, folded by A1) LEAD so a
 *  bakery brief names donut/bread/menu/order instead of the LEX bank's generic
 *  nouns; the LEX entities follow. Deduped by canonical stem, stable order. */
function productNouns(project: Project): string[] {
  const fromBrief = project.lattice?.briefNouns ?? [];
  const lex = (project.lattice?.entities ?? []).filter((e) => e !== "operator" && e !== "record");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of [...fromBrief, ...lex]) {
    const stem = tokenizeWords(n)[0] ?? n;
    if (seen.has(stem)) continue;
    seen.add(stem);
    out.push(n);
  }
  return out;
}

/** Lattice jobs minus the vague-input fallback (the product's verbs/flows). */
function productJobs(project: Project): string[] {
  return (project.lattice?.jobs ?? []).filter((j) => j !== "deliver-core-workflow");
}

/** Actors (kind === actor) from the lattice nodes â€” for role-based access narratives. */
function productActors(project: Project): string[] {
  return (project.lattice?.nodes ?? [])
    .filter((n) => n.kind === "actor")
    .map((n) => n.label);
}

/**
 * fixes/136 (P8 keyless): screens are the brief's real product SURFACES â€” one
 * distinct entity-management responsibility per screen, never one screen per
 * lattice verb (the old `screens = jobs` degeneracy emitted "Screen: track /
 * Responsibility: track over â€¦" for every verb). Screens are the lattice
 * entities with genuine brief-phrase evidence, deduped by canonical stem and
 * bounded to â‰¤6; the lattice JOBS become the ACTIONS bound under each screen.
 *
 * Binding is clause-level and deterministic: a job binds to the entities that
 * share a comma/colon/semicolon/sentence clause with it in the brief. A job
 * that co-occurs with NO entity (e.g. "schedule repairs" with no `repair`
 * entity in the register) is a cross-cutting flow and is listed on every
 * screen. An entity that co-occurs with no job (e.g. a title noun) carries
 * only those cross-cutting flows â€” never a fabricated per-entity mapping.
 */
function keylessScreens(project: Project): { entity: string; actions: string[] }[] {
  const nouns = productNouns(project);
  const jobs = productJobs(project);
  const seenStems = new Set<string>();
  const entities: string[] = [];
  for (const n of nouns) {
    const stem = tokenizeWords(n)[0] ?? n;
    if (seenStems.has(stem)) continue;
    seenStems.add(stem);
    entities.push(n);
    if (entities.length >= 6) break;
  }
  const clauses = project.brief.toLowerCase().split(/[,;:.!?\n]+/);
  const clauseStems = clauses.map((c) => new Set(tokenizeWords(c)));
  const sharesClause = (entityStems: string[], jobStem: string): boolean =>
    clauseStems.some((cs) => entityStems.every((t) => cs.has(t)) && cs.has(jobStem));
  return entities.map((entity) => {
    const eStems = tokenizeWords(entity);
    const actions = jobs.filter((job) => {
      const jobStem = tokenizeWords(job)[0] ?? job;
      if (sharesClause(eStems, jobStem)) return true;
      // A job that shares a clause with no entity is a cross-cutting flow â€”
      // it applies to every screen rather than being silently dropped.
      return !entities.some((other) => sharesClause(tokenizeWords(other), jobStem));
    });
    return { entity, actions };
  });
}

/** Domain-derived external surface (declared, not implemented) for P3/P11. */
function domainSurface(domain: string): string[] {
  const map: Record<string, string[]> = {
    "real-estate": ["listing/MLS data", "comps + ARV inputs", "escrow & title status"],
    construction: ["estimating & bids", "scheduling", "materials & punch lists"],
    "health-ops": ["EHR / clinical scheduling", "HIPAA audit log"],
    "finance-ops": ["ledger & payments", "tax-ready export"],
    "revenue-ops": ["CRM lead/pipeline sync"],
    marketplace: ["checkout & dispute"],
    logistics: ["geo / dispatch routing"],
    operations: ["inventory / SKU ledger"],
    analytics: ["warehouse / BI"],
    // W61 C2's registers reach P3/P11 too â€” without these the web/retail/mobile
    // domains fell through to a placeholder that CLAIMED the brief named
    // external services (it may not have). Entries are category surfaces
    // DECLARED for the domain, never services the brief named.
    "web-marketing": ["content / SEO data", "site analytics", "enquiry / form delivery"],
    retail: ["payment / checkout", "catalogue / POS feed"],
    mobile: ["mobile API", "push / notification service"],
  };
  // Unknown/custom-software: no category surface is known, so NONE is claimed
  // (honest) â€” the caller renders the empty list explicitly.
  return map[domain] ?? [];
}

/** PostgreSQL type for one contract field type (`ulid`/`string`/`enum`/`int`/
 *  `datetime`, plus the `?` nullable suffix). The A6 bank's vocabulary is
 *  closed (algorithms.ts FIELD_BANK); a foreign/unknown type degrades to TEXT â€”
 *  a lossy-but-safe widening, never a fabricated column type. */
function schemaSqlType(type: string): string {
  switch (type) {
    case "int":
      return "INTEGER";
    case "datetime":
      return "TIMESTAMP";
    case "ulid":
    case "string":
    case "enum":
      return "TEXT";
    default:
      return "TEXT";
  }
}

/**
 * W50/336-1 (P12 producer): PostgreSQL-flavoured DDL derived from the A6 data
 * contract. `project.contracts.entities` genuinely carries the schema input â€”
 * every entity with its field names and types (algorithms.ts `synthesizeContracts`)
 * â€” so the P12 "database schema" deliverable is DERIVED from the spec, never
 * invented: every table and column comes from a contract entity/field, and a
 * contract with no entities returns "" (no schema is fabricated).
 *
 * Honesty (B-18): the emitted scaffold provisions and runs no database, so the
 * body's own header states the DDL is a spec, not a provisioned database. Pure
 * and deterministic: identical contracts â‡’ identical bytes.
 */
export function databaseSchemaSql(contracts: DataContract | null | undefined): string {
  const entities = Array.isArray(contracts?.entities) ? contracts.entities : [];
  const tables = entities.filter((e) => e && typeof e.name === "string" && e.name.trim().length > 0);
  if (tables.length === 0) return "";
  const esc = (s: string): string => s.replace(/"/g, '""');
  const lines: string[] = [
    `-- Database schema derived from the A6 data contract (project.contracts.entities).`,
    `-- Declarative spec only: the emitted scaffold provisions and runs no database (B-18).`,
    `-- Dialect: PostgreSQL.`,
    ``,
  ];
  for (const e of tables) {
    const fields = Array.isArray(e.fields) ? e.fields : [];
    const cols: string[] = [];
    for (const f of fields) {
      if (!f || typeof f.name !== "string" || !f.name.trim()) continue;
      const rawType = typeof f.type === "string" ? f.type : "";
      const nullable = rawType.endsWith("?");
      const sqlType = schemaSqlType(nullable ? rawType.slice(0, -1) : rawType);
      const name = esc(f.name);
      const pk = f.name === "id" && !nullable ? " PRIMARY KEY" : "";
      cols.push(`  "${name}" ${sqlType}${nullable ? "" : " NOT NULL"}${pk}`);
    }
    if (cols.length === 0) continue;
    lines.push(`CREATE TABLE IF NOT EXISTS "${esc(e.name)}" (`, cols.join(",\n"), `);`, ``);
  }
  if (lines.length === 4) return "";
  return lines.join("\n").trimEnd() + "\n";
}

export function synthesizePhase(
  project: Project,
  phase: PhaseId,
  ctx?: { attempt: number; note: string | null },
): {
  artifacts: Artifact[];
  memory: MemoryEntry[];
  logs: JsonLog[];
  scorecard?: FeasibilityScorecard;
  competitors?: Competitor[];
  openapi?: string;
  adr?: string;
  generatedSource?: string;
  lastTest?: { ok: boolean; detail: string };
  hitl?: HitlRequest;
} {
  const now = Date.now();
  const def = phaseDef(phase);
  const attempt = ctx?.attempt ?? 0;
  const rejectionNote = ctx?.note ?? null;
  const name = project.name;
  const domain = project.domain;
  const logs: JsonLog[] = [
    {
      ts: now,
      phase,
      level: "info",
      // CORE-06: a regeneration attempt (rejected â†’ retried â†’ re-synthesized) is
      // a NEW entry for the SAME phase lifecycle â€” label it so the JSON log does
      // not show two indistinguishable phase.enter rows for one lifecycle.
      event: attempt > 0 ? "phase.regenerate" : "phase.enter",
      detail: `${def.code} ${def.title}`,
    },
  ];

  const mem = (
    kind: MemoryEntry["kind"],
    text: string,
    score: number,
    // E-18 provenance: rows synthesized by the engine are stamped "engine" by
    // default; report-intake ("agent-report") and HITL rows ("human") stamp
    // their own sources at their call sites.
    source: MemoryEntry["source"] = "engine",
  ): MemoryEntry => ({
    id: `${phase}-${kind}-${score}`,
    kind,
    phase,
    text,
    score,
    source,
  });

  switch (phase) {
    case 0: {
      const sc = scorecard(project);
      const lat = project.lattice;
      // P0-02 (fixes/97, 87 H2a): a vocabulary-bearing brief that fell back to
      // the vague lattice is the 87/88 wrong-product signature â€” record it as
      // memory + log so the run is visibly explainable (deterministic and
      // idempotent: same brief â†’ same row id via dedupeMemoryIds).
      const vague = lat?.vague === true;
      // L1 vague-brief capture (fixes/98 Â§2.3 writer 1 / 98_make_2 Â§5): when the
      // P0 lattice sealed vague OR empty while the brief still carries real nouns,
      // mint ONE content-addressed vague-brief lesson row (source "engine"). The
      // id hashes the deterministic text, so re-sealing P0 never forks a row.
      const latticeEmpty =
        !lat ||
        ((!Array.isArray(lat.jobs) || lat.jobs.length === 0) &&
          (!Array.isArray(lat.entities) || lat.entities.length === 0));
      const l1Lesson =
        lessonSurface && (vague || latticeEmpty)
          ? (() => {
              const absent = lessonSurface.absentLexNouns(project.brief, project.lattice);
              return absent.length > 0 ? lessonSurface.vagueBriefLesson(project, absent) : null;
            })()
          : null;
      return {
        scorecard: sc,
        artifacts: [
          art(
            0,
            "scorecard",
            "Feasibility & Architecture Scorecard",
            [
              `# ${name} â€” Phase 0 scorecard`,
              ``,
              `Domain: ${domain}`,
              `Overall: ${sc.overall} / 10 â€” ${sc.verdict}`,
              `Lattice jobs: ${(lat?.jobs ?? []).join(", ") || "n/a"}`,
              `Entities: ${(lat?.entities ?? []).join(", ") || "n/a"}`,
              `Constraints: ${(lat?.constraints ?? []).join(", ") || "none"}`,
              ``,
              ...sc.axes.map((a) => `- ${a.label}: ${a.score}/10 â€” ${a.note}`),
              ``,
              `## Bottlenecks`,
              ...sc.bottlenecks.map((b) => `- ${b}`),
              ``,
              `## Attack vectors`,
              ...sc.attackVectors.map((b) => `- ${b}`),
              ``,
              `## Recommended libraries`,
              ...sc.libraries.map((l) => `- ${l.name}: ${l.role}`),
            ].join("\n"),
          ),
          art(
            0,
            "algorithm",
            "Intent Lattice (A1)",
            JSON.stringify(lat ?? {}, null, 2),
            "json",
          ),
        ],
        memory: [
          mem("episodic", `Ingested brief for ${name} in ${domain}.`, 0.91),
          mem("semantic", "Scorecard must exist before any code node fires.", 0.97),
          // Correction (fixes/100 #1): MemoryEntry.kind has no "note" member â€”
          // the LEX-gap row is semantic provenance, not a display note.
          ...(vague
            ? [
                mem(
                  "semantic",
                  "LEX gap: brief matched no job/entity vocabulary â€” lattice fell back to deliver-core-workflow. Tighten brief or extend LEX.",
                  0.5,
                ),
              ]
            : []),
          ...(l1Lesson ? [l1Lesson] : []),
        ],
        logs: [
          ...logs,
          {
            ts: now + 1,
            phase,
            level: "info",
            event: "scorecard.ready",
            detail: `overall=${sc.overall} verdict=${sc.verdict}`,
          },
          ...(vague
            ? [
                {
                  ts: now + 2,
                  phase,
                  level: "info" as const,
                  event: "lattice.vague",
                  detail: "LEX gap: brief matched no job/entity vocabulary â€” lattice fell back to deliver-core-workflow.",
                },
              ]
            : []),
          ...(l1Lesson
            ? [
                {
                  ts: now + 3,
                  phase,
                  level: "info" as const,
                  event: "lesson.capture",
                  detail: `L1 vague-brief ${l1Lesson.id} (P0 lattice vague/empty with brief nouns absent)`,
                },
              ]
            : []),
        ],
        hitl:
          sc.verdict === "reframe"
            ? (() => {
                // M5/D2 (fixes/144): tier-2 lesson read-back into the reframe
                // HITL prompt. When the project's own memory carries prior-run
                // lesson rows, the top rows (phase-0 preferred, score-capped)
                // are FusionRank-ranked against the brief and rendered as a
                // bounded advisory block so the human tightening the brief
                // sees what prior runs already learned. Zero lesson rows (or
                // the client where the lazy knowledge seam is null) â†’ the
                // prompt stays byte-identical to the legacy string below.
                const lessonLines =
                  lessonSurface && (project.memory ?? []).length > 0
                    ? lessonSurface.lessonLinesForBrief(
                        project.brief,
                        lessonSurface.selectLessons(
                          project.memory ?? [],
                          0,
                          lessonSurface.lessonRankLimit,
                        ),
                        { limit: lessonSurface.lessonRankLimit },
                      )
                    : [];
                const base =
                  "Scorecard verdict is reframe. Approve only if you accept the risk, or reject with a tighter brief.";
                return {
                  phase: 0,
                  title: "Reframe the brief",
                  prompt:
                    lessonLines.length > 0
                      ? [
                          base,
                          "",
                          "Lessons from prior runs (advisory â€” tighten the brief so these failure modes are addressed; never overrides the gate):",
                          ...lessonLines.map((l) => `- ${l}`),
                        ].join("\n")
                      : base,
                  stakes: "Feasibility below the proceed line.",
                  // A04/B-03: a reframe is the machine telling the human to tighten the brief â€”
                  // autopilot must never self-accept it.
                  forceHuman: true,
                };
              })()
            : undefined,
      };
    }
    case 1: {
      // 118 P-D3: the topology is now PRODUCT-shaped for every kind. The
      // historical kind-derived titles are kept (handoff fixture pins them);
      // the body is the brief's own pipeline â€” its verbs and nouns â€” never the
      // engine's root_coordinator / LlmAgent / phase-lock graph.
      const tokens = new Set(tokenizeWords(project.brief));
      const agentVocab = ["dispatcher", "dispatch", "workflow", "agent", "orchestrat", "llm", "crew", "transfer", "mcp"];
      const agentHit = agentVocab.some((t) => tokens.has(t) || tokens.has(stemToken(t)));
      const jobs = productJobs(project);
      const nouns = productNouns(project);
      const flow =
        (project.implementationSpec?.dataFlow ?? []).slice(0, 6).join(" â†’ ") ||
        jobs.slice(0, 6).join(" â†’ ") ||
        "core workflow";
      const primary = nouns[0] ?? "record";
      const body = [
        `Sequential pipeline: ${flow}`,
        `State entities: ${nouns.length ? nouns.join(", ") : "records"}`,
        ``,
        `Each step advances a ${primary} through its lifecycle in the ${domainLabel(domain)} domain â€” DECLARED from the P0 lattice's jobs/entities (LEX vocabulary + brief content nouns), not observed runtime behaviour.`,
        ``,
        `> Derivation: a single sequential flow over ${primary}s; no parallel, event, or failover topology is claimed beyond what the brief states.`,
      ].join("\n");
      return {
        artifacts: [art(1, "graph", agentHit ? "Dispatcher topology" : "Execution topology (this build)", body, "text")],
        memory: [mem("procedural", `${name} executes as one sequential ${domainLabel(domain)} pipeline.`, 0.99)],
        logs,
      };
    }
    case 2: {
      // 118 P-D3: product-shaped persistence â€” the brief's nouns are the
      // records, its verbs the operations. No FusionRank / localStorage engine
      // internals. The entity/field model is the DECLARED A6 contract
      // (`project.contracts`), never an assertion about observed reads/writes
      // (the pre-fix body claimed "steps read and write that state").
      const nouns = productNouns(project);
      const jobs = productJobs(project);
      const contractEntities = (project.contracts?.entities ?? []).filter(
        (e) => e.name !== "Operator" && e.name !== "Record",
      );
      return {
        artifacts: [
          art(
            2,
            "memory",
            "Data model & retrieval",
            [
              `Records (brief-derived nouns): ${nouns.length ? nouns.join(", ") : "records"}`,
              `Operations (declared steps): ${jobs.length ? jobs.join(", ") : "core workflow"}`,
              contractEntities.length > 0
                ? `Declared data contract (A6, from the P0 lattice â€” a declaration, not observed access): ${contractEntities
                    .map((e) => `${e.name}(${e.fields.map((f) => f.name).join(", ")})`)
                    .join("; ")}`
                : `Declared data contract: no LEX-derived entity model (the lattice fell back) â€” the records above are the brief's own nouns.`,
              ``,
              `> Persistence is a DECLARATION (the plan's data model), not observed reads/writes; no database or durable store is claimed.`,
            ].join("\n"),
          ),
        ],
        memory: [mem("semantic", `Data model written for ${name}: ${nouns.join(", ") || "records"}.`, 0.94)],
        logs,
      };
    }
    case 3: {
      // 118 P-D3: the surface is a DECLARATION of the domain's category
      // surfaces â€” never a claim that the brief named these services. When the
      // domain has no known category the list is EMPTY and the note says so
      // (the pre-fix placeholder "external services named by the brief" was
      // prose claiming evidence it did not have).
      const surface = domainSurface(domain);
      return {
        artifacts: [
          art(
            3,
            "mcp",
            "Integration surface (declared)",
            JSON.stringify(
              {
                domain,
                surface,
                note:
                  surface.length > 0
                    ? "Category surfaces DECLARED for this domain â€” not services the brief named, and not implemented bindings (honest)."
                    : "No external category surface is declared for this domain; none is claimed (honest).",
              },
              null,
              2,
            ),
            "json",
          ),
        ],
        memory: [mem("procedural", `Integration surface for ${domainLabel(domain)} declared from domain vocabulary.`, 0.93)],
        logs,
      };
    }
    case 4: {
      // 118 P-D3: product-shaped security â€” protect the brief's own entities with
      // least-privilege roles. The engine's sandbox is the isolation half and is
      // confirmed honestly at the gate below, not re-described in the body.
      const nouns = productNouns(project);
      const actors = productActors(project);
      return {
        artifacts: [
          art(
            4,
            "security",
            "Security & authorization policy",
            [
              `Protected data: ${nouns.length ? nouns.slice(0, 6).join(", ") : "records"} (the brief's own entities).`,
              `Access model: ${actors.length ? actors.slice(0, 6).join(", ") : "roles"} â€” least privilege per role.`,
              ``,
              `Authorization:`,
              `  â€¢ Each actor may act only on the ${nouns[0] ?? "record"}s its role owns.`,
              `  â€¢ Elevated actions outside an actor's scope are refused.`,
              `  â€¢ Sensitive ${nouns[0] ?? "record"} data (identity, financial) is never logged in the clear.`,
              ``,
              `> Policy above is a declaration derived from the brief's domain; the implemented isolation boundary is confirmed at the gate below (B-18 honesty).`,
            ].join("\n"),
          ),
        ],
        memory: [mem("procedural", "Product data is protected by least-privilege role access.", 0.98)],
        logs,
        hitl: {
          phase: 4,
          title: "Approve isolation policy",
          // P0-05 (fixes/97, DF-05): the gate must confirm the IMPLEMENTED
          // boundary, never an unimplemented policy. Declared-not-implemented
          // items are named only to forbid approving them as fact.
          prompt:
            `Confirm the implemented execution boundary: ${sandboxClaim(project.sandbox)} ` +
            `(timeout ${project.sandbox.timeoutS}s, ramMb ${project.sandbox.ramMb ?? "unset"}), ` +
            `${project.sandbox.isolated ? "isolated" : "non-isolated"} flag, and network deny only inside ` +
            `the engine-template runner. Declared-not-implemented (do NOT approve as fact): 256 MB ` +
            `cgroups/gVisor/WASM isolates, OAuth-scoped tool calls, worker sandbox.`,
          stakes: "Sandbox and authorization boundary â€” high stakes.",
        },
      };
    }
    case 5: {
      // The learning loop's ACTUAL state, derived here (not a stale constant):
      // L1/L5 capture is implemented and read back into the next regeneration;
      // drift capture and permanent-store promotion are declared. The pre-fix
      // body printed a fixed capabilityLine that admitted "no loop behind it"
      // even as the loop was wired.
      const nouns = productNouns(project);
      return {
        artifacts: [
          art(
            5,
            "validation",
            "Validation + HITL contract",
            [
              `Validation contract (the HITL rules the engine actually enforces):`,
              `  1. Rejections require â‰¥12 characters of qualitative feedback (ADR-002).`,
              `  2. forceHuman gates (reframe, failed sandbox) can never be autopilot-approved.`,
              `  3. Phases execute strictly in order â€” the linear 0â†’12 graph.`,
              `  4. Every approval lands in the append-only decision journal.`,
              ``,
              `Data under validation: ${nouns.length ? nouns.slice(0, 6).join(", ") : "records"} (the brief's own product nouns â€” a declaration).`,
              ``,
              `Rejection policy: qualitative feedback is mandatory. Diagnostics: one JSON event per orchestration step.`,
              ``,
              `> Learning loop â€” IMPLEMENTED: L1 vague-brief + L5 user-correction capture (a human reject's lesson is read back into the next regeneration). DECLARED: drift capture (E-19 unwired) and permanent-store promotion (human 'lesson --accept' only).`,
            ].join("\n"),
          ),
        ],
        memory: [mem("procedural", "HITL reject requires a written reason.", 0.99)],
        logs,
        hitl: {
          phase: 5,
          title: "Approve validation contract",
          prompt:
            "Accept the validation contract and the rule that rejections must include qualitative feedback.",
          stakes: "Prevents infinite regeneration loops.",
        },
      };
    }
    case 6: {
      const jobs = (project.lattice?.jobs ?? ["core"]).slice(0, 5);
      // T9/R-209 steering: rejection notes flow into the module; variant flips deterministically
      // with the note hash + attempt so different rejections produce different modules.
      // A05: scope the fallback to THIS phase â€” an earlier phase's rejection note must not leak
      // into the P6 module contract/variant.
      const note = rejectionNote ?? project.phases.find((p) => p.id === phase && p.rejectionNote)?.rejectionNote ?? null;
      const variant = (fnv1a(note ?? "") + attempt) % 2;
      let code = buildPhase6Module({ name, jobs, rejectionNote: note, variant });
      let healed = false;
      let result = runGenerated(code);
      if (!result.ok) {
        const patched = healSource(code, result.detail);
        if (patched !== code) {
          code = patched;
          healed = true;
          result = runGenerated(code);
        }
      }
      const extra = project.schedule?.extraHitl.includes(6) || !result.ok;
      const healLogs: JsonLog[] = !result.ok
        ? [
            {
              ts: now + 1,
              phase,
              level: "info",
              event: healed ? "heal.repaired" : "heal.noop",
              detail: healed ? "self-healing produced a repaired module" : "no automatic repair applicable â€” no blind identical re-run (B-07)",
            },
          ]
        : [];
      return {
        generatedSource: code,
        lastTest: result,
        artifacts: [
          // P0-01 Part A (fixes/97): the deterministic template is a labeled
          // placeholder, never "Typed synthesis" â€” it does not synthesize the
          // brief (the p6-brief-fit probe records that FAIL honestly).
          art(6, "code", "P6 placeholder module (deterministic template)", code, "javascript"),
          art(6, "code", "Sandbox result", JSON.stringify(result, null, 2), "json"),
        ],
        memory: [mem("episodic", `Sandbox ${result.ok ? "passed" : "failed"}: ${result.detail.slice(0, 80)}`, 0.86)],
        logs: [
          ...logs,
          ...healLogs,
          {
            ts: now + 2,
            phase,
            level: result.ok ? "info" : "error",
            event: result.ok ? "tests.pass" : "tests.fail",
            detail: result.detail,
          },
        ],
        hitl: extra
          ? {
              phase: 6,
              title: result.ok
                ? "Approve placeholder module (deterministic template)"
                : "Sandbox failed â€” review",
              prompt: result.ok
                ? "Scheduler raised HITL on the placeholder module (deterministic template â€” it does not implement the brief; keyed synthesis is a separate path)."
                : `Tests failed: ${result.detail}. Approve only after you accept a retry.`,
              stakes: "Generated code enters the isolate.",
              // R3/B-03: a FAILING sandbox can never be autopilot-approved.
              forceHuman: !result.ok,
            }
          : undefined,
      };
    }
    case 7: {
      const market = marketFor(domain);
      return {
        competitors: market,
        artifacts: [
          art(
            7,
            "research",
            "Competitive analysis matrix",
            [
              `# Market position â€” ${name}`,
              ``,
              `> Illustrative competitor templates (source: illustrative â€” NOT live research). Verify before citing.`,
              ``,
              ...market.map(
                (c) => `## ${c.name} (${c.class})\nSource: illustrative template\nStrength: ${c.strength}\nGap RapidTool exploits: ${c.gap}`,
              ),
              ``,
              `Architectural advantage: deterministic 0â€“12 graph with HITL and ADRs â€” generators skip this; IDEs leave it to the human.`,
              `MCP/A2A server contracts are roadmap declarations, not runtime (B-18).`,
            ].join("\n"),
          ),
        ],
        memory: [mem("semantic", "Generators ship UI fast; RapidTool ships a governed lifecycle.", 0.95)],
        logs,
      };
    }
    case 8: {
      // P0-03 (fixes/97, DF-02): P8 must synthesize a CLIENT-shaped surface
      // contract per delivery kind â€” never a description of RapidTool's own
      // console. Keyless runs (no expanded spec) append the B-18 declaration
      // tail so a declaration is never readable as an implementation.
      const kind = uiKindOf(project);
      const spec = project.implementationSpec;
      const entities = (project.lattice?.entities ?? []).slice(0, 6);
      const reqs = (spec?.requirements ?? []).slice(0, 6);
      const sigs = spec?.typeSignatures ?? [];
      const keylessTail =
        spec != null
          ? ""
          : `\n> prototype pending â€” no ${kind === "ui" ? "UI" : "surface"} code generated; this contract is a declaration (deterministic template), not an implementation (B-18 honesty).`;
      let title: string;
      let body: string;
      let prompt: string;
      let memText: string;
      if (kind === "cli-tool") {
        title = "CLI surface contract";
        body = [
          `Kind: cli-tool â€” no UI surface in scope.`,
          `Commands/flags (derived from the brief):`,
          ...(entities.length > 0 ? entities.map((e) => `- ${e}`) : [`- (no command vocabulary â€” keyless run)`]),
          `Usage: ${project.name || "cli"} [options] ${entities[0] ?? "<files>"}`,
          ...(spec != null
            ? [``, `Entry/argv functions:`, ...sigs.filter((s) => /\b(main|parseArgs|argv|run|plan|apply)\b/.test(s)).map((s) => `- ${s}`)]
            : []),
          keylessTail,
        ].join("\n");
        prompt = "Confirm the CLI surface contract (flags + commands derived from the brief).";
        memText = "CLI surface contract written from brief vocabulary; no UI phase for cli-tool kind.";
      } else if (kind === "library") {
        title = "Library API contract";
        body = [
          `Kind: library â€” API surface, no UI.`,
          ...(spec != null
            ? [``, `Type signatures (from the brief expansion spec):`, ...sigs.map((s) => `- ${s}`)]
            : [`(no expanded spec present â€” keyless run; signatures pending)`]),
          ...(reqs.length > 0
            ? [``, `Requirement trace:`, ...reqs.map((r, i) => `- req-${i + 1}: ${r}`)]
            : []),
          keylessTail,
        ].join("\n");
        prompt = "Confirm the library API contract (typeSignatures from the spec).";
        memText = "Library API contract written â€” type signatures must be the module's exports (P6).";
      } else {
        title = "Interface contract (client UI)";
        // fixes/136 (P8): keyless screens are the brief's real product surfaces â€”
        // one distinct entity-management responsibility per screen, never one
        // screen per lattice verb (the old `screens = jobs` degeneracy emitted
        // an identical "Screen: <verb> / Responsibility: <verb> over â€¦" for
        // every verb). The lattice JOBS are the ACTIONS bound under each screen,
        // not screens themselves. spec!=null keeps the requirement-trace screens.
        const entityScreens = keylessScreens(project);
        const screens = spec != null ? reqs : entityScreens.map((s) => s.entity);
        body = [
          spec != null
            ? `Screens derived from the briefed requirements:`
            : `Screens derived from the brief's product surfaces (one distinct entity-management responsibility each â€” never one screen per verb):`,
          ...(screens.length > 0
            ? spec != null
              ? screens.map(
                  (s, i) =>
                    `Screen: ${s}\n  Shows: ${entities.join(", ") || "n/a"}\n  Binding: req-${i + 1}\n  State: ${slug(s)}`,
                )
              : entityScreens.map(
                  (s) =>
                    `Screen: ${s.entity}\n  Responsibility: ${s.entity} management\n  Actions: ${s.actions.length ? s.actions.join(", ") : "(none named)"}\n  State: ${slug(s.entity)}`,
                )
            : [`(no screen vocabulary â€” brief is too thin for a UI contract)`]),
          keylessTail,
        ].join("\n");
        prompt =
          spec != null
            ? `Confirm the client UI contract: ${Math.min(3, screens.length)} screen(s) derived from the brief.`
            : `Confirm the client UI contract: ${Math.min(3, screens.length)} surface(s) derived from the brief's entities. Keyless runs: this is a declaration, not implemented UI.`;
        memText = "Client UI contract written â€” screens bound to briefed entities; flows listed as actions.";
      }
      return {
        artifacts: [art(8, "ui", title, body)],
        memory: [mem("procedural", memText, 0.92)],
        logs,
        hitl: {
          phase: 8,
          title: "Approve interface contract",
          prompt,
          stakes: "Locks the human-facing architecture.",
        },
      };
    }
    case 9:
      return {
        artifacts: [
          art(
            9,
            "cicd",
            "GitHub Actions workflow",
            [
              `# template â€” not executed: recorded P9 artifact; RapidTool never ran this workflow (B-18).`,
              `name: rapidtool-gate`,
              `on: [pull_request]`,
              `jobs:`,
              `  check:`,
              `    runs-on: ubuntu-latest`,
              `    steps:`,
              `      - uses: actions/checkout@v4`,
              `      - uses: actions/setup-node@v4`,
              `        with:`,
              `          node-version: "22"`,
              `      - run: npm ci`,
              `      - run: npm run typecheck`,
              `      - run: npm test`,
            ].join("\n"),
            "yaml",
          ),
          art(
            9,
            "cicd",
            "IaC sketch",
            [
              `# template â€” not executed: recorded P9 sketch; nothing here was provisioned or validated (B-18).`,
              `# GCP + Firebase hosting`,
              `hosting: firebase preview channels`,
              `workers: cloud run, scale-to-zero`,
              `gpu: provision only for local-edge promotion jobs`,
            ].join("\n"),
          ),
        ],
        memory: [mem("procedural", "PRs cannot merge without typecheck + tests.", 0.96)],
        logs,
        hitl: {
          phase: 9,
          title: "Approve production routing",
          prompt: "Allow CI gates and Firebase/GCP routing templates to be written.",
          stakes: "External deployment â€” high stakes.",
        },
      };
    case 10: {
      // 118 P-D3: product-shaped inference â€” where the product's "smart" steps
      // run. No deepseek/route engine internals.
      const jobs = productJobs(project);
      const nouns = productNouns(project);
      return {
        artifacts: [
          art(
            10,
            "edge",
            "Local compute & inference",
            [
              `Compute model: ${jobs.length ? jobs.join(", ") : "core workflow"} run as deterministic local steps over ${nouns[0] ?? "records"}.`,
              ``,
              `No remote model inference or edge handoff is claimed â€” the product's logic is deterministic unless the brief names a model.`,
            ].join("\n"),
          ),
        ],
        memory: [mem("procedural", "Product logic runs locally and deterministically; no remote model is claimed.", 0.9)],
        logs,
      };
    }
    case 11: {
      const surfaces = domainSurface(domain);
      return {
        artifacts: [
          art(
            11,
            "tools",
            "Live data & tool surfaces",
            JSON.stringify(
              {
                domain,
                surfaces,
                note:
                  surfaces.length > 0
                    ? "Live surfaces DECLARED for this domain â€” not services the brief named, and not bound at runtime (honest)."
                    : "No live category surface is declared for this domain; none is claimed (honest).",
              },
              null,
              2,
            ),
            "json",
          ),
        ],
        memory: [mem("episodic", "Live data surfaces declared from domain vocabulary; no runtime binding.", 0.87)],
        logs,
        hitl: project.schedule?.extraHitl.includes(11)
          ? {
              phase: 11,
              title: "Approve live tool binding",
              prompt: "Scheduler requires HITL before binding live search and new APIs.",
              stakes: "External network tools.",
            }
          : undefined,
      };
    }
    case 12: {
      const endpoints = project.contracts?.endpoints ?? [];
      const paths =
        endpoints.length > 0
          ? endpoints
              .map(
                (e) =>
                  `  ${e.path}:\n    ${e.method.toLowerCase()}:\n      summary: ${e.job}\n      responses:\n        "200":\n          description: ok`,
              )
              .join("\n")
          : [
              `  /projects:`,
              `    post:`,
              `      summary: Create a governed build`,
              `      responses:`,
              `        "201":`,
              `          description: Project accepted into Phase 0`,
            ].join("\n");
      const openapi = [`openapi: 3.1.0`, `info:`, `  title: ${name} API`, `  version: "1.0.0"`, `paths:`, paths].join(
        "\n",
      );
      const nouns = productNouns(project);
      const jobs = productJobs(project);
      const adr = [
        `# ADR-001 ${domainLabel(domain)} entity model`,
        ``,
        `Status: accepted`,
        `Decision: The product's state is modeled around ${nouns.join(", ") || "records"} derived from the brief (P0 lattice).`,
        ``,
        `# ADR-002 ${jobs[0] ?? "core"} pipeline`,
        ``,
        `Status: accepted`,
        `Decision: The product runs a sequential ${jobs.join(" â†’ ") || "core workflow"} pipeline over its entities.`,
        ``,
        `# ADR-003 ${domainLabel(domain)} integration boundaries`,
        ``,
        `Status: accepted`,
        `Decision: External surfaces are ${domainSurface(domain).join(", ") || "none declared"} â€” declarations, not runtime bindings.`,
      ].join("\n");
      // fixes/144 (M4-1, seal-path guard â€” engine half): a red-gate seal is
      // never presented as a bare clean "all phases sealed" â€” when any
      // complete phase carries a failed DoD gate the delivery record carries
      // the census ("N failed gates: <ids>") and warns, so a failed-gate run
      // can never emit byte-identical output to a clean one.
      const seal = sealHonesty(project);
      const deliveryDetail = seal.clean
        ? `All ${PHASES.length} phases sealed.`
        : `All ${PHASES.length} phases sealed. ${seal.failed.length} failed gates: ${seal.failed.join(", ")}`;
      // W50/336-1: the P12 database-schema deliverable had no producer (335-1
      // STOP item). The A6 contract carries the input, so the DDL is DERIVED
      // here (databaseSchemaSql) and emitted as its own artifact â€” a contract
      // with no entities yields no row (never a fabricated schema).
      const schema = databaseSchemaSql(project.contracts);
      return {
        openapi,
        adr,
        artifacts: [
          art(12, "docs", "Architecture Decision Records", adr, "markdown"),
          art(12, "docs", "OpenAPI 3.1", openapi, "yaml"),
          ...(schema ? [art(12, "docs", "Database schema (SQL DDL)", schema, "sql")] : []),
        ],
        memory: [mem("semantic", "ADRs capture the product's entity model and pipeline decisions.", 0.97)],
        logs: [
          ...logs,
          {
            ts: now + 3,
            phase,
            level: seal.clean ? ("info" as const) : ("warn" as const),
            event: "delivery.complete",
            detail: deliveryDetail,
          },
        ],
      };
    }
  }
}

/** W62 Â· C1-07-class remediation (P0): `intentLattice.vague` is computed from
 *  the CLOSED LEX register, so a brief that named real product objects but no
 *  LEX job/entity (the canonical bakery brief) sealed `vague:true` â€” and the
 *  DoD probes `p0-verdict`/`p0-brief-grounded` then failed, hard-blocking a
 *  keyed enforceDod run at P0. The lattice's additive `briefNouns` fold and the
 *  sandbox product/domain register both prove such a brief DOES carry
 *  vocabulary beyond LEX; calling it vocabulary-free is false. Normalize the
 *  flag to the truth: `vague` stays true only when the brief names nothing the
 *  register knows. A lattice already not vague is returned unchanged, and a
 *  truly vocabulary-free brief ("hi", "build a tool for my team please") stays
 *  vague â€” the L1 vague-brief lesson and the reframe park still fire. */
function groundLatticeVague(lat: IntentLattice, brief: string): IntentLattice {
  if (lat.vague !== true) return lat;
  if (Array.isArray(lat.briefNouns) && lat.briefNouns.length > 0) return { ...lat, vague: false };
  const tokens = briefTokens(stripOutOfScope(typeof brief === "string" ? brief : ""));
  // A mere UI-surface noun ("page", "dashboard") is not grounding evidence â€” the
  // gate's own vocabulary check treats those as stopwords â€” so only a registered
  // PRODUCT/domain object counts (a bakery's `bakery`/`delivery`/`order`; the
  // held-out tool library's `catalogue` is surface-only, so it stays vague).
  return tokens.some((t) => BRIEF_CORE_REGISTER.has(t) && !UI_SURFACE_WORDS.includes(t))
    ? { ...lat, vague: false }
    : lat;
}

function attachAlgorithms(project: Project): Project {
  const ran = runAlgorithms(project);
  const next: Project = {
    ...project,
    lattice: groundLatticeVague(ran.lattice, project.brief),
    schedule: ran.schedule,
    specGraph: ran.specGraph,
    contracts: ran.contracts,
    oracle: ran.oracle,
    crew: ran.crew,
    traces: [
      ...ran.traces,
      {
        id: "A2" as const,
        name: "FusionRank",
        ranAt: Date.now(),
        summary: `ranked ${project.memory.length} memory rows for the packet`,
      },
      {
        id: "A4" as const,
        name: "Agent Packet",
        ranAt: Date.now(),
        summary: `compiled ${phaseDef(project.currentPhase).code} packet`,
      },
    ].sort((a, b) => a.id.localeCompare(b.id)),
    packet: "",
  };
  next.packet = compileAgentPacket(next);
  return next;
}

// ---------------------------------------------------------------------------
// fixes/144 â€” seal-path honesty (M4-1 engine half) + L2 lesson content
// (M5-1 engine half).
// ---------------------------------------------------------------------------

/**
 * Pure seal-honesty census (fixes/144 M4-1, engine half). `clean` is true only
 * when no COMPLETE phase carries a recorded failed DoD gate (failedGates()
 * empty); `failed` lists the red phase ids (`P${phase}`, phase order). The P12
 * delivery.complete writer below consumes it so a red-gate seal can never
 * present byte-identical output to a clean one; the headless driver / CLI
 * import it for the completion gate (export name stable â€” do not rename).
 */
export function sealHonesty(project: Project): { clean: boolean; failed: string[] } {
  const failed = failedGates(project).map((g) => `P${g.phase}`);
  return { clean: failed.length === 0, failed };
}

/**
 * Deterministic lesson-evidence digest (fixes/144 M5-1, engine half) in the
 * shared format knowledge.ts's lessonEvidenceDetail helper emits (C4 lane) so
 * engine-minted and driver-minted L2 rows converge byte-for-byte:
 *   `unmet: <criteria verbatim, ", "-joined> Â· class: <RT_E code> Â· tail: <first 300 chars>`
 * Optional segments are omitted when absent. Whitespace-collapsed.
 */
function lessonEvidenceDetail(
  unmet: readonly string[],
  refusalClass?: string | null,
  tail?: string | null,
): string {
  const u = (Array.isArray(unmet) ? unmet : [])
    .filter((c): c is string => typeof c === "string" && c.trim() !== "")
    .map((c) => c.trim());
  const parts: string[] = [`unmet: ${u.join(", ")}`];
  const cls = typeof refusalClass === "string" ? refusalClass.trim() : "";
  if (cls) parts.push(`class: ${cls}`);
  const t = typeof tail === "string" ? tail.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  if (t) parts.push(`tail: ${t}`);
  return parts.join(" Â· ");
}

/**
 * The last recorded refusal class on the journey â€” parsed from the NEWEST log
 * whose event names a refusal (`p6.synthesis.refused` â€¦) with a
 * "<RT_E code> Â· <reason>" detail (codegen's refusal-log shape). Null when no
 * refusal was recorded. The reason (bounded in codegen's log) rides as the
 * digest tail.
 */
function refusalClassOf(project: Project): { code: string; tail: string } | null {
  const logs = project.logs ?? [];
  for (let i = logs.length - 1; i >= 0; i--) {
    const l = logs[i];
    if (!l || typeof l.event !== "string" || !l.event.includes("refused")) continue;
    if (typeof l.detail !== "string") continue;
    const m = /^(RT_E_[A-Z0-9_]+)(?:\s*Â·\s*([\s\S]*))?$/.exec(l.detail.trim());
    if (m) {
      const tail = (m[2] ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
      return { code: m[1], tail };
    }
  }
  return null;
}

/**
 * Fit the evidence digest into the H43-P2-2 row budget (240). Segments are
 * `unmet: <criteria>` Â· `class: <code>` Â· `tail: <reason>` in that order.
 * The class clause is ATOMIC â€” when the verbatim unmet list crowds it out the
 * unmet list is trimmed from its tail first so a recorded refusal code is
 * never silently mangled; the tail clause is sliced to whatever room remains.
 *
 * fixes/357: the clauses are located by their OWN prefixes, never by splitting
 * the joined digest. The unmet criteria are VERBATIM free text and may contain
 * the ` Â· ` separator themselves â€” a real P6 criterion does ("â€¦required brief Â·
 * keyed synthesis was ATTEMPTED and REFUSEDâ€¦"), and splitting let that
 * criterion stand in for the class clause: the loop then "fitted" the
 * criterion and broke, so the class segment never landed and the atomic
 * guarantee above silently failed (lesson-writers.test.ts, the P6 long-unmet
 * case).
 */
function fitLessonEvidence(digest: string, budget = 240): string {
  const t = digest.replace(/\s+/g, " ").trim();
  if (t.length <= budget) return t;
  const classAt = t.indexOf(" Â· class: ");
  const tailAt = t.indexOf(" Â· tail: ");
  const head = classAt >= 0 ? t.slice(0, classAt) : tailAt >= 0 ? t.slice(0, tailAt) : t;
  const classSeg = classAt >= 0 ? t.slice(classAt + 3, tailAt > classAt ? tailAt : t.length) : "";
  const tailSeg = tailAt >= 0 ? t.slice(tailAt + 3) : "";
  let out = head;
  if (classSeg !== "") {
    // Atomic: fit the clause exactly by trimming the unmet list's tail â€” the
    // verbatim head alone may already overflow the budget, and a recorded
    // refusal code is never silently mangled (fixes/300).
    const keep = Math.max("unmet: ".length, budget - 3 - classSeg.length);
    out = `${out.length > keep ? out.slice(0, keep) : out} Â· ${classSeg}`;
  }
  if (tailSeg !== "") {
    const room = budget - out.length - 3;
    if (room > 0) out = `${out} Â· ${tailSeg.slice(0, room)}`;
  }
  return out.length <= budget ? out : out.slice(0, budget);
}

/**
 * fixes/216k Â§3: the job label a spec-graph node's `purpose` carries â€”
 * `Implement job â€œflipâ€ against the contract` â†’ `flip`. Mirrors the scaffold's
 * `jobLabelOf` quote-stripping (straight or curly quotes) + whitespace
 * collapse so the engine census and the scaffold README census label nodes
 * identically; a LOCAL copy because the engine must not import the emitter
 * module (H2 seam budget â€” the label rule is 4 lines, not a dependency).
 */
function jobLabelFromPurpose(purpose: unknown): string | null {
  if (typeof purpose !== "string") return null;
  const m = purpose.match(/["â€œ]([^"â€]+)["â€]/);
  if (!m) return null;
  const label = m[1].replace(/\s+/g, " ").trim();
  return label || null;
}

/**
 * fixes/216k Â§3 (106 T-13 / F-10) â€” the production caller of doctor.ts's
 * counted job-scope census: the `p6.jobs.shortfall` warn row the engine
 * persists onto the exported project when a P6 apply's DECLARED lattice jobs
 * outnumber the MATERIALISED spec-graph job nodes (`planSpecGraph` materialises
 * at most FIVE â€” algorithms.ts). `lattice.jobs` is the brief's own
 * declaration; the materialised side is the spec-graph job-* nodes' `purpose`
 * labels (the scaffold README census derives the same labels from the same
 * nodes), so a 6+-job brief can no longer ship fewer advertised job modules
 * silently. Pure: a project in, the log row (or null) out, using doctor.ts's
 * ONE derivation (declared-vs-materialised counts + the missing names); the
 * caller appends only a non-null row, so zero-shortfall applies return the
 * same logs array untouched (byte-identity).
 */
export function p6JobsShortfallLog(project: Project): JsonLog | null {
  const nodes = project.specGraph?.nodes ?? [];
  const materialised: string[] = [];
  for (const n of nodes) {
    if (!n || typeof n.id !== "string" || !n.id.startsWith("job-")) continue;
    // A node without a parsable label still materialised â€” count it by id so
    // the count never under-reports coverage (the `missing` names stay honest
    // because a `job-<n>` id cannot name-match a declared job).
    materialised.push(jobLabelFromPurpose(n.purpose) ?? n.id);
  }
  const s = jobScopeShortfall(project.lattice?.jobs ?? null, materialised);
  if (s.declared <= s.materialised) return null;
  return {
    ts: Date.now(),
    phase: 6,
    level: "warn",
    event: "p6.jobs.shortfall",
    detail: `declared ${s.declared} lattice job(s) vs materialised ${s.materialised} spec-graph job node(s) â€” ${
      s.declared - s.materialised
    } unmaterialised; missing: ${s.missing.join(", ")}`,
  };
}

/** W62 Â· C1-07-class remediation â€” the lesson READ-BACK for a regenerating
 *  phase. When the project's own memory carries user-correction lessons for
 *  this phase (minted by `rejectHitl`), the next attempt's artifact carries
 *  them, so a prior failure's lesson actually steers the next run. Deterministic
 *  (reads project.memory only); no lesson rows â‡’ the legacy body bytes. */
function lessonSteeringBlock(memory: readonly MemoryEntry[] | undefined, phase: PhaseId): string | null {
  const rows = (Array.isArray(memory) ? memory : []).filter(
    (m) => m && m.phase === phase && typeof m.id === "string" && m.id.startsWith("lesson-user-correction-"),
  );
  if (rows.length === 0) return null;
  return [
    ``,
    `## Lessons carried from prior runs`,
    `> Prior user corrections recorded for this phase (deterministic read-back; advisory, never overrides a gate):`,
    ...rows.slice(-3).map((m) => `- ${String(m.text ?? "").slice(0, 220)}`),
  ].join("\n");
}

export function applyPhaseResult(project: Project, phase: PhaseId): Project {
  // CORE-01 (defensive): refuse a truly invalid phase id before any array
  // indexing â€” a corrupt caller throws loudly, never crashes mid-graph.
  if (!Number.isInteger(phase) || phase < 0 || phase > PHASE_LAST) {
    // phases.ts phaseDef's documented taxonomy: an unknown/out-of-graph phase id
    // is RT_E_PHASE_ILLEGAL, so machine callers branch on code, not prose.
    const err = new Error(`applyPhaseResult: invalid phase ${String(phase)}`) as Error & { code?: string };
    err.code = "RT_E_PHASE_ILLEGAL";
    throw err;
  }
  const rec = project.phases.find((p) => p.id === phase);
  const attempt = rec?.rejectionHistory?.length ?? 0;
  const note =
    rec?.rejectionHistory?.[rec.rejectionHistory.length - 1]?.note ?? rec?.rejectionNote ?? null;
  const primed = attachAlgorithms(project);
  const result = synthesizePhase(primed, phase, { attempt, note });
  let hitl = result.hitl ?? null;
  if (phase === 6 && result.lastTest && !result.lastTest.ok && !hitl) {
    hitl = {
      phase: 6,
      title: "Sandbox failed â€” review",
      prompt: result.lastTest.detail,
      stakes: "Broken isolate output.",
      forceHuman: true,
    };
  }
  // A03: stamp the gate-open timestamp so the decision ledger records true think-time
  // instead of collapsing requestedAt === decidedAt on every row.
  if (hitl && hitl.requestedAt === undefined) {
    hitl = { ...hitl, requestedAt: Date.now() };
  }
  // T9: a regenerated text phase visibly answers its rejection (deterministic, keyword-driven).
  const artifacts = [...result.artifacts];
  if (attempt >= 1 && note && phase !== 6 && artifacts.length > 0) {
    const last = artifacts[artifacts.length - 1];
    const lessonBlock = lessonSteeringBlock(project.memory, phase);
    artifacts[artifacts.length - 1] = {
      ...last,
      body: `${last.body}\n\n${rejectionResponseBlock(attempt, note)}${lessonBlock ?? ""}`,
    };
  }
  const needsHitl = Boolean(hitl);
  const failedHard = phase === 6 && result.lastTest && !result.lastTest.ok;
  const phases = primed.phases.map((p) =>
    p.id === phase
      ? {
          ...p,
          status: needsHitl ? ("awaiting_hitl" as const) : ("complete" as const),
          startedAt: p.startedAt ?? Date.now(),
          completedAt: needsHitl ? undefined : Date.now(),
        }
      : p,
  );
  const merged: Project = {
    ...primed,
    phases,
    status: needsHitl ? "awaiting_hitl" : phase === PHASE_LAST ? "complete" : "running",
    currentPhase: phase,
    scorecard: result.scorecard ?? primed.scorecard,
    competitors: result.competitors ?? primed.competitors,
    artifacts: [
      ...primed.artifacts.filter((a) => a.phase !== phase && a.kind !== "packet"),
      ...artifacts,
    ],
    // 216i (112 Â§4.2 â€” T1): the accrual runs BEFORE the id dedupe â€” a re-minted
    // lesson row (same signature id) folds into the ONE stored row with
    // reproducedCount + 1 instead of forking a `-2` twin; every non-lesson row
    // keeps the B-12 rename semantics.
    memory: dedupeMemoryIds(accrueReproducedCounts([...result.memory, ...primed.memory])).slice(0, 80),
    logs: [
      ...primed.logs,
      ...result.logs,
      {
        ts: Date.now(),
        phase,
        level: failedHard ? ("error" as const) : ("info" as const),
        event: "algo.run",
        detail: primed.traces.map((t) => t.id).join(" "),
      },
    ].slice(-200),
    hitl,
    openapi: result.openapi ?? primed.openapi,
    adr: result.adr ?? primed.adr,
    generatedSource: result.generatedSource ?? primed.generatedSource,
    lastTest: result.lastTest ?? primed.lastTest,
  };
  // T-11 (106 Â§6, F-08) â€” GREEN-SEAL GATE: a RED seal never mints a lesson row.
  // fixes/98 Â§2.3's engine-half capture used to record "P6 sealed with unmet
  // DoD" as an L2 template-emission lesson and feed it back through
  // selectLessons â€” a lesson whose target probe never passed, so the
  // contradiction compounded instead of surfacing (the exact F-08 finding).
  // The red-seal signal is now an honest phase-scoped LOG carrying the same
  // deterministic evidence digest the row text used to carry. Lesson capture
  // stays gated on a green seal; the surviving L2 writers (headless keyed
  // refusals, report-intake agent reports) mint from their own machine
  // evidence through knowledge.ts's record gate, whose refuse:no-proof floor
  // is untouched.
  const sealLogs: JsonLog[] = [];
  if (!needsHitl && lessonSurface) {
    const r = runGate(merged, phase);
    if (!r.pass) {
      // fixes/144 (M5-1, engine half): the log records WHAT was missing, not
      // just THAT something failed (fixes/99 finding) â€” the unmet criteria
      // VERBATIM plus the journey's refusal class (RT_E_*) and refusal reason
      // when a keyed synthesis refusal was recorded â€” in the shared
      // lessonEvidenceDetail format (knowledge.ts emits the same bytes via the
      // C4 lane), fitted to the bounded ledger budget with the class clause
      // atomic (fitLessonEvidence).
      const unmetCriteria = r.unmet.map((g) => g.criterion);
      const refusal = refusalClassOf(merged);
      const digest = lessonEvidenceDetail(
        unmetCriteria,
        refusal?.code ?? null,
        refusal && refusal.tail ? refusal.tail : null,
      );
      const event = `p${phase}.seal.unmet`;
      // T-11 (106 Â§6): the DoD probe ids the digest anchors to ride the log
      // head so the ledger names the probes a green seal would have to satisfy
      // (the lesson-row half â€” `probe:<id>` tags â€” lands in knowledge.ts from
      // these same failureSignature anchors; NO row id is re-minted).
      const detail = `red seal â€” ${r.unmet.length} unmet DoD probe(s) [${r.unmet
        .map((g) => g.id)
        .join(", ")}]: ${fitLessonEvidence(digest)}`;
      // Stale-read guard: re-sealing the same unmet gate (a repair loop's
      // re-apply) adds no new fact â€” an identical row already recorded in the
      // ledger is never duplicated.
      if (!merged.logs.some((l) => l.event === event && l.detail === detail)) {
        sealLogs.push({ ts: Date.now(), phase, level: "warn" as const, event, detail });
      }
    }
  }
  // fixes/216k Â§3 (106 T-13 / F-10): the production shortfall caller â€” a P6
  // apply whose declared lattice jobs outnumber the materialised spec-graph
  // job nodes persists the counted `p6.jobs.shortfall` warn row.
  // p6JobsShortfallLog is pure and returns null when declared â‰¤ materialised;
  // only a non-null row is appended, so a zero-shortfall apply returns the
  // SAME logs array untouched (byte-identity), and a re-apply never logs the
  // identical row twice (stale-read guard).
  if (phase === 6) {
    const shortfall = p6JobsShortfallLog(merged);
    if (
      shortfall &&
      !merged.logs.some((l) => l.event === shortfall.event && l.detail === shortfall.detail)
    ) {
      sealLogs.push(shortfall);
    }
  }
  const packed = attachAlgorithms({
    ...merged,
    logs: sealLogs.length > 0 ? [...merged.logs, ...sealLogs].slice(-200) : merged.logs,
  });
  // Item 2: a COMPLETE stage that produced nothing is a coded failure, never a
  // silent pass. The pure stage-wiring census (phases.ts) runs over the
  // just-applied record and its coded reason for THIS phase alone is written to
  // the ledger (the flow-forward reason belongs to the previous phase). Inert
  // on a healthy phase â€” every deterministic producer writes a non-empty
  // deliverable of its declared kind â€” and stale-read guarded, so a re-apply
  // never duplicates the row.
  const wired = needsHitl
    ? packed
    : (() => {
        const rows = stageWiringLogRows(packed, phase);
        return rows.length > 0 ? { ...packed, logs: [...(packed.logs ?? []), ...rows].slice(-200) } : packed;
      })();
  // fixes/144 (M2 lane B4): when this P6 apply carries a multi-file
  // generatedTree (keyed synthesis landed on an earlier attempt and a repair /
  // re-apply is re-running the phase), stamp the p6-arch reqTrace artifact +
  // log so the recorded gate and packet surface the capabilityâ†’file mapping.
  // Tree-absent applies (deterministic/keyless floor, refused keyed synthesis)
  // are returned byte-identical â€” the p6-arch legacy note never touches them.
  return sealPacketArtifact(phase === 6 ? stampP6ReqTrace(wired) : wired);
}

/**
 * A4-E2(c) / A4-E3 (Decision D2(c)): the ONE honest terminal status. A record's
 * `status` becomes `complete` as soon as P12 synthesizes â€” BEFORE its gate runs
 * â€” so a red-gate seal otherwise reads as a clean completion. This derives the
 * honest value from the recorded gates: `complete_with_failures` when the seal
 * is dirty (`failedGates()` non-empty), the record's own status otherwise.
 * Callers (headless `summary`, the run boundary) must render THIS, never a bare
 * green chip.
 */
export function terminalStatusOf(project: Project): Project["status"] | "complete_with_failures" {
  if (project.status !== "complete") return project.status;
  return failedGates(project).length > 0 ? "complete_with_failures" : "complete";
}

/**
 * A4-E9 (P2): mark ONE phase record as having DEGRADED to the deterministic
 * floor â€” the live/keyed pass threw and the floor stood in for it. The coded
 * `p<phase>.live.failed` / `p6.live.synthesis.failed` / `llm.degrade` row
 * already names the failure; this stamps the PHASE RECORD so a reader can never
 * mistake the resulting `complete` for a genuine keyed completion. Additive: the
 * extra optional property is declared on `PhaseRecord` once the shared type
 * carries it, and a legacy record without the marker reads byte-identically.
 */
export function markPhaseDegraded(project: Project, phase: PhaseId): Project {
  const phases = project.phases.map((r) => (r.id === phase ? { ...r, degraded: true } : r));
  return { ...project, phases };
}

/**
 * Item 2: the coded ledger rows for one phase's stage-wiring failures â€” a
 * COMPLETE phase with no deliverable, only empty-bodied deliverables, or no
 * artifact of its declared kind (phases.ts `PHASE_DELIVERABLE_KINDS`). Pure,
 * exported for a direct pin; `[]` when the phase is wired (or not complete), so
 * a healthy apply's bytes are unchanged. Idempotent: a row whose event+detail
 * is already on the record is not re-appended.
 */
export function stageWiringLogRows(project: Project, phase: PhaseId): JsonLog[] {
  const row = stageWiringReading(project).rows.find((r) => r.phase === phase);
  if (!row || row.reasons.length === 0) return [];
  const logs = project.logs ?? [];
  const out: JsonLog[] = [];
  for (const r of row.reasons) {
    const event = `p${phase}.stage.unwired`;
    const detail = `${r.code} Â· ${r.reason}`;
    if (logs.some((l) => l.event === event && l.detail === detail)) continue;
    if (out.some((l) => l.event === event && l.detail === detail)) continue;
    out.push({ ts: Date.now(), phase, level: "warn", event, detail });
  }
  return out;
}

/**
 * fixes/144 (M2, lane B4): stamp the p6-arch reqTrace onto a project whose P6
 * apply produced (or carried) a multi-file generatedTree â€” one phase-6 docs
 * artifact ("P6 architecture trace (reqTrace)") listing every capability â†’
 * file mapping (plus the missing capabilities / template-stub files when the
 * probe fails) and a `dod.reqtrace` log line. Idempotent: a re-stamp replaces
 * the prior reqTrace artifact by title, never duplicates. Tree-absent projects
 * (deterministic/keyless floor, refused keyed synthesis on the single-module
 * floor) are returned UNCHANGED â€” the same reference â€” because p6-arch passes
 * those vacuously with the "single-module (legacy path)" note and the keyless
 * floor must stay byte-identical.
 */
export function stampP6ReqTrace(project: Project): Project {
  const t = archTrace(project);
  if (!t.present) return project;
  const pass = t.missing.length === 0 && t.stubFiles.length === 0;
  const title = "P6 architecture trace (reqTrace)";
  const body = [
    `# ${title}`,
    ``,
    `**p6-arch: ${pass ? "PASS" : "FAIL"}** Â· ${t.note}`,
    ``,
    ...(t.rows.length > 0
      ? t.rows.map((r) => `- ${r.capability} â†’ ${r.files.join(", ")}`)
      : ["- (no identifier-bearing capabilities demanded by the spec/lattice)"]),
    ...(t.missing.length > 0
      ? [
          ``,
          "Missing capabilities (no tree file carries their identifiers):",
          ...t.missing.map((m) => `- ${m}`),
        ]
      : []),
    ...(t.stubFiles.length > 0
      ? [
          ``,
          "Template-stub files (byte-identical to the deterministic floor):",
          ...t.stubFiles.map((f) => `- ${f}`),
        ]
      : []),
    ``,
    "> reqTrace: capability â†’ tree file(s), computed by p6-arch over generatedTree code identifiers (stemmed; literals/comments masked).",
  ].join("\n");
  const artifact = art(6, "docs", title, body, "markdown");
  const detail =
    `p6-arch ${pass ? "PASS" : "FAIL"} Â· ${t.note}` +
    (t.missing.length > 0 ? ` Â· missing: ${t.missing.join(", ")}` : "") +
    (t.stubFiles.length > 0 ? ` Â· template stubs: ${t.stubFiles.join(", ")}` : "");
  const logs = project.logs ?? [];
  const last = logs[logs.length - 1];
  // Idempotent re-stamp: an identical tail dod.reqtrace row (same phase +
  // detail) is NOT appended twice â€” applyPhaseResult and liveLayer both stamp
  // a tree-carrying P6 re-apply.
  const dupLog = last && last.event === "dod.reqtrace" && last.phase === 6 && last.detail === detail;
  const reqLog: JsonLog = {
    ts: Date.now(),
    phase: 6,
    level: pass ? "info" : "warn",
    event: "dod.reqtrace",
    detail,
  };
  return {
    ...project,
    artifacts: [
      ...(project.artifacts ?? []).filter((a) => !(a.phase === 6 && a.title === title)),
      artifact,
    ],
    logs: dupLog ? logs : [...logs, reqLog].slice(-200),
  };
}

/**
 * Set PhaseRecord.gate for a just-completed phase (ST-1) without emitting the
 * gate artifact or a `gate.verdict` log â€” the store's recordGate re-runs
 * idempotently afterward and owns those side effects. Used by approveHitl so the
 * packet compiled on approval already carries a non-null `gate_passed`.
 */
function recordGateInline(project: Project, phase: PhaseId): Project {
  const rec = project.phases.find((p) => p.id === phase);
  if (!rec || rec.status !== "complete") return project;
  const r = runGate(project, phase);
  const unmet = r.unmet.map((g) => g.criterion);
  return {
    ...project,
    phases: project.phases.map((p) =>
      p.id === phase
        ? {
            ...p,
            gate: {
              passed: r.pass,
              unmet,
              evidenceHash: r.evidenceHash,
              checkedAt: Date.now(),
            },
          }
        : p,
    ),
  };
}

export function approveHitl(
  project: Project,
  opts: {
    decidedBy: HitlDecision["decidedBy"];
    note?: string;
    /** Explicit override of a forceHuman gate (failed P6 sandbox) â€” R3/B-03. */
    force?: boolean;
    requestedAt?: number;
    /**
     * C1 (312) â€” optional ledger PROVENANCE for the minted row (types.ts
     * `HitlDecision.decidedVia`). The wild agent-seal path stamps the allowing
     * decision here (action/resource/reason + seat label + token path) so the
     * row names the approver machine-readably: `decidedBy` stays the truthful
     * machine actor ("autopilot"), `decidedVia.label` names the seal seat
     * (autopilot/agent-seal), and `dod.ts` cross-checks the pair when tagged.
     * Absent â‡’ the row is byte-identical to the pre-312 shape.
     */
    decidedVia?: HitlDecision["decidedVia"];
  },
): Project {
  const phase = project.currentPhase;
  const decidedBy = opts.decidedBy;
  if (decidedBy !== "human" && decidedBy !== "autopilot") {
    const err = new Error("approveHitl requires explicit decidedBy (never default human)") as Error & {
      code?: string;
    };
    err.code = "RT_E_VALIDATION";
    throw err;
  }
  // CORE-01 (defensive): refuse to approve without a pending gate, or when the
  // pending gate does not match the current edge â€” return the project untouched
  // (ledger stays clean) rather than fabricate a transition.
  if (!project.hitl || project.hitl.phase !== phase) return project;
  // CORE-01 (defensive): a human-only gate (failed P6 sandbox / reframe) may
  // never be autopilot-approved unless the caller passed an explicit `force`.
  if (project.hitl.forceHuman && decidedBy === "autopilot" && !opts?.force) {
    const err = new Error("Autopilot may not approve a forceHuman gate (R3/B-03).") as Error & {
      code?: string;
    };
    err.code = "RT_E_VALIDATION";
    throw err;
  }
  const now = Date.now();
  // A1-30 residue (fixes/296 Q1): the transition bound comes from the graph authority
  // (phases.ts PHASE_LAST) â€” never a bare 12 (behavior-identical: PHASE_LAST = 12).
  const next = Math.min(PHASE_LAST, phase + 1) as PhaseId;
  const phases = project.phases.map((p) => {
    if (p.id === phase) return { ...p, status: "complete" as const, completedAt: now };
    if (p.id === next && phase < PHASE_LAST) return { ...p, status: "ready" as const };
    return p;
  });
  const forcedOverride =
    Boolean(opts?.force) && phase === 6 && project.lastTest !== null && !project.lastTest.ok;
  // DF-09 (W23 L6 Â· 249 SPEC 1): an override of a FAILED gate is
  // indistinguishable from a rubber stamp unless the caller states WHY. The
  // caller-supplied rationale floor mirrors rejectHitl's â‰¥12-char minimum
  // below; the code is RT_E_VALIDATION so a CLI/engine caller classifies a
  // coded refusal (exit 1) â€” never a bare RT_E_INTERNAL. Autopilot is exempt:
  // its self-approval carries its own note and can never mint a forced
  // override (R3/B-03 above keeps a forceHuman gate human-only).
  if (forcedOverride && decidedBy === "human" && (opts?.note ?? "").trim().length < 12) {
    const err = new Error(
      `Approving a FAILED P${phase} gate with force requires a rationale â€” at least 12 characters of note ("why is the red gate being overridden?").`,
    ) as Error & { code?: string };
    err.code = "RT_E_VALIDATION";
    throw err;
  }
  const decision: HitlDecision = {
    id: `hitl-${phase}-${now}`,
    phase,
    title: project.hitl.title,
    decision: "approve",
    note: opts?.note,
    decidedBy,
    requestedAt: opts?.requestedAt ?? project.hitl.requestedAt ?? now,
    decidedAt: now,
    // 315 V1 (C1's owed one-liner): the seal's provenance actually reaches the
    // ledger row â€” `decidedVia` was accepted but never stored, so every sealed
    // approval minted a row without its seat label. Absent â‡’ byte-identical.
    ...(opts?.decidedVia ? { decidedVia: opts.decidedVia } : {}),
  };
  const decisions = [...project.decisions, decision].slice(-100);
  const overrideLogs: JsonLog[] = forcedOverride
    ? [
        {
          ts: now,
          phase,
          level: "warn" as const,
          event: "hitl.approved_override",
          detail: project.lastTest?.detail ?? "failing sandbox output overridden",
        },
      ]
    : [];
  const overrideMemory: MemoryEntry[] = forcedOverride
    ? [
        {
          id: `override-${phase}-${now}`,
          kind: "episodic",
          phase,
          text: `Human overrode failing sandbox at P6: ${(project.lastTest?.detail ?? "").slice(0, 80)}`,
          score: 0.4,
          // E-18: a human decision row, never an engine template row.
          source: "human",
        },
      ]
    : [];
  const base: Project = {
    ...project,
    phases,
    hitl: null,
    status: phase === PHASE_LAST ? "complete" : "running",
    currentPhase: phase === PHASE_LAST ? PHASE_LAST : next,
    decisions,
    logs: [
      ...project.logs,
      ...overrideLogs,
      {
        ts: now,
        phase,
        level: "info" as const,
        event: "hitl.approved",
        detail: phaseDef(phase).title,
      },
    ].slice(-200),
    memory: dedupeMemoryIds([...overrideMemory, ...project.memory]).slice(0, 80),
  };
  // ST-1: record the DoD gate for the phase JUST approved BEFORE the packet is
  // compiled, so the machine-readable ## System JSON `gate_passed` is populated
  // (never null) the instant approval lands. The store's recordGate re-runs
  // idempotently afterward and owns the gate artifact + log.
  const withGate = recordGateInline(base, phase);
  return sealPacketArtifact(attachAlgorithms(withGate));
}

export function rejectHitl(
  project: Project,
  note: string,
  /**
   * 322 X1 (F-1): explicit actor seat for the reject row. The pre-fix path
   * hardcoded `decidedBy: "human"`, so every machine caller (the CLI reject
   * verb) minted a human actor for a machine decision. Absent â‡’ the legacy
   * human stamp â€” the console store path IS the human seat and keeps its
   * byte-identical rows; headless/CLI machine paths pass the explicit seat.
   */
  opts?: { decidedBy?: HitlDecision["decidedBy"] },
): Project {
  const phase = project.currentPhase;
  // CORE-01/CORE-02 (defensive): the append-only ledger must never record a
  // fabricated rejection â€” require a pending gate on the current edge and the
  // documented â‰¥12-char qualitative-feedback minimum before writing a row.
  const trimmed = note.trim();
  if (trimmed.length < 12) {
    const err = new Error("Rejection requires at least 12 characters of qualitative feedback.") as Error & {
      code?: string;
    };
    err.code = "RT_E_VALIDATION";
    throw err;
  }
  if (!project.hitl || project.hitl.phase !== phase) return project;
  const now = Date.now();
  const rec = project.phases.find((p) => p.id === phase);
  const history = [...(rec?.rejectionHistory ?? []), { note, at: now }];
  const phases = project.phases.map((p) =>
    p.id === phase
      ? { ...p, status: "rejected" as const, rejectionNote: note, rejectionHistory: history }
      : p,
  );
  const decision: HitlDecision = {
    id: `hitl-${phase}-${now}`,
    phase,
    title: project.hitl?.title ?? phaseDef(phase).title,
    decision: "reject",
    note,
    decidedBy: opts?.decidedBy ?? "human",
    requestedAt: project.hitl?.requestedAt ?? now,
    decidedAt: now,
  };
  return {
    ...project,
    phases,
    hitl: null,
    status: "blocked",
    decisions: [...project.decisions, decision].slice(-100),
    logs: [
      ...project.logs,
      {
        ts: now,
        phase,
        level: "warn" as const,
        event: "hitl.rejected",
        detail: note,
      },
    ].slice(-200),
    memory: dedupeMemoryIds([
      {
        id: `reject-${phase}-${now}`,
        kind: "episodic",
        phase,
        text: `HITL rejected P${phase}: ${note}`,
        score: 1,
        // E-18: a human decision row, never an engine template row.
        source: "human",
      },
      // W62 Â· C1-07-class remediation: wire the L5 correction builder â€” it had
      // no production caller. A HUMAN reject records a content-addressed
      // correction lesson that the next regeneration reads back
      // (`lessonSteeringBlock`), so the learning loop can change the next run.
      // A machine reject never mints here: `correctionLesson` stamps
      // source:"human" by contract, and a machine may not claim a human seat.
      ...(decision.decidedBy === "human" && lessonSurface
        ? [lessonSurface.correctionLesson(project, decision)]
        : []),
      ...project.memory,
    ]).slice(0, 80),
  };
}

export function unlockRetry(project: Project): Project {
  const phase = project.currentPhase;
  const rec = project.phases.find((p) => p.id === phase);
  // CORE-01 (defensive): only a REJECTED phase on a BLOCKED project may be
  // re-opened. Unlocking any other state would silently clear a parked gate
  // (failed-P6 forceHuman review, reframe) or fabricate a retry the append-only
  // ledger never recorded â€” return the project untouched instead.
  if (!rec || rec.status !== "rejected" || project.status !== "blocked") return project;
  const phases = project.phases.map((p) =>
    p.id === phase ? { ...p, status: "ready" as const } : p,
  );
  return { ...project, phases, status: "running", hitl: null };
}

/**
 * fixes/132 (C2): the create-time "is DeepSeek configured" probe for the
 * enforceDod default. Client-safe (typeof-guarded â€” browsers/SSR without
 * `process` read false), mirrors deepseek.server.ts isDeepSeekConfigured's
 * trim semantics, and stays a plain env read so emptyProject remains sync.
 * Keyed runs (an API key is present in THIS process) default to hard DoD
 * enforcement; keyless/deterministic runs stay advisory (false).
 */
function keyedDeepSeekConfigured(): boolean {
  if (typeof process === "undefined") return false;
  const env = process.env;
  if (typeof env !== "object" || env === null) return false;
  const v = env.DEEPSEEK_API_KEY;
  return typeof v === "string" && v.trim().length > 0;
}

export function emptyProject(input: {
  name: string;
  brief: string;
  /** Explicit create-time override (CLI --advisory sends false). Undefined â†’ keyed default. */
  enforceDod?: boolean;
  /** Delivery-kind (342-4: the 5-way DeliveryKind). Declared kind wins at codegen
   *  tree-trigger time; absent â†’ singleModuleLibraryKind() routes to the â‰¤8 library path. */
  kind?: Project["kind"];
}): Project {
  const domain = inferDomain(input.brief);
  const base: Project = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `p-${Date.now()}`,
    name: input.name || inferName(input.brief),
    brief: input.brief.trim(),
    domain,
    createdAt: Date.now(),
    status: "intake",
    currentPhase: 0,
    ...(input.kind ? { kind: input.kind } : {}),
    // M7-01 (fixes/310): stamp the hydrate defaults at the ONE place phase
    // rows are created (repairPhases normalizes them at import with
    // `?? []`/`?? null` â€” engine.ts:1979). Without birth stamps a project
    // that never carried them drifted on its FIRST exportâ†’importâ†’export hop
    // (13Ã— rejectionHistory + 9Ã— gate keys ADDED). Persisted bytes now equal
    // re-serialized bytes on the first pass.
    phases: PHASES.map((p) => ({
      id: p.id,
      status: p.id === 0 ? "ready" : "locked",
      rejectionHistory: [],
      gate: null,
    })),
    scorecard: null,
    competitors: [],
    artifacts: [],
    memory: [],
    logs: [
      {
        ts: Date.now(),
        phase: 0,
        level: "info",
        event: "project.created",
        detail: domain,
      },
    ],
    hitl: null,
    decisions: [],
    // E-14: deterministic until a real LLM call succeeds â€” liveLayer stamps the
    // actual route (deepseek-flash / deepseek-pro) the moment one runs, and
    // hydrateProject maps legacy "grok-4.5"|"local-edge"|"failover" payloads to
    // "deterministic" unless a logs entry shows an LLM call. Never claim a
    // model that was not used.
    modelRoute: "deterministic",
    sandbox: {
      // Honest default: generated code runs through the bounded engine-template runner today (B-18);
      // runtime:"worker" is reserved for the real Worker sandbox (R1) once producers need it.
      // 213: isolated defaults false â€” node-runner is NOT Docker/bwrap (doctor.runnerIsSandbox:false).
      runtime: "sync-template",
      ramMb: null,
      timeoutS: 30,
      isolated: false,
    },
    openapi: "",
    adr: "",
    lattice: null,
    schedule: null,
    traces: [],
    packet: "",
    specGraph: null,
    contracts: null,
    oracle: [],
    crew: [],
    notes: "",
    generatedSource: "",
    lastTest: null,
    // P10/P13 honest defaults: hard-DoD enforcement defaults ON for keyed
    // runs (fixes/132 â€” a configured LLM may not silently leave failing
    // gates) and OFF for keyless/deterministic runs; an explicit
    // input.enforceDod (CLI --advisory sends false) always wins. Wild Mode
    // stays OFF on every fresh project; wildRun is null until a run starts.
    enforceDod:
      typeof input.enforceDod === "boolean" ? input.enforceDod : keyedDeepSeekConfigured(),
    wildMode: false,
    wildRun: null,
    // P0-2: persisted copilot thread starts empty (store appendChatRows caps it
    // at 40 rows; the ChatPane renders â‰¤12 and the model sees â‰¤6 turns).
    chatLog: [],
    // M7-01 (fixes/310): same birth-stamp rule as the phase rows above â€” the
    // hydrate normalizers (engine.ts research/implementationSpec) default these
    // at import, so a project created without them drifted by two top-level
    // keys on its first exportâ†’importâ†’export hop. Stamp at creation.
    research: [],
    implementationSpec: null,
    _v: 2,
  };
  const ready = attachAlgorithms(base);
  // R4/B-05: memory first, packet second â€” a fresh packet must list the bootstrap rows.
  ready.memory = bootstrapMemory(ready.lattice!);
  ready.packet = compileAgentPacket(ready);
  const a4 = ready.traces.find((t) => t.id === "A4");
  if (a4) a4.ranAt = Date.now();
  // CORE-05: A2's summary was baked by attachAlgorithms BEFORE the bootstrap
  // rows were attached ("ranked 0 memory rows") while the packet that actually
  // shipped ranked them. Patch summary + ranAt so the trace matches the packet.
  const a2 = ready.traces.find((t) => t.id === "A2");
  if (a2) {
    a2.summary = `ranked ${ready.memory.length} memory rows for the packet`;
    a2.ranAt = Date.now();
  }
  return ready;
}

/**
 * Per-id phase repair (B-14/B-25/R9): keeps every record with a known id (first wins),
 * drops unknown/duplicate ids, inserts missing phases â€” history is never wholesale-reset.
 */
export function repairPhases(raw: PhaseRecord[] | undefined): {
  phases: PhaseRecord[];
  repaired: boolean;
  dropped: PhaseId[];
  inserted: PhaseId[];
} {
  const dropped: PhaseId[] = [];
  const inserted: PhaseId[] = [];
  const seen = new Set<PhaseId>();
  const kept: PhaseRecord[] = [];
  for (const r of raw ?? []) {
    if (!r || typeof r.id !== "number" || !PHASE_BY_ID.has(r.id as PhaseId)) {
      if (r && typeof r.id === "number") dropped.push(r.id as PhaseId);
      continue;
    }
    const id = r.id as PhaseId;
    if (seen.has(id)) {
      dropped.push(id);
      continue;
    }
    // A16: a garbage status string is corrupt â€” drop it and let the insert loop
    // re-add a sane default (0 â†’ ready, else locked), loudly.
    if (typeof r.status !== "string" || !PHASE_STATUSES.has(r.status)) {
      dropped.push(id);
      continue;
    }
    seen.add(id);
    kept.push({ ...r, rejectionHistory: r.rejectionHistory ?? [], gate: r.gate ?? null });
  }
  for (const def of PHASES) {
    if (!seen.has(def.id)) {
      // M7-01 parity: a bare {id,status} insert missed the hydrate birth-stamps
      // every kept record gets below, so the FIRST exportâ†’importâ†’export hop
      // ADDED rejectionHistory/gate on the repaired payload (byte drift). Stamp
      // the same defaults here so a repaired insert is already normalized.
      kept.push({
        id: def.id,
        status: def.id === 0 ? "ready" : "locked",
        rejectionHistory: [],
        gate: null,
      });
      inserted.push(def.id);
    }
  }
  kept.sort((a, b) => a.id - b.id);
  const repaired = dropped.length > 0 || inserted.length > 0 || (raw ?? []).length !== kept.length;
  return { phases: kept, repaired, dropped, inserted };
}

/**
 * E-14 route honesty: map a persisted modelRoute onto the live ModelRoute
 * union. Known current values pass through; the retired pre-DeepSeek labels
 * ("grok-4.5" | "local-edge" | "failover" â€” a target architecture that was
 * never implemented) collapse to "deterministic", or to "deepseek-flash" when
 * a logs entry shows a real LLM call actually happened. Unknown/garbage â†’
 * "deterministic" (never claim a model that was not used).
 */
function hydrateModelRoute(value: unknown, logs?: JsonLog[]): ModelRoute {
  const MODEL_ROUTES: ReadonlySet<string> = new Set([
    "deepseek-flash",
    "deepseek-pro",
    "deterministic",
    "none",
  ]);
  if (typeof value === "string" && MODEL_ROUTES.has(value)) return value as ModelRoute;
  if (value === "grok-4.5" || value === "local-edge" || value === "failover") {
    const llmEvidence = (logs ?? []).some((l) =>
      /deepseek|llm\.|narrative|model\.complete/i.test(`${l.event ?? ""} ${l.detail ?? ""}`),
    );
    return llmEvidence ? "deepseek-flash" : "deterministic";
  }
  return "deterministic";
}

/** Minimal-shape guards for the hydrate repair pass (CORE sweep): a payload
 *  that passes the container checks (arrays exist, 13 phases) can still carry
 *  rows or fields no engine write could ever have produced â€” hand-edited
 *  imports, truncated persisted state, or a legacy schema slice. Rows are
 *  per-row filtered (the A15 memory-kind precedent) so packet compilation,
 *  handoff prompts and gate probes see only well-formed content; junk is
 *  dropped loudly via the hydrate.repaired log, never left to crash a
 *  downstream consumer (compileAgentPacket reads a.body.length / d.decidedAt,
 *  fusionRank tokenizes m.text, phaseHandoff renders schedule.extraHitl). */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function wellFormedArtifactRow(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  const a = v as { phase?: unknown; kind?: unknown; title?: unknown; body?: unknown };
  return (
    typeof a.phase === "number" &&
    typeof a.kind === "string" &&
    typeof a.title === "string" &&
    typeof a.body === "string"
  );
}

function wellFormedDecisionRow(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  const d = v as {
    phase?: unknown;
    decidedBy?: unknown;
    decision?: unknown;
    note?: unknown;
    decidedAt?: unknown;
  };
  return (
    typeof d.phase === "number" &&
    typeof d.decidedBy === "string" &&
    typeof d.decision === "string" &&
    typeof d.decidedAt === "number" &&
    (d.note === null || d.note === undefined || typeof d.note === "string")
  );
}

function usableLattice(v: unknown): v is IntentLattice {
  if (!isPlainObject(v)) return false;
  const l = v as { jobs?: unknown; entities?: unknown; constraints?: unknown; complexity?: unknown };
  return (
    Array.isArray(l.jobs) &&
    Array.isArray(l.entities) &&
    Array.isArray(l.constraints) &&
    typeof l.complexity === "number"
  );
}

function usableSchedule(v: unknown): v is SchedulerPlan {
  if (!isPlainObject(v)) return false;
  const s = v as {
    tightness?: unknown;
    securityDelta?: unknown;
    apiDelta?: unknown;
    extraHitl?: unknown;
    notes?: unknown;
  };
  return (
    typeof s.tightness === "number" &&
    typeof s.securityDelta === "number" &&
    typeof s.apiDelta === "number" &&
    Array.isArray(s.extraHitl) &&
    Array.isArray(s.notes)
  );
}

// 308 B-01 (B2) â€” runtime accept-lists for the two records the hydrate rebuild
// used to erase (`park` / `lastStep`). types.ts erases the unions, so the
// structural guards below mirror them by value.
//
// 325 A1: the park-unlock mirror used to be a hand-maintained array that read
// `["configure-key","human-gate","human-retry","resume","operator"]` â€” 313 D1
// added "agent-seal" to `WildParkUnlock` (types.ts:152) but not here, so
// `usableWildPark` rejected every persisted SEALED park: hydrateWildRun kept
// `pause:true` and dropped `park` (and, via the summary guard below, the whole
// `lastStep` carrying it). The accept-set is now DERIVED from WILD_UNLOCK_TEXT
// â€” the ONE `Record<WildParkUnlock, string>` map further down this module,
// which is compile-time-exhaustive: a new union member fails typecheck there
// until its text exists, and this guard then accepts it automatically. A lazy
// read inside the predicate (never a module-init read) keeps declaration order
// irrelevant.
function acceptedParkUnlock(unlock: string): boolean {
  return Object.keys(WILD_UNLOCK_TEXT).includes(unlock);
}
const WILD_STEP_OUTCOMES: readonly string[] = ["advanced", "completed", "paused"];
const WILD_STEP_ACTIONS: readonly string[] = ["execute", "gate", "advance", "finalize", "park"];
const WILD_NEXT_ACTIONS: readonly string[] = ["execute", "gate", "advance", "finalize", "park", "none"];

/** 308 B-01 (B2): structural guard for a persisted `WildParkInfo`. Carrying
 *  the record back through hydrate must not let a hand-edited payload crash
 *  the B7 stream, so it is accepted only when every render-bearing field is
 *  the right primitive â€” and then kept VERBATIM (same object) so saveâ†’load
 *  round-trips the identical record. */
function usableWildPark(v: unknown): WildParkInfo | null {
  if (!isPlainObject(v)) return null;
  const p = v as Record<string, unknown>;
  const unlock = p.unlock;
  const resumeAction = p.resumeAction;
  const ok =
    (p.code === null || typeof p.code === "string") &&
    (p.event === null || typeof p.event === "string") &&
    typeof p.reason === "string" &&
    typeof unlock === "string" &&
    acceptedParkUnlock(unlock) &&
    typeof p.unlockText === "string" &&
    typeof p.resumePhase === "number" &&
    typeof resumeAction === "string" &&
    WILD_NEXT_ACTIONS.includes(resumeAction) &&
    typeof p.at === "number";
  return ok ? (v as WildParkInfo) : null;
}

/** 308 B-01 (B2): the same contract for `WildStepSummary` (the `lastStep`
 *  mirror; its own optional `park` must itself be shaped right). */
function usableWildStepSummary(v: unknown): WildStepSummary | null {
  if (!isPlainObject(v)) return null;
  const s = v as Record<string, unknown>;
  const outcome = s.outcome;
  const action = s.action;
  const nextAction = s.nextAction;
  const ok =
    typeof outcome === "string" &&
    WILD_STEP_OUTCOMES.includes(outcome) &&
    typeof action === "string" &&
    WILD_STEP_ACTIONS.includes(action) &&
    typeof s.phase === "number" &&
    (s.completedPhase === null || typeof s.completedPhase === "number") &&
    (s.advancedTo === null || typeof s.advancedTo === "number") &&
    typeof s.artifacts === "number" &&
    typeof s.nextPhase === "number" &&
    typeof nextAction === "string" &&
    WILD_NEXT_ACTIONS.includes(nextAction) &&
    (s.park === undefined || s.park === null || usableWildPark(s.park) !== null);
  return ok ? (v as WildStepSummary) : null;
}

/**
 * P13 wildRun hydration. Legacy/absent â†’ null. A persisted ACTIVE run is
 * stopped on hydrate: the driver loop is a session artifact and dies with the
 * page, so an active surface would be a lie after reload â€” active runs become
 * `{ active:false, pause:false, stoppedAt }` (+ a wild.stop log by the caller).
 * Scalar fields are coerced defensively so hand-edited payloads cannot crash
 * the B7 stream.
 */
function hydrateWildRun(
  v: unknown,
  currentPhase: PhaseId,
  preserveActive = false,
): { wildRun: Project["wildRun"]; stopped: boolean } {
  if (!isPlainObject(v)) return { wildRun: null, stopped: false };
  const w = v as Record<string, unknown>;
  const intOr = (x: unknown, fallback: number): number =>
    typeof x === "number" && Number.isInteger(x) ? x : fallback;
  const numOrNull = (x: unknown): number | null => (typeof x === "number" ? x : null);
  // A1-30: clamp to the graph's last phase via the shared constant, not a bare 12.
  const phase = Math.min(PHASE_LAST, Math.max(0, intOr(w.phase, currentPhase)));
  const run: NonNullable<Project["wildRun"]> = {
    active: w.active === true,
    phase,
    startedAt: numOrNull(w.startedAt),
    lastAutoLog: typeof w.lastAutoLog === "string" ? w.lastAutoLog : "",
    lastAutoAt: numOrNull(w.lastAutoAt),
    stoppedAt: numOrNull(w.stoppedAt),
    pause: w.pause === true,
  };
  // 308 B-01 (B2): the 306-F5 records are CARRIED through the rebuild instead
  // of being dropped â€” the tracer: `wild --resume` ERASED `park` + `lastStep`.
  // Both are kept only when shaped right (guards above) and `park` honours its
  // "present iff pause" invariant: a stale park on a non-paused run is dropped,
  // never resurrected. Valid records ride VERBATIM so saveâ†’load keeps them
  // byte-identical.
  const park = run.pause ? usableWildPark(w.park) : null;
  if (park) run.park = park;
  const lastStep = usableWildStepSummary(w.lastStep);
  if (lastStep) run.lastStep = lastStep;
  if (!run.active) return { wildRun: run, stopped: false };
  // 174-3: CLI pause/resume/step must keep a persisted active run (the driver
  // is the CLI process). Browser hydrate still force-stops (session died).
  if (preserveActive) return { wildRun: run, stopped: false };
  // Session-break honesty: a live run cannot outlive the driver that drove it.
  return {
    wildRun: {
      ...run,
      active: false,
      pause: false,
      // 308 B-01 (B2): park is present iff pause â€” the forced stop clears it
      // explicitly instead of leaking a stale record into the stopped surface.
      park: null,
      stoppedAt: run.stoppedAt ?? Date.now(),
    },
    stopped: true,
  };
}

/** A1-22: structural guards for specGraph/contracts, mirroring io's import
 *  boundary (io.sanitizeImportPayload). The PERSIST path (localStorage â†’
 *  hydrateProject) never passes through io: a stored `{order: 5}` used to pass
 *  the plain-object guard here and then make compileAgentPacket's `.map()`
 *  throw â€” the store answers that throw with recoverFromCorruptPersistence
 *  (a whole-workspace re-seed). Structurally-broken values are nulled and the
 *  caller reports the repair (shapeRepaired â†’ anyRepaired â†’ re-stamp). */
function usableSpecGraph(v: unknown): Project["specGraph"] {
  if (!isPlainObject(v)) return null;
  if (!Array.isArray(v.order) || !Array.isArray(v.nodes)) return null;
  const nodes = v.nodes.filter((n) => isPlainObject(n) && typeof n.id === "string");
  const order = v.order.filter((id) => typeof id === "string");
  return { ...v, nodes, order } as unknown as Project["specGraph"];
}

function usableContracts(v: unknown): Project["contracts"] {
  if (!isPlainObject(v)) return null;
  if (v.entities !== undefined && !Array.isArray(v.entities)) return null;
  if (v.endpoints !== undefined && !Array.isArray(v.endpoints)) return null;
  const entities = Array.isArray(v.entities)
    ? v.entities.filter(
        (e) => isPlainObject(e) && typeof e.name === "string" && Array.isArray(e.fields),
      )
    : [];
  const endpoints = Array.isArray(v.endpoints) ? v.endpoints.filter((e) => isPlainObject(e)) : [];
  return { ...v, entities, endpoints } as unknown as Project["contracts"];
}

export function hydrateProject(raw: Project, opts?: { preserveWildRun?: boolean }): Project {
  const phaseRepair = repairPhases(raw.phases);
  const legacy = raw.sandbox?.runtime;
  const runtime =
    legacy === "worker" || legacy === "sync-template" ? legacy : ("sync-template" as const);
  // CORE-03: validate the scalar currentPhase exactly like repairPhases validates
  // the phases array. A corrupt / out-of-range value would otherwise brick the
  // next stamp/approve via `PHASES[currentPhase]` indexing (packet.ts:69,
  // algorithms.ts:630). Repair to the highest complete phase + 1 (floor 0),
  // capped at PHASE_LAST â€” the graph authority, never a bare 12 (A1-30 residue).
  const cp = raw.currentPhase as number;
  const cpValid = Number.isInteger(cp) && cp >= 0 && cp <= PHASE_LAST;
  let currentPhase: PhaseId = cpValid ? (cp as PhaseId) : 0;
  const cpRepaired = !cpValid;
  if (!cpValid) {
    let highest = -1;
    for (const p of raw.phases ?? []) {
      if (p && typeof p.id === "number" && p.status === "complete" && p.id > highest) {
        highest = p.id;
      }
    }
    currentPhase = Math.max(0, Math.min(PHASE_LAST, highest + 1)) as PhaseId;
  }
  // SWEEP-2 (hyd-1): the current edge must never rest on a LOCKED phase record.
  // repairPhases re-inserts a phase whose persisted record was dropped (garbage
  // status, unknown id, duplicate) as `locked` â€” when THAT record was the
  // current edge, the payload hydrates "cleanly" and then strands forever:
  // advanceOnce refuses locked phases and no store action ever unlocks one.
  // A locked record at currentPhase is always corrupt (the engine only ever
  // advances into a phase it simultaneously marks ready), so repair it the
  // same way the scalar clamp above does: derive the true edge from the
  // highest sealed prior, and promote that edge's record to ready so the
  // graph can actually run (store.runReady/advanceTo parity).
  let edgeRepaired = false;
  const recAtEdge = phaseRepair.phases.find((r) => r.id === currentPhase);
  if (recAtEdge && recAtEdge.status === "locked") {
    edgeRepaired = true;
    // T0.5: highest CONTIGUOUS complete (not max id). A hole (P3 locked,
    // P4 complete) used to jump the edge past the gap â€” priorsSealed then
    // fails forever. Clamp to the first unsealed slot after a prefix of
    // completes.
    let highest = -1;
    for (let i = 0; i <= PHASE_LAST; i++) {
      const rec = phaseRepair.phases.find((r) => r.id === i);
      if (rec?.status === "complete") highest = i;
      else break;
    }
    currentPhase = Math.max(0, Math.min(PHASE_LAST, highest + 1)) as PhaseId;
    // Promote the derived edge only when its priors are genuinely sealed â€”
    // otherwise leave the honest locked state (the graph cannot run and says
    // so) instead of fabricating a runnable edge over an unsealed history.
    const derived = phaseRepair.phases.find((r) => r.id === currentPhase);
    if (derived?.status === "locked" && priorsSealed(phaseRepair.phases, currentPhase)) {
      phaseRepair.phases = phaseRepair.phases.map((r) =>
        r.id === currentPhase ? { ...r, status: "ready" as const } : r,
      );
    }
  }
  // T0.5 (fixes/162): hole-in-phases when the CURRENT edge is NOT locked
  // (e.g. P0â€“P2 complete, P3 missing/locked, P4 complete, currentPhase=4).
  // The locked-edge repair above does not fire; priorsSealed(4) is false and
  // no store action can advance. Clamp to highest contiguous sealed + 1.
  let holeRepaired = false;
  if (!priorsSealed(phaseRepair.phases, currentPhase)) {
    let highestContig = -1;
    for (let i = 0; i <= PHASE_LAST; i++) {
      const rec = phaseRepair.phases.find((r) => r.id === i);
      if (rec?.status === "complete") highestContig = i;
      else break;
    }
    const sealedEdge = Math.max(0, Math.min(PHASE_LAST, highestContig + 1)) as PhaseId;
    if (currentPhase !== sealedEdge) {
      holeRepaired = true;
      currentPhase = sealedEdge;
      const derived = phaseRepair.phases.find((r) => r.id === currentPhase);
      if (derived?.status === "locked" && priorsSealed(phaseRepair.phases, currentPhase)) {
        phaseRepair.phases = phaseRepair.phases.map((r) =>
          r.id === currentPhase ? { ...r, status: "ready" as const } : r,
        );
      }
    }
  }
  // CORE sweep (58_ready_core): scalar + per-row repair for payloads that pass
  // the container checks above but carry values no engine write could produce.
  // name/brief/domain coerce to string defaults so a truncated persisted state
  // can never crash the algorithm pass (intentLattice tokenizes brief/domain);
  // artifacts/decisions/memory rows are per-row filtered (A15 precedent) and
  // lattice/schedule are nulled for deterministic rebuild by attachAlgorithms
  // when structurally unusable â€” junk that would otherwise crash
  // compileAgentPacket (a.body.length / d.decidedAt / m.text tokenization),
  // phaseHandoff (schedule.extraHitl) or the hydrate log scan itself.
  const rawArtifacts = Array.isArray(raw.artifacts) ? raw.artifacts : [];
  const rawLogs = Array.isArray(raw.logs) ? raw.logs : [];
  const rawDecisions = Array.isArray(raw.decisions) ? raw.decisions : [];
  const rawMemory = Array.isArray(raw.memory) ? raw.memory : [];
  const artifacts = rawArtifacts.filter(wellFormedArtifactRow);
  const logs = rawLogs.filter((l) => isPlainObject(l));
  const decisions = rawDecisions.filter(wellFormedDecisionRow);
  const memory = rawMemory.filter(
    (m) =>
      m != null &&
      MEMORY_KINDS.has((m as MemoryEntry).kind) &&
      typeof (m as MemoryEntry).text === "string" &&
      typeof (m as MemoryEntry).score === "number",
  ) as MemoryEntry[];
  const lattice = usableLattice(raw.lattice) ? (raw.lattice as IntentLattice) : null;
  const schedule = usableSchedule(raw.schedule) ? (raw.schedule as SchedulerPlan) : null;
  const latticeRepaired = raw.lattice !== null && raw.lattice !== undefined && lattice === null;
  const scheduleRepaired =
    raw.schedule !== null && raw.schedule !== undefined && schedule === null;
  const name =
    typeof raw.name === "string" && raw.name.trim().length > 0 ? raw.name : "Untitled project";
  const brief = typeof raw.brief === "string" ? raw.brief : "";
  const domain = typeof raw.domain === "string" ? raw.domain : inferDomain(brief);
  // A1-28: type-junk in the sandbox scalars is coerced above (timeoutS /
  // isolated / ramMb) â€” a coercion is a REPAIR, so it is reported like
  // name/brief/domain instead of passing silently.
  const sandboxScalarsRepaired =
    (raw.sandbox?.timeoutS !== undefined &&
      !(typeof raw.sandbox.timeoutS === "number" && Number.isFinite(raw.sandbox.timeoutS))) ||
    (raw.sandbox?.isolated !== undefined && typeof raw.sandbox.isolated !== "boolean") ||
    (raw.sandbox?.ramMb !== undefined &&
      raw.sandbox.ramMb !== null &&
      typeof raw.sandbox.ramMb !== "number");
  const scalarRepaired =
    name !== raw.name || brief !== raw.brief || domain !== raw.domain || sandboxScalarsRepaired;
  const rowRepaired =
    rawArtifacts.length !== artifacts.length ||
    rawLogs.length !== logs.length ||
    rawDecisions.length !== decisions.length ||
    rawMemory.length !== memory.length ||
    latticeRepaired ||
    scheduleRepaired;

  // P10/P13: honest opt-in defaults (absent/legacy payloads stay OFF). A
  // persisted ACTIVE wild run is stopped here â€” the driver that drove it died
  // with the previous session, so an active surface would be a lie after reload
  // (hydrateWildRun returns `stopped` when it forced the run down).
  const hw = hydrateWildRun(raw.wildRun, currentPhase, opts?.preserveWildRun === true);

  // P0-2: additive chatLog read â€” legacy payloads lack the field entirely
  // (the ChatPane treats that as an empty thread); a present-but-non-array
  // value is garbage from a corrupt/hostile payload and is dropped loudly.
  const chatLog = Array.isArray(raw.chatLog) ? raw.chatLog : [];
  const chatLogRepaired =
    raw.chatLog !== undefined && raw.chatLog !== null && !Array.isArray(raw.chatLog);

  // H-03 (fixes/115): `research` rode the ...raw spread unvalidated â€” a corrupt
  // non-array value survived hydrate and threw inside compileAgentPacket's
  // researchSources/researchHash ((project.research ?? []).slice is not a
  // function), which the persist repair path does NOT try/catch per project â†’
  // ONE corrupt row wiped the whole store on reload. Normalize like siblings.
  // A1-01 (fixes/122): ALSO drop junk at the ITEM level â€” an entry whose items
  // contains null/non-objects survives the entry filter then throws inside
  // packet researchSources (it.title on null) â†’ whole-store wipe on reload.
  const research = Array.isArray(raw.research)
    ? raw.research
        .filter(
          (e) => e !== null && typeof e === "object" && Array.isArray((e as { items?: unknown }).items),
        )
        .map((e) => {
          const entry = e as { items?: unknown[] };
          const cleanItems = (entry.items ?? []).filter(
            (it) => it !== null && typeof it === "object" && typeof (it as { url?: unknown }).url === "string",
          );
          return (entry.items ?? []).length === cleanItems.length
            ? (entry as never)
            : ({ ...entry, items: cleanItems } as never);
        })
    : [];
  const researchRepaired =
    raw.research !== undefined &&
    raw.research !== null &&
    (!Array.isArray(raw.research) ||
      // An ENTRY-level drop (a non-object entry, or one whose `items`
      // is not an array) is a repair too â€” the old guard only looked at items
      // INSIDE a well-formed entry, so `research:[null]` / `[{items:5}]` were
      // dropped with NO hydrate.repaired row (silent data loss against the
      // "repairs are loud, never silent" contract).
      (raw.research as unknown[]).some(
        (e) =>
          e === null ||
          typeof e !== "object" ||
          !Array.isArray((e as { items?: unknown }).items) ||
          ((e as { items: unknown[] }).items).some(
            (it) => it === null || typeof it !== "object" || typeof (it as { url?: unknown }).url !== "string",
          ),
      ));
  // Same class: implementationSpec must be a plain object or null.
  const implementationSpec =
    raw.implementationSpec && typeof raw.implementationSpec === "object"
      ? (raw.implementationSpec as Project["implementationSpec"])
      : null;
  const implRepaired =
    raw.implementationSpec !== undefined && raw.implementationSpec !== null && !isPlainObject(raw.implementationSpec);

  // A1-02 (fixes/122): corrupt scorecard junk (axes:[null] / axes:5 / a string)
  // survives hydrate and throws inside packet compilation (reading 'label') â€”
  // same whole-store wipe vector as research. Shape-guard it: keep a
  // well-formed card, drop corrupt ones to null (null is a legal value).
  const rawScore = (raw as unknown as { scorecard?: unknown }).scorecard;
  const scorecardOk =
    isPlainObject(rawScore) &&
    typeof (rawScore as { overall?: unknown }).overall === "number" &&
    Array.isArray((rawScore as { axes?: unknown }).axes) &&
    (rawScore as { axes?: unknown[] }).axes!.every(
      (a) => a !== null && typeof a === "object" && typeof (a as { label?: unknown }).label === "string",
    ) &&
    Array.isArray((rawScore as { bottlenecks?: unknown }).bottlenecks) &&
    Array.isArray((rawScore as { attackVectors?: unknown }).attackVectors);
  const scorecard = scorecardOk ? (rawScore as Project["scorecard"]) : null;
  const scorecardRepaired =
    rawScore !== undefined && rawScore !== null && !scorecardOk;

  // fixes/144 (M2): generatedTree rides the spread unvalidated otherwise â€” a
  // corrupt non-array survives and throws in assembly/probes (same wipe
  // vector family as research/scorecard). Normalize: keep well-formed
  // {path,source,hash,attempt} entries, drop junk item-level, drop the whole
  // field when it is not an array (absent = legacy payload, legal).
  const rawTree = (raw as unknown as { generatedTree?: unknown }).generatedTree;
  const treeOk =
    rawTree === undefined ||
    rawTree === null ||
    (Array.isArray(rawTree) &&
      rawTree.every(
        (f) =>
          f !== null &&
          typeof f === "object" &&
          typeof (f as { path?: unknown }).path === "string" &&
          typeof (f as { source?: unknown }).source === "string" &&
          typeof (f as { hash?: unknown }).hash === "string",
      ));
  const generatedTree = treeOk
    ? (rawTree as Project["generatedTree"])
    : Array.isArray(rawTree)
      ? (rawTree as { path?: unknown; source?: unknown; hash?: unknown; attempt?: unknown }[])
          .filter(
            (f) =>
              f !== null &&
              typeof f === "object" &&
              typeof f.path === "string" &&
              typeof f.source === "string" &&
              typeof f.hash === "string",
          )
          .map((f) => {
            const extra: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(f as Record<string, unknown>)) {
              if (k === "path" || k === "source" || k === "hash" || k === "attempt") continue;
              extra[k] = v;
            }
            return {
              ...extra,
              path: f.path as string,
              source: f.source as string,
              hash: f.hash as string,
              attempt: typeof f.attempt === "number" ? (f.attempt as number) : 0,
            };
          }) as Project["generatedTree"]
      : undefined;
  const treeRepaired = rawTree !== undefined && rawTree !== null && !treeOk;

  const fxCoerce = coerceAcceptanceFixtures((raw as unknown as { acceptanceFixtures?: unknown }).acceptanceFixtures);
  let acceptanceFixtures = fxCoerce.value;
  const rawFxHash = (raw as unknown as { acceptanceBriefHash?: unknown }).acceptanceBriefHash;
  const acceptanceBriefHash =
    typeof rawFxHash === "string" && rawFxHash.trim().length > 0 ? rawFxHash.trim() : undefined;
  const rawFxAt = (raw as unknown as { acceptanceApprovedAt?: unknown }).acceptanceApprovedAt;
  let acceptanceApprovedAt =
    typeof rawFxAt === "number" && Number.isFinite(rawFxAt) ? rawFxAt : undefined;
  let fixturesStale = false;
  if (acceptanceFixtures && acceptanceBriefHash) {
    const liveHash = String(fnv1a(brief));
    if (acceptanceBriefHash !== liveHash && acceptanceFixtures.some((c) => c.approval === "approved")) {
      acceptanceFixtures = acceptanceFixtures.map((c) =>
        c.approval === "approved" ? { ...c, approval: "pending" as const } : c,
      );
      acceptanceApprovedAt = undefined;
      fixturesStale = true;
    }
  }
  const fixturesRepaired = fxCoerce.containerDropped || fxCoerce.dropped > 0 || fixturesStale;

  const filled: Project = {
    ...raw,
    name,
    brief,
    domain,
    currentPhase,
    decisions,
    _v: 2,
    enforceDod: raw.enforceDod === true,
    wildMode: raw.wildMode === true,
    wildRun: hw.wildRun,
    chatLog,
    research,
    implementationSpec,
    scorecard,
    generatedTree,
    modelRoute: hydrateModelRoute(
      (raw as unknown as { modelRoute?: unknown }).modelRoute,
      logs,
    ),
    sandbox: {
      runtime,
      ramMb: typeof raw.sandbox?.ramMb === "number" ? raw.sandbox.ramMb : null,
      // A1-28: typeof-guard the scalars like ramMb/enforceDod â€” `?? 30` let a
      // corrupt "30" / "false" ride into arithmetic and boolean slots.
      timeoutS:
        typeof raw.sandbox?.timeoutS === "number" && Number.isFinite(raw.sandbox.timeoutS)
          ? raw.sandbox.timeoutS
          : 30,
      isolated: raw.sandbox?.isolated === true,
    },
    lattice,
    schedule,
    traces: Array.isArray(raw.traces)
      ? raw.traces.filter((t) => t !== null && typeof (t as { id?: unknown }).id === "string")
      : [],
    packet: typeof raw.packet === "string" ? raw.packet : "",
    // A1-22: structural guards, not just plain-object (see usableSpecGraph).
    specGraph: usableSpecGraph(raw.specGraph),
    contracts: usableContracts(raw.contracts),
    oracle: Array.isArray(raw.oracle) ? raw.oracle : [],
    crew: Array.isArray(raw.crew) ? raw.crew : [],
    notes: typeof raw.notes === "string" ? raw.notes : "",
    generatedSource: typeof raw.generatedSource === "string" ? raw.generatedSource : "",
    lastTest: isPlainObject(raw.lastTest) ? (raw.lastTest as Project["lastTest"]) : null,
    artifacts,
    // A15 + CORE sweep: a persisted row with an unknown `kind` (or a non-string
    // text / non-numeric score) would make fusionRank throw inside packet
    // compilation â€” drop it defensively during hydration.
    memory,
    logs,
    competitors: Array.isArray(raw.competitors) ? raw.competitors : [],
    phases: phaseRepair.phases,
  };
  // E-15 / fixes/215 / 342-4: `...raw` carries Project.kind through, but an
  // unknown / non-string persisted kind (a hand-edited or legacy payload) must
  // not survive â€” codegen's tree trigger (singleModuleLibraryKind) reads it
  // directly, so a garbage value would silently mis-route synthesis. Clamp to
  // the legal 5-way DeliveryKind set; absent = the legacy single-module-library
  // path (byte-identical for kind-less payloads).
  if (filled.kind !== undefined && !(DELIVERY_KINDS as readonly string[]).includes(filled.kind)) {
    delete filled.kind;
  }
  // W359 (resolve-kind): the recorded kind decision rides WITH the kind it
  // explains â€” a malformed record is dropped (never repaired), and a record
  // naming a kind this project does not carry is dropped with it. Absent stays
  // absent, so a legacy payload's bytes are untouched.
  const kindResolution = coerceKindResolution(
    (raw as { kindResolution?: unknown }).kindResolution,
    filled.kind,
  );
  if (kindResolution !== undefined) filled.kindResolution = kindResolution;
  else delete filled.kindResolution;
  if (acceptanceFixtures !== undefined) filled.acceptanceFixtures = acceptanceFixtures;
  else delete filled.acceptanceFixtures;
  if (acceptanceApprovedAt !== undefined) filled.acceptanceApprovedAt = acceptanceApprovedAt;
  else delete filled.acceptanceApprovedAt;
  if (acceptanceBriefHash !== undefined) filled.acceptanceBriefHash = acceptanceBriefHash;
  else delete filled.acceptanceBriefHash;
  if (fixturesStale) {
    filled.logs = [
      ...filled.logs,
      {
        ts: Date.now(),
        phase: currentPhase,
        level: "warn" as const,
        event: "acceptance.stale",
        detail: "briefHash mismatch â€” approved fixtures reverted to pending (never silently re-approved)",
      },
    ];
  }
  // A1-22: the shape guards above nulled structurally-broken specGraph/
  // contracts â€” report + re-stamp like every other repair, never a silent drop.
  const shapeRepaired =
    (raw.specGraph !== undefined && raw.specGraph !== null && filled.specGraph === null) ||
    (raw.contracts !== undefined && raw.contracts !== null && filled.contracts === null);
  // A1-21: ONE flag list, used by BOTH this log-if and the early-return at the
  // end â€” a payload that only triggered hole/chatLog/research/impl/scorecard/
  // tree/fixtures/shape repair used to return with the PRE-repair packet still
  // attached (loud in logs, silent in the document).
  const anyRepaired =
    phaseRepair.repaired ||
    cpRepaired ||
    edgeRepaired ||
    holeRepaired ||
    rowRepaired ||
    scalarRepaired ||
    chatLogRepaired ||
    researchRepaired ||
    implRepaired ||
    scorecardRepaired ||
    treeRepaired ||
    fixturesRepaired ||
    shapeRepaired;
  if (anyRepaired) {
    // B-25/R9: repairs are loud, never silent.
    const phaseDetail = phaseRepair.repaired
      ? `dropped:${phaseRepair.dropped.join(",") || "none"} inserted:${phaseRepair.inserted.join(",") || "none"}`
      : "phases:ok";
    const cpDetail = cpRepaired
      ? ` currentPhase:${String(cp)}â†’${currentPhase}`
      : edgeRepaired
        ? ` edge:lockedâ†’P${currentPhase} (record promoted to ready)`
        : holeRepaired
          ? ` hole:edgeâ†’P${currentPhase} (contiguous sealed clamp)`
          : "";
    const rowTokens: string[] = [];
    if (rawArtifacts.length !== artifacts.length)
      rowTokens.push(`artifacts:-${rawArtifacts.length - artifacts.length}`);
    if (rawLogs.length !== logs.length) rowTokens.push(`logs:-${rawLogs.length - logs.length}`);
    if (rawDecisions.length !== decisions.length)
      rowTokens.push(`decisions:-${rawDecisions.length - decisions.length}`);
    if (rawMemory.length !== memory.length)
      rowTokens.push(`memory:-${rawMemory.length - memory.length}`);
    if (latticeRepaired) rowTokens.push("lattice:rebuilt");
    if (scheduleRepaired) rowTokens.push("schedule:rebuilt");
    if (chatLogRepaired) rowTokens.push("chatLog:dropped");
    if (researchRepaired) rowTokens.push("research:dropped");
    if (implRepaired) rowTokens.push("implementationSpec:dropped");
    if (scorecardRepaired) rowTokens.push("scorecard:dropped");
    if (treeRepaired) rowTokens.push("generatedTree:dropped");
    if (fxCoerce.containerDropped) rowTokens.push("acceptanceFixtures:dropped");
    else if (fxCoerce.dropped > 0) rowTokens.push(`acceptanceFixtures:dropped:${fxCoerce.dropped}`);
    if (fixturesStale) rowTokens.push("acceptance.stale");
    if (shapeRepaired) rowTokens.push("specGraph/contracts:dropped");
    const rowDetail = rowTokens.length ? ` rows:${rowTokens.join(",")}` : "";
    const scalarDetail = scalarRepaired
      ? ` scalars:${[
          name !== raw.name ? "name:default" : null,
          brief !== raw.brief ? "brief:empty" : null,
          domain !== raw.domain ? "domain:reinferred" : null,
          sandboxScalarsRepaired ? "sandbox:coerced" : null,
        ]
          .filter((s): s is string => s !== null)
          .join(",")}`
      : "";
    filled.logs = [
      ...filled.logs,
      {
        ts: Date.now(),
        phase: 0 as const,
        level: "warn" as const,
        event: "hydrate.repaired",
        detail: `${phaseDetail}${cpDetail}${rowDetail}${scalarDetail}`,
      },
    ].slice(-200);
  }
  // P13: a persisted ACTIVE wild run was force-stopped by hydration â€” say so
  // loudly (session-break honesty), then re-stamp the packet so its System
  // JSON does not describe a run that no longer exists.
  if (hw.stopped) {
    filled.logs = [
      ...filled.logs,
      {
        ts: Date.now(),
        phase: currentPhase,
        level: "warn" as const,
        event: "wild.stop",
        detail: "Session reloaded â€” active wild run stopped (no driver survives reload).",
      },
    ].slice(-200);
  }
  // W61 C4 (C-18): a persisted packet that is MISSING the always-rendered
  // `## Exit criteria (DoD)` section is a STALE render (produced by an older
  // truncation that dropped it). Re-stamp it rather than shipping the stale
  // bytes â€” the same staleness-repair class as A1-21.
  const packetStale =
    typeof filled.packet === "string" &&
    filled.packet.length > 0 &&
    !filled.packet.includes("## Exit criteria (DoD)");
  if (filled.packet && filled.lattice && filled.specGraph && !anyRepaired && !hw.stopped && !packetStale) {
    // A1-21: the same flag list the repair log above used â€” every repair
    // re-stamps (attachAlgorithms) instead of shipping a stale packet.
    return filled;
  }
  return attachAlgorithms(filled);
}

// ---------------------------------------------------------------------------
// Optional real-backend integration (async) â€” runPhaseAsync / runP6Real
//
// The only async seams in the engine. When the relevant backend is configured
// they fetch real data and inject it; otherwise they resolve to the exact
// deterministic synchronous result. Every failure (not-configured, network,
// timeout, invalid response) falls back gracefully â€” a run never strands and
// never fabricates output (B-18/B-23 honesty contract).
// ---------------------------------------------------------------------------

/** Phases whose artifacts can be upgraded from illustrative to real research. */
const RESEARCH_PHASES: ReadonlySet<PhaseId> = new Set([0, 7, 11]);

type ResearchFinding = { title: string; url: string; content?: string; score?: number };

// ---------------------------------------------------------------------------
// 99 Â§5 (fixes/128_x6) â€” compound/brand-name research-pollution guard.
//
// A raw product name like "Coffeehouse2Home" used to be spliced verbatim into
// every research query; search engines split the compound and returned literal
// coffee-shop hits (5/15 findings in the merged-suite run) and the LLM
// narratives then hallucinated a coffeehouse retail component. The guard below
// is pure + deterministic (no LLM, no network â€” corpus-dedup hashes and
// research_hash stay stable for identical inputs):
//   1. name tokens (split on camelCase + separators) that are plain dictionary
//      words or generic company noise (coffee, home, house, shop, app,
//      software, incâ€¦) are DROPPED â€” brand fragments never reach a query;
//   2. every query is seeded with the DOMAIN REGISTER â€” a small curated noun
//      phrase per known domain (project.domain) â€” so a compound brand that
//      contributes nothing still yields a correct domain query;
//   3. the register is then padded with the brief's most frequent content
//      nouns (frequency-ranked, deterministic) so product-specific vocabulary
//      (flip, showing, work order, ledgerâ€¦) rides along.
// The engine corpus entry, the headless bare-node overlay and the crew
// researcher all build through these two exports, so their queries stay
// byte-identical by construction (no more mirror drift).
// ---------------------------------------------------------------------------

/** Brand/dictionary-word noise â€” compound-name fragments never searched on. */
const RESEARCH_BRAND_NOISE: ReadonlySet<string> = new Set([
  "app", "apps", "application", "applications", "software", "platform",
  "platforms", "system", "systems", "suite", "tool", "tools", "product",
  "products", "company", "companies", "inc", "llc", "ltd", "corp", "group",
  "corporation", "technologies", "technology", "tech", "digital", "studio",
  "labs", "services", "service", "solutions", "solution", "network",
  "networks", "web", "site", "portal", "biz", "io", "ai", "co", "home",
  "coffee", "coffeehouse", "shop", "cafe", "house", "houses", "building",
  "buildings", "real", "estate", "track", "tracks", "record", "records",
  "manage", "manages", "management", "create", "creates", "publish",
  "publishes", "allow", "allows", "keep", "keeps", "set", "sets", "use",
  "uses", "turn", "turns", "add", "adds", "roll", "rolls",
]);

/** Plain function words â€” never mined as domain nouns. */
const RESEARCH_STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "has", "have", "in", "into", "is", "it", "its", "of", "on", "or", "that",
  "the", "their", "there", "these", "they", "this", "to", "was", "were",
  "will", "with", "one", "shared", "run", "every", "any", "each", "all",
  "our", "can", "do", "does", "done", "not", "no", "nor", "so", "than",
  "then", "too", "very", "just", "also", "other", "over", "under", "across",
  "five", "six", "two", "single", "full", "more", "most", "same", "such",
  "both", "between", "during", "while", "up", "down", "out", "off", "own",
]);

/** Curated domain register: normalized domain â†’ guaranteed noun seed. */
const RESEARCH_DOMAIN_REGISTER: Readonly<Record<string, string>> = {
  "real estate": "property rental tenant lease",
  "construction": "construction contractor jobsite project budget",
  "field service": "field service work order crew schedule dispatch",
  "saas": "saas subscription customer dashboard billing",
  "ecommerce": "ecommerce product catalog checkout order fulfillment",
  "fintech": "fintech payments ledger account transaction",
  "healthcare": "healthcare patient clinical provider record scheduling",
  "education": "education course student enrollment learning assessment",
  "logistics": "logistics fleet shipment warehouse route tracking",
  "hospitality": "hospitality guest booking reservation housekeeping",
  "marketing": "marketing campaign lead analytics channel content",
  // W61 C9: the web/retail/mobile registers the `inferDomain` taxonomy names.
  // Keys are the NORMALIZED domain id (hyphens â†’ spaces, see
  // researchQueryQualifiers), so `web-marketing` looks up `web marketing` â€” the
  // missing entry that left a bakery/website brief with no category fallback.
  "web marketing": "website marketing landing brand content catalogue",
  "retail": "retail storefront checkout basket order product",
  "mobile": "mobile app ios android touchscreen navigation",
  "hr": "hr payroll employee hiring timesheet benefits",
  "travel": "travel trip booking itinerary destination pricing",
  "restaurant": "restaurant menu order kitchen delivery inventory",
  "property management": "property rental tenant lease maintenance inspection",
};

/** Split a name/domain into lowercase word tokens (camelCase + separators). */
function researchNameTokens(value: string): string[] {
  const humped = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return humped
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length > 0);
}

/** Deterministic plural collapse for mining (tenants/tenant â†’ tenant). */
function researchStem(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ss")) return word;
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  return word;
}

/** Most frequent content nouns in the brief (count desc, first-seen asc), capped. */
function researchBriefNouns(
  brief: string,
  cap: number,
  nameFragments: ReadonlySet<string>,
): string[] {
  const counts = new Map<string, number>();
  const order: string[] = [];
  const bump = (t: string): void => {
    if (!counts.has(t)) {
      counts.set(t, 0);
      order.push(t);
    }
    counts.set(t, (counts.get(t) ?? 0) + 1);
  };
  for (const raw of brief.toLowerCase().match(/[a-z][a-z']*/g) ?? []) {
    const t = researchStem(raw.replace(/'/g, ""));
    if (
      t.length < 3 ||
      RESEARCH_BRAND_NOISE.has(t) ||
      RESEARCH_STOPWORDS.has(t) ||
      nameFragments.has(t)
    ) {
      continue;
    }
    bump(t);
  }
  // JS sort is stable â€” equal counts keep first-seen order (deterministic).
  return order
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, cap);
}

/** W61 C9 (PR-17): at most this many ADDED qualifiers follow the phase intent
 *  and the guaranteed business-name tokens. A bag of ~15 domain nouns used to
 *  LEAD the query, so the bakery/flower runs were grounded in property
 *  rental/lease documents (BL-001 recurrence). */
export const RESEARCH_MAX_QUALIFIERS = 3;

/** W61 C9: deterministic research qualifiers. The project's business NAME is
 *  always present (its distinctive tokens, or its raw tokens when they are all
 *  brand/dictionary noise) â€” a query that does not name the product cannot
 *  ground its research. Then up to `cap` ADDED qualifiers follow, most specific
 *  first: the brief's frequency-ranked content nouns (product vocabulary), then
 *  the domain register / domain words as the category fallback. Pure;
 *  collision-free by construction through the shared `seen` set. */
function researchQueryQualifiers(project: Project, cap: number): string[] {
  const name = (project.name ?? "").trim();
  const domain = (project.domain ?? "").trim();
  const brief = (project.brief ?? "").trim();
  const nameFragments = new Set(researchNameTokens(name));
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (w: string): boolean => {
    const t = w.trim().toLowerCase();
    if (!t || seen.has(t) || RESEARCH_STOPWORDS.has(t)) return false;
    seen.add(t);
    out.push(t);
    return true;
  };
  // 0) The business NAME â€” guaranteed. Distinctive fragments lead; when every
  //    fragment is brand/dictionary noise (a compound like "Coffeehouse2Home")
  //    the raw name tokens ride instead, so the query still names the product.
  const named = researchNameTokens(name);
  const distinctive = named.filter((t) => !RESEARCH_BRAND_NOISE.has(t));
  const nameUnit = distinctive.length > 0 ? distinctive : named;
  for (const w of nameUnit) add(w);
  // The ADDED qualifiers honor `cap`; the business name is never capped away.
  const capacity = out.length + cap;
  const addWithin = (w: string): void => {
    if (out.length < capacity) add(w);
  };
  // 1) The product's actual vocabulary (frequency-ranked) â€” the most on-intent
  //    qualifiers, and the ones the domain bag used to crowd out.
  for (const w of researchBriefNouns(brief, cap + nameUnit.length, nameFragments)) addWithin(w);
  // 2) Domain register + domain words â€” the guaranteed category fallback.
  const domainKey = domain.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const register = RESEARCH_DOMAIN_REGISTER[domainKey];
  if (register) {
    for (const w of register.split(" ")) addWithin(w);
    for (const w of domainKey.split(" ")) addWithin(w);
  } else {
    for (const w of researchNameTokens(domain)) {
      if (!RESEARCH_BRAND_NOISE.has(w)) addWithin(w);
    }
  }
  if (out.length === 0) {
    // Last-resort floor â€” never empty, never fabricated.
    if (nameUnit.length === 0 && name.length > 0) add(name);
    if (out.length === 0) add(domainKey || "product");
  }
  // Guarantee: the business name is represented even when every one of its
  // tokens was a stopword / noise fragment (a query must name the product).
  const nameLower = name.toLowerCase();
  if (nameLower.length > 0 && !nameUnit.some((t) => out.includes(t)) && !out.includes(nameLower)) {
    out.push(nameLower);
  }
  return out;
}

/**
 * Build ONE deterministic, pollution-guarded research query for a project.
 * `topic` is the phase-specific intent ("architecture feasibility 2026" for P0,
 * a phase title for the crew researcher, â€¦).
 *
 * W61 C9 (PR-17): the phase INTENT leads. It is the subject; the project's
 * domain is only a qualifier (D3's researcher rule). The pre-fix builder put
 * the domain noun bag first and the intent last, so a bakery brief whose
 * classifier mislabeled it real-estate researched "property rental tenant lease
 * â€¦ architecture feasibility" and returned rental/lease category pages (BL-001).
 * Exported so the headless live overlay and the crew researcher build
 * byte-identical queries to the engine's corpus entries (no mirror drift â€”
 * fixes/128_x6 single-sources the builder).
 */
export function researchQueryText(project: Project, topic: string): string {
  const intent = String(topic ?? "").trim();
  const qualifiers = researchQueryQualifiers(project, RESEARCH_MAX_QUALIFIERS);
  return [intent, ...qualifiers].filter((w) => w.length > 0).join(" ");
}

// ---------------------------------------------------------------------------
// W61 C9 (PR-17) â€” deterministic off-intent research filter.
//
// The query fix above stops the domain bag LEADING, but a model/back-end can
// still return a business-domain CATEGORY page (rent/lease/tenant listings) for
// an ENGINEERING phase. The engine's corpus must not ground P0 architecture /
// P11 tooling work in a listings page. Pure + deterministic (no LLM, no
// network): the blocklist applies only when the phase intent is engineering,
// matches the term in the result's title or URL (where category pages name it),
// and keeps a page that is itself about building software (a tutorial that
// merely mentions the domain term). The researcher persona flags the same class
// (D3); this is the engine-side deterministic drop.
// ---------------------------------------------------------------------------

/** Engineering/feasibility intent markers â€” the blocklist only applies under these. */
const ENGINEERING_INTENT_TERMS =
  /\b(architecture|feasibilit\w*|api|apis|sdk|software|developer|development|framework|implementation|programming|database|cloud|backend|frontend|library|libraries|tooling|tools|stack|code|coding|engineering|augmentation|integration)\b/i;

/** Off-intent business-domain CATEGORY terms (listing/marketplace pages). */
const OFF_INTENT_RESULT_TERMS =
  /\b(rental|rentals|rent|renting|lease|leases|tenant|tenants|landlord|landlords|apartment|apartments|realtor|mortgage|escrow|condo|condos|duplex|zillow|trulia|hotpads|rentcafe|rightmove|zoopla)\b/i;

/** Minimal structural shape the filter reads (a research finding or any subset). */
export type ResearchResultLike = { title?: unknown; url?: unknown; content?: unknown };

/** W61 C9: is one result off-intent for the given phase topic? */
export function isOffIntentResearch(topic: string, item: ResearchResultLike): boolean {
  const intent = String(topic ?? "");
  if (!ENGINEERING_INTENT_TERMS.test(intent)) return false;
  const title = String(item?.title ?? "");
  const url = String(item?.url ?? "");
  const content = String(item?.content ?? "");
  if (!OFF_INTENT_RESULT_TERMS.test(`${title} ${url}`)) return false;
  // Keep a genuinely software-building page; drop the listing/category page.
  return !ENGINEERING_INTENT_TERMS.test(`${title} ${content}`);
}

/** W61 C9: partition results into accepted / dropped, preserving input order. */
export function filterOffIntentResearch<T extends ResearchResultLike>(
  topic: string,
  items: readonly T[],
): { accepted: T[]; dropped: T[] } {
  const accepted: T[] = [];
  const dropped: T[] = [];
  for (const item of items) {
    if (isOffIntentResearch(topic, item)) dropped.push(item);
    else accepted.push(item);
  }
  return { accepted, dropped };
}

// ---------------------------------------------------------------------------
// W61 C9 (PR-17) â€” RELEVANCE-based research drop filter.
//
// The blocklist above catches ONE hardcoded vertical (rental/lease listings).
// This filter generalises to whatever the project actually is: a result is
// on-intent when it shares a content term with the phase intent, the project's
// domain, or its deterministic query qualifiers (business name + brief content
// nouns + domain register). A result with zero overlap is off-intent and is
// dropped. Pure + deterministic (no LLM, no network); when there is no
// vocabulary to judge against, the result is KEPT â€” the filter never drops what
// it cannot judge.
// ---------------------------------------------------------------------------

/** Terms too generic to make a result "relevant" on their own. */
const RESEARCH_RELEVANCE_STOP: ReadonlySet<string> = new Set([
  "2024", "2025", "2026", "live", "tool", "tools", "best", "top", "guide",
  "and", "the", "for", "with", "your", "you",
]);

/** Lowercase content tokens (len â‰¥ 3) of a string â€” the relevance unit. */
function relevanceTokens(text: string): Set<string> {
  return new Set(String(text ?? "").toLowerCase().match(/[a-z][a-z0-9]{2,}/g) ?? []);
}

/** The terms that make a research result on-intent for this project+phase: the
 *  phase intent + the project's domain + its deterministic query qualifiers
 *  (business name, brief content nouns, domain register). Pure. */
export function researchRelevanceTerms(project: Project, phase: PhaseId): Set<string> {
  const terms = new Set<string>();
  const add = (s: string): void => {
    for (const t of relevanceTokens(s)) {
      if (!RESEARCH_STOPWORDS.has(t) && !RESEARCH_RELEVANCE_STOP.has(t)) terms.add(t);
    }
  };
  add(RESEARCH_PHASE_INTENT[phase] ?? "");
  add(project.domain ?? "");
  for (const q of researchQueryQualifiers(project, 6)) terms.add(q);
  return terms;
}

/** Is a result RELEVANT to the project+phase? A term in the TITLE/URL is a claim
 *  about the page's subject and keeps it; a term that appears only in the body
 *  is not enough on its own â€” it must also clear `RESEARCH_RELEVANCE_FLOOR` via
 *  the SAME `relevanceScore` maths that ranked it. The old test accepted any
 *  single body-token overlap with the term set, whose generic words (`software`,
 *  `market`, `landscape`) let a Wikipedia "Pixar" page (matched on `software`)
 *  and "Cities: Skylines" earn the corpus â€” both scored 0.042. Measured on the
 *  ten rt10 briefs: every on-intent source scored â‰¥ 0.167. Empty vocabulary â‡’
 *  keep (cannot judge). */
function researchItemRelevant(
  query: string,
  terms: ReadonlySet<string>,
  item: ResearchResultLike,
): boolean {
  if (terms.size === 0) return true;
  const field = relevanceTokens(`${String(item?.title ?? "")} ${String(item?.url ?? "")}`);
  for (const t of terms) if (field.has(t)) return true;
  return relevanceScore(query, item) >= RESEARCH_RELEVANCE_FLOOR;
}

/**
 * W61 C9 (PR-17): partition a phase's research results into accepted/dropped by
 * RELEVANCE, not by one hardcoded vertical. A result is dropped when it is
 * either (a) an off-intent business-domain category page for an engineering
 * phase (`isOffIntentResearch` â€” the rental/lease listing class), or (b) shares
 * no content term with this project+phase (`researchItemRelevant`). Pure,
 * deterministic, keyless; preserves input order. Consumed by `fetchResearch`
 * and exported for the headless/crew research overlays.
 */
export function filterRelevantResearch<T extends ResearchResultLike>(
  project: Project,
  phase: PhaseId,
  items: readonly T[],
): { accepted: T[]; dropped: T[] } {
  const topic = researchPhaseTopic(project, phase);
  const query = researchQueryFor(project, phase);
  const terms = researchRelevanceTerms(project, phase);
  const accepted: T[] = [];
  const dropped: T[] = [];
  for (const item of items) {
    if (isOffIntentResearch(topic, item) || !researchItemRelevant(query, terms, item)) {
      dropped.push(item);
    } else {
      accepted.push(item);
    }
  }
  return { accepted, dropped };
}

/** Per-phase research INTENT (the subject of the query). */
const RESEARCH_PHASE_INTENT: Readonly<Partial<Record<PhaseId, string>>> = {
  0: "architecture feasibility 2026",
  7: "competitors market landscape",
  11: "live tools and API augmentation",
};

/** Domain-aware research TOPIC descriptors: the query names the product's own
 *  category, not a bare software phrase, so a bakery website researches
 *  websites and a shop researches retail instead of "architecture feasibility"
 *  for every project. A domain with no descriptor keeps the software intent
 *  (legacy behaviour for unknown/custom-software domains). */
const RESEARCH_DOMAIN_TOPIC: Readonly<Record<string, string>> = {
  "web-marketing": "website",
  retail: "retail store",
  mobile: "mobile app",
  marketplace: "marketplace",
  "real-estate": "property",
  construction: "construction",
  "health-ops": "health clinic",
  "finance-ops": "finance",
  "revenue-ops": "sales",
  "agent-platform": "ai agent",
  logistics: "logistics",
  operations: "inventory",
  analytics: "analytics",
};

/** The phase's topic, qualified by the project's domain. Deterministic. */
function researchPhaseTopic(project: Project, phase: PhaseId): string {
  const intent = RESEARCH_PHASE_INTENT[phase] ?? "live tools and API augmentation";
  const key = String(project.domain ?? "").trim().toLowerCase();
  const descriptor = RESEARCH_DOMAIN_TOPIC[key];
  return descriptor ? `${descriptor} ${intent}` : intent;
}

export function researchQueryFor(project: Project, phase: PhaseId): string {
  return researchQueryText(project, researchPhaseTopic(project, phase));
}

function formatResearchFinding(item: ResearchFinding): string {
  const body = (item.content ?? "").trim();
  return [`# ${item.title}`, "", body || "(no summary)", "", `Source: ${item.url}`].join("\n");
}

/** M-07: honesty footer appended to every LLM phase-narrative artifact body so a
 *  consuming agent can tell grounded prose from invention (mirrors the report-intake
 *  "unverified by engine" footer discipline). */
const NARRATIVE_GROUNDED_FOOTER = (n: number) => `\n\n> generated prose â€” grounded in ${n} fetched sources`;
const NARRATIVE_UNGROUNDED_FOOTER =
  "\n\n> generated prose â€” not grounded in fetched sources; verify before relying on it";
/** M-07 sibling for the keyed per-phase deliverable: grounded in the brief +
 *  prior artifacts (no fetched sources), so it must not claim web grounding.
 *  Item 4 (narrative/artifact split): it ALSO states that it governs over the
 *  deterministic template beside it, so a phase never ships two rival
 *  deliverables without saying which one the consumer should build on. */
const GROUNDED_PHASE_FOOTER =
  "\n\n> generated prose â€” grounded in the full brief and the prior phase artifacts; not fetched sources; verify before relying on it" +
  "\n> authoritative for this phase: where the deterministic template beside it disagrees, build on THIS artifact; the template is a declared scaffold, not a second deliverable.";

/** The phase's OWN artifact kind for the grounded LLM deliverable, so it is the
 *  phase's artifact rather than a generic doc. */
const PHASE_ARTIFACT_KIND: Readonly<Partial<Record<PhaseId, Artifact["kind"]>>> = {
  1: "graph",
  2: "memory",
  3: "mcp",
  4: "security",
  5: "validation",
  8: "ui",
  9: "cicd",
  10: "edge",
  12: "docs",
};

/** Bounds for the prior-artifact context in the grounded prompt: the FULL brief
 *  is always passed; each prior artifact contributes a bounded slice and the
 *  most recent GROUNDED_PRIOR_ARTIFACTS_MAX are used. */
const GROUNDED_PRIOR_ARTIFACTS_MAX = 12;
const GROUNDED_PRIOR_ARTIFACT_CHARS = 1500;

/**
 * Context flow (item 1): the bounded prior-phase DELIVERABLE context a phase's
 * model work builds on. Only artifacts from EARLIER phases ride (never the
 * current phase's own output), the bookkeeping rows (kind "gate"/"packet") are
 * excluded, the most recent `GROUNDED_PRIOR_ARTIFACTS_MAX` are kept, and each
 * body is sliced to `GROUNDED_PRIOR_ARTIFACT_CHARS`. Pure; [] when no phase ran
 * before â€” so a P0 call gets no fabricated context.
 */
export function priorArtifactContext(
  project: Project,
  phase: PhaseId,
): Array<{ phase: number; title: string; body: string }> {
  return (project.artifacts ?? [])
    .filter((a) => a.phase < phase && a.kind !== "gate" && a.kind !== "packet")
    .slice(-GROUNDED_PRIOR_ARTIFACTS_MAX)
    .map((a) => ({ phase: a.phase, title: a.title, body: a.body.slice(0, GROUNDED_PRIOR_ARTIFACT_CHARS) }));
}

/**
 * Keyed per-phase work (P1-P5, P8-P12): a model-written artifact for the phase's
 * OWN deliverable, fed the FULL brief and the prior phase artifacts â€” not merely
 * a narrative beside the deterministic template (P1-P5 used to do no model
 * work). Honest envelope: keyless / a refusal / an empty reply returns a coded
 * failure and the deterministic `applyPhaseResult` output stands unchanged.
 */
export async function phaseGroundedArtifact(
  project: Project,
  phase: PhaseId,
  completer: Completer,
): Promise<
  { ok: true; text: string } | { ok: false; reason: string; error?: string; code?: ErrorCode }
> {
  const def = phaseDef(phase);
  const priors = priorArtifactContext(project, phase);
  const priorText =
    priors.length > 0
      ? priors
          .map((a) => `### P${a.phase} â€” ${a.title}\n${a.body}`)
          .join("\n\n")
      : "(no prior phase artifact)";
  // Item 4 (narrative/artifact split): this phase's OWN deterministic template
  // is already in the record `done` passed in. The model must not silently
  // contradict the document that ships beside it, so the template is rendered
  // and the reconciliation rule is stated explicitly.
  const templateArtifacts = (project.artifacts ?? []).filter(
    (a) => a.phase === phase && a.kind !== "gate" && a.kind !== "packet",
  );
  const templateText =
    templateArtifacts.length > 0
      ? templateArtifacts
          .slice(0, 4)
          .map((a) => `### ${a.title}\n${a.body.slice(0, GROUNDED_PRIOR_ARTIFACT_CHARS)}`)
          .join("\n\n")
      : "(no deterministic template for this phase)";
  const prompt = [
    `Produce the REAL deliverable for phase ${def.code} "${def.title}" of a governed build of "${project.name}" (domain: ${project.domain}).`,
    `Phase intent: ${def.summary}`,
    ``,
    `Write the phase's actual artifact for THIS product â€” concrete and specific, not a generic description. Ground every statement in the full brief and the prior phase artifacts below; never invent a requirement, price, actor or fact they do not state. Where the brief is silent, say what is unknown instead of guessing.`,
    ``,
    `# Full brief`,
    project.brief,
    ``,
    `# Prior phase artifacts`,
    priorText,
    ``,
    `# Deterministic template shipped beside your artifact`,
    templateText,
    ``,
    `Where your deliverable disagrees with that template, do NOT silently contradict it: state the correction explicitly. Your artifact is the authoritative deliverable for this phase; the template is a declared scaffold.`,
    ``,
    `Return markdown only (a short heading, then the phase deliverable).`,
  ].join("\n");
  // OV-36 / fixes/156 E1 (item 1, measured live on the CLI path): with
  // thinking ON and a bounded window the pro model spent the WHOLE 1400-token
  // max_tokens on reasoning_content and returned content:"" â€” every grounded
  // call degraded (`p<N>.live.artifact.failed: â€¦ model returned reasoning only
  // (6236 chars of reasoning_content, content empty); stopped at max_tokens`).
  // The deliverable is a bounded markdown artifact, not a reasoning task, so
  // thinking is pinned OFF (the E1 rule: reasoning must not consume the window
  // this structured call needs) with headroom for a heading + body.
  const res = await completer(prompt, { model: "deepseek-v4-pro", maxTokens: 2000, thinking: false });
  if (res && res.usage) recordSessionSpend(res.usage);
  if (!res || res.ok !== true) {
    return {
      ok: false,
      reason: res && res.reason ? res.reason : "error",
      ...(res && res.ok === false && res.error ? { error: res.error } : {}),
      ...(res && res.ok === false && res.code ? { code: res.code } : {}),
    };
  }
  const text = res.text.trim();
  if (!text) {
    return { ok: false, reason: "error", error: "model returned an empty phase artifact", code: "RT_E_LLM_REJECTED" };
  }
  return { ok: true, text };
}

/**
 * Fetch real research for a research phase. Returns null when the phase is not a
 * research phase â€” callers then take the deterministic path unchanged. For a
 * research phase it always returns a result object; `unavailable` (E-13)
 * distinguishes \"live web research could not run\" (backend not configured or
 * the call failed) from \"ran but found nothing\", so the live layer can record
 * an EXPLAINED dead-end (Project.meta.liveUnavailable) instead of a silent
 * deterministic fallback.
 */
async function fetchResearch(
  project: Project,
  phase: PhaseId,
): Promise<{
  items: ResearchFinding[];
  narrative: string | null;
  provider: string | null;
  unavailable: boolean;
  /** W62 Â· C1-07-class remediation: how many fetched results the relevance /
   *  off-intent filters DROPPED, so the drop is recorded (count + a bounded
   *  reason) instead of being silently discarded. 0 on every keyless/failed
   *  pass; keyed runs surface it as a `research.filtered` ledger row. */
  dropped: number;
  droppedNote: string | null;
  /** OV-13/OV-29 (item 5): coded rows for the two failures this function used
   *  to swallow to the floor with no trace â€” a thrown research call and a
   *  failed narrative call. Appended by `liveLayer`; [] on a clean pass. */
  degradeRows: JsonLog[];
} | null> {
  if (!RESEARCH_PHASES.has(phase)) return null;

  // 1) Real web research (Tavily / free search) â€” optional; honest fallback when unconfigured.
  let items: ResearchFinding[] = [];
  let provider: string | null = null;
  let unavailable = false;
  let dropped = 0;
  let droppedNote: string | null = null;
  const degradeRows: JsonLog[] = [];
  try {
    const query = researchQueryFor(project, phase);
    const result = await research(query);
    if (result && result.ok === true && (result.items ?? []).length > 0) {
      // W61 C9 (PR-17): drop off-intent results before they earn the corpus â€”
      // relevance-based (clears RESEARCH_RELEVANCE_FLOOR) with the rental/lease
      // category blocklist as the engineering-phase backstop.
      const filtered = filterRelevantResearch(project, phase, result.items as ResearchFinding[]);
      items = filtered.accepted;
      dropped = filtered.dropped.length;
      if (dropped > 0) {
        const titles = filtered.dropped
          .map((d) => String((d as ResearchResultLike).title ?? "").trim())
          .filter((t) => t !== "")
          .slice(0, 3);
        droppedNote =
          `${dropped} of ${result.items.length} fetched result(s) dropped as off-intent ` +
          `(relevance + engineering blocklist)${titles.length > 0 ? `; e.g. ${titles.join(" | ").slice(0, 200)}` : ""}`;
      }
      // M-01: remember which backend actually served the findings (for project.research).
      provider = result.provider ?? null;
    } else if (!result || result.ok !== true) {
      // not-configured / backend failure: live research was attempted and could
      // not execute. (ok:true with zero items means it ran and found nothing â€”
      // unavailable stays false so the DoD corpus probe stays honestly unmet.)
      unavailable = true;
      // On a bare-Node host the server-fn research seam cannot run at ALL, so
      // its failure describes the host, not the backend: the CLI/headless
      // overlay owns that path and records its own coded row. Everywhere else
      // the failure is real and must be recorded, coded (item 5).
      if (!isBareNodeHost()) {
        degradeRows.push(
          liveDegradeRow(phase, "research", result ?? new Error("research backend returned no result"), "RT_E_RESEARCH_UNAVAILABLE"),
        );
      }
    }
  } catch (err) {
    unavailable = true;
    degradeRows.push(liveDegradeRow(phase, "research", err, "RT_E_RESEARCH_UNAVAILABLE"));
  }

  // 2) LLM phase narrative (DeepSeek) â€” fires whenever the LLM is configured,
  // independent of whether live research succeeded.
  // 347/348 (R3): this used to be an inline `complete()` prompt that inlined
  // title + 200-char snippets and never forbade invention â€” the exact site that
  // turned five off-topic cake-architecture pages into a "luxury celebration
  // cake" strategy. It now routes through llm-tasks' grounded summarizer, which
  // threads the query + full source list, scores them, and injects a
  // deterministic honesty clause when they are off-topic or insufficient.
  let narrative: string | null = null;
  try {
    if ((await llmStatus()).configured) {
      const comp = await phaseNarrative(
        {
          name: project.name,
          brief: project.brief,
          domain: project.domain,
          query: researchQueryFor(project, phase),
          sources: items,
          // Context flow (item 1): the research narrative builds on the prior
          // phases' deliverables, not the brief alone.
          priorArtifacts: priorArtifactContext(project, phase),
        },
        phaseDef(phase),
      );
      // CF-SE2-3b (312 Â· E2): the narrative call is metered into the process
      // session ledger â€” I2: EVERY response that reports usage, success or
      // refusal (a refusal that burned tokens still counts against the cap).
      if (comp && comp.ok === true && comp.usage) recordSessionSpend(comp.usage);
      if (comp && comp.ok === true && typeof comp.text === "string" && comp.text.trim()) {
        narrative = comp.text.trim();
      } else if (comp && comp.ok !== true) {
        // OV-29/OV-13 (item 5): a configured narrative refusal was silent here.
        degradeRows.push(liveDegradeRow(phase, "narrative", comp, "RT_E_LLM_REJECTED"));
      }
    }
  } catch (err) {
    narrative = null;
    degradeRows.push(liveDegradeRow(phase, "narrative", err, "RT_E_LLM_REJECTED"));
  }

  return { items, narrative, provider, unavailable, dropped, droppedNote, degradeRows };
}

/**
 * Live research + LLM-narrative layering over the deterministic engine (M-10 seam).
 *
 * Exported so the headless driver (and any other caller) can apply the SAME live
 * layer the UI's runPhaseAsync uses â€” research phases (0/7/11) fetch real findings,
 * persist them to `project.research` (M-01 corpus), and optionally attach an LLM
 * narrative artifact with an honesty footer (M-07); every other phase may attach an
 * LLM narrative when configured. Never mutates its input; every failure degrades to
 * the exact deterministic applyPhaseResult result. Throws are the caller's problem
 * (runPhaseAsync catches them); this function itself never fabricates output.
 *
 * E-13: when a research phase ran but live web research could not execute
 * (unconfigured/failed), the returned project records `meta.liveUnavailable`
 * so a recorded P7 gate is an EXPLAINED dead-end, never a silent one.
 * E-14: the first successful real LLM call stamps the actual route
 * (`modelRoute: "deepseek-flash"`) on the returned project â€” the packet then
 * reports the model that really ran, not a default label.
 *
 * fixes/147 (E2): an optional additive third param `deps` carries the P6
 * journey driver's tree-failure context. When present (and only for phase 6)
 * it is forwarded verbatim into codegen liveP6Synthesis as its deps â€” the
 * ONLY tree-failure reader codegen has (deps?.treeFailure feeds the bounded
 * repair re-prompts). Absent â‡’ the legacy byte-identical
 * liveP6Synthesis(project) call: zero behavior change for every existing
 * caller (UI store, runPhaseAsync, runUntilGate, wild-mode).
 */

/** Optional live-layer P6 synthesis context (see liveLayer's doc above). */
export type LiveLayerDeps = {
  treeFailure?: string;
  /** fixes/153 (P2): the previous cycle's bounded refusal excerpt (class +
   *  model reason, <=200 chars). Set by `p6CycleLiveDeps` and forwarded
   *  verbatim to codegen - whose synthesisRefusal reader was closed in
   *  328 P1. The field rode this object untyped before; declared here so the
   *  seam stops describing less than it forwards. Absent => legacy call. */
  synthesisRefusal?: string;
  /** T-107.1 (216r): the opt-in patch (str_replace) repair level. Set only by
   *  the repair drivers (`repairCycleLiveDeps`); absent on every other path =>
   *  legacy call unchanged. */
  patchRepairs?: boolean;
  /** fixes/326 F1b: the journey's one-shot gate-repair context (recorded
   *  unmet P6 DoD requirements) â€” forwarded verbatim to codegen
   *  liveP6Synthesis alongside treeFailure. Absent â‡’ legacy call unchanged. */
  gateRepair?: string;
  /** T4 (112 Â§4.4 / 216g): the caller's resolved cross-project proven lesson
   *  rows (from `knowledge.provenRowsFromStore`) â€” forwarded verbatim to
   *  codegen, whose lesson sites rank them with the memory lessons. Absent â‡’
   *  legacy call unchanged (byte-identical prompts). */
  proven?: readonly RankableLessonRow[];
};

/**
 * 312 C3: the hang bound for ONE keyed P6 synthesis call (ms). NOT a
 * performance budget â€” it sits an order above the worst plausible keyed P6
 * (the provider's own per-call ceilings are 20 s flash / 60 s pro, and the
 * seam's retries + repairs are bounded), so it can only ever trip on a call
 * that has STOPPED making progress; the deterministic floor is then the
 * outcome exactly as for any other synthesis failure.
 */
export const P6_SYNTH_HANG_BOUND_MS = 900_000;

/**
 * fixes/150 (G4): the keyed P6 upgrade core shared by liveLayer AND the wild
 * P6 step â€” ONE seam for both faces of the product (149_a5 F1 / 149_a4 #2:
 * the 'leave it alone' face must produce the same artifact a keyed store run
 * does, never the deterministic floor under an LLM reviewer that praises it).
 * This is the original inline liveLayer block moved verbatim: direct-env
 * probe (isDeepSeekConfigured â€” a plain process.env read; NEVER the server-fn
 * llmStatus, which reports unconfigured under bare Node, the only host the
 * CLI/headless/wild drivers run on), the fixes/148 (F1 follow-up) delivery
 * kind stamp from the brief classifier BEFORE the codegen call (the M1 flip:
 * a kind-absent webapp brief must route to the chunked tree, not the â‰¤8
 * single-module path), then codegen liveP6Synthesis via the concatenated
 * dynamic-import idiom (client-bundle-safe; a codegen refusal/throw returns
 * the floor unchanged â€” the existing safety net). NEVER throws: every
 * failure degrades to the deterministic floor.
 *
 * W359 (resolve-kind): the kind stamp used to sit BEHIND the host gate
 * (`!isBareNodeHost()`) and the key probe (`!configured`), so on the KEYLESS
 * path and on every non-DeepSeek run `Project.kind` stayed absent and each
 * consumer re-inferred it. The resolution is deterministic and needs NO model,
 * so it is now stamped FIRST, before both guards, and every keyed return below
 * re-stamps idempotently (same kind + same record â‡’ the same reference). Keyless
 * therefore returns a kind-carrying project, not the byte-identical input â€” the
 * emitted shape and the recorded reason now agree on every path.
 */
async function upgradeP6Keyed(floor: Project, deps?: LiveLayerDeps): Promise<Project> {
  const stamped = withDeliveryKind(floor);
  try {
    // 312 C3 (CF-SE2-1) â€” HOST GATE. On a non-Node host the runtime-assembled
    // `.server.` specifiers below are rewritten by the TanStack
    // import-protection plugin to a mock module whose every export is a
    // callable proxy; awaiting a call on it never settles (it spins the
    // microtask queue forever â€” measured, see settle.ts / fixes/312 Â§1), and
    // no in-process timeout can fire. Refuse by host check BEFORE any import;
    // the honest floor (now carrying its decided kind) stands exactly as it
    // does keyless.
    if (!isBareNodeHost()) return stamped;
    const dsSpec = clientSafeServerSpecifier("deepseek");
    const ds = (await import(dsSpec)) as { isDeepSeekConfigured?: () => boolean };
    const configured = typeof ds.isDeepSeekConfigured === "function" ? ds.isDeepSeekConfigured() : false;
    if (!configured) return stamped;
    // fixes/148 (F1 follow-up): real journeys arrive kind-absent (the
    // create path never classifies), and codegen's tree trigger is
    // kind-scoped â€” a kind-absent webapp brief would silently take the
    // â‰¤8 single-module path and ship no tree. The ONE delivery-kind
    // decision is stamped above (W359), BEFORE the codegen call (342-4):
    // withDeliveryKind stores the same 5-way value scaffold.projectKindOf reads
    // back, so the routing signal and the emitted shape cannot disagree. A brief
    // that names a library carries kind "library" (codegen's
    // singleModuleLibraryKind must accept it alongside the absence signal â€”
    // cross-lane contract).
    let p: Project = withDeliveryKind(stamped);
    const codegenSpec = clientSafeServerSpecifier("codegen");
    const codegen = (await import(codegenSpec)) as {
      liveP6Synthesis?: (
        p: Project,
        deps?: {
          treeFailure?: string;
          gateRepair?: string;
          synthesisRefusal?: string;
          patchRepairs?: boolean;
          proven?: readonly RankableLessonRow[];
        },
      ) => Promise<Project>;
    };
    if (typeof codegen.liveP6Synthesis === "function" && isTrustedCallable(codegen.liveP6Synthesis)) {
      // fixes/147 (E2): the journey driver's tree-failure tail rides the
      // additive `deps` param into codegen (deps.treeFailure is codegen's
      // ONLY failure-context reader); absent â‡’ liveP6Synthesis(done) â€”
      // byte-identical legacy call.
      // 312 C3: the await is BOUNDED â€” a synthesis promise that never settles
      // (dropped wire call) resolves as !ok at the hang bound and the floor
      // stands, exactly like every other synthesis failure below.
      const settled = await settleWithin(codegen.liveP6Synthesis(p, deps), P6_SYNTH_HANG_BOUND_MS);
      if (!settled.ok) return p;
      const upgraded = settled.value;
      if (upgraded && typeof upgraded === "object" && upgraded !== p) return upgraded;
    }
    return p;
  } catch (err) {
    // W62 Â· C1-07-class remediation: this catch used to return the deterministic
    // floor with NO coded row â€” the one keyed-P6 failure an operator could not
    // reconstruct from the ledger. Record it, coded, without changing behavior.
    // A4-E9: the phase record also carries the `degraded` marker.
    return markPhaseDegraded(withLiveDegradeRows(stamped, [p6SynthesisRow(err)]), 6);
  }
}

/** Coded degrade row for a keyed P6 synthesis failure (see `upgradeP6Keyed`). */
function p6SynthesisRow(failure: unknown): JsonLog {
  const code = liveDegradeCode(failure, "RT_E_LLM_REJECTED");
  const message = liveDegradeMessage(failure).slice(0, LIVE_DEGRADE_MESSAGE_BUDGET);
  return {
    ts: Date.now(),
    phase: 6,
    level: "warn",
    event: "p6.live.synthesis.failed",
    detail: `${code} Â· keyed P6 synthesis unavailable: ${message} â€” deterministic floor used instead`,
  };
}

/**
 * Context flow (item 1): the host-aware completion seam for `liveLayer`'s
 * per-phase model work.
 *
 * The TanStack server-fn `complete()` (llm.ts) cannot run outside a Start
 * server context, so on the bare-Node host every CLI/harness driver runs
 * `llmStatus()` ALWAYS reports unconfigured and `complete()` ALWAYS resolves
 * `{ok:false}` (measured with the repo `.env` key present:
 * `serverFn_llmStatus_configured:false` vs `direct_isDeepSeekConfigured:true`).
 * The old gate `(await llmStatus()).configured` therefore made the grounded
 * per-phase deliverable â€” the ONE producer that reads the prior phase
 * artifacts â€” unreachable on the CLI path: P1â€“P5/P8â€“P12 generated from the
 * brief alone (a keyed run's census shows them carrying only the deterministic
 * template + gate, no grounded deliverable).
 *
 * On a bare-Node host with a key in THIS process we call the provider module
 * directly (the same `isDeepSeekConfigured` probe `upgradeP6Keyed` uses, and the
 * same trust gate); everywhere else the server-fn facade stands. Keyless /
 * denied host â‡’ null, so the deterministic floor is byte-identical.
 */
async function hostCompleter(): Promise<Completer | null> {
  if (isBareNodeHost() && keyedDeepSeekConfigured()) {
    try {
      const spec = clientSafeServerSpecifier("deepseek");
      const ds = (await import(spec)) as { completeDeepSeek?: Completer };
      const fn = ds.completeDeepSeek;
      return typeof fn === "function" && isTrustedCallable(fn) ? fn : null;
    } catch {
      // Provider module unloadable â†’ honest floor (no fabricated model text).
      return null;
    }
  }
  if ((await llmStatus()).configured) return complete;
  return null;
}

export async function liveLayer(project: Project, phase: PhaseId, deps?: LiveLayerDeps): Promise<Project> {
  const real = await fetchResearch(project, phase);
  let done = applyPhaseResult(project, phase);
  // P0-01 Part B (fixes/97): keyed P6 synthesis â€” when the LLM is configured,
  // the deterministic placeholder module is upgraded to a brief-faithful,
  // machine-verified module by liveP6Synthesis (server-only; runtime dynamic
  // import so the *.server.* boundary never leaks into the client bundle).
  // Keyless runs keep the honest placeholder (p6-brief-fit fails by
  // construction). Any failure degrades to the deterministic floor.
  if (phase === 6) {
    // fixes/209: single path via upgradeP6Keyed (was duplicated inline + dead helper).
    // Bare-node-safe DeepSeek probe + kind stamp + liveP6Synthesis live inside the helper.
    // Keyless / refusal â†’ floor unchanged. stampP6ReqTrace always runs on the final P6 state.
    done = await upgradeP6Keyed(done, deps);
    // fixes/144 (M2 lane B4): stamp the p6-arch reqTrace on the FINAL P6 state
    // â€” after keyed synthesis upgraded the project with a generatedTree (the
    // applyPhaseResult stamp above already ran pre-upgrade and only fires on a
    // tree-carrying re-apply). A tree-absent result â€” keyless, or a refused
    // keyed synthesis that landed the single-module floor â€” is returned
    // unchanged: p6-arch passes it vacuously (legacy path).
    done = stampP6ReqTrace(done);
  }
  const extras: Artifact[] = [];
  // E-14: true only when a real DeepSeek call succeeded in this live pass.
  let llmRan = false;
  // fixes/252 (W19-L1 Â· OV-13): coded rows for keyed degrades that used to be
  // comment-only. Empty on every clean/keyless pass, so the returned project is
  // then byte-identical to before â€” the row is evidence, never behavior.
  const degradeRows: JsonLog[] = [];

  // Apply the E-13/E-14 provenance stamps to whichever branch result wins.
  const stamp = (base: Project): Project => {
    // 99 Â§6 (fixes/128_x6): meta.liveUnavailable is the EXPLAINED dead-end
    // flag ("live web research could not run"). It must never coexist with a
    // corpus that actually landed: once real findings arrive in THIS live pass
    // (or they arrived on a prior attempt of the same project), the flag is
    // cleared â€” a stale true would contradict 15 real findings + 3 real
    // narratives (the merged-suite contradiction 99 Â§6 recorded).
    const itemsLanded = real !== null && real.items.length > 0;
    const unavailable =
      real !== null && real.unavailable === true && !itemsLanded;
    const meta = { ...(base.meta ?? {}) };
    let metaChanged = false;
    if (unavailable) {
      if (meta.liveUnavailable !== true) {
        meta.liveUnavailable = true;
        metaChanged = true;
      }
    } else if (itemsLanded && meta.liveUnavailable === true) {
      delete meta.liveUnavailable;
      metaChanged = true;
    }
    // E-14: the first successful real LLM call stamps the actual route.
    const route: ModelRoute =
      llmRan && base.modelRoute !== "deepseek-pro" && base.modelRoute !== "deepseek-flash"
        ? "deepseek-flash"
        : base.modelRoute;
    if (!metaChanged && !llmRan) return base;
    return {
      ...base,
      ...(metaChanged ? { meta } : {}),
      ...(llmRan && route !== base.modelRoute ? { modelRoute: route } : {}),
    };
  };

  // W62 Â· C1-07-class remediation: the relevance/off-intent filter's DROPPED
  // results used to vanish with no count or reason (engine.ts:3637-3639). The
  // row below records the drop on the phase's ledger â€” evidence, never a
  // behavior change (keyless / no-drop passes stay byte-identical).
  const researchDropRow: JsonLog | null =
    real !== null && real.dropped > 0
      ? {
          ts: Date.now(),
          phase,
          level: "info",
          event: "research.filtered",
          detail: `${real.droppedNote ?? `${real.dropped} result(s) dropped as off-intent`} Â· kept ${real.items.length}`,
        }
      : null;
  // Item 5: `fetchResearch`'s previously-swallowed failures (a thrown research
  // call, a failed narrative call) ride out as coded rows â€” never a silent
  // degrade that reads like a clean keyless pass.
  const researchDegradeRows: JsonLog[] = real?.degradeRows ?? [];
  const researchRows: JsonLog[] = [...researchDegradeRows, ...(researchDropRow ? [researchDropRow] : [])];
  const withResearchDrop = (proj: Project): Project =>
    researchRows.length > 0 ? { ...proj, logs: [...(proj.logs ?? []), ...researchRows].slice(-200) } : proj;

  if (real) {
    // Research phase: real findings + narrative. Competitor rows are NEVER promoted
    // to source:"cited" (M-01) â€” template rows carry no per-row evidence; real
    // findings persist as the project.research corpus rendered in the packet.
    const researchArtifacts: Artifact[] = real.items.map((it, i) =>
      art(phase, "research", it.title || `Research finding ${i + 1}`, formatResearchFinding(it), "markdown"),
    );
    if (real.narrative) {
      llmRan = true;
      // M-07: honesty footer â€” grounded when â‰¥1 fetched finding backs the prose.
      const footer =
        real.items.length >= 1
          ? NARRATIVE_GROUNDED_FOOTER(real.items.length)
          : NARRATIVE_UNGROUNDED_FOOTER;
      researchArtifacts.push(
        art(phase, "research", "Phase narrative (LLM)", `${real.narrative}${footer}`, "markdown"),
      );
    }
    if (real.items.length > 0) {
      const corpusEntry: ResearchCorpusEntry = {
        query: researchQueryFor(project, phase),
        provider: real.provider ?? undefined,
        items: real.items.map((it) => ({ title: it.title, url: it.url, content: it.content ?? "" })),
      };
      // H-04 (fixes/115): dedup against the existing corpus before appending â€”
      // a research phase re-run after a rejection must not append a duplicate
      // entry for the same query+URL set (unbounded growth + research_hash
      // churn). Mirror deepenResearch's query+sorted-URL-set identity.
      const urlsOf = (items: readonly { url: string }[]): string =>
        [...new Set(items.map((it) => it.url))].sort().join("\n");
      const already = (done.research ?? []).some(
        (e) => e.query === corpusEntry.query && urlsOf(e.items ?? []) === urlsOf(corpusEntry.items),
      );
      return withResearchDrop(stamp(already
        ? { ...done, artifacts: [...done.artifacts, ...researchArtifacts] }
        : {
            ...done,
            research: [...(done.research ?? []), corpusEntry],
            artifacts: [...done.artifacts, ...researchArtifacts],
          }));
    }
    if (researchArtifacts.length === 0) return withResearchDrop(stamp(done));
    return withResearchDrop(stamp({ ...done, artifacts: [...done.artifacts, ...researchArtifacts] }));
  }

  // Context flow (item 1): the host-aware seam reaches the provider on the
  // bare-Node host the CLI/harness drivers run (see `hostCompleter`), so the
  // grounded per-phase deliverable â€” which reads the PRIOR phase artifacts â€”
  // actually runs there instead of degrading to "brief alone".
  const completer = await hostCompleter();
  if (completer) {
    // Non-research phase: an LLM narrative for every phase, plus real constraint
    // extraction at P2 (Constraint Scheduler). All config-gated + try/caught.
    // Keyed per-phase work: the phase's OWN deliverable, model-written from the
    // FULL brief + prior artifacts, so the live layer is more than a narrative
    // beside the deterministic template (P1-P5 previously did no model work).
    // P6 is codegen's synthesis phase â€” its artifact is produced above.
    if (phase !== 6) {
      try {
        const grounded = await phaseGroundedArtifact(done, phase, completer);
        if (grounded.ok) {
          llmRan = true;
          extras.push(
            art(
              phase,
              PHASE_ARTIFACT_KIND[phase] ?? "docs",
              `Phase ${phaseDef(phase).code} deliverable (LLM, grounded)`,
              `${grounded.text}${GROUNDED_PHASE_FOOTER}`,
              "markdown",
            ),
          );
        } else {
          // OV-13 (fixes/252): a keyed degrade is recorded, coded â€” never silent.
          degradeRows.push(liveDegradeRow(phase, "artifact", grounded, "RT_E_LLM_REJECTED"));
        }
      } catch (err) {
        /* grounded artifact unavailable â†’ deterministic result stands (recorded,
           never silent â€” OV-13, fixes/252) */
        degradeRows.push(liveDegradeRow(phase, "artifact", err, "RT_E_LLM_REJECTED"));
      }
    }
    const tasks = createLlmTasks(completer);
    try {
      const narrative = await tasks.phaseNarrative(
        {
          name: project.name,
          brief: project.brief,
          domain: project.domain,
          // Context flow (item 1): the narrative is fed the prior phases'
          // deliverables, so it cannot be generated from the brief alone (and
          // cannot contradict the grounded artifact beside it).
          priorArtifacts: priorArtifactContext(project, phase),
        },
        phaseDef(phase),
      );
      if (narrative.ok) {
        llmRan = true;
        // M-07: no fetched sources exist for this path â€” the prose is ungrounded by
        // construction and must say so.
        extras.push(
          art(phase, "docs", "Phase narrative (LLM)", `${narrative.text}${NARRATIVE_UNGROUNDED_FOOTER}`, "markdown"),
        );
      } else {
        // OV-13 (fixes/252): a keyed narrative refusal used to be silent here â€”
        // the run then read exactly like a keyless one. Record it, coded.
        degradeRows.push(liveDegradeRow(phase, "narrative", narrative, "RT_E_LLM_REJECTED"));
      }
    } catch (err) {
      /* narrative unavailable â†’ deterministic result stands (recorded, never
         silent â€” OV-13, fixes/252) */
      degradeRows.push(liveDegradeRow(phase, "narrative", err, "RT_E_LLM_REJECTED"));
    }
    if (phase === 2) {
      try {
        const cons = await tasks.extractConstraints(project.brief);
        if (cons.ok && cons.constraints.length > 0) {
          llmRan = true;
          extras.push(
            art(
              phase,
              "docs",
              "Extracted constraints (LLM)",
              cons.constraints.map((c) => `- ${c}`).join("\n"),
              "markdown",
            ),
          );
        } else if (!cons.ok) {
          // OV-13 (fixes/252): a failed keyed constraint extraction used to be
          // comment-only. `ok:true` with zero constraints is deliberately NOT
          // recorded â€” the call ran and found none; only a coded refusal (or a
          // throw, below) is a degrade.
          degradeRows.push(liveDegradeRow(phase, "constraints", cons, "RT_E_LLM_REJECTED"));
        }
      } catch (err) {
        /* constraints unavailable â†’ deterministic result stands (recorded,
           never silent â€” OV-13, fixes/252) */
        degradeRows.push(liveDegradeRow(phase, "constraints", err, "RT_E_LLM_REJECTED"));
      }
    }
  }

  if (extras.length === 0) return withLiveDegradeRows(done, degradeRows);
  return withLiveDegradeRows(
    stamp({ ...done, artifacts: [...done.artifacts, ...extras] }),
    degradeRows,
  );
}

/**
 * E-13 seam: re-run the LIVE research layer over a phase that is already
 * COMPLETE, so a recorded dead-end (deterministic P7 with no corpus) gains a
 * real recovery path instead of a permanent FAIL. Phase must be a research
 * phase (0/7/11) whose phase record is complete; anything else returns the
 * project untouched.
 *
 * Contract: fetches live research + optional LLM narrative (the same
 * fetchResearch the live layer uses â€” injected via `fetcher` for tests),
 * appends ONE deduplicated corpus entry (by query + sorted URL set â€” idempotent
 * re-runs never duplicate), appends research/narrative artifacts (deduped by
 * artifact id), stamps `meta.liveUnavailable` when live research could not run
 * (explained dead-end), logs `research.deepened`, re-records the phase gate via
 * recordGateInto (E-02 â€” fresh evidenceHash + gate artifact) and re-stamps the
 * packet. Never mutates its input and never moves the phase cursor / status:
 * it deliberately does NOT call liveLayer wholesale, whose applyPhaseResult
 * pass would re-synthesize the phase and clobber the cursor of a project that
 * has since advanced past it.
 */
export async function deepenResearch(
  project: Project,
  phase: PhaseId,
  fetcher: (
    p: Project,
    ph: PhaseId,
  ) => Promise<{
    items: ResearchFinding[];
    narrative: string | null;
    provider: string | null;
    unavailable: boolean;
    dropped?: number;
    droppedNote?: string | null;
  } | null> = fetchResearch,
): Promise<Project> {
  if (!RESEARCH_PHASES.has(phase)) return project;
  const rec = (project.phases ?? []).find((r) => r.id === phase);
  if (!rec || rec.status !== "complete") return project;

  const res = await fetcher(project, phase);
  if (!res) return project;

  const query = researchQueryFor(project, phase);
  const now = Date.now();
  const logs: JsonLog[] = [...(project.logs ?? [])];
  // W62 Â· C1-07-class remediation: record the relevance filter's dropped count
  // here too (deepenResearch is the other live-research production path) â€”
  // deep research used to silently discard off-intent results.
  if ((res.dropped ?? 0) > 0) {
    logs.push({
      ts: now,
      phase,
      level: "info",
      event: "research.filtered",
      detail: `${res.droppedNote ?? `${res.dropped} result(s) dropped as off-intent`} Â· kept ${res.items.length}`,
    });
  }
  const research: ResearchCorpusEntry[] = [...(project.research ?? [])];
  let artifacts = [...(project.artifacts ?? [])];
  const seenArtifact = new Set(artifacts.map((a) => a.id));
  let next: Project = { ...project, logs, research, artifacts };

  const urlsOf = (items: { url: string }[]): string =>
    [...new Set(items.map((it) => it.url))].sort().join("\n");

  if (res.items.length > 0) {
    const urls = urlsOf(res.items);
    const already = research.some(
      (e) => e.query === query && urlsOf(e.items ?? []) === urls,
    );
    if (!already) {
      next = {
        ...next,
        research: [
          ...research,
          {
            query,
            provider: res.provider ?? undefined,
            items: res.items.map((it) => ({
              title: it.title,
              url: it.url,
              content: it.content ?? "",
            })),
          },
        ],
      };
    }
    for (const [i, it] of res.items.entries()) {
      const a = art(
        phase,
        "research",
        it.title || `Research finding ${i + 1}`,
        formatResearchFinding(it),
        "markdown",
      );
      if (!seenArtifact.has(a.id)) {
        seenArtifact.add(a.id);
        artifacts = [...artifacts, a];
      }
    }
  }
  if (res.narrative) {
    const footer =
      res.items.length >= 1
        ? NARRATIVE_GROUNDED_FOOTER(res.items.length)
        : NARRATIVE_UNGROUNDED_FOOTER;
    const a = art(phase, "research", "Phase narrative (LLM)", `${res.narrative}${footer}`, "markdown");
    if (!seenArtifact.has(a.id)) {
      seenArtifact.add(a.id);
      artifacts = [...artifacts, a];
    }
  }
  // W61 C6 (R1 BL-011 residual / E3 OOS-6): refuse an EMPTY-CORPUS deepen before
  // it stamps anything. engine.deepenResearch used to stamp meta.liveUnavailable
  // and re-record the phase gate, and the p7-research probe WAIVES on that flag
  // â€” heaping a FAILED gate to PASS with no corpus. The 346-T2 fix guarded only
  // the store.ts wrapper; the CLI `deepen` verb shares this engine seam, so the
  // guard belongs HERE. A deepen that lands findings (or an idempotent re-run
  // over an existing corpus) is unaffected.
  if ((next.research?.length ?? 0) === 0) {
    const err = new Error(
      "Live research returned no findings â€” nothing to deepen; the phase gate was not re-recorded.",
    ) as Error & { code?: string };
    err.code = "RT_E_RESEARCH_UNAVAILABLE";
    throw err;
  }
  // 99 Â§6 (fixes/128_x6): liveUnavailable is the explained dead-end flag and
  // must never coexist with a corpus that landed â€” a deepen that brings real
  // findings in clears a stale flag from an earlier failed attempt, and a
  // deepen that really ran an LLM narrative stamps the honest route (E-14).
  // (With the empty-corpus refusal above, this stamp is now unreachable from a
  // deepen â€” an unavailable fetch with no corpus throws, never commits.)
  if (res.unavailable && res.items.length === 0 && (next.research?.length ?? 0) === 0) {
    next = { ...next, meta: { ...(next.meta ?? {}), liveUnavailable: true } };
  } else if (res.items.length > 0 && next.meta?.liveUnavailable === true) {
    const meta = { ...next.meta };
    delete meta.liveUnavailable;
    next = { ...next, meta };
  }
  if (
    res.narrative &&
    next.modelRoute !== "deepseek-pro" &&
    next.modelRoute !== "deepseek-flash"
  ) {
    next = { ...next, modelRoute: "deepseek-flash" as ModelRoute };
  }
  next = { ...next, artifacts };
  next = {
    ...next,
    logs: [
      ...logs,
      {
        ts: now,
        phase,
        level: res.items.length > 0 ? ("info" as const) : ("warn" as const),
        event: "research.deepened",
        detail:
          `${query} Â· ${res.items.length} finding(s)` +
          (res.narrative ? " Â· narrative" : "") +
          (res.unavailable && res.items.length === 0
            ? " Â· live research unavailable (not configured or failed)"
            : ""),
      },
    ].slice(-200),
  };
  // E-02/E-13: re-record the completed phase's gate â€” a fresh evidenceHash (and
  // gate artifact + gate.verdict log) reflecting the deepened corpus.
  const gated = recordGateInto(next, phase);
  return sealPacketArtifact(attachAlgorithms(gated));
}

/**
 * E-19 regression-scoped advancement guard (pure, advisory): when a report for
 * `touchingPhase` names `files`, re-run the DoD gate of every earlier COMPLETE
 * phase whose file space overlaps (spec-graph node files + that phase's
 * artifact titles) and compare the evidence hash to what was recorded at
 * completion. A later phase touching the same file can invalidate a prior
 * phase's exit evidence.
 *
 * 331 V2 (declare-or-strike): this scanner has NO production caller today â€”
 * the repo-wide only hits are this docblock and the definition below, and no
 * `regression.drift` log event is emitted anywhere. Wiring it needs the
 * report-ingest seam that holds `report.files` (`store.ts ingestReport` /
 * headless ingest â€” not reachable from this module), so today the drift it
 * computes is never surfaced and no drift lesson is minted. Nothing here
 * mutates prior records. Phases without a recorded gate (legacy runs that
 * predate E-02 gate recording) cannot be compared and are skipped.
 */
export function verifyPriorPhases(
  project: Project,
  touchingPhase: number,
  files: string[],
): { phase: number; drift: boolean; unmetNow: string[]; wasPassed: boolean }[] {
  if (!Array.isArray(files) || files.length === 0) return [];
  const graphFiles = new Set((project.specGraph?.nodes ?? []).map((n) => n.file));
  const out: { phase: number; drift: boolean; unmetNow: string[]; wasPassed: boolean }[] = [];
  for (let p = 0; p < touchingPhase; p++) {
    const rec = (project.phases ?? []).find((r) => r.id === p);
    if (!rec || rec.status !== "complete" || !rec.gate) continue;
    const titles = new Set(
      (project.artifacts ?? []).filter((a) => a.phase === p).map((a) => a.title),
    );
    const related = new Set<string>([...graphFiles, ...titles]);
    if (!files.some((f) => related.has(f))) continue;
    const r = runGate(project, p as PhaseId);
    out.push({
      phase: p,
      drift: r.evidenceHash !== rec.gate.evidenceHash,
      unmetNow: r.unmet.map((g) => g.id),
      wasPassed: rec.gate.passed,
    });
  }
  return out;
}

/**
 * fixes/217f (216y Â§2.3 G2): the record an unexpected live-layer failure leaves
 * behind. `runPhaseAsync`'s floor â€” the deterministic applyPhaseResult result â€”
 * is no longer a silent substitute for a failed live pass: this row carries the
 * real thrown message and the explicit statement that the floor was used.
 *
 * Honesty: the throw is deliberately left UNCLASSIFIED â€” this seam owns no
 * classifier, and guessing an RT_E code would invent a cause (216y G3 already
 * maps the common env/network failures to RT_E_UNKNOWN, whose own doc says the
 * failure is opaque). The message is clipped on an explicit budget so a hostile
 * or enormous error string cannot blow the bounded ledger (this row rides the
 * same â‰¤200-row `logs` window applyPhaseResult maintains).
 */
const LIVE_FAILURE_MESSAGE_BUDGET = 160;

/** Exported for headless.runPhase's outer catch (fixes/255 Â· W20-L3): the CLI
 *  path must record a thrown live pass with this same G2 row, never silently
 *  skip to the floor. */
export function liveLayerFailureRow(phase: PhaseId, thrown: unknown): JsonLog {
  const message = thrown instanceof Error ? thrown.message : String(thrown);
  const clipped = message.slice(0, LIVE_FAILURE_MESSAGE_BUDGET);
  return {
    ts: Date.now(),
    phase,
    level: "warn",
    event: `p${phase}.live.failed`,
    detail: `live layer failed (unclassified): ${clipped}${
      message.length > LIVE_FAILURE_MESSAGE_BUDGET ? "â€¦" : ""
    } â€” deterministic floor used instead`,
  };
}

/**
 * fixes/252 (W19-L1 Â· OV-13 + OV-29): a CODED row for a live-layer degrade that
 * used to be comment-only â€” a keyed failure must never read like a keyless run.
 *
 * Reuses the G2 shape (`liveLayerFailureRow` above): same `warn` level, same
 * `p<phase>.live.*` event family, same bounded detail + explicit "deterministic
 * result used instead" statement. Unlike G2's deliberately unclassified row,
 * this one LEADS with an `RT_E_*` code: the failure arrives already classified
 * (llm.ts / llm-tasks carry the provider's code; the research backends return
 * coded refusals), so no cause is ever invented â€” an unregistered string is not
 * trusted, and a thrown error is classified with the caller's domain fallback
 * (errors.ts `classifyError`, whose own doc names the LLM caller's
 * `RT_E_LLM_REJECTED` default for exactly this use).
 *
 * Telemetry purity (AGENTS.md #7): the factory NEVER throws â€” even a hostile
 * failure value (a throwing getter, an unprintable object) degrades to a bare
 * coded row â€” so recording a degrade can never break the run it observes.
 */
export type LiveDegradeKind = "narrative" | "constraints" | "research" | "artifact";

/** Message budget: code + kind + message + statement stay â‰¤240 chars total. */
const LIVE_DEGRADE_MESSAGE_BUDGET = 140;

/** Never-trusted code rule: a coded failure's OWN code wins, but only when it
 *  is registered in errors.ts; else the honest fallback (or the registered
 *  not-configured code for the LLM family). */
function liveDegradeCode(failure: unknown, fallback: ErrorCode): ErrorCode {
  if (failure !== null && typeof failure === "object") {
    const raw = (failure as { code?: unknown }).code;
    if (typeof raw === "string" && (ERROR_CODES as readonly string[]).includes(raw)) {
      return raw as ErrorCode;
    }
    if ((failure as { reason?: unknown }).reason === "not-configured") {
      // A configured-gate pass whose call then found no key. The research
      // backends always carry their own code, so this arm is the LLM family.
      return fallback === "RT_E_RESEARCH_UNAVAILABLE" ? fallback : "RT_E_LLM_NOT_CONFIGURED";
    }
  }
  if (failure instanceof Error) return classifyError(failure, fallback);
  return fallback;
}

/** Human-visible detail source: an Error's message, a coded result's `error`
 *  prose, else an honest "no failure detail" â€” never an empty string. */
function liveDegradeMessage(failure: unknown): string {
  if (failure instanceof Error) return failure.message;
  if (failure !== null && typeof failure === "object") {
    const err = (failure as { error?: unknown }).error;
    if (typeof err === "string" && err.trim()) return err.trim();
    const reason = (failure as { reason?: unknown }).reason;
    if (typeof reason === "string" && reason.trim()) return `result reason: ${reason}`;
  }
  if (typeof failure === "string" && failure.trim()) return failure.trim();
  return "no failure detail";
}

export function liveDegradeRow(
  phase: PhaseId,
  kind: LiveDegradeKind,
  failure: unknown,
  fallbackCode: ErrorCode,
): JsonLog {
  try {
    const code = liveDegradeCode(failure, fallbackCode);
    const message = liveDegradeMessage(failure);
    const clipped = message.slice(0, LIVE_DEGRADE_MESSAGE_BUDGET);
    return {
      ts: Date.now(),
      phase,
      level: "warn",
      event: `p${phase}.live.${kind}.failed`,
      detail: `${code} Â· live ${kind} failed: ${clipped}${
        message.length > LIVE_DEGRADE_MESSAGE_BUDGET ? "â€¦" : ""
      } â€” deterministic result used instead`,
    };
  } catch {
    // Hostile failure value (throwing getter / unprintable) â†’ bare coded row.
    return {
      ts: Date.now(),
      phase,
      level: "warn",
      event: `p${phase}.live.${kind}.failed`,
      detail: `${fallbackCode} Â· live ${kind} failed: no failure detail â€” deterministic result used instead`,
    };
  }
}

/**
 * Append coded degrade rows to a live-layer result. Returns the SAME reference
 * when there is nothing to add â€” a clean or keyless pass stays byte-identical
 * (the OV-13 invariant: the row is evidence, never a behavior change) â€” and
 * rides the same â‰¤200-row window as every other log writer. Shared by the
 * engine's liveLayer and headless's bare-node overlay (OV-29 folds into the
 * same shape).
 */
export function withLiveDegradeRows(base: Project, rows: readonly JsonLog[]): Project {
  if (rows.length === 0) return base;
  return { ...base, logs: [...(base.logs ?? []), ...rows].slice(-200) };
}

/**
 * W-02 (fixes/271 Â· Â§R1-f02 item 3): console-side loader for the ONE keyed P6
 * edge. Returns null when headless exports no runP6Edge (old bundle) so the
 * caller falls back to the existing liveLayer path; a seam THROW propagates
 * to runPhaseAsync's catch (deterministic floor + a coded failure row â€”
 * the same G2 contract every other runPhaseAsync throw gets).
 */
async function viaHeadlessP6Edge(project: Project): Promise<Project | null> {
  const headlessSpec = "./head" + "less.ts";
  const hl = (await import(headlessSpec)) as { runP6Edge?: (p: Project) => Promise<Project> };
  if (typeof hl.runP6Edge !== "function") return null;
  return await hl.runP6Edge(project);
}

/**
 * 350 (F1): fold the keyed spend a phase just MEASURED onto its PhaseRecord â€”
 * the console/UI twin of `headless.recordPhaseSpend` (same arithmetic, same
 * honesty): `baseline` is the process session ledger cloned before the phase
 * ran, the measured delta is ACCUMULATED onto any spend already recorded (a
 * rejected re-run folds), and an empty delta leaves the record byte-identical.
 * No number is estimated; absent stays absent. Never reads/sets a cap.
 */
export function recordPhaseSpend(project: Project, phase: PhaseId, baseline: TokenLedger): Project {
  const delta = spendDelta(sessionTokenBudget().ledger, baseline);
  if (totalTokens(delta) === 0 && delta.calls === 0) return project;
  return {
    ...project,
    phases: project.phases.map((r) => (r.id === phase ? { ...r, spend: accumulateSpend(r.spend, delta) } : r)),
  };
}

/**
 * Async entry point that wires optional real research (and an optional LLM phase
 * narrative) into the deterministic engine â€” exactly `liveLayer` with a hard
 * safety net. For research phases it fetches real data and layers it on top of the
 * synchronous applyPhaseResult; for every other phase it is exactly
 * applyPhaseResult. When no backend is configured this resolves to the identical
 * deterministic result (no behavior change). Any unexpected error falls back to
 * the deterministic path â€” a run never strands and never fabricates output â€” and
 * the fallback is RECORDED as a bounded `p<phase>.live.failed` warn row (fixes/217f
 * G2: a degraded live pass stays distinguishable from a deliberately deterministic
 * one), never swallowed silently.
 *
 * 350 (F1): the whole body runs under a session-ledger baseline so the measured
 * per-phase delta is folded onto the phase record on every exit (success, P6
 * edge, and the deterministic floor).
 */
export async function runPhaseAsync(project: Project, phase: PhaseId): Promise<Project> {
  const spendBaseline = normalizeLedger(sessionTokenBudget().ledger);
  try {
    // W-02 (fixes/271 Â· Â§R1-f02): the console's per-phase live path must reach
    // the same tested-mint seam run/gate/wild use. Phase 6 + keyed â‡’ route
    // through headless.runP6Edge (lazily â€” this module stays client-safe);
    // keyless/browser (probe false) â‡’ the existing liveLayer path, unchanged.
    if (phase === 6 && keyedDeepSeekConfigured()) {
      const reached = await viaHeadlessP6Edge(project);
      if (reached !== null) return recordPhaseSpend(reached, phase, spendBaseline);
    }
    return recordPhaseSpend(await liveLayer(project, phase), phase, spendBaseline);
  } catch (err) {
    // Any unexpected error must never break a run â€” the deterministic path is the floor.
    // G2 (216y Â§2.3): the floor is the OUTCOME, never the whole story â€” log the failure
    // on the returned project so the degradation is visible in the record.
    // A4-E9: the phase RECORD carries the `degraded` marker too, so "threw and
    // ran the floor" is distinguishable from a genuine completion.
    const floor = applyPhaseResult(project, phase);
    return recordPhaseSpend(
      markPhaseDegraded(
        { ...floor, logs: [...floor.logs, liveLayerFailureRow(phase, err)].slice(-200) },
        phase,
      ),
      phase,
      spendBaseline,
    );
  }
}

/**
 * Parallel real-execution helper for P6 (M-03: real run â†’ gate convergence). Runs
 * the generated module through the configured runner; when it is not configured
 * (or the module is absent / the run cannot start) returns `{ ok: false, result: null }`
 * so callers fall back to the deterministic self-test. When the bounded runner DID
 * execute the module, the returned `project` carries `lastTest` stamped from the
 * real exit code (`ok: exitCode === 0`, detail = stdout/stderr head â‰¤ 400 chars) â€”
 * callers re-run DoD (runGate) against that shape so a real run's verdict feeds the
 * p6-test gate, mirroring the template self-test path. `ok` keeps its historical
 * meaning ("the runner executed / produced an ExecResult", never for
 * not-configured), so existing callers behave unchanged.
 */
export async function runP6Real(
  project: Project,
): Promise<{ ok: boolean; result: ExecResult | null; project?: Project }> {
  const source = project.generatedSource;
  if (!source) return { ok: false, result: null };
  try {
    const result = await runCode(source);
    const reason = (result as unknown as { reason?: string } | null)?.reason;
    if (!result || reason === "not-configured") {
      // Deterministic fallback: the runner never executed â€” lastTest (the sync
      // template self-test verdict) stands untouched.
      return { ok: false, result: null };
    }
    if (result.ok) {
      // Real bounded run completed â†’ converge into the gate: lastTest now reflects
      // the ACTUAL exit code, and the returned project lets the caller re-run DoD.
      const ok = result.exitCode === 0;
      // audit-39 1.3: a HEALTHY quiet module (exit 0, no stdout/stderr â€”
      // the P6 engine template prints nothing) must not flip the recorded
      // gate to FAIL: the p6-test probe requires a non-empty detail, so a
      // quiet success gets an honest deterministic detail instead of "".
      const detail = (result.stdout || result.stderr || `exit ${result.exitCode} (no output â€” clean run)`).slice(0, 400);
      return { ok: true, result, project: { ...project, lastTest: { ok, detail } } };
    }
    // Runner refused / timed out / failed to spawn â€” no exit code exists, so no gate
    // verdict is minted; report the raw outcome and keep the deterministic fallback.
    return { ok: true, result };
  } catch {
    return { ok: false, result: null };
  }
}

// ---------------------------------------------------------------------------
// P13 Wild Mode â€” bounded autonomous step (engine.wildStep)
//
// One call = ONE bounded macro-action on the current legal edge (never more
// than one phase execution per call, plus the review/approval/advance that
// edge resolution implies), so a headless driver can loop wildStep with a
// hard iteration cap and full observability. Every auto decision is appended
// to the ledger (wild.* events â€” append-only, never deleted) AND mirrored onto
// `Project.wildRun` (active/pause/phase/lastAutoLog/lastAutoAt/stoppedAt) so
// the console (B7) can stream the run from one object.
//
// Step semantics per call, in order:
//   â€¢ gate open (awaiting_hitl) â†’ Auto-Review decides (see gate path): approve
//     (hard-DoD post-check when enforceDod) or honest pause (human-only gate,
//     classifier not configured, classifier reject/error, DoD fail).
//   â€¢ ready/running edge â†’ deterministic floor execution (applyPhaseResult â€”
//     the same synthesis the sync store run uses), gate recorded for completed
//     phases, then the classifier judges the outputs before the loop leaves
//     the phase; reject or (enforceDod) a failing runGate = paused + a "Hard
//     DoD block" artifact, approve = advance one phase.
//   â€¢ P12 sealed â†’ run completes (wildRun.active=false, stoppedAt stamped).
//   â€¢ paused/stopped/mode-off/inactive â†’ noop (zero mutation).
//
// Classifier honesty: the default reviewer (wild-mode.server.ts) is
// configured-only (deepseek-v4-flash). When it is not configured the loop uses
// the deterministic DoD floor for non-gate phases and NEVER fabricates a
// judgment for a human approval gate â€” it pauses with an honest log instead.
// ---------------------------------------------------------------------------

export type WildStepOutcome = "advanced" | "completed" | "paused" | "noop";

export type WildStepResult = {
  project: Project;
  outcome: WildStepOutcome;
  /** True when the call committed any state change (false for noop). */
  ran: boolean;
  error?: string;
  /**
   * Machine-readable pause/failure class (errors.ts, B5). Absent on noop â€”
   * a driver loop branches on `code`, never on prose. Mapping: classifier
   * error/short feedback â†’ RT_E_LLM_REJECTED Â· classifier call that never
   * settles inside the review bound (312 C3) â†’ RT_E_LLM_TIMEOUT Â· classifier
   * not configured â†’
   * RT_E_LLM_NOT_CONFIGURED Â· human-only gate / hard-DoD block / review
   * reject â†’ RT_E_GATE_PENDING Â· locked/rejected/missing-record/illegal
   * transition â†’ RT_E_PHASE_ILLEGAL Â· unexpected engine throw â†’ RT_E_INTERNAL.
   */
  code?: ErrorCode;
  /**
   * 306 F5 â€” what ran Â· what it produced Â· what's next, machine-readable.
   * Present on every executed step (paused/advanced/completed); absent on
   * noop. Also stamped on `project.wildRun.lastStep` and (flattened) into the
   * `wild.step_*` telemetry payloads, so store, CLI, console and drivers read
   * the same truth.
   */
  summary?: WildStepSummary;
};

/** Reviewer seam (defaults to the deepseek-v4-flash Auto-Review classifier). */
export type WildReviewer = (ctx: WildReviewContext) => Promise<WildClassifierResult>;

/**
 * R13-f02 (W33 lane L2) â€” the ONE read accessor for `project.wildPlan`
 * (types.ts:170). Returns the STORED plan when the record carries one; else an
 * HONEST EMPTY plan (`steps: []`, `source: "empty"`, a note naming the owning
 * row) â€” never invented steps. Pure + client-safe: the store's read path
 * (`wildPlanFor`) and any renderer call this; the real generation lives
 * server-side (`headless.generateWildPlan` â†’ planning.planSteps, keyed hosts).
 */
export function readWildPlan(project: Project): WildPlan {
  const stored = project.wildPlan;
  if (stored && typeof stored === "object" && Array.isArray(stored.steps)) return stored;
  return {
    goal: typeof project.brief === "string" ? project.brief.trim() : "",
    steps: [],
    source: "empty",
    plannedAt: null,
    note:
      "no planner plan on this record yet (R13-f02: generation runs keyed at wild start â€” " +
      "headless.generateWildPlan; the run runs a classifier plan review and parks before the first mutation)",
  };
}

/**
 * Wild-step options (fixes/109 CAP-5, additive + purity-preserving). `opts`
 * today carries only the reviewer; `onEvent` is an OPTIONAL telemetry sink the
 * engine invokes with serializable RtEventSeed rows at the defined emission
 * points (step_start / step_ok / step_paused / step_error). Absent â‡’ zero
 * overhead, zero side effects â€” the engine never imports or calls a host sink
 * itself (DG-8).
 */
export type WildStepOptions = {
  reviewer?: WildReviewer;
  onEvent?: (seed: RtEventSeed) => void;
  /** W-01 (fixes/271 Â· Â§R1-f01): seam for the P6 execution edge â€” resolved by
   *  `wildExecEdgeFor` and shared with the seal's DoD-repair pass. Present â‡’
   *  phase 6 executes through THIS function (any key state). 316 H3: the
   *  headless wild loops (wildStartRun/wildStartHeadless) thread the
   *  production `runP6Edge` through this seam on keyed hosts, so the seal's
   *  ONE repair pass re-runs the SAME real edge instead of parking
   *  production-dead; keyless hosts thread nothing. Absent â‡’ the production
   *  guard (keyed â‡’ headless.runP6Edge, keyless â‡’ the deterministic floor,
   *  byte-identical to the pre-seam engine). */
  p6Edge?: (p: Project) => Promise<Project>;
  /** 312 C3: bound on ONE Auto-Review classifier decision (ms). A reviewer
   *  call that never settles resolves as a coded RT_E_LLM_TIMEOUT pause
   *  within this window instead of hanging the driver. Default
   *  `WILD_REVIEW_TIMEOUT_MS` (â‰¥ the provider's own per-call ceilings);
   *  test/dev seam â€” pass a small value to pin the bound. Non-finite/non-
   *  positive values fall back to the default (settle.ts normalizeMs). */
  reviewTimeoutMs?: number;
  /**
   * 313 D1 (312 C1 design) â€” the AGENT SEAL. `agentSeal: true` opts this run
   * into the sealed unattended policy for closures that would otherwise wait
   * on a human: gate approvals mint the coded classifier approver of record
   * (`[seat agent-seal]` + `decidedVia` = seatLabel("autopilot/agent-seal"),
   * NEVER a human seat), classifier REJECTS get the bounded retry below, and
   * hard-DoD reds get ONE repair pass before parking. Absent (the default) â‡’
   * every arm is byte-identical to the pre-seal engine â€” the seal is opt-in
   * consent, never a silent widening.
   */
  agentSeal?: boolean;
  /** 313 D1 â€” bounded classifier-REJECT retries under the seal (default
   *  `WILD_REVIEW_MAX_RETRIES` = 2). Only REJECT verdicts from the CLASSIFIER
   *  are re-asked (the deterministic DoD floor gives the same bytes, and a
   *  provider error is not a verdict) â€” after the bound the run parks with the
   *  last verdict as the recorded reason. Negative/NaN/non-numeric values
   *  clamp to 0 (= no retry) and positive fractions floor to an integer
   *  (1.9 â‡’ 1). Not capped above: this seam is programmatic-only (the CLI
   *  builds fixed opts, no flag), so the integer IS the caller's own bound
   *  (315 V2 finding #7). */
  maxReviewRetries?: number;
  /** 313 D1 â€” base backoff between reject retries (ms), doubling per attempt
   *  like `expandBriefWithBackoff` (500 â‡’ 500/1000/2000â€¦). Default
   *  `WILD_REVIEW_RETRY_BACKOFF_MS`; the test seam passes ~1 to keep pins fast. */
  retryBackoffMs?: number;
  /**
   * W62 Â· C1-07-class remediation â€” the DOCUMENTED, CODED, NON-HUMAN
   * "accept risk under seal" policy path. A classifier REJECT normally mints a
   * `forceHuman` gate the agent seal refuses, so a sealed run dead-ends until a
   * human decides. When (and only when) the calling MACHINE declares a
   * non-empty rule identifier here AND the run is under the seal, a persistent
   * classifier reject is instead recorded as a MACHINE risk acceptance
   * (`decidedBy:"autopilot"`, `[seat agent-seal]`, coded `wild.risk_accepted`)
   * and the step continues â€” never a human seat, never a silent bypass (the
   * gate's own DoD post-check still runs and can still block). Absent (the
   * default) â‡’ every reject arm is byte-identical to the pre-fix engine, so a
   * sealed run without a declared rule still parks honestly.
   */
  acceptRiskUnderSeal?: string;
  /** 346 P2-6 â€” per-step watchdog budget (ms) for the `boundedStepWatch` wrap
   *  of the phase-execution await. Default `WILD_STEP_BUDGET_MS` (the
   *  production tier-1 boundary, derived above the P6 phase max); the
   *  Â§5.2 tier-2 autopause boundary is exactly 2Ã— this value, matching the
   *  pure `shouldAutopause` decision. A small test value pins the wrap without
   *  waiting the production budget; non-finite/â‰¤0 falls back to the default. */
  stepBudgetMs?: number;
  /**
   * 346 K3 (console phase-run spend) â€” the caller's spend SINK. The engine
   * meters every model call it makes during a step into the process session
   * ledger (`recordSessionSpend` / codegen's `sessionTokenBudget().ledger`),
   * and this wrapper hands the caller the step's measured DELTA so a driver
   * (store `startWildRun`) can fold it into `Project.tokenUsage`. Called at
   * most once per step, and ONLY when the delta is non-zero â€” absent usage
   * never calls it, so a caller writes nothing (no fabricated zero). Pure
   * observation: the step's own bytes and behavior are identical with or
   * without a sink (DG-8), and an absent sink costs nothing.
   */
  onUsage?: (usage: TokenSpend) => void;
  /** 313 D1 â€” test seam for the P7 live-research edge (mirrors `p6Edge`).
   *  Present â‡’ phase 7 executes through THIS function in ANY key state; absent
   *  â‡’ the production guard (keyed â‡’ `wildLiveEdge` â€” the same live layer the
   *  sequential driver runs, with the documented `meta.liveUnavailable`
   *  waiver when live cannot run; keyless â‡’ the byte-identical floor). */
  liveEdge?: (p: Project) => Promise<Project>;
  /**
   * 347 â€” the GENERAL keyed execution edge for every phase other than 6 and 7.
   * Before this, `wildExecEdgeFor` wired keyed work ONLY at P6 (synthesis) and
   * P7 (live research); every other phase executed the deterministic floor on
   * every host, so a keyed Wild Mode run produced placeholder artifacts that
   * the Auto-Review classifier then rejected (a measured console run stalled at
   * P0). Present â‡’ those phases execute through THIS function in any key state;
   * absent â‡’ the byte-identical floor (the keyless contract). The console
   * driver injects the server-side live layer; keyless hosts inject nothing.
   */
  livePhaseEdge?: (phase: PhaseId, p: Project) => Promise<Project>;
  /** 313 D1 â€” seam for the ONE DoD-repair pass (also fired by the seal).
   *  Present â‡’ a hard-DoD red calls THIS instead of re-running the phase's own
   *  execution edge (test seam â€” 316 H3 made it CONSUMED; it was declared but
   *  read by nobody); return a repaired project whose exit gate is green, or
   *  `null` to keep the honest park. Absent â‡’ the production repair â€” the SAME
   *  edge the step executes through (`wildExecEdgeFor(phase, opts)`: the
   *  injected p6Edge the headless loops thread, else the keyed synthesis
   *  edge); a keyless/pure-floor phase parks honestly â€” a blind identical
   *  re-run is not a repair, B-07. */
  dodRepair?: (p: Project, phase: PhaseId) => Promise<Project | null>;
};

export function wildLog(p: Project, phase: PhaseId, level: JsonLog["level"], event: string, detail: string): Project {
  // 331 V3 (telemetry invariant): a ledger append must never throw into the run
  // it observes. A hand-built / foreign project may lack `logs`; the old
  // `[...p.logs, â€¦]` raised "p.logs is not iterable" â€” the same class the 330
  // wave fixed in knowledge.ts lessonLog. Guard to the empty list.
  const logs = Array.isArray(p?.logs) ? p.logs : [];
  return {
    ...p,
    logs: [...logs, { ts: Date.now(), phase, level, event, detail }].slice(-200),
  };
}

/** Stamp a wildRun patch; keeps `phase` in lockstep with the project edge. */
function wildPatch(p: Project, patch: Partial<NonNullable<Project["wildRun"]>>): Project {
  const cur: NonNullable<Project["wildRun"]> =
    p.wildRun ??
    {
      active: false,
      phase: p.currentPhase,
      startedAt: null,
      lastAutoLog: "",
      lastAutoAt: null,
      stoppedAt: null,
      pause: false,
    };
  return { ...p, wildRun: { ...cur, ...patch, phase: patch.phase ?? p.currentPhase } };
}

/**
 * 306 F5 â€” coded unlock class â†’ the ONE print-ready sentence carried by every
 * park (`WildParkInfo.unlockText`), so the console/CLI/agents never need their
 * own copy map (and cannot drift from each other).
 */
const WILD_UNLOCK_TEXT: Record<WildParkUnlock, string> = {
  "configure-key": "Configure the LLM key (DEEPSEEK_API_KEY) so Auto-Review can verdict, then resume the run.",
  "human-gate": "A human must approve or reject the open gate (console/CLI), then resume the run.",
  "human-retry": "A human decision is required (fix, regenerate or retry), then resume the run.",
  resume: "Resume the run to retry the step.",
  operator: "Inspect the run state, repair it, then resume the run.",
  // 313 D1: the sealed-run unlock â€” this park is a gate the AGENT SEAL could
  // not consent to (classifier not configured / not reachable on this host).
  // Unlike the plain keyless hint, the instruction names the seal: the run is
  // committed to classifier-consented approvals, so a bare key is what unlocks.
  "agent-seal":
    "The agent seal could not consent (keyed classifier unavailable) â€” configure the classifier (DEEPSEEK_API_KEY), then resume the sealed run.",
};

/** GAP-1 surface fix (fixes/320_g1b_review_park.md â€” 319 FINDING-3b): the
 *  park record's `reason` and `wildRun.lastAutoLog` used to cut at 200/300
 *  chars mid-word, so console/CLI readers never saw the classifier's full
 *  required-fixes list (the ledger row IS full â€” only the surfaces were cut).
 *  Cap = 600 chars + an explicit ellipsis when a cut actually happened
 *  (â‰¤ 601 chars emitted; a short detail passes through byte-identically;
 *  clipping an already-clipped string is idempotent). */
const SURFACE_CAP = 600;
function clipSurface(detail: string): string {
  return detail.length > SURFACE_CAP ? `${detail.slice(0, SURFACE_CAP)}â€¦` : detail;
}

/**
 * 306 F5 â€” what the next wild step would do at `phase`, derived from the
 * project's OWN status/records (never from a previous result). This is the ONE
 * re-entry truth parks and summaries advertise: "park" = the next call pauses
 * again (locked/rejected edges need a human/repair first); "none" = terminal.
 */
function wildNextActionAt(p: Project, phase: number): WildNextAction {
  if (p.status === "complete") return "none";
  const rec = (p.phases ?? []).find((r) => r.id === phase);
  if (!rec) return "none";
  if (rec.status === "awaiting_hitl" || p.hitl?.phase === phase) return "gate";
  if (rec.status === "complete") return phase === PHASE_LAST ? "finalize" : "advance";
  if (rec.status === "ready" || rec.status === "running") return "execute";
  return "park";
}

/** 306 F5 â€” the re-entry edge of the run's current cursor (see wildNextActionAt). */
export function wildNextEdgeOf(p: Project): { phase: number; action: WildNextAction } {
  return { phase: p.currentPhase, action: wildNextActionAt(p, p.currentPhase) };
}

/** 306 F5 â€” build the park record stamped on `wildRun.park` (WHY coded Â· WHAT
 *  UNLOCKS Â· WHERE a resume re-enters). `phase` is the paused edge. */
function wildParkInfo(
  p: Project,
  phase: PhaseId,
  event: string | null,
  detail: string,
  park: { code: ErrorCode | null; unlock: WildParkUnlock },
): WildParkInfo {
  return {
    code: park.code,
    event,
    reason: clipSurface(detail),
    unlock: park.unlock,
    unlockText: WILD_UNLOCK_TEXT[park.unlock],
    resumePhase: phase,
    resumeAction: wildNextActionAt(p, phase),
    at: Date.now(),
  };
}

/** 306 F5 â€” the park record for an OPERATOR pause (console toggle / CLI pause):
 *  uncoded (code/event null) but it still says what unlocks (resume) and where a
 *  resume re-enters, so EVERY paused state answers why/what/where uniformly. */
export function wildOperatorPark(p: Project, detail: string): WildParkInfo {
  return wildParkInfo(p, p.currentPhase, null, detail, { code: null, unlock: "resume" });
}

/**
 * Pause the run (pause:true, active stays true) + ledger entry.
 *
 * 306 F5: every pause stamps the machine-readable `park` record â€” WHY (coded) Â·
 * WHAT UNLOCKS Â· WHERE a resume re-enters â€” so a parked run is drivable from the
 * persisted record instead of prose. Pass `park` on every coded pause (engine
 * arms); omitted â‡’ an uncoded park cleared to null (the operator-pause paths
 * stamp their own record via wildOperatorPark).
 */
export function wildPause(
  p: Project,
  phase: PhaseId,
  level: JsonLog["level"],
  event: string,
  detail: string,
  park?: { code: ErrorCode | null; unlock: WildParkUnlock } | null,
): Project {
  const info = park ? wildParkInfo(p, phase, event, detail, park) : null;
  const stamped = wildPatch(p, {
    pause: true,
    park: info,
    lastAutoLog: clipSurface(detail),
    lastAutoAt: Date.now(),
  });
  return wildLog(stamped, phase, level, event, detail);
}

/** 316 H3 (313 D1 seam table; 315 V2 finding #1): the ONE resolution of a
 *  phase's execution edge â€” shared by the execute site (wildStep) AND the
 *  seal's repair pass, so the two can never drift again. The drift WAS the
 *  finding: the execute site resolved the keyed production edge
 *  (`opts.p6Edge ?? keyed â‡’ wildP6Edge`), the repair read `opts.p6Edge` only
 *  â€” and no production caller passes it, so the repair was production-dead.
 *  Resolution: an injected `opts.p6Edge` wins in ANY key state (the seam
 *  contract â€” the headless wild loops thread the production `runP6Edge`
 *  through it, 316 H3); else the keyed production edge (`wildP6Edge`, the
 *  same headless.runP6Edge seam run/gate use); keyless/browser â‡’ null (the
 *  byte-identical deterministic floor). Exported for the keyless selection
 *  pin (a keyed pin only checks the SELECTION â€” never invokes it). P7's live
 *  arm is H1's lane (316_h1_p7.md): extended HERE (the phase===7 arm below),
 *  not at a second site. */
export function wildExecEdgeFor(
  phase: PhaseId,
  opts: WildStepOptions | undefined,
): ((p: Project) => Promise<Project>) | null {
  if (phase === 7) {
    // 316 H1: the P7 live arm â€” the injected `liveEdge` seam wins in ANY key
    // state (the seam contract); else the keyed production live edge
    // (`wildLiveEdge` â€” the SAME live layer the sequential driver runs, with
    // the documented meta.liveUnavailable waiver inside it); keyless/browser
    // â‡’ null (the byte-identical deterministic floor, the keyless contract).
    if (typeof opts?.liveEdge === "function") return opts.liveEdge;
    return keyedDeepSeekConfigured() ? wildLiveEdge : null;
  }
  if (phase !== 6) return null;
  if (typeof opts?.p6Edge === "function") return opts.p6Edge;
  return keyedDeepSeekConfigured() ? wildP6Edge : null;
}

/**
 * 347 â€” the general keyed execution edge for phases OTHER than 6 and 7. Kept
 * separate from {@link wildExecEdgeFor} so the P6/P7 selection pins stay
 * byte-identical: this arm only answers for the phases that had NO keyed edge
 * before, and only when a caller explicitly injected one.
 */
export function wildGeneralExecEdgeFor(
  phase: PhaseId,
  opts: WildStepOptions | undefined,
): ((p: Project) => Promise<Project>) | null {
  if (phase === 6 || phase === 7) return null;
  const edge = opts?.livePhaseEdge;
  if (typeof edge !== "function") return null;
  return (p: Project) => edge(phase, p);
}

/** 313 D1: the seal's ONE DoD-repair pass (both call sites: wildApproveGate
 *  post-approval / wildLeavePhase advance). Re-runs the phase's NON-FLOOR
 *  execution edge exactly once so a spurious red that a fresh attempt clears
 *  does not park an unattended run. Edge resolution (316 H3, seam table):
 *  the injected `opts.dodRepair` seam first (finding #2 â€” declared, consumed
 *  by nobody until now); else the SAME edge the step itself executes through
 *  (`wildExecEdgeFor`) â€” so a real sealed run repairs through its REAL edge
 *  (keyed P6 synthesis; a keyless/pure-floor phase returns an honest null â€”
 *  a blind identical re-run is not a repair, B-07). Never fabricates: the
 *  re-run's REAL gate verdict decides. */
async function wildDodRepairOnce(
  project: Project,
  phase: PhaseId,
  opts: WildStepOptions | undefined,
): Promise<{ repaired: Project | null; detail: string }> {
  const seam = typeof opts?.dodRepair === "function" ? opts.dodRepair : null;
  // 316 H3 fix-up: keep the picker's own 1-arg type (the union with the
  // 2-arg seam confused the call-site check) â€” narrowed below.
  const edge = seam === null ? (wildExecEdgeFor(phase, opts) ?? wildGeneralExecEdgeFor(phase, opts)) : null;
  if (seam === null && edge === null) {
    return { repaired: null, detail: `no non-floor repair edge for P${phase} â€” honest park` };
  }
  try {
    const after =
      seam !== null
        ? await seam(project, phase)
        : typeof edge === "function"
          ? await edge(project)
          : null;
    if (after === null) {
      return { repaired: null, detail: `repair seam declined P${phase} â€” honest park` };
    }
    const g = runGate(after, phase);
    return g.pass
      ? { repaired: after, detail: "repair pass re-ran the edge; gate cleared" }
      : { repaired: null, detail: "repair pass re-ran the edge; gate still red" };
  } catch (err) {
    return {
      repaired: null,
      detail: `repair pass failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** runGate output in the serializable shape the classifier consumes. */
function wildGateInfo(
  project: Project,
  phase: PhaseId,
): { pass: boolean; unmet: { id: string; criterion: string }[]; evidenceHash: string } {
  const r = runGate(project, phase);
  return {
    pass: r.pass,
    unmet: r.unmet.map((g) => ({ id: g.id, criterion: g.criterion })),
    evidenceHash: r.evidenceHash,
  };
}

/** Context for one review decision (shared by classifier + DoD floor). */
function wildReviewCtx(
  project: Project,
  phase: PhaseId,
  reason: "advance" | "gate",
  mode?: "phase" | "plan",
): WildReviewContext {
  return { project, phase, reason, ...(mode ? { mode } : {}), gate: wildGateInfo(project, phase) };
}

/**
 * 312 C3: the default bound on ONE Auto-Review classifier decision (ms). The
 * reviewer can only legitimately take about one provider call (20 s flash /
 * 60 s pro per-call ceilings); this window sits above that with slack and
 * exists to convert a reviewer promise that NEVER settles into a coded
 * RT_E_LLM_TIMEOUT pause instead of a hung driver. Override per step with
 * `WildStepOptions.reviewTimeoutMs` (test/dev seam).
 */
export const WILD_REVIEW_TIMEOUT_MS = 120_000;

/**
 * 313 D1 (312 C1 design) â€” the bounded classifier-REJECT retry defaults. A
 * single reject verdict from one classifier sample is the difference between a
 * completed unattended run and a human wake-up, so under the agent seal the
 * SAME classifier is re-asked on the same context up to N extra times with
 * exponential backoff (expandBriefWithBackoff's shape: base 500 ms, doubling
 * per attempt). N=2 retries â‡’ at most 3 classifier calls on a persistent
 * reject, then the honest park â€” the bound makes "flaky verdict" survivable
 * without turning "the phase is bad" into a loop. These are ALSO the values a
 * caller may override per step (`maxReviewRetries` / `retryBackoffMs`).
 */
export const WILD_REVIEW_MAX_RETRIES = 2;
export const WILD_REVIEW_RETRY_BACKOFF_MS = 500;

/**
 * The honest reviewer used when no real classifier can be resolved (keyless
 * host, or a denied host whose server reports no key / no transport): not-
 * configured maps to the engine's existing deterministic paths â€” advance
 * decisions use the DoD floor, an OPEN GATE pauses with
 * RT_E_LLM_NOT_CONFIGURED. Never fabricates a verdict. (A keyed browser host
 * resolves the server-side classifier via `createHostWildReviewer` instead.)
 */
const unavailableWildReviewer: WildReviewer = async () => ({ ok: false, reason: "not-configured" });

/**
 * 312 C3 (CF-SE2-1) â€” resolve the reviewer for one step WITHOUT ever trusting
 * a denied specifier:
 *   - a caller-provided reviewer is used only when it passes
 *     `isTrustedCallable` (the import-protection mock's callable proxies â€”
 *     whose `.name` is not a string â€” are REFUSED, never called or awaited);
 *   - otherwise the default `wild-mode.server.ts` reviewer is imported ONLY on
 *     a bare-Node host. Elsewhere the specifier IS the import-protection mock,
 *     and an await on it starves the event loop forever (measured) â€” so the
 *     client-safe seam (`wild-review.ts` `createHostWildReviewer`) is used
 *     instead: on a browser host it builds a REAL classifier over
 *     `wild-bridge.ts`'s createServerFn (the server's keyed
 *     `wildClassifierReview` on llm.ts's server-fn complete()/llmStatus()), and
 *     returns null keyless / transport-less so the honest unavailable reviewer
 *     still applies;
 *   - the resolved module export is trust-checked the same way before use.
 * Every branch returns a REAL callable; the caller can never receive a proxy.
 */
async function resolveWildReviewer(provided?: WildReviewer): Promise<WildReviewer> {
  if (provided !== undefined && isTrustedCallable(provided)) return provided;
  if (isBareNodeHost()) {
    try {
      const spec = clientSafeServerSpecifier("wild-mode");
      const mod = (await import(spec)) as { wildClassifierReview?: unknown };
      const candidate = mod?.wildClassifierReview;
      return isTrustedCallable(candidate) ? (candidate as WildReviewer) : unavailableWildReviewer;
    } catch {
      // Missing provider module / load failure â€” the honest unavailable reviewer
      // (not-configured), never a fabricated or proxy verdict.
      return unavailableWildReviewer;
    }
  }
  // 2026-10-05 (wild-console-classifier fix): a DENIED host (the browser) can
  // still reach the server's keyed classifier through the client-safe seam â€”
  // the mock proxy is never awaited. Keyless / transport-less â‡’ null â‡’ the
  // honest unavailable reviewer, byte-for-byte the pre-fix not-configured path.
  try {
    const { createHostWildReviewer } = await import("./wild-review.ts");
    const reviewer = await createHostWildReviewer();
    return isTrustedCallable(reviewer) ? (reviewer as WildReviewer) : unavailableWildReviewer;
  } catch {
    return unavailableWildReviewer;
  }
}

/** 313 D1: the resolved shape of ONE review decision (extracted so the
 *  bounded-retry wrapper and the plain resolver share it verbatim). */
type WildReviewDecision =
  | { kind: "verdict"; verdict: "approve" | "reject"; feedback: string; source: "classifier" | "dod" }
  | { kind: "unconfigured-gate" }
  | { kind: "error"; error: string; code?: "RT_E_LLM_TIMEOUT" };

/**
 * Resolve the reviewer for one decision. Classifier ok â†’ its verdict verbatim.
 * Classifier not-configured â†’ deterministic DoD floor verdict for advance
 * decisions (approve iff runGate passes); for an OPEN GATE the loop must not
 * fabricate a judgment, so the caller pauses instead (returns null).
 * Classifier error / too-short feedback â†’ honest error, never a guessed verdict.
 * Classifier call that never settles â†’ coded `RT_E_LLM_TIMEOUT` error at the
 * bound (312 C3) â€” a hang is a classified failure, never an infinite await.
 */
async function resolveWildReview(
  reviewer: WildReviewer,
  project: Project,
  phase: PhaseId,
  reason: "advance" | "gate",
  timeoutMs: number = WILD_REVIEW_TIMEOUT_MS,
  mode?: "phase" | "plan",
): Promise<WildReviewDecision> {
  const ctx = wildReviewCtx(project, phase, reason, mode);
  let called: PromiseLike<WildClassifierResult> | WildClassifierResult;
  try {
    called = reviewer(ctx);
  } catch (err) {
    // Synchronous reviewer throw â€” preserved exactly as before (an honest
    // error verdict, never a lost step).
    return { kind: "error", error: err instanceof Error ? err.message : String(err) };
  }
  const settled = await settleWithin(called, timeoutMs);
  if (!settled.ok) {
    const why = settled.timedOut
      ? `Auto-Review timed out after ${settled.ms}ms â€” the classifier call never settled`
      : settled.error instanceof Error
        ? settled.error.message
        : String(settled.error);
    return { kind: "error", error: why, ...(settled.timedOut ? { code: "RT_E_LLM_TIMEOUT" as const } : {}) };
  }
  const res: WildClassifierResult = settled.value;
  if (res.ok) {
    // Engine-side honesty floor (defense in depth): never log a "review" that
    // cannot meet the 12-char feedback contract the ledger promises.
    if (res.feedback.trim().length < 12) {
      return {
        kind: "error",
        error: `Auto-Review feedback too short (${res.feedback.trim().length} chars) to log honestly`,
      };
    }
    return { kind: "verdict", verdict: res.verdict, feedback: res.feedback.trim(), source: "classifier" };
  }
  if (res.reason === "not-configured") {
    if (reason === "gate") return { kind: "unconfigured-gate" };
    // Deterministic DoD floor: without a classifier the machine judgment IS the
    // machine-checkable gate â€” no fabricated qualitative review.
    const g = runGate(project, phase);
    if (g.pass) {
      return {
        kind: "verdict",
        verdict: "approve",
        feedback: `Deterministic DoD review: all P${phase} criteria met (${g.evidenceHash.slice(0, 8)}).`,
        source: "dod",
      };
    }
    return {
      kind: "verdict",
      verdict: "reject",
      feedback: `Deterministic DoD review: P${phase} unmet â€” ${g.unmet.map((x) => x.id).join(", ") || "unknown criteria"}.`,
      source: "dod",
    };
  }
  return { kind: "error", error: res.error ?? "Auto-Review classifier failed" };
}

/**
 * R13-f02 â€” the PLAN review: hand the stored planner rows to the Auto-Review
 * reviewer seam BEFORE the first mutation. Routes through the SAME timeout and
 * honesty checks as a phase review, but as a `"gate"` review, so a plan verdict
 * can only come from the classifier â€” never the deterministic DoD floor (an
 * "advance"-only fallback), i.e. a machine-synthesized approval of rows no
 * model judged is impossible.
 *
 * The reviewer receives the review context, whose `project.wildPlan` IS the
 * plan under review. The production prompt (`buildWildReviewPrompt`,
 * wild-mode.server.ts) renders the stored planner rows (one line per row, cap
 * + named elision), so the production classifier SEES them; the injected
 * reviewer seam reads the rows directly from the context too.
 *
 * Unconfigured / error / timeout return honestly; the CALLER (headless) still
 * parks the run, because an unreviewed plan must not execute.
 */
export type WildPlanReview =
  | { ok: true; verdict: "approve" | "reject"; feedback: string }
  | { ok: false; reason: "not-configured" | "error"; error: string; code?: ErrorCode };

export async function reviewWildPlan(
  project: Project,
  reviewer: WildReviewer,
  timeoutMs: number = WILD_REVIEW_TIMEOUT_MS,
): Promise<WildPlanReview> {
  // 347: a PLAN review is judged on the rows alone (mode "plan"), never against
  // the pre-execution phase's empty artifact list / unmet DoD.
  const decision = await resolveWildReview(reviewer, project, project.currentPhase, "gate", timeoutMs, "plan");
  if (decision.kind === "verdict") {
    return { ok: true, verdict: decision.verdict, feedback: decision.feedback };
  }
  if (decision.kind === "unconfigured-gate") {
    return { ok: false, reason: "not-configured", error: "Auto-Review classifier not configured", code: "RT_E_LLM_NOT_CONFIGURED" };
  }
  return { ok: false, reason: "error", error: decision.error, ...(decision.code ? { code: decision.code } : {}) };
}

/**
 * R13-f02 â€” review the planner rows and PARK before the first mutation.
 *
 * The ONE staging site for both real wild drivers (headless `wildStartRun`/
 * `wildStartHeadless` and the console store's `startWildRun`). It lives in
 * engine.ts â€” not headless.ts â€” because the console driver is client-safe and
 * cannot import headless (node:fs). When the record carries a real planner plan
 * with no `wild.plan_review` row yet, the rows are judged through the
 * injectable Auto-Review reviewer seam (`reviewWildPlan`) and the run parks â€”
 * `wildRun.pause` + a park record + the `wild.plan_review` / `wild.paused_plan`
 * ledger rows â€” BEFORE any step can mutate. The pause IS the "no execution
 * without an approved plan" gate; a human resume executes it. `staged:true`
 * tells the caller to stop before its loop. Idempotent: once the review row
 * exists the stored plan is never re-reviewed (a resume proceeds).
 *
 * `reviewer === null` (keyless host / browser) still parks with an honest
 * "not configured" review row â€” an unreviewed plan never executes.
 */
/** The verdict recorded by the LAST `wild.plan_review` row, read from the
 *  engine-owned row format `stageWildPlan` writes (see `headless.planReviewApproved`
 *  for the driver-side reader). Null when no review row exists yet. */
function planReviewVerdictOf(project: Project): "approve" | "reject" | "park" | null {
  const rows = (project.logs ?? []).filter((r) => r?.event === "wild.plan_review");
  const last = rows[rows.length - 1];
  if (!last) return null;
  const detail = typeof last.detail === "string" ? last.detail : "";
  if (/review \(classifier\):\s*approve\b/.test(detail)) return "approve";
  if (/review \(classifier\):\s*reject\b/.test(detail)) return "reject";
  return "park";
}

export async function stageWildPlan(
  project: Project,
  reviewer: WildReviewer | null,
  opts?: {
    /**
     * 347: under the AGENT SEAL a classifier-APPROVED plan is machine-consented
     * consent, so the review park is not stamped and the run proceeds. This is
     * the console Wild Mode contract (zero human approval); every other caller
     * (absent/`false`) keeps the pre-347 park byte-identically, so the R13-f02
     * pins are untouched. A reject / unconfigured / errored review ALWAYS parks
     * â€” the seal never invents an approval.
     */
    agentSeal?: boolean;
  },
): Promise<{ project: Project; staged: boolean }> {
  const plan = project.wildPlan;
  if (!plan || plan.source !== "planner" || !Array.isArray(plan.steps) || plan.steps.length === 0) {
    return { project, staged: false };
  }
  const phase = project.currentPhase;
  // Idempotence is keyed on the VERDICT, not the row's PRESENCE. A prior
  // `wild.plan_review` row that is anything but an APPROVAL means the plan did
  // not execute; a resume must re-park instead of executing the rejected plan
  // (pre-fix: presence alone returned staged:false, so a resume after a REJECT
  // executed the rejected plan without any review).
  const priorVerdict = planReviewVerdictOf(project);
  if (priorVerdict === "approve") return { project, staged: false };
  if (priorVerdict !== null) {
    const reparked = wildPause(
      project,
      phase,
      "warn",
      "wild.paused_plan",
      `wild.plan (${plan.steps.length} row(s)) carries a prior review verdict "${priorVerdict}" â€” ` +
        `an unapproved plan never executes on resume. Fix or replace the plan, then resume (R13-f02).`,
      { code: "RT_E_GATE_PENDING", unlock: "human-gate" },
    );
    return { project: reparked, staged: true };
  }
  let reviewed: Project;
  let approved = false;
  if (reviewer === null) {
    reviewed = wildLog(
      project,
      phase,
      "warn",
      "wild.plan_review",
      `wild.plan (${plan.steps.length} row(s)) could not be reviewed â€” Auto-Review classifier not configured; parked for human review (R13-f02).`,
    );
  } else {
    const verdict = await reviewWildPlan(project, reviewer);
    approved = verdict.ok && verdict.verdict === "approve";
    reviewed = verdict.ok
      ? wildLog(
          project,
          phase,
          "info",
          "wild.plan_review",
          `wild.plan (${plan.steps.length} row(s)) review (classifier): ${verdict.verdict} â€” ${verdict.feedback.slice(0, 300)}`,
        )
      : wildLog(
          project,
          phase,
          "warn",
          "wild.plan_review",
          `wild.plan (${plan.steps.length} row(s)) review failed (${verdict.reason}): ${verdict.error.slice(0, 300)} â€” parked for human review (R13-f02).`,
        );
  }
  // 347 (console zero-human Wild Mode): under the agent seal a classifier
  // APPROVE is the consent of record â€” execute instead of parking. The row
  // above is the evidence; only the park is withheld.
  if (opts?.agentSeal === true && approved) {
    return {
      project: wildLog(
        reviewed,
        phase,
        "info",
        "wild.plan_approved",
        `wild.plan (${plan.steps.length} row(s)) approved by the classifier under the agent seal â€” executing without a human gate (347).`,
      ),
      staged: false,
    };
  }
  const parked = wildPause(
    reviewed,
    phase,
    "warn",
    "wild.paused_plan",
    `wild.plan reviewed; execution parked before the first mutation â€” ${plan.steps.length} row(s). Approve to execute (R13-f02).`,
    { code: "RT_E_GATE_PENDING", unlock: "human-gate" },
  );
  return { project: parked, staged: true };
}

/** 313 D1 â€” clamp a caller-supplied retry bound: absent â‡’ the default
 *  (`WILD_REVIEW_MAX_RETRIES`); a finite number â‰¥ 0 floors to an integer
 *  bound (0 = no retry, exactly the plain resolver); negative/NaN/non-numeric
 *  â‡’ 0. Deliberately not capped above â€” programmatic seam only (the CLI never
 *  passes it), so the bound IS the caller's own choice (315 V2 finding #7). */
function normalizeReviewRetries(v: unknown): number {
  if (v === undefined) return WILD_REVIEW_MAX_RETRIES;
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

/** 313 D1 â€” clamp a caller-supplied backoff: finite positive ms are capped at
 *  60 s per wait (a hostile value can delay, never wedge); anything else uses
 *  the default base. */
function normalizeReviewBackoff(v: unknown): number {
  if (v === undefined) return WILD_REVIEW_RETRY_BACKOFF_MS;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.min(v, 60_000) : WILD_REVIEW_RETRY_BACKOFF_MS;
}

/**
 * 313 D1 (312 C1 design) â€” the bounded classifier-REJECT retry, used by the
 * agent-seal arms of `wildApproveGate`/`wildLeavePhase` (expandBriefWithBackoff's
 * shape, engine side). The SAME classifier is re-asked on the SAME context up
 * to `maxReviewRetries` (default 2) extra times with exponential backoff â€”
 * because one reject verdict from a single classifier sample is exactly the
 * difference between a completed unattended run and a human wake-up.
 *
 * Retryable = a REJECT verdict whose source is the CLASSIFIER. Everything else
 * returns immediately, honestly:
 *   Â· approve / unconfigured-gate / error â†’ not a reject, no blind re-run;
 *   Â· a DoD-floor reject â†’ deterministic (same bytes re-asked give the same
 *     verdict) â€” re-running it would be theatre, never evidence.
 * Every retry lands ONE `wild.review_retry` warn row on the returned project
 * (the ledger shows the exact attempt count), and a persistent reject parks
 * after the bound with the LAST verdict's feedback as the recorded reason.
 * Returns the decision AND the (row-carrying) project so callers thread both.
 */
async function resolveWildReviewBounded(
  reviewer: WildReviewer,
  project: Project,
  phase: PhaseId,
  reason: "advance" | "gate",
  opts?: WildStepOptions,
): Promise<{ decision: WildReviewDecision; project: Project }> {
  const retries = normalizeReviewRetries(opts?.maxReviewRetries);
  const backoff = normalizeReviewBackoff(opts?.retryBackoffMs);
  let p = project;
  for (let attempt = 0; ; attempt += 1) {
    const decision = await resolveWildReview(reviewer, p, phase, reason, opts?.reviewTimeoutMs);
    const retryable =
      decision.kind === "verdict" && decision.verdict === "reject" && decision.source === "classifier";
    if (!retryable || attempt >= retries) return { decision, project: p };
    const wait = backoff * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, wait));
    p = wildLog(
      p,
      phase,
      "warn",
      "wild.review_retry",
      `P${phase} review REJECTED (classifier) â€” retry ${attempt + 1}/${retries} after ${wait}ms backoff.`,
    );
  }
}

/** Record the review verdict on the ledger (feedback verbatim, >= 12 chars). */
function wildReviewLog(p: Project, phase: PhaseId, source: string, feedback: string): Project {
  return wildLog(p, phase, "info", "wild.review", `P${phase} review (${source}): ${feedback}`);
}

/** GAP-1 (fixes/320_g1b_review_park.md â€” 319 FINDING-2): a CLASSIFIER review
 *  reject parks the run under a park that already advertises
 *  unlock:"human-gate" + "A human must approve or reject the open gate
 *  (console/CLI), then resume the run." â€” but before this helper `hitl` stayed
 *  null, so CLI approve refused ("No pending gateâ€¦"), reject refused, and a
 *  resume re-reviewed â†’ re-rejected: the promised human door did not exist.
 *  The mint makes the park true: the project and the phase record enter
 *  `awaiting_hitl` (the status both CLI quick-fail gates test â€”
 *  rapidtool-cli.mjs:930/:1077) and a forceHuman gate carries the FULL
 *  critique as its prompt.
 *
 *  forceHuman is the load-bearing honesty: `approveHitl` throws for autopilot
 *  (R3/B-03) and `wildApproveGate` refuses a forceHuman gate under the seal
 *  too â€” machine seats can never clear this gate. A human approve completes
 *  the phase and moves the cursor; a human reject-with-note records
 *  `rejectionHistory` and reopens the retry edge. Mint â‰  auto-advance: the
 *  caller still parks, and a machine resume re-enters the gate arm which
 *  refuses again (no silent bypass, no re-review spend).
 *
 *  Called ONLY from the two classifier-reject arms; a DoD-floor reject
 *  (source "dod") never mints â€” the caller guards it. */
function mintReviewGatePark(p: Project, phase: PhaseId, feedback: string): Project {
  const phases = p.phases.map((r) =>
    r.id === phase ? { ...r, status: "awaiting_hitl" as const } : r,
  );
  const hitl: HitlRequest = {
    phase,
    title: "Review rejected â€” accept the risk or reject with a note",
    prompt: feedback,
    stakes:
      "The Auto-Review classifier refused this phase â€” approve to accept the risk and continue, or reject with a note to send the phase back for repair.",
    forceHuman: true,
    requestedAt: Date.now(),
  };
  return { ...p, phases, status: "awaiting_hitl", hitl };
}

/** Approve an open approval gate (classifier self-approval), with checks.
 *
 *  313 D1 (312 C1 design) â€” the AGENT SEAL arms. `opts.agentSeal === true`
 *  opts this step into the sealed unattended policy: the review resolves
 *  through the bounded reject-retry, every approval mints the coded classifier
 *  approver of record ([seat agent-seal] + decidedVia â€” never a human seat),
 *  a classifier that cannot consent stamps the seal unlock class on its park,
 *  and ONE DoD-repair pass runs before a hard-DoD park. Absent â‡’ every branch
 *  below is byte-identical to the pre-seal engine.
 */
async function wildApproveGate(
  p: Project,
  phase: PhaseId,
  reviewer: WildReviewer,
  opts?: WildStepOptions,
): Promise<WildStepResult> {
  const seal = opts?.agentSeal === true;
  const gate = p.hitl;
  if (!gate || gate.phase !== phase) {
    const paused = wildPause(p, phase, "error", "wild.error", `P${phase} approval gate mismatch â€” wild run paused.`);
    return { project: paused, outcome: "paused", ran: true, error: "Approval gate mismatch.", code: "RT_E_PHASE_ILLEGAL" };
  }
  // R3/B-03 parity: a human-only gate (failed P6 sandbox, P0 reframe) is never
  // machine-approved â€” Wild Mode pauses and asks the human. 313 D1: this stays
  // true UNDER THE SEAL (C1's recorded reason, fixes/312 Â§S2): opening a
  // forceHuman gate would need an `autopilot.force` policy rule, which would
  // equally open the CLI `approve --force` door â€” the seal must not widen it.
  // The sealed row below names that precise reason; the park stays human-gated.
  if (gate.forceHuman) {
    const detail = seal
      ? `P${phase} gate is human-only (forceHuman) â€” the agent seal refuses it (R3/B-03): opening it would need an autopilot.force policy rule that would also open the CLI 'approve --force' door. A human must decide.`
      : `P${phase} gate is human-only (forceHuman) â€” Wild Mode cannot self-approve it.`;
    const paused = wildPause(p, phase, "warn", "wild.paused_human", detail);
    return { project: paused, outcome: "paused", ran: true, error: `P${phase} is a human-only gate.`, code: "RT_E_GATE_PENDING" };
  }
  // H2 (fixes/316_h2_policy.md Â· RS-03): the F4 per-action policy overlay is
  // consulted BEFORE any machine self-approval â€” the project's list may narrow
  // what its gates permit. Narrow-only by construction (policy.ts): it can
  // refuse this action, never widen the seat rule above; a malformed list
  // fail-closes through the refusal's own 'unreadable' branch, and an absent
  // list returns null â€” byte-identical pre-H2 behavior. Placed before the
  // classifier so a refused action never spends a review call; consulted under
  // the seal too (the list narrows the sealed policy; nothing here widens it).
  const policyRefusal = policyOverlayRefusal(
    (p as { wildPolicy?: unknown }).wildPolicy,
    "hitl.approve",
    `gate:P${phase}`,
  );
  if (policyRefusal !== null) {
    // RS-03(c): the refusal gets its registered event â€” one wildPause ledger
    // row + one rt seed, both named wild.paused_policy, both carrying the
    // overlay's OWN reason (its coded value + its detail). Unlock maps the
    // refusal's own semantics: alwaysAsk needs an explicit human decision
    // (human-gate); every hard refusal needs the list fixed first
    // (human-retry) â€” a classifier retry cannot un-refuse it.
    const unlock: WildParkUnlock = policyRefusal.rule === "alwaysAsk" ? "human-gate" : "human-retry";
    const detail = `P${phase} approval gate refused by this project's per-action policy list â€” ${policyRefusal.code}: ${policyRefusal.detail}`;
    opts?.onEvent?.({
      level: "warn",
      scope: "wild-step",
      event: "wild.paused_policy",
      message: detail,
      capture: "src/lib/engine.ts:wildApproveGate",
      code: "RT_E_GATE_PENDING",
      phase,
      projectId: p.id,
      runRef:
        p.wildRun?.startedAt !== null && p.wildRun?.startedAt !== undefined ? String(p.wildRun.startedAt) : null,
      payload: { policyCode: policyRefusal.code, rule: policyRefusal.rule, action: policyRefusal.action },
    });
    const paused = wildPause(p, phase, "warn", "wild.paused_policy", detail, {
      code: "RT_E_GATE_PENDING",
      unlock,
    });
    return { project: paused, outcome: "paused", ran: true, error: detail, code: "RT_E_GATE_PENDING" };
  }
  const resolved = seal
    ? await resolveWildReviewBounded(reviewer, p, phase, "gate", opts)
    : { decision: await resolveWildReview(reviewer, p, phase, "gate", opts?.reviewTimeoutMs), project: p };
  const decision = resolved.decision;
  const working = resolved.project;
  if (decision.kind === "unconfigured-gate") {
    const paused = wildPause(
      working,
      phase,
      "warn",
      "wild.paused_classifier",
      `Auto-Review classifier not configured â€” P${phase} approval gate cannot be self-approved.`,
      // 313 D1: under the seal this pause carries its OWN unlock class â€” the
      // run is committed to classifier-consented approvals, so the keyed
      // classifier is what unlocks it (never a silent bare resume).
      seal ? { code: "RT_E_LLM_NOT_CONFIGURED", unlock: "agent-seal" } : null,
    );
    return { project: paused, outcome: "paused", ran: true, error: "Classifier not configured.", code: "RT_E_LLM_NOT_CONFIGURED" };
  }
  if (decision.kind === "error") {
    const paused = wildPause(working, phase, "error", "wild.error", `P${phase} Auto-Review failed: ${decision.error}`);
    return { project: paused, outcome: "paused", ran: true, error: decision.error, code: decision.code ?? "RT_E_LLM_REJECTED" };
  }
  const next = wildReviewLog(working, phase, decision.source, decision.feedback);
  const acceptRiskRule =
    seal && typeof opts?.acceptRiskUnderSeal === "string" && opts.acceptRiskUnderSeal.trim() !== ""
      ? opts.acceptRiskUnderSeal.trim()
      : null;
  let approvalNote = decision.feedback.slice(0, 400);
  let reviewBase = next;
  if (decision.verdict === "reject") {
    // W62 Â· C1-07-class remediation â€” the documented accept-risk-under-seal
    // path (option a): a MACHINE-declared rule lets a persistent classifier
    // reject be overridden by a recorded machine risk acceptance instead of the
    // forceHuman dead-end. No human seat is ever minted; the DoD post-check
    // below still runs and can still block. No rule â‡’ the pre-fix park.
    if (acceptRiskRule !== null) {
      reviewBase = wildLog(
        next,
        phase,
        "warn",
        "wild.risk_accepted",
        `P${phase} classifier REJECT overridden by the sealed ACCEPT-RISK policy (rule: ${acceptRiskRule}) â€” ` +
          `a MACHINE risk acceptance (decidedBy:autopilot); no human seat minted.`,
      );
      approvalNote = `ACCEPTED RISK under seal (rule: ${acceptRiskRule}). Classifier reject: ${decision.feedback}`.slice(0, 400);
    } else {
      // GAP-1 (fixes/320_g1b_review_park.md): this arm is definitionally a
      // CLASSIFIER reject (the deterministic DoD floor never judges gates â€”
      // resolveWildReview returns unconfigured-gate/error for the other
      // classes), so the mint is unconditional here: the human decision gate
      // the park's unlockText promises now exists.
      const gated = mintReviewGatePark(next, phase, decision.feedback);
      // A4-E10: the minted gate is `forceHuman`, so the AGENT SEAL can never
      // clear it (R3/B-03) â€” for a sealed (zero-human) run the honest park names
      // the repair-the-phase path. The minted gate itself is kept: the human
      // approve/reject doors stay open, they are simply not what the seal needs.
      const sealedMachineGate = seal;
      const repaired = sealedMachineGate
        ? wildLog(
            gated,
            phase,
            "warn",
            "wild.repair_required",
            `P${phase} classifier REJECT â€” the seal cannot clear the minted forceHuman gate (R3/B-03); repair the phase (reject with a note to reopen the retry edge, or fix and re-run), then resume.`,
          )
        : gated;
      const paused = wildPause(
        repaired,
        phase,
        "warn",
        "wild.reject",
        `P${phase} review REJECTED: ${decision.feedback}`,
        { code: "RT_E_GATE_PENDING", unlock: sealedMachineGate ? "human-retry" : "human-gate" },
      );
      return { project: paused, outcome: "paused", ran: true, error: decision.feedback, code: "RT_E_GATE_PENDING" };
    }
  }
  // Self-approval. approveHitl completes the phase and moves the cursor; the
  // ledger decision row records the machine actor + the classifier feedback as
  // its note (T2 parity â€” nothing fabricated, nothing deleted). 313 D1: under
  // the seal the row additionally carries the CODED APPROVER OF RECORD â€” the
  // `[seat agent-seal]` note tag + `decidedVia` (label from policy.seatLabel,
  // the exact vocabulary dod.ts cross-checks: action/resource/reason/tokenPath).
  // `decidedBy` stays the truthful machine actor ("autopilot"); the seal can
  // never mint a human seat.
  const candidate = seal
    ? approveHitl(reviewBase, {
        decidedBy: "autopilot",
        note: `${approvalNote} [seat agent-seal]`,
        decidedVia: {
          action: "hitl.approve",
          resource: `gate:P${phase}`,
          reason: `agent-seal â€” the keyed Auto-Review classifier (${decision.source}) consented to P${phase}; unattended approval recorded under the seal.`,
          label: seatLabel({ decidedBy: "autopilot", seat: "agent-seal" }),
          tokenPath: false,
        },
      })
    : approveHitl(reviewBase, { decidedBy: "autopilot", note: decision.feedback.slice(0, 400) });
  if (candidate === reviewBase) {
    const paused = wildPause(reviewBase, phase, "error", "wild.error", `P${phase} approval did not apply â€” wild run paused.`);
    return { project: paused, outcome: "paused", ran: true, error: "Approval did not apply.", code: "RT_E_INTERNAL" };
  }
  // P10 hard-DoD post-check: the gate's own DoD only becomes evaluable AFTER
  // the approval completes the phase (its criteria include "HITL approved") â€”
  // so the enforcement check runs on the post-approval shape. A failing gate
  // is NOT committed: the candidate is discarded and the block is stamped on
  // the pre-approval project (no fabricated ledger row, no cursor move).
  // 313 D1: under the seal, ONE repair pass runs before the park is stamped;
  // a repair that cannot clear the gate still parks on the pre-approval
  // project (the same discipline â€” nothing fabricated).
  let approved = candidate;
  if (candidate.enforceDod === true) {
    const post = runGate(candidate, phase);
    if (!post.pass) {
      const repair = seal ? await wildDodRepairOnce(candidate, phase, opts) : null;
      if (repair === null || repair.repaired === null) {
        const blocked = hardDodBlockInto(next, phase, post);
        const paused = wildPause(
          blocked,
          phase,
          "warn",
          "wild.paused_dod",
          `P${phase} DoD unmet after approval â€” hard gate holds: ${post.unmet.map((g) => g.id).join(", ") || "n/a"}${
            repair !== null ? ` (${repair.detail})` : ""
          }`,
        );
        return { project: paused, outcome: "paused", ran: true, error: hardDodMessage(phase, post), code: "RT_E_GATE_PENDING" };
      }
      approved = repair.repaired;
    }
  }
  // P0-08 Hole A (fixes/97): the gate verdict is recorded AFTER approveHitl
  // compiled the packet â€” re-stamp so the packet's gate_passed + artifact
  // window reflect the recorded gate, never the pre-gate compile.
  const gated = stampPacket(recordGateInto(approved, phase));
  const stamped = wildPatch(gated, {
    lastAutoLog: `P${phase} gate self-approved (Auto-Review ${decision.source})`,
    lastAutoAt: Date.now(),
  });
  const done = wildLog(stamped, phase, "info", "wild.approved", `P${phase} gate self-approved (${decision.source}) â€” ${decision.feedback}`);
  return { project: done, outcome: "advanced", ran: true };
}

/**
 * Judge a just-executed complete phase and leave it (or pause). Callers pass a
 * project whose current edge is COMPLETE and < 12 (the phase being LEFT).
 *
 * 313 D1 â€” under the agent seal (`opts.agentSeal`), the verdict resolves
 * through the bounded reject-retry and a hard-DoD red runs ONE repair pass
 * before parking. Absent â‡’ the pre-seal bytes.
 */
async function wildLeavePhase(
  p: Project,
  phase: PhaseId,
  reviewer: WildReviewer,
  opts?: WildStepOptions,
): Promise<WildStepResult> {
  const seal = opts?.agentSeal === true;
  const resolved = seal
    ? await resolveWildReviewBounded(reviewer, p, phase, "advance", opts)
    : { decision: await resolveWildReview(reviewer, p, phase, "advance", opts?.reviewTimeoutMs), project: p };
  const decision = resolved.decision;
  if (decision.kind === "unconfigured-gate") {
    // Unreachable for advance reviews (only gate reviews return this), but
    // keep it honest anyway.
    const paused = wildPause(resolved.project, phase, "warn", "wild.paused_classifier", `Auto-Review classifier not configured â€” P${phase} cannot be judged.`);
    return { project: paused, outcome: "paused", ran: true, error: "Classifier not configured.", code: "RT_E_LLM_NOT_CONFIGURED" };
  }
  if (decision.kind === "error") {
    const paused = wildPause(resolved.project, phase, "error", "wild.error", `P${phase} Auto-Review failed: ${decision.error}`);
    return { project: paused, outcome: "paused", ran: true, error: decision.error, code: decision.code ?? "RT_E_LLM_REJECTED" };
  }
  let cur = wildReviewLog(resolved.project, phase, decision.source, decision.feedback);
  if (decision.verdict === "reject") {
    // A4-E1 (P0): with NO classifier configured, `resolveWildReview` answers an
    // ADVANCE decision with the deterministic DoD floor â€” `reject` iff the
    // phase's exit gate is red (engine.ts resolveWildReview). On an ADVISORY run
    // (`enforceDod !== true`) that floor is a machine review, not a gate: the
    // sequential driver (`advanceOnce`, store/headless) advances with the red
    // gate merely RECORDED. The wild loop must not turn the same state into a
    // park. Log the review honestly, then fall through to the ordinary advance
    // (the DoD leave check below is skipped because enforcement is off).
    if (decision.source === "dod" && p.enforceDod !== true) {
      cur = wildLog(
        cur,
        phase,
        "warn",
        "wild.review_advisory",
        `P${phase} DoD review REJECTED (${decision.feedback}) â€” enforcement is off (advisory), so the red gate is RECORDED, not enforced; advancing exactly as advanceOnce does.`,
      );
    } else {
      // W62 Â· C1-07-class remediation â€” accept-risk-under-seal (option a). Only a
      // CLASSIFIER reject is in scope (a DoD-floor reject is deterministic, not a
      // verdict a machine rule may override), and only with a declared rule.
      const acceptRiskRule =
        seal &&
        decision.source === "classifier" &&
        typeof opts?.acceptRiskUnderSeal === "string" &&
        opts.acceptRiskUnderSeal.trim() !== ""
          ? opts.acceptRiskUnderSeal.trim()
          : null;
      if (acceptRiskRule !== null) {
        cur = wildLog(
          cur,
          phase,
          "warn",
          "wild.risk_accepted",
          `P${phase} classifier REJECT overridden by the sealed ACCEPT-RISK policy (rule: ${acceptRiskRule}) â€” ` +
            `a MACHINE risk acceptance (decidedBy:autopilot); no human seat minted.`,
        );
        // Fall through to the DoD leave check + advance: the phase still must
        // pass its exit gate, so the override accepts the classifier's risk, not
        // the gate.
      } else {
        // GAP-1 (fixes/320_g1b_review_park.md): a CLASSIFIER reject mints the
        // human decision gate the park's unlockText promises. A4-E1: a
        // DETERMINISTIC DoD-floor reject (source "dod", enforcement ON) mints
        // NOTHING to decide â€” the honest door is "fix/regenerate/retry the
        // phase", so the park names `human-retry` instead of promising an open
        // gate the CLI would refuse (status stays "running", hitl stays null).
        if (decision.source === "classifier") cur = mintReviewGatePark(cur, phase, decision.feedback);
        // A4-E10: a machine-CREATED reject gate (mintReviewGatePark is
        // forceHuman) can never be machine-cleared, so under the seal the park
        // names the repair-the-phase path and a row names the door that works
        // (reject-with-a-note reopens the retry edge). The minted gate itself is
        // kept â€” the human approve/reject doors stay open, never removed.
        const sealedMachineGate = seal && decision.source === "classifier";
        if (sealedMachineGate) {
          cur = wildLog(
            cur,
            phase,
            "warn",
            "wild.repair_required",
            `P${phase} classifier REJECT â€” the seal cannot clear the minted forceHuman gate (R3/B-03); repair the phase (reject with a note to reopen the retry edge, or fix and re-run), then resume.`,
          );
        }
        const paused = wildPause(
          cur,
          phase,
          "warn",
          "wild.reject",
          `P${phase} review REJECTED: ${decision.feedback}`,
          {
            code: "RT_E_GATE_PENDING",
            unlock: decision.source === "classifier" && !sealedMachineGate ? "human-gate" : "human-retry",
          },
        );
        return { project: paused, outcome: "paused", ran: true, error: decision.feedback, code: "RT_E_GATE_PENDING" };
      }
    }
  }
  // P10 hard-DoD leave check: the phase being LEFT must pass its exit gate.
  // 313 D1: under the seal, ONE repair pass runs before the park is stamped â€”
  // the phase's own non-floor execution edge re-runs once (keyed P6 synthesis /
  // P7 live research / the injected seams) so a spurious red that a fresh
  // attempt clears does not park an unattended run; a pure-floor phase parks
  // honestly (a blind identical re-run is not a repair, B-07).
  if (cur.enforceDod === true) {
    const g = runGate(cur, phase);
    if (!g.pass) {
      const repair = seal ? await wildDodRepairOnce(cur, phase, opts) : null;
      if (repair === null || repair.repaired === null) {
        const blocked = hardDodBlockInto(cur, phase, g);
        const paused = wildPause(
          blocked,
          phase,
          "warn",
          "wild.paused_dod",
          `P${phase} DoD unmet â€” hard gate blocks advance: ${g.unmet.map((x) => x.id).join(", ") || "n/a"}${
            repair !== null ? ` (${repair.detail})` : ""
          }`,
          // A4-E1: this park leaves no open gate (status stays "running",
          // hitl stays null), so the honest door is repair/retry â€” the CLI
          // `approve`/`reject` doors refuse a project that is not
          // `awaiting_hitl` with a pending gate.
          { code: "RT_E_GATE_PENDING", unlock: "human-retry" },
        );
        return { project: paused, outcome: "paused", ran: true, error: hardDodMessage(phase, g), code: "RT_E_GATE_PENDING" };
      }
      cur = repair.repaired;
    }
  }
  const nextPhase = (phase + 1) as PhaseId;
  // Sync-store parity: a phase may only be LEFT when its priors are sealed and
  // the next phase is enterable (audit-31 P1 guard-skip fix).
  if (!priorsSealed(cur.phases, nextPhase) || !canEnter(phase, nextPhase)) {
    const paused = wildPause(
      cur,
      phase,
      "warn",
      "wild.paused_guard",
      `Illegal advance P${phase} â†’ P${nextPhase}: priors not sealed or phase not enterable.`,
    );
    return { project: paused, outcome: "paused", ran: true, error: "Guard blocked illegal advance.", code: "RT_E_PHASE_ILLEGAL" };
  }
  const advanced: Project = {
    ...cur,
    currentPhase: nextPhase,
    status: "running",
    phases: cur.phases.map((r) => (r.id === nextPhase ? { ...r, status: "ready" as const } : r)),
  };
  const stamped = wildPatch(advanced, { lastAutoLog: `P${phase} sealed â†’ P${nextPhase}`, lastAutoAt: Date.now() });
  const done = wildLog(stamped, phase, "info", "wild.advance", `P${phase} sealed â†’ P${nextPhase} (${decision.source})`);
  return { project: done, outcome: "advanced", ran: true };
}

/** P12 sealed (or a complete-cursor project) â†’ finish the run honestly. */
function wildFinalize(p: Project, phase: PhaseId): WildStepResult {
  const stamped = wildPatch(
    { ...p, status: "complete" },
    {
      active: false,
      pause: false,
      stoppedAt: Date.now(),
      lastAutoLog: `Wild run complete â€” all ${PHASES.length} phases sealed`,
      lastAutoAt: Date.now(),
    },
  );
  const done = wildLog(stamped, phase, "info", "wild.complete", `Wild run complete â€” all ${PHASES.length} phases sealed.`);
  return { project: done, outcome: "completed", ran: true };
}

/**
 * W-01/W-02 (fixes/271 Â· Â§R1-f01/f02): the wild P6 execution edge â€” phase 6's
 * ONE keyed path. Loads headless.runP6Edge (keyed synthesis + the tree-run
 * mint, the same seam run/gate use) through the concatenated-specifier idiom
 * (`./head` + `less.ts`, the wildServerSpec precedent above): the TanStack
 * import-protection plugin statically denies direct `*.server.*`/headless
 * imports from the client bundle, so the specifier is computed at runtime.
 * A4-E4 (P1): a load failure / missing export / seam throw is NO LONGER
 * converted into `applyPhaseResult(project, 6)`. That synthesis marked the
 * phase COMPLETE and appended a warn row, so "the keyed edge blew up" and "the
 * keyless floor ran" produced the SAME record â€” an error reading as a genuine
 * completion. On failure the phase is left exactly as the caller handed it in
 * (the execute site has already set it `running`) and a distinct coded
 * `wild.p6.edge.failed` row is stamped; the execute site turns that into a
 * coded park. No floor is synthesized.
 */
async function wildP6Edge(project: Project): Promise<Project> {
  const headlessSpec = "./head" + "less.ts";
  try {
    const hl = (await import(headlessSpec)) as { runP6Edge?: (p: Project) => Promise<Project> };
    if (typeof hl.runP6Edge !== "function") throw new Error("headless.runP6Edge export missing");
    return await hl.runP6Edge(project);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return wildLog(
      project,
      6,
      "warn",
      "wild.p6.edge.failed",
      `${liveDegradeCode(err, "RT_E_LLM_REJECTED")} Â· P6 keyed edge FAILED (${msg.slice(0, 160)}) â€” the phase is left running and no deterministic floor was synthesized (a floor completion is indistinguishable from a real keyed one).`,
    );
  }
}

/**
 * 316 H1 (313_d1_seal.md S5 row; 315 V2 finding: the `liveEdge` seam was
 * declared but never consumed â€” this function did not exist): the wild P7
 * execution edge â€” phase 7's ONE keyed path. Loads the SEQUENTIAL DRIVER'S OWN
 * live layer (`headless.runPhase(â€¦, {live:true})` â€” engine.liveLayer plus the
 * bare-node overlay: real Tavily/free-web findings + optional narrative, and
 * the documented `meta.liveUnavailable` explained-dead-end when live cannot
 * run) through the same concatenated-specifier idiom as wildP6Edge. A keyed
 * enforceDod wild run therefore clears `p7-research` with a real corpus (or
 * the waiver) instead of hard-stopping on a floor that can never satisfy it.
 * Any load failure / missing export / seam throw leaves the phase running and
 * stamps a coded `wild.p7.edge.failed` row (A4-E4) â€” a refusal-NOTE on the
 * record, never a silent skip, never a synthesized floor pass, and never a
 * fabricated live pass (a wild step must never die on a seam-load failure).
 */
async function wildLiveEdge(project: Project): Promise<Project> {
  const headlessSpec = "./head" + "less.ts";
  try {
    const hl = (await import(headlessSpec)) as {
      runPhase?: (p: Project, phase: PhaseId, opts: { live?: boolean }) => Promise<Project>;
    };
    if (typeof hl.runPhase !== "function") throw new Error("headless.runPhase export missing");
    return await hl.runPhase(project, 7, { live: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return wildLog(
      project,
      7,
      "warn",
      "wild.p7.edge.failed",
      `${liveDegradeCode(err, "RT_E_LLM_REJECTED")} Â· P7 live edge FAILED (${msg.slice(0, 160)}) â€” the phase is left running and no deterministic floor was synthesized (a floor completion is indistinguishable from a real live one).`,
    );
  }
}

/**
 * 306 F5 â€” derive the machine-readable outcome summary of ONE executed step
 * from (input project, result, action). Everything is READ from the two
 * projects â€” never guessed: completedPhase/advancedTo/artifacts are the real
 * deltas; `next` comes from the output's own records (wildNextEdgeOf).
 */
function wildStepSummaryOf(
  before: Project,
  result: WildStepResult,
  action: WildStepSummary["action"],
): WildStepSummary {
  const after = result.project;
  const edge = before.currentPhase;
  const paused = result.outcome === "paused";
  const beforeRec = (before.phases ?? []).find((r) => r.id === edge);
  const afterRec = (after.phases ?? []).find((r) => r.id === edge);
  const completedPhase =
    beforeRec !== undefined &&
    afterRec !== undefined &&
    beforeRec.status !== "complete" &&
    afterRec.status === "complete"
      ? edge
      : null;
  const advancedTo = after.currentPhase !== before.currentPhase ? after.currentPhase : null;
  const artifacts = Math.max(0, (after.artifacts?.length ?? 0) - (before.artifacts?.length ?? 0));
  const next = wildNextEdgeOf(after);
  const park = paused ? after.wildRun?.park ?? null : null;
  return {
    outcome: result.outcome === "advanced" || result.outcome === "completed" ? result.outcome : "paused",
    action: paused ? "park" : action,
    phase: edge,
    completedPhase,
    advancedTo,
    artifacts,
    nextPhase: next.phase,
    nextAction: next.action,
    ...(park ? { park } : {}),
  };
}

/** 306 F5 â€” stamp the summary on the step's output project (no-op without a
 *  wildRun surface â€” a noop/refusal result never reaches here). */
function wildStampSummary(p: Project, summary: WildStepSummary): Project {
  return p.wildRun ? { ...p, wildRun: { ...p.wildRun, lastStep: summary } } : p;
}

/** 306 F5 â€” flatten a summary into the RtEventSeed payload vocabulary (FLAT
 *  scalars only; the events registry's payload is a flat record by contract). */
function wildSummaryPayload(s: WildStepSummary): NonNullable<RtEventSeed["payload"]> {
  return {
    outcome: s.outcome,
    action: s.action,
    phase: s.phase,
    completedPhase: s.completedPhase,
    advancedTo: s.advancedTo,
    artifacts: s.artifacts,
    nextPhase: s.nextPhase,
    nextAction: s.nextAction,
    ...(s.park
      ? {
          parkCode: s.park.code,
          parkEvent: s.park.event,
          parkUnlock: s.park.unlock,
          parkResumePhase: s.park.resumePhase,
          parkResumeAction: s.park.resumeAction,
        }
      : {}),
  };
}

/** 346 P2-6: the step budget the watchdog wrap runs with â€” the caller's test
 *  seam when finite/positive, else the production `WILD_STEP_BUDGET_MS` (the
 *  same normalize-Ms discipline settle.ts uses). */
function normalizeStepBudgetMs(ms: number | undefined): number {
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : WILD_STEP_BUDGET_MS;
}

/**
 * P13 bounded autonomous step â€” the headless Wild Mode primitive. See the
 * section header for semantics. Never mutates its input; `opts.reviewer`
 * injects the Auto-Review classifier (tests), defaulting to the real
 * configured-only deepseek-v4-flash classifier.
 *
 * 346 P2-6: the phase-execution await is wrapped in `boundedStepWatch` â€” the
 * watchdog's production consumer (store/headless both drive this function, so
 * every executed step is watched). An overrun fires the tier-1 overdue and
 * tier-2 timeout rows on the step's sink; a step that RESOLVES at/after 2Ã—
 * budget is the Â§5.2 pause-on-resolve tier and parks the run coded. The wrap
 * never cancels the await (watchdog.ts Â§5.1) and never emits without a sink,
 * so a fast step's bytes are untouched.
 *
 * 346 K3 (console phase-run spend): this exported wrapper measures the step's
 * process session-ledger DELTA and hands it to `opts.onUsage` (see
 * WildStepOptions). The sink is pure observation â€” the wrapped step's bytes
 * and outcome are identical whether or not one is present (DG-8); with no
 * sink the body is called directly, so the fast path is byte-identical and
 * zero-overhead.
 */
export async function wildStep(
  project: Project,
  opts?: WildStepOptions,
): Promise<WildStepResult> {
  const onUsage = opts?.onUsage;
  if (typeof onUsage !== "function") return wildStepBody(project, opts);
  const baseline = normalizeLedger(sessionTokenBudget().ledger);
  const result = await wildStepBody(project, opts);
  const usage = spendDelta(sessionTokenBudget().ledger, baseline);
  // Nothing measured â‡’ the sink is never called, so a driver writes nothing
  // (never a fabricated zero). A sink that throws cannot fail the step.
  if (usage.promptTokens > 0 || usage.completionTokens > 0 || usage.calls > 0) {
    try {
      onUsage(usage);
    } catch {
      /* a usage sink never throws into the step it observes (DG-8) */
    }
  }
  return result;
}

async function wildStepBody(
  project: Project,
  opts?: WildStepOptions,
): Promise<WildStepResult> {
  // fixes/109 CAP-5 emission helpers. `emit` is the OPTIONAL host sink â€” when
  // absent every helper below is a no-op and the function is byte-identical to
  // the pre-telemetry engine (DG-8 purity: seeds are plain serializable data).
  const emit = opts?.onEvent;
  const runRef =
    project.wildRun?.startedAt !== null && project.wildRun?.startedAt !== undefined
      ? String(project.wildRun.startedAt)
      : null;
  /** 306 F5: attach the outcome summary to BOTH the result and its project
   *  (`wildRun.lastStep`) â€” done with or without a telemetry sink, so the
   *  persisted record is the same truth the events carry. */
  const summarized = (result: WildStepResult, action: WildStepSummary["action"]): WildStepResult => {
    const summary = wildStepSummaryOf(project, result, action);
    return { ...result, summary, project: wildStampSummary(result.project, summary) };
  };
  /** 306 F5: the one finish path for every dispatched step â€” summarize, stamp,
   *  then emit `wild.step_paused`/`wild.step_ok` with the summary flattened into
   *  the payload (long-run feedback: every event carries what ran/produced/next). */
  /** 308 P-1/P-2 (owner-ordered): every pause â€” the four legacy emitPaused
   *  sites AND the wildApproveGate/wildLeavePhase internals â€” funnels through
   *  finishStep, so the park record is stamped HERE, centrally, when a producer
   *  left it null. The probe: `wild --start` parked P0 with `park: null` while
   *  types.ts promised WildParkInfo (B1's class, wider than first mapped). */
  const parkIfNull = (result: WildStepResult): WildStepResult => {
    const wrp = result.outcome === "paused" ? result.project.wildRun : null;
    if (result.outcome !== "paused" || !wrp || wrp.park) return result;
    const code = result.code ?? null;
    const unlock: WildParkUnlock = code === "RT_E_GATE_PENDING" ? "human-gate" : "human-retry";
    // 325 A1b: the park's `event` must name the ledger row that recorded the
    // park (types.ts WildParkInfo.event) â€” 308 FIX-A item 5, listed and never
    // landed. The fixed "wild.paused" string referenced a row that does NOT
    // exist on ~14 pause arms (probe: unsealed classifier â†’ the row is
    // "wild.paused_classifier"; locked edge â†’ "wild.error"). wildPause writes
    // exactly ONE row and every pause arm returns straight after it, so the
    // LAST log row IS that row; the fallback only fires if a future arm ever
    // pauses without writing a wild.* row.
    const lastRow = result.project.logs?.[result.project.logs.length - 1];
    const event =
      typeof lastRow?.event === "string" && lastRow.event.startsWith("wild.")
        ? lastRow.event
        : "wild.paused";
    const info = wildParkInfo(
      result.project,
      result.project.currentPhase,
      event,
      clipSurface(result.error ?? "Wild step paused"),
      { code, unlock },
    );
    return { ...result, project: wildPatch(result.project, { park: info }) };
  };
  const emitPaused = (result: WildStepResult): WildStepResult => finishStep(result, "park");
  const finishStep = (result: WildStepResult, action: WildStepSummary["action"]): WildStepResult => {
    const out = summarized(parkIfNull(result), action);
    if (!emit) return out;
    if (out.outcome === "paused") {
      emit({
        level: "warn",
        scope: "wild-step",
        event: "wild.step_paused",
        message: out.error ?? "Wild step paused",
        capture: "src/lib/engine.ts:wildStep",
        code: out.code ?? null,
        phase: project.currentPhase,
        projectId: project.id,
        runRef,
        payload: wildSummaryPayload(out.summary!),
      });
    } else if (out.outcome === "advanced" || out.outcome === "completed") {
      emit({
        level: "info",
        scope: "wild-step",
        event: "wild.step_ok",
        message: `Wild step ${out.outcome}`,
        capture: "src/lib/engine.ts:wildStep",
        phase: project.currentPhase,
        projectId: project.id,
        runRef,
        payload: wildSummaryPayload(out.summary!),
      });
    }
    return out;
  };
  const emitStart = (phase: PhaseId): void => {
    emit?.({
      level: "info",
      scope: "wild-step",
      event: "wild.step_start",
      message: `Wild step at P${phase}`,
      capture: "src/lib/engine.ts:wildStep",
      phase,
      projectId: project.id,
      runRef,
      payload: { phase, action: wildNextActionAt(project, phase) },
    });
  };
  try {
    if (project.wildMode !== true || !project.wildRun || !project.wildRun.active) {
      return { project, outcome: "noop", ran: false, error: "No active wild run." };
    }
    if (project.wildRun.pause) {
      return { project, outcome: "noop", ran: false, error: "Wild run is paused." };
    }
    if (project.status === "blocked") {
      return finishStep(
        {
          project: wildPause(
            project,
            project.currentPhase,
            "warn",
            "wild.paused",
            "Project blocked (rejected phase) â€” wild run paused; retry is a human decision.",
            { code: "RT_E_PHASE_ILLEGAL", unlock: "human-retry" },
          ),
          outcome: "paused",
          ran: true,
          error: "Project blocked.",
          code: "RT_E_PHASE_ILLEGAL",
        },
        "park",
      );
    }
    if (project.status === "complete") {
      return { project, outcome: "noop", ran: false, error: "Project already complete." };
    }
    // 312 C3 (CF-SE2-1): reviewer resolution goes through the trust-gated
    // helper â€” on a non-Node host the runtime-assembled specifier below IS the
    // import-protection mock (awaiting it starves the event loop forever,
    // measured in fixes/312 Â§1), so the specifier is only imported on a
    // bare-Node host and every resolved callable is trust-checked first.
    const reviewer = await resolveWildReviewer(opts?.reviewer);
    const phase: PhaseId = project.currentPhase;
    const rec = project.phases.find((r) => r.id === phase);
    if (!rec) {
      return emitPaused({
        project: wildPause(project, phase, "error", "wild.error", `P${phase} has no phase record â€” wild run paused.`),
        outcome: "paused",
        ran: true,
        error: "Missing phase record.",
        code: "RT_E_PHASE_ILLEGAL",
      });
    }
    // Open gate on the current edge â†’ classifier decision (approve or pause).
    if (rec.status === "awaiting_hitl" || project.hitl?.phase === phase) {
      emitStart(phase);
      return finishStep(await wildApproveGate(project, phase, reviewer, opts), "gate");
    }
    if (rec.status === "complete") {
      emitStart(phase);
      if (phase === PHASE_LAST) return finishStep(wildFinalize(project, phase), "finalize");
      return finishStep(await wildLeavePhase(project, phase, reviewer, opts), "advance");
    }
    if (rec.status === "locked") {
      return emitPaused({
        project: wildPause(project, phase, "error", "wild.error", `P${phase} is locked â€” wild run paused.`),
        outcome: "paused",
        ran: true,
        error: `P${phase} locked.`,
        code: "RT_E_PHASE_ILLEGAL",
      });
    }
    if (rec.status === "rejected") {
      return emitPaused({
        project: wildPause(
          project,
          phase,
          "warn",
          "wild.paused",
          `P${phase} was rejected â€” retry is a human decision; wild run paused.`,
        ),
        outcome: "paused",
        ran: true,
        error: `P${phase} rejected.`,
        code: "RT_E_PHASE_ILLEGAL",
      });
    }
    // Execute the current legal phase â€” deterministic floor (applyPhaseResult,
    // the exact synthesis the sync store run uses), bounded to ONE phase per
    // call. The Auto-Review judgment + gate resolution follow in the same call
    // so a wild step is a complete edge resolution, never a bare execution.
    const now = Date.now();
    // Sync-store parity: the phase being EXECUTED must have sealed priors
    // (the store's run check, store.ts:326/429).
    if (!priorsSealed(project.phases, phase)) {
      return emitPaused({
        project: wildPause(
          project,
          phase,
          "warn",
          "wild.paused_guard",
          `Illegal execute P${phase}: priors not sealed.`,
        ),
        outcome: "paused",
        ran: true,
        error: "Guard blocked illegal execute.",
        code: "RT_E_PHASE_ILLEGAL",
      });
    }
    emitStart(phase);
    const running: Project = {
      ...project,
      status: "running",
      phases: project.phases.map((r) =>
        r.id === phase ? { ...r, status: "running" as const, startedAt: r.startedAt ?? now } : r,
      ),
    };
    // W-01 (fixes/271 Â· Â§R1-f01) + 316 H3/H1: the ONE edge picker
    // (`wildExecEdgeFor` â€” shared with the seal's DoD-repair pass so the two
    // can never drift apart again; the drift WAS the 315 V2 finding): phase 6
    // uses the injected `opts.p6Edge` (the headless wild loops thread the
    // production `runP6Edge` here, keyed) else the keyed synthesis edge; phase
    // 7 (H1) uses the injected `opts.liveEdge` else the keyed live edge (the
    // same live layer the sequential driver runs). Keyless hosts (and the
    // browser, where keyedDeepSeekConfigured() is false) keep the exact floor
    // bytes â€” the picker returns null.
    const execEdge = wildExecEdgeFor(phase, opts) ?? wildGeneralExecEdgeFor(phase, opts);
    // 346 P2-6: the per-step watchdog â€” `boundedStepWatch`'s production
    // consumer. The phase execution is the freeze-prone await (a keyed P6
    // synthesis may run up to P6_PHASE_MAX_MS); the wrap observes it at the two
    // Â§5.2 tiers and surfaces each as a coded row on the step's sink. The sink
    // is optional: absent â‡’ every callback below is a no-op and the step keeps
    // its exact bytes (DG-8). The await itself is never cancelled (Â§5.1 bound).
    const stepBudgetMs = normalizeStepBudgetMs(opts?.stepBudgetMs);
    const safeEmit = (seed: RtEventSeed): void => {
      try {
        emit?.(seed);
      } catch {
        /* telemetry never throws into the step it observes (AGENTS #7) */
      }
    };
    const watched = await boundedStepWatch(
      async () => (execEdge !== null ? await execEdge(running) : applyPhaseResult(running, phase)),
      {
        budgetMs: stepBudgetMs,
        // Â§5.2 tier 2 is exactly 2Ã— the budget â€” the same relation the pure
        // `shouldAutopause`/`watchdogDecision` math encodes (R12-f04: the
        // timeout tier must never trip a legal P6 step).
        autopauseMs: stepBudgetMs * 2,
        onOverdue: (elapsedMs: number) => {
          safeEmit({
            level: "warn",
            scope: "sys",
            event: "sys.step_overdue",
            message: `Wild step P${phase} overdue at ${elapsedMs}ms (budget ${stepBudgetMs}ms)`,
            capture: "src/lib/engine.ts:wildStep",
            phase,
            projectId: project.id,
            runRef,
            payload: { elapsedMs, budgetMs: stepBudgetMs, phase },
          });
        },
        onTimeout: (elapsedMs: number) => {
          safeEmit({
            level: "error",
            scope: "wild-step",
            event: "wild.step_timeout",
            message: `Wild step P${phase} at ${elapsedMs}ms â‰¥ 2Ã— budget ${stepBudgetMs}ms â€” timeout tier`,
            capture: "src/lib/engine.ts:wildStep",
            code: "RT_E_LLM_TIMEOUT",
            phase,
            projectId: project.id,
            runRef,
            payload: { elapsedMs, budgetMs: stepBudgetMs, phase },
          });
        },
      },
    );
    const executed = watched.result;
    // A4-E4 (P1): the keyed P6/P7 edges FAIL CLOSED â€” a NEW
    // `wild.p{6,7}.edge.failed` row means the edge threw and deliberately did
    // NOT synthesize the deterministic floor. Park coded on the still-running
    // phase instead of marking the floor complete: a resume/repair (or a human)
    // is the only advance, exactly like any other thrown step.
    const countEvent = (p: Project, ev: string): number => (p.logs ?? []).filter((l) => l.event === ev).length;
    const failedEvent =
      phase === 6 ? "wild.p6.edge.failed" : phase === 7 ? "wild.p7.edge.failed" : null;
    if (failedEvent !== null && countEvent(executed, failedEvent) > countEvent(running, failedEvent)) {
      const detail =
        `P${phase} keyed edge FAILED â€” the phase stays running and no deterministic floor was synthesized ` +
        `(A4-E4); resume/repair is a human decision.`;
      return finishStep(
        {
          project: wildPause(executed, phase, "error", failedEvent, detail, {
            code: "RT_E_LLM_REJECTED",
            unlock: "human-retry",
          }),
          outcome: "paused",
          ran: true,
          error: detail,
          code: "RT_E_LLM_REJECTED",
        },
        "park",
      );
    }
    // Tell the truth: `execEdge !== null` only proves an edge was SELECTED. An
    // injected seam (or the console bridge) can still append the legacy
    // `wild.p{6,7}.edge_unavailable` floor row, and the pre-fix row claimed
    // "keyed synthesis edge" / "keyed live edge" anyway. A newly-appended
    // fallback row for this phase means the floor actually ran.
    const fallbackEvent =
      phase === 6 ? "wild.p6.edge_unavailable" : phase === 7 ? "wild.p7.edge_unavailable" : null;
    const edgeFellBack =
      fallbackEvent !== null && countEvent(executed, fallbackEvent) > countEvent(running, fallbackEvent);
    const edgeLabel =
      execEdge === null || edgeFellBack
        ? edgeFellBack
          ? "deterministic floor â€” keyed edge unavailable"
          : "deterministic floor"
        : phase === 7
          ? typeof opts?.liveEdge === "function"
            ? "injected edge seam"
            : "keyed live edge"
          : phase === 6
            ? typeof opts?.p6Edge === "function"
              ? "injected edge seam"
              : "keyed synthesis edge"
            : typeof opts?.livePhaseEdge === "function"
              ? "injected phase edge"
              : "deterministic floor";
    const done = wildLog(executed, phase, "info", "wild.exec", `P${phase} executed (${edgeLabel})`);
    // 346 P2-6 pause-on-resolve (Â§5.2 tier 2): the timeout tier fired while the
    // step was still pending; now that it RESOLVED at â‰¥ 2Ã— budget, the run must
    // not silently advance â€” park it coded (a human resumes to retry). This is
    // the `shouldAutopause` trigger the watchdog doc names, read at the step's
    // own resolve point.
    if (shouldAutopause(watched.elapsedMs, stepBudgetMs)) {
      const detail =
        `P${phase} step resolved at ${watched.elapsedMs}ms â€” â‰¥ 2Ã— the ${stepBudgetMs}ms wild-step budget ` +
        `(pause-on-resolve, Â§5.2 tier 2); resume is a human decision.`;
      return finishStep(
        {
          project: wildPause(done, phase, "error", "wild.step_timeout", detail, {
            code: "RT_E_LLM_TIMEOUT",
            unlock: "human-retry",
          }),
          outcome: "paused",
          ran: true,
          error: detail,
          code: "RT_E_LLM_TIMEOUT",
        },
        "park",
      );
    }
    if (done.hitl?.phase === phase) {
      return finishStep(await wildApproveGate(done, phase, reviewer, opts), "gate");
    }
    if (phase === PHASE_LAST) {
      // P0-08 Hole B (fixes/97): the terminal packet was compiled inside
      // applyPhaseResult BEFORE the P12 gate was recorded â€” re-stamp so the
      // final packet's gate_passed for P12 is never null on wild runs.
      return finishStep(wildFinalize(stampPacket(recordGateInto(done, phase)), phase), "finalize");
    }
    // Phase completed without a gate: record the DoD verdict AND re-stamp the
    // packet (store finishPhase parity â€” audit-31 convergence fix), then let
    // the reviewer decide whether the loop may LEAVE it.
    const gated = stampPacket(recordGateInto(done, phase));
    return finishStep(await wildLeavePhase(gated, phase, reviewer, opts), "advance");
  } catch (err) {
    // Any unexpected engine error pauses the run with an honest ledger entry â€”
    // never a silent swallow, never a fabricated verdict.
    const msg = err instanceof Error ? err.message : String(err);
    emit?.({
      level: "error",
      scope: "wild-step",
      event: "wild.step_error",
      message: `Wild step failed: ${msg}`,
      capture: "src/lib/engine.ts:wildStep",
      code: "RT_E_INTERNAL",
      phase: project.currentPhase,
      projectId: project.id,
      runRef,
      stack: flattenStack(err) ?? null,
      err,
    });
    return {
      project: wildPause(
        project,
        project.currentPhase,
        "error",
        "wild.error",
        `Wild step failed: ${msg}`,
      ),
      outcome: "paused",
      ran: true,
      error: msg,
      code: "RT_E_INTERNAL",
    };
  }
}
