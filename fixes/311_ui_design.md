# fixes/311_ui_design.md — RESCUED from the UI-Design auditor's final summary (write step hit the cap; content verbatim)
# UI-DESIGN — source audit, measured a11y, 19 real screenshots, verdict, 10 modernizations

**⚠️ Deliverable not yet on disk.** I ran out of iterations before writing `fixes/311_ui_design.md` (the screenshots dir + probe report ARE on disk). Below is the compressed audit content, ready to paste into that file.

## What I did (all measured, nothing inferred)
- **Source audit:** `src/styles.css` (731 L), `console.tsx` (6914 L), `pipeline-rail.tsx` (532), `cmd-palette.tsx` (144), `runtime-timeline-pane.tsx` (264), `preview-host-bridge.tsx` (26), `routes/*` (122), `design.ts` (834). No `tailwind.config.*` — design system lives in Tailwind v4 `@theme` (`styles.css:3-43`).
- **Real pixels:** Playwright 1.62.1 (devDep) against the **already-running dev server** `http://127.0.0.1:8080` (PID 17908 — **not started by me**; 8081 was free, port untouched, nothing to kill). 19 real screenshots captured; probe report at `~/311_probe_report.json`.
- **Measured a11y/contrast probes** via in-page `getComputedStyle` + WCAG luminance math.
- **0/5 web searches used** — the competitor section below is prior knowledge, **not web-cited** (flagged honestly).

## Files created
- `fixes/311_ui_shots/`: `01-home-seeded`, `02-home-empty`, `03-run-top`, `05-run-rail-detail`, `06-palette`, `07-run-tabstrip`, `07b-tabstrip-expanded`, `08b-runtime-log`, `08c-diagnose`, `09bh-typed-timeline`, `10b-design-pane`, `11-chat-pane`, `12-focus-visible`, `13-run-light-theme`, `13b-runtime-light-theme`, `14-home-mobile`, `15-run-mobile`, `16-phase-record`, `17-runtime-light` (.png, 2.1 MB)
- `C:\Users\mnril\311_probe_report.json` (raw probe JSON)
- **Housekeeping owed:** `probe_311_shots.mjs` is still at repo root (repo rule: delete before finishing) and `04-run-rail-nowline.png` + `09-typed-timeline.png` are 10 937-byte junk duplicate captures (from a failed v1 pass) — **both must be pruned**.

## 1. Design system as-is
- **Tokens (`styles.css:3-43`):** bg `#0a0c0b`, surface `#101312`, raised `#161a18`, overlay `#1c211e`, fg `#e8ece7`, muted `#97a29b`, faint `#7d8881`, accent `#9dbfab`, ok `#8cc493`, warn `#d9b184`, danger `#e08e8e`, wild `#b3a0d9`, border `#2f3832`, line `#222825`; radius xs3/sm5/md8/lg12/xl16; Instrument Sans + IBM Plex Mono (Google Fonts, `__root.tsx:60`). Light theme = engine fintech·emerald verbatim (`styles.css:146-162`; provenance `design.ts:176-251`).
- **Palette discipline is genuinely good:** 31 hexes in CSS (all in the palette/token block), **only 2 hexes in any `.tsx`** (`console.tsx:1498` theme-color meta — legitimate) → token-driven theming holds.
- **Component inventory:** component classes in CSS (`.btn-solid` 268, `.rt-alert` 294, `.rt-badge` 313, `.rt-tab` 334, `.chat-*` 363-503, `.wild-row` 506, `.term-frame` 554, `.rail-*` 625-656, `.rt-phase` 659, `[cmdk-item]` 694, `[role=dialog]` 703, `textarea[aria-invalid]` 711) + Tailwind utilities at call sites; icons = lucide-react (`package.json:66`), consistent.
- **Layout:** header chip strip (`console.tsx:2634-2754`) → `grid lg:grid-cols-[240px_minmax(0,1fr)_300px]` (2756) → left phase nav (`nav aria-label="Phases"` 3742-3788) / center / right sidebar `aside` (3527).
- **Type scale:** no `--text-*` tokens; Tailwind defaults + 3 ad-hoc px sizes (`text-[11px]`×104, `text-[10px]`×21, `text-[9px]`×1). **Measured: 372 sub-12px leaf text nodes on the run screen.**
- **Spacing:** no scale token; arbitrary Tailwind steps, `px-5 py-3/py-5` dominant.
- **Hit targets:** mostly good (`min-h-11`×20, `min-h-10`×8, `min-h-9`×12), some 36px icon buttons (1519).
- **Empty/loading/error states: present and unusually honest** — `1831` no-builds, `4543` "No events yet — honest silence", `runtime-timeline-pane.tsx:216`, `pipeline-rail.tsx:296-298`, `2148-2153` not-found. No skeletons (acceptable); `aria-busy` (2768), "Rejecting…" spinner (3994).
- **Duplication smells:** two stacked rails — non-interactive `PhaseProgressRail` (3626-3730) + interactive `PipelineRail` — render near-identical P0-P12 strips with the same `0/13 sealed · 0%` counter (visible in `03-run-top`, `13`, `17`) = redundancy + "which one is live?" ambiguity; `PhaseGlyph` carries sr-only status while `PhaseProgressRail:3713` uses `aria-label` only → SR gets no status word from the nav; status vocabulary is duplicated (`console.tsx:91/124` vs `pipeline-rail.tsx:49/58`).
- **Dead deps:** `sonner`, `vaul`, `recharts`, `react-resizable-panels`, `react-day-picker`, `@radix-ui/react-slider` — zero imports in `src/components`.

