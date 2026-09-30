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
import { emptyProject, applyPhaseResult, wildStep, wildExecEdgeFor, approveHitl, type WildReviewer } from "./engine.ts";
import { runGate } from "./dod.ts";
import { mintTreeRunTested } from "./codegen.server.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";
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

// ---------------------------------------------------------------------------
// H2 (fixes/316_h2_policy.md · RS-03): the F4 per-action policy overlay is
// consulted at the gate — a project's list may refuse the machine
// self-approval. The refusal lands as the registered `wild.paused_policy`
// event + a coded park, and the classifier is never asked for a refused
// action. No list ⇒ the byte-identical classifier path (the no-list control).
// ---------------------------------------------------------------------------

describe("wildApproveGate policy-overlay refusal (H2 · fixes/316 · RS-03)", () => {
  const APPROVE_FEEDBACK = "classifier consents to this gate — every criterion traced.";

  it("refuses self-approval when the list denies hitl.approve — wild.paused_policy emitted, park coded", async () => {
    let calls = 0;
    const counting: WildReviewer = async () => {
      calls += 1;
      return { ok: true, verdict: "approve", feedback: APPROVE_FEEDBACK, model: "test" };
    };
    const r = recorder();
    const p = wildFixture("awaiting_hitl");
    (p as { wildPolicy?: unknown }).wildPolicy = { denyActions: ["hitl.approve"] };
    const res = await wildStep(p, { reviewer: counting, onEvent: r.onEvent });
    assert.equal(res.outcome, "paused");
    assert.equal(res.code, "RT_E_GATE_PENDING");
    assert.equal(calls, 0, "a refused action never spends a classifier call");
    assert.equal(res.project.status, "awaiting_hitl", "the gate stays open for a human");
    assert.equal(res.project.wildRun?.pause, true);
    const park = res.project.wildRun?.park;
    assert.ok(park, "park record stamped");
    assert.equal(park.code, "RT_E_GATE_PENDING");
    assert.equal(park.event, "wild.paused_policy");
    assert.equal(park.unlock, "human-retry");
    assert.ok(
      park.reason.includes("policy.action-denied:hitl.approve"),
      `park reason carries the refusal code: ${park.reason}`,
    );
    assert.deepEqual(
      r.rows.map((x) => x.event),
      ["wild.step_start", "wild.paused_policy", "wild.step_paused"],
      "the registered refusal event sits between start and the generic step pause",
    );
    const row = r.rows[1];
    assert.equal(row.scope, "wild-step");
    assert.equal(row.code, "RT_E_GATE_PENDING");
    assert.equal(row.capture, "src/lib/engine.ts:wildApproveGate");
    assert.ok(String(row.message).includes("policy.action-denied:hitl.approve"), "overlay reason carried in detail");
    assert.equal(row.payload?.policyCode, "policy.action-denied:hitl.approve");
    assert.equal(row.payload?.rule, "denyActions");
    assert.equal(row.payload?.action, "hitl.approve");
  });

  it("alwaysAsk maps to human-gate; an unreadable list fail-closes (never silently ignored)", async () => {
    const ask = wildFixture("awaiting_hitl");
    (ask as { wildPolicy?: unknown }).wildPolicy = { alwaysAsk: ["hitl.approve"] };
    const res = await wildStep(ask, { reviewer: notConfiguredReviewer });
    assert.equal(res.outcome, "paused");
    assert.equal(res.project.wildRun?.park?.unlock, "human-gate");
    assert.ok(String(res.project.wildRun?.park?.reason).includes("policy.action-ask:hitl.approve"));

    const bad = wildFixture("awaiting_hitl");
    (bad as { wildPolicy?: unknown }).wildPolicy = { allowActions: "not-a-list" };
    const refused = await wildStep(bad, { reviewer: notConfiguredReviewer });
    assert.equal(refused.outcome, "paused");
    assert.equal(refused.project.wildRun?.park?.code, "RT_E_GATE_PENDING");
    assert.ok(
      String(refused.project.wildRun?.park?.reason).includes("policy.action-list-unreadable:hitl.approve"),
      "a malformed list refuses — it is never dropped as if unenforced",
    );
  });

  it("no wildPolicy ⇒ classifier path unchanged (approval proceeds, no policy row)", async () => {
    const r = recorder();
    const p = wildFixture("awaiting_hitl");
    p.enforceDod = false; // decouple this pin from the host key state — DoD is not its subject
    const res = await wildStep(p, {
      reviewer: async () => ({ ok: true, verdict: "approve", feedback: APPROVE_FEEDBACK, model: "test" }),
      onEvent: r.onEvent,
    });
    assert.equal(res.outcome, "advanced");
    assert.equal(
      r.rows.some((x) => x.event === "wild.paused_policy"),
      false,
      "an absent list narrows nothing — byte-identical pre-H2 path",
    );
    assert.ok((res.project.logs ?? []).some((l) => l.event === "wild.approved"));
  });
});

