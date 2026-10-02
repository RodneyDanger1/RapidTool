# fixes/335_5_chrome.md — W49 · Lane 335-5 "Chrome" — UI polish, a11y, honesty

**Lane:** 335-5. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (folder name has a space).
**HEAD at wave open / lane open:** `9cff073` (tree clean; only `wave_plans/W49/` untracked).
**Owned files (STRICT):** `src/components/**` · `src/routes/**` · `src/lib/fixtures*.ts` ·
`src/lib/store.ts` · `src/lib/llm.ts` + tests. **This log is append-only.**
**Browser:** Playwright (repo `node_modules`), headless Chromium, driven from harnesses kept OUTSIDE the
repo (`%TEMP%\rt335_5\…`, screenshots in `%TEMP%\rt335_5\shots\`). Dev server `npm run dev`
(`0.0.0.0:8080`, reached as `127.0.0.1:8080`) on **host Node v24.15.0**; harness + tests on **pinned
Node 22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`) AND host Node 24.15.0. No `npm run eval`, no full
gate, no secret printed, nothing committed from `%TEMP%`.

Baseline at wave open (measured): typecheck 0 (both legs) · lint 0 warnings · 405 scripts + 2771 lib tests
/ 0 fail. **Lane baseline (my owned suites, measured before any edit):** `store.test.ts` + `llm.test.ts` +
`fixtures.review.test.ts` + `fixtures.test.ts` → **123 tests / 5 suites / 123 pass / 0 fail** on pinned
Node 22.23.2. Non-null assertions in `console.tsx` = **0** (bang-dot 0, bang-paren 0, bang-semi 0).

---

## 0. Step 0 reconciliation — claimed / on disk / still open

### Claimed (my own former lane logs: `331_5`, `332_5`, `334_5`)

- **331-5:** claimed zero edits — every cited R6/UI row (UI1/UI2/UI3, R6-f01/f07/f12/f13/f14/f15) already
  landed in ancestor commits; proved each in a real browser. Noted open: keyed failures expose no `code`.
- **332-5 (+ follow-up):** C1 — header LLM chip renders the last keyed-call OUTCOME CLASS; C2 — new
  `fixtures.review.test.ts` (7 tests) + two `console.tsx` non-null assertions removed → 0; follow-up —
  edge-triggered stale emit (`store.staleEmitStep`) and the live validity probe
  (`llm.captureKeyedOutcomes` → `statusServer.lastKeyed` → `store.readLastKeyed` → chip).
- **334-5:** the store's run/approve failure arms now expose `code`; ten error paths name their class;
  `refreshStatuses` returns the fresh surface; browser-proven with one keyed call (0 tokens).

### On disk (verified today against bytes)

| Claim | Bytes found | Verdict |
|---|---|---|
| store run/approve failure arms carry `code?: ErrorCode` | `store.ts:50`, `:64`, `:134`, `:139`, `:215`, `:244`, `:250` | **present** |
| `codedFailureText` / `keyedRefusalSince` / `KEY_UNUSABLE_CODES` / `readLastKeyed` | `store.ts:69`, `:81`, `:98`, `:150` | **present** |
| `refreshStatuses: () => Promise<LlmStatusSurface>` | `store.ts:206`; maps `lastKeyed` at `:1802` | **present** |
| edge-triggered stale emit `staleEmitStep` | `store.ts:410` | **present** |
| live validity probe (`captureKeyedOutcomes` → `statusServer.lastKeyed`) | `llm.ts:125`, `:147`, `:164` | **present** |
| console consumes coded text + probes + chip | Console is 7038 lines; chip derivation present (334-5 proof stands) | **present** |
| non-null assertions in `console.tsx` | 0 (bang-dot 0 / bang-paren 0 / bang-semi 0) | **present (held)** |
| owned suites | 123 tests / 5 suites / 123 pass / 0 fail (Node 22) | **present** |
| fixtures copy honest | `fixtures.ts:19` / `fixtures.server.ts:24` + console copy all say "read-only review … approval is a CLI action … records no decision"; loader has no write path | **matches bytes** |
| R6-f01/f07/f12/f13/f14/f15 | present (331-5 browser proof; not re-landed) | **held** |

