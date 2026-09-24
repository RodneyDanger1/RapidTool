// ---------------------------------------------------------------------------
// plugin.ts — T5.5: plugin / hook registry, v1 (in-process only).
//
// Why this exists: the 230 playbook's T5.5 row (Phase 5) asks for a hook
// surface a host loop can consult at declared points — phase synthesis, phase
// application, run sealing, P6 synthesis. The settled isolation outcome
// (T-107.8, Outcome 2: no isolator is available on this host) freezes the
// scope to IN-PROCESS ONLY: hooks are ordinary functions registered from the
// host's own code. This module performs no dynamic module loading, no runtime
// code synthesis, no network access and no ambient reads (no env, no clock,
// no randomness); a source-scan test pins that boundary (plugin.test.ts).
//
// v1 boundary (declared, not drifted): this lands the REGISTRY — creation,
// explicit registration, deterministic dispatch, coded containment, and the
// policy seam for state-writing hooks. Wiring the call sites (engine.ts:478
// `synthesizePhase`, engine.ts:1374 `applyPhaseResult`, engine.ts:1236
// `sealHonesty`, codegen.server.ts:2423 `liveP6Synthesis`) is the row's
// separable second half; no call site consumes a hook today.
//
// Doctrine:
//   · VERSIONED SHAPE — every hook declares `apiVersion`; registration refuses
//     anything but PLUGIN_API_VERSION. A shape change bumps the constant.
//   · EXPLICIT REGISTRATION ONLY — no discovery, no filesystem scan, no
//     auto-load (the mock-provider doctrine: selection must be deliberate).
//     Nothing is ever dispatched unless a caller registered it on purpose.
//   · DETERMINISTIC ORDER — dispatch visits hooks in REGISTRATION ORDER (the
//     order of successful `register` calls). The visit list is an append-only
//     array, so the order is a stated contract and can never drift with an
//     engine's key-iteration accident. Stated here; pinned in plugin.test.ts.
//   · CODED CONTAINMENT — a hook that throws becomes a coded `failed` outcome
//     naming the hook (`hook-failed — <id>: …`) and dispatch moves to the next
//     hook. Never a silent catch (the failure is IN the report), never a crash
//     of the host loop (dispatch is total — it does not throw). A hook that
//     returns a thenable is refused the same way: v1 dispatch is synchronous,
//     and the unattended promise is neutralized rather than left to reject
//     into the host loop.
//   · ONE POLICY SEAM — a hook marked `writesState: true` must declare a
//     routable policy claim and is evaluated by `evaluatePolicy` (policy.ts)
//     before it may run. Default-deny: with no seat presented the hook does
//     not run and the refusal is contained (naming the hook, carrying the
//     policy fallback). Registration refuses a state-writing hook without a
//     routable claim, so no registration path lets a writer bypass the seam.
//
// Run: node --experimental-strip-types --test --test-concurrency=2 src/lib/plugin.test.ts
// ---------------------------------------------------------------------------
import { classifyError, codeError, type CodedFailure, type ErrorCode } from "./errors.ts";
import {
  KNOWN_POLICY_ACTIONS,
  evaluatePolicy,
  type PolicyAction,
  type PolicyCtx,
  type PolicyFallback,
  type PolicyVerdict,
} from "./policy.ts";

/** The plugin API version this registry speaks. Bump ONLY with a shape change. */
export const PLUGIN_API_VERSION = 1 as const;

/**
 * The declared host points a hook may attach to, grounded in the seams the
 * T5.5 row names (engine.ts / codegen.server.ts). Additive: a new kind is a
 * deliberate edit, and an unknown kind is refused at dispatch (default-deny).
 */
export const HOOK_KINDS = [
  "phase.synthesized",
  "phase.applied",
  "run.sealed",
  "p6.synthesized",
] as const;

/** One declared hook kind. */
export type HookKind = (typeof HOOK_KINDS)[number];

/** The payload a dispatcher hands a hook. Treated as read-only by contract. */
export type HookPayload = Readonly<Record<string, unknown>>;

