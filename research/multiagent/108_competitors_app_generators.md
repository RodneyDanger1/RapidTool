# 108 — Open-Source Brief→App Generator Competitors: Architecture Extraction

**Status:** COMPLETE (per-competitor deep dives, head-to-head table, emitted-product evidence, ranked mechanisms)
**Author:** subagent lane 108
**Date:** 2026-09-16
**Scope:** READ-ONLY competitor research. Clones live in `C:\Users\mnril\rt-competitors\`, never inside the RapidTool repo.
Nothing from any clone was executed. No competitor code was copied into RapidTool.

## Method & evidence rules

- Every claim cites repo + file path.
- Claims that could not be confirmed against source are marked **UNVERIFIED**.
- Network facts for this host: `api.github.com`, `raw.githubusercontent.com`, `git clone --depth 1` work. `web_search`/`web_extract` NOT configured.

## Repos cloned

All clones are `git clone --depth 1` into `C:\Users\mnril\rt-competitors\` (outside the RapidTool repo).

| # | Repo | HEAD commit | Commit date | Size |
|---|------|-------------|-------------|------|
| 1 | gpt-engineer-org/gpt-engineer | `a90fcd543eedcc0ff2c34561bc0785d2ba83c47e` | 2024-11-17 | 32M |
| 2 | smol-ai/developer | `a6747d1a6ccd983c54a483c4a4fb1fa4bf740e82` | 2023-09-25 | 563K |
| 3 | Pythagora-io/gpt-pilot | `9b763fdaf0020c7d8abacc7b58b2b09e57494623` | 2026-06-12 | 3.2M |
| 4 | stackblitz-labs/bolt.diy | `2e254ac19a696394030601bc602f54945b12bfc4` | 2026-02-05 | 8.4M |
| 5 | geekan/MetaGPT | `11cdf466d042aece04fc6cfd13b28e1a70341b1f` | 2026-01-21 | 61M |
| 6 | OpenBMB/ChatDev (2.0 "DevAll") | `4fb2db0ea90375ce1059f44fe03ffbd191a7a169` | 2026-07-24 | 301M |
| 7 | stitionai/devika | `80bb343cbe4a4e5f5a0ba08d2524920139baceb6` | 2025-09-25 | small |
| 8 | dyad-sh/dyad | `43bdd75dd3bbdbb854ed6b76ec0abea3e6d2e637` | 2026-09-16 | large |
| — | OpenHands (clone found pre-existing in scratch dir) | `a0403035a20c91decadd011b907ee5b489f6788b` | 2026-09-16 | 28M |

**⚠️ SECURITY FINDING (report upstream, not a RapidTool defect).** `Pythagora-io/gpt-pilot` README carries an
active security notice: a supply-chain worm (credential stealer) was hidden in `core/telemetry/` from
2025-08-24 until 2026-06-11, executing whenever the program ran (it downloaded Bun and ran
`core/telemetry/_runtime.bin`). Repo is *no longer maintained*. **Verified clean in this clone:** the HEAD
commit is the removal commit (`Merge pull request #1183 … security/remove-malicious-telemetry-loader`),
`core/telemetry/` contains only `__init__.py`, and `_hooks.py` / `_runtime.bin` / `.loader.lock` are absent
(`find` + `git cat-file -t 065ee8eb` both negative). Do not vendor gpt-pilot code; read it as a design source
only. Nothing was executed from that clone.

---

## The 8-question extraction

### Q1. Brief → file plan
### Q2. File writing & *updating* an existing project
### Q3. Multi-file coherence
### Q4. Does it run/build the generated app?
### Q5. Test / eval strategy
### Q6. LLM provider abstraction + BYOK
### Q7. Cost / token caps + streaming
### Q8. Result presentation / review surface

---

## Per-competitor deep dives

### 1. gpt-engineer — `gpt-engineer-org/gpt-engineer` @ `a90fcd5` (2024-11-17)

**Q1 Brief → file plan — no plan step at all; plan and code come back in one response.**
`gpt_engineer/core/default/steps.py::gen_code` (line 121) makes ONE call:
`ai.start(setup_sys_prompt(preprompts), prompt.to_langchain_content(), step_name=curr_fn())`.
The system prompt is assembled in the same file (line 75):
`preprompts["roadmap"] + preprompts["generate"].replace("FILE_FORMAT", preprompts["file_format"]) + preprompts["philosophy"]`.
`gpt_engineer/preprompts/roadmap` is two lines: *"You will get instructions for code to write. You will write a very
long answer. Make sure that every detail of the architecture is, in the end, implemented as code."* There is no
decomposition agent, no task list, no file manifest. A **third** call in `gen_entrypoint` (line 153, `preprompts/entrypoint`)
turns the finished file dict into a Unix `run.sh` (install deps + run everything).

**Q2 File writing & update.**
- *Initial write*: whole files, parsed by regex from markdown — `gpt_engineer/core/chat_to_files.py::chat_to_files_dict`
  (line 38), pattern `(\S+)\n\s*```[^\n]*\n(.+?)``` `, into `FilesDict` (`gpt_engineer/core/files_dict.py`, a dict with
  str-key/str-value enforcement).
