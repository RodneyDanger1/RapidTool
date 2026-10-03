// ---------------------------------------------------------------------------
// harvest.ts — Pillar 1: bounded live-source harvester (bare-Node safe).
//
// Turns a project brief into REAL, verifiable source material for the agent
// pipeline: search queries → candidate GitHub repositories → README snippets +
// GitHub-API license spot-checks → honest pattern-level notes. Every piece of
// output is either fetched or explicitly absent — this module NEVER fabricates
// a repo, a license, or a snippet.
//
// Honesty contract (machine-readable):
//   - `buildHarvestQueries` uses deepseek-v4-flash (json:true) ONLY when a key
//     is configured AND the call succeeds; every other path — no key, LLM
//     failure, unparseable payload — falls back to the deterministic keyword
//     floor and the returned `source` flag says "keyword" (never "llm").
//   - `harvestRepos` is bounded: at most HARVEST_DEFAULT_MAX_FETCHES (4) direct
//     fetches and a HARVEST_DEFAULT_TIMEOUT_MS (12 s) wall-clock budget. Every
//     search leg is handed only the REMAINING slice of that budget (capped at
//     HARVEST_SEARCH_TIMEOUT_MS), so the deadline is real: a leg that ignores
//     its slice is detected after the await and reported as a coded
//     RT_E_BUDGET_EXHAUSTED degraded result, never a clean harvest. Hits
//     carry a per-hit `provenance` so consumers know exactly what was fetched.
//   - `extractPatterns` is a structural-regex, pattern-level scan — NOT an AST
//     parse (see EXTRACT_PATTERN_DISCLAIMER).
//   - `trendNotes` is a deprecated-API advisory over the harvested snippets
//     only; it never claims to be a live API registry check.
//
// Backends: websearch.server.ts (keyless DuckDuckGo/SearXNG/Wikipedia) and
// deepseek.server.ts (plain-fetch DeepSeek) — both proven bare-Node safe by
// the headless driver. `research()` from research.ts is NOT used here (it is a
// TanStack server-fn and throws outside a Start runtime).
// ---------------------------------------------------------------------------
import { completeDeepSeek, DEEPSEEK_MODELS, isDeepSeekConfigured } from "./deepseek.server.ts";
import { dualChannelFailDetail } from "./errors.ts";
import { freeWebSearch } from "./websearch.server.ts";
import { failureSignature, lessonRow } from "./knowledge.ts";
// fixes/346 A2-F5: the one-shot transport for the two default fetch legs. The
// CLI reaches harvest (via research()) and an in-tick `process.exit()` after an
// undici `fetch` races the TLS teardown handle (327-L2 crash class). Callers
// that inject `fetchText`/`fetchJson` are unaffected; a test replacing the
// global `fetch` still intercepts (`oneShotFetch` defers to a replaced ref).
import { oneShotFetch } from "./llm/providers/one-shot-fetch.server.ts";
import type { ResearchResult } from "./research.ts";
import type { MemoryEntry, PhaseId, Project } from "./types.ts";

// ---------------------------------------------------------------------------
// Bounds + honest labels (exported so consumers can persist/search on them).
// ---------------------------------------------------------------------------

/** Hard cap on direct fetches inside one harvestRepos call. */
export const HARVEST_DEFAULT_MAX_FETCHES = 4;
/** Wall-clock budget for one harvestRepos call (search + fetches). */
export const HARVEST_DEFAULT_TIMEOUT_MS = 12_000;
/** Per-search-leg ceiling. Each dispatched search gets
 *  `min(remaining wall-clock budget, this cap)`, so a single leg can never be
 *  granted more time than the overall deadline still has. */
export const HARVEST_SEARCH_TIMEOUT_MS = 8_000;
/** Max search queries actually dispatched inside one harvestRepos call. */
export const HARVEST_DEFAULT_MAX_QUERIES = 2;
/** Keyword-floor query count. */
export const HARVEST_MAX_QUERIES_PLAN = 4;
/** LLM query count cap (validated after the json reply). */
export const HARVEST_LLM_MAX_QUERIES = 6;
/** 109 T-09: hard cap on GitHub candidates collected in Phase A (deduped repo
 *  URLs). Enforced at the top of the query loop AND inside the per-result
 *  scan, so neither an extra query nor a wide result page can push the
 *  candidate list past it. Exportable like the other bounds — consumers may
 *  persist/search on it. */
