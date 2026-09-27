// ---------------------------------------------------------------------------
// vector.test.ts — LLM-as-designer SVG logo/icon/badge suite (G-37/G-38)
// Run: node --experimental-strip-types --test src/lib/vector.test.ts
// ---------------------------------------------------------------------------
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { seedProject } from "./testing/fixtures.ts";
import { designTokens } from "./design.ts";
import type { Project } from "./types.ts";
import {
  BADGE_TONES,
  generateBadge,
  generateIconSet,
  generateLogo,
  geometricMonogram,
  monogramInitials,
  promptLogo,
  sanitizeSvg,
  svgToDataUrl,
  usedHexColors,
} from "./vector.ts";

const KEY = "DEEPSEEK_API_KEY";

const realFetch = globalThis.fetch;

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Canned DeepSeek json-mode completion whose text is `jsonText`. */
function llmReplies(jsonText: string, status = 200): void {
  process.env[KEY] = "sk-test";
  globalThis.fetch = (async () =>
    okResponse(
      {
        model: "deepseek-v4-flash",
        choices: [{ message: { role: "assistant", content: jsonText } }],
      },
      status,
    )) as typeof fetch;
}

function project(name = "Acme Dispatch"): Project {
  return seedProject({ name, brief: "HVAC field-service dispatch board for technicians." });
}

/** One strict-grammar valid logo (viewBox 96, palette-only fills). */
const VALID_LOGO =
  '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">' +
  '<rect x="4" y="4" width="88" height="88" rx="18" fill="#4338ca"/>' +
  '<circle cx="48" cy="40" r="14" fill="#ffffff"/>' +
  '<path d="M28 62 L48 78 L68 62" fill="none" stroke="#fde68a" stroke-width="4"/>' +
  "</svg>";

beforeEach(() => {
  delete process.env[KEY];
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env[KEY];
});

// ---------------------------------------------------------------------------
// Sanitizer: attack corpus is rejected with evidence
// ---------------------------------------------------------------------------

