/**
 * DeepSeek chat-completions PROVIDER (server-only) — T-107.2 port.
 *
 * Wave H (W5 · L4) moved the original `src/lib/deepseek.server.ts` body here
 * verbatim (behavior byte-compatible — the 21 `deepseek.server.test.ts` tests
 * pass untouched) and left `deepseek.server.ts` as a thin re-export, so every
 * legacy importer keeps working unchanged. Callers that want a PROVIDER-
 * AGNOSTIC, role-tiered call (`main` / `reasoning` / `weak`) import
 * `callModel` from `./registry.ts` instead (src/lib/llm/providers/registry.ts
 * owns the explicit-model rule).
 *
 * Reads the key through the shared resolver `./key-source.server.ts` (W45·331-1):
 * a server-side entry point may declare a `.env` file via
 * `RAPIDTOOL_LLM_ENV_FILE` (the CLI and `scripts/with-app-env.mjs` do), and the
 * resolver applies the documented precedence (`.env` wins over a differing
 * ambient value, loud + coded; a present-but-blank process value disables). With
 * NO declared file this is a plain `process.env.DEEPSEEK_API_KEY` read. Never
 * `import.meta.env`, never a `VITE_` prefix (Vite would inline the secret into
 * the public bundle). The browser-facing contract lives in `../../llm.ts`; this
 * module is the raw fetch and must never be imported from client code.
 *
 * Model IDs re-verified live against `https://api.deepseek.com/models`
 * (2026-09-16, two keys): `/models` returns EXACTLY two ids —
 * `deepseek-flash` and `deepseek-v4-pro`. The version-tagged alias
 * `deepseek-v4-flash` is accepted on the request path and served as
 * `deepseek-flash` (which is DeepSeek-V4.1-Flash; the vendor dropped the
 * version tag from the id, not the model). `deepseek-chat` /
 * `deepseek-reasoner` are still accepted but BOTH silently resolve to
 * `deepseek-flash`. Version-tagged ids (`deepseek-v4.1-flash` etc.) are
 * REJECTED with an invalid_request_error naming the two supported ids.
 * `deepseek-v4-flash-vision-exp` is NOT returned by `/models`; its
 * request-path acceptance is UNVERIFIED (advertised for forward-compat only).
 *
 * Honesty contract: when the key is absent this returns
 * `{ ok: false, reason: "not-configured" }` and NEVER fabricates model text.
 */

import { appendFileSync } from "node:fs";
import type { LlmModel, LlmResult } from "../../llm.ts";
import { classifyError } from "../../errors.ts";
// T5.7: the deterministic cassette seam. `wrapWithActiveCassette` is the
// identity when RAPIDTOOL_CASSETTE_MODE is unset/"off" (see its doc), so the
// default call path is unchanged.
import { wrapWithActiveCassette } from "../../cassette.ts";
// W45·331-1 (Keywright): the one-shot transport (undici's TLS handle races the
// CLI's in-tick process.exit on Node 24/Windows) and the key-source provenance
// a rejected 401 names.
import { oneShotFetch } from "./one-shot-fetch.server.ts";
import { describeKeySource, KEY_REJECTED_CODE } from "./key-resolution.ts";
import { resolveProcessKey } from "./key-source.server.ts";

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

/**
 * Live-verified chat tiers (research/deepseek-api.md §9).
 *
 * OV-37 (W17 · L3) — REFRESH PATH when an id dies. Every refusal this module
 * returns NAMES the requested id (` — requested model: "<id>"`) alongside the
 * vendor's own message, so an alias death (400 "model not found") is
 * human-visible without parsing prose. Re-verify the live served ids with:
 *
 *   curl -s https://api.deepseek.com/models -H "authorization: Bearer $DEEPSEEK_API_KEY"
 *
 * then update `DEEPSEEK_MODELS` below — `DEEPSEEK_MODEL_IDS` (this file) and
 * `DEEPSEEK_REQUEST_MODEL_IDS`/`KNOWN_MODEL_IDS` (registry.ts) follow from it.
 * Never substitute a different id silently: unknown ids are refused before
 * any network I/O, and this provider never falls back to a default.
 */
export const DEEPSEEK_MODELS = {
  flash: "deepseek-v4-flash",
  pro: "deepseek-v4-pro",
} as const;

/** Ids RapidTool may REQUEST (aliases). NOT a claim about what /models
 *  returns: live 2026-09-16 the vendor returns exactly `deepseek-flash` +
 *  `deepseek-v4-pro` (see the module header). The vision-exp entry is
 *  unverified and is kept for forward-compat only. */
export const DEEPSEEK_MODEL_IDS: readonly string[] = [
  DEEPSEEK_MODELS.flash,
  DEEPSEEK_MODELS.pro,
  "deepseek-v4-flash-vision-exp",
];

// Thinking is ON by default on both V4 models. Flash calls want speed, so
// disable it; pro calls want reasoning, so keep it on with a generous budget
// (research/deepseek-api.md §4, §9). Callers whose structured json envelope
// needs OUTPUT budget instead of chain-of-thought pass `thinking: false`
// explicitly (fixes/156 E1 — the codegen P6 synthesis call sites).
const DEFAULT_MAX_TOKENS_FLASH = 1024;
const DEFAULT_MAX_TOKENS_PRO = 8192;
const TIMEOUT_FLASH_MS = 20_000;
const TIMEOUT_PRO_MS = 60_000;

