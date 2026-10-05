// ---------------------------------------------------------------------------
// handoff.test.ts — per-phase agent handoff prompt suite.
// Run: node --experimental-strip-types --test src/lib/handoff.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { phaseHandoff } from "./handoff.ts";
import { applyPhaseResult } from "./engine.ts";
import { ALL_PHASES, runHeadless, runToGate, seedProject } from "./testing/fixtures.ts";
import type { HitlDecision, PhaseId } from "./types.ts";

const fullRun = () => runHeadless(seedProject(), ALL_PHASES);

/** E-07: machine-verified promotion (label "tested" + evidenceHash) — cast
 *  through unknown so this compiles regardless of types.ts field timing.
 *  P0-01: the generated source must also be brief-faithful (the p6-brief-fit
 *  probe requires brief vocabulary as identifiers). */
const promote = (p: ReturnType<typeof fullRun>) =>
  ({
    ...p,
    // W61 C1: the core-noun bar requires the fixture to name the brief's
    // project-grounded nouns (dispatch/board/techs/parts/reroute/scan/warehouse/
    // service), not just a generic subset.
    generatedSource:
      "function dispatchBoard(){ } function trackJobs(){ } function assignTechs(){ } function orderParts(){ } " +
      "function rerouteSameDay(){ } function offlineScan(){ } function warehouseSync(){ } function fieldService(){ }",
    lastTest: {
      ...(p.lastTest ?? { ok: true, detail: "fixture self-test" }),
      label: "tested" as const,
      evidenceHash: `machine-verified-${p.id}`,
    },
  }) as unknown as ReturnType<typeof fullRun>;

