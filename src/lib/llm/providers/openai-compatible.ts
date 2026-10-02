/**
 * OpenAI-compatible chat-completions PROVIDER family (F2 · W19-L5 — fixes/252).
 *
 * WHY THIS FILE EXISTS. `219e` §3.5: RapidTool's cross-family judging is blocked
 * until a second, independent model family exists. F2's step 2 is that family —
 * added WITHOUT fabricating a single model claim: this module ships ONE
 * OpenAI-compatible adapter plus ONE registered family whose id and endpoints
 * were probed live on 2026-09-24 (raw evidence: fixes/252_lane5_f2.md §1;
 * re-probe commands below). The family registers as a CANDIDATE with an EMPTY
 * `requestModelIds` (221 F2 rule 3) — no vendor's model list is ever hardcoded
 * before a probe read it back from the vendor's own response.
 *
 * THE PROBED FAMILY — xAI (id `xai`), raw evidence collected 2026-09-24:
 *   - `curl -sSL https://docs.x.ai/llms.txt` → "The API is served at
 *     https://api.x.ai."
 *   - `curl -sSL https://docs.x.ai/developers/rest-api-reference/inference/chat-completions.md`
 *     → "The Chat Completions API is the stateless, OpenAI-compatible predecessor
 *     of the Responses API" + "## POST /v1/chat/completions"; `max_tokens` is
 *     marked "[DEPRECATED] … in favor of `max_completion_tokens`".
 *   - `curl -sSL https://docs.x.ai/openapi.json` → paths `/v1/chat/completions`
 *     (post, bearerAuth) and `/v1/models` (get: "List all models available to the
 *     authenticating API key"); `GET /v1/models` 200 body schema is
 *     `{ object, data: [Model…] }`.
 *   - `curl -sSL https://docs.x.ai/developers/quickstart.md` → the vendor's own
 *     env-var name: `export XAI_API_KEY="your_api_key"`.
 *   - LIVE endpoint probes (no credentials): `GET https://api.x.ai/v1/models`
 *     → HTTP 401 `{"code":"unauthenticated:no-credentials","error":"No
 *     credentials presented."}`; `POST https://api.x.ai/v1/chat/completions`
 *     → HTTP 401 (with a well-formed body; an empty-messages body is rejected
 *     400 BEFORE auth). Both paths EXIST; neither is a 404. `GET /v1` alone is
 *     HTTP 404 — the base is `https://api.x.ai/v1`, endpoints are base + path.
 *
 * WHAT IS *NOT* CLAIMED HERE (honesty contract):
 *   - No model id is hardcoded, offered, defaulted, or substituted. The
 *     registered candidate's `requestModelIds` is EMPTY, so `resolveExplicitProvider`
 *     refuses it and `complete()` refuses every call until a probe has read ids
 *     back and `applyProbedModels` minted a verified descriptor from exactly
 *     those ids ("unless the caller passes ids obtained from a probe" — 221 F2
 *     rule 3). A 200 with an empty model list is reachable, NOT usable.
 *   - Keyless ⇒ the exact legacy envelope `{ ok:false, reason:"not-configured",
 *     code:"RT_E_LLM_NOT_CONFIGURED" }` BEFORE any network I/O (mirror of
 *     `completeDeepSeek`, deepseek.ts:320-324).
 *   - DeepSeek's `thinking` body field is a DeepSeek contract; the probed docs
 *     show xAI reasoning control is `reasoning_effort` with model-dependent
 *     supported values — unprobed here. This adapter therefore forwards NO
 *     reasoning field and does NOT silently translate `opts.thinking`; callers
 *     get no reasoning knob until a probed mapping exists (documented, and
 *     pinned by a test so a silent translation is RED, not invisible).
 *   - `max_completion_tokens` (not the deprecated `max_tokens`) is sent ONLY
 *     when a caller passes `maxTokens`; when omitted the vendor's own documented
 *     default (128,000) applies — this adapter never invents a budget.
 *   - The DeepSeek path is untouched: this module imports its already-exported
 *     helpers (`cutMarked`, `jitteredBackoffDelayMs`) and never edits it.
 *
 * RE-PROBE (a probe is a promise only where it can be re-run):
 *   curl -sS https://api.x.ai/v1/models -H "authorization: Bearer $XAI_API_KEY"
 *
 * Server-only module (reads `process.env` at CALL time; the client-facing
 * contract stays `../../llm.ts`). No `node:fs`, no import-time env read.
 */

