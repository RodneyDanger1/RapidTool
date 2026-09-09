import type { PhaseDef, PhaseId } from "./types";

export const PHASES: PhaseDef[] = [
  {
    id: 0,
    code: "P0",
    title: "Deep Research & Feasibility",
    summary:
      "Domain landscape, libraries, competing architectures, feasibility scorecard before any code.",
    hitl: false,
  },
  {
    id: 1,
    code: "P1",
    title: "Core Orchestration & State Graph",
    summary:
      "Execution flow & state design for the briefed product (topology artifacts are kind-derived; agent-platform content only for agent-platform briefs).",
    hitl: false,
  },
  {
    id: 2,
    code: "P2",
    title: "Memory & Context Consolidation",
    summary:
      "Context & persistence plan — project memory rows, spec grounding, honest persistence model (no durable checkpoint layer).",
    hitl: false,
  },
  {
    id: 3,
    code: "P3",
    title: "Tool Integration & Interoperability",
    summary:
      "Integration surface inventory — research/LLM providers implemented today; MCP/A2A server contracts are roadmap declarations, not runtime (B-18).",
    hitl: false,
  },
  {
    id: 4,
    code: "P4",
    title: "Security, Isolation & Authorization",
    summary:
      "Security & isolation policy — the engine-template runner boundary today; cgroup/isolate/OAuth-scoping claims stay declarations (B-18).",
    hitl: true,
  },
  {
    id: 5,
    code: "P5",
    title: "Validation, HITL & Self-Learning",
    summary:
      "Validation & HITL contract — approval gates with mandatory feedback; self-learning: lesson capture live (L1/L2/L5), cross-run retrieval partial — roadmap.",
    hitl: true,
  },
  {
    id: 6,
    code: "P6",
    title: "Code Generation, Testing & Deployment",
    summary:
      "Deterministic template module as the no-key floor; with a live key, brief-faithful machine-verified module synthesis (evidence-gated).",
    hitl: false,
  },
  {
    id: 7,
    code: "P7",
    title: "Domain & Market Research",
    summary:
      "RAG over docs/papers/GitHub, competitive matrix, feasibility and risk scoring against the market.",
    hitl: false,
  },
  {
    id: 8,
    code: "P8",
    title: "Dynamic UI/UX Prototyping",
    summary:
      "UI/UX contract synthesis — screens/CLI/library API surfaces derived from the brief; component code only with a live key and only for webapp kind.",
    hitl: true,
  },
  {
    id: 9,
    code: "P9",
    title: "CI/CD & Cloud Deployment Routing",
    summary:
      "GitHub Actions for tests and types, IaC for GCP / Firebase hosting, GPU allocation scripts.",
    hitl: true,
  },
  {
    id: 10,
    code: "P10",
    title: "Local Agent & Edge Inference",
    summary:
      "Inference routing — deepseek-v4-flash / deepseek-v4-pro are the only configured routes; no Ollama/local-edge handoff.",
    hitl: false,
  },
  {
    id: 11,
    code: "P11",
    title: "Real-Time Web & Tool Augmentation",
    summary:
      "Tool augmentation — research-query templates for the implemented providers; no live MCP binding at runtime.",
    hitl: false,
  },
  {
    id: 12,
    code: "P12",
    title: "Documentation & Technical Specs",
    summary:
      "Architecture Decision Records from P1/P7, OpenAPI + database schemas, frontend/backend parity.",
    hitl: false,
  },
];

export const PHASE_BY_ID: ReadonlyMap<PhaseId, PhaseDef> = new Map(PHASES.map((p) => [p.id, p]));

export function phaseDef(id: PhaseId): PhaseDef {
  const def = PHASE_BY_ID.get(id);
  if (!def) {
    // Machine-readable code on the thrown Error (shared taxonomy in
    // src/lib/errors.ts: an unknown/out-of-graph phase id is RT_E_PHASE_ILLEGAL
    // — not a payload validation error) so orchestrators can classify it
    // without string-matching the message.
    const err = new Error(`Unknown phase id ${id}`) as Error & { code?: string };
    err.code = "RT_E_PHASE_ILLEGAL";
    throw err;
  }
  return def;
}

export function canEnter(from: PhaseId, to: PhaseId): boolean {
  // Deny transitions to/from phases that do not exist: canEnter(12, 13) must
  // never "succeed" just because 13 === 12 + 1 — a phantom phase can then
  // never be entered or sealed.
  if (!PHASE_BY_ID.has(from) || !PHASE_BY_ID.has(to)) return false;
  return to === ((from + 1) as PhaseId);
}

export function priorsSealed(phases: { id: number; status: string }[], target: PhaseId): boolean {
  // A target outside the real phase set is never sealed. Without this guard,
  // priorsSealed(phases, 13) vacuously returned true (the 0..12 loop found no
  // unsealed records for i < 13) and priorsSealed([], -1) returned true too —
  // both would silently unlock a phantom phase.
  if (!PHASE_BY_ID.has(target)) return false;
  if (target === 0) return true;
  // Index by record id, not array position (A20): a partial, unsorted, or sparse
  // phase array must never silently mis-seal the graph.
  for (let i = 0; i < target; i++) {
    const rec = phases.find((p) => p.id === i);
    if (rec?.status !== "complete") return false;
  }
  return true;
}

export const HITL_PHASES = PHASES.filter((p) => p.hitl).map((p) => p.id);
export const STOCK_HITL = [4, 5, 8, 9] as const;
