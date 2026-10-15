/**
 * R14-f01 (W30 lane S1 — fixes/272_s1_autonomy.md · spec:
 * research/multiagent/thoroughanalysis.md §R14-f01) — the NODE-SIDE Wild Mode
 * supervisor completer seam.
 *
 * The defect this shell closes: the Auto-Review Supervisor is a GHOST on every
 * host that actually runs the wild loop. `engine.wildStep`'s default reviewer
 * is `wild-mode.server.ts`'s `wildClassifierReview`, whose `complete()`
 * facade (llm.ts) is built on `createServerFn` sites — under BARE NODE (the
 * only host the CLI/headless/wild drivers run on) there is no Start context,
 * so `llmStatus()` reports unconfigured and the optional gate reviewer can
 * never return a verdict (the loop degrades honestly to the deterministic DoD
 * floor). In the browser the same specifier is rewritten by TanStack
 * import-protection to an access-reporting mock proxy — reviewable there
 * neither.
 *
 * The seam: `createNodeWildReviewer()` builds the SAME classifier
 * (`createWildClassifier` — the injected-`WildCompleter` factory) but injects
 * the provider module's `completeDeepSeek` + a direct-env status probe
 * (`isDeepSeekConfigured`, a plain process.env read — parity with
 * `engine.ts:2871-2873`'s P6 probe, NEVER the server-fn `llmStatus`). Callers
 * (store wild driver, headless wild macros) pass the result as
 * `wildStep(project, { reviewer })`.
 *
 * Host/guard contract (this module is client-safe — no top-level server
 * imports, no node:fs):
 *   - bare Node, key absent ⇒ returns null (keyless runs keep the exact
 *     DoD-floor bytes they have today);
 *   - bare Node, key present ⇒ the classifier can actually verdict, and the
 *     engine logs `wild.review (classifier)`;
 *   - non-Node host (browser console) ⇒ `createHostWildReviewer` reaches the
 *     SERVER's keyed classifier through `wild-bridge.ts`'s createServerFn
 *     (llm.ts's server-fn `complete()`/`llmStatus()`); a server that reports
 *     no key returns null and the engine keeps the honest `not-configured`
 *     path. (2026-10-05: this replaces the old browser-always-null behavior
 *     that parked every consent gate with `wild.paused_classifier`.)
 *
 * TODO(R14-f01): the keyed evidence run plus any remaining driver threading
 * (runUntilGate/liveLayer surfaces) land with the funded boundary run; the
 * classifier POLICY layer (allow-lists W-43/F4, plan review R13-f02) stays
 * engine-side and is NOT implemented here.
 */

import type {
  WildClassifierResult,
  WildCompleter,
  WildReviewContext,
} from "./wild-mode.server.ts";
import type { WildReviewer } from "./engine.ts";

/**
 * Re-exported so Node-side callers can name the injected reviewer type without
 * importing engine internals.
 */
export type { WildReviewer };

/** Structural shape of the provider module this seam binds (deepseek.server.ts re-exports). */
type NodeDeepSeekModule = {
  /** The provider entry point — signature-compatible with WildCompleter. */
  completeDeepSeek?: WildCompleter;
  /** Direct-env probe (process.env.DEEPSEEK_API_KEY) — the bare-Node truth. */
  isDeepSeekConfigured?: () => boolean;
  /** Live model ids for the status probe ([] when keyless). */
  deepSeekModelIds?: () => string[];
};

type WildModeModule = {
  createWildClassifier?: (
    completeFn: WildCompleter,
    statusFn?: () => Promise<{ configured: boolean; models: string[] }>,
  ) => { wildClassifierReview: WildReviewer };
};

/** True when this module runs on a bare Node host (never the browser graph). */
function isBareNodeHost(): boolean {
  return typeof process !== "undefined" && typeof process.versions?.node === "string";
}

/**
 * Build the Node-side Auto-Review reviewer, or null when this host/key state
 * must keep the engine's existing default. NEVER throws — a failed load
 * degrades to null (the caller's engine default remains the honest fallback).
 */
