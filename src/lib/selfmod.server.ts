/**
 * selfmod.server.ts — F2 · 314 wave · the bounded EXECUTOR for the self-mod
 * guardrails (design: `fixes/311_se2_surfaces.md` §4b ②/③/⑦; decisions live in
 * the pure core, `src/lib/selfmod.ts`).
 *
 * Server-only (`.server.ts`): it spawns real git and the repo's own gate via
 * the repo's ONE bounded child seam — `runBoundedChild` + `gitLandingAvailable`
 * from `git.server.ts` — argv arrays only (never a shell string), bounded wall
 * clock, neutral git env (identity rides `-c` flags). It NEVER throws into its
 * callers: every failure is a coded refusal object.
 *
 * Design ② "landed only via git.server.ts": the literal `gitLandCommit` cannot
 * be used here — its contract binds a repository the landing tail INITIALIZED
 * (marker file) and it refuses any dir inside an existing work tree, which a
 * git worktree always is. The honest reading, implemented here: the LANDING
 * DISCIPLINE (bounded argv, explicit machine identity, read-back) rides the
 * same vetted mechanics, and `main` is never touched — every mutating call
 * re-verifies the branch first.
 *
 * The pipeline stages: validate → collect diff → verify gate → land/discard.
 * A red or absent verify is refused BEFORE any staging (zero git mutation).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { DEFAULT_GIT_LAND_IDENTITY, gitLandingAvailable, runBoundedChild } from "./git.server.ts";
import { scrubbedEnv } from "./node-runner.server.ts";
import {
  SELFMOD_CODES,
  diffWithinCaps,
  evaluateSelfmodPreflight,
  isMainBranch,
  selfmodLandingDecision,
  type SelfmodCaps,
  type SelfmodDiffEntry,
  type SelfmodPreflightOk,
  type SelfmodPreflightRequest,
  type SelfmodRefusal,
  type SelfmodVerifyVerdict,
  type SelfmodWorktreeFacts,
} from "./selfmod.ts";

/** Wall-clock cap for one git query (mirrors GIT_LANDING_TIMEOUT_MS). */
export const SELFMOD_GIT_TIMEOUT_MS = 30_000;
/** The gate runs the full four-gate suite (typecheck/lint/tests/build). */
export const SELFMOD_GATE_TIMEOUT_MS = 20 * 60_000;
/** Commit message cap (mirrors the landing tail's message discipline). */
export const SELFMOD_MESSAGE_MAX_CHARS = 500;
/** Above this, an untracked file's lines cannot be counted honestly (fail-closed). */
export const SELFMOD_UNTRACKED_READ_CAP_BYTES = 2 * 1024 * 1024;

// ---------------------------------------------------------------------------
// §1 · path + child plumbing (fail-closed, never throws)
// ---------------------------------------------------------------------------

const IS_WIN = process.platform === "win32";
/** MSYS drive form (`/c/Users/...`): never a Node path on Windows (git.server row). */
const MSYS_PATH_RE = /^\/[A-Za-z]\//;

function validateAbsDir(raw: unknown, label: string): { ok: true; dir: string } | { ok: false; detail: string } {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, detail: `${label} must be a non-empty path string` };
  }
  const t = raw.trim();
  if (t.includes("\0")) return { ok: false, detail: `${label} must not contain NUL` };
  if (IS_WIN && MSYS_PATH_RE.test(t)) {
    return { ok: false, detail: `${label} ${JSON.stringify(t)} is an MSYS-style path — pass a Windows path (e.g. C:\\...)` };
  }
  if (!isAbsolute(t)) return { ok: false, detail: `${label} ${JSON.stringify(t)} must be absolute` };
  return { ok: true, dir: resolve(t) };
}

/** Path equality with the host's case semantics (win32 folds, POSIX does not). */
function pathEq(a: string, b: string): boolean {
  const norm = (s: string) => resolve(s).replace(/[\\/]+$/, "");
  const na = norm(a);
  const nb = norm(b);
  return IS_WIN ? na.toLowerCase() === nb.toLowerCase() : na === nb;
}

