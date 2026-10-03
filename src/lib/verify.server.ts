// ---------------------------------------------------------------------------
// verify.server.ts — machine-run verification + DeepSeek verify-fix loop.
//
// M-04 (audit-bugs/05): the ONLY test executions in the product were the P6
// template self-test and an optional manual run of that same template. This
// module adds a real fail-to-pass loop:
//   1. generateCases() — DeepSeek (json:true) writes boolean EXPRESSIONS that
//      assert behavior of the source's exports (e.g. `add(2,3) === 5`).
//   2. runCases() — a machine harness (via node-runner.server.ts) evaluates
//      the source and each expression, printing machine-readable results.
//      The machine — never the LLM — declares pass/fail.
//   3. verifyAndFixServer() — bounded loop: fail → DeepSeek emits a patched
//      source → re-run, up to maxIterations.
//   4. E-08 (A4-b) oracle pinning: generateCases() is SEEDED with the
//      project's A7 oracle rows (a caller-rendered oracleToCaseSeeds() string
//      + the pinned ids — passed as parameters so this module never imports
//      dod.ts) and REJECTS a returned case list that drops a pinned oracle
//      id: one bounded repair retry, then an honest refusal — never a
//      machine pass on a reduced oracle. Empty seeds keep the legacy
//      generation prompt byte-for-byte (fixes/159 F3).
//   5. 216i (112 §4.1/§4.3 — T1/T2): every L3 lesson this seam mints goes
//      through the counterexample-or-nothing gate. With ≥1 anchor (the
//      failing machine-case ids runCases() reported) the row's id hashes the
//      216g signature, so a recurring failure maps to ONE row; with NO anchor
//      the mint REFUSES — no row, and the visible `lessonRefused` envelope
//      (`lesson.refused`) rides the outcome for the consumer (verify.ts
//      applyVerifyOutcome) to append to project.logs.
//
// Honesty contract: status "passed" is minted ONLY from a real runner pass;
// "not-configured" when no DeepSeek key; every exit carries evidence text.
// The harness uses `with(exports)` so expressions reference exported names,
// supports BOTH CommonJS export styles (`exports.x = …` and
// `module.exports = { … }` — 109 C-07), and refuses to declare a pass when
// the compiled module exposes no callable name at all (109 C-01: machine
// verification must never be vacuous).
// ---------------------------------------------------------------------------
import { isDeepSeekConfigured } from "./deepseek.server.ts";
import { callModel } from "./llm/providers/registry.ts";
// T-107.6 (A3 · D2.3 · 226 A3): the budget catch wrapper — a budget stop is
// this seam's coded refusal (RT_E_BUDGET_EXHAUSTED), never an unhandled throw
// an outer catch would classify RT_E_INTERNAL.
import { isBudgetStopRefusal, runBudgetedCall } from "./token-ledger.ts";
import type { TokenBudget } from "./token-ledger.ts";
import { countLooseEquals, stripStringsAndComments } from "./bench.ts";
import { briefNounHits, identifierHits } from "./sandbox.ts";
import { failureLessonFromRecord, verifyOutcomeLesson } from "./knowledge.ts";
import type { ErrorCode } from "./errors.ts";
import type { JsonLog, MemoryEntry } from "./types.ts";
// 339-1: the P6 prompt mandates fully-typed TypeScript (rule 10), but the
// harness compiles __SRC with the JS-only `new Function`. Strip the types on
// the PARENT side (Node builtin, present on both required runtimes) before the
// source is embedded, so the child needs no new API.
import { stripTypeScriptTypes } from "node:module";

export type VerifyCase = { id: string; expression: string };

/**
 * Lint-advisory finding (Pillar 4 extension, B4). ADVISORY ONLY — findings
 * never block or weaken a machine pass; they are appended to the evidence so
 * the human (or a later cleanup pass) sees the linter-adjacent smell the
 * oracle cases cannot express. See lintFailures() below.
 */
export type LintFailure = {
  rule: "no-console" | "no-var" | "eqeqeq";
  severity: "warning";
  occurrences: number;
  firstLine: number | null;
  message: string;
};

export type VerifyOutcome = {
  status: "passed" | "failed" | "not-configured" | "error";
  iterations: number;
  evidence: string;
  finalSource?: string;
  cases?: VerifyCase[];
  /** Non-empty only when the final source triggered lintFailures() findings. */
  lint?: LintFailure[];
  /** L3 (failed/error) or L4 (passed) lesson row minted at the outcome point
   *  (fixes/98 §2.3 writer 2(c)/3). Absent on not-configured. The consumer
   *  appends it to project memory idempotently. 216i (112 T1/T2): the L3 row
   *  is minted through the §4.3 record gate — anchored to the failing
   *  machine-case ids, so its id hashes the 216g signature (ONE row per
   *  recurring failure). Never present together with `lessonRefused`. */
  lesson?: MemoryEntry;
  /** 216i (112 §4.3 — T2): the counterexample-or-nothing refusal envelope.
   *  Present INSTEAD of `lesson` when the L3 mint had no anchor to prove the
   *  failure with (an oracle-generation refusal before any case ran): NO row
   *  is minted, and `log` is the visible `lesson.refused` ledger payload the
   *  consumer appends to project.logs — never a silent no-op (112 §2.4). */
  lessonRefused?: LessonRefusal;
};

/**
 * 216i (112 §4.3 — T2): the refusal half of the counterexample-or-nothing
 * gate, verbatim from knowledge.failureLessonFromRecord. `signature` is the
 * 216g signature the refused row WOULD have hashed; `reason` names the missing
 * proof; `code` is the RT_E class of the refusal.
 */
export type LessonRefusal = {
  verdict: "refuse:no-proof";
  reason: string;
  code: ErrorCode;
  signature: string;
  log: { level: JsonLog["level"]; event: "lesson.refused"; detail: string };
};

const MAX_ITERATIONS = 3;

export type OracleExpressionCheck =
  | { ok: true; expression: string }
  | { ok: false; reason: string };

/**
 * 339-1: keywords and literals that can occupy a VALUE position in a case
 * expression without naming a binding — never undefined-identifier offenders.
 * Kept LITERAL and auditable (a computed `globalThis` walk would accept any
 * global, the thing the pinned allowlist exists to prevent).
 */
const ORACLE_CASE_LITERAL_WORDS: ReadonlySet<string> = new Set([
  "true", "false", "null", "undefined", "this", "new", "typeof", "void",
  "delete", "in", "instanceof", "of",
]);

/**
 * 339-1: the names a `const`/`let`/`var` declaration statement BINDS. Parses the
 * declarator list at top level (outside strings/brackets), taking every
 * identifier on each declarator's left of `=` — a simple identifier (`const a`)
 * or a whole destructuring pattern (`const { x, y } = o`, `const [p] = a`). A
 * pattern contributes every identifier token (keys included), so the result is
 * a SUPERSET of the real bindings; over-collecting can only make a later
 * rejected read report the "declarations are not executed" reason instead of a
 * ReferenceError — it can never under-report a bound name and let a discarded
 * binding read slip through. Pure; never throws.
 */
function declaredNames(statement: string): string[] {
  const m = /^(?:const|let|var)\b([\s\S]*)$/.exec(statement);
  if (!m) return [];
  const names: string[] = [];
  let cur = "";
  let collecting = true;
  let depth = 0;
  let state: "normal" | "sq" | "dq" | "template" = "normal";
  const flush = () => {
    for (const t of cur.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
      if (!ORACLE_CASE_LITERAL_WORDS.has(t[0])) names.push(t[0]);
    }
    cur = "";
  };
  const body = m[1];
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    const next = body[i + 1];
    if (state !== "normal") {
      if (ch === "\\" && next !== undefined) i++;
      else if (
        (state === "sq" && ch === "'") ||
        (state === "dq" && ch === '"') ||
        (state === "template" && ch === "`")
      ) {
        state = "normal";
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      state = ch === "'" ? "sq" : ch === '"' ? "dq" : "template";
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      if (collecting) cur += ch;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      if (collecting) cur += ch;
      continue;
    }
    // A top-level `,` starts the next declarator; a top-level `=` ends the
    // current declarator's binding pattern and begins its (unexecuted)
    // initializer, which contributes no bindings.
    if (depth === 0 && ch === ",") {
      if (collecting) flush();
      collecting = true;
      continue;
    }
    if (depth === 0 && ch === "=" && collecting) {
      flush();
      collecting = false;
      continue;
    }
    if (collecting) cur += ch;
  }
  if (collecting) flush();
  return [...new Set(names)];
}

/**
 * 339-1: the quote-aware `declaration(s); final-boolean` repair, shared in
 * spirit with parseOracleCases' split. `src` is split into top-level
 * statements on `;` or a line terminator OUTSIDE string literals, comments and
 * brackets; the FINAL statement plus the names the declaration prefix BINDS
 * (`declaredNames`) are returned ONLY when every preceding statement is a
 * `const`/`let`/`var` declaration. Any other multi-statement shape (including
 * `a; b` and a bare expression before another statement) returns null, so the
 * strict scan below still rejects it — this can never smuggle a statement past
 * the gate. The declarations are NEVER executed, so a final boolean that reads
 * a bound name is refused by the caller with a precise reason (rather than
 * throwing `ReferenceError` at machine-run time). Pure; never throws.
 */
function splitDeclarationPrefix(src: string): { final: string; bound: string[] } | null {
  const parts: string[] = [];
  let cur = "";
  let state: "normal" | "sq" | "dq" | "template" | "line" | "block" = "normal";
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (state === "sq" || state === "dq" || state === "template") {
      cur += ch;
      if (ch === "\\" && next !== undefined) {
        cur += next;
        i++;
      } else if (
        (state === "sq" && ch === "'") ||
        (state === "dq" && ch === '"') ||
        (state === "template" && ch === "`")
      ) {
        state = "normal";
      }
      continue;
    }
    if (state === "line") {
      if (ch === "\n" || ch === "\r") {
        state = "normal";
        parts.push(cur);
        cur = "";
      }
      continue;
    }
    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "normal";
        i++;
      }
      continue;
    }
    if (ch === "'") {
      state = "sq";
      cur += ch;
      continue;
    }
    if (ch === '"') {
      state = "dq";
      cur += ch;
      continue;
    }
    if (ch === "`") {
      state = "template";
      cur += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      state = "line";
      continue;
    }
    if (ch === "/" && next === "*") {
      state = "block";
      i++;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      cur += ch;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      cur += ch;
      continue;
    }
    if (
      depth === 0 &&
      (ch === ";" || ch === "\n" || ch === "\r" || ch === "\u2028" || ch === "\u2029")
    ) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  const segments = parts.map((s) => s.trim()).filter((s) => s.length > 0);
  if (segments.length < 2) return null;
  const bound: string[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    if (!/^(?:const|let|var)\b/.test(segments[i])) return null;
    for (const n of declaredNames(segments[i])) if (!bound.includes(n)) bound.push(n);
  }
  return { final: segments[segments.length - 1], bound };
}

