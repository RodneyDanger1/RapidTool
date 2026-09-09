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

const researchServer = createServerFn({ method: "POST" })
  .validator((input: { query: string; opts?: { maxResults?: number } }) => input)
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
  opts?: { maxResults?: number },
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
