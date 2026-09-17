// ---------------------------------------------------------------------------
// codegen.server.ts — keyed P6 brief-faithful module synthesis (fixes/97
// P0-01 Part B, THE FINAL LEAPFROG CORE). Server-only.
//
// liveP6Synthesis(project) upgrades a deterministic P6 result (the honest
// NO-KEY placeholder module, sandbox.ts buildPhase6Module) into a
// brief-faithful CommonJS module under the one-key constraint set
// (LEAPFROG §12.3): one json:true synthesis call on deepseek-v4-pro + one
// bounded repair re-prompt + deterministic envelope validation + the EXISTING
// machine verify loop (verify.server.ts verifyAndFixServer — reused, never
// rebuilt).
//
// Pipeline (each step honest, each failure degrades to the deterministic
// floor — a run never strands and never fabricates a pass):
//   0. Not configured → return the SAME project reference (caller falls back
//      to the deterministic applyPhaseResult path).
//   1. Spec — reuse project.implementationSpec when its briefHash matches
//      fnv1a(brief); otherwise expandBrief() once. Persisted back onto the
//      returned project (closes the 87 S7 / 88 §7.2 orphan spec).
//   2. Synthesis — fixes/144 (M2 / S-01 T2, fixes/134 §4): CHUNKED SEQUENTIAL
//      synthesis replaces the ONE 60k-envelope call. The spec's typeSignatures
//      are grouped ≤8 per chunk in expand order (MetaGPT decomposition); ≤8
//      signatures on a KIND-ABSENT (undeclared/legacy, single-module-library
//      eligible) project ⇒ ONE chunk ⇒ the legacy byte-identical path below
//      (single pro call + bounded repair re-prompts + machine verify →
//      upgraded); fixes/148 (F1 — tree-trigger scope): every DECLARED
//      delivery kind ("app" = webapp / "tool" / "game") and every >8-signature
//      spec routes to the chunked tree REGARDLESS of signature count — a
//      ≤8-signature webapp brief must never fall into the single-module path
//      (fixes/145 M1=0 root cause); >8 signatures ⇒ one call PER chunk
//      (216 T0.1: the FLASH tier — fixes/125's "pro is stronger" premise is
//      inverted by V4.1-Flash; json:true, thinking:false — fixes/156 E1: a
//      structured json envelope needs OUTPUT budget, not chain-of-thought, so
//      pro reasoning is DISABLED instead of out-budgeted; maxTokens 32 000)
//      with the
//      shared brief + full req list + THAT chunk's
//      signatures + the earlier chunks' exported top-level names + reqTrace
//      (so later files call earlier exports by name in the assembled bundle),
//      deterministic per-file validation, deterministic assembly into
//      Project.generatedTree (per-file fnv1a hash + attempt:0) with
//      generatedSource = the assembled ENTRY file (each tree file wrapped in a
//      scope that binds the earlier files' exports — collision-free
//      concatenation: the entry evaluates and exposes the union of the tree's
//      exports even when per-file helper names collide; byte-identical to the
//      single-file source when the tree is one file). A chunk refusal keeps
//      the prior chunks' files on the returned project + records
//      p6.synthesis.refused naming the chunk index (honest partial — never a
//      fabricated full pass).
//   3. Deterministic validation — single-chunk (legacy) path: the envelope's
//      claimed exports must be real top-level names in the module; every
//      typeSignature function name must be exported (the mechanical brief-fit
//      floor — no LLM involved); the module must pass the FORBIDDEN primitive
//      scan (maskLiteralsAndComments so literals/comments never trip it) and
//      the p6-brief-fit pre-check (briefNounHits + identifierHits — code
//      identifiers, not prose). Chunked path: the same checks run PER FILE
//      against that chunk's own signatures; the brief-fit pre-acceptance runs
//      at tree level over the assembled entry (brief nouns legitimately spread
//      across files), so a per-file vocabulary gate would be wrong.
//   4. Machine verify — single-chunk (legacy) path only:
//      verifyAndFixServer(module, brief, {maxIterations:3}). status "passed"
//      is minted ONLY by the machine harness, never the model. Multi-chunk
//      trees record no machine-verified lastTest (honest: the tree machine-run
//      is the tree-run lane's step) — per-file deterministic validation is the
//      mechanical floor until then.
//   5. Honest state — on a pass the returned project carries
//      generatedSource = the verified module, lastTest {label:"tested",
//      evidenceHash}, the kind-"code" artifact "Generated module (LLM,
//      machine-verified)", a "verify" outcome artifact, the persisted
//      implementationSpec, and modelRoute "deepseek-flash" (the tier that
//      really synthesized it — expand/oracle are flash too). On ANY failure
//      (unparseable envelope ×2, validation, brief-fit, verify failed/error,
//      chunk refusal) the deterministic floor stands and a `p6.synthesis.refused`
//      warn log records the RT_E_* code — never a fabricated pass; a multi-chunk
//      refusal keeps the prior chunks' real files + generatedSource = the
//      assembled partial entry (honest partial). Every synthesis-model call
//      also stamps a bounded `p6.synthesis.attempt` journal event (chunk
//      index/count · attempt · timeoutMs · outcome ok/refused/timeout + the
//      model's refusal-text excerpt — fixes/153 P1) so a reader sees WHY each
//      call failed. A forceHuman P6
//      gate (failed template sandbox, R3/B-03) is never machine-cleared.
//
// Zero new runtime deps. Imported by engine.ts through a runtime dynamic
// import (TanStack import-protection: *.server.* must never reach the client
// bundle). Deps are injectable for tests (the repo's fake-injection
// precedent, sandbox.test.ts).
//
// Run: node --experimental-strip-types --test src/lib/codegen.server.test.ts
// ---------------------------------------------------------------------------
import { fnv1a } from "./algorithms.ts";
import { briefNounHits, identifierHits, maskLiteralsAndComments } from "./sandbox.ts";
import { applyStrReplace, type PatchRequest } from "./patch.ts";
import {
  completeDeepSeek,
  DEEPSEEK_MODELS,
  isDeepSeekConfigured,
  type DeepSeekCompleteOptions,
} from "./deepseek.server.ts";
import { expandBrief, EXPAND_LESSON_RANK_LIMIT, lessonLinesForBrief, type ExpandBriefResult } from "./prompt-engine.ts";
import { selectLessons } from "./knowledge.ts";
import { verifyAndFixServer, type VerifyOutcome } from "./verify.server.ts";
import type { ErrorCode } from "./errors.ts";
import type { LlmResult } from "./llm.ts";
import {
  emptyLedger,
  recordSpend,
  totalTokens,
  type TokenLedger,
} from "./token-ledger.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";
import type { Artifact, ArtifactKind, GeneratedTreeFile, JsonLog, PhaseId, Project } from "./types.ts";

// --- constants ---------------------------------------------------------------

/** Headroom for a module (≤ ~600 lines) + the JSON envelope (97 P0-01 §3.2). */
export const P6_SYNTH_MAX_TOKENS = 32_000;
/** Deterministic size guard on the returned module string (≈ 600 lines × 80). */
export const P6_MODULE_MAX_CHARS = 60_000;
// fixes/144 (M2) + fixes/150: the pro-tier chunk synthesis budget. The 90s
// expansion budget (DEEPSEEK_LONG_TIMEOUT_MS) is for brief expansion; a
// pro-tier chunk synthesis with thinking enabled (pre-fixes/156 E1) could
// legitimately run 2-4 minutes — a 90s abort starved every keyed journey
// (M3 evidence: RT_E_LLM_TIMEOUT chunk 1/N on both keyed runs). 240s keeps
// the abort honesty (a truly hung call still dies loudly) while letting
// real synthesis finish; fixes/156 E1 turns pro thinking OFF for the
// envelope (output budget, not CoT), which also shortens the wall clock.
export const P6_SYNTH_TIMEOUT_MS = 240_000;
/**
 * 216 (T0.1 — model-tier correction; supersedes fixes/125): the MAIN synthesis
 * call and its repair re-prompts run on the FLASH tier. The original fixes/125
 * rationale — "pro is a materially stronger coder" — is INVERTED as of
 * DeepSeek-V4.1-Flash (model card, 2026-09-10): flash wins every
 * agentic/coding axis against V4-Pro (DeepSWE v1.1 74.2 vs 62.7; Terminal-Bench
 * 2.1 90.6 vs 87.9; TB 4.0 31.2 vs 12.4) at lower cost. The cheap calls
 * (expandBrief in prompt-engine.ts, oracle generateCases in
 * verify.server.ts) were already flash. The route label (`modelRoute:
 * "deepseek-flash"`) is stamped by `upgraded()` the moment a synthesis ships —
 * the tier that really served the call, never a stale tier name.
 */
export const P6_SYNTH_MODEL = DEEPSEEK_MODELS.flash;
/** Brief budget in the synthesis user prompt (never silently cut — marked). */
const P6_BRIEF_MAX_CHARS = 2_000;
const TRUNCATION_MARK = "\n…[TRUNCATED — brief longer than the synthesis budget; the visible prefix governs]";

/**
 * Forbidden-primitive split (fixes/116 reliability repair). The sandbox's
 * FORBIDDEN_PRIMITIVES denylist bundles arbitrary-code-execution primitives
 * with zero-dep/zero-IO contract violations. That made a single accidental
 * `document`/`fetch`/`window` reference a hard refusal with no recovery path —
 * one of the 0/6 probe failure classes. Split them:
 *   - HARD (eval/Function/import): a code-execution / module-escape boundary.
 *     Never repaired — a model that emits these cannot be trusted to rewrite.
 *   - SOFT (process/require/globalThis/window/self/fetch/WebSocket/XMLHttpRequest/
 *     document/localStorage/indexedDB): a zero-deps/zero-IO contract violation
 *     that is NOT arbitrary code execution. One bounded repair re-prompt is safe
 *     (the model can rewrite to plain functions); if it persists, refuse honestly.
 * Union of HARD + SOFT == sandbox.ts FORBIDDEN_PRIMITIVES (byte-equivalent).
 */
const FORBIDDEN_HARD = /\b(?:eval|Function|import)\b/;
const FORBIDDEN_SOFT =
  /\b(?:process|require|globalThis|window|self|fetch|WebSocket|XMLHttpRequest|document|localStorage|indexedDB)\b/;

/**
 * fixes/215b: canonical display names of EVERY banned primitive — the single
 * source the synthesis system prompt quotes. Drift-proof by test: each name is
 * asserted to be matched by FORBIDDEN_HARD|FORBIDDEN_SOFT, and the system
 * prompt is asserted to name them all. Root cause this closes: the prompt's
 * rule 4 omitted `require`/`globalThis`/`self`/`XMLHttpRequest` while the
 * validator enforced them — a keyed chunk 2/4 refused on exactly `globalThis`,
 * a primative the model was never told to avoid.
 */
