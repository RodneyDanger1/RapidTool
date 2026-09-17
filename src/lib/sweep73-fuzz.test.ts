// ---------------------------------------------------------------------------
// sweep73-fuzz.test.ts — S3 pure-module re-sweep: hostile-input fuzzing,
// determinism, and not-configured honesty across every owned pure module.
//
// Invariants asserted for every corpus input:
//   1. NO THROW  — parsers/sanitizers must fail closed, never crash.
//   2. DETERMINISM — same input ⇒ byte-identical output across two runs.
//   3. OUTPUT SANITY — module-specific structural invariants (idempotency,
//      boundedness, escaping) hold on whatever is returned.
//
// Run: node --experimental-strip-types --test src/lib/sweep73-fuzz.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MARKDOWN_TRUNCATION_MARK, renderMarkdownBlocks } from "./render.ts";
import {
  BADGE_TONES,
  generateBadge,
  geometricMonogram,
  monogramInitials,
  sanitizeSvg,
  svgToDataUrl,
  usedHexColors,
} from "./vector.ts";
import { extractPatterns, trendNotes } from "./harvest.ts";
import { lintFailures, parseOracleJson, sanitizeOracleExpression } from "./verify.server.ts";
import { parseWildReview, WILD_FEEDBACK_MIN } from "./wild-mode.server.ts";
import { JSON_ROLES, parseAgentOutput } from "./crew.server.ts";
import { KnowledgeStore } from "./knowledge.ts";
import {
  backlinksFor,
  buildVaultNotes,
  dailyNote,
  searchVaultScored,
  vaultIndex,
  vaultMarkdown,
} from "./vault.ts";
import {
  createTrace,
  formatDurationMs,
  recordSpan,
  spansAsText,
  traceSpan,
  traceSummary,
} from "./tracing.ts";
import { classifyError, codeError } from "./errors.ts";
import { countLooseEquals, participatedPhases, phaseStatusWeight, stripStringsAndComments } from "./bench.ts";
import {
  benchmarkHarness,
  complexityOf,
  exportedNamesOf,
  maskNonCode,
  parseAlgorithmSpecJson,
} from "./algo-tools.ts";
import {
  adrRecord,
  canonicalModuleId,
  dependencyGraph,
  resolveRelativeImport,
  scanLocalImports,
} from "./arch-tools.ts";
import { applyPolicies, parseExpandedSpecJson } from "./prompt-engine.ts";
import { scanForMarkers } from "./swarm.ts";
import { chatHistoryTurns } from "./chat.ts";
import { buildChatContext, chatContextVersion, chatOnceServer } from "./chat.server.ts";
import { mineCodebase, nameStyle } from "./ast-mine.ts";
import { designHtml, designTokens } from "./design.ts";
import { buildDiagram } from "./diagram.ts";
import { projectKindOf, scaffoldProject } from "./scaffold.ts";
import { seedProject } from "./testing/fixtures.ts";
import type { Project } from "./types.ts";

// ---------------------------------------------------------------------------
// Hostile corpus — unbalanced delimiters, huge strings, unicode, traversal.
// ---------------------------------------------------------------------------

const HOSTILE: string[] = [
  "",
  " ",
  "\n",
  "\r\n",
  "\t",
  "  \n  ",
  "\u0000",
  "\u0001\u0002",
  "\uFEFF",
  "\uFFFE",
  "\uFFFF",
  "\uD800",
  "\uDC00",
  "a\uD800b\uDC00c",
  "😀🎉🧪",
  "e\u0301caf\u00e9",
  "\u2028\u2029",
  "\u200B\u200C\u200D",
  "<",
  ">",
  "<>",
  "</",
  "/>",
  "<!--",
  "<![CDATA[",
  "<?xml",
  "<!DOCTYPE",
  "<script>alert(1)</script>",
  "javascript:alert(1)",
  "onload=alert(1)",
  "&",
  "&amp;",
  "&bogus;",
  "&#x0;",
  "&#0;",
  "&#x110000;",
  "&#xZZ;",
  "```",
  "````",
  "```json",
  "```ts\ncode()\n",
  "```\n```\n```",
  "#",
  "##",
  "###",
  "####",
  "#####",
  "######",
  "#######",
  "#".repeat(100),
  "-",
  "--",
  "---",
  "----",
  "*",
  "**",
  "***",
  "_",
  "__",
  "___",
  "- x",
  "* x",
  "1. x",
  "0. x",
  "1234567890. x",
  "9999999999.",
  "'\"`\\",
  "\"'\"'\"",
  "/*",
  "*/",
  "/* unclosed",
  "// unclosed",
  "'unclosed",
  "\"unclosed",
  "`unclosed",
  "../..",
  "..\\..\\evil",
  "a/../../b.ts",
  "C:\\Windows\\system32",
  "a:b",
  "CON",
  "PRN",
  "NUL",
  "a<b>c",
  "a\"b",
  "a'b",
  "`rm -rf /`",
  "${code}",
  "{{template}}",
  "%s%s%s",
  "x".repeat(1000),
  "x".repeat(100_000),
  "\n".repeat(1000),
  " ".repeat(10_000),
  "```".repeat(100),
  "`".repeat(5000),
  "'".repeat(5000),
  '"'.repeat(5000),
  "/".repeat(5000),
  "*".repeat(5000),
  "-".repeat(5000),
  "=".repeat(5000),
  "export function f() {}".repeat(50),
  "VERDICT: approve",
  "FEEDBACK: x",
  "VERDICT: reject FEEDBACK: " + "y".repeat(11),
  "[[wikilink",
  "[[wikilink]]",
  "a]]b",
  "[[a]] [[b]] [[c]]",
];

/** Error message when fn throws, else null. */
function errOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
}

/** Determinism: two invocations must produce byte-identical JSON. */
function assertDeterministic(fn: () => unknown, what: string, input: string): void {
  const a = JSON.stringify(fn());
  const b = JSON.stringify(fn());
  assert.equal(b, a, `non-deterministic ${what} for input ${JSON.stringify(input.slice(0, 60))}`);
}

function probe(
  fn: () => unknown,
  what: string,
  input: string,
  check?: (value: unknown) => void,
): void {
  const err = errOf(fn);
  assert.equal(err, null, `${what} threw for input ${JSON.stringify(input.slice(0, 60))}: ${err}`);
  assertDeterministic(fn, what, input);
  if (check) check(fn());
}

// ---------------------------------------------------------------------------
// render.ts — markdown block parser
// ---------------------------------------------------------------------------

