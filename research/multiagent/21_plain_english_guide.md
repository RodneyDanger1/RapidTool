# 21 — RapidTool in Plain English: A Non-Engineer's Guide

> **File:** `research/multiagent/21_plain_english_guide.md` · **Date:** 2026-09-06 · **Auditor:** PRO explainer (read-only pass over `C:\Users\mnril\Desktop\RapidTool Main`)
>
> **How to read this guide.** Every claim about RapidTool is verified against the actual source code and carries a `file:line` reference (e.g. `phases.ts:126` means "line 126 of that file"). Anything about competitors comes from the project's own researched dossiers (`research/multiagent/06_competitor_survey.md`, `11_agency_plan.md`, `13_top20_gaps.md`, `14_agi_aggregation.md`, `16_utility_review.md`, `18_chat_ux_research.md`) — all of which cite their own sources. Nothing here is marketing. Where the tool has a real weakness, this guide says so, loudly.
>
> **Jargon rule honored:** every technical term is followed by a one-line plain-English definition the first time it appears.
>
> **A note on timing.** RapidTool is being actively built (September 6, 2026). Five new modules — `vector.ts`, `planning.ts`, `tracing.ts`, `algo-tools.ts`, `arch-tools.ts` — were being written by a sibling build wave *while this guide was audited*. They are described in §8 as "in-flight additions," based only on their own header documentation, and flagged as not-yet-verified-in-the-running-product.

---

## 1. What RapidTool IS

**One-liner:** RapidTool is a "governed delivery" software agency in a box — you paste a description of the software you want, and it walks that description through a fixed 13-step pipeline (research → design → security → build → ship) that stops for your approval at every high-stakes moment, then hands you a paste-ready instruction packet you can give to any AI coding assistant to do the actual building — with every decision along the way written down and verifiable.

**Short paragraph.** RapidTool does not build software itself. It is a *pre-flight compiler with a governance spine*: it turns a plain-English brief into a checked specification, a risk scorecard, security and testing plans, generated code samples, and — most importantly — a version-stamped **Agent Packet** (a structured markdown document, `packet.ts:116-315`) that a real coding agent (Claude Code, Codex, Aider, etc.) can execute phase by phase under enforced, auditable constraints (`AGENT_GUIDE.md:4-7`). The pipeline is a **deterministic 13-phase graph** (P0–P12 — `phases.ts:3-108`, `agentnotes.md:14-16`): the same brief always produces the same result, because the engine is plain TypeScript functions, not an LLM. An LLM (DeepSeek), live web research, a code runner, and a crew of AI roles *can* be layered on top — but only when you configure API keys, and always with honest "not configured" fallbacks (`engine.ts:1318-1326`). Human approval gates (HITL — "human in the loop") lock the four high-stakes phases: security (P4), validation (P5), UI (P8), and deployment (P9) (`phases.ts:150-151`). The product's own research states the position plainly: "RapidTool's moat is process, not pixels" (`11_agency_plan.md:13`).

---

## 2. What it can MAKE

For each output below: what it is, and one plain sentence on how the tool produces it. All of these are produced as **text or files** — the engine writes deterministic documents, code strings, SVG markup, and markdown notes from your brief.

