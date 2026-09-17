/**
 * registry.test.ts — T-107.2 provider registry + role tiers (fixes/216p, W6 · L3).
 *
 * Pins the three contracts W5 landed with ZERO tests:
 *   1. provider LOOKUP — a known id returns its descriptor; an unknown id returns
 *      `undefined` and NEVER a silent fallback (the whole point of the rule);
 *   2. ROLE RESOLUTION — the `main` / `reasoning` / `weak` tiers, the env pin
 *      keys (`DEEPSEEK_MODEL_<ROLE>`), and the precedence
 *      call-site model > env pin > tier;
 *   3. the EXPLICIT-MODEL RULE — a call-site id or env pin that is not in
 *      `KNOWN_MODEL_IDS` is REFUSED with `RT_E_VALIDATION` BEFORE any network
 *      I/O; it is never silently replaced by a default.
 *
 * Every `callModel` test injects its `fetch` through the documented seam
 * (fixes/152) — no global stub, no network, no real key.
 *
 * Run: node --experimental-strip-types --test src/lib/llm/providers/registry.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  KNOWN_MODEL_IDS,
  PROVIDERS,
  RAPIDTOOL_MODEL_ROLES,
  ROLE_TIERS,
  callModel,
  getProvider,
  isKnownModelId,
  isModelRole,
  resolveRoleModel,
  roleModelEnvKey,
} from "./registry.ts";
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODELS } from "./deepseek.ts";

// ---------------------------------------------------------------------------
// Helpers — a capture fetch + env pins with honest restore
// ---------------------------------------------------------------------------

type Captured = { url: string; init: RequestInit | undefined };

/** A real `Response` carrying one chat completion (the provider reads .text()). */
function chatResponse(text: string, model = DEEPSEEK_MODELS.flash): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: text } }],
      model,
      usage: { prompt_tokens: 3, completion_tokens: 3 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function capturingFetch(calls: Captured[]): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return chatResponse("ok");
  }) as typeof fetch;
}

const KEY = "DEEPSEEK_API_KEY";
const PIN_KEYS = ["DEEPSEEK_MODEL_MAIN", "DEEPSEEK_MODEL_REASONING", "DEEPSEEK_MODEL_WEAK"];

/** Set (or delete, via `undefined`) env vars for one test; returns the restorer. */
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

/** Clear the key + every role pin for one test; returns the restorer. */
function withCleanLlmEnv(vars: Record<string, string> = {}): () => void {
  const cleared: Record<string, undefined> = {};
  for (const k of [KEY, ...PIN_KEYS]) cleared[k] = undefined;
  // Compose two restorers; reverse order: applied vars first, then the cleared originals.
  const restoreCleared = withEnv(cleared);
  const restoreVars = withEnv(vars);
  return () => {
    restoreVars();
    restoreCleared();
  };
}

const bodyOf = (call: Captured): Record<string, unknown> =>
  JSON.parse(String(call.init?.body)) as Record<string, unknown>;

// ---------------------------------------------------------------------------
// 1. Provider lookup — unknown ids are never a fallback
// ---------------------------------------------------------------------------

