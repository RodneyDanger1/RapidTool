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
//       §5 Tier 3) render as a labeled advisory list. A reply that is not a
//       six-key STRING-ARRAY JSON object (unparseable, a missing key, a
//       non-array key, or a non-string/blank element) gets ONE bounded repair
//       re-prompt, then an honest CODED refusal ({ok:false, reason:"error",
//       code:"RT_E_VALIDATION"}) — the machine never fabricates a spec, and no
//       malformed element is silently dropped into a `[]` default.
//
//   PURE / DETERMINISTIC (keyless, safe anywhere):
//     parseExpandedSpecJson(text) — tolerant JSON parser/normalizer used by
//       expandBrief; also the public seam for callers that cache raw replies.
//       Normalization is deterministic: trim, drop empties, dedupe preserving
//       first occurrence, fixed six-key shape (missing keys -> []).
//     expandedSpecViolations(value) — the strict, deterministic envelope CHECK
//       over the six-key string-array shape (missing key / non-array key /
//       non-string-or-blank element; requirements needs ≥1 usable entry; extra
//       top-level keys are tolerated — see its doc). expandBrief refuses on a
//       violation; it validates the REPLY, never a claim that the model was
//       constrained.
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
import type { ErrorCode } from "./errors.ts";

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
  | {
      ok: false;
      reason: "not-configured" | "error";
      error?: string;
      /** Machine-readable class of the refusal (errors.ts). A non-conforming
       *  spec envelope carries RT_E_VALIDATION; a provider refusal forwards
       *  the provider's own RT_E_LLM_* code. */
      code?: ErrorCode;
    };

/** Prompt budget caps (documented so callers cannot be surprised by a cut).
 *  Over-budget briefs/policies are cut WITH an explicit truncation marker —
 *  a silent slice would hide evidence from the model.
 *
 *  fixes/348: the brief budget is the WHOLE structured brief a realistic
 *  product brief carries (the measured bakery brief is ~8 140 chars, so the old
 *  4 000-char cut dropped its menu/build/non-negotiable sections). Kept generous
 *  so no realistic brief is cut; a pathological one is still cut WITH the
 *  marker, never silently. */
export const EXPAND_BRIEF_MAX_CHARS = 48_000;
export const EXPAND_POLICY_MAX_CHARS = 240;
export const EXPAND_POLICY_MAX_COUNT = 12;
/** Prior-run lesson budget (fixes/98 §5 Tier 3): lesson rows are ≤ LESSON_TEXT_MAX
 *  chars by construction (322 X3 raised that cap 240→600), but callers may pass
 *  arbitrary strings — each line is capped + marked, and the list is capped + deduped.
 *  A6c (325 BUG E / 322 X3 §Coupling sweep): this prompt-side re-cap DELIBERATELY
 *  stays 240 while the record cap is 600 — record vs prompt are different budgets;
 *  a legal 500-char row is still cut here WITH the explicit [TRUNCATED] marker, and
 *  the record keeps the full payload. Comment parity only — no cap change. */
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

/** The six machine-checked keys of the expansion envelope, in canonical order.
 *  The spec graph feeds plan + oracle generation. A reply that omits or
 *  malforms any of them — missing key, non-array key, or a non-string/blank
 *  element — is REFUSED after one bounded repair; no malformed element is
 *  silently dropped into a `[]` default. */
export const EXPANDED_SPEC_KEYS = [
  "requirements",
  "edgeCases",
  "errorHandling",
  "typeSignatures",
  "dataFlow",
  "negativeConstraints",
] as const;

/** Normalize a parsed spec reply object into the fixed six-key shape. Pure. */
function normalizeExpandedSpec(rec: Record<string, unknown>): ExpandedSpec {
  return {
    requirements: cleanList(rec.requirements),
    edgeCases: cleanList(rec.edgeCases),
    errorHandling: cleanList(rec.errorHandling),
    typeSignatures: cleanList(rec.typeSignatures),
    dataFlow: cleanList(rec.dataFlow),
    negativeConstraints: cleanList(rec.negativeConstraints),
  };
}

/** Strip a ```json fence, JSON.parse, and require a plain object; null otherwise. */
function parseSpecReplyObject(text: string): Record<string, unknown> | null {
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
  return obj as Record<string, unknown>;
}

