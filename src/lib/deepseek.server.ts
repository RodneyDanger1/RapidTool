/**
 * DeepSeek chat-completions — thin re-export of the provider module (T-107.2,
 * W5 · L4 — fixes/216p).
 *
 * The implementation MOVED to `./llm/providers/deepseek.ts` when the provider
 * registry landed; this file keeps every historical export name + signature
 * working byte-compatibly so the ~15 importers (algo-tools, harvest, planning,
 * prompt-engine, headless, vector, codegen, crew, chat, verify, llm.ts, the
 * CLI, …) do not change. The 21 `deepseek.server.test.ts` tests pass untouched.
 *
 * New code that wants a provider-agnostic, role-tiered call (`main` /
 * `reasoning` / `weak`, plus the explicit-model rule that REFUSES unknown model
 * ids instead of silently defaulting) imports `callModel` from
 * `./llm/providers/registry.ts` — NOT from here. The three switched seams
 * (verify.server / chat.server / crew.server) do exactly that.
 *
 * Reads the key from `process.env.DEEPSEEK_API_KEY` ONLY — never
 * `import.meta.env`, never a `VITE_` prefix. Server-only: never import this
 * from client code (the client contract is `./llm.ts`).
 */

export {
  DEEPSEEK_BASE_URL,
  DEEPSEEK_LONG_TIMEOUT_MS,
  DEEPSEEK_MODEL_IDS,
  DEEPSEEK_MODELS,
  RETRY_BASE_MS,
  RETRY_MAX_JITTER_MS,
  completeDeepSeek,
  cutMarked,
  deepSeekModelIds,
  deepseekApiKey,
  isDeepSeekConfigured,
  jitteredBackoffDelayMs,
} from "./llm/providers/deepseek.ts";
export type {
  DeepSeekCompleteOptions,
  DeepSeekMessage,
} from "./llm/providers/deepseek.ts";