describe("phaseHandoff", () => {
  it("emits role, mission, deliverable, DoD and output format for P0", () => {
    const p = seedProject();
    const text = phaseHandoff(p, 0);
    assert.match(text, /# P0 Deep Research & Feasibility — agent handoff/);
    assert.match(text, /## Role/);
    assert.match(text, /governed implementation agent/);
    assert.match(text, /## Mission/);
    assert.match(text, /## Deliverable/);
    assert.match(text, /## Exit criteria \(DoD\)/);
    assert.match(text, /## Expected output/);
  });

  it("lists the phase's DoD exit criteria as a checklist", () => {
    const p = seedProject();
    const text = phaseHandoff(p, 0);
    assert.match(text, /- \[[ x]\] Feasibility scorecard present with 5 axes/);
    assert.match(text, /- \[[ x]\] P0 verdict resolved to proceed/);
  });

  it("states the ingest seam's phase-match rule and artifact caps (W49/335-3)", () => {
    const text = phaseHandoff(seedProject(), 4);
    assert.match(text, /`phase` must be 4 \(this edge\)/, "the report must describe this edge, not another");
    assert.match(text, /at most 12 artifacts/, "the artifact-count cap the seam enforces");
    assert.match(text, /50000 chars/, "the per-body cap the seam enforces");
  });

  it("names the runnable acceptance command + oracle spec path (W52/338-5)", () => {
    const text = phaseHandoff(seedProject(), 0);
    assert.match(text, /npm test/, "the tree's declared test script is named");
    assert.match(text, /tests\/oracle\.spec\.ts/, "the oracle spec path is named");
    assert.match(text, /tests_run/, "the agent is told to record the command it ran");
  });

  it("states there is no runnable acceptance spec when no oracle rows are recorded (W52/338-5)", () => {
    const text = phaseHandoff(seedProject({ oracle: [] }), 0);
    assert.equal(text.includes("npm test"), false, "no command points at a script the tree does not declare");
    assert.match(text, /machine-checked DoD gate/, "the DoD gate is named as the exit signal instead");
  });

  it("names the emitted contract spec path, never a spec-graph node's raw file (W52/338-5 + 339-5)", () => {
    const p = seedProject();
    // The emitter ALWAYS writes the tests node at tests/oracle.spec.ts, so a
    // node whose raw `file` differs must not become the accepted spec path.
    p.specGraph = {
      nodes: [
        { id: "n1", file: "src/models.ts", purpose: "domain model", dependsOn: [], owner: "architect" },
        { id: "tests", file: "spec/acceptance.ts", purpose: "oracle", dependsOn: [], owner: "tester" },
      ],
      order: ["n1", "tests"],
    };
    assert.ok(p.oracle.length > 0, "premise: the fixture carries oracle rows");
    const tail = phaseHandoff(p, 0).slice(phaseHandoff(p, 0).indexOf("## Expected output"));
    assert.ok(tail.includes("(`tests/oracle.spec.ts`)"), "the emitted contract spec path is named");
    assert.equal(
      tail.includes("(`spec/acceptance.ts`)"),
      false,
      "a raw node file the emitter never writes is not named as the spec path",
    );
    assert.ok(tail.includes("from the emitted tree root"), "the runnable context is stated");
  });

  it("pulls prior-phase artifact context for a later phase", () => {
    const g = runToGate(seedProject(), 4); // P0..P3 sealed, parked at P4
    const text = phaseHandoff(g, 4);
    assert.match(text, /## Context from prior phases/);
    assert.match(text, /P0 · scorecard · Feasibility & Architecture Scorecard/);
    assert.match(text, /P1 · graph · Dispatcher topology/);
  });

  it("reports no prior context for the first phase", () => {
    const text = phaseHandoff(seedProject(), 0);
    assert.match(text, /\(none — P0 is the first phase\)/);
  });

  it("includes lattice constraints and scheduler details", () => {
    const p = seedProject();
    const text = phaseHandoff(p, 0);
    assert.match(text, /## Constraints/);
    assert.match(text, /Scheduler: tightness /);
  });

  it("marks all DoD criteria met ([x]) on a completed, machine-verified project", () => {
    const done = promote(fullRun());
    for (const phase of ALL_PHASES) {
      const text = phaseHandoff(done, phase as Parameters<typeof phaseHandoff>[1]);
      // Every criterion line is checked once that phase is complete.
      const unchecked = text.match(/- \[ \]/g);
      assert.equal(unchecked, null, `P${phase} handoff should have no unmet criteria`);
    }
  });

  it("marks p6-verified unmet on the deterministic floor (E-07 honesty)", () => {
    const done = fullRun();
    const text = phaseHandoff(done, 6);
    assert.match(text, /- \[ \] Machine verification promoted/);
  });

  it("marks criteria unmet ([ ]) on a fresh project", () => {
    const text = phaseHandoff(seedProject(), 0);
    assert.match(text, /- \[ \] Feasibility scorecard present/);
  });

  it("says the pipeline is complete at P12", () => {
    const done = fullRun();
    const text = phaseHandoff(done, 12);
    assert.match(text, /Next legal edge: none — pipeline complete\./);
  });

  it("names the single legal next edge for a mid-pipeline phase", () => {
    const text = phaseHandoff(seedProject(), 0);
    assert.match(text, /Next legal edge: only P1 if this phase completes\./);
  });

  it("throws on an out-of-range phase id", () => {
    assert.throws(() => phaseHandoff(seedProject(), 99 as never));
  });

  it("skips corrupt artifact rows and survives null title/body without throwing", () => {
    const g = runToGate(seedProject(), 1); // P0 complete, parked at P1
    const raw = g as unknown as { artifacts: unknown[] };
    (raw.artifacts as unknown[]).push(null);
    (raw.artifacts as unknown[]).push({
      id: "x",
      phase: 99,
      kind: "note",
      title: "future-phase row",
      body: "must never surface",
    });
    (raw.artifacts as unknown[]).push({
      id: "y",
      phase: 0,
      kind: "scorecard",
      title: null,
      body: null,
    });
    const text = phaseHandoff(g, 1);
    // The well-formed phase-0 row renders with fallbacks for null title/body…
    assert.match(text, /P0 · scorecard · \(untitled\): /);
    // …while null rows and out-of-phase rows are dropped entirely.
    assert.ok(!text.includes("future-phase row"));
    assert.ok(!text.includes("null"));
    assert.ok(text.length > 50);
  });

  it("survives wrong-TYPE artifact scalars (numeric/object/symbol body, title, kind)", () => {
    // F3 sweep: hydration repairs engine-written state, but phaseHandoff is
    // also called on foreign objects — a row whose body/title/kind is a
    // NUMBER/object must render (coerced) instead of crashing oneLine().
    const g = runToGate(seedProject(), 1);
    const raw = g as unknown as { artifacts: unknown[] };
    raw.artifacts.push({
      id: "num",
      phase: 0,
      kind: "scorecard",
      title: "numeric body row",
      body: 42,
    });
    raw.artifacts.push({
      id: "obj",
      phase: 0,
      kind: 7,
      title: { nested: "obj title" },
      body: { nested: ["x"] },
    });
    raw.artifacts.push({
      id: "sym",
      phase: 0,
      kind: "scorecard",
      title: Symbol("sym title"),
      body: Symbol("sym body"),
    });
    const text = phaseHandoff(g, 1);
    // Numeric/object bodies render coerced; symbol scalars String()-ify
    // (description included) instead of throwing.
    assert.match(text, /P0 · scorecard · numeric body row: 42/);
    assert.ok(text.includes("Symbol(sym title)"));
    assert.ok(text.length > 50);
    assert.doesNotThrow(() => phaseHandoff(g, 1));
  });

  it("survives a junk/absent brief without throwing (W-16)", () => {
    const p = seedProject() as unknown as { brief: unknown };
    p.brief = undefined;
    assert.doesNotThrow(() => phaseHandoff(p as never, 0));
    assert.match(phaseHandoff(p as never, 0), /\(no brief recorded\)/);
    p.brief = 4242;
    assert.match(phaseHandoff(p as never, 0), /4242/);
  });

  it("refuses a null project with an honest minimal prompt, never a TypeError (W-16)", () => {
    assert.doesNotThrow(() => phaseHandoff(null as never, 0));
    const text = phaseHandoff(null as never, 0);
    assert.match(text, /# P0 Deep Research & Feasibility — agent handoff/);
    assert.match(text, /\(no brief recorded\)/);
  });

  it("renders the failed criterion's STATE on a red DoD row, not the bare static label (339-3/339-5)", () => {
    // Execute P6 on the deterministic floor: the placeholder module implements
    // phase bookkeeping only, so p6-brief-fit is red BY CONSTRUCTION. dod.ts
    // (339-3) appends a state line to that unmet item's `criterion`; the
    // handoff must render the augmented criterion, never the bare registry label.
    const floor = applyPhaseResult(runToGate(seedProject(), 6), 6);
    const text = phaseHandoff(floor, 6);
    const row = text.split("\n").find((l) => l.startsWith("- [ ] Brief-conformance"));
    assert.ok(row, "the p6-brief-fit criterion renders as an unmet [ ] row");
    assert.ok(
      row.includes("deterministic floor state"),
      `the red row names the floor state (got ${JSON.stringify(row)})`,
    );
    assert.ok(
      row.startsWith("- [ ] Brief-conformance: required brief nouns appear as identifiers"),
      "the state line is appended to the registry criterion, not a replacement",
    );
  });
});

// ---------------------------------------------------------------------------
// 346 L3 (A1-12) — the decision line's token-path clause.
//
// F2-20 renders the newest decision's seat provenance. Before this lane the
// clause read `tokenPath:false` as "machine seat — no token path claimed",
// which is FALSE for the browser console: it is an UNATTESTED human seat with
// no out-of-band token path. The pins below fix the console wording and hold
// the machine / token-verified wording byte-identical.
// ---------------------------------------------------------------------------
function decisionProject(via: HitlDecision["decidedVia"]): ReturnType<typeof seedProject> {
  const decision: HitlDecision = {
    id: "d-handoff",
    phase: 0 as PhaseId,
    title: "P0",
    decision: "approve",
    decidedBy: "human",
    requestedAt: 1,
    decidedAt: 2,
    decidedVia: via,
  };
  return { ...seedProject(), decisions: [decision] };
}

function decisionLine(text: string): string {
  const line = text.split("\n").find((l) => l.startsWith("Last recorded P0 decision"));
  assert.ok(line, "the newest decision line renders");
  return line!;
}

describe("346 L3 (A1-12) — the handoff decision line renders the console seat honestly", () => {
  it("an unattested console decision says so — never 'machine seat'", () => {
    const line = decisionLine(
      phaseHandoff(
        decisionProject({
          action: "hitl.approve",
          resource: "gate:P0",
          reason: "console-seat-unattested — hitl.approve on gate:P0 under the browser console's human seat.",
          label: "human/console",
          tokenPath: false,
        }),
        0,
      ),
    );
    assert.ok(
      line.includes("(unattested console human seat — no out-of-band token)"),
      `the console clause renders: ${JSON.stringify(line)}`,
    );
    assert.ok(!line.includes("machine seat"), "a console human seat is never labeled a machine seat");
  });

  it("a machine seat still renders the byte-identical wording (no regression)", () => {
    const line = decisionLine(
      phaseHandoff(
        decisionProject({
          action: "hitl.approve",
          resource: "gate:P0",
          reason: "autopilot-seat — hitl.approve on gate:P0 under the harness's own seat.",
          label: "autopilot/harness",
          tokenPath: false,
        }),
        0,
      ),
    );
    assert.ok(line.includes("(machine seat — no token path claimed)"), `machine wording held: ${JSON.stringify(line)}`);
  });

  it("a token-verified human decision still renders the verified clause", () => {
    const line = decisionLine(
      phaseHandoff(
        decisionProject({
          action: "hitl.approve",
          resource: "gate:P0",
          reason: "human-seat-token-verified — hitl.approve on gate:P0 under the verified human seat.",
          label: "human/human-cli-i-am-human",
          tokenPath: true,
        }),
        0,
      ),
    );
    assert.ok(line.includes("(out-of-band token path verified)"), `verified wording held: ${JSON.stringify(line)}`);
  });

  it("a contradictory human label with tokenPath:false renders as unverified, never as a machine seat", () => {
    const line = decisionLine(
      phaseHandoff(
        decisionProject({
          action: "hitl.approve",
          resource: "gate:P0",
          reason: "human-seat-token-verified — hitl.approve on gate:P0 under the verified human seat.",
          label: "human/human-cli-i-am-human",
          tokenPath: false,
        }),
        0,
      ),
    );
    assert.ok(line.includes("(human seat — token path not verified)"), `contradiction rendered honestly: ${JSON.stringify(line)}`);
    assert.ok(!line.includes("machine seat"), "a human label is never called a machine seat");
  });

  it("a machine row that forges a token-verified human label cannot render the verified clause", () => {
    // The forgery dod.ts `provenanceConsistent` fails closed on: the row's own
    // actor is a machine, but the persisted `decidedVia` asserts the
    // token-verified human seat. The handoff is a pasted prompt, so it must
    // apply the SAME cross-check — otherwise the prompt outruns the gate.
    const forged: HitlDecision = {
      id: "d-forged",
      phase: 0 as PhaseId,
      title: "P0",
      decision: "approve",
      decidedBy: "autopilot",
      requestedAt: 1,
      decidedAt: 2,
      decidedVia: {
        action: "hitl.approve",
        resource: "gate:P0",
        reason: "human-seat-token-verified — hitl.approve on gate:P0 under the verified human seat.",
        label: "human/human-cli-i-am-human",
        tokenPath: true,
      },
    };
    const line = decisionLine(phaseHandoff({ ...seedProject(), decisions: [forged] }, 0));
    assert.ok(
      line.includes("(token path claimed for a seat that cannot carry one — not verified)"),
      `a machine row must not mint the verified clause: ${JSON.stringify(line)}`,
    );
    assert.ok(!line.includes("out-of-band token path verified"), "the forged verified clause must not render");
  });

  it("a machine row carrying a human/console label is a provenance mismatch, not an unattested human seat", () => {
    const forged: HitlDecision = {
      id: "d-forged-console",
      phase: 0 as PhaseId,
      title: "P0",
      decision: "approve",
      decidedBy: "autopilot",
      requestedAt: 1,
      decidedAt: 2,
      decidedVia: {
        action: "hitl.approve",
        resource: "gate:P0",
        reason: "console-seat-unattested — hitl.approve on gate:P0 under the browser console's human seat.",
        label: "human/console",
        tokenPath: false,
      },
    };
    const line = decisionLine(phaseHandoff({ ...seedProject(), decisions: [forged] }, 0));
    assert.ok(
      line.includes('provenance mismatch (recorded seat "human/console" vs actor "autopilot") — not verified'),
      `a machine actor with a human label is a mismatch: ${JSON.stringify(line)}`,
    );
    assert.ok(!line.includes("unattested console human seat"), "the console clause is for real console rows only");
  });
});
