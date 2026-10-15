#!/usr/bin/env node
/**
 * P-B · C-11 — mechanical RUNLOCK preflight.
 *
 * BL-010 / INC-23: a live `office-stock-tracker` run was corrupted by concurrent
 * edits to `src/**` while it was running, and T3's `_coord/FIXED_providers.json`
 * claimed the edits happened only after the last RUNLOCK release — a claim the
 * file mtimes contradict. A convention is not a guard. This preflight refuses a
 * run, before it starts, when:
 *
 *   (a) any `src/**` mtime is newer than the run's start (the run overlaps a
 *       live edit), or
 *   (b) the RUNLOCK file is absent when one was required.
 *
 * It reads REAL mtimes (either supplied as JSON evidence or collected from a
 * directory) and never trusts a prose claim.
 *
 * Usage:
 *   node scripts/guards/runlock-preflight.mjs --src-mtimes <json> --run-start <iso> [--run-end <iso>] [--lock <file>]
 *   node scripts/guards/runlock-preflight.mjs --collect <srcDir> --run-start <iso> [--lock <file>]
 *   node scripts/guards/runlock-preflight.mjs --selftest [--json]
 *
 * Exit codes: 0 allowed · 1 refused (violation) · 2 usage/bad input.
 *
 * `--src-mtimes` accepts {"path":"iso"} or [{"path","mtime"}] or [["path","iso"]].
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { isMainModule, projectRoot } from "../with-app-env.mjs";

const SKIP_DIRS = new Set(["node_modules", ".git", ".rapidtool", "dist", "build", "coverage", ".output"]);

/**
 * Normalize the --src-mtimes payload into [{path, mtime, at}] entries.
 * @param {unknown} value
 * @returns {{ path: string, mtime: string, at: number }[]}
 */
export function normalizeMtimes(value) {
  /** @type {unknown[]} */
  let rows = [];
  if (Array.isArray(value)) rows = value;
  else if (value && typeof value === "object") {
    rows = Object.entries(value).map(([path, mtime]) => ({ path, mtime }));
  }
  const out = [];
  for (const row of rows) {
    let path = "";
    let mtime = "";
    if (Array.isArray(row)) {
      path = String(row[0] ?? "");
      mtime = String(row[1] ?? "");
    } else if (row && typeof row === "object") {
      const record = /** @type {{ path?: unknown, mtime?: unknown }} */ (row);
      path = String(record.path ?? "");
      mtime = String(record.mtime ?? "");
    }
    if (!path || !mtime) continue;
    out.push({ path, mtime, at: Date.parse(mtime) });
  }
  return out;
}

/** Collect `src/**` mtimes (ms) from a real directory tree. */
export function collectSrcMtimes(dir) {
  const out = [];
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        try {
          out.push({ path: full.replace(/\\/g, "/"), mtime: new Date(statSync(full).mtimeMs).toISOString(), at: statSync(full).mtimeMs });
        } catch {
          /* unreadable — fail closed elsewhere */
        }
      }
    }
  };
  walk(dir);
  return out;
}

/**
 * The preflight verdict. Pure over its inputs (plus one existence check for the
 * lock). `runEnd`, when given, narrows the violation window to [start, end];
 * otherwise any mtime strictly after `start` is a violation.
 * @param {{ runStart: string, runEnd?: string|null, srcMtimes: { path: string, mtime?: string, at: number }[], lockPath?: string|null }} input
 * @returns {{ ok: boolean, violations: { code: string, path?: string, mtime?: string, detail: string }[], checked: number }}
 */
export function preflight(input) {
  const violations = [];
  const start = Date.parse(input.runStart);
  if (!Number.isFinite(start)) {
    return { ok: false, violations: [{ code: "RT_E_RUNLOCK_BAD_START", detail: `--run-start is not a parseable ISO timestamp: ${input.runStart}` }], checked: 0 };
  }
  // B1-F6 (fail closed): an EMPTY scan is not a clean window. An absent/unreadable
  // `--collect` directory (or an empty `--src-mtimes` payload) used to yield
  // `checked:0, violations:[]` and ALLOW — a vacuous pass that certifies a window
  // it never inspected. Refuse coded instead, like check-module-coverage's
  // `unreadable` handling.
  if (!Array.isArray(input.srcMtimes) || input.srcMtimes.length === 0) {
    return {
      ok: false,
      violations: [
        {
          code: "RT_E_RUNLOCK_NO_INPUT",
          detail:
            "no src mtimes to check — an empty scan never certifies a clean window (pass --src-mtimes or a non-empty --collect dir)",
        },
      ],
      checked: 0,
    };
  }
  const end = input.runEnd ? Date.parse(input.runEnd) : null;
  if (input.lockPath && !existsSync(input.lockPath)) {
    violations.push({ code: "RT_E_RUNLOCK_MISSING", path: input.lockPath, detail: `no RUNLOCK at ${input.lockPath} — refuse to start` });
  }
  let checked = 0;
  for (const entry of input.srcMtimes) {
    const at = Number.isFinite(entry.at) ? entry.at : Date.parse(entry.mtime ?? "");
    if (!Number.isFinite(at)) {
      violations.push({ code: "RT_E_RUNLOCK_BAD_MTIME", path: entry.path, detail: `mtime is not a parseable ISO timestamp: ${entry.mtime}` });
      continue;
    }
    checked += 1;
    const overlaps = end !== null && Number.isFinite(end) ? at >= start && at <= end : at > start;
    if (overlaps) {
      violations.push({
        code: "RT_E_SRC_EDITED_DURING_RUN",
        path: entry.path,
        mtime: new Date(at).toISOString(),
        detail: `src file '${entry.path}' has mtime ${new Date(at).toISOString()}, inside the run window that started ${new Date(start).toISOString()} — refuse to start`,
      });
    }
  }
  return { ok: violations.length === 0, violations, checked };
}