describe("sanitizeSvg blocks hostile input (fail closed)", () => {
  const svg = (body: string): string => `<svg viewBox="0 0 96 96">${body}</svg>`;

  it("rejects <script> with an evidence reason", () => {
    const res = sanitizeSvg(svg("<script>alert(1)</script><rect width='10' height='10'/>"));
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.reason, /<script>/);
  });

  it("rejects <foreignObject> (HTML smuggling)", () => {
    const res = sanitizeSvg(
      svg("<foreignObject><div onclick='x()'>hi</div></foreignObject>"),
    );
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.reason, /foreignObject/);
  });

  it("rejects event-handler attributes (onclick/onload/onerror)", () => {
    for (const attr of ["onclick", "onload", "onerror", "OnMouseOver"]) {
      const res = sanitizeSvg(`<svg viewBox="0 0 96 96" ${attr}="alert(1)"><rect width="5" height="5"/></svg>`);
      assert.equal(res.ok, false, `${attr} must be rejected`);
      if (!res.ok) assert.match(res.reason, /event attribute/i);
    }
  });

  it("rejects style attributes (CSS exfil vector)", () => {
    const res = sanitizeSvg(svg('<rect width="5" height="5" style="background:url(http://evil)"/>'));
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.reason, /style attribute/);
  });

  it("rejects url()/javascript:/data: values on any attribute", () => {
    const cases = [
      svg('<rect width="5" height="5" fill="url(http://evil/x.svg)"/>'),
      svg('<rect width="5" height="5" fill="url(#grad1)"/>'),
      '<svg viewBox="0 0 96 96"><a xlink:href="javascript:alert(1)"><rect width="5" height="5"/></a></svg>',
      svg('<rect width="5" height="5" fill="data:image/svg+xml;base64,AAAA"/>'),
    ];
    for (const input of cases) {
      const res = sanitizeSvg(input);
      assert.equal(res.ok, false);
      if (!res.ok) assert.match(res.reason, /unsafe reference|not allowed|disallowed element/);
    }
  });

  it("rejects href/xlink:href and unknown elements (iframe/use/image/a)", () => {
    for (const bad of ["<iframe>", "<use>", "<image>", "<a>", "<filter>", "<script/>"]) {
      const res = sanitizeSvg(`<svg viewBox="0 0 96 96">${bad}<rect width="5" height="5"/></svg>`);
      assert.equal(res.ok, false, `${bad} must be rejected`);
      if (!res.ok) assert.match(res.reason, /disallowed element/);
    }
    const href = sanitizeSvg('<svg viewBox="0 0 96 96"><rect width="5" height="5" href="https://evil/x"/></svg>');
    assert.equal(href.ok, false);
    if (!href.ok) assert.match(href.reason, /href/);
  });

  it("rejects unbalanced, unclosed, and trailing-content markup", () => {
    const unbalanced = sanitizeSvg("<svg viewBox='0 0 96 96'><g><rect width='5' height='5'/></svg>");
    assert.equal(unbalanced.ok, false);
    if (!unbalanced.ok) assert.match(unbalanced.reason, /unbalanced/);
    const unclosed = sanitizeSvg("<svg viewBox='0 0 96 96'><g><rect width='5' height='5'/></g>");
    assert.equal(unclosed.ok, false);
    if (!unclosed.ok) assert.match(unclosed.reason, /unclosed/);
    const trailing = sanitizeSvg("<svg viewBox='0 0 96 96'><rect width='5' height='5'/></svg><rect width='5' height='5'/>");
    assert.equal(trailing.ok, false);
    if (!trailing.ok) assert.match(trailing.reason, /after root/);
  });

  it("rejects markup declarations, comments, PIs, and numeric entities", () => {
    for (const input of [
      "<svg viewBox='0 0 96 96'><!-- comment --><rect width='5' height='5'/></svg>",
      "<svg viewBox='0 0 96 96'><?xml version='1.0'?><rect width='5' height='5'/></svg>",
      "<svg viewBox='0 0 96 96'><rect width='5' height='5' fill='&#106;avascript:1'/></svg>",
      "<svg viewBox='0 0 96 96'><text x='0' y='0' fill='#000000'>raw & entity</text></svg>",
    ]) {
      const res = sanitizeSvg(input);
      assert.equal(res.ok, false);
    }
  });

  it("rejects oversized (10MB) and deeply nested input", () => {
    const huge = sanitizeSvg(`<svg viewBox="0 0 96 96">${"<rect width='1' height='1'/>".repeat(200_000)}</svg>`);
    assert.equal(huge.ok, false);
    if (!huge.ok) assert.match(huge.reason, /too large/);
    const deep = sanitizeSvg(`<svg viewBox="0 0 96 96">${"<g>".repeat(40)}<rect width="5" height="5"/>${"</g>".repeat(40)}</svg>`);
    assert.equal(deep.ok, false);
    if (!deep.ok) assert.match(deep.reason, /nested|unbalanced|unclosed/);
  });

  it("rejects non-hex paints and non-numeric geometry", () => {
    const badFill = sanitizeSvg(svg('<rect width="5" height="5" fill="red"/>'));
    assert.equal(badFill.ok, false);
    if (!badFill.ok) assert.match(badFill.reason, /invalid value for fill/);
    const badNum = sanitizeSvg(svg('<rect width="abc" height="5"/>'));
    assert.equal(badNum.ok, false);
    const noViewBox = sanitizeSvg("<svg><rect width='5' height='5'/></svg>");
    assert.equal(noViewBox.ok, false);
    if (!noViewBox.ok) assert.match(noViewBox.reason, /viewBox/);
  });
});

// ---------------------------------------------------------------------------
// Sanitizer: valid shapes survive as a canonical rebuild
// ---------------------------------------------------------------------------

