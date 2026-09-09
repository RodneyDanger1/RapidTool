# 06 — Competitor Survey: AI App Builders, Commercial Coding Agents & Adjacent Tools (RapidTool vs. the field)

> **File:** `research/multiagent/06_competitor_survey.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
> **Date / agent:** 2026-09-05 · Flash research agent #1 (competitor survey). **Read-only on source**: no RapidTool source was modified; this is the only file written.
> **Sibling map (multiagent thread):** 01 = open-source harness digests · 02 = capability audit (A1–A9 strengths, B1–B7 gaps, E1–E4 proposals) · 03 = crew design · 04 = verification design · 05_guide_research = Obsidian/vault deep-dive · 05_live_guidance = live-layer guidance. **This file extends 01/05 rather than repeating them** — every open-source harness already digested in 01 (MetaGPT, CrewAI, AutoGen, Magentic-One, LangGraph, smolagents, OpenHands, ChatDev, gpt-engineer, Aider, AlphaCodium, Reflexion, CodeAct) is treated as *covered* and only appears in matrices with a `[01 §x]` cross-reference. AutoGPT was **not** in 01, so it gets a full digest here.
> **Method:** every external claim below cites the fetched page (marketing, docs, or README). RapidTool claims are file:line-checked against `src/lib/` on disk today. Weakness claims on commercial products cite the vendor's own docs where possible (self-admitted constraints) and independent reviews otherwise; no claim is carried on hearsay alone.

---

## 0. Honest positioning statement (read this first)

RapidTool is **not** an app builder (it does not ship a deployed full-stack product from a chat prompt), and it is **not** a code agent (it does not edit a large existing repo under an LLM's own initiative). It is a **governance harness**: a deterministic, 13-phase (P0–P12), file-backed build machine that produces *machine-checkable spec artifacts, a versioned agent packet, DoD gate verdicts with FNV-1a evidence hashes, an append-only decision ledger, and an Obsidian-ready knowledge vault* — and lets a human **or** an external AI agent drive it, with optional live research/LLM layers that degrade honestly to a keyless deterministic floor ([02 §A1–A9](02_capability_audit.md)).

Against the field that means:

- **vs. app builders (Bolt/Lovable/v0/Replit/Tempo/Onlook):** they win on speed-to-shiny-UI and deployment; RapidTool wins on *everything that happens before and after the prompt* — typed spec graphs and contracts the builder never produces, gates that cannot be skipped, an audit trail that survives the session, and an agent-readable packet instead of a chat log.
- **vs. commercial code agents (Claude Code/Cursor/Copilot/Devin/Cline/Goose):** they win on code capability at repo scale and model quality; RapidTool wins on *process guarantees* — deterministic DoD checks, machine-minted pass/fail, structured human gates with mandatory feedback, offline/keyless operation, and byte-reproducible artifacts. Every one of them treats memory and process as *advisory context for a model*; RapidTool treats them as *enforced state in a machine*.
- **vs. adjacent tools (Warp/Obsidian/Notion AI):** they win on their home turf (terminal UX, human note-taking, team knowledge search); RapidTool's vault is the only *automatically generated* second brain in this set — a byproduct of the build pipeline, not a manual chore.

The most dangerous competitors are **not** the ones that do what RapidTool does better (none does), but the ones that make governance *feel unnecessary*: Bolt/Replit/v0 with a live preview, and Claude Code/Cline with a permission prompt. RapidTool's honest wedge is the user who has watched those loops thrash on run #5 with no record of why.

---

## 1. Family A — AI app builders (prompt → deployed app)

### 1.1 Bolt.new (StackBlitz)
- **What:** browser-based full-stack AI app builder; "prompt, run, edit, and deploy" over WebContainers (Node in the browser). (https://github.com/stackblitz/bolt.new, https://bolt.new/)
- **Core loop:** prompt → scaffold → live preview in-browser → chat-iterate on the running app → deploy (Netlify/Cloudflare) or export.
- **Killer feature:** instant in-browser execution + preview — no local toolchain, edits land on a *running* app (https://github.com/stackblitz/bolt.new).
- **Weakness (self-evident + reviews):** iteration is an unstructured chat; token-metered ("Pricing, Tokens & Real Limits", https://www.taskade.com/blog/bolt-review); no gates, no spec artifact, no audit trail — the loop only remembers what the LLM's context window remembers. Original repo archived as template (MIT); product is closed SaaS.

### 1.2 Lovable
- **What:** natural-language builder of "production-grade" full-stack apps — frontend, backend, database, auth, integrations — "all backed by editable code," with Git sync, workspaces, and credit-metered plans (https://docs.lovable.dev/introduction/welcome).
- **Core loop:** describe → generate working app → chat-refine → sync to GitHub/GitLab → operate; multi-user workspaces share one plan + credit pool.
- **Killer feature:** breadth of generated surface (auth/db/integrations out of the box) plus real code ownership via Git sync (https://docs.lovable.dev/introduction/welcome).
- **Weakness:** same governance vacuum as Bolt — chat history *is* the process; no exit criteria, no human-gate structure (approval = editing the chat), no replayable state machine; "production-grade" rests on the model, not on machine checks.

### 1.3 v0 (Vercel) — now v0.app
- **What:** Vercel's AI builder; grew from "text → React component" to an agentic full-stack builder: "research, reason, debug, and plan… collaborate with you or take on the work end-to-end," one-click deploy (https://vercel.com/blog/v0-app, https://v0.app/).
- **Core loop:** one prompt → agent plans (step-by-step plan, to-do list) → builds UI/backend/logic → "checks work: spots errors, compares implementations, reasons through results" → deploy.
- **Killer feature:** plan+todo discipline and a web-search-with-citations step inside a builder — the closest app-builder analog to RapidTool's P0/P7 research phases (https://vercel.com/blog/v0-app).
- **Weakness:** plan and checks are LLM-internal, invisible, and non-replayable; Vercel-cloud-locked for the deploy path; no machine-verifiable exit criteria; still fundamentally a single-agent chat loop with fancier scaffolding.

### 1.4 Replit Agent (3 / 4)
- **What:** autonomous agent on Replit's hosted workspace; Agent 3 adds **App Testing** — "the Agent will periodically decide to test your application" in a real browser, click buttons/forms/APIs, then fix what it found — plus Max Autonomy runs ("200 minutes or more"), agent-generated agents/automations, and per-workspace Custom Instructions/Skills (https://replit.com/blog/introducing-agent-3-our-most-autonomous-agent-yet). Agent 4 markets parallel independent agents with always-visible progress (https://replit.com/agent4).
- **Core loop:** task → agent builds in hosted workspace → periodically self-tests in a browser → fixes → deploy; humans steer by chat.
- **Killer feature:** self-testing in a real browser is genuine verification energy, and Custom Instructions are a real "standing rules" mechanism (same idea as CLAUDE.md) (https://replit.com/blog/introducing-agent-3-our-most-autonomous-agent-yet).
- **Weakness:** the agent *decides* when testing is warranted ("will not test after 100% of user messages… decides when it thinks enough has changed") — self-supervision, not enforced gates; hosted and account-bound; no replayable artifact trail beyond chat/repl history; autonomy toggle (Low/High/Max) is a dial, not a contract.

### 1.5 Tempo (Tempo Labs)
- **What:** "the IDE for the whole team" — specs, designs, PRs over your real codebase; canvases that *are* code in your repo; agents produce first drafts from issues/designs, humans tune pixels, output "ships as a pull request, because it was never a mockup" (https://www.tempo.new/).
- **Core loop:** raw feedback → agent-triage to issues → agent drafts from issue+design on a worktree → human crafts → PR + CI. "Run agents on any model, in any harness" across parallel worktrees (https://www.tempo.new/).
- **Killer feature:** design/code convergence — edits are real React/Tailwind code, and worktree-parallel agents with PR/CI visibility beat single-threaded builders.
- **Weakness:** aimed at teams who already have a codebase and an IDE workflow; agents still execute free-form (any model/harness = no uniform process guarantees); no deterministic spec or gate machinery of its own; young product (YC W24/W25, https://www.ycombinator.com/companies/tempo-2).

### 1.6 Onlook
- **What:** "the Cursor for designers" — an open-source visual-first editor (26.6k★ GitHub) for direct DOM/code manipulation of React apps; its AI "understands your React components, your design tokens, and your project architecture, so every change fits seamlessly into the codebase" (https://www.onlook.com/features/ai, https://github.com/onlook-dev/onlook).
- **Core loop:** point at a running app → edit visually → code-as-source-of-truth changes land in the repo → AI assist for style/composition/refactor.
- **Killer feature:** visual editing with code as the source of truth; edits are constrained to your real components/tokens (https://www.onlook.com/features/ai).
- **Weakness:** frontend/design surface only — no backend, no process, no verification; a designer's scalpel, not a build system.

---

## 2. Family B — commercial coding agents / CLIs

### 2.1 Claude Code (Anthropic)
- **What:** agentic coding assistant on terminal, IDE extensions, desktop, and web; "understands your entire codebase and can work across multiple files and tools" (https://code.claude.com/docs/en/overview).
- **Core loop:** task → read files → edit/run tools → ask before sensitive actions (permission-based architecture: read-only default in Manual mode; a separate classifier model reviews actions in auto mode) → commit (https://code.claude.com/docs/en/security).
- **Killer features:** (1) the *harness ecosystem*: CLAUDE.md + auto memory + hooks + subagents + Agent SDK (https://code.claude.com/docs/en/memory, https://code.claude.com/docs/en/agent-sdk/overview); (2) sandboxing and audit/monitoring hooks (https://code.claude.com/docs/en/security).
- **Weakness (self-admitted in docs):** memory is advisory — "Claude treats them as context, not enforced configuration. To block an action regardless of what Claude decides, use a PreToolUse hook" (https://code.claude.com/docs/en/memory); no deterministic exit criteria; quality of process depends on the user's CLAUDE.md craft; Anthropic-account/subscription default (third-party providers exist but are not the happy path, https://code.claude.com/docs/en/overview).

### 2.2 Cursor (Composer / Cloud Agents)
- **What:** AI-first IDE whose agent (Composer) does multi-file, multi-step work; **Cloud Agents** (formerly Background Agents) run in parallel in the cloud on snapshots of your environment, shareable with teammates, automatable, and self-hostable (https://cursor.com/docs/cloud-agent, https://cursor.com/).
- **Core loop:** prompt → agent plans → edits in IDE or cloud sandbox → review diff → iterate; cloud agents run concurrently and report back.
- **Killer feature:** parallel cloud agents + environment snapshots + team sharing + automations (https://cursor.com/docs/cloud-agent).
- **Weakness:** everything is model-behavior-shaped (proprietary model plans/checks); IDE-centric; no deterministic gates, no machine-readable handoff artifact, no replay; per-seat subscription and usage limits; agent *review* is a UI pattern, not a machine check.

### 2.3 GitHub Copilot cloud agent (formerly Copilot Workspace)
- **What:** GitHub-hosted agent: "research a repository, create an implementation plan, and make code changes on a branch. You can review the diff, iterate, and create a pull request" — in an ephemeral dev environment powered by GitHub Actions where it can "execute automated tests and linters" (https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent).
- **Core loop:** task (issue/comment/agent panel) → research repo → implementation plan → branch changes → tests/linters in ephemeral CI env → PR; automatable on schedules/events; `@copilot` in PR comments.
- **Killer feature:** plan → branch → PR inside the repo's native review flow, with tests actually executed in the ephemeral Actions environment — the closest commercial analog to RapidTool's DoD-verified handoff to a human reviewer (https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent).
- **Weakness:** GitHub-only ("only works with repositories hosted on GitHub"); the "plan" is prose, not a machine-checkable artifact; no deterministic exit criteria — the agent evaluates its own task ("will evaluate the task it has been assigned based on the prompt you give it"); paid Copilot plans required (same page).

### 2.4 Devin (Cognition)
- **What:** "the first autonomous software engineer" — a hosted agent that "plans, writes, tests, and ships production code inside your existing workflows": PR review with visual QA in a real browser, parallel fleets for migrations, scheduled chores (daily QA, release notes), issue triage, DeepWiki docs generation, and a knowledge store of tribal knowledge (https://devin.ai/, https://cognition.com/).
- **Core loop:** assign task (Linear/GitHub/Slack) → Devin plans, works in its own environment, iterates on CI/PR feedback → human reviews the PR.
- **Killer features:** parallel fleet execution, browser-based visual QA, CI-feedback loop, and marketed "complete audibility at each step" (https://devin.ai/).
- **Weakness:** hosted black box at a premium price point; independent testing still shows "impressive strengths and major limitations" on real tasks (https://trickle.so/blog/devin-ai-review); process quality is model-dependent — no deterministic spec/DoD machinery; "audibility" is a claim, not a hash-verifiable artifact.

### 2.5 Cline
- **What:** open-source agent runtime (Apache-2.0, 67.5k★, 8M+ installs) usable as IDE extension, CLI, or SDK: "One open source agent runtime. Use it in your editor, your terminal, or embed it in your own products" — bring-your-own model incl. any OpenAI-compatible API (https://cline.bot/, https://github.com/cline/cline).
- **Core loop:** **Plan then Act** — Plan mode explores the codebase and lays out strategy; after human alignment, Act mode executes; auto-approve optional (https://cline.bot/, https://github.com/cline/cline).
- **Killer feature:** plan/act separation as an explicit mode plus a scriptable CLI for "scripts, cron jobs, and CI pipelines" — the open-source agent most philosophically adjacent to RapidTool's headless driver (https://cline.bot/).
- **Weakness:** still an unstructured single-agent loop — the plan is conversation, gates are permission toggles, no deterministic checks; quality depends on the chosen model; no spec/artifact/audit machinery (Cline's own checkpoints are session rollback, not process records).

### 2.6 Goose (Block → Linux-foundation-adjacent)
- **What:** "your native open source AI agent — desktop app, CLI, and API — for code, workflows, and everything in between"; general-purpose local agent beyond coding (research, writing, automation), extensible via extensions/MCP; Apache-2.0, 53.9k★ (https://github.com/aaif-goose/goose — the `block/goose` repo redirects here; https://goose-docs.ai/).
- **Core loop:** task → agent plans with extensions (tools/recipes) → executes on your machine → human approves commands as needed.
- **Killer feature:** recipe/extension model that turns any CLI or MCP server into a tool, with any LLM (local or hosted) (https://github.com/aaif-goose/goose).
- **Weakness:** general-purpose autonomy without governance — recipes encode *how*, nothing enforces *what good means*; no deterministic verification, no exit criteria, no artifact ledger; single-agent.

### 2.7 AutoGPT
- **What:** pivoted from the 2023 autonomous-agent experiment (185k★) to a hosted "agents that finish the work" platform: describe an outcome in plain English **or** shape every step — low-code agent builder, scheduled/recurring runs, apps built on the platform (https://agpt.co/, https://github.com/significant-gravitas/autogpt).
- **Core loop:** outcome prompt → visual agent graph (steps/blocks) → runs → reports; human edits the graph when it misbehaves.
- **Killer feature:** the explicit middle ground between prompt-only and code-only agent definition — a visual, editable control flow (https://github.com/significant-gravitas/autogpt).
- **Weakness:** platform is about business automation, not software builds; steps are tool calls, not phase gates with exit criteria; no spec/DoD/audit machinery; hosted SaaS.

> **Already covered in 01 (no digest here):** MetaGPT [01 §1.1], CrewAI [01 §1.2], AutoGen [01 §1.3], Magentic-One [01 §1.4], LangGraph [01 §1.5], smolagents [01 §1.6], OpenHands [01 §1.7], ChatDev [01 §1.8], gpt-engineer [01 §1.9], Aider [01 §1.10], AlphaCodium [01 §1.11], Reflexion [01 §1.12], CodeAct [01 §1.13].

---

## 3. Family C — adjacent (terminal AI, second brain, team knowledge)

### 3.1 Warp (terminal AI / Agent Mode)
- **What:** "the command line for the AI era" — an agentic terminal where natural-language "Agent Mode" recognizes commands vs. prose (via a *local* classifier that ships with the app), executes multi-step workflows, learns CLI tools from `--help`/docs, and has grown into an open agent platform ("warp agent run-cloud --environment ENV_ID") (https://www.warp.dev/ai, https://www.warp.dev/).
- **Core loop:** type intent → Agent Mode plans steps → **you approve each command** → it executes in your terminal → iterate; denylist controls what is ever treated as NL.
- **Killer feature:** approval-before-execution with local NL detection — privacy and human control as a design center ("watch Agent Mode like a self-driving car, and cancel out of any requested commands that are unsafe or sensitive" — their own docs) (https://www.warp.dev/ai).
- **Weakness:** command approval is a *permission moment*, not a *quality gate* — no structured feedback, no DoD, no artifact trail; guidance is environment-specific but process is ephemeral; proprietary terminal client.

### 3.2 Obsidian
- **What:** local-first markdown knowledge base ("stores notes privately on your device… even offline") with wikilinks, backlinks/graph, thousands of plugins, paid Sync/Publish (https://obsidian.md/, https://community.obsidian.md/plugins). **Full feature deep-dive already in-repo:** `research/multiagent/05_guide_research.md` S1–S8 (atomic notes, backlinks, MOC, tags, FusionRank) — the vault module (`src/lib/vault.ts`) was built to that survey.
- **Core loop:** human captures atomic notes → links them → graph/backlinks surface structure → search/plugins retrieve.
- **Killer feature:** the linking model + plugin ecosystem + guaranteed local/offline ownership of plain files (https://obsidian.md/).
- **Weakness:** *everything is manual* — no generation, no execution, no process; a notebook cannot build, test, or gate anything; AI features are third-party bolt-ons.

### 3.3 Notion AI (Notion Agent)
- **What:** AI layer over the Notion workspace: Q&A/search across Notion + connected apps (Slack, Google Drive), and **Notion Agents** that "complete complex, multi-step tasks using context from Notion, your connected apps, and the web," plus Custom Agents on a credit meter with admin controls and enterprise search (https://www.notion.com/product/ai, https://www.notion.com/help/guides/everything-you-can-do-with-notion-ai).
- **Core loop:** ask in the workspace → agent retrieves across connected sources → acts (draft, update database, run a custom agent) → admin-governed rollout.
- **Killer feature:** retrieval across your org's living documents + autonomous custom agents with admin governance (https://www.notion.com/product/ai).
- **Weakness:** knowledge *and* action both live inside Notion's walled garden; agents act on docs/databases, never on code with tests; no deterministic verification; credit-metered autonomy.

---

## 4. Feature matrix

Legend: **✓** ships it · **±** partial / shaped like it but weaker · **✗** absent (or n/a for the category). Evidence is one short phrase; `[01 §x]` = covered in file 01. Rows are the capability questions that decide whether an agentic build is *trustworthy*.

### 4.1 Matrix — Family A (app builders) vs. RapidTool

| Capability | Bolt.new | Lovable | v0.app | Replit Agent 3/4 | Tempo | Onlook | **RapidTool** |
|---|---|---|---|---|---|---|---|
| **Spec-to-app** (brief → working code/app) | ✓ prompt→full-stack app (github.com/stackblitz/bolt.new) | ✓ NL→full-stack w/ auth+db (docs.lovable.dev) | ✓ one prompt→full-stack+deploy (vercel.com/blog/v0-app) | ✓ hosted build + deploy (replit.com/blog) | ✓ issue→draft on real code→PR (tempo.new) | ± UI-only visual edits (onlook.com/features/ai) | **±** brief→typed spec graph/contracts + P6 template module + self-test; not a deployed product ([02 §A2]; engine.ts synthesizePhase) |
| **13-phase-style governed pipeline** (sealed phases, DoR) | ✗ single chat loop | ✗ single chat loop | ± agent plan+to-dos, invisible (vercel.com/blog/v0-app) | ± task lists w/ self-supervision, no seals (replit.com/blog) | ± issue→draft→PR flow, no sealed phases (tempo.new) | ✗ editor, no pipeline | **✓** P0–P12, `canEnter` only from+1, `priorsSealed` (phases.ts:118–131) |
| **Human gates** (structured approval + feedback) | ✗ chat review only | ✗ chat review only | ✗ chat review only | ± Low/Med/High/Max autonomy dial (replit.com/blog) | ± human crafts after agent draft (tempo.new) | ✗ | **✓** stock HITL at P4/P5/P8/P9 + forceHuman on failed P6 sandbox; reject requires ≥12-char feedback (phases.ts:133–135; engine.ts:962–1017) |
| **Packet / handoff artifacts** (machine-readable handoff) | ✗ | ✗ | ✗ | ± Custom Instructions/Skills = standing rules (replit.com/blog) | ± issue+design passed to agents (tempo.new) | ✗ | **✓** versioned agent packet + `## System JSON` envelope (packet.ts:7,21–65); per-phase handoff checklists (handoff.ts) |
| **Audit trail** (append-only ledger) | ✗ chat only | ✗ chat only (version history, no ledger) | ✗ | ± repl history (hosted) | ± PR/CI history | ✗ | **✓** decisions (≤100) + logs (≤200) + rejectionHistory + memory rows, JSON-exportable (engine.ts approve/reject paths; io.ts) |
| **Offline / keyless** | ✗ cloud SaaS | ✗ cloud SaaS | ✗ cloud SaaS | ✗ hosted | ✗ desktop IDE, needs repo+model | ± local OSS editor, needs app+model | **✓** deterministic engine: zero keys, zero network; live layers degrade to deterministic floor (headless.ts header; [02 §A6]) |
| **Headless CLI** (agent/CI drivable) | ✗ browser only | ✗ browser only (+Git sync) | ✗ browser only | ± Replit Agent API (cloud) | ± worktrees, harness-agnostic (tempo.new) | ✗ | **✓** `rapidtool-cli.mjs` new/run/gate/approve/reject/packet/json/summary/vault/search/crew/verify (scripts/rapidtool-cli.mjs:118–272) |
| **Multi-agent crews** | ✗ 1 agent | ✗ 1 agent | ✗ 1 agent | ✓ Agent 4 parallel agents (replit.com/agent4); Agent 3 builds agents | ✓ parallel agents on worktrees (tempo.new) | ✗ | **±** advisory DeepSeek crew, deterministic role table, serial, never advances (crew.server.ts header) |
| **Memory / second brain** | ✗ | ✗ | ± remembers what you built (vercel.com/blog/v0-app) | ± Custom Instructions per workspace (replit.com/blog) | ± linked specs/designs in repo | ✗ | **±** typed memory rows (episodic/semantic/procedural) + Obsidian-ready vault export w/ search (vault.ts; headless.ts:709) — engine-written only [02 §B6] |
| **Verification loops** (machine-run checks) | ✗ no test discipline | ✗ | ± "checks work" = model self-check (vercel.com/blog/v0-app) | ✓ real-browser app testing, agent-decided (replit.com/blog) | ± PR CI status visible (tempo.new) | ✗ | **±** oracle cases → real runner → fail-to-fix ≤3; "passed" only from a machine run (verify.server.ts; [04]) |
| **Deterministic replay** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** FNV-1a gate evidence hashes, deterministic algorithms + vault text, codegen variant = fnv1a(note)+attempt (dod.ts:213–240; vault.ts header; engine.ts:469–470) |