| Output | How RapidTool produces it |
|---|---|
| **Web app blueprint + starter code** | Your brief is classified into a domain (e.g. "logistics") by keyword matching (`engine.ts:93-114`), a build plan lists the files to create in order (`algorithms.ts:337-384`), and the scaffold emitter turns the project into a zero-dependency file tree — README, DEPLOY.md, `.env.example`, `package.json`, source modules, and test stubs (`scaffold.ts:1-38`) — with one of five project kinds (webapp, CLI tool, library, game, service) chosen automatically (`scaffold.ts:43-68`). |
| **CLI tools and libraries** | The same pipeline detects "parse / convert / cli / script" or "sdk / package / library" keywords and emits the matching project skeleton (`scaffold.ts:63-65`); the spec graph and data-contract generator give it typed entities and endpoints before any code exists (`algorithms.ts:417-447`). |
| **Games** | A "game" kind is detected from keywords (`scaffold.ts:66`), and the scaffold adds a placeholder game-asset manifest (`scaffold.ts:9-10`) — honest starter structure, not a finished game. |
| **Generated code module (P6)** | The engine *synthesizes* a real, runnable JavaScript module from your brief — it embeds the project's jobs as string literals, includes self-tests, runs them, and self-heals a known failure (`sandbox.ts:125-161`, `engine.ts:486-516`). This is deliberately a bounded template, not bespoke app code — see §5. |
| **Logos, icons, badges** | **In flight (wave 3).** `vector.ts` plans LLM-as-designer SVG logos and icon sets — the model *writes SVG code*, a sanitizer checks every byte, and a deterministic geometric monogram is the fallback when no API key exists (`vector.ts:1-17`); badges and monograms already work with no LLM at all. |
| **Design systems (colors, type, spacing)** | `design.ts` derives a 20-color palette from the project's domain and name using a plain-integer hash — so the same project always gets the same colors (`design.ts:18-36`) — with every text/background pairing guaranteed to meet WCAG AA contrast (4.5:1), a rule re-verified by tests (`design.ts:37-44`). It also emits a self-contained HTML page previewing the whole system (`design.ts:563`). |
| **Architecture diagrams** | `diagram.ts` renders three standalone SVG diagrams — the 13-phase pipeline (with human-gate phases marked as diamonds), the artifact map, and the current phase's decision flowchart — deterministically and XML-safe, with zero dependencies (`diagram.ts:1-31`). |
| **Code scaffolds (file trees)** | `scaffoldProject()` converts any project into a complete on-disk-ready file tree with escaped, hostile-input-safe paths, so nothing from your brief can break out of the file system (`scaffold.ts:971`, `scaffold.ts:105-121`). |
| **Agent Packets (the signature artifact)** | After every phase, the whole state — decisions, gates, memory, scorecard, contracts — is recompiled into one paste-ready markdown document with a machine-readable JSON block inside it (`packet.ts:50-113`), version-stamped (`packet.ts:12`) and truncated out loud, never silently cut (`packet.ts:310-313`). |
| **Obsidian-style knowledge vaults** | `vault.ts` turns a whole project into an interlinked markdown knowledge base — one note per memory row, decision, research finding, and top artifact, with wikilinks that never dangle and a searchable index (`vault.ts:1-71`). It's a "second brain" that's a *byproduct* of the build, not a chore. |
| **A governed paper trail (JSON + decisions + gates)** | Every approval/rejection is logged with who decided, when, and what they said (`engine.ts:923-933`, `engine.ts:1004-1019`); every phase completion records a DoD (Definition-of-Done) verdict with a hash fingerprint (`dod.ts:358-399`); the whole thing exports as one JSON file that round-trips through validation and repair (`io.ts:25-47`). |

---

## 3. WHY it is FASTER and MORE ACCURATE

Six mechanisms, each in plain English.

**1. The deterministic 13-phase graph — no dice rolls.** Every phase's output is computed by plain functions, not an AI model: `synthesizePhase()` is a giant switch statement over phases 0–12 (`engine.ts:220-750`). The Definition-of-Done probes are explicitly written to "read ONLY project content — never timestamps, ids or randomness — so runGate() is deterministic and its evidence hash is reproducible" (`dod.ts:42-46`). The vault and scaffold promise byte-identical output for identical input (`vault.ts:6-8`, `scaffold.ts:12-14`). Same brief, same decisions, same result — every time. (One honest nuance: timestamps are stamped into artifacts, so "same result" means same verdicts, same text, same structure — modulo dates; the project's own research states this boundary explicitly, `06_competitor_survey.md:212`.)

**2. Governed human gates — the machine stops and asks.** Phases can only be entered in order: the code allows a transition only to the very next phase (`phases.ts:126-132`), requires every prior phase to be complete before the next unlocks (`phases.ts:134-148`), and throws a machine-readable "illegal phase" error otherwise (`phases.ts:112-124`). At P4/P5/P8/P9 the run *parks* and waits for a human (`phases.ts:150-151`). Rejections must carry real feedback — at least 12 characters of written reasoning, enforced in code (`engine.ts:992-994`) — and autopilot can never approve a gate the engine marked human-only (`engine.ts:909-913`). That feedback then *steers* the regeneration: keyword-matched deltas visibly answer the rejection (`engine.ts:159-173`), and even the generated code variant flips deterministically with the note (`engine.ts:493`).

