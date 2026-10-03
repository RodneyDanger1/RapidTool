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
//      upgraded); fixes/148 (F1 — tree-trigger scope): every MULTI-FILE
//      delivery kind (`app` = webapp / `tool` = CLI-agent / `game` = playable;
//      `library` and `service` are single-entry) and every >8-signature spec
//      routes to the chunked tree REGARDLESS of signature count — a
//      ≤8-signature webapp brief must never fall into the single-module path
//      (fixes/145 M1=0 root cause); >8 signatures ⇒ one call PER chunk
//      (216 T0.1: the FLASH tier — fixes/125's "pro is stronger" premise is
//      inverted by V4.1-Flash; json:true, thinking:false — fixes/156 E1: a
//      structured json envelope needs OUTPUT budget, not chain-of-thought, so
//      pro reasoning is DISABLED instead of out-budgeted; maxTokens 32 000)
//      with the
//      shared brief + full req list + THAT chunk's
//      signatures + the earlier chunks' exported top-level names + reqTrace
//      (so later files call earlier exports by name in the assembled bundle)
//      + the capped DATA CONTRACTS block rendered from project.contracts
//      (R10-f01 · W39 Z2: both user-prompt builders, non-empty-gated — an
//      absent/empty contract keeps the exact legacy prompt bytes; ≤12 rows
//      with a visible elision marker past the cap),
//      deterministic per-file validation, deterministic assembly into
//      Project.generatedTree (per-file fnv1a hash + attempt:0) with
//      generatedSource = the materialized ENTRY file's own bytes
//      (`materializeImportableTree`: every tree — one chunk or many — is
//      rewritten to real ESM, with `src/generated.ts` as the barrel entry;
//      fixes/258 closed the single-chunk identity path that shipped raw
//      CommonJS into the `"type":"module"` tenant and killed the emitted spec
//      at import; FM-01 (W37 Y1) closed the LAST raw-CJS path — the
//      single-module branch below materializes at synthesis time through the
//      same function, so every synthesis is ESM BEFORE emit and the emit-time
//      residue guard stays purely a backstop). A chunk refusal keeps
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
//      generatedSource = the materialized ESM entry (the barrel; the verified
//      module's own bytes live in the tree's chunk file — FM-01), lastTest
//      {label:"tested", evidenceHash}, the kind-"code" artifact "Generated
//      module (LLM, machine-verified)", a "verify" outcome artifact, the
//      persisted implementationSpec, and modelRoute derived from the SERVED
//      model id (FM-04; expand/oracle are request-pinned flash). On ANY failure
//      (unparseable envelope ×2, validation, brief-fit, verify failed/error,
//      chunk refusal) the deterministic floor stands and a `p6.synthesis.refused`
//      warn log records the RT_E_* code — never a fabricated pass; a multi-chunk
//      refusal keeps the prior chunks' real files + generatedSource = the
//      assembled partial entry (honest partial). Every synthesis-model call
//      also stamps a bounded `p6.synthesis.attempt` journal event (chunk
//      index/count · attempt · timeoutMs · outcome ok/refused/timeout + the
//      model's refusal-text excerpt — fixes/153 P1) so a reader sees WHY each
//      call failed. W45/331-4: when a declared spec-graph job's label is named
//      by no typeSignature, `treeChunkPlanCensus` counts it and a bounded
//      `p6.tree.shortfall` warn row names it — a declared job is never silently
//      absent from the plan. A reply that ARRIVED but could not be READ as a
//      patch or synthesis envelope stamps a bounded `p6.synthesis.envelope.unreadable`
//      warn entry (on the patch level: the existing `p6.repair.patch.refused`
//      event) carrying RT_E_LLM_REJECTED + a bounded received-text excerpt —
//      fixes/217k (216y G6: the silent-null sink; absent/blank replies stay
//      unlogged, so "no output" and "unreadable output" are distinguishable).
//      W46/332-1 (P1): `validateSynthesisModule` also refuses an un-awaited
//      async call whose result is used as a value (property read, destructure,
//      or stored-then-read; a `Promise.resolve().then` body binding one), with
//      ONE bounded await re-prompt — the real keyed tree's `src/jobs/rehab.ts`
//      read `.ok` off the un-awaited async `getProperty` and reded its spec.
//      W46/332-1 (P2): the plan census partitions by label and the persisted
//      shortfall row carries declared/planned/unbound counts, so a coverage
//      gap is deterministic and legible, never random.
//      W52/338-1: the plan is SPEC-DRIVEN — `reconcilePlanTypeSignatures` maps
//      every declared spec-graph job to a planned src/jobs/<label>.ts file by
//      rule (the model's bound signatures when present, else the deterministic
//      `deriveTypeSignatures` floor), and the persisted implementationSpec is
//      the reconciled set, so p6-arch/census judge the same rule. A declared
//      job is never dropped because the model happened not to name it.
//      A forceHuman P6
//      gate (failed template sandbox, R3/B-03) is never machine-cleared.
//
// Zero new runtime deps. Imported by engine.ts through a runtime dynamic
// import (TanStack import-protection: *.server.* must never reach the client
// bundle). Deps are injectable for tests (the repo's fake-injection
// precedent, sandbox.test.ts).
//
// Run: node --experimental-strip-types --test src/lib/codegen.server.test.ts
// ---------------------------------------------------------------------------
import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { deriveTypeSignatures, fnv1a } from "./algorithms.ts";
import { exportedNamesOf } from "./algo-tools.ts";
import { briefNounHits, identifierHits, maskLiteralsAndComments } from "./sandbox.ts";
import { applyStrReplace, type PatchRequest } from "./patch.ts";
import {
  completeDeepSeek,
  DEEPSEEK_MODELS,
  isDeepSeekConfigured,
  type DeepSeekCompleteOptions,
} from "./deepseek.server.ts";
import { expandBrief, expandedSpecViolations, EXPAND_LESSON_RANK_LIMIT, lessonLinesForBrief, type ExpandBriefResult } from "./prompt-engine.ts";
import { selectLessons, type RankableLessonRow } from "./knowledge.ts";
import { verifyAndFixServer, type VerifyOutcome } from "./verify.server.ts";
import type { ErrorCode } from "./errors.ts";
import type { LlmResult } from "./llm.ts";
import {
  recordSpend,
  sessionTokenBudget,
  totalTokens,
  type TokenLedger,
} from "./token-ledger.ts";
// R12-f04 (fixes/271): the P6 phase max lives in the client-safe constants
// table; this module consumes it (single source — no literal fork).
import { P6_PHASE_MAX_MS } from "./rt-events.ts";
// fixes/343-1: the opt-in best-of-N policy (count resolution + deterministic
// lazy selection). The gates it selects against stay in this module.
import {
  candidatesLogDetail,
  resolveSynthesisCandidates,
  selectBestOfN,
  type CandidateEvaluation,
} from "./synthesis-policy.ts";
// fixes/343-1 follow-up (343-2 STOP-and-REPORT): the deterministic repo map —
// the ranked, budgeted outline of the persisted tree, fed to the PRIMARY chunk
// prompt so a resumed/re-synthesized run extends a tree it can see. Client-safe
// and dependency-free, so this server module may import it freely.
import { repoMapForProject } from "./repo-map.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";
// fixes/341-1: the real declared-`typecheck` runner (the tree-run's own
// compiler seam) + the pure scaffold emitter the pre-seal gate materializes
// the candidate tree with. RUNTIME imports: the gate genuinely runs `tsc`.
import { typecheckDir, type TreeProjectScriptVerdict } from "./compile-check.server.ts";
import { scaffoldProject } from "./scaffold.ts";
import type { Artifact, ArtifactKind, DataContract, GeneratedTreeFile, JsonLog, ModelRoute, PhaseId, Project } from "./types.ts";
// T5.4 (W18 LANE 5): the artifact-provenance shape + vocabulary live in io.ts
// (the serialization boundary that validates and round-trips them). TYPE-ONLY
// import — erased at runtime, so this server module gains no new runtime edge.
import type { ArtifactProvenance } from "./io.ts";

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
export const P6_SYNTH_TIMEOUT_MS = P6_PHASE_MAX_MS;
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
 * R12-f01: prior-render cap. Every later chunk re-sent EVERY prior file line
 * (O(chunks²) prompt growth); the assembled module binds all of them as
 * parameters regardless, so the render only needs the MOST RECENT exports.
 * Keep the last N (most recently generated = most likely to be called) and
 * mark the elision visibly — never silently drop context.
 */
export const P6_SYNTH_PRIOR_MAX_FILES = 12;

/**
 * fixes/343-1 follow-up (343-2 STOP-and-REPORT): the char budget for the repo
 * map block appended to the PRIMARY chunk prompt. `repo-map.ts` clamps the
 * render so `rendered.length <= budget`; 1200 keeps the block within the same
 * bounded-context discipline as the other appended blocks.
 */
export const P6_SYNTH_REPO_MAP_BUDGET = 1_200;

/**
 * R12-f01: per-chunk prompt char budget for the PRIOR block. A pathological
 * prior list (200 files, or one 60k-char exports line) must not blow the
 * envelope: rendering stops with a visible marker once the block would push
 * the prompt past this budget. Char length === byte length for the ASCII
 * prompt shapes here; the marker names the budget so the cut is auditable.
 */
export const P6_SYNTH_PROMPT_MAX_CHARS = 60_000;

/**
 * R10-f01 (W39 Z2 · G3's wire): the DATA CONTRACTS render cap. project.contracts
 * reached scaffold/packet/engine/diagram but never the synthesis prompt — the
 * model wrote module bodies blind to the A6 contract. The prompt renders at
 * most this many contract rows (entity + endpoint combined, entities first);
 * beyond the cap a visible `…[CONTRACTS-ELIDED: …]` marker names the elision —
 * never a silent drop.
 */
export const P6_SYNTH_CONTRACTS_MAX_ROWS = 12;

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
 * W23-262 (B1): arithmetic-minus code shape — `<operand> <spaced minus> <operand>`
 * with an identifier-ish, ≥2-char operand on each side. `-` is the ONE arithmetic
 * operator whose character is not in PROSE_CODE_CHARS, so a legal expression whose
 * only punctuation is a spaced minus still reads as sentence-shaped ASCII text and
 * tripped the prose gate. Proven cost: run #2's chunk 2/7 was refused as
 * `prose-in-code … line 40: "balance: amountDue - amountPaid"` (fixes/255 §2); the
 * refusal cascaded through `partialTreeRefuse` into a 1-file partial tree and the
 * emitted suite could then only report capability.9–36 red (fixes/260 §2: 43 tests,
 * 9 pass / 28 fail / 6 skip). A spaced minus between two ≥2-char operands is a code
 * position: none of the pinned prose fixtures (`LEAKED_BLOB_PROSE`, the chunk-e2e
 * blob) carries that shape, and the legal shipped-code shapes it must never refuse
 * (object-literal entries like `balance: amountDue - amountPaid`, `return net -
 * fees;`, budget/payroll arithmetic) all do. The deliberate narrowing is the trade
 * this fix makes — a legal-code false refusal costs a whole chunk (and, via the
 * partial-tree cascade, up to 8 capability rows), while the residual prose shape it
 * no longer catches (a spaced dash between two ≥2-char English words) is rare in
 * the deliberation this gate exists for.
 */
/**
 * W45/331-4 (class fix): one arithmetic operand. The member-expression
 * alternative (`a.index`, `this.total`) is the missing form — the pre-fix
 * `[A-Za-z_$0-9][\w$]+` cannot cross a `.`, so `return a.index - b.index;`
 * stayed sentence-shaped and was refused as prose (the repair loop's own
 * `src/jobs/invoice.ts` patch, parent-keyed-findings §3b-2).
 */
const PROSE_ARITH_OPERAND = String.raw`(?:[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+|\d+(?:\.\d+)?|[A-Za-z_$0-9][\w$]+)`;
const PROSE_ARITH_MINUS = new RegExp(String.raw`\b${PROSE_ARITH_OPERAND}\s+-\s+${PROSE_ARITH_OPERAND}\b`);
/**
 * 322 X3 (BUG-4): ternary-expression code shape — a single-line `cond ? a : b`
 * whose arms are single identifier/numeric tokens (unary minus and dotted
 * paths admitted) at the end of the line (optional `;`/`,` terminal). `?`,
 * `:`, `;` and `-` are sentence punctuation to PROSE_LINE_SHAPE and such a
 * line carries no code-significant character at all, so it satisfied every
 * prose floor and was refused as prose — burning EXP03's final synthesis cycle
 * (`prose-in-code … line 78: "return negative ? -cents : cents;"`,
 * 322_e2_monitor §BUG-4). Excluded up front like PROSE_ARITH_MINUS, end-
 * anchored: a ternary is a whole-expression tail while deliberation prose
 * ends in a sentence terminal (`.`/`!`/`?`) and stays caught.
 *
 * W45/331-4 (class fix): an arm may also be a MASKED quoted literal — it
 * blanks to a whitespace run, so the pre-fix arm pattern (token-only) failed
 * on `arvNote: cond ? undefined : 'ARV …',` and the line was refused as prose
 * (the repair loop's own `list-line-items.ts` patch, §3b-2). An arm is now
 * token OR whitespace run. Accepted residual (same trade as W23-262/B1): a
 * deliberation line ending exactly `word? word: word` (or a masked literal
 * arm) with NO sentence terminal is no longer flagged — rare.
 */
const PROSE_TERNARY_ARM = String.raw`(?:\s+|-?(?:\d+(?:\.\d+)?|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*))`;
const PROSE_TERNARY = new RegExp(String.raw`\?\s*${PROSE_TERNARY_ARM}\s*:\s*${PROSE_TERNARY_ARM}\s*[;,]?\s*$`);

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
 * prose-as-code always can. The two legal shapes the raw sentence test WOULD
 * match are excluded up front: a spaced arithmetic minus between two operands
 * (`balance: amountDue - amountPaid`) via PROSE_ARITH_MINUS (W23-262/B1: that
 * exact line refused run #2's chunk 2/7 and cascaded into 28 honest coverage
 * reds in the emitted suite; fixes/255 §2 + fixes/260 §2), and a single-line
 * ternary `cond ? a : b` with single-token arms (`return negative ? -cents :
 * cents;`) via PROSE_TERNARY (322 X3, BUG-4: that exact line refused EXP03's
 * final synthesis cycle; 322_e2_monitor §BUG-4).
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
    // W23-262 (B1): a spaced arithmetic minus with a ≥2-char operand on each side
    // is a code position (see PROSE_ARITH_MINUS) — never prose. Tested on the
    // MASKED text, so a dash inside a string/comment was already blanked above.
    if (PROSE_ARITH_MINUS.test(flat)) continue;
    // 322 X3 (BUG-4): end-anchored ternary expression — code, never prose (see
    // PROSE_TERNARY above). Tested on the MASKED text like PROSE_ARITH_MINUS,
    // so arms inside strings/comments are already blanked away.
    if (PROSE_TERNARY.test(flat)) continue;
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
    "Worked example (shape only — the content is yours; note every parameter and the",
    "return type are ANNOTATED — see rule 10):",
    '{"module":"function add(a: number, b: number): number { return a + b; }\\nmodule.exports.add = add;","exports":["add"],"reqTrace":{"req-1":"add"}}',
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
    // W49/335-1: the enforcement claim is scoped to the token the validator
    // actually matches (`Math.random`, NONDETERMINISTIC_PRIMITIVE). The broader
    // determinism duty stays a model instruction, not an over-claim: the
    // validator never refuses `Date.now()`/`new Date()` (a legitimate timestamp
    // use the product may need), so the prompt must not imply it does.
    "2. Zero imports, zero requires, zero external deps. Plain, fully-typed functions only. Assign module.exports. Never use Math.random() (validator-enforced), and avoid any other non-deterministic primitive: ids and values must derive deterministically from the inputs so two identical runs produce identical results.",
    "3. Full JSDoc on every exported function.",
    `4. Never reference these forbidden primitives anywhere in the module (validator-enforced): ${FORBIDDEN_PRIMITIVE_NAMES.join(", ")}.`,
    "5. Mark each requirement you implement with a \"// req-N\" comment on the implementing function.",
    "6. Never test rejection paths inside the module; guards are behavior, not bugs.",
    "7. Do not invent features the brief does not state. Do not soften or drop a stated requirement.",
    // 216f (T-09): the prose-in-code refusal is advertised too — the leaked
    // 23-line deliberation (F-04) shipped because nothing told the model that
    // planning prose in the module body is a refusal, not a style choice.
    "8. Write CODE only — never emit planning prose, deliberation, or \"I'll write the code now\" into the module (validator-enforced): every line must be a real JavaScript statement.",
    // W46/332-1 (P1): the async-await rule, advertised because the validator
    // enforces it (215b drift-proof principle). The real keyed tree's
    // `src/jobs/rehab.ts` called an earlier file's async `getProperty` without
    // `await` and read `.ok` off the returned Promise (undefined), floating the
    // rejection past the test and reding the whole spec file.
    // W50/336-1: the enforcement claim is SCOPED to what the guard can actually
    // see — a direct call, a `this` receiver inside the declaring class, and the
    // optional-call tail. A call through a named receiver, an indirect
    // invocation, or a Promise-returner not spelled `async` is outside the guard
    // (documented on `unawaitedAsyncValueUses`), so the prompt must not imply the
    // validator catches those (the same over-claim 335-1 4B corrected for rule 2).
    "9. When you call a function that is ASYNCHRONOUS (declared `async` — whether an earlier file exports it or this module declares it), you MUST `await` the call before reading any property off its result or destructuring it: `const x = await getProperty(id); x.ok` — never `const x = getProperty(id); x.ok`. An un-awaited async call reads `undefined` off a Promise and leaks an unhandled rejection. The validator refuses this for direct calls, `this`-receiver calls inside the declaring class, and optional calls (`f?.(…)`); it cannot see a call through a named receiver (`obj.m()`), an indirect invocation (`f.call(…)` / `(f)(…)`), or a Promise-returner not spelled `async`, so the duty is yours in those cases.",
    // W52/338-1 follow-up: the emitted tree is compiled with `tsc --noEmit`
    // under `strict: true` (scaffold.ts tsconfigJson) — an unannotated
    // parameter is TS7006 (`noImplicitAny`) and an undeclared named type is
    // TS2304, so a module written in plain JS style fails the product's OWN
    // declared typecheck. The worked example above is annotated for the same
    // reason: the model imitates it (338-3's keyed run hit TS7006 on all 12
    // generated functions; 338-2 reproduced `dispatch.ts(11,21) TS7006`).
    "10. TypeScript STRICT mode is on for the emitted tree (`noImplicitAny`): annotate EVERY function parameter and its return type. Use ONLY built-in types (string, number, boolean, unknown, any, object, `T[]`) or named types you DECLARE in this same module (`type X = {...};` / `interface X {...}`) — never reference a named domain type (e.g. `FlipProjectInput`) unless you declare it here, because an undeclared name fails the compile. Example: `function create(input: { id: string }): Promise<{ id: string }> { ... }`. An unannotated parameter fails the emitted tree's own `tsc --noEmit` compile (TS7006), which blocks the product.",
    // W56/342-1 (keyed P6 convergence): the measured strict-ts classes that stop
    // keyed runs at P6 — TS2322 (a helper annotated `number` returning a
    // `Record<string, unknown>`), TS2749 (`TextDecoder` used as a type under a
    // value-only global) and TS2440 (a local declaration colliding with an
    // import). Rule 10 named only TS7006/TS2304, so the model was never told the
    // shapes a bounded repair had to correct. W57/343-1's keyed best-of-N probe
    // added a fourth, measured live: TS2323 (`Cannot redeclare exported
    // variable`) — candidate 1 declared `resolvePort`/`validateOrderEvent`
    // twice. Real `tsc` is the gate, not the validator, so the rule claims no
    // enforcement. The compiler report already rides the repair re-prompt; this
    // names the classes so the retry can act.
    "11. The emitted tree is compiled by real `tsc --noEmit` under `strict: true`; a type error blocks the product. Four classes it refuses, with the required shape for each: (a) TS2322 ASSIGNMENT TYPE MISMATCH — an annotation must EXACTLY match the value it describes: never annotate a function as returning `number` (or a variable as `number`) while its body returns a structured value such as `Record<string, unknown>`, an object literal, or an array; type such a helper `Record<string, unknown>` (or a `type`/`interface` you declare), and if you mean one numeric field, return that field rather than the whole record. (b) TS2749 VALUE USED AS A TYPE — never put a runtime VALUE in a type position: the global `TextDecoder` is a value-only constructor here, so `: TextDecoder` on a parameter, return or variable fails; every type must be one of `string | number | boolean | unknown | any | object | T[]` (or a `type`/`interface` you DECLARE in this module) — use `number[]`/`Uint8Array` for bytes and `string` for decoded text, and construct `new TextDecoder()` only at runtime. (c) TS2440 IMPORT/LOCAL CONFLICT — never declare a name locally (`function`/`class`/`const`/`type`/`interface`) that is also imported or declared under the same name; with zero imports (rule 2) each helper is declared exactly ONCE, under a name no earlier file exports. (d) TS2323 DUPLICATE EXPORTED VARIABLE — `Cannot redeclare exported variable`: declare each exported variable exactly ONCE at top level. Never declare the same exported `const`/`let`/`var`/`function`/`class` name twice in one module, and never reuse a name an earlier file already exports; a second top-level declaration of an exported name fails the compile — emit ONE declaration, then assign `module.exports.<name>` once.",
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

