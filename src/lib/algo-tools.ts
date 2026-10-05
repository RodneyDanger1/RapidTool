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
//                              parseOracleCases, so the case contract is the
//                              same parser the verify lane runs.
//
// No function here writes files or fabricates model output.
// ---------------------------------------------------------------------------
import { completeDeepSeek, isDeepSeekConfigured } from "./deepseek.server.ts";
import { parseOracleCases } from "./verify.server.ts";
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

// ---------------------------------------------------------------------------
// 328 P3 — ESM binding-name inventory (register: the 327 lane's residual).
//
// The old single-name regex captured only the FIRST declarator of an
// `export const|let|var` list and nothing at all from a destructuring pattern,
// so `export const a = 1, b = 2` reported ["a"] and `export const {x} = o`
// reported [] — the property-case prompt then told the model the module
// exports "(none)" while it plainly exported callables. These helpers parse
// the declarator list and its binding patterns over the masker's view (strings
// /comments/regex already blanked, so a separator can only be real code).
// ---------------------------------------------------------------------------

const ES_ID_START = /[A-Za-z_$]/;
const ES_ID_CHAR = /[A-Za-z0-9_$]/;

function esSkipWs(masked: string, i: number): number {
  while (i < masked.length && /\s/.test(masked[i]!)) i++;
  return i;
}

function esReadIdent(masked: string, i: number): { name: string; end: number } | null {
  if (i >= masked.length || !ES_ID_START.test(masked[i]!)) return null;
  let j = i + 1;
  while (j < masked.length && ES_ID_CHAR.test(masked[j]!)) j++;
  return { name: masked.slice(i, j), end: j };
}

/** Skip a balanced `(...)`/`[...]`/`{...}` group starting at `i`. */
function esSkipBalanced(masked: string, i: number): number {
  const open = masked[i];
  const close = open === "(" ? ")" : open === "[" ? "]" : "}";
  let depth = 0;
  for (; i < masked.length; i++) {
    const c = masked[i];
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return masked.length;
}

/** If the next non-space char is `=`, skip the initializer to the first
 *  top-level char in `stops` (or the enclosing closer); else return `i`. */
function esSkipDefault(masked: string, i: number, stops: string): number {
  i = esSkipWs(masked, i);
  if (masked[i] !== "=") return i;
  i++;
  let depth = 0;
  for (; i < masked.length; i++) {
    const c = masked[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) return i;
      depth--;
    } else if (depth === 0 && stops.includes(c)) return i;
  }
  return i;
}

/** Collect the names a binding target at `i` binds (identifier, object or array
 *  pattern); returns the index past the target (its default, if any, included). */
function esCollectBindingNames(masked: string, i: number, out: string[]): number {
  i = esSkipWs(masked, i);
  const c = masked[i];
  if (c === "{") {
    i++;
    for (;;) {
      i = esSkipWs(masked, i);
      if (i >= masked.length) return i;
      if (masked[i] === "}") return i + 1;
      if (masked[i] === ",") { i++; continue; }
      if (masked.startsWith("...", i)) {
        const rest = esReadIdent(masked, i + 3);
        if (rest !== null) { out.push(rest.name); i = rest.end; } else i += 3;
        continue;
      }
      if (masked[i] === "[") {
        // computed key `[expr]: target` — only the TARGET binds a name
        i = esSkipBalanced(masked, i);
        i = esSkipWs(masked, i);
        if (masked[i] === ":") i = esCollectBindingNames(masked, i + 1, out);
        i = esSkipDefault(masked, i, ",}");
        continue;
      }
      const key = esReadIdent(masked, i);
      if (key === null) { i++; continue; }
      i = esSkipWs(masked, key.end);
      if (masked[i] === ":") {
        i = esCollectBindingNames(masked, i + 1, out); // `key: target` — target binds
      } else {
        out.push(key.name); // shorthand (optionally with a default)
      }
      i = esSkipDefault(masked, i, ",}");
    }
  }
  if (c === "[") {
    i++;
    for (;;) {
      i = esSkipWs(masked, i);
      if (i >= masked.length) return i;
      if (masked[i] === "]") return i + 1;
      if (masked[i] === ",") { i++; continue; } // elision hole
      const before = i;
      i = esCollectBindingNames(masked, i, out);
      if (i === before) { i++; continue; }
      i = esSkipDefault(masked, i, ",]");
    }
  }
  const id = esReadIdent(masked, i);
  if (id !== null) { out.push(id.name); return id.end; }
  return i;
}

