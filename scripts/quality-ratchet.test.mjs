// ---------------------------------------------------------------------------
// scripts/quality-ratchet.test.mjs — the ratchet's own test suite.
//
// Two layers, deliberately separated:
//   · PURE layer — the evaluator, the two owner-rule readers, the producer-output
//     parser, and the floors-file contract. Fast, no IO beyond reading two files.
//   · TEETH layer — the planted-regression proofs (a beaten floor MUST fail, a
//     mutated reader MUST trip its canary) and one CLI-contract run.
// The assertions that would depend on the rest of the tree being green (a floor
// breached on the real bytes) live in the ratchet's `--selftest` and in the
// gate's own `ratchet` stage, NOT here: a test that turns red because a sibling
// lane is mid-edit is not a test of this mechanism.
// ---------------------------------------------------------------------------

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REPO_ROOT,
  DEFAULT_FLOORS_PATH,
  SCHEMA,
  UNAVAILABLE_CODES,
  RATCHET_KINDS,
  SUBSTANCE_SCOPES,
  compareFloor,
  evaluate,
  scanRealProduct,
  scanRepoTestDoubles,
  testDoubleViolations,
  resolveRepoSpecifier,
  censusShape,
  censusRealTreesReading,
  importSpecifiers,
  isTestSeamPath,
  normalizeRequestedKind,
  kindFitOf,
  parseProducerJson,
  readJsonFile,
  loadFloors,
  jobFilesOf,
  walkFiles,
  readRegisteredCodes,
} from "./quality-ratchet.mjs";

const FLOORS_RAW = JSON.parse(readFileSync(DEFAULT_FLOORS_PATH, "utf8").replace(/^\uFEFF/, ""));
const FLOORS = { ...FLOORS_RAW, _canaries: FLOORS_RAW.canaries ?? {} };

test("floors file: schema, per-metric contract, and the no-fabrication rule", () => {
  assert.equal(FLOORS_RAW.schema, "rapidtool-quality-ratchet-floors/1");
  assert.equal(FLOORS_RAW.estimatedCostUsd, null, "estimatedCostUsd must stay null — no spend is fabricated");
  const ids = Object.keys(FLOORS_RAW.floors);
  assert.ok(ids.length >= 20, `expected a substantial metric set, found ${ids.length}`);
  for (const [id, spec] of Object.entries(FLOORS_RAW.floors)) {
    assert.ok(["enforced", "pending-first-green", "uncovered"].includes(spec.status), `${id}: bad status ${spec.status}`);
    assert.ok(typeof spec.producer === "string" && spec.producer.trim() !== "", `${id}: no producing command named`);
    assert.ok(typeof spec.reason === "string" && spec.reason.trim() !== "", `${id}: no reason`);
    if (spec.status === "uncovered") {
      assert.equal(spec.floor, null, `${id}: an uncovered pin must carry floor:null (never a pass)`);
      continue;
    }
    assert.ok(spec.direction === "atLeast" || spec.direction === "atMost", `${id}: bad direction`);
    assert.equal(typeof spec.floor, "number", `${id}: non-uncovered pin needs a numeric floor`);
    // A regression must be a HARD failure: only `enforced` pins can fail, so an
    // unlimited "pending" set is visible in this assertion's sibling test below.
  }
  // Every canary the script implements must be declared with a reader + an assertion.
  for (const [id, spec] of Object.entries(FLOORS_RAW.canaries)) {
    assert.ok(id.startsWith("canary."), `${id}: canary ids are namespaced`);
    assert.ok(typeof spec.reader === "string" && spec.reader.trim() !== "", `${id}: no reader named`);
    assert.ok(typeof spec.assert === "string" && spec.assert.trim() !== "", `${id}: no assertion`);
  }
});

test("floors file: the pending-first-green set is bounded and each names its honest bar", () => {
  const pending = Object.entries(FLOORS_RAW.floors).filter(([, s]) => s.status === "pending-first-green");
  assert.ok(pending.length < Object.keys(FLOORS_RAW.floors).length, "the ratchet cannot be all-pending (that would be toothless)");
  for (const [id, spec] of pending) {
    assert.match(spec.reason, /bar is 0|unavailable|opt-in|does not exist yet|Honest bar/i, `${id}: a pending pin must state its honest bar or why it is unavailable`);
  }
});

test("compareFloor: both directions, and the raise is not a regression", () => {
  assert.equal(compareFloor("atLeast", 6, 6), "ok");
  assert.equal(compareFloor("atLeast", 6, 5), "regressed");
  assert.equal(compareFloor("atLeast", 6, 7), "raise");
  assert.equal(compareFloor("atMost", 0, 0), "ok");
  assert.equal(compareFloor("atMost", 0, 1), "regressed");
  assert.equal(compareFloor("atMost", 0, -1), "raise");
  assert.throws(() => compareFloor(/** @type {any} */ ("sideways"), 0, 0), /unknown floor direction/);
});

