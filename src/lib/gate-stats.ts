// ---------------------------------------------------------------------------
// Approval-health gate (T2 / E-105) — gate-stats.ts
//
// Rubber-stamp whisper: watches the append-only HitlDecision journal for the
// human gates (P4/P5/P8/P9 + scheduler extras). A gate that resolves too fast
// with almost no rejections is a rubber stamp, not a review. Only entries
// decided by a human (decidedBy === "human") count; autopilot decisions are
// excluded by design (B-03/R3: autopilot may never self-approve, so its rows
// would pollute a human-behavior signal).
//
// Run: node --experimental-strip-types --test src/lib/gate-stats.test.ts
// ---------------------------------------------------------------------------
import type { HitlDecision } from "./types.ts";

export type GateHealth = {
  n: number;
  meanLatencyMs: number;
  rejectRate: number;
  flag: "ok" | "fast" | "rubber";
};

const round2 = (x: number): number => Math.round(x * 1000) / 1000;

/**
 * Summarize human gate decisions inside a trailing window (default 7 days,
 * window over `decidedAt`).
 *
 * - Only decidedBy "human" approve/reject rows inside the window are counted.
 * - meanLatencyMs averages (decidedAt - requestedAt) over rows that actually
 *   captured timing (decidedAt > requestedAt); rows where requestedAt ===
 *   decidedAt carry no timing signal and are excluded from the mean.
 * - rejectRate = rejects / (approves + rejects), rounded to 3 decimals.
 * - flag: "rubber" when n >= 3, mean < 20s and rejectRate < 5% (fast AND
 *   near-unanimous approval); "fast" when n >= 3 and mean < 20s but the
 *   rejection rate shows real scrutiny; "ok" otherwise (n < 3 is always "ok"
 *   — insufficient evidence to accuse anyone).
 */
export function approvalHealth(
  decisions: HitlDecision[],
  windowMs = 7 * 24 * 3600 * 1000,
): GateHealth {
  const now = Date.now();
  const cutoff = now - windowMs;
  // Element guard: decisions rows come from persisted state, which is only
  // ever written by the store — but a hand-edited import or an older write
  // path can slip a null/garbage row through hydration. Stats over the
  // journal must skip junk, never throw (the caller renders the rail for
  // every project). F3 sweep: the CONTAINER itself can be junk too (a
  // hand-edited `decisions: {}` / string payload) — `(x ?? []).filter`
  // crashes on non-null non-arrays, so guard with Array.isArray first and
  // treat any non-array as an empty journal (zero-evidence "ok").
  const journal = Array.isArray(decisions) ? decisions : [];
  const human = journal.filter(
    (d) =>
      d !== null &&
      typeof d === "object" &&
      d.decidedBy === "human" &&
      (d.decision === "approve" || d.decision === "reject") &&
      // F3 sweep: non-finite timestamps (NaN slips comparisons, Infinity
      // passes them and poisons the mean with Infinity) carry no timing
      // signal — drop them like any other junk row.
      Number.isFinite(d.decidedAt) &&
      Number.isFinite(d.requestedAt) &&
      d.decidedAt >= cutoff &&
      // A27: window on the request too — a request that sat for days and was
      // only decided now must not drag its mostly-pre-window latency into the
      // mean for the current window.
      d.requestedAt >= cutoff,
  );
  const n = human.length;

  const timed = human.filter((d) => d.decidedAt > d.requestedAt);
  const meanLatencyMs =
    timed.length > 0
      ? Math.round(timed.reduce((sum, d) => sum + (d.decidedAt - d.requestedAt), 0) / timed.length)
      : 0;
  const rejects = human.filter((d) => d.decision === "reject").length;
  const rejectRate = n > 0 ? round2(rejects / n) : 0;

  let flag: GateHealth["flag"] = "ok";
  // A03: no timing signal ⇒ no fast/rubber claim. A mean of 0 computed from
  // zero timed rows (requestedAt === decidedAt everywhere) must never be read
  // as "fast" — that would accuse a human of rubber-stamping with no evidence.
  if (n >= 3 && timed.length > 0) {
    const fast = meanLatencyMs < 20000;
    if (fast && rejectRate < 0.05) flag = "rubber";
    else if (fast) flag = "fast";
  }
  return { n, meanLatencyMs, rejectRate, flag };
}
