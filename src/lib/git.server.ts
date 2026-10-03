// ---------------------------------------------------------------------------
// git.server.ts — T4.2 · the git landing tail (W18 lane 3, fixes/249).
//
// What this is: the last row of the landing spine (playbook 230 T4.2 / 104
// :606) — it lets an emitted tree land as a REVIEWABLE git unit: `git init` +
// one commit per cycle, on demand, behind an explicit human seat. The
// `.gitignore` half already ships inside every emitted tree (scaffold.ts
// `gitignoreFile()`, pushed at the emitted-files table), so a landed diff
// stays clean; this module is the init/commit surface itself.
//
// Doctrine (load-bearing):
//   · HUMAN SEAT ONLY — every mutating call requires the recognized human seat
//     (`decidedBy:"human"` / `human-cli-i-am-human`) presenting the out-of-band
//     token (`RT_HUMAN_SEAT_TOKEN` exported in the operator's own shell). The
//     claim is routed through the ONE policy seam (`evaluatePolicy("repair.apply",
//     "tree:<dir>", …)`, the same action the CLI `edit` arm uses) and then
//     tightened: machine (autopilot) seats are refused — a machine must never
//     mint git history on its own.
//   · NEVER THE HOST REPO — an explicit `dir` is required (no default, ever);
//     init refuses any target inside an existing work tree or carrying a
//     `.git`; and commit lands only repositories THIS TAIL initialized (the
//     `.rapidtool/landing.json` marker written by `gitLandInit`). A foreign
//     repository root — the host repo included — cannot be committed even by
//     mistake, seat or not: that is structural, not policy.
//   · NO NETWORK, NO SECRETS — the runnable surface is a fixed allowlist
//     (see GIT_LANDING_SUBCOMMANDS); no network family verb exists in it, no
//     URL argument is accepted anywhere, and the child env is scrubbed of every
//     secret-bearing key with interactive prompts disabled. Nothing in this
//     file reads a token other than the seat token it was handed.
//   · ARGV ARRAYS ONLY — `spawn(bin, argv)` with a verifier (verifyGitPlan)
//     over every plan this module builds; no shell string is ever assembled or
//     run — the spawn options carry no shell flag, ever.
//   · BOUNDED — wall-clock timeout with a tree-kill (mirrors the proven
//     node-runner.server.ts discipline), capped stdout/stderr, and a coded
//     failure on every branch — including "git is absent" (RT_E_GIT_UNAVAILABLE).
//
// Server-only: never import this module into a client bundle.
// ---------------------------------------------------------------------------
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { classifyError, type ErrorCode } from "./errors.ts";
import { scrubbedEnv } from "./node-runner.server.ts";
import {
  evaluatePolicy,
  isVerifiedHumanSeatToken,
  seatLabel,
  type PolicyFallback,
} from "./policy.ts";

// ---------------------------------------------------------------------------
// §1 · constants
// ---------------------------------------------------------------------------

/**
 * The ONLY subcommands this module may ever run. Mutators: `init`, `add`,
 * `commit`. Readers/probes: `--version`, `rev-parse`, `status`, `log`.
 * Deliberately absent: every network family verb, every history-rewriting verb,
 * and the `config` subcommand (identity rides `-c` flags, so no config file is
 * ever written). A plan outside this list is refused by verifyGitPlan.
 */
export const GIT_LANDING_SUBCOMMANDS = [
  "--version",
  "rev-parse",
  "init",
  "add",
  "commit",
  "status",
  "log",
] as const;
export type GitLandingSubcommand = (typeof GIT_LANDING_SUBCOMMANDS)[number];

/** Wall-clock cap per git invocation (mirrors the runner's 30 s default). */
export const GIT_LANDING_TIMEOUT_MS = 30_000;
/** Kept-chars cap per stream — output beyond it is elided with a marker. */
export const GIT_LANDING_OUTPUT_CAP = 1_000_000;
/** Settle-grace windows (H4 pattern, node-runner.server.ts). */
const CLOSE_GRACE_MS = 1_000;
const KILL_GRACE_MS = 1_000;
/** Commit-message / identity bounds (validation refusals, not truncation). */
const MAX_MESSAGE_CHARS = 10_000;
const MAX_IDENTITY_NAME_CHARS = 200;
const MAX_IDENTITY_EMAIL_CHARS = 254;

/** The landing marker written by gitLandInit; commit requires it. */
export const GIT_LANDING_MARKER_REL = ".rapidtool/landing.json";
export const GIT_LANDING_MARKER_KIND = "rapidtool-git-landing";
export const GIT_LANDING_MARKER_VERSION = 1;

/**
 * The default commit identity — an explicitly MACHINE identity (declared as
 * such, `.invalid` reserved TLD). The commit always carries an explicit
 * identity so ambient global config can never leak in (playbook trap:
 * machine-different git identities seed flakiness). Callers may override it.
 */
export const DEFAULT_GIT_LAND_IDENTITY = {
  name: "RapidTool Landing (machine)",
  email: "landing@rapidtool.invalid",
} as const;

// ---------------------------------------------------------------------------
// §2 · seat gate — pure, total, human-only
// ---------------------------------------------------------------------------

export type GitLandSeatAllow = { allowed: true; label: string; reason: string };
export type GitLandSeatDeny = {
  allowed: false;
  label: string;
  reason: string;
  code: "RT_E_VALIDATION";
  fallback: PolicyFallback;
};
export type GitLandSeatVerdict = GitLandSeatAllow | GitLandSeatDeny;

