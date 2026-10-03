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
 * OV-1 (W23 · L4, fixes/262) landed multi-provider ENV SELECTION: the
 * `RAPIDTOOL_PROVIDER` deployment choice now resolves through the registry's
 * own `PROVIDERS` descriptors (`resolveEnvProvider` / `resolveEnvSelectedRoute`
 * below; unknown id ⇒ coded RT_E_VALIDATION refusal, never a silent default;
 * unset ⇒ source:"default" ⇒ the byte-identical deepseek path), and the doctor
 * surfaces the resolved provider/model honestly (doctor.ts `envSelection` —
 * "cloud-by-default, keyless floor"). The failover CHAIN now resolves
 * (`RAPIDTOOL_FALLBACK_PROVIDERS`, the R13-f09 block below) but stays
 * deliberately UNARMED — and the bytes cannot honestly arm it: the only
 * non-DeepSeek family (`xai`) is a CANDIDATE with an empty `requestModelIds`,
 * `applyProbedModels` only MINTS a verified descriptor without REGISTERING it
 * into `PROVIDERS`, and every role tier already routes to `deepseek`, so a
 * router would be a no-op or a same-family retry (`failoverArmingGap` names
 * this at the call site). Cross-family ROUTING + autodetect (101 §4) remain
 * deferred; per-call telemetry LANDED as the provider call tap
 * (`./deepseek.ts` `setLlmCallTap`, W23-L1 fixes/262). (F2 · W19-L5, fixes/252,
 * landed the PROBE half beside the providers — `./probe.ts` — and registers
 * the probed `xai` candidate; with OV-1 landed, a verified family becomes
 * env-selectable once a probe has read its ids back.)
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
 *
 * F2 · W19-L5 (fixes/252) added the SECOND provider family, additively:
 * `./openai-compatible.ts` registers ONE OpenAI-compatible family (`xai`) whose
 * id and endpoints came from a LIVE probe (raw evidence in that module's
 * header), and `LlmProviderDescriptor` gained the optional `verification`
 * marker. The family registers as a CANDIDATE with an EMPTY `requestModelIds`
 * — resolving it as an explicit provider refuses (`RT_E_VALIDATION`) until a
 * probe read model ids back and `applyProbedModels` minted a verified
 * descriptor from exactly those ids (221 F2 rule 3). NOTHING else moves:
 * `KNOWN_MODEL_IDS` stays DeepSeek-scoped, `ROLE_TIERS` still routes every
 * role to DeepSeek (byte-identical), and a provider with no probed ids can
 * never be silently defaulted to.
 */

import {
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODELS,
  completeDeepSeek,
  isDeepSeekConfigured,
} from "./deepseek.ts";
import type { DeepSeekCompleteOptions, DeepSeekMessage } from "./deepseek.ts";
import { XAI_PROVIDER } from "./openai-compatible.ts";
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
 *  deliberately absent from `PROVIDERS`/`ROLE_TIERS`/`KNOWN_MODEL_IDS`.
 *  `xai` (F2 · W19-L5, fixes/252) is the probed second family from
 *  `./openai-compatible.ts` — registered as a CANDIDATE (empty request ids;
 *  nothing requestable until a probe read ids back). */
export type LlmProviderId = "deepseek" | "mock" | "xai";

/** Request-path model ids whose acceptance is live-verified for the DeepSeek
 *  API (2026-09-16, two keys — see `./deepseek.ts` header). `deepseek-flash`
 *  is the id the vendor SERVES for the alias `deepseek-v4-flash`; we keep
 *  requesting the alias (byte-identical to the pre-registry code) and read the
 *  served id back from every response.
 *  OV-37 (W17 · L3): if that alias ever dies, the provider's refusal names the
 *  requested id and the refresh procedure for these ids lives beside
 *  `DEEPSEEK_MODELS` in `./deepseek.ts`. */
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
  /** OPTIONAL and additive (F2 · W19-L5, fixes/252): how this provider's model
   *  ids were verified. Absent ⇒ nothing changes (behaviour byte-identical).
   *  `live-probe` names the vendor endpoint a probe reads ids back from
   *  (`./probe.ts`); `static` records that the ids were verified by other live
   *  evidence (DeepSeek's header). A `live-probe` family whose ids no probe has
   *  read back yet stays a CANDIDATE: empty `requestModelIds`, dispatch refused,
   *  never defaulted to. */
  readonly verification?:
    | { readonly kind: "live-probe"; readonly modelsEndpoint: string }
    | { readonly kind: "static"; readonly note: string };
  readonly isConfigured: () => boolean;
  readonly complete: (
    prompt: string,
    opts: DeepSeekCompleteOptions,
  ) => Promise<LlmResult>;
};

