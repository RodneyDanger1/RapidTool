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
import { callModel } from "./registry.ts";

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

// ---------------------------------------------------------------------------
// 346 V2 (served-provider provenance): EVERY `callModel` result names the
// provider that handled (or would have handled) the call, so a provider switch
// or a `content_filter` stop cannot masquerade as a model failure. Keyless:
// injected fetch; no network touched.
// ---------------------------------------------------------------------------
describe("V-2 — served-provider provenance rides every registry result", () => {
  function withProviderEnv<T>(fn: () => Promise<T>): Promise<T> {
    const prev = process.env.RAPIDTOOL_PROVIDER;
    delete process.env.RAPIDTOOL_PROVIDER;
    return fn().finally(() => {
      if (prev === undefined) delete process.env.RAPIDTOOL_PROVIDER;
      else process.env.RAPIDTOOL_PROVIDER = prev;
    });
  }

  it("stamps servedProvider on success and on a content_filter refusal", async () => {
    withKey("sk-prov");
    try {
      await withProviderEnv(async () => {
        const ok = await callModel("main", "hi", {
          fetch: bodyFetch([{ content: "hi", finish: "stop", usage: { prompt_tokens: 3, completion_tokens: 1 } }]).fetch,
          sleep: sleeping().sleep,
          random: () => 1,
        });
        assert.equal(ok.ok, true);
        assert.equal(ok.servedProvider, "deepseek");

        const filtered = await callModel("main", "hi", {
          fetch: bodyFetch([{ content: "", finish: "content_filter" }]).fetch,
          sleep: sleeping().sleep,
          random: () => 1,
        });
        assert.equal(filtered.ok, false);
        assert.equal(filtered.servedProvider, "deepseek", "a filtered stop names the provider, not a model failure");
        if (!filtered.ok) assert.equal(filtered.code, "RT_E_LLM_REJECTED");
      });
    } finally {
      withKey(SAVE_KEY);
    }
  });

  it("never omits the field: the keyless refusal and an unknown explicit id still carry it", async () => {
    withKey(undefined);
    try {
      await withProviderEnv(async () => {
        const keyless = await callModel("main", "hi");
        assert.equal(keyless.ok, false);
        assert.equal(keyless.servedProvider, "deepseek", "the tier provider is named even keyless");

        withKey("sk-prov");
        const bad = await callModel("main", "hi", { model: "gpt-9" });
        assert.equal(bad.ok, false);
        assert.equal(bad.servedProvider, "deepseek", "a valid role names its tier provider even on a validation refusal");
        if (!bad.ok) assert.equal(bad.code, "RT_E_VALIDATION");
      });
    } finally {
      withKey(SAVE_KEY);
    }
  });
});

