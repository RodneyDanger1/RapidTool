# 219f — Competitor codebases vs RapidTool's entire codebase — mechanisms, not vibes

**Lane 6 · state-of-the-factory inquest · 2026-09-24**
**Dataset:** 17 local, read-only clones under `/c/Users/mnril/rt-competitors/`. **Nothing from any clone was
executed** — no `node`, `npm`, `python`, `pytest`, no tests, no installs, no copies into RapidTool. The whole
method is `ls` / `find` / `grep` / `wc` / reading files. `web_search` is unavailable in this environment, so
**every competitor fact below comes from a file in these clones**; where a search found nothing it is written
as *"nothing matching X in the files I searched (command shown)"*, never as "they don't have X".

**Revisions on disk** (pinned with `git -C <clone> log -1 --format=%h`, a read):

| clone | rev | last commit | clone | rev | last commit |
|---|---|---|---|---|---|
| aider | 5dc9490 | 2026-05-22 | MetaGPT | 11cdf46 | 2026-01-21 |
| bolt.diy | 2e254ac | 2026-02-07 | opencode | 88c6c7a | 2026-09-16 |
| ChatDev | 4fb2db0 | 2026-07-24 | OpenHands | a040303 | 2026-09-16 |
| cline | 025baa8 | 2026-09-16 | pr-agent | 785bb82 | 2026-09-16 |
| codex | c56dda7 | 2026-09-16 | Roo-Code | b867ec9 | 2026-05-15 |
| continue | 5522c6f | 2026-07-20 | SWE-agent | 3ea751c | 2026-07-16 |
| developer | a6747d1 | 2023-09-25 | Dyad | 43bdd75 | 2026-09-16 |
| Devika | 80bb343 | 2025-09-25 | gpt-engineer | a90fcd5 | 2024-11-17 |
| gpt-pilot | 9b763fd | 2026-06-12 | | | |

**Two dataset facts that limit scope, and I say so up front:**

1. **`continue` is not usable as a mechanism source.** It is a root-level checkout only:
   `find continue -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.py' -o -name '*.js' \) -not -path
   '*/node_modules/*' | wc -l` → **0**. On disk are LICENSE, README, package.json, configs and a shallow
   `.git`. No `src/`, no extension code. Excluded from the matrix (its license file is real and is listed in §1).
2. **The OpenHands clone is the "Agent Canvas" frontend repo, not the Python agent runtime.**
   `head -12 OpenHands/README.md` → *"Agent Canvas — The self-hosted developer control center for coding
   agents and automations … Run OpenHands, Claude Code, Codex, Gemini, or any ACP-compatible agent across
   local, remote, and cloud backends."* Measured: `find OpenHands -type f \( -name '*.ts' -o -name '*.tsx' \)
   -not -path '*/node_modules/*' | wc -l` → **1977**; `find OpenHands -name '*.py' … | wc -l` → **10**.
   So for OpenHands I can verify **UI/adapter/orchestration-client mechanics**, and I cannot verify its agent
   loop, sandbox, or memory (that code is not on this disk). I state this instead of guessing.

RapidTool side: this repo at commit 7582771, gate green 2026-09-24 11:08 (`wave_plans/W13/lane-6.md:28`:
scripts 261/261, src/lib 1957/1957 +1 by-design skip) — cited as parent-verified; I did not re-run the gate.

---

## 1. License reality check (read each clone's own LICENSE file)

Command pattern: `grep -m3 -iE 'MIT|Apache|GPL|BSD|Mozilla|MPL|AGPL|LGPL|Functional Source|Business Source|
Elastic|SSPL|source-available|proprietary|copyright' <clone>/LICENSE*` (+ targeted reads where the header hid
a restriction).

| clone | file read | license | OSI-open? | notes |
|---|---|---|---|---|
| aider | `aider/LICENSE.txt` | Apache-2.0 | yes | |
| bolt.diy | `bolt.diy/LICENSE` | MIT (StackBlitz, Inc. + contributors) | yes | |
| ChatDev | `ChatDev/LICENSE` | Apache-2.0 | yes | |
| cline | `cline/LICENSE` | Apache-2.0 | yes | |
| codex | `codex/LICENSE` (+ `NOTICE`) | Apache-2.0 | yes | |
| continue | `continue/LICENSE` | Apache-2.0 | yes | **no code on disk** (see §0) |
| developer | `developer/LICENSE` | MIT (swyx, 2023) | yes | |
| Devika | `Devika/LICENSE` | MIT (stition, 2024) | yes | |
| **Dyad** | `Dyad/LICENSE` | **mixed: Apache-2.0 + carve-out** | mostly | line 3: *"All content that resides under the `src/pro/` directory … is licensed under the license defined in `src/pro/LICENSE`"* — and `Dyad/src/pro/LICENSE` is **FSL-1.1-ALv2** (*"Functional Source License, Version 1.1, ALv2 Future License … Copyright 2025 Dyad Tech, Inc."*). Everything outside `src/pro/` is Apache-2.0. |
| gpt-engineer | `gpt-engineer/LICENSE` | MIT (Anton Osika, 2023) | yes | |
| **gpt-pilot** | `gpt-pilot/LICENSE` | **FSL-1.1-MIT** (Functional Source License, MIT Future License; Pythagora Technologies, Inc. 2024) | **no — source-available** | lines 30–38: *"A Permitted Purpose is any purpose other than a Competing Use. A Competing Use means making the Software available to others in a commercial product or service that: 1. substitutes for the Software; 2. substitutes for any other product or service we offer…"*; converts to MIT later ("MIT Future License"). |
| MetaGPT | `MetaGPT/LICENSE` | MIT (Chenglin Wu, 2024) | yes | |
| opencode | `opencode/LICENSE` | MIT (2025) | yes | |
| OpenHands | `OpenHands/LICENSE` | MIT (OpenHands contributors, 2025) | yes | frontend repo only (see §0) |
| pr-agent | `pr-agent/LICENSE` | MIT (2026 The PR Agent) | yes | |
| Roo-Code | `Roo-Code/LICENSE` | Apache-2.0 | yes | |
| SWE-agent | `SWE-agent/LICENSE` | MIT (Yang, Jimenez, Wettig, Yao, Narasimhan, Press, 2024) | yes | |

**Read:** 15 of 17 are clean OSI-open. Two carry carve-outs that change what *can be copied* (learning from
mechanisms is fine everywhere): **gpt-pilot is FSL-1.1-MIT — source-available, with a Competing-Use bar**, and
**Dyad is Apache-2.0 *except* `src/pro/`, which is FSL-1.1-ALv2**. Any future "steal this code" work must
stay out of `gpt-pilot/**` and `Dyad/src/pro/**` verbatim-copy paths.

---

## 2. The mechanism matrix