/**
 * Deterministic envelope check over a VALUE already parsed from a spec reply.
 * Returns the ordered list of violations ([expanded order]); `[]` means the
 * six-key envelope is conforming. This validates the REPLY — it is never a
 * claim that the model was constrained: the provider's `json` knob is a
 * `json_object` MODE HINT with no schema/grammar enforcement (see
 * DeepSeekCompleteOptions.json in llm/providers/deepseek.ts).
 *
 * Element rule (the defect this closes): every one of the six keys is an
 * array of plain non-empty STRINGS — `ExpandedSpec`, and the persisted
 * `Project.implementationSpec` every consumer reads (p6SynthesisChunkUserPrompt,
 * signatureFunctionNames, archCapabilities, the engine's dataFlow join;
 * types.ts:539-549). A non-string or blank element is a violation, because
 * cleanList would otherwise silently drop it and yield `[]`. An EXPLICIT empty
 * array `[]` is preserved as-is and is NOT a violation on the five
 * non-requirements keys — it is the model's stated answer, not a dropped
 * element; `requirements` alone must carry ≥1 usable entry. There is no
 * array-of-objects key, so a nested-object element is caught by the same
 * element rule (Case D).
 *
 * Extra top-level keys are deliberately TOLERATED: the six keys are a MINIMUM
 * shape, not an exact key set. The persisted implementationSpec record
 * legitimately carries provenance keys (`source`/`briefHash`/`createdAt`), and
 * codegen.server.ts re-validates that record with this same function — a
 * forbidden-extras rule would strand every cached spec.
 */
export function expandedSpecViolations(value: unknown): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return ["reply is not a JSON object"];
  }
  const rec = value as Record<string, unknown>;
  const out: string[] = [];
  for (const key of EXPANDED_SPEC_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(rec, key)) {
      out.push(`missing key "${key}"`);
      continue;
    }
    const field = rec[key];
    if (!Array.isArray(field)) {
      out.push(`"${key}" is not an array`);
      continue;
    }
    // Every element must be a usable string; name each offending index so the
    // violation is legible (and the repair re-prompt's caller can see it).
    const bad: number[] = [];
    field.forEach((el, i) => {
      if (typeof el !== "string" || el.trim() === "") bad.push(i);
    });
    if (bad.length > 0) {
      out.push(`"${key}" has non-string or blank entries at index ${bad.join(", ")}`);
    }
    if (key === "requirements" && cleanList(field).length === 0) {
      out.push('"requirements" has no usable entries');
    }
  }
  return out;
}

/**
 * Parse a DeepSeek JSON reply into an ExpandedSpec. Tolerant of ```json
 * fences and of missing/extra keys; normalizes every list via cleanList.
 * Returns null when the text is not JSON, not an object, or carries no
 * usable requirements (the one field a spec cannot live without).
 *
 * NOTE: this is the tolerant parser/normalizer seam. The STRICT envelope
 * check expandBrief enforces is `expandedSpecViolations` — a caller that
 * caches a raw reply and feeds it here still gets the legacy six-key floor
 * (missing keys -> []), so it must run the violation check itself if it
 * wants the refusal.
 */
export function parseExpandedSpecJson(text: string): ExpandedSpec | null {
  const rec = parseSpecReplyObject(text);
  if (rec === null) return null;
  const spec = normalizeExpandedSpec(rec);
  return spec.requirements.length === 0 ? null : spec;
}

/** Marker appended to any brief/policy that had to be cut at a budget cap —
 *  cuts are marked, never silent (crew.server.ts convention). */
const TRUNCATION_MARK = "\n…[TRUNCATED — input longer than the budget cap; the visible prefix governs]";

/** fixes/129 bounded repair line (research/99 §2): appended ONCE to a re-sent
 *  expansion prompt when the model returns an unparseable expansion payload.
 *  It re-states the exact envelope and forbids prose/fences. The repair is a
 *  single bounded re-prompt; a second non-conforming reply is an honest CODED
 *  refusal ({ok:false, reason:"error", code:"RT_E_VALIDATION",
 *  error:"model returned a non-conforming expansion payload: <violations>"}) —
 *  never a blind multi-retry and never a fabricated spec. */