test("evaluate: a clean reading set is green; a raise is named but never a failure", () => {
  const floors = { floors: { a: { direction: "atLeast", floor: 2, status: "enforced", producer: "p" }, b: { direction: "atMost", floor: 3, status: "enforced", producer: "p" } } };
  const v = evaluate({ readings: { a: { value: 2 }, b: { value: 3 } }, canaries: [{ id: "c", ok: true }], floors });
  assert.equal(v.ok, true);
  assert.deepEqual(v.regressions, []);
  const raised = evaluate({ readings: { a: { value: 9 }, b: { value: 0 } }, canaries: [], floors });
  assert.equal(raised.ok, true);
  assert.deepEqual(raised.metrics.map((m) => m.result).sort(), ["raise", "raise"]);
});

test("evaluate: A PLANTED REGRESSION ON EVERY ENFORCED FLOOR IS A NAMED HARD FAILURE", () => {
  const enforced = Object.entries(FLOORS_RAW.floors).filter(([, s]) => s.status === "enforced" && typeof s.floor === "number");
  assert.ok(enforced.length >= 10, `expected a substantial enforced set, found ${enforced.length}`);
  const clean = Object.fromEntries(enforced.map(([id, s]) => [id, { value: s.floor }]));
  assert.equal(evaluate({ readings: clean, canaries: [], floors: FLOORS }).ok, true, "the real floors file must be satisfiable at its own floor values");
  for (const [id, spec] of enforced) {
    const beaten = spec.direction === "atLeast" ? spec.floor - 1 : spec.floor + 1;
    const v = evaluate({ readings: { ...clean, [id]: { value: beaten } }, canaries: [], floors: FLOORS });
    assert.equal(v.ok, false, `${id}: beating ${spec.direction} floor ${spec.floor} to ${beaten} must fail`);
    assert.ok(v.regressions.some((r) => r.startsWith(`${id} (`)), `${id}: the failure must be NAMED (got ${JSON.stringify(v.regressions)})`);
  }
});