export const FORBIDDEN_PRIMITIVE_NAMES = [
  "eval",
  "Function",
  "import",
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

/** Classify a masked module for forbidden primitives (hard first). Pure. */
export function forbiddenPrimitiveHit(maskedSource: string): { hard: string | null; soft: string | null } {
  const hard = typeof maskedSource === "string" ? maskedSource.match(FORBIDDEN_HARD)?.[0] ?? null : null;
  const soft = typeof maskedSource === "string" ? maskedSource.match(FORBIDDEN_SOFT)?.[0] ?? null : null;
  return { hard, soft };
}

/**
 * 216f (T-15 / F-06): the non-determinism ban. The emitted
 * `research/eval-out/coffeehouse2home-property-ledger/src/generated/compute-rent-roll.ts:35,40,55`
 * minted entity ids with `Math.random()` inside a nominally deterministic
 * system — two identical runs produce different entities, so nothing about the
 * emitted product is reproducible. Matched against MASKED source (callers pass
 * `maskLiteralsAndComments` output, the `forbiddenPrimitiveHit` contract), so
 * the token inside a literal or comment is data, never a violation. Returns the
 * matched token or null. Pure, deterministic.
 */
const NONDETERMINISTIC_PRIMITIVE = /\bMath\s*\.\s*random\b/;

export function nondeterministicPrimitiveHit(maskedSource: string): string | null {
  if (typeof maskedSource !== "string") return null;
  return maskedSource.match(NONDETERMINISTIC_PRIMITIVE)?.[0] ?? null;
}

/** 216f (T-09): one prose line hit — 1-based line number + a bounded excerpt. */
export type ProseLineHit = { line: number; text: string };

/** Minimum whitespace-separated words a line needs to count as prose. */
const PROSE_MIN_WORDS = 4;
/** Minimum ASCII letters a line needs to count as prose (short interjections never trip). */
const PROSE_MIN_LETTERS = 15;
/** Parenthesised prose needs more signal (a call statement can look sentence-ish). */
const PROSE_SENTENCE_MIN_WORDS = 6;
const PROSE_SENTENCE_MIN_LETTERS = 30;
/** Max chars of the offending line kept in the refusal detail. */
const PROSE_EXCERPT_MAX = 80;
/**
 * Code-significant characters. A bare code-position line carrying ANY of these
 * cannot be prose: `foo = bar`, `{-`, `//`, `@dec` etc. Deliberately excludes
 * sentence punctuation (`. , : ; ! ? - ' "` are handled by the shape test) and
 * digits ("requirements 5,6,7" is prose). A plain string, NOT a regex, so no
 * escaping layer can widen the set by accident.
 */
const PROSE_CODE_CHARS = "()[]{}<>=|&+*_\\/@#$%^~";
/** Sentence-shaped ASCII line; parentheses are admitted but gated separately. */
const PROSE_LINE_SHAPE = /^[A-Za-z][A-Za-z0-9 ,.:;!?'"()-]*$/;

/**
 * 216f (T-09 / F-04): bare English prose written into a module body as code —
 * the 23-line LLM-deliberation leak observed shipping at
 * `research/eval-out/coffeehouse2home-property-ledger/src/generated/chunk-0.ts:340-362`
 * ("I'll write the code now."). Detection is lexical, not a parser (the
 * `typescript` devDep is not importable from this module — compile-check owns
 * that seam): a line counts as prose when, with comment content and
 * literal content blanked, it still carries ≥4 words / ≥15 letters of
 * sentence-shaped ASCII text and no code-significant character at all. No
 * legal top-level statement in the generated subset (functions, consts, object
 * literals, `module.exports` assigns, `'use strict';`) can match that shape —
 * prose-as-code always can.
 *
 * The masking here is deliberately LINE-SCOPED, not `maskLiteralsAndComments`:
 * the leaked blob's own deliberation quotes (`"implement every one"`) leave
 * stray quote characters in the text, and the module-global masker treats an
 * unpaired quote as an open literal — blanking every following line and
 * disarming the gate on the exact artifact it must catch (verified against
 * `chunk-0.ts:340-362`). So: single/double-quoted spans are matched within
 * their own line (an unpaired quote stays visible, matching the JS
 * same-line-literal rule); block comments and template literals carry across
 * lines because those are the only multi-line constructs legal in the emitted
 * subset. Pure, deterministic; returns every hit (1-based line numbers, order
 * kept).
 */
export function proseLineHits(source: string): ProseLineHit[] {
  if (typeof source !== "string" || !source) return [];
  const hits: ProseLineHit[] = [];
  const lines = source.split("\n");
  let inBlockComment = false;
  let inTemplate = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    let visible = "";
    let j = 0;
    let block: boolean = inBlockComment;
    let template: boolean = inTemplate;
    while (j < line.length) {
      const c = line[j]!;
      const next = line[j + 1];
      if (block) {
        if (c === "*" && next === "/") {
          block = false;
          visible += "  ";
          j += 2;
          continue;
        }
        visible += " ";
        j += 1;
        continue;
      }
      if (template) {
        if (c === "\\") {
          visible += "  ";
          j += 2;
          continue;
        }
        if (c === "`") {
          template = false;
        }
        visible += " ";
        j += 1;
        continue;
      }
      if (c === "/" && next === "/") {
        visible += " ".repeat(line.length - j);
        j = line.length;
        continue;
      }
      if (c === "/" && next === "*") {
        block = true;
        visible += "  ";
        j += 2;
        continue;
      }
      if (c === "`") {
        // Template literal: blank to the matching backtick on this line; no
        // match means the literal runs on into the following lines.
        let k = j + 1;
        let closed = -1;
        while (k < line.length) {
          if (line[k] === "\\") {
            k += 2;
            continue;
          }
          if (line[k] === "`") {
            closed = k;
            break;
          }
          k += 1;
        }
        if (closed === -1) {
          template = true;
          visible += " ".repeat(line.length - j);
          j = line.length;
          continue;
        }
        visible += " ".repeat(closed + 1 - j);
        j = closed + 1;
        continue;
      }
      if (c === "\\") {
        // Stray backslash in code position (legal code has none outside a
        // literal): blank it, so escaped-quote deliberation (`\"…\"` in the
        // leaked blob) reads as the prose it is instead of tripping the
        // code-char gate on punctuation the model emitted BY MISTAKE.
        visible += " ";
        j += 1;
        continue;
      }
      if (c === '"' || c === "'") {
        let k = j + 1;
        let closed = -1;
        while (k < line.length) {
          if (line[k] === "\\") {
            k += 2;
            continue;
          }
          if (line[k] === c) {
            closed = k;
            break;
          }
          k += 1;
        }
        if (closed === -1) {
          // Unpaired quote — a same-line literal is impossible, so this is
          // stray deliberation punctuation: keep it visible.
          visible += c;
          j += 1;
          continue;
        }
        visible += " ".repeat(closed + 1 - j);
        j = closed + 1;
        continue;
      }
      visible += c;
      j += 1;
    }
    inBlockComment = block;
    inTemplate = template;
    const t = visible.trim();
    if (t.length === 0) continue;
    const flat = t.replace(/([A-Za-z])'([A-Za-z])/g, "$1$2"); // "I'll write" → "Ill write"
    const hasParens = flat.includes("(") || flat.includes(")");
    const codeProbe = hasParens ? flat.replace(/[()]/g, "") : flat;
    // 216f (W2·R3 tightening): every code-significant char vetoes a line as
    // prose EXCEPT a bare slash. The real blob's residual evader (chunk-0.ts:342,
    // "flip/rental/field ops") carries `/` between words and no other code char,
    // so it slipped the old veto. A slash-only line now falls through to a
    // STRICTER sentence branch below (shape checked on slash-stripped text plus
    // sentence word/letter floors AND a sentence terminal) — no bare statement
    // of the emitted subset ends in `.`/`?`/`!` with ≥6 words / ≥30 letters.
    let codeHit = false;
    let slashOnly = true;
    for (const ch of codeProbe) {
      if (PROSE_CODE_CHARS.includes(ch)) {
        codeHit = true;
        if (ch !== "/") {
          slashOnly = false;
          break;
        }
      }
    }
    if (codeHit && !slashOnly) continue;
    // A slash never survives string/comment masking, so stripping it here can
    // only strip a code-position slash; the shape test stays meaningful.
    if (!PROSE_LINE_SHAPE.test(flat.replace(/\//g, ""))) continue;
    const words = flat.split(/\s+/).filter((w) => w.length > 0);
    const letters = (flat.match(/[A-Za-z]/g) ?? []).length;
    if (hasParens || codeHit) {
      // A call statement can look sentence-ish; require MORE signal and a
      // sentence terminal (`.`/`?`/`!`) no call expression ends with.
      if (words.length < PROSE_SENTENCE_MIN_WORDS) continue;
      if (letters < PROSE_SENTENCE_MIN_LETTERS) continue;
      if (!/[.?!]$/.test(flat)) continue;
    } else {
      if (words.length < PROSE_MIN_WORDS) continue;
      if (letters < PROSE_MIN_LETTERS) continue;
    }
    hits.push({ line: i + 1, text: line.trim().slice(0, PROSE_EXCERPT_MAX) });
  }
  return hits;
}

/**
 * Byte-stable system prompt (cache-hit economics, 90 §12.3). First line
 * contains the literal word "json" + a complete worked example of the
 * envelope (DeepSeek JSON-output contract, [W-JSON] fixes/97 §W).
 */
export function p6SynthesisSystemPrompt(): string {
  return [
    "You are RapidTool's P6 code generator. You implement ONE TypeScript-style CommonJS module",
    "that satisfies the brief and the spec below. Return a single JSON object — the word json,",
    "exactly this envelope, no markdown fences, nothing before or after:",
    '{"module":"...complete module source as one string...","exports":["f1","f2"],"reqTrace":{"req-1":"f1"}}',
    "Worked example (shape only — the content is yours):",
    '{"module":"function add(a, b) { return a + b; }\\nmodule.exports.add = add;","exports":["add"],"reqTrace":{"req-1":"add"}}',
    "RULES (all mandatory):",
    // 216f (T-10 / F-08): the export-ceiling rule and the requirement list must
    // be CONSISTENT. The old pair ("export exactly these ... nothing more" +
    // "implement every requirement") was unsatisfiable on multi-domain briefs —
    // the model said so itself at chunk-0.ts:350. The ceiling now scopes every
    // file to its OWN listed signatures, requirement duty is scoped to what
    // those signatures cover, and hidden logic behind non-exported names is
    // explicitly forbidden (that was the leak's failed workaround).
    "1. Export EXACTLY the functions the spec's typeSignatures name — nothing more, nothing less. When the project is generated as several files, each file exports ONLY its own listed signatures: implement every requirement those listed signatures cover, never hide a requirement's logic behind non-exported helpers, and never add functions the list does not name.",
    // 216f (T-15): the validator refuses Math.random — the prompt must advertise
    // it (215b drift-proof principle: never enforce a rule the model was not told).
    "2. Zero imports, zero requires, zero external deps. Plain functions only. Assign module.exports. Never use Math.random() or any other non-deterministic primitive (validator-enforced): ids and values must derive deterministically from the inputs so two identical runs produce identical results.",
    "3. Full JSDoc on every exported function.",
    `4. Never reference these forbidden primitives anywhere in the module (validator-enforced): ${FORBIDDEN_PRIMITIVE_NAMES.join(", ")}.`,
    "5. Mark each requirement you implement with a \"// req-N\" comment on the implementing function.",
    "6. Never test rejection paths inside the module; guards are behavior, not bugs.",
    "7. Do not invent features the brief does not state. Do not soften or drop a stated requirement.",
    // 216f (T-09): the prose-in-code refusal is advertised too — the leaked
    // 23-line deliberation (F-04) shipped because nothing told the model that
    // planning prose in the module body is a refusal, not a style choice.
    "8. Write CODE only — never emit planning prose, deliberation, or \"I'll write the code now\" into the module (validator-enforced): every line must be a real JavaScript statement.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// T-107.1 (216r · W7-L1): the patch (str_replace) repair level.
//
// `patch.ts` (W4 core, 391 lines) is the surgical edit primitive: ONE textual
// replacement or a coded refusal (unique-match contract; opt-in graded fuzzy;
// diff-as-result). This section is the INTEGRATION — a bounded patch repair
// re-prompt for the LOCALIZED defect classes (soft forbidden primitive /
// non-deterministic primitive / prose-in-code), parsed into a `PatchRequest`,
// applied via `applyStrReplace` against the module the model just produced for
// THIS file (one chunk = one emitted tree file), and revalidated by the
// existing deterministic validator (`validateSynthesisModule`) before
// acceptance.
//
// Doctrine (restated from patch.ts, unchanged): refusal-default — a
// multi-match, a no-match, a no-op or a malformed request REFUSES with its
// code and the legacy full-rewrite repair path runs UNCHANGED (prompt bytes
// included). Fuzzy is NOT enabled in this wire: the graded level is opt-in by
// contract, and auto-accepting a fuzzy delta into the emitted artifact would
// be a guess into a write. Binding / missing-signature defects are not
// localized text edits and keep the legacy path. Every landed delta is
// recorded (`p6.repair.delta`, structured JSON detail); every refusal is
// recorded (`p6.repair.patch.refused`, coded).
// ---------------------------------------------------------------------------

/** Cap on the exact-source lines one patch excerpt window carries. */
export const PATCH_REPAIR_WINDOW_MAX_LINES = 24;
/** Cap on the chars one patch excerpt window carries. */
export const PATCH_REPAIR_WINDOW_MAX_CHARS = 1600;
/** Cap on the excerpt windows one patch re-prompt carries (defect clusters). */
export const PATCH_REPAIR_MAX_WINDOWS = 3;
/** Cap on the unified-diff chars a `p6.repair.delta` record carries. */
export const PATCH_REPAIR_DIFF_MAX = 800;

/** One exact-source window of the previous module, quoted to the model so a
 *  delta's `oldStr` can be copied character-for-character. */
export type PatchExcerptWindow = { firstLine: number; lastLine: number; text: string };

/** 1-based line numbers carrying `needle` (capped, order kept). Pure and
 *  total: non-strings and an empty needle yield []. */
export function tokenLineNumbers(source: unknown, needle: unknown, cap = 6): number[] {
  if (typeof source !== "string" || typeof needle !== "string" || needle.length === 0) return [];
  const out: number[] = [];
  const limit = Number.isFinite(cap) ? Math.max(1, Math.floor(cap as number)) : 6;
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]!.includes(needle)) {
      out.push(i + 1);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Exact-source excerpt windows around 1-based line numbers: every hit line is
 * widened by `ctx` lines, adjacent/overlapping windows merge, and the result is
 * capped (≤ PATCH_REPAIR_MAX_WINDOWS windows; ≤ PATCH_REPAIR_WINDOW_MAX_LINES
 * lines and ≤ PATCH_REPAIR_WINDOW_MAX_CHARS chars each — whole lines only,
 * never a truncated line). `text` is the module's own lines joined verbatim —
 * never reflowed, never whitespace-collapsed — so a model can copy an exact
 * `oldStr` from it. Pure and total: garbage line numbers are ignored and an
 * out-of-range line never fabricates text.
 */
export function patchExcerptWindows(
  source: unknown,
  lines: readonly number[],
  ctx = 1,
): { windows: PatchExcerptWindow[]; omittedLines: number } {
  if (typeof source !== "string" || source.length === 0) return { windows: [], omittedLines: 0 };
  const src = source.split("\n");
  const hits = [
    ...new Set(
      (Array.isArray(lines) ? lines : []).filter(
        (n): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= src.length,
      ),
    ),
  ].sort((a, b) => a - b);
  if (hits.length === 0) return { windows: [], omittedLines: 0 };
  const wanted: { from: number; to: number }[] = [];
  for (const line of hits) {
    const from = Math.max(1, line - ctx);
    const to = Math.min(src.length, line + ctx);
    const last = wanted[wanted.length - 1];
    if (last && from <= last.to + 1) last.to = Math.max(last.to, to);
    else wanted.push({ from, to });
  }
  const kept = wanted.slice(0, PATCH_REPAIR_MAX_WINDOWS);
  let omitted = wanted.length - kept.length;
  const windows: PatchExcerptWindow[] = [];
  for (const w of kept) {
    let to = Math.min(w.to, w.from + PATCH_REPAIR_WINDOW_MAX_LINES - 1);
    if (w.to > to) omitted += w.to - to;
    let text = src.slice(w.from - 1, to).join("\n");
    while (to > w.from && text.length > PATCH_REPAIR_WINDOW_MAX_CHARS) {
      omitted += 1;
      to -= 1;
      text = src.slice(w.from - 1, to).join("\n");
    }
    windows.push({ firstLine: w.from, lastLine: to, text });
  }
  return { windows, omittedLines: omitted };
}

/** A parsed patch (delta) envelope — the model's bounded `str_replace` block.
 *  `fuzzy` rides through VERBATIM: `applyStrReplace` re-validates it at
 *  runtime (a malformed level refuses; it is never silently defaulted). */
export type PatchRepairEnvelope = { oldStr: string; newStr: string; fuzzy?: unknown };

/**
 * Parse a model reply into the patch (delta) envelope
 * `{"patch":{"oldStr":"…","newStr":"…"[,"fuzzy":{"threshold":n}]}}`. Tolerant
 * of ```json fences (parseSynthesisEnvelope precedent). Returns null when the
 * reply is NOT a patch envelope — the caller then keeps the legacy
 * module-envelope repair path. Total: non-strings, garbage JSON, a missing
 * block and a blank/empty `oldStr` are all null, never a throw.
 */
export function parseSynthesisPatchEnvelope(text: unknown): PatchRepairEnvelope | null {
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
  const block = (obj as Record<string, unknown>).patch;
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  const b = block as Record<string, unknown>;
  const oldStr = typeof b.oldStr === "string" ? b.oldStr : "";
  const newStr = typeof b.newStr === "string" ? b.newStr : null;
  if (oldStr.length === 0 || newStr === null) return null;
  return { oldStr, newStr, ...(b.fuzzy !== undefined ? { fuzzy: b.fuzzy } : {}) };
}

/** The structured delta record a landed patch carries (log + repair result). */
export type PatchDeltaRecord = {
  path: string;
  kind: "exact" | "fuzzy";
  score: number;
  threshold: number | null;
  matches: number;
  removedLines: number;
  addedLines: number;
  unified: string;
};

/** The `p6.repair.delta` event (structured JSON detail). This is the ONE codec
 *  shared by the producer (this module) and the reader
 *  (`headless.ts repairPatchRecords`) — keep the two in step. */
export function patchDeltaLogEntry(record: PatchDeltaRecord): JsonLog {
  return {
    ts: Date.now(),
    phase: 6 as PhaseId,
    level: "info",
    event: "p6.repair.delta",
    detail: JSON.stringify({ ...record, unified: record.unified.slice(0, PATCH_REPAIR_DIFF_MAX) }),
  };
}

/** The `p6.repair.patch.refused` event (coded + bounded) — logged whenever the
 *  delta path did not land and the legacy full-rewrite repair takes over. */
export function patchRefusalLogEntry(detail: string, path?: string): JsonLog {
  const clean = typeof detail === "string" && detail.trim() ? detail.replace(/\s+/g, " ").trim() : "unknown";
  return {
    ts: Date.now(),
    phase: 6 as PhaseId,
    level: "warn",
    event: "p6.repair.patch.refused",
    detail: `${path ? `${path} · ` : ""}${clean.slice(0, 400)}`,
  };
}

/** T-107.1 (216r): the patch-repair opt-in for one synthesis call. */
export type PatchRepairOptions = {
  /** The tree path this module will be emitted at (log records only). */
  path?: string;
  /** Bounded log sink — the caller's attempt accumulator (200-entry cap). */
  log?: (entry: JsonLog) => void;
};

/**
 * 216r (W9-L2 · DEFECT 1): raw-source line numbers carrying a CODE occurrence
 * of `token` — the masked↔raw line map the patch path needs.
 *
 * `maskLiteralsAndComments` replaces every masked span with SAME-LENGTH spaces,
 * so masked and raw CHARACTER offsets stay aligned — but the newlines inside a
 * block comment (i.e. every JSDoc'd module, the system-prompt-mandated shape)
 * are destroyed (W9-L2 repro: raw 38 lines → masked 27). Masked line numbers
 * therefore named the wrong raw lines, `patchableDefect`'s raw-line filter
 * emptied, and the patch path never fired for the common case (the W8-L5
 * defect). This walks every masked occurrence of `token` — an occurrence
 * exists in the masked text iff the token sits in CODE, never inside a masked
 * literal/comment — and maps its character offset onto the raw line that
 * offset falls on. A line is kept only when its raw text really carries the
 * token, so every excerpted window quotes a copyable occurrence. Capped at
 * `cap` line numbers, order kept, duplicates dropped. Pure and total: garbage
 * arguments yield [].
 */
function codeTokenLineNumbers(source: unknown, masked: unknown, token: unknown, cap = 6): number[] {
  if (typeof source !== "string" || typeof masked !== "string" || typeof token !== "string" || token.length === 0) {
    return [];
  }
  const limit = Number.isFinite(cap) ? Math.max(1, Math.floor(cap)) : 6;
  const rawLineStarts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "\n") rawLineStarts.push(i + 1);
  }
  const srcLines = source.split("\n");
  const out: number[] = [];
  let from = 0;
  while (out.length < limit) {
    const at = masked.indexOf(token, from);
    if (at === -1) break;
    from = at + 1;
    // Greatest raw line start ≤ at (binary search; both strings share offsets).
    let lo = 0;
    let hi = rawLineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (rawLineStarts[mid]! <= at) lo = mid;
      else hi = mid - 1;
    }
    const lineNo = lo + 1;
    if ((srcLines[lineNo - 1] ?? "").includes(token) && out[out.length - 1] !== lineNo) out.push(lineNo);
  }
  return out;
}

/** The localized defect a patch can fix, or null when the defect class is not
 *  a bounded text edit (binding / missing-signature / envelope classes keep the
 *  legacy path untouched). Priority mirrors the legacy repair dispatch
 *  (unbound > soft-forbidden > missing-signature > non-deterministic > prose).
 */
function patchableDefect(input: {
  source: string;
  masked: string;
  softToken: string | null;
  unbound: readonly string[];
  missingSig: readonly string[];
  nondet: string | null;
  prose: readonly ProseLineHit[];
}): { defect: string; lines: number[] } | null {
  if (input.unbound.length > 0) return null;
  if (input.softToken !== null) {
    const token = input.softToken;
    // 216r (W9-L2 · DEFECT 1): RAW line numbers via the masked↔raw offset map
    // — masked line numbers drift on any JSDoc'd module and used to empty this
    // candidate list (the patch path never fired for the common case).
    const lines = codeTokenLineNumbers(input.source, input.masked, token);
    if (lines.length === 0) return null;
    return {
      defect: `the module uses a forbidden primitive: \`${token}\` (the zero-dep / zero-IO contract forbids it)`,
      lines,
    };
  }
  if (input.missingSig.length > 0) return null;
  if (input.nondet !== null) {
    const token = input.nondet;
    // 216r (W9-L2 · DEFECT 1): same raw-line map as the soft-token branch.
    const lines = codeTokenLineNumbers(input.source, input.masked, token);
    if (lines.length === 0) return null;
    return { defect: `the module uses a non-deterministic primitive: \`${token}\``, lines };
  }
  if (input.prose.length > 0) {
    const lines = input.prose.map((h) => h.line);
    return {
      defect: `the module body contains English prose (planning text, not JavaScript) at line(s) ${lines.join(", ")}`,
      lines,
    };
  }
  return null;
}

/**
 * T-107.1 (216r · W7-L1): ONE patch-repair attempt for one file. Offers the
 * bounded delta first (`p6SynthesisPatchRepairPrompt` quotes the exact current
 * source), applies a returned delta via `applyStrReplace` against the module
 * the model just produced, and revalidates the patched module with the
 * EXISTING deterministic validator. Returns the patched envelope on a landed
 * delta, or null on every non-landing outcome (no excerpt, a non-delta reply,
 * a coded `applyStrReplace` refusal, a patched module that still fails
 * validation, a failed model call) — the caller's legacy full-rewrite repair
 * then runs UNCHANGED. A landed delta and every refusal are logged through the
 * caller's bounded sink. Never throws on garbage replies.
 */
async function attemptPatchRepair(input: {
  previous: SynthesisEnvelope;
  defect: string;
  lines: readonly number[];
  signatureNames: readonly string[];
  completeCall: P6SynthesisDeps["complete"];
  opts: DeepSeekCompleteOptions;
  treeFailure?: string;
  path?: string;
  log?: (entry: JsonLog) => void;
}): Promise<SynthesisEnvelope | null> {
  const excerpt = patchExcerptWindows(input.previous.module, input.lines);
  if (excerpt.windows.length === 0) return null;
  const reply = await input.completeCall(
    p6SynthesisPatchRepairPrompt(input.defect, excerpt.windows, input.treeFailure),
    input.opts,
  );
  if (!reply.ok) {
    input.log?.(
      patchRefusalLogEntry(
        `RT_E_LLM_REJECTED · the patch repair call did not succeed (${reply.error ?? reply.reason ?? "unknown"})`,
        input.path,
      ),
    );
    return null;
  }
  const delta = parseSynthesisPatchEnvelope(reply.text);
  if (delta === null) return null; // not a delta reply — the legacy full-rewrite repair follows
  const request: PatchRequest = {
    oldStr: delta.oldStr,
    newStr: delta.newStr,
    ...(delta.fuzzy !== undefined ? { fuzzy: delta.fuzzy as PatchRequest["fuzzy"] } : {}),
  };
  const applied = applyStrReplace(input.previous.module, request);
  if (!applied.ok) {
    input.log?.(patchRefusalLogEntry(`${applied.code} · ${applied.error}`, input.path));
    return null;
  }
  const reValidated = validateSynthesisModule(applied.text, input.previous.exports, input.signatureNames);
  if (!reValidated.ok) {
    input.log?.(
      patchRefusalLogEntry(
        `patched module still fails validation — ${reValidated.code} · ${reValidated.error}`,
        input.path,
      ),
    );
    return null;
  }
  input.log?.(
    patchDeltaLogEntry({
      path: input.path ?? "",
      kind: applied.kind,
      score: applied.score,
      threshold: applied.threshold,
      matches: applied.matches,
      removedLines: applied.diff.removedLines,
      addedLines: applied.diff.addedLines,
      unified: applied.diff.unified,
    }),
  );
  return { module: applied.text, exports: [...input.previous.exports], reqTrace: { ...input.previous.reqTrace } };
}

/**
 * fixes/144 (M3-2): cap on the optional tree-run failure context appended to
 * a bounded repair re-prompt (the tree-run lane's own verdict tails are
 * already VERDICT_TAIL_MAX-capped at 1500; this is defense-in-depth for any
 * caller-supplied string).
 */
export const REPAIR_TREE_FAILURE_TAIL_MAX = 1500;

/**
 * fixes/144 (M3-2): the optional tree-failure tail block for repair
 * re-prompts. When the caller supplies tree-run failure context (failing file
 * path + first not-ok tail — the M4 journey driver's synthesize-or-repair
 * cycle), append it as a deterministic, whitespace-collapsed, bounded block
 * so the model sees WHY the tree failed. Omitted (or blank) context returns
 * "" — the no-context repair prompt stays byte-identical to the legacy text.
 */
function repairTreeFailureTail(treeFailure?: string): string {
  const t =
    typeof treeFailure === "string" ? treeFailure.replace(/\s+/g, " ").trim() : "";
  if (!t) return "";
  return `\n\nTree-run failure context (failing file + first not-ok tail):\n${t.slice(0, REPAIR_TREE_FAILURE_TAIL_MAX)}`;
}

/** Repair re-prompt after an unparseable envelope (audit-88 bounded-retry pattern). */
export function p6SynthesisRepairPrompt(treeFailure?: string): string {
  return [
    "Your previous reply was not valid JSON with the required envelope.",
    'Return JSON ONLY: {"module":"<complete module source as one string>","exports":["f1"],"reqTrace":{"req-1":"f1"}}.',
    "Same rules as before: exact typeSignature exports, zero imports, JSDoc, // req-N markers,",
    "no forbidden primitives, no rejection-path tests, no markdown fences.",
  ].join("\n") + repairTreeFailureTail(treeFailure);
}

/**
 * Repair re-prompt for the claimed-exports-not-bound failure class
 * (fixes/116): the envelope's `exports` listed names the module never bound
 * as top-level declarations or `module.exports.<name>` assignments. Re-prompt
 * with the EXACT missing names so the model knows precisely what to bind.
 */
export function p6SynthesisExportRepairPrompt(
  missing: readonly string[],
  treeFailure?: string,
): string {
  const names = [...new Set(missing.filter((n) => typeof n === "string" && n.trim()))];
  return [
    "Your previous module's envelope claimed exports that are not actually bound as top-level names.",
    `Missing bindings (define each as a real function AND assign module.exports.<name>): ${names.join(", ") || "(none listed)"}.`,
    'Return JSON ONLY with the SAME envelope: {"module":"<complete corrected module source>","exports":[...],"reqTrace":{...}}.',
    "For EVERY missing name: declare the function, then assign it with module.exports.<name> = <name>. List it again in exports.",
    "Same rules as before: exact typeSignature exports, zero imports, JSDoc, // req-N markers, no forbidden primitives, no markdown fences.",
  ].join("\n") + repairTreeFailureTail(treeFailure);
}

/**
 * Repair re-prompt for a SOFT forbidden primitive (zero-dep/zero-IO contract
 * violation — NOT eval/Function/import). Names the exact offending token so
 * the model can rewrite it to a plain function.
 */
export function p6SynthesisForbiddenRepairPrompt(token: string, treeFailure?: string): string {
  return [
    `Your module used a forbidden primitive: \`${token}\`.`,
    "Rewrite it with plain functions only — no process/require/globalThis/window/self/fetch/WebSocket/XMLHttpRequest/document/localStorage/indexedDB/eval/Function/import.",
    'Return JSON ONLY with the SAME envelope: {"module":"<complete corrected module source>","exports":[...],"reqTrace":{...}}.',
    "Same rules as before: exact typeSignature exports, zero imports, JSDoc, // req-N markers, no markdown fences.",
  ].join("\n") + repairTreeFailureTail(treeFailure);
}

/**
 * 216f (T-15 / F-06): repair re-prompt for a non-deterministic primitive the
 * validator refused (`Math.random` and friends). Names the exact token so the
 * model rewrites it deterministically (ids derived from inputs/counters).
 * ONE bounded attempt, mirroring the soft-forbidden class; a repeat is refused.
 */
export function p6SynthesisNondeterministicRepairPrompt(token: string, treeFailure?: string): string {
  return [
    `Your module used a non-deterministic primitive: \`${token}\`.`,
    "Rewrite it deterministically: derive ids/values from the inputs (caller-supplied ids, counters, stable hashes of input fields). Two identical runs must produce identical results — never mint randomness.",
    'Return JSON ONLY with the SAME envelope: {"module":"<complete corrected module source>","exports":[...],"reqTrace":{...}}.',
    "Same rules as before: exact typeSignature exports (nothing more, nothing less), zero imports, JSDoc, // req-N markers, no forbidden primitives, no markdown fences.",
  ].join("\n") + repairTreeFailureTail(treeFailure);
}

/**
 * 216f (T-09 / F-04): repair re-prompt for prose-in-code the validator refused
 * — the module body carried sentence-shaped English (LLM deliberation),
 * not code. Names the offending 1-based line numbers + a bounded excerpt so
 * the model DELETES the prose rather than paraphrasing it into new prose. ONE
 * bounded attempt; a repeat is refused (RT_E_VALIDATION).
 */
export function p6SynthesisProseRepairPrompt(hits: readonly ProseLineHit[], treeFailure?: string): string {
  const rows = Array.isArray(hits) ? hits : [];
  const lines: number[] = [];
  for (const h of rows) {
    if (h && typeof h.line === "number" && Number.isFinite(h.line) && !lines.includes(h.line)) {
      lines.push(h.line);
      if (lines.length >= 6) break;
    }
  }
  const first = rows.find((h) => h && typeof h.text === "string" && h.text.trim() !== "");
  return [
    "Your previous reply was not code: it contained English prose sentences written into the module body — planning/deliberation text, not JavaScript.",
    `Prose was detected at line(s): ${lines.join(", ") || "(unknown)"}${first ? ` — e.g. ${JSON.stringify(first.text)}` : ""}.`,
    "Rewrite the module as CODE ONLY: delete every prose sentence entirely — do not rephrase it, do not move it into a comment or a string, do not explain. Every line of the module must be a real JavaScript statement.",
    'Return JSON ONLY with the SAME envelope: {"module":"<complete corrected module source>","exports":[...],"reqTrace":{...}}.',
    "Same rules as before: exact typeSignature exports (nothing more, nothing less), zero imports, JSDoc, // req-N markers, no forbidden primitives, no markdown fences.",
  ].join("\n") + repairTreeFailureTail(treeFailure);
}

/**
 * T-107.1 (216r · W7-L1): the patch-first repair re-prompt. It carries the
 * named defect plus the EXACT current source windows (whole lines, verbatim)
 * so a returned `oldStr` can be copied character-for-character, and it offers
 * the two legal reply shapes — the bounded str_replace delta first, the legacy
 * full corrected envelope as the alternative. Deterministic bytes for a given
 * (defect, windows, treeFailure); the quoted windows are captured source, so
 * unlike the sibling repair prompts this one is self-contained (the model
 * needs no memory of its previous reply to copy an exact oldStr).
 */
export function p6SynthesisPatchRepairPrompt(
  defect: string,
  windows: readonly PatchExcerptWindow[],
  treeFailure?: string,
): string {
  const named = typeof defect === "string" ? defect.replace(/\s+/g, " ").trim() : "";
  const blocks: string[] = [];
  for (const w of Array.isArray(windows) ? windows : []) {
    if (!w || typeof w.text !== "string" || w.text.length === 0) continue;
    blocks.push(
      `--- lines ${w.firstLine}-${w.lastLine} (line numbers are for orientation only — they are NOT part of the text) ---\n${w.text}\n--- end lines ${w.firstLine}-${w.lastLine} ---`,
    );
  }
  return [
    `Your previous module was refused by the deterministic validator: ${named || "(defect unnamed)"}.`,
    "Fix it with ONE bounded replacement instead of rewriting the module. The exact current source is quoted below — a replacement's oldStr must be copied from it character-for-character (whole lines, no line numbers, no added or removed indentation):",
    ...blocks,
    'Return JSON ONLY, FIRST FORM (preferred): {"patch":{"oldStr":"<exact text copied from the quoted source — it must occur EXACTLY once in the module>","newStr":"<the replacement text; empty deletes the matched text>"},}.',
    'SECOND FORM, only if one unique replacement cannot fix the defect: {"module":"<complete corrected module source>","exports":[...],"reqTrace":{...}}.',
    "Change ONLY the named defect — every other line of the module stays byte-identical.",
    "Same rules as before: exact typeSignature exports (nothing more, nothing less), zero imports, JSDoc, // req-N markers, no forbidden primitives, no rejection-path tests, no markdown fences.",
  ].join("\n") + repairTreeFailureTail(treeFailure);
}

/**
 * Repair re-prompt for the missing-typeSignature failure class (make-4
 * delivery blocker — fixes/121): the module exported a SUBSET of the spec's
 * required functions. Re-prompt with the EXACT missing names so the model
 * implements + exports each, mirroring the existing unbound-export repair
 * instead of an instant refusal.
 */
export function p6SynthesisSignatureRepairPrompt(
  missing: readonly string[],
  treeFailure?: string,
): string {
  const names = [...new Set(missing.filter((n) => typeof n === "string" && n.trim()))];
  return [
    "Your previous module is missing functions the brief's typeSignatures require to be exported.",
    `Missing exported functions (implement each EXACTLY as its typeSignature describes, then assign module.exports.<name>): ${names.join(", ") || "(none listed)"}.`,
    'Return JSON ONLY with the SAME envelope: {"module":"<complete corrected module source>","exports":[...],"reqTrace":{...}}.',
    "For EVERY missing name: implement the function to match its typeSignature, assign module.exports.<name> = <name>, and list it again in exports.",
    "Same rules as before: exact typeSignature exports (nothing more, nothing less), zero imports, JSDoc, // req-N markers, no forbidden primitives, no markdown fences.",
  ].join("\n") + repairTreeFailureTail(treeFailure);
}

/** fixes/121 last-mile: deterministic CJS export-injection repair.
 *  For every claimed export the module declares at top level (`function NAME`,
 *  `const NAME =`, `let NAME =`, `var NAME =`) but never assigns to
 *  exports/module.exports, append `module.exports.NAME = NAME;`. Pure and
 *  conservative: only top-level declarations, only unbound names, and the
 *  appended lines are no-ops if the module already exports a superset. */
/** A1-04/A1-05 (fixes/122): strip line and block comments before the binder
 *  regexes (a commented-out export assignment must not fake a binding).
 *  String-literal protection is best-effort and conservative. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

export function injectMissingExports(
  source: string,
  claimedExports: readonly string[],
): { source: string; changed: boolean; injected: string[] } {
  if (typeof source !== "string" || !source.trim()) return { source, changed: false, injected: [] };
  const code = stripComments(source);
  const names = new Set<string>();
  for (const decl of code.matchAll(
    /^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm,
  )) {
    names.add(decl[1]!);
  }
  for (const decl of code.matchAll(/^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add(decl[1]!);
  }
  for (const decl of code.matchAll(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)) {
    names.add(decl[1]!);
  }
  const already = new Set<string>();
  for (const a of code.matchAll(/(?:exports|module\.exports)\s*\.\s*([A-Za-z_$][\w$]*)/g)) {
    already.add(a[1]!);
  }
  const injected: string[] = [];
  for (const name of [...new Set(claimedExports.filter((n): n is string => typeof n === "string"))]) {
    if (names.has(name) && !already.has(name)) injected.push(name);
  }
  if (injected.length === 0) return { source, changed: false, injected };
  const tail = `\n// fixes/121 mechanical export-injection (declared but never bound):\n${injected
    .map((n) => `module.exports.${n} = ${n};`)
    .join("\n")}\n`;
  return { source: `${source.replace(/\s*$/, "")}${tail}`, changed: true, injected };
}

/** fixes/121: brief-fit repair re-prompt — the module ignored the brief's own
 *  vocabulary; one bounded re-prompt carrying the missing nouns. */
export function p6SynthesisBriefFitRepairPrompt(
  missing: readonly string[],
  treeFailure?: string,
): string {
  const nouns = [...new Set(missing.filter((n) => typeof n === "string" && n.trim()))];
  return [
    "Your previous module does NOT implement the brief's product: it must expose the brief's domain through its identifiers.",
    `The brief requires these concepts to appear in your module (as function/constant/property names or their camelCase parts — e.g. a "lease renewal reminder" needs a function whose name contains renewal/remind): ${nouns.join(", ") || "(none listed)"}.`,
    'Return JSON ONLY with the SAME envelope: {"module":"<complete corrected module source>","exports":[...],"reqTrace":{...}}.',
    "Rewrite the module around the brief's real product vocabulary: every exported function should correspond to a brief requirement (// req-N markers), named from the brief's nouns.",
    "Same rules as before: exact typeSignature exports (nothing more, nothing less), zero imports, JSDoc, no forbidden primitives, no markdown fences.",
  ].join("\n") + repairTreeFailureTail(treeFailure);
}

/**
 * Synthesis user prompt: brief + spec, deterministic and capped. The
 * typeSignatures are the interface definitions the module MUST export
 * (MetaGPT Engineer evidence, [W-META] fixes/97 §W). fixes/144 (M2): thin
 * delegate of the chunked builder with the FULL signature list and no prior
 * files — byte-identical output to the pre-M2 prompt (the ≤8-signature,
 * single-chunk legacy contract; regression-tested).
 */
export function p6SynthesisUserPrompt(
  brief: string,
  spec: {
    requirements: string[];
    edgeCases: string[];
    errorHandling: string[];
    typeSignatures: string[];
    dataFlow: string[];
    negativeConstraints: string[];
  },
  lessons: readonly string[] = [],
): string {
  return p6SynthesisChunkUserPrompt(brief, spec, spec.typeSignatures, [], lessons);
}

/** One already-accepted earlier file of a chunked synthesis run (its exports
 *  are the context later chunks see). Pure data, never mutated. */
export type ChunkPriorFile = {
  /** Tree path of the earlier file (e.g. "src/generated.ts"). */
  path: string;
  /** Exported top-level names of the earlier file. */
  exports: readonly string[];
  /** The earlier file's envelope reqTrace (req-N → exported name). */
  reqTrace: Readonly<Record<string, string>>;
};

/**
 * fixes/144 (M2 / S-01 T2): chunked-sequential-synthesis user prompt. The
 * prefix (BRIEF → EDGE CASES) renders byte-identically to the legacy
 * single-module prompt for THIS chunk's signature list; chunks after the
 * first APPEND an "earlier files" context block carrying the earlier chunks'
 * exported top-level names + covered requirements, so a later file can call
 * an earlier export by name in the assembled bundle (never redeclare, never
 * import — the forbidden-primitive contract is unchanged per file). Empty
 * prior files + full signature list ⇒ byte-identical to the legacy prompt
 * (p6SynthesisUserPrompt delegates here).
 */
export function p6SynthesisChunkUserPrompt(
  brief: string,
  spec: {
    requirements: string[];
    edgeCases: string[];
    errorHandling: string[];
    typeSignatures: string[];
    dataFlow: string[];
    negativeConstraints: string[];
  },
  chunkSignatures: readonly string[],
  priorFiles: readonly ChunkPriorFile[] = [],
  lessons: readonly string[] = [],
): string {
  const raw = typeof brief === "string" ? brief.trim() : "";
  const capped =
    raw.length > P6_BRIEF_MAX_CHARS ? `${raw.slice(0, P6_BRIEF_MAX_CHARS).trimEnd()}${TRUNCATION_MARK}` : raw;
  const sigs = Array.isArray(chunkSignatures) ? chunkSignatures.filter((s): s is string => typeof s === "string") : [];
  const lines = [
    "BRIEF:",
    capped || "(empty brief — implement the spec requirements only)",
    "",
    // 216f (T-10 / F-08): scope the requirement duty to THIS file's signatures.
    // "implement every one" read against a per-chunk signature list was the
    // unsatisfiable half of the contradiction (chunk-0.ts:350).
    "REQUIREMENTS (the project's complete list — implemented across ALL of its files; this file implements every one its TYPE SIGNATURES below cover, marking each implementing function with its // req-N comment. A requirement owned by another file is implemented THERE behind that file's own signatures — never hide its logic behind non-exported helpers here):",
    ...spec.requirements.map((r, i) => `${i + 1}. ${r}`),
    "",
    // Keeps the literal marker "TYPE SIGNATURES (must export" (test-internal
    // synthesis-prompt detector) while scoping the list to this file.
    "TYPE SIGNATURES (must export — exactly these names, nothing more, nothing less; THIS file's share of the project — the project's other files export the remaining signatures):",
    ...sigs.map((s) => `- ${s}`),
    "",
    "NEGATIVE CONSTRAINTS (all mandatory):",
    ...spec.negativeConstraints.map((c) => `- ${c}`),
    "",
    "EDGE CASES (behave sensibly inside existing functions; do NOT add APIs for them):",
    ...spec.edgeCases.map((c) => `- ${c}`),
  ];
  if (Array.isArray(priorFiles) && priorFiles.length > 0) {
    lines.push(
      "",
      "EARLIER FILES ALREADY GENERATED (this project is synthesized as several files in sequence; each earlier file's",
      "exports below are bound as plain parameters of THIS file's scope in the assembled module — call them directly",
      "by name when this file needs their behavior. Do NOT redeclare them, do NOT import/require them, do NOT",
      "re-implement what they already cover, and give this file's own non-exported helpers names no earlier file used.",
      "Implement ONLY the type signatures listed above in THIS file.):",
    );
    for (const f of priorFiles) {
      const covered = Object.entries(f.reqTrace ?? {})
        .filter(([, name]) => (Array.isArray(f.exports) ? f.exports.includes(name) : false))
        .map(([req]) => req)
        .sort();
      const reqPart = covered.length > 0 ? ` · covers ${covered.join(", ")}` : "";
      lines.push(`- ${f.path} exports: ${(f.exports ?? []).join(", ") || "(none)"}${reqPart}`);
    }
  }
  if (Array.isArray(lessons) && lessons.length > 0) {
    lines.push(
      "",
      "PRIOR LESSONS (advisory — obey the spec first; do not invent APIs from these):",
      ...lessons.filter((l): l is string => typeof l === "string" && l.trim() !== "").map((l) => `- ${l}`),
    );
  }
  return lines.join("\n");
}

// --- fixes/144 (M2 / S-01 T2) chunked-sequential-synthesis core --------------

/** MetaGPT-style decomposition bound (fixes/134 §4 S-01): ≤8 signatures per
 *  synthesis call — the rotating-failure-class root cause was ONE 60k-envelope
 *  pro call (121: expansion → brief-fit → runtime-binding → oracle). */
export const P6_SYNTH_CHUNK_SIZE = 8;

/** Entry-file tree path. Chunk 0 (and the whole single-chunk legacy tree)
 *  lives here — parity with scaffold's generatedSource fallback host path
 *  (scaffold.ts `src/generated.ts`), so a one-file tree needs no remap.
 *  Later chunks live under `src/generated/<slug>.ts`. */
export const TREE_ENTRY_PATH = "src/generated.ts";

/**
 * Deterministic pure chunking: typeSignatures in expand order, ≤ perChunk per
 * chunk (default P6_SYNTH_CHUNK_SIZE). Duplicate lines are dropped (first
 * occurrence wins) so a repeated signature can never fork a chunk or an
 * export. Non-string entries are skipped. Order preserved ⇒ assembly order is
 * the dependency-safe expand order.
 */
export function chunkTypeSignatures(
  typeSignatures: readonly string[],
  perChunk: number = P6_SYNTH_CHUNK_SIZE,
): string[][] {
  const seen = new Set<string>();
  const sigs: string[] = [];
  for (const s of typeSignatures ?? []) {
    if (typeof s !== "string" || !s.trim() || seen.has(s)) continue;
    seen.add(s);
    sigs.push(s);
  }
  const size = Number.isInteger(perChunk) && perChunk > 0 ? perChunk : P6_SYNTH_CHUNK_SIZE;
  const groups: string[][] = [];
  for (let i = 0; i < sigs.length; i += size) groups.push(sigs.slice(i, i + size));
  return groups;
}

/** Lowercase-hyphen slug of a camelCase/PascalCase identifier: `createBoard`
 *  → "create-board", `getTenantById` → "get-tenant-by-id". Pure, stable. */
export function pathSlugFromNames(names: readonly string[]): string {
  for (const raw of names ?? []) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const parts = raw
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .toLowerCase()
      .split("-")
      .filter((p) => p.length > 0);
    if (parts.length > 0) return parts.slice(0, 4).join("-");
  }
  return "chunk";
}

/**
 * Deterministic tree path for one chunk. Chunk 0 (the entry file) is always
 * TREE_ENTRY_PATH (single-module host parity); later chunks are slugged from
 * their first signature name under src/generated/. Collisions (two chunks
 * whose leading names slug identically) get a deterministic `-2/-3` suffix —
 * every tree path is unique within a run.
 */
export function treePathForChunk(
  chunkIndex: number,
  chunkSignatureNames: readonly string[],
  taken: ReadonlySet<string> = new Set<string>(),
): string {
  if (chunkIndex <= 0) return TREE_ENTRY_PATH;
  return genericTreePath(chunkSignatureNames, taken);
}

/** fixes/216k (105 TA-15): slugged src/generated/ chunk path with a
 *  deterministic `-2/-3` de-dupe walk — the index-independent half of
 *  treePathForChunk, reused by the job-keyed plan for its leftover chunks
 *  (which must never claim TREE_ENTRY_PATH: in a job-keyed tree that path is
 *  the ESM barrel `materializeImportableTree` writes). */
function genericTreePath(
  chunkSignatureNames: readonly string[],
  taken: ReadonlySet<string>,
): string {
  const base = `src/generated/${pathSlugFromNames(chunkSignatureNames)}.ts`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`src/generated/${pathSlugFromNames(chunkSignatureNames)}-${n}.ts`)) n += 1;
  return `src/generated/${pathSlugFromNames(chunkSignatureNames)}-${n}.ts`;
}

// ---------------------------------------------------------------------------
// fixes/216k (105 TA-15 / 106 F-03 F-06 F-10, P0-04) — REAL per-job modules.
//
// The chunk→file mapping used to be index-keyed only: chunk 0 landed at
// src/generated.ts and later chunks under src/generated/<slug>.ts, so the
// spec-graph job paths (src/jobs/flip.ts …) were NEVER written by the tree
// pass and every job node degraded to a re-export bridge of the tree entry —
// ONE module wearing five filenames (`doctor --tree` → reexports:5, real:0).
//
// The mapping below keys each chunk to the spec-graph node it implements: a
// job node's file path IS the chunk's tree path, so the scaffold's tree pass
// emits the real synthesized module there and the bridge is reserved for
// genuinely unmapped nodes (which the scaffold counts and prints — fixes/216k
// also made bridged nodes visible, never a silent substitute).
//
// Binding is deterministic and evidence-based: a typeSignature binds to the
// FIRST job node (graph order) whose label names it (`runFlip(…)` ← “flip”;
// labels shorter than 3 chars never match). No LLM, no guessing: signatures
// that bind to no node keep the legacy src/generated/ family, and a graph
// with no keyable job node keeps the pre-216k mapping byte-for-byte.
// ---------------------------------------------------------------------------

/** One spec-graph job node the tree must materialise as a REAL module. */
export type SpecGraphJobTarget = { id: string; label: string; path: string };

/** Job label a spec-graph node purpose declares (`Implement job “flip” …`). */
export function jobLabelFromPurpose(purpose: unknown): string | null {
  const m = /[“"]([^”"]+)[”"]/.exec(typeof purpose === "string" ? purpose : "");
  const label = m ? m[1].replace(/\s+/g, " ").trim() : "";
  return label.length > 0 ? label : null;
}

/** Safe src/jobs/ tree path (mirrors scaffold's treePathRefusal for the job
 *  family: repo-relative, `/`-separated, charset [A-Za-z0-9._-], no traversal). */
function isJobTreeNodePath(p: unknown): p is string {
  if (typeof p !== "string" || !p.startsWith("src/jobs/") || !p.endsWith(".ts")) return false;
  return p
    .split("/")
    .every((seg) => seg !== "." && seg !== ".." && /^[A-Za-z0-9._-]+$/.test(seg));
}

/**
 * Ordered spec-graph job nodes (id, label, path) — the file map the chunk plan
 * keys on. A node without a parseable label or with a path outside src/jobs/
 * is skipped (it cannot be keyed deterministically; never guess a path). The
 * spec graph is the engine's own A5 output (planSpecGraph, algorithms.ts).
 */
export function specGraphJobTargets(
  project:
    | { specGraph?: { nodes?: readonly { id?: unknown; file?: unknown; purpose?: unknown }[] } | null }
    | null
    | undefined,
): SpecGraphJobTarget[] {
  const nodes = project?.specGraph?.nodes;
  if (!Array.isArray(nodes)) return [];
  const out: SpecGraphJobTarget[] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    if (n === null || typeof n !== "object") continue;
    const id = typeof n.id === "string" ? n.id : "";
    if (!id.startsWith("job-")) continue;
    const label = jobLabelFromPurpose(n.purpose);
    if (label === null || label.length < 3 || !isJobTreeNodePath(n.file)) continue;
    if (seen.has(n.file)) continue;
    seen.add(n.file);
    out.push({ id, label, path: n.file });
  }
  return out;
}

