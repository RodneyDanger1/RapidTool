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
//   • scrubbed child env   -> proxy vars emptied / NO_PROXY="*" (best-effort);
//   • strict bound (fixes/346 P1-4) -> `opts.isolation:"strict"` runs the child
//                            under Node's Permission Model (`--permission`,
//                            verified present on both runtimes this repo runs:
//                            22.23.2 and 24.15.0): filesystem writes are
//                            confined to the per-run scratch dir, child_process
//                            / worker_threads / native addons are DENIED, and a
//                            V8 heap cap is applied. REAL enforcement — the
//                            generated-code path (exec.runCode) uses it.
//   • confined bound (fixes/346 lane-1 runner-strictness) -> the SECOND tier,
//                            `opts.isolation:"confined"`: the SAME Permission
//                            Model + heap cap and the SAME fs-write confinement
//                            to the per-run scratch dir, but child_process is
//                            EXPLICITLY ALLOWED (`--allow-child-process`) so a
//                            harness that must spawn its own tool (compile-check
//                            runs `node --test`) is not blanket-denied. Node
//                            propagates the permission flags to spawned Node
//                            descendants, so their writes stay scratch-confined
//                            too (a NON-Node child would not inherit them:
//                            declared, and Node prints its own SecurityWarning
//                            for this flag). Filesystem READS are allowed
//                            broadly (`--allow-fs-read=*`): the harness legs
//                            must read the emitted tree outside the scratch.
//
// Platform gap (declared, not hidden): Windows Job Objects would give OS
// kernel-enforced memory/CPU/process-count caps, but Node exposes no Job Object
// API and reaching CreateJobObject/AssignProcessToJobObject needs a native
// addon or a PowerShell P/Invoke helper — a large runtime dependency this repo
// does not take. So the Permission Model is the strongest zero-dependency
// primitive used; `permissionModelAvailable()` reports honestly when even that
// is absent, and a strict run then degrades to timeout + output cap only.
//
// Still NOT provided (and must never be claimed): network denial (raw sockets
// bypass proxy env vars, and the Permission Model does not gate network), or
// Docker / WSL2 / Windows Job Object / AppContainer / VM isolation. When strict
// is OFF (the legacy default) there is no filesystem confinement either. Only
// an OS-level boundary contains a determined adversary. Do not run untrusted
// third-party code here.
//
// Server-only: never import this module into a client bundle.
// ---------------------------------------------------------------------------
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
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
      /** 344 A2-F1: present ONLY when `opts.verdictChannel` requested — the
       *  nonce-authenticated lines the child wrote to fd 3, with the per-run
       *  nonce prefix stripped. Absent (byte-identical envelope) otherwise. */
      verdict?: string;
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

/**
 * fixes/346 P1-4: the REAL resource/process bound actually applied to a run.
 * Present ONLY when `opts.isolation:"strict" | "confined"` was requested (so
 * the legacy envelope stays byte-identical). `mechanism:"none"` +
 * `enforced:false` is the honest degradation when the runtime lacks the
 * Permission Model flag — never a pretend claim.
 */
export type RunnerIsolationTier = "strict" | "confined";

export type RunnerBound = {
  mechanism: "node-permission-model" | "none";
  /** Pure capability probe: this runtime exposes the `--permission` flag. */
  available: boolean;
  /** True only when the bound was APPLIED to this run. */
  enforced: boolean;
  fsWriteConfined: boolean;
  /** True only for `strict` when enforced: child_process/workers/addons denied. */
  subprocessDenied: boolean;
  heapCapMb: number | null;
  // --- confined-tier additive fields (absent on a strict envelope, which stays
  // byte-identical to the pre-lane-1 shape) ---
  /** Which tier was requested: `confined` explicitly allows child_process
   *  (`compile-check` spawns `node --test`) while keeping fs-write confined. */
  tier?: RunnerIsolationTier;
  /** True for `confined`: the tier explicitly permits spawning a child. */
  subprocessAllowed?: boolean;
  /** Honest scope of the applied bound — names what IS and is NOT covered. */
  note?: string;
};

export type NodeRunResult = NodeRunCore & { sandbox: false; bound?: RunnerBound };

/** Stamp the honest non-sandbox advertisement on every runner envelope.
 *  `bound` rides only when a strict/confined run actually requested one. */
