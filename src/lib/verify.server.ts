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
 * Validate + sanitize one oracle expression BEFORE it is spliced into the
 * harness (`with(exports){ return (E); }`). The expression must stay a single
 * expression: statement separators (`;`), template literals (backticks),
 * unterminated/unbalanced `()`/`[]`/`{}`, comment smuggling and stray line
 * terminators are rejected or neutralized, and the keyword scan below rejects
 * the named escape hatches (function/eval/globals + `constructor`/`prototype`/
 * `__proto__` — 109 C-05).
 *
 * HONEST SCOPE (fixes/216a, 109 C-05): this is a STATEMENT-FORM gate, NOT a
 * sandbox. It stops a hostile reply from splicing its own statements into the
 * return-expression context; it does not make case expressions inert, and a
 * text-level guard can only reject the shapes it names. Execution bounds
 * (wall-clock timeout, output caps, scrubbed child env) live in
 * `node-runner.server.ts` — which is bounded, not isolated — and the module
 * under test already runs with full globals in that same child process.
 * Characters inside string literals are data and pass through untouched.
 * Pure — never throws.
 */
export function sanitizeOracleExpression(raw: unknown): OracleExpressionCheck {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, reason: "expression must be a non-empty string" };
  }
  // Tolerate exactly ONE trailing statement terminator — a no-op outside the
  // wrapper parens that LLM oracles routinely emit (`expr;`). Any remaining
  // `;` (a real statement separator) is still rejected by the scan below.
  const src = raw.replace(/;\s*$/, "");
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

