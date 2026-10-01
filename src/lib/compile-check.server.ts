// ---------------------------------------------------------------------------
// compile-check.server.ts — per-file compile verdicts over an emitted dir
// (fixes/129 z1 unlanded item → fixes/132 C2).
//
// A scaffold emit (headless.emitProject → scaffold.scaffoldProject) writes a
// runnable file tree (package.json/tsconfig + src modules + oracle spec). This
// seam answers "does every emitted code file actually PARSE" with one honest
// verdict per file — never a fabricated pass:
//
//   .js / .mjs / .cjs  → `node --check <file>`  (the platform parser itself)
//   .ts/.mts/.cts/.jsx/.tsx → the `typescript` devDep's per-file transpile
//                        parse (syntactic diagnostics for the WHOLE file —
//                        node --check parity for TS; NOT a cross-file
//                        typecheck, and documented as such)
//   anything else       → skipped (markdown/json/env/manifests are not code)
//
// Server-only: reads fs + spawns node + imports the typescript devDep, so it
// must never be statically imported from client-safe modules (the CLI and
// headless load it through a lazy dynamic-import seam).
//
// Run: node --experimental-strip-types --test src/lib/compile-check.server.test.ts
// ---------------------------------------------------------------------------
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { fnv1a } from "./algorithms.ts";
import { inventoryFromJobSources } from "./doctor.ts";
// W43 · J1 (fixes/317_j1_oracle · 316_h5_oracle · T6.3): the ONE shared
// behavioral-oracle primitive — the same module scripts/run-eval.mjs delegates
// its eval-side `entry-runs` evaluation to, so the tree-side verdict and the
// eval-side record can never fork on expectExit/expectStdout/expectStderr
// semantics or on the row-validation refusals.
import { checkEntryContract, validateExpectedBehavior, type EntryContractRecord } from "./entry-oracle.ts";
import { runNodeBounded } from "./node-runner.server.ts";
import { maskLiteralsAndComments } from "./sandbox.ts";

export type CompileVerdict = "pass" | "fail";

export type CompileFileVerdict = {
  /** Path relative to the checked dir, POSIX separators. */
  file: string;
  verdict: CompileVerdict;
  /** Empty on pass; the parser/checker error text on fail. */
  detail?: string;
};

export type CompileCheckResult = {
  ok: boolean;
  /** Normalized absolute dir that was walked. */
  dir: string;
  checked: number;
  passed: number;
  failed: number;
  skipped: number;
  verdicts: CompileFileVerdict[];
  /** Set only when the dir is unreadable or holds no checkable code files. */
  error?: string;
};

/** Directories that are never walked (deps/build output/hidden VCS). */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "dist",
  ".output",
  ".nitro",
  ".vercel",
  "coverage",
]);

const JS_EXTS = new Set([".js", ".mjs", ".cjs"]);
const TS_EXTS = new Set([".ts", ".mts", ".cts", ".tsx", ".jsx"]);

/** Honest cap: absurdly large files are a FAIL, never a silent skip. */
const MAX_CHECK_BYTES = 2 * 1024 * 1024;

/** Honest cap: absurdly large trees are a FAIL, never a silent partial walk
 *  (mirrors MAX_CHECK_BYTES; 318 A3 · K1-R5 · J3-D6). */
const MAX_FILES = 2000;

function relPath(root: string, file: string): string {
  return relative(root, file).split(sep).join("/");
}

/** node --check verdict for one JS-family file (the platform parser). */
function checkWithNode(file: string): { verdict: CompileVerdict; detail?: string } {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status === 0) return { verdict: "pass" };
  const err = [r.stderr, r.stdout].filter((s) => typeof s === "string" && s.trim()).join("\n");
  const tail = err.trim().split("\n").slice(-6).join("\n").slice(0, 600);
  return { verdict: "fail", detail: tail || `node --check exited ${r.status ?? "with signal " + r.signal}` };
}

/** 216 (T-02): syntactic parse verdict for a source string that is NOT yet on
 *  disk. Reuses the very same typescript-transpile check `compileCheckDir`
 *  applies to files (`checkWithTypescript`), so the gate and the checker agree
 *  by construction. This is what lets the emit path REFUSE a non-parsing row
 *  before it is written, instead of the corruption only being discoverable
 *  after the fact (the `module.exports = {…}` strip class, 431 tsc errors).
 *
 *  `verdict: null` means "not checkable here" — callers must treat that as a
 *  refusal reason, never as a pass. */
export function parseVerdictForSource(
  path: string,
  source: string,
): { verdict: CompileVerdict | null; detail?: string } {
  if (typeof source !== "string" || source.trim() === "") {
    return { verdict: "fail", detail: "empty source" };
  }
  const ext = (String(path).split(".").pop() ?? "").toLowerCase();
  const checkable = ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs";
  if (!checkable) return { verdict: null, detail: `not a checkable code extension: .${ext}` };
  return checkWithTypescript(path, source);
}

/** typescript-transpile verdict for one TS/TSX-family file (syntactic). */
function checkWithTypescript(file: string, code: string): { verdict: CompileVerdict; detail?: string } {
  const out = ts.transpileModule(code, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  });
  const diags = (out.diagnostics ?? []).filter(
    (d) => d && typeof d.category === "number" && d.category !== ts.DiagnosticCategory.Message,
  );
  if (diags.length === 0) return { verdict: "pass" };
  const detail = diags
    .slice(0, 3)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
    .filter(Boolean)
    .join("\n")
    .slice(0, 600);
  return { verdict: "fail", detail: detail || "typescript transpile diagnostics"};
}

/**
 * Walk `dir` recursively and return one compile verdict per checkable code
 * file. Never fakes a pass: an unreadable dir, a code file the checker cannot
 * run, a file over the byte budget, or a tree over the file-count budget is a
 * loud FAIL (or a top-level error), not a silent skip. Pure fs reads +
 * node/ts checks — no writes.
 */
