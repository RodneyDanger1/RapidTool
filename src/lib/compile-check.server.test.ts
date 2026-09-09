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
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { compileCheckDir, treeRun, verifyKindDir } from "./compile-check.server.ts";
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
      assert.equal(r.ok, true, "skip counts green — compile pass + nothing red");
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
});

describe("B1 verifyKindDir", () => {
  it("skips honestly when there is no build script", () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "x", scripts: { test: "true" } }));
      const r = verifyKindDir(dir);
      assert.equal(r.ok, true);
      assert.equal(r.skipped, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs the declared build script and reports fail honestly", () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "x", scripts: { build: "node -e \"process.exit(2)\"" } }));
      const r = verifyKindDir(dir, { timeoutMs: 30_000 });
      assert.equal(r.ok, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
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
