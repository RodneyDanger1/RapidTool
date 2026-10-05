// ---------------------------------------------------------------------------
// scaffold.test.ts — E-15 scaffold emitter + E-27 shipped-artifact notes
// (src/lib/scaffold.ts). Pure, deterministic, no disk writes.
// Run: node --experimental-strip-types --test src/lib/scaffold.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { exportProjectJson, slugName } from "./io.ts";
import { ERROR_CODES } from "./errors.ts";
import { inventoryFromJobSources } from "./doctor.ts";
import { ALL_PHASES, runHeadless, seedProject } from "./testing/fixtures.ts";
import type { Project, SpecGraph } from "./types.ts";
import { DEPLOY_HONESTY_STAMP, deployNotes, deplyNotes, projectKindOf, scaffoldProject, underProductionRefusalOf } from "./scaffold.ts";
import type { ScaffoldFile, ScaffoldResult } from "./scaffold.ts";
import { deliveryKindOf, withDeliveryKind } from "./engine.ts";
import { compileFixtureAssertion, fixtureMatchHelperSource } from "./brief-fixtures.ts";
import { specSourceHasBehaviouralAssert } from "./compile-check.server.ts";

/** A fully engine-run project (real lattice, spec graph, contracts, oracle, P6 module). */
const fullRun = (over: Partial<Project> = {}) => runHeadless(seedProject(over), ALL_PHASES);

/** P0-primed project: lattice + specGraph + contracts + oracle, no generated code. */
const primed = (over: Partial<Project> = {}) => runHeadless(seedProject(over), [0]);

/** Assert ok and return the file list (type-narrowing helper). */
function okFiles(result: ScaffoldResult): ScaffoldFile[] {
  assert.ok(result.ok, `expected ok: ${!result.ok ? result.error : ""}`);
  return (result as { ok: true; files: ScaffoldFile[] }).files;
}

function bodyOf(result: ScaffoldResult, path: string): string {
  assert.ok(result.ok, `expected ok result (${!result.ok ? result.error : "n/a"})`);
  const f = (result as { ok: true; files: ScaffoldFile[] }).files.find((x) => x.path === path);
  assert.ok(f, `expected file ${path}`);
  return f!.body;
}

const SAFE_PATH = /^[A-Za-z0-9_./-]+$/;

describe("projectKindOf (E-15 kind mapping + inference)", () => {
  it("maps the declared 3-way Project.kind onto the 5-way scaffold taxonomy", () => {
    assert.equal(projectKindOf(fullRun({ kind: "app" })), "webapp");
    assert.equal(projectKindOf(fullRun({ kind: "tool" })), "cli-tool");
    assert.equal(projectKindOf(fullRun({ kind: "game" })), "game");
  });

  it("infers webapp from the engine dispatch-board fixture when kind is absent", () => {
    assert.equal(projectKindOf(fullRun()), "webapp");
  });

  it("infers the register keywords from brief/domain when kind is absent", () => {
    assert.equal(
      projectKindOf(primed({ brief: "Retro arcade game with levels and power-ups" })),
      "game",
    );
    assert.equal(
      projectKindOf(primed({ brief: "CLI tool that parses CSV and converts formats" })),
      "cli-tool",
    );
    assert.equal(
      projectKindOf(primed({ brief: "TypeScript SDK package exposing a typed client" })),
      "library",
    );
    assert.equal(projectKindOf(primed({ brief: "Webhook worker API for billing" })), "service");
  });

  it("341-1: a brief naming a library is not captured by a surface noun (agrees with engine.uiKindOf)", () => {
    // "board" is a webapp keyword and previously won over "library" because
    // webapp was checked first — while engine.uiKindOf resolved library and the
    // P6 module came out library-shaped (kind left absent). RED before the
    // precedence fix: this asserted "webapp".
    assert.equal(
      projectKindOf(primed({ brief: "A kanban board library exposing a typed board client" })),
      "library",
    );
    // The surface-noun rule still holds when no delivery kind is named.
    assert.equal(projectKindOf(primed({ brief: "A kanban board for dispatch teams" })), "webapp");
  });

  it("342-4: a STORED kind is the single source of truth — projectKindOf never re-infers against it", () => {
    // A stored library kind must win over the brief's webapp surface noun:
    // the resolver reads the ONE decided value instead of re-deriving a second
    // kind from the brief. RED before: the declared-kind branch had no library
    // row, so this fell through to inference and returned "webapp".
    assert.equal(
      projectKindOf(primed({ kind: "library", brief: "A kanban board for dispatch teams" })),
      "library",
    );
    // Same for the other explicit kinds: stored wins over brief nouns.
    assert.equal(projectKindOf(primed({ kind: "service", brief: "A kanban board for dispatch teams" })), "service");
  });

  it("342-4: engine decision == scaffold decision == one value, for the kanban library brief", () => {
    const p = primed({ brief: "A kanban board library exposing a typed board client" });
    // The engine decides ONCE (library wins over the "board" surface noun)…
    assert.equal(deliveryKindOf(p), "library");
    // …stamps that single value onto the project…
    const decided = withDeliveryKind(p);
    assert.equal(decided.kind, "library");
    // …and the scaffold resolver reads it back — no second inference.
    assert.equal(projectKindOf(decided), "library");
    // The emitted tree is a real library PACKAGE (main/exports/files, no index.html).
    const files = okFiles(scaffoldProject(decided));
    const pkg = JSON.parse(bodyOf(scaffoldProject(decided), "package.json")) as Record<string, unknown>;
    assert.equal(pkg.private, false, "library is publishable");
    assert.equal(pkg.main, "./src/main.ts");
    assert.deepEqual(pkg.exports, { ".": "./src/main.ts" }, "library declares an exports map");
    assert.deepEqual(pkg.files, ["src"]);
    assert.ok(!files.some((f) => f.path === "index.html"), "a library is not a webapp");
  });
});

describe("scaffoldProject — file-tree shape per kind", () => {
  it("emits the full root file set for an app (declared kind) project", () => {
    const p = fullRun({ kind: "app" });
    const files = okFiles(scaffoldProject(p));
    const paths = files.map((f) => f.path);
    for (const root of [
      "README.md",
      "DEPLOY.md",
      ".env.example",
      ".gitignore",
      "package.json",
      "tsconfig.json",
      ".rapidtool/project.json",
    ]) {
      assert.ok(paths.includes(root), `missing ${root}`);
    }
    // every spec-graph node file (tests node included) materializes on disk
    for (const node of p.specGraph!.nodes) {
      assert.ok(paths.includes(node.file), `missing spec-graph node file ${node.file}`);
    }
    assert.ok(!paths.includes("assets/manifest.json"), "no game manifest for a webapp");
    assert.ok(files.length === new Set(paths).size, "paths are unique");
    for (const f of files) {
      assert.match(f.path, SAFE_PATH, `unsafe path ${f.path}`);
      assert.ok(!f.path.includes(".."), `path traversal in ${f.path}`);
    }
    const result = scaffoldProject(p);
    assert.ok(result.ok);
    assert.match((result as { ok: true; summary: string }).summary, /kind webapp/);
  });

  it("T4.2 (217f): emits a deterministic .gitignore — ignore list pinned, reviewed artifacts tracked", () => {
    // Single-module mode (the legacy hosted-module emit).
    const result = scaffoldProject(fullRun());
    const body = bodyOf(result, ".gitignore");
    const lines = body.split("\n");
    for (const entry of ["node_modules/", "dist/", ".rapidtool/logs/"]) {
      assert.ok(lines.includes(entry), `.gitignore pins ${entry} as its own line`);
    }
    // The artifacts a person reviews stay tracked: no blanket directory ignores,
    // and the generated source is never ignored.
    for (const banned of [".rapidtool/", "src", "src/", "tests", "tests/", "*.ts"]) {
      assert.ok(!lines.includes(banned), `must not ignore the reviewed artifact ${banned}`);
    }
    assert.ok(
      !lines.includes(".rapidtool/project.json"),
      "project.json (the packet export) stays tracked",
    );
    // Byte-stable: identical for every kind and independent of project text; no
    // timestamp and no absolute path (the repo pins emitted determinism).
    const other = bodyOf(
      scaffoldProject(fullRun({ kind: "game", name: "Zeta", brief: "a different brief entirely" })),
      ".gitignore",
    );
    assert.equal(other, body, "kind- and project-independent bytes");
    assert.ok(!/\d{4}-\d{2}-\d{2}|[A-Za-z]:[\\/]/.test(body), "no timestamp or absolute path");
    // Tree mode: the generated-tree emit carries the same bytes.
    const tree = scaffoldProject({
      ...fullRun(),
      generatedTree: [
        { path: "src/generated/entry.ts", source: "export function alpha() { return 1; }\n", hash: "h1", attempt: 0 },
      ],
    });
    assert.ok(okFiles(tree).some((f) => f.path === ".gitignore"), ".gitignore emitted in tree mode");
    assert.equal(bodyOf(tree, ".gitignore"), body, "same bytes in tree mode");
    // Declare-or-strike: the shipped README tables every emitted file, this one included.
    assert.ok(bodyOf(result, "README.md").includes(".gitignore"), "README names the emitted file");
  });

  it("gives an app kind a vite+react package.json and a React ui shell", () => {
    const p = fullRun({ kind: "app" });
    const result = scaffoldProject(p);
    const pkg = JSON.parse(bodyOf(result, "package.json")) as Record<string, any>;
    assert.ok(pkg.scripts.dev === "vite" && pkg.scripts.build === "vite build");
    assert.ok(pkg.scripts.typecheck && pkg.scripts.test);
    assert.ok(pkg.dependencies.react && pkg.dependencies["react-dom"]);
    assert.ok((pkg.devDependencies as Record<string, string>).vite);
    assert.equal(pkg.name, slugName(p.name));
    const ui = bodyOf(result, "src/ui/console.tsx");
    // 216d (106 T-05 / F-03): the emitted shell imports the module the emitter
    // ACTUALLY writes — here the hosted P6 module (the first job-* node),
    // resolved relative to src/ui/. OLD assertion: `ui.includes("../generated")`
    // pinned the literal "../generated.ts", a path the tree allow-list refuses
    // and nothing ever wrote (a guaranteed dangling specifier in every emit).
    // NEW: the specifier must resolve to a file present in the emitted set.
    const genImport = ui.match(/import \* as generated from "([^"]+)";/);
    assert.ok(genImport, "webapp console imports the generated entry namespace");
    const specifier = genImport![1];
    const specTarget = specifier.startsWith("../") ? `src/${specifier.slice(3)}` : specifier;
    assert.ok(
      okFiles(result).some((f) => f.path === specTarget),
      `generated import target ${specTarget} must be an emitted file (specifier ${specifier})`,
    );
    // Teeth check: the pre-fix literal may only appear when that exact module is
    // really on disk (the tree mode case where the barrel IS the declared entry).
    assert.ok(
      specifier !== "../generated.ts" ||
        okFiles(result).some((f) => f.path === "src/generated.ts"),
      "the pre-fix literal must never name a path nothing writes",
    );
    assert.ok(/<h1>\{/.test(ui), "name goes through a JSX expression");
    assert.ok(!ui.includes("<h1>A/B"), "raw name never becomes JSX text");
  });

  it("gives a tool kind a node:test package.json (no unused dev tool) and a non-React console shell", () => {
    const p = fullRun({ kind: "tool" });
    const result = scaffoldProject(p);
    const pkg = JSON.parse(bodyOf(result, "package.json")) as Record<string, any>;
    // W52 / 338-5: `tsx` was declared on cli-tool/service but NO emitted script or
    // import ever used it (the entries run `node --experimental-strip-types`) —
    // declare-or-strike: a dev tool nothing consumes is not declared.
    assert.ok(!pkg.devDependencies.tsx, "no unused tsx devDep — the emitted scripts run node --experimental-strip-types");
    assert.ok(!pkg.scripts.dev && !pkg.scripts.build, "no vite scripts for a tool");
    assert.ok(pkg.scripts.test.includes("--test tests/oracle.spec.ts"));
    const ui = bodyOf(result, "src/ui/console.tsx");
    assert.ok(!ui.includes("react"), "no React import in a tool shell");
    assert.ok(ui.includes("main(ctx"));
  });

  it("infers library/service kinds and gives them lean package skeletons", () => {
    const lib = primed({ brief: "TypeScript SDK package exposing a typed client" });
    const svc = primed({ brief: "Webhook worker API for billing" });
    const libResult = scaffoldProject(lib);
    const libPkg = JSON.parse(bodyOf(libResult, "package.json")) as Record<string, any>;
    assert.equal(libPkg.private, false, "library kind is publishable");
    assert.ok(!libPkg.dependencies || Object.keys(libPkg.dependencies).length === 0);
    const svcPkg = JSON.parse(bodyOf(scaffoldProject(svc), "package.json")) as Record<string, any>;
    assert.ok(svcPkg.scripts.typecheck && svcPkg.scripts.test);
  });

  it("adds a placeholder game-asset manifest for a game project and vite scripts", () => {
    const p = fullRun({ kind: "game" });
    const result = scaffoldProject(p);
    const manifest = JSON.parse(bodyOf(result, "assets/manifest.json")) as any;
    assert.equal(manifest.kind, "game");
    assert.ok(manifest.assets.length >= 1, "roster expected");
    for (const asset of manifest.assets as any[]) {
      assert.equal(asset.status, "placeholder");
      assert.ok(asset.note.includes("NOT engine-generated"));
    }
    const pkg = JSON.parse(bodyOf(result, "package.json")) as Record<string, any>;
    assert.equal(pkg.scripts.dev, "vite");
    const ui = bodyOf(result, "src/ui/console.tsx");
    assert.ok(ui.includes("bootGame"), "canvas shell expected for game kind");
  });

  it("handles an intake-only project (no spec graph, no oracle) with a minimal tree", () => {
    const p = {
      ...seedProject(),
      lattice: null,
      specGraph: null,
      contracts: null,
      oracle: [],
      generatedSource: "",
    };
    const result = scaffoldProject(p);
    const files = okFiles(result);
    const paths = files.map((f) => f.path);
    // fixes/135 bootability: even an intake-only webapp carries the browser
    // boot shell (index.html + vite.config.ts + src/main.tsx) so npm run
    // build/dev genuinely run; no domain/jobs/api stubs without a spec graph.
    // W52 / 338-5: src/styles.css joins the webapp boot shell (the entry the
    // declared tailwind devDeps compile).
    assert.deepEqual(paths, [
      "README.md",
      "DEPLOY.md",
      ".env.example",
      ".gitignore",
      "package.json",
      "tsconfig.json",
      ".rapidtool/project.json",
      "index.html",
      "vite.config.ts",
      "src/main.tsx",
      "src/styles.css",
    ]);
    const pkg = JSON.parse(bodyOf(result, "package.json")) as Record<string, any>;
    assert.equal(pkg.scripts.test, undefined, "no test script when there is no oracle spec");
    assert.ok(
      files.every((f) => !f.path.startsWith("src/") || f.path === "src/main.tsx" || f.path === "src/styles.css"),
      "only the boot-shell src entry without a spec graph",
    );
    // fixes/217f (T4.2): the .gitignore joined the emitted file set — the count
    // moves with it. old → new: "10 files" → "11 files" (338-5 added styles.css).
    assert.ok((result as { ok: true; summary: string }).summary.startsWith("11 files"));
  });

  it("fails honestly for a project with an empty name", () => {
    const bad = seedProject({ name: "   " });
    const result = scaffoldProject(bad);
    assert.ok(!result.ok);
    assert.match((result as { ok: false; error: string }).error, /empty name/);
  });
});