import { cutMarked, jitteredBackoffDelayMs } from "./deepseek.ts";
import type { DeepSeekCompleteOptions, DeepSeekMessage } from "./deepseek.ts";
import { classifyError } from "../../errors.ts";
import type { ErrorCode } from "../../errors.ts";
import type { LlmResult } from "../../llm.ts";
import type { LlmProviderDescriptor, LlmProviderId } from "./registry.ts";
// W45·331-1 (Keywright): same one-shot transport + credential-class mapping as
// the DeepSeek provider (see one-shot-fetch.server.ts / key-resolution.ts).
import { oneShotFetch } from "./one-shot-fetch.server.ts";
import { describeKeySource, KEY_REJECTED_CODE } from "./key-resolution.ts";
import { resolveProcessKey } from "./key-source.server.ts";

// ---------------------------------------------------------------------------
// The generic OpenAI-compatible shape
// ---------------------------------------------------------------------------

/** The chat-completions path every OpenAI-compatible family serves under its
 *  base URL. Probed for xAI: `POST /v1/chat/completions` (see file header). */
export const OPENAI_CHAT_COMPLETIONS_PATH = "/chat/completions";

/** The OpenAI-compatible models-list path (`GET <base>/models` — probed for xAI
 *  as `/v1/models`, bearer-authenticated; the 200 body is `{object, data:[…]}`). */
export const OPENAI_MODELS_PATH = "/models";

/** One OpenAI-compatible family: id + endpoints + our own BYOK env naming.
 *  Every field here must trace to live probe evidence (file header) — never to
 *  a vendor id nobody probed. `id` is the registry's own closed union
 *  (`LlmProviderId`, additive: one member per family file — W21-L2 completed
 *  the half-applied W20-L4 fix here): a family whose id the registry cannot
 *  name must be added to that union in review, so no unregistered vendor id
 *  can ever ride a descriptor into `PROVIDERS`. */
export type OpenAiCompatibleSpec = {
  readonly id: LlmProviderId;
  readonly label: string;
  /** Our BYOK env var name for this family's key (probed: the vendor's own
   *  quickstart documents `XAI_API_KEY`). */
  readonly apiKeyEnv: string;
  /** Prefix for `<PREFIX>_MODEL_<ROLE>` pins if this family is ever role-routed. */
  readonly modelEnvPrefix: string;
  readonly defaultBaseUrl: string;
  /** The `<base>/models` URL a probe reads ids back from. */
  readonly modelsEndpoint: string;
};

/** Evidence a probe must carry before ANY id from it may become dispatchable
 *  (221 F2 rule 3; structurally satisfied by `ProviderProbeResult`). */
export type ProbeEvidence = {
  readonly configured: boolean;
  readonly reachable: boolean;
  readonly authenticated: boolean;
  readonly models: readonly string[];
};

// ---------------------------------------------------------------------------
// xAI — the probed second family (2026-09-24; raw evidence in the file header)
// ---------------------------------------------------------------------------

export const XAI_PROVIDER_ID = "xai";
export const XAI_LABEL = "xAI";
export const XAI_API_KEY_ENV = "XAI_API_KEY";
export const XAI_MODEL_ENV_PREFIX = "XAI";
export const XAI_BASE_URL = "https://api.x.ai/v1";
export const XAI_MODELS_ENDPOINT = `${XAI_BASE_URL}${OPENAI_MODELS_PATH}`;

/** The xAI spec exactly as probed. No model ids: those exist only after a probe. */
export const XAI_SPEC: OpenAiCompatibleSpec = Object.freeze({
  id: XAI_PROVIDER_ID,
  label: XAI_LABEL,
  apiKeyEnv: XAI_API_KEY_ENV,
  modelEnvPrefix: XAI_MODEL_ENV_PREFIX,
  defaultBaseUrl: XAI_BASE_URL,
  modelsEndpoint: XAI_MODELS_ENDPOINT,
});

