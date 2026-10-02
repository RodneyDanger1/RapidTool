#!/usr/bin/env node
/**
 * Run a command with `.grok/app-env.json` merged into its environment.
 *
 * `dev`, `build` and `preview` all route through this wrapper, so the dev
 * server, the built bundle and the preview server can never disagree about
 * `VITE_AUTH_ENABLED` — a divergence that only shows up as a built-output
 * mismatch long after the fact. Anything that starts Vite directly bypasses it.
 *
 * Only `VITE_`-prefixed keys are honored: the file is a build flag carrier, not
 * a secret store, and only `VITE_` vars reach the browser anyway. A real
 * `process.env` entry always wins, so an explicit override still works.
 *
 * W45·331-1 (Keywright) additionally declares the repo `.env` to the
 * SERVER-SIDE LLM key resolver by setting `RAPIDTOOL_LLM_ENV_FILE` in the child
 * env (`src/lib/llm/providers/key-source.server.ts`). That value is a PATH, not
 * a secret, and is never `VITE_`-prefixed, so it can never reach the browser
 * bundle; it lets the dev/preview server functions resolve the repo key.
 *
 * That precedence also means the file governs this workspace only. A deployed
 * build runs with the provider's project env, where the deployer sets
 * `VITE_AUTH_ENABLED` itself (today unconditionally `"true"`), so the deployed
 * flag is the platform's, not this file's.
 *
 * Vite picks the values up because `loadEnv` prefix-matches entries already in
 * `process.env`, which is why the merge has to happen before Vite starts.
 */
import { spawn } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { constants as osConstants } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ENV_REL_PATH = ".grok/app-env.json";

/** The `.env` file the server-side LLM key resolver is pointed at (W45·331-1). */
export const LLM_ENV_REL_PATH = ".env";
/** Env var carrying that file's path to the server process. Kept in sync with
 *  `LLM_ENV_FILE_VAR` in src/lib/llm/providers/key-source.server.ts (pinned by
 *  that module's test). Non-secret, server-side, never `VITE_`-prefixed. */
export const LLM_ENV_FILE_VAR = "RAPIDTOOL_LLM_ENV_FILE";

const VITE_PREFIX = "VITE_";

/**
 * Parse an app-env document, keeping only `VITE_`-prefixed string entries.
 * Anything unparseable is an empty environment — a workspace without the file
 * must behave exactly like today (auth on, no overrides).
 */
export function parseAppEnv(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const env = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!key.startsWith(VITE_PREFIX)) continue;
    if (typeof value !== "string") continue;
    env[key] = value;
  }
  return env;
}

/** The app env recorded under `root`, or `{}` when the file is absent. */
export function readAppEnv(root) {
  try {
    return parseAppEnv(readFileSync(join(root, APP_ENV_REL_PATH), "utf8"));
  } catch {
    return {};
  }
}

/** File values under the process environment: an explicit override wins. */
export function mergeAppEnv(appEnv, processEnv) {
  return { ...appEnv, ...processEnv };
}

/**
 * Translate a child's `exit` `(code, signal)` into this process's exit status.
 *
 * Do not re-raise the signal with `process.kill(process.pid, signal)`: under
 * qemu-user (amd64 image builds on an arm host) a self-directed signal is
 * routinely delivered as SIGSEGV to the wrong process, which takes down the
 * test worker and fails the image build. `128 + signo` is what a shell reports
 * for a signal-killed command, so a cancelled `vite build` is still a failure.
 */
export function exitStatusFromChild(code, signal) {
  if (signal) {
    const signo = osConstants.signals[signal];
    return 128 + (typeof signo === "number" ? signo : 1);
  }
  return code ?? 1;
}

/** The workspace root (this file lives in `<root>/scripts/`). */
export function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/**
 * Whether `moduleUrl` is the script node was asked to run.
 *
 * Both sides are resolved through symlinks: node realpaths `import.meta.url`
 * but leaves `process.argv[1]` as typed, so comparing them raw makes a CLI
 * launched through a symlinked path (`/tmp` on macOS) a silent no-op.
 */