### 4.2 Matrix — Family B (coding agents) vs. RapidTool

| Capability | Claude Code | Cursor (Composer/Cloud) | Copilot cloud agent | Devin | Cline | Goose | AutoGPT | **RapidTool** |
|---|---|---|---|---|---|---|---|---|
| **Spec-to-app** | ± edits your repo; no app scaffold (code.claude.com/docs) | ± repo agent | ± repo agent → PR | ± repo agent → PR | ± repo agent | ± general agent, any task (github.com/aaif-goose/goose) | ✗ business automation | **±** typed spec→module scaffold, not repo-scale codegen (see 4.1) |
| **13-phase-style governed pipeline** | ✗ free-form loop; harness via hooks (docs) | ✗ free-form | ± research→plan→branch (docs.github.com) | ± plans tasks, no sealed graph (devin.ai) | ✗ free-form plan/act (cline.bot) | ✗ | ± visual step graph (agpt.co) | **✓** sealed phase graph (phases.ts) |
| **Human gates** | ✓ permission prompts/classifier (code.claude.com/docs/en/security) — unstructured approvals | ± diff review UI | ✓ PR review = gate | ✓ PR/CI feedback loop (devin.ai) | ± auto-approve toggle (github.com/cline/cline) | ± command approvals | ✗ | **✓** structured HITL w/ 12-char feedback + ledger + forceHuman (engine.ts:871–1017) |
| **Packet / handoff artifacts** | ± CLAUDE.md/auto memory = context, not enforced (code.claude.com/docs/en/memory) | ✗ | ± prose implementation plan (docs.github.com) | ± knowledge store (devin.ai) | ± plan-mode conversation | ± recipes (github.com/aaif-goose/goose) | ± step graph (agpt.co) | **✓** versioned machine-readable packet (packet.ts) |
| **Audit trail** | ± monitoring/usage tracking, no exportable ledger (code.claude.com/docs/en/security) | ✗ | ✓ GitHub-native history | ± marketed "audibility" (devin.ai), hosted black box | ± session checkpoints | ✗ | ✗ | **✓** append-only ledger + JSON export (engine.ts; io.ts) |
| **Offline / keyless** | ✗ needs Anthropic acct (or 3rd-party key) (docs) | ✗ SaaS/IDE | ✗ GitHub+plan | ✗ hosted | ✗ needs model endpoint | ✗ needs model endpoint | ✗ hosted | **✓** deterministic keyless floor (headless.ts; [02 §A6]) |
| **Headless CLI** | ✓ terminal-first CLI (code.claude.com/docs/en/overview) | ± cloud-agent API | ± automations (docs.github.com) | ± API/fleet (devin.ai) | ✓ CLI+SDK (cline.bot) | ✓ CLI+desktop+API (github.com/aaif-goose/goose) | ✗ | **✓** file-based CLI (rapidtool-cli.mjs) |
| **Multi-agent crews** | ✓ subagents/hooks (code.claude.com/docs; claude.com/blog "harness for every task") | ✓ parallel cloud agents (cursor.com/docs/cloud-agent) | ✗ 1 agent (+automations serial) | ✓ parallel fleets (devin.ai) | ✗ 1 agent | ✗ 1 agent | ± many agents, not a crew | **±** advisory crew, deterministic routing (crew.server.ts; [03]) |
| **Memory / second brain** | ± CLAUDE.md + auto memory, first 200 lines/25KB, advisory (code.claude.com/docs/en/memory) | ± codebase index/semantic search (cursor.com) | ✗ | ± tribal-knowledge store (devin.ai) | ✗ | ± recipes, no persistent learning | ✗ | **±** typed + vault export, engine-written only ([02 §B6]) |
| **Verification loops** | ± can run tests, nothing forces it (code.claude.com/docs/en/best-practices) | ± runs builds/tests on request | ✓ tests+linters in ephemeral Actions env (docs.github.com) | ✓ visual QA + CI feedback (devin.ai) | ± runs commands | ± can run commands | ✗ | **±** machine-run oracle loop for generated module (verify.server.ts) |
| **Deterministic replay** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** evidence hashes + deterministic regen (dod.ts; vault.ts) |

