/**
 * Client-facing LLM contract for RapidTool (DeepSeek).
 *
 * Import THIS module from engine/store/UI code — never import
 * `./deepseek.server.ts` directly. The API key is read server-side only (see
 * that module); this module exposes the typed `complete()` / `llmStatus()` API
 * and the honest `{ ok: false, reason: "not-configured" }` fallback, so no code
 * path can mistake an unconfigured backend for real model output.
 */

import { createServerFn } from "@tanstack/react-start";
import { classifyError } from "./errors.ts";
import type { ErrorCode } from "./errors.ts";

/** Live-verified chat model tiers (research/deepseek-api.md §2, §9). */
export type LlmModel = "deepseek-v4-flash" | "deepseek-v4-pro";

export type LlmResult =
  | {
      ok: true;
      text: string;
      model: string;
      usage?: { promptTokens: number; completionTokens: number };
    }
  | {
      ok: false;
      reason: "not-configured" | "error";
      error?: string;
      /** Machine-readable class of the failure (errors.ts); always present on
       *  provider-side failures so callers never parse prose. */
      code?: ErrorCode;
    };

const completeServer = createServerFn({ method: "POST" })
  .validator(
    (input: {
      prompt: string;
      opts?: { model?: LlmModel; system?: string; maxTokens?: number; json?: boolean };
    }) => input,
  )
  .handler(async ({ data }) => {
    const { completeDeepSeek } = await import("./deepseek.server.ts");
    return completeDeepSeek(data.prompt, data.opts);
  });

const statusServer = createServerFn({ method: "GET" }).handler(async () => {
  const { isDeepSeekConfigured, deepSeekModelIds } = await import(
    "./deepseek.server.ts"
  );
  return { configured: isDeepSeekConfigured(), models: deepSeekModelIds() };
});

export async function complete(
  prompt: string,
  opts?: {
    model?: LlmModel;
    system?: string;
    maxTokens?: number;
    json?: boolean;
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

export async function llmStatus(): Promise<{
  configured: boolean;
  models: string[];
}> {
  try {
    return await statusServer();
  } catch {
    return { configured: false, models: [] };
  }
}
