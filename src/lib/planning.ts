/**
 * Plan-then-act scaffold: planSteps → reflect → backtrack (server-only at
 * runtime — this module imports ./deepseek.server.ts; client modules may
 * import its TYPES only, via `import type`).
 *
 * Wave-3 orchestration core (fixes/51_wave3_orchestration.md):
 * - G-24 plan-then-act ledger core: an explicit, machine-readable plan object
 *   ({ id, action, why } step rows) that execution is measured against —
 *   planSteps emits it as one flash JSON call.
 * - G-25 Reflexion critique core: reflect() judges the executed plan against
 *   the outcome transcript and may hand back revised steps.
 * - G-26 backtrack core: backtrack() rewinds a plan to the last known-good
 *   step before a failed one — pure, deterministic, no LLM.
 *
 * Honesty contract (crew.server.ts:18-21 pattern): no DeepSeek key →
 * { ok:false, reason:"not-configured" } from the completer BEFORE any network
 * I/O; unparseable model JSON gets exactly ONE bounded re-prompt and then an
 * honest { ok:false, reason:"error" } — the machine never fabricates a plan or
 * a critique, and never silently substitutes prose. Model tier is flash
 * (thinking disabled at the API level — see deepseek.server.ts:163-165 and
 * feasibility review correction 10 for G-24).
 *
 * All public functions are deterministic in shape: for the same inputs the
 * same JSON reply always normalizes to the same rows (trimmed, deduped,
 * canonical ids) and the same result object.
 */

import { completeDeepSeek, DEEPSEEK_MODELS } from "./deepseek.server.ts";
import type { LlmModel, LlmResult } from "./llm.ts";

/** Hard cap on planned steps (register G-24 ledger "budget" default: 8). */
export const MAX_PLAN_STEPS = 8;

/** Hard cap on revised steps a critique may carry (bounded re-plan). */
export const MAX_REVISED_STEPS = 6;

/**
 * Canonical field caps for normalized plan rows. Model-emitted step ids and
 * prose are unbounded strings; without caps a single hostile/garbled reply
 * could push a multi-KB id or action into every downstream prompt, transcript,
 * and the "Plan steps (plan-act)" artifact. Hyper-agent finding H1: Codex's
 * tool schemas bound every parameter and the loop treats the plan as typed
 * state, not free text; RapidTool's determinism law (same reply → same rows)
 * makes these caps part of the canonical shape. Truncation is marked with the
 * same TRUNC_MARK the prompt builders use — a cut is never silent.
 */
export const PLAN_ID_MAX_CHARS = 48;
export const PLAN_ACTION_MAX_CHARS = 500;
export const PLAN_WHY_MAX_CHARS = 400;

const TRUNC_MARK = "…[TRUNCATED]";
const MAX_ATTEMPTS = 2;

/** One planned step: short unique id + one concrete action + why it matters. */
export type PlanStep = {
  id: string;
  action: string;
  why: string;
};

/** The machine-readable plan object execution is measured against. */
export type Plan = {
  goal: string;
  steps: PlanStep[];
};

/** Reflexion-style verdict on the executed plan. */
export type PlanVerdict = "keep" | "revise";

/** Structured critique emitted by reflect() (deterministic shape). */
export type PlanCritique = {
  verdict: PlanVerdict;
  summary: string;
  issues: string[];
  /** Present only when the model revised the plan (verdict "revise"). */
  revised?: PlanStep[];
};

export type PlanStepsResult =
  | { ok: true; steps: PlanStep[]; plan: Plan }
  | { ok: false; reason: "not-configured" | "error"; error?: string };

export type ReflectResult =
  | { ok: true; critique: PlanCritique }
  | { ok: false; reason: "not-configured" | "error"; error?: string };

/** Result of a pure plan rewind. */
export type PlanBacktrack = {
  /** The plan rewound to the steps BEFORE the failed one (failed + tail cut). */
  plan: Plan;
  /** The failed step, or null when `failedStepId` is not in the plan. */
  failedStep: PlanStep | null;
  /** Steps removed by the rewind: the failed step first, then its tail. */
  rewound: PlanStep[];
};

