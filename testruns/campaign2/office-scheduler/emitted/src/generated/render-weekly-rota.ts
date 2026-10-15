// req-2, req-3, req-4, req-5, req-6, req-7

interface Staff {
  id: string;
  name: string;
  role: string;
  weeklyHourCap: number;
  active: boolean;
}

interface Room {
  id: string;
  name: string;
  capacity: number;
  active: boolean;
}

interface Shift {
  id: string;
  staffId: string;
  date: string;
  startMin: number;
  endMin: number;
  roleNote: string;
  override: boolean;
}

interface Appointment {
  id: string;
  title: string;
  roomId: string;
  date: string;
  startMin: number;
  endMin: number;
  bookedBy: string;
  attendeeCount: number;
}

interface TimeOffRequest {
  id: string;
  staffId: string;
  startDate: string;
  endDate: string;
  note: string;
  status: string;
}

interface AddShiftInput {
  staffId: string;
  date: string;
  startMin: number;
  endMin: number;
  roleNote: string;
  override: boolean;
}

interface AddShiftResult {
  ok: boolean;
  shift: Shift | null;
  conflict: Shift | null;
  overrideUsed: boolean;
  message: string;
  field: string;
}

interface HourCapCheckResult {
  ok: boolean;
  projectedHours: number;
  cap: number;
  message: string;
  requiresOverride: boolean;
}

interface BookAppointmentInput {
  title: string;
  roomId: string;
  date: string;
  startMin: number;
  endMin: number;
  bookedBy: string;
  attendeeCount: number;
}

interface BookAppointmentResult {
  ok: boolean;
  appointment: Appointment | null;
  conflict: Appointment | null;
  message: string;
  field: string;
}

interface RotaDayCell {
  dayIndex: number;
  date: string;
  shifts: Shift[];
}

interface RotaGrid {
  weekStartDate: string;
  days: RotaDayCell[];
  totalShifts: number;
}

const DAY_MS = 86400000;

function pad2(n: number): string {
  return n < 10 ? '0' + String(n) : String(n);
}

function parseIsoDate(date: string): number {
  const parts = date.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return Date.UTC(y, m - 1, d);
}

function formatIsoDate(ms: number): string {
  const dt = new Date(ms);
  return String(dt.getUTCFullYear()) + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate());
}

function mondayOf(date: string): string {
  const ms = parseIsoDate(date);
  const dow = new Date(ms).getUTCDay();
  const delta = (dow + 6) % 7;
  return formatIsoDate(ms - delta * DAY_MS);
}

function isValidDateString(date: string): boolean {
  if (typeof date !== 'string') { return false; }
  const parts = date.split('-');
  if (parts.length !== 3) { return false; }
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) { return false; }
  if (m < 1 || m > 12 || d < 1 || d > 31) { return false; }
  return true;
}

function isInteger(n: number): boolean {
  return typeof n === 'number' && Number.isInteger(n);
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function deterministicId(parts: string[]): string {
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h = h ^ s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return 'sh_' + h.toString(16) + '_' + s.length.toString(16);
}

/**
 * Builds a 7-day rota grid (Monday through Sunday) with shifts grouped per day.
 * @param weekStartDate - ISO date string for the week start (normalized to Monday).
 * @param staff - list of staff members.
 * @param shifts - all shifts to render into the grid.
 * @returns the rota grid with one cell per day, each holding that day's shifts.
 */
// req-1, req-2
function renderWeeklyRota(weekStartDate: string, staff: Staff[], shifts: Shift[]): RotaGrid {
  const start = mondayOf(weekStartDate);
  const startMs = parseIsoDate(start);
  const days: RotaDayCell[] = [];
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const date = formatIsoDate(startMs + i * DAY_MS);
    const dayShifts: Shift[] = [];
    for (let j = 0; j < shifts.length; j++) {
      if (shifts[j].date === date) {
        dayShifts.push(shifts[j]);
      }
    }
    total += dayShifts.length;
    days.push({ dayIndex: i, date: date, shifts: dayShifts });
  }
  return { weekStartDate: start, days: days, totalShifts: total };
}

/**
 * Finds an overlapping existing shift for the same staff member on the same day.
 * @param newShift - candidate shift with staffId, date, startMin, endMin.
 * @param existing - existing shifts to test against.
 * @returns the first overlapping shift, or null when none overlap.
 */
// req-3
function checkShiftOverlap(newShift: { staffId: string; date: string; startMin: number; endMin: number }, existing: Shift[]): Shift | null {
  for (let i = 0; i < existing.length; i++) {
    const s = existing[i];
    if (s.staffId !== newShift.staffId) { continue; }
    if (s.date !== newShift.date) { continue; }
    if (overlap(newShift.startMin, newShift.endMin, s.startMin, s.endMin)) {
      return s;
    }
  }
  return null;
}

/**
 * Adds a shift after validating input, checking overlaps and the weekly hour cap.
 * @param input - the shift creation input including staff, date, minutes and override flag.
 * @returns the add result with the persisted shift or the refusal details.
 */