**3. Exit criteria checked by code, not vibes.** Each phase has a Definition-of-Done: concrete, machine-checkable probes over real project data — "scorecard has ≥5 axes," "memory contains all three kinds," "generated source is non-empty," "OpenAPI declares 3.1.0" (`dod.ts:47-241`). `runGate()` evaluates them and fingerprints the verdict with an FNV-1a hash over sorted pass/fail pairs (`dod.ts:260-287`) — so a recorded verdict can be re-verified against the project state *at any time*. A "machine-verified" P6 badge is minted only when a real runner promoted a "tested" verdict with an evidence hash (`dod.ts:145-171`).

**4. The machine-verified fix loop — the LLM never declares success.** The verify module works like this: the AI *writes test expressions* about the code (`verify.server.ts:122-150`); a **machine harness** runs the code and each expression and prints pass/fail (`verify.server.ts:68-120`); on failure, the AI submits a patched source and the machine re-runs — up to a bounded number of iterations (`verify.server.ts:152-223`). The header is the contract: "The machine — never the LLM — declares pass/fail" and "status 'passed' is minted ONLY from a real runner pass" (`verify.server.ts:1-18`). The fix prompt literally says "Do not claim success" (`verify.server.ts:204`). Same discipline on P6: the engine runs the generated module's self-tests itself and refuses to let a failing sandbox be autopilot-approved (`engine.ts:496-546`).

**5. Honesty rules — never invented facts, everything labeled.** This is enforced in code, not promises. No API key? Every layer returns a typed `{ ok: false, reason: "not-configured" }` *before any network call*, and the engine falls back to its deterministic path — "a run never strands and never fabricates output" (`engine.ts:1318-1326`, `llm.ts:7-8`). Template competitor rows are stamped `source: "illustrative"` — scaffolding, not facts (`engine.ts:68-69`). LLM-written prose carries a footer stating whether it was grounded in fetched sources or not (`engine.ts:1344-1349`). The packet labels its scorecard "deterministic feasibility estimate — template-derived, not live research" (`packet.ts:271-274`). When live web research genuinely could not run, the project records an *explained* dead-end (`engine.ts:1444-1448`). DEPLOY.md carries a verbatim honesty stamp that the pipeline never executed those deploy templates (`scaffold.ts:70-72`). Fourteen machine-readable error codes each come with one line telling an AI agent what to do — including "never present a fallback as a real run" (`errors.ts:95-166`).

**6. The paper trail — every decision logged, hash-verified.** An append-only decision ledger records approve/reject, actor (human vs autopilot), and ISO timestamps (`engine.ts:923-933`, `engine.ts:1004-1019`). Rejections accumulate in per-phase append-only history (`engine.ts:997-1002`). Gate verdicts are recorded with evidence hashes (`dod.ts:358-399`). Corrupt or hand-edited state is *repaired loudly* on load — dropped phases, inserted records, and repairs are logged, never silently papered over (`engine.ts:1141-1179`, `engine.ts:1291-1311`). And if a later phase touches files an earlier phase depends on, the engine detects the drift by re-hashing the old gates (`engine.ts:1674-1699`).

---

## 4. Plain-English PROS (verified features)

1. **Same input, same output — every run.** DoD probes never read timestamps or randomness (`dod.ts:42-46`); vault and scaffold outputs are byte-identical for equal state (`vault.ts:6-8`); codegen variants derive from a hash of your rejection note plus the attempt number (`engine.ts:493`). Your project's own research found no competitor with this: "Deterministic replay — RapidTool wins; nobody else in this set has it" (`06_competitor_survey.md:212`).

2. **The machine enforces the process, not just suggests it.** You cannot skip to deployment: transitions are legal only one phase forward (`phases.ts:126-132`), prior phases must be sealed (`phases.ts:134-148`), and an out-of-graph phase id throws a typed error (`phases.ts:112-124`). No commercial app-builder exposes a sealed graph at all (`06_competitor_survey.md:194`).

