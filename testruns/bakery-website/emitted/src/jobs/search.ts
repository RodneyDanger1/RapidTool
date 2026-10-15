import { renderHome, computeOpenStatus, getWeeklyHours, getHolidayClosures, renderHoursPage, getMenuItems, filterMenu, renderMenu } from "../generated/render-home.ts";
import { formatGbp, computeLineTotal, validateOrder, submitOrder, generateOrderReference, renderOrderConfirmation, renderContactPage } from "../generated/format-gbp.ts";
import { runQuery, listQueryRuns } from "./query.ts";
import { runTrack, listTrackRuns } from "./track.ts";
import { runClose, listCloseRuns } from "./close.ts";
type SearchCommandStatus = 'pending' | 'running' | 'done' | 'failed';

interface SearchCommand {
  id: string;
  text: string;
  status?: SearchCommandStatus;
  limit?: number;
  offset?: number;
  filter?: string;
}

interface Table {
  id: string;
  status: SearchCommandStatus;
  updatedAt: string;
  rows: TableRow[];
  total: number;
  query: string;
}

interface TableRow {
  id: string;
  name: string;
  score: number;
  tags: string[];
}

interface SearchRun {
  id: string;
  commandId: string;
  status: SearchCommandStatus;
  updatedAt: string;
  resultCount: number;
  query: string;
}

const GOLDEN_CRUST_SEARCH_RUNS: SearchRun[] = [];

function goldenCrustPad4(value: number): string {
  let text: string = String(Math.abs(Math.trunc(value)));
  while (text.length < 4) {
    text = '0' + text;
  }
  return text.slice(-4);
}

function goldenCrustSeed(text: string): number {
  let hash: number = 7;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 1000003;
  }
  return hash;
}

function goldenCrustScore(query: string, text: string): number {
  const q: string = query.trim().toLowerCase();
  const t: string = text.toLowerCase();
  if (q.length === 0) {
    return 0;
  }
  let hits: number = 0;
  let index: number = 0;
  while (index < t.length) {
    const found: number = t.indexOf(q, index);
    if (found < 0) {
      break;
    }
    hits += 1;
    index = found + q.length;
  }
  if (t.indexOf(q) === 0) {
    hits += 1;
  }
  return hits;
}

function goldenCrustNowIso(): string {
  const stamp: number = goldenCrustSeed(String(GOLDEN_CRUST_SEARCH_RUNS.length));
  return '2024-01-01T00:00:' + goldenCrustPad4(stamp % 60) + 'Z';
}

/**
 * Executes a search command and returns a deterministic Table of matches.
 * The row set derives from the query text and the run history already
 * recorded on this module, never from real time or randomness.
 *
 * @param command - the search command carrying the query text and paging hints
 * @returns a promise of the resulting Table
 */
async function runSearch(command: SearchCommand): Promise<Table> {
  // req-5
  const query: string = typeof command.text === 'string' ? command.text : '';
  const trimmed: string = query.trim();
  const seed: number = goldenCrustSeed(command.id + '|' + trimmed);
  const candidateCount: number = trimmed.length === 0 ? 0 : 1 + (seed % 8);
  const rows: TableRow[] = [];
  for (let i = 0; i < candidateCount; i += 1) {
    const name: string = trimmed.length === 0 ? '' : trimmed + ' item ' + goldenCrustPad4(i + 1);
    const score: number = goldenCrustScore(trimmed, name);
    if (trimmed.length === 0 || score > 0) {
      rows.push({
        id: 'row-' + goldenCrustPad4(i + 1),
        name: name,
        score: score,
        tags: ['gluten', 'dairy', 'nuts', 'egg', 'vegan'].slice(0, seed % 5),
      });
    }
  }
  const offset: number = typeof command.offset === 'number' && command.offset > 0 ? Math.trunc(command.offset) : 0;
  const limit: number = typeof command.limit === 'number' && command.limit > 0 ? Math.trunc(command.limit) : rows.length;
  const paged: TableRow[] = rows.slice(offset, offset + limit);
  const table: Table = {
    id: 'table-' + goldenCrustPad4(seed),
    status: 'done',
    updatedAt: goldenCrustNowIso(),
    rows: paged,
    total: rows.length,
    query: trimmed,
  };
  GOLDEN_CRUST_SEARCH_RUNS.push({
    id: 'run-' + goldenCrustPad4(GOLDEN_CRUST_SEARCH_RUNS.length + 1),
    commandId: command.id,
    status: table.status,
    updatedAt: table.updatedAt,
    resultCount: rows.length,
    query: trimmed,
  });
  return table;
}

/**
 * Lists the search runs recorded so far for a given command id, most recent
 * last, optionally capped by a limit.
 *
 * @param id - the command id whose runs should be listed
 * @param limit - optional maximum number of runs to return
 * @returns a promise of the matching SearchRun records
 */
async function listSearchRuns(id: string, limit?: number): Promise<SearchRun[]> {
  // req-5
  const matches: SearchRun[] = GOLDEN_CRUST_SEARCH_RUNS.filter((run: SearchRun): boolean => run.commandId === id);
  if (typeof limit === 'number' && limit >= 0) {
    return matches.slice(0, Math.trunc(limit));
  }
  return matches;
}
export { runSearch, listSearchRuns };