/** Family registry for the verified-descriptor builder. Additive: one entry
 *  per probed OpenAI-compatible family. */
const OPENAI_COMPATIBLE_SPECS: ReadonlyMap<string, OpenAiCompatibleSpec> = new Map([
  [XAI_SPEC.id, XAI_SPEC],
]);

// ---------------------------------------------------------------------------
// Descriptor factory + the verified-descriptor builder
// ---------------------------------------------------------------------------

function env(key: string): string | undefined {
  // W45·331-1: read through the shared resolver (declared `.env` file over the
  // process env); with no declared file this is the legacy process read.
  const resolved = resolveProcessKey(key);
  return resolved.effective ? resolved.effective.value : undefined;
}

/** Trim + dedupe a probed id list, dropping every non-string/blank entry. */
function cleanModelIds(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of ids) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Build one family's descriptor. `requestModelIds` is the REQUEST namespace:
 * pass only ids a probe read back (`applyProbedModels`), or nothing at all —
 * the descriptor is then a candidate that refuses every call.
 */
export function createOpenAiCompatibleProvider(
  spec: OpenAiCompatibleSpec,
  requestModelIds: readonly string[] = [],
): LlmProviderDescriptor {
  const ids = Object.freeze(cleanModelIds(requestModelIds));
  return Object.freeze({
    id: spec.id,
    label: spec.label,
    apiKeyEnv: spec.apiKeyEnv,
    modelEnvPrefix: spec.modelEnvPrefix,
    defaultBaseUrl: spec.defaultBaseUrl,
    requestModelIds: ids,
    verification: Object.freeze({
      kind: "live-probe" as const,
      modelsEndpoint: spec.modelsEndpoint,
    }),
    isConfigured: () => Boolean(env(spec.apiKeyEnv)),
    complete: (prompt: string, opts: DeepSeekCompleteOptions = {}) =>
      completeOpenAiCompatible(spec, ids, prompt, opts),
  });
}

/** The registered xAI descriptor — CANDIDATE status: EMPTY request ids. */
export const XAI_PROVIDER: LlmProviderDescriptor = createOpenAiCompatibleProvider(XAI_SPEC);

export type ApplyProbedModelsResult =
  | { ok: true; descriptor: LlmProviderDescriptor }
  | { ok: false; code: ErrorCode; error: string };

/**
 * Mint a DISPATCHABLE descriptor for a probed family from ids a probe read
 * back — 221 F2 rule 3's "unless the caller passes ids obtained from a probe",
 * enforced structurally: every probe flag must be true and the id list must be
 * non-empty after cleaning, else a coded refusal. NEVER mutates the candidate
 * (`XAI_PROVIDER.requestModelIds` stays empty forever). A failed probe, a 200
 * with an empty list, or an unknown family all refuse — nothing is ever
 * registered from a probe that did not authenticate and list models.
 */
export function applyProbedModels(
  providerId: string,
  probe: ProbeEvidence,
): ApplyProbedModelsResult {
  const id = typeof providerId === "string" ? providerId.trim() : "";
  const spec = OPENAI_COMPATIBLE_SPECS.get(id);
  if (!spec) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `"${id || String(providerId)}" is not a probed OpenAI-compatible family — known: ${[
        ...OPENAI_COMPATIBLE_SPECS.keys(),
      ].join(", ")}. Refusing rather than minting a descriptor for an unknown vendor.`,
    };
  }
  if (probe === null || typeof probe !== "object") {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `probe evidence for "${id}" must be a probe result object — got ${probe === null ? "null" : typeof probe}. Refusing.`,
    };
  }
  const flags = [
    ["configured", probe.configured],
    ["reachable", probe.reachable],
    ["authenticated", probe.authenticated],
  ] as const;
  const failed = flags.filter(([, v]) => v !== true).map(([k]) => k);
  if (failed.length > 0) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error:
        `probe for "${id}" did not verify the family (${failed.join(", ")} not true — ` +
        `configured:${Boolean(probe.configured)} reachable:${Boolean(probe.reachable)} authenticated:${Boolean(probe.authenticated)}). ` +
        "Nothing is registered from a failed probe; re-probe with this family's key first.",
    };
  }
  const models = cleanModelIds(Array.isArray(probe.models) ? probe.models : []);
  if (models.length === 0) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error:
        `probe for "${id}" authenticated but returned NO usable model ids — reachable is not usable ` +
        "(221 F2 constraint c). Refusing to mint a descriptor with nothing requestable.",
    };
  }
  return { ok: true, descriptor: createOpenAiCompatibleProvider(spec, models) };
}