describe("sanitizeSvg keeps valid shapes (canonical rebuild)", () => {
  it("accepts every whitelisted shape tag with normalized colors", () => {
    const input =
      '<svg viewBox="0 0 96 96">' +
      '<rect x="1" y="2" width="10" height="20" rx="2" fill="#FF8800"/>' +
      '<circle cx="30" cy="30" r="8" fill="#f80"/>' +
      '<ellipse cx="50" cy="30" rx="10" ry="6" fill="none" stroke="#123abc" stroke-width="1.5"/>' +
      '<line x1="10" y1="60" x2="30" y2="70" stroke="#000000"/>' +
      '<polygon points="40,60 50,70 60,60" fill="#ffffff"/>' +
      '<path d="M5 80 L20 95 L35 80 Z" fill="#4338ca"/>' +
      "</svg>";
    const res = sanitizeSvg(input);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.match(res.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 96 96">/);
      assert.ok(res.svg.includes("<rect x=\"1\" y=\"2\" width=\"10\" height=\"20\" rx=\"2\" fill=\"#ff8800\"/>"));
      assert.ok(res.svg.includes("fill=\"#ff8800\"")); // #f80 → #ff8800
      assert.ok(res.svg.includes("<circle cx=\"30\" cy=\"30\" r=\"8\""));
      assert.ok(res.svg.includes("<ellipse cx=\"50\" cy=\"30\" rx=\"10\" ry=\"6\""));
      assert.ok(res.svg.includes("<line x1=\"10\" y1=\"60\" x2=\"30\" y2=\"70\""));
      assert.ok(res.svg.includes("<polygon points=\"40,60 50,70 60,60\""));
      assert.ok(res.svg.includes("<path d=\"M5 80 L20 95 L35 80 Z\""));
    }
  });

  it("accepts grouped shapes and keeps transform lists canonical", () => {
    const input =
      '<svg viewBox="0 0 96 96">' +
      '<g transform="rotate(45 48 48) translate(2 -3)">' +
      '<rect x="4" y="4" width="20" height="20" fill="#4338ca"/>' +
      "</g>" +
      "</svg>";
    const res = sanitizeSvg(input);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.ok(res.svg.includes('transform="rotate(45, 48, 48) translate(2, -3)"'));
      assert.ok(res.svg.includes("</g>"));
    }
  });

  it("accepts text with escaped content and strips benign unknown attrs", () => {
    const input =
      '<svg viewBox="0 0 96 96" version="1.1" role="img">' +
      '<rect id="a" class="b" opacity="0.5" x="0" y="0" width="96" height="96" fill="#111827"/>' +
      '<text x="48" y="50" font-size="20" text-anchor="middle" fill="#ffffff">A &amp; B &lt;C&gt;</text>' +
      "</svg>";
    const res = sanitizeSvg(input);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.ok(!res.svg.includes("version="), "version attr must be stripped");
      assert.ok(!res.svg.includes("id=") && !res.svg.includes("class=") && !res.svg.includes("opacity="));
      assert.ok(res.svg.includes("A &amp; B &lt;C&gt;"), "text content stays escaped");
      assert.ok(res.svg.endsWith("</svg>"));
    }
  });

  it("normalizes viewBox numbers and clamps oversized coordinates", () => {
    const res = sanitizeSvg('<svg viewBox="0,0,96.0,96">' + "<rect width='5' height='5' x='99999' fill='#000000'/></svg>");
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.ok(res.svg.includes('viewBox="0 0 96 96"'));
      assert.ok(res.svg.includes("x=\"4096\""), "coordinate must clamp to 4096");
    }
  });

  it("is deterministic and idempotent", () => {
    const input =
      '<svg viewBox="0 0 96 96"><g><rect x="1" y="1" width="10" height="10" fill="#AaA"/><path d="M0 0 L5 5"/></g></svg>';
    const first = sanitizeSvg(input);
    const second = sanitizeSvg(input);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(first.svg, second.svg);
      const again = sanitizeSvg(first.svg);
      assert.equal(again.ok, true);
      if (again.ok) assert.equal(again.svg, first.svg);
    }
  });

  it("never returns raw model output (canonical rebuild differs from input)", () => {
    const input =
      '<svg viewBox="0 0 96 96"><rect x="1" y="1" width="10" height="10" fill="#fff"/></svg>';
    const res = sanitizeSvg(input);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.notEqual(res.svg, input);
      assert.ok(!res.svg.includes("<svg viewBox"), "root must gain the canonical xmlns");
    }
  });
});

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

describe("svgToDataUrl + usedHexColors", () => {
  it("produces an img-safe data URL only from sanitized svg", () => {
    const url = svgToDataUrl(VALID_LOGO);
    assert.ok(url);
    if (url) {
      assert.ok(url.startsWith("data:image/svg+xml;charset=utf-8,"));
      assert.ok(url.includes("%3Csvg"), "content must be percent-encoded");
      assert.ok(!url.includes("<script"));
    }
    assert.equal(svgToDataUrl("<script>alert(1)</script>"), null);
    assert.equal(svgToDataUrl("not svg at all"), null);
  });

  it("extracts every fill/stroke hex in first-use order", () => {
    assert.deepEqual(usedHexColors(VALID_LOGO), ["#4338ca", "#ffffff", "#fde68a"]);
    assert.deepEqual(usedHexColors("<svg></svg>"), []);
  });
});