/** Signature-compatible with completeDeepSeek (deepseek.server.ts) / the
 *  crew's CrewCompleter, so a crew runtime can inject its own completer. */
export type PlannerCompleter = (
  prompt: string,
  opts?: { model?: LlmModel; system?: string; maxTokens?: number; json?: boolean },
) => Promise<LlmResult>;

// ---------------------------------------------------------------------------
// Prompt builders (deterministic; honesty rules mirror crew STANDING_RULE)
// ---------------------------------------------------------------------------

export const PLAN_STEPS_SYSTEM =
  "You are the planning layer of a governed multi-agent crew. Decompose the goal into an ordered sequence of concrete, independently executable steps. " +
  "You remain advisory: you never approve, reject, advance, or deploy. " +
  'Reply with exactly one JSON object — no prose, no markdown outside it — with the schema: {"steps": [{"id": "<short unique id>", "action": "<one imperative action>", "why": "<why this step matters>"}]}. ' +
  "Provide between 1 and the requested number of steps. Ground every action ONLY in the provided context; never invent files, APIs, endpoints, sources, or results; when context is missing, say so in a step's why. Never emit secrets.";

export const REFLECT_SYSTEM =
  "You are the reflection step of a plan-then-act loop (Reflexion-style critique). Given the goal, the executed plan steps, and the actual outcome transcript, judge whether the executed plan held. " +
  "Base the critique ONLY on the outcome transcript provided — never invent outcomes, sources, or test results. " +
  'Reply with exactly one JSON object — no prose, no markdown outside it — with the schema: {"verdict": "keep" | "revise", "summary": "<1-3 sentence honest assessment>", "issues": ["<concrete problem, if any>"], "revisedSteps": [{"id": "<short unique id>", "action": "<one imperative action>", "why": "<why this step matters>"}]}. ' +
  '"keep" means the executed plan was adequate; "revise" means a re-plan is warranted — then include revisedSteps (1 to 6 replacement steps). "summary" is required and must be non-empty. Never emit secrets.';

function cutToChars(s: string, cap: number): string {
  if (s.length <= cap) return s;
  return `${s.slice(0, Math.max(0, cap - TRUNC_MARK.length))}${TRUNC_MARK}`;
}

// ---------------------------------------------------------------------------
// Deterministic parsers — never throw, always a canonical shape
// ---------------------------------------------------------------------------

