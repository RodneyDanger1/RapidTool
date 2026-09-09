/**
 * Advisory swarm layer over the multi-agent crew protocol (Pillars 2 + 9 —
 * fixes/63_pillars_swarm.md).
 *
 * Specialized sub-agent seat specs (SWARM_ROLES), a deterministic critique
 * loop over the current edge (swarmPlan), pure parallel-DAG metadata
 * (parallelDag), and a loop-back heuristic for downstream conflicts
 * (branchSuggest).
 *
 * Honesty contract (this module is pure by construction):
 * - No network I/O and no LLM dispatch happens here. Every critique carries
 *   `provenance: "deterministic"` and a body line saying no LLM turn ran —
 *   an unconfigured backend can never be mistaken for real analysis. Live
 *   LLM seats stay in ./crew.server.ts, which owns the config gate
 *   (`{ ok: false, reason: "not-configured" }`). The system prompts below are
 *   dispatch-ready on the crew JSON protocol for that (config-gated) pipeline.
 * - Everything is advisory: critiques append artifacts to the returned result
 *   only — they never mutate the project, never touch DoD gates, decisions,
 *   or phase records, and never advance `currentPhase`.
 * - The engine stays linear: parallelDag emits metadata about which phase
 *   pairs *would* be wave-safe, it never schedules anything. `canEnter`
 *   (+1 chain) remains the only way forward.
 */

import type {
  Artifact,
  ArtifactKind,
  PhaseDef,
  PhaseId,
  PhaseRecord,
  Project,
} from "./types.ts";
import type { CrewArtifact, CrewMessageType, CrewModel } from "./crew.ts";
import { PHASES } from "./phases.ts";

// ---------------------------------------------------------------------------
// Crew JSON protocol constants (mirror of crew.server.ts wire contract)
// ---------------------------------------------------------------------------

/**
 * The crew JSON-envelope message kinds (crew.ts / crew.server.ts wire
 * contract). Typed against `CrewMessageType` so a misspelled literal fails
 * typecheck — this is the protocol surface swarm seats may emit on.
 */
export const CREW_PROTOCOL_EMITS: readonly CrewMessageType[] = [
  "plan",
  "research",
  "design",
  "code",
  "review",
  "test",
  "handoff",
  "final",
];

const PROTOCOL_SET: ReadonlySet<string> = new Set(CREW_PROTOCOL_EMITS);

// ---------------------------------------------------------------------------
// Role ids + spec table
// ---------------------------------------------------------------------------

export type SwarmRoleId =
  | "lead-architect"
  | "secops-sentinel"
  | "ast-specialist"
  | "frontend-polish"
  | "integration-tester";

/** Debate order: the lead architect opens, then specialists critique in turn. */
export const SWARM_ROLE_IDS: readonly SwarmRoleId[] = [
  "lead-architect",
  "secops-sentinel",
  "ast-specialist",
  "frontend-polish",
  "integration-tester",
];

export type SwarmRoleSpec = {
  id: SwarmRoleId;
  /** Short human label used inside critique artifacts. */
  label: string;
  /** ROLE_SPECS-compatible tier field (crew.ts CrewModel). */
  model: CrewModel;
  /** ROLE_SPECS-compatible persona system prompt (crew JSON protocol style). */
  system: string;
  /** Per-turn directive a dispatched seat must execute (critique lens). */
  prompt: string;
  /**
   * Crew JSON-protocol message kinds the seat may emit when dispatched by an
   * LLM orchestrator (advisory here — swarm.ts itself never dispatches).
   */
  emit: readonly CrewMessageType[];
  /** ROLE_SPECS-compatible output budget (tokens). */
  budgetTokens: number;
  /**
   * Phases this seat critiques in the swarmPlan loop. lead-architect covers
   * all 13 phases (synthesis lens); specialists cover their lane only and
   * pass through silently elsewhere.
   */
  focus: readonly PhaseId[];
};

/** Standing rule appended to every seat system prompt (crew honesty rules). */
export const SWARM_STANDING_RULE =
  "You are advisory. Your output is ingested as an [agent report] and reviewed against the DoD gates. " +
  "You do not approve, reject, advance, or deploy. Honesty: do not fabricate — use ONLY the recorded " +
  "project state in your context. When evidence is missing, say so explicitly. Never invent sources, " +
  "APIs, files, endpoints, or test results. Never emit secrets.";

const EMIT_LINE = (emit: readonly CrewMessageType[]): string =>
  `When dispatched, reply on the crew JSON envelope with one of: ${emit.join(" | ")}.`;

function seatSystem(id: SwarmRoleId, label: string, emit: readonly CrewMessageType[]): string {
  return `You are the ${label} (${id}) in the RapidTool advisory swarm. ${SWARM_STANDING_RULE} ${EMIT_LINE(emit)}`;
}

