# 09 — AGI-Usability Perfection Audit: The Complete Agent Interaction Contract

**Mission:** *"AGI agents must be able to use RapidTool ENTIRELY, PERFECTLY, with NO error or misunderstanding."*
**Author:** Flash research agent #4 · **Date:** 2026-09-05 · **Mode:** STRICTLY READ-ONLY (this file is the only artifact).
**Repo root:** `C:/Users/mnril/Desktop/RapidTool Main` (not a git repo).

This document is a zero-friction spec. It contains:
1. **The COMPLETE agent interaction model** — every entry point an AI agent (Hermes-style desktop agent, Claude Code, Codex, any CLI agent) can touch, with its exact input/output contract.
2. **A friction register** — every place an agent can misread RapidTool, with `file:line`.
3. **The PERFECT-AGENT-EXPERIENCE playbook** — a canonical, copy-pasteable create→run→gate→approve→packet→export→verify loop with expected JSON at every step.
4. **15 concrete fixes**, each mapped to a file.

Evidence base (read in full): `scripts/rapidtool-cli.mjs`, `src/lib/headless.ts`, `src/lib/packet.ts`, `src/lib/report-intake.ts`, `src/lib/crew.ts`, `src/lib/crew.server.ts`, `src/lib/verify.ts`, `src/lib/verify.server.ts`, `src/lib/exec.ts`, `src/lib/research.ts`, `src/lib/llm.ts`, `src/lib/store.ts`, `src/lib/types.ts`, `src/lib/phases.ts`, `src/lib/engine.ts` (relevant ranges), `src/lib/io.ts`, `src/lib/sandbox.ts`, `src/lib/node-runner.server.ts`, `src/lib/handoff.ts`, `src/lib/deepseek.server.ts`, `src/lib/websearch.server.ts` (head), `AGENT_GUIDE.md`, `agentnotes.md` (Parts 0–11, skim), `src/components/console.tsx` (wiring ranges). Sibling docs `research/multiagent/03_crew_design.md` / `04_verification_design.md` / `05_live_guidance.md` cross-referenced.

**Two honest ceilings up front** (documented in §4, but they shape everything):
- **Server-dependent surfaces** (crew, verify, exec, research, llm) are TanStack server functions. A file-only agent on the headless CLI **cannot reach them today** — `runCrew`, `verifyAndFix`, `runCode`, `research()`, `complete()` require the app server and, for the first two, a `DEEPSEEK_API_KEY`. The CLI driver deliberately covers only the deterministic core.
- **The bounded runner is not a sandbox.** `node-runner.server.ts:1-21` says it out loud: no filesystem confinement, no rlimits, best-effort proxy scrub only. Never run untrusted code there.

---

## 1. THE COMPLETE AGENT INTERACTION MODEL

### 1.1 The three worlds an agent can inhabit

RapidTool has **three agent-visible worlds**, with different contracts and different reachability:

| World | Surface | Reachable how | Requires |
|---|---|---|---|
| **A. File/CLI world** | `scripts/rapidtool-cli.mjs` → `src/lib/headless.ts` | `node --experimental-strip-types scripts/rapidtool-cli.mjs <verb>` | Node 22 + the flag; project JSON file on disk |
| **B. Browser world** | zustand store (`src/lib/store.ts`) + server functions (`crew.ts`, `verify.ts`, `exec.ts`, `research.ts`, `llm.ts`) | running Vite app; UI (console.tsx) or devtools | dev/prod server; keys for live backends |
| **C. Packet world** | the compiled Agent Packet `.md` (paste target) + per-phase handoff + `[agent report]` JSON | paste into any coding agent; report JSON pasted back | a packet at a HITL edge; ≥12-char rejection notes |

World A is deterministic by default, file-state-only, and is the *only* world a headless agent can drive end-to-end today. World B is where the live backends live (crew, verify, code execution, real research). World C is the human-relay loop AGENT_GUIDE.md describes: agent works from a packet, reports back as `AgentReport` JSON, which the store ingests as `[agent report]` artifacts.

### 1.2 Entry point contracts (world A — CLI)

Every subcommand prints **exactly one JSON object** to stdout and exits `0` (ok) or `1` (error). Errors are `{ ok: false, error: string, usage?: {...} }`. All project state lives in ONE JSON file (created by `create`, mutated in place by every other verb). All file writes are atomic (temp + rename, `headless.ts:51-67`).

**Shared output vocabulary** (definitions an agent must know):
- `summary` (from `summary()`, `headless.ts:402-433`): `{ name, currentPhase, status, phaseCounts: {locked|ready|running|awaiting_hitl|complete|rejected: n}, lastGate: {phase, decision: "approve"|"reject", note: string|null, decidedBy: "human"|"autopilot", decidedAt: number}|null, researchCount, memoryCount, vaultReady }`. `researchCount` > 0 ⟺ live research actually ran (deterministic runs write no corpus). `vaultReady` is a hint that a vault module exists on disk, not a guarantee.
- `status` (project): `intake | running | awaiting_hitl | complete | blocked` (`types.ts:6-11`).
- `stopped: true` means the loop parked at a **natural resting point** — but the CLI does *not* distinguish *why* it parked (`headless.ts:334` computes it from status; see F-02/F-04).
- `events: string[]` accumulates **error strings that did NOT stop the loop** (e.g. `"Waiting on human approval."`); it is not a log of successes.

