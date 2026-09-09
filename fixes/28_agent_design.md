# 28 — Design module landed: design tokens + self-contained design-system HTML (Agent-D handoff)

**Status:** `src/lib/design.ts` + `src/lib/design.test.ts` are LIVE. Typecheck 0, design
suite 31/31 green. **Code against these EXACT exports** — do not rename, do not re-derive
shapes from older drafts. To add `design.test.ts` to the mandated test run, extend the
`test` script in `package.json` (the list is explicit; this file is currently run the same
way the vault tests are: `node --experimental-strip-types --test src/lib/design.test.ts`).

## Exact export surface (src/lib/design.ts)

```ts
export type DesignTokens = {
  palette: {
    name: string;          // "<family> · <cast>", e.g. "logistics · rust"
    base: string;          // primary brand hex (=== tokens.brand)
    tokens: Record<string, string>;  // ALWAYS these 20 keys, this order, lowercase hex:
  };                        // bg surface surfaceAlt ink inkMuted line brand onBrand brandSoft
                           // brandInk accent onAccent accentSoft accentInk ok okSoft bad badSoft warn warnSoft
  typography: { scale: string[]; mono: string };  // 7 px steps (12…32px) · mono font stack
  spacing: number[];       // [4, 8, 12, 16, 24, 32, 48]
  radius: number[];        // [4, 8, 12, 16]
  shadows: string[];       // 3 elevation shadows, index 0 = lowest
};

export function designTokens(project: Project): DesignTokens;  // pure, deterministic
export function designHtml(project: Project): string;          // pure, deterministic, XSS-safe
```

Reuses `fnv1a` from `src/lib/algorithms.ts` (no new deps, no duplicated hash).

## Semantics the CLI/UI can rely on

- **Family detection:** canonical `Project.domain` first (`finance-ops`/`revenue-ops`/`fintech`/`finance`
  → fintech · `logistics`/`operations` → logistics · `health-ops`/`health`/`healthcare`/`medical` → health ·
  `marketplace`/`ecommerce`/`commerce` → marketplace · `game`/`gaming` → game). Canonical ALWAYS wins.
  Otherwise `<name> <brief>` is scanned for family keywords in fixed order
  **game → health → marketplace → logistics → fintech** (first match wins); nothing matches ⇒
  neutral `custom` family. Empty name/brief/domain never throws.
- **Cast choice (the seed's job):** `seed = fnv1a("<trimmed domain>::<trimmed name>")`;
  `cast = CASTS[family][seed % casts.length]`. Each family has exactly 2 curated casts —
  renaming a project can switch the cast *within* its family but never the family.
- **Token meanings:** `bg` page bg · `surface` cards/inputs · `surfaceAlt` wells/code · `ink` primary text ·
  `inkMuted` secondary · `line` borders · `brand`/`onBrand` primary buttons · `brandSoft`/`brandInk`
  brand chips · `accent`/`onAccent` + `accentSoft`/`accentInk` accent buttons/chips/links · `ok`/`bad`/`warn`
  + `*Soft` semantic states (identical across all palettes — do not tint them).
- **Contrast rule (WCAG AA):** every text-bearing pairing ≥ 4.5:1 — ink & ink-muted on bg/surface/
  surface-alt; brand & accent as text/links on surface; on-brand on brand; on-accent on accent;
  brand-ink on brand-soft; accent-ink on accent-soft; ok/bad/warn on surface and on their softs.
  `design.test.ts` re-sweeps all 12 curated rows (6 families × 2 casts, 20 pairings each) with an
  **independent** WCAG luminance implementation — a palette edit that breaks the rule fails CI.
- **designHtml:** complete self-contained HTML5 (doctype, `lang="en"`, charset, viewport meta,
  semantic sections, balanced containers), zero JS, zero external assets, all CSS via
  `var(--token)` custom properties (kebab-cased token keys) + `--fs-*`/`--space-*`/`--radius-*`/`--shadow-*`.
  Sections: hero (palette/domain/status/phase chips + brief) → color-token swatch grid (all 20,
  `data-token="--x"` cells) → type scale → buttons + chips → sample card (lattice jobs + entity
  chips when present, deterministic demo content otherwise) → elevation, spacing, radius → form
  elements → contrast-pairing table → footer.
- **XSS:** every project-derived string is HTML-escaped (`& < > " '`); user text never reaches the
  style block (name/brief/domain are the only interpolations and only in text/attr contexts).

## One-line usage examples

CLI (`preview --out`): `writeFileSync(path, designHtml(project))` — open the string directly as a `.html` page.
CLI/UI (export tokens): `const t = designTokens(project); const brand = t.palette.base; const key = t.palette.tokens.bg;`
UI (React): `const t = useMemo(() => designTokens(project), [project]);` then emit CSS vars once:
`Object.entries(t.palette.tokens).map(([k, v]) => \`--${kebab(k)}: ${v};\`)` (kebab = camelCase → kebab-case).
Sample card: use `t.palette.tokens.brandSoft` + `brandInk` for chips, `accentSoft`/`accentInk` for links' hover bg.
Do NOT mutate returned arrays/objects between renders — `designTokens` returns fresh copies, cheap enough to call per project.

## ⚠ Integration notes for the owner agent

1. Add `src/lib/design.test.ts` to the `test` script in `package.json` (same explicit-list pattern as every other suite).
2. `design.ts` imports `fnv1a` from `./algorithms.ts` — that file is already part of the CLI/UI bundles (engine dependency), no new weight.
3. `fixes/22`'s vault module and this module are independent; the UI "Design" tab can combine them (`designHtml(project)` for the preview pane iframe, `buildVaultNotes` for the knowledge tab).