export const EXPANSION_REPAIR_LINE =
  "Your previous reply was not a valid expansion payload. Reply with ONE JSON object with EXACTLY these six keys: " +
  '{"requirements": [...], "edgeCases": [...], "errorHandling": [...], "typeSignatures": [...], "dataFlow": [...], "negativeConstraints": [...]} ' +
  "- no prose, no markdown fences, no code blocks. Every array element must be a plain, non-empty string (no objects, no numbers, no nulls, no blank strings). requirements must be a NON-EMPTY array of 5-12 implementable sentences derived ONLY from the brief above (never invent features, platforms, dependencies, or error codes); every other array follows the field rules above.";

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
  const policyAll = (Array.isArray(policies) ? policies : [])
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      p.length > EXPAND_POLICY_MAX_CHARS
        ? `${p.slice(0, EXPAND_POLICY_MAX_CHARS).trimEnd()} …[TRUNCATED]`
        : p,
    );
  const policyShown = policyAll.slice(0, EXPAND_POLICY_MAX_COUNT);
  const policyDropped = policyAll.length - policyShown.length;
  const policyLines = [
    ...policyShown.map((p) => `- ${p}`),
    // W49/335-1: the COUNT cap cut is marked exactly like the char cap — the
    // module's own contract is "a silent slice would hide evidence from the model".
    ...(policyDropped > 0
      ? [
          `…[POLICIES-ELIDED: ${policyDropped} policy row(s) beyond the ${EXPAND_POLICY_MAX_COUNT} cap — not sent to the model]`,
        ]
      : []),
  ];
  const lessonAll = (Array.isArray(lessons) ? lessons : [])
    .filter((l): l is string => typeof l === "string")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l, i, a) => a.indexOf(l) === i) // dedupe, first occurrence wins
    .map((l) =>
      l.length > EXPAND_LESSON_MAX_CHARS
        ? `${l.slice(0, EXPAND_LESSON_MAX_CHARS).trimEnd()} …[TRUNCATED]`
        : l,
    );
  const lessonShown = lessonAll.slice(0, EXPAND_LESSON_MAX_COUNT);
  const lessonDropped = lessonAll.length - lessonShown.length;
  const lessonLines = [
    ...lessonShown.map((l) => `- ${l}`),
    ...(lessonDropped > 0
      ? [
          `…[LESSONS-ELIDED: ${lessonDropped} lesson row(s) beyond the ${EXPAND_LESSON_MAX_COUNT} cap — not sent to the model]`,
        ]
      : []),
  ];
  const lines = [
    "Expand the brief below into an EXHAUSTIVE, BUILD-READY implementation spec. The spec is consumed by a builder agent that must produce WORKING code with tests and docs — phrase every requirement and edge case so a test can observe and verify it.",
    "Reply with ONE JSON object with EXACTLY these six keys:",
    '{"requirements": ["..."], "edgeCases": ["..."], "errorHandling": ["..."], "typeSignatures": ["..."], "dataFlow": ["..."], "negativeConstraints": ["..."]}.',
    "Envelope shape (machine-checked, verbatim): the value of EACH of the six keys MUST be a JSON array of strings — never a bare string, object, number, or null; and every array element MUST be a plain, non-empty string (no numbers, no objects, no nulls, no blank strings). An omitted key, a non-array value, or a blank/non-string element is REFUSED; nothing is silently defaulted.",
    "Field rules:",
    "- requirements: 5-12 implementable sentences covering EVERY feature, user workflow, and hard constraint the brief states — none of the brief's asks may be dropped; each phrased so a test can verify it.",
    "- edgeCases: boundary, empty-input, duplicate, concurrency, timeout, offline/backend-down, plus the brief's own domain risks (e.g. same-day reroutes, HIPAA-safe notes, rate-limited search); each as a behavior a test must pin.",
    "- errorHandling: failure modes and the honest handling each needs (invalid input, backend down, partial write, timeout). Never invent error codes or APIs.",
    '- typeSignatures: one line per public function/component in TypeScript syntax, e.g. "createOrder(items: CartItem[]): Promise<Order>". COVERAGE (fixes/215d): emit at least one signature for EVERY requirement above — a requirement with no signature cannot be built later; never drop a feature the brief states.',
    "- dataFlow: the ordered steps data takes from raw input to persisted/output form, failure-path steps included (one line per step).",
    '- negativeConstraints: everything the brief forbids or implies must-not-do, each phrased as "DO NOT ...".',
    "- Every array entry is one plain, non-empty string: no markdown, no numbering prefixes, no blank strings, no numbers/objects/nulls.",
    "- requirements MUST be a NON-EMPTY array (5-12 entries); an empty requirements list is refused.",
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
 * a reply that is not a conforming six-key STRING-ARRAY object (unparseable,
 * or a parsed object with a missing key, a non-array key, or a non-string/blank
 * element) -> ONE bounded repair re-prompt (fixes/129, research/99 §2)
 * re-sending the prompt + EXPANSION_REPAIR_LINE; a second non-conforming reply
 * -> {ok:false, reason:"error", code:"RT_E_VALIDATION"} naming the violations —
 * never a fabricated spec and never a malformed element silently defaulted.
 */
type ExpansionCallResult =
  | { kind: "spec"; spec: ExpandedSpec }
  /** The reply was not a usable six-key spec object — the repair class. */
  | { kind: "nonconforming"; violations: string[] }
  | { kind: "failure"; result: ExpandBriefResult };

/** One expansion LLM call (flash, json:true, 90s budget). Returns a parsed
 *  spec, the deterministic envelope violations, or an honest failure result. */
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
    return {
      kind: "failure",
      result:
        res.reason === "not-configured"
          ? { ok: false, reason: "not-configured" }
          : {
              ok: false,
              reason: "error",
              error: res.error,
              ...(res.code ? { code: res.code } : {}),
            },
    };
  }
  // 185-H1: hostile/stub `{ ok:true, error }` is never a spec. Fail-close here
  // (provider lie) so expandBrief does NOT take the repair path.
  const dual = dualChannelFailDetail(res);
  if (dual) {
    return {
      kind: "failure",
      result: {
        ok: false,
        reason: "error",
        code: "RT_E_LLM_REJECTED",
        error: `expansion dual-channel response (${dual}) — never treat ok:true+error as a spec`,
      },
    };
  }
  const obj = parseSpecReplyObject(res.text);
  if (obj === null) return { kind: "nonconforming", violations: ["reply is not a JSON object"] };
  const violations = expandedSpecViolations(obj);
  if (violations.length > 0) return { kind: "nonconforming", violations };
  return { kind: "spec", spec: normalizeExpandedSpec(obj) };
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
  if (first.kind === "failure") return first.result; // provider failure — not the repair class
  if (first.kind === "spec") return { ok: true, spec: first.spec };
  // fixes/129 (research/99 §2): the non-conforming-envelope repair class — ONE
  // bounded re-prompt, then an honest, CODED refusal. The model saw only prose,
  // wrong JSON, or a partial six-key object; re-send the full prompt + the
  // strict envelope line once. A reply missing a machine-checked field — or
  // carrying a non-string/blank element in one — takes this path too, so a
  // partial spec is never accepted and no malformed element silently becomes
  // a `[]` default.
  const repaired = await expansionCall(`${user}\n\n${EXPANSION_REPAIR_LINE}`);
  if (repaired.kind === "failure") return repaired.result;
  if (repaired.kind === "spec") return { ok: true, spec: repaired.spec };
  return {
    ok: false,
    reason: "error",
    code: "RT_E_VALIDATION",
    error: `model returned a non-conforming expansion payload: ${repaired.violations.join("; ")}`,
  };
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
// PR-18 (A7 repair contract) — the PURE dedicated repair-agent SYSTEM prompt
// and the legal refusal-channel consumer contract.
//
// R2 §2.3: repair calls reused the generator persona while the user message
// asked for a `{"patch":{oldStr,newStr}}` delta — two contradictory output
// contracts, a plausible source of `envelope.unreadable` repairs. This prompt
// fixes ONLY the named defect, offers the delta FIRST and the full corrected
// module envelope SECOND, forbids success claims and check-weakening, and
// gives the model a LEGAL `{"refusal","reason"}` channel (a defect that is not
// present is not a repair — it is an honest refusal).
//
// PURE + deterministic: no key, no I/O; identical inputs ⇒ identical string.
//
// CONSUMER CONTRACT (codegen PR-19 wires it): a reply the consumer parses as a
// legal refusal is NOT an unreadable envelope — it records a coded
// `p6.synthesis.refused` and SKIPS the repair call. A refusal is never
// converted into a pass; it only replaces a wasted repair with an honest,
// coded stop.
//
// The advertised rules are drift-proof by test: prompt-engine.test.ts asserts
// every name in codegen's FORBIDDEN_PRIMITIVE_NAMES appears in the prompt and
// that each rule family is backed by a live validator — never enforce an
// unadvertised rule, never advertise an unenforced one (the repo's 215b
// principle).
// ---------------------------------------------------------------------------

