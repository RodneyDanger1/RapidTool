# 111 — UI/UX Design Research: A Governed 13-Phase Agent Console for Humans *and* Agents

> **Lane:** 111 · **Status:** COMPLETE (skeleton written first, then extended incrementally — all six sections + 2 appendices landed)
> **Scope:** READ-ONLY research + design. Deliverable is this file only. No source edits.
> **Hard rule:** every recommendation below must be *additive or refactor-only* — nothing may break the 1634/1634 green test suite or remove an existing capability. Each task carries an explicit **test-risk** line.
> **Evidence rule:** every non-obvious claim carries a URL I actually fetched this session, in §2 and Appendix A. Anything I could not fetch is confined to §2.1 / Appendix B and is marked `UNVERIFIED`.

## TL;DR — the three small changes with the largest effect

1. **Add a derived `nextAction` to the summary envelope** (`src/lib/headless.ts`) — one pure field that answers *"what do I do now?"* for the agent as JSON and, once rendered, for a beginner as one plain sentence plus one button. Currently **nothing** in any envelope says what to do next; the loop only exists as English prose in `scripts/README-cli.md`. Nowhere near the existing exit-2 "parked, a human must act" semantics, so no new taxonomy. (TASK-01/02)
2. **Tier the ten tabs into named families** — progressive disclosure's own remedy is *rank and defer*, not delete, so all ten panes stay reachable and the owner's "LOTS OF INFO" complaint is answered without losing capability. (TASK-05)
3. **Re-surface the plain-English copy that already exists** — `GUIDE_SECTIONS` (`console.tsx:886-907`) is five sections of genuinely well-written beginner prose locked behind a modal nobody opens, and `empty` states are a single generic sentence. Both onboarding authorities I fetched say contextual help beats tours; this is a re-wiring job, not a writing job. (TASK-07/08)

**Also worth knowing:** `cmdk`, `@radix-ui/react-collapsible`, `@radix-ui/react-accordion`, `@tanstack/react-table`, `react-resizable-panels` and `vaul` are all in `package.json` with **zero usages** in `src/` — so most of the compactness work needs **no new dependency**. And **no test in the suite reads the app console at all**, which makes UI work safe to land but unverified by CI (browser QA is mandatory, not optional).

---

## TOC

