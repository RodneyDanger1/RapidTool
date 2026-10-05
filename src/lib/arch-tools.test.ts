// ---------------------------------------------------------------------------
// arch-tools.test.ts — architecture surface (register G-30-narrow / G-32 /
// G-33-narrow, wave 3). Pure, keyless, deterministic — no LLM anywhere.
// Run: node --experimental-strip-types --test src/lib/arch-tools.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  adrRecord,
  canonicalModuleId,
  codebaseMap,
  dependencyGraph,
  resolveRelativeImport,
  scanLocalImports,
} from "./arch-tools.ts";

// ---------------------------------------------------------------------------
// dependencyGraph — regex/lexer import scan over {path, body} scaffold files
// ---------------------------------------------------------------------------

describe("dependencyGraph", () => {
  it("maps relative imports to canonical extensionless module ids", () => {
    const files = [
      {
        path: "src/main.ts",
        body: 'import { engine } from "./engine.ts";\nimport { ui } from "./ui";\nconsole.log(engine, ui);\n',
      },
      { path: "src/engine.ts", body: "export const engine = 1;\n" },
      { path: "src/ui.tsx", body: "export const ui = 1;\n" },
    ];
    const g = dependencyGraph(files);
    assert.deepEqual(
      g.nodes.map((n) => n.id),
      ["src/engine", "src/main", "src/ui"],
      "every provided file is a node, sorted",
    );
    assert.deepEqual(g.edges, [
      { from: "src/main", to: "src/engine" },
      { from: "src/main", to: "src/ui" },
    ]);
  });

  it("ignores bare/external specifiers, resolves ../, and dedupes repeated imports", () => {
    const files = [
      {
        path: "src/lib/a.ts",
        body: [
          'import React from "react";',
          'import { b } from "./b";',
          'import { b2 } from "./b";',
          'import { c } from "../util/c";',
          'import fs from "node:fs";',
          'const alias = await import("@/lib/x.ts");',
        ].join("\n"),
      },
      { path: "src/lib/b.ts", body: "export const b = 1;\n" },
      { path: "src/util/c.ts", body: "export const c = 2;\n" },
    ];
    const g = dependencyGraph(files);
    assert.deepEqual(g.edges, [
      { from: "src/lib/a", to: "src/lib/b" },
      { from: "src/lib/a", to: "src/util/c" },
    ], "react / node:fs / @/alias produce no edges; duplicate ./b collapses to one");
  });

  it("never reads imports out of comments or string literals", () => {
    const files = [
      {
        path: "src/a.ts",
        body: [
          '// import { x } from "./fake1.ts";',
          "/* import { y } from \"./fake2.ts\"; */",
          'const s = "import { z } from \'./fake3.ts\';";',
          'import { real } from "./real.ts";',
        ].join("\n"),
      },
      { path: "src/real.ts", body: "export const real = 1;\n" },
    ];
    const g = dependencyGraph(files);
    assert.deepEqual(g.edges, [{ from: "src/a", to: "src/real" }]);
  });

  it("drops self-imports, dedupes canonical ids, and keeps dangling relative targets honest", () => {
    const files = [
      { path: "src/a.ts", body: 'import "./a";\nimport { b } from "./b";\nexport const a = 1;\n' },
      { path: "src/a.js", body: "export const other = 3;\n" }, // same canonical id as a.ts
      { path: "src/b.ts", body: "export const b = 2;\n" },
      { path: "src/c.ts", body: 'import { thing } from "./missing/x.ts";\nexport const c = 1;\n' },
    ];
    const g = dependencyGraph(files);
    assert.deepEqual(
      g.nodes.map((n) => n.id),
      ["src/a", "src/b", "src/c"],
      "a.js folds into the a.ts node (first path wins)",
    );
    assert.deepEqual(g.edges, [
      { from: "src/a", to: "src/b" },
      { from: "src/c", to: "src/missing/x" },
    ], "self-edge dropped; unresolvable relative target still reported as an edge");
    assert.equal(g.nodes.find((n) => n.id === "src/a")?.path, "src/a.ts");
  });

  it("is deterministic and canonically sorted (byte-stable serialization)", () => {
    const files = [
      { path: "src/z.ts", body: 'import { a } from "./a";\n' },
      { path: "src/a.ts", body: 'import { z } from "./z";\nimport { m } from "./m";\n' },
      { path: "src/m.ts", body: "export const m = 1;\n" },
    ];
    const g1 = dependencyGraph(files);
    const g2 = dependencyGraph(files);
    assert.deepEqual(g1, g2);
    assert.equal(
      JSON.stringify(g1.edges),
      '[{"from":"src/a","to":"src/m"},{"from":"src/a","to":"src/z"},{"from":"src/z","to":"src/a"}]',
    );
  });
});

describe("scanLocalImports / id helpers", () => {
  it("scanLocalImports reports specs with 1-based lines and only relative specs", () => {
    const body = [
      "import { a } from './x.ts';",
      "const b = require('./y');",
      "const c = await import('../z.ts');",
      "import React from 'react';",
      "const d = 1;",
    ].join("\n");
    assert.deepEqual(scanLocalImports(body), [
      { spec: "./x.ts", line: 1 },
      { spec: "./y", line: 2 },
      { spec: "../z.ts", line: 3 },
    ]);
  });

  it("canonicalModuleId and resolveRelativeImport normalize deterministically", () => {
    assert.equal(canonicalModuleId("./src/lib/engine.ts"), "src/lib/engine");
    assert.equal(canonicalModuleId("src\\lib\\ui.tsx"), "src/lib/ui");
    assert.equal(canonicalModuleId("data.json"), "data.json");
    assert.equal(resolveRelativeImport("src/lib/a.ts", "../util/c.ts"), "src/util/c");
    assert.equal(resolveRelativeImport("src/a.ts", "./b"), "src/b");
    assert.equal(resolveRelativeImport("a.ts", "./b.ts"), "b");
  });
});