type GitRun =
  | { ran: true; exitCode: number; out: string; err: string; ms: number }
  | { ran: false; reason: string; detail: string };

/**
 * The git env for selfmod queries. The repo's scrubbed allowlist (no secrets
 * reach git children) but with the operator's OWN config home restored
 * verbatim: the worktree was checked out under the ambient git config, and a
 * NEUTRAL config reads every CRLF checkout as modified (measured on this host:
 * core.autocrlf=true ⇒ a fresh worktree scans dirty under a neutral HOME, and
 * a whole-tree phantom numstat would follow). Parity with the config that
 * PRODUCED the worktree is the honesty requirement; `git.server.ts`'s neutral
 * env stays right for repositories the landing tail itself initialized.
 * Identity/signing for the guarded commit stays explicit (`-c` flags).
 */
function selfmodGitEnv(): NodeJS.ProcessEnv {
  const env = scrubbedEnv();
  for (const key of ["HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"] as const) {
    const value = process.env[key];
    if (typeof value === "string" && value !== "") env[key] = value;
  }
  env.GIT_TERMINAL_PROMPT = "0";
  env.LC_ALL = "C";
  env.LANG = "C";
  return env;
}

/** One bounded git invocation, cwd-targeted, argv-array-only. */
async function runGitIn(cwd: string, argv: readonly string[], timeoutMs = SELFMOD_GIT_TIMEOUT_MS): Promise<GitRun> {
  const r = await runBoundedChild("git", [...argv], { cwd, timeoutMs, env: selfmodGitEnv() });
  if (r.ran !== true) return { ran: false, reason: r.reason, detail: r.error };
  return { ran: true, exitCode: r.exitCode, out: r.stdout, err: r.stderr, ms: r.durationMs };
}

function firstLine(text: string): string {
  const line = text.split(/\r?\n/, 1)[0]?.trim() ?? "";
  return line.length > 200 ? `${line.slice(0, 200)}…` : line;
}

function gitUnavailableRefusal(r: Extract<GitRun, { ran: false }>): SelfmodRefusal {
  return { code: "RT_E_GIT_UNAVAILABLE", detail: `git could not run (${r.reason}): ${r.detail}` };
}

function hasControlChar(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) <= 0x1f) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// §2 · worktree validation (design ②: worktree + branch, never main)
// ---------------------------------------------------------------------------

export type SelfmodWorktreeCheck =
  | { ok: true; branch: string; head: string; checks: string[]; refusals: readonly [] }
  | { ok: false; refusals: SelfmodRefusal[] };

/**
 * Prove the facts the pure preflight re-enforces, with real git:
 *   - worktreeDir is a git worktree ROOT (rev-parse --show-toplevel == itself)
 *   - it belongs to repoDir (same --git-common-dir)
 *   - its branch is named and NOT main/master (design ②: never main)
 *   - it is clean at start (foreign changes make diff attribution impossible)
 *   - HEAD exists (a baseline to diff against)
 * Any failure is a coded refusal; infra failures (spawn/timeout) refuse too.
 */