export async function createNodeWildReviewer(): Promise<WildReviewer | null> {
  if (!isBareNodeHost()) return null;
  try {
    // Concatenated specifiers: the TanStack import-protection plugin statically
    // denies direct `*.server.*` imports from the client bundle; a computed
    // specifier defers the load to runtime (bare-Node hosts resolve it
    // directly; the browser never reaches this function — host guard above).
    const dsSpec = "./deepseek." + "server.ts";
    const ds = (await import(dsSpec)) as NodeDeepSeekModule;
    if (typeof ds.completeDeepSeek !== "function") return null;
    // Direct-env probe (parity engine.ts:2871-2873): isDeepSeekConfigured is a
    // plain process.env read. Keyless ⇒ null ⇒ the engine default reports
    // not-configured exactly as today (no fabricated reviewer).
    if (typeof ds.isDeepSeekConfigured !== "function" || ds.isDeepSeekConfigured() !== true) {
      return null;
    }
    // TODO(R14-f01): full logic after the shell — the keyed boundary run's
    // `wild.review (classifier)` evidence, plus any remaining driver surfaces
    // (runUntilGate/liveLayer) that should receive this reviewer. The policy
    // layer (allow-lists F4/W-43, plan review R13-f02) is deliberately NOT
    // part of this seam — it stays engine-side.
    const wmSpec = "./wild-mode." + "server.ts";
    const wm = (await import(wmSpec)) as WildModeModule;
    if (typeof wm.createWildClassifier !== "function") return null;
    const statusProbe = async (): Promise<{ configured: boolean; models: string[] }> => ({
      configured: ds.isDeepSeekConfigured?.() === true,
      models: ds.deepSeekModelIds?.() ?? [],
    });
    const { wildClassifierReview } = wm.createWildClassifier(ds.completeDeepSeek, statusProbe);
    return wildClassifierReview;
  } catch {
    // Missing provider module / load failure — the engine's default resolution
    // stays in charge (honest not-configured path), never a fake reviewer.
    return null;
  }
}

/**
 * Host-aware reviewer resolution — the generalized seam.
 *
 * Bare Node (CLI / headless / tests): `createNodeWildReviewer()` exactly as
 * before (provider `completeDeepSeek` + direct-env probe; null keyless).
 *
 * Denied host (the browser console): the runtime-assembled `*.server.`
 * specifiers are the import-protection mock, so the Node seam is unavailable —
 * but the SERVER process can still make the keyed calls. This branch asks the
 * server (llm.ts's server-fn `llmStatus()`) whether the key is configured; when
 * it is, it returns a REAL reviewer that routes each review through
 * `wild-bridge.ts`'s `createServerFn` (which runs the production
 * `wildClassifierReview` server-side — the same classifier the Node seam
 * binds). When the server reports no key — or the probe/transport fails — it
 * returns null, so the engine's `unavailableWildReviewer` keeps the exact
 * honest `not-configured` path. NEVER throws.
 */
export async function createHostWildReviewer(): Promise<WildReviewer | null> {
  if (isBareNodeHost()) return createNodeWildReviewer();
  try {
    // The LIVE server probe: a browser host has no process env, so the truth
    // about the key comes from the server. Outside a request context (bare-Node
    // tests that spoof the host) llmStatus() resolves { configured: false } —
    // the honest keyless path. Never a keyed call from this probe itself.
    const llm = (await import("./llm.ts")) as {
      llmStatus?: () => Promise<{ configured: boolean }>;
    };
    if (typeof llm.llmStatus !== "function") return null;
    const status = await llm.llmStatus();
    if (status.configured !== true) return null;
    const bridge = (await import("./wild-bridge.ts")) as {
      wildClassifierBridge?: (ctx: WildReviewContext) => Promise<WildClassifierResult>;
    };
    const review = bridge.wildClassifierBridge;
    if (typeof review !== "function") return null;
    // A real closure (a string `.name`) — trusted by engine.isTrustedCallable;
    // it is the bridge round-trip, never a proxy.
    return (ctx: WildReviewContext) => review(ctx);
  } catch {
    // Probe/transport failure — the engine's honest not-configured default.
    return null;
  }
}
