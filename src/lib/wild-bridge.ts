/**
 * wild-bridge.ts — the client-safe half of the console Wild Mode bridge.
 *
 * `createServerFn` handlers here execute server-side and delegate to
 * `wild-bridge.server.ts` (the llm.ts / research.ts / verify.ts pattern); the
 * browser calls them like any other server function. Nothing server-only is
 * imported statically — the `.server.` module loads inside the handlers, so it
 * stays out of the client bundle.
 *
 * This is how a browser host reaches:
 *   - the EXISTING server-side planner (`headless.generateWildPlan`), so the
 *     console driver attaches a real plan instead of logging `wild.plan_absent`;
 *   - the production Auto-Review classifier (`wildClassifierReview`, on
 *     llm.ts's server-fn `complete()`/`llmStatus()`), so Wild Mode approval
 *     gates self-clear on a real DeepSeek verdict.
 *
 * Every transport failure is returned honestly (null plan / error verdict) —
 * never an invented plan or a guessed review.
 */
import { createServerFn } from "@tanstack/react-start";
import { classifyError } from "./errors.ts";
import type { ErrorCode } from "./errors.ts";
import type { PhaseId, Project, WildPlan } from "./types.ts";
import type { WildClassifierResult, WildReviewContext } from "./wild-mode.server.ts";

const planServer = createServerFn({ method: "POST" })
  .validator((input: { project: Project }) => input)
  .handler(async ({ data }) => {
    const { generateWildPlanForBridge } = await import("./wild-bridge.server.ts");
    return generateWildPlanForBridge(data.project);
  });

/**
 * Generate a REAL planner plan server-side. Returns `null` on a transport
 * failure so the caller keeps its honest `wild.plan_absent` path; a keyless
 * server returns the planner's honest empty plan (source `"empty"`), which the
 * caller also treats as absent. A plan is never invented here.
 */
export async function generateWildPlanBridge(project: Project): Promise<WildPlan | null> {
  try {
    return await planServer({ data: { project } });
  } catch {
    return null;
  }
}

const classifierServer = createServerFn({ method: "POST" })
  .validator((input: { ctx: WildReviewContext }) => input)
  .handler(async ({ data }) => {
    const { wildClassifierReviewForBridge } = await import("./wild-bridge.server.ts");
    return wildClassifierReviewForBridge(data.ctx);
  });

/**
 * Run the production Auto-Review classifier server-side for one review
 * context. A transport failure is an honest `{ ok: false, reason: "error" }`
 * envelope (never a verdict); a keyless server returns `not-configured`.
 */
export async function wildClassifierBridge(ctx: WildReviewContext): Promise<WildClassifierResult> {
  try {
    return await classifierServer({ data: { ctx } });
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      error: err instanceof Error ? err.message : String(err),
      code: classifyError(err, "RT_E_INTERNAL") as ErrorCode,
    };
  }
}

const edgeServer = createServerFn({ method: "POST" })
  .validator((input: { project: Project; phase: number }) => input)
  // The transport carries the stringified project (see the server half): a
  // returned `Project` is rejected by TanStack's serializability mapping on its
  // open-ended `unknown` fields alone, while the value is plain JSON.
  .handler(async ({ data }): Promise<string> => {
    const { runWildEdgeForBridgeJson } = await import("./wild-bridge.server.ts");
    return await runWildEdgeForBridgeJson(data.project, data.phase);
  });

/**
 * 347 — the browser's keyed execution edge for ANY phase. `phase` 6 routes to
 * the P6 chunked-synthesis edge; every other phase routes to the server-side
 * live layer (`headless.runPhase(p, phase, { live: true })`). The store injects
 * `wildEdgeBridge(6)` as `p6Edge`, `wildEdgeBridge(7)` as `liveEdge`, and
 * `wildPhaseEdge` (below) as the general arm.
 */
export function wildEdgeBridge(phase: number): (project: Project) => Promise<Project> {
  return async (project: Project): Promise<Project> => {
    try {
      const raw = await edgeServer({ data: { project, phase } });
      const out = JSON.parse(raw) as unknown;
      if (out === null || typeof out !== "object") {
        throw new Error("wild edge bridge returned no project");
      }
      return out as Project;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ...project,
        logs: [
          ...(Array.isArray(project.logs) ? project.logs : []),
          {
            ts: Date.now(),
            phase: phase as PhaseId,
            level: "warn" as const,
            event: phase === 6 ? "wild.p6.edge_unavailable" : phase === 7 ? "wild.p7.edge_unavailable" : `wild.p${phase}.edge_unavailable`,
            detail: `${phase === 6 ? "P6 keyed" : "keyed live"} edge transport failed (${msg.slice(0, 160)}) — deterministic floor used.`,
          },
        ].slice(-200),
      };
    }
  };
}

/** 347 — the general keyed edge for every phase other than 6 and 7. */
export function wildPhaseEdge(phase: PhaseId, project: Project): Promise<Project> {
  return wildEdgeBridge(phase)(project);
}
