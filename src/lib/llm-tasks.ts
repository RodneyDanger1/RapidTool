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
 *
 * Grounding (fixes/347 R3): `phaseNarrative` accepts an optional query + source
 * list. When sources are supplied it instructs the model to summarize ONLY them
 * and forbids inventing strategy; when they are absent or wholly off-topic it
 * says so (deterministically, via `assessNarrativeGrounding`) instead of letting
 * the model paper the gap over. The result reports `grounded`/`offTopic`/
 * `insufficient` so a caller can judge the summary.
 */

import { complete } from "./llm.ts";
import type { LlmModel, LlmResult, LlmUsage } from "./llm.ts";
import type { ErrorCode } from "./errors.ts";
import type { PhaseDef } from "./types.ts";
// fixes/347 R3: the shared deterministic scorer — the narrative must be able to
// state when its sources are off-topic, using the SAME relevance maths the
// retrieval layer used to rank them. The floor is shared too, so the retrieval
// filter and this grounding check can never disagree on what "off-topic" means.
import { RESEARCH_RELEVANCE_FLOOR, relevanceScore } from "./research.ts";

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
  | {
      ok: true;
      text: string;
      /** True only when fetched sources exist AND are not wholly off-topic. */
      grounded?: boolean;
      /** How many sources were supplied to the summary call (0 ⇒ ungrounded). */
      sourceCount?: number;
      /** A query was supplied, sources exist, and NONE cleared the relevance floor. */
      offTopic?: boolean;
      /** No sources were supplied — the summary cannot be grounded in fetched material. */
      insufficient?: boolean;
      /** Measured usage for this call (I2: a response that reports usage is metered). */
      usage?: LlmUsage;
    }
  | { ok: false; reason: "not-configured" | "error"; error?: string; code?: ErrorCode };

/** One fetched source threaded into a grounded narrative call. */
export type NarrativeSource = {
  title: string;
  url: string;
  content?: string;
  /** Pre-computed relevance ([0,1]); recomputed via `relevanceScore` when absent. */
  score?: number;
};

/** One PRIOR-phase artifact threaded into a narrative so the prose builds on
 *  what came before instead of reasoning from the brief alone. */
export type NarrativePriorArtifact = {
  phase: number;
  title: string;
  body: string;
};

/** Minimal project context needed to ground a phase narrative (a full `Project` is structurally compatible). */
export type PhaseNarrativeSnapshot = {
  name: string;
  brief: string;
  domain?: string;
  /** The exact query that produced `sources` (threaded into the summary call). */
  query?: string;
  /** The fetched sources to summarize. Absent/empty ⇒ an explicitly ungrounded call. */
  sources?: readonly NarrativeSource[];
  /**
   * Deliverable artifacts from EARLIER phases. When present the narrative is
   * instructed to build on (and never contradict) them — a later phase must not
   * be generated from the brief alone. Bounded by the caller; rendered capped here.
   */
  priorArtifacts?: readonly NarrativePriorArtifact[];
};

/** Relevance floor below which a supplied source reads as off-topic for the query.
 *  The SAME floor the retrieval filter drops by (`research.RESEARCH_RELEVANCE_FLOOR`). */
export const NARRATIVE_OFF_TOPIC_SCORE = RESEARCH_RELEVANCE_FLOOR;

/** Deterministic grounding assessment for a narrative call (pure; exported for tests). */
export type NarrativeGrounding = {
  sourceCount: number;
  onTopicCount: number;
  /** A query was supplied, sources exist, and none clear the relevance floor. */
  offTopic: boolean;
  /** No sources at all — the summary cannot be grounded in fetched material. */
  insufficient: boolean;
};

/**
 * Judge whether the sources supplied to a summary call can ground it. A source
 * counts as on-topic when its (given or recomputed) relevance clears
 * `NARRATIVE_OFF_TOPIC_SCORE`. With no query we cannot judge relevance, so the
 * sources are treated as on-topic (the honesty signal then rests on count).
 */
export function assessNarrativeGrounding(
  query: string | undefined,
  sources: readonly NarrativeSource[] | undefined,
): NarrativeGrounding {
  const list = Array.isArray(sources) ? sources.filter((s) => s && typeof s === "object") : [];
  const q = String(query ?? "").trim();
  const onTopicCount = q
    ? list.filter((s) => {
        const score = typeof s.score === "number" ? s.score : relevanceScore(q, s);
        return score >= NARRATIVE_OFF_TOPIC_SCORE;
      }).length
    : list.length;
  return {
    sourceCount: list.length,
    onTopicCount,
    offTopic: Boolean(q) && list.length > 0 && onTopicCount === 0,
    insufficient: list.length === 0,
  };
}

