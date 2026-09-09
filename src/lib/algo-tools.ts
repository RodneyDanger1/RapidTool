// ---------------------------------------------------------------------------
// algo-tools.ts — algorithm workbench (register G-27/G-28/G-29, wave 3).
//
// Pure, deterministic helpers for the algorithm lane of the agent surface.
// Zero NEW dependencies (no fast-check, no ts-morph, no graph tooling) —
// everything below is hand-rolled, mirroring the feasibility corrections in
// research/multiagent/15_feasibility_review.md (G-28/G-29/G-30/G-31).
//
// Two shapes of function:
//
//   STATIC (pure, keyless, deterministic — safe to call anywhere):
//     complexityOf(source)   — honest LOOP-SHAPE complexity heuristic
//                              (O(1)/O(log n)/O(n)/O(n log n)/O(n^2)/O(n^3)).
//                              A heuristic, never a proof: recursion,
//                              callbacks and stdlib calls are NOT modeled.
//     benchmarkHarness(...)  — node:test-based benchmark FILE BODY (string),
//                              embedding the source verbatim + a deterministic
//                              PRNG so re-runs are comparable.
//
//   KEYED (DeepSeek flash via completeDeepSeek json:true; honest
//     {ok:false, reason:"not-configured"} when DEEPSEEK_API_KEY is absent —
//     same honesty floor as verify.server.ts generateCases()):
//     specToAlgorithm(...)   — spec + brief -> structured
//                              {name, steps, complexity, edgeCases}.
//     propertyTestsFor(...)  — source + brief -> property-STYLE cases in the
//                              verify.server.ts VerifyCase shape
//                              ({id, expression}); parsed by the shared
//                              parseOracleJson, so the case contract is the
//                              same parser the verify lane runs.
//
// No function here writes files or fabricates model output.
// ---------------------------------------------------------------------------
import { completeDeepSeek, isDeepSeekConfigured } from "./deepseek.server.ts";
import { parseOracleJson } from "./verify.server.ts";
import type { VerifyCase } from "./verify.server.ts";
import type { ErrorCode } from "./errors.ts";

// ---------------------------------------------------------------------------
// Structured spec -> algorithm synthesis (G-27 keyed half)
// ---------------------------------------------------------------------------

export type AlgoSpec = {
  /** kebab-case machine name, e.g. "deadline-schedule". */
  name: string;
  /** Ordered implementation steps (imperative, concrete). */
  steps: string[];
  /** Big-O claim with a one-line justification, e.g. "O(n log n) — sort dominates". */
  complexity: string;
  /** Edge cases the implementation must handle. */
  edgeCases: string[];
};

export type AlgoSpecResult =
  | { ok: true; algorithm: AlgoSpec }
  | {
      ok: false;
      reason: "not-configured" | "error";
      error?: string;
      /** Machine-readable failure class (errors.ts) — ALWAYS present on
       *  failure (99 §6: no bare ok:false envelopes). */
      code: ErrorCode;
    };

/** Parse a DeepSeek JSON reply into an AlgoSpec. Tolerant of fences. Pure. */
export function parseAlgorithmSpecJson(text: string): AlgoSpec | null {
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
  const name = typeof rec.name === "string" ? rec.name.trim() : "";
  const complexity = typeof rec.complexity === "string" ? rec.complexity.trim() : "";
  if (!name || !complexity) return null;
  const steps = Array.isArray(rec.steps)
    ? rec.steps.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter(Boolean)
    : [];
  if (steps.length === 0) return null;
  const edgeCases = Array.isArray(rec.edgeCases)
    ? rec.edgeCases.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter(Boolean)
    : [];
  return { name, steps, complexity, edgeCases };
}

