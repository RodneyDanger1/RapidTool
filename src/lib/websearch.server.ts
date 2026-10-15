/**
 * Keyless free web search (server-only) — no API key required.
 *
 * Three providers, all free and unauthenticated:
 *   1. DuckDuckGo Lite (HTML) — broader web results, scraped server-side.
 *   2. SearXNG (JSON)         — public metasearch instances, broader web.
 *   3. Wikipedia API (JSON)   — clean, reliable, encyclopedic grounding.
 *
 * Every provider fetch is retried (2 attempts, `400ms·2ⁿ` backoff) on transient
 * failures (network/timeout/429/5xx); non-transient HTTP statuses surface
 * immediately. Scraped HTML is entity-decoded and snippets are extracted from
 * the DDG result rows. A wider candidate pool is fetched, then EVERY provider's
 * results are deduped, ranked by query relevance and domain diversity, and
 * scored (`rankResearchItems`) so off-topic vendor-order hits are not shipped as
 * "research". The top Wikipedia hits are enriched with their real intro
 * paragraph via `action=query&prop=extracts&exintro&explaintext`.
 *
 * Honesty caveat: these are free, keyless, best-effort sources with lower
 * fidelity than a paid provider (Tavily is preferred when `TAVILY_API_KEY` is
 * set). This module must never be imported from client code — it is reached
 * only through the `research.ts` server-function boundary.
 *
 * Failure contract (machine-readable): every failure result carries a `code`
 * field — `RT_E_VALIDATION` for an empty query, `RT_E_RESEARCH_UNAVAILABLE`
 * when every provider failed. Results are never fabricated; when nothing can
 * be fetched the result is an honest `{ ok: false, code }` object.
 */

// fixes/347 R1: retrieval ranks + dedupes + scores every provider's results
// through the shared pure helpers in research.ts, so the keyless path no longer
// ships raw vendor order (the off-topic-research defect).
import { rankResearchItems, type ResearchResult } from "./research.ts";
// W40·N4: the shared knob sanitizer (this file used to carry its own copy).
import { boundedInt } from "./bounded-int.ts";
// 327 (L2): the fetch transport is node:https/http with a one-shot (non-pooled)
// agent, not the global undici `fetch`. undici leaves a TLS teardown handle that
// races the CLI's deliberate in-tick `process.exit()` on Node 24/Windows and
// aborts the process (async.c assertion, 0xC0000409) — see `nodeFetch` below.
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

const DDG_LITE = "https://lite.duckduckgo.com/lite/";
const WIKI_API = "https://en.wikipedia.org/w/api.php";

// Public SearXNG instances that still expose `format=json` (best-effort — they
// may throttle or retire). We try each in order and fall through on failure.
const SEARXNG_INSTANCES = [
  "https://searx.be/search",
  "https://searx.tiekoetter.com/search",
  "https://search.bus-hit.me/search",
];

const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 2;
const BASE_BACKOFF_MS = 400;
/** setTimeout's overflow ceiling — Node fires longer delays immediately and
 *  warns; anything at or below this stays a real timer. */
const MAX_TIMER_MS = 2_147_483_647;
/** RapidTool's own max_results ceiling (defensive): a tampered/absurd knob must
 *  never reach a provider asking for thousands of entries. */
const MAX_RESULTS_CEILING = 20;

/** Sanitize a caller knob: finite integer in [min, max], else the fallback.
 *  A hostile/typo'd value (NaN, Infinity, -5, 1e9) never reaches a provider.
 *  W40·N4: moved to the shared `./bounded-int.ts` (byte-identical twin in
 *  tavily.server.ts — one shape, one home). Reported above stays the caller's
 *  contract; the helper never logs. */
const MAX_WIKI_EXTRACTS = 2;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RapidTool/1.0 (keyless-research)";

// Transient statuses get a bounded exponential-backoff retry; anything else
// (e.g. 404) surfaces immediately and lets the next provider take over. The
// gateway statuses 502/504 are transient by nature and join the retry set.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

type FreeItem = { title: string; url: string; content: string };

