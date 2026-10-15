/**
 * Product-quality reading — additive, byte-derived.
 * Run: node --experimental-strip-types --test --test-reporter=tap src/lib/product-quality.test.ts
 *
 * These tests pin the honest contract: every value is derived from the bytes
 * handed in, absent evidence is reported absent, and nothing is fabricated.
 * They are not mocks — the fixtures are real source strings.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  QUALITY_CLI_FLAGS,
  WEB_SRC_ENTRIES,
  determinismReading,
  fleetProductQualityFromProjects,
  jobModuleCensus,
  moduleCensus,
  qualityFlagViolations,
  readProductQuality,
} from "./product-quality.ts";
import { inventoryFromJobSources } from "./doctor.ts";
import { classifyModuleSource } from "./dod.ts";

const file = (path: string, source: string) => ({ path, source, hash: "h", attempt: 0 });

/** A plausible small webapp tree: html entry, src entry, router, two pages, css. */
const webappTree = [
  file("index.html", `<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`),
  file(
    "src/main.tsx",
    `import { RouterProvider } from "@tanstack/react-router";\n` +
      `import { MenuPage } from "./pages/menu.tsx";\n` +
      `import { OrdersPage } from "./pages/orders.tsx";\n` +
      `import { place } from "./lib/menu-caller.ts";\n` +
      `import "./styles.css";\n` +
      `export function mount() { return <RouterProvider />; }\n` +
      `export const wire = place;`,
  ),
  file("src/styles.css", `.card { color: red; }`),
  file("src/pages/menu.tsx", `export function MenuPage() { return <div className="card"><form onSubmit={submit}><input name="q" /></form></div>; }\nfunction submit(e) {}`),
  file("src/pages/orders.tsx", `export function OrdersPage() { return <div>orders</div>; }`),
  file("src/lib/create-order.ts", `export function createOrder(items) { return { total: items.length }; }`),
  file("src/lib/menu-caller.ts", `import { createOrder } from "./create-order.ts";\nexport function place(items) { return createOrder(items); }`),
];