1. [The 5 biggest cognitive-load problems in a phase-based agent console](#1-the-5-biggest-cognitive-load-problems)
2. [Principles table — principle → source URL → what it means for *this* product](#2-principles-table)
3. [Agent-vs-human surface split recommendation](#3-agent-vs-human-surface-split)
4. [Beginner first-run design](#4-beginner-first-run-design)
5. [Compactness patterns with real precedents](#5-compactness-patterns-with-real-precedents)
6. [TASKS THIS IMPLIES](#6-tasks-this-implies)

**Evidence discipline:** every non-obvious claim carries a URL I actually fetched in this session. Anything I could not fetch is tagged `UNVERIFIED`. No invented studies, no invented numbers.

---

## 0. What I actually inspected (raw evidence log)

Everything below was read on this host, 2026-09-16. Line numbers are from the working tree **as of this lane**; note the tree is moving (see §0.3 drift warning).

### 0.1 RapidTool surfaces

| Surface | Fact (verified) | How I verified |
|---|---|---|
| `src/components/console.tsx` | **5,452 lines**, single file, ~70 components | `wc -l` |
| Run tabs | **exactly 10**: `artifacts · packet · spec · crew · oracle · vault · design · diagram · chat · runtime` | `RunTab` union at `console.tsx:107`; `Tabs.Trigger` block `console.tsx:2137-2202` |
| Tab `aria-label` | One long run-on sentence listing all 10 nouns, **in an order that does not match DOM order** | `console.tsx:2139` |
| `Tabs.Content` | All 10 use `forceMount` + `data-[state=inactive]:hidden` → **every panel stays mounted** | `console.tsx:2205-2370` (10 panes) |
| Jargon density in the UI file | `DoD` ×13, `HITL` ×7, `enforceDod` ×2 — as bare tokens, no definition in-place | `grep -c` per token |
| CLI verbs | `grep -c 'case "' scripts/rapidtool-cli.mjs` = **34** | direct count |
| CLI doc count | `scripts/README-cli.md:3` claims **33**, and claims it verified `grep -c 'case "'` = 33 | read + count — **docs are stale by one verb** |
| `scripts/README-cli.md` | **56,974 bytes** — the agent-facing contract | `ls -la` |
| `src/lib/headless.ts` | **135,062 bytes**, ~40 function-level exports (`createProject`, `runPhase`, `runUntilGate`, `approve`, `reject`, `retry`, `ingest`, `packet`, `exportJson`, `summary`, `buildVault`, `emitProject`, …) | `grep -n '^export'` |
| `ProjectSummary` shape (`headless.ts:832-857`) | Fields: `name, currentPhase, status, phaseCounts, lastGate, researchCount, memoryCount, vaultReady, failedGates, sealedWithFailures` | read |
| **Missing from `ProjectSummary`** | **No `nextAction` / `next` / `whatNow` field.** Nothing in any envelope says "do this next". An agent must infer it from `status` + `currentPhase` + `lastGate`; a beginner cannot infer it at all. | read — this is the single most load-bearing gap in this document |
| Existing empty state | Generic: `"Execute the current phase to write artifacts into the workspace."` fallback at `console.tsx:2855`, plus per-call overrides (`console.tsx:2240, 2293, 2400, 5143`) | read |
| Sibling lanes already landed | `110_ui_audit_vs_competitors.md` (142 lines, counts + 3 real shortcut bugs), `17_agent_ux_review.md` (machine-contract glossary), `18_chat_ux_research.md` (chat/error-code research) | read heads |

### 0.2 Competitor repos opened (cloned under `C:\Users\mnril\rt-competitors`, **not** in the repo)

| Repo | Files I actually opened | What it proves |
|---|---|---|
| `codex` (`openai/codex`) | `codex-rs/exec/src/event_processor.rs` (48 lines), `codex-rs/exec/src/exec_events.rs` (320 lines), `event_processor_with_jsonl_output.rs`, `event_processor_with_human_output.rs` | **One `EventProcessor` trait, two implementations** — `..._with_jsonl_output` and `..._with_human_output`. Identical event stream, rendered twice. This is the exact structural precedent §3 argues for. |
| `OpenHands` (`All-Hands-AI/OpenHands`) | `src/components/conversation-events/chat/event-content-helpers/get-action-event-title.ts` (147 lines) | Machine `ActionEvent.action.kind` → human title via `{kind:"translation", key, values}` **or** a server `summary` string. Crucially: `isServerFallbackSummary()` (line 21-22) **detects when the server merely echoed JSON and rejects it as a human label**. |
| `opencode` (`sst/opencode`) | `packages/` listing (`tui`, `protocol`, `session-ui`, `schema`, `server`) | Separate `tui` + `protocol` + `schema` packages — protocol/schema are first-class artefacts, not byproducts; the human TUI is one consumer. |
| `cline` | repo root (`apps/`, `sdk/`, `docs/`) | Monorepo where the extension UI is one app over an `sdk` — same one-core-many-surfaces split. |
| Also present from earlier lanes | `aider`, `bolt.diy`, `ChatDev`, `continue`, `Devika`, `Dyad`, `gpt-engineer`, `gpt-pilot`, `MetaGPT`, `pr-agent`, `Roo-Code`, `SWE-agent`, `developer` | — |

### 0.3 Drift warning

`17_agent_ux_review.md` cites `RunTab` at `console.tsx:91` and the trigger block at `console.tsx:1422-1480`. Both are **wrong today** — the union is at line 107 and the trigger block at 2137. Wave work has moved the file. Do not copy anchors from those docs without re-verifying.

---

## 1. The 5 biggest cognitive-load problems

Each problem is stated as: **what the user actually experiences** → **why it is a load** → **what a citable principle predicts**.

### P1 — Ten peer tabs with noun-only labels: no hierarchy, so nothing is "the point"

`Artifacts · Agent packet · Spec graph · Crew · Oracle · Vault · Design · Diagram · Chat · Runtime log` (`console.tsx:2137-2202`) are all rendered at **identical visual weight** in one horizontal strip. Three of those words (`Oracle`, `Vault`, `Crew`) are product-internal metaphors that mean nothing to a newcomer, and the `aria-label` is a single sentence enumerating all ten (`console.tsx:2139`) — so a screen-reader user hears the whole list before reaching any control.

*Why it is a load:* the strip is a flat choice set with no ranking. NN/g's information-scent research defines scent as the user's estimate of *"how likely it is that the page will provide an answer"* plus *"how long it's going to take to get the answer"* (https://www.nngroup.com/articles/information-scent/). Noun-only labels carry near-zero scent: `Vault` and `Oracle` do not tell you whether your question lives there. When every option has equal (low) scent, the rational move is to open all of them — which is exactly the "lots of info" complaint.

*Also:* Nielsen's heuristic #2, *"Match Between the System and the Real World — The design should speak the users' language. Use words, phrases, and concepts familiar to the user, rather than internal jargon"* (https://www.nngroup.com/articles/ten-usability-heuristics/). `Spec graph`, `Oracle`, `Crew`, `enforceDod`, `HITL`, `DoD` are internal jargon.

### P2 — No "what happened / what now": the highest-value sentence is absent

`ProjectSummary` (`headless.ts:832-857`) exposes `currentPhase`, `status`, `phaseCounts`, `lastGate`, `failedGates`, `sealedWithFailures`. It does **not** expose a next action. So:

- A **beginner** sees a phase rail and ten tabs and must reverse-engineer "am I waiting on the tool, or is it waiting on me?"
- An **agent** must re-derive the loop from `scripts/README-cli.md` §"Driving to completion (agent loop)" — prose, not data.

*Why it is a load:* Nielsen #1, *"Visibility of System Status — The design should always keep users informed about what is going on, through appropriate feedback within a reasonable amount of time… When users know the current system status, they learn the outcome of their prior interactions and determine next steps"* (https://www.nngroup.com/articles/ten-usability-heuristics/). Status *is* implemented (phase rail, `status` field). **Determining next steps is not.** The heuristic asks for both.

### P3 — Recognition failure: the CLI's own names are recall-only

34 verbs. The doc that names them is 57 KB. The envelope carries `cmd` and `exit_code` but the *user-facing* surfaces (tab strip, action bar) name things (`Oracle`, `Vault`, `Crew`) that do not match the verb names (`swarm`, `vault`, `crew`, `design`, `diagram`), and vice versa.

*Why it is a load:* Nielsen #6, *"Recognition Rather than Recall"*, expanded in NN/g's dedicated article: recognition means *"our ability to 'recognize' an event or piece of information as being familiar"* while recall is *"the retrieval of related details from memory"*, and recall is harder because *"the extra context helps users retrieve information from memory"* (https://www.nngroup.com/articles/recognition-and-recall/). When the UI label and the CLI verb differ, the user must hold **two** vocabularies in working memory and translate on every trip. That translation is pure overhead and it is the mechanism behind "LOTS OF JARGON".

### P4 — Everything is always on screen: no progressive disclosure

All ten panels are mounted simultaneously (`forceMount`, `console.tsx:2205-2370`); the `110` lane already counted **12 header controls + 13 action-bar controls + a 13-phase rail + 10 tabs** in one viewport — ~48 affordances before interaction. Nothing is deferred.

*Why it is a load:* Progressive disclosure, the canonical statement: *"Initially, show users only a few of the most important options. Offer a larger set of specialized options upon request. Disclose these secondary features only if a user asks for them, meaning that most users can proceed with their tasks without worrying about this added complexity"* — https://www.nngroup.com/articles/progressive-disclosure/. Nielsen's article names the exact dilemma the owner is describing, from the *designer's* side: users want *"power, features, and enough options"* **and** *"simplicity; they don't have time learn a profusion of features"*, and progressive disclosure *"is one of the best ways to satisfy both of these conflicting requirements."*

Note the important nuance, straight from the source: the fix is **not** to delete tabs. It is to rank them and defer the specialist ones. Deleting capability is also forbidden by this lane's hard rule, so the reading and the constraint agree.

### P5 — Scanning is F-shaped and the screens are structured against it

`Artifacts` is a master-detail pane (`grid md:grid-cols-[200px_minmax(0,1fr)]`, `console.tsx:2866`) — good. But other panes lead with prose/JSON bodies, and the tab strip is horizontally scrollable (`overflow-x-auto`, `console.tsx:2140`), so the right-hand tabs are literally off-screen at common widths.

*Why it is a load:* NN/g's eyetracking work found users scan in an F: a first horizontal sweep across the top, a **shorter** second sweep lower down, then a vertical scan down the left edge — and states plainly that *"The F-pattern is negative for users and businesses"* and that *"Good design can prevent F-shape scanning"* (https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/). Two concrete implications for this console: (a) with `overflow-x-auto` the tabs at the far right are past the end of both horizontal sweeps — effectively invisible; (b) any content that does not put its most important element in the top-left or as a left-edge scan target will be missed.

**A sixth, structural problem worth naming because it is one line of evidence:** the console is a **5,452-line single file**. That is not itself a UX defect, but it is why the UI drifts from the contract (see the 33-vs-34 verb drift in §0.1) — the doc and the code have no mechanical link, so every verb addition silently makes the doc *more* wrong.

---

## 2. Principles table

Every source in this table was **fetched in this session**; the quote after each URL is from that fetch. Nothing here is recalled from memory.

| # | Principle | Source (fetched) | Load-bearing quote from the fetch | What it means for **this** phase-based console |
|---|---|---|---|---|
| 1 | **Progressive disclosure** | https://www.nngroup.com/articles/progressive-disclosure/ | *"Initially, show users only a few of the most important options. Offer a larger set of specialized options upon request. Disclose these secondary features only if a user asks for them, meaning that most users can proceed with their tasks without worrying about this added complexity."* Also names the dilemma: users want *"power, features, and enough options"* **and** *"simplicity; they don't have time learn a profusion of features"* — PD *"is one of the best ways to satisfy both of these conflicting requirements."* | The ten tabs must be **tiered, not deleted**. Show ~3 primary (Artifacts, Chat, + a "What's next" panel); move `Crew / Oracle / Vault / Spec graph / Diagram / Design / Runtime log` behind an "Advanced" affordance. This directly satisfies the owner's "complicated / a lot of info" complaint *without* removing a capability. |
| 2 | **Recognition over recall** | https://www.nngroup.com/articles/recognition-and-recall/ | Recognition = *"our ability to 'recognize' an event or piece of information as being familiar"*; recall = *"the retrieval of related details from memory"*; recall is harder because *"the extra context helps users retrieve information from memory."* | The UI must **name the CLI verb wherever it names a concept**, and vice versa. If the pane says `Oracle`, it must also show `swarm`/`crew`; if the agent gets `cmd: "gate"` back, the UI should be able to render the same word. One vocabulary, shown twice — never two vocabularies the user must translate. |
| 3 | **Working-memory limits → offload to external memory** | https://www.nngroup.com/articles/working-memory-external-memory/ | *"the user interface requires them to keep in their working memory more than what their brains can hold"* is a *"frequent cause of difficulty"*; the remedy is *"user-interface features that can serve as an external memory."* | A 13-phase × gate × status × DoD-condition state space does not fit in working memory. The console must **persist and re-present** the current phase, the pending gate, the unmet conditions and the last decision **on one always-visible surface** — so the user never has to remember which tab held what. |
| 4 | **Short-term memory capacity** | https://www.nngroup.com/articles/short-term-memory-and-web-usability/ | *"short-term memory famously holds only about 7 chunks of information, and these fade from your brain in about 20 seconds"* — and the article explicitly warns it is *"a common misconception that limited short-term memory implies that menus should [be limited to 7 items]"*. | Two consequences, and the second is the one people get wrong. (a) Don't make the user hold phase names, verb names and error codes simultaneously. (b) **Do not** read this as "cut the tabs to 7" — the source itself rejects that reading. The lever is grouping and re-presentation, not a magic number. |
| 5 | **Cognitive load = intrinsic vs extraneous** | https://www.nngroup.com/articles/minimize-cognitive-load/ | *"the cognitive load imposed by a user interface is the amount of mental resources that is required to operate the system"*; the article splits **intrinsic** (the task itself) from **extraneous** load. | Governing a 13-phase build is *inherently* hard (intrinsic load — legitimate, keep it). Remembering which of ten tabs holds the audit trail, and decoding `enforceDod`, is *extraneous* load — pure waste. Every task in §6 targets extraneous load only; none simplify the governance itself. |
| 6 | **Structure / transparency / clarity / support** (cognitive-load reduction in complex flows) | https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/ | Four principles: *"Structure: Organize content logically to create a clear path to completion. Transparency: Communicate requirements and set expectations upfront. Clarity: Make content and interaction easy to understand and leave no room for ambiguity. Support: Provide timely, helpful guidance throughout the process."* Also: grouped sections let users *"focus on one information category at a time"* and *"Create a sense of progress as users complete each section"*; descriptive headings *"reduce cognitive load by establishing context before users encounter specific fields."* | Maps one-to-one onto the console. **Structure** = group the 10 panes into named families. **Transparency** = state the DoD conditions up front, not at the gate. **Clarity** = plain-language labels. **Support** = contextual help near the control. The "clear path to completion" is literally what a 13-phase rail is for — it just needs a label per step. |
| 7 | **Hick's Law** | https://lawsofux.com/hicks-law/ | *"The time it takes to make a decision increases with the number and complexity of choices."* Takeaways: *"Break complex tasks into smaller steps in order to decrease cognitive load"*, *"Avoid overwhelming users by highlighting recommended options"*, *"Use progressive onboarding to minimize cognitive load for new users"*. | The console presents ~10 tabs + 12 header controls + 13 action-bar controls. Hick's Law says *highlight a recommended option* rather than making all of them equal — i.e. a **single visually dominant primary action** on the run screen, with everything else de-emphasised. Note the source's own caution: *"Be careful not to simplify to the point of abstraction."* |
| 8 | **Simplicity wins over abundance of choice** | https://www.nngroup.com/articles/simplicity-vs-choice/ | *"An excess of choices can lead to fatigue and can make people feel dissatisfied with the experience, or even worse, abandon the process altogether."* And the key paradox: *"consumers are attracted to a large number of choices and may consider a product more appealing if it has many capabilities, but when it comes to making decisions and actually using the product, having fewer options makes it easier for people to make a selection."* | This is the exact tension between "we have 34 verbs / 13 phases / 10 tabs" (appealing on a feature list) and "beginner can use it" (needs fewer decisions at once). Justifies a **Beginner/Expert density toggle** rather than a permanent cut: the capability stays, the default decision count drops. |
| 9 | **Information scent** | https://www.nngroup.com/articles/information-scent/ | Users pick a link by estimating *"(1) how likely it is that the page will provide an answer to their question, and (2) how long it's going to take to get the answer."* Scent comes from *"the link label, the content that accompanies the link, the context in which the link is shown, and their prior experiences."* | `Vault`, `Oracle`, `Spec graph` have near-zero scent. Each tier-2 pane needs a **one-line purpose string in plain words** next to its label (not a tooltip — the source counts the label *and its accompanying content*). Cheap: the pane components already take `hint`-style props (`DIAGRAM_KINDS` at `console.tsx:4173-4176` already carries `label` + `hint` — the pattern exists in-file). |
| 10 | **F-pattern scanning** | https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/ | Scan shape = *"a horizontal movement, usually across the upper part"*, a **shorter** second horizontal movement, then *"a vertical movement"* down the left side. *"The F-pattern is negative for users and businesses"*; *"Good design can prevent F-shape scanning."* | Two concrete fixes: (a) the tab strip uses `overflow-x-auto` (`console.tsx:2140`) so right-hand tabs fall outside both horizontal sweeps — **wrap or group, don't scroll**; (b) put the status/next-action block in the **top-left**, which is where both the first sweep and the left-edge scan land. |
| 11 | **Nielsen heuristic #1 — Visibility of system status** | https://www.nngroup.com/articles/ten-usability-heuristics/ | *"The design should always keep users informed about what is going on, through appropriate feedback within a reasonable amount of time… When users know the current system status, they learn the outcome of their prior interactions and determine next steps."* | The console shows status but not **next steps**. Delivering "determine next steps" is the entire justification for the `nextAction` recommendation in §3. |
| 12 | **Nielsen heuristic #2 — Match between system and real world** | https://www.nngroup.com/articles/ten-usability-heuristics/ | *"The design should speak the users' language. Use words, phrases, and concepts familiar to the user, rather than internal jargon."* | Direct authority for replacing/annotating `DoD`, `HITL`, `enforceDod`, `Oracle`. Note the honest scope: the source says follow *"real-world conventions"* — a governance tool legitimately has domain terms, so the fix is **define-in-place**, not necessarily rename. |
| 13 | **Nielsen heuristics on *complex, domain-specific* applications** | https://www.nngroup.com/articles/usability-heuristics-complex-applications/ | NN/g explicitly applies the 10 heuristics to *"applications supporting the broad, unstructured goals or nonlinear workflows of highly trained users in specialized domains… systems supporting high-impact or high-value decision making."* On status: *"users benefit from detailed information about what is happening, such as time elapsed (or steps completed) and time or steps remaining."* | This is the **right precedent class for RapidTool** — a governed, high-stakes, nonlinear workflow for trained users, not a consumer app. It justifies *steps completed / steps remaining* on the phase rail, and it is the source that says detail is *good* in complex apps — the problem is not detail, it is **unordered** detail. |
| 14 | **WCAG 2.2 — new success criteria (AA target)** | https://www.w3.org/TR/WCAG22/ | The SC index confirms 2.2 added **2.4.11 Focus Not Obscured (Minimum)**, 2.4.12 Focus Not Obscured (Enhanced), 2.4.13 Focus Appearance, 2.5.7 Dragging Movements, 2.5.8 Target Size (Minimum), **3.2.6 Consistent Help**, 3.3.7 Redundant Entry, 3.3.8/3.3.9 Accessible Authentication. | The four that bite this console: **3.3.7 Redundant Entry** — never make the human re-type context the agent already holds. **2.4.11 Focus Not Obscured** — a sticky header/action bar must not cover the focused control (the console's action bar overlays are exactly this risk). **2.5.8 Target Size (Minimum)** — the tab strip uses `min-h-10 px-3`; check it. **3.2.6 Consistent Help** — the Guide/Settings affordance must sit in the same relative spot on every screen. |
| 15 | **SC 3.3.7 Redundant Entry (Level A)** | https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html | *"Don't ask for the same information twice in the same activity."* Normative text: *"Information previously entered by or provided to the user that is required to be entered again in the same process is either: auto-populated, or available for the user to select."* Intent: *"It reduces cognitive effort where information is asked for more than once during a process. It also reduces the need to recall information provided in a previous step."* | The brief, the gate rejection note, the DoD conditions and the project name are all *already entered*. Any new human-facing surface must **pre-fill** from project state rather than prompting again. This is the accessibility-blessed version of the `nextAction` idea. |
| 16 | **SC 2.4.11 Focus Not Obscured (Minimum), Level AA** | https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html | *"When a user interface component receives keyboard focus, the component is not entirely hidden due to author-created content."* Intent: *"the item receiving keyboard focus is always par[tially] visible."* | Any sticky phase rail / action bar / dock added for compactness must be audited against this. Relevant because `HitlDock` (`console.tsx:2127`) is an overlay-style dock. |
| 17 | **SC 3.2.6 Consistent Help (Level A)** | https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html | *"If a web page contains any of the following help mechanisms, and those mechanisms are repeated on multiple web pages within a set of web pages, they occur in the same order relative to other page content."* | RapidTool's help surface (the in-app Guide) is currently a dialog opened from a control. As the console gains tiers/panes, the help entry point must not move. Cheap to guarantee; expensive to retrofit after a layout change. |
| 18 | **Plain language** | https://www.plainlanguage.gov/guidelines/ (redirects to https://digital.gov/guides/plain-language) | *"Plain language – content that is clear and easy to understand – is critical to helping the public to make sense of their obligations and benefits."* Frames it as *"the law"* via the Plain Writing Act of 2010, and notes plain language is *"more efficient and effective."* | The *guidelines* page itself is now a hub; the substantive content lives in the linked sub-guides (*Principles of plain language*, *Writing for understanding*, *Design for understanding*). I fetched the hub and the hub's own framing is what I quote — see Appendix B for the part I did **not** fetch. |
| 19 | **Apple HIG — Onboarding** (fetched as JSON, since the HTML page is JS-only) | https://developer.apple.com/tutorials/data/design/human-interface-guidelines/onboarding.json | *"Ideally, people can understand your app or game simply by experiencing it, but if onboarding is necessary, design a flow that's fast, fun, and optional."* *"People tend to grasp and retain information better when they can actually perform the task they're learning about instead of just viewing instructional material."* *"Consider providing a collection of context-specific tips instead of a single onboarding flow."* *"If you need to present a prerequisite onboarding flow, design a brief, enjoyable experience that doesn't require people to memorize a lot of information."* *"If it makes sense to offer a separate tutorial, consider making it optional… don't present it again on subsequent launches."* *"Postpone nonessential setup flows or customization steps. Provide reasonable default settings so most people can immediately start interacting."* | This is the strongest available authority for §4. It says: **optional**, **interactive**, **contextual tips over a single flow**, **sensible defaults**, **don't re-show it**. It argues *against* a modal multi-step tour and *for* in-place hints + one worked example. |
| 20 | **Onboarding tutorials vs. contextual help** | https://www.nngroup.com/articles/onboarding-tutorials/ | *"Tutorials interrupt users, don't necessarily improve task performance, and are quickly forgotten. Contextual help signals can avoid these pitfalls but require unintrusive ways to activate."* The article's model is **push** revelations (bad) vs **pull** revelations (good) — help the user retrieves at the moment of need. | Same conclusion as #19 from a different source. The onboarding answer for a beginner is **a good empty state + one primary action + pull-based contextual help**, not a wizard. |
| 21 | **Empty states (3 guidelines)** | https://www.nngroup.com/articles/empty-state-interface-design/ | Empty states *"provide opportunities for designers to communicate system status, increase learnability of the system, and deliver direct pathways for key tasks."* Leaving them empty *"creates confusion and decreases user confidence — and misses a goldmine of opportunities."* Purpose-built empty states can: *"Communicate system status"*, *"Help users discover unused features and increase learnability"*, *"Provide direct pathways for getting started with key tasks."* | The console already has a generic fallback string (`console.tsx:2855`) and per-pane overrides (`2240, 2293, 2400, 5143`). Per this source those are under-used: an empty `Artifacts` pane should say **what would appear there, which phase writes it, and the one button that gets you there** — status + learnability + pathway, all three. |
| 22 | **Information architecture ceiling ("7±2" is a myth; grouping is not)** | https://www.nngroup.com/articles/short-term-memory-and-web-usability/ (same fetch as #4) | The article's explicit caveat: *"It's a common misconception that limited short-term memory implies that menus should [be limited to 7 items]."* Combined with #6's grouping guidance (*"Grouping related questions helps users retrieve information from memory more easily"*). | Recorded here as a **guardrail against a plausible-sounding wrong fix**: do not justify shaving ten tabs down to seven by citing Miller. The defensible move is grouping ten panes into 2–3 named families with honest labels. |

### 2.1 What I could *not* verify (do not build on these)

- **ISO 9241-110** (the seven dialogue principles: suitability for the task, self-descriptiveness, conformity with user expectations, learnability, controllability, error tolerance, individualisation). `https://www.iso.org/standard/75258.html` returned **HTTP 403**; the `ISO 9241-110` Wikipedia summary returned **404**; only the parent `ISO 9241` summary fetched. I therefore cite ISO 9241-110's existence as `UNVERIFIED` in this document and **build no recommendation on its exact wording**. That said: the framing you would want from it is already carried by fetched sources #1 (progressive disclosure = suitability/learnability), #2 (recognition = learnability), #12 (real-world match = conformity with expectations) and #15 (Redundant Entry = error tolerance). Zero loss.
- **ACM DL / CHI papers.** `api.openalex.org` did return two plausibly relevant "Progressive Disclosure" records (2019, 2020), but the titles alone do not establish a finding, and the DOI landing pages were not fetched. Treat as leads, not evidence:
  - 2019 — "Progressive disclosure", doi `10.1145/3301275.3302322` (OpenAlex record: https://api.openalex.org/works?search=progressive%20disclosure%20interface%20cognitive%20load)
  - 2020 — "Progressive Disclosure", doi `10.1145/3374218`
- **Microsoft "Guidelines for Human-AI Interaction"** — the MSR publication page fetched (HTTP 200, 186 KB) but I did not extract a quotable guideline list from it; treat as `UNVERIFIED` and build nothing on it.
- **`export.arxiv.org`** returned empty `<title>` sets for my two queries (`progressive disclosure + cognitive load`, `human-AI interaction + design guidelines`), i.e. the API answered but matched nothing I could read. No arXiv citations in this document.

---

## 3. Agent-vs-human surface split

### 3.1 The precedent is exact, and it is in Codex

`openai/codex` solves precisely this problem, and the shape of the solution is visible in the file names:

- `codex-rs/exec/src/event_processor.rs` defines **one trait**:

  ```rust
  pub(crate) trait EventProcessor {
      fn print_config_summary(&mut self, config: &Config, prompt: &str, session_configured: &SessionConfiguredEvent);
      fn process_server_notification(&mut self, notification: ServerNotification) -> CodexStatus;
      fn process_warning(&mut self, message: String) -> CodexStatus;
      fn print_final_output(&mut self) {}
  }
  ```
  (fetched: `event_processor.rs`, lines 13-29)

- Two implementations consume the **same** `ServerNotification` stream: `event_processor_with_jsonl_output.rs` (machine) and `event_processor_with_human_output.rs` (human).

So: **one event model, N renderers.** The machine envelope is not a debug dump of the human view, and the human view is not a pretty-print of the envelope. They are siblings over a shared event vocabulary.

### 3.2 The precedent for the *human* side of the mapping is OpenHands

`get-action-event-title.ts` takes a machine `ActionEvent` whose `action.kind` is a PascalCase discriminator (`ExecuteBashAction`, `FileEditorAction`, `GrepAction`, `GlobAction`, `ThinkAction`, `FinishAction`, …, lines 39-141) and returns `EventTitleDescriptor` — either `{kind:"translation", key, values}` (i.e. an i18n string with typed interpolation values) or `{kind:"text", text}`.

Two details worth stealing verbatim:

1. **Structured, not concatenated.** The mapping yields a *key plus values* (`ACTION_MESSAGE$READ` + `{path}`), so the human string is composable and translatable. A raw `"read src/a.ts"` string could not be localised or reworded without touching logic.
2. **The JSON-echo guard.** Lines 21-27:
   ```ts
   const isServerFallbackSummary = (summary: string): boolean =>
     /^[a-z][a-z0-9_]*\s*:\s*[[{]/i.test(summary);

   export const getActionSummaryTitle = (event: ActionEvent): string | null => {
     const summary = event.summary?.trim().replace(/\s+/g, " ") || "";
     return !summary || isServerFallbackSummary(summary) ? null : summary;
   };
   ```
   If the server-supplied "summary" is actually `field: {…}` or `field: […]` — i.e. raw JSON — the component **refuses it** and falls through to the curated human mapping. This is a direct, shipped defence of the rule "never show JSON to a human and call it a sentence."

Also worth noting structurally: `opencode` ships `packages/protocol`, `packages/schema`, `packages/server`, `packages/tui`, `packages/session-ui` as **separate packages**, and `cline` is `apps/` + `sdk/` + `docs/`. Both treat the protocol as a first-class product with multiple consumers. RapidTool already has this in embryo: `src/lib/headless.ts` is the shared engine that both the CLI and the console call.

### 3.3 RapidTool's current contract, and exactly where the split fails

**What exists and is genuinely good** (verified):

- CLI: *"Every subcommand prints a **single JSON object** to stdout (parseable by an AI agent) whose envelope always carries `schema_version: 1`, `cmd` and `exit_code`"* (`scripts/README-cli.md:32-34`).
- A **stable machine exit taxonomy** 0/1/2/3/4 where **exit 2 means "parked at a HITL gate or `blocked`"** — a machine-readable "a human must act" signal. This is better than most tools in the competitor set.
- Failures carry a stable `RT_E_*` code (`README-cli.md:34-36`), and there is a canonical registry (`src/lib/errors.ts`).
- `src/lib/headless.ts` is the single shared engine: `runPhase`, `runUntilGate`, `approve`, `reject`, `retry`, `ingest`, `summary`, `packet`, `buildVault`, `emitProject` are called by **both** the CLI and the console.

**Where it fails — and it is one gap, in three places:**

1. **No next-action anywhere.** `ProjectSummary` (`headless.ts:832-857`) = `{name, currentPhase, status, phaseCounts, lastGate, researchCount, memoryCount, vaultReady, failedGates, sealedWithFailures}`. There is no field that answers "what do I do now?".
2. **The loop lives in prose.** `scripts/README-cli.md` §"Driving to completion (agent loop)" spells the loop out as a fenced code block — *"loop: gate --project build.json --autopilot / if summary.status == 'complete' or 'blocked': stop / approve --project build.json"*. Only `--autopilot` is a real flag; the branching is documentation. An agent must **parse English** to drive the tool.
3. **The human sees nothing derived from any of it.** The console reads `headless.ts` state, but no component renders "you are here / waiting on you / here's the one button".

### 3.4 Recommendation: add ONE derived field, render it TWICE

The smallest change with the largest effect is **not** a UI rewrite. It is:

> **Add a pure, derived `nextAction` to the summary envelope, and render it both as JSON (for the agent) and as one plain sentence (for the human) — from the same computation.**

**The field** (proposed shape, machine-first):

```ts
/** Derived, pure, no side effects. Never fabricates: unknown state → kind "unknown". */
type NextAction =
  | { kind: "run";        cmd: "gate";   phase: PhaseId; why: string }
  | { kind: "approve";    cmd: "approve"; phase: PhaseId; why: string }   // exit-2 case: the run is parked on a human
  | { kind: "retry";      cmd: "retry";   phase: PhaseId; why: string }
  | { kind: "deepen";     cmd: "deepen";  phase: PhaseId; why: string }
  | { kind: "repair";     cmd: "repair";  phase: PhaseId; why: string }
  | { kind: "emit";       cmd: "emit";    phase: PhaseId; why: string }
  | { kind: "fix-gate";   cmd: "gate";    phase: PhaseId; why: string; unmet: string[] }
  | { kind: "unknown";    why: string };
```

`why` is a short **plain-language** sentence; `cmd` is the actual verb name. Note the deliberate properties:

- It is **pure and derived**, so it adds no state and no I/O → cannot break engine purity tests (`AGENTS.md`: *"telemetry code must NEVER change engine behavior (purity-tested)"*).
- It **reuses existing exit-code semantics**: exit 2 already means "parked, a human must decide", so `kind:"approve"` is the same fact the exit code already encodes — no new taxonomy.
- It **never invents**: the `unknown` arm is mandatory, matching the repo's `source:"illustrative"` honesty rule in `AGENTS.md`.

**The two renderings:**

| | Agent (machine) | Human (screen) |
|---|---|---|
| Where | `summary` envelope, and every verb's envelope | One line in a status-first panel, top-left |
| Shape | `"nextAction": {"kind":"approve","cmd":"approve","phase":"P5","why":"Phase 5 is finished and waiting for your approval."}` | **"Phase 5 is finished — it's waiting for your approval."** + a single primary button labelled **Approve**. |
| Precedent | Codex `event_processor_with_jsonl_output.rs` | Codex `event_processor_with_human_output.rs`; OpenHands `{kind:"translation", key, values}` |

**The mapping rule (from OpenHands' JSON-echo guard):** the human sentence must be produced by a **mapping from `kind`**, and if any producer ever supplies a pre-baked string, a regex guard like `isServerFallbackSummary` must reject it when it looks like serialized JSON. Copy that guard.

### 3.5 The three-tier surface contract (recommended, explicitly)

| Tier | Audience | Surface | Rule |
|---|---|---|---|
| **T1 — envelope** | Agents | one JSON object on stdout; `schema_version`, `cmd`, `exit_code`, `code`, `nextAction` | unchanged shape; strictly additive keys. Never prose. |
| **T2 — contract doc** | Agents **and** the humans who maintain the tool | `scripts/README-cli.md` | must be *generated or asserted* against the verb table (see TASK-06) so it cannot drift 33 vs 34 |
| **T3 — sentence** | Beginners | one plain sentence + one primary button, driving from `nextAction.kind` | never renders raw JSON; never invents a sentence; falls back to a documented generic string when `kind:"unknown"` |

The point of the split is that **T1 and T3 are derived from the same object**, which is exactly what Codex does with its two `EventProcessor` impls and what OpenHands does with `{key, values}`.

---

## 4. Beginner first-run design

### 4.1 The authority is unambiguous, and it forbids the obvious fix

Both onboarding authorities I fetched converge on the same conclusion, and it is **not** "add a wizard":

- **Apple HIG (fetched as JSON):** *"Ideally, people can understand your app or game simply by experiencing it, but if onboarding is necessary, design a flow that's fast, fun, and optional."* Plus: *"Consider providing a collection of context-specific tips instead of a single onboarding flow"*; *"If you need to present a prerequisite onboarding flow, design a brief, enjoyable experience that doesn't require people to memorize a lot of information"*; *"If it makes sense to offer a separate tutorial, consider making it optional… don't present it again on subsequent launches"*; and *"Postpone nonessential setup flows or customization steps. Provide reasonable default settings so most people can immediately start interacting."*
- **NN/g, Onboarding Tutorials vs. Contextual Help:** *"Tutorials interrupt users, don't necessarily improve task performance, and are quickly forgotten. Contextual help signals can avoid these pitfalls but require unintrusive ways to activate."* — the **pull revelation** model (help the user summons) beats the **push revelation** model (help that interrupts).
- **NN/g, empty states:** empty states *"provide opportunities for designers to communicate system status, increase learnability of the system, and deliver direct pathways for key tasks."*

So the strategy is: **make the first screen self-teaching and optional-help-driven; do not gate anything behind a tour.**

### 4.2 The asset nobody is using: the Guide copy is already written, and it is good

`GUIDE_SECTIONS` (`console.tsx:886-907`) is a five-section array of **already-plain-English** prose:

| # | Title | Line | Quality note |
|---|---|---|---|
| 1 | *What RapidTool is* | 888-889 | Opens with the framing sentence: *"A deterministic, governed pre-flight compiler. It turns a client brief into a paste-ready Agent Packet plus a 13-phase (P0–P12) audit trail. It does not build software itself — a real agent does the building under enforced, auditable constraints."* — this is the single best plain-language sentence in the codebase. |
| 2 | *Honesty contract* | 892-893 | Explains `source:"illustrative"`, advisory-vs-enforced DoD gates, and where the toggle lives. |
| 3 | *How to use a project* | 896-897 | **This is the loop, in plain English**: *"Run Execute / Run-to-next-gate until the run stops at a HITL gate. Approve or reject with 12+ characters of feedback…"* |
| 4 | *Feed results back* | 900-901 | The handoff cycle. |
| 5 | *What it is not* | 904-905 | Honest scope statement (no sandbox, no deploy, browser-local, FNV-1a not cryptographic). |

Every one of these is exactly what a beginner needs, and every one is **locked behind a modal the beginner has no reason to open**. The highest-leverage beginner change in this whole document is therefore not writing new copy — it is **re-surfacing copy that already exists and is already good**.

### 4.3 The minimum viable first-run (five changes, all additive)

**B1 — A "What's happening" panel, top-left, always visible.**
Placed where the F-pattern's first sweep and left-edge scan land (source #10). Renders three things, all pre-existing data:
1. **Where you are** — `P{currentPhase} · {phase title} · step {done}/13` (from `PhaseProgressRail`'s own `done/total` math, `console.tsx:2463-2466` — already computed).
2. **What just happened** — one sentence (`lastGate` or last artifact title).
3. **What to do now** — the `nextAction.why` sentence + **one** primary button (see B2).
This is the *"external memory"* of source #3 and the *"determine next steps"* half of heuristic #1 (source #11), in one block.

**B2 — Exactly one primary action.**
Today, two adjacent controls present as peers: `Execute {PHASE_CODE}` (`console.tsx:1806`) and `Run to next gate` (`console.tsx:1819`). But `Run to next gate` **subsumes** `Execute P#` — it runs phases until something stops it. For a beginner this is a meaningless fork; Hick's Law says *"Avoid overwhelming users by highlighting recommended options"* (source #7). Recommendation: make **"Run to next gate"** visually primary, and demote `Execute {PHASE_CODE}` to a secondary/advanced control. Note this changes *emphasis only* — both buttons keep their handlers, both keep their keyboard shortcuts (`e`, `g` at `console.tsx:969-970`), so **no capability is removed**.

**B3 — Empty states that carry status + learnability + a pathway.**
The pattern is already in-file but under-used. `ArtifactPane` accepts an `empty` prop whose generic fallback is *"Execute the current phase to write artifacts into the workspace."* (`console.tsx:2855`). Per source #21 the empty state should say three things: **what goes here**, **which phase writes it**, and **the one button that starts it**. The specific high-value upgrade: on a brand-new project, the `Artifacts` pane's empty state should render `GUIDE_SECTIONS[0].body` (the "what RapidTool is" paragraph) plus the primary action from B2. That is a copy-and-wire change, not a new component.

**B4 — Glossary-in-place, hover/expand, from data that already exists.**
`DoD` ×13, `HITL` ×7, `enforceDod` ×2 appear bare in `console.tsx`. `scripts/README-cli.md` and `GUIDE_SECTIONS[1]` already define each of them in plain words. Recommendation: a single exported `TERMS: Record<string,{short:string, long:string}>` map in `console.tsx`, plus one tiny `<Term k="HITL">HITL</Term>` wrapper that renders the short definition on hover/focus and the long one on expand. **Two reasons this is the right shape:** (a) Radix `Tooltip` is already a dependency; (b) it puts the definition *at the point of use*, which is what "pull revelation" means (source #20) — as opposed to a glossary page nobody visits. WCAG note: the definition must be reachable by keyboard, not hover-only — `@radix-ui/react-tooltip` handles `focus` as well as `hover` by default.

**B5 — A worked example, not a tour.**
Apple HIG: *"People tend to grasp and retain information better when they can actually perform the task they're learning about instead of just viewing instructional material."* The console already ships one: `build.json` is a complete 13-phase project on disk (`artifacts: 18`, `memory: 18`, `phases: 13`, `decisions: 4` — counted). Recommendation: a single **"Open the example build"** affordance in the first-run empty state that loads it, so the beginner sees a *finished* run before starting their own. This is the cheapest possible "worked example" and it teaches by inspection rather than by instruction.

### 4.4 What to explicitly NOT do

- **No modal welcome tour.** Both fetched onboarding sources say tutorials get skipped and forgotten (sources #19, #20), and `110_ui_audit_vs_competitors.md` already found shortcut bugs where keys fire *behind* an open dialog — adding a first-run modal makes that class worse.
- **No "7 tabs" rule.** Source #4 explicitly calls the 7-item menu reading *"a common misconception"*. Group and label; don't count.
- **No removal of `Oracle` / `Vault` / `Crew`.** Progressive disclosure (source #1) defers; it does not delete. And this lane's hard rule forbids removing capability.
- **No re-showing of onboarding on later runs** (HIG: *"don't present it again on subsequent launches"*).

---

## 5. Compactness patterns with real precedents

The owner's brief is *"COMPACT (not spread all over)"* — i.e. **same information, less spread**, not less information. Source #13 is the permission slip: in complex domain applications, *"users benefit from detailed information about what is happening"*. Detail stays; dispersion goes.

### 5.1 The decisive local fact: four of the six patterns need **no new dependency**

I checked `package.json` against actual usage (`grep -rn` across `src/`):

| Package | In `package.json` | Used anywhere in `src/`? | Verdict |
|---|---|---|---|
| `@radix-ui/react-collapsible` `^1.1.12` | ✅ line 31 | ❌ **zero hits** | **installed, unused — free win** |
| `@radix-ui/react-accordion` `^1.2.12` | ✅ line 27 | ❌ **zero hits** | **installed, unused — free win** |
| `cmdk` `^1.1.1` | ✅ line 57 | ❌ **zero hits** | **installed, unused — free win** |
| `@tanstack/react-table` `^8.21.0` | ✅ line 52 | ❌ **zero hits** | **installed, unused** |
| `react-resizable-panels` `^4.6.5` | ✅ line 68 | ❌ **zero hits** | **installed, unused** |
| `vaul` (drawer) `^1.1.2` | ✅ line 74 | ❌ **zero hits** | **installed, unused** |
| `lucide-react` | ✅ line 62 | used | — |
| `sonner` (toasts) | ✅ line 70 | used for copy feedback | — |

Consequence: the compactness work below is **not** a dependency-addition project. Collapsible detail, command palette, and drawer-based master-detail are all one import away. This is the single biggest risk-reduction finding in this section — no lockfile churn, no supply-chain review, no test-suite exposure from a new package.

### 5.2 Pattern-by-pattern, with the precedent I actually opened

| Pattern | Precedent I opened | What it looks like here | Risk |
|---|---|---|---|
| **Tabs → named sections** | `codex-rs/exec/src/event_processor_with_human_output.rs` — the human renderer groups the same event stream into typed sections (`render_item_started` / `render_item_completed`, lines 68 & 98) rather than dumping one flat log | Group the 10 `RunTab` values (`console.tsx:107`) into **2–3 named families** with the same 10 panes inside them. The `RunTab` union type is **unchanged**, so `setTab` call sites and every `Tabs.Content value=` keep working. Adding a tier is a *wrapper*, not a rename. | **Low.** Type union untouched → no compile break. Test risk ≈ 0 unless a test asserts tab-list markup (see §6 TASK-05 verification step). |
| **Timeline instead of a log** | `codex-rs/exec/src/exec_events.rs` — `ThreadEvent` is a **typed** timeline: `thread.started`, `turn.started`, `turn.completed`, `turn.failed`, `item.started`, `item.updated`, `item.completed`, `error` (lines 13-36), each carrying a typed payload, *not* text lines | RapidTool already writes NDJSON events under `<dir>/.rapidtool/logs/` (`AGENTS.md`) and `diagnose` reads them back. A timeline view renders those same events as a **typed list with start/complete pairing** instead of a raw tail. Crucially the console already has a raw tail (`RuntimeLogPane`, `console.tsx:3202`) — so this is an **additive sibling view**, not a replacement. | **Low — and it is the one place where "don't remove" matters most.** Keep `RuntimeLogPane` untouched; add a sibling. |
| **Master-detail** | `ArtifactPane` itself — `grid min-h-[280px] md:grid-cols-[200px_minmax(0,1fr)]` (`console.tsx:2866`): a scrollable list column + a detail column, with `md:` breakpoint collapse to stacked. This is already the house pattern. | Generalise *this* markup to the panes that don't have it (`Vault` already lists notes; `Design`/`Diagram` are single-subject). Do **not** invent a new layout language. | **Low.** Copying an existing in-file pattern. |
| **Collapsible detail** | No precedent needed — `@radix-ui/react-collapsible` is installed and unused (§5.1); the principle is progressive disclosure (source #1) | Wrap secondary blocks (raw JSON bodies, long prose, the full guide sections) in `<Collapsible>` so a pane leads with its summary. | **Low.** Purely additive wrapper. **Audit against SC 2.4.11** (source #16) so a collapsed/expanded state can't hide a focused control. |
| **Status-first cards** | `PhaseProgressRail` (`console.tsx:2461-2524`) — it already leads with `{done}/{total} sealed · {pct}%` and shows one segment per phase with a `tone` per status | This is the best-built component in the file and the model to copy: **status line first, detail second**. Generalise the same header to every pane ("N artifacts · updated 3m ago · P7") so each tab answers "is there anything here I need?" before the user reads content. | **Low.** Additive header rows. |
| **Virtualised tables** | ✗ **Do not do this.** I checked the real data: the shipped example project `build.json` holds `artifacts: 18`, `memory: 18`, `phases: 13`, `decisions: 4`. These are tens, not thousands. | **Recommendation: skip.** No virtualiser is installed (`@tanstack/react-virtual` is absent from `package.json`— verified), and `@tanstack/react-table`, though installed, **does not virtualise**; adding windowing would be a new dependency purchased against a list of 18 items. | **N/A — and this is a deliberate non-task.** Recorded so no one re-proposes it as a "compactness win". |

### 5.3 Two specific physical compactness defects I found

Both are objective, both are cheap, and neither requires a redesign:

1. **The phase rail labels are 9px monospace codes.** `PhaseProgressRail` renders each segment's label as `{p.code}` (`P0`…`P12`) at `font-mono text-[9px]` with `truncate` (`console.tsx:2516`). The **status word** (`Complete` / `Rejected` / `Awaiting approval` / `Running` / `Blocked`) is computed (lines 2486-2502) but exists **only** in `title=` and `aria-label=` (line 2508-2509) — i.e. **invisible to a sighted mouse-less user and to anyone who doesn't hover**. Combined with the F-pattern finding (source #10: the left edge is where the vertical scan lands), the rail is simultaneously the most-scanned element and the least readable. Fix: show the status word (or a status glyph) for the *current* and *awaiting-HITL* segments, and raise the label above 9px. Note the rail already does the right thing structurally — it uses `flex-wrap` (line 2471) where the tab strip uses `overflow-x-auto` (line 2140); the tab strip should copy the rail.

2. **The tab-strip `aria-label` is a run-on sentence in the wrong order.** `console.tsx:2139` reads `"Run console tabs: artifacts, agent packet, spec graph, crew, oracle, design, diagram, chat, vault, runtime log"` while the DOM order (lines 2143-2199) is `artifacts, packet, spec, crew, oracle, vault, design, diagram, chat, runtime`. `design`/`diagram` and `vault` are transposed. A screen-reader user is told the wrong order. It is a one-line fix, and it is exactly the class of defect that a "compactness" refactor would make permanent if not fixed first.

---

## 6. TASKS THIS IMPLIES

### 6.0 Verified test-safety baseline for every task below

Before proposing anything I checked what the 1634-test suite actually asserts about the surfaces these tasks touch. These four findings are the reason several tasks can honestly claim **zero test risk**:

| Check | Command | Result | Consequence |
|---|---|---|---|
| Does any test read `src/components/console.tsx`? | `grep -rln "components/console" src/ scripts/ --include=*.test.*` | **0 files** | The only `console.tsx` test reference is `src/lib/scaffold.test.ts:102,116,144`, and it asserts on `src/ui/console.tsx` — a **generated scaffold artefact**, not the app UI. **No test covers the app console at all.** UI edits cannot break a unit test; equivalently, UI edits are *unverified* by the suite and need browser QA. |
| Does any test deep-equality the `summary()` object? | `grep -rn "deepEqual(summary\|deepStrictEqual(s," src/lib/headless.test.ts` | **0 matches** | `headless.test.ts` asserts **individual fields** (`summary(red).sealedWithFailures` at lines 376, 393, 1354). Adding a field is additive-safe. |
| Does any test assert the CLI envelope's key set? | `grep -rn "Object.keys" scripts/*.test.mjs`; `grep -rn "schema_version" scripts/*.test.mjs` | **0 matches, both** | There is **no envelope-shape assertion anywhere** in the 195 scripts tests. A new envelope key cannot trip one. |
| Would an extra key be rejected by a validator? | `grep -rn "\.strict()" src/lib/*.ts` | **0 matches** | No strict zod schema on these objects. |
| How is the envelope built? | `scripts/rapidtool-cli.mjs:110-128` | `const out = { schema_version: SCHEMA_VERSION, cmd: CMD ?? null, ...result };` | The envelope is **spread-based**: a new key added to a verb's `result` flows to stdout automatically, with no change to `respond()`. |

**Read this honestly:** the UI is the least-tested surface in the repo. That makes UI tasks *safe to land* but *not safe to assume*. Every UI task below therefore names a browser verification step (`npm run dev` on :8080) rather than a unit test — because no unit test exists to run.

---

### TASK-01 — Add a derived `nextAction` to the summary envelope
**Size: S (≈30–60 LoC + tests)** · **Impact: ★★★★★** · **Land this first.**

- **Why:** `ProjectSummary` (`headless.ts:832-857`) answers *what is* but never *what now*. Every other task below either feeds this or renders it. It is the one change that serves the human **and** the agent from a single computation, and it is the only fix that addresses the owner's "realistic for a HUMAN **and** an AI AGENT" requirement in one stroke.
- **Where:** `src/lib/headless.ts` — a new pure `export function nextAction(project: Project): NextAction` next to `failedGates`/`summary`, plus one new field on `ProjectSummary` in the `summary()` return (`headless.ts:857-887`). Consumed for free by the CLI via the spread envelope (`rapidtool-cli.mjs:111`).
- **Done-when:** `summary()` returns `nextAction` with `kind`, `cmd`, `phase`, `why`; the mapping covers `complete` / `blocked` / `awaiting_hitl` / `rejected` / `sealedWithFailures` / locked-next / `unknown`; a test in `src/lib/headless.test.ts` asserts each arm on a fixture project; `node --experimental-strip-types scripts/rapidtool-cli.mjs summary --project build.json` shows the field on stdout and still exits 0.
- **Test-risk: LOW, verified.** No envelope key-set assertion exists (see §6.0) and no deep-equality on the summary object. The function must be **pure** (no `node:fs`, no I/O) to preserve the purity tests noted in `AGENTS.md`; the `unknown` arm is mandatory so it can never fabricate.

### TASK-02 — Surface `nextAction` as one plain sentence + one primary button
**Size: S (≈60–100 LoC)** · **Impact: ★★★★★** · **Needs TASK-01.**

- **Why:** The single biggest beginner win. Turns an 11-field JSON object plus a 13-phase rail into *"Phase 5 is finished — it's waiting for your approval."* + **Approve**. Directly implements Nielsen #1's *"determine next steps"* half, which is currently absent.
- **Where:** `src/components/console.tsx` — a new `StatusFirstPanel` component rendered in the run view **above** `Tabs.Root` (`console.tsx:2137`), positioned top-left so it lands in the F-pattern's first sweep. Wording keys come from a `NEXT_ACTION_COPY: Record<NextAction["kind"], (a: NextAction) => string>` map — **copy the OpenHands shape** (`{kind, values}`, not concatenated strings) so the sentence is rewritable in one place.
- **Done-when:** For each `nextAction.kind`, the panel renders the sentence and exactly one primary button wired to the existing handler (`onApprove` `console.tsx:1316`, `runToGate`, `onReject` `1324`); the button's label matches the CLI verb in `nextAction.cmd`; a JSON-echo guard (regex, per OpenHands `isServerFallbackSummary`) rejects any `why` that looks like serialized JSON and falls back to a documented generic sentence.
- **Test-risk: ZERO on the suite** (no test reads the app console — §6.0). **Real risk:** wiring a button to an existing handler. Mitigate by **reusing the existing handler props verbatim** — do not introduce a second code path to `approve`/`run`. Browser-verify on :8080 with `build.json` parked at a gate.

### TASK-03 — Fix the tab-strip `aria-label` order
**Size: XS (one line)** · **Impact: ★★★★ (correctness/a11y)** · **Do it before any tab refactor.**

- **Why:** `console.tsx:2139` announces `…crew, oracle, design, diagram, chat, vault, runtime log` while the DOM order is `…crew, oracle, vault, design, diagram, chat, runtime`. Screen-reader users are told the wrong order, and this line is *guaranteed* to be rewritten by any tiering work — fix it first or the bug ships inside the refactor.
- **Where:** `src/components/console.tsx:2139`.
- **Done-when:** the `aria-label` string matches DOM order exactly; better, the label is **derived** from the same array the tabs render from, so the two cannot diverge again.
- **Test-risk: ZERO.** No test reads this file (§6.0).

### TASK-04 — Make the phase rail's status legible (status word + label size)
**Size: S (≈20–30 LoC)** · **Impact: ★★★★**

- **Why:** `PhaseProgressRail` computes a status word for all 13 segments (`console.tsx:2486-2502`) and then hides it in `title=`/`aria-label=` (`2508-2509`), rendering only a 9px monospace `P0…P12` code (`2516`). The most-scanned region of the screen (F-pattern left edge) is the least readable. Fixing it makes "am I waiting on it, or is it waiting on me?" answerable at a glance without a new panel — which is why this is cheap.
- **Where:** `src/components/console.tsx:2460-2524`.
- **Done-when:** the current segment and any `awaiting_hitl`/`rejected`/`blocked` segment show a visible status word (or glyph + word) on screen, not only in `title`; the label size is increased above `text-[9px]`; the `{done}/{total} sealed · {pct}%` summary and the existing `tone` colours are unchanged (keep them — they already work); colour is not the sole status signal (also satisfies the spirit of WCAG 1.4.1, whose exact text I did **not** fetch — treat as good practice, not a cited conformance claim).
- **Test-risk: ZERO on the suite.** Browser-verify the 13-segment rail at 1280px and 1024px (it uses `flex-wrap`, so re-check wrapping with longer labels).

### TASK-05 — Tier the ten tabs into named families (do not remove any)
**Size: M (≈80–140 LoC, mostly JSX wrappers)** · **Impact: ★★★★★** · **Highest-value structural task.**

- **Why:** Ten peer tabs at equal weight is the literal "LOTS OF INFO" complaint, and progressive disclosure (source #1) says the fix is to *rank and defer*, not to delete. Tiering also fixes the `overflow-x-auto` F-pattern problem (`console.tsx:2140`) by removing the need for horizontal scroll.
- **Where:** `src/components/console.tsx` — the `Tabs.List` block (`2137-2202`) and `Tabs.Root` (`2137`). **Do not touch** the `RunTab` union (`console.tsx:107`) or any `Tabs.Content value=` (`2205-2370`).
- **Done-when:** Primary tier shows ~3 destinations (suggested: **Artifacts**, **Chat**, and **What's next**/Guide); a clearly-labelled *Advanced* affordance reveals the remaining seven; every one of the 10 panes is still reachable in one interaction from the run screen; each tab carries a **one-line plain-language purpose** derived from a data array (the `DIAGRAM_KINDS` `{id,label,hint}` pattern at `console.tsx:4173-4176` is the in-file model — reuse it); `grep -c "Tabs.Content value=" console.tsx` is still **10**.
- **Test-risk: LOW but non-zero, and stated precisely.** No test reads the file (§6.0), so the suite will not catch a mistake — the real risk is *silently dropping a pane*. **Land it safely by (a) leaving the `RunTab` union and all ten `Tabs.Content` elements byte-identical, (b) adding the tiering as a wrapper only, (c) asserting `grep -c 'Tabs.Content value=' == 10` in the landing log, and (d) browser-clicking all ten destinations.** Radix `Tabs` requires triggers and contents to stay under the same `Tabs.Root`; if tiering moves triggers out of the root the tabs will stop switching — that is the one failure mode to check in the browser.

### TASK-06 — Add a doc-contract test for the CLI verb count
**Size: S (≈25 LoC test)** · **Impact: ★★★★** · **Pure test addition, zero product risk.**

- **Why:** `scripts/README-cli.md:3` states **33 subcommands** and claims *"verified on disk: `grep -c 'case "' scripts/rapidtool-cli.mjs` = 33"*, while the actual count is **34** (verified this session). The doc and the code have no mechanical link, so the doc gets *more* wrong with every verb. This is the honesty contract (`AGENTS.md` §Honesty 3, "declare-or-strike") failing in the agent-facing contract itself — which matters more than any UI colour, because agents are told to trust this file.
- **Where:** new `scripts/README-cli.test.mjs` (the suite already runs `scripts/**/*.test.mjs` first — `package.json:19`), asserting: (a) `grep -c 'case "' rapidtool-cli.mjs` equals the number literally stated in `README-cli.md`; (b) every verb named in the README's command list appears as a `case` arm; (c) every `case` arm appears in the README list. Failure message must name the missing verb.
- **Done-when:** the test passes with the README corrected 33 → 34, and it fails (loudly, naming the verb) if either side drifts.
- **Test-risk: ZERO — it only adds a test.** Note the repo's cwd rule (`AGENTS.md`): scripts tests that touch platform chrome use temp-dir `cwd` isolation; this test is pure file-reading, so read paths relative to the test file, not the process cwd.

### TASK-07 — Glossary-in-place (`<Term>`) built from copy that already exists
**Size: M (≈60–90 LoC)** · **Impact: ★★★★**

- **Why:** `DoD` ×13, `HITL` ×7, `enforceDod` ×2 appear as bare tokens in the UI file, and Nielsen #2 says use the user's language rather than internal jargon. Critically, **the definitions are already written** in `GUIDE_SECTIONS[1]` (`console.tsx:892-893`) and `scripts/README-cli.md` — so this is a re-surfacing task, not a writing task. In-place definitions also satisfy "pull revelation" (source #20) rather than a page nobody visits.
- **Where:** `src/components/console.tsx` — add `const TERMS` and a `Term` component; wrap the bare tokens.
- **Done-when:** `HITL`, `DoD`, `enforceDod`, `Agent Packet`, `Oracle`, `Vault`, `Crew` each have a short definition shown on **hover and keyboard focus** and a long one on expand; `@radix-ui/react-tooltip` (already a dependency, `package.json:47`) is used so focus works without new code; a `grep` shows no remaining bare `HITL`/`DoD` occurrences outside the `TERMS` map and the Guide.
- **Test-risk: LOW.** Additive components only. **Verify keyboard access in the browser** — a hover-only definition would be an accessibility regression, which is the exact opposite of the intent.

### TASK-08 — Upgrade empty states to status + learnability + pathway
**Size: S (≈40–60 LoC)** · **Impact: ★★★★**

- **Why:** Empty states are *"a goldmine"* per source #21, and RapidTool currently ships a single generic fallback (`console.tsx:2855`) plus four one-line overrides (`2240, 2293, 2400, 5143`). The first-run experience *is* the empty state, so this is the cheapest onboarding work available.
- **Where:** `src/components/console.tsx` — `ArtifactPane`'s `empty` prop (`2824-2857`) and the four call sites.
- **Done-when:** each empty state names (1) what will appear here, (2) which phase produces it, (3) one button to start that phase; on a brand-new project the Artifacts empty state additionally shows `GUIDE_SECTIONS[0].body` (the "What RapidTool is" paragraph, `console.tsx:889`) and a single **primary** action; no empty state is a bare sentence.
- **Test-risk: ZERO on the suite.** Browser-verify with a fresh `create` project (all panes empty) — that is the state with no coverage today.

### TASK-09 — Demote the second primary action (`Execute P#`) 
**Size: XS (class changes only)** · **Impact: ★★★**

- **Why:** `Execute {PHASE_CODE}` (`console.tsx:1806`) and `Run to next gate` (`console.tsx:1819`) render as peers, but the second **subsumes** the first. For a beginner that is a meaningless fork; Hick's Law says *"highlight recommended options"* (source #7).
- **Where:** `src/components/console.tsx:1800-1830`.
- **Done-when:** `Run to next gate` is visually primary; `Execute {PHASE_CODE}` remains present, focusable, and functional as a secondary control; both keyboard shortcuts (`e` and `g`, `console.tsx:969-970`) still work.
- **Test-risk: ZERO on the suite** — and **negative risk to capability**, because nothing is removed. Note `110_ui_audit_vs_competitors.md` found an existing bug where the `a` shortcut can bypass the DoD-override gate; TASK-09 deliberately touches **styling only** so it cannot interact with that open defect.

### TASK-10 — A command palette over the 34 verbs (`cmdk`, already installed)
**Size: M (≈70–110 LoC)** · **Impact: ★★★★**

- **Why:** This is the cleanest fix for "LOTS OF JARGON" that does not hide anything. Recognition-over-recall (source #2) says give the user the option *in front of them* rather than making them recall it; the 34-verb surface is currently recall-only, documented in a 57 KB file. A palette makes verbs **typeable and findable by their plain-language description** while the CLI names stay canonical. `cmdk` is in `package.json` (`^1.1.1`, line 57) with **zero usages in `src/`** (verified) — no new dependency, no install.
- **Where:** new `src/components/command-palette.tsx` (a **new file**, per the repo's patch-only-after-creation convention), mounted once in `console.tsx` near the existing keyboard-shortcut handler (the `e`/`g`/`a` handler area, `console.tsx:969-996`, and the shortcuts dialog at `1604`).
- **Done-when:** opening with a keyboard shortcut, typing a plain word (*"approve"*, *"research"*, *"diagram"*) surfaces the matching verb plus its existing UI action; each entry shows the CLI verb name **and** a one-line plain description; already-bound single-key shortcuts are preserved (verify `e`/`g`/`a` still fire outside the palette, since `110` already found shortcut-scoping bugs); menu items are reachable and announced (Radix/`cmdk` give the ARIA wiring, but confirm the palette does not trap focus — WCAG 2.1.2 No Keyboard Trap is in the SC index I fetched).
- **Test-risk: LOW on the suite** (new component, nothing removed). **Genuine risk: keyboard-shortcut collision** — the repo already has a known bug class here. Land it behind a check that single-key shortcuts are suspended while the palette is open, and browser-verify with the shortcuts dialog open as well as closed.

### TASK-11 — Add a typed timeline sibling to the runtime log
**Size: M (≈90–130 LoC)** · **Impact: ★★★** · **Lowest priority of the set.**

- **Why:** A raw tail is not a narrative; the Codex `ThreadEvent` enum (`exec_events.rs:11-37`) shows the alternative — typed `item.started` / `item.updated` / `item.completed` / `turn.failed` with payloads, which lets a UI pair "started" with "completed" and show duration and outcome. RapidTool already emits structured NDJSON under `<dir>/.rapidtool/logs/` (`AGENTS.md`) and `diagnose` already reads it back — so the data model exists and only the view is missing.
- **Where:** `src/components/console.tsx` — a **new sibling pane** alongside `RuntimeLogPane` (`3202`).
- **Done-when:** the timeline renders the same NDJSON events as typed rows with `started`/`completed` pairing and a status per row; **`RuntimeLogPane` and its `Tabs.Content value="runtime"` are byte-unchanged**; a test asserts the timeline parser is **total** — every malformed/unknown line degrades to a raw row rather than throwing (matching the repo's honesty rule that telemetry "must never throw into the code it observes").
- **Test-risk: LOW-to-MEDIUM.** This is the one task that parses external data, so the parser should be a **pure exported function in `src/lib/`** with its own `*.test.ts` (the repo's house pattern: pure modules with colocated tests) rather than inline in the component. Then the risky part is unit-tested and the component is thin.

---

### 6.1 Ordering, and why

| Order | Task | Rationale |
|---|---|---|
| 1 | **TASK-03** | One line, pure correctness, and any tab work will otherwise bake it in. |
| 2 | **TASK-01** | Unblocks 02; additive field with a verified-empty blast radius. |
| 3 | **TASK-06** | A test-only change that makes the agent-facing contract self-policing. Zero product risk; do it while the surface is quiet. |
| 4 | **TASK-02** | Renders TASK-01. The visible payoff for a beginner. |
| 5 | **TASK-04, TASK-08, TASK-09** | Independent, small, cosmetic-to-cosmetic-plus. Can run in parallel across disjoint regions of one file — but see the caveat below. |
| 6 | **TASK-05** | Highest impact, highest blast radius. Do it **after** 03/04 so the fixes are not rewritten, and alone in its wave. |
| 7 | **TASK-07, TASK-10, TASK-11** | Follow-ups that build on the tiered layout. |

**Caveat on parallelism:** TASKs 02, 04, 05, 07, 08, 09 all edit `src/components/console.tsx`, which is **one 5,452-line file**. The repo's rule is *"Strict disjoint file ownership per concurrent wave"* (`AGENTS.md`) — so these **cannot** be parallel waves. They must either be serialised or split into new files first (which is itself the argument for extracting panes out of `console.tsx` over time).

### 6.2 The non-task (recorded so it is not re-proposed)

**Do not add table virtualisation.** `@tanstack/react-virtual` is not installed, `@tanstack/react-table` does not virtualise, and the largest real list in the shipped project is **18 rows** (`build.json`: `artifacts: 18`, `memory: 18`). Windowed rendering here buys nothing and costs a dependency. If artifact counts ever reach the thousands, revisit — not before.

---

## Appendix A — Sources fetched (URL → what it gave me)

All fetched 2026-09-16 from this host via `curl`. HTTP status in brackets.

| URL | Used for |
|---|---|
| https://www.nngroup.com/articles/progressive-disclosure/ [200] | PD definition + the power/simplicity dilemma (principle 1) |
| https://www.nngroup.com/articles/recognition-and-recall/ [200] | recognition vs recall definitions (principle 2) |
| https://www.nngroup.com/articles/working-memory-external-memory/ [200] | external-memory remedy (principle 3) |
| https://www.nngroup.com/articles/short-term-memory-and-web-usability/ [200] | 7 chunks / 20 seconds + the "menus should be 7" misconception (principles 4, 22) |
| https://www.nngroup.com/articles/minimize-cognitive-load/ [200] | intrinsic vs extraneous load (principle 5) |
| https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/ [200] | structure/transparency/clarity/support (principle 6) |
| https://www.nngroup.com/articles/information-scent/ [200] | scent = likelihood × effort (principle 9) |
| https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/ [200] | F-shape geometry + "the F-pattern is negative" (principle 10) |
| https://www.nngroup.com/articles/ten-usability-heuristics/ [200] | heuristics #1 and #2 verbatim (principles 11, 12) |
| https://www.nngroup.com/articles/usability-heuristics-complex-applications/ [200] | the complex/domain-specific application class (principle 13) |
| https://www.nngroup.com/articles/empty-state-interface-design/ [200] | the three empty-state purposes (principle 21) |
| https://www.nngroup.com/articles/onboarding-tutorials/ [200] | push vs pull revelations (principle 20) |
| https://www.nngroup.com/articles/simplicity-vs-choice/ [200] | the choice paradox (principle 8) |
| https://www.nngroup.com/sitemap.xml [200] | used to discover valid slugs (1733 article URLs) after two guesses 404'd |
| https://lawsofux.com/hicks-law/ [200] | Hick's Law statement + takeaways (principle 7) |
| https://www.w3.org/TR/WCAG22/ [200] | the full SC index incl. all WCAG 2.2 additions (principle 14) |
| https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html [200] | SC 3.3.7 normative text + intent (principle 15) |
| https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html [200] | SC 2.4.11 normative text (principle 16) |
| https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html [200] | SC 3.2.6 normative text (principle 17) |
| https://www.plainlanguage.gov/guidelines/ [200 → digital.gov] | plain-language hub framing (principle 18) |
| https://developer.apple.com/tutorials/data/design/human-interface-guidelines/onboarding.json [200] | Apple HIG onboarding best practices (principle 19) — the HTML page is JS-only, so the docs JSON endpoint was used |
| https://api.openalex.org/works?search=progressive%20disclosure%20interface%20cognitive%20load [200] | two DOI leads, not used as evidence (§2.1) |
| https://en.wikipedia.org/api/rest_v1/page/summary/ISO_9241 [200] | parent-standard description only (§2.1) |

**Failed / unusable, and therefore not relied on:** `iso.org/standard/75258.html` [403], `Wikipedia ISO_9241-110` summary [404], `m3.material.io/.../empty-states` [404], `nngroup.com/articles/hick-hslaw/` and `hick-hs-law-ux/` [404], `nngroup.com/articles/working-memory-overload/` [404], `nngroup.com/articles/information-architecture-systems/` [404], Apple HIG HTML page [200 but JS-only shell], Microsoft MSR guidelines page [200 but not extracted].

## Appendix B — UNVERIFIED items (explicitly not leaned on)

1. **ISO 9241-110's seven dialogue principles.** Could not fetch any authoritative text (ISO 403; Wikipedia 404). Named in §2.1 as context only; **no recommendation in this document depends on it**.
2. **Google Material Design 3 empty-state guidance.** `m3.material.io` 404'd on the path I tried; not used.
3. **Microsoft Research "Guidelines for Human-AI Interaction."** Page fetched but contents not extracted or quoted; treated as a lead only.
4. **arXiv.** Two API queries returned no readable matches. No arXiv citations appear anywhere in this document.
5. **ACM/CHI findings.** Two OpenAlex records titled "Progressive Disclosure" (2019, 2020, dois `10.1145/3301275.3302322` and `10.1145/3374218`) were **not** opened; they are recorded as leads, never as findings.
6. **WCAG 1.4.1 Use of Color** and **1.4.4 Resize Text** — I fetched the SC *index* but not their Understanding documents. Where TASK-04 mentions colour-independence and label size, it is justified as **usability practice** (F-pattern + status-visibility), **not** as a cited WCAG conformance claim.
7. **The claim that competitor UIs *look* a certain way.** I read competitor **source code**, so every competitor statement in this document is about code structure (`EventProcessor` trait, `ThreadEvent` enum, `get-action-event-title.ts`), never about rendered appearance. I did not run any competitor product.