// ---------------------------------------------------------------------------
// Deterministic badge builder (no LLM)
// ---------------------------------------------------------------------------

describe("generateBadge (deterministic, keyless)", () => {
  it("is byte-identical for the same inputs and deterministic across tones", () => {
    const a = generateBadge("Ready", "ok");
    const b = generateBadge("Ready", "ok");
    assert.equal(a, b);
    assert.notEqual(generateBadge("Ready", "ok"), generateBadge("Ready", "bad"));
    assert.notEqual(generateBadge("Ready", "ok"), generateBadge("Pending", "ok"));
  });

  it("renders a rounded pill with centered, escaped text", () => {
    const svg = generateBadge("a<b&c", "neutral");
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ 24">/);
    assert.ok(svg.includes("<rect x=\"0\" y=\"0\""));
    assert.ok(svg.includes("rx=\"12\""));
    assert.ok(svg.includes("a&lt;b&amp;c"), "text must be XML-escaped");
    assert.ok(!svg.includes("a<b&c"));
  });

  it("honors AA-safe design-token pairs when tokens are provided", () => {
    const tokens = {
      brand: "#111827",
      onBrand: "#ffffff",
      accent: "#0ea5e9",
      onAccent: "#082f49",
      ink: "#111827",
      surfaceAlt: "#e5e7eb",
      line: "#d1d5db",
      ok: "#15803d",
      okSoft: "#dcfce7",
      warn: "#92400e",
      warnSoft: "#fef3c7",
      bad: "#b91c1c",
      badSoft: "#fee2e2",
    };
    const svg = generateBadge("Go", "brand", tokens);
    assert.ok(svg.includes('fill="#111827"'));
    assert.ok(svg.includes('fill="#ffffff"'));
    const soft = generateBadge("Warn", "warn", tokens);
    assert.ok(soft.includes('fill="#fef3c7"') && soft.includes('fill="#92400e"'));
  });

  it("throws on unknown tones and stays deterministic for every BADGE_TONES value", () => {
    assert.throws(() => generateBadge("x", "neon" as never), /unknown badge tone/);
    for (const tone of BADGE_TONES) {
      const out = generateBadge("Ship", tone);
      assert.match(out, /^<svg /);
      assert.equal(out, generateBadge("Ship", tone));
    }
  });

  it("produces sanitizer-clean svg (deterministic outputs pass the sanitizer)", () => {
    for (const tone of BADGE_TONES) {
      const res = sanitizeSvg(generateBadge("Beta", tone));
      assert.equal(res.ok, true, `badge tone ${tone} must be sanitizer-clean`);
      if (res.ok) assert.equal(res.svg, generateBadge("Beta", tone));
    }
  });
});

// ---------------------------------------------------------------------------
// Deterministic monogram floor
// ---------------------------------------------------------------------------

describe("geometricMonogram (deterministic floor)", () => {
  it("is byte-stable for the same name+seed and varies with the seed", () => {
    const a = geometricMonogram("Acme Dispatch", 7);
    const b = geometricMonogram("Acme Dispatch", 7);
    assert.equal(a, b);
    assert.notEqual(geometricMonogram("Acme Dispatch", 7), geometricMonogram("Acme Dispatch", 8));
  });

  it("renders initials, seeded geometry, and project-palette colors", () => {
    assert.equal(monogramInitials("Acme Dispatch"), "AD");
    assert.equal(monogramInitials("Nexus"), "N");
    assert.equal(monogramInitials(""), "RT");
    const tokens = { brand: "#111827", onBrand: "#ffffff", accent: "#fbbf24" };
    const svg = geometricMonogram("Acme Dispatch", 3, tokens);
    assert.ok(svg.includes(">AD</text>"));
    assert.ok(svg.includes('fill="#111827"'));
    assert.ok(svg.includes('fill="#fbbf24"'));
    assert.ok(svg.includes("transform=\"rotate("));
    const clean = sanitizeSvg(svg);
    assert.equal(clean.ok, true, "monogram must be sanitizer-clean");
  });
});

// ---------------------------------------------------------------------------
// LLM-as-designer: generateLogo
// ---------------------------------------------------------------------------

