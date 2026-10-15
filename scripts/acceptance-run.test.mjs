// ---------------------------------------------------------------------------
// acceptance-run.test.mjs — pins the honesty of the acceptance harness's
// verdict model (scripts/acceptance-run.mjs · evaluateAcceptance).
//
// The harness exists to make "did the pipeline land a real, working product
// tree?" a machine verdict that can FAIL. The one invariant that matters:
// `ok:true` requires EVERY assertion green — a red tree, a stub-only tree, a
// missing web entry, an unverified toolchain, or an incomplete run must never
// read as green. The pure leg here proves that with synthetic facts (no key,
// no network, no pipeline). The behavioral leg drives the real script with
// `--keyless` over a throwaway temp dir and asserts it prints exactly one JSON
// verdict with an honest failing value for the deterministic floor.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { evaluateAcceptance, acceptanceEmitOptions, readBelowFloorState, resolveSuiteBriefs, resolveTreeEntry, spendDelta, formatRollupTable } from "./acceptance-run.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const HARNESS = join(HERE, "acceptance-run.mjs");
const CLI = join(HERE, "rapidtool-cli.mjs");

/**
 * A fully-green fact set — every assertion the harness makes is satisfied.
 * @returns {{
 *   tree: { exists: boolean; dir: string; fileCount: number; entry: { ok: boolean; mode?: string; html?: string|null; entry?: string|null; detail?: string|null }; webEntry: { ok: boolean; html?: string|null; entry?: string|null; detail?: string|null }; declaredScripts: { ok: boolean; scripts: Record<string, string>; missing: string[] }; redBanner: boolean };
 *   treeRun: { ok: boolean; typecheck: string; test: string; declaredScriptsVerified: boolean; unverifiedDeclaredScripts: string[]; substance: { stubs: number|null; reexports: number|null; real: number|null; verdict?: string }; error: string|null };
 *   run: { status: string; currentPhase: number; sealedWithFailures: boolean; steps: number; maxSteps?: number; outcome: string; capped?: boolean };
 *   install: { requested: boolean; ok: boolean; detail: string };
 * }}
 */
function greenFacts() {
  return {
    tree: {
      exists: true,
      dir: "C:/tmp/emitted",
      fileCount: 22,
      entry: { ok: true, mode: "web", html: "index.html", entry: "src/main.tsx", detail: null },
      webEntry: { ok: true, html: "index.html", entry: "src/main.tsx", detail: null },
      declaredScripts: { ok: true, scripts: { typecheck: "tsc --noEmit", test: "node --test tests" }, missing: [] },
      redBanner: false,
    },
    treeRun: {
      ok: true,
      typecheck: "pass",
      test: "pass",
      declaredScriptsVerified: true,
      unverifiedDeclaredScripts: [],
      substance: { stubs: 0, reexports: 0, real: 3, verdict: "substantive" },
      error: null,
    },
    run: { status: "complete", currentPhase: 12, sealedWithFailures: false, steps: 13, outcome: "complete" },
    install: { requested: false, ok: false, detail: "not requested" },
  };
}

test("acceptance-run — a fully green fact set is ok:true with no failure reasons", () => {
  const v = evaluateAcceptance(greenFacts());
  assert.equal(v.ok, true);
  assert.deepEqual(v.failureReasons, []);
  assert.ok(v.assertions.length >= 8);
  assert.ok(v.assertions.every((a) => a.ok), "every assertion green");
});

test("acceptance-run — a red tree-run is never ok:true", () => {
  const facts = greenFacts();
  facts.treeRun.ok = false;
  facts.treeRun.error = "spec tests/oracle.spec.ts: fail";
  const v = evaluateAcceptance(facts);
  assert.equal(v.ok, false);
  assert.ok(v.failureReasons.some((r) => r.startsWith("treeRun.ok:")));
});

test("acceptance-run — a stub-only tree (real:0 / stubs>0) is never ok:true", () => {
  const facts = greenFacts();
  facts.treeRun.substance = { stubs: 1, reexports: 0, real: 0, verdict: "stub-skeleton" };
  const v = evaluateAcceptance(facts);
  assert.equal(v.ok, false);
  assert.ok(v.failureReasons.some((r) => r.startsWith("tree.substantive:")));
});

test("acceptance-run — a website tree without index.html + a src entry is never ok:true", () => {
  const facts = greenFacts();
  facts.tree.entry = { ok: false, mode: "web", html: null, entry: "src/main.tsx", detail: "index.html missing" };
  const v = evaluateAcceptance(facts);
  assert.equal(v.ok, false);
  assert.ok(v.failureReasons.some((r) => r.startsWith("tree.entry:")));
});