export function isMainModule(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  const self = fileURLToPath(moduleUrl);
  try {
    return realpathSync(entry) === self;
  } catch {
    // Fail closed, not open: `false` here would make the caller's
    // `if (isMainModule(...)) main()` a SILENT no-op (exit 0, nothing run).
    // realpath only throws when argv[1] is missing/unreadable, so retry from
    // this module's own path (always readable while it is executing), then
    // fall back to the raw compare.
    try {
      return realpathSync(self) === entry;
    } catch {
      return entry === self;
    }
  }
}

/**
 * Reap the spawned command's WHOLE tree in response to a signal this wrapper
 * caught. M6-03 (312 · D3): on win32 `child.kill(signal)` terminates only the
 * DIRECT child — the cmd.exe shim layer (`shell: true` spawns) and every
 * process it started (vite, its workers) survive as orphans (308 map6 probe:
 * child 10696 + grandchild 15468 still alive after the wrapper kill;
 * heartbeats 14→27). `taskkill /pid <pid> /T /F` takes the whole tree — the
 * same pattern node-runner.server.ts:164-171 documents. POSIX keeps
 * `child.kill(signal)`: a real signal to a directly-spawned child is the
 * correct, graceful path there. Best-effort: never throws; when taskkill
 * itself cannot launch, the direct kill still fires.
 */
export function reapChildTree(child, signal, spawnFn = spawn) {
  if (process.platform === "win32" && child && Number.isInteger(child.pid) && child.pid > 0) {
    try {
      const killer = spawnFn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
      if (killer && typeof killer.on === "function") {
        killer.on("error", () => {
          try {
            child.kill(signal);
          } catch {
            /* already gone — nothing to kill */
          }
        });
      }
      return;
    } catch {
      /* taskkill not launchable — fall through to the direct kill */
    }
  }
  child.kill(signal);
}

function main(argv) {
  const [command, ...args] = argv;
  if (!command) {
    console.error("usage: node scripts/with-app-env.mjs <command> [args…]");
    process.exit(2);
  }
  const env = mergeAppEnv(readAppEnv(projectRoot()), process.env);
  // W45·331-1 (Keywright): declare the repo `.env` to the SERVER-SIDE key
  // resolver (src/lib/llm/providers/key-source.server.ts). The provider reads
  // non-VITE_ keys through it, applying `.env`-wins precedence + the coded
  // RT_E_LLM_KEY_SHADOWED signal — so the dev/preview server functions (the
  // console's "Spawn crew") use the repo key, not a stale User-scope one. Only
  // a PATH crosses here: non-secret, server-only, never `VITE_`-prefixed.
  env[LLM_ENV_FILE_VAR] = join(projectRoot(), LLM_ENV_REL_PATH);
  // Windows compat: Node's spawn cannot launch .cmd/.bat shims directly and does
  // not apply PATHEXT, so bare "vite" would ENOENT. Shelling out on win32 lets
  // cmd.exe resolve node_modules/.bin/vite.cmd; POSIX spawns directly (npm run
  // puts .bin on PATH). Only bare names are affected — absolute paths (e.g.
  // process.execPath) are untouched on every platform.
  const useShell = process.platform === "win32" && /^[A-Za-z0-9_-]+$/.test(command);
  const child = spawn(command, args, { stdio: "inherit", env, shell: useShell });
  // The dev server is long-running and is stopped by signalling this wrapper.
  // M6-03 (312 · D3): each caught signal reaps the child's WHOLE tree — a
  // direct-child kill here used to strand the win32 descendants (see
  // reapChildTree).
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => reapChildTree(child, signal));
  }
  child.on("error", (err) => {
    console.error(`[with-app-env] failed to run ${command}:`, err?.message || err);
    process.exit(127);
  });
  child.on("exit", (code, signal) => {
    process.exit(exitStatusFromChild(code, signal));
  });
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2));
}
