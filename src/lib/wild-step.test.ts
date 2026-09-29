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
import { emptyProject, applyPhaseResult, wildStep, type WildReviewer } from "./engine.ts";
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
    // two separately-built fixtures — as does fixes/295's wall-clock-folded
    // envelope input_hash — normalize them; everything else must be
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
        .replace(/"project_id": "[^"]+"/g, '"project_id": "FIXED"')
        .replace(/"input_hash": "[^"]+"/g, '"input_hash": "FIXED"'),
      traces: (p.traces ?? []).map((a) => ({ ...a, ranAt: 0 })),
      // 308 P-1/P-2: the park record (and its lastStep mirror) now rides every
      // pause — park.at is the same per-run volatile class as lastAutoAt; the
      // records themselves still compare in full.
      wildRun: p.wildRun
        ? {
            ...p.wildRun,
            startedAt: 0,
            lastAutoAt: 0,
            park: p.wildRun.park ? { ...p.wildRun.park, at: 0 } : p.wildRun.park,
            lastStep: p.wildRun.lastStep
              ? {
                  ...p.wildRun.lastStep,
                  park: p.wildRun.lastStep.park
                    ? { ...p.wildRun.lastStep.park, at: 0 }
                    : p.wildRun.lastStep.park,
                }
              : p.wildRun.lastStep,
          }
        : p.wildRun,
    });
    assert.deepEqual(normalize(withSink.project), normalize(without.project));
    assert.equal(withSink.outcome, without.outcome);
    assert.equal(withSink.code, without.code);
    assert.equal(withSink.ran, without.ran);
  });
});

// ---------------------------------------------------------------------------
// W-01 (fixes/271 · §R1-f01): the wild P6 keyed edge seam. Keyed hosts execute
// phase 6 through headless.runP6Edge; keyless (or browser) keeps the EXACT
// pre-seam deterministic floor; an injected `p6Edge` test seam proves the call
// site without a key. (R9-f03 asked for these two pins after the seam landed.)
// ---------------------------------------------------------------------------

/** A P6-ready wild fixture: priors 0-5 sealed, cursor on a ready phase 6. */
function p6WildFixture(): Project {
  const p = emptyProject({ name: "WildP6", brief: "A wild brief for the autonomous loop." });
  p.wildMode = true;
  p.wildRun = {
    active: true,
    phase: 6,
    startedAt: Date.now(),
    lastAutoLog: "Wild run at P6",
    lastAutoAt: Date.now(),
    stoppedAt: null,
    pause: false,
  };
  p.currentPhase = 6;
  p.status = "running";
  p.phases = p.phases.map((r) =>
    r.id < 6 ? { ...r, status: "complete" as const } : r.id === 6 ? { ...r, status: "ready" as const } : r,
  );
  return p;
}

