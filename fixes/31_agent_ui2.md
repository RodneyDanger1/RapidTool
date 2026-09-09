# Design + Diagram tabs in console.tsx — swatches, scale previews, SVG render + copy/download (flash agent #5)

- **File touched:** `src/components/console.tsx` ONLY (repo root `C:/Users/mnril/Desktop/RapidTool Main`, NOT git). `src/styles.css` deliberately untouched — every new control is Tailwind utility-only, re-theming through the existing `--color-*` tokens (light `data-theme` included), so no component CSS classes were needed (unlike the vault tab's `.vault-link`, which had to style markup inside note bodies).
- **Date / agent:** 2026-09-06 · Flash UI agent #5 (Design + Diagram panels).
- **Consumed (blind → verified after landing):** `src/lib/design.ts` (`designTokens(project): DesignTokens`, `designHtml(project): string`) and `src/lib/diagram.ts` (`buildDiagram(project, kind: DiagramKind): string`, `type DiagramKind = "phases" | "architecture" | "flow"`). Both modules landed mid-flight (00:27 / 00:29); the two consumption components were written against a defensive unknown-level normalizer first, then verified against the real export surface and aligned precisely.
- **Additive only:** one union member ×2, two triggers, two content panels, two components + pane-local helpers. No existing control flow, handler, or style was rewritten. One label reword (Tabs.List `aria-label`, same precedent as the vault change).

---

## 1. Design tab (`Tabs.Trigger value="design"` → `<DesignPane project={project} />`)

Pure view over design.ts — no store writes, pane-local state only.

1. **Toolbar** — “Download design.html” (`designHtml(project)` → Blob `text/html` → `<slug>-design.html` via `slugName` from io.ts; honest `role="alert"` errors when design.ts throws or returns empty) and “Copy CSS variables” (normalized tokens formatted as a paste-ready `:root { … }` block; label flips to “Copied CSS”).
2. **Palette identity line** — `palette.name` (e.g. “marketplace · violet”) shown in the mono caption.
3. **Swatch grid** — the 20 `palette.tokens` hexes (`colors` section; token name + hex label under each chip, role-tooltip on hover). Click-to-copy the hex value with a per-chip “✓ Copied” flash; chips carry `aria-label="Copy color <name> — <hex>"` and the app's `focus-visible:ring` classes. Non-hex values render a neutral `bg-faint` chip instead of a broken color block.
4. **Type scale** — `typography.scale` (7 sizes) rendered as real font-size samples labelled `xs…2xl` (RAMP_LABELS by ramp index); unparseable values fall back to plain text rows.
5. **Fonts** — `typography.mono` stack shown as a “Ag” specimen with `fontFamily` applied.
6. **Spacing** — `spacing` number[] → proportional width bars (px-scaled, capped at 240 px).
7. **Radius** — `radius` number[] → boxes with the actual `border-radius`.
8. **Shadows** — `shadows` string[] → boxes with the actual `box-shadow`.
9. Empty state when design.ts returns nothing renderable (“design.ts returned an empty palette…”).

**Normalization layering** (why the pane cannot break when design.ts refactors): `loadDesignView(project)` → `tokensView(raw)` (precise DesignTokens shape: `palette.tokens` Record, `typography.scale/mono`, numeric `spacing/radius`, string `shadows`) → falls back to `designView(raw)` (generic grouped/flat CSS-var dictionary probes, with a guard that design-like objects it does not recognize stay empty rather than being misfiled) → `EMPTY_DESIGN_VIEW`. `designTokens` is also accepted as a static object OR a project function (it landed as the function), and generator throws are contained per-pane — the `forceMount` panels mount on screen load, so a throw must never take the whole RunScreen down.

## 2. Diagram tab (`Tabs.Trigger value="diagram"` → `<DiagramPane project={project} />`)

1. **Kind switcher** — phases / architecture / flow (`aria-pressed` segmented buttons, `role="group" aria-label="Diagram kind"`), each with a one-line hint of what the view shows.
2. **Render** — `buildDiagram(project, kind)` → SVG markup → `data:image/svg+xml;charset=utf-8` URI in an `<img>` (explicit `alt`). Deliberately **no `dangerouslySetInnerHTML`**: agentnotes.md flags the codebase's no-innerHTML posture, and an `<img>` data URI is the same fidelity with zero DOM-injection surface. Diagram keeps its intrinsic size inside an `overflow-auto` bordered stage so SVG text stays legible (diagram.ts SVGs carry `width`/`height`/`viewBox` + their own dark palette).
3. **Copy SVG** / **Download SVG** — clipboard (flash “Copied SVG”) / Blob `image/svg+xml` → `<slug>-diagram-<kind>.svg`; both disabled with honest styling until a diagram exists, errors surface via `role="alert"`.

## 3. a11y / theme polish

- `RunTab` union grew `"design" | "diagram"`; triggers reuse the exact sibling trigger classes (`data-[state=active]` underline pattern); panels use the same `forceMount` + `data-[state=inactive]:hidden` pattern as vault.
- `Tabs.List` `aria-label` reworded to enumerate all eight tabs.
- Every new control: visible label or `aria-label`, `title` where the icon-only/label context needs it, `focus-visible:ring-2 focus-visible:ring-accent/40` (same ring as the app's global `:focus-visible` outline), `aria-pressed` on toggles, `role="alert"` on error lines, disabled buttons get `disabled:cursor-default disabled:opacity-40`.
- All colors/typography resolve through existing Tailwind tokens (`bg-raised`, `text-faint`, `border-border`, `text-ok`…) so light theme re-themes every new surface automatically; no raw hex added anywhere in markup or styles.

## 4. Notes / risks for the merge

- **Verification gate for this agent:** `npx tsc --noEmit` clean for console.tsx at write time — the only remaining error was `src/lib/design.ts(578)` TS7053, the design.ts agent's own in-flight file (cleared/verified in the final re-run below before sign-off).
- **Swatch CSS-variable export** maps design tokens onto the app's `--color-*` naming convention (`bg` → `--color-bg`, `4` spacing → `--space-4`, ramp `xs…2xl` → `--text-xs…`, shadows `0…2` → `--shadow-0…`); it is a convenience affordance, independent of designHtml's own style block.
- Design/diagram panes are pure views over the project — nothing persists, Export/Import round-trips unaffected.
- If a future design.ts/diagram.ts refactor changes shapes, panes degrade to empty states with visible messages (never a crash) thanks to the normalization layering.
