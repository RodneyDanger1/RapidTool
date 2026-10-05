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
 *   4. (F2 · W19-L5, fixes/252) the SECOND provider family — a live-probed
 *      candidate whose id/endpoints are pinned from the 2026-09-24 probe
 *      (raw evidence: fixes/252_lane5_f2.md §1); it can never be dispatched or
 *      defaulted to until a probe read model ids back, and the DeepSeek path
 *      above stays byte-identical.
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
  resolveExplicitProvider,
  resolveRoleModel,
  roleModelEnvKey,
} from "./registry.ts";
import {
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODELS,
  TRANSIENT_RETRY_STATUS,
  completeDeepSeek,
} from "./deepseek.ts";
import {
  XAI_API_KEY_ENV,
  XAI_BASE_URL,
  XAI_MODELS_ENDPOINT,
  XAI_PROVIDER,
  XAI_PROVIDER_ID,
  XAI_SPEC,
  applyProbedModels,
  createOpenAiCompatibleProvider,
} from "./openai-compatible.ts";
import {
  PROBE_TIMEOUT_MS,
  probeProviderModels,
  resolveProbeTimeoutMs,
} from "./probe.ts";
import { createLlmTasks } from "../../llm-tasks.ts";
import type { CompleteOptions } from "../../llm-tasks.ts";
import type { PhaseDef } from "../../types.ts";

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

function capturingFetch(calls: Captured[], text = "ok"): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return chatResponse(text);
  }) as typeof fetch;
}

/** A vendor-style REJECTION response (e.g. 400 "model not found") — exactly one
 *  Response, no retry (400 is not in the provider's retryable set). */
function rejectionFetch(calls: Captured[], status: number, body: unknown): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

const KEY = "DEEPSEEK_API_KEY";
/** F2 · W19-L5 (fixes/252): the second family's key is cleared by the shared
 *  helper too — a developer machine carrying a real XAI_API_KEY must never be
 *  able to make a "keyless" test lie. */
const XAI_KEY = XAI_API_KEY_ENV;
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
  for (const k of [KEY, XAI_KEY, ...PIN_KEYS]) cleared[k] = undefined;
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

  it("PROVIDERS is frozen, lists DeepSeek first + the probed candidate, and only requestable ids", () => {
    assert.equal(Object.isFrozen(PROVIDERS), true);
    assert.equal(
      PROVIDERS.length,
      2,
      "two providers today: DeepSeek (role-routed) + the live-probed candidate (F2 · W19-L5)",
    );
    assert.equal(PROVIDERS[0]!.id, "deepseek", "preference order never moves DeepSeek");
    assert.equal(PROVIDERS[1]!.id, XAI_PROVIDER_ID, "the second family is the probed one");
    assert.deepEqual(
      PROVIDERS[0]!.verification,
      {
        kind: "static",
        note:
          "request-path ids live-verified 2026-09-16 against https://api.deepseek.com/models (two keys) — " +
          "served deepseek-flash for alias deepseek-v4-flash, plus deepseek-v4-pro; refresh path in ./deepseek.ts header",
      },
      "the DeepSeek provider declares its own (static) verification evidence",
    );
    for (const p of PROVIDERS) {
      for (const id of p.requestModelIds) {
        assert.equal(isKnownModelId(id), true, `${p.id} request id ${id} must be a known id`);
        assert.ok(KNOWN_MODEL_IDS.includes(id), `${id} must be in KNOWN_MODEL_IDS`);
      }
    }
    // F2 · W19-L5: the candidate contributes NO request ids — never an
    // unprobed model claim — and KNOWN_MODEL_IDS stays DeepSeek-scoped.
    assert.deepEqual([...PROVIDERS[1]!.requestModelIds], []);
    assert.deepEqual(
      [...KNOWN_MODEL_IDS],
      [DEEPSEEK_MODELS.flash, DEEPSEEK_MODELS.pro],
      "a second family never widens the global id namespace (221 F2 rule 6)",
    );
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
        // fixes/346 V2: the keyless refusal still names the provider that
        // would have served the role.
        servedProvider: "deepseek",
      });
      assert.equal(calls.length, 0, "keyless never reaches the network");
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// 5. OV-28 — the thinking-mode contract at the registry boundary (TEST-PIN
//    ONLY; W17 · L3). No behaviour change: these pins freeze what the boundary
//    does TODAY, so a thinking-field flip is RED, not silent. The force/refuse
//    arm for `json:true` on the reasoning tier waits on the owner's tier
//    intent (fixes/228 §3 #9 — MODIFY: test-pin half only).
// ---------------------------------------------------------------------------