export const HARVEST_MAX_CANDIDATES = 6;

export const HARVEST_QUERY_LABEL =
  "queries are derived from the brief (deepseek-v4-flash json:true when configured, deterministic keyword floor otherwise) — not a promise that any repo matches.";
export const HARVEST_BOUNDS_LABEL =
  "bounded: at most 4 direct fetches and a 12 s wall-clock budget; hits are the honest subset reachable within the budget.";
export const HARVEST_SOURCE_LABEL =
  "source flag is honest: \"llm\" only when the deepseek-v4-flash json call succeeded; anything else is \"keyword\".";
export const EXTRACT_PATTERN_DISCLAIMER =
  "pattern-level structural regex extraction — NOT an AST parse; scopes, nesting and codegen semantics are not modeled.";

// ---------------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------------

export type HarvestQuerySource = "llm" | "keyword";

export type HarvestQueryPlan = {
  queries: string[];
  source: HarvestQuerySource;
  /** Honest degradation note (present when the LLM path failed or was skipped). */
  note?: string;
};

export type HarvestHitProvenance = "web-search" | "github-raw" | "github-api";

export type HarvestHit = {
  /** GitHub repo as "owner/name". */
  repo: string;
  /** From the GitHub API license spot-check — ABSENT (never invented) when the check was skipped or unreachable. */
  license?: string;
  /** Bounded text: README head when fetched, else the search snippet. */
  snippet: string;
  /** Best-known URL for the repo. */
  url: string;
  provenance: HarvestHitProvenance;
};

export type HarvestSearchResult = {
  hits: HarvestHit[];
  /** Honest notes: budget exhaustion, skipped fetches, unreachable backends. */
  notes: string[];
};

/**
 * LLM query-builder seam. Discriminated: never `{ ok: true, error }`.
 * 185-H1 dual-channel (ok:true + error) is a lie — buildHarvestQueries
 * fail-closes that shape onto the keyword floor.
 */
export type HarvestLlmResult =
  | { ok: true; text: string }
  | { ok: false; error?: string };

/** Test/dev seams — every option defaults to the real, bounded behavior. */
export type HarvestOptions = {
  /** Search backend override (tests inject a fake). `timeoutMs` is the
   *  remaining slice of the wall-clock budget the leg must honour. */
  search?: (query: string, opts: { maxResults?: number; timeoutMs?: number }) => Promise<ResearchResult>;
  /** Plain-text fetcher override (tests inject a fake). */
  fetchText?: (url: string, opts: { timeoutMs: number }) => Promise<string>;
  /** JSON fetcher override (tests inject a fake). */
  fetchJson?: (url: string, opts: { timeoutMs: number }) => Promise<unknown>;
  /** LLM seam: when omitted, the real deepseek-v4-flash json call runs iff a key is configured. */
  llm?: (brief: string) => Promise<HarvestLlmResult>;
  /** Force the configured flag (tests pin the not-configured path deterministically). */
  llmConfigured?: boolean;
  maxFetches?: number;
  timeoutMs?: number;
  maxQueries?: number;
};

export type ExtractedPatternKind = "function" | "export" | "schema" | "type";

export type ExtractedPattern = {
  kind: ExtractedPatternKind;
  name: string;
  /** 1-based line of the matched declaration. */
  line: number;
  /** The matched declaration line, clipped. */
  snippet: string;
  /** Object-literal schema keys (schema kind only, best-effort, capped). */
  keys?: string[];
  /** Always "pattern" — this is regex-level extraction, never an AST claim. */
  confidence: "pattern";
};

export type HarvestRow = {
  kind: "research";
  provenance: "harvest";
  repo: string;
  title: string;
  url: string;
  snippet: string;
  license?: string;
  hitProvenance: HarvestHitProvenance;
};

export type HarvestPacketResult =
  | {
      ok: true;
      rows: HarvestRow[];
      queries: string[];
      querySource: HarvestQuerySource;
      notes: string[];
    }
  | { ok: false; reason: "validation"; code: "RT_E_VALIDATION"; error: string };

// ---------------------------------------------------------------------------
// buildHarvestQueries — deepseek-v4-flash json:true when configured,
// deterministic keyword floor otherwise, honest `source` flag.
// ---------------------------------------------------------------------------

