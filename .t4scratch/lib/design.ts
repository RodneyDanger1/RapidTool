// ---------------------------------------------------------------------------
// design.ts — deterministic design tokens + self-contained design-system HTML
// preview for a RapidTool Project.
//
// Turns one Project into a DesignTokens object (palette, type scale, spacing,
// radii, shadows) and into a single self-contained HTML5 page that previews
// that design system (swatches, type scale, buttons, cards, forms). Pure +
// deterministic: same Project in ⇒ byte-identical output out. No Date.now(),
// no Math.random, no network, no dependencies beyond the shared fnv1a hash.
//
// EXACT EXPORT SURFACE (the CLI/UI agents compile against these — do not
// rename, and keep semantics below stable):
//
//   export type DesignTokens
//   export function designTokens(project: Project): DesignTokens
//   export function designHtml(project: Project): string
//
// SEMANTICS (read before consuming):
// - One design system per project. `palette.name` is "<family> · <cast>",
//   e.g. "logistics · rust". `palette.base` is the primary brand hex, and
//   `palette.tokens` always holds the same 20 keys (see TOKEN_KEYS); every
//   value is a valid CSS hex color. All other token groups are fixed
//   design-system constants shared by every project.
// - Family detection: Project.domain is matched against the canonical engine
//   domains first (finance-ops/revenue-ops → fintech, logistics/operations →
//   logistics, health-ops → health, marketplace → marketplace; plus a few
//   hand-set spellings: fintech/finance/health/healthcare/game/gaming/…).
//   A canonical hit ALWAYS wins. Otherwise the name+brief text is scanned for
//   family keywords in fixed order game → health → marketplace → logistics →
//   fintech (first match wins). Unmatched projects land on the "custom"
//   neutral family.
// - Seed & cast: seed = fnv1a("<domain>::<name>") (trimmed, lowercase domain
//   preserved as typed). Each family offers two curated color casts; the
//   chosen cast is rows[seed % rows.length], so renaming a project may switch
//   the cast within its family but never the family. Same inputs ⇒ same
//   output, on any platform (FNV-1a is plain integer math).
// - Contrast-safety rule: the curated hex table is built so every text-bearing
//   pairing meets WCAG AA ≥ 4.5:1 (normal text). Guaranteed pairs: ink & ink-
//   muted on bg/surface/surface-alt, brand/accent as text or links on surface,
//   on-brand on brand, on-accent on accent, brand-ink on brand-soft, accent-
//   ink on accent-soft, ok/bad/warn on surface and on their own softs.
//   design.test.ts re-verifies every row with an independent WCAG luminance
//   implementation, so a future palette edit that breaks the rule fails CI.
// - designHtml output: valid HTML5 (doctype, lang, charset, viewport), no
//   external assets, zero JavaScript, all project-derived text HTML-escaped
//   (& < > " ') so hostile names/briefs can never inject markup. CSS uses
//   var(--token) references only; user text never reaches the style block.
// ---------------------------------------------------------------------------
import { fnv1a } from "./algorithms.ts";
import type { Project } from "./types.ts";

// ---------------------------------------------------------------------------
// Token shapes
// ---------------------------------------------------------------------------

export type DesignTokens = {
  palette: {
    /** "<family> · <cast>", e.g. "marketplace · violet". */
    name: string;
    /** Primary brand hex (=== tokens.brand) — the single swatch to brand UI. */
    base: string;
    /** All 20 color tokens, stable key set (see TOKEN_KEYS), valid CSS hex. */
    tokens: Record<string, string>;
  };
  typography: {
    /** Font sizes (px) for the type ramp, index 0 = smallest. */
    scale: string[];
    /** Monospace font stack for code/labels. */
    mono: string;
  };
  /** Spacing ramp (px): 4 8 12 16 24 32 48. */
  spacing: number[];
  /** Corner radii (px): 4 8 12 16. */
  radius: number[];
  /** Elevation shadows, index 0 = lowest. */
  shadows: string[];
};

// ---------------------------------------------------------------------------
// Fixed design-system constants (shared by every project)
// ---------------------------------------------------------------------------

const TYPO_SCALE = ["12px", "14px", "16px", "18px", "20px", "24px", "32px"];

const MONO_STACK =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/** Body (non-token) font stack — only the mono face is a DesignToken. */
const SANS_STACK =
  'ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const SPACING = [4, 8, 12, 16, 24, 32, 48];
