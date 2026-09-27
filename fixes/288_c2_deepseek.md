# 288 — C2 DeepSeek-integration + delegation-to-model sweep

Lane: C2 (owner of the DeepSeek-connection/caching/usage path: `src/lib/llm/providers/deepseek.ts`, the usage record in `src/lib/llm.ts`, prompt-prefix/caching discipline, the `llm-tasks.ts` delegation flow, cassette seam verification).
Started: 2026-09-27 (W39). CODE-ONLY: no tests/gates/keyed calls; real-time smallest patches; `node --check` on each edit.
Read fresh each session.

## Docs captured (api-docs.deepseek.com, 2026-09-27)

- **Models** (api-docs.deepseek.com/): `deepseek-flash` + `deepseek-v4-pro` are the documented request ids. Legacy names `deepseek-v4-flash` / `deepseek-v4-flash-vision-exp` are *still accepted*, served by DeepSeek-V4.1-Flash, billed at Flash price.
- **Pricing** (/quick_start/pricing): separate CACHE HIT / CACHE MISS input-token prices (flash off-peak $0.003 vs $0.15 per 1M) — cache hits are 50× cheaper; usage fields matter for the ledger.
- **Context Caching** (/guides/kv_cache): automatic prefix caching, on by default. A hit requires a FULL match of a persisted "cache prefix unit" (system message + shared content gets persisted when common across requests). Hit status is reported in `usage.prompt_cache_hit_tokens` / `usage.prompt_cache_miss_tokens`.
- **Error Codes** (/quick_start/error_codes): 400-InvalidFormat, 401-AuthenticationFails, 402-InsufficientBalance, 422-InvalidParameters, 429-RateLimitReached, 500-ServerError, 503-ServerOverloaded.
- **Models & Pricing details**: context 1M, max output 384K, thinking on by default both tiers; concurrency limits flash 2500 / pro 500.

## Findings
_(appending findings + real-time fixes as they land)_

## Fix log (append-only)
| # | file:line | bug | patch | evidence |
|---|---|---|---|---|