// ---------------------------------------------------------------------------
// 316 H1 (313_d1_seal.md §S5 row; 315 V2 finding) — the wild P7 live edge.
// Pre-wire the declared `opts.liveEdge` seam had ZERO consumers: the T1.4
// probe (probe-h1-p7.mjs, repo root) drove a seeded enforceDod P7 through
// `wildStep` and arm B ≡ arm A — P7 hard-stopped on a `p7-research` corpus
// only the live layer can produce. Post-wire (engine.ts `wildExecEdgeFor`'s
// phase-7 arm + the `wildLiveEdge` production edge) the same probe reads
// SEAM HONORED (arm B: advanced, "P7 sealed → P8"). These pins lock that
// wire at the seam:
//   1. the injected seam is CONSUMED — P7 executes through it and advances;
//   2. keyless without a seam keeps the byte-identical deterministic floor;
//   3. a seeded enforceDod run's exact P7 pause text is intact (probe arm A).
// ---------------------------------------------------------------------------

/** Probe-h1-p7.mjs's seed shape: priors 0-6 sealed, cursor on a ready phase 7. */
function p7WildFixture(): Project {
  const p = emptyProject({
    name: "WildP7",
    brief: "A seeded enforceDod project for the wild P7 seam pins.",
    enforceDod: true,
  });
  p.wildMode = true;
  p.wildRun = {
    active: true,
    phase: 7,
    startedAt: Date.now(),
    lastAutoLog: "Wild run at P7",
    lastAutoAt: Date.now(),
    stoppedAt: null,
    pause: false,
  };
  p.currentPhase = 7;
  p.status = "running";
  p.phases = p.phases.map((r) =>
    r.id < 7 ? { ...r, status: "complete" as const } : r.id === 7 ? { ...r, status: "ready" as const } : r,
  );
  return p;
}

const approvingP7Reviewer: WildReviewer = async () => ({
  ok: true,
  verdict: "approve",
  feedback: "P7 pin reviewer approves the advance.",
  model: "pin",
});

/** The probe's seam shape: the real deterministic floor + the ONE thing the
 *  live layer adds — a research corpus entry (nothing else, no verdicts). */
function p7SeamResult(q: Project): Project {
  const done = applyPhaseResult(q, 7);
  return {
    ...done,
    research: [
      ...(done.research ?? []),
      {
        query: "pin:p7-live-edge",
        provider: "pin-seam",
        items: [
          {
            title: "Pin finding (injected seam)",
            url: "https://example.invalid/pin-h1-p7",
            content: "Seam pin — exercises the corpus path only.",
          },
        ],
      },
    ],
  };
}

