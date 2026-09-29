import { PHASES, PHASE_BY_ID, PHASE_LAST, canEnter, phaseDef, priorsSealed } from "./phases.ts";
import { clientSafeServerSpecifier } from "./server-spec.ts";
import type { ErrorCode } from "./errors.ts";
import { classifyError, ERROR_CODES } from "./errors.ts";
import { flattenStack } from "./rt-events.ts";
import type { RtEventSeed } from "./rt-events.ts";
import { compileAgentPacket } from "./packet.ts";
import {
  bootstrapMemory,
  feasibilityScorecard,
  fnv1a,
  librariesFor,
  runAlgorithms,
  stemToken,
  tokenizeWords,
} from "./algorithms.ts";
import { buildPhase6Module, healSource, runGenerated, sandboxClaim } from "./sandbox.ts";
import {
  archTrace,
  capabilityLine,
  failedGates,
  hardDodBlockInto,
  hardDodMessage,
  recordGateInto,
  runGate,
} from "./dod.ts";
// fixes/216k §3 (106 T-13 / F-10): doctor.ts's counted declared-vs-materialised
// job census — the ONE derivation (fixes/216k §3) now has its production
// caller at the P6 apply below. doctor.ts is client-safe by contract
// (sandbox-policy + token-ledger only — no node:fs) and imports no engine
// code, so this edge adds neither an engine↔doctor cycle nor a hydration risk
// (H2 rule).
import { jobScopeShortfall } from "./doctor.ts";
// P13 Wild Mode: the Auto-Review Supervisor classifier (configured-only —
// deepseek-v4-flash). Loaded lazily inside wildStep (server boundary — a
// static import would pull server-only code into the client bundle).
import type { WildClassifierResult, WildReviewContext } from "./wild-mode.server.ts";
// Optional real-backend integration (concurrently-authored modules). Imported
// read-only; when the underlying backend is not configured each resolves to a
// typed `{ ok: false, reason: "not-configured" }` and the engine falls back to
// its deterministic path (honesty contract — never fabricate live output).
import { complete, llmStatus } from "./llm.ts";
import { research } from "./research.ts";
import { runCode } from "./exec.ts";
import type { ExecResult } from "./exec.ts";
import { extractConstraints, phaseNarrative } from "./llm-tasks.ts";
import { coerceAcceptanceFixtures } from "./brief-fixtures.ts";
import type {
  Artifact,
  Competitor,
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
  WildPlan,
} from "./types";

// knowledge.ts is disk-backed (statically imports node:fs) — a static import
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
  selectLessons: (
    memory: readonly MemoryEntry[],
    phase: PhaseId,
    limit?: number,
    onlyClass?: readonly string[],
  ) => MemoryEntry[];
  // fixes/144 (D2): tier-2 read-back helpers — pure, resolved through the same
  // lazy knowledge seam (never a static prompt-engine import — its static
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
  // Deterministic template rows — never present as live research (B-23: source:"illustrative").
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
 * P0-03 (fixes/97): deterministic brief-kind classifier for the P8 UI phase.
 * Local by design — scaffold.projectKindOf is a sibling module this lane must
 * not import (cycle risk), and the classifier here is brief-only, not
 * file-tree-shaped. "library" and "cli-tool" are explicit brief vocabulary;
 * everything else is UI-bearing.
 */
function uiKindOf(project: Project): "cli-tool" | "library" | "ui" {
  const tokens = new Set(tokenizeWords(project.brief));
  const hit = (h: string): boolean => tokens.has(h) || tokens.has(stemToken(h));
  if (["library", "package", "sdk", "npm", "module", "statistics"].some(hit)) return "library";
  if (["cli", "command-line", "commandline", "terminal", "console-tool"].some(hit)) return "cli-tool";
  return "ui";
}

/** Domain vocabulary (raw forms; stemmed at compare time so `routing` matches `route`). */
const DOMAIN_TERMS: Record<string, string[]> = {
  "revenue-ops": ["crm", "pipeline", "lead", "sales"],
  operations: ["inventory", "warehouse", "sku", "stock"],
  marketplace: ["marketplace", "listing", "buyer", "seller", "storefront", "checkout"],
  "agent-platform": ["agent", "orchestrat", "mcp", "llm", "crew"],
  "health-ops": ["clinic", "patient", "health", "clinician", "hipaa", "phi", "intake"],
  logistics: ["fleet", "dispatch", "route", "driver", "tech"],
  "finance-ops": ["invoice", "billing", "ledger", "quote", "payments"],
  analytics: ["dashboard", "analytics", "kpi", "report"],
  // 118 P-D3: real-estate / property + construction/trades registers. A flipper
  // brief ("flip houses, track ARV, run comps, renovate") must classify here,
  // never as analytics/finance-ops — the previous register had zero REI vocab so
  // "track/estimate/report" in such briefs landed on analytics (maker-loop bug).
  "real-estate": [
    "house", "property", "estate", "home", "showing", "flip", "arv", "rental",
    "tenant", "lease", "landlord", "mortgage", "appraisal", "escrow", "closing",
    "title", "deed", "condo", "duplex", "multifamily", "comps", "beds", "baths",
    "sqft", "realtor", "listing", "agent", "buyer", "seller",
  ],
  construction: [
    "contractor", "renovation", "renovate", "rehab", "trades", "electrician",
    "plumber", "carpenter", "framing", "drywall", "roofing", "hvac", "permit",
    "subcontractor", "punch", "bid", "material",
  ],
};
const DOMAIN_ORDER = Object.keys(DOMAIN_TERMS);

export function inferDomain(brief: string): string {
  const tokens = new Set(tokenizeWords(brief));
  let best = "custom-software";
  let bestCount = 0;
  let bestLen = 0;
  for (const domain of DOMAIN_ORDER) {
    let count = 0;
    let len = 0;
    for (const raw of DOMAIN_TERMS[domain]) {
      if (tokens.has(stemToken(raw))) {
        count += 1;
        len += raw.length;
      }
    }
    if (count > bestCount || (count === bestCount && len > bestLen)) {
      best = domain;
      bestCount = count;
      bestLen = len;
    }
  }
  return best;
}

export function inferName(brief: string): string {
  const first = brief.split(/[.\n]/)[0]?.trim() ?? "Untitled system";
  const words = first
    .replace(/^(build|create|make|design|develop)\s+/i, "")
    .split(/\s+/)
    .slice(0, 4);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "Untitled system";
}