const RADIUS = [4, 8, 12, 16];
const SHADOWS = [
  "0 1px 2px rgba(16, 24, 40, 0.05)",
  "0 4px 12px -2px rgba(16, 24, 40, 0.08)",
  "0 16px 40px -12px rgba(16, 24, 40, 0.18)",
];

/** Every key present in palette.tokens, in emission order. */
const TOKEN_KEYS = [
  "bg",
  "surface",
  "surfaceAlt",
  "ink",
  "inkMuted",
  "line",
  "brand",
  "onBrand",
  "brandSoft",
  "brandInk",
  "accent",
  "onAccent",
  "accentSoft",
  "accentInk",
  "ok",
  "okSoft",
  "bad",
  "badSoft",
  "warn",
  "warnSoft",
] as const;

const TOKEN_ROLE: Record<string, string> = {
  bg: "Page background",
  surface: "Cards, inputs, elevated blocks",
  surfaceAlt: "Inset wells, code blocks",
  ink: "Primary text",
  inkMuted: "Secondary text, captions",
  line: "Borders, dividers",
  brand: "Primary action, focus brand",
  onBrand: "Text/icon on brand",
  brandSoft: "Brand chip background",
  brandInk: "Text on brandSoft",
  accent: "Secondary action, links",
  onAccent: "Text/icon on accent",
  accentSoft: "Accent chip background",
  accentInk: "Text on accentSoft",
  ok: "Success text / strong state",
  okSoft: "Success chip background",
  bad: "Error text / strong state",
  badSoft: "Error chip background",
  warn: "Warning text / strong state",
  warnSoft: "Warning chip background",
};

// ---------------------------------------------------------------------------
// Palette data (curated hexes; every text pairing verified ≥ 4.5:1 WCAG AA)
// ---------------------------------------------------------------------------

type FamilyId = "fintech" | "logistics" | "health" | "marketplace" | "game" | "custom";

/** Family-shared surfaces + text colors (both casts of a family share these). */
type FamilyNeutrals = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkMuted: string;
  line: string;
};

/** One curated cast: brand + accent families with their safe on/soft/ink pairs. */
type FamilyCast = {
  name: string; // "<family> · <cast>"
  brand: string;
  onBrand: string;
  brandSoft: string;
  brandInk: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  accentInk: string;
};

const NEUTRALS: Record<FamilyId, FamilyNeutrals> = {
  fintech: {
    bg: "#edf3f0",
    surface: "#ffffff",
    surfaceAlt: "#f6f9f8",
    ink: "#0f1f19",
    inkMuted: "#48625a",
    line: "#dbdddd",
  },
  logistics: {
    bg: "#f5f0e6",
    surface: "#ffffff",
    surfaceAlt: "#faf8f3",
    ink: "#241a10",
    inkMuted: "#6b5d49",
    line: "#dedddb",
  },
  health: {
    bg: "#eaf4f0",
    surface: "#ffffff",
    surfaceAlt: "#f5faf8",
    ink: "#0e2420",
    inkMuted: "#44625a",
    line: "#dbdede",
  },
  marketplace: {
    bg: "#f3f0f7",
    surface: "#ffffff",
    surfaceAlt: "#f9f8fb",
    ink: "#1d1530",
    inkMuted: "#5b5270",
    line: "#dddce0",
  },
  game: {
    bg: "#f6efea",
    surface: "#ffffff",
    surfaceAlt: "#fbf7f5",
    ink: "#241613",
    inkMuted: "#6b5347",
    line: "#dedcdc",
  },
  custom: {
    bg: "#eff2f5",
    surface: "#ffffff",
    surfaceAlt: "#f7f9fa",
    ink: "#16202b",
    inkMuted: "#4a5866",
    line: "#dcdedf",
  },
};

