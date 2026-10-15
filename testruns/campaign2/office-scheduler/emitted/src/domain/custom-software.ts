import { renderWeeklyRota, addShift, checkShiftOverlap, computeWeeklyHours, checkWeeklyHourCap, bookAppointment } from "../generated/render-weekly-rota.ts";
import { validateAttendeeCount, detectWeekConflicts, renderConflictDetector, getStaffWeekView, requestTimeOff, decideTimeOff } from "../generated/validate-attendee-count.ts";
type CustomSoftwareCommandStatus = string;

interface CustomSoftwareCommand {
  id?: string;
  command?: string;
  name?: string;
  status?: CustomSoftwareCommandStatus;
  payload?: Record<string, unknown>;
  updatedAt?: string;
}

interface CustomSoftwareRun {
  id: string;
  commandId: string;
  status: string;
  updatedAt: string;
}

interface Booking {
  id: string;
  status: string;
  updatedAt: string;
}

interface CustomSoftwareStore {
  runs: CustomSoftwareRun[];
  bookings: Booking[];
  seq: number;
}

const CUSTOM_SOFTWARE_STORE: CustomSoftwareStore = { runs: [], bookings: [], seq: 0 };

function isValidCustomSoftwareCommand(command: CustomSoftwareCommand | null | undefined): boolean {
  if (command === null || command === undefined) {
    return false;
  }
  if (typeof command !== 'object') {
    return false;
  }
  const hasCommand: boolean = typeof command.command === 'string' && command.command.length > 0;
  const hasName: boolean = typeof command.name === 'string' && command.name.length > 0;
  return hasCommand || hasName;
}

function makeCustomSoftwareId(prefix: string, seq: number): string {
  const padded: string = String(seq).padStart(6, '0');
  return prefix + '-0000000000-' + padded;
}

function makeCustomSoftwareRunId(seq: number): string {
  return makeCustomSoftwareId('run', seq);
}

function makeCustomSoftwareBookingId(seq: number): string {
  return makeCustomSoftwareId('booking', seq);
}

function nowIso(): string {
  return new Date(0).toISOString();
}

/**
 * Run a custom software command and persist the resulting booking.
 *
 * // req-12
 *
 * @param command - the custom software command to execute; must be a non-null object
 *   carrying a non-empty `command` or `name`.
 * @returns a Promise resolving to the persisted Booking record.
 */
async function runCustomSoftware(command: CustomSoftwareCommand): Promise<Booking> {
  const valid: boolean = isValidCustomSoftwareCommand(command);
  if (!valid) {
    throw new Error('runCustomSoftware: invalid command: missing command or name');
  }

  CUSTOM_SOFTWARE_STORE.seq = CUSTOM_SOFTWARE_STORE.seq + 1;
  const runSeq: number = CUSTOM_SOFTWARE_STORE.seq;
  const runId: string = makeCustomSoftwareRunId(runSeq);
  const timestamp: string = nowIso();

  const run: CustomSoftwareRun = {
    id: runId,
    commandId: typeof command.id === 'string' ? command.id : runId,
    status: typeof command.status === 'string' && command.status.length > 0 ? command.status : 'scheduled',
    updatedAt: timestamp
  };

  CUSTOM_SOFTWARE_STORE.runs.push(run);

  CUSTOM_SOFTWARE_STORE.seq = CUSTOM_SOFTWARE_STORE.seq + 1;
  const bookingSeq: number = CUSTOM_SOFTWARE_STORE.seq;
  const booking: Booking = {
    id: makeCustomSoftwareBookingId(bookingSeq),
    status: 'scheduled',
    updatedAt: timestamp
  };

  CUSTOM_SOFTWARE_STORE.bookings.push(booking);

  return booking;
}

/**
 * List previously persisted custom software runs, newest last.
 *
 * // req-12
 *
 * @param id - the command id whose runs should be listed; empty string lists all runs.
 * @param limit - optional maximum number of runs to return; must be a positive integer when provided.
 * @returns a Promise resolving to the matching CustomSoftwareRun records.
 */
async function listCustomSoftwareRuns(id: string, limit?: number): Promise<CustomSoftwareRun[]> {
  const all: CustomSoftwareRun[] = CUSTOM_SOFTWARE_STORE.runs.slice();
  const matches: CustomSoftwareRun[] = all.filter((run: CustomSoftwareRun): boolean => {
    if (id === '') {
      return true;
    }
    return run.commandId === id;
  });

  if (typeof limit === 'number' && isFinite(limit) && limit > 0) {
    const capped: number = Math.floor(limit);
    return matches.slice(0, capped);
  }

  return matches;
}
export { runCustomSoftware, listCustomSoftwareRuns };