/** The registered providers, in preference order. TWO today — the array shape
 *  is the multi-provider extension point (101 §4.5). DeepSeek first (the only
 *  role-routed family; `ROLE_TIERS` below is unchanged); `xai` second as the
 *  probed CANDIDATE, `verification` naming the endpoint a probe reads ids back
 *  from. Adding an entry here is visible, additive and never re-routes a role. */
export const PROVIDERS: readonly LlmProviderDescriptor[] = Object.freeze([
  {
    id: "deepseek",
    label: "DeepSeek",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    modelEnvPrefix: "DEEPSEEK",
    defaultBaseUrl: DEEPSEEK_BASE_URL,
    requestModelIds: DEEPSEEK_REQUEST_MODEL_IDS,
    verification: {
      kind: "static",
      note:
        "request-path ids live-verified 2026-09-16 against https://api.deepseek.com/models (two keys) — " +
        "served deepseek-flash for alias deepseek-v4-flash, plus deepseek-v4-pro; refresh path in ./deepseek.ts header",
    },
    isConfigured: isDeepSeekConfigured,
    complete: completeDeepSeek,
  },
  XAI_PROVIDER,
]);

/** Look a provider up by id. Unknown id ⇒ `undefined` (never a silent fallback;
 *  `callModel` converts a missing tier provider into a coded refusal). */
export function getProvider(id: string): LlmProviderDescriptor | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// OV-1 (W23 · L4, fixes/262) — `RAPIDTOOL_PROVIDER` env selection
// ---------------------------------------------------------------------------

/** The ONE env var that selects a deployment provider (101_provider_integration
 *  §4.4 — precedence rung 2). Unset ⇒ rung 4: `DEFAULT_PROVIDER_ID`. */
export const PROVIDER_ENV_VAR = "RAPIDTOOL_PROVIDER";

/** Rung 4 of the spec's precedence (101 §4.4): unset env ⇒ deepseek — exactly
 *  today's byte-identical role-routed behavior. */
export const DEFAULT_PROVIDER_ID: LlmProviderId = "deepseek";

/**
 * Result of resolving `RAPIDTOOL_PROVIDER` against the registry's OWN
 * descriptor list. `requested` is the raw env value (null when unset/blank);
 * `source` says which precedence rung fired. An unknown id is a coded
 * `RT_E_VALIDATION` refusal — never a silent fallback to the default provider
 * (the header's refusal-not-substitution doctrine; the OV-1 playbook's
 * explicit trap: "A silent fallback to DeepSeek when `RAPIDTOOL_PROVIDER`
 * names something unknown is exactly the lie the header forbids — refuse,
 * don't default.").
 */
export type EnvProviderSelection =
  | {
      ok: true;
      provider: LlmProviderDescriptor;
      /** Trimmed env value, or null when unset/blank (the default rung). */
      requested: string | null;
      source: "env" | "default";
    }
  | { ok: false; code: ErrorCode; error: string };

/**
 * Resolve the env-selected provider (OV-1 step 1 · W23-L4). Pure: `PROVIDERS`
 * is the only source of truth — `mock` is absent from it, so it can never be
 * selected by env (it stays explicit-only, T-107.10). Unset/blank ⇒ the
 * default rung (byte-identical behavior); unknown ⇒ a refusal naming the
 * registered ids.
 */
export function resolveEnvProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): EnvProviderSelection {
  const raw = env?.[PROVIDER_ENV_VAR];
  if (typeof raw !== "string" || !raw.trim()) {
    const provider = getProvider(DEFAULT_PROVIDER_ID) ?? PROVIDERS[0];
    if (!provider) {
      return {
        ok: false,
        code: "RT_E_INTERNAL",
        error: "provider registry is empty — no provider can serve the default role route",
      };
    }
    return { ok: true, provider, requested: null, source: "default" };
  }
  const requested = raw.trim();
  const provider = getProvider(requested);
  if (!provider) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error:
        `${PROVIDER_ENV_VAR}="${requested}" is not a registered provider — known: ` +
        `${PROVIDERS.map((p) => p.id).join(", ")}. Refusing rather than silently ` +
        `defaulting to "${DEFAULT_PROVIDER_ID}".`,
    };
  }
  return { ok: true, provider, requested, source: "env" };
}

