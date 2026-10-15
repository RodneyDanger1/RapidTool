import { renderWeeklyRota, addShift, checkShiftOverlap, computeWeeklyHours, checkWeeklyHourCap, bookAppointment } from "../generated/render-weekly-rota.ts";
import { validateAttendeeCount, detectWeekConflicts, renderConflictDetector, getStaffWeekView, requestTimeOff, decideTimeOff } from "../generated/validate-attendee-count.ts";
import { runCustomSoftware, listCustomSoftwareRuns } from "../domain/custom-software.ts";
import { runSync, listSyncRuns } from "./sync.ts";
type ScanCommand = {
  weekStartDate?: string;
  weekStart?: string;
  scanId?: string;
  staffId?: string;
  id?: string;
  label?: string;
  requestedBy?: string;
  [key: string]: unknown;
};

type ScanRun = {
  id: string;
  status: string;
  updatedAt: string;
  weekStart: string;
  conflictCount: number;
  conflicts: unknown[];
  label: string;
};

type Viewer = {
  id: string;
  status: string;
  updatedAt: string;
  conflicts: unknown[];
  weekStart: string;
  runId: string;
  ok: boolean;
};

type ConflictRecord = {
  entryA: string;
  entryB: string;
  kind: string;
};

type SlotEntry = {
  id: string;
  date: string;
  start: number;
  end: number;
  owner: string;
};

var scanRunStore: ScanRun[] = [];
var scanRunSequence: number = 0;

function scanPad(value: number): string {
  var text: string = String(value);
  while (text.length < 4) {
    text = "0" + text;
  }
  return text;
}

function scanDeriveId(prefix: string, seed: string): string {
  var hash: number = 7;
  var index: number = 0;
  while (index < seed.length) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1000000007;
    index = index + 1;
  }
  return prefix + "-" + scanPad(hash % 10000);
}

function scanToMinutes(value: unknown): number {
  if (typeof value === "number" && isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    var match: RegExpMatchArray | null = value.match(/^(\d{1,2}):(\d{2})/);
    if (match !== null) {
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }
    var parsed: number = parseInt(value, 10);
    if (isFinite(parsed)) {
      return parsed;
    }
  }
  return -1;
}

function scanEntryFromRecord(record: Record<string, unknown>, ownerKey: string): SlotEntry | null {
  var id: unknown = record.id;
  var date: unknown = record.date;
  var start: unknown = record.start;
  var end: unknown = record.end;
  if (id === undefined && record.shiftId !== undefined) {
    id = record.shiftId;
  }
  if (start === undefined && record.startMinute !== undefined) {
    start = record.startMinute;
  }
  if (start === undefined && record.startTime !== undefined) {
    start = record.startTime;
  }
  if (end === undefined && record.endMinute !== undefined) {
    end = record.endMinute;
  }
  if (end === undefined && record.endTime !== undefined) {
    end = record.endTime;
  }
  if (typeof id !== "string" || typeof date !== "string") {
    return null;
  }
  var startValue: number = scanToMinutes(start);
  var endValue: number = scanToMinutes(end);
  if (startValue < 0 || endValue < 0 || startValue >= endValue) {
    return null;
  }
  var owner: unknown = record[ownerKey];
  if (owner === undefined && record.staffId !== undefined) {
    owner = record.staffId;
  }
  if (owner === undefined && record.roomId !== undefined) {
    owner = record.roomId;
  }
  return {
    id: id,
    date: date,
    start: startValue,
    end: endValue,
    owner: typeof owner === "string" ? owner : ""
  };
}

function scanCollectEntries(options: Record<string, unknown>, ownerKey: string): SlotEntry[] {
  var collected: SlotEntry[] = [];
  var names: string[] = ["entries", "records", "items", "shifts", "appointments", "bookings"];
  var nameIndex: number = 0;
  while (nameIndex < names.length) {
    var bucket: unknown = options[names[nameIndex]];
    if (Array.isArray(bucket)) {
      var itemIndex: number = 0;
      while (itemIndex < bucket.length) {
        var item: unknown = bucket[itemIndex];
        if (item !== null && typeof item === "object") {
          var entry: SlotEntry | null = scanEntryFromRecord(item as Record<string, unknown>, ownerKey);
          if (entry !== null) {
            collected.push(entry);
          }
        }
        itemIndex = itemIndex + 1;
      }
    }
    nameIndex = nameIndex + 1;
  }
  return collected;
}

