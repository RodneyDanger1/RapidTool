# 33 — UI-ENTRY TRACE + FIX (flash agent #7, UI-entry owner)

- **Date / agent:** 2026-09-06 · Flash UI-entry agent (route→handler→store→backend trace).
- **Scope owned (per brief):** `src/routes/*.tsx`, `src/router.tsx`, `src/components/error-component.tsx`, `src/entry-client.tsx`, `src/entry-server.tsx`, `src/client.tsx` — **reality check:** the error component lives at `src/lib/error-component.tsx` (imported as `@/lib/error-component.tsx` by `router.tsx` + `__root.tsx`); **no custom entry files exist** — TanStack Start v1.168 generates default entries from `src/router.tsx` (`getRouter`) + `src/routes/`, so there is nothing to patch in entry files (verified: `grep -rn "StartServer|StartClient" src/` → no hits; `vite.config.ts` uses stock `tanstackStart()`).
- **Read-only traced into:** `console.tsx`, `store.ts`, `engine.ts`, `phases.ts`, `dod.ts`, `packet.ts`, `algorithms.ts`, `sandbox.ts`, `io.ts`, `report-intake.ts`, `handoff.ts`, `llm.ts`, `research.ts`, `exec.ts`, `crew.ts`, `vault.ts`, `design.ts`, `diagram.ts`, `llm-tasks.ts`, `preview-host-bridge.ts`, auth libs, `routeTree.gen.ts`, `vite.config.ts`.
- **Concurrency note:** `console.tsx` grew 2717→3371 lines mid-trace (a sibling actively editing) — line refs for console below are approximate/quote-anchored, and the file will keep moving.

---

## 1. Route tree (source of truth: `routeTree.gen.ts`)

```
__root__  (src/routes/__root.tsx)            — html/head/body shell, AuthProvider (passthrough),
                                              PreviewHostBridge, theme no-flash script, HeadContent/Scripts,
                                              notFoundComponent: AppNotFoundComponent
├── "/"        (src/routes/index.tsx)        — HomeScreen (intake + builds list)          [head title: "RapidTool — autonomous software agency"]
└── "/run/$id" (src/routes/run.$id.tsx)      — RunScreen key={id} (13-phase run console)  [head title: "RapidTool — Delivery run"]
Unmatched URL → root notFoundComponent (in-shell 404) — verified live (SSR curl + browser).
Router (src/router.tsx): defaultErrorComponent = AppErrorComponent, defaultNotFoundComponent = AppNotFoundComponent (backstop for programmatic notFound()).
No route loaders/actions, no pending states, no lazy chunks: all store reads are client-side zustand (localStorage-persisted).
Auth: VITE_AUTH_ENABLED=false (.grok/app-env.json) — passthrough AuthProvider is correct; no route guards needed or bypassable.
```

## 2. Route → handler → store → backend map