function scorecard(project: Project): FeasibilityScorecard {
  const lat = project.lattice;
  const sched = project.schedule;
  // Precondition: lattice && schedule are always present — attachAlgorithms primes them at
  // creation, hydration and every mutation (invariant B.3.3). The old placeholder branch was
  // unreachable and is deleted per B-22.
  if (!lat || !sched) {
    throw new Error("scorecard requires a primed project (run algorithms first)");
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

/** Deterministic note-keyword → delta mapping for regenerated text artifacts (B-04/T9). */
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
    // A1-46: the window used to be capped at 10_000 — on exhaustion the loop
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

/** 216i (112 §4.2 — T1): the lesson-row identity convention (knowledge.lessonRow
 *  mints `lesson-<classShort>-<fnv8(signature||text)>`). Engine-side modules use
 *  this to gate the reproduction accrual WITHOUT importing the disk-backed
 *  knowledge.ts (H2 lazy-seam rule). Non-lesson rows are never touched. */
export function isLessonMemoryId(id: unknown): boolean {
  return typeof id === "string" && id.startsWith("lesson-");
}

/**
 * 216i (112 §3.1/§4.2 — T1): the reproduction accrual. A repeated identical
 * failure re-derives the SAME signature-based lesson id (216g), so when the
 * merge sites see the same lesson id twice, the honest record is: ONE row whose
 * `reproducedCount` accrues — NOT a forked `-2` twin (dedupeMemoryIds' rename
 * semantics stay intact for every other row) and NOT a silently dropped
 * occurrence. The FIRST occurrence's content wins (a fresher mint keeps its
 * text/tags); the count = the sum of both sides' counts + 1 for the fold.
 *
 * Pure and deterministic: non-lesson duplicates pass through untouched (an
 * earlier copy already counted is never re-counted — only a genuine twin pair
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
  // A1-27: immutable spread — every other engine write builds a fresh object;
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

/** Recompile packet + A4 trace and refresh the packet artifact (B-06/B-19/R10 — store call sites). */
export function stampPacket(project: Project): Project {
  const packed = attachAlgorithms(project);
  return sealPacketArtifact(packed);
}

// ---------------------------------------------------------------------------
// 118 P-D3: brief-driven synthesis helpers. Product-shaped phase bodies derive
// their narrative from the brief's own nouns/verbs (the P0 lattice), never from
// RapidTool's engine internals — so a real-estate brief's architecture reads as
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

/** Lattice entities minus the vague-input fallbacks (the product's nouns). */
function productNouns(project: Project): string[] {
  return (project.lattice?.entities ?? []).filter((e) => e !== "operator" && e !== "record");
}

/** Lattice jobs minus the vague-input fallback (the product's verbs/flows). */
function productJobs(project: Project): string[] {
  return (project.lattice?.jobs ?? []).filter((j) => j !== "deliver-core-workflow");
}

/** Actors (kind === actor) from the lattice nodes — for role-based access narratives. */
function productActors(project: Project): string[] {
  return (project.lattice?.nodes ?? [])
    .filter((n) => n.kind === "actor")
    .map((n) => n.label);
}

/**
 * fixes/136 (P8 keyless): screens are the brief's real product SURFACES — one
 * distinct entity-management responsibility per screen, never one screen per
 * lattice verb (the old `screens = jobs` degeneracy emitted "Screen: track /
 * Responsibility: track over …" for every verb). Screens are the lattice
 * entities with genuine brief-phrase evidence, deduped by canonical stem and
 * bounded to ≤6; the lattice JOBS become the ACTIONS bound under each screen.
 *
 * Binding is clause-level and deterministic: a job binds to the entities that
 * share a comma/colon/semicolon/sentence clause with it in the brief. A job
 * that co-occurs with NO entity (e.g. "schedule repairs" with no `repair`
 * entity in the register) is a cross-cutting flow and is listed on every
 * screen. An entity that co-occurs with no job (e.g. a title noun) carries
 * only those cross-cutting flows — never a fabricated per-entity mapping.
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
      // A job that shares a clause with no entity is a cross-cutting flow —
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
  };
  return map[domain] ?? ["external services named by the brief"];
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
      // CORE-06: a regeneration attempt (rejected → retried → re-synthesized) is
      // a NEW entry for the SAME phase lifecycle — label it so the JSON log does
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
      // the vague lattice is the 87/88 wrong-product signature — record it as
      // memory + log so the run is visibly explainable (deterministic and
      // idempotent: same brief → same row id via dedupeMemoryIds).
      const vague = lat?.vague === true;
      // L1 vague-brief capture (fixes/98 §2.3 writer 1 / 98_make_2 §5): when the
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
              `# ${name} — Phase 0 scorecard`,
              ``,
              `Domain: ${domain}`,
              `Overall: ${sc.overall} / 10 — ${sc.verdict}`,
              `Lattice jobs: ${(lat?.jobs ?? []).join(", ") || "n/a"}`,
              `Entities: ${(lat?.entities ?? []).join(", ") || "n/a"}`,
              `Constraints: ${(lat?.constraints ?? []).join(", ") || "none"}`,
              ``,
              ...sc.axes.map((a) => `- ${a.label}: ${a.score}/10 — ${a.note}`),
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
          // Correction (fixes/100 #1): MemoryEntry.kind has no "note" member —
          // the LEX-gap row is semantic provenance, not a display note.
          ...(vague
            ? [
                mem(
                  "semantic",
                  "LEX gap: brief matched no job/entity vocabulary — lattice fell back to deliver-core-workflow. Tighten brief or extend LEX.",
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
                  detail: "LEX gap: brief matched no job/entity vocabulary — lattice fell back to deliver-core-workflow.",
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
                // the client where the lazy knowledge seam is null) → the
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
                          "Lessons from prior runs (advisory — tighten the brief so these failure modes are addressed; never overrides the gate):",
                          ...lessonLines.map((l) => `- ${l}`),
                        ].join("\n")
                      : base,
                  stakes: "Feasibility below the proceed line.",
                  // A04/B-03: a reframe is the machine telling the human to tighten the brief —
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
      // the body is the brief's own pipeline — its verbs and nouns — never the
      // engine's root_coordinator / LlmAgent / phase-lock graph.
      const tokens = new Set(tokenizeWords(project.brief));
      const agentVocab = ["dispatcher", "dispatch", "workflow", "agent", "orchestrat", "llm", "crew", "transfer", "mcp"];
      const agentHit = agentVocab.some((t) => tokens.has(t) || tokens.has(stemToken(t)));
      const jobs = productJobs(project);
      const nouns = productNouns(project);
      const flow =
        (project.implementationSpec?.dataFlow ?? []).slice(0, 6).join(" → ") ||
        jobs.slice(0, 6).join(" → ") ||
        "core workflow";
      const primary = nouns[0] ?? "record";
      const body = [
        `Sequential pipeline: ${flow}`,
        `State entities: ${nouns.length ? nouns.join(", ") : "records"}`,
        ``,
        `Each step advances a ${primary} through its lifecycle in the ${domainLabel(domain)} domain — the flow is the brief's own verbs, the state its own nouns (P0 lattice).`,
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
      // 118 P-D3: product-shaped persistence — the brief's nouns are the records,
      // its verbs the operations. No FusionRank / localStorage engine internals.
      const nouns = productNouns(project);
      const jobs = productJobs(project);
      return {
        artifacts: [
          art(
            2,
            "memory",
            "Data model & retrieval",
            [
              `Records: ${nouns.length ? nouns.join(", ") : "records"}`,
              `Operations: ${jobs.length ? jobs.join(", ") : "core workflow"}`,
              ``,
              `Each ${nouns[0] ?? "record"} is the unit of state; ${jobs[0] ?? "the workflow"} steps read and write that state in order.`,
              ``,
              `> Persistence is shaped by the brief's own nouns — no specific database or durable store is claimed beyond the brief.`,
            ].join("\n"),
          ),
        ],
        memory: [mem("semantic", `Data model written for ${name}: ${nouns.join(", ") || "records"}.`, 0.94)],
        logs,
      };
    }
    case 3:
      return {
        artifacts: [
          art(
            3,
            "mcp",
            "Integration surface (declared)",
            JSON.stringify(
              {
                domain,
                surface: domainSurface(domain),
                note:
                  "Integration surface derived from the brief's domain — declarations, not implemented bindings (honest).",
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
    case 4: {
      // 118 P-D3: product-shaped security — protect the brief's own entities with
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
              `Access model: ${actors.length ? actors.slice(0, 6).join(", ") : "roles"} — least privilege per role.`,
              ``,
              `Authorization:`,
              `  • Each actor may act only on the ${nouns[0] ?? "record"}s its role owns.`,
              `  • Elevated actions outside an actor's scope are refused.`,
              `  • Sensitive ${nouns[0] ?? "record"} data (identity, financial) is never logged in the clear.`,
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
          stakes: "Sandbox and authorization boundary — high stakes.",
        },
      };
    }
    case 5:
      return {
        artifacts: [
          art(
            5,
            "validation",
            "Validation + HITL contract",
            [
              `Validation contract (the HITL rules the engine actually enforces):`,
              `  1. Rejections require ≥12 characters of qualitative feedback (ADR-002).`,
              `  2. forceHuman gates (reframe, failed sandbox) can never be autopilot-approved.`,
              `  3. Phases execute strictly in order — the linear 0→12 graph.`,
              `  4. Every approval lands in the append-only decision journal.`,
              ``,
              `Rejection policy: qualitative feedback is mandatory.`,
              `Diagnostics: one JSON event per orchestration step.`,
              ``,
              `> ${capabilityLine("learning")}`,
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
    case 6: {
      const jobs = (project.lattice?.jobs ?? ["core"]).slice(0, 5);
      // T9/R-209 steering: rejection notes flow into the module; variant flips deterministically
      // with the note hash + attempt so different rejections produce different modules.
      // A05: scope the fallback to THIS phase — an earlier phase's rejection note must not leak
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
              detail: healed ? "self-healing produced a repaired module" : "no automatic repair applicable — no blind identical re-run (B-07)",
            },
          ]
        : [];
      return {
        generatedSource: code,
        lastTest: result,
        artifacts: [
          // P0-01 Part A (fixes/97): the deterministic template is a labeled
          // placeholder, never "Typed synthesis" — it does not synthesize the
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
                : "Sandbox failed — review",
              prompt: result.ok
                ? "Scheduler raised HITL on the placeholder module (deterministic template — it does not implement the brief; keyed synthesis is a separate path)."
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
              `# Market position — ${name}`,
              ``,
              `> Illustrative competitor templates (source: illustrative — NOT live research). Verify before citing.`,
              ``,
              ...market.map(
                (c) => `## ${c.name} (${c.class})\nSource: illustrative template\nStrength: ${c.strength}\nGap RapidTool exploits: ${c.gap}`,
              ),
              ``,
              `Architectural advantage: deterministic 0–12 graph with HITL and ADRs — generators skip this; IDEs leave it to the human.`,
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
      // contract per delivery kind — never a description of RapidTool's own
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
          : `\n> prototype pending — no ${kind === "ui" ? "UI" : "surface"} code generated; this contract is a declaration (deterministic template), not an implementation (B-18 honesty).`;
      let title: string;
      let body: string;
      let prompt: string;
      let memText: string;
      if (kind === "cli-tool") {
        title = "CLI surface contract";
        body = [
          `Kind: cli-tool — no UI surface in scope.`,
          `Commands/flags (derived from the brief):`,
          ...(entities.length > 0 ? entities.map((e) => `- ${e}`) : [`- (no command vocabulary — keyless run)`]),
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
          `Kind: library — API surface, no UI.`,
          ...(spec != null
            ? [``, `Type signatures (from the brief expansion spec):`, ...sigs.map((s) => `- ${s}`)]
            : [`(no expanded spec present — keyless run; signatures pending)`]),
          ...(reqs.length > 0
            ? [``, `Requirement trace:`, ...reqs.map((r, i) => `- req-${i + 1}: ${r}`)]
            : []),
          keylessTail,
        ].join("\n");
        prompt = "Confirm the library API contract (typeSignatures from the spec).";
        memText = "Library API contract written — type signatures must be the module's exports (P6).";
      } else {
        title = "Interface contract (client UI)";
        // fixes/136 (P8): keyless screens are the brief's real product surfaces —
        // one distinct entity-management responsibility per screen, never one
        // screen per lattice verb (the old `screens = jobs` degeneracy emitted
        // an identical "Screen: <verb> / Responsibility: <verb> over …" for
        // every verb). The lattice JOBS are the ACTIONS bound under each screen,
        // not screens themselves. spec!=null keeps the requirement-trace screens.
        const entityScreens = keylessScreens(project);
        const screens = spec != null ? reqs : entityScreens.map((s) => s.entity);
        body = [
          spec != null
            ? `Screens derived from the briefed requirements:`
            : `Screens derived from the brief's product surfaces (one distinct entity-management responsibility each — never one screen per verb):`,
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
            : [`(no screen vocabulary — brief is too thin for a UI contract)`]),
          keylessTail,
        ].join("\n");
        prompt =
          spec != null
            ? `Confirm the client UI contract: ${Math.min(3, screens.length)} screen(s) derived from the brief.`
            : `Confirm the client UI contract: ${Math.min(3, screens.length)} surface(s) derived from the brief's entities. Keyless runs: this is a declaration, not implemented UI.`;
        memText = "Client UI contract written — screens bound to briefed entities; flows listed as actions.";
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
              `# template — not executed: recorded P9 artifact; RapidTool never ran this workflow (B-18).`,
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
              `# template — not executed: recorded P9 sketch; nothing here was provisioned or validated (B-18).`,
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
          stakes: "External deployment — high stakes.",
        },
      };
    case 10: {
      // 118 P-D3: product-shaped inference — where the product's "smart" steps
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
              `No remote model inference or edge handoff is claimed — the product's logic is deterministic unless the brief names a model.`,
            ].join("\n"),
          ),
        ],
        memory: [mem("procedural", "Product logic runs locally and deterministically; no remote model is claimed.", 0.9)],
        logs,
      };
    }
    case 11:
      return {
        artifacts: [
          art(
            11,
            "tools",
            "Live data & tool surfaces",
            JSON.stringify(
              {
                domain,
                surfaces: domainSurface(domain),
                note: "Live surfaces derived from the brief's domain — declared, not bound at runtime (honest).",
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
        `Decision: The product runs a sequential ${jobs.join(" → ") || "core workflow"} pipeline over its entities.`,
        ``,
        `# ADR-003 ${domainLabel(domain)} integration boundaries`,
        ``,
        `Status: accepted`,
        `Decision: External surfaces are ${domainSurface(domain).join(", ") || "none declared"} — declarations, not runtime bindings.`,
      ].join("\n");
      // fixes/144 (M4-1, seal-path guard — engine half): a red-gate seal is
      // never presented as a bare clean "All 13 phases sealed." — when any
      // complete phase carries a failed DoD gate the delivery record carries
      // the census ("N failed gates: <ids>") and warns, so a failed-gate run
      // can never emit byte-identical output to a clean one.
      const seal = sealHonesty(project);
      const deliveryDetail = seal.clean
        ? "All 13 phases sealed."
        : `All 13 phases sealed. ${seal.failed.length} failed gates: ${seal.failed.join(", ")}`;
      return {
        openapi,
        adr,
        artifacts: [
          art(12, "docs", "Architecture Decision Records", adr, "markdown"),
          art(12, "docs", "OpenAPI 3.1", openapi, "yaml"),
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

function attachAlgorithms(project: Project): Project {
  const ran = runAlgorithms(project);
  const next: Project = {
    ...project,
    lattice: ran.lattice,
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
// fixes/144 — seal-path honesty (M4-1 engine half) + L2 lesson content
// (M5-1 engine half).
// ---------------------------------------------------------------------------

/**
 * Pure seal-honesty census (fixes/144 M4-1, engine half). `clean` is true only
 * when no COMPLETE phase carries a recorded failed DoD gate (failedGates()
 * empty); `failed` lists the red phase ids (`P${phase}`, phase order). The P12
 * delivery.complete writer below consumes it so a red-gate seal can never
 * present byte-identical output to a clean one; the headless driver / CLI
 * import it for the completion gate (export name stable — do not rename).
 */
export function sealHonesty(project: Project): { clean: boolean; failed: string[] } {
  const failed = failedGates(project).map((g) => `P${g.phase}`);
  return { clean: failed.length === 0, failed };
}

/**
 * Deterministic lesson-evidence digest (fixes/144 M5-1, engine half) in the
 * shared format knowledge.ts's lessonEvidenceDetail helper emits (C4 lane) so
 * engine-minted and driver-minted L2 rows converge byte-for-byte:
 *   `unmet: <criteria verbatim, ", "-joined> · class: <RT_E code> · tail: <first 300 chars>`
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
  return parts.join(" · ");
}

/**
 * The last recorded refusal class on the journey — parsed from the NEWEST log
 * whose event names a refusal (`p6.synthesis.refused` …) with a
 * "<RT_E code> · <reason>" detail (codegen's refusal-log shape). Null when no
 * refusal was recorded. The reason (bounded in codegen's log) rides as the
 * digest tail.
 */
function refusalClassOf(project: Project): { code: string; tail: string } | null {
  const logs = project.logs ?? [];
  for (let i = logs.length - 1; i >= 0; i--) {
    const l = logs[i];
    if (!l || typeof l.event !== "string" || !l.event.includes("refused")) continue;
    if (typeof l.detail !== "string") continue;
    const m = /^(RT_E_[A-Z0-9_]+)(?:\s*·\s*([\s\S]*))?$/.exec(l.detail.trim());
    if (m) {
      const tail = (m[2] ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
      return { code: m[1], tail };
    }
  }
  return null;
}

/**
 * Fit the evidence digest into the H43-P2-2 row budget (240). Segments are
 * `unmet: <criteria>` · `class: <code>` · `tail: <reason>` in that order.
 * The class clause is ATOMIC — when the verbatim unmet list crowds it out the
 * unmet list is trimmed from its tail first so a recorded refusal code is
 * never silently mangled; the tail clause is sliced to whatever room remains.
 */
function fitLessonEvidence(digest: string, budget = 240): string {
  const t = digest.replace(/\s+/g, " ").trim();
  if (t.length <= budget) return t;
  const segs = t.split(" · ");
  let out = segs[0] ?? "";
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i];
    const cand = out.length + 3 + seg.length;
    if (cand <= budget) {
      out = `${out} · ${seg}`;
      continue;
    }
    const room = budget - out.length - 3;
    if (seg.startsWith("tail:")) {
      if (room > 0) {
        out = `${out} · ${seg.slice(0, room)}`;
      }
    } else if (out.startsWith("unmet: ")) {
      // Atomic clause (e.g. class): fit it exactly by trimming the unmet list's
      // tail — the verbatim head alone may already overflow the budget, and a
      // recorded refusal code is never silently mangled (fixes/300).
      const keep = Math.max("unmet: ".length, budget - 3 - seg.length);
      out = `${out.slice(0, keep)} · ${seg}`;
    } else if (room > 0) {
      out = `${out} · ${seg.slice(0, room)}`;
    }
    break;
  }
  return out.length <= budget ? out : out.slice(0, budget);
}

/**
 * fixes/216k §3: the job label a spec-graph node's `purpose` carries —
 * `Implement job “flip” against the contract` → `flip`. Mirrors the scaffold's
 * `jobLabelOf` quote-stripping (straight or curly quotes) + whitespace
 * collapse so the engine census and the scaffold README census label nodes
 * identically; a LOCAL copy because the engine must not import the emitter
 * module (H2 seam budget — the label rule is 4 lines, not a dependency).
 */
function jobLabelFromPurpose(purpose: unknown): string | null {
  if (typeof purpose !== "string") return null;
  const m = purpose.match(/["“]([^"”]+)["”]/);
  if (!m) return null;
  const label = m[1].replace(/\s+/g, " ").trim();
  return label || null;
}

/**
 * fixes/216k §3 (106 T-13 / F-10) — the production caller of doctor.ts's
 * counted job-scope census: the `p6.jobs.shortfall` warn row the engine
 * persists onto the exported project when a P6 apply's DECLARED lattice jobs
 * outnumber the MATERIALISED spec-graph job nodes (`planSpecGraph` materialises
 * at most FIVE — algorithms.ts). `lattice.jobs` is the brief's own
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
    // A node without a parsable label still materialised — count it by id so
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
    detail: `declared ${s.declared} lattice job(s) vs materialised ${s.materialised} spec-graph job node(s) — ${
      s.declared - s.materialised
    } unmaterialised; missing: ${s.missing.join(", ")}`,
  };
}

export function applyPhaseResult(project: Project, phase: PhaseId): Project {
  // CORE-01 (defensive): refuse a truly invalid phase id before any array
  // indexing — a corrupt caller throws loudly, never crashes mid-graph.
  if (!Number.isInteger(phase) || phase < 0 || phase > PHASE_LAST) {
    throw new Error(`applyPhaseResult: invalid phase ${String(phase)}`);
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
      title: "Sandbox failed — review",
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
    artifacts[artifacts.length - 1] = {
      ...last,
      body: `${last.body}\n\n${rejectionResponseBlock(attempt, note)}`,
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
    status: needsHitl ? "awaiting_hitl" : phase === 12 ? "complete" : "running",
    currentPhase: phase,
    scorecard: result.scorecard ?? primed.scorecard,
    competitors: result.competitors ?? primed.competitors,
    artifacts: [
      ...primed.artifacts.filter((a) => a.phase !== phase && a.kind !== "packet"),
      ...artifacts,
    ],
    // 216i (112 §4.2 — T1): the accrual runs BEFORE the id dedupe — a re-minted
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
  // T-11 (106 §6, F-08) — GREEN-SEAL GATE: a RED seal never mints a lesson row.
  // fixes/98 §2.3's engine-half capture used to record "P6 sealed with unmet
  // DoD" as an L2 template-emission lesson and feed it back through
  // selectLessons — a lesson whose target probe never passed, so the
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
      // just THAT something failed (fixes/99 finding) — the unmet criteria
      // VERBATIM plus the journey's refusal class (RT_E_*) and refusal reason
      // when a keyed synthesis refusal was recorded — in the shared
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
      // T-11 (106 §6): the DoD probe ids the digest anchors to ride the log
      // head so the ledger names the probes a green seal would have to satisfy
      // (the lesson-row half — `probe:<id>` tags — lands in knowledge.ts from
      // these same failureSignature anchors; NO row id is re-minted).
      const detail = `red seal — ${r.unmet.length} unmet DoD probe(s) [${r.unmet
        .map((g) => g.id)
        .join(", ")}]: ${fitLessonEvidence(digest)}`;
      // Stale-read guard: re-sealing the same unmet gate (a repair loop's
      // re-apply) adds no new fact — an identical row already recorded in the
      // ledger is never duplicated.
      if (!merged.logs.some((l) => l.event === event && l.detail === detail)) {
        sealLogs.push({ ts: Date.now(), phase, level: "warn" as const, event, detail });
      }
    }
  }
  // fixes/216k §3 (106 T-13 / F-10): the production shortfall caller — a P6
  // apply whose declared lattice jobs outnumber the materialised spec-graph
  // job nodes persists the counted `p6.jobs.shortfall` warn row.
  // p6JobsShortfallLog is pure and returns null when declared ≤ materialised;
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
  // fixes/144 (M2 lane B4): when this P6 apply carries a multi-file
  // generatedTree (keyed synthesis landed on an earlier attempt and a repair /
  // re-apply is re-running the phase), stamp the p6-arch reqTrace artifact +
  // log so the recorded gate and packet surface the capability→file mapping.
  // Tree-absent applies (deterministic/keyless floor, refused keyed synthesis)
  // are returned byte-identical — the p6-arch legacy note never touches them.
  return sealPacketArtifact(phase === 6 ? stampP6ReqTrace(packed) : packed);
}

/**
 * fixes/144 (M2, lane B4): stamp the p6-arch reqTrace onto a project whose P6
 * apply produced (or carried) a multi-file generatedTree — one phase-6 docs
 * artifact ("P6 architecture trace (reqTrace)") listing every capability →
 * file mapping (plus the missing capabilities / template-stub files when the
 * probe fails) and a `dod.reqtrace` log line. Idempotent: a re-stamp replaces
 * the prior reqTrace artifact by title, never duplicates. Tree-absent projects
 * (deterministic/keyless floor, refused keyed synthesis on the single-module
 * floor) are returned UNCHANGED — the same reference — because p6-arch passes
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
    `**p6-arch: ${pass ? "PASS" : "FAIL"}** · ${t.note}`,
    ``,
    ...(t.rows.length > 0
      ? t.rows.map((r) => `- ${r.capability} → ${r.files.join(", ")}`)
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
    "> reqTrace: capability → tree file(s), computed by p6-arch over generatedTree code identifiers (stemmed; literals/comments masked).",
  ].join("\n");
  const artifact = art(6, "docs", title, body, "markdown");
  const detail =
    `p6-arch ${pass ? "PASS" : "FAIL"} · ${t.note}` +
    (t.missing.length > 0 ? ` · missing: ${t.missing.join(", ")}` : "") +
    (t.stubFiles.length > 0 ? ` · template stubs: ${t.stubFiles.join(", ")}` : "");
  const logs = project.logs ?? [];
  const last = logs[logs.length - 1];
  // Idempotent re-stamp: an identical tail dod.reqtrace row (same phase +
  // detail) is NOT appended twice — applyPhaseResult and liveLayer both stamp
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
 * gate artifact or a `gate.verdict` log — the store's recordGate re-runs
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
    /** Explicit override of a forceHuman gate (failed P6 sandbox) — R3/B-03. */
    force?: boolean;
    requestedAt?: number;
  },
): Project {
  const phase = project.currentPhase;
  const decidedBy = opts.decidedBy;
  if (decidedBy !== "human" && decidedBy !== "autopilot") {
    throw new Error("approveHitl requires explicit decidedBy (never default human)");
  }
  // CORE-01 (defensive): refuse to approve without a pending gate, or when the
  // pending gate does not match the current edge — return the project untouched
  // (ledger stays clean) rather than fabricate a transition.
  if (!project.hitl || project.hitl.phase !== phase) return project;
  // CORE-01 (defensive): a human-only gate (failed P6 sandbox / reframe) may
  // never be autopilot-approved unless the caller passed an explicit `force`.
  if (project.hitl.forceHuman && decidedBy === "autopilot" && !opts?.force) {
    throw new Error("Autopilot may not approve a forceHuman gate (R3/B-03).");
  }
  const now = Date.now();
  // A1-30 residue (fixes/296 Q1): the transition bound comes from the graph authority
  // (phases.ts PHASE_LAST) — never a bare 12 (behavior-identical: PHASE_LAST = 12).
  const next = Math.min(PHASE_LAST, phase + 1) as PhaseId;
  const phases = project.phases.map((p) => {
    if (p.id === phase) return { ...p, status: "complete" as const, completedAt: now };
    if (p.id === next && phase < PHASE_LAST) return { ...p, status: "ready" as const };
    return p;
  });
  const forcedOverride =
    Boolean(opts?.force) && phase === 6 && project.lastTest !== null && !project.lastTest.ok;
  // DF-09 (W23 L6 · 249 SPEC 1): an override of a FAILED gate is
  // indistinguishable from a rubber stamp unless the caller states WHY. The
  // caller-supplied rationale floor mirrors rejectHitl's ≥12-char minimum
  // below; the code is RT_E_VALIDATION so a CLI/engine caller classifies a
  // coded refusal (exit 1) — never a bare RT_E_INTERNAL. Autopilot is exempt:
  // its self-approval carries its own note and can never mint a forced
  // override (R3/B-03 above keeps a forceHuman gate human-only).
  if (forcedOverride && decidedBy === "human" && (opts?.note ?? "").trim().length < 12) {
    const err = new Error(
      `Approving a FAILED P${phase} gate with force requires a rationale — at least 12 characters of note ("why is the red gate being overridden?").`,
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
    status: phase === 12 ? "complete" : "running",
    currentPhase: phase === 12 ? 12 : next,
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

export function rejectHitl(project: Project, note: string): Project {
  const phase = project.currentPhase;
  // CORE-01/CORE-02 (defensive): the append-only ledger must never record a
  // fabricated rejection — require a pending gate on the current edge and the
  // documented ≥12-char qualitative-feedback minimum before writing a row.
  const trimmed = note.trim();
  if (trimmed.length < 12) {
    throw new Error("Rejection requires at least 12 characters of qualitative feedback.");
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
    decidedBy: "human",
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
  // ledger never recorded — return the project untouched instead.
  if (!rec || rec.status !== "rejected" || project.status !== "blocked") return project;
  const phases = project.phases.map((p) =>
    p.id === phase ? { ...p, status: "ready" as const } : p,
  );
  return { ...project, phases, status: "running", hitl: null };
}

/**
 * fixes/132 (C2): the create-time "is DeepSeek configured" probe for the
 * enforceDod default. Client-safe (typeof-guarded — browsers/SSR without
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
  /** Explicit create-time override (CLI --advisory sends false). Undefined → keyed default. */
  enforceDod?: boolean;
  /** Delivery-kind (E-15 wave: "app"|"tool"|"game"). Declared kind wins at codegen
   *  tree-trigger time; absent → singleModuleLibraryKind() routes to the ≤8 library path. */
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
    phases: PHASES.map((p) => ({
      id: p.id,
      status: p.id === 0 ? "ready" : "locked",
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
    // E-14: deterministic until a real LLM call succeeds — liveLayer stamps the
    // actual route (deepseek-flash / deepseek-pro) the moment one runs, and
    // hydrateProject maps legacy "grok-4.5"|"local-edge"|"failover" payloads to
    // "deterministic" unless a logs entry shows an LLM call. Never claim a
    // model that was not used.
    modelRoute: "deterministic",
    sandbox: {
      // Honest default: generated code runs through the bounded engine-template runner today (B-18);
      // runtime:"worker" is reserved for the real Worker sandbox (R1) once producers need it.
      // 213: isolated defaults false — node-runner is NOT Docker/bwrap (doctor.runnerIsSandbox:false).
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
    // runs (fixes/132 — a configured LLM may not silently leave failing
    // gates) and OFF for keyless/deterministic runs; an explicit
    // input.enforceDod (CLI --advisory sends false) always wins. Wild Mode
    // stays OFF on every fresh project; wildRun is null until a run starts.
    enforceDod:
      typeof input.enforceDod === "boolean" ? input.enforceDod : keyedDeepSeekConfigured(),
    wildMode: false,
    wildRun: null,
    // P0-2: persisted copilot thread starts empty (store appendChatRows caps it
    // at 40 rows; the ChatPane renders ≤12 and the model sees ≤6 turns).
    chatLog: [],
    _v: 2,
  };
  const ready = attachAlgorithms(base);
  // R4/B-05: memory first, packet second — a fresh packet must list the bootstrap rows.
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
 * drops unknown/duplicate ids, inserts missing phases — history is never wholesale-reset.
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
    // A16: a garbage status string is corrupt — drop it and let the insert loop
    // re-add a sane default (0 → ready, else locked), loudly.
    if (typeof r.status !== "string" || !PHASE_STATUSES.has(r.status)) {
      dropped.push(id);
      continue;
    }
    seen.add(id);
    kept.push({ ...r, rejectionHistory: r.rejectionHistory ?? [], gate: r.gate ?? null });
  }
  for (const def of PHASES) {
    if (!seen.has(def.id)) {
      kept.push({ id: def.id, status: def.id === 0 ? "ready" : "locked" });
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
 * ("grok-4.5" | "local-edge" | "failover" — a target architecture that was
 * never implemented) collapse to "deterministic", or to "deepseek-flash" when
 * a logs entry shows a real LLM call actually happened. Unknown/garbage →
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
 *  rows or fields no engine write could ever have produced — hand-edited
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

/**
 * P13 wildRun hydration. Legacy/absent → null. A persisted ACTIVE run is
 * stopped on hydrate: the driver loop is a session artifact and dies with the
 * page, so an active surface would be a lie after reload — active runs become
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
  if (!run.active) return { wildRun: run, stopped: false };
  // 174-3: CLI pause/resume/step must keep a persisted active run (the driver
  // is the CLI process). Browser hydrate still force-stops (session died).
  if (preserveActive) return { wildRun: run, stopped: false };
  // Session-break honesty: a live run cannot outlive the driver that drove it.
  return {
    wildRun: { ...run, active: false, pause: false, stoppedAt: run.stoppedAt ?? Date.now() },
    stopped: true,
  };
}

/** A1-22: structural guards for specGraph/contracts, mirroring io's import
 *  boundary (io.sanitizeImportPayload). The PERSIST path (localStorage →
 *  hydrateProject) never passes through io: a stored `{order: 5}` used to pass
 *  the plain-object guard here and then make compileAgentPacket's `.map()`
 *  throw — the store answers that throw with recoverFromCorruptPersistence
 *  (a whole-workspace re-seed). Structurally-broken values are nulled and the
 *  caller reports the repair (shapeRepaired → anyRepaired → re-stamp). */
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
  // capped at PHASE_LAST — the graph authority, never a bare 12 (A1-30 residue).
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
  // status, unknown id, duplicate) as `locked` — when THAT record was the
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
    // P4 complete) used to jump the edge past the gap — priorsSealed then
    // fails forever. Clamp to the first unsealed slot after a prefix of
    // completes.
    let highest = -1;
    for (let i = 0; i <= PHASE_LAST; i++) {
      const rec = phaseRepair.phases.find((r) => r.id === i);
      if (rec?.status === "complete") highest = i;
      else break;
    }
    currentPhase = Math.max(0, Math.min(PHASE_LAST, highest + 1)) as PhaseId;
    // Promote the derived edge only when its priors are genuinely sealed —
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
  // (e.g. P0–P2 complete, P3 missing/locked, P4 complete, currentPhase=4).
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
    const sealedEdge = Math.max(0, Math.min(12, highestContig + 1)) as PhaseId;
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
  // when structurally unusable — junk that would otherwise crash
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
  // isolated / ramMb) — a coercion is a REPAIR, so it is reported like
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
  // persisted ACTIVE wild run is stopped here — the driver that drove it died
  // with the previous session, so an active surface would be a lie after reload
  // (hydrateWildRun returns `stopped` when it forced the run down).
  const hw = hydrateWildRun(raw.wildRun, currentPhase, opts?.preserveWildRun === true);

  // P0-2: additive chatLog read — legacy payloads lack the field entirely
  // (the ChatPane treats that as an empty thread); a present-but-non-array
  // value is garbage from a corrupt/hostile payload and is dropped loudly.
  const chatLog = Array.isArray(raw.chatLog) ? raw.chatLog : [];
  const chatLogRepaired =
    raw.chatLog !== undefined && raw.chatLog !== null && !Array.isArray(raw.chatLog);

  // H-03 (fixes/115): `research` rode the ...raw spread unvalidated — a corrupt
  // non-array value survived hydrate and threw inside compileAgentPacket's
  // researchSources/researchHash ((project.research ?? []).slice is not a
  // function), which the persist repair path does NOT try/catch per project →
  // ONE corrupt row wiped the whole store on reload. Normalize like siblings.
  // A1-01 (fixes/122): ALSO drop junk at the ITEM level — an entry whose items
  // contains null/non-objects survives the entry filter then throws inside
  // packet researchSources (it.title on null) → whole-store wipe on reload.
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
    raw.research !== undefined && raw.research !== null && !Array.isArray(raw.research) ||
    (Array.isArray(raw.research) &&
      (raw.research as { items?: unknown }[]).some(
        (e) =>
          e !== null &&
          typeof e === "object" &&
          Array.isArray((e as { items?: unknown }).items) &&
          ((e as { items?: unknown[] }).items as unknown[]).some(
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
  // survives hydrate and throws inside packet compilation (reading 'label') —
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

  // fixes/144 (M2): generatedTree rides the spread unvalidated otherwise — a
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
      // A1-28: typeof-guard the scalars like ramMb/enforceDod — `?? 30` let a
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
    // compilation — drop it defensively during hydration.
    memory,
    logs,
    competitors: Array.isArray(raw.competitors) ? raw.competitors : [],
    phases: phaseRepair.phases,
  };
  // E-15 / fixes/215: `...raw` carries Project.kind through, but an unknown /
  // non-string persisted kind (a hand-edited or legacy payload) must not
  // survive — codegen's tree trigger (singleModuleLibraryKind) reads it
  // directly, so a garbage value would silently mis-route synthesis. Clamp to
  // the legal 3-way set; absent = the legacy single-module-library path
  // (byte-identical for kind-less payloads).
  if (!(filled.kind === "app" || filled.kind === "tool" || filled.kind === "game")) {
    delete filled.kind;
  }
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
        detail: "briefHash mismatch — approved fixtures reverted to pending (never silently re-approved)",
      },
    ];
  }
  // A1-22: the shape guards above nulled structurally-broken specGraph/
  // contracts — report + re-stamp like every other repair, never a silent drop.
  const shapeRepaired =
    (raw.specGraph !== undefined && raw.specGraph !== null && filled.specGraph === null) ||
    (raw.contracts !== undefined && raw.contracts !== null && filled.contracts === null);
  // A1-21: ONE flag list, used by BOTH this log-if and the early-return at the
  // end — a payload that only triggered hole/chatLog/research/impl/scorecard/
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
      ? ` currentPhase:${String(cp)}→${currentPhase}`
      : edgeRepaired
        ? ` edge:locked→P${currentPhase} (record promoted to ready)`
        : holeRepaired
          ? ` hole:edge→P${currentPhase} (contiguous sealed clamp)`
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
  // P13: a persisted ACTIVE wild run was force-stopped by hydration — say so
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
        detail: "Session reloaded — active wild run stopped (no driver survives reload).",
      },
    ].slice(-200);
  }
  if (filled.packet && filled.lattice && filled.specGraph && !anyRepaired && !hw.stopped) {
    // A1-21: the same flag list the repair log above used — every repair
    // re-stamps (attachAlgorithms) instead of shipping a stale packet.
    return filled;
  }
  return attachAlgorithms(filled);
}

// ---------------------------------------------------------------------------
// Optional real-backend integration (async) — runPhaseAsync / runP6Real
//
// The only async seams in the engine. When the relevant backend is configured
// they fetch real data and inject it; otherwise they resolve to the exact
// deterministic synchronous result. Every failure (not-configured, network,
// timeout, invalid response) falls back gracefully — a run never strands and
// never fabricates output (B-18/B-23 honesty contract).
// ---------------------------------------------------------------------------

/** Phases whose artifacts can be upgraded from illustrative to real research. */
const RESEARCH_PHASES: ReadonlySet<PhaseId> = new Set([0, 7, 11]);

type ResearchFinding = { title: string; url: string; content?: string; score?: number };

// ---------------------------------------------------------------------------
// 99 §5 (fixes/128_x6) — compound/brand-name research-pollution guard.
//
// A raw product name like "Coffeehouse2Home" used to be spliced verbatim into
// every research query; search engines split the compound and returned literal
// coffee-shop hits (5/15 findings in the merged-suite run) and the LLM
// narratives then hallucinated a coffeehouse retail component. The guard below
// is pure + deterministic (no LLM, no network — corpus-dedup hashes and
// research_hash stay stable for identical inputs):
//   1. name tokens (split on camelCase + separators) that are plain dictionary
//      words or generic company noise (coffee, home, house, shop, app,
//      software, inc…) are DROPPED — brand fragments never reach a query;
//   2. every query is seeded with the DOMAIN REGISTER — a small curated noun
//      phrase per known domain (project.domain) — so a compound brand that
//      contributes nothing still yields a correct domain query;
//   3. the register is then padded with the brief's most frequent content
//      nouns (frequency-ranked, deterministic) so product-specific vocabulary
//      (flip, showing, work order, ledger…) rides along.
// The engine corpus entry, the headless bare-node overlay and the crew
// researcher all build through these two exports, so their queries stay
// byte-identical by construction (no more mirror drift).
// ---------------------------------------------------------------------------

/** Brand/dictionary-word noise — compound-name fragments never searched on. */
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

/** Plain function words — never mined as domain nouns. */
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

/** Curated domain register: normalized domain → guaranteed noun seed. */
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

/** Deterministic plural collapse for mining (tenants/tenant → tenant). */
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
  // JS sort is stable — equal counts keep first-seen order (deterministic).
  return order
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, cap);
}

/**
 * Build ONE deterministic, pollution-guarded research query for a project.
 * `topic` is the phase-specific tail ("architecture feasibility 2026" for P0,
 * a phase title for the crew researcher, …). Exported so the headless live
 * overlay and the crew researcher build byte-identical queries to the engine's
 * corpus entries (no mirror drift — fixes/128_x6 single-sources the builder).
 */
export function researchQueryText(project: Project, topic: string): string {
  const words: string[] = [];
  const seen = new Set<string>();
  const add = (w: string): void => {
    const t = w.trim().toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      words.push(t);
    }
  };
  const name = (project.name ?? "").trim();
  const domain = (project.domain ?? "").trim();
  const brief = (project.brief ?? "").trim();
  const nameFragments = new Set(researchNameTokens(name));

  // 1) Domain register + domain words (the product category, guaranteed).
  const domainKey = domain.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const register = RESEARCH_DOMAIN_REGISTER[domainKey];
  if (register) {
    for (const w of register.split(" ")) add(w);
    for (const w of domainKey.split(" ")) add(w);
  } else {
    for (const w of researchNameTokens(domain)) {
      if (!RESEARCH_BRAND_NOISE.has(w) && !RESEARCH_STOPWORDS.has(w)) add(w);
    }
  }

  // 2) Brief register padding — the product's actual vocabulary.
  for (const w of researchBriefNouns(brief, 8, nameFragments)) add(w);

  // 3) Distinctive name fragments only (brand/dictionary noise already dropped).
  for (const w of nameFragments) {
    if (!RESEARCH_BRAND_NOISE.has(w) && !RESEARCH_STOPWORDS.has(w)) add(w);
  }

  if (words.length === 0) {
    // Last-resort floor — never empty, never fabricated.
    for (const w of nameFragments) add(w);
    if (words.length === 0) add(domainKey || "product");
  }
  const topicTail = topic.trim();
  return topicTail ? `${words.join(" ")} ${topicTail}` : words.join(" ");
}