describe("render.renderMarkdownBlocks — hostile fuzz", () => {
  it("never throws and is deterministic across the hostile corpus", () => {
    for (const s of HOSTILE) {
      probe(() => renderMarkdownBlocks(s), "renderMarkdownBlocks", s, (v) => {
        assert.ok(Array.isArray(v), "must return an array");
      });
    }
  });

  it("normalizes CR/CRLF, handles unclosed fences, headings past h3, and truncation", () => {
    // Unclosed fence runs to EOF and keeps the language.
    const fenced = renderMarkdownBlocks("```ts\nconst a = 1;\nno closing fence");
    assert.deepEqual(fenced, [{ type: "code", text: "const a = 1;\nno closing fence", lang: "ts" }]);

    // Six hashes are a paragraph, not an h4.
    assert.deepEqual(renderMarkdownBlocks("###### x"), [{ type: "p", text: "###### x" }]);
    // 10-digit ordered markers are paragraphs (cap is 9 digits).
    assert.deepEqual(renderMarkdownBlocks("9999999999. x"), [{ type: "p", text: "9999999999. x" }]);
    // CRLF + CR normalize.
    assert.deepEqual(renderMarkdownBlocks("a\r\nb\rc"), [{ type: "p", text: "a\nb\nc" }]);
    // Blank + tabs-only input.
    assert.deepEqual(renderMarkdownBlocks("\t \n  \t"), []);
    // Fence whose info string contains a backtick is NOT a fence.
    const weird = renderMarkdownBlocks("``` a`b");
    assert.equal(weird[0]?.type, "p");
    // Non-string input is an empty array (never a throw).
    assert.deepEqual(renderMarkdownBlocks(undefined as unknown as string), []);
    assert.deepEqual(renderMarkdownBlocks(42 as unknown as string), []);
  });

  it("truncates >64KiB inputs deterministically with the [truncated] marker", () => {
    const big = "```\n" + "a".repeat(70_000) + "\n```";
    const blocks = renderMarkdownBlocks(big);
    const again = renderMarkdownBlocks(big);
    assert.deepEqual(again, blocks, "truncated parse must be deterministic");
    const last = blocks[blocks.length - 1];
    assert.ok(last, "must emit blocks");
    assert.equal(last.type, "p");
    assert.equal(last.text, MARKDOWN_TRUNCATION_MARK);
    let total = 0;
    for (const b of blocks) total += b.text.length;
    assert.ok(total <= 70_000, `output must stay bounded, total=${total}`);
  });

  it("handles delimiters that look like markdown but are not (list/HR ambiguity)", () => {
    // "- -" is a list item whose text is "-", not an HR.
    assert.deepEqual(renderMarkdownBlocks("- -"), [{ type: "li", text: "-", ordered: false }]);
    // "- - -" is an HR per CommonMark-ish rule (3+ dashes with spaces? here 3
    // dash runs are NOT contiguous, so it is a list item "- - -" text "- -").
    const dashRun = renderMarkdownBlocks("- - -");
    assert.equal(dashRun.length, 1);
    // Indented 4 spaces is not a list item (paragraph).
    const indented = renderMarkdownBlocks("    - x");
    assert.equal(indented[0]?.type, "p");
  });
});

// ---------------------------------------------------------------------------
// vector.ts — SVG sanitizer + deterministic art floor
// ---------------------------------------------------------------------------