### Still open (carried; with `file:line`)

1. **`RunResult`/`ApproveResult` keyed failures now DO expose `code`** — the 331-5/332-5 residue is
   closed by 334-5. Nothing open here.
2. **A keyed run's 401 cannot be re-run with the console REVERTED** without a second keyed call (wave
   rule: ≤1 keyed call/lane). Before-state rests on the pre-change bytes + fails-before tests (334-5 §1).
3. **The validity-probe tap is process-global module state** (`llm.ts:121`) — correct for this
   single-user local console, bounded by server-process/module lifetime. Not a console defect; recorded.
4. **`scripts/check-module-coverage.mjs` allowlist** — 332-5's stale-entry request was closed by 332-6
   (333-2 verified 0 unallowlisted gaps). Nothing open.
5. **`AR6`** is not a register token anywhere in the repo (only lane briefs use it) — inferred `§R6`
   (`research/multiagent/thoroughanalysis.md:1371-1385`), as 332-5 recorded.

**Not a gap (recorded):** the fixtures review copy, the acceptance-fixtures banner (`console.tsx:609`),
and the ShellSurfacesCard honesty rows (`console.tsx:7199`) still match the bytes.

---

## 1. Checkpoint — intended patch set (written BEFORE applying; rule 9)

Every change is inside `src/components/console.tsx` (owned) except the new guard test. Browser evidence is
paired with each. Minimal, surgical hunks; no reformatting; non-null assertions stay 0.

| # | Surface | Change | Kind |
|---|---|---|---|
| P1 | Run header | long build name overflowed the page (**measured `scrollWidth 2404` @ `innerWidth 1440`**): `min-w-0` on the header group + `max-w`/`truncate` on the name button | **real bug** |
| P2 | Home build list | long build name overflowed the aside (**measured `scrollWidth 2562` @ `1440`**): `min-w-0` + `[overflow-wrap:anywhere]` on the row | **real bug** |
| P3 | Run screen | add a `<main>` landmark (run screen had HEADER/NAV/ASIDE but **no MAIN**; Home already has one) | a11y (landmark) |
| P4 | Run screen | add a "Skip to main content" link as the first focusable, targeting the new main | a11y (keyboard) |
| P5 | `PhaseProgressRail` | `aria-label="Phase progress"` sat on a plain `<div>` (generic role ⇒ **label dropped by AT**) → `<section aria-label>` | a11y (ARIA) |
| P6 | Vault tag filter | `aria-label="Filter vault notes by tag"` on a plain `<div>` → `role="group"` | a11y (ARIA) |
| P7 | Diagram pane | `aria-label="{kind} diagram"` on a plain `<div>` → `role="group"` | a11y (ARIA) |
| P8 | Chat error badge | `aria-label` on a plain `<span>` (generic role ⇒ dropped) → `role="img"` so the code's meaning is announced | a11y (ARIA) |
| P9 | ShellSurfacesCard | three **user-visible `TODO(...)` markers** ("(TODO(N2))", "TODO(seat)", "TODO(R13-f04)") leak internal engineering notes to the operator — removed; the honest limitation sentences stay | polish / no AI-slop |
| P10 | Archive dialog | long build name in `Archive {name}?` can’t wrap unbroken → `[overflow-wrap:anywhere]` | real bug (long content) |
| T1 | new guard test | `src/lib/ui-surface-guards.test.ts` — static, source-level pins for P1–P9 (the only `src/lib` location the test glob discovers: `package.json` `"test": … "src/lib/**/*.test.ts"`) | RED-first test |

**Broad redesigns deliberately NOT landed (proposed, §7):** mobile header chrome density; ticket-ID
suffixes on ShellSurfaces labels; a global skip-link in `__root.tsx` (the 404 screen's main lives in the
unowned `error-component.tsx`, so a global target would dangle there).

---

## 2. What landed — surface by surface (browser proof: `%TEMP%\rt335_5\shots\`)

