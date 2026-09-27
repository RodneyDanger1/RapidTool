import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { tavilySearch } from "./tavily.server.ts";

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
      assert.deepEqual(result.items[0], {
        title: "A",
        url: "https://a.example",
        content: "body A",
        score: 0.9,
      });
      assert.deepEqual(result.items[1], {
        title: "B",
        url: "https://b.example",
        content: "body B",
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

  it("maps a 401 to a typed error result", async () => {
    process.env[KEY] = "tvly-bad";
    globalThis.fetch = (async () =>
      okResponse({ detail: { error: "Unauthorized: missing or invalid API key." } }, 401)) as typeof fetch;

    const result = await tavilySearch("deepseek models");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "error");
      assert.equal(result.code, "RT_E_RESEARCH_UNAVAILABLE");
      assert.match(result.error ?? "", /invalid/i);
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
      });
      assert.deepEqual(result.items[1], {
        title: "",
        url: "https://bare.example/doc",
        content: "",
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
