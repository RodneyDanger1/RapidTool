// ---------------------------------------------------------------------------
// iterate.test.ts — F1 (314 wave) pins for the bounded iterate driver core
// (src/lib/iterate.ts). ALL KEYLESS + deterministic: every seam is an injected
// fake, no fs/network/env, no clock. What is proven here (SE2 §4a T2.3):
//
//   (a) CONFIG GATE — OFF unless RAPIDTOOL_ITERATE_THRESHOLD is set; junk
//       spellings never arm; maxCycles clamps to 1..2 with a note.
//   (b) DECISION LOGIC — fire/no-fire with the pinned order: disabled →
//       no-score → satisfied → budget (RT_E_BUDGET_EXHAUSTED) → bounded →
//       no-seam → fire (iterate.below-threshold).
//   (c) BOUNDED DRIVER — exactly N cycles (never more), early satisfaction,
//       budget stop, honest refusal/error stops, OFF default fires nothing.
//   (d) NEVER THROWS — score/regen/budget/emit failures degrade to coded
//       outcomes; the transcript is still emitted.
//   (e) ADAPTERS — seam-envelope mapping (repair/re-synth) + the JsonLog row
//       bridge; the event catalogue is closed (isIterateEvent).
//
// Run: node --experimental-strip-types --test src/lib/iterate.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ITERATE_DECISION_CODES,
  ITERATE_EVENTS,
  ITERATE_MAX_CYCLES_CAP,
  ITERATE_MAX_CYCLES_ENV,
  ITERATE_THRESHOLD_ENV,
  decideIterate,
  isIterateEvent,
  iterateEventToLogRow,
  iterateToSatisfaction,
  mapRepairOutcome,
  readIterateConfig,
  type IterateConfig,
  type IterateCycleContext,
  type IterateDeps,
  type IterateEvent,
  type IterateRegenResult,
} from "./iterate.ts";

/** An armed config with no notes (the env reader's clean shape). */
function armed(threshold = 0.75, maxCycles = 1): IterateConfig {
  return { enabled: true, threshold, maxCycles, notes: [] };
}

/** The OFF config the reader returns when the threshold is unset. */
function off(): IterateConfig {
  return { enabled: false, threshold: null, maxCycles: 1, notes: [`${ITERATE_THRESHOLD_ENV} unset — iterate driver OFF`] };
}

/** Score/regen fake driver: successive values, last one repeats forever. */
function fakeDeps(opts: {
  config: IterateConfig;
  scores: (number | null)[];
  regens?: IterateRegenResult[];
  budget?: () => boolean;
}): { deps: IterateDeps; regenCalls: IterateCycleContext[]; events: IterateEvent[]; scoreReads: () => number } {
  let scoreIdx = 0;
  let regenIdx = 0;
  const regenCalls: IterateCycleContext[] = [];
  const events: IterateEvent[] = [];
  const regens = opts.regens ?? [{ ok: true }];
  const deps: IterateDeps = {
    config: opts.config,
    score: async () => {
      const value = opts.scores[Math.min(scoreIdx, opts.scores.length - 1)];
      scoreIdx += 1;
      return value;
    },
    regenerate: async (ctx) => {
      regenCalls.push({ ...ctx });
      const result = regens[Math.min(regenIdx, regens.length - 1)];
      regenIdx += 1;
      return result;
    },
    budgetExhausted: opts.budget ?? (() => false),
    emit: (ev) => events.push(ev),
  };
  return { deps, regenCalls, events, scoreReads: () => scoreIdx };
}

// ---------------------------------------------------------------------------
// (a) config gate
// ---------------------------------------------------------------------------