test("acceptance-run — an unverified declared toolchain is never ok:true", () => {
  const facts = greenFacts();
  facts.treeRun.declaredScriptsVerified = false;
  facts.treeRun.unverifiedDeclaredScripts = ["typecheck"];
  const v = evaluateAcceptance(facts);
  assert.equal(v.ok, false);
  assert.ok(v.failureReasons.some((r) => r.startsWith("tree.declaredScriptsVerified:")));
});

test("acceptance-run — a missing tree and an incomplete run both fail", () => {
  const facts = greenFacts();
  facts.tree.exists = false;
  facts.tree.fileCount = 0;
  facts.tree.entry = { ok: false, mode: "web", detail: "no tree" };
  facts.run.status = "running";
  const v = evaluateAcceptance(facts);
  assert.equal(v.ok, false);
  assert.ok(v.failureReasons.some((r) => r.startsWith("tree.exists:")));
  assert.ok(v.failureReasons.some((r) => r.startsWith("run.cleanSeal:")));
});

test("acceptance-run — a requested install that fails fails the verdict", () => {
  const facts = greenFacts();
  facts.install = { requested: true, ok: false, detail: "npm install failed (exit 1)" };
  const v = evaluateAcceptance(facts);
  assert.equal(v.ok, false);
  assert.ok(v.failureReasons.some((r) => r.startsWith("tree.install:")));
});

test("acceptance-run — a step-capped run is named as capped, never hidden as a product failure", () => {
  const facts = greenFacts();
  facts.run = { status: "running", currentPhase: 12, sealedWithFailures: false, steps: 12, maxSteps: 12, outcome: "cap", capped: true };
  const v = evaluateAcceptance(facts);
  assert.equal(v.ok, false, "an incomplete run is never ok");
  const seal = v.assertions.find((a) => a.id === "run.cleanSeal");
  assert.ok(seal && seal.ok === false);
  assert.match(String(seal.detail), /capped at 12 step\(s\)/);
});

test("acceptance-run — ok is exactly (all assertions true) for every combination", () => {
  const base = greenFacts();
  const flips = [
    (f) => (f.tree.exists = false),
    (f) => (f.tree.fileCount = 0),
    (f) => (f.treeRun.ok = false),
    (f) => (f.treeRun.typecheck = "fail"),
    (f) => (f.treeRun.test = "fail"),
    (f) => (f.treeRun.declaredScriptsVerified = false),
    (f) => (f.treeRun.substance = { stubs: 0, reexports: 0, real: 0 }),
    (f) => (f.run.status = "awaiting_hitl"),
    (f) => (f.run.sealedWithFailures = true),
  ];
  for (const flip of flips) {
    const facts = structuredClone(base);
    flip(facts);
    const v = evaluateAcceptance(facts);
    assert.equal(v.ok, false, "a single red assertion must fail the verdict");
    assert.equal(
      v.ok,
      v.assertions.every((a) => a.ok),
      "ok is the AND of the assertions",
    );
  }
});