/** Two curated casts per family; cast index = seed % casts.length. */
const CASTS: Record<FamilyId, FamilyCast[]> = {
  fintech: [
    {
      name: "fintech · emerald",
      brand: "#065f46",
      onBrand: "#ffffff",
      brandSoft: "#dce9e5",
      brandInk: "#0a4232",
      accent: "#b45309",
      onAccent: "#ffffff",
      accentSoft: "#f5e7dd",
      accentInk: "#6a3c10",
    },
    {
      name: "fintech · navy",
      brand: "#1e3a8a",
      onBrand: "#ffffff",
      brandSoft: "#e0e3ef",
      brandInk: "#172e57",
      accent: "#0f766e",
      onAccent: "#ffffff",
      accentSoft: "#ddeceb",
      accentInk: "#0f4f48",
    },
  ],
  logistics: [
    {
      name: "logistics · rust",
      brand: "#9a3412",
      onBrand: "#ffffff",
      brandSoft: "#f1e3de",
      brandInk: "#652811",
      accent: "#1b4965",
      onAccent: "#ffffff",
      accentSoft: "#dfe6e9",
      accentInk: "#1f343f",
    },
    {
      name: "logistics · steel",
      brand: "#1b4965",
      onBrand: "#ffffff",
      brandSoft: "#dfe6e9",
      brandInk: "#1f343f",
      accent: "#92400e",
      onAccent: "#ffffff",
      accentSoft: "#f0e4dd",
      accentInk: "#612f0f",
    },
  ],
  health: [
    {
      name: "health · teal",
      brand: "#0f766e",
      onBrand: "#ffffff",
      brandSoft: "#ddeceb",
      brandInk: "#0f514b",
      accent: "#1d4ed8",
      onAccent: "#ffffff",
      accentSoft: "#dfe6fa",
      accentInk: "#163b85",
    },
    {
      name: "health · sky",
      brand: "#0369a1",
      onBrand: "#ffffff",
      brandSoft: "#dceaf2",
      brandInk: "#084a67",
      accent: "#0f766e",
      onAccent: "#ffffff",
      accentSoft: "#ddeceb",
      accentInk: "#0f514b",
    },
  ],
  marketplace: [
    {
      name: "marketplace · violet",
      brand: "#5b21b6",
      onBrand: "#ffffff",
      brandSoft: "#e8e0f5",
      brandInk: "#3f1c7a",
      accent: "#9d174d",
      onAccent: "#ffffff",
      accentSoft: "#f1dfe6",
      accentInk: "#631640",
    },
    {
      name: "marketplace · indigo",
      brand: "#4338ca",
      onBrand: "#ffffff",
      brandSoft: "#e5e3f8",
      brandInk: "#322885",
      accent: "#be123c",
      onAccent: "#ffffff",
      accentSoft: "#f6dee4",
      accentInk: "#761337",
    },
  ],
  game: [
    {
      name: "game · ember",
      brand: "#92400e",
      onBrand: "#ffffff",
      brandSoft: "#f0e4dd",
      brandInk: "#612d10",
      accent: "#be123c",
      onAccent: "#ffffff",
      accentSoft: "#f6dee4",
      accentInk: "#79142a",
    },
    {
      name: "game · arcade",
      brand: "#5b21b6",
      onBrand: "#ffffff",
      brandSoft: "#e8e0f5",
      brandInk: "#421c6d",
      accent: "#92400e",
      onAccent: "#ffffff",
      accentSoft: "#f0e4dd",
      accentInk: "#612d10",
    },
  ],
  custom: [
    {
      name: "custom · indigo",
      brand: "#4338ca",
      onBrand: "#ffffff",
      brandSoft: "#e5e3f8",
      brandInk: "#2f2d82",
      accent: "#0369a1",
      onAccent: "#ffffff",
      accentSoft: "#dceaf2",
      accentInk: "#0c486c",
    },
    {
      name: "custom · slate",
      brand: "#334155",
      onBrand: "#ffffff",
      brandSoft: "#e2e4e7",
      brandInk: "#263242",
      accent: "#0f766e",
      onAccent: "#ffffff",
      accentSoft: "#ddeceb",
      accentInk: "#124f50",
    },
  ],
};

/** Semantic state colors — intentionally identical across every palette. */
const SEMANTIC: Record<string, string> = {
  ok: "#166534",
  okSoft: "#dee9e3",
  bad: "#b42318",
  badSoft: "#f5e0df",
  warn: "#92400e",
  warnSoft: "#f0e4dd",
};

// ---------------------------------------------------------------------------
// Family detection
// ---------------------------------------------------------------------------

/** Canonical engine domains (plus common hand-set spellings) → palette family. */
const CANONICAL_DOMAIN: Record<string, FamilyId> = {
  "finance-ops": "fintech",
  "revenue-ops": "fintech",
  fintech: "fintech",
  finance: "fintech",
  logistics: "logistics",
  operations: "logistics",
  "health-ops": "health",
  health: "health",
  healthcare: "health",
  medical: "health",
  marketplace: "marketplace",
  ecommerce: "marketplace",
  commerce: "marketplace",
  game: "game",
  gaming: "game",
};