| Verb | Inputs | Output (ok path) | Mutates | Notes / gotchas |
|---|---|---|---|---|
| `create` | `--brief <text>` (required, non-empty, trimmed), `--name` optional, `--out` optional (default `<slug>.json` in CWD) | `{ ok:true, path, summary }` (`cli.mjs:104-112`) | writes new project file, status `intake`, currentPhase 0, P0 `ready`, rest `locked`; packet compiled immediately (`engine.ts:1086`) | name inferred from brief if absent; `out` resolved against **CWD** |
| `run` | `--project <file.json>`, `--live` optional | `{ ok:true, path, summary, steps, stopped, events }` | advances **exactly one loop iteration** (`maxSteps:1`, `cli.mjs:121`) | one iteration ≠ one phase; an iteration on a parked/blocked project yields `ok:true, steps:1, stopped:true, events:["Waiting on human approval."]` — no phase ran (F-02) |
| `gate` | `--project`, `--autopilot` optional, `--live` optional | same as `run` | advances until parked (awaiting_hitl / complete / blocked) or 40 iterations | parks at first HITL (default: P4 — stock gates P4/P5/P8/P9 are never autopilot-approved, `phases.ts:134`, `headless.ts:221-226`) |
| `approve` | `--project`, `--force` optional | `{ ok:true, path, summary }` | records ledger row `{decision:"approve", decidedBy:"human"}`; phase → complete; next phase → ready; re-stamps packet | pre-check requires `status==="awaiting_hitl" && hitl` (`cli.mjs:142-144`) — but the CLI **bypasses** the store's forceHuman override guard (F-03) |
| `reject` | `--project`, `--note <text>` | `{ ok:true, path, summary }` | ledger row `{decision:"reject", decidedBy:"human"}`; phase → `rejected`; project → `blocked`; hitl cleared | note must be ≥12 chars (thrown by `engine.ts:968-970`, caught → `ok:false`) |
| `ingest` | `--project`, `--report '<json>'` | `{ ok:true, path, summary }` | append-only: `[agent report]` artifacts + log (+ memory rows on `complete`; rejectionHistory entry on `blocked`) | **no phase-match guard** here (F-08); never advances gates |
| `packet` | `--project`, `--out <file.md>` optional | `--out`: `{ok:true, path, bytes}`; else `{ok:true, packet: "<full text>"}` | none (reads stored packet + live notes) | stdout form embeds a multi-KB escaped markdown string; System JSON fence inside (F-05/F-06) |
| `export` | `--project`, `--out <file.json>` optional | `--out`: `{ok:true, path, summary}`; else `{ok:true, summary, project: {…full…}}` | none | the full snapshot round-trips through `importProject` validation (`io.ts:47-90`) |
| `summary` | `--project` | `{ok:true, summary}` | none | the cheap poll verb — use it between every mutation |
| *(exported, **no CLI verb**)* `retry` | — | — | `unlockRetry`: rejected phase → `ready`, status → `running`, hitl cleared | **unreachable from the CLI** (F-01): a rejected project is a dead end for file-only agents |

**Arg parsing** (`cli.mjs:27-55`): `--flag value`, `--flag=value`, bare boolean flags. A value beginning with `--` is treated as a flag — a brief that starts with `--` must use `=` form. `flag()` accepts `true|"true"|"1"` (`cli.mjs:65-67`).
**Exit codes:** only `0`/`1`. All semantic stops (including "waiting on human approval") exit `0`. There is no distinct "parked" code and no `usage` field on most errors (only missing-subcommand/unknown-command errors carry `usage`).

### 1.3 Entry point contracts (world B — store + server functions)

**Store (`store.ts`) actions an agent can call from the browser/UI or by importing `useRapid`:**

| Action | Guard / semantics | Returns | Friction |
|---|---|---|---|
| `create(brief, name?)` | trims name | `project.id` (string, not `{ok}`) | inconsistent result shape vs everything else (string vs `{ok}`) |
| `executeAsync(id)` / `runUntilHitlAsync(id)` | async live path when `llmStatus.configured \|\| researchStatus.configured` (`store.ts:397,408`) | `{ok, ran, stoppedReason: "hitl"\|"complete"\|"blocked"\|"error"\|"cap"\|null, error?}` | **stoppedReason is richer than the CLI's** — the CLI should learn from it (F-04); `ok:false` when zero progress (`store.ts:387-389`) |
| `approve(id, {force, requestedAt})` | guards: project exists; hitl exists; `hitl.phase === currentPhase` (`store.ts:567-570`); forceHuman+failed-P6 requires `force` (`store.ts:573-584`) | `{ok:true}` or `{ok:false,error}` | the *reference* guard semantics the headless CLI bypasses (F-03) |
| `reject(id, note)` | ≥12 chars, phase-match, phase `awaiting_hitl` (`store.ts:603-615`) | `{ok:true}` / `{ok:false,error}` | — |
| `rejectAsync(id, note)` | same as reject + optional LLM guidance artifact (`store.ts:625-656`); guidance failure silently swallowed (`store.ts:652-654`) | `{ok:true}` regardless of guidance | agent can't tell configured-but-failed from no-key (F-15) |
| `retry(id)` | unlocks rejected phase | `void` | returns nothing — agent must poll summary |
| `ingestReport(id, raw)` | validates with **currentPhase match** (`store.ts:498`; `report-intake.ts:77-82`); complete-with-no-evidence → warn log (`store.ts:503-512`) | `{ok:true}` / `{ok:false,error}` | warn fires **unconditionally** — tests_run never survives validation (F-09) |
| `runModuleReal(id)` | real bounded run of the P6 module (runner + DeepSeek-free) | `{ok, result: ExecResult\|null, error?}` | bounded runner, NOT a sandbox |
| `exportProject(id)` | | JSON string or null | — |
| `importProject(json)` | validate+hydrate; **replaces same-id project silently** (`store.ts:723-743`) | `{ok:true,id,name,replaced}` | destructive-by-default for an agent that doesn't expect it (F-14) |
| `refreshPacket(id)` | re-stamp | void | — |
| `refreshStatuses()` | probes llm/research status **server-side** (`store.ts:520-563`) | void | research status reports `configured:true` whenever the server runs (keyless fallback, F-12) — which flips `executeAsync` onto the *live* path by default in the UI (`console.tsx:466,604,636`) while the CLI stays deterministic |

**Server-function entry points** (each has a client wrapper that never throws — catch → `{ok:false, reason:"error"}`):

