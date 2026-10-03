// ---------------------------------------------------------------------------
// entry-oracle.ts — THE one behavioral-oracle primitive (fixes/299 U1's
// eval-side implementation, extracted verbatim by W43 · H5 —
// fixes/316_h5_oracle.md · T6.3).
//
// WHY THIS MODULE EXISTS: `entry-runs` (declared exit + stdout/stderr pins,
// bounded spawn, env-minimal) was the ONE true behavioral oracle in the repo —
// but it lived inside `scripts/run-eval.mjs` and fired on the EVAL side only.
// The product path (`compile-check.server.ts` treeRun: emit --run / tree-run /
// repair) did a load-import smoke with zero exit/output assertions, so a green
// tree whose entry misbehaves could still exit 0 (311_sd_product K3/K4). Two
// copies of an oracle is a second truth source; this module is the single one,
// consumed by BOTH surfaces:
//   · scripts/run-eval.mjs — delegates `evaluateEntryRunsRow` /
//     `checkExpectedBehavior` / the parseGrader row validation to it, so the
//     eval-side records stay byte-identical;
//   · src/lib/compile-check.server.ts — treeRun evaluates the emitted tree's
//     OWN declaration with it (the `behavior` factor on the verdict).
//
// TRUST BOUNDARY (stated, never implied): the spawn is a bounded local run —
// env ALLOWLIST + wall-clock budget + cwd — exactly the same "bounded runner,
// NOT an OS sandbox" caveat the repo states for node-runner.server.ts. The
// declared rows are trusted the same way the emitted spec/entry files the tree
// already executes are: the tree executes its own code by design.
//
// PURITY: reads + spawns only; never writes. The module imports node: builtins
// only (spawnSync/fs/path) — importable from a Node script and from the server
// chain alike. All bodies here are VERBATIM moves of the shipped run-eval.mjs
// implementations (comments included where they carry the contract).
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Default per-row budget. Long enough for a cold node + strip-types start on
 *  this box (~1-2s observed), short enough that a hung entry cannot stall the
 *  eval; a row may override within [min, max]. */
export const ENTRY_RUN_TIMEOUT_MS = 15_000;
export const ENTRY_RUN_TIMEOUT_MIN_MS = 500;
export const ENTRY_RUN_TIMEOUT_MAX_MS = 60_000;
export const ENTRY_RUN_STDOUT_TAIL = 160;
export const ENTRY_RUN_STDERR_TAIL = 240;

/** One-line, whitespace-collapsed, bounded tail of a child's stream — evidence
 *  a human can read inside results.json. */
export function entryRunTail(text: unknown, max: number): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** The bounded budget for one runtime row (row override clamped; default 15s). */
export function entryRunBudget(row: { timeoutMs?: unknown }): number {
  const v =
    typeof row.timeoutMs === "number" && Number.isFinite(row.timeoutMs)
      ? Math.floor(row.timeoutMs)
      : ENTRY_RUN_TIMEOUT_MS;
  return Math.min(Math.max(v, ENTRY_RUN_TIMEOUT_MIN_MS), ENTRY_RUN_TIMEOUT_MAX_MS);
}

/** fixes/299 (U1): the child environment for a runtime row — an ALLOWLIST of
 *  the vars a node process needs to start (Windows: SystemRoot / PATH / TEMP…).
 *  Nothing else passes through: no DEEPSEEK_* / provider config, no parent
 *  NODE_OPTIONS — the emitted entry cannot read the driver's credentials.
 *  Minimal ≠ an OS sandbox (the same bounded-runner caveat the repo states for
 *  node-runner.server.ts). */
export const ENTRY_RUN_ENV_ALLOW = Object.freeze([
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "SYSTEMDRIVE",
  "COMSPEC",
  "WINDIR",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "HOME",
  "NUMBER_OF_PROCESSORS",
  "OS",
]);
export function entryRunEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ENTRY_RUN_ENV_ALLOW) {
    const v = process.env[key];
    if (typeof v === "string") env[key] = v;
  }
  return env;
}

/** One validated `expectedBehavior` row — the shape parseGrader normalizes to
 *  and evaluateEntryRunsRow evaluates. Keys optional per check kind. */
