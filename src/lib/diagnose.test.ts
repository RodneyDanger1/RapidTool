// diagnose.test.ts — fixes/109 §8.4: heuristic ranking + §6.1 shape.
// Runs under `node --experimental-strip-types --test src/lib/diagnose.test.ts`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDiagnosis, auditFromProject, isParkRow, projectWildRun, type DiagnosisInput } from "./diagnose.ts";
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

test("honesty: error rows that miss named heuristics are unclassified-errors, never none-detected", () => {
  const diag = buildDiagnosis(
    baseInput({
      errors: [
        rtRow({
          scope: "sys",
          event: "sys.uncaught_error",
          code: "RT_E_INTERNAL",
          message: "boom",
        }),
      ],
    }),
  );
  assert.equal(diag.mostLikelyCause.class, "unclassified-errors");
  assert.equal(/No error rows in window/.test(diag.mostLikelyCause.summary), false);
  assert.ok(diag.mostLikelyCause.evidence.includes("errors[0]"));
  assert.ok(diag.actions.some((a) => /do not treat diagnose as none-detected/.test(a)));
  assert.equal(diag.ok, true);
  assert.equal(diag.exit_code, 0);
});

test("honesty: a single llm-call error is unclassified (rule 3 still requires >=2)", () => {
  const diag = buildDiagnosis(
    baseInput({
      now: 1_000_000,
      errors: [
        rtRow({
          scope: "llm-call",
          event: "llm.timeout",
          ts: 950_000,
          code: "RT_E_LLM_TIMEOUT",
          message: "one timeout",
        }),
      ],
    }),
  );
  assert.equal(diag.mostLikelyCause.class, "unclassified-errors");
  assert.notEqual(diag.mostLikelyCause.class, "llm-unavailable");
  assert.notEqual(diag.mostLikelyCause.class, "none-detected");
});

test("honesty: hydrate.repaired (engine live event) is unclassified, not none-detected", () => {
  const diag = buildDiagnosis(
    baseInput({
      errors: [rtRow({ scope: "hydrate", event: "hydrate.repaired", message: "hole-in-phases clamped" })],
    }),
  );
  assert.equal(diag.mostLikelyCause.class, "unclassified-errors");
  assert.ok(diag.mostLikelyCause.evidence.includes("errors[0]"));
});

// ---------------------------------------------------------------------------
// fixes/309 A2 — M3-10/11/12 hostile-input throw guards. Repros from
// ~/rt308_m3/hostile1.ts; each pin asserts the guarded (throw-free) outcome.
// ---------------------------------------------------------------------------

test("M3-10: a null input floors to the empty-shape diagnosis (never a throw)", () => {
  const diag = buildDiagnosis(null as unknown as DiagnosisInput);
  assert.equal(diag.ok, true);
  assert.equal(diag.exit_code, 0);
  assert.equal(diag.schema_version, 1);
  assert.deepEqual(diag.errors, []);
  assert.deepEqual(diag.timeline, []);
  assert.equal(diag.mostLikelyCause.class, "none-detected");
  assert.deepEqual(diag.candidates, []);
});

test("M3-11: junk error rows are dropped at entry — the real row still ranks, no throw", () => {
  const diag = buildDiagnosis(
    baseInput({
      errors: [
        null,
        5,
        { event: "wild.step_timeout" },
        rtRow({
          scope: "llm-call",
          event: "llm.timeout",
          ts: 950_000,
          code: "RT_E_LLM_TIMEOUT",
          message: "one timeout",
        }),
      ] as unknown as RtEvent[],
    }),
  );
  assert.equal(diag.errors.length, 1, "junk rows filtered from the output array");
  assert.equal(diag.errors[0].event, "llm.timeout");
  assert.equal(diag.mostLikelyCause.class, "unclassified-errors", "the one real row still ranks — never none-detected");
  assert.deepEqual(diag.mostLikelyCause.evidence, ["errors[0]"]);
});

test("M3-12: a junk crashSnapshot.at is refused honestly — no RangeError, no fabricated date", () => {
  const diag = buildDiagnosis(
    baseInput({ crashSnapshot: { at: "y", href: 3 } as unknown as { at: number; href: string } }),
  );
  assert.equal(diag.mostLikelyCause.class, "freeze-pre-capture", "the snapshot signal is kept");
  assert.ok(/unreadable timestamp/.test(diag.mostLikelyCause.summary));
  assert.equal(/1970|NaN|Invalid/.test(diag.mostLikelyCause.summary), false, "no fabricated date in the summary");
  // A non-object snapshot is not a snapshot at all — honest floor, no match.
  const diag2 = buildDiagnosis(baseInput({ crashSnapshot: 42 as unknown as null }));
  assert.equal(diag2.mostLikelyCause.class, "none-detected");
});