const ALGO_SPEC_PROMPT = (spec: string, brief: string): string =>
  [
    "Design ONE algorithm implementation from the spec and brief below. Return JSON ONLY:",
    '{"name": "<kebab-case machine name>", "steps": ["<step 1>", ...], "complexity": "<Big-O claim + one-line why>", "edgeCases": ["<edge case>", ...]}.',
    "steps: 3-8 ordered, concrete implementation steps (no frameworks, no libraries).",
    "complexity: one line, e.g. \"O(n log n) — dominated by the deadline sort\".",
    "edgeCases: 2-5 inputs the implementation must handle (empty input, ties, extremes).",
    "STRICT honesty: derive EVERYTHING from the spec and brief. Do not invent requirements,",
    "APIs, or behaviors neither mentions. If the job is not a real computational task, say so",
    "in complexity with \"not an algorithm job\" and give minimal steps.",
    `Spec: ${spec.slice(0, 2000)}`,
    `Brief: ${brief.slice(0, 800)}`,
  ].join("\n");

export async function specToAlgorithm(spec: string, brief: string): Promise<AlgoSpecResult> {
  if (!isDeepSeekConfigured()) {
    return { ok: false, reason: "not-configured", code: "RT_E_LLM_NOT_CONFIGURED" };
  }
  if (!spec.trim() || !brief.trim()) {
    return {
      ok: false,
      reason: "error",
      error: "spec and brief must both be non-empty",
      code: "RT_E_VALIDATION",
    };
  }
  const res = await completeDeepSeek(ALGO_SPEC_PROMPT(spec, brief), {
    model: "deepseek-v4-flash",
    json: true,
  });
  if (!res.ok) {
    return res.reason === "not-configured"
      ? { ok: false, reason: "not-configured", code: "RT_E_LLM_NOT_CONFIGURED" }
      : { ok: false, reason: "error", error: res.error, code: res.code ?? "RT_E_INTERNAL" };
  }
  const algorithm = parseAlgorithmSpecJson(res.text);
  if (algorithm === null) {
    return {
      ok: false,
      reason: "error",
      error: "model returned an unparseable algorithm payload",
      code: "RT_E_VALIDATION",
    };
  }
  return { ok: true, algorithm };
}

// ---------------------------------------------------------------------------
// Property-style test cases (G-28 keyed half)
//
// fast-check itself is NOT injected (feasibility review: the bounded-runner
// child has no node_modules to resolve it from). Instead the LLM emits
// property-STYLE invariants as single self-contained boolean expressions —
// the exact VerifyCase shape the existing harness evaluates with
// `with (exports)` — so sort-permutation/idempotence-class properties run on
// today's machine runner with zero new deps. Sample inputs are fixed inside
// the expression; nothing is random and nothing is unbounded.
// ---------------------------------------------------------------------------

export type PropertyCasesResult =
  | { ok: true; cases: VerifyCase[] }
  | {
      ok: false;
      reason: "not-configured" | "error";
      error?: string;
      /** Machine-readable failure class (errors.ts) — ALWAYS present on
       *  failure (99 §6: no bare ok:false envelopes). */
      code: ErrorCode;
    };

/**
 * Export-name inventory of a module source, for the property-case prompt.
 *
 * Detection is comment/string/template/regex-aware: the source is masked
 * through maskNonCode FIRST so prose that merely LOOKS like an export
 * (`// exports.fake = 1`, `"exports.str = 3"`, regex-literal content) can
 * never be reported as a real export — the prompt tells the model "the
 * module exports these names ONLY", so a phantom name would push the model
 * into writing cases that fail at runtime. Covers the ESM declaration forms
 * this codebase emits (function incl. async + generators, class,
 * const/let/var) plus CommonJS `exports.x = …` / `module.exports.x = …`
 * assignments. Member-chain lookalikes (`obj.exports.x = …`) are excluded —
 * they are object properties, not module exports. Deterministic, sorted.
 */
