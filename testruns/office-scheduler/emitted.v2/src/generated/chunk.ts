type MinutesFromMidnight = number;
type ISODate = string;
type TimeOffStatus = 'Requested' | 'Approved' | 'Denied';

interface Staff { id: string; name: string; role: string; weeklyHourCapMinutes: MinutesFromMidnight; active: boolean; }
interface Room { id: string; name: string; capacity: number; active: boolean; }
interface Shift { id: string; staffId: string; date: ISODate; start: MinutesFromMidnight; end: MinutesFromMidnight; roleNote: string; }
interface Appointment { id: string; title: string; roomId: string; date: ISODate; start: MinutesFromMidnight; end: MinutesFromMidnight; bookedBy: string; attendeeCount: number; }
interface TimeOffRequest { id: string; staffId: string; startDate: ISODate; endDate: ISODate; status: TimeOffStatus; note: string; }

/**
 * Pure overlap check for integer minute-from-midnight intervals.
 * Overlap iff startA < endB && startB < endA. Touching intervals (endA === startB)
 * do NOT overlap. Zero-duration intervals never overlap anything.
 * @param startA - first interval start in minutes from midnight
 * @param endA - first interval end in minutes from midnight
 * @param startB - second interval start in minutes from midnight
 * @param endB - second interval end in minutes from midnight
 * @returns true when the two intervals overlap
 */
// req-2
function intervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

/**
 * Duration of a shift in integer minutes from midnight. A zero-duration
 * shift (start === end) contributes 0.
 * @param shift - the shift whose duration is computed
 * @returns non-negative integer minutes
 */
// req-10
function shiftDuration(shift: Shift): number {
  const d = shift.end - shift.start;
  return d > 0 ? d : 0;
}

/**
 * Sum of shift durations for one staff member within a given Monday-Sunday
 * week window, computed with integer minutes only (no timezone conversion).
 * @param schedule - the schedule holding shifts
 * @param staffId - the staff member id
 * @param weekStart - Monday ISO date of the week window
 * @param weekEnd - Sunday ISO date of the week window
 * @returns total integer minutes of shifts in the week
 */
// req-3
// req-10
function weeklyHoursForStaff(schedule: { shifts: Shift[]; staff: Staff[]; rooms: Room[]; appointments: Appointment[]; timeOff: TimeOffRequest[] }, staffId: string, weekStart: ISODate, weekEnd: ISODate): number {
  let total = 0;
  const shifts = schedule && schedule.shifts ? schedule.shifts : [];
  for (let i = 0; i < shifts.length; i++) {
    const s = shifts[i];
    if (s.staffId === staffId && s.date >= weekStart && s.date <= weekEnd) {
      total += shiftDuration(s);
    }
  }
  return total;
}

/**
 * Validate a candidate shift: required staff, valid ISO date, integer
 * minutes-from-midnight in range, and start <= end. Returns a clear message
 * on failure and a normalized shift on success.
 * @param input - raw shift input
 * @param staff - known staff list
 * @returns ok flag, optional error message, optional normalized shift
 */
// req-1
function validateShift(input: { id: string; staffId: string; date: string; start: number; end: number; roleNote: string }, staff: Staff[]): { ok: boolean; error?: string; shift?: Shift } {
  if (!input || typeof input.staffId !== 'string' || input.staffId.length === 0) {
    return { ok: false, error: 'Validation failed: missing staff' };
  }
  if (typeof input.date !== 'string' || input.date.length === 0) {
    return { ok: false, error: 'Validation failed: missing date' };
  }
  const found = staff.some(function (s: Staff): boolean { return s.id === input.staffId; });
  if (!found) {
    return { ok: false, error: 'Validation failed: unknown staff ' + input.staffId };
  }
  if (typeof input.start !== 'number' || !isFinite(input.start) || Math.floor(input.start) !== input.start) {
    return { ok: false, error: 'Validation failed: start must be an integer minutes-from-midnight' };
  }
  if (typeof input.end !== 'number' || !isFinite(input.end) || Math.floor(input.end) !== input.end) {
    return { ok: false, error: 'Validation failed: end must be an integer minutes-from-midnight' };
  }
  if (input.start < 0 || input.start > 1440 || input.end < 0 || input.end > 1440) {
    return { ok: false, error: 'Validation failed: minutes must be within 0..1440' };
  }
  if (input.start > input.end) {
    return { ok: false, error: 'Validation failed: start must not be after end' };
  }
  return {
    ok: true,
    shift: {
      id: input.id,
      staffId: input.staffId,
      date: input.date,
      start: input.start,
      end: input.end,
      roleNote: typeof input.roleNote === 'string' ? input.roleNote : '',
    },
  };
}

