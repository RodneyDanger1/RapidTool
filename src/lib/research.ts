/**
 * Client-facing web-research contract for RapidTool (Tavily).
 *
 * Import THIS module from engine/store/UI code — never import
 * `./tavily.server.ts` directly. The API key is read server-side only (see that
 * module); this module exposes the typed `research()` API and the honest
 * `{ ok: false, reason: "not-configured" }` fallback, so a missing key never
 * strands a run or produces invented citations.
 */

import { createServerFn } from "@tanstack/react-start";
import type { ErrorCode } from "./errors.ts";

export type ResearchItem = {
  title: string;
  url: string;
  content: string;
  score?: number;
};

/**
 * Machine-readable error codes attached to every failure result across the
 * server layer (websearch / tavily / research / exec / node-runner / phases).
 * Canonical union lives in `src/lib/errors.ts` (shared with the LLM/report/
 * runner taxonomy); codes are coarse families and the existing `reason` field
 * stays the fine-grained discriminator.
 */
export type RtErrorCode = ErrorCode;

export type ResearchResult =
  | {
      ok: true;
      query: string;
      items: ResearchItem[];
      provider?: "tavily" | "duckduckgo" | "wikipedia" | "searxng";
    }
  | {
      ok: false;
      reason: "not-configured" | "error";
      code: RtErrorCode;
      error?: string;
    };

/** Options accepted by `research()` and forwarded to the active provider. */
export type ResearchOptions = {
  maxResults?: number;
  /** Tavily-only: `advanced` is a deeper (costlier) retrieval. Ignored keyless. */
  searchDepth?: "basic" | "advanced";
  /** Tavily-only: `news` biases to recency for market intel. Ignored keyless. */
  topic?: "general" | "news";
};

// ---------------------------------------------------------------------------
// Retrieval ranking (pure, deterministic) — shared by the Tavily and keyless
// providers so BOTH return best-available sources, never raw vendor order.
// ---------------------------------------------------------------------------

/**
 * Query/filler words with no retrieval signal in a search phrase. Kept small:
 * a term is only dropped when it never distinguishes one result from another.
 */
const RANK_STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in",
  "is", "it", "of", "on", "or", "that", "the", "to", "what", "when", "where",
  "which", "who", "with", "you", "your", "best", "top", "guide", "using", "use",
]);

/** Tracking/click params that never identify distinct content. */
const RANK_TRACKING_PARAMS: ReadonlySet<string> = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid",
]);

/** Crude singular/plural fold so "tenants" matches a query term "tenant". */
function foldToken(token: string): string {
  return token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;
}

function tokenSet(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) out.add(foldToken(raw));
  return out;
}

