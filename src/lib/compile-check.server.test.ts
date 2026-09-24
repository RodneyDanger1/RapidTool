// ---------------------------------------------------------------------------
// compile-check.server.test.ts — per-file compile verdict seam + tree-run
// (src/lib/compile-check.server.ts). Real node --check + typescript
// transpile parses and REAL node:test executions over temp dirs — no mocks,
// no fabricated passes.
//
// Run: node --experimental-strip-types --test src/lib/compile-check.server.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { compileCheckDir, installToolFor, parseVerdictForSource, treeRun, verifyKindDir } from "./compile-check.server.ts";
import { scrubbedEnv } from "./node-runner.server.ts";

const tempDir = (): string => mkdtempSync(join(tmpdir(), "rapidtool-cc-"));

function write(root: string, rel: string, body: string): void {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, "utf8");
}

describe("compileCheckDir — per-file compile verdicts over a dir", () => {
  it("passes every emitted-style TS module via the typescript transpile parse", () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ type: "module" }));
      write(dir, "src/index.ts", "export const add = (a: number, b: number): number => a + b;\n");
      write(dir, "src/lib/store.ts", "export interface Row { id: string }\nexport const rows: Row[] = [];\n");
      write(dir, "tests/oracle.spec.ts", "import { test } from 'node:test';\ntest('x', () => {});\n");
      write(dir, "README.md", "# not code — skipped");
      write(dir, "assets/manifest.json", "{}");
      const r = compileCheckDir(dir);
      assert.equal(r.ok, true, `expected all-pass: ${JSON.stringify(r.verdicts)}`);
      assert.equal(r.checked, 3);
      assert.equal(r.passed, 3);
      assert.equal(r.failed, 0);
      assert.ok(r.skipped >= 2, "README/manifest are not code files");
      assert.ok(r.verdicts.every((v) => v.verdict === "pass"));
      assert.deepEqual(
        r.verdicts.map((v) => v.file),
        ["src/index.ts", "src/lib/store.ts", "tests/oracle.spec.ts"],
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("catches a TS syntax error — never a fake pass", () => {
    const dir = tempDir();
    try {
      write(dir, "src/bad.ts", "export const a: = 1;\n");
      write(dir, "src/good.ts", "export const b = 2;\n");
      const r = compileCheckDir(dir);
      assert.equal(r.ok, false);
      assert.equal(r.passed, 1);
      assert.equal(r.failed, 1);
      const bad = r.verdicts.find((v) => v.file === "src/bad.ts");
      assert.ok(bad, "bad.ts must carry a verdict");
      assert.equal(bad!.verdict, "fail");
      assert.ok((bad!.detail ?? "").length > 0, "fail verdict carries parser detail");
      const good = r.verdicts.find((v) => v.file === "src/good.ts");
      assert.equal(good!.verdict, "pass");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("checks .js/.mjs with node --check (the platform parser)", () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ type: "module" }));
      write(dir, "src/main.js", "export const x = 1;\n");
      write(dir, "src/worker.mjs", "export const y = 2;\n");
      write(dir, "src/broken.js", "const x = ;\n");
      const r = compileCheckDir(dir);
      assert.equal(r.ok, false);
      assert.equal(r.failed, 1);
      const broken = r.verdicts.find((v) => v.file === "src/broken.js");
      assert.ok(broken && broken.verdict === "fail");
      assert.ok((broken!.detail ?? "").length > 0, "node --check stderr captured");
      assert.equal(r.verdicts.filter((v) => v.verdict === "pass").length, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("never walks node_modules / VCS dirs", () => {
    const dir = tempDir();
    try {
      write(dir, "src/good.ts", "export const ok = true;\n");
      write(dir, "node_modules/pkg/index.ts", "export const a: = 1;\n"); // would fail if walked
      write(dir, ".git/config.ts", "export const b: = 1;\n"); // would fail if walked
      const r = compileCheckDir(dir);
      assert.equal(r.ok, true, "skipped dirs must not produce failures");
      assert.equal(r.checked, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors loudly on a missing dir and on a dir with no code files", () => {
    const dir = tempDir();
    try {
      const missing = compileCheckDir(join(dir, "does-not-exist"));
      assert.equal(missing.ok, false);
      assert.ok((missing.error ?? "").includes("not readable"), missing.error);

      const empty = join(dir, "docs-only");
      mkdirSync(empty, { recursive: true });
      write(empty, "README.md", "# hi");
      const none = compileCheckDir(empty);
      assert.equal(none.ok, false);
      assert.ok((none.error ?? "").includes("no checkable"), none.error);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips non-code files at the root while still checking nested code", () => {
    const dir = tempDir();
    try {
      write(dir, "tsconfig.json", "{}");
      write(dir, ".env.example", "FOO=bar");
      write(dir, ".rapidtool/project.json", "{}");
      write(dir, "src/app.ts", "export const app = 'ok';\n");
      const r = compileCheckDir(dir);
      assert.equal(r.ok, true);
      assert.equal(r.checked, 1);
      assert.ok(r.skipped >= 3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// treeRun — in-loop execution of an emitted tree (fixes/144 M3 lane B3).
// Real node:test executions under the bounded runner over temp dirs: pass /
// fail+first-not-ok-tail / timeout / UI-shell skip / purity (no writes into
// the target dir). No mocks, no fabricated passes.
// ---------------------------------------------------------------------------

/** Recursive sorted rel-path listing (dirs suffixed "/") — the purity
 *  snapshot for treeRun's read-only guarantee. */
function snapshotListing(root: string): string[] {
  const out: string[] = [];
  const walk = (cur: string): void => {
    const entries = readdirSync(cur, { withFileTypes: true, encoding: "utf8" }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
    for (const e of entries) {
      const rel = join(cur, e.name).slice(root.length + 1).split(sep).join("/");
      out.push(e.isDirectory() ? rel + "/" : rel);
      if (e.isDirectory()) walk(join(cur, e.name));
    }
  };
  walk(root);
  return out.sort();
}

/** An emitted-style headless tree: package.json "main" entry + src modules +
 *  the given tests/oracle.spec.ts body. */
function writeEmittedTree(root: string, specBody: string, extraSpecs: [string, string][] = []): void {
  write(root, "package.json", JSON.stringify({ name: "mini-emit", type: "module", main: "src/main.ts" }));
  write(root, "src/main.ts", "export const boot = (): string => 'ok';\n");
  write(root, "src/lib/rows.ts", "export interface Row { id: string }\nexport const rows: Row[] = [];\n");
  write(root, "tests/oracle.spec.ts", specBody);
  for (const [rel, body] of extraSpecs) write(root, `tests/${rel}`, body);
}

const PASSING_SPEC = [
  `import { test } from "node:test";`,
  `import assert from "node:assert/strict";`,
  `test("orc-1 arithmetic", () => { assert.equal(1 + 1, 2); });`,
  `test("orc-2 rows shape", () => { assert.deepEqual({ a: 1 }, { a: 1 }); });`,
  ``,
].join("\n");

// treeRun's spec leg executes each emitted spec as a REAL nested
// `node --test` child (compile-check.server.ts specRunnerCode). Under the
// node:test runner that hosts THIS suite, child processes inherit
// NODE_TEST_CONTEXT=child-v8, which silently disables a nested --test runner
// (it reports into the runner's IPC instead of stdout: status 0, no TAP) —
// treeRun would then fabricate a pass for specs whose assertions never ran.
// treeRun's real consumers (the CLI `emit --run` verb, the server) never run
// under the test runner, so these tests call treeRun with that var transiently
// scrubbed — the host env of every production caller — and restore it
// immediately after (the runner's own IPC channel is unaffected).
async function treeRunAsConsumer(
  dir: string,
  opts?: { timeoutMs?: number },
): Promise<Awaited<ReturnType<typeof treeRun>>> {
  const saved = process.env.NODE_TEST_CONTEXT;
  delete process.env.NODE_TEST_CONTEXT;
  try {
    return await treeRun(dir, opts);
  } finally {
    if (saved !== undefined) process.env.NODE_TEST_CONTEXT = saved;
  }
}

describe("treeRun — execute the emitted tree in-loop (fixes/144 M3/B3)", () => {
  it("green tree → pass verdicts: compile all-pass, every spec run=pass, entry smoke pass, ok:true", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC);
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true, `expected a green tree: ${JSON.stringify(r)}`);
      assert.equal(r.compile.ok, true);
      assert.equal(r.compile.checked, 3, "main.ts + rows.ts + one spec = 3 code files");
      assert.equal(r.tests.length, 1);
      const spec = r.tests[0]!;
      assert.equal(spec.file, "tests/oracle.spec.ts");
      assert.equal(spec.run, "pass");
      assert.deepEqual(spec.tests, { pass: 2, fail: 0 });
      assert.ok(r.run, "kind-entry verdict present");
      assert.equal(r.run!.run, "pass", "package.json main resolves and loads headless");
      assert.equal(r.run!.entry, "src/main.ts");
      assert.equal(r.run!.kind, "headless");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("red spec → run=fail with the first not-ok tail extractable; ok:false", async () => {
    const dir = tempDir();
    try {
      // tests/red.spec.ts sorts before tests/oracle.spec.ts — the failing
      // file is the FIRST spec verdict, exactly what the CLI error builds on.
      writeEmittedTree(
        dir,
        PASSING_SPEC,
        [
          [
            "red.spec.ts",
            [
              `import { test } from "node:test";`,
              `import assert from "node:assert/strict";`,
              `test("alpha passes", () => { assert.equal(1, 1); });`,
              `test("beta must fail", () => { assert.deepEqual({ got: 1 }, { want: 2 }); });`,
              ``,
            ].join("\n"),
          ],
        ],
      );
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, false, "a failing spec is a red tree, never ok");
      assert.equal(r.compile.ok, true, "the file parses — the red comes from RUNNING it");
      assert.equal(r.tests.length, 2);
      const red = r.tests.find((t) => t.file === "tests/red.spec.ts");
      assert.ok(red, "red.spec.ts executed");
      assert.equal(red!.run, "fail");
      assert.deepEqual(red!.tests, { pass: 1, fail: 1 });
      const tail = red!.detail ?? "";
      assert.ok(tail.includes('test "beta must fail" failed'), `first not-ok tail extractable: ${tail}`);
      assert.ok(tail.includes("want"), "assertion message from the not-ok block survives");
      assert.equal(r.run!.run, "pass", "entry smoke still green — the red is the spec's own");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a spec that sleeps forever is killed — run=timeout, no hang", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(
        dir,
        [
          `import { test } from "node:test";`,
          `test("never finishes", async () => { await new Promise((r) => setTimeout(r, 120_000)); });`,
          ``,
        ].join("\n"),
      );
      const started = Date.now();
      const r = await treeRunAsConsumer(dir, { timeoutMs: 4000 });
      const elapsed = Date.now() - started;
      assert.equal(r.ok, false);
      assert.equal(r.tests.length, 1);
      const spec = r.tests[0]!;
      assert.equal(spec.run, "timeout", `run verdict must be timeout: ${JSON.stringify(spec)}`);
      assert.ok((spec.detail ?? "").includes("killed after"), spec.detail);
      assert.ok(elapsed < 20_000, `timeout honored — treeRun returned in ${elapsed}ms, not 120s`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("UI-shell dir (root index.html, no tests/) → honest skip, never a fake pass", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "ui-shell", type: "module" }));
      write(dir, "index.html", "<!doctype html><html><body>app</body></html>\n");
      write(dir, "src/app.ts", "export const ui = 'shell';\n");
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.compile.ok, true);
      assert.equal(r.tests.length, 0, "no tests/ dir — nothing to execute");
      assert.ok(r.run, "entry verdict present for a runnable dir");
      assert.equal(r.run!.run, "skip", "UI shell is an honest skip");
      assert.equal(r.run!.entry, undefined, "no entry is resolved for a UI shell");
      assert.ok((r.run!.detail ?? "").includes("UI shell"), r.run!.detail);
      assert.equal(r.ok, true, "UI-shell skip counts green — compile pass + nothing red (185-S5: only ui-shell skip is green)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("185-S5: headless skip (no entry resolved, not a UI shell) is NOT green", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "lib-no-main", type: "module" }));
      write(dir, "src/util.ts", "export const n = 1;\n");
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.compile.ok, true);
      assert.equal(r.run!.run, "skip");
      assert.notEqual(r.run!.kind, "ui-shell");
      assert.equal(r.ok, false, "headless skip must not share green with a UI-shell skip");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("purity — treeRun writes nothing inside the target dir (listing unchanged)", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC);
      const before = snapshotListing(dir);
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true, "purity leg runs a fully-green tree (compile + spec + entry)");
      const after = snapshotListing(dir);
      assert.deepEqual(after, before, "no files/dirs may appear, vanish or move under the run dir");
      assert.equal(r.compile.checked, 3);
      assert.equal(r.tests[0]!.run, "pass");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("A3: load-only spec (import, 0 assertions) is NOT tests.pass — no behavioral assertion ran", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(
        dir,
        [
          `import * as m from "../src/main.ts";`,
          `void m;`,
          ``,
        ].join("\n"),
      );
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, false, "load-only must not mint a green tree");
      assert.equal(r.tests.length, 1);
      const spec = r.tests[0]!;
      assert.equal(spec.run, "fail");
      assert.equal(spec.tests.pass, 0);
      assert.equal(spec.detail, "no behavioral assertion ran");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("A3: empty test() with no assert is NOT green even if TAP # pass 1", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(
        dir,
        [
          `import { test } from "node:test";`,
          `import * as m from "../src/main.ts";`,
          `test("load", () => { void m; });`,
          ``,
        ].join("\n"),
      );
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, false);
      assert.equal(r.tests[0]!.run, "fail");
      assert.equal(r.tests[0]!.tests.pass, 0);
      assert.equal(r.tests[0]!.detail, "no behavioral assertion ran");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("A3: add(2,2) asserted as 4 is tests.pass (behavioral, not mere load)", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "mini-emit", type: "module", main: "src/math.ts" }));
      write(dir, "src/math.ts", "export const add = (a: number, b: number): number => a + b;\n");
      write(
        dir,
        "tests/oracle.spec.ts",
        [
          `import { test } from "node:test";`,
          `import assert from "node:assert/strict";`,
          `import { add } from "../src/math.ts";`,
          `test("add", () => { assert.equal(add(2, 2), 4); });`,
          ``,
        ].join("\n"),
      );
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true, `behavioral spec must green: ${JSON.stringify(r.tests)}`);
      assert.equal(r.tests[0]!.run, "pass");
      assert.deepEqual(r.tests[0]!.tests, { pass: 1, fail: 0 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("A3: string-quoted assert.equal is NOT a behavioral assertion (empty oracle)", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(
        dir,
        [
          `import { test } from "node:test";`,
          `test("quoted assert is not a call", () => {`,
          `  const s = "assert.equal(1, 1)";`,
          `  void s;`,
          `});`,
          ``,
        ].join("\n"),
      );
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, false, "string-literal assert must not mint green");
      assert.equal(r.tests[0]!.run, "fail");
      assert.equal(r.tests[0]!.tests.pass, 0);
      assert.equal(r.tests[0]!.detail, "no behavioral assertion ran");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("A3: empty oracle.spec.ts is NOT green", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, "\n");
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, false, "empty oracle must not mint green");
      assert.equal(r.tests.length, 1);
      assert.equal(r.tests[0]!.run, "fail");
      assert.equal(r.tests[0]!.detail, "no behavioral assertion ran");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("A3: commented-out assert is NOT green", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(
        dir,
        [
          `import { test } from "node:test";`,
          `test("commented assert", () => {`,
          `  // assert.equal(1, 1);`,
          `  /* assert.equal(2, 2); */`,
          `});`,
          ``,
        ].join("\n"),
      );
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, false);
      assert.equal(r.tests[0]!.run, "fail");
      assert.equal(r.tests[0]!.detail, "no behavioral assertion ran");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("185-S5: UI-shell skip stays green even when the record kind is app→webapp", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "ui-app", type: "module" }));
      write(dir, "index.html", "<!doctype html><html><body>app</body></html>\n");
      write(dir, "src/app.ts", "export const ui = 'shell';\n");
      write(dir, ".rapidtool/project.json", JSON.stringify({ kind: "app" }));
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.compile.ok, true);
      assert.equal(r.run!.run, "skip");
      assert.equal(r.run!.kind, "ui-shell", "record kind must not leak into the skip classification");
      assert.ok((r.run!.detail ?? "").includes("UI shell"), r.run!.detail);
      assert.equal(r.ok, true, "index.html skip is green regardless of record kind");
      assert.equal(r.sandbox, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("purity — subject bodies unchanged; compile.dir is the subject not the temp copy", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(
        dir,
        [
          `import { test } from "node:test";`,
          `import assert from "node:assert/strict";`,
          `import { writeFileSync } from "node:fs";`,
          `test("cwd write stays off the subject", () => {`,
          `  writeFileSync("src/main.ts", "export const boot = () => 'mutated';\\n");`,
          `  assert.equal(1, 1);`,
          `});`,
          ``,
        ].join("\n"),
      );
      const beforeMain = readFileSync(join(dir, "src/main.ts"), "utf8");
      const before = snapshotListing(dir);
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true, "copy absorbs the write; the spec still greens");
      assert.deepEqual(snapshotListing(dir), before, "listing unchanged");
      const afterMain = readFileSync(join(dir, "src/main.ts"), "utf8");
      assert.equal(afterMain, beforeMain, "subject body unchanged");
      assert.equal(afterMain.includes("mutated"), false, "subject did not absorb the copy's cwd write");
      assert.equal(r.dir, r.compile.dir, "compile.dir is the operator-facing subject");
      assert.equal(r.compile.dir.includes("rt-treerun-"), false, "compile.dir must not leak the temp copy");
      assert.equal(r.sandbox, false, "treeRun advertises sandbox:false");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 216 T-18 — the emitted project's OWN toolchain: `npm run typecheck` and
// `npm test` exactly as the tree declares them, run under the same bounded
// runner. The hard rule: a tree that fails its own `npm test` can NEVER be
// ok:true. An un-runnable declared script is a loud skip + note — never a
// fabricated pass, never a silent ok. Real npm + real trees, no mocks.
// ---------------------------------------------------------------------------

describe("216 T-18 — the emitted project's own typecheck/test scripts", () => {
  /** package.json carrying declared scripts + a green spec + main entry. */
  const writeScriptTree = (
    root: string,
    scripts: Record<string, string>,
    extras: [string, string][] = [],
  ): void => {
    write(
      root,
      "package.json",
      JSON.stringify({ name: "mini-emit", type: "module", main: "src/main.ts", scripts }),
    );
    write(root, "src/main.ts", "export const boot = (): string => 'ok';\n");
    write(root, "tests/oracle.spec.ts", PASSING_SPEC);
    for (const [rel, body] of extras) write(root, rel, body);
  };

  it("runs the tree's OWN declared scripts for real and passes them (exit codes carried)", async () => {
    const dir = tempDir();
    try {
      writeScriptTree(dir, {
        typecheck: "node --version",
        test: "node --experimental-strip-types --test tests/oracle.spec.ts",
      });
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true, `green project leg must stay green: ${JSON.stringify(r.project)}`);
      assert.ok(r.project, "treeRun always sets the project leg");
      assert.equal(r.project!.typecheck.run, "pass");
      assert.equal(r.project!.typecheck.exitCode, 0);
      assert.equal(r.project!.test.run, "pass", "the tree's own npm test ran and exited 0");
      assert.equal(r.project!.test.exitCode, 0);
      assert.equal(
        r.project!.test.command,
        "node --experimental-strip-types --test tests/oracle.spec.ts",
        "the command is carried verbatim from the emitted package.json",
      );
      assert.equal(r.project!.ok, true);
      assert.equal(r.note, undefined, "a fully-run project leg is not note-worthy");
      assert.equal(r.error, undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("THE T-18 RULE: a tree failing its own npm test is NEVER ok:true — even with every spec leg green", async () => {
    const dir = tempDir();
    try {
      // scripts/selfcheck.mjs is deliberately OUTSIDE tests/*.spec.* — the
      // per-spec leg stays green and the ONLY red is the tree's own npm test.
      writeScriptTree(dir, { typecheck: "node --version", test: "node scripts/selfcheck.mjs" }, [
        ["scripts/selfcheck.mjs", "process.exit(1);\n"],
      ]);
      const r = await treeRunAsConsumer(dir);
      assert.ok(r.tests.every((t) => t.run === "pass"), "spec leg green — the red is the project's own");
      assert.equal(r.compile.ok, true, "every file parses — the red came from RUNNING the project's own test");
      assert.equal(r.project!.test.run, "fail", "the tree's own test ran and failed");
      assert.equal(r.project!.test.exitCode, 1);
      assert.equal(r.project!.ok, false);
      assert.equal(r.ok, false, "a tree that fails its own npm test can NEVER be ok:true");
      assert.ok(
        (r.error ?? "").includes("npm run test"),
        `the top-level error names the red script: ${r.error}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a declared typecheck that runs RED makes the tree not ok; exit code + bounded tail ride the verdict", async () => {
    const dir = tempDir();
    try {
      writeScriptTree(dir, { typecheck: "node scripts/tc.mjs", test: "node --version" }, [
        ["scripts/tc.mjs", "console.error('TS9999: synthetic type error');\nprocess.exit(2);\n"],
      ]);
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.project!.typecheck.run, "fail");
      assert.equal(r.project!.typecheck.exitCode, 2);
      assert.ok(
        (r.project!.typecheck.detail ?? "").includes("TS9999"),
        `the bounded output tail is carried: ${r.project!.typecheck.detail}`,
      );
      assert.equal(r.ok, false);
      assert.ok((r.error ?? "").includes("npm run typecheck"), r.error);
      assert.equal(r.project!.test.run, "pass", "the other declared script still ran and passed");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("declared but UNINSTALLED toolchain → honest skip + note; never a fabricated pass, never silent", async () => {
    const dir = tempDir();
    try {
      // tsc/vite are declared devDependencies of the real scaffold but there is
      // no node_modules here — the tools are NOT the project's toolchain yet.
      writeScriptTree(dir, { typecheck: "tsc --noEmit", test: "vite --version" });
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.project!.typecheck.run, "skip");
      assert.equal(r.project!.test.run, "skip");
      assert.notEqual(r.project!.typecheck.run, "pass", "a skip is never a pass");
      assert.match(r.project!.typecheck.note ?? "", /UNVERIFIED/);
      assert.match(r.project!.typecheck.note ?? "", /tsc/);
      assert.match(r.project!.typecheck.note ?? "", /not a fabricated pass/);
      assert.ok(
        (r.note ?? "").includes("UNVERIFIED"),
        "the top-level note makes the skip loud — an ok verdict is never silent about it",
      );
      assert.equal(r.project!.ok, true, "a skip is not a red — nothing declared actually failed");
      assert.equal(r.ok, true);
      assert.equal(r.error, undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("no declared scripts → skips say exactly that (absent is not a pass); green tree unchanged", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC);
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true);
      assert.equal(r.project!.typecheck.run, "skip");
      // writeEmittedTree's package.json carries NO scripts block — the honest
      // note for that shape names it, and names the script it did not find.
      assert.match(r.project!.typecheck.note ?? "", /no package\.json "scripts" block/);
      assert.match(r.project!.typecheck.note ?? "", /"typecheck" was not declared/);
      assert.equal(r.project!.test.run, "skip");
      assert.match(r.project!.test.note ?? "", /no package\.json "scripts" block/);
      assert.match(r.project!.test.note ?? "", /"test" was not declared/);
      assert.equal(
        r.note,
        undefined,
        "nothing was DECLARED, so there is no unverified-declared-script note",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an own test that outlives the bound is killed → run:timeout, ok:false (bounded, never a hang)", async () => {
    const dir = tempDir();
    try {
      writeScriptTree(dir, { typecheck: "node --version", test: "node scripts/sleep.mjs" }, [
        ["scripts/sleep.mjs", "setTimeout(() => {}, 120_000);\n"],
      ]);
      const started = Date.now();
      const r = await treeRunAsConsumer(dir, { timeoutMs: 5000 });
      const elapsed = Date.now() - started;
      assert.equal(r.ok, false, "a timed-out own test is a red tree, never a pass");
      assert.equal(r.project!.test.run, "timeout");
      assert.ok(elapsed < 30_000, `bounded: treeRun returned in ${elapsed}ms, not 120s`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 217d T-18 — the emitted project's OWN declared `build` script: executed
// ONLY when the tree's dependencies are installed (node_modules/ present in
// the run copy); otherwise the honest skip + UNVERIFIED note. Same hard rule
// as typecheck/test: a declared build that ran red can never be ok:true, and
// deps absent is never a pass.
// ---------------------------------------------------------------------------

describe("217d T-18 — the emitted project's own build script", () => {
  /** package.json carrying a declared `build` + a green spec + main entry. */
  const writeBuildTree = (root: string, build: string, extras: [string, string][] = []): void => {
    write(
      root,
      "package.json",
      JSON.stringify({ name: "mini-emit", type: "module", main: "src/main.ts", scripts: { build } }),
    );
    write(root, "src/main.ts", "export const boot = (): string => 'ok';\n");
    write(root, "tests/oracle.spec.ts", PASSING_SPEC);
    for (const [rel, body] of extras) write(root, rel, body);
  };

  it("(a) no node_modules → build stays the honest skip + UNVERIFIED note; never a fabricated pass", async () => {
    const dir = tempDir();
    try {
      writeBuildTree(dir, "vite build");
      const r = await treeRunAsConsumer(dir);
      assert.ok(r.project, "treeRun always sets the project leg");
      const build = r.project!.build;
      assert.ok(build, "the build verdict is always present");
      assert.equal(build!.run, "skip", "a declared build without installed deps is never executed");
      assert.equal(build!.command, "vite build", "the command is carried verbatim from the emitted package.json");
      assert.match(build!.note ?? "", /no node_modules\//);
      assert.match(build!.note ?? "", /UNVERIFIED \(npm install, then re-run to verify\)/);
      assert.match(build!.note ?? "", /not a fabricated pass/);
      assert.notEqual(build!.run, "pass", "a skip is never a pass");
      assert.equal(r.project!.ok, true, "a skip is not a red — nothing declared actually failed");
      assert.match(r.note ?? "", /npm run build/, "the skip is loud at the top level");
      assert.match(r.note ?? "", /UNVERIFIED/, "an ok verdict is never silent about the unverified build");
      assert.equal(r.ok, true, "the rest of the tree is green; the unverified build rides the loud note");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(b) deps present + build exits 0 → build.run pass; the declared build really ran (sentinel)", async () => {
    const dir = tempDir();
    const sentinelDir = tempDir();
    const sentinel = join(sentinelDir, "built.txt");
    try {
      const marker = `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(sentinel)}, "built");\n`;
      writeBuildTree(dir, "node build-marker.mjs", [["build-marker.mjs", marker]]);
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      const before = snapshotListing(dir);
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true, `a green tree with a passing build stays ok: ${JSON.stringify(r)}`);
      assert.ok(r.project?.build, "the build verdict is present");
      assert.equal(r.project!.build!.run, "pass", "the declared build ran and exited 0");
      assert.equal(r.project!.build!.exitCode, 0);
      assert.equal(readFileSync(sentinel, "utf8"), "built", "the build script's side effect proves it executed");
      assert.deepEqual(snapshotListing(dir), before, "the subject dir is read-only — only the temp copy ran the build");
      assert.equal(r.project!.ok, true);
      assert.equal(r.error, undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(sentinelDir, { recursive: true, force: true });
    }
  });

  it("(c) deps present + build exits 2 → build.run fail with the coded failure preserved; ok:false", async () => {
    const dir = tempDir();
    try {
      writeBuildTree(dir, "node build-fail.mjs", [
        ["build-fail.mjs", "console.error('BUILD-9001: synthetic build failure');\nprocess.exit(2);\n"],
      ]);
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, false, "a red declared build can never be ok:true");
      assert.ok(r.project?.build, "the build verdict is present");
      assert.equal(r.project!.build!.run, "fail");
      assert.equal(r.project!.build!.exitCode, 2, "the coded failure (exit 2) is preserved");
      assert.match(r.project!.build!.detail ?? "", /BUILD-9001/);
      assert.equal(r.project!.ok, false);
      assert.match(r.error ?? "", /npm run build/, "the top-level error names the red build");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("B1 verifyKindDir", () => {
  it("skips honestly when there is no build script", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "x", scripts: { test: "true" } }));
      const r = await verifyKindDir(dir);
      assert.equal(r.ok, true);
      assert.equal(r.skipped, true);
      assert.equal(r.scratch, false, "no build script ⇒ no scratch copy, no install leg");
      assert.equal(r.install, undefined, "the install leg never runs without a build script");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs the declared build script and reports fail honestly", async () => {
    const dir = tempDir();
    try {
      write(
        dir,
        "package.json",
        JSON.stringify({ name: "x", scripts: { build: "node -e \"process.exit(2)\"" } }),
      );
      // The install command rides the documented test seam (compile-check's 216z
      // contract): without it this tree has no lockfile and would resolve deps
      // over the network. A seam install is marked `mocked: true` and is never
      // evidence that a real install happened — asserted below so the honesty
      // marking cannot silently regress.
      const r = await verifyKindDir(dir, {
        timeoutMs: 30_000,
        installCommand: "node -e \"process.exit(0)\"",
      });
      assert.equal(r.ok, false);
      assert.equal(r.scratch, true, "a build script ⇒ the scratch-copy install leg runs");
      assert.equal(r.install?.run, "pass", "the seam install passed");
      assert.equal(r.install?.mocked, true, "a seam install is marked mocked, never real");
      assert.equal(r.build?.run, "fail", "the declared build script's real exit code is reported");
      assert.equal(r.build?.exitCode, 2);
      assert.equal(r.code, "RT_E_VERIFY_KIND_FAILED");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("seam install exit 0 → install pass/mocked/seam; the declared build really ran; the subject dir is untouched", async () => {
    const dir = tempDir();
    const sentinelDir = tempDir();
    const sentinel = join(sentinelDir, "build-ran.txt");
    try {
      const marker = `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(sentinel)}, "built");\n`;
      write(dir, "package.json", JSON.stringify({ name: "x", scripts: { build: "node scripts/marker.mjs" } }));
      write(dir, "scripts/marker.mjs", marker);
      const before = snapshotListing(dir);
      const beforePkg = readFileSync(join(dir, "package.json"), "utf8");
      const r = await verifyKindDir(dir, {
        timeoutMs: 30_000,
        installCommand: 'node -e "process.exit(0)"',
      });
      assert.equal(r.ok, true, `expected install-pass + build-pass: ${JSON.stringify(r)}`);
      assert.equal(r.scratch, true, "a build script ⇒ the scratch-copy install leg runs");
      assert.equal(r.install?.run, "pass");
      assert.equal(r.install?.mocked, true, "a seam install is marked mocked, never real");
      assert.equal(r.install?.tool, "seam", "the seam install is labelled `seam`, not npm");
      assert.equal(r.install?.exitCode, 0);
      assert.match(r.install?.reason ?? "", /NOT evidence of a real dependency install/);
      assert.equal(r.build?.run, "pass", "the declared build really ran (exit 0)");
      assert.equal(r.build?.exitCode, 0);
      assert.equal(readFileSync(sentinel, "utf8"), "built", "the build script's side effect proves it executed");
      assert.equal(r.code, undefined);
      assert.deepEqual(snapshotListing(dir), before, "the subject dir's file list is untouched — the scratch copy is the point");
      assert.equal(readFileSync(join(dir, "package.json"), "utf8"), beforePkg, "the subject package.json is byte-identical");
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(sentinelDir, { recursive: true, force: true });
    }
  });

  it("seam install exit ≠ 0 → coded failure; build/test short-circuit with the exact reason (never silently absent)", async () => {
    const dir = tempDir();
    try {
      write(
        dir,
        "package.json",
        JSON.stringify({ name: "x", scripts: { build: 'node -e "0"', test: "node --version" } }),
      );
      const r = await verifyKindDir(dir, {
        timeoutMs: 30_000,
        installCommand: 'node -e "process.exit(3)"',
      });
      assert.equal(r.ok, false);
      assert.equal(r.scratch, true);
      assert.equal(r.install?.run, "fail");
      assert.equal(r.install?.exitCode, 3, "the install's real exit code is carried");
      assert.equal(r.code, "RT_E_VERIFY_KIND_FAILED");
      assert.equal(r.build?.run, "skip", "the declared build is never executed after a red install");
      assert.equal(r.test?.run, "skip", "the declared test is never executed after a red install");
      assert.equal(r.build?.command, undefined, "nothing ran — no command is claimed for the build");
      assert.match(r.build?.note ?? "", /install did not complete \(fail\)/);
      assert.match(r.build?.note ?? "", /the declared build was NOT executed/);
      assert.match(r.build?.note ?? "", /fix the install failure and re-run/);
      assert.match(r.test?.note ?? "", /the declared test was NOT executed/);
      assert.match(r.detail ?? "", /the declared build\/test scripts were NOT executed/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a seam install that never exits is killed at installTimeoutMs → install.run timeout, bounded", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "x", scripts: { build: 'node -e "0"' } }));
      const started = Date.now();
      const r = await verifyKindDir(dir, {
        installTimeoutMs: 4000,
        installCommand: 'node -e "setTimeout(() => {}, 60_000)"',
      });
      const elapsed = Date.now() - started;
      assert.equal(r.ok, false);
      assert.equal(r.install?.run, "timeout", `the install must be classified timeout: ${JSON.stringify(r.install)}`);
      assert.equal(r.code, "RT_E_VERIFY_KIND_FAILED");
      assert.equal(r.build?.run, "skip");
      assert.match(r.build?.note ?? "", /install did not complete \(timeout\)/);
      assert.ok(elapsed < 30_000, `bounded: verifyKindDir returned in ${elapsed}ms, not 60s`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("installToolFor: lockfile present → npm ci; absent → npm install (honest mapping, no network needed)", () => {
    const locked = tempDir();
    const unlocked = tempDir();
    try {
      write(locked, "package-lock.json", "{}");
      const ci = installToolFor(locked);
      assert.equal(ci.tool, "npm ci");
      assert.equal(ci.command, "npm ci --no-audit --no-fund");
      assert.match(ci.reason, /package-lock\.json present/);
      const install = installToolFor(unlocked);
      assert.equal(install.tool, "npm install");
      assert.equal(install.command, "npm install --no-audit --no-fund");
      assert.match(install.reason, /no package-lock\.json/);
    } finally {
      rmSync(locked, { recursive: true, force: true });
      rmSync(unlocked, { recursive: true, force: true });
    }
  });

  // Opt-in (216z contract): the REAL npm path is gated behind
  // RT_VERIFYKIND_INSTALL=1 — without the env var this stays a skip, never a
  // fake pass, and the default suite never touches the network.
  it(
    "216z opt-in: the REAL npm install leg runs (RT_VERIFYKIND_INSTALL=1)",
    { skip: process.env.RT_VERIFYKIND_INSTALL !== "1" },
    async () => {
      const dir = tempDir();
      try {
        write(dir, "package.json", JSON.stringify({ name: "x", scripts: { build: "node scripts/ok.mjs" } }));
        write(dir, "scripts/ok.mjs", "process.exit(0);\n");
        const r = await verifyKindDir(dir, { timeoutMs: 120_000, installTimeoutMs: 120_000 });
        assert.equal(r.install?.run, "pass", `real install must pass: ${JSON.stringify(r.install)}`);
        assert.equal(r.install?.tool, "npm install", "no lockfile → the real npm install path (no seam)");
        assert.equal(r.install?.mocked, undefined, "a real install carries no mocked marker");
        assert.equal(r.build?.run, "pass", "the declared build ran after the real install");
        assert.equal(r.ok, true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});

describe("B4/174-5 scrubbedEnv never copies API keys", () => {
  it("does not include DEEPSEEK_API_KEY even when present on process.env", () => {
    const prev = process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_API_KEY = "sk-test-must-not-leak";
    try {
      const env = scrubbedEnv();
      assert.equal(env.DEEPSEEK_API_KEY, undefined);
    } finally {
      if (prev === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = prev;
    }
  });
});

// ---------------------------------------------------------------------------
// 216 T-02 — the parse gate that lets the emit path REFUSE a non-parsing row
// before it is written. Ties the T-01 corruption to a refusal the writer can act
// on: the residue the pre-216 CJS strip produced must FAIL this gate.
// ---------------------------------------------------------------------------

describe("216 T-02 — parseVerdictForSource gates writes before they happen", () => {
  it("passes a healthy generated module body", () => {
    const v = parseVerdictForSource("src/generated/chunk-0.ts", "export function a(): number { return 1; }\n");
    assert.equal(v.verdict, "pass");
  });

  it("FAILS the exact residue the pre-216 CJS strip left behind (the 431-error class)", () => {
    // What `stripCjsExportAssignments` used to emit for a MULTI-LINE
    // `module.exports = { a, b };`: the opener dropped, the body orphaned —
    // bare identifiers plus a dangling `};`. This must never be written.
    const residue = ["function a() { return 1; }", "  a,", "  b,", "};", ""].join("\n");
    const v = parseVerdictForSource("src/generated/chunk-0.ts", residue);
    assert.equal(v.verdict, "fail", "the corruption class must not pass the gate");
    assert.ok(typeof v.detail === "string" && v.detail.length > 0, "the refusal carries a reason");
  });

  it("FAILS an empty/whitespace source — a refusal, never a pass", () => {
    assert.equal(parseVerdictForSource("src/generated/chunk-0.ts", "   \n").verdict, "fail");
  });

  it("reports null — NOT pass — for an uncheckable extension", () => {
    // Unknown must never be silently treated as success by the caller.
    assert.equal(parseVerdictForSource("README.md", "# hi\n").verdict, null);
  });

  it("passes the POST-216 stripped output of a multi-line CJS construct (T-01 + T-02 compose)", async () => {
    const { stripCjsExportAssignments } = await import("./codegen.server.ts");
    const src = [
      "function a() { return 1; }",
      "function b() { return 2; }",
      "module.exports = {",
      "  a,",
      "  b,",
      "};",
      "",
    ].join("\n");
    const stripped = stripCjsExportAssignments(src, ["a", "b"]);
    assert.equal(
      parseVerdictForSource("src/generated/chunk-0.ts", stripped).verdict,
      "pass",
      "the T-01 fix produces output the T-02 gate accepts",
    );
  });
});