## 2. Accessibility (measured)
- ✅ Contrast all pass AA: text-faint **5.34:1**, text-muted **7.43**, accent **9.79**, ok **9.75**, warn **9.88** on `rgb(10,12,11)`. Focus-visible ring defined twice incl. an unlayered rescue for `outline-none` controls (`styles.css:95-99`, `125-137`). `prefers-reduced-motion` hardened with `animation-iteration-count:1` (`716-731`). `lang="en"`, 121 `aria-hidden` decorative icons, `aria-current`/`aria-pressed` on phase nav.
- ❌ **No `aria-live` and no `role="log"` anywhere on the run screen** — probe: `ariaLiveCount:0, roleLogCount:0` (`roleStatusCount:1`). The live ring feed (`console.tsx:4548-4569`), pipeline **now-line** (`pipeline-rail.tsx:489-498`) and wild feed (`1293` region) update silently for SR users, while the 4 `aria-live`s that do exist are on home/HITL (`1799, 3155, 3944, 4001`). This is the top a11y violation.
- ❌ **3 controls with no accessible name** (probe): the Autopilot checkbox (`2714-2717` — input not associated with its `<span>` text: no `id`/`for`), the HITL override checkbox (`3956-3962`), and the hidden import file input (label-less by design).
- ❌ **Hand-rolled `Modal` (`6630-6677`) has no focus trap, no initial focus, no restore**; overlay is a focusable full-screen `<button>` (`6660`) so the first Tab stop is an invisible "Close"; Escape is a window listener (`6643-6650`). Radix is already a dep and IS used for Archive (`3119`) — inconsistency.
- ⚠️ Pale, 9-11px uppercase/mono labels (`text-[9px]` badge at `922`) are the dominant metadata idiom — legible (5.34:1) but 372 sub-12px nodes is a lot for non-expert users; `text-faint` at 11px is the weakest pairing.
- ⚠️ Light theme: `bg-black/20|30` wells (`console.tsx:4536,4552`, `runtime-timeline-pane.tsx:189,227,257`) render as **grey patches on white instead of token surfaces** (verified in `17-runtime-light` crop) — a style/theming inconsistency, not a contrast failure. Terminal `term-bar`/`term-body` in light theme leaves the packet rendering in dark chrome (from `13-run-light-theme`).

## 3. First-glance verdict per surface (from the real pixels)
- **Home (`01`,`02`,`14`): professional.** Type-led hero, single primary CTA, live `0/12` validation counter, honest empty state. No animation/aliveness beyond the gradient backdrop.
- **Console header (`03`): dense but disciplined** — the visible keyboard legend under the action bar (e Execute / g Run to next gate / a Approve…) eats prime vertical real estate; `a` label is a full sentence.
- **RunScreen center:** clear `WHAT'S HAPPENING` block + one primary "Run to next gate · verb: gate" — genuinely good. 8 algorithm cards are static decoration competing with the phase narrative.
- **Rail:** live now-line with real provenance labels (`RING 21:26:36 sys.longtask …`) — best-in-class honesty; visually a copy of the phase graph above it.
- **Panes:** palette (`06`) is the most polished surface (grouped, keyboard-selected row, verb chips, Esc hint); runtime log is a raw dump; phase record (`16`) is competent and shallow.
- **Mobile (`15-run-mobile`, 7.8 KB): the run screen is effectively unusable at 390px** — the 3-column grid stacks into a long single page (~7 300px tall). **Biggest ease-of-access failure.**

