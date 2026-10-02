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
import type { PhaseId, Project } from "./types.ts";
import {
  HITL_PHASES,
  PHASES,
  PHASE_BY_ID,
  PHASE_TAIL_START,
  STOCK_HITL,
  canEnter,
  phaseCoverage,
  phaseCoverageLine,
  phaseDef,
  priorsSealed,
} from "./phases.ts";
import { approve, createProject, runUntilGate } from "./headless.ts";

// W49/335-1: a driven run must be keyless. This file is a separate node --test
// child; clear the key so the create default is advisory (enforceDod off) and
// the deterministic floor reaches P12 instead of parking on the keyed regime.
delete process.env.DEEPSEEK_API_KEY;

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

  it("335-1: P8/P9/P12 summaries declare the deliverables no producer emits (no silent nothing)", () => {
    // Each phase names a deliverable in its summary; where the deterministic
    // floor and the live path produce no such artifact, the summary must say so
    // (the P2/P3 convention), never let the promise read as produced.
    assert.match(phaseDef(8).summary, /No component code is generated/, "P8: component code has no producer");
    assert.match(phaseDef(9).summary, /not a generated script/, "P9: GPU allocation has no producer");
    assert.match(
      phaseDef(12).summary,
      /roadmap declarations, not generated artifacts/,
      "P12: DB schemas / frontend-backend parity have no producer",
    );
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

// ---------------------------------------------------------------------------
// W49/335-1 — the register finding F-11 ("P7–P12 produced 0 artifacts") is a
// property of a run that STOPPED at a red P6, not of the phases themselves.
// A real driven advisory run reaches P12 and every tail phase writes its own
// artifact. These pins drive the actual headless loop (not the floor by hand)
// and assert the census the packet reports.
// ---------------------------------------------------------------------------
describe("W49/335-1 driven-run tail coverage (F-11)", () => {
  const BRIEF =
    "A coffeehouse and home property ledger: track shops, record rent payments, flip houses, " +
    "show deal pipeline, and lease maintenance requests. Operators manage properties and tenants.";

  /** Phase → the artifact kind(s) its deterministic producer writes. */
  const TAIL_KIND: Readonly<Record<number, string>> = {
    7: "research",
    8: "ui",
    9: "cicd",
    10: "edge",
    11: "tools",
    12: "docs",
  };

  async function drain(project: Project): Promise<Project> {
    let p = project;
    for (let i = 0; i < 40; i++) {
      if (p.status === "complete" || p.status === "blocked") return p;
      p = (await runUntilGate(p, { maxSteps: 1 })).project;
      if (p.status === "awaiting_hitl") p = approve(p);
    }
    return p;
  }

  it("a driven run reaches P12 and P7–P12 each write their artifact (the F-11 count is not 0)", async () => {
    const done = await drain(createProject({ brief: BRIEF, name: "RentLedger" }));
    assert.equal(done.status, "complete", "keyless advisory run drains to complete");
    assert.equal(done.currentPhase, 12);
    assert.equal(done.phases.filter((r) => r.status === "complete").length, 13);

    for (const id of Object.keys(TAIL_KIND).map(Number)) {
      const rows = (done.artifacts ?? []).filter((a) => a.phase === id && a.kind !== "packet");
      assert.ok(
        rows.length >= 1,
        `P${id} produced no artifact — its producer (engine.synthesizePhase case ${id}) is not wired`,
      );
      assert.ok(
        rows.some((a) => a.kind === TAIL_KIND[id]),
        `P${id} artifact kind should include "${TAIL_KIND[id]}" (got ${rows.map((a) => a.kind).join(",")})`,
      );
    }

    const cov = phaseCoverage(done.phases, done.artifacts ?? []);
    assert.equal(cov.executed, 13);
    assert.equal(cov.tailStart, PHASE_TAIL_START);
    assert.ok(cov.tailArtifacts >= 6, `the tail wrote ${cov.tailArtifacts} artifacts, expected ≥6`);
    assert.match(phaseCoverageLine(cov), /^13 of 13 phases executed \/ \d+ artifacts from P7–P12$/);

    // P12 legally owns ADRs + OpenAPI (F-11 saw both as empty strings).
    assert.ok((done.openapi ?? "").length > 0, "P12 wrote the OpenAPI document");
    assert.ok((done.adr ?? "").length > 0, "P12 wrote the ADRs");
  });

  it("a run stopped before the tail reports its emptiness as the honest census line (never silent)", () => {
    const fresh = createProject({ brief: BRIEF, name: "RentLedger" });
    const cov = phaseCoverage(fresh.phases, fresh.artifacts ?? []);
    assert.equal(cov.executed, 0);
    assert.equal(cov.tailArtifacts, 0);
    assert.equal(phaseCoverageLine(cov), "0 of 13 phases executed / 0 artifacts from P7–P12");
  });
});
