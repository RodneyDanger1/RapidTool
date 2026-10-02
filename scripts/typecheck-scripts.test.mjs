import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";
import { projectRoot } from "./with-app-env.mjs";

/**
 * R15-f04 / WA-02 (W45 · lane 331-6) — pins the scripts-tree typecheck.
 *
 * `tsconfig.scripts.json` is the only tsconfig that puts `scripts/**` inside a
 * tsc program (`npm run typecheck`'s tsconfig.json sees only `src` + `server`).
 * This suite pins the two things that make it a real gate rather than a
 * decoration:
 *
 *   1. **Coverage** — every checkable file on disk under `scripts/` is in the
 *      program. A file that drops out (a rename, a `.d.mts` shadowing its
 *      `.mjs`, a bad include) fails here instead of silently going unchecked.
 *   2. **Ratchet** — the recorded error budget can only shrink. Any error in a
 *      file that is not budgeted, or any file that grows past its budget, is a
 *      failure. The budget is deliberately explicit and per-file so a reviewer
 *      sees exactly which files are still red and who owns them.
 *
 * Why the budget exists at all: the tree is untyped `.mjs` with almost no
 * JSDoc. Under full `strict` it reports 1334 errors (621 pure TS7006
 * implicit-any); the config disables `noImplicitAny` (and
 * `useUnknownInCatchVariables`) but KEEPS `strictNullChecks`, because turning
 * that off widens `ok: true | false` and destroys discriminated-union narrowing
 * in the transitively-imported `src/lib` files. 173 errors remain — the
 * migration is real work, not a switch.
 *
 * `--test-reporter=tap` is irrelevant here (this spawns `tsc`, not `node
 * --test`); the tsc invocation always prints its own diagnostics and this suite
 * parses stderr+stdout text, never a filtered exit code.
 */

const ROOT = projectRoot();
const CONFIG = "tsconfig.scripts.json";
const TSC_BIN = join(ROOT, "node_modules", "typescript", "bin", "tsc");

/** Extensions tsc pulls into the program when `allowJs` + `checkJs` are on. */
const CHECKABLE_EXT_RE = /\.(?:mjs|mts|cjs|js)$/;
const FILE_LINE_RE = /^(.+?\.(?:mjs|mts|cjs|js))\((\d+),(\d+)\): error (TS\d+):/;

/**
 * Per-file error budget, measured 2026-10-02 with the checked-in config.
 * `max` is a ceiling: fixing errors is free, adding them is not. Every file
 * with a non-zero count on disk must appear here; a clean file must not.
 * `owner` names the lane that owns the file so a red count can be chased.
 */
export const ERROR_BUDGET = {
  "scripts/rapidtool-cli.mjs": { max: 38, owner: "331-1 Keywright (not 331-6's file)" },
  "scripts/run-eval.test.mjs": { max: 64, owner: "331-6 (mock shapes vs typed src API)" },
  "scripts/run-eval.mjs": { max: 25, owner: "331-6" },
  "scripts/preview.test.mjs": { max: 10, owner: "331-6" },
  "scripts/grok-pwa-shared.mjs": { max: 6, owner: "331-6 (was shadowed out of the program)" },
  "scripts/write-atomic.test.mjs": { max: 5, owner: "331-6" },
  "scripts/browser-guard.mjs": { max: 5, owner: "331-6" },
  "scripts/with-app-env.test.mjs": { max: 4, owner: "331-6" },
  "scripts/check-auth-invariant.test.mjs": { max: 4, owner: "331-6" },
  "scripts/next-action-arm-parity.test.mjs": { max: 3, owner: "331-6" },
  "scripts/browser-smoke.mjs": { max: 2, owner: "331-6" },
  "scripts/brand-check.test.mjs": { max: 2, owner: "331-6" },
  "scripts/migration-plan.test.mjs": { max: 2, owner: "331-6" },
  "scripts/grok-pwa-plugin.mjs": { max: 1, owner: "331-6" },
  "scripts/grok-pwa-plugin.test.mjs": { max: 1, owner: "331-6" },
  "scripts/cli-exit-taxonomy.test.mjs": { max: 1, owner: "331-1 Keywright (not 331-6's file)" },
};