/** Phase-topic tail per research phase (deterministic; only research phases carry a tail). */
const RESEARCH_TOPIC_TAIL: Readonly<Partial<Record<PhaseId, string>>> = {
  0: "architecture feasibility 2026",
  7: "competitors market landscape",
  11: "live tools and API augmentation",
};

export function researchQueryFor(project: Project, phase: PhaseId): string {
  return researchQueryText(
    project,
    RESEARCH_TOPIC_TAIL[phase] ?? "live tools and API augmentation",
  );
}

function formatResearchFinding(item: ResearchFinding): string {
  const body = (item.content ?? "").trim();
  return [`# ${item.title}`, "", body || "(no summary)", "", `Source: ${item.url}`].join("\n");
}

/** M-07: honesty footer appended to every LLM phase-narrative artifact body so a
 *  consuming agent can tell grounded prose from invention (mirrors the report-intake
 *  "unverified by engine" footer discipline). */
const NARRATIVE_GROUNDED_FOOTER = (n: number) => `\n\n> generated prose — grounded in ${n} fetched sources`;
const NARRATIVE_UNGROUNDED_FOOTER =
  "\n\n> generated prose — not grounded in fetched sources; verify before relying on it";

/**
 * Fetch real research for a research phase. Returns null when the phase is not a
 * research phase — callers then take the deterministic path unchanged. For a
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
} | null> {
  if (!RESEARCH_PHASES.has(phase)) return null;

  // 1) Real web research (Tavily / free search) — optional; honest fallback when unconfigured.
  let items: ResearchFinding[] = [];
  let provider: string | null = null;
  let unavailable = false;
  try {
    const result = await research(researchQueryFor(project, phase));
    if (result && result.ok === true && (result.items ?? []).length > 0) {
      items = result.items as ResearchFinding[];
      // M-01: remember which backend actually served the findings (for project.research).
      provider = result.provider ?? null;
    } else if (!result || result.ok !== true) {
      // not-configured / backend failure: live research was attempted and could
      // not execute. (ok:true with zero items means it ran and found nothing —
      // unavailable stays false so the DoD corpus probe stays honestly unmet.)
      unavailable = true;
    }
  } catch {
    unavailable = true;
  }

  // 2) LLM phase narrative (DeepSeek) — fires whenever the LLM is configured,
  // independent of whether live research succeeded.
  let narrative: string | null = null;
  try {
    if ((await llmStatus()).configured) {
      const ground =
        items.length > 0
          ? `Grounded in these findings:\n${items
              .slice(0, 5)
              .map((it) => `- ${it.title}: ${(it.content ?? "").slice(0, 200)}`)
              .join("\n")}`
          : "(no live research available — reason from the brief and lattice only)";
      const comp = await complete(
        `Write a concise one-paragraph phase narrative for ${project.name} (${phaseDef(phase).code} ${phaseDef(phase).title}). ${ground}\n\nBrief: ${project.brief.slice(0, 400)}`,
      );
      if (comp && comp.ok === true && typeof comp.text === "string" && comp.text.trim()) {
        narrative = comp.text.trim();
      }
    }
  } catch {
    narrative = null;
  }

  return { items, narrative, provider, unavailable };
}

/**
 * Live research + LLM-narrative layering over the deterministic engine (M-10 seam).
 *
 * Exported so the headless driver (and any other caller) can apply the SAME live
 * layer the UI's runPhaseAsync uses — research phases (0/7/11) fetch real findings,
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
 * (`modelRoute: "deepseek-flash"`) on the returned project — the packet then
 * reports the model that really ran, not a default label.
 *
 * fixes/147 (E2): an optional additive third param `deps` carries the P6
 * journey driver's tree-failure context. When present (and only for phase 6)
 * it is forwarded verbatim into codegen liveP6Synthesis as its deps — the
 * ONLY tree-failure reader codegen has (deps?.treeFailure feeds the bounded
 * repair re-prompts). Absent ⇒ the legacy byte-identical
 * liveP6Synthesis(project) call: zero behavior change for every existing
 * caller (UI store, runPhaseAsync, runUntilGate, wild-mode).
 */

