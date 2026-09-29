// ---------------------------------------------------------------------------
// iterate.ts — F1 (314 wave) · the bounded iterate-until-satisfaction driver.
//
// WHAT THIS IS (SE2 §4a's "smallest real first component"; W43 T2.2/T2.3)
//   The re-entry driver: after a completed run whose eval/score — the maker
//   rubric MEAN, 0..1, the same scale run-eval's `grader.passWhen.meanAtLeast`
//   and maker-score's `MakerScoreCard.mean` use — reads BELOW a configured
//   threshold, it triggers a BOUNDED regeneration pass (N = 1..2 cycles; the
//   first component is deliberately capped) and re-scores until satisfied,
//   budget-exhausted, bounded out, or honestly blocked. EVERY decision is
//   coded (`ITERATE_DECISION_CODES`) and emitted as a `run.iterate.*` event
//   through the injected sink — a decision without a code is a bug.
//
// WHAT IT REUSES (no new provider surface, per SE2 §4a)
//   · satisfaction read  = the eval/scorecard side, injected as `score()`
//     (production: the run's maker-score card mean);
//   · regeneration seam  = the EXISTING phase-edge machinery, injected as
//     `regenerate()`: the p6 repair path (`headless.ts repairTreeDir`) or the
//     re-synth path (`headless.ts driveP6Journey`). `mapRepairOutcome()`
//     maps either seam's `{outcome, cycles, refusal}` envelope into the
//     driver's result shape WITHOUT importing them — this module stays pure
//     (no fs, no network, no env reads of its own);
//   · budget stop        = the token ledger, injected as `budgetExhausted()`
//     (production: `isBudgetExhausted(sessionTokenBudget())` — the same
//     process-scoped cap every keyed seam already respects).
//
// WHAT IS DELIBERATELY NOT HERE — THE LIVE KEYED FIRING IS OWNER-GATED
//   The driver ships with its decision logic fully pinnable from injected
//   fakes (fire/no-fire, bounded count, budget stop — keyless, deterministic).
//   Arming it is ONE env var (`RAPIDTOOL_ITERATE_THRESHOLD`); the live keyed
//   firing (attaching `regenerate()` to a real seam inside a real run) is the
//   owner-gated step (F1 PROVE's keyed run). Default is OFF: unset threshold
//   ⇒ the driver emits one `run.iterate.skipped` and touches nothing — the
//   parked owner decision, made explicit, never a fake iteration.
//
// SELF-MOD FENCE NOTE: nothing in this module reads or writes files, env, or
// the network; hosts (run-eval.mjs, a CLI verb, the console) own all I/O.
// ---------------------------------------------------------------------------

import type { JsonLog } from "./types.ts";

// ---------------------------------------------------------------------------
// §1 Config — env-gated, OFF unless armed (the parked owner decision).
// ---------------------------------------------------------------------------

/** The arming env var: setting it (a number in (0,1]) IS the owner decision. */
export const ITERATE_THRESHOLD_ENV = "RAPIDTOOL_ITERATE_THRESHOLD";
/** Optional cycle bound; default ${ITERATE_DEFAULT_MAX_CYCLES}, clamped to 1..CAP. */
export const ITERATE_MAX_CYCLES_ENV = "RAPIDTOOL_ITERATE_MAX_CYCLES";
/** The first component is bounded to at most this many regeneration cycles. */
export const ITERATE_MAX_CYCLES_CAP = 2;
/** Default cycle bound when the env var is absent. */
export const ITERATE_DEFAULT_MAX_CYCLES = 1;

export type IterateConfig = {
  /** Armed ⇔ a valid threshold was configured. Unset/junk ⇒ false (OFF). */
  enabled: boolean;
  /** The satisfaction threshold on the 0..1 score scale; null = never armed. */
  threshold: number | null;
  /** Bounded regeneration cycles, always within 1..ITERATE_MAX_CYCLES_CAP. */
  maxCycles: number;
  /** Honest config notes (junk spelling, clamped value) — [] when clean. */
  notes: string[];
};

/** Strict threshold spelling: `0.5` / `0.75` / `1` / `1.0` — nothing else.
 *  A junk spelling NEVER arms spending (mirrors the token cap's strictness:
 *  junk ⇒ the safe direction, here OFF). */
