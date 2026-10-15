#!/usr/bin/env node
/**
 * Desktop launch seam: one command that starts the built RapidTool preview on
 * 127.0.0.1:8081, waits until it really answers, and opens it in the browser.
 * A second run stops whatever the first left behind, so a double-click always
 * relaunches cleanly instead of dying on the strictPort collision.
 *
 * Why this exists next to scripts/preview.mjs: that script is the sandbox
 * lifecycle tool and resolves port owners from /proc, so it refuses to run on
 * Windows ("no /proc"). The owner's machine is Windows, where a Desktop
 * shortcut must start the app. On POSIX this delegates to preview.mjs (one
 * proven implementation); on win32 it owns the same lifecycle natively —
 * pidfile + `netstat -ano` port owners + `taskkill /T` to reach the whole
 * `node -> with-app-env -> vite` tree.
 *
 *   node scripts/launch-rapidtool.mjs [start]   # default
 *   node scripts/launch-rapidtool.mjs stop
 *   node scripts/launch-rapidtool.mjs restart
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "./with-app-env.mjs";
import { parsePid } from "./preview.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PID_FILE = join(ROOT, ".grok/preview.pid");
const LOG_FILE = join(ROOT, ".grok/preview.log");
const PREVIEW_SCRIPT = join(ROOT, "scripts/preview.mjs");
const DEFAULT_READY_TIMEOUT_MS = 60000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The preview port: `PORT` when it is a usable override, else the 8081 contract. */
export function resolvePort(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : 8081;
}

const PORT = resolvePort(process.env.PORT);
const URL = `http://127.0.0.1:${PORT}/`;

/**
 * Stable on-disk directory for the embedded PGLite, OUTSIDE the repo so a
 * build/clean never drops the app's server-side data. An explicit
 * `RAPIDTOOL_PGLITE_DIR` in the environment always wins (the launcher and a
 * manual run agree); otherwise it defaults per-user: `%LOCALAPPDATA%\RapidTool\
 * pglite` on Windows, `$XDG_DATA_HOME/RapidTool/pglite` (or
 * `~/.local/share/RapidTool/pglite`) elsewhere. Returns null only when no home
 * directory is discoverable — the child then keeps PGLite's in-memory default.
 * @param {NodeJS.ProcessEnv} env
 * @param {NodeJS.Platform} [platform]
 * @returns {string | null}
 */
export function resolvePgliteDir(env, platform = process.platform) {
  const override = env.RAPIDTOOL_PGLITE_DIR?.trim();
  if (override) return override;
  if (platform === "win32") {
    const local = env.LOCALAPPDATA?.trim();
    return local ? join(local, "RapidTool", "pglite") : null;
  }
  const xdg = env.XDG_DATA_HOME?.trim();
  if (xdg) return join(xdg, "RapidTool", "pglite");
  const home = (env.HOME ?? env.USERPROFILE)?.trim();
  return home ? join(home, ".local", "share", "RapidTool", "pglite") : null;
}

/**
 * Resolve the PGLite dir, create it, and export it to `process.env` so a child
 * spawned from here (the Windows server, or the POSIX preview.mjs delegate)
 * opens the SAME persistent DB. Idempotent; returns the dir or null.
 */
function applyPgliteDir() {
  const dir = resolvePgliteDir(process.env);
  if (!dir) return null;
  mkdirSync(dir, { recursive: true });
  process.env.RAPIDTOOL_PGLITE_DIR = dir;
  return dir;
}

export function parseLaunchArgs(argv) {
  const [action, ...rest] = argv;
  if (action === undefined || action === "") return { action: "start" };
  if (rest.length > 0) return { error: `unexpected argument: ${rest[0]}` };
  if (!["start", "stop", "restart"].includes(action)) {
    return { error: `unknown action: ${action} (expected start, stop or restart)` };
  }
  return { action };
}

/**
 * Pids of the LISTEN sockets on `port` from `netstat -ano` output. Windows-only
 * seam (POSIX delegates to preview.mjs, whose port owners come from /proc).
 * A row is `Proto Local Foreign State PID`; only TCP LISTENING rows whose LOCAL
 * address ends in `:<port>` count — a remote `:<port>` or `:80810` must not.
 */
export function netstatListenPids(text, port) {
  const suffix = `:${port}`;
  const pids = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 5 || cols[0].toUpperCase() !== "TCP" || cols[3] !== "LISTENING") continue;
    if (!cols[1].endsWith(suffix)) continue;
    if (/^\d+$/.test(cols[4])) pids.push(Number(cols[4]));
  }
  return [...new Set(pids)];
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === "EPERM";
  }
}

