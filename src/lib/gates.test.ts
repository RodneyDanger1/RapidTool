// ---------------------------------------------------------------------------
// DoD gate registry + DoR + fixtures + verification-core property suite —
// gates.test.ts (E-02 recordGateInto, E-07 p6-verified, E-26 properties,
// E-08 pure oracle seam)
// Run: node --experimental-strip-types --test src/lib/gates.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DOD,
  archProductComplete,
  archTrace,
  gateArtifact,
  isReexportOnlySource,
  isStubSource,
  missingOracleCaseIds,
  oracleToCaseSeeds,
  readyFor,
  recordGateInto,
  runGate,
} from "./dod.ts";
import { applyPhaseResult, emptyProject, rejectHitl, stampP6ReqTrace } from "./engine.ts";
import { buildPhase6Module } from "./sandbox.ts";
import { ALL_PHASES, runHeadless, runToGate, seedProject } from "./testing/fixtures.ts";
import { exportProjectJson } from "./io.ts";
import type { MemoryEntry, PhaseId, Project } from "./types.ts";

const fullRun = () => runHeadless(seedProject(), ALL_PHASES);

/**
 * P0-01 Part A: the keyed/machine-verified state replaces the deterministic
 * placeholder with a brief-faithful module — the fixture brief's nouns appear
 * as code identifiers, so the p6-brief-fit probe passes on the PROMOTED shape
 * (and fails on the placeholder, by design).
 */
const BRIEF_FAITHFUL_SOURCE = [
  `function dispatchBoard() { return []; }`,
  `function trackJobs() { return []; }`,
  `function assignTechs() { return []; }`,
  `function orderParts() { return []; }`,
  `function rerouteSameDay() { return []; }`,
  `function offlineScan() { return true; }`,
  `function warehouseSync() { return true; }`,
  `function fieldService() { return true; }`,
  `if (typeof module !== "undefined" && module.exports) {`,
  `  module.exports.dispatchBoard = dispatchBoard;`,
  `  module.exports.trackJobs = trackJobs;`,
  `}`,
].join("\n");

/**
 * E-07: represent a machine-verified (promoted) project — lastTest carries the
 * "tested" label + an evidence hash (the shape engine.runP6Real's promotion
 * branch / applyVerifyOutcome mint) and the generated module is brief-faithful
 * (the shape liveP6Synthesis mints). Cast through unknown so these tests
 * compile whether or not types.ts's lastTest.label/evidenceHash fields have
 * landed yet (E-07 #1 — the fields are being added by the types lane).
 */
const promote = (p: Project): Project =>
  ({
    ...p,
    generatedSource: BRIEF_FAITHFUL_SOURCE,
    lastTest: {
      ...(p.lastTest ?? { ok: true, detail: "fixture self-test" }),
      label: "tested" as const,
      evidenceHash: `machine-verified-${p.id}`,
    },
  }) as unknown as Project;

/** Build a project variant with an arbitrary lastTest shape (defensive-probe tests). */
const withLastTest = (
  p: Project,
  lt: { ok: boolean; detail: string; label?: string; evidenceHash?: string },
): Project => ({ ...p, lastTest: lt }) as unknown as Project;

describe("DOD registry covers every phase", () => {
  for (const phase of ALL_PHASES) {
    it(`phase ${phase} has at least one machine-checkable item`, () => {
      assert.ok(DOD[phase as PhaseId].length >= 1, `DOD[${phase}] is empty`);
    });
  }

  it("gate item ids are unique across the registry", () => {
    const ids = ALL_PHASES.flatMap((ph) => DOD[ph as PhaseId].map((g) => g.id));
    assert.equal(new Set(ids).size, ids.length);
  });

  it("registers exactly the 13 pipeline phases (E-26 #1)", () => {
    assert.equal(Object.keys(DOD).length, ALL_PHASES.length);
    for (const phase of ALL_PHASES) {
      assert.ok(phase in DOD, `DOD[${phase}] registered`);
    }
  });
});

describe("runGate", () => {
  it("passes every phase gate on a fully executed, machine-verified (promoted) project", () => {
    // E-07: p6-verified is additive, so the all-green invariant holds on a
    // PROMOTED full run (lastTest stamped "tested" + evidenceHash).
    const done = promote(fullRun());
    for (const phase of ALL_PHASES) {
      const r = runGate(done, phase);
      assert.equal(
        r.pass,
        true,
        `gate P${phase} should pass on a promoted full run: ${r.unmet.map((u) => u.id)}`,
      );
    }
  });

  it("p6-verified is unmet on the deterministic floor while p6-test stays met (E-07)", () => {
    const floor = fullRun(); // template self-test only — no machine-verified label
    const r = runGate(floor, 6);
    assert.equal(r.pass, false);
    assert.ok(
      r.unmet.some((g) => g.id === "p6-verified"),
      "deterministic full run must not satisfy p6-verified",
    );
    assert.ok(
      !r.unmet.some((g) => g.id === "p6-test"),
      "p6-test is the deterministic floor and stays met",
    );
    assert.ok(!r.unmet.some((g) => g.id === "p6-source"));
    assert.ok(!r.unmet.some((g) => g.id === "p6-artifact"));
    // P0-01 Part A: the placeholder fails brief-conformance BY CONSTRUCTION —
    // the toy's identifiers never carry the fixture brief's vocabulary.
    assert.ok(
      r.unmet.some((g) => g.id === "p6-brief-fit"),
      "deterministic placeholder must not satisfy p6-brief-fit",
    );
  });

  it("p6-verified reads lastTest defensively: old shapes and wrong labels never pass, never throw", () => {
    const base = fullRun();
    // Pre-E-07 payload shape {ok, detail} (fields absent) → unmet, no throw.
    const oldShape = runGate(withLastTest(base, { ok: true, detail: "tests.pass" }), 6);
    assert.equal(oldShape.pass, false);
    assert.ok(oldShape.unmet.some((g) => g.id === "p6-verified"));
    // "tested" without an evidence hash → unmet.
    const noHash = runGate(withLastTest(base, { ok: true, detail: "x", label: "tested" }), 6);
    assert.equal(noHash.pass, false);
    assert.ok(noHash.unmet.some((g) => g.id === "p6-verified"));
    // "self-test" / "real-run" labels are NOT promotion → unmet.
    const selfTest = runGate(
      withLastTest(base, { ok: true, detail: "x", label: "self-test", evidenceHash: "h" }),
      6,
    );
    assert.equal(selfTest.pass, false);
    const realRun = runGate(
      withLastTest(base, { ok: true, detail: "x", label: "real-run", evidenceHash: "h" }),
      6,
    );
    assert.equal(realRun.pass, false);
    // Only label "tested" + non-empty evidenceHash promotes (P0-01: the
    // source must ALSO be brief-faithful — promote() carries that).
    const promoted = runGate(
      withLastTest(promote(base), { ok: true, detail: "x", label: "tested", evidenceHash: "h" }),
      6,
    );
    assert.equal(promoted.pass, true);
    assert.deepEqual(promoted.unmet, []);
  });

  it("runGate(12) passes on a full run — incl. P6 lastTest ok + generated source", () => {
    const done = promote(fullRun()); // P0-01: source must be brief-faithful
    assert.equal(done.lastTest?.ok, true);
    assert.ok(done.generatedSource.length > 0);
    const r = runGate(done, 12);
    assert.equal(r.pass, true);
    assert.deepEqual(r.unmet, []);
    assert.ok(r.evidenceHash.length > 0);
  });

  it("fails P0 with unmet criteria on a fresh seed", () => {
    const r = runGate(seedProject(), 0);
    assert.equal(r.pass, false);
    assert.ok(r.unmet.length >= 1);
    assert.ok(r.unmet.some((g) => g.id === "p0-scorecard"));
  });

  it("fails cleanly (no throw) on fresh seeds for mid-pipeline gates", () => {
    for (const phase of [4, 6, 8, 12]) {
      const r = runGate(seedProject(), phase);
      assert.equal(r.pass, false);
      assert.ok(r.unmet.length >= 1);
    }
  });

  it("evidenceHash is stable across repeated calls on the same project", () => {
    const p = seedProject();
    assert.equal(runGate(p, 0).evidenceHash, runGate(p, 0).evidenceHash);
  });

  it("evidenceHash is stable across equivalent (fresh) projects", () => {
    assert.equal(runGate(seedProject(), 0).evidenceHash, runGate(seedProject(), 0).evidenceHash);
  });

  it("evidenceHash changes when probe outcomes change", () => {
    const fresh = runGate(seedProject(), 0).evidenceHash;
    const applied = runGate(applyPhaseResult(seedProject(), 0), 0).evidenceHash;
    assert.notEqual(fresh, applied);
  });

  it("unmet P0 includes the verdict item when the scorecard reframes", () => {
    // Vague brief → lattice.vague → verdict "reframe" → P0 parks awaiting_hitl.
    const vague = emptyProject({ name: "Vague", brief: "hi" });
    const parked = applyPhaseResult(vague, 0);
    assert.equal(parked.status, "awaiting_hitl");
    assert.equal(parked.scorecard?.verdict, "reframe");
    const r = runGate(parked, 0);
    assert.equal(r.pass, false);
    assert.ok(
      r.unmet.some((g) => g.id === "p0-verdict"),
      "p0-verdict must be unmet on a reframe verdict",
    );
    assert.ok(!r.unmet.some((g) => g.id === "p0-scorecard"), "scorecard itself exists and passes");
  });
});

