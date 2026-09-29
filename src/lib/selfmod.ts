/**
 * selfmod.ts — the guardrail core for self-modification (F2 · 314 wave · design:
 * `fixes/311_se2_surfaces.md` §4b, "the honest minimum").
 *
 * Self-mod = the existing pipeline pointed at THIS repo. Before any writer exists,
 * the safety machinery must exist as REAL, testable code — this module is that
 * machinery's decision layer. It is PURE by construction:
 *   - no node:fs, no node:child_process, no timers, no module-level side effects
 *     (the enforcement EXECUTION lives in `selfmod.server.ts`, which reuses the
 *     repo's one bounded spawn point, `runBoundedChild`);
 *   - the only environment it sees is the caller-passed `env` record, parsed
 *     through `tokenCapFromEnv` (the strict M7-08 rule — junk spelling means
 *     NO cap, which here means REFUSAL, never a silently different cap).
 *
 * The design's guards, one by one (design ①–⑦):
 *   ① path allow-list + protected manifest        → matchProtectedPath / evaluateSelfmodPreflight
 *   ② worktree + branch, never main               → worktree facts in the preflight (executed in selfmod.server.ts)
 *   ③ self-DoD = scripts/gate.sh before AND after → selfmodLandingDecision (a red/absent verdict can NEVER land)
 *   ④ stock gates stay human                      → humanSeat must be false, always
 *   ⑤ mandatory RAPIDTOOL_TOKEN_CAP + enforceDoD  → preflight token-cap + enforceDod checks
 *   ⑥ forbidden-path manifest                     → SELFMOD_PROTECTED_PATHS (6 classes)
 *   ⑦ honest limit (bounded runner, not a sandbox)→ SELFMOD_HONEST_LIMITS rides every verdict
 *
 * Strike rule: if a path here stops matching real behavior on disk, STRIKE the
 * path/check — never keep a decorative guard. Every row of the manifest carries
 * a `why`; a reviewer may remove an extension row, never a design-named one
 * (`engine.ts`, `codegen.server.ts`, `rapidtool-cli.mjs`, `gate.sh`, `dod.ts`).
 */
import { tokenCapFromEnv } from "./token-ledger.ts";

// ---------------------------------------------------------------------------
// §1 · the protected-path manifest (design ⑥ + the consent/seal/ledger/pins classes)
// ---------------------------------------------------------------------------

/** The manifest classes. `consent` = the rules the run is judged by; `seal` =
 *  the no-self-approval machinery; `ledger` = the budget ledger; `pins` = the
 *  tests that judge the harness; `guardrails` = self-protection (this machinery
 *  and its containment helper). */
export const SELFMOD_PROTECTED_CLASSES = [
  "consent",
  "pipeline",
  "seal",
  "ledger",
  "pins",
  "guardrails",
] as const;
export type SelfmodProtectedClass = (typeof SELFMOD_PROTECTED_CLASSES)[number];

export type SelfmodProtectedEntry = {
  /** Repo-relative posix path (file today; a trailing `/` marks a directory). */
  readonly path: string;
  readonly class: SelfmodProtectedClass;
  readonly why: string;
};

/**
 * The forbidden-path manifest. Design §4b ⑥ names five (`engine.ts`,
 * `codegen.server.ts`, `rapidtool-cli.mjs`, `gate.sh`, `dod.ts`); the wave adds
 * the classes its recovery doc names (AGENTS.md consent class, the seal, the
 * ledger, the tests' pins) plus self-protection. Over-protection is recoverable
 * by an explicit manifest edit (a human act); under-protection is a safety hole
 * — when in doubt, protect.
 */
