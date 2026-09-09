// ---------------------------------------------------------------------------
// node-runner.server.ts — LOCAL BOUNDED code runner for the Node host.
//
// HONEST LABEL (load-bearing, mirrors sandbox.ts's sandboxClaim() honesty):
// this is a *bounded* execution environment, NOT a security sandbox. It
// enforces, on the Node host (Windows-safe):
//   • wall-clock timeout  -> a timer fires tree-kill + SIGKILL (taskkill /T /F
//                            on win32 so grandchildren die too);
//   • output caps         -> maxBuffer + a manual slice of stdout/stderr;
//   • scratch cwd          -> a fresh temp dir per run (courtesy, not a jail);
//   • scrubbed child env   -> proxy vars emptied / NO_PROXY="*" (best-effort).
//
// What it does NOT provide (and must never be claimed): filesystem confinement
// (the scratch cwd is a courtesy — the child can touch anything the OS user
// can), memory/CPU rlimits, or real network denial (raw sockets bypass proxy
// env vars). Only an OS-level boundary (Docker / WSL2 / Windows Sandbox /
// AppContainer / VM) contains a determined adversary. Do not run untrusted
// third-party code here.
//
// Server-only: never import this module into a client bundle.
// ---------------------------------------------------------------------------
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type NodeRunResult =
  | { ok: true; stdout: string; stderr: string; durationMs: number; exitCode: number }
  | {
      ok: false;
      reason: "not-configured";
      code: "RT_E_RUNNER_UNAVAILABLE";
      error?: string;
    }
  | { ok: false; reason: "refused"; code: "RT_E_VALIDATION"; error?: string }
  | { ok: false; reason: "timeout"; code: "RT_E_RUNNER_FAILED"; error?: string }
  | { ok: false; reason: "error"; code: "RT_E_RUNNER_FAILED"; error?: string };

/** Hard cap before Node kills the child on a runaway writer (maxBuffer). */
const MAX_BUFFER = 1_000_000; // 1 MB
/** How much of each stream we keep in the returned result. */
const MAX_OUTPUT = 1_000_000; // 1 MB
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * H4: settle guarantees. 'close' fires only after the child's stdio streams
 * fully drain — a grandchild that inherits the stdout/stderr pipes and outlives
 * the child (or the wall-clock kill) keeps those pipes open and 'close' never
 * fires, which used to strand the caller's promise forever. Two bounded grace
 * windows make settlement unconditional:
 *   • CLOSE_GRACE_MS — after the child process itself ends ('exit'), settle on
 *     the captured exit state if 'close' has not arrived within this window
 *     (normal runs close in a few ms, so this never delays a healthy result);
 *   • KILL_GRACE_MS — after the wall-clock timeout fires the tree-kill, settle
 *     with the timeout result if the tree has not actually died within this
 *     window. Worst-case settlement is timeoutMs + KILL_GRACE_MS, never ∞.
 */
export const CLOSE_GRACE_MS = 1_000;
export const KILL_GRACE_MS = 1_000;

/** True when a real Node binary is available to spawn (we run `node -e <code>`). */
export function runnerAvailable(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.execPath === "string" &&
    process.execPath.length > 0
  );
}

/** Windows: killing the direct child does not reap grandchildren. taskkill /T /F
 *  takes the whole tree. Best-effort — never throws. */
function treeKill(pid: number): void {
  if (process.platform !== "win32" || pid <= 0) return;
  try {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  } catch {
    // already gone / never started — nothing to kill.
  }
}

/** Copy a tight allowlist of process.env into the child. Never copies API
 *  keys (174-5): generated code must not inherit DEEPSEEK_API_KEY. */
const CHILD_ENV_ALLOW = new Set([
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "TEMP",
  "TMP",
  "TMPDIR",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "PROGRAMW6432",
  "PROGRAMDATA",
  "OS",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "LANG",
  "LC_ALL",
  "TZ",
  "NODE_PATH",
]);

