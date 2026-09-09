# 93 — Design-flaw ledger: tab-by-tab UI + step-by-step pipeline (ranked fix specs, competitor-compared)

- **File:** `research/multiagent/93_design_flaws.md` (repo root `C:\Users\mnril\Desktop\RapidTool Main`; git-bash `/c/Users/mnril/Desktop/RapidTool Main`).
- **Date / agent:** 2026-09-06 · deepseek-v4-pro subagent (PRO design-flaw auditor). **Strictly read-only on RapidTool source** — this file is the only new output (plus one append-only §11 tail on `90_LEAPFROG.md`, per mission B).
- **Scope (numbered, per mission):**
  1. UI walk **tab by tab** — Home, Run screen (header, phase rail, progress rail, HITL dock, Wild Console, memory sidebar, gate log, diagnostics), and the 9 tabs (Artifacts, Agent packet, Spec graph, Crew, Oracle, Vault, Design, Diagram, Chat) + Settings/Guide/Shortcuts modals — every surface: what it shows, what it *should* show (competitor UX mechanics), every flaw.
  2. Pipeline walk **step by step** — P0–P12, DoD gates, verify loop, crew, wild, deepen, chat server, CLI verbs — every design flaw in what it *does* vs competitors.
  3. **Feature surface** — vault / knowledge / harvest / bench / swarm / watcher / ast-mine / prompt-engine / exportProfiles / verifyAndFix: what each claims vs what it actually does on disk (overclaim/underdeliver findings).
  4. The full ranked ledger below, with severity, evidence `file:line`, competitor reference, fix direction.
- **0-hallucination rule:** every RapidTool claim below carries a `file:line` read or grepped **this session** (files read in full: `console.tsx` 1–4958, `engine.ts` 1–2439, `store.ts` 1–1206, `packet.ts` 1–600, `phases.ts`, `types.ts`, `crew.ts`, `chat.ts`, `verify.ts`; heads of `vault/knowledge/harvest/bench/swarm/watcher/ast-mine/prompt-engine/verify.server/crew.server/wild-mode.server/dod/report-intake/sandbox/templates/algorithms`; greps on `deepseek.server.ts`, `chat.server.ts`, `exec.ts`, `handoff.ts`, `rapidtool-cli.mjs`, `headless.ts`). Competitor claims cite pages **fetched this pass (✓TODAY 2026-09-06)**: Cursor Plan Mode [CP], Claude Code Best Practices [CB], Gemini CLI Checkpointing [GK], Devin Knowledge [DK], Codex CLI [CX] — plus 42's same-day register [A#]/[C#]/[G#]/[D#] as carried in 90 §1. No tests were executed (doc-only deliverable per house convention §Tooling-gotchas; behavior claims are pinned to the test-pinned modules named in the evidence).
- **Rank rubric:** **P0** = design flaw that ships fabricated/wrong-domain/overclaimed output to the operator or a downstream agent, or a gate ceremony that approves something that does not exist. **P1** = user-visible wrongness, missing critical state/affordance, or contract violation. **P2** = guidance, polish, hygiene, dead copy.
- **Consumes:** 86/87/88 verdicts (1.0–2.2/10 product runs), 89 §0/§6, 90 §1–§10. **Feeds:** the LEAPFROG compiler (§11 of 90) and the next fix wave.

---

## §0 Verdict

**There are no *new* crashes or injection bugs here — the honesty machinery itself is the best part of this product (see §2). The design flaws are one systemic defect plus its UI/gate camouflage.** The systemic defect (proven by verdicts 86/87/88, re-verified on disk this pass): **the 13-phase pipeline governs to completion a *different product than the briefed one*** — P6 emits a deterministic phase-gate simulator toy (`sandbox.ts:125-161`), P8 emits a description of RapidTool's own console (`engine.ts:585-606`), P1 emits a fixed agent-harness topology (`engine.ts:347-376`) — and several phases state unimplemented capabilities (checkpoints, MCP/A2A, Ollama, Brave MCP) as accomplished fact without the disclaimer only P4 carries. The UI then presents all of this with full seal-and-gate ceremony, so a user watching the run screen sees *governed progress*, not *wrong product*. Everything else in this ledger is either (a) camouflage of that defect (DF-07/08/09/18/22), (b) missing competitor-parity affordances that make the product feel broken (DF-10…13, 16), or (c) unwired feature pillars (DF-24/25).

