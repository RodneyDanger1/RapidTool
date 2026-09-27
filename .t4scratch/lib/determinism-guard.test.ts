// ---------------------------------------------------------------------------
// determinism-guard.test.ts — 109 T-15: the repo-wide determinism guard.
//
// RapidTool's core contract: the pure engine is deterministic — same Project
// in ⇒ byte-identical artifact out (`design.ts:8`, `vector.ts:44` both say so
// in their headers). Wall-clock reads (`Date.now`) and ambient randomness
// (`Math.random`) inside a derivation module silently break that contract
// (two runs of the same brief would differ), so this suite scans the
// derivation modules' SOURCE on disk for those two tokens and fails on any
// undisclosed hit. Comments are masked before scanning (both module headers
// *mention* `Date.now()` while forbidding it — a naive grep would red them).
//
// SCOPE + THE DOCUMENTED EXCEPTION (W4-L5 lane plan item 6):
//   • Clean, must stay at ZERO matches: `design.ts`, `diagram.ts`, `vector.ts`,
//     `brief-fixtures.ts` (W4 grep: clean; re-verified by this suite each run).
//   • `algorithms.ts` is the DOCUMENTED EXCEPTION: its AlgorithmTrace rows carry
//     exactly six real `ranAt: Date.now()` stamps (`algorithms.ts:1050-1087`,
//     ids A1/A3/A5/A6/A7/A8) — arrival-time telemetry for the trace timeline,
//     never input to a derived artifact. It is scanned WITH a per-line
//     allowance: only a line that is exactly `ranAt: Date.now(),` (after
//     comment masking) may match; ANY other `Date.now` / `Math.random` in
//     `algorithms.ts` is a finding. The exception is pinned in count too — a
//     seventh stamp (or a non-trace second user) must be a deliberate,
//     reviewed edit, not a silent drift.
//   • Everything else is out of this guard's declared scope (owned by other
//     lanes); the scan list is explicit so widening it is a visible edit.
//
// TEETH (T-15 requires a planted violation): the scanner is a pure function,
// exercised below against planted-violation fixtures — a source string with
// `Date.now(` MUST come back with a finding, and the `ranAt` allowance must
// NOT swallow neighbouring nondeterminism.
//
// Run: node --experimental-strip-types --test src/lib/determinism-guard.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** One scan hit: the token, its 1-based source line, the masked code line and the raw line. */
type DeterminismFinding = {
  token: "Date.now" | "Math.random";
  line: number;
  /** Masked (comment-free) line content, trimmed — this is what the allowance tests. */
  code: string;
  /** Raw source line, trimmed — what a human sees when the guard goes red. */
  raw: string;
};

/** The two nondeterminism tokens this guard enforces (109 T-15). */
const NONDETERMINISM_TOKENS = /\bDate\.now\b|\bMath\.random\b/g;

/**
 * 109 T-15 — mask line comments (`//`) and block comments (the slash-star pair)
 * with spaces, preserving every character offset and newline so reported line
 * numbers stay exact. String literals are treated as code on purpose: a
 * literal is still worth a human look, and masking strings could hide real code.
 */
function maskComments(source: string): string {
  const chars = source.split("");
  let state: "code" | "line" | "block" | "single" | "double" | "tpl" = "code";
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    const n = chars[i + 1];
    if (state === "code") {
      if (c === "/" && n === "/") {
        state = "line";
        chars[i] = " ";
        chars[i + 1] = " ";
        i += 2;
        continue;
      }
      if (c === "/" && n === "*") {
        state = "block";
        chars[i] = " ";
        chars[i + 1] = " ";
        i += 2;
        continue;
      }
      if (c === "'") state = "single";
      else if (c === '"') state = "double";
      else if (c === "`") state = "tpl";
      i += 1;
      continue;
    }
    if (state === "line") {
      if (c === "\n") state = "code";
      else chars[i] = " ";
      i += 1;
      continue;
    }
    if (state === "block") {
      if (c === "*" && n === "/") {
        chars[i] = " ";
        chars[i + 1] = " ";
        state = "code";
        i += 2;
        continue;
      }
      if (c !== "\n") chars[i] = " ";
      i += 1;
      continue;
    }
    // Inside a string literal: keep the content (it is code, not a comment).
    if (c === "\\") {
      i += 2;
      continue;
    }
    if ((state === "single" && c === "'") || (state === "double" && c === '"') || (state === "tpl" && c === "`")) {
      state = "code";
    }
    i += 1;
  }
  return chars.join("");
}

/** 109 T-15 — the pure scanner: mask comments, then report every `Date.now` / `Math.random` token. */
function scanForNondeterminism(source: string): DeterminismFinding[] {
  const masked = maskComments(source);
  const rawLines = source.split("\n");
  const maskedLines = masked.split("\n");
  const findings: DeterminismFinding[] = [];
  const re = new RegExp(NONDETERMINISM_TOKENS.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(masked)) !== null) {
    let line = 1;
    for (let i = 0; i < match.index; i += 1) if (masked[i] === "\n") line += 1;
    findings.push({
      token: match[0] as DeterminismFinding["token"],
      line,
      code: (maskedLines[line - 1] ?? "").trim(),
      raw: (rawLines[line - 1] ?? "").trim(),
    });
  }
  return findings;
}

