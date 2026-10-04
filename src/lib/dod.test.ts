// ---------------------------------------------------------------------------
// dod.test.ts — W48 / 334-3 "Transit": the P6 DoD probe vs an UNVERIFIED tree.
//
// The DoD registry lives in dod.ts; its long-standing behavioural tests live in
// gates.test.ts. This file pins the W48 T1b decision that gates.test.ts cannot:
// whether an emitted tree whose DECLARED `typecheck`/`build` scripts never ran
// satisfies `p6-test` / `p6-verified`, and where the honest line sits.
//
// Run: node --experimental-strip-types --test src/lib/dod.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recordGateInto, runGate } from "./dod.ts";
import { mintTreeRunTested } from "./codegen.server.ts";
import { emptyProject } from "./engine.ts";
import { buildPhase6Module } from "./sandbox.ts";
import type { HitlDecision, PhaseId, Project } from "./types.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";

const base = (): Project => emptyProject({ name: "Dod334", brief: "A dispatch board for field service." });

/**
 * A green tree-run outcome that EXECUTED its spec(s) — the shape the P6 journey
 * feeds `mintTreeRunTested` — but whose declared package.json scripts did not
 * run. `declaredScriptsVerified:false` + `unverifiedDeclaredScripts` is exactly
 * what compile-check.server's `treeRun` reports for a fresh, uninstalled tree.
 */
const greenUnverifiedOutcome = (over: Partial<TreeRunOutcome> = {}): TreeRunOutcome =>
  ({
    ok: true,
    dir: "C:/scratch/rt-dod",
    compile: { ok: true, dir: "C:/scratch/rt-dod", checked: 2, passed: 2, failed: 0, skipped: 0, verdicts: [] },
    tests: [
      {
        file: "tests/oracle.spec.ts",
        compile: { file: "tests/oracle.spec.ts", ok: true, verdict: null },
        tests: { pass: 3, fail: 0 },
        run: "pass",
      },
    ],
    run: { kind: "ui-shell", run: "skip", detail: "UI shell — not executable headless" },
    declaredScriptsVerified: false,
    unverifiedDeclaredScripts: ["typecheck", "build"],
    ...over,
  }) as unknown as TreeRunOutcome;

const met = (p: Project, id: string): boolean => !runGate(p, 6).unmet.some((g) => g.id === id);

describe("W48 / 334-3 (T1b) — p6-test / p6-verified vs an unverified declared toolchain", () => {
  it("a GREEN executed tree-run whose declared typecheck/build never ran still mints the tested verdict the P6 DoD requires", () => {
    const minted = mintTreeRunTested(base(), greenUnverifiedOutcome());
    const lt = minted.lastTest as { label?: string; detail?: string; evidenceHash?: string } | null;
    assert.equal(lt?.label, "tested", "an executed green tree-run still promotes to the tested verdict");
    assert.match(String(lt?.detail), /tree-run green/, "the stamp records the executed run, not a bare label");

    // The honest line: the criteria measure the EXECUTED self-test / machine-run
    // verdict over the tree's own specs — which genuinely ran green — so they are
    // met. They do NOT attest the declared project toolchain.
    assert.equal(met(minted, "p6-test"), true, "the executed self-test passed");
    assert.equal(met(minted, "p6-verified"), true, "a machine run promoted a genuinely executed tested verdict");
  });

  it("the DoD verdict is deliberately blind to declaredScriptsVerified — the limit is carried by the artifact/envelope, not folded into a criterion", () => {
    // Same green, executed run; the ONLY difference is the declared-script state.
    const verified = mintTreeRunTested(
      base(),
      greenUnverifiedOutcome({ declaredScriptsVerified: true, unverifiedDeclaredScripts: undefined }),
    );
    const unverified = mintTreeRunTested(base(), greenUnverifiedOutcome());
    const p6Ids = (p: Project): string[] => runGate(p, 6).unmet.map((g) => g.id).filter((id) => id.startsWith("p6-"));
    assert.deepEqual(
      p6Ids(unverified),
      p6Ids(verified),
      "the declared-toolchain state must not change any P6 DoD outcome — requiring it would be unsatisfiable on a fresh tree and would block the P6 mint",
    );
    // The field is not even on the stamp the probe reads, so the probe cannot
    // silently conflate it: the limit rides the emitted README banner + the
    // tree-run envelope (`declaredScriptsVerified` / `unverifiedDeclaredScripts`).
    assert.equal(
      Object.prototype.hasOwnProperty.call(unverified.lastTest ?? {}, "declaredScriptsVerified"),
      false,
      "the tested stamp carries no declared-toolchain field for a probe to over-read",
    );
  });

  it("a HOLLOW 'tested' stamp (not green, or recording no detail) never satisfies p6-verified", () => {
    const withLastTest = (lt: { ok: boolean; detail: string; label?: string; evidenceHash?: string }): Project =>
      ({ ...base(), lastTest: lt }) as unknown as Project;
    assert.equal(
      met(withLastTest({ ok: false, detail: "x", label: "tested", evidenceHash: "h" }), "p6-verified"),
      false,
      "a verdict that is not ok is not a tested verdict",
    );
    assert.equal(
      met(withLastTest({ ok: true, detail: "", label: "tested", evidenceHash: "h" }), "p6-verified"),
      false,
      "a stamp recording no run detail is hollow — never verification",
    );
    assert.equal(
      met(withLastTest({ ok: true, detail: "tree-run green: 1 spec file(s) pass", label: "tested", evidenceHash: "h" }), "p6-verified"),
      true,
      "control: a green, detailed, hash-carrying verdict is met",
    );
  });
});