/** Optional live-layer P6 synthesis context (see liveLayer's doc above). */
export type LiveLayerDeps = {
  treeFailure?: string;
};

/**
 * fixes/150 (G4): the keyed P6 upgrade core shared by liveLayer AND the wild
 * P6 step — ONE seam for both faces of the product (149_a5 F1 / 149_a4 #2:
 * the 'leave it alone' face must produce the same artifact a keyed store run
 * does, never the deterministic floor under an LLM reviewer that praises it).
 * This is the original inline liveLayer block moved verbatim: direct-env
 * probe (isDeepSeekConfigured — a plain process.env read; NEVER the server-fn
 * llmStatus, which reports unconfigured under bare Node, the only host the
 * CLI/headless/wild drivers run on), the fixes/148 (F1 follow-up) delivery
 * kind stamp from the brief classifier BEFORE the codegen call (the M1 flip:
 * a kind-absent webapp brief must route to the chunked tree, not the ≤8
 * single-module path), then codegen liveP6Synthesis via the concatenated
 * dynamic-import idiom (client-bundle-safe; a codegen refusal/throw returns
 * the floor unchanged — the existing safety net). NEVER throws: every
 * failure degrades to the deterministic floor. Keyless ⇒ the input reference
 * is returned unchanged (byte-identical legacy call).
 */