Legend for verdicts: **RAPIDTOOL-LEADS** / **PARITY** / **RAPIDTOOL-BEHIND** / **DIFFERENT-AXIS**.
Each row: mechanism → competitor mechanism (clone @ rev, path, symbol, command) → RapidTool mechanism
(file:line) → verdict.

### 2.1 Agent loop / tool-calling core

- **cline @ 025baa8** — the loop is now in the SDK, not the extension:
  `sdk/packages/agents/src/agent-runtime.ts`, `while (this.state.iteration < this.config.maxIterations)`
  (~line 760, `grep -n 'while\|maxIterations' sdk/packages/agents/src/agent-runtime.ts`); the same file
  retries transient provider errors ("How many times to retry a model turn that failed with a transient,
  provider-side error… value of 3 means up to 4 total requests for one turn") and consumes
  `ToolApprovalResult` / `AgentRuntimeHooks` from `@cline/shared`. Tool surface:
  `apps/vscode/src/core/task/tools/` (tool definitions + `subagent/`).
- **Roo-Code @ b867ec9** — `src/core/tools/` holds 25 tool modules (`ls src/core/tools/`): `BaseTool.ts`,
  `AttemptCompletionTool.ts`, `NewTaskTool.ts`, `ExecuteCommandTool.ts`, `ApplyDiffTool.ts`, `SkillTool.ts`…
- **SWE-agent @ 3ea751c** — `sweagent/agent/agents.py` `step()` / `run()` (lines 328/339 per
  `grep -n 'def step\|def run'`); tool config in `sweagent/tools/tools.py` (`ToolConfig`, `ToolHandler`,
  `FunctionCallingParser`/`JsonParser`).

> [WD-C · 2026-09-24] CORRECTED: "lines 328/339…" → `step()` is at :328 (✓); **`run()` is at :390** — the
> same grep re-run today returns 237/239 (abstract stubs), 328, 390; :339 is the cost-limit autosubmit
> text. The symbol claims stand; only the :339 was wrong. (verified by WD-C, not by the lane)
- **aider @ 5dc9490** — 20 coder/edit-format modules in `aider/coders/` (`ls aider/coders/`), incl.
  `architect_coder.py` (architect/editor two-model split) and `base_coder.py`.
- **RapidTool** — a *deterministic phase graph*, not an open agent loop: `src/lib/phases.ts:3` (`PHASES`,
  P0–P12), `src/lib/engine.ts` (phase driver, `PHASE_STATUSES` at :113), role loop in
  `src/lib/crew.ts:175` (`runCrew`) / `crew.server.ts`, fan-out in `src/lib/subagent.ts`
  (`SUBAGENT_MAX_CONCURRENCY = 4` :49).
- **Verdict: DIFFERENT-AXIS.** Both are real loops; RapidTool's is bounded by 13 declared phases and a
  governance graph, competitors' are open iteration loops with much wider tool surfaces. RapidTool leads on
  predictability/auditability, is behind on interactive tool breadth per turn.

### 2.2 Sandboxed execution

- **codex @ c56dda7** — OS-level isolation as first-class crates: `codex-rs/linux-sandbox/`,
  `codex-rs/mxc-sandbox/`, `codex-rs/bwrap/`, seatbelt in `codex-rs/cli/src/debug_sandbox/seatbelt.rs`,
  policy in `codex-rs/core/src/sandboxing/` (`find codex-rs -type d -name '*sandbox*'`), Windows path in
  `codex-rs/app-server/src/request_processors/windows_sandbox_processor.rs`.
- **SWE-agent @ 3ea751c** — execution happens inside a per-instance container: `sweagent/environment/swe_env.py`
  (`class SWEEnv`, `Repo`/`RepoConfig` import at line 20) and `sweagent/environment/repo.py`.
- **cline @ 025baa8** — process-level, not OS-level: `sdk/packages/core/src/runtime/tools/subprocess-sandbox.ts`
  (child-process spawn + `subprocess-sandbox-lifecycle.ts`, idle timeouts) and `tool-approval.ts`.
- **Devika @ 80bb343** — `ls -la Devika/src/sandbox/` → `code_runner.py` and `firejail.py` are **0 bytes each**.
  The sandbox directory exists; the sandbox does not (at this revision).
- **gpt-pilot @ 9b763fd** — command execution via host process manager: `core/agents/executor.py`
  (`run_command` call at line 107) + `core/proc/process_manager.py`; nothing matching a container/sandbox
  boundary in the files I searched.
- **RapidTool** — `src/lib/node-runner.server.ts` header: *"this is a *bounded* execution environment, NOT a
  security sandbox"*; every envelope carries `sandbox: false` (:49–53); wall-clock timeout → tree-kill +
  SIGKILL with `KILL_GRACE_MS` settle (:139–141); `scrubbedEnv()` copies a tight env allowlist, never API
  keys (:166–196); `redactSecrets` (:224); `sandbox-policy.ts runnerIsolationClaim` (:26); client wrapper
  `src/lib/exec.ts:2–17`.
- **Verdict: RAPIDTOOL-BEHIND** against codex (Landlock/Seatbelt/Bubblewrap/Windows sandbox) and SWE-agent
  (Docker per instance); **PARITY** with cline (both are process-level). RapidTool is the only one in this
  set that stamps the honest non-sandbox claim into the runtime envelope itself.

### 2.3 Repo indexing + context selection (the "which files does it read" algorithm)

- **Roo-Code @ b867ec9** — a real codebase index: `src/services/code-index/` with `manager.ts`,
  `config-manager.ts` (Qdrant default `http://localhost:6333` at line 25), `vector-store/`, `search-service.ts`,
  and 8 embedders in `src/services/code-index/embedders/` (openai, ollama, gemini, mistral, bedrock, openrouter,
  vercel-ai-gateway, openai-compatible). The tool consumes it: `src/core/tools/CodebaseSearchTool.ts`
  imports `CodeIndexManager` + `VectorStoreSearchResult`. Also `src/services/tree-sitter`, `src/services/ripgrep`.
- **aider @ 5dc9490** — tree-sitter repo map with a cache: `aider/repomap.py` (`from tree_sitter import Query`
  :19, `get_repo_map` :103, `load_tags_cache`/`save_tags_cache` :217/:224).
- **Dyad @ 43bdd75** — `src/ipc/processors/code_explorer.ts` (`runCodeExplorer` :248, `isCodeExplorerReady`
  :37, `getTypeScriptInstallationFingerprint` :282).
- **RapidTool** — deterministic lexical mining, explicitly not embeddings: `src/lib/ast-mine.ts`
  (`mineCodebase` :383, `conventionsMap` :497, `respectConventions` :570), `src/lib/algorithms.ts`
  (`fusionRank` :512, `phraseHits`, shared tokenizer), and the self-declaration in `src/lib/knowledge.ts:19`:
  *"scoring on plain tokens, NOT a vector database and NOT embeddings"*. Checks:
  `grep -rniE 'embedding|qdrant|vectorstore|faiss|hnsw' src/lib --include='*.ts'` → only prose comments, no
  index implementation; `grep -rniE 'tree-sitter|tree_sitter' src/lib scripts` → nothing.
- **Verdict: RAPIDTOOL-BEHIND** on codebase-scale semantic retrieval (nothing matching an index in src/lib);
  **PARITY** on deterministic lexical ranking, which RapidTool chose deliberately (the knowledge.ts:19 comment
  is the design statement).

### 2.4 Patch application / merge primitive

- **aider @ 5dc9490** — the widest format set in the field: `aider/coders/` ships `editblock_coder.py`,
  `editblock_fenced_coder.py`, `udiff_coder.py` (+`udiff_simple`), `wholefile_coder.py` (+`_func` variants),
  `patch_coder.py`, `editor_diff_fenced_coder.py`, `editor_editblock_coder.py`, `search_replace.py`.
- **Dyad @ 43bdd75** — an XML tag protocol: `src/ipc/utils/dyad_tag_parser.ts`, with an inbound sanitizer
  (`cleanFullResponse.test.ts` replaces `<` inside `dyad-write` attributes with `＜`) and the applier
  `src/ipc/processors/response_processor.ts` (`processFullResponseActions` :147, `dryRunSearchReplace` :103,
  `<dyad-write>` / `<dyad-search-replace>` tags).
- **codex @ c56dda7** — `codex-rs/apply-patch/` crate + a grammar `codex-rs/core/assets/tools/apply_patch.lark`
  + handler `codex-rs/core/src/tools/handlers/apply_patch.rs`.
- **Roo-Code @ b867ec9** — `ApplyDiffTool.ts` + `apply-patch/` + `EditFileTool.ts` / `SearchAndReplaceTool.ts`
  variants.
- **RapidTool** — one typed primitive: `src/lib/patch.ts` — `applyStrReplace` (:279), `PatchKind =
  "exact" | "fuzzy" | "none"` (:43), `patchSimilarity` (:140), `PATCH_MAX_LISTED = 50` (:117), and a typed
  refusal shape (`PatchRefusal` :93) so a failed match reports why instead of guessing.
- **Verdict: PARITY** on primitive quality (RapidTool's is typed and refuses); **RAPIDTOOL-BEHIND** on format
  breadth (aider alone ships 20 coder formats; RapidTool has no whole-file/udiff/editor-diff variants).

### 2.5 Verification depth — do they run what they build?

- **aider @ 5dc9490** — lint by default, tests opt-in: `aider/coders/base_coder.py:105–107`
  `auto_lint = True` / `auto_test = False` / `test_cmd = None` (+ `--lint` / `--lint-cmd` in `aider/args.py:528`).
- **Dyad @ 43bdd75** — typechecks the generated app: `src/ipc/processors/tsc.ts` (`runTypeScriptCheck` :495,
  `parseTypeScriptDiagnostics` :299, precondition gating :62/:94).

> [WD-C · 2026-09-24] ADDENDUM (scope): Dyad verifies the generated app further than tsc — it runs
> **Playwright assertions against a running preview**: `src/ipc/handlers/tests_handlers.ts`
> (`listSpecFiles(appPath)` :126, `getRunningTestBaseUrl(appId)` :215, `buildPlaywrightCliInvocation` :252)
> + `src/lib/test_recorder/assertion_{proposal,code,tag}.ts` + `src/ipc/utils/playwright_bootstrap.ts`.
> This matches lane 5's bar row 2 (108:468-475). (verified by WD-C, not by the lane)
- **SWE-agent @ 3ea751c** — runs the *subject repo's* tests (its whole benchmark axis), plus submission
  review: `sweagent/agent/reviewer.py` (`AbstractReviewer`, `Preselector`/`Chooser`), tool dirs
  `tools/review_on_submit_m`, `tools/windowed_edit_linting`.
- **MetaGPT @ 11cdf46** — `metagpt/actions/run_code.py` `RunCode.run` (:120) with `_install_dependencies`
  (:171) and pytest install (:165) — on the host.
- **gpt-pilot @ 9b763fd** — `core/agents/executor.py` `run_command` (:107) + `core/agents/bug_hunter.py`
  (`check_logs` :103, `ask_user_to_test` :144, `get_bug_reproduction_instructions` :82).
- **RapidTool** — `src/lib/compile-check.server.ts` `treeRun` (:939) copies the emitted tree to a scratch
  temp dir (`cpSync` → `mkdtempSync 'rt-treerun-'`), then runs **the emitted project's own toolchain**:
  the in-file comment says *"the emitted project's OWN toolchain — `npm run typecheck`, `npm test` and (deps
  permitting) the declared `build` script"* and *"a tree failing its own npm test can never be ok"*
  (:1004); `installToolFor` (:1145) picks `npm ci` / `npm install`. The verdict is fail-closed and exact —
  `outcome.ok = compile.ok && specsGreen && entryGreen && projectLeg.verdict.ok` (:1036), where
  comment :1030–1031 states *"missing entry verdict is NOT green. Headless skip is NOT green. Only an
  executed pass or a structural UI-shell skip counts"*, and a declared-but-un-runnable project script
  becomes a loud note — *"the tree's own tools are UNVERIFIED (not a pass)"* (:1024). Also:
  `verifyKindDir` (:1270, fresh scratch install+`build`+`test` per the :1051–1077 header) and
  `src/lib/verify.server.ts` `verifyAndFixServer` (:923) — oracle-case generate → run → bounded fix loop
  (`maxIterations` clamped to ≤5), with pinned oracle ids that can never be dropped silently.
- **Verdict: RAPIDTOOL-LEADS.** In the files I searched, no other clone runs *its own product's* declared
  typecheck+test+build before calling the work done. Nearest neighbours: Dyad typechecks only; aider's
  tests are opt-in and off by default; SWE-agent runs tests — but of pre-existing repos it did not build.
  RapidTool's `treeRun` executes the artifact with the artifact's own scripts, on a scratch copy, and
  refuses to report `ok` without ≥1 executed pass (`specsGreen` logic, same file).

### 2.6 Multi-agent role split vs single loop

- **MetaGPT @ 11cdf46** — the canonical SOP split: `metagpt/roles/` (product_manager, architect,
  project_manager, engineer, qa_engineer, role.py), `metagpt/software_company.py`, `metagpt/team.py`,
  and a graph of actions in `metagpt/actions/action_graph.py` / `action_node.py`.
- **ChatDev @ 4fb2db0** — graph-based orchestration: `workflow/graph_manager.py`, `workflow/topology_builder.py`,
  `workflow/executor/`, runtime node executor `runtime/node/executor/agent_executor.py`,
  node configs in `entity/configs/node/agent.py`.
- **gpt-pilot @ 9b763fd** — `core/agents/`: architect, code_monkey, developer, orchestrator, bug_hunter,
  executor, problem_solver, human_input.
- **cline @ 025baa8** — teammates as a first-class session concept:
  `sdk/packages/core/src/session/team/team-session-coordinator.ts` + `team-child-session-manager.ts`, and a
  subagent tool (`apps/vscode/src/core/task/tools/subagent/{AgentConfigLoader.ts,SubagentToolName.ts}`).
- **codex @ c56dda7** — `codex-rs/agent-roles/` (`agent_role_config.rs`, `loader.rs`, `discovery.rs`),
  `codex-rs/agent-identity/`, `codex-rs/agent-graph-store/`.
- **RapidTool** — `src/lib/crew.ts` (`CrewRole` :25, `runCrew` :175, `CrewStopReason` incl. `"cost-limit"` :94),
  `src/lib/crew.server.ts` (`ROLE_SPECS` architect/reviewer/tester :128, `CREW_ROLE_BY_PHASE` :147,
  `nextRole` :459, `treeReviewContext` :348 — the reviewer sees file paths + exported names, *never design
  intent*), `src/lib/swarm.ts` (`SWARM_ROLES` :117, `seatsForPhase` :180), `src/lib/subagent.ts`
  (concurrency cap 4, ≤24 tasks, per-task token budget).
- **Verdict: PARITY.** Every side here ships real role splits with bounded budgets; RapidTool's distinctive
  mechanism is that roles are *bound to phases* and the reviewer is structurally blinded to intent
  (`treeReviewContext`), which I did not find an equivalent of in the other clones.

### 2.7 Autonomy / permissions (auto-approve, allow-lists, HITL seams)

- **codex @ c56dda7** — the deepest permission model: approval policy × sandbox mode
  (`codex-rs/prompts/templates/permissions/sandbox_mode`, `AskForApproval` / `approval_policy` consumers in
  app-server + analytics; Windows sandbox setup protocol in `app-server-protocol/src/protocol/v2/windows_sandbox.rs`).
- **Roo-Code @ b867ec9** — granular auto-approval: `src/core/auto-approval/AutoApprovalHandler.ts` +
  `commands.ts` / `tools.ts` / `mcp.ts` (per-category sets), plus `ToolRepetitionDetector.ts`.
- **cline @ 025baa8** — `sdk/packages/core/src/runtime/tools/tool-approval.ts`
  (`requestDesktopToolApproval`, file-based approval channel with `timeoutMs`/`pollIntervalMs`) and
  `runtime/safety/{loop-detection.ts,mistake-tracker.ts,rules.ts}`.
- **opencode @ 88c6c7a** — wildcard rulesets: `packages/opencode/src/permission/index.ts`
  `evaluate(permission, pattern, ...rulesets)` (:28) + ask/allow/deny log path (:73–96);
  `packages/opencode/src/permission/subagent-permissions.ts`.

> [WD-C · 2026-09-24] CORRECTED: the last path → the file is at
> **`packages/opencode/src/agent/subagent-permissions.ts`** (`find opencode/packages/opencode/src -name
> 'subagent-permissions*'`); `src/permission/` holds only `arity.ts`, `evaluate.ts`, `index.ts`. The
> `evaluate` :28 cite re-confirmed. (verified by WD-C, not by the lane)
- **aider @ 5dc9490** — `InputOutput.yes` (io.py:308) with response vocabulary `["yes","no","skip","all"]`
  (:831) = approve-all, and `auto_commits=True` default (base_coder.py:308).
- **Dyad @ 43bdd75** — `autoApproveChanges` setting (`src/ipc/handlers/chat_stream_handlers.ts:3114`).
- **RapidTool** — phase-level mandatory gates: `src/lib/phases.ts:150` `HITL_PHASES` (P4/P5/P8/P9 are
  `hitl: true` in the PHASES table), `awaiting_hitl` status (engine.ts:113), and hard rules in engine copy:
  *"forceHuman gates (reframe, failed sandbox) can never be autopilot-approved"* (:814), *"a FAILING sandbox
  can never be autopilot-approved"* (:898); DoD enforcement defaults ON for keyed runs.
- **Verdict: DIFFERENT-AXIS, with RAPIDTOOL-BEHIND on granularity.** Competitors let you allow-list at
  *action* level (codex modes, Roo per-tool sets, opencode wildcard patterns); RapidTool gates at *phase*
  level and has no per-action allow-list found in src/lib. RapidTool's lead is that its gates are mandatory
  by construction (a failing sandbox *cannot* be auto-approved) rather than configured.

### 2.8 Memory / learning across runs

- **aider @ 5dc9490** — `.aider.chat.history.md` (default path `aider/args.py:275`) restored into
  `done_messages` on start (`base_coder.py:520–522`, `split_chat_history_markdown`), plus the repomap tags
  cache (`repomap.py:217/:224`).
- **MetaGPT @ 11cdf46** — typed memory stack: `metagpt/memory/` (`brain_memory.py`, `longterm_memory.py`,
  `role_zero_memory.py`, `memory_storage.py`) + `metagpt/learn/`.
- **Roo-Code @ b867ec9** — `src/core/task-persistence/{TaskHistoryStore,taskMessages,taskMetadata}.ts`,
  `src/core/checkpoints/` (shadow git dir, `checkGitInstalled` guard, :73/:138–195), `foldedFileContext.ts`.
- **cline @ 025baa8** — session stores + `session/session-versioning-service.ts`, `session/checkpoint-restore.ts`,
  `session/session-snapshot.ts`. (Nothing matching a "memory bank" feature in the files I searched:
  `grep -rli 'memory.bank' apps sdk` → empty.)
- **RapidTool** — `src/lib/knowledge.ts` (`KnowledgeStore` :347, `LessonSpec` L1–L5 :751, `FailureKind`/
  `FailureRecord` :794–809, `rankBriefLessons` :90, `lessonLinesForBrief` :128), `src/lib/vault.ts`
  (`lessonNote` :662, `searchVaultScored`), wired into runs at `engine.ts:671` — *"Lessons from prior runs
  (advisory — tighten the brief so these failure modes are addressed; never overrides the gate)"* — plus the
  CLI `lesson` verb family (AGENTS.md).
- **Verdict: PARITY.** All five persist cross-run state. RapidTool is the only one I found that *bounds the
  authority* of learned memory (advisory-only, cannot override a gate); MetaGPT's memory stack is richer in
  types (brain/long-term/role-specific).

### 2.9 Cost / token accounting + context compaction

- **cline @ 025baa8** — `sdk/packages/core/src/extensions/context/agentic-compaction.ts` (budget-projection,
  `findCutIndex`, summary extraction/`getCompactionSummaryMetadata`, token estimation) — let me note:
  compaction in cline is itself driven by a handler and budget projection.
- **Roo-Code @ b867ec9** — `src/core/condense/` + `src/core/context-management/` + `src/core/context-tracking/`.
- **Dyad @ 43bdd75** — `src/ipc/handlers/compaction/` (`compaction_handler.ts`, `compaction_storage.ts`,
  `compaction_utils.ts`).
- **aider @ 5dc9490** — per-model price parsing (`aider/models.py:282–318`
  `input_cost_per_token`/`output_cost_per_token`) + `max_chat_history_tokens` truncation
  (`base_coder.py:512`).
- **RapidTool** — `src/lib/token-ledger.ts`: `SessionBudgetExceeded` (:44), `NoMoneyException` (:57),
  `estimateCostUsd` (:237), `wouldExceed` (:365), and `assertBudgetHeadroom` (:320) that *throws* rather
  than warn; `src/lib/compaction.ts`: `DEFAULT_BUFFER = 20_000` (:34), `DEFAULT_KEEP_TOKENS = 8_000` (:40),
  `TOOL_OUTPUT_MAX_CHARS = 2_000` (:47), `SUMMARY_SECTIONS` (:62), `shouldCompact` (:157),
  `clampToolOutput` (:220), `renderCompactionSummary` (:141). Budgets are per-unit too: crew roles carry
  `budgetTokens` (`crew.server.ts:125`), subagents get `SUBAGENT_DEFAULT_BUDGET_TOKENS = 12_000`
  (`subagent.ts:58`), and the crew can stop for reason `"cost-limit"` (`crew.ts:94`).
- **Verdict: RAPIDTOOL-LEADS (narrowly) on hard enforcement** — named refusal exceptions + per-role and
  per-subagent budgets + a cost-limit stop reason. Nothing matching a *hard session cap that throws* in the
  competitor files I searched; their compaction is comparable in depth (cline's budget projection is the
  strongest of theirs). **PARITY on compaction mechanics.**

### 2.10 Provider / model abstraction breadth

- **bolt.diy @ 2e254ac** — 22 provider modules: `ls app/lib/modules/llm/providers/ | wc -l` → 22
  (amazon-bedrock, anthropic, cerebras, cohere, deepseek, fireworks, github, google, groq, huggingface,
  hyperbolic, lmstudio, mistral, moonshot, ollama, openai, openai-like, open-router, perplexity, together,
  xai, z-ai).
- **cline @ 025baa8** — `sdk/packages/llms/src/providers/` (60 files incl. tests; `vendors/` = 12 adapters:
  anthropic, bedrock, cline, community, google, minimax-thinking, mistral, ollama, openai,
  openai-compatible, vertex, types) + `middleware/` + `routing/`.
- **aider @ 5dc9490** — litellm catalog (lazy import `aider/llm.py:37`, `aider/main.py:32`).
- **opencode @ 88c6c7a** — catalog-driven: `packages/opencode/src/provider/provider.ts:13`
  `import { ModelsDev } from "@opencode-ai/core/models-dev"`.
- **RapidTool** — `src/lib/llm/providers/registry.ts`: `LlmProviderId = "deepseek" | "mock"` (:94),
  `PROVIDERS` = deepseek only (:143; the mock is a test-only provider, never in `PROVIDERS`), role tiers
  (`RapidToolModelRole` main/reasoning/weak :69, `ROLE_TIERS` :240), explicit-model rule + keyless floor
  (`RT_E_LLM_NOT_CONFIGURED`).
- **Verdict: RAPIDTOOL-BEHIND, and it is the single widest gap.** One real vendor vs 12–22+ adapters (and
  litellm's hundreds). The mitigating mechanism: role→tier model routing is *first-class* in RapidTool
  (`ROLE_TIERS`), which I did not find as a named concept in the other clones' provider layers I read.

### 2.11 MCP / external tool surface

- **cline @ 025baa8** — `apps/vscode/src/services/mcp/McpHub.ts` + 5 colocated `McpHub.*.test.ts`.

> [WD-C · 2026-09-24] CORRECTED: "5 colocated" → **7** `McpHub.*.test.ts` files in a **`__tests__/`**
> subdirectory (callTool, connectFailure, deleteServerRPC, listChangedRefresh, timeoutReconnect,
> toggleServerDisabledRPC, toolListChange) — evidence: `ls cline/apps/vscode/src/services/mcp/__tests__/`;
> the parent dir holds no colocated tests. (verified by WD-C, not by the lane)
- **Roo-Code @ b867ec9** — `src/core/tools/UseMcpToolTool.ts`, `accessMcpResourceTool.ts`, `src/services/mcp`.
- **opencode @ 88c6c7a** — `packages/opencode/src/mcp/{auth.ts,browser.ts}`, tests in
  `packages/opencode/test/mcp`, tool `packages/opencode/src/tool/mcp-websearch.ts`.
- **codex @ c56dda7** — `codex-rs/codex-mcp/` + `codex-rs/rmcp-client/` (server and client crates).
- **Dyad @ 43bdd75** — `src/mcp_oauth/{registry.ts,state.ts,transition.ts}` + `src/ipc/handlers/mcp_handlers.ts`
  + `mcp_error_classifiers.ts`.
- **bolt.diy @ 2e254ac** — `app/lib/services/mcpService.ts` + `app/lib/stores/mcp.ts`.
- **ChatDev @ 4fb2db0** — a root `mcp_example/` directory.
- **aider @ 5dc9490** — nothing matching `mcp` or "model context protocol" in `aider/**/*.py`
  (`grep -rli 'model context protocol\|mcp' aider --include='*.py'` → empty).
- **RapidTool** — MCP is a *contract artifact kind*, not runtime: `src/lib/types.ts:27` (`"mcp"` in the
  artifact-kind union), DoD probe `hasArtifact(p, 3, "mcp")` (`src/lib/dod.ts:428–430`), and the phase-3
  summary that states the truth in-repo: *"MCP/A2A server contracts are roadmap declarations, not runtime
  (B-18)"* (`src/lib/phases.ts:33`). `ls src/lib | grep -i mcp` → empty; `find src scripts -iname '*mcp*'` → empty.
- **Verdict: RAPIDTOOL-BEHIND.** Seven of the clones ship live MCP clients (some with OAuth, error
  classification and tests); RapidTool ships the contract artifact and an honest declaration. The seam is
  prepared (artifact kind + DoD probe + phase slot), the runtime is absent.

### 2.12 UI surface

- **cline @ 025baa8** — VS Code extension (`apps/vscode`), CLI TUI (`apps/cli/src/tui/`), `cline-hub`.
- **Roo-Code @ b867ec9** — VS Code extension (`src/extension.ts`, webview in `src/core/webview`) + e2e app
  (`apps/vscode-e2e`), 17 UI locales (`ls src/package.nls.*.json | wc -l` → 17).
- **OpenHands (Agent Canvas) @ a040303** — Electron desktop + web control center: `electron/`,
  `electron-builder.config.mjs`, `react-router.config.ts`, `src/` (1977 TS/TSX) — a *client* that drives
  "OpenHands, Claude Code, Codex, Gemini, or any ACP-compatible agent" (README).
- **Dyad @ 43bdd75** — Electron desktop app (`forge.config.ts`, `src/main.ts`, `src/preload.ts`) + 190+ e2e
  specs (`e2e-tests/`).
- **bolt.diy @ 2e254ac** — web app + `electron/` + `electron-builder.yml`.
- **opencode @ 88c6c7a** — TUI (`packages/tui`), desktop (`packages/desktop`), web (`packages/web`), Slack
  (`packages/slack`).
- **aider @ 5dc9490** — terminal REPL (a `aider/gui.py` exists; the args surface is `aider/args.py`).
- **RapidTool** — TanStack Start web console: 3 routes (`src/routes/{__root,index,run.$id}.tsx`), a 10-tab run
  view (`src/components/console.tsx:132` — artifacts, packet, spec, crew, oracle, design, diagram, chat,
  vault, runtime), plus a 35-verb CLI (`grep -c 'case "' scripts/rapidtool-cli.mjs` → 35).
- **Verdict: PARITY on surface inventory; a real difference in *where* it lives.** RapidTool is web+CLI only;
  cline/Roo are IDE-native (VS Code) and Dyad/bolt.diy ship desktop apps. Nothing matching an IDE extension
  or editor protocol server in RapidTool's src (the MCP/A2A slots are declarations, §2.11). That is a
  distribution difference more than a mechanism gap.

### 2.13 Packaging / deploy of the produced artifact

- **bolt.diy @ 2e254ac** — first-class deploy targets: `app/lib/stores/netlify.ts`, `app/lib/stores/vercel.ts`
  (plus electron-builder.yml to ship bolt itself).
- **Dyad @ 43bdd75** — hosting/DB wiring in-tree: `src/coolify_deploy/`, `src/neon_admin/`,
  `src/supabase_admin/`, `src/github_ops/`.
- **OpenHands (Agent Canvas) @ a040303** — product packaging: `electron-builder.config.mjs`, `helm/`,
  `vercel.json`.
- **RapidTool** — emits a runnable tree: `src/lib/scaffold.ts` (`scaffoldProject` :57, browser boot files +
  runnable `package.json`/`tsconfig`/`vite` for webapp/game kinds :512–539, `deplyNotes` DEPLOY.md content
  :58, `projectKindOf` :430); the `emit` verb writes the tree to `<home>/RapidTool Software/<slug>/` with
  clean-overwrite semantics (scripts/rapidtool-cli.mjs:781+), and `treeRun` (§2.5) verifies the emitted tree
  with its own toolchain; `npm run build` includes `db:migrate` (package.json:11–12).
- **Verdict: PARITY on emission (RapidTool emits *and verifies*; competitors must run their own dev servers
  to know), RAPIDTOOL-BEHIND on hosting integrations** — nothing matching a Netlify/Vercel/Coolify provider
  in RapidTool's src; deployment is a DEPLOY.md plus the caller's hands.

### 2.14 Test discipline of the tool itself

Measured read-only, one command per clone (re-run once to confirm every number, 2026-09-24):
`find cline -name '*.test.ts' -not -path '*/node_modules/*' | wc -l` → 739 ·
`find Dyad \( -name '*.test.ts' -o -name '*.test.tsx' \) -not -path '*/node_modules/*' | wc -l` → 693 ·
`find opencode/packages -name '*.test.ts' -not -path '*node_modules*' | wc -l` → 661 ·
`find Roo-Code \( -name '*.test.ts' -o -name '*.spec.ts' \) -not -path '*/node_modules/*' | wc -l` → 460 ·
`find pr-agent/tests -name 'test*.py' | wc -l` → 259 ·
`find MetaGPT/tests -name 'test_*.py' | wc -l` → 248 ·
`find gpt-pilot/tests -name '*.py' | wc -l` → 44 ·
`find aider/tests -name '*.py' | wc -l` → 41 ·
`find SWE-agent/tests -name 'test_*.py' | wc -l` → 21 ·
`find bolt.diy \( -name '*.spec.ts' -o -name '*.test.ts' \) -not -path '*/node_modules/*' | wc -l` → 3.

| tool | test files | source files (parent-measured, lane-6.md:17–20) | ratio |
|---|---|---|---|
| cline | 739 | 3 077 | 0.24 |
| Dyad | 693 | 2 512 | 0.28 |
| opencode | 661 | 3 336 | 0.20 |
| Roo-Code | 460 | 1 566 | 0.29 |
| pr-agent | 259 | 373 | 0.69 |
| MetaGPT | 248 | 913 | 0.27 |
| gpt-pilot | 44 | 327 | 0.13 |
| aider | 41 | 161 | 0.25 |
| SWE-agent | 21 | 102 | 0.21 |
| bolt.diy | 3 | 398 | 0.008 |
| **RapidTool** | **68 lib + 14 scripts = 82** | **137 lib + 32 scripts = 169** | **~0.49** |

Extra rails observed: cline `vitest.config.ts`; Roo `vitest.config.ts` + Playwright e2e app; OpenHands
(frontend) `playwright.config.ts`, `playwright.mock-llm.config.ts` and **`stryker.config.mjs` (mutation
testing)**; Dyad `e2e-tests/` (~190 specs incl. `auto_approve.spec.ts`, `azure_provider_settings.spec.ts`);
pr-agent splits `tests/{unittest,e2e_tests,health_test}`.

- **RapidTool** — colocated tests for every lib module (`ls src/lib/*.test.ts | wc -l` → 68 of 137 .ts files),
  `npm test` runs both legs (`scripts/**/*.test.mjs` then the src suite, package.json:19), `bash scripts/gate.sh`
  4-gate script, suite sizes 261 scripts / 1957 lib +1 by-design skip (lane-6.md:28, parent-verified).
- **Verdict: RAPIDTOOL-LEADS on test density** (~0.49 tests per source file vs 0.13–0.29 for cline/opencode/
  Dyad/Roo/MetaGPT — pr-agent's 0.69 is the exception), **BEHIND on test *kinds***: nothing matching a
  Playwright config, e2e app, or mutation-testing config in RapidTool's tree, while Roo/Dyad/OpenHands-frontend
  ship e2e suites and the OpenHands frontend ships Stryker.

---

## 3. Where RapidTool genuinely LEADS (tested against the claim, not assumed)

**L1. Verification depth — it runs what it builds, with the artifact's own toolchain.**
`compile-check.server.ts` `treeRun` (:939) scratches the emitted tree and runs the emitted project's own
`npm run typecheck` / `npm test` / declared build; `ok` is fail-closed —
`compile.ok && specsGreen && entryGreen && projectLeg.verdict.ok` (:1036) with the entry rule requiring an
*executed* pass (a missing verdict or a headless skip is not green, :1030–1031), and un-runnable declared
scripts stamped *"UNVERIFIED (not a pass)"* (:1024). Across the files I searched, nothing else in this set
does that: aider's `auto_test` is `False` by default (`base_coder.py:106`), Dyad stops at `tsc`
(`tsc.ts:495`), SWE-agent runs tests of repos it did not build.
**So what:** this is the mechanism behind RapidTool's "the machine proves it before saying done" claim, and
it is real in code — it is the axis to defend, not to concede.

> [WD-C · 2026-09-24] CORRECTED (scope): "Dyad stops at `tsc`" is too absolute — its `tests_handlers.ts`
> runs Playwright specs inside the generated app against a running preview (:126/:215/:252; see the §2.5
> addendum). RapidTool's lead on this axis is narrower and sharper: the artifact's **own toolchain**
> (headless typecheck/test/build) vs browser-level E2E that needs a running app.
> (verified by WD-C, not by the lane)

**L2. Hard budget enforcement with named refusals.**
`token-ledger.ts` `assertBudgetHeadroom` (:320) throws `SessionBudgetExceeded` (:44) / `NoMoneyException`
(:57); budgets exist per crew role (`crew.server.ts:125`) and per subagent (`subagent.ts:58`), and the crew
stops with reason `"cost-limit"` (`crew.ts:94`). Competitor compaction is comparable; a hard throwing cap
was not found in the files I searched. **So what:** a factory that can *refuse to spend* is a precondition
for unattended runs; this is a governance feature competitors largely leave to the user's wallet.

**L3. Honesty as a runtime mechanism, not a README promise.**
Every runner envelope carries `sandbox: false` (`node-runner.server.ts:49–53`); `sandboxClaim` /
`runnerIsolationClaim` freeze the isolation claim (`sandbox.ts:174`, `sandbox-policy.ts:26`);
phase-3/phase-4 summaries declare "MCP/A2A … roadmap declarations, not runtime (B-18)"
(`phases.ts:33`, `:41`). Compare Devika, whose `src/sandbox/firejail.py` is a **0-byte file** — a claimed
sandbox with no bytes in it — and the general field norm of describing limits in prose. **So what:** this is
the differentiator that survives an audit; it is also the reason the gaps below can be named precisely
instead of discovered by a user.

---

## 4. Where RapidTool is genuinely BEHIND — with the "so what"

**B1. Provider breadth: 1 real vendor (`deepseek`) vs 12–22+ adapters.**
Evidence: RapidTool `registry.ts:94` `LlmProviderId = "deepseek" | "mock"`, `PROVIDERS` (:143);
bolt.diy 22 providers (`ls …/providers | wc -l`), cline 12 vendor adapters, aider via litellm, opencode via
models.dev.
**Category: (c) partly out of reach without a key/budget — plus (a) engineering.**
What the competitors' code proves is possible: a provider registry where adding a vendor is a descriptor +
adapter, and model metadata (context, pricing) is data-driven. RapidTool's registry is already that shape
(`LlmProviderDescriptor` :117, `ROLE_TIERS` :240) — the reason it holds one vendor is its own live-verified
model-id rule (`registry.ts` header: models must be *live-VERIFIED* on the request path; unverified ids are
refused). So the honest read: the architecture is ready, the **verification budget and keys are the
bottleneck** — breadth costs real API calls per model before it can be declared, and RapidTool refuses to
declare unverified models. That is a *product decision to keep the honesty rule*, not an engineering wall.

**B2. MCP / external tool surface: contract artifact only, no runtime client.**
Evidence: `types.ts:27`, `dod.ts:428–430`, `phases.ts:33` (declaration); seven clones ship live MCP clients
(cline `McpHub.ts`, Roo `UseMcpToolTool.ts`, opencode `mcp/`, codex `codex-mcp`+`rmcp-client`, Dyad
`mcp_oauth/` + `mcp_handlers.ts`, bolt.diy `mcpService.ts`).
**Category: (a) engineering, with (b) a product decision inside it.**
What their code proves is possible: an agent harness can host arbitrary external tools behind a
standardized protocol, with OAuth, error classification, and per-tool approval (Dyad's
`mcp_error_classifiers.ts`; Roo's `accessMcpResourceTool.ts`). RapidTool's P3 artifact + DoD probe show the
contract seam already exists — wiring a client is bounded work. The product decision: an MCP client *expands
the trust boundary*, which must be reconciled with the current "bounded runner, not a sandbox" stance before
shipping (this is exactly the class of thing RapidTool's honesty rules force you to state).

**B3. Codebase-scale repo indexing: lexical mining only, no semantic/AST index.**
Evidence: `knowledge.ts:19` self-declares "NOT a vector database and NOT embeddings";
`grep -rniE 'embedding|qdrant|vectorstore|faiss|hnsw' src/lib` finds no index; nothing matching tree-sitter.
Roo ships Qdrant + 8 embedders + `CodebaseSearchTool.ts`; aider ships a tree-sitter repo map with cache
(`repomap.py`); Dyad ships `code_explorer.ts`.
**Category: (b) a product decision today, (a) engineering tomorrow.**
What their code proves is possible: on a 3 000-file repo, "which files matter" can be answered by a
persistent index instead of token ranking. RapidTool's deterministic stance (`knowledge.ts:19`,
`algorithms.ts fusionRank`) is arguably *the* determinism axis — but the gap is real the moment a brief
lands on a large existing codebase. A deterministic **AST/tree-sitter pass** would fit RapidTool's rules;
an embedding index would not (it reintroduces non-determinism the harness currently refuses).

**B4 (boundary note, not a mechanism failure): no IDE-native surface, no per-action allow-lists.**
cline/Roo are VS Code extensions; codex/Roo/opencode have per-action permission sets; RapidTool gates by
phase and ships web+CLI. **Category: (b) product decision.** Not closing this is defensible — but if the
produced artifacts are ever meant to live inside a developer's editor, the competitor code proves the
distribution advantage of the IDE seam (Roo ships 19 locales of VS Code chrome; cline ships a TUI beside
its extension).

---

## 5. Plain-language bottom line (for the owner)

Measured in the field's own source code, RapidTool is **not behind on the thing it claims** — it is the only
harness in this set whose emitted tree is executed with its own typecheck/test/build before the run may
claim `ok` (`compile-check.server.ts` `treeRun`), and it is alone in hard-stopping a run on a budget
(`token-ledger.ts` `assertBudgetHeadroom`) and in stamping honest non-capabilities onto the wire
(`sandbox: false` on every runner result). Its test density per source file (~0.49) leads the large
competitors (0.13–0.29). Where it is genuinely behind is **breadth, not depth**: one provider vendor vs 12–22+
(RapidTool's own live-verified-model rule is what keeps that number at one), **no MCP runtime client** while
seven clones ship one, and **no codebase-scale index** while Roo ships Qdrant+8 embedders and aider ships a
cached tree-sitter repo map. The two mechanisms that separate it from the best are therefore (1) *plug-in
breadth* — providers and MCP tools as data, verified cheaply — and (2) *retrieval over large existing
repos*; both are engineering that RapidTool's architecture already anticipates (role-tiered registry,
artifact contracts, deterministic core), and both are currently gated by deliberate honesty/budget rules
rather than by missing design. Lane 5 owns the plan — the three gaps, the evidence paths, and the
category (engineering / product decision / needs keys+budget) are handed over explicitly in §4 and §7.

---

## 6. Handoff block for Lane 5 (raw, citable)

| gap | competitor proof-of-possibility (path @ clone) | RapidTool current state (file:line) | category |
|---|---|---|---|
| Provider breadth | `bolt.diy/app/lib/modules/llm/providers/` (22 modules) · `cline/sdk/packages/llms/src/providers/vendors/` (12) · `opencode/packages/opencode/src/provider/provider.ts` (models.dev) | `src/lib/llm/providers/registry.ts:94,143` (deepseek | mock) | (c) keys/budget for live verification + (a) adapters |
| MCP client runtime | `cline/apps/vscode/src/services/mcp/McpHub.ts` · `Roo-Code/src/core/tools/UseMcpToolTool.ts` · `codex/codex-rs/codex-mcp/` · `Dyad/src/mcp_oauth/` + `mcp_handlers.ts` | contract artifact `src/lib/types.ts:27`, DoD `src/lib/dod.ts:428`; declaration `src/lib/phases.ts:33` | (a) engineering, (b) trust-boundary decision |
| Repo index at scale | `Roo-Code/src/services/code-index/` (Qdrant + 8 embedders) · `aider/aider/repomap.py` (tree-sitter + cache) · `Dyad/src/ipc/processors/code_explorer.ts` | lexical only — `src/lib/knowledge.ts:19`, `algorithms.ts:512`; no embedding/AST index found | (b) determinism stance today / (a) AST pass tomorrow |
| Per-action allow-lists (autonomy granularity) | `codex-rs` approval×sandbox modes · `Roo-Code/src/core/auto-approval/` | phase-level only: `src/lib/phases.ts:150` `HITL_PHASES`, engine `:814/:898` | (b) product decision |
| IDE-native surface | cline/Roo VS Code extensions; Dyad/bolt.diy desktops | web console + 35-verb CLI (`src/components/console.tsx:132`) | (b) distribution, not mechanism |
| Patch-format breadth | `aider/aider/coders/` (20 formats) | `src/lib/patch.ts` (one typed primitive) | (a) engineering, low priority |
| E2E / mutation rails | `OpenHands/stryker.config.mjs`, `playwright*.config.ts`; `Roo-Code/apps/vscode-e2e`; `Dyad/e2e-tests/` | nothing matching Playwright/Stryker in-repo | (a) engineering |

---

## 7. Appendix — dataset inventory (one line each, with the sniff test that found it)

| clone | files measured on disk | first mechanism sniff (`command`) | verdict in matrix |
|---|---|---|---|
| aider 5dc9490 | 161 (parent) / 80 pkg `.py` | `ls aider/coders/` (20 formats); `repomap.py` | indexing, patch, verification rows |
| bolt.diy 2e254ac | 398 | `ls app/lib/modules/llm/providers/ \| wc -l` → 22 | providers, MCP, packaging, UI |
| ChatDev 4fb2db0 | 204 | `ls workflow/ runtime/node/executor/` | multi-agent (graph), sandbox (Docker file present) |
| cline 025baa8 | 3 077 | `grep -n 'while' sdk/packages/agents/src/agent-runtime.ts` | loop, permissions, MCP, compaction, tests |
| codex c56dda7 | 951 | `find codex-rs -type d -name '*sandbox*'` | sandbox (OS-level), patch (lark), MCP, multi-agent |
| continue 5522c6f | **0 code files** | `find continue -type f \( -name '*.ts' … \) \| wc -l` → 0 | **excluded (root-only checkout)** |
| developer a6747d1 | 21 | `ls developer/smol_dev developer/v0` | minimal single-loop demo; not matrixed |
| Devika 80bb343 | 85 | `ls -la Devika/src/sandbox/` → 0-byte files | sandbox-in-name-only finding |
| Dyad 43bdd75 | 2 512 | `ls src/ipc/processors/ src/ipc/handlers/compaction/` | patch (tags), verification (tsc), compaction, MCP, packaging, tests |
| gpt-engineer a90fcd5 | 84 | `ls gpt_engineer/core/` (`linting.py`, `version_manager.py`) | verification (lint), versioning |
| gpt-pilot 9b763fd | 327 | `ls core/agents/` (18 modules) | multi-agent, executor/bug_hunter, **FSL license flag** |
| MetaGPT 11cdf46 | 913 | `ls metagpt/roles metagpt/memory metagpt/actions` | multi-agent, memory, run_code |
| opencode 88c6c7a | 3 336 | `ls packages/opencode/src/{tool,permission,mcp}` | loop, permissions (rulesets), MCP, providers |
| OpenHands a040303 | 1 977 TS/TSX, 10 py | `head -12 README.md` → "Agent Canvas" | **frontend/control-center only** — UI row |
| pr-agent 785bb82 | 373 | `ls pr_agent/tools/ tests/` | PR-review agents, test discipline |
| Roo-Code b867ec9 | 1 566 | `ls src/services/code-index/ src/core/tools/` | indexing (Qdrant), tools, auto-approval, checkpoints |
| SWE-agent 3ea751c | 102 | `ls sweagent/tools/ sweagent/environment/` | loop, docker env, reviewer, linting tools |

**Command ledger (all read-only):** `git -C <clone> log -1 --format=%h`; `grep -m3 -iE 'MIT|Apache|…' <clone>/LICENSE*`;
`find <clone> -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.py' -o -name '*.js' \) -not -path '*/node_modules/*' | wc -l`;
`ls -la <dir>`; `grep -rn '<symbol>' <path>`; `head -N <file>`; `wc -l <file>`; `grep -c 'case "' scripts/rapidtool-cli.mjs`.
Nothing was executed from any clone; no clone file was modified; the only write anywhere is this dossier.

**Honest gaps in this dossier** (so nobody reads silence as absence): I did not open every one of the 17
clones to the same depth — `developer`, `pr-agent`, `gpt-engineer`, `ChatDev` and `SWE-agent` were sniffed
for the rows where they are strongest (agent loop, tests, verification, multi-agent) and not fully read;
`continue` is excluded (no code); OpenHands is UI-only on this disk. For any row, absence-of-evidence is
written as "nothing matching X in the files I searched (command shown)" and never as a factual "they lack X".
