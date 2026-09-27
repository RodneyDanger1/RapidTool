# fixes/284_wiring_guarantee.md — W38 · LANE G1 · THE WIRING-GUARANTEE PASS

**Lane:** W38 G1. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · HEAD `0f85c32` + the W29–W37 uncommitted era.
**Mission:** guarantee function — every interactive element reaches a real seam; every seam is reachable; every
reference (label, name, path, event) agrees with the code it points at. Small honest fixes only; where already
right, RECORD the verified ✓ (the pointer map is half the deliverable).
**Box (mine):** `src/components/console.tsx` · `src/routes/**` · `src/routeTree.gen.ts` · the seam layer
(`chat.ts` · `crew.ts` · `exec.ts` · `fixtures.review.ts` · `llm.ts` · `research.ts` · `verify.ts` · `rt-events.ts`
read-side/emitters in UI). **NOT mine (live lanes):** `codegen.server.ts` + `src/lib/llm/**` (Y1) ·
`engine.ts`/`store.ts`/`rt-*.ts` (Y2) — findings there are recorded `for-Y1`/`for-Y2`, never edited.
**Contract:** CODE-ONLY — no test runs, no typecheck, no builds, no gates, no keyed calls. Log-and-continue.
Smallest honest patch per broken pointer · additive only in console.tsx · never weaken a contract · never remove
a control · never an enabled no-op.

## [t0] Mandatory reads (verified, ~20:30)

- `wave_plans/W37/master-pack.md` — read in full (54 lines; X3 = the UI lane this pass completes at wiring scope) ✓
- `fixes/281_n3_ui.md` — read in full; the N3 baseline: `ShellSurfacesCard` appended at console.tsx EOF
  (7 rows: plan · checkpoint · unattended · stream · cassette · seat · isolation), render line after
  `<GateHealthCard/>`; byte-state table at :24-37 is the baseline I verify against ✓
- `fixes/276_f3_ui_close.md` — read (24-line skeleton; no byte-state table; delivers the F3 context: the
  `RT_E_*` codes + `wildPlan` shape decisions that drove N3) ✓
- §R6 worklist `research/multiagent/thoroughanalysis.md:1370-1388` (R6-f01…f15) — read in full ✓
- §R14 edge table `thoroughanalysis.md:1105-1111` (R14-f01…f05 + the wired-✓ table) — read in full ✓
- §R6 verifications that HELD (must re-verify, do not "fix"): 0 non-null assertions · 59 buttons swept ·
  RUN_TABS single source ✓ pending re-check below.

## [t0] Byte-state (this tree, this session — code = truth)