/** setTimeout's overflow ceiling (32-bit signed ms). A LARGER finite value
 *  passes `Number.isFinite`/`> 0` but Node clamps the delay to 1ms and warns
 *  (`TimeoutOverflowWarning`) — so a caller's "no timeout" budget became an
 *  immediate abort (346 C3). Shared by both provider adapters so the ceiling
 *  can never drift (mirrors `websearch.server.ts` / node-runner's MAX_TIMER_MS). */
export const MAX_PROVIDER_TIMEOUT_MS = 2_147_483_647;

/** fixes/121-style long-generation budget (research/99 §2; fixes/129): the
 *  20s flash default aborts large JSON generations (3000-token expansions,
 *  crew architect/coder 8k-token turns) mid-flight. Callers whose output
 *  budget outruns the fast tier pass this explicitly (prompt-engine,
 *  codegen P6, crew turns) — the 20s default stays the fast-call floor. */
export const DEEPSEEK_LONG_TIMEOUT_MS = 90_000;

// Transient statuses get a bounded exponential-backoff retry (§6). 401/402 are
// config/billing errors and are NOT retried.
//
// fixes/346 A2-F4: ONE shared transient set for both provider families. 502/504
// are gateway-class errors that are transient by nature — the OpenAI-compatible
// family already retried them, so DeepSeek treating them as terminal was an
// avoidable asymmetry (a wasted synthesis attempt). `openai-compatible.ts`
// imports this exact constant, so the two adapters can never drift apart.
export const TRANSIENT_RETRY_STATUS: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

// fixes/152 (factory steal #1 — OpenHands retry_mixin.py): the retry policy
// is FULL-JITTER exponential backoff with a hard cap, exactly bounded (never
// an infinite loop). Every retryable attempt past the first waits
// `random() * min(RETRY_MAX_JITTER_MS, RETRY_BASE_MS * 2 ** attempt)` — the
// AWS-style full-jitter window: the mean delay still grows exponentially with
// the attempt (base 500ms → ≤1s, ≤2s, …) while the random draw de-synchronizes
// thundering-herd retries that the old fixed `500 * 2 ** attempt` schedule
// guaranteed. The cap keeps a pathological long outage from parking a call
// for minutes between attempts. The jitter source and clock are injectable
// (see DeepSeekCompleteOptions) so tests pin the schedule deterministically.
export const RETRY_BASE_MS = 500;
export const RETRY_MAX_JITTER_MS = 8000;

/** Pure full-jitter delay for retry `attempt` (1-based). Bounded by the cap;
 *  deterministic under an injected `random` (always 1 ⇒ the legacy fixed
 *  schedule, always 0 ⇒ instant). */
export function jitteredBackoffDelayMs(
  attempt: number,
  random: () => number = Math.random,
): number {
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 1;
  const cap = Math.min(RETRY_MAX_JITTER_MS, RETRY_BASE_MS * 2 ** n);
  const r = typeof random === "function" ? random() : Math.random();
  const clamped = Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 1;
  return Math.floor(cap * clamped);
}

/**
 * W61 lane D (D4 / research/deepseek-api.md §5, "Parser contract for the build
 * agents"): the documented `choices[0].finish_reason` taxonomy —
 * `stop | length | content_filter | tool_calls | insufficient_system_resource`.
 * `content_filter` is a NON-RETRY refusal; `insufficient_system_resource` is a
 * transient capacity interruption (retry with backoff); `length` is truncation.
 * Unknown/absent → "other". Pure; never throws.
 */
export type FinishReasonClass =
  | "stop"
  | "length"
  | "content_filter"
  | "tool_calls"
  | "insufficient_system_resource"
  | "other";

export function classifyFinishReason(reason: unknown): FinishReasonClass {
  switch (reason) {
    case "stop":
    case "length":
    case "content_filter":
    case "tool_calls":
    case "insufficient_system_resource":
      return reason;
    default:
      return "other";
  }
}

/** The `finish_reason` of a raw 200 body, or null when unreadable/absent. Pure. */
export function finishReasonOf(rawBody: string): FinishReasonClass | null {
  if (typeof rawBody !== "string" || rawBody.trim() === "") return null;
  try {
    const body: unknown = JSON.parse(rawBody);
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const choices = (body as { choices?: unknown }).choices;
    if (!Array.isArray(choices)) return null;
    const first = choices[0] as { finish_reason?: unknown } | undefined;
    return first && "finish_reason" in first ? classifyFinishReason(first.finish_reason) : null;
  } catch {
    return null;
  }
}

export function deepseekApiKey(): string | undefined {
  // W45·331-1: the key read goes through the shared resolver, so any server-side
  // entry point that declared a `.env` file (dev server / CLI) gets the same
  // precedence + coded shadow signal the CLI has — the stale ambient value
  // never silently wins. With no declared file this is the legacy process read.
  const resolved = resolveProcessKey("DEEPSEEK_API_KEY");
  return resolved.effective ? resolved.effective.value : undefined;
}