### 4.3 Matrix — Family C (adjacent) vs. RapidTool

| Capability | Warp | Obsidian | Notion AI | **RapidTool** |
|---|---|---|---|---|
| **Spec-to-app** | ✗ terminal agent, no app builds | ✗ notes app | ✗ doc/db actions, no code | **±** governed spec→module scaffold |
| **13-phase-style governed pipeline** | ✗ multi-step workflows, no seals | ✗ | ± custom agents = steps, no seals (notion.com/product/ai) | **✓** P0–P12 sealed graph |
| **Human gates** | ± approve each command, no structured feedback (warp.dev/ai) | ✗ | ± admin controls on agents (notion.com/product/ai) | **✓** structured HITL w/ feedback |
| **Packet / handoff artifacts** | ✗ | ✗ | ✗ | **✓** packet + `## System JSON` |
| **Audit trail** | ✗ | ✗ | ✗ | **✓** ledger + logs + history |
| **Offline / keyless** | ✗ AI needs network (warp.dev/ai) | ✓ local-first, fully offline (obsidian.md) — but no engine | ✗ cloud | **✓** deterministic engine offline + keyless |
| **Headless CLI** | ✓ terminal-native (warp.dev) | ✗ GUI app | ✗ | **✓** rapidtool-cli.mjs |
| **Multi-agent crews** | ✗ 1 agent | ✗ | ✓ Notion Agents / custom agents (notion.com/product/ai) | **±** advisory crew |
| **Memory / second brain** | ✗ | ✓ human-curated vaults, backlinks, plugins — manual (obsidian.md; [05 §S1–S8]) | ✓ Q&A across Notion/Slack/Drive (notion.com/help/guides) | **±** *auto-generated* per-project vault (vault.ts) — no cross-project memory |
| **Verification loops** | ✗ | ✗ | ✗ | **±** machine-run oracle loop (verify.server.ts) |
| **Deterministic replay** | ✗ | ✓ deterministic files (obsidian.md) but static | ✗ | **✓** hashed, regenerable artifacts |