/** The forbidden-primitive display names the validator enforces, mirrored from
 *  codegen.server.ts `FORBIDDEN_PRIMITIVE_NAMES`. The copy is deliberate:
 *  codegen imports prompt-engine, so importing it back would be a cycle. The
 *  PR-18 parity test asserts the two lists are equal, so they cannot drift. */
export const REPAIR_FORBIDDEN_PRIMITIVE_NAMES = [
  "eval",
  "Function",
  "import",
  // 353: mirrors codegen's addition — TS-runtime-only syntax under stripping.
  "enum",
  "process",
  "require",
  "globalThis",
  "window",
  "self",
  "fetch",
  "WebSocket",
  "XMLHttpRequest",
  "document",
  "localStorage",
  "indexedDB",
] as const;

/** The exact legal refusal reply a repair turn may return instead of an
 *  envelope — the `{"refusal","reason"}` channel (R2 §2.3). */
export const REPAIR_REFUSAL_ENVELOPE =
  '{"refusal":"defect not present","reason":"<quote the relevant module text>"}';

/** Every rule a repair reply must PRESERVE, each backed by a deterministic
 *  validator (the parity test links each to its validator). Advertised
 *  verbatim by `repairSystemPrompt()`. */
export const REPAIR_PRESERVED_RULES = [
  "export EXACTLY the required signatures and nothing more",
  // 353 (prompt contract): every repair reply the validator can refuse is
  // advertised here, so the model is never blind-sided by an unstated rule.
  // `validateSynthesisModule` (codegen.server.ts) is the enforcement point;
  // prompt-engine.test.ts links each rule below to its live validator.
  "bind every name the reply's `exports` list claims",
  "return one non-empty JSON object — no markdown fences, nothing before or after it",
  "zero imports/requires",
  `never reference a forbidden primitive (${REPAIR_FORBIDDEN_PRIMITIVE_NAMES.join(", ")})`,
  "never use Math.random (nondeterministic primitive)",
  "never inject a compiler/linter suppression pragma (@ts-ignore/@ts-nocheck/@ts-expect-error/eslint-disable)",
  "keep a .ts chunk JSX-free — no raw JSX elements and no `JSX.*` namespace type",
  "compute a money amount as unit price × quantity in integer minor units",
  "never redeclare a shared contract type the build injects (the canonical alias is authoritative)",
  "no planning prose in the module body",
  "await every async call",
  "never redeclare a name another chunk already exports",
  // fixes/349-P6: the three classes that reached emit and killed the product —
  // each has a live validator in codegen.server.ts (see prompt-engine.test.ts).
  "never write CommonJS module/exports residue or `export =` (the emitted tree is ESM)",
  "annotate EVERY function parameter and return type (no implicit any)",
  "keep the envelope within the module size bound (fit the output budget)",
] as const;

/**
 * The DEDICATED repair-agent system prompt (pure). Consumer: the P6 repair
 * call sites (codegen.server.ts) — it replaces the generator persona there so
 * the system and the `{"patch"}` user message no longer contradict.
 */
export function repairSystemPrompt(): string {
  return [
    "You are RapidTool's bounded repair agent. You are given a module that failed a specific, named defect.",
    "Fix ONLY that defect.",
    'If the defect is a local text replacement, return the delta FIRST: {"patch":{"oldStr":"<exact text copied from the quoted module — it must occur EXACTLY once>","newStr":"<the replacement text; empty deletes the matched text>"}}.',
    'Otherwise return the complete corrected module envelope: {"module":"...","exports":[...],"reqTrace":{...}}.',
    "You may not weaken, delete, or rename the checks you were given; you may not claim the repair succeeded; you may not add features.",
    `If the cited defect is not actually present in the module, return ${REPAIR_REFUSAL_ENVELOPE}.`,
    `RULES YOU MUST PRESERVE (each is validator-enforced; a repair that breaks one is refused): ${REPAIR_PRESERVED_RULES.join("; ")}.`,
    "Return JSON ONLY — the word json, one object, nothing before or after it.",
  ].join("\n");
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
