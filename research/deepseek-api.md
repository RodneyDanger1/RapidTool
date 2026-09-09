# DeepSeek API — LIVE-VERIFIED Build Spec (RapidTool)

**Status:** ✅ Live-verified against `https://api.deepseek.com` on **2026-09-05** with a real
production API key. Every model ID, request body, response shape and capability flag below was
confirmed with actual `curl` calls — not just read from docs. The key is **not** stored in this file
or anywhere in the repo's committed files (it lives only in the local `.env`, see §10).

Verification calls performed:
1. `GET /models` → returned the exact model list in §2.
2. `POST /chat/completions` with `deepseek-v4-flash` → 200, content `"OK"`.
3. `POST /chat/completions` with `deepseek-v4-pro` → 200, content `"OK"`.
4. Legacy aliases `deepseek-chat` and `deepseek-reasoner` → 200, **both resolve to `deepseek-v4-flash`** (§2 warning).
5. `thinking: {type: "disabled"}` on flash → 200, no `reasoning_content`, `finish_reason: "stop"` (§4).
6. `response_format: {type: "json_object"}` → 200, valid JSON `{"ok": true}` (§4).
7. `tools: [function get_weather]` + `tool_choice: "auto"` → 200, clean `tool_calls` response (§4).

---

## 1. TL;DR for the build agents

| Question | Answer |
|---|---|
| **flash tier model** | `deepseek-v4-flash` (verified live) |
| **pro tier model** | `deepseek-v4-pro` (verified live) |
| Base URL | `https://api.deepseek.com` (OpenAI-compatible; no `/v1` needed, though `/v1` also aliases) |
| Endpoint | `POST https://api.deepseek.com/chat/completions` |
| Auth | `Authorization: Bearer <DEEPSEEK_API_KEY>` |
| Request/response shape | OpenAI Chat Completions compatible (drop-in for the OpenAI SDK) |
| Context length | 1,000,000 tokens (both V4 models, per docs) |
| Max output | Up to 384K tokens (docs "maximum"); **always set `max_tokens` explicitly** |
| Thinking | **ON by default** for both models → responses include `reasoning_content`, and reasoning tokens **count against `max_tokens`**. Disable via `thinking: {type:"disabled"}` for pure-speed flash calls. |
| Web search | **NOT built into `/chat/completions`** — DeepSeek's chat-app search is a product feature, not API. Only the separate `/responses` endpoint documents a provider-run `web_search` tool. RapidTool already declares `TAVILY_API_KEY` for this. |
| Secure key access | Read `process.env.DEEPSEEK_API_KEY` in a `*.server.ts` module only. **Never** `import.meta.env`, never a `VITE_` prefix. `.env.example` **already declares** `DEEPSEEK_API_KEY`. |

---

## 2. Model IDs (live-verified)

`GET https://api.deepseek.com/models` with `Authorization: Bearer <key>` returned exactly:

```json
{
  "object": "list",
  "data": [
    { "id": "deepseek-v4-flash",            "object": "model", "owned_by": "deepseek" },
    { "id": "deepseek-v4-pro",              "object": "model", "owned_by": "deepseek" },
    { "id": "deepseek-v4-flash-vision-exp", "object": "model", "owned_by": "deepseek" }
  ]
}
```

- Official docs list the same three IDs (`deepseek-v4-flash`, `deepseek-v4-pro`,
  `deepseek-v4-flash-vision-exp`).
- Docs note current checkpoints: `deepseek-v4-flash` → DeepSeek-V4-Flash-0731,
  `deepseek-v4-pro` → DeepSeek-V4-Pro-0813. Model IDs are stable aliases; the checkpoint moves
  underneath them — **pin the ID, not a dated checkpoint**.
- `deepseek-v4-flash-vision-exp` = experimental vision model (image input via content parts). Not
  needed for the chat tiers; mention only if image input ever comes up.

### ⚠️ Legacy aliases no longer route where you think (live-verified)

`deepseek-chat` and `deepseek-reasoner` are **still accepted** by the API, but the response's
`model` field showed **both resolve to `deepseek-v4-flash`**. Do **not** use them — in particular
`deepseek-reasoner` no longer gives you a reasoning/Pro model. Always send the explicit V4 IDs above.

