// ---------------------------------------------------------------------------
// fixtures.test.ts — determinism contract of the shared engine fixtures
// (src/lib/testing/fixtures.ts): bounded, sleep-free, and ALWAYS parked at the
// requested gate's mouth, even for deep targets near the end of the 13-phase
// graph (regression: runToGate(seed, 12) used to exhaust its pass fuse at
// phase 11 and return short of the target).
// Run: node --experimental-strip-types --test src/lib/fixtures.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALL_PHASES, runHeadless, runToGate, seedProject } from "./testing/fixtures.ts";

describe("runToGate determinism", () => {
  it("seals every phase below target 12 and parks exactly at its mouth", () => {
    const g = runToGate(seedProject(), 12);
    assert.equal(g.status, "running");
    assert.equal(g.currentPhase, 12);
    assert.equal(g.phases.find((r) => r.id === 12)?.status, "ready");
    for (const id of ALL_PHASES.slice(0, 12)) {
      assert.equal(
        g.phases.find((r) => r.id === id)?.status,
        "complete",
        `phase ${id} must be sealed before the mouth of P12`,
      );
    }
  });

  it("seals every phase below target 10 (two HITL gates beyond the old fuse)", () => {
    const g = runToGate(seedProject(), 10);
    assert.equal(g.currentPhase, 10);
    for (const id of ALL_PHASES.slice(0, 10)) {
      assert.equal(g.phases.find((r) => r.id === id)?.status, "complete");
    }
    assert.equal(g.phases.find((r) => r.id === 10)?.status, "ready");
  });

  it("parks at the mouth of a HITL target without executing it (target stays ready)", () => {
    const g = runToGate(seedProject(), 4);
    assert.equal(g.status, "running");
    assert.equal(g.currentPhase, 4);
    assert.equal(g.phases.find((r) => r.id === 4)?.status, "ready", "P4 itself has not run yet");
    for (const id of ALL_PHASES.slice(0, 4)) {
      assert.equal(g.phases.find((r) => r.id === id)?.status, "complete");
    }
  });

  it("runHeadless seals a full run to P12 complete with the research corpus", () => {
    const g = runHeadless(seedProject(), ALL_PHASES);
    assert.equal(g.status, "complete");
    assert.equal(g.currentPhase, 12);
    for (const id of ALL_PHASES) {
      assert.equal(g.phases.find((r) => r.id === id)?.status, "complete", `phase ${id}`);
    }
    assert.ok(Array.isArray(g.research) && g.research.length > 0, "live-research corpus present");
  });
});
