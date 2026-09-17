/**
 * Mock LLM provider — deterministic canned replies, ZERO network,
 * EXPLICIT-SELECTION ONLY (T-107.10, W7 · L4 — fixes/216t).
 *
 * Steals dossier 107 §:316 ("Deterministic LLM-free E2E": a mock LLM *is* a
 * replay fixture → 103 A8): the transport is a QUEUE of canned envelopes, so
 * a test can run the real pipeline (real prompt builders, real parsers, real
 * validators, real emission) with the model replaced — no key check faked, no
 * socket opened, no text invented.
 *
 * HONESTY RULES (non-negotiable — AGENTS.md §honesty contract):
 *   1. NEVER a default. `ROLE_TIERS` still resolves every role to DeepSeek,
 *      the provider is NOT in `PROVIDERS`, and `getProvider("mock")` stays
 *      `undefined`; its ids are NOT in `KNOWN_MODEL_IDS`. Reaching it takes
 *      an EXPLICIT act: pass `mock.descriptor` as `callModel(…, {provider})`,
 *      inject `mock.complete` as an app seam, or opt in with
 *      `selectMockProvider({ explicit: true })` / `RAPIDTOOL_MOCK_LLM=1`.
 *   2. NEVER "configured". `descriptor.isConfigured()` is hard-wired `false`
 *      and no probe reads it: a mock can never satisfy `isDeepSeekConfigured`
 *      / `crewConfigured()` / the doctor's provider census, so the keyless
 *      floors (`RT_E_LLM_NOT_CONFIGURED`) stay exactly as honest as before.
 *   3. NEVER fabrication. An exhausted queue returns a coded refusal
 *      (`RT_E_LLM_REJECTED`) naming the mock — the mock has no fallback text,
 *      no template, no "sensible default" reply.
 *   4. Model ids live in the MOCK's OWN namespace (`mock-canned-v1`), never in
 *      DeepSeek's: the registry validates an explicitly-passed provider's model
 *      id against THAT provider's `requestModelIds` (registry.ts
 *      `resolveExplicitProvider`).
 *
 * Not here (deliberately): env-based provider routing for `callModel`
 * (`RAPIDTOOL_PROVIDER`, research/multiagent/101_provider_integration.md §4)
 * — that scheme is a later wave's; this module gives it the mock it needs
 * without pre-empting its semantics.
 */

import type { ErrorCode } from "../../errors.ts";
import type { LlmResult } from "../../llm.ts";
import type { DeepSeekCompleteOptions } from "./deepseek.ts";
import type { LlmProviderDescriptor } from "./registry.ts";

/** Provider id — its own provider, never a DeepSeek model alias. */
export const MOCK_PROVIDER_ID = "mock";

/** The mock's request-path model id (its own namespace). */
export const MOCK_MODEL_ID = "mock-canned-v1";

/** Every id the mock may be asked for (its OWN universe, not `KNOWN_MODEL_IDS`). */
export const MOCK_MODEL_IDS: readonly string[] = Object.freeze([MOCK_MODEL_ID]);

/** Explicit-selection env var (the "env" half of "env/param"). */
export const MOCK_SELECT_ENV = "RAPIDTOOL_MOCK_LLM";

/** The ONLY value that selects the mock — anything else (incl. "true"/"yes")
 *  counts as UNSET, so a sloppy env can never arm a mock by accident. */
export const MOCK_SELECT_VALUE = "1";

/** One canned reply. `ok:false` envelopes are first-class: the mock can be
 *  asked to refuse (timeouts/rejections) without inventing a failure path. */
export type MockEnvelope = LlmResult;

/** One served call — prompt + options exactly as the pipeline sent them. */
export type MockLlmCall = {
  readonly index: number;
  readonly prompt: string;
  readonly opts: DeepSeekCompleteOptions;
};

export type MockLlmProvider = {
  /** The provider descriptor (`isConfigured()` hard-wired `false`). */
  readonly descriptor: LlmProviderDescriptor;
  /** The injected transport — signature-compatible with every `complete` seam. */
  complete(prompt: string, opts?: DeepSeekCompleteOptions): Promise<LlmResult>;
  /** Every served call, in order (assert what the pipeline really asked). */
  calls(): readonly MockLlmCall[];
  /** Envelopes still queued. */
  remaining(): number;
  /** Append envelopes to the queue. */
  push(...envelopes: readonly MockEnvelope[]): void;
  /** Replace the queue (default: empty) and — only when asked — the call log. */
  reset(envelopes?: readonly MockEnvelope[], opts?: { keepCalls?: boolean }): void;
};