/**
 * Deterministic signature→job binding. Each signature binds to the FIRST job
 * target (graph order) whose label appears case-insensitively in the
 * signature's function name; a signature with no parseable function name or no
 * label hit stays in `leftover` (expand order kept end-to-end). `bound[i]`
 * holds target i's own signatures in expand order.
 */
export function bindSignaturesToJobTargets(
  typeSignatures: readonly string[],
  targets: readonly SpecGraphJobTarget[],
): { bound: string[][]; leftover: string[] } {
  const bound: string[][] = targets.map(() => []);
  const leftover: string[] = [];
  for (const raw of typeSignatures ?? []) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const name = signatureFunctionNames([raw])[0] ?? null;
    const idx = name === null
      ? -1
      : targets.findIndex((t) => name.toLowerCase().includes(t.label.toLowerCase()));
    if (idx >= 0) bound[idx]!.push(raw);
    else leftover.push(raw);
  }
  return { bound, leftover };
}

/** One planned synthesis chunk: its tree path + the signatures it must export. */
export type TreeChunk = {
  path: string;
  signatures: string[];
  /** Set when the chunk is keyed to a spec-graph job node (fixes/216k TA-15). */
  nodeId?: string;
  label?: string;
};

/** `src/jobs/flip.ts` → `src/jobs/flip-2.ts` (second chunk of the same job),
 *  colliding further chunks walk `-3/-4…` deterministically. */
