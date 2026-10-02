# fixes/331_5_chrome.md — W45 · Lane 331-5 "Chrome" — console UI + real-browser proof

**Lane:** 331-5. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (folder name has a space).
**Branch:** `main`, **HEAD at wave open / at lane time:** `03a6d0b` (tree clean; only `wave_plans/W45/` untracked).
**Owned files (STRICT):** `src/components/console.tsx` · `src/routes/**`. **This log is append-only.**
**Browser:** Playwright `1.62.1` (repo `node_modules`), headless Chromium, driven from harness scripts kept
OUTSIDE the repo (`%TEMP%\rt331_chrome\…`; screenshots in `%TEMP%\rt331_chrome\shots\`). Dev server
`npm run dev` (`0.0.0.0:8080`, reached as `127.0.0.1:8080`) on **host Node v24.15.0**; all node harness
scripts run on **Node 22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`).

---

## 0. HEADLINE — the register is STALE: every cited UI row was already landed

The W45 brief cites `research/multiagent/thoroughanalysis.md` §R6 line numbers that were pinned to
**`e3d3fe4`** (2026-09-26 16:05). Between that register and this wave's HEAD, commit **`2fa3cd9`**
("W29-W39: the completion era", 2026-09-27 00:56) landed the fixes — and `2fa3cd9` **is an ancestor of
HEAD** (`git merge-base --is-ancestor 2fa3cd9 HEAD` → 0), as is `e3d3fe4`
(`git merge-base --is-ancestor e3d3fe4 2fa3cd9` → 0). `git log -S` confirms the exact anchors
(`UI-4 latch`, `R6-f01`, `of 13`) all landed in `2fa3cd9`, not in any W45 lane. `R6-f12` was additionally
extended by the 330 Chrome lane (`fixes/330_6_chrome.md`).

**Consequence for this lane:** UI1 / UI2 / UI3 are ALREADY FIXED. I made **zero edits** to my owned files.
Re-landing them would have been duplicate, unverifiable churn. Per the mission ("land what is real"), I
instead **proved each one in a real browser** and, for UI1, built a **falsifiable harness** (positive +
negative control) so the proof can regress-test the guard, not just observe a happy path.

`git diff --stat` for my owned paths: **empty** (no edits). `git status` shows only sibling lanes' changes
plus `fixes/331_5_chrome.md` (this log).

---

## 1. Method / harness (all outside the repo)

