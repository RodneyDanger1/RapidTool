// ---------------------------------------------------------------------------
// src/main.ts — CLI entry — the runnable program (package bin delegates here)
// machine-generated from RapidTool packet 4dbb30be-da7b-47ae-8ae5-19aa54a69b46; regenerate, don't hand-edit.
// A real argument parser + subcommand dispatch. Each command streams its
// input line by line (no whole-file load) and returns a structured result.
// Exit codes: 0 ok · 1 usage error · 2 no data / unreadable input.
// ---------------------------------------------------------------------------

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

export type CliContext = { argv: string[]; env: Record<string, string | undefined> };
export type CliOptions = {
  command: string;
  input: string;
  json: boolean;
  quiet: boolean;
  flags: Record<string, string>;
};
export type CliResult = { code: number; lines: string[]; data: unknown };
export type LogRecord = {
  raw: string;
  level: string;
  message: string;
  ts: number | null;
  durationMs: number | null;
};

export const COMMANDS: readonly string[] = ["invoice","convert","_export"];

const USAGE = [
  "usage: a-command-line-tool-that <command> [options] [file]",
  "",
  "commands:",
  // counts by level, the time range and the top messages
  "  invoice <file>",
  // the parsed records re-serialized as NDJSON
  "  convert <file>",
  // the parsed records re-serialized as NDJSON
  "  _export <file>",
  "",
  "options:",
  "  --json            machine-readable output",
  "  --quiet           suppress output, exit code only",
  "  --p95 <ms>        latency budget for the latency command",
  "  --bucket <span>   timeline bucket, e.g. 1m / 5m / 1h",
  "  -h, --help        show this help",
  "",
  "Reads the file argument; stdin when it is missing or \"-\".",
].join("\n");

const VIEW_BY_COMMAND: Record<string, CliView> = {"invoice":"summary","convert":"transform","_export":"transform"};

/** The entry contract: argv in, exit code out. */
export async function main(
  argv: string[] = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
): Promise<number> {
  const parsed = parseArgv(argv);
  if (parsed.kind === "help") {
    process.stdout.write(USAGE + "\n");
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(parsed.errors.join("\n") + "\n\n" + USAGE + "\n");
    return 1;
  }
  const options = parsed.options;
  let records: LogRecord[];
  try {
    records = await readInput(options.input, env);
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
    return 2;
  }
  if (records.length === 0) {
    if (!options.quiet) process.stderr.write("no data: " + options.input + " contained no records\n");
    return 2;
  }
  const result = viewFor(options.command)(records, options);
  if (!options.quiet) {
    process.stdout.write((options.json ? JSON.stringify(result.data, null, 2) : result.lines.join("\n")) + "\n");
  }
  return result.code;
}

/** `invoice` — the brief's declared command: counts by level, the time range and the top messages. */
export async function invoice(input: string, options: CliOptions): Promise<CliResult> {
  return viewFor("invoice")(await readInput(input, {}), options);
}

/** `convert` — the brief's declared command: the parsed records re-serialized as NDJSON. */
export async function convert(input: string, options: CliOptions): Promise<CliResult> {
  return viewFor("convert")(await readInput(input, {}), options);
}

/** `_export` — the brief's declared command: the parsed records re-serialized as NDJSON. */
export async function _export(input: string, options: CliOptions): Promise<CliResult> {
  return viewFor("_export")(await readInput(input, {}), options);
}

export function parseArgv(argv: readonly string[]):
  | { kind: "help" }
  | { kind: "error"; errors: string[] }
  | { kind: "run"; options: CliOptions } {
  const errors: string[] = [];
  const flags: Record<string, string> = {};
  const positionals: string[] = [];
  let json = false;
  let quiet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return { kind: "help" };
    if (arg === "--json") { json = true; continue; }
    if (arg === "--quiet") { quiet = true; continue; }
    if (arg.startsWith("--")) {
      const body = arg.slice(2);
      const equals = body.indexOf("=");
      const name = equals >= 0 ? body.slice(0, equals) : body;
      if (!FLAG_WITH_VALUE.has(name)) { errors.push("unknown option --" + name); continue; }
      const value = equals >= 0 ? body.slice(equals + 1) : argv[index + 1];
      if (value === undefined || value.startsWith("--")) { errors.push("option --" + name + " needs a value"); continue; }
      if (equals < 0) index += 1;
      flags[name] = value;
      continue;
    }
    positionals.push(arg);
  }
  const command = positionals.shift();
  if (command === undefined) errors.push("no command given");
  else if (!COMMANDS.includes(command)) errors.push("unknown command " + JSON.stringify(command) + " (expected one of " + COMMANDS.join(", ") + ")");
  if (errors.length > 0) return { kind: "error", errors };
  return { kind: "run", options: { command: command ?? "", input: positionals[0] ?? "-", json, quiet, flags } };
}