async function upgradeP6Keyed(floor: Project, deps?: LiveLayerDeps): Promise<Project> {
  try {
    const dsSpec = clientSafeServerSpecifier("deepseek");
    const ds = (await import(dsSpec)) as { isDeepSeekConfigured?: () => boolean };
    const configured = typeof ds.isDeepSeekConfigured === "function" ? ds.isDeepSeekConfigured() : false;
    if (!configured) return floor;
    let p: Project = floor;
    // fixes/148 (F1 follow-up): real journeys arrive kind-absent (the
    // create path never classifies), and codegen's tree trigger is
    // kind-scoped — a kind-absent webapp brief would silently take the
    // ≤8 single-module path and ship no tree. Stamp the delivery kind
    // from the brief classifier here, BEFORE the codegen call: ui →
    // "app" (webapp tree), cli-tool → "tool" (CLI tree), library →
    // kind stays absent (the honest single-module library path).
    if (p.kind === undefined || p.kind === null) {
      const surfaceKind = uiKindOf(p);
      if (surfaceKind === "ui") p = { ...p, kind: "app" };
      else if (surfaceKind === "cli-tool") p = { ...p, kind: "tool" };
    }
    const codegenSpec = clientSafeServerSpecifier("codegen");
    const codegen = (await import(codegenSpec)) as {
      liveP6Synthesis?: (p: Project, deps?: { treeFailure?: string }) => Promise<Project>;
    };
    if (typeof codegen.liveP6Synthesis === "function") {
      // fixes/147 (E2): the journey driver's tree-failure tail rides the
      // additive `deps` param into codegen (deps.treeFailure is codegen's
      // ONLY failure-context reader); absent ⇒ liveP6Synthesis(done) —
      // byte-identical legacy call.
      const upgraded = await codegen.liveP6Synthesis(p, deps);
      if (upgraded && typeof upgraded === "object" && upgraded !== p) return upgraded;
    }
    return p;
  } catch {
    /* keyed synthesis unavailable → deterministic floor stands */
    return floor;
  }
}

