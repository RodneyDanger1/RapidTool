// ---------------------------------------------------------------------------
// prompt-engine.ts — hyper-prompt expansion + policy constraints
// (handoff pillar 3 + hyper-prompt engine pillar 6; fixes/64_pillars_prompt.md).
//
// Server-only at runtime — this module imports ./deepseek.server.ts; client
// modules may import its TYPES only, via `import type` (planning.ts pattern).
//
// Two halves:
//
//   KEYED (DeepSeek flash via completeDeepSeek json:true; honest
//     {ok:false, reason:"not-configured"} when DEEPSEEK_API_KEY is absent —
//     the same honesty floor as verify.server.ts / algo-tools.ts):
//     expandBrief(brief, policies?, lessons?) — expands a terse product brief
//       into an EXHAUSTIVE spec: {requirements, edgeCases, errorHandling,
//       typeSignatures, dataFlow, negativeConstraints}. The model derives
//       every field from the brief + policies alone (never invents
//       platforms/APIs/error codes); optional prior-run `lessons` (fixes/98
//       §5 Tier 3) render as a labeled advisory list. An unparseable reply
//       yields an honest {ok:false, reason:"error"} — the machine never
//       fabricates a spec.
//
//   PURE / DETERMINISTIC (keyless, safe anywhere):
//     parseExpandedSpecJson(text) — tolerant JSON parser/normalizer used by
//       expandBrief; also the public seam for callers that cache raw replies.
//       Normalization is deterministic: trim, drop empties, dedupe preserving
//       first occurrence, fixed six-key shape (missing keys -> []).
//     applyPolicies(spec, policies) — PURE injection of negative constraints
//       ('DO NOT use external ORMs' etc.) into spec.negativeConstraints.
//       Belt-and-braces over the LLM path: even if the model ignored the
//       policies, the final spec deterministically carries them.
//
// Determinism contract: for identical inputs every public function returns an
// identical object — no dates, no randomness, no shared mutable state.
// ---------------------------------------------------------------------------
import {
  completeDeepSeek,
  DEEPSEEK_LONG_TIMEOUT_MS,
  DEEPSEEK_MODELS,
  isDeepSeekConfigured,
} from "./deepseek.server.ts";
import { dualChannelFailDetail } from "./errors.ts";

/** The exhaustive expansion shape expandBrief emits and applyPolicies enriches. */
export type ExpandedSpec = {
  /** Concrete functional requirements (one implementable sentence each). */
  requirements: string[];
  /** Boundary/empty-input/duplicate/concurrency/timeout cases to handle. */
  edgeCases: string[];
  /** Failure modes + the honest handling each needs (never invented codes). */
  errorHandling: string[];
  /** One TypeScript signature line per public function/component. */
  typeSignatures: string[];
  /** Ordered steps data takes from raw input to persisted/output form. */
  dataFlow: string[];
  /** Forbidden behaviors, phrased "DO NOT ..." — model-derived + policy-injected. */
  negativeConstraints: string[];
};

export type ExpandBriefResult =
  | { ok: true; spec: ExpandedSpec }
  | { ok: false; reason: "not-configured" | "error"; error?: string };

/** Prompt budget caps (documented so callers cannot be surprised by a cut).
 *  Over-budget briefs/policies are cut WITH an explicit truncation marker —
 *  a silent slice would hide evidence from the model. */
export const EXPAND_BRIEF_MAX_CHARS = 4000;
export const EXPAND_POLICY_MAX_CHARS = 240;
export const EXPAND_POLICY_MAX_COUNT = 12;
/** Prior-run lesson budget (fixes/98 §5 Tier 3): lesson rows are ≤240 chars by
 *  construction (LESSON_TEXT_MAX), but callers may pass arbitrary strings —
 *  each line is capped + marked, and the list is capped + deduped. */
export const EXPAND_LESSON_MAX_CHARS = 240;
export const EXPAND_LESSON_MAX_COUNT = 12;

/**
 * Deterministic string-list normalization: only trimmed non-empty strings,
 * deduped on the trimmed form, first occurrence wins, input order kept.
 */