describe("316 H1 — the wild P7 live-edge seam (the wire + the keyless floor)", () => {
  it("executes P7 through the injected liveEdge seam exactly once and advances (the seam is CONSUMED)", async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      const seen: Project[] = [];
      const res = await wildStep(p7WildFixture(), {
        reviewer: approvingP7Reviewer,
        liveEdge: async (q) => {
          seen.push(q);
          return p7SeamResult(q);
        },
      });
      assert.equal(seen.length, 1, "the injected seam is called exactly once");
      assert.equal(seen[0]!.currentPhase, 7, "the seam receives the P7-running project");
      assert.equal(
        seen[0]!.phases.find((r) => r.id === 7)?.status,
        "running",
        "phase 7 is marked running before the edge executes",
      );
      assert.equal(res.outcome, "advanced", "the seam clears p7-research ⇒ the enforceDod leave check advances");
      assert.equal(res.project.currentPhase, 8);
      assert.equal((res.project.research ?? []).length, 1, "the seam's corpus rode the result through");
      const exec = (res.project.logs ?? []).find((l) => l.event === "wild.exec");
      assert.equal(exec?.detail, "P7 executed (injected edge seam)", "wild.exec names the injected seam (never the floor)");
      assert.equal(
        (res.project.logs ?? []).some((l) => l.event === "wild.paused_dod"),
        false,
        "no DoD park when the seam cleared the gate",
      );
      assert.ok(
        (res.project.logs ?? []).some((l) => l.event === "wild.advance" && l.detail.includes("P7 sealed → P8")),
        "the advance row proves the pre-wire hard-stop is cured",
      );
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });

  it("keyless without a seam keeps the deterministic floor byte-for-byte (parity pin)", async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      const seamless = await wildStep(p7WildFixture(), { reviewer: approvingP7Reviewer });
      // Control: the same fixture driven through the same tail with the floor
      // injected AS the edge — the ONLY intended difference is the wild.exec
      // detail string (the seam-naming rule, pinned in the test above).
      const control = await wildStep(p7WildFixture(), {
        reviewer: approvingP7Reviewer,
        liveEdge: async (q) => applyPhaseResult(q, 7),
      });
      // Same volatile-byte class as the P6 parity pin above (fixes/274 · W31):
      // two independently-executed pipelines differ on per-run wall-clocks —
      // the compiled packet text, phase record stamps, and the park record's
      // `at` mirror. Never a behavior comparison.
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
              // 308 P-1/P-2: the park record rides every pause — its `at` is
              // the same per-run volatile class as lastAutoAt; masked here,
              // the record itself still compares in full.
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
      // The park record must RIDE the pause on both sides (308 P-1/P-2).
      assert.equal(seamless.project.wildRun?.park?.code, "RT_E_GATE_PENDING");
      assert.equal(seamless.project.wildRun?.park?.unlock, "human-gate");
      const exec = (seamless.project.logs ?? []).find((l) => l.event === "wild.exec");
      assert.equal(exec?.detail, "P7 executed (deterministic floor)", "the exact keyless floor detail bytes");
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });

  it("seeded enforceDod run keeps its exact P7 pause text (probe arm A, unchanged)", async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      const res = await wildStep(p7WildFixture(), { reviewer: approvingP7Reviewer });
      assert.equal(res.outcome, "paused");
      assert.equal(res.code, "RT_E_GATE_PENDING");
      assert.equal(
        res.error,
        "P7 DoD unmet — hard gate blocks advance: p7-research.",
        "the exact hard-DoD error text the probe recorded (arm A)",
      );
      assert.equal(res.project.currentPhase, 7, "the cursor never moved past the red gate");
      assert.equal((res.project.research ?? []).length, 0, "the floor produces no corpus");
      assert.notEqual(res.project.meta?.liveUnavailable, true, "no waiver is fabricated by the keyless floor");
      const row = (res.project.logs ?? []).find((l) => l.event === "wild.paused_dod");
      assert.ok(row, "wild.paused_dod row present");
      assert.equal(row!.detail, "P7 DoD unmet — hard gate blocks advance: p7-research");
      assert.equal(res.project.wildRun?.park?.code, "RT_E_GATE_PENDING");
      assert.equal(res.project.wildRun?.park?.unlock, "human-gate");
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });
});

// ---------------------------------------------------------------------------
// 316 H1/H3 — the ONE shared execution-edge picker (engine.wildExecEdgeFor),
// the resolution both the execute site AND the seal's repair pass read (so
// the two can never drift again — the drift WAS the 315 V2 finding). Three
// states per phase arm:
//   1. an injected seam wins in ANY key state (keyless and keyed);
//   2. keyless without a seam ⇒ null (the byte-identical floor);
//   3. keyed without a seam ⇒ the production edge function.
// The keyed arms check the SELECTION only — the returned function is never
// invoked (no keyed calls). Nothing resolves for phases outside 6/7.
// ---------------------------------------------------------------------------

