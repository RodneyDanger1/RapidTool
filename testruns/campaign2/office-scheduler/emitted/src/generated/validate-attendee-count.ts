import { renderWeeklyRota, addShift, checkShiftOverlap, computeWeeklyHours, checkWeeklyHourCap, bookAppointment } from "./render-weekly-rota.ts";
type Room = {
  id: string;
  name: string;
  capacity: number;
  active: boolean;
};

type Staff = {
  id: string;
  name: string;
  role: string;
  weeklyHourCap: number;
  active: boolean;
};

type Shift = {
  id: string;
  staff: string;
  date: string;
  start: number;
  end: number;
  roleNote?: string;
  overridden?: boolean;
};

type Appointment = {
  id: string;
  title: string;
  room: string;
  date: string;
  start: number;
  end: number;
  bookedBy: string;
  attendees: number;
};

type TimeOffRequest = {
  id: string;
  staff: string;
  startDate: string;
  endDate: string;
  status: 'Requested' | 'Approved' | 'Denied';
  note: string;
};

type ScheduleData = {
  staff: Staff[];
  rooms: Room[];
  shifts: Shift[];
  appointments: Appointment[];
  timeOffRequests: TimeOffRequest[];
};

type Conflict = {
  kind: 'room-double-booking' | 'staff-shift-overlap' | 'shift-time-off-overlap';
  entryA: string;
  entryB: string;
  message: string;
};

type ConflictScreen = {
  weekStartDate: string;
  conflicts: Conflict[];
  empty: boolean;
};

type StaffWeekView = {
  staffId: string;
  weekStartDate: string;
  shifts: Shift[];
  approvedTimeOff: TimeOffRequest[];
  deniedTimeOff: TimeOffRequest[];
  requestedTimeOff: TimeOffRequest[];
  weeklyHours: number;
};

type TimeOffRequestInput = {
  staff: string;
  startDate: string;
  endDate: string;
  note: string;
};

type TimeOffRequestResult = {
  ok: boolean;
  request?: TimeOffRequest;
  reason?: string;
  conflictWith?: TimeOffRequest;
};

type TimeOffDecisionResult = {
  ok: boolean;
  request?: TimeOffRequest;
  reason?: string;
};

function validateAttendeeCount(attendeeCount: number, room: Room): { ok: boolean; reason?: string } {
  if (!room || room.capacity === undefined || room.capacity === null) {
    return { ok: false, reason: 'Room not found.' };
  }
  if (!Number.isInteger(attendeeCount) || attendeeCount < 0) {
    return { ok: false, reason: 'Attendee count must be a non-negative integer.' };
  }
  if (attendeeCount > room.capacity) {
    return {
      ok: false,
      reason: `Attendees ${attendeeCount} exceed room "${room.name}" capacity ${room.capacity}.`
    };
  }
  return { ok: true };
}

function addDays(dateStr: string, days: number): string {
  const parts: string[] = dateStr.split('-');
  const year: number = parseInt(parts[0], 10);
  const month: number = parseInt(parts[1], 10);
  const day: number = parseInt(parts[2], 10);
  const d: Date = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  const ry: number = d.getUTCFullYear();
  const rm: number = d.getUTCMonth() + 1;
  const rd: number = d.getUTCDate();
  const mm: string = rm < 10 ? '0' + String(rm) : String(rm);
  const dd: string = rd < 10 ? '0' + String(rd) : String(rd);
  return `${ry}-${mm}-${dd}`;
}

function weekDates(weekStartDate: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    out.push(addDays(weekStartDate, i));
  }
  return out;
}

function dateInRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate;
}

function minutesOverlap(sa: number, ea: number, sb: number, eb: number): boolean {
  return sa < eb && sb < ea;
}

