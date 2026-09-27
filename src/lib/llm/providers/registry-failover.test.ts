/**
 * R13-f09 (W31 · T3) — `RAPIDTOOL_FALLBACK_PROVIDERS` pins.
 *
 * The failover chain RESOLVES purely (parse + validate, nothing invoked), a
 * CONFIGURED chain REFUSES at `callModel` while unarmed (never a silent
 * no-op), an INVALID chain refuses with a coded error naming the registered
 * ids, and the unset default keeps the single-provider keyless floor
 * byte-identical. No network: the refusal happens before any dispatch, and
 * the injected fetch spy proves zero calls leave.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { callModel, FALLBACK_PROVIDERS_ENV_VAR, resolveFallbackChain } from "./registry.ts";

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

describe("R13-f09 — RAPIDTOOL_FALLBACK_PROVIDERS resolves purely", () => {
  it("unset / blank ⇒ the empty chain (ok), no refusal", () => {
    const a = resolveFallbackChain({});
    assert.deepEqual(a, { ok: true, ids: [] });
    const b = resolveFallbackChain({ [FALLBACK_PROVIDERS_ENV_VAR]: "   " });
    assert.deepEqual(b, { ok: true, ids: [] });
    const c = resolveFallbackChain({ [FALLBACK_PROVIDERS_ENV_VAR]: ", ," });
    assert.deepEqual(c, { ok: true, ids: [] });
  });

  it("registered ids resolve in order (whitespace tolerated)", () => {
    const r = resolveFallbackChain({ [FALLBACK_PROVIDERS_ENV_VAR]: " xai , deepseek " });
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.ids, ["xai", "deepseek"]);
  });

  it("an unknown id (incl. the explicit-only mock) is a coded refusal naming the registered ids", () => {
    for (const bad of ["nope", "mock"]) {
      const r = resolveFallbackChain({ [FALLBACK_PROVIDERS_ENV_VAR]: bad });
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.equal(r.code, "RT_E_VALIDATION");
        assert.match(r.error, /not a registered provider/);
        assert.match(r.error, /deepseek/);
        assert.match(r.error, /xai/);
      }
    }
  });

  it("a duplicate entry is a coded refusal — never silently de-duped", () => {
    const r = resolveFallbackChain({ [FALLBACK_PROVIDERS_ENV_VAR]: "xai,xai" });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, "RT_E_VALIDATION");
      assert.match(r.error, /appears twice/);
    }
  });
});

describe("R13-f09 — callModel consults the chain before any dispatch", () => {
  it("unset chain ⇒ the keyless floor is byte-identical (RT_E_LLM_NOT_CONFIGURED)", async () => {
    const restore = withCleanLlmEnv();
    try {
      const res = await callModel("main", "hello");
      assert.equal(res.ok, false);
      if (!res.ok) assert.equal(res.code, "RT_E_LLM_NOT_CONFIGURED");
    } finally {
      restore();
    }
  });

  it("configured-but-unarmed chain ⇒ coded refusal BEFORE the wire, zero fetch calls", async () => {
    const restore = withCleanLlmEnv({ [FALLBACK_PROVIDERS_ENV_VAR]: "xai" });
    const calls: number[] = [];
    try {
      const res = await callModel("main", "hello", {
        fetch: (async () => {
          calls.push(1);
          throw new Error("network must not be reached — the chain refuses pre-dispatch");
        }) as unknown as typeof fetch,
      });
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "RT_E_VALIDATION");
        assert.equal(res.reason, "error");
        assert.match(res.error ?? "", /NOT ARMED/);
        assert.match(res.error ?? "", /RAPIDTOOL_FALLBACK_PROVIDERS/);
      }
      assert.equal(calls.length, 0, "no request may leave while the chain is unarmed");
    } finally {
      restore();
    }
  });

  it("invalid chain ⇒ the same coded refusal shape (registry ids named)", async () => {
    const restore = withCleanLlmEnv({ [FALLBACK_PROVIDERS_ENV_VAR]: "not-a-provider" });
    try {
      const res = await callModel("main", "hello");
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "RT_E_VALIDATION");
        assert.match(res.error ?? "", /not a registered provider/);
      }
    } finally {
      restore();
    }
  });
});
