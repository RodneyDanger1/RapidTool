import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRepoMap,
  repoMapElisionMarker,
  repoMapForProject,
  runtimeExportNamesOf,
  REPO_MAP_ELISION_PREFIX,
  REPO_MAP_ENTRY_PATH,
} from "./repo-map.ts";

// ---------------------------------------------------------------------------
// 343-2 — the deterministic repo map. These pin the four properties the brief
// demands: determinism (same input ⇒ same output), a hard char budget with an
// explicit elision marker, no invented symbols (only names actually exported in
// the bytes), and an honest empty state for an empty/absent tree.
// ---------------------------------------------------------------------------

test("runtimeExportNamesOf: ESM runtime names, sorted, deduped; types excluded", () => {
  const src = [
    "export function beta() {}",
    "export const gamma = 1, delta = 2;",
    "export class Epsilon {}",
    "export { alpha, zeta as omega };",
    'export * as ns from "./x.ts";',
    "export type Shape = { a: number };",
    "export interface Iface { x: number }",
    "export default function named() {}",
  ].join("\n");
  assert.deepEqual(runtimeExportNamesOf(src), [
    "Epsilon",
    "alpha",
    "beta",
    "delta",
    "gamma",
    "named",
    "ns",
    "omega",
  ]);
});

test("runtimeExportNamesOf: destructuring binds the real exported names", () => {
  assert.deepEqual(runtimeExportNamesOf("export const { a: b, c } = o;"), ["b", "c"]);
  assert.deepEqual(runtimeExportNamesOf("export let [p, , q] = arr;"), ["p", "q"]);
  assert.deepEqual(runtimeExportNamesOf("export const { ...rest } = o;"), ["rest"]);
});

test("runtimeExportNamesOf: CommonJS assigns are real exports", () => {
  assert.deepEqual(runtimeExportNamesOf("exports.x = 1;\nmodule.exports.y = 2;\n"), ["x", "y"]);
});

test("runtimeExportNamesOf: never invents a name from prose, strings or regex literals", () => {
  const src = [
    "// export function ghost() {}",
    "/* export const phantom = 1; */",
    'const s = "export function stringy() {}";',
    "const re = /export const regexed = 1/;",
    "export function real() {}",
  ].join("\n");
  assert.deepEqual(runtimeExportNamesOf(src), ["real"]);
  assert.deepEqual(runtimeExportNamesOf(undefined as unknown as string), []);
  assert.deepEqual(runtimeExportNamesOf(""), []);
});

test("buildRepoMap: deterministic and independent of input order", () => {
  const a = { path: "src/a.ts", source: "export function a() {}\n" };
  const b = {
    path: "src/b.ts",
    source: 'import { a } from "./a.ts";\nexport function b() { return a(); }\n',
  };
  const m1 = buildRepoMap([a, b]);
  const m2 = buildRepoMap([a, b]);
  const m3 = buildRepoMap([b, a]);
  const m4 = buildRepoMap([{ ...b }, { ...a }]);
  assert.deepEqual(m1, m2);
  assert.deepEqual(m1, m3, "reordered input yields the same map");
  assert.equal(m1.rendered, m3.rendered);
  assert.deepEqual(m1, m4);
  assert.equal(m1.rendered.length, m1.chars);
});

test("buildRepoMap: a file imported by others outranks a leaf", () => {
  const core = { path: "src/core.ts", source: "export function core() {}\n" };
  const leaf = { path: "src/leaf.ts", source: "export function leaf() {}\n" };
  const u1 = {
    path: "src/u1.ts",
    source: 'import { core } from "./core.ts";\nexport function u1() {}\n',
  };
  const u2 = {
    path: "src/u2.ts",
    source: 'import { core } from "./core.ts";\nexport function u2() {}\n',
  };
  const map = buildRepoMap([leaf, u2, core, u1]);
  const coreEntry = map.entries.find((e) => e.path === "src/core.ts")!;
  const leafEntry = map.entries.find((e) => e.path === "src/leaf.ts")!;
  assert.equal(coreEntry.inbound, 2);
  assert.equal(leafEntry.inbound, 0);
  assert.ok(coreEntry.score > leafEntry.score);
  assert.equal(map.entries[0]!.path, "src/core.ts");
});

test("buildRepoMap: the configured entry (artifact role) ranks ahead of a same-shape module", () => {
  const entry = { path: REPO_MAP_ENTRY_PATH, source: 'export * from "./job.ts";\n' };
  const job = { path: "src/job.ts", source: "export function job() {}\n" };
  const map = buildRepoMap([job, entry]);
  assert.equal(map.entries[0]!.path, REPO_MAP_ENTRY_PATH);
  assert.equal(map.entries[0]!.role, "entry");
  // `export * from` re-exports an unknowable set — never guessed at.
  assert.equal(map.entries[0]!.symbols.length, 0);
  assert.ok(map.rendered.includes(`${REPO_MAP_ENTRY_PATH}: (no named exports)`));
});