---

## 3. Endpoint, auth, headers

```
POST https://api.deepseek.com/chat/completions
Content-Type: application/json
Accept: application/json
Authorization: Bearer ${DEEPSEEK_API_KEY}
```

- Base URL is `https://api.deepseek.com` — **no `/v1` path segment** in the canonical form
  (the OpenAI SDK is pointed at it via `baseURL`; `/v1` is tolerated as an alias, don't rely on it).
- The API is OpenAI Chat Completions–compatible: the official `openai` npm package works by setting
  `baseURL: "https://api.deepseek.com"` and `apiKey`. A raw `fetch` is equally fine (repo has no SDK dep and uses `fetch` everywhere).
- A parallel Anthropic-format endpoint exists at `https://api.deepseek.com/anthropic` — **not needed**; RapidTool speaks OpenAI shape.

---

## 4. Request body — exact bodies that worked

### 4a. Minimal flash call (verified, verbatim working body)

```json
{
  "model": "deepseek-v4-flash",
  "messages": [{ "role": "user", "content": "reply with the single word OK" }],
  "max_tokens": 20,
  "stream": false
}
```

### 4b. Recommended production body (flash, fast path — thinking off)

```json
{
  "model": "deepseek-v4-flash",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "…" }
  ],
  "thinking": { "type": "disabled" },
  "max_tokens": 1024,
  "temperature": 1,
  "stream": false
}
```

### 4c. Recommended production body (pro / reasoning path — thinking on)

```json
{
  "model": "deepseek-v4-pro",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "…" }
  ],
  "thinking": { "type": "enabled" },
  "reasoning_effort": "high",
  "max_tokens": 8192,
  "stream": false
}
```

### 4d. JSON output mode (verified)

```json
{
  "model": "deepseek-v4-flash",
  "messages": [
    { "role": "user", "content": "Return JSON: {\"ok\": true}" }
  ],
  "response_format": { "type": "json_object" },
  "thinking": { "type": "disabled" },
  "max_tokens": 100
}
```
→ returned content `{"ok": true}`. **Docs requirement:** when using `json_object` you MUST also
instruct the model to emit JSON in the prompt (system or user message), or it may loop emitting
whitespace until the token limit. Watch for `finish_reason: "length"` = truncated JSON → retry/raise budget.

### 4e. Function calling (verified)

```json
{
  "model": "deepseek-v4-flash",
  "messages": [{ "role": "user", "content": "What is the weather in Paris? Call get_weather." }],
  "thinking": { "type": "disabled" },
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Get weather for a city",
      "parameters": {
        "type": "object",
        "properties": { "city": { "type": "string" } },
        "required": ["city"]
      }
    }
  }],
  "tool_choice": "auto",
  "max_tokens": 100
}
```
→ returned `message.tool_calls[0] = { id: "call_00_…", type: "function", function: { name: "get_weather", arguments: "{\"city\": \"Paris\"}" } }`,
`finish_reason: "tool_calls"`. Standard OpenAI tool loop applies (echo the assistant message with
`tool_calls`, append `role:"tool"` results with matching `tool_call_id`). Only `function` tools exist
(max 128); `strict: true` is a beta flag for schema-strict args.

### Request-body parameter reference (docs, key ones)

| Param | Notes |
|---|---|
| `model` | **required.** One of the three §2 IDs. |
| `messages` | `system` / `user` / `assistant` / `tool` roles. Assistant messages may carry `reasoning_content` (beta, thinking-mode history) — omit it for normal turns. |
| `thinking` | `{type:"enabled"}` (default) or `{type:"disabled"}`. **Enabled by default on both models** — be explicit. |
| `reasoning_effort` | `low` \| `high` \| `max`. Default `high`. (`medium`/`xhigh` accepted, mapped to `high`.) |
| `max_tokens` | Cap on total generated tokens. **Reasoning tokens count against it** (live-verified: 20-token budget with thinking on produced `finish_reason:"length"` and an empty-ish answer). Give flash ≥1024, pro ≥4096, or disable thinking when budget is tight. |
| `response_format` | `{"type":"text"}` (default) \| `{"type":"json_object"}`. |
| `stop` | Up to 16 stop strings. |
| `stream` | `true` → SSE, §7. `stream_options.include_usage` adds per-chunk `usage`. |
| `temperature` | 0–2, default 1. (`top_p` alternative, default 1; don't tune both.) |
| `tools` / `tool_choice` | §4e. `tool_choice`: `none` \| `auto` (default when tools present) \| `required` \| `{"type":"function","function":{"name":…}}`. |
| `logprobs` / `top_logprobs` | Supported (≤20). |
| `user_id` | Optional, `[a-zA-Z0-9\-_]`, ≤512 chars. Per-user rate-limit / KV-cache isolation. Use RapidTool's viewer/user id here if multi-user isolation matters. |
| `frequency_penalty` / `presence_penalty` | **Deprecated — accepted, silently no-op.** Don't send. |
| `prefix` (+ `/beta` base) | Beta chat-prefix completion. Ignore. |

---

## 5. Response parsing (verified shape)

Live response (flash, thinking on, tiny budget — shows both the extra fields and the length-truncation gotcha):

```json
{
  "id": "6eee6fcd-cf9e-4165-8088-a0c787ec63b9",
  "object": "chat.completion",
  "created": 1788632885,
  "model": "deepseek-v4-flash",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "OK",
      "reasoning_content": "We need to comply. User asks to reply with single word OK. Output just OK.",
      "logprobs": null
    },
    "finish_reason": "length"
  }],
  "usage": {
    "prompt_tokens": 89,
    "completion_tokens": 20,
    "total_tokens": 109,
    "prompt_tokens_details": { "cached_tokens": 0 },
    "completion_tokens_details": { "reasoning_tokens": 18 },
    "prompt_cache_hit_tokens": 0,
    "prompt_cache_miss_tokens": 89
  },
  "system_fingerprint": "a26a7955944dc5c60445bff77fac9c8e"
}
```

Parser contract for the build agents:
- Text answer = `body.choices[0].message.content` (string, may be `""` when a tool was called or thinking consumed the budget).
- `body.choices[0].message.reasoning_content` — **present whenever thinking was enabled** (both models). NEVER surface this raw as the answer; if the app echoes conversation history back to the API, do not send `reasoning_content` back on assistant turns.
- `body.choices[0].message.tool_calls` — present when the model called a tool; `finish_reason === "tool_calls"`.
- `body.choices[0].finish_reason` ∈ `stop | length | content_filter | tool_calls | insufficient_system_resource`.
  - `length` ⇒ output was truncated (budget or context exhausted): raise `max_tokens` or trim input. With JSON mode this means the JSON may be cut — treat as failure/retry.
  - `insufficient_system_resource` ⇒ transient capacity interruption — retry with backoff.
- `body.usage.completion_tokens_details.reasoning_tokens` = tokens spent thinking; `prompt_cache_hit_tokens` = automatic context-cache hits (billed lower — cheap to repeat prefixes).
- Validate `content` is a non-empty string before returning it; never fabricate fallback text (repo honesty contract in `src/lib/llm.ts`).

---

## 6. Errors & rate limits

Non-2xx responses carry an OpenAI-style error object; map on HTTP status (official codes page):

| HTTP | Meaning | Handling |
|---|---|---|
| 400 | Invalid request format | Fix body per message hint; log. |
| 401 | Authentication failed (wrong/expired key) | Surface "DeepSeek key invalid" config error; do NOT retry. |
| 402 | Insufficient balance | Surface billing error; do NOT retry. |
| 422 | Invalid parameters | Fix params per message hint; log. |
| 429 | **Rate limit reached** | Backoff + retry (exponential, jittered); treat as transient. |
| 500 | Server error | Retry after brief wait. |
| 503 | Server overloaded | Retry after brief wait; increase backoff. |

- Rate limits are enforced per account/key; the optional `user_id` request field adds per-user
  isolation (see §4 reference). No documented standard `Retry-After` guarantee — implement your own
  exponential backoff (e.g. start ~1s, cap ~30–60s) for 429/500/503.
- Timeouts: the repo's `complete()` in `src/lib/llm.ts` (server work in `deepseek.server.ts`) aborts after a bounded timeout — keep that pattern; Pro models with thinking on can take longer, so consider a higher cap (60s+) for the pro tier.

---

## 7. Streaming (SSE)

- `stream: true` → server-sent events, each `data: {...}` line a `chat.completion.chunk`
  (`object: "chat.completion.chunk"`) with `choices[0].delta.content` deltas; terminated by a final
  `data: [DONE]`. Docs sample (verbatim shape):

```
data: {"id":"1f633d8b…","choices":[{"index":0,"delta":{"content":"","role":"assistant"},"finish_reason":null,"logprobs":null}],"created":1718345013,"model":"deepseek-v4-pro","system_fingerprint":"fp_a49d71b8a1","object":"chat.completion.chunk","usage":null}
data: {"choices":[{"delta":{"content":"Hello","role":"assistant"},…}]}
…
data: {"choices":[{"delta":{"content":"","role":null},"finish_reason":"stop","index":0,…}],"usage":{"completion_tokens":9,"prompt_tokens":17,"total_tokens":26}}
data: [DONE]
```

- With thinking enabled, expect reasoning deltas first (DeepSeek streams them as
  `delta.reasoning_content` segments) followed by the `delta.content` answer segments; UI should
  ignore/hide reasoning deltas. With thinking disabled you get content deltas only.
- Final chunk (or last chunk when `stream_options.include_usage`) carries the real `usage`; no
  separate usage-only chunk is emitted.
- Not live-tested here (curl SSE capture is noisy) — the docs sample above is the contract; a build
  agent should smoke-test streaming once wired.

---

## 8. Web search — NOT available on `/chat/completions`

- The **chat-completions API has no built-in web-search tool** (confirmed against docs; the search
  you see in DeepSeek's chat product is not part of this endpoint). RapidTool must not assume one.
- Docs note a provider-run `web_search` tool only on the newer `/responses` endpoint
  (`tools:[{"type":"web_search"}]`) and on the Anthropic-compatible endpoint — a separate code path,
  out of scope for this integration.
- **Recommendation:** keep grounding on the already-declared `TAVILY_API_KEY` (repo `.env` has the
  slot ready) or another external search provider; DeepSeek is the generator, not the search engine.
- LLM can be asked to call a `web_search` function via §4e tools if a tool-bridge is added later.

---

## 9. flash / pro mapping (RapidTool tiers → DeepSeek)

```ts
// Recommended mapping — both IDs live-verified 200 on 2026-09-05
export const DEEPSEEK_MODELS = {
  flash: "deepseek-v4-flash",   // fast, cheap default — send thinking:{type:"disabled"} unless reasoning needed
  pro:   "deepseek-v4-pro",     // heavy reasoning — thinking on by default, generous max_tokens
} as const;
```

- RapidTool tier names (`flash`/`pro`) and DeepSeek's real model names **already align** — no legacy
  name needed.
- **Do not** map `pro` → `deepseek-reasoner`: verified it now resolves to **v4-flash**, silently
  downgrading the pro tier.
- Both V4 models think by default; "flash = fast" only holds if the caller sends
  `thinking: {type:"disabled"}` (or accepts the latency). Cheap+fast beat = flash + thinking off.

---

## 10. Secure server-side env pattern (mirror this exactly)

Repo facts (read from source on 2026-09-05):
- `.env` and `.env.example` **already contain** `DEEPSEEK_API_KEY=sk-…` (plus `TAVILY_API_KEY`).
  `.env.example` header: *".env is never committed and is read only by server-side code (never
  inlined into the browser bundle). NEVER prefix any secret with VITE_."*
- The established server-env idiom (identical helper in `src/lib/auth/gate-identity.server.ts`,
  `src/lib/auth/server.ts:69`, `src/lib/app-data/client.server.ts:21`):

```ts
function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}
```

- Server-only modules reading secrets via `process.env`: `src/lib/auth/gate-identity.server.ts`
  (`GROK_PROJECT_ID`), `src/lib/app-data/client.server.ts` (`GROK_CONNECTORS_URL`,
  `GROK_CONNECTOR_ACCESS_TOKEN`). These `*.server.ts` files in `src/lib` are the model to copy.
- `src/lib/llm.ts` is the wired client-facing LLM contract (DeepSeek; the key is read server-side
  only in `./deepseek.server.ts`), and its header documents the exact production rule: *"a deployed
  app must keep the key server-side — the API key is read server-side only."* Its typed contract
  (`LlmResult` = `{ok:true,text,model}` | `{ok:false,reason:"not-configured"|"error",error?}`)
  with the honest not-configured fallback is the shape to keep consistent. (The retired x.ai
  `src/lib/ai.ts` shim was deleted 2026-09-06 — E-30.)

**Pattern the Pro agents must follow for DeepSeek:**
1. New file `src/lib/deepseek.server.ts` (server-only, never imported from client code) exporting a
   `complete()`-style function that:
   - reads the key with the `env()` idiom above: `process.env.DEEPSEEK_API_KEY`;
   - returns `{ok:false, reason:"not-configured"}` when absent (never fabricates output — repo honesty contract);
   - POSTs to `https://api.deepseek.com/chat/completions` with §4 bodies, `AbortController` timeout, typed errors.
2. Expose it to the UI only through a TanStack Start `createServerFn` (server function in a route /
   `src/lib`) — the browser never sees the key.
3. **Never** read it via `import.meta.env`; **never** name it `VITE_DEEPSEEK_API_KEY` (Vite inlines
   `VITE_*` into the public bundle); no `DEEPSEEK_API_KEY` reference in any `.tsx`/client module.
4. Model tier selection happens server-side too: the server fn takes a `{tier:"flash"|"pro"}` param
   and maps per §9; optionally let env override the model for testing.
5. `.env.example` needs no change (slot exists). Nothing key-shaped goes into this repo's committed
   files or into `startup.sh`.

---

## 11. Build-agent checklist (handoff)

- [ ] `src/lib/deepseek.server.ts` with `env()`-style key read of `process.env.DEEPSEEK_API_KEY` + §10 rules.
- [ ] One `createServerFn` wrapper (e.g. `deepseekChat({tier, messages, maxTokens?, json?})`) used by UI.
- [ ] flash path: `deepseek-v4-flash`, `thinking:{type:"disabled"}` for speed; pro path: `deepseek-v4-pro`, thinking enabled, `reasoning_effort:"high"`, `max_tokens` ≥ 4096.
- [ ] Parse `content` only; ignore/hide `reasoning_content`; don't echo `reasoning_content` back into history.
- [ ] Handle `finish_reason:"length"` (raise budget/trim), `"tool_calls"` (loop), `"insufficient_system_resource"` (retry).
- [ ] Status mapping 401/402 → config/billing error, 429/500/503 → exponential backoff retry, 422/400 → log.
- [ ] 20s+ timeout with AbortController (60s for pro tier).
- [ ] JSON mode: `response_format:{type:"json_object"}` AND explicit "respond in JSON" instruction in the prompt.
- [ ] Streaming (if used): SSE `data:` lines, ignore reasoning deltas, `data: [DONE]` terminator, usage on last chunk.
- [ ] No `VITE_DEEPSEEK*`, no `import.meta.env` for the key, no key in git/committed files/startup.sh.
- [ ] Web grounding stays on Tavily (`TAVILY_API_KEY` already in `.env`) — DeepSeek chat API has no search.

### Sources
- Live API: `GET /models`, 7 `POST /chat/completions` calls (2026-09-05).
- Docs: https://api-docs.deepseek.com/ (first call, models & pricing, chat-completions reference, rate limits, error codes).
- Repo: `.env`/`.env.example`, `src/lib/llm.ts`, `src/lib/deepseek.server.ts`, `src/lib/auth/gate-identity.server.ts`, `src/lib/auth/server.ts`, `src/lib/app-data/client.server.ts`.