| Module | Function | Input → Output | Activation |
|---|---|---|---|
| `crew.ts:138` | `runCrew(project, {maxSteps?})` | `{ok:true, messages: CrewMessage[], artifacts: CrewPhaseArtifact[], stopped: "done"\|"final"\|"max-steps"\|"cost-limit"} \| {ok:false, reason:"not-configured"\|"error", error?}` | DeepSeek key + **server**. Stop semantics: `stopped:"done"` only when every role in the phase's table completed a turn (`crew.server.ts:653-670`); max-steps/cost-limit return the **honest partial transcript**. Crew messages: JSON envelope `{type, content, artifacts:[{title,body,language}]}` for architect/reviewer/tester; markdown `## <title>` sections for prose roles (`crew.server.ts:78-98`). |
| `verify.ts:17` | `verifyAndFix(source, brief, {maxIterations? 1..5})` | `{status: "passed"\|"failed"\|"not-configured"\|"error", iterations, evidence, finalSource?, cases?}` | DeepSeek + bounded runner + **server**. `"passed"` is minted ONLY from a machine runner pass (`verify.server.ts:173-180`). Case grammar: `{cases:[{id, expression}]}`; harness emits `ORACLE_RESULT <id> pass|fail <detail>` / `HARNESS_COMPILE pass|fail` lines (`verify.server.ts:68-90,108-120`). |
| `exec.ts:39` | `runCode(code, {timeoutMs?, runner?})` | `{ok:true, stdout, stderr, durationMs, exitCode} \| {ok:false, reason:"not-configured"\|"timeout"\|"error"\|"refused", error?}` | bounded runner (needs Node on host). `runner` param is test-injection only. |
| `research.ts:49` | `research(query, {maxResults?})` | `{ok:true, query, items:[{title,url,content,score?}], provider?: "tavily"\|"duckduckgo"\|"wikipedia"\|"searxng"} \| {ok:false, reason, error?}` | server; Tavily key → tavily, else keyless DDG/SearXNG/Wikipedia chain |
| `llm.ts:44` | `complete(prompt, {model?, system?, maxTokens?, json?})` | `{ok:true, text, model, usage?} \| {ok:false, reason:"not-configured"\|"error", error?}` | DeepSeek key + server |

### 1.4 Entry point contracts (world C — packet, handoff, report)

**The Agent Packet** (`packet.ts:68-253`; version-stamped `PACKET_VERSION=2`): a single paste-ready markdown document. Critical machine surface: the `## System JSON` fenced ```json``` block (`packet.ts:21-65,138-141`) with envelope fields `packet_version, compiled_at, project_id, name, project_status, current_phase {id, code, title, hitl_gate}, model_route, sandbox {claim, ram_mb, timeout_s, isolated}, verdict, rejection_loop {phase, attempts, last_note}|null, decisions[] {phase, decision, decided_by, note, requested_at, decided_at}, phases[] {id, status, rejections, gate_passed}`. **Prose sections the envelope does NOT cover:** the pending HITL block (title/prompt/stakes — prose only, `packet.ts:92-94`), scorecard axes, artifacts, rejection details.
**Honesty markers an agent must parse, not ignore:** `(deterministic feasibility estimate — template-derived, not live research)` (`packet.ts:215`); `source:"illustrative"` rows are scaffolding (`types.ts:63-70`); `## Research sources (live)` appears only when the corpus is non-empty (`packet.ts:226-228`); narrative artifacts carry grounded/ungrounded footers (`headless.ts:166-170`, `engine.ts:1240-1241`); `…[TRUNCATED — regenerate at a HITL gate for the full plan]` means the packet was cut at 14 000 chars (`packet.ts:249-251`).

**The required output schema** (`packet.ts:232-243`): the working agent must return markdown with exactly the headings `Phase work; Files; Patch; Tests; Risks` (+ `Next legal edge`). This is the **only place the machine tells the agent what to return** — and it sits at the very END of a packet that can be truncated (F-06) and is duplicated in different wording by `handoff.ts:102-107`.

**Per-phase handoff** (`handoff.ts:24-110`): focused one-phase prompt (role/mission/prior-artifact context/DoD checklist/constraints/expected output). UI-only today (`console.tsx:771`), unreachable from the CLI (F-13).

**AgentReport ingest JSON** (`report-intake.ts:31-39`): `{ phase: 0-12, status: "complete"|"blocked"|"partial", summary: non-empty string, artifacts?: [{title, body, language?}], files?: string[], tests_run?: [{command, pass, evidence?}] }`. Validation (validateReport) rejects: non-object, bad phase int, bad status, empty summary, non-array/non-string artifacts/files. **Extra fields are dropped silently; `tests_run` is declared but never validated or carried** (F-09). Application (applyReport): artifacts land as `kind:"docs"` with id prefix `report-` + title prefix `[agent report] ` + footer `> external report — unverified by engine` (`report-intake.ts:45-50,130-137`) — distinguishable from engine output by construction. `blocked` reports append a `rejectionHistory` entry (attempt counting) but never flip phase status or touch the ledger (`report-intake.ts:160-168`); `complete` reports write 1 semantic + N episodic memory rows (`report-intake.ts:173-192`).

**HITL decision JSON** (in `export` output / packet envelope): `{id, phase, title, decision: "approve"|"reject", note?, decidedBy: "human"|"autopilot", requestedAt, decidedAt}`; ledger capped at last 100 (`engine.ts:911`). Rejections additionally write `rejectionHistory` per phase (`engine.ts:974-979`) — the packet's `rejection_loop` and the prose `## Rejection loop` section derive from it.

### 1.5 The state machine in one screen (deterministic core)

`emptyProject` → P0 ready, rest locked (`engine.ts:1040-1043`). Each `advanceOnce` (`headless.ts:277-305`): guard phase record exists → not blocked/rejected → not locked → not awaiting (unless autopilot can take it) → if complete advance to `phase+1` if `canEnter` (always `from+1`, `phases.ts:118-120`) and priors sealed (`phases.ts:122-131`) → `runReady` executes the phase → status `complete` (or `awaiting_hitl` when a gate opened; P6 sandbox failure opens a **forceHuman** gate, `engine.ts:774-782`) → advance/approve/stamp (`headless.ts:257-275`). Autopilot may approve only when: enabled ∧ hitl ∧ ¬forceHuman ∧ ¬STOCK_HITL[4,5,8,9] ∧ tightness < 7.2 (`headless.ts:221-226`) — **note: headless omits the store's extra DoD-pass requirement** (F-05). P12 completion leaf → status `complete`.

