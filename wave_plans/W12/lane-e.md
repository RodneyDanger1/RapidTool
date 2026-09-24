# W12 · LANE E — UI/UX: the shell, the landing surface, accessibility, and the capability audit

**Read this file FIRST.** Then `AGENTS.md`, `RESUME.md` §11.8 (the owner's UI taste),
`research/multiagent/110_ui_audit_vs_competitors.md` (§1, §3 findings **UI-14**, §4 CP-1/CP-2/CP-8,
§5), `research/multiagent/111_ui_design_research.md` (TASK-01/02/07/09 — what landed vs what did
not), and `fixes/216h_ui_wave.md` + `fixes/217g_console_s1_bugs_and_compaction.md` (what is already
in the tree — do not redo it).

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2, git-bash /c/Users/mnril/Desktop/RapidTool Main).
PATH HAS A SPACE → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
MANDATORY RULES (the parent rejects violations):
1. PATCH-ONLY targeted edits with the `patch` tool. Never write_file on an existing file.
2. No mock/demo/stub/placeholder code. Match each file's existing idioms.
3. NEVER run git checkout/stash/reset/clean/commit.
4. Owned files are ONLY the five listed below. `src/components/console.tsx` and
   `src/routes/__root.tsx` are owned by OTHER lanes this wave — read them freely, never edit them.
5. Verify with AT MOST ONE `npm run typecheck` at the very END. NEVER run `npm test` or `npm run build`.
6. Every claim needs a command you actually ran + its real output. No invented counts or fabricated
   visual verification. If you run out of budget, say so plainly.
7. Never weaken an assertion or delete a test to get green (record old → new if a pin must change).
8. Landing log `fixes/217n_ui_shell_a11y_and_capability_audit.md` (only writer): skeleton FIRST.
```

**Owned files (ONLY these):** `src/styles.css`, `src/routes/index.tsx`, `src/routes/run.$id.tsx`,
`src/components/cmd-palette.tsx`, `src/components/runtime-timeline-pane.tsx`

**HARD RULE:** every change is *additive / re-worded / re-ranked*. Never remove a control, a link or
a piece of information. If a simplification needs a capability decision, write it as a proposal in
your log instead of doing it.

## Numbered plan

1. **Skeleton + recon.** Record the current state of each owned file (line counts, what it renders)
   and read `src/styles.css`'s token layer end-to-end — the fix for "info-dense" is mostly tokens and
   hierarchy, not new components.
2. **Landing surface (`src/routes/index.tsx`) — 110 UI-14.** The CTA must say what a beginner wants
   ("Start build", not intake jargon); the four algorithm names move **behind a disclosure**
   ("what's inside" style) rather than sitting in the first screenful. Keep every existing link and
   route working — list them before/after in the log.
3. **Shell + accessibility pass (mostly `src/styles.css`).**
   - One visual hierarchy in the tokens: exactly one solid/primary treatment; secondary/destructive
     actions visually demoted. Contrast: verify the muted/faint text tokens are still legible on the
     real background (state the pairs you checked; if you cannot verify numerically, say so — do not
     claim a WCAG conformance level).
   - Keyboard/focus: a visible `:focus-visible` ring on interactive elements (buttons, tabs, inputs,
     menu items) and honour `prefers-reduced-motion` for any animation the app defines. Additive CSS
     only — no component behaviour changes.
   - Name the ten-tab strip's affordance plainly if the CSS controls its appearance (spacing/
     truncation/scroll), without touching `console.tsx`'s markup.
4. **`src/components/cmd-palette.tsx` + `src/components/runtime-timeline-pane.tsx` polish.** Read
   them first; make only changes you can justify against 110's findings (plain-language labels,
   grouping, focus order, truncation). If they are already good, say so with the grep/read evidence
   and change nothing — "verified, no change needed" is a valid deliverable.
5. **THE CAPABILITY AUDIT (report-only, but the most valuable thing you produce).** Independently
   check that nothing has been silently dropped by the UI waves. For the whole UI surface:
   - enumerate every control/affordance you can find in `console.tsx`, `cmd-palette.tsx`,
     `runtime-timeline-pane.tsx`, the two routes (grep for `onClick=`, `button`, menu items, dialogs)
     and produce a table: **affordance → where → still present today? → reachable (not hidden behind
     a dead condition)?**
   - specifically confirm the ten `RunTab` panes still all render and that every keyboard shortcut in
     the `SHORTCUTS` table still has a live handler.
   - if you find something missing or unreachable, that is a **defect report** with file:line and the
     grep that shows it — not something you fix outside your files.
6. **Closing proposal (in the log):** the ranked, honest list of what would simplify the console
   *further* and which of those need a product/capability decision from the owner. Plain language.
   This is the input for the next UI wave; do not implement it.
7. **Verify + log:** one final `npm run typecheck` (paste the tail), before/after line counts per
   file, the before/after link/route lists, and the capability-audit table. State honestly that no
   automated test covers these files and that a browser pass on `:8080` is still owed.