Every hunk is in `src/components/console.tsx`; the diff is 49 changed lines across 10 hunks (`git diff --stat`).
No file was rewritten or reformatted; no unrelated code touched; non-null assertions stay 0.

### P1 — RE, the Run header — long build name blew the page out (real bug)
`inferName` (`engine.ts:250`, unowned) turns a whitespace-free brief into a very long project name; the
header rendered it in an uncapped button, so the whole page grew to the name’s width.

| | desktop 1440×900 |
|---|---|
| **before** (`%TEMP%\rt335_5\overflow.mjs`) | `documentElement.scrollWidth 2404` @ `innerWidth 1440`; offenders `DIV.flex.items-center.gap-3 right=2404`, `BUTTON.hidden…sm:inline right=2404 scrollW 2242` |
| **after** (`%TEMP%\rt335_5\verify.mjs`) | `scrollWidth 1440 == 1440`; name control `display:block textOverflow:ellipsis overflow:hidden clientW 662 scrollW 3489 truncated:true` |

Fix: `min-w-0` on the header name group + `title={project.name}` + `max-w-[46vw] min-w-0 truncate … sm:inline-block`
on the name button. The full name stays reachable (title + the rename input). Artifacts
`shots/31-run-long-brief.png` (before) vs `shots/40-skip-link-focused.png` (after).

### P2 — Home build list — same long name blew the aside out (real bug)
| | desktop 1440×900 |
|---|---|
| **before** (`%TEMP%\rt335_5\home_over.mjs`) | `scrollWidth 2562` @ `1440`; offender `ASIDE right=2562`; `ul/li/button right≈2537` |
| **after** (`%TEMP%\rt335_5\p2.mjs`) | `scrollWidth 1440 == 1440`; name span `overflowWrap:"anywhere" clientW 360 scrollW 360` |

Fix: `min-w-0` + `[overflow-wrap:anywhere]` on the row’s text column, `shrink-0` on the chevron, `gap-2`.
Artifacts `shots/32-home-long-name.png` (before) vs `shots/45-home-long-name-fixed.png` (after).

### P3 — the Run screen had header/nav/aside but NO main landmark (a11y)
Browser landmark probe listed `HEADER, NAV[Phases], ASIDE` — no `MAIN` (Home already had `<main>`). The
centre `<section>` became `<main id="run-main" … aria-busy=…>`; siblings (`nav`, `aside`) unchanged.
**After:** `mainCount:1`, `runMain:true`; layout screenshot unchanged (`shots/43-run-normal.png`).

### P4 — no keyboard bypass for the 13-item phase nav (a11y)
Added a first-stop "Skip to main content" link targeting `#run-main`. **After:** first `Tab` from a fresh
load → `{text:"Skip to main content", href:"#run-main", visible:true, top:12, left:12}`; screenshot
`shots/40-skip-link-focused.png` shows it painted over the header. Home needs none (no nav ahead).

### P5–P8 — four `aria-label`s sat on generic-role elements (dead ARIA)
A label on a roleless `<div>`/`<span>` is not exposed to assistive tech, so it promised a name that AT never
announced. Fixed each with a real role (probe: `genericRoleLabelled()` in the guard test returns `[]` now):
`aria-label="Phase progress"` → `<section>`; `aria-label="Filter vault notes by tag"` → `role="group"`;
`aria-label="{kind} diagram"` → `role="group"`; the chat error badge `<span>` → `role="img"` (so its
`RT_E_*` meaning + agent action is announced, not just the code text).
**After:** `section[aria-label="Phase progress"] = 1`, `div[aria-label="Phase progress"] = 0`.

### P9 — visible `TODO(...)` engineering markers in operator copy (AI-slop)
`ShellSurfacesCard` printed **three** internal markers as visible text: `(TODO(N2)).`, `; TODO(seat)`,
`; TODO(R13-f04)`. Removed; the honest limitation sentences stay ("…no console read seam yet.",
"…the CLI carries the out-of-band token.", "…runs are bounded local, not OS-sandboxed."). Ticket ids remain
in the `title` tooltips and comments, so no provenance is lost. **After:** sidebar text `hasTodo:false`.
No label gained a claim — only an internal marker was removed.

