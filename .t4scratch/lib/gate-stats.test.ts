// ---------------------------------------------------------------------------
// Approval-health (rubber-stamp detector) suite — gate-stats.test.ts
// Run: node --experimental-strip-types --test src/lib/gate-stats.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { approvalHealth } from "./gate-stats.ts";
import type { HitlDecision } from "./types.ts";

const now = Date.now();

function decision(
  over: Partial<HitlDecision> & { decidedAt: number },
): HitlDecision {
  return {
    id: `hitl-${over.decidedAt}-${Math.random()}`,
    phase: 4,
    title: "Approve isolation policy",
    decision: "approve",
    decidedBy: "human",
    requestedAt: over.decidedAt, // no timing captured unless overridden
    ...over,
  };
}

/** n human approvals at `latencyMs`, requestedAt latencyMs before decidedAt. */
function approvals(n: number, latencyMs: number, decidedAt = now): HitlDecision[] {
  return Array.from({ length: n }, (_, i) =>
    decision({
      decision: "approve",
      decidedAt: decidedAt - i,
      requestedAt: decidedAt - i - latencyMs,
    }),
  );
}

describe("approvalHealth", () => {
  it("returns ok with zero evidence for an empty journal", () => {
    const h = approvalHealth([]);
    assert.equal(h.n, 0);
    assert.equal(h.flag, "ok");
    assert.equal(h.rejectRate, 0);
    assert.equal(h.meanLatencyMs, 0);
  });

  it("skips garbage rows (null, primitives, missing timestamps) instead of throwing", () => {
    const rows = [
      null as never,
      "junk" as never,
      { id: "a", phase: 4, title: "t", decision: "approve", decidedBy: "human", requestedAt: now - 1000 } as unknown as HitlDecision, // no decidedAt
      { id: "b", phase: 4, title: "t", decision: "approve", decidedBy: "human", decidedAt: now } as unknown as HitlDecision, // no requestedAt
      decision({ decidedAt: now, requestedAt: now - 5000 }),
    ];
    const h = approvalHealth(rows);
    assert.equal(h.n, 1, "only the well-formed row counts");
    assert.equal(h.meanLatencyMs, 5000);
    assert.equal(h.flag, "ok");
  });

  it("treats a non-array journal container as empty instead of throwing", () => {
    // F3 sweep: a hand-edited import can carry `decisions: {}` / a string /
    // a number where the array belongs. (decisions ?? []).filter crashed on
    // those; the rail must render zero-evidence "ok" for every project.
    for (const junk of [{}, "junk", 42, true]) {
      const h = approvalHealth(junk as never);
      assert.equal(h.n, 0, `container ${JSON.stringify(junk)} must count 0`);
      assert.equal(h.flag, "ok");
      assert.equal(h.meanLatencyMs, 0);
      assert.equal(h.rejectRate, 0);
    }
  });

  it("drops rows with non-numeric timestamps / NaN / Infinity instead of throwing", () => {
    const good = decision({ decidedAt: now, requestedAt: now - 5000 });
    const rows = [
      { ...good, decidedAt: "1234" as never },
      { ...good, requestedAt: "now" as never },
      { ...good, decidedAt: Number.NaN },
      { ...good, decidedAt: Number.POSITIVE_INFINITY },
      { ...good, requestedAt: Number.NEGATIVE_INFINITY },
      good,
    ];
    const h = approvalHealth(rows as HitlDecision[]);
    assert.equal(h.n, 1, "only the well-formed row counts");
    assert.equal(h.meanLatencyMs, 5000);
  });

  it("flags ok with insufficient evidence (n < 3), even when fast", () => {
    const h = approvalHealth(approvals(2, 5000));
    assert.equal(h.n, 2);
    assert.equal(h.flag, "ok");
  });

  it("flags rubber when n >= 3 fast approvals carry zero rejects", () => {
    const h = approvalHealth(approvals(3, 5000));
    assert.equal(h.flag, "rubber");
    assert.equal(h.rejectRate, 0);
    assert.equal(h.meanLatencyMs, 5000);
  });

  it("flags fast (not rubber) when fast approvals still show real rejects", () => {
    const rows = [
      ...approvals(4, 10000),
      decision({ decision: "reject", decidedAt: now - 4, requestedAt: now - 4 - 10000 }),
    ];
    const h = approvalHealth(rows);
    assert.equal(h.n, 5);
    assert.equal(h.rejectRate, 0.2);
    assert.equal(h.flag, "fast");
  });

  it("flags ok when decisions are slow despite zero rejects", () => {
    const h = approvalHealth(approvals(3, 60000));
    assert.equal(h.meanLatencyMs, 60000);
    assert.equal(h.flag, "ok");
  });

  it("mean latency ignores rows with no timing (requestedAt === decidedAt)", () => {
    const rows = [
      decision({ decidedAt: now - 2000, requestedAt: now - 2000 - 10000 }), // 10s
      decision({ decidedAt: now - 1000, requestedAt: now - 1000 }), // no timing captured
      decision({ decidedAt: now, requestedAt: now - 30000 }), // 30s
    ];
    const h = approvalHealth(rows);
    assert.equal(h.n, 3);
    // Timed pairs are 10s and 30s → mean 20_000 → not under the 20s bar.
    assert.equal(h.meanLatencyMs, 20000);
    assert.equal(h.flag, "ok");
  });

  it("window excludes stale decisions (window over decidedAt)", () => {
    const fresh = approvals(3, 5000, now); // inside default 7-day window
    const stale = approvals(3, 4000, now - 8 * 24 * 3600 * 1000); // 8 days old
    const h = approvalHealth([...fresh, ...stale]);
    assert.equal(h.n, 3, "stale rows must be excluded");
    assert.equal(h.flag, "rubber");
  });

  it("respects an explicit windowMs argument", () => {
    const inside = approvals(1, 5000, now - 30_000);
    const outside = approvals(3, 5000, now - 90_000);
    const h = approvalHealth([...inside, ...outside], 60_000);
    assert.equal(h.n, 1);
    assert.equal(h.flag, "ok");
  });

  it("ignores autopilot decisions entirely", () => {
    const autopilot = Array.from({ length: 3 }, (_, i) =>
      decision({
        decidedBy: "autopilot",
        decidedAt: now - i,
        requestedAt: now - i - 3000,
      }),
    );
    const h = approvalHealth([...autopilot, ...approvals(1, 60000)]);
    assert.equal(h.n, 1, "autopilot rows must not count");
    assert.equal(h.flag, "ok");
  });

  it("rounds mean latency and reject rate deterministically", () => {
    const rows = [
      decision({ decidedAt: now - 2000, requestedAt: now - 2000 - 10000 }),
      decision({ decidedAt: now - 1000, requestedAt: now - 1000 - 15000 }),
      decision({ decision: "approve", decidedAt: now, requestedAt: now - 25000 }),
      decision({ decision: "approve", decidedAt: now - 3, requestedAt: now - 3 - 10000 }),
      decision({ decision: "approve", decidedAt: now - 4, requestedAt: now - 4 - 10000 }),
      decision({ decision: "approve", decidedAt: now - 5, requestedAt: now - 5 - 10000 }),
      decision({ decision: "reject", decidedAt: now - 6, requestedAt: now - 6 - 10000 }),
    ];
    const h = approvalHealth(rows);
    assert.equal(h.n, 7);
    // (10000 + 15000 + 25000 + 10000*4) / 7 = 90000/7 ≈ 12857.14 → 12857
    assert.equal(h.meanLatencyMs, 12857);
    // 1 reject / 7 → 0.143
    assert.equal(h.rejectRate, 0.143);
    assert.equal(h.flag, "fast"); // mean < 20s, rejectRate 0.143 >= 0.05
  });
});