/** Strip one outer ```lang fence pair when the whole reply is fenced. */
function stripOuterFence(text: string): string {
  const s = text.trim();
  if (!/^```/.test(s)) return s;
  const body = s.replace(/^```[a-zA-Z0-9+_-]*\s*\n?/, "");
  return body.replace(/\n?```\s*$/, "").trim();
}

/**
 * Normalize arbitrary model JSON into canonical PlanStep rows: only entries
 * with a non-empty string `action` survive; id/action/why are trimmed; ids are
 * deduped with deterministic `step-N` / `step-N-k` fallbacks. Pure.
 */
function normalizePlanSteps(raw: unknown, cap: number): PlanStep[] {
  if (!Array.isArray(raw)) return [];
  const out: PlanStep[] = [];
  const used = new Set<string>();
  for (const entry of raw) {
    if (out.length >= cap) break;
    if (typeof entry !== "object" || entry === null) continue;
    const o = entry as Record<string, unknown>;
    const action = typeof o.action === "string" ? cutToChars(o.action.trim(), PLAN_ACTION_MAX_CHARS) : "";
    if (!action) continue;
    const idRaw = typeof o.id === "string" ? o.id.trim().slice(0, PLAN_ID_MAX_CHARS) : "";
    const base = idRaw && !used.has(idRaw) ? idRaw : `step-${out.length + 1}`;
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    const why = typeof o.why === "string" ? cutToChars(o.why.trim(), PLAN_WHY_MAX_CHARS) : "";
    out.push({ id, action, why });
  }
  return out;
}

/** Parse a model reply as a step plan; null when unusable (triggers re-prompt). */
function tryParseSteps(text: string, cap: number): PlanStep[] | null {
  const cleaned = stripOuterFence(text);
  if (!cleaned.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed !== "object" || parsed === null) return null;
    const steps = normalizePlanSteps((parsed as Record<string, unknown>).steps, cap);
    return steps.length > 0 ? steps : null;
  } catch {
    return null;
  }
}

/** Parse a model reply as a critique; null when unusable (triggers re-prompt). */
function tryParseCritique(text: string): PlanCritique | null {
  const cleaned = stripOuterFence(text);
  if (!cleaned.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed !== "object" || parsed === null) return null;
    const o = parsed as Record<string, unknown>;
    const verdict = o.verdict === "revise" ? "revise" : o.verdict === "keep" ? "keep" : null;
    if (!verdict) return null;
    const summary = typeof o.summary === "string" ? o.summary.trim() : "";
    if (!summary) return null;
    const issuesRaw = Array.isArray(o.issues)
      ? o.issues.filter((i): i is string => typeof i === "string" && i.trim().length > 0).map((i) => i.trim())
      : [];
    const revised = verdict === "revise" ? normalizePlanSteps(o.revisedSteps, MAX_REVISED_STEPS) : [];
    // F2-84 schema discipline: the REFLECT_SYSTEM contract says verdict
    // "revise" MUST carry 1..6 revisedSteps ("a re-plan is warranted — then
    // include revisedSteps"). A revise critique with none (or only unparseable
    // rows) leaves the loop with a verdict to replan and no plan to execute —
    // that is a malformed reply and must take the bounded re-prompt, not pass
    // as a valid critique the caller would have to guess about.
    if (verdict === "revise" && revised.length === 0) return null;
    const critique: PlanCritique = { verdict, summary, issues: issuesRaw.slice(0, 6) };
    if (revised.length > 0) critique.revised = revised;
    return critique;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Factory (DI for tests) + default bindings (real backend)
// ---------------------------------------------------------------------------

function makePlanSteps(completer: PlannerCompleter) {
  return async function planSteps(
    goal: string,
    context: string,
    opts?: { maxSteps?: number },
  ): Promise<PlanStepsResult> {
    const trimmedGoal = typeof goal === "string" ? goal.trim() : "";
    if (!trimmedGoal) {
      return { ok: false, reason: "error", error: "planSteps requires a non-empty goal" };
    }
    const ctx = typeof context === "string" ? context.trim() : "";
    // F2-84: a NaN / Infinity / fractional maxSteps used to propagate into the
    // prompt ("up to NaN ordered steps") and — worse — into normalizePlanSteps'
    // `out.length >= cap` cap check, where NaN comparisons are always false and
    // the cap silently became unbounded. Non-finite or missing → the hard cap.
    const requested = opts?.maxSteps;
    const capped =
      typeof requested === "number" && Number.isFinite(requested)
        ? Math.max(1, Math.min(Math.floor(requested), MAX_PLAN_STEPS))
        : MAX_PLAN_STEPS;
    const basePrompt =
      `## Goal\n${cutToChars(trimmedGoal, 2000)}\n\n## Context\n${cutToChars(ctx, 14_000)}\n\n` +
      `Emit a plan of up to ${capped} ordered steps that achieves the goal within the phase gates. ` +
      "Each step must be independently executable by a single crew role turn.";
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const prompt =
        attempt === 0
          ? basePrompt
          : `${basePrompt}\n\nYour previous reply did not parse: it must be exactly one JSON object with a non-empty "steps" array, each entry {id, action, why}. Reply with ONLY that JSON object now.`;
      const res = await completer(prompt, {
        model: DEEPSEEK_MODELS.flash,
        system: PLAN_STEPS_SYSTEM,
        maxTokens: 2048,
        json: true,
      });
      if (!res.ok) {
        return res.reason === "not-configured"
          ? { ok: false, reason: "not-configured" }
          : { ok: false, reason: "error", error: res.error ?? "plan steps call failed" };
      }
      const steps = tryParseSteps(res.text, capped);
      if (steps) return { ok: true, steps, plan: { goal: trimmedGoal, steps } };
    }
    return { ok: false, reason: "error", error: "plan steps unparseable after retry" };
  };
}