describe("scaffoldProject — generated source + artifacts placement", () => {
  it("hosts the machine-verified P6 module verbatim on the first job node", () => {
    const p = fullRun();
    assert.ok(p.generatedSource.length > 0, "fixture must have generated code");
    const hostNode = p.specGraph!.nodes.find((n) => n.id === "job-0")!;
    const result = scaffoldProject(p);
    const host = bodyOf(result, hostNode.file);
    assert.ok(host.includes("const JOBS = ["), "generated module embedded");
    // fixes/135: the host may append an exports/export surface after the
    // generated module (so tests/oracle.spec.ts can import its names) — the
    // generated source itself must still be embedded byte-for-byte.
    assert.ok(host.includes(p.generatedSource.trim()), "generated source embedded verbatim");
    // exactly one emitted src module carries the generated code (.rapidtool/project.json
    // is the live record and legitimately embeds generatedSource in the JSON export)
    const carriers = okFiles(result).filter(
      (f) => f.path.startsWith("src/") && f.body.includes("const JOBS = ["),
    );
    assert.equal(carriers.length, 1);
    // leftover job-* nodes re-export the hosted module (fixes/196) — never a
    // throw stub and never an invented job body.
    const job1 = p.specGraph!.nodes.find((n) => n.id === "job-1");
    if (job1) {
      const bridge = bodyOf(result, job1.file);
      assert.ok(bridge.includes("export * from"), "leftover job re-exports the hosted module");
      assert.ok(!bridge.includes("TODO(E-15) stub"), "leftover job is not a throw stub");
      assert.ok(!bridge.includes("export function runJob"), "no invented leftover job body");
    }
  });

  it("emits domain types from the A6 contract entities and endpoints from the contract", () => {
    const p = fullRun();
    const schemaNode = p.specGraph!.nodes.find((n) => n.id === "schema")!;
    const apiNode = p.specGraph!.nodes.find((n) => n.id === "api")!;
    const result = scaffoldProject(p);
    const schema = bodyOf(result, schemaNode.file);
    const interfaces = schema.split("\n").filter((l) => l.startsWith("export interface "));
    assert.equal(interfaces.length, p.contracts!.entities.length);
    const api = bodyOf(result, apiNode.file);
    assert.ok(api.includes("export const ENDPOINTS"));
    const rows = api.split("\n").filter((l) => l.trimStart().startsWith("{ method:"));
    assert.equal(rows.length, p.contracts!.endpoints.length);
  });

  it("turns A7 oracle rows into REAL assertions in tests/oracle.spec.ts (no TODO stubs — fixes/135)", () => {
    const p = fullRun();
    const result = scaffoldProject(p);
    const spec = bodyOf(result, "tests/oracle.spec.ts");
    const testLines = spec.split("\n").filter((l) => l.trimStart().startsWith("test("));
    // ≥ oracle rows: the spec adds module-truth + store/api surface tests on
    // top of one test per pinned oracle row (fixes/135 real-assertion contract).
    assert.ok(testLines.length >= p.oracle.length, "at least one test per oracle row");
    for (const row of p.oracle) {
      assert.ok(spec.includes(JSON.stringify(row.id)), `oracle id ${row.id} pinned`);
    }
    // The E-15 stub era is gone: every oracle row pins a test that asserts
    // what the emitted modules ACTUALLY do (module truth / store-api surface /
    // honest stub-rejection) — no `todo: true` rows.
    assert.ok(!spec.includes("{ todo: true }"), "no todo stubs — real assertions only");
    assert.ok(/PINNED/.test(spec), "verify-harness id-pinning pointer present");
    assert.ok(spec.includes('from "node:test"'), "runnable under node:test");
    assert.ok(spec.includes("assert."), "contains real assertions");
    // fixes/147 (E-15 paren canonicalization): the spec's stub-rejection rows
    // assert /TODO\(E-15\) stub/ against the emitted route() rejection, so the
    // emitted routes body must carry the canonical paren form (paren closes
    // after "15" — never "TODO(E-15 stub)"). The regex must match both the
    // emitted source and the simulated runtime message route() throws.
    const apiNode = p.specGraph!.nodes.find((n) => n.id === "api");
    assert.ok(apiNode, "fixture must carry an api node");
    const routesBody = bodyOf(result, apiNode!.file);
    assert.match(
      routesBody,
      /TODO\(E-15\) stub/,
      "emitted routes.ts carries the canonical marker the oracle reject-regex asserts",
    );
    // fixes/328 P2: the emitted router now carries TWO coded refusals — an
    // unrecorded endpoint (contract drift, `unknown endpoint`) and a recorded
    // endpoint whose job has no emitted implementation (the TODO stub form).
    // The oracle reject-regex targets the LATTER, so simulate that one; the
    // unknown-endpoint refusal is asserted separately (both are real paths).
    const throwMsgs = [...routesBody.matchAll(/throw new Error\(`([^`]+)`\)/g)].map(
      (m) => m[1]!,
    );
    const stubMsg = throwMsgs.find((m) => m.includes("TODO(E-15) stub"));
    assert.ok(stubMsg, "emitted route() must reject via a template-literal Error");
    const simulated = stubMsg!
      .replace("${method}", "GET")
      .replace("${path}", "/v1/example");
    assert.match(
      simulated,
      /TODO\(E-15\) stub/,
      "simulated route() rejection (runtime interpolation) matches the oracle reject-regex",
    );
    const unknownMsg = throwMsgs.find((m) => m.includes("unknown endpoint"));
    assert.ok(unknownMsg, "the router also refuses an unrecorded endpoint with a coded reason");
    assert.match(
      unknownMsg!
        .replace("${method}", "GET")
        .replace("${path}", "/v1/example"),
      /RT_E_VALIDATION · unknown endpoint GET \/v1\/example/,
      "the unknown-endpoint refusal is coded and names the unrecorded wire",
    );
  });

  // W60/346-6 C1: the emitted failure paths are SURFACED product failures. Each
  // must carry the registered refusal code (I13) — never a bare message a tree
  // consumer cannot classify. The `ErrorCode` annotation on the constant is the
  // typecheck tie; this scans the emitted throw lines at runtime.
  it("every emitted scaffold throw carries the registered refusal code (I13)", () => {
    const src = readFileSync(new URL("./scaffold.ts", import.meta.url), "utf8");
    const decl = /const EMITTED_REFUSAL_CODE(?::\s*ErrorCode)?\s*=\s*"([^"]+)"/.exec(src);
    assert.ok(decl, "EMITTED_REFUSAL_CODE is declared");
    assert.ok(
      (ERROR_CODES as readonly string[]).includes(decl![1]!),
      `the emitted refusal code must be registered: ${decl![1]}`,
    );
    const throws = src.split("\n").filter((l) => /throw new Error\(/.test(l));
    assert.ok(throws.length >= 12, `expected >=12 emitted coded throws, found ${throws.length}`);
    for (const l of throws) {
      assert.ok(
        /EMITTED_REFUSAL_CODE|emittedRefusal/.test(l),
        `an emitted throw has no coded refusal prefix: ${l.trim()}`,
      );
    }
  });

  it("emits only the canonical TODO(E-15) stub marker in every file that mentions E-15 (fixes/147)", () => {
    // Regression for the E-15 paren mismatch: the oracle spec asserts
    // /TODO\(E-15\) stub/ (paren closes after "15"), so every emitted stub that
    // mentions the marker must use that canonical form — the pre-fix
    // "TODO(E-15 stub)" (paren closing after "stub") made every stub-rejection
    // row fail. Sweep every kind flavor that emits marker-bearing stubs.
    const variants: Project[] = [
      fullRun(), // webapp: schema/api route()/store/job stubs + oracle spec
      fullRun({ kind: "tool" }), // cli-tool console entry throw
      fullRun({ kind: "game" }), // game canvas-shell comment
      primed({ brief: "Webhook worker API for billing" }), // service entry throw
    ];
    for (const p of variants) {
      const result = scaffoldProject(p);
      assert.ok(result.ok, `scaffold ok for ${p.kind ?? "inferred"}`);
      for (const f of (result as { ok: true; files: ScaffoldFile[] }).files) {
        if (!f.body.includes("E-15")) continue;
        assert.ok(
          f.body.includes("TODO(E-15) stub"),
          `${f.path}: E-15 mention without the canonical TODO(E-15) stub marker`,
        );
        assert.ok(
          !f.body.includes("TODO(E-15 stub"),
          `${f.path}: pre-fix paren form — paren closes after "stub" instead of "15"`,
        );
      }
    }
  });

  it("331: the tree-job oracle probe AWAITS the call (an async rejection must not float past the test)", () => {
    // The "guarded probe" row calls a REAL job function. Those functions are
    // async, so a synchronous try/catch alone lets the rejection outlive the
    // test: node:test then reports "generated asynchronous activity after the
    // test ended" as an unhandledRejection and the whole spec FILE fails,
    // reddening the tree for a reason unrelated to product quality. Awaiting
    // keeps the rejection inside the guard.
    const result = scaffoldProject({
      ...fullRun(),
      generatedTree: [
        {
          path: "src/jobs/dispatch.ts",
          source: "export async function dispatchOrder() { throw new Error(\"ValidationError: propertyId is required\"); }\n",
          hash: "h-dispatch",
          attempt: 0,
        },
      ],
    });
    const spec = bodyOf(result, "tests/oracle.spec.ts");
    assert.match(
      spec,
      /await \(jm_\w+\[first\] as \(\.\.\.a: unknown\[\]\) => unknown\)\(/,
      "the job probe awaits the call so a rejection is caught, not floated",
    );
    assert.ok(
      !/^\s+\(jm_\w+\[first\][^\n]*\);\s*$/m.test(spec),
      "no bare, un-awaited probe call survives",
    );
  });

  it("346 E1 item 2: the tree-job row carries a behavioural assertion (a shape-only surface cannot earn tested)", () => {
    const result = scaffoldProject({
      ...fullRun(),
      generatedTree: [
        {
          path: "src/jobs/dispatch.ts",
          source: "export async function dispatchOrder() { return { ok: true }; }\n",
          hash: "h-dispatch-ok",
          attempt: 0,
        },
      ],
    });
    const spec = bodyOf(result, "tests/oracle.spec.ts");
    assert.match(spec, /assert\.equal\(__jobOutcomeOk, true,/, "the emitted row asserts the call outcome");
    assert.match(spec, /Number\.isNaN\(__jobResult\)/, "a NaN stub return (the L1-F2 shape) fails the row");
    assert.ok(
      specSourceHasBehaviouralAssert(spec),
      "the emitted spec must carry ≥1 behavioural assertion, not only typeof/length probes",
    );
  });

  it("keeps the exported project record byte-identical to io.exportProjectJson", () => {
    const p = fullRun();
    const result = scaffoldProject(p);
    assert.equal(bodyOf(result, ".rapidtool/project.json"), exportProjectJson(p));
  });
});

describe("scaffoldProject — determinism", () => {
  it("returns byte-identical trees for the same project", () => {
    const p = fullRun({ kind: "game" });
    const a = scaffoldProject(p);
    const b = scaffoldProject(p);
    assert.ok(a.ok && b.ok);
    const ta = a as { ok: true; summary: string };
    const tb = b as { ok: true; summary: string };
    assert.equal(ta.summary, tb.summary);
    const fa = (a as { ok: true; files: ScaffoldFile[] }).files;
    const fb = (b as { ok: true; files: ScaffoldFile[] }).files;
    assert.deepEqual(fa, fb);
  });

  it("keeps .env.example constant per kind — never derived from project text", () => {
    const p1 = fullRun({ kind: "app", name: "Alpha", brief: "completely different brief A" });
    const p2 = fullRun({ kind: "app", name: "Beta", brief: "completely different brief B" });
    const e1 = bodyOf(scaffoldProject(p1), ".env.example");
    const e2 = bodyOf(scaffoldProject(p2), ".env.example");
    assert.equal(e1, e2);
    assert.ok(e1.includes("VITE_API_BASE_URL=PLACEHOLDER"));
    const game = bodyOf(scaffoldProject(fullRun({ kind: "game" })), ".env.example");
    assert.notEqual(game, e1);
    const tool = bodyOf(scaffoldProject(fullRun({ kind: "tool" })), ".env.example");
    assert.ok(tool.includes("API_KEY=PLACEHOLDER") && !tool.includes("VITE_"));
  });
});

describe("scaffoldProject — escaping (hostile inputs)", () => {
  const HOSTILE = 'A/B "quote" `tick` <script>alert(1)</script>\nline2 🧨';

  function hostileProject(): Project {
    const base = seedProject({ kind: "app", name: HOSTILE });
    const graph: SpecGraph = {
      nodes: [
        {
          id: "job-0",
          file: "../../../etc/passwd",
          purpose: "Implement job “drop table; --” against the contract",
          dependsOn: [],
          owner: "implementer",
        },
        {
          id: "schema",
          file: "src/domain/ok.ts",
          purpose: "Typed entities",
          dependsOn: [],
          owner: "architect",
        },
      ],
      order: ["schema", "job-0"],
    };
    return {
      ...base,
      specGraph: graph,
      generatedSource: "",
      lattice: {
        domain: "hostile",
        jobs: ["drop table; --"],
        entities: ["widget"],
        constraints: ["c1"],
        nodes: [],
        complexity: 1,
      },
      contracts: {
        entities: [
          {
            name: "Dr0p Table; --",
            fields: [
              { name: 'f1 "quote"', type: "ulid?" },
              { name: "f2`tick`", type: "int" },
            ],
          },
        ],
        endpoints: [{ method: "POST", path: "/v1/drop", job: "drop table; --" }],
      },
      oracle: [
        {
          id: "orc-1",
          name: "job.drop.happy",
          given: "line1\nrm -rf /\nline3",
          expect: "200 OK",
          job: "drop table; --",
        },
        { id: 'orc-"x"', name: "n<>&", given: "g'`", expect: "e", job: "drop table; --" },
      ],
    };
  }

  it("never emits traversal or unsafe paths", () => {
    const result = scaffoldProject(hostileProject());
    const files = okFiles(result);
    for (const f of files) {
      assert.match(f.path, SAFE_PATH);
      assert.ok(!f.path.includes(".."));
    }
    assert.ok(
      files.some((f) => f.path === "src/generated/job-0.ts"),
      "unsafe node file falls back to a derived safe path",
    );
  });

  it("keeps package.json parseable with a slugged name (quotes/newlines/emoji)", () => {
    const result = scaffoldProject(hostileProject());
    const pkg = JSON.parse(bodyOf(result, "package.json")) as Record<string, any>;
    assert.equal(pkg.name, slugName(HOSTILE));
    assert.ok(!pkg.name.includes(" "));
  });

  it("sanitizes hostile entity/field names into valid identifiers", () => {
    const result = scaffoldProject(hostileProject());
    const schema = bodyOf(result, "src/domain/ok.ts");
    const codeLines = schema.split("\n").filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l));
    const code = codeLines.join("\n");
    assert.ok(schema.includes("Dr0p_Table_"), "entity name becomes an identifier");
    assert.ok(!schema.includes("Dr0p Table"), "raw hostile entity text never reaches code");
    assert.ok(!code.includes('"quote"'), "field names do not leak raw quotes into code");
    assert.ok(!code.includes("`tick`"), "field names do not leak raw backticks into code");
    assert.ok(code.includes(": string | null;"), "ulid? maps to string | null");
    assert.ok(code.includes(": number;"), "int maps to number");
    // every identifier line stays on one clean line
    for (const line of schema.split("\n")) {
      assert.ok(line.length <= 200, `overlong schema line: ${line}`);
    }
  });

  it("collapses newlines so hostile prose cannot break out of strings or comments", () => {
    const result = scaffoldProject(hostileProject());
    const spec = bodyOf(result, "tests/oracle.spec.ts");
    // 216b (106 T-08 / F-05): a row with no real surface to assert against no longer
    // emits the tautological `test("<id>".length > 0)` floor — it emits a VISIBLY
    // marked `test.skip("<id> — NOT IMPLEMENTED")` instead. This test's intent is that
    // the rows exist and stay single-line (the escaping contract), not that every row
    // is executable, so count BOTH forms. Counting only `test(` silently encoded the
    // tautologies this task deleted.
    const rows = spec.split("\n").filter((l) => {
      const t = l.trimStart();
      return t.startsWith("test(") || t.startsWith("test.skip(");
    });
    assert.equal(rows.length, 2, "both oracle rows still materialise as single-line spec entries");
    // The new contract must hold: a skip is named, never a silent always-true assertion.
    for (const l of spec.split("\n").filter((l) => l.trimStart().startsWith("test.skip("))) {
      assert.ok(l.includes("NOT IMPLEMENTED"), `a skipped row must be VISIBLY marked: ${l}`);
    }
    assert.ok(!spec.includes("line1\n"), "newline inside oracle prose was collapsed");
    const stub = bodyOf(result, "src/generated/job-0.ts");
    assert.ok(stub.includes("drop table; --"), "job label survives as prose");
    assert.ok(!stub.includes("line1\n"), "comment inserts are single-line");
    const readme = bodyOf(result, "README.md");
    assert.ok(!readme.includes("alert(1)</script>\n"), "name newline collapsed in markdown too");
  });
});

