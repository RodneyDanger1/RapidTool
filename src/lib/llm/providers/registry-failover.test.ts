/**
 * fixes/346 A2-F2 — the un-armed failover shell is DELETED, and these pins keep
 * it deleted.
 *
 * R13-f09 (W31 · T3) once exported `FALLBACK_PROVIDERS_ENV_VAR` +
 * `resolveFallbackChain` and made `callModel` refuse any configured
 * `RAPIDTOOL_FALLBACK_PROVIDERS`. That switch could only ever refuse (the only
 * non-DeepSeek family is an unprobed CANDIDATE; nothing registers a probed
 * descriptor; `LlmResult` carries no provenance), so it implied a resilience it
 * did not have. This suite asserts the honest post-deletion contract instead:
 * no chain resolver is exported, the env var is INERT (identical dispatch to
 * unset), and every role still routes to the single dispatchable family. No
 * network — the keyless floor is hit before any dispatch.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as registry from "./registry.ts";
import { callModel, getProvider, RAPIDTOOL_MODEL_ROLES, ROLE_TIERS } from "./registry.ts";

function withEnv(vars: Record<string, string | undefined>): () => void {
  const saved = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(vars)) {
    saved.set(k, process.env[k]);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return () => {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}

/** The env the keyless floor needs: no provider keys at all. */
function withCleanLlmEnv(extra: Record<string, string | undefined> = {}): () => void {
  return withEnv({
    DEEPSEEK_API_KEY: undefined,
    RAPIDTOOL_PROVIDER: undefined,
    ...extra,
  });
}

const LEGACY_SWITCH = "RAPIDTOOL_FALLBACK_PROVIDERS";

describe("fixes/346 A2-F2 — no un-armed failover switch is exported", () => {
  it("the module exports neither the switch name nor a chain resolver", () => {
    assert.equal(
      "FALLBACK_PROVIDERS_ENV_VAR" in registry,
      false,
      "the dead env-var export must be gone — a switch that only refuses implies resilience",
    );
    assert.equal(
      "resolveFallbackChain" in registry,
      false,
      "there is no chain resolver to consult; failover is not implemented",
    );
  });
});

describe("fixes/346 A2-F2 — the legacy env var is inert", () => {
  it("a configured RAPIDTOOL_FALLBACK_PROVIDERS does not change dispatch (keyless floor, not a refusal)", async () => {
    const unset = withCleanLlmEnv();
    let baseline: Awaited<ReturnType<typeof callModel>>;
    try {
      baseline = await callModel("main", "hello");
    } finally {
      unset();
    }
    assert.equal(baseline.ok, false);
    if (!baseline.ok) assert.equal(baseline.code, "RT_E_LLM_NOT_CONFIGURED");

    const restore = withCleanLlmEnv({ [LEGACY_SWITCH]: "xai,deepseek" });
    try {
      const res = await callModel("main", "hello");
      assert.deepEqual(res, baseline, "a deleted switch is not consulted — dispatch is single-provider");
    } finally {
      restore();
    }
  });
});

describe("fixes/346 A2-F2 — the registry stays honestly single-provider", () => {
  it("xai remains an unprobed CANDIDATE and every role tiers to deepseek", () => {
    const xai = getProvider("xai");
    assert.ok(xai, "the probed family is still registered (for the env-selectable path)");
    assert.deepEqual([...xai!.requestModelIds], [], "a candidate never carries an unprobed id");
    for (const role of RAPIDTOOL_MODEL_ROLES) {
      assert.equal(ROLE_TIERS[role].provider, "deepseek", `${role} routes to the only dispatchable family`);
    }
  });
});