describe("readIterateConfig — OFF unless armed (junk never arms spending)", () => {
  it("unset threshold → disabled, null threshold, default 1 cycle, the parked-decision note", () => {
    const cfg = readIterateConfig({});
    assert.equal(cfg.enabled, false);
    assert.equal(cfg.threshold, null);
    assert.equal(cfg.maxCycles, 1);
    assert.equal(cfg.notes.length, 1);
    assert.match(cfg.notes[0], /unset — iterate driver OFF/);
    assert.ok(cfg.notes[0].includes(ITERATE_THRESHOLD_ENV));
  });

  it("a valid threshold arms it; whitespace trims; `1` is a legal strict bound", () => {
    const cfg = readIterateConfig({ [ITERATE_THRESHOLD_ENV]: " 0.75 " });
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.threshold, 0.75);
    assert.deepEqual(cfg.notes, []);
    assert.equal(readIterateConfig({ [ITERATE_THRESHOLD_ENV]: "1" }).threshold, 1);
    assert.equal(readIterateConfig({ [ITERATE_THRESHOLD_ENV]: "1.0" }).threshold, 1);
  });

  it("junk / out-of-range spellings stay OFF and are named (never silently coerced)", () => {
    for (const raw of ["abc", "0", "0.0", "1.5", "-0.5", ".5", "50%"]) {
      const cfg = readIterateConfig({ [ITERATE_THRESHOLD_ENV]: raw });
      assert.equal(cfg.enabled, false, `${raw} must not arm`);
      assert.equal(cfg.threshold, null);
      assert.ok(cfg.notes.some((n) => n.includes(ITERATE_THRESHOLD_ENV)), `${raw} must be named in notes`);
    }
  });

  it("maxCycles: valid passes, over-cap clamps to 2 with a note, junk/zero fall back to default", () => {
    assert.equal(readIterateConfig({ [ITERATE_THRESHOLD_ENV]: "0.5", [ITERATE_MAX_CYCLES_ENV]: "2" }).maxCycles, 2);
    const clamped = readIterateConfig({ [ITERATE_THRESHOLD_ENV]: "0.5", [ITERATE_MAX_CYCLES_ENV]: "5" });
    assert.equal(clamped.maxCycles, ITERATE_MAX_CYCLES_CAP);
    assert.ok(clamped.notes.some((n) => n.includes("clamped to 2")));
    const zero = readIterateConfig({ [ITERATE_THRESHOLD_ENV]: "0.5", [ITERATE_MAX_CYCLES_ENV]: "0" });
    assert.equal(zero.maxCycles, 1);
    assert.ok(zero.notes.some((n) => n.includes("clamped to 1")));
    const junk = readIterateConfig({ [ITERATE_THRESHOLD_ENV]: "0.5", [ITERATE_MAX_CYCLES_ENV]: "2x" });
    assert.equal(junk.maxCycles, 1);
    assert.ok(junk.notes.some((n) => n.includes("not an integer")));
  });

  it("enabled ⇔ threshold set — the invariant holds across the whole matrix", () => {
    const cases: Record<string, string>[] = [{}, { [ITERATE_THRESHOLD_ENV]: "0.6" }, { [ITERATE_THRESHOLD_ENV]: "nope" }];
    for (const env of cases) {
      const cfg = readIterateConfig(env);
      assert.equal(cfg.enabled, cfg.threshold !== null);
    }
  });
});

// ---------------------------------------------------------------------------
// (b) the decision matrix — pure, total, pinned order
// ---------------------------------------------------------------------------

describe("decideIterate — fire/no-fire, bounded count, budget stop (pinned order)", () => {
  const base = { score: 0.5, cycle: 0, budgetExhausted: false, seamAttached: true };

  it("disabled wins (the parked owner decision is the first answer)", () => {
    const d = decideIterate({ ...base, config: off(), score: 0.9 });
    assert.equal(d.fire, false);
    assert.equal(d.code, ITERATE_DECISION_CODES.disabled);
  });

  it("no score → cannot decide (never guessed)", () => {
    const d = decideIterate({ ...base, config: armed(), score: null, seamAttached: false });
    assert.equal(d.fire, false);
    assert.equal(d.code, ITERATE_DECISION_CODES.noScore);
  });

  it("satisfied (>= threshold, boundary inclusive) — and satisfaction outranks budget", () => {
    const equal = decideIterate({ ...base, config: armed(0.75), score: 0.75 });
    assert.equal(equal.fire, false);
    assert.equal(equal.code, ITERATE_DECISION_CODES.satisfied);
    const overBudget = decideIterate({ ...base, config: armed(0.75), score: 0.9, budgetExhausted: true });
    assert.equal(overBudget.code, ITERATE_DECISION_CODES.satisfied, "never spend against a satisfied score");
  });

  it("budget stop (RT_E_BUDGET_EXHAUSTED) — outranks both the cycle count and the seam", () => {
    const d = decideIterate({ ...base, config: armed(0.75, 2), score: 0.5, cycle: 2, budgetExhausted: true });
    assert.equal(d.fire, false);
    assert.equal(d.code, ITERATE_DECISION_CODES.budgetExhausted);
    assert.equal(d.code, "RT_E_BUDGET_EXHAUSTED");
  });

  it("bounded count — cycle >= maxCycles is an honest stop", () => {
    const d = decideIterate({ ...base, config: armed(0.75, 2), cycle: 2 });
    assert.equal(d.fire, false);
    assert.equal(d.code, ITERATE_DECISION_CODES.bounded);
    assert.match(d.reason, /no fake iteration/);
  });

  it("no seam — the live arm is owner-gated", () => {
    const d = decideIterate({ ...base, config: armed(), seamAttached: false });
    assert.equal(d.fire, false);
    assert.equal(d.code, ITERATE_DECISION_CODES.noSeam);
  });

  it("below + seam + headroom + cycles left → FIRE (iterate.below-threshold)", () => {
    const d = decideIterate({ ...base, config: armed(0.75, 2), cycle: 1 });
    assert.equal(d.fire, true);
    assert.equal(d.code, ITERATE_DECISION_CODES.belowThreshold);
    assert.match(d.reason, /cycle 2\/2/);
  });

  it("every decision carries a non-empty code and reason", () => {
    const probes = [
      decideIterate({ ...base, config: off() }),
      decideIterate({ ...base, config: armed(), score: null }),
      decideIterate({ ...base, config: armed(), score: 0.9 }),
      decideIterate({ ...base, config: armed(), budgetExhausted: true }),
      decideIterate({ ...base, config: armed(), cycle: 1 }),
      decideIterate({ ...base, config: armed(), seamAttached: false }),
      decideIterate({ ...base, config: armed() }),
    ];
    for (const d of probes) {
      assert.equal(typeof d.code, "string");
      assert.ok(d.code.length > 0);
      assert.ok(d.reason.trim().length > 0);
    }
  });
});