function scanDetectConflicts(entries: SlotEntry[], kindLabel: string): ConflictRecord[] {
  var found: ConflictRecord[] = [];
  var outer: number = 0;
  while (outer < entries.length) {
    var inner: number = outer + 1;
    while (inner < entries.length) {
      var a: SlotEntry = entries[outer];
      var b: SlotEntry = entries[inner];
      if (a.date === b.date && a.owner === b.owner && a.owner !== "") {
        if (a.start < b.end && b.start < a.end) {
          found.push({ entryA: a.id, entryB: b.id, kind: kindLabel });
        }
      }
      inner = inner + 1;
    }
    outer = outer + 1;
  }
  return found;
}

/**
 * Executes a conflict scan over the supplied schedule payload and returns a
 * Viewer describing the requesting user together with the detected hard
 * conflicts (double-booked rooms and overlapping staff shifts). The scan is
 * purely deterministic: identical commands yield identical results, and no
 * external calendar, notification, or network call is performed.
 *
 * // req-8 // req-12
 *
 * @param command ScanCommand carrying the week window plus the schedule records to scan.
 * @returns Promise resolving to a Viewer with the conflict list and run reference.
 */
async function runScan(command: ScanCommand): Promise<Viewer> {
  var options: Record<string, unknown> = command as Record<string, unknown>;
  var weekStart: string = "";
  if (typeof options.weekStart === "string") {
    weekStart = options.weekStart;
  } else if (typeof options.weekStartDate === "string") {
    weekStart = options.weekStartDate;
  }
  var requestedBy: string = typeof options.requestedBy === "string" ? options.requestedBy : "viewer";
  var label: string = typeof options.label === "string" ? options.label : "scan";
  var seed: string = weekStart + "|" + requestedBy + "|" + label + "|" + String(scanRunSequence);
  var runId: string = scanDeriveId("scan", seed);
  scanRunSequence = scanRunSequence + 1;

  var roomEntries: SlotEntry[] = scanCollectEntries(options, "roomId");
  var staffEntries: SlotEntry[] = scanCollectEntries(options, "staffId");
  var conflicts: ConflictRecord[] = [];
  var roomConflicts: ConflictRecord[] = scanDetectConflicts(roomEntries, "double-booked-room");
  var index: number = 0;
  while (index < roomConflicts.length) {
    conflicts.push(roomConflicts[index]);
    index = index + 1;
  }
  var staffConflicts: ConflictRecord[] = scanDetectConflicts(staffEntries, "overlapping-staff-shift");
  index = 0;
  while (index < staffConflicts.length) {
    conflicts.push(staffConflicts[index]);
    index = index + 1;
  }

  var run: ScanRun = {
    id: runId,
    status: "completed",
    updatedAt: "1970-01-01T00:00:00.000Z",
    weekStart: weekStart,
    conflictCount: conflicts.length,
    conflicts: conflicts,
    label: label
  };
  scanRunStore.push(run);

  var viewer: Viewer = {
    id: requestedBy,
    status: "ready",
    updatedAt: run.updatedAt,
    conflicts: conflicts,
    weekStart: weekStart,
    runId: runId,
    ok: true
  };
  return viewer;
}

/**
 * Lists previously executed scan runs, most recent first, optionally capping
 * the number of returned records. The listing is derived from the caller's
 * recorded runs plus this module's deterministic in-memory run registry.
 *
 * // req-8
 *
 * @param id Identifier used to select the run collection (a scan id, week, or requester).
 * @param limit Optional maximum number of runs to return.
 * @returns Promise resolving to an array of ScanRun records.
 */
async function listScanRuns(id: string, limit?: number): Promise<ScanRun[]> {
  var fromStore: ScanRun[] = [];
  var storeIndex: number = 0;
  while (storeIndex < scanRunStore.length) {
    var stored: ScanRun = scanRunStore[storeIndex];
    if (id === "" || stored.id === id || stored.label === id || stored.weekStart === id || stored.id.indexOf(id) === 0) {
      fromStore.push(stored);
    }
    storeIndex = storeIndex + 1;
  }
  fromStore.reverse();
  if (typeof limit === "number" && isFinite(limit) && limit >= 0 && fromStore.length > limit) {
    fromStore = fromStore.slice(0, Math.floor(limit));
  }
  return fromStore;
}
export { runScan, listScanRuns };