export async function liveLayer(project: Project, phase: PhaseId, deps?: LiveLayerDeps): Promise<Project> {
  const real = await fetchResearch(project, phase);
  let done = applyPhaseResult(project, phase);
  // P0-01 Part B (fixes/97): keyed P6 synthesis — when the LLM is configured,
  // the deterministic placeholder module is upgraded to a brief-faithful,
  // machine-verified module by liveP6Synthesis (server-only; runtime dynamic
  // import so the *.server.* boundary never leaks into the client bundle).
  // Keyless runs keep the honest placeholder (p6-brief-fit fails by
  // construction). Any failure degrades to the deterministic floor.
  if (phase === 6) {
    // fixes/209: single path via upgradeP6Keyed (was duplicated inline + dead helper).
    // Bare-node-safe DeepSeek probe + kind stamp + liveP6Synthesis live inside the helper.
    // Keyless / refusal → floor unchanged. stampP6ReqTrace always runs on the final P6 state.
    done = await upgradeP6Keyed(done, deps);
    // fixes/144 (M2 lane B4): stamp the p6-arch reqTrace on the FINAL P6 state
    // — after keyed synthesis upgraded the project with a generatedTree (the
    // applyPhaseResult stamp above already ran pre-upgrade and only fires on a
    // tree-carrying re-apply). A tree-absent result — keyless, or a refused
    // keyed synthesis that landed the single-module floor — is returned
    // unchanged: p6-arch passes it vacuously (legacy path).
    done = stampP6ReqTrace(done);
  }
  const extras: Artifact[] = [];
  // E-14: true only when a real DeepSeek call succeeded in this live pass.
  let llmRan = false;
  // fixes/252 (W19-L1 · OV-13): coded rows for keyed degrades that used to be
  // comment-only. Empty on every clean/keyless pass, so the returned project is
  // then byte-identical to before — the row is evidence, never behavior.
  const degradeRows: JsonLog[] = [];

  // Apply the E-13/E-14 provenance stamps to whichever branch result wins.
  const stamp = (base: Project): Project => {
    // 99 §6 (fixes/128_x6): meta.liveUnavailable is the EXPLAINED dead-end
    // flag ("live web research could not run"). It must never coexist with a
    // corpus that actually landed: once real findings arrive in THIS live pass
    // (or they arrived on a prior attempt of the same project), the flag is
    // cleared — a stale true would contradict 15 real findings + 3 real
    // narratives (the merged-suite contradiction 99 §6 recorded).
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

  if (real) {
    // Research phase: real findings + narrative. Competitor rows are NEVER promoted
    // to source:"cited" (M-01) — template rows carry no per-row evidence; real
    // findings persist as the project.research corpus rendered in the packet.
    const researchArtifacts: Artifact[] = real.items.map((it, i) =>
      art(phase, "research", it.title || `Research finding ${i + 1}`, formatResearchFinding(it), "markdown"),
    );
    if (real.narrative) {
      llmRan = true;
      // M-07: honesty footer — grounded when ≥1 fetched finding backs the prose.
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
      // H-04 (fixes/115): dedup against the existing corpus before appending —
      // a research phase re-run after a rejection must not append a duplicate
      // entry for the same query+URL set (unbounded growth + research_hash
      // churn). Mirror deepenResearch's query+sorted-URL-set identity.
      const urlsOf = (items: readonly { url: string }[]): string =>
        [...new Set(items.map((it) => it.url))].sort().join("\n");
      const already = (done.research ?? []).some(
        (e) => e.query === corpusEntry.query && urlsOf(e.items ?? []) === urlsOf(corpusEntry.items),
      );
      return stamp(already
        ? { ...done, artifacts: [...done.artifacts, ...researchArtifacts] }
        : {
            ...done,
            research: [...(done.research ?? []), corpusEntry],
            artifacts: [...done.artifacts, ...researchArtifacts],
          });
    }
    if (researchArtifacts.length === 0) return stamp(done);
    return stamp({ ...done, artifacts: [...done.artifacts, ...researchArtifacts] });
  }

  if ((await llmStatus()).configured) {
    // Non-research phase: an LLM narrative for every phase, plus real constraint
    // extraction at P2 (Constraint Scheduler). All config-gated + try/caught.
    try {
      const narrative = await phaseNarrative(
        { name: project.name, brief: project.brief, domain: project.domain },
        phaseDef(phase),
      );
      if (narrative.ok) {
        llmRan = true;
        // M-07: no fetched sources exist for this path — the prose is ungrounded by
        // construction and must say so.
        extras.push(
          art(phase, "docs", "Phase narrative (LLM)", `${narrative.text}${NARRATIVE_UNGROUNDED_FOOTER}`, "markdown"),
        );
      } else {
        // OV-13 (fixes/252): a keyed narrative refusal used to be silent here —
        // the run then read exactly like a keyless one. Record it, coded.
        degradeRows.push(liveDegradeRow(phase, "narrative", narrative, "RT_E_LLM_REJECTED"));
      }
    } catch (err) {
      /* narrative unavailable → deterministic result stands (recorded, never
         silent — OV-13, fixes/252) */
      degradeRows.push(liveDegradeRow(phase, "narrative", err, "RT_E_LLM_REJECTED"));
    }
    if (phase === 2) {
      try {
        const cons = await extractConstraints(project.brief);
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
          // recorded — the call ran and found none; only a coded refusal (or a
          // throw, below) is a degrade.
          degradeRows.push(liveDegradeRow(phase, "constraints", cons, "RT_E_LLM_REJECTED"));
        }
      } catch (err) {
        /* constraints unavailable → deterministic result stands (recorded,
           never silent — OV-13, fixes/252) */
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
 * fetchResearch the live layer uses — injected via `fetcher` for tests),
 * appends ONE deduplicated corpus entry (by query + sorted URL set — idempotent
 * re-runs never duplicate), appends research/narrative artifacts (deduped by
 * artifact id), stamps `meta.liveUnavailable` when live research could not run
 * (explained dead-end), logs `research.deepened`, re-records the phase gate via
 * recordGateInto (E-02 — fresh evidenceHash + gate artifact) and re-stamps the
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
  // 99 §6 (fixes/128_x6): liveUnavailable is the explained dead-end flag and
  // must never coexist with a corpus that landed — a deepen that brings real
  // findings in clears a stale flag from an earlier failed attempt, and a
  // deepen that really ran an LLM narrative stamps the honest route (E-14).
  if (res.unavailable && res.items.length === 0) {
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
          `${query} · ${res.items.length} finding(s)` +
          (res.narrative ? " · narrative" : "") +
          (res.unavailable && res.items.length === 0
            ? " · live research unavailable (not configured or failed)"
            : ""),
      },
    ].slice(-200),
  };
  // E-02/E-13: re-record the completed phase's gate — a fresh evidenceHash (and
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
 * phase's exit evidence — callers (store/headless ingest) surface the drift as
 * a `regression.drift` warn log; nothing here mutates prior records.
 * Phases without a recorded gate (legacy runs that predate E-02 gate
 * recording) cannot be compared and are skipped.
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
 * fixes/217f (216y §2.3 G2): the record an unexpected live-layer failure leaves
 * behind. `runPhaseAsync`'s floor — the deterministic applyPhaseResult result —
 * is no longer a silent substitute for a failed live pass: this row carries the
 * real thrown message and the explicit statement that the floor was used.
 *
 * Honesty: the throw is deliberately left UNCLASSIFIED — this seam owns no
 * classifier, and guessing an RT_E code would invent a cause (216y G3 already
 * maps the common env/network failures to RT_E_UNKNOWN, whose own doc says the
 * failure is opaque). The message is clipped on an explicit budget so a hostile
 * or enormous error string cannot blow the bounded ledger (this row rides the
 * same ≤200-row `logs` window applyPhaseResult maintains).
 */
const LIVE_FAILURE_MESSAGE_BUDGET = 160;

/** Exported for headless.runPhase's outer catch (fixes/255 · W20-L3): the CLI
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
      message.length > LIVE_FAILURE_MESSAGE_BUDGET ? "…" : ""
    } — deterministic floor used instead`,
  };
}

/**
 * fixes/252 (W19-L1 · OV-13 + OV-29): a CODED row for a live-layer degrade that
 * used to be comment-only — a keyed failure must never read like a keyless run.
 *
 * Reuses the G2 shape (`liveLayerFailureRow` above): same `warn` level, same
 * `p<phase>.live.*` event family, same bounded detail + explicit "deterministic
 * result used instead" statement. Unlike G2's deliberately unclassified row,
 * this one LEADS with an `RT_E_*` code: the failure arrives already classified
 * (llm.ts / llm-tasks carry the provider's code; the research backends return
 * coded refusals), so no cause is ever invented — an unregistered string is not
 * trusted, and a thrown error is classified with the caller's domain fallback
 * (errors.ts `classifyError`, whose own doc names the LLM caller's
 * `RT_E_LLM_REJECTED` default for exactly this use).
 *
 * Telemetry purity (AGENTS.md #7): the factory NEVER throws — even a hostile
 * failure value (a throwing getter, an unprintable object) degrades to a bare
 * coded row — so recording a degrade can never break the run it observes.
 */
export type LiveDegradeKind = "narrative" | "constraints" | "research";

/** Message budget: code + kind + message + statement stay ≤240 chars total. */
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
 *  prose, else an honest "no failure detail" — never an empty string. */
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
      detail: `${code} · live ${kind} failed: ${clipped}${
        message.length > LIVE_DEGRADE_MESSAGE_BUDGET ? "…" : ""
      } — deterministic result used instead`,
    };
  } catch {
    // Hostile failure value (throwing getter / unprintable) → bare coded row.
    return {
      ts: Date.now(),
      phase,
      level: "warn",
      event: `p${phase}.live.${kind}.failed`,
      detail: `${fallbackCode} · live ${kind} failed: no failure detail — deterministic result used instead`,
    };
  }
}

/**
 * Append coded degrade rows to a live-layer result. Returns the SAME reference
 * when there is nothing to add — a clean or keyless pass stays byte-identical
 * (the OV-13 invariant: the row is evidence, never a behavior change) — and
 * rides the same ≤200-row window as every other log writer. Shared by the
 * engine's liveLayer and headless's bare-node overlay (OV-29 folds into the
 * same shape).
 */
export function withLiveDegradeRows(base: Project, rows: readonly JsonLog[]): Project {
  if (rows.length === 0) return base;
  return { ...base, logs: [...(base.logs ?? []), ...rows].slice(-200) };
}

/**
 * W-02 (fixes/271 · §R1-f02 item 3): console-side loader for the ONE keyed P6
 * edge. Returns null when headless exports no runP6Edge (old bundle) so the
 * caller falls back to the existing liveLayer path; a seam THROW propagates
 * to runPhaseAsync's catch (deterministic floor + a coded failure row —
 * the same G2 contract every other runPhaseAsync throw gets).
 */
async function viaHeadlessP6Edge(project: Project): Promise<Project | null> {
  const headlessSpec = "./head" + "less.ts";
  const hl = (await import(headlessSpec)) as { runP6Edge?: (p: Project) => Promise<Project> };
  if (typeof hl.runP6Edge !== "function") return null;
  return await hl.runP6Edge(project);
}

/**
 * Async entry point that wires optional real research (and an optional LLM phase
 * narrative) into the deterministic engine — exactly `liveLayer` with a hard
 * safety net. For research phases it fetches real data and layers it on top of the
 * synchronous applyPhaseResult; for every other phase it is exactly
 * applyPhaseResult. When no backend is configured this resolves to the identical
 * deterministic result (no behavior change). Any unexpected error falls back to
 * the deterministic path — a run never strands and never fabricates output — and
 * the fallback is RECORDED as a bounded `p<phase>.live.failed` warn row (fixes/217f
 * G2: a degraded live pass stays distinguishable from a deliberately deterministic
 * one), never swallowed silently.
 */
export async function runPhaseAsync(project: Project, phase: PhaseId): Promise<Project> {
  try {
    // W-02 (fixes/271 · §R1-f02): the console's per-phase live path must reach
    // the same tested-mint seam run/gate/wild use. Phase 6 + keyed ⇒ route
    // through headless.runP6Edge (lazily — this module stays client-safe);
    // keyless/browser (probe false) ⇒ the existing liveLayer path, unchanged.
    if (phase === 6 && keyedDeepSeekConfigured()) {
      const reached = await viaHeadlessP6Edge(project);
      if (reached !== null) return reached;
    }
    return await liveLayer(project, phase);
  } catch (err) {
    // Any unexpected error must never break a run — the deterministic path is the floor.
    // G2 (216y §2.3): the floor is the OUTCOME, never the whole story — log the failure
    // on the returned project so the degradation is visible in the record.
    const floor = applyPhaseResult(project, phase);
    return { ...floor, logs: [...floor.logs, liveLayerFailureRow(phase, err)].slice(-200) };
  }
}