// ---------------------------------------------------------------------------
// 346 V5 (candidate accounting): the bounded P6 resample issues extra provider
// calls per chunk, so the call tap must observe EVERY candidate exactly once —
// no dropped candidate, no double-count — and a REFUSED candidate must still
// carry the vendor's measured cost (a truncation/thinking-burn billed tokens
// even though no text came back). The vendor reports `usage` on a 200 body, so
// the empty-content refusals must forward it (`accountSynthUsage` records every
// response that reports usage, success or refusal; the tap feeds run-eval's
// `llmEvidenceFromCallRecords`). Keyless: injected fetch.
// ---------------------------------------------------------------------------
describe("candidate accounting — every resample call observed, refusals priced", () => {
  it("three candidate calls emit exactly three tap records in order (no drop, no double-count)", async () => {
    withKey("sk-cand");
    const f = bodyFetch([
      { content: "a", finish: "stop", usage: { prompt_tokens: 1, completion_tokens: 1 } },
      { content: "b", finish: "stop", usage: { prompt_tokens: 2, completion_tokens: 2 } },
      { content: "c", finish: "stop", usage: { prompt_tokens: 3, completion_tokens: 3 } },
    ]);
    const seen: LlmCallTapRecord[] = [];
    setLlmCallTap((rec) => seen.push(rec));
    try {
      for (const prompt of ["p1", "p2", "p3"]) {
        const r = await completeDeepSeek(prompt, { fetch: f.fetch, sleep: sleeping().sleep, random: () => 1 });
        assert.equal(r.ok, true);
      }
      assert.equal(seen.length, 3, "one tap record per candidate call (never a drop)");
      assert.deepEqual(
        seen.map((r) => r.promptTokens),
        [1, 2, 3],
        "each candidate's measured prompt tokens, in call order (never a double-count)",
      );
    } finally {
      clearLlmCallTap();
      withKey(SAVE_KEY);
    }
  });

  it("a content_filter refusal still emits one record carrying its code and the measured cost", async () => {
    withKey("sk-cand");
    const f = bodyFetch([
      { content: "", finish: "content_filter", usage: { prompt_tokens: 5, completion_tokens: 0 } },
    ]);
    const seen: LlmCallTapRecord[] = [];
    setLlmCallTap((rec) => seen.push(rec));
    try {
      const r = await completeDeepSeek("hi", { fetch: f.fetch, sleep: sleeping().sleep, random: () => 1 });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, "RT_E_LLM_REJECTED");
      assert.equal(seen.length, 1, "a refused candidate is still an observed call (cost recorded, not dropped)");
      assert.equal(seen[0]!.ok, false);
      assert.equal(seen[0]!.code, "RT_E_LLM_REJECTED");
      assert.equal(seen[0]!.promptTokens, 5, "the refusal's measured prompt tokens ride the record");
    } finally {
      clearLlmCallTap();
      withKey(SAVE_KEY);
    }
  });

  it("an empty-content length truncation reports the vendor's burned tokens (resample candidate priced)", async () => {
    withKey("sk-cand");
    const f = bodyFetch([
      { content: "", finish: "length", usage: { prompt_tokens: 9, completion_tokens: 32_000 } },
    ]);
    const seen: LlmCallTapRecord[] = [];
    setLlmCallTap((rec) => seen.push(rec));
    try {
      const r = await completeDeepSeek("synthesize", { fetch: f.fetch, sleep: sleeping().sleep, random: () => 1 });
      assert.equal(r.ok, false, "no text ⇒ refusal");
      assert.deepEqual(
        r.usage,
        { promptTokens: 9, completionTokens: 32_000 },
        "the truncated candidate's measured usage is not discarded by the refusal path",
      );
      assert.equal(seen[0]!.promptTokens, 9);
      assert.equal(seen[0]!.completionTokens, 32_000);
    } finally {
      clearLlmCallTap();
      withKey(SAVE_KEY);
    }
  });

  it("the cache split rides each candidate's record, refusals included", async () => {
    withKey("sk-cand");
    const f = bodyFetch([
      { content: "ok", finish: "stop", usage: { prompt_tokens: 10, completion_tokens: 2, prompt_cache_hit_tokens: 7, prompt_cache_miss_tokens: 3 } },
      { content: "", finish: "length", usage: { prompt_tokens: 20, completion_tokens: 40, prompt_cache_hit_tokens: 15, prompt_cache_miss_tokens: 5 } },
    ]);
    const seen: LlmCallTapRecord[] = [];
    setLlmCallTap((rec) => seen.push(rec));
    try {
      await completeDeepSeek("a", { fetch: f.fetch, sleep: sleeping().sleep, random: () => 1 });
      await completeDeepSeek("b", { fetch: f.fetch, sleep: sleeping().sleep, random: () => 1 });
      assert.equal(seen.length, 2);
      assert.deepEqual(
        seen.map((r) => r.cachedPromptTokens),
        [7, 15],
        "the cache-hit split is per-candidate, including the refused one",
      );
    } finally {
      clearLlmCallTap();
      withKey(SAVE_KEY);
    }
  });
});