const HARVEST_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "with", "that", "this", "these", "those",
  "from", "into", "build", "app", "tool", "using", "based", "your", "our", "make",
  "create", "system", "simple", "small", "large", "new", "high", "low", "via",
  "use", "user", "users", "need", "needs", "want", "wants", "should", "must",
  "can", "will", "have", "has", "had", "of", "in", "on", "to", "it", "is", "as",
  "at", "by", "be", "are", "was", "were", "do", "does", "did", "not", "no",
  "also", "like", "just", "one", "two", "three", "any", "all", "each", "its",
]);

/** Deterministic keyword floor: same brief → identical queries, forever. */
function keywordQueries(brief: string): string[] {
  const words = brief.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    if (w.length < 3 || HARVEST_STOPWORDS.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    kept.push(w);
  }
  if (kept.length === 0) return []; // honest: nothing derivable
  const out: string[] = [];
  out.push(`${kept.slice(0, 4).join(" ")} github open source`);
  if (kept.length >= 2) out.push(`${kept.slice(0, 2).join(" ")} library github repository`);
  if (kept.length >= 3) out.push(`${kept.slice(2, 5).join(" ")} implementation open source github`);
  if (kept.length >= 4) out.push(`${kept[0]} ecosystem alternatives github`);
  return out.slice(0, HARVEST_MAX_QUERIES_PLAN);
}

function parseQueryJson(text: string): string[] {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1].trim();
  try {
    const parsed = JSON.parse(t) as unknown;
    if (parsed && typeof parsed === "object") {
      const q = (parsed as { queries?: unknown }).queries;
      if (Array.isArray(q)) return q.filter((x): x is string => typeof x === "string");
    }
  } catch {
    /* fall through to empty */
  }
  return [];
}

function cleanQueries(raw: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of raw) {
    const t = typeof q === "string" ? q.trim() : "";
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}

function harvestQueryPrompt(brief: string): string {
  return (
    `Derive focused search queries for finding real open-source GitHub repositories relevant to this brief.\n\n` +
    `Brief: ${brief.slice(0, 1200)}\n\n` +
    `Return the single JSON object {"queries": ["..."]} with 3-6 search queries.`
  );
}

const HARVEST_LLM_SYSTEM =
  "You are RapidTool's harvest query builder. Return the single JSON object the user describes — no prose before or after it.";

async function defaultQueryLlm(brief: string): Promise<HarvestLlmResult> {
  const res = await completeDeepSeek(harvestQueryPrompt(brief), {
    model: DEEPSEEK_MODELS.flash,
    json: true,
    maxTokens: 512,
    system: HARVEST_LLM_SYSTEM,
  });
  // Discriminated: never stamp ok:true together with error (185-H1).
  // Usage on res is dropped here — harvest.ts has no numeric token cap
  // (parent must wire recordSpend at codegen.server.ts liveP6Synthesis).
  // completeDeepSeek itself does not dual-channel; hostile/stub wrappers can.
  const dual = dualChannelFailDetail(res);
  if (dual) return { ok: false, error: dual };
  if (!res.ok) {
    return {
      ok: false,
      error: typeof res.error === "string" ? res.error : (res.reason ?? "LLM call failed"),
    };
  }
  return { ok: true, text: res.text };
}

/**
 * 185-H1: `{ ok: true, error }` is a dual-channel lie — treat as LLM failure.
 * Composes `dualChannelFailDetail` (errors.ts / 205) so harvest stays on the
 * shared detector; ok:false still degrades to the keyword floor (unknown if
 * the failure carries no prose).
 */
function harvestLlmFailDetail(res: { ok?: unknown; error?: unknown; text?: unknown }): string | null {
  const dual = dualChannelFailDetail(res);
  if (dual !== null) return dual;
  if (res.ok === true) return null;
  const err = typeof res.error === "string" && res.error.trim() ? res.error.trim() : "";
  return err || "unknown";
}