export type EntryOracleRow = {
  id: string;
  check: string;
  path?: string;
  target?: string;
  uiShell?: boolean;
  entry?: string;
  mode?: "exec" | "import";
  args?: string[];
  expectExit?: number;
  expectStdout?: string;
  expectStderr?: string;
  timeoutMs?: number;
  note?: string;
};

export type EntryOracleStatus = "pass" | "fail" | "ui-shell";

export type EntryOracleVerdict = {
  status: EntryOracleStatus;
  detail: string;
};

/** The `expectedBehavior` check vocabulary — shared by parseGrader and every
 *  tree-side declaration reader (one validation truth). */
export const BEHAVIOR_CHECKS: ReadonlySet<string> = new Set(["file-exists", "package-target-exists", "entry-runs"]);

/** fixes/299 (U1): one `entry-runs` row, evaluated for real. Returns
 *  `{ status, detail }` — status ∈ { "pass", "fail", "ui-shell" }:
 *    ui-shell — the row declared it (a UI kind). The structural premise is
 *               VERIFIED (index.html emitted — the exact signal treeRun's
 *               resolveEntry uses); a declared ui-shell whose tree carries no
 *               index.html FAILS, so the skip is true, never a free pass.
 *    exec     — spawnSync(node, [--experimental-strip-types?, <entry>, …args])
 *               bounded by the row budget, cwd = the emitted dir, env-minimal.
 *               pass = declared exit (default 0) within budget AND every
 *               declared stdout/stderr substring present; fail = timeout /
 *               spawn error / exit mismatch / missing pin.
 *    import   — node -e loads the entry as a module. The emitted entries carry
 *               a direct-run guard (argv[1] vs import.meta.url), so argv[1]
 *               must stay EMPTY: the path is embedded in the loader text, not
 *               passed as argv. pass = the import resolves and the process
 *               exits 0; a module that throws on import fails.
 *  Reads + spawns only; never writes. */