/**
 * fixes/330 P3 (extended 339-2): names exported by the object literal whose
 * opening `{` sits at `openBrace` in `masked`. Top-level keys only: a leading
 * `get `/`set `/`async ` modifier is stripped, and `...spread` / computed
 * `[expr]` keys contribute nothing (a spread's names are not statically
 * knowable). Balanced scanning keeps a nested object / call / method body from
 * splitting on its own commas. A quoted key (`{ "x": v }`) IS a real export
 * name the masker blanked, so 339-2 recovers the literal from the
 * length-preserving `source` at the same indices (the old "masker blanked
 * string keys" note treated those as intentionally dropped, advertising
 * "(none)" for a module that plainly exports its API).
 */
function objectLiteralKeys(masked: string, source: string, openBrace: number): string[] {
  const out: string[] = [];
  let depth = 0;
  let segStart = openBrace + 1;
  const flush = (end: number): void => {
    const seg = masked.slice(segStart, end).trim();
    if (!seg || seg.startsWith("...") || seg.startsWith("[")) return;
    const mod = /^(?:get|set|async)\s+/.exec(seg);
    const id = esReadIdent(mod ? seg.slice(mod[0].length) : seg, 0);
    if (id !== null) {
      out.push(id.name);
      return;
    }
    // Quoted string key — blanked by the masker; recover the literal from source.
    const raw = source.slice(segStart, end).trim();
    const q = /^(['"])((?:\\.|(?!\1).)*)\1\s*:/.exec(raw);
    if (q !== null && q[2]!.trim().length > 0) out.push(q[2]!);
  };
  for (let i = openBrace; i < masked.length; i++) {
    const c = masked[i]!;
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") {
      depth--;
      if (depth === 0) {
        flush(i);
        break;
      }
    } else if (c === "," && depth === 1) {
      flush(i);
      segStart = i + 1;
    }
  }
  return out;
}

/** fixes/330 P3: names exported by `module.exports = { … }`. */
function moduleExportsObjectNames(masked: string, source: string): string[] {
  const out: string[] = [];
  const opener = /(^|[^A-Za-z0-9_$.])module\s*\.\s*exports\s*=\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(masked)) !== null) {
    const openBrace = m.index + m[0].length - 1;
    for (const n of objectLiteralKeys(masked, source, openBrace)) out.push(n);
  }
  return out;
}

/**
 * 339-2: string-key export assignments — `module.exports['x'] =` /
 * `module.exports["x"] =` / `exports['x'] =`. The masker blanks the quoted key,
 * so the bracket interior is located structurally in `masked` and the literal
 * is recovered from the length-preserving `source`. Boundary discipline mirrors
 * the dot forms (109 T-08 / 330 P3): the opener must sit at statement position,
 * so neither a mid-identifier tail (`my_module.exports['x']`) nor a
 * member-chain tail (`obj.module.exports['x']`) matches.
 */
function moduleExportsStringKeyNames(masked: string, source: string): string[] {
  const out: string[] = [];
  const re = /(^|[^A-Za-z0-9_$.])(?:module\.exports|exports)\s*\[(\s*)\]\s*=(?!=)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    const open = m.index + m[0].indexOf("[", m[1]!.length) + 1;
    const lit = /(['"])((?:\\.|(?!\1).)*)\1/.exec(source.slice(open, open + m[2]!.length));
    if (lit !== null && lit[2]!.length > 0) out.push(lit[2]!);
  }
  return out;
}

/**
 * 339-2: `Object.assign(module.exports, { … })` / `Object.assign(exports, { … })`
 * — a real, statically knowable export inventory the dot/object scanners
 * missed; the literal's keys are extracted with the same `objectLiteralKeys`
 * rules used for `module.exports = { … }`. Only a literal SECOND argument
 * contributes (a spread/variable source is not statically knowable), and the
 * call must sit at statement position so a member-chain tail never matches.
 */
function objectAssignExportNames(masked: string, source: string): string[] {
  const out: string[] = [];
  const opener =
    /(^|[^A-Za-z0-9_$.])Object\s*\.\s*assign\s*\(\s*(?:module\.exports|exports)\s*,\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(masked)) !== null) {
    const openBrace = m.index + m[0].length - 1;
    for (const n of objectLiteralKeys(masked, source, openBrace)) out.push(n);
  }
  return out;
}

/**
 * 339-2: top-level binding names declared via `function` / `class` /
 * `const` / `let` / `var`. Brace/paren/bracket depth keeps a nested declaration
 * (`function outer(){ function inner(){} }`) out. `async` needs no special case
 * — it is skipped as a plain word, so `async function f` still registers `f`.
 * Used only to validate a `module.exports = <ident>` reassignment alias.
 */