// ---------------------------------------------------------------------------
// R13-f09 (W31 · T3) — `RAPIDTOOL_FALLBACK_PROVIDERS`: the failover chain,
// RESOLVED but deliberately NOT ARMED
// ---------------------------------------------------------------------------

/** The ONE env var naming the failover chain: comma-separated provider ids,
 *  tried in order after the primary. Today the chain is RESOLVED (pure,
 *  testable, visible to `doctor`/tests) but NOT ARMED — see
 *  `failoverArmingGap` for the byte-derived reason. A configured chain is
 *  refused LOUDLY at the call site — never silently ignored, never a fake
 *  catch — so no caller can believe failover is on when it isn't. Unset (the
 *  default) ⇒ the single-provider path is byte-identical. */
export const FALLBACK_PROVIDERS_ENV_VAR = "RAPIDTOOL_FALLBACK_PROVIDERS";

/**
 * R13-f09 (342-5) — WHY the resolved chain still cannot be armed, derived from
 * the registry's own descriptors (never asserted). A router can only fail over
 * to a chain entry that is BOTH dispatchable (≥1 verified request id, else
 * `complete` refuses on the candidate rule) AND a different family than the
 * primary. Neither holds today:
 *   - `xai` is the only non-DeepSeek member and is a CANDIDATE with
 *     `requestModelIds: []`; `probeProviderModels` → `applyProbedModels` only
 *     MINTS a verified descriptor — NO seam REGISTERS it back into `PROVIDERS`,
 *     so `resolveFallbackChain` can never see a verified second family;
 *   - `deepseek` is dispatchable but is the family every role tier already
 *     routes to — a same-family retry, not failover.
 * Arming a router over this registry would therefore be a no-op or a
 * mislabeled retry — an over-claim. Exact missing pieces: (1) a probe-verified
 * second-family descriptor REGISTERED in `PROVIDERS` (nothing registers one
 * today); (2) the transient-class per-call router + served-provider provenance
 * (TODO(R13-f09) at `callModel`) — provenance has NO field on `LlmResult`
 * (`src/lib/llm.ts`, outside this module), so arming also needs that type
 * widened; (3) the owner's keyed evidence wave.
 */
function failoverArmingGap(ids: readonly LlmProviderId[], primaryId: string): string {
  return ids
    .map((id) => {
      const provider = getProvider(id);
      if (!provider) return `"${id}" is not registered`;
      const verified = provider.requestModelIds.length;
      if (verified === 0) {
        return `"${id}" is a CANDIDATE with 0 verified request ids (probeProviderModels → applyProbedModels MINTS a descriptor but no seam REGISTERS it in PROVIDERS)`;
      }
      if (provider.id === primaryId) {
        return `"${id}" declares ${verified} verified request id(s) but is the SAME family the primary routes to — a same-family retry, not failover`;
      }
      return `"${id}" declares ${verified} verified request id(s) but no per-call router/provenance exists yet`;
    })
    .join("; ");
}

/** Parse + validate `RAPIDTOOL_FALLBACK_PROVIDERS`. Pure: no I/O. Unset/blank
 *  ⇒ the empty chain (`ok`). Unknown id or a duplicate entry ⇒ a coded
 *  `RT_E_VALIDATION` refusal naming the registered ids — explicit, never
 *  silently dropped. (`mock` stays absent from `PROVIDERS`, so it can never be
 *  chained either — the explicit-only rule of T-107.10.) */
export function resolveFallbackChain(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): { ok: true; ids: LlmProviderId[] } | { ok: false; code: ErrorCode; error: string } {
  const raw = env?.[FALLBACK_PROVIDERS_ENV_VAR];
  if (typeof raw !== "string" || !raw.trim()) return { ok: true, ids: [] };
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const known = PROVIDERS.map((p) => p.id);
  const ids: LlmProviderId[] = [];
  for (const id of parts) {
    const provider = getProvider(id);
    if (!provider) {
      return {
        ok: false,
        code: "RT_E_VALIDATION",
        error:
          `${FALLBACK_PROVIDERS_ENV_VAR}: "${id}" is not a registered provider — known: ` +
          `${known.join(", ")}. Refusing rather than silently skipping it.`,
      };
    }
    if (ids.includes(provider.id)) {
      return {
        ok: false,
        code: "RT_E_VALIDATION",
        error:
          `${FALLBACK_PROVIDERS_ENV_VAR}: provider "${provider.id}" appears twice — the chain ` +
          `is an ordered list of DISTINCT candidates. Refusing rather than silently de-duping it.`,
      };
    }
    ids.push(provider.id);
  }
  return { ok: true, ids };
}

