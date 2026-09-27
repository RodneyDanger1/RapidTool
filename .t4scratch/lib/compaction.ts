// ---------------------------------------------------------------------------
// compaction.ts — context-compaction constants + SUMMARY_TEMPLATE + the
// "verify the effect, not the request" outcome check.
//
// 216v · 107 T-107.9 · maps 103 A5/A6 · the 100 P0-02 "verify by effect" shape.
//
// Why this exists (dossier 107 §9 runner-ups + §4): the single most copyable
// compaction spec in the competitor study — a small set of constants and a
// fixed summary template — plus its best pattern: a compaction is never
// verified by FIRING the request, only by OBSERVING the effect (a completion
// event AND a measured token drop). "No event in time means the compaction
// never landed — a failure, not a 'nothing to compact' no-op."
//
// Boundary (deliberate): this module is the adopted VOCABULARY — thresholds,
// the section-ordered summary template, a per-tool-result clamp, and the
// three-outcome verification. It performs no I/O, holds no session state, and
// makes no decisions about WHERE a context is compacted; callers own the
// pipeline. Wired point + deferral reason: fixes/216v §3 (no compaction site
// exists in engine.ts today; the named consumers are the chat-history rollup
// 168A-2 and codegen's chunk-prompt assembly, which is L1-owned this wave).
//
// Doctrine:
//   · PURE LEAF — no imports, no fs, no clock, no randomness, no `process.env`.
//   · TOTAL — malformed input never throws; an unverifiable compaction reports
//     the FAILURE arm ("timeout"), never a fabricated "compacted".
//   · DETERMINISTIC — same input, same output, byte for byte.
// ---------------------------------------------------------------------------

/**
 * Headroom (in tokens) kept below the context window before a compaction is
 * due — the trigger margin, verbatim from the copied spec (dossier 107 §9:
 * `DEFAULT_BUFFER = 20_000` "headroom before triggering").
 */
export const DEFAULT_BUFFER = 20_000;

/**
 * History retained (in tokens) AFTER a compaction — the keep budget, verbatim
 * from the copied spec (dossier 107 §9: `DEFAULT_KEEP_TOKENS = 8_000`).
 */
export const DEFAULT_KEEP_TOKENS = 8_000;

/**
 * Per-tool-result character cap (dossier 107 §9: `TOOL_OUTPUT_MAX_CHARS =
 * 2_000`). Oversized tool output is middle-truncated with a counted elision
 * marker — never silently cut, never re-sent whole on every later request.
 */
export const TOOL_OUTPUT_MAX_CHARS = 2_000;

/**
 * Token budget for a generated compaction summary (dossier 107 §9:
 * `SUMMARY_OUTPUT_TOKENS = 4_096`). Callers pass this as the summary call's
 * output cap; this module never calls a model.
 */
export const SUMMARY_OUTPUT_TOKENS = 4_096;

/**
 * The summary's section headings, in the one order the template permits
 * (dossier 107 §9: Objective / Important Details / Work State
 * Completed|Active|Blocked / Next Move). Frozen: a consumer may iterate it,
 * no consumer may reorder it.
 */
export const SUMMARY_SECTIONS: readonly string[] = Object.freeze([
  "## Objective",
  "## Important Details",
  "## Work State",
  "### Completed",
  "### Active",
  "### Blocked",
  "## Next Move",
]);

/** The placeholder vocabulary `renderCompactionSummary` fills, in order. */
export const SUMMARY_PLACEHOLDERS: readonly string[] = Object.freeze([
  "{objective}",
  "{important_details}",
  "{completed}",
  "{active}",
  "{blocked}",
  "{next_move}",
]);

/**
 * The fixed compaction-summary template (dossier 107 §9): the copied spec
 * demands "Output exactly the Markdown structure shown inside <template> and
 * keep the section order unchanged". The order is protocol, not style — a
 * reordered summary defeats the format's chunk comparison across turns.
 */
export const SUMMARY_TEMPLATE = [
  "Output exactly the Markdown structure shown inside <template> and keep the section order unchanged. Do not add, rename, or reorder sections.",
  "<template>",
  "## Objective",
  "{objective}",
  "",
  "## Important Details",
  "{important_details}",
  "",
  "## Work State",
  "### Completed",
  "{completed}",
  "",
  "### Active",
  "{active}",
  "",
  "### Blocked",
  "{blocked}",
  "",
  "## Next Move",
  "{next_move}",
  "</template>",
].join("\n");

/**
 * The three-outcome compaction verdict (dossier 107 §4): NEVER conflate
 * "nothing needed doing" (`no_change`) with "the thing did not happen"
 * (`timeout` — a FAILURE the caller must surface, not swallow).
 */
export type CompactionOutcome = "compacted" | "no_change" | "timeout";

/** Fill values for `renderCompactionSummary` — every field optional. */
export type CompactionSummaryFill = {
  objective?: string;
  importantDetails?: string;
  completed?: string;
  active?: string;
  blocked?: string;
  nextMove?: string;
};

/** Total string coercion for one summary field: absent/garbage ⇒ "(none)". */
function fillOrNone(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return "(none)";
}

/**
 * Render a compaction summary in the FROZEN section order. Pure and total:
 * missing or non-string fields become "(none)"; the heading set and its order
 * are taken from `SUMMARY_SECTIONS`/`SUMMARY_TEMPLATE`, so a caller cannot
 * reorder the protocol by passing different input.
 */
