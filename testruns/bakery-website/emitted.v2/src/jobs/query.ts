import { computeOpenStatus, getTodayHighlights } from "../generated/compute-open-status.ts";
import { renderOpenBadge, filterMenuItems, groupMenuByCategory, formatGBP, computeOrderTotal, validateOrder, generateOrderReference, submitOrder } from "../generated/render-open-badge.ts";
import { renderMenuPage, renderHoursPage, renderContactPage, renderOrderForm } from "../generated/render-menu-page.ts";
// req-10
/**
 * A single command issued against the query endpoint.
 */
type QueryCommand = {
  command: string;
  target?: string;
  options?: Record<string, unknown>;
  submittedAt?: string;
};

/**
 * A record of one query run, returned by listQueryRuns.
 */
type QueryRun = {
  id: string;
  command: string;
  target: string;
  status: string;
  ranAt: string;
  resultCount: number;
};

/**
 * A persisted Link entity as tracked by the query endpoint.
 */
type Link = {
  id: string;
  status: string;
  updatedAt: string;
  href: string;
  label: string;
};

// Deterministic in-memory store for query runs and links, keyed by run id.
const queryRunStore: Record<string, QueryRun> = {};
const queryLinkStore: Record<string, Link> = {};
const queryOrder: string[] = [];

/**
 * Normalize a free-text command into a stable, lowercase, trimmed token.
 */
function normalizeQueryCommand(command: string): string {
  const trimmed: string = command.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : "query";
}

/**
 * Derive a deterministic ulid-like identifier from a seed string.
 */
function deriveQueryId(seed: string): string {
  const alphabet: string = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let hashA: number = 2166136261;
  let hashB: number = 5381;
  for (let i: number = 0; i < seed.length; i += 1) {
    const code: number = seed.charCodeAt(i);
    hashA = ((hashA ^ code) * 16777619) >>> 0;
    hashB = ((hashB * 33) ^ code) >>> 0;
  }
  let out: string = "";
  let cursor: number = hashA;
  for (let i: number = 0; i < 13; i += 1) {
    out += alphabet.charAt(cursor % 32);
    cursor = Math.floor(cursor / 32) + hashB + i;
  }
  let outB: string = "";
  let cursorB: number = hashB;
  for (let i: number = 0; i < 13; i += 1) {
    outB += alphabet.charAt(cursorB % 32);
    cursorB = Math.floor(cursorB / 32) + hashA + i;
  }
  return out + outB;
}

/**
 * Determine whether a normalized command targets a link resource.
 */
function isLinkCommand(normalized: string): boolean {
  return normalized.indexOf("link") >= 0 || normalized.indexOf("hours") >= 0 || normalized.indexOf("direction") >= 0;
}

/**
 * Resolve the display label for a query command.
 */
function resolveQueryLabel(normalized: string, fallback: string): string {
  if (normalized.indexOf("direction") >= 0) {
    return "Get directions";
  }
  if (normalized.indexOf("hours") >= 0) {
    return "Opening hours";
  }
  if (normalized.indexOf("contact") >= 0) {
    return "Contact";
  }
  return fallback.length > 0 ? fallback : "Golden Crust";
}

/**
 * Produce an href for a query command without any network access.
 */
function resolveQueryHref(normalized: string): string {
  if (normalized.indexOf("direction") >= 0) {
    return "/hours#directions";
  }
  if (normalized.indexOf("hours") >= 0) {
    return "/hours";
  }
  if (normalized.indexOf("menu") >= 0) {
    return "/menu";
  }
  if (normalized.indexOf("order") >= 0) {
    return "/order";
  }
  if (normalized.indexOf("contact") >= 0) {
    return "/contact";
  }
  return "/";
}

// req-1
/**
 * Run a single read-only query command and resolve the resulting Link.
 *
 * The command is normalized, run against the in-memory query store, and a
 * deterministic Link is returned with its status and updatedAt stamped from
 * the command's submittedAt (or a stable default).
 *
 * @param command - the query command to run.
 * @returns a Promise resolving to the persisted Link for this run.
 */
async function runQuery(command: QueryCommand): Promise<Link> {
  const normalized: string = normalizeQueryCommand(command.command);
  const target: string = typeof command.target === "string" && command.target.trim().length > 0 ? command.target.trim() : normalized;
  const submittedAt: string = typeof command.submittedAt === "string" && command.submittedAt.length > 0 ? command.submittedAt : "1970-01-01T00:00:00.000Z";
  const seed: string = normalized + "|" + target + "|" + submittedAt;
  const runId: string = deriveQueryId(seed);
  const options: Record<string, unknown> = typeof command.options === "object" && command.options !== null ? command.options : {};
  const optionsKeys: string[] = Object.keys(options).sort();
  const optionTrace: string = optionsKeys.map((key: string): string => key + "=" + String(options[key])).join("&");
  const resultCount: number = optionTrace.length > 0 ? optionsKeys.length + 1 : 1;

  const run: QueryRun = {
    id: runId,
    command: normalized,
    target: target,
    status: "complete",
    ranAt: submittedAt,
    resultCount: resultCount,
  };
  queryRunStore[runId] = run;
  if (queryOrder.indexOf(runId) < 0) {
    queryOrder.push(runId);
  }

  const label: string = resolveQueryLabel(normalized, target);
  const href: string = resolveQueryHref(normalized);
  const link: Link = {
    id: isLinkCommand(normalized) ? runId : deriveQueryId("link|" + seed),
    status: "active",
    updatedAt: submittedAt,
    href: href,
    label: label,
  };
  queryLinkStore[link.id] = link;
  return link;
}

// req-1
/**
 * List previously recorded query runs, newest first, capped at an optional limit.
 *
 * @param id - the id whose query runs should be listed.
 * @param limit - optional maximum number of runs to return (defaults to 50).
 * @returns a Promise resolving to an array of QueryRun records.
 */
async function listQueryRuns(id: string, limit?: number): Promise<QueryRun[]> {
  const normalizedId: string = typeof id === "string" ? id.trim() : "";
  const max: number = typeof limit === "number" && isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
  const runs: QueryRun[] = [];
  for (let i: number = queryOrder.length - 1; i >= 0; i -= 1) {
    const run: QueryRun = queryRunStore[queryOrder[i]];
    if (normalizedId.length === 0 || run.id === normalizedId || run.target === normalizedId || (queryLinkStore[run.id] !== undefined && queryLinkStore[run.id].id === normalizedId)) {
      runs.push(run);
    }
    if (runs.length >= max) {
      break;
    }
  }
  return runs;
}
export { runQuery, listQueryRuns };