const THRESHOLD_RE = /^(?:0\.\d+|1(?:\.0+)?)$/;
/** Strict positive-integer spelling for the cycle bound. */
const MAX_CYCLES_RE = /^\d+$/;

/**
 * Read the iterate config from an env record (hosts pass `process.env`).
 * OFF unless a valid threshold is set; every deviation is named in `notes`.
 * Pure — never reads env itself, never throws.
 */
export function readIterateConfig(env: Record<string, string | undefined>): IterateConfig {
  const notes: string[] = [];
  const rawThreshold = typeof env[ITERATE_THRESHOLD_ENV] === "string" ? env[ITERATE_THRESHOLD_ENV]!.trim() : "";
  let threshold: number | null = null;
  if (rawThreshold === "") {
    notes.push(
      `${ITERATE_THRESHOLD_ENV} unset — iterate driver OFF (parked owner decision; set it to a value in (0,1] to arm)`,
    );
  } else if (!THRESHOLD_RE.test(rawThreshold)) {
    notes.push(
      `${ITERATE_THRESHOLD_ENV}=${JSON.stringify(rawThreshold)} is not a threshold spelling (expected a number in (0,1], e.g. 0.75) — driver stays OFF (a junk spelling never arms spending)`,
    );
  } else {
    const value = Number(rawThreshold);
    if (!Number.isFinite(value) || value <= 0 || value > 1) {
      notes.push(`${ITERATE_THRESHOLD_ENV}=${JSON.stringify(rawThreshold)} is outside (0,1] — driver stays OFF`);
    } else {
      threshold = value;
    }
  }

  const rawMax = typeof env[ITERATE_MAX_CYCLES_ENV] === "string" ? env[ITERATE_MAX_CYCLES_ENV]!.trim() : "";
  let maxCycles = ITERATE_DEFAULT_MAX_CYCLES;
  if (rawMax !== "" && MAX_CYCLES_RE.test(rawMax)) {
    const parsed = Number.parseInt(rawMax, 10);
    if (parsed < 1) {
      notes.push(`${ITERATE_MAX_CYCLES_ENV}=${JSON.stringify(rawMax)} clamped to 1 (the driver needs ≥ 1 cycle)`);
    } else if (parsed > ITERATE_MAX_CYCLES_CAP) {
      maxCycles = ITERATE_MAX_CYCLES_CAP;
      notes.push(
        `${ITERATE_MAX_CYCLES_ENV}=${JSON.stringify(rawMax)} clamped to ${ITERATE_MAX_CYCLES_CAP} (the first component is bounded to 1..${ITERATE_MAX_CYCLES_CAP} cycles)`,
      );
    } else {
      maxCycles = parsed;
    }
  } else if (rawMax !== "") {
    notes.push(
      `${ITERATE_MAX_CYCLES_ENV}=${JSON.stringify(rawMax)} is not an integer — using the default ${ITERATE_DEFAULT_MAX_CYCLES}`,
    );
  }

  return { enabled: threshold !== null, threshold, maxCycles, notes };
}

// ---------------------------------------------------------------------------
// §2 The decision vocabulary + the event catalogue.
// ---------------------------------------------------------------------------

/** The driver's OWN decision vocabulary. Seam failures/refusals propagate
 *  their RT_E_* code verbatim (never re-wrapped) — one code per real cause. */
export const ITERATE_DECISION_CODES = {
  disabled: "iterate.disabled",
  noScore: "iterate.no-score",
  satisfied: "iterate.satisfied",
  belowThreshold: "iterate.below-threshold",
  bounded: "iterate.bounded",
  noSeam: "iterate.no-seam",
  regenerateError: "iterate.regenerate-error",
  budgetExhausted: "RT_E_BUDGET_EXHAUSTED",
} as const;

/** Fixed event-name catalogue (additive-only; consumers match on literals).
 *  These are project-log/journal rows (like `p6.journey.exhausted`), NOT
 *  RtEvent telemetry rows — deliberately NOT registered in RT_EVENT_NAMES. */
export const ITERATE_EVENTS = [
  "run.iterate.armed", // once, when the driver is enabled
  "run.iterate.fire", // a regeneration cycle is being attempted
  "run.iterate.cycle", // one completed regeneration cycle
  "run.iterate.satisfied", // terminal: score >= threshold
  "run.iterate.skipped", // terminal: driver OFF (never armed)
  "run.iterate.stopped", // terminal: any other coded stop
] as const;