// ---------------------------------------------------------------------------
// The wire call
// ---------------------------------------------------------------------------

/** Default per-call budget. NOT a vendor claim: RapidTool's own cap, overridable
 *  per call (`opts.timeoutMs`); the xAI docs document model-dependent
 *  `reasoning_effort`, so a single fast default would under-budget a reasoning
 *  turn — 30 s is this adapter's documented ceiling, callers tune per call. */
export const OPENAI_COMPATIBLE_DEFAULT_TIMEOUT_MS = 30_000;

// 101 §4.5 failover matrix: 429 and ≥500 are transient (retry ×N); 400/401/402/
// 404/413/422 are terminal (a malformed request or a key problem is not solved
// by retrying).
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true;
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

type FetchDeps = {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
};

/** Bounded full-jitter retry — same policy and schedule as the DeepSeek
 *  provider (its exported `jitteredBackoffDelayMs`), re-implemented over this
 *  family's own URL/headers so no DeepSeek code path is touched. AbortError is
 *  never retried; a terminal status returns on the first attempt. */
async function getResponseWithRetry(
  url: string,
  init: RequestInit,
  deps: FetchDeps,
): Promise<{ response: Response; attempts: number }> {
  let lastResponse: Response | null = null;
  let lastNetworkError: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await deps.sleep(jitteredBackoffDelayMs(attempt, deps.random));
    try {
      const response = await deps.fetch(url, init);
      lastResponse = response;
      if (!RETRYABLE_STATUS.has(response.status)) return { response, attempts: attempt + 1 };
    } catch (err) {
      if (isAbortError(err)) throw err;
      lastNetworkError = err;
    }
  }
  if (lastResponse) return { response: lastResponse, attempts: MAX_ATTEMPTS };
  const err = lastNetworkError instanceof Error ? lastNetworkError : new Error(`${url} request failed`);
  (err as Error & { attempts?: number }).attempts = MAX_ATTEMPTS;
  throw err;
}

async function describeError(label: string, res: Response): Promise<string> {
  let detail = "";
  let parsedJson: { error?: { message?: unknown } } | null = null;
  const raw = await res.text().catch(() => "");
  if (raw) {
    try {
      const body = JSON.parse(raw) as unknown;
      if (body !== null && typeof body === "object" && !Array.isArray(body)) {
        parsedJson = body as { error?: { message?: unknown } };
      }
    } catch {
      /* non-JSON error body */
    }
    const msg = parsedJson?.error?.message;
    if (typeof msg === "string" && msg.trim()) {
      detail = `: ${msg.trim()}`;
    } else {
      const excerpt = raw.replace(/\s+/g, " ").trim();
      if (excerpt.length > 0) {
        const bounded = excerpt.length > 200 ? `${excerpt.slice(0, 200)}…` : excerpt;
        const labelText = parsedJson === null ? "non-JSON body" : "JSON body without error.message";
        detail = `: ${labelText}: ${bounded}`;
      }
    }
  }
  switch (res.status) {
    case 400:
      return `${label} rejected the request (HTTP 400${detail})`;
    case 401:
      return `${label} API key is invalid (HTTP 401${detail})`;
    case 402:
      return `${label} account balance exhausted (HTTP 402${detail})`;
    case 403:
      return `${label} refused the request (HTTP 403${detail})`;
    case 404:
      return `${label} endpoint/model not found (HTTP 404${detail})`;
    case 422:
      return `${label} rejected parameters (HTTP 422${detail})`;
    case 429:
      return `${label} rate limit reached (HTTP 429${detail})`;
    case 500:
      return `${label} server error (HTTP 500${detail})`;
    case 503:
      return `${label} server overloaded (HTTP 503${detail})`;
    default:
      return `${label} request failed (HTTP ${res.status}${detail})`;
  }
}

