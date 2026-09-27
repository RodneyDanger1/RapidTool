// ---------------------------------------------------------------------------
// fixes/152 (factory steal #1) — resilient LLM retry: full-jitter exponential
// backoff, bounded attempts, injectable fetch/sleep/random seams.
//
// Run: node --experimental-strip-types --test src/lib/deepseek.server.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clearLlmCallTap,
  completeDeepSeek,
  isDeepSeekConfigured,
  jitteredBackoffDelayMs,
  RETRY_BASE_MS,
  RETRY_MAX_JITTER_MS,
  setLlmCallTap,
} from "./deepseek.server.ts";
import type { LlmModel } from "./llm.ts";

const KEY = "sk-test-152";
const SAVE_KEY = process.env.DEEPSEEK_API_KEY;

function withKey(key: string | undefined): void {
  if (key === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = key;
}

/** Fake fetch: serves `statuses` in order (last one repeats for extra calls). */
function fakeFetch(
  statuses: number[],
  opts?: { network?: boolean },
): { fetch: typeof fetch; calls: () => number } {
  let i = 0;
  let n = 0;
  const fetchFn = (async () => {
    n += 1;
    const status = statuses[Math.min(i, statuses.length - 1)];
    if (statuses.length > 0) i += 1;
    // network mode: the value 0 in the array means a transient network error
    // (the fixture throws instead of resolving); non-zero statuses still
    // resolve so a sequence like [0,0,200] = two network errors then success.
    if (opts?.network && status === 0) throw new Error("fetch failed: ECONNRESET");
    if (status === 200) {
      return new Response(
        JSON.stringify({
          model: "deepseek-v4-flash",
          choices: [{ message: { content: "  hello world  " } }],
          usage: { prompt_tokens: 3, completion_tokens: 2 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("{}", { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fetch: fetchFn, calls: () => n };
}

function sleeping(): { sleep: (ms: number) => Promise<void>; delays: () => number[] } {
  const delays: number[] = [];
  return {
    sleep: async (ms: number) => {
      delays.push(ms);
    },
    delays: () => delays,
  };
}

const alwaysOne = () => 1; // random=1 ⇒ legacy fixed schedule (cap each attempt)

describe("jitteredBackoffDelayMs (pure full-jitter policy)", () => {
  it("grows the cap exponentially and bounds it at RETRY_MAX_JITTER_MS", () => {
    // attempt 1: cap min(8000, 500·2)=1000 … attempt 4+: cap min(8000, …)=8000
    assert.equal(jitteredBackoffDelayMs(1, alwaysOne), 1000);
    assert.equal(jitteredBackoffDelayMs(2, alwaysOne), 2000);
    assert.equal(jitteredBackoffDelayMs(3, alwaysOne), 4000);
    assert.equal(jitteredBackoffDelayMs(4, alwaysOne), RETRY_MAX_JITTER_MS);
    assert.equal(jitteredBackoffDelayMs(9, alwaysOne), RETRY_MAX_JITTER_MS);
    assert.equal(RETRY_BASE_MS, 500);
  });

  it("full jitter: any draw inside [0, cap], deterministic under injection", () => {
    assert.equal(jitteredBackoffDelayMs(1, () => 0), 0);
    assert.equal(jitteredBackoffDelayMs(1, () => 0.5), 500);
    assert.equal(jitteredBackoffDelayMs(2, () => 0.25), 500);
    assert.ok(jitteredBackoffDelayMs(1) >= 0, "default random never negative");
    // hostile draws clamp into [0,1]
    assert.equal(jitteredBackoffDelayMs(2, () => 2), 2000);
    assert.equal(jitteredBackoffDelayMs(2, () => -1), 0);
  });

  it("never exceeds the cap even on a late attempt (no unbounded sleep)", () => {
    const r = jitteredBackoffDelayMs(20, alwaysOne);
    assert.ok(r <= RETRY_MAX_JITTER_MS, `late attempt delay ${r} capped`);
  });
});

describe("completeDeepSeek retry (fixes/152)", () => {
  it("keyless runs refuse before any network I/O", async () => {
    withKey(undefined);
    try {
      const { fetch: f } = fakeFetch([200]);
      const r = await completeDeepSeek("hi", { fetch: f });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.reason, "not-configured");
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("succeeds on the first attempt without sleeping (1 call, no delays)", async () => {
    withKey(KEY);
    try {
      const { fetch: f, calls } = fakeFetch([200]);
      const s = sleeping();
      const r = await completeDeepSeek("hi", { fetch: f, sleep: s.sleep, random: alwaysOne });
      assert.equal(r.ok, true);
      if (r.ok) assert.equal(r.text, "hello world");
      assert.equal(calls(), 1);
      assert.deepEqual(s.delays(), []);
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("retries 503 twice with jittered backoff, then succeeds (3 calls, honest delays)", async () => {
    withKey(KEY);
    try {
      const { fetch: f, calls } = fakeFetch([503, 503, 200]);
      const s = sleeping();
      const r = await completeDeepSeek("hi", { fetch: f, sleep: s.sleep, random: alwaysOne });
      assert.equal(r.ok, true, "transient 503s must not fail the call");
      assert.equal(calls(), 3);
      assert.deepEqual(s.delays(), [1000, 2000], "full-jitter @random=1 == 500·2ⁿ schedule");
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("bounded refusal: 429 forever → coded error naming HTTP 429 and 'after 3 attempts'", async () => {
    withKey(KEY);
    try {
      const { fetch: f, calls } = fakeFetch([429, 429, 429, 429]);
      const s = sleeping();
      const r = await completeDeepSeek("hi", { fetch: f, sleep: s.sleep, random: alwaysOne });
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.equal(r.code, "RT_E_LLM_REJECTED");
        assert.match(r.error ?? "", /HTTP 429/);
        assert.match(r.error ?? "", /after 3 attempts/, "retry count is spoken aloud");
      }
      assert.equal(calls(), 3, "exactly MAX_ATTEMPTS — never an infinite loop");
      assert.deepEqual(s.delays(), [1000, 2000]);
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("transient network errors retry; success lands on attempt 3", async () => {
    withKey(KEY);
    try {
      const { fetch: f, calls } = fakeFetch([0, 0, 200], { network: true });
      const s = sleeping();
      const r = await completeDeepSeek("hi", { fetch: f, sleep: s.sleep, random: alwaysOne });
      assert.equal(r.ok, true);
      assert.equal(calls(), 3);
      assert.deepEqual(s.delays(), [1000, 2000]);
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("network-error exhaustion is an honest refusal that names the attempt count", async () => {
    withKey(KEY);
    try {
      const { fetch: f, calls } = fakeFetch([0, 0, 0, 0], { network: true });
      const r = await completeDeepSeek("hi", { fetch: f, sleep: sleeping().sleep, random: alwaysOne });
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.match(r.error ?? "", /ECONNRESET/);
        assert.match(r.error ?? "", /after 3 attempts/);
      }
      assert.equal(calls(), 3);
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("an AbortError (deadline fired) is never retried — immediate honest timeout", async () => {
    withKey(KEY);
    try {
      const aborting = (async () => {
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      }) as typeof fetch;
      const s = sleeping();
      const r = await completeDeepSeek("hi", { fetch: aborting, sleep: s.sleep, random: alwaysOne });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, "RT_E_LLM_TIMEOUT");
      assert.deepEqual(s.delays(), [], "no backoff sleep after the deadline fired");
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("non-retryable 400 stays a first-attempt refusal (byte-identical message, no suffix)", async () => {
    withKey(KEY);
    try {
      const { fetch: f, calls } = fakeFetch([400]);
      const r = await completeDeepSeek("hi", { fetch: f, sleep: sleeping().sleep, random: alwaysOne });
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.match(r.error ?? "", /HTTP 400/);
        assert.ok(!/attempts/.test(r.error ?? ""), "single-attempt refusal says nothing about retries");
      }
      assert.equal(calls(), 1);
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("jittered: a mid-range draw yields non-fixed delays between 0 and the cap", async () => {
    withKey(KEY);
    try {
      const draws = [0.7, 0.3];
      const { fetch: f, calls } = fakeFetch([503, 503, 200]);
      const s = sleeping();
      const r = await completeDeepSeek("hi", {
        fetch: f,
        sleep: s.sleep,
        random: () => draws.shift() ?? 0.5,
      });
      assert.equal(r.ok, true);
      assert.deepEqual(s.delays(), [700, 600], "draw·cap: 0.7·1000, 0.3·2000");
      assert.equal(calls(), 3);
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("configured probe reflects the env", () => {
    withKey(KEY);
    try {
      assert.equal(isDeepSeekConfigured(), true);
    } finally {
      withKey(SAVE_KEY);
    }
  });
});

// ---------------------------------------------------------------------------
// fixes/154 (F3) — empty-content DIAGNOSTIC parse. The parent's live probe of
// the real synthesis shape (pro + thinking + reasoning_effort high +
// json_object) returned content EMPTY on every large-prompt call; the refusal
// now says WHY: reasoning-only responses (thinking consumed the output),
// finish_reason "length" (max_tokens truncation), or a genuinely silent
// model. These fake-body tests pin the exact refusal strings a caller (the
// 154 loop, codegen's refusal → next-cycle evidence) can match on.
// ---------------------------------------------------------------------------
describe("completeDeepSeek empty-content diagnostics (fixes/154)", () => {
  /** Fake fetch serving one canned 200 JSON body (byte-exact response parse). */
  function fakeFetchBody(body: unknown): typeof fetch {
    const fetchFn = (async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    return fetchFn;
  }

  /** Run a test body with a fake key set, restoring the saved env either way. */
  async function keyed<T>(fn: () => Promise<T>): Promise<T> {
    withKey(KEY);
    try {
      return await fn();
    } finally {
      withKey(SAVE_KEY);
    }
  }

  it("reasoning-only body (content empty, reasoning_content present) refuses naming 'reasoning only (N chars…)'", async () => {
    await keyed(async () => {
      // 123 chars of reasoning AFTER trimming — pins the .trim().length count.
      const reasoning = `\n${"x".repeat(123)}\n`;
      const r = await completeDeepSeek("think hard", {
        model: "deepseek-v4-pro",
        fetch: fakeFetchBody({
          model: "deepseek-v4-pro",
          choices: [
            {
              message: { content: "", reasoning_content: reasoning },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 9, completion_tokens: 217 },
        }),
      });
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.equal(r.code, "RT_E_LLM_REJECTED");
        assert.match(
          r.error ?? "",
          /model returned reasoning only \(123 chars of reasoning_content, content empty\)/,
          "char count is the TRIMMED reasoning length, byte-exact",
        );
        assert.ok(
          !/stopped at max_tokens/.test(r.error ?? ""),
          "finish_reason stop adds no length note",
        );
      }
    });
  });

  it("finish_reason 'length' without reasoning refuses naming 'stopped at max_tokens'", async () => {
    await keyed(async () => {
      const r = await completeDeepSeek("big ask", {
        model: "deepseek-v4-pro",
        fetch: fakeFetchBody({
          model: "deepseek-v4-pro",
          choices: [
            { message: { content: "" }, finish_reason: "length" },
          ],
          usage: { prompt_tokens: 9, completion_tokens: 32_000 },
        }),
      });
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.equal(r.code, "RT_E_LLM_REJECTED");
        assert.match(
          r.error ?? "",
          /stopped at max_tokens \(finish_reason length\)/,
          "the truncation cause is spoken aloud so the loop can raise the budget",
        );
        assert.ok(
          !/reasoning only/.test(r.error ?? ""),
          "no reasoning_content → no reasoning-only note",
        );
      }
    });
  });

  it("reasoning-only AND finish_reason length carry BOTH notes (budget burn is the empty-content mechanism)", async () => {
    await keyed(async () => {
      const r = await completeDeepSeek("huge brief", {
        model: "deepseek-v4-pro",
        fetch: fakeFetchBody({
          model: "deepseek-v4-pro",
          choices: [
            {
              message: { content: "", reasoning_content: "abc" },
              finish_reason: "length",
            },
          ],
        }),
      });
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.match(r.error ?? "", /reasoning only \(3 chars of reasoning_content, content empty\)/);
        assert.match(r.error ?? "", /stopped at max_tokens \(finish_reason length\)/);
        // Exact byte order: no-text base, reasoning note, then the length note.
        assert.match(
          r.error ?? "",
          /^DeepSeek returned no text content; model returned reasoning only \(3 chars of reasoning_content, content empty\); stopped at max_tokens \(finish_reason length\)$/,
        );
      }
    });
  });

  it("content present alongside reasoning_content is OK — text is the CONTENT byte-pinned (never the reasoning)", async () => {
    await keyed(async () => {
      // The parent's small-prompt probe shape: both fields present, content wins.
      const content = "  {\"ok\": true, \"module\": \"x\"}  ";
      const r = await completeDeepSeek("synthesize", {
        model: "deepseek-v4-pro",
        fetch: fakeFetchBody({
          model: "deepseek-v4-pro",
          choices: [
            {
              message: { content, reasoning_content: "some reasoning" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 1200, completion_tokens: 300 },
        }),
      });
      assert.equal(r.ok, true);
      if (r.ok) {
        assert.equal(r.text, content.trim(), "text = content.trim(), byte-exact");
        assert.ok(!r.text.includes("reasoning"), "reasoning_content never leaks into the answer");
        assert.equal(r.model, "deepseek-v4-pro", "parsed model rides the result");
        assert.deepEqual(r.usage, { promptTokens: 1200, completionTokens: 300 });
      }
    });
  });

  it("whitespace-only content with no reasoning and no length stays the plain silent-model refusal", async () => {
    await keyed(async () => {
      const r = await completeDeepSeek("hi", {
        fetch: fakeFetchBody({
          choices: [{ message: { content: "   \n " }, finish_reason: "stop" }],
        }),
      });
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.match(r.error ?? "", /^DeepSeek returned no text content$/);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// fixes/156 (E1) — the empty-content blocker fix: an ADDITIVE per-request
// thinking override. Mechanism (web-verified, fixes/156_e1.md): with pro
// thinking enabled (the default) on the LARGE json synthesis prompts,
// reasoning_content consumed the whole max_tokens window and the API
// returned content:"" on every call. The fix hands the output budget to
// content by sending thinking:{type:"disabled"} for the structured
// envelope. Omitted keeps the legacy per-tier shape BYTE-IDENTICAL (pro:
// enabled + reasoning_effort high — the fixes/125 pro-reasoning contract).
// These tests capture the OUTGOING request body (not just the response
// parse) so the wire shape is pinned.
// ---------------------------------------------------------------------------
describe("completeDeepSeek thinking override (fixes/156 E1)", () => {
  /** Fake fetch that records the outgoing request body then serves a 200. */
  function captureFetch(body: unknown): {
    fetch: typeof fetch;
    bodies: () => Array<Record<string, unknown>>;
  } {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchFn = (async (_url: unknown, init?: RequestInit) => {
      if (typeof init?.body === "string") {
        try {
          bodies.push(JSON.parse(init.body) as Record<string, unknown>);
        } catch {
          /* non-JSON body — not ours */
        }
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    return { fetch: fetchFn, bodies: () => bodies };
  }

  const OK = {
    model: "deepseek-v4-pro",
    choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 3, completion_tokens: 2 },
  };

  it("pro + thinking:false sends thinking {type:disabled} and NO reasoning_effort (the json-synthesis wire shape)", async () => {
    withKey(KEY);
    try {
      const f = captureFetch(OK);
      const r = await completeDeepSeek("synthesize a module", {
        model: "deepseek-v4-pro",
        json: true,
        thinking: false,
        fetch: f.fetch,
      });
      assert.equal(r.ok, true, "a disabled-thinking pro call still succeeds");
      const body = f.bodies()[0]!;
      assert.deepEqual(
        body.thinking,
        { type: "disabled" },
        "thinking:false → the non-thinking body shape on the pro tier",
      );
      assert.ok(
        !("reasoning_effort" in body),
        "no reasoning_effort rides a thinking-disabled call (flash-shape parity)",
      );
      assert.deepEqual(
        body.response_format,
        { type: "json_object" },
        "json:true is unaffected by the thinking override — the envelope stays",
      );
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("pro default (no thinking flag) stays BYTE-IDENTICAL: enabled + reasoning_effort high", async () => {
    withKey(KEY);
    try {
      const f = captureFetch(OK);
      await completeDeepSeek("think hard", {
        model: "deepseek-v4-pro",
        fetch: f.fetch,
      });
      const body = f.bodies()[0]!;
      assert.deepEqual(
        body.thinking,
        { type: "enabled" },
        "omitted flag keeps the fixes/125 pro-reasoning default",
      );
      assert.equal(body.reasoning_effort, "high", "…with the high effort tier");
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("pro + thinking:true is the same enabled shape; flash + thinking:false is the same disabled shape (override can only turn pro OFF)", async () => {
    withKey(KEY);
    try {
      const f1 = captureFetch(OK);
      await completeDeepSeek("x", { model: "deepseek-v4-pro", thinking: true, fetch: f1.fetch });
      assert.deepEqual(f1.bodies()[0]!.thinking, { type: "enabled" }, "true = default pro shape");

      const f2 = captureFetch(OK);
      await completeDeepSeek("x", { model: "deepseek-v4-flash", thinking: false, fetch: f2.fetch });
      assert.deepEqual(f2.bodies()[0]!.thinking, { type: "disabled" }, "flash stays disabled");

      const f3 = captureFetch(OK);
      await completeDeepSeek("x", { model: "deepseek-v4-flash", fetch: f3.fetch });
      assert.deepEqual(
        f3.bodies()[0]!.thinking,
        f2.bodies()[0]!.thinking,
        "flash + thinking:false is byte-identical to the flash default",
      );
    } finally {
      withKey(SAVE_KEY);
    }
  });
});

// ---------------------------------------------------------------------------
// R4-f05 · C1-f09 (W29 · LANE P) — the provider-side model-id gate. The header
// claims "unknown ids are refused before any network I/O, and this provider
// never falls back to a default"; until W29 that rule lived only in
// registry.ts's explicit/env paths, so a direct facade caller (llm.ts
// complete(), whose validator is TS-only at runtime) could ship an out-of-set
// id to the wire and buy a vendor 400. These pins turn the header claim RED
// if the gate is dropped.
// ---------------------------------------------------------------------------

describe("completeDeepSeek model-id validation (R4-f05 · C1-f09)", () => {
  it("an unknown id is refused PRE-network with RT_E_VALIDATION naming the known request ids", async () => {
    withKey(KEY);
    try {
      const f = fakeFetch([200]);
      const r = await completeDeepSeek("hi", {
        model: "deepseek-v4-typo" as LlmModel,
        fetch: f.fetch,
      });
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.equal(r.code, "RT_E_VALIDATION");
        assert.match(r.error ?? "", /deepseek-v4-typo/, "the refused id is named verbatim");
        assert.match(r.error ?? "", /deepseek-v4-flash/, "the known ids ride along");
      }
      assert.equal(f.calls(), 0, "the refusal precedes any network I/O — never a vendor round-trip");
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("the gate is THIS module's REQUEST list (incl. the forward-compat vision-exp id), not the registry's narrower verified set", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const captureModelFetch = (async (_url: unknown, init?: RequestInit) => {
      if (typeof init?.body === "string") {
        bodies.push(JSON.parse(init.body) as Record<string, unknown>);
      }
      return new Response(
        JSON.stringify({
          model: "deepseek-v4-flash",
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    withKey(KEY);
    try {
      const r = await completeDeepSeek("hi", {
        model: "deepseek-v4-flash-vision-exp" as LlmModel,
        fetch: captureModelFetch,
      });
      assert.equal(r.ok, true, "the forward-compat request id passes the provider gate");
      assert.equal(
        bodies[0]?.model,
        "deepseek-v4-flash-vision-exp",
        "the requested id is what actually rides the wire (no substitution)",
      );
    } finally {
      withKey(SAVE_KEY);
    }
  });
});

// ---------------------------------------------------------------------------
// R4-f02 (W29 · LANE P) — the call tap's PROMISE channel: regression pin for
// the W26 H3 containment (fixes/266). `run-eval.test.mjs` installs only a
// SYNC-throwing tap; this pin covers the ASYNC channel (an `async` tap is
// assignable to the `=> void` type), so a refactor that drops the
// `.then(undefined, …)` containment leaves a floating rejection — which
// node:test turns into a RED here (the whole point of the pin).
// ---------------------------------------------------------------------------

describe("the call tap's promise channel (R4-f02 · W26 H3 containment)", () => {
  it("an ASYNC-rejecting tap cannot reach the observed call — the refusal survives and no unhandled rejection fires", async () => {
    withKey(undefined); // keyless: the not-configured refusal must still be the observed result
    try {
      setLlmCallTap(async () => {
        throw new Error("async tap boom");
      });
      const r = await completeDeepSeek("hi");
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, "RT_E_LLM_NOT_CONFIGURED");
      // Give a floating rejection a full turn to surface: node:test fails the
      // test file on an unhandled rejection, so WITHOUT the containment this
      // await is where the red becomes visible.
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      clearLlmCallTap(); // back to the byte-identical no-op path
      withKey(SAVE_KEY);
    }
  });
});