/**
 * Validate + sanitize one oracle expression BEFORE it is spliced into the
 * harness (`with(exports){ return (E); }`).
 *
 * ACCEPTED GRAMMAR (339-1 — aligned with what the oracle prompt asks for; see
 * buildOracleCasesPrompt below and the P6 synthesis prompt in
 * codegen.server.ts): exactly ONE of
 *   (a) a single JS boolean expression over the module's exported callables —
 *       `computeMean(nums) === 2`, `typeof buildPlan === 'function'`; or
 *   (b) the tolerated repair form `declaration(s); final-boolean` — one or
 *       more `const`/`let`/`var` statements followed by a final boolean
 *       expression, separated by `;` or a line terminator. The declarations
 *       are DISCARDED (they never execute; see the honest-scope note) and the
 *       final expression alone is spliced into the harness. A final boolean
 *       that READS a name its discarded prefix bound is REFUSED up front
 *       ("declarations are not executed — rewrite as ONE expression") rather
 *       than accepted and then throwing `ReferenceError` at run time.
 * Everything else is REJECTED: any non-declaration multi-statement payload
 * (`a; b`), a mid-expression `;`, an embedded backtick/template literal,
 * unterminated/unbalanced `()`/`[]`/`{}`, comment smuggling, stray bare
 * assignments/arrows/shift-assignments, a top-level comma operator, and the
 * named keyword escape hatches (function/eval/globals + `constructor`/
 * `prototype`/`__proto__` — 109 C-05).
 *
 * HONEST SCOPE (fixes/216a, 109 C-05): this is a STATEMENT-FORM gate, NOT a
 * sandbox. It stops a hostile reply from splicing its own statements into the
 * return-expression context; it does not make case expressions inert, and a
 * text-level guard can only reject the shapes it names. Execution bounds
 * (wall-clock timeout, output caps, scrubbed child env) live in
 * `node-runner.server.ts` — which is bounded, not isolated — and the module
 * under test already runs with full globals in that same child process.
 * Characters inside string literals are data and pass through untouched.
 * (The `declaration(s)` prefix of form (b) is likewise never executed, so the
 * prefix's bound names are tracked and a final boolean that reads one is
 * refused HERE with a precise reason — never accepted and then failed at run
 * time with a `ReferenceError`.)
 * Pure — never throws.
 */
export function sanitizeOracleExpression(raw: unknown): OracleExpressionCheck {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, reason: "expression must be a non-empty string" };
  }
  // Tolerate exactly ONE trailing statement terminator — a no-op outside the
  // wrapper parens that LLM oracles routinely emit (`expr;`). Any remaining
  // `;` (a real statement separator) is still rejected by the scan below.
  const withoutTerminator = raw.replace(/;\s*$/, "");
  // 339-1: the tolerated `declaration(s); final-boolean` repair — keep only
  // the final statement when everything before it is a declaration, and hold
  // on to the names that prefix BINDS (they are never executed).
  const split = splitDeclarationPrefix(withoutTerminator);
  const src = split?.final ?? withoutTerminator;
  let out = "";
  let state: "normal" | "sq" | "dq" | "line" | "block" = "normal";
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (state === "sq") {
      out += ch;
      if (ch === "\\" && next !== undefined) {
        out += next;
        i++;
      } else if (ch === "'") state = "normal";
      continue;
    }
    if (state === "dq") {
      out += ch;
      if (ch === "\\" && next !== undefined) {
        out += next;
        i++;
      } else if (ch === '"') state = "normal";
      continue;
    }
    if (state === "line") {
      if (ch === "\n" || ch === "\r") {
        state = "normal";
        out += " ";
      }
      continue;
    }
    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "normal";
        i++;
        out += " ";
      }
      continue;
    }
    // normal state
    if (ch === "'") {
      state = "sq";
      out += ch;
      continue;
    }
    if (ch === '"') {
      state = "dq";
      out += ch;
      continue;
    }
    if (ch === "`") return { ok: false, reason: "template literals are not allowed" };
    if (ch === ";") return { ok: false, reason: "statement separator ';' is not allowed" };
    // Assignment/arrow detection: `=` is allowed only as part of a comparison
    // (`==`, `===`, `!=`, `!==`, `<=`, `>=`); `=>` arrows, bare `=` and the
    // shift-assignments are statement-level and rejected.
    if (ch === "=") {
      const prev = i > 0 ? src[i - 1] : "";
      // 109 C-04: an arrow's `=` is ALWAYS followed by `>` in every real
      // spelling (`a => b`, `(a) => b`); the old `prev === "=" && next === ">"`
      // test could never describe one and is gone.
      if (next === ">") return { ok: false, reason: "arrow functions are not allowed" };
      // 109 C-04: `>>=`, `<<=`, `>>>=` were slipping through the `>=`/`<=`
      // exemption (`prev` ∈ {"<", ">"}) as "not assignments" — reject them
      // explicitly before the comparison exemption is consulted.
      if (/(?:<<|>>|>>>)=$/.test(src.slice(Math.max(0, i - 3), i + 1))) {
        return { ok: false, reason: "assignment is not allowed" };
      }
      if (
        next !== "=" &&
        prev !== "=" &&
        prev !== "!" &&
        prev !== "<" &&
        prev !== ">"
      ) {
        return { ok: false, reason: "assignment is not allowed" };
      }
    }
    // Comma at depth 0 is the comma operator (statement-level) — reject.
    if (ch === "," && depth === 0) return { ok: false, reason: "comma operator is not allowed" };
    if (ch === "/" && next === "/") {
      state = "line";
      continue;
    }
    if (ch === "/" && next === "*") {
      state = "block";
      i++;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      out += ch;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      if (depth < 0) return { ok: false, reason: `unbalanced '${ch}'` };
      out += ch;
      continue;
    }
    // Line terminators outside strings could start a second statement via
    // ASI once the wrapper paren is closed — collapse them to a space.
    if (ch === "\n" || ch === "\r" || ch === "\t" || ch === "\u2028" || ch === "\u2029") {
      out += " ";
      continue;
    }
    out += ch;
  }
  if (state === "sq") return { ok: false, reason: "unterminated single-quoted string" };
  if (state === "dq") return { ok: false, reason: "unterminated double-quoted string" };
  if (state === "block") return { ok: false, reason: "unterminated block comment" };
  if (depth !== 0) return { ok: false, reason: "unbalanced delimiters" };
  const expression = out.trim();
  // A raw ";" is stripped as the tolerated single trailing terminator, which
  // would otherwise leave an EMPTY accepted expression — an oracle that evals
  // to nothing must fail here, not silently pass the sanitizer.
  if (!expression) return { ok: false, reason: "expression is empty after cleanup" };
  // Keyword-level escapes: any of these can smuggle statements/globals into
  // the return-expression context and are rejected outright (audit-39 1.1).
  // Scanned over the string-stripped form so literal text like 'function'
  // inside a data string never trips it. 109 C-05: `constructor`/`prototype`/
  // `__proto__` are on the list because `[].constructor.constructor(...)()`
  // reconstructs `Function` from a blank-slate value and reaches globals —
  // name-based, so it is a hatch-closer, not a proof (see the honest-scope
  // note on this function).
  if (
    /\b(?:function|class|new\s+Function|eval|require|process|globalThis|console|import|export|yield|constructor|prototype|__proto__)\b/.test(
      stripStringsAndComments(expression),
    )
  ) {
    return { ok: false, reason: "disallowed construct (function/eval/global access)" };
  }
  // 339-1: the declaration prefix of form (b) never executes, so a final
  // boolean that READS a name the prefix bound can only throw
  // `ReferenceError: <name> is not defined` at machine-run time. Refuse it
  // HERE, up front, with a reason that says exactly how to repair it.
  if (split && split.bound.length > 0) {
    const bound = new Set(split.bound);
    for (const name of referenceIdentifiers(stripStringsAndComments(expression))) {
      if (bound.has(name)) {
        return { ok: false, reason: "declarations are not executed — rewrite as ONE expression" };
      }
    }
  }
  return { ok: true, expression };
}

export type OracleCasesParse =
  | { ok: true; cases: VerifyCase[] }
  | { ok: false; reason: "empty" | "unparseable" };

/**
 * Discriminating parse of a DeepSeek case reply.
 *
 * fixes/328 P3 (register: the 327 lane owed this pin, fixes/257 §OV-13): the
 * legacy `VerifyCase[] | null` return collapses two DIFFERENT outcomes — a
 * well-formed reply whose `cases` array is empty (the model answered, with no
 * cases) and a malformed reply the parser could not decode. generateCases'
 * repair prompt then tells an empty-but-VALID reply it "was not valid JSON"
 * (a false statement to the model) and no caller can branch on the difference.
 *
 * "unparseable" = no case array could be decoded at all (non-string, bad JSON,
 * missing / wrong-typed `cases`). "empty" = a case array decoded but produced
 * ZERO usable rows (an explicitly empty array, or every row skipped for a
 * missing id/expression). `ok: true` always carries ≥1 case.
 */
export function parseOracleCases(text: string): OracleCasesParse {
  if (typeof text !== "string") return { ok: false, reason: "unparseable" };
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    return { ok: false, reason: "unparseable" };
  }
  const arr =
    obj && typeof obj === "object" && !Array.isArray(obj)
      ? (obj as Record<string, unknown>).cases
      : obj;
  if (!Array.isArray(arr)) return { ok: false, reason: "unparseable" };
  const cases: VerifyCase[] = [];
  for (const c of arr) {
    if (c && typeof c === "object") {
      const rec = c as Record<string, unknown>;
      const id = typeof rec.id === "string" ? rec.id : "";
      const rawExpr =
        typeof rec.expression === "string"
          ? rec.expression
          : typeof rec.assert === "string"
            ? rec.assert
            : "";
      // Defensive repair: LLM oracles occasionally emit a declaration plus a
      // final boolean (`const spec = {...}; synthesize(spec).ok === true`).
      // Take the FINAL statement — the rest is rejected by the sanitizer's
      // mid-expression `;` rule anyway, so this never weakens the gate.
      // Split on `;` ONLY outside string literals (quote-aware).
      const parts: string[] = [];
      let cur = "";
      let q: "'" | '"' | null = null;
      let esc = false;
      for (const ch of rawExpr) {
        if (q) {
          cur += ch;
          if (esc) { esc = false; continue; }
          if (ch === "\\") { esc = true; continue; }
          if (ch === q) q = null;
          continue;
        }
        if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
        if (ch === ";") { parts.push(cur); cur = ""; continue; }
        cur += ch;
      }
      parts.push(cur);
      const tail = parts.pop() ?? "";
      const expression = tail.trim();
      if (id && expression) cases.push({ id, expression });
    }
  }
  return cases.length > 0 ? { ok: true, cases } : { ok: false, reason: "empty" };
}

/**
 * Parse a DeepSeek JSON reply into verification cases. Tolerant of fences.
 *
 * Legacy contract kept byte-stable (existing callers/tests branch on
 * `=== null`): delegates to parseOracleCases() and flattens BOTH failure
 * reasons to null. Callers that must react differently to an empty-but-valid
 * reply (fixes/328 P3) use parseOracleCases() directly.
 */
export function parseOracleJson(text: string): VerifyCase[] | null {
  const parsed = parseOracleCases(text);
  return parsed.ok ? parsed.cases : null;
}

// ---------------------------------------------------------------------------
// Pillar 4 (B4): lintFailures() — linter-adjacent heuristics over a generated
// module (console.log leakage, `var`, loose `==`). Pure and deterministic;
// ADVISORY ONLY. Findings NEVER gate a machine pass: verifyAndFixServer()
// appends them to the evidence (and the outcome's `lint` field) and keeps the
// test-and-repair loop as the ONLY repair mechanism — a source with lint
// findings can still earn status "passed" if the machine-run cases pass, and
// the evidence says so explicitly. Regexes run over stripStringsAndComments()
// output (shared with bench.ts) so strings/comments cannot false-positive;
// `==` counting excludes === and !==.
// ---------------------------------------------------------------------------
function lineAt(text: string, index: number): number {
  let line = 1;
  const end = Math.min(index, text.length);
  for (let i = 0; i < end; i++) if (text[i] === "\n") line++;
  return line;
}

function firstLooseEqualsIndex(text: string): number | null {
  for (let i = 0; i < text.length - 1; i++) {
    if (
      text[i] === "=" &&
      text[i + 1] === "=" &&
      text[i - 1] !== "=" &&
      text[i - 1] !== "!" &&
      text[i + 2] !== "="
    ) {
      return i;
    }
  }
  return null;
}