---

## 5. RapidTool vs. everyone — capability-by-capability verdict (grounded)

Per capability row of §4, what RapidTool actually has that the competition lacks — and where it genuinely does not win (see §7 for the full loss register). All RapidTool refs are to `src/lib/`.

1. **Spec-to-app — RapidTool does NOT win.** Bolt/Lovable/Replit/v0 turn a brief into a deployable app; RapidTool turns a brief into a *typed, machine-checkable design* (intent lattice `algorithms.ts:145`, constraint scheduler `:264`, spec graph `:326`, data contracts `:406`, test oracle `:438`, feasibility scorecard `:563`) plus a P6 template module with a real self-test. It wins the *spec* half of "spec-to-app" decisively — no app builder emits a spec graph or an oracle at all — but loses the *app* half. Honest framing: RapidTool is the best *before* and *around* the code; it is not a code factory. (`runAlgorithms` `algorithms.ts:614`; engine P6 branch `engine.ts:463–526`.)

2. **13-phase-style pipelines — RapidTool wins, uncontested in this set.** `canEnter` allows only `from+1` (`phases.ts:118–120`), `priorsSealed` requires every prior phase `complete` (`phases.ts:122–131`), phase status moves only locked→ready→running→awaiting_hitl→complete ([02 §A1]). Closest analogs: Copilot's research→plan→branch (prose), v0's plan/to-dos (LLM-internal), Magentic-One ledgers ([01 §1.4]) and ChatDev's waterfall ([01 §1.8]) — all open-source or invisible. No commercial tool exposes a *sealed* 13-phase graph whose edges the machine enforces.