export async function validateSelfmodWorktree(input: {
  repoDir: string;
  worktreeDir: string;
  gitBin?: string;
  timeoutMs?: number;
}): Promise<SelfmodWorktreeCheck> {
  const refusals: SelfmodRefusal[] = [];
  const repo = validateAbsDir(input?.repoDir, "repoDir");
  const wt = validateAbsDir(input?.worktreeDir, "worktreeDir");
  if (!repo.ok) refusals.push({ code: "RT_E_VALIDATION", detail: repo.detail });
  if (!wt.ok) refusals.push({ code: "RT_E_VALIDATION", detail: wt.detail });
  if (!repo.ok || !wt.ok) return { ok: false, refusals };
  if (pathEq(repo.dir, wt.dir)) {
    return {
      ok: false,
      refusals: [{ code: SELFMOD_CODES.UNGOVERNED, detail: "worktreeDir resolves to repoDir — self-mod runs in a DEDICATED worktree, never the live checkout" }],
    };
  }
  if (!existsSync(repo.dir)) refusals.push({ code: "RT_E_VALIDATION", detail: `repoDir ${JSON.stringify(repo.dir)} does not exist` });
  if (!existsSync(wt.dir)) refusals.push({ code: "RT_E_VALIDATION", detail: `worktreeDir ${JSON.stringify(wt.dir)} does not exist` });
  if (refusals.length > 0) return { ok: false, refusals };

  const timeoutMs = input.timeoutMs ?? SELFMOD_GIT_TIMEOUT_MS;
  const avail = await gitLandingAvailable({ gitBin: input.gitBin, timeoutMs });
  if (!avail.available) {
    return { ok: false, refusals: [{ code: "RT_E_GIT_UNAVAILABLE", detail: `git unavailable (${avail.reason}): ${avail.error}` }] };
  }

  const top = await runGitIn(wt.dir, ["rev-parse", "--show-toplevel"], timeoutMs);
  if (!top.ran) return { ok: false, refusals: [gitUnavailableRefusal(top)] };
  if (top.exitCode !== 0) {
    return {
      ok: false,
      refusals: [{ code: SELFMOD_CODES.UNGOVERNED, detail: `worktreeDir is not inside a git work tree: ${firstLine(top.err) || `git exit ${top.exitCode}`}` }],
    };
  }
  if (!pathEq(top.out.trim(), wt.dir)) {
    return {
      ok: false,
      refusals: [{ code: SELFMOD_CODES.UNGOVERNED, detail: `worktreeDir must be the worktree ROOT (git toplevel is ${JSON.stringify(top.out.trim())})` }],
    };
  }

  const commonWt = await runGitIn(wt.dir, ["rev-parse", "--git-common-dir"], timeoutMs);
  if (!commonWt.ran) return { ok: false, refusals: [gitUnavailableRefusal(commonWt)] };
  const commonRepo = await runGitIn(repo.dir, ["rev-parse", "--git-common-dir"], timeoutMs);
  if (!commonRepo.ran) return { ok: false, refusals: [gitUnavailableRefusal(commonRepo)] };
  if (commonWt.exitCode !== 0 || commonRepo.exitCode !== 0) {
    return {
      ok: false,
      refusals: [{ code: SELFMOD_CODES.UNGOVERNED, detail: `cannot resolve the shared git dir (worktree exit ${commonWt.exitCode}, repo exit ${commonRepo.exitCode}) — is repoDir a git checkout?` }],
    };
  }
  const wtCommon = resolve(wt.dir, commonWt.out.trim());
  const repoCommon = resolve(repo.dir, commonRepo.out.trim());
  if (!pathEq(wtCommon, repoCommon)) {
    return {
      ok: false,
      refusals: [{ code: SELFMOD_CODES.UNGOVERNED, detail: `worktreeDir is not a worktree of repoDir (git-common-dir ${JSON.stringify(wtCommon)} ≠ ${JSON.stringify(repoCommon)})` }],
    };
  }

  const sym = await runGitIn(wt.dir, ["symbolic-ref", "--short", "HEAD"], timeoutMs);
  if (!sym.ran) return { ok: false, refusals: [gitUnavailableRefusal(sym)] };
  if (sym.exitCode !== 0) {
    return { ok: false, refusals: [{ code: SELFMOD_CODES.UNGOVERNED, detail: "worktree HEAD is not on a named branch (detached) — a self-mod run must be on a named non-main branch" }] };
  }
  const branch = sym.out.trim();
  if (isMainBranch(branch)) {
    return { ok: false, refusals: [{ code: SELFMOD_CODES.UNGOVERNED, detail: `worktree branch ${JSON.stringify(branch)} derives from main/master — design ②: never main` }] };
  }

  const status = await runGitIn(wt.dir, ["status", "--porcelain"], timeoutMs);
  if (!status.ran) return { ok: false, refusals: [gitUnavailableRefusal(status)] };
  if (status.exitCode !== 0) {
    return { ok: false, refusals: [{ code: SELFMOD_CODES.UNGOVERNED, detail: `git status failed in the worktree: ${firstLine(status.err)}` }] };
  }
  if (status.out.trim() !== "") {
    return {
      ok: false,
      refusals: [{ code: SELFMOD_CODES.UNGOVERNED, detail: `worktree is not clean at start (${firstLine(status.out)}) — foreign changes make diff attribution impossible; commit or discard them first` }],
    };
  }

  const head = await runGitIn(wt.dir, ["rev-parse", "HEAD"], timeoutMs);
  if (!head.ran) return { ok: false, refusals: [gitUnavailableRefusal(head)] };
  if (head.exitCode !== 0) {
    return { ok: false, refusals: [{ code: SELFMOD_CODES.UNGOVERNED, detail: "worktree HEAD does not resolve (unborn repository) — a self-mod run needs a committed baseline to diff against" }] };
  }

  return {
    ok: true,
    branch,
    head: head.out.trim(),
    checks: [`worktree root: ${wt.dir}`, `same repo: yes`, `branch: ${branch}`, "clean at start: yes"],
    refusals: [] as const,
  };
}