export function lintFailures(source: unknown): LintFailure[] {
  if (typeof source !== "string" || !source.trim()) return [];
  const scrubbed = stripStringsAndComments(source);
  const out: LintFailure[] = [];
  const consoleMatches = [...scrubbed.matchAll(/\bconsole\s*\.\s*(?:log|debug|info|warn|error|trace)\s*\(/g)];
  if (consoleMatches.length > 0) {
    const first = consoleMatches[0].index;
    out.push({
      rule: "no-console",
      severity: "warning",
      occurrences: consoleMatches.length,
      firstLine: lineAt(source, first),
      message:
        "console.* call(s) in the module pollute the machine runner's stdout and leak debug output — remove them",
    });
  }
  const varMatches = [...scrubbed.matchAll(/\bvar\s+[A-Za-z_$][A-Za-z0-9_$]*/g)];
  if (varMatches.length > 0) {
    out.push({
      rule: "no-var",
      severity: "warning",
      occurrences: varMatches.length,
      firstLine: lineAt(source, varMatches[0].index),
      message: "`var` declaration(s) — prefer const/let (block-scoped)",
    });
  }
  const loose = countLooseEquals(scrubbed);
  if (loose > 0) {
    const firstLoose = firstLooseEqualsIndex(scrubbed);
    out.push({
      rule: "eqeqeq",
      severity: "warning",
      occurrences: loose,
      firstLine: firstLoose !== null ? lineAt(source, firstLoose) : null,
      message: "loose equality == used — strict === is the house style (the oracle harness uses ===)",
    });
  }
  return out;
}

function formatLintSummary(findings: LintFailure[]): string {
  return findings.map((f) => `${f.rule} x${f.occurrences}`).join("; ");
}

/**
 * 339-1 (oracle-harness): remove TypeScript type syntax from a module before it
 * is embedded in the harness. The P6 prompt (codegen.server.ts `p6SynthesisSystemPrompt`
 * rule 10 + its worked example) mandates FULLY-TYPED functions, but the harness
 * compiles __SRC with `new Function` — a JS-only parser — so an unstripped typed
 * module throws `SyntaxError: Unexpected token ':'`, leaves __exports empty, and
 * every oracle case then dies (`ReferenceError: <name> is not defined`) or
 * returns false. The run can therefore never pass and p6-verified never mints.
 *
 * PARSE-FIRST (339-1 resume #3): a source the JS parser ACCEPTS is returned
 * byte-identical and run VERBATIM — never re-parsed as TypeScript. The TS parser
 * reads `const g = f(a < b, c > (d));` (valid JS: `f((a<b), (c>d))`) as a
 * generic argument list and rewrites the bytes to `f(a          (d))`, a silent
 * semantic change the harness would then run instead of the module. Only a
 * source the JS parser REFUSES (TS annotations, enums, …) is handed to the
 * stripper, and a stripper failure still falls back to the RAW bytes so the
 * harness's existing honest `HARNESS_COMPILE fail` path reports it — never a
 * silent pass, and never a refusal earlier than the harness itself.
 *
 * RESIDUAL, named not hidden: `new Function` also refuses a valid-JS MODULE
 * body (`import`/`export` syntax, top-level `await`), so those still reach the
 * stripper, which CAN rewrite them — e.g. `export const g = f(a < b, c > (d));`
 * comes back as `export const g = f(a          (d));`. That is not a false pass:
 * the child harness compiles __SRC with the SAME `new Function`, so a source
 * this guard refused can never run there either, never a mutation pass. 340-3:
 * `runCases` now names the cause for statement-level `import`/`export` up front
 * (`esmModuleUnsupportedReason` → ESM_MODULE_UNSUPPORTED_REASON); a top-level
 * `await` (no ESM statement) still reaches the harness's honest
 * `source failed to compile in the harness` marker. The byte-identical
 * guarantee covers exactly the sources the JS parser accepts.
 */
export function stripTypeAnnotationsForHarness(source: string): string {
  try {
    // Body-parse only — never invoked. A source the JS parser accepts is run
    // verbatim; only a source it rejects is TypeScript-stripped.
    new Function(source);
    return source;
  } catch {
    try {
      return stripTypeScriptTypes(source, { mode: "strip" });
    } catch {
      return source;
    }
  }
}

function buildHarness(source: string, cases: VerifyCase[]): string {
  const __src = stripTypeAnnotationsForHarness(source);
  return [
    "// rapidtool verify harness (machine-authored; do not trust the LLM's claims)",
    // 344 A2-F1: the WHOLE harness is an IIFE. Its bindings (notably the
    // per-run nonce) must not become global-lexical names — a `new Function`
    // module body resolves against the global scope and could otherwise read
    // them. The nonce is read from stdin (out-of-band; it is not in the `-e`
    // source that leaks via process.execArgv, and not in the child env), so a
    // module that writes lookalike lines to fd 3 cannot authenticate them.
    "(function () {",
    "var __fs = require('node:fs');",
    // Capture the real write BEFORE the module runs, so a module that swaps
    // fs.writeSync to harvest the nonce cannot intercept the harness's writes.
    "var __write = __fs.writeSync.bind(__fs);",
    "var __Function = Function;",
    "var __keys = Object.keys;",
    "var __nonce = '';",
    "try { __nonce = String(__fs.readFileSync(0, 'utf8')).trim(); } catch (e) { __nonce = ''; }",
    // Verdict lines go ONLY to fd 3, prefixed with the nonce. The `console`
    // global is left untouched so the module's own output stays ordinary
    // non-authoritative stdout detail.
    "var __emit = function (line) { try { __write(3, __nonce + ' ' + line + '\\n'); } catch (e) {} };",
    `var __SRC = ${JSON.stringify(__src)};`,
    `var __CASES = ${JSON.stringify(cases)};`,
    "var __exports = {};",
    "var __sandbox = Object.freeze({ console: Object.freeze({ log: function(){}, error: function(){}, warn: function(){}, info: function(){}, debug: function(){}, trace: function(){} }) });",
    "try {",
    "  var __fn = new __Function('exports', 'module', 'require', __SRC + '\\n; return exports;');",
    "  var __mod = { exports: __exports };",
    "  __fn(__exports, __mod, function () {});",
    // T-05 (109 C-07): the `module` parameter is no longer a decoy. The far
    // more common `module.exports = { … }` style reassigns the property on
    // this object; fold its keys back onto __exports so BOTH CommonJS styles
    // expose the API to the `with(exports)` case scope (an `exports.x =`
    // module leaves __mod.exports === __exports and the fold is a no-op).
    // `__keys` is the pre-module captured Object.keys (prototype-tamper proof).
    "  if (__mod.exports && __mod.exports !== __exports) { var __mk = __keys(__mod.exports); for (var __mi = 0; __mi < __mk.length; __mi++) __exports[__mk[__mi]] = __mod.exports[__mk[__mi]]; }",
    // T-01 (109 C-01): the runner's OWN export inventory, measured from what
    // actually compiled — it cannot lie about the module. runCases refuses to
    // mint a pass when this list is empty: nothing in a case is required to
    // reference an export, so a self-contained literal could otherwise be
    // "machine-verified" against a module that exports nothing at all.
    "  var __names = [];",
    "  var __ks = __keys(__exports);",
    "  for (var __ki = 0; __ki < __ks.length; __ki++) { if (typeof __exports[__ks[__ki]] === 'function') __names.push(__ks[__ki]); }",
    "  var __joined = '';",
    "  for (var __ji = 0; __ji < __names.length; __ji++) { if (__ji > 0) __joined += ','; __joined += __names[__ji]; }",
    "  __emit('HARNESS_EXPORTS ' + __joined);",
    "  __emit('HARNESS_COMPILE pass');",
    "} catch (e) {",
    "  __emit('HARNESS_COMPILE fail ' + String(e).slice(0, 120));",
    "}",
    "for (var __ci = 0; __ci < __CASES.length; __ci++) {",
    "  var c = __CASES[__ci];",
    "  try {",
    "    var v = new __Function('exports', '__sandbox', 'with(exports){ with(__sandbox){ return (' + c.expression + '); } }')(__exports, __sandbox);",
    "    __emit('ORACLE_RESULT ' + c.id + ' ' + (v === true ? 'pass' : 'fail') + ' ' + String(v).slice(0, 80));",
    "  } catch (e) {",
    "    __emit('ORACLE_RESULT ' + c.id + ' fail error ' + String(e).slice(0, 80));",
    "  }",
    "}",
    "})();",
  ].join("\n");
}

export type CaseResult = { id: string; pass: boolean; detail: string };

/**
 * T-01 (109 C-01): the honest reason a run is refused when the compiled module
 * offers no callable export. Nothing in a case is required to reference an
 * export, so without this gate a self-contained literal could mint a
 * "machine-verified" pass for a module that was never called — the one shape
 * the honesty contract cannot allow. Exported so callers/tests can pin it.
 */
export const NO_CALLABLE_EXPORTS_REASON =
  "module exports no callable names — machine verification is vacuous";

/**
 * 346 E1 (L2-X4): the honest reason a run is refused when the authenticated
 * verdict channel delivered NOTHING (no `HARNESS_EXPORTS`, no
 * `HARNESS_COMPILE`) — a runner/fd-3/nonce failure, NOT a module defect. The
 * old path fell through to `callables === ""` and mislabeled the channel
 * failure `NO_CALLABLE_EXPORTS_REASON`, blaming the module for the runner's
 * failure (AGENTS.md contract #4: every surfaced failure carries its own code).
 * Exported so callers/tests can pin it.
 */
export const VERDICT_CHANNEL_FAILED_REASON =
  "verdict channel produced no authenticated evidence — the bounded runner's fd-3/nonce channel failed, so the module's behavior was never judged (RT_E_RUNNER_FAILED)";

/**
 * 346 E1 (L2-X4): did the authenticated verdict channel deliver nothing at all?
 * `HARNESS_EXPORTS` (module compiled) or `HARNESS_COMPILE fail` (compile threw)
 * is emitted on every healthy run — their absence means the channel itself
 * failed, not that the module has no callable exports. Pure.
 */
export function verdictChannelFailed(sawExports: boolean, sawCompile: boolean): boolean {
  return !sawExports && !sawCompile;
}

/**
 * fixes/328 P3 (109 C-01 intersection half, owed by the 327 lane's N-4): the
 * honest reason a run is refused when the module HAS callable exports but no
 * case ever references one. The callable-inventory gate above proves the
 * module offers an API; nothing yet proved a case touches it, so a vocabulary-free
 * brief's literal-only case set (`1 === 1`, `({board:1}).board === 1`) could
 * still mint a "machine-verified" pass against a module it never evaluates. The
 * prompt's own allowed forms (`add(2,3) === 5`, `typeof buildPlan === 'function'`)
 * both NAME an export in a VALUE position, so requiring one such reference
 * closes the vacuity hole without rejecting the prompt's allowed forms.
 *
 * fixes/330 P3 (109 C-01, the 328 P3 gate's own residual): the first cut
 * scanned EVERY identifier token, so a data-only mention of the export name —
 * an object-literal KEY (`({add: 1}).add === 1`) or a regex literal's content
 * (`({r: /add/})`) — satisfied the gate while the module was never touched,
 * re-opening C-01 one layer down. The gate now requires a VALUE-position read
 * (`referenceIdentifiers`), which an object key / property access / regex
 * content is not.
 */
export const NO_EXPORT_REFERENCE_REASON =
  "no oracle case references an exported callable name — machine verification is vacuous";

/**
 * 340-3: the honest coded refusal for a module the CommonJS harness cannot
 * execute. `buildHarness` compiles __SRC with `new Function` (a JS function
 * body), so a static `import`/`export` statement is a SyntaxError there — and
 * the manual headless seam (headless.verifyGeneratedSource) feeds a materialized
 * ESM tree ENTRY (a barrel of `export * from "./generated/chunk-N.ts"` lines)
 * straight into runCases. No in-process transform can bind that barrel
 * honestly: its re-export targets are not part of `generatedSource`, so
 * lowering it would require inventing the sibling modules it cannot see. The
 * refusal names the real cause instead of the opaque "source failed to compile
 * in the harness". RT_E_RUNNER_FAILED is the runner-family code (errors.ts).
 */
export const ESM_MODULE_UNSUPPORTED_REASON =
  "module uses ES-module import/export syntax — the bounded CommonJS harness (new Function) cannot execute it (RT_E_RUNNER_FAILED); verify a materialized tree with the tree-run path, not the single-module harness";

/**
 * 340-3: statement-level ESM syntax in `code` (already stripped of strings and
 * comments, which keeps a data mention like 'export default' inert). Anchored
 * at a statement boundary (`^` line start, or after `;`/`{`/`}`) so a regex
 * literal (`/= import x/`) or an object-literal key (`{ export: 1 }`) is NOT
 * mistaken for module syntax, and `exports.x =` / `module.exports` are never
 * flagged. Dynamic `import(...)` is legal CommonJS and is excluded.
 */
const ESM_STATEMENT_RE =
  /(?:^|[;{}])\s*(?:export\s*(?:\{|\*|default\b|(?:async\s+)?function\b|class\b|const\b|let\b|var\b)|import\s*(?!\())/m;

/**
 * 340-3: the honest refusal reason when `source` is an ES module the harness
 * cannot run, else null. The gate is the harness's OWN compiler: the exact
 * bytes `buildHarness` would embed (after stripTypeAnnotationsForHarness) are
 * parsed with `new Function` first, so a module the harness CAN run — including
 * a typed TypeScript CJS module, which the stripper lowers — is never flagged;
 * only a non-compilable source that also carries statement-level ESM syntax is
 * refused. Pure; never throws.
 */
export function esmModuleUnsupportedReason(source: string): string | null {
  if (typeof source !== "string" || !source.trim()) return null;
  const harnessSource = stripTypeAnnotationsForHarness(source);
  try {
    new Function(harnessSource);
    return null; // the harness compiles it — never an ESM refusal
  } catch {
    // Not compilable as a function body; ESM syntax below names the cause.
  }
  return ESM_STATEMENT_RE.test(stripStringsAndComments(harnessSource))
    ? ESM_MODULE_UNSUPPORTED_REASON
    : null;
}

/** The case id at `index`, with runCases' own `case-N` fallback. Pure. */
function caseIdAt(cases: readonly unknown[], index: number): string {
  const c = cases[index];
  const rec = c && typeof c === "object" ? (c as Record<string, unknown>) : null;
  return rec && typeof rec.id === "string" && rec.id ? rec.id : `case-${index + 1}`;
}

/**
 * 339-1 operator-visibility bounds. The sanitizer's own `reason` is a fixed
 * short string and is NEVER truncated by the cap — only the optional rejected
 * expression excerpt is bounded (and dropped if it would not fit), so a
 * refusal row always names which case and why. The cap is documented here so
 * the invariant is auditable.
 */
export const REJECTION_DETAIL_MAX_CHARS = 240;
/** Cap on the rejected expression excerpt inside a rejection detail row. */
export const REJECTION_EXPR_EXCERPT_MAX_CHARS = 100;

/**
 * 339-1: build one rejection detail row. `prefix` distinguishes the offending
 * case from the cases that were not run; `reason` is the sanitizer's own
 * string (never cut); `rejectedId` names the offending case for every row.
 * Pure; never throws.
 */
function rejectionDetail(
  prefix: string,
  reason: string,
  rejectedId: string,
  expression: unknown,
): string {
  const head = `${prefix} — ${reason} (case: ${rejectedId})`;
  const raw = typeof expression === "string" ? expression : "";
  const excerpt = raw.replace(/\s+/g, " ").trim().slice(0, REJECTION_EXPR_EXCERPT_MAX_CHARS);
  if (!excerpt) return head;
  const suffix = ` (expression: “${excerpt}${raw.length > REJECTION_EXPR_EXCERPT_MAX_CHARS ? "…" : ""}”)`;
  if (head.length + suffix.length > REJECTION_DETAIL_MAX_CHARS) return head;
  return head + suffix;
}

export async function runCases(
  source: string,
  cases: VerifyCase[],
  timeoutMs = 15_000,
): Promise<{ pass: boolean; results: CaseResult[]; compileError?: string }> {
  // Guards run BEFORE any execution. A machine pass may never be minted from
  // zero cases (vacuous truth), and a payload whose expressions can break out
  // of the harness's single-expression context is refused, never executed —
  // hostile expressions could otherwise print forged ORACLE_RESULT lines.
  if (!Array.isArray(cases) || cases.length === 0) {
    return { pass: false, results: [], compileError: "no cases to run" };
  }
  // 340-3: a module the CommonJS harness cannot compile is refused up front with
  // the real cause (ESM import/export), never the opaque compile-fail marker —
  // the headless seam can hand runCases a materialized ESM tree entry.
  const esmReason = esmModuleUnsupportedReason(source);
  if (esmReason !== null) {
    return { pass: false, results: [], compileError: esmReason };
  }
  const validated: { id: string; expression: string }[] = [];
  let rejection: { index: number; reason: string; expression: unknown } | null = null;
  cases.forEach((c, index) => {
    const rec = c && typeof c === "object" ? (c as Record<string, unknown>) : null;
    const chk = sanitizeOracleExpression(rec ? rec.expression : undefined);
    if (!chk.ok) {
      if (!rejection) {
        rejection = { index, reason: chk.reason, expression: rec ? rec.expression : undefined };
      }
      return;
    }
    validated.push({
      id: rec && typeof rec.id === "string" ? rec.id : `case-${index + 1}`,
      expression: chk.expression,
    });
  });
  const rej = rejection as { index: number; reason: string; expression: unknown } | null;
  if (rej !== null) {
    const rejId = caseIdAt(cases, rej.index);
    return {
      pass: false,
      results: cases.map((c, index) => {
        const rec = c && typeof c === "object" ? (c as Record<string, unknown>) : null;
        const id =
          rec && typeof rec.id === "string" && rec.id ? rec.id : `case-${index + 1}`;
        const isRejected = rej.index === index;
        return {
          id,
          pass: false,
          detail: rejectionDetail(
            isRejected
              ? "expression rejected by harness safety check"
              : "not run — case payload rejected by harness safety check",
            rej.reason,
            rejId,
            rej.expression,
          ),
        };
      }),
      compileError: `one or more case expressions failed the harness safety check: ${rejId} — ${rej.reason}`,
    };
  }
  const { runNodeBounded, runnerAvailable } = await import("./node-runner.server.ts");
  if (!runnerAvailable()) {
    return { pass: false, results: [], compileError: "local bounded runner unavailable" };
  }
  const harness = buildHarness(source, validated);
  const run = await runNodeBounded(harness, { timeoutMs, verdictChannel: true });
  if (!run.ok) {
    return { pass: false, results: [], compileError: `${run.reason}${run.error ? `: ${run.error}` : ""}` };
  }
  const out = run.stdout;
  // 344 A2-F1: verdicts are read ONLY from the nonce-authenticated fd-3 channel
  // (`run.verdict`), never from stdout. The module shares stdout with nothing
  // authoritative now, so any `ORACLE_RESULT` line IT prints there is an
  // impersonation of the verdict channel and fails the run; `HARNESS_EXPORTS`/
  // `HARNESS_COMPILE` on stdout is merely non-authoritative detail (ignored —
  // fixes/327 L5: a module that logs the marker must not cause a false refusal).
  let forged = false;
  for (const line of out.split("\n")) {
    if (/^\s*ORACLE_RESULT /.test(line)) forged = true;
  }
  // Exact-id validation: only lines whose id is an EXPECTED case id count,
  // each exactly once — a duplicate/unknown id (impossible on the authenticated
  // channel, but kept as defense in depth) fails the run. The parse is
  // first-marker-wins, NOT last-line-wins: a second authenticated marker is
  // itself a forgery signal.
  const expected = new Set(validated.map((c) => c.id));
  const seen = new Set<string>();
  const results: CaseResult[] = [];
  let callables = "";
  let compileMarker = "";
  let sawExports = false;
  let sawCompile = false;
  const channel = run.verdict ?? "";
  for (const line of channel.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // T-01 (109 C-01): the harness's OWN export inventory, emitted right
    // after the compile call — authenticated and single-writer, so first-wins.
    if (trimmed.startsWith("HARNESS_EXPORTS")) {
      if (sawExports) {
        forged = true;
        continue;
      }
      sawExports = true;
      callables = trimmed.slice("HARNESS_EXPORTS".length).trim();
      continue;
    }
    if (trimmed.startsWith("HARNESS_COMPILE ")) {
      if (sawCompile) {
        forged = true;
        continue;
      }
      sawCompile = true;
      compileMarker = trimmed.slice("HARNESS_COMPILE ".length).trim();
      continue;
    }
    const m = /^ORACLE_RESULT (.+?) (pass|fail)(?: (.*))?$/.exec(trimmed);
    if (!m) continue;
    if (!expected.has(m[1]) || seen.has(m[1])) {
      forged = true;
      continue;
    }
    seen.add(m[1]);
    results.push({ id: m[1], pass: m[2] === "pass", detail: m[3] ?? "" });
  }
  if (compileMarker.startsWith("fail")) {
    return { pass: false, results, compileError: "source failed to compile in the harness" };
  }
  // 346 E1 (L2-X4): an ENTIRELY empty authenticated channel is a runner/fd-3
  // failure, not a module with no callables — classify it honestly (before the
  // `!callables` check, which would otherwise mislabel it).
  if (verdictChannelFailed(sawExports, sawCompile)) {
    return { pass: false, results, compileError: VERDICT_CHANNEL_FAILED_REASON };
  }
  // T-01 (109 C-01): refuse the run when the module exports no callable name.
  // Fail-closed and actionable: the previous shape let a self-contained
  // literal (`({board:1}).board === 1`) mint a pass for a module that was
  // never called, and a `module.exports = { … }` module (T-05) produced a
  // bare ReferenceError with no diagnosis.
  if (!callables) {
    return { pass: false, results, compileError: NO_CALLABLE_EXPORTS_REASON };
  }
  // fixes/328 P3 (109 C-01 intersection half): at least one case must REFERENCE
  // an exported callable name. The inventory above is measured from what really
  // compiled, so this cannot be forged; a case that merely evaluates a literal
  // proves nothing about the module. Reference (not call) is the bar because
  // `typeof buildPlan === 'function'` is an explicitly-allowed prompt form.
  // fixes/330 P3: the reference must be a VALUE-position read — an object-literal
  // KEY (`({add:1}).add === 1`) or regex content (`({r:/add/})`) names the export
  // without ever touching it, so it may not satisfy the gate (109 C-01's shape).
  const callableNames = new Set(callables.split(",").map((s) => s.trim()).filter(Boolean));
  let referencesExport = false;
  for (const c of validated) {
    const code = stripStringsAndComments(c.expression);
    for (const name of referenceIdentifiers(code)) {
      if (callableNames.has(name)) {
        referencesExport = true;
        break;
      }
    }
    if (referencesExport) break;
  }
  if (!referencesExport) {
    return { pass: false, results, compileError: NO_EXPORT_REFERENCE_REASON };
  }
  const allSeen = [...expected].every((id) => seen.has(id));
  return {
    pass:
      !forged &&
      allSeen &&
      results.length === validated.length &&
      results.every((r) => r.pass),
    results,
  };
}

/**
 * T-02 (109 C-01, second half): identifiers a case text actually CALLS — a
 * name (optionally followed by spaces) immediately before an open paren in
 * the case source.
 */
function calledIdentifiers(code: string): string[] {
  const out: string[] = [];
  // sanitizeOracleExpression() collapses every tab/newline to a single space
  // before a case is ever run, so spaces are the only separator that matters.
  for (const m of code.matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)[ ]*[(]/g)) out.push(m[1]);
  return out;
}

/**
 * fixes/330 P3: mask regex-literal contents (`/add/`) with spaces, length- and
 * newline-preserving, for the reference scan. stripStringsAndComments() blanks
 * strings/comments but NOT regex literals, so `/add/` would otherwise
 * contribute a phantom `add` token. A `/` is masked as a regex only when the
 * previous non-space code char is an expression-start/operator position AND an
 * unescaped closing `/` is found — division (`a / b`) is left as code. Pure.
 */
function maskRegexLiterals(code: string): string {
  const PRECEDERS = new Set(["", "(", "[", "{", ",", ":", "?", "=", "!", "&", "|", "+", "-", "*", "%", "^", "~", "<", ">", "/", ";"]);
  const chars = code.split("");
  let prev = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (ch === "/" && PRECEDERS.has(prev)) {
      let j = i + 1;
      let closed = false;
      while (j < chars.length) {
        const cj = chars[j]!;
        if (cj === "\n") break;
        if (cj === "\\") {
          j += 2;
          continue;
        }
        if (cj === "/") {
          closed = true;
          break;
        }
        j++;
      }
      if (closed) {
        for (let k = i; k <= j; k++) if (chars[k] !== "\n") chars[k] = " ";
        i = j;
        while (i + 1 < chars.length && /[a-z]/i.test(chars[i + 1]!)) {
          chars[i + 1] = " ";
          i++;
        }
        prev = " ";
        continue;
      }
    }
    if (!/\s/.test(ch)) prev = ch;
  }
  return chars.join("");
}

/**
 * fixes/328 P3, tightened by fixes/330 P3 (109 C-01): identifiers a case
 * expression reads in a VALUE position — called or merely referenced
 * (`typeof buildPlan === 'function'` names `buildPlan` without calling it).
 * Used by runCases' reference gate to require that at least one case touches
 * the module's measured export inventory.
 *
 * A bare token scan is NOT enough: an object-literal KEY (`({add:1}).add`), a
 * PROPERTY ACCESS (`obj.add`) and regex content (`/add/`) all contain the
 * export spelling without reading the export binding, so each minted a
 * "machine-verified" pass for a module the case never touched. Keys and
 * property accesses are dropped here (a `? :` alternate after `?` is a read,
 * and a spread's `...name` still reads `name`); regex content is masked first.
 */
function referenceIdentifiers(code: string): string[] {
  const masked = maskRegexLiterals(code);
  const out: string[] = [];
  for (const m of masked.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    // property access `.name` (but not a spread's `...name`, which reads it)
    let p = start - 1;
    while (p >= 0 && /\s/.test(masked[p]!)) p--;
    if (p >= 0 && masked[p] === "." && !(p - 1 >= 0 && masked[p - 1] === ".")) continue;
    // object-literal key `name:` (but `cond ? name : other` reads `name`)
    let n = end;
    while (n < masked.length && /\s/.test(masked[n]!)) n++;
    if (n < masked.length && masked[n] === ":") {
      let r = start - 1;
      while (r >= 0 && /\s/.test(masked[r]!)) r--;
      if (!(r >= 0 && masked[r] === "?")) continue;
    }
    out.push(m[0]);
  }
  return out;
}

/**
 * 339-1: the JS global names a case expression may CALL without being an
 * undefined-identifier error. Pinned LITERALLY (an auditable list, not a
 * computed `globalThis` walk) so the accepted call surface is reviewable: a
 * case may call an exported name in the caller's measured `contract` or one of
 * these globals, and nothing else. `console` is listed for completeness even
 * though sanitizeOracleExpression() rejects it before execution.
 */
const ORACLE_CASE_GLOBALS: ReadonlySet<string> = new Set([
  "Math", "JSON", "Object", "Array", "String", "Number", "Boolean", "Date",
  "Set", "Map", "WeakMap", "WeakSet", "RegExp", "Promise", "Symbol", "BigInt",
  "Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError",
  "URIError", "EvalError", "isNaN", "isFinite", "NaN", "Infinity", "undefined",
  "parseInt", "parseFloat", "encodeURIComponent", "decodeURIComponent",
  "encodeURI", "decodeURI", "structuredClone", "queueMicrotask", "console",
]);

/** 339-1: operator keywords that can legally occupy call position (`typeof(x)`)
 *  — not identifiers, so they can never be an undefined-name offender. */
const ORACLE_CASE_KEYWORDS: ReadonlySet<string> = new Set([
  "typeof", "void", "delete", "instanceof", "in",
]);

/**
 * 339-1 deliverable 2 (resume #3): the identifiers one case expression READS in
 * VALUE position — called or merely referenced — that are neither in `contract`
 * (the module's MEASURED export surface) nor a pinned JS global / keyword /
 * literal, nor a name bound by the expression's own tolerated declaration
 * prefix. That set is exactly the shape that can only throw
 * `ReferenceError: <name> is not defined` when the harness runs it.
 *
 * The original cut inspected CALL position only, so a value read
 * (`missing === 2 && mean([1,2,3]) === 2`) or a parenthesised-sequence call
 * (`(0, missing)(…)`) committed with no retry and then died at run time.
 * Built from referenceIdentifiers() — VALUE-position, property-aware — so a
 * property METHOD is never mistaken for an identifier: `Math.round(x)` yields
 * only `Math` (a pinned global), never `round`; property names after `.`,
 * object-literal keys, labels and regex/string content stay unflagged, and
 * numeric literals are masked so `1e5` / `0x1F` / `2n` are not read as names.
 * A tolerated `declaration(s); final-boolean` repair is scanned at its FINAL
 * statement only, with the discarded prefix's bound names treated as defined
 * (the prefix never executes, so reading one is refused by the sanitizer, not
 * re-reported here as an undefined name). Pure; never throws.
 */
export function undefinedCaseIdentifiers(
  expression: unknown,
  contract: readonly string[],
): string[] {
  if (typeof expression !== "string" || !expression.trim()) return [];
  const split = splitDeclarationPrefix(expression.replace(/;\s*$/, ""));
  const code = stripStringsAndComments(split ? split.final : expression).replace(
    /\b\d[\w.]*/g,
    (m) => " ".repeat(m.length),
  );
  const allowed = new Set<string>(ORACLE_CASE_GLOBALS);
  for (const k of ORACLE_CASE_KEYWORDS) allowed.add(k);
  for (const k of ORACLE_CASE_LITERAL_WORDS) allowed.add(k);
  for (const n of contract) if (typeof n === "string" && n) allowed.add(n);
  if (split) for (const n of split.bound) allowed.add(n);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of referenceIdentifiers(code)) {
    if (allowed.has(name) || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/** 339-1 deliverable 2: every undefined VALUE-READ/CALLED identifier across
 *  `cases` as `{ id, name }` (first occurrence per pair), in case order. Pure. */
export function caseNameBindingOffenders(
  cases: readonly VerifyCase[],
  contract: readonly string[],
): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (const c of cases) {
    for (const name of undefinedCaseIdentifiers(c.expression, contract)) out.push({ id: c.id, name });
  }
  return out;
}

/**
 * Static proxy for "the module under test exports callable names": the source
 * assigns to `exports`/`module.exports` AND carries a function value
 * (`function` keyword or an arrow) — the CommonJS shapes the generation
 * prompt produces (verify.server.ts buildOracleCasesPrompt). Deliberately
 * conservative: grounding only tightens when the module demonstrably exports
 * functions, so a data-only module keeps the legacy behavior. (The harness's
 * own runtime inventory — T-01 `HARNESS_EXPORTS` — stays the authoritative
 * one; this is the generation-time approximation of it.)
 */
function sourceExportsCallables(source: string | undefined): boolean {
  if (typeof source !== "string" || !source.trim()) return false;
  const code = stripStringsAndComments(source);
  const assignsExports = /(^|[^A-Za-z0-9_$])module[.]exports|(^|[^A-Za-z0-9_$.])exports[.=]/.test(code);
  const hasFunctionValue = /=>|(^|[^A-Za-z0-9_$])function([^A-Za-z0-9_$]|$)/.test(code);
  return assignsExports && hasFunctionValue;
}

/** fixes/116 vacuity reason (unchanged wording — callers and tests match on it). */
function vacuousReason(targets: readonly string[]): string {
  return `oracle cases reference no brief noun or contract function (vacuous self-referential certification — expected at least one of: ${targets.slice(0, 8).join(", ")})`;
}

/**
 * T-02 variant of the same reason: the noun IS present, but only as data
 * (an object-literal key, a property name) — no case calls into the module.
 * Keeps the fixes/116 prefix so existing matchers still fire.
 */
function calledVacuityReason(targets: readonly string[]): string {
  return `oracle cases reference no brief noun or contract function as a CALLED identifier (vacuous self-referential certification — no case calls into the module; expected at least one call to one of: ${targets.slice(0, 8).join(", ")})`;
}

/**
 * Brief-grounding guard for oracle cases (fixes/116, tightened by 109 T-02).
 * A generated case set is VACUOUS when it only re-asserts the source's own
 * placeholder identifiers (e.g. `synthesize({job:'invoice'}).ok === true`
 * against the deterministic toy) — self-referential certification that says
 * nothing about the brief. The oracle must reference at least one BRIEF noun
 * OR one contract function name as an identifier; otherwise the set is
 * rejected and verify fails honestly (never a vacuous machine pass). A
 * vocabulary-free brief with no contract signatures passes vacuously (nothing
 * to ground against).
 *
 * T-02 (109 C-01): an identifier occurrence alone is not contact — a hit that
 * only ever appears as DATA (`({board:1}).board === 1`) proves nothing about
 * the module. When `source` is supplied and demonstrably exports functions,
 * at least one hit must land on an identifier the cases actually CALL.
 */
export function oracleBriefGrounded(
  cases: VerifyCase[],
  brief: string,
  signatureNames: readonly string[],
  source?: string,
): { ok: true } | { ok: false; reason: string } {
  const { required } = briefNounHits(brief);
  const targets = [
    ...new Set([
      ...required.map((t) => t.toLowerCase()),
      ...(signatureNames ?? []).filter((s): s is string => typeof s === "string").map((s) => s.toLowerCase()),
    ]),
  ];
  if (targets.length === 0) return { ok: true };
  const joined = (cases ?? [])
    .map((c) => (c && typeof c.expression === "string" ? c.expression : ""))
    .join("\n");
  const code = stripStringsAndComments(joined);
  const hits = identifierHits(targets, code);
  if (hits.length === 0) return { ok: false, reason: vacuousReason(targets) };
  // T-02 (109 C-01, second half): a hit that only appears as DATA (an object
  // key, a property name) is not contact with the module — when the source
  // demonstrably exports functions, at least one hit must be on an identifier
  // the cases actually CALL.
  if (
    sourceExportsCallables(source) &&
    identifierHits(targets, calledIdentifiers(code).join(" ")).length === 0
  ) {
    return { ok: false, reason: calledVacuityReason(targets) };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 345 L1-F2 (Med) — the BEHAVIOURAL-ASSERTION floor (anti self-certification).
//
// The oracle is authored by the SAME model that wrote the module, so a case
// set that checks only an export's PRESENCE or TYPE certifies nothing about
// behaviour. Reproduced: a module whose only export returns `NaN` earned
// `status:"passed"` → `lastTest {label:"tested", evidenceHash}` from the single
// case `boardAdd(1) !== null` (a call that cannot fail). T-02 required a CALL,
// not a behavioural constraint.
//
// This floor requires at least one case that CONSTRAINS a module value beyond
// presence/type: a strict comparison of a read/call result to a concrete
// expected value (number, string, boolean), or a relational/numeric predicate
// over one. A shape-only set takes ONE bounded repair re-prompt and is then
// REFUSED with a coded reason — never a pass.
//
// A pass certifies "machine-verified", so there is no reachable state where a
// shape-only set is the honest certificate: even a side-effect-only or
// data-only export supports a concrete assertion (`X.prop === v`,
// `plan().length === 3`). When the brief defines no observable result, the
// refusal message says so explicitly and records it — it is never certified by
// shape.
//
// The classifier is deliberately conservative toward ACCEPTING: exactly the
// enumerated shape forms are rejected (a `typeof` comparison, a presence
// comparison to `null`/`undefined`/`void 0`, a literal-only tautology, a bare
// call). Any comparison tying a module read to a concrete value — even an
// unusual spelling — counts as behavioural, so a genuine set is never refused.
// ---------------------------------------------------------------------------

/** Non-identifier marker that replaces each string literal in a masked
 *  expression, so a concrete string expectation is detectable while prose and
 *  quoted content can never look like a comparison operand. */
const ORACLE_STRING_LEAF = "\u0001";

/** Keywords/literals that are never a MODULE read (they name the language, not
 *  the module under test). */
const ORACLE_NON_MODULE_WORDS: ReadonlySet<string> = new Set([
  "true", "false", "null", "undefined", "void", "typeof", "this", "new",
  "in", "of", "instanceof", "delete", "NaN", "Infinity",
]);

/** Mask string literals to a single non-identifier marker and comments to
 *  spaces, then collapse whitespace. Pure; never throws. */
function maskOracleComparable(code: string): string {
  let out = "";
  let i = 0;
  const n = code.length;
  let state: "normal" | "sq" | "dq" | "tick" | "line" | "block" = "normal";
  while (i < n) {
    const ch = code[i]!;
    const next = code[i + 1];
    if (state === "line") {
      if (ch === "\n" || ch === "\r") {
        state = "normal";
        out += " ";
      }
      i++;
      continue;
    }
    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "normal";
        out += " ";
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (state === "sq" || state === "dq" || state === "tick") {
      if (ch === "\\" && next !== undefined) {
        i += 2;
        continue;
      }
      const closer = state === "sq" ? "'" : state === "dq" ? '"' : "`";
      if (ch === closer) {
        state = "normal";
        i++;
        continue;
      }
      i++;
      continue;
    }
    if (ch === "/" && next === "/") {
      state = "line";
      out += " ";
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      state = "block";
      out += " ";
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      state = ch === "'" ? "sq" : ch === '"' ? "dq" : "tick";
      out += ORACLE_STRING_LEAF;
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** A JS numeric literal — decimal (with exponent / `_` separators), hex, octal,
 *  binary, bigint, signed, or leading-dot. 346 parity: the tree lane
 *  (`compile-check.server.ts` NUMERIC_LITERAL_RE) recognizes the FULL grammar,
 *  so the oracle lane must too — a bare `\d+` both minted a literal-only probe
 *  as behavioural (`1n === 2` read `n` as a module read) and red-flagged a
 *  genuine read tied to one (`m.n === 1e3`). */
const ORACLE_NUMERIC_LITERAL_RE =
  /^[-+]?(?:0[xX][0-9a-fA-F][0-9a-fA-F_]*|0[oO][0-7][0-7_]*|0[bB][01][01_]*|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d[\d_]*)?|\.\d[\d_]*(?:[eE][-+]?\d[\d_]*)?)n?$/;

/** True when an operand is a concrete expected value: a string literal
 *  (masked to the marker), a number, or a boolean. `null`/`undefined`/`void 0`
 *  are deliberately NOT concrete — a presence check against them is the exact
 *  shape-only form this floor rejects. Parentheses around the operand are
 *  stripped first. Pure. */
function isConcreteExpectedToken(raw: string): boolean {
  const t = raw.trim().replace(/^\(+/, "").replace(/\)+$/, "").trim();
  if (t === ORACLE_STRING_LEAF) return true;
  if (ORACLE_NUMERIC_LITERAL_RE.test(t)) return true;
  return t === "true" || t === "false";
}

/** True when `side` reads a name that could be the module under test (an
 *  identifier that is not a language keyword/literal). Property names and
 *  calls both count — `mean([1,2,3])` and `result.ok` are both module reads.
 *
 *  346 parity (tree lane `hasModuleRead`): an identifier directly preceded by a
 *  digit is a numeric literal's suffix, not a binding — `1n` (`n`), `1e3`
 *  (`e3`), `0x1` (`x1`), `1_000` (`_000`). Without this the literal-only
 *  `1n === 2` read `n` as a module read. A real identifier can never be
 *  immediately preceded by a digit in valid JS, so this hides no read. */
function hasOracleModuleRead(side: string): boolean {
  for (const m of side.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
    if (ORACLE_NON_MODULE_WORDS.has(m[0])) continue;
    const prev = m.index > 0 ? side[m.index - 1]! : "";
    if (prev >= "0" && prev <= "9") continue; // numeric-literal suffix
    return true;
  }
  return false;
}

/** One `&&`/`||`-free fragment: behavioural iff it ties a module read to a
 *  concrete value via a strict comparison, or applies a relational predicate
 *  to one. A `typeof` fragment is a type check — never behavioural. Pure. */
function isBehaviouralOracleAtom(atom: string): boolean {
  const a = atom.trim();
  if (!a) return false;
  // `typeof x === 'function'` — a TYPE check, never behavioural.
  if (/\btypeof\b/.test(a)) return false;
  // A relational/numeric predicate over a module value: `median([1,2,3]) >= 2`.
  if (/(?:>=|<=|>|<)/.test(a) && hasOracleModuleRead(a)) return true;
  // A strict comparison tying a module read to a concrete expected value.
  const m = /^(.*?)\s*(===|!==)\s*(.*)$/.exec(a);
  if (m) {
    const lhs = m[1] ?? "";
    const rhs = m[3] ?? "";
    if (hasOracleModuleRead(lhs) && isConcreteExpectedToken(rhs)) return true;
    if (hasOracleModuleRead(rhs) && isConcreteExpectedToken(lhs)) return true;
  }
  return false;
}

/**
 * 345 L1-F2: does this case expression constrain a module value BEYOND its
 * presence/type? True for a concrete-value comparison (`add(2,3) === 5`,
 * `E.VERSION === "1.0.0"`, `plan().length === 3`, `result.ok === true`) or a
 * numeric/relational predicate (`median([1,2,3]) >= 2`). False for shape-only
 * forms: a `typeof` comparison, a presence comparison to `null`/`undefined`/
 * `void 0` (`boardAdd(1) !== null`), a bare call, and a literal-only tautology
 * (`1 === 1`). A tolerated `declaration(s); final` repair is classified at its
 * FINAL statement only (the prefix is discarded by the sanitizer). Pure.
 */
export function behaviouralOracleExpression(expression: unknown): boolean {
  if (typeof expression !== "string" || !expression.trim()) return false;
  const withoutTerminator = expression.replace(/;\s*$/, "");
  const split = splitDeclarationPrefix(withoutTerminator);
  const final = split ? split.final : withoutTerminator;
  const masked = maskOracleComparable(final);
  if (!masked) return false;
  for (const atom of masked.split(/\s*(?:&&|\|\|)\s*/)) {
    if (isBehaviouralOracleAtom(atom)) return true;
  }
  return false;
}

/** 345 L1-F2: the ids of cases that are NOT behavioural (a shape-only set when
 *  every case is listed). Pure; case-order preserved. */
export function shapeOnlyOracleCaseIds(cases: readonly VerifyCase[]): string[] {
  const out: string[] = [];
  for (const c of Array.isArray(cases) ? cases : []) {
    if (behaviouralOracleExpression(c?.expression)) continue;
    out.push(c && typeof c.id === "string" && c.id ? c.id : "(no id)");
  }
  return out;
}

/** 345 L1-F2: does the set carry at least one behavioural case? Pure. */
export function oracleHasBehaviouralCase(cases: readonly VerifyCase[]): boolean {
  return Array.isArray(cases) && cases.some((c) => behaviouralOracleExpression(c?.expression));
}

export type OracleCasesPromptInput = {
  source: string;
  brief: string;
  signatureNames?: readonly string[];
  /**
   * E-08 (A4-b): A7 oracle rows rendered by dod.ts `oracleToCaseSeeds()` as
   * `# orc-…` lines. Passed as a string so this module never imports dod.ts.
   * Empty/undefined ⇒ the legacy byte-parity prompt (no seed block).
   */
  seeds?: string;
};

/**
 * PINNED A7 ORACLE ROWS header + rule line — prepended above the legacy
 * instructions when seeds are present. The model must reproduce every pinned
 * row as a case with its EXACT id, translating `given ⇒ expect` into the one
 * non-throwing boolean the harness can run (rejection-expectation rows become
 * the strongest happy-path guard the brief requires — never a thrown probe).
 */
const ORACLE_SEED_HEADER =
  "PINNED A7 ORACLE ROWS (E-08) — reproduce EVERY row below in your case list, " +
  "each exactly once, keeping the EXACT pinned id and translating the row's `given ⇒ expect` " +
  "into one non-throwing boolean expression (happy-path only; a rejection-expectation row is " +
  "expressed as the strongest happy-path behavior the brief requires). Dropping, renaming or " +
  "merging a pinned row is a hard failure: your reply is rejected, never silently accepted:";

/**
 * Deterministic oracle-case generation prompt — the E-08 seam's prompt
 * builder (pure). With `seeds` empty/undefined the output is byte-identical
 * to the legacy unseeded prompt; with a rendered `oracleToCaseSeeds()` block
 * the seeds are PREPENDED (dod.ts E-08 contract: "prepend oracleToCaseSeeds()
 * to the generation prompt") above the unchanged legacy instructions.
 */
export function buildOracleCasesPrompt(input: OracleCasesPromptInput): string {
  const source = typeof input.source === "string" ? input.source : "";
  const brief = typeof input.brief === "string" ? input.brief : "";
  const contract = (input.signatureNames ?? []).filter((s): s is string => typeof s === "string");
  const { required } = briefNounHits(brief);
  const grounding = [...new Set([...required, ...contract])];
  const groundingLine =
    grounding.length > 0
      ? `BRIEF/CONTRACT GROUNDING (your cases MUST reference at least one of these as an identifier): ${grounding
          .slice(0, 24)
          .join(", ")}`
      : "BRIEF/CONTRACT GROUNDING: the brief supplies no nouns and no contract signatures — test the source's exported behavior directly.";
  const base = [
    "Write executable verification cases for the following source module. Return JSON ONLY:",
    "{\"cases\": [{\"id\": \"case-1\", \"expression\": \"<boolean JS expression using the module's exported names>\"}]}.",
    "Expressions must be self-contained booleans (e.g. add(2,3) === 5, typeof buildPlan === 'function').",
    "Return EXACTLY ONE boolean expression per case, over the module's exported names, and do NOT wrap",
    "it in backticks. Avoid semicolons, const/let/var declarations, assignments, multiple statements,",
    "arrow functions and template literals. (A declaration followed by a final boolean is a tolerated",
    "repair the harness reduces to the final expression, and its declarations are DISCARDED — never",
    "rely on it; emit the bare boolean expression.)",
    "Every expression must EVALUATE WITHOUT THROWING: do NOT test rejection paths (invalid phase,",
    "unknown job, missing fields) — the harness cannot catch thrown errors, and the module's",
    "guards are correct behavior, not bugs. Test happy-path + brief-required behavior only.",
    "The module uses CommonJS: it assigns its API to `exports` (e.g. `exports.add = (a, b) => a + b`).",
    "STRICT: test ONLY behavior the brief explicitly requires. Do NOT invent extra requirements",
    "(no extra types, edge cases, bigint support, or frameworks the brief never mentions).",
    "STRICT (anti-vacuous): ground your cases in the brief's required behavior — reference the",
    "contract function names and/or the brief's domain nouns as identifiers. A case that merely",
    "re-asserts the source's own placeholder self-test helpers (e.g. a phase-graph `synthesize`",
    "or its `test_happy`/`test_no_skip`/`test_rejection_addressed` booleans) is VACUOUS and forbidden.",
    // 345 L1-F2: a shape-only set (typeof/presence) certifies nothing — ask for
    // a behavioural constraint up front so the model does not have to be repaired.
    "BEHAVIOURAL ASSERTION REQUIRED: at least one case MUST constrain an exported result beyond its",
    "presence or type — compare a call/return (or a property of it) to a concrete expected value",
    "(e.g. add(2,3) === 5, mean([]) === 0, plan().length === 3, result.ok === true) or a numeric/boolean",
    "predicate (e.g. median([1,2,3]) >= 2). A set made ONLY of `typeof x === 'function'` and",
    "`f(1) !== null` / `!== undefined` presence checks is REJECTED as self-certifying — shape proves",
    "nothing about behavior. If the brief defines no observable result for a name, say so explicitly",
    "in that case's expression so the gap is recorded — never certify a shape-only set.",
    groundingLine,
    `Brief: ${brief.slice(0, 800)}`,
    "Source:",
    source.slice(0, 6000),
  ].join("\n");
  const seeds = typeof input.seeds === "string" ? input.seeds.trim() : "";
  if (!seeds) return base;
  return [ORACLE_SEED_HEADER, seeds, base].join("\n");
}

/**
 * Pinned oracle ids (in seed order) that a returned case list DROPPED — the
 * verify-side mirror of dod.ts `missingOracleCaseIds()` over the id list the
 * caller passes (verify.server.ts never imports dod.ts — A4-b seam). Extra
 * returned ids are ignored; only pinned rows matter.
 */
export function droppedPinnedOracleIds(
  returnedIds: readonly string[],
  pinnedOracleIds: readonly string[],
): string[] {
  const have = new Set(
    (returnedIds ?? []).filter((s): s is string => typeof s === "string"),
  );
  return (pinnedOracleIds ?? []).filter(
    (s): s is string => typeof s === "string" && s.length > 0 && !have.has(s),
  );
}

/**
 * Ask DeepSeek for boolean verification cases over a CommonJS module source.
 *
 * E-08 (A4-b) oracle pinning: the caller MAY pass the project's A7 oracle
 * rows as `seeds` (rendered by dod.ts `oracleToCaseSeeds()`) plus the pinned
 * `pinnedOracleIds` (both passed as parameters so this module never imports
 * dod.ts). The seeds are PREPENDED to the generation prompt; a returned case
 * list that drops a pinned id gets one bounded repair retry and then an
 * honest refusal — the verify loop can never run — let alone pass — a
 * reduced oracle.
 *
 * T-107.6 (A3 · D2.3): the caller MAY thread a `TokenBudget` (6th param) —
 * every wire call below runs through the catch wrapper (`runBudgetedCall`)
 * and records the response's REAL measured usage in the caller-owned ledger.
 * An over-cap stop comes back as this seam's coded refusal
 * (`RT_E_BUDGET_EXHAUSTED`, spend kept) — it can never surface as an escaping
 * throw (which an outer catch would classify `RT_E_INTERNAL`). No budget ⇒
 * the byte-identical legacy path.
 */
export async function generateCases(
  source: string,
  brief: string,
  signatureNames: readonly string[] = [],
  seeds = "",
  pinnedOracleIds: readonly string[] = [],
  budget?: TokenBudget,
): Promise<
  | { ok: true; cases: VerifyCase[] }
  | { ok: false; reason: "not-configured" | "error"; error?: string; code: ErrorCode }
> {
  if (!isDeepSeekConfigured()) return { ok: false, reason: "not-configured", code: "RT_E_LLM_NOT_CONFIGURED" };
  // Hostile/JS callers may pass non-strings — normalize before slicing.
  const src = typeof source === "string" ? source : "";
  const br = typeof brief === "string" ? brief : "";
  if (!src.trim()) {
    return { ok: false, reason: "error", error: "source is empty — nothing to generate cases for", code: "RT_E_VALIDATION" };
  }
  const contract = (signatureNames ?? []).filter((s): s is string => typeof s === "string");
  const prompt = buildOracleCasesPrompt({ source: src, brief: br, signatureNames: contract, seeds });
  // T-107.2 (fixes/216p): role-tiered call — `weak` = the cheapest tier for
  // short structured envelopes (flash + json; thinking disabled). Same
  // request shape the legacy `completeDeepSeek(…, "deepseek-v4-flash")` sent.
  const res = await runBudgetedCall(budget, () => callModel("weak", prompt, { json: true }));
  // A3: the pre-dispatch gate or the post-response record stopped the run at
  // the budget — return the CODED outcome, never fall through to RT_E_INTERNAL.
  if (isBudgetStopRefusal(res)) return res;
  if (!res.ok) {
    return res.reason === "not-configured"
      ? { ok: false, reason: "not-configured", code: "RT_E_LLM_NOT_CONFIGURED" }
      : { ok: false, reason: "error", error: res.error, code: res.code ?? "RT_E_INTERNAL" };
  }
  let parsed = parseOracleCases(res.text);
  if (!parsed.ok) {
    // audit-88 (A3): one bounded repair retry — a single malformed OR EMPTY
    // payload should not fail the whole verify run when the model can
    // self-correct. fixes/328 P3: the retry prompt is HONEST about WHICH
    // failure happened — an empty-but-VALID reply is never told it "was not
    // valid JSON" (the wrong diagnosis the 327 lane registered as owed).
    const retryPrompt =
      parsed.reason === "empty"
        ? [
            "Your previous reply was valid JSON but carried no cases.",
            "Return JSON ONLY: {\"cases\": [{\"id\": \"case-1\", \"expression\": \"<boolean expression>\"}]}.",
            "Return 2-5 cases, each ONE boolean expression over the module's exported names.",
          ].join("\n")
        : [
            "Your previous reply was not valid JSON with a {cases: [...]} array. Repair it now.",
            "Return JSON ONLY: {\"cases\": [{\"id\": \"case-1\", \"expression\": \"<boolean expression>\"}]}.",
            "Same rules as before: single boolean expressions, no semicolons/declarations/assignments.",
          ].join("\n");
    const retry = await runBudgetedCall(budget, () => callModel("weak", retryPrompt, { json: true }));
    if (isBudgetStopRefusal(retry)) return retry;
    if (!retry.ok) {
      return { ok: false, reason: "error", error: "model returned an unparseable oracle payload", code: "RT_E_INTERNAL" };
    }
    parsed = parseOracleCases(retry.text);
  }
  if (!parsed.ok) {
    const empty = parsed.reason === "empty";
    return {
      ok: false,
      reason: "error",
      error: empty
        ? "model returned a valid JSON reply with no usable cases (empty oracle) — refused (nothing to machine-verify)"
        : "model returned an unparseable oracle payload",
      code: empty ? "RT_E_VALIDATION" : "RT_E_INTERNAL",
    };
  }
  let cases = parsed.cases;
  // E-08 (A4-b): pin the A7 oracle ids — a returned case list that DROPS a
  // pinned row must never be accepted (the verify loop would otherwise mint a
  // machine pass on a reduced oracle). One bounded repair retry naming the
  // dropped ids, then an honest refusal. Duplicate pinned ids are not checked
  // here — runCases() already fails a duplicate ORACLE_RESULT id as forged.
  const pinned = (pinnedOracleIds ?? []).filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  if (pinned.length > 0) {
    const missing = droppedPinnedOracleIds(cases.map((c) => c.id), pinned);
    if (missing.length > 0) {
      const retry = await runBudgetedCall(budget, () =>
        callModel(
          "weak",
          [
            "Your previous reply dropped pinned A7 oracle rows.",
            `Repair it now: reproduce EVERY pinned id exactly once in the case list: ${missing.join(", ")}.`,
            'Return JSON ONLY: {"cases": [{"id": "case-1", "expression": "<boolean expression>"}]}.',
            "Same rules as before: single boolean expressions, no semicolons/declarations/assignments.",
          ].join("\n"),
          { json: true },
        ),
      );
      if (isBudgetStopRefusal(retry)) return retry;
      if (retry.ok) {
        const repaired = parseOracleJson(retry.text);
        if (repaired !== null) {
          // Merge the repair rows over the originals by id — a repair reply
          // may return only the missing pinned rows, and merging never loses
          // the model's self-authored steering cases.
          const byId = new Map<string, VerifyCase>(cases.map((c) => [c.id, c]));
          for (const r of repaired) byId.set(r.id, r);
          cases = [...byId.values()];
        }
      }
      const stillMissing = droppedPinnedOracleIds(cases.map((c) => c.id), pinned);
      if (stillMissing.length > 0) {
        return {
          ok: false,
          reason: "error",
          error: `oracle case list dropped pinned A7 rows: ${stillMissing.join(", ")} — refused (E-08 pin: never a blind pass on a reduced oracle)`,
          code: "RT_E_VALIDATION",
        };
      }
    }
  }
  // 339-1 deliverable 2: a case may READ or CALL only the module's measured
  // exports (the `contract` codegen.server.ts threads from oracleContractNames)
  // or a pinned JS global. Anything else can only throw
  // `ReferenceError: <name> is not defined` at machine-run time, so it can
  // never be committed: ONE bounded repair retry naming each offender as
  // `<case-id> → <identifier>`, then an honest refusal. The merge is by id, so
  // a repair reply that omits a case (including a pinned A7 row) leaves the
  // original in place — this gate can never DROP a pinned row, and an offending
  // pinned row is refused rather than silently removed. Skipped only when the
  // caller passes NO contract (nothing measured to bind against — the same
  // boundary oracleBriefGrounded draws for a vocabulary-free brief); with a
  // measured surface it always runs.
  if (contract.length > 0) {
    let offenders = caseNameBindingOffenders(cases, contract);
    if (offenders.length > 0) {
      const detail = offenders.map((o) => `${o.id} → ${o.name}`).join(", ");
      const retry = await runBudgetedCall(budget, () =>
        callModel(
          "weak",
          [
            "Your previous reply included oracle cases that reference an identifier the module does not export.",
            `Repair these cases now (case id → undefined identifier): ${detail}.`,
            "Rewrite ONLY the offending cases so they reference only a name the module exports or a standard JS global (Math, JSON, Object, Array, String, Number, …).",
            "Never drop or rename a case id — repair its expression in place; a pinned case id must stay.",
            'Return JSON ONLY: {"cases": [{"id": "case-1", "expression": "<boolean expression>"}]}.',
            "Same rules as before: single boolean expressions, no semicolons/declarations/assignments.",
          ].join("\n"),
          { json: true },
        ),
      );
      if (isBudgetStopRefusal(retry)) return retry;
      if (retry.ok) {
        const repaired = parseOracleJson(retry.text);
        if (repaired !== null) {
          const byId = new Map<string, VerifyCase>(cases.map((c) => [c.id, c]));
          for (const r of repaired) byId.set(r.id, r);
          cases = [...byId.values()];
        }
      }
      offenders = caseNameBindingOffenders(cases, contract);
      if (offenders.length > 0) {
        return {
          ok: false,
          reason: "error",
          error: `oracle case(s) reference undefined identifier(s): ${offenders
            .map((o) => `${o.id} → ${o.name}`)
            .join(", ")} — refused (a case reading an undefined identifier cannot be committed)`,
          code: "RT_E_VALIDATION",
        };
      }
    }
  }
  // 345 L1-F2 (Med): a SHAPE-ONLY case set certifies nothing about behaviour —
  // the same model writes the module and the cases, so `typeof add ===
  // "function"` / `add(1) !== null` / `!== undefined` let a stub (e.g. a lone
  // export returning NaN) earn a machine pass. Require at least one case that
  // constrains an exported result beyond presence/type: ONE bounded repair
  // re-prompt naming the shape-only ids, then an honest coded refusal — never a
  // pass on a self-certifying oracle. Runs after the name-binding gate (so a
  // name repair keeps priority) and before the brief-grounding gate.
  if (!oracleHasBehaviouralCase(cases)) {
    const shapeOnly = shapeOnlyOracleCaseIds(cases);
    const retry = await runBudgetedCall(budget, () =>
      callModel(
        "weak",
        [
          "Your previous reply's cases only check an export's presence or type — that certifies nothing about behavior.",
          `Shape-only case id(s): ${shapeOnly.join(", ")}. Rewrite the case list so at least ONE case constrains an exported result beyond presence/type, e.g.:`,
          "  add(2,3) === 5  ·  mean([]) === 0  ·  plan().length === 3  ·  result.ok === true  ·  median([1,2,3]) >= 2.",
          "A `typeof x === 'function'` or `f(1) !== null` / `!== undefined` check alone is INSUFFICIENT.",
          'Return JSON ONLY: {"cases": [{"id": "case-1", "expression": "<boolean expression>"}]}.',
          "Same rules as before: single boolean expressions, no semicolons/declarations/assignments.",
        ].join("\n"),
        { json: true },
      ),
    );
    if (isBudgetStopRefusal(retry)) return retry;
    if (retry.ok) {
      const repaired = parseOracleJson(retry.text);
      if (repaired !== null) {
        const byId = new Map<string, VerifyCase>(cases.map((c) => [c.id, c]));
        for (const r of repaired) byId.set(r.id, r);
        cases = [...byId.values()];
      }
    }
    if (!oracleHasBehaviouralCase(cases)) {
      const stillShapeOnly = shapeOnlyOracleCaseIds(cases);
      return {
        ok: false,
        reason: "error",
        code: "RT_E_VALIDATION",
        error:
          `oracle case set is SHAPE-ONLY: no case constrains an exported result beyond presence/type ` +
          `(case id(s): ${stillShapeOnly.join(", ")}). A presence/type check (typeof x === "function", ` +
          `f() !== null, f() !== undefined) cannot certify behavior, so the set is refused — never a machine ` +
          `pass on a self-certifying oracle. Add at least one case that compares a return value (or a property ` +
          `of it) to a concrete expected value or a numeric/boolean predicate. If the brief specifies no ` +
          `observable result for this surface, that gap must be recorded explicitly, not certified by shape.`,
      };
    }
  }
  // fixes/116: reject a vacuous oracle (cases referencing only the source's own
  // placeholder identifiers) — self-referential certification must never mint a
  // machine pass. This makes the placeholder FAIL honestly on the CLI path.
  // fixes/116 + 109 T-02: pass the source so the grounding rule also requires
  // a CALLED hit when the module demonstrably exports functions (a data-only
  // occurrence must never certify a module the cases never touch).
  const grounded = oracleBriefGrounded(cases, br, contract, src);
  if (!grounded.ok) {
    return { ok: false, reason: "error", error: grounded.reason, code: "RT_E_VALIDATION" };
  }
  return { ok: true, cases };
}

/**
 * 216i (112 §4.1/§4.2/§4.3 — T1/T2): the record-gated L3 mint shared by every
 * verify outcome site (phase 6 — the verify loop is P6-only, fixes/98 §2.3
 * writer 2(c)). `anchors` are the stable ids the failure is tied to: the
 * failing machine-case ids runCases() reported (`f.id`), never prose. With ≥1
 * anchor the row comes from knowledge.failureLessonFromRecord's verify path,
 * so its id hashes the 216g SIGNATURE (kind · phase · class · sorted anchors)
 * and a recurring failure maps to ONE row instead of forking a new one per
 * run (112 §4.2). The free-text evidence rides the row TEXT only.
 *
 * With NO anchor (an oracle-generation refusal before any case ever ran, or a
 * shape that recorded no failing ids) the §4.3 counterexample floor REFUSES:
 * `lesson` is absent and `lessonRefused` carries the refusal envelope — its
 * reason, its RT_E code and the visible `lesson.refused` ledger payload the
 * consumer appends to project.logs. Never a silent no-op (112 §2.4).
 */
function gatedFailureMint(
  anchors: readonly string[],
  evidence: string,
  iterations: number,
  classCode: ErrorCode | null,
): Pick<VerifyOutcome, "lesson" | "lessonRefused"> {
  const rec = failureLessonFromRecord(
    { kind: "verify-failed", phase: 6, classCode, anchors, detailTail: evidence },
    { iterations },
  );
  if (rec.refused) {
    return {
      lessonRefused: {
        verdict: rec.verdict,
        reason: rec.reason,
        code: rec.code,
        signature: rec.signature,
        log: rec.log,
      },
    };
  }
  return { lesson: rec.lesson };
}

export async function verifyAndFixServer(
  source: string,
  brief: string,
  opts: {
    maxIterations?: number;
    signatureNames?: readonly string[];
    /**
     * E-08 (A4-b): A7 oracle rows rendered by dod.ts `oracleToCaseSeeds()`
     * (""/undefined ⇒ the legacy byte-parity unseeded generation prompt).
     */
    seeds?: string;
    /** E-08 (A4-b): the pinned oracle ids — a returned case list dropping
     *  one is rejected (repair retry, then honest refusal — never a pass on a
     *  reduced oracle). Callers pass `project.oracle.map((o) => o.id)`. */
    pinnedOracleIds?: readonly string[];
    /** T-107.6 (A3 · D2.3): OPTIONAL caller-owned session budget, threaded
     *  into the case-generation call and the fix dispatch (token-ledger.ts).
     *  Absent ⇒ the byte-identical legacy path; a budget stop returns the
     *  coded refusal (RT_E_BUDGET_EXHAUSTED, spend kept) — never
     *  RT_E_INTERNAL. */
    budget?: TokenBudget;
  } = {},
): Promise<VerifyOutcome> {
  // W40·K4: normalize the caller knob — `Math.max(NaN, 1)` propagates NaN, so
  // `for (i < NaN)` ran ZERO iterations and the tail evidence read "exhausted
  // NaN iterations". Non-finite/unset → the default; fractional → floored (the
  // loop's `i === maxIterations - 1` check needs an integer count).
  const requestedIterations = opts.maxIterations;
  const maxIterations =
    typeof requestedIterations === "number" && Number.isFinite(requestedIterations)
      ? Math.min(Math.max(Math.floor(requestedIterations), 1), 5)
      : MAX_ITERATIONS;
  if (!isDeepSeekConfigured()) {
    return { status: "not-configured", iterations: 0, evidence: "no DEEPSEEK_API_KEY server-side" };
  }
  // 340-3: structural refusal BEFORE any case generation — a module the
  // CommonJS harness cannot compile (a materialized ESM tree entry, whose
  // `export * from …` targets are not in this source) must not spend a keyed
  // case-generation call or a fix loop. The coded reason rides the evidence;
  // the unanchored refusal is visible via gatedFailureMint like every other
  // pre-run refusal.
  const esmReason = esmModuleUnsupportedReason(source);
  if (esmReason !== null) {
    return {
      status: "error",
      iterations: 0,
      evidence: esmReason,
      ...gatedFailureMint([], esmReason, 0, "RT_E_RUNNER_FAILED"),
    };
  }
  // E-08 (A4-b): seed the generator with the project's A7 oracle rows (seed
  // text + pinned id list are passed as parameters — this module never
  // imports dod.ts). generateCases REJECTS a returned case list that drops a
  // pinned id (one bounded repair retry, then refusal), so this loop can
  // never run — let alone mint a machine pass on — a reduced oracle; the
  // refusal surfaces below as status "error" with the dropped ids in the
  // evidence (never silently accepted).
  const gen = await generateCases(
    source,
    brief,
    opts.signatureNames ?? [],
    opts.seeds ?? "",
    opts.pinnedOracleIds ?? [],
    opts.budget,
  );
  if (!gen.ok) {
    const status = gen.reason === "not-configured" ? "not-configured" : "error";
    const evidence = gen.reason === "error" ? gen.error ?? "oracle generation failed" : "no key";
    return {
      status,
      iterations: 0,
      evidence,
      // L3 verify-failure on a refused run (oracle generation failed / compile
      // refused) — never on a mere not-configured (98 §2.3 writer 2(c)).
      // 216i (112 §4.3 — T2): this path never ran a case, so there is NO
      // failing-case id to anchor the failure to ⇒ the mint REFUSES (no row)
      // and the visible lessonRefused envelope rides the outcome instead.
      ...(status === "error" ? gatedFailureMint([], evidence, 0, gen.code) : {}),
    };
  }
  const cases = gen.cases;
  let current = source;
  for (let i = 0; i < maxIterations; i++) {
    const run = await runCases(current, cases);
    const lint = lintFailures(current);
    const lintSuffix = lint.length > 0 ? `; lint advisory: ${formatLintSummary(lint)}` : "";
    if (run.pass) {
      const evidence = `${cases.length}/${cases.length} machine-run cases passed on iteration ${i + 1}${lintSuffix}`;
      return {
        status: "passed",
        iterations: i + 1,
        evidence,
        finalSource: current,
        cases,
        ...(lint.length > 0 ? { lint } : {}),
        // L4 verified-procedure on a machine pass (Voyager commit-on-verify).
        // 216i note: a PASS is not a failure record, so the §4.3
        // counterexample gate (gatedFailureMint) does not apply here — the L4
        // row keeps its direct builder. 331 V1: its identity is the sorted
        // machine-case ids (the set it PROVED), so the iteration count and the
        // lint suffix in `evidence` can no longer fork the row.
        lesson: verifyOutcomeLesson("passed", 6, evidence, i + 1, cases.map((c) => c.id)),
      };
    }
    if (i === maxIterations - 1) {
      const fails = run.results.filter((r) => !r.pass);
      const evidence = `machine-run cases still failing after ${maxIterations} iterations: ${fails
        .map((f) => `${f.id}: ${f.detail}`)
        .join("; ")}${run.compileError ? ` (${run.compileError})` : ""}${lintSuffix}`;
      return {
        status: "failed",
        iterations: maxIterations,
        evidence,
        finalSource: current,
        cases,
        ...(lint.length > 0 ? { lint } : {}),
        // L3 verify-failure on a run that exhausted iterations while failing.
        // 216i (112 §4.2/§4.3 — T1/T2): anchored to the FAILING machine-case
        // ids — the counterexample IS the failing case, so the row is provable
        // and a recurrence maps to the same signature row (never a per-run
        // fork). A shape that somehow recorded no failing id would refuse.
        ...gatedFailureMint(fails.map((f) => f.id), evidence, maxIterations, null),
      };
    }
    // Fail → ask the model for a patched source (it NEVER declares the pass).
    const failing = run.results.filter((r) => !r.pass);
    const failures = failing.map((f) => `${f.id}: ${f.detail}`).join("; ");
    const fix = await runBudgetedCall(opts.budget, () =>
      callModel(
        "weak",
        [
          "The following module failed machine-run verification cases.",
          `Failing cases: ${failures || "compile failure"}`,
          "Return ONLY the complete corrected module source (plain code, no fences).",
          "Do not weaken the cases; fix the source. Do not claim success.",
          `Brief: ${brief.slice(0, 600)}`,
          "Current source:",
          current.slice(0, 6000),
        ].join("\n"),
      ),
    );
    // A3 · D2.3: a budget stop mid-loop is this seam's CODED outcome — exit
    // with the coded evidence instead of spinning the loop on a spent budget
    // (and never let the throw classify RT_E_INTERNAL at an outer catch).
    // Anchored to the failing machine-case ids observed this iteration (the
    // counterexample is real; the budget stop itself rides the evidence).
    if (isBudgetStopRefusal(fix)) {
      const evidence = `fix dispatch refused: ${fix.error}`;
      return {
        status: "error",
        iterations: i + 1,
        evidence,
        finalSource: current,
        cases,
        ...gatedFailureMint(failing.map((f) => f.id), evidence, i + 1, fix.code),
      };
    }
    if (fix.ok) {
      const cleaned = fix.text.replace(/^```[a-zA-Z0-9+_-]*\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
      if (cleaned) current = cleaned;
    }
  }
  const exhaustedLint = lintFailures(current);
  const exhaustedSuffix =
    exhaustedLint.length > 0 ? `; lint advisory: ${formatLintSummary(exhaustedLint)}` : "";
  const evidence = `exhausted ${maxIterations} iterations without a machine-run pass${exhaustedSuffix}`;
  return {
    status: "failed",
    iterations: maxIterations,
    evidence,
    finalSource: current,
    cases,
    ...(exhaustedLint.length > 0 ? { lint: exhaustedLint } : {}),
    // L3 verify-failure on the final exhausted shape (fail-to-pass never
    // converged). 216i (112 §4.3 — T2): no failing-case result survives into
    // this tail (the loop returns on every observed failure; this is the TS
    // path-completeness guard), so there is no id to anchor on — the mint
    // refuses VISIBLY (lessonRefused) instead of inventing an unprovable row.
    ...gatedFailureMint([], evidence, maxIterations, null),
  };
}