3. **Human gates with mandatory, recorded reasoning.** Rejection without ≥12 characters of feedback is refused by code (`engine.ts:992-994`); every decision is appended to a permanent ledger with its author and timestamps (`engine.ts:923-933`); failed-sandbox gates force a human, and the override is itself logged with an evidence row (`engine.ts:934-957`). Competitor permission prompts are "stateless — they gate an action, not a phase" (`06_competitor_survey.md:196`).

4. **Exit criteria checked by code, with fingerprints.** Every phase 0–12 has concrete probes (`dod.ts:47-241`) and a re-verifiable FNV-1a evidence hash (`dod.ts:255-287`); the verdict lands as a visible gate artifact (`dod.ts:321-345`).

5. **A real fail-to-pass fix loop where the machine is the judge.** Test cases are AI-authored, but execution and pass/fail are machine-run through a bounded runner (`verify.server.ts:1-18`), with a bounded fix loop (`verify.server.ts:152-223`), and the P6 gate only counts machine-promoted "tested" verdicts (`dod.ts:145-171`).

6. **Radical honesty about what it can and cannot do.** Not-configured fallbacks everywhere (`llm.ts:7-8`, `research.ts:8`), illustrative-vs-cited provenance (`engine.ts:68-69`), grounded/ungrounded footers on AI prose (`engine.ts:1344-1349`), an honest sandbox claim in the packet (`sandbox.ts:164-173`), and a deploy honesty stamp (`scaffold.ts:70-72`). Its own guide says: "It never fabricates model output" (`AGENT_GUIDE.md:78`).

7. **Works with zero keys and zero internet.** The deterministic engine "makes NO network calls" (`headless.ts:21-23`); research degrades to a *free, keyless* web-search backend that is always available server-side (`research.ts:51-62`); the crew and verify loops answer "not-configured" honestly (`crew.server.ts:18-21`, `verify.server.ts:158-160`). Every commercial agent needs an account and a model endpoint (`06_competitor_survey.md:202`).

8. **The Agent Packet — a paste-ready contract for other agents.** Version 3 packets embed a machine-readable JSON envelope (phase states, gate verdicts, decision ledger, research corpus fingerprint, report schema, sandbox claim) inside one markdown document (`packet.ts:50-113`), self-truncate loudly (`packet.ts:310-313`), and tell the consuming agent exactly which phase it may work and what to return (`packet.ts:196-199`, `packet.ts:290-295`). Competitors' closest equivalents are prose (`06_competitor_survey.md:198`).

9. **A headless CLI an AI agent can drive — no browser.** Sixteen subcommands (create, run, gate, approve, reject, ingest, packet, export, vault, search, crew, verify, design, diagram, artifacts, doctor) each print one JSON object and exit with machine-readable codes (`scripts/rapidtool-cli.mjs:1-30`); projects persist as files written atomically (`headless.ts:58-74`); `doctor` probes what the host can actually do before you drive it (`headless.ts:1238`).

10. **A knowledge vault as a byproduct of building.** Your project's memories, decisions, research, and artifacts become an interlinked Obsidian-compatible vault with a map-of-content, search, and never-dangling wikilinks (`vault.ts:1-71`) — the only *machine-maintained* second brain in the surveyed set (`06_competitor_survey.md:208`).

11. **Design systems and diagrams that are safe by construction.** Palettes are WCAG-AA-contrast-guaranteed and test-enforced (`design.ts:37-44`); the HTML preview escapes all hostile input (`design.ts:45-48`); diagrams are self-contained SVGs with XML-escaped labels (`diagram.ts:24-28`).

12. **Grounded copilot chat that cannot hallucinate your project.** The chat assistant sees only a deterministic ≤2,500-character compaction of the project and is instructed to answer only from it (`chat.server.ts:41`, `chat.server.ts:50-59`, `chat.server.ts:81-151`). It can answer questions — "why are we parked here?" — that no competitor can even parse, because only RapidTool holds the gate state (`18_chat_ux_research.md:156-166`).

