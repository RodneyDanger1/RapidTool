# 124 — Unwired-seams audit (A3): mechanical orphan/export census, dead store actions, unset pipeline flags, orphaned lesson writers + telemetry hooks, register claims

- **File:** fixes/124_unwired_seams.md (repo root `C:/Users/mnril/Desktop/RapidTool Main`, not git).
- **Role:** FLASH ANALYST A3 — unwired-seams audit. **READ-ONLY** (probes + greps only; no code edits).
- **Date:** 2026-09-07.

## Method / honesty contract
- Import-graph census over all of `src/` + `scripts/` + `server/` (85 definition modules under src/lib + src/components; 557 exported names), honoring `@/*` alias, extensionless `.ts/.tsx/.mjs`, and *literal* `import()` strings. Computed dynamic loads (`import(DRIVER_PATH)`), namespace-member access, and root-level files (vite.config.ts plugins) are NOT resolvable statically — where a module has real but computed-dynamic consumers this is stated, not scored as dead.
- A finding requires a code seam that LOOKS functional but isn't wired. Capabilities honestly labeled "declared / not implemented" (B-18 honesty stamps, P2P/connector staging) are NOT findings.

## A3-01 — `installRtClient()` never installed anywhere in production — telemetry host dead
- **Surface:** `src/lib/rt-client.ts:395` (exported installRtClient), header contract lines 18–22 ("EXPORT SURFACE… installRtClient").
- **Evidence:** census + per-file grep: `installRtClient` appears only in `rt-client.ts` and `rt-client.test.ts`; console.tsx imports { buildClientDiagnosis, reportRt, rtSnapshot, setBusyProbe } (console.tsx:64) but never installs; `src/routes/__root.tsx` imports only AuthProvider/error components/preview bridge; store.ts imports reportRt/releaseWildStart/tryStartWild only.
- **Verdict:** HALF-WIRED / dead host. The ring + crash-snapshot + heartbeat + main-thread-stall chain (fixes/109 §5) exists and is unit-tested but is never booted in the browser; Runtime-Log tab reads `rtSnapshot()` of an otherwise empty, event-less ring except the two `reportRt` call sites (store persist salvage store.ts:723, WildFeed poll ~console.tsx:760-771).
- **Missing wire:** call `installRtClient()` once in `__root.tsx` (client effect) or console module scope.
- **Priority:** P1 (telemetry ring is a live product claim in fixes/109/110 docs).

## A3-02 — `setEnforceDod` dead store action; hard-DoD unreachable from UI and CLI
- **Surface:** `src/lib/store.ts:112` (interface), impl `store.ts:817`; engine enforcement `engine.ts:2618, 2676`; store guards `store.ts:396, 448, 461, 579`; tests store.test.ts:877, 992.
- **Evidence:** store-action × UI census — `setEnforceDod` has **zero** references in console.tsx/routes (and no CLI verb sets `enforceDod`); enforcement code can only be reached by hand-editing the JSON file. `Project.enforceDod` starts false and never flips by any sanctioned path.
- **Verdict:** DEAD STORE ACTION (fully implemented + tested engine behavior, gated behind a flag nothing sets, hidden behind a UI that even renders gate-failure UI without an affordance to enable the behavior).
- **Missing wire:** a UI control (toggle in Project/Settings or the DoD gate card; note AGENTS.md: "advisory by default… an enforce-DoD setting exists") or a CLI flag (`--enforce-dod`).
- **Priority:** P1 (docs claim the setting exists).

## A3-03 — Lesson read-back loop un-wired: selectLessons / rankBriefLessons / lessonLinesForBrief reach no production expansion
- **Surface:** knowledge.ts selectLessons (export 560); prompt-engine.ts rankBriefLessons 345, lessonLinesForBrief 382, provenToLessonRow 320; expandBrief 208 (takes `lessons`).
- **Evidence:** factory call-site grep: `selectLessons` appears in prod only in prompt-engine.ts doc prose (line 200 comment), never as a call; `rankBriefLessons`/`lessonLinesForBrief` callers are prompt-engine.test.ts only; engine/codegen expansion paths call `expandBrief(brief)` / `expandBriefWithBackoff(brief, expandBrief)` (codegen.server.ts:513) with **no lessons**.
- **Verdict:** HALF-WIRED. The L1–L5 capture loop from fixes/117 now lands rows (engine lesson.capture 517/1153, headless 521/539/1130, report-intake 370), but memory is never read back into any expansion/re-prompt → "self-learning" is write-only today; drift/retire machinery (dismissLessonRows/replace/retire) accordingly never runs.
- **Missing wire:** `selectLessons(project.memory)` → `rankBriefLessons` → `lessonLinesForBrief` into keyed expansions (codegen P6 expand + liveLayer/crew), and a retirement trigger (LESSON_RETIRE_COUNTER).
- **Priority:** P2.

