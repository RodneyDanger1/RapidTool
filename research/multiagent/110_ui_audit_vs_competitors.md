# 110 — Bug Hunt #2 + UI Usability Audit vs Competitors

**Lane:** UI usability audit + competitor comparison → non-breaking task additions
**Date:** 2026-09-16
**Status:** Sections 1–3 complete; 4–5 in progress
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main`
**Scope:** READ-ONLY audit. Only write is this file.
**Constraint:** every proposed task must be additive or refactor-safe — must not break the 1634-test suite, must not remove a working feature, must not delete capability.

## Owner's brief (verbatim)

> "IT IS VERY COMPLICATED FOR A UI/A LOT OF INFO/LOTS OF JARGON."

Desired end state: easier to use, more reliable, COMPACT ("not spread all over"), easier to read and understand, realistic for BOTH a human AND an AI agent, usable by a BEGINNER.

---

## 1. Verdict on UI usability in one paragraph

The console is **functional but over-dense and jargon-first**, and the owner's complaint is quantitatively
correct rather than a matter of taste. `src/components/console.tsx` is a single **5,452-line** file holding
**~70 components** with **60 `useState`** and **16 `useEffect`** hooks (`grep -c` on the file); the run
screen stacks **12 header controls + 13 action-bar controls + a 13-phase rail + 10 tabs** into one viewport,
so a first-time user sees roughly 48 interactive affordances before doing anything. Ten tabs are labelled
with nouns only (`Artifacts`, `Agent packet`, `Spec graph`, `Crew`, `Oracle`, `Vault`, `Design`, `Diagram`,
`Chat`, `Runtime log` — `console.tsx:2142-2201`) with no one-line purpose anywhere in the UI, and the tab
`aria-label` (`console.tsx:2139`) even lists them in an order that does not match the DOM order a screen
reader actually walks. More seriously, the audit found **three real reliability bugs** where a documented
shortcut does something the visible control forbids (`a` bypasses the DoD-override gate), where a shortcut
fires while a modal is open (`e` executes a phase behind the Guide/Settings dialog), and where an error
sentence names a checkbox whose real label is entirely different (`store.ts:1525` says "tick 'I reviewed the
failure'" while the control at `console.tsx:2731` reads "I reviewed the failing sandbox output and approve
anyway."). Empty-state coverage is uneven: the `Crew` tab renders nothing at all when there is no crew
(`console.tsx:2298-2311`) while the `Vault`, `Runtime`, `Chat`, `Diagram` and `Oracle` tabs all have honest
empty states — so "is it broken or is it empty?" is unanswerable in some tabs and clearly answered in
others. None of this is architecturally broken; it is a compaction + plain-language + guard-consistency
problem, and every fix below is additive or refactor-safe.

---

## 2. Tab inventory (tab → purpose → verdict: essential / redundant / jargon / unexplained)

Tab list is the `RunTab` union at `console.tsx:107`, rendered as Radix triggers at `console.tsx:2142-2201`,
panels at `console.tsx:2205-2368`. **Total: 10 tabs.**

| # | Tab (label) | Panel line | What it actually holds | Verdict |
|---|---|---|---|---|
| 1 | `Artifacts` | 2205-2246 | Searchable list of every artifact + body of the selected one | **Essential** (the primary work surface) — label is fine |
| 2 | `Agent packet` | 2248-2275 | The compiled `agent-packet.md` (paste-ready prompt for another agent) | **Essential** — label is jargon to a beginner ("agent packet" ≠ "the prompt you paste into an AI agent") |
| 3 | `Spec graph` | 2277-2296 | Ordered list of `specGraph.nodes` (owner · file · purpose) | **Jargon** — it is an ordered list, not a graph; the word "graph" sets a wrong expectation |
| 4 | `Crew` | 2298-2311 | Cards for `project.crew` roles (mandate / handoff / tools / budget) | **Unexplained + no empty state** — renders an empty `<div>` when `crew` is `[]`, no "nothing yet" text, no explanation of what a crew is |
| 5 | `Oracle` | 2313-2348 | Acceptance prose cases (given/expect) + machine-verify block + contracts summary | **Jargon** — "Oracle" is unexplained; a beginner cannot guess it means "acceptance tests" |
| 6 | `Vault` | 2350-2352 → 3285+ | Obsidian-style notes built from the run (MOC, wikilinks, tags, search, copy/download as .md) | **Jargon** — "Vault" is a product name from another tool |
| 7 | `Design` | 2358-2360 → 3887+ | Design tokens: colors, type scale, fonts, spacing, radius, shadows + CSS-var copy | **Redundant-ish for a beginner** — only meaningful once P6 has run; nothing tells the user that |
| 8 | `Diagram` | 2362-2364 → 4186+ | 4 SVG views (`flow` / others, `DIAGRAM_KINDS` at 4258) with download/copy | **Essential, badly named** — `flow` etc. are fine, but the tab gives no hint it is a rendered picture of the run |
| 9 | `Chat` | 2366-2368 → 4621+ | Grounded copilot over this build; read-only when no LLM key | **Essential — label understates it**; the empty state (4838-4848) explains it well, which proves the pattern exists and simply is not used elsewhere |
| 10 | `Runtime log` | 2354-2356 → 3202+ | Telemetry ring: uncaught errors, persist failures, watchdogs, + a `Diagnose` JSON dump | **Operator-only** — correct to keep, wrong to show a beginner at equal weight to Artifacts |

**Tab-count evidence:** `aria-label` at `console.tsx:2139` enumerates ten tab names; DOM triggers at
`2142/2148/2154/2160/2166/2172/2178/2184/2190/2196`. **Order mismatch:** the aria-label lists
`… crew, oracle, design, diagram, chat, vault, runtime log` while the DOM order is
`… crew, oracle, vault, design, diagram, chat, runtime log` — a screen-reader user who hears the label gets
a different sequence than the one they will Tab through.

**Consequence for the complaint:** seven of ten tabs are *findable only by clicking*, and none carries a
one-line "what is this for" in the UI. That is the single largest contributor to "a lot of info / lots of
jargon".

---

## 3. Usability findings (ID · severity · what the user experiences · file:line · fix)

Severity: **S1** = wrong/destructive outcome or blocked task · **S2** = confusing/dead end · **S3** = polish.

| ID | Sev | What the user experiences | Evidence (file:line) | Fix (non-breaking) |
|---|---|---|---|---|
| **UI-01** | **S1** | Pressing `a` ("Approve — when a gate is waiting", documented at `console.tsx:971` and shown in the in-app legend at `2014`) calls `onApprove()` with no force flag, while the *Approve button* is disabled until the operator ticks the override checkbox. On a failing-sandbox gate the user presses `a`, is refused by the store, and sees an error about a control they never saw. The shortcut and the button are not the same action. | button `console.tsx:2735-2743` (`disabled={needsOverride && !forceOverride}`); shortcut `console.tsx:1228-1232`; `function onApprove(force = false)` `console.tsx:1316`; store guard `src/lib/store.ts:1516-1527` | Route the shortcut through the same predicate as the button: `if (needsOverride && !forceOverride) { setError(...); return; }` — or better, focus the checkbox instead of approving. No API change. |
| **UI-02** | **S1** | **Shortcuts are not suspended while a dialog is open.** `Modal` (`console.tsx:5317-5364`) has no focus trap and does not register any "a modal is open" signal; the window-level shortcut listener (`console.tsx:1187-1251`) only bails when the event target is an `input`/`textarea`/`select`/contentEditable (`1190-1196`). So: open Guide / Settings / Shortcuts, press `e` → **the current phase executes behind the modal**, invisibly. Same for `g` (run to next gate) and `a` (approve). | `console.tsx:1187-1251`; `console.tsx:5317-5364`; `if (typing) return;` `console.tsx:1196` | Add a module-level "dialog open" guard: `if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;` (or lift a `anyDialogOpen` boolean into the handler). Additive, no store change. |
| **UI-03** | **S1** | Pressing `e` / `g` fires where the equivalent **button is disabled or does not exist**: the buttons are gated on `running || busyAction !== null` (`1798`, `1811`) and are only rendered in the non-HITL, non-complete, non-blocked branch (`1773-1840`); the shortcuts gate only on a UI latch `busyRef.current` (`1202`, `1222-1227`). During an in-flight run started elsewhere (wild mode / after reload with `rec.status === "running"`), `e` still calls `run()`. | `console.tsx:1795-1820` vs `console.tsx:1222-1227`; `busyRef` declared `1145` | Have both paths call one `canExecute()` helper reading the same store-derived predicate the button uses. Refactor-safe. |
| **UI-04** | **S2** | **Error copy names a control that does not exist.** The store's override refusal says *"tick 'I reviewed the failure'"* but the checkbox is labelled *"I reviewed the failing sandbox output and approve anyway."* — a user who typed the message into search will find nothing. | `src/lib/store.ts:1525` vs `console.tsx:2731` | Either reword the store string to quote the real label, or render the real label and point at it. Wording-only change; **the store string is asserted in tests — expect to update test expectations** (see §5 T-13). |
| **UI-05** | **S2** | `Crew` tab with no crew renders **an empty panel with no text at all** (`(project.crew ?? []).map(...)` with no length check) — indistinguishable from a broken tab. Every sibling tab has an empty state, so this is an inconsistency, not a design choice: Vault (`…`), Runtime (`3252-3256`), Oracle (`2326-2330`), Diagram (`4296-4298`), Packet (`2270-2273`), Spec (`2292-2294`), Chat (`4838-4848`). | `console.tsx:2298-2311` | Add the same `border-dashed` empty state used at `3253`: "No crew yet — the advisory crew is spawned from the action bar after a keyed run." Additive. |
| **UI-06** | **S2** | **Disabled-with-no-reason.** Intake's *Open intake* button greys out below 12 characters with no counter and no message (`1050-1058`) — contrast the HITL reject note, which shows a live `{n}/12` counter and a sentence (`2712-2722`). HITL's *Approve* also greys out with no adjacent explanation (`2738`). Wild toggle greys while pending with no reason (`450`). Diagram download/copy grey with no "no diagram yet" hint on the button itself (`4236`, `4246`). | `1052`, `2738`, `450`, `4236`, `4246` vs the good pattern at `2712-2762` | Reuse the reject-note pattern everywhere: a `{n}/12` counter + one sentence. Additive JSX only. |
| **UI-07** | **S2** | **A11y asymmetry:** *Reject* carries an `aria-label` that explains its disabled state plus an `sr-only` live region (`2748-2762`); *Approve* carries neither (`2735-2743`), so a screen-reader user is told why one button is dead and not the other. | `2748-2762` vs `2735-2743` | Give Approve the same `aria-label` branch + `sr-only` status. Additive. |
| **UI-08** | **S2** | **No way to know what a tab is for without clicking it.** Ten bare nouns (`2142-2201`); the only prose explanation of the whole console lives inside the Chat tab's empty state and the Guide modal. | `2142-2201`; good copy exists at `4838-4848` | Add a `title` / one-line subtitle per tab (or a first-run "what these tabs mean" strip). Additive. |
| **UI-09** | **S2** | **`?` opens the Guide, not the shortcut reference** — the near-universal dev-tool convention (`?` = shortcuts) is inverted, and the legend (`2023`) + `SHORTCUTS` table (`974`) both encode the inversion. Ref: Roo Code uses `?` for the shortcuts menu (`Roo-Code/apps/cli/src/ui/components/autocomplete/triggers/HelpTrigger.tsx:21-40`). | `console.tsx:1242-1245`, `974`, `2023` | Keep `?` working for the Guide (do not break muscle memory already documented) and **add** a `Ctrl+/`-style second binding + make the Shortcuts dialog show both. Additive. |
| **UI-10** | **S3** | **Five overlapping export affordances in one row** — "Copy agent packet" (`1858`), "Copy phase handoff" (`1866`), "Download packet (.md)" (`1884`), "Export" (`1892`, actually JSON), "Copy JSON" (`1900`). A beginner cannot tell which one to use; the owner's "spread all over" complaint lands exactly here. | `1858-1907` | Collapse into one "Export ▾" menu with three named items (Agent packet · Phase handoff · Full build JSON) — label change + progressive disclosure; keep all five code paths wired. Refactor-safe, no capability loss. |
| **UI-11** | **S3** | **Shortcut legend duplicated** in the action-bar footer (`2005-2025`) and in the `ShortcutsDialog` (`5425-5452`), with a third copy of the store-level truth in `SHORTCUTS` (`968-979`). Two of the three omit the override caveat for `a`. | `2005-2025`, `5425-5452`, `968-979` | Render the footer legend **from** `SHORTCUTS` (single source) and keep the dialog as the canonical list. Additive de-duplication. |
| **UI-12** | **S3** | **Token estimate shown twice** with different shapes: header chip `≈{n} tok` with tooltip `estimate · ±15% · modelRoute` (`1658-1663`) and packet term-bar `≈{n} tok · {chars} chars` (`2257-2259`). | `1658-1663`, `2257-2259` | Keep both but give the header chip the same wording as the term-bar, or drop the header duplicate. Wording-only. |
| **UI-13** | **S3** | **Raw machine payloads where a human needs a sentence:** runtime diagnosis dumps `JSON.stringify(d, null, 2)` into a `<pre>` (`3247-3249`); "Ingest report" asks the user to paste raw JSON and shows the schema inline in the placeholder (`1980`); build rows render a raw enum via `p.status.replace("_"," ")` (`1099`, also only replaces the *first* underscore). | `3247-3249`, `1980`, `1099` | Add a one-sentence summary line above each raw blob + a plain-language status map for the enum. Additive; the JSON stays available. |
| **UI-14** | **S3** | **Jargon with no tooltip on the landing screen** — the first thing a beginner reads is "a deterministic 13-phase graph with four onboard algorithms: Intent Lattice, FusionRank memory, Constraint Scheduler" (`1031-1035`), and the primary CTA is "Open intake" (`1056`) — the user is already *in* an intake form. | `1031-1035`, `1056`, `1039` ("Client brief") | Reword CTA → "Start build"; move the algorithm names behind a "what's inside" disclosure. Wording/JSX only. |
| **UI-15** | **S3** | **`Delete`-class action behind a reversible-sounding verb:** the Archive control (`1925-1931`) irreversibly deletes phases/artifacts/memory from the browser. It *does* confirm correctly (`2031-2036`: "Phases, artifacts, memory and gate decisions are deleted from this browser.") — recorded here as **verified-good**, so the fix is only the button label ("Archive" → "Archive (deletes from this browser)") not the dialog. | `1925-1931`, `2031-2055` | Label-only. |
| **UI-16** | **S3** | **Tab order of controls vs reading order:** on the run screen the destructive-ish/rare controls (Archive, Import, Copy JSON) sit in the same visual row as the primary Execute/Run-to-gate buttons with identical `min-h-11` weight (`1795-1931`), so there is no visual hierarchy telling a beginner what the *one* next action is. | `1795-1931` | Give the primary pair the only solid treatment and demote the rest into an overflow menu (pairs with UI-10). CSS/JSX only. |

### Notes on things checked and found NOT broken (so they are not re-reported later)

- Archive confirmation copy is honest and specific (`2031-2036`).
- Reject's 12-char gate is enforced in **both** the disabled attribute and the handler (`2739-2757` and `1327-1332`), with an explicit comment that it must not be bypassable — the *pattern* UI-01/UI-03 need already exists in this file.
- Clipboard failures are surfaced with role="alert" rather than silently swallowed (`1476`, `3935`, `3952`, `4289`).
- Wild-mode "stopped after reload" explains itself in a full sentence (`817-822`).
- Empty states exist and are well-written for Vault/Runtime/Oracle/Diagram/Packet/Spec/Chat.

---

## 4. Competitor-pattern comparison

Competitor sources read locally from `/c/Users/mnril/rt-competitors` (shallow clones already present in the
scratch dir: `OpenHands`, `cline`, `opencode`, `aider`, `bolt.diy`, `continue`, `Roo-Code`, plus
`ChatDev`/`codex`/`Devika`/`Dyad`/`MetaGPT`/`SWE-agent` etc.). Every "proving path" below is a file that was
opened and read in this audit.

| # | Pattern worth copying | Proving path (competitor) | What RapidTool does today | Task it implies |
|---|---|---|---|---|
| **CP-1** | **Collapsible run-step groups with a plain-language summary card.** Collapsed, a group shows the *most recent action's title* ("Editing path/to/file") plus a subdued "{completed}/{total} actions completed" with a spinner; once superseded it promotes "{count} actions completed ✓". Expanded, the children render verbatim. | `OpenHands/src/components/conversation-events/chat/event-message-components/event-group.tsx:36-56` (doc comment states the collapsed/expanded contract exactly) | A run's steps are scattered: a flat artifact list (`console.tsx:2205-2246`), a raw telemetry ring (`3202-3283`), and a 13-cell phase rail (`2461-2477`). There is no single "what just happened" surface. | **T-19** Run timeline strip, **T-20** current-step line |
| **CP-2** | **Error = short plain-language summary line + technical detail behind a chevron.** `ErrorMessage` renders a bold headline (translated by `errorId`, falling back to a generic key) and only renders `defaultMessage` when `showDetails` is toggled. Cline formalises the same shape in a type: `{ severity: "warning" \| "error"; summary: string; detail: string }` with `MAX_ERROR_SUMMARY_LENGTH = 140` and an unwrapper that strips JSON out of error strings. | `OpenHands/src/components/features/chat/error-message.tsx:12-45`; `cline/apps/cli/src/tui/utils/tool-errors.ts:1-6, 26-40` (140-char cap + `unwrapToolError`) | Mixed. ChatPane does it **right** — a code chip with an `agentAction` doc tooltip (`console.tsx:4425-4426`). But the runtime diagnosis dumps `JSON.stringify(d, null, 2)` into a `<pre>` (`3247-3249`) and "Ingest report" shows raw JSON as the placeholder (`1980`). | **T-17**, **T-18** |
| **CP-3** | **Context/token meter with a tone scale, a threshold action, and an explanatory confirmation** — headline token usage, a `neutral/warning/danger` tone map, a hover popover with the breakdown, and a "Compact the current task?" confirmation that explains the consequence in one sentence. | `OpenHands/src/components/features/chat/components/context-window-meter.tsx:36-46` (+ `context-window-ring.tsx`, `OpenHands/src/utils/format-token-count.ts`); `cline/apps/vscode/webview-ui/src/components/chat/task-header/ContextWindow.tsx:27-40` (+ `ContextWindowSummary.tsx:1-50` accordion of tokensIn/Out/cache) | Two static readouts: header chip `≈{n} tok` (`console.tsx:1658-1663`) and the packet term-bar `≈{n} tok · {chars} chars` (`2257-2259`). No tone, no breakdown, and the ±15% honesty note is tooltip-only. | **T-10** |
| **CP-4** | **One-row change summary that opens the detail drawer.** A single row shows the diff stats ("N files changed") with an icon and a per-file list behind it; the workbench `DiffView` adds a fullscreen toggle and per-line added/removed blocks. | `OpenHands/src/components/features/conversation/conversation-overview-diffs-row.tsx:1-40` (+ `OpenHands/src/hooks/use-conversation-overview-git-diff-stats.ts`, `OpenHands/src/utils/git-diff-stats.ts`); `bolt.diy/app/components/workbench/DiffView.tsx:1-45` | "Run module (bounded)" (`console.tsx:1821-1830`) executes generated source and `ExportSoftwareBlock` (`5249+`) handles the output, but nothing answers "what did this run actually change/produce?" in one line. | **T-21** |
| **CP-5** | **A progress list keyed by label with status + order, collapsible.** `ProgressCompilation` dedupes annotations by `label` (keeping the latest non-complete one), sorts by `order`, and renders a compact card that can expand. | `bolt.diy/app/components/chat/ProgressCompilation.tsx:8-50` | The phase rail shows status glyphs (`console.tsx:2461-2477`, `2528-2576`) but never states *what is running right now* in words. | **T-20** |
| **CP-6** | **`?` opens the shortcut/help reference, and the reference is a described list** (`HELP_SHORTCUTS` = shortcut + description pairs, e.g. "/" for commands, "tab" to toggle focus). | `Roo-Code/apps/cli/src/ui/components/autocomplete/triggers/HelpTrigger.tsx:21-40` | `?` opens the **Guide**, not shortcuts (`console.tsx:1242-1245`, documented at `974` and `2023`). No doc in the repo mentions shortcuts at all (`grep -rn -i shortcut README.md AGENT_GUIDE.md` → 0 hits), so nothing pins the current binding. | **T-22** |
| **CP-7** | **System events narrated in plain language inside the transcript** — a compaction event becomes a labelled divider with human wording ("No compaction needed.", manual vs auto). | `cline/apps/cli/src/tui/utils/compaction-status.ts:16-44, 67-111` (`formatCompactionDividerLabel`) | The runtime log prints raw event names and levels (`console.tsx:3264-3276`: `row.level`, `row.event`, `row.code`, `row.scope`) — honest, but not readable by a beginner. | **T-17** |
| **CP-8** | **Destructive confirmations state the consequence in a sentence next to the button** ("Compact the current task?" / "Replaces the conversation history with a summary…"). | `cline/apps/vscode/webview-ui/src/components/chat/task-header/ContextWindow.tsx:29-40` | Already correct for Archive (`console.tsx:2031-2036`) — recorded as the in-repo pattern to *reuse*, not a gap. The gap is that the button label itself sounds harmless (`1925-1931`). | **T-15** (label), reuse pattern for T-14/T-16 |

**Top three to steal (highest value per unit of work):** CP-1 (grouped run summary — directly answers "what is happening" without adding a tab), CP-2 (summary+detail error shape — turns every `RT_E_*` and JSON dump into one sentence), CP-3 (one compact meter instead of two chips — pure compaction).

## 5. TASKS THIS IMPLIES — concrete, non-breaking task additions

**Derivation note (added by Lane 5 / `fixes/216h_ui_wave.md`, 2026-09-16).** The original list was lost
when this lane died mid-section (`RESUME.md` §6.2). This replacement is **derived post-hoc from §1–§4 of
this document only**: every task below cites the intact anchor that justifies it, and nothing is
invented. Task IDs are preserved wherever §1–§4 already name them (`§3 UI-04` itself points at
"§5 T-13"; `§4` names T-10 and T-13…T-22). IDs that no intact section references (`T-01…T-09`, `T-11`,
`T-12`) are **not reconstructed** — there is nothing on disk to derive them from. Where §4 names an ID
but no intact section pins its subject (T-14/T-16), that is stated plainly instead of guessed.

**Constraint carried over from this file's header:** every task is **additive or refactor-safe** — must
not break the test suite, must not remove a working feature, must not delete capability. §3's "notes on
things checked and found NOT broken" is the do-not-re-report list.

### Priority 1 — the S1 reliability bugs §1 calls "three real reliability bugs" (land first)

| Task | Source anchor | Fix (exactly as §3 specifies) | Non-breaking note |
|---|---|---|---|
| **UI-01** | §3 UI-01 (S1) | Route the `a` shortcut through the same predicate as the Approve button: `if (needsOverride && !forceOverride) { setError(...); return; }` — or better, focus the checkbox instead of approving. | No API change. |
| **UI-02** | §3 UI-02 (S1) | Suspend the window-level shortcut handler while a dialog is open: `if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;` or a lifted `anyDialogOpen` boolean. | Additive guard; no store change. |
| **UI-03** | §3 UI-03 (S1) | One `canExecute()` predicate shared by the buttons and the `e`/`g` shortcuts (same store-derived state the button uses; replaces the `busyRef`-only latch). | Refactor-safe; the typing bail + modifier handling stay. |

### Priority 2 — the owner's complaint cluster: compaction + plain language (§1, §2, §3 UI-08/10/14/16, §4 CP-1/3/5)

| Task | Source anchor | Fix | Non-breaking note |
|---|---|---|---|
| **T-19** | §4 CP-1 | **Run timeline strip** — one "what just happened" surface (most recent action + `{completed}/{total}` + outcome) over data that already exists (artifact list, telemetry ring, phase rail). | Additive sibling view; nothing removed. |
| **T-20** | §4 CP-1 + CP-5 | **Current-step line, in words** — §4 states the rail "never states *what is running right now* in words"; add the plain sentence for the current/attention phase. | Additive text; rail tones untouched. |
| **UI-08** | §2 consequence + §3 UI-08 | One-line plain-language purpose per tab, derived from a data array (in-file `{label,hint}` pattern), so no tab is findable only by clicking. | Additive; tab count/values untouched. |
| **UI-10** | §3 UI-10 | Collapse the five overlapping export affordances into one "Export ▾" menu with three named items; **all five code paths stay wired**. | Label change + progressive disclosure; no capability loss. |
| **UI-14** | §3 UI-14 | Landing copy: CTA "Open intake" → "Start build"; the four algorithm names move behind a "what's inside" disclosure. | Wording/JSX only. |
| **UI-16** | §3 UI-16 (pairs with UI-10) | Give the primary pair the only solid treatment; demote the rare destructive/export controls — one visual hierarchy showing the *one* next action. | CSS/JSX only. |
| **T-10** | §4 CP-3 + §3 UI-12 | One compact token meter (tone scale + breakdown + explanatory wording) replacing the two differently-shaped readouts. | Keep the ±15% honesty note visible, not tooltip-only (CP-3's own precedent). |

### Priority 3 — copy/consistency fixes (§3 rows with unambiguous wording-only fixes)

| Task | Source anchor | Fix |
|---|---|---|
| **UI-04 → T-13** | §3 UI-04 (row says "see §5 T-13") | Reword the store's override-refusal string to quote the real checkbox label, or render the real label and point at it. **The store string is asserted in tests — expect deliberate expectation updates (record old → new).** |
| **UI-05** | §3 UI-05 | Add the standard `border-dashed` empty state to the `Crew` tab ("No crew yet — …"). |
| **UI-06** | §3 UI-06 | Reuse the reject-note pattern (`{n}/12` counter + one sentence) wherever a control disables itself with no reason: intake CTA, HITL Approve, Wild toggle, Diagram download/copy. |
| **UI-07** | §3 UI-07 | Give Approve the same `aria-label` branch + `sr-only` live region Reject already has. |
| **UI-11** | §3 UI-11 | Render the footer shortcut legend **from** `SHORTCUTS` (single source); keep the dialog as the canonical list. |
| **T-15** | §4 CP-8 + §3 UI-15 | Archive label states its consequence ("Archive (deletes from this browser)"). **The dialog copy is already correct — do not touch it** (§3 records it verified-good). |
| **T-17** | §4 CP-2 + CP-7, §3 UI-13 | Plain-language narration for system events/errors: one summary sentence above raw payloads; plain-language status map for the enum (including the `replace("_"," ")` first-underscore-only defect at `1099`). |
| **T-18** | §4 CP-2 | Summary+detail shape for the ingest flow: the raw-JSON placeholder and the runtime `JSON.stringify` dump each get a one-sentence headline with the blob behind a disclosure. |
| **T-22** | §4 CP-6 + §3 UI-09 | Keep `?` → Guide (documented; do not break muscle memory); **add** a second binding for the shortcuts dialog and make the dialog state both. |
| **UI-12 / UI-13** | §3 UI-12 / UI-13 | Folded into T-10 and T-17/T-18 respectively; retained as finding rows, no separate task. |

### Unresolved by the intact sections — stated plainly, not guessed

- **T-14 and T-16** — §4 CP-8 says only that the consequence-sentence pattern is to be *reused for
  T-14/T-16*, with T-15 pinned as the Archive label. The intact §§1–4 **do not name T-14's or T-16's
  subject**. Derived action (safe): audit the remaining irreversible/rare controls that §3 UI-16 lists
  in the shared action row (Archive · Import · Copy JSON) and either apply the CP-8 sentence shape or
  record them verified-good — the specifics must come from reading those controls, not from this file.
- **IDs `T-01…T-09`, `T-11`, `T-12`** — referenced nowhere in §1–§4; not reconstructed.

**Top three per §4's own ranking ("highest value per unit of work"):** **T-19** (CP-1), **T-18** (CP-2),
**T-10** (CP-3).

## Appendix A — Evidence log / commands used

_(pending)_

## Appendix B — Explicitly out of scope / already fixed today (do not re-report)

- CLI `approve` non-TTY guard (actor-seam)
- P6 tier switch
- doc/claim drift in AGENTS.md / README.md / phases.ts
- the non-JSON-200 guard in `deepseek.server.ts`
- `thinking` now forwarded by the `llm.ts` facade

## Appendix C — UNVERIFIED items

_(pending)_