/** The transport's minimal response shape — a real `Response` satisfies it. */
export type TextResponse = { ok: boolean; status: number; text(): Promise<string> };

/**
 * 327 (L2): the HTTP transport seam. The production default is `nodeFetch`
 * (node:https/http, one-shot agent) — undici's global `fetch` cannot be used
 * here: its TLS teardown handle outlives a completed probe and races the CLI's
 * in-tick `process.exit()` on Node 24/Windows (libuv async.c assertion). Tests
 * inject a fake through `FreeSearchOptions.fetchImpl`.
 */
export type SearchFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<TextResponse>;

/** Test/dev hooks so callers can dial backoff/timeouts (defaults are real). */
export type FreeSearchOptions = {
  maxResults?: number;
  timeoutMs?: number;
  attempts?: number;
  backoffMs?: number;
  /** Override the network transport (tests); production uses `nodeFetch`. */
  fetchImpl?: SearchFetch;
};

type FetchOptions = { timeoutMs: number; attempts: number; backoffMs: number; fetchImpl: SearchFetch };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Decode ONE numeric HTML character reference body (already matched by the
 * `&#(x?[0-9a-fA-F]+);` group, so a leading `x`/`X` selects hex). Out-of-range
 * and surrogate code points fall back to the raw source text — never a throw.
 * Scraped provider HTML routinely escapes apostrophes as `&#x27;`; without
 * this the entity leaks into the snippets the model is grounded on (346 live
 * run: `tenant&#x27;s` reached build.json and the vault).
 */
function decodeNumericEntity(body: string, fallback: string): string {
  const hex = body[0] === "x" || body[0] === "X";
  const cp = parseInt(hex ? body.slice(1) : body, hex ? 16 : 10);
  if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
    return fallback;
  }
  return String.fromCodePoint(cp);
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(x?[0-9a-fA-F]+);/g, (m, body: string) => decodeNumericEntity(body, m))
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bounded redirect hops (fetch follows by default; parity without undici). */
const MAX_HTTP_REDIRECTS = 5;
/** Request headers shared by every provider call. `accept-encoding` is set
 *  explicitly because node:https (unlike fetch) does not add/decode it. */
const REQUEST_HEADERS = {
  "user-agent": UA,
  accept: "text/html,application/json,*/*",
  "accept-encoding": "gzip, deflate, br",
};

/** Decompress a provider body by its `content-encoding` (identity on any
 *  unsupported/corrupt encoding — the bytes are returned verbatim). */
function decodeBody(body: Buffer, encoding: string | string[] | undefined): string {
  const enc = (Array.isArray(encoding) ? encoding[0] : (encoding ?? "")).toLowerCase().trim();
  try {
    if (enc === "gzip" || enc === "x-gzip") return gunzipSync(body).toString("utf8");
    if (enc === "deflate") return inflateSync(body).toString("utf8");
    if (enc === "br") return brotliDecompressSync(body).toString("utf8");
  } catch {
    /* corrupt/unsupported encoding → raw bytes below */
  }
  return body.toString("utf8");
}

/**
 * One provider request over node:https/node:http with `agent: false` — a
 * one-shot connection that is never pooled, so the probe's socket cannot
 * outlive the probe (327 L2; the undici alternative crashes the CLI's in-tick
 * exit on Node 24/Windows). Follows up to `redirectsLeft` redirects; the
 * caller's `signal` aborts every hop (bounded timeout lives in `fetchText`).
 */