export function runEntryOracle(
  row: EntryOracleRow,
  emittedDir: string,
  has: (p: string) => boolean,
): EntryOracleVerdict {
  if (row.uiShell === true) {
    return has("index.html")
      ? {
          status: "ui-shell",
          detail:
            "structural UI-shell skip — index.html emitted, so this kind has no headless entry (a dev/build leg needs a network install); the same skip treeRun's own resolveEntry makes",
        }
      : {
          status: "fail",
          detail:
            "declared uiShell, but the tree carries no index.html — the structural premise is false, so this is not a UI shell (never a silent pass)",
        };
  }
  // 339-6 (the 338-6 class, one layer down at the runner): a declared pin the
  // evaluator cannot actually violate is a verifier that cannot fail. An
  // empty-string stdout/stderr pin is satisfied by `String(out).includes("")`
  // for EVERY run; a non-integer expectExit was silently coerced to the
  // default 0, so the declared exit was never evaluated. The validator refuses
  // both through the normal path; the runner refuses them too, so a direct
  // caller (evaluateEntryRunsRow / a tree-side reader) can never mint a green
  // from a hollow row. Refused before the spawn — nothing to run.
  if (row.expectStdout !== undefined && (typeof row.expectStdout !== "string" || row.expectStdout.length === 0)) {
    return { status: "fail", detail: "declared expectStdout is empty — includes(\"\") is always true, so the pin can never fail" };
  }
  if (row.expectStderr !== undefined && (typeof row.expectStderr !== "string" || row.expectStderr.length === 0)) {
    return { status: "fail", detail: "declared expectStderr is empty — includes(\"\") is always true, so the pin can never fail" };
  }
  if (row.expectExit !== undefined && !Number.isInteger(row.expectExit)) {
    return {
      status: "fail",
      detail: `declared expectExit ${JSON.stringify(row.expectExit)} is not an integer 0..255 — refusing rather than silently evaluating the default 0`,
    };
  }
  if (!has(row.entry as string)) {
    return { status: "fail", detail: `entry not emitted: ${row.entry} — nothing to run` };
  }
  const abs = join(emittedDir, row.entry as string);
  const isTs = /\.(ts|mts|cts)$/i.test(row.entry as string);
  const mode = row.mode === "import" ? "import" : "exec";
  const budget = entryRunBudget(row);
  let argv: string[];
  if (mode === "import") {
    const loader =
      `const entry = ${JSON.stringify(abs)};` +
      'const { pathToFileURL } = await import("node:url");' +
      "const m = await import(pathToFileURL(entry).href);" +
      'console.log("import ok: " + Object.keys(m).sort().join(","));';
    argv = [...(isTs ? ["--experimental-strip-types"] : []), "--input-type=module", "-e", loader];
  } else {
    argv = [...(isTs ? ["--experimental-strip-types"] : []), abs, ...(Array.isArray(row.args) ? row.args : [])];
  }
  const t0 = Date.now();
  const run = spawnSync(process.execPath, argv, {
    cwd: emittedDir,
    encoding: "utf8",
    timeout: budget,
    env: entryRunEnv(),
    windowsHide: true,
  });
  const ms = Date.now() - t0;
  const stdoutTail = entryRunTail(run.stdout, ENTRY_RUN_STDOUT_TAIL);
  const stderrTail = entryRunTail(run.stderr, ENTRY_RUN_STDERR_TAIL);
  const tails = `${stdoutTail ? ` · stdout: "${stdoutTail}"` : ""}${stderrTail ? ` · stderr: "${stderrTail}"` : ""}`;
  const spawnErr = run.error as (Error & { code?: string }) | undefined;
  const timedOut = Boolean(spawnErr && spawnErr.code === "ETIMEDOUT");
  if (spawnErr && !timedOut) {
    return {
      status: "fail",
      detail: `spawn failed (${spawnErr.code || spawnErr.message}) — ${mode} of ${row.entry} could not start`,
    };
  }
  if (timedOut) {
    return { status: "fail", detail: `timed out after ${budget}ms (budget, killed) — ${mode} of ${row.entry} did not finish${tails}` };
  }
  const exitDesc = run.status === null ? (run.signal ? `signal ${run.signal}` : "no exit status") : `exit ${run.status}`;
  const expected = Number.isInteger(row.expectExit) ? (row.expectExit as number) : 0;
  if (run.status !== expected) {
    return { status: "fail", detail: `${exitDesc} ≠ declared exit ${expected} (${mode} of ${row.entry})${tails}` };
  }
  if (row.expectStdout !== undefined && !String(run.stdout ?? "").includes(row.expectStdout)) {
    return { status: "fail", detail: `${exitDesc} in ${ms}ms, but stdout lacks ${JSON.stringify(row.expectStdout)}${tails}` };
  }
  if (row.expectStderr !== undefined && !String(run.stderr ?? "").includes(row.expectStderr)) {
    return { status: "fail", detail: `${exitDesc} in ${ms}ms, but stderr lacks ${JSON.stringify(row.expectStderr)}${tails}` };
  }
  return {
    status: "pass",
    detail: `${exitDesc} in ${ms}ms (bounded ${budget}ms, env-minimal spawn, cwd = emitted dir)${tails}`,
  };
}

/** One evaluated row of the contract record (the shape run-eval's
 *  checkExpectedBehavior has always produced — key order included). */
export type EntryContractRow = {
  id: string;
  check: string;
  path?: string;
  target?: string;
  uiShell?: boolean;
  entry?: string;
  mode?: "import";
  args?: string[];
  status: EntryOracleStatus;
  detail: string;
};

export type EntryContractRecord = {
  declared: number;
  rows: EntryContractRow[];
  passed: number;
  failed: number;
  pending: number;
  uiShell: number;
  ok: boolean;
  complete: boolean;
  note: string | null;
};

/** The manifest `has` rule every emitted-file list has used since fixes/299:
 *  an exact rel-path OR a path-suffix match (posix-normalized manifest). */
export function manifestHas(files: string[]): (p: string) => boolean {
  return (p) => files.some((f) => f === p || f.endsWith(`/${p}`));
}

/** The manifest FIND rule: the rel path AS EMITTED (exact first, then the
 *  suffix convention), or null. Mirrors the historical
 *  `files.find((f) => f === rel || f.endsWith("/" + rel))` exactly. */