**Deterministic vs live:** deterministic `runPhase`/`applyPhaseResult` makes zero network calls. `--live` (CLI) / configured async (store) layers real research (Tavily → keyless DDG/SearXNG/Wikipedia) on P0/P7/P11 and optional DeepSeek narratives on any phase; **every live failure degrades silently to the deterministic floor** (`headless.ts:209-211`, `engine.ts:1395-1409`) — the agent is never told which happened except via `researchCount` / artifact presence.

---

## 2. FRICTION REGISTER

Every place an agent can misread, stall, or silently diverge. `[S]` = blocks perfect autonomous use; `[M]` = likely misread; `[m]` = cosmetic.

| # | Seam | Location | Class | Friction |
|---|---|---|---|---|
| F-01 | CLI | `cli.mjs:103-226` (no `retry` case) vs `headless.ts:354-356` (exported `retry`) | Missing entry point | After `reject`, project is `blocked` with a `rejected` phase. The CLI exposes **no way to unlock/retry** (store has `retry`, `store.ts:657-664`). A file-only agent must hand-edit JSON or die. `[S]` |
| F-02 | CLI run/gate | `cli.mjs:124-134`; `headless.ts:327-336` | Ambiguous output | `run`/`gate` print `ok:true` even when the only "event" was `"Waiting on human approval."` (or `"Phase is locked."` ×40, or `"Phase rejected — retry…"`), and `steps:1` was counted for an iteration that advanced **nothing** (counter increments before `advanceOnce`). An agent checking only `ok`/`steps` misreads state. `[S]` |
| F-03 | CLI approve | `cli.mjs:138-149` → `headless.ts:344-346` → `engine.ts:871-960` vs store reference `store.ts:571-584` | Silent policy bypass | The UI requires an explicit "I reviewed the failure" override (`force`) to approve a **failed P6 sandbox** (forceHuman gate) and then logs `hitl.approved_override` + memory row (`engine.ts:899-933`). The CLI `approve` calls `approveHitl(decidedBy:"human")` directly: succeeds **without `--force`**, records no override. Also: `approveHitl` returns the project **unchanged** (no throw) when `hitl.phase !== currentPhase` (`engine.ts:886`) — CLI pre-check only tests `hitl` exists (`cli.mjs:142`), so a stale-gate approve prints `ok:true` while doing nothing. `[S]` |
| F-04 | CLI stop reason | `cli.mjs:124-134`; `headless.ts:334-335` | Missing field | Store has `stoppedReason: hitl\|complete\|blocked\|error\|cap` (`store.ts:25-29,387-389`); CLI output only has boolean `stopped` + `summary.status` + an opaque `events[]`. Agents must re-derive "did it park on a gate I must approve?" from three fields. `[M]` |
| F-05 | headless autopilot + DoD | `headless.ts:221-226,257-275` vs `store.ts:126-134,192-216` | Drifted duplicate logic | Headless `canAutopilot` claims to mirror store's but is missing the M-09 DoD check (`runGate(...).pass`, `store.ts:132`), and headless `finishPhase` never calls `recordGate` (`store.ts:197` does) — so headless-run projects have `gate_passed: null` everywhere except post-approval, and headless autopilot can approve a phase that fails its own DoD. The packet's System JSON then reports `null` gates an agent may read as "not checked". `[S]` |
| F-06 | packet truncation | `packet.ts:249-251` (cut) vs `packet.ts:21-65` (envelope) and `packet.ts:232-243` (schema) | Output corruption | At >14 000 chars the packet is sliced from the top — the `## System JSON` fence (which grows with the decision ledger: ≤100 rows × ~250 chars pretty-printed, `engine.ts:911`) can be cut **mid-JSON**, leaving an unparseable fenced block; and the variable-length middle (ledger, memory, artifacts) can push the **Required output schema + Next legal edge** — the one section that tells the agent how to reply — past the cut. Worst case: truncation marker lands inside the ```json fence. `[S]` |
| F-07 | packet envelope | `packet.ts:27-64` | Missing field | System JSON has no **pending HITL** object (title/prompt/stakes/force_human/requested_at) and no per-phase `gate.unmet` criteria. A parser must regex prose `PENDING HITL:` (`packet.ts:92-94`) — brittle, and prompt text can contain anything. `[M]` |
| F-08 | ingest parity | `headless.ts:359-363` (no `currentPhase`) vs `store.ts:495-515` + `report-intake.ts:77-82` | Contract divergence | Store rejects reports whose `phase` ≠ current edge; headless `ingest` accepts them (writes off-phase artifacts/logs/rejectionHistory/memory). Same agent report → different acceptance across entry points. Also headless ingest never emits the store's `complete`-without-evidence warn. `[S]` |
| F-09 | report evidence | `report-intake.ts:31-39` (type) + `:120-123` (validator never copies it) + `store.ts:503-512` | Dead field / always-on warning | `AgentReport.tests_run` (M-05 "evidence-carrying intake") is **silently dropped by validateReport** — the type says it, agents are told to send it, the store checks it — so `v.report.tests_run?.length` is always 0 and the warn log `"complete report with no tests_run evidence"` fires for **every** complete report, even evidence-carrying ones. The one place the engine checks agent honesty is a lie. `[S]` |
| F-10 | two live layers | `headless.ts:102-195` vs `engine.ts:1306-1393` | Duplicated logic | `engine.liveLayer` is exported explicitly "so the headless driver … can apply the SAME live layer" (`engine.ts:1300-1302`) — but headless.ts defines its **own** copy (imports `tavily.server.ts`/`websearch.server.ts`/`deepseek.server.ts` directly instead of the `research()`/`complete()` wrappers). Artifact ids, corpus entries, narrative ground-caps already differ subtly; future drift is certain. `[M]` |
| F-11 | runner output | `node-runner.server.ts:119-126` (`.slice(-MAX_OUTPUT)`) + `verify.server.ts:108-120` | Error swallowed / misattributed | The runner keeps the **tail** of each stream. When stdout > 1 MB, the harness's `HARNESS_COMPILE`/`ORACLE_RESULT` protocol lines (printed at the start) are sliced away → `runCases` sees `results.length < cases.length` → verdict `failed` with evidence "machine-run cases still failing" when the real cause was truncation. Markers are at the head; the truncation keeps the tail. `[m]` (rare, adversarial output only) |
| F-12 | status lie | `research.ts:40-47` (`configured:true, provider:"duckduckgo"` always, even when the chain will serve SearXNG/Wikipedia) + `store.ts:520-563` (labels `researchStatus.configured=true`) | Silent fallback / mislabel | Keyless fallback is "always available" → `store.refreshStatuses` reports research **configured** on any live server → `executeAsync`/`runUntilHitlAsync` take the **live path by default in the UI** (network calls on P0/P7/P11) while the CLI is deterministic by default. Same product, opposite defaults, and the provider label can be wrong. An agent auditing "does this run touch the network?" cannot answer from state alone. `[M]` |
| F-13 | unreachable surfaces | `handoff.ts:24` (UI-only, `console.tsx:771`); `verify.ts:17`, `exec.ts:39`, `crew.ts:138` (server-fn only; verify has **no UI caller at all** today — grep of `src/components` finds only `runCrew`) | Missing entry points | The per-phase handoff prompt, the machine verify-fix loop, and bounded code execution cannot be invoked from the file world. A CLI agent cannot: fetch a one-phase handoff, run `verifyAndFix`, or execute a module — the three things AGENT_GUIDE §4 tells agents to do. `[S]` |
| F-14 | import/replace | `store.ts:723-743` | Destructive default | `importProject` with an id already in the store **silently replaces** that project. A sync/restore agent that imports over a live project destroys it with no flag. (CLI has no `import` verb at all — `loadProject` only parses.) `[M]` |
| F-15 | rejectAsync guidance | `store.ts:625-656` (`catch { /* guidance optional */ }`, returns `{ok:true}`) | Error swallowed | A configured-but-failed LLM guidance call and a not-configured backend are indistinguishable to the caller — both yield `ok:true` with no artifact. Agent can't tell whether steering guidance exists. `[m]` |
| F-16 | operator-notes duplication | `packet.ts:145-152` (embedded in compile) + `io.ts:93-97` (appended again at export) + `console.tsx:505`/`1144` (copy/download use stored packet / exportPacketText) | Output duplication | When `project.notes` is non-empty, a packet exported via `exportPacketText` (CLI `packet --out`, UI Download) contains **two** "Operator notes" sections — the compiled one (possibly stale, stamped at last packet compile) and the freshly-appended one (live). An agent pasting the file sees the same steering twice; if notes changed since the last stamp the two copies **contradict**. `[M]` |
| F-17 | CLI `run` phase mismatch | `headless.ts:200-212` (`runPhase` out-of-range → returns project unchanged) | Silent no-op | `runPhase` is exported and swallows invalid phases; only internal callers are safe today, but any future CLI verb that exposes a phase argument inherits a silent no-op. `[m]` |
| F-18 | packet line-pair integrity | `packet.ts:80-87` (artifact bodies truncated at 900 chars, last 8 only) + `packet.ts:226-228` | Ambiguous output | Research citations survive trimming only because of the separate corpus section; a non-research artifact's *content* is silently truncated with `…`. Fine for humans; an agent asked to "patch per the packet" may act on a half artifact. Mitigated by the file list in reports. `[m]` |
| F-19 | role-name drift | `types.ts:175` (`CrewRole = architect|implementer|reviewer|tester`) + `crew.ts:24-30` (`coder`) + `crew.server.ts:103-136` + `packet.ts:166-169` | Ambiguous labels | Static A8 crew seats say `implementer`; live crew roles say `coder` (mapped via `toAgentRole`). Packet `## Crew (A8)` lists static names; crew-tab transcripts list live names. An agent correlating the two sees two different role vocabularies for the same seat. `[m]` |
| F-20 | store.create shape | `store.ts:312-323` | Inconsistent output | Returns bare `project.id` string where every sibling action returns `{ok,…}`. A store-level automator that uniformly checks `.ok` breaks on create. `[m]` |
| F-21 | concurrent mutation | `headless.ts:43-67` (load → mutate → atomic save, no locking) | Race | Two agents (or one agent + UI) gating the same file concurrently: last-writer-wins, silent lost update. `gate --live` widens the window (network latency inside the read-modify-write). No `mtime`/version check exists. `[M]` |
| F-22 | keyless research fidelity | `websearch.server.ts:1-18`, `engine.ts:1249-1294` | Honest limitation | Free providers are scrape-quality; items may be sparse, stale, or blocked. `researchCount>0` proves *a fetch happened*, not *usable intelligence*. Narratives fire "whenever DeepSeek is configured, independent of whether live research succeeded" (`headless.ts:124-126`) — grounded/un-grounded footers are the only signal. `[m]` (documented, but agents must be told to read footers) |
| F-23 | verify status vocabulary | `verify.ts:23-29` vs `exec.ts:17-19` | Label collision | `verifyAndFix` statuses `passed|failed|not-configured|error` vs runCode `ok` + reason vocabulary. Two different failure grammars in adjacent modules; a wrapper agent must not conflate `"failed"` (real verdict) with `"error"` (infrastructure). `[m]` |
| F-24 | CLI stdout purity | `cli.mjs:69-72` + any future `console.log` in imported modules | Fragile invariant | The whole agent contract rests on "one JSON object, nothing else" on stdout. Node's `--experimental-strip-types` warning goes to stderr (safe), but the driver's success depends on no dependency ever logging to stdout. Unenforced by any test/guard. `[m]` |

