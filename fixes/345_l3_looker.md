# 345 · L3 — LOOKER 3 · deeper UI/UX + client/process hunt (READ-ONLY)

- **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · base HEAD `06cb089` · working tree **not clean** during this session: a sibling fixer had uncommitted edits to `src/lib/rt-client.ts (+142)`, `src/components/pipeline-rail.tsx (-106)`, `src/lib/store.ts (+70)`, plus several tests/docs. All my probes ran against the **live dev server with those edits applied** (Vite HMR), so the two fixes below are validated against the new code, not the pre-fix state.
- **Read-only:** no source/test/config/doc/log edited by me. Only write: this file. Scratch: `%TEMP%\rt345_l3\` (`l3lib.mjs`, `probe[A–G].mjs`, `probe*-out.json`, `*.png`).
- **No keyed autonomy:** I never clicked a phase-run control. Post-run states were produced by **seeding `localStorage.rapidtool.v4`** with (a) a real exported complete project (`w1-source-project.json`), or (b) that project patched into parked/blocked/running/oversized shapes. No live model call was issued by me.
- **Fidelity caveat:** one seeded 800-artifact project and crafted states are not engine-produced; they exercise the *client* paths the engine feeds. The real complete project is engine-produced.

---

## 0. Validation of the sibling fixer's landed changes (do not re-report as open)

| change | verdict | evidence |
|---|---|---|
| **A3-01** now-line demotes diagnostic-only ring rows (`rt-client.ts` `pickNowLine`, `pipeline-rail.tsx` imports it) | **FIXED — verified** | V1a: ring has only `sys.longtask`, project has a ledger → line renders `LEDGER 15:38:54 algo.run P12 …`. V1b: ring has `wild.step_ok` → `RING … wild.step_ok P6`. V1c: only a diagnostic row + no ledger → `RING … sys.longtask` with note "client telemetry only — no run rows or ledger entries". `probeB-out.json`, `B-v1*.png`. |
| **A3-02** stall latch clearing (`rt-client.ts:514-531, 583-589`) | **FIXED — verified** (after a mid-session re-edit; see note) | First pass (11:44 code, `probeB-out.json` v2a/v2b) still stranded the latch on a stopped run. The fixer then landed `hasProbe && (!busy || !busy.active || busy.pause)` at **11:49:33**; the re-run clears it: `persistedStallAfter:null`, no `Stalled` row — for a stopped wild run (v2b), a reloaded active-then-stopped run (v2a), **and** an unrelated project that never registers its own probe (`probeH` control + `latchOnOtherProject`). No residual found. |

---

## 1. Findings table

| id | class | route / file:line | sev | reproduction | UX impact | recommended fix | effort |
|----|-------|-------------------|-----|--------------|-----------|-----------------|--------|
| **L3-01** | wrong state flash (loading≠missing) | `/run/$id` · `src/components/console.tsx:2264-2273` (`if (!project)` branch has no `hydrated` guard; `src/routes/run.$id.tsx` head *does* guard) | M | probeE `hydrationFlash`: on a hard load of a seeded existing project the DOM reads **"This build doesn't exist or was archived."** from 20 ms → **1006 ms** (content at 1662 ms). `A-complete-top.png` is a screenshot of that false state. | Every direct URL/reload of a real build shows a ~1 s false "build is gone" screen; a user can click "Back to intake" and abandon a live build. | Gate the branch on `useRapid(s=>s.hydrated)` — render a neutral skeleton until hydrated (the route head already models this). | XS |
| **L3-02** | client state race · lost update | `src/lib/store.ts` persist (no `storage`/BroadcastChannel sync anywhere) · `src/components/console.tsx` notes/rename handlers | M | probeD D1: tab A renames build → `{name:"RenamedByA"}`; a second tab loaded *before* the rename then writes `#notes` → persisted `{notes:"notes-from-B", name:"D1 Stale"}` — **the rename is silently reverted** (`lostRename:true`). | Two tabs (or a stale tab left open) silently overwrite each other's edits — data loss with no warning. | Add a `storage`-event (or `persist` rehydrate) listener, or merge-on-write; at minimum detect `activeId`/mtime drift and warn. | M |
| **L3-03** | state that cannot update · no recovery | `/run/$id` · `console.tsx` `canExecute` (~`:356-364`) + hydrate path `store.ts` (stops only *wild* runs) | M-H | probeE E3 + `A-running.png`/`D-stuck-running.png`: a project whose `phases[current]` is `running` (real: reload during Execute) renders `P2 RUNNING`; `Execute P2` and `Run to next gate` are `disabled:true` and the scan for stop/resume/cancel/recover/reset/repair returned **`[]`** — no control can un-stick it. | A mid-run reload permanently wedges the build in the UI; the only escapes are Archive-and-reimport or the CLI `repair`. | On hydrate, reset a persisted `running` phase to `ready` (with a `run.interrupted` ledger row), or add an explicit "Recover interrupted phase" control. | S |
| **L3-04** | engine value hidden by UI | `src/lib/types.ts:576-580` (`Project.tokenUsage`) · writer `src/lib/headless.ts:4746` · **no reader in `console.tsx`** | M | probeF F1: seeded `tokenUsage:{promptTokens:12345,completionTokens:6789,calls:7}` → body contains neither `12345` nor `7 calls`; the only token text is the packet-size estimate `≈3478 tok (est)`. Code: `grep tokenUsage src/lib/store.ts src/lib/engine.ts` → 0 writers. | Spend for a browser-driven keyed run is invisible and (for console runs) never recorded; an operator cannot answer "what did this run cost me?" without the CLI. | Record `SpendSlice` in the console run path (store) and surface a spend chip / sidebar row; today's packet spend line stays "none measured". | M |
| **L3-05** | eager hidden-tab side effects | `console.tsx` `<Tabs.Content forceMount>` (~`:3624`, `:3688`+) | M | probeE E1 `eagerCalls`: with the **Artifacts** tab active, the run screen already fired 2× POST `fixturesServer` (reads `research/eval-corpus` from disk), 1× POST `chatContextServer`, 2× GET `statusServer`. | Every run-screen load pays for panes the user never opens; for large projects all 11 panes render eagerly. Not a keyed spend (context fn is config-gated) but real IO/DOM cost. | Mount expensive panes lazily on first activation (drop `forceMount` for fixtures/chat/diagram/vault), or gate their fetches on an `active` flag. | S |
| **L3-06** | claim-vs-behavior drift (success on a no-op) | `console.tsx` `onIngestReport` (~`:2494-2511`) · `store.ts` `ingestReport` (~`:1782-1855`) | M | probeF F3: the same complete report ingested twice → artifacts `+1` (E-09 dedupe works) **but** notices `["Agent report ingested — artifacts marked "[agent report]"."]` and `agent.report` log rows ×3 (the store appends its "no tests_run evidence" warn on the duplicate path too). | The UI says "ingested" when nothing landed; the diagnostics ledger counts reports that were dropped. | Read `res.applied`/`res.reason` in the console and show a "duplicate — nothing changed" notice; skip the warn row when `applied:false`. | XS |
| **L3-07** | silent data loss · no signal | `src/lib/store.ts:934-1000` (`quotaSafePersistStorage.getItem` swallows parse errors) vs `:1003-1046` (`recoverFromCorruptPersistence`/`preserveUnreadableBlob`) | M | probeC C3 (valid JSON, `phases` is an object) and C4 (truncated JSON): home loads, store is replaced by the **demo seed**, `rapidtool.v4.rescue` = **null**, and `logs` = **[]** (no warning at all). Only the version-mismatch path (C5) writes a rescue copy + `console.warn`. | A corrupt/truncated persisted blob silently destroys the user's builds and replaces them with "Northwind Dispatch" — no rescue, no toast, no console warning. The K2 "unreadable blob is rescued" claim holds only for the future-version throw. | Wrap the getItem/parse path so a non-empty unparseable/malformed blob routes through `preserveUnreadableBlob()` + a visible recovery notice before the seed overwrites it. | S |
| **L3-08** | duplicate action (no in-flight latch) | `console.tsx:1779-1785` (`launch()` — no `busyRef`, unlike the run actions which have one) | L-M | probeC C7: three `click`s dispatched in one tick → 3 identical builds persisted (`["A Double-click Probe Application" ×3, "Northwind Dispatch"]`). probeF F2: two clicks 15 ms apart → 1 build (React's `disabled` already committed). | Fast/queued clicks (touch, low-end, scripted) can create duplicate full builds; the run controls are latched, Home is not. | Add a `useRef` latch (or disable via a ref) in `launch()`, mirroring `run()`/`runUntil()`. | XS |
| **L3-09** | ~~fix incomplete (residual of A3-02)~~ | — | — | **WITHDRAWN — fixed by the sibling at 11:49:33 and re-verified** (`probeB` v2a/v2b + `probeH`: `persistedStallAfter:null`, no `Stalled` row in every case tested). Retained here only so the wave record shows the pre/post states were both measured. | — | — | — |
| **L3-10** | observability gap (large lists) | `console.tsx` Artifacts pane (`:3625-3685`) | L | probeC C2: 800 artifacts → 800+ `<button>` rows rendered (no virtualization); search filtered in ~1.2 s; list is capped at 540 px so it stays usable. | Linear DOM/render cost; a large real project could jank the Artifacts tab. | Window the list (or cap rendered rows with a "show more"). | M |
| **L3-11** | a11y minor (live region) | `console.tsx` ChatPane "thinking… {elapsedSec}s" (~`:6694-6707`) | L | probeD D3 `a11yRun.live` = 2 regions (pipeline, runtime); the chat elapsed counter is not a live region, and the `aria-live` regions list has no chat/wild entry unless wild is active. | A screen-reader user gets no announcement that a chat reply is pending (the elapsed counter updates silently). | Add `role="status"` to the thinking row. | XS |
| **L3-12** | no error-state signal on some panes | `console.tsx` FixturesPanel (`:489-522`) | L | probeG G2 (server-fn abort) was **inconclusive** — the abort route did not clearly take effect; the pane's non-throw error path (`data.ok:false` problems list) was not separated from "loading". | — (not proven) | (Re-test with a deterministic server-fn failure before acting.) | — |

**Validated as healthy (no finding):** 0 page errors / 0 unhandled rejections / 0 failed requests across every probe and scenario; import of invalid JSON → coded `RT_E_VALIDATION` alert; ingest bad JSON / wrong phase → coded errors; reject flow (blur, then Reject) → `blocked` + `phase.rejected` + note + history; force-human failed-sandbox gate blocks Approve until the override is ticked (`before.disabled:true → after:false`); palette `Ctrl+K` + type + `Enter` switches tabs; keyboard-only focus order sane (skip link first); unnamed interactive elements = 0; mobile 390 px no horizontal overflow for the packet pane / repo-map card (350 px) / shell-surfaces drawer (300 px); rapid 25× tab switching clean; clipboard rejection handled per pane (`Copy failed` / "Clipboard blocked…"), no floating rejection.

---

## 2. Coverage statement — what I drove, at which viewports

**Routes:** `/` (HomeScreen) and `/run/$id` (RunScreen, live + record views), the not-found run state, and the dialogs (Guide/Settings/Shortcuts/Archive confirm/command palette). Driven via Playwright/Chromium (Playwright 1.62).

**Viewports:** desktop **1440×900** throughout; mobile **390×844** (`isMobile`) for the long-brief, packet/repo-map, and shell-surfaces-drawer checks; **1024×900** was covered in the prior A3 pass (rail-badge overflow).

**Scenarios exercised (all with real DOM assertions saved under `%TEMP%\rt345_l3\`):**
- **Real engine-produced complete project** (`w1-source-project.json`, 13 phases / 18 artifacts / 12 920-char packet): all 11 tabs, repo map, shell-surfaces card, a11y snapshot, now-line.
- **Parked HITL**: approve/reject enablement, note `aria-invalid`, evidence bundle, `r` focuses the note, `<12` reject disabled by aria-label.
- **Blocked/rejected**: Retry control, rejection note, `P6 BLOCKED` posture.
- **Running + reload mid-run**: disabled controls, no recovery (L3-03).
- **Long unbroken brief** (400-char token): desktop + mobile, no overflow.
- **800-artifact project**: render + search (L3-10).
- **Corrupt / truncated / future-version `rapidtool.v4`**: recovery, rescue copy, warnings (L3-07).
- **Poisoned `rapidtool.rt.v1` ring**: hydrate, no crash; navigate-away mid async load (chatContext/fixtures) → no unhandled rejection.
- **Stale tab** (two tabs, same origin): lost update (L3-02).
- **Rapid clicks**: `Open intake` ×3 one tick (L3-08); identical report ingested twice (L3-06).
- **Hydration timing**: 50 ms polling of the run screen from first paint (L3-01).
- **Eager server calls**: network capture on run-screen load (L3-05).
- **Keyboard-only**: `Ctrl+K` → type → `Enter` tab switch; 14-step Tab walk (skip link first).
- **Screen-reader pass**: roles, names, live regions, tab/tabpanel association, headings, images, lang.
- **Failure paths**: clipboard rejection across Artifacts/Vault/Design/Runtime; invalid-JSON import; invalid/wrong-phase ingest.
- **Observability probes**: measured `tokenUsage` presence (L3-04); hidden `forceMount` panels' computed display (`display:none`, correctly out of the a11y tree).

**A11y/responsiveness of the recent UI changes (task item 4):** repo-map card, shell-surfaces card, and packet pane were checked at 390 px and desktop — no overflow, no clipping, labels present, `0` unnamed interactive elements. **No regression found.**

---

## 3. What I could not exercise, and why

- **A live keyed run / an erroring phase run driven from the UI.** The dev environment has `DEEPSEEK_API_KEY` set, so any run/approve/crew/chat-send would drive real model calls; the mandate forbids that. I simulated post-run and error states by seeding persisted projects instead, so *engine-side* error reasoning (e.g. a P6 sandbox failure production path) is reasoned from `types.ts`/`store.ts`, not driven.
- **Wild mode live** (autonomous loop) — keyed by nature; assessed from the seeded `wildRun` states and the fixer's code only.
- **Cross-session checkpoint resume / plan review / quarantine / emit** — CLI-only surfaces with no console seam (this is the standing A3-15 gap); not reachable from the browser to test.
- **The server-fn hard-failure error state (L3-12)** — my `page.route` abort did not clearly take effect (the pane showed neither the success nor the documented failure text); left marked inconclusive rather than claimed.
- **Production build timing** — L3-01's ~1 s figure is measured on the dev server (HMR + dev bundling); production would be shorter, but the unguarded branch is the finding, not the exact duration.
- **Full `npm test` / gate** — forbidden; I did not run any test suite this pass (the prior A3 pass ran the slice suites).
