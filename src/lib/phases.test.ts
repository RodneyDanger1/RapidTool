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

  it("335-1 (W50/336-1): P8/P9/P12 summaries declare the deliverables with no producer (no silent nothing)", () => {
    // Each phase names a deliverable in its summary; where the deterministic
    // floor and the live path produce no such artifact, the summary must say so
    // AND why (the P2/P3 convention), never let the promise read as produced.
    assert.match(phaseDef(8).summary, /No component code is generated/, "P8: component code has no producer");
    assert.match(phaseDef(8).summary, /carries no component-level contract/, "P8: the reason is stated");
    assert.match(phaseDef(9).summary, /not a generated script/, "P9: GPU allocation has no producer");
    assert.match(phaseDef(9).summary, /names no GPU workload/, "P9: the reason is stated");
    // W50/336-1: the P12 database schema now HAS a producer (derived from the A6
    // contract) — the summary states that, and keeps parity the reasoned gap.
    assert.match(
      phaseDef(12).summary,
      /PostgreSQL schema \(Database schema \(SQL DDL\)\) derived from the A6 data contract/,
      "P12: the schema is produced from the contract",
    );
    assert.match(
      phaseDef(12).summary,
      /Frontend\/backend parity is a roadmap declaration/,
      "P12: parity has no producer",
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
    assert.deepEqual(cov.emptyPhases, [], "no complete phase is a silent no-op");

    // P12 legally owns ADRs + OpenAPI (F-11 saw both as empty strings).
    assert.ok((done.openapi ?? "").length > 0, "P12 wrote the OpenAPI document");
    assert.ok((done.adr ?? "").length > 0, "P12 wrote the ADRs");
  });

  // -------------------------------------------------------------------------
  // W50/336-1: the three STOP-item producers and the wiring proof.
  // -------------------------------------------------------------------------
  it("W50/336-1: P12 produces the database schema derived from the A6 data contract", async () => {
    const done = await drain(createProject({ brief: BRIEF, name: "RentLedger" }));
    const schema = (done.artifacts ?? []).find(
      (a) => a.phase === 12 && a.title === "Database schema (SQL DDL)",
    );
    assert.ok(schema, "P12 wrote the database-schema artifact (the 335-1 STOP item)");
    assert.equal(schema!.kind, "docs");
    assert.equal(schema!.language, "sql");
    // Every table comes from a contract entity — the input is real, not invented.
    const entities = done.contracts?.entities ?? [];
    assert.ok(entities.length > 0, "fixture precondition: the A6 contract carries entities");
    for (const e of entities) {
      assert.ok(
        schema!.body.includes(`CREATE TABLE IF NOT EXISTS "${e.name}"`),
        `schema declares table "${e.name}" from the contract`,
      );
      for (const f of e.fields) {
        assert.ok(schema!.body.includes(`"${f.name}"`), `schema declares column "${f.name}" on "${e.name}"`);
      }
    }
    // The DDL is honest about not being executed, and its input source is named.
    assert.match(schema!.body, /provisions and runs no database \(B-18\)/);
    assert.match(schema!.body, /derived from the A6 data contract/);
  });

  it("W50/336-1: every phase enters, records and hands off — no empty phase, no orphaned artifact kind", async () => {
    const done = await drain(createProject({ brief: BRIEF, name: "RentLedger" }));
    // Enter: each real phase emitted its phase.enter log row.
    for (const def of PHASES) {
      assert.ok(
        (done.logs ?? []).some((l) => l.phase === def.id && l.event === "phase.enter"),
        `P${def.id} never logged phase.enter — it silently no-oped`,
      );
    }
    // Record: every phase record is complete with a recorded DoD verdict.
    const completed = (done.phases ?? []).filter((r) => r.status === "complete");
    assert.equal(completed.length, 13, "all 13 phase records sealed");
    for (const r of completed) {
      assert.ok(r.gate, `P${r.id} sealed with no recorded DoD verdict`);
    }
    // Hand off: the packet names the current edge and carries the packet artifact.
    assert.ok((done.packet ?? "").includes("## Current edge"), "the packet hands off to the next agent");
    assert.ok((done.artifacts ?? []).some((a) => a.kind === "packet"), "the packet artifact is recorded");
    // No orphaned artifact kind: every kind in the ArtifactKind union is
    // actually produced in the run (a declared kind no producer emits would be
    // an orphan).
    const produced = new Set<string>((done.artifacts ?? []).map((a) => a.kind));
    const union = [
      "scorecard", "graph", "memory", "mcp", "security", "validation", "code", "research",
      "ui", "cicd", "edge", "tools", "docs", "packet", "algorithm", "gate",
    ];
    for (const k of union) {
      assert.ok(produced.has(k), `artifact kind "${k}" is in the union but no phase produced it`);
    }
    assert.deepEqual(phaseCoverage(done.phases, done.artifacts ?? []).emptyPhases, []);
  });

  it("a run stopped before the tail reports its emptiness as the honest census line (never silent)", () => {
    const fresh = createProject({ brief: BRIEF, name: "RentLedger" });
    const cov = phaseCoverage(fresh.phases, fresh.artifacts ?? []);
    assert.equal(cov.executed, 0);
    assert.equal(cov.tailArtifacts, 0);
    assert.deepEqual(cov.emptyPhases, []);
    assert.equal(phaseCoverageLine(cov), "0 of 13 phases executed / 0 artifacts from P7–P12");
  });
});

// ---------------------------------------------------------------------------
// W50/336-1 — the census counts what a phase PRODUCES, not the driver's
// bookkeeping rows: a gate verdict (kind "gate") and the packet row are not
// deliverables, so the same 13-phase run reports the same total whichever
// driver recorded the gates. A complete phase with no deliverable is named.
// ---------------------------------------------------------------------------
describe("W50/336-1 phaseCoverage bookkeeping", () => {
  it("excludes the packet and gate rows from the tail count (driver-independent)", () => {
    const phases = [7, 8, 12].map((id) => ({ id, status: "complete" }));
    const rows = [
      { phase: 7, kind: "research" },
      { phase: 7, kind: "gate" },
      { phase: 8, kind: "ui" },
      { phase: 8, kind: "gate" },
      { phase: 12, kind: "docs" },
      { phase: 12, kind: "docs" },
      { phase: 12, kind: "gate" },
      { phase: 12, kind: "packet" },
    ];
    const cov = phaseCoverage(phases, rows);
    assert.equal(cov.tailArtifacts, 4, "research + ui + 2 docs deliverable rows (3 gate + 1 packet excluded)");
    assert.deepEqual(cov.emptyPhases, [], "each complete phase produced a deliverable");
  });

  it("names every complete phase that produced no deliverable artifact", () => {
    const phases = [
      { id: 0, status: "complete" },
      { id: 1, status: "complete" },
      { id: 2, status: "awaiting_hitl" },
    ];
    const rows = [
      { phase: 0, kind: "gate" }, // bookkeeping only → P0 produced nothing
      { phase: 1, kind: "graph" },
    ];
    const cov = phaseCoverage(phases, rows);
    assert.deepEqual(cov.emptyPhases, [0], "P0 completed with only its gate row; P2 never completed");
  });
});
