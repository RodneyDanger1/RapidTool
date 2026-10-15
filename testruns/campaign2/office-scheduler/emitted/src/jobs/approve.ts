import { renderWeeklyRota, addShift, checkShiftOverlap, computeWeeklyHours, checkWeeklyHourCap, bookAppointment } from "../generated/render-weekly-rota.ts";
import { validateAttendeeCount, detectWeekConflicts, renderConflictDetector, getStaffWeekView, requestTimeOff, decideTimeOff } from "../generated/validate-attendee-count.ts";
import { runCustomSoftware, listCustomSoftwareRuns } from "../domain/custom-software.ts";
import { runSync, listSyncRuns } from "./sync.ts";
import { runScan, listScanRuns } from "./scan.ts";
import { runAssign, listAssignRuns } from "./assign.ts";
import { saveSchedule, loadSchedule } from "./schedule.ts";
// req-11: flag an approved time-off range that overlaps an existing shift,
// naming both the shift and the time-off request.
//
// This module implements the single exported signature assigned to this file:
//   checkApprovedTimeOffOverlap(shift: Shift, requests: TimeOffRequest[]): TimeOffRequest | null
//
// Only APPROVED time off is considered (Requested / Denied are ignored). The
// overlap rule is the project-wide half-open rule: startA < endB && startB < endA,
// so touching intervals (startA == endB or startB == endA) are NOT overlaps.
// Dates are compared as identical ISO day strings; times are minutes-from-midnight
// integers per date, with no timezone conversion whatsoever.

/** A single scheduled shift. Times are minutes-from-midnight integers per date. */
type Shift = {
  id: string;
  staff: string;
  date: string;
  start: number;
  end: number;
  roleNote?: string;
  override?: boolean;
};

/** Status of a time-off request. Only "Approved" is flagged as a hard conflict. */
type TimeOffStatus = "Requested" | "Approved" | "Denied";

/** A time-off request spanning an inclusive date range. */
type TimeOffRequest = {
  id: string;
  staff: string;
  startDate: string;
  endDate: string;
  status: TimeOffStatus;
  note: string;
};

/**
 * Compare two ISO day strings (YYYY-MM-DD) as plain lexicographic ranges.
 * An ISO day is a fixed-width string, so string ordering equals date ordering
 * and no Date construction (hence no timezone) is ever performed.
 */
function compareDay(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/**
 * Does an approved time-off range overlap a shift on a single date, using the
 * half-open rule startA < endB && startB < endA so touching intervals pass?
 */
function rangeOverlapsShift(
  requestStart: number,
  requestEnd: number,
  shiftStart: number,
  shiftEnd: number
): boolean {
  return requestStart < shiftEnd && shiftStart < requestEnd;
}

/**
 * Find the first approved time-off request that overlaps the given shift.
 *
 * A request is flagged only when its status is "Approved" and the shift's date
 * falls within the request's inclusive start/end date range under the half-open
 * minute overlap rule (partial overlap on either end, or full containment, both
 * flag; exact touching at a boundary does not). Requested and Denied requests
 * never produce a hard conflict. The returned request names the offending
 * entry so callers can report both the shift and the request.
 *
 * @param shift - the scheduled shift to test (date plus minute range).
 * @param requests - all time-off requests; only Approved ones are considered.
 * @returns the first overlapping approved TimeOffRequest, or null if none.
 */
function checkApprovedTimeOffOverlap(
  shift: Shift,
  requests: TimeOffRequest[]
): TimeOffRequest | null {
  // Empty data (no requests) yields no conflict and no error.
  if (requests.length === 0) {
    return null;
  }

  for (const request of requests) {
    // Only Approved time off is a hard conflict; skip anything else.
    if (request.status !== "Approved") {
      continue;
    }

    // The shift date must sit inside the request's inclusive day range.
    const afterOrOnStart = compareDay(shift.date, request.startDate) >= 0;
    const beforeOrOnEnd = compareDay(shift.date, request.endDate) <= 0;
    if (!afterOrOnStart || !beforeOrOnEnd) {
      continue;
    }

    // A request spanning whole days blocks the entire day: minutes 0..1440.
    const requestStart = 0;
    const requestEnd = 1440;

    if (rangeOverlapsShift(requestStart, requestEnd, shift.start, shift.end)) {
      return request;
    }
  }

  return null;
}
export { checkApprovedTimeOffOverlap };
