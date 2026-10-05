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

function winPortPids() {
  const out = spawnSync("netstat", ["-ano", "-p", "TCP"], {
    encoding: "utf8",
    windowsHide: true,
  }).stdout;
  return netstatListenPids(out, PORT);
}

/** Windows stop: the recorded tree plus whoever owns the port, verified free. */
async function stopWin(announce) {
  const pids = new Set();
  const pidFilePid = readPidFile();
  if (pidFilePid !== null && isAlive(pidFilePid)) pids.add(pidFilePid);
  for (const pid of winPortPids()) pids.add(pid);
  const signalled = [...pids];
  for (const pid of signalled) killTree(pid);
  for (let waited = 0; waited < 5000 && winPortPids().length > 0; waited += 100) await sleep(100);
  const held = winPortPids();
  if (held.length > 0) {
    console.error(`[launch] port ${PORT} is still held by pid(s) ${held.join(", ")}`);
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
