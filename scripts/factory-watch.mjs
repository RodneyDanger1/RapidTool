#!/usr/bin/env node
// ---------------------------------------------------------------------------
// factory-watch.mjs — the walk-away orchestrator (fixes/344 F-18).
//
// WHAT IT IS: ONE bounded tick that drains a brief intake through the real
// CLI machine contract. For each brief it runs
//
//   1. create      — scripts/rapidtool-cli.mjs `create --brief @<file>`
//   2. drive       — `unattended --project <file>` (autopilot + live, MACHINE
//                    seat only: unattended passes machineGates, so a stock
//                    HITL gate whose DoD passes is cleared through the ledgered
//                    machine actor; a forceHuman gate or a red DoD gate parks)
//   3. deliver     — `emit --project <file> --out <dir> --git` (one
//                    Conventional-Commits commit per emitted tree)
//
// WHAT IT IS NOT: a daemon. There is no scheduler/queue in-product; a host hook
// (Windows Task Scheduler / cron) invokes THIS script on a cadence (see
// scripts/README-cli.md §The walk-away factory). Every invocation is
// idempotent: a brief already delivered is skipped, and an interrupted item
// re-enters from its own durable state instead of restarting.
//
// HONESTY (the whole point):
//   · A per-item state checkpoint is persisted to <work>/state/factory-state.json
//     after every step, so a killed process resumes rather than restarts — and a
//     brief whose bytes changed since it was recorded is reported, never
//     silently re-run.
//   · Delivery is claimed ONLY after the `emit --git` envelope proves a real
//     commit (committed:true or the idempotent noop:true with a .git on disk).
//   · A stall is a first-class outcome: `parked` (a human gate / blocked, exit 2)
//     and `stalled` (a hard DoD block or red-gate seal, exit 1) are terminal and
//     are reported with the CLI's own coded reason; the item is LEFT FOR A HUMAN.
//     The script never turns a red-gate seal into a delivery.
//
// Usage:
//   node scripts/factory-watch.mjs --intake <brief-dir> --work <work-dir> [--limit N] [--retry] [--dry-run]
//   node scripts/factory-watch.mjs --queue <queue.json> --work <work-dir> [...]
//
//   --intake <dir>   a directory of brief files (*.md/*.txt/*.brief). Each file
//                    is one brief; a leading `name:` front-matter scalar names
//                    the project, else the file stem does. A corpus fixture's
//                    `brief:` front-matter scalar is unwrapped by the CLI's own
//                    `--brief @<path>` handling.
//   --queue <file>   a JSON queue: [{ "name": "...", "brief": "<prose>" | "@<path>" }]
//                    (also accepts { "briefs": [ ... ] }).
//   --work <dir>     REQUIRED. The factory workspace: <work>/state/<state>.json,
//                    <work>/<slug>/build.json and <work>/<slug>/emitted/.
//   --limit N        process at most N briefs that need work this tick (terminal
//                    skips do not count).
//   --retry          re-attempt parked/stalled items (a conscious human decision);
//                    without it those terminals are skipped idempotently.
//   --dry-run        report the plan; write nothing, invoke no CLI verb.
//   --timeout-ms N   per-CLI-invocation wall clock (default 1800000 = 30 min).
//
// stdout: exactly ONE JSON object (schema_version/cmd/exit_code + per-item rows),
// matching every other script/verb in this repo. Exit taxonomy:
//   0  every processed item is delivered (or was already delivered)
//   1  >=1 item stalled / failed (a hard DoD block, red-gate seal, or delivery
//      failure) — read its coded reason
//   2  no hard failure, but >=1 item parked at a human gate / blocked
//   1  usage errors · 4 factory-internal errors
// ---------------------------------------------------------------------------
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// W42 L4-G5: the shared realpath-based main-module check (a symlinked or
// case-differing launch path still runs the CLI) — also keeps this module
// importable by its colocated test without executing a tick.
import { isMainModule } from "./with-app-env.mjs";

const SCHEMA_VERSION = 1;
const CMD = "factory-watch";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI_PATH = join(REPO_ROOT, "scripts", "rapidtool-cli.mjs");
const STATE_REL = join("state", "factory-state.json");
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 3;
/** Terminal statuses a human must resolve before a re-drive. */
const HUMAN_TERMINALS = new Set(["parked", "stalled"]);