function withSandbox(r: NodeRunCore, bound: RunnerBound | null = null): NodeRunResult {
  return bound ? { ...r, sandbox: false, bound } : { ...r, sandbox: false };
}

/** fixes/346 P1-4: the flag Node exposes for its Permission Model (the
 *  strongest zero-dependency resource/process boundary available on this
 *  platform). Verified accepted on Node 22.23.2 AND 24.15.0. */
export const RUNNER_PERMISSION_FLAG = "--permission";
/** fixes/346 P1-4: V8 heap cap (MB) applied to a tiered (strict/confined) run —
 *  a REAL memory bound against JS-heap bombs (external Buffers are not covered:
 *  declared). */
export const RUNNER_STRICT_HEAP_CAP_MB = 512;

/**
 * fixes/346 P1-4: pure capability probe (no subprocess). Reads
 * `process.allowedNodeEnvironmentFlags`, which lists every CLI flag the runtime
 * knows, so a host without the Permission Model reports false and the runner
 * degrades honestly. Never claims a bound it cannot enforce.
 */
export function permissionModelAvailable(
  flags: { has(flag: string): boolean } | undefined = typeof process !== "undefined" &&
    process.allowedNodeEnvironmentFlags
    ? process.allowedNodeEnvironmentFlags
    : undefined,
): boolean {
  return !!flags && typeof flags.has === "function" && flags.has(RUNNER_PERMISSION_FLAG);
}

/** The child-arg prefix for a strict run (flags BEFORE `-e <code>`). Exported
 *  so the policy is observable/testable without spawning. */
export function strictRunnerArgs(dir: string): string[] {
  const allow = dir.replace(/\\/g, "/");
  return [
    RUNNER_PERMISSION_FLAG,
    `--allow-fs-read=${allow}`,
    `--allow-fs-write=${allow}`,
    `--max-old-space-size=${RUNNER_STRICT_HEAP_CAP_MB}`,
  ];
}

/**
 * fixes/346 lane-1: the child-arg prefix for a `confined` run — the same
 * Permission Model + heap cap and the same fs-write confinement to the scratch
 * dir, but `--allow-child-process` (so the compile-check harness can spawn
 * `node --test`) and broad fs-READ (the harness legs read the emitted tree
 * outside the scratch). `extraWriteDirs` are ADDITIONAL caller-declared write
 * roots — compile-check's run COPY is a temp workspace its emitted specs
 * legitimately write into; writes everywhere else stay denied. Exported so the
 * policy is observable/testable without spawning. `--allow-child-process` is
 * deliberately NOT in `strictRunnerArgs`.
 */
export function confinedRunnerArgs(dir: string, extraWriteDirs: readonly string[] = []): string[] {
  const norm = (p: string): string => p.replace(/\\/g, "/");
  const writeFlags = [dir, ...extraWriteDirs]
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .map((p) => `--allow-fs-write=${norm(p)}`);
  return [
    RUNNER_PERMISSION_FLAG,
    "--allow-fs-read=*",
    ...writeFlags,
    "--allow-child-process",
    `--max-old-space-size=${RUNNER_STRICT_HEAP_CAP_MB}`,
  ];
}

/**
 * fixes/346 lane-1: the honest bound record for a requested tier. PURE (no
 * probe, no spawn) so the degradation rule is directly testable without a mock:
 * `permissionAvailable:false` ⇒ `mechanism:"none"`, `enforced:false`, and no
 * confinement claim — never a pretend boundary. The `strict` arm returns
 * EXACTLY the pre-lane-1 strict shape (no new keys); the `confined` arm adds
 * `tier`/`subprocessAllowed`/`note`.
 */