export function compileCheckDir(dir: string): CompileCheckResult {
  const empty: CompileCheckResult = {
    ok: false,
    dir: "",
    checked: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    verdicts: [],
  };
  let root = dir;
  try {
    root = statSync(dir).isDirectory() ? dir : "";
  } catch {
    return { ...empty, error: `compile-check: dir not readable: ${dir}` };
  }
  if (!root) return { ...empty, error: `compile-check: not a directory: ${dir}` };

  const verdicts: CompileFileVerdict[] = [];
  let skipped = 0;
  let filesSeen = 0;
  let truncated = false;
  const walk = (current: string): void => {
    let entries: import("node:fs").Dirent<string>[] = [];
    try {
      // encoding: "utf8" keeps Dirent.name a string (the default overload
      // types it string|Buffer → join/toLowerCase type errors).
      entries = readdirSync(current, { withFileTypes: true, encoding: "utf8" });
    } catch {
      // Unreadable subdirectory: loud, never silent.
      verdicts.push({
        file: relPath(root, current) || ".",
        verdict: "fail",
        detail: "unreadable directory",
      });
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (filesSeen >= MAX_FILES) {
        // 318 A3 · K1-R5 · J3-D6: the cap is a FAIL, never a silent
        // truncation — mirrors MAX_CHECK_BYTES's honest-cap rule. One
        // tree-level row per walk (the guard trips on every unwound level).
        if (!truncated) {
          truncated = true;
          verdicts.push({
            file: ".",
            verdict: "fail",
            detail: `tree exceeds the ${MAX_FILES}-file compile-check budget — walk truncated, results incomplete`,
          });
        }
        return;
      }
      const full = join(current, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(full);
        else skipped += 1;
        continue;
      }
      filesSeen += 1;
      const ext = e.name.slice(e.name.lastIndexOf(".")).toLowerCase();
      if (!JS_EXTS.has(ext) && !TS_EXTS.has(ext)) {
        skipped += 1;
        continue;
      }
      const rel = relPath(root, full);
      let code: string;
      try {
        if (statSync(full).size > MAX_CHECK_BYTES) {
          verdicts.push({ file: rel, verdict: "fail", detail: "file exceeds the 2MB compile-check budget" });
          continue;
        }
        code = readFileSync(full, "utf8");
      } catch (err) {
        verdicts.push({
          file: rel,
          verdict: "fail",
          detail: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
      const r = JS_EXTS.has(ext)
        ? checkWithNode(full)
        : checkWithTypescript(full, code);
      if (r.verdict === "pass") verdicts.push({ file: rel, verdict: "pass" });
      else verdicts.push({ file: rel, verdict: "fail", detail: r.detail });
    }
  };
  walk(root);

  const failed = verdicts.filter((v) => v.verdict === "fail").length;
  if (verdicts.length === 0) {
    return { ...empty, dir: root, skipped, error: "compile-check: no checkable code files (.js/.mjs/.cjs/.ts/.tsx/.mts/.cts/.jsx) under the dir" };
  }
  return {
    ok: failed === 0,
    dir: root,
    checked: verdicts.length,
    passed: verdicts.length - failed,
    failed,
    skipped,
    verdicts,
  };
}

// ---------------------------------------------------------------------------
// TREE-RUN MODE (fixes/144 M3 lane B3 — D3 "run the tree in loop").
//
// compileCheckDir answers "does every emitted file PARSE". treeRun(dir)
// answers the next question — "does the emitted tree RUN" — by executing the
// tree in-loop under the repo's EXISTING bounded runner (node-runner.server.ts
// runNodeBounded; never a new sandbox) and returning one honest verdict per
// emitted spec plus one kind-entry smoke verdict:
//
//   TreeRunOutcome.compile — the per-file parse verdicts (compileCheckDir,
//                            unchanged and reused)
//   TreeRunOutcome.tests   — per emitted tests/*.spec.ts|*.test.ts file:
//                            { file, compile, tests: {pass, fail}, run } where
//                            run is pass/fail/error/timeout; a file whose
//                            load/execution crashes is run=fail with the
//                            error tail (never a fabricated pass)
//   TreeRunOutcome.run     — the kind-entry smoke verdict or an honest skip
//   TreeRunOutcome.project — 216 (T-18): the emitted project's OWN declared
//                            package.json `typecheck`/`test` scripts, run under
//                            the same bounded runner (real exit codes + bounded
//                            tails), plus (217d) the declared `build` once the
//                            tree's deps are installed. A declared script that
//                            ran RED makes the whole tree NOT ok; one whose
//                            toolchain is not installed — or whose deps are
//                            absent — is a loud `skip` + note, never a
//                            fabricated pass, never a silent ok.
//
// Execution mechanics (no new sandbox, caps reused):
//   * every spec executes as `node --test <file>` inside a runNodeBounded
//     child (the wrapper re-spawns the runner's own node binary so the spec
//     runs under the REAL node:test runner, strip-types included — Node >= 22
//     strips .ts by default); per-file TAP summary gives the assertion counts.
//   * the kind entry executes as a top-level dynamic import of the entry
//     module inside a runNodeBounded child (a load that throws = fail + tail).
//   * hard caps reused: the runner's wall-clock timeout + 1MB output slice +
//     maxBuffer; wrapper output is a compact JSON envelope on stdout.
//   * kind resolution is STRUCTURAL + record-first: a root index.html means
//     webapp/game (vite boot shell — "UI shell — not executable headless",
//     an honest skip); headless kinds resolve their entry from package.json
//     "main", else the first job-* module of .rapidtool/project.json's spec
//     graph (the tree's core module / generated-source host as the scaffold
//     names it), else "src/generated.ts" when generatedSource exists.
//   * purity: treeRun only READS the emitted dir + spawns the runner (which
//     runs in its own scratch cwd); it never writes into the project tree or
//     mutates a project record.
// ---------------------------------------------------------------------------

export type TreeRunVerdict = "pass" | "fail" | "error" | "timeout" | "skip";

export type TreeSpecVerdict = {
  /** Spec path relative to the run dir, POSIX separators. */
  file: string;
  /** Per-file parse verdict (reused from TreeRunOutcome.compile). */
  compile: CompileVerdict;
  /** Assertions that actually executed (node:test TAP summary). A file whose
   *  load crashes reports the crash as run=fail with 0/0 — never a number
   *  the runner did not print. */
  tests: { pass: number; fail: number };
  /** Execution verdict of the spec under the bounded runner. */
  run: TreeRunVerdict;
  /** Empty on pass; the failure/error tail or skip reason on anything else. */
  detail?: string;
  durationMs?: number;
};

export type TreeEntryVerdict = {
  /** Resolved kind label (record-declared coarse kind, else structural). */
  kind: string;
  /** Entry path relative to the run dir when one was executed. */
  entry?: string;
  /** pass = the entry module loaded headless; skip = UI shell / no entry. */
  run: TreeRunVerdict;
  detail?: string;
  durationMs?: number;
};

/** 216 (T-18): one verdict for a script the emitted project declares for
 *  itself (`package.json` `scripts.typecheck` / `scripts.test` /
 *  `scripts.build`). The script NAME is a constant of this module — never
 *  read from the tree — so no tree content reaches a shell line; the COMMAND
 *  is npm's own, taken verbatim from the emitted package.json and resolved
 *  by npm internally.
 *
 *  `run: "skip"` is NOT a pass: it means the script was not declared, or its
 *  tool is not resolvable for this tree (or — `build` only — the tree's deps
 *  are not installed yet), and `note` says exactly why. Every non-pass
 *  verdict carries the honest reason — never a fabricated pass. */
export type TreeProjectScriptVerdict = {
  /** package.json script name asked for ("typecheck" | "test" | "build"). */
  script: string;
  /** The command string exactly as the emitted package.json declares it. */
  command?: string;
  /** pass = exit 0; fail = non-zero exit; error = spawn/protocol failure;
   *  timeout = killed at the wall-clock cap; skip = never executed (see note). */
  run: TreeRunVerdict;
  /** Process exit code when the script actually ran (null = none reported). */
  exitCode?: number | null;
  /** Bounded combined-output tail — present on any non-pass that produced output. */
  detail?: string;
  durationMs?: number;
  /** Honest reason a `skip`/`error` verdict is not a pass. Present on every
   *  non-pass; never used to soften a red into a green. */
  note?: string;
  /** R11-f02: how the declared script was executed — argv-only when the first
   *  token resolved to a real executable, else the lifecycle-denied npm
   *  fallback; and the standing refusal: model-authored lifecycle scripts
   *  (pre/post hooks, install scripts) are NEVER run by this leg. */
  scriptPolicy?: string;
};

/** 216 (T-18): the emitted project's OWN toolchain verdict — the scripts it
 *  declares for itself. `ok` is true iff no declared script ran red
 *  (fail/timeout/error); an un-runnable one stays a loud `skip` — "absent or
 *  un-runnable" is never a pass and never a silent ok. */
export type TreeProjectScriptsVerdict = {
  ok: boolean;
  typecheck: TreeProjectScriptVerdict;
  test: TreeProjectScriptVerdict;
  /** 217d (T-18): the emitted project's OWN declared `build` script — run
   *  ONLY when the tree's deps are installed (the run copy carries the
   *  subject's `node_modules/`); without them an honest `skip` + the same
   *  UNVERIFIED note an un-runnable toolchain gets, never a fabricated pass.
   *  Optional so fixture objects in other lanes stay assignable; `treeRun()`
   *  always sets it, and a red build makes the tree NOT ok (same rule as a
   *  red typecheck/test). */
  build?: TreeProjectScriptVerdict;
};

export type TreeRunOutcome = {
  /** True only when every compile verdict passes, every spec run passes, the
   *  entry run passes or is an honest UI-shell skip, no declared project
   *  script ran red (216 · T-18) — a tree that fails its own `npm test` can
   *  never be `ok:true`, and a headless skip is never green (185-S5 / 192) —
   *  AND (W43 · J1) the tree's declared `expectedBehavior` contract, when it
   *  declares one, has no FAILED row. */
  ok: boolean;
  /** Normalized absolute SUBJECT dir (never the deleted temp copy). */
  dir: string;
  /** Per-file parse verdicts (compileCheckDir). `compile.dir` is rewritten to
   *  the subject so operators never see the ephemeral `rt-treerun-*` copy. */
  compile: CompileCheckResult;
  /** Per-spec run verdicts (deterministic order: sorted rel paths). */
  tests: TreeSpecVerdict[];
  /** Kind-entry smoke verdict (always present for a runnable dir). */
  run: TreeEntryVerdict | null;
  /** Set when the dir is unreadable, holds no code files, or (216 · T-18) a
   *  declared project script ran red — the top-level reason the tree is not ok. */
  error?: string;
  /** 216 (T-18) + 217d: the emitted project's OWN declared `typecheck`,
   *  `test` + `build` scripts, run under the same bounded runner (real exit
   *  codes + bounded output tails; `build` only once deps are installed).
   *  Optional so fixture objects in other lanes stay assignable; `treeRun()`
   *  always sets it. */
  project?: TreeProjectScriptsVerdict;
  /** 216 (T-18): top-level honest note — set whenever a DECLARED project
   *  script was not executed (its tool is not resolvable without installed
   *  deps), so an ok verdict can never be SILENT about unverified project
   *  tools. A note'd skip is still never a pass. */
  note?: string;
  /** Always false when present. Copy-to-temp + bounded runner is emit-tree
   *  isolation, NOT a security sandbox. Optional so fixture objects in other
   *  lanes stay assignable; treeRun() always sets it. */
  sandbox?: false;
  /** W43 · C6 (fixes/312_c6_ux · 311_sd_product K3/K4): the product-substance
   *  census over the tree's own job modules (`src/jobs/*` + `jobs/*`) — the
   *  SAME classifier `doctor --tree` counts with, so `stubs:N real:M` can
   *  never disagree between the two surfaces. Set by `treeRun()` on every
   *  runnable subject; absent only on the copy-failure early return. */
  substance?: TreeSubstance;
  /** W43 · C6 (311_ma_competitive §5 move 3 — the keyless slice): a stable
   *  FNV-1a hash (same algorithm + decimal-string shape as dod.ts's
   *  `evidenceHash`) over the DECISIVE verdict fields — `ok`, the compile
   *  census, every spec's run label, the entry run, the declared-script
   *  verdicts and the substance census. A downstream consumer can re-run the
   *  tree and re-derive `treeVerdictHash(outcome)`: the same hash means the
   *  machine verdict is unchanged; a different hash means it is not.
   *  Integrity, not cryptography (the repo's standing hash contract). */
  verdictHash?: string;
  /** W43 · J1 (fixes/317_j1_oracle · 316_h5_oracle · T6.3): the tree-declared
   *  behavioral contract verdict — present ONLY when the emitted
   *  `.rapidtool/project.json` declares `expectedBehavior` rows (evaluated by
   *  the shared oracle over the run copy). Absent ⇒ no factor: the outcome
   *  object and `verdictHash` stay byte-identical to the pre-J1 verdict.
   *  Optional so fixture objects in other lanes stay assignable; `treeRun()`
   *  sets it whenever a declaration with rows is present. */
  behavior?: TreeBehaviorVerdict;
};

/** W43 · C6 (fixes/312_c6_ux · 311_sd_product K3/K4) — the product-substance
 *  census a tree-run verdict carries. Green ≠ works: on the keyless floor
 *  every job module is a 12-line `throw … TODO(E-15) stub`, and the emitted
 *  oracle spec asserts those stubs REJECT — so a green tree-run with
 *  `stubs:N real:0` reads as "success" unless the verdict says otherwise.
 *  This object is that "otherwise": counts in the doctor's own classifier
 *  vocabulary, a verdict label, and (when not clean AND job modules exist) a
 *  loud `note` marking the trap and the way out. */
export type TreeSubstanceVerdict = "real" | "mixed" | "stub-skeleton" | "empty";

export type TreeSubstance = {
  /** TODO(E-15)/empty-job-body/throw-TODO modules (doctor.classifyJobSource). */
  stubs: number;
  /** reexport-only bridge modules — bridges, not job implementations. */
  reexports: number;
  /** genuinely implemented job modules. */
  real: number;
  /** Capped sample (doctor's 32-row shape): path (POSIX rel) + class. */
  files: Array<{ path: string; kind: "stub" | "reexport" | "real" }>;
  /** `real` (≥1 real, zero stubs/reexports) · `mixed` (real + leftovers) ·
   *  `stub-skeleton` (job modules exist, none real) · `empty` (no job
   *  modules under `src/jobs/` or `jobs/` — nothing to census). */
  verdict: TreeSubstanceVerdict;
  /** True when THIS verdict is green while the tree still ships stub or
   *  reexport-only job modules (or none real at all): exit 0 must never be
   *  read as product quality (K3). False on a red verdict and on clean/
   *  empty censuses. */
  greenWhileStubbed: boolean;
  /** K4 oracle trap: `tests/oracle.spec.ts` asserts the stub-refusal form
   *  (`assert.rejects(… TODO(E-15) stub)`), so implementing a stubbed seam
   *  turns its oracle row RED until the row's real assertion replaces it. */
  oracleStubTrap: boolean;
  /** The loud marking — present only when the census is NOT clean and job
   *  modules exist (so it can ride `TreeRunOutcome.note` without touching
   *  trees that carry no job-file signal at all). */
  note?: string;
};

/** W43 · J1 (fixes/317_j1_oracle · 316_h5_oracle · T6.3): the tree's OWN
 *  declared behavioral contract — the top-level `expectedBehavior` rows in the
 *  emitted `.rapidtool/project.json` ledger (the same row shape graders
 *  declare), evaluated against the RUN COPY with the SHARED oracle primitive
 *  (`src/lib/entry-oracle.ts`): per-row `file-exists` / `package-target-exists`
 *  / `entry-runs`, where an `entry-runs` row is a REAL bounded spawn
 *  (allowlisted env, row budget, cwd = the run copy) asserting the declared
 *  exit/stdout/stderr — the load-import entry smoke above STAYS; this is the
 *  stronger additive check. `ok = no row failed`; a failed row makes the tree
 *  NOT ok. Present ONLY when the tree actually declares rows: an absent
 *  declaration adds nothing to the outcome (and nothing to `verdictHash`), so
 *  declaration-less trees keep byte-identical verdicts. */
export type TreeBehaviorVerdict = EntryContractRecord & {
  /** Where the declaration was read from — the tree's own ledger. */
  source: ".rapidtool/project.json";
  /** Set when the declaration itself could not be trusted: the shared
   *  `validateExpectedBehavior` refusal text (the same refusal the grader
   *  loader makes — a malformed contract never grades). `ok:false` with zero
   *  evaluated rows; nothing is guessed into a pass. */
  refusal?: string;
};

const DEFAULT_RUN_TIMEOUT_MS = 30_000;
/** How much TAP output the spec wrapper keeps in its JSON envelope. */
const WRAPPER_TAIL_MAX = 6000;
/** How much of a failure tail lands in a verdict detail. */
const VERDICT_TAIL_MAX = 1500;
/** Inner `node --test` spawnSync timeout: the runner's own kill settles a
 *  runaway spec slightly before the outer wall-clock tree-kill fires. */
const INNER_TIMEOUT_MARGIN_MS = 1000;

const SPEC_FILE_RE = /\.(spec|test)\.(ts|mts|cts|js|mjs|cjs)$/i;
const ENTRY_EXTS = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
/** Coarse Project.kind → scaffold taxonomy label (record-first labeling). */
const COARSE_KIND_LABEL: Record<string, string> = {
  app: "webapp",
  tool: "cli-tool",
  game: "game",
};

/** Recursively list emitted spec files (rel paths, sorted) — the files the
 *  scaffold + M2 tree assembly emit under tests/. */
function walkSpecFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    let entries: import("node:fs").Dirent<string>[] = [];
    try {
      entries = readdirSync(current, { withFileTypes: true, encoding: "utf8" });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const full = join(current, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(full);
        continue;
      }
      const rel = relPath(root, full);
      if (!rel.startsWith("tests/")) continue;
      if (SPEC_FILE_RE.test(e.name)) out.push(rel);
    }
  };
  walk(root);
  return out.sort();
}

/**
 * W43 · C6 (fixes/312_c6_ux · 311_sd_product K3): job modules under
 * `src/jobs/` + `jobs/` — the exact file-selection rule
 * `headless.collectJobSources` uses, so the census here agrees with
 * `doctor --tree` row for row (extensions .ts/.js/.mjs at those dirs' top
 * level, POSIX rel paths). Mirrored instead of imported: headless.ts imports
 * THIS module (the repair seam), so importing back would be a cycle — a
 * parity test pins the two implementations to the same file set.
 */
function collectTreeJobSources(root: string): Array<{ path: string; source: string }> {
  const out: Array<{ path: string; source: string }> = [];
  const candidates = [join(root, "src", "jobs"), join(root, "jobs")];
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    let names: string[] = [];
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(".ts") && !name.endsWith(".js") && !name.endsWith(".mjs")) continue;
      const full = join(dir, name);
      try {
        if (!statSync(full).isFile()) continue;
        out.push({
          path: relative(root, full).replace(/\\/g, "/"),
          source: readFileSync(full, "utf8"),
        });
      } catch {
        /* skip unreadable — same best-effort rule as the doctor's census */
      }
    }
  }
  return out;
}