export function exportedNamesOf(source: string): string[] {
  if (typeof source !== "string") return [];
  const masked = maskNonCode(source);
  const names = new Set<string>();
  // CJS: statement-position `exports.x =` / `module.exports.x =`. The char
  // before `exports` must NOT be an identifier char, `$` or `.` (a `.`
  // means `exports` is a property of some other object, except the
  // explicitly allowed `module.exports.` spelling).
  const cjs = /(^|[^A-Za-z0-9_$.]|module\.)exports\.([A-Za-z_$][\w$]*)\s*=/g;
  let m: RegExpExecArray | null;
  while ((m = cjs.exec(masked)) !== null) names.add(m[2]);
  // ESM declarations: function (incl. `async` and `function*` generators),
  // class, const/let/var. `export default` has no hoisted name to inventory.
  const esm =
    /\bexport\s+(?:async\s+)?(?:function(?:\s*\*\s*|\s+)|class\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/g;
  while ((m = esm.exec(masked)) !== null) names.add(m[1]);
  const list = [...names];
  list.sort();
  return list;
}

const PROPERTY_CASES_PROMPT = (source: string, brief: string, exportsList: string[]): string =>
  [
    "Write PROPERTY-style verification cases for the source module below. Return JSON ONLY:",
    '{"cases": [{"id": "<kebab-case id>", "expression": "<one boolean JS expression>"}]}.',
    "A property case asserts an INVARIANT over sample inputs rather than one hand-picked",
    "example: idempotence (running twice equals once), permutation (output keeps every input",
    "element), ordering, round-trips, commutativity — properties the brief implies.",
    "The harness evaluates each expression with the module's exported names in scope",
    "(`with (exports)`), like: JSON.stringify(sort(sort([3,1,2]))) === JSON.stringify(sort([3,1,2])).",
    "Rules:",
    "- Each expression must be ONE self-contained boolean; you may use an IIFE",
    "  (() => { ... })() to loop over fixed sample inputs.",
    "- Sample inputs are FIXED literals, capped at 20 elements; no Math.random, no dates,",
    "  no external libraries, no require/import inside the expression.",
    "- Deep equality via JSON.stringify(a) === JSON.stringify(b).",
    `- The module exports these names ONLY — never invent others: ${exportsList.join(", ") || "(none)"}.`,
    "STRICT: test ONLY invariants the brief requires. Do not invent extra requirements.",
    "2-5 cases.",
    `Brief: ${brief.slice(0, 800)}`,
    "Source:",
    source.slice(0, 6000),
  ].join("\n");

export async function propertyTestsFor(
  source: string,
  brief: string,
): Promise<PropertyCasesResult> {
  if (!isDeepSeekConfigured()) {
    return { ok: false, reason: "not-configured", code: "RT_E_LLM_NOT_CONFIGURED" };
  }
  if (!source.trim() || !brief.trim()) {
    return {
      ok: false,
      reason: "error",
      error: "source and brief must both be non-empty",
      code: "RT_E_VALIDATION",
    };
  }
  const exportsList = exportedNamesOf(source);
  const res = await completeDeepSeek(PROPERTY_CASES_PROMPT(source, brief, exportsList), {
    model: "deepseek-v4-flash",
    json: true,
  });
  if (!res.ok) {
    return res.reason === "not-configured"
      ? { ok: false, reason: "not-configured", code: "RT_E_LLM_NOT_CONFIGURED" }
      : { ok: false, reason: "error", error: res.error, code: res.code ?? "RT_E_INTERNAL" };
  }
  // Shared parser with the verify lane: the returned cases ARE VerifyCases.
  const cases = parseOracleJson(res.text);
  if (cases === null) {
    return {
      ok: false,
      reason: "error",
      error: "model returned an unparseable property payload",
      code: "RT_E_VALIDATION",
    };
  }
  return { ok: true, cases };
}

// ---------------------------------------------------------------------------
// complexityOf — static complexity heuristic (G-29 narrow)
//
// Honest by construction: this is a LOOP-SHAPE heuristic over a quote/comment/
// template/regex-aware lexed view of the source, NOT a proof and NOT cyclomatic
// complexity. It reports the notation, loop count, deepest loop nesting, and
// the 1-based lines where loops start so a caller (or human) can check the
// reasoning. Recursion, callbacks (.map/.forEach/.sort) and stdlib calls are
// not modeled; braceless loop bodies may undercount nesting.
// ---------------------------------------------------------------------------

export type ComplexityNotation = "O(1)" | "O(log n)" | "O(n)" | "O(n log n)" | "O(n^2)" | "O(n^3)";

export type ComplexityReport = {
  notation: ComplexityNotation;
  loops: number;
  maxNesting: number;
  halvingLoops: number;
  /** 1-based source lines where loops start (ascending). */
  lineRefs: number[];
  caveat: string;
};

export const COMPLEXITY_CAVEAT =
  "Static loop-shape heuristic — not a proof. Recursion, callbacks and stdlib calls are not modeled; braceless loop bodies may undercount nesting.";

/** Chars after which a `/` starts a regex literal rather than division. */
const REGEX_PRECEDERS = new Set([
  "=", ":", ",", "(", "[", "{", "!", "&", "|", "?", ";", "+", "-", "*", "%", "^", "~", "<", ">", "/",
]);

/**
 * Mask strings/comments/template literals/regex literals with spaces while
 * keeping newlines, so keyword scans stay line-accurate and never fire inside
 * non-code text. Returns a same-length string.
 */
export function maskNonCode(source: string): string {
  if (typeof source !== "string") return "";
  const chars = source.split("");
  const n = chars.length;
  let i = 0;
  let prevCode = ""; // last non-whitespace CODE char seen (drives regex detection)
  let codeBuf = ""; // last few code chars, for `return /re/` style detection
  while (i < n) {
    const c = chars[i];
    const next = i + 1 < n ? chars[i + 1] : "";
    if (c === "/" && next === "/") {
      chars[i] = " ";
      if (i + 1 < n) chars[i + 1] = " ";
      i += 2;
      while (i < n && chars[i] !== "\n") {
        chars[i] = " ";
        i++;
      }
      continue;
    }
    if (c === "/" && next === "*") {
      chars[i] = " ";
      if (i + 1 < n) chars[i + 1] = " ";
      i += 2;
      while (i < n && !(chars[i] === "*" && i + 1 < n && chars[i + 1] === "/")) {
        if (chars[i] !== "\n") chars[i] = " ";
        i++;
      }
      if (i < n) {
        chars[i] = " ";
        if (i + 1 < n) {
          chars[i + 1] = " ";
          i += 2;
        } else i++;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      const q = c;
      chars[i] = " ";
      i++;
      while (i < n) {
        const ch = chars[i];
        if (ch === "\\") {
          chars[i] = " ";
          i++;
          if (i < n) {
            chars[i] = " ";
            i++;
          }
          continue;
        }
        if (ch === q) {
          chars[i] = " ";
          i++;
          break;
        }
        if (ch !== "\n") chars[i] = " ";
        i++;
      }
      continue;
    }
    if (c === "`") {
      chars[i] = " ";
      i++;
      while (i < n) {
        const ch = chars[i];
        if (ch === "\\") {
          chars[i] = " ";
          i++;
          if (i < n) {
            chars[i] = " ";
            i++;
          }
          continue;
        }
        if (ch === "`") {
          chars[i] = " ";
          i++;
          break;
        }
        if (ch !== "\n") chars[i] = " ";
        i++;
      }
      continue;
    }
    if (c === "/") {
      // Regex-literal heuristic: a `/` right after a value position starts a
      // regex literal (mask it); after an identifier/`)`/`]` it is division.
      const prev = prevCode;
      const afterValueWord = /\b(?:return|typeof|instanceof|in|of|case|do|else|yield|await|throw|delete|void)\s*$/.test(
        codeBuf.trimEnd(),
      );
      const startsRegex = prev === "" || REGEX_PRECEDERS.has(prev) || (/\w/.test(prev) && afterValueWord);
      if (startsRegex) {
        // Confirm a closing unescaped `/` before end-of-line, else it was division.
        let j = i + 1;
        let closed = false;
        while (j < n) {
          const ch = chars[j];
          if (ch === "\n") break;
          if (ch === "\\") {
            j += 2;
            continue;
          }
          if (ch === "/") {
            closed = true;
            break;
          }
          j++;
        }
        if (closed) {
          chars[i] = " ";
          i++;
          while (i <= j) {
            chars[i] = " ";
            i++;
          }
          // skip flags (e.g. /x/gi)
          while (i < n && /[a-z]/i.test(chars[i])) {
            chars[i] = " ";
            i++;
          }
          continue;
        }
      }
    }
    // Plain code char: keep, track context for regex detection.
    if (!/\s/.test(c)) {
      prevCode = c;
      codeBuf = (codeBuf + c).slice(-24);
    } else {
      codeBuf = (codeBuf + " ").slice(-24);
    }
    i++;
  }
  return chars.join("");
}

type RecordedLoop = { line: number; nesting: number; lin: number; hal: number; halving: boolean };

/** Halving-step heuristics: `>>1`, `>>=1`, `>>>1`, `/ 2`, `/= 2`, `* 0.5`. */
const HALVING_RE = />>+={0,1}\s*1\b|\/=?\s*2\b|0\.5/;

function skipParens(masked: string, i: number): number {
  let depth = 0;
  for (; i < masked.length; i++) {
    const c = masked[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return masked.length;
}

/** Position just past a loop keyword's condition/`await` preamble (points at `{`, `;`, or body start). */
function bodyStartOf(masked: string, from: number): number {
  let j = from;
  for (;;) {
    while (j < masked.length && /\s/.test(masked[j])) j++;
    if (masked[j] === "(") {
      j = skipParens(masked, j);
      continue;
    }
    if (
      masked.startsWith("await", j) &&
      (j === 0 || !/[A-Za-z0-9_$]/.test(masked[j - 1])) &&
      !/[A-Za-z0-9_$]/.test(masked[j + 5] ?? "")
    ) {
      j += 5;
      continue;
    }
    break;
  }
  return j;
}

/** First ~240 chars of a loop body up to its own closing brace or first nested block. */
function loopBodyHead(masked: string, bodyAt: number): string {
  let depth = 1;
  let out = "";
  for (let i = bodyAt + 1; i < masked.length && out.length < 240; i++) {
    const ch = masked[i];
    if (ch === "{") {
      if (depth === 1) break; // first nested block — stop probing
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) break;
    }
    out += ch;
  }
  return out;
}

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

export function complexityOf(source: string): ComplexityReport {
  const masked = maskNonCode(source);
  const n = masked.length;
  const loops: RecordedLoop[] = [];
  const braceIsLoop: boolean[] = [];
  const loopFrames: { lin: number; hal: number; nesting: number }[] = [];
  let pending: { lin: number; hal: number; nesting: number } | null = null;
  const kwRe = /\b(for|while|do)\b/g;
  let pos = 0;
  for (;;) {
    kwRe.lastIndex = pos;
    const m = kwRe.exec(masked);
    if (m === null) {
      // Flush remaining braces to EOF.
      for (; pos < n; pos++) {
        const c = masked[pos];
        if (c === "{") {
          if (pending !== null) {
            braceIsLoop.push(true);
            loopFrames.push(pending);
            pending = null;
          } else {
            braceIsLoop.push(false);
          }
        } else if (c === "}") {
          const isLoop = braceIsLoop.pop() ?? false;
          if (isLoop) loopFrames.pop();
        }
      }
      break;
    }
    const kwIdx = m.index;
    const kind = m[1] as "for" | "while" | "do";
    // Process braces up to this keyword.
    for (; pos < kwIdx; pos++) {
      const c = masked[pos];
      if (c === "{") {
        if (pending !== null) {
          braceIsLoop.push(true);
          loopFrames.push(pending);
          pending = null;
        } else {
          braceIsLoop.push(false);
        }
      } else if (c === "}") {
        const isLoop = braceIsLoop.pop() ?? false;
        if (isLoop) loopFrames.pop();
      }
    }
    const kwEnd = kwIdx + kind.length;
    const bodyAt = bodyStartOf(masked, kwEnd);
    // A `while` that ends in `;` is the terminator of a do-while — skip it
    // (the `do` already recorded the loop).
    if (kind === "while" && masked[bodyAt] === ";") {
      pos = kwEnd;
      continue;
    }
    const header = masked.slice(kwEnd, bodyAt).slice(0, 120);
    const braced = masked[bodyAt] === "{";
    const bodyHead = braced ? loopBodyHead(masked, bodyAt) : "";
    const halving = HALVING_RE.test(header + bodyHead);
    const parent = loopFrames.length > 0 ? loopFrames[loopFrames.length - 1] : null;
    const lin = (parent ? parent.lin : 0) + (halving ? 0 : 1);
    const hal = (parent ? parent.hal : 0) + (halving ? 1 : 0);
    const nesting = (parent ? parent.nesting : 0) + 1;
    loops.push({ line: lineOf(source, kwIdx), nesting, lin, hal, halving });
    if (braced) {
      pending = { lin, hal, nesting };
      pos = bodyAt; // the brace loop will push the frame when it reaches `{`
    } else {
      pos = kwEnd;
    }
  }

  const loopsCount = loops.length;
  const maxNesting = loops.reduce((acc, l) => Math.max(acc, l.nesting), 0);
  const halvingLoops = loops.filter((l) => l.halving).length;
  const lineRefs = loops.map((l) => l.line);
  lineRefs.sort((a, b) => a - b);

  // Dominant chain: maximize (linear factors, then log factors).
  let best: RecordedLoop | null = null;
  for (const l of loops) {
    if (
      best === null ||
      l.lin > best.lin ||
      (l.lin === best.lin && l.hal > best.hal)
    ) {
      best = l;
    }
  }

  let notation: ComplexityNotation;
  const extras: string[] = [];
  if (loopsCount === 0) {
    notation = "O(1)";
  } else if (best !== null && best.lin === 0) {
    notation = "O(log n)";
    if (best.hal > 1) extras.push("multiple halving levels are reported as O(log n)");
  } else if (best !== null && best.lin === 1) {
    notation = best.hal > 0 ? "O(n log n)" : "O(n)";
  } else {
    notation = best !== null && best.lin === 2 ? "O(n^2)" : "O(n^3)";
    if (best !== null && best.hal > 0) {
      extras.push("log factors of inner halving loops are folded into the dominant class");
    }
  }
  const caveat =
    extras.length > 0 ? `${COMPLEXITY_CAVEAT} ${extras.join("; ")}.` : COMPLEXITY_CAVEAT;
  return { notation, loops: loopsCount, maxNesting, halvingLoops, lineRefs, caveat };
}

// ---------------------------------------------------------------------------
// benchmarkHarness — node:test benchmark file body (G-27 static half)
//
// Deterministic string builder: same (source, brief) -> byte-identical body.
// The body is a runnable node:test file that embeds the source verbatim,
// compiles it through the same CommonJS `exports` shape the verify harness
// uses, then times every exported function over seeded inputs with
// performance.now() (zero-dep, per the register). Run it with plain `node`.
// ---------------------------------------------------------------------------

export function benchmarkHarness(source: string, brief: string): string {
  // Fail closed on junk callers: non-strings coerce to "" (a hosted module
  // must never TypeError out of a benchmark scaffold).
  const src = typeof source === "string" ? source : "";
  const briefText = typeof brief === "string" ? brief : "";
  const rep = complexityOf(src);
  const purpose = briefText.replace(/\s+/g, " ").trim().slice(0, 160);
  const srcJson = JSON.stringify(src);
  const lines = [
    "// ===========================================================================",
    "// rapidtool benchmark harness — machine-authored by algo-tools.benchmarkHarness (G-27).",
    "// Do not hand-edit: regenerate from the source module instead.",
    `// Purpose: ${purpose}`,
    `// Static complexity (heuristic — not a proof): ${rep.notation}`,
    "// Run: node <this file>  (node:test based; exit 0 = every benchmark ran)",
    "// ===========================================================================",
    'import { test } from "node:test";',
    'import assert from "node:assert/strict";',
    'import { performance } from "node:perf_hooks";',
    "",
    "// The benchmarked module (CommonJS `exports.x = ...` shape), embedded verbatim.",
    `const __SRC = ${srcJson};`,
    "const __exports = {};",
    'let __compileError = "";',
    "try {",
    '  new Function("exports", "module", "require", __SRC + "\\n; return exports;")(',
    "    __exports,",
    '    { exports: __exports },',
    '    () => { throw new Error("require() is not available inside benchmarked code"); },',
    "  );",
    "} catch (e) {",
    "  __compileError = String(e);",
    "}",
    "",
    'test("benchmarked module compiles", () => {',
    '  assert.equal(__compileError, "", __compileError);',
    "});",
    "",
    "// Deterministic PRNG (mulberry32): same file, same inputs, comparable timings.",
    "function mulberry32(seed) {",
    "  let a = seed >>> 0;",
    "  return () => {",
    "    a = (a + 0x6d2b79f5) >>> 0;",
    "    let t = a;",
    "    t = Math.imul(t ^ (t >>> 15), t | 1);",
    "    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);",
    "    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;",
    "  };",
    "}",
    "",
    "const N_ITERS = 7;",
    "const N_INPUT = 1000;",
    "const SEED = 0x5eed1234;",
    "",
    "// Heuristic argument builder: parameter names hint at shapes (arr/list ->",
    "// int arrays, n/size/count -> lengths). Smoke timings, not microbenchmarks.",
    "function argsFor(fn) {",
    "  const src = String(fn);",
    '  const m = /\\(([^)]*)\\)/.exec(src);',
    '  const params = (m ? m[1] : "").split(",").map((s) => s.trim()).filter(Boolean);',
    "  return params.map((p, i) => {",
    "    const lower = p.toLowerCase();",
    "    const rnd = mulberry32((SEED + i * 2654435761) >>> 0);",
    "    if (/(arr|list|items|vals|nums|col|seq|data|xs|stack|queue)/.test(lower)) {",
    "      return Array.from({ length: N_INPUT }, () => Math.floor(rnd() * 100000));",
    "    }",
    "    if (/^(n|len|size|count|limit|depth|k)$/.test(lower)) return N_INPUT;",
    "    return Math.floor(rnd() * 100000);",
    "  });",
    "}",
    "",
    'const __targets = Object.entries(__exports).filter(([, v]) => typeof v === "function");',
    "",
    "for (const [name, fn] of __targets) {",
    '  test("benchmark " + name, () => {',
    "    const args = argsFor(fn);",
    "    for (let i = 0; i < 3; i++) fn(...args); // warmup",
    "    const t0 = performance.now();",
    "    for (let i = 0; i < N_ITERS; i++) fn(...args);",
    '    const nsPerOp = ((performance.now() - t0) / N_ITERS) * 1e6;',
    '    const desc = args.map((a) => (Array.isArray(a) ? a.length + "-items" : typeof a)).join(", ") || "no-arg";',
    '    console.log("BENCH " + name + " " + Math.round(nsPerOp) + " ns/op [" + desc + "]");',
    '    assert.ok(Number.isFinite(nsPerOp) && nsPerOp >= 0, name + ": invalid timing");',
    "  });",
    "}",
    "",
    'test("benchmark target exists", () => {',
    '  assert.ok(__targets.length > 0, "module exports no callable functions to benchmark");',
    "});",
    "",
  ];
  return lines.join("\n");
}
