# fixes/330_6_chrome.md — Wave 330, agent 6 (Chrome: the Console Engineer / browser lane)

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main`, branch `main`, HEAD `c024503`.
**Runtime:** Playwright `^1.62.0` (installed) driving headless Chromium against the dev server
(`npm run dev`, `0.0.0.0:8080` contract — reached as `http://127.0.0.1:8080`; `localhost` resolves
to `::1` first on this host and timed out, so every probe targets `127.0.0.1`).
**Owned files:** `src/components/console.tsx` · `src/routes/**`. **This log is written incrementally.**

The point of this lane: the product as the owner sees it, in a REAL browser. Nothing here is
inferred from reading source unless stated.

---

## 0. Method / harness

Probe scripts live OUTSIDE the repo (`%TEMP%\rt-*.mjs`) and import Playwright from the repo's
`node_modules` via `createRequire("…/RapidTool Main/package.json")` (bare ESM imports do not resolve
from `%TEMP%`). Forced-throw proof uses Playwright request interception of the Vite-served module
`/src/components/console.tsx` to inject a **guarded** `throw` into one named component; nothing was
written into the repo. Screenshots under `%TEMP%\rt-shots\`. The dev server was started as a
background process and stopped at the end (`npm run dev`, Task 01a0f960…).

Harness gotcha recorded for the next lane: Playwright `locator.fill()` did NOT update this app's
controlled `<textarea>` (the Open-intake button stayed `disabled`); `pressSequentially()` did. And
`getByRole("button", { name })` matches the **accessible name** — the Shortcuts header button's is
its `aria-label` ("Keyboard shortcuts"), not its text.

---

## 1. Real-browser reconnaissance (what I actually saw)

Console/pageerror/requestfailed/HTTP≥400 were captured on every load. Home, the full run screen,
all 11 panels, and the dialogs were exercised on a live keyless run (created via the real intake
form, then executed P0 and advanced to the P4 HITL gate with "Run to next gate").

| Surface | Reached? | Rendered? | Console errors | Notes (DOM/console evidence) |
|---|---|---|---|---|
| Home (intake form, Builds panel, templates, counter) | yes | yes | none | live counter `0/12 · no brief yet…`; intake enables ≥12 chars |
| Run header (name/rename, chips, Autopilot, Wild, Guide/Settings/Shortcuts/Light) | yes | yes | none | chips: domain · `configured` (LLM) · `research · free search` · `sync-template · 30s` · `≈N tok (est)` · `saved HH:MM` |
| Phase rail (P0–P12) | yes | yes | none | each phase clicked → read-only view (`Viewing Pn · read-only` / `Back to live`); all 13 render |
| Run center — Artifacts | yes | yes | none | populated after P0: `All · 9 / P0 · 8 / P1 · 1` |
| Run center — Agent packet | yes | yes | none | `agent-packet.md … ≈1911 tok · 6735 chars` |
| Run center — Chat | yes | yes | none | honest banner `configured · advice-only … one-shot replies` |
| Spec graph / Crew / Oracle / Vault / Design / Diagram / Runtime log / Eval fixtures (behind "More panels (8)") | yes | yes | none | all 11 `[role=tab]` triggers reached and each visible `[role=tabpanel]` rendered real content |
| Run sidebar (DoD toggle, Notes, Memory, Gate log, Shell surfaces, Diagnostics) | yes | yes | none | Shell-surface rows read as honest limits (Wild plan / Checkpoint / Unattended / Token streaming / Cassette / Human seat / Isolation) |
| Guide / Settings dialogs | yes | yes | none | `[role=dialog]` visible, content real |
| Command palette (⌘K) | yes | yes | none | entries incl. "Approve the waiting gate", "Run to the next gate", copy/download packet & build |
| Run loop: Execute P0 → Run to next gate | yes | yes | none | P0 sealed → advanced P1→P4, parked at `P4 · IN REVIEW / Awaiting human approval` with Approve/Reject |
| Wild mode toggle | yes | yes | none | started the loop; ran P3/P4 (deterministic floor); then `WILD MODE PAUSED … Auto-Review classifier not configured — P4 approval gate cannot be self-approved` |
| Export menu → download `.json` | yes | yes | none | downloaded 15911 bytes |
| Import (`.json`) round-trip | yes | yes | none | re-imported the exported file → navigated to the imported build |
| Ingest report | yes | yes | none | inline textarea panel (not a dialog) + Ingest/Cancel |
| Clone | yes | yes | none | navigated to a new build id |
| Routes: unknown `/run/<id>`, unmatched path, `/run` (no param) | yes | yes | none | honest: `This build doesn't exist or was archived.` / `Page not found` (the only 404 is the unmatched URL itself, as expected) |
| Mobile 390×844 home + run | yes | yes | none | sidebar becomes the `Sidebar` drawer (`aria-controls="run-sidebar"`) |