---

## 3. THE PERFECT-AGENT-EXPERIENCE PLAYBOOK

Canonical governed loop for a file-only agent (world A). **Rule of the road:** after every mutation, re-poll with `summary` (or `export` when you need full state) and assert the expected shape from the "Expect" column before proceeding. Never trust `ok:true` alone — F-02/F-03.

Setup: `cd` to a scratch dir; `PROJ=build.json`.

### Step 0 — Create

```bash
node --experimental-strip-types /path/scripts/rapidtool-cli.mjs create \
  --brief "Build a field-service dispatch board: jobs, techs, parts, same-day reroutes." \
  --out "$PROJ"
```

Expected stdout (exit 0):
```json
{ "ok": true, "path": "build.json", "summary": { "name": "Field Service Dispatch Board", "currentPhase": 0,
  "status": "intake", "phaseCounts": { "ready": 1, "locked": 12 }, "lastGate": null,
  "researchCount": 0, "memoryCount": 3, "vaultReady": false } }
```
Assert: `ok`, `status=="intake"`, `currentPhase==0`, P0 ready / 12 locked, `researchCount==0` (no network was touched). `memoryCount==3` is exact — `emptyProject` bootstraps 3 memory rows (`engine.ts:1085`, `algorithms.ts:532-556`). Later samples mark variable counts `(illustrative)` — assert shape, not exact numbers.