test("buildRepoMap: a re-export-only non-entry file is a barrel", () => {
  const barrel = { path: "src/barrel.ts", source: 'export * from "./job.ts";\n' };
  const job = { path: "src/job.ts", source: "export function job() {}\n" };
  const map = buildRepoMap([barrel, job]);
  assert.equal(map.entries.find((e) => e.path === "src/barrel.ts")!.role, "barrel");
});

test("buildRepoMap: the char budget is a hard cap with a visible elision marker", () => {
  const files = Array.from({ length: 40 }, (_, i) => ({
    path: `src/generated/collect-rent-${String(i).padStart(2, "0")}.ts`,
    source: `export function collectRent${i}(): number { return ${i}; }\n`,
  }));
  const budget = 400;
  const map = buildRepoMap(files, { budget });
  assert.equal(map.budget, budget);
  assert.equal(map.totalFiles, 40);
  assert.ok(map.truncated);
  assert.ok(map.rendered.includes(REPO_MAP_ELISION_PREFIX));
  assert.equal(map.shownFiles + map.omitted, 40);
  assert.ok(map.omitted > 0);
  assert.ok(map.chars <= budget, `chars ${map.chars} must not exceed the ${budget} budget`);
  assert.ok(map.rendered.length <= budget);
});

test("buildRepoMap: no marker when everything fits", () => {
  const map = buildRepoMap([{ path: "src/a.ts", source: "export function a() {}\n" }]);
  assert.equal(map.truncated, false);
  assert.equal(map.omitted, 0);
  assert.equal(map.rendered.includes(REPO_MAP_ELISION_PREFIX), false);
});

test("buildRepoMap: the per-file symbol cap reports the hidden remainder", () => {
  const src = Array.from({ length: 10 }, (_, i) => `export const s${i} = ${i};`).join("\n");
  const map = buildRepoMap([{ path: "src/many.ts", source: src }], { symbolsPerFile: 3 });
  const e = map.entries[0]!;
  assert.equal(e.symbolCount, 10);
  assert.equal(e.symbols.length, 3);
  assert.equal(e.hidden, 7);
  assert.ok(map.rendered.includes("(+7)"));
});

test("buildRepoMap: empty input is an honest empty state", () => {
  const map = buildRepoMap([]);
  assert.equal(map.empty, true);
  assert.equal(map.rendered, "");
  assert.equal(map.totalFiles, 0);
  assert.equal(map.truncated, false);
  assert.deepEqual(map.entries, []);
});

test("buildRepoMap: junk rows are ignored, never guessed at", () => {
  const junk = [null, { path: 1 }, { path: "src/a.ts", source: 2 }, "x", 5];
  const map = buildRepoMap(junk as unknown as Parameters<typeof buildRepoMap>[0]);
  assert.equal(map.empty, true);
  assert.equal(map.totalFiles, 0);
  assert.equal(map.rendered, "");
});

test("repoMapForProject: reads the tree, falls back to generatedSource, else honest empty", () => {
  const tree = [
    { path: "src/a.ts", source: "export function a() {}\n" },
    {
      path: "src/b.ts",
      source: 'import { a } from "./a.ts";\nexport function b() { return a(); }\n',
    },
  ];
  const fromTree = repoMapForProject({ generatedTree: tree, generatedSource: "" });
  assert.equal(fromTree.totalFiles, 2);
  assert.ok(fromTree.entries.some((e) => e.path === "src/a.ts" && e.symbols.includes("a")));

  const fromSingle = repoMapForProject({
    generatedTree: [],
    generatedSource: "export function boot() {}\n",
  });
  assert.equal(fromSingle.totalFiles, 1);
  assert.equal(fromSingle.entries[0]!.path, REPO_MAP_ENTRY_PATH);
  assert.deepEqual(fromSingle.entries[0]!.symbols, ["boot"]);

  assert.equal(repoMapForProject({ generatedTree: undefined, generatedSource: "" }).empty, true);
  assert.equal(repoMapForProject({}).empty, true);
  assert.equal(repoMapForProject(null).empty, true);
  assert.equal(repoMapForProject(undefined).empty, true);
});

test("repoMapElisionMarker: names the omitted count and the budget", () => {
  const m = repoMapElisionMarker(7, 1600);
  assert.ok(m.startsWith(REPO_MAP_ELISION_PREFIX));
  assert.ok(m.includes("7"));
  assert.ok(m.includes("1600"));
});