// --- 217k (W12 LANE B · fixes/216y §2.3 G6): the coded unreadable-reply signal.
// Before this block, BOTH envelope readers below (parseSynthesisPatchEnvelope /
// parseSynthesisEnvelope) returned a bare `null` when a reply ARRIVED but could
// not be READ (JSON.parse failure or the wrong shape) — no log, no code — so an
// unparseable model reply was indistinguishable from "the model said nothing"
// and keyed repair/synthesis degraded silently. The readers now report every
// such read failure through an optional sink while keeping their return
// contract byte-identical (`null` still means "no envelope" to every caller);
// an absent/blank reply stays SILENT, so "no output" remains its own state. The
// signal carries the registry code (RT_E_LLM_REJECTED — the same code the
// callers' terminal refusals already use), a BOUNDED excerpt of what was
// actually received, and which reader could not read it. It never claims "the
// model refused": the truth recorded is "we could not read it".

/** Bounded size of the received-text excerpt a read failure carries. */
export const ENVELOPE_READ_EXCERPT_MAX = 160;

export type EnvelopeReadFailure = {
  /** Registry code for an arrived-but-unreadable LLM reply (errors.ts). */
  code: ErrorCode;
  /** Which reader could not read the reply. */
  source: "parseSynthesisEnvelope" | "parseSynthesisPatchEnvelope";
  /** Where the read stopped: JSON.parse threw, or the JSON was the wrong shape. */
  reason: "unreadable-json" | "unexpected-shape";
  /** First ENVELOPE_READ_EXCERPT_MAX chars of what was received, whitespace-collapsed. */
  excerpt: string;
  /** Total characters received (the excerpt is a bounded window of this). */
  receivedChars: number;
  /** The coded human line (a log-detail body): reader · truth · bounded excerpt. */
  message: string;
};

/** Receives the coded signal for every ARRIVED-but-unreadable reply. */
export type EnvelopeReadSink = (failure: EnvelopeReadFailure) => void;

/** Build the coded read-failure signal: RT_E_LLM_REJECTED + the reader + a
 *  bounded excerpt of the received bytes. `why` names the concrete read rule
 *  that failed ("JSON.parse failed: …", "the payload is not a JSON object", …)
 *  — never a story about the model's intent. Pure + total. */