const FLAG_WITH_VALUE = new Set(["p95", "bucket"]);

/** Stream a file (or stdin) line by line; returns every parsed record. */
export async function readInput(input: string, env: Record<string, string | undefined>): Promise<LogRecord[]> {
  void env;
  const source = input === "-" || input === "" ? process.stdin : createReadStream(input);
  const lines = createInterface({ input: source, crlfDelay: Infinity });
  const records: LogRecord[] = [];
  for await (const line of lines) {
    if (line.trim() === "") continue;
    records.push(parseRecord(line));
  }
  return records;
}

type View = (records: readonly LogRecord[], options: CliOptions) => CliResult;
type CliViewName = "summary" | "errors" | "latency" | "timeline" | "watch" | "transform";
const VIEWS: Record<CliViewName, View> = { summary: viewSummary, errors: viewErrors, latency: viewLatency, timeline: viewTimeline, watch: viewWatch, transform: viewTransform };

const LEVEL_MAP: Record<string, string> = { warning: "warn", err: "error", critical: "fatal", crit: "fatal", notice: "info" };
const LEVEL_RE = /\b(trace|debug|info|notice|warn|warning|error|err|fatal|critical|crit)\b/i;
const DURATION_RE = /\b(\d+(?:\.\d+)?)\s?(ms|s)\b/;
const TS_RE = /\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\b/;

function pick(record: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function toTimeOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value > 100000000000 ? value : value * 1000;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Parse one input line as an NDJSON record, or as plain text. */
export function parseRecord(raw: string): LogRecord {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        const level = String(pick(parsed, ["level", "severity", "lvl", "logLevel"]) ?? "").toLowerCase();
        const message = String(pick(parsed, ["message", "msg", "text", "event", "name"]) ?? trimmed);
        return {
          raw: trimmed,
          level: LEVEL_MAP[level] ?? level,
          message,
          ts: toTimeOrNull(pick(parsed, ["timestamp", "time", "ts", "date", "@timestamp"])),
          durationMs: toNumberOrNull(pick(parsed, ["durationMs", "latencyMs", "elapsedMs", "duration", "latency", "elapsed", "ms", "took"])),
        };
      }
    } catch {
      // Not JSON — fall through to the plain-text parse below.
    }
  }
  const levelMatch = LEVEL_RE.exec(trimmed);
  const durationMatch = DURATION_RE.exec(trimmed);
  const tsMatch = TS_RE.exec(trimmed);
  const level = levelMatch ? LEVEL_MAP[levelMatch[1].toLowerCase()] ?? levelMatch[1].toLowerCase() : "info";
  const durationMs = durationMatch ? Number(durationMatch[1]) * (durationMatch[2] === "s" ? 1000 : 1) : null;
  const ts = tsMatch ? Date.parse(tsMatch[1].replace(" ", "T")) : Number.NaN;
  return { raw: trimmed, level, message: trimmed, ts: Number.isFinite(ts) ? ts : null, durationMs };
}

/** Normalize a message so near-identical lines group (ids, uuids, durations, quoted strings). */
export function fingerprint(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<id>")
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, "<ts>")
    .replace(/\b\d+(?:\.\d+)?(?:ms|s)\b/g, "<duration>")
    .replace(/"[^"]*"|'[^']*'/g, "<quoted>")
    .replace(/\b\d+\b/g, "<n>")
    .trim();
}

function topMessages(records: readonly LogRecord[], limit: number): { count: number; sample: string }[] {
  const groups = new Map<string, { count: number; sample: string }>();
  for (const record of records) {
    const key = fingerprint(record.message);
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { count: 1, sample: record.message });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.sample.localeCompare(b.sample)).slice(0, limit);
}

