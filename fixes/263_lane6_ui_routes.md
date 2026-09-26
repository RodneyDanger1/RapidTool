# 263 · Lane U2 — UI: routes / styles / other components (wire + organize + fix UI errors)

**Wave:** W24 spring-clean (U2). **HEAD:** b721f9c. **Box:** `src/routes/**`, `src/styles.css`,
`src/components/**` EXCEPT `console.tsx` (U1).
**Evidence rule:** `npx eslint <files>` exit 0; every change listed before→after; every
style removal carries repo-wide grep evidence.

## Surface in scope (inventory)

| File | Lines | Notes |
|---|---|---|
| `src/routes/__root.tsx` | 83 | shell: head/theme boot/telemetry/AuthProvider/Outlet |
| `src/routes/index.tsx` | 13 | `/` → `HomeScreen` |
| `src/routes/run.$id.tsx` | 17 | `/run/$id` → `RunScreen key={id}` |
| `src/components/cmd-palette.tsx` | 144 | cmdk palette (controlled) |
| `src/components/preview-host-bridge.tsx` | 26 | mount-once host bridge |
| `src/components/runtime-timeline-pane.tsx` | 213 | typed timeline sibling |
| `src/styles.css` | 731 | tailwind v4 entry + component chrome |

## Findings log

_(every item: file:line, before → after, or "not a bug, because …")_

### F1 · FIXED — every point event was labelled “no matching start” (`runtime-timeline-pane.tsx:76`)

**Before** `pairLabel()`: `if (row.status === "raw") return null;` then fell through to
`return row.closes === null ? "no matching start" : …`. But `rt-timeline.ts:231` pairs only
non-`instant` rows (`else if (status !== "instant")`), so an `instant` row keeps `closes ===
null` **by contract** — every ordinary point event (`packet.written`, `session.ready`, …) was
rendered with the terminal's honest note “no matching start”, as if the event were a broken
span end. The pane's own header reserves that string for a *terminal* with no start.
**After:** `if (row.status === "raw" || row.status === "instant") return null;` → point events
show no pair provenance; a real terminal without a start still says “no matching start”.
**Evidence:** `/c/Users/mnril/u2_scratch/check_rt_timeline.mjs` (outside the worktree) runs the
**real** `parseTimeline` and asserts both sides: row 3 `packet.written` → `closes: null`,
`old: "no matching start"` vs `fixed: null`; row 4 `chat.error` (failed, no start) still
`"no matching start"`; paired start still `"paired with L2 · 100ms"` → **ALL CHECKS PASS**.

### F2 · FIXED — `theme-color` used stale hexes that matched no CSS token (`__root.tsx:43`, `:75`)

The comment claimed the meta mirrors `--color-bg`, but both values were from an older palette:
| where | before | after | styles.css token |
|---|---|---|---|
| head meta (`:43`) | `#0b0c0e` | `#0a0c0b` | `--color-bg` (styles.css:13) |
| pre-hydration light override (`:75`) | `#f6f7f4` | `#edf3f0` | light `--color-bg` (styles.css:147, verbatim `design.ts:178`) |
**Evidence:** `grep -rn "0b0c0e\|f6f7f4" src scripts` → only `__root.tsx` (plus an illustrative
comment at `console.tsx:4709`); neither hex exists in `styles.css`/`design.ts`. Effect of the
stale pair: browser/PWA chrome tint disagreed with the painted background in **both** themes.

### F3 · ORGANIZED — `__root.tsx:4-9` import style made consistent

**Before:** `@/lib/error-component.tsx`, `@/lib/rt-client.ts` (explicit ext) next to
`@/lib/auth/provider` (no ext), and `@/components/preview-host-bridge` — the **only**
cross-component import in the repo without an extension.
**After:** lib imports all extension-less (dominant style: 33 ext-less vs 6 with-ext across
`src/`), component import gets `.tsx` (the in-repo convention is documented at
`console.tsx:77-79` and used by 4/5 sites, incl. both route files).
**Evidence:** scoped `tsc` (F-evidence 2) exit 0 — the new specifiers resolve under the repo's
exact `moduleResolution: bundler` options.

### F4 · ORGANIZED — same import normalization in `runtime-timeline-pane.tsx:31-33`

`@/lib/rt-client.ts` / `@/lib/rt-timeline.ts` → `@/lib/rt-client` / `@/lib/rt-timeline`
(console.tsx:75 already imports `@/lib/rt-client` extension-less, so the pane now matches the
module it speaks to). No other edits to the pane's behaviour except F1/F5.

### F5 · FIXED — `aria-controls` dangled on a conditional render (`runtime-timeline-pane.tsx`)

**Before:** `{open ? <div id="rt-timeline-body">…</div> : null}` — while collapsed the id did
not exist, so the toggle's `aria-controls="rt-timeline-body"` referenced nothing.
**After:** the body is always mounted with `hidden={!open}` (APG disclosure pattern) → the
reference always resolves; expanded DOM/visuals are unchanged, collapsed adds only a hidden
subtree. No test touched this DOM (`grep` of `*.test.ts|mjs` for `rt-timeline-body` → 0 hits).

### F6 · FIXED — stale doc comment (`preview-host-bridge.tsx:1-4`)

“(and later receive registered routes)” → “and receive the registered route list” — the code
has passed `getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)` since W4.

### F7 · ORGANIZED — merged the split `.term-body` blocks (`styles.css:599-611`)