describe("vector.sanitizeSvg — hostile fuzz", () => {
  const VALID =
    '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="1" y="2" width="3" height="4" fill="#4338ca"/>' +
    '<text x="5" y="6" fill="#ffffff">Hi</text></svg>';

  it("never throws and is deterministic across the hostile corpus", () => {
    for (const s of [...HOSTILE, VALID]) {
      probe(() => sanitizeSvg(s), "sanitizeSvg", s, (v) => {
        const r = v as { ok: boolean };
        assert.equal(typeof r.ok, "boolean");
      });
    }
  });

  it("accepted output is idempotent, canonical, and free of dangerous content", () => {
    for (const s of [...HOSTILE, VALID]) {
      const r = sanitizeSvg(s);
      if (!r.ok) continue;
      const svg = (r as { svg: string }).svg;
      assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox='), svg.slice(0, 60));
      for (const forbidden of ["<script", "onload", "javascript:", "<!--", "<![CDATA[", "style=", "href="]) {
        assert.ok(!svg.toLowerCase().includes(forbidden), `forbidden ${forbidden} leaked into ${svg.slice(0, 80)}`);
      }
      // Idempotency: sanitizing the sanitized output is a byte-identical no-op.
      const again = sanitizeSvg(svg);
      assert.equal(again.ok, true, `re-sanitize failed: ${(again as { reason?: string }).reason}`);
      assert.equal((again as { svg: string }).svg, svg, "sanitizer must be idempotent");
    }
  });

  it("fails closed on structural hostility with specific reasons", () => {
    assert.equal(sanitizeSvg("").ok, false);
    assert.equal(sanitizeSvg("<svg></svg>").ok, false, "viewBox required");
    // viewBox present + empty body is VALID and canonical.
    const bare = sanitizeSvg('<svg viewBox="0 0 96 96"></svg>');
    assert.equal(bare.ok, true);
    assert.equal((bare as { svg: string }).svg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"></svg>');
    assert.equal(sanitizeSvg("<svg viewBox=\"0 0 96 96\"><svg></svg></svg>").ok, false, "nested svg rejected");
    assert.equal(sanitizeSvg("<rect x=\"0\" y=\"0\" width=\"1\" height=\"1\"/>").ok, false, "root must be svg");
    assert.equal(sanitizeSvg("<svg viewBox=\"0 0 96 96\"></svg></svg>").ok, false, "extra close rejected");
    assert.equal(sanitizeSvg("<svg viewBox=\"0 0 96 96\"><rect x=1 y=\"0\" width=\"1\" height=\"1\"/></svg>").ok, false, "unquoted attr");
    assert.equal(sanitizeSvg("<svg viewBox=\"0 0 96 96\"><rect x=\"1\" x=\"2\" y=\"0\" width=\"1\" height=\"1\"/></svg>").ok, false, "dup attr");
    assert.equal(sanitizeSvg("<svg viewBox=\"0 0 96 96\"><rect x=\"1\" y=\"0\" width=\"1\" height=\"1\" onload=\"x\"/></svg>").ok, false, "event attr");
    assert.equal(sanitizeSvg("<svg viewBox=\"0 0 96 96\" onload=\"x\"></svg>").ok, false, "root event attr");
    assert.equal(sanitizeSvg("<svg viewBox=\"0 0 96 96\"><rect x=\"1\" y=\"0\" width=\"1\" height=\"1\" style=\"fill:red\"/></svg>").ok, false, "style attr");
    assert.equal(sanitizeSvg("<svg viewBox=\"0 0 96 96\"><text x=\"1\" y=\"1\">a<b>c</text></svg>").ok, false, "markup inside text");
    assert.equal(sanitizeSvg("<SVG viewBox=\"0 0 96 96\"></SVG>").ok, false, "uppercase tag");
    assert.equal(sanitizeSvg(VALID + "garbage").ok, false, "trailing text");
    // Oversize input fails fast with a size reason (not a slow parse).
    const huge = '<svg viewBox="0 0 96 96">' + "<rect ".repeat(0) + " ".repeat(25_000) + "</svg>";
    const oversize = sanitizeSvg(huge);
    assert.equal(oversize.ok, false);
    assert.match((oversize as { reason: string }).reason, /too large/);
    // Deep nesting and element floods are bounded by explicit caps.
    const deep = '<svg viewBox="0 0 96 96">' + "<g>".repeat(60) + "</g>".repeat(60) + "</svg>";
    assert.match((sanitizeSvg(deep) as { reason: string }).reason, /depth|nested/i);
    const flood = '<svg viewBox="0 0 96 96">' + '<rect x="1" y="1" width="1" height="1"/>'.repeat(150) + "</svg>";
    assert.match((sanitizeSvg(flood) as { reason: string }).reason, /too many elements/);
  });

  it("svgToDataUrl sanitizes first and encodes the canonical svg", () => {
    const VALID2 =
      '<svg viewBox="0 0 96 96"><rect x="1" y="2" width="3" height="4" fill="#4338ca"/></svg>';
    const url = svgToDataUrl(VALID2);
    assert.ok(url !== null && url.startsWith("data:image/svg+xml;charset=utf-8,"));
    for (const bad of ["<script>x</script>", "<svg></svg>", "", "not svg at all", "a".repeat(25_000)]) {
      assert.equal(svgToDataUrl(bad), null, `junk must yield null, got ${bad.slice(0, 30)}`);
    }
    // Deterministic for identical input.
    assert.equal(svgToDataUrl(VALID2), svgToDataUrl(VALID2));
  });

  it("usedHexColors is deterministic and only reads fill/stroke hex values", () => {
    const s = '<svg viewBox="0 0 96 96"><rect fill="#4338ca"/><rect fill="#4338CA"/><circle stroke="#4338ca"/></svg>';
    const a = usedHexColors(s);
    const b = usedHexColors(s);
    assert.deepEqual(b, a);
    assert.deepEqual(usedHexColors(""), []);
    for (const junk of HOSTILE) {
      const err = errOf(() => usedHexColors(junk));
      assert.equal(err, null, `usedHexColors threw: ${err}`);
    }
  });

  it("monogramInitials is total, 1-2 chars, uppercase, deterministic", () => {
    assert.equal(monogramInitials(""), "RT");
    assert.equal(monogramInitials("Acme Dispatch"), "AD");
    assert.equal(monogramInitials("   "), "RT");
    for (const s of HOSTILE) {
      const err = errOf(() => monogramInitials(s));
      assert.equal(err, null, `monogramInitials threw on ${JSON.stringify(s.slice(0, 40))}: ${err}`);
      const out = monogramInitials(s);
      const cps = [...out];
      assert.ok(cps.length >= 1 && cps.length <= 2, `initials codepoints ${cps.length} for ${JSON.stringify(s.slice(0, 30))}`);
      assert.equal(out, out.toUpperCase(), "initials uppercase");
    }
  });

  it("geometricMonogram is byte-stable and always sanitizer-clean", () => {
    const seeds = [0, 1, 7, 123456789, 2 ** 31 - 1];
    for (const s of [...HOSTILE.slice(0, 40), "Acme", "A", "AB CD EF", "😀😀", "a\u0000b"]) {
      for (const seed of seeds) {
        const mono = geometricMonogram(s, seed);
        const again = geometricMonogram(s, seed);
        assert.equal(again, mono, "monogram must be byte-stable");
        const clean = sanitizeSvg(mono);
        assert.equal(clean.ok, true, `monogram failed sanitize: ${(clean as { reason: string }).reason}`);
      }
    }
    assert.equal(geometricMonogram("Acme", 1), geometricMonogram("Acme", 1));
    assert.notEqual(geometricMonogram("Acme", 1), geometricMonogram("Acme", 2), "seed changes output");
  });

  it("generateBadge escapes hostile labels and stays sanitize-clean", () => {
    for (const tone of [...BADGE_TONES]) {
      for (const s of ["ok", "", "a\"b<c>&d", "😀".repeat(5), "x".repeat(500), "\u0000\uD800"]) {
        const err = errOf(() => generateBadge(s, tone));
        assert.equal(err, null, `generateBadge threw: ${err}`);
        const badge = generateBadge(s, tone);
        assert.equal(badge, generateBadge(s, tone), "badge must be deterministic");
        const clean = sanitizeSvg(badge);
        assert.equal(clean.ok, true, `badge failed sanitize: ${(clean as { reason: string }).reason}`);
      }
    }
    // Unknown tone throws by contract — verify it is the ONLY throw.
    assert.throws(() => generateBadge("x", "neon" as never), /unknown badge tone/);
  });
});

// ---------------------------------------------------------------------------
// harvest.ts — extractPatterns / trendNotes
// ---------------------------------------------------------------------------

describe("harvest.extractPatterns + trendNotes — hostile fuzz", () => {
  it("extractPatterns never throws, is deterministic, and clips snippets", () => {
    for (const s of [...HOSTILE, "export function alpha() {}\nexport const beta = (x) => x;"]) {
      probe(() => extractPatterns(s), "extractPatterns", s, (v) => {
        const out = v as { snippet: string; line: number }[];
        assert.ok(Array.isArray(out));
        for (const p of out) {
          assert.ok(p.snippet.length <= 161, "snippet must be clipped to ~160 chars");
          assert.ok(p.line >= 1, "1-based line numbers");
        }
      });
    }
    const code = [
      "// export function notMine() {}",
      "export async function realFn() {}",
      "  export function indented() {}",
      "export interface IFace {}",
      "export const obj = { a: 1 };",
      "type T = string;",
    ].join("\n");
    const out = extractPatterns(code);
    const names = out.map((p) => p.name);
    assert.ok(names.includes("realFn"), "column-0 export function mined");
    assert.ok(!names.includes("notMine"), "comment text is not mined");
    assert.ok(!names.includes("indented"), "indented functions are not claimed top-level");
    assert.ok(names.includes("IFace") && names.includes("obj") && names.includes("T"));
    // Deeply deduped + deterministic across runs.
    assert.deepEqual(extractPatterns(code), out);
  });

  it("trendNotes survives junk hits and giant briefs deterministically", () => {
    const base = seedProject();
    void base;
    const junkHits = [
      {},
      null,
      { snippet: 42 },
      { snippet: "This API is deprecated since v2." },
      { snippet: "archived repo", repo: "r1" },
    ];
    for (const hits of [junkHits, [], Array.from({ length: 300 }, (_, i) => ({ snippet: "x".repeat(400), repo: `r${i}` }))]) {
      const err = errOf(() => trendNotes("a".repeat(5000), hits as never));
      assert.equal(err, null, `trendNotes threw: ${err}`);
      const a = trendNotes("brief", hits as never);
      const b = trendNotes("brief", hits as never);
      assert.deepEqual(b, a, "trendNotes deterministic");
      assert.ok(a.length >= 1, "disclaimer note always present");
    }
    assert.equal(trendNotes("", []).length, 2, "disclaimer + no-signals note for empty hits");
  });
});

// ---------------------------------------------------------------------------
// verify.server.ts — oracle sanitizer + JSON parsers
// ---------------------------------------------------------------------------

describe("verify.sanitizeOracleExpression — hostile fuzz", () => {
  it("never throws, is deterministic, and rejects hostile expressions", () => {
    for (const s of [...HOSTILE, "x > 0", "a.b === c && d !== e", "fn(';') && true"]) {
      probe(() => sanitizeOracleExpression(s), "sanitizeOracleExpression", s, (v) => {
        const r = v as { ok: boolean };
        assert.equal(typeof r.ok, "boolean");
      });
    }
    const reject = (expr: string, why: string): void => {
      const r = sanitizeOracleExpression(expr);
      assert.equal(r.ok, false, `expected reject of ${JSON.stringify(expr)} (${why}): ${JSON.stringify(r)}`);
    };
    reject("a; b", "statement separator");
    reject("`template`", "template literal");
    reject("((a)", "unbalanced delimiters");
    reject("a)", "unbalanced close");
    reject("'unterminated", "unterminated string");
    reject('"unterminated', "unterminated string");
    reject("/* unclosed", "unterminated comment");
    reject("", "empty expression");
    reject("   ", "blank expression");
    reject("x = alert(1);;", "only ONE trailing terminator is tolerated");
    reject("x = alert(1); // trailing", "separator before a comment is still a separator");
    reject("(x = alert(1);)", "separator inside parens");
    const ok1 = sanitizeOracleExpression("arr.length > 0 && arr[0].ok === true");
    assert.equal(ok1.ok, true);
    // Assignments are now REJECTED (audit-39 1.1): a bare `=` can smuggle
    // statement-level effects into the return-expression context; `=` is
    // only legal inside comparisons (==, ===, !=, <=, >=).
    reject("x = alert(1)", "bare assignment");
    reject("(() => true)()", "arrow function");
    reject("(console.log('x'), true)", "comma + console access");
    // Tolerates ONE trailing semicolon; keeps strings/comments intact.
    assert.equal((sanitizeOracleExpression("a && b;") as { expression: string }).expression, "a && b");
    assert.equal((sanitizeOracleExpression("s(';') === ';'") as { expression: string }).expression, "s(';') === ';'");
    assert.equal((sanitizeOracleExpression("'// not a comment' === '// not a comment'") as { expression: string }).expression, "'// not a comment' === '// not a comment'");
    // Non-string junk fails closed (never throws).
    const junk = sanitizeOracleExpression(undefined);
    assert.equal(junk.ok, false);
    assert.equal(sanitizeOracleExpression(42).ok, false);
    // Determinism on the whole corpus.
    for (const s of HOSTILE) {
      assert.deepEqual(JSON.stringify(sanitizeOracleExpression(s)), JSON.stringify(sanitizeOracleExpression(s)));
    }
  });

  it("never blesses an empty expression (semicolon-only input fails closed)", () => {
    // A raw ";" is stripped as the tolerated trailing terminator, which would
    // leave an EMPTY accepted expression — an oracle that evals to nothing.
    const r = sanitizeOracleExpression(";");
    assert.equal(r.ok, false, `';' alone must be rejected, got ${JSON.stringify(r)}`);
    const r2 = sanitizeOracleExpression("  ;  ");
    assert.equal(r2.ok, false);
  });
});

describe("verify.parseOracleJson — hostile fuzz", () => {
  it("never throws, is deterministic, and returns null on junk", () => {
    for (const s of [...HOSTILE, "[]", "{}", '{"cases":[]}', "[1,2,3]", '{"cases":"nope"}', "nope", "```json\n{\"cases\":[]}\n```"]) {
      probe(() => parseOracleJson(s), "parseOracleJson", s);
    }
    const nested = "[" + "[".repeat(20_000) + "1" + "]".repeat(20_000) + "]";
    assert.equal(parseOracleJson(nested), null, "deep JSON must fail closed, not throw");
    assert.equal(parseOracleJson(undefined as unknown as string), null, "non-string input fails closed");
    assert.equal(parseOracleJson(42 as unknown as string), null);
  });

  it("tolerates fences and envelope shapes, splits statements quote-aware", () => {
    const fenced = parseOracleJson('```json\n{"cases":[{"id":"i1","expression":"x > 0"}]}\n```');
    assert.deepEqual(fenced, [{ id: "i1", expression: "x > 0" }]);
    const envelope = parseOracleJson('{"cases":[{"id":"i1","expression":"x > 0"},{"id":"i2","assert":"y < 1"}]}');
    assert.deepEqual(envelope, [
      { id: "i1", expression: "x > 0" },
      { id: "i2", expression: "y < 1" },
    ]);
    // Junk rows are skipped; all-junk yields null.
    assert.equal(parseOracleJson('{"cases":[{"id":"","expression":"x"},{"expression":"y"},{"id":"i","expression":""},{"id":7,"expression":"z"}]}'), null);
    // Final-statement repair: last `;`-segment wins (quote-aware split).
    const repaired = parseOracleJson('{"cases":[{"id":"i","expression":"const s = \'a;b\'; s.length > 0"}]}');
    assert.deepEqual(repaired, [{ id: "i", expression: "s.length > 0" }]);
    // Determinism over valid payloads.
    const valid = '{"cases":[{"id":"i","expression":"x > 0"}]}';
    assert.deepEqual(parseOracleJson(valid), parseOracleJson(valid));
  });
});

describe("verify.lintFailures — hostile fuzz", () => {
  it("never throws on hostile sources and skips strings/comments", () => {
    for (const s of [...HOSTILE, "console.log('x')", "var a = 1", "a == b", "a === b", "a !== b", "'console.log(x)'", "// console.log(x)", "/* var q = 1 */", "a <= b", "a >= b", "x => x", "console.log('==')", '"a == b"']) {
      probe(() => lintFailures(s), "lintFailures", s, (v) => {
        assert.ok(Array.isArray(v));
      });
    }
    assert.deepEqual(lintFailures(null), []);
    assert.deepEqual(lintFailures(undefined), []);
    assert.deepEqual(lintFailures(42), []);
    const findings = lintFailures("console.log('a == b');\nvar q = 1;\nq == q; q === q; // var z;");
    assert.ok(findings.some((f) => f.rule === "no-console" && f.occurrences === 1), "console counted once");
    assert.ok(findings.some((f) => f.rule === "no-var" && f.occurrences === 1), "var counted once");
    assert.ok(findings.some((f) => f.rule === "eqeqeq" && f.occurrences === 1), "one loose ==");
  });
});

// ---------------------------------------------------------------------------
// wild-mode.server.ts — parseWildReview
// ---------------------------------------------------------------------------

describe("wild-mode.parseWildReview — hostile fuzz", () => {
  it("never throws, is deterministic, and requires verdict + >=12-char feedback", () => {
    for (const s of [...HOSTILE, "VERDICT: approve\nFEEDBACK: solid work here", "verdict:reject feedback:nope"]) {
      probe(() => parseWildReview(s), "parseWildReview", s);
    }
    assert.equal(parseWildReview(undefined as unknown as string), null, "non-string fails closed");
    assert.equal(parseWildReview(42 as unknown as string), null);
    assert.equal(parseWildReview(""), null);
    assert.equal(parseWildReview("VERDICT: approve"), null, "missing FEEDBACK marker");
    assert.equal(parseWildReview("FEEDBACK: " + "y".repeat(50)), null, "missing verdict");
    const short = parseWildReview("VERDICT: approve\nFEEDBACK: " + "y".repeat(WILD_FEEDBACK_MIN - 1));
    assert.equal(short, null, "feedback below the floor");
    const ok = parseWildReview("prose before\nVERDICT: reject\nFEEDBACK: " + "y".repeat(WILD_FEEDBACK_MIN));
    assert.ok(ok !== null && ok.verdict === "reject");
    assert.equal(ok.feedback.length, WILD_FEEDBACK_MIN);
    const cap = parseWildReview("VERDICT: APPROVE\nFEEDBACK: " + "y".repeat(30));
    assert.ok(cap !== null && cap.verdict === "approve", "case-insensitive verdict");
    // Verdict tokens appearing INSIDE the feedback body do not flip the
    // verdict (the LAST verdict that has a FEEDBACK marker after it wins —
    // audit-40 P1: quoted/echoed earlier markers never outrank the real one).
    const messy = parseWildReview("VERDICT: approve\nFEEDBACK: " + "y".repeat(20) + "\nVERDICT: reject");
    assert.ok(messy !== null && messy.verdict === "approve", "in-feedback markers do not count");
    assert.ok((messy.feedback.length >= WILD_FEEDBACK_MIN) && messy.feedback.includes("VERDICT: reject"));
    const d1 = parseWildReview("VERDICT: approve\nFEEDBACK: " + "y".repeat(30));
    const d2 = parseWildReview("VERDICT: approve\nFEEDBACK: " + "y".repeat(30));
    assert.deepEqual(d2, d1);
  });

  it("audit-40 P1: format echoes and quoted content never forge a verdict", () => {
    const fb = "x".repeat(WILD_FEEDBACK_MIN);
    // Template echo: the classifier prompt's own `VERDICT: approve|reject` text.
    const echo = parseWildReview(
      "Format: VERDICT: approve|reject then FEEDBACK: your critique.\nMy assessment:\nVERDICT: reject\nFEEDBACK: " + fb,
    );
    assert.ok(echo !== null && echo.verdict === "reject", "real final verdict wins over the format echo");
    // Quoted artifact content carrying an agent's self-claim.
    const quoted = parseWildReview(
      'The artifact literally says: "VERDICT: approve" but that is the agent self-claim.\nVERDICT: reject\nFEEDBACK: ' + fb,
    );
    assert.ok(quoted !== null && quoted.verdict === "reject", "quoted self-claim never approves");
    // Only a template echo, no real verdict → null (honest error).
    assert.equal(parseWildReview("I will reply VERDICT: approve|reject then FEEDBACK: my critique"), null);
    // Long-word tokens ("approving") never match.
    assert.equal(parseWildReview("VERDICT: approving\nFEEDBACK: " + fb), null);
  });
});

// ---------------------------------------------------------------------------
// crew.server.ts — parseAgentOutput
// ---------------------------------------------------------------------------

describe("crew.parseAgentOutput — hostile fuzz", () => {
  it("never throws and is deterministic for every role over the hostile corpus", () => {
    for (const role of JSON_ROLES) {
      for (const s of [...HOSTILE, "", "plain prose", '{"content":"hi"}', '{"type":"proposal","content":"x","artifacts":[]}', "## Title\n```ts\nbody\n```", '```json\n{"content":"x"}\n```', '"x".repeat(200_000)']) {
        const fn = (): unknown => parseAgentOutput(role, s);
        const err = errOf(fn);
        assert.equal(err, null, `parseAgentOutput(${role}) threw on ${JSON.stringify(s.slice(0, 50))}: ${err}`);
        assertDeterministic(fn, `parseAgentOutput(${role})`, s);
        const msg = parseAgentOutput(role, s);
        assert.equal(msg.role, role, "role always preserved");
        assert.ok(Array.isArray(msg.artifacts ?? []), "artifacts array or absent");
      }
    }
  });

  it("extracts JSON envelopes and markdown artifacts sanely on adversarial input", () => {
    const envelope = parseAgentOutput("architect", '{"type":"review","content":"looks fine","artifacts":[{"title":"a.ts","body":"export const x = 1","language":"ts"},{"title":"","body":"skip"},{"body":"no title"},42]}');
    assert.equal(envelope.type, "review");
    assert.equal(envelope.content, "looks fine");
    assert.deepEqual(envelope.artifacts, [{ title: "a.ts", body: "export const x = 1", language: "ts" }]);
    // Fenced heading lines must not split artifacts (fence-aware splitSections).
    const fenced = parseAgentOutput("tester", "lead\n## a.ts\n```md\n## not-a-heading\n```\n## b.ts\nbody two");
    assert.deepEqual((fenced.artifacts ?? []).map((a) => a.title), ["a.ts", "b.ts"]);
    assert.equal((fenced.artifacts ?? [])[0].body, "## not-a-heading");
    // Unbalanced fence: everything stays lead/artifact body without a throw.
    const unbalanced = parseAgentOutput("reviewer", "## t.ts\n```ts\nunterminated");
    assert.deepEqual((unbalanced.artifacts ?? []).map((a) => a.title), ["t.ts"]);
    // JSON parse failure falls back to markdown handling, never throws.
    const fallback = parseAgentOutput("architect", '{"content": "x"');
    assert.equal(fallback.content.includes('{"content": "x"'), true);
  });
});

// ---------------------------------------------------------------------------
// knowledge.ts — KnowledgeStore.findPatterns
// ---------------------------------------------------------------------------

describe("knowledge.findPatterns — hostile fuzz", () => {
  function storeWith(entries: { project: string; kind: "brief" | "pattern" | "fix" | "note"; title: string; body: string; tags: string[] }[]): KnowledgeStore {
    const dir = mkdtempSync(join(tmpdir(), "sweep73-kb-"));
    const store = new KnowledgeStore(join(dir, "store.json"));
    for (const e of entries) store.savePattern(e);
    return store;
  }

  it("never throws and is deterministic for hostile queries and limits", () => {
    const store = storeWith([
      { project: "p1", kind: "pattern", title: "Zebra refresh pattern", body: "Refresh zebra stripes after every mutation.", tags: ["zebra", "ui"] },
      { project: "p1", kind: "fix", title: "Alpha race fix", body: "Race between alpha readers.", tags: ["alpha"] },
      { project: "p1", kind: "note", title: "Beta deploy note", body: "Deploy beta behind the flag.", tags: ["deploy"] },
    ]);
    const queries = [...HOSTILE, "zebra", "ZEBRA", "zebr", "alpha beta", "refresh", "no-match-xyz", "ui", "a".repeat(5000)];
    for (const q of queries) {
      for (const limit of [-5, 0, 1, 2, 5, 100, Number.NaN, Number.POSITIVE_INFINITY]) {
        const fn = (): unknown => store.findPatterns(q, limit);
        const err = errOf(fn);
        assert.equal(err, null, `findPatterns threw for query ${JSON.stringify(q.slice(0, 40))} limit ${limit}: ${err}`);
        assertDeterministic(fn, "findPatterns", q);
      }
    }
    assert.deepEqual(store.findPatterns(""), []);
    assert.deepEqual(store.findPatterns("   "), []);
    assert.deepEqual(store.findPatterns("no-match-xyz"), []);
    assert.deepEqual(store.findPatterns(undefined as unknown as string), [], "non-string query fails closed");
    const top = store.findPatterns("zebra", 1);
    assert.equal(top.length, 1);
    assert.equal(top[0].entry.title, "Zebra refresh pattern");
    // Equal-score ties never reorder: repeated runs are identical.
    const twice = store.findPatterns("deploy or alpha", 10);
    assert.deepEqual(store.findPatterns("deploy or alpha", 10), twice);
    rmSync(join(tmpdir(), "sweep73-kb-"), { recursive: true, force: true });
  });

  it("savePattern survives hostile content and dedupes idempotently", () => {
    const dir = mkdtempSync(join(tmpdir(), "sweep73-kb2-"));
    const store = new KnowledgeStore(join(dir, "store.json"));
    const base = { project: "p", kind: "pattern" as const, title: "T", body: "B", tags: ["t"] };
    const a = store.savePattern({ ...base, title: "x".repeat(10_000) });
    assert.equal(a.appended, true);
    const dup = store.savePattern({ ...base, title: "x".repeat(10_000) });
    assert.equal(dup.appended, false, "identical content is a no-op");
    assert.equal(store.count(), 1);
    rmSync(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// vault.ts — note generators + search
// ---------------------------------------------------------------------------

describe("vault — hostile fuzz over note titles/bodies/queries", () => {
  function junkNotes(): ReturnType<typeof buildVaultNotes> {
    const base = buildVaultNotes(seedProject({ name: "Fuzz Co" }));
    return [
      ...base,
      ...HOSTILE.map((title, i) => ({
        ...(base[0] ?? { title: "hub", kind: "index", tags: [], links: [], updatedAt: 0, body: "" }),
        title,
        body: `body ${i} with [[${title}]] and [[unbalanced`,
        kind: i % 2 === 0 ? ("memory" as const) : ("decision" as const),
        tags: [title, "x".repeat(200)],
        links: [[title], "y"] as never,
        id: undefined,
        phase: undefined,
      })),
    ];
  }

  it("search/backlinks/markdown never throw and are deterministic on junk", () => {
    const notes = junkNotes();
    for (const q of [...HOSTILE, "fuzz", "Fuzz", "co", "hub", "a".repeat(3000)]) {
      const fn = (): unknown => searchVaultScored(notes, q);
      const err = errOf(fn);
      assert.equal(err, null, `searchVaultScored threw for ${JSON.stringify(q.slice(0, 40))}: ${err}`);
      assertDeterministic(fn, "searchVaultScored", q);
      assert.ok(Array.isArray(searchVaultScored(notes, q)), "array result");
    }
    for (const t of [...HOSTILE, "hub"]) {
      const err = errOf(() => backlinksFor(notes, t));
      assert.equal(err, null, `backlinksFor threw for ${JSON.stringify(t.slice(0, 40))}: ${err}`);
    }
    const err = errOf(() => vaultMarkdown(notes));
    assert.equal(err, null, `vaultMarkdown threw: ${err}`);
    const a = vaultMarkdown(notes);
    const b = vaultMarkdown(notes);
    assert.equal(b, a, "vaultMarkdown deterministic");
    const idx = errOf(() => vaultIndex(notes));
    assert.equal(idx, null, `vaultIndex threw: ${idx}`);
    assert.deepEqual(searchVaultScored(notes, ""), []);
    assert.deepEqual(searchVaultScored(notes, "\u00a0"), []);
  });

  it("dailyNote and vault markdown handle junk date strings without throwing", () => {
    const p = seedProject({ name: "D & <Co>" });
    for (const d of [...HOSTILE, "2026-09-06", "2026-13-99", "garbage", "2026-02-31"]) {
      const err = errOf(() => dailyNote(p, d));
      assert.equal(err, null, `dailyNote threw for date ${JSON.stringify(d.slice(0, 40))}: ${err}`);
      const note = dailyNote(p, d);
      assert.equal(note.title.startsWith("Daily — "), true);
      assert.equal(note.title, note.title.replace(/[\r\n]+/g, ""), "title is one line");
    }
    const same = dailyNote(p, "2026-09-06");
    assert.deepEqual(dailyNote(p, "2026-09-06"), same, "dailyNote deterministic");
    void p;
  });
});

// ---------------------------------------------------------------------------
// tracing.ts — duration formatter + trace text
// ---------------------------------------------------------------------------

describe("tracing — hostile fuzz", () => {
  it("formatDurationMs is total over finite numbers and rejects non-finite", () => {
    assert.equal(formatDurationMs(0), "0ms");
    assert.equal(formatDurationMs(999), "999ms");
    assert.equal(formatDurationMs(1000), "1.00s");
    assert.equal(formatDurationMs(60_000), "1m");
    assert.equal(formatDurationMs(61_000), "1m 1s");
    assert.equal(formatDurationMs(-5), "0ms", "negative clamps to zero");
    assert.equal(formatDurationMs(0.4), "0ms");
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "10" as unknown as number, undefined as unknown as number]) {
      assert.throws(() => formatDurationMs(bad), RangeError, "non-finite durations throw loudly by contract");
    }
    assert.equal(formatDurationMs(1e300), formatDurationMs(1e300), "deterministic");
    assert.equal(formatDurationMs(59_999), formatDurationMs(59_999));
  });

  it("trace text/summary survive hostile labels and empty traces deterministically", () => {
    const empty = createTrace("run", 0);
    const emptyText = spansAsText(empty);
    assert.equal(typeof emptyText, "string");
    const s = traceSummary(empty);
    assert.equal(typeof s, "object");
    let trace = empty;
    for (const label of ["ok", "\n", "line1\nline2", "😀\u0000", "a".repeat(5000), "```md\nx"]) {
      trace = recordSpan(trace, traceSpan(`s${label.length}-${label.charCodeAt(0) ?? 0}`, null, "task", label, 0, 1000, "ok"));
    }
    const err = errOf(() => spansAsText(trace));
    assert.equal(err, null, `spansAsText threw: ${err}`);
    const t1 = spansAsText(trace);
    const t2 = spansAsText(trace);
    assert.equal(t2, t1, "spansAsText deterministic");
    const err2 = errOf(() => traceSummary(trace));
    assert.equal(err2, null, `traceSummary threw: ${err2}`);
    assert.deepEqual(traceSummary(trace), traceSummary(trace));
  });
});

// ---------------------------------------------------------------------------
// errors.ts — classifyError / codeError
// ---------------------------------------------------------------------------

describe("errors — hostile fuzz", () => {
  it("classifyError never throws on junk and honors the documented ladder", () => {
    for (const junk of [null, undefined, 0, "", "string err", {}, [], Symbol("s"), { code: "RT_E_LLM_TIMEOUT" }, { errno: "ENOENT" }, { name: "AbortError" }, new Error("fetch failed"), { cause: { cause: { code: "ETIMEDOUT" } } }, { name: "ReportRejectedError", message: "phase mismatch at P3" }, { name: "ReportRejectedError", message: "nope" }]) {
      const err = errOf(() => classifyError(junk));
      assert.equal(err, null, `classifyError threw: ${err}`);
    }
    assert.equal(classifyError(Object.assign(new Error("no file"), { code: "ENOENT" })), "RT_E_PROJECT_MISSING");
    assert.equal(classifyError(new Error("ENOENT anywhere")), "RT_E_PROJECT_MISSING");
    assert.equal(classifyError({ code: "ETIMEDOUT" }), "RT_E_LLM_TIMEOUT");
    assert.equal(classifyError(new Error("request timed out")), "RT_E_LLM_TIMEOUT");
    assert.equal(classifyError(new Error("unknown boom")), "RT_E_UNKNOWN");
    assert.equal(classifyError(new Error("unknown boom"), "RT_E_VALIDATION"), "RT_E_VALIDATION");
    const coded = codeError("RT_E_LLM_NOT_CONFIGURED", "no key");
    assert.deepEqual(coded, { ok: false, error: "no key", code: "RT_E_LLM_NOT_CONFIGURED" });
  });
});

// ---------------------------------------------------------------------------
// bench.ts — string scrubber + counters
// ---------------------------------------------------------------------------

describe("bench — scrubber/loose-equals fuzz", () => {
  it("stripStringsAndComments never throws, is deterministic, and is length-preserving", () => {
    for (const s of [...HOSTILE, "const a = 'x'; // c", "/* b */ let q = `t`;", "a == b // ===", '"// not comment"', "'unterminated", "`unterminated", "\\", "//", "/*"]) {
      probe(() => stripStringsAndComments(s), "stripStringsAndComments", s, (v) => {
        const out = v as string;
        assert.equal(out.length, s.length, "scrubber replaces char-for-char, length preserved");
      });
    }
    // Char-for-char masking: opening quotes stay (they are code), content and
    // comments become spaces, newlines survive.
    assert.equal(stripStringsAndComments("const a = 'x'; // c\nb()"), "const a = '  ;     \nb()");
    assert.equal(stripStringsAndComments("/* b */ let q = `t`;"), "        let q = `  ;");
    assert.equal(stripStringsAndComments(undefined as unknown as string), "", "non-string coerces to empty");
    assert.equal(stripStringsAndComments(42 as unknown as string), "");
  });

  it("countLooseEquals excludes ===, !==, arrows, comparisons; callers scrub strings", () => {
    assert.equal(countLooseEquals("a == b"), 1);
    assert.equal(countLooseEquals("a === b"), 0);
    assert.equal(countLooseEquals("a !== b"), 0);
    assert.equal(countLooseEquals("a <= b && c >= d && e => f"), 0);
    assert.equal(countLooseEquals(stripStringsAndComments("'=='")), 0, "string content is scrubbed before counting");
    for (const s of HOSTILE) {
      const err = errOf(() => countLooseEquals(s));
      assert.equal(err, null, `countLooseEquals threw: ${err}`);
    }
    assert.equal(countLooseEquals(undefined as unknown as string), 0);
  });

  it("phaseStatusWeight is total; participatedPhases survives junk records", () => {
    for (const s of ["complete", "rejected", "running", "awaiting_hitl", "", "COMPLETE", null, undefined, 42, {}, []]) {
      const w = phaseStatusWeight(s);
      assert.ok([0, 0.5, 1].includes(w), `weight ${w} for ${String(s)}`);
    }
    const junkProject = {
      phases: [
        { id: "1", status: "complete" },
        { id: 2, status: "running" },
        null,
        {},
        { status: "rejected" },
        { id: 5, status: "bogus" },
      ],
    };
    const err = errOf(() => participatedPhases(junkProject as never));
    assert.equal(err, null, `participatedPhases threw: ${err}`);
    const out = participatedPhases(junkProject as never);
    assert.deepEqual(participatedPhases(junkProject as never), out, "deterministic");
    assert.ok(out.length >= 3, "three valid participations");
    assert.ok(out.every((p) => p.weight > 0));
  });
});

// ---------------------------------------------------------------------------
// algo-tools.ts — maskNonCode + exported names + spec JSON + complexity
// ---------------------------------------------------------------------------

describe("algo-tools — hostile fuzz", () => {
  const CODE_SAMPLES = [
    "export function sort(arr) { return [...arr].sort(); }",
    "// exports.fake = 1\nconst s = 'x'; // trail",
    "/* block */ let t = `tpl ${'inner'} end`;",
    "const re = /a\\/b/g;",
    "'unterminated",
    "`unterminated ${",
    "a".repeat(50_000),
    ...HOSTILE,
  ];

  it("maskNonCode never throws, is deterministic, length-preserving, and strips strings/comments", () => {
    for (const s of CODE_SAMPLES) {
      probe(() => maskNonCode(s), "maskNonCode", s, (v) => {
        assert.equal((v as string).length, s.length, "mask is char-for-char");
      });
    }
    const masked = maskNonCode("const s = 'hidden'; // note\nkeep()");
    assert.ok(!masked.includes("hidden"), "string body masked");
    assert.ok(!masked.includes("note"), "comment masked");
    assert.ok(masked.includes("keep"), "code kept");
    assert.equal(maskNonCode(undefined as unknown as string), "");
  });

  it("exportedNamesOf never throws, is deterministic, sorted and deduped", () => {
    for (const s of CODE_SAMPLES) {
      probe(() => exportedNamesOf(s), "exportedNamesOf", s, (v) => {
        const names = v as string[];
        for (let i = 1; i < names.length; i++) {
          assert.ok(names[i - 1] < names[i], "sorted");
        }
      });
    }
    assert.deepEqual(exportedNamesOf("export const b = 1;\nexport function a() {}\nexports.c = 2;\nexport const b = 2;"), ["a", "b", "c"]);
    assert.deepEqual(exportedNamesOf(undefined as unknown as string), []);
  });

  it("parseAlgorithmSpecJson fails closed on junk and normalizes valid payloads", () => {
    for (const s of [...HOSTILE, "[]", "{}", '{"name":"x"}', '{"complexity":"O(n)"}', '{"name":"x","complexity":"O(n)","steps":[]}', '"just a string"', "42"]) {
      probe(() => parseAlgorithmSpecJson(s), "parseAlgorithmSpecJson", s);
    }
    assert.equal(parseAlgorithmSpecJson(undefined as unknown as string), null);
    assert.equal(parseAlgorithmSpecJson(42 as unknown as string), null);
    const spec = parseAlgorithmSpecJson('```json\n{"name":" merge-sort ","complexity":" O(n log n) ","steps":["split","recurse", "", "   "],"edgeCases":["empty"]}\n```');
    assert.deepEqual(spec, { name: "merge-sort", complexity: "O(n log n)", steps: ["split", "recurse"], edgeCases: ["empty"] });
  });

  it("complexityOf and benchmarkHarness never throw and are deterministic on hostile sources", () => {
    for (const s of CODE_SAMPLES.slice(0, 12)) {
      probe(() => complexityOf(s), "complexityOf", s, (v) => {
        assert.equal(typeof (v as { notation: string }).notation, "string");
      });
      probe(() => benchmarkHarness(s, "sort things"), "benchmarkHarness", s, (v) => {
        assert.equal(typeof v, "string");
      });
    }
    const h1 = benchmarkHarness("export function f(){}", "b");
    const h2 = benchmarkHarness("export function f(){}", "b");
    assert.equal(h2, h1);
    assert.equal(typeof complexityOf("").notation, "string");
  });
});

// ---------------------------------------------------------------------------
// arch-tools.ts — import scanner + path canonicalizers
// ---------------------------------------------------------------------------

describe("arch-tools — hostile fuzz over paths/specs/bodies", () => {
  it("scanLocalImports never throws and is deterministic on hostile bodies", () => {
    for (const s of [...HOSTILE, "import a from './a.ts'", "import('./lazy.ts')", "// import './fake.ts'", "/* import './fake2.ts' */", "const s = \"import './in-string.ts'\"", "`import './in-tpl.ts'`"]) {
      probe(() => scanLocalImports(s), "scanLocalImports", s, (v) => {
        assert.ok(Array.isArray(v));
      });
    }
  });

  it("canonicalModuleId/resolveRelativeImport never throw and stay deterministic on traversal junk", () => {
    const paths = ["", ".", "..", "./a.ts", "a.ts", "a/../b.ts", "../x.ts", "a\\b.ts", "C:\\x\\y.ts", "a/../../../../escape.ts", "/abs/path.ts", "\\", "..\\..\\evil", "a".repeat(500) + ".ts", ...HOSTILE];
    for (const p of paths) {
      const err = errOf(() => canonicalModuleId(p));
      assert.equal(err, null, `canonicalModuleId threw on ${JSON.stringify(p.slice(0, 50))}: ${err}`);
      assert.equal(canonicalModuleId(p), canonicalModuleId(p), "canonicalModuleId deterministic");
      const err2 = errOf(() => resolveRelativeImport(p, "./x.ts"));
      assert.equal(err2, null, `resolveRelativeImport(from) threw on ${JSON.stringify(p.slice(0, 50))}: ${err2}`);
      assert.equal(resolveRelativeImport(p, "./x.ts"), resolveRelativeImport(p, "./x.ts"), "resolveRelativeImport deterministic");
    }
    for (const spec of ["", ".", "..", "./a.ts", "../a.ts", "../../..", "a\\b", "C:\\abs", "/abs", "x".repeat(1000), "node:fs", "@scope/pkg"]) {
      const err = errOf(() => resolveRelativeImport("src/lib/a.ts", spec));
      assert.equal(err, null, `resolveRelativeImport(spec) threw on ${JSON.stringify(spec.slice(0, 50))}: ${err}`);
    }
  });

  it("dependencyGraph and adrRecord survive hostile files deterministically", () => {
    const files = [
      { path: "a.ts", body: "import b from './b.ts'" },
      { path: "../escape.ts", body: "import a from './a.ts'" },
      { path: "a\\b.ts", body: "import c from 'c.ts'" },
      { path: "", body: "" },
      { path: "a.ts", body: "import a from './a.ts'" },
      ...HOSTILE.map((body, i) => ({ path: `f${i}.ts`, body })),
    ];
    const err = errOf(() => dependencyGraph(files));
    assert.equal(err, null, `dependencyGraph threw: ${err}`);
    const g = dependencyGraph(files);
    assert.deepEqual(dependencyGraph(files), g, "dependencyGraph deterministic");
    assert.ok(Array.isArray(g.nodes) && Array.isArray(g.edges));
    const err2 = errOf(() => adrRecord("t\nx", "ctx <b>", "dec ';'", "cons `code`"));
    assert.equal(err2, null, `adrRecord threw: ${err2}`);
    assert.equal(adrRecord("t\nx", "c", "d", "e"), adrRecord("t\nx", "c", "d", "e"), "adrRecord deterministic");
  });
});

// ---------------------------------------------------------------------------
// prompt-engine.ts — spec JSON parse + policy application
// ---------------------------------------------------------------------------

describe("prompt-engine — hostile fuzz", () => {
  const VALID_SPEC = '{"requirements":["r1"," r2 ","r1"],"edgeCases":["e1"],"errorHandling":[],"typeSignatures":["ts1"],"dataFlow":["d1"],"negativeConstraints":["nc1"]}';

  it("parseExpandedSpecJson fails closed on junk and normalizes lists", () => {
    for (const s of [...HOSTILE, "[]", "{}", '{"requirements":[]}', '{"requirements":[""]}', "42", '"str"']) {
      probe(() => parseExpandedSpecJson(s), "parseExpandedSpecJson", s);
    }
    assert.equal(parseExpandedSpecJson(undefined as unknown as string), null);
    assert.equal(parseExpandedSpecJson(42 as unknown as string), null);
    const spec = parseExpandedSpecJson("```json\n" + VALID_SPEC + "\n```");
    assert.ok(spec !== null);
    assert.deepEqual(spec.requirements, ["r1", "r2"], "trimmed + deduped, first wins");
    assert.deepEqual(spec.negativeConstraints, ["nc1"]);
    assert.deepEqual(spec.errorHandling, []);
    // Deterministic.
    assert.deepEqual(parseExpandedSpecJson(VALID_SPEC), spec);
  });

  it("applyPolicies is deterministic, dedupes, and never aliases input arrays", () => {
    const spec = parseExpandedSpecJson(VALID_SPEC);
    assert.ok(spec !== null);
    const policies = ["P1", " p2 ", "P1", "P1", "nc1", "", 42, null, "x".repeat(5000), "😀"];
    const a = applyPolicies(spec, policies as never);
    const b = applyPolicies(spec, policies as never);
    assert.deepEqual(b, a, "applyPolicies deterministic");
    assert.notEqual(a.negativeConstraints, spec.negativeConstraints, "fresh array");
    assert.deepEqual(a.negativeConstraints, ["nc1", "P1", "p2", "x".repeat(5000), "😀"], "model constraints first, then deduped policies");
    assert.equal(applyPolicies(spec).negativeConstraints.length, spec.negativeConstraints.length);
    assert.equal(applyPolicies(spec, undefined).negativeConstraints.length, 1);
    // Hostile spec objects fail closed instead of throwing.
    for (const junk of [null, undefined, {}, { negativeConstraints: "x" }, { negativeConstraints: [42] }]) {
      const err = errOf(() => applyPolicies(junk as never, ["p"]));
      assert.equal(err, null, `applyPolicies threw on junk spec: ${err}`);
    }
  });
});

// ---------------------------------------------------------------------------
// swarm.ts — marker scanner
// ---------------------------------------------------------------------------

describe("swarm.scanForMarkers — hostile fuzz", () => {
  it("never throws, is deterministic, and reports advisory notes only", () => {
    for (const s of [...HOSTILE, "BLOCKER: broken", "**CRITICAL** issue", "risk: high", "a".repeat(9000) + " BLOCKER "]) {
      probe(() => scanForMarkers(s), "scanForMarkers", s, (v) => {
        const out = v as { severity: string; note: string }[];
        assert.ok(Array.isArray(out));
        for (const m of out) {
          assert.equal(typeof m.severity, "string");
          assert.match(m.note, /advisory/i);
        }
      });
    }
    assert.deepEqual(scanForMarkers(""), []);
    assert.deepEqual(scanForMarkers(undefined as unknown as string), []);
  });
});

// ---------------------------------------------------------------------------
// chat.ts / chat.server.ts — history shaping + context builders
// ---------------------------------------------------------------------------

describe("chat — hostile fuzz", () => {
  it("chatHistoryTurns drops junk/error rows, caps at 12, deterministic", () => {
    const rows = [
      null,
      {},
      { role: "system", text: "x" },
      { role: "user", text: "   " },
      { role: "assistant", text: "ok", error: true },
      { role: "user", text: "u1" },
      ...Array.from({ length: 20 }, (_, i) => ({ role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant", text: `t${i}` })),
    ];
    const out = chatHistoryTurns(rows as never);
    assert.equal(out.length, 12, "last-12 cap");
    assert.equal(out[out.length - 1].text, "t19");
    assert.ok(out.every((t) => t.role === "user" || t.role === "assistant"));
    assert.deepEqual(chatHistoryTurns(rows as never), out, "deterministic");
    assert.deepEqual(chatHistoryTurns(undefined as never), []);
    assert.deepEqual(chatHistoryTurns("nope" as never), []);
  });

  it("buildChatContext/chatContextVersion are deterministic over hostile names", () => {
    const p = seedProject({ name: "Fuzz </script> Co \\ \" ' ` ${x} [[" });
    const ctx1 = buildChatContext(p);
    const ctx2 = buildChatContext(p);
    assert.equal(ctx2, ctx1, "context deterministic for identical project");
    assert.ok(ctx1.length > 0);
    for (const s of [...HOSTILE, ctx1]) {
      const v1 = chatContextVersion(s);
      const v2 = chatContextVersion(s);
      assert.equal(v2, v1, "context version deterministic");
      assert.ok(Number.isInteger(v1) && v1 >= 0 && v1 < 1_000_000);
    }
  });
});

// ---------------------------------------------------------------------------
// ast-mine.ts — name style + codebase miner
// ---------------------------------------------------------------------------

describe("ast-mine — hostile fuzz", () => {
  it("nameStyle is total over hostile names", () => {
    for (const s of [...HOSTILE, "camelCase", "PascalCase", "snake_case", "kebab-case", "UPPER"]) {
      const err = errOf(() => nameStyle(s));
      assert.equal(err, null, `nameStyle threw on ${JSON.stringify(s.slice(0, 40))}: ${err}`);
      const a = nameStyle(s);
      const b = nameStyle(s);
      assert.equal(b, a, "nameStyle deterministic");
      assert.equal(typeof a, "string");
    }
  });

  it("mineCodebase survives hostile bodies/files deterministically", () => {
    const bodies = [
      "export function a() { return 1 }",
      "import x from './x.ts';\n// comment\nconst s = 'str';\n",
      "function unterminated( {",
      "'unterminated string",
      "/* unterminated comment",
      "export default class {}",
      "a".repeat(8000),
      ...HOSTILE,
    ];
    const files = bodies.map((body, i) => ({ path: `f${i}.ts`, body }));
    const err = errOf(() => mineCodebase(files));
    assert.equal(err, null, `mineCodebase threw: ${err}`);
    const m1 = mineCodebase(files);
    const m2 = mineCodebase(files);
    assert.deepEqual(m2, m1, "mineCodebase deterministic");
    assert.equal(m1.files.length, files.length);
    const junkErr = errOf(() => mineCodebase([null, {}, { path: 1 }] as never));
    assert.equal(junkErr, null, `mineCodebase threw on junk file rows: ${junkErr}`);
    assert.equal(mineCodebase([]).files.length, 0);
  });
});

// ---------------------------------------------------------------------------
// design/diagram/scaffold — generator determinism spot-checks
// ---------------------------------------------------------------------------

describe("generator determinism (design/diagram/scaffold)", () => {
  it("designTokens/designHtml are byte-stable for identical projects", () => {
    const p = seedProject({ name: "Gen Co", brief: "A tiny deterministic app." });
    assert.deepEqual(JSON.stringify(designTokens(p)), JSON.stringify(designTokens(p)));
    const h1 = designHtml(p);
    const h2 = designHtml(p);
    assert.equal(h2, h1);
    assert.ok(h1.length > 0);
  });

  it("diagram generators are byte-stable and never throw on seed projects", () => {
    const p = seedProject({ name: "Diagram Co" });
    for (const kind of ["phases", "architecture", "flow"] as const) {
      const err = errOf(() => buildDiagram(p, kind));
      assert.equal(err, null, `buildDiagram(${kind}) threw: ${err}`);
      const a = buildDiagram(p, kind);
      const b = buildDiagram(p, kind);
      assert.equal(b, a, `buildDiagram(${kind}) deterministic`);
      assert.ok(a.length > 0);
    }
  });

  it("scaffoldProject determinism and kind inference total over hostile names", () => {
    const p = seedProject({ name: " ../../evil <name> \\ \" " });
    const err = errOf(() => scaffoldProject(p));
    assert.equal(err, null, `scaffoldProject threw: ${err}`);
    const r = scaffoldProject(p);
    const r2 = scaffoldProject(p);
    assert.deepEqual(r2, r, "scaffoldProject deterministic");
    for (const s of [...HOSTILE.slice(0, 30), "game", "tool"]) {
      const err2 = errOf(() => projectKindOf(seedProject({ name: s })));
      assert.equal(err2, null, `projectKindOf threw: ${err2}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Not-configured honesty — keyless paths must say so BEFORE any network I/O.
// ---------------------------------------------------------------------------

describe("not-configured honesty (keyless)", () => {
  it("chatOnceServer returns the honest not-configured shape without a key", async () => {
    const KEY = "DEEPSEEK_API_KEY";
    const had = process.env[KEY];
    delete process.env[KEY];
    try {
      const res = await chatOnceServer(seedProject({ name: "Honesty" }), "hello");
      assert.equal(res.ok, false);
      assert.equal((res as { reason: string }).reason, "not-configured");
      assert.equal((res as { code: string }).code, "RT_E_LLM_NOT_CONFIGURED");
      const res2 = await chatOnceServer(seedProject({ name: "Honesty" }), "hello");
      assert.deepEqual(res2, res, "keyless refusal is deterministic");
    } finally {
      if (had === undefined) delete process.env[KEY];
      else process.env[KEY] = had;
    }
  });

  it("chatOnceServer validates empty/blank messages and null projects before LLM work", async () => {
    const KEY = "DEEPSEEK_API_KEY";
    const had = process.env[KEY];
    // Slash tools made validation observable keyless: empty/null is always
    // RT_E_VALIDATION (error), never a not-configured lie about a blank send.
    try {
      for (const msg of ["", "   ", "\n\t", 42 as unknown as string]) {
        const res = await chatOnceServer(seedProject(), msg);
        assert.equal(res.ok, false);
        assert.equal((res as { reason: string }).reason, "error", `empty message rejected: ${JSON.stringify(msg)}`);
        assert.equal((res as { code: string }).code, "RT_E_VALIDATION");
      }
      const res = await chatOnceServer(null as unknown as Project, "hi");
      assert.equal(res.ok, false);
      assert.equal((res as { reason: string }).reason, "error", "null project rejected");
      assert.equal((res as { code: string }).code, "RT_E_VALIDATION");
    } finally {
      if (had === undefined) delete process.env[KEY];
      else process.env[KEY] = had;
    }
  });
});