describe("product-quality — byte-derived readings", () => {
  it("a webapp-shaped tree reads every signal present", () => {
    const q = readProductQuality({ brief: "Build an ordering website.", generatedTree: webappTree });
    assert.equal(q.tree.fileCount, webappTree.length);
    assert.equal(q.webEntry.present, true);
    assert.equal(q.webEntry.html, "index.html");
    assert.equal(q.webEntry.entry, "src/main.tsx");
    assert.equal(q.pages.routerPresent, true);
    assert.ok(q.pages.routerEvidence.some((e) => e.includes("@tanstack/react-router")));
    assert.equal(q.pages.distinctPages, 2, "menu.tsx + orders.tsx are the two page files");
    assert.equal(q.layout.styled, true);
    assert.ok(q.layout.evidence.some((e) => e.includes("styles.css")));
    assert.equal(q.orderingFlow.applicable, true);
    assert.equal(q.orderingFlow.flowCallable, true);
    assert.equal(q.orderingFlow.formWired, true);
    assert.equal(q.orderingFlow.present, true);
    assert.equal(q.quality, true, "every measurable signal holds");
    assert.deepEqual(q.reasons, []);
  });

  it("the bakery-shaped record (barrel + domain modules, no web entry) reads NOT product-quality", () => {
    // The real bakery project record's shape: an ESM barrel plus real domain
    // modules, and NO index.html / router / pages / css / form.
    const bakery = {
      id: "bakery",
      brief: "Redesign the Bloedow Bakery website and build ordering pages.",
      generatedTree: [
        file(
          "src/generated.ts",
          `export * from "./generated/create-order.ts";\nexport * from "./jobs/show.ts";`,
        ),
        file(
          "src/generated/create-order.ts",
          `export function createOrder(items) { return { total: items.length }; }`,
        ),
        file("src/jobs/show.ts", `import { createOrder } from "../generated/create-order.ts";\nexport function show() { return createOrder([]); }`),
      ],
      artifacts: [
        { id: "a0", phase: 0, kind: "scorecard", title: "s", body: "" },
        { id: "a1", phase: 6, kind: "code", title: "c", body: "" },
      ],
    };
    const q = readProductQuality(bakery);
    assert.equal(q.webEntry.present, false, "no index.html in the record's tree");
    assert.equal(q.pages.routerPresent, false);
    assert.equal(q.pages.distinctPages, 0);
    assert.equal(q.layout.styled, false);
    // fixes/354 A2-F10: the name-reference must be REACHABLE from the emitted
    // entry. This record has no web entry, so nothing is reachable and the
    // reference is not part of any product — the pre-fix reading called it
    // present on an unreachable file.
    assert.equal(q.orderingFlow.flowCallable, false, "createOrder is referenced only by an unreachable file (no entry)");
    assert.equal(q.orderingFlow.formWired, false, "no form element / submit wiring");
    assert.equal(q.orderingFlow.present, false, "the full flow needs the wired form too");
    assert.equal(q.quality, false);
    assert.ok(q.reasons.some((r) => /no web entry/.test(r)), "the missing web entry is named");
    assert.ok(q.reasons.some((r) => /no router/.test(r)));
    assert.ok(q.reasons.some((r) => /styled layout/.test(r)));
    assert.ok(q.reasons.some((r) => /ordering flow incomplete/.test(r)));
  });

  it("counts real vs stub vs reexport modules from the bytes", () => {
    const files = [
      file("src/generated.ts", `export * from "./a.ts";`),
      file("src/stub.ts", `export function x() { throw new Error("TODO: not implemented"); }`),
      file("src/real.ts", `export function createBoard() { return { id: 1 }; }`),
    ];
    const c = moduleCensus(files);
    assert.deepEqual(c, { total: 3, examined: 3, real: 1, stubs: 1, reexports: 1, unknown: 0 });
  });

  it("reports an unknown source as unknown, never as real", () => {
    const c = moduleCensus([{ path: "src/a.ts" }, { path: "src/b.ts", source: "export const x = 1;" }]);
    assert.equal(c.total, 2);
    assert.equal(c.examined, 1);
    assert.equal(c.unknown, 1);
    assert.equal(c.real, 1);
  });

  it("non-code files (html/json/css) are excluded from the module census", () => {
    const c = moduleCensus([
      file("index.html", "<html></html>"),
      file("package.json", "{}"),
      file("src/main.ts", "export const x = 1;"),
    ]);
    assert.equal(c.total, 1, "only src/main.ts is a code module");
  });

  it("empty / absent tree sets both CLI flags to tripped and fails closed", () => {
    for (const input of [null, 42, "nope", {}, { generatedTree: [] }]) {
      const q = readProductQuality(input);
      assert.equal(q.tree.fileCount, 0);
      assert.equal(q.flags.emptyTree, true, `${JSON.stringify(input)}: empty tree`);
      assert.equal(q.flags.noEmptyTree, false);
      assert.equal(q.quality, false);
      assert.ok(q.reasons.length > 0);
    }
  });

  it("a placeholder-only tree trips --no-placeholder-only-tree, not --no-empty-tree", () => {
    const q = readProductQuality({
      brief: "x",
      generatedTree: [
        file("src/a.ts", `export * from "./b.ts";`),
        file("src/b.ts", `export function x() { throw new Error("TODO: tbd"); }`),
      ],
    });
    assert.equal(q.flags.emptyTree, false);
    assert.equal(q.flags.placeholderOnlyTree, true);
    assert.deepEqual(qualityFlagViolations(q), [QUALITY_CLI_FLAGS.noPlaceholderOnlyTree]);
  });

  it("a tree with an unknown-source file cannot claim placeholder-only (fail-closed)", () => {
    const q = readProductQuality({ brief: "x", generatedTree: [{ path: "src/a.ts" }] });
    assert.equal(q.flags.emptyTree, false);
    assert.equal(q.flags.placeholderOnlyTree, false, "unknown bytes are never guessed as placeholders");
    assert.equal(q.flags.noPlaceholderOnlyTree, true);
  });

  it("unions generatedTree with an emitted file list by path", () => {
    const q = readProductQuality(
      { brief: "Build a website.", generatedTree: [file("src/main.tsx", "export const x = 1;")] },
      {
        emittedFiles: [
          file("index.html", "<html></html>"),
          file("src/main.tsx", "export const x = 1;"),
        ],
      },
    );
    assert.deepEqual(q.tree.files, ["src/main.tsx", "index.html"], "union is by path, no duplicate");
    assert.equal(q.webEntry.present, true);
  });

  it("counts artifacts per phase and names empty phases", () => {
    const q = readProductQuality({
      generatedTree: [],
      // 353: emptiness is STATUS-AWARE — a phase counts as empty only when it
      // COMPLETED with no artifact. Mark the run's phases complete so the
      // fixture exercises the real semantic.
      phases: Array.from({ length: 13 }, (_, id) => ({ id, status: "complete" })) as never,
      artifacts: [
        { phase: 0, kind: "scorecard", title: "", body: "" },
        { phase: 0, kind: "research", title: "", body: "" },
        { phase: 6, kind: "code", title: "", body: "" },
      ],
    });
    assert.equal(q.artifacts.known, true);
    assert.equal(q.artifacts.total, 3);
    assert.equal(q.artifacts.byPhase.find((r) => r.phase === 0)?.count, 2);
    assert.equal(q.artifacts.byPhase.find((r) => r.phase === 6)?.count, 1);
    assert.ok(q.artifacts.emptyPhases.includes(12));
    assert.equal(q.artifacts.emptyPhases.length, 11);

    // A phase that never ran (locked/ready) is NOT "empty" — it produced
    // nothing because it was never entered, a different claim.
    const parked = readProductQuality({
      generatedTree: [],
      phases: Array.from({ length: 13 }, (_, id) => ({
        id,
        status: id <= 6 ? "complete" : "locked",
      })) as never,
      artifacts: [{ phase: 0, kind: "scorecard", title: "", body: "" }],
    });
    assert.deepEqual(parked.artifacts.emptyPhases, [1, 2, 3, 4, 5, 6], "only completed-but-artifactless phases are named");
  });

  it("an emitted file list with no project record reports artifacts as unknown", () => {
    const q = readProductQuality({ generatedTree: [] }, { emittedFiles: [file("src/main.ts", "x")] });
    assert.equal(q.artifacts.known, false);
    assert.equal(q.artifacts.total, 0);
    assert.deepEqual(q.artifacts.emptyPhases, []);
  });
});

