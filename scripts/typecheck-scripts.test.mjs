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
 * Why the budget existed at all: the tree is untyped `.mjs` with almost no
 * JSDoc. Under full `strict` it reports 1334 errors (621 pure TS7006
 * implicit-any); the config disables `noImplicitAny` (and
 * `useUnknownInCatchVariables`) but KEEPS `strictNullChecks`, because turning
 * that off widens `ok: true | false` and destroys discriminated-union narrowing
 * in the transitively-imported `src/lib` files. W48 · 334-4 retired the last
 * 134 errors across 14 files, so `ERROR_BUDGET` is EMPTY: every scripts file is
 * now unbudgeted and any new error in any of them fails the ratchet.
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
 * EMPTY since W48 · 334-4 retired the last 134 errors across 14 files: no
 * scripts file is budgeted, so any error in any of them is `unbudgeted` and
 * fails the ratchet. The mechanism stays (a future red file can be budgeted
 * deliberately, with an owner), but the debt it recorded is paid.
 */
export const ERROR_BUDGET = {};

/**
 * B1-F10: the nested-proof guard. The leg below spawns the REAL
 * `npm run typecheck`; that child re-runs this file, so the heavyweight tsc legs
 * are skipped inside the nested run (the OUTER run proves them for real). A
 * skipped test still prints its own TAP line with its name, which is exactly the
 * evidence the parent leg reads. Never set outside that child.
 */
const NESTED_TYPECHECK = process.env.RT_TYPECHECK_NESTED === "1";
const NESTED_SKIP = NESTED_TYPECHECK ? "nested `npm run typecheck` proof run — the outer run proves this leg" : false;

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

