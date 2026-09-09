# 42 — Competitive Analysis: Chat + Wild Mode vs Codex / DeepSeek Harness / Gemini CLI / Antigravity

> **File:** `research/multiagent/42_competitive_analysis.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`)
> **Date / agent:** 2026-09-06 · Pro analyst P3 (competitive analysis). **Read-only on source** — this is the only file written; no RapidTool source was modified.
> **Sibling map (multiagent thread):** 01 = open-source harness digests · 02 = capability audit · 06 = competitor survey (app builders + code agents — this file does NOT repeat it) · 18 = chat-UX pattern survey (streaming/grounding patterns — extended here with the 4 named products' *primary* docs) · 34 = CLI anchor map. This file focuses on **RapidTool's Chat + Wild Mode specifically**, against the four harnesses the wave named: **Codex (OpenAI), DeepSeek Harness, Gemini CLI, Antigravity IDE (Google)**.
> **Method / 0-hallucination rule:** every external claim below cites a page fetched 2026-09-06 (register in §6). Vendor claims cite vendor docs; one community-only claim (Antigravity tree-sitter) is explicitly flagged as community-reported. Every RapidTool `file:line` anchor was re-verified against on-disk bytes this pass (read_file/grep) — no anchor is inherited from older dossiers.

---

## 0. TL;DR

- **RapidTool's Chat is a one-shot, non-streaming, unpersisted copilot** (`chatOnce` → TanStack server fn → DeepSeek with `stream: false`; local `useState` only). All four competitors stream tokens, persist sessions, and let the model call tools mid-turn. That is the single largest UX gap.
- **Wild Mode is a genuinely superior autonomous-loop design** — one bounded macro-action per call, append-only ledger, hard DoD floor, classifier that *refuses* to fabricate a judgment when unconfigured (`wild-mode.server.ts`, `engine.ts:2326-2435`). No competitor has an equivalent honesty/governance contract; Codex's `auto_review` and Antigravity's "Always Proceed" policy are the closest, and both happily run without human-visible evidence hashes.
- **Where RapidTool loses:** perceived latency (no streaming, no stop), no session resumability, no plan-before-execute review UX, prose-only gates (no diff/artifact review), no context meter, no runtime MCP client, no checkpoint/rollback, no permission allowlist language, chat can't invoke tools.
- **Where RapidTool wins (and should say so):** determinism + evidence hashes, honesty envelopes with machine-readable error codes, an append-only paper trail, hard-DoD gates that cannot be skipped, offline/keyless operation, provenance stamps per chat reply.
- **Cheapest highest-leverage fixes (§5):** SSE streaming chat (S1), persist chat to the project (S2), checkpoint per wild step (S6), plan-first wild step (S3).

---

## 1. RapidTool baseline — what exists today (verified anchors)

### 1.1 Chat stack

| Concern | Where | What it is today |
|---|---|---|
| Transport | `src/lib/chat.ts:17-28` | TanStack `createServerFn({ method: "POST" })` wrapping `chatOnceServer` — **one-shot request/response, no stream** |
| Backend call | `src/lib/deepseek.server.ts:168-234` | `completeDeepSeek` with **`stream: false`** (line 233), AbortController timeout, `postWithRetry` |
| Model/tier | `src/lib/chat.server.ts:292-298` | `deepseek-v4-flash`, thinking disabled, `maxTokens: 768` — no reasoning-effort choice |
| Grounding | `src/lib/chat.server.ts:87-195` | deterministic `buildChatContext` ≤ **2 500 chars** (`CHAT_CONTEXT_MAX_CHARS`, line 41), fixed field order, total sort tiebreaks; F2/F3/F4 honesty rules for stale memory rows and open gate edges |
| History | `src/lib/chat.server.ts:44-47, 275-290` | last 6 turns, 800 chars/turn, role-validated; client keeps last 12 valid rows (`src/lib/chat.ts:70-82`) |
| Honesty | `src/lib/chat.server.ts:26-34, 246-253` | typed `ChatResult`: `not-configured` with `RT_E_LLM_NOT_CONFIGURED` before any network work; failures carry `code` |
| Provenance | `src/lib/chat.server.ts:205-226` | FNV-1a context version + `"Grounded in build context v{N} as of P{n}/{ts}Z"` stamp per reply |
| UI | `src/components/console.tsx:4337-4510` | `ChatPane`: local `useState` msgs, `busyRef` blocks re-entrant sends (4352-4354), a pulsing "thinking…" placeholder while waiting for the full reply (4456-4466), quick-action chips built from live state (4414-4418), Enter-to-send input |
| Persistence | `src/components/console.tsx:4333-4336` | **"Local state only — nothing persisted, store partialize untouched"** — chat dies on reload/tab-close |

### 1.2 Wild Mode stack

| Concern | Where | What it is today |
|---|---|---|
| Loop primitive | `src/lib/engine.ts:2326-2435` | `wildStep`: **one bounded macro-action per call** (execute + review + approve/advance the current legal edge), never more; noop on inactive/paused/blocked |
| Ledger | `src/lib/engine.ts:2029-2034` | `wildLog` appends `wild.*` events (cap 200); append-only, never deleted |
| Mirror | `src/lib/engine.ts:1985-1987, 2037-2050` | `Project.wildRun` (active/pause/phase/lastAutoLog/lastAutoAt/stoppedAt) so the console streams the run from one object |
| Reviewer | `src/lib/wild-mode.server.ts:1-182` | configured-only classifier (`deepseek-v4-flash`, line 31); verdict parser requires explicit `VERDICT:` + ≥12-char `FEEDBACK:` (116-129); unparseable/short output = honest error, never a guessed approve |
| Fallback | `src/lib/engine.ts:2086-2102` | classifier not-configured → deterministic DoD floor for *advance*; open human gate → **pause, never fabricate** |
| Honesty codes | `src/lib/engine.ts:2015-2023` | `RT_E_LLM_REJECTED / RT_E_LLM_NOT_CONFIGURED / RT_E_GATE_PENDING / RT_E_PHASE_ILLEGAL / RT_E_INTERNAL` |
| Human-only gates | `src/lib/engine.ts:2161-2168` | `forceHuman` gates pause even in Wild Mode — "cannot self-approve" |
| Store driver | `src/lib/store.ts:525-620` | wildMode toggle, auto-loop with **step cap 20** (593), pause/resume/stop actions |
| UI | `src/components/console.tsx:226-402, 538-620` | Wild-Mode panel, live run feed polling `wildRun` (386-402), emergency PAUSE/RESUME |

---

## 2. Competitor mechanics (all claims cite §6 sources)

### 2.1 Codex (OpenAI) — CLI + app

**Chat mechanics.** Full-screen terminal TUI; the agent works live in the turn — "Steer the active turn, inspect commands and diffs **as they appear**" [C1]. Streaming is confirmed at the transport layer: the OTel event catalog includes `codex.sse_event` with token counts on `response.completed` [C2]. Interaction affordances RapidTool lacks: `Tab` queues a follow-up prompt while Codex works, `Enter` injects mid-turn instructions, `Esc`×2 edits the previous user message and forks the chat from that point, `@` files into the prompt, `Ctrl+O` copies the latest output, and the header shows a live **context meter** ("100% context left") [C1][C3].

**Agentic loop.** One prompt may run plan → implement → validate → repair; `/review` runs a read-only code review (PR-style vs base branch, uncommitted, or a commit) without touching the tree [C1][C4]. Approvals: `approval_policy` = `untrusted | on-request | never | granular` with per-category auto-reject; `approvals_reviewer = auto_review` hands eligible prompts to a **reviewer subagent** instead of the human [C5]. Sandbox: OS-enforced `read-only | workspace-write | danger-full-access`; network off by default; `network_proxy` allowlist-first domain rules with deny-wins, DNS-rebinding checks, and local-binding blocks [C2]. Destructive app/MCP tool calls always require approval when the tool advertises the annotation [C2]. GPT-6 Astra adds async safety monitoring that can pause a task after the fact [C2].

**Context strategy.** Auto-compaction (`/compact` exists; "Codex also compacts chats automatically"), `AGENTS.md` hierarchy (global → repo → subdir, closer wins), sessions persisted with `resume / fork / archive`, `/goal` persistent goal, `/worktree` to run a chat in a Git worktree [C4][C1]. Scriptable: `codex exec --json` emits NDJSON per state change; `app-server` speaks WebSocket [C1].

**Plan mode.** `/plan` (or `Shift+Tab`) toggles plan mode: read-only research + clarifying questions → a proposed plan the human approves **before** implementation [C1][C4]. Chat-only use is `--sandbox read-only --ask-for-approval on-request` [C2].

### 2.2 DeepSeek Harness (`dsh`, deepseek-ai/deepseek-harness, MIT, 213.8k★, "Everything is a Plugin" on Cordis)

**Chat mechanics.** Web UI at `http://127.0.0.1:3080` (`npx @deepseek-ai/dsh web`); sessions are first-class (resumable), workspace must be selected before the composer unlocks; the agent "can read and edit workspace files, run commands, delegate work, and maintain a plan"; **the Web UI asks before operations that require approval under the active permission policy** [D1]. The client renders tool calls as styled, clickable cards (merged PR #3547 "tool-call clickable styles") [D2]. Sessions persist to a **JSONL journal with a cross-process write-ownership lease** (`session.lock.json`, 5-min TTL, take-over on expiry — two processes can't corrupt one session) [D3].

**Agentic loop.** `agent-loop` plugin with `maxParallelToolCalls` (parallel-safe tool calls per step); a `plan-mode` tool (`exit_plan_mode`) exists in the tool catalog; tool surface: `bash`/`pwsh` (+persistent shells), `str_replace_editor`, `fs` read/write/edit/read_image, `glob`/`grep`, `terminal_open/read/send`, `ask_user_question`, `run_code` [D4][D5]. Plugins can be composed **at runtime** (`cordis_define`/`cordis_run`) — the harness can extend its own tool surface mid-session [D5]. ACP (Agent Client Protocol) is supported, so external editors/agents can drive sessions [D5]. Hooks intercept lifecycle points [D5].

**Context strategy.** Deterministic compaction policy: compact at **0.8** of the model window, retain **0.16**, summarizer model with `maxTokens` 8192, retries [D6]. Tool-result pruner: prune at 8 192 chars, keep head 4 096 / tail 1 024 [D6]. `agent-instructions` loads workspace `AGENTS.md`-style files with byte caps [D6].

**Deep-thinking.** Deployment-level `thinking: enabled|disabled`, `reasoningEffort: off|low|high|max`, provider-neutral reasoning levels plus per-provider thinking formats (openai-completions thinking delimiters, anthropic adaptive thinking) [D6].

**Sandbox + metering.** `bash-sandbox` + `sandbox-policy` (mode + `workspace-write` fallback root), Windows ACL sandbox; code-runtime meters **measured event-loop busy time** (`computeMs`) plus wall clock and heap caps — "fair and ungameable" [D6][D7]. MCP: stdio + Streamable HTTP (SSE), tools named `mcp__<server>__<rawName>` [D6]. API gateway is a WebSocket with heartbeat; non-loopback hosts must be whitelisted on a trust fence [D6].

### 2.3 Gemini CLI (google-gemini/gemini-cli, Apache-2.0)

**Chat mechanics.** Terminal TUI over Gemini 3 with a **1M-token context window**; free tier 60 req/min, 1 000 req/day [G1]. Streaming-first: non-interactive mode emits either a plain reply, `--output-format json`, or `--output-format stream-json` (**newline-delimited JSON events** "for real-time event streaming… monitoring long-running operations") [G1]. `GEMINI.md` per-project context files; extensions add custom commands [G1].

**Agentic loop.** Built-in tools: **Google Search grounding**, file ops, shell, web fetch; MCP servers configured in `~/.gemini/settings.json` and invoked as `@server …` [G1]. Approvals: tool **auto-acceptance** settings; Trusted Folders put an untrusted dir into "safe mode" — workspace settings ignored, no `.env` loading, no extension installs, auto-acceptance disabled, automatic memory loading off, and a trust dialog (trust folder / trust parent / don't trust) persisted to `~/.gemini/trustedFolders.json` [G3]. Sandboxing: macOS Seatbelt profiles (`permissive-open` default — write-restricted, network allowed; `restrictive-closed` max) or Docker/Podman containers [G2].

**Checkpointing (steal-worthy).** Optional; when enabled, before any file-mutating tool run the CLI commits a **shadow Git snapshot** in `~/.gemini/history/<project_hash>` (doesn't touch the project's own repo), saves the conversation + the pending tool call; `/restore` reverts files **and re-proposes the original tool call** to run again, modify, or ignore [G4]. Also: GitHub Action for PR review/issue triage/`@gemini-cli` mentions [G1].

### 2.4 Antigravity IDE (Google)

**Chat mechanics.** Agent conversations live inside Projects (multi-folder, multi-repo context); two execution modes: **Planning Mode** (organizes work in task groups, produces structured implementation-plan **Artifacts**, researches the codebase) vs **Fast Mode** (direct execution for small tasks) [A1]. Artifacts are first-class: an implementation plan renders as a reviewable document with **inline comments**, a "Proceed" button in the conversation and in the artifact header, and a "Review" toggle to submit feedback and force a re-plan [A2]. The IDE's **Review Changes** pane lets the human scroll through every file diff from the conversation and comment on diffs directly [A3]; the VCS panel can filter to **agent edits only**, stage/unstage/discard per file, and auto-generate commit messages [A4].

**Autonomous loop + approvals.** Artifact Review Policy: **Request Review** (agent always halts before proposed changes — recommended) vs **Always Proceed** (fully autonomous) [A1]. Unified permission engine: every sensitive operation is a resource `action(target)` (`read_file`, `write_file`, `read_url`, `execute_url`, `command`, `unsandboxed`, `mcp`) evaluated against Deny/Ask/Allow lists with prefix/regex matching; workspace paths auto-allowed; everything else defaults to **Ask**; permission cards let the user **edit the target scope inline** (e.g. broaden `/project/file.txt` → `/project`) to avoid repeat prompts [A5]. Terminal sandboxing compiles permission grants into container read/write/network allowlists [A5]. Slash commands: `/goal` (run until done, no intermediate asks), `/grill-me` (interview the user before implementing — same idea as Codex's plan-mode clarifying questions), `/schedule`, `/browser` (Chrome DevTools MCP integration, webm recordings) [A6]. Also: JSON hooks (intercept pre-tool-call / post-response / stop), worktree projects, remote control with push notifications, voice input with smart cleanup, MCP Store + `mcp_config.json` with OAuth/ADC auth [A4][A7].

**Tree-sitter.** Community sources describe tree-sitter-backed semantic awareness in Antigravity's editor/agent (e.g. LinkedIn teardown "WHY TREE SITTER MATTERS… key components", YouTube deep-dives on "How Cursor, Antigravity & Agentic IDEs Work", Reddit `google_antigravity` threads on tree-sitter implementations) [A8]. **Not documented** on `antigravity.google/docs` — treat as community-reported, not vendor-documented.

---

## 3. Gap and win matrix

### 3.1 RapidTool shortcomings vs the field (ranked by severity)

| # | Shortcoming | RapidTool evidence | Competitor counter-evidence |
|---|---|---|---|
| 1 | **No streaming chat** — full reply or nothing | `deepseek.server.ts:233` `stream: false`; `console.tsx:4456-4466` pulse placeholder | Codex `codex.sse_event` [C2]; Gemini `stream-json` [G1] |
| 2 | **Chat not persisted** — reload loses the thread | `console.tsx:4333-4336` "Local state only" | Codex resume/fork/archive [C1]; DSH session journal [D3]; Gemini checkpointing [G4] |
| 3 | **No plan-before-execute** in the autonomous loop — classifier judges *after* execution | `engine.ts:2409-2421` execute → review | Codex `/plan` [C1]; Antigravity Planning Mode + Artifact Review [A1]; DSH `exit_plan_mode` [D5] |
| 4 | **Prose-only gates** — no diff/artifact review UI | `chat.server.ts:171-176` (HITL as one clipped line); `console.tsx:2140, 2626-2632` | Antigravity Review Changes + artifact comments [A2][A3]; Codex auto-review [C5] |
| 5 | **No context meter / compaction story in UI** | `chat.server.ts:41` fixed 2 500-char ground context | Codex "100% context left" meter + `/compact` [C3][C1]; DSH 0.8/0.16 compaction [D6] |
| 6 | **No runtime MCP client** — only synthesized demo artifacts | `engine.ts:409-421` (P3 demo artifact declaring `search.brave`/`sandbox.exec`) | All four: Codex `codex mcp` [C1]; DSH `dsh-mcp-client` [D6]; Gemini `settings.json` [G1]; Antigravity MCP Store [A7] |
| 7 | **Chat can't call tools** — text-only, 768 tokens | `chat.server.ts:292-298` | Codex/Dsh/Gemini/Antigravity all expose tool loops |
| 8 | **No checkpoint/rollback per autonomous step** (ledger is append-only — good — but irreversible) | `engine.ts:2029-2034` | Gemini `/restore` shadow-git [G4]; Codex "create Git checkpoints before and after a task" [C1] |
| 9 | **Wild Mode permissions are coarse** — on/off per project, `forceHuman` per gate | `store.ts:525`; `engine.ts:2161-2168` | Antigravity `action(target)` Deny/Ask/Allow [A5]; Codex granular approval policy [C5] |
| 10 | **No stop/queue/inject affordances**, no reasoning-effort control | `console.tsx:4352-4354` busyRef blocks everything; `chat.server.ts:294` flash only | Codex Tab/Enter/Esc×2 [C1], `/reasoning` [C1]; DSH `reasoningEffort` [D6] |

### 3.2 What RapidTool already beats all four at

| Capability | RapidTool evidence | Competitor status |
|---|---|---|
| **Honesty envelope** — no key ⇒ typed `not-configured`, never fabricated prose/judgment | `chat.server.ts:246-253`; `wild-mode.server.ts:147-148` | None have a *machine-typed* equivalent; Gemini/Antigravity fail as prose errors; Codex `auto_review` substitutes a model judgment without evidence hashes |
| **Deterministic, byte-reproducible grounding** | `chat.server.ts:87-195` (fixed order, total tiebreaks) | All four ground in unbounded, model-curated context |
| **Evidence-hashed gates** (FNV-1a `evidenceHash`) + machine-readable error codes | `engine.ts:2065-2075`; `engine.ts:2015-2023` | None — Codex's closest is OTel `tool_decision` events [C2], which are telemetry, not enforcement |
| **Append-only decision ledger** | `engine.ts:2029-2034`; `wildRun` mirror | Codex transcripts are editable/summarized; Antigravity conversations are informal |
| **Bounded one-macro-action-per-step loop** with hard cap 20 | `engine.ts:1981-1987`; `store.ts:593` | `/goal` (Antigravity) and `approval_policy=never` (Codex) are *unbounded* autonomy by design |
| **Provenance stamps on every chat reply** | `chat.server.ts:205-226` | No competitor stamps which state version a reply was grounded in |
| **Offline/keyless operation** | `chat.server.ts:246-253` (honest degrade); deterministic floor | All four require an account/key to do anything |

---

## 4. Steal list — techniques to adopt, each with source + RapidTool-shaped spec

Each item: **Steal** (what), **Source** (fetched, §6), **Spec** (anchored to verified files), **Effort/Impact** (L/M/H). Listed in the build order §5 implies.

### S1 — SSE streaming chat + stop/regenerate ⭐ first build
- **Steal:** token streaming over one request; typed stream protocol; stop affordance.
- **Source:** Codex `codex.sse_event` telemetry + "inspect commands and diffs as they appear" [C2][C1]; Gemini `stream-json` NDJSON [G1]; prior RapidTool research [18 §1.1].
- **Spec:** (a) add `streamDeepSeek(prompt, opts): AsyncGenerator<{delta|done|error}>` next to `completeDeepSeek` — flip `stream: false` → `stream: true` at `deepseek.server.ts:233`, parse `data:` lines, keep the exact same error codes and `cutMarked` caps. (b) add a second TanStack server fn `chatStreamServer` beside `chatServer` (`chat.ts:17-28`) returning a `ReadableStream<Uint8Array>` of NDJSON `{type:"delta"|"provenance"|"error", …}`. (c) `ChatPane.send` (`console.tsx:4352-4391`) switches to `fetch` + reader loop appending deltas to the last assistant row — replace the `busy` pulse placeholder (`console.tsx:4456-4466`) with the live row; keep `busyRef` but add an `AbortController` wired to a Stop button that appends an honest `RT_E_ABORTED`-style display row (never replayed as model speech — the `chatHistoryTurns` error filter at `chat.ts:70-82` already handles that).
- **Effort M · Impact VH** (perceived latency is the whole chat product).

### S2 — Persist chat sessions + resume (journal)
- **Steal:** durable session journal with crash-safety; resume/fork.
- **Source:** DSH JSONL journal + write lease [D3]; Codex `resume/fork/archive` [C1]; Gemini checkpointing stores conversation too [G4].
- **Spec:** add `chatLog: ChatHistoryRow[]` (type already exists at `chat.ts:56-61`) to `Project`; `ChatPane` hydrates `useState([])` (line 4339) from `project.chatLog` and writes rows through the existing store persistence on each send — the doc comment at `console.tsx:4333-4336` ("nothing persisted, store partialize untouched") is the exact contract to amend. Cap at the last N rows like `trimTurns` (`console.tsx:4203`). Wild-run parity: `wildRun` already persists; chat should too.
- **Effort L · Impact H**.

### S3 — Plan-first Wild Mode (plan approval artifact before execution)
- **Steal:** plan mode: read-only reasoning → human approves plan → execute.
- **Source:** Codex `/plan`, `Shift+Tab` [C1][C4]; Antigravity Planning Mode + "Request Review" Artifact policy [A1]; DSH `plan-mode` tool (`exit_plan_mode`) [D5].
- **Spec:** split `wildStep`'s execute phase (`engine.ts:2409-2421`): when the phase has artifacts to synthesize, first emit `wild.plan` with a deterministic plan line (what will be executed, which DoD criteria it must pass, evidence hash seed) and `wildRun.pause = true` unless `opts.autoPlan === true`; the human presses Proceed (mirrors today's `wildApproveGate` path at `engine.ts:2364-2366`). Classifier judgment then happens **before** execution as a plan review (reuse `buildWildReviewPrompt`, `wild-mode.server.ts:77-109`) instead of only after. Keep the DoD floor as the final hard check — never weaken it.
- **Effort M · Impact H**.

### S4 — Context meter + explicit compaction
- **Steal:** visible context budget + user-triggerable compaction.
- **Source:** Codex "100% context left" header + `/compact` (auto) [C3][C1]; DSH `compaction-basic` 0.8/0.16 policy [D6].
- **Spec:** in the `ChatPane` header (`console.tsx:4426-4436`) render `buildChatContext(project).length / CHAT_CONTEXT_MAX_CHARS` (`chat.server.ts:41, 194`) as a tiny mono meter with the FNV-1a context version (`chat.server.ts:205-212`) — provenance becomes visible *before* asking. Add a "compact" chip: folds rows older than the last 6 into a single `(summarized)` user row via a flash-tier one-shot summary, then `trimTurns`.
- **Effort L · Impact M**.

### S5 — Approval-diff gate UI (artifact viewer with inline comments)
- **Steal:** reviewable diffs/artifacts with inline comments and Proceed/Review — instead of prose-only gates.
- **Source:** Antigravity Review Changes editor [A3], implementation-plan artifact with comments + Proceed/Review [A2], VCS panel filtering agent edits [A4]; Codex auto-review + `/approve` [C5][C1].
- **Spec:** the HITL panel (`console.tsx:2140`, `2626-2632`) currently renders `hitl.prompt` text. Extend it to list the phase's artifacts (`Project.artifacts`, already filterable by phase as `wild-mode.server.ts:80-84` does) as expandable cards with a comment row appended to the project on "Review" (feedback → next `wildStep` review context) and Proceed/Reject buttons mapping to the existing approve/reject store actions. This is RapidTool's DoD evidence made *visual* — no model judgment change needed.
- **Effort M-H · Impact H**.

### S6 — Checkpoint/rollback per wild step
- **Steal:** snapshot before every autonomous mutation; restore re-proposes.
- **Source:** Gemini checkpointing (shadow Git repo, `/restore` re-proposes the tool call) [G4]; Codex "Git checkpoints before and after a task" [C1].
- **Spec:** in the store's wild loop (`store.ts:577` `await wildStep(cur)` call site), before each step append `{ ts, phase, snapshot: JSON.stringify(project) }` to a new `project.checkpoints` (cap 10, trimmed like `wildLog`'s slice at `engine.ts:2032`); a `restoreCheckpoint` action replaces state and logs `wild.restore`. Zero model involvement; the append-only ledger stays untouched (restore is itself a ledgered event — governance, not amnesia).
- **Effort L · Impact H**.

### S7 — MCP client for chat/wild (governed MCP)
- **Steal:** runtime MCP client — stdio + Streamable HTTP — with per-tool approval.
- **Source:** DSH `dsh-mcp-client` (`mcp__<server>__<rawName>`, stdio + Streamable HTTP SSE) [D6]; Gemini `~/.gemini/settings.json` + `@server` invocation [G1]; Codex `codex mcp` add stdio/HTTP + OAuth [C1]; Antigravity `mcp_config.json` + `mcp(server/tool)` permission matching [A7][A5].
- **Spec:** new `src/lib/mcp.client.ts` reading a project-local `.agents/mcp_config.json` (Antigravity's shape [A7]) — stdio spawn, `tools/list`, tool names `mcp__<server>__<tool>` exactly like DSH; research-phase tools only at first (`search.brave` is already declared in the P3 demo artifact at `engine.ts:415`, making this a "make the declared contract real" story). Expose tool *results* into the research corpus (not the chat prompt) and require tool calls to pass a gate — **MCP through the phase machine is the differentiator no competitor has**. Later: tool-calling chat turns.
- **Effort H · Impact H** (differentiating).

### S8 — Ledger-as-chat tool cards (wild events visible in the chat thread)
- **Steal:** tool calls rendered as clickable, styled cards in the conversation.
- **Source:** DSH merged PR #3547 "tool-call clickable styles" [D2]; Codex "inspect commands and diffs as they appear" [C1].
- **Spec:** `ChatPane` (`console.tsx:4337-4510`) renders `project.logs` entries with `event` prefix `wild.` (engine.ts `wildLog`) as interleaved mono cards between turns — each card links to the ledger/log tab. The data already streams to the client via `wildRun`; this is presentation-only.
- **Effort L · Impact M**.

### S9 — Permission allowlist language for Wild Mode
- **Steal:** `action(target)` Deny/Ask/Allow rules instead of binary on/off.
- **Source:** Antigravity permission engine + scope-editable permission cards [A5]; Codex `approval_policy.granular` + app/MCP tool approval modes [C5].
- **Spec:** add `project.wildPolicy = { autoApprovePhases: number[], alwaysAsk: boolean, denyCommands?: … }` consulted in `resolveWildReview` (`engine.ts:2093`) and the `forceHuman` branch (`engine.ts:2161-2168`); default = today's behavior (no behavior change until configured). Rules are *data*, so they go through the existing gate/HITL governance and are ledgered like every other decision.
- **Effort M · Impact M-H**.

### S10 — Bounded terminal/sandbox UX for generated code
- **Steal:** persistent terminal + hard sandboxing of model-issued commands, with metered limits.
- **Source:** DSH `terminal_open/read/send` + busy-time metering [D5][D7]; Gemini Seatbelt/Docker sandboxes [G2]; Codex sandbox modes + network policy [C2].
- **Spec:** a console Terminal tab streaming `exec.ts` output (bounded runner already exists — `runNodeBounded` with timeout, `exec.ts:42-79`); add an output byte cap and a "kill" affordance, and mirror the isolation-policy wording already synthesized at `engine.ts:438-450` so the UI tells the truth about what is and isn't sandboxed (B-18 honesty pattern).
- **Effort H · Impact M**.

---

## 5. Top-10 improvements that would improve RapidTool immensely (impact/effort ranked)

| Rank | Improvement | Steal | Impact (1-10) | Effort (1-10) | Why first / now |
|---|---|---|---|---|---|
| 1 | **Streaming chat + stop/regenerate** | S1 | 10 | 5 | The chat feels broken at flash-tier latency; every competitor streams. Anchors are shallow (`deepseek.server.ts:233`, `console.tsx:4352-4466`). |
| 2 | **Persist chat + resume** | S2 | 8 | 2 | Cheapest trust win; turns a demo pane into a durable co-pilot; reuse of existing `ChatHistoryRow` type and store persistence. |
| 3 | **Checkpoint/rollback per wild step** | S6 | 8 | 3 | Makes autonomous mode safe to recommend; restore is a ledgered event so governance survives it. |
| 4 | **Plan-first Wild Mode** | S3 | 9 | 6 | The one thing Codex and Antigravity sell hardest (plan approval) and RapidTool lacks; reuse of `wildApproveGate` machinery keeps it cheap. |
| 5 | **Approval-diff gate UI (artifact viewer)** | S5 | 8 | 6 | Turns the strongest asset (DoD evidence) into a visible asset; Antigravity proves the UX. |
| 6 | **Permission allowlists for wild** | S9 | 6 | 4 | All-or-nothing wild mode caps adoption; Antigravity's `action(target)` is the proven shape. |
| 7 | **Context meter + compaction** | S4 | 5 | 2 | One header line + one chip; makes grounding visible and history honest. |
| 8 | **Wild ledger events as chat cards** | S8 | 5 | 2 | Presentation-only; makes the paper trail the star of the product. |
| 9 | **MCP client (governed)** | S7 | 8 | 9 | Highest long-term differentiation (MCP *through* gates exists nowhere else), but the biggest build; sequence after S1-S6. |
| 10 | **Bounded terminal/sandbox pane** | S10 | 5 | 7 | Nice-to-have; sandboxing is table stakes for code agents but RapidTool's loop doesn't require a shell to add value. |

**Sequencing note:** 1 → 2 → 3 is a single cohesive wave (chat becomes real-time, durable, and safe-to-automate). 4 + 5 are one UX/loop wave. 9 and 10 are only worth it after 1-8, because they widen the surface; the governance core (ledger, gates, honesty envelope) must not be diluted by tool breadth.

---

## 6. Source register (all fetched 2026-09-06)

**Codex (OpenAI):**
- C1 — "Codex CLI" + "Developer commands", OpenAI docs (learn.chatgpt.com/docs/codex/cli; learn.chatgpt.com/docs/developer-commands) — TUI loop, `/plan`, `/compact`, resume/fork/archive, Tab/Enter/Esc×2, `codex exec --json`, app-server WebSocket, `codex mcp`, slash-command table.
- C2 — "Agent approvals & security" (learn.chatgpt.com/docs/agent-approvals-security) — sandbox modes, `network_proxy` domain rules + DNS-rebinding checks, destructive-tool approval, GPT-6 Astra monitoring, OTel event catalog incl. `codex.sse_event`, read-only chat config, `/.git`-class protections.
- C3 — Codex README splash (github.com/openai/codex) — "100% context left · ? for shortcuts" context meter.
- C4 — "Best practices" (learn.chatgpt.com/guides/best-practices) — plan mode (`/plan` or `Shift+Tab`), AGENTS.md hierarchy, `/compact` + auto-compaction, `/review`, subagents, one-chat-per-outcome guidance.
- C5 — "Config reference" (learn.chatgpt.com/docs/config-file/config-reference) — `approval_policy` incl. `granular`, `approvals_reviewer = user|auto_review`, per-app/per-MCP-tool approval modes, `sandbox_mode` values.

**DeepSeek Harness:**
- D1 — repo page + Web UI guide (github.com/deepseek-ai/deepseek-harness; docs/user/guide/index.md) — MIT, 213.8k★, Cordis plugin architecture, Web UI at 127.0.0.1:3080, approval-under-permission-policy.
- D2 — merged PR #3547 commit message (github.com/deepseek-ai/deepseek-harness) — tool-call clickable link styles.
- D3 — commit "session-persistence-jsonl: cross-process write-ownership lease" — `session.lock.json`, 5-min TTL lease semantics.
- D4 — docs/config-catalog.md §agent-loop — `maxParallelToolCalls`, agent presets/trust.
- D5 — docs/tool-catalog.md — `bash`/`pwsh` (+persistent), `str_replace_editor`, `fs`, `glob`/`grep`, `terminal_*`, `ask_user_question`, `run_code`, `exit_plan_mode`, `cordis_*`, ACP plugin, hooks.
- D6 — docs/config-catalog.md — `compaction-basic` (0.8 threshold / 0.16 retain), tool-result pruner (8192/4096/1024), `thinking`/`reasoningEffort`, `dsh-mcp-client` (stdio + Streamable HTTP, `mcp__<server>__<tool>`), `agent-instructions`, WebSocket gateway heartbeat + trust fence, permission-presets.
- D7 — docs/config-catalog.md §code-runtime — `computeMs` busy-time metering, `maxWallMs`, heap caps; `bash-sandbox` + `sandbox-policy`; `sandbox-windows-acl`.

**Gemini CLI:**
- G1 — README (raw.githubusercontent.com/google-gemini/gemini-cli/main/README.md) — free tier, 1M context, Google Search grounding, MCP via settings.json + `@server`, `-p` / `--output-format json|stream-json`, GEMINI.md, GitHub Action.
- G2 — docs/cli/sandbox.html — Seatbelt profiles (`permissive-open` default … `restrictive-closed`), Docker/Podman, `-s/--sandbox`, GEMINI_SANDBOX.
- G3 — docs/cli/trusted-folders.html — trust dialog, safe-mode restriction list, `~/.gemini/trustedFolders.json`, `/permissions`.
- G4 — docs/cli/checkpointing.html — shadow Git repo `~/.gemini/history/<hash>`, conversation + tool call saved, `/restore` re-proposes the tool call; off by default.

**Antigravity (Google):**
- A1 — docs/artifact-review/ — Planning vs Fast Mode; Artifact Review Policy: Request Review (recommended) vs Always Proceed.
- A2 — docs/implementation-plan/ — implementation-plan artifact, inline comments, Proceed / Review toggle → re-plan or execute.
- A3 — docs/ide/review-changes-editor/ — Review Changes pane, comment on file diffs.
- A4 — docs/features/ — Projects + worktrees, scoped settings/permissions, VCS panel (agent-edit filtering, generated commit messages), integrated terminal, browser subagent + DevTools MCP + webm, voice input, JSON hooks, scheduled tasks, remote control.
- A5 — docs/permissions/ — `action(target)` resources, Deny/Ask/Allow, prefix/regex matching, scope-editable permission cards, workspace auto-allowed, Windows path normalization, write⇒read and deny-read⇒deny-write implications, terminal-sandbox allowlist compilation.
- A6 — docs/getting-started/ — `/goal`, `/grill-me`, `/schedule`, `/browser`, Local vs Worktree mode.
- A7 — docs/mcp/ — MCP Store, `mcp_config.json` locations, stdio/Streamable HTTP/SSE transports, OAuth/ADC auth, `mcp(server/tool)` permission matching.
- A8 — Community only (flagged): LinkedIn teardown (logeshwarravichandran), YouTube "Building an AI Code Assistant: How Cursor, Antigravity & Agentic IDEs Work", Reddit r/google_antigravity tree-sitter threads — tree-sitter semantic awareness; **not** in official docs.

**RapidTool anchors** — verified on-disk 2026-09-06: `src/lib/chat.server.ts`, `src/lib/chat.ts`, `src/lib/deepseek.server.ts`, `src/lib/wild-mode.server.ts`, `src/lib/engine.ts`, `src/lib/store.ts`, `src/lib/exec.ts`, `src/lib/llm.ts`, `src/components/console.tsx`.

**Cross-references:** [06 §0-1](06_competitor_survey.md) (app-builder/code-agent positioning), [18 §1](18_chat_ux_research.md) (streaming transport patterns, MarkdownBody reuse — `console.tsx:2934` verified), [34](34_cli_anchors.md) (CLI anchor map; wild anchors post-fix).
