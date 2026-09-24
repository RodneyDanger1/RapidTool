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
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import ts from "typescript";
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
 * run, or a file over the byte budget is a loud FAIL (or a top-level error),
 * not a silent skip. Pure fs reads + node/ts checks — no writes.
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
      if (filesSeen >= MAX_FILES) return;
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
   *  entry run passes or is an honest UI-shell skip, AND (216 · T-18) no
   *  declared project script ran red — a tree that fails its own `npm test`
   *  can never be `ok:true`, and a headless skip is never green (185-S5 / 192). */
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
    `  r = spawnSync(process.execPath, ["--test", spec], {`,
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

/** 216 (T-18): the runner wrapper that executes ONE declared project script
 *  (`npm run <script>`) inside the temp copy — the same bounded-runner
 *  contract as the spec/entry wrappers: CJS-safe, inner timeout + maxBuffer,
 *  compact JSON envelope on stdout, exit via process.exitCode. The script
 *  NAME is a constant supplied by this module; npm reads the COMMAND from the
 *  tree's own package.json. */
function projectScriptRunnerCode(script: string, cwd: string, innerTimeoutMs: number): string {
  return [
    `const { spawnSync } = require("node:child_process");`,
    `let r = null;`,
    `let caught = null;`,
    `try {`,
    `  r = spawnSync(${JSON.stringify(`npm run ${script}`)}, {`,
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
  const run = await runNodeBounded(projectScriptRunnerCode(script, root, innerTimeout), { timeoutMs });
  if (!run.ok) {
    if (run.reason === "timeout") {
      return { ...base, command: raw, run: "timeout", detail: `npm run ${script} killed after ${timeoutMs / 1000}s`, durationMs: duration() };
    }
    if (run.reason === "not-configured") {
      return { ...base, command: raw, run: "error", detail: `${run.code}: local bounded runner unavailable`, durationMs: duration() };
    }
    return { ...base, command: raw, run: "error", detail: run.error ?? run.reason, durationMs: duration() };
  }
  const env = parseWrapperEnvelope(run.stdout);
  if (!env) {
    return { ...base, command: raw, run: "error", detail: "runner produced no parseable envelope", durationMs: duration() };
  }
  if (env.kind === "error") {
    return { ...base, command: raw, run: "error", detail: (env.error ?? "npm script runner failed").slice(0, VERDICT_TAIL_MAX), durationMs: duration() };
  }
  const tail = (env.tail ?? "").trim();
  if (env.spawnErr) {
    return { ...base, command: raw, run: "error", detail: `spawn failed: ${env.spawnErr}`.slice(0, VERDICT_TAIL_MAX), durationMs: duration() };
  }
  if (env.timedOut) {
    return { ...base, command: raw, run: "timeout", detail: `npm run ${script} killed after ${innerTimeout / 1000}s (inner timeout)`, durationMs: duration() };
  }
  const exitCode = typeof env.status === "number" ? env.status : 1;
  if (exitCode === 0) return { ...base, command: raw, run: "pass", exitCode: 0, durationMs: duration() };
  return {
    ...base,
    command: raw,
    run: "fail",
    exitCode,
    detail: (tail || `npm run ${script} exited ${exitCode}`).slice(0, VERDICT_TAIL_MAX),
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
  try {
    copy = mkdtempSync(join(tmpdir(), "rt-treerun-"));
    if (existsSync(subject) && statSync(subject).isDirectory()) {
      cpSync(subject, copy, { recursive: true });
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
    const specsGreen = outcome.tests.length === 0 || outcome.tests.every((t) => t.run === "pass");
    // Fail-closed: missing entry verdict is NOT green. Headless skip is NOT
    // green. Only an executed pass or a structural UI-shell skip counts.
    const entryGreen =
      !!outcome.run &&
      (outcome.run.run === "pass" ||
        (outcome.run.run === "skip" && outcome.run.kind === "ui-shell"));
    outcome.ok = compile.ok && specsGreen && entryGreen && projectLeg.verdict.ok;
    return outcome;
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
        command: "npm ci --no-audit --no-fund",
        reason: "package-lock.json present — npm ci installs exactly the locked tree",
      }
    : {
        tool: "npm install",
        command: "npm install --no-audit --no-fund",
        reason: "no package-lock.json — npm install resolves the declared deps and writes a lockfile (nothing to ci from)",
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
    run: "skip",
    durationMs: 0,
    ...(seam ? { mocked: true } : {}),
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