export function manifestFind(files: string[]): (rel: string) => string | null {
  return (rel) => files.find((f) => f === rel || f.endsWith(`/${rel}`)) ?? null;
}

/** Normalize an emitted-file manifest for path matching (posix separators). */
export function normalizeEmittedFiles(emittedFiles: unknown): string[] {
  return Array.isArray(emittedFiles) ? emittedFiles.map((f) => String(f).replace(/\\/g, "/")) : [];
}

/** Every path a package.json target value declares (string | nested object to
 *  depth 2 | string array) — the paths `package-target-exists` must resolve. */
function packageTargetPaths(value: unknown): string[] {
  const out: string[] = [];
  const visit = (v: unknown, depth: number): void => {
    if (depth > 2) return;
    if (typeof v === "string") {
      out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1);
      return;
    }
    if (v && typeof v === "object") {
      for (const x of Object.values(v)) visit(x, depth + 1);
    }
  };
  visit(value, 0);
  return out;
}

/** W40·N4 (§R7-f03/f04) + fixes/299 (U1): evaluate declared `expectedBehavior`
 *  rows against an EMITTED TREE — never against text presence in the brief. Row
 *  statuses:
 *    file-exists           — pass/fail: the declared path resolves in the manifest;
 *    package-target-exists — pass/fail: every path the package.json target
 *                            declares resolves to an emitted file (a declared-
 *                            but-dangling target, or an undeclared target,
 *                            FAILS);
 *    entry-runs            — pass/fail/ui-shell: a bounded, env-minimal spawn
 *                            (exec or import) of the declared emitted entry —
 *                            a broken artifact FAILS the row. A UI-kind row
 *                            reads the verified `ui-shell` structural skip
 *                            instead of an entry (never a silent pass).
 *  `ok` = no row FAILED (a ui-shell skip does not fail a tree, exactly as
 *  treeRun's entryGreen reads it); `complete` = no runtime row still awaits
 *  evidence — `ui-shell` is TERMINAL, so it never keeps `complete` false for a
 *  webapp/game tree. Reads files + runs the declared entry; never writes. */