/** What every hook receives as its second argument (identity + routed verdict). */
export type HookContext = {
  /** The hook's own registered id — the name every containment failure carries. */
  readonly hookId: string;
  readonly kind: HookKind;
  readonly registryVersion: typeof PLUGIN_API_VERSION;
  /** Present iff the hook was policy-routed (state-writing hooks only). */
  readonly policy?: PolicyVerdict;
};

/** The declared shape of a registrable hook. Versioned by `apiVersion`. */
export type PluginHook = {
  /** Stable, unique id — this is the name every failure outcome carries. */
  readonly id: string;
  /** Must equal PLUGIN_API_VERSION; anything else is refused at registration. */
  readonly apiVersion: number;
  readonly kind: HookKind;
  /** true ⇒ the hook writes state ⇒ `policy` is required and dispatch routes it. */
  readonly writesState?: boolean;
  /** The one-seam claim; required exactly when (and only when) `writesState` is true. */
  readonly policy?: { readonly action: PolicyAction; readonly resource: string };
  readonly run: (payload: HookPayload, ctx: HookContext) => unknown;
};

/** A hook visit that did not complete: `failed` (threw / unsupported return) or `refused`. */
export type HookFailureOutcome = {
  readonly hookId: string;
  readonly status: "failed" | "refused";
  readonly code: ErrorCode;
  readonly error: string;
  readonly fallback?: PolicyFallback;
};

/** One hook's visit result inside a DispatchReport. */
export type HookOutcome =
  | {
      readonly hookId: string;
      readonly status: "ran";
      readonly result: unknown;
      /** Present iff the hook was policy-routed; an allow verdict. */
      readonly policy?: PolicyVerdict;
    }
  | HookFailureOutcome;

/** A dispatch is always resolved into this report — dispatch never throws. */
export type DispatchReport = {
  /** true iff every visited hook ran (an empty dispatch is ok). */
  readonly ok: boolean;
  readonly kind: string;
  /** Visits in registration order. */
  readonly outcomes: readonly HookOutcome[];
  /** Present iff !ok: the first non-ran outcome's code (or the unknown-kind refusal). */
  readonly code?: ErrorCode;
  /** Present iff !ok: names the first hook that did not run (or the unknown kind). */
  readonly error?: string;
};

/** A successful registration's receipt. */
export type RegisterResult =
  { readonly ok: true; readonly hookId: string; readonly kind: HookKind } | CodedFailure;

/** The registry surface. Everything the host loop needs — nothing ambient. */
export type PluginRegistry = {
  readonly version: typeof PLUGIN_API_VERSION;
  register(hook: PluginHook): RegisterResult;
  /** Registered ids in registration order (all kinds, or one). Unknown kind ⇒ []. */
  ids(kind?: string): readonly string[];
  dispatch(kind: string, payload?: HookPayload, policyCtx?: PolicyCtx): DispatchReport;
};

/** Bound a detail fragment so a hostile value cannot balloon a failure row. */
function clip(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Single-line a thrown detail for the report format. */
function thrownDetail(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message.replace(/\s+/g, " ").trim();
    return message.length > 0 ? message : err.name;
  }
  if (typeof err === "string") {
    const message = err.replace(/\s+/g, " ").trim();
    return message.length > 0 ? message : "empty string throw";
  }
  return `non-Error throw (${typeof err})`;
}

/** A thenable return would reject outside the containment — detect it up front. */
function isThenable(value: unknown): boolean {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
  return typeof (value as { then?: unknown }).then === "function";
}

/** Narrow a value to a declared hook kind (the runtime half of the closed union). */
function isHookKind(value: unknown): value is HookKind {
  return typeof value === "string" && (HOOK_KINDS as readonly string[]).includes(value);
}

/** Narrow a value to a declared policy action (the seam's closed vocabulary). */
function isPolicyAction(value: unknown): value is PolicyAction {
  return typeof value === "string" && (KNOWN_POLICY_ACTIONS as readonly string[]).includes(value);
}

