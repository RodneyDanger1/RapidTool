import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { seedProject, runToGate } from "./testing/fixtures.ts";
import {
  CREW_PROTOCOL_EMITS,
  SWARM_ROLE_IDS,
  SWARM_ROLES,
  branchSuggest,
  frontierOf,
  isCrewProtocolEmit,
  kindsRecorded,
  parallelDag,
  phaseRecord,
  scanForMarkers,
  seatsForPhase,
  swarmPlan,
  SWARM_SCAN_SOURCE_MAX_CHARS,
} from "./swarm.ts";
import type { SwarmRoleId } from "./swarm.ts";
import type { Artifact, ArtifactKind, PhaseId, PhaseStatus, Project } from "./types.ts";

const clone = <T>(x: T): T => structuredClone(x);

const PHASE_IDS: PhaseId[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function setStatus(p: Project, id: PhaseId, status: PhaseStatus): Project {
  return {
    ...p,
    phases: p.phases.map((r) => (r.id === id ? { ...r, status } : r)),
  };
}

function withHitl(p: Project, id: PhaseId): Project {
  return {
    ...p,
    status: "awaiting_hitl",
    hitl: { phase: id, title: "Approve", prompt: "Approve this edge", stakes: "test" },
    phases: p.phases.map((r) =>
      r.id === id ? { ...r, status: "awaiting_hitl" as const } : r,
    ),
  };
}

function sealUpTo(p: Project, upTo: PhaseId): Project {
  return {
    ...p,
    currentPhase: Math.min(12, (upTo + 1) as PhaseId) as PhaseId,
    phases: p.phases.map((r) => {
      if (r.id <= upTo) return { ...r, status: "complete" as const };
      if (r.id === ((upTo + 1) as PhaseId)) return { ...r, status: "ready" as const };
      return r;
    }),
  };
}

const art = (phase: PhaseId, kind: ArtifactKind): Artifact => ({
  id: `a-${phase}-${kind}`,
  phase,
  kind,
  title: `${kind}@${phase}`,
  body: `recorded ${kind} output for phase ${phase}`,
});

function expectRolesFor(phase: PhaseId, expected: SwarmRoleId[]): void {
  assert.deepEqual(seatsForPhase(phase), expected, `seat activation at P${phase}`);
}

describe("SWARM_ROLES — crew protocol conformance", () => {
  it("covers every declared seat with ROLE_SPECS-compatible spec fields", () => {
    assert.deepEqual(Object.keys(SWARM_ROLES).sort(), [...SWARM_ROLE_IDS].sort());
    for (const id of SWARM_ROLE_IDS) {
      const spec = SWARM_ROLES[id];
      assert.ok(spec.id === id, `${id} spec id matches its key`);
      assert.ok(spec.label.length > 0, `${id} label`);
      assert.ok(spec.model === "flash" || spec.model === "pro", `${id} model tier`);
      assert.ok(Number.isInteger(spec.budgetTokens) && spec.budgetTokens > 0, `${id} budget`);
      assert.ok(spec.system.length > 0 && spec.system.includes("advisory"), `${id} system`);
      assert.ok(spec.prompt.length > 0, `${id} prompt directive`);
      assert.ok(spec.emit.length > 0, `${id} emit kinds`);
      for (const e of spec.emit) {
        assert.ok(isCrewProtocolEmit(e), `${id} emit ${e} is a crew JSON-envelope kind`);
        assert.ok(CREW_PROTOCOL_EMITS.includes(e), `${id} emit ${e} in protocol list`);
      }
      assert.ok(spec.focus.length > 0, `${id} focus non-empty`);
      for (const f of spec.focus) assert.ok(PHASE_IDS.includes(f), `${id} focus ${f} valid`);
    }
  });

  it("gives the lead architect all 13 phases and every phase ≥2 seats", () => {
    assert.equal(SWARM_ROLES["lead-architect"].focus.length, 13);
    for (const p of PHASE_IDS) {
      const seats = seatsForPhase(p);
      assert.ok(seats.includes("lead-architect"), `lead opens the debate at P${p}`);
      assert.ok(seats.length >= 2, `P${p} gets lead + ≥1 specialist (got ${seats.join(",")})`);
      assert.equal(new Set(seats).size, seats.length, `no duplicate seats at P${p}`);
    }
  });
});

describe("swarmPlan — sequential debate, advisory only", () => {
  it("is deterministic: identical input yields identical output", () => {
    const p = runToGate(seedProject(), 6);
    const a = swarmPlan(p);
    const b = swarmPlan(clone(p));
    assert.deepEqual(a, b);
    assert.deepEqual(swarmPlan(p), swarmPlan(p));
  });

  it("never mutates the project, its phases, or its gates (pure advisory)", () => {
    const p = runToGate(seedProject(), 6);
    const before = JSON.stringify(p);
    swarmPlan(p);
    parallelDag(p);
    branchSuggest(p);
    assert.equal(JSON.stringify(p), before, "project untouched by the swarm layer");
    const rec6 = phaseRecord(p, 6);
    assert.equal(rec6?.status, "ready");
  });

  it("activates exactly the seats whose focus covers the edge, in debate order", () => {
    for (const p of PHASE_IDS) {
      const project = setStatus(seedProject(), p, "ready");
      const plan = swarmPlan({ ...project, currentPhase: p });
      const expected = seatsForPhase(p);
      assert.deepEqual(
        plan.critiques.map((c) => c.role),
        expected,
        `critique order at P${p}`,
      );
      for (const c of plan.critiques) {
        assert.equal(c.phase, p, `critique targets the debated edge at P${p}`);
        assert.ok(c.artifact.title.startsWith("Swarm critique — "), "artifact titled");
        assert.equal(c.artifact.language, "markdown");
        assert.ok(c.artifact.title.length > 0 && c.artifact.body.length > 0, "artifact non-empty");
      }
      assert.equal(plan.artifacts.length, plan.critiques.length, "one appended artifact per critique");
      assert.equal(plan.artifacts.length, new Set(plan.artifacts.map((a) => a.title)).size, "unique titles");
      assert.ok(plan.engineLinear && plan.advisory && plan.ok);
    }
  });

  it("is honest about not-configured provenance on deterministic projects", () => {
    const p = seedProject(); // modelRoute "deterministic" — no LLM ever ran
    assert.equal(p.modelRoute, "deterministic");
    const plan = swarmPlan(p);
    for (const c of plan.critiques) {
      assert.equal(c.provenance, "deterministic", "no live analysis claimed");
      assert.ok(c.artifact.body.includes("no LLM turn was dispatched"), "body states no LLM turn");
      assert.ok(c.artifact.body.includes("advisory: true"), "artifact declares advisory-only");
      assert.equal(c.verdict, "keep", "no recorded evidence → no invented objections");
    }
    assert.ok(plan.refinedPlan.includes("no advisory objections"), "refinement is honest on a clean edge");
  });

  it("keeps verdicts honest when an edge has no recorded work yet", () => {
    const p = runToGate(seedProject(), 6); // parked at the mouth of P6 — rec6 ready, no artifacts
    const plan = swarmPlan(p);
    const tester = plan.critiques.find((c) => c.role === "integration-tester");
    assert.ok(tester, "integration seat debates P6");
    assert.equal(tester!.verdict, "keep");
    assert.ok(
      tester!.findings.some((f) => f.note.includes("no code artifacts recorded")),
      "absence reported, never papered over",
    );
  });

  it("secops-sentinel flags recorded secret/PHI markers as an advisory revise", () => {
    const p = runToGate(seedProject(), 4);
    const p2 = {
      ...p,
      brief:
        p.brief +
        " The board stores patient SSNs and connects with sk-proj-abcdefghijklmnopqrstuvwx.",
    };
    const plan = swarmPlan(p2); // currentPhase 4 — secops focus
    const sentinel = plan.critiques.find((c) => c.role === "secops-sentinel");
    assert.ok(sentinel, "sentinel debates P4");
    assert.equal(sentinel!.verdict, "revise");
    assert.ok(sentinel!.findings.some((f) => f.severity === "block"), "secret pattern = advisory block");
    assert.ok(sentinel!.findings.some((f) => f.severity === "warn"), "PHI marker = advisory warn");
    assert.ok(sentinel!.artifact.body.includes("[block]"), "body carries the finding severities");
  });

  it("ast-specialist reports an open schema lane at a codegen edge — and never invents one", () => {
    const p = { ...runToGate(seedProject(), 6), contracts: null, specGraph: null };
    const plan = swarmPlan(p);
    const ast = plan.critiques.find((c) => c.role === "ast-specialist");
    assert.ok(ast, "AST seat debates P6");
    assert.equal(ast!.verdict, "revise");
    assert.ok(ast!.findings.some((f) => f.note.includes("no data contracts recorded")));
    // Sanity: a primed project (contracts on record) does NOT get that objection.
    const primed = swarmPlan(runToGate(seedProject(), 6));
    const astPrimed = primed.critiques.find((c) => c.role === "ast-specialist")!;
    assert.equal(astPrimed.verdict, "keep");
    assert.ok(astPrimed.findings.some((f) => f.note.includes("data contracts on record")));
  });

  it("activates frontend-polish only at the UI prototyping edge (P8)", () => {
    expectRolesFor(3, ["lead-architect", "ast-specialist"]);
    expectRolesFor(8, ["lead-architect", "secops-sentinel", "frontend-polish"]);
    expectRolesFor(5, ["lead-architect", "secops-sentinel", "integration-tester"]);
    expectRolesFor(0, ["lead-architect", "ast-specialist"]);
    const plan8 = swarmPlan({ ...seedProject(), currentPhase: 8 });
    const frontend = plan8.critiques.find((c) => c.role === "frontend-polish")!;
    assert.equal(frontend.verdict, "keep");
    assert.ok(
      frontend.findings.some((f) => f.note.includes("no UI artifacts recorded")),
      "honest pass-through when the prototype has not run",
    );
  });
});

describe("parallelDag — pure DAG metadata, engine stays linear", () => {
  it("is deterministic and declares itself advisory with the engine linear", () => {
    const p = runToGate(seedProject(), 6);
    const a = parallelDag(p);
    const b = parallelDag(clone(p));
    assert.deepEqual(a, b);
    assert.equal(a.advisory, true);
    assert.equal(a.engineLinear, true);
    assert.equal(a.frontier, 6);
    assert.deepEqual(a.ready, [6]);
    assert.equal(a.nodes.length, 13);
    assert.equal(a.chain.length, 6, "remaining +1 chain from P6 → P12");
    for (const e of a.chain) {
      assert.equal(e.to, (e.from + 1) as PhaseId);
      assert.ok(e.reason.length > 0);
    }
  });

  it("tags every phase's state from the records (complete/active/blocked)", () => {
    const p = runToGate(seedProject(), 6);
    const dag = parallelDag(p);
    for (const n of dag.nodes) {
      const rec = phaseRecord(p, n.phase);
      const expected = rec?.status === "complete" ? "complete" : n.phase === 6 ? "active" : "blocked";
      assert.equal(n.state, expected, `P${n.phase} state`);
      assert.ok(n.code.startsWith("P"), `P${n.phase} has a code`);
    }
  });

  it("lists exactly the kind-disjoint run-ready pairs, conflicts for the rest", () => {
    const p = runToGate(seedProject(), 6);
    const dag = parallelDag(p);
    // Run-ready = sealed phases (0..5) ∪ frontier (6) — recomputed independently.
    const runReady = PHASE_IDS.filter(
      (ph) => phaseRecord(p, ph)?.status === "complete" || ph === dag.frontier,
    );
    const expectedPairs: [PhaseId, PhaseId][] = [];
    const expectedConflicts: [PhaseId, PhaseId][] = [];
    for (let i = 0; i < runReady.length; i++) {
      for (let j = i + 1; j < runReady.length; j++) {
        const ka = new Set(kindsRecorded(p, runReady[i]));
        const kb = new Set(kindsRecorded(p, runReady[j]));
        const shared = [...ka].filter((k) => kb.has(k));
        (shared.length === 0 ? expectedPairs : expectedConflicts).push([
          runReady[i],
          runReady[j],
        ]);
      }
    }
    const actualPairs = dag.parallelPairs.map((x) => [x.a, x.b] as [PhaseId, PhaseId]);
    const actualConflicts = dag.conflicts.map((x) => [x.a, x.b] as [PhaseId, PhaseId]);
    assert.deepEqual(actualPairs, expectedPairs, "parallel pairs = all kind-disjoint run-ready pairs");
    assert.deepEqual(actualConflicts, expectedConflicts, "conflicts = shared-kind run-ready pairs");
    assert.ok(dag.parallelPairs.length > 0, "a mid-pipeline project has wave-safe pairs");
    for (const x of dag.parallelPairs) {
      assert.ok(x.reason.includes("kind-disjoint"), "pair reason cites the disjoint kinds");
      assert.ok(runReady.includes(x.a) && runReady.includes(x.b), "pairs stay inside run-ready set");
      const ka = new Set(kindsRecorded(p, x.a));
      const kb = new Set(kindsRecorded(p, x.b));
      assert.equal([...ka].filter((k) => kb.has(k)).length, 0, "no shared recorded kind in a pair");
    }
    for (const x of dag.conflicts) {
      assert.ok(x.reason.includes("serialize"), "conflict reason explains the write-order need");
    }
  });

  it("never pairs a blocked (not-yet-runnable) phase", () => {
    const p = runToGate(seedProject(), 6); // P7..P12 blocked behind the chain
    const dag = parallelDag(p);
    for (const x of [...dag.parallelPairs, ...dag.conflicts]) {
      assert.ok(x.a < 7 && x.b < 7, `blocked phases stay out of pairs (got P${x.a}/P${x.b})`);
    }
  });

  it("fully sealed projects report all pairs across complete phases and an empty frontier", () => {
    const p = sealUpTo(seedProject(), 12);
    const dag = parallelDag(p);
    assert.equal(dag.frontier, null);
    assert.deepEqual(dag.ready, []);
    assert.deepEqual(dag.chain, []);
    for (const n of dag.nodes) assert.equal(n.state, "complete");
    const combos = (13 * 12) / 2;
    assert.equal(dag.parallelPairs.length + dag.conflicts.length, combos, "every complete-phase pair classified");
  });

  it("records shared artifact kinds as conflicts, disjoint kinds as pairs", () => {
    const p = sealUpTo(seedProject(), 12);
    const p2 = {
      ...p,
      artifacts: [
        art(2, "memory"),
        art(3, "mcp"),
        art(6, "code"),
        art(8, "code"),
        art(8, "ui"),
      ],
    };
    const dag = parallelDag(p2);
    const pair = (a: PhaseId, b: PhaseId) =>
      dag.parallelPairs.some((x) => x.a === a && x.b === b) ||
      dag.parallelPairs.some((x) => x.a === b && x.b === a);
    const conflict = (a: PhaseId, b: PhaseId) =>
      dag.conflicts.some((x) => x.a === a && x.b === b) ||
      dag.conflicts.some((x) => x.a === b && x.b === a);
    assert.ok(pair(2, 3), "memory vs mcp kinds are disjoint");
    assert.ok(pair(3, 6), "mcp vs code kinds are disjoint");
    assert.ok(conflict(6, 8), "code kind recorded on both P6 and P8 → serialized compile");
    assert.ok(!pair(6, 8), "shared-kind pair is never listed as parallel");
  });
});

describe("branchSuggest — honest loop-back heuristic", () => {
  it("returns no suggestions on a healthy pipeline and never fabricates conflicts", () => {
    const p = runToGate(seedProject(), 6);
    const res = branchSuggest(p);
    assert.deepEqual(branchSuggest(clone(p)), res, "deterministic");
    assert.equal(res.advisory, true);
    assert.equal(res.engineLinear, true);
    assert.equal(res.frontier, 6);
    assert.deepEqual(res.suggestions, []);
    assert.equal(res.conflictsDetected, 0);
  });

  it("suggests a loop-back when the frontier carries a recorded rejection", () => {
    const p = runToGate(seedProject(), 6);
    const p2 = {
      ...setStatus(p, 6, "rejected"),
      phases: p.phases.map((r) =>
        r.id === 6
          ? {
              ...r,
              status: "rejected" as const,
              rejectionHistory: [{ note: "contract drift", at: 1 }],
            }
          : r,
      ),
    };
    const res = branchSuggest(p2);
    assert.equal(res.conflictsDetected, 1);
    assert.deepEqual(
      {
        downstream: res.suggestions[0].downstream,
        loopBackTo: res.suggestions[0].loopBackTo,
        severity: res.suggestions[0].severity,
      },
      { downstream: 7, loopBackTo: 6, severity: "warn" },
    );
    assert.ok(res.suggestions[0].reason.includes("rejection"), "reason cites the recorded rejection");
  });

  it("flags an open HITL gate with no recorded artifacts as a downstream race", () => {
    const p = withHitl(sealUpTo(seedProject(), 7), 8);
    const res = branchSuggest(p);
    assert.equal(res.conflictsDetected, 1);
    const s = res.suggestions[0];
    assert.equal(s.downstream, 9);
    assert.equal(s.loopBackTo, 8);
    assert.equal(s.severity, "info");
    assert.ok(s.reason.includes("HITL"), "reason cites the open gate");
  });

  it("warns on a sealed schema lane with no recorded contracts — and stays silent when contracts exist", () => {
    const gap = { ...sealUpTo(seedProject(), 3), contracts: null, specGraph: null };
    const res = branchSuggest(gap);
    assert.ok(res.conflictsDetected >= 4, "every downstream code consumer (6,8,10,11) flagged");
    for (const s of res.suggestions) {
      assert.equal(s.loopBackTo, 1, "loop-back targets the architecture lane");
      assert.ok([6, 8, 10, 11].includes(s.downstream), "downstream is a code consumer");
    }
    const primed = branchSuggest(sealUpTo(seedProject(), 3));
    assert.deepEqual(primed.suggestions, [], "recorded contracts → no schema-gap conflict");
  });

  it("stays advisory when the pipeline is fully sealed", () => {
    const p = sealUpTo(seedProject(), 12);
    const res = branchSuggest(p);
    assert.equal(res.frontier, null);
    assert.deepEqual(res.suggestions, []);
    assert.equal(frontierOf(p), null);
  });
});

describe("verdict quality + advisory usefulness (fixes/95 F5)", () => {
  it("treats a FAILED machine verdict at a code edge as an advisory revise (severity matches reality)", () => {
    const base = runToGate(seedProject(), 6);
    const withCode = {
      ...base,
      lastTest: { ok: false as const, detail: "oracle failed" },
      artifacts: [...base.artifacts, art(6, "code")],
    };
    const plan = swarmPlan(withCode);
    const tester = plan.critiques.find((c) => c.role === "integration-tester")!;
    assert.equal(tester.verdict, "revise", "failed oracle → revise signal");
    assert.ok(
      tester.findings.some((f) => f.severity === "warn" && f.note.includes("FAILED")),
      "failed verdict reported as a warn, never an info note",
    );
    // Sanity: the same edge with a PASSED verdict keeps its keep posture.
    const passed = swarmPlan({
      ...withCode,
      lastTest: { ok: true, detail: "green" },
    });
    const t2 = passed.critiques.find((c) => c.role === "integration-tester")!;
    assert.equal(t2.verdict, "keep");
    assert.ok(t2.findings.some((f) => f.note.includes("passed")), "passed verdict noted");
  });

  it("refined plan names the revising seats and surfaces top advisory findings", () => {
    const p = runToGate(seedProject(), 4);
    const p2 = {
      ...p,
      brief: p.brief + " The board stores patient SSNs and connects with «redacted:sk-…».",
    };
    const plan = swarmPlan(p2);
    assert.ok(plan.refinedPlan.includes("secops-sentinel"), "revising seat named in refinement");
    assert.ok(plan.refinedPlan.includes("top advisory findings"), "top findings surfaced");
    assert.match(plan.refinedPlan, /\[secops-sentinel (block|warn)\]/);
    assert.ok(plan.refinedPlan.includes("DoD gate stays the only approver"), "advisory framing kept");
  });

  it("labels kind-disjoint pairs provisional when either side has no recorded output", () => {
    const p = runToGate(seedProject(), 6); // P6 parked at the mouth — nothing recorded there
    const dag = parallelDag(p);
    const frontierPairs = dag.parallelPairs.filter((x) => x.a === 6 || x.b === 6);
    assert.ok(frontierPairs.length > 0, "frontier pairs exist");
    for (const x of frontierPairs) {
      // P6 parked at its gate records the compiled PACKET as a kind, so
      // pairs touching it are genuinely kind-disjoint — the reason must
      // either name both sides' recorded kinds (honest) or carry a
      // non-firm advisory (provisional/gate/contract/rejection).
      assert.ok(
        /kind-disjoint recorded outputs|provisional|resolve the gate|open contract|re-run P\d/.test(
          x.reason,
        ),
        `P${x.a}/P${x.b}: honest reason for the frontier pair (got: ${x.reason.slice(0, 60)}...)`,
      );
      assert.ok(
        !/wave-safe/.test(x.reason.split("—")[0]),
        `P${x.a}/P${x.b}: never claims plain wave-safety without the advisory qualifier`,
      );
    }
    const firm = dag.parallelPairs.filter(
      (x) =>
        x.a !== 6 &&
        x.b !== 6 &&
        kindsRecorded(p, x.a).length > 0 &&
        kindsRecorded(p, x.b).length > 0,
    );
    if (firm.length > 0) {
      for (const x of firm) {
        assert.ok(!x.reason.includes("provisional"), `P${x.a}/P${x.b}: recorded pair stays firm`);
      }
    }
  });
});

describe("scanForMarkers — deterministic pattern scan", () => {
  it("recognizes secret keys, inline credentials, and PHI markers", () => {
    const hits = scanForMarkers(
      "api_key = 12345678\npatient SSN on file\n-----BEGIN RSA PRIVATE KEY-----\nclean text",
    );
    const severities = hits.map((h) => h.severity).sort();
    assert.deepEqual(severities, ["block", "warn", "warn"]);
    assert.deepEqual(scanForMarkers("clean text with no markers"), []);
    assert.deepEqual(scanForMarkers(""), []);
    assert.deepEqual(scanForMarkers("clean"), scanForMarkers("clean"), "deterministic");
  });

  it("matches ALL-CAPS env-file credentials case-insensitively (P2-2)", () => {
    const hits = scanForMarkers("API_KEY=abc123def456ghi789");
    assert.equal(hits.length, 1);
    assert.equal(hits[0].severity, "warn");
    const lower = scanForMarkers("password = 'hunter2-secret-value'");
    assert.equal(lower.length, 1);
  });

  it("never flags process.env / ${…} reads as inline credentials (P2-2)", () => {
    assert.deepEqual(scanForMarkers("const secret = process.env.SECRET;"), []);
    assert.deepEqual(scanForMarkers('api_key: "${process.env.API_KEY}"'), []);
    assert.deepEqual(scanForMarkers('auth_token = process["env"]["AUTH_TOKEN"]'), []);
    assert.deepEqual(scanForMarkers("password = `process.env.PG_PASSWORD`"), []);
  });

  it("still flags genuine inline credential assignments next to env reads (P2-2)", () => {
    const hits = scanForMarkers(
      "const secret = process.env.SECRET;\napi_key = 1234567890abcdef",
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].severity, "warn");
  });
});