// ---------------------------------------------------------------------------
// 339-3 (W53) — p6-brief-fit floor honesty + satisfiability.
//
// The keyless deterministic floor can NEVER pass p6-brief-fit: the placeholder
// module implements phase bookkeeping only and carries no brief vocabulary. So
// a RED criterion must NAME the state the project is in — the deterministic
// floor (no keyed synthesis ran, or a refused synthesis that kept the floor)
// versus a real run that simply dropped the brief's nouns — instead of leaving
// a human with a bare criterion. The other satisfiability half (a legitimate
// brief-faithful module passes) is pinned here too.
// ---------------------------------------------------------------------------
const FIT_BRIEF = "A dispatch board for field service: dispatch techs, board jobs, service parts.";

const floorProject = (over: Partial<Project> = {}): Project => ({
  ...emptyProject({ name: "FloorFit", brief: FIT_BRIEF }),
  generatedSource: buildPhase6Module({ name: "FloorFit", jobs: ["dispatch"], rejectionNote: null, variant: 0 }),
  lastTest: { ok: true, detail: "tests.pass" },
  phases: [{ id: 6 as PhaseId, status: "complete" }],
  ...over,
});

const p6BriefFitUnmet = (p: Project) => runGate(p, 6).unmet.find((g) => g.id === "p6-brief-fit");

