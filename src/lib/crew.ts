/**
 * Client-facing multi-agent crew contract for RapidTool.
 *
 * Import THIS module from UI/store code — never import `./crew.server.ts`
 * directly. The API key is read server-side only (see that module); this
 * module exposes the typed `runCrew()` / `crewStatus()` API and the honest
 * `{ ok: false, reason: "not-configured" }` fallback, so no code path can
 * mistake an unconfigured backend for real crew output. Mirrors `./llm.ts`.
 *
 * Wire format (design: research/multiagent/03_crew_design.md §2/§3, v1):
 * the orchestrator dispatches one DeepSeek call per turn over a deterministic
 * phase → role table; each agent answers with a structured CrewMessage
 * (JSON envelope for architect/reviewer/tester, markdown with `## <title>`
 * artifact sections for the prose roles). The crew is advisory — its output
 * is ingested as an `[agent report]`, never authoritative over the DoD gates.
 */

import { createServerFn } from "@tanstack/react-start";
import type { Project } from "./types.ts";

/** Live crew roles — a superset of the packet's four static seats (A8):
 *  planner/researcher are new specialists; architect|implementer|reviewer|
 *  tester map 1:1 onto the existing CrewRole set via `toAgentRole`. */
export type CrewRole =
  | "planner"
  | "researcher"
  | "architect"
  | "coder"
  | "reviewer"
  | "tester";

/** Model tier an agent turn runs on (resolved to a deepseek-v4-* id server-side). */
export type CrewModel = "flash" | "pro";

/** Message kinds: role-default turns (plan/research/design/code/review/test),
 *  plus an explicit handoff (work passed onward) and `final` (the run is done —
 *  no further role should run). */
export type CrewMessageType =
  | "plan"
  | "research"
  | "design"
  | "code"
  | "review"
  | "test"
  | "handoff"
  | "final";

/** A structured artifact an agent emits (title/body is the wire contract;
 *  `language` is advisory and inferred from fences when present). */
export type CrewArtifact = {
  title: string;
  body: string;
  language?: string;
};

/** One turn in the shared crew log. `role` is the speaker persona; `type` is
 *  the turn kind; `content` is the prose/verdict; `artifacts` are the typed
 *  outputs attached to this turn (research findings, plans, files, verdicts). */
export type CrewMessage = {
  role: CrewRole;
  type: CrewMessageType;
  content: string;
  artifacts?: CrewArtifact[];
};

/** Append-only shared log state kept by the orchestrator across turns. */
export type CrewSession = {
  id: string;
  projectId: string;
  /** append-only shared log (each entry is one agent turn) */
  messages: CrewMessage[];
  /** accumulated artifacts, deduped by exact title */
  artifacts: CrewArtifact[];
  steps: number;
  promptTokens: number;
  completionTokens: number;
  status:
    | "running"
    | "done"
    | "stopped-max-steps"
    | "stopped-cost-limit"
    | "stopped-no-key"
    | "blocked-hitl"
    | "error";
  startedAt: number;
  endedAt?: number;
};

/** Why an ok:true run stopped. `done` = every role in the phase's sequence
 *  completed a turn; `final` = an agent emitted a `final` message (early,
 *  valid); `max-steps` / `cost-limit` = partial run stopped by a guard — the
 *  transcript returned is complete and honest, never padded or completed. */
export type CrewStopReason = "done" | "final" | "max-steps" | "cost-limit";

/** One crew artifact as the caller receives it, stamped with the phase the
 *  run targeted (single-phase runs: every artifact carries the same phase). */
export type CrewPhaseArtifact = {
  phase: number;
  title: string;
  body: string;
};

/** One planned step executed by a plan-act run (mirrors planning.ts PlanStep —
 *  kept structural here so this client-facing module never imports the
 *  server-only ./planning.ts at runtime). */
export type CrewPlanStep = {
  id: string;
  action: string;
  why: string;
};

/** Reflection critique a plan-act run returns (mirrors planning.ts
 *  PlanCritique; structural copy for the same reason as CrewPlanStep). */
export type CrewCritique = {
  verdict: "keep" | "revise";
  summary: string;
  issues: string[];
  revised?: CrewPlanStep[];
};

export type CrewRunResult =
  | {
      ok: true;
      messages: CrewMessage[];
      artifacts: CrewPhaseArtifact[];
      stopped: CrewStopReason;
      /** Orchestration mode that produced this run. Plan-act runs: the
       *  machine plan that was executed and the closing reflection critique
       *  (null when the critique call failed — the run stays honest, never
       *  padded). Both are omitted in default-mode runs. */
      mode?: "default" | "plan-act";
      plan?: CrewPlanStep[] | null;
      critique?: CrewCritique | null;
    }
  | { ok: false; reason: "not-configured" | "error"; error?: string };

/** Public run options (the full orchestrator options live server-side). */
export type CrewRunOptions = {
  /** Hard turn cap for this run (server clamps to 1..24). Default 12. */
  maxSteps?: number;
  /** Orchestration mode: "default" = the fixed phase → role table (today);
   *  "plan-act" = plan first, then one crew role turn per planned step, then
   *  a single closing reflection. Default "default". */
  mode?: "default" | "plan-act";
};

const runCrewServer = createServerFn({ method: "POST" })
  .validator((input: { project: Project; opts?: CrewRunOptions }) => input)
  .handler(async ({ data }) => {
    const { runCrewServer } = await import("./crew.server.ts");
    return runCrewServer(data.project, data.opts);
  });

const statusServer = createServerFn({ method: "GET" }).handler(async () => {
  const { isDeepSeekConfigured, deepSeekModelIds } = await import(
    "./deepseek.server.ts"
  );
  return { configured: isDeepSeekConfigured(), models: deepSeekModelIds() };
});

/**
 * Run the multi-agent crew over the project's current phase. Config-gated:
 * with no DeepSeek key the server returns `{ ok: false, reason:
 * "not-configured" }` — it never fabricates a session. Every stop condition
 * returns the honest partial transcript (`stopped` says why).
 */
export async function runCrew(
  project: Project,
  opts?: CrewRunOptions,
): Promise<CrewRunResult> {
  try {
    return await runCrewServer({ data: { project, opts } });
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function crewStatus(): Promise<{
  configured: boolean;
  models: string[];
}> {
  try {
    return await statusServer();
  } catch {
    return { configured: false, models: [] };
  }
}