test("scripts typecheck: every checkable scripts/** file is inside the program", { skip: NESTED_SKIP }, () => {
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

test("scripts typecheck: no NEW errors beyond the recorded per-file budget", { skip: NESTED_SKIP }, () => {
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

test(
  "scripts typecheck: npm run typecheck runs BOTH legs (src + scripts)",
  { skip: NESTED_SKIP },
  () => {
    // W46 · 332-4 (S1b) made `npm run typecheck` see `scripts/**`; the CLI must
    // stay inside the typecheck it guards. B1-F10: the pre-fix leg asserted on
    // `package.json`'s script TEXT, which passes even if the scripts leg is
    // dropped. This is BEHAVIOURAL — it spawns the REAL `npm run typecheck` and
    // requires the scripts ratchet (THIS file) to have RUN inside it: leg 1's
    // `tsc --noEmit` gates the `&&`, so exit 0 + this file's own TAP line is the
    // whole chain observed end to end.
    // Recursion is bounded by RT_TYPECHECK_NESTED (the nested run skips the
    // heavyweight tsc legs — the outer run proves them for real).
    // The strict program (`typecheck:scripts:strict`) is exercised behaviourally
    // by the coverage/ratchet legs above, which spawn exactly that program
    // (`tsc -p tsconfig.scripts.json --noEmit --listFiles`).
    // The bare spread keeps `process.env`'s string index signature (adding a
    // literal key here widened the object to `{ RT_TYPECHECK_NESTED: string }`
    // and made the `delete` below a TS2339); the CLI test idiom is
    // spread-then-assign.
    const env = { ...process.env };
    env.RT_TYPECHECK_NESTED = "1";
    delete env.NODE_TEST_CONTEXT;
    const res = spawnSync("npm", ["run", "typecheck"], {
      cwd: ROOT,
      env,
      encoding: "utf8",
      shell: true,
      timeout: 900_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    const out = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
    assert.equal(
      res.status,
      0,
      `\`npm run typecheck\` must succeed — leg 1 (tsc --noEmit) then leg 2 (the scripts ratchet).\n${out.slice(-4000)}`,
    );
    assert.match(
      out,
      /scripts typecheck: every checkable scripts\/\*\* file is inside the program/,
      "leg 2 (the scripts ratchet) must have RUN inside `npm run typecheck` — a script that drops it is the regression this leg catches",
    );
  },
);

test("scripts typecheck: rapidtool-cli.mjs and its taxonomy test are clean and unbudgeted", { skip: NESTED_SKIP }, () => {
  // W46 · 332-4: the CLI carried 38 of the 173 errors and its test 1; both are
  // now clean and deliberately have NO budget entry, so the generic ratchet
  // above fails on the first new error in either (a clean file is unbudgeted).
  const errors = parseTscErrors(scriptsTypecheckRun().output);
  const cliErrors = errors
    .filter((e) => e.file === "scripts/rapidtool-cli.mjs" || e.file === "scripts/cli-exit-taxonomy.test.mjs")
    .map((e) => e.message);
  assert.deepEqual(cliErrors, [], "the CLI and its taxonomy test must typecheck clean");
  assert.equal(ERROR_BUDGET["scripts/rapidtool-cli.mjs"], undefined, "a clean file must carry no ratchet budget");
  assert.equal(ERROR_BUDGET["scripts/cli-exit-taxonomy.test.mjs"], undefined, "a clean file must carry no ratchet budget");
});

test("scripts typecheck: the MEASUREMENT layer's own files are clean and unbudgeted", () => {
  // W357 · fix-gates: the W356 cartographer's R-1 was exactly this class — the
  // ratchet's own two new files arrived with 90 tsc errors because a scripts file
  // can pass `node --test` and still fail the gate through this program. They are
  // clean now, and with an EMPTY budget that is the only state they may stay in:
  // a budget entry here would let the measurement layer buy itself an exemption
  // from the typecheck it enforces everywhere else.
  const files = [
    "scripts/quality-ratchet.mjs",
    "scripts/quality-ratchet.test.mjs",
    "scripts/check-module-coverage.mjs",
    "scripts/check-module-coverage.test.mjs",
    "scripts/typecheck-scripts.test.mjs",
  ];
  const onDisk = scriptsFilesOnDisk();
  const measured = files.filter((f) => onDisk.includes(f));
  assert.deepEqual(measured, files, `expected every measurement-layer file in the program's file walk; missing ${files.filter((f) => !onDisk.includes(f)).join(", ")}`);
  const errors = parseTscErrors(scriptsTypecheckRun().output);
  const budgeted = measured.filter((f) => ERROR_BUDGET[f] !== undefined);
  assert.deepEqual(budgeted, [], `a measurement-layer file must carry no typecheck budget: ${budgeted.join(", ")}`);
  // The ratchet and its own suite must be error-free; the others are covered by
  // the generic ratchet above, which fails on the first error in any of them.
  const ratchetErrors = errors
    .filter((e) => e.file === "scripts/quality-ratchet.mjs" || e.file === "scripts/quality-ratchet.test.mjs")
    .map((e) => e.message);
  assert.deepEqual(ratchetErrors, [], "the ratchet and its suite must typecheck clean under the scripts program");
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
    // rapidtool-cli.mjs is clean and unbudgeted since W46 · 332-4, so its
    // planted error must be reported even though the file once had a budget.
    ["scripts/migration-plan.mjs", "scripts/rapidtool-cli.mjs"],
    "a NEW red file must be reported as unbudgeted — including the now-clean CLI",
  );
  // An over-budget regression in an existing entry is reported too. The real
  // budget is empty now, so pin the ceiling mechanism with a synthetic entry.
  const floodBudget = { "scripts/grok-pwa-plugin.mjs": { max: 1 } };
  const flood = Array.from(
    { length: 2 },
    () => `scripts/grok-pwa-plugin.mjs(1,1): error TS2322: planted`,
  ).join("\n");
  const floodVerdict = evaluateBudget(parseTscErrors(flood), floodBudget);
  assert.equal(floodVerdict.overBudget.length, 1);
  assert.equal(floodVerdict.overBudget[0].file, "scripts/grok-pwa-plugin.mjs");
});

test("scripts typecheck: a planted error in a real file trips the guard end-to-end", { skip: NESTED_SKIP }, () => {
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