// ---------------------------------------------------------------------------
// G2 (fixes/320): the diagnose wildRun projection — DISK TRUTH, no read-time
// fabrication (T1 F-D · T2 BUG-2). Live repro: two consecutive keyless CLI
// `diagnose` runs against the parked game run (scratch copy
// C:/Users/mnril/g2_scratch/g2_game_parked.json of
// C:/Users/mnril/w44_trial/game/build.json) reported active:false,
// pause:false, stoppedAt ≈ each call's OWN read time (it MOVED: …806282 →
// …810865) and a GROWING overdueMs (1990841 → 1995417), while the disk held
// active:true, pause:true, stoppedAt:null. Cause: the diagnose load omitted
// `preserveWildRun:true`, so engine.hydrateWildRun force-stopped the parked
// run in memory (stamping `stoppedAt: Date.now()`), and the projection
// derived overdueMs from any present lastAutoAt. The fixed contract lives in
// `projectWildRun` (diagnose.ts) — the pin below carries the parked run's
// exact disk scalars (byte-checked against the scratch copy by the fixes/320
// §5 probe).
// ---------------------------------------------------------------------------

/** The parked game run's disk scalars — byte-faithful to
 *  g2_game_parked.json:586-624 (the P0 review-reject park). The disk block
 *  also carries `park`/`lastStep` records; the projection reads only the
 *  scalars below. */
const PARKED_GAME_WILD_RUN = {
  active: true,
  phase: 0,
  startedAt: 1790783801207,
  lastAutoAt: 1790783815484,
  lastAutoLog:
    'P0 review REJECTED: The phase artifacts do not deliver the substance the P0 brief requires. The scorecard is internally contradictory: it claims a "custom-software" domain with a single generic job ("deliver-core-workflow") and one entity ("player"), yet the scores reference "typed contracts + seque',
  stoppedAt: null,
  pause: true,
};

test("G2: a parked run projects disk truth — active/pause/stoppedAt verbatim, no overdue clock, stable across reads", () => {
  const first = projectWildRun(PARKED_GAME_WILD_RUN, 1_790_786_000_000);
  const second = projectWildRun(PARKED_GAME_WILD_RUN, 1_790_786_004_000);
  assert.deepEqual(first, {
    active: true,
    pause: true,
    phase: 0,
    startedAt: 1790783801207,
    lastAutoAt: 1790783815484,
    lastAutoLog: PARKED_GAME_WILD_RUN.lastAutoLog,
    stoppedAt: null,
    overdueMs: null,
  });
  // Stable across two consecutive reads at different `now`s: nothing in the
  // view moves with time — the pre-fix divergence stamped stoppedAt on EVERY
  // call and grew overdueMs between them.
  assert.deepEqual(second, first);
  assert.equal(
    JSON.stringify(first).includes("1790786000000"),
    false,
    "no read-time `now` leaks into the view (first read)",
  );
  assert.equal(
    JSON.stringify(second).includes("1790786004000"),
    false,
    "no read-time `now` leaks into the view (second read)",
  );
});

test("G2: overdueMs is derived only while the run progresses (active && !pause) — parked/stopped runs get null", () => {
  const now = 2_000_000;
  const progressing = projectWildRun(
    {
      active: true,
      pause: false,
      phase: 3,
      startedAt: 1_900_000,
      lastAutoAt: 1_900_000,
      lastAutoLog: "P3 step",
      stoppedAt: null,
    },
    now,
  );
  assert.equal(progressing!.overdueMs, 100_000, "an active, unpaused run gets the real elapsed ms (derived, not fabricated)");
  assert.equal(progressing!.stoppedAt, null, "deriving an overdue clock never stamps a stop");
  const skewed = projectWildRun(
    { active: true, pause: false, phase: 3, startedAt: 1, lastAutoAt: now + 500, lastAutoLog: null, stoppedAt: null },
    now,
  );
  assert.equal(skewed!.overdueMs, 0, "clock skew clamps at 0, never negative");
  const stopped = projectWildRun(
    {
      active: false,
      pause: false,
      phase: 9,
      startedAt: 1,
      lastAutoAt: 1_500_000,
      lastAutoLog: "done",
      stoppedAt: 1_999_000,
    },
    now,
  );
  assert.equal(stopped!.stoppedAt, 1_999_000, "a genuine stop timestamp passes through verbatim");
  assert.equal(stopped!.overdueMs, null, "a stopped run has no overdue clock");
});