/**
 * Add a shift to an immutable schedule. Refuses on overlap with the same
 * staff member on the same day (naming the conflicting shift), and refuses
 * when the weekly cap would be exceeded unless overrideHourCap is true.
 * @param schedule - current schedule
 * @param input - raw shift input
 * @param weekStart - Monday ISO date of the week
 * @param weekEnd - Sunday ISO date of the week
 * @param overrideHourCap - explicit cap override flag
 * @returns ok flag, optional error, optional updated schedule and totals
 */
// req-1
// req-2
// req-3
function addShift(schedule: { shifts: Shift[]; staff: Staff[]; rooms: Room[]; appointments: Appointment[]; timeOff: TimeOffRequest[] }, input: { id: string; staffId: string; date: string; start: number; end: number; roleNote: string }, weekStart: ISODate, weekEnd: ISODate, overrideHourCap: boolean): { ok: boolean; error?: string; schedule?: { shifts: Shift[]; staff: Staff[]; rooms: Room[]; appointments: Appointment[]; timeOff: TimeOffRequest[] }; weeklyHours?: number } {
  const v = validateShift(input, schedule.staff);
  if (!v.ok || !v.shift) {
    return { ok: false, error: v.error };
  }
  const candidate = v.shift;
  for (let i = 0; i < schedule.shifts.length; i++) {
    const existing = schedule.shifts[i];
    if (existing.staffId === candidate.staffId && existing.date === candidate.date) {
      if (intervalsOverlap(existing.start, existing.end, candidate.start, candidate.end)) {
        return { ok: false, error: 'Refused: shift ' + candidate.id + ' overlaps shift ' + existing.id + ' for staff ' + existing.staffId };
      }
    }
  }
  const current = weeklyHoursForStaff(schedule, candidate.staffId, weekStart, weekEnd);
  const projected = current + shiftDuration(candidate);
  const member = schedule.staff.filter(function (s: Staff): boolean { return s.id === candidate.staffId; })[0];
  if (member && projected > member.weeklyHourCapMinutes && !overrideHourCap) {
    return { ok: false, error: 'Warning: shift ' + candidate.id + ' would put staff ' + candidate.staffId + ' at ' + projected + ' minutes, over the cap of ' + member.weeklyHourCapMinutes + '; pass overrideHourCap to proceed' };
  }
  const next = {
    shifts: schedule.shifts.concat([candidate]),
    staff: schedule.staff,
    rooms: schedule.rooms,
    appointments: schedule.appointments,
    timeOff: schedule.timeOff,
  };
  return { ok: true, schedule: next, weeklyHours: projected };
}

/**
 * Validate a candidate appointment: room exists, attendee count is a
 * non-negative integer, times are valid integers, and capacity is respected.
 * @param input - raw appointment input
 * @param rooms - known rooms
 * @returns ok flag, optional error, optional normalized appointment
 */