export function isDeepSeekConfigured(): boolean {
  return Boolean(deepseekApiKey());
}

export function deepSeekModelIds(): string[] {
  return isDeepSeekConfigured() ? [...DEEPSEEK_MODEL_IDS] : [];
}

function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true;
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TRUNC_MARK = "…[TRUNCATED]";

/** Cut a string at a char cap with a marked tail — never a silent truncation. */
export function cutMarked(s: string, cap: number): string {
  if (s.length <= cap) return s;
  return `${s.slice(0, Math.max(0, cap - TRUNC_MARK.length))}${TRUNC_MARK}`;
}

export type DeepSeekCompleteOptions = {
  model?: LlmModel;
  system?: string;
  maxTokens?: number;
  /**
   * Request the vendor's JSON OUTPUT MODE — `response_format:{type:"json_object"}`
   * on the wire (the body spread in `completeDeepSeekInner`), plus the explicit
   * "Respond with valid JSON only" system instruction the mode requires (added
   * just above that body — without it DeepSeek may loop on whitespace until the
   * token cap; api-docs.deepseek.com/guides/json_mode).
   *
   * GUARANTEED: a request for one syntactically valid JSON OBJECT, made through
   * the vendor's documented mode. NOT GUARANTEED: any schema, key-set, or type
   * enforcement. DeepSeek's only structured-output capability is this
   * `json_object` MODE HINT — there is NO strict `json_schema`/grammar mode, so
   * a conforming-looking reply can still omit fields or carry wrong types.
   * Callers that need a specific SHAPE must validate the parsed reply
   * deterministically (the spec envelope does: prompt-engine.ts
   * `expandedSpecViolations`) — never treat `json:true` as schema enforcement.
   */
  json?: boolean;
  /**
   * fixes/156 (E1): per-request thinking override. `thinking: false` forces
   * the NON-thinking body shape on any tier — the json-envelope synthesis
   * callers use it (see codegen P6 call sites): with thinking enabled on the
   * LARGE chunk prompts, reasoning_content consumed the whole max_tokens
   * window and the API returned content:"" on every call (finish_reason
   * length / vendor-acknowledged JSON-mode empty content —
   * api-docs.deepseek.com/guides/json_mode). Omitted (or `true`) keeps the
   * per-tier default below BYTE-IDENTICAL: pro = thinking enabled +
   * reasoning_effort high (the fixes/125 pro-reasoning contract), flash =
   * thinking disabled (flash has no thinking-on shape in this module).
   */
  thinking?: boolean;
  /** Test/dev hook; defaults to the per-tier timeout. */
  timeoutMs?: number;
  /** fixes/152: injectable fetch — tests stub transient 429/5xx/network
   *  failures without touching the network. Defaults to global fetch. */
  fetch?: typeof fetch;
  /** fixes/152: injectable sleep — deterministic retry-schedule tests.
   *  Defaults to a real setTimeout sleep. */
  sleep?: (ms: number) => Promise<void>;
  /** fixes/152: injectable jitter source — pin the backoff schedule in tests
   *  (always 1 reproduces the legacy fixed 500·2ⁿ schedule). */
  random?: () => number;
  /**
   * Optional prior turns (user/assistant) inserted between the system
   * prompt and the current user prompt, capped to the last 6 entries.
   * Lets a copilot-style caller keep a short grounded conversation.
   */
  history?: DeepSeekMessage[];
};

/** One prior chat turn for the optional `history` option. */
export type DeepSeekMessage = { role: "user" | "assistant"; content: string };

type DeepSeekChatBody = {
  model?: unknown;
  choices?: Array<{
    message?: { content?: unknown; reasoning_content?: unknown };
    finish_reason?: unknown;
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    /** Context-cache split (api-docs.deepseek.com/guides/kv_cache — "Checking
     *  Cache Hit Status"): hit = tokens served from the persisted prefix
     *  cache, miss = tokens that did not hit. C2 (W39 · fixes/288_c2). */
    prompt_cache_hit_tokens?: unknown;
    prompt_cache_miss_tokens?: unknown;
  };
};

type DeepSeekFetchDeps = {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
};

const defaultDeps: DeepSeekFetchDeps = {
  // W45·331-1: one-shot node:https/http (never pooled). Undici's global fetch
  // leaves a TLS teardown handle that races the CLI's deliberate in-tick
  // `process.exit()` on Node 24/Windows — libuv async.c assertion + 0xC0000409
  // (fixes/327_l2_cli_exit.md). `oneShotFetch` still defers to a replaced
  // global fetch, so the test seam (llm.test.ts / chat.test.ts) is unchanged.
  fetch: oneShotFetch,
  sleep,
  random: Math.random,
};

/**
 * fixes/152 (factory steal #1): bounded full-jitter retry over the transient
 * set (`TRANSIENT_RETRY_STATUS` + network errors). Every attempt past the first sleeps
 * `jitteredBackoffDelayMs(attempt)`; an AbortError (the caller's absolute
 * deadline fired) is NEVER retried. After MAX_ATTEMPTS the outcome is honest:
 * the last retryable HTTP response is handed back for status mapping, or the
 * last network error is rethrown — never a silent hang, never an infinite
 * loop, and the attempt count rides the outcome so callers can say "after N
 * attempts".
 */
