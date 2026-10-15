import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { tavilySearch } from "./tavily.server.ts";
import {
  normalizeSourceUrl,
  rankResearchItems,
  relevanceScore,
  RESEARCH_RELEVANCE_FLOOR,
} from "./research.ts";

const KEY = "TAVILY_API_KEY";

function abortError(): Error {
  return Object.assign(new Error("The operation was aborted"), {
    name: "AbortError",
  });
}

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  delete process.env[KEY];
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env[KEY];
});

describe("research", () => {
  it("returns not-configured with RT_E_RESEARCH_UNAVAILABLE when the key is absent", async () => {
    const result = await tavilySearch("deepseek models");
    assert.deepEqual(result, {
      ok: false,
      reason: "not-configured",
      code: "RT_E_RESEARCH_UNAVAILABLE",
    });
  });

  it("parses a successful search into items and echoes the query", async () => {
    process.env[KEY] = "tvly-test";
    globalThis.fetch = (async () =>
      okResponse({
        query: "deepseek models",
        results: [
          { title: "A", url: "https://a.example", content: "body A", score: 0.9 },
          { title: "B", url: "https://b.example", content: "body B" },
        ],
      })) as typeof fetch;

    const result = await tavilySearch("deepseek models");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.query, "deepseek models");
      assert.equal(result.items.length, 2);
      // RapidTool's own comparable score replaces the vendor's per-hit score;
      // neither hit shares a term with the query, so both score 0 and the
      // provider order is preserved (stable sort).
      assert.deepEqual(result.items[0], {
        title: "A",
        url: "https://a.example",
        content: "body A",
        score: 0,
      });
      assert.deepEqual(result.items[1], {
        title: "B",
        url: "https://b.example",
        content: "body B",
        score: 0,
      });
    }
  });

  it("sends the key as a Bearer authorization header (not a scrubbed placeholder)", async () => {
    process.env[KEY] = "tvly-test";
    const captured: { headers?: Headers } = {};
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      captured.headers = new Headers(init?.headers);
      return okResponse({ results: [] });
    }) as typeof fetch;

    const result = await tavilySearch("deepseek models");
    assert.equal(result.ok, true);
    assert.equal(
      captured.headers?.get("authorization"),
      "Bearer tvly-test",
      "the Tavily API rejects anything but a real Bearer scheme",
    );
  });

  it("forwards maxResults as max_results", async () => {
    process.env[KEY] = "tvly-test";
    const captured: { body: unknown } = { body: {} };
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body));
      return okResponse({ results: [] });
    }) as typeof fetch;

    const result = await tavilySearch("deepseek models", { maxResults: 3 });
    assert.equal(result.ok, true);
    const body = captured.body as { max_results?: unknown };
    assert.equal(body.max_results, 3);
  });

  it("maps a 401 to the coded key-rejected refusal", async () => {
    process.env[KEY] = "tvly-bad";
    globalThis.fetch = (async () =>
      okResponse({ detail: { error: "Unauthorized: missing or invalid API key." } }, 401)) as typeof fetch;

    const result = await tavilySearch("deepseek models");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "error");
      assert.equal(result.code, "RT_E_LLM_KEY_REJECTED", "a rejected key is its own coded class");
      assert.match(result.error ?? "", /invalid|revoked/i);
      assert.match(result.error ?? "", /TAVILY_API_KEY/);
    }
  });

  it("sends the documented search_depth/topic, defaulting to basic/general", async () => {
    process.env[KEY] = "tvly-test";
    const bodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return okResponse({ results: [] });
    }) as typeof fetch;

    await tavilySearch("deepseek models");
    await tavilySearch("deepseek models", { searchDepth: "advanced", topic: "news" });
    assert.equal(bodies[0].search_depth, "basic");
    assert.equal(bodies[0].topic, "general");
    assert.equal(bodies[1].search_depth, "advanced");
    assert.equal(bodies[1].topic, "news");
  });

  it("reranks Tavily results by relevance to the query", async () => {
    process.env[KEY] = "tvly-test";
    globalThis.fetch = (async () =>
      okResponse({
        results: [
          { title: "Celebration cakes", url: "https://cakes.example/x", content: "luxury cake", score: 0.99 },
          { title: "Invoice tracker", url: "https://tools.example/invoice", content: "track invoices", score: 0.2 },
        ],
      })) as typeof fetch;

    const result = await tavilySearch("invoice tracker");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.items[0].title, "Invoice tracker");
      assert.ok(result.items[0].score! > result.items[1].score!);
    }
  });

  it("dedupes Tavily results by normalized URL", async () => {
    process.env[KEY] = "tvly-test";
    globalThis.fetch = (async () =>
      okResponse({
        results: [
          { title: "First", url: "https://example.com/page", content: "a" },
          { title: "Dup", url: "https://www.example.com/page/?utm_source=x", content: "b" },
        ],
      })) as typeof fetch;

    const result = await tavilySearch("example");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].title, "First");
    }
  });

  it("maps a timeout to a typed error result", async () => {
    process.env[KEY] = "tvly-test";
    globalThis.fetch = (async () => {
      throw abortError();
    }) as typeof fetch;

    const result = await tavilySearch("deepseek models");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "error");
      assert.equal(result.code, "RT_E_RESEARCH_UNAVAILABLE");
      assert.match(result.error ?? "", /timed out/i);
    }
  });

  it("rejects an empty query with RT_E_VALIDATION and no network call", async () => {
    process.env[KEY] = "tvly-test";
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches++;
      return okResponse({ results: [] });
    }) as typeof fetch;

    for (const bad of ["", "   ", "\n\t"]) {
      const result = await tavilySearch(bad);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.reason, "error");
        assert.equal(result.code, "RT_E_VALIDATION");
        assert.match(result.error ?? "", /empty/i);
      }
    }
    assert.equal(fetches, 0);
  });

  it("retries a transient network error once, then succeeds", async () => {
    process.env[KEY] = "tvly-test";
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls === 1) throw new TypeError("fetch failed: network down");
      return okResponse({
        results: [{ title: "A", url: "https://a.example", content: "body A" }],
      });
    }) as typeof fetch;

    const result = await tavilySearch("deepseek models");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.items.length, 1);
    assert.equal(calls, 2);
  });

  it("reports an exhausted network retry honestly with RT_E_RESEARCH_UNAVAILABLE", async () => {
    process.env[KEY] = "tvly-test";
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new TypeError("fetch failed: network down");
    }) as typeof fetch;

    const result = await tavilySearch("deepseek models");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "error");
      assert.equal(result.code, "RT_E_RESEARCH_UNAVAILABLE");
      assert.match(result.error ?? "", /failed/i);
    }
    assert.equal(calls, 2); // exactly one retry — bounded, not a hammer loop
  });

  it("drops entries with no usable URL so nothing uncitable is surfaced", async () => {
    process.env[KEY] = "tvly-test";
    globalThis.fetch = (async () =>
      okResponse({
        results: [
          { title: "no anchor", content: "cannot be cited honestly" },
          { title: "Good hit", url: "https://good.example/doc", content: "citable" },
          { url: "https://bare.example/doc" },
        ],
      })) as typeof fetch;

    const result = await tavilySearch("deepseek models");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.items.length, 2);
      assert.deepEqual(result.items[0], {
        title: "Good hit",
        url: "https://good.example/doc",
        content: "citable",
        score: 0,
      });
      assert.deepEqual(result.items[1], {
        title: "",
        url: "https://bare.example/doc",
        content: "",
        score: 0,
      });
    }
  });

  it("maps a malformed 200 body (no results array) to a coded error", async () => {
    process.env[KEY] = "tvly-test";
    globalThis.fetch = (async () => okResponse({ unexpected: true })) as typeof fetch;

    const result = await tavilySearch("deepseek models");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "error");
      assert.equal(result.code, "RT_E_RESEARCH_UNAVAILABLE");
      assert.match(result.error ?? "", /no results array/);
    }
  });
});

