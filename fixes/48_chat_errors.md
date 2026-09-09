# 48 — Copilot chat core + machine-readable error codes + DeepSeek integrity

Wave 48 lands three foundations for the AI-interface layer: a typed error-code
system, a grounded copilot chat, and hardened DeepSeek failure classification.
Everything is additive — no existing export was renamed or removed, and no
file outside the ownership list was touched.

## 1. src/lib/errors.ts (NEW) — the error-code system

### Exports

| Export | Type | Purpose |
| --- | --- | --- |
| `ERROR_CODES` | `readonly ["RT_E_UNKNOWN", ...]` | Canonical ordered list of the 14 codes. |
| `ErrorCode` | union of `ERROR_CODES` | The machine-readable code type. |
| `CodedFailure` | `{ ok: false; error: string; code: ErrorCode }` | Typed failure shape. |
| `codeError(code, detail)` | `(ErrorCode, string) => CodedFailure` | Build a typed failure result. |
| `classifyError(err, fallback?)` | `(unknown, ErrorCode?) => ErrorCode` | Classify a **thrown** error → code. |
| `ERROR_CODE_DOC` | `Record<ErrorCode, { meaning: string; agentAction: string }>` | One-line meaning + one line telling an AI agent what to do. |

### Codes

`RT_E_UNKNOWN`, `RT_E_PROJECT_MISSING`, `RT_E_PHASE_ILLEGAL`, `RT_E_GATE_PENDING`,
`RT_E_REPORT_INVALID`, `RT_E_REPORT_PHASE_MISMATCH`, `RT_E_RUNNER_UNAVAILABLE`,
`RT_E_RUNNER_FAILED`, `RT_E_LLM_NOT_CONFIGURED`, `RT_E_LLM_TIMEOUT`,
`RT_E_LLM_REJECTED`, `RT_E_RESEARCH_UNAVAILABLE`, `RT_E_VALIDATION`,
`RT_E_INTERNAL`.

### classifyError matcher order (documented contract)

1. `err.name === "ReportRejectedError"` → `RT_E_REPORT_PHASE_MISMATCH` when the
   message mentions "phase", else `RT_E_REPORT_INVALID`.
2. Node errno `ENOENT` (or "ENOENT" in the message) → `RT_E_PROJECT_MISSING`.
3. `name === "AbortError" | "TimeoutError"` or a timeout-ish message
   (`timed out`, `ETIMEDOUT`, …) → `RT_E_LLM_TIMEOUT`.
4. Nothing matched → the caller-supplied `fallback` (default `RT_E_UNKNOWN`).

### Wiring for the console/CLI integrator

```ts
import { classifyError, codeError, ERROR_CODE_DOC } from "./src/lib/errors.ts";
// or from "../src/lib/errors.ts" inside scripts/rapidtool-cli.mjs — use a
// dynamic import + .ts handling already present in the CLI loader.

try {
  // ... headless/engine call ...
} catch (err) {
  const code = classifyError(err, "RT_E_INTERNAL"); // pass your domain fallback:
  // runner domain: "RT_E_RUNNER_FAILED"; research: "RT_E_RESEARCH_UNAVAILABLE";
  // gates: "RT_E_GATE_PENDING".
  const failure = codeError(code, err instanceof Error ? err.message : String(err));
  const doc = ERROR_CODE_DOC[code];
  // Render: doc.meaning (user-facing), doc.agentAction (what the agent should
  // do next). Exit codes: map RT_E_* to your numeric exit codes — suggested
  // table at the end of this file.
}
```

- **CLI exit-code suggestion** (align with the existing 0/1/2/3 convention seen
  in headless.ts): 0 ok, 1 `RT_E_*` runtime failure, 2 usage/validation
  (`RT_E_VALIDATION`, `RT_E_PHASE_ILLEGAL`), 3 not-configured
  (`RT_E_LLM_NOT_CONFIGURED`, `RT_E_RUNNER_UNAVAILABLE`,
  `RT_E_RESEARCH_UNAVAILABLE`).