describe("316 H1/H3 — the shared execution-edge picker states (wildExecEdgeFor)", () => {
  const seam = async (q: Project): Promise<Project> => q;

  it("state 1 — an injected seam wins in ANY key state (selection only, never invoked)", () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      assert.equal(wildExecEdgeFor(7, { liveEdge: seam }), seam, "keyless: the injected liveEdge wins");
      assert.equal(wildExecEdgeFor(6, { p6Edge: seam }), seam, "keyless: the injected p6Edge wins");
      process.env.DEEPSEEK_API_KEY = "selection-pin-not-a-real-key";
      assert.equal(
        wildExecEdgeFor(7, { liveEdge: seam }),
        seam,
        "keyed: the injected liveEdge STILL wins (the seam contract — any key state)",
      );
      assert.equal(
        wildExecEdgeFor(6, { p6Edge: seam }),
        seam,
        "keyed: the injected p6Edge STILL wins (the W-01 contract)",
      );
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });

  it("state 2 — keyless without a seam resolves null (the byte-identical deterministic floor)", () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      assert.equal(wildExecEdgeFor(7, undefined), null);
      assert.equal(wildExecEdgeFor(7, {}), null);
      assert.equal(wildExecEdgeFor(6, undefined), null, "the P6 arm keeps its keyless floor");
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });

  it("state 3 — keyed without a seam resolves the production edge function (selection only)", () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      process.env.DEEPSEEK_API_KEY = "selection-pin-not-a-real-key";
      const p7 = wildExecEdgeFor(7, undefined);
      const p6 = wildExecEdgeFor(6, undefined);
      assert.equal(typeof p7, "function", "keyed P7 resolves the wildLiveEdge production edge");
      assert.equal(typeof p6, "function", "keyed P6 resolves the wildP6Edge production edge");
      assert.notStrictEqual(p7, p6, "phase 7 and phase 6 resolve distinct production edges");
      assert.notStrictEqual(p7, seam, "an ABSENT seam never resolves to a caller function");
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });

  it("phases outside 6/7 never resolve an edge (no spillover)", () => {
    assert.equal(wildExecEdgeFor(3, { liveEdge: seam, p6Edge: seam }), null);
  });
});

// ---------------------------------------------------------------------------
// 316 H3 (315 V2 findings #1/#2; final in 316_wd3_guard.md §RESCUES) — the
// seal's ONE DoD-repair pass is CONSUMED: `wildDodRepairOnce` reads the
// injected `opts.dodRepair` seam first (declared but consumed by nobody
// before 316), else the SAME `wildExecEdgeFor(phase, opts)` edge the step
// executes through — so the repair can never drift from the execute site
// again (the drift WAS the finding: the repair read `opts.p6Edge` only and
// was production-dead on a real sealed run). A repaired result whose OWN
// re-run gate is green proceeds; a null/absent repair keeps the honest park.
// The pins drive the same seeded P7 fixture through the real leave path:
// the floor executes, its exit gate goes red on p7-research, and the seal's
// repair pass is the only thing standing between red and the park.
// ---------------------------------------------------------------------------

