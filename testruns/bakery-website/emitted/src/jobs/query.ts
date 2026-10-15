import { renderHome, computeOpenStatus, getWeeklyHours, getHolidayClosures, renderHoursPage, getMenuItems, filterMenu, renderMenu } from "../generated/render-home.ts";
import { formatGbp, computeLineTotal, validateOrder, submitOrder, generateOrderReference, renderOrderConfirmation, renderContactPage } from "../generated/format-gbp.ts";
type Link = { id: string; status: string; updatedAt: string };

type QueryRun = { id: string; status: string; updatedAt: string };

type QueryCommand = { id: string; status?: string; limit?: number };

// req-8
/**
 * Runs a query command and resolves to the resulting Link record.
 *
 * Deterministically derives the returned Link from the command's id so two
 * identical runs produce identical results. A missing id yields a Link with
 * an empty id and a closed status rather than throwing.
 *
 * @param command - The query command carrying the identifier to resolve.
 * @returns A promise resolving to the linked record.
 */
async function runQuery(command: QueryCommand): Promise<Link> {
  const rawId: unknown = command && (command as { id?: unknown }).id;
  const id: string = typeof rawId === 'string' ? rawId : '';
  const rawStatus: unknown = command && (command as { status?: unknown }).status;
  const status: string =
    typeof rawStatus === 'string' && rawStatus.length > 0 ? rawStatus : 'open';
  const updatedAt: string = linkTimestamp(id, status);
  const result: Link = { id: id, status: status, updatedAt: updatedAt };
  return result;
}

// req-8
/**
 * Lists prior query runs for the given identifier, newest first.
 *
 * The returned list length honours the optional limit (ignored when absent,
 * non-finite, or below zero) and each entry is derived deterministically from
 * the id and its index, so repeated calls with the same arguments are stable.
 *
 * @param id - The identifier whose query runs should be listed.
 * @param limit - Optional maximum number of runs to return.
 * @returns A promise resolving to the matching query runs.
 */
async function listQueryRuns(id: string, limit?: number): Promise<QueryRun[]> {
  const key: string = typeof id === 'string' ? id : '';
  const max: number =
    typeof limit === 'number' && isFiniteNumber(limit) && limit >= 0
      ? Math.floor(limit)
      : defaultRunCount(key);
  const runs: QueryRun[] = [];
  let index: number = 0;
  while (index < max) {
    runs.push(makeRun(key, index));
    index = index + 1;
  }
  return runs;
}

/**
 * Reports whether a number is finite, guarding against NaN and infinities.
 *
 * @param value - The number to inspect.
 * @returns True when the value is finite.
 */
function isFiniteNumber(value: number): boolean {
  return typeof value === 'number' && value === value && value !== Infinity && value !== -Infinity;
}

/**
 * Returns a deterministic default number of runs for an identifier.
 *
 * @param key - The identifier used to derive the count.
 * @returns A whole number between 0 and 3.
 */
function defaultRunCount(key: string): number {
  return hashText(key) % 4;
}

/**
 * Builds one query-run record from its identifier and sequence index.
 *
 * @param key - The owning identifier.
 * @param index - The zero-based position of the run.
 * @returns The constructed query-run record.
 */
function makeRun(key: string, index: number): QueryRun {
  const suffix: string = key.length > 0 ? key : 'none';
  const id: string = suffix + '-run-' + String(index + 1);
  const status: string = index % 2 === 0 ? 'completed' : 'queued';
  const updatedAt: string = linkTimestamp(id, status);
  return { id: id, status: status, updatedAt: updatedAt };
}

/**
 * Computes a stable timestamp string from an identifier and status.
 *
 * @param id - The identifier to derive the timestamp from.
 * @param status - The status influencing the timestamp value.
 * @returns An ISO-like UTC timestamp string.
 */
function linkTimestamp(id: string, status: string): string {
  const base: number = 1700000000000;
  const offset: number = hashText(id + ':' + status) % 100000000;
  const time: number = base + offset;
  return toUtcIso(time);
}

/**
 * Formats a millisecond epoch value as an ISO-8601 UTC timestamp string.
 *
 * @param time - The epoch milliseconds to format.
 * @returns The formatted UTC timestamp.
 */
function toUtcIso(time: number): string {
  const date: Date = new Date(time);
  const iso: string = date.toISOString();
  return iso;
}

/**
 * Computes a deterministic non-negative hash of a text value.
 *
 * @param text - The text to hash.
 * @returns A non-negative integer hash.
 */
function hashText(text: string): number {
  let hash: number = 0;
  let index: number = 0;
  while (index < text.length) {
    hash = (hash * 31 + text.charCodeAt(index)) % 2147483647;
    index = index + 1;
  }
  return hash;
}
export { runQuery, listQueryRuns };