export const SWARM_ROLES: Record<SwarmRoleId, SwarmRoleSpec> = {
  "lead-architect": {
    id: "lead-architect",
    label: "Lead architect",
    model: "flash",
    system: seatSystem("lead-architect", "Lead architect", ["plan", "design"]),
    prompt:
      "Open the debate: synthesize the current edge's recorded state (phase record, artifacts, packet, rejections) into one keep/revise posture. Every finding must cite the recorded evidence it comes from; for each issue give one concrete advisory next step an operator can act on. Missing evidence is reported as missing — never inferred.",
    emit: ["plan", "design"],
    budgetTokens: 4096,
    focus: PHASES.map((p) => p.id),
  },
  "secops-sentinel": {
    id: "secops-sentinel",
    label: "SecOps sentinel",
    model: "flash",
    system: seatSystem("secops-sentinel", "SecOps sentinel", ["review"]),
    prompt:
      "Pattern-scan the recorded project text (brief, notes, openapi, this edge's artifacts) for secret material and PHI/PII markers; report each hit with its source label. Every hit is advisory: recommend human review, never block a DoD gate yourself.",
    emit: ["review"],
    budgetTokens: 2048,
    focus: [4, 5, 6, 8, 9, 12],
  },
  "ast-specialist": {
    id: "ast-specialist",
    label: "AST specialist",
    model: "flash",
    system: seatSystem("ast-specialist", "AST specialist", ["design", "review"]),
    prompt:
      "Critique the architecture/schema evidence the edge depends on: lattice vagueness, feasibility verdict, data contracts, spec-graph, research corpus, docs parity. Name the exact recorded evidence behind each finding; when evidence is missing, say what must be recorded before the edge can be reviewed without guessing. Missing evidence is reported as missing — never inferred.",
    emit: ["design", "review"],
    budgetTokens: 2048,
    focus: [0, 1, 2, 3, 6, 7, 12],
  },
  "frontend-polish": {
    id: "frontend-polish",
    label: "Frontend polish seat",
    model: "flash",
    system: seatSystem("frontend-polish", "Frontend polish seat", ["code", "review"]),
    prompt:
      "Review the dynamic UI/UX prototyping edge: recorded UI artifacts, states (empty/loading/error), a11y and responsive polish gaps — cite the artifact each gap comes from. Honest pass-through when no UI artifacts are recorded yet.",
    emit: ["code", "review"],
    budgetTokens: 2048,
    focus: [8],
  },
  "integration-tester": {
    id: "integration-tester",
    label: "Integration tester",
    model: "flash",
    system: seatSystem("integration-tester", "Integration tester", ["test", "review"]),
    prompt:
      "Critique integration evidence at code-bearing edges: recorded code artifacts vs the machine test verdict (lastTest). Name, per code artifact, which test evidence exists and which is missing; a failed or absent machine verdict is a revise signal, never a pass. Never claim a test ran unless evidence is on record.",
    emit: ["test", "review"],
    budgetTokens: 2048,
    focus: [5, 6, 9, 10, 11],
  },
};

const SWARM_ORDER: readonly SwarmRoleId[] = [
  ...SWARM_ROLE_IDS.filter((r) => r !== "lead-architect"),
];

/** Seats that critique a given phase, in debate order (lead opens). */
export function seatsForPhase(phase: PhaseId): SwarmRoleId[] {
  return [
    "lead-architect",
    ...SWARM_ORDER.filter((r) => SWARM_ROLES[r].focus.includes(phase)),
  ];
}

// ---------------------------------------------------------------------------
// Shared state helpers (pure)
// ---------------------------------------------------------------------------

const DEF_BY_ID: Map<PhaseId, PhaseDef> = new Map(PHASES.map((p) => [p.id, p]));

function defOf(phase: PhaseId): PhaseDef {
  return DEF_BY_ID.get(phase) ?? PHASES[0];
}

export function phaseRecord(project: Project, phase: PhaseId): PhaseRecord | undefined {
  return project.phases.find((r) => r.id === phase);
}

/** Smallest phase not marked complete, or null when all 13 are sealed. */
export function frontierOf(project: Project): PhaseId | null {
  for (const p of PHASES) {
    if (phaseRecord(project, p.id)?.status !== "complete") return p.id;
  }
  return null;
}

/** Artifact kinds recorded on a phase, deduped and sorted (canonical). */
export function kindsRecorded(project: Project, phase: PhaseId): ArtifactKind[] {
  const seen = new Set<ArtifactKind>();
  for (const a of project.artifacts) {
    if (a.phase === phase) seen.add(a.kind);
  }
  return [...seen].sort();
}

function artifactsAt(project: Project, phase: PhaseId): Artifact[] {
  return project.artifacts.filter((a) => a.phase === phase);
}

// ---------------------------------------------------------------------------
// Findings / critique types
// ---------------------------------------------------------------------------

export type SwarmSeverity = "info" | "warn" | "block";

export type SwarmFinding = {
  severity: SwarmSeverity;
  note: string;
};