function topLevelBindingNames(masked: string): Set<string> {
  const out = new Set<string>();
  let depth = 0;
  let i = 0;
  while (i < masked.length) {
    const c = masked[i]!;
    if (c === "{" || c === "(" || c === "[") {
      depth++;
      i++;
      continue;
    }
    if (c === "}" || c === ")" || c === "]") {
      if (depth > 0) depth--;
      i++;
      continue;
    }
    if (depth !== 0 || !ES_ID_START.test(c)) {
      i++;
      continue;
    }
    const id = esReadIdent(masked, i);
    if (id === null) {
      i++;
      continue;
    }
    i = id.end;
    if (id.name === "function" || id.name === "class") {
      let j = esSkipWs(masked, i);
      if (masked[j] === "*") j = esSkipWs(masked, j + 1);
      const nm = esReadIdent(masked, j);
      if (nm !== null) {
        out.add(nm.name);
        i = nm.end;
      }
    } else if (id.name === "const" || id.name === "let" || id.name === "var") {
      const decl = esmDeclaratorNames(masked, i);
      for (const n of decl.names) out.add(n);
      i = decl.end;
    }
  }
  return out;
}

/**
 * 339-2: `module.exports = <ident>` — the module reassigns its export object to
 * a top-level binding (e.g. `module.exports = sub`). Only a name the module
 * actually declares at depth 0 counts as a real export; an undeclared
 * identifier, or a member/call expression (`sub.x`, `sub()`), is not an alias.
 */
function moduleExportsAliasNames(masked: string): string[] {
  const declared = topLevelBindingNames(masked);
  const out: string[] = [];
  const re =
    /(^|[^A-Za-z0-9_$.])module\.exports\s*=\s*([A-Za-z_$][\w$]*)(?=[ \t]*\r?(?:[;,)}]|$|\n))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    if (declared.has(m[2]!)) out.push(m[2]!);
  }
  return out;
}

/** Names bound by an `export const|let|var` declarator list starting at the
 *  first declarator; stops at the first top-level `;`. `end` is where scanning
 *  stopped, so a caller can resume past the declarator list (339-2). */
function esmDeclaratorNames(masked: string, start: number): { names: string[]; end: number } {
  const out: string[] = [];
  let i = start;
  for (;;) {
    i = esSkipWs(masked, i);
    if (i >= masked.length) break;
    const before = i;
    i = esCollectBindingNames(masked, i, out);
    if (i === before) i++;
    i = esSkipDefault(masked, i, ",;");
    i = esSkipWs(masked, i);
    if (masked[i] === ",") { i++; continue; }
    break;
  }
  return { names: out, end: i };
}

/**
 * Export-name inventory of a module source, for the property-case prompt.
 *
 * Detection is comment/string/template/regex-aware: the source is masked
 * through maskNonCode FIRST so prose that merely LOOKS like an export
 * (`// exports.fake = 1`, `"exports.str = 3"`, regex-literal content) can
 * never be reported as a real export — the prompt tells the model "the
 * module exports these names ONLY", so a phantom name would push the model
 * into writing cases that fail at runtime. Covers the ESM declaration forms
 * this codebase emits (function incl. async + generators, class, const/let/var
 * incl. multi-declarator lists and destructuring patterns — 328 P3) plus the
 * CommonJS forms `exports.x = …` / `module.exports.x = …`, computed string keys
 * (`module.exports['x'] =` / `exports["x"] =`), the object-literal forms
 * `module.exports = { … }` and `Object.assign(module.exports, { … })`, and the
 * reassignment alias `module.exports = <top-level ident>` (339-2). Member-chain
 * lookalikes (`obj.exports.x = …`) are excluded — they are object properties,
 * not module exports. Deterministic, sorted.
 */