### Step 1 — Run to the first gate (deterministic)

```bash
node --experimental-strip-types /path/scripts/rapidtool-cli.mjs gate --project "$PROJ"
```

Expected (exit 0): parks at **P4** (first stock HITL) after completing P0–P3 (5 loop iterations, P4 parks on the 5th):
```json
{ "ok": true, "path": "build.json",
  "summary": { "currentPhase": 4, "status": "awaiting_hitl",
    "phaseCounts": { "complete": 4, "awaiting_hitl": 1, "locked": 8 },
    "lastGate": null, "researchCount": 0, "memoryCount": "(illustrative, > 3)" },
  "steps": 5, "stopped": true,
  "events": ["Waiting on human approval."] }
```
Interpretation contract (see F-04): `status=="awaiting_hitl"` + `summary.currentPhase` is the gate phase. `events` containing "Waiting on human approval." is a **park, not an error**. Assert: stopped, awaiting_hitl, P4; no phase record is `ready` (P5 stays `locked` until P4 is approved).

### Step 2 — Inspect the gate (export is your only full-state read)

```bash
node --experimental-strip-types /path/scripts/rapidtool-cli.mjs export --project "$PROJ"
```
Assert in the returned `project`: `hitl.phase==4`, `hitl.title/prompt/stakes` non-empty, `hitl.requestedAt` set, `phases[4].status=="awaiting_hitl"`, `phases[0..3].gate.passed` non-null (deterministic completes DO get recorded **in the store path only** — on the headless path expect `null` until FIX-05 lands; see F-05), `decisions` empty.

### Step 3 — Approve the gate (with a real reason in the ledger when possible)

```bash
node --experimental-strip-types /path/scripts/rapidtool-cli.mjs approve --project "$PROJ"
```
Expected: `{ "ok": true, "path": "build.json", "summary": { "currentPhase": 5, "status": "running",
  "phaseCounts": { "complete": 5, "ready": 1, "locked": 7 }, "lastGate": { "phase": 4,
  "decision": "approve", "note": null, "decidedBy": "human", "decidedAt": 1760000000000 } } }`
Assert: `lastGate.decision=="approve" && decidedBy=="human"`, currentPhase advanced to 5, P5 now `ready` (phase-record `ready`, project `status: "running"`). Then `gate` again → runs P5, parks at **P5** (steps:1); approve → parks at **P8** after P6+P7 (steps:3); approve → parks at **P9** (steps:1); approve → P10 `ready`. Every park is a stock HITL gate (4/5/8/9 — never autopilot-approvable). Each time re-poll `summary` first.
**P6 special case:** if the deterministic P6 self-test fails, P6 opens a `forceHuman` gate (`engine.ts:774-782`); the UI demands an explicit "I reviewed the failure" override and records `hitl.approved_override`. Today the CLI approves without `--force` and records nothing (F-03); until FIX-03 lands, pass `--force` yourself as the explicit override signal, and after FIX-03 it becomes mandatory.

### Step 4 — Rejection & retry (the steering loop) — *works after FIX-01*

```bash
node --experimental-strip-types /path/scripts/rapidtool-cli.mjs reject --project "$PROJ" \
  --note "Threat model misses the offline warehouse scan path; redo with per-device sync constraints."
# Expect ok:true; status=="blocked"; phase record Px=="rejected"; ledger row decision=="reject" with your note
node --experimental-strip-types /path/scripts/rapidtool-cli.mjs retry --project "$PROJ"   # FIX-01 (today: edit JSON or use UI)
node --experimental-strip-types /path/scripts/rapidtool-cli.mjs gate --project "$PROJ"
```
Contract: the regenerated phase visibly answers the rejection (`engine.ts:788-796` appends a rejection-response block; the packet shows `## Rejection loop` + attempt count, `packet.ts:200-205`). **Never reject with <12 chars** — the engine throws and the CLI exits 1 with `"Rejection requires at least 12 characters of qualitative feedback."`

### Step 5 — Work a phase from the packet (world C hand-off)

```bash
node --experimental-strip-types /path/scripts/rapidtool-cli.mjs packet --project "$PROJ" --out packet.md
```
1. Extract the machine envelope: `sed -n '/```json/,/```/p' packet.md | sed '1d;$d' | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8"))'` → assert `packet_version==2`, `project_status`, `current_phase.id` = the phase you're building, per-phase `gate_passed`/`rejections`.
2. Honor prose truth markers: `Execution:` line = engine-template runner claim; scorecard = deterministic estimate; `illustrative` rows = scaffolding (AGENT_GUIDE.md:9-13).
3. Do the phase work and return **markdown with exactly**: `Phase work / Files / Patch / Tests / Risks` (+ `Next legal edge: only P{n+1}`).

### Step 6 — Ingest the agent report (close the loop; store semantics)