// ---------------------------------------------------------------------------
// §3 · preflight composition (real worktree facts → the pure envelope verdict)
// ---------------------------------------------------------------------------

export type SelfmodPreflightRunInput = {
  repoDir: string;
  worktreeDir: string;
  allow: unknown;
  requestedTokenCap: unknown;
  enforceDod: unknown;
  humanSeat?: unknown;
  maxFiles?: unknown;
  maxChangedLines?: unknown;
  env: Record<string, string | undefined>;
  gitBin?: string;
  timeoutMs?: number;
};

export type SelfmodPreflightRunResult =
  | { ok: true; verdict: SelfmodPreflightOk; worktree: { branch: string; head: string } }
  | { ok: false; refusals: SelfmodRefusal[] };

/** The real preflight a verb calls: validate the worktree with git, then judge
 *  the request envelope with the pure core. Any refusal `ok:false`. */
export async function preflightSelfmodRun(input: SelfmodPreflightRunInput): Promise<SelfmodPreflightRunResult> {
  const check = await validateSelfmodWorktree({
    repoDir: input?.repoDir,
    worktreeDir: input?.worktreeDir,
    gitBin: input?.gitBin,
    timeoutMs: input?.timeoutMs,
  });
  if (!check.ok) return { ok: false, refusals: check.refusals };
  const facts: SelfmodWorktreeFacts = {
    isWorktreeRoot: true,
    sameRepo: true,
    branch: check.branch,
    clean: true,
  };
  const request: SelfmodPreflightRequest = {
    repoDir: input.repoDir,
    worktreeDir: input.worktreeDir,
    allow: input.allow,
    requestedTokenCap: input.requestedTokenCap,
    enforceDod: input.enforceDod,
    humanSeat: input.humanSeat,
    maxFiles: input.maxFiles,
    maxChangedLines: input.maxChangedLines,
    worktree: facts,
  };
  const verdict = evaluateSelfmodPreflight(request, input.env ?? {});
  if (!verdict.ok) return { ok: false, refusals: verdict.refusals };
  return { ok: true, verdict, worktree: { branch: check.branch, head: check.head } };
}

// ---------------------------------------------------------------------------
// §4 · diff collection (the REAL change set, incl. untracked files)
// ---------------------------------------------------------------------------

export type SelfmodDiffCollect = { ok: true; entries: SelfmodDiffEntry[] } | { ok: false; refusals: SelfmodRefusal[] };

