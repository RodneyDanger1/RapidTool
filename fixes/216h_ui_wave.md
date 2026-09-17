# 216h — Lane 5: the UI wave (console progressive disclosure + plain language)

**Status:** in-progress
**Lane:** RESUME.md §3.5 (Lane 5 of the 5-agent wave)
**Spec:** `research/multiagent/111_ui_design_research.md` (TASK-01…TASK-11, landing order §6.1);
plus `research/multiagent/110_ui_audit_vs_competitors.md` §5 derivation (mandatory, cheap).
**Owned files (only these):** `src/components/console.tsx` + any **new** UI component files I add;
appends to dossiers `110`/`111` only.

## 0. Preconditions honoured

- `AGENTS.md` read (repo contract): patch-only, explicit `.ts` extensions, no `node:fs` into
  client-safe modules, four gates green at wave boundaries, never run the full gate mid-wave.
- `RESUME.md` read (§2 gate contract, §5 hard rules, §3.5 lane brief).
- No browser is available in this sandbox → every interactive path that needs clicking is listed
  in §6 as NOT EXERCISED. Type-safety + single-file lint are the only executable evidence.

## 1. Task log (one entry per enacted/attempted TASK-nn)

All line refs are `src/components/console.tsx` unless stated. Landing order follows 111 §6.1
(TASK-03 → TASK-05 → TASK-02 → {04,08,09} → 07 → follow-ups).