/** Distinct, non-stopword query terms (plural-folded), in first-seen order. */
function queryTerms(query: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of String(query ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    const t = foldToken(raw);
    if (RANK_STOPWORDS.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Normalize a URL for dedupe: lowercase host, strip `www.`/fragment/trailing
 * slash, drop pure tracking params. Unparseable input falls back to trimmed
 * lowercased text — never throws.
 */
export function normalizeSourceUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(String(url ?? ""));
  } catch {
    return String(url ?? "").trim().toLowerCase();
  }
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.hash = "";
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
  for (const key of [...u.searchParams.keys()]) {
    if (RANK_TRACKING_PARAMS.has(key)) u.searchParams.delete(key);
  }
  return u.toString();
}

/** Registrable-ish domain used for diversity (last two labels; a heuristic that
 *  is enough to stop one site from filling a result page). */
function domainKey(url: string): string {
  try {
    const host = new URL(String(url ?? "")).hostname.toLowerCase().replace(/^www\./, "");
    return host.split(".").slice(-2).join(".");
  } catch {
    return String(url ?? "").toLowerCase();
  }
}

/**
 * RapidTool's own relevance score for one fetched source against the query, in
 * [0,1]. Deterministic bag-of-words overlap with a field prior — a query term in
 * the TITLE counts most (3), in the URL next (2), in the snippet/content least
 * (1) — plus a small bonus for a verbatim query-phrase hit. A source with zero
 * overlap scores 0 and must not be presented as on-topic.
 */
export function relevanceScore(
  query: string,
  item: { title?: unknown; url?: unknown; content?: unknown },
): number {
  const terms = queryTerms(query);
  if (terms.length === 0) return 0;
  const title = tokenSet(String(item?.title ?? ""));
  const url = tokenSet(String(item?.url ?? ""));
  const content = tokenSet(String(item?.content ?? ""));
  let hit = 0;
  for (const t of terms) {
    if (title.has(t)) hit += 3;
    else if (url.has(t)) hit += 2;
    else if (content.has(t)) hit += 1;
  }
  let score = hit / (3 * terms.length);
  const phrase = String(query ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (phrase.length >= 6) {
    const hay = `${String(item?.title ?? "")} ${String(item?.content ?? "")}`.toLowerCase();
    if (hay.includes(phrase)) score += 0.15;
  }
  return Math.max(0, Math.min(1, Math.round(score * 1000) / 1000));
}

/**
 * Relevance floor below which a fetched source reads as off-topic for the query
 * that produced it. Measured ([0,1], `relevanceScore`): on the ten rt10 briefs
 * every on-intent source scored ≥ 0.167 while the two off-topic draws that the
 * old any-single-term overlap kept (a Wikipedia "Pixar" page matching the
 * generic term `software`, "Cities: Skylines" matching a product noun) both
 * scored 0.042 — one content hit on an 8-term query. The floor is shared with
 * the narrative grounding check (`llm-tasks.assessNarrativeGrounding`) so the
 * retrieval filter and the summary honesty clause cannot disagree.
 */
export const RESEARCH_RELEVANCE_FLOOR = 0.15;

/** Max results kept per site before the diversity backfill runs. */
const MAX_PER_DOMAIN = 2;

/** Minimal shape the ranker reads; any extra fields on `T` are preserved. */
export type RankableSource = { title: string; url: string; content?: string };

/**
 * Rank + dedupe fetched sources for one query and cap to `maxResults`.
 *
 * - entries without a usable http(s) URL are dropped (uncitable);
 * - duplicates (same normalized URL) keep their first occurrence;
 * - each kept item gets RapidTool's `score` ([0,1], see `relevanceScore`);
 * - order is relevance-first with round-robin domain diversity (at most
 *   `MAX_PER_DOMAIN` per site before the rest are appended) so one site cannot
 *   monopolise the page. Ties keep the provider's own order (stable sort).
 */
export function rankResearchItems<T extends RankableSource>(
  query: string,
  items: readonly T[],
  maxResults?: number,
): Array<T & { score: number }> {
  const cap =
    typeof maxResults === "number" && Number.isFinite(maxResults) && maxResults > 0
      ? Math.floor(maxResults)
      : Number.POSITIVE_INFINITY;
  const seen = new Set<string>();
  const scored: Array<{ item: T & { score: number }; order: number; domain: string }> = [];
  let order = 0;
  for (const raw of items ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const url = String((raw as { url?: unknown }).url ?? "");
    if (!/^https?:\/\//i.test(url)) continue;
    const key = normalizeSourceUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);
    scored.push({
      item: { ...(raw as T), score: relevanceScore(query, raw) },
      order: order++,
      domain: domainKey(url),
    });
  }
  scored.sort((a, b) => b.item.score - a.item.score || a.order - b.order);
  const perDomain = new Map<string, number>();
  const preferred: typeof scored = [];
  const overflow: typeof scored = [];
  for (const entry of scored) {
    const n = perDomain.get(entry.domain) ?? 0;
    if (n >= MAX_PER_DOMAIN) {
      overflow.push(entry);
      continue;
    }
    perDomain.set(entry.domain, n + 1);
    preferred.push(entry);
  }
  return [...preferred, ...overflow].slice(0, cap).map((e) => e.item);
}

const researchServer = createServerFn({ method: "POST" })
  .validator((input: { query: string; opts?: ResearchOptions }) => input)
  .handler(async ({ data }) => {
    const { tavilySearch, isTavilyConfigured } = await import("./tavily.server.ts");
    if (isTavilyConfigured()) {
      return tavilySearch(data.query, data.opts);
    }
    const { freeWebSearch } = await import("./websearch.server.ts");
    return freeWebSearch(data.query, data.opts);
  });

const statusServer = createServerFn({ method: "GET" }).handler(async () => {
  const { isTavilyConfigured } = await import("./tavily.server.ts");
  if (isTavilyConfigured()) {
    return { configured: true, label: "tavily", provider: "tavily" as const };
  }
  // Keyless DuckDuckGo/SearXNG/Wikipedia fallback is always available server-side.
  return { configured: true, label: "free search", provider: "duckduckgo" as const };
});

export async function research(
  query: string,
  opts?: ResearchOptions,
): Promise<ResearchResult> {
  // Validate BEFORE the server round-trip: an empty query is a caller bug, not
  // a research failure — never burn a network call (or a provider) on it.
  if (typeof query !== "string") {
    return {
      ok: false,
      reason: "error",
      code: "RT_E_VALIDATION",
      error: "research query must be a string",
    };
  }
  const q = query.trim();
  if (!q) {
    return {
      ok: false,
      reason: "error",
      code: "RT_E_VALIDATION",
      error: "empty research query",
    };
  }
  try {
    return await researchServer({ data: { query: q, opts } });
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      code: "RT_E_INTERNAL",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function researchStatus(): Promise<{
  configured: boolean;
  label: string;
  provider: string;
}> {
  try {
    return await statusServer();
  } catch {
    return { configured: false, label: "unavailable", provider: "none" };
  }
}
