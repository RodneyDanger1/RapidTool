/**
 * Client-facing LLM contract for RapidTool (DeepSeek).
 *
 * Import THIS module from engine/store/UI code — never import
 * `./deepseek.server.ts` directly. The API key is read server-side only (see
 * that module); this module exposes the typed `complete()` / `llmStatus()` /
 * `callModel(role, …)` API and the honest `{ ok: false, reason:
 * "not-configured" }` fallback, so no code path can mistake an unconfigured
 * backend for real model output.
 */

import { createServerFn } from "@tanstack/react-start";
import { classifyError } from "./errors.ts";
import type { ErrorCode } from "./errors.ts";
import type { RapidToolModelRole } from "./llm/providers/registry.ts";

/** Live-verified chat model tiers (research/deepseek-api.md §2, §9). */
export type LlmModel = "deepseek-v4-flash" | "deepseek-v4-pro";

/**
 * Role-tier vocabulary (T-107.2, Wave H — fixes/216p). A caller asks for a
 * ROLE, never a vendor id: `main` = the default workhorse, `reasoning` = the
 * pro/thinking tier, `weak` = the cheapest structured-envelope tier. The
 * role → provider/model resolution, the explicit-model rule (unknown ids are
 * REFUSED, never silently defaulted), and the env pins
 * (`DEEPSEEK_MODEL_<ROLE>`) live in `./llm/providers/registry.ts`; this module
 * re-exports the vocabulary so client code can name a role without importing
 * server modules. */
export type { RapidToolModelRole };

/**
 * W39·K6 (completing C2 · fixes/288): measured token usage for one provider
 * call, shared by both LlmResult arms (success AND the I2 refusal contract —
 * a refusal that burned tokens stays meterable).
 *
 * The two cache fields are ADDITIVE and CONDITIONAL: a provider response (or
 * an old cassette tape) without them keeps the exact legacy 2-key usage
 * object, so every deepEqual pin and every legacy consumer stays green.
 * `cachedPromptTokens` is the token-ledger / packet / doctor vocabulary
 * (`TokenSpend.cachedPromptTokens`, packet `cached_prompt_tokens`) — the
 * pass-through ledger seams accumulate it automatically; the cost derivation
 * (`estimateCostUsd`) re-prices it at the cache-read price.
 */
export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  /**
   * Prompt tokens served FROM the provider's context cache — DeepSeek
   * `usage.prompt_cache_hit_tokens` (api-docs.deepseek.com/guides/kv_cache,
   * "Checking Cache Hit Status"), OpenAI-style `prompt_tokens_details.
   * cached_tokens`. Subset of `promptTokens`; billed at the cache-hit price.
   */
  cachedPromptTokens?: number;
  /**
   * Prompt tokens that MISSED the context cache — DeepSeek
   * `usage.prompt_cache_miss_tokens` (prompt_tokens = hit + miss). Kept for
   * cache-discipline diagnostics (a miss-heavy ledger means the prompt
   * assembly defeated the prefix cache); cost derivation uses the hit field
   * (the miss is simply the full-price remainder).
   */
  cacheMissTokens?: number;
};

export type LlmResult =
  | {
      ok: true;
      text: string;
      model: string;
      usage?: LlmUsage;
    }
  | {
      ok: false;
      reason: "not-configured" | "error";
      error?: string;
      // Y1's I2 contract (codegen FM-03): a REFUSAL may still report usage at runtime; the type now
      // carries it so accountSynthUsage can meter it without narrowing gymnastics.
      usage?: LlmUsage;
      /** Machine-readable class of the failure (errors.ts); always present on
       *  provider-side failures so callers never parse prose. */
      code?: ErrorCode;
    };

const completeServer = createServerFn({ method: "POST" })
  .validator(
    (input: {
      prompt: string;
      opts?: {
        model?: LlmModel;
        system?: string;
        maxTokens?: number;
        json?: boolean;
        /** 216 (T0.5 — fixes/156 E1 parity): the server call sites pass
         *  `thinking: false` for structured json envelopes so reasoning_content
         *  cannot consume the whole max_tokens window and return content:""
         *  (the empty-content blocker). The facade must forward it or the UI /
         *  engine path silently re-enables that blocker. */
        thinking?: boolean;
      };
    }) => input,
  )
  .handler(async ({ data }) => {
    const { completeDeepSeek } = await import("./deepseek.server.ts");
    return completeDeepSeek(data.prompt, data.opts);
  });

/**
 * C1 (332-5) — the status probe reports key VALIDITY, not just presence.
 *
 * `configured` answers "is a key present"; it stays true when the key is
 * rejected, so the console chip read "configured" while every keyed call 401'd.
 * The provider tap (`deepseek.ts`'s `LlmCallTapRecord`) observes EVERY keyed
 * call and carries the coded failure class — never a prompt, never a key. This
 * server-side capture keeps the LAST outcome so `statusServer` can return it.
 *
 * NO provider call is made to produce this: the tap is installed once, lazily,
 * and the probe only READS the captured record — the chip's status check can
 * never spend money. `keySource` is a tail-only label (`getActiveKeySource()`),
 * never the key value.
 */
type LastKeyedOutcome = { code: string; at: number; keySource?: string };
let lastKeyedOutcome: LastKeyedOutcome | null = null;
let keyedTapInstalled = false;