describe("316 H3 — the seal's repair pass consumes the dodRepair seam", () => {
  it("a repaired project ⇒ the DoD-red path proceeds (advance to P8; the seam saw the red candidate)", async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      const calls: { phase: number; gatePass: boolean }[] = [];
      const res = await wildStep(p7WildFixture(), {
        reviewer: approvingP7Reviewer,
        agentSeal: true,
        dodRepair: async (q, phase) => {
          calls.push({ phase, gatePass: runGate(q, 7).pass });
          return {
            ...q,
            research: [
              ...(q.research ?? []),
              {
                query: "pin:repair",
                provider: "pin-repair",
                items: [
                  {
                    title: "Repaired finding",
                    url: "https://example.invalid/repair-h3",
                    content: "Repair seam pin — clears p7-research.",
                  },
                ],
              },
            ],
          };
        },
      });
      assert.equal(calls.length, 1, "exactly ONE repair pass (313 D1's bound)");
      assert.equal(calls[0]!.phase, 7, "the repair runs on the sealed phase");
      assert.equal(calls[0]!.gatePass, false, "the repair runs on the DoD-RED candidate, never a green one");
      assert.equal(res.outcome, "advanced", "a repaired green gate lets the unattended run proceed");
      assert.equal(res.project.currentPhase, 8);
      assert.equal((res.project.research ?? []).length, 1, "the REPAIRED project is the one that proceeds");
      assert.equal(
        (res.project.logs ?? []).some((l) => l.event === "wild.paused_dod"),
        false,
        "no park when the repair cleared the gate",
      );
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });

  it("a null-returning seam ⇒ honest park naming the declined repair (probe-arm-A text intact)", async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      const calls: number[] = [];
      const res = await wildStep(p7WildFixture(), {
        reviewer: approvingP7Reviewer,
        agentSeal: true,
        dodRepair: async (_q, phase) => {
          calls.push(phase);
          return null;
        },
      });
      assert.equal(calls.length, 1, "the decline is consulted exactly once");
      assert.equal(res.outcome, "paused");
      assert.equal(res.code, "RT_E_GATE_PENDING");
      assert.equal(res.error, "P7 DoD unmet — hard gate blocks advance: p7-research.");
      const row = (res.project.logs ?? []).find((l) => l.event === "wild.paused_dod");
      assert.ok(row, "wild.paused_dod row present");
      assert.ok(
        row!.detail.includes("(repair seam declined P7 — honest park)"),
        `the park names the declined repair: ${row!.detail}`,
      );
      assert.equal(res.project.wildRun?.park?.code, "RT_E_GATE_PENDING");
      assert.equal(res.project.wildRun?.park?.unlock, "human-gate");
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });

  it("no seal ⇒ the seam is never called (opt-in consent — pre-seal bytes)", async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      let calls = 0;
      const res = await wildStep(p7WildFixture(), {
        reviewer: approvingP7Reviewer,
        dodRepair: async () => {
          calls += 1;
          return null;
        },
      });
      assert.equal(calls, 0, "agentSeal absent ⇒ the repair pass never fires");
      assert.equal(res.outcome, "paused");
      const row = (res.project.logs ?? []).find((l) => l.event === "wild.paused_dod");
      assert.equal(
        row!.detail,
        "P7 DoD unmet — hard gate blocks advance: p7-research",
        "no repair suffix when the seal is off (byte-identical pre-seal pause)",
      );
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });

  it("seal, keyless, no seam ⇒ the honest no-edge park (a blind floor re-run is not a repair, B-07)", async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      const res = await wildStep(p7WildFixture(), { reviewer: approvingP7Reviewer, agentSeal: true });
      assert.equal(res.outcome, "paused");
      assert.equal(res.code, "RT_E_GATE_PENDING");
      const row = (res.project.logs ?? []).find((l) => l.event === "wild.paused_dod");
      assert.ok(row, "wild.paused_dod row present");
      assert.ok(
        row!.detail.includes("(no non-floor repair edge for P7 — honest park)"),
        `the park names the missing non-floor edge: ${row!.detail}`,
      );
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });
});

// ---------------------------------------------------------------------------
// T6.2(c) — THE NO-MINT ⇒ P6-RED WALK (W43 canon: wave_plans/W43/COMPLETION-TASKS.md
// §F6/T6.2(c) + fixes/317_j2_preflight.md §3b, the CASE-A observation pinned).
// A green tree-run that executed NO spec must never mint a "tested" stamp: the
// honest producer (codegen.server.ts `mintTreeRunTested`, :3772) logs the coded
// `p6.tree.tested.skipped` row and leaves `p6-verified` UNMET in runGate(6).
// The enforceDod leave check then hard-stops the run on that red — the cursor
// never leaves P6 (wild.paused_dod naming p6-verified) — and the SAME fixture
// with one executed spec mints a tested stamp and advances. Keyless, in-memory:
// the walk drives the REAL floor exec (`applyPhaseResult`) plus the REAL mint
// through the documented `p6Edge` seam (the W-01 contract above), in the
// production order (exec ⇒ tree-run mint on the post-exec project ⇒ leave
// gate). No gate verdict is ever fabricated — the leave check's own runGate
// decides. Load-bearing probe finding pinned here: the P6 floor exec OVERWRITES
// lastTest with its honest `{ok:true, detail:"tests.pass"}` marker, so the mint
// must ride the post-exec project (exactly where the keyed edge mints).
// ---------------------------------------------------------------------------

/** T6.2(c) fixture: priors 0-5 sealed, cursor on a ready phase 6, enforceDod
 *  ON. The brief is stopword-only, so p6-brief-fit passes vacuously — the ONLY
 *  degree of freedom between the two walk arms below is the minted stamp. */
