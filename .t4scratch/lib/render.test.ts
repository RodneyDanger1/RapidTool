// ---------------------------------------------------------------------------
// render.test.ts — XSS-safe markdown BLOCK parser (src/lib/render.ts).
// Pure, deterministic, no disk writes.
// Run: node --experimental-strip-types --test src/lib/render.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MARKDOWN_MAX_CHARS,
  MARKDOWN_TRUNCATION_MARK,
  renderMarkdownBlocks,
} from "./render.ts";
import type { MdBlock } from "./render.ts";

const P = (text: string): MdBlock => ({ type: "p", text });
const H1 = (text: string): MdBlock => ({ type: "h1", text });
const H2 = (text: string): MdBlock => ({ type: "h2", text });
const H3 = (text: string): MdBlock => ({ type: "h3", text });
const HR: MdBlock = { type: "hr", text: "" };
const CODE = (text: string, lang?: string): MdBlock =>
  lang === undefined ? { type: "code", text } : { type: "code", text, lang };
const LI = (text: string, ordered: boolean): MdBlock => ({ type: "li", text, ordered });

describe("headings", () => {
  it("parses an h1 and a following paragraph", () => {
    assert.deepEqual(renderMarkdownBlocks("# Title\n\nBody text"), [H1("Title"), P("Body text")]);
  });

  it("maps # / ## / ### to h1/h2/h3 in document order", () => {
    assert.deepEqual(renderMarkdownBlocks("### deep\n# top\n## mid"), [
      H3("deep"),
      H1("top"),
      H2("mid"),
    ]);
  });

  it("keeps non-headings literal: #no-space, #### too deep, and ####x", () => {
    assert.deepEqual(renderMarkdownBlocks("#no space\n\n#### too deep\n\n##x"), [
      P("#no space"),
      P("#### too deep"),
      P("##x"),
    ]);
  });

  it("trims heading content and allows empty headings", () => {
    assert.deepEqual(renderMarkdownBlocks("#  padded  \n##  "), [H1("padded"), H2("")]);
  });

  it("leaves emphasis/hash characters inside heading text literal", () => {
    assert.deepEqual(renderMarkdownBlocks("# Hello *world* ##"), [H1("Hello *world* ##")]);
  });
});

describe("fenced code", () => {
  it("captures the fence language", () => {
    assert.deepEqual(renderMarkdownBlocks("```ts\nconst x = 1\n```"), [CODE("const x = 1", "ts")]);
  });

  it("takes the first info token as lang and keeps sibling blocks intact", () => {
    const input = "before\n\n```js extra args\ncode()\n```\n\nafter";
    assert.deepEqual(renderMarkdownBlocks(input), [
      P("before"),
      CODE("code()", "js"),
      P("after"),
    ]);
  });

  it("omits the lang key when the fence has no info string", () => {
    const blocks = renderMarkdownBlocks("```\nplain\n```");
    assert.deepEqual(blocks, [CODE("plain")]);
    assert.ok(!("lang" in blocks[0]), "no lang property expected on info-less code block");
  });

  it("keeps nested fence ticks inside code (4-tick fence around ``` content)", () => {
    const input = "````\n```js\nconst a = 1\n```\n````";
    assert.deepEqual(renderMarkdownBlocks(input), [CODE("```js\nconst a = 1\n```")]);
  });

  it("runs an unclosed fence to EOF", () => {
    assert.deepEqual(renderMarkdownBlocks("```py\nnever closed\nstill code"), [
      CODE("never closed\nstill code", "py"),
    ]);
  });

  it("preserves code content verbatim: tabs, inner blanks, trailing spaces", () => {
    const input = "```\n  keep\tme  \n\nline2\t \n```";
    assert.deepEqual(renderMarkdownBlocks(input), [CODE("  keep\tme  \n\nline2\t ")]);
  });

  it("handles an empty fence body", () => {
    assert.deepEqual(renderMarkdownBlocks("```\n```"), [CODE("")]);
  });
});