test("G2: junk wildRun values floor to null (never a throw) and non-finite scalars are refused", () => {
  for (const junk of [null, undefined, 42, "x", [], true]) {
    assert.equal(projectWildRun(junk, 1), null);
  }
  const dirty = projectWildRun(
    {
      active: true,
      pause: false,
      phase: Number.NaN,
      startedAt: Number.POSITIVE_INFINITY,
      lastAutoAt: "9",
      lastAutoLog: 7,
      stoppedAt: Number.NaN,
    },
    10,
  );
  assert.deepEqual(dirty, {
    active: true,
    pause: false,
    phase: null,
    startedAt: null,
    lastAutoAt: null,
    lastAutoLog: null,
    stoppedAt: null,
    overdueMs: null,
  });
});

test("G2: buildDiagnosis carries the projected parked run unchanged — identical across two reads, never a timeout/stop", () => {
  const read = (now: number) =>
    buildDiagnosis(
      baseInput({
        now,
        project: { ...baseInput().project, wildRun: projectWildRun(PARKED_GAME_WILD_RUN, now) },
      }),
    );
  const a = read(1_790_786_000_000);
  const b = read(1_790_786_004_000);
  assert.deepEqual(
    a.project.wildRun,
    b.project.wildRun,
    "two consecutive reads agree — no read-time fields ride the envelope",
  );
  assert.deepEqual(a.project.wildRun, projectWildRun(PARKED_GAME_WILD_RUN, 1_790_786_000_000));
  assert.equal(a.project.wildRun!.active, true);
  assert.equal(a.project.wildRun!.pause, true);
  assert.equal(a.project.wildRun!.stoppedAt, null);
  assert.equal(a.project.wildRun!.overdueMs, null);
  assert.equal(a.mostLikelyCause.class, "none-detected", "a parked run is not an incident");
});

// ---------------------------------------------------------------------------
// fixes/323 FIX-2c (F-3 · window #4 item 3): exit-2 parks are not errors.
// Live pre-fix bytes (keyless `gate` park, captured 2026-09-30): {"level":
// "error",…,"event":"cli.invocation","message":"gate exit 2","code":null,
// "payload":{"cmd":"gate","exitCode":2}} — that row ranked unclassified-errors
// ("not a clean bill of health"). The pins below carry BOTH shapes: the legacy
// error-level row already on disk, and the post-fix warn + `parked:true` row.
// ---------------------------------------------------------------------------

test("FIX-2c: a parks-only window ranks honest-park — never unclassified-errors, never the 'not a clean bill of health' language (legacy error-level row)", () => {
  const park = rtRow({
    level: "error", // the pre-fix bytes already on disk
    scope: "cli-command",
    event: "cli.invocation",
    message: "gate exit 2",
    payload: { cmd: "gate", exitCode: 2 },
  });
  const diag = buildDiagnosis(baseInput({ errors: [park] }));
  assert.equal(diag.mostLikelyCause.class, "honest-park");
  assert.ok(/park/i.test(diag.mostLikelyCause.summary), "the summary NAMES the park");
  assert.equal(
    /not a clean bill of health/.test(diag.mostLikelyCause.summary),
    false,
    "a park is not ill-health language",
  );
  assert.equal(/No error rows in window/.test(diag.mostLikelyCause.summary), false);
  assert.deepEqual(diag.mostLikelyCause.evidence, ["errors[0]"]);
  assert.ok(diag.actions.some((a) => /parked/i.test(a)), "the action names the parked state");
});

test("FIX-2c: the post-fix park shape (level warn + payload.parked:true) classifies identically", () => {
  const diag = buildDiagnosis(
    baseInput({
      errors: [
        rtRow({
          level: "warn",
          scope: "cli-command",
          event: "cli.invocation",
          message: "unattended exit 2",
          payload: { cmd: "unattended", exitCode: 2, parked: true },
        }),
      ],
    }),
  );
  assert.equal(diag.mostLikelyCause.class, "honest-park");
  assert.deepEqual(diag.mostLikelyCause.evidence, ["errors[0]"]);
});