function requestText(
  url: string,
  signal: AbortSignal,
  redirectsLeft: number,
): Promise<TextResponse> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    const request = parsed.protocol === "http:" ? httpRequest : httpsRequest;
    const req = request(parsed, { headers: REQUEST_HEADERS, agent: false }, (res) => {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
        res.resume(); // drain the redirect socket so it closes here
        requestText(new URL(location, parsed).toString(), signal, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        const text = decodeBody(Buffer.concat(chunks), res.headers["content-encoding"]);
        resolve({ ok: status >= 200 && status < 300, status, text: async () => text });
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    if (signal.aborted) {
      req.destroy(new Error("aborted"));
      return;
    }
    const onAbort = () => req.destroy(new Error("aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    req.on("close", () => signal.removeEventListener("abort", onAbort));
    req.end();
  });
}

// 327 (L2): the transport seam. Production uses node:https (`requestText`,
// one-shot / never-pooled) because undici's global `fetch` leaves a TLS teardown
// handle that races the CLI's in-tick `process.exit()` on Node 24/Windows —
// libuv async.c assertion + 0xC0000409 (fixes/327_l2_cli_exit.md). Suites outside
// this lane's ownership (e.g. lesson-writers.test.ts) fake the network by
// REPLACING the global `fetch`; `nodeFetch` defers to `globalThis.fetch` whenever
// it is not the reference seen here, so those stubs keep intercepting. Untouched
// global → node:https. (This module is imported lazily, so the reference can be
// captured after a stub was installed; the `.name` guard covers that case — a
// test stub is never the native `fetch`.)
const INITIAL_FETCH = globalThis.fetch;
const CAPTURED_NATIVE = INITIAL_FETCH.name === "fetch";

/** Production transport: bounded, non-pooled node:https/http, unless a caller
 *  replaced the global `fetch` (test seam) — then defer to it. */
const nodeFetch: SearchFetch = (url, init) => {
  const current = globalThis.fetch;
  if (current !== INITIAL_FETCH || !CAPTURED_NATIVE) return current(url, init);
  return requestText(url, init.signal, MAX_HTTP_REDIRECTS);
};

/**
 * Fetch with bounded retry/backoff on transient failures only. A non-transient
 * HTTP status is thrown as `HTTP NNN` and never retried; network failures and
 * aborts/timeouts are retried up to `attempts` times.
 */
async function fetchText(url: string, opts: FetchOptions): Promise<string> {
  let lastError: Error = new Error("fetch failed");
  for (let attempt = 0; attempt < opts.attempts; attempt++) {
    if (attempt > 0) await sleep(opts.backoffMs * 2 ** attempt);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const res = await opts.fetchImpl(url, { headers: REQUEST_HEADERS, signal: controller.signal });
      if (res.ok) return await res.text();
      const err = new Error(`HTTP ${res.status}`);
      if (RETRYABLE_STATUS.has(res.status)) {
        lastError = err; // transient → retry
        continue;
      }
      throw err; // non-transient → surface immediately
    } catch (err) {
      // Only the explicit `HTTP NNN` marker is non-transient; everything else
      // (network error, abort/timeout) is transient and worth a retry.
      if (err instanceof Error && /^HTTP \d+$/.test(err.message)) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function duckDuckGoLite(
  query: string,
  maxResults: number,
  opts: FetchOptions,
): Promise<FreeItem[]> {
  const html = await fetchText(`${DDG_LITE}?q=${encodeURIComponent(query)}`, opts);
  const links: { url: string; title: string }[] = [];
  // Tolerate protocol-relative (`//duckduckgo.com/…`) and absolute
  // (`https://duckduckgo.com/…`) redirector hrefs, and either quote style.
  const linkRe =
    /<a[^>]*href=["'](?:https?:)?\/\/duckduckgo\.com\/l\/\?uddg=([^&"']+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && links.length < maxResults) {
    let url = "";
    try {
      url = decodeURIComponent(m[1]);
    } catch {
      url = m[1];
    }
    if (!/^https?:\/\//.test(url)) continue;
    links.push({ url, title: stripHtml(m[2]) });
  }
  // DDG Lite renders each snippet in its own result row; the row order matches
  // the link order, so index pairing is correct. Accept single- or double-quoted
  // `result-snippet` cells (and the rare `<a>`/`<div>` variant) so a markup
  // tweak upstream does not silently drop every snippet.
  const snippets: string[] = [];
  const snipRe =
    /<(td|a|div)[^>]*class=["']?result-snippet["']?[^>]*>([\s\S]*?)<\/\1>/gi;
  let s: RegExpExecArray | null;
  while ((s = snipRe.exec(html)) && snippets.length < maxResults) {
    snippets.push(stripHtml(s[2]));
  }
  return links.slice(0, maxResults).map((l, i) => ({
    title: l.title,
    url: l.url,
    content: snippets[i] ?? "",
  }));
}

async function searxngSearch(
  query: string,
  maxResults: number,
  opts: FetchOptions,
): Promise<FreeItem[]> {
  let lastError: Error = new Error("SearXNG unavailable");
  for (const base of SEARXNG_INSTANCES) {
    try {
      const raw = await fetchText(
        `${base}?q=${encodeURIComponent(query)}&format=json`,
        opts,
      );
      const body = JSON.parse(raw) as {
        results?: Array<Record<string, unknown>>;
      };
      if (!Array.isArray(body.results) || body.results.length === 0) {
        lastError = new Error("SearXNG returned no results");
        continue;
      }
      const items = body.results
        .slice(0, maxResults)
        // W40·K4: drop non-object entries BEFORE the field reads — a stray
        // `null` in `results` used to throw a TypeError that discarded the
        // whole instance's usable rows instead of being filtered out.
        .filter((r) => r !== null && typeof r === "object")
        .map((r) => ({
          title: typeof r.title === "string" ? stripHtml(r.title) : "",
          url: typeof r.url === "string" ? r.url : "",
          content: typeof r.content === "string" ? stripHtml(r.content) : "",
        }))
        .filter((it) => /^https?:\/\//.test(it.url));
      if (items.length > 0) return items;
      lastError = new Error("SearXNG returned no usable results");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError;
}

async function wikipediaSearch(
  query: string,
  maxResults: number,
  opts: FetchOptions,
): Promise<FreeItem[]> {
  const url = `${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&format=json&srlimit=${maxResults}&origin=*`;
  const raw = await fetchText(url, opts);
  const body = JSON.parse(raw) as {
    query?: { search?: Array<{ title?: string; snippet?: string }> };
  };
  // W40·K4: `search` may be any hostile shape — a non-array is treated as no
  // results, and non-object entries are dropped before the field reads (a
  // stray `null` used to throw a TypeError that failed the whole provider).
  const results = Array.isArray(body.query?.search) ? body.query.search : [];
  return results
    .filter((r) => r !== null && typeof r === "object")
    .slice(0, maxResults)
    .map((r) => {
      // 337-3: guard the title ONCE for both uses — `(r.title ?? "")` returns a
      // non-string value as-is (e.g. a number), so `.replace` threw a TypeError
      // that failed the last-resort Wikipedia provider, inconsistent with the
      // snippet read below and with this function's own hostile-input posture.
      const title = typeof r.title === "string" ? r.title : "";
      return {
        title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
        content: typeof r.snippet === "string" ? stripHtml(r.snippet) : "",
      };
    });
}

function wikipediaTitleFromUrl(url: string): string | null {
  const m = /wikipedia\.org\/wiki\/([^#?]+)/.exec(url);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).replace(/_/g, " ");
  } catch {
    return m[1].replace(/_/g, " ");
  }
}

async function fetchWikipediaExtract(
  title: string,
  opts: FetchOptions,
): Promise<string | null> {
  const url = `${WIKI_API}?action=query&prop=extracts&exintro&explaintext&format=json&redirects=1&titles=${encodeURIComponent(
    title,
  )}&origin=*`;
  const raw = await fetchText(url, opts);
  const body = JSON.parse(raw) as {
    query?: { pages?: Record<string, { extract?: unknown }> };
  };
  const pages = body.query?.pages ?? {};
  for (const key of Object.keys(pages)) {
    if (key === "-1") continue; // missing page marker
    const extract = pages[key]?.extract;
    if (typeof extract === "string" && extract.trim()) return extract.trim();
  }
  return null;
}

/**
 * Replace the search snippet of the top 1–2 Wikipedia hits with their real
 * intro paragraph (`exintro` + `explaintext`). Best-effort: if an extract fetch
 * fails the original snippet is kept.
 */
async function enrichWikipediaExtracts(
  items: FreeItem[],
  opts: FetchOptions,
): Promise<FreeItem[]> {
  const enriched = [...items];
  let enrichedCount = 0;
  for (let i = 0; i < enriched.length && enrichedCount < MAX_WIKI_EXTRACTS; i++) {
    const title = wikipediaTitleFromUrl(enriched[i].url);
    if (!title) continue;
    try {
      const extract = await fetchWikipediaExtract(title, opts);
      if (extract) {
        enriched[i] = { ...enriched[i], content: extract };
        enrichedCount++;
      }
    } catch {
      /* enrichment is best-effort — keep the original snippet */
    }
  }
  return enriched;
}

export async function freeWebSearch(
  query: string,
  opts: FreeSearchOptions = {},
): Promise<ResearchResult> {
  if (typeof query !== "string") {
    return {
      ok: false,
      reason: "error",
      code: "RT_E_VALIDATION",
      error: "search query must be a string",
    };
  }
  const q = query.trim();
  if (!q) {
    return {
      ok: false,
      reason: "error",
      code: "RT_E_VALIDATION",
      error: "empty search query",
    };
  }
  // W40·K4: every knob is sanitized before use — previously a NaN / negative /
  // absurd value rode straight into the provider URLs (srlimit=…) and timers:
  // a non-positive timeoutMs aborted on the first tick, a NaN maxResults made
  // every provider loop match zero entries, and a huge srlimit 400s MediaWiki.
  const maxResults = boundedInt(opts.maxResults, 5, 1, MAX_RESULTS_CEILING);
  // Fetch a wider candidate pool than the caller asked for so the ranker can
  // SELECT the best `maxResults` sources rather than only reorder the top few.
  const pool = Math.min(maxResults * 3, MAX_RESULTS_CEILING);
  const fetchOpts: FetchOptions = {
    timeoutMs: boundedInt(opts.timeoutMs, TIMEOUT_MS, 1, MAX_TIMER_MS),
    attempts: boundedInt(opts.attempts, MAX_ATTEMPTS, 1, 5),
    backoffMs: boundedInt(opts.backoffMs, BASE_BACKOFF_MS, 0, 10_000),
    fetchImpl: opts.fetchImpl ?? nodeFetch,
  };
  // ONE finish path: enrich (Wikipedia extracts, best-effort), then rank +
  // dedupe + score against the query. Used by every provider so the shape and
  // the relevance contract cannot drift between them.
  const finish = async (
    raw: FreeItem[],
    provider: "duckduckgo" | "searxng" | "wikipedia",
  ): Promise<ResearchResult> => ({
    ok: true,
    query: q,
    items: rankResearchItems(q, await enrichWikipediaExtracts(raw, fetchOpts), maxResults),
    provider,
  });

  // Root cause of the most recent provider failure, surfaced verbatim in the
  // final honest failure so an agent sees WHY research is unavailable instead
  // of a bare "all providers failed". Set only on thrown provider errors; a
  // provider that merely returned zero results is not an error.
  let lastFailure: string | null = null;
  const noteFailure = (err: unknown): void => {
    lastFailure = err instanceof Error ? err.message : String(err);
  };

  try {
    const raw = await duckDuckGoLite(q, pool, fetchOpts);
    if (raw.length > 0) return await finish(raw, "duckduckgo");
  } catch (err) {
    noteFailure(err); // DuckDuckGo unavailable → fall through to SearXNG
  }
  try {
    const raw = await searxngSearch(q, pool, fetchOpts);
    if (raw.length > 0) return await finish(raw, "searxng");
  } catch (err) {
    noteFailure(err); // SearXNG unavailable → fall through to Wikipedia
  }
  try {
    const raw = await wikipediaSearch(q, pool, fetchOpts);
    if (raw.length > 0) return await finish(raw, "wikipedia");
  } catch (err) {
    noteFailure(err); // Wikipedia unavailable → honest failure below
  }
  return {
    ok: false,
    reason: "error",
    code: "RT_E_RESEARCH_UNAVAILABLE",
    error: lastFailure
      ? `Free web search unavailable — all providers failed (last: ${lastFailure})`
      : "Free web search returned no results (DuckDuckGo, SearXNG and Wikipedia all unavailable)",
  };
}
