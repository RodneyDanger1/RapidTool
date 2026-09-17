/**
 * RapidTool provider REGISTRY + role tiers (T-107.2, W5 · L4 — fixes/216p).
 *
 * ONE registry for every model call. Today it knows exactly one provider
 * (DeepSeek, ported to `./deepseek.ts`), but every call goes through a ROLE,
 * not a vendor id:
 *
 *   - `main`      — the default workhorse (flash tier). V4.1-Flash beats Pro on
 *                   every agentic/coding axis (research/deepseek-api.md §9, the
 *                   107 T-107.1-era tier inversion) — do NOT "upgrade" it to pro.
 *   - `reasoning` — knowledge/reasoning-heavy turns (pro tier: thinking enabled,
 *                   the 60s budget; callers override per call as today).
 *   - `weak`      — the cheapest tier for short structured envelopes (flash,
 *                   thinking disabled). It resolves to the same model as `main`
 *                   today; its reason to exist is that a future registry can
 *                   route it to a small local model without touching seams.
 *
 * THE EXPLICIT-MODEL RULE (the point of this module): an explicit model id —
 * `opts.model` at a call site, or a `<PREFIX>_MODEL_<ROLE>` env pin — must be
 * EXACTLY one of `KNOWN_MODEL_IDS`. Anything else is REFUSED with a coded
 * `RT_E_VALIDATION` result BEFORE any network I/O; it is NEVER silently
 * replaced by a default. (Precedence: explicit call-site id > env pin > tier.)
 *
 * `KNOWN_MODEL_IDS` is the live-VERIFIED request-path set — `deepseek-v4-flash`
 * (served as `deepseek-flash`) and `deepseek-v4-pro` — NOT the forward-compat
 * status list `deepSeekModelIds()` publishes to the UI (which also carries
 * `deepseek-v4-flash-vision-exp`, whose request-path acceptance is UNVERIFIED,
 * plus the vendor-rejected version-tagged family; see deepseek.ts header).
 *
 * Honesty contract (unchanged by this layer): no key ⇒ the provider returns
 * `{ ok: false, reason: "not-configured", code: "RT_E_LLM_NOT_CONFIGURED" }`
 * before any network I/O. The registry NEVER fabricates model text and NEVER
 * substitutes a different provider silently.
 *
 * Not yet in this module (deliberately deferred, fixes/216p §4): multi-provider
 * env selection (`RAPIDTOOL_PROVIDER`), failover, probes/doctor surfacing, and
 * per-call telemetry — all specified in research/multiagent/101_provider_integration.md §4
 * and owned by later waves.
 *
 * T-107.10 (W7 · L4, fixes/216t) added ONE seam here, additively: an EXPLICIT
 * provider selection (`CallModelOptions.provider` + `resolveExplicitProvider`)
 * so a caller can dispatch to an explicitly-passed provider — today the
 * test-only mock (`./mock.ts`, never in `PROVIDERS`, never in `ROLE_TIERS`,
 * never in `KNOWN_MODEL_IDS`). The explicit path validates the MODEL ID
 * against THAT provider's own `requestModelIds` (ids are provider-scoped, so
 * `mock-canned-v1` is never a "deepseek model id"), refuses a malformed
 * descriptor or an out-of-namespace id with `RT_E_VALIDATION`, and NEVER
 * falls back to the role tier. The default path is byte-identical: with no
 * `provider` passed, resolution and dispatch are exactly `resolveRoleModel` →
 * `PROVIDERS` as before, and the keyless floor is untouched.
 */

import {
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODELS,
  completeDeepSeek,
  isDeepSeekConfigured,
} from "./deepseek.ts";
import type { DeepSeekCompleteOptions, DeepSeekMessage } from "./deepseek.ts";
import type { LlmModel, LlmResult } from "../../llm.ts";
import type { ErrorCode } from "../../errors.ts";

// ---------------------------------------------------------------------------
// Role vocabulary
// ---------------------------------------------------------------------------

/** The provider-agnostic call tiers (T-107.2). A seam asks for a ROLE; the
 *  registry decides which provider + model id serves it. */
export type RapidToolModelRole = "main" | "reasoning" | "weak";

/** Every role, in the canonical order (registry listing + tests). */
export const RAPIDTOOL_MODEL_ROLES: readonly RapidToolModelRole[] = Object.freeze([
  "main",
  "reasoning",
  "weak",
]);

