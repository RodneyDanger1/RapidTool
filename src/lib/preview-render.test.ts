// ---------------------------------------------------------------------------
// preview-render.test.ts — transpile + render the emitted UI (server compile).
// Run: node --experimental-strip-types --test src/lib/preview-render.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALL_PHASES, runHeadless, seedProject } from "./testing/fixtures.ts";
import type { Project } from "./types.ts";
import { codeFilesOf, emitSoftware } from "./software-export.ts";
import { compileEmittedModules } from "./preview-compile.server.ts";
import { renderEmittedComponent } from "./preview-render.ts";

const project = runHeadless(seedProject({ kind: "app" }), ALL_PHASES);
const emitted = emitSoftware(project);
assert.ok(emitted.ok, `fixture must emit: ${!emitted.ok ? emitted.error : ""}`);

describe("compileEmittedModules", () => {
  it("transpiles the emitted code files to CommonJS", () => {
    const compiled = compileEmittedModules(codeFilesOf(emitted.files));
    assert.ok(compiled.ok, `compile must succeed: ${!compiled.ok ? compiled.error : ""}`);
    assert.ok(compiled.modules.length > 0);
    assert.ok(compiled.modules.every((m) => m.code.length > 0));
    const ui = compiled.modules.find((m) => m.path === emitted.uiPath);
    assert.ok(ui, "the ui module is among the compiled modules");
    assert.match(ui.code, /require\("react/, "JSX becomes the React runtime require");
  });
});

describe("renderEmittedComponent", () => {
  it("renders the emitted webapp UI to real markup", () => {
    assert.ok(emitted.uiPath !== null);
    const compiled = compileEmittedModules(codeFilesOf(emitted.files));
    assert.ok(compiled.ok);
    const rendered = renderEmittedComponent(compiled.modules, emitted.uiPath);
    assert.ok(rendered.ok, `render must succeed: ${!rendered.ok ? rendered.error : ""}`);
    assert.match(rendered.html, /<h1>Fixture<\/h1>/);
    assert.match(rendered.html, /<main>/);
  });

  it("fails honestly when the entry export is missing", () => {
    const compiled = compileEmittedModules(codeFilesOf(emitted.files));
    assert.ok(compiled.ok);
    const rendered = renderEmittedComponent(compiled.modules, "src/ui/does-not-exist.tsx");
    assert.equal(rendered.ok, false);
    if (!rendered.ok) assert.match(rendered.error, /not found/);
  });

  it("fixes/352: renders the emitted renderer-shape marketing site (router + pages, not a form)", () => {
    const project: Project = {
      ...seedProject({
        name: "Golden Crust Bakery",
        kind: "app",
        brief: "Bakery marketing site with a menu, hours and an online order form.",
      }),
      domain: "web-marketing",
      lattice: { domain: "web-marketing", jobs: [], entities: ["Home"], constraints: [], nodes: [], complexity: 1 },
      contracts: { entities: [], endpoints: [] } as NonNullable<Project["contracts"]>,
      implementationSpec: null,
      generatedSource: "",
      generatedTree: [
        { path: "src/generated.ts", source: 'export * from "./generated/render-home.ts";\n', hash: "h0", attempt: 0 },
        {
          path: "src/generated/render-home.ts",
          source: [
            "type Item = { id: string; name: string };",
            "function renderHome(): { tagName: string; children: unknown[] } { return { tagName: 'div', children: [] }; }",
            "function renderMenu(items: Item[]): { tagName: string; children: unknown[] } { void items; return { tagName: 'div', children: [] }; }",
            "export { renderHome, renderMenu };",
            "",
          ].join("\n"),
          hash: "h1",
          attempt: 0,
        },
      ],
      specGraph: {
        nodes: [
          { id: "schema", file: "src/domain/site.ts", purpose: "Typed entities", dependsOn: [], owner: "architect" },
          { id: "ui", file: "src/ui/console.tsx", purpose: "Operator surfaces", dependsOn: [], owner: "implementer" },
        ],
        order: ["schema", "ui"],
      },
    };
    const siteEmitted = emitSoftware(project);
    assert.ok(siteEmitted.ok, `site emit: ${!siteEmitted.ok ? siteEmitted.error : ""}`);
    assert.ok(
      siteEmitted.files.some((f) => f.path === "src/ui/router.tsx"),
      "the renderer shape emits the multi-page site",
    );
    const compiled = compileEmittedModules(codeFilesOf(siteEmitted.files));
    assert.ok(compiled.ok, `compile: ${!compiled.ok ? compiled.error : ""}`);
    const rendered = renderEmittedComponent(compiled.modules, siteEmitted.uiPath!);
    assert.ok(rendered.ok, `render: ${!rendered.ok ? rendered.error : ""}`);
    assert.match(rendered.html, /class="site"/, "the site chrome renders");
    assert.match(rendered.html, /site-nav/, "the real router navigation renders");
  });
});
