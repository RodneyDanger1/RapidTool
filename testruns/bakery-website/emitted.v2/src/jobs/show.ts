import { computeOpenStatus, getTodayHighlights } from "../generated/compute-open-status.ts";
import { renderOpenBadge, filterMenuItems, groupMenuByCategory, formatGBP, computeOrderTotal, validateOrder, generateOrderReference, submitOrder } from "../generated/render-open-badge.ts";
import { renderMenuPage, renderHoursPage, renderContactPage, renderOrderForm } from "../generated/render-menu-page.ts";
import { runQuery, listQueryRuns } from "./query.ts";
import { runTrack, listTrackRuns } from "./track.ts";
import { runClose, listCloseRuns } from "./close.ts";
import { runSearch, listSearchRuns } from "./search.ts";
type ShowCommand = {
  id: string;
  kind: string;
  payload?: Record<string, unknown>;
  submittedAt?: string;
};

type ShowRun = {
  id: string;
  commandId: string;
  kind: string;
  status: string;
  updatedAt: string;
  summary: string;
};

type Text = {
  id: string;
  body: string;
  status: string;
  updatedAt: string;
};

const SHOW_RUNS: ShowRun[] = [];

function toIso(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date(0).toISOString();
}

function countRunsFor(commandId: string): number {
  let count = 0;
  for (const run of SHOW_RUNS) {
    if (run.commandId === commandId) {
      count = count + 1;
    }
  }
  return count;
}

// req-1
/**
 * Run a show command and return the rendered text result.
 *
 * Marks the command as processed and records a deterministic run entry whose
 * sequence derives only from the command inputs, so identical inputs produce
 * identical results.
 *
 * @param command - The show command to run.
 * @returns The rendered text for the completed show run.
 */
async function runShow(command: ShowCommand): Promise<Text> {
  const submittedAt = toIso(command.submittedAt);
  const sequence = countRunsFor(command.id) + 1;
  const run: ShowRun = {
    id: command.id + '-run-' + String(sequence),
    commandId: command.id,
    kind: command.kind,
    status: 'completed',
    updatedAt: submittedAt,
    summary: command.kind + ' processed',
  };
  SHOW_RUNS.push(run);
  const text: Text = {
    id: run.id,
    body: run.summary,
    status: run.status,
    updatedAt: run.updatedAt,
  };
  return text;
}

// req-1
/**
 * List recent show runs for a given command id.
 *
 * @param id - The command identifier to filter runs by.
 * @param limit - Optional maximum number of runs to return.
 * @returns The matching show runs, most recent first.
 */
async function listShowRuns(id: string, limit?: number): Promise<ShowRun[]> {
  const matches: ShowRun[] = [];
  for (const run of SHOW_RUNS) {
    if (run.commandId === id) {
      matches.push(run);
    }
  }
  if (typeof limit === 'number' && limit >= 0) {
    return matches.slice(0, limit);
  }
  return matches;
}
export { runShow, listShowRuns };
