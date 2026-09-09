// diagnose.test.ts — fixes/109 §8.4: heuristic ranking + §6.1 shape.
// Runs under `node --experimental-strip-types --test src/lib/diagnose.test.ts`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDiagnosis, type DiagnosisInput } from "./diagnose.ts";
import { WILD_STEP_BUDGET_MS } from "./rt-events.ts";
import type { RtEvent } from "./rt-events.ts";

function rtRow(over: Partial<RtEvent>): RtEvent {
  return {
    schema_version: 1,
    ts: 1_000_000,
    level: "error",
    host: "test",
    sessionId: "s",
    scope: "sys",
    event: "sys.uncaught_error",
    message: "m",
    capture: "x:1",
    ...over,
  } as RtEvent;
}

function baseInput(over: Partial<DiagnosisInput> = {}): DiagnosisInput {
  return {
    source: "cli",
    now: 1_000_000,
    session: { sessionId: "s", host: "cli", node: "v22" },
    project: {
      ref: "build.json",
      name: "demo",
      status: "running",
      currentPhase: 5,
      wildRun: null,
    },
    errors: [],
    timeline: [],
    watchdog: {
      lastHeartbeatAt: null,
      heartbeatLagMs: null,
      stall: null,
      lastLongTaskMs: null,
      budgetsMs: { wildStep: WILD_STEP_BUDGET_MS, chat: 60_000 },
    },
    growth: { rows: {}, bytes: {}, counts: {} },
    persistHealth: { ok: true, lastError: null },
    crashSnapshot: null,
    ...over,
  };
}

test("clean input → mostLikelyCause none-detected (honest floor, DG-7)", () => {
  const diag = buildDiagnosis(baseInput());
  assert.equal(diag.cmd, "diagnose");
  assert.equal(diag.ok, true);
  assert.equal(diag.exit_code, 0);
  assert.equal(diag.schema_version, 1);
  assert.equal(diag.mostLikelyCause.class, "none-detected");
  assert.equal(diag.mostLikelyCause.rank, 1);
  assert.deepEqual(diag.candidates, []);
  assert.ok(Array.isArray(diag.actions));
});

test("rule 1: active run with a stale lastAutoAt ranks wild-step-timeout", () => {
  const input = baseInput({
    project: {
      ref: "b.json",
      name: "demo",
      status: "running",
      currentPhase: 5,
      wildRun: {
        active: true,
        pause: false,
        phase: 5,
        startedAt: 100,
        lastAutoAt: 1_000_000 - (WILD_STEP_BUDGET_MS + 30_000),
        lastAutoLog: "P5 executing",
        stoppedAt: null,
        overdueMs: WILD_STEP_BUDGET_MS + 30_000,
      },
    },
    errors: [rtRow({ event: "wild.step_start", scope: "wild-step", message: "step P5" })],
    watchdog: {
      ...baseInput().watchdog,
      stall: { active: true, since: 1, stepElapsedMs: 120_000, class: "step-overdue" },
    },
  });
  const diag = buildDiagnosis(input);
  assert.equal(diag.mostLikelyCause.class, "wild-step-timeout");
  assert.ok(diag.mostLikelyCause.evidence.length >= 2);
  assert.ok(diag.actions.some((a) => /Stop the wild run/.test(a)));
});

test("rule 2: paused run + wild.step_error maps RT_E_LLM_REJECTED → llm-provider evidence", () => {
  const input = baseInput({
    project: {
      ...baseInput().project,
      wildRun: {
        active: true,
        pause: true,
        phase: 3,
        startedAt: 100,
        lastAutoAt: 200,
        lastAutoLog: "paused",
        stoppedAt: null,
        overdueMs: null,
      },
    },
    errors: [
      rtRow({
        scope: "wild-step",
        event: "wild.step_error",
        code: "RT_E_LLM_REJECTED",
        message: "Auto-Review failed: 429",
      }),
    ],
  });
  const diag = buildDiagnosis(input);
  assert.equal(diag.mostLikelyCause.class, "wild-paused-error");
  assert.ok(diag.mostLikelyCause.evidence.some((e) => e.includes("errors[0]")));
  assert.ok(diag.mostLikelyCause.evidence.some((e) => e.includes("llm-provider")));
  // ERROR_CODE_DOC passthrough for the row's code.
  assert.ok(diag.codes["RT_E_LLM_REJECTED"]);
  assert.ok(diag.actions.includes(diag.codes["RT_E_LLM_REJECTED"].agentAction));
});