| Script (`%TEMP%\rt331_chrome\`) | Purpose |
|---|---|
| `common.mjs` | Playwright bootstrap via `createRequire(repo/package.json)`; console/pageerror/requestfailed/HTTP≥400 capture; `typeInto` (fill() does NOT fire this app's controlled textarea — focus + `keyboard.type` does, re-confirmed) |
| `recon-home.mjs`, `flows.mjs` | Home UI2 ramp; create/nav; route sweep; tab a11y |
| `latch2.mjs` | UI1 double-run proof; `PATCH=remove` = negative control (strips the latch from the Vite-served module) |
| `pane-crash.mjs <pane>` | R6-f12 re-run: injects a guarded throw into one component in the served module; forces a re-render via the `?` shortcut; reads `ui.pane_crash` rows from the persisted ring (`rapidtool.rt.v1`) |
| `mobile.mjs` | 390×844 viewport sweep + overflow + drawer |
| `crew.mjs` | UI4: one bounded keyed action (Spawn crew) |
| `regress.mjs`, `export.mjs` | Surrounding-flow regression sweep |

Nothing was written into the repo by the harness (forced throws live only in the intercepted response).

---

## 2. UI1 — busy latch on `onRunModule` (R6-f01 · C2-f04)

**Current file:line:** `src/components/console.tsx:2326-2352` (latch `:2327`, `busyRef=true :2330`,
`try :2332`, `catch :2344-2347`, `finally :2348-2351`); `busyAction` union includes `"module"` at
`:1962-1964`; the control at `:2956-2967` (`disabled={busyAction !== null}`, "Running…" spinner).
**Register's before (`e3d3fe4`):** `onRunModule` at `:2122-2136` had NO latch and NO try/catch/finally;
the union at `:1801` was `null | "step" | "run" | "approve" | "reject" | "crew"` (no `"module"`).
**After behaviour:** a second activation while a run is in flight is a no-op (`busyRef.current` guard +
disabled control); a throwing runner is caught and surfaced via `setError`.

**Browser proof (`latch2.mjs`) — a real bounded module run is spawned:**

| Mode | Input (2 synchronous `click()`s, one tick — faster than any OS double-click) | exec server-fn POSTs | `runner.real` rows | observed |
|---|---|---|---|---|
| **shipped** | 2 | **1** | 1 | `Module ran: exit 0 in 480ms` |
| **latch removed from the served module** (negative control) | 2 | **2** | 1 | two runs fired |

The negative control proves the harness detects the exact double-run class AND that the shipped
`busyRef` guard is what prevents it. (The run is real: the exec server function drove the bounded local
runner, exit 0. The negative-control pair spawns two bounded runs by construction — the bug the row
describes.)

---

## 3. UI2 — HomeScreen unexplained disabled launch + help entry (R6-f07)

**Current file:line:** "How it works" entry `:1760-1768` (opens the same `GuideDialog` as the run screen,
rendered `:1894`); live counter/explanation `:1814-1829`; disabled control `:1803`
(`disabled={brief.trim().length < 12 || busy}`); `launch()` guard `:1733-1739`.
**Register's before (`e3d3fe4`):** HomeScreen `:1613-1736`; button disabled at `:1676` with only the
static `"Phase 0 starts locked to the brief"` line — no help entry, and nothing said why the button was
disabled.

**Browser proof (`flows.mjs`, desktop):**
- `0/12 · no brief yet — 12+ characters required before a build can open` (disabled) — the 0-char case speaks.
- type `short` → `5/12 · brief too short — 12+ characters required before a build can open` (still disabled).
- type to 32 chars → `32/12` (enabled), button clickable.
- click "How it works" → `[role=dialog]` visible, heading **"Agent guide"**, body "Condensed AGENT_GUIDE.md
  content."; Escape closes it.

---

## 4. UI3 — the remaining located rows

**R6-f13 "Phase n of 13"** — `console.tsx:1880-1881` now renders
`<span title={`P${p.currentPhase}`}>Phase {p.currentPhase + 1} of 13</span>`.
Before (`e3d3fe4:1723`): `{p.domain} · P{p.currentPhase} · …`.
Browser (`flows.mjs`): home build row reads `custom-software · Phase 1 of 13 · not started` with
`title="P0"` — engine code kept in the tooltip, plain language on the face. **HELD.**

**R6-f14 latent undefined** — `console.tsx:6613-6615`:
`const active = !arts.length ? null : (selected ? arts.find(…) : undefined) ?? arts[arts.length - 1] ?? null;`
Before (`e3d3fe4:6161`) it ended `… ?? arts[arts.length - 1]` (a possible `undefined`). The consumer is
`ArtifactPane`, whose prop is typed `active: Artifact | null` (`console.tsx:4296-4303`) — **null is a
first-class input**, so the `?? null` makes the type honest with no behaviour change on the non-empty
path. **HELD.**

**R6-f15 advanced-tier `Tabs.List` a11y** — primary `Tabs.List :3385`, advanced `:3409-3413`. This row
was a *verify*. Browser (`tabs-a11y.mjs`): both `[role=tablist]` carry descriptive `aria-label`s; every
`[role=tab]` has an `id` and an `aria-controls` that resolves to a real `[role=tabpanel]`
(11/11 resolve); roving tabindex is live — `ArrowRight` moves focus **and** `aria-selected` (automatic
activation), the focused trigger carries `tabindex="0"` while the rest are `-1`; the tablist container
itself is a tab stop (`tabindex="0"` on `[role=tablist]`), so it is keyboard-reachable. **HELD.**

**R6-f12 PaneBoundary containment — RE-RAN, do not re-land** (`pane-crash.mjs`). Forced throw injected
into one component in the served module, then a re-render forced via the `?` shortcut:

| Forced throw in | fallback rendered | other surfaces stayed mounted | `ui.pane_crash` rows | recovery |
|---|---|---|---|---|
| `WildToggle` (Run header) | yes — `harness: forced header throw` | rail + sidebar + tabs | **1** — `Run header area crashed while rendering: harness: forced header throw` | "Try again" → header healthy |
| `PhaseRail` (`nav[aria-label='Phases']`) | yes | header + sidebar + tabs | **1** — `Phase rail area crashed…` | healthy |
| `ShellSurfacesCard` (Run sidebar) | yes | header + rail + tabs | **1** — `Run sidebar area crashed…` | healthy |
| `ChatPane` (Run center) | yes | header + rail + sidebar | **1** — `Run screen area crashed…` | healthy |

Every case: body not blank, exactly ONE honest telemetry row (the dev re-bubble dedupe works — the single
React dev console error is re-bubbled but NOT double-counted), and "Try again" restores the pane.
**Containment HOLDS** for all four wraps, matching 330_6.

---

## 5. UI4 — browser keyed action: **OWED** (evidence below)

Lane 331-1 landed during this session (`fixes/331_1_keywright.md` exists; `key-resolution.ts`,
`one-shot-fetch.server.ts`, `errors.ts` codes, `rapidtool-cli.mjs`). Its log proves the **CLI** keyed path
green (`crew … ok:true`, tokens billed, no libuv abort). I restarted the dev server to load the landed
code, then performed **one bounded keyed action in the browser** ("Spawn crew") on a fresh build
(`crew.mjs`). Result:

```
UI error: Crew run did not start (error): a crew call failed mid-run — DeepSeek API key is invalid
  (HTTP 401: Authentication Fails, Your api key: ****42ff is invalid (request_id: b42e…))
  — requested model: "deepseek-v4-flash" — key source: the process environment (tail …42ff)
crew server-fn envelope: { ok:false, reason:"error", code:"RT_E_LLM_KEY_REJECTED", error:"…tail …42ff…" }
```

- **Real model text: NOT obtained. This is owed.** Tokens billed: **0** (401 before completion). The
  action is bounded: exactly **1** crew server-fn call.
- **Why:** 331-1's `key-resolution.ts` is explicitly pure — "the physical `.env` read lives in the caller
  (`scripts/rapidtool-cli.mjs`)" — so its precedence fix covers the **CLI only**. The browser path runs
  server functions inside the Vite dev server, whose `process.env.DEEPSEEK_API_KEY` is the stale
  Windows-User-scope value (tail `…42ff`); `with-app-env.mjs` loads only `VITE_*` from
  `.grok/app-env.json` and never `.env`. So the app-server path still sends `…42ff` and 401s.
- **Partial win:** 331-1's coded rejection IS visible end-to-end in the browser — the 401 is now
  `RT_E_LLM_KEY_REJECTED` (was `RT_E_UNKNOWN`/prose) and names the source + tail-only. The UI's
  `onSpawnCrew` message does not surface the `code`, but the server envelope carries it.
- The header chip still reads **`configured`** while every keyed action 401s (same finding 330_6 reported);
  that status probe lives in `src/lib/store.ts` / the server module — **not my file → STOP-and-REPORT.**

---

## 6. Required route + viewport sweep

**Desktop 1440×900** (`flows.mjs`): `/` (intake, templates, Builds list, help), `/run/<id>` (13-phase rail,
3 primary tabs, all controls), `/run/<bad-id>` → honest `This build doesn't exist or was archived.`,
`/run` (no param) → `Page not found`, unmatched `/no-such-route-xyz` → `Page not found`. The only 4xx are
the two unmatched URLs themselves (expected). 0 console/page errors on the healthy paths.

**Mobile 390×844** (`mobile.mjs`, hasTouch): home and run both `docScrollWidth == 390` — **0 horizontal
overflow**; the phase rail scrolls *inside* its own track (`scrollWidth 2044` in a `390` scroller) instead
of blowing out the page; header visible; 3 tabs; the sidebar is a slide-over — the `aria-controls="run-sidebar"`
toggle opens it (`visible before false → after true`) and the in-drawer "Close" dismisses it.

---

## 7. Regression sweep (surrounding flows, not the happy path)

`regress.mjs` + `export.mjs`, desktop: create build → **Execute P0** → artifacts `All · 0 → 9` (`P0 · 8`,
`P1 · 1`); **Run to next gate** → `All · 16` (`P1 · 2`); Guide dialog, Settings dialog, command palette
(Ctrl+K, real entries "Approve the waiting gate" / "Run to the next gate"), packet tab select — all work;
Export menu lists `Agent packet / Phase handoff / Packet file (.md) / Build file (.json) / Build JSON`, and
**Build file (.json)** downloads `northwind-dispatch.json`. **0 console errors / 0 page errors / 0 HTTP≥400**
across the sweep. The only `requestfailed` is the host-injected `https://grok.com/grok-app-builder/extensions.js`
(`net::ERR_ABORTED`) — not an app resource.

Because this lane made **no edits**, there is no new regression surface; the sweep confirms the surrounding
flows still behave on the current (sibling-modified) tree.

---

## 8. Gates (targeted only — no full gate per wave rules)

| Check | Result |
|---|---|
| `npx eslint src/components/console.tsx src/routes/index.tsx src/routes/run.$id.tsx src/routes/__root.tsx` | **exit 0**, no output |
| non-null assertions in `console.tsx` | **0** (hard rule held; machine count 0) |
| `npm run typecheck` | **NOT run** — whole-project; five siblings mid-edit. My owned files are byte-identical to the green baseline (no edits), so their type state is unchanged. |

---

## 9. What I did NOT do / owed / STOP-and-REPORT

1. **No edits.** UI1/UI2/UI3 were already landed (`2fa3cd9`, +`330_6` for f12); re-landing would be
   duplicate churn. Proof only.
2. **UI4 owed** (§5): the browser keyed path still 401s on the stale process-env key. The fix needed is in
   **`with-app-env.mjs` (331-6) and/or 331-1's provider/`.env` seam**, not my files — I did not reach across.
3. **`llmStatus` "configured" with a rejected key** — `src/lib/store.ts` / server probe, not my file.
4. **Export copy-vs-download** must be addressed by menu label, not `download` (there is no "Download"
   label); noted so the next harness does not chase a phantom.
5. Harness gotchas recorded: (a) `fill()` does not drive this app's controlled fields — focus +
   `keyboard.type`; (b) `getByRole(name)` is substring + matches the tablist's `aria-label` text, so use
   `exact: true` for header buttons; (c) a fully-synchronous double `click()` is the right double-run probe
   (Playwright `dblclick` respects the disabled attribute); (d) seed a required store field via a
   Playwright `addInitScript` (localStorage) rather than racing the app's own persist write.

**Dev server stopped**; harness + screenshots live only under `%TEMP%\rt331_chrome\` — nothing committed
into the repo (`.rapidtool/logs`, screenshots, and temp artifacts all excluded).