Two `.term-body` blocks (background / counter-reset) separated by `.term-body code` merged into
one. `background` and `counter-reset` never interact and the selector is identical → no-op in
the cascade; declared declarations byte-identical. (No removal — see audit.)

### Cross-lane finding (NOT U2's box — for U1, `console.tsx`)

`console.tsx` `applyTheme()` (~:1328-1341) sets/removes `data-theme` but never updates the
`theme-color` meta — the only writer is `__root.tsx`'s pre-hydration script. After F2 the
mismatch is symmetric and still real: toggling light→dark in-session leaves the meta at the
light token (`#edf3f0`) until reload, so the chrome tint contradicts the page again. Cheap
honest fix lives in console.tsx (re-point is that file's owner): have `applyTheme` also set the
meta content to `#edf3f0` / `#0a0c0b` per theme (or read the live `--color-bg`).

## Dead-style audit — what was checked, and the verdict

Method: every class selector in `styles.css` extracted with
`grep -oE '\.[a-zA-Z][a-zA-Z0-9_-]*' src/styles.css | sort -u`, then each name counted
**repo-wide** (`grep -rn --include='*.tsx' --include='*.ts' --include='*.mjs' --include='*.html'
<name> src scripts public | grep -v src/styles.css`).

- **44/44 class selectors have ≥1 real reference outside styles.css. No removals.**
- `wild-row--wild|ok|warn|danger` grep **0** but are **not dead**: built dynamically as
  `wild-row--${r.tone}` (`console.tsx:1237`); `WildTone = "ok"|"warn"|"danger"|"faint"|"wild"`
  (`console.tsx:655`), so all four rules are reachable. A hypothetical `wild-row--faint` has no
  rule **on purpose** — it falls back to the default `.wild-row::before` dot (`--color-faint`).
- All `@keyframes` live (`wild-live-pulse` ×2 consumers, `chat-think-in`, `wild-row-in`,
  `rail-glow`); `--radius-*` live via `rounded-*` utilities; `.term-body > div:has(pre)` matches
  the real DOM (MarkdownBody renders top-level `<div>`+`<pre>` code blocks, `console.tsx:3944-3957`).
- **Provably-unreferenced tokens (exactly 1 occurrence = own definition): `--color-accent-soft`,
  `--color-warn-soft`, `--color-wild-soft`** (styles.css:22/28/34). **Deliberately NOT removed**:
  (a) the `@theme` block is the documented palette mirror and its used siblings
  (`ok-soft`, `danger-soft`) are the same family; (b) U1 is editing `console.tsx` concurrently —
  a `bg-*-soft` utility introduced after my removal would silently no-op; (c) zero runtime
  benefit. **Recommend removal at wave end** (after U1 lands) with this same grep.
- `.vault-link-dead` (`console.tsx:4041`) has no rule **by design** — the element is `disabled`
  and `.vault-link:disabled` (`styles.css:189`) carries the dangling look; already documented in
  `research/multiagent/30_ui_wiring_bugs.md:112`. Not a bug, not touched (console.tsx anyway).

## Deliberately NOT touched (with reasons)

- `console.tsx` (U1's box), `src/lib/**`, `src/router.tsx` (outside the U2 box).
- `/__grok/manifest.webmanifest` + `/__grok/icon-180.png` head links: **not** 404s — served by
  the platform PWA plugin (`scripts/grok-pwa-plugin.mjs:55`, `server/middleware/grok-pwa.ts:73`);
  `fixes/33_agent_uitrace.md:66` explicitly says do not “fix”.
- The pre-hydration script's `else if (t === "dark")` branch: harmless/defensive (already noted
  in `fixes/33`); the attribute-less default *is* dark in `styles.css`, so setting
  `data-theme="dark"` changes nothing.
- `clockLabel()`'s UTC slice in the pane: deliberate locale-independence (documented in the
  component); adding a “Z” is cosmetic and would churn the row layout — left alone.
- `cmd-palette.tsx`: read line-by-line against cmdk 1.1.1's d.ts (`loop`,
  `overlayClassName`/`contentClassName`, `keywords`, `label` all real props; filter input =
  `value` + keywords; `onSelect` closes then dispatches the SAME handler). No defect found →
  no edit (the file stays byte-identical; it is lint-clean).

## Evidence (commands + results)

1. `npx eslint src/routes/__root.tsx src/routes/index.tsx 'src/routes/run.$id.tsx' src/components/cmd-palette.tsx src/components/preview-host-bridge.tsx src/components/runtime-timeline-pane.tsx` → **ESLINT EXIT: 0** (after all edits).
2. Scoped `tsc` (allowed: scratch tsconfig `tsconfig.u2.scratch.json`, `extends: ./tsconfig.json`,
   `include: src/routeTree.gen.ts + src/routes + my 3 components`) → **0 errors, exit 0**; scratch
   config deleted immediately after the run (worktree left clean). The route-only variant
   without `routeTree.gen.ts` produced 2 TS2345 artifacts in `index.tsx`/`run.$id.tsx` — an
   artifact of the scratch `include`, not of the code (reproduced on the untouched files too).
3. `cd /c/Users/mnril/u2_scratch && node --experimental-strip-types check_rt_timeline.mjs` →
   6/6 assertions PASS, exit 0 (F1 evidence; harness stored OUTSIDE the repo).
4. Style removals: **none** — so no removal evidence is owed; the audit table above is the
   grep evidence for every class kept.