function jobSiblingPath(nodePath: string, k: number, taken: ReadonlySet<string>): string {
  const dot = nodePath.lastIndexOf(".");
  const stem = dot > 0 ? nodePath.slice(0, dot) : nodePath;
  const ext = dot > 0 ? nodePath.slice(dot) : ".ts";
  let n = k + 1;
  let path = `${stem}-${n}${ext}`;
  while (taken.has(path)) {
    n += 1;
    path = `${stem}-${n}${ext}`;
  }
  return path;
}

/**
 * The chunk→file plan (fixes/216k TA-15, P0-04). Job-keyed chunks come first
 * (graph order: the node's own file is its first chunk, `-2/-3` siblings carry
 * the overflow), then the unbound signatures keep the legacy src/generated/
 * family. When NO signature binds to a job node the plan is byte-identical to
 * the pre-216k index-keyed mapping (chunk 0 = TREE_ENTRY_PATH, later chunks
 * slugged under src/generated/) — every job-less spec graph is unaffected.
 * Pure + deterministic: same project + signatures ⇒ same plan.
 *
 * This is the MAP, not the consumption order: the driver consumes the plan via
 * orderTreeChunks (below) — see its doc for the forward-call rule.
 */
export function treeChunkPlan(
  project:
    | { specGraph?: { nodes?: readonly { id?: unknown; file?: unknown; purpose?: unknown }[] } | null }
    | null
    | undefined,
  typeSignatures: readonly string[],
  perChunk: number = P6_SYNTH_CHUNK_SIZE,
): TreeChunk[] {
  const sigs = (typeSignatures ?? []).filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  const taken = new Set<string>();
  const targets = specGraphJobTargets(project);
  const { bound, leftover } = targets.length > 0
    ? bindSignaturesToJobTargets(sigs, targets)
    : { bound: [] as string[][], leftover: sigs };
  const jobChunks: TreeChunk[] = [];
  targets.forEach((t, i) => {
    chunkTypeSignatures(bound[i] ?? [], perChunk).forEach((g, k) => {
      const path = k === 0 ? t.path : jobSiblingPath(t.path, k, taken);
      taken.add(path);
      jobChunks.push({ path, signatures: g, nodeId: t.id, label: t.label });
    });
  });
  if (jobChunks.length === 0) {
    // Legacy parity: no keyable job node carried a signature.
    return chunkTypeSignatures(sigs, perChunk).map((g, i) => {
      const path = treePathForChunk(i, signatureFunctionNames(g), taken);
      taken.add(path);
      return { path, signatures: g };
    });
  }
  for (const g of chunkTypeSignatures(leftover, perChunk)) {
    const path = genericTreePath(signatureFunctionNames(g), taken);
    taken.add(path);
    jobChunks.push({ path, signatures: g });
  }
  return jobChunks;
}

/**
 * fixes/216k (TA-15, W5-L1 subtlety 1): the order the driver CONSUMES a plan
 * in — the forward-call rule.
 *
 * The chunk-prompt contract is "a later file may call an earlier file's
 * exports by name" (assembled entry: earlier exports bound as IIFE
 * parameters; materialized ESM: earlier files imported). A chunk whose
 * functions can only call what its prompt's prior list carried must therefore
 * see every chunk it may legitimately depend on BEFORE it is synthesized.
 *
 * Job binding is label-keyed, not contiguity-keyed: in the corpus fixture
 * `record` owns signatures at expand indices [0,7,14,21,23] while the
 * leftover chunks hold [1..13] and [15..24]. The plan's graph order would
 * synthesize `src/jobs/record.ts` FIRST — with an EMPTY prior list — and
 * materialize the leftover chunks AFTER it, so a call from record's job
 * functions into the ledger helpers (indices 1..13, earlier in expand order —
 * the natural call direction) would be a FORWARD CALL: not imported by
 * record.ts, a ReferenceError the moment the oracle row calls the real
 * function.
 *
 * Rule: in a job-keyed plan, consume the unbound LEFTOVER chunks first (their
 * plan/expand order kept), then the job chunks in REVERSE PLAN ORDER
 * (latest-bound target first … earliest last) so the widest-spanning job
 * module is synthesized last, with every earlier-signature chunk already in
 * its prior context. Within one job, sibling chunks stay in signature order
 * (k=0 → `-2` → `-3`): that is the order in which "sibling chunks import
 * earlier files IN ORDER" holds — as with the pre-job plan, a chunk never
 * needs a forward import for its own sibling overflow.
 *
 * Zero-job plans are returned in EXACT plan order (pre-216k byte parity: the
 * legacy index-keyed mapping and its chunk-prompt chain are untouched).
 * Pure + deterministic; never mutates its input.
 */
export function orderTreeChunks(plan: readonly TreeChunk[]): TreeChunk[] {
  const rows = (Array.isArray(plan) ? plan : []).filter(
    (c): c is TreeChunk => c !== null && typeof c === "object" && Array.isArray(c.signatures),
  );
  const jobChunks = rows.filter((c) => typeof c.nodeId === "string" && c.nodeId.length > 0);
  if (jobChunks.length === 0) return [...rows];
  const leftover = rows.filter((c) => !(typeof c.nodeId === "string" && c.nodeId.length > 0));
  // W6-L1 correction (the landed W5 body reversed the FLAT list, which also
  // reversed one job's own sibling overflow — contradicting the rule above):
  // reverse the job GROUPS (targets) and keep each group's chunks in plan
  // order, so a >8-signature job is still consumed `…ts` → `…-2.ts` → `…-3.ts`
  // and a later sibling's prompt carries the earlier sibling's exports (the
  // pre-job sibling contract). Blocks are grouped by nodeId in first-seen
  // order — treeChunkPlan emits one contiguous block per target.
  const order: string[] = [];
  const byNode = new Map<string, TreeChunk[]>();
  for (const c of jobChunks) {
    const key = c.nodeId as string;
    const bucket = byNode.get(key);
    if (bucket === undefined) {
      byNode.set(key, [c]);
      order.push(key);
    } else {
      bucket.push(c);
    }
  }
  const reversed: TreeChunk[] = [];
  for (let i = order.length - 1; i >= 0; i--) {
    const bucket = byNode.get(order[i]!)!;
    for (const c of bucket) reversed.push(c);
  }
  return [...leftover, ...reversed];
}

/**
 * Assemble the ENTRY module from the accepted tree files — the
 * concatenation-safe form of the tree (used for brief-fit vocabulary scan
 * and as generatedSource on the SINGLE-chunk legacy path). Each file's
 * source is wrapped in an IIFE `(function (module, exports, <prior
 * exports…>) { … })(module, module.exports, module.exports.<prior>…)`:
 *   - top-level names can never collide across files;
 *   - later files may call earlier exports BY NAME (chunk-prompt contract);
 *   - `module.exports.<name> = …` reaches the shared outer exports object.
 * Pure + deterministic: identical files ⇒ identical entry bytes.
 *
 * A0 (fixes/162): this concatenation is NOT what hits disk for multi-chunk
 * trees — `materializeImportableTree` rewrites those into real ESM files
 * with cross-file `import`/`export`. Single-chunk disk bytes stay the raw
 * chunk source (this IIFE lives only on generatedSource).
 */
export function assembleTreeEntry(files: readonly { source: string; exports?: readonly string[] }[]): string {
  const parts: string[] = [];
  const priorNames: string[] = [];
  const seen = new Set<string>();
  for (const f of files ?? []) {
    const src = typeof f?.source === "string" ? f.source.trim() : "";
    if (!src) continue;
    const exportsList = (Array.isArray(f.exports) ? f.exports : []).filter(
      (n): n is string => typeof n === "string" && n.trim().length > 0,
    );
    const params = priorNames.length > 0 ? `, ${priorNames.join(", ")}` : "";
    const args = priorNames.length > 0 ? `, ${priorNames.map((n) => `module.exports.${n}`).join(", ")}` : "";
    parts.push(`(function (module, exports${params}) {\n${src}\n})(module, module.exports${args});`);
    for (const n of exportsList) {
      if (!seen.has(n)) {
        seen.add(n);
        priorNames.push(n);
      }
    }
  }
  return parts.join("\n");
}

