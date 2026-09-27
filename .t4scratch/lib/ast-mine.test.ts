// ---------------------------------------------------------------------------
// ast-mine.test.ts — structural codebase map suite (Pillar 5).
// Run: node --experimental-strip-types --test src/lib/ast-mine.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  conventionsMap,
  mineCodebase,
  respectConventions,
  type ConventionPacket,
  type MineSourceFile,
} from "./ast-mine.ts";

/** Source-of-truth line lookup: the scanner's `line` must agree with the real
 *  body position regardless of how the fixture literal is laid out. */
const lineOf = (body: string, needle: string) =>
  body.split("\n").findIndex((l) => l.includes(needle)) + 1;

const SAMPLE = `import { a } from "./a.ts";
import type { B } from "./b";
import "./styles.css";
import { c as d } from "@/lib/x";

export function alpha(x: number): number {
  return x + 1;
}

export const beta = (y: string) => y.length;

class Widget {
  render() {
    return "x";
  }

  async load(): Promise<void> {}
}

export default function main() {
  return 0;
}

export { alpha };
export type ID = string;
`;

describe("mineCodebase — per-file structural extraction", () => {
  it("inventories imports, exports, default export and functions with line numbers", () => {
    const map = mineCodebase([{ path: "src/sample.ts", body: SAMPLE }]);
    assert.equal(map.files.length, 1);
    const f = map.files[0];

    assert.equal(f.path, "src/sample.ts");
    assert.equal(f.lines, SAMPLE.split("\n").length);
    // Import specifiers in order of appearance, deduped (no duplicates here).
    assert.deepEqual(f.imports, ["./a.ts", "./b", "./styles.css", "@/lib/x"]);
    // Named exports: alpha (decl), beta (const), ID (type), re-listed alpha deduped.
    assert.deepEqual(f.exports, ["alpha", "beta", "ID"]);
    assert.equal(f.defaultExport, "main");
    assert.deepEqual(f.reExports, []);

    assert.equal(f.functions.length, 5);
    const byName = new Map(f.functions.map((fn) => [fn.name, fn]));
    assert.equal(byName.get("alpha")?.kind, "function");
    assert.equal(byName.get("alpha")?.exported, true);
    assert.equal(byName.get("alpha")?.line, lineOf(SAMPLE, "export function alpha"));
    assert.equal(byName.get("beta")?.kind, "arrow");
    assert.equal(byName.get("beta")?.exported, true);
    // Default-exported function is exported, class methods are not.
    assert.equal(byName.get("main")?.kind, "function");
    assert.equal(byName.get("main")?.exported, true);
    assert.equal(byName.get("render")?.kind, "method");
    assert.equal(byName.get("render")?.exported, false);
    assert.equal(byName.get("render")?.line, lineOf(SAMPLE, "render()"));
    assert.equal(byName.get("load")?.kind, "method");
    assert.equal(byName.get("load")?.line, lineOf(SAMPLE, "async load"));
  });

  it("does not count interface signatures or keyword calls as methods", () => {
    const body = `export interface Props {
  a: string;
  get(): string;
}

export class Store {
  if() {}

  get(): string {
    return "x";
  }
}
`;
    const map = mineCodebase([{ path: "src/shape.ts", body }]);
    const f = map.files[0];
    const names = f.functions.map((fn) => fn.name);
    assert.deepEqual(names, ["get"]);
    assert.equal(f.functions[0].kind, "method");
  });
});

