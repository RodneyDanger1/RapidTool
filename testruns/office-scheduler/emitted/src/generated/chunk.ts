// req-1: minutes-from-midnight integer time model
type Minutes = number;
type IsoDate = string;
type TimeOffStatus = 'Requested' | 'Approved' | 'Denied';

interface Staff { id: string; name: string; role: string; weeklyHourCapMinutes: number; active: boolean }
interface Room { id: string; name: string; capacity: number; active: boolean }
interface Shift { id: string; staffId: string; date: IsoDate; startMinutes: Minutes; endMinutes: Minutes; roleNote: string }
interface Appointment { id: string; title: string; roomId: string; date: IsoDate; startMinutes: Minutes; endMinutes: Minutes; bookedBy: string; attendeeCount: number }
interface TimeOffRequest { id: string; staffId: string; startDate: IsoDate; endDate: IsoDate; status: TimeOffStatus; note?: string }

/**
 * Pure overlap predicate over minutes-from-midnight integers.
 * Returns true when two ranges share interior time.
 * req-3, req-10
 */
function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

/**
 * Duration in minutes of a shift-like range.
 * req-1, req-4, req-10
 */
function shiftDuration(startMinutes: Minutes, endMinutes: Minutes): number {
  return endMinutes - startMinutes;
}

/**
 * Seven Monday-first ISO dates for the week containing the given date.
 * Uses epoch-day arithmetic on integer day numbers, no timezone conversion.
 * req-1, req-2, req-10
 */
function weekDates(weekStart: IsoDate): IsoDate[] {
  const startDay = epochDayFromIso(weekStart);
  const out: IsoDate[] = [];
  let i = 0;
  while (i < 7) {
    out.push(isoFromEpochDay(startDay + i));
    i = i + 1;
  }
  return out;
}

/**
 * Running weekly hours (minutes) for one staff member: sum of that week's shift durations.
 * req-4, req-10
 */
function weeklyHours(shifts: Shift[], staffId: string, weekStart: IsoDate): number {
  const days = weekDates(weekStart);
  let total = 0;
  let i = 0;
  while (i < shifts.length) {
    const s = shifts[i];
    if (s.staffId === staffId && days.indexOf(s.date) !== -1) {
      total = total + shiftDuration(s.startMinutes, s.endMinutes);
    }
    i = i + 1;
  }
  return total;
}

/**
 * All shifts of the same staff member on the same date that overlap the candidate range.
 * req-3, req-10
 */
function findShiftOverlaps(existingShifts: Shift[], candidate: Shift): Shift[] {
  const found: Shift[] = [];
  let i = 0;
  while (i < existingShifts.length) {
    const s = existingShifts[i];
    if (
      s.id !== candidate.id &&
      s.staffId === candidate.staffId &&
      s.date === candidate.date &&
      overlaps(candidate.startMinutes, candidate.endMinutes, s.startMinutes, s.endMinutes)
    ) {
      found.push(s);
    }
    i = i + 1;
  }
  return found;
}

/**
 * Hour-cap outcome for a candidate shift. Returns the projected weekly total,
 * the cap and whether the shift would exceed it.
 * req-4, req-10
 */
function checkHourCap(staff: Staff, shifts: Shift[], candidate: Shift, weekStart: IsoDate): { projectedMinutes: number; capMinutes: number; exceeds: boolean; remainingMinutes: number } {
  const current = weeklyHours(shifts, staff.id, weekStart);
  const projected = current + shiftDuration(candidate.startMinutes, candidate.endMinutes);
  const capMinutes = staff.weeklyHourCapMinutes;
  return {
    projectedMinutes: projected,
    capMinutes: capMinutes,
    exceeds: projected > capMinutes,
    remainingMinutes: capMinutes - current
  };
}

/**
 * Epoch-day number for an ISO date (UTC-anchored, integer arithmetic only).
 * req-1
 */
function epochDayFromIso(iso: IsoDate): number {
  const y = parseInt(iso.slice(0, 4), 10);
  const m = parseInt(iso.slice(5, 7), 10);
  const d = parseInt(iso.slice(8, 10), 10);
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
  return jdn - 2440588;
}

/**
 * Inverse of epochDayFromIso: ISO date string from an epoch-day number.
 * req-1
 */
function isoFromEpochDay(epochDay: number): IsoDate {
  const jdn = epochDay + 2440588;
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return pad4(year) + '-' + pad2(month) + '-' + pad2(day);
}

/**
 * Pad an integer to two decimal digits.
 * req-1
 */
function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

/**
 * Pad an integer to four decimal digits.
 * req-1
 */
function pad4(n: number): string {
  if (n < 10) { return '000' + String(n); }
  if (n < 100) { return '00' + String(n); }
  if (n < 1000) { return '0' + String(n); }
  return String(n);
}
export { overlaps, weekDates, shiftDuration, weeklyHours, findShiftOverlaps, checkHourCap };