describe("scaffoldProject + deployNotes — no secrets, honest local-only framing", () => {
  it("keeps .env.example to PLACEHOLDER values even when the project carries secrets", () => {
    const p = seedProject({
      kind: "app",
      name: "Leaky",
      brief: "use sk-live-ABCDEF0123456789 and AKIAIOSFODNN7EXAMPLE and password=hunter2",
      memory: [
        {
          id: "m1",
          kind: "episodic",
          phase: 0,
          text: "token sk-live-ABCDEF0123456789 in memory",
          score: 0.9,
        },
        {
          id: "m2",
          kind: "semantic",
          phase: 0,
          text: "AKIAIOSFODNN7EXAMPLE rotated weekly",
          score: 0.8,
        },
      ],
    });
    const result = scaffoldProject(p);
    const env = bodyOf(result, ".env.example");
    for (const line of env.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"))) {
      assert.match(line, /^[A-Z_]+=PLACEHOLDER$/, `env line is PLACEHOLDER-only: ${line}`);
    }
    for (const secret of ["sk-live-ABCDEF0123456789", "AKIAIOSFODNN7EXAMPLE", "hunter2"]) {
      assert.ok(!env.includes(secret), `.env.example leaked ${secret}`);
    }
    // DEPLOY.md is composed from P9/P12 artifacts + kind defaults — never from memory/brief text.
    const notes = deployNotes(p);
    for (const secret of ["sk-live-ABCDEF0123456789", "AKIAIOSFODNN7EXAMPLE", "hunter2"]) {
      assert.ok(!notes.includes(secret), `DEPLOY.md leaked ${secret}`);
    }
  });

  it("carries the E-27 honesty stamp and human-gated, local-only deploy framing", () => {
    const p = fullRun(); // P9/P12 recorded: GitHub Actions workflow + IaC sketch + ADR + OpenAPI
    const notes = deployNotes(p);
    assert.ok(notes.includes(DEPLOY_HONESTY_STAMP), "mandatory stamp present verbatim");
    for (const section of [
      "## Run locally",
      "## Environment",
      "## Test",
      "## Deploy — human-gated, nothing automatic",
      "## Assets",
      "## Recorded pipeline templates (P9/P12)",
    ]) {
      assert.ok(notes.includes(section), `missing section ${section}`);
    }
    assert.ok(notes.includes("No deployment is configured"), "no-cloud claim present");
    assert.ok(notes.includes("GitHub Actions"), "P9 workflow artifact embedded");
    assert.ok(notes.includes("IaC sketch"), "P9 IaC artifact embedded");
    assert.ok(notes.includes("Architecture Decision Records"), "P12 ADR embedded");
    assert.doesNotMatch(
      notes,
      /will deploy|automatically deploy|deployed to/i,
      "no auto-deploy claim",
    );
    assert.doesNotMatch(notes, /npm (run )?(build|publish) (deploys?|pushes?)/i);
    assert.ok(notes.includes("assets/` and `public/` are expected"), "asset boundary documented");
  });

  it("adds game-specific asset wording and kind default destinations to DEPLOY.md", () => {
    const game = deployNotes(fullRun({ kind: "game" }));
    assert.ok(game.includes("assets/manifest.json"), "game notes name the manifest");
    assert.ok(game.includes("itch.io"), "game kind destination hint present");
    const web = deployNotes(fullRun({ kind: "app" }));
    assert.ok(web.includes("preview channels"), "webapp destination hint present");
    assert.ok(!web.includes("itch.io"));
  });

  it("notes honestly when no P9/P12 templates exist yet", () => {
    const notes = deployNotes(seedProject());
    assert.ok(notes.includes("_None yet"), "empty-template note");
    assert.ok(!notes.includes("GitHub Actions workflow"));
  });
});

describe("deployNotes — run/test/env/deploy steps exist and are executable-sounding", () => {
  it("lists real commands matching the emitted skeleton", () => {
    const p = fullRun({ kind: "tool" });
    const notes = deployNotes(p);
    assert.ok(notes.includes("npm install"));
    assert.ok(notes.includes("cp .env.example .env"));
    assert.ok(notes.includes("npm run typecheck"));
    assert.ok(notes.includes("npm test"));
    const pkg = JSON.parse(bodyOf(scaffoldProject(p), "package.json")) as Record<string, any>;
    for (const script of Object.values(pkg.scripts) as string[]) {
      if (script.includes("--test")) {
        // fixes/135: emitted tests are REAL assertions now — the notes tell the
        // operator to run the oracle suite, not that stubs stay green.
        assert.ok(
          notes.includes("oracle.spec") || notes.includes("npm test"),
          "test notes point at the real emitted oracle suite",
        );
      }
    }
  });

  it("scaffoldProject's DEPLOY.md file is exactly deployNotes output", () => {
    const p = fullRun();
    const result = scaffoldProject(p);
    assert.equal(bodyOf(result, "DEPLOY.md"), deployNotes(p));
  });
});

describe("A2 — approved fixtures fold into tests/oracle.spec.ts", () => {
  const fx = {
    id: "orc-1",
    requirementId: "orc-1",
    capability: "record",
    name: "job.record.happy",
    given: { address: "1 Main" },
    expect: { kind: "shape" as const, value: { id: "p-1" } },
    kind: "pure" as const,
    source: "a7" as const,
    approval: "approved" as const,
    target: "createProperty",
  };

  function treeProject(over: Partial<Project> = {}): Project {
    const p = fullRun();
    return {
      ...p,
      generatedTree: [
        {
          path: "src/generated/entry.ts",
          source: "export function createProperty(g) { return { id: 'p-1', ...g }; }\n",
          hash: "h1",
          attempt: 0,
        },
      ],
      ...over,
    };
  }

  it("no fixtures / partial approval → oracle.spec has no fx. tests (byte-identical pair)", () => {
    const p = fullRun();
    const tree = [
      {
        path: "src/generated/entry.ts",
        source: "export function createProperty(g) { return { id: 'p-1', ...g }; }\n",
        hash: "h1",
        attempt: 0,
      },
    ];
    const base = { ...p, generatedTree: tree };
    const a = bodyOf(scaffoldProject(base), "tests/oracle.spec.ts");
    const pending = {
      ...base,
      acceptanceFixtures: [{ ...fx, approval: "pending" as const }],
    };
    const b = bodyOf(scaffoldProject(pending), "tests/oracle.spec.ts");
    assert.equal(a, b, "partial approval must not change the emitted spec");
    assert.ok(!a.includes("fx.orc-1"), "no fixture tests without a fully-approved set");
  });

  it("all-approved fixtures emit fx.* tests using JSON.stringify given and the tree entry", () => {
    const p = treeProject({ acceptanceFixtures: [fx] });
    const spec = bodyOf(scaffoldProject(p), "tests/oracle.spec.ts");
    assert.ok(spec.includes("fx.orc-1"), "approved fixture becomes a real test");
    assert.ok(spec.includes(JSON.stringify({ address: "1 Main" })), "given is JSON-escaped");
    assert.ok(spec.includes("__fxPartialMatch"), "shape uses partial-match helper");
    assert.ok(spec.includes("const entry = treeModule"), "calls the tree barrel namespace");
    const pkg = JSON.parse(bodyOf(scaffoldProject(p), "package.json")) as { scripts?: { test?: string } };
    assert.ok(pkg.scripts?.test?.includes("tests/oracle.spec.ts"), "still the single oracle.spec test script");
    assert.ok(!pkg.scripts?.test?.includes("brief.spec"), "no second test file");
  });

  it("A1-01: an approved placeholder set is refused at emit — no vacuous fx. test", () => {
    const placeholder = { ...fx, expect: { kind: "shape" as const, value: { id: "<draft>" } } };
    const spec = bodyOf(
      scaffoldProject(treeProject({ acceptanceFixtures: [placeholder] })),
      "tests/oracle.spec.ts",
    );
    assert.ok(!spec.includes("fx.orc-1"), "a sentinel bar must not emit an always-true fx. test");
    assert.ok(!spec.includes("<draft>"), "no sentinel literal survives into the spec");
    assert.equal(compileFixtureAssertion(placeholder).ok, false, "the compiler red-cards a sentinel");
    assert.ok(
      !fixtureMatchHelperSource().includes("<draft>"),
      "the emitted matcher carries no sentinel escape hatch",
    );
  });
});