/** Duck-type the seat ctx fields without trusting any of them (total). */
function seatCtxOf(seat: unknown): {
  actor?: unknown;
  humanSeatToken?: string;
  expectedHumanSeatToken?: string;
} {
  if (seat === null || typeof seat !== "object") return {};
  const s = seat as { actor?: unknown; humanSeatToken?: unknown; expectedHumanSeatToken?: unknown };
  return {
    actor: s.actor,
    humanSeatToken: typeof s.humanSeatToken === "string" ? s.humanSeatToken : undefined,
    expectedHumanSeatToken:
      typeof s.expectedHumanSeatToken === "string" ? s.expectedHumanSeatToken : undefined,
  };
}

/**
 * The git landing seat gate. Pure and total (malformed input is a refusal,
 * never a throw): the claim is FIRST routed through the ONE policy seam
 * (`repair.apply` on `tree:<dir>` — the arm the CLI edit uses), then tightened
 * to the human seat only — autopilot may repair a tree, but only a verified
 * human may mint git history.
 */
export function checkGitLandSeat(seat: unknown, resource: string): GitLandSeatVerdict {
  const ctx = seatCtxOf(seat);
  const verdict = evaluatePolicy("repair.apply", resource, ctx);
  const label = seatLabel(ctx.actor);
  const isHumanSeat = label === "human/human-cli-i-am-human";

  if (verdict.decision !== "allow") {
    // A human seat missing/inventing the token gets the seam's own message —
    // it is exact for that case. Every other refused claim gets THIS module's
    // rule, because the seam's autopilot fallback would misdirect a caller
    // who needs the human token here (seam reason kept for the ledger).
    if (isHumanSeat) {
      return {
        allowed: false,
        label,
        reason: verdict.reason,
        code: "RT_E_VALIDATION",
        fallback: "human-seat-token",
      };
    }
    return {
      allowed: false,
      label,
      reason:
        `git-landing-requires-human-seat — the git landing tail refuses the ${label} seat; ` +
        `it runs only under the verified human seat presenting the out-of-band token ` +
        `(RT_HUMAN_SEAT_TOKEN in the operator's own shell). Seam verdict: ${verdict.reason}`,
      code: "RT_E_VALIDATION",
      fallback: "human-seat-token",
    };
  }

  if (!isHumanSeat) {
    // The seam allows autopilot for repair.apply — this module must not:
    // a machine may never mint git history on its own.
    return {
      allowed: false,
      label,
      reason:
        `git-landing-requires-human-seat — the ${label} seat is a machine seat; the git landing ` +
        `tail runs only under the verified human seat presenting the out-of-band token.`,
      code: "RT_E_VALIDATION",
      fallback: "human-seat-token",
    };
  }

  if (!isVerifiedHumanSeatToken(ctx)) {
    // Belt: policy's human branch already requires the token, but this module's
    // rule must not depend on the seam's current shape alone.
    return {
      allowed: false,
      label,
      reason:
        "human-seat-unverified — the human seat needs the out-of-band token: export " +
        "RT_HUMAN_SEAT_TOKEN in your own shell and present it as humanSeatToken.",
      code: "RT_E_VALIDATION",
      fallback: "human-seat-token",
    };
  }

  return {
    allowed: true,
    label,
    reason: "human-seat-token-verified — git landing under the verified human seat.",
  };
}

// ---------------------------------------------------------------------------
// §3 · result envelopes
// ---------------------------------------------------------------------------

export type GitLandFailure =
  | { ok: false; reason: "bad-input"; code: "RT_E_VALIDATION"; error: string; dir?: string }
  | {
      ok: false;
      reason: "seat-refused";
      code: "RT_E_VALIDATION";
      error: string;
      dir?: string;
      seat: { label: string; fallback: PolicyFallback };
    }
  | {
      ok: false;
      reason:
        | "target-missing"
        | "target-not-a-directory"
        | "target-in-work-tree"
        | "already-a-repo"
        | "not-a-repo"
        | "not-a-landing-repo"
        | "nothing-to-commit";
      code: "RT_E_VALIDATION";
      error: string;
      dir: string;
      exitCode?: number | null;
      stdout?: string;
      stderr?: string;
    }
  | {
      ok: false;
      reason: "git-absent";
      code: "RT_E_GIT_UNAVAILABLE";
      error: string;
      dir: string;
      gitBin: string;
    }
  | {
      ok: false;
      reason: "spawn-failed" | "timeout" | "killed" | "git-failed";
      code: "RT_E_RUNNER_FAILED";
      error: string;
      dir: string;
      gitBin: string;
      exitCode?: number | null;
      stdout?: string;
      stderr?: string;
      durationMs?: number;
    }
  | { ok: false; reason: "marker-failed"; code: ErrorCode; error: string; dir: string }
  | { ok: false; reason: "internal"; code: "RT_E_INTERNAL"; error: string; dir?: string };

export type GitLandInitOk = {
  ok: true;
  dir: string;
  repoRoot: string;
  /** The unborn branch git landed on (from .git/HEAD); null when unreadable. */
  branch: string | null;
  marker: string;
  stdout: string;
  durationMs: number;
};

export type GitLandCommitOk = {
  ok: true;
  dir: string;
  repoRoot: string;
  commit: { hash: string; subject: string };
  author: string;
  /** True while an empty (marker) commit was allowed to land. */
  empty: boolean;
  stdout: string;
  durationMs: number;
};

export type GitLandReadBackOk = {
  ok: true;
  dir: string;
  branch: string | null;
  /** HEAD hash, or null on an unborn repository (init landed, no commit yet). */
  head: string | null;
  commits: Array<{ hash: string; subject: string }>;
  stdout: string;
  durationMs: number;
};

export type GitLandResult<T> = T | GitLandFailure;

export type GitLandingAvailability =
  | { available: true; binary: string; version: string }
  | {
      available: false;
      reason: "git-absent" | "not-git";
      code: "RT_E_GIT_UNAVAILABLE";
      binary: string;
      error: string;
      stdout?: string;
      stderr?: string;
    };