// ---------------------------------------------------------------------------
// adrRecord — machine-minted decision-record body (G-32)
// ---------------------------------------------------------------------------

describe("adrRecord", () => {
  it("builds the Context/Decision/Consequences body, multi-line consequences as bullets", () => {
    const adr = adrRecord(
      "Use Vault for agent notes",
      "The product keeps notes as memory rows only.",
      "Every agent note is a vault markdown note.",
      "Notes export with the project\nMemory rows stay authoritative",
    );
    assert.equal(
      adr,
      [
        "# Use Vault for agent notes",
        "",
        "## Context",
        "",
        "The product keeps notes as memory rows only.",
        "",
        "## Decision",
        "",
        "Every agent note is a vault markdown note.",
        "",
        "## Consequences",
        "",
        "- Notes export with the project",
        "- Memory rows stay authoritative",
        "",
      ].join("\n"),
    );
  });

  it("is deterministic, single-line consequences make one bullet, empty consequences are honest", () => {
    const a = adrRecord("T", "C", "D", "one line");
    const b = adrRecord("T", "C", "D", "one line");
    assert.equal(a, b);
    assert.ok(a.includes("- one line"));
    const none = adrRecord("T", "C", "D", "   ");
    assert.ok(none.includes("- (none recorded)"));
  });

  it("throws TypeError on empty title/context/decision (usage errors)", () => {
    assert.throws(() => adrRecord("", "c", "d", "x"), TypeError);
    assert.throws(() => adrRecord("t", "", "d", "x"), TypeError);
    assert.throws(() => adrRecord("t", "c", "", "x"), TypeError);
  });

  it("codes each usage refusal RT_E_VALIDATION (a machine caller branches on .code, not the prose)", () => {
    for (const bad of [
      () => adrRecord("", "c", "d", "x"),
      () => adrRecord("t", "", "d", "x"),
      () => adrRecord("t", "c", "", "x"),
    ]) {
      assert.throws(bad, (err: unknown) => (err as { code?: string }).code === "RT_E_VALIDATION");
    }
  });
});

// ---------------------------------------------------------------------------
// codebaseMap — deterministic markdown map of artifacts + scaffold files
// ---------------------------------------------------------------------------

describe("codebaseMap", () => {
  it("renders the full map byte-exactly (artifacts sorted, imports resolved)", () => {
    const project = {
      id: "p-1",
      status: "complete",
      name: "Nova",
      kind: "tool",
      domain: "cli",
      brief: "A tiny CLI that sorts.",
      artifacts: [
        { id: "code-1", phase: 6, kind: "code", title: "engine module", body: "line1\nline2\nline3", language: "ts" },
        { id: "doc-1", phase: 8, kind: "docs", title: "README", body: "# readme\n", language: "md" },
      ],
      generatedSource: "export const x = 1;\nexport const y = 2;\n",
      scaffoldFiles: [
        { path: "src/lib/b.ts", body: "export const b = () => 1;\n" },
        { path: "src/lib/a.ts", body: 'import { b } from "./b.ts";\nexport const a = () => b();\n' },
      ],
    };
    const map = codebaseMap(project);
    assert.equal(
      map,
      [
        "# Codebase map — Nova",
        "",
        "_kind: tool · domain: cli · brief: A tiny CLI that sorts._",
        "",
        "## Artifacts (2)",
        "",
        "| id | phase | kind | title | loc | language |",
        "|---|---|---|---|---|---|",
        "| code-1 | 6 | code | engine module | 3 | ts |",
        "| doc-1 | 8 | docs | README | 1 | md |",
        "",
        "## Generated source module",
        "",
        "- `generatedSource` — 2 LOC",
        "",
        "## Scaffold files (2)",
        "",
        "| path | loc | local imports |",
        "|---|---|---|",
        "| src/lib/a.ts | 2 | src/lib/b |",
        "| src/lib/b.ts | 1 |  |",
        "",
      ].join("\n"),
    );
  });

  it("is deterministic and omits empty sections; unnamed projects stay honest", () => {
    const map = codebaseMap({ name: "Nova", artifacts: [], scaffoldFiles: [], generatedSource: "" });
    assert.equal(codebaseMap({ name: "Nova", artifacts: [], scaffoldFiles: [], generatedSource: "" }), map);
    assert.ok(!map.includes("## Artifacts"));
    assert.ok(!map.includes("## Scaffold files"));
    assert.ok(!map.includes("Generated source module"));
    const bare = codebaseMap({});
    assert.equal(bare, "# Codebase map — (unnamed project)\n");
  });

  it("accepts Project-shaped supersets and escapes pipes in cells", () => {
    // Extra keys beyond CodebaseInput are fine (structural typing) — a full
    // types.ts Project is assignable the same way.
    const projectish = {
      id: "p-9",
      name: "PipeCo",
      status: "complete",
      currentPhase: 12,
      brief: "",
      artifacts: [
        { id: "a|1", phase: 0, kind: "gate", title: "verdict | summary", body: "x", language: "" },
      ],
      generatedSource: "",
      extraField: true,
    };
    const map = codebaseMap(projectish);
    assert.match(map, /\| a\\\|1 \| 0 \| gate \| verdict \\\| summary \| 1 \| {2}\|/);
    assert.ok(!map.includes("| a|1 |"), "raw pipes must never break the table");
    assert.equal(codebaseMap(projectish), codebaseMap(projectish));
  });
});