/** POSIX, repo-relative — the form the budget keys and tsc diagnostics share. */
function relPosix(abs) {
  return relative(ROOT, abs).replace(/\\/g, "/");
}

/** Every checkable file under `scripts/`, repo-relative, sorted. */
export function scriptsFilesOnDisk(root = ROOT) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (CHECKABLE_EXT_RE.test(entry.name)) out.push(relPosix(full));
    }
  };
  walk(join(root, "scripts"));
  return out.sort();
}

/** tsc `--listFiles` line for a program file (Windows backslashes normalized). */
export function programFiles(output) {
  const rootPosix = ROOT.replace(/\\/g, "/").replace(/\/+$/, "");
  const files = [];
  for (const raw of output.split("\n")) {
    const line = raw.trim().replace(/\\/g, "/");
    if (!line || !CHECKABLE_EXT_RE.test(line)) continue;
    // Only the repo's own scripts tree counts; an imported node_modules path
    // that happens to contain a /scripts/ segment must not inflate coverage.
    if (!line.startsWith(`${rootPosix}/scripts/`)) continue;
    files.push(line.slice(rootPosix.length + 1));
  }
  return [...new Set(files)].sort();
}

/** `file:line:col: code` for every tsc diagnostic, with the raw message. */
export function parseTscErrors(output) {
  const errors = [];
  for (const raw of output.split("\n")) {
    const m = FILE_LINE_RE.exec(raw.trim());
    if (m) {
      errors.push({
        file: m[1].replace(/\\/g, "/").replace(/^.*?(\/scripts\/)/, "scripts/"),
        line: Number(m[2]),
        col: Number(m[3]),
        code: m[4],
        message: raw.trim(),
      });
    }
  }
  return errors;
}

function countByFile(errors) {
  const counts = {};
  for (const e of errors) counts[e.file] = (counts[e.file] ?? 0) + 1;
  return counts;
}

/**
 * The ratchet. Returns the failures a reviewer would care about:
 *  - `unbudgeted`: a file with errors that has no budget entry (a NEW red file)
 *  - `overBudget`: a budgeted file that grew past its ceiling
 *  - `stale`: budget entries whose file no longer exists on disk
 * A file that shrank, or a budget entry that shrank to 0, is not a failure.
 */
export function evaluateBudget(errors, budget, filesOnDisk = scriptsFilesOnDisk()) {
  const counts = countByFile(errors);
  const unbudgeted = [];
  const overBudget = [];
  for (const [file, count] of Object.entries(counts)) {
    const entry = budget[file];
    if (!entry) unbudgeted.push({ file, count });
    else if (count > entry.max) overBudget.push({ file, count, max: entry.max });
  }
  const stale = Object.keys(budget).filter((f) => !filesOnDisk.includes(f));
  return { unbudgeted, overBudget, stale, counts };
}