describe("product-quality — fleet aggregate", () => {
  it("aggregates rows and zeroes a non-array input", () => {
    const empty = fleetProductQualityFromProjects(undefined as unknown as readonly unknown[]);
    assert.deepEqual([empty.projects, empty.withTree, empty.quality], [0, 0, 0]);
    assert.deepEqual(empty.readings, []);
  });

  it("counts withTree / emptyTree / quality per brief", () => {
    const fleet = fleetProductQualityFromProjects([
      { id: "full", brief: "ordering website", generatedTree: webappTree },
      { id: "empty", brief: "x", generatedTree: [] },
      { id: "no-brief-field" },
    ]);
    assert.equal(fleet.projects, 3);
    assert.equal(fleet.withTree, 1);
    assert.equal(fleet.emptyTree, 2);
    assert.equal(fleet.quality, 1);
    assert.deepEqual(
      fleet.readings.map((r) => r.brief),
      ["full", "empty", "no-brief-field"],
    );
  });
});

describe("product-quality — contract surfaces", () => {
  it("WEB_SRC_ENTRIES matches the acceptance harness's list", () => {
    assert.deepEqual(
      [...WEB_SRC_ENTRIES],
      ["src/main.tsx", "src/main.ts", "src/main.jsx", "src/index.tsx", "src/index.ts", "src/app.tsx", "src/App.tsx"],
    );
  });

  it("exposes the two CLI flag names", () => {
    assert.equal(QUALITY_CLI_FLAGS.noEmptyTree, "--no-empty-tree");
    assert.equal(QUALITY_CLI_FLAGS.noPlaceholderOnlyTree, "--no-placeholder-only-tree");
  });
});