function copyEnvelope(env: MockEnvelope): LlmResult {
  if (env.ok) {
    return {
      ok: true,
      text: env.text,
      model: env.model,
      ...(env.usage ? { usage: { promptTokens: env.usage.promptTokens, completionTokens: env.usage.completionTokens } } : {}),
    };
  }
  return { ok: false, reason: env.reason, error: env.error, ...(env.code ? { code: env.code } : {}) };
}

/**
 * Build a mock provider over a canned-envelope queue. Constructing the
 * provider IS the explicit selection (the "param" half) — there is no code
 * path anywhere that builds one implicitly.
 */
export function createMockProvider(
  envelopes: readonly MockEnvelope[] = [],
  opts: { label?: string } = {},
): MockLlmProvider {
  const queue: LlmResult[] = envelopes.map(copyEnvelope);
  const log: MockLlmCall[] = [];

  const complete = async (prompt: string, callOpts?: DeepSeekCompleteOptions): Promise<LlmResult> => {
    log.push({ index: log.length, prompt, opts: callOpts ?? {} });
    const next = queue.shift();
    if (!next) {
      return {
        ok: false,
        reason: "error",
        code: "RT_E_LLM_REJECTED",
        error:
          `mock provider (${MOCK_PROVIDER_ID}) queue exhausted after ${log.length - 1} served call(s) — ` +
          "the mock NEVER fabricates text; enqueue the next canned envelope.",
      };
    }
    return next.ok ? { ...next, model: next.model ?? MOCK_MODEL_ID } : next;
  };

  const descriptor: LlmProviderDescriptor = Object.freeze({
    id: MOCK_PROVIDER_ID,
    label: opts.label ?? "Mock (test-only; explicit selection only)",
    /** No key exists — an empty name can never resolve `env[""]` to a value. */
    apiKeyEnv: "",
    modelEnvPrefix: "MOCK",
    defaultBaseUrl: "mock://local",
    requestModelIds: MOCK_MODEL_IDS,
    /** Hard-wired: a mock NEVER satisfies a configured probe. */
    isConfigured: () => false,
    complete,
  });

  return {
    descriptor,
    complete,
    calls: () => log.slice(),
    remaining: () => queue.length,
    push: (...more) => {
      for (const env of more) queue.push(copyEnvelope(env));
    },
    reset: (more = [], resetOpts = {}) => {
      queue.length = 0;
      for (const env of more) queue.push(copyEnvelope(env));
      if (resetOpts.keepCalls !== true) log.length = 0;
    },
  };
}

/**
 * The env half of explicit selection: `RAPIDTOOL_MOCK_LLM=1` — exact value
 * only, trimmed; unset/blank/anything-else is NOT selected. Never a default.
 */
export function mockSelected(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const raw = env ? env[MOCK_SELECT_ENV] : undefined;
  return typeof raw === "string" && raw.trim() === MOCK_SELECT_VALUE;
}

/**
 * The gated constructor: returns a mock ONLY when it was explicitly selected
 * (`explicit: true` = the param path, or `RAPIDTOOL_MOCK_LLM=1` = the env
 * path). Otherwise a CODED refusal (`RT_E_VALIDATION`) — never a silent mock,
 * never a fallback mock. `isConfigured` is untouched by this: selecting the
 * mock never makes any "configured" probe true.
 */
export function selectMockProvider(
  deps: {
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
    envelopes?: readonly MockEnvelope[];
    explicit?: boolean;
    label?: string;
  } = {},
): { ok: true; mock: MockLlmProvider } | { ok: false; code: ErrorCode; error: string } {
  const env = deps.env ?? process.env;
  if (deps.explicit !== true && !mockSelected(env)) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error:
        `the ${MOCK_PROVIDER_ID} provider requires EXPLICIT selection — pass explicit: true or set ` +
        `${MOCK_SELECT_ENV}=${MOCK_SELECT_VALUE}. A mock is never a default and never satisfies a configured probe.`,
    };
  }
  return { ok: true, mock: createMockProvider(deps.envelopes ?? [], { label: deps.label }) };
}
