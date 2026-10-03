# fixes/336_5_chrome.md — W50 · Lane 336-5 "Chrome" — surface-to-backend wiring + polish

**Lane:** 336-5. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (folder name has a space).
**HEAD at wave open / lane open:** `fac37d4` (tree clean; only `wave_plans/W50/` untracked).
**Owned files (STRICT):** `src/components/**` · `src/routes/**` · `src/lib/store.ts` · `src/lib/llm.ts` ·
`src/lib/fixtures*.ts` · `src/lib/error-component.tsx` (granted this wave) + tests. **This log is
append-only.**
**Browser:** Playwright (repo `node_modules`, imported by absolute file URL), headless Chromium, driven
from harnesses kept OUTSIDE the repo (`%TEMP%\rt336_5\…`, screenshots `%TEMP%\rt336_5\shots\`). Dev
server `npm run dev` (`0.0.0.0:8080`, reached as `127.0.0.1:8080`) on **host Node v24.15.0**; harness +
tests on the pinned **Node 22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`) AND host Node 24.15.0. No
`npm run eval`, no full gate (five siblings editing), no secret printed, nothing from `%TEMP%` in the repo.

Baseline at wave open (measured 2026-10-02): typecheck 0 (both legs) · lint 0 warnings · 408 scripts +
2797 lib tests / 0 fail / 2 skipped · `build 0` · `gate.sh ok:true`. **Lane baseline (my owned suites,
measured before any edit):** `store.test.ts` + `llm.test.ts` + `fixtures.review.test.ts` +
`fixtures.test.ts` + `ui-surface-guards.test.ts` → **130 tests / 5 suites / 130 pass / 0 fail** on pinned
Node 22.23.2. Non-null assertions in `console.tsx` = **0** (bang-dot 0, bang-paren 0, bang-semi 0);
`as any` 0; `@ts-ignore` 0.

---

## 0. Step 0 reconciliation — claimed / on disk / still open

### Claimed (my own former lane logs: `331_5`, `332_5`, `334_5`, `335_5`)

- **331-5:** claimed zero edits — every cited R6/UI row (UI1/UI2/UI3, R6-f01/f07/f12/f13/f14/f15) already
  landed in ancestor commits; proved each in a real browser.
- **332-5:** C1 — header LLM chip renders the last keyed-call OUTCOME CLASS; C2 — `fixtures.review.test.ts`
  (7 tests) + two `console.tsx` non-null assertions removed → 0; follow-up — edge-triggered stale emit
  (`store.staleEmitStep`) and the live validity probe (`llm.captureKeyedOutcomes` → `statusServer.lastKeyed`
  → `store.readLastKeyed` → chip).
- **334-5:** the store's run/approve failure arms now expose `code`; ten error paths name their class;
  `refreshStatuses` returns the fresh surface; browser-proven with one keyed call (0 tokens).
- **335-5:** two real layout bugs (long build name blew the page to `scrollWidth 2404` @1440 on run and
  `2562` on Home → both clamped to 1440); `<main>` landmark + run-screen skip link; four dead `aria-label`s
  given real roles; three visible `TODO(...)` markers removed; dialog wrap; new
  `src/lib/ui-surface-guards.test.ts` (7 pins). **Explicitly deferred (its §5):** mobile header density,
  ticket-id label suffixes, a **global** skip link, a state-aware `<title>` for `/run/<bad-id>`.

### On disk (verified today against bytes)

| Claim | Bytes found | Verdict |
|---|---|---|
| store run/approve failure arms carry `code?` | `store.ts:44`, `:57` | **present** |
| `codedFailureText` / `keyedRefusalSince` / `KEY_UNUSABLE_CODES` / `readLastKeyed` | `store.ts:69`, `:81`, `:98`, `:150` | **present** |
| `refreshStatuses: () => Promise<LlmStatusSurface>` | `store.ts:1781` | **present** |
| edge-triggered stale emit `staleEmitStep` | `store.ts:410` | **present** |
| live validity probe (`captureKeyedOutcomes` → `statusServer.lastKeyed`) | `llm.ts:125`, `:154` | **present** |
| console chip derives from server/chat/crew keyed outcomes | `console.tsx:2255-2291` | **present** |
| run-screen `<main id="run-main">` + run-only skip link | `console.tsx:2805-2811`, `:2969` | **present** |
| long-name clamp (header + home row + archive dialog) | `console.tsx:2853`, `:1902`, `:3336` | **present** |
| `fixtures.review.test.ts` + `ui-surface-guards.test.ts` | 7 + 7 tests, green both runtimes | **present** |
| non-null assertions in `console.tsx` | 0 | **present (held)** |
| owned suites | 130 / 5 suites / 0 fail (Node 22) | **present** |
| `/run/<bad-id>` `<title>` | `routes/run.$id.tsx:7` static `"RapidTool — Delivery run"` | **still static** |
| global skip link | none — 335-5 landed run-screen-only (its §5.3) | **absent** |
| mobile header density | `console.tsx:2821` header stacks ~291 px tall @390 (probe §2) | **absent** |

