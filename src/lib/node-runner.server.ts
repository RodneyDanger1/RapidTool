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
export { runnerIsolationClaim } from "./sandbox-policy.ts";

type NodeRunCore =
  | {
      ok: true;
      stdout: string;
      stderr: string;
      durationMs: number;
      exitCode: number;
      /** T-107.6: present ONLY when a stream was clamped to
       *  RUNNER_OUTPUT_MAX_CHARS — absent (byte-identical envelope) otherwise. */
      outputClamp?: { stdout: RunnerOutputClamp; stderr: RunnerOutputClamp };
    }
  | {
      ok: false;
      reason: "not-configured";
      code: "RT_E_RUNNER_UNAVAILABLE";
      error?: string;
    }
  | { ok: false; reason: "refused"; code: "RT_E_VALIDATION"; error?: string }
  | { ok: false; reason: "timeout"; code: "RT_E_RUNNER_FAILED"; error?: string }
  | { ok: false; reason: "error"; code: "RT_E_RUNNER_FAILED"; error?: string };

export type NodeRunResult = NodeRunCore & { sandbox: false };

/** Stamp the honest non-sandbox advertisement on every runner envelope. */
function withSandbox(r: NodeRunCore): NodeRunResult {
  return { ...r, sandbox: false };
}

/**
 * W-26 (fixes/292_l1_register): the output-bomb bound. `maxBuffer` on
 * `spawn()` is NOT a real Node option (proved inert on Node 22 — a 2 MB write
 * under `maxBuffer: 1 MB` closes code 0), so enforcement is the streaming
 * byte counter in the data handlers below: once the child has written this
 * many bytes across stdout+stderr the tree is killed and the run reports a
 * coded failure — never a silent over-budget pass.
 */
const MAX_BUFFER = 1_000_000; // 1 MB
/** How much of each stream we keep in the returned result. */
const MAX_OUTPUT = 1_000_000; // 1 MB
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * T-107.6 (dossier 107 §6d + §9): the per-stream character cap on the
 * RETURNED stdout/stderr. Every character returned by a runner is re-sent to
 * the model on each subsequent request, so oversized outputs cost
 * quadratically over the remaining run (`output-limits.ts`); Cline's bash
 * executor ships the same 48 000-char head/tail truncation this constant
 * mirrors (107 §9 row 1). The 1 MB `MAX_OUTPUT` slice above stays the raw
 * capture bound — this cap applies AFTER redaction, to what actually leaves
 * the runner. Over-cap streams are middle-elided with a MARKED, COUNTED
 * elision (never a silent cut), so head (summary lines) and tail (the final
 * error) both survive.
 */
export const RUNNER_OUTPUT_MAX_CHARS = 48_000;

/** Per-stream clamp accounting carried on a clamped ok envelope (T-107.6). */
export type RunnerOutputClamp = {
  clamped: boolean;
  originalChars: number;
  elidedChars: number;
};

/**
 * Middle-truncate one runner stream to `maxChars` characters (T-107.6 — the
 * `RUNNER_OUTPUT_MAX_CHARS` cap; layout mirrors compaction.clampToolOutput so
 * both caps elide identically: marked middle elision, head+tail kept, text at
 * or under the cap passes through byte-identical). Non-string input yields the
 * empty unclamped result; a cap too small for a marked elision falls back to a
 * plain head-cut that still COUNTS what it dropped.
 */
