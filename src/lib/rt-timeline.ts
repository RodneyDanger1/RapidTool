// ---------------------------------------------------------------------------
// rt-timeline.ts — pure NDJSON → typed timeline rows (216m · 111 TASK-11).
//
// The Runtime log tab shows a raw tail: a row is a row, and a start is not
// visibly paired with its end (111 §TASK-11 calls this out against Codex's
// typed `item.started` / `item.completed` stream). This module is the missing
// *view model*: it turns the same NDJSON the CLI already writes under
// `<dir>/.rapidtool/logs/rapidtool.ndjson` (runtime-log.server.ts appends one
// `RtEvent` JSON per line; `diagnose` reads it back) into typed rows with
// start/finish pairing and a status per row.
//
// Doctrine (tracing.ts / rt-events.ts, restated for this module):
//   · PURE — no fs, no window, no Date.now(). Deterministic: same input string
//     ⇒ byte-identical rows. Nothing here mutates its input.
//   · TOTAL — telemetry must never throw into the code it observes, so no input
//     can throw: unparseable JSON, non-objects, wrong-typed fields and unknown
//     event names all degrade (see `TimelineRow.known` / `.raw`) instead.
//   · HONEST — nothing is invented. A row with no usable `ts` gets `ts: null`
//     and can never mint a duration; an unknown event is flagged, not dropped.
//
// Pairing rule (derived from the real RT_EVENT_NAMES catalogue, not invented):
// an event's tail is the text after its last `_` (or last `.`, so both
// `wild.step_start` and `boot.start` split). START tails open a span for the
// stem (`wild.step`, `boot`); the terminal tails `ok` / `ready` / `ran` /
// `done` / `error` / `timeout` / `failed` / `refused` / `stall` close it, and
// `paused` closes it as paused. `wild.step_start` → `wild.step_ok` and
// `boot.start` → `boot.ready` are the two real start/end families in the
// catalogue today; an unclosed start stays `started` with no duration rather
// than getting a fabricated one.
// ---------------------------------------------------------------------------

import { isKnownRtEvent, type RtLevel } from "./rt-events.ts";

/** Lifecycle status of one timeline row. */
export type TimelineStatus =
  /** Opened a span (`*_start` / `*.start`) that nothing has closed (yet). */
  | "started"
  /** Closed a span with a success terminal (`*_ok` / `*.ready` / `*.ran`). */
  | "ok"
  /** Closed a span with a failure terminal (`*_error` / `*_timeout` / …). */
  | "failed"
  /** Closed a span with `*_paused` (the wild driver's autopause). */
  | "paused"
  /** A point event: it neither opens nor closes a span. */
  | "instant"
  /** A degraded input line — kept verbatim in `raw`, never dropped. */
  | "raw";

/** One typed row. Raw rows carry `raw`; every other field is null-free by contract. */
export type TimelineRow = {
  /** 1-based line number in the input (provenance — points at the real line). */
  line: number;
  status: TimelineStatus;
  /** Epoch ms when the row carried a finite numeric `ts`; else null. */
  ts: number | null;
  level: RtLevel | null;
  scope: string | null;
  event: string | null;
  phase: number | null;
  code: string | null;
  /** Human one-liner; for a raw row this is the trimmed source line. */
  message: string;
  /** False when `event` is well-formed but absent from RT_EVENT_NAMES. */
  known: boolean;
  /** On a terminal row: the line of the `*_start` row it closed, else null. */
  closes: number | null;
  /** On a `started` row: the line that closed it, else null. */
  closedBy: number | null;
  /** ms between the paired start and this row (both `ts` numeric), else null. */
  durationMs: number | null;
  /** The original line — present on degraded (`raw`) rows only. */
  raw?: string;
};

/** Counts a pane can render without re-deriving anything. */
export type TimelineSummary = {
  rows: number;
  started: number;
  ok: number;
  failed: number;
  paused: number;
  instant: number;
  raw: number;
  /** Spans opened and never closed — "still running" is an honest state. */
  openSpans: number;
  /** Longest paired span in ms, null when no span was paired. */
  longestMs: number | null;
};

const RT_LEVELS: ReadonlySet<string> = new Set<RtLevel>(["debug", "info", "warn", "error", "critical"]);

const START_TAILS: ReadonlySet<string> = new Set(["start"]);
const OK_TAILS: ReadonlySet<string> = new Set(["ok", "ready", "ran", "done"]);
const FAIL_TAILS: ReadonlySet<string> = new Set(["error", "timeout", "failed", "refused", "stall", "crash"]);
const PAUSE_TAILS: ReadonlySet<string> = new Set(["paused"]);

/** Trimmed text a raw row keeps as its message (RtEvent prose budget is 300). */
const RAW_MESSAGE_MAX = 300;

/**
 * Split an event name into its span stem + lifecycle tail. The last `_` wins
 * (`wild.step_start` → `wild.step` + `start`); with no `_`, the last `.` is the
 * separator (`boot.start` → `boot` + `start`). A name with neither separator is
 * its own stem whose tail is the whole name (it classifies as `instant`).
 */
