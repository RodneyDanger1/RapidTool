/**
 * W23 L6 (G4 · research/multiagent/249_define_first_specs.md §SPEC 3, OV-21 fold)
 * — emitted-tree error-signal scan.
 *
 * The gap this closes: `compile-check.server.ts` answers "does it compile / do
 * the tests pass", never "is the failure handling silent". A tree can compile,
 * its specs can pass, and still ship `catch { return false; }`-class swallows
 * (scaffold.ts emits two such shapes TODAY) with ZERO signal anywhere.
 *
 * Posture (218 §3.4 · OV-21): an ADVISORY FINDING SURFACE, never a gate — it is
 * not wired into `scripts/gate.sh`, is never called by `emit`, and every finding
 * is labelled `advisory: true` because the rules are lexer-level heuristics that
 * can false-positive. A finding is a prompt to look, not a verdict.
 *
 * Rules (deterministic, line-preserving):
 *   R1 `catch-empty`                  — a catch clause whose body holds no
 *                                       statement (only blanks/comments).
 *   R2 `catch-swallowed`              — a catch clause with ≥1 statement, none
 *                                       of which is `throw`, an `RT_E_` mention,
 *                                       `console.`, `.warn(`, `.error(`, `report(`.
 *   R3 `neutral-return-unimplemented` — a standalone `return "";` / `return '';` /
 *                                       `return [];` / `return -1;` whose 5
 *                                       preceding RAW lines name an
 *                                       unimplemented-family marker (OV-21: a
 *                                       silent neutral return next to a "TODO/
 *                                       stub/placeholder" comment must require
 *                                       an RT_E_* code — or the marker's removal).
 *
 * Read-only by construction: no write path exists in this module. The scan is
 * NEVER swallowed itself — an unreadable/absent dir or a dir with zero
 * resolvable files is a coded refusal (`ok: false` + `RT_E_VALIDATION`), never a
 * silent empty result; the function never throws.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { maskLiteralsAndComments } from "./sandbox.ts";
import type { ErrorCode } from "./errors.ts";

export type ErrorScanRule = "catch-empty" | "catch-swallowed" | "neutral-return-unimplemented";

export type ErrorScanFinding = {
  /** Repo-relative-to-dir path of the scanned file (posix separators). */
  path: string;
  /** 1-based line of the signal. */
  line: number;
  rule: ErrorScanRule;
  /** The RAW source line, trimmed and capped — the reader's prompt to look. */
  snippet: string;
  advisory: true;
};

export type ErrorScanResult =
  | { ok: true; dir: string; scanned: { files: number; lines: number }; findings: ErrorScanFinding[] }
  | { ok: false; dir: string; code: ErrorCode; error: string };

/** The gate-3 scanner's walk-skip set (check-assertion-gaps.mjs:53, same list). */
const WALK_SKIP = new Set(["node_modules", ".git", ".vercel", "dist", "build", "coverage", ".output"]);
const SCAN_EXT = /\.(ts|tsx|js|mjs)$/;
const SNIPPET_CAP = 160;

/** A catch clause header (`catch`, optional binding) up to its opening brace. */
const CATCH_RE = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
/** R2's deliberate allowlist — a mention is a signal to look, so missing one is
 *  a prompt, not a verdict (advisory: true). `throw` is matched as the KEYWORD
 *  (`\bthrow\b`), not a substring: a plain `includes("throw")` counted
 *  `throwaway();` / `rethrow(e);` as loud, silently suppressing a real
 *  swallow (found by scratch probe). The remaining tokens stay substring
 *  mentions by the rule's own wording ("an `RT_E_` mention", `console.`, …). */