test("FIX-2c: park rows never inflate the unclassified count — a mixed window counts only the non-park rows", () => {
  const diag = buildDiagnosis(
    baseInput({
      errors: [
        rtRow({
          level: "error",
          scope: "cli-command",
          event: "cli.invocation",
          message: "gate exit 2",
          payload: { cmd: "gate", exitCode: 2 },
        }),
        rtRow({ scope: "sys", event: "sys.uncaught_error", code: "RT_E_INTERNAL", message: "boom" }),
      ],
    }),
  );
  assert.equal(diag.mostLikelyCause.class, "unclassified-errors");
  assert.ok(
    /1 error\/critical row/.test(diag.mostLikelyCause.summary),
    `only the non-park row counts: ${diag.mostLikelyCause.summary}`,
  );
  assert.deepEqual(diag.mostLikelyCause.evidence, ["errors[1]"], "the park row is never cited as an error");
});

test("FIX-2c: isParkRow — the generic parked tag wins anywhere; exit 1 / a string '2' / a missing payload never classify", () => {
  assert.equal(
    isParkRow(rtRow({ scope: "cli-command", event: "cli.invocation", payload: { cmd: "gate", exitCode: 2 } })),
    true,
    "the legacy error-level exit-2 row is a park",
  );
  assert.equal(
    isParkRow(rtRow({ scope: "wild-step", event: "wild.step_paused", payload: { parked: true } })),
    true,
    "the explicit tag is the marker, wherever it rides",
  );
  assert.equal(
    isParkRow(rtRow({ scope: "cli-command", event: "cli.invocation", payload: { cmd: "gate", exitCode: 1 } })),
    false,
    "exit 1 is a failure, never a park",
  );
  assert.equal(
    isParkRow(rtRow({ scope: "cli-command", event: "cli.invocation", payload: { cmd: "gate", exitCode: "2" } })),
    false,
    "a string exit code is not the park marker",
  );
  assert.equal(
    isParkRow(rtRow({ scope: "cli-command", event: "cli.invocation" })),
    false,
    "no payload → not a park",
  );
});

// ---------------------------------------------------------------------------
// fixes/347 (auditor lane A): the per-phase audit. The fixture below is copied
// VERBATIM from the real campaign-3 artifact set for bakery-florist-orders —
//   ../testruns/campaign3/bakery-florist-orders/build.json  (phases[6], tokenUsage, artifacts)
//   ../testruns/campaign3/bakery-florist-orders/.rapidtool/logs/rapidtool.ndjson (the coded rows)
// and carries the P6 hard-DoD red that stopped the run. The audit must show
// what went right/wrong per phase from exactly these bytes, leaving the facts
// the pipeline never persisted as explicit `unknown` — never fabricated.
// ---------------------------------------------------------------------------

/** phases[6], byte-copied from build.json (the P6 gate failed: false). */
const REAL_P6_PHASE = {
  id: 6,
  status: "complete",
  rejectionHistory: [],
  gate: {
    passed: false,
    unmet: [
      "Last template self-test run passed",
      'Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash)',
      "Brief-conformance: required brief nouns appear as identifiers in the generated source (single-module, or the union of the tree files in tree mode) — keyed tree synthesis ran (9 file(s)) but its union dropped the brief's required nouns core missing (19/40): back, bloom, console, crumb, dashboard, keeper, management, manager, marketing, office, oracle, persist, …; advisory missing (82/169): business, application, sells, baked, goods, flowers, room, manage, restocking, internal, not, roles, …",
    ],
    evidenceHash: "689887517",
    checkedAt: 1791213144899,
  },
  startedAt: 1791212892344,
  completedAt: 1791213124028,
};

/** artifacts[] for phase 6, id/phase copied verbatim from build.json. */
const REAL_P6_ARTIFACTS = [
  { id: "packet-6", phase: 6 },
  { id: "6-code-tree-19373702", phase: 6 },
  { id: "6-docs-p6-architecture-trace-reqtrace", phase: 6 },
  { id: "gate-p6-68988751", phase: 6 },
  { id: "harddod-p6-68988751", phase: 6 },
];

/** tokenUsage, copied verbatim from build.json (project-level; not per phase). */
const REAL_TOKEN_USAGE = { promptTokens: 57727, completionTokens: 33263, calls: 14, cachedPromptTokens: 0 };

/** The two distinct coded rows, copied verbatim from rapidtool.ndjson. NOTE:
 *  the real rows carry `phase: null` AND omit `capture` — the CLI emitter
 *  attributes no phase and no capture seam, so per-stage refusal attribution
 *  is impossible from these bytes (fixes/347 names both emitter gaps; neither
 *  is fabricated onto a phase here). The cast records the byte-faithful shape
 *  (the pure-core RtEvent type requires `capture`; the emitted rows do not). */