function makeReflect(completer: PlannerCompleter) {
  return async function reflect(
    goal: string,
    steps: PlanStep[],
    outcome: string,
  ): Promise<ReflectResult> {
    const trimmedGoal = typeof goal === "string" ? goal.trim() : "";
    const rows = Array.isArray(steps) ? steps : [];
    const trimmedOutcome = typeof outcome === "string" ? outcome.trim() : "";
    if (!trimmedGoal || rows.length === 0 || !trimmedOutcome) {
      return {
        ok: false,
        reason: "error",
        error: "reflect requires a non-empty goal, at least one executed step, and an outcome",
      };
    }
    const stepsText = cutToChars(JSON.stringify(rows, null, 2), 4000);
    const basePrompt =
      `## Goal\n${cutToChars(trimmedGoal, 2000)}\n\n## Executed plan steps\n${stepsText}\n\n` +
      `## Outcome transcript (what actually happened)\n${cutToChars(trimmedOutcome, 6000)}\n\n` +
      "Judge the executed plan against the outcome transcript.";
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const prompt =
        attempt === 0
          ? basePrompt
          : `${basePrompt}\n\nYour previous reply did not parse: it must be exactly one JSON object {verdict: "keep"|"revise", summary, issues, revisedSteps}. Reply with ONLY that JSON object now.`;
      const res = await completer(prompt, {
        model: DEEPSEEK_MODELS.flash,
        system: REFLECT_SYSTEM,
        maxTokens: 2048,
        json: true,
      });
      if (!res.ok) {
        return res.reason === "not-configured"
          ? { ok: false, reason: "not-configured" }
          : { ok: false, reason: "error", error: res.error ?? "reflect call failed" };
      }
      const critique = tryParseCritique(res.text);
      if (critique) return { ok: true, critique };
    }
    return { ok: false, reason: "error", error: "reflect critique unparseable after retry" };
  };
}

/** The bound planning API a caller (or the crew runtime) drives. */
export type PlanningApi = {
  planSteps: (
    goal: string,
    context: string,
    opts?: { maxSteps?: number },
  ) => Promise<PlanStepsResult>;
  reflect: (goal: string, steps: PlanStep[], outcome: string) => Promise<ReflectResult>;
};

/**
 * DI factory: inject a stub completer for tests (same pattern as
 * createCrew in crew.server.ts). Defaults to the real completeDeepSeek.
 */
export function createPlanning(completer?: PlannerCompleter): PlanningApi {
  const complete = completer ?? completeDeepSeek;
  return { planSteps: makePlanSteps(complete), reflect: makeReflect(complete) };
}

const defaultPlanning = createPlanning();

/** Default binding: planSteps over the real DeepSeek backend (flash, json:true). */
export async function planSteps(
  goal: string,
  context: string,
  opts?: { maxSteps?: number },
): Promise<PlanStepsResult> {
  return defaultPlanning.planSteps(goal, context, opts);
}

/** Default binding: reflect over the real DeepSeek backend (flash, json:true). */
export async function reflect(
  goal: string,
  steps: PlanStep[],
  outcome: string,
): Promise<ReflectResult> {
  return defaultPlanning.reflect(goal, steps, outcome);
}

// ---------------------------------------------------------------------------
// Backtrack — pure, deterministic, zero LLM (G-26 core)
// ---------------------------------------------------------------------------

/**
 * Rewind `plan` to the last known-good prefix: the step with id
 * `failedStepId` and everything after it are removed and reported in
 * `rewound` (failed step first). Unknown id → no-op (plan unchanged,
 * failedStep null, rewound []). Never mutates the input plan and never
 * aliases it: every returned plan/step is a fresh copy, so caller mutation
 * of the result cannot leak back into the input.
 */
export function backtrack(plan: Plan, failedStepId: string): PlanBacktrack {
  const idx = plan.steps.findIndex((s) => s.id === failedStepId);
  if (idx === -1) {
    return {
      plan: { goal: plan.goal, steps: plan.steps.map((s) => ({ ...s })) },
      failedStep: null,
      rewound: [],
    };
  }
  return {
    plan: { goal: plan.goal, steps: plan.steps.slice(0, idx).map((s) => ({ ...s })) },
    failedStep: { ...plan.steps[idx] },
    rewound: plan.steps.slice(idx).map((s) => ({ ...s })),
  };
}