## 4. Comparison (⚠️ prior knowledge, 0 web searches — not URL-cited)
- **First 10 s:** home ≈ v0/Lovable's clarity, but they show a live product preview; Cursor/Devin show the working IDE. RapidTool shows intake + honest state → matches on clarity, lags on "alive".
- **Information hierarchy:** best-in-class **honesty** (provenance-labelled now-line, `ILLUSTRATIVE`, coded refusals); lags Cursor/Devin on progressive disclosure (13 phases × 11 tabs × 8 cards at equal weight).
- **Live feedback:** the rail now-line + typed timeline pair starts with finishes (`rt-timeline.ts`) is genuinely **better than Claude Code's TUI restraint** at showing pairing; but nothing animates/streams, so it feels static vs Lovable/Bolt's token-by-token build feel.
- **Non-developer:** matches Devin/Lovable on plain-language labels ("Now-line", "Needs you", verb chips); loses on vocabulary density (DRAFT/IN REVIEW/LOCKED + A1-A8 + P0-P12).
- **AI-agent readability:** the single strongest axis — deterministic text state, `verb:` chips, NDJSON-identical rows, `?`→guide, `diagnose` JSON → **out-polishes all four** (none expose their state as agent-readable text).
- **Visual modernity:** modern restraint (fine hairlines, tight radii, mono metadata) — deliberate and coherent; **behind** Cursor/Lovable on motion, depth, and typographic scale.

## 5. Rank & verdict
- **Console shell — professional.** RunScreen — professional but cluttered (two rails, 8 static cards, shortcut legend).
- **Rail — professional** (most honest surface in the class), duplicated by its own neighbour.
- **Panes — mixed:** palette professional; runtime log/packet raw; design/diagram tab decorative.
- **Ease of access:** desktop-good, keyboard-good, **screen-reader-incomplete (live feed silent), mobile-broken.**
- **Honest rank vs class:** ~4th of 5 on first-impression polish; **1st on auditability/agent-readability**; last on aliveness and mobile.

## 6. Ranked 10 modernizations (what · where · smallest real change · feel)
1. **Mobile run shell** — `console.tsx:2756` grid → add drawer/`lg:`-only rail + collapsible sidebar · one breakpoint rule · makes the product usable on phones (highest impact).
2. **Announce the live feed** — wrap now-line (pipeline-rail.tsx:489) + ring rows (console.tsx:4548) in `role="log" aria-live="polite"` · 2 attributes · SR users get the build narrating itself.
3. **Fix the unnamed checkboxes** — `2714`, `3956`: `id`+`htmlFor` or `aria-labelledby` · 2 attrs each · removes the only real a11y blocker.
4. **Break the two-rail duplicate** — merge into `PhaseProgressRail` as the clickable rail; keep the now-line as its footer (`pipeline-rail.tsx:448`) · delete one strip · instantly lowers cognitive load, kills "which strip is live?".
5. **Tokenise the type ramp + drop sub-12px** — add `--text-2xs: 11px` etc. to `@theme` (`styles.css:3`) and raise the 372 sub-12px nodes to 12px · one token block + sweep · calmer, more modern reading rhythm.
6. **Fix `bg-black/*` wells theming** — `console.tsx:4536,4552`, `runtime-timeline-pane.tsx:189,227,257` → `bg-overlay/40` · 5 class swaps · light theme stops showing grey patches.
7. **Stream the phase narrative alive** — animate the now-line row + rail segment on new `rtSnapshot()` row (`styles.css:233` has the pattern) · one class + existing 2 s poll · the console stops feeling frozen.
8. **Collapse the algorithm cards** — `console.tsx` A1-A8 block → one-line summary + "Show all 8" (same pattern as "More panels") · local state · returns focus to the phase story.
9. **Demote the shortcut legend** — move the visible `e/g/a/r` legend under the action bar into the Shortcuts dialog · delete 1 block · reclaims vertical space with no capability loss (shortcuts unchanged).
10. **Drop dead UI deps** — `package.json`: sonner/vaul/recharts/react-resizable-panels/react-day-picker/slider · remove 6 deps · smaller bundle, less false surface.

**Honesty note:** the competitor section is uncited prior knowledge (no web_search performed); everything else above is file:line- or screenshot-cited.