// ---------------------------------------------------------------------------
// §4 · the bounded child primitive + git plan verifier
// ---------------------------------------------------------------------------

type BoundedChildRan = {
  ran: true;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  outputClamped: boolean;
};
type BoundedChildFail = {
  ran: false;
  reason: "spawn-failed" | "timeout" | "killed";
  error: string;
  errno?: string;
  stdout: string;
  stderr: string;
  durationMs: number;
  outputClamped: boolean;
};
export type BoundedChildResult = BoundedChildRan | BoundedChildFail;

/** Keep head+tail of an over-cap stream with an explicit elision marker. */
function clampStream(text: string): { text: string; clamped: boolean } {
  if (text.length <= GIT_LANDING_OUTPUT_CAP) return { text, clamped: false };
  const head = Math.floor(GIT_LANDING_OUTPUT_CAP * 0.6);
  const tail = GIT_LANDING_OUTPUT_CAP - head;
  const elided = text.length - head - tail;
  const marker = `\n… [${elided} chars elided by git landing output cap] …\n`;
  const out = `${text.slice(0, head)}${marker}${text.slice(text.length - tail)}`;
  return {
    text: out.length <= GIT_LANDING_OUTPUT_CAP + marker.length ? out : out.slice(-(GIT_LANDING_OUTPUT_CAP + marker.length)),
    clamped: true,
  };
}

/** Windows: killing the direct child does not reap grandchildren — taskkill
 *  /T /F takes the whole tree. Best-effort, never throws (node-runner pattern). */
function treeKill(pid: number): void {
  if (process.platform !== "win32" || pid <= 0) return;
  try {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  } catch {
    // already gone / never started — nothing to kill.
  }
}

/**
 * The git child environment: the runner's scrubbed allowlist (no secret-bearing
 * keys are copied) plus a NEUTRAL config surface — system config disabled, the
 * home pointed at a bare temp dir (no ~/.gitconfig), deterministic locale, no
 * interactive prompts. Identity therefore comes ONLY from the `-c` flags this
 * module passes, never from ambient config (the flakiness trap in the row).
 * (GIT_CONFIG_GLOBAL=os.devNull was tried and REJECTED: git-for-windows fatals
 * on the device path — "unable to access: Invalid argument" — so the neutral
 * HOME is the mechanism that suppresses user config.)
 */
function gitChildEnv(): NodeJS.ProcessEnv {
  const env = scrubbedEnv();
  const neutralHome = tmpdir();
  env.HOME = neutralHome;
  env.USERPROFILE = neutralHome;
  delete env.HOMEDRIVE;
  delete env.HOMEPATH;
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_TERMINAL_PROMPT = "0";
  env.LC_ALL = "C";
  env.LANG = "C";
  return env;
}

/**
 * The module's ONE spawn point, bounded exactly like node-runner.server.ts:
 * argv array (never a shell string), no stdin, continuously drained pipes with
 * a kept-chars cap, wall-clock timeout with a tree-kill, and unconditional
 * settlement (close-grace + kill-grace) so no caller can hang.
 *
 * Exported for the bound's own tests (timeout / output cap are exercised with
 * real hanging/huge children); production callers use the gitLand* API, which
 * builds fixed, verifier-checked argv arrays.
 */
export async function runBoundedChild(
  bin: string,
  argv: readonly string[],
  opts: { cwd: string; timeoutMs?: number; env?: NodeJS.ProcessEnv },
): Promise<BoundedChildResult> {
  const timeoutMs =
    typeof opts.timeoutMs === "number" && Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0
      ? opts.timeoutMs
      : GIT_LANDING_TIMEOUT_MS;
  const started = Date.now();
  let child: ChildProcess;
  try {
    child = spawn(bin, [...argv], {
      cwd: opts.cwd,
      env: opts.env ?? gitChildEnv(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    return {
      ran: false,
      reason: "spawn-failed",
      error: `spawn failed: ${err instanceof Error ? err.message : String(err)}`,
      errno: (err as NodeJS.ErrnoException)?.code,
      stdout: "",
      stderr: "",
      durationMs: Date.now() - started,
      outputClamped: false,
    };
  }

  let stdout = "";
  let stderr = "";
  let clamped = false;
  child.stdout?.on("data", (d: Buffer) => {
    const c = clampStream(stdout + d.toString());
    stdout = c.text;
    clamped = clamped || c.clamped;
  });
  child.stderr?.on("data", (d: Buffer) => {
    const c = clampStream(stderr + d.toString());
    stderr = c.text;
    clamped = clamped || c.clamped;
  });

  return new Promise<BoundedChildResult>((resolveOnce) => {
    let settled = false;
    let timedOut = false;
    let killTimer: NodeJS.Timeout | null = null;
    const graceTimers = new Set<NodeJS.Timeout>();
    const armGrace = (fn: () => void, ms: number): void => {
      const t = setTimeout(fn, ms);
      graceTimers.add(t);
    };
    let exitCodeAtExit: number | null = null;
    let signalAtExit: NodeJS.Signals | null = null;

    const finish = (r: BoundedChildResult): void => {
      if (settled) return;
      settled = true;
      if (killTimer) clearTimeout(killTimer);
      for (const t of graceTimers) clearTimeout(t);
      graceTimers.clear();
      resolveOnce(r);
    };

    const settle = (code: number | null, signal: NodeJS.Signals | null): void => {
      const base = { stdout, stderr, durationMs: Date.now() - started, outputClamped: clamped };
      if (timedOut) {
        finish({ ran: false, reason: "timeout", error: `killed after ${timeoutMs / 1000}s`, ...base });
        return;
      }
      if (signal !== null) {
        // External kill / OS teardown — never mislabelled as our timeout.
        finish({ ran: false, reason: "killed", error: `killed by signal ${signal}`, ...base });
        return;
      }
      finish({ ran: true, exitCode: code ?? -1, ...base });
    };

    child.on("error", (err: Error) => {
      finish({
        ran: false,
        reason: "spawn-failed",
        error: `spawn failed: ${err.message}`,
        errno: (err as NodeJS.ErrnoException).code,
        stdout,
        stderr,
        durationMs: Date.now() - started,
        outputClamped: clamped,
      });
    });
    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      // 'close' can lag forever when a grandchild inherits the pipes — bound it.
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
      armGrace(() => settle(null, null), KILL_GRACE_MS);
    }, timeoutMs);
  });
}

/** A git invocation plan: the declared subcommand + its full argv array. */
export type GitPlan = { subcommand: string; argv: readonly string[] };

export function isGitLandingSubcommandAllowed(cmd: unknown): cmd is GitLandingSubcommand {
  return typeof cmd === "string" && (GIT_LANDING_SUBCOMMANDS as readonly string[]).includes(cmd);
}

/** Index of the subcommand token, skipping `-c <key=value>` pairs. */
function findSubcommandIndex(argv: readonly string[]): number {
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === "-c") {
      i++; // skip the key=value that follows
      continue;
    }
    if (tok === "--version") return i;
    if (tok.startsWith("-")) continue;
    return i;
  }
  return -1;
}