function p6NoMintFixture(): Project {
  const p = emptyProject({
    name: "P6NoMint",
    brief: "A simple app with a list of items.",
    enforceDod: true,
  });
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

/** A green TreeRunOutcome whose one spec file was SKIPPED — 0 specs ran and 0
 *  assertions executed (the UI-shell / no-spec tree shape; J2 §3b CASE-A). */
function greenNoSpecOutcome(): TreeRunOutcome {
  return {
    ok: true,
    dir: "C:/pin/tree",
    compile: { ok: true, dir: "C:/pin/tree", checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [{ file: "src/generated.ts", verdict: "pass" }] },
    tests: [{ file: "tests/oracle.spec.ts", compile: "pass", run: "skip", tests: { pass: 0, fail: 0 } }],
    run: null,
  };
}

/** The discriminating control: the same green shape with 1 spec PASSING —
 *  2 assertions actually executed (J2 §3b CASE-B; deterministic hash). */
function greenExecutedOutcome(): TreeRunOutcome {
  return {
    ok: true,
    dir: "C:/pin/tree",
    compile: { ok: true, dir: "C:/pin/tree", checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [{ file: "src/generated.ts", verdict: "pass" }] },
    tests: [{ file: "tests/oracle.spec.ts", compile: "pass", run: "pass", tests: { pass: 2, fail: 0 } }],
    run: null,
  };
}

const approvingP6Reviewer: WildReviewer = async () => ({
  ok: true,
  verdict: "approve",
  feedback: "P6 pin reviewer approves the advance.",
  model: "pin",
});

/** The production order as one seam: REAL floor exec ⇒ REAL mint attempt on
 *  the post-exec project (the keyed edge's own order — `mintTreeRunTested` is
 *  invoked with the real TreeRunOutcome by driveP6Journey's converged branch).
 *  Only the outcome differs between the two arms below. */
const p6SeamWith = (outcome: TreeRunOutcome) => async (q: Project): Promise<Project> =>
  mintTreeRunTested(applyPhaseResult(q, 6), outcome);

describe("T6.2(c) — the no-mint ⇒ P6-red walk (W43 canon; fixes/317_j2_preflight §3b)", () => {
  it("a green tree-run with NO executed spec never mints: honest skipped row, p6-verified stays unmet", () => {
    const noSpec = mintTreeRunTested(p6NoMintFixture(), greenNoSpecOutcome());
    assert.equal(noSpec.lastTest ?? null, null, "no 'tested' stamp for a run that executed nothing (honest absence)");
    const skipped = (noSpec.logs ?? []).filter((l) => l.event === "p6.tree.tested.skipped");
    assert.equal(skipped.length, 1, "exactly ONE honest skipped row explains the absence");
    assert.equal(skipped[0]!.level, "warn");
    assert.equal(skipped[0]!.phase, 6);
    assert.equal(
      skipped[0]!.detail,
      'tree-run ok but no executable spec ran (0 spec file(s), 0 assertion(s)) — no "tested" stamp minted (honest: nothing executed headless)',
      "the skipped row's exact honest detail bytes",
    );
    assert.equal(
      (noSpec.logs ?? []).filter((l) => l.event === "p6.tree.tested").length,
      0,
      "no mint row may exist for a run that executed nothing",
    );
    assert.ok(
      runGate(noSpec, 6).unmet.some((u) => u.id === "p6-verified"),
      "the p6-verified criterion reads RED while no tested stamp exists",
    );

    // Control — one executed spec + assertions mints the stamp and clears the criterion.
    const minted = mintTreeRunTested(p6NoMintFixture(), greenExecutedOutcome());
    assert.equal(minted.lastTest?.label, "tested");
    assert.equal(
      // House cast (codegen.server.test.ts:567 idiom): the mint writes
      // evidenceHash; the Project.lastTest type declares only ok/detail/label.
      (minted.lastTest as { evidenceHash?: string } | null)?.evidenceHash,
      "3655235467",
      "the deterministic tree-run evidence hash (reproduces J2 §3b CASE-B)",
    );
    assert.equal((minted.logs ?? []).filter((l) => l.event === "p6.tree.tested").length, 1, "exactly one mint row");
    assert.ok(
      !runGate(minted, 6).unmet.some((u) => u.id === "p6-verified"),
      "a REAL mint clears p6-verified — the gate discriminates",
    );
  });

  it("enforceDod blocks leaving P6 on that red — and a minted stamp clears the walk (the cursor advances)", async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      // Arm 1 — no executed spec ⇒ no mint ⇒ the enforceDod leave check hard-stops.
      const res = await wildStep(p6NoMintFixture(), {
        reviewer: approvingP6Reviewer,
        p6Edge: p6SeamWith(greenNoSpecOutcome()),
      });
      assert.equal(res.outcome, "paused");
      assert.equal(res.code, "RT_E_GATE_PENDING");
      assert.equal(
        res.error,
        "P6 DoD unmet — hard gate blocks advance: p6-verified.",
        "the exact hard-DoD error naming the one red criterion",
      );
      assert.equal(res.project.currentPhase, 6, "the cursor never left P6");
      assert.notEqual(res.project.lastTest?.label, "tested", "nothing minted — the honest absence rides the park");
      assert.deepEqual(
        runGate(res.project, 6).unmet.map((u) => u.id),
        ["p6-verified"],
        "p6-verified is the ONLY unmet criterion the walk stopped on (the mint's absence is the blocker)",
      );
      const row = (res.project.logs ?? []).find((l) => l.event === "wild.paused_dod");
      assert.ok(row, "wild.paused_dod row present");
      assert.equal(row!.detail, "P6 DoD unmet — hard gate blocks advance: p6-verified");
      const blocked = (res.project.logs ?? []).find((l) => l.event === "dod.blocked");
      assert.ok(
        blocked && String(blocked.detail).includes("unmet: p6-verified"),
        "the dod.blocked row names the criterion",
      );
      assert.equal(res.project.wildRun?.park?.code, "RT_E_GATE_PENDING");
      assert.equal(res.project.wildRun?.park?.unlock, "human-gate");
      assert.equal(
        (res.project.logs ?? []).filter((l) => l.event === "p6.tree.tested").length,
        0,
        "the skipped path never mints a tested row through the walk",
      );

      // Arm 2 (control) — one executed spec ⇒ the REAL mint clears p6-verified
      // ⇒ the identical walk advances. Same fixture, same seam, same reviewer.
      const ok = await wildStep(p6NoMintFixture(), {
        reviewer: approvingP6Reviewer,
        p6Edge: p6SeamWith(greenExecutedOutcome()),
      });
      assert.equal(ok.outcome, "advanced", "a minted tested stamp clears p6-verified — the leave check proceeds");
      assert.equal(ok.project.currentPhase, 7, "the cursor advances to P7 only once the stamp exists");
      assert.equal(ok.project.lastTest?.label, "tested");
      assert.deepEqual(runGate(ok.project, 6).unmet, [], "gate green after the mint");
      assert.equal(
        (ok.project.logs ?? []).some((l) => l.event === "wild.paused_dod"),
        false,
        "no DoD park when the mint cleared the gate",
      );
      assert.ok(
        (ok.project.logs ?? []).some((l) => l.event === "wild.advance" && l.detail.includes("P6 sealed → P7")),
        "the advance row proves the pre-mint hard-stop is cured",
      );
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });
});