- *Update path (the interesting bit)*: `improve_fn` (steps.py line 271) swaps the system prompt to
  `preprompts/file_format_diff`, which demands **unified `git diff` syntax in fenced blocks** with explicit rules
  ("EACH LINE IN THE SOURCE FILES STARTS WITH A LINE NUMBER…", "ENSURE ALL CHANGES ARE PROVIDED IN A SINGLE DIFF CHUNK
  PER FILE"). Parsing: `parse_diffs` + `parse_diff_block` + `parse_hunk_header` (`chat_to_files.py:123-245`).
  Application: `apply_diffs` (line 69) with a `<REMOVE_LINE>` placeholder for deletions.
- *Hunk repair*: `gpt_engineer/core/diff.py` — `Hunk.check_start_line` / `find_start_line` (lines 122-198) **fuzzy-relocate
  a hunk whose line numbers drifted** by scanning the real file for a similar first line (`is_similar`), inserting a
  retained line if needed; `Diff.validate_and_correct` (line 340) also fixes overlapping hunks' line offsets.
  `salvage_correct_hunks` (steps.py line 341) collects the problems and `_improve_loop` (line 315) re-prompts with the
  error text up to `MAX_EDIT_REFINEMENT_STEPS = 2` (`gpt_engineer/core/default/constants.py`).
- *Safety net*: `stage_uncommitted_to_git` (`gpt_engineer/core/git.py:71`) git-stages existing uncommitted files before
  overwriting, and `Memory` keeps `IMPROVE_LOG_FILE` / `DIFF_LOG_FILE` copies of every prompt and diff
  (`gpt_engineer/core/default/paths.py`).

**Q3 Multi-file coherence — prompt-only.** Files are re-sent to the model *with line numbers*
(`FilesDict.to_chat`, `files_dict.py:55`) so diff hunks can address them. No type registry, no import graph, no compile
check. Coherence depends on the "philosophy"/"generate" preprompts plus the diff-repair retry loop.

**Q4 Does it run the app? Yes — and it fixes forward.**
`execute_entrypoint` (steps.py line 205) → `execution_env.upload(files_dict).run(f"bash {ENTRYPOINT_FILE}")` where the
default env is `DiskExecutionEnv` (`gpt_engineer/core/default/disk_execution_env.py` — real local subprocesses).
Line 251 prints the script and waits for `input("")` — a **human Y/n gate before any execution**.
`self_heal` (`gpt_engineer/tools/custom_steps.py:40`) is the fix-forward loop: runs the entrypoint, and while
`returncode not in (0, 2)` feeds `stdout` + `stderr` into `improve_fn`, up to **`MAX_SELF_HEAL_ATTEMPTS = 10`** (line 19).
It assumes the previous step was `gen_entrypoint` (documented in the docstring). A `file_format_fix` preprompt exists too.

**Q5 Tests — none generated.** The bar is "the entrypoint exits 0". `gpt_engineer/core/linting.py` runs `black` and
silently returns the input on any failure ("handling all exceptions silently"). The CLI lints selected files before an
improve pass (`applications/cli/main.py:523`). `gpt_engineer/benchmark/` (apps, mbpp, gptme loaders) measures the *tool*,
not the emitted product.

**Q6 Provider abstraction.** `gpt_engineer/core/ai.py` — class `AI(model_name="gpt-4-turbo", temperature=0.1)`;
`_create_chat_model` (line 330) branches to `AzureChatOpenAI` / `ChatOpenAI` / a `claude` branch; API keys come from env.
Rate limits: `@backoff.on_exception(backoff.expo, openai.RateLimitError, max_tries=7, max_time=45)` (line 253).
There is also a `ClipboardAI` subclass (line 386) that serialises messages to the clipboard for manual paste — a
zero-key fallback mode.

**Q7 Cost/token.** `gpt_engineer/core/token_usage.py`: `Tokenizer` (tiktoken, `encoding_for_model` with
`cl100k_base` fallback), `TokenUsage` per step, `TokenUsageLog.update_log(messages, answer, step_name)` per call,
`usage_cost()` in USD via LangChain's `get_openai_token_cost_for_model`. **No hard budget cap and no cancellation** —
cost is reported after the fact. No streaming (whole messages returned).

**Q8 Review surface.** CLI + files on disk. Improve mode adds an interactive file picker
(`gpt_engineer/applications/cli/file_selector.py`, `FileSelector.ask_for_files` → TOML) so the user chooses which existing
files the model may see and edit; `applications/cli/collect.py` gathers them. No diff-review UI, no preview.
There is a `clarified_gen` step (`tools/custom_steps.py:122`) that asks the user clarifying questions *before* generating
(breaks out on "nothing to clarify", or lets the model "make its own assumptions and state them explicitly").

**Emitted-product evidence.** No example generated apps are shipped in the repo. Outputs land in
`<project>/<prompt-name>/` with `run.sh`, code files and `logs/` (see `core/default/paths.py`).

---

### 2. smol-developer — `smol-ai/developer` @ `a6747d1` (2023-09-25)

**Q1 — the cleanest 3-step brief→plan decomposition in the set.** `smol_dev/api.py` (agent_protocol Steps):
`PLAN` → `_generate_shared_deps` (line 17) → `SPECIFY_FILE_PATHS` → `_generate_file_paths` (line 31) →
one `Generate code for <file>` step per file → `_generate_code` (line 58). Prompts live in `smol_dev/prompts.py`
(`plan`, `specify_file_paths`, `generate_code`).

**Q2 File writing.** Whole-file, one file per call: `write_file(os.path.join(Agent.get_workspace(task.task_id), file_path), code)`
(`api.py:65`), then registers an agent_protocol artifact (lines 67-72). **No update path whatsoever** — no diff mode, no
re-read of existing files, no improve loop.

**Q3 Coherence — `shared_deps.md`, an LLM-written interface registry.** The plan prompt (`prompts.py:73`) instructs:
*"Begin with a YAML description of the new files that will be created. In this plan, please name and briefly describe the
structure of code that will be generated, including, for each file we are generating, what variables they export, data
schemas, id names of every DOM elements that javascript functions will use, message names, and function names."*
That plan text is then injected into **every** per-file call (`prompts.py:128`: `"the plan we have agreed on is: {plan}"`)
and `generate_code` re-states "do not stray from the names of the files and the plan we have decided on" (line 141).
It is a *natural-language* contract — nothing machine-checks it.

**Q4 Runs the app? No.** Nothing installs, builds, serves or opens the output.

**Q5 Tests? No.** The bar is plan adherence by construction.

**Q6 BYOK.** Each prompt function takes `model: str = 'gpt-3.5-turbo-0613'` (`prompts.py:35, 62, 103`), `main.py --model`;
direct OpenAI calls, no provider abstraction.

**Q7 Streaming, no caps.** `stream_handler: Optional[Callable[[bytes], None]]` parameters on `plan` / `generate_code`
(`prompts.py:62, 103`) let an embedder stream tokens (e2b / devlooper badges in `readme.md`).

**Q8 Review surface.** CLI or library; the repo doubles as a **published agent** — `Agent.setup_agent(task_handler, step_handler).start()`
(`api.py:93`) so the same pipeline runs inside another host's UI.

**Emitted-product evidence (real, in-tree).** `examples/v1_pong_game/` — 4 files, 231 lines total incl. the plan:
`index.html` 14, `style.css` 38, `main.js` 122, `ai.js` 22, `shared_deps.md` 35. The plan
(`examples/v1_pong_game/shared_deps.md`) enumerates DOM ids (`gameArea`, `playerPaddle`, `aiPaddle`), variables
(`playerPaddle`, `aiPaddle`, `ball`, `score`), every function with its role, and closes with a compatibility decision:
*"The JavaScript files are written in a manner that doesn't use the import/export keywords and only uses features
supported by the Chrome browser"*. There is **no package.json, no build step, no dependencies** — a zero-install
static app. That is what "it ran first try" looks like when the generator refuses to emit anything that needs installing.

---

### 3. gpt-pilot — `Pythagora-io/gpt-pilot` @ `9b763fd` (2026-06-12, unmaintained)

*(Read as a design source only — see the security finding above.)*

**Q1 Brief → plan — a full company with typed steps.** Wizard → spec → architecture → task list → per-task **steps**:
`core/agents/{wizard,spec_writer,architect,tech_lead,developer,code_monkey,executor,error_handler,bug_hunter,troubleshooter}.py`.
The decisive detail is that the plan is **schema-typed, not prose** — `core/agents/developer.py:32-81`:
`StepType{command, save_file, human_intervention, utility_function}` and the union `Step` of
`SaveFileStep | CommandStep | HumanInterventionStep | UtilityFunction` plus `TaskSteps{steps: list[Step]}`, parsed from
the model with `parser=JSONParser(TaskSteps), temperature=0` (line 296). `remove_duplicate_steps` (line 330) drops
duplicate `save_file` paths. Truncated responses are repaired by string surgery: if the tag counts don't match
(`has_correct_num_of_tags`, line 84), it re-prompts "continue but don't implement any files that have already been
implemented" and splices at `response.rfind("<pythagoracode file")` (lines 265-282).

**Q2 File writing & update — rewrite-with-context, DB-backed, LLM-reviewed.** `core/agents/code_monkey.py::implement_changes`
(line 81): reads the current file from the DB state, sends `file_content` + instructions to the model, gets a **complete
new file**, and `accept_changes` (line 213) computes `get_line_changes(old, new)`, calls
`ui.generate_diff(file_path, old, new, n_new_lines, n_del_lines)`, then `state_manager.save_file(file_path, new_content)`.
So: whole-file writes, but *always with the previous file in-prompt* and *always diffed for the user*.
An optional fast-apply model path exists first: if the model emitted an edit snippet and a token is present, it calls
**Relace** (`core/llm/relace_client.py`) with `{initialCode, editSnippet}` and falls back to OpenAI on any failure
(lines 118-152). Automatic review loop: `ReviewChanges{hunks: list[Hunk]}` where each `Hunk` carries
`decision: apply|ignore|rework` + a reason (lines 41-49); `MAX_CODING_ATTEMPTS = 3` (line 32) bounds the rework cycle.
Because project state is in the DB (`core/db/models/{project,project_state,file,file_content,branch,chat_message,llm_request}.py`,
`core/state/state_manager.py`), resuming/updating an existing project is the normal case, not a special mode.

**Q3 Coherence.** (a) **Per-file LLM-written interface record**: `FileDescription{summary, references: list[str]}`
(`code_monkey.py:52`) where `references` = "List of references the file imports or includes (only files local to the
project)" — written into `file.content.meta` by `describe_file` (line 186), computed lazily for every file that has no
description (line 160). (b) `RelevantFilesMixin` (`core/agents/mixins.py`) selects the per-task relevant file set
(`current_state.relevant_files`, `ALWAYS_RELEVANT_FILES` is always appended). (c) `UtilityFunction` steps carry
`status: mocked | implemented` — interface-first stubbing. (d) Templates carry export-level descriptions (below).