export async function buildHarvestQueries(brief: string, opts: HarvestOptions = {}): Promise<HarvestQueryPlan> {
  const b = typeof brief === "string" ? brief.trim() : "";
  if (!b) return { queries: [], source: "keyword", note: "empty brief — no queries built" };

  const configured = opts.llmConfigured ?? isDeepSeekConfigured();
  if (!configured) return { queries: keywordQueries(b), source: "keyword" };

  const llm = opts.llm ?? defaultQueryLlm;
  try {
    const res = await llm(b);
    const fail = harvestLlmFailDetail(res);
    if (fail !== null) {
      return { queries: keywordQueries(b), source: "keyword", note: `LLM query builder failed (${fail}) — keyword floor used` };
    }
    const text = res.ok === true && typeof res.text === "string" ? res.text : "";
    const queries = cleanQueries(parseQueryJson(text), HARVEST_LLM_MAX_QUERIES);
    if (queries.length === 0) {
      return { queries: keywordQueries(b), source: "keyword", note: "LLM returned no usable queries — keyword floor used" };
    }
    return { queries, source: "llm" };
  } catch (err) {
    return {
      queries: keywordQueries(b),
      source: "keyword",
      note: `LLM query builder threw (${err instanceof Error ? err.message : String(err)}) — keyword floor used`,
    };
  }
}

// ---------------------------------------------------------------------------
// harvestRepos — keyless search + bounded raw.githubusercontent fetches
// (≤4 fetches / 12 s), GitHub-API license spot-check when reachable,
// honest empty on failure.
// ---------------------------------------------------------------------------

const UA_HARVEST = "rapidtool-harvest/1.0 (+https://github.com/nousresearch)";

const GITHUB_PATH_BLOCKLIST = new Set([
  "about", "topics", "collections", "settings", "features", "marketplace",
  "sponsors", "blog", "pricing", "enterprise", "search", "notifications",
  "explore", "trending", "login", "signup", "orgs",
]);

/** Parse "https://github.com/<owner>/<repo>/..." → "owner/repo" | null. */
function githubRepoOf(url: string): string | null {
  if (typeof url !== "string") return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, repo] = parts;
  const nameRe = /^[A-Za-z0-9_.-]+$/;
  if (!nameRe.test(owner) || !nameRe.test(repo)) return null;
  if (GITHUB_PATH_BLOCKLIST.has(owner) || GITHUB_PATH_BLOCKLIST.has(repo)) return null;
  return `${owner}/${repo}`;
}