| UI surface (console.tsx) | Store action (store.ts) | Engine / lib call | Real backend side effect |
|---|---|---|---|
| Home: brief + "Open intake" (`launch`) | `create(brief)` → `emptyProject` | engine `emptyProject` | pure; persists localStorage |
| Home: project row click / Run header logo | `select(id)`; `nav /run/$id` | — | pure |
| Run: "Execute Pn" (`run`) | `executeAsync(id)` → serialized → `advanceOnceAsync` | `engine.runPhaseAsync` (dynamic import; catches → `applyPhaseResult`); `synthesizeAsync` fallback | `liveLayer` → `fetchResearch` (P0/7/11) → `research()` → websearch.server.ts DDG/Tavily; LLM narrative via `complete()` → llm.ts → deepseek.server.ts; deterministic when unconfigured (never fabricates) |
| Run: "Run to next gate" (`runUntil`) | `runUntilHitlAsync(id)` (loop, cap `(13-phase)*2+2`) | same as above per phase + `recordGate` → `dod.runGate`; `canAutopilot` → `approveHitl(decidedBy:"autopilot")` | same LLM/research chain; gates advisory |
| HITL approve (incl. keyboard `a`, force override) | `approve(id,{force,requestedAt})` → `approveHitl(decidedBy:"human")` + `recordGate` + `stampPacket` | engine `approveHitl`, `recordGateInline`/`runGate`, `stampPacket` (A1..A8+A4 trace) | pure |
| HITL reject (`r` focuses note; "Reject") | `rejectAsync(id,note)` → sync `reject(id,note)` guards → `rejectHitl` | `rejectHitl`; then `interpretFeedback()` → llm-tasks → `complete()` → llm.ts (config-gated, best-effort) | LLM guidance artifact when configured |
| Blocked: "Retry phase with notes" | `retry(id)` → `unlockRetry` | engine | pure |
| "Run module (bounded)" | `runModuleReal(id)` → `engine.runP6Real` | sandbox `buildPhase6Module/healSource/runGenerated` + `exec.runCode` → node-runner.server.ts (bounded, NOT a sandbox) | real subprocess exec |
| "Spawn crew" (advisory) | `runCrew(current)` (console direct import, not store) | crew.ts → crew.server.ts → deepseek (flash-only role tiers) | live LLM crew; artifacts re-enter via `ingestReport` |
| "Ingest report" | `ingestReport(id, raw)` → `validateReport` + `applyReport` | report-intake.ts (+ tests_run raw-payload evidence warn) | pure |
| Copy packet / copy handoff / download .md / export JSON / copy JSON | `refreshPacket(id)`; `phaseHandoff`; `exportPacketText`/`exportProjectJson`; `downloadFilename` | engine `stampPacket`; handoff.ts; io.ts | pure (clipboard/blob) |
| Clone | `clone(id)` → structuredClone + fresh uuid | — | pure |
| Rename / undo rename | `rename(id,name)` | — | pure; ST-6 rebaseUserFields protects in-flight runs |
| Archive | `remove(id)` → `nav("/")` | — | pure |
| Import (.json) | `importProject(json)` (same-id confirm → replace) → `nav /run/$id` | io.ts `importProject` parse | pure |
| Notes / autopilot / theme toggle | `setNotes`, `setAutopilot`; localStorage `rapid.theme` | — | pure |
| Status chips (LLM / research) | `refreshStatuses()` on RunScreen mount → dynamic `llm.llmStatus()` / `research.researchStatus()` | llm.ts / research.ts status probes | read-only probes |
| Artifacts / packet / spec / oracle / vault / design / diagram tabs | read-only views over project; vault: `buildVaultNotes/searchVault/vaultMarkdown`; design: `designHtml/designTokens`; diagram: `buildDiagram` | pure libs (defensive normalization in panes) | — |
| Phase rail, phase record view, evidence bundle | view-only (`project.phases[...]`) | `evidenceForGate` (E-102) | — |
| Deep-link /run/<unknown-id> | RunScreen `!project` early return → "doesn't exist or was archived" + Link "/" | — | — |
| Store rehydration | `onRehydrateStorage` → `setHydrated(true)` + `seedIfEmpty` (demo exactly once, ST-3); corrupt JSON recovery path | `hydrateProject` repair | — |

Async store actions are per-id serialized (ST-6 `asyncChains`); commits rebase user fields and never resurrect deleted projects. `llmStatus.configured || researchStatus.configured` decides async engine vs deterministic path.

## 3. Bugs fixed (this wave, all in owned scope)

1. **`src/lib/error-component.tsx:5-20` — `messageOf` only handled `Error`/`string`; plain-object errors rendered the generic copy.**
   Serialized router/server-boundary errors and `throw { message: "…" }` patterns surfaced as `null` → "An unexpected error occurred" with the real cause hidden; conversely non-Error objects could never leak. Fixed by duck-typing `.message` on plain objects (string-typed only — never `[object Object]`), whitespace-only → `null` for all three branches.
