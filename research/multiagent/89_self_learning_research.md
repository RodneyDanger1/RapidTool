# 89 — Self-Learning Loops + Persistent Memory / Skills Fact Base (R6)

**Scope:** cited evidence base for designing RapidTool's self-learning loop. Covers (1) how shipped AI coding agents (Devin, Claude Code, Cursor, Windsurf/Cascade, Aider, OpenAI Codex) persist and reuse experience; (2) research systems (Voyager, Reflexion, ExpeL, SWE-agent/SWE-Replay, MemGPT/Letta, Mem0, Zep/Graphiti, LangMem) and their memory mechanisms; (3) persistent-memory design patterns (tiers, retrieval, scoring, eviction, compression); (4) skills/playbooks systems and when tools load them; (5) lesson-learning / regression-to-guardrail pipelines; (6) a design menu for RapidTool with evidence anchors.
**Method:** every mechanism claim below traces to a page fetched this pass (2026-09-06) — primary docs/READMEs/arXiv abstracts + full-text HTML greps (Voyager/MemGPT/ExpeL). Repo facts were verified by read-only greps of the current tree (file:line cited). No RapidTool source was modified.
**Citation convention:** [S#] = source list at the end. [RT-note] = RapidTool mapping note (advisory only).

---

## 0. RapidTool anchor map (read-only, verified this pass)

| Anchor | Where | What it is today |
|---|---|---|
| KnowledgeStore | `src/lib/knowledge.ts:1-70` | Append-only JSON pattern store, kinds `brief\|pattern\|fix\|note`, fields id/project/kind/title/tags/body/sourcePath/savedAt; idempotent dedupe via FNV fingerprint; atomic tmp+rename writes; deterministic **idf-weighted lexical token-overlap** ranking (title×2, tag×1.5, body×1 → [0,1]); **advisory only** — `injectProven()` returns research rows, nothing auto-applies; consumer: `headless.ts` |
| Vault | `src/lib/vault.ts:1-95` | Obsidian-style per-project markdown export: hub + phase spine + **memory rows** + decisions + research-corpus + top-10 artifacts + `dailyNote` + `traceNote`; `searchVaultScored` = token-overlap + shared stemmer (title 4 > tag 2 > body 1, ≥3-char prefix match); backlinks; pure/deterministic; consumers `packet.ts`, `tracing.ts` |
| Memory rows | `src/lib/engine.ts:48`, `src/lib/report-intake.ts:325-355` | Per-project `MemoryEntry` rows, `MEMORY_KINDS = episodic\|semantic\|procedural` (engine.ts:48); ranked into packets (engine.ts:775 "ranked N memory rows for the packet"); **80-row FIFO cap** via `dedupeMemoryIds(...).slice(-80)` (report-intake M-08); store-level FIFO eviction documented in dossier 43 (H43-P2-1) |
| Report lesson ingest | `src/lib/report-intake.ts` (M-08) | "a **complete** report writes agent lessons back to memory — the first real cross-run learning loop": 1 semantic row (summary) + 1 episodic row/artifact, score 0.7/0.6, deduped+capped "exactly like engine rows" |
| Verify-fix loop | `src/lib/verify.server.ts:487-520` | Bounded loop: fail → DeepSeek patch → re-run up to `maxIterations` (clamped 1..5); line 254 comment: "ADVISORY ONLY. Findings NEVER gate a machine pass" |
| Regression guard | `src/lib/engine.ts:1893` `verifyPriorPhases` | E-19: later phase touching same files re-runs earlier phases' DoD gate and compares evidence hash → `regression.drift` warn log; **advisory, mutates nothing** |
| Hyper-prompt | `src/lib/prompt-engine.ts:1-30` | `expandBrief` (DeepSeek, keyed) + pure `applyPolicies(spec, policies)` deterministic negative-constraint injection |
| Phase machine | `src/lib/phases.ts`, `src/lib/engine.ts` | PHASES spine; HITL decisions; gates/DoD per phase |

Design implication for the notes below: RapidTool is **already a Reflexion-class system** (verify-fix loop + report lessons → memory rows) and has the **storage layer for a Devin-style knowledge store + Agent-Skills-style procedural library**; the missing pieces are mostly retrieval quality, trigger-based recall into prompts, promotion/curation, and skills-as-procedures. Every mapping note targets these seams only.

---

## 1. Fact cards — shipped coding agents

### 1.1 Claude Code (Anthropic) — CLAUDE.md + Auto memory + Skills + rules
Sources: [S5] memory doc, [S6] skills doc.

**Mechanism.** Two cross-session carriers, both "loaded at the start of every conversation... Claude treats them as context, not enforced configuration" [S5]:
- **CLAUDE.md (human-written instructions)** — scopes in load order, broadest→most specific: managed policy (`/Library/Application Support/ClaudeCode/CLAUDE.md` etc.), user (`~/.claude/CLAUDE.md`), project (`./CLAUDE.md` or `./.claude/CLAUDE.md`, team-shared via source control), local (`./CLAUDE.local.md`, gitignored) [S5]. Subdirectory CLAUDE.md files "load on demand when Claude reads files in those directories"; path/file-type scoping via `.claude/rules/` with `paths:` frontmatter. Project-root CLAUDE.md **survives `/compact`** (re-read from disk and re-injected); nested files reload lazily [S5].
- **Auto memory (Claude-written)** — "notes Claude writes itself based on your corrections and preferences"; content = "learnings and patterns"; scope = per repository, **shared across worktrees**; loaded every session "first 200 lines or 25KB" [S5]. Subagents can maintain their own auto memory ([S5] → sub-agents doc).
- **Skills (procedures)** — `SKILL.md` + supporting files; **"a skill's body loads only when it's used, so long reference material costs almost nothing until you need it"** [S6]. Trigger to create: "you keep pasting the same instructions... or when a section of CLAUDE.md has grown into a procedure rather than a fact" [S6]. Custom commands merged into skills (`.claude/commands/deploy.md` ≡ `.claude/skills/deploy/SKILL.md`) [S6]. Follows the Agent Skills open standard [S6, S26].
- **Recorded recipes (experience→skill, automated)** — `/run-skill-generator` "gets your app running from a clean environment, captures what worked (the install commands, the env vars, the launch script), and commits it as a per-project skill at `.claude/skills/run-<name>/`" [S6]. `/verify` records its own recipe to `.claude/skills/verify/SKILL.md` after a successful build-and-drive; **"Claude edits the recorded file only when it steered a run wrong, such as a command that failed or a missing step"** — a deliberate anti-churn rule after v2.1.205 (earlier behavior "fold in anything a run learned... caused frequent merge conflicts") [S6].

**Eviction/caps.** Auto memory capped at first 200 lines/25KB [S5]; hard behavioral blocking is not memory's job — "use a PreToolUse hook" [S5].
**Lesson trigger (vendor guidance).** "Add to CLAUDE.md when: Claude makes the same mistake a second time; a code review catches something Claude should have known; you type the same correction you typed last session; a new teammate would need the same context" [S5].
**[RT-note]** Mapping: CLAUDE.md ≈ RapidTool project instructions; auto memory ≈ RapidTool memory rows + report-intake M-08 (semantic/episodic), but RapidTool has **no "correcting the model mid-session ⇒ auto-persist a learning row" hook** — Claude's trigger list is directly reusable as the auto-memory prompt spec. Recorded recipes ≈ the exact shape of a "skills" pillar for RapidTool (see §4); the "edit the recorded file only when steered wrong" rule is a ready-made anti-conflict policy for any engine-written prompt artifacts. Load-on-demand subdirectory memory ≈ existing `vault.ts` per-directory phase notes, but read-time, not write-time.

### 1.2 Cursor — Rules (.mdc) + AGENTS.md + Skills
Sources: [S7] rules doc, [S8] skills doc.

**Mechanism.** Rules are "system-level instructions to Agent... persistent, reusable context at the prompt level. When applied, rule contents are **included at the start of the model context**" [S7].
- Four rule types: **Project rules** (`.cursor/rules/*.mdc`, version-controlled; frontmatter `description`, `globs`, `alwaysApply`), **User rules** (global prefs, Agent Chat only), **Team rules** (dashboard, Team/Enterprise), **AGENTS.md** (plain markdown; nested AGENTS.md in subdirectories auto-apply to that subtree, "more specific instructions taking precedence" over parents) [S7].
- Application modes: Always Apply / "Apply Intelligently" (model decides via `description`) / "Apply to Specific Files" (`globs`) / Manual (`@my-rule`). Rules may `@filename.ts`-include other files. **A plain `.md` in `.cursor/rules` is ignored** (no frontmatter) [S7].
- **Agent-authored rules:** "Can I create a rule from chat? Yes, you can ask the agent to create a new rule for you" [S7].
- **Skills:** Agent Skills open standard; auto-discovered at startup, agent "decides when they are relevant based on context"; manual `/skill`; **progressive resource loading** ("keeping context usage efficient"); installable from GitHub; built-ins include `/create-rule`, `/create-skill`, `/migrate-to-skills` (converts "Apply Intelligently" rules and slash commands into skills; explicit commands get `disable-model-invocation: true`) [S8]. Skill dir `.cursor/skills/` [S8].

**Eviction/caps.** Not published for rules (context budget governed by the "include at start" model). Cursor guidance distinguishes: procedures → skills (load-on-demand), standing constraints → rules (always-on context) [S7, S8].
**[RT-note]** Mapping: `.mdc` frontmatter (description/globs/alwaysApply) is a clean spec for upgrading `KnowledgeEntry` (knowledge.ts) with a `triggers`/`globs`/`alwaysApply` triple. The Cursor/Cascade/Claude Code **convergence** — "Always-on rules vs model-decided procedures (skills)" — is the industry-standard split RapidTool should mirror: `fix`/`note` knowledge → rules-like always/glob injection into engine prompts; `pattern`/`brief` → skill-like load-on-demand. `/migrate-to-skills` shows the migration path from always-on bloat to on-demand skills (matches Claude Code's "CLAUDE.md section grew into a procedure" trigger [S6]).

### 1.3 Windsurf / Cascade → Devin Desktop (Codeium→Cognition)
Sources: [S3] memories & rules doc (canonical location is now docs.devin.ai), [S25] skills doc, [S24] playbooks.

**Mechanism.** Devin Desktop (formerly Windsurf) documents **four** customization layers with an explicit selection table [S3, S25]:
- **Memories** — "context Cascade auto-generates during conversations"; Cascade "can automatically generate and store memories if it encounters context that it believes is useful to remember", plus explicit "create a memory of …" prompts; stored **locally** in `~/.codeium/windsurf/memories/`, **workspace-scoped** ("Memories generated in one workspace are not available in another"), **not committed to the repository**; auto-retrieved "when it believes they're relevant"; free (no credits) [S3].
- **Rules** — manually defined, version-controllable: global `~/.codeium/windsurf/memories/global_rules.md` (**always on, 6,000-char limit**); workspace `.devin/rules/*.md` (or legacy `.windsurf/rules/*.md`), **one file per rule, 12,000-char cap per file**, each with its own activation mode (`always_on`, `glob`, `model_decision`, `manual`); legacy `.windsurfrules` still read; **AGENTS.md anywhere in the workspace is processed by the same rules engine** (root = always-on; subdirectory = auto-glob) [S3].
- **Workflows** — prompt templates for repeatable multi-step tasks, manual `/workflow-name` invocation only [S3].
- **Skills** — folders with `SKILL.md` + supporting files (scripts/templates/references), model-invoked or `@mention`; **progressive disclosure: only `name`+`description` in context until invoked** [S25]. Locations: workspace `.windsurf/skills/` (committed), global `~/.codeium/windsurf/skills/` (not), system/enterprise dirs (read-only). Cross-compat: also scans `.agents/skills/`, `~/.agents/skills/`, and (optionally) `.claude/skills/` [S25].
- **Vendor's own guidance:** "For knowledge you want Cascade to reliably reuse, write it as a Rule or add it to AGENTS.md... rather than relying on auto-generated Memories. Rules are version-controlled, shareable, and give you explicit control over activation." And: **"Memories apply to the legacy Cascade agent only. The Devin Local agent — the default agent for new tabs — does not persist memories. Migrate the ones you rely on to skills"** (Cascade Migration Wizard) [S3]. This is the industry's clearest documented retreat from auto-memories toward checked-in rules/skills.

**System-level enterprise rules/skills** exist at OS dirs (e.g. Windows `C:\ProgramData\Devin\rules\*.md`) and are merged under user rules, never overriding them [S3, S25].
**[RT-note]** Mapping: the Memories lifecycle (auto-capture → retrieve-when-relevant → local-only) is exactly what report-intake M-08 rows do today, but RapidTool rows already have the virtues Cascade lacks: per-project, deterministic dedupe, 80-row FIFO cap, and vault export. Cascade's documented failure mode (auto-memories not durable, migrating to rules/skills) argues for RapidTool's future loop to **promote** (not just accumulate): verified patterns should graduate from memory rows → knowledge.ts entries with explicit triggers (see §4 design menu). The 6k/12k hard caps and per-file activation modes are usable precedents for prompt-budget limits.

### 1.4 Devin (Cognition) — Knowledge + Playbooks
Sources: [S1] Knowledge doc, [S2] instructing doc, [S24] creating playbooks.

**Mechanism.** Two complementary artifacts [S2]:
- **Knowledge** = "a collection of tips, advice, and instructions that Devin can reference in **all sessions**. You can continually add to Devin's bank... Devin will **automatically recall relevant Knowledge** as necessary" [S1]. Each item: **Trigger Description** (required; "Devin will retrieve a Knowledge item when its current work is related to the specified triggers") + short **Content** ("handful of sentences"). Optional **macro** `!deploy-checklist` to force-reference in a prompt. Per-item/per-folder **enable-disable**; **pinning**: no repo (recall when relevant) / a specific repo (**always used** when working there) / all repos [S1].
- **Self-learning loop — Knowledge Suggestions:** "Devin will automatically suggest Knowledge to remember based on your feedback in chat. Edit the suggested Knowledge before saving, or dismiss... Devin can also suggest updates to existing knowledge items" [S1]. Human-in-the-loop promotion from conversation → durable org knowledge; auto-organization into folders; org→enterprise "Promote to Enterprise" [S1].
- **Playbooks** = "easily shareable, reusable prompts for repeated tasks... like a custom system prompt for a repeated task". Recommended structure: Outcome, Procedure (one imperative step per line, setup/task/delivery, "mutually exclusive & collectively exhaustive"), Specifications (postconditions), Advice ("tips to correct Devin's priors... advice can function like comments on pseudocode"), **Forbidden Actions**, Required from User. File ext `.devin.md`; iteration tactic: "Run 2+ Devins in parallel with the same playbook to quickly identify possible errors" [S24].
- **Division of labor (vendor):** "Playbooks for step-by-step procedures tied to specific tasks. Knowledge for general tips, conventions, and context that apply broadly across sessions" [S2]; knowledge tips: keep items small and targeted ("Devin will read the entire Knowledge contents"), split items, make triggers highly relevant, "retrieves Knowledge when relevant, not all at once or all at the beginning" [S1].
- Example knowledge content per docs: "common bugs and their associated solutions, code conformance practices, deployment workflows... how to interact with proprietary tools" [S1] — i.e., exactly the `fix`/`pattern` kinds RapidTool's knowledge.ts already models.

**Honest limits:** Devin's internal recall backend (embeddings? keyword? model-decided?) is **not documented** in the fetched pages — only the trigger-description contract and "automatically recall when relevant" [S1]. Playbook effectiveness data is anecdotal in [S24].
**[RT-note]** Mapping: Knowledge item ≈ knowledge.ts `KnowledgeEntry` (title/tags/body already ≈ trigger description/content). RapidTool additions implied: (a) **always/pinned scope** (per-repo vs global) — knowledge.ts already has `project` field, but no "always-on" flag; (b) **macros** — prompt-invocable `!name` references would need a prompt-engine seam; (c) **suggestion pipeline** — report-intake already writes lessons; a Devin-style suggestion (LLM-draft → operator approve → knowledge.ts save) is the missing human gate between the 80-row FIFO and the durable knowledge store; (d) **forbidden actions** in playbooks ≈ prompt-engine.ts `applyPolicies` negative constraints — the playbook "Forbidden Actions" section maps 1:1 onto `applyPolicies` `negativeConstraints`.

### 1.5 OpenAI Codex / ChatGPT agent — AGENTS.md chain + local Memories + exec Rules
Sources: [S4] AGENTS.md doc, [S10] memories doc, [S11] rules doc.

**Mechanism.**
- **AGENTS.md instruction chain:** Codex "reads AGENTS.md files before doing any work", building the chain **once per run**. Precedence: (1) global `~/.codex/AGENTS.override.md` else `~/.codex/AGENTS.md` (first non-empty only); (2) project scope: walk from project root **down** to cwd, at most one file per directory (`AGENTS.override.md` → `AGENTS.md` → fallback names); (3) merge: concatenate root-down with blank lines — "files closer to your current directory override earlier guidance because they appear later". **Size cap `project_doc_max_bytes` = 32 KiB default**; empty files skipped [S4].
- **Local Memories (auto, LLM-written):** enabled via `[features] memories = true` (**off by default** in Codex CLI; separate from ChatGPT web memory). After enabling, Codex "can turn useful context from eligible prior chats into local memory files" under `~/.codex/memories/` containing "summaries, **durable entries**, **recent inputs**, and **supporting evidence** from prior chats" [S10]. Key behaviors: skips active/short-lived sessions; **redacts secrets** from generated memory fields; updates **in the background after the chat is idle** ("waits until a chat has been idle long enough to avoid summarizing work that's still in progress"); skips generation when rate-limit remaining < `memories.min_rate_limit_remaining_percent`; per-chat `/memories` opt-in/out; **separate `memories.extract_model` (per-chat extraction) and `memories.consolidation_model` (global consolidation)** knobs [S10]. Vendor caution: "Keep required team guidance in AGENTS.md... Treat memories as a helpful recall layer, not as the only source for rules that must always apply" [S10].
- **Exec Rules (guardrail-ification of approvals):** Starlark `.rules` files (`~/.codex/rules/default.rules`), prefix-matched against argv (`prefix_rule(pattern=[...], decision="allow"|"prompt"|"forbidden", justification, match/not_match inline unit tests)`); most-restrictive wins across rules and across compound commands; **when you add a command to the allow list in the TUI, "Codex writes to the user layer at `~/.codex/rules/default.rules` so future runs can skip the prompt"**; with Smart approvals "Codex may **propose** a `prefix_rule` for you during escalation requests" — approve once ⇒ permanent guardrail [S11].

**Eviction/caps.** AGENTS.md chain hard-capped at 32 KiB [S4]; memories files are generated state (not hand-edited); consolidation model implies periodic global rewrite/compression pass [S10].
**[RT-note]** Mapping: (a) the **root-down merge with nearer-overrides-later** rule is a precise spec for a future "instruction chain" in prompt-engine.ts (RapidTool's per-project phases already imply root-level rules; file-scoped memory in vault subdirs could follow the same law); (b) Codex's **two-stage extract-then-consolidate** memory pipeline (idle-time extraction, separate consolidation model) is the best-published template for a RapidTool "memory compaction" pass that fights the 80-row FIFO churn found in dossier 43; (c) **redaction of secrets at memory-write time** is a directly portable requirement for report-intake M-08 text slices (currently raw summaries/artifact bodies up to 240 chars); (d) the approve→allowlist-rule loop is the model for turning verify-gate approvals into permanent checks (§5).

### 1.6 Aider — conventions (minimalist)
Source: [S9].

**Mechanism.** No auto-learned memory. Conventions = "a small markdown file... included in the chat" read-only: `aider --read CONVENTIONS.md` or `/read`; auto-load via `.aider.conf.yml` `read: [CONVENTIONS.md, ...]`; read-only files are prompt-cache friendly. Community conventions repo exists (Aider-AI/conventions) [S9]. Example shows same task obeying (httpx + type hints) vs ignoring (requests, no types) the conventions file [S9].
**[RT-note]** Mapping: the "read-only, always-in-context conventions file" is the cheapest tier of the design menu — RapidTool equivalents: a per-project `briefs`/`policies` seam already exists in prompt-engine.ts `applyPolicies`; a static conventions block could ride the same path with zero new machinery.

---

## 2. Fact cards — research systems (mechanisms as published)

### 2.1 Voyager (Minecraft, GPT-4, no fine-tuning) — skill library = executable programs
Sources: [S12] abstract + full-text HTML (v2) greps.

**Mechanism.** Three components: automatic curriculum (maximizes exploration), **ever-growing skill library of executable code** ("storing and retrieving complex behaviors"), and iterative prompting with environment feedback + execution errors + self-verification [S12]. Full-text details: Voyager "incrementally builds a skill library by storing the action programs that help solve a task successfully. **Each program is indexed by the embedding of its description**, which can be retrieved..." (B.4.4 "Accurate Skill Retrieval"); the refinement loop repeats "until a **self-verification module confirms the task completion, at which point we commit the program to the skill library**" (e.g., `craftStoneShovel()`, `combatZombieWithSword()`); skills are "temporally extended, interpretable, and compositional", compound ability and "alleviate catastrophic forgetting"; the library transfers to a **new Minecraft world** to solve novel tasks from scratch [S12].
**Costs/limits:** black-box GPT-4 calls only; no parametric learning [S12 abstract]. Skill-retrieval quality is embedding-similarity bound (B.4.4 exists because retrieval accuracy mattered).
**[RT-note]** Mapping: skill library ≈ knowledge.ts but with **code/procedure as the stored unit and an executable "commit gate"** (task solved & self-verified ⇒ store). RapidTool has the gate half already (verify-fix loop, `verifyAndFixServer` bounded retries; E-19 drift guard) — the missing half is: after a phase's DoD passes, **distill the procedure that passed into a reusable entry** (a `pattern` with the phase's steps), not just a summary row. Voyager's "index by embedding of description" is the strongest published evidence that keyword-only retrieval (RapidTool's current token-overlap) is the accuracy bottleneck worth removing first (§6).

### 2.2 Reflexion — verbal reinforcement in an episodic buffer
Source: [S13] abstract (+ ExpeL's description of Reflexion usage [S14]).

**Mechanism.** "Reflexion agents **verbally reflect on task feedback signals, then maintain their own reflective text in an episodic memory buffer** to induce better decision-making in subsequent trials." Reinforcement happens "not by updating weights, but instead through linguistic feedback"; accepts scalar or free-form, external or internally simulated feedback [S13]. HumanEval pass@1 91% vs GPT-4 80% at the time [S13]. ExpeL uses Reflexion as its experience-gathering loop ("enabling task reattempt after self-reflection on failures") [S14].
**Costs/limits:** reflection is per-episode and buffer-scoped — no cross-task abstraction (that gap is what ExpeL targets [S14]).
**[RT-note]** Mapping: RapidTool's verify-fix loop is already Reflexion-shaped **but does not persist the reflection**; M-08 stores the *summary*, not the *failure analysis*. A Reflexion layer = when iteration i fails and i+1 succeeds, ask the model "why did the first attempt fail?" and store that text as a `fix`/`lesson` row with the failing pattern — the cheapest self-learning upgrade available on the existing 80-row memory.

### 2.3 ExpeL — experiential learning: experience pool + insight extraction + retrieval at inference
Source: [S14] abstract + full-text HTML (v3) greps.

**Mechanism.** "Autonomously gathers experiences and extracts knowledge using natural language from a collection of training tasks. At inference, the agent **recalls its extracted insights and past experiences**" [S14 abstract]. Full text: (A) experience gathering via Reflexion-style trial-and-error; (B) **insight extraction** — "when presented with success/failure pairs or a list of successes, the agent **dynamically modifies an existing list of insights**" (extraction/abstraction of cross-task knowledge); (C) at test time it "employs its own **successful experiences as in-context examples**" and alters the execution prompt; learning is analogous to a student deriving insights from practice problems [S14]. Robust gains as experience accumulates; AAAI-24 [S14].
**Costs/limits:** no parametric update (API-accessible models only); insight list must be curated/edited by the LLM itself, so insight quality depends on the extraction step [S14].
**[RT-note]** Mapping: ExpeL is the academic blueprint for **Knowledge Suggestions + report-intake M-08**: (1) batch of completed runs (success/failure pairs) → LLM extracts/updates insight list → knowledge.ts; (2) at packet-build time, inject top-k *successful* prior episodes (memory rows of kind episodic with high score) as in-context exemplars — engine.ts already ranks memory rows into the packet (engine.ts:775), so exemplar injection needs only a ranking tweak + prompt slot.

### 2.4 SWE-agent + SWE-Replay — ACI design; trajectory reuse at test time
Sources: [S16] SWE-agent abstract, [S17] SWE-Replay abstract.

**Mechanism.** SWE-agent: custom **agent-computer interface (ACI)** — file editing, repo navigation, test execution commands designed for LMs — lifts SWE-bench pass@1 to 12.5% and HumanEvalFix 87.7% at release; interface design, not just model, drives agent performance [S16]. SWE-Replay (Ding & Zhang, 2026, evaluated on SWE-Bench Verified/Pro/Multilingual): standard test-time scaling re-samples trajectories from scratch, which is expensive; **SWE-Replay "recycles trajectories from prior trials, dynamically choosing to either explore from scratch or exploit archived experience by branching at critical intermediate steps"**; step selection uses "the potential and reasoning significance of repository exploration, rather than external LLM-based quality estimates" (no value model); results: up to 17.4% cost reduction, performance maintained or +3.8% [S17].
**Costs/limits:** SWE-Replay archives *within a task* across trials (retry reuse), not a cross-task library; it does not claim cross-repo learning [S17].
**[RT-note]** Mapping: (a) ACI lesson — RapidTool's exec/sandbox + verify surface *is* its ACI; design iterations on that interface matter as much as model choice; (b) SWE-Replay's "branch from archived mid-run state instead of restarting" is a direct template for verify-fix loop improvement: RapidTool re-runs patched source from scratch each iteration (verify.server.ts loop); archiving the last good checkpoint/exploration state per attempt could cut iteration cost — evidence-based, but note it is test-time scaling for a single task, not cross-project learning.

### 2.5 MemGPT / Letta — OS-style tiered memory (in-context blocks vs archival vs recall)
Sources: [S15] abstract + full-text HTML greps; [S19] Letta archival-memory doc.

**Mechanism.** MemGPT = **virtual context management**: data movement between fast (in-context) and slow (external) memory "inspired by hierarchical memory systems in traditional operating systems"; uses **interrupts** to manage control flow; enables document analysis far beyond context and multi-session agents that "remember, reflect, and evolve dynamically" [S15 abstract]. Full-text mechanics: a memory-pressure warning — when the message FIFO nears eviction "the manager inserts a system message into the queue warning the LLM of an impending queue eviction... to allow the LLM to use MemGPT functions to store important information contained in the FIFO queue to **working context or archival storage**"; retrieval over archival storage uses cosine-similarity vector search (pgvector/HNSW, ada-002 embeddings in eval); **recall memory** = full conversation history accessed "via paginated search queries... to bring them into main context" [S15 html]. Letta (productized MemGPT): agents have **memory blocks in core memory** (in-context, e.g. persona/human/custom — "information that should always be visible") + **archival memory** ("semantically searchable database... for long-term retrieval"; fragments **cannot be pinned to context**, must be queried via `archival_memory_insert`/`archival_memory_search` tools; agent-immutable — "agents cannot easily modify or delete"; tags supported; "unlimited storage") + conversation search for history [S19]. "Don't use archival for: information that should always be visible → memory blocks; frequently changing state → memory blocks; current working memory → scratchpad blocks" [S19].
**Costs/limits:** MemGPT baselines and the system itself rely on embedding retrieval quality ("even if the embedding-based ranking is noisy... can still be found with enough retriever calls via pagination" — a robustness argument for tool-ized search) [S15 html]. Zep paper reports beating MemGPT on DMR 94.8 vs 93.4 [S22].
**[RT-note]** Mapping: RapidTool's tiers today: in-context = packet memory ranking (engine.ts:775) + prompt-engine; external = memory rows (80-row FIFO) + knowledge.ts + vault. MemGPT contributes two concrete upgrade specs: (a) **memory-pressure prompt**: before the 80-row FIFO evicts rows, ask the model to consolidate important rows into knowledge.ts (a deterministic "pressure" event at row 60/80 — exact trigger tunable); (b) **explicit search tools**: packet engine currently *pushes* ranked rows; MemGPT/Letta argue for also letting the engine *pull* on demand (archival-style tool call), which suits long vault exports. Letta's "agent-immutable archival + developer-only delete" is a good governance stance for knowledge.ts (append-only today — already aligned).

### 2.6 Mem0 — managed memory layer; new 2026 ADD-only algorithm
Source: [S18] README (April-2026 algorithm note).

**Mechanism.** Mem0 = memory layer for assistants/agents: `add` (from conversation/messages), `search`, plus per-user/user_id scoping; "Multi-Level Memory: User, Session, Agent state" [S18]. **April 2026 algorithm rewrite** (managed platform): **"Single-pass ADD-only extraction — one LLM call, no UPDATE/DELETE. Memories accumulate; nothing is overwritten"**; "**agent-generated facts are first-class** — when an agent confirms an action, that information is now stored with equal weight"; **entity linking** ("entities are extracted, embedded, and linked across memories for retrieval boosting"); **multi-signal retrieval** — "semantic, BM25 keyword, and entity matching scored in parallel and fused"; **temporal reasoning** — "time-aware retrieval that ranks the right dated instance" for current-state vs past vs upcoming queries [S18]. Benchmarks (platform): LoCoMo 92.5, LongMemEval 94.4, BEAM 1M 64.1, p50 latency ~1s, ~7K tokens — "single-pass retrieval (one call, no agentic loops) at a top_200 retrieval budget" [S18]. OSS SDK gains are "directionally similar but not identical" [S18]. Paper: arXiv:2504.19413 [S18]. CLI even supports agents minting API keys and human claim-later ("Sign up as an agent... human owner can claim the account later — same key, memories preserved") [S18].
**Honest limits:** eviction/update scoring internals of the old ADD/UPDATE/DELETE algorithm are not described in the README (superseded by ADD-only); the specific scoring functions are not public; benchmarks are vendor-run [S18].
**[RT-note]** Mapping: Mem0's ADD-only 2026 direction **validates RapidTool's existing append-only stance** in knowledge.ts ("Append-only — savePattern() never mutates or deletes") and report-intake dedupe; the three upgrades to steal: (a) multi-signal retrieval (semantic + BM25 + entity) vs today's pure lexical — knowledge.ts header already concedes "NOT a vector database... synonyms and paraphrases do not match"; (b) storing **agent-confirmed facts** (verify-gate passes = confirmation events ⇒ knowledge candidates); (c) dated/temporal ranking of rows so "latest known state" wins over stale fixes.

### 2.7 Zep + Graphiti — temporal knowledge graphs (episodic/semantic tiers, validity windows)
Sources: [S20] Zep graph overview, [S21] Graphiti README, [S22] Zep paper abstract.

**Mechanism.** Zep auto-constructs a **temporal knowledge graph per user**: "entities, relationships, and facts... automatically handling changing relationships and facts over time"; graph stores three node/edge types — entity edges (relationships incl. semantic facts), entity nodes (extracted entities w/ summaries), **episodic nodes = raw data** (chat history or `graph.add`); "each node and edge contains attributes... **edge timestamps record when a fact becomes valid or invalid**" [S20]. Paper: graph = episode subgraph + semantic entity subgraph + community subgraph; **beats MemGPT on DMR (94.8 vs 93.4)** and LongMemEval by up to 18.5% accuracy with 90% lower latency vs baselines, strongest on cross-session synthesis and long-term context [S22]. Graphiti (OSS engine under Zep): context graph with **validity windows** ("when it became true, and when (if ever) it was superseded"), entities with evolving summaries, everything traced to **episodes** (provenance), custom ontology via Pydantic; **incremental updates "without requiring complete graph recomputation"**; retrieval = **hybrid: semantic + keyword + graph traversal**; queryable "across time, meaning, and relationships" [S21].
**Costs/limits:** graph construction is LLM-extraction heavy per episode (cost/ops burden not quantified in fetched pages); complexity is far above a row store; Zep's production graph DB is proprietary (Graphiti needs a graph/vector backend) [S20, S21].
**[RT-note]** Mapping: heavyweight option — full temporal KG is likely overkill for RapidTool's per-project row store today, but two Graphiti ideas are cheap and high-value: (a) **validity/supersede markers on knowledge entries** (a `fix` entry that says "as of run X, this pattern is obsolete") ≈ `sourcePath`-style provenance already present, needs an explicit supersede field; (b) **provenance spine**: Graphiti's episode-traceability ≈ vault.ts's memory↔phase wikilinks + `traceNote` — RapidTool already links rows to phases; linking each knowledge.ts entry to its *originating phase + verify evidence hash* (E-19 style) would give the same auditability without a graph DB.

### 2.8 LangMem — tools-in-hot-path + background memory manager + prompt refinement
Source: [S23] docs landing.

**Mechanism.** LangMem = "tooling to extract important information from conversations, **optimize agent behavior through prompt refinement**, and maintain long-term memory" [S23]. Four features: (1) core memory API storage-agnostic; (2) **memory-management tools agents use "in the hot path"** — `create_manage_memory_tool` + `create_search_memory_tool` (record & search during a conversation); (3) **background memory manager** that "automatically extracts, consolidates, and updates agent knowledge"; (4) native LangGraph Store integration (namespace-indexed items with embeddings) [S23]. Two documented operating modes ("hot path" quickstart vs "background" quickstart) imply agents either self-curate via tools or a manager process curates offline [S23].
**Honest limits:** policies/profile-extraction details live beyond the fetched landing page (not claimed here).
**[RT-note]** Mapping: hot-path tools = engine already has tool-like seams (packet/engine functions); giving the DeepSeek engine an explicit `remember`/`recall` tool pair would make memory writes *intentional* (Letta/Mem0/LangMem all converge on intentional agent-driven writes + separate consolidation) rather than only post-hoc report intake. Background manager = Codex-style idle consolidation (§1.5).

---

## 3. Persistent-memory design patterns — cross-system synthesis

**Tiering (convergent across MemGPT/Letta, Mem0, Claude Code, Codex).** Every serious system splits: (a) **always-in-context core** (CLAUDE.md/auto memory 25KB cap [S5]; Letta memory blocks [S19]; AGENTS.md chain 32KiB cap [S4]; Cascade global_rules 6k + workspace rule 12k caps [S3]); (b) **searchable long-term store** (Letta archival [S19]; Mem0 [S18]; Zep KG [S20]; Claude auto memory files [S5]); (c) **raw history** (Codex "supporting evidence/recent inputs" [S10]; Letta conversation search [S19]; Zep episodes [S20]; MemGPT recall with paginated search [S15]). RapidTool equivalent tiers exist: in-context ranked rows → 80-row FIFO → knowledge.ts → vault (which even archives traces via `traceNote`). The gap is that **only the first tier is actually read back into prompts today** (ranked memory rows in the packet, engine.ts:775); knowledge.ts entries are advisory, vault is export-only.

**Episodic / semantic / procedural split.** Explicit in the wild: MemGPT-family "remember, reflect" + recall vs archival [S15]; Zep episode/semantic/community subgraphs [S22]; Claude Code auto memory "learnings and patterns" (procedural-ish) vs CLAUDE.md rules [S5]; RapidTool already declares `episodic|semantic|procedural` (engine.ts:48) and M-08 writes episodic+semantic only — **procedural kind is defined but nothing writes procedural rows today** [verified repo grep]. Devin Knowledge + Playbooks = semantic-tips vs procedural-playbooks split in product form [S1, S24]; Agent Skills = procedural knowledge packaged as files [S26].

**Retrieval: what actually gets compared.** Evidence ladder: pure lexical (Aider conventions = always-in-context file, no retrieval [S9]; RapidTool knowledge.ts idf token-overlap [repo]) → keyword+stem with prefixes (vault search [repo]) → embeddings (Voyager description-embedding index [S12]; MemGPT pgvector/HNSW [S15]) → fused multi-signal (Mem0 semantic+BM25+entity [S18]; Graphiti semantic+keyword+graph traversal [S21]) → model-decided trigger matching (Devin trigger descriptions [S1]; skills descriptions [S26]; Cascade "retrieves when it believes relevant" [S3]). Two published retrieval-quality datapoints: Mem0's rewrite moved to multi-signal fusion + entity linking and claims +21 LoCoMo/+27 LongMemEval [S18]; Zep's temporal KG beats embedding-retrieval baselines on temporal tasks (up to +18.5% LongMemEval) [S22].

**Write timing (when memory is captured).** Options with citations: on completion (M-08 pattern; MemGPT commit-on-success analog in Voyager "commit program when self-verification confirms" [S12]); on user correction (Claude Code auto memory "based on your corrections" [S5]; Devin suggestions "based on your feedback in chat" [S1]); in idle background (Codex memories "after a chat has been idle" [S10]; LangMem background manager [S23]); intentionally via agent tools (Letta `archival_memory_insert` [S19]; LangMem hot-path tools [S23]).

**Scoring / eviction / forgetting.** Published mechanisms: FIFO with pressure warning before eviction (MemGPT memory pressure [S15]); fixed-size caps (200 lines/25KB [S5]; 32 KiB [S4]; 6k/12k chars [S3]); append-only accumulation with dedupe (Mem0 ADD-only [S18]; RapidTool knowledge.ts idempotent fingerprints [repo]); temporal validity/supersession (Graphiti valid/invalid timestamps [S21]); consolidation as separate model pass (Codex `memories.consolidation_model` [S10]). **No fetched source uses a classic Ebbinghaus forgetting curve in a shipped coding agent** — that idea is common in blog/R&D literature but absent from the primary pages fetched here (honest negative; see §7).

**Human gates.** Universal pattern: machine proposes, human disposes — Devin Knowledge Suggestions editable/dismissible before save [S1]; Codex proposes prefix_rules during escalation, user reviews [S11]; Cascade recommendation to promote auto-memories into version-controlled rules [S3]; Cursor "ask the agent to create a rule" [S7]. Auto-only loops that skip the gate (pure FIFO rows) are the exception, and Cascade's deprecation of auto-memories [S3] is the cautionary tale.

---

## 4. Skills / playbooks — when tools load reusable procedures

**The open standard (Agent Skills).** Folder with `SKILL.md` (frontmatter `name` + `description` minimum) + optional scripts/references/assets. **Progressive disclosure in three stages**: (1) Discovery — at startup agents load only name+description of every skill; (2) Activation — "when a task matches a skill's description, the agent reads the full SKILL.md into context"; (3) Execution — follow instructions, optionally run bundled code/load files. "Full instructions load only when a task calls for them... many skills with a small context footprint." Originated by Anthropic, adopted across products [S26]. Adoption evidence: Claude Code [S6], Cursor [S8], Cascade/Devin Desktop (which also scans `.agents/skills/` and `.claude/skills/`) [S25], plus the agentskills.io client list (Goose, Letta, Roo Code, Databricks, Spring AI…) [S26].

**Decision: who chooses to load.** Three modes, all observed: always-on (rules: CLAUDE.md/AGENTS.md/global_rules [S5,S4,S3]; Cascade `always_on` activation [S3]); **model-decided** from a one-line description (skills [S26,S6,S8]; Cascade `model_decision` rules [S3]; Cursor "Apply Intelligently" [S7]); explicit user invocation (`/skill`, `@skill`, `!macro`, `@rule` [S6,S25,S1,S7]). The description line is the retrieval interface for model-decided loading — every skills doc stresses writing descriptions that state "what the skill does and when it should be used" [S25, S26].

**Procedure-vs-fact boundary.** Recurring rule: facts/conventions → always-on memory; procedures → skills loaded on demand. Claude Code: "If an entry is a multi-step procedure or only matters for one part of the codebase, move it to a skill or path-scoped rule" [S5]; Devin: playbooks (procedures) vs Knowledge (facts) [S2]; Cascade selection table [S3, S25]; Cursor `/migrate-to-skills` converts "Apply Intelligently" rules and slash commands into skills [S8].

**Playbook anatomy (Devin).** Outcome / Procedure (one imperative step per line; MECE; action verbs) / Specifications (postconditions) / Advice (correct the model's priors) / Forbidden Actions / Required from User; `.devin.md` files; iterate by running 2+ sessions in parallel [S24]. Claude Code recorded recipes = auto-generated playbooks from successful runs (`/run-skill-generator` writes `.claude/skills/run-<name>/`; `/verify` writes `.claude/skills/verify/SKILL.md`) [S6].

**[RT-note — RapidTool skills mapping]** Existing seams: knowledge.ts kinds `pattern` (≈ skill body) and `brief`; `tags`+`title` already serve as the progressive-disclosure "name+description" line; vault.ts artifact/`traceNote` already stores run evidence. Missing: (a) a **skills directory/format** (Agent Skills standard folder layout is the obvious choice — portable, and the ecosystem precedent is unanimous [S26]); (b) model-decided activation — engine prompt would list name+description of candidate patterns for the current phase and load full body on match; (c) **recipe capture on verified success**: Voyager commit-on-verify [S12], Claude Code `/verify` recorded recipes [S6], and Devin playbook structure [S24] together specify the capture prompt; (d) procedures currently captured nowhere: M-08 writes semantic/episodic rows; the `procedural` kind (engine.ts:48) is the natural home or a `pattern` knowledge entry with the phase's step list.

---

## 5. Lesson-learning / regression-to-guardrail — evidence inventory

1. **Correction → permanent instruction.** Claude Code: write to CLAUDE.md when "Claude makes the same mistake a second time... you type the same correction... last session" [S5]; auto memory captures corrections automatically [S5].
2. **Failure/iteration → lesson row.** Reflexion: verbal reflection on failure stored in episodic buffer, reused next trial [S13]. RapidTool's verify loop produces exactly this signal but doesn't store the reflection text (§2.2 note).
3. **Failure/success pairs → distilled insight.** ExpeL insight extraction dynamically edits an insight list from success/failure pairs [S14].
4. **Chat feedback → suggested knowledge (HITL).** Devin auto-suggests knowledge items from user feedback; user edits/dismisses/regenerates [S1].
5. **Successful procedure → recorded skill.** Claude Code `/run-skill-generator` and `/verify` recipes; edits to the recorded file only when a run was steered wrong (anti-churn) [S6].
6. **Approval event → guardrail rule.** Codex: allow-listing a command writes `prefix_rule` to `default.rules`; Smart approvals proposes rules during escalation [S11]. This is the cleanest published "one human approval becomes a permanent check" pipeline.
7. **Completion report → memory rows.** RapidTool M-08 semantic+episodic rows on `complete` reports [repo]; dossier-43 findings on duplicate/fifo behavior apply (H43-P2-1 duplicate rows, 80-row eviction).
8. **File-touch regression → re-verify.** RapidTool E-19 `verifyPriorPhases` re-runs earlier DoD gates when a later phase touches overlapping files and warns on evidence-hash drift [repo, engine.ts:1893] — already a regression-to-guardrail mechanism, currently advisory-only and not persisted as a lesson.
9. **Agent-confirmed actions → first-class facts.** Mem0 April-2026 algorithm stores agent-confirmed information with equal weight to user facts [S18].
10. **Deprecation loop (negative lesson).** Cascade: auto-memories are being retired for the Devin Local agent in favor of skills — vendors learn not to trust un-curated auto memory [S3].

**Synthesis for RapidTool.** The industry pattern = *machine-proposed, gated, evidence-linked, version-controlled* lessons. RapidTool's M-08 write is ungated (automatic, deterministic). The recommended pipeline: verify-fail + verify-pass pairs → LLM "why did attempt 1 fail" reflection (Reflexion [S13]) → ExpeL-style batch insight extraction over completed phases [S14] → operator-approvable knowledge suggestions [S1] → knowledge.ts `fix` entries with `sourcePath` = phase + evidence hash → optionally auto-promoted to phase rules in engine prompts (always-on tier) or to procedures (skills tier) when frequency crosses a threshold.

---

## 6. Comparative synthesis and a design menu for RapidTool

### Cost / risk / retrieval-quality comparison (evidence-coded)

| Approach | Cost | Risk | Retrieval quality | Shipped evidence |
|---|---|---|---|---|
| Always-on text files (CLAUDE.md/AGENTS.md/CONVENTIONS) | ~0 runtime; context budget fixed | Bloat → instruction dilution; caps enforced (25KB/32KiB/6-12k) | Perfect recall of what fits; degrades as file grows | [S5][S4][S3][S9] |
| Append-only auto rows + FIFO (RapidTool today; Mem0 ADD-only) | ~0; one LLM pass or none | Duplicates (dossier 43), stale rows, no synonym recall | Depends on retrieval; lexical-only misses paraphrases | [S18][repo][S3 caution] |
| Reflection on failure stored per-episode (Reflexion) | 1 extra LLM pass per failure | Reflection quality varies; buffer growth | High for same-task retry | [S13] |
| Insight extraction batch (ExpeL) | LLM pass over N runs | Extraction drift over time | Good; cross-task transfer | [S14] |
| Embedding-indexed procedures (Voyager skill library) | Embedding infra + store | Retrieval misses on novel phrasing | Strong in-domain (3.3× items, 15.3× tech milestones vs prior SOTA) | [S12] |
| Tiered blocks + archival + recall tools (MemGPT/Letta) | Infra + prompt budget for tools | Agent must remember to use tools; retrieval-bound | Beats no-memory; DMR 93.4 (Zep-reported) | [S15][S19][S22] |
| Fused multi-signal memory (Mem0 2026) | Infra; vendor-optimized | OSS ≠ managed numbers | +21 LoCoMo / +27 LongMemEval claimed vs old | [S18] |
| Temporal knowledge graph (Zep/Graphiti) | Highest: LLM extraction per episode + graph DB | Ops complexity; extraction cost | Best on temporal/cross-session tasks (+18.5% LongMemEval, 90% latency cut vs baseline) | [S20][S21][S22] |
| Background extract+consolidate (Codex) | Idle LLM passes; quota-guarded | Generated-state quality; secrets risk (mitigated by redaction) | Two-stage summarization | [S10] |
| HITL-gated suggestions (Devin) | Human review time | Suggestion spam | High trust; org-shared | [S1] |
| Recorded recipes from verified runs (Claude Code) | One capture run per project | Stale recipes when project changes; churn (fixed by edit-only-on-error) | High — recipe is ground truth of what worked | [S6] |
| Approval → guardrail rule (Codex rules) | ~0 (piggyback on approval) | Over/under-broad patterns; needs match/not_match tests | Deterministic once written | [S11] |

### Design menu (evidence-anchored options, cheapest → heaviest)

1. **Reflexion capture in verify-fix** (≈0 infra): on fail→pass pairs in `verifyAndFixServer`, generate "why did the first attempt fail?" text; store as `fix` knowledge entry w/ `sourcePath`=phase. [S13][repo verify.server.ts]
2. **Pressure-based promotion:** at ~80-row FIFO pressure (engine/report-intake cap), prompt a consolidation pass — top rows → knowledge.ts, mirroring MemGPT memory pressure + Codex consolidation model. [S15][S10][repo .slice(-80)]
3. **Trigger-field upgrade of knowledge.ts:** add `alwaysApply`/`globs`/`description` semantics to `KnowledgeEntry` (Cursor `.mdc` triple) + Devin-style pin-to-project; inject always-tier at packet build (engine.ts:775 site), model-decided tier via description list in prompt. [S7][S1][repo]
4. **Multi-signal retrieval:** keep deterministic token overlap as the base scorer (honesty + testability), add optional embedding/BM25/entity-fusion rerank behind the same `findPatterns`/`searchVault` API. [S18][S12][S15][repo knowledge.ts]
5. **Procedural rows / skills:** write `procedural` memory (kind exists, unused [repo engine.ts:48]) or Agent-Skills-format folders on verified phase completion (Voyager commit gate + Claude `/verify` recipe). Progressive disclosure already spec'd by the open standard. [S12][S6][S26]
6. **Lesson→guardrail on approvals:** where HITL decisions exist (HitlDecision records → vault), mirror Codex: an approved rejection of a gate failure proposes a durable check (rule/knowledge `fix`) with provenance; E-19 drift warnings become candidates for the same store. [S11][repo vault/verifyPriorPhases]
7. **Temporal markers:** add validUntil/supersededBy to knowledge entries when a fix is contradicted by a later verified run (Graphiti validity-window idea, scaled down). [S21]
8. **Out of scope now:** full temporal KG (Zep/Graphiti) — justified only if cross-project "when did this convention change" queries become a product need [S20-S22]; run-trace replay branching (SWE-Replay) belongs to verify iteration cost work [S17].

**Ordering rationale:** items 1→2 use existing stores/gates (zero new persistence); 3–5 are the actual "self-learning loop" (capture → promote → recall into prompts); 6–7 harden it against regression and staleness; 8 is the escalation path if evidence demands. Items 3, 5 require touching prompt-engine.ts + knowledge.ts contracts — the designer agents should read `knowledge.test.ts` and dossier 43's memory findings before drafting.

---

## 7. Honest negatives (could not verify this pass)

- **Devin's internal recall/scoring backend** (embeddings, vector DB, ranking) is not documented in fetched pages; only the trigger-description contract and "automatically recall relevant Knowledge" are published [S1].
- **Windsurf/Cascade memory scoring and retrieval internals** (how "believes relevant" works) are not published; auto-memory is also legacy/deprecated for the Devin Local agent [S3].
- **Mem0 scoring/eviction internals**: the README announces the April-2026 algorithm's properties but publishes no code-level scoring details; benchmark numbers are vendor-run and platform-specific [S18].
- **Cursor rules context budgets / truncation behavior** are not published beyond "included at the start of the model context" [S7].
- **Forgetting curves (Ebbinghaus-style recency/frequency/surprise scoring)** did not appear in any primary page fetched here (they live in secondary literature not fetched in this pass) — do not attribute such scoring to any of these systems based on this dossier.
- **Aider** has no self-learning loop by design (conventions only) [S9] — it is the "no memory" control case.
- **Claude Code auto-memory generation/retrieval internals** (which corrections trigger writes; how the 200-line/25KB slice is chosen) are not specified beyond the docs table [S5].
- **SWE-agent's own "trajectory replay"**: the original SWE-agent paper [S16] does not itself describe cross-run trajectory replay; the replay evidence is SWE-Replay [S17] (same-task, test-time). Any claim that "SWE-agent ships trajectory replay" would be wrong.
- MemGPT "sleep-time compute"/asynchronous processing was mentioned in secondary sources but was **not confirmed** in the MemGPT full-text grep of this pass; not claimed here.
- LangMem policies/profile extraction details (beyond the landing page features) not fetched [S23].

---

## 8. Source list (all fetched 2026-09-06, this pass)

Primary docs:
- [S1] Devin Docs — Knowledge. https://docs.devin.ai/product-guides/knowledge
- [S2] Devin Docs — Instructing Devin Effectively. https://docs.devin.ai/essential-guidelines/instructing-devin-effectively
- [S3] Devin Docs (Devin Desktop, ex-Windsurf) — Memories & Rules. https://docs.devin.ai/desktop/cascade/memories
- [S4] ChatGPT Learn (OpenAI) — Custom instructions with AGENTS.md. https://learn.chatgpt.com/docs/agent-configuration/agents-md
- [S5] Claude Code Docs — How Claude remembers your project (memory). https://code.claude.com/docs/en/memory
- [S6] Claude Code Docs — Extend Claude with skills. https://code.claude.com/docs/en/skills
- [S7] Cursor Docs — Rules. https://cursor.com/docs/rules
- [S8] Cursor Docs — Agent Skills. https://cursor.com/docs/skills
- [S9] Aider Docs — Specifying coding conventions. https://aider.chat/docs/usage/conventions.html
- [S10] ChatGPT Learn (OpenAI) — Memories (Codex/ChatGPT local memory). https://learn.chatgpt.com/docs/customization/memories
- [S11] ChatGPT Learn (OpenAI) — Rules (Codex exec policy). https://learn.chatgpt.com/docs/agent-configuration/rules
- [S19] Letta Docs — Archival memory (v1 SDK). https://docs.letta.com/v1-sdk/memory/archival-memory
- [S20] Zep Docs — Graph Overview. https://help.getzep.com/graph-overview
- [S23] LangMem Docs — Introduction. https://langchain-ai.github.io/langmem/
- [S24] Devin Docs — Creating Playbooks. https://docs.devin.ai/product-guides/creating-playbooks
- [S25] Devin Docs — Cascade Skills. https://docs.devin.ai/desktop/cascade/skills
- [S26] Agent Skills (open standard, agentskills.io) — Overview. https://agentskills.io/
- [S18] Mem0 — README (incl. April-2026 algorithm notes). https://raw.githubusercontent.com/mem0ai/mem0/main/README.md
- [S21] Zep/Graphiti — README. https://raw.githubusercontent.com/getzep/graphiti/main/README.md

Papers (arXiv abstract pages; full-text HTML where noted):
- [S12] Voyager: An Open-Ended Embodied Agent with LLMs (arXiv:2305.16291; full-text v2 HTML grepped). https://arxiv.org/abs/2305.16291
- [S13] Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366). https://arxiv.org/abs/2303.11366
- [S14] ExpeL: LLM Agents Are Experiential Learners (arXiv:2308.10144; full-text v3 HTML grepped). https://arxiv.org/abs/2308.10144
- [S15] MemGPT: Towards LLMs as Operating Systems (arXiv:2310.08560; full-text v2 HTML grepped). https://arxiv.org/abs/2310.08560
- [S16] SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering (arXiv:2405.15793). https://arxiv.org/abs/2405.15793
- [S17] SWE-Replay: Efficient Test-Time Scaling for Software Engineering Agents (arXiv:2601.22129). https://arxiv.org/abs/2601.22129
- [S22] Zep: A Temporal Knowledge Graph Architecture for Agent Memory (arXiv:2501.13956). https://arxiv.org/abs/2501.13956

Repo anchors (read-only verification, 2026-09-06): `src/lib/knowledge.ts`, `src/lib/vault.ts`, `src/lib/engine.ts` (:48 memory kinds, :773 FusionRank step, :1893 verifyPriorPhases/E-19), `src/lib/report-intake.ts` (M-08 lesson rows), `src/lib/verify.server.ts` (:487-520 bounded verify-fix), `src/lib/prompt-engine.ts`, `src/lib/headless.ts` (knowledge consumer), `src/lib/types.ts`. Cross-ref: `research/multiagent/43_hunt_pipeline_memory.md` (80-row FIFO, H43-P2-1 duplicate-eviction findings).