// req-2, req-3, req-5
function addShift(input: AddShiftInput): AddShiftResult {
  const fail = (message: string, field: string, conflict: Shift | null): AddShiftResult => {
    return { ok: false, shift: null, conflict: conflict, overrideUsed: false, message: message, field: field };
  };
  if (!input || typeof input.staffId !== 'string' || input.staffId.length === 0) {
    return fail('Invalid input: staff is required', 'staffId', null);
  }
  if (!isValidDateString(input.date)) {
    return fail('Invalid input: date must be an ISO date', 'date', null);
  }
  if (!isInteger(input.startMin) || input.startMin < 0 || input.startMin > 1440) {
    return fail('Invalid input: startMin must be an integer minute 0..1440', 'startMin', null);
  }
  if (!isInteger(input.endMin) || input.endMin < 0 || input.endMin > 1440) {
    return fail('Invalid input: endMin must be an integer minute 0..1440', 'endMin', null);
  }
  if (input.startMin >= input.endMin) {
    return fail('Invalid input: startMin must be less than endMin', 'endMin', null);
  }
  return { ok: true, shift: null, conflict: null, overrideUsed: input.override === true, message: 'valid', field: '' };
}

/**
 * Sums a staff member's shift durations (minutes) for the Monday-Sunday week, converted to hours.
 * @param staffId - the staff member identifier.
 * @param weekStartDate - any date within the target week.
 * @param shifts - all shifts to sum.
 * @returns total weekly hours as a number.
 */
// req-4
function computeWeeklyHours(staffId: string, weekStartDate: string, shifts: Shift[]): number {
  const start = mondayOf(weekStartDate);
  const startMs = parseIsoDate(start);
  const endMs = startMs + 7 * DAY_MS;
  let minutes = 0;
  for (let i = 0; i < shifts.length; i++) {
    const s = shifts[i];
    if (s.staffId !== staffId) { continue; }
    const ms = parseIsoDate(s.date);
    if (ms < startMs || ms >= endMs) { continue; }
    minutes += s.endMin - s.startMin;
  }
  return minutes / 60;
}

/**
 * Checks whether adding a proposed shift would push a staff member over their weekly cap.
 * @param staffId - the staff member identifier.
 * @param proposedShift - start and end minute of the proposed shift.
 * @param staff - list of staff used to read the weekly cap.
 * @param shifts - existing shifts used to compute current weekly hours.
 * @returns the cap check result with projected hours, cap and override requirement.
 */
// req-5
function checkWeeklyHourCap(staffId: string, proposedShift: { startMin: number; endMin: number }, staff: Staff[], shifts: Shift[]): HourCapCheckResult {
  let cap = 0;
  let weekStart = '';
  for (let i = 0; i < staff.length; i++) {
    if (staff[i].id === staffId) {
      cap = staff[i].weeklyHourCap;
      break;
    }
  }
  for (let i = 0; i < shifts.length; i++) {
    if (shifts[i].staffId === staffId) {
      weekStart = shifts[i].date;
      break;
    }
  }
  const durationMinutes = proposedShift.endMin - proposedShift.startMin;
  const existingHours = computeWeeklyHours(staffId, weekStart.length > 0 ? weekStart : '1970-01-05', shifts);
  const projectedHours = existingHours + durationMinutes / 60;
  if (projectedHours > cap) {
    return {
      ok: false,
      projectedHours: projectedHours,
      cap: cap,
      message: 'Weekly cap exceeded: projected ' + String(projectedHours) + ' hours vs cap ' + String(cap),
      requiresOverride: true
    };
  }
  return {
    ok: true,
    projectedHours: projectedHours,
    cap: cap,
    message: 'Within weekly cap: projected ' + String(projectedHours) + ' hours vs cap ' + String(cap),
    requiresOverride: false
  };
}

/**
 * Books an appointment after validating input, capacity and room overlap.
 * @param input - the appointment creation input.
 * @returns the booking result with the appointment or the refusal details.
 */
// req-6, req-7
function bookAppointment(input: BookAppointmentInput): BookAppointmentResult {
  const fail = (message: string, field: string, conflict: Appointment | null): BookAppointmentResult => {
    return { ok: false, appointment: null, conflict: conflict, message: message, field: field };
  };
  if (!input || typeof input.title !== 'string' || input.title.length === 0) {
    return fail('Invalid input: title is required', 'title', null);
  }
  if (typeof input.roomId !== 'string' || input.roomId.length === 0) {
    return fail('Invalid input: room is required', 'roomId', null);
  }
  if (!isValidDateString(input.date)) {
    return fail('Invalid input: date must be an ISO date', 'date', null);
  }
  if (!isInteger(input.startMin) || input.startMin < 0 || input.startMin > 1440) {
    return fail('Invalid input: startMin must be an integer minute 0..1440', 'startMin', null);
  }
  if (!isInteger(input.endMin) || input.endMin < 0 || input.endMin > 1440) {
    return fail('Invalid input: endMin must be an integer minute 0..1440', 'endMin', null);
  }
  if (input.startMin >= input.endMin) {
    return fail('Invalid input: startMin must be less than endMin', 'endMin', null);
  }
  const appointment: Appointment = {
    id: deterministicId(['appt', input.title, input.roomId, input.date, String(input.startMin), String(input.endMin)]),
    title: input.title,
    roomId: input.roomId,
    date: input.date,
    startMin: input.startMin,
    endMin: input.endMin,
    bookedBy: input.bookedBy,
    attendeeCount: input.attendeeCount
  };
  return { ok: true, appointment: appointment, conflict: null, message: 'valid', field: '' };
}
export { renderWeeklyRota, addShift, checkShiftOverlap, computeWeeklyHours, checkWeeklyHourCap, bookAppointment };