function parseNumstat(out: string): SelfmodDiffEntry[] {
  const entries: SelfmodDiffEntry[] = [];
  for (const line of out.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const added = parts[0] === "-" ? 0 : Number(parts[0]);
    const deleted = parts[1] === "-" ? 0 : Number(parts[1]);
    const path = parts[2];
    if (!Number.isFinite(added) || !Number.isFinite(deleted) || typeof path !== "string") continue;
    entries.push({ path, added, deleted });
  }
  return entries;
}

/** Count lines in an untracked file, bounded (fail-closed over the read cap). */
function countFileLinesBounded(path: string): number | "too-large" | "unreadable" {
  try {
    const size = statSync(path).size;
    if (size > SELFMOD_UNTRACKED_READ_CAP_BYTES) return "too-large";
    const text = readFileSync(path, "utf8");
    if (text === "") return 0;
    const newlines = text.split("\n").length - 1;
    return text.endsWith("\n") ? newlines : newlines + 1;
  } catch {
    return "unreadable";
  }
}

/**
 * The real change set vs HEAD in the worktree: tracked numstat (`--no-renames`
 * so a rename counts as delete+add, never an undercount) + untracked files
 * with honestly counted lines. No cap logic here — `diffWithinCaps` judges it.
 */
export async function collectSelfmodDiff(
  worktreeDir: string,
  opts?: { timeoutMs?: number },
): Promise<SelfmodDiffCollect> {
  const wt = validateAbsDir(worktreeDir, "worktreeDir");
  if (!wt.ok) return { ok: false, refusals: [{ code: "RT_E_VALIDATION", detail: wt.detail }] };
  const timeoutMs = opts?.timeoutMs ?? SELFMOD_GIT_TIMEOUT_MS;

  const num = await runGitIn(wt.dir, ["-c", "core.quotepath=false", "diff", "--numstat", "--no-renames", "HEAD"], timeoutMs);
  if (!num.ran) return { ok: false, refusals: [gitUnavailableRefusal(num)] };
  if (num.exitCode !== 0) {
    return { ok: false, refusals: [{ code: "RT_E_VALIDATION", detail: `git diff --numstat failed: ${firstLine(num.err)}` }] };
  }
  const entries = parseNumstat(num.out);

  const statusZ = await runGitIn(wt.dir, ["status", "--porcelain", "-z"], timeoutMs);
  if (!statusZ.ran) return { ok: false, refusals: [gitUnavailableRefusal(statusZ)] };
  if (statusZ.exitCode !== 0) {
    return { ok: false, refusals: [{ code: "RT_E_VALIDATION", detail: `git status -z failed: ${firstLine(statusZ.err)}` }] };
  }
  for (const chunk of statusZ.out.split("\0")) {
    if (!chunk.startsWith("?? ")) continue;
    const rel = chunk.slice(3).replace(/\\/g, "/");
    if (rel === "") continue;
    const lines = countFileLinesBounded(join(wt.dir, rel));
    if (lines === "too-large") {
      return {
        ok: false,
        refusals: [{ code: SELFMOD_CODES.CAP_EXCEEDED, detail: `untracked file ${rel} exceeds the ${SELFMOD_UNTRACKED_READ_CAP_BYTES}-byte read cap — line count cannot be established honestly (fail-closed)` }],
      };
    }
    if (lines === "unreadable") {
      return { ok: false, refusals: [{ code: "RT_E_VALIDATION", detail: `untracked file ${rel} could not be read for line counting` }] };
    }
    entries.push({ path: rel, added: lines, deleted: 0, untracked: true });
  }
  return { ok: true, entries };
}

// ---------------------------------------------------------------------------
// §5 · the verify gate (design ③: self-DoD = scripts/gate.sh)
// ---------------------------------------------------------------------------

/**
 * Run `<worktree>/scripts/gate.sh` for real and read its verdict: the script's
 * contract prints exactly one JSON verdict object on stdout — green iff its
 * LAST non-empty stdout line parses to `{ok:true}`. Anything else (red verdict,
 * crash, timeout, absent script) is `ok:false` — never a green guess.
 */
