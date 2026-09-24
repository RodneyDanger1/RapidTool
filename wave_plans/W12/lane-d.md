# W12 · LANE D — UI/UX: make the console simpler without losing one capability

**Read this file FIRST.** Then `AGENTS.md`, `DESIGN.md` if present, `RESUME.md` §11.8 (the owner's
UI taste — *Codex + Hermes Desktop, dark, terminal, compact, NOT spread all over, plain language,
usable by a beginner AND an agent; they HATE jargon and info-dense screens*),
`research/multiagent/110_ui_audit_vs_competitors.md` (§1 verdict, §2 tab inventory, §5 task list),
`research/multiagent/111_ui_design_research.md` **§TASK-05** (your headline item — read its
"TABLES → TIERS" row and the risk note), and **`fixes/217g_console_s1_bugs_and_compaction.md`**
(what W11-L6 already landed in this exact file — do NOT redo it; verify it instead).

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2, git-bash /c/Users/mnril/Desktop/RapidTool Main).
PATH HAS A SPACE → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
MANDATORY RULES (the parent rejects violations):
1. PATCH-ONLY targeted edits with the `patch` tool. console.tsx is 6,000+ lines — re-read the exact
   region immediately before EVERY patch; line numbers drift. Never write_file on it.
2. No mock/demo/stub/placeholder code. Match the file's existing component/style idioms exactly.
3. NEVER run git checkout/stash/reset/clean/commit.
4. Your ONLY owned file is `src/components/console.tsx`. Need a change elsewhere? STOP and report it.
5. Verify with AT MOST ONE `npm run typecheck` at the very END (it is your only automated safety net —
   no test in this repo reads console.tsx). NEVER run `npm test` or `npm run build` (other lanes share
   this 8 GB machine).
6. Every claim needs a command you actually ran + its real output. If you run out of budget, say so
   plainly and describe the real state.
7. If an existing test pins the old behaviour you may update it — record old → new. Never weaken an
   assertion or delete a test to get green.
8. Write your landing log at `fixes/217m_console_simplification.md` (only writer): skeleton FIRST.
```

**THE HARD RULE OF THIS LANE — capability preservation.** Every change must be *additive, re-ranked,
re-worded, or wrapped*. You may NOT delete a control, remove a tab, drop a pane, remove a data field,
or make any capability unreachable. If you cannot achieve a simplification without violating that,
**stop and write it up as a proposal in your log instead** — a well-evidenced "this needs a
capability decision" is a valid outcome; a broken console is not.

## Numbered plan

1. **Skeleton + a 5-minute verification pass of L6's work** (record what you found, so the log can
   say whether L6's claims held): search for the `a`-shortcut override guard, the dialog-open guard,
   the shared execute predicate, the Crew empty state, the per-tab hints, and the legend rendered
   from `SHORTCUTS`. Report each as PRESENT/ABSENT with the grep line. Do not re-apply anything
   already present.
2. **TASK-05 (headline) — tier the ten tabs into named families.** Per 111 §5/TASK-05: keep the
   `RunTab` union **byte-identical**, keep all ten panes and every `Tabs.Content value=` intact, and
   add **2–3 named families** as a wrapper around them (progressive disclosure: rank and defer,
   never delete). The run view currently shows ten noun-only tabs at equal weight; a beginner cannot
   tell where to start. Requirements:
   - the primary family must contain the surfaces a first-time user needs (Artifacts, Agent packet,
     and whatever the current-step surface is) — lead with those;
   - operator-only surfaces (Runtime log and friends) go in a clearly-labelled secondary family,
     still one click away;
   - the tab-strip `aria-label` must be **derived from the same array** that renders the tabs (111
     TASK-03 already demanded this — if L6 landed it, build on it; if not, derive it) so the
     announcement and the DOM order can never diverge again;
   - if a family wrapper would hide a pane that a keyboard shortcut or the command palette jumps to,
     the jump must still work (follow every `setTab(` call site you can find and keep each one
     landing on a *reachable* tab).
3. **T-20 — the current step, in words.** 110 §4 CP-1/CP-5: the phase rail never states *what is
   running right now* in a plain sentence. Add one honest line near the run header: the current phase
   name + its status in plain language (not the enum, not jargon), and — when parked — what the user
   must do. Derive it from the state that already exists; invent no new state and no new store.
4. **UI-16 — one visual hierarchy.** Give the *one* next action the only solid/primary treatment and
   demote the rare destructive/export controls (CSS/JSX only; all handlers stay wired). 110 §3
   UI-16 pairs this with UI-10: if the export affordances are still five separate buttons, collapse
   the *presentation* into one labelled menu while keeping every code path wired — and record the
   count of wired paths before/after so "no capability lost" is provable.
5. **T-17 (only if you still have budget) — plain-language narration for system events/errors.** One
   summary sentence above raw payloads, and fix the enum `replace("_"," ")` first-underscore-only
   defect if you find it (110 §4 CP-7 names it). Plain words, no jargon, no JSON in the sentence.
6. **Verification that you can actually run:**
   - `npm run typecheck` → must be 0 errors.
   - Re-read each edited region and paste the before/after lines into your log.
   - **Capability-preservation checklist** in the log: for each of the 10 tabs, the panes still
     render (grep the `Tabs.Content value=` list) · for each control you re-worded or re-ranked, the
     handler is still attached (grep the handler name) · the count of `setTab(` call sites before and
     after (must be equal or greater).
   - State plainly that no automated test covers this file, so a human (or a browser pass) should
     confirm on `:8080` — do not claim visual verification you did not do.