describe("lists", () => {
  it("merges a consecutive unordered run into one li block", () => {
    assert.deepEqual(renderMarkdownBlocks("- alpha\n- beta\n- gamma"), [
      LI("alpha\nbeta\ngamma", false),
    ]);
  });

  it("merges an ordered run with ordered: true", () => {
    assert.deepEqual(renderMarkdownBlocks("1. first\n2. second\n3. third"), [
      LI("first\nsecond\nthird", true),
    ]);
  });

  it("accepts * bullets and keeps marker-less lines as paragraphs", () => {
    assert.deepEqual(renderMarkdownBlocks("* a\n* b\n\n*no space"), [
      LI("a\nb", false),
      P("*no space"),
    ]);
  });

  it("splits adjacent runs of different kinds into separate li blocks", () => {
    assert.deepEqual(renderMarkdownBlocks("- a\n- b\n1. c\n2. d"), [
      LI("a\nb", false),
      LI("c\nd", true),
    ]);
  });

  it("keeps the run alive across blank lines but a paragraph breaks it", () => {
    const input = "- a\n\n- b\n\nmiddle paragraph\n\n- c";
    assert.deepEqual(renderMarkdownBlocks(input), [
      LI("a\nb", false),
      P("middle paragraph"),
      LI("c", false),
    ]);
  });

  it("strips the marker and surrounding whitespace from item text", () => {
    assert.deepEqual(renderMarkdownBlocks("  -  spaced  \n  1.   done "), [
      LI("spaced", false),
      LI("done", true),
    ]);
  });

  it("keeps a numbered-but-tight line ('1.x') as a paragraph", () => {
    assert.deepEqual(renderMarkdownBlocks("1.x is a version\n\n- real item"), [
      P("1.x is a version"),
      LI("real item", false),
    ]);
  });
});

describe("horizontal rules", () => {
  it("recognizes ---, *** and ___ as hr blocks with empty text", () => {
    assert.deepEqual(renderMarkdownBlocks("---\n\n***\n\n___"), [HR, HR, HR]);
  });

  it("never treats --- under a paragraph as a setext heading", () => {
    assert.deepEqual(renderMarkdownBlocks("Intro line\n---"), [P("Intro line"), HR]);
  });

  it("keeps non-hr dash lines as paragraphs", () => {
    assert.deepEqual(renderMarkdownBlocks("--\n\na - b - c"), [P("--"), P("a - b - c")]);
  });
});

describe("paragraphs", () => {
  it("merges consecutive lines into one paragraph, split by blank lines", () => {
    const input = "first line\nsecond line\n\nnew para";
    assert.deepEqual(renderMarkdownBlocks(input), [P("first line\nsecond line"), P("new para")]);
  });

  it("ignores leading/trailing and whitespace-only blank lines", () => {
    assert.deepEqual(renderMarkdownBlocks("\n\n   \nHello\n\n  \n"), [P("Hello")]);
  });

  it("returns [] for empty and whitespace-only input", () => {
    assert.deepEqual(renderMarkdownBlocks(""), []);
    assert.deepEqual(renderMarkdownBlocks("   \n\t\n  "), []);
  });

  it("keeps raw HTML-looking text inside paragraphs untouched", () => {
    const input = '<script>alert("x")</script>\n\n<img src=x onerror=1> tail';
    assert.deepEqual(renderMarkdownBlocks(input), [
      P('<script>alert("x")</script>'),
      P("<img src=x onerror=1> tail"),
    ]);
  });

  it("passes inline markdown through as literal text (no interpretation)", () => {
    const input = "**bold** and *em* and [link](https://x) and `code`";
    assert.deepEqual(renderMarkdownBlocks(input), [
      P("**bold** and *em* and [link](https://x) and `code`"),
    ]);
  });
});