export function tierBound(
  tier: RunnerIsolationTier,
  permissionAvailable: boolean,
  extraWriteDirs: readonly string[] = [],
): RunnerBound {
  const base: RunnerBound = {
    mechanism: permissionAvailable ? "node-permission-model" : "none",
    available: permissionAvailable,
    enforced: permissionAvailable,
    fsWriteConfined: permissionAvailable,
    subprocessDenied: tier === "strict" && permissionAvailable,
    // The heap cap rides the fallback args even when the Permission Model is
    // absent, so it stays a real number for a requested tier.
    heapCapMb: RUNNER_STRICT_HEAP_CAP_MB,
  };
  // Strict is byte-identical to the pre-lane-1 bound: no added keys.
  if (tier === "strict") return base;
  const extra =
    extraWriteDirs.filter((d) => typeof d === "string" && d.length > 0).length > 0
      ? ` plus ${extraWriteDirs.length} caller-declared workspace dir(s)`
      : "";
  const note = permissionAvailable
    ? "harness runs under Node's Permission Model: filesystem writes are confined to the per-run scratch " +
      `dir${extra} and filesystem reads are allowed broadly (the harness legs read the emitted tree), ` +
      "child_process is EXPLICITLY ALLOWED (the compile-check harness spawns `node --test`), and a V8 heap " +
      `cap (${RUNNER_STRICT_HEAP_CAP_MB} MB) is applied. Spawned Node descendants inherit these flags; a ` +
      "NON-Node child would not. Not network denial and not an OS sandbox."
    : `the runtime does not expose Node's Permission Model flag (${RUNNER_PERMISSION_FLAG}); the requested ` +
      `"${tier}" bound was NOT applied — only the wall-clock timeout + output cap are enforced.`;
  return { ...base, tier, subprocessAllowed: true, note };
}

/**
 * fixes/346 lane-1: the flags prepended BEFORE `-e <code>` for a tier. PURE.
 * With `permissionAvailable:false` the Permission-Model flags are SKIPPED and
 * only the heap cap remains (never a pretend boundary), matching `tierBound`.
 */
