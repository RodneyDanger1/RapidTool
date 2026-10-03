import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { freeWebSearch, type SearchFetch } from "./websearch.server.ts";

// 327 (L2): the transport is injected per call (`fetchImpl`) instead of stubbing
// `globalThis.fetch` — production uses node:https, so the global fetch stub no
// longer intercepts provider calls.

function htmlResponse(html: string): Response {
  return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
}
function jsonResponse(obj: unknown): Response {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// No backoff delay so tests don't sleep; attempts still exercise the retry loop.
const FAST = { attempts: 2, backoffMs: 0 };

describe("freeWebSearch", () => {
  it("parses DuckDuckGo lite HTML into titled results with decoded URLs", async () => {
    const fetchImpl = (async (url: unknown) => {
      if (String(url).includes("duckduckgo")) {
        return htmlResponse(
          `<a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage&amp;rut=x" class='result-link'>Example &amp; Co</a>` +
            `<td class='result-snippet'>A <b>great</b> example snippet.</td>`,
        );
      }
      return jsonResponse({ query: { search: [] } });
    }) as SearchFetch;

    const res = await freeWebSearch("example", { ...FAST, fetchImpl });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.provider, "duckduckgo");
      assert.equal(res.items.length, 1);
      assert.equal(res.items[0].title, "Example & Co");
      assert.equal(res.items[0].url, "https://example.com/page");
      assert.equal(res.items[0].content, "A great example snippet.");
    }
  });

  it("dedupes results by normalized URL (www, trailing slash, tracking params)", async () => {
    const fetchImpl = (async (url: unknown) => {
      if (String(url).includes("duckduckgo")) {
        return htmlResponse(
          `<a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage&amp;rut=1">First</a>` +
            `<a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.example.com%2Fpage%2F&amp;rut=2">Duplicate</a>` +
            `<a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage%3Futm_source%3Dx&amp;rut=3">Also duplicate</a>` +
            `<td class='result-snippet'>S1</td><td class='result-snippet'>S2</td><td class='result-snippet'>S3</td>`,
        );
      }
      return jsonResponse({ query: { search: [] } });
    }) as SearchFetch;

    const res = await freeWebSearch("dupe", { ...FAST, fetchImpl });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.provider, "duckduckgo");
      assert.equal(res.items.length, 1);
      assert.equal(res.items[0].title, "First");
    }
  });

  it("retries a transient 429 once before succeeding", async () => {
    let ddgCalls = 0;
    const fetchImpl = (async (url: unknown) => {
      if (String(url).includes("duckduckgo")) {
        ddgCalls++;
        if (ddgCalls === 1) return new Response("rate limited", { status: 429 });
        return htmlResponse(
          `<a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fretry&amp;x=1">Retry</a><td class='result-snippet'>retried ok</td>`,
        );
      }
      return jsonResponse({ query: { search: [] } });
    }) as SearchFetch;

    const res = await freeWebSearch("retry", { ...FAST, fetchImpl });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.provider, "duckduckgo");
      assert.equal(res.items[0].url, "https://example.com/retry");
    }
    assert.equal(ddgCalls, 2);
  });

  it("falls back to SearXNG when DuckDuckGo yields no results", async () => {
    const fetchImpl = (async (url: unknown) => {
      const u = String(url);
      if (u.includes("duckduckgo")) {
        return htmlResponse("<html><body>no results</body></html>");
      }
      if (u.includes("searx")) {
        return jsonResponse({
          results: [
            { title: "SearXNG hit", url: "https://news.example/story", content: "A <b>news</b> story." },
          ],
        });
      }
      return jsonResponse({ query: { search: [] } });
    }) as SearchFetch;

    const res = await freeWebSearch("searxng", { ...FAST, fetchImpl });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.provider, "searxng");
      assert.equal(res.items[0].title, "SearXNG hit");
      assert.equal(res.items[0].url, "https://news.example/story");
      assert.equal(res.items[0].content, "A news story.");
    }
  });

  it("falls back to Wikipedia when DuckDuckGo and SearXNG yield no results", async () => {
    const fetchImpl = (async (url: unknown) => {
      const u = String(url);
      if (u.includes("duckduckgo")) {
        return htmlResponse("<html><body>no results</body></html>");
      }
      if (u.includes("searx")) {
        return jsonResponse({ results: [] });
      }
      return jsonResponse({
        query: {
          search: [
            {
              title: "Logistics automation",
              snippet: "The <span class='searchmatch'>application</span> of software.",
            },
          ],
        },
      });
    }) as SearchFetch;

    const res = await freeWebSearch("logistics", { ...FAST, fetchImpl });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.provider, "wikipedia");
      assert.equal(res.items[0].title, "Logistics automation");
      assert.equal(res.items[0].url, "https://en.wikipedia.org/wiki/Logistics_automation");
      assert.equal(res.items[0].content, "The application of software.");
    }
  });

  it("a non-string Wikipedia title is hardened, never a TypeError that kills the last-resort provider", async () => {
    const fetchImpl = (async (url: unknown) => {
      const u = String(url);
      if (u.includes("duckduckgo")) return htmlResponse("no results");
      if (u.includes("searx")) return jsonResponse({ results: [] });
      if (u.includes("prop=extracts")) return jsonResponse({ query: { pages: {} } });
      // Hostile shape: a present title that is not a string. The sibling field
      // read (`snippet`) is already guarded; the URL derivation must be too.
      return jsonResponse({ query: { search: [{ title: 42, snippet: "s" }] } });
    }) as SearchFetch;

    const res = await freeWebSearch("logistics", { ...FAST, fetchImpl });
    assert.equal(res.ok, true, "the Wikipedia provider must survive a malformed title");
    if (res.ok) {
      assert.equal(res.provider, "wikipedia");
      assert.equal(res.items[0].title, "");
    }
  });

  it("enriches the top Wikipedia hits with their real intro extract", async () => {
    const fetchImpl = (async (url: unknown) => {
      const u = String(url);
      if (u.includes("duckduckgo")) return htmlResponse("no results");
      if (u.includes("searx")) return jsonResponse({ results: [] });
      if (u.includes("prop=extracts")) {
        return jsonResponse({
          query: {
            pages: { "12345": { extract: "Logistics automation is the application of software to coordinate the flow of goods." } },
          },
        });
      }
      return jsonResponse({
        query: {
          search: [{ title: "Logistics automation", snippet: "Short <b>snippet</b>." }],
        },
      });
    }) as SearchFetch;

    const res = await freeWebSearch("logistics", { ...FAST, fetchImpl });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.provider, "wikipedia");
      assert.equal(
        res.items[0].content,
        "Logistics automation is the application of software to coordinate the flow of goods.",
      );
    }
  });

  it("returns an honest coded error when all providers are unavailable", async () => {
    const fetchImpl = (async () => {
      throw new Error("network down");
    }) as SearchFetch;
    const res = await freeWebSearch("anything", { ...FAST, fetchImpl });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.code, "RT_E_RESEARCH_UNAVAILABLE");
      assert.match(res.error ?? "", /all providers failed/i);
      assert.match(res.error ?? "", /network down/, "root-cause detail must surface");
    }
  });

  it("returns an honest coded error when providers return zero results", async () => {
    const fetchImpl = (async (url: unknown) => {
      const u = String(url);
      if (u.includes("duckduckgo")) return htmlResponse("<html><body>no results</body></html>");
      if (u.includes("searx")) return jsonResponse({ results: [] });
      return jsonResponse({ query: { search: [] } });
    }) as SearchFetch;
    const res = await freeWebSearch("nothing-here", { ...FAST, fetchImpl });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.code, "RT_E_RESEARCH_UNAVAILABLE");
      assert.match(res.error ?? "", /returned no results/i);
    }
  });

  it("rejects an empty query with RT_E_VALIDATION and never fetches", async () => {
    let fetches = 0;
    const fetchImpl = (async () => {
      fetches++;
      return htmlResponse("<html></html>");
    }) as SearchFetch;
    for (const bad of ["", "   ", "\n\t"]) {
      const res = await freeWebSearch(bad, { ...FAST, fetchImpl });
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.reason, "error");
        assert.equal(res.code, "RT_E_VALIDATION");
        assert.match(res.error ?? "", /empty/i);
      }
    }
    assert.equal(fetches, 0);
  });

  it("retries a transient network error exactly once before succeeding", async () => {
    let ddgCalls = 0;
    const fetchImpl = (async (url: unknown) => {
      if (String(url).includes("duckduckgo")) {
        ddgCalls++;
        if (ddgCalls === 1) throw new TypeError("fetch failed: network down");
        return htmlResponse(
          `<a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fflaky&amp;x=1">Flaky ok</a><td class='result-snippet'>recovered</td>`,
        );
      }
      return jsonResponse({ query: { search: [] } });
    }) as SearchFetch;

    const res = await freeWebSearch("flaky", { ...FAST, fetchImpl });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.provider, "duckduckgo");
      assert.equal(res.items[0].url, "https://example.com/flaky");
    }
    assert.equal(ddgCalls, 2);
  });

  it("gives up after the bounded attempt count on a persistent network error", async () => {
    let ddgCalls = 0;
    const fetchImpl = (async (url: unknown) => {
      if (String(url).includes("duckduckgo")) {
        ddgCalls++;
        throw new TypeError("fetch failed: network down");
      }
      return jsonResponse({ query: { search: [] } });
    }) as SearchFetch;

    const res = await freeWebSearch("flaky", { attempts: 1, backoffMs: 0, fetchImpl });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "RT_E_RESEARCH_UNAVAILABLE");
    assert.equal(ddgCalls, 1, "attempts:1 must mean exactly one fetch");
  });
});