// ---------------------------------------------------------------------------
// (c)+(d) the bounded driver — injected fakes, never throws
// ---------------------------------------------------------------------------

describe("iterateToSatisfaction — bounded, coded, honest (keyless)", () => {
  it("OFF default: one coded skip, zero regeneration, outcome not-armed", async () => {
    const { deps, regenCalls, events } = fakeDeps({ config: off(), scores: [0.1] });
    const res = await iterateToSatisfaction(deps);
    assert.equal(res.outcome, "not-armed");
    assert.equal(res.code, ITERATE_DECISION_CODES.disabled);
    assert.equal(res.fired, false);
    assert.equal(regenCalls.length, 0);
    assert.equal(events.length, 1);
    assert.equal(events[0].event, "run.iterate.skipped");
    assert.equal(events[0].threshold, null);
  });

  it("below → regen lifts the score over threshold on cycle 1 → satisfied (exactly one fire)", async () => {
    const { deps, regenCalls, events } = fakeDeps({ config: armed(0.75), scores: [0.4, 0.9] });
    const res = await iterateToSatisfaction(deps);
    assert.equal(res.outcome, "satisfied");
    assert.equal(res.code, ITERATE_DECISION_CODES.satisfied);
    assert.equal(res.cycles, 1);
    assert.equal(res.fired, true);
    assert.equal(res.scoreBefore, 0.4);
    assert.equal(res.scoreAfter, 0.9);
    assert.equal(regenCalls.length, 1);
    assert.deepEqual(
      events.map((e) => e.event),
      ["run.iterate.armed", "run.iterate.fire", "run.iterate.cycle", "run.iterate.satisfied"],
    );
    assert.equal(events[1].code, ITERATE_DECISION_CODES.belowThreshold);
    assert.equal(events[2].code, ITERATE_DECISION_CODES.satisfied, "the cycle emit carries the post-cycle verdict code");
  });

  it("stays below: EXACTLY maxCycles fires, then a coded bounded stop (no fake iteration)", async () => {
    const { deps, regenCalls, events } = fakeDeps({ config: armed(0.9, 2), scores: [0.3, 0.35] });
    const res = await iterateToSatisfaction(deps);
    assert.equal(res.outcome, "stopped");
    assert.equal(res.code, ITERATE_DECISION_CODES.bounded);
    assert.equal(res.cycles, 2);
    assert.equal(res.fired, true);
    assert.equal(regenCalls.length, 2, "the cap is a hard bound — never a third call");
    assert.deepEqual(regenCalls.map((c) => c.cycle), [1, 2]);
    assert.deepEqual(
      events.map((e) => e.event),
      ["run.iterate.armed", "run.iterate.fire", "run.iterate.cycle", "run.iterate.fire", "run.iterate.cycle", "run.iterate.stopped"],
    );
    assert.equal(events[events.length - 1].code, ITERATE_DECISION_CODES.bounded);
  });

  it("budget flips mid-run: the second decision is the budget stop, no further regen", async () => {
    let calls = 0;
    let scoreIdx = 0;
    const regenCalls: number[] = [];
    const events: IterateEvent[] = [];
    const res = await iterateToSatisfaction({
      config: armed(0.9, 2),
      score: async () => (scoreIdx++ === 0 ? 0.3 : 0.4),
      regenerate: async () => {
        regenCalls.push(1);
        return { ok: true, detail: "patch applied" };
      },
      budgetExhausted: () => calls++ > 0, // headroom for the first decision, exhausted after
      emit: (ev) => events.push(ev),
    });
    assert.equal(res.outcome, "stopped");
    assert.equal(res.code, ITERATE_DECISION_CODES.budgetExhausted);
    assert.equal(regenCalls.length, 1);
    assert.equal(res.cycles, 1);
    assert.deepEqual(
      events.map((e) => e.event),
      ["run.iterate.armed", "run.iterate.fire", "run.iterate.cycle", "run.iterate.stopped"],
    );
  });

  it("already satisfied at entry: no fire, one satisfied terminal", async () => {
    const { deps, regenCalls, events } = fakeDeps({ config: armed(0.75), scores: [0.8] });
    const res = await iterateToSatisfaction(deps);
    assert.equal(res.outcome, "satisfied");
    assert.equal(res.fired, false);
    assert.equal(regenCalls.length, 0);
    assert.deepEqual(events.map((e) => e.event), ["run.iterate.armed", "run.iterate.satisfied"]);
  });

  it("no readable score at entry: coded no-score stop, zero regeneration", async () => {
    const { deps, regenCalls, events } = fakeDeps({ config: armed(), scores: [null] });
    const res = await iterateToSatisfaction(deps);
    assert.equal(res.outcome, "stopped");
    assert.equal(res.code, ITERATE_DECISION_CODES.noScore);
    assert.equal(regenCalls.length, 0);
    assert.deepEqual(events.map((e) => e.event), ["run.iterate.armed", "run.iterate.stopped"]);
  });

  it("no seam attached: armed + below → honest no-seam stop (never a fake fire)", async () => {
    const events: IterateEvent[] = [];
    const res = await iterateToSatisfaction({ config: armed(), score: async () => 0.2, emit: (ev) => events.push(ev) });
    assert.equal(res.outcome, "stopped");
    assert.equal(res.code, ITERATE_DECISION_CODES.noSeam);
    assert.equal(res.fired, false);
    assert.deepEqual(events.map((e) => e.event), ["run.iterate.armed", "run.iterate.stopped"]);
  });

  it("regen refusal: the seam's own code propagates; no cycle event; fired stays true", async () => {
    const { deps, events } = fakeDeps({
      config: armed(),
      scores: [0.2],
      regens: [{ ok: false, code: "RT_E_LLM_NOT_CONFIGURED", detail: "keyless floor" }],
    });
    const res = await iterateToSatisfaction(deps);
    assert.equal(res.outcome, "stopped");
    assert.equal(res.code, "RT_E_LLM_NOT_CONFIGURED");
    assert.equal(res.cycles, 0);
    assert.equal(res.fired, true);
    assert.deepEqual(events.map((e) => e.event), ["run.iterate.armed", "run.iterate.fire", "run.iterate.stopped"]);
    assert.equal(events[2].level, "warn");
    assert.match(events[2].detail, /refused\/failed/);
  });

  it("regen throws → coded iterate.regenerate-error stop (the driver never rethrows)", async () => {
    const events: IterateEvent[] = [];
    const res = await iterateToSatisfaction({
      config: armed(),
      score: async () => 0.2,
      regenerate: async () => {
        throw new Error("boom");
      },
      emit: (ev) => events.push(ev),
    });
    assert.equal(res.code, ITERATE_DECISION_CODES.regenerateError);
    assert.match(events[2].detail, /boom/);
  });

  it("score and budget probes that throw degrade to coded stops/headroom (no crash)", async () => {
    const throwing = await iterateToSatisfaction({
      config: armed(),
      score: async () => {
        throw new Error("score seam exploded");
      },
    });
    assert.equal(throwing.code, ITERATE_DECISION_CODES.noScore);

    // A throwing budget probe reads as headroom — the regen seam still gates spend itself.
    const { deps, regenCalls } = fakeDeps({
      config: armed(0.9),
      scores: [0.2, 0.95],
      budget: () => {
        throw new Error("probe exploded");
      },
    });
    const res = await iterateToSatisfaction(deps);
    assert.equal(res.outcome, "satisfied");
    assert.equal(regenCalls.length, 1);
  });

  it("a throwing emit sink never breaks the loop — the transcript is still complete", async () => {
    const res = await iterateToSatisfaction({
      config: armed(0.9),
      score: (() => {
        let i = 0;
        return async () => (i++ === 0 ? 0.2 : 0.95);
      })(),
      regenerate: async () => ({ ok: true }),
      emit: () => {
        throw new Error("sink exploded");
      },
    });
    assert.equal(res.outcome, "satisfied");
    assert.equal(res.events.length, 4);
  });

  it("deterministic: identical fakes → deep-equal transcripts and results", async () => {
    const a = fakeDeps({ config: armed(0.9, 2), scores: [0.2, 0.3] });
    const b = fakeDeps({ config: armed(0.9, 2), scores: [0.2, 0.3] });
    const ra = await iterateToSatisfaction(a.deps);
    const rb = await iterateToSatisfaction(b.deps);
    assert.deepEqual(ra, rb);
    assert.deepEqual(a.events, b.events);
  });

  it("every emitted event is a catalogue member with a code (closed vocabulary)", async () => {
    const { deps, events } = fakeDeps({ config: armed(0.9, 2), scores: [0.2, 0.3] });
    await iterateToSatisfaction(deps);
    assert.ok(events.length >= 4);
    for (const ev of events) {
      assert.ok(isIterateEvent(ev.event), `${ev.event} must be in ITERATE_EVENTS`);
      assert.ok(ev.code.trim().length > 0);
      assert.equal(typeof ev.detail, "string");
      assert.ok(ev.detail.length > 0);
    }
  });
});