## A3-04 — Orphaned lesson writers (pure+tested, zero call sites)
- **Surface:** `src/lib/knowledge.ts` — correctionLesson 755, driftLesson 779, pressureAt 808, lessonLog 815, manualLesson 834, dismissLessonRows 842, proposeLessonFallback 853, buildSupersedeEntry 881, consolidatedRunNote 907, LESSON_RETIRE_COUNTER 493.
- **Evidence:** repo-wide grep outside knowledge.ts + knowledge.test.ts: no hits in engine/headless/store/report-intake/crew/server/CLI.
- **Verdict:** ORPHANED (export = sole occurrence) for every name; the triggers they were designed for (reject-with-correction, drift, deepen/propose, consolidation) were never added.
- **Missing wire:** either live callers (rejectAsync correction path; drift checks at run completion) or an honest strike from the API + tests.
- **Priority:** P2 (P3 strike is acceptable — pure+tested code is not a user-facing lie).

## A3-05 — `verify.ts` server-fn shim unreachable; UI verify affordance absent
- **Surface:** `src/lib/verify.ts` (createServerFn POST wrapper, exports verifyAndFix). Header: "Import THIS from UI/store code; never import verify.server.ts directly."
- **Evidence:** import census: verify.ts has zero importers anywhere; verify.server.ts is imported by headless.ts:1028 (`verifyGeneratedSource`, dynamic) and verify.test.ts; console has no verify tab/button (11 action-tab census), store has no verify action, routes have none.
- **Verdict:** ORPHANED + honestly broken header contract. The browser world's only sanctioned path to machine verify does not exist; verify works headless-only.
- **Missing wire:** attach a `verify` action + "Run verify" control to RunScreen wiring that shim, or rewrite the header to point at headless.verifyGeneratedSource.
- **Priority:** P2.

## A3-06 — `watcher.ts` dead module (header-declared opt-in, never opted in)
- **Surface:** `src/lib/watcher.ts` startWatcher/stopWatcher/watcherNotes/consts; importers: watcher.test.ts only (26_debug G-7 doc already records this).
- **Verdict:** ORPHANED (by design; header says explicit opt-in). Honestly labeled in docs — LOW. Options: wire to a CLI `watch` verb or strike module+doc references.
- **Priority:** P3.

## A3-07 — Wild-mode UI still routed through defensive name-lookup shim and "not wired" labels after the store contract landed
- **Surface:** `console.tsx:228-243` (contract-absence doc block), `328-354` (wildStoreAction name lookup + WILD_*_NAMES candidate arrays), `500-575` WildToggle incl. "wild-mode store action not wired — toggle is local only" (526/532) and "Wild-mode engine not wired in this build" (565-568) even though `setWildMode`/`startWildRun`/`stopWildRun`/`toggleWildPause` all exist on RapidState (store.ts 114-118, 828+) and are exercised (console 230/328/340/344).
- **Verdict:** DEAD-CODE STYLE risk, not a functional dead button (the shim resolves the real actions at runtime, so toggling works). A control that LOOKS functional: it works, but keeps lying labels reachable when contract detection misfires.
- **Missing wire:** collapse shim to direct static imports; delete "not wired" branches.
- **Priority:** P3 (P2 for UI honesty if a label ever shows while a run is live).

## A3-08 — Minor orphan exports (export = sole occurrence) — strike, wire, or mark intentional
- `src/lib/engine.ts: verifyPriorPhases` (engine has no caller of it); `src/lib/verify.server.ts: oracleSignatureFunctionNames`; `src/lib/headless.ts: buildVault / designModuleAvailable / diagramModuleAvailable / vaultFileFor / chatAsk / exportJson? (see A3-09)`; `src/lib/chat.ts: chatLogStorageKey, parseChatLog, serializeChatLog` (chat UI now in-console ChatLogView — console.tsx:4650); `src/lib/harvest.ts: HARVEST_BOUNDS_LABEL/HARVEST_QUERY_LABEL/HARVEST_SOURCE_LABEL` (labels all local-copied); `src/lib/vector.ts: ICON_VIEWBOX/LOGO_VIEWBOX`; `knowledge.ts: lessonLog` (A3-04).
- **Verdict:** ORPHANED (mechanical). Each: wire or strike; low risk either way.
- **Priority:** P3.