describe("generateLogo (DeepSeek json:true flash)", () => {
  it("honesty: keyless run returns the deterministic monogram, never a fake LLM", async () => {
    const p = project("Acme Dispatch");
    const res = await generateLogo(p);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.source, "deterministic");
      assert.match(res.note ?? "", /not-configured/);
      // Byte-identical to the deterministic floor built from the project palette.
      const tokens = designTokens(p).palette.tokens;
      assert.equal(res.svg, geometricMonogram("Acme Dispatch", 0, tokens));
      assert.deepEqual(res.palette, usedHexColors(res.svg));
    }
    // Same inputs ⇒ byte-identical floor (no network, no key).
    const again = await generateLogo(p);
    assert.deepEqual(again, res);
  });

  it("calls deepseek-v4-flash with json response_format and returns the llm asset", async () => {
    const p = project("Acme Dispatch");
    const captured: { body?: { model?: string; response_format?: unknown; messages?: unknown[] } } = {};
    process.env[KEY] = "sk-test";
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body)) as typeof captured.body;
      return okResponse({
        model: "deepseek-v4-flash",
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                name: "Acme Bolt",
                svg: VALID_LOGO,
                palette: ["#4338ca", "#ffffff", "#fde68a"],
              }),
            },
          },
        ],
      });
    }) as typeof fetch;

    const res = await generateLogo(p);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.source, "llm");
      assert.equal(res.name, "Acme Bolt");
      assert.equal(res.model, "deepseek-v4-flash");
      const clean = sanitizeSvg(res.svg);
      assert.equal(clean.ok, true, "llm svg must pass sanitizeSvg");
      if (clean.ok) assert.equal(clean.svg, res.svg);
      assert.deepEqual(res.palette, ["#4338ca", "#ffffff", "#fde68a"]);
    }
    assert.equal(captured.body?.model, "deepseek-v4-flash");
    assert.deepEqual(captured.body?.response_format, { type: "json_object" });
    assert.ok(
      (captured.body?.messages ?? []).some(
        (m) =>
          typeof m === "object" &&
          m !== null &&
          String((m as { role?: string }).role) === "user" &&
          String((m as { content?: string }).content ?? "").includes("<svg"),
      ),
      "prompt must carry the strict svg grammar",
    );
  });

  it("never returns model output the sanitizer rejects — falls back with the reason", async () => {
    const p = project("Acme Dispatch");
    llmReplies(
      JSON.stringify({
        name: "EvilCo",
        svg: '<svg viewBox="0 0 96 96"><script>alert(1)</script><rect width="10" height="10" fill="#000000"/></svg>',
        palette: ["#000000"],
      }),
    );
    const res = await generateLogo(p);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.source, "deterministic");
      assert.match(res.note ?? "", /LLM output rejected/);
      assert.match(res.note ?? "", /script/);
      assert.ok(!res.svg.includes("script"), "raw model output must never surface");
    }
  });

  it("rejects palette cheating: fills outside the declared palette → monogram floor", async () => {
    const p = project();
    llmReplies(
      JSON.stringify({
        name: "CheatCo",
        svg: '<svg viewBox="0 0 96 96"><rect width="10" height="10" fill="#123456"/></svg>',
        palette: ["#4338ca"],
      }),
    );
    const res = await generateLogo(p);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.source, "deterministic");
      assert.match(res.note ?? "", /palette mismatch/);
      assert.match(res.note ?? "", /#123456/);
    }
  });

  it("rejects empty/no-shape svg and malformed JSON with evidence", async () => {
    const p = project();
    llmReplies(JSON.stringify({ name: "X", svg: "<svg viewBox='0 0 96 96'></svg>", palette: [] }));
    const empty = await generateLogo(p);
    assert.equal(empty.ok, true);
    if (empty.ok) {
      assert.equal(empty.source, "deterministic");
      assert.match(empty.note ?? "", /no drawn shapes/);
    }
    llmReplies("this is not json at all");
    const bad = await generateLogo(p);
    assert.equal(bad.ok, true);
    if (bad.ok) {
      assert.equal(bad.source, "deterministic");
      assert.match(bad.note ?? "", /not a JSON object/);
    }
  });

  it("surfaces real API failures honestly as ok:false (no silent fallback)", async () => {
    const p = project();
    process.env[KEY] = "sk-test";
    globalThis.fetch = (async () =>
      okResponse({ error: { message: "rate limited" } }, 429)) as typeof fetch;
    const res = await generateLogo(p);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, "error");
      assert.match(res.error, /rate limit|failed/i);
    }
  });

  it("respects brief/style overrides in the prompt deterministically", () => {
    const p = project("Acme Dispatch");
    const a = promptLogo(p, "custom brief", "flat, no gradients");
    const b = promptLogo(p, "custom brief", "flat, no gradients");
    assert.equal(a, b);
    assert.ok(a.includes("custom brief"));
    assert.ok(a.includes("flat, no gradients"));
    assert.ok(a.includes("Acme Dispatch"));
    assert.ok(a.includes("#"));
    assert.ok(!a.includes("undefined"));
  });
});