// ---------------------------------------------------------------------------
// GAP-1 (fixes/320_g1b_review_park.md · 319 FINDING-2): the ADVANCE-review
// classifier reject mints the same human decision gate as the gate-review
// reject — and the deterministic DoD-floor reject mints NOTHING (the keyless
// pure-floor honesty story stays byte-identical). Drives the REAL floor exec
// and the REAL P6 mint through the F2 harness (p6NoMintFixture +
// p6SeamWith), in production order.
// ---------------------------------------------------------------------------
describe("GAP-1 advance-arm mint + floor control (fixes/320)", () => {
  it("F2 harness + rejecting reviewer: minted forceHuman gate on P6; the floor reject stays unminted", async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      const rejectFb =
        "P6 evidence is a skipped spec file — the tree executed nothing, so the phase cannot be honestly judged as tested. Remediate before any human advance decision.";
      const rejecting: WildReviewer = async () => ({ ok: true, verdict: "reject", feedback: rejectFb, model: "pin" });
      const res = await wildStep(p6NoMintFixture(), {
        reviewer: rejecting,
        p6Edge: p6SeamWith(greenExecutedOutcome()),
      });
      assert.equal(res.outcome, "paused", "a persistent classifier reject parks after the bound");
      assert.equal(res.code, "RT_E_GATE_PENDING");
      assert.equal(res.error, rejectFb);

      const gate = res.project.hitl;
      assert.ok(gate, "the advance-reject arm mints the human gate too");
      assert.equal(gate.phase, 6);
      assert.equal(gate.forceHuman, true);
      assert.equal(gate.prompt, rejectFb);
      assert.equal(res.project.status, "awaiting_hitl");
      assert.equal(res.project.phases.find((r) => r.id === 6)?.status, "awaiting_hitl");
      assert.equal(res.project.wildRun?.park?.unlock, "human-gate");
      assert.equal(res.project.wildRun?.park?.resumeAction, "gate", "resume re-enters the gate — never a silent advance");

      assert.throws(() => approveHitl(res.project, { decidedBy: "autopilot" }), /forceHuman/);
      const done = approveHitl(res.project, { decidedBy: "human", note: "Accepting the P6 risk explicitly for this pin." });
      assert.equal(done.hitl, null);
      assert.equal(done.currentPhase, 7, "the human approve moves the cursor");

      // CONTROL — the SAME walk resolving to the deterministic DoD-floor
      // reject (source "dod") mints nothing: keyless pure-floor bytes hold.
      const floor = await wildStep(p6NoMintFixture(), {
        reviewer: notConfiguredReviewer,
        p6Edge: p6SeamWith(greenNoSpecOutcome()),
      });
      assert.equal(floor.outcome, "paused");
      assert.equal(floor.code, "RT_E_GATE_PENDING");
      assert.equal(floor.project.hitl ?? null, null, "the DoD-floor reject mints NOTHING");
      assert.notEqual(floor.project.status, "awaiting_hitl");
      assert.ok(String(floor.error).includes("Deterministic DoD review"));
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });
});

