import { renderWeeklyRota, addShift, checkShiftOverlap, computeWeeklyHours, checkWeeklyHourCap, bookAppointment } from "../generated/render-weekly-rota.ts";
import { validateAttendeeCount, detectWeekConflicts, renderConflictDetector, getStaffWeekView, requestTimeOff, decideTimeOff } from "../generated/validate-attendee-count.ts";
import { runCustomSoftware, listCustomSoftwareRuns } from "../domain/custom-software.ts";
type CalendarStatus = 'active' | 'inactive';
type SyncStatus = 'ok' | 'failed';

type Calendar = {
  id: string;
  status: CalendarStatus;
  updatedAt: string;
};

type SyncCommand = {
  calendarId: string;
  mode: string;
  requestedAt: string;
};

type SyncRun = {
  id: string;
  calendarId: string;
  mode: string;
  status: SyncStatus;
  startedAt: string;
  finishedAt: string;
  calendar: Calendar;
};

const SYNC_RUN_LOG: SyncRun[] = [];

function pad(value: number, width: number): string {
  let out: string = String(value);
  while (out.length < width) {
    out = '0' + out;
  }
  return out;
}

function deriveSyncRunId(calendarId: string, requestedAt: string, sequence: number): string {
  const stamp: number = Date.parse(requestedAt);
  const safeStamp: number = isNaN(stamp) ? 0 : stamp;
  const base: string = pad(safeStamp % 100000000, 8);
  const seq: string = pad(sequence % 10000, 4);
  return 'sync-' + calendarId + '-' + base + '-' + seq;
}

function counterFor(calendarId: string): number {
  let count: number = 0;
  for (let i: number = 0; i < SYNC_RUN_LOG.length; i = i + 1) {
    if (SYNC_RUN_LOG[i].calendarId === calendarId) {
      count = count + 1;
    }
  }
  return count;
}

/**
 * Runs a local calendar sync command and returns the resulting Calendar record.
 * Persists the outcome in the in-memory sync run log; a command carrying an
 * unknown calendar id yields a failed (inactive) calendar rather than an
 * exception so callers can surface the load error explicitly.
 *
 * @param command the sync command (calendar id, mode, requested timestamp)
 * @returns the Calendar entity reflecting the sync outcome
 */
async function runSync(command: SyncCommand): Promise<Calendar> {
  // req-12
  const calendarId: string = typeof command.calendarId === 'string' && command.calendarId.length > 0 ? command.calendarId : 'unknown';
  const mode: string = typeof command.mode === 'string' && command.mode.length > 0 ? command.mode : 'full';
  const requestedAt: string = typeof command.requestedAt === 'string' && command.requestedAt.length > 0 ? command.requestedAt : '1970-01-01T00:00:00.000Z';
  const status: SyncStatus = calendarId === 'unknown' ? 'failed' : 'ok';
  const calendarStatus: CalendarStatus = status === 'ok' ? 'active' : 'inactive';
  const sequence: number = counterFor(calendarId) + 1;
  const runId: string = deriveSyncRunId(calendarId, requestedAt, sequence);
  const calendar: Calendar = {
    id: calendarId,
    status: calendarStatus,
    updatedAt: requestedAt,
  };
  const run: SyncRun = {
    id: runId,
    calendarId: calendarId,
    mode: mode,
    status: status,
    startedAt: requestedAt,
    finishedAt: requestedAt,
    calendar: calendar,
  };
  SYNC_RUN_LOG.push(run);
  return calendar;
}

/**
 * Lists prior sync runs for a calendar id, newest first, bounded by an
 * optional limit (defaults to 20). Returns an empty list when no runs exist.
 *
 * @param id the calendar id whose sync runs are requested
 * @param limit optional maximum number of runs to return
 * @returns the matching sync runs in reverse chronological order
 */
async function listSyncRuns(id: string, limit?: number): Promise<SyncRun[]> {
  // req-12
  const calendarId: string = typeof id === 'string' && id.length > 0 ? id : 'unknown';
  const max: number = typeof limit === 'number' && isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
  const matches: SyncRun[] = [];
  for (let i: number = SYNC_RUN_LOG.length - 1; i >= 0; i = i - 1) {
    const run: SyncRun = SYNC_RUN_LOG[i];
    if (run.calendarId === calendarId) {
      matches.push(run);
    }
  }
  const bounded: SyncRun[] = [];
  for (let j: number = 0; j < matches.length && j < max; j = j + 1) {
    bounded.push(matches[j]);
  }
  return bounded;
}
export { runSync, listSyncRuns };