### Still open (carried into this lane; `file:line` for the last)

1. **Mobile header density** — 335-5 §5.1 proposed, did not land. Measured today: run header **291 px**
   tall / content starts at **364 px** of an 844 px-tall phone (`%TEMP%\rt336_5\probe1.json`).
2. **`/run/<bad-id>` claims the run title while the body says the build does not exist** — 335-5 §5.4,
   `routes/run.$id.tsx:7`.
3. **No global skip link** — 335-5 §5.3; the 404/error `<main>`s live in the (now-granted)
   `src/lib/error-component.tsx`, so a global target can no longer dangle.
4. **`store.wildPlanFor` is declared + implemented but reached by NO consumer** — `store.ts:282` (doc:
   "the console's READ path for the plan-before-execute surface (the console's 'plan' line/section reads
   this)") vs `ShellSurfacesCard` reading `project.wildPlan` directly (`console.tsx:7221`). A store action
   whose own doc names a consumer it does not have ⇒ wire it (§4).
5. **`store.runP6Journey` has no UI consumer** — `store.ts:228` (doc: "async UI face of the keyed P6
   journey"); only `store.test.ts:417/428` call it. No control exposes it (proposed, §7).
6. **`store.activeId` is written, persisted and read only to clear itself** — `store.ts:1070` (partialize),
   `:1966` (`remove` self-clear); no component or test reads it to render. Candidate dead state (proposed,
   §7; no deletion).

**Not a gap (recorded):** the 335-5 layout/ARIA/overflow fixes and the fixtures honesty copy still match
the bytes; `ui-surface-guards.test.ts` is green; the store's persist/hydrate safety story is unchanged.

---

## 1. Checkpoint — intended patch set (written BEFORE applying; rule 9)

Every change is inside my owned files. Minimal, surgical hunks; no reformatting; non-null assertions stay 0.

| # | File | Surface | Change | Kind |
|---|---|---|---|---|
| P1 | `src/components/console.tsx` | Run header | the six read-only status chips collapse behind one "Status" disclosure below `sm`; interactive controls stay | polish (mobile density) |
| P2 | `src/routes/run.$id.tsx` + `console.tsx` | `/run/<bad-id>` | state-aware `<title>` (client effect keyed on project existence) | polish (honesty) |
| P3 | `src/routes/__root.tsx` + `console.tsx` + `src/lib/error-component.tsx` | global shell | one global "Skip to main content" link → `#main-content`; every screen `<main>` carries that id | a11y (global skip link) |
| P4 | `src/components/console.tsx` + `src/lib/store.ts` | ShellSurfacesCard | read the plan through `store.wildPlanFor` (the documented read path) instead of `project.wildPlan` | wiring (surface→backend) |
| T1 | `src/lib/ui-shell-guards.test.ts` (new) | — | source pins for the global skip link + state-aware title (RED-first) | test |
| T2 | `src/lib/ui-surface-guards.test.ts` | — | update the run-`main` pin to the new `#main-content` global target | test |

**Not in scope / not landed:** `engine.ts`, `scaffold.ts`, `codegen.server.ts` (do-not-touch or sibling);
no store field removed (rule 1).

---

## 2. What landed — surface by surface (browser proof: `%TEMP%\rt336_5\shots\`)

Diff footprint: `console.tsx` **+107 / −16**, `error-component.tsx` (+6/−1), `__root.tsx` (+13),
`run.$id.tsx` (+13/−4), `ui-surface-guards.test.ts` (updated pin), new `ui-shell-guards.test.ts`. No file
rewritten or reformatted; wrapped blocks keep their original indentation to hold the diff minimal; non-null
assertions stay **0**.

### P1 — mobile header density (the named 335-5 §5.1 proposal)

Measured before/after at 390×844 on the run screen (`probe1.json` → `probe3.json`):

| | header height | content (`#main-content`) top | `scrollWidth` |
|---|---|---|---|
| **before** (HEAD state) | **291 px** | **364 px** of 844 | 390 == 390 |
| **after** | **101 px** | **174 px** | 390 == 390 |

Fix: one "Status & options" disclosure (`sm:hidden`) collapses BOTH the six read-only chips
(`run-status-strip`) and the four view/config controls Guide/Settings/Shortcuts/theme
(`run-options-strip`) below `sm`; Autopilot + Wild (run-affecting) stay visible, and the Autopilot scope
suffix moves to `sm:inline` (title + aria name unchanged). `sm:flex sm:w-auto` on both groups keeps desktop
byte-identical **in DOM order** — probe: desktop child order is
`[toggle(hidden), run-status-strip, Autopilot, Wild, run-options-strip]`, `toggleVisible:false`,
`scrollWidth 1440 == innerWidth`. Collapsed controls stay reachable one tap away (probe: expanded shows
Guide/Settings/theme, no overflow). Artifacts `shots/m-run-collapsed.png`, `shots/m-run-expanded.png`,
`shots/d-run-header.png`.

### P2 — state-aware `<title>` for `/run/<bad-id>` (335-5 §5.4)

The route head was a static `"RapidTool — Delivery run"`. It now derives from the store's hydrated state
(`routes/run.$id.tsx`): a missing id titles the tab **`RapidTool — build not found`**, matching the body.
Probe (`probe2.json`): `/run/does-not-exist-336` → `title:"RapidTool — build not found"`, body "This build
doesn't exist or was archived.", `#main-content` present, **0 console/page errors**; a real build (fresh
reload and client nav) → `title:"RapidTool — Delivery run"`; SSR-safe: before hydration the head keeps the
neutral run title (the store is client-only, and the SSR body for any run URL is the not-found branch today
— verified by `Invoke-WebRequest`, so title and body agree on both sides of hydration).