describe("normalization", () => {
  it("treats CRLF and lone CR exactly like LF", () => {
    const crlf = renderMarkdownBlocks("# Title\r\n\r\n- item\r\n");
    const lf = renderMarkdownBlocks("# Title\n\n- item\n");
    assert.deepEqual(crlf, lf);
    assert.deepEqual(crlf, [H1("Title"), LI("item", false)]);

    const lone = renderMarkdownBlocks("one\r\ntwo\rthree\nfour");
    const plain = renderMarkdownBlocks("one\ntwo\nthree\nfour");
    assert.deepEqual(lone, plain);
    assert.deepEqual(lone, [P("one\ntwo\nthree\nfour")]);
  });

  it("expands tabs to 4 spaces outside code fences", () => {
    assert.deepEqual(renderMarkdownBlocks("a\tb"), [P("a    b")]);
    assert.deepEqual(renderMarkdownBlocks("-\titem"), [LI("item", false)]);
    assert.deepEqual(renderMarkdownBlocks("```\na\tb\n```"), [CODE("a\tb")]);
  });
});

describe("64KB cap", () => {
  it("appends a final [truncated] paragraph when input exceeds the cap", () => {
    const body = "x".repeat(MARKDOWN_MAX_CHARS + 10);
    const blocks = renderMarkdownBlocks(body);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].type, "p");
    assert.equal(blocks[0].text.length, MARKDOWN_MAX_CHARS);
    assert.deepEqual(blocks[1], { type: "p", text: MARKDOWN_TRUNCATION_MARK });
  });

  it("parses only the first 64KB and marks truncation on structured input", () => {
    const input = "# H\n\n" + "b".repeat(MARKDOWN_MAX_CHARS) + "\nTAIL_AFTER_CAP";
    const blocks = renderMarkdownBlocks(input);
    assert.deepEqual(blocks[0], H1("H"));
    assert.equal(blocks[1].type, "p");
    assert.equal(blocks[1].text.length, MARKDOWN_MAX_CHARS - 5, "exactly the first 64KB kept");
    assert.ok(blocks[1].text.startsWith("b".repeat(100)), "body kept from the first 64KB");
    assert.ok(
      !blocks.some((b) => b.text.includes("TAIL_AFTER_CAP")),
      "content beyond the cap is dropped",
    );
    assert.deepEqual(blocks[2], { type: "p", text: MARKDOWN_TRUNCATION_MARK });
  });

  it("does not truncate input exactly at the cap", () => {
    const exact = renderMarkdownBlocks("y".repeat(MARKDOWN_MAX_CHARS));
    assert.equal(exact.length, 1);
    assert.equal(exact[0].text.length, MARKDOWN_MAX_CHARS);
    assert.ok(!exact[0].text.includes(MARKDOWN_TRUNCATION_MARK));
  });
});

describe("determinism", () => {
  it("produces identical output for identical input", () => {
    const input =
      "# Report\n\n## Section\n\n```ts\nconst a = 1\n```\n\n- one\n- two\n\n1. three\n2. four\n\n---\n\nFinal words here\nwith a second line\n";
    const first = renderMarkdownBlocks(input);
    const second = renderMarkdownBlocks(input);
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(first), JSON.stringify(second));
  });
});

describe("full-document snapshot", () => {
  it("renders a mixed packet-style body into the exact block sequence", () => {
    const input = [
      "# Northwind Dispatch",
      "",
      "Operations summary for the field-service rollout.",
      "",
      "```json",
      '{"region": "northwest", "units": 42}',
      "```",
      "",
      "- Alpha squad",
      "- Beta squad",
      "",
      "1. Phase one",
      "2. Phase two",
      "",
      "---",
      "",
      "Outcome: delivered.",
    ].join("\n");

    assert.deepEqual(renderMarkdownBlocks(input), [
      H1("Northwind Dispatch"),
      P("Operations summary for the field-service rollout."),
      CODE('{"region": "northwest", "units": 42}', "json"),
      LI("Alpha squad\nBeta squad", false),
      LI("Phase one\nPhase two", true),
      HR,
      P("Outcome: delivered."),
    ]);
  });
});