let cachedRun = null;
/** Run the scripts program once per test process: coverage list + diagnostics. */
function scriptsTypecheckRun() {
  if (cachedRun) return cachedRun;
  const res = spawnSync(
    process.execPath,
    [TSC_BIN, "-p", CONFIG, "--noEmit", "--listFiles"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  cachedRun = {
    status: res.status,
    output: `${res.stdout ?? ""}\n${res.stderr ?? ""}`,
    error: res.error ?? null,
  };
  return cachedRun;
}

test("scripts typecheck: every checkable scripts/** file is inside the program", () => {
  const run = scriptsTypecheckRun();
  assert.equal(run.error, null, `tsc could not be spawned: ${run.error}`);
  const onDisk = scriptsFilesOnDisk();
  const inProgram = programFiles(run.output);
  const missing = onDisk.filter((f) => !inProgram.includes(f));
  assert.deepEqual(
    missing,
    [],
    `tsc's program is missing ${missing.length} scripts file(s) — they are invisible to the typecheck:\n${missing.join("\n")}`,
  );
  // The program may pull in extra files (imported src/lib/*.ts); it must never
  // have FEWER scripts files than the disk walk found.
  assert.ok(
    inProgram.length >= onDisk.length,
    `program lists ${inProgram.length} scripts files, disk has ${onDisk.length}`,
  );
});

test("scripts typecheck: no NEW errors beyond the recorded per-file budget", () => {
  const run = scriptsTypecheckRun();
  const errors = parseTscErrors(run.output);
  const { unbudgeted, overBudget, stale, counts } = evaluateBudget(errors, ERROR_BUDGET);
  const detail = [
    unbudgeted.length ? `new red file(s):\n${unbudgeted.map((u) => `  ${u.file}: ${u.count} error(s)`).join("\n")}` : "",
    overBudget.length
      ? `over budget:\n${overBudget.map((o) => `  ${o.file}: ${o.count} > ${o.max}${ERROR_BUDGET[o.file]?.owner ? ` (${ERROR_BUDGET[o.file].owner})` : ""}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  assert.deepEqual(
    { unbudgeted, overBudget },
    { unbudgeted: [], overBudget: [] },
    `the scripts typecheck regressed:\n${detail}\n\ncurrent counts:\n${JSON.stringify(counts, null, 2)}`,
  );
  // A budget entry for a file that no longer exists is a lie about coverage.
  assert.deepEqual(stale, [], `budget names file(s) that are gone: ${stale.join(", ")}`);
});

test("scripts typecheck: the budget parser has teeth (a planted error is flagged)", () => {
  // Real tsc diagnostic shape, not a hand-rolled string the parser was written to.
  const planted = [
    `scripts/migration-plan.mjs(1,1): error TS2322: Type 'string' is not assignable to type 'number'.`,
    `node.exe : a notice line that is not a diagnostic`,
    `scripts/rapidtool-cli.mjs(9,3): error TS2339: Property 'x' does not exist on type '{}'.`,
  ].join("\n");
  const errors = parseTscErrors(planted);
  assert.equal(errors.length, 2, "only real diagnostics are parsed");
  assert.equal(errors[0].file, "scripts/migration-plan.mjs");
  assert.equal(errors[0].line, 1);
  assert.equal(errors[0].code, "TS2322");
  const verdict = evaluateBudget(errors, ERROR_BUDGET);
  assert.deepEqual(
    verdict.unbudgeted.map((u) => u.file),
    ["scripts/migration-plan.mjs"],
    "a NEW red file must be reported as unbudgeted",
  );
  // An over-budget regression in an existing entry is reported too.
  const flood = Array.from(
    { length: ERROR_BUDGET["scripts/grok-pwa-plugin.mjs"].max + 1 },
    () => `scripts/grok-pwa-plugin.mjs(1,1): error TS2322: planted`,
  ).join("\n");
  const floodVerdict = evaluateBudget(parseTscErrors(flood), ERROR_BUDGET);
  assert.equal(floodVerdict.overBudget.length, 1);
  assert.equal(floodVerdict.overBudget[0].file, "scripts/grok-pwa-plugin.mjs");
});

test("scripts typecheck: a planted error in a real file trips the guard end-to-end", () => {
  // Spawns tsc over a planted temp file with the same checker flags the config
  // uses, so the RED proof exercises real tsc output rather than a fixture.
  const dir = mkdtempSync(join(tmpdir(), "scripts-typecheck-"));
  const file = join(dir, "planted.mjs");
  try {
    writeFileSync(file, '/** @type {number} */\nexport const planted = "not a number";\n');
    const res = spawnSync(
      process.execPath,
      [TSC_BIN, "--noEmit", "--allowJs", "--checkJs", "--target", "es2022", "--module", "esnext", file],
      { cwd: ROOT, encoding: "utf8" },
    );
    const errors = parseTscErrors(res.stdout ?? "");
    assert.equal(errors.length, 1, `expected tsc to reject the planted file:\n${res.stdout}`);
    assert.equal(errors[0].code, "TS2322");
    const verdict = evaluateBudget(errors, ERROR_BUDGET);
    assert.equal(verdict.unbudgeted.length, 1, "the planted error is not in the budget and must fail the ratchet");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