export function tierRunnerArgs(
  tier: RunnerIsolationTier,
  dir: string,
  permissionAvailable: boolean,
  extraWriteDirs: readonly string[] = [],
): string[] {
  if (!permissionAvailable) return [`--max-old-space-size=${RUNNER_STRICT_HEAP_CAP_MB}`];
  return tier === "strict"
    ? strictRunnerArgs(dir)
    : confinedRunnerArgs(dir, extraWriteDirs);
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
 *   - fixes/346 A2-F6: `xai-…` (the OpenAI-compatible family) and `tvly-…`
 *     (Tavily) vendor prefixes — alphanumeric bodies only, ≥16 chars, so a
 *     hyphenated prose lookalike (`xai-based`, `tvly-dev`) is left intact
 *   - the live provider key env values when set (`DEEPSEEK_API_KEY`,
 *     `XAI_API_KEY`, `TAVILY_API_KEY`) — never log a key
 *
 * This is NOT a sandbox and does not weaken scrubbedEnv (env allowlist is
 * separate). Pure-ish: only reads those env values from the parent env.
 */
export function redactSecrets(text: string): string {
  if (typeof text !== "string") return text as unknown as string;
  if (text.length === 0) return text;

  let out = text;

  // Exact env values first (may be shorter than the shape floor; still never
  // echo them). split/join — never build a RegExp from a key (metachar-safe).
  for (const name of ["DEEPSEEK_API_KEY", "XAI_API_KEY", "TAVILY_API_KEY"]) {
    const apiKey = process.env[name];
    if (typeof apiKey === "string" && apiKey.length > 0) {
      out = out.split(apiKey).join("[secret-hidden]");
    }
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
  // fixes/346 A2-F6: vendor key prefixes absent from ordinary prose. Alnum-only
  // bodies (not `-`/`_`) so a hyphenated lookalike stays byte-identical.
  out = out.replace(/\bxai-[A-Za-z0-9]{16,}/g, "[secret-hidden]");
  out = out.replace(/\btvly-[A-Za-z0-9]{16,}/g, "[secret-hidden]");

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

/**
 * 344 A2-F1: filter a raw fd-3 capture down to the lines the child's harness
 * actually wrote, authenticated by the per-run nonce the parent delivered
 * out-of-band on stdin (so it is absent from `process.execArgv`, `process.env`
 * and every global-lexical binding the module under test can reach). The nonce
 * prefix is stripped, leaving the legacy marker lines. A line written by the
 * module itself (which has no way to learn the nonce) never matches. Pure.
 */
function authenticatedVerdict(raw: string, nonce: string): string {
  if (!nonce) return "";
  const prefix = `${nonce} `;
  const lines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith(prefix)) lines.push(line.slice(prefix.length));
  }
  // The authenticated lines can carry module-derived case detail; redact before
  // they leave the runner (same policy as stdout/stderr).
  return redactSecrets(lines.join("\n"));
}

export type NodeRunOptions = {
  timeoutMs?: number;
  /**
   * 344 A2-F1: open a dedicated verdict channel. The child gets stdin (where
   * the parent writes a fresh nonce) and fd 3 (where the harness writes its
   * marker lines prefixed with that nonce). The returned ok envelope carries
   * `verdict` — the authenticated lines, prefix stripped. Omitted ⇒ the
   * legacy stdio (`["ignore","pipe","pipe"]`) and no `verdict` field.
   */
  verdictChannel?: boolean;
  /**
   * fixes/346 P1-4 + lane-1: the isolation tier.
   *   `"strict"`   — Node Permission Model: fs writes confined to the scratch
   *                  dir, child_process / workers / addons denied, V8 heap cap.
   *   `"confined"` — same fs-write confinement + heap cap, but child_process is
   *                  EXPLICITLY ALLOWED (compile-check's harness spawns
   *                  `node --test`) and fs READ is allowed broadly (the harness
   *                  reads the emitted tree outside the scratch).
   * Omitted / `"none"` preserves the legacy timeout + output-cap behaviour
   * byte-for-byte. The generated-code path (`exec.runCode`) always requests
   * strict; `verify.server.ts` requests strict; `compile-check.server.ts`
   * requests confined.
   */
  isolation?: RunnerIsolationTier | "none";
  /**
   * fixes/346 lane-1: additional directories a `confined` child (and its Node
   * descendants) may WRITE into, on top of the per-run scratch dir. This is how
   * a harness whose workspace is a temp COPY declares that workspace — the
   * emitted specs legitimately write into the copy, so confining them to the
   * runner's private scratch alone would break the trusted harness. Writes
   * everywhere else (the subject tree included) stay denied. Ignored by
   * `strict`/legacy runs.
   */
  isolationWriteDirs?: string[];
};

export async function runNodeBounded(
  code: string,
  opts?: NodeRunOptions,
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
  // 346 C3: the floor is 1ms too — a positive sub-millisecond ask (0.5) used to
  // floor to 0 and abort on the first tick ("killed after 0s"), i.e. a positive
  // budget became an instant timeout (the same class probe.ts's floor closed).
  const MAX_TIMEOUT_MS = 2_147_483_647;
  const requestedMs = opts?.timeoutMs;
  const timeoutMs =
    typeof requestedMs === "number" && Number.isFinite(requestedMs) && requestedMs > 0
      ? Math.max(1, Math.min(Math.floor(requestedMs), MAX_TIMEOUT_MS))
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

  const verdictChannel = opts?.verdictChannel === true;
  // fixes/346 P1-4 + lane-1: the isolation tier. Probed (never assumed) so an
  // unsupported host degrades to the legacy bounds with an honest `bound`
  // record. `strict` denies child_process; `confined` allows it (compile-check
  // spawns `node --test`) while keeping fs writes confined to the scratch.
  const tier: RunnerIsolationTier | null =
    opts?.isolation === "strict"
      ? "strict"
      : opts?.isolation === "confined"
        ? "confined"
        : null;
  const permissionAvailable = tier !== null ? permissionModelAvailable() : false;
  // Extra write roots are honored ONLY by the confined tier (strict never
  // widens its scratch confinement).
  const extraWriteDirs =
    tier === "confined" && Array.isArray(opts?.isolationWriteDirs)
      ? opts.isolationWriteDirs.filter((d): d is string => typeof d === "string" && d.length > 0)
      : [];
  const bound: RunnerBound | null =
    tier !== null ? tierBound(tier, permissionAvailable, extraWriteDirs) : null;
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
      // 344 A2-F1: the verdict channel adds stdin (out-of-band nonce) and fd 3
      // (the harness's authenticated marker stream). Without it the stdio is
      // byte-identical to the legacy `["ignore","pipe","pipe"]`.
      stdio: verdictChannel
        ? ["pipe", "pipe", "pipe", "pipe"]
        : ["ignore", "pipe", "pipe"],
    } as import("node:child_process").SpawnOptions & { maxBuffer: number };
    // fixes/346 P1-4 + lane-1: a strict/confined run prepends the Permission-
    // Model flags + heap cap BEFORE `-e`; everything else is identical to the
    // legacy invocation. When the runtime lacks the flag the tier degrades to
    // the heap-cap-only invocation (never a pretend boundary).
    const childArgs =
      tier !== null
        ? [...tierRunnerArgs(tier, dir, permissionAvailable, extraWriteDirs), "-e", code]
        : ["-e", code];
    child = spawn(process.execPath, childArgs, spawnOpts);
  } catch (err) {
    removeScratchDir(dir, ownsScratchDir);
    return withSandbox(
      {
        ok: false,
        reason: "error",
        code: "RT_E_RUNNER_FAILED",
        error: `spawn failed: ${(err as Error).message}`,
      },
      bound,
    );
  }

  // 344 A2-F1: a fresh per-run nonce, delivered to the child ONLY on stdin. It
  // is never embedded in the `-e` source (which leaks via process.execArgv) and
  // never placed in the child env, so the module under test cannot learn it.
  const verdictNonce = verdictChannel ? randomBytes(16).toString("hex") : "";
  if (verdictChannel && child.stdin) {
    try {
      child.stdin.write(`${verdictNonce}\n`);
      child.stdin.end();
    } catch {
      // stdin closed early: the harness reads no nonce and emits nothing
      // authenticated, so the run fails closed (empty verdict) — never open.
    }
  }

  let stdout = "";
  let stderr = "";
  let verdictRaw = "";
  // A pipe read can split a multibyte UTF-8 sequence across two chunks; decoding
  // each Buffer with `d.toString()` would emit U+FFFD for the straddled bytes and
  // silently mangle the child's output. One StringDecoder per stream carries the
  // partial sequence to the next chunk (flushed at settle), so the captured text
  // is byte-faithful.
  const stdoutDecoder = new StringDecoder("utf8");
  const stderrDecoder = new StringDecoder("utf8");
  const verdictDecoder = verdictChannel ? new StringDecoder("utf8") : null;
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
    stdout = (stdout + stdoutDecoder.write(d)).slice(-MAX_OUTPUT);
  });
  child.stderr?.on("data", (d: Buffer) => {
    bombCheck(d);
    stderr = (stderr + stderrDecoder.write(d)).slice(-MAX_OUTPUT);
  });
  if (verdictChannel) {
    const verdictStream = child.stdio[3];
    verdictStream?.on("data", (d: Buffer) => {
      bombCheck(d);
      verdictRaw = (verdictRaw + verdictDecoder!.write(d)).slice(-MAX_OUTPUT);
    });
  }

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
      const advertised = withSandbox(r, bound);
      // Sync-first, best-effort cleanup: removeScratchDir is TOTAL (it swallows
      // every error — see its own docblock), so an in-use/locked scratch dir is
      // simply left for the OS temp cleaner and the caller is never blocked on a
      // lingering grandchild. The old try/catch deferral that stood here was
      // unreachable by construction (337-3 probe: removeScratchDir never throws)
      // and its comment claimed a deferral the bytes never performed.
      removeScratchDir(dir, ownsScratchDir);
      resolve(advertised);
    };

    // Flush any decoded-but-incomplete UTF-8 sequence before a terminal settle
    // reads stdout/stderr — the pipe 'end' may not have run yet on the
    // exit/kill grace paths (or a grandchild still holds the pipes open).
    let decodersFlushed = false;
    const flushDecoders = (): void => {
      if (decodersFlushed) return;
      decodersFlushed = true;
      stdout = (stdout + stdoutDecoder.end()).slice(-MAX_OUTPUT);
      stderr = (stderr + stderrDecoder.end()).slice(-MAX_OUTPUT);
      if (verdictDecoder) verdictRaw = (verdictRaw + verdictDecoder.end()).slice(-MAX_OUTPUT);
    };

    // Shared settle decision — 'close', the post-'exit' drain grace, and the
    // post-kill grace all land here, so every path reports the SAME honest
    // classification (timeout vs signal-kill vs exited) instead of whichever
    // event happened to arrive last.
    const settle = (code: number | null, signal: NodeJS.Signals | null): void => {
      flushDecoders();
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
        // 344 A2-F1: only the nonce-authenticated fd-3 lines survive; anything
        // the module wrote there itself is dropped. Omitted entirely on the
        // legacy (non-channel) path so that envelope stays byte-identical.
        ...(verdictChannel ? { verdict: authenticatedVerdict(verdictRaw, verdictNonce) } : {}),
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
