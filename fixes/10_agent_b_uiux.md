# 10 — Pro build agent B: UI/UX (console polish)

**Agent:** Pro build agent #2 (UI/UX)
**Date:** 2026-09-05
**Scope:** `src/components/console.tsx`, `src/styles.css`, `src/routes/__root.tsx` (theme bootstrap only).
**Guardrail:** `store.ts` / `engine.ts` / `types.ts` untouched — only the existing store API was consumed.

---

## What was added

1. **Artifact full-text search** — the existing `query` filter box above the artifact
   list already matched `title + kind + body` case-insensitively and composed with
   `phaseFilter` + tab state. Relabeled it as search (`aria-label="Search artifacts"`,
   placeholder `Search artifacts (title + body)`) and wired it to the new `/` shortcut via
   a `searchRef`. No behavior regression — filtering logic unchanged.

2. **Dark mode (light/dark toggle)** — persisted in `localStorage` under `rapid.theme`.
   - `styles.css`: added a `html[data-theme="light"]` override for every `--color-*` token
     (`--color-bg/--fg/--surface/--raised/--border/--line/--muted/--faint/--accent/--ok/--warn/--danger`),
     plus `color-scheme: light`. Dark values stay the default (no attribute) so the existing
     dark-only appearance is **unchanged** for current users.
   - `__root.tsx`: inline pre-hydration script sets `data-theme` from localStorage to avoid a
     flash of the wrong theme (covered by the existing `suppressHydrationWarning` on `<html>`).
   - `console.tsx`: `ThemeToggle` button in the run header (Sun/Moon icon, `aria-pressed`).
   - Verified in the built CSS that utilities compile to `var(--color-*)` (e.g.
     `.bg-bg{background-color:var(--color-bg)}`), so overriding the custom properties
     re-themes every surface without markup changes.

3. **Keyboard shortcuts** — extended the existing `keydown` handler (ignored while typing in
   `INPUT`/`TEXTAREA`/`SELECT`/`contentEditable`, and when a modifier or key-repeat is held):
   - `e` Execute, `g` Run to next gate, `a` Approve (when a HITL is pending),
     `r` focus rejection note, `/` focus artifact search, `?` open Guide.
   - Existing `Ctrl+Enter` / `Ctrl+Shift+Enter` / `Ctrl+Shift+C` / `Ctrl+G` chords preserved.
   - Added a persistent compact hint line (kbd chips) plus a `ShortcutsDialog` (opened from a
     new "Shortcuts" header button) listing all chords.

4. **Phase progress rail** — `PhaseProgressRail`: a compact horizontal 13-segment rail (P0–P12)
   derived from `project.phases`, showing done (`--ok`), current (`--accent`, pulsing),
   rejected (`--danger`), awaiting HITL (`--warn`), and upcoming (`--faint`). Each segment
   carries a `title`/`aria-label` tooltip. Rendered between the phase header and the algorithm
   traces. Note: `find(r => r.id === p.id)` is used instead of array indexing to stay robust
   to sparse/partial phase arrays.

5. **Artifact viewer copy** — `ArtifactPane` now renders a header (phase · kind · title) plus a
   per-artifact "Copy" button (with Copied / Copy failed states) that writes the active
   artifact's body via `navigator.clipboard`. Bodies remain monospace `pre-wrap`. Benefits both
   the live artifacts tab and the read-only phase record view.

6. **A11y polish** — `aria-label`s on the theme toggle, shortcuts button, search input, copy
   button, and progress-rail segments; `aria-pressed` on the toggle; explicit
   `focus-visible:ring` classes on new interactive controls (the global base focus rule remains).

---

## Verification

- `npm run typecheck` — **pass** (exit 0).
- `npm run build` — **pass** (exit 0). Built CSS confirmed to contain the
  `html[data-theme=light]{--color-bg:#f6f7f4…}` override and `color-scheme:light`.

## Notes / caveats

- No store/engine/types changes; no existing exports or behavior modified.
- The `a` shortcut calls `onApprove()` (force=false); for a human-only gate (failed P6
  sandbox) the store's existing guard returns an error surfaced inline, so no unsafe approval
  can slip through a keystroke.
- Theme toggle lives on the run (console) screen; the theme itself is global via the
  `data-theme` attribute on `<html>`, so the intake screen inherits it too.