**What I could NOT reach:** nothing in the console was unreachable; the only limits were
capability-gated (see §4).

**Label honesty spot-check:** every claim I could compare to behavior held. `research · free search`
is real (`websearch.server.ts`, and P0 produced real research rows). Shell-surface rows and the
Eval-fixtures "no control is wired yet" note read as honest limits, consistent with 328/329.

---

## 2. Pane-crash behaviour — pinned in the browser (this was the lane's core ask)

`PaneBoundary` (`console.tsx`) emits one `ui.pane_crash` row (`rt-events.ts:148`) and renders a
fallback with a real "Try again". 328 P4 wrapped Home content + phase rail + Run center + Run
sidebar; there was no DOM harness, so containment was never proven. It now is.

**Harness:** intercept `/src/components/console.tsx`, inject `if (globalThis.__C) throw new Error(
"harness: forced <pane> throw")` into one named component, let the run screen render healthy, then
set the flag and force a re-render (Autopilot store toggle). Artifacts outside the repo.

**Result (final proof run, `%TEMP%\rt-proof.mjs`):**

| Forced throw in | fallback rendered | other surfaces stayed mounted | `ui.pane_crash` rows | body |
|---|---|---|---|---|
| `WildToggle` (Run header) — **after the fix below** | yes — `harness: forced header throw` | rail `1`, sidebar `1` | `1` — `Run header area crashed while rendering…` | 3560 chars (not blank) |
| `PhaseRail` | yes — `harness: forced rail throw` | header `1`, sidebar `1` | `1` — `Phase rail area crashed while rendering…` | 3247 |
| `ShellSurfacesCard` (Run sidebar) | yes — `harness: forced sidebar throw` | header `1`, rail `1` | `1` — `Run sidebar area crashed while rendering…` | 2442 |
| `ChatPane` (Run center) | yes — `harness: forced center throw` | header `1`, rail `1`, sidebar `1` | (tab unreachable — the "More panels"/Runtime trigger lives *inside* the crashed center; a harness limit, not a defect) | 2298 |

"Try again" recovery was also observed live (flag cleared → pane re-renders healthy; the earlier
TEST A in `rt-chrome-crash.mjs` shows `sidebar 0→1`, `fallback 1→0`).

**Containment HOLDS** for rail/center/sidebar — matching 328 P4's claim, now with real evidence.

---

## 3. DEFECT FOUND + FIXED — the Run (and Home) **header** was an unwrapped surface

**Defect.** The Run header (build name/rename, status chips, Autopilot, Wild, Guide/Settings/
Shortcuts/Light) sat OUTSIDE every `PaneBoundary`. A render throw there unmounted the ENTIRE run
screen through the router's `AppErrorComponent` — the exact white-screen class R6-f12 exists to stop.

**Pre-fix browser proof** (`%TEMP%\rt-chrome-header.mjs header`, before the edit):
```
HEALTHY: {"rapidHeader":1,"rail":1,"sidebar":1,"tabs":3,"paneFallback":0}
=== force header throw ===
AFTER:   {"rapidHeader":0,"rail":0,"sidebar":0,"tabs":0,"paneFallback":0,
          bodyHead:"Something went wrong harness: forced header throw Reload Back to home"}
```
→ rail, sidebar, tabs and the header all gone; only the router error page remained. NOT contained.

**Fix (my file, additive only).** `src/components/console.tsx`:
- `:2696` — wrapped the Run `<header>` in `<PaneBoundary label="Run header"> … </PaneBoundary>`
  (closes after `</header>`, before the 3-column grid).
- `:1747` — the same class existed on Home: its header ("How it works" entry) was outside the
  `Home screen` boundary, so wrapped it in `<PaneBoundary label="Home header">` too.

`PaneBoundary` returns its children unchanged when healthy (no extra DOM node), so the layout is
byte-identical on the happy path. No control, label, or code path was added or removed.