/**
 * W43 · C6 (K4): does the tree's own oracle spec assert the stub-refusal form?
 * Bounded read of the scaffold-reserved `tests/oracle.spec.ts`; true when an
 * `assert.rejects` sits within 400 chars of a `TODO(E-15)` literal — the trap
 * that reddens the moment a stubbed seam is implemented.
 */
function detectOracleStubTrap(root: string): boolean {
  const spec = join(root, "tests", "oracle.spec.ts");
  if (!existsSync(spec)) return false;
  try {
    const source = readFileSync(spec, "utf8").slice(0, 200_000);
    return /assert\.rejects[\s\S]{0,400}?TODO\\?\(E-15\\?\)/.test(source);
  } catch {
    return false;
  }
}

/**
 * W43 · C6 (fixes/312_c6_ux · 311_sd_product K3/K4) — the ONE derivation of a
 * tree-run's product-substance census. Reads only (never writes; never walks
 * node_modules) and never invents a job body. Exported so tests and other
 * consumers derive the same object `treeRun()` attaches to its verdict.
 *
 * `note` is set only when job modules EXIST and the census is not clean — the
 * loud marking for K3 (a green exit 0 on a stub tree) and K4 (the emitted
 * oracle asserts those stubs reject). Trees with no job-file signal at all
 * stay silent: no job modules is not this trap.
 */
export function treeSubstanceOf(dir: string, opts: { green?: boolean } = {}): TreeSubstance {
  const subject = resolve(dir);
  const sources = collectTreeJobSources(subject);
  const inv = inventoryFromJobSources(sources, subject);
  const { stubs, reexports, real } = inv;
  const files = inv.files;
  const verdict: TreeSubstanceVerdict =
    files.length === 0
      ? "empty"
      : real === 0
        ? "stub-skeleton"
        : stubs + reexports === 0
          ? "real"
          : "mixed";
  const green = opts.green === true;
  const greenWhileStubbed = green && files.length > 0 && (stubs > 0 || reexports > 0);
  const oracleStubTrap = files.length > 0 ? detectOracleStubTrap(subject) : false;

  let note: string | undefined;
  if (files.length > 0 && verdict !== "real") {
    const counts = `stubs:${stubs} reexports:${reexports} real:${real}`;
    const what =
      stubs > 0 && real === 0
        ? `every one of the ${files.length} job module(s) is a TODO(E-15) stub or a reexport-only bridge`
        : stubs > 0
          ? `${stubs} of ${files.length} job module(s) are TODO(E-15) stubs`
          : `${reexports} job module(s) are reexport-only bridges`;
    const reading = green
      ? " green here means the emitted files parse and the emitted tests as emitted pass — never that the brief's jobs work"
      : "";
    const trap = oracleStubTrap
      ? " tests/oracle.spec.ts asserts those stub seams REJECT, so implementing them turns those rows RED — replace each stub assertion with the row's real acceptance assertion as you implement (the K4 oracle trap)."
      : "";
    note =
      `SUBSTANCE MARKING (${counts}): ${what} — this tree is NOT product-complete ` +
      `(\`doctor --tree\` shows the same census; K3: exit 0 must never be read as product quality).${reading}${trap}`;
  }

  return { stubs, reexports, real, files, verdict, greenWhileStubbed, oracleStubTrap, ...(note ? { note } : {}) };
}

/**
 * W43 · C6 (311_ma_competitive §5 move 3 — the keyless slice): the stable
 * FNV-1a hash of a tree-run's DECISIVE verdict fields (same hash contract as
 * dod.ts's `evidenceHash` — integrity, not cryptography). Re-run the tree and
 * call this again: the same hash means the machine verdict is unchanged.
 *
 * W43 · J1: the declared-contract factor joins the decisive set ONLY when the
 * tree declares rows (a conditional key — a declaration-less tree's canonical
 * string, and therefore its hash, is byte-identical to the pre-J1 verdict).
 * Prose (`note` / row `detail` / `refusal` text) is not decisive, same
 * doctrine as `compile.error`.
 */
export function treeVerdictHash(outcome: TreeRunOutcome): string {
  const scripts = (["typecheck", "test", "build"] as const).map((key) => {
    const v = outcome.project?.[key];
    return [key, v ? v.run : "absent"];
  });
  const canonical = JSON.stringify({
    ok: outcome.ok === true,
    compile: [
      outcome.compile?.ok === true,
      outcome.compile?.checked ?? 0,
      outcome.compile?.passed ?? 0,
      outcome.compile?.failed ?? 0,
      outcome.compile?.skipped ?? 0,
    ],
    tests: (outcome.tests ?? []).map((t) => [t.file, t.run]),
    run: outcome.run ? [outcome.run.kind ?? null, outcome.run.run, outcome.run.entry ?? null] : null,
    project: outcome.project ? [outcome.project.ok === true, scripts] : null,
    substance: outcome.substance
      ? [outcome.substance.stubs, outcome.substance.reexports, outcome.substance.real, outcome.substance.verdict]
      : null,
    ...(outcome.behavior
      ? {
          behavior: [
            outcome.behavior.ok === true,
            outcome.behavior.declared,
            outcome.behavior.failed,
            outcome.behavior.rows.map((r) => [r.id, r.status]),
          ],
        }
      : {}),
  });
  return String(fnv1a(canonical));
}

/** The runner wrapper that executes one emitted spec as the REAL node:test
 *  runner (`node --test <file>`, strip-types built into Node >= 22) and
 *  reports a compact JSON envelope. Runs CJS-safe (no import statements /
 *  top-level await), exits via process.exitCode so stdout fully drains. */
function specRunnerCode(specAbs: string, innerTimeoutMs: number, cwd: string): string {
  return [
    `const { spawnSync } = require("node:child_process");`,
    `const spec = ${JSON.stringify(specAbs)};`,
    `let r = null;`,
    `let caught = null;`,
    `try {`,
    // 327 (parent): the reporter is pinned to TAP. `parseTapSummary` reads the
    // `# tests/# pass/# fail` summary, which is only emitted by the TAP
    // reporter; the runtime default moved to `spec` on Node 24, so every
    // emitted spec read as "no TAP pass" and every green tree was judged red.
    // Explicit on purpose — the same class as the 327 L3 scripts-leg pin.
    `  r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", spec], {`,
    `    encoding: "utf8",`,
    `    timeout: ${innerTimeoutMs},`,
    `    maxBuffer: 4194304,`,
    `    windowsHide: true,`,
    `    cwd: ${JSON.stringify(cwd)},`,
    `  });`,
    `} catch (e) {`,
    `  caught = String((e && e.message) || e);`,
    `}`,
    `if (caught !== null) {`,
    `  process.stdout.write(JSON.stringify({ kind: "error", error: caught }));`,
    `  process.exitCode = 2;`,
    `} else {`,
    `  const out = [r.stdout || "", r.stderr || ""].join("\\n");`,
    `  const timedOut = !!(r.error && r.error.code === "ETIMEDOUT");`,
    `  process.stdout.write(JSON.stringify({ kind: "done", status: typeof r.status === "number" ? r.status : null, timedOut, tail: out.slice(-${WRAPPER_TAIL_MAX}) }));`,
    `  process.exitCode = typeof r.status === "number" ? r.status : 1;`,
    `}`,
  ].join("\n");
}

/** The runner wrapper that executes ONE kind entry as a top-level dynamic
 *  import (a smoke run — a module whose top-level code throws = fail + tail).
 *  CJS-safe; exits via process.exitCode. */
function entryRunnerCode(entryAbs: string): string {
  return [
    `const { pathToFileURL } = require("node:url");`,
    `const entry = ${JSON.stringify(entryAbs)};`,
    `import(pathToFileURL(entry).href)`,
    `  .then((mod) => {`,
    `    process.stdout.write(JSON.stringify({ kind: "ok", exports: Object.keys(mod || {}).length }));`,
    `    process.exitCode = 0;`,
    `  })`,
    `  .catch((e) => {`,
    `    const msg = String((e && e.stack) || e);`,
    `    process.stdout.write(JSON.stringify({ kind: "error", tail: msg.slice(-${WRAPPER_TAIL_MAX}) }));`,
    `    process.exitCode = 1;`,
    `  });`,
  ].join("\n");
}

/** 216 (T-18): is the declared script executable for THIS tree? A declared
 *  npm script runs with the project's own installed toolchain: the command's
 *  first token resolves via the tree's `node_modules/.bin` (win suffixes
 *  .cmd/.exe/.ps1/.bat); the Node runtime family (`node`/`npm`/`npx`) is the
 *  platform every runner leg already assumes and resolves as the script says.
 *  A GLOBAL install of the same tool is deliberately NOT consulted — it is
 *  not the toolchain the emitted package.json declares, and using it could
 *  mask a missing devDependency on an uninstalled tree (the exact F-02
 *  overclaim class this seam prevents). Deterministic and output-free by
 *  design: a genuinely red script can never be misread as "tool missing"
 *  (which would let a `skip` hide a red). */