/** Runtime guard for hostile/JS callers: is `value` a registered role? */
export function isModelRole(value: unknown): value is RapidToolModelRole {
  return (
    typeof value === "string" &&
    (RAPIDTOOL_MODEL_ROLES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/** Ids the registry knows. Additive: one per provider file under this dir.
 *  `mock` (T-107.10, fixes/216t) is the explicitly-passed test provider from
 *  `./mock.ts` — it is a legal provider ID for the EXPLICIT path only and is
 *  deliberately absent from `PROVIDERS`/`ROLE_TIERS`/`KNOWN_MODEL_IDS`. */
export type LlmProviderId = "deepseek" | "mock";

/** Request-path model ids whose acceptance is live-verified for the DeepSeek
 *  API (2026-09-16, two keys — see `./deepseek.ts` header). `deepseek-flash`
 *  is the id the vendor SERVES for the alias `deepseek-v4-flash`; we keep
 *  requesting the alias (byte-identical to the pre-registry code) and read the
 *  served id back from every response. */
const DEEPSEEK_REQUEST_MODEL_IDS = [
  DEEPSEEK_MODELS.flash,
  DEEPSEEK_MODELS.pro,
] as const;

/** A model id the registry may REQUEST (validated subset — see above). */
export type KnownModelId = (typeof DEEPSEEK_REQUEST_MODEL_IDS)[number];

/** Is `id` exactly one of the live-verified request-path ids? */
export function isKnownModelId(id: string): id is KnownModelId {
  return (DEEPSEEK_REQUEST_MODEL_IDS as readonly string[]).includes(id);
}

/** One provider the registry can route to. Today this is DeepSeek-shaped (the
 *  only implementation); widening it — capabilities, base-URL override,
 *  probe — is the additive step research/multiagent/101_provider_integration.md §4 specifies. */
export type LlmProviderDescriptor = {
  readonly id: LlmProviderId;
  /** Human label for status surfaces (never a secret). */
  readonly label: string;
  /** Env var holding the API key (read server-side only). */
  readonly apiKeyEnv: string;
  /** Prefix for model-id env pins (`<PREFIX>_MODEL_<ROLE>`). */
  readonly modelEnvPrefix: string;
  readonly defaultBaseUrl: string;
  /** The ids this provider may be REQUESTED for — a PROVIDER-SCOPED
   *  namespace. DeepSeek lists its live-verified request ids (the same set
   *  `KNOWN_MODEL_IDS` publishes); the mock lists its own `mock-canned-v1`.
   *  Widened from `KnownModelId[]` to `string[]` by T-107.10 (fixes/216t) so
   *  a non-DeepSeek provider can be described without inventing a DeepSeek
   *  model id — the registry validates an explicit provider's model against
   *  ITS OWN list, never against DeepSeek's. */
  readonly requestModelIds: readonly string[];
  readonly isConfigured: () => boolean;
  readonly complete: (
    prompt: string,
    opts: DeepSeekCompleteOptions,
  ) => Promise<LlmResult>;
};

/** The registered providers, in preference order. One today; the array shape
 *  is the multi-provider extension point (101 §4.5). */
export const PROVIDERS: readonly LlmProviderDescriptor[] = Object.freeze([
  {
    id: "deepseek",
    label: "DeepSeek",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    modelEnvPrefix: "DEEPSEEK",
    defaultBaseUrl: DEEPSEEK_BASE_URL,
    requestModelIds: DEEPSEEK_REQUEST_MODEL_IDS,
    isConfigured: isDeepSeekConfigured,
    complete: completeDeepSeek,
  },
]);

/** Look a provider up by id. Unknown id ⇒ `undefined` (never a silent fallback;
 *  `callModel` converts a missing tier provider into a coded refusal). */
export function getProvider(id: string): LlmProviderDescriptor | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Explicit provider selection (T-107.10 · W7-L4, fixes/216t)
// ---------------------------------------------------------------------------

/**
 * Result of resolving an explicitly-passed provider: the descriptor to
 * dispatch through plus the model id to send. The id is validated against the
 * PROVIDER'S OWN `requestModelIds` namespace — never against
 * `KNOWN_MODEL_IDS` (which stays DeepSeek-only, so a mock id can never pose
 * as a DeepSeek model id).
 */
export type ExplicitProviderSelection =
  | { ok: true; descriptor: LlmProviderDescriptor; model: string }
  | { ok: false; code: ErrorCode; error: string };

/**
 * Validate an EXPLICITLY passed provider descriptor (T-107.10): shape-check it
 * (a hostile/partial object is a coded `RT_E_VALIDATION` refusal — never a
 * dispatch, never a silent fallback to the role tier), then pick the model id:
 * `opts.model` when given (must be in THAT provider's `requestModelIds`) else
 * the provider's first request id. Pure — no I/O, no env read.
 */
export function resolveExplicitProvider(
  provider: unknown,
  opts: { model?: unknown } = {},
): ExplicitProviderSelection {
  const bad = (error: string): ExplicitProviderSelection => ({ ok: false, code: "RT_E_VALIDATION", error });
  if (provider === null || typeof provider !== "object" || Array.isArray(provider)) {
    return bad(
      `an explicit provider must be a provider descriptor object — got ${provider === null ? "null" : Array.isArray(provider) ? "an array" : typeof provider}. Refusing rather than falling back to the role tier.`,
    );
  }
  const rec = provider as Record<string, unknown>;
  const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : "";
  if (!id) return bad("an explicit provider descriptor needs a non-empty string id");
  if (typeof rec.complete !== "function") {
    return bad(`explicit provider "${id}" has no complete() — refusing rather than dispatching into a half-built provider`);
  }
  if (typeof rec.isConfigured !== "function") {
    return bad(`explicit provider "${id}" has no isConfigured() — a provider descriptor must carry the honest probe`);
  }
  const requestModelIds = Array.isArray(rec.requestModelIds)
    ? rec.requestModelIds.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
    : [];
  if (requestModelIds.length === 0) {
    return bad(`explicit provider "${id}" declares no requestModelIds — nothing to request; refusing`);
  }
  const explicit = opts.model;
  if (explicit !== undefined) {
    if (typeof explicit !== "string" || explicit.trim() === "") {
      return bad(
        `explicit provider "${id}": an explicit model id must be a non-empty string — got ${JSON.stringify(explicit)}. Refusing rather than silently defaulting.`,
      );
    }
    const wanted = explicit.trim();
    if (!requestModelIds.includes(wanted)) {
      return bad(
        `explicit provider "${id}": model "${wanted}" is not in that provider's request ids (${requestModelIds.join(", ")}) — ids are provider-scoped; refusing rather than substituting.`,
      );
    }
    return { ok: true, descriptor: provider as LlmProviderDescriptor, model: wanted };
  }
  return { ok: true, descriptor: provider as LlmProviderDescriptor, model: requestModelIds[0]! };
}

// ---------------------------------------------------------------------------
// Role tiers
// ---------------------------------------------------------------------------

/** One role tier: which provider + which model id resolves it, plus the
 *  honest rationale (the tier table is documentation, not decoration). */
export type RoleTier = {
  readonly provider: LlmProviderId;
  readonly model: KnownModelId;
  readonly note: string;
};

/** Role → provider/model. The ONLY place a seam's role becomes a model id. */
export const ROLE_TIERS: Readonly<Record<RapidToolModelRole, RoleTier>> =
  Object.freeze({
    main: {
      provider: "deepseek",
      model: DEEPSEEK_MODELS.flash,
      note: "default workhorse (flash) — strongest agentic/coding tier; never silently swap to pro",
    },
    reasoning: {
      provider: "deepseek",
      model: DEEPSEEK_MODELS.pro,
      note: "knowledge/reasoning-heavy turns (pro: thinking enabled + 60s budget)",
    },
    weak: {
      provider: "deepseek",
      model: DEEPSEEK_MODELS.flash,
      note: "cheapest structured-envelope tier; same served model as main today, routable to a small local model later",
    },
  });

/** The env var that pins a role's model, e.g. `DEEPSEEK_MODEL_MAIN`
 *  (`<provider prefix>_MODEL_<ROLE>`). `null` for an unknown role. An env pin
 *  is validated by the explicit-model rule exactly like a call-site override. */
export function roleModelEnvKey(role: RapidToolModelRole): string | null {
  if (!isModelRole(role)) return null;
  const tier = ROLE_TIERS[role];
  const provider = getProvider(tier.provider);
  if (!provider) return null;
  return `${provider.modelEnvPrefix}_MODEL_${role.toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Resolution + the call
// ---------------------------------------------------------------------------

/** Successful resolution: the role, its provider, and the model id to send. */
export type RoleResolution =
  | {
      ok: true;
      role: RapidToolModelRole;
      provider: LlmProviderId;
      model: KnownModelId;
    }
  | { ok: false; error: string; code: ErrorCode };

/**
 * Resolve a role to a request model id (T-107.2 — the explicit-model rule).
 *
 * Precedence: `opts.model` (call-site explicit) → `<PREFIX>_MODEL_<ROLE>` env
 * pin → the role tier's model. BOTH explicit forms are validated against
 * `KNOWN_MODEL_IDS`; an unknown/blank/non-string id is REFUSED
 * (`RT_E_VALIDATION`, message naming the known ids) rather than silently
 * defaulting. Pure — no I/O; safe to unit-test without a fetch stub.
 */
export function resolveRoleModel(
  role: RapidToolModelRole,
  opts: { model?: unknown; env?: NodeJS.ProcessEnv } = {},
): RoleResolution {
  if (!isModelRole(role)) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `unknown model role "${String(role)}" — known roles: ${RAPIDTOOL_MODEL_ROLES.join(
        ", ",
      )}`,
    };
  }
  const tier = ROLE_TIERS[role];
  const provider = getProvider(tier.provider);
  if (!provider) {
    return {
      ok: false,
      code: "RT_E_INTERNAL",
      error: `model role "${role}" names unregistered provider "${tier.provider}"`,
    };
  }

  const explicit = opts.model;
  if (explicit !== undefined) {
    if (typeof explicit !== "string" || explicit.trim() === "") {
      return {
        ok: false,
        code: "RT_E_VALIDATION",
        error: `model role "${role}": an explicit model id must be a non-empty string — got ${JSON.stringify(
          explicit,
        )}. Refusing rather than silently defaulting.`,
      };
    }
    return checked(role, provider, explicit.trim(), `explicit model "${explicit.trim()}"`);
  }

  const env = opts.env ?? process.env;
  const envKey = roleModelEnvKey(role);
  const pinned = envKey ? env[envKey]?.trim() : undefined;
  if (pinned) {
    return checked(role, provider, pinned, `model pinned by ${envKey} ("${pinned}")`);
  }

  return { ok: true, role, provider: provider.id, model: tier.model };
}

function checked(
  role: RapidToolModelRole,
  provider: LlmProviderDescriptor,
  id: string,
  source: string,
): RoleResolution {
  if (!isKnownModelId(id)) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `${source} is not a known model id — known ids: ${KNOWN_MODEL_IDS.join(
        ", ",
      )}. Refusing rather than silently defaulting.`,
    };
  }
  return { ok: true, role, provider: provider.id, model: id };
}

/** Every model id the registry may send (the explicit-model rule's universe). */
export const KNOWN_MODEL_IDS: readonly string[] = Object.freeze([
  ...DEEPSEEK_REQUEST_MODEL_IDS,
]);

/** Options for a registry call: the provider-facing knobs minus the model id
 *  that the role decides, plus an optional validated override. Mirrors
 *  `DeepSeekCompleteOptions` so a seam switch is a rename, not a rewrite. */
export type CallModelOptions = {
  /** Explicit model id override — must be EXACTLY one of `KNOWN_MODEL_IDS`
   *  (the explicit-model rule); unknown ⇒ coded `RT_E_VALIDATION` refusal. */
  model?: string;
  /** Explicit PROVIDER override (T-107.10 · W7-L4, fixes/216t) — the
   *  "param" half of explicit selection. ONLY an explicitly constructed
   *  descriptor (today: `./mock.ts`'s) is meaningful here; the role tier is
   *  never consulted when this is passed and a malformed/out-of-namespace
   *  selection is a coded refusal, never a fallback. Omitted ⇒ the default
   *  DeepSeek tier path, byte-identical. */
  provider?: LlmProviderDescriptor;
  system?: string;
  maxTokens?: number;
  json?: boolean;
  thinking?: boolean;
  timeoutMs?: number;
  history?: DeepSeekMessage[];
  /** Test/dev seams (fixes/152), forwarded to the provider. */
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

/**
 * Call a provider BY ROLE (T-107.2). The role decides the provider + model id
 * (see `ROLE_TIERS`); an explicit `opts.model` / env pin is validated first and
 * refused when unknown. The provider keeps its byte-identical behavior: body
 * shape, retry schedule, timeouts, and the keyless `not-configured` envelope
 * are exactly what the pre-registry seams sent.
 */
export async function callModel(
  role: RapidToolModelRole,
  prompt: string,
  opts: CallModelOptions = {},
): Promise<LlmResult> {
  // T-107.10 (fixes/216t): an EXPLICIT provider short-circuits the role tier
  // (the caller selected it — never a fallback, never a "configured" probe
  // read). The model id is validated inside the provider's own namespace.
  if (opts.provider !== undefined) {
    const selection = resolveExplicitProvider(opts.provider, { model: opts.model });
    if (!selection.ok) {
      return { ok: false, reason: "error", error: selection.error, code: selection.code };
    }
    const { model: _explicitModel, provider: _explicitProvider, ...rest } = opts;
    // `selection.model` is an opaque, provider-scoped id on this path; the
    // descriptor owns its meaning (the mock ignores it). The cast is confined
    // to this one forwarding boundary — `DeepSeekCompleteOptions.model` is
    // deliberately NOT widened (deepseek request shapes stay untouched).
    return selection.descriptor.complete(prompt, { ...rest, model: selection.model as LlmModel });
  }
  const resolved = resolveRoleModel(role, { model: opts.model });
  if (!resolved.ok) {
    return { ok: false, reason: "error", error: resolved.error, code: resolved.code };
  }
  const provider = getProvider(resolved.provider);
  if (!provider) {
    return {
      ok: false,
      reason: "error",
      error: `provider "${resolved.provider}" is not registered`,
      code: "RT_E_INTERNAL",
    };
  }
  // Strip the caller's override: the resolved+validated id is what gets sent.
  const { model: _explicitModel, ...rest } = opts;
  return provider.complete(prompt, { ...rest, model: resolved.model });
}