// ---------------------------------------------------------------------------
// 2026-10-05 — the ADDITIVE determinism reading. It records WHICH fields are
// reproducible from the brief alone, which are not, and their sources; it never
// changes emitted bytes or the `quality` verdict.
// ---------------------------------------------------------------------------
describe("product-quality — determinism reading (additive)", () => {
  const uuid = "3aaf978f-8360-4f92-9fef-30697afd77e9";

  it("flags the record itself as non-deterministic, naming each volatile source", () => {
    const rec = {
      id: uuid,
      createdAt: 1791226650807,
      traces: [{ id: "t1", name: "P0", ranAt: 1791226941801, summary: "ok" }],
      logs: [{ ts: 1791226650808, phase: 0, level: "info", event: "x", detail: "" }],
      lastTest: { ok: true, label: "tested", evidenceHash: "1127436456", detail: "tree-run green" },
      generatedTree: [file("src/a.ts", "export const x = 1;")],
    };
    const d = determinismReading(rec);
    assert.equal(d.deterministic, false);
    const fields = new Map(d.volatile.map((v) => [v.field, v]));
    assert.ok(fields.has("id"));
    assert.match(fields.get("id")!.source, /randomUUID/);
    assert.ok(fields.has("createdAt"));
    assert.match(fields.get("createdAt")!.source, /Date\.now/);
    assert.ok(fields.has("traces[].ranAt"));
    assert.ok(fields.has("logs[].ts"));
    assert.equal(fields.get("logs[].ts")!.count, 1);
    assert.ok(fields.has("lastTest.evidenceHash"));
    assert.match(fields.get("lastTest.evidenceHash")!.source, /fnv1a/);
    // The content-addressed tree hash is STABLE (recorded on the stable side).
    assert.ok(d.stable.some((s) => s.field === "generatedTree[].hash"));
    assert.ok(d.reasons.length === d.volatile.length);
  });

  it("reports a record with a non-random id and no timestamps as deterministic", () => {
    const d = determinismReading({ id: "bakery", brief: "x", generatedTree: [] });
    assert.equal(d.deterministic, true);
    assert.deepEqual(d.volatile, []);
  });

  it("reads the emitted package.json / README as volatile carriers (UUID + ISO stamp)", () => {
    const d = determinismReading(
      { id: uuid, createdAt: 1791226650807 },
      {
        emittedFiles: [
          file("package.json", JSON.stringify({ name: "x", rapidtool: { packetId: uuid } })),
          file("README.md", `# Golden\n\n- **Created:** 2026-10-05T18:57:30.807Z\n> packet ${uuid}`),
        ],
      },
    );
    assert.deepEqual(d.filesChecked.sort(), ["README.md", "package.json"]);
    assert.ok(d.volatile.some((v) => v.field === "package.json: rapidtool.packetId/generatedBy"));
    assert.ok(d.volatile.some((v) => v.field === "README.md: header"));
    assert.equal(d.deterministic, false);
  });

  it("does not change the quality verdict and is exposed on the reading", () => {
    const rec = { brief: "ordering website", id: uuid, createdAt: 1, generatedTree: webappTree };
    const q = readProductQuality(rec);
    assert.equal(q.quality, true, "quality is unaffected by the determinism reading");
    assert.equal(q.determinism.deterministic, false);
  });
});