export function clampRunnerOutput(
  text: string,
  maxChars: number = RUNNER_OUTPUT_MAX_CHARS,
): RunnerOutputClamp & { text: string } {
  if (typeof text !== "string") {
    return { text: "", clamped: false, originalChars: 0, elidedChars: 0 };
  }
  const cap =
    Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : RUNNER_OUTPUT_MAX_CHARS;
  if (text.length <= cap) {
    return { text, clamped: false, originalChars: text.length, elidedChars: 0 };
  }
  if (cap < 64) {
    return {
      text: text.slice(0, cap),
      clamped: true,
      originalChars: text.length,
      elidedChars: text.length - cap,
    };
  }
  // Two layout passes (marker length ↔ elided count), as clampToolOutput.
  const head = Math.floor(cap * 0.6);
  let tail = cap - head;
  for (let pass = 0; pass < 2; pass++) {
    const elided = text.length - head - tail;
    const marker = `\n… [${elided} chars elided by runner output cap] …\n`;
    tail = Math.max(0, cap - head - marker.length);
  }
  const elided = text.length - head - tail;
  const marker = `\n… [${elided} chars elided by runner output cap] …\n`;
  const out = `${text.slice(0, head)}${marker}${tail > 0 ? text.slice(text.length - tail) : ""}`;
  // 337-3 Trust (mirror of 337-1's compaction.clampToolOutput fix): a cap
  // between 64 and ~105 cannot fit the 0.6*cap head PLUS this marker, so the
  // marked layout is sliced through the marker itself — an unparseable stub
  // replaces real content AND the reported elision under-counts (probe: cap 90
  // -> "86 chars elided by runner output"). A truncated marker is not marked:
  // fall back to the same counted plain head-cut the <64 arm uses.
  // W51 boundary: `out` is built as `${head}${marker}${tail}`, so the former
  // `|| !out.includes(marker)` disjunct was entailed-dead — collapsed to the
  // one reachable trigger, matching the compaction twin.
  if (out.length > cap) {
    return {
      text: text.slice(0, cap),
      clamped: true,
      originalChars: text.length,
      elidedChars: text.length - cap,
    };
  }
  return {
    text: out,
    clamped: true,
    originalChars: text.length,
    elidedChars: elided,
  };
}

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
 * Redact secret-shaped tokens from captured child stdout/stderr before results
 * leave the runner (174-15). Replaces with `[secret-hidden]`.
 *
 * Covers 40+ char tokens (fakes in tests/comments only — never log a real key):
 *   - `sk-or-…`, `sk-proj-…`, then `sk-…` (longer prefixes first)
 *   - `Bearer eyJ…` JWTs
 *   - `sk_live_…` (underscore live-secret shape; hyphen `sk-` does not match it)
 *   - the live `process.env.DEEPSEEK_API_KEY` value when set (never log the key)
 *
 * This is NOT a sandbox and does not weaken scrubbedEnv (env allowlist is
 * separate). Pure-ish: only reads DEEPSEEK_API_KEY from the parent env.
 */
