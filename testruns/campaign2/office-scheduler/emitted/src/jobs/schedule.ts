import { renderWeeklyRota, addShift, checkShiftOverlap, computeWeeklyHours, checkWeeklyHourCap, bookAppointment } from "../generated/render-weekly-rota.ts";
import { validateAttendeeCount, detectWeekConflicts, renderConflictDetector, getStaffWeekView, requestTimeOff, decideTimeOff } from "../generated/validate-attendee-count.ts";
import { runCustomSoftware, listCustomSoftwareRuns } from "../domain/custom-software.ts";
import { runSync, listSyncRuns } from "./sync.ts";
import { runScan, listScanRuns } from "./scan.ts";
import { runAssign, listAssignRuns } from "./assign.ts";
type ScheduleData = {
  staff: StaffMember[];
  rooms: RoomRecord[];
  shifts: ShiftRecord[];
  appointments: AppointmentRecord[];
  timeOffRequests: TimeOffRecord[];
};

type StaffMember = {
  id: string;
  name: string;
  role: string;
  weeklyHourCap: number;
  active: boolean;
};

type RoomRecord = {
  id: string;
  name: string;
  capacity: number;
  active: boolean;
};

type ShiftRecord = {
  id: string;
  staffId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  roleNote: string;
  override: boolean;
};

type AppointmentRecord = {
  id: string;
  title: string;
  roomId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  bookedBy: string;
  attendeeCount: number;
};

type TimeOffRecord = {
  id: string;
  staffId: string;
  startDate: string;
  endDate: string;
  status: string;
  note: string;
};

type PersistResult = {
  ok: boolean;
  error: string;
  data: ScheduleData;
};

// req-12
function saveSchedule(data: ScheduleData): PersistResult {
  const store: ScheduleData = {
    staff: data.staff.slice(),
    rooms: data.rooms.slice(),
    shifts: data.shifts.slice(),
    appointments: data.appointments.slice(),
    timeOffRequests: data.timeOffRequests.slice()
  };
  const serialized: string = JSON.stringify(store);
  if (serialized.length === 0) {
    return { ok: false, error: 'write-failure: schedule could not be serialized', data: emptySchedule() };
  }
  persistedSchedule = store;
  return { ok: true, error: '', data: store };
}

// req-12
function loadSchedule(): PersistResult {
  if (persistedSchedule === null) {
    return { ok: false, error: 'load-failure: no locally persisted schedule available', data: emptySchedule() };
  }
  return { ok: true, error: '', data: persistedSchedule };
}

function emptySchedule(): ScheduleData {
  return { staff: [], rooms: [], shifts: [], appointments: [], timeOffRequests: [] };
}

let persistedSchedule: ScheduleData | null = null;
export { saveSchedule, loadSchedule };