function readFailure(
  source: EnvelopeReadFailure["source"],
  text: string,
  reason: EnvelopeReadFailure["reason"],
  why: string,
): EnvelopeReadFailure {
  const excerpt = text.replace(/\s+/g, " ").trim().slice(0, ENVELOPE_READ_EXCERPT_MAX);
  return {
    code: "RT_E_LLM_REJECTED",
    source,
    reason,
    excerpt,
    receivedChars: text.length,
    message: `${source}: the reply was received but could not be read — ${why} (${text.length} chars; excerpt "${excerpt}")`,
  };
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
 *
 * 217k (G6): a NON-BLANK reply that cannot be READ (JSON.parse failure, or a
 * payload that is neither a patch block nor the legacy module envelope)
 * reports the coded EnvelopeReadFailure through the optional `sink`. An
 * absent/blank reply and a readable legacy module envelope (the documented
 * continuation, not a read failure) stay silent.
 */
export function parseSynthesisPatchEnvelope(text: unknown, sink?: EnvelopeReadSink): PatchRepairEnvelope | null {
  if (typeof text !== "string") return null;
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (cleaned.length === 0) return null; // blank reply — "no output", not a read failure
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch (err) {
    const why = err instanceof Error && err.message ? `JSON.parse failed: ${err.message.replace(/\s+/g, " ").trim().slice(0, 120)}` : "JSON.parse failed";
    sink?.(readFailure("parseSynthesisPatchEnvelope", text, "unreadable-json", why));
    return null;
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    sink?.(readFailure("parseSynthesisPatchEnvelope", text, "unexpected-shape", "the payload is not a JSON object"));
    return null;
  }
  const block = (obj as Record<string, unknown>).patch;
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    // A legacy module envelope is the DOCUMENTED non-delta continuation (the
    // caller keeps the full-rewrite repair path) — readable, not a failure.
    const legacyModule = (obj as Record<string, unknown>).module;
    if (typeof legacyModule === "string" && legacyModule.trim().length > 0) return null;
    sink?.(
      readFailure(
        "parseSynthesisPatchEnvelope",
        text,
        "unexpected-shape",
        "the payload has no `patch` block and is not a legacy module envelope",
      ),
    );
    return null;
  }
  const b = block as Record<string, unknown>;
  const oldStr = typeof b.oldStr === "string" ? b.oldStr : "";
  const newStr = typeof b.newStr === "string" ? b.newStr : null;
  if (oldStr.length === 0 || newStr === null) {
    sink?.(
      readFailure(
        "parseSynthesisPatchEnvelope",
        text,
        "unexpected-shape",
        oldStr.length === 0 ? "the `patch` block carries an empty `oldStr`" : "the `patch` block has no string `newStr`",
      ),
    );
    return null;
  }
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

/** 217k (W12 LANE B · fixes/216y §2.3 G6): the warn entry for a reply that
 *  ARRIVED but could not be read as a synthesis envelope — the visible half of
 *  the silent-sink fix. Deliberately NOT `p6.synthesis.refused`: that event is
 *  the TERMINAL refusal census (read by headless's codegen-refusal detail,
 *  run-eval's failure check and judgment's risks), and a first reply a later
 *  bounded repair rescued must not read as a refused cycle. Same bounded
 *  refusal-log shape as its neighbours: coded detail, optional path prefix,
 *  400-char cap. */
export function envelopeReadLogEntry(failure: EnvelopeReadFailure, path?: string): JsonLog {
  const clean =
    failure && typeof failure.message === "string" && failure.message.trim()
      ? failure.message.replace(/\s+/g, " ").trim()
      : "unreadable reply";
  const code = failure && typeof failure.code === "string" ? failure.code : "RT_E_LLM_REJECTED";
  return {
    ts: Date.now(),
    phase: 6 as PhaseId,
    level: "warn",
    event: "p6.synthesis.envelope.unreadable",
    detail: `${path ? `${path} · ` : ""}${code} · ${clean.slice(0, 400)}`,
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
  // FM-03 (W37 Y1): the patch repair is a bounded repair call too — its spend
  // is metered like the rest. A budget stop refuses the patch (recorded on the
  // caller's bounded sink); the caller's legacy repair path then surfaces the
  // coded stop through its own accounting. TODO(FM-03b): thread a terminal
  // stop through attemptPatchRepair's result shape so the follow-up call is
  // skipped entirely (kept out of this window — two callers, byte-parity pins).
  const patchStop = accountRepairUsage(reply);
  if (patchStop) {
    input.log?.(
      patchRefusalLogEntry(
        `RT_E_BUDGET_EXHAUSTED · ${patchStop.error ?? "session token budget exhausted during the patch repair call"}`,
        input.path,
      ),
    );
    return null;
  }
  if (!reply.ok) {
    input.log?.(
      patchRefusalLogEntry(
        `RT_E_LLM_REJECTED · the patch repair call did not succeed (${reply.error ?? reply.reason ?? "unknown"})`,
        input.path,
      ),
    );
    return null;
  }
  // 217k (W12 LANE B · G6): an ARRIVED-but-unreadable reply is recorded through
  // the caller's bounded sink — the SAME `p6.repair.patch.refused` event the
  // apply-validator refusals use (the delta did not land; the legacy
  // full-rewrite repair takes over, byte-identical).
  const delta = parseSynthesisPatchEnvelope(reply.text, (failure) => {
    input.log?.(patchRefusalLogEntry(`${failure.code} · ${failure.message}`, input.path));
  });
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

/** fixes/326 F1b PREP: bounded gate-repair context block for the PRIMARY
 *  synthesis prompt. Deterministic + whitespace-collapsed; absent/blank ⇒
 *  the prompt is byte-identical to the legacy text. */
const REPAIR_GATE_CONTEXT_MAX = 700;
function withGateRepairContext(user: string, gateRepair?: string): string {
  const t = typeof gateRepair === "string" ? gateRepair.replace(/\s+/g, " ").trim() : "";
  if (!t) return user;
  return user +
    `\n\nP6 GATE REPAIR CONTEXT (the previous cycle's tree-run was GREEN; the P6 DoD gate weighed it and REFUSED — implement these recorded unmet requirements with real working code, not renames or padding):\n${t.slice(0, REPAIR_GATE_CONTEXT_MAX)}`;
}

/** fixes/328 F1 (Ledger) PREP-2 READER: bounded previous-refusal context block
 *  for the PRIMARY synthesis prompt. `deps.synthesisRefusal` was produced by
 *  the journey's cycle mapping (headless `p6CycleLiveDeps`, fixes/153 P2) but
 *  read by NOTHING — a cycle that died on a refusal re-synthesized blind to
 *  WHY. This is the reader. The block states honestly what it is: the previous
 *  cycle's refusal class (RT_E_* code) + the model's OWN recorded reason — NOT
 *  a new requirement, so the model corrects the stated cause rather than
 *  inventing scope. Deterministic + whitespace-collapsed; absent/blank ⇒ the
 *  prompt is byte-identical to the legacy text.
 *  W52/339-2: the reader cap was 200 — one TENTH of the refusal budget, so the
 *  failing case + the harness/sanitizer's own reason (which ride past char 200
 *  of a multi-case verify evidence) never reached the next cycle. Raised to the
 *  documented P6_REFUSAL_DETAIL_MAX budget so cycle N+1 sees the same recorded
 *  failure the operator does. */
const P6_SYNTHESIS_REFUSAL_CONTEXT_MAX = 1200;
function withSynthesisRefusalContext(user: string, synthesisRefusal?: string): string {
  const t = typeof synthesisRefusal === "string" ? synthesisRefusal.replace(/\s+/g, " ").trim() : "";
  if (!t) return user;
  return user +
    `\n\nP6 PREVIOUS-REFUSAL CONTEXT (the previous synthesis cycle was REFUSED — this is the refusal class and the model's own recorded reason, NOT a new requirement; correct the stated cause and return a valid envelope):\n${t.slice(0, P6_SYNTHESIS_REFUSAL_CONTEXT_MAX)}`;
}

/** W52/339-2 PREP-3 READER: the PRIMARY-prompt reader for `deps.treeFailure`.
 *  The journey already supplies the previous cycle's recorded failure on this
 *  seam — the tree-run failure tail on a red tree-run, or the codegen refusal
 *  detail when a cycle produced no tree at all (headless driveP6Journey's
 *  `treeTail`). Until now that context reached only the bounded REPAIR
 *  re-prompts (repairTreeFailureTail), so a repair cycle's PRIMARY synthesis —
 *  which re-emits the whole module/tree BEFORE any repair class is even
 *  detected — re-synthesized blind to the failure it was invoked to fix, and
 *  the bounded loop could repeat the same red cycle. This is the reader: the
 *  failure (failing file / failing oracle case + its first not-ok reason) rides
 *  the primary prompt as ONE bounded, whitespace-collapsed block. Recorded
 *  evidence only — it adds no requirement the brief never had. Absent/blank ⇒
 *  the prompt stays byte-identical to the legacy text. */
const P6_TREE_FAILURE_CONTEXT_MAX = 1200;
function withTreeFailureContext(user: string, treeFailure?: string): string {
  const t = typeof treeFailure === "string" ? treeFailure.replace(/\s+/g, " ").trim() : "";
  if (!t) return user;
  return user +
    `\n\nP6 PREVIOUS-CYCLE FAILURE CONTEXT (the prior cycle's recorded tree-run/oracle failure — the failing file or oracle case and its first not-ok reason; repair the stated cause with real working code; this is recorded evidence, NOT a new requirement):\n${t.slice(0, P6_TREE_FAILURE_CONTEXT_MAX)}`;
}

/** fixes/343-1 follow-up (343-2 STOP-and-REPORT): the PRIMARY chunk prompt's
 *  reader for the persisted tree's deterministic repo map (`repo-map.ts`). A
 *  resumed/re-synthesized run then sees the ranked outline of the tree it is
 *  extending (`path: exported symbols · in-degree, size, role`) instead of
 *  re-deriving everything from the brief. Built from `project.generatedTree`
 *  ONLY — the keyless floor's placeholder `generatedSource` is not a tree the
 *  run is extending, so a tree-less project renders nothing and the prompt is
 *  byte-identical to the legacy text (empty `rendered` ⇒ this returns `user`).
 *  The map guarantees no guessed symbols; the render is already ≤ its budget. */
function withRepoMapContext(user: string, rendered: string): string {
  if (!rendered) return user;
  return `${user}\n\nREPO MAP (deterministic outline of the tree so far — path: exported symbols, ranked):\n${rendered}`;
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
    // 325 A3: the FIRST FORM example used to end `"},}.` — a trailing comma
    // inside the object. The prompt demands "JSON ONLY" twice, but its own
    // preferred example was INVALID JSON: a model copying it byte-for-byte
    // produced an unreadable reply (JSON.parse refuses trailing commas), the
    // delta was refused on a technicality and the legacy full-rewrite repair
    // burned the extra call. The example must be parseable JSON — pinned.
    'Return JSON ONLY, FIRST FORM (preferred): {"patch":{"oldStr":"<exact text copied from the quoted source — it must occur EXACTLY once in the module>","newStr":"<the replacement text; empty deletes the matched text>"}}.',
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

/**
 * W45/331-4 (Finding B): repair re-prompt for the cross-chunk duplicate-declaration
 * class — the module declares a top-level name an EARLIER chunk already exports, so
 * the materialized ESM (which imports that export) would fail to load with
 * `SyntaxError: Identifier '…' has already been declared` (the real keyed tree:
 * `src/jobs/flip.ts` imported `estimateARV` from `…/list-line-items.ts` and declared
 * it again at line 546). Names each conflicting identifier + its declaration line +
 * the exporting sibling file, so the model removes/renames its local binding and
 * calls the earlier export directly. ONE bounded attempt; a repeat is refused.
 */
export function p6SynthesisDuplicateDeclRepairPrompt(
  duplicates: readonly CrossChunkDuplicate[],
  treeFailure?: string,
): string {
  const rows = (Array.isArray(duplicates) ? duplicates : []).filter((d) => d && typeof d.name === "string");
  const detail = rows
    .map((d) => `- "${d.name}" — declared at line ${d.line}; already exported by ${d.priorPath}`)
    .join("\n");
  const names = [...new Set(rows.map((d) => d.name))];
  return [
    "Your previous module declares top-level name(s) that an EARLIER file already exports:",
    detail || "(none listed)",
    "The build imports an earlier file's exports into this file as plain bindings; declaring the same name here is a load-time SyntaxError (\"Identifier '…' has already been declared\").",
    `For each name above: DELETE your local declaration and call the earlier export BY NAME (it is already available in this file), or rename your own helper so it collides with no earlier file's exports${names.length ? ` (do NOT reuse ${names.join(", ")})` : ""}. Never import/require anything.`,
    'Return JSON ONLY with the SAME envelope: {"module":"<complete corrected module source>","exports":[...],"reqTrace":{...}}.',
    "Same rules as before: exact typeSignature exports (nothing more, nothing less), zero imports, JSDoc, // req-N markers, no forbidden primitives, no prose, no markdown fences.",
  ].join("\n") + repairTreeFailureTail(treeFailure);
}

/**
 * W46/332-1 (P1): repair re-prompt for the un-awaited-async-value class. Names
 * the async callable, its line, and how the promise was consumed (property read /
 * destructure / stored-then-read / floating inside a `Promise.resolve().then`),
 * and instructs the model to `await` the call. ONE bounded attempt; a repeat is
 * refused. Pure.
 */
export function p6SynthesisAsyncAwaitRepairPrompt(
  uses: readonly AsyncUnawaitedUse[],
  treeFailure?: string,
): string {
  const rows = (Array.isArray(uses) ? uses : []).filter((u) => u && typeof u.name === "string" && Number.isFinite(u.line));
  const detail = rows.map((u) => `- "${u.name}" at line ${u.line} — the call result is used as a value (${u.form}) without await`).join("\n");
  const names = [...new Set(rows.map((u) => u.name))];
  return [
    "Your previous module calls an ASYNCHRONOUS function without `await` and then uses the returned Promise as if it were the resolved value:",
    detail || "(none listed)",
    "The named function(s) return a Promise. Reading a property off that Promise yields `undefined`, and the call's real rejection floats past every caller (an unhandled rejection that reds the whole spec file).",
    `Fix: mark the ENCLOSING function \`async\` (if it is not already) and \`await\` each call before reading or destructuring its result: \`const x = await ${names[0] ?? "fn"}(...); x.ok\` or \`const { ok } = await ${names[0] ?? "fn"}(...)\`.${names.length > 1 ? ` Apply this to: ${names.join(", ")}.` : ""}`,
    "Do NOT delete the call, do NOT store the un-awaited Promise in a variable, and do NOT change the function's exported name or signature.",
    'Return JSON ONLY with the SAME envelope: {"module":"<complete corrected module source>","exports":[...],"reqTrace":{...}}.',
    "Same rules as before: exact typeSignature exports (nothing more, nothing less), zero imports, JSDoc, // req-N markers, no forbidden primitives, no prose, no markdown fences.",
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
 * R10-f01 (W39 Z2 · G3's wire): render `project.contracts` — the persisted A6
 * `DataContract` (types.ts `:300`) — as a capped DATA CONTRACTS prompt block
 * for the synthesis builders. Rows mirror the packet's own forms
 * (packet.ts `:567-570`): entities as `<name> (<field:type, …>)` under an
 * `entities:` heading, endpoints as `<METHOD> <path> (<job>)` under
 * `endpoints:`. NON-EMPTY GATE (Y1's FM-08 precedent): a null/absent/
 * empty/wholly-unrenderable contract returns [] and both builders keep the
 * exact legacy prompt bytes (keyless byte-parity + the T-01 pins). Total rows
 * cap at P6_SYNTH_CONTRACTS_MAX_ROWS (entities first, declare order) with a
 * visible `…[CONTRACTS-ELIDED: …]` marker past the cap (R12-f01's marker
 * convention — never a silent cut). Values whitespace-collapse to single
 * spaces so a malformed imported contract can never inject prompt line
 * structure; rows are plain ASCII bullets — no new raw tokens.
 */
export function p6SynthesisContractsLines(contracts: DataContract | null | undefined): string[] {
  if (contracts === null || contracts === undefined || typeof contracts !== "object") return [];
  const rows: { kind: "entity" | "endpoint"; text: string }[] = [];
  const squash = (v: string): string => v.replace(/\s+/g, " ").trim();
  for (const e of Array.isArray(contracts.entities) ? contracts.entities : []) {
    if (!e || typeof e.name !== "string") continue;
    const name = squash(e.name);
    if (!name) continue;
    const fields: string[] = [];
    for (const f of Array.isArray(e.fields) ? e.fields : []) {
      if (!f || typeof f.name !== "string" || typeof f.type !== "string") continue;
      const fn = squash(f.name);
      const ft = squash(f.type);
      if (fn && ft) fields.push(`${fn}:${ft}`);
    }
    rows.push({ kind: "entity", text: `- ${name} (${fields.join(", ") || "no fields declared"})` });
  }
  for (const e of Array.isArray(contracts.endpoints) ? contracts.endpoints : []) {
    if (!e || typeof e.method !== "string" || typeof e.path !== "string") continue;
    const method = squash(e.method);
    const path = squash(e.path);
    if (!method || !path) continue;
    const job = typeof e.job === "string" ? squash(e.job) : "";
    rows.push({ kind: "endpoint", text: `- ${method} ${path}${job ? ` (${job})` : ""}` });
  }
  if (rows.length === 0) return [];
  const shown = rows.slice(0, P6_SYNTH_CONTRACTS_MAX_ROWS);
  const lines: string[] = [
    "",
    "DATA CONTRACTS (the project's persisted A6 data contract — implement its entities and endpoints inside existing functions; do NOT add APIs for it):",
  ];
  for (const kind of ["entity", "endpoint"] as const) {
    const group = shown.filter((r) => r.kind === kind);
    if (group.length === 0) continue;
    lines.push(kind === "entity" ? "entities:" : "endpoints:");
    for (const r of group) lines.push(r.text);
  }
  if (rows.length > shown.length) {
    lines.push(
      `- …[CONTRACTS-ELIDED: ${rows.length - shown.length} row(s) beyond the ${P6_SYNTH_CONTRACTS_MAX_ROWS}-row render cap — the full data contract persists on project.contracts]`,
    );
  }
  return lines;
}

/**
 * Synthesis user prompt: brief + spec, deterministic and capped. The
 * typeSignatures are the interface definitions the module MUST export
 * (MetaGPT Engineer evidence, [W-META] fixes/97 §W). fixes/144 (M2): thin
 * delegate of the chunked builder with the FULL signature list and no prior
 * files — byte-identical output to the pre-M2 prompt (the ≤8-signature,
 * single-chunk legacy contract; regression-tested). R10-f01 (W39 Z2):
 * forwards the optional contracts argument (gated in the chunk builder).
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

  /** R10-f01 (W39 Z2): project.contracts — rendered by the chunk builder
   *  behind a non-empty gate; absent/null/empty ⇒ byte-identical legacy. */
  contracts?: DataContract | null,
): string {
  return p6SynthesisChunkUserPrompt(brief, spec, spec.typeSignatures, [], lessons, contracts);
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
  /** W46/332-1 (P1): the subset of `exports` the earlier file declares `async`.
   *  A later chunk must `await` these before reading a property off the result;
   *  absent ⇒ the export is treated as synchronous (legacy byte-identity). */
  asyncExports?: readonly string[];
};

/**
 * fixes/144 (M2 / S-01 T2): chunked-sequential-synthesis user prompt. The
 * prefix (BRIEF → ERROR HANDLING) renders byte-identically to the legacy
 * single-module prompt for THIS chunk's signature list (FM-08 renders the
 * dataFlow/errorHandling blocks in both — the parity is between the builders);
 * chunks after the
 * first APPEND an "earlier files" context block carrying the earlier chunks'
 * exported top-level names + covered requirements, so a later file can call
 * an earlier export by name in the assembled bundle (never redeclare, never
 * import — the forbidden-primitive contract is unchanged per file). Empty
 * prior files + full signature list ⇒ byte-identical to the legacy prompt
 * (p6SynthesisUserPrompt delegates here). R10-f01 (W39 Z2): the optional
 * contracts argument adds the capped DATA CONTRACTS block (see
 * p6SynthesisContractsLines); absent/empty keeps the legacy-byte contract.
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

  /** R10-f01 (W39 Z2): project.contracts — the capped DATA CONTRACTS block
   *  renders only when at least one entity/endpoint row survives
   *  normalization (non-empty gate, FM-08's precedent). */
  contracts?: DataContract | null,
): string {
  const raw = typeof brief === "string" ? brief.trim() : "";
  const capped =
    raw.length > P6_BRIEF_MAX_CHARS ? `${raw.slice(0, P6_BRIEF_MAX_CHARS).trimEnd()}${TRUNCATION_MARK}` : raw;
  const sigs = Array.isArray(chunkSignatures) ? chunkSignatures.filter((s): s is string => typeof s === "string") : [];
  // FM-08 (W37 Y1): the two spec fields this prompt used to drop — filtered
  // non-empty rows only, so a spec without them keeps the exact legacy bytes.
  const dataFlowEntries = (Array.isArray(spec.dataFlow) ? spec.dataFlow : [])
    .filter((c): c is string => typeof c === "string" && c.trim() !== "")
    .map((c) => `- ${c}`);
  const errorHandlingEntries = (Array.isArray(spec.errorHandling) ? spec.errorHandling : [])
    .filter((c): c is string => typeof c === "string" && c.trim() !== "")
    .map((c) => `- ${c}`);
  // R10-f01 (W39 Z2): the A6 data contract render — [] unless the project
  // carries at least one renderable entity/endpoint row (the FM-08 non-empty
  // gate, mirrored); a contract-less project keeps the exact legacy bytes.
  const contractLines = p6SynthesisContractsLines(contracts);
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
    // FM-08 (W37 Y1): prompt-engine expands SIX spec fields and this module
    // persists all six (requirements/edgeCases/errorHandling/typeSignatures/
    // dataFlow/negativeConstraints), but this builder rendered only four —
    // requirements about data ordering and failure handling were generated,
    // persisted, displayed downstream, and NEVER reached the generator (a
    // silent spec-to-code loss on every keyed run). Additive rendering behind
    // the non-empty gates above: a spec without them keeps the legacy prompt
    // bytes; the render is capped-scope like the neighbours (inside existing
    // functions, no new APIs).
    ...(dataFlowEntries.length > 0
      ? [
          "",
          "DATA FLOW (respect this ordering/data shape inside existing functions; do NOT add APIs for it):",
          ...dataFlowEntries,
        ]
      : []),
    ...(errorHandlingEntries.length > 0
      ? [
          "",
          "ERROR HANDLING (handle these failure modes inside existing functions; do NOT add APIs for it):",
          ...errorHandlingEntries,
        ]
      : []),
    // R10-f01 (W39 Z2): the persisted A6 contract's entity/endpoint rows —
    // capped at P6_SYNTH_CONTRACTS_MAX_ROWS with a visible elision marker;
    // the empty list keeps the legacy prompt bytes (keyless byte-parity).
    ...contractLines,
  ];
  if (Array.isArray(priorFiles) && priorFiles.length > 0) {
    lines.push(
      "",
      "EARLIER FILES ALREADY GENERATED (this project is synthesized as several files in sequence; each earlier file's",
      "exports below are bound as plain parameters of THIS file's scope in the assembled module — call them directly",
      "by name when this file needs their behavior. Do NOT redeclare them, do NOT import/require them, do NOT",
      "re-implement what they already cover, and give this file's own non-exported helpers names no earlier file used.",
      "An earlier export marked asynchronous (`async function`) returns a Promise: you MUST `await` it before reading any property off the result (`const x = await getProperty(id); x.ok`) or destructuring it (`const { ok } = await getProperty(id)`) — a non-awaited async call reads `undefined` off a Promise and leaks an unhandled rejection the validator refuses.",
      "Implement ONLY the type signatures listed above in THIS file.):",
    );
    // R12-f01: cap the prior render (last N files) + enforce the byte budget
    // as lines are appended. Both cuts carry a visible …[PRIOR-ELIDED…] marker
    // naming what was left out and why; the assembled module still binds every
    // prior export as a parameter, so nothing callable is lost by the cut.
    const shown =
      priorFiles.length > P6_SYNTH_PRIOR_MAX_FILES
        ? priorFiles.slice(-P6_SYNTH_PRIOR_MAX_FILES)
        : priorFiles;
    const overCap = priorFiles.length - shown.length;
    if (overCap > 0) {
      lines.push(
        `- …[PRIOR-ELIDED: ${overCap} earlier file(s) beyond the ${P6_SYNTH_PRIOR_MAX_FILES}-file render cap — their exports remain bound in the assembled module]`,
      );
    }
    let budgetLeft = P6_SYNTH_PROMPT_MAX_CHARS - lines.join("\n").length;
    let rendered = 0;
    for (const f of shown) {
      const covered = Object.entries(f.reqTrace ?? {})
        .filter(([, name]) => (Array.isArray(f.exports) ? f.exports.includes(name) : false))
        .map(([req]) => req)
        .sort();
      const reqPart = covered.length > 0 ? ` · covers ${covered.join(", ")}` : "";
      const asyncNamed = (Array.isArray(f.asyncExports) ? f.asyncExports : []).filter(
        (n: string) => typeof n === "string" && (f.exports ?? []).includes(n),
      );
      const asyncPart = asyncNamed.length > 0 ? ` · asynchronous (must await): ${asyncNamed.join(", ")}` : "";
      const line = `- ${f.path} exports: ${(f.exports ?? []).join(", ") || "(none)"}${reqPart}${asyncPart}`;
      if (line.length + 1 > budgetLeft) {
        lines.push(
          `- …[PRIOR-ELIDED: ${shown.length - rendered} file(s) beyond the ${P6_SYNTH_PROMPT_MAX_CHARS.toLocaleString("en-US")}-char prompt budget — their exports remain bound in the assembled module]`,
        );
        break;
      }
      lines.push(line);
      budgetLeft -= line.length + 1;
      rendered += 1;
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

/** Entry-file tree path. `materializeImportableTree` writes the ESM barrel
 *  (every tree, one chunk or many) here — parity with scaffold's
 *  generatedSource fallback host path (scaffold.ts `src/generated.ts`). A
 *  planned chunk whose own path IS this one is relocated to
 *  `src/generated/chunk-0.ts` so the barrel can own the entry path.
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
 * W52/338-1: label/fn comparison form — lowercase alphanumerics only. The old
 * `name.toLowerCase().includes(label.toLowerCase())` could never bind a
 * HYPHENATED label: `runFollowUp` (from `deriveTypeSignatures`) does not
 * contain the substring `follow-up`, so the declared job `follow-up`
 * (algorithms.ts LEX) was permanently unbound. Separators are noise between a
 * camelCase function name and a hyphen/space label; strip them on both sides.
 */
function normalizedLabelForm(s: string): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Deterministic signature→job binding. Each signature binds to the FIRST job
 * target (graph order) whose label appears in the signature's function name
 * (case- and separator-insensitive — see `normalizedLabelForm`); a signature
 * with no parseable function name or no label hit stays in `leftover` (expand
 * order kept end-to-end). `bound[i]` holds target i's own signatures in expand
 * order.
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
      : targets.findIndex((t) => normalizedLabelForm(name).includes(normalizedLabelForm(t.label)));
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
 * W45/331-4: the sentinel job `intentLattice` (algorithms.ts) falls back to when
 * a brief names no capability. It is not a declared capability, so it is never a
 * plan coverage obligation (mirrors `deriveTypeSignatures`'s own filter).
 */
const CORE_SENTINEL_JOB = "deliver-core-workflow";

/**
 * W45/331-4: the counted declared-vs-planned job census for the tree plan. The plan
 * (`treeChunkPlan`) materialises a chunk/file only for a job node whose label a
 * typeSignature's function name contains; a declared job with no bound signature gets
 * NO chunk and NO file — silently, until now. This is the ONE derivation of the
 * plan-side shortfall: `declared` (spec-graph job labels, sentinel excluded),
 * `planned` (labels that got ≥1 chunk), `unbound` (the counted shortfall — labels with
 * no bound signature), `paths` (plan chunk paths) and `legacy` (the plan fell to the
 * non-job src/generated mapping). Pure + deterministic; derived FROM `treeChunkPlan`
 * (no second path rule to drift).
 */
export type TreePlanCensus = {
  declared: string[];
  planned: string[];
  unbound: string[];
  paths: string[];
  legacy: boolean;
};

/** Count declared spec-graph jobs against the plan `treeChunkPlan` builds (see the type doc). */
export function treeChunkPlanCensus(
  project: Parameters<typeof treeChunkPlan>[0],
  typeSignatures: readonly string[],
  perChunk: number = P6_SYNTH_CHUNK_SIZE,
): TreePlanCensus {
  const targets = specGraphJobTargets(project);
  const plan = treeChunkPlan(project, typeSignatures, perChunk);
  const plannedLabels = new Set<string>();
  for (const c of plan) {
    if (typeof c.nodeId === "string" && c.nodeId.length > 0 && typeof c.label === "string") {
      plannedLabels.add(c.label);
    }
  }
  const declaredAll = targets.map((t) => t.label).filter((l) => l !== CORE_SENTINEL_JOB);
  // Dedupe by label: specGraphJobTargets de-dupes by FILE, so two nodes may share
  // a label (flip.ts + flip-2.ts). A doubled label would double-count the
  // partition and read as two shortfalls; the label is the coverage unit.
  const declared = [...new Set(declaredAll)];
  return {
    // `planned`/`unbound` are complementary filters of `declared`, so the
    // partition holds BY CONSTRUCTION — no runtime "does not reconcile" guard is
    // kept (it could never fire; 333-1 F-2). `paths` is the plan's own file list.
    declared,
    planned: declared.filter((l) => plannedLabels.has(l)),
    unbound: declared.filter((l) => !plannedLabels.has(l)),
    paths: plan.map((c) => c.path),
    legacy: plan.every((c) => typeof c.nodeId !== "string" || c.nodeId.length === 0),
  };
}

/**
 * W52/338-1 — THE spec-driven coverage rule. The keyed P6 plan used to be built
 * from the model's emitted `typeSignatures` alone, so a declared spec-graph job
 * the model happened not to name got NO `src/jobs/<label>.ts` file at all: the
 * same brief could emit 7 modules on one run and 5 on the next (`fixes/337_0_parent.md`
 * §5; run B's unbound `["track"]`, `codegen.server.test.ts:4400-4412`). This
 * reconciles the model spec with the DETERMINISTIC capability floor:
 *
 *   - the declared job targets come from `project.specGraph` (pure A5 output);
 *   - each target is already bound when any model signature binds to its label;
 *   - a target no model signature binds gets `deriveTypeSignatures`' own pair
 *     (`algorithms.ts` — the lattice capability floor), APPENDED after the model
 *     signatures so the model's own chunks and order are never disturbed.
 *
 * Because `lattice`/`specGraph` are pure functions of the brief, the planned
 * `src/jobs/*.ts` SET is now a function of the brief, not of the model's
 * emission. Pure + deterministic; no spec graph (or no declared job) ⇒ the input
 * list is returned unchanged (byte-identity for the legacy/no-job paths).
 */
export function reconcilePlanTypeSignatures(
  project:
    | {
        specGraph?: { nodes?: readonly { id?: unknown; file?: unknown; purpose?: unknown }[] } | null;
        lattice?: { jobs?: readonly string[]; entities?: readonly string[] } | null;
      }
    | null
    | undefined,
  typeSignatures: readonly string[],
): { typeSignatures: string[]; added: string[]; addedLabels: string[] } {
  const seen = new Set<string>();
  const sigs: string[] = [];
  for (const raw of typeSignatures ?? []) {
    if (typeof raw !== "string" || !raw.trim() || seen.has(raw)) continue;
    seen.add(raw);
    sigs.push(raw);
  }
  const targets = specGraphJobTargets(project);
  if (targets.length === 0) return { typeSignatures: sigs, added: [], addedLabels: [] };
  const { bound } = bindSignaturesToJobTargets(sigs, targets);
  // The floor's own job list is the lattice when present; for an imported
  // payload that carries a spec graph but no lattice, derive it from the
  // declared labels so the rule still holds (neutral `record` return entity).
  const latticeJobs = Array.isArray(project?.lattice?.jobs) ? project.lattice.jobs : [];
  const latticeEntities = Array.isArray(project?.lattice?.entities) ? project.lattice.entities : [];
  const floorLattice = {
    jobs: latticeJobs.length > 0 ? [...latticeJobs] : targets.map((t) => t.label),
    entities: latticeEntities.length > 0 ? [...latticeEntities] : ["record"],
  };
  const floorBound = bindSignaturesToJobTargets(deriveTypeSignatures(floorLattice), targets).bound;
  const added: string[] = [];
  const addedLabels: string[] = [];
  targets.forEach((t, i) => {
    if ((bound[i] ?? []).length > 0) return; // the model already covered this declared job
    const fill = floorBound[i] ?? [];
    if (fill.length === 0) return; // no floor exists (e.g. the sentinel job) — nothing to add
    addedLabels.push(t.label);
    for (const s of fill) {
      if (seen.has(s)) continue;
      seen.add(s);
      added.push(s);
    }
  });
  return { typeSignatures: [...sigs, ...added], added, addedLabels };
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
 * A0 (fixes/162) + W21-258: this concatenation is NOT what hits disk —
 * `materializeImportableTree` rewrites EVERY tree (N=1 included) into real ESM
 * files with cross-file `import`/`export`. The IIFE lives only on the
 * brief-fit vocabulary scan input and on the single-module-legacy path. */
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

/** Net `{`/`[` depth contributed by one line, counting on the MASKED line only
 *  (string/regex/comment bodies blanked to same-length spaces, indices
 *  preserved). Used to consume a whole-object CJS assign to its matching close.
 *
 *  325 A3: the char-walk this replaced ignored REGEX literals, so a brace
 *  inside one (`s.replace(/}/g, "")`) shifted the depth walk inside a dropped
 *  `module.exports = {…}` construct: the construct closed early and a dangling
 *  `};` was left in the emitted ESM (SyntaxError at import), or opened one
 *  level too deep and SWALLOWED the rest of the file — leaving only
 *  `export { keep };` with no binding (`Export 'keep' is not defined`).
 *  REUSE of the masker keeps literals/comments/regex in ONE place.
 */
function bracketDelta(line: string): number {
  const code = maskLiteralsAndComments(typeof line === "string" ? line : "");
  let d = 0;
  for (let i = 0; i < code.length; i++) {
    const c = code[i]!;
    if (c === "{" || c === "[") d++;
    else if (c === "}" || c === "]") d--;
  }
  return d;
}

/** JS keywords that are valid property names but never legal binding
 *  identifiers — `module.exports.default = …` can therefore not become
 *  `const default = …`. */
const RESERVED_BINDING_WORDS = new Set([
  "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "export", "extends", "false",
  "finally", "for", "function", "if", "implements", "import", "in",
  "instanceof", "interface", "let", "new", "null", "package", "private",
  "protected", "public", "return", "static", "super", "switch", "this",
  "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield",
]);

/** Net `{`/`[`/`(` depth of one line, counting on the MASKED line only
 *  (string/regex/comment bodies blanked to same-length spaces, indices
 *  preserved) — same shape as `bracketDelta`, parens included: the skip/keep
 *  consumer for residual CJS statements must follow a multi-line call value to
 *  its close. 325 A3: see bracketDelta — un-masked regex bodies shifted the
 *  depth (a `/[{]/` inside a dropped assign swallowed the rest of the file). */
function cjsStatementDelta(line: string): number {
  const code = maskLiteralsAndComments(typeof line === "string" ? line : "");
  let d = 0;
  for (let i = 0; i < code.length; i++) {
    const c = code[i]!;
    if (c === "{" || c === "[" || c === "(") d++;
    else if (c === "}" || c === "]" || c === ")") d--;
  }
  return d;
}

/** Top-level binding names the file already declares (function / class /
 *  const / let / var) — the same shapes `declaredNames` scans, minus its
 *  `module.exports.NAME =` rule: a residual CJS assignment must never mint a
 *  SECOND declaration of a name the file already binds.
 *
 *  325 A3: the `const|let|var NAME =` shape alone MISSED the bare and
 *  destructured declarations — `let cache;`, `const { id } = input;`,
 *  `const a = 0, b = 1;`. A residual `module.exports.cache = cache ||
 *  compute();` then converted to `const cache = …` beside the file's own
 *  `let cache;` (duplicate declaration — the whole emitted tree died at
 *  import), and a self-referencing RHS became a TDZ crash. Every added form
 *  binds a name at column 0; over-detection here is the SAFE direction (the
 *  statement is dropped, never double-declared) — an inner-scope declaration
 *  is still deliberately NOT a top-level binding (the `^` anchor stays). */
function localBindingNames(source: string): Set<string> {
  const code = stripComments(String(source ?? ""));
  const names = new Set<string>();
  for (const m of code.matchAll(/^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/gm)) names.add(m[1]!);
  for (const m of code.matchAll(/^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]!);
  for (const m of code.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)) names.add(m[1]!);
  // 325 A3: bare declarations (no initializer) …
  for (const m of code.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?=[;,]|$)/gm)) names.add(m[1]!);
  // … and destructuring patterns: every identifier the pattern names is bound
  // (`const { id, name } = row;` — `id`, `name`; `const [first] = rows;`).
  for (const m of code.matchAll(/^(?:const|let|var)\s*[{[]([^}\]\n]*)[}\]]\s*=/gm)) {
    for (const t of m[1]!.matchAll(/[A-Za-z_$][\w$]*/g)) names.add(t[0]!);
  }
  return names;
}

/** Blank string/template/comment spans in ONE line, carrying cross-line block
 *  and template state (indices preserved, like `maskLiteralsAndComments`). Best-effort
 *  lexical mask — `localBindingLines` scans declarations at column 0 only. */
function maskCodeLine(line: string, state: { block: boolean; template: boolean }): string {
  let out = "";
  let j = 0;
  let block = state.block;
  let template = state.template;
  while (j < line.length) {
    const c = line[j]!;
    const next = line[j + 1];
    if (block) {
      if (c === "*" && next === "/") {
        block = false;
        out += "  ";
        j += 2;
        continue;
      }
      out += " ";
      j += 1;
      continue;
    }
    if (template) {
      if (c === "\\") {
        out += "  ";
        j += 2;
        continue;
      }
      if (c === "`") template = false;
      out += " ";
      j += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      out += " ".repeat(line.length - j);
      break;
    }
    if (c === "/" && next === "*") {
      block = true;
      out += "  ";
      j += 2;
      continue;
    }
    if (c === "`") {
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
        out += " ".repeat(line.length - j);
        break;
      }
      out += " ".repeat(closed + 1 - j);
      j = closed + 1;
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
        out += c;
        j += 1;
        continue;
      }
      out += " ".repeat(closed + 1 - j);
      j = closed + 1;
      continue;
    }
    out += c;
    j += 1;
  }
  state.block = block;
  state.template = template;
  return out;
}

/**
 * W45/331-4 (Finding B): top-level binding names a module declares, mapped to the
 * 1-based line numbers of their declarations. A SUPERSET of `localBindingNames`
 * (function/class/const/let/var incl. bare + destructured): it also reports the
 * type-space, ambient and enum/class-modifier shapes — `type X`, `interface X`,
 * `enum X` / `const enum X` / `declare enum X`, `declare class X`,
 * `abstract class X`, `declare function X`, `export default class X` — because
 * `materializeImportableTree` emits `import { X }` for EVERY earlier file's
 * exports, and each of those later declarations collides with that import as
 * TS2440 (W56/342-1; the enum/class forms verified against the real compiler in
 * the 342-1 resume). NOT in the set: `namespace X` / `declare namespace X` /
 * `declare module X` — real tsc is silent on those (no TS2440), so flagging them
 * would over-refuse. `localBindingNames` stays runtime-only for export binding,
 * so the two detectors legitimately differ here. Line-preserving (a comment- or
 * string-only line never reports) and returned as a name→lines map so a refusal
 * can name WHERE the redeclaration is. Deterministic.
 */
export function localBindingLines(module: string): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const add = (name: string, line: number): void => {
    const arr = out.get(name);
    if (arr === undefined) out.set(name, [line]);
    else if (!arr.includes(line)) arr.push(line);
  };
  const lines = String(module ?? "").split("\n");
  const state = { block: false, template: false };
  for (let i = 0; i < lines.length; i++) {
    const code = maskCodeLine(lines[i] ?? "", state);
    if (!code.trim()) continue;
    for (const m of code.matchAll(/^(?:export\s+(?:default\s+)?)?(?:declare\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/gm)) add(m[1]!, i + 1);
    for (const m of code.matchAll(/^(?:export\s+(?:default\s+)?)?(?:(?:declare|abstract)\s+)*class\s+([A-Za-z_$][\w$]*)/gm)) add(m[1]!, i + 1);
    for (const m of code.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?=[=;,]|$)/gm)) add(m[1]!, i + 1);
    for (const m of code.matchAll(/^(?:const|let|var)\s*[{[]([^}\]\n]*)[}\]]\s*=/gm)) {
      for (const t of m[1]!.matchAll(/[A-Za-z_$][\w$]*/g)) add(t[0]!, i + 1);
    }
    // W56/342-1 (TS2440): type-space + ambient declarations collide with the
    // materializer's cross-file import exactly like a runtime redeclaration.
    // fixes/342-1 resume: enum / const enum / declare class / abstract class
    // (incl. their export/declare variants) are real TS2440 emitters too, all
    // verified against the pinned compiler. `namespace` / `declare namespace`
    // / `declare module` are NOT (real tsc is silent) and stay unflagged.
    for (const m of code.matchAll(/^(?:export\s+)?(?:declare\s+)?(?:type|interface)\s+([A-Za-z_$][\w$]*)/gm)) add(m[1]!, i + 1);
    for (const m of code.matchAll(/^(?:export\s+(?:default\s+)?)?(?:(?:declare|const)\s+)*enum\s+([A-Za-z_$][\w$]*)/gm)) add(m[1]!, i + 1);
  }
  return out;
}