describe("registry — provider lookup (T-107.2)", () => {
  it("getProvider returns the DeepSeek descriptor for the registered id", () => {
    const p = getProvider("deepseek");
    assert.ok(p, "the registered provider resolves");
    assert.equal(p.id, "deepseek");
    assert.equal(p.label, "DeepSeek");
    assert.equal(p.apiKeyEnv, "DEEPSEEK_API_KEY");
    assert.equal(p.modelEnvPrefix, "DEEPSEEK");
    assert.equal(p.defaultBaseUrl, DEEPSEEK_BASE_URL);
    assert.deepEqual([...p.requestModelIds], [DEEPSEEK_MODELS.flash, DEEPSEEK_MODELS.pro]);
    assert.equal(typeof p.isConfigured, "function");
    assert.equal(typeof p.complete, "function");
  });

  it("getProvider returns undefined for unknown/blank/hostile ids — never a fallback", () => {
    for (const id of ["", " ", "openai", "DeepSeek", "deepseek ", " deepseek", "deepseek-v4-flash"]) {
      assert.equal(getProvider(id), undefined, `unknown id ${JSON.stringify(id)} must not resolve`);
    }
    assert.equal(getProvider(42 as unknown as string), undefined);
    assert.equal(getProvider(null as unknown as string), undefined);
    assert.equal(getProvider(undefined as unknown as string), undefined);
  });

  it("PROVIDERS is frozen, lists exactly DeepSeek today, and only requestable ids", () => {
    assert.equal(Object.isFrozen(PROVIDERS), true);
    assert.equal(PROVIDERS.length, 1, "one provider today — the array is the extension point");
    for (const p of PROVIDERS) {
      for (const id of p.requestModelIds) {
        assert.equal(isKnownModelId(id), true, `${p.id} request id ${id} must be a known id`);
        assert.ok(KNOWN_MODEL_IDS.includes(id), `${id} must be in KNOWN_MODEL_IDS`);
      }
    }
  });

  it("the role vocabulary is exactly main/reasoning/weak, frozen, with a hostile-value guard", () => {
    assert.deepEqual([...RAPIDTOOL_MODEL_ROLES], ["main", "reasoning", "weak"]);
    assert.equal(Object.isFrozen(RAPIDTOOL_MODEL_ROLES), true);
    assert.equal(isModelRole("main"), true);
    assert.equal(isModelRole("reasoning"), true);
    assert.equal(isModelRole("weak"), true);
    for (const bad of ["MAIN", "", " ", "pro", 7, null, undefined, {}]) {
      assert.equal(isModelRole(bad), false, `${JSON.stringify(bad)} is not a role`);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Role resolution + env pin keys
// ---------------------------------------------------------------------------

describe("registry — role resolution + env keys (T-107.2)", () => {
  it("each role resolves to its tier model with an empty env", () => {
    assert.deepEqual(resolveRoleModel("main", { env: {} }), {
      ok: true,
      role: "main",
      provider: "deepseek",
      model: DEEPSEEK_MODELS.flash,
    });
    assert.deepEqual(resolveRoleModel("reasoning", { env: {} }), {
      ok: true,
      role: "reasoning",
      provider: "deepseek",
      model: DEEPSEEK_MODELS.pro,
    });
    assert.deepEqual(resolveRoleModel("weak", { env: {} }), {
      ok: true,
      role: "weak",
      provider: "deepseek",
      model: DEEPSEEK_MODELS.flash,
    });
  });

  it("the tiers are frozen and `main` is the FLASH workhorse — never silently pro", () => {
    assert.equal(Object.isFrozen(ROLE_TIERS), true);
    assert.equal(ROLE_TIERS.main.model, DEEPSEEK_MODELS.flash);
    assert.equal(ROLE_TIERS.reasoning.model, DEEPSEEK_MODELS.pro);
    assert.equal(ROLE_TIERS.weak.model, DEEPSEEK_MODELS.flash);
    for (const role of RAPIDTOOL_MODEL_ROLES) {
      assert.equal(ROLE_TIERS[role].provider, "deepseek");
      assert.ok(ROLE_TIERS[role].note.length > 0, `${role} carries its rationale`);
    }
  });

  it("roleModelEnvKey names <PREFIX>_MODEL_<ROLE>; an unknown role yields null", () => {
    assert.equal(roleModelEnvKey("main"), "DEEPSEEK_MODEL_MAIN");
    assert.equal(roleModelEnvKey("reasoning"), "DEEPSEEK_MODEL_REASONING");
    assert.equal(roleModelEnvKey("weak"), "DEEPSEEK_MODEL_WEAK");
    assert.equal(roleModelEnvKey("turbo" as never), null);
    assert.equal(roleModelEnvKey("" as never), null);
  });

  it("an env pin overrides the tier model for that role", () => {
    assert.deepEqual(resolveRoleModel("main", { env: { DEEPSEEK_MODEL_MAIN: DEEPSEEK_MODELS.pro } }), {
      ok: true,
      role: "main",
      provider: "deepseek",
      model: DEEPSEEK_MODELS.pro,
    });
    assert.deepEqual(
      resolveRoleModel("reasoning", { env: { DEEPSEEK_MODEL_REASONING: DEEPSEEK_MODELS.flash } }),
      { ok: true, role: "reasoning", provider: "deepseek", model: DEEPSEEK_MODELS.flash },
    );
    // A pin for a DIFFERENT role never leaks into this role's resolution.
    const otherRolePin = resolveRoleModel("weak", { env: { DEEPSEEK_MODEL_MAIN: DEEPSEEK_MODELS.pro } });
    assert.equal(otherRolePin.ok, true);
    if (otherRolePin.ok) assert.equal(otherRolePin.model, DEEPSEEK_MODELS.flash);
  });

  it("precedence: call-site model > env pin > tier", () => {
    assert.deepEqual(
      resolveRoleModel("main", {
        model: DEEPSEEK_MODELS.flash,
        env: { DEEPSEEK_MODEL_MAIN: DEEPSEEK_MODELS.pro },
      }),
      { ok: true, role: "main", provider: "deepseek", model: DEEPSEEK_MODELS.flash },
    );
    assert.deepEqual(resolveRoleModel("reasoning", { model: DEEPSEEK_MODELS.pro, env: {} }), {
      ok: true,
      role: "reasoning",
      provider: "deepseek",
      model: DEEPSEEK_MODELS.pro,
    });
  });

  it("a blank env pin counts as UNSET (the provider's own blank⇒unset convention)", () => {
    for (const blank of ["", "   ", "\t"]) {
      const r = resolveRoleModel("main", { env: { DEEPSEEK_MODEL_MAIN: blank } });
      assert.deepEqual(r, { ok: true, role: "main", provider: "deepseek", model: DEEPSEEK_MODELS.flash });
    }
  });

  it("an unknown role is refused with RT_E_VALIDATION naming the known roles", () => {
    const r = resolveRoleModel("turbo" as never, { env: {} });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, "RT_E_VALIDATION");
      assert.match(r.error, /unknown model role "turbo"/);
      assert.match(r.error, /main, reasoning, weak/);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. The explicit-model rule
// ---------------------------------------------------------------------------

describe("registry — explicit-model rule (unknown ids refuse, never default)", () => {
  it("every KNOWN_MODEL_IDS entry resolves as an explicit id", () => {
    assert.deepEqual([...KNOWN_MODEL_IDS], [DEEPSEEK_MODELS.flash, DEEPSEEK_MODELS.pro]);
    for (const id of KNOWN_MODEL_IDS) {
      const r = resolveRoleModel("weak", { model: id, env: {} });
      assert.equal(r.ok, true, `${id} is known`);
      if (r.ok) assert.equal(r.model, id);
      assert.equal(isKnownModelId(id), true);
    }
  });

  it("the UNVERIFIED vision-experimental id is NOT requestable (live `/models` excludes it)", () => {
    assert.equal(KNOWN_MODEL_IDS.includes("deepseek-v4-flash-vision-exp"), false);
    const r = resolveRoleModel("main", { model: "deepseek-v4-flash-vision-exp", env: {} });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, "RT_E_VALIDATION");
      assert.match(r.error, /not a known model id/);
      assert.match(r.error, /deepseek-v4-flash/);
    }
  });

  it("unknown / version-tagged call-site ids are refused naming the known ids", () => {
    const unknownIds = [
      "deepseek-v4.1-flash", // vendor-REJECTED version tag (deepseek.ts header)
      "deepseek-chat",
      "deepseek-reasoner",
      "gpt-9",
    ];
    for (const model of unknownIds) {
      const r = resolveRoleModel("main", { model, env: {} });
      assert.equal(r.ok, false, `${model} must be refused`);
      if (!r.ok) {
        assert.equal(r.code, "RT_E_VALIDATION");
        assert.match(r.error, /is not a known model id/);
        assert.match(r.error, /Refusing rather than silently defaulting/);
        assert.match(r.error, /deepseek-v4-flash, deepseek-v4-pro/, "the known ids are named");
      }
    }
  });

  it("blank / non-string call-site ids are refused as non-empty-string violations", () => {
    const hostile: unknown[] = ["", "   ", 42, null, 0 / 0, {}];
    for (const model of hostile) {
      const r = resolveRoleModel("main", { model, env: {} });
      assert.equal(r.ok, false, `${JSON.stringify(model)} must be refused`);
      if (!r.ok) {
        assert.equal(r.code, "RT_E_VALIDATION");
        assert.match(r.error, /must be a non-empty string/);
        assert.match(r.error, /Refusing rather than silently defaulting/);
      }
    }
  });

  it("the refusal names the source (call-site vs env pin) and the exact value", () => {
    const explicit = resolveRoleModel("main", { model: "nope", env: {} });
    assert.equal(explicit.ok, false);
    if (!explicit.ok) assert.match(explicit.error, /explicit model "nope" is not a known model id/);

    const pinned = resolveRoleModel("main", { env: { DEEPSEEK_MODEL_MAIN: "nope" } });
    assert.equal(pinned.ok, false);
    if (!pinned.ok) {
      assert.equal(pinned.code, "RT_E_VALIDATION");
      assert.match(pinned.error, /DEEPSEEK_MODEL_MAIN \("nope"\) is not a known model id/);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. callModel — the registry path (injected fetch; no global stub, no network)
// ---------------------------------------------------------------------------

describe("registry — callModel fetch path (injected transport)", () => {
  it("refuses an unknown explicit id BEFORE any network I/O", async () => {
    const restore = withCleanLlmEnv({ [KEY]: "sk-registry-test" });
    const calls: Captured[] = [];
    try {
      const res = await callModel("main", "hello", {
        model: "gpt-9",
        fetch: capturingFetch(calls),
      });
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.reason, "error");
        assert.equal(res.code, "RT_E_VALIDATION");
      }
      assert.equal(calls.length, 0, "no request may leave before the id is validated");
    } finally {
      restore();
    }
  });

  it("sends the resolved role model with the legacy body shape (main ⇒ flash, thinking disabled)", async () => {
    const restore = withCleanLlmEnv({ [KEY]: "sk-registry-test" });
    const calls: Captured[] = [];
    try {
      const res = await callModel("main", "hello world", { fetch: capturingFetch(calls) });
      assert.equal(res.ok, true);
      if (res.ok) assert.equal(res.model, DEEPSEEK_MODELS.flash);
      assert.equal(calls.length, 1);
      const call = calls[0]!;
      assert.equal(call.url, `${DEEPSEEK_BASE_URL}/chat/completions`);
      assert.equal(call.init?.method, "POST");
      const body = bodyOf(call);
      assert.equal(body.model, DEEPSEEK_MODELS.flash, "the `main` tier id is what gets sent");
      assert.deepEqual(body.thinking, { type: "disabled" });
      assert.equal(body.stream, false);
      assert.equal(body.max_tokens, 1024, "flash default (byte-identical to the pre-registry call)");
      assert.deepEqual(body.messages, [{ role: "user", content: "hello world" }]);
    } finally {
      restore();
    }
  });

  it("a validated pro override drives the whole pro tier shape (enabled thinking)", async () => {
    const restore = withCleanLlmEnv({ [KEY]: "sk-registry-test" });
    const calls: Captured[] = [];
    try {
      const res = await callModel("main", "think hard", {
        model: DEEPSEEK_MODELS.pro,
        fetch: capturingFetch(calls),
      });
      assert.equal(res.ok, true);
      const body = bodyOf(calls[0]!);
      assert.equal(body.model, DEEPSEEK_MODELS.pro);
      assert.deepEqual(body.thinking, { type: "enabled" });
      assert.equal(body.reasoning_effort, "high");
      assert.equal(body.max_tokens, 8192, "pro default follows the resolved id");
    } finally {
      restore();
    }
  });

  it("honors a valid env pin at call time (registry resolution is in the real path)", async () => {
    const restore = withCleanLlmEnv({
      [KEY]: "sk-registry-test",
      DEEPSEEK_MODEL_WEAK: DEEPSEEK_MODELS.pro,
    });
    const calls: Captured[] = [];
    try {
      const res = await callModel("weak", "structured envelope", {
        json: true,
        fetch: capturingFetch(calls),
      });
      assert.equal(res.ok, true);
      const body = bodyOf(calls[0]!);
      assert.equal(body.model, DEEPSEEK_MODELS.pro, "the env pin is the model actually requested");
      assert.deepEqual(body.response_format, { type: "json_object" }, "json:true still forwarded");
    } finally {
      restore();
    }
  });

  it("keyless: the honest not-configured envelope, no fetch, no fabricated text", async () => {
    const restore = withCleanLlmEnv();
    const calls: Captured[] = [];
    try {
      const res = await callModel("reasoning", "hello", { fetch: capturingFetch(calls) });
      assert.deepEqual(res, {
        ok: false,
        reason: "not-configured",
        code: "RT_E_LLM_NOT_CONFIGURED",
      });
      assert.equal(calls.length, 0, "keyless never reaches the network");
    } finally {
      restore();
    }
  });
});