const CATCH_ALLOW_RE = [/\bthrow\b/, /RT_E_/, /console\./, /\.warn\(/, /\.error\(/, /report\(/];
/** R3: a STANDALONE neutral return (nothing else on the line). */
const NEUTRAL_RETURN_RE = /^\s*return\s+(?:"{2}|'{2}|\[\]|-1)\s*;\s*$/;
const UNIMPLEMENTED_RE = /unimplemented|not implemented|todo|stub|placeholder|not yet/i;
const ADJACENCY_LINES = 5;

const snippetOf = (line: string): string => line.trim().slice(0, SNIPPET_CAP);

/** Line number (1-based) of a character index, on length-preserving text. */
function lineOf(text: string, index: number): number {
  let line = 1;
  const end = Math.min(index, text.length);
  for (let i = 0; i < end; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

/** Index of the brace matching the one at `openIndex`, or -1 (unbalanced). */
function matchingBrace(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** R1 + R2 over the MASKED source (comments/strings blanked, line numbers kept). */
function scanCatchClauses(path: string, raw: string, findings: ErrorScanFinding[]): void {
  const masked = maskLiteralsAndComments(raw);
  const rawLines = raw.split(/\r?\n/);
  CATCH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CATCH_RE.exec(masked)) !== null) {
    const open = m.index + m[0].length - 1; // the regex ends ON the opening brace
    const close = matchingBrace(masked, open);
    if (close === -1) continue; // unbalanced text — nothing analyzable here
    const body = masked.slice(open + 1, close);
    // Masking preserves LENGTH and character INDEX (each masked span is
    // replaced by same-length spaces) but NOT newline count: newlines inside a
    // block comment / template literal become spaces. Counting lines on the
    // masked text therefore under-reports every position after a multi-line
    // comment — the reported line (and its snippet) pointed above the real
    // catch. Count on RAW at the identical index instead.
    const line = lineOf(raw, m.index);
    const snippet = snippetOf(rawLines[line - 1] ?? "");
    if (body.trim() === "") {
      findings.push({ path, line, rule: "catch-empty", snippet, advisory: true });
      continue;
    }
    if (!CATCH_ALLOW_RE.some((re) => re.test(body))) {
      findings.push({ path, line, rule: "catch-swallowed", snippet, advisory: true });
    }
  }
}

/** R3 (OV-21) over the RAW lines: comments must stay visible for the marker. */
function scanNeutralReturns(path: string, raw: string, findings: ErrorScanFinding[]): void {
  const rawLines = raw.split(/\r?\n/);
  for (let i = 0; i < rawLines.length; i += 1) {
    const line = rawLines[i];
    if (!NEUTRAL_RETURN_RE.test(line)) continue;
    const from = Math.max(0, i - ADJACENCY_LINES);
    const window = rawLines.slice(from, i).join("\n");
    if (!UNIMPLEMENTED_RE.test(window)) continue;
    findings.push({ path, line: i + 1, rule: "neutral-return-unimplemented", snippet: snippetOf(line), advisory: true });
  }
}

/** Collect `*.ts|tsx|js|mjs` paths under `root` (posix-joined, walk-skip set applied). */
function collectFiles(root: string, rel: string, out: string[]): void {
  for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (WALK_SKIP.has(entry.name)) continue;
    const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) collectFiles(root, childRel, out);
    else if (entry.isFile() && SCAN_EXT.test(entry.name)) out.push(childRel);
  }
}

const refusal = (dir: string, error: string, code: ErrorCode = "RT_E_VALIDATION"): ErrorScanResult => ({
  ok: false,
  dir,
  code,
  error,
});

/**
 * Scan an emitted (or any) tree for the three error-signal rules. Read-only,
 * deterministic (findings sorted by path → line → rule), total (never throws).
 */
export function scanTreeErrorSignals(dir: string): ErrorScanResult {
  const target = resolve(dir);
  try {
    let stat;
    try {
      stat = statSync(target);
    } catch {
      return refusal(target, `scan: dir ${target} is not readable`);
    }
    if (!stat.isDirectory()) return refusal(target, `scan: ${target} is not a directory`);

    const files: string[] = [];
    collectFiles(target, "", files);
    files.sort();
    if (files.length === 0) {
      return refusal(
        target,
        `scan: ${target} holds no .ts/.tsx/.js/.mjs file — nothing to scan (a silent empty result is forbidden)`,
      );
    }

    const findings: ErrorScanFinding[] = [];
    let lines = 0;
    for (const rel of files) {
      let raw: string;
      try {
        raw = readFileSync(join(target, rel), "utf8");
      } catch (err) {
        return refusal(
          target,
          `scan: ${rel} is not readable (${err instanceof Error ? err.message : String(err)})`,
        );
      }
      lines += raw.split(/\r?\n/).length;
      scanCatchClauses(rel, raw, findings);
      scanNeutralReturns(rel, raw, findings);
    }
    findings.sort((a, b) =>
      a.path === b.path
        ? a.line === b.line
          ? a.rule.localeCompare(b.rule)
          : a.line - b.line
        : a.path.localeCompare(b.path),
    );
    return { ok: true, dir: target, scanned: { files: files.length, lines }, findings };
  } catch (err) {
    // The scanner is never swallowed itself: an unexpected failure is surfaced
    // coded, never an empty finding list.
    return refusal(target, `scan: unexpected failure — ${err instanceof Error ? err.message : String(err)}`, "RT_E_INTERNAL");
  }
}