export async function runSelfmodVerifyGate(
  worktreeDir: string,
  opts?: { timeoutMs?: number },
): Promise<SelfmodVerifyVerdict> {
  const started = Date.now();
  try {
    const wt = validateAbsDir(worktreeDir, "worktreeDir");
    if (!wt.ok) return { ok: false, reason: wt.detail, ms: Date.now() - started };
    const gate = join(wt.dir, "scripts", "gate.sh");
    if (!existsSync(gate)) {
      return { ok: false, reason: "scripts/gate.sh missing in the worktree — the self-DoD gate cannot run", ms: Date.now() - started };
    }
    const r = await runBoundedChild("bash", ["scripts/gate.sh"], {
      cwd: wt.dir,
      timeoutMs: opts?.timeoutMs ?? SELFMOD_GATE_TIMEOUT_MS,
      env: process.env,
    });
    if (r.ran !== true) {
      return { ok: false, reason: `gate could not run (${r.reason}): ${r.error}`, ms: Date.now() - started };
    }
    const lines = r.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s !== "");
    const last = lines.length > 0 ? lines[lines.length - 1] : "";
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(last);
    } catch {
      parsed = null;
    }
    const green = parsed !== null && typeof parsed === "object" && (parsed as { ok?: unknown }).ok === true;
    const tail = (r.stderr.trim() !== "" ? r.stderr.trim() : r.stdout.trim()).slice(-800);
    if (!green) {
      return { ok: false, reason: `gate.sh exit ${r.exitCode} without an ok:true verdict on its last stdout line`, tail, ms: Date.now() - started };
    }
    return { ok: true, reason: `gate.sh ok (exit 0, ${r.durationMs}ms)`, tail, ms: Date.now() - started };
  } catch (err) {
    return { ok: false, reason: `verify gate threw: ${err instanceof Error ? err.message : String(err)}`, ms: Date.now() - started };
  }
}

// ---------------------------------------------------------------------------
// §6 · land / discard (design ③: failed verify ⇒ no commit; rollback path)
// ---------------------------------------------------------------------------

export type SelfmodLandInput = {
  worktreeDir: string;
  message: string;
  verify: SelfmodVerifyVerdict | null;
  caps: SelfmodCaps;
  allow: readonly unknown[];
  timeoutMs?: number;
};

export type SelfmodLandResult =
  | { ok: true; landed: true; commit: string; branch: string }
  | { ok: false; landed: false; refusals: SelfmodRefusal[]; unstaged: boolean };

/**
 * Commit the worktree's changes on its own branch — ONLY when every guard
 * passes, in this order:
 *   1. the branch re-verifies non-main (design ②),
 *   2. a present, GREEN verify verdict exists (design ③) — refused BEFORE any
 *      staging, so a red verify performs zero git mutation,
 *   3. the STAGED change set re-derives its own numstat and passes
 *      `diffWithinCaps` (scope + protected + size; a caller cannot fake it),
 *   4. the commit lands with the explicit machine identity (git.server's
 *      DEFAULT_GIT_LAND_IDENTITY via `-c`), then HEAD read-back.
 * On refusal after staging, the index is reset (worktree stays dirty for
 * inspection) and NOTHING is committed — `landed:false` always.
 */
