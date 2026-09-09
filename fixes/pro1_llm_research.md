# Pro #1 — SERVER LLM + RESEARCH LAYER (DeepSeek + Tavily)

Build agent #1 deliverable: the DeepSeek LLM layer and the Tavily research layer,
per the live-verified spec in `research/deepseek-api.md` and
`research/runtime-integration.md`.

## Files created / modified

| File | Status | Role |
|---|---|---|
| `src/lib/deepseek.server.ts` | NEW | Raw DeepSeek fetch; reads `process.env.DEEPSEEK_API_KEY` server-side only. |
| `src/lib/llm.ts` | NEW | Client-facing LLM contract (`complete`, `llmStatus` + types). |
| `src/lib/tavily.server.ts` | NEW | Raw Tavily fetch; reads `process.env.TAVILY_API_KEY` server-side only. |
| `src/lib/research.ts` | NEW | Client-facing research contract (`research` + types). |
| `src/lib/llm.test.ts` | NEW | Tests for `complete`/`llmStatus`. |
| `src/lib/research.test.ts` | NEW | Tests for `research`. |
| `src/lib/ai.ts` | EDITED | Retired: body replaced with a re-export of `./llm.ts`. |

## Public contract (imported by Pro #3 engine / Pro #4 store — exact)

`src/lib/llm.ts`:
```ts
export type LlmModel = "deepseek-v4-flash" | "deepseek-v4-pro";
export type LlmResult =
  | { ok: true; text: string; model: string;
      usage?: { promptTokens: number; completionTokens: number } }
  | { ok: false; reason: "not-configured" | "error"; error?: string };
export async function complete(prompt, opts?: { model?, system?, maxTokens?, json? }): Promise<LlmResult>;
export async function llmStatus(): Promise<{ configured: boolean; models: string[] }>;
```

`src/lib/research.ts`:
```ts
export type ResearchItem = { title: string; url: string; content: string; score?: number };
export type ResearchResult =
  | { ok: true; query: string; items: ResearchItem[] }
  | { ok: false; reason: "not-configured" | "error"; error?: string };
export async function research(query, opts?: { maxResults?: number }): Promise<ResearchResult>;
```

## Key decisions

- **Key handling**: `deepseek.server.ts` / `tavily.server.ts` read keys via the
  repo's `env()` idiom (`process.env[key]?.trim()`) — **never** `import.meta.env`,
  never a `VITE_` prefix. `llm.ts` / `research.ts` import only from those server
  modules; the browser-facing API has no key reference anywhere.
- **Honesty**: no key → `{ ok:false, reason:"not-configured" }`. No LLM text or
  research is ever fabricated.
- **Models (live-verified)**: `deepseek-v4-flash` (default), `deepseek-v4-pro`.
  `llmStatus().models` returns the exact `/models` list
  `["deepseek-v4-flash","deepseek-v4-pro","deepseek-v4-flash-vision-exp"]` when
  configured, `[]` otherwise. Legacy `deepseek-chat`/`deepseek-reasoner` are NOT
  used (both silently resolve to flash → pro would be downgraded).
- **flash vs pro**: flash sends `thinking:{type:"disabled"}` + `max_tokens` 1024;
  pro sends `thinking:{type:"enabled"}` + `reasoning_effort:"high"` + 8192.
  `json:true` adds `response_format:{type:"json_object"}` plus an explicit
  "respond in JSON" system instruction (§4d requirement).
- **Timeout**: AbortController, 20s flash / 60s pro (LLM); 20s (Tavily).
- **Error map** (§6): 401/402 → config/billing error (no retry); 429/500/503 →
  bounded exponential-backoff retry (LLM 3 attempts, Tavily 2); 400/422/432/433
  → surfaced as typed `{ok:false, reason:"error"}`. Timeout → `error` with a
  "timed out" message.
- **Parsing**: text = `choices[0].message.content` (trimmed, non-empty required);
  `reasoning_content` is never surfaced; `usage` maps `prompt_tokens`/
  `completion_tokens` to `promptTokens`/`completionTokens`. Tavily maps
  `results[].title/url/content/score` into `ResearchItem[]` and echoes the query.
- **`ai.ts` retired**: kept as a zero-inbound-import re-export (`complete`,
  `llmStatus`, `LlmModel`, `LlmResult`) so any stale importer resolves to the
  correct contract instead of the removed `VITE_*` client-bundle key path.

## Verification

- `node --experimental-strip-types --test src/lib/llm.test.ts src/lib/research.test.ts`
  → **13 tests / 3 suites, pass 13, fail 0**.
  Covered: not-configured (no key), success parse, `json` mode body,
  pro-tier body, 401 error, timeout, `llmStatus` (both states),
  `maxResults` forwarding.
- `npx tsc --noEmit` → **my files: 0 errors** (exit code 2 is due solely to one
  foreign file). Final state: the earlier `store.ts` (Pro #4) error resolved
  itself between runs; the single remaining error is in a file I do NOT own and
  did not touch (per ownership rules):
  - `src/lib/node-runner.server.ts(106,7)` — `maxBuffer` not in `SpawnOptions`
    (Pro #2's local runner, actively mid-fix — the file's own comment documents
    their in-progress `stdio` tuple-cast workaround).
- Runtime smoke: `ai.complete === llm.complete` (re-export identity holds);
  no-key paths return exactly `{ok:false,reason:"not-configured"}`.

## Not touched (per ownership)

No edits to `engine.ts`, `packet.ts`, `phases.ts`, `types.ts`, `store.ts`,
`console.tsx`, `io.ts`, `handoff.ts`, `exec.ts`, `report-intake.ts`, `scripts/`,
`public/`, `server/`, `migrations/`, `.env`, `.env.example`, `package.json`.
No key is hardcoded in any source or test file.