type OpenAiChatBody = {
  model?: unknown;
  choices?: Array<{
    message?: { content?: unknown; reasoning_content?: unknown };
    finish_reason?: unknown;
  }>;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
};

/**
 * Complete one prompt through an OpenAI-compatible family. The model id must be
 * one of `requestModelIds` — the ids a probe read back for THIS family. There
 * is no default model and no substitution: a missing/blank/unverified id is a
 * coded `RT_E_VALIDATION` refusal BEFORE any network I/O.
 */
export async function completeOpenAiCompatible(
  spec: OpenAiCompatibleSpec,
  requestModelIds: readonly string[],
  prompt: string,
  opts: DeepSeekCompleteOptions = {},
): Promise<LlmResult> {
  const key = env(spec.apiKeyEnv);
  if (!key) {
    return { ok: false, reason: "not-configured", code: "RT_E_LLM_NOT_CONFIGURED" as const };
  }

  if (typeof prompt !== "string" || !prompt.trim()) {
    return {
      ok: false,
      reason: "error",
      error: `${spec.label} prompt is empty`,
      code: "RT_E_VALIDATION",
    };
  }

  const model = typeof opts.model === "string" ? opts.model.trim() : "";
  if (!model) {
    return {
      ok: false,
      reason: "error",
      error:
        `${spec.label}: no model id supplied — this adapter requests ONLY ids a probe read back ` +
        `(verified here: ${requestModelIds.length > 0 ? requestModelIds.join(", ") : "none yet"}). ` +
        "Refusing rather than defaulting to an unprobed model.",
      code: "RT_E_VALIDATION",
    };
  }
  if (!requestModelIds.includes(model)) {
    return {
      ok: false,
      reason: "error",
      error:
        `${spec.label}: model "${model}" has not been verified by a probe for this family ` +
        `(request ids: ${requestModelIds.length > 0 ? requestModelIds.join(", ") : "none yet"}) — ` +
        "refusing rather than substituting. Probe this family's /models first.",
      code: "RT_E_VALIDATION",
    };
  }

  const timeoutMs =
    typeof opts.timeoutMs === "number" && Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0
      ? opts.timeoutMs
      : OPENAI_COMPATIBLE_DEFAULT_TIMEOUT_MS;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  if (opts.json) {
    // Same prompt-side discipline as the DeepSeek provider: `json_object` mode
    // needs an explicit JSON instruction in the messages or the model may
    // meander (and OpenAI-compatible validators require the word "json").
    messages.push({
      role: "system",
      content: "Respond with valid JSON only — no prose, no markdown fences.",
    });
  }
  const history = (Array.isArray(opts.history) ? opts.history : [])
    .filter(
      (m) =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-6)
    .map((m) => ({ role: m.role, content: cutMarked(m.content.trim(), 4000) }));
  for (const m of history) messages.push({ role: m.role, content: m.content });
  messages.push({ role: "user", content: prompt });

  const maxTokensKnob =
    typeof opts.maxTokens === "number" && Number.isFinite(opts.maxTokens) && opts.maxTokens > 0
      ? { max_completion_tokens: opts.maxTokens }
      : {};

  const body = {
    model,
    messages,
    // Probed docs mark `max_tokens` deprecated in favor of `max_completion_tokens`;
    // the field is sent ONLY when the caller passed a budget — otherwise the
    // vendor's own documented default applies (this adapter invents nothing, and
    // forwards NO reasoning/thinking field: see the file header).
    ...maxTokensKnob,
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
    stream: false,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const deps: FetchDeps = {
      fetch: opts.fetch ?? oneShotFetch,
      sleep: opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
      random: opts.random ?? Math.random,
    };
    const { response: res, attempts } = await getResponseWithRetry(
      `${spec.defaultBaseUrl}${OPENAI_CHAT_COMPLETIONS_PATH}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
      deps,
    );

    if (!res.ok) {
      const exhausted = attempts > 1 ? ` (after ${attempts} attempts)` : "";
      // R4-f01 (W29 · LANE P): the wallet doctrine is PROVIDER-WIDE, not
      // DeepSeek-only. Mirror of deepseek.ts:437-444 (W23-L1, fixes/262):
      // HTTP 402 / "Insufficient Balance" is its own class — a broke wallet is
      // not a generic refusal (RT_E_LLM_REJECTED, whose doc says "check the
      // key or the parameters") and not our session budget
      // (RT_E_BUDGET_EXHAUSTED). The vendor text comes from the SAME
      // describeError() string the refusal already carried, so the message
      // stays byte-identical; only the code changes for the 402 class.
      const refusalText = await describeError(spec.label, res);
      const noBalance = res.status === 402 || /insufficient balance/i.test(refusalText);
      // W45·331-1: a rejected credential is its own class; name the key's
      // source (a declared `.env` path, else the process environment), tail-only.
      const keyRejected = res.status === 401;
      const keyNote = keyRejected ? ` — key source: ${describeKeySource(key)}` : "";
      return {
        ok: false,
        reason: "error",
        error: `${refusalText} — requested model: "${model}"${exhausted}${keyNote}`,
        code: noBalance
          ? "RT_E_LLM_NO_BALANCE"
          : keyRejected
            ? KEY_REJECTED_CODE
            : "RT_E_LLM_REJECTED",
      };
    }

    const rawSuccess = await res.text().catch(() => "");
    let parsed: OpenAiChatBody;
    try {
      const bodyJson: unknown = JSON.parse(rawSuccess);
      if (bodyJson === null || typeof bodyJson !== "object" || Array.isArray(bodyJson)) {
        throw new SyntaxError("body is not a JSON object");
      }
      parsed = bodyJson as OpenAiChatBody;
    } catch {
      const flat = rawSuccess.replace(/\s+/g, " ").trim();
      const bounded = flat.length > 200 ? `${flat.slice(0, 200)}…` : flat;
      return {
        ok: false,
        reason: "error",
        error: `${spec.label} returned a non-JSON ${res.status} response${bounded ? `: ${bounded}` : ""}`,
        code: "RT_E_INTERNAL",
      };
    }
    const content = parsed.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      const reasoning = parsed.choices?.[0]?.message?.reasoning_content;
      const reason = parsed.choices?.[0]?.finish_reason;
      const reasoningNote =
        typeof reasoning === "string" && reasoning.trim()
          ? `; model returned reasoning only (${reasoning.trim().length} chars of reasoning_content, content empty)`
          : "";
      const lengthNote = reason === "length" ? "; stopped at max_tokens (finish_reason length)" : "";
      return {
        ok: false,
        reason: "error",
        error: `${spec.label} returned no text content${reasoningNote}${lengthNote}`,
        code: "RT_E_LLM_REJECTED",
      };
    }
    const usage = parsed.usage;
    return {
      ok: true,
      text: content.trim(),
      model: typeof parsed.model === "string" && parsed.model ? parsed.model : model,
      ...(usage &&
      typeof usage.prompt_tokens === "number" &&
      typeof usage.completion_tokens === "number"
        ? {
            usage: {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
            },
          }
        : {}),
    };
  } catch (err) {
    if (isAbortError(err)) {
      return {
        ok: false,
        reason: "error",
        error: `${spec.label} request timed out after ${Math.round(timeoutMs / 1000)}s`,
        code: "RT_E_LLM_TIMEOUT",
      };
    }
    return {
      ok: false,
      reason: "error",
      error:
        err instanceof Error
          ? `${spec.label} request failed: ${err.message}${
              (err as Error & { attempts?: number }).attempts
                ? ` (after ${(err as Error & { attempts?: number }).attempts} attempts)`
                : ""
            }`
          : `${spec.label} request failed`,
      code: classifyError(err, "RT_E_LLM_REJECTED"),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Re-exported for callers that forward a registry history array verbatim. */
export type { DeepSeekMessage };