// ---------------------------------------------------------------------------
// LLM-as-designer: generateIconSet
// ---------------------------------------------------------------------------

describe("generateIconSet (DeepSeek json:true flash)", () => {
  const GLYPH =
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" fill="#4338ca"/></svg>';
  const GLYPH2 =
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#ffffff"/></svg>';

  it("returns N sanitized named glyphs from the model", async () => {
    const p = project();
    llmReplies(
      JSON.stringify({
        icons: [
          { name: "bolt", svg: GLYPH },
          { name: "ring", svg: GLYPH2 },
        ],
        palette: ["#4338ca", "#ffffff"],
      }),
    );
    const res = await generateIconSet(p, "energy", 2);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.source, "llm");
      assert.equal(res.icons.length, 2);
      assert.deepEqual(
        res.icons.map((g) => g.name),
        ["bolt", "ring"],
      );
      for (const g of res.icons) {
        const clean = sanitizeSvg(g.svg);
        assert.equal(clean.ok, true, "every llm glyph must pass sanitizeSvg");
        if (clean.ok) assert.equal(clean.svg, g.svg);
      }
      assert.deepEqual(res.dropped, []);
      assert.deepEqual(res.palette, ["#4338ca", "#ffffff"]);
    }
  });

  it("drops only the hostile glyphs and keeps the clean ones", async () => {
    const p = project();
    llmReplies(
      JSON.stringify({
        icons: [
          { name: "good", svg: GLYPH },
          { name: "evil", svg: '<svg viewBox="0 0 24 24"><script>alert(1)</script><rect width="5" height="5" fill="#4338ca"/></svg>' },
        ],
        palette: ["#4338ca"],
      }),
    );
    const res = await generateIconSet(p, "energy", 2);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.source, "llm");
      assert.equal(res.icons.length, 1);
      assert.equal(res.icons[0]?.name, "good");
      assert.equal(res.dropped.length, 1);
      assert.equal(res.dropped[0]?.name, "evil");
      assert.match(res.dropped[0]?.reason ?? "", /script/);
    }
  });

  it("falls back deterministically when keyless (byte-stable, sanitizer-clean)", async () => {
    const p = project("Acme Dispatch");
    const a = await generateIconSet(p, "energy", 4);
    const b = await generateIconSet(p, "energy", 4);
    assert.equal(a.ok, true);
    assert.deepEqual(a, b);
    if (a.ok) {
      assert.equal(a.source, "deterministic");
      assert.equal(a.icons.length, 4);
      assert.match(a.note ?? "", /not-configured/);
      for (const g of a.icons) {
        assert.ok(g.name.startsWith("energy"));
        const clean = sanitizeSvg(g.svg);
        assert.equal(clean.ok, true);
      }
    }
  });

  it("count is clamped to 1..12 and model arrays longer than 12 are capped", async () => {
    const p = project();
    const glyphs = Array.from({ length: 20 }, (_, i) => ({
      name: `g${i}`,
      svg: GLYPH,
    }));
    llmReplies(JSON.stringify({ icons: glyphs, palette: ["#4338ca"] }));
    const res = await generateIconSet(p, "x", 99);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.icons.length, 12);
      if (res.source === "llm") assert.equal(res.dropped.length, 0);
    }
    delete process.env[KEY]; // keyless now: honest deterministic floor
    const keyless = await generateIconSet(p, "y", 0);
    assert.equal(keyless.ok, true);
    if (keyless.ok) assert.equal(keyless.icons.length, 1);
  });
});