describe("readyFor (DoR)", () => {
  it("phase 1 is not ready until P0 is complete", () => {
    const fresh = seedProject();
    const before = readyFor(fresh, 1);
    assert.equal(before.ready, false);
    assert.ok(before.blockers.some((b) => b.id === "dor-prior"));

    const after = runHeadless(fresh, [0]);
    assert.equal(after.phases.find((r) => r.id === 0)?.status, "complete");
    const ready = readyFor(after, 1);
    assert.equal(ready.ready, true);
    assert.deepEqual(ready.blockers, []);
  });

  it("phase 0 is ready on a fresh seed (vacuous prior)", () => {
    const r = readyFor(seedProject(), 0);
    assert.equal(r.ready, true);
    assert.deepEqual(r.blockers, []);
  });

  it("a completed phase is never ready again", () => {
    const done = fullRun();
    const r = readyFor(done, 1);
    assert.equal(r.ready, false);
    assert.ok(r.blockers.some((b) => b.id === "dor-open"));
  });

  it("a blocked project is not ready for anything", () => {
    const vague = emptyProject({ name: "Vague", brief: "hi" });
    const parked = applyPhaseResult(vague, 0); // reframe → awaiting_hitl
    const blocked = rejectHitl(parked, "Brief is far too vague to build anything at all.");
    assert.equal(blocked.status, "blocked");
    const r = readyFor(blocked, 0);
    assert.equal(r.ready, false);
    assert.ok(r.blockers.some((b) => b.id === "dor-unblocked"));
  });
});

describe("gateArtifact", () => {
  it("produces a kind-gate artifact with phase, title and hash line", () => {
    const a = gateArtifact(4, { pass: false, unmet: ["p4-approved"], evidenceHash: "12345678" });
    assert.equal(a.kind, "gate");
    assert.equal(a.phase, 4);
    assert.equal(a.title, "DoD gate — P4");
    assert.match(a.body, /Evidence hash: 12345678/);
    assert.match(a.body, /\*\*Result: FAIL\*\*/);
    assert.match(a.body, /- p4-approved/);
    assert.ok(a.id.startsWith("gate-p4-"));
  });

  it("renders a pass verdict listing all criteria met", () => {
    const a = gateArtifact(12, { pass: true, unmet: [], evidenceHash: "abcdef" });
    assert.match(a.body, /\*\*Result: PASS\*\*/);
    assert.match(a.body, /All criteria met for phase 12\./);
  });
});

describe("recordGateInto (E-02 — store.recordGate parity, pure)", () => {
  it("records gate, artifact and verdict log for a completed phase", () => {
    const p = runHeadless(seedProject(), [0]); // P0 complete, gate not yet recorded
    assert.equal(p.phases.find((r) => r.id === 0)?.status, "complete");
    // M7-01 (fixes/310): an unrecorded gate is now the birth-stamped `null`
    // (emptyProject stamps the hydrate defaults so the persisted shape is
    // byte-stable on the first round trip) — assert not-recorded, not the
    // old pre-stamp `undefined` sentinel.
    assert.equal(p.phases.find((r) => r.id === 0)?.gate ?? null, null);
    const out = recordGateInto(p, 0);
    assert.notEqual(out, p, "returns a new project object");
    const gateRec = out.phases.find((r) => r.id === 0)?.gate;
    assert.ok(gateRec, "PhaseRecord.gate is stamped");
    assert.equal(typeof gateRec.passed, "boolean");
    assert.equal(typeof gateRec.checkedAt, "number");
    assert.equal(gateRec.evidenceHash, runGate(p, 0).evidenceHash);
    assert.deepEqual(
      gateRec.unmet,
      runGate(p, 0).unmet.map((g) => g.criterion),
    );
    assert.ok(
      out.artifacts.some((a) => a.kind === "gate" && a.phase === 0),
      "a gate artifact is emitted",
    );
    const log = out.logs[out.logs.length - 1];
    assert.equal(log.event, "gate.verdict");
    assert.equal(log.phase, 0);
    assert.ok(log.detail.startsWith(gateRec.passed ? "PASS" : "FAIL"), log.detail);
  });

  it("is a no-op (same project reference) when the phase record is not complete", () => {
    const fresh = seedProject();
    assert.equal(recordGateInto(fresh, 0), fresh);
    const parked = runToGate(seedProject(), 4); // P4 awaiting human approval
    assert.equal(recordGateInto(parked, 4), parked);
  });

  it("re-recording swaps the gate artifact instead of duplicating it", () => {
    const p = runHeadless(seedProject(), [0, 1]);
    const once = recordGateInto(p, 0);
    const twice = recordGateInto(once, 0);
    const gateArts = twice.artifacts.filter((a) => a.kind === "gate" && a.phase === 0);
    assert.equal(gateArts.length, 1, "artifact swap, never duplication");
    assert.equal(gateArts[0].id, `gate-p0-${runGate(p, 0).evidenceHash.slice(0, 8)}`);
    assert.equal(twice.logs.filter((l) => l.event === "gate.verdict" && l.phase === 0).length, 2);
  });

  it("records FAIL on the deterministic P6 floor and PASS after E-07 promotion", () => {
    const fail = recordGateInto(fullRun(), 6);
    const failGate = fail.phases.find((r) => r.id === 6)?.gate;
    assert.ok(failGate);
    assert.equal(failGate.passed, false);
    assert.ok(
      failGate.unmet.includes(
        'Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash)',
      ),
    );
    assert.equal(fail.logs[fail.logs.length - 1].level, "warn");
    const pass = recordGateInto(promote(fullRun()), 6);
    const passGate = pass.phases.find((r) => r.id === 6)?.gate;
    assert.ok(passGate);
    assert.equal(passGate.passed, true);
    assert.deepEqual(passGate.unmet, []);
    assert.match(pass.logs[pass.logs.length - 1].detail, /^PASS/);
    assert.equal(pass.logs[pass.logs.length - 1].level, "info");
  });
});