export type CompleteOptions = {
  model?: LlmModel;
  system?: string;
  maxTokens?: number;
  json?: boolean;
  /** OV-36 (W17 · L3) — the per-site thinking decision, pinned EXPLICITLY at
   *  every pro-tier call site below (never left to the vendor default):
   *  `false` for the structured json envelope (fixes/156 E1 — reasoning must
   *  not consume the output window), `true` for the prose tasks (thinking is
   *  the wanted mode there; pinned so a future default flip cannot change
   *  them silently). Forwarded verbatim to the provider, where it can only
   *  ever turn the pro tier OFF (flash keeps its disabled shape). */
  thinking?: boolean;
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

const NARRATIVE_PROMPT = (
  snapshot: PhaseNarrativeSnapshot,
  phase: PhaseDef,
  grounding: NarrativeGrounding,
): string => {
  const domain = snapshot.domain?.trim() ? `\nDomain: ${snapshot.domain.trim()}` : "";
  const query = snapshot.query?.trim() ? `\nResearch query: ${snapshot.query.trim()}` : "";
  const sources = Array.isArray(snapshot.sources) ? snapshot.sources.slice(0, 8) : [];
  const priors = Array.isArray(snapshot.priorArtifacts) ? snapshot.priorArtifacts.slice(-8) : [];
  const groundingSection = sources.length
    ? "Fetched sources (summarize ONLY these — do not add facts, market trends, competitor " +
      "claims, or business strategy they do not state; cite by URL):\n" +
      sources
        .map(
          (s, i) =>
            `${i + 1}. ${String(s.title ?? "").trim() || "(untitled)"} — ${String(s.url ?? "").trim()}\n   ${String(
              s.content ?? "",
            ).slice(0, 300)}`,
        )
        .join("\n")
    : "No sources were fetched.";
  // Context flow (item 1): a later phase must build on the artifacts earlier
  // phases actually produced, never on the brief in isolation. The section is
  // omitted entirely when no priors exist, so the legacy prompt bytes stand.
  const priorSection = priors.length
    ? "\nPrior phase artifacts (build on these; do NOT restate the brief, contradict them, " +
      "or claim work they do not record):\n" +
      priors
        .map((a) => `- P${a.phase} ${String(a.title ?? "").trim()}: ${String(a.body ?? "").replace(/\s+/g, " ").trim().slice(0, 300)}`)
        .join("\n")
    : "";
  // The honesty clause is chosen deterministically from `assessNarrativeGrounding`,
  // never left to the model to decide: an off-topic or empty source set must be
  // REPORTED, not papered over with an invented strategy.
  const honesty = grounding.offTopic
    ? "\nThe fetched sources do NOT address the query (they appear off-topic). State plainly that the sources are off-topic and insufficient; do NOT infer a strategy, market, or pivot from them."
    : grounding.insufficient
      ? priors.length
        ? "\nNo fetched sources are available. Reason ONLY from the project brief and the prior phase artifacts below; do NOT invent findings, market trends, or business strategy they do not state."
        : "\nNo sources are available. Do NOT invent findings, market trends, or business strategy; reason only from the project brief and phase summary, and say when they are insufficient."
      : "\nIf the sources are thin or only partly relevant, say so plainly instead of filling the gap with invention.";
  return (
    `Write a concise one-paragraph narrative for the "${phase.title}" phase (${phase.code}) of project "${snapshot.name}".${domain}${query}\n` +
    `Phase summary: ${phase.summary}\n` +
    `${groundingSection}${priorSection}${honesty}\n` +
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
      // OV-36 (W17 · L3), site 1/3 — json envelope ⇒ thinking OFF: the
      // fixes/156 E1 rule (reasoning_content must not consume the max_tokens
      // window this structured call needs for its output). This is the exact
      // json:true + pro shape 227 §2b names as a live E1 home.
      thinking: false,
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
      // OV-36 (W17 · L3), site 2/3 — prose guidance ⇒ thinking ON, pinned
      // explicitly rather than left to the vendor default. Justification
      // (OV-36 allows this written form): the reply is 2–4 sentences and the
      // note is ≤4000 chars, so E1's large-prompt window-starvation mode is
      // not in play; interpreting a rejection benefits from reasoning, and
      // the pin makes any future default flip visible instead of silent.
      thinking: true,
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
    // Ground the call BEFORE dispatch: the query + source list are threaded in,
    // and the honesty clause (off-topic / insufficient) is derived from the same
    // deterministic scoring the retrieval layer used.
    const grounding = assessNarrativeGrounding(snapshot.query, snapshot.sources);
    const res = await completeFn(NARRATIVE_PROMPT(snapshot, phase, grounding), {
      model: "deepseek-v4-pro",
      // OV-36 (W17 · L3), site 3/3 — one-paragraph narrative ⇒ thinking ON,
      // pinned explicitly (same written justification as site 2/3: prose
      // output from a ≤2000-char grounded brief — no E1 starvation mode; the
      // pin keeps the decision visible if the provider default ever moves).
      thinking: true,
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
    return {
      ok: true,
      text,
      grounded: grounding.sourceCount > 0 && !grounding.offTopic,
      sourceCount: grounding.sourceCount,
      offTopic: grounding.offTopic,
      insufficient: grounding.insufficient,
      ...(res.usage ? { usage: res.usage } : {}),
    };
  }

  return { extractConstraints, interpretFeedback, phaseNarrative };
}

// Default bindings wired to the real DeepSeek `complete()` client contract.
export const { extractConstraints, interpretFeedback, phaseNarrative } =
  createLlmTasks(complete);
