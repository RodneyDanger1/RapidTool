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
import { SUPPLY_CHAIN_AUDIT_COMMAND, compileCheckDir, installToolFor, parseVerdictForSource, supplyChainFloorFor, treeRun, treeSubstanceOf, treeVerdictHash, verifyKindDir } from "./compile-check.server.ts";
import { inventoryFromJobSources } from "./doctor.ts";
import { collectJobSources } from "./headless.ts";
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

  // -------------------------------------------------------------------------
  // 330 Transit — the emitted product's GENERATED CORE must actually LOAD.
  // A UI-shell tree skips the kind-entry smoke (the UI is not executable
  // headless) and its emitted spec imports only its own surfaces, so without
  // this the generated code could be unloadable while every gate read green.
  // -------------------------------------------------------------------------
  const JOB_CORE_RECORD = (file: string): string =>
    JSON.stringify({ kind: "app", specGraph: { nodes: [{ id: "job-flip", file }], order: ["job-flip"] } });

  it("330 Transit: a UI-shell tree's generated core is load-smoked — a CommonJS core reds the tree", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "ui-cjs-core", type: "module" }));
      write(dir, "index.html", "<!doctype html><html><body>app</body></html>\n");
      // The precise unloadable shape: raw P6 CommonJS embedded verbatim into
      // the `"type":"module"` package. A pre-331 emit reached this (the
      // materializer early-returned on zero rows); the dir can still exist on
      // disk (a stale emit, a `--force` survivor, a direct scaffold caller),
      // so the core smoke must red it.
      write(dir, "src/jobs/flip.ts", "function add(a, b) { return a + b; }\nmodule.exports.add = add;\n");
      write(dir, ".rapidtool/project.json", JOB_CORE_RECORD("src/jobs/flip.ts"));
      const r = await treeRunAsConsumer(dir);
      assert.ok(r.run, "kind-entry verdict present");
      assert.equal(r.run!.run, "skip", "the UI shell itself stays an honest skip");
      assert.equal(r.run!.kind, "ui-shell");
      assert.ok(r.core, "the generated core was resolved and smoke-loaded");
      assert.equal(r.core!.entry, "src/jobs/flip.ts");
      assert.equal(r.core!.run, "fail", "a CommonJS body cannot load in the ESM package");
      assert.equal(r.ok, false, "an unloadable generated core is never ok:true");
      assert.ok((r.error ?? "").includes("generated core module failed to LOAD"), r.error);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("330 Transit: a UI-shell tree with a LOADABLE generated core stays green (control)", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "ui-esm-core", type: "module" }));
      write(dir, "index.html", "<!doctype html><html><body>app</body></html>\n");
      write(dir, "src/jobs/flip.ts", "export function add(a: number, b: number): number { return a + b; }\n");
      write(dir, ".rapidtool/project.json", JOB_CORE_RECORD("src/jobs/flip.ts"));
      const r = await treeRunAsConsumer(dir);
      assert.ok(r.core, "core smoke ran");
      assert.equal(r.core!.run, "pass");
      assert.equal(r.ok, true, "a loadable core keeps the UI-shell skip green");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("330 Transit: a UI-shell tree with NO generated core keeps the byte-identical skip (no core factor)", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "ui-nocore", type: "module" }));
      write(dir, "index.html", "<!doctype html><html><body>app</body></html>\n");
      write(dir, "src/app.ts", "export const ui = 'shell';\n");
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.core, undefined, "no core resolves ⇒ no core verdict, no hash factor");
      assert.equal(r.run!.kind, "ui-shell");
      assert.equal(r.ok, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // T1 (331-3): an emit that CONVERTS a lone generatedSource materializes a
  // tree whose job node is uncovered (no file) — the generated core then
  // resolves to the tree entry (src/generated.ts). Lock both verdicts.
  it("T1 (331-3): a UI-shell tree whose generated core is the tree ENTRY (job file unmaterialised) is load-smoked", async () => {
    const dir = tempDir();
    try {
      // The shape a converted emit produces: a job node is declared but its
      // file is NOT written (tree mode never bridges an uncovered job node),
      // the record carries generatedSource, and the ESM barrel lives at the
      // tree entry. resolveHeadlessEntry must fall through to src/generated.ts.
      const record = JSON.stringify({
        kind: "app",
        generatedSource: 'export * from "./generated/chunk-0.ts";\n',
        specGraph: { nodes: [{ id: "job-flip", file: "src/jobs/flip.ts" }], order: ["job-flip"] },
      });
      write(dir, "package.json", JSON.stringify({ name: "ui-tree-entry", type: "module" }));
      write(dir, "index.html", "<!doctype html><html><body>app</body></html>\n");
      write(dir, "src/generated.ts", 'export * from "./generated/chunk-0.ts";\n');
      write(dir, "src/generated/chunk-0.ts", "function add(a, b) { return a + b; }\nexport { add };\n");
      write(dir, ".rapidtool/project.json", record);
      const r = await treeRunAsConsumer(dir);
      assert.ok(r.core, "the tree entry generated core was resolved and smoke-loaded");
      assert.equal(r.core!.entry, "src/generated.ts");
      assert.equal(r.core!.run, "pass", "the converted ESM barrel loads");
      assert.equal(r.ok, true, "a loadable converted core keeps the UI-shell skip green");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("T1 (331-3): a tree ENTRY core carrying CommonJS residue reds the tree", async () => {
    const dir = tempDir();
    try {
      const record = JSON.stringify({
        kind: "app",
        generatedSource: 'export * from "./generated/chunk-0.ts";\n',
        specGraph: { nodes: [{ id: "job-flip", file: "src/jobs/flip.ts" }], order: ["job-flip"] },
      });
      write(dir, "package.json", JSON.stringify({ name: "ui-tree-entry-cjs", type: "module" }));
      write(dir, "index.html", "<!doctype html><html><body>app</body></html>\n");
      write(dir, "src/generated.ts", 'export * from "./generated/chunk-0.ts";\n');
      // A residue-carrying chunk a stale/foreign dir could still hold.
      write(dir, "src/generated/chunk-0.ts", "function add(a, b) { return a + b; }\nmodule.exports.add = add;\n");
      write(dir, ".rapidtool/project.json", record);
      const r = await treeRunAsConsumer(dir);
      assert.ok(r.core, "the tree entry generated core was resolved");
      assert.equal(r.core!.entry, "src/generated.ts");
      assert.equal(r.core!.run, "fail");
      assert.equal(r.ok, false, "an unloadable tree-entry core is never ok:true");
      assert.ok((r.error ?? "").includes("generated core module failed to LOAD"), r.error);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // T1 (332-3) — a GAME tree's package.json "main" is the BROWSER boot vite
  // loads from index.html: it imports the UI shell extensionless and touches
  // the DOM, so bare node cannot load it. It must never be resolved as the
  // headless core, or a perfectly clean game tree reds; the tree's GENERATED
  // core is what the smoke must judge, and a broken one must still red.
  // -------------------------------------------------------------------------
  const GAME_RECORD = (file: string): string =>
    JSON.stringify({ kind: "game", specGraph: { nodes: [{ id: "job-level", file }], order: ["job-level"] } });
  const GAME_BOOT = [
    `import { bootGame } from "./ui/console";`,
    `const el = document.getElementById("root");`,
    `if (!el) throw new Error("missing #root element");`,
    `bootGame(el as HTMLElement);`,
    ``,
  ].join("\n");

  it("T1 (332-3): a clean game tree skips its browser boot and smokes the generated core — green", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "game-clean", type: "module", main: "src/main.ts" }));
      write(dir, "index.html", '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.ts"></script></body></html>\n');
      write(dir, "src/main.ts", GAME_BOOT);
      write(dir, "src/jobs/level.ts", "export function play(n: number): number { return n + 1; }\n");
      write(dir, ".rapidtool/project.json", GAME_RECORD("src/jobs/level.ts"));
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.run!.run, "skip", "the UI shell itself stays an honest skip");
      assert.equal(r.run!.kind, "ui-shell");
      assert.ok(r.core, "the generated core was resolved and smoke-loaded");
      assert.equal(r.core!.entry, "src/jobs/level.ts", "the generated core is smoked, not the browser boot");
      assert.notEqual(r.core!.entry, "src/main.ts", "the browser boot is never the headless core");
      assert.equal(r.core!.run, "pass");
      assert.equal(r.ok, true, "a clean game tree is green (before T1 it reds on src/main.ts)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("T1 (332-3): a game tree whose generated core is broken STILL reds (control)", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "game-broken-core", type: "module", main: "src/main.ts" }));
      write(dir, "index.html", '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.ts"></script></body></html>\n');
      write(dir, "src/main.ts", GAME_BOOT);
      // The generated core is unloadable — the browser-boot skip must not hide it.
      write(dir, "src/jobs/level.ts", "function x( { broken syntax\n");
      write(dir, ".rapidtool/project.json", GAME_RECORD("src/jobs/level.ts"));
      const r = await treeRunAsConsumer(dir);
      assert.ok(r.core, "the broken generated core was resolved");
      assert.equal(r.core!.entry, "src/jobs/level.ts");
      assert.equal(r.core!.run, "fail");
      assert.equal(r.ok, false, "a broken generated core is never ok:true");
      assert.ok((r.error ?? "").includes("generated core module failed to LOAD"), r.error);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("T1 (332-3): a UI shell with a browser main and NO generated core keeps the honest skip", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "game-no-core", type: "module", main: "src/main.ts" }));
      write(dir, "index.html", '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.ts"></script></body></html>\n');
      write(dir, "src/main.ts", GAME_BOOT);
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.core, undefined, "no generated core resolves ⇒ no core verdict");
      assert.equal(r.run!.kind, "ui-shell");
      assert.equal(r.run!.run, "skip");
      assert.equal(r.ok, true);
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

// ---------------------------------------------------------------------------
// T2 (332-3) — `ok` is "nothing ran red"; `declaredScriptsVerified` is "every
// DECLARED project script actually ran". A tree whose declared
// `typecheck`/`build` could not execute (no node_modules) is ok-but-UNVERIFIED:
// it carries `declaredScriptsVerified:false` and names the unrun legs, so no
// consumer can read the green as a declared-script verification.
// ---------------------------------------------------------------------------
describe("T2 (332-3) — a declared-but-unverified project tool is never a pass", () => {
  const writeProjectTree = (root: string, scripts: Record<string, string>): void => {
    write(root, "package.json", JSON.stringify({ name: "t2", type: "module", main: "src/main.ts", scripts }));
    write(root, "src/main.ts", "export const boot = (): string => 'ok';\n");
    write(root, "tests/oracle.spec.ts", PASSING_SPEC);
  };
  const emptyCompile = (dir: string) =>
    ({ ok: true, dir, checked: 0, passed: 0, failed: 0, skipped: 0, verdicts: [] });

  it("a declared-but-uninstalled typecheck → ok:true but declaredScriptsVerified:false, the leg named", async () => {
    const dir = tempDir();
    try {
      writeProjectTree(dir, { typecheck: "tsc --noEmit", test: "node --version" });
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true, "nothing ran red — the tree is not red");
      assert.equal(r.project!.typecheck.run, "skip");
      assert.equal(r.project!.typecheck.executed, false, "a skip did not execute");
      assert.equal(r.project!.test.executed, true, "an executed script");
      assert.deepEqual(r.unverifiedDeclaredScripts, ["typecheck"], "the unrun DECLARED leg is named at the top level");
      assert.deepEqual(r.project!.unverifiedDeclaredScripts, ["typecheck"]);
      assert.equal(r.project!.declaredScriptsVerified, false);
      assert.equal(r.declaredScriptsVerified, false, "an ok-but-unverified tree must never read as declared-verified");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("every declared script ran → declaredScriptsVerified:true and no unverified rows", async () => {
    const dir = tempDir();
    try {
      writeProjectTree(dir, { typecheck: "node --version", test: "node --version" });
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true);
      assert.equal(r.project!.typecheck.executed, true);
      assert.equal(r.project!.test.executed, true);
      assert.equal(r.project!.declaredScriptsVerified, true);
      assert.equal(r.declaredScriptsVerified, true, "every declared script ran");
      assert.equal(r.unverifiedDeclaredScripts, undefined, "nothing unverified");
      assert.equal(r.project!.unverifiedDeclaredScripts, undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("absent scripts are ABSENT, not unverified (declaredScriptsVerified stays true)", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC); // package.json declares no scripts block
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true);
      assert.equal(r.project!.typecheck.run, "skip");
      assert.equal(r.project!.typecheck.executed, undefined, "an undeclared script was neither declared nor executed");
      assert.equal(r.declaredScriptsVerified, true);
      assert.equal(r.unverifiedDeclaredScripts, undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the declared-verification state is decisive in treeVerdictHash", () => {
    const base = {
      ok: true,
      dir: "d",
      compile: emptyCompile("d"),
      tests: [],
      run: null,
      declaredScriptsVerified: true,
    };
    const unverified = { ...base, declaredScriptsVerified: false, unverifiedDeclaredScripts: ["typecheck"] };
    assert.notEqual(
      treeVerdictHash(base),
      treeVerdictHash(unverified),
      "a declared-verified and an ok-but-unverified verdict must not hash the same",
    );
  });
});

// ---------------------------------------------------------------------------
// F-4 (332-3b) — the 333-1 audit found `verified:true` on a clean game tree
// whose kind entry was a DELIBERATE UI-shell skip. The field is renamed to say
// exactly what it measures (the emitted package.json's declared scripts) and
// the skip is represented as `unverifiedEntry` with its reason, so a consumer
// can never read a deliberate UI-shell skip as a verified behaviour. T1
// semantics are unchanged: a clean UI-shell tree is still green, a corrupted
// generated core still reds.
// ---------------------------------------------------------------------------
describe("F-4 (332-3b) — a deliberate UI-shell skip is never 'behaviour verified'", () => {
  const GAME_BOOT = [
    `import { bootGame } from "./ui/console";`,
    `const el = document.getElementById("root");`,
    `if (!el) throw new Error("missing #root element");`,
    `bootGame(el as HTMLElement);`,
    ``,
  ].join("\n");
  const GAME_RECORD = (file: string): string =>
    JSON.stringify({ kind: "game", specGraph: { nodes: [{ id: "job-level", file }], order: ["job-level"] } });
  const writeGame = (root: string, coreBody: string): void => {
    write(
      root,
      "package.json",
      JSON.stringify({
        name: "game-f4",
        type: "module",
        main: "src/main.ts",
        // The real scaffold's game scripts: tsc/vite are unresolvable without
        // node_modules, so they are the declared-but-unverified legs.
        scripts: {
          typecheck: "tsc --noEmit",
          build: "vite build",
          test: "node --experimental-strip-types --test tests/oracle.spec.ts",
        },
      }),
    );
    write(root, "index.html", '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.ts"></script></body></html>\n');
    write(root, "src/main.ts", GAME_BOOT);
    write(root, "src/jobs/level.ts", coreBody);
    write(root, "tests/oracle.spec.ts", PASSING_SPEC);
    write(root, ".rapidtool/project.json", GAME_RECORD("src/jobs/level.ts"));
  };
  const hasKey = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

  it("clean game tree: green, but the UI-shell skip is an UNVERIFIED entry (not 'verified')", async () => {
    const dir = tempDir();
    try {
      writeGame(dir, "export function play(n: number): number { return n + 1; }\n");
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true, "T1 semantics intact — the clean UI-shell tree is green");
      assert.equal(r.run!.run, "skip");
      assert.equal(r.run!.kind, "ui-shell");
      assert.equal(r.core!.run, "pass", "the generated core loaded");
      // The over-broad names are GONE: nothing named `verified` may over-claim.
      assert.equal(hasKey(r, "verified"), false, "no `verified` field may be read as behaviour-verified");
      assert.equal(hasKey(r, "unverified"), false, "no bare `unverified` field");
      // The precise field measures DECLARED SCRIPTS ONLY — and says so.
      assert.equal(r.declaredScriptsVerified, false, "the fresh tree's declared tsc/vite did not run");
      assert.deepEqual(r.unverifiedDeclaredScripts, ["typecheck", "build"]);
      // The deliberate entry skip IS represented, with its reason.
      assert.ok(r.unverifiedEntry, "the UI-shell skip is carried as an unverified entry");
      assert.match(r.unverifiedEntry!, /UI shell/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an entry that EXECUTED is not an unverified entry (no under-claim)", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "headless-f4", type: "module", main: "src/main.ts", scripts: { typecheck: "node --version" } }));
      write(dir, "src/main.ts", "export const boot = (): string => 'ok';\n");
      write(dir, "tests/oracle.spec.ts", PASSING_SPEC);
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.run!.run, "pass", "the package.json main executed headless");
      assert.equal(r.unverifiedEntry, undefined, "an executed entry is never an unverified entry");
      assert.equal(r.declaredScriptsVerified, true, "the declared typecheck ran");
      assert.deepEqual(r.unverifiedDeclaredScripts, undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("corrupted generated core still reds — the skip is not a blanket pass (T1 control)", async () => {
    const dir = tempDir();
    try {
      writeGame(dir, "function x( { broken syntax\n");
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, false, "a corrupted generated core is never ok:true");
      assert.equal(r.core!.run, "fail");
      assert.ok((r.error ?? "").includes("generated core module failed to LOAD"), r.error);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T3 (R11-f02) / T4 (R12-f03) — the hardening landed in earlier waves; these
// pin it so a regression is caught. R11-f02: a declared script runs argv-only
// (no shell) when its first token resolves to a real executable, the lifecycle
// denial is recorded on the verdict, and the install leg carries
// `--ignore-scripts` (installToolFor, pinned elsewhere in this file). R12-f03:
// treeRun never deep-copies node_modules — the subject's deps are reachable in
// the run copy through a directory junction, and the subject stays read-only.
// ---------------------------------------------------------------------------
describe("T3/T4 (332-3) — script-execution and temp-copy hardening stay pinned", () => {
  it("R11-f02: a resolved declared script runs argv-only and records the lifecycle denial", async () => {
    const dir = tempDir();
    try {
      write(dir, "package.json", JSON.stringify({ name: "t3", type: "module", main: "src/main.ts", scripts: { typecheck: "node --version" } }));
      write(dir, "src/main.ts", "export const boot = (): string => 'ok';\n");
      write(dir, "tests/oracle.spec.ts", PASSING_SPEC);
      const r = await treeRunAsConsumer(dir);
      const tc = r.project!.typecheck;
      assert.equal(tc.run, "pass");
      assert.ok(tc.scriptPolicy, "the execution route is recorded on the verdict");
      assert.match(tc.scriptPolicy!, /argv-only/);
      assert.match(tc.scriptPolicy!, /no shell/);
      assert.match(tc.scriptPolicy!, /lifecycle scripts denied/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R11-f02: a command that NEEDS a shell takes the constant --ignore-scripts fallback and says so", async () => {
    const dir = tempDir();
    try {
      // An unquoted shell operator means the declared text can only mean what it
      // says through a shell, so the plan refuses to argv-split it and falls back
      // to the CONSTANT `npm run <script> --ignore-scripts` (no tree text to a shell).
      write(dir, "package.json", JSON.stringify({ name: "t3b", type: "module", main: "src/main.ts", scripts: { typecheck: "node --version && node --version" } }));
      write(dir, "src/main.ts", "export const boot = (): string => 'ok';\n");
      write(dir, "tests/oracle.spec.ts", PASSING_SPEC);
      const r = await treeRunAsConsumer(dir);
      const tc = r.project!.typecheck;
      assert.equal(tc.run, "pass", `the fallback ran the declared script: ${tc.detail ?? ""}`);
      assert.match(tc.scriptPolicy!, /shell form/);
      assert.match(tc.scriptPolicy!, /--ignore-scripts/);
      assert.match(tc.scriptPolicy!, /lifecycle scripts denied/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R12-f03: node_modules is not deep-copied — deps reachable via the seam, subject read-only", async () => {
    const dir = tempDir();
    const sentinelDir = tempDir();
    const sentinel = join(sentinelDir, "seen.json");
    try {
      write(dir, "package.json", JSON.stringify({ name: "t4", type: "module", main: "src/main.ts", scripts: { build: "node seam-marker.mjs" } }));
      write(dir, "src/main.ts", "export const boot = (): string => 'ok';\n");
      write(dir, "tests/oracle.spec.ts", PASSING_SPEC);
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      write(dir, "node_modules/marker.txt", "seam-marker\n");
      write(
        dir,
        "seam-marker.mjs",
        [
          `import { readFileSync, writeFileSync } from "node:fs";`,
          `import { join } from "node:path";`,
          `writeFileSync(${JSON.stringify(sentinel)}, JSON.stringify({`,
          `  cwd: process.cwd(),`,
          `  nm: readFileSync(join(process.cwd(), "node_modules", "marker.txt"), "utf8").trim(),`,
          `}));`,
          ``,
        ].join("\n"),
      );
      const before = snapshotListing(dir);
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.project!.build!.run, "pass", "the declared build ran in the copy");
      const seen = JSON.parse(readFileSync(sentinel, "utf8")) as { cwd: string; nm: string };
      assert.ok(seen.cwd.includes("rt-treerun-"), `the build ran in the temp copy: ${seen.cwd}`);
      assert.equal(seen.nm, "seam-marker", "the subject's node_modules is reachable via the seam");
      assert.deepEqual(snapshotListing(dir), before, "the subject dir is read-only (no deep copy written back)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(sentinelDir, { recursive: true, force: true });
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
      assert.equal(ci.command, "npm ci --no-audit --no-fund --ignore-scripts");
      assert.match(ci.reason, /package-lock\.json present/);
      assert.match(ci.reason, /--ignore-scripts refuses every model-authored lifecycle script/);
      const install = installToolFor(unlocked);
      assert.equal(install.tool, "npm install");
      assert.equal(install.command, "npm install --no-audit --no-fund --ignore-scripts");
      assert.match(install.reason, /no package-lock\.json/);
      assert.match(install.reason, /--ignore-scripts refuses every model-authored lifecycle script/);
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

// ---------------------------------------------------------------------------
// OV-43 (W17-L5) — report-only supply-chain floor: the install leg runs with
// `--no-audit` by design and emitted trees ship caret-pinned deps with no
// lockfile; this surface makes that posture VISIBLE as evidence. It has no
// ok/fail and must never gate a run — pinned below.
// ---------------------------------------------------------------------------

describe("OV-43 — report-only supply-chain floor (never a gate)", () => {
  it("caret-pinned, lockfile-less tree → loose pins + no lockfile + NO audit is claimed", () => {
    const dir = tempDir();
    try {
      write(
        dir,
        "package.json",
        JSON.stringify({
          name: "x",
          dependencies: { react: "^19.0.0", zod: "3.24.1" },
          devDependencies: { vite: "^7.0.0" },
        }),
      );
      const p = supplyChainFloorFor(dir);
      assert.equal(p.report, "supply-chain-posture");
      assert.equal(p.gate, false, "report-only by contract — no gate field can flip");
      assert.equal(p.packageJson, true);
      assert.equal(p.lockfile, "absent");
      assert.equal(p.installTool, "npm install");
      assert.equal(p.noAuditFlag, true, "the default leg carries --no-audit (audit is OFF by design)");
      assert.equal(p.audited, false, "no audit happened on this path — the posture never claims one");
      assert.equal(p.caretPinned, 2);
      assert.equal(p.exactPinned, 1);
      assert.equal(p.otherRange, 0);
      assert.equal(p.totalDeps, 3);
      assert.deepEqual(p.caretExamples, ["react@^19.0.0", "vite@^7.0.0"]);
      assert.match(p.auditNote, /npm audit --omit=dev/, "the real check is named, not run");
      assert.match(p.auditNote, /cannot audit says so/, "a host that cannot audit must say so");
      assert.match(p.caveat, /never a gate/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("locked tree → npm ci posture; exact vs other ranges counted honestly", () => {
    const dir = tempDir();
    try {
      write(dir, "package-lock.json", "{}");
      write(
        dir,
        "package.json",
        JSON.stringify({
          name: "x",
          dependencies: { a: "1.2.3", b: "~2.0.0", c: "git+https://example.invalid/x.git" },
        }),
      );
      const p = supplyChainFloorFor(dir);
      assert.equal(p.lockfile, "present");
      assert.equal(p.installTool, "npm ci");
      assert.equal(p.installCommand, "npm ci --no-audit --no-fund --ignore-scripts");
      assert.equal(p.noAuditFlag, true);
      assert.equal(p.exactPinned, 1, "1.2.3 is an exact pin");
      assert.equal(p.otherRange, 2, "tilde and git ranges are neither caret- nor exact-pinned");
      assert.equal(p.caretPinned, 0);
      assert.equal(SUPPLY_CHAIN_AUDIT_COMMAND, "npm audit --omit=dev");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("no package.json → honest empty report, still never a gate", () => {
    const dir = tempDir();
    try {
      const p = supplyChainFloorFor(dir);
      assert.equal(p.packageJson, false);
      assert.equal(p.totalDeps, 0);
      assert.equal(p.gate, false);
      assert.equal(p.audited, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the verifyKindDir install verdict carries the posture (emits in a targeted run, no network)", async () => {
    const dir = tempDir();
    try {
      write(
        dir,
        "package.json",
        JSON.stringify({
          name: "x",
          scripts: { build: 'node -e "0"' },
          dependencies: { react: "^19.0.0" },
        }),
      );
      const r = await verifyKindDir(dir, {
        timeoutMs: 30_000,
        installCommand: 'node -e "process.exit(0)"',
      });
      assert.equal(r.install?.run, "pass");
      const sc = r.install?.supplyChain;
      assert.ok(sc, "the install leg always carries its supply-chain posture");
      assert.equal(sc.gate, false);
      assert.equal(sc.caretPinned, 1);
      assert.equal(sc.installTool, "seam", "the seam is named as the tool that ran, never npm");
      assert.equal(sc.noAuditFlag, false, "the seam command carries no --no-audit flag");
      assert.match(sc.auditNote, /test seam/);
      assert.match(sc.auditNote, /no npm ran/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// W43 · C6/E4 (fixes/312_c6_ux · 311_sd_product K3/K4) — the product-substance
// census + verdict-hash pins the C6 landing owed. Real dirs on disk; no mocks.
// The census must agree with the doctor's own derivation over the file set
// `headless.collectJobSources` selects (the mirror promise at
// compile-check.server.ts:496-497), and the note must stay NARROW: job-less
// fixture trees stay note-silent (the existing :569/:631-664 r.note
// assertions depend on exactly that trigger).
// ---------------------------------------------------------------------------

const REAL_JOB = "export const route = (n: number): number => n + 1;\n";
const STUB_JOB = 'export const route = (): never => {\n  throw new Error("RT_E_VALIDATION · TODO(E-15) stub");\n};\n';
const BRIDGE_JOB = 'export { route } from "./impl.ts";\n';
/** K4 oracle shape: `assert.rejects` within 400 chars of a `TODO(E-15)` literal. */
const TRAP_SPEC = [
  `import { test } from "node:test";`,
  `import assert from "node:assert/strict";`,
  `test("orc-1 route refuses until implemented (TODO(E-15) stub)", async () => {`,
  `  await assert.rejects(async () => { throw new Error("RT_E_VALIDATION · TODO(E-15) stub"); }, /TODO\\(E-15\\) stub/);`,
  `});`,
  ``,
].join("\n");

/** Write job modules under src/jobs/ (key = rel path from there). */
function writeJobs(dir: string, jobs: Record<string, string>): void {
  for (const [rel, body] of Object.entries(jobs)) write(dir, `src/jobs/${rel}`, body);
}

describe("treeSubstanceOf — the product-substance census (fixes/312_c6_ux · K3/K4)", () => {
  it("no job modules → verdict empty, census zeros, NO note (job-less trees stay silent)", () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC);
      const s = treeSubstanceOf(dir, { green: true });
      assert.equal(s.verdict, "empty");
      assert.equal(s.files.length, 0);
      assert.deepEqual([s.stubs, s.reexports, s.real], [0, 0, 0]);
      assert.equal(s.greenWhileStubbed, false, "nothing to census is never green-while-stubbed");
      assert.equal(s.oracleStubTrap, false, "no job modules → no trap to detect");
      assert.equal(s.note, undefined, "the note trigger is narrow — no job-file signal, no marking");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("all-stub jobs → stub-skeleton + the loud note names the counts, the K3 reading and the K4 trap", () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, TRAP_SPEC);
      writeJobs(dir, { "route.ts": STUB_JOB });
      const s = treeSubstanceOf(dir, { green: true });
      assert.equal(s.verdict, "stub-skeleton");
      assert.deepEqual([s.stubs, s.reexports, s.real], [1, 0, 0]);
      assert.equal(s.greenWhileStubbed, true, "green + stub jobs = the K3 misread this marking exists for");
      assert.equal(s.oracleStubTrap, true, "the oracle asserts the stub refusal — implementing reddens it (K4)");
      assert.ok(s.note, "a non-clean census over an EXISTING job-file set must carry the note");
      assert.match(s.note!, /SUBSTANCE MARKING \(stubs:1 reexports:0 real:0\)/);
      assert.match(s.note!, /every one of the 1 job module\(s\) is a TODO\(E-15\) stub or a reexport-only bridge/);
      assert.match(s.note!, /NOT product-complete/);
      assert.match(s.note!, /K3: exit 0 must never be read as product quality/);
      assert.match(s.note!, /green here means the emitted files parse/);
      assert.match(s.note!, /K4 oracle trap/);
      // The trigger is about the census, not the run colour: red runs get the
      // same marking, they just must not claim green-while-stubbed.
      assert.equal(treeSubstanceOf(dir, {}).greenWhileStubbed, false);
      assert.equal(treeSubstanceOf(dir, { green: false }).greenWhileStubbed, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the K4 clause drops when the oracle carries no stub-refusal assertion", () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC); // no assert.rejects + TODO(E-15) pair
      writeJobs(dir, { "route.ts": STUB_JOB });
      const s = treeSubstanceOf(dir, { green: true });
      assert.equal(s.oracleStubTrap, false);
      assert.ok(s.note, "the K3 marking still fires — the trap clause is what drops");
      assert.doesNotMatch(s.note!, /oracle trap/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("mixed (real + stub) → verdict mixed; the note names the stub share", () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC);
      writeJobs(dir, { "a.ts": REAL_JOB, "b.ts": STUB_JOB });
      const s = treeSubstanceOf(dir);
      assert.equal(s.verdict, "mixed");
      assert.deepEqual([s.stubs, s.reexports, s.real], [1, 0, 1]);
      assert.match(s.note!, /1 of 2 job module\(s\) are TODO\(E-15\) stubs/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("all real → verdict real + NO note (a clean tree stays silent)", () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC);
      writeJobs(dir, { "a.ts": REAL_JOB });
      const s = treeSubstanceOf(dir, { green: true });
      assert.equal(s.verdict, "real");
      assert.deepEqual([s.stubs, s.reexports, s.real], [0, 0, 1]);
      assert.equal(s.greenWhileStubbed, false, "a clean census is never green-while-stubbed");
      assert.equal(s.note, undefined, "a real census must not manufacture a marking");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reexport-only bridges count as bridges, never as real (and still mark green runs)", () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC);
      writeJobs(dir, { "bridge.ts": BRIDGE_JOB });
      const s = treeSubstanceOf(dir, { green: true });
      assert.equal(s.verdict, "stub-skeleton", "no real module → not clean, whatever the leftover kind");
      assert.deepEqual([s.stubs, s.reexports, s.real], [0, 1, 0]);
      assert.equal(s.greenWhileStubbed, true, "reexport-only leftovers count as green-while-stubbed");
      assert.match(s.note!, /1 job module\(s\) are reexport-only bridges/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("PARITY: the mirror selects the same file rows as headless.collectJobSources — and the doctor's own derivation agrees row for row", () => {
    const dir = tempDir();
    try {
      write(dir, "src/jobs/route.ts", STUB_JOB);
      write(dir, "src/jobs/bridge.ts", BRIDGE_JOB);
      write(dir, "jobs/legacy.mjs", "export const legacy = () => 1;\n");
      write(dir, "src/jobs/notes.md", "not a job module — extension filter");
      mkdirSync(join(dir, "src", "jobs", "loose.ts"), { recursive: true }); // a DIR ending .ts — isFile filter
      const census = treeSubstanceOf(dir);
      const headlessFiles = collectJobSources(dir);
      assert.deepEqual(
        census.files.map((f) => f.path),
        headlessFiles.map((f) => f.path),
        "the mirror (src/jobs + jobs, top-level .ts/.js/.mjs) must select exactly headless.collectJobSources' rows",
      );
      assert.equal(census.files.length, 3, "notes.md (extension) and loose.ts (directory) are never rows");
      const inv = inventoryFromJobSources(headlessFiles, dir);
      assert.deepEqual(
        [census.stubs, census.reexports, census.real],
        [inv.stubs, inv.reexports, inv.real],
        "the census counts must be the doctor's own classifier over those rows",
      );
      assert.equal(census.verdict, "mixed", "stub + reexport + real together = mixed");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("treeVerdictHash — the re-derivable machine-verdict hash (MA §5 move 3, keyless slice)", () => {
  it("treeRun carries it; a downstream re-derivation matches; the same tree re-run re-derives the same hash", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC);
      const r1 = await treeRunAsConsumer(dir);
      assert.equal(typeof r1.verdictHash, "string", "treeRun always sets the hash on a runnable verdict");
      assert.match(r1.verdictHash!, /^\d+$/, "FNV-1a decimal string (same contract as dod.ts evidenceHash)");
      assert.equal(r1.verdictHash, treeVerdictHash(r1), "the documented consumer re-derivation matches the carried hash");
      const r2 = await treeRunAsConsumer(dir);
      assert.equal(r2.verdictHash, r1.verdictHash, "the same tree re-run re-derives the same machine verdict");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("decisive fields move the hash; cosmetic fields do not", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC);
      const r = await treeRunAsConsumer(dir);
      const base = treeVerdictHash(r);
      assert.equal(
        treeVerdictHash({ ...r, note: "cosmetic prose — not a machine verdict" }),
        base,
        "the note is not decisive: the hash covers the verdict, not the prose",
      );
      assert.notEqual(treeVerdictHash({ ...r, ok: !r.ok }), base, "ok is decisive");
      assert.notEqual(
        treeVerdictHash({ ...r, substance: { ...r.substance!, stubs: r.substance!.stubs + 1 } }),
        base,
        "the substance census is decisive — a changed census must move the hash",
      );
      assert.notEqual(
        treeVerdictHash({ ...r, tests: r.tests.map((t) => ({ ...t, file: `${t.file}.renamed` })) }),
        base,
        "a spec's file identity is decisive",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("treeRun — the K3 substance marking rides the verdict (fixes/312_c6_ux)", () => {
  it("a job-bearing stubbed tree: ok:true stays (the tree truly ran green) BUT the note fires with the census", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, TRAP_SPEC);
      writeJobs(dir, { "route.ts": STUB_JOB });
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true, "the tree executes green — the marking qualifies it, it never fakes a red");
      assert.ok(r.substance, "every runnable verdict carries the census");
      assert.equal(r.substance!.verdict, "stub-skeleton");
      assert.equal(r.substance!.greenWhileStubbed, true);
      assert.match(r.note ?? "", /SUBSTANCE MARKING/, `the loud note rides the top-level note: ${r.note}`);
      assert.match(r.note ?? "", /stubs:1 reexports:0 real:0/);
      assert.equal(r.verdictHash, treeVerdictHash(r));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a clean tree carrying real jobs stays note-silent (nothing to mark)", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC);
      writeJobs(dir, { "route.ts": REAL_JOB });
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true);
      assert.equal(r.substance!.verdict, "real");
      assert.equal(r.substance!.note, undefined);
      assert.equal(r.note, undefined, "a real census must not manufacture a note");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// W44 · A1 (fixes/318_a1_oracle.md · K1-R1 · 317_j1_oracle J1.2): the
// WRONG-OUTPUT PIN. A tree that declares an `entry-runs` row its entry does
// NOT satisfy must fail the tree-run verdict (outcome.ok:false, the failed row
// NAMED in the error); a satisfied declaration passes; an absent declaration
// adds nothing (no `behavior` key, byte-stable verdict hash). Wire:
// compile-check.server.ts `treeBehaviorOf` + `treeRun`'s behavior fold; oracle:
// the shared src/lib/entry-oracle.ts primitive (one truth with the eval side).
// ---------------------------------------------------------------------------

describe("treeRun — the tree-declared expectedBehavior contract BITES (W44·A1 · K1-R1)", () => {
  /** Override the emitted main so the entry PRINTS — a real stdout pin to bite. */
  const printingMain = `console.log("emit-ok");\nexport const boot = (): string => "ok";\n`;

  it("(a) good tree + satisfied declared row → behavior.ok true and outcome.ok true", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC);
      write(dir, "src/main.ts", printingMain);
      write(
        dir,
        ".rapidtool/project.json",
        JSON.stringify(
          { expectedBehavior: [{ id: "r-boot", check: "entry-runs", entry: "src/main.ts", expectStdout: "emit-ok" }] },
          null,
          2,
        ),
      );
      const r = await treeRunAsConsumer(dir);
      assert.equal(r.ok, true, `a satisfied declaration must not red the tree: ${JSON.stringify(r.behavior)}`);
      assert.ok(r.behavior, "a declared row set ⇒ the behavior factor is present");
      assert.equal(r.behavior!.source, ".rapidtool/project.json");
      assert.equal(r.behavior!.declared, 1);
      assert.equal(r.behavior!.ok, true);
      assert.equal(r.behavior!.passed, 1);
      assert.equal(r.behavior!.failed, 0);
      const row = r.behavior!.rows[0]!;
      assert.equal(row.id, "r-boot");
      assert.equal(row.status, "pass");
      assert.match(row.detail, /exit 0 in \d+ms/);
      assert.match(row.detail, /cwd = emitted dir/, "the row is a bounded spawn over the run copy");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(b) THE HEART — a declared row the entry does NOT satisfy → ok:false + error names the failed row", async () => {
    const dir = tempDir();
    try {
      writeEmittedTree(dir, PASSING_SPEC);
      write(dir, "src/main.ts", printingMain);
      write(
        dir,
        ".rapidtool/project.json",
        JSON.stringify(
          {
            expectedBehavior: [
              { id: "r-boot", check: "entry-runs", entry: "src/main.ts", expectStdout: "emit-ok" },
              { id: "r-wrong", check: "entry-runs", entry: "src/main.ts", expectStdout: "NEVER-PRINTED" },
            ],
          },
          null,
          2,
        ),
      );
      const r = await treeRunAsConsumer(dir);
      // Everything else about this tree is GREEN: the compile census passes,
      // every spec runs pass, the load-import entry smoke passes. The ONLY
      // red is the declared contract — a green tree whose entry produces
      // WRONG OUTPUT can no longer exit ok.
      assert.equal(r.compile.ok, true);
      assert.ok(r.tests.every((t) => t.run === "pass"), "specs green");
      assert.equal(r.run!.run, "pass", "the entry smoke (load-import) passes — the K3 gap shape");
      assert.equal(r.ok, false, "wrong output must red the verdict — never a green with a wrong-output entry");
      assert.ok(r.behavior, "behavior factor present");
      assert.equal(r.behavior!.ok, false);
      assert.equal(r.behavior!.passed, 1, "the satisfied row still passes");
      assert.equal(r.behavior!.failed, 1);
      const failed = r.behavior!.rows.find((row) => row.id === "r-wrong");
      assert.ok(failed, "the failed row is the declared one");
      assert.equal(failed!.status, "fail");
      assert.match(failed!.detail, /stdout lacks "NEVER-PRINTED"/);
      // The verdict error names the FIRST failed row (id + its coded detail).
      assert.match(r.error ?? "", /expectedBehavior contract FAILED/);
      assert.match(r.error ?? "", /r-wrong/);
      assert.match(r.error ?? "", /stdout lacks/);
      // The decisive hash is re-derivable on the red verdict too.
      assert.equal(r.verdictHash, treeVerdictHash(r));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(c) absent declaration → NO behavior key + byte-stable, declaration-less verdict hash", async () => {
    const dir = tempDir(); // no .rapidtool/ file at all
    const noDecl = tempDir(); // SAME tree + project.json WITHOUT the declaration key
    const declared = tempDir(); // SAME tree + project.json WITH the declaration
    try {
      writeEmittedTree(dir, PASSING_SPEC);
      write(dir, "src/main.ts", printingMain);
      const r1 = await treeRunAsConsumer(dir);
      const r2 = await treeRunAsConsumer(dir);
      assert.equal("behavior" in r1, false, "no declaration ⇒ no behavior key at all (byte-stable outcome)");
      assert.equal(r1.behavior, undefined);
      assert.equal(r1.verdictHash, r2.verdictHash, "the same declaration-less tree re-run re-derives the same hash");
      assert.equal(r1.verdictHash, treeVerdictHash(r1), "the carried hash re-derives");

      // The byte-stable cross-check needs the SAME file set: the declaration-
      // FILE tree twice — once with the key (declared), once without (no key,
      // still an absent declaration).
      for (const root of [noDecl, declared]) {
        writeEmittedTree(root, PASSING_SPEC);
        write(root, "src/main.ts", printingMain);
      }
      write(noDecl, ".rapidtool/project.json", JSON.stringify({ name: "no-declaration" }, null, 2));
      write(
        declared,
        ".rapidtool/project.json",
        JSON.stringify(
          {
            name: "declared",
            expectedBehavior: [{ id: "r-boot", check: "entry-runs", entry: "src/main.ts", expectStdout: "emit-ok" }],
          },
          null,
          2,
        ),
      );
      const rN = await treeRunAsConsumer(noDecl);
      const rD = await treeRunAsConsumer(declared);
      assert.equal("behavior" in rN, false, "a project.json without the key is still an absent declaration");
      assert.equal(rD.verdictHash, treeVerdictHash(rD));
      assert.notEqual(rD.verdictHash, rN.verdictHash, "a declared contract is decisive — it joins the canonical string");
      const { behavior: _b, ...rDWithoutBehavior } = rD;
      assert.equal(
        treeVerdictHash(rDWithoutBehavior),
        rN.verdictHash,
        "strip the declaration factor → the exact declaration-less hash returns (the J1 key is additive-only)",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(noDecl, { recursive: true, force: true });
      rmSync(declared, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// W48 / 334-3 (T3) — the DECLARED npm `main` is the headless entry for the
// library/service kinds. npm's convention is "./src/main.ts" (exactly what the
// scaffold emits), and the traversal guard silently dropped it, so the smoke
// fell through to a job module: a tree whose declared entry was unloadable kept
// reading green — the same class as the 332 `index.html ⇒ ui-shell` fix.
// ---------------------------------------------------------------------------
describe("W48 / 334-3 (T3) — a './'-prefixed declared main is smoke-loaded, not silently dropped", () => {
  it("resolves './src/main.ts' and REDs the tree when the declared entry is unloadable", async () => {
    const dir = tempDir();
    try {
      write(
        dir,
        "package.json",
        JSON.stringify({ name: "lib-main", type: "module", main: "./src/main.ts", scripts: { typecheck: "node --version" } }),
      );
      write(dir, "src/main.ts", "export const boot = (): string => 'ok';\n");
      // A decoy job module: pre-fix the dropped main let the smoke resolve THIS
      // and stay green even when the declared entry was broken.
      write(dir, "src/jobs/deliver.ts", "export function deliver(): number { return 1; }\n");
      write(
        dir,
        ".rapidtool/project.json",
        JSON.stringify({ name: "lib-main", specGraph: { nodes: [{ id: "job-0", file: "src/jobs/deliver.ts" }], order: ["job-0"] } }),
      );
      write(dir, "tests/oracle.spec.ts", PASSING_SPEC);

      const clean = await treeRunAsConsumer(dir);
      assert.equal(clean.run!.entry, "src/main.ts", "the DECLARED main is resolved, not silently dropped");
      assert.equal(clean.ok, true, clean.ok ? "" : clean.error);

      // Corrupt the DECLARED entry: the tree must RED. Pre-fix it resolved the
      // decoy job module and read ok:true — a false green.
      write(dir, "src/main.ts", 'throw new Error("W48-334-3: corrupted declared main");\n');
      const broken = await treeRunAsConsumer(dir);
      assert.equal(broken.run!.entry, "src/main.ts");
      assert.equal(broken.run!.run, "fail", "the declared entry is actually smoke-loaded");
      assert.equal(broken.ok, false, "a broken declared main can never read ok:true");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