**Q4 Runs the app — yes, real commands, with an error loop.** `core/agents/executor.py`:
`status_code, stdout, stderr = await self.process_manager.run_command(cmd, timeout=timeout)` (line 107), plus
`output_handler` / `exit_handler` / `check_command_output`. Failures route to `core/agents/error_handler.py`
(`handle_command_error(message, details)`, with `attempts`), `bug_hunter.py` and `problem_solver.py`.

**Q5 Tests — no generated suite.** Verification is bounded to: command exit status, the error-handler retry loop, the
LLM diff reviewer (apply/ignore/rework) and `bug_hunter`. `core/prompts/` has `bug-hunter/` and `problem-solver/`
prompt packs (their output format was not read — **UNVERIFIED** whether they emit test files).

**Q6 BYOK.** `core/llm/`: `base.py`, `openai_client.py`, `anthropic_client.py`, `azure_client.py`, `groq_client.py`,
`relace_client.py`; `LLMProvider` enum at `core/config/__init__.py:70` = `{openai, relace, anthropic, groq, lm-studio, azure}`.
Per-agent model choice (`self.get_llm(AGENT_NAME)` with constants like `CODE_MONKEY_AGENT_NAME`,
`DESCRIBE_FILES_AGENT_NAME`, `PARSE_TASK_AGENT_NAME`), `base_url` override for local servers, and
rate-limit header parsing for Anthropic (`anthropic_client.py:127-139`).

**Q7 Cost.** Every request is persisted (`core/db/models/llm_request.py`). No global hard cap was found in the files read
— **UNVERIFIED**. No stream-token UI; the UI gets phase/action strings (`DEV_TASK_START`, `CM_UPDATE_FILES`) and
per-file status events.

**Q8 Review surface — built for a GUI client.** `core/ui/{base,console,ipc_client,virtual}.py` with
`UIAdapter{plain, ipc-client, virtual}` (`core/config/__init__.py:83`). Events include
`send_file_status(path, "creating"|"updating"|"reworking"|"done")`, `generate_diff(...)`, `start_breakdown_stream()`,
and `AgentResponse.input_required(...)` when `state_manager.get_input_required(new_content, path)` finds placeholders
(e.g. an API key) that only a human can fill (`code_monkey.py:225-232`).

**Template evidence (brief→file plan seed).** `core/templates/base.py::BaseProjectTemplate` holds
`description`, `options_description`, `file_descriptions: dict`; `apply()` (line 81) renders a Jinja tree
(`core/templates/render.py::render_tree`) using the spec's `project_description` and then saves **each file with its
description as metadata** (`base.py:110-112`; `metadata = {"description": desc}`). `core/templates/vite_react.py`
documents ~40 files at export granularity, e.g. `"client/src/components/ui/button.tsx": "Shadcn Button component.
Exports Button, buttonVariants."` and `"client/src/App.tsx": "Main React component with the routing structure - this file
is very important as it shows which pages are opened on which routes."`. Only `VITE_REACT` is active in
`core/templates/registry.py:20` (the other four are commented out).

---

### 4. bolt.diy — `stackblitz-labs/bolt.diy` @ `2e254ac` (2026-02-05)

**Q1 Brief → plan.** No plan step. A single system prompt defines a **structured output protocol**:
`app/lib/common/prompts/prompts.ts::getSystemPrompt` — "CRITICAL: You MUST always follow the `<boltArtifact>` format"
(line 45); artifacts contain `<boltAction type="file|shell|supabase" …>`; **"For updates, reuse the prior identifier"**
(line 337); "The order of the actions is VERY IMPORTANT… you need to create it before running a shell command that would
execute the file" (line 358). `optimized.ts` is a smaller variant; `discuss-prompt.ts` for read-only discussion mode.

**Q2 File writing & update — whole-file writes, chosen deliberately.** prompts.ts line 37:
*"IMPORTANT: WebContainer CANNOT execute diff or patch editing so always write your code in full no partial/diff update"*.
Applied by `app/lib/runtime/action-runner.ts` → `await webcontainer.fs.writeFile(relativePath, action.content)` (line 334)
after creating folders (line 328). The *update* story is instead: (a) artifact-id reuse in the prompt, (b) a **snapshot map**
in `app/lib/stores/files.ts` — `#modifiedFiles: Map<path, originalContent>` is seeded on every `saveFile` (line 550, 568),
exposed via `computeFileModifications` (line 520) using `app/utils/diff.ts` (`diffFiles`, `fileModificationsToHTML`),
and rendered by `app/components/workbench/DiffView.tsx`; (c) `workbenchStore` "lock/unlock" on files and folders
(`LockManager.tsx`, `workbenchStore.lockFile`) so the agent cannot silently overwrite user edits.

**Q3 Coherence.** (a) `app/lib/.server/llm/select-context.ts` — an LLM picks a **context buffer capped at 5 files**
(lines 152-167: "Only 5 files can be placed in the context buffer at a time", "context buffer is extremlly expensive",
"should not include any file that is already in the context buffer"), with a chat summary (`create-summary.ts`) and
explicit deletion of dropped paths (line 197). (b) The system prompt orders "Review ALL previous file changes and user
modifications (as shown in diffs, see diff_spec)" (line 323). (c) No import registry and no type check — coherence rests
on context selection + artifact-id continuity.

**Q4 Runs the app — yes, in the browser, and it fixes forward on build failure.**
`app/lib/webcontainer/index.ts` gives a real Node toolchain in-browser; shell actions run `npm install` / `npm run dev`;
`case 'build'` spawns `webcontainer.spawn('npm', ['run', 'build'])` (action-runner.ts line 395) and on failure flips the
action to `status: 'failed'` with the error text and pushes a `type: 'error'` message into the chat (lines 198-243), so
the model sees the failure in the next turn. `StreamRecoveryManager`
(`app/lib/.server/llm/stream-recovery.ts`: `maxRetries: 3`, 30s inactivity timeout, `onTimeout`/`onRecovery`) resumes
stalled generations. `app/lib/runtime/message-parser.ts::StreamingMessageParser` (line 76) emits
`{artifactId, actionId, action, status}` events while tokens stream, so each file write / shell command shows live status.

**Q5 Tests — none generated.** The bar is "the build produces no error and the preview renders". There is a
`ScreenshotSelector.tsx` for the human to send a UI screenshot back into the conversation (visual, human-driven).

**Q6 BYOK — the deepest provider surface in the set.** 21 provider modules in `app/lib/modules/llm/providers/`
(including `deepseek.ts`, `ollama.ts`, `lmstudio.ts`, `openai-like.ts`, `open-router.ts`, `amazon-bedrock.ts`, …),
registry `app/lib/modules/llm/manager.ts::LLMManager`, browser-side key storage in
`app/lib/stores/settings.ts` `localStorage` with `LOCAL_PROVIDERS` / `URL_CONFIGURABLE_PROVIDERS`, plus server-detected
providers auto-enabled via `/api/configured-providers` (line 70).

**Q7 Cost/streaming.** Streaming is the primary UI mechanism (per-action status, above). No token budget or cost
accounting was found in the files read — **UNVERIFIED** (there is no `cost`/`usage` hit in
`app/lib/.server/llm/utils.ts` or `stream-text.ts`).

**Q8 Review surface — the strongest of the five.** A real workbench: `FileTree.tsx`, `EditorPanel.tsx`,
`DiffView.tsx`, `Terminal`, `Preview.tsx` (sandboxed iframe, `reloadPreview()`, `/webcontainer/preview/<id>` routes),
`PortDropdown.tsx` (multiple dev-server ports), `Inspector.tsx` (click an element in the preview → its info goes into
the chat), `LockManager.tsx`, git export/push and Netlify/Vercel deploy stores (`app/lib/stores/{netlify,vercel,github}.ts`).