export function checkEntryContract(
  declaredRows: EntryOracleRow[],
  emittedDir: string,
  has: (p: string) => boolean,
  /** Names the rel path AS EMITTED for a root-anchored file (the manifest
   *  caller passes `manifestFind(files)`; the fs caller gets exact-path
   *  semantics). Only package.json is looked up this way. */
  find: (rel: string) => string | null = (rel) => (has(rel) ? rel : null),
): EntryContractRecord {
  let pkg: Record<string, unknown> | null = null;
  let pkgRel: string | null = null;
  if (declaredRows.some((r) => r.check === "package-target-exists")) {
    pkgRel = find("package.json");
    if (pkgRel) {
      try {
        pkg = JSON.parse(readFileSync(join(emittedDir, pkgRel), "utf8")) as Record<string, unknown>;
      } catch {
        pkg = null;
      }
    }
  }
  const rows: EntryContractRow[] = [];
  for (const row of declaredRows) {
    if (row.check === "package-target-exists") {
      const target = row.target as string;
      let status: EntryOracleStatus = "fail";
      let detail: string;
      if (!pkg) {
        detail = pkgRel === null ? "package.json absent from the emitted tree" : `${pkgRel} is not readable JSON`;
      } else if (pkg[target] === undefined) {
        detail = `package.json declares no "${target}"`;
      } else {
        const paths = packageTargetPaths(pkg[target]);
        if (paths.length === 0) {
          detail = `package.json "${target}" declares no path`;
        } else {
          const missing = paths
            .map((t) => String(t).replace(/^\.\//, "").replace(/^\/+/, ""))
            .filter((t) => !has(t));
          if (missing.length === 0) {
            status = "pass";
            detail = `package.json "${target}" → ${paths.join(", ")} (emitted)`;
          } else {
            detail = `package.json "${target}" → ${missing.join(", ")} not emitted`;
          }
        }
      }
      rows.push({ id: row.id, check: row.check, target, status, detail });
      continue;
    }
    if (row.check === "entry-runs") {
      const verdict = runEntryOracle(row, emittedDir, has);
      rows.push({
        id: row.id,
        check: row.check,
        ...(row.uiShell === true ? { uiShell: true } : { entry: row.entry }),
        ...(row.mode === "import" ? { mode: "import" as const } : {}),
        ...(Array.isArray(row.args) && row.args.length > 0 ? { args: row.args } : {}),
        status: verdict.status,
        detail: verdict.detail,
      });
      continue;
    }
    // file-exists (the only remaining parse-validated check)
    const hit = has(row.path as string);
    rows.push({
      id: row.id,
      check: row.check,
      path: row.path as string,
      status: hit ? "pass" : "fail",
      detail: hit ? `emitted: ${row.path}` : `absent from the emitted tree: ${row.path}`,
    });
  }
  // `pending` was the pre-U1 never-evaluated status; no row produces it now
  // (parseGrader rejects a runtime row that names nothing to evaluate), so the
  // counter is structurally 0.
  const pending = rows.filter((r) => (r.status as string) === "pending").length;
  return {
    declared: rows.length,
    rows,
    passed: rows.filter((r) => r.status === "pass").length,
    failed: rows.filter((r) => r.status === "fail").length,
    pending,
    uiShell: rows.filter((r) => r.status === "ui-shell").length,
    // ok = no row FAILED — a ui-shell structural skip is not a failure (the
    // same reading treeRun's entryGreen applies to a ui-shell entry).
    ok: rows.every((r) => r.status !== "fail"),
    // complete = something WAS declared AND no runtime row still awaits evidence.
    // 337-3: `rows.every(... !== "pending")` was vacuously true for every
    // contract — including an empty declaration — so `complete` could never be
    // false (a verifier that cannot fail). The zero-row case is exactly the
    // state that must not read as a completeness claim; a ui-shell row stays
    // TERMINAL, so it never keeps `complete` false for a webapp/game tree.
    complete: rows.length > 0 && pending === 0,
    note: rows.length === 0 ? 'no expectedBehavior rows declared (v1 grader — the verification label reads "files+content only")' : null,
  };
}

/** Shared per-row validation for an `expectedBehavior` declaration (moved
 *  verbatim from parseGrader — the error strings are the grader-loading
 *  contract). Accepts the raw JSON value; returns normalized rows or the
 *  first refusal. `undefined` = no declaration (ok, zero rows). */
export function validateExpectedBehavior(
  raw: unknown,
  label = "expectedBehavior",
): { ok: true; rows: EntryOracleRow[] } | { ok: false; error: string } {
  const rows: EntryOracleRow[] = [];
  if (raw === undefined) return { ok: true, rows };
  if (!Array.isArray(raw)) {
    return { ok: false, error: `${label} must be an array of rows` };
  }
  for (const [i, row] of raw.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, error: `${label}[${i}] is not an object` };
    }
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    if (!id) return { ok: false, error: `${label}[${i}] carries no id` };
    const check = typeof r.check === "string" ? r.check.trim() : "";
    if (!BEHAVIOR_CHECKS.has(check)) {
      return {
        ok: false,
        error: `${label}[${i}] (${id}): unknown check ${JSON.stringify(r.check)} — one of ${[...BEHAVIOR_CHECKS].join(" | ")}`,
      };
    }
    // 338-6: every field a row carries must be one its check actually
    // EVALUATES. A silently-ignored field (a uiShell row's declared exit/stdout,
    // a runtime field on file-exists/package-target-exists) made the row read
    // green without the thing it declared — the same "a verifier that cannot
    // fail" class as 337-3's vacuous `complete`, one layer down. `id`, `check`
    // and `note` are metadata and always allowed.
    const isUiShell = r.uiShell === true;
    const evaluated =
      check === "file-exists"
        ? new Set(["path"])
        : check === "package-target-exists"
          ? new Set(["target"])
          : isUiShell
            ? new Set(["uiShell"])
            : new Set(["entry", "mode", "args", "expectExit", "expectStdout", "expectStderr", "timeoutMs", "uiShell"]);
    for (const key of Object.keys(r)) {
      if (key === "id" || key === "check" || key === "note") continue;
      if (!evaluated.has(key)) {
        return {
          ok: false,
          error: `${label}[${i}] (${id}): ${JSON.stringify(key)} is not evaluated by ${JSON.stringify(check)}${isUiShell ? " (uiShell is a structural skip)" : ""} — a declaration that would be silently dropped is refused`,
        };
      }
    }
    if (check === "file-exists" && !(typeof r.path === "string" && r.path.trim().length > 0)) {
      return { ok: false, error: `${label}[${i}] (${id}): file-exists needs a non-empty "path"` };
    }
    if (check === "package-target-exists" && !(r.target === "bin" || r.target === "main" || r.target === "exports")) {
      return { ok: false, error: `${label}[${i}] (${id}): package-target-exists needs "target": "bin" | "main" | "exports"` };
    }
    // fixes/299 (U1): the entry-runs runtime shape — validated here so a
    // runtime row can never again grade nothing (the pre-U1 `pending` trap).
    let entryRunFields: Partial<EntryOracleRow> | null = null;
    if (check === "entry-runs") {
      const uiShell = r.uiShell === true;
      const entry = typeof r.entry === "string" ? r.entry.trim().replace(/\\/g, "/").replace(/^\.\//, "") : "";
      // (338-6: uiShell + entry is already refused by the field-scope gate
      // above — a uiShell row evaluates nothing but its structural premise.)
      if (!uiShell && !entry) {
        return { ok: false, error: `${label}[${i}] (${id}): entry-runs needs a non-empty "entry" (the emitted-tree-relative file to run) or "uiShell": true for a UI kind` };
      }
      if (r.mode !== undefined && r.mode !== "exec" && r.mode !== "import") {
        return { ok: false, error: `${label}[${i}] (${id}): entry-runs mode must be "exec" | "import" (got ${JSON.stringify(r.mode)})` };
      }
      if (r.args !== undefined) {
        if (!Array.isArray(r.args) || r.args.some((a) => typeof a !== "string")) {
          return { ok: false, error: `${label}[${i}] (${id}): entry-runs args must be an array of strings` };
        }
        if (r.mode === "import") {
          return { ok: false, error: `${label}[${i}] (${id}): entry-runs args apply to mode "exec" only (an import takes no argv)` };
        }
      }
      if (r.expectExit !== undefined && !(Number.isInteger(r.expectExit) && (r.expectExit as number) >= 0 && (r.expectExit as number) <= 255)) {
        return { ok: false, error: `${label}[${i}] (${id}): expectExit must be an integer 0..255` };
      }
      if (r.expectStdout !== undefined && !(typeof r.expectStdout === "string" && r.expectStdout.length > 0)) {
        return { ok: false, error: `${label}[${i}] (${id}): expectStdout must be a non-empty string` };
      }
      if (r.expectStderr !== undefined && !(typeof r.expectStderr === "string" && r.expectStderr.length > 0)) {
        return { ok: false, error: `${label}[${i}] (${id}): expectStderr must be a non-empty string` };
      }
      if (r.timeoutMs !== undefined && !(Number.isFinite(r.timeoutMs) && (r.timeoutMs as number) > 0)) {
        return { ok: false, error: `${label}[${i}] (${id}): timeoutMs must be a positive finite number` };
      }
      entryRunFields = {
        ...(uiShell ? { uiShell: true } : { entry }),
        ...(r.mode === "exec" || r.mode === "import" ? { mode: r.mode } : {}),
        ...(Array.isArray(r.args) && r.args.length > 0 ? { args: [...(r.args as string[])] } : {}),
        ...(Number.isInteger(r.expectExit) ? { expectExit: r.expectExit as number } : {}),
        ...(typeof r.expectStdout === "string" ? { expectStdout: r.expectStdout } : {}),
        ...(typeof r.expectStderr === "string" ? { expectStderr: r.expectStderr } : {}),
        ...(Number.isFinite(r.timeoutMs) ? { timeoutMs: r.timeoutMs as number } : {}),
      };
    }
    rows.push({
      id,
      check,
      ...(typeof r.path === "string" ? { path: r.path.trim() } : {}),
      ...(typeof r.target === "string" ? { target: r.target } : {}),
      ...(entryRunFields ?? {}),
      ...(typeof r.note === "string" && r.note.trim().length > 0 ? { note: r.note.trim() } : {}),
    });
  }
  return { ok: true, rows };
}