/**
 * Verify an argv plan against the fixed shape this module may run: allowlisted
 * subcommand, the declared subcommand is the argv's own subcommand token, no
 * NUL anywhere, and every `-c` carries a `key=value`. Returns an error string
 * (programmer error, surfaced coded) or null when well-formed.
 */
export function verifyGitPlan(plan: GitPlan): string | null {
  if (!isGitLandingSubcommandAllowed(plan.subcommand)) {
    return `subcommand ${JSON.stringify(plan.subcommand)} is not in GIT_LANDING_SUBCOMMANDS`;
  }
  for (const tok of plan.argv) {
    if (typeof tok !== "string") return "argv tokens must be strings";
    if (tok.includes("\0")) return "argv must not contain NUL";
  }
  const idx = findSubcommandIndex(plan.argv);
  if (idx < 0) return "argv carries no subcommand token";
  if (plan.argv[idx] !== plan.subcommand) {
    return `declared subcommand ${JSON.stringify(plan.subcommand)} but argv carries ${JSON.stringify(plan.argv[idx])}`;
  }
  for (let i = 0; i < plan.argv.length; i++) {
    if (plan.argv[i] === "-c") {
      const v = plan.argv[i + 1];
      if (typeof v !== "string" || !/^[A-Za-z][A-Za-z0-9.-]*=/.test(v)) {
        return "-c must be followed by a key=value token";
      }
      i++;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// §5 · internal helpers — validation, paths, guards, runGit
// ---------------------------------------------------------------------------

const IS_WIN = process.platform === "win32";
/** MSYS drive form (`/c/Users/...`): never a Node path on Windows (row trap). */
const MSYS_PATH_RE = /^\/[A-Za-z]\//;

/**
 * C0 control-char detector (0x00–0x1F). A plain scan — deliberately NOT a
 * character-class regex: the repo's lint bars control chars in regex patterns
 * (no-control-regex; see node-runner.server.test.ts's String.fromCharCode note).
 */
function hasControlChar(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) <= 0x1f) return true;
  }
  return false;
}

function validateDir(dir: unknown): { ok: true; dir: string } | { ok: false; error: string } {
  if (typeof dir !== "string" || dir.trim().length === 0) {
    return { ok: false, error: "dir must be a non-empty string" };
  }
  const raw = dir.trim();
  if (raw.includes("\0")) return { ok: false, error: "dir must not contain NUL" };
  if (IS_WIN && MSYS_PATH_RE.test(raw)) {
    return {
      ok: false,
      error: `dir ${JSON.stringify(raw)} is an MSYS-style path — pass a Windows path (e.g. C:\\...)`,
    };
  }
  if (!isAbsolute(raw)) {
    return {
      ok: false,
      error: `dir ${JSON.stringify(raw)} must be absolute — the landing tail has no default target (never the cwd)`,
    };
  }
  return { ok: true, dir: resolve(raw) };
}

function resolveTimeoutMs(timeoutMs: unknown): number | { error: string } {
  if (timeoutMs === undefined) return GIT_LANDING_TIMEOUT_MS;
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { error: "timeoutMs must be a positive finite number" };
  }
  return timeoutMs;
}

/** Case- and separator-insensitive path equality (git prints `/`, we resolve `\`). */
function samePath(a: string, b: string): boolean {
  const norm = (p: string): string => resolve(p).replace(/[\\/]+$/, "").replace(/\\/g, "/");
  const na = norm(a);
  const nb = norm(b);
  return IS_WIN ? na.toLowerCase() === nb.toLowerCase() : na === nb;
}

function markerPath(dir: string): string {
  return join(dir, GIT_LANDING_MARKER_REL);
}

function hasLandingMarker(dir: string): boolean {
  const p = markerPath(dir);
  if (!existsSync(p)) return false;
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as {
      landing?: unknown;
      version?: unknown;
    };
    return parsed.landing === GIT_LANDING_MARKER_KIND && parsed.version === GIT_LANDING_MARKER_VERSION;
  } catch {
    return false;
  }
}

