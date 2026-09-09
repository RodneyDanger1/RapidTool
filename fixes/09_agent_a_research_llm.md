# Research layer hardening + LLM task helpers (agent A, mission 9)

## What shipped

### 1. `src/lib/websearch.server.ts` (rewritten) — keyless search hardening
- **Third provider, SearXNG** — public `format=json` instances (`searx.be`, `searx.tiekoetter.com`, `search.bus-hit.me`), tried in order after DuckDuckGo and before Wikipedia. Fallback chain is now **DDG → SearXNG → Wikipedia**.
- **Retry/backoff** — every provider fetch retries transient failures (network/timeout/`429`/`500`/`503`) up to 2 attempts with `400ms·2ⁿ` backoff; non-transient statuses (e.g. 404) surface immediately and let the next provider take over.
- **Dedupe** — results deduped by normalized URL (lowercase host, strip `www.`, strip fragment, strip trailing slash, drop `utm_*`/`fbclid`/`gclid` tracking params).
- **Wikipedia extract enrichment** — the top 1–2 Wikipedia hits have their search snippet replaced with the real intro paragraph via `action=query&prop=extracts&exintro&explaintext&redirects=1` (best-effort; original snippet kept on failure).
- **Honest provider labels** — `"duckduckgo" | "wikipedia" | "searxng"` (still keyless/free, no new keys).

### 2. `src/lib/research.ts` (1-line type change)
- `ResearchResult` provider union now includes `"searxng"`. No behavior change otherwise (Tavily → free DDG/SearXNG/Wikipedia routing is unchanged).

### 3. `src/lib/llm-tasks.ts` (NEW) — client module wrapping DeepSeek
Three config-gated tasks, each calling `complete()` (llm.ts), each returning an honest `{ ok:false, reason:"not-configured"|"error" }` shape — **never fabricates output on failure**.

### 4. Tests
- `src/lib/websearch.test.ts` (rewritten) — DDG parse, dedupe, retry (429→success), SearXNG fallback, Wikipedia fallback, extract enrichment, all-unavailable error.
- `src/lib/llm-tasks.test.ts` (NEW) — `parseConstraintList` unit tests; `createLlmTasks` with injected completer (not-configured / error / parse / empty); end-to-end through `completeDeepSeek` with mocked `fetch`.

## Exact public signatures (for parent wiring)

### `src/lib/websearch.server.ts`
```ts
export type FreeSearchOptions = {
  maxResults?: number;   // default 5
  timeoutMs?: number;    // default 20_000 (test hook)
  attempts?: number;     // default 2  (test hook)
  backoffMs?: number;    // default 400 (test hook)
};
export async function freeWebSearch(
  query: string,
  opts?: FreeSearchOptions,
): Promise<ResearchResult>; // ResearchResult from ./research.ts (provider now includes "searxng")
```

### `src/lib/llm-tasks.ts`
```ts
export type ConstraintsResult =
  | { ok: true; constraints: string[] }
  | { ok: false; reason: "not-configured" | "error"; error?: string };
export type FeedbackResult =
  | { ok: true; guidance: string }
  | { ok: false; reason: "not-configured" | "error"; error?: string };
export type NarrativeResult =
  | { ok: true; text: string }
  | { ok: false; reason: "not-configured" | "error"; error?: string };
export type PhaseNarrativeSnapshot = { name: string; brief: string; domain?: string };

export async function extractConstraints(brief: string): Promise<ConstraintsResult>;
export async function interpretFeedback(note: string, phaseTitle: string): Promise<FeedbackResult>;
export async function phaseNarrative(snapshot: PhaseNarrativeSnapshot, phase: PhaseDef): Promise<NarrativeResult>;

// Test hooks (safe to ignore in production wiring):
export function createLlmTasks(completeFn: Completer): {
  extractConstraints; interpretFeedback; phaseNarrative;
};
export function parseConstraintList(text: string): string[] | null;
```

Notes for the parent:
- `phaseNarrative` takes a `PhaseDef` (from `./types.ts`) — pass `phaseDef(phaseId)` from `./phases.ts`. A full `Project` object is structurally assignable to `PhaseNarrativeSnapshot`.
- `extractConstraints` uses `model:"deepseek-v4-pro"` + `json:true`; `interpretFeedback` and `phaseNarrative` use pro + plain text. All three are `createServerFn`-free client functions (they call the existing `complete()` server fn), so no build-boundary changes are needed.

## Gate
- `npm run typecheck` → **0 errors**.
- `node --experimental-strip-types --test src/lib/*.test.ts src/lib/app-data/app-data.test.ts src/lib/auth/*.test.ts` → **331/331 pass** (was 287 before this change; +44 new/updated assertions).

## Out-of-scope notes for the parent
- `npm test` still shows **10 pre-existing failures in `scripts/**/*.test.mjs`** (OG/social-card `og:title`/`og:image`/share-meta + symlink CLI tests) — untouched and unrelated to this change.
- `package.json` `test` script lists TS files explicitly and does **not** yet include `src/lib/llm-tasks.test.ts` — add it there if you want `npm test` (not the glob) to run the new suite. Left to you because `package.json` is outside this agent's ownership.