/** Install the last-outcome tap once (server-side). Best-effort, never throws. */
async function captureKeyedOutcomes(): Promise<void> {
  if (keyedTapInstalled) return;
  keyedTapInstalled = true;
  try {
    const [{ setLlmCallTap }, { getActiveKeySource }] = await Promise.all([
      import("./deepseek.server.ts"),
      import("./llm/providers/key-resolution.ts"),
    ]);
    setLlmCallTap((record) => {
      const code = typeof record.code === "string" && record.code ? record.code : null;
      if (!code) {
        // A genuine success CLEARS the failure, so the chip returns to configured.
        lastKeyedOutcome = null;
        return;
      }
      const src = getActiveKeySource();
      const keySource =
        src && typeof src.tail === "string" && src.tail.length > 0
          ? src.kind === "repo-env-file" && typeof src.path === "string" && src.path
            ? `${src.path} (tail …${src.tail})`
            : `the process environment (tail …${src.tail})`
          : undefined;
      lastKeyedOutcome = { code, at: record.at, ...(keySource ? { keySource } : {}) };
    });
  } catch {
    keyedTapInstalled = false; // let a later probe retry
  }
}

const statusServer = createServerFn({ method: "GET" }).handler(async () => {
  const { isDeepSeekConfigured, deepSeekModelIds } = await import(
    "./deepseek.server.ts"
  );
  await captureKeyedOutcomes();
  return {
    configured: isDeepSeekConfigured(),
    models: deepSeekModelIds(),
    // ADDITIVE + CONDITIONAL (absent until a keyed failure is seen, and cleared
    // by a success) so every existing shape pin stays byte-identical.
    ...(lastKeyedOutcome ? { lastKeyed: lastKeyedOutcome } : {}),
  };
});

export async function complete(
  prompt: string,
  opts?: {
    model?: LlmModel;
    system?: string;
    maxTokens?: number;
    /**
     * Request the provider's JSON OUTPUT MODE (`response_format:{type:"json_object"}`).
     * GUARANTEED: a request for one syntactically valid JSON object via the
     * vendor's documented mode. NOT GUARANTEED: schema, key-set, or type
     * enforcement — DeepSeek has no strict `json_schema`/grammar mode, so
     * validate the parsed reply when a shape matters (see prompt-engine.ts's
     * `expandedSpecViolations`). The full contract lives on
     * `DeepSeekCompleteOptions.json` in llm/providers/deepseek.ts.
     */
    json?: boolean;
    /** fixes/156 E1 parity (C1-f08 · W39·K6): the server validator (:50-62)
     *  always accepted `thinking` and the runtime forwards the whole opts
     *  object verbatim, but this public TYPE omitted it — only llm-tasks'
     *  own Completer typing kept the structured-envelope override working.
     *  Forwarded to the provider, where it can only ever turn the pro tier
     *  OFF (flash keeps its disabled shape; deepseek.ts :161-172). */
    thinking?: boolean;
  },
): Promise<LlmResult> {
  try {
    return await completeServer({ data: { prompt, opts } });
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      error: err instanceof Error ? err.message : String(err),
      code: classifyError(err, "RT_E_INTERNAL"),
    };
  }
}

const callModelServer = createServerFn({ method: "POST" })
  .validator(
    (input: {
      role: RapidToolModelRole;
      prompt: string;
      opts?: {
        /** Explicit model id override — the server refuses unknown ids
         *  (coded `RT_E_VALIDATION`), it never silently defaults. */
        model?: string;
        system?: string;
        maxTokens?: number;
        /** Provider JSON OUTPUT MODE (a `json_object` mode hint, not schema
         *  enforcement — see `complete`'s `json` contract on the main facade). */
        json?: boolean;
        /** fixes/156 E1 parity: forwarded to the provider so a structured
         *  json envelope can disable thinking on the pro tier. */
        thinking?: boolean;
      };
    }) => input,
  )
  .handler(async ({ data }) => {
    const { callModel } = await import("./llm/providers/registry.ts");
    return callModel(data.role, data.prompt, data.opts);
  });

/**
 * Role-tiered completion (T-107.2, fixes/216p). Same honest envelope as
 * `complete()`: keyless returns `{ ok: false, reason: "not-configured" }`, a
 * provider failure carries its RT_E code, and an unknown explicit model id is
 * refused with `RT_E_VALIDATION` server-side (never a silent default).
 */
export async function callModel(
  role: RapidToolModelRole,
  prompt: string,
  opts?: {
    model?: string;
    system?: string;
    maxTokens?: number;
    /** Provider JSON OUTPUT MODE (a `json_object` mode hint, not schema
     *  enforcement — see `complete`'s `json` contract on the main facade). */
    json?: boolean;
    thinking?: boolean;
  },
): Promise<LlmResult> {
  try {
    return await callModelServer({ data: { role, prompt, opts } });
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      error: err instanceof Error ? err.message : String(err),
      code: classifyError(err, "RT_E_INTERNAL"),
    };
  }
}

export async function llmStatus(): Promise<{
  configured: boolean;
  models: string[];
  /** C1 (332-5): the last keyed-call FAILURE class the server saw, tail-only
   *  source. Absent when the last keyed call succeeded or none was seen. */
  lastKeyed?: LastKeyedOutcome;
}> {
  try {
    return await statusServer();
  } catch {
    return { configured: false, models: [] };
  }
}