export type IterateEventName = (typeof ITERATE_EVENTS)[number];

/** True when the string is a catalogue member (consumers guard on this). */
export function isIterateEvent(name: string): name is IterateEventName {
  return (ITERATE_EVENTS as readonly string[]).includes(name);
}

export type IterateEvent = {
  /** From ITERATE_EVENTS — never free-form. */
  event: IterateEventName;
  level: "info" | "warn";
  /** The decision/stop code (ITERATE_DECISION_CODES member or a propagated RT_E_*). */
  code: string;
  /** Human one-liner (display-only). */
  detail: string;
  /** Cycle ordinal (0 before any fire; the cycle being attempted on fire rows). */
  cycle: number;
  /** The latest read score at emit time (null = unreadable). */
  score: number | null;
  /** The configured threshold (null when the driver is OFF). */
  threshold: number | null;
};

// ---------------------------------------------------------------------------
// §3 The pure decision — fire/no-fire, bounded count, budget stop.
// ---------------------------------------------------------------------------

export type IterateState = {
  config: IterateConfig;
  /** Last read satisfaction score (0..1) — null = unreadable (never guessed). */
  score: number | null;
  /** Completed regeneration cycles so far (0 before the first fire). */
  cycle: number;
  /** From the token-ledger seam (`isBudgetExhausted(sessionTokenBudget())`). */
  budgetExhausted: boolean;
  /** Whether a regeneration seam is attached (the live arm is owner-gated). */
  seamAttached: boolean;
};

export type IterateDecision = {
  fire: boolean;
  /** One of ITERATE_DECISION_CODES — every decision is coded. */
  code: string;
  /** Human-readable reason (display-only; the code is the machine contract). */
  reason: string;
};

/**
 * The driver's ENTIRE decision logic — pure, total, deterministic. Order
 * (pinned): disabled → no-score → satisfied → budget → bounded → no-seam →
 * fire. Satisfaction outranks budget (never spend against a satisfied
 * score); budget outranks the cycle count (the deeper stop is reported).
 */
export function decideIterate(state: IterateState): IterateDecision {
  const { config, score, cycle, budgetExhausted, seamAttached } = state;
  if (!config.enabled || config.threshold === null) {
    return {
      fire: false,
      code: ITERATE_DECISION_CODES.disabled,
      reason: `${ITERATE_THRESHOLD_ENV} unset — iterate driver OFF (parked owner decision)`,
    };
  }
  if (score === null || !Number.isFinite(score)) {
    return {
      fire: false,
      code: ITERATE_DECISION_CODES.noScore,
      reason: "no numeric score available — cannot decide (never guessed)",
    };
  }
  if (score >= config.threshold) {
    return {
      fire: false,
      code: ITERATE_DECISION_CODES.satisfied,
      reason: `score ${score} >= threshold ${config.threshold} — satisfied`,
    };
  }
  if (budgetExhausted) {
    return {
      fire: false,
      code: ITERATE_DECISION_CODES.budgetExhausted,
      reason: `token budget exhausted — stopping before further spend (score ${score} < threshold ${config.threshold})`,
    };
  }
  if (cycle >= config.maxCycles) {
    return {
      fire: false,
      code: ITERATE_DECISION_CODES.bounded,
      reason: `bounded out: ${cycle}/${config.maxCycles} cycle(s) used, score ${score} < threshold ${config.threshold} — honest stop (no fake iteration)`,
    };
  }
  if (!seamAttached) {
    return {
      fire: false,
      code: ITERATE_DECISION_CODES.noSeam,
      reason: "no regeneration seam attached — the live arm is owner-gated",
    };
  }
  return {
    fire: true,
    code: ITERATE_DECISION_CODES.belowThreshold,
    reason: `score ${score} < threshold ${config.threshold} — fire regeneration cycle ${cycle + 1}/${config.maxCycles}`,
  };
}

// ---------------------------------------------------------------------------
// §4 The bounded driver — injected seams only, never throws.
// ---------------------------------------------------------------------------

export type IterateCycleContext = {
  /** 1-based ordinal of the cycle being attempted. */
  cycle: number;
  /** The score the fire decision was made against. */
  scoreBefore: number | null;
  /** The armed threshold (always a number when the driver runs). */
  threshold: number;
};