export function redactSecrets(text: string): string {
  if (typeof text !== "string") return text as unknown as string;
  if (text.length === 0) return text;
  let out = text;

  // Exact env value first (may be shorter than 40; still never echo it).
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (typeof apiKey === "string" && apiKey.length > 0) {
    // split/join — never build a RegExp from the key (metachar-safe).
    out = out.split(apiKey).join("[secret-hidden]");
  }

  // Longer prefixes first so `sk-or-` / `sk-proj-` are not double-hit by `sk-`.
  // Token body: alnum / _ / . / - (hyphen unescaped at end — lint no-useless-escape).
  // sk-or- = 6 → ≥34 more; sk-proj- = 8 → ≥32 more; sk- = 3 → ≥37 more.
  out = out.replace(/\bsk-or-[A-Za-z0-9_.-]{34,}/g, "[secret-hidden]");
  out = out.replace(/\bsk-proj-[A-Za-z0-9_.-]{32,}/g, "[secret-hidden]");
  out = out.replace(/\bsk-(?!or-)(?!proj-)[A-Za-z0-9_.-]{37,}/g, "[secret-hidden]");
  // Bearer eyJ… JWTs (header starts eyJ). "Bearer " + eyJ + ≥33 body ≥ 40 token-ish.
  out = out.replace(/\bBearer\s+eyJ[A-Za-z0-9_+=/.-]{33,}/g, "[secret-hidden]");
  // Underscore live-secret shape (sk_live_ = 8 → ≥32 more). Distinct from hyphen sk-.
  out = out.replace(/\bsk_live_[A-Za-z0-9]{32,}/g, "[secret-hidden]");

  return out;
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
    return withSandbox({
      ok: false,
      reason: "not-configured",
      code: "RT_E_RUNNER_UNAVAILABLE",
      error: "local bounded runner unavailable in this environment",
    });
  }
  if (typeof code !== "string" || code.trim().length === 0) {
    return withSandbox({
      ok: false,
      reason: "refused",
      code: "RT_E_VALIDATION",
      error: "empty source",
    });
  }
  // W40·K4: a non-finite timeout used to slip through — `Infinity` passes
  // `> 0`, then `setTimeout(fn, Infinity)` fires IMMEDIATELY (Node clamps
  // overflows and warns), so the run was killed on the first tick and the
  // result read "killed after Infinitys". Finite + floored + timer-bounded now.
  const MAX_TIMEOUT_MS = 2_147_483_647;
  const requestedMs = opts?.timeoutMs;
  const timeoutMs =
    typeof requestedMs === "number" && Number.isFinite(requestedMs) && requestedMs > 0
      ? Math.min(Math.floor(requestedMs), MAX_TIMEOUT_MS)
      : DEFAULT_TIMEOUT_MS;

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
    // W-26: `maxBuffer` is kept ONLY as forward-compat intent — on today's
    // Node it is inert for spawn() (proved: no kill at a 2 MB write) and the
    // real enforcement is the streaming counter below. The structural cast
    // covers the stdio-tuple overload — never `any`.
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
    return withSandbox({
      ok: false,
      reason: "error",
      code: "RT_E_RUNNER_FAILED",
      error: `spawn failed: ${(err as Error).message}`,
    });
  }

  let stdout = "";
  let stderr = "";
  // W-26: streaming output-bomb counter — the ONLY live enforcement of
  // MAX_BUFFER. Kills the tree once the child has written more bytes than the
  // cap across both pipes; settle() then reports the coded bomb failure.
  let receivedBytes = 0;
  let outputBombed = false;
  const bombCheck = (d: Buffer): void => {
    receivedBytes += d.length;
    if (receivedBytes > MAX_BUFFER && !outputBombed) {
      outputBombed = true;
      try {
        treeKill(child.pid ?? -1);
        child.kill("SIGKILL");
      } catch {
        // already gone.
      }
    }
  };
  child.stdout?.on("data", (d: Buffer) => {
    bombCheck(d);
    stdout = (stdout + d.toString()).slice(-MAX_OUTPUT);
  });
  child.stderr?.on("data", (d: Buffer) => {
    bombCheck(d);
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

    const finish = (r: NodeRunCore): void => {
      if (settled) return;
      settled = true;
      if (killTimer) clearTimeout(killTimer);
      for (const t of graceTimers) clearTimeout(t);
      graceTimers.clear();
      const advertised = withSandbox(r);
      // Sync-first, best-effort cleanup: removeScratchDir is TOTAL (it swallows
      // every error — see its own docblock), so an in-use/locked scratch dir is
      // simply left for the OS temp cleaner and the caller is never blocked on a
      // lingering grandchild. The old try/catch deferral that stood here was
      // unreachable by construction (337-3 probe: removeScratchDir never throws)
      // and its comment claimed a deferral the bytes never performed.
      removeScratchDir(dir, ownsScratchDir);
      resolve(advertised);
    };

    // Shared settle decision — 'close', the post-'exit' drain grace, and the
    // post-kill grace all land here, so every path reports the SAME honest
    // classification (timeout vs signal-kill vs exited) instead of whichever
    // event happened to arrive last.
    const settle = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (outputBombed) {
        // W-26: the streaming counter killed the tree — the honest cause is
        // NOT a timeout/signal teardown; report the bomb with the cap + the
        // observed byte count.
        finish({
          ok: false,
          reason: "error",
          code: "RT_E_RUNNER_FAILED",
          error: `killed: output exceeded the ${MAX_BUFFER / 1_000_000} MB cap (${receivedBytes} bytes written)`,
        });
        return;
      }
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
      // T-107.6: redact FIRST (a kept half-secret can never survive on the
      // clamp boundary), then clamp each stream to RUNNER_OUTPUT_MAX_CHARS —
      // the marked elision + its accounting ride the ok envelope only when a
      // stream actually crossed the cap (unclamped envelopes stay byte-identical).
      const outClamp = clampRunnerOutput(redactSecrets(stdout));
      const errClamp = clampRunnerOutput(redactSecrets(stderr));
      finish({
        ok: true,
        exitCode: code ?? -1,
        stdout: outClamp.text,
        stderr: errClamp.text,
        durationMs: Date.now() - started,
        ...(outClamp.clamped || errClamp.clamped
          ? {
              outputClamp: {
                stdout: {
                  clamped: outClamp.clamped,
                  originalChars: outClamp.originalChars,
                  elidedChars: outClamp.elidedChars,
                },
                stderr: {
                  clamped: errClamp.clamped,
                  originalChars: errClamp.originalChars,
                  elidedChars: errClamp.elidedChars,
                },
              },
            }
          : {}),
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