describe("mineCodebase — dependency graph", () => {
  const files: MineSourceFile[] = [
    { path: "src/lib/a.ts", body: 'import { x } from "./b";\nimport { z } from "../util/helper.ts";\nexport function a1() {}\n' },
    { path: "src/lib/b.ts", body: 'import { h } from "@/util/helper";\nexport const b1 = () => 1;\n' },
    { path: "src/lib/c.ts", body: 'import "react";\nexport const c1 = 1;\n' },
    { path: "src/util/helper.ts", body: "export function h() {}\n" },
  ];

  it("resolves relative + @/ specifiers (with and without extensions) into internal edges", () => {
    const map = mineCodebase(files);
    assert.deepEqual(map.dependencyGraph.nodes, [
      "src/lib/a.ts",
      "src/lib/b.ts",
      "src/lib/c.ts",
      "src/util/helper.ts",
    ]);
    // ./b resolves to b.ts; ../util/helper.ts direct; @/util/helper adds ext.
    assert.deepEqual(map.dependencyGraph.edges, [
      { from: "src/lib/a.ts", to: "src/lib/b.ts", specifier: "./b" },
      { from: "src/lib/a.ts", to: "src/util/helper.ts", specifier: "../util/helper.ts" },
      { from: "src/lib/b.ts", to: "src/util/helper.ts", specifier: "@/util/helper" },
    ]);
    assert.deepEqual(map.dependencyGraph.externals, ["react"]);
    assert.deepEqual(map.dependencyGraph.unresolved, []);
    assert.deepEqual(map.stats, { files: 4, imports: 4, internalEdges: 3, externals: 1, unresolved: 0 });
  });

  it("is deterministic: identical and reordered inputs produce deep-equal maps", () => {
    const a = mineCodebase(files);
    const b = mineCodebase(files);
    assert.deepEqual(a, b);

    const shuffled = mineCodebase([...files].reverse());
    assert.deepEqual(shuffled, a); // sorted output -> input order cannot leak
  });

  it("normalizes backslash paths and lists unresolved local specifiers honestly", () => {
    const map = mineCodebase([
      { path: "src\\lib\\win.ts", body: 'import { q } from "./missing";\nexport const q = 1;\n' },
    ]);
    assert.equal(map.files[0].path, "src/lib/win.ts");
    assert.deepEqual(map.dependencyGraph.unresolved, ["./missing"]);
    assert.equal(map.stats.unresolved, 1);
    assert.equal(map.stats.internalEdges, 0);
  });
});

describe("conventionsMap + respectConventions", () => {
  const convFiles: MineSourceFile[] = [
    { path: "src/lib/foo-bar.ts", body: 'import { z } from "zod";\nexport function doStuff() {}\nexport function handleClick() {}\n' },
    { path: "src/lib/baz-qux.ts", body: 'import { z } from "zod";\nexport function formatData() {}\n' },
    { path: "src/lib/qux-extra.ts", body: "export const q = 1;\n" },
    { path: "src/lib/camelCase.ts", body: "export const do_stuff = () => 1;\n" },
    { path: "src/lib/PascalCase.tsx", body: 'import { clsx } from "clsx";\nexport function ComponentButton() { return null; }\n' },
  ];

  it("tallies naming styles and top imports deterministically", () => {
    const conv = conventionsMap("rapidtool", convFiles);
    assert.equal(conv.project, "rapidtool");
    // 3 kebab-case files, 1 camelCase file, 1 PascalCase file.
    assert.deepEqual(conv.fileStyles, { "kebab-case": 3, camelCase: 1, PascalCase: 1 });
    // doStuff/handleClick/formatData camelCase, do_stuff snake_case, ComponentButton PascalCase.
    assert.deepEqual(conv.functionStyles, { camelCase: 3, snake_case: 1, PascalCase: 1 });
    assert.deepEqual(conv.namedVsDefault, { named: 6, defaultFiles: 0 });
    assert.deepEqual(conv.topImports[0], { specifier: "zod", count: 2 });
    assert.ok(conv.notes.some((n) => n.includes("kebab-case dominant (3/5")));
    assert.ok(conv.notes.some((n) => n.includes("Named exports everywhere (6 named")));

    const again = conventionsMap("rapidtool", convFiles);
    assert.deepEqual(conv, again);
  });

  it("returns zero advisories for conforming packets and empty injection", () => {
    const conv = conventionsMap("rapidtool", convFiles);
    const ok: ConventionPacket = { name: "doThing", kind: "function" };
    const verdict = respectConventions(ok, conv);
    assert.deepEqual(verdict.advisories, []);
    assert.equal(verdict.injected, "");
  });

  it("advises (never enforces) on style mismatch for functions and files", () => {
    const conv = conventionsMap("rapidtool", convFiles);
    const fnVerdict = respectConventions({ name: "do_thing", kind: "function" }, conv);
    assert.equal(fnVerdict.advisories.length, 1);
    assert.match(fnVerdict.advisories[0], /function "do_thing" uses snake_case/);
    assert.match(fnVerdict.advisories[0], /mined convention for rapidtool is camelCase \(3\/5/);
    assert.match(fnVerdict.injected, /^\n<!-- conventions advisory \(ast-mine, advisory only\) -->/);

    const fileVerdict = respectConventions(
      { name: "bad_name.ts", kind: "file", path: "src/lib/bad_name.ts" },
      conv,
    );
    assert.equal(fileVerdict.advisories.length, 1);
    assert.match(fileVerdict.advisories[0], /file "src\/lib\/bad_name.ts" uses snake_case stem/);
    assert.match(fileVerdict.advisories[0], /is kebab-case paths \(3\/5\)/);
  });
});
