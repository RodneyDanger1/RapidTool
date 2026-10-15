/**
 * wild-bridge.server.ts — the SERVER half of the console's Wild Mode bridge.
 *
 * A browser host cannot reach the server-only seams directly: `headless.ts`
 * statically imports `node:fs` (it must never enter the client bundle) and
 * every runtime-assembled `*.server.` specifier on a client host is rewritten
 * by TanStack's import-protection plugin to a never-settling mock. The
 * client-safe half (`wild-bridge.ts`) wraps the two functions below in
 * `createServerFn` round-trips; those handlers execute HERE, inside the server
 * request, and reach the EXISTING server-side implementations:
 *
 *   - `generateWildPlanForBridge` → the existing `headless.generateWildPlan`
 *     (the ONE planner the CLI/headless wild drivers already call);
 *   - `wildClassifierReviewForBridge` → the production Auto-Review classifier
 *     (`wild-mode.server.ts` `wildClassifierReview`, bound to llm.ts's
 *     server-fn `complete()` + `llmStatus()`), which verdicts for real on the
 *     server where a Start request context exists.
 *
 * Honesty is unchanged: each function returns its server seam's OWN honest
 * result — never a fabricated plan row or a fabricated verdict. A keyless
 * server returns the planner's honest empty plan and the classifier's
 * `{ ok: false, reason: "not-configured" }`, exactly as the Node-side drivers.
 */
import type { Project, WildPlan } from "./types.ts";
import type { PhaseId } from "./types.ts";
import type { WildClassifierResult, WildReviewContext } from "./wild-mode.server.ts";

/** Run the EXISTING server-side planner for one project (headless.generateWildPlan). */
export async function generateWildPlanForBridge(project: Project): Promise<WildPlan> {
  const { generateWildPlan } = await import("./headless.ts");
  return generateWildPlan(project);
}

/**
 * Run the production Auto-Review classifier server-side for one review context.
 * `wildClassifierReview` is `createWildClassifier(complete)` — the llm.ts
 * server-fn completer plus the default `llmStatus` probe — so a keyed server
 * makes a REAL DeepSeek call and a keyless one returns `not-configured`.
 */
export async function wildClassifierReviewForBridge(
  ctx: WildReviewContext,
): Promise<WildClassifierResult> {
  const { wildClassifierReview } = await import("./wild-mode.server.ts");
  return wildClassifierReview(ctx);
}

/**
 * 347 — run the KEYED phase execution edge server-side for the browser host.
 *
 * The engine's own `wildP6Edge` / `wildLiveEdge` (engine.ts) reach the same
 * production seams, but only from a bare-Node host: in the browser
 * `keyedDeepSeekConfigured()` is false (no `process.env`), so `wildExecEdgeFor`
 * returns null and every phase executes the deterministic floor — which is why
 * a console Wild Mode run produced placeholder artifacts the classifier then
 * rejected. The engine's picker lets a caller INJECT the edge in any key state
 * (`opts.p6Edge` / `opts.liveEdge`); the console driver injects these bridge
 * wrappers when the server reports a key.
 *
 * Fallback semantics mirror engine.ts's own edges exactly: any load failure /
 * missing export / seam throw executes the deterministic floor and appends the
 * SAME coded warn row, so a transport problem can never fabricate a keyed pass
 * and never kills the step.
 */
export async function runWildEdgeForBridge(project: Project, phase: number): Promise<Project> {
  const [{ runP6Edge, runPhase }, { applyPhaseResult, wildLog }] = await Promise.all([
    import("./headless.ts"),
    import("./engine.ts"),
  ]);
  const p = (phase === 6 ? 6 : phase === 7 ? 7 : Math.max(0, Math.min(12, Math.trunc(phase)))) as PhaseId;
  const event =
    p === 6 ? "wild.p6.edge_unavailable" : p === 7 ? "wild.p7.edge_unavailable" : `wild.p${p}.edge_unavailable`;
  try {
    if (p === 6) {
      if (typeof runP6Edge !== "function") throw new Error("headless.runP6Edge export missing");
      return await runP6Edge(project);
    }
    if (typeof runPhase !== "function") throw new Error("headless.runPhase export missing");
    return await runPhase(project, p, { live: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return wildLog(
      applyPhaseResult(project, p),
      p,
      "warn",
      event,
      `${p === 6 ? "P6 keyed" : "keyed live"} edge unavailable (${msg.slice(0, 160)}) — deterministic floor used.`,
    );
  }
}

/**
 * The `createServerFn`-serializable form of {@link runWildEdgeForBridge}: a
 * Project is plain JSON, but TanStack's return-type mapping rejects its
 * open-ended `unknown` fields statically, so the transport carries the
 * stringified project and the client parses it back. Same value, no loss for
 * any field the store already persists to localStorage as JSON.
 */
export async function runWildEdgeForBridgeJson(project: Project, phase: number): Promise<string> {
  return JSON.stringify(await runWildEdgeForBridge(project, phase));
}