The working agent's output, converted to JSON, lands via `ingest`:
```bash
node --experimental-strip-types /path/scripts/rapidtool-cli.mjs ingest --project "$PROJ" \
  --report '{"phase":5,"status":"complete","summary":"Validated HITL loop with adversarial sim; added rejection-driven regeneration tests.",
  "files":["src/lib/hitl.ts"],"tests_run":[{"command":"npm test -- hitl","pass":true,"evidence":"12 passed"}],
  "artifacts":[{"title":"HITL loop validation","body":"# What changed\\n…","language":"markdown"}]}'
```
Expected: `{ok:true, path, summary}`; `summary.memoryCount` grew by 2 (semantic + episodic rows, `report-intake.ts:173-192`). After ingest: `export` and assert artifacts carry the `[agent report] ` title prefix and the `> external report — unverified by engine` footer — **never** confuse them with engine artifacts.
Contract notes: `phase` must equal the current edge (store path rejects mismatches — FIX-08 extends this to headless); `status:"blocked"` reports record an attempt but don't advance anything — you then reject-with-note + retry; a `complete` report with no `tests_run` earns a warn log (today: always — F-09).

### Step 7 — Run to completion

```bash
node --experimental-strip-types /path/scripts/rapidtool-cli.mjs gate --project "$PROJ"
```
With P4/P5/P8/P9 approved, the remaining run is P10 → P11 → P12 (3 iterations) and parks only if the scheduler opened an **extraHitl** gate (`schedule.extraHitl`, `packet.ts:164`) or P6 re-opened forceHuman. Expect final `status=="complete"`, `phaseCounts.complete==13`, `stopped:true`. `--autopilot` only accelerates *non-stock, non-forceHuman* gates on loose schedules (`tightness < 7.2`); stock gates 4/5/8/9 are never autopilot-approved, and headless autopilot currently lacks the store's DoD-pass check (F-05 → FIX-05) — prefer explicit `approve` over `--autopilot` until that lands. **P9 is a deploy gate — do not deploy without HITL on P9** (AGENT_GUIDE.md; `packet.ts:243`).

### Step 8 — Export & verify the artifact trail

```bash
node --experimental-strip-types /path/scripts/rapidtool-cli.mjs export --project "$PROJ" --out final.json
```
Assert in `final.json`: 13 phases complete; ≥13 artifacts; every non-null `gate.passed` recorded where store semantics apply; `decisions[]` matches your approve/reject history (append-only, monotonic `decidedAt`); `logs[]` shows `phase.enter` / `algo.run` / `hitl.approved` / `hitl.rejected` / `agent.report` events (`types.ts:97-103` taxonomy); `memory` ≤ 80 rows (`engine.ts:820`).

**The server-side loop** (world B, when a server + DeepSeek key exist — after FIX-13, reachable from the CLI):
`verify` a module: `{status:"passed", iterations:1, evidence:"2/2 machine-run cases passed on iteration 1", cases:[{id:"case-1", expression:"add(2,3)===5"}], finalSource}` — only a machine runner pass mints `"passed"` (`verify.server.ts:173-180`). Run the P6 module for real: `{ok:true, result:{ok:true, exitCode:0, stdout, stderr, durationMs}}` — remember the runner is bounded, not sandboxed. Spawn the crew: `{ok:true, messages:[…], artifacts:[…], stopped:"done"|"final"|"max-steps"|"cost-limit"}` — a non-`done` stop is an honest partial transcript, ingest it as `status:"partial"` (`console.tsx:714-722`).

---

## 4. HONEST LIMITATIONS (documented, not fixed by the playbook)

1. **Research needs the server.** `research()`, the engine's live layers, and the UI async path execute through server functions / server-only modules (`research.ts:29-38`, `engine.ts:1249-1294`). A bare-Node CLI agent gets deterministic scaffolds only (its `--live` layer does work headless — but that's the drift-prone duplicate, F-10).
2. **Verify/crew/exec need a server + keys.** `verifyAndFix` and `runCrew` are DeepSeek-gated (`verify.server.ts:158-160`, `crew.server.ts:625`); `verifyAndFix` has no UI or CLI caller anywhere in `src/components` today.
3. **The bounded runner is not a sandbox** (`node-runner.server.ts:1-21`; AGENT_GUIDE.md:80): temp-dir courtesy, proxy scrub best-effort, no OS isolation. Never run untrusted code.
4. **Deterministic ≠ verified.** Deterministic phases are *template scaffolds*; the scorecard is a "deterministic feasibility estimate" (`packet.ts:215`); competitor rows and pre-live research are `illustrative` and never promoted (`types.ts:63-70`, M-01).
5. **UI persistence is browser localStorage** (`store.ts:761-774`, `rapidtool.v4`); the file world is the durable one. Cross-machine handoff = export JSON ↔ import (validation + repair, `io.ts:47-90`, `engine.ts:1136+`).
6. **No concurrency control** on the project file (F-21) and no machine-verifiable packet staleness field beyond `compiled_at` inside the envelope.
7. **Evidence hashes are FNV-1a** — integrity, not cryptography (AGENT_GUIDE.md:83).
8. **The UI's async path goes live by default** on any running server (F-12) — the CLI's deterministic default is the honest one for reproducible runs.

---

## 5. FIFTEEN CONCRETE FIXES (mapped to files)

Priority: **P0** = blocks the mission; **P1** = misread risks; **P2** = polish.

