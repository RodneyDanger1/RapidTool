import { renderHome, computeOpenStatus, getWeeklyHours, getHolidayClosures, renderHoursPage, getMenuItems, filterMenu, renderMenu } from "../generated/render-home.ts";
import { formatGbp, computeLineTotal, validateOrder, submitOrder, generateOrderReference, renderOrderConfirmation, renderContactPage } from "../generated/format-gbp.ts";
import { runQuery, listQueryRuns } from "./query.ts";
import { runTrack, listTrackRuns } from "./track.ts";
import { runClose, listCloseRuns } from "./close.ts";
import { runSearch, listSearchRuns } from "./search.ts";
type ShowStatus = 'queued' | 'running' | 'succeeded' | 'failed';

type ShowCommand = {
  id: string;
  title?: string;
  format?: string;
  payload?: Record<string, unknown>;
};

type Text = {
  id: string;
  kind: 'text';
  body: string;
  status: ShowStatus;
  updatedAt: string;
};

type ShowRun = {
  id: string;
  command: string;
  status: ShowStatus;
  textId: string;
  startedAt: string;
  finishedAt: string;
};

type TextStore = Record<string, Text>;
type RunStore = Record<string, ShowRun[]>;

const showTextStore: TextStore = {};
const showRunStore: RunStore = {};
const showSequenceStore: Record<string, number> = {};
const SHOW_EPOCH = '2024-01-01T00:00:00.000Z';

function showPad(value: number, width: number): string {
  let out = String(Math.abs(Math.trunc(value)));
  while (out.length < width) {
    out = '0' + out;
  }
  return out;
}

function showStableHash(value: string): number {
  let hash = 7;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 1000000007;
  }
  return hash;
}

function showNextSequence(id: string): number {
  const current = showSequenceStore[id] === undefined ? 0 : showSequenceStore[id];
  const next = current + 1;
  showSequenceStore[id] = next;
  return next;
}

function showTimestamp(sequence: number): string {
  const base = 1704067200000;
  return new Date(base + sequence * 60000).toISOString();
}

/**
 * Executes a show command for the Golden Crust marketing pipeline and returns
 * the deterministic text record it produced.
 *
 * @param command - The show command describing the run to execute.
 * @returns A promise resolving to the produced text payload.
 */
// req-1
async function runShow(command: ShowCommand): Promise<Text> {
  const id = command && typeof command.id === 'string' && command.id.length > 0 ? command.id : 'show';
  const title = command && typeof command.title === 'string' && command.title.length > 0 ? command.title : 'show';
  const format = command && typeof command.format === 'string' && command.format.length > 0 ? command.format : 'text';
  const sequence = showNextSequence(id);
  const stamp = showTimestamp(sequence);
  const body = title + ' :: ' + format + ' :: ' + String(sequence);
  const textId = 'txt_' + showPad(showStableHash(id) % 1000000, 6) + '_' + showPad(sequence, 4);
  const text: Text = {
    id: textId,
    kind: 'text',
    body: body,
    status: 'succeeded',
    updatedAt: stamp,
  };
  showTextStore[textId] = text;
  const run: ShowRun = {
    id: 'run_' + showPad(showStableHash(id + ':' + String(sequence)) % 1000000, 6),
    command: id,
    status: 'succeeded',
    textId: textId,
    startedAt: SHOW_EPOCH,
    finishedAt: stamp,
  };
  const existing: ShowRun[] = showRunStore[id] === undefined ? [] : showRunStore[id];
  const next: ShowRun[] = existing.slice();
  next.push(run);
  showRunStore[id] = next;
  return text;
}

/**
 * Lists the recorded show runs for a given show id, newest first, limited by
 * an optional maximum count.
 *
 * @param id - The show identifier whose runs should be listed.
 * @param limit - Optional maximum number of runs to return.
 * @returns A promise resolving to the matching show runs.
 */
// req-1
async function listShowRuns(id: string, limit?: number): Promise<ShowRun[]> {
  const key = typeof id === 'string' ? id : '';
  const stored: ShowRun[] = showRunStore[key] === undefined ? [] : showRunStore[key];
  const ordered: ShowRun[] = stored.slice().reverse();
  if (typeof limit === 'number' && isFinite(limit) && limit >= 0) {
    const capped = Math.trunc(limit);
    return ordered.slice(0, capped);
  }
  return ordered;
}
export { runShow, listShowRuns };
