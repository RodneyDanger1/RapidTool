// ---------------------------------------------------------------------------
// runtime-log.server.ts — node-only NDJSON runtime-log disk appender
// (fixes/109 §4.2). The CLI/headless half of the runtime telemetry system:
// every headless run appends one RtEvent JSON per line under a logs/ dir, and
// the `diagnose` verb reads the tail back for its timeline.
//
// HOST: node only. This module imports node:fs BY DESIGN — it must NEVER be
// imported from the client-safe ring graph (rt-client/rt-ring/rt-events/
// watchdog/diagnose are window-free and node-safe; this module is the fs
// owner). The browser bundle never touches it (nothing client-side imports
// it — H2 crash-class guard).
//
// Bounds (§4.2): 5 MB rotation, 4 files kept (≤ 20 MB total), one
// appendFileSync per row (atomic for rows ≪ 64 KB by construction), torn
// final lines skipped on read — never thrown.
//
// EXPORT SURFACE (compile against these — do not rename):
//   resolveLogDir · makeCliRow · appendRtLine · readRtTail · logDirBytes ·
//   RUNTIME_LOG_FILE
// ---------------------------------------------------------------------------

import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  LOG_KEEP,
  LOG_ROTATE_BYTES,
  RT_SCHEMA_VERSION,
  sanitizeRtEvent,
  type RtEvent,
  type RtEventSeed,
} from "./rt-events.ts";

/** One RtEvent JSON per line — the fixed log filename in the log dir. */
export const RUNTIME_LOG_FILE = "rapidtool.ndjson";

/**
 * §4.2 location: `RAPIDTOOL_LOG_DIR` env overrides; otherwise a project
 * command logs next to its project (`<dir>/.rapidtool/logs`) and global
 * commands (doctor/diagnose --all) use `cwd/.rapidtool/logs`.
 */
export function resolveLogDir(projectPath?: string | null): string {
  const env = process.env.RAPIDTOOL_LOG_DIR;
  if (env && env.trim().length > 0) return env.trim();
  if (projectPath) return join(dirname(projectPath), ".rapidtool", "logs");
  return join(process.cwd(), ".rapidtool", "logs");
}

/**
 * Stamp a seed into a full CLI row: schema_version/ts/host:"cli"/sessionId
 * from the host glue + the §2.2 per-row budgets via sanitizeRtEvent. The pure
 * core never invents time — the CLI stamps it here (tracing.ts doctrine).
 */
export function makeCliRow(seed: RtEventSeed, sessionId: string, now: number = Date.now()): RtEvent {
  const row: RtEvent = {
    schema_version: RT_SCHEMA_VERSION,
    ts: now,
    level: seed.level,
    host: "cli",
    sessionId,
    scope: seed.scope,
    event: seed.event,
    message: seed.message,
    capture: seed.capture,
    phase: seed.phase ?? null,
    projectId: seed.projectId ?? null,
    code: seed.code ?? null,
    stack: seed.stack ?? null,
    ctx: seed.ctx,
    payload: seed.payload,
    runRef: seed.runRef ?? null,
    elapsedMs: null,
  };
  return sanitizeRtEvent(row);
}

function rotate(logFile: string, rotateBytes: number): void {
  try {
    if (!existsSync(logFile)) return;
    const size = statSync(logFile).size;
    if (size <= rotateBytes) return;
    // Shift rapidtool.ndjson → .1 → .2 → .3, drop .3 (keep LOG_KEEP files).
    const drop = `${logFile}.${LOG_KEEP - 1}`;
    if (existsSync(drop)) {
      try {
        unlinkSync(drop);
      } catch {
        /* best effort — a stuck rotation must never break the command */
      }
    }
    for (let i = LOG_KEEP - 2; i >= 0; i--) {
      const from = i === 0 ? logFile : `${logFile}.${i}`;
      const to = `${logFile}.${i + 1}`;
      if (existsSync(from)) renameSync(from, to);
    }
  } catch {
    /* rotation is best-effort (never breaks the command) */
  }
}

/**
 * Append one RtEvent as a single NDJSON line (mkdir + rotate + appendFileSync).
 * Best-effort: ANY failure is swallowed — telemetry must never break the
 * command it observes.
 */
export function appendRtLine(
  row: RtEvent,
  opts: { logDir?: string; rotateBytes?: number } = {},
): void {
  try {
    const dir = opts.logDir ?? resolveLogDir(null);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, RUNTIME_LOG_FILE);
    rotate(file, opts.rotateBytes ?? LOG_ROTATE_BYTES);
    appendFileSync(file, `${JSON.stringify(row)}\n`, "utf8");
  } catch {
    /* best effort */
  }
}

/**
 * Read the newest n rows (newest-first). Byte-bounded and line-validated: a
 * torn final line (crash mid-write) or a junk line is skipped, never thrown.
 */
export function readRtTail(logDir: string, n: number): RtEvent[] {
  try {
    const file = join(logDir, RUNTIME_LOG_FILE);
    if (!existsSync(file)) return [];
    // Read at most the last 256 KB — n rows are ≤ ~2 KB each by construction.
    const stats = statSync(file);
    const start = Math.max(0, stats.size - 256 * 1024);
    // B2 (W39): `start` is a BYTE offset — the window is read as raw bytes and
    // decoded whole, never sliced out of a UTF-8-decoded string (a multibyte
    // character straddling the boundary shifted the window and left the first
    // line a mojibake fragment; the "last 256 KB" claim only held for ASCII).
    // W42 L4-G6 (OPS-11 / A-57): open + readSync EXACTLY the window — the
    // claim is the read itself, not a whole-file read with the window sliced
    // off after the fact. The loop tolerates a short read (file rotated or
    // shrunk between stat and open).
    const windowBytes = stats.size - start;
    let buf: Buffer = Buffer.alloc(0);
    if (windowBytes > 0) {
      const fd = openSync(file, "r");
      try {
        buf = Buffer.alloc(windowBytes);
        let filled = 0;
        while (filled < windowBytes) {
          const got = readSync(fd, buf, filled, windowBytes - filled, start + filled);
          if (got <= 0) break; // EOF — the file shrank under us
          filled += got;
        }
        if (filled < windowBytes) buf = buf.subarray(0, filled);
      } finally {
        closeSync(fd);
      }
    }
    const content = buf.toString("utf8");
    const rows: RtEvent[] = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      try {
        const parsed = JSON.parse(trimmed) as Partial<RtEvent>;
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          typeof parsed.event === "string" &&
          typeof parsed.ts === "number"
        ) {
          rows.push(parsed as RtEvent);
        }
      } catch {
        /* torn/junk line — skip */
      }
    }
    return rows.slice(-n).reverse();
  } catch {
    return [];
  }
}

/** Total bytes on disk under the log dir (diagnose growth.stats). */
export function logDirBytes(logDir: string): number {
  try {
    if (!existsSync(logDir)) return 0;
    let total = 0;
    for (const name of readdirSync(logDir)) {
      try {
        total += statSync(join(logDir, name)).size;
      } catch {
        /* concurrent rotation — skip */
      }
    }
    return total;
  } catch {
    return 0;
  }
}