---

### 5. MetaGPT — `geekan/MetaGPT` @ `11cdf46` (2026-01-21)

**Q1 Brief → plan — SOP with named artifacts, each committed.** `metagpt/actions/write_prd.py`,
`design_api.py` (+ `design_api_review.py`), `project_management.py` (task list JSON), `write_code.py`,
`write_code_review.py`; roles `metagpt/roles/{product_manager,architect,project_manager,engineer,qa_engineer}.py`;
entry point `metagpt/team.py::Team.run_project(idea)` / `hire(roles)`. Each artifact is a file in the project git repo:
`metagpt/utils/project_repo.py` maps repo *relative paths* per artifact class
(`PRDS_FILE_REPO`, `SYSTEM_DESIGN_FILE_REPO`, `TASK_FILE_REPO`, `CODE_SUMMARIES_FILE_REPO`,
`CODE_PLAN_AND_CHANGE_FILE_REPO`, `GRAPH_REPO_FILE_REPO`, `CLASS_VIEW_FILE_REPO`, … lines 56-89).

**Q2 File writing & update — full-file writes into git, plus a first-class incremental mode.**
`WriteCode.get_codes(task_doc, exclude, project_repo, use_inc)` (`metagpt/actions/write_code.py:168`) optionally feeds
existing code back. The incremental mechanism is explicit: the model first writes a **"Code Plan And Change"** document
whose specified format is literally git-diff marks — `metagpt/actions/write_code_plan_and_change_an.py` lines 34-46 show
the ```` ```diff ```` example with `- def sub(...)` / `+ def subtract(...)`, and the merge instruction at line 199:
*"Follow Code Plan And Change: If there is any 'Incremental Change' that is marked by the git diff format with '+' and
'-' symbols, or Legacy Code files contain '{filename} to be rewritten', you must merge it into the code file"*.
Version control: `metagpt/utils/git_repository.py` — `add_change()`, `commit()`, `changed_files()` (line 142),
`archive(comments)` (line 237, commits everything), `get_dependency()`, `new_file_repository()`.

**Q3 Coherence — a persisted dependency graph, not just prompt discipline.**
`Engineer._act_sp_with_cr` (`metagpt/roles/engineer.py:116-150`): after (optionally) `WriteCodeReview`, it computes
`dependencies = {design_doc, task_doc [, code_plan_and_change_doc]}` and calls
`repo.srcs.save(filename=…, dependencies=list(dependencies), content=…)` (lines 139-146). Those edges land in
`metagpt/utils/dependency_file.py::DependencyFile` (`load`/`save`/`update(filename, dependencies)`/`get`) — a JSON graph
of file→dependencies alongside the code, fed back into context selection. Second gate: `WriteCodeReview` /
`ValidateAndRewriteCode` (`metagpt/actions/write_code_review.py`) iterates review→rewrite until the reviewer answers
**LGTM** (lines 152, 206-224) — a self-review loop with an explicit pass token.

**Q4 Runs the app — yes, via subprocess with dependency/pytest installs.**
`metagpt/actions/run_code.py::run_script(working_directory, additional_python_paths, command)` (line 92) with
`_install_requirements` / `_install_pytest` / `_install_dependencies` (lines 154-171); error handling in
`metagpt/actions/debug_error.py` and `fix_bug.py`; a QA role exists (`roles/qa_engineer.py`).
The exact test→fix iteration wiring was **not** read end-to-end — **UNVERIFIED**.

**Q5 Tests.** pytest is installed as part of the run path (`run_code.py:165`), i.e. verification is anchored on a real
test runner; whether the system *authors* new test files is **UNVERIFIED**. Quality gates that definitely exist:
`write_code_review` (LGTM loop), `write_docstring`, and per-file `SummarizeCode`.

**Q6 BYOK.** `metagpt/config2.py` — `Config`/`LLMConfig` (`api_type`, `api_key`, `base_url`, `model`), YAML-loadable
(`metagpt/configs/`), with per-role overrides; registry `metagpt/provider/llm_provider_registry.py`; providers include
`openai_api`, `azure_openai_api`, `anthropic_api`, `ollama_api`, `dashscope_api`, `zhipuai_api`, `google_gemini_api`,
`ark_api`, `bedrock_api`, `openrouter_reasoning`, `human_provider`.

**Q7 Cost — the only real budget gate in the set.** `metagpt/utils/cost_manager.py::CostManager`
(`max_budget: float = 10.0`, `total_cost`, `token_costs: dict = TOKEN_COSTS`) with
`update_cost(prompt_tokens, completion_tokens, model)` logging
`"Total running cost: $… | Max budget: $… | Current cost: $…"`; subclasses `TokenCostManager` and
`FireworksCostManager` (grade-based pricing). `metagpt/team.py::Team.invest(investment)` sets
`cost_manager.max_budget` (lines 92-96) and `_check_balance()` is the enforcement point.

**Q8 Review surface.** CLI-first (`metagpt/software_company.py`), no app preview. What it *does* surface: the project
git repo (docx/PDF exports of PRD & design under `RESOURCES_FILE_REPO`, `custom_repo.py` helpers shown in
`project_repo.py:80-89`), Mermaid/diagram rendering (`metagpt/utils/mermaid.py`, `mmdc_ink.py`, `mmdc_playwright.py`)
and `Team.serialize/deserialize` (lines 59-68) so an external UI can snapshot a run.

---

### 6. ChatDev 2.0 "DevAll" — `OpenBMB/ChatDev` @ `4fb2db0` (2026-07-24)

**Q1 Brief → plan — a declarative YAML graph, and the pipeline is data, not code.**
`yaml_instance/*.yaml` define `graph.nodes[]` and edges; node types are resolved by
`runtime/node/executor/factory.py` and `runtime/node/builtin_nodes.py`: **agent, human, loop_counter, loop_timer,
literal, python, passthrough, subgraph**. Edges carry conditions and processors
(`workflow/edge/conditions/` with `keyword_manager.py` / `function_manager.py` / `registry.py`, and
`workflow/edge/processors/{regex_processor,function_processor}.py`). `yaml_instance/ChatDev_v1.yaml` re-expresses ChatDev
v1 (planning/coding/review/testing) as a graph, including
`Code Complete All Phase Loop Counter → max_iterations: 5`, `Test Phase Loop Counter → max_iterations: 3`,
`is_majority_voting: false`.

**Q2 File writing.** Node-level: `runtime/node/executor/python_executor.py` extracts a code segment from an agent
message, `_write_script_file(...)` into the workspace and runs it; `runtime/node/executor/agent_executor.py:1120` writes
target files (`open(target_path, "wb")`). The per-file *edit* strategy (diff vs full rewrite) was **not** isolated —
**UNVERIFIED**. What is certain is the composition model: subgraphs (`subgraph_executor.py`, `subgraph_loader.py`),
per-node `context_window` (declared in the YAML, e.g. `context_window: 0`), and bounded cycles
(`workflow/graph_manager.py::_detect_cycles`, `_build_cycle_execution_order`).

**Q3 Coherence.** Topology is the contract: nodes are typed, edges conditional, loops bounded by counters, and each node
declares how much context it consumes. Reuse is explicit via subgraph nodes; `workflow/executor/resource_manager.py`
governs scarce resources; `entity/graph_config.py` + `schema_registry/` validate configs.

**Q4 Runs.** `python_executor.py` runs code in a subprocess with a timeout and `_build_failure_message` on failure
(lines 95-169) — so a failing node becomes a message that later nodes can act on. Loop counters/timers exist precisely to
bound retries (`loop_counter_executor.py`, `loop_timer_executor.py`).

**Q5 Tests.** The test phase is *structural*: `yaml_instance/ChatDev_v1.yaml` declares a Test Phase behind a
`max_iterations: 3` loop counter — the fix-retry budget is configuration, not prompt convention.
Whether it emits test files: **UNVERIFIED**.

**Q6 BYOK.** `runtime/node/agent/providers/` (provider base + implementations) with per-node model/provider config;
server-side config schema at `server/config_schema_router.py`, `server/settings.py`. `.env`-driven keys.

**Q7 Cost.** No cost manager equivalent to MetaGPT's was found — **UNVERIFIED**. Effort is bounded by loop counters.

**Q8 Review surface — a shipping product, not a script.** `server/` (FastAPI: `app.py`, `routes/`, `services/`, `state.py`),
`frontend/`, `compose.yml` / `Dockerfile`, run via `run.py` / `server_main.py`. **Human is a node type**:
`runtime/node/executor/human_executor.py` and `yaml_instance/demo_human.yaml`; `blender_3d_builder_hub_auto_human.yaml`
shows auto-human nodes — i.e. gates are placed *in the graph*, at any point, per workflow.

---

### 7. Devika — `stitionai/devika` @ `80bb343` (2025-09-25)

**Q1 Brief → plan — an agent-selection loop, documented.** `ARCHITECTURE.md` describes the core: prompt → Planner →
Researcher → web search + crawl → Formatter → Coder/Patcher/…, with the `Agent.execute` loop in `src/agents/agent.py`
and a dedicated **Decision** agent choosing the next sub-agent each turn. Sub-agents:
`src/agents/{planner,researcher,coder,action,runner,feature,patcher,reporter,decision,formatter,internal_monologue}/`.

**Q2 File writing & update — two distinct paths.** (a) `coder` writes whole files; (b) `patcher` edits an existing
project: `src/agents/patcher/prompt.jinja2` embeds the full conversation, `code_markdown` of the whole project, the
commands previously tried and — when present — *the error output*, then `patcher.py::save_code_to_project(response, project_name)`
(line 69) writes each `{filename, code}` back. Project state is persistent and first-class:
`src/project.py` — `Projects(SQLModel, table=True)` with `message_stack_json`, per-project directory
(`get_project_path`), file listing (`get_project_files`) and zip export (`project_to_zip`).

**Q3 Coherence.** `src/filesystem/read_code.py::{read_directory, code_set_to_markdown}` re-reads the project and injects
it as markdown before patching; `src/memory/` provides retrieval. No import graph, no type check, no compile gate.

**Q4 Runs.** `src/agents/runner/runner.py` (+ `rerunner.jinja2`) executes commands and captures errors for the
error-driven patch loop; `src/sandbox/{code_runner.py,firejail.py}` sandboxes execution; `src/browser/` drives Playwright.

**Q5 Tests.** No generated tests found — **UNVERIFIED**; the runner/error→patch loop is the verification mechanism.

**Q6 BYOK.** `src/llm/llm.py::LLM` maps model names to clients: `openai_client.py`, `claude_client.py`,
`gemini_client.py`, `groq_client.py`, `mistral_client.py`, `ollama_client.py` (live local model list, line 70),
`lm_studio_client.py`; `model_enum()` resolves a chosen model to a client. Config: `src/config.py` + `sample.config.toml`.

**Q7 Cost.** None found — **UNVERIFIED**. Live progress instead of cost: socket.io streaming
(`src/socket_instance.py`) of the agent's reasoning via the `internal_monologue` agent.

**Q8 Review surface.** A full web app: `ui/` (React) + `src/services/` (FastAPI) + `docker-compose.yaml`; the UI shows
the internal monologue live, browser screenshots, project file tree, and the action log.

---

### 8. Dyad — `dyad-sh/dyad` @ `43bdd75` (2026-09-16 — HEAD is same-day; the most current comparator)

**Q1 Brief → plan — modes + an approved plan + an app blueprint.** `src/prompts/system_prompt.ts`,
`plan_mode_prompt.ts`, `local_agent_prompt.ts`; chat modes Agent/Build/Ask/Plan (`rules/chat-modes.md`);
plan persisted and gated (`src/ipc/handlers/plan_handlers.ts`, `planUtils.ts`, `planPersistence.ts`,
`plan_handoff/`), app-level blueprint (`app_blueprint_handlers.ts`), app naming (`app_naming_handlers.ts`).

**Q2 File writing & update — the richest tag protocol in the set: whole-file *and* edit-in-place.**
`src/ipc/processors/response_processor.ts` recognises seven action families (lines 75-101):
`write`, `rename`, `delete`, `add-dependency`, `execute-sql`, `search-replace`, `copy`.
Edits use `applySearchReplace` (imported line 52 from `pro/main/ipc/processors/search_replace_processor`), and —
critically — there is a **dry run first**: `dryRunSearchReplace({fullResponse, appPath})` (line 103) iterates every
search-replace tag, reads the target file, and records issues (`"Search-replace target file does not exist"`,
`"Unable to apply search-replace to file because: " + result.error`) *before* anything is committed.
Failures come back to the model through the chat as structured tags —
`<dyad-output type="warning"|"error" message="…">…</dyad-output>` (lines 836-842) — which is the repair channel.
When a search-replace cannot apply, the system explicitly attempts a `<dyad-write>` fallback ("Do not show warning to user
because we already attempt to do a `<dyad-write>` tag to fix it", lines 535-544).

**Q3 Coherence — an actual type-check of the emitted app.** `src/ipc/processors/tsc.ts` runs TypeScript over the
generated project: `CONFIG_NAMES = ["tsconfig.app.json", "tsconfig.json"]` (line 150),
`parseTypeScriptDiagnosticsDetailed` → `problems: ParsedDiagnostic[]` (lines 217-269),
`TypeCheckPreconditionKind` (`no-typescript` / `tsconfig-not-found` / …) with human/LLM-facing guidance
(`getTypeCheckPreconditionGuidance`: *"Type checking could not run: TypeScript is installed but no tsconfig was found
(expected `tsconfig.app.json` or `tsconfig.json`). You can create a suitable tsconfig for this project and retry."*),
output capped at `TSC_MAX_OUTPUT_BYTES = 4 * 1024 * 1024`. Results surface in the app via
`src/ipc/handlers/problems_handlers.ts`. Context selection is retrieval-based:
`src/ipc/processors/code_explorer.ts` (+ `code_explorer_compiler.ts`, `code_explorer_eviction.ts` and their tests) builds a
codebase index with an eviction policy, and prompt size is pre-computed against the model's window in
`src/ipc/handlers/token_count_handlers.ts` using `src/ipc/utils/token_utils.ts::{estimateTokens, getContextWindow}`.

**Q4 Runs the app — three layers, all real.** (a) Dependency install as a first-class action:
`src/ipc/processors/executeAddDependency.ts` (package-spec validation, duplicate detection, pnpm/npm handling,
`recordAndReportDeniedPnpmBuilds`). (b) A managed preview: `src/preview_iframe/{manager,controller,commands,state}.ts`
plus console capture in `src/preview_console/{store,hooks}.ts` with a bounded
`MAX_PREVIEW_CONSOLE_MESSAGE_BYTES` buffer (`src/lib/preview_console_buffer`) and `preview_view_handlers.ts`.
(c) **Real E2E against the running app**: `src/ipc/handlers/tests_handlers.ts` locates spec files in the app
(`listSpecFiles(appPath)`, `readSpecTestCases`), builds a Playwright CLI invocation (`buildPlaywrightCliInvocation`,
`@playwright` CLI, line 252-271), needs a running base URL (`getRunningTestBaseUrl(appId)`, line 215), runs in parallel
workers (`parallelWorkerCount`), rotates preview views between batches (`runPreviewTestBatch`, `rotatePreviewView`), and
classifies timeouts as infra errors with a user-facing message
(`"The test run exceeded the N-minute limit and was stopped before it could finish."`).

**Q5 Tests — the only project here that closes the loop end-to-end.** Record → human-approve → synthesise Playwright →
run against the live preview. `src/lib/test_recorder/` (`assertion_proposal.ts`, `assertion_code.ts`, `assertion_tag.ts`)
+ `src/ipc/handlers/test_assertion_handlers.ts`: approving an **assertion card** is the only way a recorded statement
becomes a spec file (documented at lines 78-81), and on approval
`src/prompts/test_assertions_prompt.ts` converts each plain-English assertion into **exactly one** grounded Playwright
assertion, with hard honesty rules: "Never invent text, URLs, counts, roles, or test ids that do not already appear in
the statements or in the description itself" and "If you cannot ground a description in the test, OMIT that entry rather
than guessing". There is also a `security_review_prompt.ts` and CI-side `e2e-tests/` with `playwright.config.ts`.

**Q6 BYOK.** Provider set in `src/lib/schemas.ts` (`openai`, `anthropic`, … `openrouter`, `ollama`, `lmstudio`);
local-model handlers `src/ipc/handlers/local_model_handlers.ts`,
`local_model_lmstudio_handler.ts`, `local_model_ollama_handler.ts`; hosted/hybrid routing plus a free tier quota
(`free_model_quota_handlers.ts`); settings via `settings_handlers.ts`.

**Q7 Cost/token + compaction.** `token_count_handlers.ts` handler `chat:count-tokens` counts input + system prompt +
mentioned app codebases and compares with `getContextWindow` (lines 80-258) — a **pre-flight budget in the UI**;
conversation compaction under `src/ipc/handlers/compaction/` with `src/prompts/compaction_system_prompt.ts` and
`MAX_CHAT_TURNS_IN_CONTEXT` (`src/constants/settings_constants.ts`); chat streaming in `src/chat_stream/` +
`chat_stream_handlers.ts` (tested by `chat_stream_redo`, `chat_turn_acceptance`, `chat_stream_external_admission` tests).

**Q8 Review surface — the closest thing to RapidTool's console, plus git-per-message history.**
Electron shell: file tree, preview iframe + console tail, problems panel, plan/assertion **proposal cards** requiring
human approval, screenshot capture (`src/screenshot/`), recording (`recording_handlers.ts`), and
**version history with a git commit per assistant message** — `src/ipc/handlers/version_handlers.ts` (`commitHash` stored
on assistant messages, `revertVersion`, `restoreToMessage`, `checkoutVersion`, plus honest failure messaging such as
"Restored your code to this version, but the database could not be restored: this version is older than your database's
restore window"). Behavior is steered by a versioned in-repo rule set (`rules/*.md`, indexed by the repo's own
`AGENTS.md`) — a governance pattern, not code.

---

### 9. OpenHands — `All-Hands-AI/OpenHands` @ `a040303` (2026-09-16) — **partial, UI-surface only**

The clone in the shared scratch dir is **not** the Python agent runtime: `git remote -v` = `All-Hands-AI/OpenHands`,
but `package.json` name is `@openhands/agent-canvas`, "Agent Canvas UI for OpenHands - run AI coding agents with a
visual interface", and there is no `openhands/` Python package. Evidence gathered: `specs/` holds shipped design
specs — `llm-defaults.md`, `mcp-settings.md`, `backend-management.md`, `canvas-extensions.md`,
`workspace-upload-path.md`; `src/` = api/components/contexts/extensions/fixtures/mocks/hooks/i18n/lib/manifests;
`playwright.mock-llm.config.ts` plus `playwright.live.config.ts` (two-mode E2E: mocked LLM vs live). The 8-question
treatment for OpenHands was **NOT completed** in this lane — treat it as a review-surface comparator
("LLM defaults and MCP settings are published as specs; E2E has a mock-LLM mode") and a follow-up task.
**UNVERIFIED for all of Q1–Q5.**

---

## Head-to-head table

Cell = the answer + the file that proves it. `—` = not present in that repo.

| Question | gpt-engineer | smol-developer | gpt-pilot | bolt.diy | MetaGPT | ChatDev 2.0 | Devika | Dyad |
|---|---|---|---|---|---|---|---|---|
| **Q1 Brief→plan** | none — plan+code in one call `core/default/steps.py:121` | 3 steps: plan → file_paths → per-file `smol_dev/api.py:17,31,58` | spec→arch→tasks→typed **steps** `core/agents/developer.py:32-81` | none; prompt-defined artifact protocol `prompts/prompts.ts:45` | SOP artifacts PRD→API→tasks `actions/{write_prd,design_api,project_management}.py` | declarative **YAML graph** `yaml_instance/ChatDev_v1.yaml` | planner→researcher→…→decision agent loop `src/agents/agent.py` | plan mode + blueprint + approval `ipc/handlers/plan_handlers.ts`, `app_blueprint_handlers.ts` |
| **Q2 Write / **update**** | whole-file gen; **git-diff hunks** on improve, hunks fuzzy-repaired `core/diff.py:122-198` | whole-file only, **no update path** `api.py:65` | per-file **rewrite with old content in-prompt**, LLM-reviewed apply/ignore/rework `agents/code_monkey.py:81-232` | whole-file **by design** (`prompts.ts:37`); snapshot+DiffView+lock `stores/files.ts:550` | full-file + **Code Plan And Change** in git-diff marks `actions/write_code_plan_and_change_an.py:34-46` | node-level writes; edit strategy UNVERIFIED `runtime/node/executor/{python,agent}_executor.py` | coder (whole) + **error-driven patcher** `agents/patcher/prompt.jinja2`, `patcher.py:69` | **both**: `<dyad-write>` **and** `<dyad-search-replace>` with **dry run** `ipc/processors/response_processor.ts:75-140` |
| **Q3 Coherence** | prompt-only + line-numbered files `files_dict.py:55` | **shared_deps.md** plan injected everywhere `prompts.py:73,128` | LLM per-file **references** index `code_monkey.py:52,186` + relevant-files mixin | LLM context buffer **max 5 files** `select-context.ts:152-167` | persisted **DependencyFile** graph `utils/dependency_file.py` + LGTM review loop | typed nodes/conditional edges/bounded cycles `workflow/graph_manager.py:188` | whole-project re-read as markdown `filesystem/read_code.py` | **tsc on the emitted app** `processors/tsc.ts` + code_explorer index |
| **Q4 Runs app?** | yes `bash run.sh`; **self-heal ×10** `steps.py:205`, `tools/custom_steps.py:40` | no | yes, timed commands + error handler `agents/executor.py:107` | yes, **WebContainer** `npm run build` → error→chat `runtime/action-runner.ts:395` | yes, subprocess + pip/pytest installs `actions/run_code.py:92-171` | yes, subprocess w/ timeout → failure message node `python_executor.py:116-169` | yes, runner + error→re-patch `agents/runner/runner.py` | yes: dep-install action + preview iframe + **Playwright E2E** `handlers/tests_handlers.ts` |
| **Q5 Tests** | none (black only) `core/linting.py` | none | none by default; bug_hunter/error_handler | none; bar = build passes | pytest install in run path; authoring UNVERIFIED `run_code.py:165` | Test Phase behind `max_iterations: 3` counter | none; runner loop only | **record→human-approve→grounded Playwright** `prompts/test_assertions_prompt.ts`, `lib/test_recorder/` |
| **Q6 BYOK** | `AI._create_chat_model` azure/openai/claude `core/ai.py:330` | `model=` param only `prompts.py:62` | 6 providers + per-agent models `core/llm/`, `config/__init__.py:70` | **21 providers** incl. deepseek/ollama/lmstudio `modules/llm/providers/` | `config2.py` LLMConfig + registry, 11 providers | per-node providers `runtime/node/agent/providers/` | 7 clients incl. ollama/lm-studio `src/llm/llm.py` | openai…openrouter/**ollama/lmstudio** `lib/schemas.ts:68-83` |
| **Q7 Cost / streaming** | tiktoken cost **after** the fact; no cap `core/token_usage.py` | `stream_handler` callbacks; no cap | llm_request rows; cap UNVERIFIED | per-action **live status stream**; no cost UI found | **`max_budget=10.0` + `Team.invest()`** `utils/cost_manager.py`, `team.py:92` | loop counters bound effort; no cost mgr | none; socket.io monologue | **pre-flight `chat:count-tokens` vs context window** + compaction `token_count_handlers.ts` |
| **Q8 Review surface** | CLI + TOML file picker; no diff UI | CLI/library; agent_protocol server | per-file status + **diff events** to a GUI `core/ui/ipc_client.py` | **FileTree/DiffView/Terminal/Preview/Inspector/Lock** `components/workbench/` | git repo of docs + Mermaid diagrams; CLI | **server + frontend + human *node*** `runtime/node/executor/human_executor.py` | React UI + FastAPI + socket.io monologue | Electron IDE + problems panel + **git commit per assistant message** `handlers/version_handlers.ts` |

---

## What the emitted product actually looks like

Only one repo in this set ships a **real generated app** as a fixture; the rest ship **templates** (which is itself the
industry's answer to unverifiable output — constrain the file list instead of inventing it).

| Repo | Artifact inspected | What it actually is | Installs? | Stubs? |
|---|---|---|---|---|
| smol-developer | `examples/v1_pong_game/` | **Real generator output** (checked in). 4 files + plan: `index.html` 14 lines, `style.css` 38, `main.js` 122, `ai.js` 22, `shared_deps.md` 35. | **No** — no `package.json`, no deps, no build (`readme.md` badges + the plan's own note that it avoids `import`/`export`) | No stubs; but also no error handling and no tests |
| gpt-pilot | `core/templates/vite_react.py` (+`tree/`, `info/`) | **Hand-authored starter tree** (≈40 files) with per-file descriptions at *export* granularity (`"…/button.tsx": "Shadcn Button component. Exports Button, buttonVariants."`). Applied via `templates/base.py:81` + `render_tree` | Yes (the template is a real Vite app) | No — the template is complete; the model then edits it |
| bolt.diy | `app/components/chat/StarterTemplates.tsx` | UI starter templates, not emitted apps | n/a | n/a |
| MetaGPT / gpt-engineer / Devika / ChatDev / Dyad | — | **No example generated apps are checked in.** MetaGPT emits into a git repo (docs + code); gpt-engineer emits `<project>/<prompt-name>/` with `run.sh` + `logs/` (`core/default/paths.py`); Dyad emits into an Electron app folder with git history | — | — |

**Read this as a finding, not a gap in the research:** the field's most reliable "it works" stories come from projects
that either (a) ship almost nothing (smol-developer's static, zero-dependency app) or (b) verify against a *running*
app (bolt.diy's in-browser build, Dyad's Playwright). Nothing here demonstrates a large, dependency-heavy, multi-file
app that installs and runs first-try without human intervention.

---

## The mechanisms RapidTool is missing

Ranked by **value × feasibility** for RapidTool. "Proving file" = the competitor file that shows the mechanism is real.
"Harder for RapidTool" = where RapidTool's governance/honesty model makes this *genuinely harder*, not merely different.

**1. A dry-run-validated in-place edit protocol (`search-replace` / hunk diffs) instead of whole-artifact re-emission.**
*Proving files:* Dyad `src/ipc/processors/response_processor.ts` — `dryRunSearchReplace()` (line 103) validates every
`<dyad-search-replace>` tag against the real file and returns per-file issues *before* committing, then applies via
`applySearchReplace`; gpt-engineer `gpt_engineer/core/diff.py` — `Hunk.find_start_line` / `validate_and_correct` repair
line-number drift, driven by the `preprompts/file_format_diff` prompt and `MAX_EDIT_REFINEMENT_STEPS`; MetaGPT
`metagpt/actions/write_code_plan_and_change_an.py` — the incremental plan is emitted *as* `+`/`-` diff marks.
*RapidTool status:* verified absent — no `patch`/`diff`/`search-replace` verb exists in `scripts/rapidtool-cli.mjs` or
`src/lib/` (grep returns nothing), so the only way to change an emitted artifact is re-emit.
*Why it matters:* this is precisely RapidTool's stated biggest gap (re-emit-only), and the dry-run pattern is
structurally identical to RapidTool's own "validate then commit" gate culture.
*Harder for RapidTool:* an in-place edit breaks the clean `emit → hash → seal` provenance story. `tree-run --dir`
already detects divergence (`--project` adds a "hash-checked `dirDirty` divergence report", per the CLI header), but
the ledger currently attributes *emission*; an edit verb must record actor + patch + resulting hash, or the audit trail
will claim provenance it doesn't have. Doing this honestly is more work than Dyad's version, which has no ledger.

**2. A persisted per-file interface/reference registry that the generator writes and reads back.**
*Proving files:* MetaGPT `metagpt/utils/dependency_file.py` (`DependencyFile.update(filename, dependencies)`,
persisted JSON) fed by `metagpt/roles/engineer.py:139-146`
(`repo.srcs.save(filename=…, dependencies=[design_doc, task_doc, code_plan_and_change_doc], content=…)`); gpt-pilot
`core/agents/code_monkey.py:52` `FileDescription{summary, references}` written into `file.content.meta` per file;
smol-developer `smol_dev/prompts.py:73` — the plan must name exports, DOM ids, function names, and is then injected into
every per-file call (line 128).
*RapidTool status:* the chunked P6 path checks per file and the oracle is brief-grounded
(`src/lib/verify.server.ts::oracleBriefGrounded`), but there is no cross-file reference graph.
*Harder for RapidTool:* an LLM-written description is a *claim*. Under the honesty contract it must either be
mechanically derived (parse imports/exports) or carry `source: "illustrative"` — otherwise the registry becomes the
exact class of unverifiable assertion the repo forbids.

**3. A project-level type/compile gate with precondition diagnostics and a capped, structured problem list.**
*Proving file:* Dyad `src/ipc/processors/tsc.ts` — `CONFIG_NAMES = ["tsconfig.app.json","tsconfig.json"]`,
`parseTypeScriptDiagnosticsDetailed` → `problems: ParsedDiagnostic[]`, `TypeCheckPreconditionKind` plus a written
guidance string when the project lacks a tsconfig, `TSC_MAX_OUTPUT_BYTES = 4 MiB`, surfaced by
`src/ipc/handlers/problems_handlers.ts`.
*RapidTool status:* partially present — `emit --check` reports per-file compile verdicts and `--run` compiles + tests +
entry smoke. The steal is the *precondition* half: saying "type checking could not run, here is why, here is what would
make it runnable" instead of a bare red gate.
*Harder for RapidTool:* low friction — this is an extension of an existing gate, and RT_E codes give it a natural home.
The constraint is that a "could not run" precondition must be a *distinct* code from "ran and failed", or a skipped
check will read as a pass.

**4. A run-level budget gate with "investment" semantics.**
*Proving files:* MetaGPT `metagpt/utils/cost_manager.py` — `CostManager(max_budget=10.0)`, per-call
`update_cost(prompt_tokens, completion_tokens, model)`, log line `"Total running cost: $… | Max budget: $… | Current cost: $…"`;
`metagpt/team.py:92` `invest(investment)` sets the cap and `_check_balance()` enforces it. Dyad
`src/ipc/handlers/token_count_handlers.ts` pre-computes prompt size against `getContextWindow` *before* sending.
gpt-engineer `core/token_usage.py::TokenUsageLog.usage_cost()` is the counter-example: measured, never enforced.
*RapidTool status:* `src/lib/codegen.server.ts` has a per-call cap (`P6_SYNTH_MAX_TOKENS = 32_000`,
`P6_SYNTH_TIMEOUT_MS = 240_000`) but no run-level budget.
*Harder for RapidTool:* a budget that trips mid-phase must fail loudly with a code (never a silent truncation), and the
console has to show spent-vs-budget as *measured* figures. A keyless run has no spend — that asymmetry has to be
represented honestly rather than as `$0.00`.

**5. Retry/loop budgets as declared configuration with an explicit structural bound.**
*Proving files:* ChatDev `yaml_instance/ChatDev_v1.yaml` — `loop_counter` nodes with `max_iterations: 5` (code complete)
and `max_iterations: 3` (test phase), executed by `runtime/node/executor/loop_counter_executor.py`; MetaGPT's LGTM gate
loop `metagpt/actions/write_code_review.py:206-224`. Compare the Python-side constants every other repo hides in code:
`MAX_EDIT_REFINEMENT_STEPS = 2` (gpt-engineer `core/default/constants.py`), `MAX_SELF_HEAL_ATTEMPTS = 10`
(`tools/custom_steps.py:19`), `MAX_CODING_ATTEMPTS = 3` (gpt-pilot `agents/code_monkey.py:32`).
*RapidTool status:* rapidtool already has repair prompts (`p6SynthesisRepairPrompt`,
`p6SynthesisExportRepairPrompt`, `p6SynthesisForbiddenRepairPrompt`, `p6SynthesisSignatureRepairPrompt` in
`src/lib/codegen.server.ts`) — but the retry budget is implicit in code.
*Harder for RapidTool:* none of substance. This is the cheapest high-value steal: make the repair budget visible in the
Agent Packet and trip an RT_E code when exhausted, instead of the loop simply ending.

**6. Per-action streaming status instead of per-phase status.**
*Proving file:* bolt.diy `app/lib/runtime/message-parser.ts::StreamingMessageParser` (line 76) — the token stream is
parsed live into `{artifactId, actionId, action, status}` events, so each file write and shell command flips
running→complete in the UI; `app/lib/runtime/action-runner.ts` updates each action's status independently (and marks it
`failed` with the error text). Dyad's problems panel + preview-console tail (`src/preview_console/store.ts`, bounded
buffer) is the same idea for a local app.
*RapidTool status:* the infra exists (`src/lib/rt-events.ts`, `rt-ring.ts`, `watchdog.ts`, the Runtime log tab) —
the steal is *granularity*, not plumbing.
*Harder for RapidTool:* telemetry is purity-tested and must never change engine behavior (AGENTS.md §7), so per-action
events have to be emitted from the seam without altering outcomes — a stricter constraint than bolt.diy, which drives
its UI from the same objects it executes.

**7. Retrieval-based context selection with a hard, explicit cap.**
*Proving files:* bolt.diy `app/lib/.server/llm/select-context.ts` — an LLM selects a context buffer with the literal
rule "Only 5 files can be placed in the context buffer at a time", reasons that "context buffer is extremlly expensive",
and deletes dropped paths (line 197); Dyad `src/ipc/processors/code_explorer.ts` (+ `code_explorer_eviction.ts`) builds an
index with an eviction policy; gpt-pilot `core/agents/mixins.py` (relevant-files mixin with `ALWAYS_RELEVANT_FILES`).
*RapidTool status:* "no equivalent verified" (no context-buffer module found in `src/lib/`).
*Harder for RapidTool:* a selection step that is itself LLM-driven produces a *choice* that can fail; the selection and
its omissions need to be recorded, otherwise a bad edit looks like a synthesis bug rather than a context bug.

**8. Verification against the running product — human-approved behavioural assertions executed by a browser driver.**
*Proving files:* Dyad `src/ipc/handlers/tests_handlers.ts` (Playwright CLI invocation, running base URL, parallel
workers, preview rotation, timeout classified as an infra error) + `src/lib/test_recorder/` and
`src/ipc/handlers/test_assertion_handlers.ts` (a human approves an **assertion card** before any spec is written) +
`src/prompts/test_assertions_prompt.ts` (one grounded assertion, "OMIT that entry rather than guessing"); Devika's
error-driven patcher (`src/agents/patcher/prompt.jinja2`) is the cruder ancestor.
*RapidTool status:* `emit --run` compiles and executes the emitted tree's own `tests/*.spec.ts` — real, but it verifies
*the emitted code's own tests*, not the product a user would touch.
*Harder for RapidTool — and this is the honest hard one:* RapidTool's runner is explicitly **not** a sandbox
(`src/lib/node-runner.server.ts` exports `runnerIsolationClaim`, uses `scrubbedEnv()`, `redactSecrets()`, `treeKill()`,
`CLOSE_GRACE_MS/KILL_GRACE_MS`, `removeScratchDir()`; AGENTS.md: "bounded local runner — not an OS sandbox"). A browser
driver plus a dev server is a far larger execution surface than a bounded Node child process. To adopt this honestly,
RapidTool must either add a real isolation boundary or state plainly in the UI/packet that the verification ran
un-isolated — it cannot describe a Playwright run inside the existing runner as sandboxed. Dyad gets to skip that
argument because it never makes an isolation claim.

**Bonus (cheap, low-risk): template-seeded file plans with export-level descriptions.**
*Proving file:* gpt-pilot `core/templates/vite_react.py` + `core/templates/base.py::BaseProjectTemplate.apply()`
(line 81) — the file list, the descriptions (down to which symbols each file exports), and the descriptions-as-metadata
(`metadata = {"description": desc}`, line 112); registry `core/templates/registry.py:20`.
This directly attacks "the model invents a file list", and RapidTool's deterministic-first philosophy already matches it.
**Harder for RapidTool:** a template is authored content, so it must carry `source:` provenance — a template description
that reads like a verified fact is exactly the claim the declare-or-strike rule is for.

---

## UNVERIFIED register (do not cite as fact)

| Claim | Repo | Why unverified |
|---|---|---|
| Whether `bug_hunter` / `problem_solver` emit test files | gpt-pilot | Agent files and prompt dirs confirmed; prompt output format not read |
| Global token/cost cap | gpt-pilot | `llm_request` rows exist; no cap found in the files read |
| Any token budget or cost accounting | bolt.diy | No `cost`/`usage` hits in the LLM server files read |
| Cross-file edit strategy (diff vs full rewrite) for code files | ChatDev 2.0 | Node executors write files; the per-file edit rule was not isolated |
| Whether tests are authored (vs only run) | MetaGPT | `_install_pytest` in the run path; authorship not traced end-to-end |
| Test-authorship and cost caps | Devika, ChatDev 2.0 | Not present in the files read |
| Everything in Q1–Q5 | OpenHands (agent runtime) | The available clone is the Agent Canvas **UI** (`@openhands/agent-canvas`), not the Python agent |
| MetaGPT `Engineer` test→fix loop wiring | MetaGPT | Roles/actions read for structure, iteration not traced |

## Recommended follow-up tasks (8)

| # | Task | Type | Basis |
|---|---|---|---|
| 108-T1 | Add an in-place edit verb (search-replace/diff) with a **dry-run validation pass** and ledger attribution (actor + patch + resulting hash) | implement | Mechanism 1 |
| 108-T2 | Extract a **mechanical** per-file import/export reference registry from emitted trees (no LLM claims) and feed it back into synthesis context | implement | Mechanism 2 |
| 108-T3 | Extend the compile gate with **precondition diagnostics** ("could not run because X") as a distinct RT_E code from "ran and failed" | implement | Mechanism 3 |
| 108-T4 | Run-level budget gate with MetaGPT-style `invest` semantics + measured spend in the console/packet | implement | Mechanism 4 |
| 108-T5 | Surface the repair-attempt budget in the Agent Packet and trip an RT_E code when exhausted | implement | Mechanism 5 |
| 108-T6 | Per-action (file/step) telemetry granularity emitted from the existing events seam, purity-preserving | implement | Mechanism 6 |
| 108-T7 | Feasibility spike: E2E verification of an emitted app against a running instance — **including the isolation-boundary honesty decision** | spike | Mechanism 8 |
| 108-T8 | Finish the extraction for the OpenHands **agent runtime** + 2–3 Lovable-style OSS clones (Dyad is covered; e.g. `Roo-Code`/`cline` app-scaffolding paths already cloned in the scratch dir) | research | Coverage gap |