/** Successful env-selected route: the provider descriptor + the model id the
 *  registry would SEND for the role, plus which rung selected the provider. */
export type EnvSelectedRoute =
  | { ok: true; provider: LlmProviderDescriptor; model: string; source: "env" | "default" }
  | { ok: false; code: ErrorCode; error: string };

/**
 * Resolve role → provider+model under the env selection — the ONE place the
 * `RAPIDTOOL_PROVIDER` route branch lives (the doctor's surfacing and
 * `callModel`'s dispatch both read THIS, so the reported route can never
 * drift from the dispatched one).
 *
 *   - default rung / env-selected provider === the role tier's provider ⇒ the
 *     role-tier path (`resolveRoleModel`) — byte-identical to today;
 *   - env-selected OTHER provider ⇒ model resolution is PROVIDER-SCOPED:
 *     explicit model → `<PREFIX>_MODEL_<ROLE>` pin → the descriptor's own
 *     first request id (the same no-model rule `resolveExplicitProvider` uses),
 *     every form validated against THAT provider's `requestModelIds` (ids are
 *     provider-scoped — `KNOWN_MODEL_IDS` stays DeepSeek-only). An empty
 *     namespace (a candidate that no probe has read ids back for yet) is a
 *     coded `RT_E_VALIDATION` refusal naming the probe path — never a
 *     defaulted/substituted id.
 * Pure: no I/O; `env` is a parameter.
 */
export function resolveEnvSelectedRoute(
  role: RapidToolModelRole,
  opts: { model?: unknown; env?: NodeJS.ProcessEnv } = {},
): EnvSelectedRoute {
  const env = opts.env ?? process.env;
  const selection = resolveEnvProvider(env);
  if (!selection.ok) return selection;
  if (!isModelRole(role)) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `unknown model role "${String(role)}" — known roles: ${RAPIDTOOL_MODEL_ROLES.join(", ")}`,
    };
  }
  const tier = ROLE_TIERS[role];
  if (selection.source === "default" || selection.provider.id === tier.provider) {
    const resolved = resolveRoleModel(role, { model: opts.model, env });
    return resolved.ok
      ? { ok: true, provider: selection.provider, model: resolved.model, source: selection.source }
      : resolved;
  }
  const provider = selection.provider;
  const bad = (error: string): EnvSelectedRoute => ({ ok: false, code: "RT_E_VALIDATION", error });
  const ids = provider.requestModelIds.filter(
    (m): m is string => typeof m === "string" && m.trim().length > 0,
  );
  if (ids.length === 0) {
    const how =
      provider.verification?.kind === "live-probe"
        ? `a probe must read model ids back from ${provider.verification.modelsEndpoint} and applyProbedModels must mint a verified descriptor`
        : "no verified request ids are registered for it";
    return bad(
      `${PROVIDER_ENV_VAR} selects provider "${provider.id}" but it declares no request model ids — ${how}. ` +
        `Refusing role "${role}" rather than defaulting to "${DEFAULT_PROVIDER_ID}" or substituting an id.`,
    );
  }
  const explicit = opts.model;
  if (explicit !== undefined) {
    if (typeof explicit !== "string" || explicit.trim() === "") {
      return bad(
        `${PROVIDER_ENV_VAR}=${provider.id}: an explicit model id must be a non-empty string — got ${JSON.stringify(explicit)}. Refusing rather than silently defaulting.`,
      );
    }
    const wanted = explicit.trim();
    if (!ids.includes(wanted)) {
      return bad(
        `${PROVIDER_ENV_VAR}=${provider.id}: model "${wanted}" is not in that provider's request ids (${ids.join(", ")}) — ids are provider-scoped; refusing rather than substituting.`,
      );
    }
    return { ok: true, provider, model: wanted, source: selection.source };
  }
  const pinKey = `${provider.modelEnvPrefix}_MODEL_${role.toUpperCase()}`;
  const pinned = env?.[pinKey]?.trim();
  if (pinned) {
    if (!ids.includes(pinned)) {
      return bad(
        `${PROVIDER_ENV_VAR}=${provider.id}: ${pinKey}="${pinned}" is not in that provider's request ids (${ids.join(", ")}) — refusing rather than substituting.`,
      );
    }
    return { ok: true, provider, model: pinned, source: selection.source };
  }
  return { ok: true, provider, model: ids[0]!, source: selection.source };
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