export function splitRtEventName(event: string): { stem: string; tail: string } {
  const cut = Math.max(event.lastIndexOf("_"), event.lastIndexOf("."));
  if (cut <= 0) return { stem: event, tail: event.toLowerCase() };
  return { stem: event.slice(0, cut), tail: event.slice(cut + 1).toLowerCase() };
}

/**
 * Status class for an event tail: `started` / `ok` / `failed` / `paused` / `instant`.
 * Case-insensitive by contract (216m boundary fix): `splitRtEventName` already
 * lowercases in the pipeline, but this exported helper must not depend on it.
 */
export function rtEventTailStatus(tail: string): TimelineStatus {
  const t = tail.toLowerCase();
  if (START_TAILS.has(t)) return "started";
  if (OK_TAILS.has(t)) return "ok";
  if (FAIL_TAILS.has(t)) return "failed";
  if (PAUSE_TAILS.has(t)) return "paused";
  return "instant";
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asFiniteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** A degraded row: the line survives verbatim, nothing is guessed. */
function rawRow(line: number, text: string): TimelineRow {
  const trimmed = text.trim();
  return {
    line,
    status: "raw",
    ts: null,
    level: null,
    scope: null,
    event: null,
    phase: null,
    code: null,
    message: trimmed.length > RAW_MESSAGE_MAX ? `${trimmed.slice(0, RAW_MESSAGE_MAX)}…` : trimmed,
    known: false,
    closes: null,
    closedBy: null,
    durationMs: null,
    raw: text,
  };
}

/**
 * Parse NDJSON (or an array of already-split lines) into typed, paired rows.
 *
 * Total by construction: every line is either parsed into a `TimelineRow` or
 * degraded to a `raw` row. A blank line is skipped (log files end with a
 * newline); it is not a row and not an error. `line` numbers count the input
 * lines as given, so a raw row always points back at the real text.
 */
export function parseTimeline(input: string | readonly string[]): TimelineRow[] {
  let lines: readonly string[];
  if (typeof input === "string") {
    lines = input.split(/\r?\n/);
  } else if (Array.isArray(input)) {
    lines = input;
  } else {
    // Defensive: a non-string/non-array caller is a bug, but telemetry never throws.
    return [];
  }

  const rows: TimelineRow[] = [];
  /** stem → index into `rows` of the most recent still-open `started` row. */
  const openSpans = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const text = lines[i];
    if (typeof text !== "string" || text.trim().length === 0) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      rows.push(rawRow(lineNo, text));
      continue;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      rows.push(rawRow(lineNo, text));
      continue;
    }

    const obj = parsed as Record<string, unknown>;
    const event = asString(obj.event);
    if (event === null) {
      rows.push(rawRow(lineNo, text));
      continue;
    }

    const known = isKnownRtEvent(event);
    const status = rtEventTailStatus(splitRtEventName(event).tail);
    const ts = asFiniteNumber(obj.ts);
    const level = typeof obj.level === "string" && RT_LEVELS.has(obj.level) ? (obj.level as RtLevel) : null;
    const phase = asFiniteNumber(obj.phase);
    const message = asString(obj.message) ?? "";

    const row: TimelineRow = {
      line: lineNo,
      status,
      ts,
      level,
      scope: asString(obj.scope),
      event,
      phase: phase !== null && Number.isInteger(phase) ? phase : null,
      code: asString(obj.code),
      message,
      known,
      closes: null,
      closedBy: null,
      durationMs: null,
    };

    const { stem } = splitRtEventName(event);
    if (status === "started") {
      // A newer start supersedes an older unclosed one for the same stem: the
      // older row stays `started` (unclosed) instead of being silently paired
      // with the wrong end.
      openSpans.set(stem, rows.length);
    } else if (status !== "instant") {
      const openIdx = openSpans.get(stem);
      if (openIdx !== undefined) {
        const open = rows[openIdx];
        const durationMs = open.ts !== null && ts !== null && ts >= open.ts ? ts - open.ts : null;
        open.closedBy = lineNo;
        open.durationMs = durationMs;
        row.closes = open.line;
        row.durationMs = durationMs;
        openSpans.delete(stem);
      }
    }

    rows.push(row);
  }

  return rows;
}

/** Counts + the longest paired span — all derived from the rows, no extra state. */
export function summarizeTimeline(rows: readonly TimelineRow[]): TimelineSummary {
  const summary: TimelineSummary = {
    rows: rows.length,
    started: 0,
    ok: 0,
    failed: 0,
    paused: 0,
    instant: 0,
    raw: 0,
    openSpans: 0,
    longestMs: null,
  };
  for (const r of rows) {
    if (r.status === "started") {
      // 216m boundary fix: a start row that was PAIRED keeps status "started"
      // (the pairing tests pin that) but is no longer "still running" — only an
      // unclosed start counts here, and `openSpans` mirrors exactly that set.
      if (r.closedBy === null) {
        summary.started += 1;
        summary.openSpans += 1;
      }
    } else {
      summary[r.status] += 1;
    }
    if (typeof r.durationMs === "number") {
      summary.longestMs = summary.longestMs === null ? r.durationMs : Math.max(summary.longestMs, r.durationMs);
    }
  }
  return summary;
}