export type SwarmCritique = {
  role: SwarmRoleId;
  phase: PhaseId;
  verdict: "keep" | "revise";
  summary: string;
  findings: SwarmFinding[];
  /** Honest provenance: swarm critiques are deterministic state analysis. */
  provenance: "deterministic";
  /** The advisory artifact this critique appends (crew protocol shape). */
  artifact: CrewArtifact;
};

export type SwarmPlanOptions = {
  /** Phase to critique (default project.currentPhase). Never mutated. */
  phase?: PhaseId;
};

export type SwarmPlanResult = {
  ok: true;
  /** Advisory only — critiques never mutate DoD gates, decisions, or records. */
  advisory: true;
  /** The engine remains linear; swarm output never advances currentPhase. */
  engineLinear: true;
  phase: PhaseId;
  critiques: SwarmCritique[];
  /** Critique artifacts appended in debate order (deduped titles). */
  artifacts: CrewArtifact[];
  /** Deterministic refinement text over the debate verdicts. */
  refinedPlan: string;
};

// ---------------------------------------------------------------------------
// Security marker scan (pure pattern match — advisory, not a security review)
// ---------------------------------------------------------------------------

type MarkerKind = "secret-key" | "inline-secret" | "phi";

/** P2-1: per-source scan cap (chars). Sources are scanned individually under
 *  this cap; the SecOps seat reports truncation honestly instead of a
 *  whole-join slice that silently skips artifact tails. */
export const SWARM_SCAN_SOURCE_MAX_CHARS = 8000;

/** P2-2: values that READ an environment variable are the safe idiom, not
 *  inline credentials — `secret = process.env.X`, `KEY: "${process.env.K}"`,
 *  `token: process["env"]["T"]`. Leading quotes are stripped before testing. */
