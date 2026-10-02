#!/usr/bin/env node
/**
 * T-17 (fixes/216j) — assertion-gap lint: tautological assertions + zero-assertion tests.
 *
 * The F-12 class: a green suite passed while the function it tested destroyed every
 * generated module, because its assertions were *unfalsifiable* (string-presence checks on
 * a fixture form that cannot express the bug). This lint is the meta-fix — it scans the
 * test suites and REPORTS:
 *
 *   1. **tautological assertions** — an assertion that can never fail:
 *        - `assert.ok(true)` / `assert.ok(true, "msg")` / `assert(true)`
 *        - `assert.ok(<expr>.length >= 0)` (and the equivalent `> -1` / `>= -1` forms) —
 *          true for every string/array/typed-array length, including 0
 *        - `assert.equal(true, true)` and the identical-literal family
 *          (`false`/`null`/`undefined`/number pairs, any of equal/strictEqual/deepEqual/…)
 *        - same-operand equality — `assert.equal(x, x)`, `assert.strictEqual(a.b, a.b)`
 *        - **presence-only subjects** — `assert.ok(<always-truthy expression>)`: an
 *          object/array/function/regex/`new` literal, a non-empty string or
 *          non-zero number, a template literal, or a bare `typeof …`. These
 *          assert *presence* of a value that is truthy by construction.
 *        - **typeof-only assertions** — `assert.equal(typeof <literal>, "<the
 *          literal's own type>")` (e.g. `typeof "x"` === `"string"`), which is
 *          true for every run.
 *   2. **zero-assertion test blocks** — an `it(...)`/`test(...)` (incl. `.only`/`.skip`
 *      variants) whose callback contains neither an `assert*` call nor a `throw`/`rejects`
 *      path — nothing in it can fail, so its green light only means it ran.
 *
 * It is a **check, never an editor**: findings are printed as `file:line: [rule] reason —
 * <source line>` and the process exits non-zero. No flagged file is ever rewritten; the
 * fix is a human/agent decision (a tautology may be a legitimate placeholder that still
 * needs to be *visible*, and the honest repair is often a real assertion, not a deleted
 * line).
 *
 * Usage:
 *   node scripts/check-assertion-gaps.mjs                    # default targets
 *   node scripts/check-assertion-gaps.mjs <file|dir> [...]   # explicit targets
 *   node scripts/check-assertion-gaps.mjs --json             # machine-readable findings
 *
 * Default targets: each `*.test.ts` in `src/lib/` + each `*.test.mjs` in `scripts/`
 * (the two legs `npm test` runs — see package.json). Explicit **files** are linted
 * whatever their name; explicit **directories** are walked recursively and filtered to
 * `*.test.ts` / `*.test.mjs` (skipping `node_modules`, `.git`, and build output), so the
 * fixture dirs this script's own test plants can be linted directly.
 *
 * Exit codes: 0 = clean · 1 = findings · 2 = usage / no targets resolved.
 *
 * Masking: comments, string literals, template literals and regex literals are blanked
 * (contents → spaces, newlines kept) before any pattern runs, so a fixture *string* that
 * contains `assert.ok(true)` is data, not a finding — while line/column numbers stay
 * those of the real file.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { isMainModule, projectRoot } from "./with-app-env.mjs";

/** Whole-suite scan set (the two `npm test` legs). */
export const DEFAULT_TARGETS = ["src/lib", "scripts"];

const TEST_FILE_RE = /\.test\.(?:ts|mjs)$/;
const WALK_SKIP = new Set(["node_modules", ".git", ".vercel", "dist", "build", "coverage", ".output"]);
const SNIPPET_CAP = 120;
const NAME_CAP = 70;

/**
 * Blank the contents of comments, strings, template literals and regex literals,
 * preserving the source length, the newlines, and the delimiters. This is what keeps
 * fixture text (a test that *plants* `assert.ok(true)` in a string) from being flagged,
 * and what lets the bracket matcher walk a callback body without tripping over a `}`
 * inside a string.
 */