async function postWithRetry(
  url: string,
  init: RequestInit,
  deps: DeepSeekFetchDeps = defaultDeps,
): Promise<{ response: Response; attempts: number }> {
  let lastResponse: Response | null = null;
  let lastNetworkError: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await deps.sleep(jitteredBackoffDelayMs(attempt, deps.random));
    try {
      const response = await deps.fetch(url, init);
      lastResponse = response;
      if (!TRANSIENT_RETRY_STATUS.has(response.status)) {
        return { response, attempts: attempt + 1 };
      }
    } catch (err) {
      // An AbortError means the absolute deadline fired — retrying cannot
      // succeed within the budget, so rethrow and let the caller classify
      // it as a timeout. Transient network errors (DNS reset, connection
      // refused) are retried with the same bounded backoff.
      if (isAbortError(err)) throw err;
      lastNetworkError = err;
    }
  }
  // Every attempt returned a retryable status; hand back the last one plus the
  // honest attempt count so the caller maps it with "after N attempts".
  if (lastResponse) return { response: lastResponse, attempts: MAX_ATTEMPTS };
  // Every attempt hit a transient network error; rethrow the last one with the
  // attempt count attached for the caller's honest refusal message.
  const err = lastNetworkError instanceof Error
    ? lastNetworkError
    : new Error("DeepSeek request failed");
  (err as Error & { attempts?: number }).attempts = MAX_ATTEMPTS;
  throw err;
}

/**
 * G3 residual (fixed W41 · Q7 — `fixes/285_g3_model_visibility.md`): the
 * wallet-empty TEXT class, ONE regex shared by both provider families
 * (openai-compatible.ts imports this). The old check required the exact
 * two-word pair (`/insufficient balance/i`), so a bare vendor phrase that
 * arrives in another shape classified as a generic refusal:
 * live-seen shapes are the bare `Insufficient Balance` body,
 * `insufficient_funds`, `insufficient-quota`, and OpenAI's
 * `insufficient_quota` (out of credit). A 402 status alone is not the only
 * door — a gateway can ride the phrase on any status — so this text class is
 * checked alongside the status, and it lands in the same wallet class
 * `RT_E_LLM_NO_BALANCE` documents (errors.ts: "a wallet class, not a generic
 * refusal"; never retried, billing is not transient). Narrow by design:
 * `insufficient` must be followed by nothing but separators and then a wallet
 * noun, so "insufficient permissions/parameters" stays a generic refusal.
 */