function buildHarness(source: string, cases: VerifyCase[]): string {
  return [
    "// rapidtool verify harness (machine-authored; do not trust the LLM's claims)",
    `const __SRC = ${JSON.stringify(source)};`,
    `const __CASES = ${JSON.stringify(cases)};`,
    "const __exports = {};",
    // Capture the REAL console before any case expression can touch it —
    // verdict lines are emitted through __emit, never through the global,
    // so a hostile expression can neither forge nor silence ORACLE_RESULT.
    "const __emit = console.log.bind(console);",
    "const __sandbox = Object.freeze({ console: Object.freeze({ log: function(){}, error: function(){}, warn: function(){}, info: function(){}, debug: function(){}, trace: function(){} }) });",
    "try {",
    "  const __fn = new Function('exports', 'module', 'require', __SRC + '\\n; return exports;');",
    "  const __mod = { exports: __exports };",
    "  __fn(__exports, __mod, () => {});",
    // T-05 (109 C-07): the `module` parameter is no longer a decoy. The far
    // more common `module.exports = { … }` style reassigns the property on
    // this object; fold its keys back onto __exports so BOTH CommonJS styles
    // expose the API to the `with(exports)` case scope (an `exports.x =`
    // module leaves __mod.exports === __exports and the fold is a no-op).
    "  if (__mod.exports && __mod.exports !== __exports) { for (const k of Object.keys(__mod.exports)) __exports[k] = __mod.exports[k]; }",
    // T-01 (109 C-01): the runner's OWN export inventory, measured from what
    // actually compiled — it cannot lie about the module. runCases refuses to
    // mint a pass when this list is empty: nothing in a case is required to
    // reference an export, so a self-contained literal could otherwise be
    // "machine-verified" against a module that exports nothing at all.
    "  __emit('HARNESS_EXPORTS ' + Object.keys(__exports).filter(function (k) { return typeof __exports[k] === 'function'; }).join(','));",
    "  __emit('HARNESS_COMPILE pass');",
    "} catch (e) {",
    "  __emit('HARNESS_COMPILE fail ' + String(e).slice(0, 120));",
    "}",
    "for (const c of __CASES) {",
    "  try {",
    "    const v = new Function('exports', '__sandbox', 'with(exports){ with(__sandbox){ return (' + c.expression + '); } }')(__exports, __sandbox);",
    "    __emit('ORACLE_RESULT ' + c.id + ' ' + (v === true ? 'pass' : 'fail') + ' ' + String(v).slice(0, 80));",
    "  } catch (e) {",
    "    __emit('ORACLE_RESULT ' + c.id + ' fail error ' + String(e).slice(0, 80));",
    "  }",
    "}",
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
  const validated: { id: string; expression: string }[] = [];
  let rejection: { index: number; reason: string } | null = null;
  cases.forEach((c, index) => {
    const rec = c && typeof c === "object" ? (c as Record<string, unknown>) : null;
    const chk = sanitizeOracleExpression(rec ? rec.expression : undefined);
    if (!chk.ok) {
      if (!rejection) rejection = { index, reason: chk.reason };
      return;
    }
    validated.push({
      id: rec && typeof rec.id === "string" ? rec.id : `case-${index + 1}`,
      expression: chk.expression,
    });
  });
  const rej = rejection as { index: number; reason: string } | null;
  if (rej !== null) {
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
          detail: isRejected
            ? `expression rejected by harness safety check (${rej.reason})`
            : "not run — case payload rejected by harness safety check",
        };
      }),
      compileError: "one or more case expressions failed the harness safety check",
    };
  }
  const { runNodeBounded, runnerAvailable } = await import("./node-runner.server.ts");
  if (!runnerAvailable()) {
    return { pass: false, results: [], compileError: "local bounded runner unavailable" };
  }
  const harness = buildHarness(source, validated);
  const run = await runNodeBounded(harness, { timeoutMs });
  if (!run.ok) {
    return { pass: false, results: [], compileError: `${run.reason}${run.error ? `: ${run.error}` : ""}` };
  }
  const out = run.stdout;
  // Exact-id validation: only lines whose id is an EXPECTED case id count,
  // each exactly once — a forged `ORACLE_RESULT` line (unknown id, or a
  // duplicate) fails the run even if the real harness lines were silenced.
  const expected = new Set(validated.map((c) => c.id));
  const seen = new Set<string>();
  const results: CaseResult[] = [];
  let forged = false;
  let callables = "";
  // fixes/327 L5: the compile verdict is read with the SAME last-line-wins
  // discipline as HARNESS_EXPORTS below. The old `/^HARNESS_COMPILE fail/`
  // (no `m` flag) only matched at position 0, so a compiling module whose own
  // stdout began with the marker forged a "failed to compile" refusal — a
  // false rejection of a module the harness never even tried to parse. The
  // harness's real marker is ALWAYS emitted after the module body finishes
  // (and is the ONLY marker when construction throws), so last-wins can never
  // flip a real compile failure to a pass.
  let compileMarker = "";
  for (const line of out.split("\n")) {
    // T-01 (109 C-01): the harness's OWN export inventory, emitted right
    // after the compile call. Last line wins — the module source has already
    // finished running before the harness prints, so a lookalike line it
    // printed cannot displace the measured one.
    const trimmed = line.trim();
    if (trimmed.startsWith("HARNESS_EXPORTS")) {
      callables = trimmed.slice("HARNESS_EXPORTS".length).trim();
      continue;
    }
    if (trimmed.startsWith("HARNESS_COMPILE ")) {
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
 * Extract the function names a typeSignature list demands (codegen.server.ts
 * `signatureFunctionNames` parity — duplicated here so verify.server.ts never
 * has to import a module that imports it back). Deterministic, no LLM.
 */
export function oracleSignatureFunctionNames(typeSignatures: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of typeSignatures ?? []) {
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
    "Expressions must be self-contained booleans (e.g. `add(2,3) === 5`, `typeof buildPlan === 'function'`).",
    "Each expression is EXACTLY ONE boolean expression. FORBIDDEN in every case: semicolons,",
    "const/let/var declarations, assignments, multiple statements, arrow functions, and template literals.",
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
        // row keeps its direct builder and its stable evidence-derived id.
        lesson: verifyOutcomeLesson("passed", 6, evidence, i + 1),
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
