/**
 * Client-facing LLM task helpers for RapidTool (DeepSeek) — constraint
 * extraction, feedback interpretation, and per-phase narratives.
 *
 * Import THESE functions from engine/store/UI code — never import
 * `./deepseek.server.ts` directly. Each task is config-gated through
 * `complete()` (./llm.ts) and returns an honest
 * `{ ok: false, reason: "not-configured" | "error" }` shape when the backend is
 * absent or the call fails — it NEVER fabricates output.
 *
 * Testability: the task bodies are built by `createLlmTasks(completeFn)` so
 * tests can inject a stub `complete` (or the real `completeDeepSeek`) without
 * spinning up the TanStack server runtime. The default export binds the real
 * `complete` from `./llm.ts`.
 */

import { complete } from "./llm.ts";
import type { LlmModel, LlmResult } from "./llm.ts";
import type { ErrorCode } from "./errors.ts";
import type { PhaseDef } from "./types.ts";

// ---------------------------------------------------------------------------
// Result shapes (honest, typed)
// ---------------------------------------------------------------------------

export type ConstraintsResult =
  | { ok: true; constraints: string[] }
  | { ok: false; reason: "not-configured" | "error"; error?: string; code?: ErrorCode };

export type FeedbackResult =
  | { ok: true; guidance: string }
  | { ok: false; reason: "not-configured" | "error"; error?: string; code?: ErrorCode };

export type NarrativeResult =
  | { ok: true; text: string }
  | { ok: false; reason: "not-configured" | "error"; error?: string; code?: ErrorCode };

/** Minimal project context needed to ground a phase narrative (a full `Project` is structurally compatible). */
export type PhaseNarrativeSnapshot = {
  name: string;
  brief: string;
  domain?: string;
};

export type CompleteOptions = {
  model?: LlmModel;
  system?: string;
  maxTokens?: number;
  json?: boolean;
};

/** Signature-compatible with `complete()` (llm.ts) and `completeDeepSeek()` (deepseek.server.ts). */
export type Completer = (prompt: string, opts?: CompleteOptions) => Promise<LlmResult>;

// ---------------------------------------------------------------------------
// Prompt builders (pure — cheap to change, trivial to reason about)
// ---------------------------------------------------------------------------

const CONSTRAINT_PROMPT = (brief: string): string =>
  `Extract the explicit, hard requirements from this project brief and return them as a JSON object with a single key "constraints" (an array of strings). ` +
  `Include: budget, timeline/deadline, must-have features, required tech stack, and compliance/legal requirements when they are stated. ` +
  `Return an empty array if none are stated. Do not invent requirements that are not in the brief.\n\nBrief:\n${brief.slice(0, 4000)}`;

const FEEDBACK_PROMPT = (note: string, phaseTitle: string): string =>
  `A project phase was rejected. Turn the reviewer's rejection note into concrete, actionable next-step guidance for the builder (2-4 sentences). ` +
  `Be specific about what to change, add, verify, or remove. Do not re-approve the work; assume the rejection stands.\n\nPhase: ${phaseTitle}\nRejection note:\n${note.slice(0, 4000)}`;

const NARRATIVE_PROMPT = (snapshot: PhaseNarrativeSnapshot, phase: PhaseDef): string => {
  const domain = snapshot.domain?.trim() ? `\nDomain: ${snapshot.domain.trim()}` : "";
  return (
    `Write a concise one-paragraph narrative for the "${phase.title}" phase (${phase.code}) of project "${snapshot.name}".${domain}\n` +
    `Phase summary: ${phase.summary}\n` +
    `Project brief:\n${snapshot.brief.slice(0, 2000)}`
  );
};

// ---------------------------------------------------------------------------
// Pure parsers (exported for direct unit testing)
// ---------------------------------------------------------------------------

/**
 * Parse a model's JSON reply into a constraint list. Accepts either
 * `{ "constraints": [...] }` or a bare array, tolerates markdown fences, and
 * drops empty/non-string entries. Returns `null` when the payload is not
 * usable — callers then report an honest `error`, never a guessed list.
 */
export function parseConstraintList(text: string): string[] | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    return null;
  }
  const toList = (arr: unknown): string[] | null => {
    if (!Array.isArray(arr)) return null;
    return arr
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim());
  };
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const constraints = (obj as Record<string, unknown>).constraints;
    return toList(constraints);
  }
  return toList(obj);
}

// ---------------------------------------------------------------------------
// Task factory (dependency-injected for testability)
// ---------------------------------------------------------------------------

export function createLlmTasks(completeFn: Completer) {
  async function extractConstraints(brief: string): Promise<ConstraintsResult> {
    const res = await completeFn(CONSTRAINT_PROMPT(brief), {
      model: "deepseek-v4-pro",
      json: true,
    });
    if (!res.ok) {
      return res.reason === "not-configured"
        ? { ok: false, reason: "not-configured", ...(res.code ? { code: res.code } : {}) }
        : { ok: false, reason: "error", error: res.error, ...(res.code ? { code: res.code } : {}) };
    }
    const parsed = parseConstraintList(res.text);
    if (parsed === null) {
      return {
        ok: false,
        reason: "error",
        error: "Model returned an unparseable constraints payload",
        code: "RT_E_VALIDATION",
      };
    }
    return { ok: true, constraints: parsed };
  }

  async function interpretFeedback(
    note: string,
    phaseTitle: string,
  ): Promise<FeedbackResult> {
    const res = await completeFn(FEEDBACK_PROMPT(note, phaseTitle), {
      model: "deepseek-v4-pro",
    });
    if (!res.ok) {
      return res.reason === "not-configured"
        ? { ok: false, reason: "not-configured", ...(res.code ? { code: res.code } : {}) }
        : { ok: false, reason: "error", error: res.error, ...(res.code ? { code: res.code } : {}) };
    }
    const guidance = res.text.trim();
    if (!guidance) {
      return {
        ok: false,
        reason: "error",
        error: "Model returned empty guidance",
        code: "RT_E_LLM_REJECTED",
      };
    }
    return { ok: true, guidance };
  }

  async function phaseNarrative(
    snapshot: PhaseNarrativeSnapshot,
    phase: PhaseDef,
  ): Promise<NarrativeResult> {
    const res = await completeFn(NARRATIVE_PROMPT(snapshot, phase), {
      model: "deepseek-v4-pro",
    });
    if (!res.ok) {
      return res.reason === "not-configured"
        ? { ok: false, reason: "not-configured", ...(res.code ? { code: res.code } : {}) }
        : { ok: false, reason: "error", error: res.error, ...(res.code ? { code: res.code } : {}) };
    }
    const text = res.text.trim();
    if (!text) {
      return {
        ok: false,
        reason: "error",
        error: "Model returned empty narrative",
        code: "RT_E_LLM_REJECTED",
      };
    }
    return { ok: true, text };
  }

  return { extractConstraints, interpretFeedback, phaseNarrative };
}

// Default bindings wired to the real DeepSeek `complete()` client contract.
export const { extractConstraints, interpretFeedback, phaseNarrative } =
  createLlmTasks(complete);
