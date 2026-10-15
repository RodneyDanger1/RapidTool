import { renderHome, computeOpenStatus, getWeeklyHours, getHolidayClosures, renderHoursPage, getMenuItems, filterMenu, renderMenu } from "../generated/render-home.ts";
import { formatGbp, computeLineTotal, validateOrder, submitOrder, generateOrderReference, renderOrderConfirmation, renderContactPage } from "../generated/format-gbp.ts";
import { runQuery, listQueryRuns } from "./query.ts";
import { runTrack, listTrackRuns } from "./track.ts";
type CloseCommand = {
  id?: string;
  pageId?: string;
  status?: string;
  note?: string;
  [key: string]: unknown;
};

type Page = {
  id: string;
  status: string;
  updatedAt: string;
  kind: string;
};

type CloseRun = {
  id: string;
  commandId: string;
  status: string;
  createdAt: string;
};

const CLOSE_RUNS: Record<string, CloseRun[]> = {};

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 2147483647;
  }
  return hash;
}

function pad(value: number, width: number): string {
  let text = String(value);
  while (text.length < width) {
    text = '0' + text;
  }
  return text;
}

function ulid(seed: string): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let state = stableHash(seed);
  let out = '';
  for (let i = 0; i < 26; i += 1) {
    state = (state * 1103515245 + 12345) % 2147483647;
    out += alphabet.charAt(state % 32);
  }
  return out;
}

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Closes a Page by marking it with the requested status and returns the updated
 * Page record. The operation is deterministic and client-side only: no backend
 * persistence is performed and the entity's static in-app contract is respected.
 *
 * @param command - The close command describing which page to close and how.
 * @returns A promise resolving to the updated Page entity.
 */
async function runClose(command: CloseCommand): Promise<Page> {
  const pageId = typeof command.pageId === 'string' && command.pageId.length > 0 ? command.pageId : ulid('page:' + String(command.id ?? ''));
  const status = typeof command.status === 'string' && command.status.length > 0 ? command.status : 'closed';
  const page: Page = {
    id: pageId,
    status: status,
    updatedAt: isoNow(),
    kind: 'Page'
  };
  const runId = ulid('close-run:' + pageId + ':' + String(command.id ?? ''));
  const run: CloseRun = {
    id: runId,
    commandId: String(command.id ?? ''),
    status: status,
    createdAt: isoNow()
  };
  const existing = CLOSE_RUNS[pageId];
  if (existing) {
    existing.push(run);
  } else {
    CLOSE_RUNS[pageId] = [run];
  }
  return page;
}

/**
 * Lists the recorded close runs for a given page id, most recent first, capped
 * by the optional limit. When no runs exist the result is an empty array.
 *
 * @param id - The page id whose close runs should be listed.
 * @param limit - Optional maximum number of runs to return.
 * @returns A promise resolving to an array of CloseRun records.
 */
async function listCloseRuns(id: string, limit?: number): Promise<CloseRun[]> {
  const runs = CLOSE_RUNS[id];
  if (!runs) {
    return [];
  }
  const ordered = runs.slice().reverse();
  if (typeof limit === 'number' && limit >= 0) {
    return ordered.slice(0, limit);
  }
  return ordered;
}
export { runClose, listCloseRuns };
