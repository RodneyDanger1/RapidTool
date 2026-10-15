import { renderWeeklyRota, addShift, checkShiftOverlap, computeWeeklyHours, checkWeeklyHourCap, bookAppointment } from "../generated/render-weekly-rota.ts";
import { validateAttendeeCount, detectWeekConflicts, renderConflictDetector, getStaffWeekView, requestTimeOff, decideTimeOff } from "../generated/validate-attendee-count.ts";
import { runCustomSoftware, listCustomSoftwareRuns } from "../domain/custom-software.ts";
import { runSync, listSyncRuns } from "./sync.ts";
import { runScan, listScanRuns } from "./scan.ts";
type AssignStatus = 'Requested' | 'Approved' | 'Denied';

interface AssignMemberRecord {
  id: string;
  name: string;
  role: string;
  weeklyHourCap: number;
  active: boolean;
  status: string;
  updatedAt: string;
}

type Member = AssignMemberRecord;

interface AssignCommand {
  staffId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  roleNote?: string;
  override?: boolean;
  limit?: number;
}

interface AssignRun {
  id: string;
  staffId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  status: AssignStatus;
  updatedAt: string;
  overrideUsed: boolean;
}

interface AssignStoreShape {
  members: AssignMemberRecord[];
  runs: AssignRun[];
}

const assignStore: AssignStoreShape = { members: [], runs: [] };

function assignIsInteger(value: unknown): boolean {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
}

function assignPad(value: number): string {
  return value < 10 ? '0' + String(value) : String(value);
}

function assignDeriveId(seed: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < seed.length; i += 1) {
    const code = seed.charCodeAt(i);
    h1 = (h1 * 33 + code) % 4294967296;
    h2 = (h2 * 31 + code) % 4294967296;
  }
  const a = assignPad(h1 % 1000000);
  const b = assignPad(h2 % 1000000);
  return 'run_' + a + b + '_' + String(seed.length);
}

function assignValidationError(field: string): Error {
  return new Error('validation failure: ' + field);
}

/**
 * Assigns a shift command to a member, validating the command, the weekly
 * hour cap, and persisting an assign run derived deterministically from the
 * command. Refuses invalid commands and over-cap shifts without an override.
 *
 * @param command - the assign command describing staff, date, and minutes.
 * @returns a promise resolving to the member the shift was assigned to.
 */
async function runAssign(command: AssignCommand): Promise<Member> {
  if (command === undefined || command === null || typeof command !== 'object') {
    throw assignValidationError('command');
  }
  if (typeof command.staffId !== 'string' || command.staffId.length === 0) {
    throw assignValidationError('staffId');
  }
  if (typeof command.date !== 'string' || command.date.length === 0) {
    throw assignValidationError('date');
  }
  if (!assignIsInteger(command.startMinute)) {
    throw assignValidationError('startMinute');
  }
  if (!assignIsInteger(command.endMinute)) {
    throw assignValidationError('endMinute');
  }
  if (command.startMinute < 0 || command.startMinute > 1440) {
    throw assignValidationError('startMinute');
  }
  if (command.endMinute < 0 || command.endMinute > 1440) {
    throw assignValidationError('endMinute');
  }
  if (command.startMinute >= command.endMinute) {
    throw assignValidationError('endMinute');
  }
  const overrideUsed = command.override === true;
  const existingMember = assignStore.members.filter(
    (m: AssignMemberRecord): boolean => m.id === command.staffId
  )[0];
  let member: AssignMemberRecord;
  if (existingMember === undefined) {
    member = {
      id: command.staffId,
      name: command.staffId,
      role: 'staff',
      weeklyHourCap: 40,
      active: true,
      status: 'active',
      updatedAt: '1970-01-01T00:00:00.000Z'
    };
    assignStore.members.push(member);
  } else {
    member = existingMember;
  }
  if (!member.active) {
    throw new Error('validation failure: staffId inactive');
  }
  const duration = command.endMinute - command.startMinute;
  const sameWeekShifts = assignStore.runs.filter((r: AssignRun): boolean => r.staffId === command.staffId);
  let projected = duration;
  for (let i = 0; i < sameWeekShifts.length; i += 1) {
    projected += sameWeekShifts[i].endMinute - sameWeekShifts[i].startMinute;
  }
  if (projected > member.weeklyHourCap && !overrideUsed) {
    throw new Error(
      'weekly cap exceeded: projected ' + String(projected) + ' minutes vs cap ' + String(member.weeklyHourCap)
    );
  }
  const seed = command.staffId + '|' + command.date + '|' + String(command.startMinute) + '|' + String(command.endMinute);
  const run: AssignRun = {
    id: assignDeriveId(seed),
    staffId: command.staffId,
    date: command.date,
    startMinute: command.startMinute,
    endMinute: command.endMinute,
    status: 'Approved',
    updatedAt: '1970-01-01T00:00:00.000Z',
    overrideUsed: overrideUsed
  };
  assignStore.runs.push(run);
  const nextMember: AssignMemberRecord = {
    id: member.id,
    name: member.name,
    role: member.role,
    weeklyHourCap: member.weeklyHourCap,
    active: member.active,
    status: member.status,
    updatedAt: member.updatedAt
  };
  return nextMember;
}

/**
 * Lists previously recorded assign runs, optionally bounded by a limit.
 *
 * @param id - the staff identifier whose runs should be listed.
 * @param limit - optional maximum number of runs to return.
 * @returns a promise resolving to the matching assign runs.
 */
async function listAssignRuns(id: string, limit?: number): Promise<AssignRun[]> {
  if (typeof id !== 'string' || id.length === 0) {
    throw assignValidationError('id');
  }
  const matched = assignStore.runs.filter((r: AssignRun): boolean => r.staffId === id);
  if (limit === undefined || limit === null) {
    return matched;
  }
  let bound = limit as number;
  if (!assignIsInteger(bound) || bound < 0) {
    return matched;
  }
  if (bound > matched.length) {
    bound = matched.length;
  }
  const sliced: AssignRun[] = [];
  for (let i = 0; i < bound; i += 1) {
    sliced.push(matched[i]);
  }
  return sliced;
}
export { runAssign, listAssignRuns };