### P10 — Archive dialog title could not wrap an unbroken name
Added `[overflow-wrap:anywhere]` to `AlertDialog.Title`. **After:** `{dialogOpen:true, titleScrollW 406 ==
titleClientW 406, wraps:true, pageOverflow:false}`.

### Not changed (audited clean)
`pipeline-rail.tsx`, `runtime-timeline-pane.tsx`, `cmd-palette.tsx`, `routes/**`, `fixtures*.ts`,
`store.ts`, `llm.ts` — read end-to-end; no defect found that justified a hunk. `store.ts`/`llm.ts` on-disk
state re-verified (§0).

---

## 3. Regression sweep (desktop + mobile + all routes)

`%TEMP%\rt335_5\verify.mjs`. Fresh page loads after the edits; HMR-clean.

- **Desktop 1440×900:** 3 primary tabs; advanced tier opens; Vault/Diagram/Chat/Runtime panels render;
  `scrollWidth == innerWidth == 1440` on Home, the run screen and after a tab tour.
- **Routes:** `/run/<bad-id>` → “This build doesn't exist or was archived. *Back to intake*”;
  `/run` (no id) and `/no-such-route-335` → “Page not found … *Back to home*”. 0 page errors; the only
  HTTP≥400 are the two unmatched URLs themselves.
- **Mobile 390×844** (isMobile + hasTouch): Home 390==390; run 390==390 with the long name; `main#run-main`
  present; the sidebar drawer opens. 0 console / 0 page / 0 HTTP≥400.
- **Keyboard:** real-`Tab` focus-visibility probe — Home 6/6 and run 12/12 stop-rings visible (accent
  outline + glow); skip link is stop #1 on the run screen.
- **Contrast:** computed-text scan over every visible text node on Home + all 10 run panels + both themes
  (`%TEMP%\rt335_5\audit4.mjs`) → **0 pairings below WCAG AA** (4.5:1 normal / 3:1 large). No colour work
  needed; the design tokens hold.

---

## 4. Tests added + real results on both runtimes

**New:** `src/lib/ui-surface-guards.test.ts` — 7 source-level pins for P1–P10. Placed in `src/lib/` because
that is the only location `package.json`’s test glob discovers (`"src/lib/**/*.test.ts"`) and the repo
already pins `console.tsx` by reading its source (`scripts/next-action-arm-parity.test.mjs`). It imports
nothing from `src/lib`, so the module-coverage guard is unaffected (`0 stale allowlist entries`).

**RED-first (same assertions, two files):**

| Subject | Node 22.23.2 |
|---|---|
| HEAD `src/components/console.tsx` (via `RT335_CONSOLE_TX`) — hash from `git show HEAD:` | **not ok 1–5 · ok 6–7 → 2 pass / 5 fail** |
| this lane’s bytes | **ok 1–7 → 7 pass / 0 fail** |

| Runtime | Command | Result |
|---|---|---|
| Node **22.23.2** (pinned) | `node --experimental-strip-types --test --test-reporter=tap` on store/llm/fixtures/ui-surface-guards | **130 tests / 5 suites / 130 pass / 0 fail** |
| Node **24.15.0** (host) | same | **130 tests / 5 suites / 130 pass / 0 fail** |

(Lane baseline before edit: 123/5/0 on both runtimes — delta **+7**.)

**Targeted guards (no full gate, siblings mid-edit):**

| Check | Result |
|---|---|
| `npx eslint src/components/console.tsx src/lib/ui-surface-guards.test.ts` | exit 0, 0 warnings |
| `npx tsc --noEmit` | **0 errors** project-wide (filtered: 0 in my files) |
| `node scripts/check-module-coverage.mjs` | 103/122 reached · 19 allowlisted · 0 unallowlisted · **0 stale** · exit 0 |
| `node --test scripts/next-action-arm-parity.test.mjs scripts/check-module-coverage.test.mjs` | **11 pass / 0 fail** (the console.tsx-pinning parity guard still green) |
| non-null assertions in `console.tsx` | **0** (bang-dot 0 / bang-paren 0 / bang-semi 0) |
| keyed calls | **0** — see §6 |