/** One top-level name a later chunk declares that an earlier chunk already exports. */
export type CrossChunkDuplicate = { name: string; line: number; priorPath: string };

/**
 * W45/331-4 (Finding B): the cross-chunk duplicate-declaration census. `materializeImportableTree`
 * imports EVERY earlier chunk's exports into a later file, so a later chunk that declares a
 * top-level name an earlier chunk exports yields a file with both an `import { x }` and a local
 * `x` — a load-time `SyntaxError: Identifier 'x' has already been declared` (the real keyed tree:
 * `src/jobs/flip.ts` imported `estimateARV` from `…/list-line-items.ts` and declared it again at
 * line 546). This is the ONE detector of that class: names in prior exports that are also local
 * top-level bindings, with the declaration line and the exporting sibling. Deterministic, pure.
 */
export function crossChunkDuplicateDeclarations(
  module: string,
  priorChunks: readonly { path: string; exports: readonly string[] }[] | null | undefined,
): CrossChunkDuplicate[] {
  const chunks = (Array.isArray(priorChunks) ? priorChunks : []).filter(
    (c): c is { path: string; exports: readonly string[] } => c !== null && typeof c === "object" && typeof c.path === "string",
  );
  if (chunks.length === 0) return [];
  const lines = localBindingLines(String(module ?? ""));
  const out: CrossChunkDuplicate[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    for (const raw of Array.isArray(chunk.exports) ? chunk.exports : []) {
      if (typeof raw !== "string" || !isIdent(raw) || seen.has(raw)) continue;
      const at = lines.get(raw);
      if (at !== undefined && at.length > 0) {
        seen.add(raw);
        out.push({ name: raw, line: at[0]!, priorPath: chunk.path });
      }
    }
  }
  return out;
}

/**
 * Top-level `async` callable names a module declares (masked per line, so a
 * comment/string mentioning one never reports). Covers the lexical shapes an
 * emitted module actually uses:
 *   • `async function NAME(...)`
 *   • `const|let|var NAME = async (...) =>` / `= async function (...)` / `= async x =>`
 *   • `(module.)?exports.NAME = async (...) =>` / `= async function (...)`
 *   • `async NAME(...)` / `async *NAME(...)` class (or object-literal) methods
 * LIMIT (stated, not implied): discovery is LEXICAL, not a parser. A callable
 * whose Promise-returning nature is not spelled `async` (e.g. `function f() {
 * return new Promise(...) }`, a re-export, or a method invoked through a
 * receiver `obj.m()` rather than by bare name) is NOT discovered here — those
 * shapes are undecidable from the bare name alone.
 */
function declaredAsyncFunctionNames(module: string): string[] {
  const out: string[] = [];
  const lines = String(module ?? "").split("\n");
  const state = { block: false, template: false };
  for (const line of lines) {
    const code = maskCodeLine(line, state);
    // async function NAME(...)
    for (const m of code.matchAll(/^(?:export\s+)?async\s+function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/gm)) out.push(m[1]!);
    // const/let/var NAME = async (...) => | = async function (...) | = async x =>
    for (const m of code.matchAll(
      /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*async\s*(?:\(|function\b|[A-Za-z_$][\w$]*\s*=>)/gm,
    )) {
      out.push(m[1]!);
    }
    // (module.)?exports.NAME = async ... (a CJS-surface async function)
    for (const m of code.matchAll(
      /^(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=\s*async\s*(?:\(|function\b|[A-Za-z_$][\w$]*\s*=>)/gm,
    )) {
      out.push(m[1]!);
    }
    // async NAME(...) / async *NAME(...) — a class/object method (the `(?!function)`
    // guard keeps the anonymous `async function (...)` expression out of this arm).
    for (const m of code.matchAll(/^\s*(?:static\s+)?async\s*\*?\s*(?!function\b)([A-Za-z_$][\w$]*)\s*\(/gm)) out.push(m[1]!);
  }
  return [...new Set(out)];
}

/**
 * W46/332-1 (P1): the declared names of `exports` that an earlier file declares
 * `async` — the set a later chunk must `await` before reading any property off
 * the resolved value. The materializer imports every earlier chunk's exports as
 * plain ESM bindings, so an async export is callable by bare name; the real
 * keyed tree's `src/jobs/rehab.ts` called the async `getProperty(propertyId)`
 * without `await` and read `.ok` off the returned Promise. Pure, deterministic.
 */
export function asyncExportNames(source: string, exports: readonly string[]): string[] {
  const declared = new Set(declaredAsyncFunctionNames(source));
  if (declared.size === 0) return [];
  const want = (Array.isArray(exports) ? exports : []).filter((n): n is string => typeof n === "string" && isIdent(n));
  return [...new Set(want.filter((n) => declared.has(n)))];
}

/** The async callable names in a chunk module's scope: its own top-level
 *  `async function` declarations unioned with the named exports of every
 *  earlier chunk that carry an `asyncExports` mark. Order-stable. */
export function asyncNamesInScope(
  module: string,
  priorChunks?: readonly { path: string; exports: readonly string[]; asyncExports?: readonly string[] }[] | null,
): string[] {
  const out = new Set(declaredAsyncFunctionNames(module));
  for (const chunk of Array.isArray(priorChunks) ? priorChunks : []) {
    if (chunk === null || typeof chunk !== "object") continue;
    const exported = new Set((Array.isArray(chunk.exports) ? chunk.exports : []).filter((n: unknown): n is string => typeof n === "string" && isIdent(n)));
    for (const raw of Array.isArray(chunk.asyncExports) ? chunk.asyncExports : []) {
      if (typeof raw === "string" && isIdent(raw) && exported.has(raw)) out.add(raw);
    }
  }
  return [...out];
}

/** One un-awaited async call whose result is consumed as a VALUE (not a promise).
 *  `computed-read` is `fn(id)["ok"]`; `property-read` covers `.ok` and `?.ok`. */
export type AsyncUnawaitedUse = {
  name: string;
  line: number;
  form: "property-read" | "computed-read" | "destructure" | "bound-then-read" | "floating-in-then";
};

/** `Promise.then/catch/finally` ARE the legal way to consume a promise — reading
 *  one off an un-awaited call is not the defect this detector refuses. */
const PROMISE_CONSUMER_METHODS = new Set(["then", "catch", "finally"]);

/** Index of the `)` matching the `(` at `open`, or -1. Masked text only, so a
 *  paren inside a literal/comment was already blanked and cannot miscount. */
function matchParenClose(text: string, open: number): number {
  if (open < 0 || text[open] !== "(") return -1;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i]!;
    if (c === "(") depth += 1;
    else if (c === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * The member access starting at `start`, if any — the tail a Promise would be
 * read through. Accepts the four lexical forms an emitted module uses:
 * `.name`, `?.name`, `["name"]`, `?.["name"]`, plus a computed key bound to a
 * top-level const string literal (`[K]` where `const K = "then"`). `masked` and
 * `raw` are the same-length views of the source (masking preserves offsets), so
 * a computed key's literal text is read from `raw` while the structure is read
 * from `masked`. `literals` resolves an identifier key when the value is
 * statically known; an unresolvable key stays a computed read with no name
 * (conservative — 333-1 F-1). Returns null when the next token is not a member
 * access. Pure.
 */
function memberAccessAfter(
  masked: string,
  raw: string,
  start: number,
  literals: ReadonlyMap<string, string> = new Map(),
): { kind: "member" | "computed"; name: string | null } | null {
  let i = start;
  while (i < masked.length && (masked[i] === " " || masked[i] === "\t" || masked[i] === "\n" || masked[i] === "\r")) i++;
  let chained = false;
  if (masked[i] === "?" && masked[i + 1] === ".") {
    chained = true;
    i += 2;
  } else if (masked[i] === ".") {
    chained = true;
    i += 1;
  }
  while (i < masked.length && (masked[i] === " " || masked[i] === "\t")) i++;
  if (masked[i] === "[") {
    const rawKey = /^\s*(?:\?\.\s*)?\[\s*(['"])([^'"]*)\1\s*\]/.exec(raw.slice(start));
    if (rawKey !== null) return { kind: "computed", name: rawKey[2]! };
    const identKey = /^\s*(?:\?\.\s*)?\[\s*([A-Za-z_$][\w$]*)\s*\]/.exec(masked.slice(start));
    return { kind: "computed", name: identKey !== null ? literals.get(identKey[1]!) ?? null : null };
  }
  if (chained) {
    const m = /^([A-Za-z_$][\w$]*)/.exec(masked.slice(i));
    if (m !== null) return { kind: "member", name: m[1]! };
  }
  return null;
}

/** Index of the `}` matching the `{` at `open`, or -1. Masked text only. */
function matchBraceClose(text: string, open: number): number {
  if (open < 0 || text[open] !== "{") return -1;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i]!;
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Top-level `const NAME = "literal"` values in a module, used to resolve a
 *  computed member key lexically (`fn(id)[K]` with `const K = "then"`). The raw
 *  line carries the value (masking blanks literal bodies); the masked line must
 *  still be the declaration head, so a `// const K = "…"` comment never binds.
 *  A `let`/`var` or a reassigned binding is not resolved (conservative). Pure. */
function constStringLiterals(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const state = { block: false, template: false };
  for (const line of src.split("\n")) {
    const code = maskCodeLine(line, state);
    const head = /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=/.exec(code);
    const raw = /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])([^'"]*)\2\s*;?\s*$/.exec(line);
    if (raw !== null && head !== null && head[1] === raw[1]) out.set(raw[1], raw[3]);
  }
  return out;
}

/** Body ranges of every `async NAME(…) { … }` method declared in the module —
 *  the receiver (`this.NAME(…)`) a bare-name scan cannot see. The range is the
 *  enclosing class/object-literal body, so a `this.NAME(…)` is tied to the very
 *  declaration that owns it: a same-named method on a *different* receiver is
 *  not matched (it may be synchronous). Pure. */
function asyncMethodBodyRanges(masked: string): { name: string; start: number; end: number }[] {
  const out: { name: string; start: number; end: number }[] = [];
  for (const m of masked.matchAll(/^\s*(?:static\s+)?async\s*\*?\s*(?!function\b)([A-Za-z_$][\w$]*)\s*\(/gm)) {
    const idx = m.index ?? 0;
    let depth = 0;
    let open = -1;
    for (let i = idx - 1; i >= 0; i--) {
      const c = masked[i];
      if (c === "}") depth += 1;
      else if (c === "{") {
        if (depth === 0) {
          open = i;
          break;
        }
        depth -= 1;
      }
    }
    if (open < 0) continue;
    const end = matchBraceClose(masked, open);
    if (end < 0) continue;
    out.push({ name: m[1]!, start: open, end });
  }
  return out;
}

/** One call site whose result a Promise could be read off. */
type AsyncCallSite = { name: string; calleeStart: number; openParen: number };

/**
 * W46/332-1 (P1): the value-position uses of an un-awaited async call. `asyncNames`
 * are the callable names known to return a Promise (a sibling chunk's async export
 * or the module's own `async function`). A call that is NOT preceded by `await` is
 * refused when its result is consumed as a value:
 *   • `getProperty(id).ok` / `?.ok`   → property-read (a Promise has no `.ok`)
 *   • `getProperty(id)["ok"]`         → computed-read (same, through a key; a key
 *     bound to a const string that resolves to `then`/`catch`/`finally` is a legal
 *     consumer and stays accepted)
 *   • `const { ok } = getProperty(id)`→ destructure (same, off the Promise)
 *   • `const p = getProperty(id); p.ok` / `p?.ok` / `p["ok"]` → bound-then-read (the
 *     promise stored, a member read off it later — the real `src/jobs/rehab.ts` shape)
 *   • `this.getProperty(id).ok` inside the declaring class → the same shapes through
 *     a `this` receiver (a same-named member on another receiver is not matched)
 *   • a var bound to one inside a `Promise.resolve().then(…)` body → floating-in-then
 *     (that callback is not `async`, so the promise can never be awaited later).
 * The optional call `getProperty?.(id)` (and `this.getProperty?.(id)`) is the SAME
 * call — it only guards a null/undefined callee, never the returned Promise — so its
 * result is classified through the identical value-position tails (W49/335-1).
 * `await getProperty(id)` and `.then/.catch/.finally` consumers (including via a
 * computed key: `["then"]`) are accepted. `asyncNames` discovery is lexical (see
 * `declaredAsyncFunctionNames`); a Promise-returning callable not spelled `async`,
 * a named receiver (`obj.m()`), an indirect invocation (`fn.call(…)`/`fn.apply(…)`,
 * or a parenthesized/comma-discarded callee `(fn)(id)` / `(0, fn)(id)`), and an
 * unresolvable dynamic computed key stay outside this guard (their receiver/value
 * cannot be tied to a bare declaration). The `this`-receiver arm additionally
 * needs the `async NAME(` declaration to begin its own line — `asyncMethodBodyRanges`
 * is line-anchored, so a method declared mid-line is not discoverable. Pure.
 */
export function unawaitedAsyncValueUses(module: string, asyncNames: readonly string[]): AsyncUnawaitedUse[] {
  const src = typeof module === "string" ? module : "";
  const wanted = [...new Set((asyncNames ?? []).filter((n): n is string => typeof n === "string" && isIdent(n)))];
  if (!src || wanted.length === 0) return [];
  const state = { block: false, template: false };
  const masked = src.split("\n").map((l) => maskCodeLine(l, state)).join("\n");
  const lineAt = (idx: number): number => {
    let n = 1;
    for (let i = 0; i < idx && i < masked.length; i++) if (masked.charCodeAt(i) === 10) n += 1;
    return n;
  };
  const uses: AsyncUnawaitedUse[] = [];
  const seen = new Set<string>();
  const push = (u: AsyncUnawaitedUse): void => {
    const key = `${u.line}|${u.name}|${u.form}`;
    if (!seen.has(key)) {
      seen.add(key);
      uses.push(u);
    }
  };
  const literals = constStringLiterals(src);
  const sites: AsyncCallSite[] = [];
  for (const name of wanted) {
    // W49/335-1: the optional-call tail `?.(` calls the same async function and
    // returns the same Promise — a plausible defensive emission that must not
    // bypass the guard (the property-read/computed-read/`?.(` forms are one class).
    const re = new RegExp(`(?<![\\w.$])${name}\\s*(?:\\?\\.\\s*)?\\(`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked)) !== null) {
      sites.push({ name, calleeStart: m.index, openParen: m.index + m[0].lastIndexOf("(") });
    }
  }
  // A `this.NAME(…)`/`this.NAME?.(…)` receiver call is matched only inside the
  // body that declares the async method NAME — a same-named member on another
  // receiver stays out.
  for (const r of asyncMethodBodyRanges(masked)) {
    if (!wanted.includes(r.name)) continue;
    const re = new RegExp(`(?<![\\w$])this\\s*\\.\\s*${r.name}\\s*(?:\\?\\.\\s*)?\\(`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked)) !== null) {
      if (m.index < r.start || m.index > r.end) continue;
      sites.push({ name: r.name, calleeStart: m.index, openParen: m.index + m[0].lastIndexOf("(") });
    }
  }
  sites.sort((a, b) => a.calleeStart - b.calleeStart);
  const bound: { varName: string; name: string; callEnd: number; line: number }[] = [];
  const readVars = new Set<string>();
  for (const site of sites) {
    const { name, calleeStart, openParen } = site;
    if (/await\s*$/.test(masked.slice(Math.max(0, calleeStart - 12), calleeStart))) continue;
    const close = matchParenClose(masked, openParen);
    if (close < 0) continue;
    const access = memberAccessAfter(masked, src, close + 1, literals);
    const consumer = access !== null && access.name !== null && PROMISE_CONSUMER_METHODS.has(access.name);
    if (access !== null && !consumer) {
      push({ name, line: lineAt(calleeStart), form: access.kind === "computed" ? "computed-read" : "property-read" });
      continue;
    }
    // The text between the statement boundary and the callee: a `const x =`
    // (bound) or a destructuring declaration head (destructure), else a bare use.
    const stmtStart = Math.max(
      masked.lastIndexOf(";", calleeStart),
      masked.lastIndexOf("{", calleeStart),
      masked.lastIndexOf("}", calleeStart),
      masked.lastIndexOf("\n", calleeStart),
    );
    const lhs = masked.slice(stmtStart + 1, calleeStart);
    const boundDecl = /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/.exec(lhs);
    if (boundDecl !== null) {
      bound.push({ varName: boundDecl[1]!, name, callEnd: close, line: lineAt(calleeStart) });
    } else if (/(?:^|[;{}\n])\s*(?:const|let|var)\s*(?:\{[^}]*\}|\[[^\]]*\])\s*=\s*$/.test(masked.slice(0, calleeStart))) {
      // Destructuring assignment off the call result: `const { ok } = fn(id)`.
      push({ name, line: lineAt(calleeStart), form: "destructure" });
    }
  }
  for (const b of bound) {
    const re = new RegExp(`(?<![\\w$])${b.varName}(?![\\w$])`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked)) !== null) {
      if (m.index <= b.callEnd) continue;
      const access = memberAccessAfter(masked, src, m.index + b.varName.length, literals);
      if (access === null) continue;
      if (access.name !== null && PROMISE_CONSUMER_METHODS.has(access.name)) continue;
      readVars.add(b.varName);
      push({ name: b.name, line: lineAt(m.index), form: "bound-then-read" });
      break;
    }
  }
  // A `Promise.resolve().then(…)` body is not an `async` callback, so a promise
  // bound to a var there can never be awaited later — it is consumed as a value.
  if (/Promise\s*\.\s*resolve\s*\(\s*\)\s*\.\s*then\s*\(/.test(masked)) {
    for (const b of bound) {
      if (!readVars.has(b.varName)) push({ name: b.name, line: b.line, form: "floating-in-then" });
    }
  }
  return uses.sort((a, b) => a.line - b.line);
}

/**
 * W21-258: neutralize every CJS export-surface statement
 * `stripCjsExportAssignments` leaves behind, so a file rewritten to ESM is
 * valid ESM and never references `module`/`exports` at all.
 *
 * Why this exists (proven on run #2's emitted tree, fixes/255 §1): the P6
 * envelope's `exports` list is the DECLARED surface, but an accepted module may
 * carry extra CJS surface the model wrote on its own — run #2's
 * `src/generated/get-property.ts` ends
 * `module.exports._internals = { LEDGER: …, DEALS: … };`. The declared-name
 * strip left that line in place, so even a fully materialized tree still died
 * at import in the `"type":"module"` tenant (`ReferenceError: module is not
 * defined in ES module scope` — zero spec assertions ever ran).
 *
 * Rules (deterministic, line-based; comments can never match because a CJS
 * statement must START with its prefix — `// module.exports.x = x` is inert):
 *   • `module.exports.NAME = EXPR` / `exports.NAME = EXPR` where NAME is
 *     already a top-level binding of the file → drop the statement (the binding
 *     stays); NAME is reported so the ESM `export { … }` line keeps the surface.
 *   • … where NAME is NOT bound → rewritten as `const NAME = EXPR` (value kept,
 *     multi-line values included) and reported as exported.
 *   • NAME that cannot be a binding identifier (a reserved word) → dropped, not
 *     reported (a contract-violating extra the ESM conversion cannot carry).
 *   • bare `module.exports = …` / `exports = …` and computed
 *     `module.exports[…]/exports[…] = …` → dropped whole (depth-consumed).
 * Pure + deterministic: identical input ⇒ identical output + name order.
 */
export function neutralizeResidualCjsExports(source: string): { source: string; exported: string[] } {
  const text = String(source ?? "");
  const lines = text.split("\n");
  const bound = localBindingNames(text);
  const kept: string[] = [];
  const exported: string[] = [];
  let skipDepth = 0; // >0 while consuming a statement that is being DROPPED
  let keepDepth = 0; // >0 while consuming the value lines of a CONVERTED statement
  for (const line of lines) {
    if (skipDepth > 0) {
      skipDepth += cjsStatementDelta(line);
      continue;
    }
    if (keepDepth > 0) {
      kept.push(line);
      keepDepth += cjsStatementDelta(line);
      continue;
    }
    const t = line.trim();
    const assign =
      /^(?:module\.)?exports(?:\.([A-Za-z_$][\w$]*)|\[\s*"([A-Za-z_$][\w$]*)"\s*\]|\[\s*'([A-Za-z_$][\w$]*)\s*'\])\s*=/.exec(t);
    if (assign !== null) {
      const name = assign[1] ?? assign[2] ?? assign[3] ?? "";
      const reserved = RESERVED_BINDING_WORDS.has(name);
      if (reserved || bound.has(name)) {
        // The binding already exists (or can never be an ESM binding) — only
        // the CJS assignment statement itself goes.
        skipDepth = Math.max(0, cjsStatementDelta(line));
      } else {
        // The CJS assignment implied a binding: `module.exports.x = EXPR`
        // becomes `const x = EXPR` (multi-line value lines kept verbatim).
        const indent = line.slice(0, line.length - line.trimStart().length);
        kept.push(`${indent}const ${name} = ${t.slice(assign[0].length).trimStart()}`);
        keepDepth = Math.max(0, cjsStatementDelta(line));
      }
      if (!reserved && !exported.includes(name)) exported.push(name);
      continue;
    }
    if (t.startsWith("module.exports") || t.startsWith("exports[") || t.startsWith("exports =")) {
      // Bare/computed CJS surface — nothing to bind: drop the statement whole.
      skipDepth = Math.max(0, cjsStatementDelta(line));
      continue;
    }
    kept.push(line);
  }
  return { source: kept.join("\n"), exported };
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
 * A0: turn IIFE-scope-shared chunks into real ESM files with cross-file
 * imports. Chunk 0 moves off TREE_ENTRY_PATH so that path can be an `export *`
 * barrel the oracle/job-bridge/treeRun entry already import.
 *
 * W21-258: EVERY tree goes through this rewrite — single-chunk trees included.
 * They used to be returned unchanged ("legacy disk bytes", fixes/175), which
 * put raw P6 CommonJS into the emitted `"type":"module"` tenant and killed the
 * tenant's own spec at IMPORT (`ReferenceError: module is not defined in ES
 * module scope` → zero assertions → treeRunOk:false). A one-chunk tree now
 * materializes exactly like an N-chunk one: the chunk file (relocated off the
 * entry path when its planned path IS the entry path) + an ESM barrel at
 * TREE_ENTRY_PATH. `neutralizeResidualCjsExports` additionally removes the
 * non-listed `module.exports.*` surface a chunk may carry, so no emitted file
 * can reference the CJS `module` bindings at all.
 *
 * Later files import prior files (acyclic). The barrel imports every chunk
 * (does not get imported by them). Named exports are the envelope `exports`
 * list plus any extra CJS surface the chunk itself wrote. Deterministic:
 * identical input ⇒ identical files + barrel.
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
  if (raw.length === 0) {
    // Defensive only: every caller guards on a non-empty accepted list.
    return { files: [], entrySource: assembleTreeEntry(raw) };
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
    // W21-258: strip the declared-name CJS assigns, THEN neutralize whatever
    // CJS surface remains (a chunk's own extra exports) — the union of the
    // envelope exports and the converted names is the file's real ESM surface.
    const residual = neutralizeResidualCjsExports(stripCjsExportAssignments(f.source, f.exports));
    const body = residual.source.replace(/^\n+/, "").replace(/\n+$/, "");
    const exportNames = [...new Set([...f.exports.filter(isIdent), ...residual.exported])];
    const exportLine = exportNames.length > 0 ? `export { ${exportNames.join(", ")} };` : "";
    const source = [...importLines, body, exportLine].filter((s) => s.length > 0).join("\n") + "\n";
    rewritten.push({ path: f.path, source, exports: exportNames, reqTrace: { ...f.reqTrace } });
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
 * string. Never throws. Returns null for anything that is not a synthesis
 * envelope — callers keep their existing "no envelope" control flow.
 *
 * 217k (G6): a NON-BLANK reply that cannot be READ (JSON.parse failure, a
 * non-object payload, or a missing/blank `module`) reports the coded
 * EnvelopeReadFailure through the optional `sink` — an unreadable model reply
 * is no longer indistinguishable from "no output" (an absent/blank reply
 * stays silent: nothing was received, so there is nothing to report).
 */
export function parseSynthesisEnvelope(text: unknown, sink?: EnvelopeReadSink): SynthesisEnvelope | null {
  if (typeof text !== "string") return null;
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (cleaned.length === 0) return null; // blank reply — "no output", not a read failure
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch (err) {
    const why = err instanceof Error && err.message ? `JSON.parse failed: ${err.message.replace(/\s+/g, " ").trim().slice(0, 120)}` : "JSON.parse failed";
    sink?.(readFailure("parseSynthesisEnvelope", text, "unreadable-json", why));
    return null;
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    sink?.(readFailure("parseSynthesisEnvelope", text, "unexpected-shape", "the payload is not a JSON object"));
    return null;
  }
  const rec = obj as Record<string, unknown>;
  const module = typeof rec.module === "string" ? rec.module.trim() : "";
  if (!module) {
    sink?.(readFailure("parseSynthesisEnvelope", text, "unexpected-shape", "the payload has no non-empty `module` string"));
    return null;
  }
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

/**
 * W52/339-2 (THE NAME-BINDING GAP, in-file half): the oracle-case generation
 * contract is the module's REAL top-level export surface, not the plan's
 * signature list. The machine oracle is asked to reference "the contract
 * function names" (verify.server.ts buildOracleCasesPrompt) and its vacuity
 * gate grades against that same list; passing the PLANNED names let the
 * generated cases name identifiers the emitted module never binds (the keyed
 * run's `case-2: error ReferenceError: computeMean is not defined`). This is
 * the measured inventory — `exportedNamesOf` reads the actual export syntax of
 * the module bytes (ESM exports, `module.exports.x =`, `module.exports = {…}`)
 * — so the oracle is grounded on what really exists. Deterministic, no LLM,
 * sorted/deduped by the helper; an unreadable/empty surface falls back to the
 * validated claimed exports (never a fabricated name).
 *
 * NOTE (honest scope): grounding the CONTRACT removes one source of invented
 * names but cannot by itself prevent a model from inventing one from the
 * brief's nouns — the enforcement ("validate every called identifier against
 * the inventory BEFORE the case set is committed") lives in
 * verify.server.ts generateCases/runCases, which this lane does not own; the
 * exact shape is STOP-and-REPORTed in fixes/339_2_oracle-generation.md.
 */
export function oracleContractNames(module: string, claimedExports: readonly string[]): string[] {
  const measured = exportedNamesOf(typeof module === "string" ? module : "");
  if (measured.length > 0) return measured;
  return [
    ...new Set(
      (Array.isArray(claimedExports) ? claimedExports : []).filter(
        (e): e is string => typeof e === "string" && e.trim().length > 0,
      ),
    ),
  ];
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
  /** W45/331-4 (Finding B): the earlier chunks of this tree (path + exports). When
   *  present, a top-level declaration of a name an earlier chunk already exports is
   *  refused — the materialized ESM imports that export, so the duplicate is a
   *  load-time SyntaxError. W46/332-1 (P1): a chunk's `asyncExports` mark also lets
   *  the validator refuse an un-awaited async sibling call used as a value.
   *  Absent/null ⇒ the single-module path, byte-identical. */
  priorChunks?: readonly { path: string; exports: readonly string[]; asyncExports?: readonly string[] }[] | null,
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
  // W45/331-4 (Finding B): a later chunk must not redeclare a name an earlier chunk
  // exports. Checked LAST so the specific export-surface repairs above keep priority;
  // this is the class that ships an UNLOADABLE tree, so it is a refusal, not a warning.
  if (Array.isArray(priorChunks) && priorChunks.length > 0) {
    const dup = crossChunkDuplicateDeclarations(module, priorChunks);
    if (dup.length > 0) {
      const named = dup
        .map((d) => `"${d.name}" (declared at line ${d.line}; already exported by ${d.priorPath})`)
        .join(", ");
      return {
        ok: false,
        code: "RT_E_VALIDATION",
        error: `cross-chunk duplicate declaration: ${named} — the materialized ESM imports each earlier chunk's exports, so a same-named top-level declaration fails to load (SyntaxError: Identifier '${dup[0]!.name}' has already been declared)`,
      };
    }
  }
  // W46/332-1 (P1): an async callable (a sibling's async export, or the module's
  // own `async function`) whose result is consumed as a value without `await` —
  // property read, destructure, or stored-then-read. The real keyed tree's
  // `src/jobs/rehab.ts` did exactly this off the async `getProperty`, so the
  // returned Promise's rejection floated past the spec and reded the file. Checked
  // LAST (after the export-surface and duplicate repairs) so those keep priority.
  const asyncUses = unawaitedAsyncValueUses(module, asyncNamesInScope(module, priorChunks));
  if (asyncUses.length > 0) {
    const first = asyncUses[0]!;
    const extra = asyncUses.length > 1 ? ` (+${asyncUses.length - 1} more)` : "";
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `un-awaited async call used as a value: "${first.name}" at line ${first.line} (${first.form})${extra} — the call returns a Promise, so any property read off it is undefined and its rejection floats past the caller; await it before reading or destructuring the result`,
    };
  }
  return { ok: true, exports: claimed };
}