export function maskSource(source) {
  const out = source.split("");
  let state = "code";
  let prevSig = ""; // last significant code character, for the regex-vs-division heuristic
  let regexInClass = false;
  const blank = (idx) => {
    if (idx < source.length && source[idx] !== "\n") out[idx] = " ";
  };
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (state === "code") {
      if (c === "/" && next === "/") {
        state = "line";
        blank(i);
        blank(i + 1);
        i += 2;
      } else if (c === "/" && next === "*") {
        state = "block";
        blank(i);
        blank(i + 1);
        i += 2;
      } else if (c === "'") {
        state = "single";
        prevSig = c;
        i += 1;
      } else if (c === '"') {
        state = "double";
        prevSig = c;
        i += 1;
      } else if (c === "`") {
        state = "template";
        prevSig = c;
        i += 1;
      } else if (c === "/" && /(^|[([{,;:=!&|?+\-*%~^<>])$/.test(prevSig)) {
        state = "regex";
        regexInClass = false;
        prevSig = c;
        i += 1;
      } else {
        if (!/\s/.test(c)) prevSig = c;
        i += 1;
      }
      continue;
    }
    if (state === "line") {
      if (c === "\n") {
        state = "code";
        i += 1;
      } else {
        blank(i);
        i += 1;
      }
      continue;
    }
    if (state === "block") {
      if (c === "*" && next === "/") {
        blank(i);
        blank(i + 1);
        state = "code";
        i += 2;
      } else {
        blank(i);
        i += 1;
      }
      continue;
    }
    if (state === "single" || state === "double") {
      if (c === "\\") {
        blank(i);
        blank(i + 1);
        i += 2;
      } else if ((state === "single" && c === "'") || (state === "double" && c === '"')) {
        state = "code";
        prevSig = c;
        i += 1;
      } else {
        blank(i);
        i += 1;
      }
      continue;
    }
    if (state === "template") {
      if (c === "\\") {
        blank(i);
        blank(i + 1);
        i += 2;
      } else if (c === "`") {
        state = "code";
        prevSig = c;
        i += 1;
      } else {
        blank(i);
        i += 1;
      }
      continue;
    }
    // state === "regex"
    if (c === "\\") {
      blank(i);
      blank(i + 1);
      i += 2;
    } else if (c === "[") {
      regexInClass = true;
      blank(i);
      i += 1;
    } else if (c === "]" && regexInClass) {
      regexInClass = false;
      blank(i);
      i += 1;
    } else if (c === "/" && !regexInClass) {
      state = "code";
      prevSig = c;
      i += 1;
    } else {
      blank(i);
      i += 1;
    }
  }
  return out.join("");
}

/** Index of line starts, so an offset can be reported as `file:line`. */
function lineIndex(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function lineAt(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Raw (unmasked) single source line, trimmed and capped, for the finding's evidence. */
function rawLine(source, starts, offset) {
  const line = starts.length ? lineAt(starts, offset) : 1;
  const text = (source.split("\n")[line - 1] ?? "").trim();
  return text.length > SNIPPET_CAP ? `${text.slice(0, SNIPPET_CAP)}…` : text;
}

/** The first string literal argument of a test call, for the finding's label. */
function callLabel(rawCall) {
  const m = /["'`]([^"'`\n]*)["'`]/.exec(rawCall);
  const label = m ? m[1] : rawCall.replace(/\s+/g, " ").trim();
  return label.length > NAME_CAP ? `${label.slice(0, NAME_CAP)}…` : label;
}

// ---------------------------------------------------------------------------
// Rule 1 — tautological assertions
// ---------------------------------------------------------------------------

const RULE_TRUE_LITERAL = "tautology:true-literal";
const RULE_LENGTH_FLOOR = "tautology:length-floor";
const RULE_LITERAL_PAIR = "tautology:literal-pair";
const RULE_SAME_OPERAND = "tautology:same-operand";
const RULE_PRESENCE_ONLY = "tautology:presence-only";
const RULE_TYPEOF_ONLY = "tautology:typeof-only";

const EQUALITY_FNS = "equal|strictEqual|deepEqual|deepStrictEqual";
const OPERAND = "[A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*";
const LITERAL = "true|false|null|undefined|-?\\d+(?:\\.\\d+)?";

/** `assert.ok(true)` / `assert.ok(true, "msg")` / `assert(true)`. */
const RE_TRUE_LITERAL = new RegExp(
  `\\bassert\\s*\\(\\s*true\\s*[,)]` + `|\\bassert\\s*\\.\\s*ok\\s*\\(\\s*true\\s*[,)]`,
);

/**
 * `<expr>.length >= 0` (and `> -1` / `>= -1`) as the FIRST argument of an assertion —
 * true for every length that exists. The leading character class excludes commas, so
 * `assert.equal(foo, items.length >= 0)` (comparing a predicate's value) is NOT flagged:
 * only the form where the unfalsifiable comparison *is* the asserted subject.
 */
const RE_LENGTH_FLOOR = new RegExp(
  `\\bassert\\s*(?:\\.\\s*(?:ok|${EQUALITY_FNS}))?\\s*\\(\\s*[^(),]*\\.length\\s*(?:>=\\s*0\\b|>=\\s*-1\\b|>\\s*-1\\b)`,
);

/** `assert.equal(true, true)` and the identical-literal family. */
const RE_LITERAL_PAIR = new RegExp(
  `\\bassert\\s*\\.\\s*(?:${EQUALITY_FNS})\\s*\\(\\s*(${LITERAL})\\s*,\\s*\\1\\s*[,)]`,
);

/** Same identifier on both sides: `assert.equal(x, x)`, `assert.strictEqual(a.b, a.b)`. */
const RE_SAME_OPERAND = new RegExp(
  `\\bassert\\s*\\.\\s*(?:${EQUALITY_FNS})\\s*\\(\\s*(${OPERAND})\\s*,\\s*\\1\\s*[,)]`,
);

/** Any assertion call — the guard that a length-floor match is *inside* an assertion. */
const RE_ASSERT = /\bassert\b/;

/** A bare literal, so the same-operand rule defers to the literal-pair rule. */
const LITERAL_ONLY_RE = /^(?:true|false|null|undefined|-?\d+(?:\.\d+)?)$/;

/** Unclosed `(` count on a masked line — gates the continued-call window. */
function openParens(line) {
  let open = 0;
  for (const c of line) {
    if (c === "(") open += 1;
    else if (c === ")") open -= 1;
  }
  return open;
}

/**
 * A line plus its continuation lines, while the call opened on it is still open (bounded
 * at `maxLines`). The F-12 house style wraps long calls, so `assert.ok(items` /
 * `  .length >= 0)` has to be judged as one expression.
 */
function continuedWindow(lines, start, maxLines = 8) {
  let text = lines[start] ?? "";
  let depth = openParens(text);
  let i = start + 1;
  while (depth > 0 && i < lines.length && i - start < maxLines) {
    text += ` ${lines[i]}`;
    depth += openParens(lines[i]);
    i += 1;
  }
  return text;
}

// ---------------------------------------------------------------------------
// Rule 1b — presence-only subjects and typeof-only assertions
//
// R9-f06 named two blind spots: `assert.ok(obj)` that only establishes presence,
// and assertions whose sole evidence is a `typeof`. Both are only a REAL gap
// (a test that can never fail) in their unfalsifiable form, which is what these
// two predicates match:
//   - the asserted subject is an expression that is truthy by construction
//     (`{…}`, `[…]`, `() => …`, `/re/`, `new X()`, a non-empty string/number,
//     or a bare `typeof x`, which always yields a non-empty string);
//   - `typeof <literal>` compared against that literal's own type.
// A weak-but-falsifiable assertion (`assert.ok(maybeUndefined)`,
// `assert.equal(typeof x, "string")` where x is a real value) is deliberately
// NOT flagged: it can fail, so it is a weak test, not a test that cannot fail.
// ---------------------------------------------------------------------------

/** `text` is a single balanced `open`…`close` literal spanning the whole string. */
function balancedOnly(text, open, close) {
  if (!text.startsWith(open) || !text.endsWith(close)) return false;
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === open) depth += 1;
    else if (text[i] === close) {
      depth -= 1;
      if (depth === 0 && i !== text.length - 1) return false;
    }
  }
  return depth === 0;
}

/** Parens/brackets/braces balance back to zero only at the final character. */
function bracketsBalanceToEnd(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") {
      depth -= 1;
      if (depth === 0 && i !== text.length - 1) return false;
    }
  }
  return depth === 0;
}

/**
 * Why the asserted subject can never be falsy, or `null` when it can.
 * `maskedArg` decides structure (strings/regex bodies are blanked there, so a
 * `}` inside a fixture string cannot confuse the brackets); `rawArg` decides
 * literal *content* (string/number/regex).
 */
function alwaysTruthySubject(maskedArg, rawArg) {
  if (!maskedArg) return null;
  if (balancedOnly(maskedArg, "{", "}")) return "an object literal";
  if (balancedOnly(maskedArg, "[", "]")) return "an array literal";
  if (/^(?:async\s+)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(maskedArg)) return "a function expression";
  if (/^(?:async\s+)?function\b/.test(maskedArg)) return "a function expression";
  if (/^new\s/.test(maskedArg) && bracketsBalanceToEnd(maskedArg)) return "a `new` expression";
  if (/^typeof\b[^=!<>|&?:;,]*$/.test(maskedArg)) return "a bare `typeof` expression (always a non-empty string)";
  if (/^\/(?:\\.|\[[^\]]*\]|[^/\\\n])+\/[gimsuy]*$/.test(rawArg)) return "a regex literal";
  if (/^"(?:[^"\\]|\\.)+"$/.test(rawArg) || /^'(?:[^'\\]|\\.)+'$/.test(rawArg)) {
    return "a non-empty string literal";
  }
  if (rawArg.length > 2 && /^`[\s\S]+`$/.test(rawArg)) return "a non-empty template literal";
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(rawArg) && Number(rawArg) !== 0) return "a non-zero number literal";
  return null;
}

/** The `typeof` value of a literal written inline, or `null` when not a literal. */
function typeofOfLiteral(text) {
  if (text === "null") return "object";
  if (text === "undefined") return "undefined";
  if (text === "true" || text === "false") return "boolean";
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text) || /^0[xob][0-9a-fA-F]+$/.test(text)) {
    return "number";
  }
  if (/^-?\d+n$/.test(text)) return "bigint";
  if (/^"(?:[^"\\]|\\.)*"$/.test(text) || /^'(?:[^'\\]|\\.)*'$/.test(text) || /^`[\s\S]*`$/.test(text)) {
    return "string";
  }
  if (balancedOnly(text, "[", "]") || balancedOnly(text, "{", "}")) return "object";
  if (/^(?:async\s+)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(text) || /^(?:async\s+)?function\b/.test(text)) {
    return "function";
  }
  if (/^\/(?:\\.|\[[^\]]*\]|[^/\\\n])+\/[gimsuy]*$/.test(text)) return "object";
  return null;
}

/** Top-level argument spans of the call whose parens are `open`…`close`. */
function callArgs(masked, open, close) {
  const args = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open + 1; i < close; i += 1) {
    const c = masked[i];
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") depth -= 1;
    else if (c === "," && depth === 0) {
      args.push([start, i]);
      start = i + 1;
    }
  }
  args.push([start, close]);
  return args;
}

/** Every `assert(...)` / `assert.ok(...)` call and its top-level argument spans. */
function assertCalls(masked) {
  const calls = [];
  const re = /(?<![.\w$])assert\b(?:\s*\.\s*ok\b)?\s*\(/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(masked, open);
    if (close === -1) continue;
    calls.push({ args: callArgs(masked, open, close) });
  }
  return calls;
}

/**
 * Tautological assertions, one finding per (line, rule). Returns
 * `{ line, offset, rule, reason, snippet }[]` (offset = index of the match, for callers
 * that want columns; line is 1-based).
 */
export function findTautologies(source) {
  const masked = maskSource(source);
  const starts = lineIndex(source);
  const findings = [];
  const seen = new Set();
  const push = (offset, rule, reason) => {
    const line = lineAt(starts, offset);
    const key = `${line}|${rule}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ line, offset, rule, reason, snippet: rawLine(source, starts, offset) });
  };
  // Scan line-by-line on the masked text so multi-line call shapes are naturally bounded
  // (an assertion split across lines is still one finding on its first line). The
  // length-floor rule additionally gets a two-line window: the F-12 house style wraps long
  // calls, and `assert.ok(items\n  .length >= 0)` must not slip through.
  const maskedLines = masked.split("\n");
  for (let li = 0; li < maskedLines.length; li += 1) {
    const line = maskedLines[li];
    const offset = starts[li] ?? 0;
    if (!RE_ASSERT.test(line)) continue;
    if (RE_TRUE_LITERAL.test(line)) {
      push(offset, RULE_TRUE_LITERAL, "asserting a literal `true` can never fail");
    }
    // The continued-call window only applies while the assertion opened on this line is
    // still open — otherwise a well-formed line would "borrow" the next line's
    // `.length >= 0` and misfire.
    if (RE_LENGTH_FLOOR.test(line) || (openParens(line) > 0 && RE_LENGTH_FLOOR.test(continuedWindow(maskedLines, li)))) {
      push(offset, RULE_LENGTH_FLOOR, "`.length >= 0` is true for every length that exists");
    }
    if (RE_LITERAL_PAIR.test(line)) {
      push(offset, RULE_LITERAL_PAIR, "both operands are the same literal — the comparison cannot fail");
    }
    const same = RE_SAME_OPERAND.exec(line);
    if (same && !LITERAL_ONLY_RE.test(same[1])) {
      push(offset, RULE_SAME_OPERAND, "both operands are the same expression — the comparison cannot fail");
    }
  }

  // Presence-only subjects (R9-f06): `assert.ok(<always-truthy>)`. Scanned over the
  // whole masked source so a wrapped, multi-line call is judged as one expression.
  for (const call of assertCalls(masked)) {
    const [s, e] = call.args[0];
    const why = alwaysTruthySubject(masked.slice(s, e).trim(), source.slice(s, e).trim());
    if (why) {
      push(s, RULE_PRESENCE_ONLY, `asserting ${why} — always truthy, so the assertion cannot fail`);
    }
  }

  // typeof-only assertions (R9-f06): `assert.equal(typeof <literal>, "<its own type>")`.
  const RE_TYPEOF_LITERAL_CALL =
    /(?<![.\w$])assert\s*\.\s*(?:equal|strictEqual|deepEqual|deepStrictEqual)\s*\(/g;
  let tm;
  while ((tm = RE_TYPEOF_LITERAL_CALL.exec(masked)) !== null) {
    const open = tm.index + tm[0].length - 1;
    const close = matchParen(masked, open);
    if (close === -1) continue;
    const args = callArgs(masked, open, close);
    if (args.length < 2) continue;
    const first = source.slice(args[0][0], args[0][1]).trim();
    const second = source.slice(args[1][0], args[1][1]).trim();
    const operand = /^typeof\s+([\s\S]+)$/.exec(first);
    if (!operand) continue;
    const type = typeofOfLiteral(operand[1].trim());
    if (type && (second === `"${type}"` || second === `'${type}'`)) {
      push(
        args[0][0],
        RULE_TYPEOF_ONLY,
        "`typeof` of an inline literal compared against its own type — the assertion cannot fail",
      );
    }
  }

  return findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}

// ---------------------------------------------------------------------------
// Rule 2 — zero-assertion test blocks
// ---------------------------------------------------------------------------

const RULE_ZERO_ASSERT = "zero-assertion";
/**
 * Something that can actually fail the test: an assertion call, or a throw path. A test
 * whose callback has neither is the F-12 class — it reports green for having run.
 */
const RE_FAILING_SIGNAL = /\bassert|\bthrow|\brejects\b/;
/** `it`, `test` and their `.only`/`.skip`/`.todo` variants — never `describe`, never `x.test`. */
const RE_TEST_CALL = /(?<![.\w$])(?:it|test)(?:\.[A-Za-z_$][\w$]*)?\s*\(/g;
/** The callback must exist — `test.skip("name")` with no body is a skip, not an empty test. */
const RE_CALLBACK = /=>|\bfunction\b/;

/** Find the matching close paren of the call whose open paren is at `open`. */
function matchParen(masked, open) {
  let depth = 0;
  for (let i = open; i < masked.length; i += 1) {
    const c = masked[i];
    if (c === "(") depth += 1;
    else if (c === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * `it(...)` / `test(...)` callbacks that contain no `assert` call at all — a test whose
 * green light is structural (it ran, it threw nothing) rather than evidential.
 */
export function findZeroAssertionTests(source) {
  const masked = maskSource(source);
  const starts = lineIndex(source);
  const findings = [];
  RE_TEST_CALL.lastIndex = 0;
  let m;
  while ((m = RE_TEST_CALL.exec(masked)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(masked, open);
    if (close === -1) continue;
    const inner = masked.slice(open + 1, close);
    if (!RE_CALLBACK.test(inner)) continue; // no callback body — a declaration, not a test
    if (RE_FAILING_SIGNAL.test(inner)) continue; // assertions, or a real throw path
    const rawInner = source.slice(open + 1, close);
    findings.push({
      line: lineAt(starts, m.index),
      offset: m.index,
      rule: RULE_ZERO_ASSERT,
      reason: `test has no assertion and no throw — callback "${callLabel(rawInner)}" cannot fail`,
      snippet: rawLine(source, starts, m.index),
    });
  }
  return findings.sort((a, b) => a.line - b.line);
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

/** Every rule, applied to one file's source. */
export function lintSource(source, file) {
  return [...findTautologies(source), ...findZeroAssertionTests(source)]
    .sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule))
    .map((f) => ({ ...f, file }));
}

/**
 * Test-shaped files under `dir`. An unreadable directory is NOT silently an
 * empty one — it is collected (fail closed): a lint that skipped a subtree
 * would report "clean" over files it never read.
 */
function listTestFiles(dir) {
  const found = [];
  const unreadable = [];
  const walk = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      unreadable.push(current);
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || WALK_SKIP.has(entry.name)) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (TEST_FILE_RE.test(entry.name)) found.push(full);
    }
  };
  walk(dir);
  return { found, unreadable };
}

/**
 * Resolve CLI targets to concrete files. Explicit files are linted as given; directories
 * are walked and filtered to the test-file shape.
 * Returns `{ files, missing, unreadable }` — `unreadable` paths are a failure, never a
 * silent skip (an unread file cannot be certified clean).
 */
export function resolveTargets(entries, root = projectRoot()) {
  const missing = [];
  const files = [];
  const unreadable = [];
  for (const entry of entries.length ? entries : DEFAULT_TARGETS) {
    const abs = resolve(root, entry);
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      missing.push(entry);
      continue;
    }
    if (stat.isDirectory()) {
      const walked = listTestFiles(abs);
      files.push(...walked.found);
      unreadable.push(...walked.unreadable);
    } else files.push(abs);
  }
  return { files: [...new Set(files)].sort(), missing, unreadable };
}

/** Lint resolved paths. Returns `{ findings, unreadable }` — see `resolveTargets`. */
export function lintFiles(files, root = projectRoot()) {
  const findings = [];
  const unreadable = [];
  for (const file of files) {
    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      unreadable.push(file);
      continue;
    }
    for (const f of lintSource(source, file)) {
      // POSIX separators in the report: the output is meant to be grep-able and pasted
      // into logs on any platform (this repo is developed on Windows).
      findings.push({ ...f, file: (relative(root, file) || file).replace(/\\/g, "/") });
    }
  }
  return { findings, unreadable };
}

/** One-line, grep-able rendering: `file:line: [rule] reason — <source line>`. */
export function formatFinding(f) {
  return `${f.file}:${f.line}: [${f.rule}] ${f.reason} — ${f.snippet}`;
}

function main(argv) {
  const json = argv.includes("--json");
  const entries = argv.filter((a) => !a.startsWith("--"));
  const root = projectRoot();
  const { files, missing, unreadable } = resolveTargets(entries, root);
  if (missing.length) {
    console.error(`[assertion-gap] no such path: ${missing.join(", ")}`);
    process.exit(2);
  }
  if (files.length === 0) {
    console.error("[assertion-gap] no test files resolved — nothing to check");
    process.exit(2);
  }
  const linted = lintFiles(files, root);
  const findings = linted.findings;
  const unreadableAll = [...unreadable, ...linted.unreadable];
  if (json) {
    console.log(
      JSON.stringify({ files: files.length, findings, unreadable: unreadableAll }, null, 2),
    );
  } else {
    for (const f of findings) console.log(formatFinding(f));
    const scope = `${files.length} test file${files.length === 1 ? "" : "s"}`;
    if (findings.length === 0 && unreadableAll.length === 0) {
      console.log(`[assertion-gap] clean — ${scope} scanned, 0 findings`);
    } else if (findings.length > 0) {
      console.log(`[assertion-gap] ${findings.length} finding(s) across ${scope} — fix the assertion, do not delete it`);
    }
  }
  if (unreadableAll.length > 0) {
    // Fail closed: a subtree/file this lint could not read is not a clean one.
    console.error(
      `[assertion-gap] could not read ${unreadableAll.length} path(s) — refusing to report clean: ${unreadableAll.join(", ")}`,
    );
    process.exit(2);
  }
  process.exit(findings.length === 0 ? 0 : 1);
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2));
}