| ID | Rank | One-line | Location |
|---|---|---|---|
| DF-01 | P0 | P6 codegen = phase-gate simulator toy; brief never enters generated code | `sandbox.ts:125-161`, `engine.ts:493-531` |
| DF-02 | P0 | P8 "interface contract" describes RapidTool's own console, not the client's UI | `engine.ts:585-606` |
| DF-03 | P0 | P1 topology artifact fixes every build to the agent-harness domain | `engine.ts:347-376` |
| DF-04 | P0 | Unimplemented capabilities (checkpoints, MCP/A2A, Ollama, Brave MCP) stated as fact; only P4 is disclaimed | `engine.ts:377-429,653-704` |
| DF-05 | P0 | P4 HITL asks approval of a 256 MB/30 s network-denied isolate that does not exist | `engine.ts:439-462` vs `engine.ts:1104-1111` |
| DF-06 | P0 | "Durable checkpoint" artifact claims persistence that no layer provides | `engine.ts:384-386` vs `store.ts:1180-1206` |
| DF-07 | P0 | Spec graph/contracts/crew = fixed web-app topology presented as the build's plan, no template label | `algorithms.ts:398-446`, `console.tsx:2285-2318` |
| DF-08 | P1 | Gates advisory by default; FAIL-gated phases still advance and count as "sealed" | `store.ts:360-401`, `console.tsx:2460-2462` |
| DF-09 | P1 | Approval needs no note even over an unmet DoD (null-note asymmetry) | `engine.ts:900-991`, `console.tsx:2712-2730` |
| DF-10 | P1 | No undo/checkpoint/restore anywhere; ledger append-only and irreversible | `engine.ts:2033`, vs [GK] ✓TODAY |
| DF-11 | P1 | HITL evidence = artifact titles only; no diff/criteria review | `console.tsx:152-205` vs [A3] |
| DF-12 | P1 | Chat not persisted, not streamed, no stop button | `console.tsx:4362`, `deepseek.server.ts:233` vs [CX] ✓TODAY |
| DF-13 | P1 | Chat context cap invisible; no context meter | `chat.server.ts:48,218` vs [CX] ✓TODAY |
| DF-14 | P1 | Crew tab shows static template seats; live crew transcript lands elsewhere, unpresisted | `console.tsx:2306-2319` vs `1948-1988` |
| DF-15 | P1 | Oracle tab shows cases that are never run; no verdicts | `console.tsx:2321-2342`, `algorithms.ts:510` |
| DF-16 | P1 | Verify-fix machine loop exists but is invisible in the UI | `verify.ts`, `verify.server.ts:503` |
| DF-17 | P1 | Vault is read-only while 90 §9.3 designates it the human edit surface | `console.tsx:3188` vs [DK] ✓TODAY |
| DF-18 | P1 | Scorecard UI drops the "deterministic estimate" label the packet carries | `console.tsx:2566-2629` vs `packet.ts:311` |
| DF-19 | P1 | Live research never updates scorecard/competitors | `engine.ts:1679-1711` |
| DF-20 | P1 | P5 title "…& Self-Learning" — no loop exists behind it | `phases.ts:44-50` |
| DF-21 | P1 | P7 competitor matrix = 5 hardcoded domains + 2 shared rows | `engine.ts:50-77` |
| DF-22 | P1 | Rejection response is keyword-matched template prose ("Deltas applied") | `engine.ts:165-180,819-825` |
| DF-23 | P1 | Wild strip renders pauses without the machine-readable code | `engine.ts:2027` vs `console.tsx:776-905` |
| DF-24 | P1 | Learning pillars (knowledge/harvest/bench/ast-mine/watcher) unwired to any run | `headless.ts:1476-1483` (CLI-only) |
| DF-25 | P1 | Six tool-specific handoff profiles landed but never wired | `packet.ts:434-600` vs `console.tsx:1507` |
| DF-26 | P1 | Packet truncation marker buried in body; no UI affordance | `packet.ts:349-351`, `console.tsx:2274` |
| DF-27 | P2 | Home CTA silently disabled under 12 chars; no counter/guidance | `console.tsx:1076-1084` |
| DF-28 | P2 | Home templates = 4 ops-domain briefs; auto-seeded demo project presented as a build | `templates.ts:1-26`, `store.ts:1163-1178` |
| DF-29 | P2 | Run header ≈25 controls, no grouping/progressive disclosure | `console.tsx:1616-1947` |
| DF-30 | P2 | Memory sidebar: 8-row cap, no vault link, E-18 provenance unrendered | `console.tsx:2378-2391` |
| DF-31 | P2 | Dead empty-states: spec tab "open a brief first"; memory "until Phase 0 writes" — both impossible post-creation | `console.tsx:2301,2389` |
| DF-32 | P2 | Artifact tab: no kind filter, no sort, no edit/delete | `console.tsx:2213-2254` |
| DF-33 | P2 | Vault and packet downloads share one filename | `console.tsx:3312` vs `1547` |
| DF-34 | P2 | Markdown renderer subset: tables/links/inline-code unsupported | `console.tsx:2918-3061` |
| DF-35 | P2 | Diagram tab: static data-URI image, no pan/zoom/navigation | `console.tsx:4091-4208` |
| DF-36 | P2 | Wild toggle degrades to local-only state but looks enabled | `console.tsx:500-590` |
| DF-37 | P2 | P12 ADRs/OpenAPI canned, disconnected from the real decision ledger | `engine.ts:705-754` |
| DF-38 | P2 | CLI lacks eval/replay/restore/plan verbs | `scripts/rapidtool-cli.mjs` (27 verbs) |
| DF-39 | P2 | LLM-extracted constraints (P2) never consumed by the scheduler | `engine.ts:1732-1750` |

---

## §1 Method (what I walked, in what order)

1. `console.tsx` read in full (4 958 lines) — every tab/pane/dock/modl enumerated below with its line range.
2. Backing data walked per tab: `store.ts` (state + every action), `types.ts` (Project shape), `engine.ts` (synthesis + transitions), `algorithms.ts` (lattice/spec/crew/oracle templates), `dod.ts` (gate registry), `packet.ts` (compiler + handoff profiles), `sandbox.ts` (P6 module emitter), `crew.ts`/`crew.server.ts`, `chat.ts`/`chat.server.ts`, `verify.ts`/`verify.server.ts`, `wild-mode.server.ts`, `vault/knowledge/harvest/bench/swarm/watcher/ast-mine/prompt-engine`, `templates.ts`, `report-intake.ts`, `handoff.ts`, `headless.ts` exports, `scripts/rapidtool-cli.mjs` verb list, `routes/index.tsx` + `run.$id.tsx`.
3. Competitor UX pages fetched ✓TODAY for the comparison column (sources in §7).

---

## §2 Verified-safe baseline — do NOT re-litigate these in the fix wave

- **Honesty envelopes are real and everywhere.** Typed `{ok:false, reason:"not-configured"}` before any network I/O: `crew.ts:5-8`, `crew.server.ts:18-21`, `chat.ts:30-36`, `wild-mode.server.ts:34` (`WILD_FEEDBACK_MIN = 12`), `verify.server.ts:15-17`, `prompt-engine.ts:10-12`, `harvest.ts:10-27`. The classifier refuses to fabricate a judgment when unconfigured (`engine.ts:2092-2146`; `wild-mode.server.ts`).
- **HITL law is law.** `forceHuman` gates can never be autopilot-approved (`engine.ts:2166-2175`); autopilot barred from stock HITL phases and DoD-failing gates (`store.ts:226-234`); rejection requires ≥12 chars in engine, store AND UI (`engine.ts:993-1001`, `store.ts:1015`, `console.tsx:1353-1358`) — the triple guard is correctly duplicated, not trusted to one layer.
- **Append-only decision ledger.** `engine.ts:2033` `wildLog`, `hitl.approved/rejected` rows (`engine.ts:975-1036`), decision journal capped but never edited (`engine.ts:940,1026`).
- **Route honesty.** `modelRoute` never claims a model that didn't run (`engine.ts:1098-1103,1201-1216`); `lastTest` labels self-test/real-run/tested with honest captioning (`console.tsx:133-150`); P6 quiet-success fix (`engine.ts:1966-1972`); competitor rows never promoted to "cited" (`types.ts:71-78`, `engine.ts:75-76`).
- **Bounded autonomy.** one macro-action per `wildStep` (`engine.ts:2330-2439`), cap-20 driver (`store.ts:594-613`), paused-on-everything (`engine.ts` pause paths), session-break honesty (active wild run force-stopped on hydrate, `engine.ts:1316-1322`).
- **Defensive hydration.** `hydrateProject` repairs phases/rows loudly (`engine.ts:1324-1535`, `hydrate.repaired` log); corrupt localStorage recovers to a seeded store (`store.ts:1188-1200`).
- **Deterministic floor discipline.** Pure no-LLM modules everywhere (`bench.ts:4-8`, `swarm.ts:10-23`, `vault.ts:7-8`, `ast-mine.ts:10-21`); P4's B-18 disclaimer is the *template* for what other phases lack (DF-04) — the fix is to spread that pattern, not to doubt the machinery.
- **UI hygiene basics that already work.** Busy latches (`console.tsx:1327-1339`), stale-copy timestamps (`console.tsx:1319-1325`), filter-clears-selection (`console.tsx:2221,2232`), Escape cancels rename (`console.tsx:1634`), route key remount (`run.$id.tsx:10-12`), never-innerHTML markdown (`console.tsx:2948-3061`), import same-id confirm (`console.tsx:1560-1573`), honest Settings/Guide modals (`console.tsx:4872-4929`).