export async function landSelfmodWorktree(input: SelfmodLandInput): Promise<SelfmodLandResult> {
  const refusals: SelfmodRefusal[] = [];
  const message = typeof input?.message === "string" ? input.message : "";
  if (message.trim() === "") {
    refusals.push({ code: "RT_E_VALIDATION", detail: "commit message must be a non-empty string" });
  } else if (message.includes("\0") || hasControlChar(message.replace(/\r\n|\r|\n/g, ""))) {
    refusals.push({ code: "RT_E_VALIDATION", detail: "commit message must not contain NUL or control characters (newlines are allowed)" });
  } else if (message.length > SELFMOD_MESSAGE_MAX_CHARS) {
    refusals.push({ code: "RT_E_VALIDATION", detail: `commit message exceeds the ${SELFMOD_MESSAGE_MAX_CHARS}-char cap` });
  }
  const capsOk =
    input?.caps !== null &&
    typeof input?.caps === "object" &&
    Number.isInteger(input.caps.maxFiles) &&
    input.caps.maxFiles >= 1 &&
    Number.isInteger(input.caps.maxChangedLines) &&
    input.caps.maxChangedLines >= 1;
  if (!capsOk) refusals.push({ code: "RT_E_VALIDATION", detail: "caps must be {maxFiles, maxChangedLines} positive integers (run the preflight first)" });
  const wt = validateAbsDir(input?.worktreeDir, "worktreeDir");
  if (!wt.ok) refusals.push({ code: "RT_E_VALIDATION", detail: wt.detail });
  if (refusals.length > 0 || !wt.ok) return { ok: false, landed: false, refusals, unstaged: false };
  const timeoutMs = input.timeoutMs ?? SELFMOD_GIT_TIMEOUT_MS;

  const sym = await runGitIn(wt.dir, ["symbolic-ref", "--short", "HEAD"], timeoutMs);
  if (!sym.ran) return { ok: false, landed: false, refusals: [gitUnavailableRefusal(sym)], unstaged: false };
  const branch = sym.exitCode === 0 ? sym.out.trim() : "";
  if (sym.exitCode !== 0 || isMainBranch(branch)) {
    return {
      ok: false,
      landed: false,
      refusals: [{ code: SELFMOD_CODES.UNGOVERNED, detail: `refusing to land on ${branch === "" ? "a detached HEAD" : `branch ${JSON.stringify(branch)}`} — design ②: never main` }],
      unstaged: false,
    };
  }

  // Design ③, strictly first: a red/absent verify never reaches staging.
  if (input.verify == null || input.verify.ok !== true) {
    const decision = selfmodLandingDecision({ verify: input.verify, branch, capsVerdict: null });
    return { ok: false, landed: false, refusals: decision.refusals, unstaged: false };
  }

  const add = await runGitIn(wt.dir, ["add", "-A"], timeoutMs);
  if (!add.ran) return { ok: false, landed: false, refusals: [gitUnavailableRefusal(add)], unstaged: false };
  if (add.exitCode !== 0) {
    return { ok: false, landed: false, refusals: [{ code: "RT_E_VALIDATION", detail: `git add -A failed: ${firstLine(add.err)}` }], unstaged: false };
  }

  const staged = await runGitIn(wt.dir, ["-c", "core.quotepath=false", "diff", "--cached", "--numstat", "--no-renames", "HEAD"], timeoutMs);
  if (!staged.ran) return { ok: false, landed: false, refusals: [gitUnavailableRefusal(staged)], unstaged: false };
  if (staged.exitCode !== 0) {
    return { ok: false, landed: false, refusals: [{ code: "RT_E_VALIDATION", detail: `git diff --cached failed: ${firstLine(staged.err)}` }], unstaged: false };
  }
  const capsVerdict = diffWithinCaps(parseNumstat(staged.out), input.caps, Array.isArray(input.allow) ? input.allow : []);
  const decision = selfmodLandingDecision({ verify: input.verify, branch, capsVerdict });
  if (!decision.mayLand) {
    // Leave the worktree as it was found (dirty, unstaged): reset the index only.
    const unstage = await runGitIn(wt.dir, ["reset", "-q"], timeoutMs);
    return { ok: false, landed: false, refusals: decision.refusals, unstaged: unstage.ran && unstage.exitCode === 0 };
  }

  const commit = await runGitIn(
    wt.dir,
    [
      "-c",
      `user.name=${DEFAULT_GIT_LAND_IDENTITY.name}`,
      "-c",
      `user.email=${DEFAULT_GIT_LAND_IDENTITY.email}`,
      // The machine commit is never GPG-signed — an explicit choice, so a
      // globally configured commit.gpgsign can never fail or block the guard.
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      message,
    ],
    timeoutMs,
  );
  if (!commit.ran) return { ok: false, landed: false, refusals: [gitUnavailableRefusal(commit)], unstaged: false };
  if (commit.exitCode !== 0) {
    return {
      ok: false,
      landed: false,
      refusals: [{ code: "RT_E_VALIDATION", detail: `git commit refused: ${firstLine(commit.err) || firstLine(commit.out)}` }],
      unstaged: false,
    };
  }
  const head = await runGitIn(wt.dir, ["rev-parse", "HEAD"], timeoutMs);
  if (!head.ran || head.exitCode !== 0) {
    return {
      ok: false,
      landed: false,
      refusals: [{ code: SELFMOD_CODES.VERIFY_FAILED, detail: `the commit landed but HEAD could not be read back — treat the state as UNVERIFIED and inspect the worktree (${head.ran ? firstLine(head.err) : head.detail})` }],
      unstaged: false,
    };
  }
  return { ok: true, landed: true, commit: head.out.trim(), branch };
}