const REAL_CODED_ROWS = [
  {
    schema_version: 1,
    ts: 1791213145522,
    level: "error",
    host: "cli",
    sessionId: "cli-muvdwjan",
    scope: "cli-command",
    event: "cli.invocation",
    message:
      "P6 DoD unmet — hard gate blocks advance: p6-test, p6-verified, p6-brief-fit. — resolve the unmet DoD criteria before advancing.",
    phase: null,
    projectId: null,
    code: "RT_E_GATE_PENDING",
    stack: null,
    payload: { cmd: "unattended", exitCode: 1 },
    runRef: null,
    elapsedMs: null,
  },
  {
    schema_version: 1,
    ts: 1791213162341,
    level: "error",
    host: "cli",
    sessionId: "cli-muve269x",
    scope: "cli-command",
    event: "cli.invocation",
    message: "the emitted project's own `npm run test` fail (exit 1)",
    phase: null,
    projectId: null,
    code: "RT_E_TREE_RUN_FAILED",
    stack: null,
    payload: { cmd: "emit", exitCode: 1 },
    runRef: null,
    elapsedMs: null,
  },
] as unknown as RtEvent[];

test("347: a real P6 phase renders status + failed gate + unmet criteria + artifact names from the verbatim artifact", () => {
  const diag = buildDiagnosis(
    baseInput({
      audit: { phases: [REAL_P6_PHASE], artifacts: REAL_P6_ARTIFACTS, tokenUsage: REAL_TOKEN_USAGE },
    }),
  );
  const p6 = diag.project.stages!.find((s) => s.phase === 6);
  assert.ok(p6, "P6 stage present");
  assert.equal(p6!.status, "complete");
  assert.equal(p6!.gate!.passed, false, "the red gate is shown as red, not hidden");
  assert.equal(p6!.gate!.unmet.length, 3);
  assert.equal(p6!.gate!.unmet[0], "Last template self-test run passed");
  assert.ok(p6!.gate!.unmet[2].startsWith("Brief-conformance:"), "third criterion verbatim");
  assert.equal(p6!.gate!.evidenceHash, "689887517");
  assert.equal(p6!.gate!.checkedAt, 1791213144899);
  assert.deepEqual(p6!.artifacts, REAL_P6_ARTIFACTS.map((a) => a.id));
  assert.equal(p6!.observed, true);
  // Facts the pipeline never persisted for a phase must read UNKNOWN, not fake.
  assert.ok(p6!.unknown.includes("keyed"), "per-phase keyed tokens/calls never emitted → unknown");
  assert.ok(p6!.unknown.includes("treeRun"), "per-phase tree-run verdict never persisted → unknown");
  assert.ok(p6!.unknown.includes("substance"), "per-phase substance verdict never persisted → unknown");
  assert.equal(p6!.treeRun, null);
  assert.equal(p6!.substance, null);
});

test("347: project-level tokenUsage is surfaced verbatim; per-phase attribution stays unknown", () => {
  const diag = buildDiagnosis(baseInput({ audit: { phases: [REAL_P6_PHASE], tokenUsage: REAL_TOKEN_USAGE } }));
  assert.deepEqual(diag.project.keyed, { calls: 14, promptTokens: 57727, completionTokens: 33263 });
});

test("347: the real phase-less coded rows are NEVER attributed to a fake phase — the gap names them", () => {
  const diag = buildDiagnosis(
    baseInput({
      errors: REAL_CODED_ROWS,
      audit: { phases: [REAL_P6_PHASE], artifacts: REAL_P6_ARTIFACTS, tokenUsage: REAL_TOKEN_USAGE },
    }),
  );
  const p6 = diag.project.stages!.find((s) => s.phase === 6)!;
  assert.deepEqual(p6.refusals, [], "no phase-bearing refusal row exists in the real bytes — nothing invented");
  assert.ok(
    /2 coded refusal row\(s\) carry no phase/.test(diag.project.stagesGap ?? ""),
    `gap must name the unattributed refusals: ${diag.project.stagesGap}`,
  );
});