// ---------------------------------------------------------------------------
// 2026-10-06 — item 3: the two quality readers agree by construction. The SAME
// classifier (dod.classifyModuleSource) backs product-quality's whole-tree
// census AND compile-check's job-dir substance reader; the job-scoped census is
// exposed here so the agreement is testable on identical bytes.
// ---------------------------------------------------------------------------
describe("product-quality — one classifier, two readers (agree by construction)", () => {
  it("jobModuleCensus and doctor.inventoryFromJobSources agree row-for-row on job bytes", () => {
    const jobFiles = [
      file("src/jobs/record.ts", "export function record() { return 1; }"),
      file("src/jobs/flip.ts", 'export function flip() { throw new Error("TODO(E-15) stub: flip"); }'),
      file("src/jobs/bridge.ts", 'export * from "./record.ts";'),
      file("jobs/legacy.js", "export const keep = () => 1;"),
    ];
    const c = jobModuleCensus(jobFiles);
    const inv = inventoryFromJobSources(jobFiles, "/tree");
    assert.deepEqual(
      [c.real, c.stubs, c.reexports],
      [inv.real, inv.stubs, inv.reexports],
      "the census and the substance reader must never contradict on the same bytes",
    );
  });

  it("the job census scopes to src/jobs + jobs (the compile-check file set), not the whole tree", () => {
    const mixed = [
      file("src/jobs/a.ts", "export const a = 1;"),
      file("src/domain/b.ts", "export const b = 1;"),
      file("src/generated/c.ts", 'export * from "./d.ts";'),
    ];
    assert.equal(jobModuleCensus(mixed).total, 1, "only src/jobs/a.ts is a job module");
    assert.equal(moduleCensus(mixed).total, 3, "the whole-tree census counts all three");
  });

  it("classifyModuleSource is the ONE classifier (doctor.classifyJobSource delegates to it)", () => {
    assert.equal(classifyModuleSource(""), "stub");
    assert.equal(classifyModuleSource('export function x() { throw new Error("TODO(E-15) t"); }'), "stub");
    assert.equal(classifyModuleSource('export * from "./a.ts";'), "reexport");
    assert.equal(classifyModuleSource("export function createBoard() { return 1; }"), "real");
  });
});

// ---------------------------------------------------------------------------
// 2026-10-06 — item 1: the kind-aware surface reading the gates consume.
// ---------------------------------------------------------------------------
describe("product-quality — kind-aware surface reading (additive)", () => {
  it("names the web contract a page-named app brief demands and reads its surface present", () => {
    const q = readProductQuality({ brief: "Build a bakery website. Pages: Home, Menu.", kind: "app", generatedTree: webappTree });
    assert.equal(q.kindSurface.kind, "web");
    assert.ok(q.kindSurface.pageFiles.length > 0);
    assert.equal(q.kindSurface.navPath, true);
    assert.ok(!q.reasons.some((r) => /surface/.test(r)), "the surface reading never leaks into `quality`");
  });

  it("reads N/A (kind none) for a brief that names no surface contract", () => {
    const q = readProductQuality({
      brief: "A dispatch board for field service.",
      generatedTree: [file("src/generated.ts", "export const x = 1;")],
    });
    assert.equal(q.kindSurface.kind, "none");
    assert.equal(q.kindSurface.applicable, false);
    assert.match(q.kindSurface.note, /N\/A/);
  });

  it("reads the runnable contract for a cli/library/service brief and names a missing declared surface", () => {
    const q = readProductQuality({
      brief: "Build a TypeScript library: `subscribe(url)` and `publish(event)`.",
      kind: "library",
      generatedTree: [file("src/index.ts", "export function subscribe(url) { return url; }")],
    });
    assert.equal(q.kindSurface.kind, "runnable");
    assert.deepEqual(q.kindSurface.entry.missingDeclared, ["publish"]);
  });
});