/**
 * p6-brief-fit pre-acceptance (DOD[6] probe parity, dod.ts): the brief's
 * required noun tokens must appear as code identifiers in the module — bar
 * max(1, ceil(required × 0.35)). 322 X1 (P6-C): recalibrated ½ → 0.35 —
 * measured honest coverage (TS-truth mask, stem-tolerant) is 40–50%, so 0.35
 * keeps ≥1 margin for stochastic keyed re-runs; placeholders (≈0 hits) still
 * fail by construction. Vocabulary-free briefs pass vacuously. KEEP IN
 * PARITY with dod.ts's p6-brief-fit probe.
 */
export function briefFitSatisfied(brief: string, source: string): { ok: boolean; missing: string[] } {
  const { required } = briefNounHits(brief);
  if (required.length === 0) return { ok: true, missing: [] };
  const hits = identifierHits(required, source);
  const need = Math.max(1, Math.ceil(required.length * 0.35));
  return { ok: hits.length >= need, missing: required.filter((t) => !hits.includes(t)) };
}

// --- live synthesis ----------------------------------------------------------

/**
 * fixes/341-1 (emitted-product integrity): one self-typecheck verdict for the
 * CANDIDATE emitted tree — the real `tsc` verdict of the project's OWN
 * declared `typecheck` script over a scratch materialization of the tree about
 * to be sealed. `"skip"` is honest non-verification (no declared script / an
 * un-runnable toolchain), never a pass — mirroring `treeRun`'s own declared-
 * script contract. `files` are the compiler-named offender paths (POSIX,
 * relative to the emitted root), used to route the bounded repair.
 */
export type P6TreeTypecheckVerdict = {
  run: "pass" | "fail" | "skip";
  detail?: string;
  files?: string[];
};

/** fixes/341-1: the injectable self-typecheck seam (default =
 *  `defaultTreeTypecheck`, the real `tsc` run; tests inject deterministic
 *  verdicts and the RED/GREEN cases inject the real default explicitly). */
export type P6TreeTypecheck = (project: Project) => Promise<P6TreeTypecheckVerdict>;

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
  /** fixes/326 F1b: the journey's one-shot gate-repair context — recorded
   *  unmet P6 DoD requirements (criteria + missing lists) from a
   *  green-tree-run/red-gate cycle. When present, the PRIMARY synthesis
   *  prompt (single-module and every tree chunk) carries it as a bounded
   *  "P6 GATE REPAIR CONTEXT" block; absent/blank ⇒ byte-identical legacy. */
  gateRepair?: string;
  /** fixes/328 F1 (Ledger): the previous cycle's refusal context — the refusal
   *  class + the model's own bounded reason — from a cycle that refused to
   *  synthesize (headless `p6CycleLiveDeps`, fixes/153 P2). When present, the
   *  PRIMARY synthesis prompt (single-module and every tree chunk) carries it
   *  as a bounded "P6 PREVIOUS-REFUSAL CONTEXT" block via
   *  withSynthesisRefusalContext; absent/blank ⇒ byte-identical legacy, so a
   *  cycle that was NOT refused synthesizes exactly as before. */
  synthesisRefusal?: string;
  /** T-107.1 (216r · W7-L1): opt-in patch (str_replace) repair level — when
   *  true a LOCALIZED defect (soft forbidden primitive / non-deterministic
   *  primitive / prose-in-code) gets ONE bounded delta attempt BEFORE the
   *  legacy full-rewrite repair; a refusal returns the legacy path unchanged.
   *  Absent/false keeps every prompt byte and the model-call count legacy. */
  patchRepairs?: boolean;
  /** T4 (112 §4.4 / 216g): human-accepted CROSS-PROJECT lesson rows, resolved
   *  by the caller via `knowledge.provenRowsFromStore`. When present they rank
   *  alongside the project's own memory lessons at EVERY lesson site here —
   *  the expansion call's advisory lines AND both PRIMARY synthesis prompts
   *  (single-module + every tree chunk) — through `lessonLinesForBrief`'s
   *  `opts.proven`. Absent/empty ⇒ each site passes `proven: undefined` and
   *  produces byte-identical legacy prompts (the additive-field discipline). */
  proven?: readonly RankableLessonRow[];
  /** fixes/341-1 (the measured P6 defect): the PRE-SEAL self-typecheck gate.
   *  Before a synthesized tree is accepted/sealed, the candidate emitted tree
   *  is materialized into a scratch dir and its OWN declared `typecheck` runs
   *  through the real compiler seam (`compile-check.server.ts typecheckDir`).
   *  A red verdict routes into the existing bounded per-chunk repair (or a
   *  coded partial refusal) — a type-red tree is never sealed. The default is
   *  the real `defaultTreeTypecheck`; it is disabled ONLY when a caller
   *  REPLACES the real pipeline by injecting BOTH `complete` and `verify`
   *  (that caller must pass this seam explicitly to opt back into the real
   *  gate; unit tests inject a deterministic verdict). Injecting a single seam
   *  does NOT disable the gate.
   */
  typecheckTree?: P6TreeTypecheck;
  /** fixes/343-1: opt-in best-of-N sample count for a unit of synthesis — the
   *  env var `P6_SYNTH_CANDIDATES` is the production knob (this option wins
   *  over it so a caller/test is explicit). Default 1 = today's single sample,
   *  byte-identical; hard-capped at `P6_SYNTH_CANDIDATES_MAX` (4). When >1, the
   *  model is resampled only while the current candidate fails the deterministic
   *  gates (structure -> brief-fit -> pre-seal typecheck) and the first candidate
   *  that clears them is kept; a winner is recorded in a
   *  `p6.synthesis.candidates` event naming the count, the winner, and why every
   *  candidate won/lost. */
  candidates?: number;
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
 * treatment expandBrief already has: a bounded attempt count with exponential
 * backoff (expandBrief: P6_EXPAND_MAX_ATTEMPTS = 3; this synthesis seam:
 * P6_SYNTH_MAX_ATTEMPTS = 2), and an honest RT_E_LLM_TIMEOUT only after BOTH
 * synthesis attempts fail. 312 C5: this sentence used to read "expandBrief
 * already has: 2 attempts" — DA1 falsified the count and the 311 guard
 * re-verified it (fixes/311_da1_claims.md:16, fixes/311_wd_guard.md:39): the 2
 * belongs to synthesis, expandBrief is 3 (backoff 500/1000ms, see :2429/:2449).
 * Non-transient failures
 * (not-configured, provider rejection, unparseable) return immediately —
 * never a blind re-run. The `sleep` seam is injectable for deterministic tests.
 */
export const P6_SYNTH_MAX_ATTEMPTS = 2;
export const P6_SYNTH_BACKOFF_MS = 1000;

function isTransientSynthFailure(res: LlmResult): boolean {
  return res.ok === false && res.code === "RT_E_LLM_TIMEOUT";
}

// R4-f03 (W30 · LANE S3): the duplicate env parser (`p6TokenCapFromEnv`) is
// GONE — ONE parser for `RAPIDTOOL_TOKEN_CAP` lives in token-ledger.ts
// (`tokenCapFromEnv`), and the process-scoped ledger + cap come from
// `sessionTokenBudget()` (the same object every production call site below
// shares, so the cap binds the RUN, not one call — R12-f02's runaway).
function accountSynthUsage(ledger: TokenLedger, res: LlmResult, cap: number | undefined): LlmResult | null {
  // FM-03 (W37 Y1): record EVERY response that reports usage — success or not
  // (the I2 ledger contract, token-ledger.ts: "record every response that
  // reports usage, success or not"). Before this, a refusal that reported
  // usage was silently dropped and RAPIDTOOL_TOKEN_CAP under-counted real
  // spend. Return identity is unchanged when no cap is set.
  if (!res.usage) return null;
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

/**
 * FM-03 (W37 Y1): bounded repair re-prompts call `completeCall` directly,
 * outside `synthWithBackoff` — before this their spend was invisible to the
 * session ledger (RAPIDTOOL_TOKEN_CAP systematically under-counted by every
 * repair call, and a budget stop surfaced as a model/provider-failure story).
 * Record the repair reply against the SAME session budget the primary call
 * used and hand the caller the coded stop to surface (RT_E_BUDGET_EXHAUSTED),
 * never a degraded prose refusal.
 */
function accountRepairUsage(res: LlmResult): { error: string } | null {
  const { ledger, cap } = sessionTokenBudget();
  const stopped = accountSynthUsage(ledger, res, cap);
  if (!stopped) return null;
  // W38 boundary fix: narrow at the single point so all 6 call sites read a guaranteed string
  // (the previous return type echoed the union, so `.error` was a TS2339 on the ok variant).
  return {
    error: !stopped.ok
      ? stopped.error ?? "session token budget exhausted during a repair call"
      : "session token budget exhausted during a repair call",
  };
}

export async function synthWithBackoff(
  complete: (prompt: string, opts?: DeepSeekCompleteOptions) => Promise<LlmResult>,
  prompt: string,
  opts: DeepSeekCompleteOptions,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  // R4-f03 (W30 · LANE S3): the defaults are the PROCESS session budget —
  // every production call site (below) passes neither, so all of them share
  // ONE ledger + ONE cap: `RAPIDTOOL_TOKEN_CAP` binds the whole RUN, not a
  // single call (R12-f02's runaway). Explicit callers/tests keep full control
  // (pass your own ledger+cap, or use token-ledger.ts `resetSessionBudget()`).
  ledger: TokenLedger = sessionTokenBudget().ledger,
  cap: number | undefined = sessionTokenBudget().cap,
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

/** fixes/341-1: scratch-dir prefix for the pre-seal self-typecheck (never the
 *  subject; deleted on every exit path). */
const P6_TYPECHECK_SCRATCH_PREFIX = "rt-p6-typecheck-";
/** fixes/341-1: the most compiler-named chunk files ONE bounded repair round
 *  re-synthesizes before the tree is refused. */
export const P6_TYPECHECK_REPAIR_MAX_CHUNKS = 3;

/**
 * fixes/341-1: the file paths a `tsc` / declared-typecheck tail names — the
 * compiler's `path(line,col): error TSxxxx:` rows (POSIX or Windows
 * separators, optional leading whitespace). Deduped, declaration order kept,
 * capped. Pure + deterministic.
 */
export function typecheckOffenderPaths(detail: string | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of String(detail ?? "").split("\n")) {
    const m = /^\s*(.+?\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs))\s*\(\d+,\d+\)\s*:/.exec(raw);
    if (!m) continue;
    const p = m[1]!.trim().replace(/\\/g, "/");
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.length >= 16) break;
  }
  return out;
}