/**
 * The fired-on-historical proof (BL-010) plus clean and lock-absent controls.
 * The real mtimes: T3 edited `src/lib/harvest.ts` and
 * `src/lib/websearch.server.ts` across 21:32:24–21:34:01 while
 * `office-stock-tracker/create.json` starts at 21:32:58 (INC-23).
 */
export function selftest() {
  const dir = mkdtempSync(join(tmpdir(), "rt-runlock-guard-"));
  try {
    const lock = join(dir, "RUNLOCK");
    writeFileSync(lock, "held");
    const historical = preflight({
      runStart: "2026-10-05T21:32:58.000Z",
      srcMtimes: normalizeMtimes({
        "src/lib/harvest.ts": "2026-10-05T21:32:50.000Z",
        "src/lib/websearch.server.ts": "2026-10-05T21:34:01.000Z",
      }),
      lockPath: lock,
    });
    const clean = preflight({
      runStart: "2026-10-05T22:00:00.000Z",
      srcMtimes: normalizeMtimes({ "src/lib/harvest.ts": "2026-10-05T21:00:00.000Z" }),
      lockPath: lock,
    });
    const lockAbsent = preflight({
      runStart: "2026-10-05T22:00:00.000Z",
      srcMtimes: normalizeMtimes({ "src/lib/harvest.ts": "2026-10-05T21:00:00.000Z" }),
      lockPath: join(dir, "RUNLOCK-missing"),
    });
    const entries = [
      {
        id: "C-11",
        case: "BL-010 historical overlap",
        refused: !historical.ok,
        code: historical.violations[0]?.code ?? null,
        want: "refuse",
        ok: !historical.ok && historical.violations.some((v) => v.code === "RT_E_SRC_EDITED_DURING_RUN"),
      },
      { id: "C-11", case: "clean window + lock held", refused: !clean.ok, code: null, want: "allow", ok: clean.ok },
      {
        id: "C-11",
        case: "lock absent",
        refused: !lockAbsent.ok,
        code: lockAbsent.violations[0]?.code ?? null,
        want: "refuse",
        ok: !lockAbsent.ok && lockAbsent.violations.some((v) => v.code === "RT_E_RUNLOCK_MISSING"),
      },
    ];
    return { ok: entries.every((e) => e.ok), entries };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function usage(message) {
  if (message) console.error(`[runlock-preflight] ${message}`);
  console.error("usage: node scripts/guards/runlock-preflight.mjs --src-mtimes <json> --run-start <iso> | --collect <dir> --run-start <iso> | --selftest [--json]");
  process.exit(2);
}

function main(argv) {
  const json = argv.includes("--json");
  const args = argv.filter((a) => a !== "--json");
  const flag = (name) => {
    const at = args.indexOf(name);
    return at >= 0 ? args[at + 1] : undefined;
  };

  if (args.includes("--selftest")) {
    const result = selftest();
    if (json) console.log(JSON.stringify({ guard: "runlock-preflight", selftest: result }, null, 2));
    else for (const e of result.entries) console.log(`[runlock-preflight] ${e.case}: ${e.ok ? "ok" : "MISS"} (${e.want}, got ${e.refused ? e.code ?? "refused" : "allow"})`);
    return result.ok ? 0 : 1;
  }

  const runStart = flag("--run-start");
  if (!runStart) usage("--run-start is required");
  const runEnd = flag("--run-end") ?? null;
  const lockPath = flag("--lock") ?? null;
  const collect = flag("--collect");
  const mtimesFile = flag("--src-mtimes");
  if (!collect && !mtimesFile) usage("--src-mtimes <json> or --collect <dir> is required");

  /** @type {{ path: string, mtime?: string, at: number }[]} */
  let srcMtimes = [];
  if (collect) {
    srcMtimes = collectSrcMtimes(resolve(projectRoot(), collect));
  } else if (mtimesFile) {
    let payload;
    try {
      payload = JSON.parse(readFileSync(resolve(projectRoot(), mtimesFile), "utf8"));
    } catch (err) {
      usage(`could not read --src-mtimes ${mtimesFile}: ${err instanceof Error ? err.message : String(err)}`);
    }
    srcMtimes = normalizeMtimes(payload);
  }

  const result = preflight({ runStart, runEnd: runEnd ?? undefined, srcMtimes, lockPath });
  if (json) console.log(JSON.stringify({ guard: "runlock-preflight", ...result }, null, 2));
  else {
    for (const v of result.violations) console.log(`${v.code} ${v.path ?? ""}: ${v.detail}`);
    console.log(`[runlock-preflight] ${result.checked} mtime(s) checked · ${result.violations.length} violation(s) · ${result.ok ? "ALLOW" : "REFUSE"}`);
  }
  return result.ok ? 0 : 1;
}

if (isMainModule(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
