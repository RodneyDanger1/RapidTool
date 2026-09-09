# 05 — Flash fix agent: app-shell polish + ai.ts / multiplayer honesty

Owner scope honored: only routes, error-component, styles.css, ai.ts, preview
bridge/origin, multiplayer p2p, router. `console.tsx`, `store.ts`, `engine.ts`,
`server/`, `package.json`, generated files untouched.

## 1. `src/lib/ai.ts` — orphaned fake-promise LLM module made honest + config-gated

- **Before (whole file)**: a TanStack `createServerFn` `enrichBrief` with
  hardcoded `api.x.ai` + model `grok-4.5`, reading `process.env.XAI_API_KEY`,
  that **zero files imported** (review/01 A25/A26, review/02 §4 row 4). It
  implied a live LLM path ("edge"/"failover" result semantics) that the app
  never exercised — dead code that read like a feature.
- **After**: framework-neutral provider module (no imports). Exports
  `complete(prompt, opts?) -> Promise<AiCompleteResult>` — a typed
  `{ok:true,text}` | `{ok:false, reason: "not-configured"|"network"|"http"|"invalid-response", ...}`
  — plus `isAiConfigured()`, `aiWiringState()` and defaults
  `AI_DEFAULT_BASE_URL` / `AI_DEFAULT_MODEL`.
  - Config-gated via `import.meta.env` (`VITE_AI_BASE_URL`/`VITE_AI_API_KEY`/
    `VITE_AI_MODEL`); missing key ⇒ `{ok:false, reason:"not-configured"}`
    **always** — never invents output, never returns a stand-in string as if
    it were model text.
  - Configured ⇒ real OpenAI-compatible `/chat/completions` POST with 20 s
    abort, typed HTTP/network/parse failures.
  - Module JSDoc states STATUS: NOT WIRED, the local-only key caveat (Vite
    inlines `VITE_*` into the public bundle) and the production path (server
    fn reading `process.env`). Old `enrichBrief` deleted — orphaned dead code.
- Rationale: kill the "there is an LLM call" illusion; leave a real, testable
  contract for future wiring (P0 intake enrichment per review/02 §5).
- Verification: typecheck + build green; module has zero imports by design.

## 2. `src/lib/error-component.tsx` — accessible error + new not-found component

- **Before**: `AppErrorComponent` (L4-21) rendered raw `error.message` (full
  stacks possible), no recovery action, no `role`.
- **After**: `AppErrorComponent` gets `role="alert"`, message guarded
  (`messageOf` handles non-Error throws; truncated at 500 chars), Reload
  button + "Back to home" link, theme-consistent dark palette. New export
  `AppNotFoundComponent` ("Page not found" + home link) for unmatched URLs.
- Verification: SSR curl of `/definitely-not-a-route` → HTTP 404, one
  `Page not found`, one `Back to home`, shell intact.

## 3. Not-found coverage + document titles (`__root.tsx`, `router.tsx`, `index.tsx`, `run.$id.tsx`)

- **Before**: unmatched URL rendered nothing usable — no `notFoundComponent`
  anywhere; every page shared the root `<title>RapidTool</title>`; the run
  console was indistinguishable from home in the tab/history title.
- **After**:
  - `__root.tsx:9-12` — `notFoundComponent: AppNotFoundComponent` (renders
    inside the html/body/AuthProvider shell).
  - `router.tsx` — `defaultNotFoundComponent` backstop for programmatic
    `route.notFound()` throws; keeps existing `defaultErrorComponent`.
  - `routes/index.tsx` + `routes/run.$id.tsx` — route-level `head()` titles
    ("RapidTool — autonomous software agency" / "RapidTool — Delivery run").
- Verification (live SSR): `/` → single `<title>` home title; `/run/abc` →
  single "Delivery run" title (no duplicates — route meta merges over root);
  unknown path → single root title + 404 + not-found UI.

## 4. `src/lib/preview-embedder-origin.ts` — origin trust tightened

- **Before** (L1-12): `isGrokEmbedderOrigin` accepted **any** `http://` or
  `https://` origin on `grok.com`/`.grok.com` — a plaintext (MITM-able)
  parent could drive in-app navigation.