describe("secops per-source scan honesty (fixes/83 P2-1)", () => {
  it("scans artifact bodies under their own cap — a tail secret past the old whole-join slice now fires", () => {
    const base = runToGate(seedProject(), 4);
    const p = {
      ...base,
      // Long brief + notes used to consume the old 8000-char whole-join budget
      // before artifacts were even reached → artifact secrets went unscanned
      // while the seat reported "clean".
      brief: "b".repeat(4000),
      notes: "n".repeat(4000),
      artifacts: [
        ...base.artifacts,
        {
          id: "sec-1",
          phase: 4 as PhaseId,
          kind: "security" as const,
          title: "deploy notes",
          body: "z".repeat(3000) + " sk-live-secret-abcdefghijklmnopqrstuvwxyz",
        },
      ],
    };
    const plan = swarmPlan(p);
    const sentinel = plan.critiques.find((c) => c.role === "secops-sentinel");
    assert.ok(sentinel, "sentinel debates P4");
    assert.equal(sentinel!.verdict, "revise");
    assert.ok(
      sentinel!.findings.some((f) => f.severity === "block"),
      "secret in the artifact body is scanned and flagged",
    );
    assert.ok(
      !sentinel!.findings.some((f) => f.note.includes("scan clean")),
      "a hit-bearing scan must not also claim clean",
    );
  });

  it("reports truncation as a warn instead of a clean bill when a source exceeds the cap (P2-1)", () => {
    const p = {
      ...runToGate(seedProject(), 4),
      brief: "x".repeat(SWARM_SCAN_SOURCE_MAX_CHARS + 200) + " sk-tail-secret-abcdefghijklmnopqrstuvwxyz",
    };
    const plan = swarmPlan(p);
    const sentinel = plan.critiques.find((c) => c.role === "secops-sentinel");
    assert.ok(sentinel, "sentinel debates P4");
    assert.ok(
      sentinel!.findings.some((f) => f.note.includes("NOT scanned")),
      "truncated scan says so — never a silent clean",
    );
    assert.ok(
      !sentinel!.findings.some((f) => f.note.includes("scan clean")),
      "no clean bill on a truncated scan",
    );
    assert.equal(sentinel!.verdict, "revise");
  });
});
