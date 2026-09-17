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
}> {
  try {
    return await statusServer();
  } catch {
    return { configured: false, models: [] };
  }
}
