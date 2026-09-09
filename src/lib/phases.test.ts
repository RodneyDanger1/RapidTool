// ---------------------------------------------------------------------------
// phases.test.ts — phase-graph edge math + STOCK_HITL integrity.
// The graph is a strict 0..12 chain; phantom ids (-1, 13, …) must never be
// enterable or sealable, and the hard-coded STOCK_HITL list must never drift
// from the hitl flags declared on PHASES (store/headless gate human-approval
// on STOCK_HITL; diagram/UI read PHASES — a drift would split the product).
// Run: node --experimental-strip-types --test src/lib/phases.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PhaseId } from "./types.ts";
import {
  HITL_PHASES,
  PHASES,
  PHASE_BY_ID,
  STOCK_HITL,
  canEnter,
  phaseDef,
  priorsSealed,
} from "./phases.ts";

describe("PHASES table integrity", () => {
  it("declares every id 0..12 exactly once, in order, with matching codes", () => {
    assert.deepEqual(
      PHASES.map((p) => p.id),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    );
    for (const p of PHASES) {
      assert.equal(p.code, `P${p.id}`);
      assert.equal(PHASE_BY_ID.get(p.id), p);
    }
  });

  it("STOCK_HITL matches the hitl flags on PHASES (no drift)", () => {
    const declared = PHASES.filter((p) => p.hitl).map((p) => p.id);
    assert.deepEqual([...STOCK_HITL], declared);
    assert.deepEqual(HITL_PHASES, declared);
    // The two hard-coded consumers of stock HITL must agree with the table.
    for (const id of STOCK_HITL) {
      assert.equal(phaseDef(id).hitl, true);
    }
  });
});

describe("canEnter edge math", () => {
  it("allows exactly the adjacent forward step inside the real graph", () => {
    for (const id of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const) {
      assert.equal(canEnter(id, (id + 1) as PhaseId), true, `canEnter(${id}, ${id + 1})`);
    }
  });

  it("denies self, backwards, and skipping transitions", () => {
    assert.equal(canEnter(3, 3), false);
    assert.equal(canEnter(5, 4), false);
    assert.equal(canEnter(3, 5), false);
    assert.equal(canEnter(0, 12), false);
  });

  it("denies every transition touching a phantom phase (-1, 13, 99)", () => {
    assert.equal(canEnter(-1 as PhaseId, 0), false);
    assert.equal(canEnter(0, -1 as PhaseId), false);
    assert.equal(canEnter(12, 13 as PhaseId), false); // 13 === 12+1 must NOT pass
    assert.equal(canEnter(13 as PhaseId, 14 as PhaseId), false);
    assert.equal(canEnter(99 as PhaseId, 99 as PhaseId), false);
  });
});

describe("phaseDef edge math", () => {
  it("throws a machine-readable RT_E_PHASE_ILLEGAL for phantom ids", () => {
    for (const id of [-1, 13, 99]) {
      assert.throws(
        () => phaseDef(id as PhaseId),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.equal((err as Error & { code?: string }).code, "RT_E_PHASE_ILLEGAL");
          return true;
        },
      );
    }
  });
});

describe("priorsSealed edge math", () => {
  const sealed = (ids: number[]) => ids.map((id) => ({ id, status: "complete" as const }));

  it("target 0 is trivially sealed (nothing precedes it)", () => {
    assert.equal(priorsSealed([], 0), true);
    assert.equal(priorsSealed([{ id: 0, status: "running" }], 0), true);
  });

  it("never seals a phantom target (-1 / 13 vacuous-truth guard)", () => {
    assert.equal(priorsSealed(sealed([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), 13 as never), false);
    assert.equal(priorsSealed([], -1 as never), false);
    assert.equal(priorsSealed(sealed([0, 1, 2, 3, 4]), 99 as never), false);
  });

  it("requires every lower record complete even when the array is unsorted", () => {
    const unsorted = sealed([5, 0, 3, 2, 1]); // missing 4
    assert.equal(priorsSealed(unsorted, 5), false);
    assert.equal(priorsSealed(sealed([9, 0, 1, 2, 3, 4, 5, 6, 7, 8]), 10), true);
  });

  it("a lower record in any non-complete status blocks the seal", () => {
    const parked = [
      { id: 0, status: "complete" as const },
      { id: 1, status: "awaiting_hitl" as const },
      { id: 2, status: "locked" as const },
    ];
    assert.equal(priorsSealed(parked, 3), false);
    assert.equal(priorsSealed(parked, 2), false);
  });
});