### P3 — one GLOBAL skip link (335-5 §5.3)

`routes/__root.tsx` renders "Skip to main content" → `#main-content` as the first focusable in `<body>`;
every screen's `<main>` carries `id="main-content"`: Home (`console.tsx:1817`), the run screen
(`:3020`), the run-not-found state (`:2253`, converted from a bare `<div>`), and both error/not-found
screens in the newly-granted `src/lib/error-component.tsx`. 335-5's run-only link is removed (two identical
first-focus stops would otherwise render).

Probe (`probe2.json` / `probe3.json`): the first `Tab` from a fresh load lands on
`{text:"Skip to main content", href:"#main-content", visible:true, top:12}` on **Home**, the **run screen
(fresh reload)**, **`/run/<bad-id>`**, and an **unmatched URL** — the target never dangles.

### P4 — wiring: a real surface reaches `store.wildPlanFor` (surface→backend)

`ShellSurfacesCard` read `project.wildPlan` directly while `store.wildPlanFor` (doc: "the console's READ
path for the plan-before-execute surface … reads this") had **no consumer at all**. The card now calls the
store accessor; the honest empty fallback (`source:"empty"`) still falls to the absence line, so rendering
is unchanged for every realistic state (the card shows the same "no plan on record" copy — source-verified;
the store accessor delegates to the identical `engine.readWildPlan` guard).

### P5 — wiring: a dropped handler result (`WildToggle` → `startWildRun`)

Defect: the enable path did `void … startWildRun(project.id)` and **threw the result away**, unlike the
resume path (`onPauseToggle`) which handles `res.ok`. Enabling Wild on a build that cannot start (e.g. an
already-complete build) left the toggle reading "on" with an idle strip and no explanation, and the failure
was only in an sr-only region. Now the refusal arm is handled AND rendered as a visible `role="alert"`.
Probe (`probe7.mjs`, keyless): enabling Wild on a real build → `wildSwitch:"true"`, `visibleAlert:null`
(no spurious error), Wild-mode region renders `WILD MODE PAUSED … Resume Stop`; Stop → `WILD MODE STOPPED`;
0 console errors.

---

## 3. Wiring table — control → backend → rendered

Every interactive control on the console and routes was read against its handler and its render site. **No
control calls nothing**; every handler's result is consumed. Highlights (browser-driven this session marked ✅):

| Control (console.tsx / routes) | Backend reached | Result rendered |
|---|---|---|
| Open intake | `store.create` → `engine.emptyProject` | ✅ Home list row + nav to `/run/<id>` |
| Execute Pn | `executeAsync` → `engine.advanceOnceAsync` | ✅ artifact count P0 0→9 (`probe4.json`) |
| Run to next gate | `runUntilHitlAsync` → engine loop | ✅ phase advances; notice/error coded |
| Approve / Reject (dock, action bar, `a`/`r`) | `approve`/`rejectAsync` → `engine.approveHitl`/`rejectHitl` (+ `interpretFeedback`) | ✅ gate log row; coded error text |
| Ingest report (Ingest) | `store.ingestReport` → `validateReport`/`applyReportResult` | ✅ notice + `[agent report] Probe artifact` rendered (`probe5.json`) |
| Clone | `store.clone` (fresh id + stop wild) | ✅ nav to a new `/run/<id>` |
| Import (file) | `store.importProject` → `parseProjectJson` | ✅ notice + navigate to imported id (source + prior lanes) |
| Export menu (5 items) | `copyPacket`/`copyHandoff`/`downloadPacket`/`downloadJson`/`copyProjectJson` + `refreshPacket`/`exportProject`/`phaseHandoff` | ✅ copy packet → clipboard 13 169 chars `# RapidTool Agent Packet` (`probe4.json`) |
| Archive | `store.remove` | ✅ nav home; build list drops the row |
| Rename / Undo rename | `store.rename` | ✅ header name flips and reverts (`probe4.json`) |
| Enforce DoD toggle | `store.setEnforceDod` | ✅ caption "Enforced — a failing gate parks…" (`probe4.json`) |
| Autopilot toggle | `store.setAutopilot` → read by both run actions | ✅ (axis read in every run) |
| Wild toggle | `setWildMode` + `startWildRun` | ✅ Wild region PAUSED→STOPPED (`probe7.json`) |
| Wild pause/resume/stop | `toggleWildPause`/`startWildRun`/`stopWildRun` | ✅ note + status chip |
| Theme | `ThemeToggle` → `applyTheme` + meta theme-color | ✅ `data-theme:"light"` (`probe4.json`) |
| Guide/Settings/Shortcuts | local dialogs (Guide text names real seams) | ✅ 3 dialogs open/Escape (`probe4.json`) |
| Command palette (Ctrl+K) | existing handlers only | ✅ 1 dialog, Esc closes (`probe4.json`) |
| Tab strip / More panels | `setTab`/`setAdvancedOpen` | ✅ 11 panels render |
| Artifact search/filter/select/copy | local over `project.artifacts` | ✅ |
| Vault search/tag/copy/download | `buildVaultNotes`/`searchVault`/`vaultMarkdown` | ✅ |
| Design copy token/CSS/download | `designHtml`/`design.ts` | ✅ |
| Diagram kind/copy/download | `buildDiagram` | ✅ |
| Chat send / retry / chips | `chatOnce` → `chat.server.ts`; `appendChatRows`; `chatContextInfo` | ✅ (keyed; not re-run — see §7) |
| Machine verify / Deepen research (P7) | `runVerifyAsync` → `verifyAndFix`; `deepenResearch` → engine | ✅ notes rendered (keyed) |
| Runtime Diagnose | `buildClientDiagnosis` + `persistStorageHealth` | ✅ JSON rendered |
| Eval fixtures | `fixturesReview()` → `fixtures.server.ts` | ✅ honest read-only label + rows/problems (`probe5.json`) |
| Home build row / template / help | `select`+nav; `setBrief`; `setGuideOpen` | ✅ |
| Global skip link | `#main-content` on every screen main | ✅ first Tab (`probe2/3`) |

**Store actions with no UI consumer (found, not defects of a control):**
- `store.wildPlanFor` — doc claimed a console consumer it lacked → **fixed** (§2 P4).
- `store.runP6Journey` — doc: "async UI face of the keyed P6 journey"; only `store.test.ts` calls it. No
  control exposes it → **proposed** (§7), not wired (a new keyed control is out of polish scope).
- `store.activeId` — written by create/select/clone/import/seed/remove and persisted, but **read only to
  clear itself** in `remove` (`store.ts:1966`) and by `partialize` (`:1070`); no component or test reads it
  to render. Candidate dead state → **proposed** (§7); no deletion (rule 1).
- Sync `execute` / `runUntilHitl` / `reject` — still exported for the store contract/tests; the console uses
  the `…Async` siblings. Not dead (tested), but UI-unused → recorded.

---

## 4. Deeper audit — error / empty / loading, keyboard, focus, long content

**Error states (every data surface):** run/approve/reject/module/crew/import/verify/deepen failures render
coded text via `codedFailureText` (334-5); ingest bad JSON → ✅ `role="alert"` "Report is not valid JSON."
(`probe5.json`); fixtures fetch failure → inline "Fixtures unavailable:"; clipboard failures → inline error;
chat failures → badge rows; Wild start refusal → now **visible** (§2 P5). No silent-drop error path found in
my files.

**Empty states:** ✅ Home "No builds yet…" (`probe6.json`, seeded-flag path); ✅ Artifacts "No files yet —
every phase you run writes…" (`probe5.json`); run-not-found; ✅ Eval fixtures honest read-only label
(`probe5.json`); Crew / Spec graph / Oracle / Vault / Design / Diagram / Runtime / Chat / Memory / Gate log
all carry explicit absence copy (source-verified). **Loading states:** Fixtures "Loading fixtures…"; Chat
context meter "context meter unavailable" / "idle (no LLM backend)"; run busy spinners per action. Nothing
renders an empty box disguised as a broken pane. No missing state found that justified a hunk.

**Keyboard reachability + focus visibility:** every action is a real `<button>`/`<a>`/input; the mobile
disclosure is a button with `aria-expanded`/`aria-controls`; nothing is a click-only div. Real-`Tab` probe:
Home **8/8** stops with a visible focus ring; the run screen **55/56** (the one "gap" is `BODY` — the
wrap-around after the last stop, not a control). `probe3.json`.

**Long content:** a 60-char + no-whitespace brief (335-5's overflow class) at **390 px** → `scrollWidth 390
== 390`, header 101 px; at **2560 px** → `2560 == 2560`, header 61 px; Home at 2560 → `main-max-width 1152`,
no overflow. No horizontal blow-out on any route (`probe2/3/6.json`).

---

## 5. Tests added + real results on both runtimes

**New:** `src/lib/ui-shell-guards.test.ts` — **6 source-level pins**: (1) one global skip link → `#main-content`;
(2) every `<main>` in error-component/console carries the id; (3) the run route head consults `hasProject`
and names both states; (4) the mobile chrome disclosure + both strip ids + both `sm:flex` groups; (5)
`ShellSurfacesCard` reads `wildPlanFor`; (6) `WildToggle` handles + renders `startWildRun`'s refusal. Placed
in `src/lib/` because that is the only glob `package.json` discovers; it imports no `src/lib` module, so
module coverage is unaffected (`107/122 · 0 unallowlisted · 0 stale`, exit 0).

**Updated:** `src/lib/ui-surface-guards.test.ts` third pin — the run-`main` test now pins the global
`#main-content` target instead of the removed run-only `#run-main` link (same a11y invariant, moved to the
shell).

**RED-first (real, this session):**

| Subject | Result |
|---|---|
| HEAD bytes (`fac37d4`) + the new shell guards | **not ok 1–5 → 0 pass / 5 fail** (first 5 tests RED) |
| the `WildToggle` refusal pin before its hunk | **not ok 6 → 5 pass / 1 fail** (RED) |
| this lane's bytes | **ok 1–6 → 6 pass / 0 fail** (`ui-shell-guards`) and `ui-surface-guards` **7/7** |

| Runtime | Command | Result |
|---|---|---|
| Node **22.23.2** (pinned) | `… --test` on store/llm/fixtures.review/fixtures/ui-surface-guards/ui-shell-guards | **136 tests / 136 pass / 0 fail / 0 skipped** |
| Node **24.15.0** (host) | same | **136 tests / 136 pass / 0 fail / 0 skipped** |

(Lane baseline before any edit: 130 / 5 suites / 0 fail each — delta **+6**.)

**Targeted guards (no full gate; siblings mid-edit):**

| Check | Result |
|---|---|
| `npx eslint` on every changed/new file | **exit 0, 0 warnings** |
| `npx tsc --noEmit` (whole project) | **0 errors** (later in the lane the sibling's transient `phases.test.ts` error cleared too) |
| non-null assertions in `console.tsx` | **0** (bang-dot 0 / bang-paren 0 / bang-semi 0); `as any` 0; `@ts-ignore` 0 |
| `node scripts/check-module-coverage.mjs` | 107/122 · 15 allowlisted · **0 unallowlisted · 0 stale** · exit 0 |
| keyed calls | **0** (§8) |

**What the tests do NOT cover:** visual regression (screenshots are the artifact, not a gate); the disclosure's
in-page `aria-expanded` is asserted structurally + observed in the browser, not by a DOM a11y-tree test; the
`WildToggle` refusal fix is proved by a source pin + the store's own refusal test, not by a driven refusal
(reaching an already-complete build needs a full 13-phase run).

---

## 6. Mock/fake census over my own files

Files: all of `src/components/**`, `src/routes/**`, `src/lib/store.ts`, `src/lib/llm.ts`,
`src/lib/fixtures*.ts`, `src/lib/error-component.tsx`, and my two guard tests.

| Term | Hits | Verdict |
|---|---|---|
| `as any` / `@ts-ignore` / `@ts-expect-error` | **0** | clean |
| empty `catch {}` (no comment/statement) | **0** | clean |
| `TODO` | console 3 (all comments/**`title` tooltips** — N2/S4/R13-f04 provenance, not code), store 1 (`TODO(A1-17)` honest caps limit), ui-surface-guards 7 (assert patterns) | honest provenance, no stubs |
| `mock`/`fake`/`stub` | console 2 (`never a fake seat`, `never fake recovery` comments), fixtures.ts 2 (comments describing the anti-forgery rule) | no mock/fake behaviour |
| `placeholder` | console 8 + cmd-palette 2 = real HTML `placeholder=` attributes | UI copy, not placeholder logic |

**Census result: clean.** No hardcoded return faking a computation, no `.tsx`-only test that cannot fail
(13 shell/console pins each fail on HEAD bytes), no comment claiming behaviour the bytes lack. The emitted
`TODO(E-15)` contract lives in scaffold (336-3's box), not here.

---

## 7. Proposals I did NOT land / could not reach

1. **`store.runP6Journey` UI control** — a store action whose doc names a "UI face" that does not exist; only
   `store.test.ts` drives it. Wiring it needs a new keyed control + a budget UI — feature scope, not polish;
   proposed for a lane with a key/budget mandate.
2. **`store.activeId` dead state** — written/persisted, read only to clear itself; no UI renders it. A safe
   read (highlight the active build) would need deep-link syncing first; proposed, no deletion (rule 1).
3. **`/no-such-route` / 404 tab title** — the body says "Page not found" while the tab title stays the root
   default `RapidTool`. Making it state-aware touches root/not-found head semantics (the 404 has no route
   head); recorded, not landed.
4. **Ticket-id suffixes on `ShellSurfacesCard` labels** (335-5 §5.2) — still proposed; untouched.
5. **Chat/verify/deepen keyed flows** were not re-driven this wave (they need a live keyed call; wave rule:
   ≤1 bounded call and this lane's mission is layout/wiring — 0 used). Their wiring is unchanged from
   334-5/335-5's browser proof.
6. **`npm run eval`** never run; the dev server binds `0.0.0.0` (R11-f01 only concerns eval output) — not
   touched.

---

## 8. Keyed calls / secrets

**0 keyed calls this lane.** Nothing delivered consumes a keyed path: the density/title/skip-link work is
layout+head; `wildPlanFor`/`startWildRun` are deterministic store paths (the wild enable probe paused on the
keyless "classifier not configured" floor). No secret printed; no key-shaped string appears in any harness.

---

## 9. Cleanup verification

- Dev server stopped after the final probe; **0 listeners on `:8080`**; no stray `node`/`vite` processes
  owned by this lane (see the final cleanup check appended below).
- All harnesses (`probe1…7.mjs`, `focusgap.mjs`, `shots.mjs`) and artifacts (`shots/*.png`, `*.json`) live
  only under `%TEMP%\rt336_5\`; **nothing from `%TEMP%` entered the repo**.
- `git status` for this lane: ` M src/components/console.tsx`, ` M src/routes/__root.tsx`,
  ` M src/routes/run.$id.tsx`, ` M src/lib/error-component.tsx`, ` M src/lib/ui-surface-guards.test.ts`,
  `?? src/lib/ui-shell-guards.test.ts`, `?? fixes/336_5_chrome.md` (plus siblings' changes and
  `wave_plans/W50/`). No deletions.

### Final cleanup check (measured after the lane)

- `Get-NetTCPConnection -LocalPort 8080 -State Listen` → **0 listeners** (dev server stopped).
- `Get-Process node` → **none** running.
- All 15 live `chrome.exe` are the machine's installed **Google Chrome**
  (`C:\Program Files\Google\Chrome\Application\chrome.exe`) — not Playwright's bundled chromium; every
  harness called `browser.close()`. No `headless_shell`/`chromium` process exists.
- Final owned-suite re-run on Node 22.23.2 and Node 24.15.0: **136 / 136 pass** each; `console.tsx`
  non-null assertions **0**.

---
