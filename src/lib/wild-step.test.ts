// ---------------------------------------------------------------------------
// wild-step.test.ts — Wild Mode bounded-step code stamping (23 B5 / fixes 70).
// Run: node --experimental-strip-types --test src/lib/wild-step.test.ts
//
// Pins the RT_E_* `code` field on WildStepResult pause arms: a driver loop
// branches on the machine value, never on prose. Additive field — every test
// below was unreachable before B5 (zero wild coverage existed).
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyProject, wildStep, type WildReviewer } from "./engine.ts";
import type { Project } from "./types.ts";

/** An ACTIVE wild-run project pinned to one phase status (no gate open). */
function wildFixture(status: "locked" | "rejected" | "awaiting_hitl"): Project {
  const p = emptyProject({ name: "Wild", brief: "A wild brief for the autonomous loop." });
  p.wildMode = true;
  p.wildRun = {
    active: true,
    phase: 0,
    startedAt: Date.now(),
    lastAutoLog: "Wild run started at P0",
    lastAutoAt: Date.now(),
    stoppedAt: null,
    pause: false,
  };
  p.currentPhase = 0;
  p.status = status === "awaiting_hitl" ? "awaiting_hitl" : "running";
  p.phases[0] = { ...p.phases[0], status };
  if (status === "awaiting_hitl") {
    p.hitl = {
      phase: 0,
      title: "P0 reframe gate",
      prompt: "Approve the reframe?",
      stakes: "high",
      ...(status === "awaiting_hitl" ? { forceHuman: false } : {}),
    };
  }
  return p;
}

const notConfiguredReviewer: WildReviewer = async () => ({
  ok: false,
  reason: "not-configured",
  error: "no key",
});

const errorReviewer: WildReviewer = async () => ({
  ok: false,
  reason: "error",
  error: "provider refused",
});

describe("wildStep code stamping (B5)", () => {
  it("pauses with RT_E_GATE_PENDING on a human-only (forceHuman) gate", async () => {
    const p = wildFixture("awaiting_hitl");
    p.hitl = { ...p.hitl!, forceHuman: true };
    const res = await wildStep(p, { reviewer: notConfiguredReviewer });
    assert.equal(res.outcome, "paused");
    assert.equal(res.ran, true);
    assert.equal(res.code, "RT_E_GATE_PENDING");
    assert.equal(res.project.wildRun?.pause, true);
  });

  it("pauses with RT_E_LLM_NOT_CONFIGURED when the gate classifier is not configured", async () => {
    const res = await wildStep(wildFixture("awaiting_hitl"), { reviewer: notConfiguredReviewer });
    assert.equal(res.outcome, "paused");
    assert.equal(res.code, "RT_E_LLM_NOT_CONFIGURED");
  });

  it("pauses with RT_E_LLM_REJECTED when the gate classifier errors", async () => {
    const res = await wildStep(wildFixture("awaiting_hitl"), { reviewer: errorReviewer });
    assert.equal(res.outcome, "paused");
    assert.equal(res.code, "RT_E_LLM_REJECTED");
  });

  it("pauses with RT_E_PHASE_ILLEGAL on a locked current phase", async () => {
    const res = await wildStep(wildFixture("locked"), { reviewer: notConfiguredReviewer });
    assert.equal(res.outcome, "paused");
    assert.equal(res.code, "RT_E_PHASE_ILLEGAL");
  });

  it("pauses with RT_E_PHASE_ILLEGAL on a rejected current phase", async () => {
    const res = await wildStep(wildFixture("rejected"), { reviewer: notConfiguredReviewer });
    assert.equal(res.outcome, "paused");
    assert.equal(res.code, "RT_E_PHASE_ILLEGAL");
  });

  it("noop carries NO code (inactive run is not an error)", async () => {
    const p = wildFixture("locked");
    p.wildRun = { ...p.wildRun!, active: false };
    const res = await wildStep(p, { reviewer: notConfiguredReviewer });
    assert.equal(res.outcome, "noop");
    assert.equal(res.ran, false);
    assert.equal(res.code, undefined);
  });
});

// ---------------------------------------------------------------------------
// fixes/109 CAP-5: optional onEvent telemetry sink (additive, purity-preserving).
// ---------------------------------------------------------------------------
import type { RtEventSeed } from "./rt-events.ts";

function recorder(): { rows: RtEventSeed[]; onEvent: (seed: RtEventSeed) => void } {
  const rows: RtEventSeed[] = [];
  return { rows, onEvent: (seed) => rows.push(seed) };
}