export type SelfmodDiscardResult =
  | { ok: true; discarded: true; status: string }
  | { ok: false; refusals: SelfmodRefusal[] };

/**
 * The rollback path: discard ALL uncommitted changes in the selfmod worktree
 * (`reset --hard HEAD` + `clean -fd`), returning it to its committed baseline.
 * Only ever valid on a validated non-main selfmod worktree — re-verified here
 * (defense in depth). Nothing in history is touched: this is the "the run's
 * candidate edits must not survive" bound, not a history rewrite.
 */
export async function discardSelfmodWorktreeChanges(
  worktreeDir: string,
  opts?: { timeoutMs?: number },
): Promise<SelfmodDiscardResult> {
  const wt = validateAbsDir(worktreeDir, "worktreeDir");
  if (!wt.ok) return { ok: false, refusals: [{ code: "RT_E_VALIDATION", detail: wt.detail }] };
  const timeoutMs = opts?.timeoutMs ?? SELFMOD_GIT_TIMEOUT_MS;
  const sym = await runGitIn(wt.dir, ["symbolic-ref", "--short", "HEAD"], timeoutMs);
  if (!sym.ran) return { ok: false, refusals: [gitUnavailableRefusal(sym)] };
  const branch = sym.exitCode === 0 ? sym.out.trim() : "";
  if (sym.exitCode !== 0 || isMainBranch(branch)) {
    return { ok: false, refusals: [{ code: SELFMOD_CODES.UNGOVERNED, detail: "discard refuses outside a named non-main selfmod worktree (design ②)" }] };
  }
  const reset = await runGitIn(wt.dir, ["reset", "--hard", "HEAD"], timeoutMs);
  if (!reset.ran) return { ok: false, refusals: [gitUnavailableRefusal(reset)] };
  if (reset.exitCode !== 0) return { ok: false, refusals: [{ code: "RT_E_VALIDATION", detail: `git reset --hard failed: ${firstLine(reset.err)}` }] };
  const clean = await runGitIn(wt.dir, ["clean", "-fd"], timeoutMs);
  if (!clean.ran) return { ok: false, refusals: [gitUnavailableRefusal(clean)] };
  if (clean.exitCode !== 0) return { ok: false, refusals: [{ code: "RT_E_VALIDATION", detail: `git clean -fd failed: ${firstLine(clean.err)}` }] };
  const status = await runGitIn(wt.dir, ["status", "--porcelain"], timeoutMs);
  if (!status.ran) return { ok: false, refusals: [gitUnavailableRefusal(status)] };
  const after = status.out.trim();
  if (after !== "") {
    return { ok: false, refusals: [{ code: "RT_E_VALIDATION", detail: `discard left the worktree dirty (${firstLine(after)}) — manual inspection required` }] };
  }
  return { ok: true, discarded: true, status: after };
}