describe("W-01 (fixes/271 · §R1-f01) — the wild P6 keyed edge seam", () => {
  it("phase-6 execute runs an injected p6Edge seam exactly once and names the edge in wild.exec", async () => {
    const seen: Project[] = [];
    const fakeEdge = async (q: Project): Promise<Project> => {
      seen.push(q);
      return { ...q, lastTest: { ok: true, detail: "edge ran" } };
    };
    const res = await wildStep(p6WildFixture(), { reviewer: notConfiguredReviewer, p6Edge: fakeEdge });
    assert.equal(seen.length, 1, "the injected seam is called exactly once");
    assert.equal(seen[0]!.currentPhase, 6, "the seam receives the P6-running project");
    assert.equal(
      seen[0]!.phases.find((r) => r.id === 6)?.status,
      "running",
      "phase 6 is marked running before the edge executes",
    );
    const exec = (res.project.logs ?? []).filter((l) => l.event === "wild.exec");
    assert.equal(exec.length, 1, "one wild.exec row for the step");
    assert.ok(exec[0]!.detail.includes("edge"), `wild.exec names the edge used: ${exec[0]!.detail}`);
    assert.ok(
      !exec[0]!.detail.includes("deterministic floor"),
      "never logs the floor detail while the edge ran (fixes/154 D7 honesty rule)",
    );
  });

  it("keyless without a seam keeps the deterministic floor path byte-for-byte (parity pin)", async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      const seamless = await wildStep(p6WildFixture(), { reviewer: notConfiguredReviewer });
      // Control: the same fixture driven through the same tail with the floor
      // injected AS the edge — the ONLY intended difference is the wild.exec
      // detail string (the seam-naming rule, pinned in the test above).
      const control = await wildStep(p6WildFixture(), {
        reviewer: notConfiguredReviewer,
        p6Edge: async (q) => applyPhaseResult(q, 6),
      });
      // WDX-3 (fixes/274 · W31): two independently-executed pipelines always
      // differ on per-run volatile bytes. The first normalize (W-01, E1b) missed
      // two of that class — the phase record's completedAt and the embedded
      // packet text inside artifact bodies — so the pin read RED on volatile
      // bytes only (byte-classifier run at W31: 26 diffs = 25 volatile + the
      // seam-naming detail this pin intentionally masks). Same class as the
      // fields already masked below (incl. fixes/295 F2-03's envelope
      // input_hash, folded from the same wall-clocks); never a behavior
      // comparison.
      const stripVolatiles = (s: string) =>
        s
          .replace(/compiled_at: [^\n]+/g, "compiled_at: FIXED")
          .replace(/project_id: [^\n]+/g, "project_id: FIXED")
          .replace(/"compiled_at": "[^"]+"/g, '"compiled_at": "FIXED"')
          .replace(/"project_id": "[^"]+"/g, '"project_id": "FIXED"')
          .replace(/"input_hash": "[^"]+"/g, '"input_hash": "FIXED"');
      const normalize = (p: Project) => ({
        ...p,
        id: "fixture",
        createdAt: 0,
        artifacts: (p.artifacts ?? []).map((a) => ({ ...a, body: stripVolatiles(a.body) })),
        logs: (p.logs ?? []).map((l) =>
          l.event === "wild.exec" ? { ...l, ts: 0, detail: "FIXED" } : { ...l, ts: 0 },
        ),
        packet: stripVolatiles(p.packet),
        traces: (p.traces ?? []).map((a) => ({ ...a, ranAt: 0 })),
        wildRun: p.wildRun
          ? {
              ...p.wildRun,
              startedAt: 0,
              lastAutoAt: 0,
              // 308 P-1/P-2: the park record now rides every pause (parkIfNull at
              // finishStep) — its `at` is the same per-run volatile class as
              // lastAutoAt; masked here, the record itself still compares in full.
              park: p.wildRun.park ? { ...p.wildRun.park, at: 0 } : p.wildRun.park,
              // The summary's own park mirror (WildStepSummary.park) carries the
              // same clock — same class, masked identically.
              lastStep: p.wildRun.lastStep
                ? {
                    ...p.wildRun.lastStep,
                    park: p.wildRun.lastStep.park
                      ? { ...p.wildRun.lastStep.park, at: 0 }
                      : p.wildRun.lastStep.park,
                  }
                : p.wildRun.lastStep,
            }
          : p.wildRun,
        phases: (p.phases ?? []).map((r) => ({
          ...r,
          startedAt: r.startedAt === null ? null : 0,
          completedAt: typeof r.completedAt === "number" ? 0 : r.completedAt,
          gate: r.gate && typeof r.gate === "object" ? { ...(r.gate as object), checkedAt: 0 } : r.gate,
        })),
      });
      assert.deepEqual(
        normalize(seamless.project),
        normalize(control.project),
        "keyless no-seam == floor pipeline (modulo the seam-naming detail)",
      );
      assert.equal(seamless.outcome, control.outcome);
      assert.equal(seamless.code, control.code);
      // 308 P-1/P-2: the park record must RIDE the pause on both sides (this was
      // null before the fix — the parity normalizer above now masks only its clock).
      assert.equal(seamless.project.wildRun?.park?.code, "RT_E_GATE_PENDING");
      assert.equal(seamless.project.wildRun?.park?.unlock, "human-gate");
      const exec = (seamless.project.logs ?? []).find((l) => l.event === "wild.exec");
      assert.equal(exec?.detail, "P6 executed (deterministic floor)", "the exact pre-seam floor detail bytes");
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });
});