| File | Bytes/lines | Note |
|---|---|---|
| `src/components/console.tsx` | **6,832 lines** | N3's edits live (6,677 → 6,832 = +155 claimed; matches N3 log) |
| `src/routes/__root.tsx` | 89 lines | PreviewHostBridge :8 · TelemetryBoot :80 (R14-f05 claim) |
| `src/routes/index.tsx` | 15 lines | renders a console export |
| `src/routes/run.$id.tsx` | 17 lines | renders a console export |
| `src/routeTree.gen.ts` | (src/, not src/routes/) | R14 f05 cited `routeTree.gen.ts:11-24` |
| `src/lib/chat.ts` · `crew.ts` · `exec.ts` · `fixtures.review.ts` · `llm.ts` · `research.ts` · `verify.ts` | 517 · 212 · 103 · 39 · 159 · 109 · 288 | the 7 facade files (8 facades' createServerFn sites) |
| `src/lib/rt-events.ts` | 395 lines | the event registry |
| `src/lib/store.ts` | 1,882 lines | Y2's box — read-only for me |

## Pointer map (the deliverable)

STATUS: ✓ = verified true today · FIXED = this lane's patch · for-Y1/Y2 = recorded, owned elsewhere ·
N/A = not-a-pointer.

_(rows land below as verified — append-only)_

## Log (append-only)

## [W40 K8 · 2026-09-27] THE OWED POINTER-MAP ROWS — appended from the lane's delegation summary

**Why here:** G1 (W38) died capped **before any map rows or fixes landed** ("The map rows + fix evidence are NOT yet appended (owed)"). The delegation summary (`~/AppData/Local/hermes/cache/delegation/subagent-summary-0-20260926_203728_538352.txt`) is the only persisted record — re-landed below verbatim. Byte-verified at lane time (tree `0f85c32` + W29–W38 era; **later waves may have landed some — re-verify before acting**). Appended by W40 K8 as the Z4 payout's G-map record.

### G1 · VERIFIED ✓ (real reads, this tree)
- **Routes→components:** `src/routeTree.gen.ts:11-24` (note: it lives at `src/routeTree.gen.ts`, not `src/routes/` — R14-f05's path is off) → `/` + `/run/$id` → console's `HomeScreen`/`RunScreen`. `run.$id.tsx:16` passes required `id` ✓.
- **Root wiring:** `__root.tsx:8`+`:81` PreviewHostBridge · `:22-27`+`:80` TelemetryBoot · `:48` manifest link (`/__grok/manifest.webmanifest`).
- **All 12 createServerFn sites / 8 facades** — every lazy import path resolves and every imported name exists at the exact source: `chatOnceServer`(chat.server.ts:486) · `buildChatContext`:127/`chatContextVersion`:334/`CHAT_CONTEXT_MAX_CHARS`:53 · `runCrewServer`(crew.server.ts:1382) · `completeDeepSeek`(:30←deepseek.ts:635)/`isDeepSeekConfigured`/`deepSeekModelIds` · `runNodeBounded`/`runnerAvailable` · `loadFixtureReviewRows`:34 · `tavilySearch`/`isTavilyConfigured`/`freeWebSearch` · `verifyAndFixServer`:946 · `callModel`(registry.ts:662). Signatures match the call sites ✓.
- **Store pointers:** all 7 `useRapid.getState().X(...)` call sites → real `RapidState` exports (store.ts:88-197) ✓.
- **Handler sweep:** exhaustive callee scan of console.tsx (comments/strings stripped, 352 callees vs 401 defs/79 imports) → **zero undefined/typo callees**; all residue is builtins/member calls ✓.
- **R6/fixes already landed ✓:** f01 (module latch :2238-2264 + `"module"` union) · f02 (all 4 surfaces + `og/site.json:1`) · f03 (fixtures labels ×3) · f07 (How-it-works :1731 + `{n}/12` :1789) · f11 (`wildPaused()` :1292-1318) · **f12 (PaneBoundary :1642-1690, `ui.pane_crash` emitter fires :1654, registered :141)** · f13 (:1834 "Phase n of 13") · f14 (:6307 `?? null`) · SHORTCUTS table ↔ key handler exact match.

### G1 · BROKEN POINTERS FOUND (NOT yet fixed at lane death)
1. **`console.tsx:1186`** — emits registered `sys.heartbeat` with `scope: "wild-driver"`; registry binds `sys.heartbeat`→`sys`. One-token fix.
2. **`error-component.tsx:60`** — emits `ui.boundary_crash`, **not in the registry**; the registered twin is `boundary.crash` (→ scope `boundary`, pinned rt-events.test.ts:45). Fires on every route crash. One-token fix.
3. **R6-f12 gap** — `PaneBoundary` wraps **HomeScreen only** (:1745); RunScreen unwrapped (done-when names both). Additive wrap owed.
4. **W-38 still open** — `store.runP6Journey` has **zero console callers** (dead edge confirmed).
5. **R14-f04** — deepen seam still a string lookup (`DEEPEN_ACTION_NAMES` :6163 *does* resolve today — `deepenResearch` is real, store.ts:122/:930 — but degrades silently on rename; no test pins the names).

### G1 · ISSUES (verbatim)
- Cap hit mid-verification; **no product edits landed** and the map's fix/✓ rows remain to be appended to `fixes/284_wiring_guarantee.md`.
- Registry cross-check (55 names): ~30 registered events (llm.\*, runner.\*, verify.\*, crew.\*, ui.action_error, store.action_error…) show no emitter in the client graph — needs the CLI-sink question settled before calling them consumed-but-never-emitted.

_— appended by W40 K8, 2026-09-27 (markerless append at EOF; the lane's own sections above were not edited)._