export const SELFMOD_PROTECTED_PATHS: readonly SelfmodProtectedEntry[] = [
  // — consent class: a self-mod run must not rewrite the rules it is judged by —
  { path: "AGENTS.md", class: "consent", why: "the repo agent contract — consent cannot be self-granted" },
  { path: "AGENT_GUIDE.md", class: "consent", why: "the product honesty contract" },
  { path: "RESUME.md", class: "consent", why: "session hard rules + settled decisions" },
  // — pipeline class (design ⑥, verbatim) —
  { path: "src/lib/engine.ts", class: "pipeline", why: "design ⑥: the run must not edit its own engine" },
  { path: "src/lib/codegen.server.ts", class: "pipeline", why: "design ⑥: the run must not edit its own synthesis path" },
  { path: "scripts/rapidtool-cli.mjs", class: "pipeline", why: "design ⑥: the run must not edit its own verb surface" },
  { path: "scripts/gate.sh", class: "pipeline", why: "design ⑥: the self-DoD gate itself (verdict forgery)" },
  { path: "src/lib/headless.ts", class: "pipeline", why: "the CLI backend driver every verb composes — 'own pipeline' in practice" },
  { path: "src/lib/errors.ts", class: "pipeline", why: "the RT_E registry every refusal rides on — silently editing it downgrades refusals" },
  // — seal class: the no-self-approval machinery —
  { path: "src/lib/dod.ts", class: "seal", why: "design ⑥ names it; the DoD/seal gate logic (T-11 red-seal semantics)" },
  { path: "src/lib/policy.ts", class: "seal", why: "the seat policy — the seal's no-self-approval story rides PolicySeat/evaluatePolicy" },
  // — ledger class —
  { path: "src/lib/token-ledger.ts", class: "ledger", why: "design ⑤'s budget machinery — the cap this run refuses to run without" },
  // — pins class: the tests that judge the harness must not be editable by it —
  { path: "src/lib/honesty-guards.test.ts", class: "pins", why: "the W11 falsification pins" },
  { path: "src/lib/token-ledger.test.ts", class: "pins", why: "pins the cap parse the selfmod guard trusts" },
  { path: "src/lib/wild-seal.test.ts", class: "pins", why: "the E1 seal-provenance pins" },
  { path: "scripts/cli-exit-taxonomy.test.mjs", class: "pins", why: "the CLI exit/seat contract pins" },
  { path: "scripts/check-assertion-gaps.mjs", class: "pins", why: "the T-17 meta-pin that judges test quality itself" },
  { path: "src/lib/selfmod.test.ts", class: "pins", why: "self-protection: the guardrail pins" },
  { path: "src/lib/selfmod.server.test.ts", class: "pins", why: "self-protection: the executor pins" },
  // — guardrails class: this machinery may not be edited by what it guards —
  { path: "src/lib/selfmod.ts", class: "guardrails", why: "self-protection: the guardrail core" },
  { path: "src/lib/selfmod.server.ts", class: "guardrails", why: "self-protection: the bounded executor" },
  { path: "scripts/path-safety.mjs", class: "guardrails", why: "self-protection: the physical-containment helper every allow-list check rides" },
];

// ---------------------------------------------------------------------------
// §2 · caps + codes
// ---------------------------------------------------------------------------

/**
 * Diff-size/scope caps. Defaults keep one self-mod change reviewable in one
 * sitting; the HARD ceilings are the wall a caller can never raise past
 * (`--max-files 9999` is a coded refusal, not a bigger cap).
 */
export const SELFMOD_LIMITS = {
  maxFilesDefault: 12,
  maxFilesCeiling: 40,
  maxChangedLinesDefault: 800,
  maxChangedLinesCeiling: 2000,
} as const;

/** Design ⑤: `RAPIDTOOL_TOKEN_CAP` is mandatory for a self-mod run — no cap in
 *  force (unset / junk spelling) is a REFUSAL, never a silent unmetered run. */
export const SELFMOD_TOKEN_CAP_ENV = "RAPIDTOOL_TOKEN_CAP";

/** The four refusal codes this lane reserves. Additive; registered into
 *  `src/lib/errors.ts` (ERROR_CODES + ERROR_CODE_DOC) by the mounting change —
 *  until then the CLI cannot carry them and the mount is incomplete, which the
 *  314_f2 log records as the precise blocker. */
export const SELFMOD_CODES = {
  PROTECTED: "RT_E_SELFMOD_PROTECTED",
  CAP_EXCEEDED: "RT_E_SELFMOD_CAP_EXCEEDED",
  UNGOVERNED: "RT_E_SELFMOD_UNGOVERNED",
  VERIFY_FAILED: "RT_E_SELFMOD_VERIFY_FAILED",
} as const;
export type SelfmodCode = (typeof SELFMOD_CODES)[keyof typeof SELFMOD_CODES];