/** Every model id the registry may send (the explicit-model rule's universe).
 *  F2 · W19-L5 (fixes/252): this stays DeepSeek-scoped BY DESIGN (221 F2 rule
 *  6) — a second family's ids live in that provider's OWN `requestModelIds`
 *  namespace (`resolveExplicitProvider` validates against them there), so no
 *  other family's id can ever masquerade as a globally-known id. */
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
  // OV-1 (W23 · L4, fixes/262): the `RAPIDTOOL_PROVIDER` env selection
  // (precedence rung 2, 101 §4.4) — precedence rung 1 above keeps winning.
  // Unset ⇒ source:"default" ⇒ everything below is byte-identical to the
  // pre-OV-1 dispatch. An unknown id (or a candidate provider no probe has
  // read ids back for yet) is a coded refusal BEFORE any network I/O —
  // never a silent deepseek fallback.
  const envSelection = resolveEnvProvider(process.env);
  if (!envSelection.ok) {
    return { ok: false, reason: "error", error: envSelection.error, code: envSelection.code };
  }
  // R13-f09 (W31 · T3): the failover chain is resolved BEFORE any dispatch and
  // refused while it remains unarmed — a configured chain must never be a
  // silent no-op (that lie would outlive this wave). Unset ⇒ empty chain ⇒
  // everything below is exactly the pre-R13-f09 path.
  const fallbackChain = resolveFallbackChain(process.env);
  if (!fallbackChain.ok) {
    return { ok: false, reason: "error", error: fallbackChain.error, code: fallbackChain.code };
  }
  if (fallbackChain.ids.length > 0) {
    // R13-f09 (342-5): the chain stays UNARMED. The refusal is DERIVED from the
    // registry's own descriptors (`failoverArmingGap`) so it names the exact
    // missing piece instead of a generic promise. TODO(R13-f09) stays open until
    // a probe-verified second-family descriptor is REGISTERED in `PROVIDERS`
    // (not merely minted by `applyProbedModels`) and a transient-class router +
    // served-provider provenance are written.
    const primaryId =
      isModelRole(role) &&
      (envSelection.source !== "env" || ROLE_TIERS[role].provider === envSelection.provider.id)
        ? ROLE_TIERS[role].provider
        : envSelection.provider.id;
    return {
      ok: false,
      reason: "error",
      error:
        `${FALLBACK_PROVIDERS_ENV_VAR}="${fallbackChain.ids.join(",")}": the failover chain is ` +
        `specified but NOT ARMED — ${failoverArmingGap(fallbackChain.ids, primaryId)}. ` +
        `Exact missing pieces: (1) a probe-verified second-family descriptor REGISTERED in PROVIDERS, ` +
        `(2) a transient-class per-call router + served-provider provenance (TODO(R13-f09) in ` +
        `callModel), (3) the owner's keyed evidence wave. Unset ${FALLBACK_PROVIDERS_ENV_VAR} to use ` +
        `the single-provider path — this refusal exists so no caller can believe failover is on.`,
      code: "RT_E_VALIDATION",
    };
  }
  if (
    envSelection.source === "env" &&
    isModelRole(role) &&
    ROLE_TIERS[role].provider !== envSelection.provider.id
  ) {
    const route = resolveEnvSelectedRoute(role, { model: opts.model });
    if (!route.ok) {
      return { ok: false, reason: "error", error: route.error, code: route.code };
    }
    const { model: _envModel, provider: _envProvider, ...rest } = opts;
    // Same opaque-id boundary as the explicit path above: the id was validated
    // against the SELECTED provider's own request namespace; the cast is
    // confined to this one forwarding site.
    return route.provider.complete(prompt, { ...rest, model: route.model as LlmModel });
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