const ENV_READ_VALUE = (v: string): boolean =>
  /^(?:process\s*\.\s*env\b|process\s*\[\s*['"]|\$\{)/i.test(v.trim().replace(/^['"`]/, ""));

const MARKER_RULES: {
  kind: MarkerKind;
  severity: SwarmSeverity;
  re: RegExp;
  label: string;
}[] = [
  {
    kind: "secret-key",
    severity: "block",
    re: /(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/g,
    label: "private key / secret token pattern",
  },
  {
    kind: "inline-secret",
    // /i: env-file canon is ALL-CAPS (API_KEY=…), and assignment reads of
    // process.env / ${…} are filtered per-match below (never a warn).
    severity: "warn",
    re: /\b(api[_-]?key|secret|passw[o0]rd|auth[_-]?token|access[_-]?token)\s*[:=]\s*(['"]?[A-Za-z0-9_\-./+]{8,}|['"][^'"]{4,}['"])/gi,
    label: "inline credential assignment",
  },
  {
    kind: "phi",
    severity: "warn",
    re: /\b(ssns?|social security( number)?|medical record|health record|patient record|patient health|passport number|credit card number)\b/gi,
    label: "PHI/PII marker",
  },
];

/** One-line finding per distinct marker kind hit (deduped, ordered). Only the
 *  head SWARM_SCAN_SOURCE_MAX_CHARS of the given text is scanned — the SecOps
 *  seat scans each source separately and reports truncation as a warn finding
 *  (P2-1), so a cut tail is never mistaken for a clean scan. */
export function scanForMarkers(text: string): { severity: SwarmSeverity; note: string }[] {
  if (!text) return [];
  const out: { severity: SwarmSeverity; note: string }[] = [];
  for (const rule of MARKER_RULES) {
    const hay = text.length > SWARM_SCAN_SOURCE_MAX_CHARS ? text.slice(0, SWARM_SCAN_SOURCE_MAX_CHARS) : text;
    let count = 0;
    for (const m of hay.matchAll(rule.re)) {
      if (rule.kind === "inline-secret" && ENV_READ_VALUE(String(m[2] ?? m[3] ?? ""))) continue;
      count++;
    }
    if (count > 0) {
      out.push({
        severity: rule.severity,
        note: `${rule.label} matched ${count}× — advisory; recommend human review before sealing (never a DoD gate in itself).`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Deterministic critique generators (one lens per seat)
// ---------------------------------------------------------------------------

type CritiqueCtx = {
  project: Project;
  phase: PhaseId;
  def: PhaseDef;
  rec: PhaseRecord | undefined;
  artifacts: Artifact[];
  kinds: ArtifactKind[];
  packetChars: number;
};

function ctxFor(project: Project, phase: PhaseId): CritiqueCtx {
  const rec = phaseRecord(project, phase);
  const artifacts = artifactsAt(project, phase);
  return {
    project,
    phase,
    def: defOf(phase),
    rec,
    artifacts,
    kinds: kindsRecorded(project, phase),
    packetChars: project.packet?.length ?? 0,
  };
}

function kindsLabel(kinds: ArtifactKind[]): string {
  return kinds.length > 0 ? kinds.join(", ") : "(none recorded)";
}

/** Shared status/evidence observations used by the lead architect. */
function leadObservations(c: CritiqueCtx): { severity: SwarmSeverity; note: string }[] {
  const out: { severity: SwarmSeverity; note: string }[] = [];
  const { rec, phase, artifacts, packetChars } = c;
  if (rec?.status === "rejected") {
    const n = rec.rejectionHistory?.length ?? 0;
    out.push({
      severity: "warn",
      note: `recorded rejection${n > 1 ? ` (×${n} in history)` : ""} at this edge — engine re-runs it; prior output is void until the DoD pass.`,
    });
  } else if (rec?.status === "awaiting_hitl") {
    out.push({ severity: "info", note: "edge is parked at a human gate — swarm raises no objection." });
  } else if (rec?.status === "complete") {
    out.push({ severity: "info", note: "edge is sealed — critique documents the recorded state." });
  } else {
    out.push({
      severity: "info",
      note: `edge status: ${rec?.status ?? "no phase record"} — critique covers the packet and recorded evidence only.`,
    });
  }
  // The machine-checkable DoD gate is the only approver — the lead architect
  // must cite the recorded verdict for the debated edge instead of leaving the
  // operator to cross-check it (Claude Code "/goal" separate definition-of-done
  // [F9]; Codex keeps the check in front of the loop at every step [H1]).
  // Recorded evidence only: an absent gate is reported as absent (warn on a
  // sealed edge, silence otherwise — "no phase record" already covers it).
  if (rec?.gate) {
    if (rec.gate.passed) {
      out.push({
        severity: "info",
        note: `DoD gate on record: PASS (evidence ${rec.gate.evidenceHash.slice(0, 8)}…) — the machine check this edge must satisfy.`,
      });
    } else {
      const unmet = rec.gate.unmet.length;
      out.push({
        severity: "warn",
        note: `DoD gate on record: FAIL (evidence ${rec.gate.evidenceHash.slice(0, 8)}…) — ${unmet} unmet criterion/criteria listed; swarm posture follows the machine verdict until the edge re-runs.`,
      });
      for (const u of rec.gate.unmet.slice(0, 2)) {
        const text = u.trim();
        if (!text) continue;
        out.push({
          severity: "warn",
          note: `gate unmet: ${text.length > 160 ? `${text.slice(0, 159)}…` : text}`,
        });
      }
    }
  } else if (rec?.status === "complete") {
    out.push({
      severity: "warn",
      note: "edge sealed with no recorded DoD gate verdict — the machine check is missing from the record.",
    });
  }
  // Reflexion steering (89 §2.2 [S13]): a re-run must meet the recorded
  // rejection notes, not rediscover them. The notes carry the human's reason
  // (ADR-002 ≥12-char rejections), so they are surfaced verbatim (capped),
  // not summarized. Warn while the edge is rejected (they void current
  // output); info once the edge moved on (context for the re-run critique).
  const history = rec?.rejectionHistory ?? [];
  if (history.length > 0) {
    const sev: SwarmSeverity = rec?.status === "rejected" ? "warn" : "info";
    for (const h of history.slice(-2)) {
      const note = h.note.trim();
      if (!note) continue;
      out.push({
        severity: sev,
        note: `prior rejection note: "${note.length > 180 ? `${note.slice(0, 179)}…` : note}" — address it explicitly in the re-run (reflexion steering).`,
      });
    }
  }
  out.push({
    severity: "info",
    note:
      artifacts.length > 0
        ? `${artifacts.length} recorded artifact(s) at P${phase} (kinds: ${kindsLabel(c.kinds)}).`
        : `no artifacts recorded at P${phase} yet — absence is reported, never papered over.`,
  });
  out.push({
    severity: "info",
    note:
      packetChars > 0
        ? `agent packet compiled (${packetChars} chars) and available as context.`
        : "no agent packet compiled yet — advisory context is limited to raw project fields.",
  });
  return out;
}

function verdictOf(findings: { severity: SwarmSeverity; note: string }[]): "keep" | "revise" {
  return findings.some((f) => f.severity === "warn" || f.severity === "block")
    ? "revise"
    : "keep";
}

function summarize(findings: { severity: SwarmSeverity; note: string }[]): string {
  const first = findings.find((f) => f.severity === "warn" || f.severity === "block");
  if (first) return `Revise — ${first.note}`;
  const info = findings[0];
  return info ? `Keep — ${info.note}` : "Keep — no recorded objections.";
}

function critiqueBody(spec: SwarmRoleSpec, c: CritiqueCtx, verdict: "keep" | "revise", findings: SwarmFinding[]): string {
  const status = c.rec?.status ?? "no record";
  const lines = [
    `# Swarm critique — ${spec.label} (${c.def.code} ${c.def.title})`,
    `- edge: P${c.phase} · status: ${status}`,
    `- verdict: ${verdict}`,
    `- provenance: deterministic state analysis — no LLM turn was dispatched; live crew LLM seats remain config-gated (runCrew).`,
    `- advisory: true — this artifact never mutates DoD gates, decisions, or engine state.`,
    ``,
    `## Findings`,
  ];
  for (const f of findings) lines.push(`- [${f.severity}] ${f.note}`);
  lines.push(``, `## Seat lens`, spec.prompt, ``, `engine: linear — swarm output never advances currentPhase.`);
  return lines.join("\n");
}

function critiqueFor(role: SwarmRoleId, project: Project, phase: PhaseId): SwarmCritique {
  const spec = SWARM_ROLES[role];
  const c = ctxFor(project, phase);
  const findings: SwarmFinding[] = [];

  switch (role) {
    case "lead-architect": {
      for (const o of leadObservations(c)) findings.push(o);
      break;
    }
    case "secops-sentinel": {
      // P2-1: scan each source under its own cap. A whole-join slice at 8000
      // chars used to leave artifact tails (where secrets live) unscanned
      // while still reporting "clean" — per-source scanning plus an explicit
      // truncation warn keeps the seat honest.
      const sources: { label: string; text: string }[] = [
        { label: "brief", text: project.brief },
        { label: "notes", text: project.notes },
        { label: "openapi", text: project.openapi },
        ...c.artifacts.map((a) => ({
          label: `edge artifact "${a.title}"`,
          text: `${a.title}\n${a.body}`,
        })),
      ];
      let hits = 0;
      let truncated = false;
      for (const src of sources) {
        if (!src.text.trim()) continue;
        if (src.text.length > SWARM_SCAN_SOURCE_MAX_CHARS) truncated = true;
        const found = scanForMarkers(src.text);
        hits += found.length;
        for (const h of found) findings.push(h);
      }
      if (truncated) {
        findings.push({
          severity: "warn",
          note: `a scanned source exceeded ${SWARM_SCAN_SOURCE_MAX_CHARS} chars — material past that point was NOT scanned; split long sources to scan the tail (advisory, not a security review).`,
        });
      }
      if (hits === 0 && !truncated) {
        findings.push({
          severity: "info",
          note: "pattern scan clean across brief/notes/openapi/edge artifacts — advisory only, not a security review.",
        });
      }
      break;
    }
    case "ast-specialist": {
      const { project: p } = c;
      if (p.lattice?.vague) {
        findings.push({
          severity: "warn",
          note: "intent lattice is marked vague (fallback vocabulary fired) — feasibility may reframe; guards advised.",
        });
      }
      if (p.scorecard) {
        if (p.scorecard.verdict === "reframe") {
          findings.push({
            severity: "warn",
            note: `feasibility verdict "${p.scorecard.verdict}" on record — the project should reframe before code lanes compile.`,
          });
        } else if (p.scorecard.verdict === "proceed-with-guards") {
          findings.push({
            severity: "info",
            note: "feasibility verdict \"proceed-with-guards\" on record — guards advisory stands (advisory only).",
          });
        }
      } else if (c.rec?.status === "complete") {
        findings.push({
          severity: "warn",
          note: "edge sealed without a recorded feasibility scorecard.",
        });
      } else {
        findings.push({
          severity: "info",
          note: "feasibility scorecard not yet recorded (pending P0 output).",
        });
      }
      if ([1, 2, 3, 6].includes(c.phase)) {
        if (p.contracts === null) {
          findings.push({
            severity: "warn",
            note: "no data contracts recorded — schema critiques would compile blind at this edge.",
          });
        } else {
          findings.push({
            severity: "info",
            note: `data contracts on record: ${p.contracts.entities.length} entit${p.contracts.entities.length === 1 ? "y" : "ies"}, ${p.contracts.endpoints.length} endpoint${p.contracts.endpoints.length === 1 ? "" : "s"}.`,
          });
        }
        if (p.specGraph === null) {
          findings.push({
            severity: "warn",
            note: "no spec-graph recorded — file-level ordering is unavailable to downstream seats.",
          });
        } else {
          findings.push({
            severity: "info",
            note: `spec-graph on record: ${p.specGraph.nodes.length} node${p.specGraph.nodes.length === 1 ? "" : "s"} in ${p.specGraph.order.length} step${p.specGraph.order.length === 1 ? "" : "s"}.`,
          });
        }
      }
      if (c.phase === 7) {
        const corpus = p.research?.length ?? 0;
        if (corpus > 0) {
          findings.push({
            severity: "info",
            note: `${corpus} live-research corpus entr${corpus === 1 ? "y" : "ies"} on record.`,
          });
        } else if (c.rec?.status === "complete" && !p.meta?.liveUnavailable) {
          findings.push({
            severity: "warn",
            note: "research edge sealed with no research corpus and no recorded live-unavailable waiver.",
          });
        } else {
          findings.push({
            severity: "info",
            note: "no research corpus on record yet (waiver-eligible when live research could not run).",
          });
        }
      }
      if (c.phase === 12) {
        if (c.rec?.status === "complete" && !p.openapi.trim() && !p.adr.trim()) {
          findings.push({
            severity: "warn",
            note: "docs edge sealed without recorded OpenAPI or ADR output.",
          });
        } else {
          findings.push({
            severity: "info",
            note: `docs parity surface: openapi ${p.openapi.trim() ? `${p.openapi.length} chars` : "empty"}, adr ${p.adr.trim() ? `${p.adr.length} chars` : "empty"}.`,
          });
        }
      }
      break;
    }
    case "frontend-polish": {
      const ui = c.artifacts.filter((a) => a.kind === "ui");
      if (ui.length > 0) {
        findings.push({
          severity: "info",
          note: `${ui.length} UI artifact(s) recorded at the prototyping edge — polish lens applies (states, empty/error, a11y, responsive).`,
        });
      } else {
        findings.push({
          severity: "info",
          note: "no UI artifacts recorded at this edge yet — honest pass-through, nothing to polish-critique.",
        });
      }
      break;
    }
    case "integration-tester": {
      const code = c.artifacts.filter((a) => a.kind === "code");
      if (code.length > 0) {
        const t = project.lastTest;
        if (t === null) {
          findings.push({
            severity: "warn",
            note: "code artifacts recorded without a machine test verdict (lastTest null) — do not claim a pass that was never run.",
          });
        } else if (!t.ok) {
          // Verdict quality: a FAILED machine verdict at a code-bearing edge is
          // a revise signal, not an info note — severity must match reality so
          // the debate verdict and the refined plan reflect the failure.
          findings.push({
            severity: "warn",
            note: `machine test verdict on record: FAILED (${t.label ?? "no label"}) — recorded code does not pass the machine oracle; revise before sealing (advisory; the DoD gate stays the only approver).`,
          });
        } else {
          findings.push({
            severity: "info",
            note: `machine test verdict on record: passed (${t.label ?? "no label"}).`,
          });
        }
      } else {
        findings.push({
          severity: "info",
          note: "no code artifacts recorded at this edge — nothing to integration-critique yet.",
        });
      }
      break;
    }
  }

  const verdict = verdictOf(findings);
  const summary = summarize(findings);
  return {
    role,
    phase,
    verdict,
    summary,
    findings,
    provenance: "deterministic",
    artifact: {
      title: `Swarm critique — ${spec.label} (${c.def.code})`,
      body: critiqueBody(spec, c, verdict, findings),
      language: "markdown",
    },
  };
}

// ---------------------------------------------------------------------------
// swarmPlan — sequential debate + advisory refinement
// ---------------------------------------------------------------------------

/**
 * Run the advisory debate over one edge: the lead architect opens, then every
 * specialist whose focus covers the phase critiques in turn (sequential,
 * deterministic). Each critique appends one advisory artifact (crew protocol
 * CrewArtifact shape) to the result. Nothing is mutated — the project is read
 * only — and nothing gates: verdicts are advisory posture for the human/DoD.
 */
export function swarmPlan(project: Project, opts: SwarmPlanOptions = {}): SwarmPlanResult {
  const phase = (opts.phase ?? project.currentPhase) as PhaseId;
  const seats = seatsForPhase(phase);
  const critiques: SwarmCritique[] = [];
  const artifacts: CrewArtifact[] = [];
  for (const role of seats) {
    const critique = critiqueFor(role, project, phase);
    critiques.push(critique);
    artifacts.push(critique.artifact);
  }
  const revise = critiques.filter((c) => c.verdict === "revise").length;
  const keep = critiques.length - revise;
  const def = defOf(phase);
  const findingTotal = critiques.reduce((n, c) => n + c.findings.length, 0);
  // Actionable refinement: when seats object, name the seats and surface the
  // top warn/block findings (deterministic, capped) so the operator knows
  // exactly where to look before re-running the edge.
  const reviseSeats = critiques.filter((c) => c.verdict === "revise").map((c) => c.role);
  const topFindings = critiques
    .flatMap((c) =>
      c.findings
        .filter((f) => f.severity === "warn" || f.severity === "block")
        .map((f) => ({ seat: c.role, f })),
    )
    .slice(0, 3)
    .map(({ seat, f }) => {
      const note = f.note.length > 160 ? `${f.note.slice(0, 159)}…` : f.note;
      return `- [${seat} ${f.severity}] ${note}`;
    });
  const refinedPlan = [
    `Advisory swarm pass — ${def.code} ${def.title} (P${phase})`,
    `critiques: ${seats.join(", ")}`,
    `verdicts: ${keep} keep · ${revise} revise`,
    revise > 0
      ? [
          `refinement: ${revise} seat(s) — ${reviseSeats.join(", ")} — raised ${findingTotal} advisory finding(s); address them, then re-run the edge's work before sealing; the DoD gate stays the only approver.`,
          ...(topFindings.length > 0
            ? [`top advisory findings (full detail in the per-seat critique artifacts):`, ...topFindings]
            : []),
        ].join("\n")
      : "refinement: no advisory objections — seal when the DoD gate passes.",
    "engine: linear — swarm output never advances currentPhase.",
  ].join("\n");
  return {
    ok: true,
    advisory: true,
    engineLinear: true,
    phase,
    critiques,
    artifacts,
    refinedPlan,
  };
}

// ---------------------------------------------------------------------------
// parallelDag — pure DAG metadata (advisory; engine stays linear)
// ---------------------------------------------------------------------------

export type PhaseDagState = "complete" | "active" | "ready" | "blocked";

export type PhaseDagNode = {
  phase: PhaseId;
  code: string;
  title: string;
  state: PhaseDagState;
  hitl: boolean;
  kinds: ArtifactKind[];
};

export type DagChainEdge = {
  from: PhaseId;
  to: PhaseId;
  reason: string;
};

export type ParallelPair = {
  a: PhaseId;
  b: PhaseId;
  reason: string;
};

export type ParallelDagResult = {
  ok: true;
  /** Metadata only — nothing is scheduled, nothing is mutated. */
  advisory: true;
  /** The engine still advances one phase at a time (canEnter +1). */
  engineLinear: true;
  /** First non-complete phase (null only when all 13 phases are sealed). */
  frontier: PhaseId | null;
  /** Startable phases: the frontier alone while the engine is linear. */
  ready: PhaseId[];
  /** One node per phase (0..12), state-tagged from the phase records. */
  nodes: PhaseDagNode[];
  /** Remaining linear engine order (strict +1 chain from the frontier). */
  chain: DagChainEdge[];
  /**
   * Run-ready pairs (both phases sealed, or the frontier paired with sealed
   * phases) whose recorded artifact kinds are disjoint: a hypothetical wave
   * compiler could build them side by side. Advisory only.
   */
  parallelPairs: ParallelPair[];
  /**
   * Run-ready pairs that share a recorded artifact kind — a wave compiler
   * would have to serialize them (write-order dependency). Advisory only.
   */
  conflicts: ParallelPair[];
};

/**
 * Pure DAG metadata over the project's phase graph. The real engine is a
 * strict +1 chain (phases.ts canEnter) — at most one phase is ever active, so
 * this function never schedules anything. It reports, from the CURRENT state,
 * which pairs of run-ready phases (sealed, plus the current frontier) have
 * kind-disjoint recorded outputs and could therefore share a compile wave in
 * a hypothetical parallel engine. Reasons are derived from recorded artifacts
 * only; missing artifacts are reported as "(none recorded)", never assumed.
 */
export function parallelDag(project: Project): ParallelDagResult {
  const frontier = frontierOf(project);
  const nodes: PhaseDagNode[] = PHASES.map((p) => {
    const rec = phaseRecord(project, p.id);
    let state: PhaseDagState = "blocked";
    if (rec?.status === "complete") state = "complete";
    else if (frontier !== null && p.id === frontier)
      state = p.id === project.currentPhase ? "active" : "ready";
    return {
      phase: p.id,
      code: p.code,
      title: p.title,
      state,
      hitl: p.hitl,
      kinds: kindsRecorded(project, p.id),
    };
  });

  const kindsOf = new Map<PhaseId, Set<ArtifactKind>>();
  for (const n of nodes) kindsOf.set(n.phase, new Set(n.kinds));

  const chain: DagChainEdge[] = [];
  if (frontier !== null) {
    for (const p of PHASES) {
      if (p.id < frontier) continue;
      if (p.id >= 12) break;
      const to = (p.id + 1) as PhaseId;
      chain.push({
        from: p.id,
        to,
        reason: `strict engine order (canEnter +1): ${p.code} output seals before ${defOf(to).code} starts.`,
      });
    }
  }

  // Run-ready set = sealed phases ∪ current frontier (the only phases whose
  // compile inputs exist today). Everything else is blocked behind the chain.
  const ready: PhaseId[] = [];
  const runReady: PhaseId[] = [];
  for (const n of nodes) {
    if (n.state === "complete") runReady.push(n.phase);
  }
  if (frontier !== null) {
    runReady.push(frontier);
    ready.push(frontier);
  }

  const parallelPairs: ParallelPair[] = [];
  const conflicts: ParallelPair[] = [];
  for (let i = 0; i < runReady.length; i++) {
    for (let j = i + 1; j < runReady.length; j++) {
      const a = runReady[i];
      const b = runReady[j];
      const ka = kindsOf.get(a) ?? new Set<ArtifactKind>();
      const kb = kindsOf.get(b) ?? new Set<ArtifactKind>();
      const shared = [...ka].filter((k) => kb.has(k)).sort();
      const defA = defOf(a);
      const defB = defOf(b);
      if (shared.length === 0) {
        const bothRecorded = ka.size > 0 && kb.size > 0;
        const bare = `kind-disjoint recorded outputs (${defA.code}: ${kindsLabel([...ka].sort())} | ${defB.code}: ${kindsLabel([...kb].sort())}) — advisory wave-safe; the engine stays linear.`;
        parallelPairs.push({
          a,
          b,
          // Usefulness guard: two phases with NOTHING recorded are not really
          // "wave-safe" — the absence is not evidence. Say so instead of
          // letting a wave planner read an empty kinds list as a guarantee.
          reason: bothRecorded
            ? bare
            : `${bare} ${
                ka.size === 0 && kb.size === 0
                  ? "Neither"
                  : ka.size === 0
                    ? `${defA.code}`
                    : `${defB.code}`
              } has no recorded output yet — kind-disjointness is provisional until that edge records artifacts; re-verify after it runs.`,
        });
      } else {
        conflicts.push({
          a,
          b,
          reason: `shared recorded kind "${shared[0]}" on ${defA.code} and ${defB.code} — a wave compiler would serialize these writes (advisory).`,
        });
      }
    }
  }

  return {
    ok: true,
    advisory: true,
    engineLinear: true,
    frontier,
    ready,
    nodes,
    chain,
    parallelPairs,
    conflicts,
  };
}

// ---------------------------------------------------------------------------
// branchSuggest — loop-back heuristic on downstream conflicts
// ---------------------------------------------------------------------------

export type LoopBackSuggestion = {
  /** Phase whose compile would conflict given the recorded state. */
  downstream: PhaseId;
  /** Advisory: re-run / re-open this phase before advancing. */
  loopBackTo: PhaseId;
  /** Recorded evidence behind the heuristic (never an invented claim). */
  reason: string;
  severity: "info" | "warn";
};

export type BranchSuggestResult = {
  ok: true;
  /** Advisory only — nothing is re-opened or re-run by this function. */
  advisory: true;
  /** The engine stays linear; loop-backs are suggestions for a re-run plan. */
  engineLinear: true;
  frontier: PhaseId | null;
  suggestions: LoopBackSuggestion[];
  conflictsDetected: number;
};

/** Code-bearing phases that compile against the recorded schema lane. */
const CODE_CONSUMERS: readonly PhaseId[] = [6, 8, 10, 11];

/**
 * Pure heuristic: detect recorded state that conflicts with a DOWNSTREAM
 * phase's compile (a phase strictly ahead of the frontier), and suggest the
 * phase to loop back to. Suggestions are derived from phase records,
 * contracts/spec-graph presence, rejections, and open HITL gates — all read
 * only. When no conflict is recorded the result is honestly empty.
 */
export function branchSuggest(project: Project): BranchSuggestResult {
  const frontier = frontierOf(project);
  const suggestions: LoopBackSuggestion[] = [];
  const push = (s: LoopBackSuggestion): void => {
    if (!suggestions.some((x) => x.downstream === s.downstream && x.loopBackTo === s.loopBackTo)) {
      suggestions.push(s);
    }
  };

  if (frontier !== null) {
    // B1 — schema lane sealed (P1-P3) without recorded contracts/spec-graph:
    // every downstream code consumer would compile against an open contract.
    if (project.contracts === null && project.specGraph === null) {
      const laneSealed = [1, 2, 3].every(
        (p) => phaseRecord(project, p as PhaseId)?.status === "complete",
      );
      if (laneSealed) {
        for (const d of CODE_CONSUMERS) {
          if (phaseRecord(project, d)?.status !== "complete" && d > frontier) {
            push({
              downstream: d,
              loopBackTo: 1,
              severity: "warn",
              reason: `P1-P3 sealed with no recorded contracts/spec-graph — P${d} would compile against an open contract. Advisory loop-back to the architecture lane (P1).`,
            });
          }
        }
      }
    }

    // B3 — the frontier carries a recorded rejection: downstream must not
    // compile against rejected output until the edge re-runs.
    const rec = phaseRecord(project, frontier);
    if (rec?.status === "rejected" && frontier < 12) {
      push({
        downstream: (frontier + 1) as PhaseId,
        loopBackTo: frontier,
        severity: "warn",
        reason: `P${frontier} carries a recorded rejection (${rec.rejectionHistory?.length ?? 0} in history) — downstream P${frontier + 1} would compile against rejected output. Advisory: re-run P${frontier} first.`,
      });
    }

    // B4 — an open HITL gate on an edge with no recorded artifacts: a
    // downstream compile would race the unresolved human decision.
    if (
      rec?.status === "awaiting_hitl" &&
      project.hitl?.phase === frontier &&
      artifactsAt(project, frontier).length === 0 &&
      frontier < 12
    ) {
      push({
        downstream: (frontier + 1) as PhaseId,
        loopBackTo: frontier,
        severity: "info",
        reason: `P${frontier} is parked at an open HITL gate with no recorded artifacts — downstream P${frontier + 1} would race an unresolved human decision. Advisory: resolve the gate first.`,
      });
    }
  }

  suggestions.sort((x, y) => x.downstream - y.downstream || x.loopBackTo - y.loopBackTo);
  return {
    ok: true,
    advisory: true,
    engineLinear: true,
    frontier,
    suggestions,
    conflictsDetected: suggestions.length,
  };
}

// ---------------------------------------------------------------------------
// Protocol-conformance helper (used by tests on both crew and swarm files)
// ---------------------------------------------------------------------------

/** True when `type` is a valid crew JSON-envelope message kind. */
export function isCrewProtocolEmit(type: string): boolean {
  return PROTOCOL_SET.has(type);
}