/** Family keyword matchers over "<name> <brief>" — first match wins (order matters). */
const FAMILY_KEYWORDS: [FamilyId, RegExp][] = [
  [
    "game",
    /(^|[^a-z0-9])(?:games?|gaming|gamer|gamers|arcade|gameplay|esports|leaderboards?|matchmaking)(?=$|[^a-z0-9])/,
  ],
  [
    "health",
    /(^|[^a-z0-9])(?:health|healthy|clinic|clinics|clinical|patient|patients|medical|hospital|hospitals|hipaa|wellness|telehealth)(?=$|[^a-z0-9])/,
  ],
  [
    "marketplace",
    /(^|[^a-z0-9])(?:marketplace|storefront|listing|listings|commerce|checkout|shopping|shop|buyer|buyers|seller|sellers|vendor|vendors|auction)(?=$|[^a-z0-9])/,
  ],
  [
    "logistics",
    /(^|[^a-z0-9])(?:logistic|logistics|dispatch|fleet|fleets|delivery|deliveries|deliver|warehouse|shipping|courier|freight|route|routes|routing|driver|drivers)(?=$|[^a-z0-9])/,
  ],
  [
    "fintech",
    /(^|[^a-z0-9])(?:fintech|finance|financial|financing|bank|banks|banking|payment|payments|invoice|invoices|invoicing|bill|bills|billing|ledger|payroll|treasury|quote|quotes|quoting|invest|investment|trading|wallet|wallets)(?=$|[^a-z0-9])/,
  ],
];

/**
 * Palette family for a project. Canonical Project.domain hits always win;
 * otherwise the first family keyword found in "<name> <brief>" wins; anything
 * unmatched falls back to "custom". Pure and deterministic.
 */
function familyFor(project: Project): FamilyId {
  const domain = (project.domain ?? "").trim().toLowerCase();
  const canonical = CANONICAL_DOMAIN[domain];
  if (canonical) return canonical;
  const haystack = `${project.name ?? ""} ${project.brief ?? ""}`.toLowerCase();
  for (const [family, re] of FAMILY_KEYWORDS) {
    if (re.test(haystack)) return family;
  }
  return "custom";
}

/** Trimmed project.domain, "unspecified" when blank (display text only). */
function domainLabel(project: Project): string {
  const d = (project.domain ?? "").trim();
  return d || "unspecified";
}