describe("DoD property tests (E-26)", () => {
  it("every GateItem carries a non-empty criterion (E-26 #4)", () => {
    const items = ALL_PHASES.flatMap((ph) => DOD[ph as PhaseId]);
    for (const g of items) {
      assert.ok(g.criterion.trim().length > 0, `item ${g.id} has an empty criterion`);
      assert.equal(typeof g.probe, "function");
    }
  });

  it("no DOD probe throws across a phase walk with phase-appropriate projects (E-26 #2)", () => {
    // Walk the pipeline prefix-by-prefix (runHeadless seals each phase); probe
    // EVERY registered item directly at every step — a throwing probe fails
    // the test instead of being swallowed by evaluate's defensive catch.
    const projects: Project[] = [seedProject(), promote(fullRun())];
    for (let k = 1; k <= ALL_PHASES.length; k++) {
      projects.push(runHeadless(seedProject(), ALL_PHASES.slice(0, k)));
    }
    for (const p of projects) {
      for (const phase of ALL_PHASES) {
        for (const item of DOD[phase as PhaseId]) {
          assert.doesNotThrow(() => item.probe(p), `probe ${item.id} threw (phase ${phase})`);
        }
      }
    }
  });

  it("runGate never throws and always returns a hash after every phase completion", () => {
    for (let k = 1; k <= ALL_PHASES.length; k++) {
      const p = runHeadless(seedProject(), ALL_PHASES.slice(0, k));
      const done = p.phases.filter((r) => r.status === "complete").map((r) => r.id);
      assert.equal(done.length, k, `prefix of ${k} phases completes`);
      for (const phase of ALL_PHASES) {
        const r = runGate(p, phase as PhaseId);
        assert.equal(typeof r.pass, "boolean");
        assert.ok(r.evidenceHash.length > 0);
      }
    }
  });

  it("probes never throw on adversarial project shapes (defensive evaluate)", () => {
    const stripped = fullRun();
    const adversarial: Project[] = [
      {} as Project,
      { lastTest: null } as Project,
      { ...stripped, artifacts: [], memory: [], competitors: [], research: [], logs: [] },
    ];
    for (const p of adversarial) {
      for (const phase of ALL_PHASES) {
        assert.doesNotThrow(
          () => runGate(p, phase as PhaseId),
          `runGate(P${phase}) threw on an adversarial shape`,
        );
      }
    }
  });

  it("evidenceHash is stable across an exportProjectJson round-trip for every phase (E-26 #3)", () => {
    const samples: Project[] = [fullRun(), promote(fullRun()), runToGate(seedProject(), 4)];
    for (const p of samples) {
      const parsed = JSON.parse(exportProjectJson(p)) as Project;
      for (const phase of ALL_PHASES) {
        assert.equal(
          runGate(p, phase as PhaseId).evidenceHash,
          runGate(parsed, phase as PhaseId).evidenceHash,
          `phase ${phase} evidenceHash drifted across the JSON round-trip`,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// T-14 (106 §6, finding F-11) — phase-coverage census on REAL runs. The rail
// line lives in packet.ts, but the numbers are a function of the run: this
// suite is where full and prefixed runs are cheap, so the census is pinned
// against the engine's own artifacts (independent recount) — W4-L5.
// ---------------------------------------------------------------------------

describe("T-14 — phase coverage census on real runs", () => {
  it("full 13-phase run: rail reports 13 of 13 / 8 P7–P12 artifacts", () => {
    const done = fullRun();
    assert.equal(done.status, "complete");
    assert.ok(
      done.packet.includes("Phase coverage: 13 of 13 phases executed / 8 artifacts from P7–P12"),
      `full-run packet carries the real census (got ${JSON.stringify(
        done.packet.match(/Phase coverage: [^\n]*/)?.[0] ?? null,
      )})`,
    );
    // Independent recount from the artifact rows the census consumes — the
    // stored kind "packet" row is NOT a phase deliverable and never counts.
    const tail = done.artifacts.filter((a) => a.phase >= 7 && a.kind !== "packet").length;
    assert.equal(tail, 8, "artifact rows independently agree with the rail's 8");
  });

  it("stopped 7-phase prefix: rail reports 7 of 13 / 0 — never the all-ran claim", () => {
    const partial = runHeadless(seedProject(), ALL_PHASES.slice(0, 7));
    assert.equal(
      partial.phases.filter((r) => r.status === "complete").length,
      7,
      "prefix run really sealed P0–P6",
    );
    assert.ok(
      partial.packet.includes("Phase coverage: 7 of 13 phases executed / 0 artifacts from P7–P12"),
      `prefix packet carries the honest census (got ${JSON.stringify(
        partial.packet.match(/Phase coverage: [^\n]*/)?.[0] ?? null,
      )})`,
    );
    assert.ok(
      !partial.packet.includes("13 of 13 phases executed"),
      "a stopped run must never carry the all-ran claim",
    );
  });
});

describe("oracle seeding seam (E-08 — pure core for the verify lane)", () => {
  const oracle = seedProject().oracle;
  const seedLineFor = (id: string): string => {
    const line = oracleToCaseSeeds(oracle)
      .split("\n")
      .find((l) => l.startsWith(`# ${id} `));
    assert.ok(line, `row ${id} has a seed line`);
    return line;
  };

  it("oracleToCaseSeeds renders every A7 row as a `# orc-…` comment line", () => {
    const seeded = oracleToCaseSeeds(oracle);
    const lines = seeded.split("\n");
    assert.equal(lines.length, oracle.length, "one seed line per oracle row");
    for (const row of oracle) {
      const line = seedLineFor(row.id);
      assert.ok(line.includes(row.name), `${row.id}: name present`);
      assert.ok(line.includes(row.given), `${row.id}: given present`);
      assert.ok(line.includes(row.expect), `${row.id}: expect present`);
    }
    assert.ok(seeded.startsWith("# orc-1 "), "first row is pinned first");
  });

  it("is deterministic and empty for an empty oracle", () => {
    assert.equal(oracleToCaseSeeds(oracle), oracleToCaseSeeds(oracle));
    assert.equal(oracleToCaseSeeds([]), "");
  });

  it("missingOracleCaseIds reports only dropped seeded ids, in seed order", () => {
    const ids = oracle.map((o) => o.id);
    assert.deepEqual(missingOracleCaseIds(ids, oracle), []);
    assert.deepEqual(
      missingOracleCaseIds(
        ids.filter((_, i) => i !== 1),
        oracle,
      ),
      [ids[1]],
    );
    assert.deepEqual(missingOracleCaseIds(["extra-case"], oracle), ids);
  });
});

describe("fixtures", () => {
  it("seedProject primes a fixture project with name, brief and lattice", () => {
    const p = seedProject();
    assert.equal(p.name, "Fixture");
    assert.match(p.brief, /dispatch/);
    assert.ok(p.lattice && p.lattice.jobs.length >= 1);
    assert.equal(p.currentPhase, 0);
  });

  it("seedProject applies overrides", () => {
    const p = seedProject({ name: "Renamed", brief: "custom brief" });
    assert.equal(p.name, "Renamed");
    assert.equal(p.brief, "custom brief");
  });

  it("runHeadless through P12 seals the pipeline with human approvals", () => {
    const done = fullRun();
    assert.equal(done.status, "complete");
    assert.equal(done.currentPhase, 12);
    assert.ok(done.phases.every((r) => r.status === "complete"));
    const humanApprovals = done.decisions.filter(
      (d) => d.decidedBy === "human" && d.decision === "approve",
    );
    assert.ok(humanApprovals.length >= 4, "P4/P5/P8/P9 gates were approved by a human");
  });

  it("runToGate(1) seals P0 and parks at the mouth of P1", () => {
    const g = runToGate(seedProject(), 1);
    assert.equal(g.currentPhase, 1);
    assert.equal(g.phases.find((r) => r.id === 0)?.status, "complete");
    assert.equal(g.phases.find((r) => r.id === 1)?.status, "ready");
    assert.equal(readyFor(g, 1).ready, true);
    assert.equal(runGate(g, 1).pass, false, "P1 itself has not run yet");
  });

  it("runToGate(5) parks with the P4 gate sealed (DoD met, human-approved)", () => {
    const g = runToGate(seedProject(), 5);
    assert.equal(g.currentPhase, 5);
    assert.equal(g.phases.find((r) => r.id === 4)?.status, "complete");
    assert.equal(runGate(g, 4).pass, true);
    assert.equal(readyFor(g, 5).ready, true);
  });
});

describe("P0-01/P0-02 brief-conformance probes (fixes/97)", () => {
  it("p6-brief-fit FAILS on the deterministic placeholder for a vocabulary-bearing brief", () => {
    const floor = runHeadless(seedProject(), [0, 1, 2, 3, 4, 5, 6]);
    const r = runGate(floor, 6);
    assert.equal(r.pass, false);
    assert.ok(r.unmet.some((g) => g.id === "p6-brief-fit"));
  });

  it("p6-brief-fit PASSES when required brief nouns appear as code identifiers", () => {
    const faithful = promote(fullRun());
    const r = runGate(faithful, 6);
    assert.equal(r.pass, true);
    assert.ok(!r.unmet.some((g) => g.id === "p6-brief-fit"));
  });

  it("p6-brief-fit passes vacuously for a vocabulary-free brief", () => {
    // Stopword-only brief: every token is stopped → nothing to conform.
    const p = promote(
      runHeadless(seedProject({ brief: "a simple tiny web app with the basic tool" }), ALL_PHASES),
    );
    const r = runGate(p, 6);
    assert.ok(!r.unmet.some((g) => g.id === "p6-brief-fit"));
  });

  it("p6-brief-fit counts CODE identifiers only — string/comments never satisfy it", () => {
    const p = promote(
      runHeadless(seedProject({ brief: "a board tool" }), ALL_PHASES),
    );
    // "board" lives only inside a comment + a string literal → masked → FAIL.
    const stringOnly = {
      ...p,
      generatedSource:
        '// this module is about board\nconst label = "board";\nfunction core() { return 1; }\n',
    } as Project;
    const r = runGate(stringOnly, 6);
    assert.ok(r.unmet.some((g) => g.id === "p6-brief-fit"));
  });

  it("322 X1 (P6-C): p6-brief-fit bar 0.35 — need ceil(20×0.35)=7: six nouns FAIL, seven PASS", () => {
    // Curated 20-noun prose brief (pairwise non-substring; verified stem-clean).
    const NOUN20 =
      "aurora basalt cipher dune ember fjord glade harbor isle juniper kestrel lagoon mesa nimbus orchid peak quarry ridge summit tundra";
    const p = promote(runHeadless(seedProject({ brief: NOUN20 }), ALL_PHASES));
    const src = (k: number) =>
      NOUN20.split(" ")
        .slice(0, k)
        .map((n) => `const ${n} = 0;`)
        .join("\n");
    const six = { ...p, generatedSource: src(6) } as Project;
    assert.ok(
      runGate(six, 6).unmet.some((g) => g.id === "p6-brief-fit"),
      "6 hits < the 0.35 need of 7 must stay red",
    );
    const seven = { ...p, generatedSource: src(7) } as Project;
    assert.ok(
      !runGate(seven, 6).unmet.some((g) => g.id === "p6-brief-fit"),
      "7 hits ≥ the 0.35 need of 7 must pass",
    );
    // Provenance: the old ½ bar demanded 10 — this same 7-hit source was red
    // under it (322 X1 measured honest coverage 40–50% on real artifacts).
  });

  it("p0-brief-grounded records a vocabulary-bearing brief that sailed on the fallback lattice", () => {
    const vague = emptyProject({ name: "Vague", brief: "hi" });
    const parked = applyPhaseResult(vague, 0);
    assert.equal(parked.scorecard?.verdict, "reframe");
    const r = runGate(parked, 0);
    // brief "hi" has no token longer than 2 → vocabulary-free → probe passes
    // vacuously; the reframe verdict is the unmet criterion.
    assert.ok(!r.unmet.some((g) => g.id === "p0-brief-grounded"));
    // A REAL vocabulary-bearing brief with a hand-forced vague lattice fails it.
    const forced = {
      ...seedProject(),
      lattice: { ...seedProject().lattice!, vague: true },
      scorecard: { ...(applyPhaseResult(seedProject(), 0).scorecard as object) },
    } as Project;
    const r2 = runGate(forced, 0);
    assert.ok(
      r2.unmet.some((g) => g.id === "p0-brief-grounded"),
      "real-brief run on fallback vocabulary must be recorded as ungrounded",
    );
  });
});

describe("P0-03/P0-04/P0-05 artifact honesty (fixes/97)", () => {
  const phaseArtifact = (p: Project, phase: number, kind: string) =>
    p.artifacts.find((a) => a.phase === phase && a.kind === kind);

  it("P8 emits a CLI surface contract for cli briefs — no RapidTool console wording", () => {
    const p = applyPhaseResult(
      seedProject({ name: "RenamePro", brief: "A CLI tool to batch-rename files with dry-run, undo and regex matching." }),
      8,
    );
    const a = phaseArtifact(p, 8, "ui");
    assert.ok(a);
    assert.equal(a.title, "CLI surface contract");
    assert.ok(!/phase rail|scorecard, artifacts, approval dock/.test(a.body));
    assert.match(a.body, /Kind: cli-tool/);
    assert.match(a.body, /declaration \(deterministic template\), not an implementation/);
  });

  it("P8 emits a Library API contract carrying the spec typeSignatures when keyed", () => {
    const spec = {
      requirements: ["compute summary statistics"],
      edgeCases: [],
      errorHandling: [],
      typeSignatures: ["export function mean(xs: number[]): number"],
      dataFlow: [],
      negativeConstraints: [],
      source: "p6" as const,
      briefHash: "stale",
      createdAt: Date.now(),
    };
    const p = applyPhaseResult(
      seedProject({
        name: "StatKit",
        brief: "A statistics library with mean, median and standard deviation functions.",
        implementationSpec: spec,
      }),
      8,
    );
    const a = phaseArtifact(p, 8, "ui");
    assert.ok(a);
    assert.equal(a.title, "Library API contract");
    assert.match(a.body, /export function mean\(xs: number\[\]\): number/);
    assert.ok(!a.body.includes("prototype pending"), "keyed (spec present) body omits the keyless tail");
  });

  it("P8 emits a client UI contract for UI-bearing briefs (no console surfaces)", () => {
    const p = applyPhaseResult(seedProject(), 8);
    const a = phaseArtifact(p, 8, "ui");
    assert.ok(a);
    assert.equal(a.title, "Interface contract (client UI)");
    assert.match(a.body, /Screen:/);
    assert.ok(!/phase rail|approval dock|artifact inspector/.test(a.body));
    assert.ok(!/Framework: React \+ Tailwind \(component agents\)/.test(a.body));
  });

  it("P8 keyless screens are entity-management surfaces, never one screen per verb (fixes/136)", () => {
    const brief =
      "Build a rental portfolio manager for landlords. Track each rental property, its tenants and lease terms, collect rent payments, and show vacancy and cash-flow dashboards.";
    const p = applyPhaseResult(seedProject({ name: "RentLedger", brief }), 8);
    const a = phaseArtifact(p, 8, "ui");
    assert.ok(a);
    assert.match(a.body, /Screen: property/, "property is a screen");
    assert.match(a.body, /Screen: tenant/, "tenant is a screen");
    assert.match(a.body, /Responsibility: .* management/, "screens declare a management responsibility");
    assert.match(a.body, /Actions:/, "lattice jobs are listed as actions, not screens");
    assert.match(a.body, /Actions: .*lease/, "the lease flow is bound as an action");
    for (const verb of ["track", "show", "rent", "lease"]) {
      assert.ok(
        !new RegExp(`Screen: ${verb}\\b`).test(a.body),
        `must not emit a verb screen (Screen: ${verb})`,
      );
    }
  });

  it("P8 keyless maintenance tracker ships no register-noise screens (fixes/136)", () => {
    const brief =
      "Maintenance tracker. Track requests and open tickets, schedule repairs, create work orders per asset, show a status dashboard.";
    const p = applyPhaseResult(seedProject({ name: "Maint", brief }), 8);
    const a = phaseArtifact(p, 8, "ui");
    assert.ok(a);
    assert.match(a.body, /Screen: (ticket|work-order|dashboard|asset)/, "real product surfaces are screens");
    for (const noise of ["showing", "landlord", "listing"]) {
      assert.ok(
        !new RegExp(`Screen: ${noise}\\b`).test(a.body),
        `must not emit a register-noise screen (Screen: ${noise})`,
      );
    }
  });

  it("P8 keyless regression: a rental brief still classifies real-estate and yields property/tenant/lease", () => {
    const brief =
      "Build a rental portfolio manager for landlords. Track each rental property, its tenants and lease terms, collect rent payments, and show vacancy and cash-flow dashboards.";
    // Use the REAL create path (emptyProject — the fixture's logistics default
    // must not mask classification): inferDomain must land real-estate.
    const p = applyPhaseResult(emptyProject({ name: "RentLedger", brief }), 8);
    assert.equal(p.lattice?.domain, "real-estate", "rental brief still classifies real-estate");
    const a = phaseArtifact(p, 8, "ui");
    assert.ok(a);
    assert.match(a.body, /Screen: property/);
    assert.match(a.body, /Screen: tenant/);
    assert.match(a.body, /Actions: .*lease/);
  });

  it("P1 keeps 'Dispatcher topology' for agent-vocabulary briefs, 'Execution topology' otherwise", () => {
    const agent = applyPhaseResult(seedProject(), 1);
    const a1 = phaseArtifact(agent, 1, "graph");
    assert.equal(a1?.title, "Dispatcher topology");
    assert.ok(!/workflow\.parallel|workflow\.loop|failover\.LiteLLM/.test(a1?.body ?? ""));

    const cli = applyPhaseResult(
      seedProject({ name: "Renamer", brief: "A CLI tool to batch-rename files with dry-run, undo and regex." }),
      1,
    );
    const a2 = phaseArtifact(cli, 1, "graph");
    assert.equal(a2?.title, "Execution topology (this build)");
    assert.match(a2?.body ?? "", /Sequential pipeline:/);
  });

  it("P2/P3/P5/P10/P11 bodies carry capability honesty — no retired claims", () => {
    const p = applyPhaseResult(seedProject(), 2);
    const mem = phaseArtifact(p, 2, "memory");
    assert.ok(mem);
    assert.ok(!/Durable checkpoint key|RRF\(k=60\)|cross-encoder re-rank/.test(mem.body));
    // D3: the P2 memory body now narrates the PRODUCT's state (brief nouns),
    // not the engine's mechanism — with the honest persistence boundary.
    assert.match(mem.body, /Records:/);
    assert.match(mem.body, /dispatch|board|field/);
    assert.match(mem.body, /no specific database or durable store is claimed/);

    const p3 = applyPhaseResult(seedProject(), 3);
    const mcp = phaseArtifact(p3, 3, "mcp");
    const parsed3 = JSON.parse(mcp!.body) as Record<string, unknown>;
    // D3: the P3 integration artifact is now a brief-derived surface map with
    // the honest "declarations, not implemented bindings" boundary.
    assert.ok(Array.isArray(parsed3.surface), "surface is a list of integration surfaces");
    assert.match(String(parsed3.note ?? ""), /not implemented bindings/);
    assert.ok(!/"name": "search\.brave"/.test(mcp!.body));

    const p5 = applyPhaseResult(seedProject(), 5);
    const val = phaseArtifact(p5, 5, "validation");
    assert.ok(!/Simulated user paths/.test(val!.body));
    assert.match(val!.body, /Validation contract/);

    const p10 = applyPhaseResult(seedProject(), 10);
    const edge = phaseArtifact(p10, 10, "edge");
    assert.ok(!/Primary: grok-4\.5|Edge: Ollama/.test(edge!.body));
    // D3: the P10 compute narrative is product-derived + honest about scope.
    assert.match(edge!.body, /No remote model inference or edge handoff is claimed/);

    const p11 = applyPhaseResult(seedProject(), 11);
    const tools = phaseArtifact(p11, 11, "tools");
    const parsed11 = JSON.parse(tools!.body) as Record<string, unknown>;
    assert.ok(!("provider" in parsed11) || parsed11.provider !== "brave.search");
    // D3/P0-04: declared capabilities are the brief-derived surfaces map with
    // the honest declared-not-bound boundary, never a bare string.
    assert.ok(Array.isArray(parsed11.surfaces), "surfaces list present");
    assert.match(String(parsed11.note ?? ""), /declared, not bound at runtime/);
  });

  it("P4 gate prompt confirms the implemented boundary, never an unimplemented policy (P0-05 S1)", () => {
    const p = applyPhaseResult(seedProject(), 4);
    assert.ok(p.hitl);
    assert.match(p.hitl.prompt, /Engine-template runner/);
    assert.match(p.hitl.prompt, /ramMb/);
    assert.ok(!/^Confirm 256 MB \/ 30s isolate/.test(p.hitl.prompt));
    assert.match(p.hitl.prompt, /Declared-not-implemented \(do NOT approve as fact\)/);
  });
});

describe("fixes/132 — enforceDod create defaults (keyed default-on, advisory override)", () => {
  const savedKey = process.env.DEEPSEEK_API_KEY;
  const withKey = (value: string | undefined, fn: () => void): void => {
    try {
      if (value === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = value;
      fn();
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  };

  it("deterministic (keyless) runs keep the advisory default: enforceDod false", () => {
    withKey(undefined, () => {
      const p = emptyProject({ name: "Det", brief: "Build a deterministic tool." });
      assert.equal(p.enforceDod, false, "no key → advisory-only default");
    });
  });

  it("keyed runs default enforceDod ON (a configured LLM may not silently leave failing gates)", () => {
    withKey("sk-live-132-probe", () => {
      const p = emptyProject({ name: "Keyed", brief: "Build a keyed dispatch board." });
      assert.equal(p.enforceDod, true, "DEEPSEEK_API_KEY set → hard-DoD default");
    });
  });

  it("an explicit enforceDod:false wins over the keyed default (CLI --advisory path)", () => {
    withKey("sk-live-132-probe", () => {
      const p = emptyProject({ name: "Advisory", brief: "Build an advisory tool.", enforceDod: false });
      assert.equal(p.enforceDod, false, "--advisory sends explicit false under a keyed env");
    });
  });

  it("an explicit enforceDod:true wins under a keyless env", () => {
    withKey(undefined, () => {
      const p = emptyProject({ name: "Strict", brief: "Build a strict tool.", enforceDod: true });
      assert.equal(p.enforceDod, true, "explicit true is honored without a key");
    });
  });

  it("a blank key is keyless (trim parity with isDeepSeekConfigured)", () => {
    withKey("   ", () => {
      const p = emptyProject({ name: "Blank", brief: "Build a blank-key tool." });
      assert.equal(p.enforceDod, false, "whitespace-only key → advisory default");
    });
  });
});

// ---------------------------------------------------------------------------
// fixes/144 (M2, lane B4) — p6-arch: tree capability probe + engine reqTrace
// ---------------------------------------------------------------------------
// Fixtures: an expanded spec whose typeSignatures demand `createBoard` +
// `addColumn`, and tree files whose CODE (not comments/strings) carries those
// identifiers. archProject() rides the promoted full-run shape so every other
// P6 probe (p6-test/source/artifact/verified/brief-fit) is green and p6-arch
// is the only axis under test.

const ARCH_TREE_SPEC = {
  requirements: ["Board shows cards by status", "Columns hold cards"],
  edgeCases: [],
  errorHandling: [],
  typeSignatures: [
    "export function createBoard(name: string): Board",
    "export function addColumn(board: Board, title: string): Column",
  ],
  dataFlow: [],
  negativeConstraints: [],
  source: "p6" as const,
  briefHash: "arch-fixture",
  createdAt: 1,
} as Project["implementationSpec"];

const ARCH_BOARD_FILE = {
  path: "src/domain/board.ts",
  source: [
    "export type Board = { id: string; name: string; columns: Column[] };",
    "export function createBoard(name: string): Board { return { id: 'b1', name, columns: [] }; }",
  ].join("\n"),
  hash: "h-board",
  attempt: 0,
};

const ARCH_COLUMN_FILE = {
  path: "src/domain/column.ts",
  source: [
    "export type Column = { id: string; title: string };",
    "export function addColumn(board: Board, title: string): Column { return { id: 'c1', title }; }",
  ].join("\n"),
  hash: "h-column",
  attempt: 0,
};

type ArchTreeFile = NonNullable<Project["generatedTree"]>[number];
const archTree = (files: ArchTreeFile[]): NonNullable<Project["generatedTree"]> =>
  files as NonNullable<Project["generatedTree"]>;

const archProject = (
  tree: NonNullable<Project["generatedTree"]>,
  spec: Project["implementationSpec"] = ARCH_TREE_SPEC,
): Project =>
  ({
    ...promote(fullRun()),
    generatedTree: tree,
    implementationSpec: spec,
  }) as Project;

const reqTraceTitle = "P6 architecture trace (reqTrace)";

describe("fixes/144 M2 — p6-arch probe over generatedTree (archTrace)", () => {
  it("passes when every typeSignature capability maps to a real tree file", () => {
    const p = archProject(archTree([ARCH_BOARD_FILE, ARCH_COLUMN_FILE]));
    const r = runGate(p, 6);
    assert.equal(r.pass, true, `unexpected unmet: ${r.unmet.map((u) => u.id).join(", ")}`);
    assert.ok(!r.unmet.some((g) => g.id === "p6-arch"), "p6-arch must pass on a full tree");
    const t = archTrace(p);
    assert.equal(t.present, true);
    assert.deepEqual(t.missing, []);
    assert.deepEqual(t.stubFiles, []);
    const row = t.rows.find((x) => x.capability.includes("createBoard"));
    assert.ok(row, "createBoard capability is traced");
    assert.ok(row!.files.includes("src/domain/board.ts"), "mapping names the real file");
    // deterministic: same project state → same evidence hash
    assert.equal(runGate(p, 6).evidenceHash, r.evidenceHash);
  });

  it("fails and NAMES the missing capability when the tree drops a typeSignature", () => {
    const p = archProject(archTree([ARCH_BOARD_FILE])); // addColumn file absent
    const r = runGate(p, 6);
    assert.equal(r.pass, false);
    assert.ok(r.unmet.some((g) => g.id === "p6-arch"), "p6-arch must be unmet");
    const t = archTrace(p);
    assert.deepEqual(
      t.missing,
      ["export function addColumn(board: Board, title: string): Column"],
      "the missing capability is named",
    );
  });

  it("fails when tree files are byte-identical to the deterministic template stub", () => {
    const floor = fullRun();
    const jobs = (floor.lattice?.jobs ?? ["core"]).slice(0, 5);
    const stub0 = buildPhase6Module({ name: floor.name, jobs, rejectionNote: null, variant: 0 });
    const stub1 = buildPhase6Module({ name: floor.name, jobs, rejectionNote: null, variant: 1 });
    const p = archProject(
      archTree([
        { path: "src/api/core.ts", source: stub0, hash: "h0", attempt: 0 },
        { path: "src/api/core-b.ts", source: stub1, hash: "h1", attempt: 1 },
      ]),
    );
    const r = runGate(p, 6);
    assert.ok(r.unmet.some((g) => g.id === "p6-arch"), "template-only tree must fail p6-arch");
    const t = archTrace(p);
    assert.deepEqual(t.stubFiles, ["src/api/core.ts", "src/api/core-b.ts"], "stub files named");
  });

  it("legacy: absent tree passes with the single-module note (keyless floor unchanged)", () => {
    const floor = fullRun(); // deterministic full run — no generatedTree
    const r = runGate(floor, 6);
    assert.ok(!r.unmet.some((g) => g.id === "p6-arch"), "p6-arch must pass on the keyless floor");
    const t = archTrace(floor);
    assert.equal(t.present, false);
    assert.equal(t.skipped, true, "absent tree is a skip, not product-complete");
    assert.equal(archProductComplete(t), false, "skip ≠ product-complete");
    assert.equal(t.note, "single-module (legacy path)");
    assert.deepEqual(t.rows, []);
    // the promoted (keyed single-module) shape without a tree passes too
    const promoted = promote(fullRun());
    const rp = runGate(promoted, 6);
    assert.ok(!rp.unmet.some((g) => g.id === "p6-arch"));
    assert.equal(archProductComplete(archTrace(promoted)), false);
  });

  it("keyless lattice path: job vocabulary maps to tree files when no spec exists", () => {
    const p = {
      ...promote(fullRun()),
      lattice: {
        domain: "logistics",
        jobs: ["dispatch board", "track jobs", "order parts"],
        entities: ["board"],
        constraints: [],
        nodes: [],
        complexity: 3,
      },
      implementationSpec: null,
      generatedTree: archTree([
        {
          path: "src/domain/dispatch.ts",
          source: [
            "export function dispatchBoard() { return []; }",
            "export function trackJobs() { return []; }",
            "export function orderParts() { return []; }",
            "if (typeof module !== 'undefined' && module.exports) { module.exports.dispatchBoard = dispatchBoard; }",
          ].join("\n"),
          hash: "h-dispatch",
          attempt: 0,
        },
      ]),
    } as Project;
    const t = archTrace(p);
    assert.deepEqual(t.missing, [], `lattice jobs must all map: ${JSON.stringify(t.missing)}`);
    assert.ok(t.rows.length >= 3, `expected ≥3 capability rows: ${JSON.stringify(t.rows)}`);
    assert.equal(runGate(p, 6).pass, true);
  });

  it("maps type/interface and bare signatures by their declared name", () => {
    const spec = {
      ...ARCH_TREE_SPEC,
      typeSignatures: [
        "export type LeaseStatus = 'active' | 'ended'",
        "renewLease(leaseId: string): boolean",
      ],
    } as Project["implementationSpec"];
    const p = archProject(
      archTree([
        {
          path: "src/domain/lease.ts",
          source: [
            "export type LeaseStatus = 'active' | 'ended';",
            "export function renewLease(leaseId: string): boolean { return true; }",
          ].join("\n"),
          hash: "h-lease",
          attempt: 0,
        },
      ]),
      spec,
    );
    const t = archTrace(p);
    assert.deepEqual(t.missing, [], `both declared names must map: ${JSON.stringify(t.missing)}`);
    assert.equal(runGate(p, 6).pass, true);
    assert.equal(t.skipped, false);
    assert.equal(archProductComplete(t), true);
  });

  it("TODO(E-15) stub tree fails p6-arch (stub ≠ product-complete)", () => {
    const stub = [
      "export function createBoard(name: string) {",
      '  throw new Error("TODO(E-15) stub: implement job createBoard");',
      "}",
    ].join("\n");
    const p = archProject(archTree([{ path: "src/domain/board.ts", source: stub, hash: "h-stub", attempt: 0 }]));
    const r = runGate(p, 6);
    assert.ok(r.unmet.some((g) => g.id === "p6-arch"), "TODO(E-15) stub must fail p6-arch");
    const t = archTrace(p);
    assert.ok(t.stubFiles.includes("src/domain/board.ts"));
    assert.equal(archProductComplete(t), false);
    assert.equal(isStubSource(stub), true);
  });

  it("reexport-only leftover job fails p6-arch", () => {
    const reexport = 'export { createBoard, addColumn } from "./host.ts";\n';
    assert.equal(isReexportOnlySource(reexport), true);
    const p = archProject(
      archTree([{ path: "src/jobs/leftover.ts", source: reexport, hash: "h-re", attempt: 0 }]),
    );
    const r = runGate(p, 6);
    assert.ok(r.unmet.some((g) => g.id === "p6-arch"), "reexport-only file must fail p6-arch");
    const t = archTrace(p);
    assert.ok(t.stubFiles.includes("src/jobs/leftover.ts"));
    assert.equal(archProductComplete(t), false);
  });

  it("isStubSource pins real code as not a stub", () => {
    assert.equal(isStubSource("export function createBoard() { return { id: 'b1' }; }"), false);
    assert.equal(isReexportOnlySource("export function createBoard() { return 1; }"), false);
  });
});

describe("fixes/144 M2 — engine P6 reqTrace stamp + gate record", () => {
  it("stampP6ReqTrace writes the reqTrace artifact + log; absent tree is a same-reference no-op", () => {
    const withTree = archProject(archTree([ARCH_BOARD_FILE, ARCH_COLUMN_FILE]));
    const stamped = stampP6ReqTrace(withTree);
    assert.notEqual(stamped, withTree, "tree project gains the reqTrace stamp");
    const art = stamped.artifacts.find((a) => a.phase === 6 && a.title === reqTraceTitle);
    assert.ok(art, "reqTrace artifact present");
    assert.match(art!.body, /p6-arch: PASS/);
    assert.ok(art!.body.includes("export function createBoard(name: string): Board"));
    assert.ok(art!.body.includes("src/domain/board.ts"));
    assert.ok(stamped.logs.some((l) => l.event === "dod.reqtrace" && String(l.detail).includes("PASS")));
    // idempotent: re-stamp replaces, never duplicates artifact or log
    const re = stampP6ReqTrace(stamped);
    assert.equal(
      re.artifacts.filter((a) => a.phase === 6 && a.title === reqTraceTitle).length,
      1,
      "exactly one reqTrace artifact after re-stamp",
    );
    assert.equal(
      re.logs.filter((l) => l.event === "dod.reqtrace" && String(l.detail).includes("PASS")).length,
      1,
      "re-stamp with identical detail does not append a second log row",
    );
    // legacy no-op: same reference, nothing added
    const legacy = fullRun();
    assert.equal(stampP6ReqTrace(legacy), legacy, "tree-absent project returned unchanged");
  });

  it("the stamp NAMES the missing capability in the artifact body + log", () => {
    const p = archProject(archTree([ARCH_BOARD_FILE])); // addColumn missing
    const stamped = stampP6ReqTrace(p);
    const art = stamped.artifacts.find((a) => a.phase === 6 && a.title === reqTraceTitle);
    assert.ok(art, "reqTrace artifact present on a failing tree");
    assert.match(art!.body, /p6-arch: FAIL/);
    assert.ok(art!.body.includes("Missing capabilities"), "artifact lists the missing section");
    assert.ok(
      art!.body.includes("export function addColumn(board: Board, title: string): Column"),
      "artifact names the missing capability",
    );
    assert.ok(
      stamped.logs.some(
        (l) => l.event === "dod.reqtrace" && String(l.detail).includes("missing: export function addColumn"),
      ),
      "log names the missing capability",
    );
  });

  it("applyPhaseResult on a tree-carrying P6 stamps the reqTrace; recordGateInto records p6-arch", () => {
    // A P6 re-apply whose project already carries the tree (repair path).
    const out = applyPhaseResult(archProject(archTree([ARCH_BOARD_FILE, ARCH_COLUMN_FILE])), 6);
    const art = out.artifacts.find((a) => a.phase === 6 && a.title === reqTraceTitle);
    assert.ok(art, "applyPhaseResult stamps the reqTrace artifact");
    assert.match(art!.body, /p6-arch: PASS/);
    assert.ok(out.logs.some((l) => l.event === "dod.reqtrace"));
    // The P6 record path (recordGateInto — what approveHitl/store/headless
    // share) records the p6-arch verdict into phases[6].gate like every probe.
    const p = archProject(archTree([ARCH_BOARD_FILE, ARCH_COLUMN_FILE]));
    const recorded = recordGateInto(p, 6);
    const rec = recorded.phases.find((r) => r.id === 6);
    assert.ok(rec?.gate, "gate recorded");
    assert.equal(rec!.gate!.passed, true, "tree covering its spec passes the recorded gate");
    assert.deepEqual(rec!.gate!.unmet, [], "no unmet criteria");
    assert.equal(rec!.gate!.evidenceHash, runGate(p, 6).evidenceHash);
    // and the failing shape records p6-arch's criterion as unmet
    const bad = archProject(archTree([ARCH_BOARD_FILE]));
    const recordedBad = recordGateInto(bad, 6);
    const recBad = recordedBad.phases.find((r) => r.id === 6);
    assert.equal(recBad!.gate!.passed, false);
    assert.ok(
      recBad!.gate!.unmet.some((u) => u.includes("Tree architecture")),
      `unmet names the p6-arch criterion: ${JSON.stringify(recBad!.gate!.unmet)}`,
    );
  });

  it("deterministic (tree-absent) applies add NO reqTrace artifact or log (keyless floor byte-identical)", () => {
    const floor = fullRun();
    const out = applyPhaseResult(floor, 6);
    assert.ok(
      !out.artifacts.some((a) => a.phase === 6 && a.title === reqTraceTitle),
      "no reqTrace artifact on the keyless floor",
    );
    assert.ok(!out.logs.some((l) => l.event === "dod.reqtrace"), "no dod.reqtrace log on the keyless floor");
    assert.equal(stampP6ReqTrace(floor), floor, "stamp is a same-reference no-op without a tree");
  });
});

// ---------------------------------------------------------------------------
// D2 reframe-lessons read-back (fixes/144 M5/D2 — the §E4 open item): the P0
// reframe HITL prompt gains the advisory "Lessons from prior runs" block when
// (a) the engine's lazy knowledge seam is warm AND (b) the project's own
// memory carries lesson-tagged rows. Zero lesson rows → byte-identical legacy
// prompt. Seam-warming: engine.ts (lines 57-103) resolves LessonSurface via a
// module-level `void import("./knowledge.ts")` whose .then is registered at
// engine evaluation — BEFORE any test body runs — so awaiting the same
// dynamic import here guarantees the surface is populated when execution
// continues (module-map dedupe → engine's earlier-registered callback fires
// first). Deterministic under node:test's sequential in-file execution.
// ---------------------------------------------------------------------------
describe("D2 reframe-lessons read-back (fixes/144 M5/D2)", () => {
  const BASE_REFRAKE_PROMPT =
    "Scorecard verdict is reframe. Approve only if you accept the risk, or reject with a tighter brief.";

  // Lesson-tagged semantic rows of the shape the L1/L2 writers mint: phase 0
  // (the phase being gated), evidence-style text, human provenance.
  const lessonRows: MemoryEntry[] = [
    {
      id: "lesson-0-prior-1",
      kind: "semantic",
      phase: 0,
      text: "Prior run: a vague brief naming no real-world job or entity strands P0 in reframe; name the actor, the record and the trigger before re-running.",
      score: 3,
      source: "human",
      tags: ["lesson"],
    },
    {
      id: "lesson-0-prior-2",
      kind: "semantic",
      phase: 0,
      text: "Prior run: keep feasibility nouns inside the brief's own vocabulary so the lattice LEX pass can hit them.",
      score: 2,
      source: "human",
      tags: ["lesson"],
    },
  ];

  /** Drive the P0 reframe path with a given memory payload and return the parked project. */
  const reframeParked = (memory: MemoryEntry[]) => {
    const withMemory = { ...emptyProject({ name: "Vague", brief: "hi" }), memory };
    const parked = applyPhaseResult(withMemory, 0);
    assert.equal(parked.status, "awaiting_hitl");
    assert.equal(parked.scorecard?.verdict, "reframe");
    return parked;
  };

  it("lesson-free memory keeps the reframe prompt byte-identical to the legacy base string", () => {
    // Empty memory short-circuits the read-back (`memory.length > 0` guard) —
    // the base string survives whether or not the seam is warm.
    const parked = reframeParked([]);
    assert.equal(parked.hitl?.prompt, BASE_REFRAKE_PROMPT);
  });

  it("warm seam + memory with NO lesson-tagged rows still emits the byte-identical base string", async () => {
    await import("./knowledge.ts"); // warm engine.ts's lazy LessonSurface seam
    const noise: MemoryEntry[] = [
      {
        id: "m-episodic-1",
        kind: "episodic",
        phase: 2,
        text: "an ordinary episodic row with no lesson tag must never surface in a reframe prompt",
        score: 0,
        source: "engine",
      },
    ];
    const parked = reframeParked(noise);
    assert.equal(parked.hitl?.prompt, BASE_REFRAKE_PROMPT);
  });

  it("warm seam + lesson-tagged memory adds the advisory lessons block, deterministically", async () => {
    await import("./knowledge.ts"); // warm engine.ts's lazy LessonSurface seam
    const parked = reframeParked(lessonRows);
    const prompt = parked.hitl?.prompt ?? "";
    assert.ok(prompt.startsWith(BASE_REFRAKE_PROMPT), "the base line leads the enriched prompt");
    assert.ok(
      prompt.includes("Lessons from prior runs (advisory"),
      "advisory lessons header present in the reframe HITL prompt",
    );
    assert.ok(prompt.includes(lessonRows[0].text), "the top-ranked lesson row is rendered verbatim");
    assert.ok(/- \[semantic [0-9.]+\] /.test(prompt), `lesson lines render as '- [kind score] text' bullets: ${prompt}`);
    // Deterministic: re-applying the same payload yields the byte-identical prompt.
    const again = applyPhaseResult(
      { ...emptyProject({ name: "Vague", brief: "hi" }), memory: lessonRows },
      0,
    );
    assert.equal(again.hitl?.prompt, prompt);
  });
});

// ---------------------------------------------------------------------------
// W16 L4 (OV-14) — skip ≠ complete, made OBSERVABLE. `archProductComplete`
// (dod.ts:232) is computed but has no production caller; the p6-arch verdict's
// only production surface is the reqTrace artifact + its `dod.reqtrace` log row
// (engine.ts stampP6ReqTrace → rendered by the packet's artifact list; the
// packet half is proven in packet.test.ts). This block pins, against bytes:
//   (a) for tree-carrying projects the artifact verdict IS archProductComplete
//       (PASS ⇔ true, FAIL ⇔ false) — the surface carries the predicate;
//   (b) the SKIPPED shape surfaces as SILENCE, and the recorded gate cannot
//       tell it from a real tree — exactly the invisibility OV-14 names.
// The packet-side explicit value is a fix in a file outside this lane's box:
// exact patch proposal in fixes/244_lane4_pinned_windows.md §OV-14.
// ---------------------------------------------------------------------------
describe("W16 L4 — OV-14 skip≠complete observability via the reqTrace artifact", () => {
  it("tree-carrying: the reqTrace artifact verdict tracks archProductComplete exactly (PASS ⇔ true, FAIL ⇔ false)", () => {
    const complete = stampP6ReqTrace(archProject(archTree([ARCH_BOARD_FILE, ARCH_COLUMN_FILE])));
    const okArt = complete.artifacts.find((a) => a.phase === 6 && a.title === reqTraceTitle);
    assert.ok(okArt, "reqTrace artifact present on the complete tree");
    assert.match(okArt!.body, /\*\*p6-arch: PASS\*\* · tree \(2 files\)/, "artifact states PASS + the tree note");
    assert.equal(
      archProductComplete(archTrace(complete)),
      true,
      "the PASS surface ⇔ product-complete (the artifact is a reader's only view of the predicate)",
    );

    const missing = stampP6ReqTrace(archProject(archTree([ARCH_BOARD_FILE])));
    const badArt = missing.artifacts.find((a) => a.phase === 6 && a.title === reqTraceTitle);
    assert.ok(badArt, "reqTrace artifact present on the failing tree");
    assert.match(badArt!.body, /\*\*p6-arch: FAIL\*\*/, "the failing tree's artifact states FAIL");
    assert.ok(
      badArt!.body.includes("Missing capabilities") &&
        badArt!.body.includes("export function addColumn(board: Board, title: string): Column"),
      "the FAIL surface names the missing capability (missing/stub trees are visibly NOT complete)",
    );
    assert.equal(
      archProductComplete(archTrace(missing)),
      false,
      "the FAIL surface ⇔ not product-complete — verdict and predicate agree on every tree-carrying shape",
    );
  });

  it("skipped: the distinction surfaces as silence — gate passes, stamp writes nothing, gate record cannot tell skip from tree", () => {
    // The SKIP shape aligned on every other axis: a promoted full run (every
    // probe green — pinned at :97-108) with NO tree. Its sibling below
    // (archProject) differs only in the p6-arch inputs it reads (generatedTree
    // + implementationSpec) — every other probe sees identical state, so any
    // gate-record difference would have to come from the arch axis.
    const skipped = promote(fullRun());
    const tSkip = archTrace(skipped);
    assert.equal(tSkip.skipped, true, "absent tree is the SKIP shape");
    assert.equal(archProductComplete(tSkip), false, "skip ≠ product-complete (the fact under test)");
    assert.ok(
      !runGate(skipped, 6).unmet.some((g) => g.id === "p6-arch"),
      "p6-arch passes vacuously on the skip (the keyless floor is not hard-broken)",
    );
    assert.equal(
      stampP6ReqTrace(skipped),
      skipped,
      "the stamp is a same-reference no-op: a skip writes NO reqTrace artifact and NO dod.reqtrace log",
    );
    assert.ok(
      !(skipped.artifacts ?? []).some((a) => a.phase === 6 && a.title === reqTraceTitle),
      "no reqTrace artifact on the skip",
    );
    assert.ok(
      !(skipped.logs ?? []).some((l) => l.event === "dod.reqtrace"),
      "no dod.reqtrace log row on the skip",
    );

    const tree = archProject(archTree([ARCH_BOARD_FILE, ARCH_COLUMN_FILE]));
    const recSkip = recordGateInto(skipped, 6).phases.find((r) => r.id === 6)?.gate;
    const recTree = recordGateInto(tree, 6).phases.find((r) => r.id === 6)?.gate;
    assert.equal(recSkip?.passed, true, "the skip records a PASSING gate");
    assert.equal(recTree?.passed, true, "the tree records a PASSING gate");
    assert.equal(
      recSkip?.passed,
      recTree?.passed,
      "on the gate axis the two shapes are indistinguishable — skip≠complete cannot be read back from the gate record",
    );
    assert.notEqual(
      archProductComplete(archTrace(skipped)),
      archProductComplete(archTrace(tree)),
      "…while the predicate itself DOES differ: the fact exists, only the surface is missing (proposal in fixes/244)",
    );
  });
});
