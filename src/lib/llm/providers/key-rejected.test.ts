import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { completeDeepSeek } from "./deepseek.ts";
import { completeOpenAiCompatible, createOpenAiCompatibleProvider, XAI_SPEC } from "./openai-compatible.ts";
import { KEY_REJECTED_CODE, setActiveKeySource } from "./key-resolution.ts";

const KEY = "DEEPSEEK_API_KEY";
const ENV_PATH = "C:\\repo\\.env";
const FUNDED = "sk-ffffffffffffffffffffffffffffff19b3";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const authFail = () =>
  jsonResponse({ error: { message: "Authentication Fails, Your api key: ****19b3 is invalid" } }, 401);

beforeEach(() => {
  process.env[KEY] = FUNDED;
  setActiveKeySource(null);
});
afterEach(() => {
  delete process.env[KEY];
  delete process.env.XAI_API_KEY;
  setActiveKeySource(null);
});

describe("W45 331-1 F3 — a rejected credential maps to its own code", () => {
  it("a 401 returns RT_E_LLM_KEY_REJECTED, names the source + tail, never the full key", async () => {
    setActiveKeySource({ kind: "repo-env-file", path: ENV_PATH, tail: "19b3", value: FUNDED });
    const res = await completeDeepSeek("hi", { fetch: (async () => authFail()) as typeof fetch });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.code, KEY_REJECTED_CODE);
      assert.equal(res.code, "RT_E_LLM_KEY_REJECTED");
      assert.match(res.error ?? "", /401|invalid/i);
      assert.match(res.error ?? "", /key source/);
      assert.ok((res.error ?? "").includes(ENV_PATH), "the rejection must name the .env path");
      assert.match(res.error ?? "", /19b3/);
      assert.ok(!(res.error ?? "").includes(FUNDED), "the full key must never ride the message");
    }
  });

  it("without installed provenance the source note defaults to the process environment (tail-only)", async () => {
    const res = await completeDeepSeek("hi", { fetch: (async () => authFail()) as typeof fetch });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.code, "RT_E_LLM_KEY_REJECTED");
      assert.match(res.error ?? "", /process environment/);
      assert.match(res.error ?? "", /19b3/);
      assert.ok(!(res.error ?? "").includes(FUNDED));
    }
  });

  it("keeps 402 on RT_E_LLM_NO_BALANCE and a generic 400 on RT_E_LLM_REJECTED", async () => {
    const balance = await completeDeepSeek("hi", {
      fetch: (async () =>
        jsonResponse({ error: { message: "Insufficient Balance" } }, 402)) as typeof fetch,
    });
    assert.equal(balance.ok, false);
    if (!balance.ok) assert.equal(balance.code, "RT_E_LLM_NO_BALANCE");

    const bad = await completeDeepSeek("hi", {
      fetch: (async () =>
        jsonResponse({ error: { message: "Model Not Exist" } }, 400)) as typeof fetch,
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.code, "RT_E_LLM_REJECTED");
  });

  it("the OpenAI-compatible family maps 401 to the same credential class", async () => {
    process.env.XAI_API_KEY = "xai-ffffffffffffffffffffffffffff19b3";
    const res = await completeOpenAiCompatible(XAI_SPEC, ["grok-4"], "hi", {
      // The id is opaque/provider-scoped at this boundary (the adapter requests
      // exactly the ids a probe read back); the DeepSeek-typed option union does
      // not name it, so the cast pins the wire call to a verified xAI id.
      model: "grok-4" as never,
      fetch: (async () => authFail()) as typeof fetch,
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.code, "RT_E_LLM_KEY_REJECTED");
      assert.match(res.error ?? "", /key source/);
      assert.match(res.error ?? "", /19b3/);
    }
  });

  it("R4-f01 parity: a wallet phrase on a NON-402 status maps to NO_BALANCE on BOTH families", async () => {
    // The G3 (fixes/285) classifier is ONE regex — deepseek.ts
    // `isInsufficientFundsText`. A gateway can ride the wallet phrase on any
    // status, so both adapters must classify `insufficient_funds`/`quota` as
    // the wallet class, not a generic refusal. 400/403 are terminal (one call).
    for (const phrase of ["insufficient_funds", "insufficient quota"]) {
      const ds = await completeDeepSeek("hi", {
        fetch: (async () => jsonResponse({ error: { message: phrase } }, 400)) as typeof fetch,
      });
      assert.equal(ds.ok, false);
      if (!ds.ok) assert.equal(ds.code, "RT_E_LLM_NO_BALANCE", `deepseek must classify "${phrase}"`);
    }
    process.env.XAI_API_KEY = "xai-ffffffffffffffffffffffffffff19b3";
    const provider = createOpenAiCompatibleProvider(XAI_SPEC, ["probe-model-id"]);
    for (const phrase of ["insufficient_funds", "insufficient quota"]) {
      const xai = await provider.complete("hi", {
        model: "probe-model-id" as never,
        fetch: (async () => jsonResponse({ error: { message: phrase } }, 400)) as typeof fetch,
      });
      assert.equal(xai.ok, false);
      if (!xai.ok) assert.equal(xai.code, "RT_E_LLM_NO_BALANCE", `xai must classify "${phrase}"`);
    }
    // Negative control: a non-wallet "insufficient" phrase (permissions) is
    // NOT the wallet class — the shared regex stays narrow.
    const neg = await provider.complete("hi", {
      model: "probe-model-id" as never,
      fetch: (async () => jsonResponse({ error: { message: "insufficient permissions" } }, 403)) as typeof fetch,
    });
    assert.equal(neg.ok, false);
    if (!neg.ok) assert.equal(neg.code, "RT_E_LLM_REJECTED");
  });
});