describe("wildStep onEvent telemetry (109 CAP-5)", () => {
  it("emits NOTHING when onEvent is absent (byte-identical behavior)", async () => {
    const r = recorder();
    const p = wildFixture("awaiting_hitl");
    const res = await wildStep(p, { reviewer: notConfiguredReviewer });
    assert.equal(res.outcome, "paused");
    assert.equal(r.rows.length, 0, "no sink passed ⇒ zero emissions");
  });

  it("emits nothing for noop steps (no active run / paused run / complete project)", async () => {
    const r = recorder();
    const p = wildFixture("locked");
    p.wildRun = { ...p.wildRun!, active: false };
    const noop = await wildStep(p, { reviewer: notConfiguredReviewer, onEvent: r.onEvent });
    assert.equal(noop.outcome, "noop");
    assert.equal(r.rows.length, 0, "noop emits no rows");
  });

  it("emits wild.step_paused (warn + code) for a guard-pause path", async () => {
    const r = recorder();
    const res = await wildStep(wildFixture("locked"), {
      reviewer: notConfiguredReviewer,
      onEvent: r.onEvent,
    });
    assert.equal(res.outcome, "paused");
    assert.equal(r.rows.length, 1, "locked guard → exactly one paused row");
    assert.equal(r.rows[0].event, "wild.step_paused");
    assert.equal(r.rows[0].scope, "wild-step");
    assert.equal(r.rows[0].code, "RT_E_PHASE_ILLEGAL");
    assert.equal(r.rows[0].capture, "src/lib/engine.ts:wildStep");
  });

  it("emits start then paused for a gate-review pause (dispatch path)", async () => {
    const r = recorder();
    const res = await wildStep(wildFixture("awaiting_hitl"), {
      reviewer: notConfiguredReviewer,
      onEvent: r.onEvent,
    });
    assert.equal(res.outcome, "paused");
    assert.equal(res.code, "RT_E_LLM_NOT_CONFIGURED");
    assert.deepEqual(
      r.rows.map((x) => x.event),
      ["wild.step_start", "wild.step_paused"],
    );
    assert.equal(r.rows[0].payload?.phase, 0);
    assert.equal(r.rows[1].code, "RT_E_LLM_NOT_CONFIGURED");
  });

  it("emits wild.step_error (code RT_E_INTERNAL + stack) on an unexpected engine throw", async () => {
    const r = recorder();
    const p = wildFixture("awaiting_hitl");
    // A hostile phases value makes wildStep's own `.find` throw — the exact
    // freeze-adjacent class the catch arm exists for.
    (p as unknown as { phases: unknown }).phases = "corrupt";
    const res = await wildStep(p, { reviewer: notConfiguredReviewer, onEvent: r.onEvent });
    assert.equal(res.outcome, "paused");
    assert.equal(res.code, "RT_E_INTERNAL");
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].event, "wild.step_error");
    assert.equal(r.rows[0].code, "RT_E_INTERNAL");
    assert.ok((r.rows[0].stack ?? "").length > 0, "stack tail captured");
  });

  it("project result is identical with and without the sink (zero behavior change)", async () => {
    const withSink = await wildStep(wildFixture("awaiting_hitl"), {
      reviewer: notConfiguredReviewer,
      onEvent: () => undefined,
    });
    const without = await wildStep(wildFixture("awaiting_hitl"), {
      reviewer: notConfiguredReviewer,
    });
    // Wall-clock stamps (createdAt, ledger ts, wildRun stamps), the per-run
    // project id, and the packet's compiled_at/project_id differ between the
    // two separately-built fixtures — normalize them; everything else must be
    // identical (the sink may not alter engine behavior).
    const normalize = (p: Project) => ({
      ...p,
      id: "fixture",
      createdAt: 0,
      logs: p.logs.map((l) => ({ ...l, ts: 0 })),
      packet: p.packet
        .replace(/compiled_at: [^\n]+/g, "compiled_at: FIXED")
        .replace(/project_id: [^\n]+/g, "project_id: FIXED")
        .replace(/"compiled_at": "[^"]+"/g, '"compiled_at": "FIXED"')
        .replace(/"project_id": "[^"]+"/g, '"project_id": "FIXED"'),
      traces: (p.traces ?? []).map((a) => ({ ...a, ranAt: 0 })),
      wildRun: p.wildRun ? { ...p.wildRun, startedAt: 0, lastAutoAt: 0 } : p.wildRun,
    });
    assert.deepEqual(normalize(withSink.project), normalize(without.project));
    assert.equal(withSink.outcome, without.outcome);
    assert.equal(withSink.code, without.code);
    assert.equal(withSink.ran, without.ran);
  });
});