13. **Corrupt data repairs itself loudly.** Imported or persisted projects pass through per-id phase repair that drops garbage, re-inserts missing phases, and logs exactly what it fixed (`engine.ts:1141-1179`, `engine.ts:1291-1311`); the import path shape-validates before repairing (`io.ts:34-47`).

14. **Agent reports are validated before they touch state.** An external agent's report must match the exact schema — right phase, legal status, non-empty summary — or it's rejected with a typed code and the project untouched (`report-intake.ts:65-120`, `errors.ts:116-125`); on acceptance it writes real memory rows and returns unmet DoD criterion ids (`report-intake.ts:246-357`, `store.ts:70-78`).

15. **Machine-readable errors designed for AI consumers.** Fourteen `RT_E_*` codes, each with a one-line meaning and a one-line "what an AI agent should do" (`errors.ts:22-37`, `errors.ts:95-166`); the CLI attaches them to every failure (`rapidtool-cli.mjs:84-110`).

16. **Serious test discipline.** The last verified gate: typecheck clean, 284/284 TypeScript suites, lint clean, production build green, zero browser console errors (`agentnotes.md:5772`) — plus live-verified real LLM calls, web research, and code execution (`agentnotes.md:5760-5768`).

---

## 5. Plain-English CONS, BOTTLENECKS & GAPS (brutally honest)

The tool's own dossiers say all of this. The loss register is explicit: it "genuinely loses" on code capability at repo scale, frontier model quality, deployment, parallelism, verification breadth, human knowledge tooling, and ecosystem (`06_competitor_survey.md:241-249`). The aggregation analysis lists hard limits: no image/video/audio generation, no "more intelligence than the model," no unbounded autonomy (`14_agi_aggregation.md:40-46`).

**Full honest list:**