function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Parse a DeepSeek JSON reply into an ExpandedSpec. Tolerant of ```json
 * fences and of missing/extra keys; normalizes every list via cleanList.
 * Returns null when the text is not JSON, not an object, or carries no
 * usable requirements (the one field a spec cannot live without).
 */
export function parseExpandedSpecJson(text: string): ExpandedSpec | null {
  if (typeof text !== "string") return null;
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
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const rec = obj as Record<string, unknown>;
  const requirements = cleanList(rec.requirements);
  if (requirements.length === 0) return null;
  return {
    requirements,
    edgeCases: cleanList(rec.edgeCases),
    errorHandling: cleanList(rec.errorHandling),
    typeSignatures: cleanList(rec.typeSignatures),
    dataFlow: cleanList(rec.dataFlow),
    negativeConstraints: cleanList(rec.negativeConstraints),
  };
}

/** Marker appended to any brief/policy that had to be cut at a budget cap —
 *  cuts are marked, never silent (crew.server.ts convention). */
const TRUNCATION_MARK = "\n…[TRUNCATED — input longer than the budget cap; the visible prefix governs]";

/** fixes/129 bounded repair line (research/99 §2): appended ONCE to a re-sent
 *  expansion prompt when the model returns an unparseable expansion payload.
 *  It re-states the exact envelope and forbids prose/fences. The repair is a
 *  single bounded re-prompt; a second unparseable reply is an honest refusal
 *  ({ok:false, reason:"error", error:"model returned an unparseable expansion
 *  payload"}) — never a blind multi-retry and never a fabricated spec. */
export const EXPANSION_REPAIR_LINE =
  "Your previous reply was not a valid expansion payload. Reply with ONE JSON object with EXACTLY these six keys: " +
  '{"requirements": [...], "edgeCases": [...], "errorHandling": [...], "typeSignatures": [...], "dataFlow": [...], "negativeConstraints": [...]} ' +
  "- no prose, no markdown fences, no code blocks. requirements must be a NON-EMPTY array of 5-12 implementable sentences derived ONLY from the brief above (never invent features, platforms, dependencies, or error codes); every other array follows the field rules above.";

/** User-message builder: brief (capped, marked) + optional policies (capped,
 *  counted) + optional prior-run lessons (fixes/98 §5 Tier 3: a provenance-
 *  labeled advisory list, capped + counted like policies). Every input is
 *  normalized deterministically — identical inputs build an identical prompt. */
function expansionPrompt(
  brief: string,
  policies?: readonly string[],
  lessons?: readonly string[],
): string {
  const trimmedBrief = brief.trim();
  const briefCapped =
    trimmedBrief.length > EXPAND_BRIEF_MAX_CHARS
      ? `${trimmedBrief.slice(0, EXPAND_BRIEF_MAX_CHARS).trimEnd()}${TRUNCATION_MARK}`
      : trimmedBrief;
  const policyLines = (Array.isArray(policies) ? policies : [])
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      p.length > EXPAND_POLICY_MAX_CHARS
        ? `${p.slice(0, EXPAND_POLICY_MAX_CHARS).trimEnd()} …[TRUNCATED]`
        : p,
    )
    .slice(0, EXPAND_POLICY_MAX_COUNT)
    .map((p) => `- ${p}`);
  const lessonLines = (Array.isArray(lessons) ? lessons : [])
    .filter((l): l is string => typeof l === "string")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l, i, a) => a.indexOf(l) === i) // dedupe, first occurrence wins
    .slice(0, EXPAND_LESSON_MAX_COUNT)
    .map((l) =>
      l.length > EXPAND_LESSON_MAX_CHARS
        ? `${l.slice(0, EXPAND_LESSON_MAX_CHARS).trimEnd()} …[TRUNCATED]`
        : l,
    )
    .map((l) => `- ${l}`);
  const lines = [
    "Expand the brief below into an EXHAUSTIVE, BUILD-READY implementation spec. The spec is consumed by a builder agent that must produce WORKING code with tests and docs — phrase every requirement and edge case so a test can observe and verify it.",
    "Reply with ONE JSON object with EXACTLY these six keys:",
    '{"requirements": ["..."], "edgeCases": ["..."], "errorHandling": ["..."], "typeSignatures": ["..."], "dataFlow": ["..."], "negativeConstraints": ["..."]}.',
    "Field rules:",
    "- requirements: 5-12 implementable sentences covering EVERY feature, user workflow, and hard constraint the brief states — none of the brief's asks may be dropped; each phrased so a test can verify it.",
    "- edgeCases: boundary, empty-input, duplicate, concurrency, timeout, offline/backend-down, plus the brief's own domain risks (e.g. same-day reroutes, HIPAA-safe notes, rate-limited search); each as a behavior a test must pin.",
    "- errorHandling: failure modes and the honest handling each needs (invalid input, backend down, partial write, timeout). Never invent error codes or APIs.",
    '- typeSignatures: one line per public function/component in TypeScript syntax, e.g. "createOrder(items: CartItem[]): Promise<Order>". COVERAGE (fixes/215d): emit at least one signature for EVERY requirement above — a requirement with no signature cannot be built later; never drop a feature the brief states.',
    "- dataFlow: the ordered steps data takes from raw input to persisted/output form, failure-path steps included (one line per step).",
    '- negativeConstraints: everything the brief forbids or implies must-not-do, each phrased as "DO NOT ...".',
    "- Every array entry is one plain line: no markdown, no numbering prefixes, no empty strings.",
    "STRICT honesty + fidelity: derive EVERYTHING from the brief and the policies. Every requirement must trace to a sentence in the brief or a policy line; never invent platforms, dependencies, error codes, users, or features neither mentions. If the brief is vague, expand the faithful reading only and reflect the vagueness in edgeCases.",
    "Brief:",
    briefCapped,
  ];
  if (policyLines.length > 0) {
    lines.push(
      "Policy constraints (the build must obey these; reflect them in requirements and negativeConstraints):",
      ...policyLines,
    );
  }
  if (lessonLines.length > 0) {
    lines.push(
      "Known failure modes from prior runs (advisory — check the spec guards against these; they never override the brief or the policies):",
      ...lessonLines,
    );
  }
  return lines.join("\n");
}

/**
 * Hyper-prompt expansion (pillar 6): turn a terse brief into the exhaustive
 * spec shape above via one DeepSeek flash json:true call. Policies are fed
 * into the prompt so the model designs around them; applyPolicies() then
 * enforces them deterministically on the result. `lessons` (fixes/98 §5
 * Tier 3) are prior-run failure-mode rows — passed by the caller via
 * selectLessons() — rendered as an ADVISORY list; they never change gate
 * inputs or policy enforcement. Omitted lessons ⇒ byte-identical prompt.
 *
 * Honesty ladder: key absent -> not-configured BEFORE any network I/O;
 * empty/whitespace brief -> validation error before any network I/O;
 * unparseable model JSON -> ONE bounded repair re-prompt (fixes/129,
 * research/99 §2) re-sending the prompt + EXPANSION_REPAIR_LINE; a second
 * unparseable reply -> {ok:false, reason:"error"} — never a fabricated or
 * silently-substituted spec.
 */
type ExpansionCallResult = ExpandBriefResult | null; // null = unparseable payload

/** One expansion LLM call (flash, json:true, 90s budget). Returns the parsed
 *  spec, an honest failure result, or null when the payload was unparseable. */
async function expansionCall(prompt: string): Promise<ExpansionCallResult> {
  const res = await completeDeepSeek(prompt, {
    model: DEEPSEEK_MODELS.flash,
    json: true,
    maxTokens: 3000,
    // fixes/121: the 20s flash-tier default aborted 3000-token expansions
    // (3/3 backoff attempts timed out on the rental brief) — the expansion
    // gets the same 90s budget as P6 synthesis.
    timeoutMs: DEEPSEEK_LONG_TIMEOUT_MS,
    system:
      "You are RapidTool's hyper-prompt engine: you expand terse product briefs into exhaustive, honest, BUILD-READY implementation specs that a builder agent can turn into working, tested code with docs. Fidelity to the brief is your first duty — never add, drop, or soften a stated requirement. Return the single JSON object the user describes — no prose before or after it.",
  });
  if (!res.ok) {
    return res.reason === "not-configured"
      ? { ok: false, reason: "not-configured" }
      : { ok: false, reason: "error", error: res.error };
  }
  // 185-H1: hostile/stub `{ ok:true, error }` is never a spec. Fail-close here
  // (provider lie) so expandBrief does NOT take the unparseable-repair path.
  const dual = dualChannelFailDetail(res);
  if (dual) {
    return {
      ok: false,
      reason: "error",
      error: `expansion dual-channel response (${dual}) — never treat ok:true+error as a spec`,
    };
  }
  const spec = parseExpandedSpecJson(res.text);
  return spec === null ? null : { ok: true, spec };
}

export async function expandBrief(
  brief: string,
  policies?: readonly string[],
  lessons?: readonly string[],
): Promise<ExpandBriefResult> {
  if (!isDeepSeekConfigured()) return { ok: false, reason: "not-configured" };
  if (typeof brief !== "string" || !brief.trim()) {
    return { ok: false, reason: "error", error: "brief must be a non-empty string" };
  }
  const user = expansionPrompt(brief, policies, lessons);
  const first = await expansionCall(user);
  if (first !== null && !first.ok) return first; // provider failure — not the unparseable class
  if (first !== null && first.ok) return first;
  // fixes/129 (research/99 §2): unparseable-expansion repair class — ONE
  // bounded re-prompt, then an honest refusal. The model saw only prose /
  // wrong JSON; re-send the full prompt + the strict envelope line once.
  const repaired = await expansionCall(`${user}\n\n${EXPANSION_REPAIR_LINE}`);
  if (repaired !== null) return repaired;
  return { ok: false, reason: "error", error: "model returned an unparseable expansion payload" };
}

/**
 * Pure negative-constraint injection (pillar 3 policy half). Returns a NEW
 * spec (fresh object, fresh arrays — caller mutation never leaks back into
 * the input) whose negativeConstraints = model-derived constraints first,
 * then every policy string not already present (exact match on the trimmed
 * form, case-sensitive, caller order preserved). All other fields are copied
 * through unchanged. Deterministic: identical inputs -> identical outputs.
 */
export function applyPolicies(spec: ExpandedSpec, policies?: readonly string[]): ExpandedSpec {
  // Fail closed on hostile spec values (hand-built/junk rows): a non-object
  // spec passes through untouched; list fields that are not string arrays are
  // treated as empty so policy injection can never throw.
  if (spec === null || typeof spec !== "object") return spec as ExpandedSpec;
  const rec = spec as unknown as Record<string, unknown>;
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((p): p is string => typeof p === "string") : [];
  const incoming = (Array.isArray(policies) ? policies : [])
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter(Boolean);
  const merged = strList(rec.negativeConstraints);
  for (const p of incoming) {
    if (!merged.includes(p)) merged.push(p);
  }
  return {
    requirements: strList(rec.requirements),
    edgeCases: strList(rec.edgeCases),
    errorHandling: strList(rec.errorHandling),
    typeSignatures: strList(rec.typeSignatures),
    dataFlow: strList(rec.dataFlow),
    negativeConstraints: merged,
  };
}

// ---------------------------------------------------------------------------
// FusionRank-ranked lesson injection (fixes/98 §5 Tier 3): the top-k lesson
// rows for a brief — project-memory rows tagged "lesson" plus caller-mapped
// knowledge-store proven rows — ranked by the SAME FusionRank call the packet
// uses (algorithms.ts). expansionPrompt renders the result as the advisory
// "Known failure modes from prior runs" list; pass lessonLinesForBrief's
// output straight into expandBrief's `lessons`.
//
// PURE + deterministic: no key, no store I/O here (proven rows arrive
// pre-fetched by the caller via KnowledgeStore.injectProven — this module
// cannot statically import knowledge.ts without dragging node:fs into its
// surface), identical inputs rank identically. Advisory law: ranking never
// changes gate inputs; the lines only inform the expansion model.
// ---------------------------------------------------------------------------
// fixes/144 (D2): the pure lesson-ranking helpers moved to knowledge.ts so the
// engine's client-safe dynamic seam can reach them without dragging this
// module's static deepseek.server import into the client graph. Re-exported
// here so existing consumers (codegen/wild-mode/prompt-engine.test) compile
// unchanged — one definition site in knowledge.ts.
export { EXPAND_LESSON_RANK_LIMIT, lessonLinesForBrief, provenToLessonRow, rankBriefLessons } from "./knowledge.ts";
export type { RankableLessonRow, RankedLessonRow } from "./knowledge.ts";
