// ---------------------------------------------------------------------------
// runtime-log.server.test.ts — NDJSON appender/reader/rotation tests
// (fixes/109 §4.2). All cases run against fresh mkdtemp dirs: deterministic,
// no shared state, no network. Torn-line + rotation cases shrink constants
// via opts so nothing depends on wall-clock or big files.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  RUNTIME_LOG_FILE,
  appendRtLine,
  logDirBytes,
  makeCliRow,
  readRtTail,
  resolveLogDir,
} from "./runtime-log.server.ts";
import type { RtEvent, RtLevel } from "./rt-events.ts";

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), "rtlog-"));
}

function row(i: number, level: RtLevel = "info"): RtEvent {
  return makeCliRow(
    {
      level,
      scope: "cli-command",
      event: "cli.invocation",
      message: `invocation ${i}`,
      capture: "test",
      payload: { i },
    },
    "sess-test-1",
    1_000 + i,
  );
}

test("appendRtLine creates the log dir and writes one JSON per line", () => {
  const dir = tmpDir();
  try {
    appendRtLine(row(1), { logDir: dir });
    appendRtLine(row(2, "error"), { logDir: dir });
    const file = join(dir, RUNTIME_LOG_FILE);
    assert.ok(existsSync(file));
    const lines = readFileSync(file, "utf8").trimEnd().split("\n");
    assert.equal(lines.length, 2);
    for (const line of lines) {
      const parsed = JSON.parse(line) as RtEvent;
      assert.equal(parsed.schema_version, 1);
      assert.equal(parsed.host, "cli");
      assert.equal(parsed.sessionId, "sess-test-1");
      assert.equal(typeof parsed.ts, "number");
      assert.equal(parsed.event, "cli.invocation");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readRtTail returns newest-first, capped, and skips torn/junk lines", () => {
  const dir = tmpDir();
  try {
    const file = join(dir, RUNTIME_LOG_FILE);
    appendRtLine(row(1), { logDir: dir });
    appendRtLine(row(2), { logDir: dir });
    // A torn final line (crash mid-write) and a junk line must both be skipped.
    writeFileSync(file, readFileSync(file, "utf8") + '{"event":"cli.invoca', { encoding: "utf8" });
    writeFileSync(file, readFileSync(file, "utf8") + "this is not json\n", { encoding: "utf8" });

    const tail = readRtTail(dir, 10);
    assert.deepEqual(
      tail.map((r) => r.message),
      ["invocation 2", "invocation 1"],
      "newest first",
    );
    assert.equal(readRtTail(dir, 1).length, 1, "n cap respected");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readRtTail reads a bounded window of a >256 KB file (W42 L4-G6)", () => {
  const dir = tmpDir();
  try {
    const file = join(dir, RUNTIME_LOG_FILE);
    // ~1400 rows ≈ 350 KB — comfortably past the 256 KB window, so the
    // earliest rows lie wholly outside it and must not come back.
    const lines: string[] = [];
    for (let i = 1; i <= 1400; i++) lines.push(JSON.stringify(row(i)));
    writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
    assert.ok(statSync(file).size > 256 * 1024, "fixture must exceed the 256 KB window");

    const tail = readRtTail(dir, 100_000);
    assert.equal(tail[0].payload?.i, 1400, "newest row first");
    assert.equal(tail[1].payload?.i, 1399, "newest-first order preserved");
    assert.ok(
      !tail.some((r) => r.payload?.i === 1),
      "rows outside the byte window are not read back",
    );
    // The window holds every whole row after the boundary; the first line in
    // it is a torn fragment (skipped). Deterministic lower bound from the
    // largest row's byte size — no magic row counts.
    const maxRowBytes = Buffer.byteLength(lines[1399], "utf8") + 1;
    const minRows = Math.floor((256 * 1024) / maxRowBytes) - 1;
    assert.ok(tail.length >= minRows, `window tail holds >= ${minRows} rows, got ${tail.length}`);
    assert.ok(tail.length < 1400, "the full history is NOT returned — the read stayed window-bounded");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readRtTail on a missing dir returns [] (never throws)", () => {
  assert.deepEqual(readRtTail(join(tmpDir(), "does-not-exist"), 5), []);
});

test("rotation: size cap renames to .1 and keeps writing (shrink via opts)", () => {
  const dir = tmpDir();
  try {
    // Small rotate threshold so the test never writes MBs.
    for (let i = 1; i <= 6; i++) {
      appendRtLine(row(i), { logDir: dir, rotateBytes: 350 });
    }
    const file = join(dir, RUNTIME_LOG_FILE);
    const rotated = `${file}.1`;
    assert.ok(existsSync(file), "active file exists");
    assert.ok(existsSync(rotated), "rotated .1 exists");
    // Rotation runs BEFORE the append, so the active file can hold one row
    // above the cap at most (cap + one row, never two) — rows are ~256 B.
    assert.ok(statSync(file).size <= 350 + 300, "active file bounded at cap + one row after rotation");
    // The rotated file still parses as NDJSON (old rows preserved).
    const oldLines = readFileSync(rotated, "utf8").trimEnd().split("\n");
    assert.ok(oldLines.length >= 1);
    for (const line of oldLines) assert.ok((JSON.parse(line) as RtEvent).event === "cli.invocation");
    // Tail read still returns the newest rows from the ACTIVE file only.
    const tail = readRtTail(dir, 20);
    assert.equal(tail[0].message, "invocation 6");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rotation keep-set: .3 is dropped when a 4th generation arrives", () => {
  const dir = tmpDir();
  try {
    const file = join(dir, RUNTIME_LOG_FILE);
    // Force three prior generations by rotating repeatedly with a tiny cap.
    for (let i = 1; i <= 14; i++) {
      appendRtLine(row(i), { logDir: dir, rotateBytes: 250 });
    }
    // LOG_KEEP=4: the active file plus .1/.2/.3 generations are the keep-set;
    // anything beyond (.4) never forms because .3 is dropped before the shift.
    const kept = ["", ".1", ".2", ".3"].map((suffix) => join(dir, `${RUNTIME_LOG_FILE}${suffix}`));
    for (const f of kept) assert.ok(existsSync(f), `${f} kept`);
    assert.ok(!existsSync(`${file}.4`), ".4 never forms (keep-set bound)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveLogDir: env override > project dir > cwd", () => {
  const prev = process.env.RAPIDTOOL_LOG_DIR;
  try {
    process.env.RAPIDTOOL_LOG_DIR = "/tmp/override-logs";
    assert.equal(resolveLogDir("/some/project.json"), "/tmp/override-logs");
    delete process.env.RAPIDTOOL_LOG_DIR;
    const proj = resolveLogDir("/some/project.json");
    assert.ok(proj.endsWith(join("some", ".rapidtool", "logs")) || proj.endsWith(".rapidtool\\logs"));
    const cwd = resolveLogDir(null);
    assert.ok(cwd.endsWith(join(".rapidtool", "logs")));
  } finally {
    if (prev === undefined) delete process.env.RAPIDTOOL_LOG_DIR;
    else process.env.RAPIDTOOL_LOG_DIR = prev;
  }
});

test("logDirBytes sums every file under the dir (0 for a missing dir)", () => {
  const dir = tmpDir();
  try {
    assert.equal(logDirBytes(dir), 0);
    appendRtLine(row(1), { logDir: dir });
    const expected = statSync(join(dir, RUNTIME_LOG_FILE)).size;
    assert.equal(logDirBytes(dir), expected);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("makeCliRow sanitizes per-row budgets (message ≤ 300 chars) and never throws", () => {
  const r = makeCliRow(
    {
      level: "info",
      scope: "cli-command",
      event: "cli.invocation",
      message: "x".repeat(5_000),
      capture: "test",
      payload: { long: "y".repeat(2_000), n: 7 },
    },
    "sess",
    42,
  );
  assert.ok(r.message.length <= 301);
  assert.ok((r.payload?.long as string).length <= 160);
  assert.equal(r.ts, 42, "host-stamped ts honored");
  assert.equal(r.host, "cli");
});

test("FIX-2c: the exit-2 park row shape survives makeCliRow — level warn + payload.parked ride through sanitization", () => {
  const r = makeCliRow(
    {
      level: "warn",
      scope: "cli-command",
      event: "cli.invocation",
      message: "gate exit 2",
      capture: "scripts/rapidtool-cli.mjs:200",
      payload: { cmd: "gate", exitCode: 2, parked: true },
    },
    "sess-park",
    42,
  );
  assert.equal(r.level, "warn", "an exit-2 park logs at warn (F-3) — the appender must not rewrite the level");
  assert.equal(r.payload?.parked, true, "the parked tag survives the row pipeline");
  assert.equal(r.payload?.exitCode, 2);
  assert.equal(r.code ?? null, null, "a clean park carries no RT_E code");
});