describe("research ranking helpers (pure)", () => {
  it("normalizeSourceUrl strips www, fragment, trailing slash and tracking params", () => {
    assert.equal(
      normalizeSourceUrl("https://WWW.Example.com/page/?utm_source=x&id=2#frag"),
      "https://example.com/page?id=2",
    );
    // Unparseable input never throws.
    assert.equal(normalizeSourceUrl("not a url"), "not a url");
  });

  it("relevanceScore weights title > url > content and stays in [0,1]", () => {
    const titleHit = relevanceScore("invoice tracker", {
      title: "Invoice tracker",
      url: "https://x.example/a",
      content: "",
    });
    const urlHit = relevanceScore("invoice tracker", {
      title: "Unrelated",
      url: "https://x.example/invoice-tracker",
      content: "",
    });
    const contentHit = relevanceScore("invoice tracker", {
      title: "Unrelated",
      url: "https://x.example/a",
      content: "we offer an invoice tracker",
    });
    assert.equal(titleHit, 1);
    assert.ok(titleHit > urlHit && urlHit > contentHit && contentHit > 0);
    assert.equal(relevanceScore("invoice tracker", { title: "cakes", url: "https://c.example", content: "cake" }), 0);
    assert.equal(relevanceScore("", { title: "anything", url: "https://a.example", content: "" }), 0);
  });

  it("the shared relevance floor separates a body-only generic-term hit from a real one", () => {
    // Measured (item 3): on an 8-term phase query a single BODY match weights
    // 1/(3·8) = 0.042 — below the floor — while every on-intent source in the
    // ten-brief probe scored ≥ 0.167. The floor is the narrative's own.
    assert.equal(RESEARCH_RELEVANCE_FLOOR, 0.15);
    const query = "architecture feasibility 2026 sky hopper jump game score";
    const bodyOnly = relevanceScore(query, {
      title: "Pixar",
      url: "https://en.wikipedia.org/wiki/Pixar",
      content: "The studio's animated feature won a musical score award.",
    });
    const titleHit = relevanceScore(query, {
      title: "Sky Hopper game tutorial",
      url: "https://example.com/x",
      content: "",
    });
    assert.ok(bodyOnly < RESEARCH_RELEVANCE_FLOOR, `body-only ${bodyOnly} must fall below the floor`);
    assert.ok(titleHit >= RESEARCH_RELEVANCE_FLOOR, `title hit ${titleHit} must clear the floor`);
  });

  it("rankResearchItems drops non-http, dedupes, scores and caps", () => {
    const ranked = rankResearchItems(
      "invoice",
      [
        { title: "Not a url", url: "javascript:void(0)", content: "" },
        { title: "Invoice app", url: "https://a.example/invoice", content: "" },
        { title: "Invoice dup", url: "https://www.a.example/invoice/?utm_campaign=z", content: "" },
        { title: "Other", url: "https://b.example/other", content: "" },
      ],
      2,
    );
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].title, "Invoice app");
    assert.ok(ranked[0].score! >= ranked[1].score!);
    assert.ok(typeof ranked[0].score === "number");
  });
});