// ---------------------------------------------------------------------------
// (e) adapters + catalogue
// ---------------------------------------------------------------------------

describe("mapRepairOutcome — the repair/re-synth seam envelope mapper", () => {
  it("converged → ok with the cycle count", () => {
    const r = mapRepairOutcome({ outcome: "converged", cycles: 2, refusal: null });
    assert.equal(r.ok, true);
    if (r.ok) assert.match(r.detail ?? "", /converged in 2 cycle/);
  });

  it("keyless → honest RT_E_LLM_NOT_CONFIGURED (a floor is not iteration)", () => {
    const r = mapRepairOutcome({ outcome: "keyless", cycles: 0 });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, "RT_E_LLM_NOT_CONFIGURED");
      assert.match(r.detail ?? "", /no live regeneration/);
    }
  });

  it("failed → RT_E_REPAIR_FAILED carrying the seam's refusal tail (bounded)", () => {
    const long = "x".repeat(400);
    const r = mapRepairOutcome({ outcome: "failed", cycles: 3, refusal: long });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, "RT_E_REPAIR_FAILED");
      assert.ok((r.detail ?? "").length < 260, "the tail is bounded");
    }
  });

  it("junk/null never throws — unknown outcome maps to the failed class", () => {
    assert.equal(mapRepairOutcome(null).ok, false);
    assert.equal(mapRepairOutcome(undefined).ok, false);
    assert.equal(mapRepairOutcome({ outcome: 42 as unknown as string }).ok, false);
  });
});

describe("iterateEventToLogRow + catalogue", () => {
  it("bridges one event into the project-log row shape (ts/phase caller-stamped)", () => {
    const ev: IterateEvent = {
      event: "run.iterate.cycle",
      level: "info",
      code: ITERATE_DECISION_CODES.belowThreshold,
      detail: "cycle 1 complete",
      cycle: 1,
      score: 0.4,
      threshold: 0.75,
    };
    const row = iterateEventToLogRow(ev, 123, 6);
    assert.deepEqual(row, { ts: 123, phase: 6, level: "info", event: "run.iterate.cycle", detail: "cycle 1 complete" });
  });

  it("isIterateEvent is a closed guard: catalogue in, everything else out", () => {
    for (const name of ITERATE_EVENTS) assert.equal(isIterateEvent(name), true);
    assert.equal(isIterateEvent("run.eval.done"), false);
    assert.equal(isIterateEvent(""), false);
    assert.equal(isIterateEvent("run.iterate.fire "), false);
  });
});