3. **Human gates — RapidTool wins on structure; Claude Code/Warp win on ubiquity.** RapidTool's HITL is a state-machine edge: `approveHitl` completes the current phase and un-readies the next only when a pending gate exists; `rejectHitl` refuses <12-char feedback, records `decidedBy`, appends to `rejectionHistory`, logs `hitl.rejected`, and writes an episodic memory row (`engine.ts:871–1017`); autopilot may not approve `forceHuman` gates (`engine.ts:886–895`); stock gates sit at P4 security, P5 validation, P8 UI, P9 deploy (`phases.ts:133–135`). Claude Code's permission prompts and Warp's command approvals are real but *stateless* — they gate an action, not a phase, and capture no structured feedback or verdict ledger. No builder (Bolt/Lovable/v0) has any gate at all.

4. **Packet/handoff artifacts — RapidTool wins; the field's closest is prose.** `compileAgentPacket` emits a version-stamped (`PACKET_VERSION = 2`) markdown packet whose fenced `## System JSON` block is machine-parseable: per-phase status/gate/rejection, decision ledger with actor + ISO timestamps, `rejection_loop` metadata, sandbox claim, honesty markers, and truncation notices (`packet.ts:7,21–65,242–244`); per-phase `phaseHandoff` prompts add checklist context (`handoff.ts`). Claude Code's CLAUDE.md/auto-memory is *advisory context* ("not enforced configuration", https://code.claude.com/docs/en/memory); Copilot's implementation plan is prose on GitHub (https://docs.github.com); Replit's Custom Instructions are standing rules, not a per-edge state handoff. RapidTool's packet is the only artifact in the set designed for a *stateless agent to resume from* ([02 §A3], review/03 rationale).

5. **Audit trails — RapidTool wins among commercial; OpenHands (OSS) is the peer.** Append-only per-phase rejection history + decision ledger (capped 100) + event log (capped 200) + episodic memory rows on every reject/override, all exported in project JSON (`engine.ts` approve/reject paths; `io.ts`; [02 §A5]). Claude Code offers monitoring/usage tracking (https://code.claude.com/docs/en/security) but no exportable verdict ledger; Devin *markets* audibility (https://devin.ai/) inside a hosted black box; OpenHands' typed event stream ([01 §1.7]) is the genuine OSS peer — and RapidTool's packet surfaces the ledger *inside the handoff*, which even OpenHands does not.

6. **Offline/keyless — RapidTool wins; only Obsidian (non-generative) is local.** The deterministic engine makes zero network calls and needs zero keys: research/LLM/crew/verify layers each resolve to typed `{ok:false, reason:"not-configured"}` and the engine falls back to the identical deterministic result — "a run never strands and never fabricates output" (`headless.ts` header; `engine.ts:1387–1404`; [02 §A6/A8]). Every commercial agent needs an account, a key, or a model endpoint; Cline/Goose can point at local models but still require model infra and have no deterministic floor. Honest caveat: keyless output is *template-grade* — deterministic scaffolds, not bespoke code.

7. **Headless CLI — RapidTool is in the lead pack, not alone.** `rapidtool-cli.mjs` drives the entire governed lifecycle from files: create/run/gate/approve/reject/retry/ingest, packet/json/summary output, vault build/search, crew run, verify (`scripts/rapidtool-cli.mjs:118–272` over `headless.ts:43–774`, atomic write-then-rename persistence `headless.ts:51–71`). Claude Code (terminal-first) and Cline (CLI/SDK, "scripts, cron jobs, and CI pipelines", https://cline.bot/) are equally headless — and stronger coders. RapidTool's CLI edge is what it drives: a phase machine with gates and deterministic output, JSON-stdout friendly, no account required.

8. **Multi-agent crews — RapidTool is partial; Devin/Cursor/Replit-4 lead on parallelism.** RapidTool's crew is a deterministic phase→role table (planner/architect/implementer/reviewer/tester with per-role mandates, tool lists, token budgets, and handoff text — `algorithms.ts:487–530`; JSON roles `crew.server.ts`), dispatched one DeepSeek call per turn with role-scoped context budgets; the researcher turn is grounded with `UNTRUSTED`-marked findings; the crew is **advisory** — it never approves, rejects, or advances, and cost/step limits return an honest partial transcript with `stopped` (`crew.server.ts` header). Against CrewAI's LLM-manager and MetaGPT's chatter, deterministic routing is a genuine anti-drift win ([01 §1.1/§1.2], [03 §2]); against Devin fleets and Cursor's parallel cloud agents (https://devin.ai/, https://cursor.com/docs/cloud-agent), it is one model, serial, and non-executive — a real gap (§7.4).

9. **Memory / second brain — RapidTool is partial; Obsidian and Claude Code lead their halves.** RapidTool: `bootstrapMemory` seeds typed rows (`algorithms.ts:532`), engine/reject/override paths append episodic rows, rows are deduped, capped, ranked by FusionRank into every packet (`packet.ts:75–79`; `engine.ts` memory caps), and `vault.ts` turns the whole project (memory + decisions + research corpus + top artifacts + phase spine) into an Obsidian-ready interlinked markdown vault — deterministic, byte-identical for equal input, with never-dangling wikilinks and a ranked `searchVault` (`vault.ts` header; `headless.ts:709–750`). Gaps: rows are engine-written only — `applyReport` still writes no memory ([02 §B6/M-08], verified in `report-intake.ts:142–160`); the vault is per-project; no cross-project corpus. Claude Code's auto memory is model-written from corrections (https://code.claude.com/docs/en/memory); Obsidian's vaults are human-curated and richer ([05 §S1–S8]). RapidTool's unique claim stands: it is the only *machine-maintained* second brain in the set — the vault is a byproduct of the build, not a chore.

10. **Verification loops — RapidTool is partial; Replit Agent 3 and Copilot cloud agent lead on breadth.** RapidTool: `verify.server.ts` has DeepSeek author boolean assertion *expressions* against the source's exports (`generateCases`), a machine harness evaluates them via the bounded Node runner (`runCases`, `node-runner.server.ts`), and `verifyAndFixServer` loops fail→patch→re-run ≤3 iterations; status `"passed"` is minted only from a real runner pass, with evidence text; no key ⇒ honest `not-configured` (`verify.server.ts` header). P6's template self-test + one-shot heal + `forceHuman` on failure predates it (`engine.ts:463–526`; `sandbox.ts:99–104`; [04]). Competitors: Replit Agent 3 tests in a real browser but *decides when* ("when it thinks enough has changed", https://replit.com/blog); Copilot executes tests/linters in its ephemeral Actions env (https://docs.github.com); Claude Code *can* run tests but its own best-practices docs push "a check it can run" as advice (https://code.claude.com/docs/en/best-practices, cited in [02 §B1]); v0's "checks work" is a model self-check (https://vercel.com/blog/v0-app). RapidTool's edge is *enforcement + honesty* — machine-minted verdicts, bounded retries, no fabricated pass — but its coverage (one generated module) is narrow (§7.6).

11. **Deterministic replay — RapidTool wins; nobody else in this set has it.** Gate verdicts are FNV-1a hashes over sorted `id:pass|fail` pairs, so a recorded verdict can be re-verified against the project state any time (`dod.ts:213–240`); DoD probes read only project content — "never timestamps, ids or randomness" (`dod.ts:20–35`); codegen variant selection is `fnv1a(rejectionNote)+attempt` so identical history ⇒ identical next attempt (`engine.ts:469–470`, `sandbox.ts:146–153`); vault output is byte-identical for equal project state (`vault.ts` header). Honest boundary: phase *artifacts* embed `Date.now()` timestamps, so "replay" means *same verdicts, same algorithms, same text content modulo stamps* — not byte-identical whole-run regeneration, and not OpenHands-style action-log replay ([01 §1.7]). No commercial competitor offers even the hash-verifiable gate half.

---

## 6. What to steal (ranked, with concrete file mappings)

Ranking: **P0 = do next wave** (cheap, closes a named audit gap [02]), **P1 = high value**, **P2 = later / optional**. "Idea → mapping" is the concrete destination; re-use the concept, not code.

| # | Competitor | Stolen idea (cite) | Concrete mapping into RapidTool | P |
|---|---|---|---|---|
| 1 | Claude Code | **Enforced pre-action checks**: "To block an action regardless of what Claude decides, use a PreToolUse hook" (https://code.claude.com/docs/en/memory) — i.e., policy enforced at the tool boundary, not in the prompt | Autopilot must not approve a phase whose recorded gate failed: extend `canAutopilot` (`src/lib/store.ts:126–132`) + `approveHitl` (`src/lib/engine.ts:871`) to require `runGate(...).pass` and log `autopilot.gate_denied` — already proposed as [02 §E4.2] | P0 |
| 2 | Claude Code | **Auto memory from corrections**: Claude writes notes from user feedback; loaded next session (https://code.claude.com/docs/en/memory) | Memory write-back on *approved* agent reports: `applyReport` (`src/lib/report-intake.ts:142–160`) appends semantic/episodic rows (summary, artifact titles, `tests_run` when present) so FusionRank has real signal — closes [02 §B6/M-08]; cap+dedupe via existing helpers (`engine.ts:175`) | P0 |
| 3 | Replit Agent 3 | **Self-test in a real browser** — click buttons/forms/APIs, then fix (https://replit.com/blog/introducing-agent-3-our-most-autonomous-agent-yet) | Extend the verification seam from expression-eval to UI smoke: new `runBrowserCases` beside `runCases` in `src/lib/verify.server.ts`, reusing `scripts/browser-smoke.mjs` + `src/lib/preview-host-bridge.ts` patterns; wire as optional P8 gate probe in `src/lib/dod.ts` (honest `not-configured` when no browser/runner) | P1 |
| 4 | GitHub Copilot cloud agent | **Tests/linters executed in the same environment that produces the PR** (https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent) | `rapidtool-cli.mjs` gains a `check` command: run `runGate` over every recorded verdict + re-run `verify` on the current module, exit non-zero on drift — makes the evidence hash actually *enforceable in CI*; thin addition over `src/lib/dod.ts` exports + `scripts/rapidtool-cli.mjs` dispatch | P0 |
| 5 | Cline | **Plan mode / Act mode separation** — align on strategy before execution (https://cline.bot/, https://github.com/cline/cline) | Headless driver `--plan` dry-run flag: `runPhase` with a preview mode that prints the synthesized phase artifacts + DoD criteria *without* advancing state; implement as an option in `src/lib/headless.ts:200` `runPhase` (it already separates synthesis from `applyPhaseResult`) | P0 |
| 6 | Copilot / Devin | **Human review of a diff as the ship gate** (PR-native flow) (https://docs.github.com, https://devin.ai/) | `[agent report]` intake already validates before state change (`src/lib/report-intake.ts:43–101`); add a machine-diff summary (files touched vs. spec-graph order `algorithms.ts:326`) to the packet's Phase-work block (`src/lib/packet.ts:225–236`) so the human gate at P5/P8/P9 reviews a *contract delta*, not prose | P1 |
| 7 | Tempo | **"Agents draft. You craft."** — agent output is a starting point that ships through human-tuned PRs (https://www.tempo.new/) | Formalize the advisory-crew output as a *draft proposal* phase artifact that `approveHitl` can attach to the decision record; wire `runCrew` output (`src/lib/headless.ts:752`) → `[agent report]` intake (`src/lib/report-intake.ts`) → human gate — makes the existing advisory crew (never-advancing by design, `crew.server.ts` header) *useful* instead of decorative | P1 |
| 8 | Warp | **Local intent classifier + denylist + explicit command approval** (https://www.warp.dev/ai) | Rejection/approval UX already exists; steal the *denylist* idea for report intake: `validateReport` (`src/lib/report-intake.ts:43`) rejects agent reports whose `files`/commands hit the sandbox deny-list scanner already in `src/lib/sandbox.ts:24–67` | P1 |
| 9 | Obsidian | **Backlink navigation over the note graph** ([05 §S2], https://obsidian.md/help/links) | `vaultIndex` already groups by kind/tag (`src/lib/vault.ts`); add inverted-link "linked from" sections to `vaultIndexMarkdown` (`src/lib/vault.ts:592`) so phase↔memory↔decision backlinks are browsable both in the vault and in the console tab | P1 |
| 10 | Devin | **Parallel fleet execution + scheduled chores** (https://devin.ai/) | Crew is serial/advisory today; cheapest parallelism is *process-level*: document + support running N headless projects (one `project.json` each) and folding results in via `ingest` (`src/lib/headless.ts:359`); later, a scheduler doc + `runUntilGate` cron loop (`headless.ts:316`) | P2 |
| 11 | AutoGPT | **"Describe an outcome… or shape every step"** — editable middle ground between prompt-only and code-only control flow (https://github.com/significant-gravitas/autogpt) | Externalize crew seat config: `routeCrew` (`src/lib/algorithms.ts:487`) currently hard-codes roles/budgets; allow a per-project `crew.json` override of mandates/budgets/handoffs — same shape, user-tunable | P2 |
| 12 | v0 | **Plan + to-do list that the agent updates as it works** (https://vercel.com/blog/v0-app) | `SchedulerPlan` (`algorithms.ts:264`) is computed but under-surfaced; emit it as a `## Plan` checklist block in `compileAgentPacket` (`src/lib/packet.ts:68`) so the consuming agent gets an explicit, machine-checkable task list per phase (also fixes [02 §B5-agent-side] alignment) | P0 |
| 13 | Cursor | **Environment snapshots / shareable agent sessions** (https://cursor.com/docs/cloud-agent) | RapidTool already snapshots via JSON export/import (`src/lib/io.ts`, `headless.ts:43`); add a `snapshot` CLI command that exports pre-run state + a `diff` of phase records before/after `runPhase` — cheap replay hygiene | P2 |
| 14 | Notion AI | **Q&A across your connected knowledge** (https://www.notion.com/product/ai, https://www.notion.com/help/guides/everything-you-can-do-with-notion-ai) | `vaultSearch` is per-project (`headless.ts:709`); a cross-project variant over a directory of `project.json` files gives "ask my build history" — reuse `fusionRank` (`algorithms.ts:214`) as the cross-vault ranker | P2 |
| 15 | Goose | **Recipe/extension model** (https://github.com/aaif-goose/goose) | Crew role table already carries `tools` arrays (`algorithms.ts:487`); formalize per-domain "recipe packs" = role/tool/budget presets keyed by `inferDomain` result (`engine.ts:92`), so logistics vs. health domains get different reviewer/tester tooling | P2 |
| 16 | Onlook / Bolt | **Design tokens as first-class input to generation** (https://www.onlook.com/features/ai) | P8 UI templates currently generate React+Tailwind; extract tokens from the brief's constraint lexicon (`algorithms.ts` LEX tables) and emit a `theme` artifact before P8 codegen — cheap, deterministic, and gives the UI phase a contract like every other phase | P2 |

---

## 7. Loss register — where RapidTool genuinely loses (no spin)

1. **Code capability at repo scale.** Claude Code, Cursor, Copilot, Devin, and Cline edit large existing codebases with frontier models; RapidTool has no git integration and its deterministic P6 module generator is template-grade. Its productized peers (Lovable/Bolt/Replit) produce broader, deployable apps.
2. **Frontier model quality and breadth.** RapidTool's only wired LLM is DeepSeek (narrative/crew/oracle), optional and key-gated. It cannot match the coding models those tools route. LiteLLM/MCP/A2A exist as *phase content* (P1/P3 spec text, tool-name strings in `algorithms.ts` crew seats) — not as shipped client code (verified: no MCP module in `src/lib/`).
3. **Deployment.** P9 is a gate and an artifact narrative; Bolt/Replit/v0/Copilot actually ship. RapidTool emits docs and YAML-shaped content, not a running service.
4. **Parallelism.** Devin fleets, Cursor cloud agents, Replit Agent 4, and Tempo worktrees run independent agents concurrently; RapidTool's crew is serial, single-model, advisory, and never advances state.
5. **Verification breadth.** Replit Agent 3 drives a real browser against the whole app; Copilot runs tests in CI-grade ephemeral environments; RapidTool's machine-run loop covers the generated module only, needs the DeepSeek key for oracle authorship, and its sandbox (`runSandboxed`, `sandbox.ts:242–324`) still has no product call sites ([02 §B1]).
6. **Human knowledge tooling.** Obsidian's human-curated vaults and Notion's org-wide Q&A are far richer as *knowledge* products; RapidTool's vault is auto-generated, per-project, and its memory rows are engine-written only — no cross-project memory, no model-written learnings ([02 §B6], verified in `report-intake.ts`).
7. **Ecosystem & distribution.** Claude Code's hooks/subagents/SDK, Cline's BYO-model ubiquity, Cursor's IDE lock-in, and Obsidian's plugin market are all network effects RapidTool does not have. It is a single-repo harness with one UI + one CLI.

**Bottom line for the thread:** RapidTool's defensible position is not "builds apps like Bolt" or "codes like Claude Code" — it is the only tool in this survey that couples (a) a *deterministic, offline, replayable process machine* with (b) *machine-minted verification verdicts* and (c) an *agent-readable handoff packet*, and then deliberately makes the human a structured gate, not a permission prompt. The steals in §6 are chosen to close the three biggest competitive gaps cheaply: enforcement of gates on the autopilot path (#1), memory write-back (#2), and CI-checkable gate verdicts (#4).

---

## Sources

Fetched pages (all URLs retrieved 2026-09-05):

**Family A — app builders:** https://bolt.new/ · https://github.com/stackblitz/bolt.new · https://www.taskade.com/blog/bolt-review · https://docs.lovable.dev/introduction/welcome · https://lovable.dev/ · https://vercel.com/blog/v0-app · https://v0.app/ · https://replit.com/blog/introducing-agent-3-our-most-autonomous-agent-yet · https://replit.com/agent4 · https://www.tempo.new/ · https://www.ycombinator.com/companies/tempo-2 · https://www.onlook.com/features/ai · https://www.onlook.com/ · https://github.com/onlook-dev/onlook

**Family B — coding agents:** https://code.claude.com/docs/en/overview · https://code.claude.com/docs/en/memory · https://code.claude.com/docs/en/security · https://code.claude.com/docs/en/agent-sdk/overview · https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code · https://cursor.com/docs/cloud-agent · https://cursor.com/ · https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent · https://devin.ai/ · https://cognition.com/ · https://trickle.so/blog/devin-ai-review · https://cline.bot/ · https://github.com/cline/cline · https://github.com/aaif-goose/goose (the `block/goose` repo redirects here) · https://goose-docs.ai/ · https://agpt.co/ · https://github.com/significant-gravitas/autogpt

**Family C — adjacent:** https://www.warp.dev/ai · https://www.warp.dev/ · https://obsidian.md/ · https://community.obsidian.md/plugins · https://www.notion.com/product/ai · https://www.notion.com/help/guides/everything-you-can-do-with-notion-ai

**In-repo cross-references (read, not modified):** `research/multiagent/01_open_source_harnesses.md` (OSS harness digests + steal-mapping) · `02_capability_audit.md` (A1–A9 / B1–B7 / E1–E4, file:line-verified) · `03_crew_design.md` · `04_verification_design.md` · `05_guide_research.md` (Obsidian/vault survey S1–S8) · `src/lib/` engine.ts, algorithms.ts, phases.ts, dod.ts, packet.ts, handoff.ts, headless.ts, vault.ts, crew.server.ts, verify.server.ts, report-intake.ts, sandbox.ts, io.ts, store.ts, node-runner.server.ts, types.ts · `scripts/rapidtool-cli.mjs`