// ---------------------------------------------------------------------------
// Small CLI arg parser (the repo's --flag value | --flag=value idiom).
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  /** @type {{ _: string[]; [key: string]: any }} */
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const eq = token.indexOf("=");
    if (eq !== -1) {
      args[token.slice(2, eq)] = token.slice(eq + 1);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function flag(args, key) {
  return args[key] === true || args[key] === "true" || args[key] === "1";
}

function intFlag(args, key, fallback) {
  const raw = args[key];
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// ---------------------------------------------------------------------------
// Pure helpers — exported for the colocated test (no fs, no CLI).
// ---------------------------------------------------------------------------

/** Deterministic workspace slug — mirrors the CLI's own slugName (io.ts). */
export function slugify(name) {
  const slug = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "project";
}

/** SHA-256 hex of a brief's bytes — the change detector for an intake item. */
export function briefHash(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

/** The leading `name:` scalar of a front-matter fence, or null. */
export function frontmatterName(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const m = text.slice(3, end).match(/^name:\s*(.+)$/m);
  if (!m) return null;
  let v = (m[1] ?? "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim() || null;
}

/** A human-readable project name from an intake file path (front-matter wins). */
export function nameForBrief(filePath, text) {
  const fm = frontmatterName(text);
  if (fm) return fm;
  const stem = filePath.replace(/\\/g, "/").split("/").pop() ?? "brief";
  return (
    stem
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim() || "brief"
  );
}

/**
 * Normalize a parsed queue document into [{ name, brief }]. Accepts a bare
 * array or { briefs: [...] }; refuses anything else (never guesses a brief).
 */
export function normalizeQueue(doc) {
  const rows = Array.isArray(doc) ? doc : doc && Array.isArray(doc.briefs) ? doc.briefs : null;
  if (!rows) return { error: "queue must be a JSON array or { briefs: [...] }" };
  const out = [];
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    if (!r || typeof r !== "object" || typeof r.brief !== "string" || r.brief.trim() === "") {
      return { error: `queue row ${i} needs a non-empty string "brief"` };
    }
    const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : `brief-${i + 1}`;
    out.push({ name, brief: r.brief });
  }
  return { rows: out };
}

/**
 * Decide what a tick should do with one intake brief given its recorded state.
 * Pure and total — the whole idempotence/crash-resume contract lives here.
 *
 * @param {{status:string, briefHash?:string, attempts?:number}|null|undefined} recorded
 * @param {string} hash  the intake brief's current hash
 * @param {{retry:boolean, maxAttempts?:number}} opts
 * @returns {{ action:"deliver"|"drive"|"create"|"terminal"|"changed"; reason:string; needsHuman?:boolean }}
 */
export function planItem(recorded, hash, opts) {
  if (recorded && typeof recorded.briefHash === "string" && recorded.briefHash !== hash) {
    // The brief's bytes moved under an existing record. Re-running would either
    // silently deliver different work under the same slug or discard the
    // recorded outcome — both dishonest. Report it for a human.
    return { action: "changed", reason: "brief-changed", needsHuman: true };
  }
  const status = recorded?.status;
  if (status === "delivered") return { action: "deliver", reason: "already-delivered" };
  if (status !== undefined && HUMAN_TERMINALS.has(status)) {
    if (opts.retry) return { action: "drive", reason: `retry-${status}` };
    return { action: "terminal", reason: status, needsHuman: true };
  }
  if (
    status === "failed" &&
    (recorded?.attempts ?? 0) >= (opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  ) {
    return { action: "terminal", reason: "attempts-exhausted", needsHuman: true };
  }
  if (status === "created" || status === "driving" || status === "failed") {
    return { action: "drive", reason: "resume" };
  }
  return { action: "create", reason: "new" };
}

/**
 * Classify an `unattended` envelope into a terminal drive outcome. Exit 0 is
 * the ONLY complete path; everything else is named honestly. Pure.
 */
export function classifyDrive(envelope, exitCode) {
  if (exitCode === 0 && envelope?.ok === true) return { kind: "complete" };
  if (exitCode === 2) {
    return {
      kind: "parked",
      code: typeof envelope?.code === "string" ? envelope.code : null,
      reason: `machine seat exhausted — ${envelope?.summary?.status ?? "awaiting_hitl"}; a human must decide`,
      needsHuman: true,
    };
  }
  if (exitCode === 1) {
    return {
      kind: "stalled",
      code: typeof envelope?.code === "string" ? envelope.code : "RT_E_UNKNOWN",
      reason: typeof envelope?.error === "string" ? envelope.error : "drive refused (exit 1)",
      needsHuman: true,
    };
  }
  return {
    kind: "failed",
    code: typeof envelope?.code === "string" ? envelope.code : "RT_E_INTERNAL",
    reason:
      typeof envelope?.error === "string"
        ? envelope.error
        : `drive failed (exit ${exitCode}) — a runtime/backend failure, retried while attempts remain`,
  };
}

/**
 * Whether an `emit --git` envelope PROVES a delivery. `committed:true` is a
 * fresh commit; `noop:true` is the idempotent re-emit of an identical tree
 * (the `.git` existence is checked by the caller — this stays pure). Pure.
 */
export function emitDelivered(envelope, exitCode) {
  if (exitCode !== 0 || envelope?.ok !== true) return false;
  const git = envelope.git;
  if (!git || git.ok === false || typeof git !== "object") return false;
  return git.committed === true || git.noop === true;
}

// ---------------------------------------------------------------------------
// fs helpers.
// ---------------------------------------------------------------------------
function atomicWriteJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// ---------------------------------------------------------------------------
// CLI child seam — one JSON envelope per verb (the repo's machine contract).
// ---------------------------------------------------------------------------
function runCli(args, timeoutMs) {
  const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, ...args], {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  let envelope = null;
  try {
    envelope = JSON.parse(res.stdout ?? "");
  } catch {
    // Non-JSON stdout (a timeout, a crash, a stray banner) is left as a null
    // envelope — the caller classifies from the exit code and reports the raw
    // stdout/stderr, so nothing is silently treated as an ok envelope.
    envelope = null;
  }
  const spawnError = /** @type {{ code?: string } | undefined} */ (res.error);
  return {
    exitCode: res.status === null ? -1 : res.status,
    envelope,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    timedOut: spawnError?.code === "ETIMEDOUT" || res.signal === "SIGTERM",
  };
}

// ---------------------------------------------------------------------------
// Intake readers.
// ---------------------------------------------------------------------------
const INTAKE_EXTS = new Set([".md", ".txt", ".brief"]);

function readIntake(dir) {
  const abs = resolve(dir);
  let entries;
  try {
    if (!statSync(abs).isDirectory()) return { error: `--intake is not a directory: ${abs}` };
    entries = readdirSync(abs);
  } catch (err) {
    return { error: `--intake cannot be read: ${abs} (${err?.message ?? err})` };
  }
  const briefs = [];
  for (const entry of entries.sort()) {
    const dot = entry.lastIndexOf(".");
    if (dot <= 0) continue; // no extension → not an intake brief
    const ext = entry.slice(dot).toLowerCase();
    if (!INTAKE_EXTS.has(ext)) continue;
    const file = join(abs, entry);
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch (err) {
      return { error: `intake file unreadable: ${entry} (${err?.message ?? err})` };
    }
    briefs.push({ name: nameForBrief(entry, text), brief: `@${file}`, source: file, text });
  }
  return { briefs };
}

function readQueue(file) {
  let doc;
  try {
    doc = readJson(resolve(file));
  } catch (err) {
    return { error: `--queue cannot be read: ${file} (${err?.message ?? err})` };
  }
  const normalized = normalizeQueue(doc);
  if (normalized.error) return { error: `--queue: ${normalized.error}` };
  const briefs = [];
  for (const row of normalized.rows ?? []) {
    if (row.brief.startsWith("@")) {
      const p = resolve(row.brief.slice(1).trim());
      let text;
      try {
        text = readFileSync(p, "utf8");
      } catch (err) {
        return { error: `queue brief @${p} unreadable (${err?.message ?? err})` };
      }
      briefs.push({ name: row.name, brief: `@${p}`, source: p, text });
    } else {
      briefs.push({ name: row.name, brief: row.brief, source: "queue", text: row.brief });
    }
  }
  return { briefs };
}

// ---------------------------------------------------------------------------
// The tick.
// ---------------------------------------------------------------------------
function fail(error, code, exitCode) {
  emit(
    {
      ok: false,
      error,
      code,
    },
    exitCode,
  );
}

function emit(result, exitCode) {
  const out = { schema_version: SCHEMA_VERSION, cmd: CMD, ...result, exit_code: exitCode };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  process.exit(exitCode);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const hasIntake = typeof args.intake === "string" && args.intake.trim() !== "";
  const hasQueue = typeof args.queue === "string" && args.queue.trim() !== "";
  if (hasIntake === hasQueue) {
    return fail("pass exactly one of --intake <dir> or --queue <file.json>", "RT_E_VALIDATION", 1);
  }
  if (args.intake === true || args.queue === true) {
    return fail(
      "--intake/--queue need a path value (a bare flag would resolve to the CWD)",
      "RT_E_VALIDATION",
      1,
    );
  }
  if (typeof args.work !== "string" || args.work.trim() === "") {
    return fail(
      "--work <dir> is required — the factory workspace holding state + per-project dirs",
      "RT_E_VALIDATION",
      1,
    );
  }
  const work = resolve(args.work);
  const dryRun = flag(args, "dry-run");
  const retry = flag(args, "retry");
  const limit = intFlag(args, "limit", Infinity);
  if (limit === null) return fail("--limit expects a non-negative integer", "RT_E_VALIDATION", 1);
  const timeoutMs = intFlag(args, "timeout-ms", DEFAULT_TIMEOUT_MS);
  if (timeoutMs === null || timeoutMs === 0) {
    return fail("--timeout-ms expects a positive integer", "RT_E_VALIDATION", 1);
  }

  const intake = hasIntake ? readIntake(args.intake) : readQueue(args.queue);
  if (intake.error) return fail(intake.error, "RT_E_VALIDATION", 1);

  const statePath = join(work, STATE_REL);
  let state = { schema_version: SCHEMA_VERSION, updatedAt: new Date().toISOString(), projects: {} };
  if (existsSync(statePath)) {
    try {
      const prior = readJson(statePath);
      if (
        !prior ||
        typeof prior !== "object" ||
        typeof prior.projects !== "object" ||
        prior.projects === null
      ) {
        return fail(
          `${statePath}: the factory state is malformed — refusing to overwrite it (a corrupt state holds delivery records; repair or remove it by hand)`,
          "RT_E_VALIDATION",
          1,
        );
      }
      state = prior;
    } catch (err) {
      return fail(
        `${statePath}: the factory state is unreadable (${err?.message ?? err}) — refusing to overwrite it`,
        "RT_E_VALIDATION",
        1,
      );
    }
  }

  const results = [];
  let worked = 0;
  for (const brief of intake.briefs ?? []) {
    const slug = slugify(brief.name);
    const projectFile = join(work, slug, "build.json");
    const emitDir = join(work, slug, "emitted");
    const hash = briefHash(brief.text);
    const recorded = state.projects[slug] ?? null;
    const plan = planItem(recorded, hash, {
      retry,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
    });

    if (plan.action === "deliver" || plan.action === "terminal" || plan.action === "changed") {
      results.push({
        slug,
        name: brief.name,
        action: plan.action,
        status: recorded?.status ?? null,
        reason: plan.reason,
        code: recorded?.code ?? null,
        needsHuman: plan.needsHuman === true,
        delivered: plan.action === "deliver",
        delivery: recorded?.delivery ?? null,
      });
      continue;
    }
    if (worked >= limit) {
      results.push({ slug, name: brief.name, action: "deferred", reason: "--limit reached" });
      continue;
    }
    worked += 1;

    if (dryRun) {
      results.push({
        slug,
        name: brief.name,
        action: plan.action,
        reason: plan.reason,
        dryRun: true,
      });
      continue;
    }

    const entry = recorded ?? {
      name: brief.name,
      briefHash: hash,
      source: brief.source,
      projectFile,
      emitDir,
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    entry.name = brief.name;
    entry.briefHash = hash;
    entry.projectFile = projectFile;
    entry.emitDir = emitDir;
    entry.updatedAt = new Date().toISOString();
    state.projects[slug] = entry;

    // --- Step 1: create (idempotent — a project file already on disk is resumed) ---
    if (!existsSync(projectFile)) {
      const created = runCli(
        ["create", "--brief", brief.brief, "--name", brief.name, "--out", projectFile],
        timeoutMs,
      );
      if (created.exitCode !== 0 || created.envelope?.ok !== true) {
        entry.status = "failed";
        entry.lastExit = created.exitCode;
        entry.code = created.envelope?.code ?? (created.timedOut ? "RT_E_ABORTED" : "RT_E_UNKNOWN");
        entry.reason =
          (typeof created.envelope?.error === "string" && created.envelope.error) ||
          created.stderr.slice(0, 500).trim() ||
          "create failed";
        entry.attempts += 1;
        atomicWriteJson(statePath, withStamp(state));
        results.push(row(entry, "create-failed"));
        continue;
      }
    }
    entry.status = "driving";
    entry.phase = entry.phase ?? 0;
    atomicWriteJson(statePath, withStamp(state)); // crash checkpoint: resume, not restart

    // --- Step 2: drive to a terminal state with the machine seat only ---
    const driven = runCli(["unattended", "--project", projectFile], timeoutMs);
    const drive = classifyDrive(driven.envelope, driven.exitCode);
    entry.attempts += 1;
    entry.lastExit = driven.exitCode;
    if (drive.kind !== "complete") {
      entry.status = drive.kind === "failed" ? "failed" : drive.kind;
      entry.code = drive.code ?? null;
      entry.reason = drive.reason;
      entry.phase = driven.envelope?.summary?.currentPhase ?? entry.phase ?? null;
      entry.needsHuman = drive.needsHuman === true;
      atomicWriteJson(statePath, withStamp(state));
      results.push(row(entry, `drive-${drive.kind}`));
      continue;
    }

    entry.phase = driven.envelope?.summary?.currentPhase ?? entry.phase;
    entry.status = "driving";
    atomicWriteJson(statePath, withStamp(state));

    // --- Step 3: deliver — emit --git into the per-project dir ---
    const emitted = runCli(
      ["emit", "--project", projectFile, "--out", emitDir, "--git"],
      timeoutMs,
    );
    const gitDir = join(emitDir, ".git");
    const proved = emitDelivered(emitted.envelope, emitted.exitCode) && existsSync(gitDir);
    if (!proved) {
      entry.status = "stalled";
      entry.code = emitted.envelope?.code ?? (emitted.timedOut ? "RT_E_ABORTED" : "RT_E_INTERNAL");
      entry.reason =
        emitted.envelope?.error ??
        `emit --git did not prove a delivery (exit ${emitted.exitCode})${emitted.envelope?.ok === true ? " — no commit and no .git on disk" : ""}`;
      entry.needsHuman = true;
      atomicWriteJson(statePath, withStamp(state));
      results.push(row(entry, "deliver-failed"));
      continue;
    }

    entry.status = "delivered";
    entry.code = null;
    entry.reason = null;
    entry.needsHuman = false;
    entry.deliveredAt = new Date().toISOString();
    entry.delivery = {
      dir: emitted.envelope.git.dir,
      committed: emitted.envelope.git.committed === true,
      noop: emitted.envelope.git.noop === true,
      commit: emitted.envelope.git.commit ?? null,
    };
    atomicWriteJson(statePath, withStamp(state));
    results.push(row(entry, "delivered"));
  }

  const counts = {
    delivered: 0,
    parked: 0,
    stalled: 0,
    failed: 0,
    changed: 0,
    deferred: 0,
    other: 0,
  };
  for (const r of results) {
    if (r.delivered === true) counts.delivered += 1;
    else if (r.status === "parked") counts.parked += 1;
    else if (r.status === "stalled") counts.stalled += 1;
    else if (r.status === "failed") counts.failed += 1;
    else if (r.action === "changed") counts.changed += 1;
    else if (r.action === "deferred") counts.deferred += 1;
    else counts.other += 1;
  }
  const hardFailure = counts.stalled > 0 || counts.failed > 0;
  const anyPendingHuman = counts.parked > 0 || counts.changed > 0;
  const exitCode = hardFailure ? 1 : anyPendingHuman ? 2 : 0;
  const ok = !hardFailure;

  emit(
    {
      ok,
      intake: hasIntake ? resolve(args.intake) : null,
      queue: hasQueue ? resolve(args.queue) : null,
      work,
      dryRun,
      retry,
      statePath,
      processes: results,
      counts,
      note:
        "One bounded tick — a host hook (Task Scheduler / cron) invokes this on a cadence. " +
        "parked/stalled items are terminal and left for a human; delivered items are skipped idempotently.",
    },
    exitCode,
  );
}

function withStamp(state) {
  state.updatedAt = new Date().toISOString();
  return state;
}

/** A compact per-item result row (the delivery record is in the state file). */
function row(entry, action) {
  return {
    slug: slugify(entry.name),
    name: entry.name,
    action,
    status: entry.status,
    phase: entry.phase ?? null,
    code: entry.code ?? null,
    reason: entry.reason ?? null,
    attempts: entry.attempts,
    needsHuman: entry.needsHuman === true,
    delivered: entry.status === "delivered",
    delivery: entry.delivery ?? null,
  };
}

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (err) {
    // Nothing is written before the final emit, so an unexpected throw still
    // produces ONE well-formed envelope (never a bare Node stack on stdout).
    process.stdout.write(
      `${JSON.stringify(
        {
          schema_version: SCHEMA_VERSION,
          cmd: CMD,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          code: "RT_E_INTERNAL",
          exit_code: 4,
        },
        null,
        2,
      )}\n`,
    );
    process.exit(4);
  }
}