function readPidFile() {
  try {
    return parsePid(readFileSync(PID_FILE, "utf8"));
  } catch {
    return null;
  }
}

/**
 * The command line of a Windows pid, or "" when it cannot be read. Mirrors
 * preview.mjs's /proc corroboration: the pidfile pid is only a CLAIM, and pids
 * are reused across hibernate/revive, so a stale claim must be checked before
 * `taskkill /T` reaps a whole unrelated process tree.
 */
export function winProcessCommandLine(pid, { spawn = spawnSync } = {}) {
  try {
    const wmic = spawn("wmic", ["process", "where", `ProcessId=${pid}`, "get", "CommandLine", "/value"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
    });
    if (wmic.status === 0 && typeof wmic.stdout === "string") {
      const m = wmic.stdout.match(/^CommandLine=(.*)$/m);
      if (m) return m[1].trim();
    }
  } catch {
    /* wmic absent/removed — try the CIM fallback */
  }
  try {
    const ps = spawn(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`],
      { encoding: "utf8", windowsHide: true, timeout: 8000 },
    );
    if (ps.status === 0 && typeof ps.stdout === "string") return ps.stdout.trim();
  } catch {
    /* unreadable — caller treats "" as "cannot corroborate" */
  }
  return "";
}

/** True when a command line is the preview server THIS launcher spawns
 *  (`node scripts/with-app-env.mjs vite preview`). Mirrors preview.mjs's
 *  looksLikePreviewProcess, which refuses its own tooling (preview*.mjs). */
export function looksLikeLaunchProcess(cmdline) {
  const argv = String(cmdline ?? "");
  if (/\bpreview[\w-]*\.mjs\b/.test(argv)) return false;
  return /\bwith-app-env\.mjs\b/.test(argv) && /\bvite\b\s+preview\b/.test(argv);
}

/**
 * LISTEN pids on `port`. `ok:false` means the netstat probe itself failed — the
 * caller must NOT read that as "the port is free" (a failed probe used to yield
 * `[]`, so stop could claim a port free while a server still held it).
 * Exported with an injectable spawn for the failed-probe unit seam.
 */
/** @param {number} [port] @param {{ spawn?: any }} [opts] */
export function winPortPids(port = PORT, { spawn = spawnSync } = {}) {
  const r = spawn("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8", windowsHide: true });
  if (r.error || r.status !== 0 || typeof r.stdout !== "string") {
    return { ok: false, pids: [], error: r.error ? r.error.message : `netstat exited ${r.status}` };
  }
  return { ok: true, pids: netstatListenPids(r.stdout, port), error: null };
}

/** `taskkill /T` on win32 reaches the child tree; POSIX signals the group. */
function killTree(pid) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

/** Windows stop: the recorded tree plus whoever owns the port, verified free. */
async function stopWin(announce) {
  const first = winPortPids();
  if (!first.ok) {
    // A failed netstat probe is NOT a free port: never claim one we could not
    // read (a server may be holding it).
    console.error(`[launch] cannot inspect port ${PORT} (netstat failed: ${first.error}) — refusing to claim it free`);
    return false;
  }
  const pids = new Set(first.pids);
  // The pidfile pid is only a claim: pids are reused across hibernate/revive, so
  // signal it ONLY when its command line still looks like the preview we spawn
  // (preview.mjs's corroboration contract). Without this, a stale pidfile could
  // `taskkill /T` an unrelated process tree.
  const pidFilePid = readPidFile();
  if (
    pidFilePid !== null &&
    !pids.has(pidFilePid) &&
    isAlive(pidFilePid) &&
    looksLikeLaunchProcess(winProcessCommandLine(pidFilePid))
  ) {
    pids.add(pidFilePid);
  }
  const signalled = [...pids];
  for (const pid of signalled) killTree(pid);
  for (let waited = 0; waited < 5000; waited += 100) {
    const scan = winPortPids();
    if (!scan.ok || scan.pids.length === 0) break;
    await sleep(100);
  }
  const held = winPortPids();
  if (!held.ok) {
    console.error(`[launch] cannot verify port ${PORT} is free (netstat failed: ${held.error})`);
    return false;
  }
  if (held.pids.length > 0) {
    console.error(`[launch] port ${PORT} is still held by pid(s) ${held.pids.join(", ")}`);
    return false;
  }
  rmSync(PID_FILE, { force: true });
  if (announce) {
    console.log(
      signalled.length > 0
        ? `[launch] stopped pid(s) ${signalled.join(", ")} — port ${PORT} is free`
        : `[launch] nothing was listening on ${PORT}`,
    );
  }
  return true;
}

function ensureBuild() {
  if (existsSync(join(ROOT, ".vercel/output")) || existsSync(join(ROOT, "dist"))) return true;
  console.log("[launch] no build output — running `npm run build` (first launch, ~1 min)…");
  const r = spawnSync("npm", ["run", "build"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return r.status === 0;
}

function logTail(chars = 1500) {
  try {
    return readFileSync(LOG_FILE, "utf8").slice(-chars);
  } catch {
    return "(no log)";
  }
}

async function waitForReady(readyTimeoutMs, isAlivePid) {
  const deadline = Date.now() + readyTimeoutMs;
  while (Date.now() < deadline) {
    if (isAlivePid && !isAlivePid()) return false;
    try {
      await fetch(URL, { signal: AbortSignal.timeout(2000) });
      return true;
    } catch {
      await sleep(250);
    }
  }
  return false;
}

function openBrowser() {
  if (process.env.RAPIDTOOL_NO_OPEN === "1") return;
  try {
    const [cmd, args] =
      process.platform === "win32"
        ? ["cmd", ["/c", "start", "", URL]]
        : process.platform === "darwin"
          ? ["open", [URL]]
          : ["xdg-open", [URL]];
    spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } catch {
    /* browser launch is best-effort; the URL is printed regardless */
  }
}

async function startWin() {
  if (!(await stopWin(true))) return 1;
  if (!ensureBuild()) {
    console.error("[launch] build failed — nothing to serve");
    return 1;
  }
  const pgliteDir = applyPgliteDir();
  if (pgliteDir) console.log(`[launch] app data lives at ${pgliteDir}`);
  mkdirSync(dirname(LOG_FILE), { recursive: true });
  const log = openSync(LOG_FILE, "a");
  // Spawn the wrapper directly (not the `npm` shim, which is npm.cmd on win32):
  // the recorded pid is then the wrapper whose tree `taskkill /T` can reap.
  // A Desktop shortcut runs this file directly, not through `npm run`, so
  // node_modules/.bin is absent from PATH and with-app-env's shelled `vite`
  // would ENOENT. Put the local bin dir first (npm's own guarantee).
  const env = {
    ...process.env,
    PATH: `${join(ROOT, "node_modules", ".bin")}${delimiter}${process.env.PATH ?? ""}`,
  };
  const child = spawn(process.execPath, [join(ROOT, "scripts/with-app-env.mjs"), "vite", "preview"], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", log, log],
    windowsHide: true,
    env,
  });
  child.unref();
  writeFileSync(PID_FILE, `${child.pid}\n`);

  if (!(await waitForReady(DEFAULT_READY_TIMEOUT_MS, () => isAlive(child.pid)))) {
    console.error(`[launch] nothing answered on ${URL} — see ${LOG_FILE}`);
    console.error(logTail());
    killTree(child.pid);
    rmSync(PID_FILE, { force: true });
    return 1;
  }
  console.log(`[launch] RapidTool is running at ${URL} (pid ${child.pid}, log ${LOG_FILE})`);
  openBrowser();
  return 0;
}

async function run() {
  const args = parseLaunchArgs(process.argv.slice(2));
  if (args.error) {
    console.error(`[launch] ${args.error}`);
    return 2;
  }
  if (process.platform !== "win32") {
    // POSIX: preview.mjs owns /proc-based stop/restart — delegate, then open.
    if (args.action !== "stop" && !ensureBuild()) {
      console.error("[launch] build failed — nothing to serve");
      return 1;
    }
    const pgliteDir = applyPgliteDir();
    if (pgliteDir) console.log(`[launch] app data lives at ${pgliteDir}`);
    const previewAction = args.action === "stop" ? "stop" : "restart";
    const r = spawnSync(process.execPath, [PREVIEW_SCRIPT, previewAction], { stdio: "inherit" });
    if (r.status === 0 && args.action !== "stop") openBrowser();
    return r.status ?? 1;
  }
  if (args.action === "stop") return (await stopWin(true)) ? 0 : 1;
  return startWin();
}

if (isMainModule(import.meta.url)) {
  process.exitCode = await run();
}