/**
 * fixes/341-1 (the measured P6 defect): the REAL pre-seal self-typecheck. The
 * chunked/single-module synthesis used to seal a tree that failed its OWN
 * advertised `typecheck` (measured keyed cli-tool: TS2749 `TextDecoder` used
 * as a type + TS2440 import/local conflict, while `compile.failed=0`, the
 * oracle passed and the entry smoke passed) because NEITHER P6 path ran the
 * compiler — `parseVerdictForSource` is syntax-only and `verifyAndFixServer`
 * compiles with `new Function` (JS-only). This seam materializes the CANDIDATE
 * emitted project into a scratch dir (the pure `scaffoldProject` emitter — the
 * exact bytes the tree-run later judges) and runs its OWN declared `typecheck`
 * through the real compiler seam (`compile-check.server.ts typecheckDir`).
 * A red verdict must never be sealed; a `skip` (absent/un-runnable toolchain)
 * is honest non-verification, mirroring the tree-run's own skip contract.
 */
export async function defaultTreeTypecheck(project: Project): Promise<P6TreeTypecheckVerdict> {
  let files: { path: string; body: string }[];
  try {
    const scaffold = scaffoldProject(project);
    if (!scaffold.ok) {
      return { run: "fail", detail: `scaffold refused the candidate tree before its declared typecheck: ${scaffold.error}` };
    }
    files = scaffold.files;
  } catch (err) {
    return {
      run: "fail",
      detail: `scaffold threw before the candidate tree's declared typecheck: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const dir = mkdtempSync(join(tmpdir(), P6_TYPECHECK_SCRATCH_PREFIX));
  const linked = join(dir, "node_modules");
  try {
    for (const f of files) {
      const abs = join(dir, f.path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, f.body);
    }
    const verdict: TreeProjectScriptVerdict = await typecheckDir(dir);
    if (verdict.run === "pass") return { run: "pass" };
    if (verdict.run === "skip") {
      return {
        run: "skip",
        detail:
          verdict.note ??
          "the declared typecheck script was not executed (absent or un-runnable toolchain) — the tree's typing is UNVERIFIED, not a pass",
      };
    }
    const detail =
      [verdict.detail, verdict.note].filter((s): s is string => typeof s === "string" && s.trim().length > 0).join(" · ").trim() ||
      `the declared typecheck script ${verdict.run === "fail" ? "exited non-zero" : verdict.run}`;
    return { run: "fail", detail, files: typecheckOffenderPaths(verdict.detail) };
  } catch (err) {
    return {
      run: "fail",
      detail: `self-typecheck harness error: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    // The scratch carries a junction to the repo's own node_modules (or the
    // subject's). Unlink it FIRST so recursive removal can never chase it.
    try {
      if (existsSync(linked)) unlinkSync(linked);
    } catch {
      /* best-effort: rmSync below still unlinks a junction, never its target */
    }
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort temp cleanup (Windows locks) */
    }
  }
}

/**
 * fixes/341-1: run the self-typecheck seam against the CANDIDATE project the
 * tree is about to be sealed as (generatedTree/generatedSource exactly as
 * `treeUpgraded` would set them). Fail-closed on a missing/malformed verdict
 * and on a seam throw: a gate that cannot answer never seals.
 */
