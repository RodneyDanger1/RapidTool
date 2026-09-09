// ---------------------------------------------------------------------------
// design.test.ts — deterministic design tokens + design-system HTML
// (src/lib/design.ts). Run: node --experimental-strip-types --test src/lib/design.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { designHtml, designTokens } from "./design.ts";
import type { DesignTokens } from "./design.ts";
import { fnv1a } from "./algorithms.ts";
import { seedProject } from "./testing/fixtures.ts";
import type { Project } from "./types.ts";

// ---------------------------------------------------------------------------
// Independent helpers (deliberately NOT shared with src/lib/design.ts)
// ---------------------------------------------------------------------------

/** Independent WCAG relative-luminance implementation. */
function luminance(hex: string): number {
  const ch = hex.slice(1).match(/[0-9a-f]{2}/gi);
  assert.ok(ch, `expected hex color, got ${hex}`);
  const lin = ch.map((pair) => {
    const c = parseInt(pair, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Independent WCAG contrast ratio. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** camelCase → kebab (mirrors design.ts for CSS-var assertions). */
function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

const HEX = /^#[0-9a-f]{6}$/;

/** Documented token key set, in emission order. */
const TOKEN_KEYS = [
  "bg", "surface", "surfaceAlt", "ink", "inkMuted", "line",
  "brand", "onBrand", "brandSoft", "brandInk",
  "accent", "onAccent", "accentSoft", "accentInk",
  "ok", "okSoft", "bad", "badSoft", "warn", "warnSoft",
];

/** Text-on-background token pairings that must each reach ≥ 4.5:1. */
const PAIR_KEYS: [string, string][] = [
  ["ink", "bg"], ["ink", "surface"], ["ink", "surfaceAlt"],
  ["inkMuted", "bg"], ["inkMuted", "surface"], ["inkMuted", "surfaceAlt"],
  ["brand", "surface"], ["accent", "surface"],
  ["brandInk", "surface"], ["accentInk", "surface"],
  ["ok", "surface"], ["bad", "surface"], ["warn", "surface"],
  ["onBrand", "brand"], ["onAccent", "accent"],
  ["brandInk", "brandSoft"], ["accentInk", "accentSoft"],
  ["ok", "okSoft"], ["bad", "badSoft"], ["warn", "warnSoft"],
];

/** Neutral text (no family keyword, no canonical domain). */
const NEUTRAL_BRIEF = "Internal coordination tool for the back office.";

function proj(over: Partial<Project> = {}): Project {
  return seedProject({
    name: "Design Fixture",
    brief: NEUTRAL_BRIEF,
    domain: "custom-software",
    ...over,
  });
}

/** Family → its two curated cast names, in index order. */
const CAST_NAMES: Record<string, [string, string]> = {
  fintech: ["fintech · emerald", "fintech · navy"],
  logistics: ["logistics · rust", "logistics · steel"],
  health: ["health · teal", "health · sky"],
  marketplace: ["marketplace · violet", "marketplace · indigo"],
  game: ["game · ember", "game · arcade"],
  custom: ["custom · indigo", "custom · slate"],
};

/** Cast index designTokens picks: fnv1a("<domain>::<name>") % casts.length. */
function expectedCastIndex(p: Project): number {
  return fnv1a(`${(p.domain ?? "").trim()}::${(p.name ?? "").trim()}`) % 2;
}

/** A project in `family` whose cast parity equals `idx` (brute-force names). */
function castProject(family: string, idx: number): Project {
  const seed: Partial<Project> = { domain: family };
  if (family === "custom") seed.domain = "custom-software";
  for (let i = 0; i < 200; i++) {
    const p = proj({ ...seed, name: `Cast Probe ${i}` });
    if (expectedCastIndex(p) === idx) return p;
  }
  throw new Error(`could not find a ${family} project with cast index ${idx}`);
}

/** Sweep every documented pairing on a project's tokens, asserting ≥ 4.5:1. */
function assertContrastSafe(t: DesignTokens): void {
  for (const [fgKey, bgKey] of PAIR_KEYS) {
    const fg = t.palette.tokens[fgKey];
    const bg = t.palette.tokens[bgKey];
    assert.ok(fg && bg, `missing tokens for pair ${fgKey}/${bgKey}`);
    const r = contrast(fg, bg);
    assert.ok(
      r >= 4.5,
      `${t.palette.name}: ${fgKey} (${fg}) on ${bgKey} (${bg}) = ${r.toFixed(2)}:1 — needs ≥ 4.5:1`,
    );
  }
}

// ---------------------------------------------------------------------------
// designTokens — determinism, shape, family mapping
// ---------------------------------------------------------------------------

describe("designTokens — determinism & shape", () => {
  it("returns deep-equal tokens for the same project every call", () => {
    const p = proj({ name: "Ledger Lite", domain: "finance-ops" });
    const a = designTokens(p);
    const b = designTokens(p);
    assert.deepEqual(a, b);
    assert.deepEqual(a.palette.tokens, b.palette.tokens);
  });

  it("returns fresh copies — mutating a result never leaks into the next call", () => {
    const p = proj({ name: "Copy Safety", domain: "logistics" });
    const first = designTokens(p);
    first.typography.scale.push("999px");
    first.spacing.pop();
    first.palette.tokens.bg = "#000000";
    const second = designTokens(p);
    assert.equal(second.typography.scale.includes("999px"), false);
    assert.equal(second.typography.scale.length, 7);
    assert.notEqual(second.palette.tokens.bg, "#000000");
    assert.ok(HEX.test(second.palette.tokens.bg));
    assert.deepEqual(second, designTokens(p));
  });

  it("emits the exact 20-key token set, all valid lowercase hex", () => {
    for (const p of [proj(), proj({ domain: "health-ops", name: "Clinic OS" })]) {
      const t = designTokens(p);
      assert.deepEqual(Object.keys(t.palette.tokens), TOKEN_KEYS);
      for (const value of Object.values(t.palette.tokens)) {
        assert.match(value, HEX, `not a valid lowercase hex color: ${value}`);
      }
      assert.equal(t.palette.base, t.palette.tokens.brand);
      assert.match(t.palette.base, HEX);
    }
  });

  it("holds fixed system groups: 7-step px scale, mono stack, ascending spacing/radius, 3 shadows", () => {
    const t = designTokens(proj());
    assert.equal(t.typography.scale.length, 7);
    for (const s of t.typography.scale) assert.match(s, /^\d+px$/);
    assert.ok(t.typography.mono.includes("monospace"));
    assert.ok(t.typography.mono.includes("ui-monospace"));
    assert.deepEqual(t.spacing, [...t.spacing].sort((a, b) => a - b));
    assert.deepEqual(t.radius, [...t.radius].sort((a, b) => a - b));
    assert.ok(t.spacing.every((n) => Number.isInteger(n) && n > 0));
    assert.equal(t.shadows.length, 3);
    for (const s of t.shadows) assert.match(s, /^0 /);
  });

  it("shares typography/spacing/radius/shadow groups across different domains", () => {
    const a = designTokens(proj({ domain: "marketplace", name: "Bazaar" }));
    const b = designTokens(proj({ domain: "finance-ops", name: "Ledger" }));
    assert.deepEqual(a.typography, b.typography);
    assert.deepEqual(a.spacing, b.spacing);
    assert.deepEqual(a.radius, b.radius);
    assert.deepEqual(a.shadows, b.shadows);
  });
});

describe("designTokens — domain family mapping", () => {
  const CANONICAL: [string, string][] = [
    ["finance-ops", "fintech"],
    ["revenue-ops", "fintech"],
    ["logistics", "logistics"],
    ["operations", "logistics"],
    ["health-ops", "health"],
    ["marketplace", "marketplace"],
    ["game", "game"],
  ];
  it("maps every canonical engine domain to its palette family", () => {
    for (const [domain, family] of CANONICAL) {
      const t = designTokens(proj({ domain, name: `Canonical ${domain}` }));
      assert.ok(
        t.palette.name.startsWith(`${family} · `),
        `${domain} should land in ${family}, got ${t.palette.name}`,
      );
    }
  });

  it("finds families by keyword when domain is custom-software", () => {
    const cases: [string, string][] = [
      ["game", "Competitive arcade game with matchmaking and leaderboards."],
      ["health", "Patient intake and clinical scheduling for our clinics."],
      ["marketplace", "Two-sided storefront with checkout for sellers and buyers."],
      ["logistics", "Dispatch and routing for delivery fleets with warehouse sync."],
      ["fintech", "Invoice billing, quotes and the payment ledger."],
    ];
    for (const [family, brief] of cases) {
      const t = designTokens(proj({ name: "Keyword Probe", brief, domain: "custom-software" }));
      assert.ok(
        t.palette.name.startsWith(`${family} · `),
        `brief "${brief}" should land in ${family}, got ${t.palette.name}`,
      );
    }
  });

  it("falls back to the custom family for unknown domains with neutral text", () => {
    const t = designTokens(proj({ name: "Back Office", domain: "quantum-leap-ops" }));
    assert.ok(t.palette.name.startsWith("custom · "), `got ${t.palette.name}`);
    // Truly empty domain/brief/name also falls back safely.
    const t2 = designTokens(proj({ name: "", brief: "", domain: "" }));
    assert.ok(t2.palette.name.startsWith("custom · "), `got ${t2.palette.name}`);
  });

  it("lets a canonical domain win over contradicting keywords", () => {
    const t = designTokens(
      proj({ domain: "health-ops", name: "GameHub Arcade", brief: "Retro arcade game cabinet for hospitals." }),
    );
    assert.ok(t.palette.name.startsWith("health · "), `got ${t.palette.name}`);
    const t2 = designTokens(
      proj({ domain: "finance-ops", name: "FleetPay", brief: "Dispatch app for courier fleets." }),
    );
    assert.ok(t2.palette.name.startsWith("fintech · "), `got ${t2.palette.name}`);
  });
});

describe("designTokens — seed & casts", () => {
  it("picks the cast at fnv1a('<domain>::<name>') % casts.length", () => {
    for (const family of Object.keys(CAST_NAMES)) {
      for (const idx of [0, 1]) {
        const p = castProject(family, idx);
        const t = designTokens(p);
        assert.equal(t.palette.name, CAST_NAMES[family][idx], `${family} cast ${idx}`);
        assert.equal(expectedCastIndex(p), idx, "probe must have the requested parity");
      }
    }
  });

  it("keeps the family across renames while both casts are reachable by name", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 32; i++) {
      const p = proj({ domain: "finance-ops", name: `Ledger ${i}` });
      const t = designTokens(p);
      assert.ok(t.palette.name.startsWith("fintech · "), `got ${t.palette.name}`);
      seen.add(t.palette.name);
    }
    assert.deepEqual([...seen].sort(), [...CAST_NAMES.fintech].sort());
  });

  it("keeps semantics identical across every family (state colors carry meaning)", () => {
    const semantic = ["ok", "okSoft", "bad", "badSoft", "warn", "warnSoft"];
    const baseline = designTokens(castProject("custom", 0)).palette.tokens;
    for (const family of Object.keys(CAST_NAMES)) {
      for (const idx of [0, 1]) {
        const tokens = designTokens(castProject(family, idx)).palette.tokens;
        for (const key of semantic) {
          assert.equal(tokens[key], baseline[key], `${family} cast ${idx} ${key}`);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Contrast safety — independent WCAG luminance sweep over every curated row
// ---------------------------------------------------------------------------

describe("contrast safety (independent WCAG AA ≥ 4.5:1 sweep)", () => {
  for (const family of Object.keys(CAST_NAMES)) {
    for (const idx of [0, 1]) {
      it(`${family} · cast ${idx} — every documented text pairing passes`, () => {
        assertContrastSafe(designTokens(castProject(family, idx)));
      });
    }
  }
});

// ---------------------------------------------------------------------------
// designHtml — validity, determinism, escaping
// ---------------------------------------------------------------------------

describe("designHtml — structure & determinism", () => {
  it("is byte-identical for the same project (twice, and across clones)", () => {
    const p = proj({ name: "Stable Page", domain: "logistics" });
    const a = designHtml(p);
    assert.equal(a, designHtml(p));
    const clone = structuredClone(p) as Project;
    assert.equal(a, designHtml(clone));
    assert.ok(a.length > 2000, "preview page should be substantial");
  });

  it("is a well-formed HTML5 document with the expected sections", () => {
    const p = proj({ name: "Valid Page", domain: "marketplace" });
    const html = designHtml(p);
    assert.ok(html.startsWith("<!DOCTYPE html>"));
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<meta charset="utf-8" \/>/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1" \/>/);
    assert.ok(html.trimEnd().endsWith("</html>"));
    // Balanced container tags.
    for (const tag of ["div", "form", "table", "ul", "header", "main", "footer", "fieldset"]) {
      const open = (html.match(new RegExp(`<${tag}([ >])`, "g")) ?? []).length;
      const close = (html.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
      assert.equal(open, close, `unbalanced <${tag}>: ${open} open vs ${close} close`);
    }
    for (const needle of ["Color tokens — surfaces", "Typography", "Buttons", "Sample card", "Elevation", "Form elements", "Contrast-safe pairings"]) {
      assert.ok(html.includes(needle), `missing section: ${needle}`);
    }
  });

  it("emits one CSS variable + one swatch cell per token, all tokens present", () => {
    const t = designTokens(proj({ name: "Swatch Page", domain: "health-ops" }));
    const html = designHtml(proj({ name: "Swatch Page", domain: "health-ops" }));
    for (const [key, value] of Object.entries(t.palette.tokens)) {
      assert.ok(html.includes(`--${kebab(key)}: ${value};`), `css var missing for ${key}`);
      assert.ok(html.includes(value), `hex ${value} never rendered`);
    }
    const cells = (html.match(/data-token="--[a-z-]+"/g) ?? []).length;
    assert.equal(cells, TOKEN_KEYS.length, "expected one swatch cell per token");
    // System groups surface as CSS variables too.
    assert.ok(html.includes("--fs-6: 32px;"));
    assert.ok(html.includes("--space-6: 48px;"));
    assert.ok(html.includes("--shadow-2:"));
  });
});

describe("designHtml — XSS safety & text rendering", () => {
  it("escapes hostile project text so it can never inject markup", () => {
    const hostile = proj({
      name: '<script>alert("xss")</script>',
      brief: '<img src=x onerror=alert(1)> & "quoted" <b>bold</b>',
      domain: 'evil"><b>ops</b>',
    });
    const html = designHtml(hostile);
    assert.ok(!html.includes("<script>alert"), "raw <script> leaked");
    assert.ok(!html.includes("<img"), "raw <img leaked");
    assert.ok(!html.includes('"><b>'), "raw attribute breakout leaked");
    assert.ok(html.includes("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"));
    assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
    assert.ok(html.includes("&amp; &quot;quoted&quot;"));
    assert.ok(html.includes("&quot;&gt;&lt;b&gt;ops&lt;/b&gt;"));
    // The <title> carries the escaped name, not a script tag.
    assert.ok(html.includes("<title>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; · Design system</title>"));
  });

  it("renders project text (escaped) into the hero, card, chips and footer", () => {
    const p = proj({ name: "Nimbus <Fleet>", domain: "logistics", brief: "Same-day dispatch for 3,000+ vehicles & drivers." });
    const html = designHtml(p);
    assert.ok(html.includes("Nimbus &lt;Fleet&gt;"));
    assert.ok(html.includes("Same-day dispatch for 3,000+ vehicles &amp; drivers."));
    assert.ok(html.includes("domain: logistics"));
    assert.ok(html.includes("logistics · "));
    assert.ok(html.includes("RapidTool design module"));
  });

  it("handles an empty/blank project without throwing, with visible fallbacks", () => {
    const p = proj({ name: "   ", brief: "", domain: "" });
    const t = designTokens(p);
    assert.ok(t.palette.name.startsWith("custom · "), `got ${t.palette.name}`);
    assert.match(t.palette.tokens.bg, HEX);
    const html = designHtml(p);
    assert.ok(html.includes("Untitled project"));
    assert.ok(html.includes("No brief recorded."));
    assert.ok(html.includes("domain: unspecified"));
    assert.ok(html.includes("custom · "));
  });

  it("renders deterministic sample content when the intent lattice is absent", () => {
    const p = proj({ name: "No Lattice", lattice: null });
    const t = designTokens(p);
    assert.deepEqual(Object.keys(t.palette.tokens), TOKEN_KEYS);
    const html = designHtml(p);
    assert.ok(html.includes("Define the core workflow"));
    assert.equal(html, designHtml(p));
  });
});