test(
  "acceptance-run — behavioral (keyless): one JSON verdict, honest ok:false for the deterministic floor",
  { timeout: 180_000 },
  () => {
    const dir = mkdtempSync(join(tmpdir(), "rapidtool-acceptance-test-"));
    try {
      const brief = join(dir, "brief.md");
      writeFileSync(brief, "Create a fully functioning website for a small bakery with an online menu and ordering.\n", "utf8");
      const out = join(dir, "out");
      const res = spawnSync(
        process.execPath,
        ["--experimental-strip-types", HARNESS, "--brief", brief, "--keyless", "--max-steps", "3", "--out", out],
        { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, DEEPSEEK_API_KEY: " " } },
      );
      assert.ok(existsSync(out), "the harness must materialize its run dir");
      const lines = res.stdout.trim().split(/\r?\n/);
      // The verdict is a single pretty-printed JSON object: the first line must
      // open the object and the last must close it (nothing else on stdout).
      assert.equal(lines[0], "{", `stdout must be one JSON object:\n${res.stdout}`);
      assert.equal(lines[lines.length - 1], "}");
      const verdict = JSON.parse(res.stdout);
      assert.equal(verdict.schema_version, 1);
      assert.equal(verdict.cmd, "acceptance-run");
      assert.equal(verdict.exit_code, res.status, "exit_code must match the process exit");
      assert.equal(verdict.ok, false, "the keyless deterministic floor is not a working product");
      assert.ok(Array.isArray(verdict.assertions) && verdict.assertions.length > 0);
      assert.ok(verdict.failureReasons.length > 0, "a failing verdict names its reasons");
      assert.equal(verdict.ok, verdict.assertions.every((a) => a.ok));
      // The additive product-quality reading rides BESIDE the verdict (an extra
      // field) and never changes `ok`. `src/lib/product-quality.ts` exists in
      // this repo, so it must be available and honestly report the floor as
      // not product-quality (no web entry / stub-only).
      assert.ok(verdict.productQuality && typeof verdict.productQuality === "object", "the additive product-quality reading must be reported");
      assert.equal(verdict.productQuality.available, true, "the product-quality module is present in this repo");
      assert.equal(verdict.productQuality.reader, "readProductQuality");
      assert.equal(verdict.productQuality.reading?.quality, false, "the keyless deterministic floor is not product-quality");
      assert.equal(
        verdict.ok,
        verdict.assertions.every((a) => a.ok),
        "the additive reading must never change the honest verdict rule",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// The emit policy must mirror the CLI's `emit --red-tree banner` — both sides
// admit the red-trail AND the below-floor `RT_E_PLAN_UNDERPRODUCED` partial with
// the caution banner. The pre-fix harness passed `redTree` alone, so the default
// `underProduced:"refuse"` landed ZERO files for a below-floor partial the CLI
// writes (proved live: 30 entries with the banner), and the reading could not
// score the product. Landing it never lowers the bar (a red tree is not ok:true).
// ---------------------------------------------------------------------------
test("acceptance emit policy mirrors the CLI's banner policy (red-trail + below-floor partial both land)", () => {
  assert.deepEqual(
    acceptanceEmitOptions(),
    { redTree: "banner", underProduced: "banner" },
    "the harness opts into BOTH partial classes (red-trail + below-floor)",
  );
  // B1-F10: BEHAVIOURAL, not a source-text regex. The pre-fix leg matched
  // `redTree === "banner" ? { underProduced: "banner" }` in the CLI bytes, which
  // passes even if the coupling is dead. This spawns the REAL CLI with the exact
  // flag the harness passes and proves the observable outcome the harness needs:
  // a partial tree MATERIALIZED on disk (a source-only mirror proves nothing).
  const project = join(ROOT, "testruns", "office-scheduler", "build.json");
  assert.ok(existsSync(project), `the below-floor fixture must be tracked: ${project}`);
  const out = mkdtempSync(join(tmpdir(), "rt-acceptance-banner-"));
  try {
    const env = { ...process.env };
    delete env.DEEPSEEK_API_KEY;
    const res = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI, "emit", "--project", project, "--out", out, "--red-tree", "banner"],
      { cwd: ROOT, env, encoding: "utf8", timeout: 300_000 },
    );
    assert.equal(res.error, undefined, `spawn failed: ${String(res.error)}`);
    const json = JSON.parse(res.stdout ?? "");
    assert.equal(typeof json.count, "number", `emit must report its file count.\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    assert.ok(json.count > 0, `--red-tree banner must LAND the partial (the harness scores the tree on disk); count=${json.count}`);
    const landed = readdirSync(out).length;
    assert.ok(
      landed > 0,
      `the bannered emit wrote ${landed} entries into the output dir — the harness's banner policy needs a materialized tree`,
    );
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// W353 — the entry requirement is kind-aware. A `tool`/`library`/`service` tree
// legitimately has no index.html; before this fix the harness failed such a tree
// for "index.html missing" — a false negative over a legitimate product.
// ---------------------------------------------------------------------------
test("resolveTreeEntry — a web kind requires index.html + a src mount", () => {
  const web = resolveTreeEntry(["index.html", "src/main.tsx"], {}, "app");
  assert.equal(web.ok, true);
  assert.equal(web.mode, "web");
  const missing = resolveTreeEntry(["src/main.tsx"], {}, "game");
  assert.equal(missing.ok, false);
  assert.match(String(missing.detail), /index.html missing/);
});

test("resolveTreeEntry — a tool/library/service kind is satisfied by its OWN entry, not HTML", () => {
  const cli = resolveTreeEntry(["bin/logscope-cli.mjs", "src/main.ts", "package.json"], { bin: { logscope: "bin/logscope-cli.mjs" } }, "tool");
  assert.equal(cli.ok, true, cli.detail ?? "");
  assert.equal(cli.mode, "tool");
  assert.equal(cli.entry, "bin/logscope-cli.mjs");
  const lib = resolveTreeEntry(["src/index.ts", "package.json"], {}, "library");
  assert.equal(lib.ok, true);
  assert.equal(lib.entry, "src/index.ts");
  // A non-web tree with neither an HTML page nor its own entry still fails.
  const empty = resolveTreeEntry(["package.json", "src/api/routes.ts"], {}, "library");
  assert.equal(empty.ok, false);
  assert.match(String(empty.detail), /no library entry/);
});

test("resolveTreeEntry — an absent kind keeps the historical web requirement (fail-closed)", () => {
  assert.equal(resolveTreeEntry(["index.html", "src/main.tsx"]).ok, true);
  assert.equal(resolveTreeEntry(["src/main.tsx"]).ok, false);
});

test("acceptance-run — a tool tree with its own CLI entry (no index.html) can be ok:true", () => {
  const facts = greenFacts();
  facts.tree.entry = { ok: true, mode: "tool", html: null, entry: "bin/cli.mjs", detail: null };
  facts.tree.webEntry = { ok: false, html: null, entry: null, detail: "index.html missing" };
  const v = evaluateAcceptance(facts);
  assert.equal(v.ok, true, v.failureReasons.join("; "));
});

// ---------------------------------------------------------------------------
// W353 — the below-floor state is reported by name, never hidden.
// ---------------------------------------------------------------------------
test("readBelowFloorState — records the writer's RT_E_PLAN_UNDERPRODUCED seal", () => {
  const s = readBelowFloorState({
    emit: { ok: true, underProduced: { code: "RT_E_PLAN_UNDERPRODUCED", detail: "floor 2, emitted 1" } },
    tree: { belowFloorBanner: true, redTreeBanner: false, redBanner: true },
  });
  assert.equal(s.belowFloor, true);
  assert.equal(s.recordedUnderProduced, true);
  assert.equal(s.emittedBelowFloorBanner, true);
  assert.equal(s.underProduced?.code, "RT_E_PLAN_UNDERPRODUCED");
});

test("readBelowFloorState — a below-floor banner without a recorded seal still reads below-floor", () => {
  const s = readBelowFloorState({ emit: { ok: true }, tree: { belowFloorBanner: true } });
  assert.equal(s.belowFloor, true);
  assert.equal(s.recordedUnderProduced, false);
});

test("readBelowFloorState — a red-tree banner is NOT a below-floor reading", () => {
  const s = readBelowFloorState({ emit: { ok: true }, tree: { belowFloorBanner: false, redTreeBanner: true, redBanner: true } });
  assert.equal(s.belowFloor, false);
  assert.equal(s.redTreeBanner, true);
  assert.equal(s.cautionBanner, true);
});

// ---------------------------------------------------------------------------
// W353 — batch mode: resolve + table + one verdict per brief.
// ---------------------------------------------------------------------------
test("resolveSuiteBriefs — a directory yields its brief files sorted by slug", () => {
  const dir = mkdtempSync(join(tmpdir(), "rapidtool-suite-resolve-"));
  try {
    writeFileSync(join(dir, "02-beta.md"), "beta\n", "utf8");
    writeFileSync(join(dir, "01-alpha.md"), "alpha\n", "utf8");
    writeFileSync(join(dir, "ignore.json"), "{}\n", "utf8");
    const r = resolveSuiteBriefs(dir);
    assert.equal(r.ok, true);
    assert.deepEqual(
      /** @type {any} */ (r).briefs.map((b) => b.slug),
      ["01-alpha", "02-beta"],
      "sorted, only *.md",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveSuiteBriefs — a comma list parses (and de-dupes by slug)", () => {
  const r = resolveSuiteBriefs("a/one.md,b/two.md,a/one.md");
  assert.equal(r.ok, true);
  assert.equal(/** @type {any} */ (r).briefs.length, 2);
  assert.deepEqual(
    /** @type {any} */ (r).briefs.map((b) => b.slug),
    ["one", "two"],
  );
});

test("resolveSuiteBriefs — an empty directory and a blank spec are coded refusals", () => {
  const dir = mkdtempSync(join(tmpdir(), "rapidtool-suite-empty-"));
  try {
    const r = resolveSuiteBriefs(dir);
    assert.equal(r.ok, false);
    assert.match(String(/** @type {any} */ (r).error), /no \*\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(resolveSuiteBriefs("").ok, false);
});

test("spendDelta — a suite attributes each brief only its OWN delta, never the cumulative total", () => {
  assert.deepEqual(spendDelta({ tokens: 100, calls: 2 }, { tokens: 350, calls: 7 }), { tokens: 250, calls: 5 });
  // A later brief must not inherit the earlier brief's tokens.
  assert.deepEqual(spendDelta({ tokens: 1000, calls: 20 }, { tokens: 1050, calls: 23 }), { tokens: 50, calls: 3 });
  // A non-monotone/absent snapshot clamps at zero (never a negative spend).
  assert.deepEqual(spendDelta({ tokens: 100 }, {}), { tokens: 0, calls: 0 });
});

test("formatRollupTable — header, one row per brief, below-floor marked", () => {  const table = formatRollupTable([
    { slug: "01-a", ok: true, exitCode: 0, status: "complete", currentPhase: 12, treeFileCount: 22, treeRun: { declaredScriptsVerified: true }, gates: { productQuality: true }, belowFloor: { belowFloor: false }, spend: { tokens: 111 } },
    { slug: "07-b", ok: false, exitCode: 1, status: "awaiting_hitl", currentPhase: 6, treeFileCount: 0, treeRun: { declaredScriptsVerified: false }, gates: { productQuality: false }, belowFloor: { belowFloor: true }, spend: { tokens: 222 } },
  ]);
  const lines = table.split("\n");
  assert.match(lines[0], /BRIEF\s+OK\s+EXIT/);
  assert.equal(lines.length, 4, "header + separator + 2 rows");
  assert.match(lines[3], /07-b\s+no\s+1/);
  assert.match(lines[3], /BELOW/);
  assert.match(lines[2], /01-a\s+yes\s+0/);
});

test(
  "acceptance-run — behavioral batch (keyless): one roll-up JSON + one verdict per brief",
  { timeout: 300_000 },
  () => {
    const dir = mkdtempSync(join(tmpdir(), "rapidtool-suite-test-"));
    try {
      const briefDir = join(dir, "briefs");
      mkdirSync(briefDir, { recursive: true });
      writeFileSync(join(briefDir, "01-first.md"), "Create a marketing website for a small bakery with an online menu.\n", "utf8");
      writeFileSync(join(briefDir, "02-second.md"), "Create a simple notes web app with a list and a save button.\n", "utf8");
      const out = join(dir, "out");
      const res = spawnSync(
        process.execPath,
        ["--experimental-strip-types", HARNESS, "--suite", briefDir, "--keyless", "--max-steps", "1", "--out", out],
        { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, DEEPSEEK_API_KEY: " " } },
      );
      const lines = res.stdout.trim().split(/\r?\n/);
      assert.equal(lines[0], "{", `stdout must be one JSON object:\n${res.stdout}`);
      assert.equal(lines[lines.length - 1], "}");
      const verdict = JSON.parse(res.stdout);
      assert.equal(verdict.cmd, "acceptance-run");
      assert.equal(verdict.kind, "suite");
      assert.equal(verdict.rollup.total, 2);
      assert.equal(verdict.briefs.length, 2);
      assert.equal(verdict.exit_code, res.status, "exit_code must match the process exit");
      assert.equal(verdict.ok, false, "the keyless deterministic floor is not a working product");
      assert.equal(verdict.rollup.ok, 0);
      assert.equal(verdict.rollup.failed, 2);
      assert.ok(typeof verdict.rollup.table === "string" && verdict.rollup.table.includes("BRIEF"), "the roll-up table must be reported");
      assert.ok(verdict.rollup.spend.tokens >= 0);
      for (const brief of verdict.briefs) {
        assert.ok(existsSync(brief.verdictPath), `one verdict per brief must be written: ${brief.verdictPath}`);
        const one = JSON.parse(readFileSync(brief.verdictPath, "utf8"));
        assert.equal(one.cmd, "acceptance-run");
        assert.equal(one.ok, false);
        assert.ok(Array.isArray(one.failureReasons) && one.failureReasons.length > 0, "each brief keeps its own failing reasons");
        assert.ok(one.belowFloor && typeof one.belowFloor === "object", "the additive below-floor reading rides each verdict");
        assert.equal(one.exit_code, brief.exitCode);
        // Per-brief spend is the measured DELTA, with the process-global
        // cumulative kept beside it — never the cumulative reported as the brief's.
        assert.ok(one.spend && one.spend.processCumulative, "the persisted verdict carries the cumulative beside its own delta");
        assert.ok(
          Number.isFinite(one.spend.tokens) && one.spend.tokens <= one.spend.processCumulative.tokens,
          `per-brief tokens (${one.spend?.tokens}) must not exceed the process cumulative (${one.spend?.processCumulative?.tokens})`,
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