export type IterateRegenResult =
  | { ok: true; detail?: string }
  | { ok: false; code: string; detail?: string };

export type IterateDeps = {
  config: IterateConfig;
  /** The satisfaction read (eval/scorecard side). Throwing reads as null. */
  score: () => Promise<number | null>;
  /** The regeneration seam (repair/re-synth). Absent ⇒ `iterate.no-seam`. */
  regenerate?: (ctx: IterateCycleContext) => Promise<IterateRegenResult>;
  /** The token-ledger seam. Throwing reads as headroom (the seam still gates spend itself). */
  budgetExhausted?: () => boolean;
  /** The coded-event sink (project log / CLI journal). Never allowed to throw into the driver. */
  emit?: (ev: IterateEvent) => void;
};

export type IterateRunResult = {
  outcome: "satisfied" | "stopped" | "not-armed";
  /** Terminal code — satisfied / skipped / stopped decision code. */
  code: string;
  /** COMPLETED regeneration cycles (a refused fire does not count). */
  cycles: number;
  /** Did the driver attempt a regeneration (≥1 `run.iterate.fire` emitted)? */
  fired: boolean;
  scoreBefore: number | null;
  scoreAfter: number | null;
  threshold: number | null;
  maxCycles: number;
  /** Full coded transcript (same objects the sink saw). */
  events: IterateEvent[];
};