const RUNTIME_TOOLS = new Set(["node", "node.exe", "npm", "npm.cmd", "npx", "npx.cmd"]);
function scriptToolResolvable(root: string, command: string): { tool: string; resolvable: boolean } {
  const first = command.trim().split(/\s+/)[0] ?? "";
  const tool = first.replace(/^["']|["']$/g, "");
  if (!tool) return { tool, resolvable: false };
  if (tool.includes("/") || tool.includes("\\")) {
    return { tool, resolvable: existsSync(join(root, tool)) };
  }
  if (RUNTIME_TOOLS.has(tool.toLowerCase())) return { tool, resolvable: true };
  const win = process.platform === "win32";
  const binDir = join(root, "node_modules", ".bin");
  const binExts = win ? [".cmd", ".exe", ".ps1", ".bat", ""] : [""];
  for (const ext of binExts) {
    if (existsSync(join(binDir, tool + ext))) return { tool, resolvable: true };
  }
  return { tool, resolvable: false };
}

/** R11-f02: split a declared script command into argv tokens — quotes group,
 *  whitespace separates, NO expansion. Returns null when the command cannot
 *  be faithfully represented as argv (unbalanced quote) so the caller takes
 *  the lifecycle-denied npm fallback instead of guessing. `shellOps` is set
 *  when an unquoted shell operator (`& | ; < > $ ` + newline) appears — such
 *  a command NEEDS a shell to mean what the tree declared, so it too takes
 *  the fallback (whose argv is a constant, never tree text). */
function splitCommandTokens(command: string): { tokens: string[]; shellOps: boolean } | null {
  const tokens: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  let has = false;
  let shellOps = false;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!;
    if (quote !== null) {
      if (ch === quote) {
        quote = null;
        continue;
      }
      cur += ch;
      has = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (has) {
        tokens.push(cur);
        cur = "";
        has = false;
      }
      continue;
    }
    if (/[&|;<>$`]/.test(ch)) shellOps = true;
    cur += ch;
    has = true;
  }
  if (quote !== null) return null;
  if (has) tokens.push(cur);
  return { tokens, shellOps };
}

/** R11-f02: resolve the declared command's first token to a SPAWNABLE path in
 *  this tree — the node runtime by name, a path-ish token under the root, or
 *  the tree's own `node_modules/.bin` entry (win suffixes; `.exe` preferred
 *  because it spawns argv-only). Null = no toolchain for this token. */
function resolveScriptToolPath(
  root: string,
  first: string,
): { tool: string; path: string; ext: string } | null {
  if (!first) return null;
  if (first.includes("/") || first.includes("\\")) {
    const p = join(root, first);
    return existsSync(p) ? { tool: first, path: p, ext: extname(p).toLowerCase() } : null;
  }
  const lower = first.toLowerCase();
  if (lower === "node" || lower === "node.exe") return { tool: first, path: first, ext: "" };
  const win = process.platform === "win32";
  const binDir = join(root, "node_modules", ".bin");
  const exts = win ? [".exe", ".cmd", ".ps1", ".bat", ""] : [""];
  for (const ext of exts) {
    const p = join(binDir, first + ext);
    if (existsSync(p)) return { tool: first, path: p, ext: ext.toLowerCase() };
  }
  return null;
}

/** The exec plan for ONE declared project script.
 *  - `argv`: run `argv[0] argv[1..]` directly. `shell:false` everywhere the
 *    resolved tool can be spawned argv-only (POSIX bin shims, `.exe`, the
 *    node runtime); a win32 `.cmd`/`.bat`/`.ps1` shim rides a `cmd.exe
 *    /d /s /c` host whose command line is built HERE with every token
 *    double-quoted and `"`/`%`/newline-containing tokens refused (those
 *    cannot be safely represented) — never `shell:true` over tree text.
 *  - fallback (`shell:true`): `npm run <script> --ignore-scripts` — a
 *    CONSTANT argv, and pre/post lifecycle hooks are denied.
 *  `via` is recorded on the verdict so the refusal/route is auditable. */
function planScriptExec(root: string, script: string, raw: string): ScriptExecPlan {
  const parsed = splitCommandTokens(raw);
  const LIFECYCLE =
    "lifecycle scripts denied — the tree's pre/post hooks and install scripts never run in this leg";
  if (parsed !== null && parsed.tokens.length > 0 && !parsed.shellOps) {
    const [first, ...rest] = parsed.tokens;
    const tool = resolveScriptToolPath(root, first!);
    if (tool !== null) {
      if (tool.ext === "" || tool.ext === ".exe") {
        return {
          argv: [tool.path, ...rest],
          shell: false,
          via: `argv-only · ${tool.tool}${tool.ext} (no shell) — ${LIFECYCLE}`,
        };
      }
      if (process.platform === "win32" && (tool.ext === ".cmd" || tool.ext === ".bat" || tool.ext === ".ps1")) {
        const unsafe = (s: string): boolean => /["%\r\n]/.test(s);
        if (!unsafe(tool.path) && rest.every((a) => !unsafe(a))) {
          const q = (s: string): string => `"${s}"`;
          const line = `"${[q(tool.path), ...rest.map(q)].join(" ")}"`;
          return {
            argv: [process.env.ComSpec || "cmd.exe", "/d", "/s", "/c", line],
            shell: false,
            verbatim: true,
            via: `argv-only · ${tool.tool}${tool.ext} via cmd.exe host (no outer shell) — ${LIFECYCLE}`,
          };
        }
        return {
          argv: ["npm", "run", script, "--ignore-scripts"],
          shell: true,
          via: `npm run ${script} --ignore-scripts (the declared args cannot be safely argv-spawned on win32) — ${LIFECYCLE}`,
        };
      }
    }
  }
  return {
    argv: ["npm", "run", script, "--ignore-scripts"],
    shell: true,
    via: `npm run ${script} --ignore-scripts (shell form) — ${LIFECYCLE}`,
  };
}

type ScriptExecPlan = { argv: string[]; shell: boolean; verbatim?: boolean; via: string };

/** R11-f02: the runner wrapper that executes ONE declared project script from
 *  an APPROVED exec plan — argv-only where the plan resolved a real
 *  executable (`shell:false`), or the lifecycle-denied npm fallback whose
 *  argv is a constant. Same bounded-runner contract as before: CJS-safe,
 *  inner timeout + maxBuffer, compact JSON envelope on stdout, exit via
 *  process.exitCode. No plan ever passes tree text to a shell. */
function projectScriptRunnerCode(plan: ScriptExecPlan, cwd: string, innerTimeoutMs: number): string {
  return [
    `const { spawnSync } = require("node:child_process");`,
    `const argv = ${JSON.stringify(plan.argv)};`,
    `let r = null;`,
    `let caught = null;`,
    `try {`,
    `  r = spawnSync(argv[0], argv.slice(1), {`,
    `    encoding: "utf8",`,
    `    timeout: ${innerTimeoutMs},`,
    `    maxBuffer: 4194304,`,
    `    windowsHide: true,`,
    `    shell: ${plan.shell ? "true" : "false"},`,
    `    windowsVerbatimArguments: ${plan.verbatim === true ? "true" : "false"},`,
    `    cwd: ${JSON.stringify(cwd)},`,
    `  });`,
    `} catch (e) {`,
    `  caught = String((e && e.message) || e);`,
    `}`,
    `if (caught !== null) {`,
    `  process.stdout.write(JSON.stringify({ kind: "error", error: caught }));`,
    `  process.exitCode = 2;`,
    `} else {`,
    `  const out = [r.stdout || "", r.stderr || ""].join("\\n");`,
    `  const timedOut = !!(r.error && r.error.code === "ETIMEDOUT");`,
    `  const spawnErr = r.error && !timedOut ? String(r.error.message || r.error.code) : null;`,
    `  process.stdout.write(JSON.stringify({ kind: "done", status: typeof r.status === "number" ? r.status : null, timedOut, spawnErr, tail: out.slice(-${WRAPPER_TAIL_MAX}) }));`,
    `  process.exitCode = typeof r.status === "number" ? r.status : 1;`,
    `}`,
  ].join("\n");
}

/** Parse the wrapper's JSON envelope off the runner stdout (the envelope is
 *  written LAST, so the runner's 1MB output slice keeps it). */
function parseWrapperEnvelope(stdout: string): {
  kind: string;
  status?: number | null;
  timedOut?: boolean;
  tail?: string;
  error?: string;
  spawnErr?: string;
} | null {
  const text = typeof stdout === "string" ? stdout : "";
  const start = text.lastIndexOf('{"kind":');
  if (start < 0) return null;
  try {
    const parsed = JSON.parse(text.slice(start)) as Record<string, unknown>;
    if (parsed.kind !== "done" && parsed.kind !== "ok" && parsed.kind !== "error") return null;
    return parsed as { kind: string; status?: number | null; timedOut?: boolean; tail?: string; error?: string; spawnErr?: string };
  } catch {
    return null;
  }
}

/** node:test TAP summary counts ("# tests/# pass/# fail/# cancelled/# skipped"). */
function parseTapSummary(tap: string): {
  tests: number;
  pass: number;
  fail: number;
  cancelled: number;
  skipped: number;
} | null {
  const num = (label: string): number | null => {
    const m = new RegExp(`^# ${label} (\\d+)$`, "m").exec(tap);
    return m ? parseInt(m[1], 10) : null;
  };
  const tests = num("tests");
  const pass = num("pass");
  const fail = num("fail");
  if (tests === null || pass === null || fail === null) return null;
  return {
    tests,
    pass,
    fail,
    cancelled: num("cancelled") ?? 0,
    skipped: num("skipped") ?? 0,
  };
}

/**
 * A3: Node's TAP summary counts TESTS, not assertions (`test("load", () => {})`
 * prints `# pass 1` with zero asserts). A behavioral pass requires at least one
 * `assert.*` call in the spec source. Comments AND string literals are
 * stripped first (maskLiteralsAndComments) so a commented-out or
 * string-quoted assert cannot mint green.
 */
function specSourceHasAssert(source: string): boolean {
  const stripped = maskLiteralsAndComments(typeof source === "string" ? source : "");
  return /\bassert\s*\.\s*[A-Za-z]/.test(stripped) || /\bassert\s*\(/.test(stripped);
}

/** Extract a readable failure tail for the FIRST failing test from TAP
 *  output: the failing test/file name + its assertion message block + any
 *  trailing `# <ErrorClass>` diagnostic. Bounded. */
function tapFailureTail(tap: string, max = VERDICT_TAIL_MAX): string {
  const m = /^not ok \d+ - (.+)$/m.exec(tap);
  if (!m) return "";
  const name = m[1].trim();
  const rest = tap.slice(m.index);
  const parts: string[] = [];
  const errIdx = rest.search(/^\s{2}error: /m);
  if (errIdx >= 0) {
    const after = rest.slice(errIdx);
    const close = after.search(/\n\s{2}\.\.\.\n/);
    const block = close > 0 ? after.slice(0, close) : after.split("\n").slice(0, 40).join("\n");
    const lines = block
      .split("\n")
      .slice(1) // drop the "  error: |-" marker line itself
      .map((l) => l.replace(/^ {4}/, "").trimEnd())
      .filter(
        (l) =>
          l.trim().length > 0 &&
          !/^\s{2,}(duration_ms|type:|failureType:|operator:|code:|actual:|expected:|stack:|location:)/.test(l),
      );
    if (lines.length) parts.push(lines.join("\n").trim());
  }
  const diag = /^# (.+(?:Error|exception)[^\n]*)$/m.exec(rest);
  if (diag) parts.push(diag[1].trim());
  const joined = [`test "${name}" failed`, ...parts].join("\n").trim();
  return (joined || rest.slice(0, 400).trim()).slice(0, max);
}

/** Run ONE emitted spec under the bounded runner and return its verdict. */
async function runSpecFile(
  dir: string,
  rel: string,
  compile: CompileFileVerdict | undefined,
  timeoutMs: number,
): Promise<TreeSpecVerdict> {
  const started = Date.now();
  const duration = (): number => Date.now() - started;
  const abs = join(dir, rel);
  const innerTimeout = Math.max(500, timeoutMs - INNER_TIMEOUT_MARGIN_MS);
  const base: TreeSpecVerdict = {
    file: rel,
    compile: compile?.verdict ?? "fail",
    tests: { pass: 0, fail: 0 },
    run: "error",
    durationMs: 0,
  };
  const run = await runNodeBounded(specRunnerCode(abs, innerTimeout, dir), { timeoutMs });
  if (!run.ok) {
    if (run.reason === "timeout") {
      return { ...base, run: "timeout", detail: `spec killed after ${timeoutMs / 1000}s`, durationMs: duration() };
    }
    if (run.reason === "not-configured") {
      return { ...base, run: "error", detail: `${run.code}: local bounded runner unavailable`, durationMs: duration() };
    }
    return { ...base, run: "error", detail: run.error ?? run.reason, durationMs: duration() };
  }
  const env = parseWrapperEnvelope(run.stdout);
  if (!env) {
    return { ...base, run: "error", detail: "runner produced no parseable envelope", durationMs: duration() };
  }
  if (env.kind === "error") {
    return { ...base, run: "error", detail: (env.error ?? "spec runner failed").slice(0, VERDICT_TAIL_MAX), durationMs: duration() };
  }
  const tap = env.tail ?? "";
  const summary = parseTapSummary(tap);
  const tests = summary ? { pass: summary.pass, fail: summary.fail } : { pass: 0, fail: 0 };
  if (env.timedOut) {
    return { ...base, tests, run: "timeout", detail: `spec killed after ${innerTimeout / 1000}s (inner --test timeout)`, durationMs: duration() };
  }
  const status = typeof env.status === "number" ? env.status : 1;
  if (status === 0) {
    // A3: TAP `# pass 1` on a load-only / empty / skip-only spec is NOT green.
    let source = "";
    try {
      source = readFileSync(abs, "utf8");
    } catch {
      source = "";
    }
    const noAssert = !specSourceHasAssert(source);
    const noTapPass = !summary || summary.pass === 0 || summary.tests === 0;
    if (noAssert || noTapPass) {
      return {
        ...base,
        tests: { pass: 0, fail: tests.fail },
        run: "fail",
        detail: "no behavioral assertion ran",
        durationMs: duration(),
      };
    }
    return { ...base, tests, run: "pass", durationMs: duration() };
  }
  const tail = tapFailureTail(tap) || tap.slice(-600).trim() || `spec exited ${status}`;
  const cancelled = summary && summary.cancelled > 0 ? ` (${summary.cancelled} cancelled)` : "";
  return { ...base, tests, run: "fail", detail: `${tail.slice(0, VERDICT_TAIL_MAX)}${cancelled}`, durationMs: duration() };
}

/** Reject traversal/absolute/unsupported-extension module paths. */
function sanitizeRelPath(p: unknown): string | null {
  if (typeof p !== "string") return null;
  const norm = p.split("\\").join("/").trim();
  if (!norm || norm.startsWith("/") || /^[A-Za-z]:/.test(norm)) return null;
  if (norm.split("/").some((seg) => seg === ".." || seg === "." || !seg)) return null;
  const ext = norm.slice(norm.lastIndexOf(".")).toLowerCase();
  if (!ENTRY_EXTS.has(ext)) return null;
  return norm;
}

function readJsonIfAny(dir: string, rel: string): Record<string, unknown> | null {
  try {
    const full = join(dir, rel);
    if (!existsSync(full)) return null;
    const parsed = JSON.parse(readFileSync(full, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** W43 · J1 (fixes/317_j1_oracle · 316_h5_oracle · T6.3): tree-relative path
 *  guard for the behavior leg's fs reads — rejects absolute/drive-letter
 *  paths and `.`/`..`/empty segments so a declared row can never read outside
 *  the run copy (the eval side matches a manifest, which cannot escape; this
 *  is the fs-side equivalent). Returns the normalized path when safe, else
 *  null ⇒ the row reports "not emitted", never a false pass. */
function treeRelPath(p: unknown): string | null {
  if (typeof p !== "string") return null;
  const norm = p.split("\\").join("/").trim();
  if (!norm || norm.startsWith("/") || /^[A-Za-z]:/.test(norm)) return null;
  if (norm.split("/").some((seg) => seg === ".." || seg === "." || !seg)) return null;
  return norm;
}

/** W43 · J1 (fixes/317_j1_oracle · 316_h5_oracle · T6.3): evaluate the tree's
 *  OWN declared `expectedBehavior` contract — the top-level rows in the
 *  emitted `.rapidtool/project.json` ledger, the same shape graders declare —
 *  against the run copy with the SHARED oracle primitive
 *  (`src/lib/entry-oracle.ts`, one truth with the eval side). `undefined` (no
 *  declaration) ⇒ null (no factor, byte-stable). A declared-but-malformed row
 *  set is REFUSED with the shared validator's own refusal text (the same
 *  refusal the grader loader makes) — never silently ignored. Rows evaluate
 *  over guarded fs reads (file-only) and, for `entry-runs`, REAL bounded
 *  spawns (allowlisted env, row budget clamp, cwd = the run copy). Reads +
 *  spawns only; never writes. */
function treeBehaviorOf(dir: string): TreeBehaviorVerdict | null {
  const declared = readJsonIfAny(dir, ".rapidtool/project.json")?.expectedBehavior;
  if (declared === undefined) return null;
  const source = ".rapidtool/project.json" as const;
  const validated = validateExpectedBehavior(declared);
  if (!validated.ok) {
    return {
      source,
      declared: 0,
      rows: [],
      passed: 0,
      failed: 0,
      pending: 0,
      uiShell: 0,
      ok: false,
      complete: true,
      note: validated.error,
      refusal: validated.error,
    };
  }
  if (validated.rows.length === 0) return null;
  const has = (p: string): boolean => {
    const rel = treeRelPath(p);
    if (rel === null) return false;
    try {
      return statSync(join(dir, rel)).isFile();
    } catch {
      return false;
    }
  };
  return { source, ...checkEntryContract(validated.rows, dir, has, (rel) => (has(rel) ? rel : null)) };
}

/**
 * Resolve the kind-entry for a run: UI-shell kinds (root index.html = the
 * scaffold's webapp/game vite boot shell) are an honest skip; headless kinds
 * resolve package.json "main", else the first job-* module of the emitted
 * .rapidtool/project.json spec graph (the tree's core / generated-source
 * host), else src/generated.ts when the record carries generatedSource.
 * Never guesses: no resolvable entry ⇒ skip with the reason.
 */
function resolveEntry(dir: string): { entry: string | null; kind: string; reason?: string } {
  const record = readJsonIfAny(dir, ".rapidtool/project.json");
  const coarse = typeof record?.kind === "string" && COARSE_KIND_LABEL[record.kind] ? (record.kind as string) : "";
  const label = coarse ? COARSE_KIND_LABEL[coarse] : "";
  if (existsSync(join(dir, "index.html"))) {
    // Structural UI-shell skip — record kind (app→webapp, game, …) must NOT
    // leak into `kind`, because entryGreen is `skip && kind === "ui-shell"`.
    return { entry: null, kind: "ui-shell", reason: "UI shell — not executable headless" };
  }
  const headlessLabel = label || "headless";
  const pkg = readJsonIfAny(dir, "package.json");
  const main = typeof pkg?.main === "string" ? sanitizeRelPath(pkg.main) : null;
  if (main) {
    const full = join(dir, main);
    if (existsSync(full) && statSync(full).isFile()) return { entry: main, kind: headlessLabel };
  }
  const sg = record && typeof record.specGraph === "object" && record.specGraph !== null ? (record.specGraph as Record<string, unknown>) : null;
  const nodes = Array.isArray(sg?.nodes) ? (sg.nodes as Record<string, unknown>[]).filter((n) => n && typeof n === "object") : [];
  const order = Array.isArray(sg?.order) ? (sg.order as unknown[]).filter((id): id is string => typeof id === "string") : [];
  const byId = new Map(nodes.map((n) => [String(n.id), n]));
  const orderedNodes: Record<string, unknown>[] = [];
  for (const id of order) {
    const n = byId.get(id);
    if (n) orderedNodes.push(n);
  }
  for (const n of nodes) {
    if (!orderedNodes.includes(n)) orderedNodes.push(n);
  }
  for (const n of orderedNodes) {
    if (typeof n.id !== "string" || !n.id.startsWith("job-")) continue;
    const cand = sanitizeRelPath(n.file);
    if (!cand) continue;
    const full = join(dir, cand);
    if (existsSync(full) && statSync(full).isFile()) return { entry: cand, kind: headlessLabel };
  }
  if (typeof record?.generatedSource === "string" && record.generatedSource.trim().length > 0) {
    const cand = "src/generated.ts";
    const full = join(dir, cand);
    if (existsSync(full) && statSync(full).isFile()) return { entry: cand, kind: headlessLabel };
  }
  return {
    entry: null,
    kind: headlessLabel,
    reason:
      "no package.json main and no job-* module in .rapidtool/project.json — the scaffold emitted no headless entry to smoke-run",
  };
}

/** Execute ONE kind-entry module under the bounded runner (import smoke). */
async function runEntryFile(dir: string, rel: string, kind: string, timeoutMs: number): Promise<TreeEntryVerdict> {
  const started = Date.now();
  const duration = (): number => Date.now() - started;
  const abs = join(dir, rel);
  const base: TreeEntryVerdict = { kind, entry: rel, run: "error", durationMs: 0 };
  const run = await runNodeBounded(entryRunnerCode(abs), { timeoutMs });
  if (!run.ok) {
    if (run.reason === "timeout") {
      return { ...base, run: "timeout", detail: `entry smoke killed after ${timeoutMs / 1000}s`, durationMs: duration() };
    }
    if (run.reason === "not-configured") {
      return { ...base, run: "error", detail: `${run.code}: local bounded runner unavailable`, durationMs: duration() };
    }
    return { ...base, run: "error", detail: run.error ?? run.reason, durationMs: duration() };
  }
  const env = parseWrapperEnvelope(run.stdout);
  if (!env) {
    return { ...base, run: "error", detail: "runner produced no parseable envelope", durationMs: duration() };
  }
  if (env.kind === "ok") {
    return { ...base, run: "pass", durationMs: duration() };
  }
  const detail = (env.tail ?? env.error ?? "entry module load failed").trim();
  return { ...base, run: "fail", detail: detail.slice(0, VERDICT_TAIL_MAX), durationMs: duration() };
}

/** 216 (T-18): run ONE declared project script under the bounded runner. Never
 *  fabricates a pass: every path that did not produce exit 0 is a `fail`,
 *  `timeout` or `error` (red), or a loud `skip` with a `note` (never executed
 *  — not declared, or its tool is not resolvable for this tree). */
async function runProjectScript(
  root: string,
  script: string,
  scripts: Record<string, unknown> | null,
  timeoutMs: number,
): Promise<TreeProjectScriptVerdict> {
  const started = Date.now();
  const duration = (): number => Date.now() - started;
  const base: TreeProjectScriptVerdict = { script, run: "skip", durationMs: 0 };
  if (scripts === null) {
    return {
      ...base,
      note: `the emitted tree has no package.json "scripts" block — "${script}" was not declared, nothing ran (absent is not a pass)`,
    };
  }
  const raw = typeof scripts[script] === "string" ? scripts[script].trim() : "";
  if (!raw) {
    return { ...base, note: `the emitted package.json declares no "${script}" script — nothing ran (absent is not a pass)` };
  }
  const { tool, resolvable } = scriptToolResolvable(root, raw);
  if (!resolvable) {
    return {
      ...base,
      command: raw,
      note:
        `the declared "${script}" tool \`${tool}\` has no node_modules/.bin entry in this tree (and is not the node/npm runtime) — ` +
        `"npm run ${script}" was NOT executed; the tree's own ${script} is UNVERIFIED (npm install, then re-run to verify) — not a fabricated pass`,
    };
  }
  const innerTimeout = Math.max(500, timeoutMs - INNER_TIMEOUT_MARGIN_MS);
  const plan = planScriptExec(root, script, raw);
  const run = await runNodeBounded(projectScriptRunnerCode(plan, root, innerTimeout), { timeoutMs });
  if (!run.ok) {
    if (run.reason === "timeout") {
      return { ...base, command: raw, scriptPolicy: plan.via, run: "timeout", detail: `${script} script killed after ${timeoutMs / 1000}s`, durationMs: duration() };
    }
    if (run.reason === "not-configured") {
      return { ...base, command: raw, scriptPolicy: plan.via, run: "error", detail: `${run.code}: local bounded runner unavailable`, durationMs: duration() };
    }
    return { ...base, command: raw, scriptPolicy: plan.via, run: "error", detail: run.error ?? run.reason, durationMs: duration() };
  }
  const env = parseWrapperEnvelope(run.stdout);
  if (!env) {
    return { ...base, command: raw, scriptPolicy: plan.via, run: "error", detail: "runner produced no parseable envelope", durationMs: duration() };
  }
  if (env.kind === "error") {
    return { ...base, command: raw, scriptPolicy: plan.via, run: "error", detail: (env.error ?? "npm script runner failed").slice(0, VERDICT_TAIL_MAX), durationMs: duration() };
  }
  const tail = (env.tail ?? "").trim();
  if (env.spawnErr) {
    return { ...base, command: raw, scriptPolicy: plan.via, run: "error", detail: `spawn failed: ${env.spawnErr}`.slice(0, VERDICT_TAIL_MAX), durationMs: duration() };
  }
  if (env.timedOut) {
    return { ...base, command: raw, scriptPolicy: plan.via, run: "timeout", detail: `${script} script killed after ${innerTimeout / 1000}s (inner timeout)`, durationMs: duration() };
  }
  const exitCode = typeof env.status === "number" ? env.status : 1;
  if (exitCode === 0) return { ...base, command: raw, scriptPolicy: plan.via, run: "pass", exitCode: 0, durationMs: duration() };
  return {
    ...base,
    command: raw,
    scriptPolicy: plan.via,
    run: "fail",
    exitCode,
    detail: (tail || `the declared "${script}" script exited ${exitCode}`).slice(0, VERDICT_TAIL_MAX),
    durationMs: duration(),
  };
}

/** 216 (T-18) + 217d: the project leg — resolve + run the declared
 *  `typecheck`/`test`/`build` scripts in the temp copy, and classify the
 *  results for the tree verdict: `red` = at least one declared script ran
 *  fail/timeout/error (→ the tree is NOT ok); `skippedDeclared` = declared
 *  but never executed (→ loud top-level note). */
async function runProjectScripts(
  work: string,
  timeoutMs: number,
): Promise<{
  verdict: TreeProjectScriptsVerdict;
  red: TreeProjectScriptVerdict[];
  skippedDeclared: TreeProjectScriptVerdict[];
}> {
  const pkg = readJsonIfAny(work, "package.json");
  const scripts =
    pkg && typeof pkg.scripts === "object" && pkg.scripts !== null
      ? (pkg.scripts as Record<string, unknown>)
      : null;
  const typecheck = await runProjectScript(work, "typecheck", scripts, timeoutMs);
  const test = await runProjectScript(work, "test", scripts, timeoutMs);
  // 217d (T-18): the declared `build` runs ONLY when the tree's deps are
  // installed (the temp copy carries the subject's node_modules/). Without
  // them `npm run build` could only fail for the wrong reason on an
  // uninstalled tree (the 216x §2.1 "vite is not recognized" class) — so it
  // stays the honest skip in the exact UNVERIFIED wording an un-runnable
  // toolchain gets, never a fabricated pass.
  const buildRaw = typeof scripts?.build === "string" ? scripts.build.trim() : "";
  const build: TreeProjectScriptVerdict =
    buildRaw === "" || existsSync(join(work, "node_modules"))
      ? await runProjectScript(work, "build", scripts, timeoutMs)
      : {
          script: "build",
          run: "skip",
          command: buildRaw,
          durationMs: 0,
          note:
            `no node_modules/ present in the tree — "npm run build" was NOT executed; ` +
            "the tree's own build is UNVERIFIED (npm install, then re-run to verify) — not a fabricated pass",
        };
  const all = [typecheck, test, build];
  const red = all.filter((v) => v.run === "fail" || v.run === "timeout" || v.run === "error");
  const skippedDeclared = all.filter((v) => v.run === "skip" && typeof v.command === "string");
  return { verdict: { ok: red.length === 0, typecheck, test, build }, red, skippedDeclared };
}

/**
 * Run the emitted tree in-loop on a TEMP COPY (174-F8 / Phase F): the live
 * emit dir is never the cwd of node --test or the entry smoke. Read-only
 * over the subject `dir`; copy is always deleted. Never fabricates a pass.
 *
 * 216 (T-18) + 217d: additionally runs the emitted project's OWN declared
 * `typecheck`/`test` scripts (`npm run <script>`) in the temp copy under the
 * same bounded runner, plus the declared `build` once the tree's deps are
 * installed. A declared script that ran red makes the tree NOT ok — a tree
 * failing its own `npm test` or its own build can never be `ok:true`; a
 * declared script that could not run is a loud `skip` + note, never a
 * fabricated pass.
 */
export async function treeRun(dir: string, opts?: { timeoutMs?: number }): Promise<TreeRunOutcome> {
  const timeoutMs =
    typeof opts?.timeoutMs === "number" && opts.timeoutMs > 0 ? opts.timeoutMs : DEFAULT_RUN_TIMEOUT_MS;
  const subject = resolve(dir);
  let work = subject;
  let copy: string | null = null;
  let scratchCleanupFailed = false;
  const cleanScratch = (): void => {
    if (!copy) return;
    try {
      rmSync(copy, { recursive: true, force: true });
      copy = null;
    } catch {
      scratchCleanupFailed = true; // Windows locks: the dir may outlive this call
    }
  };
  /** R12-f03: cleanup + the honest note ride EVERY return, so a leaked
   *  scratch dir is never silent. */
  const finish = (outcome: TreeRunOutcome): TreeRunOutcome => {
    cleanScratch();
    if (scratchCleanupFailed) {
      outcome.note = `${outcome.note ? `${outcome.note} · ` : ""}the temp scratch copy could not be removed (a process may still hold a file in ${work}) — the dir is safe to delete once that process exits`;
    }
    return outcome;
  };
  try {
    copy = mkdtempSync(join(tmpdir(), "rt-treerun-"));
    if (existsSync(subject) && statSync(subject).isDirectory()) {
      // R12-f03: never deep-copy the dep tree or VCS metadata into %TEMP% —
      // the same skip-set verifyKindDir already uses. A duplicated
      // node_modules was the #1 disk/IO hog on this box and its locked files
      // are what made the cleanup rmSync silently leave temp dirs behind. The
      // tree's own toolchain stays available through a JUNCTION to the
      // subject's node_modules (a directory-level hardlink seam — zero bytes
      // copied); when the junction cannot be created, the declared scripts
      // fall back to their existing honest UNVERIFIED skip notes.
      const skip = new Set([join(subject, "node_modules"), join(subject, ".git")]);
      cpSync(subject, copy, { recursive: true, filter: (src) => !skip.has(src) });
      const subjectDeps = join(subject, "node_modules");
      if (existsSync(subjectDeps)) {
        try {
          symlinkSync(subjectDeps, join(copy, "node_modules"), "junction");
        } catch {
          /* honest fallback: no deps in the run copy → declared scripts skip */
        }
      }
    } else {
      rmSync(copy, { recursive: true, force: true });
      copy = null;
    }
    if (copy) work = copy;
  } catch (err) {
    if (copy) {
      try {
        rmSync(copy, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    return {
      ok: false,
      dir: subject,
      sandbox: false,
      compile: {
        ok: false,
        dir: subject,
        checked: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        verdicts: [],
        error: `treeRun: could not copy subject (${err instanceof Error ? err.message : String(err)})`,
      },
      tests: [],
      run: null,
      error: "treeRun copy-to-temp failed — live emit dir was not used as the subject",
    };
  }
  try {
    const compileRaw = compileCheckDir(work);
    // Operator-facing dir is the SUBJECT, never the deleted temp copy.
    const compile: CompileCheckResult = { ...compileRaw, dir: subject };
    const outcome: TreeRunOutcome = { ok: false, dir: subject, sandbox: false, compile, tests: [], run: null };
    if (compile.error) {
      outcome.error = compile.error;
      return outcome;
    }
    const compileByFile = new Map(compile.verdicts.map((v) => [v.file, v]));
    for (const rel of walkSpecFiles(work)) {
      outcome.tests.push(await runSpecFile(work, rel, compileByFile.get(rel), timeoutMs));
    }
    const entry = resolveEntry(work);
    if (entry.entry) {
      outcome.run = await runEntryFile(work, entry.entry, entry.kind, timeoutMs);
    } else {
      outcome.run = { kind: entry.kind, run: "skip", detail: entry.reason };
    }
    // 216 (T-18) + 217d: the emitted project's OWN toolchain — `npm run
    // typecheck`, `npm test` and (deps permitting) the declared `build`
    // exactly as the tree declares them. ADDITIVE to the parse/spec/entry
    // verdicts above; a declared script that ran red makes the tree NOT ok
    // ("a tree failing its own npm test can never be ok"), and a
    // declared-but-un-runnable script is a loud skip + note — never a
    // fabricated pass and never a silent ok.
    const projectLeg = await runProjectScripts(work, timeoutMs);
    outcome.project = projectLeg.verdict;
    if (projectLeg.red.length > 0) {
      outcome.error = projectLeg.red
        .map(
          (v) =>
            `the emitted project's own \`npm run ${v.script}\` ${v.run}` +
            (typeof v.exitCode === "number" ? ` (exit ${v.exitCode})` : "") +
            (v.detail ? ` — ${v.detail.slice(0, 300)}` : ""),
        )
        .join("; ")
        .slice(0, 1800);
    } else if (projectLeg.skippedDeclared.length > 0) {
      outcome.note = (
        `the emitted project's own ${projectLeg.skippedDeclared
          .map((v) => `\`npm run ${v.script}\``)
          .join(" / ")} ${projectLeg.skippedDeclared.length === 1 ? "was" : "were"} NOT executed — ` +
        `the tree's own tools are UNVERIFIED (not a pass): ${projectLeg.skippedDeclared
          .map((v) => v.note ?? "un-runnable")
          .join(" · ")}`
      ).slice(0, 1800);
    }
    // W43 · J1 (fixes/317_j1_oracle · 316_h5_oracle · T6.3 · 311_sd_product
    // K3/K4): the tree's OWN declared `expectedBehavior` contract — the
    // top-level rows in the emitted `.rapidtool/project.json` ledger, the same
    // row shape graders declare — evaluated with the SHARED oracle primitive
    // over the run copy. ADDITIVE to the load-import entry smoke above (which
    // STAYS): an `entry-runs` row is a REAL bounded spawn asserting the
    // declared exit/stdout/stderr, so a tree whose entry DECLARES expected
    // behavior but PRODUCES WRONG OUTPUT can no longer exit 0. Absent
    // declaration ⇒ no factor (nothing new in the outcome, nothing new in
    // `treeVerdictHash`); a refused (malformed) declaration is red.
    const behavior = treeBehaviorOf(work);
    if (behavior) {
      outcome.behavior = behavior;
      if (!behavior.ok) {
        const firstFail = behavior.rows.find((r) => r.status === "fail");
        const why = firstFail
          ? `the tree's declared expectedBehavior contract FAILED (${behavior.source}): ${firstFail.id} — ${firstFail.detail}`
          : `the tree's declared expectedBehavior contract was REFUSED (${behavior.source}): ${behavior.refusal ?? "malformed declaration"}`;
        const combined = outcome.error ? `${outcome.error} · ${why}` : why;
        outcome.error = combined.slice(0, 1800);
      }
    }
    const specsGreen = outcome.tests.length === 0 || outcome.tests.every((t) => t.run === "pass");
    // Fail-closed: missing entry verdict is NOT green. Headless skip is NOT
    // green. Only an executed pass or a structural UI-shell skip counts.
    // W43 · J1: a declared contract's failed/refused rows are NOT green either.
    const entryGreen =
      !!outcome.run &&
      (outcome.run.run === "pass" ||
        (outcome.run.run === "skip" && outcome.run.kind === "ui-shell"));
    outcome.ok =
      compile.ok && specsGreen && entryGreen && projectLeg.verdict.ok && (outcome.behavior?.ok ?? true);
    // W43 · C6 (fixes/312_c6_ux · 311_sd_product K3/K4): the substance census
    // rides every runnable verdict, and a non-clean census over an EXISTING
    // job-file set joins the top-level note — so a green tree-run whose job
    // modules are TODO(E-15) stubs can never read as "the product works".
    // Trees without a job-file signal get the census but stay note-silent.
    outcome.substance = treeSubstanceOf(subject, { green: outcome.ok });
    if (outcome.substance.note) {
      outcome.note = outcome.note ? `${outcome.note} · ${outcome.substance.note}` : outcome.substance.note;
    }
    outcome.verdictHash = treeVerdictHash(outcome);
    return finish(outcome);
  } finally {
    // Safety net for a throw out of the work block — finish() already cleaned
    // on every normal return path.
    cleanScratch();
  }
}

// ---------------------------------------------------------------------------
// 216z (T4.1 / TA-16) — the `emit --verify-kind` leg.
//
// fixes/149 P1-2 / 104 §T4.1: webapp/game scaffolds DECLARE a `build` script
// (vite build) but nothing ever installed the tree's declared dependencies, so
// a fresh emit's declared build could never actually run — the C7 criterion
// ("no webapp emission has ever built") stayed open. The leg now, in a FRESH
// SCRATCH COPY (the subject dir is never written, never npm's cwd):
//
//   1. copy the emitted dir to a temp scratch dir — the tree's own top-level
//      node_modules/.git are NOT copied (the install is the source of truth,
//      not a stale dependency tree);
//   2. install with `npm ci --no-audit --no-fund` when the copy carries a
//      package-lock.json, else `npm install --no-audit --no-fund`; the
//      envelope's `install.tool`/`install.reason` say which ran and why;
//   3. run the tree's OWN declared `build` + `test` scripts in that copy
//      (the same bounded-runner seam treeRun's project leg uses; script names
//      are module constants — npm reads the command from the tree's own
//      package.json);
//   4. delete the copy (always, in a finally).
//
// Never fabricates a pass: an install or script that did not exit 0 is
// fail/timeout/error with a bounded tail and `code: RT_E_VERIFY_KIND_FAILED`;
// a red install short-circuits the scripts (marked `skip` + the exact reason,
// never silently absent); a skip is only ever emitted WITH its reason, and a
// skip is never a pass. The DEFAULT suite never hits the network — tests
// inject the install command via `opts.installCommand` (marked `mocked: true`
// in the envelope; a mocked install is never evidence of a real one) and the
// real npm path is gated behind RT_VERIFYKIND_INSTALL=1 in the test file.
// ---------------------------------------------------------------------------

/** 216z (T4.1 / TA-16): one step of the verify-kind leg — `install` (the
 *  scratch-copy npm ci/install) or `build`/`test` (the tree's own declared
 *  scripts, run in that copy). Same verdict vocabulary as treeRun's legs.
 *  `run: "skip"` is NOT a pass — the step was not executed and `note` says
 *  exactly why. */
export type VerifyKindStepVerdict = {
  step: "install" | "build" | "test";
  /** The exact command line executed in the scratch copy. */
  command?: string;
  run: TreeRunVerdict;
  exitCode?: number | null;
  /** Bounded combined-output tail — present on any non-pass that produced output. */
  detail?: string;
  /** Honest reason a `skip`/`error` verdict is not a pass. Never a softener. */
  note?: string;
  durationMs?: number;
  /** install only: which tool actually ran ("npm ci" | "npm install" | "seam"). */
  tool?: string;
  /** install only: why that tool (lockfile present/absent), or the seam warning. */
  reason?: string;
  /** install only: true when the command came from the test seam
   *  (`opts.installCommand`) — that verdict is NOT evidence a real dependency
   *  install happened and must never be read as one. */
  mocked?: boolean;
  /** install only (OV-43, W17-L5): the report-only supply-chain posture of the
   *  subject tree — evidence, NEVER a gate. See `supplyChainFloorFor`. */
  supplyChain?: SupplyChainPosture;
  /** R11-f02: the standing script refusal this step ran under — install
   *  lifecycle scripts are denied (`--ignore-scripts`), so a model-authored
   *  postinstall/prepare can never execute during verification. */
  scriptPolicy?: string;
};

export type VerifyKindResult = {
  /** True iff no executed step ran red (fail/timeout/error). A skip is never
   *  a red — but it is never a pass either, and it always carries its reason. */
  ok: boolean;
  /** The SUBJECT dir (never the deleted scratch copy). */
  dir: string;
  /** Always false when present — copy-to-scratch + the bounded runner are
   *  emit-tree isolation, NOT a security sandbox. */
  sandbox: false;
  /** True iff this call really ran on a fresh scratch copy (false on a skip
   *  or an input refusal — never claims scratch behavior that did not happen). */
  scratch: boolean;
  /** True iff nothing was executed (the tree declares no build script). */
  skipped?: boolean;
  install?: VerifyKindStepVerdict;
  build?: VerifyKindStepVerdict;
  test?: VerifyKindStepVerdict;
  /** RT_E code when ok:false — `RT_E_VERIFY_KIND_FAILED` (red install/build/
   *  test, or an uncopyable subject) | `RT_E_VALIDATION` (not a kind dir: no
   *  readable package.json). */
  code?: string;
  /** Top-level honest reason: the first red step's bounded tail, the skip
   *  explanation, or the input refusal. */
  detail?: string;
  /** Set whenever a DECLARED script was not executed (post-install tool
   *  unresolvable) — an ok verdict is never SILENT about an unverified
   *  declared script. A note'd skip is still never a pass. */
  note?: string;
  durationMs: number;
};

const VERIFY_KIND_SCRIPT_TIMEOUT_MS = 120_000;
const VERIFY_KIND_INSTALL_TIMEOUT_MS = 240_000;

/** 216z: which install tool a tree gets, and why — `npm ci` when the tree
 *  carries a package-lock.json (a clean install from the lockfile), else
 *  `npm install` (resolve the declared deps and write a lockfile; there is
 *  nothing to `ci` from). Exported so the honest mapping is pinned by a test
 *  that needs no network install. */
export function installToolFor(dir: string): { tool: "npm ci" | "npm install"; command: string; reason: string } {
  const lock = existsSync(join(dir, "package-lock.json"));
  return lock
    ? {
        tool: "npm ci",
        command: "npm ci --no-audit --no-fund --ignore-scripts",
        reason:
          "package-lock.json present — npm ci installs exactly the locked tree; --ignore-scripts refuses every model-authored lifecycle script (postinstall/prepare) at verification time",
      }
    : {
        tool: "npm install",
        command: "npm install --no-audit --no-fund --ignore-scripts",
        reason:
          "no package-lock.json — npm install resolves the declared deps and writes a lockfile (nothing to ci from); --ignore-scripts refuses every model-authored lifecycle script (postinstall/prepare) at verification time",
      };
}

/** OV-43 (W17-L5) — the command that WOULD audit an emitted tree for real.
 *  Named here, never executed by this surface: the install leg runs with
 *  `--no-audit` by design, and auditing needs the network — a host that cannot
 *  audit must say so, not report clean. One copy-paste away, in the tree. */
export const SUPPLY_CHAIN_AUDIT_COMMAND = "npm audit --omit=dev";

/** OV-43 (W17-L5) — the emitted-tree supply-chain posture, REPORT-ONLY.
 *
 *  The two facts that make the floor necessary, both by design:
 *    · the install leg runs `npm ci|install --no-audit --no-fund`
 *      (`installToolFor` above) — advisory audit is OFF, so a dependency
 *      advisory is never seen on this path;
 *    · emitted trees declare caret-pinned deps (`scaffold.ts` PKG_DEPS) and
 *      ship no lockfile — a fresh emit resolves current patches.
 *  This type has NO ok/fail and can never gate a run (`gate: false`, pinned by
 *  `compile-check.server.test.ts`). It exists so the cost is VISIBLE instead of
 *  silent (the gpt-pilot supply-chain lesson, `RESUME.md:628`). */
export type SupplyChainPosture = {
  /** Stable tag for downstream readers; this is a report, not a verdict. */
  report: "supply-chain-posture";
  /** Always false — evidence only, never a gate (OV-43's own rule). */
  gate: false;
  /** True when the tree's package.json parsed; false → the counts below are 0. */
  packageJson: boolean;
  lockfile: "present" | "absent";
  /** Which install tool this leg used ("npm ci" | "npm install" | "seam"). */
  installTool: string;
  /** The exact command line whose flags this posture describes. */
  installCommand: string;
  /** True when that command carries `--no-audit` — this leg never audits. */
  noAuditFlag: boolean;
  /** Always false while the install leg runs `--no-audit`: no audit happened here. */
  audited: false;
  /** The honest statement of what was NOT checked, and how to check it for real. */
  auditNote: string;
  /** Range shapes across dependencies + devDependencies. */
  caretPinned: number;
  exactPinned: number;
  otherRange: number;
  totalDeps: number;
  /** Up to 5 `name@range` loose-pin examples (the caret pins). */
  caretExamples: string[];
  /** One line a reader must not lose: report-only, caret pins are deliberate. */
  caveat: string;
};

/** OV-43 (W17-L5): report an emitted tree's supply-chain posture — report-only,
 *  never a gate. Deterministic: reads package.json + lockfile presence and the
 *  install tool the leg uses; no network, no execution. Never throws into the
 *  caller — an unreadable package.json is reported as `packageJson: false`. */
export function supplyChainFloorFor(
  dir: string,
  opts?: { installTool?: string; installCommand?: string },
): SupplyChainPosture {
  const resolved = installToolFor(dir);
  const installTool = opts?.installTool ?? resolved.tool;
  const installCommand = opts?.installCommand ?? resolved.command;
  const noAuditFlag = /(?:^|\s)--no-audit(?:\s|$)/.test(installCommand);
  let packageJson = false;
  let deps: Record<string, string> = {};
  try {
    const parsed = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    deps = { ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}) };
    packageJson = true;
  } catch {
    packageJson = false;
  }
  let caretPinned = 0;
  let exactPinned = 0;
  let otherRange = 0;
  const caretExamples: string[] = [];
  for (const [name, range] of Object.entries(deps)) {
    if (/^\^\d/.test(range)) {
      caretPinned += 1;
      if (caretExamples.length < 5) caretExamples.push(`${name}@${range}`);
    } else if (/^\d+\.\d+\.\d+$/.test(range)) {
      exactPinned += 1;
    } else {
      otherRange += 1;
    }
  }
  const lockfile = existsSync(join(dir, "package-lock.json")) ? "present" : "absent";
  const auditNote =
    installTool === "seam"
      ? `report-only: this leg ran the test seam (no npm ran). The default leg runs \`npm ci|install --no-audit --no-fund\` — audit is off by design — so NO advisory audit has happened. Run \`${SUPPLY_CHAIN_AUDIT_COMMAND}\` inside an emitted tree to check for real (network required); a host that cannot audit says so.`
      : `report-only: this leg ran \`${installCommand}\` — audit is off by design, install lifecycle scripts are denied by design (--ignore-scripts, R11-f02), and emitted trees ship caret-pinned deps with no lockfile, so NO advisory audit has happened here. Run \`${SUPPLY_CHAIN_AUDIT_COMMAND}\` inside the tree to check for real (network required); a host that cannot audit says so — it never reports clean.`;
  return {
    report: "supply-chain-posture",
    gate: false,
    packageJson,
    lockfile,
    installTool,
    installCommand,
    noAuditFlag,
    audited: false,
    auditNote,
    caretPinned,
    exactPinned,
    otherRange,
    totalDeps: Object.keys(deps).length,
    caretExamples,
    caveat:
      "evidence only, never a gate: caret pins are deliberate (a fresh emit resolves current patches) and their honest cost is drift — recorded here, not enforced.",
  };
}

/** 216z: the runner wrapper that executes ONE module-resolved command line
 *  (the scratch-copy install). Same bounded contract as the spec/project
 *  wrappers: CJS-safe, inner timeout + maxBuffer, compact JSON envelope on
 *  stdout, exit via process.exitCode. The command line is a constant this
 *  module resolves (npm ci/install + flags, or the test-seam command) —
 *  never tree text. */
function cmdRunnerCode(commandLine: string, cwd: string, innerTimeoutMs: number): string {
  return [
    `const { spawnSync } = require("node:child_process");`,
    `let r = null;`,
    `let caught = null;`,
    `try {`,
    `  r = spawnSync(${JSON.stringify(commandLine)}, {`,
    `    encoding: "utf8",`,
    `    timeout: ${innerTimeoutMs},`,
    `    maxBuffer: 4194304,`,
    `    windowsHide: true,`,
    `    shell: true,`,
    `    cwd: ${JSON.stringify(cwd)},`,
    `  });`,
    `} catch (e) {`,
    `  caught = String((e && e.message) || e);`,
    `}`,
    `if (caught !== null) {`,
    `  process.stdout.write(JSON.stringify({ kind: "error", error: caught }));`,
    `  process.exitCode = 2;`,
    `} else {`,
    `  const out = [r.stdout || "", r.stderr || ""].join("\\n");`,
    `  const timedOut = !!(r.error && r.error.code === "ETIMEDOUT");`,
    `  const spawnErr = r.error && !timedOut ? String(r.error.message || r.error.code) : null;`,
    `  process.stdout.write(JSON.stringify({ kind: "done", status: typeof r.status === "number" ? r.status : null, timedOut, spawnErr, tail: out.slice(-${WRAPPER_TAIL_MAX}) }));`,
    `  process.exitCode = typeof r.status === "number" ? r.status : 1;`,
    `}`,
  ].join("\n");
}

/** 216z: the install step — resolve the honest tool (lockfile → `npm ci`,
 *  else `npm install`; or the test seam, loudly marked), run it in the
 *  scratch copy under the bounded runner, and classify the result. */
async function runInstallStep(
  copy: string,
  opts?: { installTimeoutMs?: number; installCommand?: string },
): Promise<VerifyKindStepVerdict> {
  const started = Date.now();
  const duration = (): number => Date.now() - started;
  const timeoutMs =
    typeof opts?.installTimeoutMs === "number" && opts.installTimeoutMs > 0
      ? opts.installTimeoutMs
      : VERIFY_KIND_INSTALL_TIMEOUT_MS;
  const seam = typeof opts?.installCommand === "string" && opts.installCommand.trim().length > 0 ? opts.installCommand.trim() : null;
  const resolved = installToolFor(copy);
  const command = seam ?? resolved.command;
  const tool = seam ? "seam" : resolved.tool;
  const reason = seam
    ? "install command injected via the verifyKindDir test seam (opts.installCommand) — this verdict is NOT evidence of a real dependency install"
    : resolved.reason;
  const base: VerifyKindStepVerdict = {
    step: "install",
    command,
    tool,
    reason,
    // OV-43 (W17-L5): report-only posture travels WITH the install verdict, so
    // a caller never has to ask twice. `gate:false` — it can never gate a run.
    supplyChain: supplyChainFloorFor(copy, { installTool: tool, installCommand: command }),
    run: "skip",
    durationMs: 0,
    ...(seam ? { mocked: true } : {}),
    // R11-f02: record the standing refusal on every real install verdict —
    // model-authored lifecycle scripts (postinstall/prepare + dep scripts) are
    // denied by the flag, so this leg can never execute them.
    ...(seam
      ? {}
      : {
          scriptPolicy:
            "lifecycle scripts denied (--ignore-scripts) — a model-authored postinstall/prepare or dependency install script never runs during verification",
        }),
  };
  const innerTimeout = Math.max(500, timeoutMs - INNER_TIMEOUT_MARGIN_MS);
  const run = await runNodeBounded(cmdRunnerCode(command, copy, innerTimeout), { timeoutMs });
  if (!run.ok) {
    if (run.reason === "timeout") {
      return { ...base, run: "timeout", detail: `install killed after ${timeoutMs / 1000}s`, durationMs: duration() };
    }
    if (run.reason === "not-configured") {
      return { ...base, run: "error", detail: `${run.code}: local bounded runner unavailable`, durationMs: duration() };
    }
    return { ...base, run: "error", detail: run.error ?? run.reason, durationMs: duration() };
  }
  const env = parseWrapperEnvelope(run.stdout);
  if (!env) {
    return { ...base, run: "error", detail: "runner produced no parseable envelope", durationMs: duration() };
  }
  if (env.kind === "error") {
    return { ...base, run: "error", detail: (env.error ?? "install runner failed").slice(0, VERDICT_TAIL_MAX), durationMs: duration() };
  }
  if (env.spawnErr) {
    return { ...base, run: "error", detail: `spawn failed: ${env.spawnErr}`.slice(0, VERDICT_TAIL_MAX), durationMs: duration() };
  }
  if (env.timedOut) {
    return { ...base, run: "timeout", detail: `install killed after ${innerTimeout / 1000}s (inner timeout)`, durationMs: duration() };
  }
  const exitCode = typeof env.status === "number" ? env.status : 1;
  if (exitCode === 0) return { ...base, run: "pass", exitCode: 0, durationMs: duration() };
  const tail = (env.tail ?? "").trim();
  return {
    ...base,
    run: "fail",
    exitCode,
    detail: (tail || `install exited ${exitCode}`).slice(0, VERDICT_TAIL_MAX),
    durationMs: duration(),
  };
}

/**
 * 216z (T4.1 / TA-16): verify the emitted kind's declared build/test for
 * real. Fresh scratch copy of `dir` → npm ci (lockfile) / npm install → the
 * tree's own declared `build` + `test` scripts in that copy, all bounded and
 * classified. No build script declared → honest skip (nothing to install-and-
 * build; the reason is in `detail`). Never fabricates a pass; never mutates
 * `dir`; the copy is always deleted. See the 216z block comment above for the
 * full contract, including the two coded failure classes.
 */
export async function verifyKindDir(
  dir: string,
  opts?: { timeoutMs?: number; installTimeoutMs?: number; installCommand?: string },
): Promise<VerifyKindResult> {
  const started = Date.now();
  const duration = (): number => Date.now() - started;
  const root = resolve(dir);
  let isDir = false;
  try {
    isDir = statSync(root).isDirectory();
  } catch {
    isDir = false;
  }
  if (!isDir) {
    return {
      ok: false,
      dir: root,
      sandbox: false,
      scratch: false,
      code: "RT_E_VALIDATION",
      detail: `verify-kind: dir not readable: ${dir}`,
      durationMs: duration(),
    };
  }
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) {
    return {
      ok: false,
      dir: root,
      sandbox: false,
      scratch: false,
      code: "RT_E_VALIDATION",
      detail: "no package.json — nothing to verify; this dir is not an emitted kind tree",
      durationMs: duration(),
    };
  }
  let pkg: { scripts?: Record<string, unknown> };
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { scripts?: Record<string, unknown> };
  } catch {
    return {
      ok: false,
      dir: root,
      sandbox: false,
      scratch: false,
      code: "RT_E_VALIDATION",
      detail: "package.json unreadable",
      durationMs: duration(),
    };
  }
  const scripts =
    pkg && typeof pkg.scripts === "object" && pkg.scripts !== null ? (pkg.scripts as Record<string, unknown>) : null;
  const buildRaw = typeof scripts?.build === "string" ? scripts.build.trim() : "";
  if (!buildRaw) {
    return {
      ok: true,
      dir: root,
      sandbox: false,
      scratch: false,
      skipped: true,
      detail:
        'no build script — verify-kind skipped: the emitted package.json declares no "build" script (kinds without a build declare none), ' +
        "so there is nothing to install-and-build; the declared test/typecheck scripts were NOT executed here (they need no install) — " +
        "run `tree-run` / `emit --run` for the no-install spec + project-script leg. Absent is not a pass.",
      durationMs: duration(),
    };
  }
  let copy: string | null = null;
  try {
    copy = mkdtempSync(join(tmpdir(), "rt-verifykind-"));
    // The tree's own top-level node_modules/.git are intentionally NOT copied
    // — the install leg must be the source of truth for the dependency tree.
    const skip = new Set([join(root, "node_modules"), join(root, ".git")]);
    cpSync(root, copy, { recursive: true, filter: (src) => !skip.has(src) });
  } catch (err) {
    if (copy) {
      try {
        rmSync(copy, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    return {
      ok: false,
      dir: root,
      sandbox: false,
      scratch: false,
      code: "RT_E_VERIFY_KIND_FAILED",
      detail: `scratch copy failed — the subject dir was NOT used as npm's cwd: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: duration(),
    };
  }
  try {
    const scriptTimeout =
      typeof opts?.timeoutMs === "number" && opts.timeoutMs > 0 ? opts.timeoutMs : VERIFY_KIND_SCRIPT_TIMEOUT_MS;
    const install = await runInstallStep(copy, opts);
    if (install.run !== "pass") {
      const notRun = (step: "build" | "test"): VerifyKindStepVerdict => ({
        step,
        run: "skip",
        note:
          `install did not complete (${install.run}) — the declared ${step} was NOT executed ` +
          "(building/testing without the tree's deps would only fail for the wrong reason); fix the install failure and re-run",
      });
      const build = notRun("build");
      const test = notRun("test");
      return {
        ok: false,
        dir: root,
        sandbox: false,
        scratch: true,
        install,
        build,
        test,
        code: "RT_E_VERIFY_KIND_FAILED",
        detail:
          `install ${install.run}` +
          (typeof install.exitCode === "number" ? ` (exit ${install.exitCode})` : "") +
          (install.detail ? ` — ${install.detail.slice(0, 300)}` : "") +
          "; the declared build/test scripts were NOT executed",
        durationMs: duration(),
      };
    }
    const buildV = await runProjectScript(copy, "build", scripts, scriptTimeout);
    const build: VerifyKindStepVerdict = {
      step: "build",
      command: buildV.command,
      run: buildV.run,
      exitCode: buildV.exitCode,
      detail: buildV.detail,
      note: buildV.note,
      durationMs: buildV.durationMs,
    };
    const testV = await runProjectScript(copy, "test", scripts, scriptTimeout);
    const test: VerifyKindStepVerdict = {
      step: "test",
      command: testV.command,
      run: testV.run,
      exitCode: testV.exitCode,
      detail: testV.detail,
      note: testV.note,
      durationMs: testV.durationMs,
    };
    const red = [build, test].filter((v) => v.run === "fail" || v.run === "timeout" || v.run === "error");
    const unrun = [build, test].filter((v) => v.run === "skip" && typeof v.command === "string");
    const result: VerifyKindResult = {
      ok: red.length === 0,
      dir: root,
      sandbox: false,
      scratch: true,
      install,
      build,
      test,
      durationMs: duration(),
    };
    if (red.length > 0) {
      result.code = "RT_E_VERIFY_KIND_FAILED";
      result.detail = red
        .map(
          (v) =>
            `the emitted project's own \`npm run ${v.step}\` ${v.run}` +
            (typeof v.exitCode === "number" ? ` (exit ${v.exitCode})` : "") +
            (v.detail ? ` — ${v.detail.slice(0, 300)}` : ""),
        )
        .join("; ")
        .slice(0, 1800);
    } else if (unrun.length > 0) {
      result.note =
        `the emitted project's own ${unrun.map((v) => `\`npm run ${v.step}\``).join(" / ")} ${
          unrun.length === 1 ? "was" : "were"
        } NOT executed after a successful install — the tree's declared toolchain is UNVERIFIED (not a pass): ` +
        unrun.map((v) => v.note ?? "un-runnable").join(" · ");
      result.note = result.note.slice(0, 1800);
    }
    return result;
  } finally {
    if (copy) {
      try {
        rmSync(copy, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}
