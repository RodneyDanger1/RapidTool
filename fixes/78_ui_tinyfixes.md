# 78 — Flash UI-sweeper W2: syntax/tiny-error pass (styles/router/routes/error-component)

**Role**: Flash UI-sweeper W2 — SYNTAX/TINY-ERROR PASS over the UI shell lane.
Swept `src/styles.css`, `src/routes/*.tsx` (`__root`, `index`, `run.$id`),
`src/lib/error-component.tsx` (the brief's `src/components/error-component.tsx`
does NOT exist — the component lives in `src/lib/`, imported as
`@/lib/error-component.tsx` by `router.tsx` + `__root.tsx`), and `src/router.tsx`.
Waited for deleg_946c0157 (Pro fixers, chat/research + backend/CLI/UI lanes) to
reach all-complete in their manifest before any edit/gate; they landed as
verify-only (register research docs updated, no src/ changes after 11:24, no
fixes/76–77) — no merge conflicts with this lane. Patch-only edits; no new
files except this doc.

## Baseline (2026-09-06, after Pro lanes completed, before this pass's edits)

- `npm run typecheck` → 0
- `npm run lint` → 0
- lib suite (`node --experimental-strip-types --test src/lib/*.test.ts
  src/lib/app-data/app-data.test.ts src/lib/auth/*.test.ts`) → 963 tests,
  962 pass / 1 skipped / 0 fail
- `npm run build` → 0

## Applied fixes

| # | Finding | File:line | Patch | Status |
|---|---------|-----------|-------|--------|
| F-1 | `theme-color` head meta hard-coded to dark `--color-bg` (#0b0c0e) never follows the light theme → browser/PWA chrome (mobile URL bar, task switcher) stays near-black over a #f6f7f4 surface. The pre-paint theme script already knows the persisted theme, so it now also moves `meta[name=theme-color]` to the light `--color-bg` (#f6f7f4) when the stored theme is light. Same data-theme behavior as before (light or dark both set the attribute); script-only, pre-hydration, zero SSR/hydration impact. | `src/routes/__root.tsx` head inline script (lines ~42–56) | extended inline script + comment | applied |
| F-2 | Dead CSS selector: `#app` in the `html, body, #app` base rule — no `#app` element exists anywhere in src (root route renders `<html><body>` directly; no entry/index.html wrapper), so the selector matched nothing. Removed; `html, body` keep min-height/background/color. | `src/styles.css` @layer base (~line 41) | removed `#app` from selector | applied |

## Sweep results — mission items

1. **Syntax/tiny/theme/a11y errors in lane files**: no syntax errors; no
   unbalanced CSS; theme tokens complete — all 14 dark tokens have a light
   override under `html[data-theme="light"]`; no broken color-utility base
   anywhere in src (scripted scan of every `text-*/bg-*/border-*/…` class in
   all tsx/ts vs @theme tokens + Tailwind default palette: zero unknown bases;
   `neutral-*` in `lib/auth/gates.tsx` is dormant auth plumbing, renders fine).
2. **CSS-class existence**: every className in `routes/*.tsx`,
   `error-component.tsx` and the `__root` shell is a Tailwind utility
   generated from the @theme tokens (`bg-bg`, `text-fg`, `text-muted`,
   `text-danger`, `border-accent/40`, …) — all resolve; the five hand-written
   classes in styles.css (`.vault-link`, `.chat-scroll`, `.scroll-thin`,
   `.wrap-any`, `.wild-live-dot`) are each referenced by console.tsx (usage
   grep: 2/1/13/4/4) — none dead, none duplicated.
3. **Router guards + server-boundary duck typing**: no route guards exist by
   design (auth dormant passthrough, wave-34 verified — nothing to guard).
   `router.tsx` wires `defaultErrorComponent: AppErrorComponent` +
   `defaultNotFoundComponent: AppNotFoundComponent`; `__root.tsx` adds the
   in-shell `notFoundComponent`. `error-component.tsx` `messageOf()` still
   duck-types Error / string / plain-object `{message}` throws (serialized
   server-boundary shapes) with the code-point-aware `clipMessage()` cap —
   wave-33-hardened contract intact, no patch needed. No route loaders exist,
   so no loader-error path is unguarded; render errors land in the default
   error component (root included). routeTree.gen.ts matches the three route
   files; no unreachable route states (both routes have components; missing
   `/run/$id` ids hit console.tsx's in-screen fallback — registered A08,
   console-owned, not re-fixed here).

## Assessed, deliberately NOT patched (with reasons)

- **`<main role="alert">` wraps interactive controls** (Reload / Back to home)
  in `AppErrorComponent`. ARIA APG prefers alert for non-interactive content,
  but removing the role would kill the client-side route-error announcement
  the boundary currently provides (no other focus/live handling exists on
  route swap) — net a11y regression risk on a wave-33-verified file. Left as
  is; a proper fix belongs to a dedicated a11y pass with screen-reader
  verification (candidate: `role="alert"` on the message `<p>` + focus
  management on the heading).
- **Error/not-found pages do not move keyboard focus** on client-side route
  swap (WCAG 2.4.3/3.2.1 nicety). Fix (tabIndex={-1} + focus effect on the
  h1s) is a behavior change that needs SR testing; registered, not patched.
- **Token contrast** (computed, both themes): active-text pairs in this lane
  are ≥4.98:1 (worst: light `text-danger` icon 4.98:1 vs 3:1 graphic bar);
  `text-muted` ≥5.58:1; focus outline ≥5.5:1; hover labels stay ≥9.9:1 after
  the opacity-90 blend. `--color-faint` (2.68–2.87:1) is used only for
  disabled/dangling `.vault-link:disabled` — WCAG-exempt (inactive). The
  1.3–1.4:1 `border-border` ghost-button outline is decorative: the control is
  identified by its 15:1 label text. No real defect.

## Notes for file owners (out of this lane — not patched)

- **console.tsx owner**: `applyTheme()` toggles `data-theme` live but does not
  move `meta[name=theme-color]`, so switching to light mid-session leaves
  browser chrome dark until the next load (F-1 fixes only the load path).
  One-line follow-up: mirror F-1's meta update in `applyTheme`.
- **lib/auth/gates.tsx owner**: `text-neutral-*` classes bypass the app theme
  tokens (auth is dormant, so invisible today; if auth ever activates, gate
  screens won't follow the light theme).

## End state (after F-1/F-2, re-run same commands)

- `npm run typecheck` → 0 · `npm run lint` → 0
- lib suite → 963 tests, 962 pass / 1 skipped / 0 fail
- `npm run build` → 0