**What the tests do NOT cover:** visual regression (the browser screenshots are the artifact, not a gate);
WCAG reflow at 320px and 200% zoom (measured at 390px only); the skip link’s in-page jump is asserted as
`href` + visible-on-focus, not by pressing Enter and re-reading scroll position.

---

## 5. What I did NOT land — broad proposals (deferred, not restyled)

1. **Mobile header density.** At 390×844 the header chrome (domain/status chips · research · sandbox ·
   est-tokens · saved · Autopilot · Wild · Guide · Settings · Shortcuts · theme) stacks to ~10 rows before
   content. A collapsed "status" popover (one chip → detail sheet) would win back ~40% of the first screen,
   but it is a redesign of controls other lanes’ docs describe — proposed, not landed.
2. **Ticket-id suffixes on `ShellSurfacesCard` labels** (“Wild plan · R13-f02”, “Checkpoint · resume ·
   T-107.7”, …). Plain-language labels with the id moved into `title` would read better for humans while
   keeping the provenance agents use; touching 7 labels is a bigger diff than a polish hunk — proposed.
3. **Global skip link in `routes/__root.tsx`.** A single app-wide skip target would need an id on the 404
   screen’s `<main>`, which lives in the unowned `src/lib/error-component.tsx` — a global target would
   dangle there. Landed the Run-screen-only link instead.
4. **`/run/<bad-id>` still titles the tab “RapidTool — Delivery run”** while the body says the build does
   not exist (the head is static route meta; making it state-aware touches route meta semantics) — recorded.
5. Chip/`verb:`/`≈tok (est)` jargon: every one already carries a `title`/tooltip and the guide explains
   them; no change.

---

## 6. Keyed calls / secrets

**0 keyed calls this lane.** Nothing in the delivered changes consumes a keyed path (layout, focus, ARIA,
copy), and the keyed chip/refusal path is unchanged from 334-5’s measured proof (1 call, 0 tokens). No
secret was printed at any point; the only key-shaped string anywhere in this lane’s harnesses is the
`…0000`/`…42ff` tail cited in frozen 331/332 logs.

---

## 7. Coverage confidence + cleanup

- **High confidence:** P1/P2 overflow (measured `scrollWidth` before/after), P3 landmark, P5–P8 ARIA
  (computed a11y-tree/label probe), P10 wrap, mobile 390 overflow, keyboard focus-visibility.
- **Medium:** P4 skip-link UX (asserted visible-on-focus + `href`, not the post-Enter landing), P9 copy
  (asserted by source guard + rendered sidebar text scan).
- **Cleanup:** dev server stopped; `0` listeners on `:8080`; lane harnesses + artifacts live only under
  `%TEMP%\rt335_5\`; nothing from `%TEMP%` committed. Repo gains only the 10 `console.tsx` hunks, the new
  test, and this log.

---

## 8. Cleanup verification (measured after the lane)

- `Get-NetTCPConnection -LocalPort 8080` → **0 listeners**; `http://127.0.0.1:8080/` refuses (dev server stopped).
- All 13 live `chrome.exe` processes are the machine's installed **Google Chrome**
  (`C:\Program Files\Google\Chrome\Application\chrome.exe`) — not Playwright's bundled chromium; every
  harness called `browser.close()`.
- Remaining `node.exe` processes belong to sibling lanes (`headless.test.ts`, `scripts/r…`) — untouched.
- `git status --short` for this lane: ` M src/components/console.tsx`, `?? src/lib/ui-surface-guards.test.ts`,
  `?? fixes/335_5_chrome.md` (plus the untracked `wave_plans/W49/`). No probe file entered the repo; all
  harnesses/artifacts stay under `%TEMP%\rt335_5\`.
- Final owned-suite re-run on Node 22.23.2 and Node 24.15.0: **130 / 130 pass** each; `console.tsx`
  non-null assertions **0**.
