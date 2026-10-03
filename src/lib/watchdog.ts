// ---------------------------------------------------------------------------
// watchdog.ts — pure wild-loop freeze-class decisions (fixes/109 §5).
//
// Zero-dep decision math shared by the store driver (startWildRun), the
// headless wild macro (wildStartRun) and the client heartbeat probe. The
// ENGINE is untouched (purity): drivers wrap engine.wildStep with these
// predicates + boundedStepWatch.
//
// What a watchdog CANNOT do (honest bounds, §5.1): cancel an in-flight
// awaited promise from the same tab; run while the main thread is blocked.
// Detection is post-hoc (interval lag) and prevention is pause-on-resolve —
// the design's "never abandon, never auto-resume" contract lives here as
// `requiresHumanResume`.
//
// EXPORT SURFACE (compile against these — do not rename):
//   watchdogDecision · shouldAutopause · heartbeatLagClass ·
//   requiresHumanResume · boundedStepWatch · HEARTBEAT_TICKS_PER_PERSIST
// ---------------------------------------------------------------------------

import {
  HEARTBEAT_LAG_WARN_MS,
  HEARTBEAT_MS,
  HEARTBEAT_PERSIST_EVERY_MS,
  STALL_CRITICAL_MS,
} from "./rt-events.ts";
import type { StallLatch } from "./rt-ring.ts";

/**
 * Step-time budget tiers (§5.2):
 *   0 — resolved under 1× budget (healthy)
 *   1 — ≥ 1× budget (overdue warn while still awaited)
 *   2 — ≥ 2× budget (timeout critical + stall latch + pause-on-resolve)
 */
export function watchdogDecision(elapsedMs: number, budgetMs: number): 0 | 1 | 2 {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(budgetMs) || budgetMs <= 0) return 0;
  if (elapsedMs >= budgetMs * 2) return 2;
  if (elapsedMs >= budgetMs) return 1;
  return 0;
}

/** Pause-on-resolve trigger: the step resolved at ≥ 2× budget (§5.2 tier 2). */
export function shouldAutopause(elapsedMs: number, budgetMs: number): boolean {
  return watchdogDecision(elapsedMs, budgetMs) === 2;
}

/** Heartbeat interval-lag classification (§5.3 thresholds). */
export function heartbeatLagClass(lagMs: number): "ok" | "warn" | "critical" {
  if (!Number.isFinite(lagMs)) return "ok";
  if (lagMs >= STALL_CRITICAL_MS) return "critical";
  if (lagMs >= HEARTBEAT_LAG_WARN_MS) return "warn";
  return "ok";
}

/**
 * Never-auto-resume invariant (§5.2/§5.5): an auto-pause or a main-thread
 * stall is ended ONLY by a human/agent act (toggleWildPause / CLI resume).
 */
export function requiresHumanResume(stall: StallLatch): boolean {
  return stall !== null && (stall.class === "step-timeout" || stall.class === "mainthread-stall");
}

/** Heartbeat rows per sidecar persist (§5.3: every 5th tick at 1 s ticks). */
export const HEARTBEAT_TICKS_PER_PERSIST = Math.max(
  1,
  Math.ceil(HEARTBEAT_PERSIST_EVERY_MS / HEARTBEAT_MS),
);

/**
 * Run a driver step under the two-tier budget (§5.2). While the step is
 * awaited: `onOverdue` fires at 1× budget, `onTimeout` at 2× (both only if
 * still pending — a watchdog cannot cancel the await, it can only observe).
 * Returns the result + true elapsed. Timers are always cleared.
 *
 * Deterministic for tests: pass tiny budgets and a step that resolves on a
 * real timer; no fake-clock coupling.
 */
export async function boundedStepWatch<T>(
  step: () => Promise<T>,
  opts: {
    budgetMs: number;
    autopauseMs: number;
    onOverdue?: (elapsedMs: number) => void;
    onTimeout?: (elapsedMs: number) => void;
  },
): Promise<{ result: T; elapsedMs: number }> {
  const t0 = Date.now();
  let settled = false;
  let overdueTimer: ReturnType<typeof setTimeout> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  try {
    overdueTimer = setTimeout(() => {
      if (!settled) opts.onOverdue?.(Date.now() - t0);
    }, opts.budgetMs);
    timeoutTimer = setTimeout(() => {
      if (!settled) opts.onTimeout?.(Date.now() - t0);
    }, opts.autopauseMs);
    const result = await step();
    settled = true;
    return { result, elapsedMs: Date.now() - t0 };
  } finally {
    settled = true;
    if (overdueTimer !== null) clearTimeout(overdueTimer);
    if (timeoutTimer !== null) clearTimeout(timeoutTimer);
  }
}