test("347: a phase-bearing coded row IS attributed to its phase (unit input, clearly not artifact data)", () => {
  const diag = buildDiagnosis(
    baseInput({
      errors: [rtRow({ phase: 6, scope: "cli-command", event: "cli.invocation", code: "RT_E_GATE_PENDING", message: "parked" })],
      audit: { phases: [REAL_P6_PHASE] },
    }),
  );
  const p6 = diag.project.stages!.find((s) => s.phase === 6)!;
  assert.equal(p6.refusals.length, 1);
  assert.equal(p6.refusals[0].code, "RT_E_GATE_PENDING");
});

test("347 fail-soft: a malformed/truncated audit never throws and surfaces the gap", () => {
  const truncated = buildDiagnosis(baseInput({ audit: { phases: "[{\"id\":6,\"gate\":{\"pass" } as never }));
  assert.equal(truncated.ok, true);
  assert.deepEqual(truncated.project.stages, []);
  assert.ok(/audit\.phases is not an array/.test(truncated.project.stagesGap ?? ""));
  // Junk phase records are skipped and counted, not thrown.
  const junk = buildDiagnosis(
    baseInput({ audit: { phases: [null, 7, { id: "x" }, REAL_P6_PHASE] } as never }),
  );
  assert.equal(junk.ok, true);
  assert.equal(junk.project.stages!.length, 1, "only the one well-formed record projects");
  assert.ok(/3 malformed phase record\(s\) skipped/.test(junk.project.stagesGap ?? ""));
});

test("347 fail-soft: no audit supplied reads as explicit unknown, never a silent clean shape", () => {
  const diag = buildDiagnosis(baseInput());
  assert.deepEqual(diag.project.stages, []);
  assert.ok(/no per-phase audit supplied/.test(diag.project.stagesGap ?? ""));
});

// ---------------------------------------------------------------------------
// fixes/348 (W1) — auditFromProject: the thin pure builder the CLI diagnose
// verb passes so the envelope's per-phase `stages` are REAL, not the empty
// `[]` + "no per-phase audit supplied" gap every run used to carry.
// ---------------------------------------------------------------------------

test("348 (W1): auditFromProject projects phases/artifacts/tokenUsage from a loaded project — stages become real", () => {
  // A trimmed REAL project record (the shape h.loadProject returns; the fields
  // auditFromProject reads are byte-faithful to the campaign-3 P6 fixture).
  const project = {
    phases: [REAL_P6_PHASE],
    artifacts: REAL_P6_ARTIFACTS,
    tokenUsage: REAL_TOKEN_USAGE,
    // Fields the builder must IGNORE (unchanged in the audit).
    name: "bakery-florist-orders",
    currentPhase: 6,
  };
  const audit = auditFromProject(project);
  assert.equal(audit.phases, project.phases, "phases pass through verbatim (the projector validates)");
  assert.equal(audit.artifacts, project.artifacts);
  assert.equal(audit.tokenUsage, project.tokenUsage);
  assert.deepEqual(Object.keys(audit).sort(), ["artifacts", "phases", "tokenUsage"]);

  const diag = buildDiagnosis(baseInput({ audit }));
  const p6 = diag.project.stages!.find((s) => s.phase === 6)!;
  assert.ok(p6, "the project's P6 record projects into a real stage");
  assert.equal(p6.status, "complete");
  assert.equal(p6.gate!.passed, false);
  assert.equal(p6.observed, true);
  assert.deepEqual(p6.artifacts, REAL_P6_ARTIFACTS.map((a) => a.id));
  assert.deepEqual(diag.project.keyed, { calls: 14, promptTokens: 57727, completionTokens: 33263 });
  assert.equal(
    /no per-phase audit supplied/.test(diag.project.stagesGap ?? ""),
    false,
    "a supplied audit never reads as the no-audit gap",
  );
});

test("348 (W1): auditFromProject is fail-soft — junk input yields an empty audit, never a throw", () => {
  for (const junk of [null, undefined, 42, "x", true, []]) {
    assert.deepEqual(auditFromProject(junk), {}, `junk ${String(junk)} → empty audit`);
  }
  // A project missing phases/artifacts/tokenUsage carries none of the keys.
  assert.deepEqual(auditFromProject({ name: "x" }), {});
  // Non-array phases/artifacts are not smuggled in.
  assert.deepEqual(auditFromProject({ phases: "nope", artifacts: 3, tokenUsage: "x" }), {});
  const diag = buildDiagnosis(baseInput({ audit: auditFromProject({}) }));
  assert.deepEqual(diag.project.stages, []);
  assert.ok(/audit\.phases is not an array/.test(diag.project.stagesGap ?? ""), "an empty audit names the missing phases");
});


