/**
 * Tavily web-search provider (server-only).
 *
 * Reads the key from `process.env.TAVILY_API_KEY` ONLY — never `import.meta.env`,
 * never a `VITE_` prefix. The browser-facing contract lives in `./research.ts`;
 * this module is the raw fetch and must never be imported from client code.
 *
 * Call shape per `research/runtime-integration.md` §1.3: a single
 * `POST https://api.tavily.com/search` with a Bearer key. Results already carry
 * LLM-ready `content` snippets, so `results[].title/url/content` (plus `score`)
 * are the field set persisted into artifacts.
 *
 * Honesty contract: when the key is absent this returns
 * `{ ok: false, reason: "not-configured", code: "RT_E_RESEARCH_UNAVAILABLE" }`
 * and NEVER fabricates research; a rejected key (HTTP 401) is its own coded
 * refusal (`RT_E_LLM_KEY_REJECTED`). Result entries without a usable http(s)
 * URL are dropped (an entry with no anchor cannot be cited honestly). Transient
 * network failures are retried once; timeout aborts are reported immediately.
 * Results are reranked/deduped/scored against the query before return.
 */

// fixes/347 R1: Tavily is a first-class provider — results are reranked,
// deduped and scored with the SAME pure helpers the keyless path uses, so a
// caller gets comparable relevance regardless of which backend served.
import { rankResearchItems, type ResearchResult } from "./research.ts";
// W40·N4: the shared knob sanitizer (this file used to carry its own copy —
// byte-identical to websearch.server.ts's, one shape with two homes).
import { boundedInt } from "./bounded-int.ts";
// fixes/346 A2-F5: the one-shot transport (undici's TLS teardown handle races the
// CLI's deliberate in-tick `process.exit()` on Node 24/Windows — 327-L2 crash
// class). `tavilySearch` is reached from the CLI (`headless.ts` probeTavily), so
// the default transport must be the seam. A test that replaces the global
// `fetch` still intercepts (`oneShotFetch` defers to a replaced reference).
import { oneShotFetch } from "./llm/providers/one-shot-fetch.server.ts";

export const TAVILY_BASE_URL = "https://api.tavily.com";

/** Tavily retrieval depth. `advanced` is deeper (and costs more credits). */
export type TavilySearchDepth = "basic" | "advanced";
/** Tavily topic axis. `news` biases to recency (P7 market/competitor intel). */
export type TavilyTopic = "general" | "news";

const DEFAULT_MAX_RESULTS = 5;
const TIMEOUT_MS = 20_000;
// Transient statuses get a bounded retry (runtime-integration.md §1.3: "retry
// once" for 500). 401/432/433 are config/billing and are NOT retried.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 2;

/** setTimeout's overflow ceiling — Node fires longer delays immediately and
 *  warns; anything at or below this stays a real timer. */
const MAX_TIMER_MS = 2_147_483_647;
/** RapidTool's own max_results ceiling (defensive): a tampered/absurd knob must
 *  never ride into the vendor body asking for thousands of entries. */
const MAX_RESULTS_CEILING = 20;

/** Sanitize a caller knob: finite integer in [min, max], else the fallback.
 *  A hostile/typo'd value (NaN, Infinity, -5, 1e9) never reaches the wire.
 *  W40·N4: moved to the shared `./bounded-int.ts` (this file's copy had a
 *  byte-identical twin in websearch.server.ts). */

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

export function tavilyApiKey(): string | undefined {
  return env("TAVILY_API_KEY");
}

export function isTavilyConfigured(): boolean {
  return Boolean(tavilyApiKey());
}

function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true;
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type TavilySearchOptions = {
  maxResults?: number;
  /** Test/dev hook; defaults to TIMEOUT_MS. */
  timeoutMs?: number;
  /** Retrieval depth (`basic` default; `advanced` is deeper + costlier). */
  searchDepth?: TavilySearchDepth;
  /** Topic axis (`general` default; `news` biases to recency). */
  topic?: TavilyTopic;
};

async function postWithRetry(url: string, init: RequestInit): Promise<Response> {
  let response: Response | null = null;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** attempt);
    try {
      response = await oneShotFetch(url, init);
    } catch (err) {
      // Timeout abort: report immediately — retrying would double the latency
      // the caller already paid for.
      if (isAbortError(err)) throw err;
      // Transient network failure (DNS/TCP/TLS): one bounded retry is safe.
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
    if (!RETRYABLE_STATUS.has(response.status)) return response;
    // Transient HTTP status → retry; remember it in case retries exhaust.
  }
  if (response) return response; // retries exhausted on a transient status
  throw lastError ?? new Error("Tavily request failed");
}

