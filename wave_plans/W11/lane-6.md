# W11 · LANE 6 — UI/UX artist + developer: the three S1 reliability bugs, then compaction

**Read this file FIRST, before any other file.** Then `AGENTS.md`,
`research/multiagent/110_ui_audit_vs_competitors.md` (§1 verdict, §3 findings — UI-01/02/03 are
your bugs, quoted below, and §5 is your backlog), `research/multiagent/111_ui_design_research.md`
(TASK-03/05/07/08/09/11 — what already landed and what did not), and `fixes/216h_ui_wave.md`
(the UI wave's landing record).

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2). HOST QUIRK: the path contains a SPACE,
so search_files/ripgrep FAIL — use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
Read `AGENTS.md` at the repo root FIRST (the repo's own contract).
Read `RESUME.md` at the repo root (session handoff: gate contract + hard rules), `taskuniverselog.md`
(the live task-status board — check YOUR task's current status there), and the research dossier
named in your task (each fix is already specified with file:line and a done-when — your job is to
ENACT it, not re-derive it).

MANDATORY WORKING RULES — the parent will reject violations:
1. PATCH-ONLY on existing files. Use the `patch` tool with small targeted old_string/new_string edits.
   NEVER use write_file to rewrite an existing file. Re-read the exact region immediately before
   patching (line numbers drift as siblings edit).
2. NO mock, demo, stub, placeholder or TODO code. Production quality only, real working logic, same
   code style as the file (explicit `.ts` import extensions; TSDoc comments carrying the finding id).
3. NEVER run `git checkout`, `git stash`, `git reset`, `git clean`, or `git commit`. Another agent's
   work may be in the tree; reverting is the parent's call, not yours.
4. Do NOT run the full `npm test` or `npm run build` — siblings are mid-edit and the repo rule is
   never to run the full gate while agents are editing. Verify with:
     npm run typecheck
     node --experimental-strip-types --test <your test file(s)>
   Both must pass before you claim done.
5. Stay strictly inside your owned files. If a fix needs a change elsewhere, STOP and REPORT it —
   do not make it.
6. Every claim in your report must be backed by a command you actually ran and its real output.
   NEVER invent test counts or results. If you run out of budget mid-edit, SAY SO PLAINLY and describe
   the real state — an honest "incomplete, does not typecheck" is far more valuable than a claimed
   green. (A lane in the previous wave did exactly this and it is the reason a broken tree was caught
   immediately.)
7. If an existing test pins the OLD (buggy) behaviour, you may update it deliberately — but record
   old → new in your log with the reason, and NEVER weaken an assertion or delete a test to get green.
8. Write your landing log at the path given in your task (you are its ONLY writer). Record: task id,
   what changed, file:line, the command you ran, the observed result.
```

**Your owned file (ONLY this):** `src/components/console.tsx`

**Landing log:** `fixes/217g_console_s1_bugs_and_compaction.md` (skeleton FIRST).

**Persona.** You are the UI/UX artist and developer. The owner's verbatim complaint is:
*"IT IS VERY COMPLICATED FOR A UI / A LOT OF INFO / LOTS OF JARGON."* Their taste is
**Codex + Hermes Desktop**: dark, terminal-flavoured, live agent feed, **compact — not spread all
over** — readable and usable **by a beginner AND by an AI agent**. Information density is the
enemy; capability is not. Nothing may be removed; things may be re-ranked, re-worded and
deferred behind a disclosure.

**No test in this repo reads `console.tsx`** (110 §6.0) — your safety net is `npm run typecheck`
plus the build. That means *you* are the reviewer: after each change, re-read the region and ask
whether a beginner would understand it without a legend.

---

## Item 1 — the three S1 reliability bugs (110 §1 calls these the audit's real findings). Do these first, exactly as specified.

**UI-01 — the `a` shortcut bypasses the DoD-override gate.**
Today: `src/components/console.tsx` — the single-key branch
`} else if (key === "a" || key === "A") { if (st.projects.find((x) => x.id === id)?.hitl) {
e.preventDefault(); onApprove(); } ...` calls `onApprove()` with no force flag, while the visible
Approve button (the `HitlPanel`/approve block near the bottom of the file — search
`needsOverride` and `forceOverride`) is `disabled={needsOverride && !forceOverride}`. Result: on a
gate needing the override the user presses `a`, the store refuses, and they get an error about a
checkbox they never saw. **The shortcut and the button must be the same action.**
Fix (110 §5, UI-01 row, verbatim intent): route the shortcut through the same predicate as the
button — *"or better, focus the checkbox instead of approving"*. Prefer the better option: when
the override is required, do NOT approve; surface one plain sentence naming the real control and
move focus to it (the file already has the `noteRef`-style focus pattern to copy). Do **not**
weaken or remove the store guard (`src/lib/store.ts` — not your file, read-only for you).
Record in your log which option you took and why.

**UI-02 — shortcuts are not suspended while a dialog is open.**
Today the window-level `keydown` handler bails only for typing targets and for the command
palette (`paletteOpenRef`). Open the Guide / Settings / Shortcuts dialog and press `e` → the
current phase executes **behind** the modal, invisibly. Same for `g` and `a`. The shared `Modal`
component near the file's bottom renders `role="dialog" aria-modal="true"`.
Fix (110 §5, UI-02 row): add an "a modal is open" guard to the handler — the audit's own
suggestion is `if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;` — or a
lifted `anyDialogOpen` boolean if you find the file already has a cleaner state seam. Additive;
no store change. Keep the existing typing bail and the palette suspension.

**UI-03 — `e`/`g` fire where the equivalent button is disabled or absent.**
The Execute / Run-to-gate buttons are gated on `running || busyAction !== null` and are only
rendered in the non-HITL, non-complete, non-blocked branch; the shortcuts gate only on the
`busyRef` latch, so during a run started elsewhere (wild mode, or after a reload with the stored
status `running`) `e` still calls `run()`.
Fix (110 §5, UI-03 row): one `canExecute()` helper (or a store-derived predicate) read by **both**
the buttons and the `e`/`g` branches, replacing the `busyRef`-only latch. Refactor-safe; keep the
typing bail and modifier handling exactly as they are.

**Then verify item 1 by reading, not by claiming:** `grep -n` each fixed site and paste the
before/after lines into your log. `npm run typecheck` must be 0.

## Item 2 — compaction + plain language (the owner's complaint). Do these in order; each is small.

- **UI-05 — the `Crew` tab has no empty state.** It renders an empty div when `crew` is `[]`,
  while Vault/Runtime/Chat/Diagram/Oracle all have honest empty states. Add the standard
  `border-dashed` empty state in the same shape the neighbouring tabs use.
- **UI-08 — one plain-language purpose per tab.** Ten tabs are nouns only. Add a one-line hint
  per tab, derived from a `{label, hint}` data array so it cannot drift (the audit's own
  suggestion). Keep the existing labels and the 10 pane values untouched — this is additive text.
  **Plain language, no jargon: "the prompt you paste into an AI agent", not "agent packet".**
- **UI-11 — the footer shortcut legend must render FROM `SHORTCUTS`** (the module-level
  `SHORTCUTS` table already in this file is the single source), so the legend and the dialog
  cannot diverge. Keep the dialog as the canonical list.
- **T-22 (110 §4 CP-6 + §3 UI-09) — keep `?` opening the Guide** (it is documented and shown in
  the legend — do not break muscle memory), and **add** a second binding (`Ctrl+/`) that opens the
  **Shortcuts** dialog, and make that dialog state both bindings.

**Do NOT** do TASK-05 (tiering the ten tabs into families) in this wave — 111 §5 ranks it last and
it is the highest-blast-radius UI change on the board; it is deliberately deferred. If you finish
early, write a short "how I would do TASK-05 without a compile break" section at the end of your
log instead of doing it.

## Then

- `npm run typecheck` (must be 0) and paste the real output.
- Finish the log: finding id → what changed → file:line → the plain-language wording you chose and
  why → what a beginner now sees that they did not before.
- **Honesty:** if a fix turned out to be already applied, say so with the grep that proves it
  instead of re-applying it.