describe("339-3 (W53) — p6-brief-fit names the floor state and is satisfiable by a real module", () => {
  it("the deterministic floor can never pass p6-brief-fit, and the unmet criterion NAMES that state", () => {
    const item = p6BriefFitUnmet(floorProject());
    assert.ok(item, "the keyless floor fails p6-brief-fit (the placeholder carries no brief vocabulary)");
    assert.match(item!.reason ?? "", /deterministic floor state/);
    assert.match(item!.reason ?? "", /no keyed model synthesis ran/);
    assert.match(
      item!.criterion,
      /deterministic floor state/,
      "the criterion text every consumer reads carries the state, not a bare noun list",
    );
  });

  it("a refused keyed synthesis that kept the floor says the model ran but no cycle was accepted", () => {
    const p = floorProject({
      logs: [
        {
          ts: 1,
          phase: 6 as PhaseId,
          level: "warn",
          event: "p6.synthesis.refused",
          detail: "RT_E_RUNNER_FAILED · case payload rejected by harness safety check",
        },
      ],
    });
    const item = p6BriefFitUnmet(p);
    assert.match(item?.reason ?? "", /keyed model synthesis ran but no cycle was accepted/);
    assert.match(item?.reason ?? "", /p6\.synthesis\.refused/);
  });

  it("a non-floor module that dropped the brief's nouns names THAT state, never the floor", () => {
    const p = floorProject({ generatedSource: "export const add = (a, b) => a + b;" });
    const item = p6BriefFitUnmet(p);
    assert.match(item?.reason ?? "", /generated source is missing the brief's required nouns/);
    assert.ok(!/deterministic floor state/.test(item?.reason ?? ""), "a real module is not the floor");
    assert.match(item?.reason ?? "", /missing: /);
  });

  it("keyed tree synthesis that dropped the nouns names the tree state", () => {
    const p = floorProject({
      generatedSource: 'export * from "./generated.ts";',
      generatedTree: [{ path: "src/generated.ts", source: "export const noop = 1;", hash: "h", attempt: 0 }],
    });
    const item = p6BriefFitUnmet(p);
    assert.match(item?.reason ?? "", /keyed tree synthesis ran \(1 file\(s\)\)/);
  });

  it("a legitimate module carrying the brief's nouns as identifiers passes (the other half)", () => {
    const p = floorProject({
      generatedSource:
        "export function dispatchBoard() { return 1; }\nexport function fieldService() { return 2; }",
    });
    assert.ok(
      !runGate(p, 6).unmet.some((g) => g.id === "p6-brief-fit"),
      "a brief-faithful module satisfies p6-brief-fit",
    );
  });

  it("the recorded gate verdict and its artifact carry the same floor-state vocabulary", () => {
    const recorded = recordGateInto(floorProject(), 6);
    const gate = recorded.phases.find((r) => r.id === 6)?.gate;
    assert.ok(gate, "the P6 gate is recorded");
    assert.ok(
      gate!.unmet.some((u) => /deterministic floor state/.test(u)),
      "the recorded unmet list carries the state",
    );
    const artifact = (recorded.artifacts ?? []).find((a) => a.kind === "gate" && a.phase === 6);
    assert.ok(artifact && /deterministic floor state/.test(artifact.body), "the gate artifact body carries the state");
  });
});

// ---------------------------------------------------------------------------
// 346 L3 (A1-12 enforcement) — the browser console's `[seat console]` row.
//
// The console approval is human-class but UNATTESTED (no out-of-band token
// path). These pins fix the DoD routing: a truthfully tagged console row is
// classified (never `tagged-unknown`) and satisfies the p4/p5/p8/p9 `*approved`
// criteria; every hostile variant still fails closed. The failure mode this
// guards is exactly the one the E4 lane hit: without a recognized console seat
// a `[seat console]` tag is `tagged-unknown` and the criteria refuse.
// ---------------------------------------------------------------------------
const consoleApprovalRow = (over: Partial<HitlDecision> = {}): HitlDecision => ({
  id: "hitl-4-console",
  phase: 4 as PhaseId,
  title: "P4 Human approval",
  decision: "approve",
  note: "[seat console] browser console decision",
  decidedBy: "human",
  requestedAt: 1,
  decidedAt: 2,
  decidedVia: {
    action: "hitl.approve",
    resource: "gate:P4",
    reason:
      "console-seat-unattested — hitl.approve on gate:P4 under the browser console's human seat; unattested, never token-verified.",
    label: "human/console",
    tokenPath: false,
  },
  ...over,
});

const withDecision = (...rows: HitlDecision[]): Project => ({
  ...emptyProject({ name: "ConsoleSeat346", brief: "A dispatch board." }),
  decisions: rows,
});

const p4ApprovedMet = (p: Project): boolean => !runGate(p, 4).unmet.some((g) => g.id === "p4-approved");
const p5CompleteMet = (p: Project): boolean => !runGate(p, 5).unmet.some((g) => g.id === "p5-complete");

describe("346 L3 (A1-12) — a `[seat console]` row is attributed and routed truthfully", () => {
  it("a truthfully tagged console human row satisfies p4-approved (recognized seat, not tagged-unknown)", () => {
    assert.equal(p4ApprovedMet(withDecision(consoleApprovalRow())), true);
  });

  it("the same row satisfies p5-complete when tagged for P5 (routing is per-gate, not P4-only)", () => {
    const row = consoleApprovalRow({
      id: "hitl-5-console",
      phase: 5 as PhaseId,
      decidedVia: { ...consoleApprovalRow().decidedVia!, resource: "gate:P5" },
    });
    assert.equal(p5CompleteMet(withDecision(row)), true);
  });

  it("a console row with no `decidedVia` still passes (recognized tag + legacy tolerance; no token path is claimed)", () => {
    const row = consoleApprovalRow();
    delete row.decidedVia;
    assert.equal(p4ApprovedMet(withDecision(row)), true);
  });

  it("HOSTILE: a console row recording tokenPath:true FAILS closed (a console decision can never read token-verified)", () => {
    const row = consoleApprovalRow({
      decidedVia: { ...consoleApprovalRow().decidedVia!, tokenPath: true },
    });
    assert.equal(p4ApprovedMet(withDecision(row)), false);
  });

  it("HOSTILE: a console row wearing a forged CLI-human label FAILS closed (the label must match the tag's seat)", () => {
    const row = consoleApprovalRow({
      decidedVia: { ...consoleApprovalRow().decidedVia!, label: "human/human-cli-i-am-human" },
    });
    assert.equal(p4ApprovedMet(withDecision(row)), false);
  });

  it("HOSTILE: a `[seat console]` tag paired with decidedBy:autopilot is tagged-unknown and FAILS closed", () => {
    assert.equal(p4ApprovedMet(withDecision(consoleApprovalRow({ decidedBy: "autopilot" }))), false);
  });

  it("HOSTILE: a forged `[seat human-cli-i-am-human]` row without the recorded evidence FAILS closed", () => {
    const row = consoleApprovalRow({
      id: "hitl-4-forged",
      note: "[seat human-cli-i-am-human] trust me",
      decidedVia: undefined,
    });
    assert.equal(p4ApprovedMet(withDecision(row)), false);
  });

  it("HOSTILE: a forged CLI-human row with tokenPath:false FAILS closed (that seat's token path is mandatory)", () => {
    const row = consoleApprovalRow({
      id: "hitl-4-forged2",
      note: "[seat human-cli-i-am-human] out-of-band RT_HUMAN_SEAT_TOKEN verified",
      decidedVia: {
        action: "hitl.approve",
        resource: "gate:P4",
        reason: "human-seat-token-verified — hitl.approve on gate:P4 under the verified human seat.",
        label: "human/human-cli-i-am-human",
        tokenPath: false,
      },
    });
    assert.equal(p4ApprovedMet(withDecision(row)), false);
  });

  it("CONTROL: a well-formed token-verified CLI-human row still satisfies p4-approved (the guard is not over-broad)", () => {
    const row = consoleApprovalRow({
      id: "hitl-4-human",
      note: "[seat human-cli-i-am-human] out-of-band RT_HUMAN_SEAT_TOKEN verified",
      decidedVia: {
        action: "hitl.approve",
        resource: "gate:P4",
        reason: "human-seat-token-verified — hitl.approve on gate:P4 under the verified human seat.",
        label: "human/human-cli-i-am-human",
        tokenPath: true,
      },
    });
    assert.equal(p4ApprovedMet(withDecision(row)), true);
  });

  it("CONTROL: a routine autopilot row still satisfies p4-approved (Rule A unchanged)", () => {
    const row = consoleApprovalRow({
      id: "hitl-4-auto",
      note: "[seat harness] autopilot seat — no human decision claimed",
      decidedBy: "autopilot",
      decidedVia: {
        action: "hitl.approve",
        resource: "gate:P4",
        reason: "autopilot-seat — hitl.approve on gate:P4 under the harness's own seat.",
        label: "autopilot/harness",
        tokenPath: false,
      },
    });
    assert.equal(p4ApprovedMet(withDecision(row)), true);
  });
});