/** Narrow a value to the hook run signature. */
function isRunFunction(value: unknown): value is PluginHook["run"] {
  return typeof value === "function";
}

/** True for any non-ran outcome (the failure rows). */
function isNotRan(outcome: HookOutcome): outcome is HookFailureOutcome {
  return outcome.status !== "ran";
}

function runHook(hook: PluginHook, payload: HookPayload, ctx: HookContext): HookOutcome {
  let result: unknown;
  try {
    result = hook.run(payload, ctx);
  } catch (err) {
    return {
      hookId: hook.id,
      status: "failed",
      code: classifyError(err, "RT_E_INTERNAL"),
      error: `hook-failed — ${hook.id}: ${clip(thrownDetail(err))}`,
    };
  }
  if (isThenable(result)) {
    // v1 dispatch is synchronous. The refusal is the coded failure; the
    // promise is settled in isolation so its rejection can never become an
    // unattended host-loop rejection.
    void Promise.resolve(result).catch(() => undefined);
    return {
      hookId: hook.id,
      status: "failed",
      code: "RT_E_VALIDATION",
      error:
        `hook-failed — ${hook.id}: returned a thenable; v1 dispatch is synchronous only ` +
        `(the promise is refused and its settlement neutralized).`,
    };
  }
  return {
    hookId: hook.id,
    status: "ran",
    result,
    ...(ctx.policy === undefined ? {} : { policy: ctx.policy }),
  };
}

/**
 * Create an empty in-process registry. State is closure-local: no globals, no
 * ambient inputs. Registrations land in append-only arrays; dispatch reads
 * them in that order.
 */