function writeLandingMarker(dir: string): void {
  const p = markerPath(dir);
  mkdirSync(join(dir, ".rapidtool"), { recursive: true });
  const text = `${JSON.stringify(
    {
      landing: GIT_LANDING_MARKER_KIND,
      version: GIT_LANDING_MARKER_VERSION,
      initializedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`;
  // K2 (W39): atomic hand-over — the marker is read back as the "already
  // initialized here" proof (hasLandingMarker). An in-place write interrupted
  // mid-bytes leaves invalid JSON, which reads as "no marker" (fail-safe) but
  // sends the next run down the re-init path, and a half-written proof file is
  // exactly the kind of lie the landing contract exists to prevent.
  const staging = `${p}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(staging, text, "utf8");
    renameSync(staging, p);
  } catch (err) {
    try {
      if (existsSync(staging)) unlinkSync(staging);
    } catch {
      /* best-effort staging sweep */
    }
    throw err;
  }
}

function isDirectoryOf(dir: string): "ok" | "missing" | "not-a-directory" {
  try {
    return statSync(dir).isDirectory() ? "ok" : "not-a-directory";
  } catch {
    return "missing";
  }
}

type GitRunOk = {
  ok: true;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  outputClamped: boolean;
};
type GitRunFail = {
  ok: false;
  reason: "git-absent" | "spawn-failed" | "timeout" | "killed" | "git-failed" | "internal";
  code: ErrorCode;
  error: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  errno?: string;
};

/** Run ONE verified git plan through the bounded primitive; map every branch. */
async function runGit(
  plan: GitPlan,
  opts: { gitBin: string; cwd: string; timeoutMs: number },
): Promise<GitRunOk | GitRunFail> {
  const planError = verifyGitPlan(plan);
  if (planError !== null) {
    return {
      ok: false,
      reason: "internal",
      code: "RT_E_INTERNAL",
      error: `internal git plan invariant broken: ${planError}`,
      exitCode: null,
      stdout: "",
      stderr: "",
      durationMs: 0,
    };
  }
  const run = await runBoundedChild(opts.gitBin, plan.argv, {
    cwd: opts.cwd,
    timeoutMs: opts.timeoutMs,
    env: gitChildEnv(),
  });
  if (!run.ran) {
    if (run.reason === "spawn-failed" && run.errno === "ENOENT") {
      return {
        ok: false,
        reason: "git-absent",
        code: "RT_E_GIT_UNAVAILABLE",
        error: `git binary not found (${JSON.stringify(opts.gitBin)}): ${run.error}`,
        exitCode: null,
        stdout: run.stdout,
        stderr: run.stderr,
        durationMs: run.durationMs,
        errno: run.errno,
      };
    }
    return {
      ok: false,
      reason: run.reason,
      code: "RT_E_RUNNER_FAILED",
      error: run.error,
      exitCode: null,
      stdout: run.stdout,
      stderr: run.stderr,
      durationMs: run.durationMs,
      errno: run.errno,
    };
  }
  if (run.exitCode !== 0) {
    return {
      ok: false,
      reason: "git-failed",
      code: "RT_E_RUNNER_FAILED",
      error: `git ${plan.subcommand} exited ${run.exitCode}`,
      exitCode: run.exitCode,
      stdout: run.stdout,
      stderr: run.stderr,
      durationMs: run.durationMs,
    };
  }
  return {
    ok: true,
    stdout: run.stdout,
    stderr: run.stderr,
    exitCode: run.exitCode,
    durationMs: run.durationMs,
    outputClamped: run.outputClamped,
  };
}

/** Map a runGit failure onto the public failure envelope. */
function failureFromRun(
  run: GitRunFail,
  dir: string,
  gitBin: string,
): GitLandFailure {
  if (run.reason === "git-absent") {
    return {
      ok: false,
      reason: "git-absent",
      code: "RT_E_GIT_UNAVAILABLE",
      error: run.error,
      dir,
      gitBin,
    };
  }
  if (run.reason === "internal") {
    return { ok: false, reason: "internal", code: "RT_E_INTERNAL", error: run.error, dir };
  }
  return {
    ok: false,
    reason: run.reason,
    code: "RT_E_RUNNER_FAILED",
    error: run.error,
    dir,
    gitBin,
    exitCode: run.exitCode,
    stdout: run.stdout,
    stderr: run.stderr,
    durationMs: run.durationMs,
  };
}

/** `git rev-parse --show-toplevel` → the work-tree root, or null when the dir
 *  is not inside a repository. A run failure (git absent, spawn, timeout) is
 *  returned so the guard can refuse without guessing. */
async function workTreeRoot(
  dir: string,
  gitBin: string,
  timeoutMs: number,
): Promise<{ root: string | null; failure?: GitRunFail }> {
  const r = await runGit({ subcommand: "rev-parse", argv: ["rev-parse", "--show-toplevel"] }, {
    gitBin,
    cwd: dir,
    timeoutMs,
  });
  if (!r.ok) {
    // "not a git repository" is an expected exit — anything else is surfaced.
    if (r.reason === "git-failed") return { root: null };
    return { root: null, failure: r };
  }
  const root = r.stdout.trim();
  return { root: root.length > 0 ? root : null };
}

/** Read the unborn branch name from <dir>/.git/HEAD (a direct, honest read). */
function branchFromHeadFile(dir: string): string | null {
  try {
    const head = readFileSync(join(dir, ".git", "HEAD"), "utf8").trim();
    const m = /^ref: refs\/heads\/(.+)$/.exec(head);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Shared step: validate dir + existence + seat. Returns the resolved dir. */
function gateSeatAndTarget(
  dir: unknown,
  seat: unknown,
): { ok: true; dir: string } | { ok: false; failure: GitLandFailure } {
  const v = validateDir(dir);
  if (!v.ok) {
    return { ok: false, failure: { ok: false, reason: "bad-input", code: "RT_E_VALIDATION", error: v.error } };
  }
  const shape = isDirectoryOf(v.dir);
  if (shape === "missing") {
    return {
      ok: false,
      failure: {
        ok: false,
        reason: "target-missing",
        code: "RT_E_VALIDATION",
        error: `dir ${JSON.stringify(v.dir)} does not exist`,
        dir: v.dir,
      },
    };
  }
  if (shape === "not-a-directory") {
    return {
      ok: false,
      failure: {
        ok: false,
        reason: "target-not-a-directory",
        code: "RT_E_VALIDATION",
        error: `dir ${JSON.stringify(v.dir)} is not a directory`,
        dir: v.dir,
      },
    };
  }
  const verdict = checkGitLandSeat(seat, `tree:${v.dir}`);
  if (!verdict.allowed) {
    return {
      ok: false,
      failure: {
        ok: false,
        reason: "seat-refused",
        code: "RT_E_VALIDATION",
        error: verdict.reason,
        dir: v.dir,
        seat: { label: verdict.label, fallback: verdict.fallback },
      },
    };
  }
  return { ok: true, dir: v.dir };
}

// ---------------------------------------------------------------------------
// §6 · public API — availability, init, commit, read-back
// ---------------------------------------------------------------------------

/**
 * Probe whether a usable git binary is available (plan `--version`), and that
 * it answers like git. `gitBin` defaults to `git` on PATH; tests inject paths.
 */
export async function gitLandingAvailable(opts?: {
  gitBin?: string;
  timeoutMs?: number;
}): Promise<GitLandingAvailability> {
  const bin =
    typeof opts?.gitBin === "string" && opts.gitBin.trim().length > 0 ? opts.gitBin.trim() : "git";
  const timeout = resolveTimeoutMs(opts?.timeoutMs);
  if (typeof timeout === "object") {
    return { available: false, reason: "git-absent", code: "RT_E_GIT_UNAVAILABLE", binary: bin, error: timeout.error };
  }
  if (/[\\/]/.test(bin) && !existsSync(bin)) {
    return {
      available: false,
      reason: "git-absent",
      code: "RT_E_GIT_UNAVAILABLE",
      binary: bin,
      error: `no file at ${JSON.stringify(bin)}`,
    };
  }
  const r = await runGit({ subcommand: "--version", argv: ["--version"] }, {
    gitBin: bin,
    cwd: tmpdir(),
    timeoutMs: timeout,
  });
  if (!r.ok) {
    return {
      available: false,
      reason: r.reason === "git-absent" ? "git-absent" : "not-git",
      code: "RT_E_GIT_UNAVAILABLE",
      binary: bin,
      error: r.error,
      stdout: r.stdout,
      stderr: r.stderr,
    };
  }
  const m = /^git version (\S+)/m.exec(r.stdout);
  if (!m) {
    return {
      available: false,
      reason: "not-git",
      code: "RT_E_GIT_UNAVAILABLE",
      binary: bin,
      error: `${JSON.stringify(bin)} answered --version but not like git`,
      stdout: r.stdout,
      stderr: r.stderr,
    };
  }
  return { available: true, binary: bin, version: m[1] };
}

/**
 * `git init` an emitted/scratch tree — human seat required. Refuses any target
 * that is inside an existing work tree or already carries a `.git` (the host
 * repo can never be initialized), then writes the landing marker that
 * `gitLandCommit` requires.
 */
export async function gitLandInit(
  dir: unknown,
  seat: unknown,
  opts?: { gitBin?: string; timeoutMs?: number },
): Promise<GitLandResult<GitLandInitOk>> {
  const gitBin = typeof opts?.gitBin === "string" && opts.gitBin.trim().length > 0 ? opts.gitBin.trim() : "git";
  const timeout = resolveTimeoutMs(opts?.timeoutMs);
  if (typeof timeout === "object") {
    return { ok: false, reason: "bad-input", code: "RT_E_VALIDATION", error: timeout.error };
  }
  const gated = gateSeatAndTarget(dir, seat);
  if (!gated.ok) return gated.failure;
  const target = gated.dir;

  if (existsSync(join(target, ".git"))) {
    return {
      ok: false,
      reason: "already-a-repo",
      code: "RT_E_VALIDATION",
      error: `dir ${JSON.stringify(target)} already carries a .git — the landing tail never re-initializes an existing repository`,
      dir: target,
    };
  }
  const probe = await workTreeRoot(target, gitBin, timeout);
  if (probe.failure) return failureFromRun(probe.failure, target, gitBin);
  if (probe.root !== null) {
    return {
      ok: false,
      reason: "target-in-work-tree",
      code: "RT_E_VALIDATION",
      error: `dir ${JSON.stringify(target)} is inside the work tree rooted at ${JSON.stringify(probe.root)} — refusing to create a nested repository (the host repo is never a landing target)`,
      dir: target,
    };
  }

  const markerExisted = existsSync(markerPath(target));
  try {
    writeLandingMarker(target);
  } catch (err) {
    return {
      ok: false,
      reason: "marker-failed",
      code: classifyError(err, "RT_E_INTERNAL"),
      error: `could not write the landing marker (${GIT_LANDING_MARKER_REL}): ${
        err instanceof Error ? err.message : String(err)
      }`,
      dir: target,
    };
  }

  const r = await runGit({ subcommand: "init", argv: ["-c", "init.defaultBranch=main", "init"] }, {
    gitBin,
    cwd: target,
    timeoutMs: timeout,
  });
  if (!r.ok) {
    if (!markerExisted) {
      try {
        rmSync(markerPath(target), { force: true });
      } catch {
        // best-effort — the honest failure below still names the state.
      }
    }
    return failureFromRun(r, target, gitBin);
  }

  // Read back through git itself: the repo root must be the dir we were handed.
  const check = await workTreeRoot(target, gitBin, timeout);
  if (check.failure) return failureFromRun(check.failure, target, gitBin);
  if (check.root === null || !samePath(check.root, target)) {
    return {
      ok: false,
      reason: "git-failed",
      code: "RT_E_RUNNER_FAILED",
      error: `git init ran but git does not report ${JSON.stringify(target)} as its work-tree root (${JSON.stringify(
        check.root,
      )})`,
      dir: target,
      gitBin,
      stdout: r.stdout,
      stderr: r.stderr,
      durationMs: r.durationMs,
    };
  }

  return {
    ok: true,
    dir: target,
    repoRoot: resolve(check.root),
    branch: branchFromHeadFile(target),
    marker: markerPath(target),
    stdout: r.stdout,
    durationMs: r.durationMs,
  };
}

/**
 * `git add -A` + one commit, human seat required, on a repository THIS TAIL
 * initialized (landing marker present — a foreign repo root is refused even
 * with a valid seat). The identity is always explicit (`-c` flags), so the
 * commit never depends on ambient git config. Clean work tree ⇒ coded
 * `nothing-to-commit` refusal unless `allowEmpty` was passed.
 */
export async function gitLandCommit(
  dir: unknown,
  seat: unknown,
  opts: {
    message: string;
    identity?: { name: string; email: string };
    allowEmpty?: boolean;
    gitBin?: string;
    timeoutMs?: number;
  },
): Promise<GitLandResult<GitLandCommitOk>> {
  const gitBin = typeof opts?.gitBin === "string" && opts.gitBin.trim().length > 0 ? opts.gitBin.trim() : "git";
  const timeout = resolveTimeoutMs(opts?.timeoutMs);
  if (typeof timeout === "object") {
    return { ok: false, reason: "bad-input", code: "RT_E_VALIDATION", error: timeout.error };
  }
  const message = opts?.message;
  if (typeof message !== "string" || message.trim().length === 0) {
    return { ok: false, reason: "bad-input", code: "RT_E_VALIDATION", error: "message must be a non-empty string" };
  }
  if (message.includes("\0") || hasControlChar(message.replace(/\r\n|\r|\n/g, ""))) {
    return {
      ok: false,
      reason: "bad-input",
      code: "RT_E_VALIDATION",
      error: "message must not contain NUL or control characters (newlines are allowed)",
    };
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return {
      ok: false,
      reason: "bad-input",
      code: "RT_E_VALIDATION",
      error: `message exceeds the ${MAX_MESSAGE_CHARS}-char cap`,
    };
  }
  const identity = opts?.identity ?? DEFAULT_GIT_LAND_IDENTITY;
  const name = identity?.name;
  const email = identity?.email;
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.length > MAX_IDENTITY_NAME_CHARS ||
    hasControlChar(name)
  ) {
    return {
      ok: false,
      reason: "bad-input",
      code: "RT_E_VALIDATION",
      error: `identity.name must be a non-empty single-line string (≤ ${MAX_IDENTITY_NAME_CHARS} chars)`,
    };
  }
  if (
    typeof email !== "string" ||
    email.length > MAX_IDENTITY_EMAIL_CHARS ||
    hasControlChar(email) ||
    !/^[^\s@]+@[^\s@]+$/.test(email)
  ) {
    return {
      ok: false,
      reason: "bad-input",
      code: "RT_E_VALIDATION",
      error: `identity.email must look like user@host (≤ ${MAX_IDENTITY_EMAIL_CHARS} chars)`,
    };
  }

  const gated = gateSeatAndTarget(dir, seat);
  if (!gated.ok) return gated.failure;
  const target = gated.dir;

  const probe = await workTreeRoot(target, gitBin, timeout);
  if (probe.failure) return failureFromRun(probe.failure, target, gitBin);
  if (probe.root === null) {
    return {
      ok: false,
      reason: "not-a-repo",
      code: "RT_E_VALIDATION",
      error: `dir ${JSON.stringify(target)} is not a git repository — run gitLandInit first`,
      dir: target,
    };
  }
  if (!samePath(probe.root, target)) {
    return {
      ok: false,
      reason: "target-in-work-tree",
      code: "RT_E_VALIDATION",
      error: `dir ${JSON.stringify(target)} is inside the work tree rooted at ${JSON.stringify(
        probe.root,
      )} — the landing tail commits only a repository root it initialized (never into a parent repository)`,
      dir: target,
    };
  }
  if (!hasLandingMarker(target)) {
    return {
      ok: false,
      reason: "not-a-landing-repo",
      code: "RT_E_VALIDATION",
      error: `dir ${JSON.stringify(target)} carries no landing marker (${GIT_LANDING_MARKER_REL}) — the tail commits only repositories gitLandInit created`,
      dir: target,
    };
  }

  const add = await runGit({ subcommand: "add", argv: ["add", "-A"] }, {
    gitBin,
    cwd: target,
    timeoutMs: timeout,
  });
  if (!add.ok) return failureFromRun(add, target, gitBin);

  const status = await runGit(
    { subcommand: "status", argv: ["status", "--porcelain=v1"] },
    { gitBin, cwd: target, timeoutMs: timeout },
  );
  if (!status.ok) return failureFromRun(status, target, gitBin);
  const clean = status.stdout.trim().length === 0;
  if (clean && opts?.allowEmpty !== true) {
    return {
      ok: false,
      reason: "nothing-to-commit",
      code: "RT_E_VALIDATION",
      error: `the work tree at ${JSON.stringify(target)} is clean — nothing to commit (pass allowEmpty to land an empty marker commit)`,
      dir: target,
      exitCode: 0,
      stdout: status.stdout,
      stderr: status.stderr,
    };
  }

  const argv = [
    "-c",
    `user.name=${name}`,
    "-c",
    `user.email=${email}`,
    "commit",
    "-m",
    message,
    ...(opts?.allowEmpty === true ? ["--allow-empty"] : []),
  ];
  const commit = await runGit({ subcommand: "commit", argv }, { gitBin, cwd: target, timeoutMs: timeout });
  if (!commit.ok) return failureFromRun(commit, target, gitBin);

  const readBack = await runGit(
    { subcommand: "log", argv: ["log", "-n", "1", "--pretty=format:%H%x09%an <%ae>%x09%s"] },
    { gitBin, cwd: target, timeoutMs: timeout },
  );
  if (!readBack.ok) return failureFromRun(readBack, target, gitBin);
  const line = readBack.stdout.split("\n")[0] ?? "";
  const parts = line.split("\t");
  if (parts.length < 3 || !/^[0-9a-f]{40}$/.test(parts[0])) {
    return {
      ok: false,
      reason: "git-failed",
      code: "RT_E_RUNNER_FAILED",
      error: `commit landed but the read-back could not parse the new HEAD line: ${JSON.stringify(line)}`,
      dir: target,
      gitBin,
      stdout: readBack.stdout,
      stderr: readBack.stderr,
      durationMs: readBack.durationMs,
    };
  }
  const subject = parts.slice(2).join("\t");

  return {
    ok: true,
    dir: target,
    repoRoot: resolve(probe.root),
    commit: { hash: parts[0], subject },
    author: parts[1],
    empty: clean,
    stdout: commit.stdout,
    durationMs: commit.durationMs,
  };
}

/**
 * Read back what landed: HEAD, the unborn branch and the newest commits — the
 * pinned probe of this row (`git log --oneline` equivalent). Read-only, so no
 * seat is required; it never writes and never touches another repo (the target
 * must be the repository ROOT itself).
 */
export async function gitLandReadBack(
  dir: unknown,
  opts?: { limit?: number; gitBin?: string; timeoutMs?: number },
): Promise<GitLandResult<GitLandReadBackOk>> {
  const gitBin = typeof opts?.gitBin === "string" && opts.gitBin.trim().length > 0 ? opts.gitBin.trim() : "git";
  const timeout = resolveTimeoutMs(opts?.timeoutMs);
  if (typeof timeout === "object") {
    return { ok: false, reason: "bad-input", code: "RT_E_VALIDATION", error: timeout.error };
  }
  const limit = opts?.limit === undefined ? 20 : opts.limit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 500) {
    return {
      ok: false,
      reason: "bad-input",
      code: "RT_E_VALIDATION",
      error: "limit must be an integer in [1, 500]",
    };
  }
  const v = validateDir(dir);
  if (!v.ok) return { ok: false, reason: "bad-input", code: "RT_E_VALIDATION", error: v.error };

  const probe = await workTreeRoot(v.dir, gitBin, timeout);
  if (probe.failure) return failureFromRun(probe.failure, v.dir, gitBin);
  if (probe.root === null) {
    return {
      ok: false,
      reason: "not-a-repo",
      code: "RT_E_VALIDATION",
      error: `dir ${JSON.stringify(v.dir)} is not a git repository`,
      dir: v.dir,
    };
  }
  if (!samePath(probe.root, v.dir)) {
    return {
      ok: false,
      reason: "target-in-work-tree",
      code: "RT_E_VALIDATION",
      error: `read-back targets the repository ROOT the tail landed; ${JSON.stringify(v.dir)} is inside ${JSON.stringify(
        probe.root,
      )}`,
      dir: v.dir,
    };
  }

  // The current/unborn branch comes from git's own .git/HEAD symref file — the
  // same datum `rev-parse --abbrev-ref HEAD` reports, but as a direct read with
  // no exit-code edge cases on an unborn HEAD (git 2.53 exits 128 there).
  const branch = branchFromHeadFile(v.dir);

  const headRun = await runGit(
    { subcommand: "rev-parse", argv: ["rev-parse", "--verify", "--quiet", "HEAD"] },
    { gitBin, cwd: v.dir, timeoutMs: timeout },
  );
  // `rev-parse --verify --quiet HEAD` exits 1 with no output on an unborn
  // repository (init landed, no commit yet) — that exact shape is the honest
  // null; every other non-ok reason (absent git, spawn, timeout, other exits)
  // is surfaced instead of guessed away.
  const unborn = !headRun.ok && headRun.reason === "git-failed" && headRun.exitCode === 1;
  if (!headRun.ok && !unborn) return failureFromRun(headRun, v.dir, gitBin);
  const head = headRun.ok ? headRun.stdout.trim() : "";
  if (head.length === 0) {
    return {
      ok: true,
      dir: v.dir,
      branch,
      head: null,
      commits: [],
      stdout: headRun.stdout,
      durationMs: headRun.durationMs,
    };
  }
  const logRun = await runGit(
    {
      subcommand: "log",
      argv: ["log", "-n", String(limit), "--pretty=format:%H%x09%s"],
    },
    { gitBin, cwd: v.dir, timeoutMs: timeout },
  );
  if (!logRun.ok) return failureFromRun(logRun, v.dir, gitBin);
  const commits = logRun.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => {
      const tab = l.indexOf("\t");
      return tab < 0
        ? { hash: l, subject: "" }
        : { hash: l.slice(0, tab), subject: l.slice(tab + 1) };
    });
  return {
    ok: true,
    dir: v.dir,
    branch,
    head,
    commits,
    stdout: logRun.stdout,
    durationMs: headRun.durationMs + logRun.durationMs,
  };
}