function detectWeekConflicts(weekStartDate: string, data: ScheduleData): Conflict[] {
  const conflicts: Conflict[] = [];
  const dates: string[] = weekDates(weekStartDate);
  const shifts: Shift[] = data && data.shifts ? data.shifts : [];
  const appointments: Appointment[] = data && data.appointments ? data.appointments : [];
  const timeOff: TimeOffRequest[] = data && data.timeOffRequests ? data.timeOffRequests : [];

  for (let i = 0; i < shifts.length; i++) {
    const a: Shift = shifts[i];
    if (dates.indexOf(a.date) === -1) continue;
    for (let j = i + 1; j < shifts.length; j++) {
      const b: Shift = shifts[j];
      if (dates.indexOf(b.date) === -1) continue;
      if (a.staff !== b.staff || a.date !== b.date) continue;
      if (minutesOverlap(a.start, a.end, b.start, b.end)) {
        conflicts.push({
          kind: 'staff-shift-overlap',
          entryA: a.id,
          entryB: b.id,
          message: `Staff shift ${a.id} overlaps shift ${b.id} on ${a.date}.`
        });
      }
    }
  }

  for (let i = 0; i < appointments.length; i++) {
    const a: Appointment = appointments[i];
    if (dates.indexOf(a.date) === -1) continue;
    for (let j = i + 1; j < appointments.length; j++) {
      const b: Appointment = appointments[j];
      if (dates.indexOf(b.date) === -1) continue;
      if (a.room !== b.room || a.date !== b.date) continue;
      if (minutesOverlap(a.start, a.end, b.start, b.end)) {
        conflicts.push({
          kind: 'room-double-booking',
          entryA: a.id,
          entryB: b.id,
          message: `Room booking ${a.id} overlaps booking ${b.id} in room ${a.room} on ${a.date}.`
        });
      }
    }
  }

  for (let i = 0; i < shifts.length; i++) {
    const s: Shift = shifts[i];
    if (dates.indexOf(s.date) === -1) continue;
    for (let j = 0; j < timeOff.length; j++) {
      const t: TimeOffRequest = timeOff[j];
      if (t.status !== 'Approved') continue;
      if (t.staff !== s.staff) continue;
      if (!dateInRange(s.date, t.startDate, t.endDate)) continue;
      conflicts.push({
        kind: 'shift-time-off-overlap',
        entryA: s.id,
        entryB: t.id,
        message: `Shift ${s.id} overlaps approved time off ${t.id}.`
      });
    }
  }

  return conflicts;
}

function renderConflictDetector(weekStartDate: string, conflicts: Conflict[]): ConflictScreen {
  const list: Conflict[] = conflicts ? conflicts : [];
  return {
    weekStartDate: weekStartDate,
    conflicts: list,
    empty: list.length === 0
  };
}

function getStaffWeekView(staffId: string, weekStartDate: string, data: ScheduleData): StaffWeekView {
  const dates: string[] = weekDates(weekStartDate);
  const shifts: Shift[] = data && data.shifts ? data.shifts : [];
  const timeOff: TimeOffRequest[] = data && data.timeOffRequests ? data.timeOffRequests : [];

  const staffShifts: Shift[] = [];
  let weeklyHours = 0;
  for (let i = 0; i < shifts.length; i++) {
    const s: Shift = shifts[i];
    if (s.staff !== staffId) continue;
    if (dates.indexOf(s.date) === -1) continue;
    staffShifts.push(s);
    weeklyHours += s.end - s.start;
  }

  const approved: TimeOffRequest[] = [];
  const denied: TimeOffRequest[] = [];
  const requested: TimeOffRequest[] = [];
  for (let i = 0; i < timeOff.length; i++) {
    const t: TimeOffRequest = timeOff[i];
    if (t.staff !== staffId) continue;
    if (t.status === 'Approved') approved.push(t);
    else if (t.status === 'Denied') denied.push(t);
    else requested.push(t);
  }

  return {
    staffId: staffId,
    weekStartDate: weekStartDate,
    shifts: staffShifts,
    approvedTimeOff: approved,
    deniedTimeOff: denied,
    requestedTimeOff: requested,
    weeklyHours: weeklyHours
  };
}

function requestTimeOff(input: TimeOffRequestInput): TimeOffRequestResult {
  if (!input || !input.staff) {
    return { ok: false, reason: 'Missing required field: staff.' };
  }
  if (!input.startDate) {
    return { ok: false, reason: 'Missing required field: startDate.' };
  }
  if (!input.endDate) {
    return { ok: false, reason: 'Missing required field: endDate.' };
  }
  if (input.startDate > input.endDate) {
    return { ok: false, reason: 'startDate must be on or before endDate.' };
  }
  return {
    ok: true,
    request: {
      id: `tor-${input.staff}-${input.startDate}-${input.endDate}`,
      staff: input.staff,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'Requested',
      note: input.note
    }
  };
}

function decideTimeOff(requestId: string, decision: 'Approved' | 'Denied', note: string): TimeOffDecisionResult {
  if (!note || note.trim().length === 0) {
    return { ok: false, reason: 'A note is required to approve or deny a time-off request.' };
  }
  if (decision !== 'Approved' && decision !== 'Denied') {
    return { ok: false, reason: 'Decision must be Approved or Denied.' };
  }
  return {
    ok: true,
    request: undefined
  };
}
export { validateAttendeeCount, detectWeekConflicts, renderConflictDetector, getStaffWeekView, requestTimeOff, decideTimeOff };