| Fix | File(s) | Change | Frictions |
|---|---|---|---|
| **FIX-01 (P0)** | `scripts/rapidtool-cli.mjs` (+ `headless.ts` unchanged — `retry` already exported at :354) | Add a `retry` subcommand mirroring `store.retry` semantics: pre-check `status=="blocked"` + current phase `rejected`, call `h.retry`, save, print `{ok:true,path,summary}`; add to `USAGE`. | F-01 |
| **FIX-02 (P0)** | `scripts/rapidtool-cli.mjs:124-134`, `headless.ts:307-336` | Add an explicit `outcome` field to run/gate output: derive `"hitl"\|"complete"\|"blocked"\|"error"\|"cap"\|"progress"` from final status + last event (port `store.ts:25-29,387-389` logic), and count `steps` as *phases completed* not loop iterations (increment only when `r.project.currentPhase` changed or a gate opened). Never print `ok:true` with a non-actionable park without `outcome` saying so. | F-02, F-04 |
| **FIX-03 (P0)** | `headless.ts:344-346` (+ engine or store guard) | Mirror store's `approve` guard (`store.ts:567-584`): refuse `forceHuman` + failed P6 (`lastTest.ok===false`) unless `--force`; enforce `hitl.phase===currentPhase` and return `ok:false` instead of silent no-op. Teach `approveHitl` (engine.ts:886) or the headless wrapper to throw/report when it would no-op. | F-03 |
| **FIX-04 (P0)** | `report-intake.ts:56-124` + `store.ts:503-512` + `headless.ts:359-363` | (a) Validate and carry `tests_run` (`AgentTestRun[]`: command string, pass boolean, optional evidence string) into the validated `report`; (b) make the store's no-evidence warn actually conditional; (c) add the phase-match guard (`validateReport(raw, project.currentPhase)`) to headless `ingest`; (d) surface tests_run evidence in the ingested log detail. | F-08, F-09 |
| **FIX-05 (P0)** | `headless.ts:221-226,257-275`, `store.ts:83-124` | Extract `store.recordGate` into `dod.ts`/`engine.ts` (pure, no zustand) and call it from headless `finishPhase` after every completion; add the M-09 `runGate(...).pass` condition to headless `canAutopilot`. Headless and store then produce identical gates + identical autopilot policy. | F-05 |
| **FIX-06 (P0)** | `packet.ts:21-65,68-253` | (a) Serialize the System JSON **compactly** (no 2-space indent) and place the ```json fence immediately after `## System JSON` (already near-top); (b) reserve the tail: truncate **middle** sections (ledger >20 rows, memory, artifacts) instead of slicing the string from the top; (c) move the `Required output schema` block **above** the variable-length sections; (d) cap envelope decisions at the most recent 20 with `decisions_total` so the fence can never exceed budget. | F-06 |
| **FIX-07 (P1)** | `packet.ts:21-65` | Add envelope fields: `pending_hitl: {phase,title,prompt,stakes,force_human,requested_at}\|null`, `current_phase.status`, and per-phase `gate.unmet[]`. Keeps the prose honest, makes the machine block self-sufficient. | F-07 |
| **FIX-08 (P1)** | `io.ts:93-97`, `packet.ts:145-152`, `headless.ts:366-368` | Single-source operator notes: keep them embedded in the compiled packet (packet.ts) and **drop the exportPacketText re-append**; instead append `## Operator notes (live, unstamped)` ONLY when `project.notes` differs from the compiled copy (compare against the embedded block) — or simply drop the append and rely on `refreshPacket` before export (note: `packet` verb should `refreshPacket`-stamp first so the file is never stale). | F-16 |
| **FIX-09 (P1)** | `headless.ts:102-195` | Delete the local `liveLayer`/`researchQueryFor`/`liveLayer` duplicates and import `engine.liveLayer` (`engine.ts:1306`) — it exists precisely for this. One live layer, one artifact-id scheme, one set of footers. | F-10 |
| **FIX-10 (P1)** | `scripts/rapidtool-cli.mjs`, `headless.ts`, `handoff.ts`, `verify.server.ts`, `crew.server.ts`, `node-runner.server.ts` | Close the file-world gaps: new verbs — `handoff --project [--phase]` (pure, `handoff.ts:24`), `verify --source <file|-> --brief <text> [--max-iterations]` (serverless-capable: deepseek + node-runner import fine under bare Node with `DEEPSEEK_API_KEY` set), `run-code --source <file|-> [--timeout-ms]` (node-runner, honest `not-configured` when unavailable), `crew --project [--max-steps]`, `research --query`, `status` (probe `isDeepSeekConfigured`/tavily/runner like `store.refreshStatuses` but honest + file-world), `import --in <json>`. Update `USAGE` + the header comment. | F-13 |
| **FIX-11 (P1)** | `research.ts:40-47` (+ `store.ts:520-563`) | Make `researchStatus()` report the *actual* fallback tier truthfully — probe the chain result provider or return `provider:"free"` + `label:"free (duckduckgo/searxng/wikipedia fallback)"`, never a specific wrong provider. Have `refreshStatuses` distinguish "live research will fire" from "deterministic only" — surface `liveByDefault` in the UI/store so the CLI-vs-UI default divergence is explicit. | F-12 |
| **FIX-12 (P1)** | `store.ts:723-743` (+ CLI `import` verb) | Add `replace:boolean` opt-in (default false) for same-id imports; return the conflict in `{ok:false, error:"id exists — pass replace:true"}` instead of silently clobbering. CLI `import` (FIX-10) takes `--replace`. | F-14 |
| **FIX-13 (P2)** | `node-runner.server.ts:119-126`, `verify.server.ts:108-120` | For protocol runs, keep the **head** of stdout (markers are emitted first) or — better — have `buildHarness` print a single terminal JSON line (`{"compile":"pass","results":[...]}`) and have `runCases` parse only that; keep tail-kept output for humans. | F-11 |
| **FIX-14 (P2)** | `store.ts:625-656` | Return guidance outcome: `{ok:true, guidance?: "applied"|"skipped-no-key"|"failed"}` (or a parallel `warn` field) so callers know whether the steering artifact exists. | F-15 |
| **FIX-15 (P2)** | `crew.ts:24-30`/`types.ts:175`/`packet.ts:166-169` + `cli.mjs:69-72`/F-24 | (a) Normalize role vocabulary — `coder` → `implementer` (or document the alias in one canonical table with tests); (b) add a tiny `scripts/` test asserting every CLI subcommand's stdout parses as exactly one JSON object (stdout-purity guard) — protects the core agent contract from future logging. | F-19, F-24 |

**Each fix is independently testable:** FIX-01/02/03/04/05/08/09/15b have pure-Node test seams (`node --experimental-strip-types --test src/lib/*.test.ts` conventions; new cases in `headless.test.ts`, `report-intake.test.ts`, `packet.test.ts`); FIX-06/07 need packet golden tests; FIX-10/12/13 need CLI-level integration cases run under bare Node.

---

*Cross-references: `research/multiagent/03_crew_design.md` (crew wire format), `04_verification_design.md` (verify loop), `05_live_guidance.md` (running corrections), `AGENT_GUIDE.md` (human-facing consumption rules this audit formalizes for machines), `agentnotes.md` Parts 0–11 (platform QA baseline).*