/** Registry-shaped docs for the four codes (meaning + agentAction, the
 *  errors.ts contract). Merged into ERROR_CODE_DOC at mount time. */
export const SELFMOD_CODE_DOC: Record<SelfmodCode, { meaning: string; agentAction: string }> = {
  [SELFMOD_CODES.PROTECTED]: {
    meaning:
      "A self-mod request touches a protected path — the allow-list covers/equals it, or the staged diff does (design ⑥: a run must not edit its own consent contract, seal, ledger, pins, pipeline, or guardrails).",
    agentAction:
      "Remove the protected path from the allow-list / the change set; if the protected file genuinely must change, that is an explicit human edit outside self-mod, never a self-mod run.",
  },
  [SELFMOD_CODES.CAP_EXCEEDED]: {
    meaning:
      "A self-mod request exceeds its caps — declared caps above the hard ceilings, or the staged diff above the declared file/line caps.",
    agentAction:
      "Shrink the change to the declared caps or split it into bounded runs; never raise the caps past the ceilings — the ceilings exist so a 'cap' cannot be set to infinity.",
  },
  [SELFMOD_CODES.UNGOVERNED]: {
    meaning:
      "A self-mod governance precondition is missing: no RAPIDTOOL_TOKEN_CAP in force, --cap above the session cap, enforceDod off, an attempted human-seat forgery, or an unsafe worktree (not a worktree root / wrong repo / main-derivation branch / dirty start).",
    agentAction:
      "Fix the named precondition exactly as the refusal details it (set the cap, keep the project's enforceDod on, never pass --i-am-human, prepare a clean dedicated worktree on a non-main branch) and re-run; do not work around a guard.",
  },
  [SELFMOD_CODES.VERIFY_FAILED]: {
    meaning:
      "The self-DoD gate was red, unrunnable, or absent at landing time — by design a failed verify means NO commit, ever.",
    agentAction:
      "Read the gate verdict/tail in the refusal, fix the change (or discard it via the rollback path), and re-run the gate green before any commit is attempted; never commit past a red verify.",
  },
};

/** Design ⑦ — stated up front, on every verdict this module returns. */
export const SELFMOD_HONEST_LIMITS: readonly string[] = [
  "bounded local runner, NOT an OS sandbox (R13-f04 unlanded · CF-4): a self-mod run runs the repo's own scripts and is never containment.",
  "self-edits default to compile-check-only tree-run; the stock HITL gates stay human — a self-mod run never forges the human seat.",
  "keyless = refusal: the composed pipeline needs keyed synthesis, and a keyless floor would be a fake self-edit — it never runs here.",
  "main is never touched: changes live on the worktree's branch until a human reviews and merges.",
] as const;

// ---------------------------------------------------------------------------
// §3 · path helpers (pure; the physical filesystem check is the runner's)
// ---------------------------------------------------------------------------

/** Normalize a caller-provided path to a repo-relative posix form, or null when
 *  it cannot be one (absolute, drive form, `..`/`.`/empty segments). Pure —
 *  physical containment (`physicalInside`) is layered on by the executor. */
export function normalizeRelPathRaw(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let p = raw.trim().replace(/\\/g, "/");
  while (p.startsWith("./")) p = p.slice(2);
  p = p.replace(/\/+$/, "");
  if (p === "") return null;
  if (p.startsWith("/")) return null;
  if (/^[A-Za-z]:/.test(p)) return null;
  const segs = p.split("/");
  if (segs.some((seg) => seg === "" || seg === "." || seg === "..")) return null;
  return p;
}

export type SelfmodProtectedMatch = SelfmodProtectedEntry;

/** The protected-path match: exact file, or under a protected directory entry.
 *  Case- and separator-insensitive (git prints `/`; Windows folds case). */
export function matchProtectedPath(relPath: unknown): SelfmodProtectedMatch | null {
  const rel = normalizeRelPathRaw(relPath);
  if (rel === null) return null;
  const lower = rel.toLowerCase();
  for (const entry of SELFMOD_PROTECTED_PATHS) {
    const p = entry.path.toLowerCase();
    if (lower === p || lower.startsWith(p + "/")) return entry;
  }
  return null;
}