**Post-fix browser proof:**
```
AFTER: {"header":0,"rail":1,"sidebar":1,"fallback":1}
FALLBACK: "This area hit a render error — the rest of the console is still live.
           harness: forced header throw   [Try again]"
ui.pane_crash count: 1
crash line: ["Run header area crashed while rendering: harness: forced header throw"]
```
→ header crash is now CONTAINED; rail + sidebar + center stay live; exactly one honest telemetry row.

`git diff --stat` for my file: `src/components/console.tsx | 14 ++` (the two boundary wrappers + two
TD-finding comments). No other file was touched by this lane.

---

## 4. What I could NOT exercise (plainly), and observations not turned into edits

- **No keyed path.** `.env` has a DeepSeek key that the provider rejects — spawning the crew returned
  a real `HTTP 401 … Your api key: ****42ff is invalid`. So the header chip's `configured` (LLM
  backend status) is literally true ("a key is present") but the capability is NOT usable, and every
  keyed action 401s. The console surfaces that 401 honestly at the point of use (Spawn crew showed
  the real provider error; Chat reports `not-configured` only when no key exists). Whether "configured"
  should be stricter needs the status probe in `src/lib/store.ts` / the server module — **not my
  file** → STOP-and-REPORT, no edit made.
- **Keyed/wild P6 and beyond** could not finish (same 401); Wild correctly paused at P4 with an honest
  reason rather than fabricating a self-approval.
- **Center-pane `ui.pane_crash` row** could not be read back for the ChatPane-throw case because the
  Runtime-log trigger is itself inside the crashed center boundary (§2) — a harness limit.
- **Demo-seed timing observation (not a defect I can fix here):** on a cold first load the Home
  "Builds" panel read `0 / No builds yet` at ~2.5 s and showed the seeded "Northwind Dispatch" by
  ~6 s; and the hydration-time demo seed did not write `rapidtool.v4` to localStorage while an
  explicit "Open intake" did. This lives in `src/lib/store.ts` (hydration/`seedIfEmpty`), **not my
  file** → reported, not edited.

---

## 5. Commands run + real results

| Command | Result |
|---|---|
| `npm run dev` (background, `0.0.0.0:8080`) | `VITE v8.2.2 ready in 36612 ms`; `GET http://127.0.0.1:8080/` → **200**, 7405 bytes |
| `node %TEMP%\rt-chrome-recon*.mjs` (§1) | all panes rendered; **0** console errors / pageerrors / HTTP≥400 across every sweep |
| `node %TEMP%\rt-proof.mjs {header,rail,sidebar,center}` (§2) | containment CONTAINED for every surface; one `ui.pane_crash` row each |
| `node %TEMP%\rt-chrome-header.mjs header` (pre-fix) | white screen: `Something went wrong … Reload / Back to home` |
| `npm run typecheck` | **PENDING — see gate block** |
| `npm run lint` | **PENDING — see gate block** |

---

## 6. Not-mine / forward (STOP-and-REPORT)

1. `llmStatus` "configured" with an invalid key (401) — `src/lib/store.ts` + the server status probe.
2. Demo-seed hydration/persist timing — `src/lib/store.ts`.
3. The Run header's action bar (Execute/Run to next gate/Clone/Export/Ingest/Import/Archive) is
   already inside the `Run screen` center boundary — no change needed; noted so the next lane does
   not re-wrap it.

---

## 7. Gate block

Run after all my edits (`Patch-only`; five siblings were editing other files concurrently, so the
full gate was NOT run per the wave rules — targeted gates only).

| Command | Real output |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **exit 0**, no diagnostics |
| `npm run lint` (`eslint .`) | **exit 0**, no output (0 problems) |
| `node %TEMP%\rt-smoke.mjs` (post-edit) | Home `header:1` + "How it works"; Run `header:1 rail:1 sidebar:1 tabs:3`; **0 errors** — both wraps are inert on the healthy path |

Both gates typechecked/linted the whole working tree including siblings' in-flight edits and still
came back clean, so my `console.tsx` change is clean on its own account. `git diff --stat` reports my
file at `src/components/console.tsx | 14 ++` — no other owned path was modified.

**Dev server stopped** (background task `01a0f960-…` killed); no scratch left inside the repo (all
probe scripts and screenshots live under `%TEMP%`).
