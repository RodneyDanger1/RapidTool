// ---------------------------------------------------------------------------
// emitted-honesty.test.ts — fixes/247 (W17 LANE 4): the emitted-artifact
// honesty trio, pinned against the real emitters (pure, offline, no disk).
//
//   * G5    — every emitted failure path carries a REGISTERED RT_E code
//             (scaffold.ts: stub rejections + entry boot guards + the emitted
//             oracle spec's coded rejection regex). 216y §2.3 G5.
//   * DF-04 — the P7 artifact's MCP/A2A line is a labeled roadmap declaration,
//             never a shipped-capability claim (engine.ts).
//   * TA-21 — the P9 deploy artifacts (GH-Actions YAML + IaC sketch) carry a
//             "template — not executed" marker as their first line.
//
// Run: node --experimental-strip-types --test src/lib/emitted-honesty.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ERROR_CODES } from "./errors.ts";
import { ALL_PHASES, runHeadless, seedProject } from "./testing/fixtures.ts";
import { scaffoldProject } from "./scaffold.ts";
import type { ScaffoldFile, ScaffoldResult } from "./scaffold.ts";
import type { Project } from "./types.ts";

/** A fully engine-run project (real lattice, spec graph, contracts, oracle, artifacts). */
const fullRun = (over: Partial<Project> = {}) => runHeadless(seedProject(over), ALL_PHASES);

/** P0-primed project: lattice + specGraph + contracts + oracle, no generated code. */
const primed = (over: Partial<Project> = {}) => runHeadless(seedProject(over), [0]);

function okFiles(result: ScaffoldResult): ScaffoldFile[] {
  assert.ok(result.ok, `expected ok: ${!result.ok ? result.error : ""}`);
  return (result as { ok: true; files: ScaffoldFile[] }).files;
}

describe("G5 — emitted failure paths carry a registered RT_E code (fixes/247)", () => {
  it("the emitted refusal code is registered in errors.ts (I13 — never an invented id)", () => {
    assert.ok(
      (ERROR_CODES as readonly string[]).includes("RT_E_VALIDATION"),
      "RT_E_VALIDATION must stay a registered code",
    );
  });

  it("every TODO(E-15) stub throw in every kind flavor carries `<code> · `", () => {
    const variants: Project[] = [
      fullRun(), // webapp: route() + job stubs
      fullRun({ kind: "tool" }), // cli-tool: console entry throw
      fullRun({ kind: "game" }), // game flavor
      primed({ brief: "Webhook worker API for billing" }), // service entry throw
      primed({ brief: "TypeScript SDK package exposing a typed client" }), // library flavor
    ];
    let sawRouteThrow = false;
    let sawJobThrow = false;
    let sawEntryThrow = false;
    for (const p of variants) {
      const files = okFiles(scaffoldProject(p));
      for (const f of files) {
        for (const line of f.body.split("\n")) {
          if (!/throw\s+new\s+Error/.test(line) || !/TODO\(E-15\)/.test(line)) continue;
          assert.match(
            line,
            /RT_E_VALIDATION · /,
            `${f.path}: stub throw without the coded-refusal prefix: ${line.trim()}`,
          );
          if (/\$\{method\}/.test(line)) sawRouteThrow = true;
          if (/implement job /.test(line)) sawJobThrow = true;
          if (/implement the (service|console) entry/.test(line)) sawEntryThrow = true;
        }
      }
    }
    assert.ok(sawRouteThrow, "sweep must cover the api route() stub throw");
    assert.ok(sawJobThrow, "sweep must cover the job stub throw");
    assert.ok(sawEntryThrow, "sweep must cover the service/cli entry stub throw");
  });

  it("the emitted boot guards and the oracle spec carry the coded form", () => {
    const files = okFiles(scaffoldProject(fullRun()));
    const guards = files.filter((f) => f.body.includes("missing #root element"));
    assert.ok(guards.length > 0, "the webapp tree emits a boot guard");
    for (const g of guards) {
      assert.ok(
        g.body.includes("RT_E_VALIDATION · missing #root element"),
        `${g.path}: boot guard without the coded prefix`,
      );
    }
    const spec = files.find((f) => f.path === "tests/oracle.spec.ts");
    assert.ok(spec, "oracle spec emitted");
    assert.ok(
      spec!.body.includes("/RT_E_VALIDATION · TODO\\(E-15\\) stub/"),
      "the emitted spec pins the coded rejection regex",
    );
    // The spec must not pin the pre-code form alone (it would pass on text-only
    // failures again the moment the emitted throw loses its code).
    assert.ok(
      !spec!.body.includes("{}), /TODO\\(E-15\\) stub/);"),
      "a bare text-only rejection regex must not survive in the spec",
    );
  });
});

describe("DF-04 — the P7 MCP/A2A line is labeled, not a shipped claim (fixes/247)", () => {
  it("P7 competitive matrix: MCP/A2A rides as a roadmap declaration (B-18), not as the advantage", () => {
    const p = fullRun();
    const matrix = p.artifacts.find((a) => a.title === "Competitive analysis matrix");
    assert.ok(matrix, "P7 artifact recorded on the project");
    assert.ok(
      !matrix!.body.includes("HITL, MCP/A2A, and ADRs"),
      "MCP/A2A must not read as part of the shipped architectural advantage",
    );
    assert.ok(
      matrix!.body.includes("MCP/A2A server contracts are roadmap declarations, not runtime (B-18)"),
      "the labeled B-18 declaration line must be present",
    );
  });
});

describe("TA-21 — P9 deploy artifacts carry the 'template — not executed' marker (fixes/247)", () => {
  it("GH-Actions YAML and IaC sketch open with the marker a reader sees first", () => {
    const p = fullRun();
    const gh = p.artifacts.find((a) => a.title === "GitHub Actions workflow");
    const iac = p.artifacts.find((a) => a.title === "IaC sketch");
    assert.ok(gh, "P9 GH-Actions artifact recorded");
    assert.ok(iac, "P9 IaC artifact recorded");
    for (const a of [gh!, iac!]) {
      assert.ok(
        a.body.startsWith("# template — not executed"),
        `${a.title}: first line must be the unmissable 'template — not executed' marker`,
      );
      assert.ok(a.body.includes("(B-18)"), `${a.title}: marker cites the B-18 declaration`);
    }
    // The canned content itself is untouched below the marker (no reword).
    assert.ok(gh!.body.includes("name: rapidtool-gate"), "GH-Actions YAML body intact");
    assert.ok(iac!.body.includes("hosting: firebase preview channels"), "IaC sketch body intact");
  });
});