export function renderCompactionSummary(fill: CompactionSummaryFill): string {
  const f = (fill ?? {}) as CompactionSummaryFill;
  return SUMMARY_TEMPLATE.replace("{objective}", fillOrNone(f.objective))
    .replace("{important_details}", fillOrNone(f.importantDetails))
    .replace("{completed}", fillOrNone(f.completed))
    .replace("{active}", fillOrNone(f.active))
    .replace("{blocked}", fillOrNone(f.blocked))
    .replace("{next_move}", fillOrNone(f.nextMove));
}

/**
 * Trigger check: is the prompt close enough to the window that a compaction
 * is DUE? Fires when the remaining headroom (window − prompt) is at or below
 * `buffer` — the copied spec's `DEFAULT_BUFFER` semantics. Total: non-finite
 * or non-positive inputs report `false` (never a fabricated trigger).
 */
export function shouldCompact(
  promptTokens: number,
  contextWindowTokens: number,
  buffer: number = DEFAULT_BUFFER,
): boolean {
  if (!Number.isFinite(promptTokens) || !Number.isFinite(contextWindowTokens)) return false;
  if (promptTokens < 0) return false;
  if (!Number.isFinite(buffer) || buffer < 0) return false;
  if (contextWindowTokens <= 0) return false;
  return contextWindowTokens - promptTokens <= buffer;
}

/**
 * Tokens saved by a compaction: `before − after` (the copied spec reports
 * `tokensSaved: requestInputTokens - afterRequestTokens`). Positive = a real
 * shrink; zero/negative = nothing was saved (a caller may treat growth as its
 * own policy — this module does not invent a "marginal shrink" threshold the
 * dossier does not state). Total: non-finite operands count as 0.
 */
export function tokensSaved(tokensBefore: number, tokensAfter: number): number {
  const before = Number.isFinite(tokensBefore) ? tokensBefore : 0;
  const after = Number.isFinite(tokensAfter) ? tokensAfter : 0;
  return before - after;
}

/**
 * Verify a compaction BY EFFECT — the pattern this module exists to carry
 * (dossier 107 §4): `compacted` requires BOTH a landed completion event AND a
 * measured per-turn token drop; a landed event without a drop is `no_change`
 * (nothing needed doing); NO event is `timeout` — a failure, never a no-op.
 * Total and fail-closed: malformed input reports `timeout` (the failure arm),
 * so an unverifiable compaction can never masquerade as a success.
 */
export function compactionOutcome(input: {
  eventObserved: boolean;
  tokensBefore: number;
  tokensAfter: number;
}): CompactionOutcome {
  if (!input || typeof input !== "object") return "timeout";
  if (input.eventObserved !== true) return "timeout";
  if (!Number.isFinite(input.tokensBefore) || !Number.isFinite(input.tokensAfter)) {
    return "timeout";
  }
  return input.tokensAfter < input.tokensBefore ? "compacted" : "no_change";
}

/** Result of `clampToolOutput` — the clamped text plus its honest accounting. */
export type ClampedToolOutput = {
  text: string;
  clamped: boolean;
  originalChars: number;
  elidedChars: number;
};

/**
 * Middle-truncate one tool result to `maxChars` characters (the dossier's
 * per-tool-result cap; the study's `truncate_middle_with_token_budget`
 * shape). The elision is MARKED and COUNTED — never a silent cut: the middle
 * is replaced by `… [N chars elided by compaction] …`, keeping the head and
 * tail (where a runner's summary lines and final error usually are). Total:
 * non-string input yields the empty unclamped result; output length never
 * exceeds `maxChars`; text at or under the cap passes through byte-identical.
 */
export function clampToolOutput(
  text: string,
  maxChars: number = TOOL_OUTPUT_MAX_CHARS,
): ClampedToolOutput {
  if (typeof text !== "string") {
    return { text: "", clamped: false, originalChars: 0, elidedChars: 0 };
  }
  const cap =
    Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : TOOL_OUTPUT_MAX_CHARS;
  if (text.length <= cap) {
    return { text, clamped: false, originalChars: text.length, elidedChars: 0 };
  }
  // A cap too small for a marked elision falls back to a plain head-cut that
  // still COUNTS what it dropped (honest accounting, never a silent cut).
  if (cap < 64) {
    return { text: text.slice(0, cap), clamped: true, originalChars: text.length, elidedChars: text.length - cap };
  }
  // Two layout passes: the marker length depends on the elided count, and the
  // elided count depends on the marker length. Each pass re-derives both, so
  // the final layout fits the cap exactly and the marker names the exact
  // number of dropped characters.
  const head = Math.floor(cap * 0.6);
  let tail = cap - head; // provisional — the marker eats into this
  for (let pass = 0; pass < 2; pass++) {
    const elided = text.length - head - tail;
    const marker = `\n… [${elided} chars elided by compaction] …\n`;
    tail = Math.max(0, cap - head - marker.length);
  }
  const elided = text.length - head - tail;
  const marker = `\n… [${elided} chars elided by compaction] …\n`;
  const out = `${text.slice(0, head)}${marker}${tail > 0 ? text.slice(text.length - tail) : ""}`;
  // The loop above sizes head+marker+tail to ≤ cap; this guard is belt-and-braces.
  return {
    text: out.length <= cap ? out : out.slice(0, cap),
    clamped: true,
    originalChars: text.length,
    elidedChars: elided,
  };
}