- **After** (L13-27 + header doc): `*.grok.com` requires HTTPS; loopback
  (`localhost`/`127.0.0.1`/`[::1]`) keeps http/https for local dev harnesses;
  unrelated hosts still rejected. `resolveParentEmbedderOrigin` unchanged in
  shape — an `http://grok.com` referrer now falls through to the https
  `ancestorOrigins` candidate instead of being trusted.
- Verification: 13/13 new tests pass (below).

## 5. `src/lib/preview-host-bridge.ts` — navigable-paths + node-testable imports

- **Before**: `collectRoutePathsFromTree` announced **route shapes**
  (`/run/$id`) to the host as if navigable — autosuggest would navigate to the
  literal string `/run/$id`. Imports from `./preview-embedder-origin` were
  extensionless (not node-testable).
- **After**: paths containing `$`, `:` or `*` (param/wildcard shapes) are
  excluded (L267-270 + comment); internal import + re-export now use explicit
  `.ts` extensions (L9, L11-15), enabling direct `node` test runs.
- Verification: new test file (see §7).

## 6. `src/lib/multiplayer/p2p.ts` — honesty of claims (no `client.ts` exists)

- `src/lib/multiplayer/client.ts` **does not exist** in this repo — the
  client facade is `index.ts` (not in this agent's ownership; untouched).
- **Before**: header claimed signaling "through /api/rtc (see
  signaling.server.ts)" — that file does not exist anywhere, and no relay
  exists at `/api/rtc` (repo `server/` ships only middleware). A reader would
  believe the module was wired.
- **After**: header (L1-13) states HONESTY / WIRING STATUS — module is
  DORMANT, imported by nothing (review/02 §4 row 6), `/api/rtc` 404s until a
  relay is added, no UI in this app claims live multiplayer. Wire-contract
  comment (L17-21) no longer points at a nonexistent file; ICE comment
  corrected to "two independent STUN endpoints" (L95).
- No behavioral change — class logic is genuine WebRTC and left intact.

## 7. New: `src/lib/preview-host-bridge.test.ts`

Tests `isSafeBridgePath`, `collectRoutePathsFromTree` (param-shape filter,
root normalization, garbage tolerance), `isGrokEmbedderOrigin` (https-only
grok, loopback allow, junk reject), `resolveParentEmbedderOrigin` (top-level
noop, referrer resolution, plaintext→ancestor fallthrough, reject-all).
Run: `node --experimental-strip-types --test src/lib/preview-host-bridge.test.ts`
→ **13 pass, 0 fail**. Not yet in package.json's static `npm test` list (that
file is out of scope); run directly until the list is updated.

## 8. `src/styles.css` — additive shell polish

- `html` gains `color-scheme: dark` + themed `scrollbar-color` (no light
  flash on native controls/scrollbars in the dark-only app).
- Base layer adds a theme-consistent `:focus-visible` outline for
  `a, button, input, textarea, select, summary, [tabindex]` and an
  accent-tinted `::selection`. Both additive; reduced-motion block untouched.

## Verification

- `npm run typecheck` → **0 errors** (a transient `sandbox.test.ts` error from
  a concurrently-running Pro agent's A14 edit cleared before final pass; not
  mine to fix, re-ran at end).
- `npm run build` → exit 0 (vite build + db:migrate no-op OK).
- Bridge/origin tests → 13 pass.
- Live SSR probe (dev server on :8080): per-route single `<title>`, 404 +
  in-shell not-found on unmatched path.

## Left for others / notes

- A08 (deep-link `/run/:id` flash before zustand hydration) lives in
  `console.tsx`/`store.ts` — outside ownership; needs the `hydrated` gate in
  `RunScreen`/store.
- A real signaling relay (`/api/rtc`) would be server-side work (`server/`,
  migrations) — out of scope; p2p.ts now documents that gap honestly.
- ai.ts stays import-less on purpose; first consumer should be P0 intake
  enrichment via a server fn (key custody), per review/02 §5 rank 3.