/** One-line number formatting for details (4dp when fractional). */
function fmtScore(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Run the bounded iterate-until-satisfaction loop. NEVER throws: score/regen/
 * budget/emit failures degrade to coded outcomes. Returns the full transcript
 * (also handed to `deps.emit` row by row).
 */
export async function iterateToSatisfaction(deps: IterateDeps): Promise<IterateRunResult> {
  const cfg = deps.config;
  const threshold = cfg.threshold;
  const events: IterateEvent[] = [];
  const seamAttached = typeof deps.regenerate === "function";

  const emit = (event: IterateEventName, level: "info" | "warn", code: string, detail: string, cycle: number, score: number | null): void => {
    const ev: IterateEvent = { event, level, code, detail, cycle, score, threshold };
    events.push(ev);
    if (typeof deps.emit === "function") {
      try {
        deps.emit(ev);
      } catch {
        /* telemetry doctrine: a broken sink never throws into the driver */
      }
    }
  };

  const budgetStop = (): boolean => {
    if (typeof deps.budgetExhausted !== "function") return false;
    try {
      return deps.budgetExhausted() === true;
    } catch {
      return false;
    }
  };

  const readScore = async (): Promise<number | null> => {
    try {
      const value = await deps.score();
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  };

  // OFF path: one coded skip, zero work. The parked owner decision, explicit.
  if (!cfg.enabled || threshold === null) {
    emit("run.iterate.skipped", "info", ITERATE_DECISION_CODES.disabled, cfg.notes[0] ?? "iterate driver OFF (threshold unset) — no regeneration fired", 0, null);
    return { outcome: "not-armed", code: ITERATE_DECISION_CODES.disabled, cycles: 0, fired: false, scoreBefore: null, scoreAfter: null, threshold, maxCycles: cfg.maxCycles, events };
  }

  const suffix = cfg.notes.length > 0 ? ` · ${cfg.notes.join("; ")}` : "";
  emit("run.iterate.armed", "info", "iterate.armed", `iterate driver armed: threshold ${fmtScore(threshold)} · max ${cfg.maxCycles} cycle(s)${suffix}`, 0, null);

  const decide = (score: number | null, cycle: number): IterateDecision =>
    decideIterate({ config: cfg, score, cycle, budgetExhausted: budgetStop(), seamAttached });

  const scoreBefore = await readScore();
  let score = scoreBefore;
  let cycle = 0;
  let fired = false;
  let decision = decide(score, cycle);

  while (decision.fire) {
    fired = true;
    const n = cycle + 1;
    const before = score;
    emit("run.iterate.fire", "info", decision.code, `cycle ${n}/${cfg.maxCycles}: ${decision.reason}`, n, score);

    let regen: IterateRegenResult;
    try {
      regen = await deps.regenerate!({ cycle: n, scoreBefore: before, threshold });
    } catch (err) {
      regen = { ok: false, code: ITERATE_DECISION_CODES.regenerateError, detail: `regeneration seam threw: ${errText(err)}` };
    }

    if (regen.ok !== true) {
      const code = typeof regen.code === "string" && regen.code !== "" ? regen.code : ITERATE_DECISION_CODES.regenerateError;
      const detail = typeof regen.detail === "string" && regen.detail !== "" ? regen.detail : "no detail";
      emit(
        "run.iterate.stopped",
        "warn",
        code,
        `cycle ${n}: regeneration refused/failed — ${detail} (bounded stop; no further cycle attempted)`,
        n,
        before,
      );
      return { outcome: "stopped", code, cycles: cycle, fired, scoreBefore, scoreAfter: before, threshold, maxCycles: cfg.maxCycles, events };
    }

    cycle = n;
    score = await readScore();
    const satisfiedNow = score !== null && score >= threshold;
    const regenNote = typeof regen.detail === "string" && regen.detail !== "" ? ` · ${regen.detail}` : "";
    emit(
      "run.iterate.cycle",
      "info",
      satisfiedNow ? ITERATE_DECISION_CODES.satisfied : ITERATE_DECISION_CODES.belowThreshold,
      `cycle ${cycle} complete: score ${fmtScore(before)} → ${fmtScore(score)}${regenNote}`,
      cycle,
      score,
    );
    decision = decide(score, cycle);
  }

  if (decision.code === ITERATE_DECISION_CODES.satisfied) {
    emit("run.iterate.satisfied", "info", decision.code, `${decision.reason} — satisfied after ${cycle} cycle(s)`, cycle, score);
    return { outcome: "satisfied", code: decision.code, cycles: cycle, fired, scoreBefore, scoreAfter: score, threshold, maxCycles: cfg.maxCycles, events };
  }
  emit("run.iterate.stopped", "warn", decision.code, decision.reason, cycle, score);
  return { outcome: "stopped", code: decision.code, cycles: cycle, fired, scoreBefore, scoreAfter: score, threshold, maxCycles: cfg.maxCycles, events };
}

// ---------------------------------------------------------------------------
// §5 Adapters — the existing seams, mapped without importing them.
// ---------------------------------------------------------------------------

/** The shared shape of `repairTreeDir` (RepairTreeResult) and `driveP6Journey`
 *  (P6JourneyResult) envelopes — the two production regeneration seams. */
export type IterateSeamEnvelope = {
  outcome?: string | null;
  cycles?: number | null;
  refusal?: string | null;
};

/**
 * Map one repair/re-synth seam envelope into the driver's result shape:
 * converged → ok; keyless → honest `RT_E_LLM_NOT_CONFIGURED` refusal (the
 * deterministic floor is not iteration); anything else → `RT_E_REPAIR_FAILED`
 * with the seam's own refusal tail. Pure; never throws.
 */
export function mapRepairOutcome(res: IterateSeamEnvelope | null | undefined): IterateRegenResult {
  const outcome = res && typeof res.outcome === "string" ? res.outcome : null;
  const cycles = res && typeof res.cycles === "number" && Number.isFinite(res.cycles) ? res.cycles : null;
  const tail =
    res && typeof res.refusal === "string" && res.refusal.trim() !== ""
      ? ` — ${res.refusal.trim().slice(0, 160)}`
      : "";
  if (outcome === "converged") {
    return { ok: true, detail: `seam converged in ${cycles === null ? "?" : cycles} cycle(s)` };
  }
  if (outcome === "keyless") {
    return {
      ok: false,
      code: "RT_E_LLM_NOT_CONFIGURED",
      detail: `keyless floor — no live regeneration happened (no keyed call made)${tail}`,
    };
  }
  return {
    ok: false,
    code: "RT_E_REPAIR_FAILED",
    detail: `seam did not converge (outcome ${outcome ?? "unknown"})${tail}`,
  };
}

/**
 * Flatten one coded iterate event into the repo's project-log row shape
 * (`Project.logs` / JsonLog) — the bridge a host uses to persist the
 * transcript. `ts` is stamped by the caller (this module never invents time);
 * `phase` is the caller's context (the driver's production regen targets P6).
 */
export function iterateEventToLogRow(ev: IterateEvent, ts: number, phase: JsonLog["phase"]): JsonLog {
  return { ts, phase, level: ev.level, event: ev.event, detail: ev.detail };
}