// ---------------------------------------------------------------------------
// BUG-5 (fixes/320_g1b_review_park.md · 319 FINDING-3b): the park surfaces
// (reason + lastAutoLog) carry up to 600 chars + an explicit ellipsis — the
// old 200/300 mid-word cuts hid the classifier's required-fixes list from
// console/CLI readers (the ledger row was always full).
// ---------------------------------------------------------------------------
describe("BUG-5 park surface budget 600 + ellipsis (fixes/320)", () => {
  const LONG = `critique head ${"x".repeat(650)} CRITIQUE_TAIL_MARKER`;

  it("a long reject detail lands on both park surfaces at 600 chars + ellipsis", async () => {
    const rejecting: WildReviewer = async () => ({ ok: true, verdict: "reject", feedback: LONG, model: "pin" });
    const res = await wildStep(wildFixture("awaiting_hitl"), { reviewer: rejecting });
    const expectedReason = `${LONG.slice(0, 600)}…`;
    const expectedLog = `${`P0 review REJECTED: ${LONG}`.slice(0, 600)}…`;
    assert.equal(res.project.wildRun?.park?.reason, expectedReason, "park.reason: 600 + ellipsis (was a 200 mid-word cut)");
    assert.equal(res.project.wildRun?.lastAutoLog, expectedLog, "lastAutoLog: 600 + ellipsis (was a 300 mid-word cut)");
    assert.ok(!expectedReason.includes("CRITIQUE_TAIL_MARKER"), "the cut is real: the tail marker sits beyond 600");
  });

  it("a short detail passes through byte-identically (no gratuitous ellipsis)", async () => {
    const res = await wildStep(wildFixture("locked"), { reviewer: notConfiguredReviewer });
    assert.equal(
      res.project.wildRun?.lastAutoLog,
      "P0 is locked — wild run paused.",
      "under-budget details are byte-identical to the pre-fix surface",
    );
  });

  it("the parkIfNull mirror also emits 600 + ellipsis on an over-budget error park", async () => {
    const longErr = `provider exploded ${"y".repeat(650)} ERROR_TAIL_MARKER`;
    const failing: WildReviewer = async () => ({ ok: false, reason: "error", error: longErr });
    const res = await wildStep(wildFixture("awaiting_hitl"), { reviewer: failing });
    assert.equal(res.outcome, "paused");
    assert.equal(res.code, "RT_E_LLM_REJECTED");
    assert.equal(
      res.project.wildRun?.park?.reason,
      `${longErr.slice(0, 600)}…`,
      "parkIfNull's detail pre-slice raised to 600 + ellipsis",
    );
    assert.equal(
      res.project.wildRun?.lastAutoLog,
      `${`P0 Auto-Review failed: ${longErr}`.slice(0, 600)}…`,
      "the error arm's lastAutoLog truncation",
    );
  });
});