/**
 * 109 T-15 — the DOCUMENTED algorithms.ts exception: only the six AlgorithmTrace
 * `ranAt: Date.now(),` stamps (A1/A3/A5/A6/A7/A8) may read the clock. Trailing
 * comment allowed (masked away before the test); anything else is a finding.
 */
const RAN_AT_ALLOWANCE = /^ranAt: Date\.now\(\),$/;

/** Modules that must be at zero: the T-15 guard list (source files, resolved next to this suite). */
const CLEAN_MODULES = ["design.ts", "diagram.ts", "vector.ts", "brief-fixtures.ts"] as const;
/** The documented exception module (see the header comment above — MANDATORY scope note). */
const DOCUMENTED_EXCEPTION_MODULE = "algorithms.ts";
/** The six AlgorithmTrace stamps on disk at the T-15 landing (2026-09-16). */
const RAN_AT_STAMP_COUNT = 6;

const readModule = (file: string): string => readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), "utf8");

describe("109 T-15 — determinism guard (source scan)", () => {
  it("derivation modules are clean: no Date.now / Math.random in design/diagram/vector/brief-fixtures", () => {
    for (const file of CLEAN_MODULES) {
      const source = readModule(file);
      assert.ok(source.length > 1000, `${file} came back suspiciously small (${source.length} chars) — the guard must scan real sources`);
      const findings = scanForNondeterminism(source);
      assert.deepEqual(
        findings.map((f) => `${file}:${f.line} ${f.token} — ${f.raw}`),
        [] as string[],
        `${file} must be deterministic (no Date.now / Math.random); add the documented exception here or remove the token`,
      );
    }
  });

  it("algorithms.ts: only the documented ranAt trace stamps read the clock (any other hit fails)", () => {
    const source = readModule(DOCUMENTED_EXCEPTION_MODULE);
    const findings = scanForNondeterminism(source);
    const allowed = findings.filter((f) => RAN_AT_ALLOWANCE.test(f.code));
    const disallowed = findings.filter((f) => !RAN_AT_ALLOWANCE.test(f.code));
    assert.deepEqual(
      disallowed.map((f) => `${DOCUMENTED_EXCEPTION_MODULE}:${f.line} ${f.token} — ${f.raw}`),
      [] as string[],
      `${DOCUMENTED_EXCEPTION_MODULE} may only carry the documented ranAt stamps; other nondeterminism must be removed or the exception widened by a reviewed edit`,
    );
    assert.equal(
      allowed.length,
      RAN_AT_STAMP_COUNT,
      `${DOCUMENTED_EXCEPTION_MODULE} should hold exactly ${RAN_AT_STAMP_COUNT} ranAt stamps (A1/A3/A5/A6/A7/A8); got ${allowed.length} — a deliberate change must update this guard and its header comment`,
    );
  });

  it("TEETH: planted `Date.now(` / `Math.random(` violations are flagged, masked mentions are not", () => {
    const planted = [
      "export const stamp = () => Date.now();", // line 1 — violation
      "// a comment that mentions Date.now( while forbidding it — masked, NOT a finding", // line 2
      "const jitter = Math.random() * 10;", // line 3 — violation
      "/* block comment naming Date.now( and Math.random( — masked too */", // line 4
      'const label = "plain string mentioning Date.now(";', // line 5 — strings are code: still flagged
    ].join("\n");
    const findings = scanForNondeterminism(planted);
    assert.deepEqual(
      findings.map((f) => [f.line, f.token]),
      [
        [1, "Date.now"],
        [3, "Math.random"],
        [5, "Date.now"],
      ],
      `planted violations must be found (and masked comment mentions must not): ${JSON.stringify(findings)}`,
    );
  });

  it("TEETH: the ranAt allowance does not swallow neighbouring nondeterminism", () => {
    const planted = [
      "      ranAt: Date.now(),", // 1 — allowed (documented exact form)
      "      ranAt: Date.now(), // trace stamp with a trailing note", // 2 — allowed (comment masked)
      "      other: Date.now(),", // 3 — NOT allowed (wrong property)
      "const t = Date.now();", // 4 — NOT allowed (bare read)
    ].join("\n");
    const findings = scanForNondeterminism(planted);
    assert.equal(findings.length, 4, `every token is reported before the allowance filters: ${JSON.stringify(findings)}`);
    const disallowed = findings.filter((f) => !RAN_AT_ALLOWANCE.test(f.code));
    assert.deepEqual(
      disallowed.map((f) => [f.line, f.raw]),
      [
        [3, "other: Date.now(),"],
        [4, "const t = Date.now();"],
      ],
      `only the exact ranAt form may pass the allowance: ${JSON.stringify(disallowed)}`,
    );
  });
});