async function runTreeSelfTypecheck(
  project: Project,
  materialized: { files: readonly ImportableTreeFile[]; entrySource: string },
  typecheck: P6TreeTypecheck,
): Promise<P6TreeTypecheckVerdict> {
  const candidate: Project = {
    ...project,
    generatedTree: materialized.files.map((f) => toGeneratedTreeFile(f.path, f.source)),
    generatedSource: materialized.entrySource,
  };
  try {
    const verdict = await typecheck(candidate);
    if (!verdict || (verdict.run !== "pass" && verdict.run !== "fail" && verdict.run !== "skip")) {
      return { run: "fail", detail: "the self-typecheck seam returned no usable verdict — fail closed" };
    }
    return verdict;
  } catch (err) {
    return { run: "fail", detail: `self-typecheck seam threw: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** fixes/341-1: the emitted path a raw accepted chunk lands at after
 *  `materializeImportableTree` (which relocates a chunk emitted at the tree
 *  ENTRY path to `src/generated/chunk-0*.ts`). Mirrors that relocation exactly
 *  so a compiler-named file maps back to its accepted chunk. */
function materializedPathForAccepted(accepted: readonly { path: string }[], i: number): string {
  if (i === 0 && accepted[0]?.path === TREE_ENTRY_PATH) {
    const taken = new Set(accepted.map((f) => f.path));
    let p = TREE_CHUNK0_RELOCATED_PATH;
    if (taken.has(p)) {
      let n = 2;
      while (taken.has(`src/generated/chunk-0-${n}.ts`)) n += 1;
      p = `src/generated/chunk-0-${n}.ts`;
    }
    return p;
  }
  return accepted[i]?.path ?? "";
}

/** fixes/341-1: the accepted-chunk indices the self-typecheck verdict names —
 *  from the seam's `files`, else the detail's own compiler rows. Capped at
 *  `P6_TYPECHECK_REPAIR_MAX_CHUNKS` so one bounded round stays bounded. */
function typecheckOffenderIndices(
  verdict: P6TreeTypecheckVerdict,
  accepted: readonly { path: string }[],
): number[] {
  const paths = new Set<string>((verdict.files ?? []).map((p) => String(p).replace(/\\/g, "/")));
  for (const p of typecheckOffenderPaths(verdict.detail)) paths.add(p);
  const out: number[] = [];
  for (let i = 0; i < accepted.length; i++) {
    if (paths.has(materializedPathForAccepted(accepted, i))) out.push(i);
    if (out.length >= P6_TYPECHECK_REPAIR_MAX_CHUNKS) break;
  }
  return out;
}

/** fixes/341-1: the bounded tree-failure context handed to a typecheck repair
 *  re-prompt — the compiler's own report, header first (the existing
 *  `withTreeFailureContext` reader normalizes + bounds it downstream). */
function typecheckRepairContext(verdict: P6TreeTypecheckVerdict): string {
  return (
    "the candidate emitted tree fails its OWN declared `npm run typecheck` — " +
    "fix the type error(s) WITHOUT restructuring the tree (the compiler report follows):\n" +
    String(verdict.detail ?? "").replace(/\s+/g, " ").trim()
  ).slice(0, 3000);
}


/**
 * W52/339-2: the `p6.synthesis.refused` detail budget. The previous 160-char
 * hard slice cut the harness/sanitizer's OWN reason out of the surfaced
 * refusal: a verify-failure evidence reads
 * `machine-run cases still failing after 3 iterations: case-1: …; case-2: …
 * (one or more case expressions failed the harness safety check)` and the
 * sanitizer's reason + the offending case id ride the END, so a 160-char
 * head-only cut left only an unactionable "case payload rejected by harness
 * safety check" for BOTH the operator and the next cycle's synthesis prompt
 * (withSynthesisRefusalContext). A generous, documented cap keeps the whole
 * recorded evidence; anything longer is elided in the MIDDLE (head + tail
 * preserved, with a visible marker) so the code/first failing cases AND the
 * terminal reason always survive. Event name / RT_E_* contract unchanged.
 */
export const P6_REFUSAL_DETAIL_MAX = 1200;

/** Head+tail bound with a visible middle elision marker (never a silent
 *  head-only cut): the result never exceeds `max` chars, and both ends are
 *  preserved. Pure + deterministic. */
export function boundedRefusalDetail(detail: string, max = P6_REFUSAL_DETAIL_MAX): string {
  const clean = typeof detail === "string" && detail.trim() ? detail.trim() : "unknown";
  if (clean.length <= max) return clean;
  const markerLen = ` …[elided ${clean.length} chars]… `.length;
  const keep = Math.max(0, max - markerLen);
  const head = Math.ceil(keep * 0.6);
  const tail = keep - head;
  const elided = clean.length - keep;
  return (
    clean.slice(0, head) +
    ` …[elided ${elided} chars]… ` +
    (tail > 0 ? clean.slice(clean.length - tail) : "")
  );
}

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
        detail: `${code} · ${boundedRefusalDetail(clean)}`,
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

/**
 * T5.4 (W18 LANE 5): an artifact record carrying its provenance stamp. The
 * stamp shape + vocabulary live in io.ts (exported as `ArtifactProvenance`);
 * the field is not yet folded onto the `Artifact` type in types.ts (outside
 * this lane's file box), so every emit site widens structurally here.
 */
type StampedArtifact = Artifact & { provenance?: ArtifactProvenance };

/**
 * T5.4: the provenance stamp for a MODEL-produced artifact. `servedModel` must
 * be the id the provider ACTUALLY served (its own `LlmResult.model`) — never
 * the requested constant. Fail closed: a blank served id (or a blank input
 * hash) yields null — no stamp at all rather than a guessed/unverifiable
 * producer (declare-or-strike; fixes/217c §T5.4: a stamp that guesses the
 * producer is worse than none).
 */
function modelProvenance(servedModel: unknown, inputHash: string): ArtifactProvenance | null {
  const model = typeof servedModel === "string" ? servedModel.trim() : "";
  if (!model || !inputHash) return null;
  return { producer: "model", model, timestamp: Date.now(), inputHash };
}

/**
 * T5.4: the provenance stamp for a deterministic (machine-derived) record —
 * rendered from inputs by code, never by a model call. Carries no `model` key
 * by construction (a deterministic record is never model-stamped).
 */
function deterministicProvenance(inputHash: string): ArtifactProvenance {
  return { producer: "deterministic", timestamp: Date.now(), inputHash };
}

/**
 * W52/338-1 follow-up (spine): the ONE verify-evidence hash formula — mirrors
 * verify.ts applyVerifyOutcome's `fnv1a(finalSource \u0002 evidence \u0002
 * caseCommitment)` so one witness covers every input the verifier produces.
 * Before this the codegen twins hashed `source \u0002 evidence` only, so two
 * outcomes whose source+evidence agreed but whose ORACLE CASE SET differed
 * minted the same evidence hash (a genuine verification silently conflated
 * with another). `source` plays verify.ts's `finalSource` role — the verified
 * module bytes codegen records. (Known limit, unchanged: codegen hashes its
 * cleaned `finalModule` while verify.ts hashes `outcome.finalSource`; a
 * fence/trim difference between them can still make a re-apply miss the
 * dedupe — reported, not silently papered over.)
 */
function verifyEvidenceHash(source: string, outcome: VerifyOutcome): string {
  const caseCommitment = JSON.stringify(
    (Array.isArray(outcome.cases) ? outcome.cases : []).map((c) => {
      const row = c as { id?: unknown; expression?: unknown } | null | undefined;
      return [
        typeof row?.id === "string" ? row.id : "",
        typeof row?.expression === "string" ? row.expression : "",
      ];
    }),
  );
  return String(fnv1a(`${source}\u0002${outcome.evidence}\u0002${caseCommitment}`));
}

function verifyOutcomeArtifact(finalModule: string, outcome: VerifyOutcome): StampedArtifact {
  // W52/338-1: the shared verify-evidence formula (verify.ts parity) — the
  // source/evidence boundary \u0002 AND the oracle case commitment.
  const evidenceHash = verifyEvidenceHash(finalModule, outcome);
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
    // T5.4: the runner's evidence text is machine-derived — producer
    // "deterministic" (never model-stamped); the input hash is the same
    // verified-module+evidence hash the artifact id already derives from.
    provenance: deterministicProvenance(evidenceHash),
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
 * FM-04 (W37 Y1): the packet-facing `project.modelRoute` is DERIVED from the id
 * the provider actually SERVED — never the old hardcoded flash constant.
 * Before this, a `DEEPSEEK_MODEL_MAIN=deepseek-v4-pro` pin (or any future
 * non-flash serve) left the run record claiming `deepseek-flash` while the
 * artifact provenance correctly named the served id: the declared serve-model
 * honesty held for artifacts and failed for the run record. The union
 * (types.ts `ModelRoute`) is closed and DeepSeek-scoped: a `…pro` id maps to
 * "deepseek-pro", every flash-tier id maps to "deepseek-flash", and an
 * absent/unrecognized served id keeps the historical flash label (the tier
 * every synthesis call REQUESTS — P6_SYNTH_MODEL; the unserved case is the
 * already-declared default, never a guess about a serve that did not report).
 * A non-DeepSeek provider id is unreachable today — `RAPIDTOOL_PROVIDER=xai`
 * refuses by construction (FM-11) — TODO(FM-04b): widen the union + the io.ts
 * validator when a cross-family route becomes reachable (W-45/OWNER keys).
 */
function modelRouteForServed(servedModel: string | null | undefined): ModelRoute {
  const id = typeof servedModel === "string" ? servedModel.trim().toLowerCase() : "";
  if (id.includes("pro")) return "deepseek-pro";
  return "deepseek-flash";
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
function upgraded(
  project: Project,
  finalModule: string,
  outcome: VerifyOutcome,
  specRecord: Project["implementationSpec"],
  /** T5.4: the id the provider actually served for this synthesis — the
   *  primary call's `LlmResult.model` (every bounded repair re-prompt reuses
   *  the same opts/model resolution). Blank/null ⇒ no stamp, fail closed. */
  servedModel: string | null,
): Project {
  // W52/338-1: the SAME shared verify-evidence formula verifyOutcomeArtifact
  // and verify.ts applyVerifyOutcome use — this hash IS the "tested"
  // lastTest.evidenceHash, so one formula covers every input.
  const evidenceHash = verifyEvidenceHash(finalModule, outcome);
  // T5.4: the model-produced module's stamp — the SERVED model id + the
  // synthesis input hash (the persisted brief hash).
  const prov = modelProvenance(servedModel, specRecord?.briefHash ?? "");
  const codeArtifact: StampedArtifact = {
    id: `6-code-llm-module-${evidenceHash.slice(0, 8)}`,
    phase: 6,
    kind: "code",
    title: "Generated module (LLM, machine-verified)",
    body: finalModule,
    language: "javascript",
    ...(prov ? { provenance: prov } : {}),
  };
  const memoryId = "6-episodic-0.93";
  // W52/338-1 follow-up (spine): the L4 verified-procedure row `verify.server`
  // mints on a PASSED outcome was silently dropped here — the automated pass
  // consumed the outcome but never wrote its lesson. Fold it into memory
  // idempotently by row id (an existing twin is never duplicated), mirroring
  // verify.ts applyVerifyOutcome's own capture.
  const lesson = outcome.lesson;
  const episodic = [
    ...(project.memory ?? []).filter((m) => m.id !== memoryId),
    {
      id: memoryId,
      kind: "episodic" as const,
      phase: 6 as PhaseId,
      text: `Keyed P6 synthesis: ${outcome.evidence.slice(0, 90)}`,
      score: 0.93,
      source: "engine" as const,
    },
  ];
  const memory = (lesson && !episodic.some((m) => m.id === lesson.id) ? [...episodic, lesson] : episodic).slice(0, 80);
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
    // FM-04 (W37 Y1): derived from the SERVED id, never a hardcoded constant.
    modelRoute: modelRouteForServed(servedModel),
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
 * fixes/148 (F1 — tree-trigger scope) / fixes/342-1 follow-up: whether a
 * project is SINGLE-ENTRY eligible — the ONLY state the ≤8-signature
 * byte-parity `synthesizeSingleModule` path may serve. `Project.kind` is the
 * OPTIONAL 5-way `DeliveryKind` (342-4) decided once by `engine.deliveryKindOf`
 * and stamped by `engine.withDeliveryKind` at the keyed P6 seam.
 *
 * RULE (fixes/342-1 follow-up, decided from the K9-verified service bytes): the
 * single-module runtime harness serves the SINGLE-ENTRY product kinds — kind
 * ABSENT (the brief-expressed library/module fixtures the fixes/144 byte-parity
 * pins protect, plus legacy/imported payloads), `library`, and `service`. A
 * service is a single-entry product exactly like a library: the verified
 * order-webhook service ships ONE runnable `src/main.ts` entry declared by
 * package.json, `scaffold.projectKindOf` maps both onto the same `src/main.ts`
 * emitter, and `scripts/run-eval.mjs` maps a corpus `service` to kind-ABSENT for
 * the same reason (341_1 §R3 names this the "library/service" lane). 342-4's
 * engine stamps `kind:"service"`, which must not move that brief into the tree.
 *
 * The MULTI-FILE kinds — `app` (webapp), `tool` (CLI/agent utility) and `game`
 * (playable game) — are NOT single-entry: their honest module is the tree entry
 * + per-capability files, so they route to the chunked tree regardless of
 * signature count (fixes/145 M1=0 root cause: a ≤8-signature webapp brief fell
 * into the single-module path by construction).
 *
 * W56/342-1 (cross-lane contract): `"library"` stays in the union so the check
 * compiled with or without the 342-4 widening of `Project["kind"]`; it is now a
 * legal member and the explicit arm remains as documentation of intent.
 */
export function singleModuleLibraryKind(project: {
  /** `"library"` is admitted in the union so the check compiles with or
   *  without the cross-lane widening of `Project["kind"]`. */
  kind?: Project["kind"] | "library" | null;
}): boolean {
  return (
    project.kind === undefined ||
    project.kind === null ||
    project.kind === "library" ||
    project.kind === "service"
  );
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
  // fixes/341-1: the PRE-SEAL self-typecheck gate. It is part of the REAL
  // synthesis pipeline, so it is live unless the caller has replaced BOTH real
  // pipeline seams (`complete` AND `verify`) — production (engine.liveLayer
  // forwards only the failure-context fields, never an LLM/verify seam) always
  // gates, and a PARTIAL injection (only one seam) does NOT silently disable
  // the gate. A caller that replaces both seams owns that pipeline and must
  // pass `typecheckTree` explicitly to opt into the real gate (the unit tests
  // inject a deterministic verdict; the RED/GREEN tests pass
  // `defaultTreeTypecheck` explicitly). Only the both-seams-replaced shape
  // yields the null/legacy behavior.
  const typecheck: P6TreeTypecheck | null =
    deps?.typecheckTree ??
    (deps?.complete !== undefined && deps?.verify !== undefined ? null : defaultTreeTypecheck);
  // M3-2: the optional tree-run failure context rides every bounded repair
  // re-prompt of THIS synthesis when the caller supplied it (defensively
  // normalized at the prompt builders; absent ⇒ byte-identical legacy text).
  const treeFailure = deps?.treeFailure;
  // fixes/326 F1b: the one-shot gate-repair context (journey PREP-1).
  const gateRepair = deps?.gateRepair;
  // fixes/328 F1 (Ledger) PREP-2: the previous cycle's refusal context —
  // defensively normalized at withSynthesisRefusalContext; absent/blank ⇒
  // byte-identical legacy primary prompt.
  const synthesisRefusal = deps?.synthesisRefusal;
  // T-107.1 (216r · W7-L1): the opt-in patch-repair level (see
  // P6SynthesisDeps.patchRepairs) — false unless the caller asks for it.
  const patchRepairs = deps?.patchRepairs === true;
  // T4 (112 §4.4 / 216g): the caller's resolved cross-project proven rows —
  // ranked with the memory lessons at every lesson site below; absent/empty ⇒
  // opts.proven is undefined ⇒ byte-identical legacy prompts.
  const proven = deps?.proven;
  // fixes/343-1: the opt-in best-of-N sample count. `deps.candidates` wins over
  // `P6_SYNTH_CANDIDATES`; the resolver clamps to 1..P6_SYNTH_CANDIDATES_MAX and
  // defaults to 1, so an unset env keeps every byte and model call below legacy.
  const candidates = resolveSynthesisCandidates(deps?.candidates, process.env.P6_SYNTH_CANDIDATES);
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
    // 339-4: reuse only a spec whose six-key envelope is conformant. The old
    // requirements-only guard reused a pre-lane persisted spec whose other
    // five keys were absent at runtime; expandedSpecViolations names them.
    expandedSpecViolations(existing).length === 0
      ? existing
      : null;
  let spec = specFields;
  if (spec === null) {
    // fixes/124 A3-03 (read-back wire): prior-run lessons from project.memory
    // re-inject into the keyed P6 expansion — selectLessons (phase-6-preferred,
    // score-capped, phase-agnostic fallback) → lessonLinesForBrief (FusionRank
    // against the brief + provenance-visible line form) → expandBrief lessons.
    // Advisory only: ranking never changes gate inputs; empty memory keeps the
    // legacy byte-identical expansion prompt (lessons omitted). T4 (112 §4.4):
    // the caller's proven cross-project rows rank alongside the memory rows.
    const lessonLines = lessonLinesForBrief(
      brief,
      selectLessons(project.memory ?? [], 6, EXPAND_LESSON_RANK_LIMIT),
      { limit: EXPAND_LESSON_RANK_LIMIT, proven },
    );
    const note = typeof project.notes === "string" ? project.notes.trim() : "";
    const withNotes = note ? [`project.notes: ${note.slice(0, 240)}`, ...lessonLines] : lessonLines;
    const expanded = await expand(brief, withNotes.length > 0 ? withNotes : undefined);
    if (!expanded.ok) {
      return refuse(
        project,
        expanded.reason === "not-configured" ? "RT_E_LLM_NOT_CONFIGURED" : (expanded.code ?? "RT_E_LLM_REJECTED"),
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
  // ONLY the single-entry kinds (kind ABSENT: undeclared/legacy, E-15 never
  // infers kind; `library`; `service` — fixes/342-1 follow-up), where ≤8
  // signatures ⇒ ONE chunk ⇒ the legacy single-module path below (one pro call
  // + bounded repair re-prompts + machine verify → upgraded) byte-for-byte.
  // Every MULTI-FILE delivery kind ("app" = webapp / "tool" / "game") and every
  // >8-signature spec ⇒ the chunked tree: one pro-tier call PER chunk with the
  // earlier chunks' exports as context, deterministic per-file validation,
  // deterministic assembly into Project.generatedTree. A kind-absent project
  // with zero signatures keeps the legacy path (nothing to chunk).
  const chunkGroups = chunkTypeSignatures(specRecord.typeSignatures);
  if (singleModuleLibraryKind(project) && chunkGroups.length <= 1) {
    return synthesizeSingleModule(project, brief, specRecord, signatureNames, complete, verify, treeFailure,
      patchRepairs, gateRepair, synthesisRefusal, proven, typecheck, candidates);
  }
  // fixes/216k (105 TA-15, W6-L1): the chunked driver computes its own
  // chunk→file plan (treeChunkPlan) and consumption order (orderTreeChunks)
  // INSIDE — the caller no longer passes a flat grouping. Job-keyed chunks land
  // at their spec-graph `src/jobs/*.ts` paths; a job-less graph keeps the
  // pre-216k index-keyed mapping byte-for-byte (treeChunkPlan's legacy branch).
  return synthesizeChunkedTree(project, brief, specRecord, complete, treeFailure, patchRepairs, gateRepair, synthesisRefusal, proven, typecheck, candidates);
}

/**
 * fixes/144 (M2): the legacy single-module synthesis — used ONLY for the
 * single-entry kinds (kind-absent/undeclared — fixes/148 F1 — plus `library`
 * and `service` — fixes/342-1 follow-up) whose spec carries ≤8 typeSignatures
 * (one chunk), so the pre-M2 pipeline is
 * preserved
 * byte-for-byte: one pro-tier call + one bounded repair re-prompt per failure
 * class (envelope / export-binding / forbidden / missing-signature /
 * brief-fit) + deterministic export-injection + machine verify
 * (verifyAndFixServer) + the upgraded honest state, with the verified module
 * materialized to ESM at synthesis time (FM-01 · W37 Y1: an ESM barrel at
 * TREE_ENTRY_PATH + the module relocated to TREE_CHUNK0_RELOCATED_PATH with
 * its CJS assigns stripped — generatedSource is the barrel entry, never raw
 * CJS; the machine-verified artifact keeps describing the verified module).
 * The ≤8-signature legacy PIPELINE is unchanged (one call + bounded repairs +
 * machine verify, byte-for-byte).
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
  gateRepair?: string,
  /** fixes/328 F1 (Ledger): the previous cycle's refusal context — appended to
   *  the PRIMARY prompt (withSynthesisRefusalContext); absent ⇒ legacy bytes. */
  synthesisRefusal?: string,
  /** T4 (112 §4.4 / 216g): the caller's resolved cross-project proven rows,
   *  ranked with the memory lessons; absent/empty ⇒ legacy prompt bytes. */
  proven?: readonly RankableLessonRow[],
  /** fixes/341-1: the PRE-SEAL self-typecheck gate (null ⇒ legacy, no gate).
   *  The single-module path covers library/service products, whose emitted ESM
   *  tree is judged by the same declared `typecheck`; a red verdict refuses the
   *  seal (never a machine-run-green but type-red `tested` artifact). */
  typecheck: P6TreeTypecheck | null = null,
  /** fixes/343-1: opt-in best-of-N sample count (1 ⇒ legacy byte-identical). */
  candidates = 1,
): Promise<Project> {
  // --- Step 2 (legacy): synthesis (one call + one bounded repair re-prompt) --
  const lessonLines = lessonLinesForBrief(
    brief,
    selectLessons(project.memory ?? [], 6, EXPAND_LESSON_RANK_LIMIT),
    { limit: EXPAND_LESSON_RANK_LIMIT, proven },
  );
  // R10-f01 (W39 Z2): project.contracts rides the prompt — the model used to
  // write the module body blind to the A6 data contract (G3's wire).
  const user = withTreeFailureContext(
    withSynthesisRefusalContext(
      withGateRepairContext(p6SynthesisUserPrompt(brief, specRecord, lessonLines, project.contracts), gateRepair),
      synthesisRefusal,
    ),
    treeFailure,
  );
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
  // 217k (W12 LANE B · fixes/216y G6): the unreadable-reply sink for every
  // envelope read in this call — a reply that ARRIVED but could not be read
  // lands in the same bounded attempt journal the patch sink and the terminal
  // refusal trail use, so a parse failure is never again indistinguishable
  // from "no output".
  const readSink: EnvelopeReadSink = (failure) => pushAttemptLog(attemptLogs, envelopeReadLogEntry(failure, TREE_ENTRY_PATH));
  const res = await synthWithBackoff(completeCall, user, opts);
  if (!res.ok) {
    return refuse(
      withAttemptLogs(project, attemptLogs),
      res.reason === "not-configured" ? "RT_E_LLM_NOT_CONFIGURED" : res.code ?? "RT_E_LLM_REJECTED",
      res.error ?? res.reason ?? "synthesis call failed",
    );
  }
  let envelope = parseSynthesisEnvelope(res.text, readSink);
  if (envelope === null) {
    const repair = await completeCall(p6SynthesisRepairPrompt(treeFailure), opts);
    // FM-03 (W37 Y1): repair-re-prompt spend is metered against the session
    // budget; a stop is served as the coded refusal, never as model-failure prose.
    const repairStop = accountRepairUsage(repair);
    if (repairStop) {
      return refuse(withAttemptLogs(project, attemptLogs), "RT_E_BUDGET_EXHAUSTED", repairStop.error ?? "session token budget exhausted during a repair re-prompt");
    }
    if (repair.ok) envelope = parseSynthesisEnvelope(repair.text, readSink);
  }
  if (envelope === null) {
    return refuse(withAttemptLogs(project, attemptLogs), "RT_E_LLM_REJECTED", "model returned an unparseable synthesis envelope after one repair attempt");
  }

  // --- Step 2b: opt-in best-of-N candidate selection (fixes/343-1) -----------
  // Engaged ONLY when the caller/env asked for >1 candidates; the default (1)
  // leaves every line below byte-identical. Each candidate is judged against
  // the ordered deterministic gates that already exist on this path — structure
  // (validateSynthesisModule) → brief-fit (briefFitSatisfied) → pre-seal
  // typecheck (the real tsc seam) — and the FIRST candidate to clear them all
  // is kept, so a gate-green winner skips the bounded repair block below. When
  // NO candidate clears the gates the primary sample stands and the legacy
  // repair path still runs: selection is never worse than not selecting.
  // Extra samples are produced lazily (only while the current candidate fails)
  // and metered through the same session budget as every repair call.
  if (candidates > 1) {
    const gateCandidate = async (env: SynthesisEnvelope): Promise<CandidateEvaluation> => {
      const structure = validateSynthesisModule(env.module, env.exports, signatureNames);
      if (!structure.ok) return { passed: false, reason: `structure refused (${structure.code}: ${structure.error})` };
      const fitCheck = briefFitSatisfied(brief, env.module);
      if (!fitCheck.ok) return { passed: false, reason: `brief-fit missing ${fitCheck.missing.slice(0, 6).join(", ")}` };
      if (typecheck === null) return { passed: true, reason: "structure + brief-fit (no typecheck seam)" };
      const candidateTree = materializeImportableTree([
        { path: TREE_ENTRY_PATH, source: env.module, exports: env.exports, reqTrace: env.reqTrace },
      ]);
      const verdict = await runTreeSelfTypecheck(project, candidateTree, typecheck);
      if (verdict.run === "fail") {
        return { passed: false, reason: `pre-seal typecheck refused (${String(verdict.detail ?? "").replace(/\s+/g, " ").slice(0, 200)})` };
      }
      return {
        passed: true,
        reason: verdict.run === "pass" ? "structure + brief-fit + pre-seal typecheck" : "structure + brief-fit (typecheck skipped — unverified)",
      };
    };
    const selection = await selectBestOfN<SynthesisEnvelope>(
      candidates,
      async (index) => {
        if (index === 0) return envelope;
        const resample = await completeCall(user, opts);
        const resampleStop = accountRepairUsage(resample);
        if (resampleStop !== null) return null; // budget stop — keep sampling bounded and honest
        if (!resample.ok) return null;
        return parseSynthesisEnvelope(resample.text, readSink);
      },
      gateCandidate,
    );
    if (selection.chosen !== null && selection.winner !== null) envelope = selection.chosen;
    pushAttemptLog(attemptLogs, {
      ts: Date.now(),
      phase: 6 as PhaseId,
      level: "info",
      event: "p6.synthesis.candidates",
      detail: candidatesLogDetail("single-module", candidates, selection.winner, selection.outcomes),
    });
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
    // W46/332-1 (P1): the un-awaited-async-value class for the single-module
    // path (its own `async function` used as a value without await).
    const asyncUses = unawaitedAsyncValueUses(envelope.module, asyncNamesInScope(envelope.module));
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
    if (!patchLanded && (unbound.length > 0 || repairableForbidden || missingSig.length > 0 || nondet !== null || prose.length > 0 || asyncUses.length > 0)) {
      const repairPrompt = unbound.length > 0
        ? p6SynthesisExportRepairPrompt(unbound, treeFailure)
        : repairableForbidden
          ? p6SynthesisForbiddenRepairPrompt(hit.soft ?? "unknown", treeFailure)
          : missingSig.length > 0
            ? p6SynthesisSignatureRepairPrompt(missingSig, treeFailure)
            : nondet !== null
              ? p6SynthesisNondeterministicRepairPrompt(nondet, treeFailure)
              : prose.length > 0
                ? p6SynthesisProseRepairPrompt(prose, treeFailure)
                : p6SynthesisAsyncAwaitRepairPrompt(asyncUses, treeFailure);
      const repair = await completeCall(repairPrompt, opts);
      // FM-03 (W37 Y1): metered like every bounded repair call.
      const repairStop = accountRepairUsage(repair);
      if (repairStop) {
        return refuse(withAttemptLogs(project, attemptLogs), "RT_E_BUDGET_EXHAUSTED", repairStop.error ?? "session token budget exhausted during a repair re-prompt");
      }
      if (repair.ok) {
        const repaired = parseSynthesisEnvelope(repair.text, readSink);
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
    // FM-03 (W37 Y1): metered like every bounded repair call.
    const repairStop = accountRepairUsage(repair);
    if (repairStop) {
      return refuse(withAttemptLogs(project, attemptLogs), "RT_E_BUDGET_EXHAUSTED", repairStop.error ?? "session token budget exhausted during a repair re-prompt");
    }
    if (repair.ok) {
      const repaired = parseSynthesisEnvelope(repair.text, readSink);
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
  // W52/339-2: bind the machine oracle's contract to the module's MEASURED
  // export surface (not the plan's signature list) so its generated cases are
  // grounded in names the module really binds.
  const outcome = await verify(envelope.module, brief, {
    maxIterations: 3,
    signatureNames: oracleContractNames(envelope.module, envelope.exports),
  });
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
  // T5.4: the SERVED model id from the primary synthesis LlmResult (never the
  // requested P6_SYNTH_MODEL constant) rides into the artifact provenance.
  const up = upgraded(withAttemptLogs(project, attemptLogs), finalModule, outcome, specRecord, res.model);
  // FM-01 (W37 Y1): materialize at SYNTHESIS time — the same seam the chunked
  // path uses (:3183). Before this the verified single module was recorded as
  // RAW CommonJS, and only the emit-time residue guard (headless.ts
  // materializeEmitTree) rewrote it for the `"type":"module"` tenant — so any
  // consumer that read generatedTree/generatedSource WITHOUT emitting
  // (inspect/packet/tree-run on a non-emitted project/a new driver) got bytes
  // that die at import. The recorded shape now equals the chunked path's: an
  // ESM barrel at TREE_ENTRY_PATH + the module relocated to
  // TREE_CHUNK0_RELOCATED_PATH with its CJS assigns stripped (module.exports
  // is what p6SynthesisSystemPrompt still mandates from the MODEL; the harness
  // rewrites it, never the prompt). generatedSource is the barrel entry's own
  // bytes. The emit-time guard stays as the backstop — now a no-op over this
  // tree. The machine-verified artifact (codeArtifact body, verify record,
  // lastTest evidenceHash) keeps describing the verified CJS module itself.
  const materialized = materializeImportableTree([
    { path: TREE_ENTRY_PATH, source: finalModule, exports: envelope.exports, reqTrace: envelope.reqTrace },
  ]);
  // fixes/341-1: the same PRE-SEAL self-typecheck the chunked path applies.
  // The single-module path is the library/service product lane; its
  // machine-run harness compiles with `new Function` (JS-only), so a stripped
  // type error (TS2749/TS2440 class) never fails it. A red declared
  // `typecheck` here refuses the seal outright (the machine-verified `up` is
  // discarded) — the bounded re-synthesis loop lives at the caller
  // (headless's P6 journey), which re-runs this path with the refusal context.
  const skipTypecheckLogs: JsonLog[] = [];
  if (typecheck !== null) {
    const verdict = await runTreeSelfTypecheck(project, materialized, typecheck);
    if (verdict.run === "fail") {
      return refuse(
        withAttemptLogs(project, attemptLogs),
        "RT_E_VALIDATION",
        `the emitted module fails its OWN declared \`typecheck\` — refusing to seal a machine-run-green but type-red artifact: ${verdict.detail ?? "no detail"}`,
      );
    }
    if (verdict.run === "skip") {
      skipTypecheckLogs.push({
        ts: Date.now(),
        phase: 6 as PhaseId,
        level: "warn",
        event: "p6.tree.typecheck.skipped",
        detail: `chunk 1/1 · ${verdict.detail ?? "declared typecheck not executed (unverified, not a pass)"}`,
      });
    }
  }
  return {
    ...up,
    ...(skipTypecheckLogs.length > 0 ? { logs: [...(up.logs ?? []), ...skipTypecheckLogs].slice(-200) } : {}),
    generatedSource: materialized.entrySource,
    generatedTree: materialized.files.map((f) => toGeneratedTreeFile(f.path, f.source)),
  };
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
  gateRepair?: string,
  /** fixes/328 F1 (Ledger): the previous cycle's refusal context — appended to
   *  EVERY chunk's PRIMARY prompt (withSynthesisRefusalContext); absent ⇒
   *  legacy bytes. */
  synthesisRefusal?: string,
  /** T4 (112 §4.4 / 216g): the caller's resolved cross-project proven rows,
   *  ranked with the memory lessons on every chunk; absent/empty ⇒ legacy. */
  proven?: readonly RankableLessonRow[],
  /** fixes/341-1: the PRE-SEAL self-typecheck gate (null ⇒ legacy, no gate).
   *  A red verdict gets ONE bounded repair round over the compiler-named chunks
   *  (re-synthesized with the compiler's tail as tree-failure context) and, if
   *  still red, an honest partial refusal — never a sealed red tree. */
  typecheck: P6TreeTypecheck | null = null,
  /** fixes/343-1: opt-in best-of-N sample count for the compiler-named chunks
   *  (1 ⇒ legacy single re-synthesis, byte-identical). */
  candidates = 1,
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
  // T5.4: the SERVED model id of the first accepted chunk's primary synthesis
  // call — every chunk of one tree uses the same opts/model resolution, so the
  // first served id is the tree's served id. Null until a chunk is accepted
  // (⇒ no artifact stamp, fail closed).
  let servedModel: string | null = null;
  // W52/338-1: the SPEC-DRIVEN coverage rule — reconcile the model's emitted
  // signatures with the deterministic capability floor BEFORE the plan, so every
  // declared spec-graph job maps to a planned file by rule (see
  // reconcilePlanTypeSignatures). No declared job unbound ⇒ `treeSpec` is the
  // same reference and every downstream byte/prompt is unchanged.
  const reconciled = reconcilePlanTypeSignatures(project, specRecord.typeSignatures);
  const treeSpec: NonNullable<Project["implementationSpec"]> =
    reconciled.added.length > 0 ? { ...specRecord, typeSignatures: reconciled.typeSignatures } : specRecord;
  // fixes/216k (105 TA-15, W6-L1 D1/D3): the chunk→file plan + its consumption
  // order are computed here from the project's own spec graph. `plan[i].path`
  // IS the file path (a job node's `src/jobs/<label>.ts` for job-keyed chunks);
  // zero job nodes ⇒ treeChunkPlan's legacy branch ⇒ identical paths, identical
  // per-chunk prompts (pre-216k byte parity). `plan.length` is the honest chunk
  // total: every plan row is exactly one synthesis call.
  const plan = orderTreeChunks(treeChunkPlan(project, treeSpec.typeSignatures));
  // fixes/153 (P1): per-attempt p6.synthesis.attempt journal — the observer
  // closure carries the chunk context so every model call of chunk i reports
  // chunk (i+1)/total + a sequential per-chunk attempt number.
  const attemptLogs: JsonLog[] = [...(project.logs ?? [])];
  // W52/338-1: legible record of what the coverage rule ADDED — the declared
  // jobs no model signature named, now planned from the deterministic floor.
  // Nothing is appended when the model already named every declared job.
  if (reconciled.added.length > 0) {
    const detail = `declared job node(s) no model signature named — planned from the deterministic capability floor: ${reconciled.addedLabels.join(", ")} (+${reconciled.added.length} signature(s) from deriveTypeSignatures)`;
    if (!attemptLogs.some((l) => l.event === "p6.tree.plan.reconciled" && l.detail === detail)) {
      attemptLogs.push({ ts: Date.now(), phase: 6, level: "info", event: "p6.tree.plan.reconciled", detail });
    }
  }
  // W45/331-4: the plan-side shortfall — a declared spec-graph job whose label no
  // typeSignature names gets no chunk and (in tree mode) no emitted file. Count it
  // and persist the row on the project, so it survives into the packet/export
  // instead of vanishing with the scaffold's in-process warnings array. Nothing is
  // appended when every declared job is planned (byte-identity for the pipelines).
  {
    const census = treeChunkPlanCensus(project, treeSpec.typeSignatures);
    if (census.unbound.length > 0) {
      // W46/332-1 (P2): the full partition rides the row, so the coverage
      // shortfall is legible (and deterministic) instead of a bare name list.
      const detail = `declared job node(s) with no bound signature — no src/jobs module will be synthesized: ${census.unbound.join(", ")} (declared ${census.declared.length}, planned ${census.planned.length}, unbound ${census.unbound.length}; their typeSignatures, if any, stay in the src/generated family)`;
      if (!attemptLogs.some((l) => l.event === "p6.tree.shortfall" && l.detail === detail)) {
        attemptLogs.push({ ts: Date.now(), phase: 6, level: "warn", event: "p6.tree.shortfall", detail });
      }
    }
  }

  // fixes/343-1 follow-up (343-2): the persisted tree's ranked outline, built
  // once and appended to every PRIMARY chunk prompt. Tree-only input so the
  // keyless floor's placeholder `generatedSource` can never masquerade as the
  // tree being extended; no tree ⇒ `rendered === ""` ⇒ no block (legacy bytes).
  const repoMap = repoMapForProject(
    { generatedTree: Array.isArray(project.generatedTree) ? project.generatedTree : null },
    { budget: P6_SYNTH_REPO_MAP_BUDGET },
  ).rendered;

  for (let i = 0; i < plan.length; i++) {
    const chunk = plan[i]!;
    const lessonLines = lessonLinesForBrief(
      brief,
      selectLessons(project.memory ?? [], 6, EXPAND_LESSON_RANK_LIMIT),
      { limit: EXPAND_LESSON_RANK_LIMIT, proven },
    );
    // R10-f01 (W39 Z2): the same project-level contract block on every chunk.
    // W52/338-1: `treeSpec` carries the reconciled (spec-driven) signature set.
    const user = withRepoMapContext(
      withTreeFailureContext(
        withSynthesisRefusalContext(
          withGateRepairContext(p6SynthesisChunkUserPrompt(brief, treeSpec, chunk.signatures, prior, lessonLines, project.contracts), gateRepair),
          synthesisRefusal,
        ),
        treeFailure,
      ),
      repoMap,
    );
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
      // 217k (W12 LANE B · G6): the unreadable-reply sink for this chunk's
      // envelope reads — the reply belongs to the planned file's path.
      (failure) => pushAttemptLog(attemptLogs, envelopeReadLogEntry(failure, chunk.path)),
      // W45/331-4 (Finding B): the earlier chunks of this tree. The materializer
      // imports their exports into this file, so a redeclaration is refused by the
      // validator and gets the bounded duplicate-declaration repair below.
      prior,
    );
    if (!synth.ok) {
      return partialTreeRefuse(
        withAttemptLogs(project, attemptLogs),
        accepted,
        i,
        plan.length,
        synth.code,
        synth.error,
        servedModel,
      );
    }
    // D1/D3: consume the plan row's path directly (no treePathForChunk for a
    // planned chunk — the plan already de-duped every path, job siblings
    // included via jobSiblingPath).
    const path = chunk.path;
    accepted.push({ path, source: synth.envelope.module, exports: [...synth.envelope.exports], reqTrace: { ...synth.envelope.reqTrace } });
    if (servedModel === null) servedModel = synth.servedModel;
    prior.push({
      path,
      exports: [...synth.envelope.exports],
      reqTrace: { ...synth.envelope.reqTrace },
      // W46/332-1 (P1): a later chunk must `await` this file's async exports —
      // the validator and prompt both read this mark.
      asyncExports: asyncExportNames(synth.envelope.module, synth.envelope.exports),
    });
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
      servedModel,
    );
  }
  let materialized = materializeImportableTree(accepted);
  // fixes/341-1: the PRE-SEAL self-typecheck gate — the measured defect was a
  // keyed cli-tool tree sealed while failing its OWN declared `typecheck`
  // (TS2749/TS2440, compile.failed=0, oracle+entry pass). A red verdict gets
  // ONE bounded repair round over the compiler-named chunks; still red (or no
  // chunk maps to the named file) ⇒ an honest partial refusal, never a seal.
  if (typecheck !== null) {
    const first = await runTreeSelfTypecheck(project, materialized, typecheck);
    if (first.run === "fail") {
      const offenders = typecheckOffenderIndices(first, accepted);
      const context = typecheckRepairContext(first);
      const tc = typecheck;
      let repairedAny = false;
      // fixes/343-1: opt-in best-of-N over the compiler-named chunks. With the
      // default (1) the block below collapses to the legacy single re-synthesis.
      // With >1, an offender chunk is resampled up to `candidates` times with
      // the SAME compiler-informed prompt (the tsc tail is the context, so the
      // samples are strictly better-informed than a fresh primary prompt) and
      // the first sample whose substituted assembled tree clears the REAL tsc
      // is kept. Candidate 1 is probed first, so no resample happens when the
      // existing single sample already clears the gate (Pareto on spend). Only
      // when no sample clears the tree's tsc does candidate 1 stand and the
      // existing second gate decide — selection is never worse than today.
      for (const i of offenders) {
        const chunk = plan[i]!;
        const priorForI = accepted.slice(0, i).map((f) => ({
          path: f.path,
          exports: [...f.exports],
          reqTrace: { ...f.reqTrace },
          asyncExports: asyncExportNames(f.source, f.exports),
        }));
        const repairLessons = lessonLinesForBrief(
          brief,
          selectLessons(project.memory ?? [], 6, EXPAND_LESSON_RANK_LIMIT),
          { limit: EXPAND_LESSON_RANK_LIMIT, proven },
        );
        const repairUser = withTreeFailureContext(
          withSynthesisRefusalContext(
            withGateRepairContext(
              p6SynthesisChunkUserPrompt(brief, treeSpec, chunk.signatures, priorForI, repairLessons, project.contracts),
              gateRepair,
            ),
            synthesisRefusal,
          ),
          context,
        );
        const repairPatch: PatchRepairOptions | undefined = patchRepairs
          ? { path: chunk.path, log: (entry) => pushAttemptLog(attemptLogs, entry) }
          : undefined;
        const produceChunk = () =>
          synthesizeChunkEnvelope(
            complete,
            repairUser,
            opts,
            signatureFunctionNames(chunk.signatures),
            context,
            repairPatch,
            (attempt, res) =>
              pushAttemptLog(
                attemptLogs,
                synthAttemptLogEntry({ chunkIndex: i, chunkTotal: plan.length, attempt, timeoutMs: opts.timeoutMs ?? P6_SYNTH_TIMEOUT_MS, res }),
              ),
            (failure) => pushAttemptLog(attemptLogs, envelopeReadLogEntry(failure, chunk.path)),
            priorForI,
          );
        let repaired = await produceChunk();
        if (candidates > 1) {
          const outcomes: string[] = [];
          let winner: number | null = null;
          if (repaired.ok) {
            const fallback = repaired;
            const substitute = (c: typeof fallback) => {
              const probe = accepted.slice();
              probe[i] = {
                path: chunk.path,
                source: c.envelope.module,
                exports: [...c.envelope.exports],
                reqTrace: { ...c.envelope.reqTrace },
              };
              return probe;
            };
            const v0 = await runTreeSelfTypecheck(project, materializeImportableTree(substitute(fallback)), tc);
            if (v0.run !== "fail") {
              winner = 0;
              outcomes.push(`candidate 1: selected — ${v0.run === "pass" ? "pre-seal typecheck" : "typecheck skipped"}`);
            } else {
              outcomes.push(`candidate 1: rejected — tsc refused (${String(v0.detail ?? "").replace(/\s+/g, " ").slice(0, 160)})`);
              for (let k = 1; k < candidates; k++) {
                const candidate = await produceChunk();
                if (!candidate.ok) {
                  outcomes.push(`candidate ${k + 1}: rejected — structure refused (${candidate.code}: ${candidate.error})`);
                  continue;
                }
                const v = await runTreeSelfTypecheck(project, materializeImportableTree(substitute(candidate)), tc);
                if (v.run === "fail") {
                  outcomes.push(`candidate ${k + 1}: rejected — tsc refused (${String(v.detail ?? "").replace(/\s+/g, " ").slice(0, 160)})`);
                  continue;
                }
                repaired = candidate;
                winner = k;
                outcomes.push(`candidate ${k + 1}: selected — ${v.run === "pass" ? "pre-seal typecheck" : "typecheck skipped"}`);
                break;
              }
              if (winner === null) {
                repaired = fallback;
                outcomes.push("kept candidate 1 — no resample cleared the tree's tsc");
              }
            }
          } else {
            outcomes.push(`candidate 1: rejected — structure refused (${repaired.code}: ${repaired.error})`);
          }
          pushAttemptLog(attemptLogs, {
            ts: Date.now(),
            phase: 6 as PhaseId,
            level: "info",
            event: "p6.synthesis.candidates",
            detail: candidatesLogDetail(`chunk ${i + 1}/${plan.length}`, candidates, winner, outcomes),
          });
        }
        if (!repaired.ok) {
          return partialTreeRefuse(
            withAttemptLogs(project, attemptLogs),
            accepted,
            i,
            plan.length,
            "RT_E_VALIDATION",
            `emitted tree fails its OWN declared \`typecheck\` and the bounded repair of chunk ${i + 1}/${plan.length} did not land (${repaired.code}: ${repaired.error}) — ${first.detail ?? ""}`,
            servedModel,
          );
        }
        accepted[i] = {
          path: chunk.path,
          source: repaired.envelope.module,
          exports: [...repaired.envelope.exports],
          reqTrace: { ...repaired.envelope.reqTrace },
        };
        if (servedModel === null) servedModel = repaired.servedModel;
        repairedAny = true;
      }
      if (repairedAny) {
        materialized = materializeImportableTree(accepted);
        const second = await runTreeSelfTypecheck(project, materialized, typecheck);
        if (second.run === "fail") {
          return partialTreeRefuse(
            withAttemptLogs(project, attemptLogs),
            accepted,
            -1,
            plan.length,
            "RT_E_VALIDATION",
            `emitted tree still fails its OWN declared \`typecheck\` after one bounded repair round — ${second.detail ?? ""}`,
            servedModel,
          );
        }
      } else {
        return partialTreeRefuse(
          withAttemptLogs(project, attemptLogs),
          accepted,
          -1,
          plan.length,
          "RT_E_VALIDATION",
          `emitted tree fails its OWN declared \`typecheck\` but no synthesized chunk maps to the compiler-named file(s) — ${first.detail ?? ""}`,
          servedModel,
        );
      }
    } else if (first.run === "skip") {
      pushAttemptLog(attemptLogs, {
        ts: Date.now(),
        phase: 6 as PhaseId,
        level: "warn",
        event: "p6.tree.typecheck.skipped",
        detail: `tree ${plan.length}/${plan.length} chunks · ${first.detail ?? "declared typecheck not executed (unverified, not a pass)"}`,
      });
    }
  }
  return treeUpgraded(
    withAttemptLogs(project, attemptLogs),
    treeSpec,
    materialized.files,
    materialized.entrySource,
    accepted.length,
    servedModel,
  );
}

/**
 * One chunk's synthesis: synthWithBackoff + the bounded repair classes the
 * legacy single-module path uses (envelope-parse repair ×1; export-binding /
 * soft-forbidden / missing-signature repair ×1; deterministic export
 * injection last-mile). Returns the accepted envelope (+ T5.4: the SERVED
 * model id of this chunk's primary synthesis call, for the tree artifact's
 * provenance) or the coded failure — brief-fit is deliberately NOT a per-chunk
 * gate (tree-level fit runs on the assembled entry; nouns spread across files).
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
  /** 217k (W12 LANE B · G6): the unreadable-reply sink for this chunk's
   *  envelope reads (the caller knows the planned file path); absent keeps the
   *  legacy no-op. */
  readSink?: EnvelopeReadSink,
  /** W45/331-4 (Finding B): the earlier chunks of THIS tree (path + exports). The
   *  module must not redeclare any of their exported names — the materializer imports
   *  them. W46/332-1 (P1): an `asyncExports` mark lets the validator refuse an
   *  un-awaited async sibling call used as a value. Absent ⇒ the legacy validation
   *  (single-module path), byte-identical. */
  priorChunks?: readonly { path: string; exports: readonly string[]; asyncExports?: readonly string[] }[],
): Promise<{ ok: true; envelope: SynthesisEnvelope; servedModel: string } | { ok: false; code: ErrorCode; error: string }> {
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
  let envelope = parseSynthesisEnvelope(res.text, readSink);
  if (envelope === null) {
    const repair = await completeCall(p6SynthesisRepairPrompt(treeFailure), opts);
    // FM-03 (W37 Y1): metered like every bounded repair call.
    const repairStop = accountRepairUsage(repair);
    if (repairStop) {
      return { ok: false, code: "RT_E_BUDGET_EXHAUSTED", error: repairStop.error ?? "session token budget exhausted during a repair re-prompt" };
    }
    if (repair.ok) envelope = parseSynthesisEnvelope(repair.text, readSink);
  }
  if (envelope === null) {
    return { ok: false, code: "RT_E_LLM_REJECTED", error: "model returned an unparseable synthesis envelope after one repair attempt" };
  }
  let validation = validateSynthesisModule(envelope.module, envelope.exports, signatureNames, priorChunks);
  if (!validation.ok) {
    const masked = maskLiteralsAndComments(envelope.module);
    const hit = forbiddenPrimitiveHit(masked);
    const unbound = unboundExportNames(envelope.module, envelope.exports);
    const repairableForbidden = hit.soft !== null && hit.hard === null;
    const missingSig = missingSignatureNames(envelope.exports, signatureNames);
    // W45/331-4 (Finding B): the cross-chunk duplicate-declaration class.
    const dup = crossChunkDuplicateDeclarations(envelope.module, priorChunks);
    // W46/332-1 (P1): the un-awaited-async-value class (a sibling's async export
    // used without `await`), the same detector the validator applies.
    const asyncUses = unawaitedAsyncValueUses(envelope.module, asyncNamesInScope(envelope.module, priorChunks));
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
          validation = validateSynthesisModule(envelope.module, envelope.exports, signatureNames, priorChunks);
          patchLanded = validation.ok;
        }
      }
    }
    if (
      !patchLanded &&
      (unbound.length > 0 || repairableForbidden || missingSig.length > 0 || nondet !== null || prose.length > 0 || dup.length > 0 || asyncUses.length > 0)
    ) {
      const repairPrompt = unbound.length > 0
        ? p6SynthesisExportRepairPrompt(unbound, treeFailure)
        : repairableForbidden
          ? p6SynthesisForbiddenRepairPrompt(hit.soft ?? "unknown", treeFailure)
          : missingSig.length > 0
            ? p6SynthesisSignatureRepairPrompt(missingSig, treeFailure)
            : nondet !== null
              ? p6SynthesisNondeterministicRepairPrompt(nondet, treeFailure)
              : prose.length > 0
                ? p6SynthesisProseRepairPrompt(prose, treeFailure)
                : dup.length > 0
                  ? p6SynthesisDuplicateDeclRepairPrompt(dup, treeFailure)
                  : p6SynthesisAsyncAwaitRepairPrompt(asyncUses, treeFailure);
      const repair = await completeCall(repairPrompt, opts);
      // FM-03 (W37 Y1): metered like every bounded repair call.
      const repairStop = accountRepairUsage(repair);
      if (repairStop) {
        return { ok: false, code: "RT_E_BUDGET_EXHAUSTED", error: repairStop.error ?? "session token budget exhausted during a repair re-prompt" };
      }
      if (repair.ok) {
        const repaired = parseSynthesisEnvelope(repair.text, readSink);
        if (repaired) {
          envelope = repaired;
          validation = validateSynthesisModule(envelope.module, envelope.exports, signatureNames, priorChunks);
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
  // T5.4: the SERVED model id (the provider's own LlmResult.model) rides back
  // to the caller for the tree artifact's provenance stamp.
  return { ok: true, envelope, servedModel: res.model };
}

/**
 * fixes/144 (M2): honest partial refusal for the chunked path. Prior chunks'
 * accepted files stay REAL on the returned project (generatedTree +
 * generatedSource = the assembled partial entry; modelRoute derives from the
 * SERVED model of the first accepted chunk — FM-04), and a p6.synthesis.refused
 * warn log records the refused chunk index (chunkIndex -1 = all chunks
 * accepted but the tree-level brief-fit gate failed). When chunk 0 itself
 * refuses nothing real exists — the deterministic floor stands untouched.
 * Never a fabricated full pass.
 */
function partialTreeRefuse(
  project: Project,
  accepted: { path: string; source: string; exports?: readonly string[]; reqTrace?: Readonly<Record<string, string>> }[],
  chunkIndex: number,
  chunkTotal: number,
  code: ErrorCode,
  detail: string,
  /** FM-04 (W37 Y1): the SERVED model id of the first accepted chunk (null
   *  when chunk 0 itself refused) — the route label derives from it. */
  servedModel: string | null = null,
): Project {
  const materialized = accepted.length > 0 ? materializeImportableTree(accepted) : null;
  const base: Project =
    materialized !== null
      ? {
          ...project,
          generatedTree: materialized.files.map((f) => toGeneratedTreeFile(f.path, f.source)),
          generatedSource: materialized.entrySource,
          // FM-04 (W37 Y1): the SERVED route of the first accepted chunk.
          modelRoute: modelRouteForServed(servedModel),
          // 216 (T-06 / F-02) + W-05 (W29 · R9-f02): the partial tree REPLACED
          // the artifact the floor's `tests.pass` stamp describes, so carrying
          // that stamp forward let `p6-test` (dod.ts probe) read green for
          // untested code. Invalidate EXACTLY as treeUpgraded does; the only
          // re-mint path stays mintTreeRunTested() after a green tree-run.
          lastTest: null,
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
  /** T5.4: the id the provider actually served for this tree's chunk
   *  syntheses (the first accepted chunk's `LlmResult.model`). Null ⇒ no
   *  stamp — fail closed. */
  servedModel: string | null = null,
): Project {
  const treeFiles = accepted.map((f) => toGeneratedTreeFile(f.path, f.source));
  const chunks = typeof chunkCount === "number" && chunkCount > 0 ? chunkCount : accepted.length;
  const manifest = treeFiles
    .map((f) => `// ${f.path} · fnv1a ${f.hash} · ${f.source.split("\n").length} lines · attempt ${f.attempt}`)
    .join("\n");
  const evidenceHash = String(fnv1a(entry));
  // T5.4: the tree artifact's stamp — the SERVED model id + the synthesis
  // input hash (the persisted brief hash); absent when the served id is
  // unusable (never a guessed producer).
  const prov = modelProvenance(servedModel, specRecord.briefHash);
  const codeArtifact: StampedArtifact = {
    id: `6-code-tree-${evidenceHash.slice(0, 8)}`,
    phase: 6,
    kind: "code",
    title: `Generated source tree (LLM — ${treeFiles.length} files, chunked synthesis)`,
    body: `${manifest}\n\n${entry}`,
    language: "javascript",
    ...(prov ? { provenance: prov } : {}),
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
    // FM-04 (W37 Y1): derived from the SERVED id of the first accepted chunk.
    modelRoute: modelRouteForServed(servedModel),
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
 *  gate: at least one spec file actually ran AND executed ≥1 assertion.
 *
 *  W48/334-1c: the DECLARED-SCRIPT state is decisive evidence too — a green run
 *  whose emitted `package.json` scripts (`typecheck`/`build`) never executed
 *  must not mint the same evidence as one whose toolchain really ran (the F-4
 *  lesson one level deeper: an evidence hash must not conflate a state the
 *  system takes care to distinguish). Folds booleans + a SORTED name list only
 *  (never prose), the same doctrine as `treeVerdictHash`; a default run
 *  (`declaredScriptsVerified:true`, entry ran) keeps its prior bytes. */
export function treeRunTestedEvidence(o: TreeRunOutcome): {
  executed: boolean;
  specFiles: number;
  assertions: number;
  summary: string;
} {
  const specs = (Array.isArray(o.tests) ? o.tests : []).filter((t) => t.run === "pass");
  const assertions = specs.reduce((n, t) => n + (t.tests?.pass ?? 0), 0);
  // F3-16 (fixes/294 N2): identify WHICH specs passed — counts alone let two
  // different trees (equal compile/spec/assertion numbers) mint the identical
  // evidence hash. Sorted rel spec paths restore the "rel spec paths" the doc
  // above promises; deterministic + host-independent (never the run dir,
  // timings or detail prose), so the hash still reproduces across hosts.
  const specPaths = specs
    .map((t) => t.file)
    .filter((f): f is string => typeof f === "string" && f.length > 0)
    .sort();
  // Canonical declared-script factors (booleans + a sorted name list). The
  // token is emitted only when the state deviates from fully-declared-verified
  // with the entry actually run, so a default outcome is byte-identical.
  const unverifiedScripts = [
    ...new Set((o.unverifiedDeclaredScripts ?? []).filter((s): s is string => typeof s === "string" && s.length > 0)),
  ].sort();
  const declaredUnverified = o.declaredScriptsVerified === false || unverifiedScripts.length > 0;
  const entrySkipped = o.unverifiedEntry !== undefined;
  const run = o.run;
  const summary = [
    `compile ${o.compile.passed}/${o.compile.checked} file(s)`,
    `${specs.length} spec file(s) pass · ${assertions} assertion(s)`,
    ...(specPaths.length > 0 ? [`specs [${specPaths.join(", ")}]`] : []),
    ...(run ? [`entry ${run.kind} ${run.run}`] : []),
    ...(declaredUnverified
      ? [`declared-scripts unverified${unverifiedScripts.length > 0 ? ` [${unverifiedScripts.join(", ")}]` : ""}`]
      : []),
    ...(entrySkipped ? ["entry-skipped"] : []),
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
 *    verifyAndFixServer path, OR an earlier tree-run mint) is compared by its
 *    recorded `evidenceHash`: the SAME verdict keeps the stamp unchanged
 *    (`p6.tree.tested.unchanged` says so, no rewrite); a DIFFERENT verdict
 *    refreshes the stamp from THIS tree-run (`p6.tree.tested.refreshed`, both
 *    hashes named) so the record never carries a hash that describes a
 *    different verification state (fixes/336 · 336-2);
 *  - an ok tree-run that executed NO specs (UI-shell/webapp tree without
 *    executable specs, or a no-spec headless tree) is NOT minted — the honest
 *    current state stands and a coded `p6.tree.tested.skipped` warn log
 *    explains why, so a later reader never mistakes the absence for a pass.
 */
export function mintTreeRunTested(project: Project, outcome: TreeRunOutcome): Project {
  if (!outcome || outcome.ok !== true) return project;
  const current = project.lastTest as { label?: string; evidenceHash?: string } | null | undefined;
  const alreadyTested = current?.label === "tested";
  const ev = treeRunTestedEvidence(outcome);
  const logs = project.logs ?? [];
  if (!ev.executed) {
    // No fresh evidence to compare or mint; an existing stamp is left exactly
    // as it stands (a run that executed nothing has nothing to say about it).
    if (alreadyTested) return project;
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
  if (alreadyTested) {
    // 336-2 follow-up: an already-"tested" project must not keep an evidence
    // hash that describes a DIFFERENT verification (the same two-artifacts-
    // disagree class as the stale packet). Same verdict ⇒ the stamp already
    // describes this tree-run: keep it, say so, do not rewrite. Different ⇒
    // the record must not keep a stale hash — refresh from THIS verdict.
    if (typeof current?.evidenceHash === "string" && current.evidenceHash === evidenceHash) {
      return {
        ...project,
        logs: [
          ...logs,
          {
            ts: Date.now(),
            phase: 6 as PhaseId,
            level: "info" as const,
            event: "p6.tree.tested.unchanged",
            detail: `tested stamp already describes this tree-run · fnv1a ${evidenceHash.slice(0, 8)} — kept (no rewrite)`,
          },
        ].slice(-200),
      };
    }
    const prior =
      typeof current?.evidenceHash === "string" && current.evidenceHash.length > 0
        ? current.evidenceHash.slice(0, 8)
        : "(none)";
    return {
      ...project,
      lastTest: testedLastTestStamp(`tree-run green: ${ev.summary}`, evidenceHash),
      logs: [
        ...logs,
        {
          ts: Date.now(),
          phase: 6 as PhaseId,
          level: "warn" as const,
          event: "p6.tree.tested.refreshed",
          detail: `tested stamp refreshed — recorded evidence ${prior} did not describe this tree-run · fnv1a ${evidenceHash.slice(0, 8)}`,
        },
      ].slice(-200),
    };
  }
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