/** Deterministic content-addressed tree record (integrity, not crypto —
 *  fnv1a parity with every other evidence hash in the repo). attempt is the
 *  synthesis attempt that produced the file (0 = first pass). */
export function toGeneratedTreeFile(path: string, source: string, attempt = 0): GeneratedTreeFile {
  return { path, source, hash: String(fnv1a(source)), attempt };
}

/** Relocated path for chunk 0 when a multi-chunk tree needs `src/generated.ts` as the ESM barrel. */
export const TREE_CHUNK0_RELOCATED_PATH = "src/generated/chunk-0.ts";

/**
 * POSIX relative specifier FROM one tree file TO another, keeping the real
 * `.ts` extension (node --test strip-types + allowImportingTsExtensions).
 * Pure; tree paths are always `/`-separated and repo-relative.
 */
export function relTsImport(fromFile: string, toFile: string): string {
  const from = String(fromFile ?? "").replace(/\\/g, "/");
  const to = String(toFile ?? "").replace(/\\/g, "/");
  const fromDir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const fromParts = fromDir ? fromDir.split("/").filter(Boolean) : [];
  const toParts = to.split("/").filter(Boolean);
  const toName = toParts.pop() ?? to;
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i += 1;
  const ups = fromParts.length - i;
  const down = [...toParts.slice(i), toName].join("/");
  const spec = `${ups > 0 ? "../".repeat(ups) : "./"}${down}`;
  return spec.replace(/\/$/, "") || "./";
}

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function isIdent(n: string): boolean {
  return IDENT_RE.test(n);
}

/** Net `{`/`[` depth contributed by one line, ignoring quoted strings and `//` comments.
 *  Used to consume a whole-object CJS assign to its matching close. */
function bracketDelta(line: string): number {
  let d = 0;
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q !== null) {
      if (c === "\\") i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      q = c;
      continue;
    }
    if (c === "/" && line[i + 1] === "/") break;
    if (c === "{" || c === "[") d++;
    else if (c === "}" || c === "]") d--;
  }
  return d;
}

/** Drop CJS `module.exports.NAME = NAME` (and a whole-object assign) so a file can become ESM.
 *
 *  216 (T-01): a whole-object assign is now removed as a COMPLETE CONSTRUCT. The previous
 *  implementation dropped only the line that *starts* with `module.exports =` and kept the
 *  object literal's body, leaving a dangling `};` plus bare identifiers — so the stripped
 *  module did not parse (`new Function(out)` throws), which is the corruption that traced to
 *  431 tsc errors in the emitted tree. The brace depth opened by the assign is now followed to
 *  its matching close, so the whole literal goes with it.
 *
 *  216 (T-16): the regression test feeds the MULTI-LINE form and asserts the output still
 *  parses — the old test only fed `module.exports = { a };` (single line), which the old code
 *  happened to handle, so a green suite could never see the bug. */
export function stripCjsExportAssignments(source: string, names: readonly string[]): string {
  const want = new Set((names ?? []).filter((n) => typeof n === "string" && isIdent(n)));
  const lines = String(source ?? "").split("\n");
  const kept: string[] = [];
  // >0 while consuming a multi-line `module.exports = {…}` construct.
  let skipDepth = 0;
  for (const line of lines) {
    const t = line.trim();
    if (skipDepth > 0) {
      skipDepth += bracketDelta(line);
      continue;
    }
    if (t.startsWith("module.exports =")) {
      const delta = bracketDelta(line);
      // Multi-line object literal: keep consuming until the literal closes.
      // Single-line (delta <= 0): the one line IS the whole construct — dropped here.
      if (delta > 0) skipDepth = delta;
      continue;
    }
    let drop = false;
    for (const n of want) {
      if (t === `module.exports.${n} = ${n};` || t === `module.exports.${n} = ${n}`) {
        drop = true;
        break;
      }
    }
    if (!drop) kept.push(line);
  }
  return kept.join("\n");
}

export type ImportableTreeFile = {
  path: string;
  source: string;
  exports: string[];
  reqTrace: Record<string, string>;
};

/**
 * A0: turn N>1 IIFE-scope-shared chunks into real ESM files with cross-file
 * imports. Chunk 0 moves off TREE_ENTRY_PATH so that path can be an `export *`
 * barrel the oracle/job-bridge/treeRun entry already import. Single-file
 * input is returned unchanged (legacy disk bytes).
 *
 * Later files import prior files (acyclic). The barrel imports every chunk
 * (does not get imported by them). Named exports are the envelope `exports`
 * list. Deterministic: identical input ⇒ identical files + barrel.
 */
export function materializeImportableTree(
  files: readonly {
    path: string;
    source: string;
    exports?: readonly string[];
    reqTrace?: Readonly<Record<string, string>>;
  }[],
): { files: ImportableTreeFile[]; entrySource: string } {
  const raw = (files ?? [])
    .filter((f) => f && typeof f.source === "string" && f.source.trim().length > 0)
    .map((f) => ({
      path: typeof f.path === "string" && f.path.trim() ? f.path : TREE_ENTRY_PATH,
      source: f.source,
      exports: (Array.isArray(f.exports) ? f.exports : []).filter((n): n is string => typeof n === "string" && isIdent(n.trim()) && n.trim() === n),
      reqTrace: { ...(f.reqTrace ?? {}) },
    }));
  if (raw.length <= 1) {
    return {
      files: raw.map((f) => ({ ...f, exports: [...f.exports], reqTrace: { ...f.reqTrace } })),
      entrySource: assembleTreeEntry(raw),
    };
  }
  const taken = new Set(raw.map((f) => f.path));
  let chunk0Path = TREE_CHUNK0_RELOCATED_PATH;
  if (raw[0]!.path === TREE_ENTRY_PATH) {
    if (taken.has(chunk0Path)) {
      let n = 2;
      while (taken.has(`src/generated/chunk-0-${n}.ts`)) n += 1;
      chunk0Path = `src/generated/chunk-0-${n}.ts`;
    }
    taken.delete(TREE_ENTRY_PATH);
    taken.add(chunk0Path);
    raw[0] = { ...raw[0]!, path: chunk0Path };
  }
  const rewritten: ImportableTreeFile[] = [];
  for (let i = 0; i < raw.length; i++) {
    const f = raw[i]!;
    const importLines: string[] = [];
    for (let j = 0; j < i; j++) {
      const prior = rewritten[j]!;
      const names = prior.exports.filter(isIdent);
      if (names.length === 0) continue;
      importLines.push(`import { ${names.join(", ")} } from ${JSON.stringify(relTsImport(f.path, prior.path))};`);
    }
    const body = stripCjsExportAssignments(f.source, f.exports).replace(/^\n+/, "").replace(/\n+$/, "");
    const exportLine = f.exports.filter(isIdent).length > 0 ? `export { ${f.exports.filter(isIdent).join(", ")} };` : "";
    const source = [...importLines, body, exportLine].filter((s) => s.length > 0).join("\n") + "\n";
    rewritten.push({ path: f.path, source, exports: [...f.exports], reqTrace: { ...f.reqTrace } });
  }
  const barrelLines = rewritten.map(
    (f) => `export * from ${JSON.stringify(relTsImport(TREE_ENTRY_PATH, f.path))};`,
  );
  const entrySource = barrelLines.join("\n") + "\n";
  const barrel: ImportableTreeFile = {
    path: TREE_ENTRY_PATH,
    source: entrySource,
    exports: rewritten.flatMap((f) => f.exports),
    reqTrace: Object.assign({}, ...rewritten.map((f) => f.reqTrace)),
  };
  return { files: [barrel, ...rewritten], entrySource };
}

// --- pure parse/validate helpers (exported for tests) ------------------------

export type SynthesisEnvelope = {
  module: string;
  exports: string[];
  reqTrace: Record<string, string>;
};

/**
 * Parse a DeepSeek JSON reply into the synthesis envelope. Tolerant of
 * ```json fences (parseOracleJson precedent); requires a non-empty module
 * string. Never throws.
 */
export function parseSynthesisEnvelope(text: unknown): SynthesisEnvelope | null {
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
  const module = typeof rec.module === "string" ? rec.module.trim() : "";
  if (!module) return null;
  const exportsList = Array.isArray(rec.exports)
    ? rec.exports.filter((e): e is string => typeof e === "string" && e.trim().length > 0).map((e) => e.trim())
    : [];
  const reqTrace: Record<string, string> = {};
  if (rec.reqTrace && typeof rec.reqTrace === "object" && !Array.isArray(rec.reqTrace)) {
    for (const [k, v] of Object.entries(rec.reqTrace as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) reqTrace[k] = v.trim();
    }
  }
  return { module, exports: exportsList, reqTrace };
}

/**
 * Function names a typeSignature line demands: `function name(`, `export
 * (declare )?function name(` or a leading `name(args)` prefix. Lines without
 * a parseable function name (type/interface/class signatures) are skipped —
 * not enforceable as exports. Deduped, order kept. Deterministic, no LLM.
 */
