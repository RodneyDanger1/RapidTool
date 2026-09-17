# 216m — UI wave 2: TASK-06 / TASK-07 tail / TASK-10 / TASK-11 (+ W4 wiring)

**Status:** COMPLETE — W3 · L4 landed TASK-06 + TASK-07 tail + the `rt-timeline.ts` module;
W4 · L4 landed TASK-10 (cmdk palette) + TASK-11 console wiring and completed this log
(2026-09-16).
**Spec:** `research/multiagent/111_ui_design_research.md` — TASK-06 (doc-contract test), TASK-07 tail
(the remaining jargon chips), TASK-10 (cmdk command palette), TASK-11 (pure timeline parser +
typed pane wiring).
**Owned files (W4 · L4):** `src/components/console.tsx` · NEW `src/components/cmd-palette.tsx` ·
NEW `src/components/runtime-timeline-pane.tsx` · this log.
**Read-only neighbor (reported, never edited):** `src/lib/rt-timeline.ts` (+ colocated test) — GREEN,
parent-fixed (case-insensitive `rtEventTailStatus`; `openSpans` counts only UNCLOSED starts).
W4 · L4 did not touch it; re-verified 28/28 at landing.

## 1. Task log

| Task | Status | What changed | Evidence |
|---|---|---|---|
| TASK-06 | done (W3) | doc-contract test `scripts/README-cli.test.mjs` (5 tests): README-cli verb count, `fixtures` verb, verify-kind claims can no longer drift | `node --test scripts/README-cli.test.mjs` → `# tests 5 · # pass 5 · # fail 0` (re-run fresh at W4 landing) |
| TASK-07 tail | done (W3) | jargon chips wrapped in the in-place glossary (`<Term k="hitl">`) | `grep -n 'Term k="hitl"' src/components/console.tsx` → 3 sites at landing: L3142 (dock), L3259, L5697 (numbers shifted by this wave's +118 inserted lines) |
| TASK-11 module | done (W3, parent-fixed) | `src/lib/rt-timeline.ts` — pure NDJSON → typed paired rows (`parseTimeline`, `summarizeTimeline`) + 28 tests | `node --experimental-strip-types --test src/lib/rt-timeline.test.ts` → 28/28 (re-run W4) |
| TASK-10 | **done (W4)** | NEW `src/components/cmd-palette.tsx` + console wiring: mount, Ctrl+K, state+ref, shortcut suspension while open, SHORTCUTS row | §2 anchors · §3 · §5 |
| TASK-11 wiring | **done (W4)** | NEW `src/components/runtime-timeline-pane.tsx`, mounted additively under the runtime tab; raw ring list stays the default view | §2 anchors · §4 · §5 |

## 2. File:line map (anchors after this wave's edits)

`src/components/console.tsx` (6,050 lines):
- `:70` — `import { CmdPalette, type CmdPaletteEntry } from "@/components/cmd-palette.tsx";`
- `:71` — `import { RuntimeTimelinePane } from "@/components/runtime-timeline-pane.tsx";`
- `:1245-1247` — SHORTCUTS row: `{ keys: ["Ctrl", "K"], label: "Open the command palette" }`
- `:1532-1533` — `paletteOpen` state + `paletteOpenRef`
- `:1559-1561` — effect mirroring `paletteOpen` → ref (the global handler depends only on `id`,
  so it must read the ref, never stale state)
- `:1566 / :1574` — `onKey` opens; its FIRST statement is `if (paletteOpenRef.current) return;`
  — suspends EVERY shortcut in the handler while the palette is open
- `:1602-1608` — Ctrl+K branch (`setPaletteOpen(true)`)
- `:2000-2091` — `paletteEntries` (10 entries; groups Run loop / Copy & export / Panels)
- `:2887` — `<RuntimeTimelinePane />` inside `<Tabs.Content value="runtime">`, after
  `<RuntimeLogPane project={project} />` (that node untouched)
- `:2993` — `<CmdPalette open={paletteOpen} onOpenChange={setPaletteOpen} entries={paletteEntries} />`
  (last child of the screen root, after the existing dialogs)

NEW `src/components/cmd-palette.tsx` (141 lines):
- `:36-55` — `CmdPaletteEntry` type (`run` is a thunk the caller owns)
- `:62-141` — `CmdPalette` component — `Command.Dialog` from cmdk 1.1.1 (embeds
  `@radix-ui/react-dialog` 1.1.15); no new dependency, no install.

NEW `src/components/runtime-timeline-pane.tsx` (213 lines):
- `:83-213` — `RuntimeTimelinePane` (no props — reads the page-level client ring, same as
  `RuntimeLogPane`)
- `:97-99` — ring rows → `JSON.stringify` → `parseTimeline` → `summarizeTimeline` (one code path)
- `:201-208` — raw-NDJSON disclosure (progressive disclosure; raw stays reachable)

## 3. Wiring description — command palette (TASK-10)

- **Entries = the existing handlers, nothing else.** All 10 required handlers are wired to the
  same functions the dock / action bar / toolbar call: `onApprove` (`:2008`), `runUntil` (`:2017`),
  `copyPacket` (`:2026`), `downloadPacket` (`:2035`), `copyProjectJson` (`:2044`),
  `downloadJson` (`:2053`), `copyHandoff` (`:2062`), `setSettingsOpen(true)` (`:2071`),
  `setShortcutsOpen(true)` (`:2080`), `setReportOpen(toggle)` (`:2089`).
- **Verb chips are honest.** A chip renders only for verbs that really exist in
  `scripts/rapidtool-cli.mjs` (`approve`, `gate`, `packet`, `export`, `ingest`); entries with no
  CLI verb render `console only` instead of inventing one (`copyHandoff` is `verb: null` —
  `phaseHandoff` (src/lib/handoff.ts) has no CLI verb today).
- **Keyboard.** Ctrl+K opens (`:1602-1608`); the branch can only fire while the palette is closed
  (the suspension return runs first otherwise). While open, the single-key handler returns at its
  first line (`:1574`): a bare `e` / `g` / `a` / `r` / `?` (or any mod chord) can never reach
  `run()` / `onApprove()` behind the palette — 111's stated collision risk is closed. The early
  return does NOT `stopPropagation`, so the palette's own input keeps receiving every event
  (arrows, Enter, Escape are handled by cmdk/Radix).
- **Close path.** Escape / click-outside / select → `setPaletteOpen(false)` → ref mirror
  (`:1559-1561`) → shortcuts resume. `onSelect` closes first, then runs the handler (an action may
  itself open another surface).
- **Mount is additive.** `<CmdPalette .../>` is the LAST child of the screen root, after the
  existing dialogs. When closed, `Command.Dialog` renders nothing (Radix portal) — no layout or
  interaction change.

## 4. Wiring description — typed timeline pane (TASK-11)

- Mounted as a SIBLING after `RuntimeLogPane` inside the same `Tabs.Content value="runtime"`
  (`:2880-2887`). The raw ring list renders byte-identically and stays the default view.
- Collapsed by default: one honest summary line (`N rows · M paired · K still running ·
  U unparsed`) + the toggle button. Expanded: typed rows from `parseTimeline` over the SAME
  bounded client ring the raw pane reads (`rtSnapshot().tail`, re-serialized to the NDJSON shape
  the CLI appends under `<dir>/.rapidtool/logs/`) — one parser for both views.
- Status chips: completed / failed / paused / event / unparsed. Pairing text: `paired with L{n} ·
  {duration}` / `no finish in the ring yet` / `no matching start` — a duration is never fabricated
  for an unclosed start.
- Raw stays reachable: `<details>` disclosure with the EXACT parsed NDJSON + a "Copy raw NDJSON"
  button (clipboard failures surface inline — same failure contract as the other copy actions).
- Same 2 s poll as the raw pane, cleared on unmount. No store reads, no new data source, no writes.

## 5. Verification (exact commands + real observed results, W4 · L4 landing)

```
$ npm run typecheck
npm notice run typecheck
npm notice run tsc --noEmit
TC_EXIT=0                                  # real exit captured (log: /c/Users/mnril/_w4l4_tc.log)

$ npx eslint src/components/console.tsx src/components/cmd-palette.tsx src/components/runtime-timeline-pane.tsx
ESLINT_EXIT=0                              # no output — 0 errors, 0 warnings

$ node --experimental-strip-types --test src/lib/rt-timeline.test.ts
# tests 28 · # pass 28 · # fail 0          (module untouched — stays green)

$ node --test scripts/README-cli.test.mjs
# tests 5 · # pass 5 · # fail 0             (TASK-06, re-run fresh)
```

Anchor greps at landing: `CmdPalette` mount `console.tsx:2993` · `RuntimeTimelinePane` mount
`console.tsx:2887` · suspension `console.tsx:1574` · Ctrl+K `console.tsx:1602`.

Environment note (recorded once): in a non-TTY/background shell, `node --test … > file` can exit 1
with `stdin is not a tty` before any test runs — an environment quirk, NOT a test failure. Run the
suite in the foreground (pipe its output) and read `${PIPESTATUS[0]}` for the real exit code; both
suites above were green there.

## 6. What could break

- **Single-key shortcuts while the palette is open** — gated by `paletteOpenRef` (never the state:
  the handler effect depends only on `id` and would close over a stale `false` forever). The mirror
  effect (`:1559-1561`) runs on every toggle: opening suspends, closing resumes. No other shortcut
  row changed.
- **Ctrl+K** was unbound in this screen before (the handler had Enter / Shift+C / Ctrl+G /
  single-key branches only) — nothing lost. Caveat: like every mod chord here, Ctrl+K does NOT fire
  while focus is inside a text input/textarea (pre-existing `typing` guard).
- **Stacking** — the palette overlay is `z-50`, same as the existing `Modal` shell
  (`console.tsx:5944`). The palette renders in a Radix portal (a body child), so if a Modal and the
  palette were open together the palette paints above, and one Escape could route to both (Radix
  handles the palette; `Modal` listens on window). Only reachable by opening the palette while a
  modal is open — not a normal flow (the palette's own entries close the palette before opening a
  surface). Cosmetic edge case, recorded, not fixed (additive-only wave).
- **Runtime tab layout** — the collapsed pane adds one strip below the raw list (border-top + one
  row). Purely additive; `RuntimeLogPane` markup untouched.
- **Poll cost** — two 2 s polls (raw + typed) instead of one; both re-snapshot a tiny bounded ring
  — same order as before, negligible.
- **parseTimeline input** — rows are re-serialized from in-memory `RtEvent` objects; an
  unparseable line renders verbatim with status `unparsed` and is counted in the summary (honest
  degradation).

## 7. Interactive paths NOT exercised (no browser in this sandbox)

- Palette: Ctrl+K open; typing to filter; arrow-key + Enter selection; each of the 10 entries'
  `run()` (incl. `approve` with AND without a waiting gate); Escape / click-outside close; focus
  restore to the trigger.
- Shortcut suspension in the live DOM (pressing `e`/`g`/`a` with the palette open) and resume
  after close.
- Timeline: expand/collapse toggle; the raw-NDJSON disclosure; "Copy raw NDJSON" (clipboard success
  AND blocked-failure path); live 2 s refresh with real ring traffic; the empty-ring state; rows
  rendering `still running` / `no matching start`.
- Visual layout check of the added strip under the raw list.

## 8. Honest deltas / out-of-lane items

- `src/lib/rt-timeline.ts` left untouched (green 28/28 re-verified; nothing found wrong with it).
- No new dependencies: cmdk 1.1.1 + @radix-ui/react-dialog 1.1.15 were already in `package.json`.
- TASK-01 stays deferred (needs `headless.ts`, owned by other lanes this wave).
- The palette covers the 10 handlers named in the W4 · L4 brief; it is NOT a catalogue of all 34
  CLI verbs — palette entries must map to a real EXISTING action, so verbs without a console
  handler were deliberately not invented.
- No browser: the interaction paths above are verified by compile + lint + module tests only.