export function exportedNamesOf(source: string): string[] {
  if (typeof source !== "string") return [];
  const masked = maskNonCode(source);
  const names = new Set<string>();
  // CJS: statement-position `exports.x =` / `module.exports.x =`. Two SPLIT
  // regexes (109 T-08): the old single `(^|[^A-Za-z0-9_$.]|module\.)exports\.`
  // let its `module\.` alternative match the TAIL of `my_module.exports.x`
  // (that spelling carried no left boundary, so it fired mid-identifier) and
  // the prompt then advertised a phantom export. The bare form requires a
  // non-identifier, non-`$`, non-`.` boundary; the module form requires a
  // boundary that is not an identifier char, `$` or `.` — so `my_module.exports.x`,
  // `obj.exports.y` AND `obj.module.exports.z` never match, while
  // `module.exports.z` / `exports.real` still do (fixes/330 P3: the module form
  // omitted `.`, so a member-chain tail `obj.module.exports.z` was reported as a
  // module export — the same phantom class 109 T-08 fixed for the bare form).
  const cjsBare = /(^|[^A-Za-z0-9_$.])exports\.([A-Za-z_$][\w$]*)\s*=/g;
  const cjsModule = /(^|[^A-Za-z0-9_$.])module\.exports\.([A-Za-z_$][\w$]*)\s*=/g;
  let m: RegExpExecArray | null;
  while ((m = cjsBare.exec(masked)) !== null) names.add(m[2]);
  while ((m = cjsModule.exec(masked)) !== null) names.add(m[2]);
  // 330 P3: the reassignment form the verify harness explicitly supports
  // (109 T-05) — `module.exports = { … }` — was not inventoried, so the
  // property-case prompt advertised "(none)" for a module that plainly
  // exports its API.
  for (const n of moduleExportsObjectNames(masked, source)) names.add(n);
  // 339-2: the CJS forms the dot/object scanners above cannot see — computed
  // string keys, the `module.exports = <ident>` reassignment alias, and
  // `Object.assign(<exports>, { … })`. Each keeps the 109 T-08 / 330 P3
  // boundary discipline (statement position; no mid-identifier / member-chain
  // tail) and reuses the same masker, so prose/strings still contribute nothing.
  for (const n of moduleExportsStringKeyNames(masked, source)) names.add(n);
  for (const n of objectAssignExportNames(masked, source)) names.add(n);
  for (const n of moduleExportsAliasNames(masked)) names.add(n);
  // ESM declarations: `function` (incl. `async` / `function*` generators) and
  // `class` each carry a single hoisted name. `const/let/var` declarations may
  // bind MANY names and may destructure — 328 P3 parses the whole declarator
  // list (esmDeclaratorNames) instead of capturing only the first identifier
  // (which missed `a = 1, b = 2` and every `{x} = o` / `[p, q] = arr` pattern,
  // publishing "(none)" for a module that does export callables). `export
  // default` has no hoisted name to inventory.
  const esmDecl =
    /\bexport\s+(?:async\s+)?(?:function(?:\s*\*\s*|\s+)|class\s+)([A-Za-z_$][\w$]*)/g;
  while ((m = esmDecl.exec(masked)) !== null) names.add(m[1]);
  const esmVar = /\bexport\s+(?:const|let|var)\s+/g;
  while ((m = esmVar.exec(masked)) !== null) {
    for (const n of esmDeclaratorNames(masked, m.index + m[0].length).names) names.add(n);
  }
  // 329: ESM re-export LISTS — `export { a, b as c }` and `export { x } from "…"`
  // (the form 328 P3 recorded as not inventoried). The EXPORTED name is what a
  // consumer sees, so `b as c` contributes `c`, and a bare `a` contributes `a`.
  // `export type { … }` never matches (`type` sits between `export` and `{`), and
  // an inline `type` specifier is skipped — a type is not a runtime name the
  // prompt's cases can call. The list carries no `=`/declarator, so it cannot
  // collide with the paths above; the masker has already blanked strings.
  const esmReexport = /\bexport\s*\{([^}]*)\}/g;
  while ((m = esmReexport.exec(masked)) !== null) {
    for (const part of m[1]!.split(",")) {
      const seg = part.trim();
      if (!seg || seg.startsWith("type ") || seg.startsWith("type\t")) continue;
      const alias = /\bas\s+([A-Za-z_$][\w$]*)$/.exec(seg);
      if (alias !== null) {
        names.add(alias[1]!);
        continue;
      }
      const local = esReadIdent(seg, 0);
      if (local !== null) names.add(local.name);
    }
  }
  // 330 P3: a namespace re-export — `export * as ns from "…"` — IS a real
  // named export the prompt's cases can call (`ns.fn()`); it was the one
  // `export *` spelling whose name is statically knowable. (A bare
  // `export * from "…"` still re-exports an unknowable set and stays
  // un-inventoried — never a guessed name.)
  const esmNamespace = /\bexport\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\b/g;
  while ((m = esmNamespace.exec(masked)) !== null) names.add(m[1]!);
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
  // fixes/328 P3: the discriminating parse separates a valid-but-EMPTY reply
  // from a malformed one — the conflation the verify lane's generateCases()
  // also now distinguishes (the 327 lane's owed pin).
  const parsed = parseOracleCases(res.text);
  if (!parsed.ok) {
    return {
      ok: false,
      reason: "error",
      error:
        parsed.reason === "empty"
          ? "model returned a valid JSON reply with no usable cases (empty property set)"
          : "model returned an unparseable property payload",
      code: "RT_E_VALIDATION",
    };
  }
  return { ok: true, cases: parsed.cases };
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
 *
 * T10 (112 F5): a template's `${…}` interpolation body is CODE, not template
 * text — the old masker blanked the whole template (interpolations included),
 * so a loop inside `${…}` was invisible to complexityOf and the report could
 * claim O(1) about an n-loop (reproduced). The scan now tracks template
 * CONTENT vs code: an interpolation re-enters code mode and its body is masked
 * like any other code (strings/comments/regex/nested templates inside it
 * included). The `${` opener and its matching `}` are masked like the
 * surrounding template text, so the masked view stays brace-balanced for
 * downstream nesting scans.
 */