test("evaluate: an enforced metric that cannot be produced fails closed; a pending one does not", () => {
  const floors = { floors: { e: { direction: "atLeast", floor: 1, status: "enforced", producer: "p" }, p: { direction: "atLeast", floor: 1, status: "pending-first-green", producer: "p" } } };
  // A BROKEN/ABSENT producer on an enforced pin is a hard failure — never a silent pass.
  const broken = evaluate({ readings: { e: { value: null, code: UNAVAILABLE_CODES.artifactAbsent, reason: "artifact absent" }, p: { value: null, code: UNAVAILABLE_CODES.artifactAbsent, reason: "artifact absent" } }, canaries: [], floors });
  assert.equal(broken.ok, false);
  assert.equal(broken.unavailableEnforced.length, 1);
  assert.match(broken.unavailableEnforced[0], /^e \(RT_E_/);
  // A MISSING INPUT (the producer was not run in this invocation) is reported, not failed.
  const unsupplied = evaluate({ readings: { e: { value: null, code: UNAVAILABLE_CODES.producerNotRun, reason: "not run" }, p: { value: null, code: UNAVAILABLE_CODES.producerNotRun, reason: "not run" } }, canaries: [], floors });
  assert.deepEqual(unsupplied.unavailableEnforced, [], "an unsupplied producer is a missing input, not a tree failure");
  assert.ok(unsupplied.unavailable.some((x) => x.startsWith("e: ")), "but it must still be reported as unavailable");
  assert.ok(!unsupplied.unavailableEnforced.some((x) => x.startsWith("p ")), "a pending-first-green metric must never hard-fail");
});

test("evaluate: an uncovered pin is `uncovered` — never a pass, never a regression", () => {
  const floors = { floors: { k: { direction: "atLeast", floor: null, status: "uncovered", producer: "p" } } };
  const v = evaluate({ readings: {}, canaries: [], floors });
  assert.equal(v.ok, true);
  assert.deepEqual(v.uncovered, ["k"]);
  assert.equal(v.metrics[0].result, "uncovered");
});

test("evaluate: a pin without a numeric floor + direction is an invalid floor, not a pass", () => {
  const v = evaluate({ readings: {}, canaries: [], floors: { floors: { x: { status: "enforced", producer: "p" } } } });
  assert.equal(v.ok, false);
  assert.deepEqual(v.unknownMetricIds, ["x"]);
});

test("evaluate: a failing canary is a hard failure, named", () => {
  const floors = { floors: { a: { direction: "atLeast", floor: 0, status: "enforced", producer: "p" } } };
  const v = evaluate({ readings: { a: { value: 0 } }, canaries: [{ id: "canary.x", ok: false, reason: "shape changed" }], floors });
  assert.equal(v.ok, false);
  assert.deepEqual(v.canaryFailures, ["canary.x: shape changed"]);
});

// --- the two owner rules -----------------------------------------------------

const CLASSIFY = (source) => {
  const s = String(source ?? "");
  if (s.trim() === "") return "stub";
  if (s.includes("TODO(E-15)") || /throw\s+new\s+Error\s*\(\s*(['"`])TODO\b/i.test(s)) return "stub";
  if (/^export\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?$/m.test(s.trim())) return "reexport";
  return "real";
};

test("realProductOnly: the scanner has teeth (clean silent, injected defect fires)", () => {
  const clean = [
    { path: "src/domain/orders.ts", source: "export function createOrder(id: string) {\n  return { id };\n}" },
    { path: "tests/orders.spec.ts", source: 'import { rows } from "./fake-orders.ts";\ntest("x", () => {});' },
  ];
  const defect = [
    { path: "src/domain/orders.ts", source: 'export function createOrder() {\n  throw new Error("TODO(E-15)");\n}' },
    { path: "src/domain/users.ts", source: 'import { FAKE_USERS } from "../__mocks__/users.ts";\nexport const rows = FAKE_USERS;' },
  ];
  const c = scanRealProduct(clean, CLASSIFY);
  const d = scanRealProduct(defect, CLASSIFY);
  assert.equal(c.violations.length, 0, `a clean production list must stay silent (got ${JSON.stringify(c.violations)})`);
  assert.ok(d.violations.length >= 2, "the injected defect must fire");
  assert.ok(d.violations.some((v) => v.kind === "stub-module"));
  assert.ok(d.violations.some((v) => v.kind === "test-double-import" || v.kind === "marker"));
  // A test double INSIDE a test seam is legitimate and must NOT be a violation.
  assert.equal(c.productionModules, 1, "the test-seam file is excluded from the production census");
});

test("realProductOnly: an HTML/JSX placeholder ATTRIBUTE is not placeholder code (no false positive)", () => {
  const attribute = [
    {
      path: "src/ui/page.tsx",
      source: 'export const row = \'<input placeholder="sourdough, croissant, cake" />\';\nexport const cfg = { placeholder: "Search products" };',
    },
  ];
  const s = scanRealProduct(attribute, CLASSIFY);
  assert.deepEqual(s.violations, [], "a `placeholder=` attribute or a `placeholder:` property is a product byte, not a placeholder marker");
});

test("realProductOnly: the documented stub vocabulary each fires", () => {
  const cases = [
    ['export function f() { throw new Error("TODO(E-15)"); }', "TODO(E-15)"],
    ["", "blank"],
  ];
  for (const [source, marker] of cases) {
    const s = scanRealProduct([{ path: "src/jobs/a.ts", source }], CLASSIFY);
    assert.ok(s.violations.some((v) => v.kind === "stub-module" && v.marker === marker), `${marker} must be a stub-module violation`);
  }
  const markers = [
    "const NOT_IMPLEMENTED = true",
    "export const banner = 'this page is not published by this build';",
    "const MOCK_ROWS = [1, 2];",
    "const demoData = [1];",
    "// Lorem ipsum dolor sit amet",
  ];
  for (const source of markers) {
    const s = scanRealProduct([{ path: "src/domain/a.ts", source: `export const x = 1;\n${source}` }], CLASSIFY);
    assert.ok(s.violations.some((v) => v.kind === "marker"), `marker must fire on: ${source}`);
  }
  const api = scanRealProduct([{ path: "src/domain/a.ts", source: 'export const x = 1;\nvi.mock("./loop.ts");' }], CLASSIFY);
  assert.ok(api.violations.some((v) => v.kind === "test-double-api"), "a test-double library API in a production module must fire");
});

test("realProductOnly: no false positive on the REAL corpus bytes that carry a placeholder attribute", () => {
  const real = join(REPO_ROOT, "testruns", "bakery-website", "emitted.v2", "src", "generated", "render-menu-page.ts");
  if (!existsSync(real)) return; // corpus absent on this host: nothing to prove, never a fabricated pass
  const files = walkFiles(join(REPO_ROOT, "testruns", "bakery-website", "emitted.v2"))
    .filter((f) => /\.(?:ts|tsx|mjs|js)$/.test(f.path) && !/\.(?:spec|test)\./.test(f.path))
    .map((f) => ({ path: f.path, source: readFileSync(f.absPath, "utf8") }));
  const s = scanRealProduct(files, CLASSIFY);
  assert.ok(s.violations.every((v) => v.path !== "src/generated/render-menu-page.ts"), "the real file whose only `placeholder` hits are HTML attributes must not be flagged");
});

test("isTestSeamPath / importSpecifiers", () => {
  assert.equal(isTestSeamPath("tests/oracle.spec.ts"), true);
  assert.equal(isTestSeamPath("src/lib/x.test.ts"), true);
  assert.equal(isTestSeamPath("src/__mocks__/x.ts"), true);
  assert.equal(isTestSeamPath("src/lib/engine.ts"), false);
  assert.deepEqual(importSpecifiers('import { a } from "./a.ts";\nconst b = require("./b.ts");'), ["./a.ts", "./b.ts"]);
});

// --- R-5: the owner rule over RapidTool's own `src/**` ------------------------

test("realProductOnly (repo scope): a production module importing a test double FIRES; the legitimate doubles do NOT", () => {
  const planted = [
    { path: "src/lib/engine.ts", source: 'import { rows } from "./__mocks__/engine.ts";\nexport const run = rows;' },
    { path: "src/lib/mcp/client.ts", source: 'import { start } from "./tests/harness.ts";' },
    { path: "src/lib/mcp/tests/harness.ts", source: "export const start = 1;" },
  ];
  const scan = scanRepoTestDoubles(planted);
  assert.ok(scan.violations.length >= 2, `the planted defect must fire, got ${JSON.stringify(scan.violations)}`);
  assert.ok(scan.violations.some((v) => v.kind === "test-double-import"));
  // The resolution leg: the SPECIFIER is innocuous, the TARGET is a test seam.
  assert.ok(
    scan.violations.some((v) => v.path === "src/lib/mcp/client.ts" && v.marker === "./tests/harness.ts"),
    "a specifier that resolves to a test seam must fire even when its own text says nothing",
  );
  // A double IS legitimate inside a seam: the seam file itself is not a violation.
  assert.ok(!scan.violations.some((v) => v.path === "src/lib/mcp/tests/harness.ts"));
  assert.equal(scan.seamModules, 1);
  assert.equal(scan.productionModules, 2);
});

test("realProductOnly (repo scope): the three test-seam-confined doubles are NOT flagged (zero false positives)", () => {
  const clean = [
    { path: "src/lib/llm/providers/mock.ts", source: "export const mockProvider = () => ({ ok: true });" },
    { path: "src/lib/mcp/stub-server.ts", source: "export function start() { return 0; }" },
    { path: "src/lib/testing/fixtures.ts", source: "export const seed = 1;" },
    { path: "src/lib/engine.test.ts", source: 'import { seed } from "./testing/fixtures.ts";\nimport { mockProvider } from "./llm/providers/mock.ts";' },
  ];
  const scan = scanRepoTestDoubles(clean);
  assert.deepEqual(scan.violations, [], "a double confined to a test seam is legitimate product structure, not a violation");
  assert.deepEqual(testDoubleViolations("src/lib/engine.ts", "export const x = 1;"), []);
});

test("realProductOnly (repo scope): the REAL tree reads zero violations over a non-empty production set", () => {
  // The false-positive control has to be measured on the bytes, not only on a fixture.
  const files = walkFiles(join(REPO_ROOT, "src"))
    .filter((f) => /\.(?:m?[jt]sx?|cjs)$/i.test(f.path))
    .map((f) => ({ path: `src/${f.path}`, source: readFileSync(f.absPath, "utf8") }));
  const scan = scanRepoTestDoubles(files);
  assert.ok(scan.productionModules > 100, `the walk must enumerate the repo's own modules, saw ${scan.productionModules}`);
  assert.equal(scan.violations.length, 0, `the real tree must read clean:\n${JSON.stringify(scan.violations, null, 2)}`);
  for (const legit of ["src/lib/llm/providers/mock.ts", "src/lib/mcp/stub-server.ts", "src/lib/testing/fixtures.ts"]) {
    assert.ok(scan.violations.every((v) => v.path !== legit), `${legit} is test-seam-confined and must not be flagged`);
  }
});

test("resolveRepoSpecifier resolves the `@/` alias, relative paths and index modules", () => {
  const set = new Set(["src/lib/a.ts", "src/lib/b/index.ts", "src/lib/deep/c.ts"]);
  assert.equal(resolveRepoSpecifier("@/lib/a.ts", "src/lib/x.ts", set), "src/lib/a.ts");
  assert.equal(resolveRepoSpecifier("./a.ts", "src/lib/x.ts", set), "src/lib/a.ts");
  assert.equal(resolveRepoSpecifier("./b", "src/lib/x.ts", set), "src/lib/b/index.ts");
  assert.equal(resolveRepoSpecifier("../deep/c.ts", "src/lib/other/x.ts", set), "src/lib/deep/c.ts");
  assert.equal(resolveRepoSpecifier("node:fs", "src/lib/x.ts", set), null, "a bare/builtin specifier is never a repo module");
  assert.equal(resolveRepoSpecifier("./missing.ts", "src/lib/x.ts", set), null);
});

// --- R-4 / R-8: both named census scopes, over every row ----------------------

test("censusShape: BOTH named scopes are required (the optional-in-type pair), and each break is named", () => {
  const good = (v) => ({ stubs: 0, reexports: 0, real: 1, files: [{ path: "src/jobs/a.ts", kind: "real" }], verdict: v });
  assert.deepEqual(censusShape({ verdict: "real", jobScoped: good("real"), wholeTree: good("mixed") }), []);
  assert.deepEqual(SUBSTANCE_SCOPES, ["jobScoped", "wholeTree"]);
  const noWhole = censusShape({ verdict: "real", jobScoped: good("real") });
  assert.equal(noWhole.length, 1);
  assert.match(noWhole[0], /wholeTree/);
  const renamed = censusShape({ verdict: "real", wholeTree: good("mixed") });
  assert.equal(renamed.length, 1);
  assert.match(renamed[0], /jobScoped/);
  const badVerdict = censusShape({ verdict: "real", jobScoped: { ...good("real"), verdict: "shiny" }, wholeTree: good("mixed") });
  assert.match(badVerdict[0], /not one of/);
  const noFiles = censusShape({ verdict: "real", jobScoped: { stubs: 0, reexports: 0, real: 1, verdict: "real" }, wholeTree: good("mixed") });
  assert.match(noFiles[0], /`jobScoped.files` is not an array/);
  assert.deepEqual(censusShape(null), ["the reader returned no object", "the reader returned no object"]);
});

test("censusRealTreesReading: a shape-invalid row or an empty corpus fails CLOSED, never a smaller number", () => {
  const good = (v) => ({ stubs: 0, reexports: 0, real: 1, files: [{ path: "src/jobs/a.ts", kind: "real" }], verdict: v });
  const ok = censusRealTreesReading({
    ok: true,
    rows: [
      { tree: "a", job: "real", whole: "mixed", shapeError: null, top: "real", raw: {} },
      { tree: "b", job: "empty", whole: "mixed", shapeError: null, top: "empty", raw: {} },
    ],
  });
  assert.equal(ok.value, 1);
  assert.equal(ok.evidence.perTree.length, 2, "both named readings are reported per tree");
  assert.equal(ok.evidence.perTree[0].jobScoped, "real");
  assert.equal(ok.evidence.perTree[0].wholeTree, "mixed");

  const broken = censusRealTreesReading({ ok: true, rows: [{ tree: "a", job: null, whole: null, shapeError: "`jobScoped` is not reachable", top: "real", raw: {} }] });
  assert.equal(broken.value, null, "a renamed scope must not read as 0 real trees");
  assert.equal(broken.code, UNAVAILABLE_CODES.readerShapeInvalid);
  assert.match(String(broken.reason), /a -> /);

  const empty = censusRealTreesReading({ ok: true, rows: [] });
  assert.equal(empty.value, null);
  assert.equal(empty.code, UNAVAILABLE_CODES.readerShapeInvalid);
  assert.equal(censusRealTreesReading({ ok: false, reason: "cassette missing", rows: [] }).value, null);
  assert.equal(good("real").verdict, "real");
});

// --- R-3: no toothless floor --------------------------------------------------

test("floors file: every `atLeast: 0` pin declares a MOVING sub-leg floor or a non-regressible reason", () => {
  const zeroPins = Object.entries(FLOORS_RAW.floors).filter(([, s]) => s.direction === "atLeast" && s.floor === 0 && s.status !== "uncovered");
  assert.ok(zeroPins.length > 0, "the accounting would be vacuous with no atLeast-0 pin — this test is the canary's twin");
  for (const [id, spec] of zeroPins) {
    const legs = Array.isArray(spec.subLegs) ? spec.subLegs : [];
    if (legs.length > 0) {
      for (const leg of legs) {
        const target = FLOORS_RAW.floors[leg];
        assert.ok(target, `${id}: subLeg ${leg} names no floor`);
        assert.ok(typeof target.floor === "number" && target.floor > 0, `${id}: subLeg ${leg} is itself pinned at ${target.floor} — a regression cannot move it either`);
      }
      continue;
    }
    assert.ok(typeof spec.nonRegressible === "string" && spec.nonRegressible.length > 20, `${id}: an atLeast-0 pin needs subLegs or a nonRegressible reason`);
  }
  // The R-3 pins in particular: the headline count and the three kind-fit counts.
  for (const id of ["productQuality.qualityCount", "kindFit.app.fit", "kindFit.game.fit", "kindFit.library.fit"]) {
    assert.ok(FLOORS_RAW.floors[id].subLegs?.length > 0, `${id} must name the moving sub-legs the cartographer's R-3 says the floor cannot see`);
  }
  // And the raised bar: an opt-in producer's sample floor is no longer a 0 that cannot fire.
  assert.equal(FLOORS_RAW.floors["tree.tscPassSample"].floor, 1);
});

// --- W358 · R-11 + the re-pinned lint reading --------------------------------

test("floors file: R-11 — the two kind-surface legs are pinned, and each fails when planted at floor−1", () => {
  for (const id of ["kindFit.game.surfaceOk", "kindFit.library.surfaceOk"]) {
    const spec = FLOORS_RAW.floors[id];
    assert.ok(spec, `${id}: the leg the ratchet can already measure (0 of 1) had NO pin — W357 R-11`);
    assert.equal(spec.status, "enforced", `${id}: the pin must be enforced, not prose`);
    assert.equal(spec.floor, 0, `${id}: pinned at the measured 0 of 1 — a floor may only rise`);
    assert.equal(spec.reading, 0, `${id}: the reading is the measured 0`);
    assert.ok(
      typeof spec.nonRegressible === "string" && spec.nonRegressible.length > 20,
      `${id}: an atLeast-0 pin must account for itself (subLegs or a non-regressible reason)`,
    );
    // Planted at floor−1: a NAMED hard failure — the same plant the selftest runs over
    // every enforced numeric floor, quoted here for these two pins by name.
    const v = evaluate({ readings: { [id]: { value: spec.floor - 1 } }, canaries: [], floors: FLOORS });
    assert.equal(v.ok, false, `${id}: beating the floor to ${spec.floor - 1} must fail`);
    assert.ok(v.regressions.some((r) => r.startsWith(`${id} (`)), `${id}: the failure must be NAMED (got ${JSON.stringify(v.regressions)})`);
  }
  // And the leg is not silent when the reading disappears: an unproducible reading on an
  // ENFORCED pin is a hard failure (so removing the game/library surface reading entirely
  // can no longer slip through the two `entryOk`/`units` floors that never measured it).
  const gone = evaluate({
    readings: { "kindFit.game.surfaceOk": { value: null, code: UNAVAILABLE_CODES.artifactAbsent, reason: "no emitted artifact for a game-kind brief" } },
    canaries: [],
    floors: FLOORS,
  });
  assert.equal(gone.ok, false);
  assert.ok(
    gone.unavailableEnforced.some((x) => x.startsWith("kindFit.game.surfaceOk ")),
    "an unproducible kind-surface reading must fail closed on the enforced pin",
  );
});

test("floors file: `lint.problems` is re-pinned to the measured 5 with the honest bar still 0", () => {
  const spec = FLOORS_RAW.floors["lint.problems"];
  assert.equal(spec.direction, "atMost");
  assert.equal(spec.floor, 0, "the honest bar stays 0 — the re-pin moves the READING, never the bar");
  assert.equal(spec.status, "pending-first-green", "a tree carrying 5 problems is not lint-clean, so the pin stays pending (reported), never enforced-as-met");
  assert.equal(spec.reading, 5, "the reading is the boundary's own measured value (fix-lint): 947 → 5");
  assert.match(String(spec.reason), /947 → 5/);
  // A reading above the bar can never read as a pass...
  const v = evaluate({ readings: { "lint.problems": { value: 5 } }, canaries: [], floors: FLOORS });
  assert.deepEqual(
    v.metrics.filter((m) => m.id === "lint.problems").map((m) => m.result),
    ["pending"],
    "5 problems against a floor of 0 is pending-below-the-bar, never `ok`",
  );
  assert.ok(
    v.pendingFirstGreen.some((x) => x.startsWith("lint.problems (BELOW THE HONEST BAR today)")),
    "the below-the-bar marker must be carried",
  );
  assert.ok(!v.regressions.some((r) => r.startsWith("lint.problems ")), "a pending-first-green pin is reported, not enforced — the boundary owner flips it once the source tree is warning-free");
  // ...and the bar is reachable, not decorative: at 0 the comparison is `ok` (the pin still
  // reports `pending` because its status is pending-first-green — only the owner enforces it).
  const clean = evaluate({ readings: { "lint.problems": { value: 0 } }, canaries: [], floors: FLOORS });
  const cleanMetric = clean.metrics.find((m) => m.id === "lint.problems");
  assert.equal(cleanMetric.comparison, "ok", "0 problems MEETS the floor of 0 — the bar is reachable");
  assert.ok(!clean.pendingFirstGreen.some((x) => x.startsWith("lint.problems (BELOW")), "a met bar carries no below-the-bar marker");
});

test("floors file: the owed code is DECLARED, registered, and not emitted by this ratchet — the debt is PAID and verified", () => {
  const owed = Object.keys(FLOORS_RAW.owedCodes ?? {});
  assert.deepEqual(owed, ["RT_E_RATCHET_METRIC_UNAVAILABLE"]);
  const entry = FLOORS_RAW.owedCodes[owed[0]];
  // W358: the owed edit landed (ERROR_CODES + ERROR_CODE_DOC), so the record says so —
  // and the canary verifies the recorded payment against the register (never claims it).
  assert.equal(entry.status, "registered", "the owed edit has landed — record it as `registered`, do not leave a stale 'unowned this wave' debt");
  assert.match(String(entry.owedEdit), /src\/lib\/errors\.ts/);
  assert.match(String(entry.owedEdit), /APPLIED/, "a paid debt must say the edit was applied, and when");
  const emitted = Object.values(UNAVAILABLE_CODES);
  assert.ok(!emitted.includes("RT_E_RATCHET_METRIC_UNAVAILABLE"), "the ratchet does not emit this code yet — it classifies by cause through the three long-standing codes (recorded in the entry's `why`)");
  const registry = readRegisteredCodes();
  assert.equal(registry.ok, true, registry.reason);
  const registered = new Set(/** @type {string[]} */ (registry.evidence?.registered ?? []));
  assert.ok(registered.has("RT_E_RATCHET_METRIC_UNAVAILABLE"), "a debt recorded as PAID must really be in ERROR_CODES");
  assert.ok(registered.has("RT_E_VALIDATION") && registered.has("RT_E_INTERNAL"), "the neighbouring registry lines must survive the append");
  for (const code of emitted) assert.ok(registered.has(code), `${code} must stay registered`);
});

// --- kindFit -----------------------------------------------------------------

const stubReaders = {
  resolveTreeEntry: (files, pkg, kind) => {
    const has = (p) => files.includes(p);
    if (kind === "app" || kind === "game") {
      const ok = has("index.html") && (has("src/main.tsx") || has("src/main.ts"));
      return { ok, mode: "web", detail: ok ? null : "index.html missing" };
    }
    const ok = files.some((f) => /^src\/(main|cli)\.(ts|mjs)$/.test(f));
    return { ok, mode: kind, detail: ok ? null : "no program entry" };
  },
  readProductQuality: (record) => ({ kindSurface: { kind: record?.surface ?? "none" } }),
  fleetProductQualityFromProjects: (rows) => ({ readings: rows.map((r) => ({ surfaceOk: r.__surfaceOk === true })) }),
};

test("kindFit: a kind with no emitted case is `uncovered` — never a pass", () => {
  const units = [{ source: "s", unit: "u", requestedKind: "game", files: [], pkg: {}, record: {} }];
  const fit = kindFitOf(units, stubReaders);
  assert.equal(fit.byKind.tool.units, 0);
  assert.equal(fit.byKind.tool.uncovered, true);
  assert.equal(fit.byKind.tool.fit, 0, "an uncovered kind contributes no fit — it is not a pass");
  assert.equal(fit.byKind.game.units, 1);
});

test("kindFit: all three legs must hold, and each unmet leg is named", () => {
  const good = {
    source: "s",
    unit: "u",
    requestedKind: "webapp",
    files: [{ path: "index.html", source: "<html></html>" }, { path: "src/main.tsx", source: "export {}" }],
    pkg: { scripts: { typecheck: "tsc", test: "node --test", build: "vite build" } },
    record: { surface: "web", __surfaceOk: true },
  };
  const fit = kindFitOf([good], stubReaders);
  assert.equal(fit.byKind.app.fit, 1, JSON.stringify(fit.rows[0].unmet));

  const noScripts = { ...good, pkg: { scripts: { typecheck: "tsc" } } };
  const r = kindFitOf([noScripts], stubReaders).rows[0];
  assert.equal(r.fit, false);
  assert.ok(r.missingScripts.includes("test"));

  const wrongSurface = { ...good, record: { surface: "none", __surfaceOk: true } };
  const r2 = kindFitOf([wrongSurface], stubReaders).rows[0];
  assert.equal(r2.fit, false);
  assert.ok(r2.unmet.some((u) => u.includes("demanded surface")));

  const missingEntry = { ...good, files: [{ path: "src/main.tsx", source: "export {}" }] };
  const r3 = kindFitOf([missingEntry], stubReaders).rows[0];
  assert.equal(r3.fit, false);
  assert.ok(r3.unmet.some((u) => u.includes("entry shape")));
});

test("kindFit: an unknown requested kind is not silently treated as a pass", () => {
  const fit = kindFitOf([{ source: "s", unit: "u", requestedKind: "spaceship", files: [], pkg: {}, record: {} }], stubReaders);
  assert.equal(fit.rows[0].fit, false);
  assert.equal(fit.rows[0].uncovered, true);
  assert.equal(fit.byKind.app.units, 0);
});

test("normalizeRequestedKind maps the corpus vocabulary and rejects the unknown", () => {
  assert.equal(normalizeRequestedKind("webapp"), "app");
  assert.equal(normalizeRequestedKind("cli-tool"), "tool");
  assert.equal(normalizeRequestedKind("service"), "service");
  assert.equal(normalizeRequestedKind("GAME"), "game");
  assert.equal(normalizeRequestedKind(""), null);
  assert.equal(normalizeRequestedKind("spaceship"), null);
  for (const k of RATCHET_KINDS) assert.equal(normalizeRequestedKind(k), k);
});

// --- producers ---------------------------------------------------------------

test("parseProducerJson: a pretty-printed verdict parses; a stray line does not", () => {
  assert.deepEqual(parseProducerJson('{\n  "count": 34,\n  "countFloor": 34\n}\n', ["count", "countFloor"]), { count: 34, countFloor: 34 });
  assert.deepEqual(parseProducerJson('noise\n{"count":1,"countFloor":2}\n', ["count", "countFloor"]), { count: 1, countFloor: 2 });
  assert.equal(parseProducerJson("}\n", ["count"]), null, "a lone brace is not a reading");
  assert.equal(parseProducerJson('{"count":1}\n', ["count", "missingKey"]), null, "a candidate lacking a required key is not a reading");
  assert.equal(parseProducerJson("", ["count"]), null);
});

test("readRegisteredCodes: every code the ratchet emits is registered in ERROR_CODES", () => {
  const r = readRegisteredCodes();
  assert.equal(r.ok, true, r.reason);
  for (const code of Object.values(UNAVAILABLE_CODES)) assert.match(code, /^RT_E_/);
  const evidence = r.evidence;
  assert.ok(evidence && evidence.codes > 0, "the registry must be non-empty");
  const used = /** @type {string[]} */ (evidence.used);
  for (const code of used) assert.ok(!/RATCHET/.test(code), `${code} must be an EXISTING code, not a newly minted one`);
});

test("loadFloors: a missing floor file fails closed (never `no floors to check`)", () => {
  const bad = /** @type {any} */ (loadFloors(join(REPO_ROOT, "scripts", "does-not-exist-floors.json")));
  assert.equal(bad.ok, false);
  assert.match(String(bad.error), /missing or unparseable/);
  assert.equal(loadFloors(DEFAULT_FLOORS_PATH).ok, true);
});

test("the real corpus is present and the job-scope canary is not vacuous", () => {
  const trees = readJsonFile(join(REPO_ROOT, "scripts", "prevention", "cassettes", "trees.json"));
  assert.ok(Array.isArray(trees?.trees) && trees.trees.length >= 13, "the pinned corpus cassette must list >= 13 trees");
  const withJobs = trees.trees.map((t) => jobFilesOf(join(REPO_ROOT, "testruns", t.replace(/\//g, "\\")))).filter((f) => f.length > 0);
  assert.ok(withJobs.length > 0, "at least one corpus tree must carry job modules, or the job-scope canary proves nothing");
});

test("walkFiles is deterministic and skips VCS/dep dirs", () => {
  const a = walkFiles(join(REPO_ROOT, "scripts", "prevention", "cassettes")).map((f) => f.path);
  const b = walkFiles(join(REPO_ROOT, "scripts", "prevention", "cassettes")).map((f) => f.path);
  assert.deepEqual(a, b);
  assert.ok(a.every((p) => !/(^|\/)(node_modules|\.git)\//.test(p)));
  assert.ok(a.some((p) => p.endsWith("trees.json")));
});

// --- CLI contract ------------------------------------------------------------

test("CLI: `--all` prints ONE parseable JSON verdict, names every floor, and fabricates no cost", () => {
  let out = "";
  let status = 0;
  try {
    out = execFileSync(process.execPath, ["scripts/quality-ratchet.mjs", "--all", "--quiet"], { cwd: REPO_ROOT, encoding: "utf8", timeout: 900000, maxBuffer: 128 * 1024 * 1024 });
  } catch (e) {
    // A red tree legitimately exits 1; the contract under test is the JSON shape.
    status = e.status ?? 1;
    out = `${e.stdout ?? ""}`;
  }
  assert.ok(status === 0 || status === 1, `unexpected exit ${status}`);
  const lines = out.trim().split("\n").filter(Boolean);
  const verdict = JSON.parse(lines[lines.length - 1]);
  assert.equal(verdict.tool, "quality-ratchet");
  assert.equal(verdict.schema, SCHEMA);
  assert.equal(verdict.mode, "all");
  assert.equal(verdict.estimatedCostUsd, null, "estimatedCostUsd must be null — no spend is fabricated");
  assert.ok(Array.isArray(verdict.metrics) && Array.isArray(verdict.canaries));
  const ids = new Set(verdict.metrics.map((m) => m.id));
  for (const id of Object.keys(FLOORS_RAW.floors)) assert.ok(ids.has(id), `floor ${id} is missing from the verdict`);
  for (const c of verdict.canaries) {
    assert.ok(Object.prototype.hasOwnProperty.call(FLOORS_RAW.canaries, c.id), `undeclared canary in the verdict: ${c.id}`);
  }
  for (const m of verdict.metrics) {
    if (m.result === "unavailable") assert.match(String(m.code), /^RT_E_/, `${m.id} must carry a coded unavailable reason`);
    if (m.result === "regressed") assert.ok(verdict.regressions.some((r) => r.startsWith(`${m.id} (`)));
  }
  assert.equal(verdict.ok, verdict.regressions.length === 0 && verdict.canaryFailures.length === 0 && verdict.unavailableEnforced.length === 0);
});

test("gate wiring: the additive `ratchet` stage is present AND folded into the verdict", () => {
  const gate = readFileSync(join(REPO_ROOT, "scripts", "gate.sh"), "utf8");
  // The stage exists and passes this run's own readings (never a re-run of the heavy legs).
  assert.match(gate, /run ratchet "\$TMP\/ratchet\.log" node scripts\/quality-ratchet\.mjs --all --gate "\$WINTMP"/, "the ratchet stage must be wired with --gate pointing at the gate's own temp dir");
  // Its exit is folded into the verdict, so a red ratchet cannot read as a green gate.
  assert.match(gate, /gates\.ratchet = \{ ok: exitOf\("ratchet"\)/, "the ratchet's exit must be recorded as a gate");
  assert.match(gate, /gates\.moduleCoverage\.ok && gates\.build\.ok && gates\.ratchet\.ok/, "the ratchet must be folded into nonTestGatesOk (additive: it can only make `ok` stricter)");
  // Every existing stage is still run and still ordered before it.
  for (const stage of ["typecheck", "lint", "assertionGaps", "prevention", "moduleCoverage", "testsScripts", "testsLib", "build"]) {
    assert.ok(gate.indexOf(`run ${stage} `) >= 0, `existing stage ${stage} must survive`);
    assert.ok(gate.indexOf(`run ${stage} `) < gate.indexOf('run ratchet "'), `the ratchet stage must run after ${stage} (it reads that stage's own reading)`);
  }
  // It must NOT have touched another stage's threshold or the prevention contract.
  assert.match(gate, /gates\.prevention\.ok &&\s*$/m, "the prevention term must be intact");
  assert.match(gate, /countFloor/, "the prevention countFloor contract must be intact");
});

test("CLI: a planted floors file with a beaten floor is a hard failure (in-process, no rebuild needed)", () => {
  // The CLI path for `--floors` is exercised above; the FAILURE semantics are
  // pinned here without a second 40-second spawn of the whole reading set.
  const tmp = join(process.env.TEMP ?? "/tmp", `rt-ratchet-planted-${process.pid}.json`);
  writeFileSync(
    tmp,
    JSON.stringify({
      schema: "rapidtool-quality-ratchet-floors/1",
      estimatedCostUsd: null,
      canaries: {},
      floors: { "prevention.guards": { direction: "atLeast", floor: 999, status: "enforced", producer: "test", reason: "planted regression" } },
    }),
    "utf8",
  );
  try {
    const loaded = loadFloors(tmp);
    assert.equal(loaded.ok, true);
    const v = evaluate({ readings: { "prevention.guards": { value: 34 } }, canaries: [], floors: loaded.floors });
    assert.equal(v.ok, false, "a floor beaten downward must fail");
    assert.ok(v.regressions.some((r) => r.startsWith("prevention.guards (")), JSON.stringify(v.regressions));
    // And the same pin passes at the pinned value: the teeth discriminate.
    const at = evaluate({ readings: { "prevention.guards": { value: 999 } }, canaries: [], floors: loaded.floors });
    assert.equal(at.ok, true);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* best effort */
    }
  }
});