2. **`src/lib/error-component.tsx:22-30 + 53-56` — 500-char truncation sliced UTF-16 units, splitting surrogate pairs** (a cut emoji rendered as a lone half). Replaced `message.length > MAX && slice` with code-point-aware `Array.from` + `clipMessage()`; same 500-cap + trimEnd + ellipsis semantics otherwise.
3. **`src/routes/run.$id.tsx`, `index.tsx`, `__root.tsx`, `router.tsx` — audited end-to-end, no patch needed:** verified live (below) that titles merge to a single `<title>` per route, unmatched URLs render the in-shell not-found, render errors land in `AppErrorComponent`, `/run/<id>` deep links with persisted data hydrate with **zero console errors** (no flash/mismatch observed), and missing-project ids render the fallback with a working home link. A08/SH-1 residual concerns are console.tsx-owned → register §4, not patched here (wave-05 already fixed SH-2 themes + SH-3 param-path bridge leak).

## 4. Register — problems found in sibling/out-of-scope files (NOT patched)

- **A08 (open, console.tsx RunScreen + store):** SSR of `/run/<valid-id>` always renders "This build doesn't exist or was archived" (server store never rehydrates; `seedIfEmpty` needs `hydrated`). Client swaps content post-hydration — empirically invisible (no mismatch errors, content correct in probe) but wrong semantics for no-JS/slow-JS and any render where the microtask race loses. Fix belongs in RunScreen (gate on store `hydrated` w/ the same 80ms unlock fallback HomeScreen uses) — console.tsx/store.ts owned.
- **SH-1 (open, console.tsx HomeScreen):** "No builds yet" + count render from pre-rehydration state on reload when builds exist — flashes until the 80ms seed timer/re-render (audit-bugs/02 §SH-1, Low).
- **`activeId` (store.ts:378-379, console.tsx:844):** written by create/select/import/clone but never read by any UI (URL is source of truth). Harmless; could be dropped from `partialize` to shrink persistence.
- **`console.tsx` mid-wave churn:** file grew ~650 lines during this trace (vault/design/diagram panes etc.); anything touching it (A08 gate, SH-1 gate) must land AFTER the console sibling's wave settles.
- **entry files absent:** brief lists `src/entry-client/server.tsx`, `src/client.tsx` — none exist; TanStack Start default entries are generated. No stale/mismatched entry code to fix. `routeTree.gen.ts` matches the 3 routes (not stale).
- **`/__grok/manifest.webmanifest` + icon-180:** served 200 by platform plugin (grokPwaPlugin), not static files in `public/__grok/` (only icon-180.png + install/) — fine; do not "fix".
- **Preview-host bridge run-page paths:** wave-05 already excludes param shapes (`/run/$id` no longer advertised) — SH-3 resolved; verified in current `preview-host-bridge.ts`.
- **llm/research status chips showed "configured"/"free search" in the preview browser** — llm.ts/research.ts status probes (lib-owned); behavior consistent with a keyed env present in dev; no honesty violation observed; left to lib owners.

## 5. Verification (this wave)

- `npm run typecheck` — 0 errors (final pass after patches; see below).
- `npm run build` — exit 0.
- Targeted suites: `node --experimental-strip-types --test src/lib/auth/*.test.ts src/lib/preview-host-bridge.test.ts` — pass (tail checked; full suite is the integration agent's gate).
- Live probes on dev :8080: SSR curl of `/` (single home `<title>`, one stylesheet link, "No builds yet" server state), `/run/zzz-nope` (in-shell missing-build fallback), `/__grok/manifest.webmanifest`/`icon-180.png`/`favicon.svg` → 200; browser full reload of `/run/<demo-id>` with persisted store → **0 js errors, 0 hydration errors**, full run console rendered; theme toggle key `rapid.theme` consistent with `__root` no-flash script (script's `"dark"` branch is dead-but-harmless — toggle stores only `"light"`).