function stripMarkup(text: string): string {
  // Fail closed on junk rows (a hostile or partial search backend may hand
  // back items without string content): non-strings clip to "" — never a
  // TypeError that takes the whole harvest down.
  const s = typeof text === "string" ? text : "";
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clip to `cap` chars on a word boundary; appends an ellipsis when cut. */
function clipSnippet(text: string, cap: number): string {
  const clean = stripMarkup(text);
  if (clean.length <= cap) return clean;
  const cut = clean.slice(0, cap);
  const space = cut.lastIndexOf(" ");
  const at = space > cap * 0.6 ? space : cap;
  return `${clean.slice(0, at).trimEnd()}…`;
}

async function defaultFetchText(url: string, o: { timeoutMs: number }): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, o.timeoutMs));
  try {
    const res = await oneShotFetch(url, {
      headers: { "user-agent": UA_HARVEST, accept: "text/plain,text/markdown,*/*" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function defaultFetchJson(url: string, o: { timeoutMs: number }): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, o.timeoutMs));
  try {
    const res = await oneShotFetch(url, {
      headers: { "user-agent": UA_HARVEST, accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function harvestRepos(queries: readonly string[], opts: HarvestOptions = {}): Promise<HarvestSearchResult> {
  const notes: string[] = [];
  const search = opts.search ?? ((q, o) => freeWebSearch(q, { maxResults: o.maxResults, timeoutMs: o.timeoutMs ?? HARVEST_SEARCH_TIMEOUT_MS }));
  const fetchText = opts.fetchText ?? defaultFetchText;
  const fetchJson = opts.fetchJson ?? defaultFetchJson;
  const maxFetches = Math.max(0, opts.maxFetches ?? HARVEST_DEFAULT_MAX_FETCHES);
  const timeoutMs = Math.max(1, opts.timeoutMs ?? HARVEST_DEFAULT_TIMEOUT_MS);
  const maxQueries = Math.max(0, opts.maxQueries ?? HARVEST_DEFAULT_MAX_QUERIES);

  const qs = (Array.isArray(queries) ? queries : [])
    .filter((q): q is string => typeof q === "string" && q.trim() !== "")
    .map((q) => q.trim())
    .slice(0, maxQueries);
  if (qs.length === 0) return { hits: [], notes: ["no queries supplied — harvest skipped"] };

  const deadline = Date.now() + timeoutMs;
  const remainingMs = (): number => Math.max(0, deadline - Date.now());
  let fetches = 0;

  // Phase A — keyless search → GitHub candidates (deduped, capped).
  const candidates: { repo: string; url: string; snippet: string }[] = [];
  const seenRepos = new Set<string>();
  for (const q of qs) {
    // 109 T-09: enforce the candidate cap across queries — the inner
    // per-result break below only stops collecting WITHIN one result page,
    // so without this check a further query still burned a search call
    // (against the time budget) with a full candidate list already in hand.
    if (candidates.length >= HARVEST_MAX_CANDIDATES) break;
    if (remainingMs() <= 0) {
      notes.push(`time budget exhausted before query "${q}" — remaining queries skipped`);
      break;
    }
    const searchQuery = /github/i.test(q) ? q : `${q} github`;
    let res: ResearchResult;
    try {
      // Hand the leg only the time the deadline still has (capped), so a
      // cooperating backend can never be granted a stale fixed budget.
      res = await search(searchQuery, { maxResults: 4, timeoutMs: Math.min(remainingMs(), HARVEST_SEARCH_TIMEOUT_MS) });
    } catch (err) {
      notes.push(`search threw for "${q}" (${err instanceof Error ? err.message : String(err)}) — skipped`);
      continue;
    }
    // A leg that ignored its slice has already overrun the wall-clock budget.
    // Surface it as a coded degraded result (the loop-top check skips any
    // later query); the honest hits already in hand are still processed below.
    if (remainingMs() <= 0) {
      notes.push(
        `search for "${q}" overran the ${timeoutMs} ms wall-clock budget [RT_E_BUDGET_EXHAUSTED] — no further queries dispatched`,
      );
    }
    if (!res.ok) {
      notes.push(`search unavailable for "${q}" (${res.reason}${res.error ? `: ${res.error}` : ""})`);
      continue;
    }
    for (const item of res.items) {
      const repo = githubRepoOf(item.url);
      if (!repo || seenRepos.has(repo)) continue;
      const snippet = clipSnippet(item.content, 240);
      if (!snippet) continue;
      seenRepos.add(repo);
      candidates.push({ repo, url: item.url, snippet });
      if (candidates.length >= HARVEST_MAX_CANDIDATES) break;
    }
  }
  if (candidates.length === 0) {
    notes.push("no GitHub repositories surfaced by search — honest empty hit list (nothing fabricated)");
    return { hits: [], notes };
  }

  // Phase B — bounded direct fetches (README head, then license spot-check).
  const hits: HarvestHit[] = [];
  for (const cand of candidates) {
    if (fetches >= maxFetches) {
      notes.push(`fetch budget (${maxFetches}) reached — ${candidates.length - hits.length} candidate(s) left unfetched`);
      break;
    }
    if (remainingMs() <= 0) {
      notes.push(`time budget (${timeoutMs} ms) exhausted — remaining candidates skipped`);
      break;
    }
    let snippet = cand.snippet;
    let provenance: HarvestHitProvenance = "web-search";
    fetches += 1; // every attempt counts against the budget
    try {
      const rawUrl = `https://raw.githubusercontent.com/${cand.repo}/HEAD/README.md`;
      const text = await fetchText(rawUrl, { timeoutMs: Math.min(remainingMs(), 5000) });
      const clipped = clipSnippet(text, 300);
      if (clipped) {
        snippet = clipped;
        provenance = "github-raw";
      }
    } catch {
      notes.push(`raw README fetch failed for ${cand.repo} — snippet is the search summary (provenance "web-search")`);
    }

    let license: string | undefined;
    if (fetches < maxFetches && remainingMs() > 0) {
      fetches += 1;
      try {
        const data = (await fetchJson(`https://api.github.com/repos/${cand.repo}`, {
          timeoutMs: Math.min(remainingMs(), 4000),
        })) as { license?: { spdx_id?: unknown; name?: unknown } } | null;
        const lic = data && typeof data === "object" ? data.license : undefined;
        if (lic && typeof lic === "object") {
          const spdx = typeof lic.spdx_id === "string" && lic.spdx_id.trim() ? lic.spdx_id.trim() : null;
          const name = typeof lic.name === "string" && lic.name.trim() ? lic.name.trim() : null;
          if (spdx || name) {
            license = spdx ?? name ?? undefined;
            if (provenance === "web-search") provenance = "github-api";
          }
        }
      } catch {
        notes.push(`GitHub API license spot-check failed for ${cand.repo} (unreachable or rate-limited) — license left absent`);
      }
    } else if (fetches >= maxFetches) {
      notes.push(`fetch budget exhausted — license spot-check skipped for ${cand.repo}`);
    }

    hits.push({
      repo: cand.repo,
      ...(license ? { license } : {}),
      snippet,
      url: cand.url,
      provenance,
    });
  }
  if (hits.length === 0) {
    // 109 T-09: with a zero fetch budget (or a deadline that expired before
    // the first attempt) NO fetch failed — the old note claimed "all
    // candidate fetches failed", which reads as tried-and-failed. State the
    // real reason instead: zero fetch attempts were spent.
    notes.push(
      fetches > 0
        ? "all candidate fetches failed — honest empty result (no repos fabricated)"
        : "fetch budget is 0 — no candidate fetched",
    );
  }
  return { hits, notes };
}

// ---------------------------------------------------------------------------
// extractPatterns — structural regex over TOP-LEVEL declarations only.
// Pattern-level, never an AST claim (see EXTRACT_PATTERN_DISCLAIMER).
// ---------------------------------------------------------------------------

const SCHEMA_KEY_RE = /^\s*([A-Za-z_$][\w$]*)\s*[:=]/;
const SCHEMA_SCAN_MAX_LINES = 60;
const SCHEMA_KEY_MAX = 20;

/** Best-effort key collection inside an object literal starting on line i. */
function collectSchemaKeys(lines: string[], start: number): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  let depth = 0;
  let started = false;
  for (let i = start; i < lines.length && i < start + SCHEMA_SCAN_MAX_LINES; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
    }
    if (!started) started = line.includes("{");
    if (started) {
      const m = SCHEMA_KEY_RE.exec(line);
      if (m && !seen.has(m[1])) {
        seen.add(m[1]);
        keys.push(m[1]);
        if (keys.length >= SCHEMA_KEY_MAX) break;
      }
    }
    if (depth <= 0) break;
  }
  return keys;
}

function clipLine(raw: string, cap: number): string {
  const t = raw.trim();
  return t.length <= cap ? t : `${t.slice(0, cap).trimEnd()}…`;
}

export function extractPatterns(text: string): ExtractedPattern[] {
  if (typeof text !== "string") return [];
  const lines = text.split("\n");
  const out: ExtractedPattern[] = [];
  const seen = new Set<string>();
  const push = (p: ExtractedPattern): void => {
    const key = `${p.kind}:${p.line}:${p.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // Column-0 only — an indented function is nested, and claiming top-level
    // for it would be an AST-grade lie this regex layer cannot afford.
    if (raw.startsWith(" ") || raw.startsWith("\t")) continue;
    const line = raw.trim();
    const no = i + 1;

    let m = line.match(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
    if (m) push({ kind: "function", name: m[1], line: no, snippet: clipLine(raw, 160), confidence: "pattern" });
    m = line.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
    if (m) push({ kind: "function", name: m[1], line: no, snippet: clipLine(raw, 160), confidence: "pattern" });
    m = line.match(/^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/);
    if (m) push({ kind: "export", name: m[1], line: no, snippet: clipLine(raw, 160), confidence: "pattern" });
    m = line.match(/^(?:export\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)/);
    if (m) push({ kind: "type", name: m[1], line: no, snippet: clipLine(raw, 160), confidence: "pattern" });
    m = line.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/);
    if (m) {
      const keys = collectSchemaKeys(lines, i);
      push({ kind: "schema", name: m[1], line: no, snippet: clipLine(raw, 160), keys, confidence: "pattern" });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// trendNotes — deprecated-API advisory over harvested snippets (deterministic).
// ---------------------------------------------------------------------------

const TREND_MARKERS: { re: RegExp; label: string }[] = [
  { re: /\bdeprecated\b/i, label: 'mentions "deprecated"' },
  { re: /\bno longer maintained\b/i, label: 'says "no longer maintained"' },
  { re: /\barchived\b/i, label: 'mentions "archived"' },
  { re: /\bend[- ]of[- ]life\b/i, label: "has an end-of-life signal" },
  { re: /\bbreaking changes?\b/i, label: "warns of breaking changes" },
  { re: /\bremoved in v?\d/i, label: "notes a removal in a version" },
  { re: /\brenamed to\b/i, label: "points to a rename" },
];

export const TREND_NOTE_DISCLAIMER =
  "Advisory pattern-level trend notes — signals are matched inside the harvested snippets only; verify against each repo's current docs before depending on it.";

const TREND_NOTE_MAX = 7;

export function trendNotes(brief: string, hits: readonly HarvestHit[]): string[] {
  const notes: string[] = [];
  const briefHead =
    typeof brief === "string" && brief.trim() ? `brief "${clipSnippet(brief.trim(), 80)}"` : "no brief supplied";
  notes.push(`${TREND_NOTE_DISCLAIMER} (${briefHead}; ${hits.length} harvested snippet(s))`);
  const list = Array.isArray(hits) ? hits : [];
  let signals = 0;
  const seen = new Set<string>();
  for (const hit of list) {
    if (!hit || typeof hit.snippet !== "string" || !hit.snippet.trim()) continue;
    for (const marker of TREND_MARKERS) {
      if (!marker.re.test(hit.snippet)) continue;
      marker.re.lastIndex = 0; // global-state hygiene
      const key = `${hit.repo}|${marker.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      signals += 1;
      notes.push(`${hit.repo}: snippet ${marker.label} — treat as a deprecation/removal signal; verify against current docs before depending on it.`);
      if (notes.length >= TREND_NOTE_MAX) return notes;
    }
  }
  if (signals === 0) {
    notes.push(
      `No deprecation/removal signals detected in the harvested snippets — coverage is limited to the fetched text; verify critical APIs against their docs.`,
    );
  }
  return notes;
}

// ---------------------------------------------------------------------------
// harvestForPacket — project → deduped research rows (kind "research",
// provenance "harvest") for the packet/handoff pipeline.
// ---------------------------------------------------------------------------

export async function harvestForPacket(project: Project, opts: HarvestOptions = {}): Promise<HarvestPacketResult> {
  const brief =
    project && typeof project === "object" && typeof project.brief === "string" ? project.brief.trim() : "";
  if (!brief) {
    return { ok: false, reason: "validation", code: "RT_E_VALIDATION", error: "harvestForPacket requires a project with a non-empty brief" };
  }
  const plan = await buildHarvestQueries(brief, opts);
  const result = await harvestRepos(plan.queries, opts);
  const rows: HarvestRow[] = [];
  const seen = new Set<string>();
  for (const hit of result.hits) {
    if (seen.has(hit.repo)) continue; // dedupe by repo — first occurrence wins
    seen.add(hit.repo);
    rows.push({
      kind: "research",
      provenance: "harvest",
      repo: hit.repo,
      title: hit.repo,
      url: hit.url,
      snippet: hit.snippet,
      ...(hit.license ? { license: hit.license } : {}),
      hitProvenance: hit.provenance,
    });
  }
  const notes = [...result.notes];
  if (plan.note) notes.unshift(`query builder: ${plan.note}`);
  return { ok: true, rows, queries: plan.queries, querySource: plan.source, notes };
}

// ---------------------------------------------------------------------------
// Learning-loop harvest evidence (fixes/98 §3 honest-negative extension —
// fixes/101): a rate-limited or EMPTY harvest is ENGINE-DETECTABLE negative
// evidence. `harvestResultLesson` DERIVES the row that would tell the next run
// the environment (not the brief) caused the miss, so it can retry or tighten
// scope instead of re-deriving the same queries. ⚠️ DECLARE-OR-STRIKE (330 P4):
// no production seam calls either builder yet — the only harvest caller
// (headless.ts's `harvest` wrapper → the read-only `harvest` CLI verb) holds no
// persisted project, so in a real RUN no row is minted until a seam is
// specified (see fixes/330_4_cartographer.md §1.2). Level "L2" follows the drift-row precedent
// in knowledge.ts (negative-evidence class, distinct classShort); rows are
// content-addressed via lessonRow, so re-synthesis can never fork (98 §3
// anti-noise (a)). Honest floor: nothing here fabricates a repo or a claim.
// ---------------------------------------------------------------------------

/** Harvest lesson reasons: total miss vs. quota miss vs. partial-pressure. */
export type HarvestLessonReason = "rate-limit" | "empty" | "degraded";

/** The phase where the harvest itself runs (P1) — default origin for rows. */
const HARVEST_PHASE: PhaseId = 1;

const RATE_LIMIT_RE = /rate[- ]?limit/i;
const EMPTY_NOTE_RE = /empty|none|unavailable|failed|exhausted/i;

/**
 * One lesson row for a harvest outcome (honest negative evidence, 98 §2.3
 * extension). Deterministic: content-addressed id `lesson-harvest-<reason>-…`,
 * text capped by lessonRow's LESSON_TEXT_MAX budget, tags [lesson,
 * harvest-<reason>, L2, harvest, negative-evidence], source "engine", score 0.6.
 *
 * 328 P5 (112 §4.2 — T1 convergence, the harvest half): the id hashes a STABLE
 * signature — kind · phase · the harvest reason — never the volatile `detail`
 * tail (a rate-limit message varies per backend/run). A recurrence of the SAME
 * harvest failure therefore converges on ONE row instead of forking a new one
 * per run; the human-readable detail still rides the row TEXT. Identical inputs
 * are unchanged (still idempotent), and a different reason/phase stays a
 * different row — the same contract the knowledge.ts builders honour.
 */
export function harvestEvidenceLesson(
  project: Project,
  opts: { reason: HarvestLessonReason; detail: string; phase?: PhaseId },
): MemoryEntry {
  const reason: HarvestLessonReason =
    opts.reason === "rate-limit" || opts.reason === "empty" || opts.reason === "degraded"
      ? opts.reason
      : "empty";
  const phase: PhaseId = Number.isFinite(opts.phase) ? (opts.phase as PhaseId) : HARVEST_PHASE;
  const detail =
    typeof opts.detail === "string" ? opts.detail.replace(/\s+/g, " ").trim().slice(0, 160) : "";
  const briefHead =
    project && typeof project === "object" && typeof project.brief === "string"
      ? project.brief.replace(/\s+/g, " ").trim().slice(0, 60)
      : "";
  const context = detail || (briefHead ? `brief "${briefHead}"` : "no further detail");
  const what =
    reason === "rate-limit"
      ? "live-source harvest hit a rate limit"
      : reason === "degraded"
        ? "harvest served partial results under rate-limit pressure"
        : "live-source harvest returned no usable hits";
  const text = `L2 ${reason}: ${what} (${context}); honest negative evidence — nothing fabricated.`;
  // The reason IS the class: no anchors and no detail tail, so the signature is
  // stable across a differing rate-limit/empty note (failureSignature's
  // anchor-less fallback would otherwise normalize the volatile detail).
  const signature = failureSignature({ kind: "harvest-degraded", phase, classCode: reason });
  return lessonRow({
    classShort: `harvest-${reason}`,
    level: "L2",
    kind: "episodic",
    phase,
    text,
    score: 0.6,
    source: "engine",
    tags: ["harvest", "negative-evidence"],
    signature,
  });
}

/**
 * Derive the lesson row (if any) from a harvest result: zero hits + a
 * rate-limit note → "rate-limit"; zero hits otherwise → "empty"; hits present
 * but under rate-limit pressure → "degraded"; a clean non-empty harvest has
 * no negative evidence → null. Pure + deterministic; junk outcome values are
 * treated as absent (never a throw).
 */
export function harvestResultLesson(
  project: Project,
  outcome: { hits?: readonly unknown[]; notes?: readonly string[] },
  opts?: { phase?: PhaseId },
): MemoryEntry | null {
  const notes = Array.isArray(outcome?.notes)
    ? outcome.notes.filter((n): n is string => typeof n === "string")
    : [];
  const rateNote = notes.find((n) => RATE_LIMIT_RE.test(n));
  const hits = Array.isArray(outcome?.hits) ? outcome.hits.length : 0;
  if (hits === 0) {
    const reason = rateNote ? "rate-limit" : "empty";
    const detail = rateNote ?? notes.find((n) => EMPTY_NOTE_RE.test(n)) ?? notes[0] ?? "";
    return harvestEvidenceLesson(project, { reason, detail, phase: opts?.phase });
  }
  if (rateNote) {
    return harvestEvidenceLesson(project, { reason: "degraded", detail: rateNote, phase: opts?.phase });
  }
  return null;
}