---

## §3 Tab-by-tab ledger (what it shows → what it should show → flaws)

> Legend for competitor refs: [CP] Cursor Plan Mode ✓TODAY · [CB] Claude Code Best Practices ✓TODAY · [GK] Gemini CLI Checkpointing ✓TODAY · [DK] Devin Knowledge ✓TODAY · [CX] Codex CLI ✓TODAY · [A#]/[C#]/[G#] = 42's same-day register via 90 §1.

### 3.1 Home screen (`console.tsx:1015-1138`)

- **Shows:** hero + brief textarea + 4 template chips + Builds list. **Should show:** guided intake with a live character gate, kind selector (app/tool/game already exists as `Project.kind`, `types.ts:267` — never set by intake), and per-build progress/status chips.
- **DF-27 (P2):** "Open intake" is silently disabled below 12 chars (`console.tsx:1076-1084`) — no counter, no "why", no guidance. [CP]/[CX] both give explicit plan/approval affordances; a silent disabled CTA on the product's front door is the cheapest possible onboarding failure.
- **DF-28 (P2):** the four templates are all ops-desk briefs (`templates.ts:1-26`) and `seedIfEmpty` auto-creates a "Northwind Dispatch" **demo project presented identically to a real build** in the Builds list (`store.ts:1163-1178`) — a first-run user executes phases on a demo they never wrote. Fix: label it `(demo)`, or seed nothing.

### 3.2 Run screen header (`console.tsx:1616-1736`)

- **Shows:** 13 control groups (domain chip, LLM/research status, sandbox chip, token estimate, saved clock, autopilot checkbox, Wild toggle, Guide, Settings, Shortcuts, Theme) + 8 action buttons in the phase card (`console.tsx:1776-1947`) + 4 copy/export/import/archive buttons.
- **DF-29 (P2):** ≈25 controls with zero grouping/progressive disclosure. [CB] and [CX] both treat the mode picker + plan approval as a *sequence*, not a toolbar. Fix direction: collapse copy/export/import into one "Share" menu; move status chips into a footer.

### 3.3 Phase rail + progress rail (`console.tsx:2450-2564`)

- **DF-08 (P1, engine-side but surfacing here):** the progress rail prints `{done}/13 sealed · {pct}%` (`console.tsx:2460-2462`) while `finishPhase` advances a phase whose recorded gate **FAILED** (advisory by default — `store.ts:360-401`; `enforceDod` default false at `engine.ts:1127`). "Sealed" is a lie for FAIL-gated phases; the verdicts' 13/13 runs carried `passed:false` gates. The honest UI must print "sealed" only for `gate.passed === true`, else "sealed (gate FAIL recorded)".
- **P2 note:** locked phases render as clickable "view record" buttons that show a `PhaseRecordView` — fine, but nothing explains *why* a phase is locked (no tooltip of the gate). Minor.

### 3.4 HITL dock (`console.tsx:2631-2766`)

- **DF-09 (P1):** Approve needs **no note at all** — even when ticking the "I reviewed the failing sandbox output and approve anyway" override (`console.tsx:2712-2730`), which is precisely the null-note-override that 87/88 caught (reframe approved in ~15 s with `note:null`). Rejection demands 12 chars; approval over an unmet DoD should too (ADR-002 symmetry, 90 §10.4).
- **DF-11 (P1):** "Evidence for this gate" lists artifact *titles*, last-test caption, oracle count (`console.tsx:152-205`) — no diffs, no criteria checklist, no inline comments. Antigravity's Review Changes pane (diff scroll + inline comments) is the direct template [A3]; Cursor Agent Review runs per-commit [✓TODAY cursor.com/docs/agent/agent-review per 90 §1.3].
- **DF-10 (P1):** approving is irreversible — engine advances the cursor and appends to the ledger (`engine.ts:900-991`); there is no checkpoint to restore. Gemini's `/restore` reverts files **and conversation** and re-proposes the tool call [GK ✓TODAY]. RapidTool's own 90 P0-3/P1-2 fix spec (checkpoint per wild step, replay) is the correct remedy.
- **Verified-safe:** forceHuman override is double-guarded (UI checkbox + `store.ts:984-995`); the autopilot-denial reason now renders under the dock (`console.tsx:2753-2763`, E-21).

### 3.5 Wild Console (`console.tsx:601-906`)

- **DF-23 (P1):** every pause path computes a machine code (`RT_E_GATE_PENDING | RT_E_LLM_NOT_CONFIGURED | RT_E_PHASE_ILLEGAL | RT_E_INTERNAL` — `engine.ts:2027`) but the strip renders only prose ("Wild-mode pause seam not wired…", `console.tsx:738-772`) — a headless-adjacent operator cannot tell cap vs human-gate vs classifier error. Render the `code` badge (the Chat tab already has the badge pattern, `console.tsx:4284-4301`).
- **DF-36 (P2):** when the store contract is absent the toggle flips to local-only with an honest sr-only line (`console.tsx:520-524`) — correct but invisible; the switch *looks* on. A visible "engine not wired" chip next to the switch is needed.
- **P2 note:** the pause button's label logic (`console.tsx:815-840`) renders "Pause" in two different states; and the feed cap (40 rows) has no link into the full gate log. Cosmetic.
- **Verified-safe:** the feed is incremental/polled and never re-renders the console (`console.tsx:596-599,664-733`) — this is the right pattern and should be reused for chat streaming.

### 3.6 Artifacts tab (`console.tsx:2213-2254, 2809-2902`)

- **DF-32 (P2):** search covers title+kind+body and there's a per-phase count filter — but no kind filter, no sort, no pin, no edit/delete. Fine for a record viewer, weak as a work surface.
- **DF-11 addendum:** artifacts are the only gate evidence; there is no per-artifact diff/version view (an artifact regenerated by rejection replaces its predecessor — only the rejection-response block appended, `engine.ts:819-825` — the prior body is lost).
- **Verified-safe:** two-pane select/read with copy, filter-clears-selection, honest empty states ("No artifacts match this filter" vs "Execute the current phase…", `console.tsx:2248-2252`).

### 3.7 Agent packet tab (`console.tsx:2256-2283`)

- **DF-26 (P1):** the packet is hard-truncated at 14 000 chars with an inline `…[TRUNCATED — regenerate at a HITL gate…]` marker (`packet.ts:349-351`) — the term frame renders it as body text with no badge, no "which sections were cut" report. A downstream agent pasting a truncated packet silently loses the ledger tail. Fix: banner in the pane + section-level truncation accounting.
- **DF-25 (P1):** six tool-specific handoff wrappers (`exportProfiles` — claude-code/cursor/cline/aider/devin/copilot, `packet.ts:434-600`) are fully implemented, pure, and **never called** — the UI's "Copy phase handoff" uses the older generic `phaseHandoff` (`console.tsx:1507`, `handoff.ts:39`). Underdeliver: the headline "paste into your coding-agent session" feature ships one generic wrapper while six specific ones rot.
- **DF-34 (P2):** the markdown renderer supports only h1–h3/p/code/li/hr (`console.tsx:2918-3061`) — no tables, links, or inline code. Any packet/artifact body with a markdown table (e.g. a real OpenAPI section) renders as glue text. Safe (never innerHTML) but lossy.

### 3.8 Spec graph tab (`console.tsx:2285-2304`)

- **DF-07 (P0):** `planSpecGraph` emits a fixed web-app topology — `src/api/routes.ts`, `src/state/store.ts`, `src/ui/console.tsx`, `tests/oracle.spec.ts` — for **every** brief (`algorithms.ts:398-446`). A CLI/library brief gets "HTTP contracts bound to jobs". The tab presents this as the build's file plan with **no template disclaimer** (unlike competitors and scorecard, which carry source labels), and the packet's "## Spec graph order (A5)" ships it verbatim to the downstream agent (`packet.ts:259-265`). This is wrong-output camouflage: the *one* artifact a coding agent will use to decide files is template fiction.
- **DF-31 (P2):** the empty state says "Lattice empty — open a brief first" (`console.tsx:2301`) — but `emptyProject` runs `attachAlgorithms` at creation (`engine.ts:1132`), so specGraph is never empty on any real project; the message is dead copy that (if ever shown) prescribes an action that doesn't exist on this screen.

### 3.9 Crew tab (`console.tsx:2306-2319`)

- **DF-14 (P1):** the tab shows the four static template seats (architect/implementer/reviewer/tester with canned mandates) while the *real* crew system (Spawn crew → `runCrew` → live DeepSeek turns) renders its transcript in the main panel and then dissolves into "[agent report]" artifacts (`console.tsx:1420-1490`). Two different "crews", one tab that never shows the live one; transcripts are not persisted (E-28, 90 §3 row 10). Fix: the Crew tab should show the run history (live session + ingested artifacts) and mark the static seats "template (A8)".
- **P2 note:** empty crew renders a blank grid with no guidance (`console.tsx:2306-2318`).

### 3.10 Oracle tab (`console.tsx:2321-2342`)

- **DF-15 (P1):** shows `given ⇒ expect` prose cases from `buildTestOracle` (`algorithms.ts:510`) — but **nothing ever runs them and no verdict is ever recorded against them**. The machine cases in the verify loop (`verify.server.ts` `generateCases`/`runCases`) are a *separate* system whose results are never displayed in the UI. The tab implies acceptance tests; the product ships acceptance *prose* with zero outcomes — while the P6 gate (`p6-test`, `dod.ts:126`) passes on the toy self-test. [CB] ✓TODAY is explicit: "a check it can run… pass or fail" — RapidTool's oracle is a checklist without a runner, visible in the UI as if it were one.

### 3.11 Vault tab (`console.tsx:3063-3510`)

- **DF-17 (P1):** the pane is explicitly read-only ("Pure read-only view over vault.ts — no store writes", `console.tsx:3188`) while 90 §9.3 designates the vault as "the human-readable copy and the human edit surface" for lesson promotion. There is no edit affordance, no suggestion accept/dismiss — Devin Knowledge's edit/dismiss/regenerate suggestion flow is the reference UX [DK ✓TODAY].
- **DF-33 (P2):** "Download vault.md" and "Download packet (.md)" both use `downloadFilename(project,"md")` (`console.tsx:3312` vs `1547`) — same filename, silent overwrite prompt on every browser.
- **Verified-safe:** wikilink resolution, dead-link rendering, backlinks, tag chips, MOC hub are all solid (`console.tsx:3083-3510`).

### 3.12 Design tab (`console.tsx:3512-4069`)

- **P1 note (folded into DF-02):** the tab previews a deterministic palette, but P8's HITL gate asks the human to approve "console surfaces" (`engine.ts:601-606`) that have nothing to do with this palette or the client's product. The Design tab is detached from the only UI gate in the graph.
- **P2 note:** the defensive normalizers (`console.tsx:3547-3789`) are admirably drift-proof but also a symptom: `design.ts` is loaded through `unknown` + shape probes instead of a contract. Same pattern for wild/deepen actions (name-list feature detection, `console.tsx:326-343,4553`). It never breaks, but it means a renamed export silently degrades a whole tab — no compile-time safety.

### 3.13 Diagram tab (`console.tsx:4071-4208`)

- **DF-35 (P2):** SVG rendered through a `data:` URI `<img>` — no pan/zoom, nodes not clickable, no navigation into phase records. OpenHands' replay timeline (90 §1.8) and Devin Desktop's board [✓TODAY windsurf.com per 90 §1.13] are the interactive references; a governed phase graph is *begging* to be clickable. Honest empty state is present (`console.tsx:4201-4203`).

### 3.14 Chat tab (`console.tsx:4210-4540`)

- **DF-12 (P1):** chat is local component state — "nothing persisted" (`console.tsx:4362-4363`) — so a refresh erases the thread; no streaming (`deepseek.server.ts:233` `stream: false`, `chat.ts:17` one-shot POST); no Stop button (the thinking pulse is decoration). Codex persists sessions with resume/fork and streams token counts at transport level [CX ✓TODAY, 90 §1.1]. This is 90 §3 rows 1+3 restated as a UI-design flaw: the pane *looks* like a copilot but is a one-shot oracle with amnesia.
- **DF-13 (P1):** grounding is capped at 2 500 chars (`chat.server.ts:48,218`) and the user is never told how full it is — Codex shows "100% context left" in the header [CX ✓TODAY]. [CB] ✓TODAY: "the context window is the most important resource to manage" — RapidTool hides its only budget.
- **P2 note:** failure rows render as assistant bubbles with an "error" role label (`console.tsx:4269-4284`) — visually an answer; acceptable with the code badge, but consider a distinct tombstone row.
- **Verified-safe:** quick-action chips built from live project state (`console.tsx:4420-4445`) are real parity with [CP]/[CX] quick prompts; failure rows are never replayed as assistant speech (`chat.ts:76-94`); history capped at 6 turns server-side.

### 3.15 Memory sidebar + gate log + diagnostics (`console.tsx:2364-2432`)

- **DF-30 (P2):** memory renders only `slice(0, 8)` rows (`console.tsx:2380`) with no "show all", no link to the Vault tab (which holds every memory note), and the E-18 provenance fields (`source`, `url`, `tags` — `types.ts:103-110`) are not rendered at all. A research row with a backing URL shows no URL.
- **DF-31 (P2):** "Empty until Phase 0 writes a checkpoint" (`console.tsx:2389`) is dead copy — `bootstrapMemory` primes rows at creation (`engine.ts:1134`, `algorithms.ts:604`).
- **Verified-safe:** gate log shows actor + latency + note (`console.tsx:2393-2419`); approval-health rubber-stamp whisper renders (`console.tsx:4803-4820`); diagnostics tail is capped and reversed (`console.tsx:2424-2430`).

### 3.16 Modals (`console.tsx:4822-4958`)

- **Verified-safe:** Settings honestly explains server-side keys and deterministic mode (`console.tsx:4872-4912`); Guide is a faithful condensation of AGENT_GUIDE.md with the "does not build software itself" honesty (`console.tsx:912-933`); shortcuts dialog is accurate and typing-guarded (`console.tsx:1213-1277`). No findings.

---

## §4 Pipeline step-by-step ledger (P0–P12 + gates/verify/crew/wild/deepen/chat/CLI)

### 4.1 P0 Deep Research & Feasibility

- **DF-18 (P1):** the run screen renders "Phase 0 scorecard" with big numbers and axis cards (`console.tsx:2566-2629`) while the *packet* version of the same data carries the honest caveat "(deterministic feasibility estimate — template-derived, not live research)" (`packet.ts:311`). The UI drops the caveat — the one number a user will actually look at.
- **DF-19 (P1):** `liveLayer` appends real fetched findings and an LLM narrative (`engine.ts:1679-1711`) but never updates `scorecard` or `competitors` — so a project can show a live-research corpus AND a scorecard that ignored it. Scorecard and research are disconnected subsystems dressed as one phase.
- **Verified-safe:** reframe → `forceHuman` HITL (`engine.ts:333-344`) is exactly right; `vague` flag exists (`algorithms.ts:200`).

### 4.2 P1 Core Orchestration & State Graph

- **DF-03 (P0):** the phase emits a fixed "Dispatcher topology" artifact about `intent.LlmAgent`, `workflow.sequential`, `failover.LiteLLM` (`engine.ts:347-376`) for **every brief** — a RenamePro run's P1 describes an agent harness, not a CLI tool. There is no per-brief graph synthesis and no disclaimer. This is the first domino of the wrong-product pipeline.
- **P2 note:** "transfer_to_agent allowed only when…" rules are prose (`engine.ts:362-367`) — the engine enforces only linear +1 (`phases.ts:126-132`). The prose overclaims machine enforcement.

### 4.3 P2 Memory & Context Consolidation

- **DF-06 (P0):** the "Checkpoint + retrieval plan" artifact states `Durable checkpoint key: project:{id}:phase:{n}` and a resume policy (`engine.ts:384-386`) — **no durable checkpoint layer exists**; persistence is browser localStorage via zustand (`store.ts:1180-1206`), and 90 §10 P0-3 confirms no checkpoints. This artifact is read by a downstream agent as a fact about its own runtime.
- **DF-04 (P0, shared):** the same artifact claims "RRF(k=60)… cross-encoder re-rank" (`engine.ts:393-394`) — FusionRank's own header admits it is lexical-only and "deliberately NOT multi-list RRF" (`algorithms.ts:221-231`). The phase declares a ranking architecture that was consciously not built.
- **DF-39 (P2):** LLM-extracted constraints land as an artifact (`engine.ts:1732-1750`) but the Constraint Scheduler never consumes them (`schedule` is computed deterministically at `attachAlgorithms`); the human sees "Extracted constraints (LLM)" and assumes they constrain something.

### 4.4 P3 Tool Integration

- **DF-04 (P0, shared):** the MCP+A2A contracts JSON lists `search.brave`, `repo.fs`, `sandbox.exec` servers, `a2a: 1.0`, "websocket progress frames every 250ms" (`engine.ts:405-429`) — none of it exists at runtime (90 §10 P2-3 ✗). Unlike P4 it carries no "declaration, not implementation" disclaimer. The packet's Contracts section then advertises this to the downstream agent.

### 4.5 P4 Security, Isolation & Authorization

- **DF-05 (P0):** the isolation-policy artifact carries the correct B-18 disclaimer ("Implementation today: sync-template… policy above is the P4 declaration", `engine.ts:450`) — **but the HITL gate asks the human to "Confirm 256 MB / 30s isolate, deny-network during exec, and user-scoped OAuth on every tool"** (`engine.ts:456-462`). The runtime is `runtime:"sync-template", ramMb:null` (`engine.ts:1104-1111`); network deny and OAuth-on-tools are not implemented. The user is approving a fiction as if it were a config. The disclaimer lives in the artifact the human may not read; the gate prompt reads as fact.

### 4.6 P5 Validation, HITL & Self-Learning

- **DF-20 (P1):** the phase is titled "Validation, HITL & Self-Learning" (`phases.ts:44-50`) and its artifact enumerates four "Simulated user paths" (`engine.ts:464-484`) — nothing simulates anything; there is no self-learning loop behind P5 (90 §2, §10). A titled-but-empty phase inside a governance product is itself a governance smell: the graph *claims* a learning phase it does not run.

### 4.7 P6 Code Generation, Testing & Deployment

- **DF-01 (P0, the root cause):** `buildPhase6Module` emits a deterministic toy — `synthesize(spec)` that validates a phase number is 0..12 and throws on an unknown job label, plus two self-tests (`sandbox.ts:125-161`). The brief's nouns never enter the code: the module is a **phase-gate simulator**, and its self-test is what makes `p6-test` pass (`dod.ts:126`). Verdict evidence: RenamePro ≈1/10, StatKit ≈1.2/10, Kanban ≈2.2/10 — every run "seals 13/13" on this toy. The UI compounds it with "Run module (bounded)" (`console.tsx:1836-1844`) which executes the toy for real and shows "Module ran: exit 0" — green verification of a simulator.
- **Verified-safe:** heal-then-once, no blind re-run (`engine.ts:503-523`); forceHuman on failure (`engine.ts:551-553`); real-run convergence (`store.ts:829-880`, `engine.ts:1950-1980`); honest lastTest labels. The machinery around the toy is excellent; the toy is the flaw.

### 4.8 P7 Domain & Market Research

- **DF-21 (P1):** `marketFor` serves 5 hardcoded domains (logistics, health-ops, finance-ops, marketplace, operations) + 2 shared rows (`engine.ts:50-77`); every other domain gets only "Cursor" and "v0/Bolt/Lovable" — a stats library's competitive matrix is an IDE-assistant comparison. Labeled illustrative (good) but structurally useless for any non-ops brief.
- **P2 note:** the artifact's closing line ("Architectural advantage: deterministic 0–12 graph…") is self-promotional template prose shipped into every project's research artifact (`engine.ts:575`).

### 4.9 P8 Dynamic UI/UX Prototyping

- **DF-02 (P0):** the "Interface contract" artifact describes **RapidTool's own console** — "Surfaces: intake, phase rail, scorecard, artifact inspector, approval dock" (`engine.ts:585-600`) — and the HITL prompt asks the human to "Confirm the console surfaces: phase rail, scorecard, artifacts, approval dock" (`engine.ts:601-606`). The phase titled "Dynamic UI/UX Prototyping" of the *client's* product asks approval for the *tool's* own UI, and its "Preview: live canvas for HITL layout approval" line (`engine.ts:594`) describes a canvas that does not exist. Same wrong-product class as DF-01.
- **P2 note:** P8 emits no React/Tailwind code at all despite the phase summary promising "Component-based React + Tailwind generation" (`phases.ts:70-75`).

### 4.10 P9 CI/CD & Cloud Deployment Routing

- **P1 note (folded under DF-04):** the GitHub Actions workflow (`engine.ts:608-631`) and IaC sketch (`engine.ts:632-642`) are unconditional templates (`npm ci/typecheck/test`, GCP/Firebase) — for a CLI tool brief they are noise; and the HITL "Allow CI gates and Firebase/GCP routing templates to be written" (`engine.ts:646-651`) approves writing templates that deploy nothing. Deployment gates over nonexistent deployment.

### 4.11 P10 Local Agent & Edge Inference

- **DF-04 (P0, shared):** the "Tiered inference" artifact still says "Primary: grok-4.5" and "Edge: Ollama open-weight models" (`engine.ts:653-670`) — the retired model label that `hydrateModelRoute` maps to "deterministic" (`engine.ts:1209-1216`), and an Ollama integration that does not exist, with no disclaimer. The E-14 route-honesty machinery deliberately scrubs this label from state; the template re-injects it into artifacts.

### 4.12 P11 Real-Time Web & Tool Augmentation

- **DF-04 (P0, shared):** the "Live search MCP binding" JSON claims Brave Search MCP with "bind_policy: root LlmAgent may attach new APIs mid-run, restart_required: false" (`engine.ts:674-703`) — the real research stack is Tavily/DDG/Wikipedia (`engine.ts:1594-1608`), and no MCP binding or mid-run attach exists. This artifact is the most explicit "capability we don't have, stated as config" in the graph.

### 4.13 P12 Documentation & Technical Specs

- **DF-37 (P2):** ADRs are canned prose (ADR-001/002/003, `engine.ts:726-741`) disconnected from the real decision ledger; OpenAPI is generated from template contracts with a `/projects` fallback for non-API briefs (`engine.ts:705-724`). Harmless as artifacts, but they dilute the audit axis: the real decisions are the ledger rows, not these.

### 4.14 Gates (dod.ts) — the advisory-default flaw

- **DF-08 (P1):** `enforceDod` defaults false (`engine.ts:1127`); `finishPhase` auto-advances past a FAIL-gated phase unless opted in (`store.ts:360-401`); the recorded FAIL is honest in the drill-down ("advisory — recorded, not blocking", `console.tsx:4663`) but the rail/packet say sealed/complete. 90 §10.2 #3 already flags that the roadmap never says how to flip this — the *design* flaw is that the product's core pitch (governed gates) is opt-in while its presentation (seals, checks, "Delivery sealed") is unconditional.
- **Verified-safe:** evidence hashes are FNV-1a over sorted id:pass|fail pairs, deterministic and re-computable (`dod.ts:4-9`); FAIL rows expand by default with criterion wording (`console.tsx:4620-4669`); `p6-verified` requires machine-promoted evidence (`dod.ts` header).

### 4.15 Verify loop (verify.server.ts)

- **DF-16 (P1):** a real machine-run fail→fix loop exists (`verify.server.ts:503` `verifyAndFixServer`, client `verify.ts`) and is the single most governance-relevant feature — and it is reachable only via the CLI (`rapidtool-cli.mjs` `verify` verb) and headless; the run screen's P6 evidence never shows its cases/iterations/evidence. The HITL dock should render `VerifyOutcome` when it exists.
- **DF-15 addendum:** `generateCases` receives the brief (audit-88 landed, `verify.server.ts:446-499`) but not the spec/type signatures — the self-referential oracle mode 87 S6 documented ("6/6 passed = the module agrees with itself about itself") is closed only for the brief, not for requirements.

### 4.16 Crew (crew.server.ts)

- **Verified-safe design:** advisory by contract ("it never approves, rejects, advances, or deploys", `crew.server.ts:16`); deterministic phase→role table; honest partial transcripts with stop reasons (`crew.ts:89-93`). This is the correct design and should be the template for any multi-agent expansion.
- **DF-14 (P1, restated):** the flaw is purely presentational — the UI's Crew tab never shows this system's output; its transcript evaporates from the main panel on re-render and is only recoverable as "[agent report]" artifacts.

### 4.17 Wild Mode (engine.ts:1982-2439)

- **Verified-safe design:** bounded one-macro-action steps, honest pause classes, no fabricated reviews. The design gaps (no plan-first, no checkpoints, no permission allowlist) are already roadmapped as P0-3/P0-4/P1-4 (90 §6/§10) — this ledger adds only the *presentation* findings (DF-23, DF-36).

### 4.18 Deepen (engine.ts:1776-1880)

- **P2 note:** idempotent corpus deepening with re-recorded gate (`engine.ts:1807-1879`) is sound; the UI seam feature-detects the store action by name list (`console.tsx:4553-4561`) and honestly tells the operator to use the CLI when absent. Acceptable; a typed store contract would remove the name guessing.

### 4.19 Chat server (chat.server.ts)

- **DF-12/13 restated:** 2 500-char grounded context (`chat.server.ts:48,218`), one-shot POST (`chat.ts:17`), provenance stamps on replies — honest but budget-invisible and amnesiac. [CX] ✓TODAY shows the meter; [GK] ✓TODAY shows persistence of conversation.

### 4.20 CLI verbs (scripts/rapidtool-cli.mjs)

- **Verified-safe:** 27 verbs (create/run/gate/approve/reject/retry/ingest/packet/export/summary/vault/search/crew/verify/design/diagram/artifacts/harvest/swarm/prompt/bench/mine/knowledge/wild/chat/deepen/doctor) — the CLI is the most complete surface of the product and the natural home of the MCP/ACP server (90 P2-4).
- **DF-38 (P2):** no `eval`, `replay`, `restore`, or `plan` verbs — the four commands that would operationalize 90's kill criteria and Axis-2 replay claim. Every audit-fix wave currently re-derives evidence by hand; the eval verb (90 §10.5 #5) is the missing loop-closer.

---

## §5 Feature-surface ledger (claim vs on-disk reality)

| Module | Claims (from its own header) | Actual on disk (verified) | Verdict |
|---|---|---|---|
| `vault.ts` | "Obsidian-style second brain **export**… interlinked knowledge base" (`vault.ts:1-8`) | Fully implemented + tests; pure/deterministic; per-project only. UI read-only (`console.tsx:3188`); `dailyNote`/`traceNote` exported but unwired to any UI | **Honest, underdelivered:** the export claim is met; the "second brain" (edit/promote) role 90 §9.3 assigns it is not implemented (DF-17) |
| `knowledge.ts` | "JSON-backed cross-project pattern store… append-only… atomic writes… idf-weighted lexical (NOT embeddings)" (`knowledge.ts:1-23`) | Fully implemented as claimed (`KnowledgeStore` `:122`, `savePattern` `:166`, `findPatterns` `:196`, `injectProven` `:265`) | **Honest, unwired:** zero production consumers — CLI `knowledge` verb + `headless.ts:1476-1483` only; no engine/run call site (90 §10.1) |
| `harvest.ts` | "bounded live-source harvester… NEVER fabricates a repo, license, or snippet" (`harvest.ts:2-27`) | Implemented with real caps (4 fetches/12 s/2 queries, `harvest.ts:38-42`) | **Honest, unwired:** CLI `harvest` verb only; P0/P7 live research uses `research.ts`, not harvest |
| `bench.ts` | "synthetic dry-run estimates… pure and deterministic… `estimate: true`… never a measured value" (`bench.ts:2-24`) | Implemented as claimed, honest labels exported | **Honest, unwired:** CLI `bench` verb only; the packet's System JSON does not carry estimates (90 Axis 2 #4 unshipped) |
| `swarm.ts` | "Advisory swarm layer… specialized sub-agent seat specs… deterministic critique loop" (`swarm.ts:1-23`) | Pure seat specs + critique templates + parallel-DAG metadata; **no dispatch** (never calls an LLM, by design) | **Honest, underdelivered:** "swarm" names a multi-agent capability; the module is a static role catalog. Only consumer: CLI `swarm` verb |
| `watcher.ts` | "bounded reverse-handoff watcher… OPT-IN ONLY… nothing in the app calls it" (`watcher.ts:1-26`) | Implemented as claimed, cap 200, debounced | **Honest, unwired:** no caller anywhere |
| `ast-mine.ts` | "structural codebase map… REGEX-BASED, NOT a real AST parser… MISSED, not guessed at" (`ast-mine.ts:1-22`) | Implemented as claimed + tests | **Honest, unwired:** CLI `mine` verb only; not injected into chat/research grounding (90 Axis 2 #3 unshipped) |
| `prompt-engine.ts` | "hyper-prompt expansion… EXHAUSTIVE spec… never invents platforms" (`prompt-engine.ts:1-32`) | Implemented (`expandBrief` `:171`, `applyPolicies` `:206`) | **Honest, underdelivered:** output never stored on `Project` — no `implementationSpec` field (`types.ts`) — so the exhaustive spec is envelope-only and evaporates (86 §4-4) |
| `packet.ts` exportProfiles | "six downstream coding tools" wrappers (`packet.ts:377-435`) | Fully implemented, pure, tested | **Underdelivered:** no caller (`console.tsx:1507` uses `handoff.ts` `phaseHandoff` instead) — DF-25 |
| `verify.server.ts` | "machine-run verification + DeepSeek verify-fix loop… status passed minted ONLY from a real runner pass" (`verify.server.ts:1-18`) | Implemented (`runCases` `:359`, `verifyAndFixServer` `:503`, audit-88 retry landed) | **Honest, underdelivered:** invisible in the UI (DF-16); persists nothing (90 §10); evidence never reaches the HITL dock |

**Pattern:** the pillar modules are individually honest and mostly tested — the systemic defect is that **the product's loop (engine → store → UI) consumes almost none of them**. The LEAPFROG roadmap's "wire, don't build" finding (90 §10.1) is confirmed at the feature-surface level: eight modules are landed-but-orphaned.

---

## §6 Ranked fix matrix (order rationale + determinism notes)

| # | Rank | Fix | Touch (verified anchors) | Tests | Order rationale |
|---|---|---|---|---|---|
| 1 | P0 | Kill the toy: P6 must synthesize from brief+spec (lattice jobs + `expandBrief` spec), not `buildPhase6Module`; add `p6-brief-fit` probe before `p6-test` can pass | `sandbox.ts:125-161`, `engine.ts:493-555`, `dod.ts:126-165`, `prompt-engine.ts:171` | brief-conformance fixtures (86/87/88 corpus briefs) | 90 §10.5 Phase-0 #1; everything else is lipstick until this lands |
| 2 | P0 | Declare-or-strike: every artifact claiming a capability must carry a B-18-style "declaration, not implementation" line; strike retired content (grok-4.5/Ollama/Brave-MCP/a2a) or mark illustrative | `engine.ts:377-429,653-704` | artifact-body contract tests (grep per phase) | DF-03/04/06; spreads P4's existing honest pattern |
| 3 | P0 | P8 must synthesize for the *client* (or emit a labeled "prototype pending" artifact) and the P4 gate prompt must state the implemented runtime; no gate may ask approval of an unimplemented policy | `engine.ts:585-606,439-462` | phase-artifact + gate-prompt fixtures | DF-02/05 |
| 4 | P0 | Label template provenance on the spec/crew/oracle surfaces + packet sections ("template-derived (A5/A6/A7/A8), not from your brief") | `console.tsx:2285-2342`, `packet.ts:259-271`, `algorithms.ts:398-446` | snapshot tests on rendered labels | DF-07 |
| 5 | P1 | Gate-honesty rail: "sealed" only when `gate.passed===true`; show FAIL count in the progress rail; decide+document `enforceDod` default | `console.tsx:2460-2462`, `store.ts:360-401`, `engine.ts:1127` | gate-state render tests | DF-08; 90 §10.2 #3 |
| 6 | P1 | Approval-note symmetry: approving a `forceHuman` override requires a ≥12-char note (ADR-002 mirror) | `engine.ts:900-991`, `store.ts:975-1013`, `console.tsx:2712-2730` | approve-path tests | DF-09; kills 87/88 null-note class |
| 7 | P1 | Chat trust wave: persist `chatLog`, stream + Stop (90 P0-1/P0-2 exactly) | `console.tsx:4358-4415`, `deepseek.server.ts:233`, `types.ts` | chat streaming + persistence tests | DF-12 |
| 8 | P1 | Context meter in ChatPane header (2500 budget from `chat.server.ts:48`) | `console.tsx:4451-4463` | render test | DF-13 |
| 9 | P1 | Wire verify into the run screen: P6 gate evidence renders `VerifyOutcome` (cases/iterations/evidence); oracle tab gains run/verdict columns | `console.tsx:2631-2766,2321-2342`, `verify.ts` | UI wiring tests | DF-15/16 |
| 10 | P1 | Crew tab = live crew history (persisted transcript) + static seats labeled "template" | `console.tsx:2306-2319,1948-1988` | render tests | DF-14 |
| 11 | P1 | Wire the orphaned pillars: `injectProven` into packet rank, `harvest` into P0/P7 live layer, `bench` into packet System JSON, `exportProfiles` into a handoff menu | `packet.ts:143-151`, `engine.ts:1594-1608`, `console.tsx:1505-1514` | per-module wiring tests | DF-19/24/25 |
| 12 | P1 | Vault edit surface + knowledge suggestion HITL (Devin-style propose/accept/dismiss) | `console.tsx:3188-3510`, `knowledge.ts:166,265` | vault mutation + promotion tests | DF-17; 90 §9.3 HITL path |
| 13 | P1 | Checkpoints/restore (delta snapshots, ledgered restore — 90 P0-3) | `engine.ts`, `store.ts` | restore→same-verdict test | DF-10; prerequisite for replay |
| 14 | P2 | Intake: character counter + kind selector; demo project labeled; template chips → kind-appropriate briefs | `console.tsx:1064-1098`, `store.ts:1163-1178`, `templates.ts` | intake tests | DF-27/28 |
| 15 | P2 | Memory sidebar: full list + vault deep-link + provenance/tags; delete dead empty-states; distinct vault filename; artifact kind filter | `console.tsx:2213-2254,2378-2391,3312` | render tests | DF-30/31/32/33 |
| 16 | P2 | Wild strip: render the pause `code` badge; non-local-only toggle chip | `console.tsx:500-590,738-905` | render tests | DF-23/36 |
| 17 | P2 | CLI: add `eval` (corpus harness), `plan`, `restore`, `replay` verbs | `scripts/rapidtool-cli.mjs`, `headless.ts` | CLI contract tests | DF-38; operationalizes kill criteria |

**Determinism-preserving notes:** items 1–4 change template *content* (pure functions — keep fixtures byte-stable); items 5–10 are presentation/state-shape additive; items 11–13 must keep the keyless floor (`{ok:false}` not-configured paths untouched); item 17 must not add runtime deps (zero-dep rule, 90 §10.4).

---

## §7 Competitor sources fetched THIS pass (✓TODAY, 2026-09-06)

- [CP] **Cursor Plan Mode** — https://cursor.com/docs/agent/plan-mode — clarifying questions → reviewable/editable plan (files) → "revert the changes, refine the plan… run it again"; `Shift+Tab` mode rotation.
- [CB] **Claude Code Best Practices** — https://code.claude.com/docs/en/best-practices — "give it a check it can run"; `/goal` separate evaluator; Stop hooks (8-block override); verification subagent (fresh model refutes); context window as the primary resource; plan mode `Shift+Tab`.
- [GK] **Gemini CLI Checkpointing** — https://www.geminicli.com/docs/cli/checkpointing — automatic shadow-git snapshot + conversation + pending tool call before every file-mutating approval; `/restore` reverts files and conversation and re-proposes the call.
- [DK] **Devin Knowledge** — https://docs.devin.ai/product-guides/knowledge — trigger descriptions; Knowledge Suggestions (edit/dismiss/regenerate); folders/enable-disable; pinning to repos.
- [CX] **Codex CLI** — https://learn.chatgpt.com/docs/codex/cli — "100% context left" header meter; `/review` presets; `codex resume` session persistence; `codex exec` automation; skills/plugins; steering.
- Inherited same-day register (via 90 §1, fetched 2026-09-06 by the 42 pass): [A1–A8] Antigravity artifact-review/permissions UX, [C1–C5] Codex approvals/TUI, [G1–G4] Gemini CLI, [D1–D7] DeepSeek Harness.
- (One attempted fetch 404'd and is not cited: `learn.chatgpt.com/docs/cli/approvals`, `developers.google.com/antigravity/docs/core-concepts/plan-mode`.)

**RapidTool anchors:** read in full this session — `src/components/console.tsx` (4 958 lines), `src/lib/{engine,store,packet,phases,types,crew,chat,verify}.ts`; heads + greps on `src/lib/{algorithms,dod,sandbox,vault,knowledge,harvest,bench,swarm,watcher,ast-mine,prompt-engine,verify.server,crew.server,wild-mode.server,report-intake,handoff,deepseek.server,chat.server,exec,headless}.ts`, `src/lib/templates.ts`, `src/routes/*.tsx`, `scripts/rapidtool-cli.mjs`. Verdict evidence: 86/87/88; loop/feasibility context: 89, 90 (§1–§10).

---

## Files created/modified

- **Created:** `research/multiagent/93_design_flaws.md` (this file).
- **Modified:** `research/multiagent/90_LEAPFROG.md` — **append-only** `## §11` (compilation guard + AI-agent usage instructions; nothing above the tail touched; sibling append discipline observed).
- No source files read-modified; no test suites executed (doc-only deliverable).