describe("scaffoldProject — leftover job-* nodes (fixes/196)", () => {
  function leftoverJobs(p: Project) {
    return (p.specGraph?.nodes ?? []).filter((n) => n.id.startsWith("job-")).slice(1);
  }

  it("re-exports the hosted generated module for leftover jobs (no fake job bodies)", () => {
    const p = fullRun();
    assert.ok((p.generatedSource ?? "").trim().length > 0, "fixture must have generatedSource");
    const host = p.specGraph!.nodes.find((n) => n.id.startsWith("job-"))!;
    const result = scaffoldProject(p);
    const leftovers = leftoverJobs(p);
    assert.ok(leftovers.length >= 1, "fixture must carry leftover job-* nodes");
    for (const node of leftovers) {
      const body = bodyOf(result, node.file);
      assert.ok(body.includes("export * from"), `${node.id} re-exports the hosted module`);
      assert.ok(
        body.includes(host.file.split("/").pop() as string),
        `${node.id} specifier targets the host file`,
      );
      assert.ok(!body.includes("TODO(E-15) stub"), `${node.id} is not a throw stub`);
      assert.ok(!body.includes("throw new Error"), `${node.id} does not throw a stub`);
      assert.ok(!body.includes("export function runJob"), `${node.id} has no invented job body`);
      for (const fake of ["flip", "record", "show", "publish"]) {
        assert.ok(
          !new RegExp(`export function ${fake}\\b`).test(body),
          `${node.id} must not fake-implement ${fake}`,
        );
      }
    }
    const spec = bodyOf(result, "tests/oracle.spec.ts");
    for (const node of leftovers) {
      const m = node.purpose.match(/["“]([^"”]+)["”]/);
      const label = m ? m[1] : node.id;
      assert.ok(
        !new RegExp(`Target seam: ${label}[\\s\\S]{0,400}assert\\.rejects\\(route[\\s\\S]{0,80}TODO`).test(
          spec,
        ),
        `oracle must not assert TODO throw for bridged job ${label}`,
      );
    }
    // host job / API route may still assert the TODO throw (do not delete globally).
    // W16+W17 coded-refusal contract: the emitted row names RT_E_VALIDATION
    // before the canonical escaped-paren TODO marker.
    assert.match(spec, /assert\.rejects\(route\(ep\.method, ep\.path, \{\}\), \/RT_E_VALIDATION · TODO\\\(E-15\\\) stub\/\)/);
  });

  it("keeps leftover jobs as emitJobStub when there is no generatedSource", () => {
    const p = primed();
    assert.equal((p.generatedSource ?? "").trim(), "", "primed fixture has no generatedSource");
    const result = scaffoldProject(p);
    const leftovers = leftoverJobs(p);
    assert.ok(leftovers.length >= 1, "fixture must carry leftover job-* nodes");
    for (const node of leftovers) {
      const body = bodyOf(result, node.file);
      assert.ok(body.includes("TODO(E-15) stub"), `${node.id} stays the keyless stub floor`);
      assert.ok(body.includes("throw new Error"), `${node.id} still throws TODO`);
      assert.ok(!body.includes("export * from"), `${node.id} is not a hosted re-export`);
    }
    const spec = bodyOf(result, "tests/oracle.spec.ts");
    assert.match(
      spec,
      /assert\.rejects\(route\(ep\.method, ep\.path, \{\}\), \/RT_E_VALIDATION · TODO\\\(E-15\\\) stub\/\)/,
      "stub jobs MAY still assert the TODO throw",
    );
  });

  it("does not double-emit a leftover job path already covered by generatedTree", () => {
    const p = fullRun();
    const job1 = p.specGraph!.nodes.find((n) => n.id === "job-1");
    assert.ok(job1, "fixture must carry job-1");
    const treeSrc = "export function fromTree() { return 7; }\n";
    const withTree: Project = {
      ...p,
      generatedTree: [{ path: job1!.file, source: treeSrc, hash: "h1", attempt: 0 }],
    };
    const files = okFiles(scaffoldProject(withTree));
    const copies = files.filter((f) => f.path === job1!.file);
    assert.equal(copies.length, 1, "tree-covered path emitted once");
    assert.equal(copies[0]!.body, treeSrc, "verbatim tree source — not a bridge, not a stub");
  });
});

/**
 * fixes/216d — Wave D regressions (106 T-04 + T-05, plus the 216b oracle-row
 * census these edits cross-reference). Each block pins behaviour the code
 * edits landed in `scaffold.ts`; nothing here re-tests the pre-fix literals.
 *
 *   - T-04: a refused `generatedTree` row is REFUSED LOUDLY — shipped README
 *     line + `warnings[]` — never a silent drop; the declared
 *     `src/generated.ts` entry assembles verbatim; look-alikes stay refused.
 *   - census (216b): the README oracle-row bullet renders in BOTH branches and
 *     always agrees with the emitted spec's skip set.
 *   - T-05: the emitted shell imports the module the emitter ACTUALLY writes
 *     (the computed entry), so the specifier can never dangle.
 */
describe("fixes/216d — refused tree rows, declared entry, census bullet, computed UI entry", () => {
  /** The single `## Honest boundaries` oracle-row bullet (null when absent). */
  const censusLineOf = (readme: string): string | undefined =>
    readme.split("\n").find((l) => l.startsWith("- Oracle rows ("));

  it("T-04: a refused non-empty tree row is surfaced in the README AND warnings[] — never a silent drop", () => {
    const treeSrc = "export function overwrite() { return 1; }\n";
    const result = scaffoldProject({
      ...fullRun(),
      generatedTree: [{ path: "README.md", source: treeSrc, hash: "h-refused", attempt: 0 }],
    });
    const files = okFiles(result);
    const readme = bodyOf(result, "README.md");
    // The refusal means the row is NOT on disk: its exact bytes are in no emitted file.
    assert.ok(
      !files.some((f) => f.body === treeSrc),
      "the refused row's bytes are absent from every emitted file",
    );
    const expected =
      'generatedTree:refused:"README.md":path "README.md" is outside the scaffold\'s src/ subdirs and tests/';
    assert.deepEqual(
      result.ok ? result.warnings : [],
      [expected],
      "warnings[] carries the refusal verdict verbatim",
    );
    const refusalLine = readme.split("\n").find((l) => l.includes("generated tree row(s) were REFUSED"));
    assert.ok(refusalLine, "the shipped README records the refusal under Honest boundaries");
    assert.ok(
      refusalLine!.includes(expected),
      "the README line names the declared path and the reason — not a silent drop",
    );
    // A refused-only tree leaves treeMode false (no accepted row) → the legacy
    // summary sentence; with an accepted row alongside, the CLI-facing summary
    // carries the refusal count too (scaffold.ts summary contract).
    const mixed = scaffoldProject({
      ...fullRun(),
      generatedTree: [
        { path: "src/generated.ts", source: "export function declared() { return 2; }\n", hash: "h-ok", attempt: 0 },
        { path: "README.md", source: treeSrc, hash: "h-refused", attempt: 0 },
      ],
    });
    assert.ok(
      (mixed as { ok: true; summary: string }).summary.includes("1 refused (see warnings)"),
      "the CLI-facing summary flags the refusal when the tree assembles",
    );
    assert.deepEqual(
      mixed.ok ? mixed.warnings : [],
      [
        expected,
        // Parent boundary update (W8, fixes/216k D3): in tree mode the fixture's
        // three uncovered job nodes are now COUNTED + surfaced (pre-D3 they were
        // silently bridged). Verdict order: refusal first, then graph order.
        ...(["dispatch", "reroute", "scan"] as const).map(
          (label) =>
            `specGraph:unmaterialised-job:"src/jobs/${label}.ts":job "${label}" has no generated tree file — tree mode NEVER bridges a job node (fixes/216k D3 / TA-15)`,
        ),
      ],
      "warnings[] carries the refusal verdict verbatim + the three counted unmaterialised job nodes",
    );
  });

  it("T-04: the declared src/generated.ts entry lands verbatim; the look-alike stays refused", () => {
    const entrySrc = 'export * from "./generated/chunk-0.ts";\n';
    const result = scaffoldProject({
      ...fullRun(),
      generatedTree: [
        { path: "src/generated.ts", source: entrySrc, hash: "h-entry", attempt: 0 },
        { path: "src/generated/chunk-0.ts", source: "export function alpha() { return 1; }\n", hash: "h-chunk", attempt: 0 },
        { path: "src/generated.ts.bak", source: "not a tree file\n", hash: "h-bak", attempt: 0 },
      ],
    });
    const files = okFiles(result);
    const entry = files.find((f) => f.path === "src/generated.ts");
    assert.ok(
      entry,
      "the declared tree entry assembles (pre-fix it was refused by construction — 106 F-03)",
    );
    assert.equal(entry!.body, entrySrc, "tree files are emitted verbatim — no scaffold wrapper");
    const warnings = result.ok ? (result.warnings ?? []) : [];
    // Parent boundary update (W8, fixes/216k D3): tree mode now surfaces the
    // fixture's three unmaterialised job nodes alongside the single refusal —
    // pre-D3 they were silently bridged. The refusal must stay FIRST.
    assert.equal(warnings.length, 4, "the look-alike refusal + the three unmaterialised job nodes");
    assert.ok(
      warnings[0]!.includes('generatedTree:refused:"src/generated.ts.bak"'),
      "the exact-match widening cannot admit a look-alike prefix",
    );
    assert.ok(
      warnings.slice(1).every((w) => w.includes("specGraph:unmaterialised-job:")),
      "every other warning is the counted unmaterialised-job surfacing (never silent)",
    );
    assert.ok(
      !files.some((f) => f.path === "src/generated.ts.bak"),
      "the refused look-alike is absent from disk",
    );
    assert.ok(
      bodyOf(result, "README.md").includes('generatedTree:refused:"src/generated.ts.bak"'),
      "the look-alike refusal is recorded in the shipped README too",
    );
  });

  it("216b census: the README bullet renders in BOTH branches and agrees with the emitted spec", () => {
    // Branch 1 — every pinned row carries a real assertion (full engine run).
    const clean = scaffoldProject(fullRun());
    const cleanLine = censusLineOf(bodyOf(clean, "README.md"));
    const cleanSpec = bodyOf(clean, "tests/oracle.spec.ts");
    assert.ok(cleanLine, "census bullet renders when nothing is skipped");
    assert.match(
      cleanLine!,
      /: all \d+ pinned row\(s\) assert the emitted modules' real current behavior — no NOT IMPLEMENTED skips\.$/,
      "all-assert branch statement",
    );
    assert.ok(!cleanLine!.includes("are NOT IMPLEMENTED"), "no false skip claim on the all-assert branch");
    assert.equal(
      cleanSpec.split("\n").filter((l) => l.trimStart().startsWith("test.skip(")).length,
      0,
      "spec agrees: zero skipped rows",
    );

    // Branch 2 — rows the emitted modules give no surface to assert against are
    // counted AND named (id + the visible skip marker in the spec itself).
    const skipped = scaffoldProject(primed());
    const skipLine = censusLineOf(bodyOf(skipped, "README.md"));
    const skipSpec = bodyOf(skipped, "tests/oracle.spec.ts");
    assert.ok(skipLine, "census bullet still renders when rows are NOT IMPLEMENTED");
    assert.match(
      skipLine!,
      /: \d+ of \d+ pinned row\(s\) assert the emitted modules' real current behavior; \d+ are NOT IMPLEMENTED/,
      "mixed branch statement",
    );
    const named = skipLine!.match(/skipped \(never green\): (.+)\.$/);
    assert.ok(named, "the census names the NOT IMPLEMENTED row ids");
    const ids = named![1].split(", ").map((s) => s.replace(/`/g, ""));
    assert.ok(ids.length >= 1, "at least one NOT IMPLEMENTED id is named");
    for (const id of ids) {
      assert.ok(
        skipSpec.includes(`test.skip(${JSON.stringify(`${id} — NOT IMPLEMENTED`)}`),
        `the emitted spec skips ${id} BY NAME — census and artifact agree: ${id}`,
      );
    }
    const specSkips = skipSpec.split("\n").filter((l) => l.trimStart().startsWith("test.skip("));
    assert.equal(
      specSkips.length,
      ids.length,
      "census count === skipped rows in the emitted spec (one source of truth, 216b)",
    );
    assert.ok(
      !bodyOf(skipped, "README.md").includes("no NOT IMPLEMENTED skips"),
      "no false clean claim when rows skip",
    );
  });

  it("T-05: the emitted shell imports the computed tree entry — exactly the module the oracle spec imports", () => {
    const cases: {
      label: string;
      tree: NonNullable<Project["generatedTree"]>;
      entry: string;
      uiSpecifier: string;
      specSpecifier: string;
    }[] = [
      {
        label: "declared src/generated.ts barrel",
        tree: [
          { path: "src/generated.ts", source: 'export * from "./generated/chunk-0.ts";\n', hash: "h1", attempt: 0 },
          { path: "src/generated/chunk-0.ts", source: "export function alpha() { return 1; }\n", hash: "h2", attempt: 0 },
        ],
        entry: "src/generated.ts",
        uiSpecifier: "../generated.ts",
        specSpecifier: "../src/generated.ts",
      },
      {
        label: "A2 fixture tree (single src/generated/entry.ts)",
        tree: [
          {
            path: "src/generated/entry.ts",
            source: "export function createProperty(g) { return { id: 'p-1', ...g }; }\n",
            hash: "h1",
            attempt: 0,
          },
        ],
        entry: "src/generated/entry.ts",
        uiSpecifier: "../generated/entry.ts",
        specSpecifier: "../src/generated/entry.ts",
      },
    ];
    for (const c of cases) {
      const result = scaffoldProject({ ...fullRun(), generatedTree: c.tree });
      const ui = bodyOf(result, "src/ui/console.tsx");
      const spec = bodyOf(result, "tests/oracle.spec.ts");
      const uiImport = ui.match(/import \* as generated from "([^"]+)";/);
      assert.ok(uiImport, `${c.label}: shell carries the generated-entry import`);
      assert.equal(
        uiImport![1],
        c.uiSpecifier,
        `${c.label}: UI specifier IS the computed entry (pre-fix: the literal "../generated.ts")`,
      );
      const specImport = spec.match(/import \* as treeModule from "([^"]+)";/);
      assert.ok(specImport, `${c.label}: oracle spec imports the tree entry`);
      assert.equal(
        specImport![1],
        c.specSpecifier,
        `${c.label}: spec + UI resolve to the same entry module`,
      );
      assert.ok(okFiles(result).some((f) => f.path === c.entry), `${c.label}: the entry really lands on disk`);
    }
    // Legacy (no tree): the shell follows generatedSource's host — the first
    // job node's file, the scaffold's documented host-selection contract —
    // never a fixed literal.
    const legacyProject = fullRun();
    const legacy = scaffoldProject(legacyProject);
    const legacyImport = bodyOf(legacy, "src/ui/console.tsx").match(
      /import \* as generated from "([^"]+)";/,
    );
    assert.ok(legacyImport, "legacy shell imports its generated host");
    const legacyTarget = `src/${legacyImport![1].replace(/^\.\.\//, "")}`;
    const firstJob = legacyProject.specGraph!.nodes.find((n) => n.id.startsWith("job-"));
    assert.ok(firstJob, "fixture carries job nodes");
    assert.equal(
      legacyTarget,
      firstJob!.file,
      "shell import resolves to the computed host (first job node's file)",
    );
    assert.ok(
      okFiles(legacy).some((f) => f.path === legacyTarget),
      "the computed host is really emitted",
    );
  });
});

// ---------------------------------------------------------------------------
// A3 (fixes/309_a3_guardset.md) — M4-16: the deplyNotes/deployNotes twin is
// consolidated on the correct spelling; the legacy name survives as the alias.
// ---------------------------------------------------------------------------

describe("A3/M4-16 — deplyNotes/deployNotes twin", () => {
  it("deplyNotes resolves to the canonical deployNotes (call site + exports agree)", () => {
    assert.equal(deplyNotes, deployNotes, "one function, two names — the legacy spelling is alias-only");
    assert.equal(typeof deployNotes(seedProject()), "string", "the wired name is callable");
  });
});

// ---------------------------------------------------------------------------
// fixes/328 P2 (TA-15 / P0-04) — REAL per-job modules + real HTTP wiring.
//
// The recorded specRecord (`implementationSpec.typeSignatures`) is the line
// between real and refusal: bound signatures ⇒ a real module / a dispatched
// endpoint; no recorded surface (the keyless floor) ⇒ the honest coded stub
// stays. These pins carry TEETH: they read the emitted bytes AND classify them
// with the doctor's own census so "real" here means what `doctor --tree` says.
// ---------------------------------------------------------------------------
describe("fixes/328 P2 — REAL per-job modules + HTTP wiring (TA-15/P0-04)", () => {
  /** primed project + a recorded specRecord (the keyed half of the boundary). */
  const keyed = (typeSignatures: string[], over: Partial<Project> = {}): Project => ({
    ...primed(over),
    implementationSpec: {
      requirements: [],
      edgeCases: [],
      errorHandling: [],
      typeSignatures,
      dataFlow: [],
      negativeConstraints: [],
      source: "prompt-verb",
      briefHash: "h",
      createdAt: 0,
    },
  });
  /** The doctor's own classifier — the census authority, not a regex of ours. */
  const jobKinds = (files: ScaffoldFile[]): Record<string, string> =>
    Object.fromEntries(
      inventoryFromJobSources(
        files
          .filter((f) => f.path.startsWith("src/jobs/"))
          .map((f) => ({ path: f.path, source: f.body })),
      ).files.map((r) => [r.path, r.kind]),
    );

  it("a bound job becomes a REAL module (real signature, no TODO, no re-export)", () => {
    const p = keyed(["runDispatch(command: DispatchCommand): Promise<Tech>"]);
    const files = okFiles(scaffoldProject(p));
    const dispatch = files.find((f) => f.path === "src/jobs/dispatch.ts")!;
    assert.ok(dispatch, "the wired job module is emitted");
    assert.ok(
      dispatch.body.includes("export async function runDispatch(command: DispatchCommand): Promise<Tech>"),
      "the RECORDED signature is emitted verbatim",
    );
    assert.ok(
      dispatch.body.includes(`export const ENDPOINTS: JobEndpoint[] = [\n  { method: "POST", path: "/v1/dispatch" },`),
      "the job carries its recorded A6 endpoint",
    );
    assert.ok(dispatch.body.includes('export const ORACLE_ROWS: readonly string[] = ["orc-1"'),
      "the job carries its recorded A7 row ids");
    const kinds = jobKinds(files);
    assert.equal(kinds["src/jobs/dispatch.ts"], "real", "doctor's classifier agrees: real");
    assert.equal(kinds["src/jobs/reroute.ts"], "stub", "an unwired job keeps the honest coded stub");
    assert.equal(kinds["src/jobs/scan.ts"], "stub", "an unwired job keeps the honest coded stub");
    // The type the spec names but does not shape is declared opaquely — never
    // invented as a field list.
    assert.ok(dispatch.body.includes("export type DispatchCommand = string | number | Record<string, unknown>;"));
    assert.ok(!/^\s*(export\s+)?interface\s/m.test(dispatch.body), "no invented field shape");
  });

  it("the emitted router dispatches wired jobs and still refuses unwired ones", () => {
    const p = keyed(["runDispatch(command: DispatchCommand): Promise<Tech>"]);
    const files = okFiles(scaffoldProject(p));
    const api = files.find((f) => f.path === "src/api/routes.ts")!;
    assert.ok(api.body.includes('import * as jobMod0 from "../jobs/dispatch.ts";'), "router imports the real module");
    assert.ok(api.body.includes('"dispatch": (input: unknown) => jobMod0.handle(input),'), "router dispatches by job");
    assert.ok(api.body.includes("return { ok: true, job: endpoint.job, result: await handler(input) };"));
    // Refusals stay REAL paths: unrecorded endpoint AND recorded-but-unwired job.
    assert.match(api.body, /unknown endpoint \$\{method\} \$\{path\}/);
    assert.match(api.body, /TODO\(E-15\) stub: implement/);
    // Keyless floor: no wired jobs ⇒ no imports/handlers, every endpoint refuses.
    const floor = okFiles(scaffoldProject(primed())).find((f) => f.path === "src/api/routes.ts")!;
    assert.ok(!floor.body.includes("jobMod0"), "no handler wiring without a recorded surface");
    assert.ok(floor.body.includes("const HANDLERS: Record<string, (input: unknown) => Promise<unknown>> = {\n};"));
  });

  it("the emitted spec asserts the reported row class: live dispatch vs honest refusal", () => {
    const p = keyed(["runDispatch(command: DispatchCommand): Promise<Tech>"]);
    const spec = bodyOf(scaffoldProject(p), "tests/oracle.spec.ts");
    assert.ok(
      spec.includes("const res = await route(ep.method, ep.path, { id: \"orc-1-probe\" });"),
      "the wired row calls the router for real",
    );
    assert.ok(spec.includes("assert.equal(res.job, \"dispatch\");"), "and asserts the dispatched job");
    assert.match(
      spec,
      /assert\.rejects\(route\(ep\.method, ep\.path, \{\}\), \/RT_E_VALIDATION · TODO\\\(E-15\\\) stub\/\)/,
      "the unwired row keeps the coded stub-rejection assertion",
    );
    // Capability rows must scan the materialised job modules, not only the host.
    assert.ok(spec.includes('"../src/jobs/dispatch.ts"'), "the real job module is in the capability scan set");
  });

  it("a job with no bound recorded signature keeps the honest coded refusal", () => {
    const p = keyed(["unrelatedThing(a: number): Promise<void>"]);
    const files = okFiles(scaffoldProject(p));
    const kinds = jobKinds(files);
    for (const path of ["src/jobs/dispatch.ts", "src/jobs/reroute.ts", "src/jobs/scan.ts"]) {
      assert.equal(kinds[path], "stub", `${path}: no recorded surface ⇒ the coded stub, never an invented body`);
    }
    assert.ok(
      files.find((f) => f.path === "src/jobs/dispatch.ts")!.body.includes("TODO(E-15) stub: implement job dispatch"),
    );
  });

  it("tree mode materialises the uncovered bound job node as a REAL module (never a bridge)", () => {
    const p = keyed(["runDispatch(command: DispatchCommand): Promise<Tech>"], {
      generatedTree: [
        { path: "src/generated/util.ts", source: "export function util(): number { return 1; }\n", hash: "h1", attempt: 0 },
      ],
    });
    const result = scaffoldProject(p);
    const files = okFiles(result);
    const kinds = jobKinds(files);
    assert.equal(kinds["src/jobs/dispatch.ts"], "real", "the bound job materialises real in tree mode");
    assert.equal(
      kinds["src/jobs/reroute.ts"],
      undefined,
      "an unbound job stays unmaterialised in tree mode — never a stub, never a bridge",
    );
    const warnings = result.ok ? (result.warnings ?? []) : [];
    assert.ok(
      !warnings.some((w: string) => w.includes('"src/jobs/dispatch.ts"')),
      "a materialised job is no longer reported unmaterialised",
    );
    assert.ok(
      warnings.some((w: string) => w.includes('"src/jobs/reroute.ts"')),
      "the genuinely unmaterialised node stays LOUDLY reported",
    );
  });

  it("stays deterministic with a recorded surface (same project ⇒ byte-identical files)", () => {
    const p = keyed([
      "runDispatch(command: DispatchCommand): Promise<Tech>",
      "runReroute(command: RerouteCommand): Promise<Dispatcher>",
      "runScan(command: ScanCommand): Promise<Parts>",
    ]);
    assert.deepEqual(scaffoldProject(p), scaffoldProject(p));
  });
});

// ---------------------------------------------------------------------------
// 330 Transit — emitted-format integrity: the emitter never ships a module the
// package it declares cannot load. packageJson() declares `"type":"module"` and
// this emitter's own infra is ESM, so a CommonJS body assembled verbatim
// (`module.exports` / `exports.x =`) throws "module is not defined in ES module
// scope" at import — while compile-check is a parse (a CJS body parses fine) and
// the emitted spec imports only its own surfaces. Reproduced live: a
// generatedSource-only CJS project emitted ok:true and `tree-run` read ok:true
// while `import()` threw. The emit-time materializer rewrites TREES, not a lone
// generatedSource, and direct callers bypass it entirely. Declare-or-strike.
// ---------------------------------------------------------------------------
describe("330 Transit — emitted-format integrity (never ship an unloadable module)", () => {
  it("REFUSES a generatedSource-only CommonJS body (the package declares type:module)", () => {
    const p = primed({
      generatedSource: "function add(a, b) { return a + b; }\nmodule.exports.add = add;\n",
      generatedTree: [],
    });
    const r = scaffoldProject(p);
    assert.equal(r.ok, false, "an unloadable generated module must never emit ok:true");
    assert.ok(!r.ok);
    assert.match((r as { ok: false; error: string }).error, /CommonJS/);
    assert.match((r as { ok: false; error: string }).error, /"type":"module"/);
    assert.ok(
      (r as { ok: false; error: string }).error.includes("src/jobs/") ||
        (r as { ok: false; error: string }).error.includes("src/generated.ts"),
      (r as { ok: false; error: string }).error,
    );
  });

  it("REFUSES a CommonJS TREE row (tree mode) and names the offending file", () => {
    const p = primed({
      generatedSource: "",
      generatedTree: [
        { path: "src/generated/get-property.ts", source: "function a() {}\nmodule.exports.a = a;\n", hash: "h1", attempt: 0 },
      ],
    });
    const r = scaffoldProject(p);
    assert.equal(r.ok, false);
    assert.ok((r as { ok: false; error: string }).error.includes("src/generated/get-property.ts"));
  });

  it("control: clean ESM generatedSource and tree still emit ok:true", () => {
    const src = primed({ generatedSource: "export function add(a: number, b: number): number { return a + b; }\n" });
    const r1 = scaffoldProject(src);
    assert.equal(r1.ok, true, !r1.ok ? r1.error : "");
    const tree = primed({
      generatedSource: "",
      generatedTree: [
        { path: "src/generated/util.ts", source: "export function util(): number { return 1; }\n", hash: "h1", attempt: 0 },
      ],
    });
    const r2 = scaffoldProject(tree);
    assert.equal(r2.ok, true, !r2.ok ? r2.error : "");
  });
});

// ---------------------------------------------------------------------------
// W48 / 334-3 (T1a) — the emitted README must say the EMITTER never ran the
// declared scripts. 338-2 (W52) changed what a tree-run REPORTS: it now
// resolves the declared tools (the tree's own node_modules, else the repo's)
// and runs them, so a type-clean tree reads `declaredScriptsVerified: true`
// (~`false` + `unverifiedDeclaredScripts` only when a tool cannot resolve).
// Without a banner the README could present the scaffold as complete. Same
// unmissable style as headless's red-tree banner.
// ---------------------------------------------------------------------------
describe("W48 / 334-3 (T1a) — declared-scripts-unverified README banner", () => {
  it("the emitted README LEADS with the banner and names the declared typecheck + build as unverified", () => {
    const p = fullRun({ kind: "app" });
    const readme = bodyOf(scaffoldProject(p), "README.md");
    assert.ok(readme.startsWith("> [!WARNING]\n"), "the banner heads the README (unmissable, like the red-tree banner)");
    assert.match(readme, /DECLARED SCRIPTS NOT RUN/);
    assert.match(readme, /`typecheck` and `build`/);
    assert.match(readme, /UNVERIFIED/);
    // 338-2: the banner now names BOTH tree-run outcomes truthfully — a verified
    // tree reads true, an unresolvable declared tool reads false + the field.
    assert.match(readme, /declaredScriptsVerified: true/);
    assert.match(readme, /declaredScriptsVerified: false/);
    assert.match(readme, /unverifiedDeclaredScripts/);
    // It is the declared-scripts banner, not a red-tree-run banner: distinct signal.
    assert.equal(readme.includes("RED TREE-RUN"), false);
    // And it precedes the project title, so a human cannot miss it.
    assert.ok(
      readme.indexOf("DECLARED SCRIPTS NOT RUN") < readme.indexOf(`# ${p.name}`),
      "the banner renders above the title",
    );
  });

  it("names only the scripts the kind actually declares (cli-tool has no build)", () => {
    const p = fullRun({ kind: "tool" });
    const result = scaffoldProject(p);
    const readme = bodyOf(result, "README.md");
    assert.match(readme, /`typecheck` IS UNVERIFIED/);
    assert.equal(readme.includes("`build`"), false, "no build script is declared for cli-tool, so none is named");
    // The registry really confirms cli-tool declares no build (pin the premise).
    const pkg = JSON.parse(bodyOf(result, "package.json")) as { scripts?: Record<string, string> };
    assert.equal(typeof pkg.scripts?.build, "undefined");
    assert.equal(typeof pkg.scripts?.typecheck, "string");
  });
});

// ---------------------------------------------------------------------------
// W49 / 335-3 — the cli-tool declares its runnable entry. Pre-fix its
// package.json carried only `bin`; the headless entry resolver therefore fell
// through to an unrelated job module, so corrupting the program the bin
// launcher actually runs (src/main.ts) kept the tree GREEN (a false green of
// the same class the W48 T3 fix closed for library/service).
// ---------------------------------------------------------------------------
describe("W49 / 335-3 — cli-tool declares its runnable entry (main)", () => {
  it("package.json declares `main: './src/main.ts'`, the file the bin launcher delegates to", () => {
    const p = fullRun({ kind: "tool" });
    const result = scaffoldProject(p);
    const slug = slugName(p.name);
    const pkg = JSON.parse(bodyOf(result, "package.json")) as {
      main?: string;
      bin?: Record<string, string>;
    };
    assert.equal(pkg.main, "./src/main.ts", "the runnable entry is DECLARED, not only the launcher");
    assert.deepEqual(pkg.bin, { [slug]: `bin/${slug}.mjs` }, "the launcher stays declared too");
    const paths = okFiles(result).map((f) => f.path);
    assert.ok(paths.includes("src/main.ts"), "the declared main is an emitted file");
    assert.ok(paths.includes(`bin/${slug}.mjs`), "the bin launcher is an emitted file");
  });
});

// ---------------------------------------------------------------------------
// W50 / 336-3 (Transit) — DEPLOY.md must state what the emitted bytes actually
// declare. The pre-fix Test section told the operator to run `npm test` against
// a tree whose package.json declares no `test` script (zero oracle rows) and
// claimed "no todo stubs" on a tree whose own README counts test.skip rows.
// ---------------------------------------------------------------------------
describe("W50 / 336-3 — DEPLOY.md matches the emitted oracle bytes", () => {
  it("a NOT IMPLEMENTED oracle row makes DEPLOY.md carry the census, not a 'no todo stubs' claim", () => {
    const p = seedProject(); // P0: rows with no module surface are NOT IMPLEMENTED
    const result = scaffoldProject(p);
    const readme = bodyOf(result, "README.md");
    assert.ok(
      readme.includes("NOT IMPLEMENTED"),
      "precondition: this emission really carries a NOT IMPLEMENTED row (README census)",
    );
    const dep = bodyOf(result, "DEPLOY.md");
    assert.ok(
      !dep.includes("no todo stubs"),
      "DEPLOY.md must not claim every row asserts when the emitted spec skips one",
    );
    assert.ok(dep.includes("NOT IMPLEMENTED"), "DEPLOY.md names the skipped rows");
    assert.ok(dep.includes("npm test"), "the emitted package.json still declares a test script");
  });

  it("no oracle rows: package.json declares no test script, so DEPLOY.md never says `npm test`", () => {
    const p = seedProject({ oracle: [] });
    const result = scaffoldProject(p);
    const pkg = JSON.parse(bodyOf(result, "package.json")) as { scripts: Record<string, string> };
    assert.equal(pkg.scripts.test, undefined, "no oracle rows => no declared test script");
    const dep = bodyOf(result, "DEPLOY.md");
    assert.ok(!dep.includes("npm test"), "DEPLOY.md must not instruct a script the tree never declares");
    assert.ok(dep.includes("## Test"), "the Test section still exists");
    assert.ok(
      dep.includes("No oracle rows are recorded yet"),
      "the Test section states the honest reason instead",
    );
  });
});

// ---------------------------------------------------------------------------
// W52 / 338-5 (Product) — the emitted tree must wire every declared dependency
// and its README must name the files it actually writes (the "no fake, properly
// wired" standard). The webapp declares `@tailwindcss/vite` + `tailwindcss` but
// the emitted config never loaded them and no emitted byte consumed them.
// ---------------------------------------------------------------------------
describe("W52 / 338-5 — emitted webapp wires its declared Tailwind devDeps", () => {
  it("emits src/styles.css and wires it into main.tsx + vite.config.ts", () => {
    const result = scaffoldProject(fullRun());
    const pkg = JSON.parse(bodyOf(result, "package.json")) as {
      devDependencies: Record<string, string>;
    };
    // Precondition: the deps ARE declared (the thing the wiring must match).
    assert.ok(pkg.devDependencies["@tailwindcss/vite"], "@tailwindcss/vite declared");
    assert.ok(pkg.devDependencies.tailwindcss, "tailwindcss declared");

    const css = bodyOf(result, "src/styles.css");
    assert.ok(css.includes('@import "tailwindcss";'), "styles.css is the Tailwind v4 CSS entry");
    assert.ok(css.includes("@layer base"), "styles.css carries a base layer for the unclassed shell markup");

    const main = bodyOf(result, "src/main.tsx");
    assert.ok(main.includes('import "./styles.css";'), "the browser entry imports the stylesheet");

    const vite = bodyOf(result, "vite.config.ts");
    assert.ok(vite.includes('from "@tailwindcss/vite"'), "vite.config imports the tailwind plugin");
    assert.ok(vite.includes("tailwindcss()"), "vite.config registers tailwindcss()");
    assert.ok(vite.includes("react()"), "the react plugin stays wired");

    // Declare-or-strike: the shipped README tables every emitted file.
    assert.ok(bodyOf(result, "README.md").includes("src/styles.css"), "README tables the stylesheet");
  });

  it("a game tree (no tailwind devDeps) gets no stylesheet and a plugin-free vite config", () => {
    const result = scaffoldProject(fullRun({ kind: "game" }));
    const pkg = JSON.parse(bodyOf(result, "package.json")) as {
      devDependencies: Record<string, string>;
    };
    assert.equal(pkg.devDependencies.tailwindcss, undefined, "game declares no tailwind");
    const paths = okFiles(result).map((f) => f.path);
    assert.ok(!paths.includes("src/styles.css"), "no stylesheet on a kind that declares no tailwind");
    const vite = bodyOf(result, "vite.config.ts");
    assert.ok(!vite.includes("tailwindcss"), "no tailwind plugin where nothing declares it");
  });

  it("never injects project text into the stylesheet (escaped, deterministic, no secret)", () => {
    const hostile = scaffoldProject(
      fullRun({ name: "A/B <script>alert(1)</script>", brief: "x".repeat(400) }),
    );
    const css = bodyOf(hostile, "src/styles.css");
    assert.ok(!css.includes("<script>"), "no project text reaches the CSS");
    assert.ok(!css.includes("A/B"), "the hostile name never appears in the stylesheet");
    // Byte-stable + project-independent: two different projects yield identical bytes.
    assert.equal(bodyOf(scaffoldProject(fullRun()), "src/styles.css"), css, "project-independent bytes");
    assert.equal(bodyOf(scaffoldProject(fullRun()), "src/styles.css"), bodyOf(scaffoldProject(fullRun()), "src/styles.css"), "same project in ⇒ identical stylesheet out");
  });
});

describe("W52 / 338-5 — the emitted README names the files it actually writes", () => {
  it("webapp tables the real browser entry (src/main.tsx), never the nonexistent `src/main`", () => {
    const result = scaffoldProject(fullRun());
    const readme = bodyOf(result, "README.md");
    assert.ok(readme.includes("`src/main.tsx`"), "the real emitted entry path is tabled");
    assert.ok(!readme.includes("`src/main`"), "the old stem that names no file is gone");
  });

  it("game tables src/main.ts and does not describe its vite config as webapp-only", () => {
    const result = scaffoldProject(fullRun({ kind: "game" }));
    const readme = bodyOf(result, "README.md");
    assert.ok(readme.includes("`src/main.ts`"), "the game entry path is tabled");
    assert.ok(!readme.includes("emitted for webapp"), "a game tree does not call its vite config webapp-only");
  });

  it("cli-tool tables its declared src/main.ts entry and its bin launcher", () => {
    const p = fullRun({ kind: "tool" });
    const result = scaffoldProject(p);
    const readme = bodyOf(result, "README.md");
    assert.ok(readme.includes("`src/main.ts`"), "the declared main is tabled");
    assert.ok(readme.includes(`bin/${slugName(p.name)}.mjs`), "the bin launcher is tabled");
  });

  it("library and service table their declared src/main.ts entry", () => {
    const lib = scaffoldProject(primed({ brief: "TypeScript SDK package exposing a typed client" }));
    assert.ok(bodyOf(lib, "README.md").includes("`src/main.ts`"), "library entry tabled");
    const svc = scaffoldProject(primed({ brief: "Webhook worker API for billing" }));
    assert.ok(bodyOf(svc, "README.md").includes("`src/main.ts`"), "service entry tabled");
  });
});

// ---------------------------------------------------------------------------
// W52 / 338-5 — the game spec-graph ui node is emitted at `src/ui/console.tsx`
// (plain-TS canvas shell, no JSX) and the game `src/main.ts` imports it
// extensionless. With NO `jsx` setting, `tsc --noEmit` refuses to resolve a
// `.tsx` module (TS6142) and the game's DECLARED `npm run typecheck` fails on a
// clean emitted tree. Proven with the repo's own tsc over the emitted tree.
// ---------------------------------------------------------------------------
describe("W52 / 338-5 — game tsconfig resolves the emitted .tsx ui node", () => {
  it("sets `jsx` (no React smuggled in) so the declared `tsc --noEmit` passes", () => {
    const result = scaffoldProject(fullRun({ kind: "game" }));
    const cfg = JSON.parse(bodyOf(result, "tsconfig.json")) as {
      compilerOptions: Record<string, unknown>;
    };
    assert.equal(
      typeof cfg.compilerOptions.jsx,
      "string",
      "game tsconfig must set jsx or tsc fails to resolve the emitted src/ui/console.tsx (TS6142)",
    );
    // The fix must not smuggle React into a kind that declares none.
    const pkg = JSON.parse(bodyOf(result, "package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    assert.equal(pkg.devDependencies?.react, undefined, "game still declares no react plugin/dep");
    assert.equal(pkg.dependencies?.react, undefined);
    assert.ok(
      okFiles(result).map((f) => f.path).includes("src/ui/console.tsx"),
      "premise: the game shell really is a .tsx the entry imports",
    );
    // webapp keeps its runtime JSX transform.
    const web = JSON.parse(bodyOf(scaffoldProject(fullRun()), "tsconfig.json")) as {
      compilerOptions: Record<string, unknown>;
    };
    assert.equal(web.compilerOptions.jsx, "react-jsx");
  });
});

// ---------------------------------------------------------------------------
// 340-6 (A3-f07 / W-14) — the DEFAULT emitted-UI generator.
//
// Pre-fix the default webapp shell rendered a name-dump (`generated exports
// (N): …`) behind an open A3-f07 marker. These pins hold the replacement to
// the W-14 bar: ≥2 real domain fields + ≥1 interaction bound to a GENUINELY
// exported function, byte-deterministic, parseable, and honest (never
// fabricated) when there is nothing real to bind.
// ---------------------------------------------------------------------------
describe("A3-f07 / W-14 — default emitted-UI generator (real fields + interaction)", () => {
  /** The emitted entry module the shell's `generated` namespace actually imports. */
  function importedEntryBody(result: ScaffoldResult, uiPath: string, uiBody: string): string {
    const m = uiBody.match(/import \* as generated from "([^"]+)";/);
    assert.ok(m, "the real UI carries the generated-entry import");
    const parts = uiPath.split("/");
    parts.pop();
    for (const seg of m![1]!.split("/")) {
      if (seg === ".") continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    return bodyOf(result, parts.join("/"));
  }

  /** Syntax-only parse pin (typescript transpileModule), mirroring compile-check.server. */
  function assertParsesTsx(label: string, source: string): void {
    const out = ts.transpileModule(source, {
      fileName: "console.tsx",
      reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    });
    const diags = (out.diagnostics ?? []).filter((d) => d.category !== ts.DiagnosticCategory.Message);
    assert.equal(
      diags.length,
      0,
      `${label}: emitted UI must parse — ${diags
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
        .join("; ")}`,
    );
  }

  const recordedSpec = (typeSignatures: string[]): NonNullable<Project["implementationSpec"]> => ({
    requirements: ["Record and dispatch service jobs"],
    edgeCases: ["unknown customer"],
    errorHandling: ["reject a missing id"],
    typeSignatures,
    dataFlow: ["customer -> request -> dispatch"],
    negativeConstraints: ["never dispatch an anonymous request"],
    source: "prompt-verb",
    briefHash: "h-3406",
    createdAt: 0,
  });

  it("binds ≥2 spec-derived fields + an interaction to a real generated export", () => {
    const sig =
      "createRequest(customerId: string, priority: number): { customerId: string; priority: number }";
    const p: Project = {
      ...primed(),
      implementationSpec: recordedSpec([sig]),
      generatedSource:
        "export function createRequest(customerId: string, priority: number): { customerId: string; priority: number } {\n" +
        "  return { customerId, priority };\n" +
        "}\n",
    };
    const result = scaffoldProject(p);
    const ui = bodyOf(result, "src/ui/console.tsx");

    // ≥2 REAL fields, derived from the recorded spec's parameters.
    for (const field of ["customerId", "priority"]) {
      assert.ok(sig.includes(field), `premise: ${field} is a recorded spec parameter`);
      assert.ok(ui.includes(`name="${field}"`), `UI input bound to the real field ${field}`);
      assert.ok(ui.includes(`htmlFor="rt-${field}"`), `UI label bound to ${field}`);
    }
    // ≥1 REAL interaction calling a name the generated module really exports.
    assert.ok(ui.includes("onSubmit={onSubmit}"), "a real form handler is wired");
    assert.ok(/generated\.createRequest\(/.test(ui), "the handler calls the generated export");
    const entry = importedEntryBody(result, "src/ui/console.tsx", ui);
    assert.ok(
      /export\s+(?:async\s+)?function\s+createRequest\b/.test(entry),
      "the called name is a genuine export of the emitted entry module",
    );
    // No fabricated field can sneak in: every input name maps to a recorded value.
    for (const m of ui.matchAll(/name="([^"]+)"/g)) {
      assert.ok(sig.includes(m[1]!), `emitted input ${m[1]} maps to a recorded spec value`);
    }
    assertParsesTsx("spec-derived UI", ui);
  });

  it("the real engine fixture binds the generated function's own fields (no name-dump)", () => {
    const result = scaffoldProject(fullRun());
    const ui = bodyOf(result, "src/ui/console.tsx");
    assert.ok(!ui.includes("generated exports ("), "the name-dump is gone");
    assert.ok(/generated\.synthesize\(/.test(ui), "the handler calls the real generated export");
    const inputs = [...ui.matchAll(/name="([^"]+)"/g)].map((m) => m[1]!);
    assert.ok(inputs.length >= 2, `≥2 domain inputs (got ${inputs.length})`);
    assert.ok(
      inputs.includes("name") && inputs.includes("job"),
      "fields are the generated function's own parameter keys",
    );
    const entry = importedEntryBody(result, "src/ui/console.tsx", ui);
    for (const m of ui.matchAll(/generated\.([A-Za-z_$][A-Za-z0-9_$]*)\(/g)) {
      assert.ok(
        new RegExp(
          `export\\s*\\{[^}]*\\b${m[1]}\\b|export\\s+(?:async\\s+)?function\\s+${m[1]}\\b`,
        ).test(entry),
        `called name ${m[1]} is exported by the emitted entry`,
      );
    }
    assertParsesTsx("fixture UI", ui);
  });

  it("tree mode binds the tree ENTRY module's real exports too", () => {
    const p: Project = {
      ...primed(),
      implementationSpec: recordedSpec([
        "planRoute(origin: string, destination: string): { origin: string; destination: string }",
      ]),
      generatedSource: "",
      generatedTree: [
        {
          path: "src/jobs/plan.ts",
          source: "export function planRoute(origin: string, destination: string) {\n  return { origin, destination };\n}\n",
          hash: "h-plan",
          attempt: 0,
        },
      ],
    };
    const result = scaffoldProject(p);
    const ui = bodyOf(result, "src/ui/console.tsx");
    assert.ok(/import \* as generated from "\.\.\/jobs\/plan\.ts";/.test(ui), "imports the computed tree entry");
    assert.ok(/generated\.planRoute\(/.test(ui), "calls the tree entry's real export");
    for (const field of ["origin", "destination"]) {
      assert.ok(ui.includes(`name="${field}"`), `input bound to the tree field ${field}`);
    }
    const entry = importedEntryBody(result, "src/ui/console.tsx", ui);
    assert.ok(/export function planRoute\b/.test(entry), "the called name is exported by the tree entry");
    assertParsesTsx("tree UI", ui);
  });

  it("341-1: follows the codegen entry BARREL's `export *` re-exports (the real chunked-tree shape)", () => {
    // The keyed chunked synthesis materialises its entry as an ESM barrel of
    // `export * from "./x.ts"` lines (codegen.materializeImportableTree), so the
    // callables the shell can call are NOT declared in the barrel's own bytes.
    // A generator that scans only the entry file emits its honest (but
    // under-delivering) "no callable" panel for the exact shape the keyed tree
    // produces. RED before the fix.
    const p: Project = {
      ...primed(),
      generatedSource: "",
      generatedTree: [
        { path: "src/generated.ts", source: 'export * from "./jobs/plan.ts";\n', hash: "h-barrel", attempt: 0 },
        {
          path: "src/jobs/plan.ts",
          source: "export function planRoute(origin: string, destination: string) {\n  return { origin, destination };\n}\n",
          hash: "h-plan",
          attempt: 0,
        },
      ],
    };
    const result = scaffoldProject(p);
    const ui = bodyOf(result, "src/ui/console.tsx");
    assert.ok(/import \* as generated from "\.\.\/generated\.ts";/.test(ui), "imports the barrel entry");
    assert.ok(/generated\.planRoute\(/.test(ui), "calls a name the barrel genuinely re-exports");
    for (const field of ["origin", "destination"]) {
      assert.ok(ui.includes(`name="${field}"`), `input bound to the re-exported field ${field}`);
    }
    // The called name must still be a genuine export of the imported entry: the
    // barrel's own `export *` line plus the re-exported file's real declaration.
    const entry = importedEntryBody(result, "src/ui/console.tsx", ui);
    assert.ok(/export\s+\*\s+from\s+"\.\/jobs\/plan\.ts"/.test(entry), "entry is the barrel");
    assertParsesTsx("barrel UI", ui);
  });

  it("341-1: the documented field cap holds on every shape (a 6-param callable renders ≤4 inputs)", () => {
    // uiDomainFields' doc claims "deduped and capped"; the pre-fix positional and
    // object-literal branches returned the full list, so only the spec/contract/
    // lattice fallback was capped. RED before the fix (6 inputs), GREEN after (4).
    const p: Project = {
      ...primed(),
      implementationSpec: null,
      generatedSource:
        "export function wide(a: string, b: string, c: string, d: string, e: string, f: string): void {\n" +
        "  void [a, b, c, d, e, f];\n" +
        "}\n",
    };
    const ui = bodyOf(scaffoldProject(p), "src/ui/console.tsx");
    const inputs = [...ui.matchAll(/<input id="rt-[^"]+" name="([^"]+)"/g)].map((m) => m[1]!);
    assert.equal(inputs.length, 4, `the documented cap bounds the form (got ${inputs.length}: ${inputs.join(",")})`);
    assert.deepEqual(inputs, ["a", "b", "c", "d"], "the first four real params are the ones bound");
    assertParsesTsx("capped UI", ui);
  });

  it("341-1: never binds a form to a callable whose param a form cannot supply", () => {
    // The webapp shell is emitted for a webapp brief; a generated export taking
    // a domain object (Board) cannot be fed by FormData strings. The pre-fix
    // generator emitted `generated.createBoard(String(...), String(...))` — a
    // TS2345 the pre-seal typecheck gate then refused with no repairable chunk.
    const p: Project = {
      ...primed(),
      generatedSource:
        "interface Board { id: string; title: string }\n" +
        "export function createBoard(name: string, board: Board): void {\n  void name;\n  void board;\n}\n",
    };
    const ui = bodyOf(scaffoldProject(p), "src/ui/console.tsx");
    assert.ok(!/generated\.createBoard\(/.test(ui), "no fabricated call with a String(...) board arg");
    assert.ok(!ui.includes("<input") && !ui.includes("onSubmit="), "no form bound to an unbindable callable");
    assert.match(ui, /cannot supply|nothing to wire/, "the honest panel states why");
    assertParsesTsx("unbindable UI", ui);
  });

  it("no generated module ⇒ the honest no-module panel (nothing fabricated)", () => {
    const ui = bodyOf(scaffoldProject(primed()), "src/ui/console.tsx");
    assert.ok(ui.includes("no generated module yet"), "the honest no-module notice survives");
    assert.ok(!ui.includes("<input"), "no fabricated input without a generated module");
    assert.ok(!ui.includes("onSubmit="), "no fabricated interaction without a generated module");
  });

  it("a generated module with nothing bindable ⇒ honest panel, never a fake call", () => {
    const graph: SpecGraph = {
      nodes: [
        { id: "ui", file: "src/ui/console.tsx", purpose: "Operator surfaces", dependsOn: [], owner: "implementer" },
        { id: "job-0", file: "src/jobs/main.ts", purpose: 'Implement job "main" against the contract', dependsOn: [], owner: "implementer" },
      ],
      order: ["ui", "job-0"],
    };
    const base: Project = {
      ...seedProject({ name: "Bare" }),
      lattice: null,
      contracts: null,
      implementationSpec: null,
      specGraph: graph,
    };
    // Module exists but exports no callable.
    const noCallable = scaffoldProject({ ...base, generatedSource: 'export const VERSION = "1.0.0";\n' });
    const ui1 = bodyOf(noCallable, "src/ui/console.tsx");
    assert.match(ui1, /exports no callable/, "states the module exports no callable function");
    assert.ok(!/<input|onSubmit=/.test(ui1), "no fabricated interaction without a callable");
    // Callable exists but the project records no real domain fields.
    const noFields = scaffoldProject({
      ...base,
      generatedSource: 'export function ping(): string { return "pong"; }\n',
    });
    const ui2 = bodyOf(noFields, "src/ui/console.tsx");
    assert.match(ui2, /fewer than two bindable domain fields/, "names the missing real fields");
    assert.ok(!/generated\.ping\(/.test(ui2), "never calls a function it cannot bind fields to");
    assert.ok(!/<input|onSubmit=/.test(ui2), "no fabricated form without real fields");
  });

  it("is byte-deterministic across two builds (UI included)", () => {
    const p: Project = {
      ...primed(),
      implementationSpec: recordedSpec(["createRequest(customerId: string, priority: number): void"]),
      generatedSource:
        "export function createRequest(customerId: string, priority: number): void {\n  void customerId;\n  void priority;\n}\n",
    };
    const a = scaffoldProject(p);
    const b = scaffoldProject(p);
    assert.deepEqual(a, b, "same project ⇒ byte-identical emission");
    assert.equal(bodyOf(a, "src/ui/console.tsx"), bodyOf(b, "src/ui/console.tsx"));
  });

  it("the parse pin has teeth (a malformed shell is caught)", () => {
    const out = ts.transpileModule("export function Console() { return (<main>}", {
      fileName: "console.tsx",
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
    });
    assert.ok((out.diagnostics ?? []).length > 0, "a malformed UI must yield a parse diagnostic");
  });

  it("a caller-supplied UiGenerationHook still overrides the default (contract intact)", () => {
    const result = scaffoldProject(fullRun(), {
      uiGeneration: () => ["  return (", "    <main>", '      <h1>{"hook"}</h1>', "    </main>", "  );"],
    });
    const ui = bodyOf(result, "src/ui/console.tsx");
    assert.ok(ui.includes('<h1>{"hook"}</h1>'), "the caller hook's lines landed");
    assert.ok(!ui.includes("onSubmit="), "the default generator did not also run");
    assert.deepEqual(result.ok ? result.uiGeneration : undefined, {
      hook: "caller",
      applied: true,
      uiPath: "src/ui/console.tsx",
    });
    // A null return keeps the (now real) default generator.
    const kept = scaffoldProject(fullRun(), { uiGeneration: () => null });
    assert.match(bodyOf(kept, "src/ui/console.tsx"), /generated\.synthesize\(/, "null keeps the default");
    assert.deepEqual(kept.ok ? kept.uiGeneration : undefined, {
      hook: "default-generator",
      applied: false,
      uiPath: "src/ui/console.tsx",
    });
  });
});

// ---------------------------------------------------------------------------
// W346 lane A - A4 brief-driven website shell pin.
// ---------------------------------------------------------------------------
describe("W346-A4 brief-driven website shell", () => {
  function parsesTsx(source: string): boolean {
    const out = ts.transpileModule(source, {
      fileName: "console.tsx",
      reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    });
    return (out.diagnostics ?? []).filter((d) => d.category !== ts.DiagnosticCategory.Message).length === 0;
  }

  it("a generated render* export yields a multi-section shell, calls it, and strips the H1 markdown", () => {
    const p: Project = {
      ...seedProject({ name: "# Wildstem Florist -", kind: "app" }),
      generatedSource: "",
      generatedTree: [
        { path: "src/generated.ts", source: 'export * from "./generated/render-home.ts";\n', hash: "h0", attempt: 0 },
        {
          path: "src/generated/render-home.ts",
          source: 'export function renderHome(): string { return "Wildstem Florist"; }\n',
          hash: "h1",
          attempt: 0,
        },
      ],
      specGraph: {
        nodes: [
          { id: "ui", file: "src/ui/console.tsx", purpose: "Operator surfaces", dependsOn: [], owner: "implementer" },
          { id: "job-order", file: "src/jobs/order.ts", purpose: 'Implement job "order" against the contract', dependsOn: [], owner: "implementer" },
          { id: "job-deliver", file: "src/jobs/deliver.ts", purpose: 'Implement job "deliver" against the contract', dependsOn: [], owner: "implementer" },
        ],
        order: ["ui", "job-order", "job-deliver"],
      },
      lattice: {
        domain: "retail",
        jobs: ["order", "deliver", "subscribe"],
        entities: ["home", "bouquet", "occasion"],
        constraints: [],
        nodes: [],
        complexity: 1,
      },
      contracts: {
        entities: [
          { name: "home", fields: [] },
          { name: "bouquet", fields: [] },
          { name: "occasion", fields: [] },
        ],
        endpoints: [],
      },
    };
    const ui = bodyOf(scaffoldProject(p), "src/ui/console.tsx");
    assert.ok(ui.includes("<section key={p.id}>"), "a section per page (rendered from the pages map)");
    assert.ok(
      (ui.match(/\{ id: "/g) ?? []).length >= 3,
      `at least 3 briefed pages (got ${(ui.match(/\{ id: "/g) ?? []).length})`,
    );
    assert.ok(ui.includes("<nav>"), "a nav from the page titles");
    assert.ok(/generated\.renderHome\(\)/.test(ui), "calls the real generated render export");
    assert.ok(!ui.includes("# Wildstem"), "the H1 markdown is stripped");
    assert.ok(ui.includes('{"Wildstem Florist"}'), "the H1 is the display name");
    assert.ok(!ui.includes("<canvas"), "no canvas for a website brief");
    assert.ok(parsesTsx(ui), "the emitted shell parses as TSX");
  });

  it("a render export whose args cannot be soundly supplied still yields the shell but is never called", () => {
    const p: Project = {
      ...seedProject({ name: "Badge Shop", kind: "app" }),
      generatedSource: "",
      generatedTree: [
        { path: "src/generated.ts", source: 'export * from "./generated/render-badge.ts";\n', hash: "h0", attempt: 0 },
        {
          path: "src/generated/render-badge.ts",
          source: 'export function renderBadge(changes: { id: string }): string { return changes.id; }\n',
          hash: "h1",
          attempt: 0,
        },
      ],
      specGraph: {
        nodes: [{ id: "ui", file: "src/ui/console.tsx", purpose: "Operator surfaces", dependsOn: [], owner: "implementer" }],
        order: ["ui"],
      },
      lattice: { domain: "retail", jobs: [], entities: ["badge"], constraints: [], nodes: [], complexity: 1 },
      contracts: { entities: [{ name: "badge", fields: [] }], endpoints: [] },
    };
    const ui = bodyOf(scaffoldProject(p), "src/ui/console.tsx");
    assert.ok(ui.includes("<section key={p.id}>"), "the multi-section shell is used");
    assert.ok(!/generated\.renderBadge\(/.test(ui), "never calls a render export it cannot supply args for");
    assert.ok(parsesTsx(ui), "the emitted shell parses as TSX");
  });
});

// ---------------------------------------------------------------------------
// W346 lane A - A10 README manifest honesty (specRows filtered to disk).
// ---------------------------------------------------------------------------
describe("W346-A10 README manifest honesty", () => {
  it("a declared-but-unemitted job is NOT in 'What ships'; it is in 'Declared, NOT emitted'", () => {
    const result = scaffoldProject({
      ...fullRun(),
      generatedTree: [
        { path: "src/generated.ts", source: "export function declared() { return 2; }\n", hash: "h-ok", attempt: 0 },
      ],
    });
    const readme = bodyOf(result, "README.md");
    const declaredAt = readme.indexOf("### Declared, NOT emitted");
    const ships = readme.slice(readme.indexOf("## What ships in this scaffold"), declaredAt);
    const declared = readme.slice(declaredAt, readme.indexOf("## Phase rail"));
    assert.ok(declared.length > 0, "the declared-not-emitted sub-table renders");
    for (const label of ["dispatch", "reroute", "scan"] as const) {
      assert.ok(
        !ships.includes(`\`src/jobs/${label}.ts\``),
        `${label}.ts is NOT advertised as shipping (no file on disk)`,
      );
      assert.ok(
        declared.includes(`\`src/jobs/${label}.ts\``),
        `${label}.ts IS listed under Declared, NOT emitted`,
      );
      assert.ok(!okFiles(result).some((f) => f.path === `src/jobs/${label}.ts`), `${label}.ts is truly absent`);
    }
  });
});

// ---------------------------------------------------------------------------
// PR-28 lane S2 — C1-02 (mounted UI never calls a real generated export) and
// C1-03 (generated console.tsx references the removed global JSX namespace).
// The replay reads the read-only campaign1 / historical testruns/<slug>
// artifacts; the synthetic pin replays the EXACT campaign shape (a tree barrel
// plus a first-job file) so the defect is RED before the fix and GREEN after.
// ---------------------------------------------------------------------------
describe("PR-28 C1-02/C1-03 — the mounted shell calls a real generated export, JSX-free", () => {
  const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
  const TESTRUNS_ROOT = join(REPO_ROOT, "..", "testruns");
  const APP_SLUGS = [
    "bakery-website", "flower-shop-website", "bakery-florist-orders", "mobile-companion",
    "office-invoice-tracker", "office-scheduler", "office-stock-tracker",
  ];

  /** The one generated module the emitted webapp shell imports (`null` for a non-webapp shell). */
  function mountedImport(ui: string): { ns: string; spec: string } | null {
    const m = /import\s+\*\s+as\s+(\w+)\s+from\s+"([^"]+)"/.exec(ui);
    return m ? { ns: m[1]!, spec: m[2]! } : null;
  }

  /** Resolve a POSIX relative specifier from an emitted tree file. */
  function resolveFrom(fromFile: string, spec: string): string {
    const parts = fromFile.split("/");
    parts.pop();
    for (const seg of spec.split("/")) {
      if (seg === "." || seg === "") continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    return parts.join("/");
  }

  /** The export surface of an emitted file, following `export *` (the barrel). */
  function exportsOf(result: ScaffoldResult, path: string, seen = new Set<string>()): Set<string> {
    const out = new Set<string>();
    if (seen.has(path) || !result.ok) return out;
    seen.add(path);
    const src = result.files.find((f) => f.path === path)?.body ?? "";
    for (const m of src.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) out.add(m[1]!);
    for (const m of src.matchAll(/^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) out.add(m[1]!);
    for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
      for (const part of m[1]!.split(",")) {
        const name = (part.trim().split(/\s+as\s+/).pop() ?? "").trim();
        if (name) out.add(name);
      }
    }
    for (const m of src.matchAll(/^[ \t]*export\s+\*\s+from\s+["']([^"']+)["']/gm)) {
      for (const name of exportsOf(result, resolveFrom(path, m[1]!), seen)) out.add(name);
    }
    return out;
  }

  /** A real generated render / page export the tree ships (declared or re-exported). */
  function treeHasRenderExport(project: Project): boolean {
    return (project.generatedTree ?? []).some(
      (f) => /function\s+render[A-Z_]/.test(f.source) || /export\s*\{[^}]*\brender[A-Z_]/.test(f.source),
    );
  }

  it("C1-02 (RED before the fix): a barrel-plus-first-job-file tree wires the barrel's render export", () => {
    const p: Project = {
      ...primed(),
      generatedSource: "",
      generatedTree: [
        {
          path: "src/generated.ts",
          source: 'export * from "./generated/render-home.ts";\nexport * from "./jobs/serve.ts";\n',
          hash: "h0",
          attempt: 0,
        },
        {
          path: "src/generated/render-home.ts",
          source: "export function renderHome(viewportWidth: 360 | 430): string { return String(viewportWidth); }\n",
          hash: "h1",
          attempt: 0,
        },
        {
          path: "src/jobs/serve.ts",
          source: 'export function serveOrder(): string { return "ok"; }\n',
          hash: "h2",
          attempt: 0,
        },
      ],
      specGraph: {
        nodes: [
          { id: "ui", file: "src/ui/console.tsx", purpose: "Operator surfaces", dependsOn: [], owner: "implementer" },
          { id: "job-0", file: "src/jobs/serve.ts", purpose: 'Implement job "serve" against the contract', dependsOn: [], owner: "implementer" },
        ],
        order: ["ui", "job-0"],
      },
    };
    const ui = bodyOf(scaffoldProject(p), "src/ui/console.tsx");
    assert.match(ui, /import \* as generated from "\.\.\/generated\.ts";/, "imports the tree barrel, not the job module");
    assert.match(ui, /generated\.renderHome\(360\)/, "calls the barrel's real render export with a sound literal");
    assert.ok(!/\bJSX\s*\./.test(ui), "C1-03: no removed global JSX namespace");
    assert.match(ui, /import type \{ ReactNode \} from "react";/, "C1-03: the node type comes from react");
  });

  it("replays every recorded campaign1 + historical webapp tree (no JSX namespace; generated import is used)", () => {
    if (!existsSync(TESTRUNS_ROOT)) return; // frozen checkout with no sibling testruns
    let checked = 0;
    let wired = 0;
    for (const slug of APP_SLUGS) {
      for (const root of [join(TESTRUNS_ROOT, "campaign1", slug), join(TESTRUNS_ROOT, slug)]) {
        const file = join(root, "build.json");
        if (!existsSync(file)) continue;
        const project = JSON.parse(readFileSync(file, "utf8")) as Project;
        if (projectKindOf(project) !== "webapp") continue; // the shell under test is the webapp one
        const result = scaffoldProject(project);
        assert.ok(result.ok, `${root}: the emitter produces a tree`);
        const ui = bodyOf(result, "src/ui/console.tsx");
        assert.ok(!/\bJSX\s*\./.test(ui), `${root}: C1-03 the emitted shell never references the global JSX namespace`);
        if (ui.includes("ReactNode")) {
          assert.match(ui, /import type \{ ReactNode \} from "react";/, `${root}: ReactNode is imported from react`);
        }
        const mounted = mountedImport(ui);
        assert.ok(mounted, `${root}: the webapp shell imports its generated entry`);
        assert.ok(mounted.spec.includes("generated"), `${root}: C1-02 imports the generated barrel (got ${mounted.spec})`);
        const exports = exportsOf(result, resolveFrom("src/ui/console.tsx", mounted.spec));
        const calls = [...ui.matchAll(new RegExp(`\\b${mounted.ns}\\.([A-Za-z_$][\\w$]*)\\(`, "g"))].map((m) => m[1]!);
        for (const name of calls) {
          assert.ok(exports.has(name), `${root}: C1-02 called ${name} is a real export of the mounted module`);
        }
        if (treeHasRenderExport(project)) {
          assert.ok(calls.length > 0, `${root}: C1-02 a render export exists ⇒ the shell calls a real export`);
          wired += 1;
        }
        checked += 1;
      }
    }
    assert.ok(checked > 0, "the campaign/historical webapp fixtures resolved");
    assert.ok(wired >= 3, `C1-02: the render-bearing trees are wired (got ${wired})`);
  });
});


// ---------------------------------------------------------------------------
// R2-04 (P1) � a below-floor PARTIAL is refused, not emitted. The C1-01 floor
// refusal is already recorded on the project's trail (RT_E_PLAN_UNDERPRODUCED);
// the scaffold honors it so a 2�3-file runnable-looking tree is never written.
// R2-05 (P1) � a skip-dominated oracle is never presented as test evidence.
// ---------------------------------------------------------------------------
describe("R2-04 � the scaffold refuses a below-floor partial (BF-1)", () => {
  const C2_ROOT = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), "..", "testruns", "campaign2");

  /** A primed project carrying a recorded under-production refusal + substance. */
  function underProduced(over: Partial<Project> = {}): Project {
    const base = primed();
    return {
      ...base,
      generatedSource: "export const probe = 1;\n",
      generatedTree: [{ path: "src/generated/probe.ts", source: "export const probe = 1;\n", hash: "h", attempt: 0 }],
      ...over,
      logs: [
        ...(base.logs ?? []),
        {
          ts: 1,
          phase: 6,
          level: "warn",
          event: "p6.synthesis.refused",
          detail:
            "RT_E_PLAN_UNDERPRODUCED � chunk 2/8 refused � accepted tree has 1 module(s) but the brief demands >= 8 � the plan is under-produced; missing module(s): src/jobs/show.ts (job:show)",
        },
        ...(over.logs ?? []),
      ],
    };
  }

  it("underProductionRefusalOf: present only while the FINAL synthesis verdict is a refusal", () => {
    assert.ok(underProductionRefusalOf(underProduced()) !== null, "an under-produced final verdict is detected");
    const superseded = underProduced({
      logs: [{ ts: 2, phase: 6, level: "info", event: "p6.synthesis", detail: "Chunked synthesis: 9 file(s) in 8 chunk(s)" }],
    });
    assert.equal(underProductionRefusalOf(superseded), null, "a later p6.synthesis success clears the refusal (flower-shop/scheduler)");
    assert.equal(underProductionRefusalOf(primed()), null, "no refusal row ? no under-production verdict");
    // No substance ? nothing runnable to refuse.
    assert.equal(underProductionRefusalOf({ ...underProduced(), generatedTree: [], generatedSource: "" }), null);
  });

  it("scaffoldProject refuses the below-floor partial, naming RT_E_PLAN_UNDERPRODUCED", () => {
    const result = scaffoldProject(underProduced());
    assert.ok(!result.ok, "a below-floor partial is refused, not emitted");
    if (!result.ok) {
      assert.match(result.error, /RT_E_PLAN_UNDERPRODUCED/);
      assert.match(result.error, /under-produced|below-floor/);
      assert.equal(result.code, "RT_E_PLAN_UNDERPRODUCED", "the coded refusal rides the result interface");
    }
    // Control: the same project after a success verdict emits normally.
    const superseded = underProduced({
      logs: [{ ts: 2, phase: 6, level: "info", event: "p6.synthesis", detail: "Chunked synthesis: 9 file(s) in 8 chunk(s)" }],
    });
    assert.ok(scaffoldProject(superseded).ok, "a superseded refusal does not block the emission");
  });

  it("INTERNAL candidate emits opt out — the pre-seal self-typecheck still materializes the partial", () => {
    // The pre-seal gate (codegen.defaultTreeTypecheck) passes allowUnderProduced
    // so a multi-cycle repair can still run the candidate's REAL tsc; without
    // the opt-out every repair cycle would be preempted by the ship-time guard.
    const r = scaffoldProject(underProduced(), { allowUnderProduced: true });
    assert.ok(r.ok, "allowUnderProduced materializes the candidate for its tsc verdict");
  });

  it("replay: the recorded campaign2 below-floor trees refuse; the at-floor trees still emit", () => {
    if (!existsSync(C2_ROOT)) return; // frozen checkout with no sibling testruns
    const belowFloor = ["bakery-website", "bakery-florist-orders", "mobile-companion", "office-invoice-tracker", "office-stock-tracker", "held-out-community-tool-library"];
    const atFloor = ["flower-shop-website", "office-scheduler"];
    let refused = 0;
    let emitted = 0;
    for (const slug of [...belowFloor, ...atFloor]) {
      const file = join(C2_ROOT, slug, "build.json");
      if (!existsSync(file)) continue;
      const project = JSON.parse(readFileSync(file, "utf8")) as Project;
      const under = underProductionRefusalOf(project);
      if (belowFloor.includes(slug)) {
        assert.ok(under !== null, `${slug}: the below-floor partial carries a final under-production refusal`);
        const r = scaffoldProject(project);
        assert.ok(!r.ok, `${slug}: the scaffold REFUSES the below-floor partial (no runnable-looking tree)`);
        if (!r.ok) {
          assert.match(r.error, /RT_E_PLAN_UNDERPRODUCED/);
          assert.equal(r.code, "RT_E_PLAN_UNDERPRODUCED", `${slug}: the refusal carries its registered code`);
        }
        refused += 1;
      } else {
        assert.equal(under, null, `${slug}: an at-floor tree (a later p6.synthesis success) is not under-produced`);
        assert.ok(scaffoldProject(project).ok, `${slug}: the at-floor tree still emits`);
        emitted += 1;
      }
    }
    assert.ok(refused >= 5, `R2-04: the recorded below-floor class is refused (got ${refused})`);
    assert.ok(emitted >= 2, `R2-04 control: the at-floor trees still emit (got ${emitted})`);
  });
});

describe("R2-05 � no skip-dominated oracle is emitted as evidence", () => {
  /** A project every oracle row has NO emitted surface for (job/api/host all absent). */
  function noSurface(): Project {
    return {
      ...seedProject({ kind: "app" }),
      specGraph: { nodes: [], order: [] },
      contracts: { entities: [], endpoints: [] },
      lattice: { domain: "x", jobs: [], entities: [], constraints: [], nodes: [], complexity: 1 },
      generatedTree: [],
      generatedSource: "",
    };
  }

  it("a skip-dominated oracle emits REAL failing tests � zero skips", () => {
    const result = scaffoldProject(noSurface());
    const spec = bodyOf(result, "tests/oracle.spec.ts");
    const skips = spec.split("\n").filter((l) => l.trimStart().startsWith("test.skip("));
    assert.equal(skips.length, 0, "R2-05: a skip-dominated oracle emits no skip at all");
    const live = spec.split("\n").filter((l) => /^\s*test\(/.test(l));
    assert.ok(live.length > 0, "R2-05: the NOT IMPLEMENTED rows land as real tests");
    assert.ok(spec.includes("assert.fail("), "R2-05: and they fail loudly � an honest red, never a green skip wall");
    assert.ok(
      spec.includes("R2-05: this oracle IS skip-dominated"),
      "the emitted spec states why the rows are failing, not skipped",
    );
  });

  it("control: a non-dominated (mixed) oracle keeps its visible skip", () => {
    const spec = bodyOf(scaffoldProject(primed()), "tests/oracle.spec.ts");
    const skips = spec.split("\n").filter((l) => l.trimStart().startsWith("test.skip("));
    assert.ok(skips.length > 0, "a mixed oracle still marks its NOT IMPLEMENTED row with a skip");
    assert.ok(
      skips.every((l) => l.includes("NOT IMPLEMENTED")),
      "every remaining skip is visibly marked",
    );
  });
});