export function scrubbedEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of Object.keys(process.env)) {
    const upper = key.toUpperCase();
    if (CHILD_ENV_ALLOW.has(upper) || CHILD_ENV_ALLOW.has(key) || upper === "PATH") {
      env[key] = process.env[key];
    }
  }
  env.HTTP_PROXY = "";
  env.HTTPS_PROXY = "";
  env.ALL_PROXY = "";
  env.NO_PROXY = "*";
  return env;
}

/**
 * Best-effort scratch-dir cleanup. `owned` is false when mkdtempSync failed and
 * the run fell back to the OS temp root itself — that fallback dir must NEVER be
 * removed (rmSync(recursive) on tmpdir() would delete the whole temp tree), so
 * the fallback is simply left for the OS. Deletion errors (Windows file locks
 * from a still-draining child) are swallowed: a cleanup failure must never
 * throw inside a settle path and strand the caller's result forever.
 */
export function removeScratchDir(dir: string, owned: boolean): void {
  if (!owned) return;
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // already gone / locked — the OS temp cleaner will reap it eventually.
  }
}

export async function runNodeBounded(
  code: string,
  opts?: { timeoutMs?: number },
): Promise<NodeRunResult> {
  if (!runnerAvailable()) {
    return {
      ok: false,
      reason: "not-configured",
      code: "RT_E_RUNNER_UNAVAILABLE",
      error: "local bounded runner unavailable in this environment",
    };
  }
  if (typeof code !== "string" || code.trim().length === 0) {
    return {
      ok: false,
      reason: "refused",
      code: "RT_E_VALIDATION",
      error: "empty source",
    };
  }
  const timeoutMs =
    typeof opts?.timeoutMs === "number" && opts.timeoutMs > 0 ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;

  let dir: string;
  let ownsScratchDir = true;
  try {
    dir = mkdtempSync(join(tmpdir(), "rapidtool-run-"));
  } catch {
    // TMPDIR missing/unwritable: run from the OS temp root as a last resort —
    // but mark the dir UNOWNED so cleanup never rmSyncs the temp root itself.
    dir = tmpdir();
    ownsScratchDir = false;
  }

  const started = Date.now();
  let child: ChildProcess;
  try {
    // process.execPath = the exact Node binary (no PATH surprises); `-e` passes
    // code as an ARGUMENT (never through a shell), so quoting is a non-issue.
    // maxBuffer is a real Node spawn option (output-bomb kill), but this
    // @types/node build only exposes it on the stdio-tuple overload, so a narrow
    // structural cast keeps the guard without widening to `any`.
    const spawnOpts = {
      cwd: dir,
      env: scrubbedEnv(),
      maxBuffer: MAX_BUFFER,
      windowsHide: true, // no console window flash on the desktop
      stdio: ["ignore", "pipe", "pipe"], // no stdin; bounded stdout/stderr pipes
    } as import("node:child_process").SpawnOptions & { maxBuffer: number };
    child = spawn(process.execPath, ["-e", code], spawnOpts);
  } catch (err) {
    removeScratchDir(dir, ownsScratchDir);
    return {
      ok: false,
      reason: "error",
      code: "RT_E_RUNNER_FAILED",
      error: `spawn failed: ${(err as Error).message}`,
    };
  }

  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (d: Buffer) => {
    stdout = (stdout + d.toString()).slice(-MAX_OUTPUT);
  });
  child.stderr?.on("data", (d: Buffer) => {
    stderr = (stderr + d.toString()).slice(-MAX_OUTPUT);
  });

  return new Promise<NodeRunResult>((resolve) => {
    let settled = false;
    let timedOut = false;
    let killTimer: NodeJS.Timeout | null = null;
    // H4: settle-boundary timers (see CLOSE_GRACE_MS / KILL_GRACE_MS). Tracked
    // so finish() can clear every one of them — no orphaned timer may outlive
    // a settled run.
    const graceTimers = new Set<NodeJS.Timeout>();
    const armGrace = (fn: () => void, ms: number): void => {
      const t = setTimeout(fn, ms);
      graceTimers.add(t);
    };
    // Last process state seen ('exit' carries it; 'close' normally confirms).
    let exitCodeAtExit: number | null = null;
    let signalAtExit: NodeJS.Signals | null = null;

    const finish = (r: NodeRunResult): void => {
      if (settled) return;
      settled = true;
      if (killTimer) clearTimeout(killTimer);
      for (const t of graceTimers) clearTimeout(t);
      graceTimers.clear();
      // Sync-first cleanup keeps the common case immediate (callers/test
      // observe no scratch residue right after the run). On Windows rmSync
      // THROWS while a pipe-holding grandchild still has its cwd inside the
      // dir — then defer: resolve first, best-effort remove on a later tick,
      // so the caller never blocks on a lingering grandchild.
      try {
        removeScratchDir(dir, ownsScratchDir);
      } catch {
        resolve(r);
        setImmediate(() => {
          try {
            removeScratchDir(dir, ownsScratchDir);
          } catch {
            // best-effort — OS temp cleanup is the backstop
          }
        });
        return;
      }
      resolve(r);
    };

    // Shared settle decision — 'close', the post-'exit' drain grace, and the
    // post-kill grace all land here, so every path reports the SAME honest
    // classification (timeout vs signal-kill vs exited) instead of whichever
    // event happened to arrive last.
    const settle = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (timedOut) {
        // The wall-clock timer fired and killed the tree — the ONLY honest
        // "timeout" reason.
        finish({
          ok: false,
          reason: "timeout",
          code: "RT_E_RUNNER_FAILED",
          error: `killed after ${timeoutMs / 1000}s`,
        });
        return;
      }
      if (signal !== null) {
        // Killed by a signal that is NOT our wall-clock timer (external kill /
        // OS teardown): calling that a timeout with a fake duration would be a
        // lie — report it as a failed run with the real signal name.
        finish({
          ok: false,
          reason: "error",
          code: "RT_E_RUNNER_FAILED",
          error: `run killed by signal ${signal}`,
        });
        return;
      }
      finish({
        ok: true,
        exitCode: code ?? -1,
        stdout,
        stderr,
        durationMs: Date.now() - started,
      });
    };

    // Distinguish failure families honestly. The child 'error' event fires for
    // BOTH spawn failures (ENOENT/EACCES/E2BIG…) and output-cap kills
    // (ERR_CHILD_PROCESS_STDIO_MAXBUFFER); the old code blamed everything on
    // "spawn failed", which mislabels a runaway-writer kill.
    child.on("error", (err: Error) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
        finish({
          ok: false,
          reason: "timeout",
          code: "RT_E_RUNNER_FAILED",
          error: "killed: output exceeded the 1 MB capture cap",
        });
        return;
      }
      finish({
        ok: false,
        reason: "error",
        code: "RT_E_RUNNER_FAILED",
        error: `spawn failed: ${err.message}`,
      });
    });
    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      // The process itself has ended; 'close' (stdio fully drained) may still
      // lag forever when a grandchild inherited the pipes — bound that wait.
      exitCodeAtExit = code;
      signalAtExit = signal;
      armGrace(() => settle(exitCodeAtExit, signalAtExit), CLOSE_GRACE_MS);
    });
    child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
      settle(code, signal);
    });

    killTimer = setTimeout(() => {
      timedOut = true;
      try {
        treeKill(child.pid ?? -1);
        child.kill("SIGKILL");
      } catch {
        // already gone.
      }
      // The tree may not die promptly (orphaned grandchild holding the pipes):
      // settle with the timeout result once the grace window passes — never
      // wait on 'close' forever.
      armGrace(() => settle(null, null), KILL_GRACE_MS);
    }, timeoutMs);
  });
}