// ---------------------------------------------------------------------------
// 2026-10-06 — item 1/5: kindSurface unions the caller's emitted files (the
// scaffold's pages/router are emitted, not generatedTree rows) and the reading
// carries the shared gate-evidence qualification.
// ---------------------------------------------------------------------------
describe("product-quality — emitted-surface union + gate evidence (items 1/5)", () => {
  it("kindSurface reads the caller's emitted files, not the record's generatedTree alone", () => {
    // The record carries NO page (the emitter owns the site); the emitted file
    // list does. Before the union the trace reported the surface absent.
    const q = readProductQuality(
      { brief: "Build a bakery website. Pages: Home, Menu.", kind: "app", generatedTree: [file("src/generated.ts", "export const x = 1;")] },
      {
        emittedFiles: [
          file("src/ui/router.tsx", 'export function SiteRouter() { return <nav><a href="/menu">Menu</a></nav>; }'),
          file("src/ui/pages/HomePage.tsx", "export function HomePage() { return <main>home</main>; }"),
        ],
      },
    );
    assert.equal(q.kindSurface.kind, "web");
    assert.ok(q.kindSurface.pageFiles.length >= 1, "the emitted page file is read");
    assert.equal(q.kindSurface.navPath, true, "the emitted router/nav is read");
  });

  it("carries the SAME gate-evidence qualification acceptance/doctor report", () => {
    const q = readProductQuality({
      brief: "x",
      phases: [{ id: 3, status: "complete" }],
      artifacts: [{ id: "a", phase: 3, kind: "mcp", title: "MCP", body: "contract body", language: "markdown" }],
    });
    assert.equal(q.gateEvidence.phases.length, 1);
    assert.equal(q.gateEvidence.phases[0].phase, 3);
    assert.match(q.gateEvidence.note, /RT_E_CLAIM_UNVERIFIED/);
    assert.deepEqual(q.gateEvidence.weakPhases, [3]);
  });

  it("a non-object input yields an honest empty gate-evidence reading (no fabricated pass)", () => {
    assert.deepEqual(readProductQuality(null).gateEvidence.phases, []);
    assert.match(readProductQuality(null).gateEvidence.note, /no complete phase/);
  });
});

// ---------------------------------------------------------------------------
// fixes/354 A2-F9/F10 — the UI signals are bounded to files REACHABLE from the
// emitted entry. A router/className/form nothing mounts is not the product.
// ---------------------------------------------------------------------------
describe("product-quality — reachability-bound UI signals (A2-F9/F10)", () => {
  const html = file("index.html", `<!doctype html><div id="root"></div><script type="module" src="/src/main.tsx"></script>`);
  const routerFile = file(
    "src/other/router.tsx",
    `import { createBrowserRouter } from "react-router";\nexport const r = createBrowserRouter([{ path: "/menu", element: null }]);`,
  );
  const pageFile = file(
    "src/pages/hidden.tsx",
    `export function Hidden() { return <form className="card" onSubmit={s}><input name="q" /></form>; }`,
  );

  it("does NOT count an unreachable router / styled page / form", () => {
    const q = readProductQuality({
      brief: "Build an ordering website.",
      generatedTree: [html, file("src/main.tsx", `export const x = 1;`), routerFile, pageFile],
    });
    assert.equal(q.webEntry.present, true);
    assert.equal(q.pages.routerPresent, false, "the router file is not reachable from src/main.tsx");
    assert.deepEqual(q.pages.routePaths, [], "route literals from an unreachable file are not counted");
    assert.equal(q.pages.routerStrength, "none");
    assert.equal(q.layout.styled, false, "className in an unreachable file is not a styled layout");
    assert.equal(q.orderingFlow.formWired, false, "a form in an unreachable file is not wired");
    assert.ok(q.reasons.some((r) => /no router API reachable/.test(r)), "the reason names the reachability bound");
  });

  it("counts the SAME files once the entry imports them", () => {
    const q = readProductQuality({
      brief: "Build an ordering website.",
      generatedTree: [
        html,
        file("src/main.tsx", `import { r } from "./other/router.tsx";\nimport { Hidden } from "./pages/hidden.tsx";\nexport const x = [r, Hidden];`),
        routerFile,
        pageFile,
      ],
    });
    assert.equal(q.pages.routerPresent, true);
    assert.equal(q.pages.routerStrength, "router");
    assert.ok(q.pages.routePaths.includes("/menu"));
    assert.equal(q.layout.styled, true);
    assert.equal(q.orderingFlow.formWired, true);
  });

  it("reports inline hash-navigation honestly as a weaker signal, not a router", () => {
    const q = readProductQuality({
      brief: "A single-page tool.",
      generatedTree: [
        html,
        file("src/main.tsx", `export function shell() { return <a href="#/about">About</a>; }\nwindow.addEventListener("hashchange", () => {});`),
      ],
    });
    assert.equal(q.pages.routerPresent, false, "inline nav is not a router API");
    assert.equal(q.pages.routerStrength, "inline-nav");
    assert.ok(q.reasons.some((r) => /inline hash-navigation/.test(r)));
  });
});