| Task | Status | What changed | Evidence |
|---|---|---|---|
| **TASK-03** | ✅ landed | The hand-written run-on `aria-label` (whose order transposed `vault`/`design`/`diagram` against the DOM) is **deleted**. Both tablist labels are now **derived** from the same `RUN_TABS` array the triggers render from (`RUN_TABS` :129, `tabListLabel()` :144–149, applied at the two `Tabs.List`s). Announced order can no longer diverge from DOM order. | typecheck: 0 errors attributable to this file (§4); `npx eslint src/components/console.tsx` exit 0 |
| **TASK-05** | ✅ landed | Ten peer tabs → **3 primary + 7 behind a “More panels (7)” disclosure** (`RUN_TABS` :129–141, `RunTabTrigger` :162–170, strip :2505–2540, state :1484–1488). Every trigger carries a **one-line plain-language purpose** (in-file `{label, hint}` pattern). `RunTab` union untouched; **all 10 `Tabs.Content value=` blocks intact** — `grep -c '<Tabs.Content value='` → **10**, one block per RunTab value (§4). The row **wraps instead of `overflow-x-auto`** (111 §2 #10: right-hand tabs were outside both F-pattern sweeps). An advanced tab forces its tier open while active, so a trigger can never be hidden while its panel is on screen. | §4 counts |
| **TASK-02** (renders TASK-01) | ✅ landed (UI half only) | New **“What's happening / what now” panel** top-left in the run view, above the tab strip and rail (`RunStatusPanel` :359–442, mounted :2465–2477): where you are (`P{code} · title · step n/13`), what just happened (`lastTest` caption), and **one plain sentence + exactly one primary button**. Sentence and button come from ONE pure derivation `uiNextAction()` :268–328 (`kind · cmd · phase · why`, 111 §3.4 shape), with the **OpenHands JSON-echo guard** (`JSON_ECHO_RE` :239, `isJsonEchoSentence` :332) refusing a JSON-looking `why` in favour of a documented generic sentence. The button reuses existing handlers only (`nextPrimary` :1632–1640 → `onApprove` / `runUntil`). `cmd` renders next to the button as `verb: gate/approve/…` (recognition-over-recall, 111 §2 #2). When the failed-sandbox override is required the panel **withholds its Approve button** and points at the dock checkbox — the 110 UI-01 bypass class is deliberately not reproduced. `hitlNeedsOverride()` :250 is now the single source for the dock too (dock refactor :3079). | typecheck/eslint (§4) |
| **TASK-01** | ⛔ NOT enacted — **out of lane** | The envelope field needs `src/lib/headless.ts` = Lane 2's owned file (rule 5: stop and report). The UI derivation above is exactly the mapping the field needs, so TASK-01 is now a lift-and-move: `uiNextAction()` → `headless.ts` + `nextAction` on `ProjectSummary`. | — |
| **TASK-06** | ⛔ NOT enacted — **out of lane** | Spec asks for a NEW `scripts/README-cli.test.mjs` (not a UI component file → outside RESUME §3.5's ownership). It also duplicates RESUME §4 item 12 / **TA-3** (the verb-count drift is already on the docs+test backlog). | measured counts in §4 |
| **TASK-04** | ✅ landed | The rail's computed per-segment status words are no longer hidden in `title=`/`aria-label=`: a visible **“Now: P# · <plain word>”** line plus a **“Needs you: …”** line name every `awaiting_hitl` / `rejected` / `blocked` phase in words (`PhaseProgressRail` :2837–2875; lines rendered :2876–2886). Segment labels raised `text-[9px]` → `text-[11px]` (:2927). `{done}/{total} sealed · {pct}%` and all existing tones unchanged. | eslint 0; visual wrap NOT browser-verified (§5) |
| **TASK-08** | ✅ landed (+ 110 UI-05) | (a) the `Crew` tab now has the house `border-dashed` empty state in plain words (:2659–2668) — **110 UI-05 is closed**. (b) The Artifacts empty state on a new build now carries status + learnability + pathway: what appears there, which phase writes it, the **already-written `GUIDE_SECTIONS[0]` paragraph** (111 §4.2 re-surfacing, no new prose), and one primary **Run to next gate** button (:2582–2605). `ArtifactPane.empty` widened `string → ReactNode` (:3240); generic fallback + the other call sites unchanged. | eslint 0 |
| **TASK-09** | ✅ landed | “Run to next gate” is now the only solid/primary button; `Execute P#` keeps its handler and its `e` shortcut as a bordered **advanced** control. Both carry plain-language `title`s (:2147 “Advanced — run only this phase, then stop”; :2165 “Recommended — runs phases until something needs you”). Styling + titles only; no capability removed. | eslint 0 |
| **TASK-07** | ⚠️ PARTIAL (honest delta in §6) | `TERMS` (:1258–1284) + `Term` (:1291–1316) landed, built on Radix Tooltip (already a dependency; `Tooltip.Provider` wrapped per-Term because Radix requires a Provider and the app root is outside this lane's ownership). Wrapped in place: **HITL** dock kicker (:3084), **DoD** in the sidebar enforcement toggle (:5635, :5639) and the gate-verdict summary (:5535). Remaining bare tokens: `{p.hitl ? " · HITL" : ""}` chips (2 sites) and string literals (diagram hints, chat prompt text, Guide bodies — the Guide is explicitly excluded by TASK-07). The “long definition on expand” half renders **inside the same hover/focus popover** (short + long), not as a separate expand state. | eslint 0 |
| **TASK-10** | ⏳ attempt in progress at log-write time | If this row still reads “in progress”, the command palette did NOT land — treat as not attempted (§6). | — |
| **TASK-11** | ⛔ NOT attempted — out of lane as written | Its own done-when requires a **pure parser in `src/lib/` with a colocated `*.test.ts`** — outside this lane's file ownership (“new UI **component** files”). Lowest priority in 111 §6.1 (order 7). | — |

## 2. 110 §5 “TASKS THIS IMPLIES” derivation — DONE (mandatory cheap item)

`research/multiagent/110_ui_audit_vs_competitors.md` §5 `_(pending)_` is replaced **in place** (patch
applied 2026-09-16) with a list derived **only** from 110's own §1–§4: Priority 1 = UI-01/02/03 (the S1
shortcut bugs §1 calls “three real reliability bugs”); Priority 2 = the owner-complaint cluster plus
every ID §4 names (T-10, T-13, T-15, T-17…T-22, UI-08/10/14/16); Priority 3 = the copy-only rows
(UI-05…UI-14); plus an explicit **“unresolved by the intact sections”** note for **T-14/T-16** (IDs §4
CP-8 names with no subject pinned) and for T-01…T-09/T-11/T-12 (referenced nowhere → not
reconstructed). No new findings were invented; every row cites its anchor. Appendices A/C in that file
remain `_(pending)_` — not in this lane's brief, left untouched.

## 3. Out-of-lane / blocked items (reported, not enacted)

1. **TASK-01** — needs `src/lib/headless.ts` (Lane 2). Exact lift path recorded in §1.
2. **TASK-06** — needs a new `scripts/README-cli.test.mjs`; duplicates TA-3 (RESUME §4 #12). The
   measured verb-count facts are in §4 so the parent can hand the test to the docs lane.
3. **TASK-11** — not attempted (needs a new `src/lib/*.ts` + test; ownership).
4. **Sibling breakage observed, NOT fixed by me** — `npm run typecheck` at **19:31:16** → **exit 2**,
   5 errors, **all in sibling-owned files**: `src/lib/codegen.server.ts(269,9) TS7022`,
   `(270,9) TS7022`, `(368,26) TS2339` (Lane 3) and `src/lib/scaffold.ts(2362,13) TS2554`,
   `(2398,14) TS2554` (Lane 1). `codegen.server.ts` mtime **19:30:40** = 36 s before the check →
   a mid-edit sibling, not a regression from this lane. **`src/components/console.tsx` has 0 errors in
   that same log** (`grep -c console.tsx` → 0). Parent: re-run the four gates after all lanes stop.

## 4. Verification (exact commands + real observed results)

| Command | Observed |
|---|---|
| `npm run typecheck` (~19:20, before sibling edits appeared) | **exit 0** — typeclean tree containing my first four edits |
| `npm run typecheck` (19:31:16; stdout → `_tc216h.log`) | **exit 2** — 5 `error TS` lines, all sibling files; `grep -c console.tsx _tc216h.log` → **0** (my file clean) |
| `npx eslint src/components/console.tsx` (stdout → `_el216h.log`) | **exit 0**; log = 68 bytes of npm notices only (0 findings) |
| `grep -c '<Tabs.Content value=' src/components/console.tsx` | **10** |
| `grep -o '<Tabs.Content value="[a-z]*"' src/components/console.tsx \| sort \| uniq -c` | one block each for artifacts, chat, crew, design, diagram, oracle, packet, runtime, spec, vault |
| `grep -c 'case "' scripts/rapidtool-cli.mjs` vs `README-cli.md` claim | see §3.2 snapshot below |

**§3.2 snapshot (read-only, for TASK-06/TA-3 attribution):** `grep -c 'case "' scripts/rapidtool-cli.mjs`
→ **34** while `scripts/README-cli.md:3` claims **33** — confirming (not re-deriving) the drift 111
TASK-06 and RESUME TA-3 both report. No file other than my own was modified.

## 5. Interactive paths NOT exercised (no browser in this sandbox)

`npm run dev` on :8080 was **not** run (siblings mid-edit; a dev server is also not a verification this
sandbox can drive). Explicitly unverified:

- **Tab tiering (TASK-05):** clicking “More panels (7)”, selecting each of the 7 advanced triggers,
  arrow-key roving focus, and focus behaviour across the two `Tabs.List`s inside one `Tabs.Root`.
- **Collapse corner case:** with an advanced panel active, clicking “Fewer panels” leaves it visible
  (by design, `activeIsAdvanced`) — the toggle then needs a second click to change visibly. Cosmetic;
  unverified.
- **Status panel (TASK-02):** each state's sentence + button (run / approve / blocked-pointer /
  complete) on a real project; the override-blocked note.
- **Radix Tooltip (TASK-07):** hover **and** keyboard-focus opening, portal stacking above the sticky
  header/rail, per-Term `Tooltip.Provider` nesting.
- **Empty states (TASK-08):** a brand-new `create` project showing the Crew + Artifacts empty states.
- **Layout (TASK-04/05):** strip wrapping and the taller two-line triggers vs the `.rt-tab` active
  underline at 1024 / 1280 px.

## 6. Honest deltas

- **TASK-07 is PARTIAL**, exactly as described in §1: definitions landed for the three highest-visibility
  jargon sites; two `" · HITL"` chips and string-literal occurrences remain bare; the “expand” half is a
  combined hover/focus popover rather than a second disclosure state.
- **TASK-01, TASK-06, TASK-11** are reported, not enacted (ownership).
- **No unit test covers `src/components/console.tsx`** (111 §6.0 — verified by that lane). No tests were
  added or run by this lane; the change set is *safe to land* but *unverified by CI*, so a browser QA
  pass on :8080 is mandatory before the owner sees it.