async function describeError(res: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await res.json()) as { detail?: { error?: unknown } };
    const msg = body?.detail?.error;
    if (typeof msg === "string" && msg.trim()) detail = `: ${msg.trim()}`;
  } catch {
    /* non-JSON error body — ignore */
  }
  switch (res.status) {
    case 400:
      return `Tavily rejected the request (HTTP 400${detail})`;
    case 401:
      return `Tavily rejected TAVILY_API_KEY (HTTP 401${detail}) — the key at its source (working-directory .env or the process environment) is invalid or revoked; fix it and re-run`;
    case 429:
      return `Tavily rate limit reached (HTTP 429${detail})`;
    case 432:
      return `Tavily plan usage limit exceeded (HTTP 432${detail})`;
    case 433:
      return `Tavily pay-as-you-go limit exceeded (HTTP 433${detail})`;
    case 500:
      return `Tavily server error (HTTP 500${detail})`;
    case 503:
      return `Tavily server overloaded (HTTP 503${detail})`;
    default:
      return `Tavily request failed (HTTP ${res.status}${detail})`;
  }
}

export async function tavilySearch(
  query: string,
  opts: TavilySearchOptions = {},
): Promise<ResearchResult> {
  const key = tavilyApiKey();
  if (!key) {
    return {
      ok: false,
      reason: "not-configured",
      code: "RT_E_RESEARCH_UNAVAILABLE",
    };
  }

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
  // W40·K4: both knobs are sanitized before use — an unvalidated
  // `maxResults` (NaN / -5 / 1e9) used to be forwarded verbatim into the
  // vendor body, and a non-positive `timeoutMs` aborted the request on the
  // first tick (a "timeout" the caller never asked for).
  const maxResults = boundedInt(opts.maxResults, DEFAULT_MAX_RESULTS, 1, MAX_RESULTS_CEILING);
  const timeoutMs = boundedInt(opts.timeoutMs, TIMEOUT_MS, 1, MAX_TIMER_MS);
  // Only the documented enum values reach the wire; anything else falls back to
  // the vendor default (an unvalidated value would 400 the request, §1.3).
  const searchDepth: TavilySearchDepth = opts.searchDepth === "advanced" ? "advanced" : "basic";
  const topic: TavilyTopic = opts.topic === "news" ? "news" : "general";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await postWithRetry(`${TAVILY_BASE_URL}/search`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query: q.slice(0, 400),
        search_depth: searchDepth,
        max_results: maxResults,
        topic,
        include_answer: false,
        include_raw_content: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // A rejected credential (401) is its own coded refusal — the keyed-path
      // credentials class — so a caller can tell "wrong key" from "unreachable".
      // Every other status stays the research-unavailable family.
      return {
        ok: false,
        reason: "error",
        code: res.status === 401 ? "RT_E_LLM_KEY_REJECTED" : "RT_E_RESEARCH_UNAVAILABLE",
        error: await describeError(res),
      };
    }

    const body = (await res.json()) as { results?: unknown[] };
    if (!Array.isArray(body.results)) {
      return {
        ok: false,
        reason: "error",
        code: "RT_E_RESEARCH_UNAVAILABLE",
        error: "Tavily response contained no results array",
      };
    }

    // Honesty filter: an entry without a usable http(s) URL is not a citable
    // result — keep it and an agent may cite a bare string. Entries that only
    // carry a URL stay (title/content are best-effort enrichments).
    // W40·K4: non-object entries (e.g. a stray `null` in the results array)
    // are dropped BEFORE the field reads — one malformed entry used to throw
    // a TypeError that failed the whole search instead of being filtered.
    const mapped = (body.results as Array<Record<string, unknown>>)
      .filter((r) => r !== null && typeof r === "object")
      .map((r) => ({
        title: typeof r.title === "string" ? r.title : "",
        url: typeof r.url === "string" ? r.url : "",
        content: typeof r.content === "string" ? r.content : "",
      }))
      .filter((it) => /^https?:\/\//i.test(it.url));

    // Rerank + dedupe + score against the query. Tavily's own `score` is dropped
    // in favour of RapidTool's comparable term-overlap score, so a caller reads
    // the same `score` semantics on every provider (see `relevanceScore`).
    return { ok: true, query: q, items: rankResearchItems(q, mapped, maxResults), provider: "tavily" };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      code: "RT_E_RESEARCH_UNAVAILABLE",
      error: isAbortError(err)
        ? `Tavily request timed out after ${Math.round(timeoutMs / 1000)}s`
        : err instanceof Error
          ? `Tavily request failed: ${err.message}`
          : "Tavily request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