export function maskNonCode(source: string): string {
  if (typeof source !== "string") return "";
  const chars = source.split("");
  const n = chars.length;
  let i = 0;
  let prevCode = ""; // last non-whitespace CODE char seen (drives regex detection)
  let codeBuf = ""; // last few code chars, for `return /re/` style detection
  let inTemplate = false; // inside template-literal CONTENT (not an interpolation)
  const interpDepths: number[] = []; // brace depth per open `${…}` (stack: templates nest)
  while (i < n) {
    const c = chars[i];
    const next = i + 1 < n ? chars[i + 1] : "";
    if (inTemplate) {
      // Template content is not code: mask everything but newlines. Escapes
      // and the closing backtick leave the region; `${` re-enters code mode.
      if (c === "\\") {
        chars[i] = " ";
        i++;
        if (i < n) {
          chars[i] = " ";
          i++;
        }
        continue;
      }
      if (c === "`") {
        chars[i] = " ";
        i++;
        inTemplate = false;
        continue;
      }
      if (c === "$" && next === "{") {
        chars[i] = " ";
        chars[i + 1] = " ";
        interpDepths.push(1);
        i += 2;
        inTemplate = false;
        continue;
      }
      if (c !== "\n") chars[i] = " ";
      i++;
      continue;
    }
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
      // Enter template CONTENT mode; the `inTemplate` branch above masks the
      // body, re-enters code mode at `${` and exits at the closing backtick.
      chars[i] = " ";
      i++;
      inTemplate = true;
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
    // T10 (F5): inside a `${…}` body, `{`/`}` are real code braces — depth-
    // track them so the interpolation ends at its own matching `}` (which is
    // masked, mirroring the masked `${` opener, keeping the view balanced).
    if (interpDepths.length > 0 && (c === "{" || c === "}")) {
      const top = interpDepths.length - 1;
      if (c === "{") {
        interpDepths[top] = interpDepths[top]! + 1;
      } else {
        interpDepths[top] = interpDepths[top]! - 1;
        if (interpDepths[top] === 0) {
          interpDepths.pop();
          chars[i] = " ";
          i++;
          inTemplate = true;
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

type RecordedLoop = {
  /** Character index of the loop keyword (ascending across `loops`). */
  kwIdx: number;
  nesting: number;
  lin: number;
  hal: number;
  halving: boolean;
  /** T-06 (109 C-03): a halving shape seen in the BODY (not the header) — reported, never counted. */
  bodyHalving: boolean;
};

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

/** Skip a brace-balanced `{...}` group starting at `i` (masker's view). */
function skipBraces(masked: string, i: number): number {
  let depth = 0;
  for (; i < masked.length; i++) {
    const c = masked[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return masked.length;
}

/** Skip one statement body to its terminating `;` / enclosing `}` at depth 0. */
function skipStatement(masked: string, i: number): number {
  let depth = 0;
  for (; i < masked.length; i++) {
    const c = masked[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) return i;
      depth--;
    } else if (c === ";" && depth === 0) return i + 1;
  }
  return i;
}

/**
 * 328 P3 (326 L4 residual): the `while` that TERMINATES the `do` whose body
 * starts just past `doKwEnd`, or -1 when this `do` is not followed by a
 * terminator. A do-while tail is the ONLY `while (…);` that must not be
 * counted (the `do` already recorded the loop); a standalone empty-body
 * `while (cond);` is a real (busy-wait) loop and must be. Distinguishing them
 * needs the preceding `do` body, which the keyword scan alone cannot see.
 */
function doWhileTerminatorIdx(masked: string, doKwEnd: number): number {
  const bodyAt = bodyStartOf(masked, doKwEnd);
  let after: number;
  if (masked[bodyAt] === "{") {
    after = skipBraces(masked, bodyAt);
  } else {
    after = skipStatement(masked, bodyAt);
  }
  let j = after;
  while (j < masked.length && /\s/.test(masked[j])) j++;
  if (
    masked.startsWith("while", j) &&
    (j === 0 || !/[A-Za-z0-9_$]/.test(masked[j - 1])) &&
    !/[A-Za-z0-9_$]/.test(masked[j + 5] ?? "")
  ) {
    return j;
  }
  return -1;
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

/**
 * The kind of scope a `{` opens, from the loop scanner's point of view. A class
 * body or an object literal can contain ONLY members, so a bare `while`/`for`/
 * `do` token directly inside one names a method or accessor — never a loop
 * (`class C { while(x) {} }`, `const o = { while(x) {} }`). Class *static
 * blocks* get their own `block` frame (see `braceFrameKind`), so a real loop
 * inside one stays counted.
 */
type BraceFrame = "block" | "class" | "object";

/**
 * True when the `{` at `braceIdx` opens a CLASS BODY. Scans back to the nearest
 * `class` keyword with no statement or brace boundary in between, so
 * `class C {` and `class C extends f(X) {` match while a plain block
 * (`if (x) {`) does not — its `)` is preceded by the earlier block's `}`.
 */
function opensClassBody(masked: string, braceIdx: number): boolean {
  let depth = 0;
  for (let i = braceIdx - 1; i >= 0; i--) {
    const c = masked[i];
    if (c === "}" && depth === 0) return false; // a completed block precedes this brace
    if (c === ")" || c === "]" || c === "}") depth++;
    else if (c === "(" || c === "[") {
      if (depth === 0) return false;
      depth--;
    } else if (c === "{") {
      if (depth === 0) return false;
      depth--;
    } else if (c === ";" && depth === 0) return false;
    else if (
      depth === 0 &&
      c === "s" &&
      masked.startsWith("class", i - 4) &&
      masked[i - 5] !== "." &&
      !/[A-Za-z0-9_$]/.test(masked[i - 5] ?? "")
    ) {
      // Validate the slice as a class header (`[Name] [extends …]`) so a `class`
      // that is the tail of some other expression is not read as this header.
      const header = masked.slice(i + 1, braceIdx);
      return (
        !/[;{}]/.test(header) &&
        /^\s*(?:[A-Za-z_$][\w$]*)?\s*(?:extends[\s\S]*)?$/.test(header)
      );
    }
  }
  return false;
}

/**
 * True when the `:` at `colonIdx` is a TERNARY colon (`c ? { … } : { … }`) and
 * not a label / `case` / object-key colon. A ternary colon is preceded by an
 * unclosed `?` at the same nesting; a label/`case` colon is not.
 */
function colonIsTernary(masked: string, colonIdx: number): boolean {
  let depth = 0;
  for (let i = colonIdx - 1; i >= 0; i--) {
    const c = masked[i];
    if (c === ")" || c === "]" || c === "}") depth++;
    else if (c === "(" || c === "[") {
      if (depth === 0) return false;
      depth--;
    } else if (c === "{") {
      if (depth === 0) return false;
      depth--;
    } else if (c === ";" && depth === 0) return false;
    else if (
      c === "?" &&
      depth === 0 &&
      masked[i - 1] !== "?" &&
      masked[i + 1] !== "?" &&
      masked[i + 1] !== "."
    ) {
      return true;
    }
  }
  return false;
}

/** Classify the `{` at `braceIdx` given the frame that encloses it. */
function braceFrameKind(
  masked: string,
  braceIdx: number,
  enclosing: BraceFrame,
): BraceFrame {
  let j = braceIdx - 1;
  while (j >= 0 && /\s/.test(masked[j]!)) j--;
  if (j < 0) return "block";
  const c = masked[j];
  // Value positions (object literal / destructuring — neither holds a
  // statement): after `= ( [ , ?` or a keyword whose operand is an expression.
  if (c === "=" || c === "(" || c === "[" || c === "," || c === "?") return "object";
  if (c === ">" && j > 0 && masked[j - 1] === "=") return "block"; // arrow body
  // `:` opens a member VALUE inside an object/class frame; in a block frame it
  // opens a ternary arm (object literal) or a label / `case` block.
  if (c === ":") {
    if (enclosing === "object" || enclosing === "class") return "object";
    return colonIsTernary(masked, j) ? "object" : "block";
  }
  if (/[A-Za-z0-9_$]/.test(c)) {
    let k = j;
    while (k >= 0 && /[A-Za-z0-9_$]/.test(masked[k]!)) k--;
    const word = masked.slice(k + 1, j + 1);
    if (word === "return" || word === "yield" || word === "in" || word === "of") {
      return "object";
    }
  }
  return opensClassBody(masked, braceIdx) ? "class" : "block";
}

/**
 * 1-based line numbers for ASCENDING character indices, in a single forward
 * pass (T10 / 112 F6): `lineOf` used to rescan from char 0 for every recorded
 * loop — O(loops × source). The keyword scan visits indices in ascending
 * order, so one running (cursor, line) pair is O(source) total and
 * byte-identical to the per-index rescan.
 */
function linesOfIndices(source: string, indices: number[]): number[] {
  const out: number[] = [];
  let cursor = 0;
  let line = 1;
  for (const index of indices) {
    for (; cursor < index && cursor < source.length; cursor++) {
      if (source[cursor] === "\n") line++;
    }
    out.push(line);
  }
  return out;
}

export function complexityOf(source: string): ComplexityReport {
  const masked = maskNonCode(source);
  const n = masked.length;
  const loops: RecordedLoop[] = [];
  const braceIsLoop: boolean[] = [];
  // Parallel to `braceIsLoop`: the scope kind of each open `{`, so a loop
  // keyword at MEMBER position in a class body / object literal is not counted.
  const braceKinds: BraceFrame[] = [];
  const loopFrames: { lin: number; hal: number; nesting: number }[] = [];
  let pending: { lin: number; hal: number; nesting: number } | null = null;
  // 328 P3: kwIdx of each `while` that terminates a `do` we recorded — the ONLY
  // `while (…);` the scan may skip (a standalone empty-body `while (cond);` is a
  // real loop and must be counted).
  const doTerminators = new Set<number>();
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
          braceKinds.push(
            braceFrameKind(masked, pos, braceKinds[braceKinds.length - 1] ?? "block"),
          );
          if (pending !== null) {
            braceIsLoop.push(true);
            loopFrames.push(pending);
            pending = null;
          } else {
            braceIsLoop.push(false);
          }
        } else if (c === "}") {
          braceKinds.pop();
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
        braceKinds.push(
          braceFrameKind(masked, pos, braceKinds[braceKinds.length - 1] ?? "block"),
        );
        if (pending !== null) {
          braceIsLoop.push(true);
          loopFrames.push(pending);
          pending = null;
        } else {
          braceIsLoop.push(false);
        }
      } else if (c === "}") {
        braceKinds.pop();
        const isLoop = braceIsLoop.pop() ?? false;
        if (isLoop) loopFrames.pop();
      }
    }
    const kwEnd = kwIdx + kind.length;
    // 330 P3: `for`/`while`/`do` are legal property NAMES after `.`, so
    // `obj.for(x)` / `obj?.do(y)` are property accesses, not loops — without
    // this a module with no loops at all published O(n) (`const v = obj.for(x);`).
    // A real loop keyword is never preceded by `.`.
    let prevNc = kwIdx - 1;
    while (prevNc >= 0 && /\s/.test(masked[prevNc]!)) prevNc--;
    if (prevNc >= 0 && masked[prevNc] === ".") {
      pos = kwEnd;
      continue;
    }
    // 336-6: a class body or object literal holds only members, so a bare
    // `while`/`for`/`do` at member position names a method/accessor, not a loop
    // (`class C { while(x) {} }` / `const o = { while(x) {} }` published O(n)).
    // The `for` head-shape test below cannot cover `while`, whose `(params)` is
    // lexically identical to a condition — only the scope kind distinguishes
    // them. A class static block gets its own `block` frame, so a real loop
    // inside it still counts.
    const frameKind = braceKinds[braceKinds.length - 1];
    if (frameKind === "class" || frameKind === "object") {
      pos = kwEnd;
      continue;
    }
    // 326 L4: a real `for`/`while` head is always parenthesized (`for await (`
    // for the async form). A loop keyword the masker could not reach — a regex
    // literal in statement position, e.g. `}` then `/for/.test(x)` or
    // `if (ok) /while/.test(x)` — has no `(` after it and was counted as a
    // phantom loop, publishing O(n)/O(n^2) for a function with no loops at all.
    // `do` has no head and is left to the masker: its keyword is not
    // distinguishable this way.
    const afterKw = masked.slice(kwEnd);
    const kwGap = afterKw.match(/^\s*/)![0].length;
    const nextCh = afterKw[kwGap] ?? "";
    const forAwait = kind === "for" && masked.startsWith("await", kwEnd + kwGap);
    if ((kind === "for" || kind === "while") && nextCh !== "(" && !forAwait) {
      pos = kwEnd;
      continue;
    }
    // 328 P3 (326 L4 residual): `do` — alone among the loop keywords — has no
    // parenthesized head to key on, so a statement-position regex literal the
    // masker left as code (`/do/.test(x)` after `}` / `)`) still matched. A
    // real `do` keyword is never flanked by a regex literal's `/` delimiters.
    if (kind === "do" && (masked[kwIdx - 1] === "/" || masked[kwEnd] === "/")) {
      pos = kwEnd;
      continue;
    }
    if (kind === "do") {
      const term = doWhileTerminatorIdx(masked, kwEnd);
      if (term >= 0) doTerminators.add(term);
    }
    const bodyAt = bodyStartOf(masked, kwEnd);
    // 330 P3: a real `for` head is a `;`-clause / `of` / `in` form. A method or
    // call named `for` (`class C { for(x){} }`, `const o = { for(x){} }`,
    // `for(x)` in value position) has none of those, so it is NOT a loop — the
    // previous scan published O(n) for a class with no loops at all.
    if (kind === "for") {
      const forHead = masked.slice(kwEnd, bodyAt);
      if (!forHead.includes(";") && !/\bof\b/.test(forHead) && !/\bin\b/.test(forHead)) {
        pos = kwEnd;
        continue;
      }
    }
    // A `while` that ends in `;` is skipped ONLY when it is the terminator of a
    // `do` recorded above — a standalone `while (cond);` is a real empty-body
    // loop and is counted (328 P3: the old unconditional skip published O(1)
    // for a busy-wait loop).
    if (kind === "while" && masked[bodyAt] === ";" && doTerminators.has(kwIdx)) {
      doTerminators.delete(kwIdx);
      pos = kwEnd;
      continue;
    }
    const header = masked.slice(kwEnd, bodyAt).slice(0, 120);
    const braced = masked[bodyAt] === "{";
    const bodyHeadRaw = braced ? loopBodyHead(masked, bodyAt) : "";
    // A nested loop's own header is that loop's business — its halving step is
    // counted on ITS entry, so the shape is not a "this loop's body" note.
    const nestedKw = /\b(?:for|while|do)\b/.exec(bodyHeadRaw);
    const bodyHead = nestedKw ? bodyHeadRaw.slice(0, nestedKw.index) : bodyHeadRaw;
    // T-06 (109 C-03): the halving probe is a HEADER property. Probing the
    // body too published O(log n) for a plain linear loop whose body merely
    // contained a `0.5` literal or `x / 2` (percentages, half widths,
    // averages) — an over-optimistic class that ships inside the generated
    // benchmark artifact's header. A body-level halving shape no longer
    // changes the class; it is RECORDED and reported through `extras` so the
    // downgrade is visible instead of silent.
    const halving = HALVING_RE.test(header);
    const bodyHalving = !halving && bodyHead.length > 0 && HALVING_RE.test(bodyHead);
    const parent = loopFrames.length > 0 ? loopFrames[loopFrames.length - 1] : null;
    const lin = (parent ? parent.lin : 0) + (halving ? 0 : 1);
    const hal = (parent ? parent.hal : 0) + (halving ? 1 : 0);
    const nesting = (parent ? parent.nesting : 0) + 1;
    loops.push({ kwIdx, nesting, lin, hal, halving, bodyHalving });
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
  // Loop keywords are recorded in ascending index order, so line resolution is
  // one forward pass (T10 / 112 F6), not a rescan per loop.
  const lineRefs = linesOfIndices(source, loops.map((l) => l.kwIdx));
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
  // T-06 (109 C-03): a halving shape found ONLY in a loop body is not counted
  // (header-only rule) — the note says so instead of leaving the downgrade
  // silent. The base COMPLEXITY_CAVEAT string stays byte-stable.
  if (loops.some((l) => l.bodyHalving)) extras.push("body-level halving detected — not counted");
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
    // The embedded throw is a generated-code refusal; the code travels in the
    // caught `__compileError` text (RT_E_VALIDATION) so the failing benchmark
    // assertion names the machine class, not just the prose.
    '    () => { throw new Error("require() is not available inside benchmarked code (RT_E_VALIDATION)"); },',
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