test("rule 3: two llm-call errors within 5 minutes rank llm-unavailable", () => {
  const input = baseInput({
    now: 1_000_000,
    errors: [
      rtRow({ scope: "llm-call", event: "llm.timeout", ts: 900_000, code: "RT_E_LLM_TIMEOUT", message: "t1" }),
      rtRow({ scope: "llm-call", event: "llm.rejected", ts: 950_000, code: "RT_E_LLM_REJECTED", message: "t2" }),
    ],
  });
  const diag = buildDiagnosis(input);
  assert.equal(diag.mostLikelyCause.class, "llm-unavailable");
  assert.deepEqual(diag.mostLikelyCause.evidence, ["errors[0]", "errors[1]"]);
});

test("rule 4: failing persist health ranks persist-failure", () => {
  const diag = buildDiagnosis(baseInput({ persistHealth: { ok: false, lastError: "quota" } }));
  assert.equal(diag.mostLikelyCause.class, "persist-failure");
  assert.ok(diag.actions.some((a) => /Export the project JSON/.test(a)));
});

test("rule 5: hydrate.recovered_corrupt ranks corrupt-recovery", () => {
  const diag = buildDiagnosis(
    baseInput({ errors: [rtRow({ scope: "hydrate", event: "hydrate.recovered_corrupt", message: "corrupt" })] }),
  );
  assert.equal(diag.mostLikelyCause.class, "corrupt-recovery");
});

test("rule 7: sys.mainthread_stall ranks mainthread-stall", () => {
  const diag = buildDiagnosis(
    baseInput({ errors: [rtRow({ scope: "sys", event: "sys.mainthread_stall", level: "critical", message: "lag" })] }),
  );
  assert.equal(diag.mostLikelyCause.class, "mainthread-stall");
});

test("rule 8: a crash snapshot ranks freeze-pre-capture", () => {
  const diag = buildDiagnosis(baseInput({ crashSnapshot: { at: 500_000, href: "https://app/#run" } }));
  assert.equal(diag.mostLikelyCause.class, "freeze-pre-capture");
  assert.equal(diag.mostLikelyCause.evidence[0], "crashSnapshot");
});

test("ranking: earlier rules beat later ones; losers become ranked candidates", () => {
  const input = baseInput({
    now: 1_000_000,
    persistHealth: { ok: false, lastError: "quota" },
    project: {
      ...baseInput().project,
      wildRun: {
        active: true,
        pause: true,
        phase: 1,
        startedAt: 100,
        lastAutoAt: 200,
        lastAutoLog: "x",
        stoppedAt: null,
        overdueMs: null,
      },
    },
    errors: [
      rtRow({ scope: "wild-step", event: "wild.step_error", code: "RT_E_INTERNAL", message: "parked" }),
      rtRow({ scope: "store-persist", event: "persist.quota_failed", message: "quota" }),
    ],
  });
  const diag = buildDiagnosis(input);
  assert.equal(diag.mostLikelyCause.class, "wild-paused-error");
  assert.ok(diag.candidates.length >= 1);
  assert.ok(diag.candidates.some((c) => c.class === "persist-failure"));
  assert.ok(diag.candidates.every((c) => c.rank >= 2));
});

test("errors array renders code/message/capture + count badges; codes map is complete", () => {
  const input = baseInput({
    errors: [
      rtRow({
        scope: "wild-step",
        event: "wild.step_error",
        code: "RT_E_INTERNAL",
        message: "boom",
        capture: "src/lib/engine.ts:2519",
        count: 3,
      }),
    ],
  });
  const diag = buildDiagnosis(input);
  assert.equal(diag.errors[0].code, "RT_E_INTERNAL");
  assert.equal(diag.errors[0].capture, "src/lib/engine.ts:2519");
  assert.equal(diag.errors[0].count, 3);
  assert.ok(diag.codes["RT_E_INTERNAL"].meaning.length > 0);
});

test("buildDiagnosis floors missing errors/timeline arrays and nullish message", () => {
  const input = baseInput({
    // @ts-expect-error intentional hostile shape
    errors: null,
    timeline: undefined,
    project: {
      ref: null,
      name: null,
      status: null,
      currentPhase: null,
      wildRun: {
        active: false,
        pause: true,
        phase: 3,
        startedAt: 1,
        lastAutoAt: 1,
        lastAutoLog: null,
        stoppedAt: null,
        overdueMs: null,
      },
    },
  });
  // Re-inject a paused wild error with missing message after baseInput merge
  (input as { errors: RtEvent[] }).errors = [
    rtRow({
      scope: "wild-step",
      event: "wild.step_error",
      message: undefined,
    }),
  ];
  const diag = buildDiagnosis(input);
  assert.equal(diag.ok, true);
  assert.equal(diag.mostLikelyCause.class, "wild-paused-error");
  assert.ok(typeof diag.mostLikelyCause.summary === "string");
  assert.deepEqual(diag.timeline, []);
});