## A3-09 — headless.ts exports with no CLI `h.*` dispatch (backend-internal or orphaned helpers)
- **Evidence:** CLI dispatch grep vs 48 headless exports — 11 never appear as `h.<name>`: runPhase, ingest, buildVault, vaultIndex, vaultMarkdown, vaultFileFor, splitVaultBlocks, designModuleAvailable, diagramModuleAvailable, vaultModuleAvailable, withCommonJsExports. Of these, `runPhase`/`withCommonJsExports`/`ingest` are referenced intra-module or by tests; the vault/document helpers are used by the separate vault/knowledge CLI cases only via *other* headless fns (e.g. knowledgeSave/knowledgeFind) so the module is coherent, but the four `*ModuleAvailable`/`buildVault` branches and `vaultFileFor` are dead surface.
- **Verdict:** INTERNAL-EXPORT + few ORPHANS; **not** an engine lie. See per-name rows in census appendix.
- **Priority:** P3.

## A3-10 — Policies: `policies` are a CLI-prompt-verb-only affordance; engine/UI always expand with no policies, nothing persists them
- **Surface:** `prompt-engine.ts:208 expandBrief(brief, policies?, lessons?)`; `applyPolicies` 248; codegen.server.ts:513 (expansion inside keyed P6 passes no policies/lessons); headless.promptExpand (1460-1465) = the ONLY prod consumer path; CLI `prompt --policies` (rapidtool-cli.mjs 761-765).
- **Evidence:** project type has no `policies` field; applyPolicies prod callers = none outside prompt-engine internal use; engine store/UI never carry policies.
- **Verdict:** HALF-WIRED as an *applied* capability — but honestly gated behind an explicit CLI verb; the product's own keyed synthesis path silently ignores the constraint language its docs advertise for expansion. Docs (README-cli 476-477) describe only the verb, so not a lie; still a seam (the "why generate twice" trap).
- **Missing wire:** decide one owner: (a) CLI `create/run --policies` → store on an `spec.negativeConstraints`-adjacent project field → seed all later expansions, or (b) document "per-run only".
- **Priority:** P3.

## A3-11 — Dead/never-mounted auth & app surfaces (low)
- `src/lib/auth/gates.tsx` (SignInGate/SignedIn/SignedOut/UserButton/RedirectToSignIn — 0 importers; provider.tsx passthrough is the only mounted surface; sign-in audit doc says gates.tsx is catalogued but nothing renders it); `src/lib/auth/popup.server.ts` (server-side handler referenced only via vite.config.ts middleware, not in `src/` import graph — actually mounted by the dev plugin, not dead). `src/lib/app-data/*` has no in-tree `src/` importer (all consumers are root-level/middleware/plugin files; none statically resolvable) → revisit via a **root-level import scan** if a follow-up wants certainty.
- **Verdict:** mostly honestly staged/dev-tooling. Not scored as user-facing findings.

## A3-12 — Honest non-findings (checked, not counted)
- autopilot: fully wired (store 69/815; console 1759 toggle + setAutopilot; engine R3 guards; CLI `gate --autopilot`).
- Phase pipeline flags/cases: every PhaseDef 0–12 has a synthesizePhase case producing phase artifacts (engine switch 416–1018); catalog declarations (P3/P4/P10/P11 B-18) are honest labels, not promised features.
- Staged capabilities labeled in AGENT_GUIDE/README (P2P/multiplayer, connectors, live tools, self-learning) are documented as staged — no lie.

# Census appendix (machine, abridged)
- 557 exported names scanned. Classification counts: production-used via static/literal-dynamic import (≈340); own-test-only (≈170, excluded from findings); self-export-internal (≈158 names had zero *external* importers but ≥2 in-file uses — these are engine-internal helpers exported for tests; keep or de-export mechanically; recorded in the working matrix); true orphans (export line is the ONLY occurrence in tree) = 27 tokens, of which A3-04/A3-08/A3-09 capture the real ones; module-level dead = watcher.ts (+app-data/auth caveat).
- All numbers from the read-only census json kept in the sandbox; no source files were modified.