export function isInsufficientFundsText(text: unknown): boolean {
  return typeof text === "string" && /insufficient[\s"'_-]*(?:balance|funds|quota)/i.test(text);
}

async function describeError(res: Response): Promise<string> {
  // fixes/153 (P1): read the raw text ONCE so a proxy/gateway HTML page or a
  // plain-text refusal can fall back to a visible bounded excerpt. Previously
  // res.json() threw (non-JSON) — or parsed JSON without error.message — and
  // the detail silently disappeared: the reader saw only the status clause.
  let detail = "";
  let parsedJson: { error?: { message?: unknown } } | null = null;
  const raw = await res.text().catch(() => "");
  if (raw) {
    try {
      const body = JSON.parse(raw) as unknown;
      // Only a JSON OBJECT can be a DeepSeek-shaped error body; a quoted
      // string / number body is treated as raw text (honest label below).
      if (body !== null && typeof body === "object" && !Array.isArray(body)) {
        parsedJson = body as { error?: { message?: unknown } };
      }
    } catch {
      /* non-JSON error body */
    }
    const msg = parsedJson?.error?.message;
    if (typeof msg === "string" && msg.trim()) {
      // Byte-identical legacy path: the body IS JSON with an error.message.
      detail = `: ${msg.trim()}`;
    } else {
      // Raw-body fallback: the first ~200 chars (whitespace-collapsed), with
      // an honest label — a gateway page or plain-text refusal becomes
      // VISIBLE in the error string instead of vanishing.
      const excerpt = raw.replace(/\s+/g, " ").trim();
      if (excerpt.length > 0) {
        const bounded = excerpt.length > 200 ? `${excerpt.slice(0, 200)}…` : excerpt;
        const label = parsedJson === null ? "non-JSON body" : "JSON body without error.message";
        detail = `: ${label}: ${bounded}`;
      }
    }
  }
  switch (res.status) {
    case 400:
      return `DeepSeek rejected the request (HTTP 400${detail})`;
    case 401:
      return `DeepSeek API key is invalid (HTTP 401${detail})`;
    case 402:
      return `DeepSeek account balance exhausted (HTTP 402${detail})`;
    case 422:
      return `DeepSeek rejected parameters (HTTP 422${detail})`;
    case 429:
      return `DeepSeek rate limit reached (HTTP 429${detail})`;
    case 500:
      return `DeepSeek server error (HTTP 500${detail})`;
    case 503:
      return `DeepSeek server overloaded (HTTP 503${detail})`;
    default:
      return `DeepSeek request failed (HTTP ${res.status}${detail})`;
  }
}

/**
 * The provider body (unchanged behavior). Exported through the tap wrapper
 * `completeDeepSeek` below — the wrapper adds ONE opt-in telemetry record per
 * call (W23-L1, fixes/262) and forwards the result untouched. Never import
 * this inner name from outside this module.
 */
async function completeDeepSeekInner(
  prompt: string,
  opts: DeepSeekCompleteOptions = {},
): Promise<LlmResult> {
  const key = deepseekApiKey();
  if (!key) {
    return { ok: false, reason: "not-configured", code: "RT_E_LLM_NOT_CONFIGURED" as const };
  }

  // A non-string or empty prompt is a caller bug — refuse it before any
  // network I/O with an explicit validation code instead of a 400 round-trip.
  if (typeof prompt !== "string" || !prompt.trim()) {
    return {
      ok: false,
      reason: "error",
      error: "DeepSeek prompt is empty",
      code: "RT_E_VALIDATION",
    };
  }

  const model: LlmModel = opts.model ?? DEEPSEEK_MODELS.flash;

  // R4-f05 · C1-f09 (W29 · LANE P): enforce THIS header's claim — "unknown ids
  // are refused before any network I/O, and this provider never falls back to
  // a default". The registry's explicit/env paths enforce their narrower
  // verified set (registry.ts `isKnownModelId`); a direct facade caller
  // (llm.ts `complete()`, whose validator is TS-only at runtime) bypasses
  // them, so the provider re-checks its own REQUEST list here — including the
  // forward-compat `deepseek-v4-flash-vision-exp` that the explicit rule
  // deliberately excludes — BEFORE any request leaves. A vendor 400
  // "model not found" round-trip is not a pre-network refusal: it costs a call.
  if (!DEEPSEEK_MODEL_IDS.includes(model)) {
    return {
      ok: false,
      reason: "error",
      error:
        `DeepSeek cannot request model "${model}" — known request ids: ` +
        `${DEEPSEEK_MODEL_IDS.join(", ")}. Refusing rather than falling back to a default.`,
      code: "RT_E_VALIDATION",
    };
  }

  const isPro = model === DEEPSEEK_MODELS.pro;
  const maxTokens =
    opts.maxTokens ?? (isPro ? DEFAULT_MAX_TOKENS_PRO : DEFAULT_MAX_TOKENS_FLASH);
  // A non-positive / non-finite timeoutMs would make setTimeout fire on the
  // first tick (`setTimeout(fn, 0)`/NaN), so a buggy caller's 0 produced an
  // immediate "timed out after 0s" the caller never asked for. Mirror the
  // OpenAI-compatible adapter: only a positive finite number is honored, else
  // the per-tier default applies. 346 C3: a FINITE value past setTimeout's
  // 32-bit ceiling is clamped (Node would otherwise fire it at 1ms), so a large
  // budget stays a real timer instead of an instant abort.
  const tierTimeoutMs = isPro ? TIMEOUT_PRO_MS : TIMEOUT_FLASH_MS;
  const timeoutMs =
    typeof opts.timeoutMs === "number" && Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0
      ? Math.min(opts.timeoutMs, MAX_PROVIDER_TIMEOUT_MS)
      : tierTimeoutMs;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  if (opts.json) {
    // `json_object` requires an explicit "emit JSON" instruction, or the model
    // may loop on whitespace until the token cap (§4d).
    messages.push({
      role: "system",
      content: "Respond with valid JSON only — no prose, no markdown fences.",
    });
  }
  // History must be an array of user/assistant turns. Non-array garbage
  // (hostile/JS callers) degrades to no history, and any other role is
  // dropped — a smuggled "system" turn would otherwise append instructions
  // AFTER our own system prompt. Entries are trimmed and length-capped so a
  // huge turn cannot blow the context budget.
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
  for (const m of history) {
    messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: "user", content: prompt });

  const body = {
    model,
    messages,
    // fixes/156 (E1): `thinking:false` (an explicit caller override) forces
    // the non-thinking shape on the pro tier too — a structured json
    // envelope needs OUTPUT budget, not chain-of-thought (reasoning on the
    // large synthesis prompts consumed the whole max_tokens window and
    // returned content:"" — see the option doc above). The default stays
    // byte-identical: pro = enabled + reasoning_effort high, flash =
    // disabled (opts.thinking can only ever turn pro OFF; a flash call with
    // `thinking:true` keeps the disabled shape — flash has no thinking-on
    // shape in this module).
    ...(opts.thinking === false || !isPro
      ? { thinking: { type: "disabled" as const } }
      : { thinking: { type: "enabled" as const }, reasoning_effort: "high" as const }),
    max_tokens: maxTokens,
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
    stream: false,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const deps: DeepSeekFetchDeps = {
      fetch: opts.fetch ?? defaultDeps.fetch,
      sleep: opts.sleep ?? defaultDeps.sleep,
      random: opts.random ?? defaultDeps.random,
    };
    const requestInit: RequestInit = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    };
    // W61 lane D (D4 / research/deepseek-api.md §5): `insufficient_system_resource`
    // rides a 200 BODY, not an HTTP status — `postWithRetry`'s status set cannot
    // see it. Retry it here with the SAME full-jitter policy, bounded at
    // MAX_ATTEMPTS and sharing the caller's absolute abort deadline. Every other
    // finish_reason (incl. the non-retry `content_filter`) is read once below.
    let issued = await postWithRetry(`${DEEPSEEK_BASE_URL}/chat/completions`, requestInit, deps);
    let rawSuccess = issued.response.ok ? await issued.response.text().catch(() => "") : "";
    for (let bodyAttempt = 1; bodyAttempt < MAX_ATTEMPTS && issued.response.ok; bodyAttempt++) {
      if (finishReasonOf(rawSuccess) !== "insufficient_system_resource") break;
      await deps.sleep(jitteredBackoffDelayMs(bodyAttempt, deps.random));
      issued = await postWithRetry(`${DEEPSEEK_BASE_URL}/chat/completions`, requestInit, deps);
      rawSuccess = issued.response.ok ? await issued.response.text().catch(() => "") : "";
    }
    const res = issued.response;
    const attempts = issued.attempts;

    if (!res.ok) {
      // Retry-count honesty: a call that exhausted its transient retries says
      // so; a first-attempt refusal keeps the byte-identical historic message.
      const exhausted = attempts > 1 ? ` (after ${attempts} attempts)` : "";
      // OV-37 (W17 · L3): the refusal NAMES the requested model id next to
      // the vendor's own text — a dead/renamed alias (400 "model not
      // found") is then human-visible without parsing prose (the row's
      // explicit constraint). No model substitution, no fallback.
      // W23-L1 (fixes/262): HTTP 402 / "Insufficient Balance" gets its OWN
      // code — a broke wallet is not a generic refusal (RT_E_LLM_REJECTED)
      // and not our session budget (RT_E_BUDGET_EXHAUSTED, 226 A3). The
      // vendor text comes from the SAME describeError() string the refusal
      // already carried, so the message stays byte-identical; only the code
      // changes for the 402 class.
      const refusalText = await describeError(res);
      // W41·Q7 (G3 residual, fixes/285): the wallet-empty class is checked on
      // the TEXT as well as the status — see isInsufficientFundsText above for
      // the widened, still-narrow shapes.
      const noBalance = res.status === 402 || isInsufficientFundsText(refusalText);
      // W45·331-1 (Keywright, F3): a rejected CREDENTIAL is its own class, and
      // its message names the SOURCE the key came from (repo .env path or the
      // process environment) by last-4 tail only — so a two-key conflict is
      // diagnosable from the tail alone, and no full secret is ever emitted.
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

    // 216 (T0.6 — MED-3): this success path previously called res.json()
    // UNGUARDED, so an HTTP-200 non-JSON body (a proxy/gateway HTML page, a
    // truncated response) threw straight into the outer catch and was
    // mislabelled as a transport failure — the user saw "unreachable" when the
    // provider had in fact answered. Read the raw text ONCE and parse
    // defensively: the same discipline describeError() already applies on the
    // error path (:240-254). A non-JSON 200 now surfaces honestly as
    // RT_E_INTERNAL with a bounded excerpt. (rawSuccess was read once above so
    // the D4 insufficient_system_resource retry could inspect finish_reason.)
    let parsed: DeepSeekChatBody;
    try {
      const body: unknown = JSON.parse(rawSuccess);
      // Only a JSON OBJECT can be a chat body — a quoted string / number /
      // array is not a completion and must not reach the reader below.
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        throw new SyntaxError("body is not a JSON object");
      }
      parsed = body as DeepSeekChatBody;
    } catch {
      const flat = rawSuccess.replace(/\s+/g, " ").trim();
      const bounded = flat.length > 200 ? `${flat.slice(0, 200)}…` : flat;
      return {
        ok: false,
        reason: "error",
        error: `DeepSeek returned a non-JSON ${res.status} response${bounded ? `: ${bounded}` : ""}`,
        code: "RT_E_INTERNAL",
      };
    }
    const content = parsed.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      // fixes/152-153: an EMPTY content on a thinking model is a diagnostic,
      // not just a refusal — surface WHY so the loop can adapt: reasoning-only
      // responses (thinking consumed the output), max_tokens truncation
      // (finish_reason "length"), or a genuinely silent model.
      const reasoning = parsed.choices?.[0]?.message?.reasoning_content;
      const reason = parsed.choices?.[0]?.finish_reason;
      const finishClass = classifyFinishReason(reason);
      const reasoningNote =
        typeof reasoning === "string" && reasoning.trim()
          ? `; model returned reasoning only (${reasoning.trim().length} chars of reasoning_content, content empty)`
          : "";
      const lengthNote = finishClass === "length" ? "; stopped at max_tokens (finish_reason length)" : "";
      // W61 lane D (D4): the documented taxonomy, classified — a `content_filter`
      // refusal is NOT retryable and is named as such; `insufficient_system_resource`
      // reached this point only after the bounded retry above was exhausted.
      if (finishClass === "content_filter") {
        return {
          ok: false,
          reason: "error",
          error: `DeepSeek refused the request (finish_reason content_filter)${reasoningNote}`,
          code: "RT_E_LLM_REJECTED",
        };
      }
      const capacityNote =
        finishClass === "insufficient_system_resource"
          ? "; capacity interrupted (finish_reason insufficient_system_resource) after retries"
          : "";
      return {
        ok: false,
        reason: "error",
        error: `DeepSeek returned no text content${reasoningNote}${lengthNote}${capacityNote}`,
        code: "RT_E_LLM_REJECTED",
      };
    }
    const usage = parsed.usage;
    return {
      ok: true,
      text: content.trim(),
      model:
        typeof parsed.model === "string" && parsed.model ? parsed.model : model,
      ...(usage &&
      typeof usage.prompt_tokens === "number" &&
      typeof usage.completion_tokens === "number"
        ? {
            usage: {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              // W39·K6 (completes C2 · fixes/288_c2): the context-cache split
              // the vendor reports on every response — "Checking Cache Hit
              // Status" (api-docs.deepseek.com/guides/kv_cache): hit tokens
              // are billed at the cache-hit price, miss tokens at the full
              // input price (the docs' own 50x spread). The TYPE carried these
              // fields since C2's 00:21 patch; this parse completes the job.
              // Additive + conditional: a response without the fields (old
              // cassette tapes, other providers) keeps the EXACT legacy 2-key
              // usage object, so the deepEqual pins at
              // deepseek.server.test.ts:389 and the cassette copy semantics
              // stay green. `cachedPromptTokens` is the token-ledger /
              // packet / doctor vocabulary (`TokenSpend.cachedPromptTokens`,
              // packet `cached_prompt_tokens`) — the pass-through ledger
              // seams (token-ledger `recordBudgetSpend(budget, res.usage)`
              // merges CACHE_FIELDS off the spend object) accumulate it with
              // no further wiring; hand-built spends in codegen/crew/subagent
              // are logged in fixes/290_k6 for their owners.
              ...(typeof usage.prompt_cache_hit_tokens === "number"
                ? { cachedPromptTokens: usage.prompt_cache_hit_tokens }
                : {}),
              ...(typeof usage.prompt_cache_miss_tokens === "number"
                ? { cacheMissTokens: usage.prompt_cache_miss_tokens }
                : {}),
            },
          }
        : {}),
    };
  } catch (err) {
    if (isAbortError(err)) {
      return {
        ok: false,
        reason: "error",
        error: `DeepSeek request timed out after ${Math.round(timeoutMs / 1000)}s`,
        code: "RT_E_LLM_TIMEOUT",
      };
    }
    return {
      ok: false,
      reason: "error",
      error:
        err instanceof Error
          ? `DeepSeek request failed: ${err.message}${
              (err as Error & { attempts?: number }).attempts
                ? ` (after ${(err as Error & { attempts?: number }).attempts} attempts)`
                : ""
            }`
          : "DeepSeek request failed",
      code: classifyError(err, "RT_E_LLM_REJECTED"),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// W23-L1 (fixes/262) — the opt-in CALL TAP: the smallest seam that carries
// every keyed call's outcome (served model id + measured usage + failure code)
// to a driver that otherwise has no channel into the provider.
//
// Why here: engine's P6 door (`./deepseek.` + `server.ts`), codegen's
// synthesis and the registry ALL route to this file's `completeDeepSeek`, so
// ONE tap at this funnel observes every keyed call without touching a single
// seam. A driver (run-eval, per keyed run) installs it explicitly; with NO tap
// installed this module is byte-identical to pre-tap behavior.
//
// Telemetry contract (AGENTS.md honesty rule 7): a tap may never change the
// observed call's behavior and may never throw into it — the dispatch below is
// wrapped, and only a bounded per-call record (never a prompt, never a key) is
// handed over.
// ---------------------------------------------------------------------------

/** One observed provider call — the per-call evidence the eval driver folds
 *  into its trial rows (`servedModels` / `usage` / refusal codes). */
export type LlmCallTapRecord = {
  /** Epoch ms the call finished. */
  at: number;
  ok: boolean;
  /** The id RapidTool REQUESTED (the alias). */
  requestedModel: string;
  /** The id the provider SAID it served (read back from the response) — null
   *  when the call was refused, because nothing was served. */
  servedModel: string | null;
  /** Coded failure class (errors.ts) — null on success. */
  code: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  /**
   * W41·Q7 (G3's "tap records — cache-field gap", fixes/285): the context-cache
   * split of `promptTokens`, forwarded so a driver can price the cheaper
   * cache-hit bucket (run-eval's estimate) and read the cache discipline of a
   * run. ADDITIVE + CONDITIONAL, exactly like the LlmUsage fields it mirrors:
   * a call whose response (or tape) reports no split keeps the byte-identical
   * legacy record — no consumer that ignores them is affected, and no
   * fabricated 0 is ever emitted for a response that did not report.
   * `cachedPromptTokens` = hit tokens (DeepSeek `prompt_cache_hit_tokens` /
   * OpenAI-style `prompt_tokens_details.cached_tokens`), `cacheMissTokens` =
   * the vendor's explicit miss count (DeepSeek only).
   */
  cachedPromptTokens?: number | null;
  cacheMissTokens?: number | null;
};

let llmCallTap: ((record: LlmCallTapRecord) => void) | null = null;

/** Install a tap; `null` (or any non-function) clears it. */
export function setLlmCallTap(tap: ((record: LlmCallTapRecord) => void) | null): void {
  llmCallTap = typeof tap === "function" ? tap : null;
}

/** Remove the tap (back to the byte-identical no-op path). */
export function clearLlmCallTap(): void {
  llmCallTap = null;
}

/** Best-effort record — never throws into the call it observes. */
function tapLlmCall(record: LlmCallTapRecord): void {
  const tap = llmCallTap;
  if (!tap) return;
  try {
    const ret = (tap as (r: LlmCallTapRecord) => unknown)(record);
    // W26 H3 (fixes/266): the try/catch alone only contained SYNCHRONOUS
    // throws. A tap may be async (an `async` function is assignable to the
    // `=> void` tap type), and a rejection it returns would surface as an
    // unhandled rejection — which Node turns into a fatal error, killing the
    // very CLI run this telemetry observes (repro before the fix:
    // probe-h3-tap-crash.ts exits 1 at this call). Contain the promise
    // channel too: swallow the rejection here, never leave it floating.
    const maybeThenable = ret as { then?: unknown } | null | undefined;
    if (maybeThenable !== null && maybeThenable !== undefined && typeof maybeThenable.then === "function") {
      (ret as PromiseLike<unknown>).then(undefined, () => {
        /* telemetry must never throw into the call it observes */
      });
    }
  } catch {
    /* telemetry must never throw into the call it observes */
  }
}

/**
 * The provider entry point (unchanged signature + behavior). `completeDeepSeekInner`
 * computes the result; this wrapper forwards it untouched and, when a tap is
 * installed, appends ONE record for the call (success or refusal).
 *
 * T5.7: the real wire call is routed through the env-armed cassette. With
 * `RAPIDTOOL_CASSETTE_MODE` unset/"off" the transport returned is
 * `completeDeepSeekInner` itself — the pre-cassette path, byte-identical.
 * `record` tapes the served envelope; `replay` serves from the tape and never
 * reaches `completeDeepSeekInner`.
 */
export async function completeDeepSeek(
  prompt: string,
  opts: DeepSeekCompleteOptions = {},
): Promise<LlmResult> {
  // 340-4: the family id is folded into the tape key, so a DeepSeek tape can
  // never serve the OpenAI-compatible family (and vice versa) for a same
  // model-id string. Mirrors the registry's LlmProviderId member "deepseek".
  const transport = await wrapWithActiveCassette(completeDeepSeekInner, "deepseek");
  const res = await transport(prompt, opts);
  const record: LlmCallTapRecord = {
    at: Date.now(),
    ok: res.ok === true,
    requestedModel:
      typeof opts.model === "string" && opts.model ? opts.model : DEEPSEEK_MODELS.flash,
    servedModel: res.ok === true ? res.model : null,
    code: res.ok === true ? null : res.code ?? null,
    promptTokens: res.ok === true && res.usage ? res.usage.promptTokens : null,
    completionTokens: res.ok === true && res.usage ? res.usage.completionTokens : null,
    // W42·B2 (fixes/307_b2_backends — completes the k6 #4 cache chain): the
    // vendor's context-cache split ride-along. The record TYPE has carried
    // these since W41·Q7 (G3, fixes/285) but this emit dropped them, so every
    // downstream fold (run-eval's `llmEvidenceFromCallRecords`) saw 2 keys and
    // cache spend could never be priced. Additive + conditional, exactly like
    // the parse site (:577-582): a response (or tape) that reports no split
    // keeps the byte-identical legacy record — no fabricated 0, no consumer
    // that ignores the fields is affected.
    ...(res.ok === true && res.usage && typeof res.usage.cachedPromptTokens === "number"
      ? { cachedPromptTokens: res.usage.cachedPromptTokens }
      : {}),
    ...(res.ok === true && res.usage && typeof res.usage.cacheMissTokens === "number"
      ? { cacheMissTokens: res.usage.cacheMissTokens }
      : {}),
  };
  tapLlmCall(record);
  appendUsageRecord(record);
  return res;
}

/**
 * W45·331-1 (Keywright) — OPT-IN usage log. When `RAPIDTOOL_LLM_USAGE_LOG` holds
 * a file path, every completed provider call appends ONE JSON line (the same
 * tail-safe `LlmCallTapRecord` the tap carries: model, code, token counts — no
 * prompt, no key). Unset ⇒ byte-identical behavior; this exists so a driver that
 * cannot install the in-process tap (e.g. the Vite dev server behind the
 * console's "Spawn crew") can still read the call's REAL measured usage. Never
 * throws into the call it observes.
 */
function appendUsageRecord(record: LlmCallTapRecord): void {
  const path = process.env.RAPIDTOOL_LLM_USAGE_LOG?.trim();
  if (!path) return;
  try {
    appendFileSync(path, JSON.stringify(record) + "\n");
  } catch {
    /* best-effort telemetry; the call result is unaffected */
  }
}