describe("registry — thinking-mode contract at the boundary (OV-28 · test-pin only)", () => {
  it("reasoning tier + json:true does NOT auto-disable thinking: enabled + reasoning_effort high (pinned contract)", async () => {
    const restore = withCleanLlmEnv({ [KEY]: "sk-test-w17l3" });
    const calls: Captured[] = [];
    try {
      const res = await callModel("reasoning", "structured envelope", {
        json: true,
        fetch: capturingFetch(calls),
      });
      assert.equal(res.ok, true);
      const body = bodyOf(calls[0]!);
      assert.equal(body.model, DEEPSEEK_MODELS.pro, "the reasoning tier requests the pro alias");
      assert.deepEqual(
        body.thinking,
        { type: "enabled" },
        "today's contract: the boundary does not touch the thinking field",
      );
      assert.equal(body.reasoning_effort, "high");
      assert.deepEqual(body.response_format, { type: "json_object" }, "json:true still rides along");
    } finally {
      restore();
    }
  });

  it("an explicit thinking:false crosses the boundary verbatim (the E1 escape hatch reaches the wire)", async () => {
    const restore = withCleanLlmEnv({ [KEY]: "sk-test-w17l3" });
    const calls: Captured[] = [];
    try {
      const res = await callModel("reasoning", "structured envelope", {
        json: true,
        thinking: false,
        fetch: capturingFetch(calls),
      });
      assert.equal(res.ok, true);
      const body = bodyOf(calls[0]!);
      assert.equal(body.model, DEEPSEEK_MODELS.pro);
      assert.deepEqual(body.thinking, { type: "disabled" }, "thinking:false ⇒ the non-thinking pro shape");
      assert.equal("reasoning_effort" in body, false, "no reasoning_effort rides a thinking-disabled call");
    } finally {
      restore();
    }
  });

  it("thinking:true on the flash-served tier keeps the disabled shape (flash can never think on)", async () => {
    const restore = withCleanLlmEnv({ [KEY]: "sk-test-w17l3" });
    const calls: Captured[] = [];
    try {
      const res = await callModel("main", "plain call", {
        thinking: true,
        fetch: capturingFetch(calls),
      });
      assert.equal(res.ok, true);
      const body = bodyOf(calls[0]!);
      assert.equal(body.model, DEEPSEEK_MODELS.flash);
      assert.deepEqual(body.thinking, { type: "disabled" }, "flash has no thinking-on shape");
      assert.equal("reasoning_effort" in body, false);
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// 6. OV-36 — the three pro-tier llm-tasks sites pin their thinking decision.
//    The site decisions live in `src/lib/llm-tasks.ts`; the pins ride here
//    (this lane's test file) as the site → opts → wire-body chain both files
//    share. An absent/edited `thinking` at any site turns these RED.
// ---------------------------------------------------------------------------

describe("llm-tasks pro-tier sites — the thinking decision is pinned per site (OV-36)", () => {
  const PHASE: PhaseDef = {
    id: 0,
    code: "P0",
    title: "Deep Research & Feasibility",
    summary: "Feasibility before any code.",
    hitl: false,
  };
  const SNAPSHOT = { name: "Marketplace", brief: "Build a marketplace app.", domain: "ecommerce" };

  it("site 1 · extractConstraints (json envelope) pins thinking:false — with the disabled wire shape", async () => {
    const restore = withCleanLlmEnv({ [KEY]: "sk-test-w17l3" });
    const calls: Captured[] = [];
    const seen: Array<CompleteOptions | undefined> = [];
    try {
      const { extractConstraints } = createLlmTasks(async (prompt, opts) => {
        seen.push(opts);
        return completeDeepSeek(prompt, { ...opts, fetch: capturingFetch(calls, '{"constraints":["A"]}') });
      });
      const r = await extractConstraints("brief");
      assert.equal(r.ok, true);
      assert.deepEqual(
        seen[0],
        { model: DEEPSEEK_MODELS.pro, json: true, thinking: false },
        "site 1's decision is explicit in the request opts",
      );
      const body = bodyOf(calls[0]!);
      assert.equal(body.model, DEEPSEEK_MODELS.pro);
      assert.deepEqual(body.thinking, { type: "disabled" }, "the json site must not think (fixes/156 E1)");
      assert.equal("reasoning_effort" in body, false);
      assert.deepEqual(body.response_format, { type: "json_object" });
    } finally {
      restore();
    }
  });

  it("site 2 · interpretFeedback (prose) pins thinking:true — with the enabled wire shape", async () => {
    const restore = withCleanLlmEnv({ [KEY]: "sk-test-w17l3" });
    const calls: Captured[] = [];
    const seen: Array<CompleteOptions | undefined> = [];
    try {
      const { interpretFeedback } = createLlmTasks(async (prompt, opts) => {
        seen.push(opts);
        return completeDeepSeek(prompt, { ...opts, fetch: capturingFetch(calls, "Tighten the security story.") });
      });
      const r = await interpretFeedback("too vague", "Security");
      assert.equal(r.ok, true);
      assert.deepEqual(
        seen[0],
        { model: DEEPSEEK_MODELS.pro, thinking: true },
        "site 2's decision is explicit — never the vendor default",
      );
      const body = bodyOf(calls[0]!);
      assert.deepEqual(body.thinking, { type: "enabled" });
      assert.equal(body.reasoning_effort, "high");
      assert.equal(body.max_tokens, 8192, "the pro default output budget");
    } finally {
      restore();
    }
  });

  it("site 3 · phaseNarrative (prose) pins thinking:true — with the enabled wire shape", async () => {
    const restore = withCleanLlmEnv({ [KEY]: "sk-test-w17l3" });
    const calls: Captured[] = [];
    const seen: Array<CompleteOptions | undefined> = [];
    try {
      const { phaseNarrative } = createLlmTasks(async (prompt, opts) => {
        seen.push(opts);
        return completeDeepSeek(prompt, { ...opts, fetch: capturingFetch(calls, "A feasibility paragraph.") });
      });
      const r = await phaseNarrative(SNAPSHOT, PHASE);
      assert.equal(r.ok, true);
      assert.deepEqual(
        seen[0],
        { model: DEEPSEEK_MODELS.pro, thinking: true },
        "site 3's decision is explicit — never the vendor default",
      );
      const body = bodyOf(calls[0]!);
      assert.deepEqual(body.thinking, { type: "enabled" });
      assert.equal(body.reasoning_effort, "high");
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// 7. OV-37 — alias-death: the refusal NAMES the requested id (alongside the
//    vendor text; nothing is parsed) and the refresh path is documented at
//    `DEEPSEEK_MODELS` in ./deepseek.ts. No silent fallback anywhere.
// ---------------------------------------------------------------------------

describe("registry — alias-death refusals name the requested id (OV-37)", () => {
  it("a vendor 400 'model not found' names the REQUESTED id alongside the vendor text", async () => {
    const restore = withCleanLlmEnv({ [KEY]: "sk-test-w17l3" });
    const calls: Captured[] = [];
    try {
      const res = await callModel("reasoning", "hello", {
        fetch: rejectionFetch(calls, 400, { error: { message: "Model Not Exist" } }),
      });
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "RT_E_LLM_REJECTED");
        assert.match(
          res.error ?? "",
          /requested model: "deepseek-v4-pro"/,
          "the requested id is named verbatim",
        );
        assert.match(
          res.error ?? "",
          /Model Not Exist/,
          "the vendor's own message still rides along (human-visible, not parsed)",
        );
      }
      assert.equal(calls.length, 1, "a 400 is a first-attempt refusal — no retry, no silent fallback");
    } finally {
      restore();
    }
  });

  it("the named id is the RESOLVED request id for the role (the flash tier names the flash alias)", async () => {
    const restore = withCleanLlmEnv({ [KEY]: "sk-test-w17l3" });
    const calls: Captured[] = [];
    try {
      const res = await callModel("main", "hello", {
        fetch: rejectionFetch(calls, 400, { error: { message: "Model Not Exist" } }),
      });
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.match(res.error ?? "", /requested model: "deepseek-v4-flash"/);
        assert.equal(
          /deepseek-v4-pro/.test(res.error ?? ""),
          false,
          "the other id must not be named — the refusal carries the requested one",
        );
      }
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// F2 · W19-L5 (fixes/252) — the SECOND provider family. Started by the dead
// W19 lane, COMPLETED by W20-L4 (fixes/255): these are the resolution/probe
// pins the W19 lane imported but never wrote. Every id/endpoint below is from
// the 2026-09-24 LIVE probe pasted in fixes/255_lane4_t51_f2.md §3 (docs.x.ai
// vendor docs + api.x.ai's own 401/400/404 answers) — never an unprobed id.
// Reverting the registration, the candidate refusal, or either probe seam
// turns this block RED: it is load-bearing, not decoration.
// ---------------------------------------------------------------------------

/** A probe transport answering one JSON body with a recorded-free call (the
 *  probe has only a URL + init to inspect; nothing else is ever asserted). */
function jsonProbeFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

/** A probe transport recording the URL it was asked for, answering 200 + [] —
 *  used to prove that NO call happened (keyless / no-endpoint refusals). */
function recordingProbeFetch(calls: string[]): typeof fetch {
  return (async (url: unknown) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ object: "list", data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("registry — second family: the live-probed candidate (F2 · W19-L5)", () => {
  it("resolves by its probed id, with the probe's endpoints stamped as live-probe", () => {
    const restore = withCleanLlmEnv();
    try {
      const xai = getProvider(XAI_PROVIDER_ID);
      assert.ok(xai, `getProvider("${XAI_PROVIDER_ID}") resolves the probed family`);
      if (!xai) return;
      // The pins ARE the probe evidence (fixes/255 §3):
      //   · `export XAI_API_KEY=…` — docs.x.ai/developers/quickstart.md
      //   · the bare `GET https://api.x.ai/v1` 404 + live 401s ⇒ base is /v1
      //   · openapi.json `GET /v1/models` — "List all models available to the
      //     authenticating API key"
      assert.equal(XAI_PROVIDER_ID, "xai");
      assert.equal(XAI_API_KEY_ENV, "XAI_API_KEY");
      assert.equal(XAI_BASE_URL, "https://api.x.ai/v1");
      assert.equal(XAI_MODELS_ENDPOINT, "https://api.x.ai/v1/models");
      assert.equal(xai.id, "xai");
      assert.deepEqual(
        xai.verification,
        { kind: "live-probe", modelsEndpoint: "https://api.x.ai/v1/models" },
        "the candidate names the endpoint a probe reads ids back from",
      );
      assert.deepEqual([...xai.requestModelIds], [], "no unprobed id is ever requestable");
      assert.equal(xai.isConfigured(), false, "keyless ⇒ not configured, even past resolution");
    } finally {
      restore();
    }
  });

  it("an unprobed candidate is refused by the explicit path BEFORE any network I/O", async () => {
    const restore = withCleanLlmEnv();
    const calls: Captured[] = [];
    try {
      const xai = getProvider(XAI_PROVIDER_ID)!;
      const sel = resolveExplicitProvider(xai, { model: "grok-4" });
      assert.equal(sel.ok, false, "nothing is requestable until a probe read ids back");
      if (!sel.ok) {
        assert.equal(sel.code, "RT_E_VALIDATION");
        assert.match(sel.error, /requestModelIds/);
      }
      const res = await callModel("main", "hello candidate", {
        provider: xai,
        fetch: capturingFetch(calls),
      });
      assert.equal(res.ok, false, "the candidate never dispatches");
      if (!res.ok) assert.equal(res.code, "RT_E_VALIDATION");
      assert.deepEqual(calls, [], "the refusal happens before any request may leave");
    } finally {
      restore();
    }
  });

  it("applyProbedModels mints a dispatchable descriptor from EXACTLY the probed ids — the candidate is never mutated", () => {
    const probed = {
      configured: true,
      reachable: true,
      authenticated: true,
      models: ["grok-4", "grok-4-mini", "grok-4"],
    };
    const minted = applyProbedModels(XAI_PROVIDER_ID, probed);
    assert.equal(minted.ok, true);
    if (!minted.ok) return;
    assert.deepEqual(
      [...minted.descriptor.requestModelIds],
      ["grok-4", "grok-4-mini"],
      "exactly the probe's ids, deduped in probe order",
    );
    assert.notEqual(minted.descriptor, XAI_PROVIDER, "a fresh descriptor — never the registry's candidate");
    assert.deepEqual([...XAI_PROVIDER.requestModelIds], [], "the candidate stays a candidate forever");
    assert.equal(
      KNOWN_MODEL_IDS.includes("grok-4"),
      false,
      "a second family never widens the global id namespace (221 F2 rule 6)",
    );
    const sel = resolveExplicitProvider(minted.descriptor, { model: "grok-4-mini" });
    assert.equal(sel.ok, true, "a probe-verified descriptor IS requestable");
  });

  it("applyProbedModels refuses failed probes, empty id lists and unknown families — all coded", () => {
    const base = {
      configured: true,
      reachable: true,
      authenticated: true,
      models: ["grok-4"],
    };
    const refusals: Array<[string, typeof base]> = [
      ["unauthenticated", { ...base, authenticated: false }],
      ["unreachable", { ...base, reachable: false }],
      ["unconfigured", { ...base, configured: false }],
      ["reachable-but-empty", { ...base, models: [] }],
    ];
    for (const [why, probe] of refusals) {
      const r = applyProbedModels(XAI_PROVIDER_ID, probe);
      assert.equal(r.ok, false, why);
      if (!r.ok) assert.equal(r.code, "RT_E_VALIDATION", why);
    }
    const unknown = applyProbedModels("openai", base);
    assert.equal(unknown.ok, false, "an unknown vendor is never minted a descriptor");
    if (!unknown.ok) assert.equal(unknown.code, "RT_E_VALIDATION");
  });

  // W21-L2 (fixes/258): the adapter's OWN header claims ("keyless ⇒ the exact
  // legacy envelope BEFORE any network I/O"; "forwards NO reasoning field and
  // does NOT silently translate `opts.thinking` … pinned by a test so a silent
  // translation is RED, not invisible") were unpinned — these two tests make
  // them load-bearing. Reverting the floor, a substitution, or a reasoning
  // translation turns them RED.

  it("the adapter floor: keyless ⇒ the legacy envelope, an id no probe returned / no id at all ⇒ RT_E_VALIDATION — all before any I/O", async () => {
    // (a) keyless, on a FULLY verified descriptor: the floor precedes model
    //     checks and any request (mirror of completeDeepSeek's keyless floor).
    const restore = withCleanLlmEnv();
    const calls: Captured[] = [];
    try {
      const minted = applyProbedModels(XAI_PROVIDER_ID, {
        configured: true,
        reachable: true,
        authenticated: true,
        models: ["grok-4", "grok-4-mini"],
      });
      assert.equal(minted.ok, true);
      if (!minted.ok) return;
      const keyless = await callModel("main", "hello", {
        provider: minted.descriptor,
        model: "grok-4",
        fetch: capturingFetch(calls),
      });
      assert.equal(keyless.ok, false);
      if (!keyless.ok) {
        assert.equal(keyless.reason, "not-configured");
        assert.equal(keyless.code, "RT_E_LLM_NOT_CONFIGURED");
      }
      assert.deepEqual(calls, [], "the keyless floor fires before any request may leave");
    } finally {
      restore();
    }
    // (b) keyed, but the requested id is NOT one the probe returned: refuse —
    //     never substitute, never default (the module header's core claim).
    const restoreKeyed = withEnv({ [XAI_KEY]: "sk-xai-spike" });
    const calls2: Captured[] = [];
    try {
      const minted = applyProbedModels(XAI_PROVIDER_ID, {
        configured: true,
        reachable: true,
        authenticated: true,
        models: ["grok-4"],
      });
      assert.equal(minted.ok, true);
      if (!minted.ok) return;
      const unverified = await callModel("main", "hello", {
        provider: minted.descriptor,
        model: "gpt-4o",
        fetch: capturingFetch(calls2),
      });
      assert.equal(unverified.ok, false);
      if (!unverified.ok) assert.equal(unverified.code, "RT_E_VALIDATION");
      const unset = await minted.descriptor.complete("hello", { fetch: capturingFetch(calls2) });
      assert.equal(unset.ok, false, "no default model exists — an absent id refuses too");
      if (!unset.ok) assert.equal(unset.code, "RT_E_VALIDATION");
      assert.deepEqual(calls2, [], "both refusals precede any request");
    } finally {
      restoreKeyed();
    }
  });

  it("the adapter wire: the verified id dispatches to the probed base — no reasoning knob, no deprecated field, no invented budget", async () => {
    const restore = withEnv({ [XAI_KEY]: "sk-xai-spike" });
    const calls: Captured[] = [];
    try {
      const minted = applyProbedModels(XAI_PROVIDER_ID, {
        configured: true,
        reachable: true,
        authenticated: true,
        models: ["grok-4", "grok-4-mini"],
      });
      assert.equal(minted.ok, true);
      if (!minted.ok) return;
      const res = await callModel("main", "hello", {
        provider: minted.descriptor,
        model: "grok-4",
        // DeepSeek-only knobs: `thinking` must NOT become a reasoning field
        // (unprobed for this family — the file header's honesty claim).
        thinking: true,
        maxTokens: 1234,
        json: true,
        fetch: capturingFetch(calls),
      });
      assert.equal(res.ok, true);
      if (res.ok) assert.equal(res.text, "ok");
      assert.equal(calls.length, 1, "one attempt on a 200 — no retry");
      const call = calls[0]!;
      assert.equal(call.url, `${XAI_BASE_URL}/chat/completions`, "the probed base + chat path");
      assert.equal(
        new Headers(call.init?.headers).get("authorization"),
        "Bearer sk-xai-spike",
        "the family's own key rides the wire",
      );
      const body = bodyOf(call);
      assert.equal(body.model, "grok-4");
      assert.equal(body.max_completion_tokens, 1234);
      assert.equal(body.max_tokens, undefined, "the deprecated field is never sent");
      assert.equal(body.reasoning_effort, undefined, "thinking:true must not become a reasoning field");
      assert.deepEqual(body.response_format, { type: "json_object" });
      assert.equal(body.stream, false);
      // …and with no caller budget the vendor's own default applies: nothing
      // budget-shaped (and nothing JSON-shaped) is invented.
      const plainCalls: Captured[] = [];
      const plain = await callModel("main", "hello", {
        provider: minted.descriptor,
        model: "grok-4-mini",
        fetch: capturingFetch(plainCalls),
      });
      assert.equal(plain.ok, true);
      const plainBody = bodyOf(plainCalls[0]!);
      assert.equal(plainBody.max_completion_tokens, undefined, "no budget is invented when the caller passed none");
      assert.equal(plainBody.response_format, undefined);
    } finally {
      restore();
    }
  });

  // §R4-f01 (W29 · LANE P) — the wallet doctrine is PROVIDER-WIDE. The
  // DeepSeek 402 → RT_E_LLM_NO_BALANCE map (deepseek.ts:437-444, W23-L1) is
  // mirrored by the OpenAI-compatible adapter: a 402 / "Insufficient Balance"
  // refusal reads as the wallet class, every other refusal keeps the generic
  // code. The vendor message must stay byte-identical to the prior shape
  // (only the code changes for the 402 class).
  it("R4-f01: a 402 balance refusal maps to RT_E_LLM_NO_BALANCE; a non-402 refusal keeps RT_E_LLM_REJECTED", async () => {
    const restore = withEnv({ [XAI_KEY]: "sk-xai-spike" });
    const calls: Captured[] = [];
    try {
      const provider = createOpenAiCompatibleProvider(XAI_SPEC, ["probe-model-id"]);
      // (a) the live 402 shape: {"error":{"message":"Insufficient Balance"}}
      const res = await provider.complete("hello", {
        model: "probe-model-id" as never,
        fetch: rejectionFetch(calls, 402, { error: { message: "Insufficient Balance" } }),
      });
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "RT_E_LLM_NO_BALANCE", "a broke wallet is not a generic refusal");
        assert.match(res.error ?? "", /Insufficient Balance/, "the vendor's own text rides along");
        assert.match(res.error ?? "", /requested model: "probe-model-id"/, "the requested id is named");
      }
      assert.equal(calls.length, 1, "402 is not in the retryable set — billing is not transient");
      // (b) the mirror's other half: any non-402 refusal stays generic.
      const calls2: Captured[] = [];
      const other = await provider.complete("hello", {
        model: "probe-model-id" as never,
        fetch: rejectionFetch(calls2, 403, { error: { message: "Forbidden" } }),
      });
      assert.equal(other.ok, false);
      if (!other.ok) assert.equal(other.code, "RT_E_LLM_REJECTED");
    } finally {
      restore();
    }
  });

  it("343 bh2: the OpenAI-compatible adapter records OpenAI-style cache-hit tokens", async () => {
    // LlmUsage.cachedPromptTokens documents the OpenAI-style
    // `prompt_tokens_details.cached_tokens` source; the DeepSeek twin parses its
    // `prompt_cache_hit_tokens`, but the OpenAI-compatible adapter dropped the
    // whole `prompt_tokens_details` block — a silent under-count once this
    // family is armed. Reach the adapter directly (the xai candidate carries no
    // verified ids yet).
    const restore = withEnv({ [XAI_KEY]: "sk-xai-spike" });
    try {
      const provider = createOpenAiCompatibleProvider(XAI_SPEC, ["probe-model-id"]);
      const res = await provider.complete("hello", {
        model: "probe-model-id" as never,
        fetch: (async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "hi" } }],
              model: "probe-model-id",
              usage: { prompt_tokens: 100, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 80 } },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          )) as typeof fetch,
      });
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.usage?.promptTokens, 100);
        assert.equal(res.usage?.completionTokens, 5);
        assert.equal(res.usage?.cachedPromptTokens, 80, "the OpenAI cache-hit split must survive");
      }
    } finally {
      restore();
    }
  });

  it("probeProviderModels: keyless ⇒ configured:false + RT_E_LLM_NOT_CONFIGURED with ZERO network I/O", async () => {
    const restore = withCleanLlmEnv();
    const calls: string[] = [];
    try {
      const res = await probeProviderModels(getProvider(XAI_PROVIDER_ID)!, {
        fetch: recordingProbeFetch(calls),
      });
      assert.equal(res.configured, false);
      assert.equal(res.reachable, false);
      assert.equal(res.authenticated, false);
      assert.equal(res.status, null);
      assert.equal(res.code, "RT_E_LLM_NOT_CONFIGURED");
      assert.deepEqual(calls, [], "no probe request may leave the machine keyless");
    } finally {
      restore();
    }
  });

  it("probeProviderModels: a descriptor with no live-probe endpoint is refused (static ≠ probed)", async () => {
    const restore = withEnv({ [KEY]: "sk-spike" });
    const calls: string[] = [];
    try {
      const res = await probeProviderModels(getProvider("deepseek")!, {
        fetch: recordingProbeFetch(calls),
      });
      assert.equal(res.code, "RT_E_VALIDATION");
      assert.equal(res.status, null, "no request left the machine");
      assert.deepEqual(calls, []);
    } finally {
      restore();
    }
  });

  it("probeProviderModels: the wire matrix — 401 never reachable, a 200 reads ids back, an empty 200 is not usable", async () => {
    const restore = withEnv({ [XAI_API_KEY_ENV]: "sk-xai-spike" });
    try {
      const xai = getProvider(XAI_PROVIDER_ID)!;
      // (a) the live probe's own observed refusal, replayed byte-for-byte.
      const calls: Captured[] = [];
      const unauthorized = await probeProviderModels(xai, {
        fetch: rejectionFetch(calls, 401, {
          code: "unauthenticated:no-credentials",
          error: "No credentials presented.",
        }),
      });
      assert.equal(unauthorized.status, 401);
      assert.equal(unauthorized.reachable, false, "HTTP ≥ 400 is never reachable");
      assert.equal(unauthorized.authenticated, false);
      assert.equal(unauthorized.code, "RT_E_LLM_REJECTED");
      assert.equal(calls.length, 1);
      assert.equal(calls[0]!.url, XAI_MODELS_ENDPOINT, "the probe hits the descriptor's own probed endpoint");
      assert.equal(
        new Headers(calls[0]!.init?.headers).get("authorization"),
        "Bearer sk-xai-spike",
        "the family's own key rides the probe",
      );
      // (b) a 200 reads ids back from the vendor's own body — and then mints.
      const okProbe = await probeProviderModels(xai, {
        fetch: jsonProbeFetch({ object: "list", data: [{ id: "grok-4" }, { id: "grok-4-mini" }] }, 200),
      });
      assert.equal(okProbe.reachable, true);
      assert.equal(okProbe.authenticated, true);
      assert.deepEqual([...okProbe.models], ["grok-4", "grok-4-mini"]);
      assert.equal(
        applyProbedModels(XAI_PROVIDER_ID, okProbe).ok,
        true,
        "a genuine probe result is mintable evidence",
      );
      // (c) 200 with ZERO models: reachable + authenticated, but NOT usable.
      const emptyProbe = await probeProviderModels(xai, {
        fetch: jsonProbeFetch({ object: "list", data: [] }, 200),
      });
      assert.equal(emptyProbe.reachable, true);
      assert.deepEqual([...emptyProbe.models], []);
      const fromEmpty = applyProbedModels(XAI_PROVIDER_ID, emptyProbe);
      assert.equal(fromEmpty.ok, false, "reachable is not usable — nothing is minted from an empty list");
    } finally {
      restore();
    }
  });

  it("resolveProbeTimeoutMs caps at the documented 3 s budget — a caller may ask for less, never more", () => {
    assert.equal(PROBE_TIMEOUT_MS, 3_000);
    assert.equal(resolveProbeTimeoutMs(60_000), 3_000);
    assert.equal(resolveProbeTimeoutMs(1_000), 1_000);
    // A positive sub-millisecond request must floor at 1ms, not 0 — a 0ms
    // budget aborts before any probe I/O, i.e. a positive ask became an
    // instant timeout.
    assert.equal(resolveProbeTimeoutMs(0.5), 1);
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
      assert.equal(resolveProbeTimeoutMs(bad), 3_000, `unset/hostile budget ⇒ the cap: ${String(bad)}`);
    }
  });

  it("probeProviderModels never throws on a hostile descriptor — the refusal is coded", async () => {
    for (const bad of [null, undefined, 42, "x"]) {
      const r = await probeProviderModels(bad as never, { env: {} });
      assert.equal(r.reachable, false, `descriptor ${String(bad)}: not reachable`);
      assert.equal(r.authenticated, false, `descriptor ${String(bad)}: not authenticated`);
      assert.equal(r.status, null, `descriptor ${String(bad)}: no I/O performed`);
      assert.equal(r.code, "RT_E_VALIDATION", `descriptor ${String(bad)}: coded refusal, never a throw`);
    }
  });
});

// ---------------------------------------------------------------------------
// fixes/346 A2-F2 — the un-armed failover shell was DELETED. The pins for that
// deletion live in `registry-failover.test.ts` (the switch is inert; no chain
// resolver is exported). Nothing here re-asserts a chain that no longer exists.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// fixes/346 A2-F4 — ONE shared transient-retry set for both provider families.
// ---------------------------------------------------------------------------
describe("fixes/346 A2-F4 — the transient-retry set is unified", () => {
  it("exports the wider transient set: 429/500/502/503/504", () => {
    assert.deepEqual([...TRANSIENT_RETRY_STATUS].sort((a, b) => a - b), [429, 500, 502, 503, 504]);
  });

  it("DeepSeek now RETRIES a transient 502/504 (was terminal) and succeeds on attempt 3", async () => {
    const restore = withEnv({ [KEY]: "test-deepseek-key-never-logged" });
    const calls: Captured[] = [];
    const statuses = [502, 504, 200];
    let i = 0;
    const fetchImpl = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const status = statuses[Math.min(i++, statuses.length - 1)]!;
      return status === 200
        ? chatResponse("recovered")
        : new Response(JSON.stringify({ error: { message: "gateway" } }), {
            status,
            headers: { "content-type": "application/json" },
          });
    }) as typeof fetch;
    try {
      const res = await completeDeepSeek("hello", {
        model: DEEPSEEK_MODELS.flash,
        fetch: fetchImpl,
        sleep: async () => {},
        random: () => 0,
      });
      assert.equal(res.ok, true, "502/504 are transient and must be retried, not terminal");
      assert.equal(calls.length, 3, "two transient statuses retried, then the call succeeds");
    } finally {
      restore();
    }
  });
});