export type SelfmodRefusalCode = SelfmodCode | "RT_E_VALIDATION";

export type SelfmodRefusal = { code: SelfmodRefusalCode; detail: string };

/** True when `rel` is equal to, or under, an allow-list entry (dir prefix). */
export function allowedBy(allow: readonly string[], relPath: unknown): boolean {
  const rel = normalizeRelPathRaw(relPath);
  if (rel === null) return false;
  const lower = rel.toLowerCase();
  for (const raw of allow) {
    const entry = normalizeRelPathRaw(raw);
    if (entry === null) continue;
    const e = entry.toLowerCase();
    if (lower === e || lower.startsWith(e + "/")) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// §4 · the preflight evaluator (envelope checks, before anything runs)
// ---------------------------------------------------------------------------

export type SelfmodCaps = { maxFiles: number; maxChangedLines: number };

/** Worktree facts the EXECUTOR verified with real git commands (see
 *  selfmod.server.ts `validateSelfmodWorktree`); the pure layer re-enforces
 *  them so a caller that skips the executor still cannot pass. */
export type SelfmodWorktreeFacts = {
  isWorktreeRoot?: unknown;
  sameRepo?: unknown;
  branch?: unknown;
  clean?: unknown;
};

export type SelfmodPreflightRequest = {
  /** The repo being self-modified (the live checkout; never the edit target). */
  repoDir: string;
  /** The dedicated worktree the edits may live in (must differ from repoDir). */
  worktreeDir: string;
  allow: unknown;
  maxFiles?: unknown;
  maxChangedLines?: unknown;
  requestedTokenCap?: unknown;
  enforceDod?: unknown;
  humanSeat?: unknown;
  worktree?: SelfmodWorktreeFacts | null;
};

export type SelfmodPreflightOk = {
  ok: true;
  caps: SelfmodCaps;
  tokenCap: number;
  envCap: number;
  branch: string;
  checks: string[];
  honestLimits: readonly string[];
};
export type SelfmodPreflightFail = {
  ok: false;
  refusals: SelfmodRefusal[];
  honestLimits: readonly string[];
};
export type SelfmodPreflightVerdict = SelfmodPreflightOk | SelfmodPreflightFail;

const MAIN_BRANCHES = new Set(["main", "master"]);

/** True when the branch name derives from a mainline (never an edit target). */
export function isMainBranch(branch: unknown): boolean {
  if (typeof branch !== "string") return false;
  const b = branch.trim().toLowerCase();
  return b === "" || MAIN_BRANCHES.has(b) || b.startsWith("main/") || b.startsWith("master/");
}

function intInRange(value: unknown, fallback: number, ceiling: number): number | null {
  const n = value === undefined ? fallback : typeof value === "number" ? value : Number.NaN;
  if (!Number.isInteger(n) || n < 1 || n > ceiling) return null;
  return n;
}

/** Same-path string compare, separator- and (win32) case-insensitive. Purely
 *  lexical; the physical comparison is the executor's. */
export function samePathLexical(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const norm = (s: string) => s.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return norm(a) === norm(b);
}

/**
 * The allow-list checks: shape (repo-relative entries only) + the protection
 * coverage check in BOTH directions — an entry that is protected, and a
 * directory entry that would COVER a protected path (`--allow src/lib` must
 * not silently legalize `src/lib/engine.ts`).
 */
export function allowListRefusals(allow: unknown): { refusals: SelfmodRefusal[]; entries: string[] } {
  const refusals: SelfmodRefusal[] = [];
  const seen = new Set<string>();
  const push = (r: SelfmodRefusal) => {
    if (!seen.has(r.detail)) {
      seen.add(r.detail);
      refusals.push(r);
    }
  };
  const items = Array.isArray(allow) ? allow : [];
  if (items.length === 0) {
    push({ code: "RT_E_VALIDATION", detail: "--allow must name at least one repo-relative path (an empty allow-list is not a bounded request)" });
  }
  const entries: string[] = [];
  for (const raw of items) {
    const rel = normalizeRelPathRaw(raw);
    if (rel === null) {
      push({ code: "RT_E_VALIDATION", detail: `allow entry ${JSON.stringify(raw)} is not a repo-relative path (no absolute/drive/.. forms)` });
      continue;
    }
    entries.push(rel);
    const own = matchProtectedPath(rel);
    if (own) {
      push({ code: SELFMOD_CODES.PROTECTED, detail: `allow entry ${rel} is protected (${own.class}): ${own.why}` });
    }
    const lower = rel.toLowerCase() + "/";
    for (const entry of SELFMOD_PROTECTED_PATHS) {
      if (entry.path.toLowerCase().startsWith(lower)) {
        push({ code: SELFMOD_CODES.PROTECTED, detail: `allow entry ${rel}/ would cover protected path ${entry.path} (${entry.class})` });
      }
    }
  }
  return { refusals, entries };
}

/**
 * The full preflight. Refusal order is deliberate: shape → consent-class
 * protection → caps → governance (cap/DoD/seat) → worktree facts.
 */
export function evaluateSelfmodPreflight(
  req: SelfmodPreflightRequest,
  env: Record<string, string | undefined>,
): SelfmodPreflightVerdict {
  const refusals: SelfmodRefusal[] = [];
  const checks: string[] = [];

  if (typeof req.repoDir !== "string" || req.repoDir.trim() === "") {
    refusals.push({ code: "RT_E_VALIDATION", detail: "repoDir must be a non-empty absolute path" });
  }
  if (typeof req.worktreeDir !== "string" || req.worktreeDir.trim() === "") {
    refusals.push({ code: "RT_E_VALIDATION", detail: "worktreeDir must be a non-empty absolute path" });
  }
  if (
    !refusals.some((r) => r.code === "RT_E_VALIDATION") &&
    samePathLexical(req.repoDir, req.worktreeDir)
  ) {
    refusals.push({
      code: SELFMOD_CODES.UNGOVERNED,
      detail: "worktreeDir resolves to repoDir — self-mod runs in a DEDICATED worktree, never the live checkout",
    });
  }

  const allowCheck = allowListRefusals(req.allow);
  refusals.push(...allowCheck.refusals);
  if (allowCheck.entries.length > 0) checks.push(`allow-list: ${allowCheck.entries.length} entr${allowCheck.entries.length === 1 ? "y" : "ies"}, none covering a protected path`);

  const maxFiles = intInRange(req.maxFiles, SELFMOD_LIMITS.maxFilesDefault, SELFMOD_LIMITS.maxFilesCeiling);
  const maxChangedLines = intInRange(
    req.maxChangedLines,
    SELFMOD_LIMITS.maxChangedLinesDefault,
    SELFMOD_LIMITS.maxChangedLinesCeiling,
  );
  if (maxFiles === null) {
    refusals.push({
      code: SELFMOD_CODES.CAP_EXCEEDED,
      detail: `maxFiles ${JSON.stringify(req.maxFiles)} must be an integer in 1..${SELFMOD_LIMITS.maxFilesCeiling} (hard ceiling)`,
    });
  }
  if (maxChangedLines === null) {
    refusals.push({
      code: SELFMOD_CODES.CAP_EXCEEDED,
      detail: `maxChangedLines ${JSON.stringify(req.maxChangedLines)} must be an integer in 1..${SELFMOD_LIMITS.maxChangedLinesCeiling} (hard ceiling)`,
    });
  }

  const envCap = tokenCapFromEnv(env);
  if (envCap === undefined) {
    refusals.push({
      code: SELFMOD_CODES.UNGOVERNED,
      detail: `${SELFMOD_TOKEN_CAP_ENV} is not in force (unset / non-plain-integer spelling) — design ⑤: a self-mod run refuses to start unmetered`,
    });
  }
  const requested = typeof req.requestedTokenCap === "number" ? req.requestedTokenCap : Number.NaN;
  if (!Number.isInteger(requested) || requested < 1) {
    refusals.push({ code: "RT_E_VALIDATION", detail: `--cap ${JSON.stringify(req.requestedTokenCap)} must be a positive integer` });
  } else if (envCap !== undefined && requested > envCap) {
    refusals.push({
      code: SELFMOD_CODES.UNGOVERNED,
      detail: `--cap ${requested} exceeds the session cap ${envCap} — a self-mod run may narrow the budget, never widen it`,
    });
  }

  if (req.enforceDod !== true) {
    refusals.push({
      code: SELFMOD_CODES.UNGOVERNED,
      detail: "the project's enforceDod is not true — design ⑤: self-mod requires enforce-DoD ON (advisory mode is refused, not downgraded)",
    });
  }
  if (req.humanSeat === true) {
    refusals.push({
      code: SELFMOD_CODES.UNGOVERNED,
      detail: "humanSeat claimed — design ④: a self-mod run never forges the human seat (the stock gates stay human)",
    });
  }

  const wt = req.worktree ?? {};
  if (wt.isWorktreeRoot !== true) {
    refusals.push({ code: SELFMOD_CODES.UNGOVERNED, detail: "worktreeDir is not a git worktree root (executor check missing or failed)" });
  }
  if (wt.sameRepo !== true) {
    refusals.push({ code: SELFMOD_CODES.UNGOVERNED, detail: "worktreeDir is not a worktree of repoDir (git-common-dir mismatch — executor check missing or failed)" });
  }
  if (!isMainBranch(wt.branch)) {
    if (typeof wt.branch !== "string" || wt.branch.trim() === "") {
      refusals.push({ code: SELFMOD_CODES.UNGOVERNED, detail: "worktree branch unknown — a self-mod run must state its non-main branch" });
    }
  } else {
    refusals.push({
      code: SELFMOD_CODES.UNGOVERNED,
      detail: `worktree branch ${JSON.stringify(wt.branch)} derives from main/master — design ②: never main`,
    });
  }
  if (wt.clean !== true) {
    refusals.push({ code: SELFMOD_CODES.UNGOVERNED, detail: "worktree is not clean at start — foreign changes make diff attribution impossible; commit or discard them first" });
  }

  if (refusals.length > 0) return { ok: false, refusals, honestLimits: SELFMOD_HONEST_LIMITS };
  checks.push(
    `caps: ≤${maxFiles} files / ≤${maxChangedLines} lines (ceilings ${SELFMOD_LIMITS.maxFilesCeiling}/${SELFMOD_LIMITS.maxChangedLinesCeiling})`,
    `token cap: ${requested} ≤ session cap ${envCap}`,
    `enforceDod: on · humanSeat: never · worktree: branch ${JSON.stringify(wt.branch)}, clean, same repo`,
  );
  return {
    ok: true,
    caps: { maxFiles: maxFiles as number, maxChangedLines: maxChangedLines as number },
    tokenCap: requested,
    envCap: envCap as number,
    branch: String(wt.branch),
    checks,
    honestLimits: SELFMOD_HONEST_LIMITS,
  };
}

// ---------------------------------------------------------------------------
// §5 · the diff gate (what the change SET is allowed to be)
// ---------------------------------------------------------------------------

export type SelfmodDiffEntry = { path: string; added: number; deleted: number; untracked?: boolean };

export type SelfmodDiffVerdict =
  | { ok: true; totals: { files: number; lines: number }; refusals: readonly [] }
  | { ok: false; totals: { files: number; lines: number }; refusals: SelfmodRefusal[] };

/**
 * Judge a change set: every entry must be inside the allow-list (scope), must
 * not be a protected path (design ⑥, enforced HERE on the real file list — the
 * allow-list preflight alone could be bypassed by a writer that ignores it),
 * and the totals must fit the caps. `entries` is the executor's real
 * `git diff --numstat` + untracked output (see collectSelfmodDiff).
 */
export function diffWithinCaps(
  entries: readonly SelfmodDiffEntry[],
  caps: SelfmodCaps,
  allow: readonly unknown[],
): SelfmodDiffVerdict {
  const allowNorm: string[] = [];
  for (const raw of allow) {
    const rel = normalizeRelPathRaw(raw);
    if (rel !== null) allowNorm.push(rel);
  }
  const refusals: SelfmodRefusal[] = [];
  const seen = new Set<string>();
  const push = (r: SelfmodRefusal) => {
    if (!seen.has(r.detail)) {
      seen.add(r.detail);
      refusals.push(r);
    }
  };
  let files = 0;
  let lines = 0;
  for (const entry of entries) {
    files += 1;
    const added = Number.isFinite(entry.added) && entry.added > 0 ? Math.floor(entry.added) : 0;
    const deleted = Number.isFinite(entry.deleted) && entry.deleted > 0 ? Math.floor(entry.deleted) : 0;
    lines += added + deleted;
    const rel = normalizeRelPathRaw(entry.path);
    if (rel === null) {
      push({ code: "RT_E_VALIDATION", detail: `diff entry path ${JSON.stringify(entry.path)} is not a repo-relative path` });
      continue;
    }
    const prot = matchProtectedPath(rel);
    if (prot) {
      push({ code: SELFMOD_CODES.PROTECTED, detail: `diff touches protected path ${prot.path} (${prot.class}): ${prot.why}` });
    }
    if (!allowedBy(allowNorm, rel)) {
      push({ code: SELFMOD_CODES.PROTECTED, detail: `diff touches ${rel} outside the --allow list (scope guard)` });
    }
  }
  if (files > caps.maxFiles) {
    push({ code: SELFMOD_CODES.CAP_EXCEEDED, detail: `diff touches ${files} files > cap ${caps.maxFiles}` });
  }
  if (lines > caps.maxChangedLines) {
    push({ code: SELFMOD_CODES.CAP_EXCEEDED, detail: `diff changes ${lines} lines (added+deleted) > cap ${caps.maxChangedLines}` });
  }
  const totals = { files, lines };
  if (refusals.length > 0) return { ok: false, totals, refusals };
  return { ok: true, totals, refusals: [] as const };
}

// ---------------------------------------------------------------------------
// §6 · the landing decision (design ③: failed verify ⇒ NO commit, ever)
// ---------------------------------------------------------------------------

export type SelfmodVerifyVerdict = {
  ok: boolean;
  reason?: string;
  /** Bounded excerpt of the gate's output (the evidence a reviewer reads). */
  tail?: string;
  ms?: number;
};

export type SelfmodLandingDecision = {
  mayLand: boolean;
  refusals: SelfmodRefusal[];
  /** At land time the worktree may hold candidate edits; when landing is
   *  refused the rollback path (selfmod.server discard) is the next step.
   *  Nothing landed in either case. */
  rollbackRequired: boolean;
  honestLimits: readonly string[];
};

/**
 * The single decision point for "may this change be committed?". A null/absent
 * verdict, a red verdict, a caps violation, or a main-derivation branch all
 * refuse — the commit executor must consult THIS and a red verify can never be
 * talked around by a caller that skips it (`landSelfmodWorktree` re-derives
 * caps itself and calls this).
 */
export function selfmodLandingDecision(input: {
  verify: SelfmodVerifyVerdict | null | undefined;
  branch: unknown;
  capsVerdict?: { ok: boolean; refusals?: readonly SelfmodRefusal[] } | null;
}): SelfmodLandingDecision {
  const refusals: SelfmodRefusal[] = [];
  if (isMainBranch(input.branch)) {
    refusals.push({ code: SELFMOD_CODES.UNGOVERNED, detail: `refusing to land on main-derivation branch ${JSON.stringify(input.branch)} — design ②: never main` });
  }
  const verify = input.verify;
  if (verify == null) {
    refusals.push({ code: SELFMOD_CODES.VERIFY_FAILED, detail: "no verify verdict presented — design ③: scripts/gate.sh is mandatory before any commit" });
  } else if (verify.ok !== true) {
    const why = typeof verify.reason === "string" && verify.reason !== "" ? verify.reason : "gate verdict was not ok";
    const tail = typeof verify.tail === "string" && verify.tail !== "" ? ` — tail: ${verify.tail.slice(0, 400)}` : "";
    refusals.push({ code: SELFMOD_CODES.VERIFY_FAILED, detail: `verify gate red (${why})${tail} — a failed verify is never a commit` });
  }
  if (input.capsVerdict != null && input.capsVerdict.ok !== true) {
    if (Array.isArray(input.capsVerdict.refusals)) refusals.push(...input.capsVerdict.refusals);
  }
  return {
    mayLand: refusals.length === 0,
    refusals,
    rollbackRequired: refusals.length > 0,
    honestLimits: SELFMOD_HONEST_LIMITS,
  };
}