- **Local-only — no cloud deploy.** Your project ends as files and a JSON export; nothing is ever deployed for you. P9's "GitHub Actions workflow" and "IaC sketch" are template *text* (`engine.ts:601-645`), and DEPLOY.md states the pipeline never executed or validated them (`scaffold.ts:20-24`). Bolt/Lovable/v0/Replit actually ship (`06_competitor_survey.md:245`).
- **Template-grade code, not bespoke apps.** The P6 generator produces a deterministic self-test module (`sandbox.ts:125-161`) — "the real code is yours to write" (`AGENT_GUIDE.md:51`). RapidTool wins the *spec* half of spec-to-app and loses the *app* half (`06_competitor_survey.md:192`).
- **Text-only model.** DeepSeek exposes only text chat completions; even the vision tier accepts image *input* only, never output (`14_agi_aggregation.md:42`). The model can't see screenshots, mockups, or the UI it's designing.
- **The bounded runner is NOT a security sandbox.** Hard timeout, no-network environment, temp dir, 1 MB output caps (`node-runner.server.ts:40-43`) — but the header is explicit: it cannot do memory/CPU rlimits or real network denial, and the deprecated worker-isolate executor has no product call sites (`sandbox.ts:176-189`, `exec.ts:16-18`). Do not run untrusted code in it.
- **The fixed 13-phase graph limits novel workflows.** Every project walks all 13 phases; a CLI tool still crosses the deploy and edge-inference gates whose content is nonsense for it. No conditional branches, no skips, no plan revision (`phases.ts:126-132`; the reviewers' verdict: "default-linear is the invariant" and phase-skipping needs deterministic predicates, `16_utility_review.md:55-56`).
- **DoD gates are advisory.** The gate registry records verdicts and fingerprints — but "gates never block a run; they make the exit criteria visible and auditable" (`store.ts:133-134`; `AGENT_GUIDE.md:12-13`). A FAIL can still advance when a human approves. (Autopilot *was* tightened: it now refuses to approve a gate whose own DoD fails, and logs the denial with the unmet ids, `store.ts:198-227` — but that's the autopilot path only.)
- **Crew is serial, advisory, one LLM call per turn.** Six roles exist with real mandates (`crew.server.ts:65-78`), but dispatch is "one DeepSeek call per turn over a deterministic phase → role table" (`crew.server.ts:9-10`) and the crew "never approves, rejects, advances, or deploys" (`crew.server.ts:15-16`). No parallelism; the parallel-fan-out idea was itself marked RECONSIDER (`16_utility_review.md:58-59`).
- **No git integration, no cloud persistence.** Everything lives in browser localStorage (`store.ts:438`); the handoff path is JSON export/import (`AGENT_GUIDE.md:81`). The "git export" enhancement was judged shelfware until real multi-file bundles exist (`16_utility_review.md:121-122`).
- **Windows-host test failures.** The scripts-leg platform suite has persistent failures on this Windows machine — symlink-privilege (EPERM) and platform-chrome cases — green only on Linux CI (`agentnotes.md:4262`, `agentnotes.md:4298`; re-observed at `agentnotes.md:4714`).
- **Verification breadth is narrow.** The machine-run loop covers the one generated module; it needs the DeepSeek key to author test cases; there's no real-browser testing like Replit Agent's (`06_competitor_survey.md:247`).
- **Same domain → same colors.** The design palette is derived from a fixed family·cast table, so every logistics project gets the same brand colors — the most visible face of the "template-grade" criticism, already on the fix list (`16_utility_review.md:99-100`).
- **No streaming, and (until recently) no conversational surface.** Runs show a pulsing dot, not live output; DeepSeek calls hardcode `stream:false` (`18_chat_ux_research.md:146-147`). The grounded chat tab has now landed (`console.tsx:100`), but streaming is still out of scope.
- **No cross-project memory.** Memory is engine-written per project; rejected reports don't write lesson rows yet (`16_utility_review.md:118-119`); the vault is per-project (`06_competitor_survey.md:208`).
- **Single-tenant, single-repo harness.** One UI, one CLI, no plugin ecosystem, no marketplace — "network effects RapidTool does not have" (`06_competitor_survey.md:249`).

**Top 8 bottlenecks ranked by impact, with one-line fixes:**

| # | Bottleneck | One-line plain-English fix |
|---|---|---|
| 1 | **It can't ship what it designs** — no deploy, template-grade code (`06_competitor_survey.md:243-245`) | Pair it with an external coding agent driven by the packet (the intended flow, `AGENT_GUIDE.md:33-39`), and grow the scaffold emitter until real multi-file agent output lands. |
| 2 | **Fixed 13-phase graph** — no skips or conditional edges (`phases.ts:126-132`, `16_utility_review.md:55-56`) | Add deterministic "skip this phase if…" predicates that still land in the ledger — keeping the linear default as the invariant. |
| 3 | **Gates are advisory** — a FAIL doesn't block a human approve (`store.ts:133-134`) | Extend the autopilot gate-denial (`store.ts:198-227`) so any approve against a failing DoD requires an explicit, logged override — like the P6 forceHuman rule already does. |
| 4 | **Serial, one-call-per-turn, advisory crew** (`crew.server.ts:9-16`) | Ship the trace spine first (so crew work is measurable), then a manager-with-budgets — the reviewers' own ordering (`16_utility_review.md:15`, `16_utility_review.md:132`). |
| 5 | **No git / cloud persistence** — localStorage only (`store.ts:438`) | Fold git export into the scaffold-emission work once multi-file bundles exist (`16_utility_review.md:121-122`); meanwhile, export JSON as backup. |
| 6 | **Text-only model** (`14_agi_aggregation.md:42`) | Take the honest path already adopted: the model writes SVG *code*, the harness sanitizes and renders it — the wave-3 `vector.ts` design (`16_utility_review.md:110-111`). |
| 7 | **Bounded runner ≠ sandbox** (`node-runner.server.ts:9-15`) | Keep the denylist and shape checks (`sandbox.ts:87-93`) as the only gate for generated code, and never let untrusted source run anywhere else. |
| 8 | **Windows-host platform test failures + durability anxiety** (`agentnotes.md:4298`) | Run the scripts suite on Linux CI as the release gate and document the two Windows EPERM cases as platform artifacts, not regressions. |

---

## 6. VS COMPETITORS — plain-English comparison

Sources: the surveyed dossiers `06_competitor_survey.md` §1–§7 (app builders, coding agents, adjacent tools), `11_agency_plan.md` §2 (top-10 audit), and `18_chat_ux_research.md` §3 (chat agents). Competitor claims are limited to what those dossiers verified from each product's own documentation — nothing is invented here.

**Where RapidTool WINS:**
- **Governance** — a sealed, machine-enforced phase machine with structured human gates and a decision ledger. "No commercial tool exposes a sealed 13-phase graph whose edges the machine enforces" (`06_competitor_survey.md:194`); app builders have "no gate at all" (`06_competitor_survey.md:196`).
- **Determinism & replay** — hash-verified gate verdicts; "nobody else in this set has it" (`06_competitor_survey.md:212`).
- **Honesty & keyless operation** — every competitor needs an account/key; RapidTool degrades to a complete deterministic floor (`06_competitor_survey.md:202`).
- **Keyless research** — free DuckDuckGo/SearXNG/Wikipedia fallback always available, Tavily optional (`research.ts:51-62`).
- **Headless CLI contract** — JSON-stdout, machine exit codes, file-based, no account (`rapidtool-cli.mjs:1-30`).
- **The vault** — the only *machine-maintained* second brain in the surveyed set (`06_competitor_survey.md:208`).
- **Project grounding** — its copilot answers questions about gate state no competitor can parse (`18_chat_ux_research.md:156-166`).

**Where RapidTool LOSES:**
- **Deployment** — Bolt/Lovable/v0/Replit/Copilot ship a URL/repo/PR; RapidTool ends in files (`06_competitor_survey.md:245`, `11_agency_plan.md:13`).
- **Repo-scale coding** — Claude Code, Cursor, Copilot, Devin, Cline edit large real codebases with frontier models (`06_competitor_survey.md:243`).
- **Multimodality** — no image/video/audio, model can't see screenshots (`14_agi_aggregation.md:42`).
- **Freeform agents** — no unbounded autonomy, by design; competitors offer parallel fleets, browser automation, tool loops (`14_agi_aggregation.md:44`, `06_competitor_survey.md:246`).
- **Verification breadth** — Replit tests in a real browser; Copilot runs tests in CI-grade envs (`06_competitor_survey.md:247`).
- **Ecosystem** — hooks, plugins, subagents, IDEs, marketplaces (`06_competitor_survey.md:249`).

**The table:**

| Tool (family) | What it does best | RapidTool wins on | RapidTool loses on |
|---|---|---|---|
| **Bolt / Lovable / v0** (prompt→app) | Fast deployable full-stack apps from one prompt; live previews; Lovable adds git sync | Governance, spec graph, oracle, decision ledger — they have none | Actually shipping the app; real previews; auth/db integrations |
| **Replit Agent** | Real-browser self-testing of the whole app | Machine-enforced gates vs the agent "deciding when to test"; deterministic replay | Browser verification breadth; 200-minute autonomous runs |
| **Claude Code** | Repo-scale edits, hooks that enforce policy, skills/subagents/SDK | Deterministic gates + verdict hashes (its memory is advisory context); keyless floor | Coding at repo scale; frontier model; ecosystem |
| **Cursor** | IDE-native multi-file edits, parallel cloud agents | Process governance and audit trail (its loop is "repo-aware edits") | Parallelism; IDE lock-in and recall |
| **Devin / OpenHands** | Autonomous fleets; OpenHands has a typed event stream | Surface the ledger *inside the handoff* — even OpenHands doesn't; deterministic verdicts | Fleet parallelism; hosted execution; action replay |
| **Aider / Cline** | Open-source terminal pair-programmers; Cline adds Plan/Act and BYO-model | A governed state machine and packet instead of conversation-based plans | Real multi-file edits; git-native workflow; model freedom |
| **CrewAI / MetaGPT** | Frameworks for orchestrating many agents (hierarchical manager, fan-out) | Deterministic anti-drift routing vs LLM speaker-selection; honesty floor; audit trail | They're *frameworks* — you wire your own governance; RapidTool's crew is still serial and advisory |
| **Hermes / Codex / Gemini chat** | Rich agent runtimes: streaming, subagents, memory, sessions, tools | Project grounding: answering "why is this gate blocked?" from machine state none of them have | Streaming UX, session memory, parallel sessions, tool loops |

**The honest bottom line (the dossiers' own words):** RapidTool is "not 'builds apps like Bolt' or 'codes like Claude Code' — it is the only tool in this survey that couples a deterministic, offline, replayable process machine with machine-minted verification verdicts and an agent-readable handoff packet, and then deliberately makes the human a structured gate, not a permission prompt" (`06_competitor_survey.md:251`). Use it *with* a coding agent, not *instead of* one.

---

## 7. In-flight additions (wave 3, audited mid-build)

These five modules existed on disk during this audit with test siblings and very fresh timestamps — they are being actively written by a sibling build wave. Descriptions below come only from each file's own header comments; they are *intended capability*, not verified-in-product claims.

- **`vector.ts`** — LLM-as-designer brand assets: the model emits compact SVG markup + palette hexes in a JSON envelope, a `sanitizeSvg` whitelist is the defense, and a deterministic `geometricMonogram` + `generateBadge` floor works with no key; LLM failures fall back to a machine-declared `source: "deterministic"` asset (`vector.ts:1-17`).
- **`planning.ts`** — plan-then-act ledger: `planSteps` emits a machine-readable `{id, action, why}` plan, `reflect()` critiques execution, `backtrack()` rewinds to the last known-good step deterministically; hard caps of 8 planned / 6 revised steps (`planning.ts:1-33`).
- **`tracing.ts`** — a pure span-tree model of one agent run (crew turn, verify pass, research fetch): append-only, invariant-enforced (parents before children, closed spans immutable), redacted by construction (`tracing.ts:1-30`); `vault.ts` already imports it to file traces into the vault (`vault.ts:64-70`).
- **`algo-tools.ts`** — algorithm workbench: an honest loop-shape complexity heuristic (explicitly "a heuristic, never a proof"), a benchmark harness body, and keyed spec→algorithm + property-style test synthesis with the standard not-configured floor (`algo-tools.ts:1-28`).
- **`arch-tools.ts`** — architecture surface over real generated code: a zero-dependency import scanner producing a dependency graph, a codebase map, and machine-minted ADR (decision-record) bodies; honestly scoped to relative imports only (`arch-tools.ts:1-25`).

---

## 8. Who should use this — and why

RapidTool is for people and teams who care about *how* software gets built as much as *what* gets built: operations-minded builders, agency leads, consultants, and AI-agent operators who must answer "why did we decide that, and can we prove it?" — plus the AI coding agents themselves, which is who the packet, the CLI, and the error-code taxonomy are really designed for. If you want a deployable app in ten minutes, Bolt or Lovable is the right tool; if you want a frontier model editing your existing codebase, use Claude Code or Cursor. But if you want a brief turned into a checked specification with risk scores, security and test contracts, human approval at every high-stakes moment, machine-run verification, and a permanent, hash-verifiable paper trail — then hand the result to your favorite coding agent with a clear conscience — RapidTool is currently the only tool in its surveyed field that does that, and it does it offline, keyless, and deterministically. It is a harness, not a magician: it will not make a weak model smart. What it will do is make *your process* — and the agent executing it — honest, auditable, and reproducible.

---

*Audit note: every `file:line` reference in this guide was re-checked against the live tree during this pass (2026-09-06, ~04:20–05:10 local). Because sibling build waves were editing `src/lib/*` concurrently, line numbers may drift by a few lines after this guide lands; the referenced symbols (`phases.ts`, `dod.ts`, `packet.ts`, `engine.ts`, `verify.server.ts`, `store.ts`, `sandbox.ts`, `scaffold.ts`, `vault.ts`, `design.ts`, `diagram.ts`, `headless.ts`, `errors.ts`, `chat.server.ts`, `research.ts`, `crew.server.ts`, `scripts/rapidtool-cli.mjs`, `agentnotes.md`) were all present and verified. Wave-3 modules (`vector.ts`, `planning.ts`, `tracing.ts`, `algo-tools.ts`, `arch-tools.ts`) are in-flight and described only from their own documentation, per §7.*
