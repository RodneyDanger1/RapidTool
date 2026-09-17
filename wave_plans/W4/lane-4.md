# W4 · LANE 4 — finish the UI wave: TASK-10 palette + TASK-11 wiring + 216m

**Mission.** Close the UI remainder: the cmdk command palette (TASK-10) and the timeline
pane wiring (TASK-11 — the parser module is DONE and green; only the console wiring is
missing), then complete the `216m` log. All ADDITIVE. Plain language. No existing
interaction may change.

**Done-when:** typecheck 0; single-file eslint 0 on console.tsx + new files; interactive
paths you could not exercise listed honestly (no browser); `216m` completed.

**Owned files (yours alone):** `src/components/console.tsx`, any NEW UI component files you
create (e.g. `src/components/cmd-palette.tsx`), `fixes/216m_ui_wave2.md`.
Neighbors you must NOT touch: `src/lib/rt-timeline.ts` + its test (GREEN and parent-fixed —
read-only for you), everything in L1/L2/L3/L5's lists.

**MINI-TASK PLAN (follow in order):**
1. RECON (re-grep; line numbers below are from W3 and may have drifted): handler anchors in
   console.tsx — `onApprove` ~:1664, `runUntil` ~:1687, `copyPacket` ~:1815, `downloadPacket`
   ~:1863, `downloadJson` ~:1850, `copyHandoff` ~:1828, `copyProjectJson` ~:1839; setters
   `setSettingsOpen` ~:1498 / `setShortcutsOpen` ~:1500 / `setReportOpen` ~:1494; the
   single-key shortcut handler ~:1524-1586; dialogs mounted ~:2818-2827; RuntimeLogPane
   ~:3616 + its `Tabs.Content value="runtime"` ~:2726. Read dossier 111 TASK-10 + TASK-11.
2. TASK-10 palette: NEW component using cmdk 1.1.1 (already in node_modules; its
   `@radix-ui/react-dialog` dep is present — NO new dependencies). Wire the EXISTING handlers
   (do not duplicate logic). Mount additively. CRITICAL: the key-shortcut handler must
   SUSPEND single-key shortcuts while the palette is open (111's collision risk) — find the
   handler and gate it explicitly.
3. TASK-11 wiring: `rt-timeline.ts` gives `parseTimeline` (typed rows with start/finish
   pairing, `closes`/`closedBy`/`durationMs`, `summarizeTimeline`). Wire it into the runtime
   pane ADDITIVELY: a typed view (paired spans, honest "still running") with progressive
   disclosure — raw NDJSON stays reachable for anyone who wants it. Keep the raw tail as the
   default if that preserves current behavior; the typed view is the addition.
4. Complete `fixes/216m_ui_wave2.md` — task table (TASK-06 done+verified, TASK-07 done, the
   3 README corrections, TASK-11 module + wiring, TASK-10), file:line list, wiring description,
   what could break, and the interactive paths NOT exercised.

**PARENT FINDINGS & TRAPS:**
- `rt-timeline.ts` had 2 boundary bugs the parent fixed (case-insensitive
  `rtEventTailStatus`; `openSpans` counts only UNCLOSED starts). 28/28 green — do NOT edit it;
  if you think it's wrong, REPORT instead.
- TASK-06 + TASK-07 are already landed and verified — do NOT redo them. README-cli.md is
  NOT yours this wave (no edits needed).
- W3-L4's recon confirmed: exactly 2 ` · HITL` chips existed and both are wrapped. No more chipping.
- The console file is huge: patch with unique anchors only; re-read immediately before each patch.

**Verification (exact commands):**
```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
npm run typecheck
npx eslint src/components/console.tsx
node --experimental-strip-types --test src/lib/rt-timeline.test.ts   # must stay 28/28
```

**Logging:** `fixes/216m_ui_wave2.md` — extend the existing skeleton. Only writer: you.
If you run out of budget mid-edit, say so PLAINLY with the real state on disk.