// req-4
// req-5
function validateAppointment(input: { id: string; title: string; roomId: string; date: string; start: number; end: number; bookedBy: string; attendeeCount: number }, rooms: Room[]): { ok: boolean; error?: string; appointment?: Appointment } {
  if (!input || typeof input.roomId !== 'string' || input.roomId.length === 0) {
    return { ok: false, error: 'Validation failed: missing room' };
  }
  if (typeof input.date !== 'string' || input.date.length === 0) {
    return { ok: false, error: 'Validation failed: missing date' };
  }
  const room = rooms.filter(function (r: Room): boolean { return r.id === input.roomId; })[0];
  if (!room) {
    return { ok: false, error: 'Validation failed: unknown room ' + input.roomId };
  }
  if (typeof input.start !== 'number' || !isFinite(input.start) || Math.floor(input.start) !== input.start) {
    return { ok: false, error: 'Validation failed: start must be an integer minutes-from-midnight' };
  }
  if (typeof input.end !== 'number' || !isFinite(input.end) || Math.floor(input.end) !== input.end) {
    return { ok: false, error: 'Validation failed: end must be an integer minutes-from-midnight' };
  }
  if (input.start < 0 || input.start > 1440 || input.end < 0 || input.end > 1440) {
    return { ok: false, error: 'Validation failed: minutes must be within 0..1440' };
  }
  if (input.start > input.end) {
    return { ok: false, error: 'Validation failed: start must not be after end' };
  }
  if (typeof input.attendeeCount !== 'number' || Math.floor(input.attendeeCount) !== input.attendeeCount || input.attendeeCount < 0) {
    return { ok: false, error: 'Validation failed: attendee count must be a non-negative integer' };
  }
  if (input.attendeeCount > room.capacity) {
    return { ok: false, error: 'Refused: appointment ' + input.id + ' has ' + input.attendeeCount + ' attendees exceeding room ' + room.id + ' capacity ' + room.capacity };
  }
  return {
    ok: true,
    appointment: {
      id: input.id,
      title: typeof input.title === 'string' ? input.title : '',
      roomId: input.roomId,
      date: input.date,
      start: input.start,
      end: input.end,
      bookedBy: typeof input.bookedBy === 'string' ? input.bookedBy : '',
      attendeeCount: input.attendeeCount,
    },
  };
}

/**
 * Book an appointment into a room on an immutable schedule. Refuses on room
 * double-booking (naming the conflicting appointment) and on attendee count
 * over capacity (naming the room and its capacity).
 * @param schedule - current schedule
 * @param input - raw appointment input
 * @returns ok flag, optional error, optional updated schedule
 */
// req-4
// req-5
function bookAppointment(schedule: { shifts: Shift[]; staff: Staff[]; rooms: Room[]; appointments: Appointment[]; timeOff: TimeOffRequest[] }, input: { id: string; title: string; roomId: string; date: string; start: number; end: number; bookedBy: string; attendeeCount: number }): { ok: boolean; error?: string; schedule?: { shifts: Shift[]; staff: Staff[]; rooms: Room[]; appointments: Appointment[]; timeOff: TimeOffRequest[] } } {
  const v = validateAppointment(input, schedule.rooms);
  if (!v.ok || !v.appointment) {
    return { ok: false, error: v.error };
  }
  const candidate = v.appointment;
  for (let i = 0; i < schedule.appointments.length; i++) {
    const existing = schedule.appointments[i];
    if (existing.roomId === candidate.roomId && existing.date === candidate.date) {
      if (intervalsOverlap(existing.start, existing.end, candidate.start, candidate.end)) {
        return { ok: false, error: 'Refused: appointment ' + candidate.id + ' double-books room ' + existing.roomId + ' with appointment ' + existing.id };
      }
    }
  }
  const next = {
    shifts: schedule.shifts,
    staff: schedule.staff,
    rooms: schedule.rooms,
    appointments: schedule.appointments.concat([candidate]),
    timeOff: schedule.timeOff,
  };
  return { ok: true, schedule: next };
}

/**
 * Create a time-off request with status 'Requested'. Rejects when the start
 * date is after the end date.
 * @param input - raw time-off input
 * @returns ok flag, optional error, optional normalized request
 */
// req-8
function requestTimeOff(input: { id: string; staffId: string; startDate: string; endDate: string; note: string }): { ok: boolean; error?: string; request?: TimeOffRequest } {
  if (!input || typeof input.staffId !== 'string' || input.staffId.length === 0) {
    return { ok: false, error: 'Validation failed: missing staff' };
  }
  if (typeof input.startDate !== 'string' || input.startDate.length === 0) {
    return { ok: false, error: 'Validation failed: missing start date' };
  }
  if (typeof input.endDate !== 'string' || input.endDate.length === 0) {
    return { ok: false, error: 'Validation failed: missing end date' };
  }
  if (input.startDate > input.endDate) {
    return { ok: false, error: 'Validation failed: start date must not be after end date' };
  }
  return {
    ok: true,
    request: {
      id: input.id,
      staffId: input.staffId,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'Requested',
      note: typeof input.note === 'string' ? input.note : '',
    },
  };
}
export { intervalsOverlap, shiftDuration, weeklyHoursForStaff, validateShift, addShift, validateAppointment, bookAppointment, requestTimeOff };
