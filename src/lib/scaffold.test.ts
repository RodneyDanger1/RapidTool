// ---------------------------------------------------------------------------
// scaffold.test.ts — E-15 scaffold emitter + E-27 shipped-artifact notes
// (src/lib/scaffold.ts). Pure, deterministic, no disk writes.
// Run: node --experimental-strip-types --test src/lib/scaffold.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { exportProjectJson, slugName } from "./io.ts";
import { inventoryFromJobSources } from "./doctor.ts";
import { ALL_PHASES, runHeadless, seedProject } from "./testing/fixtures.ts";
import type { Project, SpecGraph } from "./types.ts";
import { DEPLOY_HONESTY_STAMP, deployNotes, deplyNotes, projectKindOf, scaffoldProject } from "./scaffold.ts";
import type { ScaffoldFile, ScaffoldResult } from "./scaffold.ts";

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

  it("gives a tool kind a tsx/node:test package.json and a non-React console shell", () => {
    const p = fullRun({ kind: "tool" });
    const result = scaffoldProject(p);
    const pkg = JSON.parse(bodyOf(result, "package.json")) as Record<string, any>;
    assert.ok(pkg.devDependencies.tsx, "tsx expected for tool kind");
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
    ]);
    const pkg = JSON.parse(bodyOf(result, "package.json")) as Record<string, any>;
    assert.equal(pkg.scripts.test, undefined, "no test script when there is no oracle spec");
    assert.ok(
      files.every((f) => !f.path.startsWith("src/") || f.path === "src/main.tsx"),
      "only the boot-shell src entry without a spec graph",
    );
    // fixes/217f (T4.2): the .gitignore joined the emitted file set — the count
    // moves with it. old → new: "9 files" → "10 files".
    assert.ok((result as { ok: true; summary: string }).summary.startsWith("10 files"));
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
    expect: { kind: "shape" as const, value: { id: "<draft>" } },
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
// W48 / 334-3 (T1a) — the emitted README must say the DECLARED scripts never
// ran. A fresh emitted tree's own tree-run reports `declaredScriptsVerified:
// false` + `unverifiedDeclaredScripts: ["typecheck","build"]`; without a banner
// the README could present that tree as complete. Same unmissable style as
// headless's red-tree banner.
// ---------------------------------------------------------------------------
describe("W48 / 334-3 (T1a) — declared-scripts-unverified README banner", () => {
  it("the emitted README LEADS with the banner and names the declared typecheck + build as unverified", () => {
    const p = fullRun({ kind: "app" });
    const readme = bodyOf(scaffoldProject(p), "README.md");
    assert.ok(readme.startsWith("> [!WARNING]\n"), "the banner heads the README (unmissable, like the red-tree banner)");
    assert.match(readme, /DECLARED SCRIPTS NOT RUN/);
    assert.match(readme, /`typecheck` and `build`/);
    assert.match(readme, /UNVERIFIED/);
    assert.match(readme, /declaredScriptsVerified: false/);
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