/**
 * Parallel real-execution helper for P6 (M-03: real run → gate convergence). Runs
 * the generated module through the configured runner; when it is not configured
 * (or the module is absent / the run cannot start) returns `{ ok: false, result: null }`
 * so callers fall back to the deterministic self-test. When the bounded runner DID
 * execute the module, the returned `project` carries `lastTest` stamped from the
 * real exit code (`ok: exitCode === 0`, detail = stdout/stderr head ≤ 400 chars) —
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
      // Deterministic fallback: the runner never executed — lastTest (the sync
      // template self-test verdict) stands untouched.
      return { ok: false, result: null };
    }
    if (result.ok) {
      // Real bounded run completed → converge into the gate: lastTest now reflects
      // the ACTUAL exit code, and the returned project lets the caller re-run DoD.
      const ok = result.exitCode === 0;
      // audit-39 1.3: a HEALTHY quiet module (exit 0, no stdout/stderr —
      // the P6 engine template prints nothing) must not flip the recorded
      // gate to FAIL: the p6-test probe requires a non-empty detail, so a
      // quiet success gets an honest deterministic detail instead of "".
      const detail = (result.stdout || result.stderr || `exit ${result.exitCode} (no output — clean run)`).slice(0, 400);
      return { ok: true, result, project: { ...project, lastTest: { ok, detail } } };
    }
    // Runner refused / timed out / failed to spawn — no exit code exists, so no gate
    // verdict is minted; report the raw outcome and keep the deterministic fallback.
    return { ok: true, result };
  } catch {
    return { ok: false, result: null };
  }
}

// ---------------------------------------------------------------------------
// P13 Wild Mode — bounded autonomous step (engine.wildStep)
//
// One call = ONE bounded macro-action on the current legal edge (never more
// than one phase execution per call, plus the review/approval/advance that
// edge resolution implies), so a headless driver can loop wildStep with a
// hard iteration cap and full observability. Every auto decision is appended
// to the ledger (wild.* events — append-only, never deleted) AND mirrored onto
// `Project.wildRun` (active/pause/phase/lastAutoLog/lastAutoAt/stoppedAt) so
// the console (B7) can stream the run from one object.
//
// Step semantics per call, in order:
//   • gate open (awaiting_hitl) → Auto-Review decides (see gate path): approve
//     (hard-DoD post-check when enforceDod) or honest pause (human-only gate,
//     classifier not configured, classifier reject/error, DoD fail).
//   • ready/running edge → deterministic floor execution (applyPhaseResult —
//     the same synthesis the sync store run uses), gate recorded for completed
//     phases, then the classifier judges the outputs before the loop leaves
//     the phase; reject or (enforceDod) a failing runGate = paused + a "Hard
//     DoD block" artifact, approve = advance one phase.
//   • P12 sealed → run completes (wildRun.active=false, stoppedAt stamped).
//   • paused/stopped/mode-off/inactive → noop (zero mutation).
//
// Classifier honesty: the default reviewer (wild-mode.server.ts) is
// configured-only (deepseek-v4-flash). When it is not configured the loop uses
// the deterministic DoD floor for non-gate phases and NEVER fabricates a
// judgment for a human approval gate — it pauses with an honest log instead.
// ---------------------------------------------------------------------------

export type WildStepOutcome = "advanced" | "completed" | "paused" | "noop";

export type WildStepResult = {
  project: Project;
  outcome: WildStepOutcome;
  /** True when the call committed any state change (false for noop). */
  ran: boolean;
  error?: string;
  /**
   * Machine-readable pause/failure class (errors.ts, B5). Absent on noop —
   * a driver loop branches on `code`, never on prose. Mapping: classifier
   * error/short feedback → RT_E_LLM_REJECTED · classifier not configured →
   * RT_E_LLM_NOT_CONFIGURED · human-only gate / hard-DoD block / review
   * reject → RT_E_GATE_PENDING · locked/rejected/missing-record/illegal
   * transition → RT_E_PHASE_ILLEGAL · unexpected engine throw → RT_E_INTERNAL.
   */
  code?: ErrorCode;
};

/** Reviewer seam (defaults to the deepseek-v4-flash Auto-Review classifier). */
export type WildReviewer = (ctx: WildReviewContext) => Promise<WildClassifierResult>;

/**
 * R13-f02 (W33 lane L2) — the ONE read accessor for `project.wildPlan`
 * (types.ts:170). Returns the STORED plan when the record carries one; else an
 * HONEST EMPTY plan (`steps: []`, `source: "empty"`, a note naming the owning
 * row) — never invented steps. Pure + client-safe: the store's read path
 * (`wildPlanFor`) and any renderer call this; the real generation lives
 * server-side (`headless.generateWildPlan` → planning.planSteps, keyed hosts).
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
      "no planner plan on this record yet (TODO(R13-f02): generation runs keyed at wild start — " +
      "headless.generateWildPlan; classifier review + pause-before-first-mutation remain)",
  };
}

/**
 * Wild-step options (fixes/109 CAP-5, additive + purity-preserving). `opts`
 * today carries only the reviewer; `onEvent` is an OPTIONAL telemetry sink the
 * engine invokes with serializable RtEventSeed rows at the defined emission
 * points (step_start / step_ok / step_paused / step_error). Absent ⇒ zero
 * overhead, zero side effects — the engine never imports or calls a host sink
 * itself (DG-8).
 */
export type WildStepOptions = {
  reviewer?: WildReviewer;
  onEvent?: (seed: RtEventSeed) => void;
  /** W-01 (fixes/271 · §R1-f01): test seam for the P6 execution edge. Present
   *  ⇒ phase 6 executes through THIS function (any key state); absent ⇒ the
   *  production guard (keyed ⇒ headless.runP6Edge, keyless ⇒ the deterministic
   *  floor, byte-identical to the pre-seam engine). */
  p6Edge?: (p: Project) => Promise<Project>;
};

export function wildLog(p: Project, phase: PhaseId, level: JsonLog["level"], event: string, detail: string): Project {
  return {
    ...p,
    logs: [...p.logs, { ts: Date.now(), phase, level, event, detail }].slice(-200),
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

/** Pause the run (pause:true, active stays true) + ledger entry. */
export function wildPause(
  p: Project,
  phase: PhaseId,
  level: JsonLog["level"],
  event: string,
  detail: string,
): Project {
  const stamped = wildPatch(p, { pause: true, lastAutoLog: detail.slice(0, 300), lastAutoAt: Date.now() });
  return wildLog(stamped, phase, level, event, detail);
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
): WildReviewContext {
  return { project, phase, reason, gate: wildGateInfo(project, phase) };
}

/**
 * Resolve the reviewer for one decision. Classifier ok → its verdict verbatim.
 * Classifier not-configured → deterministic DoD floor verdict for advance
 * decisions (approve iff runGate passes); for an OPEN GATE the loop must not
 * fabricate a judgment, so the caller pauses instead (returns null).
 * Classifier error / too-short feedback → honest error, never a guessed verdict.
 */
async function resolveWildReview(
  reviewer: WildReviewer,
  project: Project,
  phase: PhaseId,
  reason: "advance" | "gate",
): Promise<
  | { kind: "verdict"; verdict: "approve" | "reject"; feedback: string; source: "classifier" | "dod" }
  | { kind: "unconfigured-gate" }
  | { kind: "error"; error: string }
> {
  const ctx = wildReviewCtx(project, phase, reason);
  let res: WildClassifierResult;
  try {
    res = await reviewer(ctx);
  } catch (err) {
    return { kind: "error", error: err instanceof Error ? err.message : String(err) };
  }
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
    // machine-checkable gate — no fabricated qualitative review.
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
      feedback: `Deterministic DoD review: P${phase} unmet — ${g.unmet.map((x) => x.id).join(", ") || "unknown criteria"}.`,
      source: "dod",
    };
  }
  return { kind: "error", error: res.error ?? "Auto-Review classifier failed" };
}

/** Record the review verdict on the ledger (feedback verbatim, >= 12 chars). */
function wildReviewLog(p: Project, phase: PhaseId, source: string, feedback: string): Project {
  return wildLog(p, phase, "info", "wild.review", `P${phase} review (${source}): ${feedback}`);
}

/** Approve an open approval gate (classifier self-approval), with checks. */
async function wildApproveGate(
  p: Project,
  phase: PhaseId,
  reviewer: WildReviewer,
): Promise<WildStepResult> {
  const gate = p.hitl;
  if (!gate || gate.phase !== phase) {
    const paused = wildPause(p, phase, "error", "wild.error", `P${phase} approval gate mismatch — wild run paused.`);
    return { project: paused, outcome: "paused", ran: true, error: "Approval gate mismatch.", code: "RT_E_PHASE_ILLEGAL" };
  }
  // R3/B-03 parity: a human-only gate (failed P6 sandbox, P0 reframe) is never
  // machine-approved — Wild Mode pauses and asks the human.
  if (gate.forceHuman) {
    const paused = wildPause(
      p,
      phase,
      "warn",
      "wild.paused_human",
      `P${phase} gate is human-only (forceHuman) — Wild Mode cannot self-approve it.`,
    );
    return { project: paused, outcome: "paused", ran: true, error: `P${phase} is a human-only gate.`, code: "RT_E_GATE_PENDING" };
  }
  const decision = await resolveWildReview(reviewer, p, phase, "gate");
  if (decision.kind === "unconfigured-gate") {
    const paused = wildPause(
      p,
      phase,
      "warn",
      "wild.paused_classifier",
      `Auto-Review classifier not configured — P${phase} approval gate cannot be self-approved.`,
    );
    return { project: paused, outcome: "paused", ran: true, error: "Classifier not configured.", code: "RT_E_LLM_NOT_CONFIGURED" };
  }
  if (decision.kind === "error") {
    const paused = wildPause(p, phase, "error", "wild.error", `P${phase} Auto-Review failed: ${decision.error}`);
    return { project: paused, outcome: "paused", ran: true, error: decision.error, code: "RT_E_LLM_REJECTED" };
  }
  const next = wildReviewLog(p, phase, decision.source, decision.feedback);
  if (decision.verdict === "reject") {
    const paused = wildPause(
      next,
      phase,
      "warn",
      "wild.reject",
      `P${phase} review REJECTED: ${decision.feedback}`,
    );
    return { project: paused, outcome: "paused", ran: true, error: decision.feedback, code: "RT_E_GATE_PENDING" };
  }
  // Self-approval. approveHitl completes the phase and moves the cursor; the
  // ledger decision row records the machine actor + the classifier feedback as
  // its note (T2 parity — nothing fabricated, nothing deleted).
  const candidate = approveHitl(next, { decidedBy: "autopilot", note: decision.feedback.slice(0, 400) });
  if (candidate === next) {
    const paused = wildPause(next, phase, "error", "wild.error", `P${phase} approval did not apply — wild run paused.`);
    return { project: paused, outcome: "paused", ran: true, error: "Approval did not apply.", code: "RT_E_INTERNAL" };
  }
  // P10 hard-DoD post-check: the gate's own DoD only becomes evaluable AFTER
  // the approval completes the phase (its criteria include "HITL approved") —
  // so the enforcement check runs on the post-approval shape. A failing gate
  // is NOT committed: the candidate is discarded and the block is stamped on
  // the pre-approval project (no fabricated ledger row, no cursor move).
  if (candidate.enforceDod === true) {
    const post = runGate(candidate, phase);
    if (!post.pass) {
      const blocked = hardDodBlockInto(next, phase, post);
      const paused = wildPause(
        blocked,
        phase,
        "warn",
        "wild.paused_dod",
        `P${phase} DoD unmet after approval — hard gate holds: ${post.unmet.map((g) => g.id).join(", ") || "n/a"}`,
      );
      return { project: paused, outcome: "paused", ran: true, error: hardDodMessage(phase, post), code: "RT_E_GATE_PENDING" };
    }
  }
  // P0-08 Hole A (fixes/97): the gate verdict is recorded AFTER approveHitl
  // compiled the packet — re-stamp so the packet's gate_passed + artifact
  // window reflect the recorded gate, never the pre-gate compile.
  const gated = stampPacket(recordGateInto(candidate, phase));
  const stamped = wildPatch(gated, {
    lastAutoLog: `P${phase} gate self-approved (Auto-Review ${decision.source})`,
    lastAutoAt: Date.now(),
  });
  const done = wildLog(stamped, phase, "info", "wild.approved", `P${phase} gate self-approved (${decision.source}) — ${decision.feedback}`);
  return { project: done, outcome: "advanced", ran: true };
}