export function signatureFunctionNames(typeSignatures: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of typeSignatures) {
    if (typeof raw !== "string") continue;
    const line = raw.trim();
    let m = /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (!m) m = /^(?:export\s+)?(?:declare\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (!m) m = /^([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/.exec(line);
    if (!m) continue;
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** Names the module actually binds: function declarations, const/let/var and module.exports assignments. */
function declaredNames(module: string): Set<string> {
  // A1-04/A1-05 (fixes/122): scan comment-stripped source so a `// module.exports.x
  // = x` comment cannot fake a binding, and cover async/gen/class declarations.
  const code = stripComments(typeof module === "string" ? module : "");
  const names = new Set<string>();
  for (const m of code.matchAll(/^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/gm)) names.add(m[1]);
  for (const m of code.matchAll(/^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of code.matchAll(/module\.exports\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
  for (const m of code.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)) names.add(m[1]);
  return names;
}

/** Claimed exports the module never bound (declaredNames miss) — the exact
 *  names the export-binding repair re-prompt must carry. Pure, deterministic. */
export function unboundExportNames(module: string, claimedExports: readonly string[]): string[] {
  if (typeof module !== "string") return [...new Set(claimedExports.filter((e): e is string => typeof e === "string"))];
  const names = declaredNames(module);
  return [...new Set(claimedExports)].filter((e) => !names.has(e));
}

/** TypeSignature function names absent from the claimed exports — the exact
 *  names the signature-missing repair re-prompt must carry (make-4 blocker:
 *  a module that exports a subset of the spec's functions is repairable, not
 *  an instant refusal). Pure, deterministic, order kept. */
export function missingSignatureNames(
  claimedExports: readonly string[],
  signatureNames: readonly string[],
): string[] {
  const claimed = new Set(
    (Array.isArray(claimedExports) ? claimedExports : []).filter(
      (e): e is string => typeof e === "string" && e.trim().length > 0,
    ),
  );
  return [...new Set(signatureNames)].filter((n) => !claimed.has(n));
}

export type ModuleValidation =
  | { ok: true; exports: string[] }
  | { ok: false; code: ErrorCode; error: string };

/**
 * Deterministic pre-verify validation (the mechanical brief-fit floor — no
 * LLM): non-empty bounded module, no markdown fences, no forbidden
 * primitives in CODE (literals/comments masked), every claimed export bound
 * in the module, and every typeSignature function name present in the
 * exports list (absent names are reported — never silently dropped).
 */
export function validateSynthesisModule(
  module: string,
  claimedExports: readonly string[],
  signatureNames: readonly string[],
): ModuleValidation {
  if (typeof module !== "string" || !module.trim()) {
    return { ok: false, code: "RT_E_VALIDATION", error: "synthesis envelope carried an empty module" };
  }
  if (module.length > P6_MODULE_MAX_CHARS) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `module exceeds the ${P6_MODULE_MAX_CHARS}-char bound (${module.length})`,
    };
  }
  if (/```/.test(module)) {
    return { ok: false, code: "RT_E_VALIDATION", error: "module contains markdown fences" };
  }
  const masked = maskLiteralsAndComments(module);
  const hit = forbiddenPrimitiveHit(masked);
  if (hit.hard !== null || hit.soft !== null) {
    const token = hit.hard ?? hit.soft ?? "unknown";
    return { ok: false, code: "RT_E_VALIDATION", error: `forbidden primitive in generated module code (${token})` };
  }
  // 216f (T-15 / F-06): Math.random() in CODE — the emitted
  // compute-rent-roll.ts minted random entity ids in a nominally deterministic
  // system, so nothing about the product was reproducible. Masked source, so a
  // doc mention or a string is data, never a violation. Refused; the bounded
  // repair re-prompt upstream gets one chance to rewrite it deterministically.
  const nondet = nondeterministicPrimitiveHit(masked);
  if (nondet !== null) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `non-deterministic primitive in generated module code (${nondet}) — derive ids/values deterministically instead`,
    };
  }
  // 216f (T-09 / F-04): prose-in-code — bare English deliberation written into
  // the module body (the 23-line leak shipped at chunk-0.ts:340-362). Refused
  // with the first offending line named (bounded excerpt). SCOPE: LLM-derived
  // modules ONLY — the only callers are the synthesis paths
  // (synthesizeSingleModule / synthesizeChunkEnvelope + their repair
  // re-checks). Scaffold-authored files (src/main.tsx: it carries a prose
  // header and an `import` line) NEVER pass through this validator.
  const prose = proseLineHits(module);
  if (prose.length > 0) {
    const first = prose[0]!;
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `prose-in-code in generated module (${prose.length} prose line${prose.length === 1 ? "" : "s"}; first at line ${first.line}: ${JSON.stringify(first.text)})`,
    };
  }
  const claimed = [...new Set(claimedExports)];
  const unbound = unboundExportNames(module, claimed);
  if (unbound.length > 0) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `claimed exports not bound in the module: ${unbound.join(", ")}`,
    };
  }
  const missing = missingSignatureNames(claimed, signatureNames);
  if (missing.length > 0) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `typeSignature functions not exported: ${missing.join(", ")}`,
    };
  }
  return { ok: true, exports: claimed };
}

/**
 * p6-brief-fit pre-acceptance (DOD[6] probe parity, dod.ts): ≥ half of the
 * brief's required noun tokens (min 1) must appear as code identifiers in
 * the module. Vocabulary-free briefs pass vacuously.
 */
export function briefFitSatisfied(brief: string, source: string): { ok: boolean; missing: string[] } {
  const { required } = briefNounHits(brief);
  if (required.length === 0) return { ok: true, missing: [] };
  const hits = identifierHits(required, source);
  const need = Math.max(1, Math.ceil(required.length * 0.5));
  return { ok: hits.length >= need, missing: required.filter((t) => !hits.includes(t)) };
}

// --- live synthesis ----------------------------------------------------------

export type P6SynthesisDeps = {
  complete: (prompt: string, opts?: DeepSeekCompleteOptions) => Promise<LlmResult>;
  /** Brief expansion seam. The optional `lessons` argument carries the
   *  read-back lines (fixes/124 A3-03 wire): advisory prior-run lessons for
   *  the expansion model, gathered by the liveP6Synthesis caller from
   *  project.memory (selectLessons → lessonLinesForBrief). Injected fakes
   *  with the legacy one-arg shape stay assignable. */
  expand: (brief: string, lessons?: readonly string[]) => Promise<ExpandBriefResult>;
  verify: (
    source: string,
    brief: string,
    opts?: { maxIterations?: number; signatureNames?: readonly string[] },
  ) => Promise<VerifyOutcome>;
  /** fixes/144 (M3-2): optional tree-run failure context (failing file path +
   *  first not-ok tail — bounded ~1500 chars) supplied by the M4 journey
   *  driver's synthesize-or-repair cycle. When present, every bounded repair
   *  re-prompt built during this synthesis appends it as a coded context
   *  block; omitted keeps the legacy byte-identical repair prompts. */
  treeFailure?: string;
  /** T-107.1 (216r · W7-L1): opt-in patch (str_replace) repair level — when
   *  true a LOCALIZED defect (soft forbidden primitive / non-deterministic
   *  primitive / prose-in-code) gets ONE bounded delta attempt BEFORE the
   *  legacy full-rewrite repair; a refusal returns the legacy path unchanged.
   *  Absent/false keeps every prompt byte and the model-call count legacy. */
  patchRepairs?: boolean;
};

/** Number of expandBrief attempts on a transient/timeout failure (backoff). */
export const P6_EXPAND_MAX_ATTEMPTS = 3;

/** True when an expand failure is transient (timeout/abort) — safe to retry. */
function isTransientExpandFailure(res: ExpandBriefResult): boolean {
  return res.ok === false && res.reason === "error" && /timed out|timeout|abort/i.test(res.error ?? "");
}

/**
 * Bounded retry-with-backoff around expandBrief (fixes/116 reliability repair).
 * The flash tier's default 20s abort could fire before DeepSeek finished a
 * 3000-token JSON expansion (2/6 probe failures were 20s timeouts). A failed
 * expansion is retried with exponential backoff; non-transient failures
 * (not-configured, unparseable payload) return immediately — never a blind
 * re-run. P6_EXPAND_MAX_ATTEMPTS keeps it bounded and honest.
 */
export async function expandBriefWithBackoff(
  brief: string,
  expand: (b: string) => Promise<ExpandBriefResult> = expandBrief,
): Promise<ExpandBriefResult> {
  let last: ExpandBriefResult | null = null;
  for (let attempt = 0; attempt < P6_EXPAND_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    const res = await expand(brief);
    if (res.ok) return res;
    if (!isTransientExpandFailure(res)) return res; // not-configured / parse → don't retry
    last = res;
  }
  return last ?? { ok: false, reason: "error", error: "expandBrief failed" };
}

/**
 * Synthesis retry-with-backoff (make-5 blocker — fixes/121). The main
 * synthesis call was a single non-retrying 90s-capped attempt; when it timed
 * out that WAS the delivery outcome. Give it the same bounded-backoff
 * treatment expandBrief already has: 2 attempts with exponential backoff, and
 * an honest RT_E_LLM_TIMEOUT only after BOTH fail. Non-transient failures
 * (not-configured, provider rejection, unparseable) return immediately —
 * never a blind re-run. The `sleep` seam is injectable for deterministic tests.
 */
export const P6_SYNTH_MAX_ATTEMPTS = 2;
export const P6_SYNTH_BACKOFF_MS = 1000;

function isTransientSynthFailure(res: LlmResult): boolean {
  return res.ok === false && res.code === "RT_E_LLM_TIMEOUT";
}

/** Optional hard cap. Unset / 0 / NaN → unmetered (byte-identical). */
export function p6TokenCapFromEnv(env: NodeJS.ProcessEnv = process.env): number | undefined {
  const raw = env.RAPIDTOOL_TOKEN_CAP;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

function accountSynthUsage(ledger: TokenLedger, res: LlmResult, cap: number | undefined): LlmResult | null {
  if (!res.ok || !res.usage) return null;
  const next = recordSpend(ledger, {
    promptTokens: res.usage.promptTokens,
    completionTokens: res.usage.completionTokens,
  });
  ledger.promptTokens = next.promptTokens;
  ledger.completionTokens = next.completionTokens;
  ledger.calls = next.calls;
  if (cap !== undefined && totalTokens(ledger) > cap) {
    return {
      ok: false,
      reason: "error",
      error: `Session token budget exhausted: spent ${totalTokens(ledger)} > cap ${cap}`,
      code: "RT_E_BUDGET_EXHAUSTED",
    };
  }
  return null;
}

export async function synthWithBackoff(
  complete: (prompt: string, opts?: DeepSeekCompleteOptions) => Promise<LlmResult>,
  prompt: string,
  opts: DeepSeekCompleteOptions,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ledger: TokenLedger = emptyLedger(),
  cap: number | undefined = p6TokenCapFromEnv(),
): Promise<LlmResult> {
  let last: LlmResult | null = null;
  for (let attempt = 0; attempt < P6_SYNTH_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(P6_SYNTH_BACKOFF_MS * 2 ** (attempt - 1));
    const res = await complete(prompt, opts);
    const exhausted = accountSynthUsage(ledger, res, cap);
    if (exhausted) return exhausted;
    if (res.ok) return res;
    if (!isTransientSynthFailure(res)) return res;
    last = res;
  }
  return (
    last ?? {
      ok: false,
      reason: "error",
      error: "synthesis call failed",
      code: "RT_E_LLM_REJECTED" as const,
    }
  );
}

const defaultDeps: P6SynthesisDeps = {
  complete: completeDeepSeek,
  // A3-03 read-back: the injected lessons lines reach expandBrief as its
  // third argument; omitted lines keep the legacy byte-identical prompt.
  expand: (brief, lessons) =>
    expandBriefWithBackoff(brief, (b) => expandBrief(b, undefined, lessons)),
  verify: (source, brief, opts) => verifyAndFixServer(source, brief, opts),
};

/** Append the honest refusal trail — the deterministic floor stands; never a fabricated pass. */
function refuse(project: Project, code: ErrorCode, detail: string): Project {
  const clean = typeof detail === "string" && detail.trim() ? detail.trim() : "unknown";
  return {
    ...project,
    logs: [
      ...(project.logs ?? []),
      {
        ts: Date.now(),
        phase: 6 as PhaseId,
        level: "warn" as const,
        event: "p6.synthesis.refused",
        detail: `${code} · ${clean.slice(0, 160)}`,
      },
    ].slice(-200),
  };
}

/**
 * fixes/153 (P1) — AI-call error visibility: the bounded per-attempt
 * `p6.synthesis.attempt` journal. Every synthesis-model call in the
 * single-module and chunked paths records one entry naming the chunk, the
 * sequential attempt number within that chunk, the call's timeout budget and
 * its outcome (ok/refused/timeout) — and, when refused, the model/provider's
 * own refusal text (first ~160 chars; deepseek describeError now keeps the raw
 * body visible inside that text). Additive context only: no prompt, refusal
 * string or terminal p6.synthesis.refused / p6.synthesis event changes.
 */
function synthAttemptLogEntry(a: {
  chunkIndex: number;
  chunkTotal: number;
  attempt: number;
  timeoutMs: number;
  res: LlmResult;
}): JsonLog {
  const outcome = a.res.ok ? "ok" : a.res.code === "RT_E_LLM_TIMEOUT" ? "timeout" : "refused";
  const failed = !a.res.ok ? (a.res as { error?: string; reason?: string }) : null;
  const refusal =
    outcome === "refused"
      ? ` · refusal: ${String(failed?.error ?? failed?.reason ?? "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160)}`
      : "";
  return {
    ts: Date.now(),
    phase: 6 as PhaseId,
    level: a.res.ok ? ("info" as const) : ("warn" as const),
    event: "p6.synthesis.attempt",
    detail: `chunk ${a.chunkIndex + 1}/${a.chunkTotal} · attempt ${a.attempt} · ${a.timeoutMs}ms · ${outcome}${refusal}`,
  };
}

/** Number every model call of one chunk sequentially — synthWithBackoff's
 *  bounded retries AND each bounded repair re-prompt report one event. */
function attemptObservedComplete(
  complete: P6SynthesisDeps["complete"],
  onAttempt: (attempt: number, res: LlmResult) => void,
): P6SynthesisDeps["complete"] {
  let attempt = 0;
  return async (prompt, opts) => {
    attempt += 1;
    const res = await complete(prompt, opts);
    onAttempt(attempt, res);
    return res;
  };
}

/** Append one attempt event to the accumulator, bounded at the same 200-entry
 *  cap the terminal log helpers apply (the synthesis paths fire at most a
 *  handful of events per chunk, so this is belt-and-braces). */
function pushAttemptLog(attemptLogs: JsonLog[], entry: JsonLog): void {
  attemptLogs.push(entry);
  if (attemptLogs.length > 200) attemptLogs.splice(0, attemptLogs.length - 200);
}

/** Ride the accumulated attempt events onto the project a terminal log/upgrade
 *  helper appends to. No-op (same reference) when no attempt ran, so legacy
 *  call sites stay byte-identical. */
function withAttemptLogs(project: Project, attemptLogs: JsonLog[]): Project {
  return attemptLogs.length > 0 ? { ...project, logs: attemptLogs } : project;
}

function codeForVerifyStatus(status: VerifyOutcome["status"]): ErrorCode {
  if (status === "not-configured") return "RT_E_LLM_NOT_CONFIGURED";
  if (status === "error") return "RT_E_LLM_REJECTED";
  return "RT_E_RUNNER_FAILED"; // failed: the machine harness ran and did not pass
}

/** Strip stray fences from a repaired source (verify.server repair-output parity). */
function cleanRepairedSource(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const cleaned = text.replace(/^```[a-zA-Z0-9+_-]*\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  return cleaned || null;
}

function verifyOutcomeArtifact(finalModule: string, outcome: VerifyOutcome): Artifact {
  const evidenceHash = String(fnv1a(`${finalModule}${outcome.evidence}`));
  const caseLines: string[] = [];
  for (const c of outcome.cases ?? []) {
    const row = c as { id?: unknown; expression?: unknown } | null | undefined;
    if (!row || typeof row !== "object") continue;
    const id = typeof row.id === "string" ? row.id : "";
    const expression = typeof row.expression === "string" ? row.expression : "";
    if (id && expression) caseLines.push(`- ${id}: ${expression}`);
  }
  const body = [
    "# Verify outcome — PASSED (machine-run)",
    "",
    outcome.evidence || "(no evidence text)",
    `Iterations: ${typeof outcome.iterations === "number" ? outcome.iterations : 0}`,
    ...(caseLines.length > 0 ? ["", "Cases:", ...caseLines] : []),
  ].join("\n");
  return {
    id: `verify-passed-${evidenceHash.slice(0, 8)}`,
    phase: 6,
    kind: "verify" as unknown as ArtifactKind, // headless.ts parity double-cast
    title: "Verify outcome — passed (machine-run)",
    body,
    language: "markdown",
  };
}

/** The E-07 machine-promoted "tested" lastTest shape (dod.ts p6-verified reads
 *  label === "tested" + a non-empty evidenceHash; p6-test reads ok + a
 *  non-empty detail). Shared by the single-module `upgraded()` mint and the
 *  fixes/147 tree-run tested-equivalent mint so both stamps are byte-shape
 *  identical (the superset evidenceHash field rides on the inferred type;
 *  Project.lastTest accepts it at spread time). */
function testedLastTestStamp(detail: string, evidenceHash: string): {
  ok: true;
  detail: string;
  label: "tested";
  evidenceHash: string;
} {
  return { ok: true as const, detail, label: "tested" as const, evidenceHash };
}

/**
 * Upgrade the deterministic P6 result with the machine-verified module.
 * Replaces the placeholder's kind-"code" artifacts (the labeled template +
 * its sandbox result) with the real module + verify outcome; stamps lastTest
 * (label "tested" + evidenceHash, the exact shape applyVerifyOutcome mints),
 * the persisted implementationSpec, and modelRoute deepseek-flash (E-14
 * provenance). A non-forceHuman P6 gate (schedule.extraHitl) is retitled to
 * approve the REAL module; a forceHuman gate never reaches this function.
 */
function upgraded(project: Project, finalModule: string, outcome: VerifyOutcome, specRecord: Project["implementationSpec"]): Project {
  const evidenceHash = String(fnv1a(`${finalModule}${outcome.evidence}`));
  const codeArtifact: Artifact = {
    id: `6-code-llm-module-${evidenceHash.slice(0, 8)}`,
    phase: 6,
    kind: "code",
    title: "Generated module (LLM, machine-verified)",
    body: finalModule,
    language: "javascript",
  };
  const memoryId = "6-episodic-0.93";
  const memory = [
    ...(project.memory ?? []).filter((m) => m.id !== memoryId),
    {
      id: memoryId,
      kind: "episodic" as const,
      phase: 6 as PhaseId,
      text: `Keyed P6 synthesis: ${outcome.evidence.slice(0, 90)}`,
      score: 0.93,
      source: "engine" as const,
    },
  ].slice(0, 80);
  const artifacts = [
    ...(project.artifacts ?? []).filter(
      (a) =>
        !(a.phase === 6 && ((a.kind as unknown as string) === "code" || (a.kind as unknown as string) === "verify")),
    ),
    codeArtifact,
    verifyOutcomeArtifact(finalModule, outcome),
  ];
  const hitl =
    project.hitl?.phase === 6 && project.hitl.forceHuman !== true
      ? {
          ...project.hitl,
          title: "Approve generated module (LLM, machine-verified)",
          prompt:
            "Scheduler raised HITL on the machine-verified LLM module (brief-faithful synthesis + machine-run cases). Confirm it enters the build record.",
        }
      : project.hitl;
  // Hoisted structural literal (headless.applyVerifyOutcome parity): the E-07
  // superset field evidenceHash rides on the inferred type; Project.lastTest
  // accepts it at spread time while dod.ts p6-verified reads it defensively.
  // (fixes/147: shape shared with the tree-run tested-equivalent mint via
  // testedLastTestStamp, so both promoted stamps stay byte-shape identical.)
  const testedLastTest = testedLastTestStamp(outcome.evidence, evidenceHash);
  return {
    ...project,
    generatedSource: finalModule,
    lastTest: testedLastTest,
    implementationSpec: specRecord,
    modelRoute: "deepseek-flash",
    memory,
    artifacts,
    logs: [
      ...(project.logs ?? []),
      {
        ts: Date.now(),
        phase: 6 as PhaseId,
        level: "info" as const,
        event: "p6.synthesis",
        detail: `LLM module machine-verified · ${outcome.iterations} iteration(s) · ${outcome.evidence.slice(0, 140)}`,
      },
    ].slice(-200),
    ...(hitl !== project.hitl ? { hitl } : {}),
  };
}

/**
 * fixes/148 (F1 — tree-trigger scope): whether a project is single-module
 * LIBRARY eligible — the ONLY state the ≤8-signature byte-parity
 * synthesizeSingleModule path may serve. E-15's Project.kind is a coarse
 * OPTIONAL delivery-kind field ("app" | "tool" | "game") that is NEVER
 * inferred on legacy/imported payloads; every declared member is a
 * NON-library multi-file surface ("app" = webapp, "game" = playable game,
 * "tool" = CLI/agent utility), whose honest module is the tree entry +
 * per-capability files. So any declared kind must route to the chunked tree
 * regardless of signature count (fixes/145 M1=0 root cause: a ≤8-signature
 * webapp brief fell into the single-module path by construction). Only a
 * KIND-ABSENT project — the brief-expressed library/module fixtures the
 * fixes/144 byte-parity regression pins protect, plus legacy payloads — may
 * keep the single-module path. Callers that resolve a richer scaffold kind
 * (webapp/service/cli-tool/library/game — scaffold.ts projectKindOf) map it
 * onto this field at create time (E-15 #1 mapping: app→webapp round-trips).
 */
export function singleModuleLibraryKind(project: {
  kind?: Project["kind"] | null;
}): boolean {
  return project.kind === undefined || project.kind === null;
}

/**
 * Keyed P6 synthesis — the final leapfrog core (fixes/97 P0-01 Part B).
 *
 * `project` is expected to be the DETERMINISTIC P6 result (engine
 * applyPhaseResult(project, 6): phase record complete or awaiting_hitl,
 * placeholder generatedSource). On success the returned project carries the
 * brief-faithful machine-verified module; on every failure the deterministic
 * floor stands (same generatedSource/lastTest/artifacts) with an appended
 * `p6.synthesis.refused` RT_E_* log. Not-configured and forceHuman-gated
 * inputs return the SAME reference. Deps are injectable for tests.
 */
export async function liveP6Synthesis(project: Project, deps?: Partial<P6SynthesisDeps>): Promise<Project> {
  if (!isDeepSeekConfigured()) return project;
  const complete = deps?.complete ?? defaultDeps.complete;
  const expand = deps?.expand ?? defaultDeps.expand;
  const verify = deps?.verify ?? defaultDeps.verify;
  // M3-2: the optional tree-run failure context rides every bounded repair
  // re-prompt of THIS synthesis when the caller supplied it (defensively
  // normalized at the prompt builders; absent ⇒ byte-identical legacy text).
  const treeFailure = deps?.treeFailure;
  // T-107.1 (216r · W7-L1): the opt-in patch-repair level (see
  // P6SynthesisDeps.patchRepairs) — false unless the caller asks for it.
  const patchRepairs = deps?.patchRepairs === true;
  const brief = typeof project.brief === "string" ? project.brief : "";
  if (!brief.trim() || !Array.isArray(project.phases)) return project;

  // R3/B-03: a human-only gate (failed template sandbox) is never
  // machine-cleared — leave the base untouched for the human to review.
  const rec6 = project.phases.find((p) => p.id === 6);
  if (rec6?.status === "awaiting_hitl" && project.hitl?.phase === 6 && project.hitl.forceHuman === true) {
    return project;
  }

  // --- Step 1: spec (reuse when brief-faithful, else expand once) ------------
  const briefHash = String(fnv1a(brief));
  const existing = project.implementationSpec;
  const specFields:
    | {
        requirements: string[];
        edgeCases: string[];
        errorHandling: string[];
        typeSignatures: string[];
        dataFlow: string[];
        negativeConstraints: string[];
      }
    | null =
    existing &&
    typeof existing === "object" &&
    existing.briefHash === briefHash &&
    Array.isArray(existing.requirements) &&
    existing.requirements.length > 0
      ? existing
      : null;
  let spec = specFields;
  if (spec === null) {
    // fixes/124 A3-03 (read-back wire): prior-run lessons from project.memory
    // re-inject into the keyed P6 expansion — selectLessons (phase-6-preferred,
    // score-capped, phase-agnostic fallback) → lessonLinesForBrief (FusionRank
    // against the brief + provenance-visible line form) → expandBrief lessons.
    // Advisory only: ranking never changes gate inputs; empty memory keeps the
    // legacy byte-identical expansion prompt (lessons omitted).
    const lessonLines = lessonLinesForBrief(
      brief,
      selectLessons(project.memory ?? [], 6, EXPAND_LESSON_RANK_LIMIT),
      { limit: EXPAND_LESSON_RANK_LIMIT },
    );
    const note = typeof project.notes === "string" ? project.notes.trim() : "";
    const withNotes = note ? [`project.notes: ${note.slice(0, 240)}`, ...lessonLines] : lessonLines;
    const expanded = await expand(brief, withNotes.length > 0 ? withNotes : undefined);
    if (!expanded.ok) {
      return refuse(
        project,
        expanded.reason === "not-configured" ? "RT_E_LLM_NOT_CONFIGURED" : "RT_E_LLM_REJECTED",
        `expandBrief failed: ${expanded.reason === "error" ? expanded.error ?? "error" : "not-configured"}`,
      );
    }
    spec = expanded.spec;
  }
  const specRecord: NonNullable<Project["implementationSpec"]> = {
    requirements: spec.requirements,
    edgeCases: spec.edgeCases ?? [],
    errorHandling: spec.errorHandling ?? [],
    typeSignatures: spec.typeSignatures ?? [],
    dataFlow: spec.dataFlow ?? [],
    negativeConstraints: spec.negativeConstraints ?? [],
    source: "p6",
    briefHash,
    createdAt: Date.now(),
  };
  const signatureNames = signatureFunctionNames(specRecord.typeSignatures);

  // --- Step 2: chunked sequential synthesis (fixes/144 M2 / S-01 T2) --------
  // typeSignatures are grouped ≤8 per chunk in expand order (MetaGPT ≤8-fn
  // decomposition — fixes/134 §4 S-01). fixes/148 (F1): the tree-trigger is
  // KIND-scoped, not signature-count-only — the ≤8 byte-parity rule serves
  // ONLY single-module-library projects (kind ABSENT: undeclared/legacy;
  // E-15 never infers kind), where ≤8 signatures ⇒ ONE chunk ⇒ the legacy
  // single-module path below (one pro call + bounded repair re-prompts +
  // machine verify → upgraded) byte-for-byte. Every DECLARED delivery kind
  // ("app" = webapp / "tool" / "game") and every >8-signature spec ⇒ the
  // chunked tree: one pro-tier call PER chunk with the earlier chunks'
  // exports as context, deterministic per-file validation, deterministic
  // assembly into Project.generatedTree. A kind-absent project with zero
  // signatures keeps the legacy path (nothing to chunk).
  const chunkGroups = chunkTypeSignatures(specRecord.typeSignatures);
  if (singleModuleLibraryKind(project) && chunkGroups.length <= 1) {
    return synthesizeSingleModule(project, brief, specRecord, signatureNames, complete, verify, treeFailure, patchRepairs);
  }
  // fixes/216k (105 TA-15, W6-L1): the chunked driver computes its own
  // chunk→file plan (treeChunkPlan) and consumption order (orderTreeChunks)
  // INSIDE — the caller no longer passes a flat grouping. Job-keyed chunks land
  // at their spec-graph `src/jobs/*.ts` paths; a job-less graph keeps the
  // pre-216k index-keyed mapping byte-for-byte (treeChunkPlan's legacy branch).
  return synthesizeChunkedTree(project, brief, specRecord, complete, treeFailure, patchRepairs);
}

/**
 * fixes/144 (M2): the legacy single-module synthesis — used ONLY for
 * single-module-library (kind-absent/undeclared — fixes/148 F1) projects
 * whose spec carries ≤8 typeSignatures (one chunk), so the pre-M2 pipeline is
 * preserved
 * byte-for-byte: one pro-tier call + one bounded repair re-prompt per failure
 * class (envelope / export-binding / forbidden / missing-signature /
 * brief-fit) + deterministic export-injection + machine verify
 * (verifyAndFixServer) + the upgraded honest state. On success the verified
 * module is ALSO recorded as the one-file generatedTree (entry at
 * TREE_ENTRY_PATH, fnv1a hash, attempt 0) — the ≤8-signature legacy contract
 * is unchanged (generatedSource = the verified module, byte-identical).
 */
async function synthesizeSingleModule(
  project: Project,
  brief: string,
  specRecord: NonNullable<Project["implementationSpec"]>,
  signatureNames: string[],
  complete: P6SynthesisDeps["complete"],
  verify: P6SynthesisDeps["verify"],
  treeFailure?: string,
  /** T-107.1 (216r · W7-L1): the opt-in patch (str_replace) repair level. */
  patchRepairs = false,
): Promise<Project> {
  // --- Step 2 (legacy): synthesis (one call + one bounded repair re-prompt) --
  const lessonLines = lessonLinesForBrief(
    brief,
    selectLessons(project.memory ?? [], 6, EXPAND_LESSON_RANK_LIMIT),
    { limit: EXPAND_LESSON_RANK_LIMIT },
  );
  const user = p6SynthesisUserPrompt(brief, specRecord, lessonLines);
  const opts: DeepSeekCompleteOptions = {
    model: P6_SYNTH_MODEL,
    json: true,
    // fixes/156 (E1): structured json envelope → OUTPUT budget, not
    // chain-of-thought. Pro thinking (the default) on these LARGE prompts
    // let reasoning_content consume the whole max_tokens window and the API
    // returned content:"" on EVERY synthesis call (the empty-content
    // blocker — fixes/154 D5: disable thinking for json envelopes rather
    // than keep raising budgets; mechanism: api-docs.deepseek.com
    // /guides/json_mode + goose#11142 shared reasoning/content budget).
    // Deterministic validation + machine verify below are the correctness
    // loop — not CoT. Repair re-prompts reuse this opts (thinking-off too).
    thinking: false,
    maxTokens: P6_SYNTH_MAX_TOKENS,
    timeoutMs: P6_SYNTH_TIMEOUT_MS,
    system: p6SynthesisSystemPrompt(),
  };
  // fixes/153 (P1): per-attempt p6.synthesis.attempt journal for this one
  // chunk — every model call below (synthWithBackoff retries + each bounded
  // repair re-prompt) reports chunk 1/1 + a sequential attempt number.
  const attemptLogs: JsonLog[] = [...(project.logs ?? [])];
  const completeCall = attemptObservedComplete(complete, (attempt, res) => {
    pushAttemptLog(
      attemptLogs,
      synthAttemptLogEntry({ chunkIndex: 0, chunkTotal: 1, attempt, timeoutMs: opts.timeoutMs ?? P6_SYNTH_TIMEOUT_MS, res }),
    );
  });
  // T-107.1 (216r): the patch-repair sink rides the same bounded attempt
  // journal; the single module's emitted path is the tree entry file.
  const patch: PatchRepairOptions | undefined = patchRepairs
    ? { path: TREE_ENTRY_PATH, log: (entry) => pushAttemptLog(attemptLogs, entry) }
    : undefined;
  const res = await synthWithBackoff(completeCall, user, opts);
  if (!res.ok) {
    return refuse(
      withAttemptLogs(project, attemptLogs),
      res.reason === "not-configured" ? "RT_E_LLM_NOT_CONFIGURED" : res.code ?? "RT_E_LLM_REJECTED",
      res.error ?? res.reason ?? "synthesis call failed",
    );
  }
  let envelope = parseSynthesisEnvelope(res.text);
  if (envelope === null) {
    const repair = await completeCall(p6SynthesisRepairPrompt(treeFailure), opts);
    if (repair.ok) envelope = parseSynthesisEnvelope(repair.text);
  }
  if (envelope === null) {
    return refuse(withAttemptLogs(project, attemptLogs), "RT_E_LLM_REJECTED", "model returned an unparseable synthesis envelope after one repair attempt");
  }

  // --- Step 3: deterministic validation + brief-fit pre-acceptance -----------
  // fixes/116: two formerly-hard validation failures now get ONE bounded
  // repair re-prompt carrying the exact defect, so a single model slip no
  // longer strands the whole keyed run:
  //   • claimed-exports-not-bound → re-prompt with the exact missing names;
  //   • SOFT forbidden primitive (document/fetch/process/…) → re-prompt with
  //     the exact token (HARD eval/Function/import is NEVER repaired).
  let validation = validateSynthesisModule(envelope.module, envelope.exports, signatureNames);
  if (!validation.ok) {
    const masked = maskLiteralsAndComments(envelope.module);
    const hit = forbiddenPrimitiveHit(masked);
    const unbound = unboundExportNames(envelope.module, envelope.exports);
    const repairableForbidden = hit.soft !== null && hit.hard === null;
    // fixes/121: signature-missing is now a THIRD repair class — expandBrief
    // returns the contract names; a module that omits them gets ONE bounded
    // re-prompt listing the exact missing functions (was an instant refusal).
    const missingSig = missingSignatureNames(envelope.exports, signatureNames);
    // 216f (T-09/T-15): prose-in-code and a non-deterministic primitive are the
    // FOURTH/FIFTH bounded repair classes — each gets ONE re-prompt carrying
    // the exact defect (the prose line numbers / the offending token); a repeat
    // is refused. A HARD forbidden primitive still refuses with no repair.
    const nondet = nondeterministicPrimitiveHit(masked);
    const prose = proseLineHits(envelope.module);
    // T-107.1 (216r · W7-L1): the patch-first delta repair, ONLY when the
    // caller opted in and the defect is a LOCALIZED text edit (soft forbidden
    // token / non-deterministic primitive / prose). A landed delta is applied
    // by `applyStrReplace` against the module the model just produced and
    // revalidated by the SAME deterministic validator below; every non-landing
    // outcome (no excerpt, non-delta reply, coded refusal, patched module
    // still invalid) falls through to the legacy full-rewrite repair with its
    // prompt bytes unchanged.
    // 216r (W9-L2 · DEFECT 2): a landed delta that REVALIDATES leaves no
    // legacy repair class open on the patched bytes — the re-check above runs
    // every class the legacy block below would dispatch (bound exports,
    // forbidden, signatures, non-determinism, prose) — so `patchLanded`
    // short-circuits that block. Before this guard the legacy re-prompt still
    // fired after a successful patch (guards were read from the ORIGINAL
    // defect values) and a PARSEABLE reply overwrote the patched envelope,
    // silently discarding the landed delta (216r §2 defect 2).
    let patchLanded = false;
    if (patch !== undefined) {
      const defect = patchableDefect({
        source: envelope.module,
        masked,
        softToken: repairableForbidden ? hit.soft : null,
        unbound,
        missingSig,
        nondet,
        prose,
      });
      if (defect !== null) {
        const patched = await attemptPatchRepair({
          previous: envelope,
          defect: defect.defect,
          lines: defect.lines,
          signatureNames,
          completeCall,
          opts,
          treeFailure,
          path: patch.path,
          log: patch.log,
        });
        if (patched !== null) {
          envelope = patched;
          validation = validateSynthesisModule(envelope.module, envelope.exports, signatureNames);
          patchLanded = validation.ok;
        }
      }
    }
    if (!patchLanded && (unbound.length > 0 || repairableForbidden || missingSig.length > 0 || nondet !== null || prose.length > 0)) {
      const repairPrompt = unbound.length > 0
        ? p6SynthesisExportRepairPrompt(unbound, treeFailure)
        : repairableForbidden
          ? p6SynthesisForbiddenRepairPrompt(hit.soft ?? "unknown", treeFailure)
          : missingSig.length > 0
            ? p6SynthesisSignatureRepairPrompt(missingSig, treeFailure)
            : nondet !== null
              ? p6SynthesisNondeterministicRepairPrompt(nondet, treeFailure)
              : p6SynthesisProseRepairPrompt(prose, treeFailure);
      const repair = await completeCall(repairPrompt, opts);
      if (repair.ok) {
        const repaired = parseSynthesisEnvelope(repair.text);
        if (repaired) {
          envelope = repaired;
          validation = validateSynthesisModule(envelope.module, envelope.exports, signatureNames);
        }
      }
    }
  }
  if (!validation.ok) return refuse(withAttemptLogs(project, attemptLogs), validation.code, validation.error);
  let fit = briefFitSatisfied(brief, envelope.module);
  if (!fit.ok) {
    // fixes/121: the brief-fit class gets ONE bounded repair re-prompt too —
    // the module may have ignored the brief's vocabulary on the first pass.
    const repair = await completeCall(p6SynthesisBriefFitRepairPrompt(fit.missing, treeFailure), opts);
    if (repair.ok) {
      const repaired = parseSynthesisEnvelope(repair.text);
      if (repaired) {
        const reValidated = validateSynthesisModule(repaired.module, repaired.exports, signatureNames);
        const reFit = briefFitSatisfied(brief, repaired.module);
        if (reValidated.ok && reFit.ok) {
          envelope = repaired;
          validation = reValidated;
          fit = reFit;
        }
      }
    }
  }
  if (!fit.ok) {
    return refuse(
      withAttemptLogs(project, attemptLogs),
      "RT_E_VALIDATION",
      `generated module does not implement the brief's required vocabulary (missing: ${fit.missing.slice(0, 12).join(", ")}; p6-brief-fit pre-check after repair attempt)`,
    );
  }

  // --- Step 4: machine verify (reuse, don't build) ----------------------------
  // fixes/121 last-mile: the deterministic export-injection repair. Flash-tier
  // modules routinely DECLARE every contract function yet forget the CJS
  // binding (`function createProperty(){}` with no `module.exports.createProperty
  // = ...`) — static validation cannot see that, and the machine run dies with
  // "ReferenceError: createProperty is not defined". Before burning LLM repair
  // iterations, inject the missing bindings mechanically: for every claimed
  // export name that the module declares at top level (function NAME / const
  // NAME = / NAME =) but never assigns to exports, append the assignment.
  const injected = injectMissingExports(envelope.module, envelope.exports);
  if (injected.changed) {
    const reValidated = validateSynthesisModule(injected.source, envelope.exports, signatureNames);
    const reFit = briefFitSatisfied(brief, injected.source);
    if (reValidated.ok && reFit.ok) {
      envelope = { ...envelope, module: injected.source };
      validation = reValidated;
      fit = reFit;
    }
  }
  const outcome = await verify(envelope.module, brief, { maxIterations: 3, signatureNames });
  if (outcome.status !== "passed") {
    return refuse(withAttemptLogs(project, attemptLogs), codeForVerifyStatus(outcome.status), outcome.evidence || `verify ${outcome.status}`);
  }
  const finalModule = cleanRepairedSource(outcome.finalSource) ?? envelope.module;
  // Repairs could regress — re-run every deterministic floor check on the
  // FINAL source (the stored artifact is the verified module, never a claim).
  const finalValidation = validateSynthesisModule(finalModule, envelope.exports, signatureNames);
  if (!finalValidation.ok) return refuse(withAttemptLogs(project, attemptLogs), finalValidation.code, finalValidation.error);
  const finalFit = briefFitSatisfied(brief, finalModule);
  if (!finalFit.ok) {
    return refuse(
      withAttemptLogs(project, attemptLogs),
      "RT_E_VALIDATION",
      `verified module dropped the brief's required vocabulary (missing: ${finalFit.missing.slice(0, 12).join(", ")}; p6-brief-fit re-check)`,
    );
  }

  // --- Step 5: honest state ---------------------------------------------------
  const up = upgraded(withAttemptLogs(project, attemptLogs), finalModule, outcome, specRecord);
  // fixes/144 (M2): the verified single module is the one-file generatedTree
  // (entry path; content-addressed hash; attempt 0) — generatedSource stays
  // byte-identical (== the tree file's source) so every existing consumer
  // (verify/scaffold/dod) is untouched while the tree shape exists for the
  // assembly + p6-arch lanes.
  return { ...up, generatedTree: [toGeneratedTreeFile(TREE_ENTRY_PATH, finalModule)] };
}

/**
 * fixes/144 (M2 / S-01 T2): chunked sequential tree synthesis — one pro-tier
 * call per ≤8-signature chunk, in expand order, each prompt carrying the
 * shared brief + full requirement list + that chunk's signatures + the
 * earlier chunks' exported top-level names + reqTrace. Every accepted chunk
 * becomes one tree file (deterministic path, fnv1a hash, attempt 0);
 * generatedSource = the assembled ENTRY (each file wrapped in a scope that
 * binds the earlier files' exports — later files call earlier exports by name
 * through those bindings, the entry evaluates even under per-file helper-name
 * collisions, and every per-file source stays import-free). Refusals are
 * HONEST PARTIALS: prior chunks' real files stay on the returned project and
 * a p6.synthesis.refused log names the refused chunk index. No machine
 * verify here — per-file deterministic validation is the mechanical floor;
 * the tree machine-run is the tree-run lane's step (never a fabricated pass).
 *
 * fixes/216k (105 TA-15 / 106 F-03 F-06 F-10, W6-L1): the chunk→file map is
 * computed HERE, per call, from the project's own spec graph —
 * `treeChunkPlan` keys each chunk to the spec-graph node it implements
 * (`src/jobs/record.ts` …), and the driver consumes the ORDERED plan
 * (`orderTreeChunks`, D1: leftovers first, then job chunks in reverse plan
 * order) so every job module is synthesized with every earlier-signature chunk
 * already in its prior context (no forward calls). Each accepted chunk lands at
 * its planned `chunk.path` — never `treePathForChunk` for a planned chunk. A
 * graph with no keyable job node keeps the pre-216k index-keyed mapping and
 * chunk-prompt chain byte-for-byte.
 */
async function synthesizeChunkedTree(
  project: Project,
  brief: string,
  specRecord: NonNullable<Project["implementationSpec"]>,
  complete: P6SynthesisDeps["complete"],
  treeFailure?: string,
  /** T-107.1 (216r · W7-L1): the opt-in patch (str_replace) repair level. */
  patchRepairs = false,
): Promise<Project> {
  const opts: DeepSeekCompleteOptions = {
    model: P6_SYNTH_MODEL,
    json: true,
    // fixes/156 (E1): structured json envelope → OUTPUT budget, not
    // chain-of-thought. Pro thinking (the default) on these LARGE chunk
    // prompts let reasoning_content consume the whole max_tokens window and
    // the API returned content:"" on EVERY synthesis call (the
    // empty-content blocker — fixes/154 D5: disable thinking for json
    // envelopes rather than keep raising budgets; mechanism:
    // api-docs.deepseek.com /guides/json_mode + goose#11142 shared
    // reasoning/content budget). Deterministic per-file validation + the
    // tree-run lane are the correctness loop — not CoT. Repair re-prompts
    // reuse this opts (thinking-off too).
    thinking: false,
    maxTokens: P6_SYNTH_MAX_TOKENS,
    timeoutMs: P6_SYNTH_TIMEOUT_MS,
    system: p6SynthesisSystemPrompt(),
  };
  const accepted: { path: string; source: string; exports: string[]; reqTrace: Record<string, string> }[] = [];
  const prior: ChunkPriorFile[] = [];
  // fixes/216k (105 TA-15, W6-L1 D1/D3): the chunk→file plan + its consumption
  // order are computed here from the project's own spec graph. `plan[i].path`
  // IS the file path (a job node's `src/jobs/<label>.ts` for job-keyed chunks);
  // zero job nodes ⇒ treeChunkPlan's legacy branch ⇒ identical paths, identical
  // per-chunk prompts (pre-216k byte parity). `plan.length` is the honest chunk
  // total: every plan row is exactly one synthesis call.
  const plan = orderTreeChunks(treeChunkPlan(project, specRecord.typeSignatures));
  // fixes/153 (P1): per-attempt p6.synthesis.attempt journal — the observer
  // closure carries the chunk context so every model call of chunk i reports
  // chunk (i+1)/total + a sequential per-chunk attempt number.
  const attemptLogs: JsonLog[] = [...(project.logs ?? [])];

  for (let i = 0; i < plan.length; i++) {
    const chunk = plan[i]!;
    const lessonLines = lessonLinesForBrief(
      brief,
      selectLessons(project.memory ?? [], 6, EXPAND_LESSON_RANK_LIMIT),
      { limit: EXPAND_LESSON_RANK_LIMIT },
    );
    const user = p6SynthesisChunkUserPrompt(brief, specRecord, chunk.signatures, prior, lessonLines);
    // T-107.1 (216r): per-chunk patch-repair sink — the chunk plan's path IS
    // the emitted tree file's path; absent when the level is off (legacy).
    const patch: PatchRepairOptions | undefined = patchRepairs
      ? { path: chunk.path, log: (entry) => pushAttemptLog(attemptLogs, entry) }
      : undefined;
    const synth = await synthesizeChunkEnvelope(
      complete,
      user,
      opts,
      signatureFunctionNames(chunk.signatures),
      treeFailure,
      patch,
      (attempt, res) => {
        pushAttemptLog(
          attemptLogs,
          synthAttemptLogEntry({ chunkIndex: i, chunkTotal: plan.length, attempt, timeoutMs: opts.timeoutMs ?? P6_SYNTH_TIMEOUT_MS, res }),
        );
      },
    );
    if (!synth.ok) {
      return partialTreeRefuse(
        withAttemptLogs(project, attemptLogs),
        accepted,
        i,
        plan.length,
        synth.code,
        synth.error,
      );
    }
    // D1/D3: consume the plan row's path directly (no treePathForChunk for a
    // planned chunk — the plan already de-duped every path, job siblings
    // included via jobSiblingPath).
    const path = chunk.path;
    accepted.push({ path, source: synth.envelope.module, exports: [...synth.envelope.exports], reqTrace: { ...synth.envelope.reqTrace } });
    prior.push({ path, exports: [...synth.envelope.exports], reqTrace: { ...synth.envelope.reqTrace } });
  }

  // All chunks accepted → assemble the entry and run the TREE-LEVEL brief-fit
  // pre-acceptance (a per-file gate would be wrong: the brief's vocabulary
  // legitimately spreads across files; the assembled entry carries it all).
  const entry = assembleTreeEntry(accepted);
  const fit = briefFitSatisfied(brief, entry);
  if (!fit.ok) {
    return partialTreeRefuse(
      withAttemptLogs(project, attemptLogs),
      accepted,
      -1,
      plan.length,
      "RT_E_VALIDATION",
      `assembled tree does not implement the brief's required vocabulary (missing: ${fit.missing.slice(0, 12).join(", ")}; tree-level p6-brief-fit after all chunks accepted)`,
    );
  }
  const materialized = materializeImportableTree(accepted);
  return treeUpgraded(
    withAttemptLogs(project, attemptLogs),
    specRecord,
    materialized.files,
    materialized.entrySource,
    accepted.length,
  );
}

/**
 * One chunk's synthesis: synthWithBackoff + the bounded repair classes the
 * legacy single-module path uses (envelope-parse repair ×1; export-binding /
 * soft-forbidden / missing-signature repair ×1; deterministic export
 * injection last-mile). Returns the accepted envelope or the coded failure —
 * brief-fit is deliberately NOT a per-chunk gate (tree-level fit runs on the
 * assembled entry; nouns spread across files).
 */
async function synthesizeChunkEnvelope(
  complete: P6SynthesisDeps["complete"],
  user: string,
  opts: DeepSeekCompleteOptions,
  signatureNames: string[],
  treeFailure?: string,
  /** T-107.1 (216r · W7-L1): the opt-in patch (str_replace) repair level —
   *  absent keeps every prompt byte and the model-call count legacy. */
  patch?: PatchRepairOptions,
  onAttempt?: (attempt: number, res: LlmResult) => void,
): Promise<{ ok: true; envelope: SynthesisEnvelope } | { ok: false; code: ErrorCode; error: string }> {
  // fixes/153 (P1): sequential attempt numbering per chunk — one event per
  // model call (synthWithBackoff retries + each bounded repair re-prompt); an
  // absent observer keeps this path the exact legacy no-op.
  const completeCall = attemptObservedComplete(complete, (attempt, res) => onAttempt?.(attempt, res));
  const res = await synthWithBackoff(completeCall, user, opts);
  if (!res.ok) {
    return {
      ok: false,
      code: res.reason === "not-configured" ? "RT_E_LLM_NOT_CONFIGURED" : (res.code ?? "RT_E_LLM_REJECTED"),
      error: res.error ?? res.reason ?? "synthesis call failed",
    };
  }
  let envelope = parseSynthesisEnvelope(res.text);
  if (envelope === null) {
    const repair = await completeCall(p6SynthesisRepairPrompt(treeFailure), opts);
    if (repair.ok) envelope = parseSynthesisEnvelope(repair.text);
  }
  if (envelope === null) {
    return { ok: false, code: "RT_E_LLM_REJECTED", error: "model returned an unparseable synthesis envelope after one repair attempt" };
  }
  let validation = validateSynthesisModule(envelope.module, envelope.exports, signatureNames);
  if (!validation.ok) {
    const masked = maskLiteralsAndComments(envelope.module);
    const hit = forbiddenPrimitiveHit(masked);
    const unbound = unboundExportNames(envelope.module, envelope.exports);
    const repairableForbidden = hit.soft !== null && hit.hard === null;
    const missingSig = missingSignatureNames(envelope.exports, signatureNames);
    // 216f (T-09/T-15): same two new bounded repair classes as the single-module
    // path — prose-in-code and Math.random each get ONE re-prompt naming the
    // exact defect; a repeat is refused. This is the LLM CHUNK gate: the only
    // modules that ever reach it are model-authored chunk envelopes.
    const nondet = nondeterministicPrimitiveHit(masked);
    const prose = proseLineHits(envelope.module);
    // T-107.1 (216r · W7-L1): the patch-first delta repair, ONLY when the
    // caller opted in and the defect is a LOCALIZED text edit (soft forbidden
    // token / non-deterministic primitive / prose). A landed delta is applied
    // by `applyStrReplace` against the module the model just produced for THIS
    // chunk and revalidated by the SAME deterministic validator below; every
    // non-landing outcome (no excerpt, non-delta reply, coded refusal, patched
    // module still invalid) falls through to the legacy full-rewrite repair
    // with its prompt bytes unchanged.
    // 216r (W9-L2 · DEFECT 2): the single-module-site fix, mirrored — a landed
    // delta that REVALIDATES leaves no legacy repair class open on the patched
    // bytes, so `patchLanded` short-circuits the legacy block below (whose
    // parseable reply used to overwrite the patched chunk envelope: 216r §2
    // defect 2).
    let patchLanded = false;
    if (patch !== undefined) {
      const defect = patchableDefect({
        source: envelope.module,
        masked,
        softToken: repairableForbidden ? hit.soft : null,
        unbound,
        missingSig,
        nondet,
        prose,
      });
      if (defect !== null) {
        const patched = await attemptPatchRepair({
          previous: envelope,
          defect: defect.defect,
          lines: defect.lines,
          signatureNames,
          completeCall,
          opts,
          treeFailure,
          path: patch.path,
          log: patch.log,
        });
        if (patched !== null) {
          envelope = patched;
          validation = validateSynthesisModule(envelope.module, envelope.exports, signatureNames);
          patchLanded = validation.ok;
        }
      }
    }
    if (!patchLanded && (unbound.length > 0 || repairableForbidden || missingSig.length > 0 || nondet !== null || prose.length > 0)) {
      const repairPrompt = unbound.length > 0
        ? p6SynthesisExportRepairPrompt(unbound, treeFailure)
        : repairableForbidden
          ? p6SynthesisForbiddenRepairPrompt(hit.soft ?? "unknown", treeFailure)
          : missingSig.length > 0
            ? p6SynthesisSignatureRepairPrompt(missingSig, treeFailure)
            : nondet !== null
              ? p6SynthesisNondeterministicRepairPrompt(nondet, treeFailure)
              : p6SynthesisProseRepairPrompt(prose, treeFailure);
      const repair = await completeCall(repairPrompt, opts);
      if (repair.ok) {
        const repaired = parseSynthesisEnvelope(repair.text);
        if (repaired) {
          envelope = repaired;
          validation = validateSynthesisModule(envelope.module, envelope.exports, signatureNames);
        }
      }
    }
  }
  if (!validation.ok) return { ok: false, code: validation.code, error: validation.error };
  // Legacy last-mile parity: mechanical binding injection for declared-but-
  // unbound claimed exports (a no-op on an already-valid module).
  const injected = injectMissingExports(envelope.module, envelope.exports);
  if (injected.changed) {
    const reValidated = validateSynthesisModule(injected.source, envelope.exports, signatureNames);
    if (reValidated.ok) envelope = { ...envelope, module: injected.source };
  }
  return { ok: true, envelope };
}

/**
 * fixes/144 (M2): honest partial refusal for the chunked path. Prior chunks'
 * accepted files stay REAL on the returned project (generatedTree +
 * generatedSource = the assembled partial entry + modelRoute deepseek-pro —
 * the pro tier really synthesized them), and a p6.synthesis.refused warn log
 * records the refused chunk index (chunkIndex -1 = all chunks accepted but
 * the tree-level brief-fit gate failed). When chunk 0 itself refuses nothing
 * real exists — the deterministic floor stands untouched. Never a fabricated
 * full pass.
 */
function partialTreeRefuse(
  project: Project,
  accepted: { path: string; source: string; exports?: readonly string[]; reqTrace?: Readonly<Record<string, string>> }[],
  chunkIndex: number,
  chunkTotal: number,
  code: ErrorCode,
  detail: string,
): Project {
  const materialized = accepted.length > 0 ? materializeImportableTree(accepted) : null;
  const base: Project =
    materialized !== null
      ? {
          ...project,
          generatedTree: materialized.files.map((f) => toGeneratedTreeFile(f.path, f.source)),
          generatedSource: materialized.entrySource,
          modelRoute: "deepseek-flash",
        }
      : project;
  const where = chunkIndex < 0 ? `tree ${chunkTotal}/${chunkTotal} chunks accepted` : `chunk ${chunkIndex + 1}/${chunkTotal} refused`;
  return refuse(base, code, `${where} · ${detail}`);
}

/**
 * fixes/144 (M2): honest success state for a fully accepted multi-chunk tree.
 * Records generatedTree (per-file hash + attempt 0), generatedSource = the
 * assembled entry, the persisted implementationSpec, modelRoute deepseek-pro,
 * one kind-"code" artifact whose body is the assembled entry (titled with the
 * file count — never claims machine verification: lastTest stays untouched, so
 * no "tested" stamp is fabricated at synthesis, BEFORE the tree machine-run
 * lane has executed anything). fixes/147 (E2): the honest "tested" promotion
 * for a chunked tree is mintTreeRunTested() — the post-tree-run seam callers
 * (driveP6Journey / run-eval) invoke ONCE a green treeRun over the assembled
 * entry has actually executed specs. Synthesis alone can never mint it.
 */
function treeUpgraded(
  project: Project,
  specRecord: NonNullable<Project["implementationSpec"]>,
  accepted: { path: string; source: string; exports: string[]; reqTrace: Record<string, string> }[],
  entry: string,
  chunkCount?: number,
): Project {
  const treeFiles = accepted.map((f) => toGeneratedTreeFile(f.path, f.source));
  const chunks = typeof chunkCount === "number" && chunkCount > 0 ? chunkCount : accepted.length;
  const manifest = treeFiles
    .map((f) => `// ${f.path} · fnv1a ${f.hash} · ${f.source.split("\n").length} lines · attempt ${f.attempt}`)
    .join("\n");
  const evidenceHash = String(fnv1a(entry));
  const codeArtifact: Artifact = {
    id: `6-code-tree-${evidenceHash.slice(0, 8)}`,
    phase: 6,
    kind: "code",
    title: `Generated source tree (LLM — ${treeFiles.length} files, chunked synthesis)`,
    body: `${manifest}\n\n${entry}`,
    language: "javascript",
  };
  const memoryId = "6-episodic-tree-0.9";
  const memory = [
    ...(project.memory ?? []).filter((m) => m.id !== memoryId),
    {
      id: memoryId,
      kind: "episodic" as const,
      phase: 6 as PhaseId,
      text: `Keyed P6 chunked synthesis: ${treeFiles.length} file(s) in ${chunks} chunk(s) (deterministic per-file validation; machine tree-run lands in the tree-run lane)`,
      score: 0.9,
      source: "engine" as const,
    },
  ].slice(0, 80);
  const artifacts = [
    ...(project.artifacts ?? []).filter(
      (a) =>
        !(a.phase === 6 && ((a.kind as unknown as string) === "code" || (a.kind as unknown as string) === "verify")),
    ),
    codeArtifact,
  ];
  return {
    ...project,
    generatedSource: entry,
    generatedTree: treeFiles,
    // 216 (T-06 / F-02): the artifact just CHANGED, so any prior `tested` stamp
    // describes a template that no longer exists. A stale green stamp outliving
    // its artifact is exactly how a shipped packet came to record
    // `lastTest.ok:true` while the shipped test exited 1. Invalidate here; the
    // ONLY re-mint path is mintTreeRunTested() after a genuinely green tree-run.
    // Over-conservative by design: an identical-tree synthesis also drops the
    // stamp, which is the honest direction (never claim tested when unsure).
    lastTest: null,
    implementationSpec: specRecord,
    modelRoute: "deepseek-flash",
    memory,
    artifacts,
    logs: [
      ...(project.logs ?? []),
      {
        ts: Date.now(),
        phase: 6 as PhaseId,
        level: "info" as const,
        event: "p6.synthesis",
        detail: `Chunked synthesis: ${treeFiles.length} file(s) in ${chunks} chunk(s) · deterministic per-file validation · assembled entry ${entry.length} chars · machine tree-run is the tree-run lane's step`,
      },
    ].slice(-200),
  };
}

// --- fixes/147 (E2): tested-equivalent mint after a GREEN tree-run -----------
// Divergence #2 (fixes/146): a chunked tree (>8 signatures) could never mint a
// "tested" lastTest — only the ≤8-signature single-module path ran
// verifyAndFixServer and minted label:"tested" — so p6-verified / M3 / M4 were
// unsatisfiable for every chunked tree, and a keyed enforceDod run hard-stalled
// at the P6 DoD park. The mint cannot live inside treeUpgraded(): at synthesis
// the machine tree-run has NOT executed anything, so a stamp there would be
// fabricated. This seam is the honest post-run companion: the caller
// (driveP6Journey's converged branch, or run-eval's single-synthesis flow)
// invokes it ONCE with the real TreeRunOutcome.

/** Deterministic evidence summary of a green TreeRunOutcome (rel spec paths +
 *  verdicts + counts only — never the run dir, timings or detail prose, so the
 *  fnv1a evidence hash reproduces across hosts). `executed` is the honesty
 *  gate: at least one spec file actually ran AND executed ≥1 assertion. */
export function treeRunTestedEvidence(o: TreeRunOutcome): {
  executed: boolean;
  specFiles: number;
  assertions: number;
  summary: string;
} {
  const specs = (Array.isArray(o.tests) ? o.tests : []).filter((t) => t.run === "pass");
  const assertions = specs.reduce((n, t) => n + (t.tests?.pass ?? 0), 0);
  const run = o.run;
  const summary = [
    `compile ${o.compile.passed}/${o.compile.checked} file(s)`,
    `${specs.length} spec file(s) pass · ${assertions} assertion(s)`,
    ...(run ? [`entry ${run.kind} ${run.run}`] : []),
  ].join(" · ");
  return { executed: specs.length > 0 && assertions > 0, specFiles: specs.length, assertions, summary };
}

/**
 * fixes/147 (E2): mint the E-07 "tested" lastTest after a green tree-run —
 * honest ONLY when the run actually executed specs (outcome.ok AND ≥1 spec
 * file with run:"pass" AND ≥1 executed assertion). Detail = the deterministic
 * run summary ("tree-run green: …"); evidenceHash = fnv1a over that summary.
 *
 * Honesty gates (never a fabricated pass):
 *  - a RED outcome returns the SAME project reference (the journey records the
 *    failure tail — a mint here would be a fake pass);
 *  - a project already carrying a machine "tested" stamp (the ≤8-signature
 *    verifyAndFixServer path) is returned unchanged — real verify evidence
 *    outranks the tree-run summary;
 *  - an ok tree-run that executed NO specs (UI-shell/webapp tree without
 *    executable specs, or a no-spec headless tree) is NOT minted — the honest
 *    current state stands and a coded `p6.tree.tested.skipped` warn log
 *    explains why, so a later reader never mistakes the absence for a pass.
 */
export function mintTreeRunTested(project: Project, outcome: TreeRunOutcome): Project {
  if (!outcome || outcome.ok !== true) return project;
  const current = project.lastTest as { label?: string } | null | undefined;
  if (current && current.label === "tested") return project;
  const ev = treeRunTestedEvidence(outcome);
  const logs = project.logs ?? [];
  if (!ev.executed) {
    const skipNote = `tree-run ok but no executable spec ran (${ev.specFiles} spec file(s), ${ev.assertions} assertion(s)${
      outcome.run ? `; entry ${outcome.run.kind} ${outcome.run.run}` : ""
    }) — no "tested" stamp minted (honest: nothing executed headless)`;
    return {
      ...project,
      logs: [
        ...logs,
        {
          ts: Date.now(),
          phase: 6 as PhaseId,
          level: "warn" as const,
          event: "p6.tree.tested.skipped",
          detail: skipNote,
        },
      ].slice(-200),
    };
  }
  const evidenceHash = String(fnv1a(ev.summary));
  return {
    ...project,
    lastTest: testedLastTestStamp(`tree-run green: ${ev.summary}`, evidenceHash),
    logs: [
      ...logs,
      {
        ts: Date.now(),
        phase: 6 as PhaseId,
        level: "info" as const,
        event: "p6.tree.tested",
        detail: `tested-equivalent minted after green tree-run · ${ev.summary} · fnv1a ${evidenceHash.slice(0, 8)}`,
      },
    ].slice(-200),
  };
}
