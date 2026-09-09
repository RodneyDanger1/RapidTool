// ---------------------------------------------------------------------------
// scaffold.test.ts — E-15 scaffold emitter + E-27 shipped-artifact notes
// (src/lib/scaffold.ts). Pure, deterministic, no disk writes.
// Run: node --experimental-strip-types --test src/lib/scaffold.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { exportProjectJson, slugName } from "./io.ts";
import { ALL_PHASES, runHeadless, seedProject } from "./testing/fixtures.ts";
import type { Project, SpecGraph } from "./types.ts";
import { DEPLOY_HONESTY_STAMP, deplyNotes, projectKindOf, scaffoldProject } from "./scaffold.ts";
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
    assert.ok(ui.includes("useState"), "React shell expected for app kind");
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
    assert.ok((result as { ok: true; summary: string }).summary.startsWith("9 files"));
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
    // sibling job nodes stay honest TODO stubs naming their oracle expectations
    const job1 = p.specGraph!.nodes.find((n) => n.id === "job-1");
    if (job1) {
      const stub = bodyOf(result, job1.file);
      assert.ok(stub.includes("TODO(E-15) stub"), "job stub carries the canonical marker");
      assert.ok(stub.includes("# orc-"), "job stub names oracle expectations");
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
    const throwMsg = routesBody.match(/throw new Error\(`([^`]+)`\)/)?.[1];
    assert.ok(throwMsg, "emitted route() must reject via a template-literal Error");
    const simulated = throwMsg!
      .replace("${method}", "GET")
      .replace("${path}", "/v1/example");
    assert.match(
      simulated,
      /TODO\(E-15\) stub/,
      "simulated route() rejection (runtime interpolation) matches the oracle reject-regex",
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
    const testLines = spec.split("\n").filter((l) => l.trimStart().startsWith("test("));
    assert.equal(testLines.length, 2);
    assert.ok(!spec.includes("line1\n"), "newline inside oracle prose was collapsed");
    const stub = bodyOf(result, "src/generated/job-0.ts");
    assert.ok(stub.includes("drop table; --"), "job label survives as prose");
    assert.ok(!stub.includes("line1\n"), "comment inserts are single-line");
    const readme = bodyOf(result, "README.md");
    assert.ok(!readme.includes("alert(1)</script>\n"), "name newline collapsed in markdown too");
  });
});

describe("scaffoldProject + deplyNotes — no secrets, honest local-only framing", () => {
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
    const notes = deplyNotes(p);
    for (const secret of ["sk-live-ABCDEF0123456789", "AKIAIOSFODNN7EXAMPLE", "hunter2"]) {
      assert.ok(!notes.includes(secret), `DEPLOY.md leaked ${secret}`);
    }
  });

  it("carries the E-27 honesty stamp and human-gated, local-only deploy framing", () => {
    const p = fullRun(); // P9/P12 recorded: GitHub Actions workflow + IaC sketch + ADR + OpenAPI
    const notes = deplyNotes(p);
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
    const game = deplyNotes(fullRun({ kind: "game" }));
    assert.ok(game.includes("assets/manifest.json"), "game notes name the manifest");
    assert.ok(game.includes("itch.io"), "game kind destination hint present");
    const web = deplyNotes(fullRun({ kind: "app" }));
    assert.ok(web.includes("preview channels"), "webapp destination hint present");
    assert.ok(!web.includes("itch.io"));
  });

  it("notes honestly when no P9/P12 templates exist yet", () => {
    const notes = deplyNotes(seedProject());
    assert.ok(notes.includes("_None yet"), "empty-template note");
    assert.ok(!notes.includes("GitHub Actions workflow"));
  });
});

describe("deplyNotes — run/test/env/deploy steps exist and are executable-sounding", () => {
  it("lists real commands matching the emitted skeleton", () => {
    const p = fullRun({ kind: "tool" });
    const notes = deplyNotes(p);
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

  it("scaffoldProject's DEPLOY.md file is exactly deplyNotes output", () => {
    const p = fullRun();
    const result = scaffoldProject(p);
    assert.equal(bodyOf(result, "DEPLOY.md"), deplyNotes(p));
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
