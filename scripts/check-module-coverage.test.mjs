import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  COVERAGE_ALLOWLIST,
  importSpecifiers,
  libModules,
  moduleCoverageGaps,
  partitionGaps,
  resolveSpecifier,
} from "./check-module-coverage.mjs";
import { projectRoot } from "./with-app-env.mjs";

/**
 * R9-f05 / R9-f06 (W45 · lane 331-6) — pins for the module-coverage guard.
 *
 * The guard exists because a `src/lib` module can be touched by *no* test while
 * every gate stays green. These tests prove it (a) finds a genuinely orphaned
 * module in a planted tree, (b) does not flag a module a test reaches directly
 * or transitively, (c) keeps an explicit allowlist rather than a blanket
 * exemption, and (d) reports the live repo as clean.
 */

const GUARD = fileURLToPath(new URL("./check-module-coverage.mjs", import.meta.url));

/** A planted, self-contained `src/lib` tree — never inside the repo. */
function fixtureRoot(files) {
  const root = mkdtempSync(join(tmpdir(), "module-coverage-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body, "utf8");
  }
  return root;
}

const PLANTED_TREE = {
  // Orphan: nothing imports it.
  "src/lib/orphan.ts": "export const orphan = 1;\n",
  // Transitively reached: direct.ts imports it, the test imports direct.ts.
  "src/lib/transitive.ts": "export const transitive = 1;\n",
  "src/lib/direct.ts": 'import { transitive } from "./transitive.ts";\nexport const direct = transitive;\n',
  // A dynamically-imported module is reached too.
  "src/lib/lazy.ts": "export const lazy = 1;\n",
  "src/lib/dynamic.ts": 'export async function load() { return import("./lazy.ts"); }\n',
  "src/lib/direct.test.ts":
    'import assert from "node:assert/strict";\nimport { test } from "node:test";\nimport { direct } from "./direct.ts";\nimport { load } from "./dynamic.ts";\ntest("x", () => { assert.equal(direct, 1); });\ntest("y", () => { assert.ok(load); });\n',
  // A scripts-leg test that imports a lib module by the `@/` alias.
  "scripts/alias.test.mjs": 'import { aliased } from "@/lib/aliased.ts";\n',
  "src/lib/aliased.ts": "export const aliased = 1;\n",
};

test("module-coverage: a module no test reaches is a gap; direct/transitive/dynamic hits are not", () => {
  const root = fixtureRoot(PLANTED_TREE);
  try {
    const { gaps, total } = moduleCoverageGaps(root);
    assert.ok(gaps.includes("src/lib/orphan.ts"), `orphan must be a gap, saw ${JSON.stringify(gaps)}`);
    for (const covered of ["src/lib/direct.ts", "src/lib/transitive.ts", "src/lib/dynamic.ts", "src/lib/lazy.ts", "src/lib/aliased.ts"]) {
      assert.ok(!gaps.includes(covered), `${covered} is reached by a test and must not be a gap`);
    }
    assert.ok(total >= 5, `expected the planted modules to be enumerated, saw ${total}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("module-coverage: the allowlist is explicit — an unknown gap is never allowed", () => {
  const planted = fixtureRoot({ "src/lib/never.ts": "export const x = 1;\n" });
  try {
    const { gaps } = moduleCoverageGaps(planted);
    const { allowlisted, unallowlisted } = partitionGaps(gaps);
    assert.deepEqual(allowlisted, [], "a planted-tree gap is never on the repo allowlist");
    assert.deepEqual(unallowlisted, ["src/lib/never.ts"]);
  } finally {
    rmSync(planted, { recursive: true, force: true });
  }
});

test("module-coverage: every allowlist entry names a module that exists and carries a reason", () => {
  const root = projectRoot();
  const modules = libModules(root).map((m) => m.replace(/\\/g, "/"));
  for (const [file, reason] of Object.entries(COVERAGE_ALLOWLIST)) {
    assert.ok(
      modules.some((m) => m.endsWith(file)),
      `allowlist entry ${file} names a module that no longer exists — remove the entry`,
    );
    assert.ok(typeof reason === "string" && reason.length > 20, `${file}: the allowlist entry needs a real reason`);
  }
});

test("module-coverage: the live repo has no NEW uncovered src/lib module", () => {
  const { gaps } = moduleCoverageGaps(projectRoot());
  const { unallowlisted } = partitionGaps(gaps);
  assert.deepEqual(
    unallowlisted,
    [],
    `src/lib module(s) reached by no test — add a test, or an allowlist entry WITH a reason:\n${unallowlisted.join("\n")}`,
  );
});

test("module-coverage: import parsing covers from/import/require and the @ alias", () => {
  const specs = importSpecifiers(
    [
      'import a from "./a.ts";',
      'import "./side-effect.ts";',
      'export { b } from "../b.ts";',
      'const c = await import("./c.ts");',
      'const d = require("./d.ts");',
    ].join("\n"),
  );
  assert.deepEqual(specs, ["./a.ts", "./side-effect.ts", "../b.ts", "./c.ts", "./d.ts"]);
  const root = projectRoot();
  const resolved = resolveSpecifier("@/lib/fixtures.ts", join(root, "scripts", "x.test.mjs"), root);
  assert.ok(resolved && resolved.replace(/\\/g, "/").endsWith("/src/lib/fixtures.ts"), `@/ alias must resolve, saw ${resolved}`);
});

test("module-coverage: the CLI runs green on the live repo and exits 0", () => {
  const run = spawnSync(process.execPath, [GUARD], { cwd: projectRoot(), encoding: "utf8" });
  assert.equal(run.status, 0, `expected exit 0\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`);
  assert.match(run.stdout, /\[module-coverage\] \d+\/\d+ src\/lib modules reached by a test/);
});