function viewSummary(records: readonly LogRecord[], options: CliOptions): CliResult {
  void options;
  const byLevel = new Map<string, number>();
  let first: number | null = null;
  let last: number | null = null;
  for (const record of records) {
    byLevel.set(record.level, (byLevel.get(record.level) ?? 0) + 1);
    if (record.ts !== null) {
      if (first === null || record.ts < first) first = record.ts;
      if (last === null || record.ts > last) last = record.ts;
    }
  }
  const top = topMessages(records, 5);
  const data = {
    records: records.length,
    byLevel: Object.fromEntries([...byLevel.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    first: first === null ? null : new Date(first).toISOString(),
    last: last === null ? null : new Date(last).toISOString(),
    topMessages: top,
  };
  const levels = [...byLevel.entries()].map(([level, count]) => level + "=" + count).join(" ") || "(none)";
  return {
    code: 0,
    lines: [
      "records: " + records.length,
      "levels: " + levels,
      "range: " + (data.first ?? "unknown") + " .. " + (data.last ?? "unknown"),
      "top messages:",
      ...top.map((group) => "  " + group.count + "x " + group.sample),
    ],
    data,
  };
}

function viewErrors(records: readonly LogRecord[], options: CliOptions): CliResult {
  void options;
  const flagged = records.filter((record) => record.level === "error" || record.level === "fatal" || record.level === "warn");
  const groups = topMessages(flagged, 20);
  const data = { records: records.length, flagged: flagged.length, groups: groups.map((group) => ({ fingerprint: fingerprint(group.sample), count: group.count, sample: group.sample })) };
  const lines = flagged.length === 0
    ? ["no error or warning records found"]
    : [flagged.length + " error/warning record(s) in " + groups.length + " group(s):", ...groups.map((group) => "  " + group.count + "x " + fingerprint(group.sample) + "\n     e.g. " + group.sample)];
  return { code: 0, lines, data };
}

function viewLatency(records: readonly LogRecord[], options: CliOptions): CliResult {
  const parsed = Number(options.flags.p95 ?? "500");
  const budget = Number.isFinite(parsed) ? parsed : 500;
  const offenders = records.filter((record) => record.durationMs !== null && record.durationMs > budget);
  const groups = new Map<string, { count: number; maxMs: number; sample: string }>();
  for (const record of offenders) {
    const key = fingerprint(record.message);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.maxMs = Math.max(existing.maxMs, record.durationMs ?? 0);
    } else {
      groups.set(key, { count: 1, maxMs: record.durationMs ?? 0, sample: record.message });
    }
  }
  const rows = [...groups.values()].sort((a, b) => b.maxMs - a.maxMs || b.count - a.count);
  const data = { budgetMs: budget, overBudget: offenders.length, groups: rows.map((row) => ({ fingerprint: fingerprint(row.sample), count: row.count, maxMs: row.maxMs })) };
  const lines = offenders.length === 0
    ? ["no record exceeded " + budget + "ms"]
    : [offenders.length + " record(s) exceeded " + budget + "ms across " + rows.length + " message(s):", ...rows.map((row) => "  " + row.count + "x max " + row.maxMs + "ms  " + fingerprint(row.sample))];
  return { code: 0, lines, data };
}

function parseBucket(span: string | undefined): number {
  const match = /^(\d+)(s|m|h)$/.exec((span ?? "1m").trim());
  if (match === null) return 60000;
  const size = Number(match[1]);
  return size * (match[2] === "s" ? 1000 : match[2] === "m" ? 60000 : 3600000);
}

function viewTimeline(records: readonly LogRecord[], options: CliOptions): CliResult {
  const bucketMs = parseBucket(options.flags.bucket);
  const buckets = new Map<number, number>();
  let undated = 0;
  for (const record of records) {
    if (record.ts === null) { undated += 1; continue; }
    const key = Math.floor(record.ts / bucketMs) * bucketMs;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const ordered = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  const width = Math.max(...ordered.map((entry) => entry[1]), 1);
  const data = { bucketMs, buckets: ordered.map(([start, count]) => ({ start: new Date(start).toISOString(), count })), undated };
  const lines = [
    records.length + " record(s) across " + ordered.length + " bucket(s) of " + bucketMs + "ms" + (undated > 0 ? ", " + undated + " undated" : "") + ":",
    ...ordered.map(([start, count]) => "  " + new Date(start).toISOString() + "  " + String(count).padStart(4) + "  " + "#".repeat(Math.max(1, Math.round((count / width) * 24)))),
  ];
  return { code: 0, lines, data };
}

function viewWatch(records: readonly LogRecord[], options: CliOptions): CliResult {
  void options;
  const flagged = records.filter((record) => record.level === "error" || record.level === "fatal" || record.level === "warn");
  const data = { flagged: flagged.length, lines: flagged.map((record) => record.raw) };
  const lines = flagged.length === 0
    ? ["no error or warning records to highlight"]
    : flagged.map((record) => (record.level === "warn" ? "! " : "# ") + record.raw);
  return { code: 0, lines, data };
}

function viewTransform(records: readonly LogRecord[], options: CliOptions): CliResult {
  void options;
  const data = records.map((record) => ({ level: record.level, message: record.message, ts: record.ts, durationMs: record.durationMs }));
  return { code: 0, lines: data.map((record) => JSON.stringify(record)), data };
}

function viewFor(command: string): (records: readonly LogRecord[], options: CliOptions) => CliResult {
  const view = VIEW_BY_COMMAND[command] ?? "summary";
  return VIEWS[view] ?? viewSummary;
}

// CliView is the alias the generated VIEW_BY_COMMAND table is typed with.
type CliView = CliViewName;

// Direct-execution guard (the standard ESM main-module check): main runs ONLY
// when this file is the program being executed — any import (tests, tooling,
// the oracle spec) never triggers it, which is what makes the stub importable.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
