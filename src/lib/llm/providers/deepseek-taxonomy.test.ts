// ---------------------------------------------------------------------------
// deepseek-taxonomy.test.ts — W61 lane D (D4 / D5; research/deepseek-api.md §5).
//
// Pins the finish_reason taxonomy the provider's build-agent parser contract
// names — `stop | length | content_filter | tool_calls | insufficient_system_resource`:
//   · content_filter             → non-retry, coded refusal naming the reason
//   · insufficient_system_resource → transient: retried with the SAME
//     full-jitter policy (bounded at MAX_ATTEMPTS), then refused honestly
// and the D5 context-cache telemetry carry (`prompt_cache_hit_tokens` →
// `cachedPromptTokens` on the call tap record — the field A8's cache fix reads).
//
// Keyless: an injected fetch serves controlled bodies; no network is touched.
// Run: node --experimental-strip-types --test src/lib/llm/providers/deepseek-taxonomy.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyFinishReason,
  clearLlmCallTap,
  completeDeepSeek,
  finishReasonOf,
  setLlmCallTap,
  type LlmCallTapRecord,
} from "./deepseek.ts";

const SAVE_KEY = process.env.DEEPSEEK_API_KEY;

function withKey(key: string | undefined): void {
  if (key === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = key;
}

type Body = { content?: string; finish?: string; usage?: Record<string, number> };

/** A fetch serving `bodies` in order (the last repeats) as HTTP 200 chat bodies. */
function bodyFetch(bodies: Body[]): { fetch: typeof fetch; calls: () => number } {
  let i = 0;
  let n = 0;
  const fn = (async () => {
    n += 1;
    const b = bodies[Math.min(i, bodies.length - 1)]!;
    if (bodies.length > 0) i += 1;
    const payload: Record<string, unknown> = {
      model: "deepseek-v4-flash",
      choices: [{ message: { content: b.content ?? "" }, finish_reason: b.finish ?? "stop" }],
    };
    if (b.usage) payload.usage = b.usage;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { fetch: fn, calls: () => n };
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

describe("classifyFinishReason / finishReasonOf (pure taxonomy)", () => {
  it("classifies every documented finish_reason and defaults unknown/absent to other", () => {
    for (const r of ["stop", "length", "content_filter", "tool_calls", "insufficient_system_resource"] as const) {
      assert.equal(classifyFinishReason(r), r);
    }
    assert.equal(classifyFinishReason("weird"), "other");
    assert.equal(classifyFinishReason(undefined), "other");
    assert.equal(classifyFinishReason(null), "other");
    assert.equal(classifyFinishReason(7), "other");
  });

  it("reads finish_reason from a raw body and is total on garbage", () => {
    assert.equal(finishReasonOf('{"choices":[{"finish_reason":"content_filter"}]}'), "content_filter");
    assert.equal(finishReasonOf('{"choices":[]}'), null);
    assert.equal(finishReasonOf("not json"), null);
    assert.equal(finishReasonOf(""), null);
    assert.equal(finishReasonOf("42"), null);
  });
});

describe("completeDeepSeek finish_reason handling", () => {
  it("content_filter is a NON-retry coded refusal naming the reason (one call)", async () => {
    withKey("sk-taxonomy");
    const f = bodyFetch([{ content: "", finish: "content_filter" }]);
    try {
      const r = await completeDeepSeek("hi", { fetch: f.fetch, sleep: sleeping().sleep, random: () => 1 });
      assert.equal(r.ok, false);
      if (r.ok) return;
      assert.equal(r.code, "RT_E_LLM_REJECTED");
      assert.match(r.error ?? "", /content_filter/);
      assert.equal(f.calls(), 1, "a filtered reply is never retried");
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("insufficient_system_resource is retried with the full-jitter policy, then succeeds", async () => {
    withKey("sk-taxonomy");
    const f = bodyFetch([
      { content: "", finish: "insufficient_system_resource" },
      { content: "recovered", finish: "stop" },
    ]);
    const s = sleeping();
    try {
      const r = await completeDeepSeek("hi", { fetch: f.fetch, sleep: s.sleep, random: () => 1 });
      assert.equal(r.ok, true);
      if (!r.ok) return;
      assert.equal(r.text, "recovered");
      assert.equal(f.calls(), 2, "one retry after the capacity interruption");
      assert.equal(s.delays().length, 1, "exactly one jittered backoff wait");
      assert.equal(s.delays()[0], 1000, "attempt-1 jittered cap (random=1 → 500·2^1)");
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("a persistent capacity interruption is refused after the bounded retries", async () => {
    withKey("sk-taxonomy");
    const f = bodyFetch([{ content: "", finish: "insufficient_system_resource" }]);
    const s = sleeping();
    try {
      const r = await completeDeepSeek("hi", { fetch: f.fetch, sleep: s.sleep, random: () => 1 });
      assert.equal(r.ok, false);
      if (r.ok) return;
      assert.equal(f.calls(), 3, "bounded at MAX_ATTEMPTS");
      assert.match(r.error ?? "", /insufficient_system_resource/);
      assert.equal(r.code, "RT_E_LLM_REJECTED");
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("D5: the context-cache split rides the call-tap record (feeds the cache fix)", async () => {
    withKey("sk-taxonomy");
    const f = bodyFetch([
      { content: "ok", finish: "stop", usage: { prompt_tokens: 10, completion_tokens: 2, prompt_cache_hit_tokens: 7, prompt_cache_miss_tokens: 3 } },
    ]);
    const seen: LlmCallTapRecord[] = [];
    setLlmCallTap((rec) => seen.push(rec));
    try {
      const r = await completeDeepSeek("hi", { fetch: f.fetch, sleep: sleeping().sleep, random: () => 1 });
      assert.equal(r.ok, true);
      assert.equal(seen.length, 1, "one tap record per call");
      assert.equal(seen[0]!.cachedPromptTokens, 7, "prompt_cache_hit_tokens is carried to the tap");
      assert.equal(seen[0]!.cacheMissTokens, 3, "prompt_cache_miss_tokens is carried too");
    } finally {
      clearLlmCallTap();
      withKey(SAVE_KEY);
    }
  });
});