// ---------------------------------------------------------------------------
// fixes/354 A2-F12 — a "not published by this build" placeholder page is not a
// page.
// ---------------------------------------------------------------------------
describe("product-quality — placeholder pages are not counted (A2-F12)", () => {
  it("excludes page files rendering the scaffold's not-published placeholder", () => {
    const q = readProductQuality({
      brief: "x",
      generatedTree: [
        file("index.html", `<!doctype html><div id="root"></div><script type="module" src="/src/main.tsx"></script>`),
        file("src/main.tsx", `import { A } from "./pages/A.tsx";\nimport { B } from "./pages/B.tsx";\nimport { C } from "./pages/C.tsx";\nexport const x = [A, B, C];`),
        file(
          "src/pages/A.tsx",
          `import { EmptySection } from "../view.tsx";\nexport function A() { return <EmptySection title="A" />; }`,
        ),
        file("src/pages/B.tsx", `export function B() { return <main>real content</main>; }`),
        file("src/pages/C.tsx", `export function C() { return <p>Menu is not published by this build.</p>; }`),
      ],
    });
    assert.equal(q.pages.pageFiles.length, 3, "all three page files are still listed structurally");
    assert.deepEqual(q.pages.placeholderPages, ["src/pages/A.tsx", "src/pages/C.tsx"]);
    assert.equal(q.pages.distinctPages, 1, "only the content-bearing page counts");
  });

  it("names the placeholder count in the reasons when NO content page remains", () => {
    const q = readProductQuality({
      brief: "x",
      generatedTree: [
        file("index.html", `<!doctype html><div id="root"></div><script type="module" src="/src/main.tsx"></script>`),
        file("src/main.tsx", `import { A } from "./pages/A.tsx";\nexport const x = A;`),
        file(
          "src/pages/A.tsx",
          `import { EmptySection } from "../view.tsx";\nexport function A() { return <EmptySection title="A" />; }`,
        ),
      ],
    });
    assert.equal(q.pages.distinctPages, 0);
    assert.ok(
      q.reasons.some((r) => /" placeholders/.test(r)),
      `the reason names the placeholder count: ${q.reasons.join(" | ")}`,
    );
  });

  it("does not guess a placeholder when the page file has no bytes", () => {
    const q = readProductQuality({
      brief: "x",
      generatedTree: [{ path: "src/pages/Unknown.tsx" }],
    });
    assert.deepEqual(q.pages.placeholderPages, [], "absent source is never guessed as a placeholder");
    assert.equal(q.pages.distinctPages, 1);
  });
});