/**
 * Judge a just-executed complete phase and leave it (or pause). Callers pass a
 * project whose current edge is COMPLETE and < 12 (the phase being LEFT).
 */
async function wildLeavePhase(
  p: Project,
  phase: PhaseId,
  reviewer: WildReviewer,
): Promise<WildStepResult> {
  const decision = await resolveWildReview(reviewer, p, phase, "advance");
  if (decision.kind === "unconfigured-gate") {
    // Unreachable for advance reviews (only gate reviews return this), but
    // keep it honest anyway.
    const paused = wildPause(p, phase, "warn", "wild.paused_classifier", `Auto-Review classifier not configured — P${phase} cannot be judged.`);
    return { project: paused, outcome: "paused", ran: true, error: "Classifier not configured.", code: "RT_E_LLM_NOT_CONFIGURED" };
  }
  if (decision.kind === "error") {
    const paused = wildPause(p, phase, "error", "wild.error", `P${phase} Auto-Review failed: ${decision.error}`);
    return { project: paused, outcome: "paused", ran: true, error: decision.error, code: "RT_E_LLM_REJECTED" };
  }
  const next = wildReviewLog(p, phase, decision.source, decision.feedback);
  if (decision.verdict === "reject") {
    const paused = wildPause(
      next,
      phase,
      "warn",
      "wild.reject",
      `P${phase} review REJECTED: ${decision.feedback}`,
    );
    return { project: paused, outcome: "paused", ran: true, error: decision.feedback, code: "RT_E_GATE_PENDING" };
  }
  // P10 hard-DoD leave check: the phase being LEFT must pass its exit gate.
  if (next.enforceDod === true) {
    const g = runGate(next, phase);
    if (!g.pass) {
      const blocked = hardDodBlockInto(next, phase, g);
      const paused = wildPause(
        blocked,
        phase,
        "warn",
        "wild.paused_dod",
        `P${phase} DoD unmet — hard gate blocks advance: ${g.unmet.map((x) => x.id).join(", ") || "n/a"}`,
      );
      return { project: paused, outcome: "paused", ran: true, error: hardDodMessage(phase, g), code: "RT_E_GATE_PENDING" };
    }
  }
  const nextPhase = (phase + 1) as PhaseId;
  // Sync-store parity: a phase may only be LEFT when its priors are sealed and
  // the next phase is enterable (audit-31 P1 guard-skip fix).
  if (!priorsSealed(next.phases, nextPhase) || !canEnter(phase, nextPhase)) {
    const paused = wildPause(
      next,
      phase,
      "warn",
      "wild.paused_guard",
      `Illegal advance P${phase} → P${nextPhase}: priors not sealed or phase not enterable.`,
    );
    return { project: paused, outcome: "paused", ran: true, error: "Guard blocked illegal advance.", code: "RT_E_PHASE_ILLEGAL" };
  }
  const advanced: Project = {
    ...next,
    currentPhase: nextPhase,
    status: "running",
    phases: next.phases.map((r) => (r.id === nextPhase ? { ...r, status: "ready" as const } : r)),
  };
  const stamped = wildPatch(advanced, { lastAutoLog: `P${phase} sealed → P${nextPhase}`, lastAutoAt: Date.now() });
  const done = wildLog(stamped, phase, "info", "wild.advance", `P${phase} sealed → P${nextPhase} (${decision.source})`);
  return { project: done, outcome: "advanced", ran: true };
}

/** P12 sealed (or a complete-cursor project) → finish the run honestly. */
function wildFinalize(p: Project, phase: PhaseId): WildStepResult {
  const stamped = wildPatch(
    { ...p, status: "complete" },
    {
      active: false,
      pause: false,
      stoppedAt: Date.now(),
      lastAutoLog: "Wild run complete — all 13 phases sealed",
      lastAutoAt: Date.now(),
    },
  );
  const done = wildLog(stamped, phase, "info", "wild.complete", "Wild run complete — all 13 phases sealed.");
  return { project: done, outcome: "completed", ran: true };
}

/**
 * W-01/W-02 (fixes/271 · §R1-f01/f02): the wild P6 execution edge — phase 6's
 * ONE keyed path. Loads headless.runP6Edge (keyed synthesis + the tree-run
 * mint, the same seam run/gate use) through the concatenated-specifier idiom
 * (`./head` + `less.ts`, the wildServerSpec precedent above): the TanStack
 * import-protection plugin statically denies direct `*.server.*`/headless
 * imports from the client bundle, so the specifier is computed at runtime.
 * Any load failure / missing export / seam throw falls back to the
 * deterministic floor with an honest warn row (a wild step must never die on
 * a seam-load failure, and the log must never claim the keyed edge ran when
 * it did not).
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
      applyPhaseResult(project, 6),
      6,
      "warn",
      "wild.p6.edge_unavailable",
      `P6 keyed edge unavailable (${msg.slice(0, 160)}) — deterministic floor used.`,
    );
  }
}

/**
 * P13 bounded autonomous step — the headless Wild Mode primitive. See the
 * section header for semantics. Never mutates its input; `opts.reviewer`
 * injects the Auto-Review classifier (tests), defaulting to the real
 * configured-only deepseek-v4-flash classifier.
 */
export async function wildStep(
  project: Project,
  opts?: WildStepOptions,
): Promise<WildStepResult> {
  // fixes/109 CAP-5 emission helpers. `emit` is the OPTIONAL host sink — when
  // absent every helper below is a no-op and the function is byte-identical to
  // the pre-telemetry engine (DG-8 purity: seeds are plain serializable data).
  const emit = opts?.onEvent;
  const runRef =
    project.wildRun?.startedAt !== null && project.wildRun?.startedAt !== undefined
      ? String(project.wildRun.startedAt)
      : null;
  const emitPaused = (result: WildStepResult): WildStepResult => {
    if (emit && result.outcome === "paused") {
      emit({
        level: "warn",
        scope: "wild-step",
        event: "wild.step_paused",
        message: result.error ?? "Wild step paused",
        capture: "src/lib/engine.ts:wildStep",
        code: result.code ?? null,
        phase: project.currentPhase,
        projectId: project.id,
        runRef,
      });
    }
    return result;
  };
  const emitResult = (result: WildStepResult): WildStepResult => {
    if (!emit) return result;
    if (result.outcome === "paused") return emitPaused(result);
    if (result.outcome === "advanced" || result.outcome === "completed") {
      emit({
        level: "info",
        scope: "wild-step",
        event: "wild.step_ok",
        message: `Wild step ${result.outcome}`,
        capture: "src/lib/engine.ts:wildStep",
        phase: project.currentPhase,
        projectId: project.id,
        runRef,
        payload: { outcome: result.outcome },
      });
    }
    return result;
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
      payload: { phase },
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
      return emitPaused({
        project: wildPause(
          project,
          project.currentPhase,
          "warn",
          "wild.paused",
          "Project blocked (rejected phase) — wild run paused; retry is a human decision.",
        ),
        outcome: "paused",
        ran: true,
        error: "Project blocked.",
        code: "RT_E_PHASE_ILLEGAL",
      });
    }
    if (project.status === "complete") {
      return { project, outcome: "noop", ran: false, error: "Project already complete." };
    }
    // Concatenated specifier: the TanStack import-protection plugin statically
    // denies direct `*.server.*` imports from the client bundle; a computed
    // specifier defers the load to runtime (bare-Node hosts resolve it
    // directly; the browser never triggers this path in deterministic mode).
    const wildServerSpec = clientSafeServerSpecifier("wild-mode");
    const reviewer =
      opts?.reviewer ?? (await import(wildServerSpec)).wildClassifierReview;
    const phase: PhaseId = project.currentPhase;
    const rec = project.phases.find((r) => r.id === phase);
    if (!rec) {
      return emitPaused({
        project: wildPause(project, phase, "error", "wild.error", `P${phase} has no phase record — wild run paused.`),
        outcome: "paused",
        ran: true,
        error: "Missing phase record.",
        code: "RT_E_PHASE_ILLEGAL",
      });
    }
    // Open gate on the current edge → classifier decision (approve or pause).
    if (rec.status === "awaiting_hitl" || project.hitl?.phase === phase) {
      emitStart(phase);
      return emitResult(await wildApproveGate(project, phase, reviewer));
    }
    if (rec.status === "complete") {
      emitStart(phase);
      if (phase === 12) return emitResult(wildFinalize(project, phase));
      return emitResult(await wildLeavePhase(project, phase, reviewer));
    }
    if (rec.status === "locked") {
      return emitPaused({
        project: wildPause(project, phase, "error", "wild.error", `P${phase} is locked — wild run paused.`),
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
          `P${phase} was rejected — retry is a human decision; wild run paused.`,
        ),
        outcome: "paused",
        ran: true,
        error: `P${phase} rejected.`,
        code: "RT_E_PHASE_ILLEGAL",
      });
    }
    // Execute the current legal phase — deterministic floor (applyPhaseResult,
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
    // W-01 (fixes/271 · §R1-f01): phase 6 on a keyed host executes through the
    // SHARED keyed P6 edge (headless.runP6Edge — synthesis + the tree-run
    // mint) instead of the deterministic floor. Keyless hosts (and the
    // browser, where keyedDeepSeekConfigured() is false) keep the exact floor
    // bytes; an injected `opts.p6Edge` test seam wins in every key state.
    const p6Edge =
      phase === 6 ? (opts?.p6Edge ?? (keyedDeepSeekConfigured() ? wildP6Edge : null)) : null;
    const executed = p6Edge !== null ? await p6Edge(running) : applyPhaseResult(running, phase);
    const done = wildLog(
      executed,
      phase,
      "info",
      "wild.exec",
      p6Edge === null
        ? `P${phase} executed (deterministic floor)`
        : `P6 executed (${opts?.p6Edge ? "injected edge seam" : "keyed synthesis edge"})`,
    );
    if (done.hitl?.phase === phase) {
      return emitResult(await wildApproveGate(done, phase, reviewer));
    }
    if (phase === 12) {
      // P0-08 Hole B (fixes/97): the terminal packet was compiled inside
      // applyPhaseResult BEFORE the P12 gate was recorded — re-stamp so the
      // final packet's gate_passed for P12 is never null on wild runs.
      return emitResult(wildFinalize(stampPacket(recordGateInto(done, phase)), phase));
    }
    // Phase completed without a gate: record the DoD verdict AND re-stamp the
    // packet (store finishPhase parity — audit-31 convergence fix), then let
    // the reviewer decide whether the loop may LEAVE it.
    const gated = stampPacket(recordGateInto(done, phase));
    return emitResult(await wildLeavePhase(gated, phase, reviewer));
  } catch (err) {
    // Any unexpected engine error pauses the run with an honest ledger entry —
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