/** Trimmed project.name, fixed fallback when blank. */
function nameLabel(project: Project): string {
  const n = (project.name ?? "").trim();
  return n || "Untitled project";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deterministic design tokens for a project: a curated palette derived from
 * the project's domain family (seed = fnv1a("<domain>::<name>") picks one of
 * the family's two casts), plus the fixed typography/spacing/radius/shadow
 * ramps. Every color is a valid lowercase hex; text pairings are ≥ 4.5:1
 * (see the module header for the contrast-safety rule).
 */
export function designTokens(project: Project): DesignTokens {
  const family = familyFor(project);
  const casts = CASTS[family];
  const seed = fnv1a(`${(project.domain ?? "").trim()}::${(project.name ?? "").trim()}`);
  const cast = casts[seed % casts.length];
  const assembled: Record<string, string> = {
    ...NEUTRALS[family],
    brand: cast.brand,
    onBrand: cast.onBrand,
    brandSoft: cast.brandSoft,
    brandInk: cast.brandInk,
    accent: cast.accent,
    onAccent: cast.onAccent,
    accentSoft: cast.accentSoft,
    accentInk: cast.accentInk,
    ...SEMANTIC,
  };
  // Re-map through TOKEN_KEYS so the documented key set + order is enforced,
  // even if a future palette edit adds or reorders fields above.
  const tokens: Record<string, string> = {};
  for (const key of TOKEN_KEYS) tokens[key] = assembled[key];
  return {
    palette: {
      name: cast.name,
      base: cast.brand,
      tokens,
    },
    typography: {
      scale: [...TYPO_SCALE],
      mono: MONO_STACK,
    },
    spacing: [...SPACING],
    radius: [...RADIUS],
    shadows: [...SHADOWS],
  };
}

// ---------------------------------------------------------------------------
// HTML preview (self-contained, XSS-safe, deterministic)
// ---------------------------------------------------------------------------

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape user text for safe HTML text/attribute contexts. Control chars that
 *  are invalid or hostile inside HTML (C0 + DEL) are dropped first, then the
 *  five markup-significant characters are entity-escaped. */
function esc(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** camelCase token key → kebab-case CSS variable name suffix. */
function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Cap long free text deterministically (keeps the preview page bounded). */
function excerpt(text: string, cap: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > cap ? `${t.slice(0, cap).trimEnd()}…` : t;
}

/** One CSS custom-property declaration per token, from the generated tokens. */
function cssTokenLines(tokens: DesignTokens): string[] {
  const lines = Object.entries(tokens.palette.tokens).map(
    ([key, value]) => `  --${kebab(key)}: ${value};`,
  );
  tokens.typography.scale.forEach((size, i) => lines.push(`  --fs-${i}: ${size};`));
  tokens.spacing.forEach((px, i) => lines.push(`  --space-${i}: ${px}px;`));
  tokens.radius.forEach((px, i) => lines.push(`  --radius-${i}: ${px}px;`));
  tokens.shadows.forEach((shadow, i) => lines.push(`  --shadow-${i}: ${shadow};`));
  return lines;
}

/** Status → chip tone class (colors come from semantic/brand tokens only). */
const STATUS_TONE: Record<string, string> = {
  complete: "chip-ok",
  rejected: "chip-bad",
  blocked: "chip-bad",
  awaiting_hitl: "chip-warn",
  running: "chip-brand",
  intake: "chip-brand",
};

/**
 * Complete, self-contained HTML5 design-system page for a project. Only the
 * generated tokens feed the CSS (custom properties); every project-derived
 * string is HTML-escaped. Deterministic byte-for-byte per project.
 */
export function designHtml(project: Project): string {
  const t = designTokens(project);
  const name = nameLabel(project);
  const domain = domainLabel(project);
  const status = (project.status ?? "intake").trim() || "intake";
  const brief = excerpt(project.brief ?? "", 320);
  const lattice = project.lattice ?? null;
  const jobs = lattice?.jobs?.length ? lattice.jobs.slice(0, 3) : [];
  const entities = lattice?.entities?.length ? lattice.entities.slice(0, 8) : [];

  const tokenCss = cssTokenLines(t).join("\n");

  const swatchCell = (key: string, value: string): string => {
    const varName = `--${kebab(key)}`;
    return [
      `        <div class="sw">`,
      `          <div class="swatch" style="background: ${value}" data-token="${varName}" title="${varName}"></div>`,
      `          <div class="sw-meta">`,
      `            <code>${varName}</code>`,
      `            <span class="muted">${value} · ${TOKEN_ROLE[key] ?? "token"}</span>`,
      `          </div>`,
      `        </div>`,
    ].join("\n");
  };

  const swatchSection = (title: string, keys: readonly string[]): string => {
    const cells = keys
      .map((key) => swatchCell(key, t.palette.tokens[key]))
      .join("\n");
    return [`      <h2 class="sec">${title}</h2>`, `      <div class="grid">${"\n"}${cells}\n      </div>`].join(
      "\n",
    );
  };

  const scaleRows = t.typography.scale
    .map(
      (size, i) =>
        `        <div class="scale-row"><code class="size-tag">--fs-${i}: ${size}</code><span class="sample" style="font-size: var(--fs-${i})">The quick brown fox jumps — ${size}</span></div>`,
    )
    .join("\n");

  const button = (classes: string, label: string, disabled = false): string =>
    `          <button class="btn ${classes}" type="button"${disabled ? " disabled" : ""}>${label}</button>`;

  const chip = (classes: string, label: string): string =>
    `<span class="chip ${classes}">${label}</span>`;

  const jobList = jobs.length
    ? jobs.map((j) => `            <li>${esc(j)}</li>`).join("\n")
    : [
        `            <li>Define the core workflow</li>`,
        `            <li>Map the primary data model</li>`,
        `            <li>Prototype the key screen</li>`,
      ].join("\n");

  const tagList = entities.length
    ? entities.map((e) => `              ${chip("chip-brand", esc(e))}`).join("\n")
    : `              ${chip("chip-brand", "Account")}\n              ${chip("chip-brand", "Order")}\n              ${chip("chip-brand", "Report")}`;

  return [
    `<!DOCTYPE html>`,
    `<html lang="en">`,
    `<head>`,
    `  <meta charset="utf-8" />`,
    `  <meta name="viewport" content="width=device-width, initial-scale=1" />`,
    `  <meta name="color-scheme" content="light" />`,
    `  <meta name="description" content="Deterministic design system preview for ${esc(name)}" />`,
    `  <title>${esc(name)} · Design system</title>`,
    `  <style>`,
    `:root {`,
    tokenCss,
    `}`,
    `* { box-sizing: border-box; }`,
    `html, body { margin: 0; padding: 0; }`,
    `body { background: var(--bg); color: var(--ink); font-family: ${SANS_STACK}; font-size: var(--fs-2); line-height: 1.55; }`,
    `code { font-family: ${MONO_STACK}; font-size: var(--fs-0); }`,
    `.wrap { max-width: 1080px; margin: 0 auto; padding: var(--space-5) var(--space-4); }`,
    `header.hero { margin-bottom: var(--space-5); }`,
    `h1 { font-size: var(--fs-6); line-height: 1.15; margin: 0 0 var(--space-2); letter-spacing: -0.02em; }`,
    `h2.sec { font-size: var(--fs-4); margin: var(--space-5) 0 var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--line); }`,
    `p.lede { color: var(--ink-muted); margin: 0; max-width: 72ch; }`,
    `.chips { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); }`,
    `.chip { display: inline-flex; align-items: center; border-radius: var(--radius-3); padding: 2px var(--space-2); font-size: var(--fs-0); font-weight: 600; }`,
    `.chip-brand { background: var(--brand-soft); color: var(--brand-ink); }`,
    `.chip-accent { background: var(--accent-soft); color: var(--accent-ink); }`,
    `.chip-ok { background: var(--ok-soft); color: var(--ok); }`,
    `.chip-warn { background: var(--warn-soft); color: var(--warn); }`,
    `.chip-bad { background: var(--bad-soft); color: var(--bad); }`,
    `.chip-neutral { background: var(--surface); color: var(--ink-muted); border: 1px solid var(--line); }`,
    `.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-3); }`,
    `.sw { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-1); padding: var(--space-2); }`,
    `.swatch { height: 52px; border-radius: var(--radius-0); border: 1px solid var(--line); }`,
    `.sw-meta { margin-top: var(--space-1); display: flex; flex-direction: column; gap: 2px; }`,
    `.sw-meta .muted { color: var(--ink-muted); font-size: var(--fs-0); }`,
    `.muted { color: var(--ink-muted); }`,
    `.scale-row { display: flex; align-items: baseline; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--line); }`,
    `.size-tag { color: var(--ink-muted); min-width: 110px; flex: none; }`,
    `.sample { color: var(--ink); }`,
    `.row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin: var(--space-2) 0; }`,
    `.btn { font: inherit; font-weight: 600; padding: var(--space-1) var(--space-3); border-radius: var(--radius-1); border: 1px solid transparent; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: var(--space-1); }`,
    `.btn-primary { background: var(--brand); color: var(--on-brand); }`,
    `.btn-accent { background: var(--accent); color: var(--on-accent); }`,
    `.btn-outline { background: var(--surface); color: var(--brand); border-color: var(--line); }`,
    `.btn-ghost { background: transparent; color: var(--ink-muted); }`,
    `.btn:hover { filter: brightness(0.93); }`,
    `.btn:disabled { opacity: 0.55; cursor: not-allowed; filter: none; }`,
    `.btn:focus-visible, .field:focus-visible, select:focus-visible, textarea:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-soft); }`,
    `.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-2); box-shadow: var(--shadow-1); padding: var(--space-4); }`,
    `.card h3 { margin: 0 0 var(--space-1); font-size: var(--fs-4); }`,
    `.card .meta { color: var(--ink-muted); font-size: var(--fs-1); margin-bottom: var(--space-2); }`,
    `.card ul { margin: 0 0 var(--space-3); padding-left: var(--space-4); }`,
    `form.ds-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-3); }`,
    `.field { display: flex; flex-direction: column; gap: 4px; }`,
    `.field > label, .field > legend { font-size: var(--fs-1); font-weight: 600; color: var(--ink); }`,
    `.field input, .field select, .field textarea { font: inherit; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-1); padding: var(--space-2); }`,
    `.check-row { display: flex; align-items: center; gap: var(--space-1); font-size: var(--fs-1); }`,
    `fieldset.field { border: none; margin: 0; padding: 0; }`,
    `.well { background: var(--surface-alt); border: 1px solid var(--line); border-radius: var(--radius-1); padding: var(--space-3); color: var(--ink); font-family: ${MONO_STACK}; font-size: var(--fs-1); overflow-x: auto; }`,
    `table.pairs { border-collapse: collapse; width: 100%; max-width: 720px; font-size: var(--fs-1); }`,
    `table.pairs th, table.pairs td { text-align: left; padding: var(--space-1) var(--space-2); border-bottom: 1px solid var(--line); }`,
    `table.pairs th { color: var(--ink-muted); font-weight: 600; }`,
    `table.pairs code { color: var(--accent-ink); }`,
    `footer.site { margin-top: var(--space-5); padding-top: var(--space-3); border-top: 1px solid var(--line); color: var(--ink-muted); font-size: var(--fs-1); }`,
    `a { color: var(--accent); }`,
    `  </style>`,
    `</head>`,
    `<body>`,
    `  <main class="wrap">`,
    `    <header class="hero">`,
    `      <div class="chips">`,
    `        ${chip("chip-brand", esc(t.palette.name))}`,
    `        ${chip("chip-accent", `domain: ${esc(domain)}`)}`,
    `        ${chip(STATUS_TONE[status] ?? "chip-neutral", `status: ${esc(status)}`)}`,
    `        ${chip("chip-neutral", `phase P${esc(String(project.currentPhase ?? 0))}`)}`,
    `      </div>`,
    `      <h1>${esc(name)} — design system</h1>`,
    `      <p class="lede">${brief ? esc(brief) : "No brief recorded."}</p>`,
    `    </header>`,
    ``,
    swatchSection("Color tokens — surfaces & text", ["bg", "surface", "surfaceAlt", "ink", "inkMuted", "line"]),
    ``,
    swatchSection("Color tokens — brand & accent", [
      "brand",
      "onBrand",
      "brandSoft",
      "brandInk",
      "accent",
      "onAccent",
      "accentSoft",
      "accentInk",
    ]),
    ``,
    swatchSection("Color tokens — semantic states", ["ok", "okSoft", "bad", "badSoft", "warn", "warnSoft"]),
    ``,
    `      <h2 class="sec">Typography</h2>`,
    `      <p class="muted" style="margin: 0 0 var(--space-2)">Mono stack: <code>${esc(t.typography.mono)}</code></p>`,
    scaleRows,
    ``,
    `      <h2 class="sec">Buttons</h2>`,
    `      <div class="row">`,
    button("btn-primary", "Primary action"),
    button("btn-accent", "Accent action"),
    button("btn-outline", "Secondary action"),
    button("btn-ghost", "Ghost action"),
    button("btn-primary", "Disabled", true),
    `      </div>`,
    `      <div class="row">`,
    `        ${chip("chip-brand", "brand-soft chip")}`,
    `        ${chip("chip-accent", "accent-soft chip")}`,
    `        ${chip("chip-ok", "ok soft chip")}`,
    `        ${chip("chip-warn", "warn soft chip")}`,
    `        ${chip("chip-bad", "bad soft chip")}`,
    `      </div>`,
    ``,
    `      <h2 class="sec">Sample card</h2>`,
    `      <div class="card" style="max-width: 640px">`,
    `        <h3>${esc(name)}</h3>`,
    `        <div class="meta">domain: ${esc(domain)} · palette ${esc(t.palette.name)} · surface / line / ink-muted tokens in use</div>`,
    `        <ul>`,
    jobList,
    `        </ul>`,
    `        <div class="chips" style="margin-bottom: var(--space-3)">`,
    tagList,
    `        </div>`,
    `        <div class="row" style="margin: 0">`,
    button("btn-primary", "Open"),
    button("btn-outline", "Details"),
    `        </div>`,
    `      </div>`,
    ``,
    `      <h2 class="sec">Elevation</h2>`,
    `      <div class="row" style="align-items: stretch">`,
    ...t.shadows.map(
      (_, i) =>
        `        <div class="card" style="width: 190px; box-shadow: var(--shadow-${i}); margin: 0"><div class="meta">shadow-${i}</div><code>var(--shadow-${i})</code></div>`,
    ),
    `      </div>`,
    ``,
    `      <h2 class="sec">Spacing & radius</h2>`,
    `      <div class="row" style="align-items: flex-end">`,
    ...t.spacing.map(
      (px, i) =>
        `        <div style="display:flex;flex-direction:column;gap:4px;align-items:center"><div style="width: var(--space-${i}); height: 24px; background: var(--brand-soft); border-radius: 2px"></div><code class="muted">${px}</code></div>`,
    ),
    `      </div>`,
    `      <div class="row" style="align-items: flex-end">`,
    ...t.radius.map(
      (px, i) =>
        `        <div style="display:flex;flex-direction:column;gap:4px;align-items:center"><div style="width: 44px; height: 44px; background: var(--accent-soft); border-radius: var(--radius-${i})"></div><code class="muted">r ${px}</code></div>`,
    ),
    `      </div>`,
    ``,
    `      <h2 class="sec">Form elements</h2>`,
    `      <form class="ds-form" action="#" method="get">`,
    `        <div class="field">`,
    `          <label for="ds-name">Record name</label>`,
    `          <input id="ds-name" name="name" type="text" placeholder="e.g. ${esc(excerpt(name, 24))}" />`,
    `        </div>`,
    `        <div class="field">`,
    `          <label for="ds-kind">Kind</label>`,
    `          <select id="ds-kind" name="kind">`,
    `            <option value="draft">Draft</option>`,
    `            <option value="active">Active</option>`,
    `            <option value="archived">Archived</option>`,
    `          </select>`,
    `        </div>`,
    `        <div class="field">`,
    `          <label for="ds-note">Note</label>`,
    `          <textarea id="ds-note" name="note" rows="2" placeholder="Optional note…"></textarea>`,
    `        </div>`,
    `        <fieldset class="field">`,
    `          <legend>Priority</legend>`,
    `          <div class="check-row"><input type="radio" id="ds-p-low" name="priority" value="low" checked /><label for="ds-p-low">Low</label></div>`,
    `          <div class="check-row"><input type="radio" id="ds-p-high" name="priority" value="high" /><label for="ds-p-high">High</label></div>`,
    `        </fieldset>`,
    `        <div class="field">`,
    `          <div class="check-row"><input type="checkbox" id="ds-flag" name="flag" /><label for="ds-flag">Flag for review</label></div>`,
    `        </div>`,
    `        <div class="field">`,
    `          <button class="btn btn-primary" type="submit">Submit</button>`,
    `        </div>`,
    `      </form>`,
    ``,
    `      <h2 class="sec">Contrast-safe pairings (WCAG AA ≥ 4.5:1)</h2>`,
    `      <table class="pairs">`,
    `        <caption class="muted" style="text-align:left;font-size:var(--fs-1);margin-bottom:var(--space-1)">Rule: every pairing below passes 4.5:1 on all 12 curated rows; enforced by design.test.ts with an independent WCAG luminance check.</caption>`,
    `        <thead><tr><th>Pairing</th><th>Tokens</th></tr></thead>`,
    `        <tbody>`,
    `          <tr><td>Body text</td><td><code>ink</code> on <code>bg</code> / <code>surface</code> / <code>surface-alt</code></td></tr>`,
    `          <tr><td>Secondary text</td><td><code>ink-muted</code> on <code>bg</code> / <code>surface</code></td></tr>`,
    `          <tr><td>Primary buttons</td><td><code>on-brand</code> on <code>brand</code></td></tr>`,
    `          <tr><td>Accent buttons</td><td><code>on-accent</code> on <code>accent</code></td></tr>`,
    `          <tr><td>Brand chips</td><td><code>brand-ink</code> on <code>brand-soft</code></td></tr>`,
    `          <tr><td>Accent chips</td><td><code>accent-ink</code> on <code>accent-soft</code></td></tr>`,
    `          <tr><td>Links / brand text</td><td><code>accent</code> / <code>brand</code> on <code>surface</code></td></tr>`,
    `          <tr><td>State chips</td><td><code>ok</code> / <code>bad</code> / <code>warn</code> on their softs and on <code>surface</code></td></tr>`,
    `        </tbody>`,
    `      </table>`,
    ``,
    `    <footer class="site">`,
    `      Generated deterministically by the RapidTool design module · ${esc(t.palette.name)} · ${t.palette.tokens ? Object.keys(t.palette.tokens).length : 0} color tokens · zero runtime JS`,
    `    </footer>`,
    `  </main>`,
    `</body>`,
    `</html>`,
  ].join("\n");
}