export function createPluginRegistry(): PluginRegistry {
  const hooks: PluginHook[] = [];
  const byKind = new Map<HookKind, PluginHook[]>();
  const seenIds = new Set<string>();

  function register(hook: PluginHook): RegisterResult {
    const raw: unknown = hook;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return codeError(
        "RT_E_VALIDATION",
        "invalid-hook — registration expects a hook descriptor object.",
      );
    }
    const record = raw as { [key: string]: unknown };

    const rawId = record.id;
    if (typeof rawId !== "string" || rawId.trim().length === 0) {
      return codeError(
        "RT_E_VALIDATION",
        `invalid-hook-id — ${clip(JSON.stringify(rawId) ?? "undefined", 40)} is not a usable hook id; ids are non-empty strings.`,
      );
    }
    const id = rawId;

    if (seenIds.has(id)) {
      return codeError(
        "RT_E_VALIDATION",
        `duplicate-hook-id — ${id} is already registered; the duplicate is refused and the existing hook is left untouched.`,
      );
    }

    const apiVersion = record.apiVersion;
    if (apiVersion !== PLUGIN_API_VERSION) {
      return codeError(
        "RT_E_VALIDATION",
        `unsupported-api-version — ${id} declares plugin API v${clip(String(apiVersion), 20)}; this registry speaks v${PLUGIN_API_VERSION}.`,
      );
    }

    const kind = record.kind;
    if (!isHookKind(kind)) {
      return codeError(
        "RT_E_VALIDATION",
        `unknown-hook-kind — ${id} declares kind ${clip(String(kind), 40)}; expected one of ${HOOK_KINDS.join(", ")}.`,
      );
    }

    const run = record.run;
    if (!isRunFunction(run)) {
      return codeError("RT_E_VALIDATION", `invalid-hook — ${id} has no run function to dispatch.`);
    }

    const writesState = record.writesState;
    if (writesState !== undefined && typeof writesState !== "boolean") {
      return codeError(
        "RT_E_VALIDATION",
        `invalid-hook — ${id} declares writesState ${clip(String(writesState), 20)}; expected a boolean.`,
      );
    }

    const rawPolicy = record.policy;
    let policy: { action: PolicyAction; resource: string } | undefined;
    if (rawPolicy !== undefined) {
      if (rawPolicy === null || typeof rawPolicy !== "object") {
        return codeError(
          "RT_E_VALIDATION",
          `unroutable-policy-claim — ${id}'s policy claim is not an object; a routable claim needs action + resource.`,
        );
      }
      const claim = rawPolicy as { action?: unknown; resource?: unknown };
      const action = claim.action;
      const resource = claim.resource;
      if (!isPolicyAction(action) || typeof resource !== "string" || resource.trim().length === 0) {
        return codeError(
          "RT_E_VALIDATION",
          `unroutable-policy-claim — ${id} claims ${clip(String(action), 40)} on ${clip(String(resource), 60)}; expected a known action (${KNOWN_POLICY_ACTIONS.join(", ")}) and a non-empty resource.`,
        );
      }
      policy = { action, resource };
    }

    if (writesState === true && policy === undefined) {
      return codeError(
        "RT_E_VALIDATION",
        `unroutable-policy-claim — ${id} writes state but declares no policy claim; every writer must name the claim the one policy seam evaluates.`,
      );
    }
    if (writesState !== true && policy !== undefined) {
      return codeError(
        "RT_E_VALIDATION",
        `invalid-hook — ${id} declares a policy claim without writesState: true; the claim would be inert.`,
      );
    }

    const accepted: PluginHook = {
      id,
      apiVersion: PLUGIN_API_VERSION,
      kind,
      ...(writesState === true ? { writesState: true as const } : {}),
      ...(policy === undefined ? {} : { policy }),
      run,
    };
    hooks.push(accepted);
    const forKind = byKind.get(kind);
    if (forKind === undefined) byKind.set(kind, [accepted]);
    else forKind.push(accepted);
    seenIds.add(id);
    return { ok: true, hookId: id, kind };
  }

  function ids(kind?: string): readonly string[] {
    if (kind === undefined) return hooks.map((hook) => hook.id);
    const forKind = isHookKind(kind) ? byKind.get(kind) : undefined;
    return (forKind ?? []).map((hook) => hook.id);
  }

  function dispatch(
    kind: string,
    payload: HookPayload = {},
    policyCtx?: PolicyCtx,
  ): DispatchReport {
    if (!isHookKind(kind)) {
      const named = clip(String(kind), 40);
      return {
        ok: false,
        kind: named,
        outcomes: [],
        code: "RT_E_VALIDATION",
        error: `unknown-kind — ${named} is not a declared hook kind (${HOOK_KINDS.join(", ")}); default-deny, nothing dispatched.`,
      };
    }

    const outcomes: HookOutcome[] = [];
    for (const hook of byKind.get(kind) ?? []) {
      const ctxBase = { hookId: hook.id, kind: hook.kind, registryVersion: PLUGIN_API_VERSION };
      if (hook.writesState === true) {
        const claim = hook.policy;
        if (claim === undefined) {
          // Registration refuses this shape; the branch is a fail-closed
          // invariant guard so even a corrupted registry cannot write.
          outcomes.push({
            hookId: hook.id,
            status: "refused",
            code: "RT_E_VALIDATION",
            error: `hook-refused — ${hook.id}: state-writing hook without a policy claim (registry invariant breach); default-deny.`,
          });
          continue;
        }
        const verdict = evaluatePolicy(claim.action, claim.resource, policyCtx);
        if (verdict.decision === "deny") {
          outcomes.push({
            hookId: hook.id,
            status: "refused",
            code: "RT_E_PERMISSION_DENIED",
            error: `hook-refused — ${hook.id}: ${verdict.reason}`,
            fallback: verdict.fallback,
          });
          continue;
        }
        outcomes.push(runHook(hook, payload, { ...ctxBase, policy: verdict }));
        continue;
      }
      outcomes.push(runHook(hook, payload, ctxBase));
    }

    const failed = outcomes.filter(isNotRan);
    const first = failed[0];
    if (first === undefined) return { ok: true, kind, outcomes };
    return {
      ok: false,
      kind,
      outcomes,
      code: first.code,
      error: `${failed.length} of ${outcomes.length} hook(s) did not run for ${kind}; first — ${first.error}`,
    };
  }

  return { version: PLUGIN_API_VERSION, register, ids, dispatch };
}