- **Console rendering**: look up `ERROR_CODE_DOC[code].meaning` for the toast
  headline and `.agentAction` for the suggested next step; show the raw
  `error` string in a details disclosure.

## 2. src/lib/chat.server.ts + src/lib/chat.ts (NEW) — grounded copilot

### chat.server.ts exports (server-only — never import from client code)

| Export | Type | Purpose |
| --- | --- | --- |
| `ChatTurn` | `{ role: "user" \| "assistant"; text: string }` | One prior turn. |
| `ChatResult` | `{ ok: true; reply: string; grounded: true } \| { ok: false; reason: "not-configured" \| "error"; error?: string; code?: ErrorCode }` | Honest result. |
| `CHAT_CONTEXT_MAX_CHARS` | `2500` | Hard cap of the grounded context. |
| `CHAT_HISTORY_LIMIT` | `6` | History turns kept before the current message. |
| `COPILOT_SYSTEM_PROMPT` | `string` | Grounding rules (answer only from context, admit outside asks, name phase ids). |
| `buildChatContext(project)` | `(Project) => string` | **Deterministic** ≤2500-char compaction. |
| `chatOnceServer(project, userText, history?)` | `(Project, string, ChatTurn[]?) => Promise<ChatResult>` | One grounded turn via DeepSeek FLASH (thinking disabled, 20s timeout, 768 max tokens). |

`buildChatContext` emits, in fixed order: project name, domain, kind,
status, currentPhase (code + title), per-phase statuses (`P0:complete P1:running …`),
last gate verdict + unmet gate ids, packet first line, memory count + top-3
rows (score desc, id asc tiebreak), research corpus entry count, lastTest
(`ok`, `label`, truncated detail), and the open HITL prompt (phase, title,
prompt, `[forceHuman]` marker). Every field is whitespace-collapsed and
truncated; the final join is sliced to 2500 chars. Same input → same string
(covered by `chat.test.ts` including a `structuredClone` determinism check).

`chatOnceServer` behavior:

1. No `DEEPSEEK_API_KEY` → `{ ok: false, reason: "not-configured" }` (no fetch).
2. Empty `userText` → `{ ok: false, reason: "error", code: "RT_E_VALIDATION" }` (no fetch).
3. Else: system prompt + context, history capped to last 6 turns, user message,
   FLASH with `thinking: { type: "disabled" }`.
4. Success → `{ ok: true, reply, grounded: true }`; provider failure → honest
   failure carrying `code` (`RT_E_LLM_REJECTED` / `RT_E_LLM_TIMEOUT` / …).

### chat.ts exports (the client-facing contract — import ONLY this)

```ts
export async function chatOnce(
  project: Project,
  userText: string,
  history?: ChatTurn[],
): Promise<ChatResult>
```

`chat.ts` is a `createServerFn` (POST) wrapper mirroring `llm.ts`: the handler
dynamically imports `chat.server.ts` so the server-only module never lands in
the client bundle; the wrapper catch classifies thrown transport errors with
`classifyError(err, "RT_E_INTERNAL")`. The API key is read server-side only.

### Wiring for the console/CLI integrator

- **Console (React)**: `import { chatOnce } from "../lib/chat.ts"` (or the
  `@/lib/chat` alias). Keep `ChatTurn[]` history in component state, capped to
  6 turns. Show `result.code`/`ERROR_CODE_DOC` on failure.
- **CLI**: call `chatOnceServer` directly (it is pure server code) with the
  loaded `Project`; the CLI already loads `.ts` modules, so
  `import { chatOnceServer } from "../src/lib/chat.server.ts"` works there.
  Pipe `process.env.DEEPSEEK_API_KEY` through unchanged.
- Do **not** import `deepseek.server.ts` or `chat.server.ts` from UI code.

## 3. DeepSeek integrity audit + fixes (src/lib/deepseek.server.ts, llm.ts, llm-tasks.ts)

Audit results and the surgical fixes applied:

| Item | Finding | Fix |
| --- | --- | --- |
| Thinking flags | Correct already: FLASH → `thinking:{type:"disabled"}`, PRO → `{type:"enabled"}` + `reasoning_effort:"high"`. | None needed; copilot rides the FLASH default. |
| Timeouts | Correct per tier (FLASH 20s / PRO 60s) with an AbortController. | Timeout results now carry `code: "RT_E_LLM_TIMEOUT"`. |
| Retry-on-timeout | Timeouts (AbortError) were final and **transient network errors were never retried** — a DNS hiccup killed the call. | `postWithRetry` now retries transient fetch rejections (non-abort) with the same bounded backoff and still returns the last retryable-status response; AbortError stays final because the absolute deadline already fired (retrying cannot succeed in-budget). |
| Empty-content guard | Present. | Now classified `RT_E_LLM_REJECTED` instead of code-less prose. |
| 402 mapping | 402 produced prose only. | All provider refusals (400/401/402/422/429/5xx) and empty content → `code: "RT_E_LLM_REJECTED"`; the 402 message text is unchanged. |
| Key presence | Correct: server-side `process.env` read at call time; the key is never exposed to the client. | `not-configured` now carries `code: "RT_E_LLM_NOT_CONFIGURED"`. |

`llm.ts` / `llm-tasks.ts`: `LlmResult` and the task result types gained an
optional `code?: ErrorCode` (additive); `complete()` classifies its catch with
`classifyError(err, "RT_E_INTERNAL")`; llm-tasks forwards the completer's code
and classifies its own validation gaps (`RT_E_VALIDATION` for unparseable
constraint JSON, `RT_E_LLM_REJECTED` for empty guidance/narrative).

**New additive API on deepseek.server.ts** (no renames/removals):
`DeepSeekCompleteOptions.history?: DeepSeekMessage[]` (+ exported
`DeepSeekMessage = { role: "user" | "assistant"; content: string }`) — prior
turns inserted between the system prompt and the user prompt, capped to the
last 6 entries. Used by `chatOnceServer` for grounded conversation.

## 4. Tests (new + updated, all in src/lib)

- `errors.test.ts` — `codeError` shape; `classifyError` mappings
  (ReportRejectedError by name, phase-mismatch variant, ENOENT, AbortError/
  timeout messages, fallbacks); `ERROR_CODE_DOC` completeness (every code has
  a non-empty one-line meaning + agentAction, no orphan keys, `RT_E_*` prefix,
  uniqueness).
- `chat.test.ts` — `buildChatContext` determinism (same reference + structured
  clone), ≤2500-char budget, and every key field (project/domain/kind/status/
  currentPhase/phases/lastGate/packet/memory top-3/researchEntries/lastTest/
  hitl); `chatOnceServer` honest `not-configured` with the key deleted from
  env, grounded success (FLASH + thinking disabled + system prompt contains
  the context), history capped to the last 6 of 10 turns, 402 →
  `RT_E_LLM_REJECTED`, empty message → `RT_E_VALIDATION` without a fetch.
- `llm.test.ts` (updated) — codes on not-configured/401/timeout; new cases:
  402 → `RT_E_LLM_REJECTED`, transient-network retry (3 attempts → success),
  history message insertion.
- `llm-tasks.test.ts` (updated) — code propagation through the real fetch
  layer and the validation/rejected classifications.

Run: `node --experimental-strip-types --test src/lib/errors.test.ts src/lib/chat.test.ts src/lib/llm.test.ts src/lib/llm-tasks.test.ts`
(or the full `npm test`).

## 5. Ownership notes

Only these files were created/edited: `src/lib/errors.ts`,
`src/lib/errors.test.ts`, `src/lib/chat.server.ts`, `src/lib/chat.ts`,
`src/lib/chat.test.ts`, `src/lib/deepseek.server.ts`, `src/lib/llm.ts`,
`src/lib/llm-tasks.ts`, `src/lib/llm.test.ts`, `src/lib/llm-tasks.test.ts`,
and this file. All changes are additive; every existing export kept its name
and signature.
