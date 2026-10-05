import { test } from "node:test";
import assert from "node:assert/strict";
import { compileAgentPacket, exportProfiles, packetBudgetBoundary, packetInputHash, PACKET_VERSION } from "./packet.ts";
import { DOD } from "./dod.ts";
import { PHASES } from "./phases.ts";
import { createTokenBudget, emptyLedger, recordSpend } from "./token-ledger.ts";
import type { CrewSeat, HitlDecision, Project } from "./types.ts";

/**
 * Packet v2 (T7 / R10 / R4) — src/lib/packet.ts pins.
 *
 * Fixture strategy: emptyProject() from "./engine" is used whenever the engine
 * module is loadable under `node --experimental-strip-types`. Today engine.ts
 * still uses extensionless relative imports (parent-owned, converted at
 * integration), so its load fails — the tests then fall back to a faithful
 * local replica of emptyProject's post-R4 shape: 13 phase records, sandbox
 * {runtime:"sync-template", ramMb:null, timeoutS:30, isolated:false}, and the
 * packet compiled AFTER memory is populated (R4/B-05) so a fresh packet never
 * claims "(empty — treat Phase 0 research as first write)".
 */

const TRUNC_MARKER = "…[TRUNCATED — regenerate at a HITL gate for the full plan]";
const EMPTY_MEM_LINE = "(empty — treat Phase 0 research as first write)";

let engineEmptyProject: ((input: { name: string; brief: string }) => Project) | null = null;
let engineStampP6ReqTrace: ((project: Project) => Project) | null = null;
try {
  const engine = await import("./engine.ts");
  engineEmptyProject = engine.emptyProject;
  engineStampP6ReqTrace = engine.stampP6ReqTrace;
} catch {
  engineEmptyProject = null; // engine.ts not loadable under strip-types yet — replica below stands in.
}

function replicaProject(input: { name: string; brief: string }): Project {
  const project: Project = {
    id: "p-fixture",
    name: input.name,
    brief: input.brief.trim(),
    domain: "logistics",
    createdAt: 1_750_000_000_000,
    status: "intake",
    currentPhase: 0,
    phases: PHASES.map((d) => ({
      id: d.id,
      status: d.id === 0 ? ("ready" as const) : ("locked" as const),
    })),
    scorecard: null,
    competitors: [],
    artifacts: [],
    // R4/B-05 ordering: memory is populated BEFORE the packet is compiled.
    memory: [
      { id: "boot-sem", kind: "semantic", phase: 0, text: "Brief vocabulary mapped to domain terms.", score: 0.8 },
      { id: "boot-proc", kind: "procedural", phase: 0, text: "Run phases in order; gates need HITL.", score: 0.7 },
      { id: "boot-epi", kind: "episodic", phase: 0, text: "Project created for a fleet healthcheck.", score: 0.5 },
    ],
    logs: [],
    hitl: null,
    decisions: [],
    modelRoute: "deterministic",
    sandbox: { runtime: "sync-template", ramMb: null, timeoutS: 30, isolated: false },
    openapi: "",
    adr: "",
    lattice: null,
    schedule: null,
    traces: [],
    packet: "",
    specGraph: null,
    contracts: null,
    oracle: [],
    crew: [],
    notes: "",
    generatedSource: "",
    lastTest: null,
  };
  project.packet = compileAgentPacket(project);
  return project;
}

function makeProject(): Project {
  return engineEmptyProject
    ? engineEmptyProject({ name: "Test Run", brief: "Build a fleet healthcheck tool" })
    : replicaProject({ name: "Test Run", brief: "Build a fleet healthcheck tool" });
}

function makeDecision(over: Partial<HitlDecision> = {}): HitlDecision {
  return {
    id: "hitl-test",
    phase: 0,
    title: "Gate review",
    decision: "approve",
    decidedBy: "human",
    requestedAt: 1_750_000_000_000,
    decidedAt: 1_750_000_000_000,
    ...over,
  };
}

test("PACKET_VERSION is 3 and header/system carry the version stamp (T7/Q-303, E-11)", () => {
  assert.equal(PACKET_VERSION, 3);
  const p = makeProject();
  const out = p.packet;
  assert.ok(out.startsWith("# RapidTool Agent Packet v3 — Test Run"));
  assert.ok(out.includes("packet_version: 3"));
  const m = out.match(/compiled_at: ([^\n]+)/);
  assert.ok(m, "compiled_at line present");
  assert.ok(!Number.isNaN(Date.parse(m![1])), "compiled_at is parseable ISO-8601");
  assert.ok(out.includes(`project_id: ${p.id}`));
});

test("operator notes embedded verbatim when set (T7/B-04)", () => {
  const p = makeProject();
  p.notes = "Ship the offline queue first, not auth.";
  const out = compileAgentPacket(p);
  assert.ok(out.includes("## Operator notes (human steering)"));
  assert.ok(out.includes("These override earlier instructions."));
  assert.ok(out.includes("Ship the offline queue first, not auth."));
});

test("operator notes section absent when notes empty", () => {
  const p = makeProject();
  assert.equal(p.notes, "");
  assert.ok(!p.packet.includes("## Operator notes (human steering)"));
  assert.ok(!p.packet.includes("These override earlier instructions."));
});

test("decision ledger: human approve row (T2/T7)", () => {
  const p = makeProject();
  const decidedAt = 1_750_000_000_000;
  p.decisions = [makeDecision({ phase: 4, decision: "approve", decidedBy: "human", decidedAt })];
  const out = compileAgentPacket(p);
  assert.ok(out.includes("## Decision ledger (HITL)"));
  assert.ok(
    out.includes(`- P4 · approve · human · ${new Date(decidedAt).toISOString()}`),
    "approve row carries phase · decision · decidedBy · ISO decidedAt",
  );
});

test("decision ledger: autopilot approve row is marked autopilot", () => {
  const p = makeProject();
  const decidedAt = 1_750_000_000_001;
  p.decisions = [
    makeDecision({ phase: 6, decision: "approve", decidedBy: "autopilot", decidedAt }),
  ];
  const out = compileAgentPacket(p);
  assert.ok(out.includes(`- P6 · approve · autopilot · ${new Date(decidedAt).toISOString()}`));
});

test("decision ledger: reject row quotes the note", () => {
  const p = makeProject();
  const decidedAt = 1_750_000_000_002;
  p.decisions = [
    makeDecision({
      phase: 2,
      decision: "reject",
      decidedBy: "human",
      note: "missed the offline mode requirement",
      decidedAt,
    }),
  ];
  const out = compileAgentPacket(p);
  assert.ok(out.includes(`- P2 · reject · human · ${new Date(decidedAt).toISOString()}`));
  assert.ok(out.includes(' — "missed the offline mode requirement"'));
});

test("decision ledger: reject note truncated at 200 chars", () => {
  const p = makeProject();
  const longNote = "n".repeat(250);
  p.decisions = [makeDecision({ phase: 5, decision: "reject", note: longNote })];
  const out = compileAgentPacket(p);
  assert.ok(out.includes("- P5 · reject · human · "));
  assert.ok(out.includes(` — "${"n".repeat(200)}…"`), "note capped at 200 with ellipsis");
  assert.ok(!out.includes(`"${longNote}"`), "full 250-char note never printed");
});

// ---------------------------------------------------------------------------
// W29 · R2-f01 / C1-f01 (W-23a) — the WIPE CLASS. A hostile stamp survives
// JSON.parse, so the render must be TOTAL: never a RangeError inside
// compileAgentPacket (that throw walks hydrate → attachAlgorithms →
// seedIfEmpty → recoverFromCorruptPersistence and re-seeds the store EMPTY,
// wiping every user project).
// ---------------------------------------------------------------------------

test("R2-f01: a hostile decidedAt (1e300 / Infinity / NaN) never throws — the ledger renders a total ISO", () => {
  const p = makeProject();
  p.decisions = [
    makeDecision({ id: "h-max", phase: 3, decision: "approve", decidedBy: "human", decidedAt: 1e300 }),
    makeDecision({ id: "h-inf", phase: 4, decision: "approve", decidedBy: "human", decidedAt: Number.POSITIVE_INFINITY }),
    makeDecision({ id: "h-nan", phase: 5, decision: "approve", decidedBy: "human", decidedAt: Number.NaN }),
  ];
  let out = "";
  assert.doesNotThrow(() => {
    out = compileAgentPacket(p);
  }, "a finite-but-out-of-range stamp is clamped to Date's bound; non-finite degrades to the epoch");
  assert.ok(
    out.includes(`- P3 · approve · human · ${new Date(8.64e15).toISOString()}`),
    "1e300 clamps to Date's maximum instead of throwing RangeError",
  );
  assert.ok(
    out.includes(`- P4 · approve · human · ${new Date(0).toISOString()}`),
    "Infinity renders the deterministic epoch",
  );
  assert.ok(
    out.includes(`- P5 · approve · human · ${new Date(0).toISOString()}`),
    "NaN renders the deterministic epoch",
  );
});

test("R2-f01: a hostile createdAt (-1e300) can never throw compiled_at (the lower bound was missing)", () => {
  const p = makeProject();
  // The sibling clamp was UPPER-bound-only: -1e300 passes Number.isFinite AND
  // Math.min, then toISOString() throws. Clear logs/decisions so the clamp —
  // not some newer row — decides the stamp.
  p.createdAt = -1e300;
  p.logs = [];
  p.decisions = [];
  let out = "";
  assert.doesNotThrow(() => {
    out = compileAgentPacket(p);
  });
  assert.ok(
    out.includes(`compiled_at: ${new Date(-8.64e15).toISOString()}`),
    "the negative overflow clamps to Date's minimum (lower bound now enforced)",
  );
});

test("decision ledger section absent when no decisions", () => {
  const p = makeProject();
  assert.equal(p.decisions.length, 0);
  assert.ok(!p.packet.includes("## Decision ledger (HITL)"));
  assert.ok(!p.packet.includes("· approve · human ·"));
});

test("free-form prior-rejection dump replaced by compact ledger pointer (Q-303)", () => {
  const p = makeProject();
  p.phases = p.phases.map((r) =>
    r.id === 2
      ? { ...r, status: "rejected" as const, rejectionNote: "missed the offline mode requirement" }
      : r,
  );
  p.decisions = [
    makeDecision({ phase: 2, decision: "reject", note: "missed the offline mode requirement" }),
  ];
  const out = compileAgentPacket(p);
  assert.ok(out.includes('Prior rejections: see "## Decision ledger (HITL)" below.'));
  assert.ok(!out.includes("Prior rejection notes:"), "no free-form dump when ledger backs it");
  assert.ok(!out.includes("- P2: missed the offline mode requirement"));
});

test("legacy free-form rejection notes kept when ledger has no reject rows", () => {
  const p = makeProject();
  p.phases = p.phases.map((r) =>
    r.id === 7
      ? { ...r, status: "rejected" as const, rejectionNote: "deploy risk unresolved" }
      : r,
  );
  p.decisions = [makeDecision({ phase: 0, decision: "approve" })];
  const out = compileAgentPacket(p);
  assert.ok(out.includes("Prior rejection notes:"));
  assert.ok(out.includes("- P7: deploy risk unresolved"));
  assert.ok(!out.includes('Prior rejections: see "## Decision ledger (HITL)"'));
});

test("memory-empty phrase never appears on a fresh project (R4/B-05 pin)", () => {
  const p = makeProject();
  assert.ok(p.memory.length > 0, "fixture memory is populated before the packet is compiled");
  assert.ok(!p.packet.includes(EMPTY_MEM_LINE));
  assert.ok(p.packet.includes("## Ranked memory (A2 FusionRank)"));
});

test("memory-empty phrase appears only when memory is truly empty (R4)", () => {
  const p = makeProject();
  p.memory = [];
  const out = compileAgentPacket(p);
  assert.ok(out.includes(EMPTY_MEM_LINE));
});

test("Execution line is sandboxClaim text, never net-deny fiction (B-18)", () => {
  const p = makeProject();
  assert.equal(p.sandbox.runtime, "sync-template");
  const out = p.packet;
  assert.ok(
    out.includes("Execution: Engine-template runner (bounded, engine-authored code only)"),
  );
  assert.ok(!out.includes("net-deny"));
  assert.ok(!out.includes("wasm"));
  assert.ok(!out.includes("sync-template"), "runtime literal never printed directly");
  assert.ok(!out.includes("net-deny on generated exec"));
});

test("Execution line honest for worker runtime claim (B-18)", () => {
  const p = makeProject();
  p.sandbox = { runtime: "worker", ramMb: 64, timeoutS: 30, isolated: true };
  const out = compileAgentPacket(p);
  assert.ok(
    out.includes(
      "Execution: Worker isolate, 30s hard cap, network primitives stubbed (fetch/WebSocket/XHR throw)",
    ),
  );
  assert.ok(!out.includes("net-deny"));
  assert.ok(!out.includes("wasm"));
});

test("phase 12 prints pipeline-complete next edge, never a P13 (B-06)", () => {
  const p = makeProject();
  p.currentPhase = 12;
  const out = compileAgentPacket(p);
  assert.ok(out.includes("Next legal edge: none — pipeline complete."));
  assert.ok(!out.includes("P13"));
  assert.ok(!out.includes("only P13"));
});

test("phase 0 prints P1 as next legal edge", () => {
  const p = makeProject();
  assert.equal(p.currentPhase, 0);
  assert.ok(p.packet.includes("Next legal edge — only P1 if this phase completes"));
  assert.ok(!p.packet.includes("pipeline complete"));
});

test("packets over 14000 chars carry the TRUNCATED marker (never silent cut)", () => {
  const p = makeProject();
  p.brief = "b".repeat(16_000);
  const out = compileAgentPacket(p);
  // H3 budget-aware truncation: the cut falls BEFORE the required-output
  // schema, which survives WHOLE — the marker sits mid-document, and the
  // result never exceeds the budget.
  assert.ok(out.includes(TRUNC_MARKER), `marker present (got ...${out.slice(-80)})`);
  assert.ok(out.length <= 14_000, `never exceeds the budget (got ${out.length})`);
  assert.ok(
    out.includes("## Required output schema"),
    "required-output schema survives the cut",
  );
});

test("short packets are not truncated", () => {
  const p = makeProject();
  assert.ok(p.packet.length < 14_000);
  assert.ok(!p.packet.includes("TRUNCATED"));
});

test("## Rejection loop shown for the current phase with attempt count + last note (T9)", () => {
  const p = makeProject();
  p.currentPhase = 1;
  p.phases = p.phases.map((r) =>
    r.id === 1
      ? {
          ...r,
          status: "rejected" as const,
          rejectionHistory: [{ note: "Too broad; narrow scope to core", at: 1_750_000_000_000 }],
        }
      : r,
  );
  const out = compileAgentPacket(p);
  assert.ok(out.includes("## Rejection loop"));
  assert.ok(out.includes("P1 retry attempt #1 after 1 rejection(s)"));
  assert.ok(out.includes('Last rejection note: "Too broad; narrow scope to core"'));
});

test("## Rejection loop absent when only other phases carry history", () => {
  const p = makeProject();
  p.phases = p.phases.map((r) =>
    r.id === 5
      ? { ...r, rejectionHistory: [{ note: "stale rejection elsewhere", at: 1_750_000_000_000 }] }
      : r,
  );
  const out = compileAgentPacket(p);
  assert.ok(!out.includes("## Rejection loop"));
  // legacy fallback still surfaces the stale note
  assert.ok(out.includes("Prior rejection notes:"));
  assert.ok(out.includes("- P5: stale rejection elsewhere"));
});

test("crew seats render exactly as given — A8 active flags pass through unchanged", () => {
  const p = makeProject();
  const crew: CrewSeat[] = [
    {
      role: "architect",
      mandate: "shape the plan",
      tools: [],
      budgetTokens: 8000,
      handoff: "implementer",
      active: true,
    },
    {
      role: "implementer",
      mandate: "write the code",
      tools: [],
      budgetTokens: 6000,
      handoff: "reviewer",
      active: true,
    },
    {
      role: "reviewer",
      mandate: "check the diff",
      tools: [],
      budgetTokens: 4000,
      handoff: "tester",
      active: false,
    },
    {
      role: "tester",
      mandate: "run the suite",
      tools: [],
      budgetTokens: 3000,
      handoff: "architect",
      active: false,
    },
  ];
  p.crew = crew;
  const out = compileAgentPacket(p);
  assert.ok(out.includes("- architect [ACTIVE] (8000 tok): shape the plan → implementer"));
  assert.ok(out.includes("- implementer [ACTIVE] (6000 tok): write the code → reviewer"));
  const reviewer = out.split("\n").find((l) => l.startsWith("- reviewer "));
  assert.ok(reviewer, "reviewer seat rendered");
  assert.ok(!reviewer!.includes("[ACTIVE]"), "inactive seat not force-activated");
  assert.ok(
    out.includes("- reviewer (4000 tok): check the diff → tester"),
    "inactive seat keeps its exact given render",
  );
  assert.ok(out.includes("- tester (3000 tok): run the suite → architect"));
  assert.ok(!out.includes("- tester [ACTIVE]"));
});

// ---------------------------------------------------------------------------
// I7 — machine-readable "## System JSON" envelope
// ---------------------------------------------------------------------------

/** Extract + parse the fenced ```json block emitted under "## System JSON". */
function parseSystemJson(out: string): Record<string, unknown> {
  const m = out.match(/## System JSON \(machine-readable\)\s*```json\s*([\s\S]*?)\s*```/);
  assert.ok(m, "packet carries a fenced ## System JSON block");
  return JSON.parse(m![1]) as Record<string, unknown>;
}

test("## System JSON block is present and parseable (I7)", () => {
  const p = makeProject();
  const env = parseSystemJson(p.packet);
  assert.equal(env.packet_version, 3);
  assert.equal(env.project_id, p.id);
  assert.equal(env.name, "Test Run");
  assert.equal(env.project_status, p.status);
  const cp = env.current_phase as Record<string, unknown>;
  assert.equal(cp.id, 0);
  assert.equal(cp.code, "P0");
});

test("## System JSON exposes decisions ledger + phase statuses + verdict (I7)", () => {
  const p = makeProject();
  p.currentPhase = 6;
  p.decisions = [makeDecision({ phase: 4, decision: "approve", decidedBy: "human" })];
  const out = compileAgentPacket(p);
  const env = parseSystemJson(out);
  const decisions = env.decisions as Array<Record<string, unknown>>;
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].phase, 4);
  assert.equal(decisions[0].decision, "approve");
  assert.equal(decisions[0].decided_by, "human");
  assert.equal(typeof decisions[0].decided_at, "number");

  const phases = env.phases as Array<Record<string, unknown>>;
  assert.equal(phases.length, 13, "every phase 0..12 is enumerated");
  assert.equal(phases[0].id, 0);
  assert.equal(phases[12].id, 12);
  assert.ok("status" in phases[0], "each phase carries its status");
  assert.ok("gate_passed" in phases[0], "each phase carries its gate verdict (null when absent)");
  assert.equal(env.verdict, null, "no scorecard yet → null verdict");
});

test("## System JSON reflects the current edge, not a stale phase (I7)", () => {
  const p = makeProject();
  p.currentPhase = 12;
  const env = parseSystemJson(compileAgentPacket(p));
  const cp = env.current_phase as Record<string, unknown>;
  assert.equal(cp.id, 12);
  assert.equal(cp.code, "P12");
});

test("## System JSON caps decision notes at 200 chars like the ledger (no unbounded leak)", () => {
  const p = makeProject();
  const longNote = "n".repeat(250);
  p.decisions = [makeDecision({ phase: 5, decision: "reject", note: longNote })];
  const out = compileAgentPacket(p);
  const env = parseSystemJson(out);
  const note = (env.decisions as Array<Record<string, unknown>>)[0].note as string;
  assert.ok(note.length <= 201, "JSON note is capped, never the full 250-char note");
  assert.ok(!out.includes(longNote), "full note never appears anywhere in the packet");
});

// ---------------------------------------------------------------------------
// ST-1 — the packet's machine-readable System JSON reflects the gate verdict
// for the phase JUST approved (never null after approveHitl).
// ---------------------------------------------------------------------------

test("ST-1: approveHitl records the DoD gate before compiling — gate_passed is a boolean after approval", async () => {
  const engine = await import("./engine.ts");
  const fixtures = await import("./testing/fixtures.ts");
  // Park at the mouth of P4 (phases 0..3 sealed), then run P4 to open its HITL gate.
  let p = fixtures.runToGate(fixtures.seedProject(), 4);
  p = engine.applyPhaseResult(p, 4);
  assert.equal(p.status, "awaiting_hitl", "P4 parks awaiting_hitl");
  const approved = engine.approveHitl(p, { decidedBy: "human" });
  const env = parseSystemJson(approved.packet);
  const phases = env.phases as Array<Record<string, unknown>>;
  assert.equal(
    typeof phases[4].gate_passed,
    "boolean",
    "gate_passed for the just-approved phase is a boolean (ST-1), never null",
  );
});

// ---------------------------------------------------------------------------
// T-14 (106 §6, finding F-11) — phase-coverage honesty: the rail line and the
// System JSON envelope must state the REAL census. Verified by probe (W4-L5):
// fresh project = 0 of 13 / 0 tail artifacts; a 7-phase prefix (stopped run) =
// 7 of 13 / 0; a full 13-phase fixture run = 13 of 13 / 9 tail artifacts
// (P7–P12 rows EXCLUDING the two bookkeeping kinds — the stored "packet" row and
// each phase's recorded DoD "gate" row — phaseCoverage's own documented exclusions,
// so the number here is the helper's real arithmetic, not the probe's raw row count).
// W50/336-1 moved this 8 → 9: the P12 PostgreSQL schema deliverable is a real producer row.
// ---------------------------------------------------------------------------

test("T-14: fresh project rail carries the honest 0-of-13 coverage line", () => {
  const p = makeProject();
  assert.ok(
    p.packet.includes(
      "Phase coverage: 0 of 13 phases executed / 0 artifacts from P7–P12 — strictly linear graph; unexecuted phases are not implied complete (the current edge is the only enterable phase).",
    ),
    `fresh packet must carry the 0-of-13 rail line (got ${JSON.stringify(
      p.packet.match(/Phase coverage: [^\n]*/)?.[0] ?? null,
    )})`,
  );
  assert.ok(p.packet.includes("## Current edge"), "coverage line lands under the Current edge rail");
  assert.ok(!p.packet.includes("13 of 13"), "a fresh project never prints the all-ran claim");
});

test("T-14: fresh project System JSON carries the same census under phase_coverage", () => {
  const p = makeProject();
  const env = parseSystemJson(p.packet);
  assert.deepEqual(
    env.phase_coverage,
    { executed: 0, total: 13, artifacts_from_p7_p12: 0, empty_phases: [] },
    "machine consumers read the same 0-of-13 arithmetic as the rail",
  );
});

test("T-14: a stopped 7-phase run reports 7 of 13 / 0 — never implies all 13 ran", async () => {
  const fixtures = await import("./testing/fixtures.ts");
  const stopped = fixtures.runHeadless(fixtures.seedProject(), fixtures.ALL_PHASES.slice(0, 7));
  assert.equal(
    stopped.phases.filter((r) => r.status === "complete").length,
    7,
    "fixture really stopped after the P0–P6 prefix",
  );
  const out = compileAgentPacket(stopped);
  assert.ok(
    out.includes(
      "Phase coverage: 7 of 13 phases executed / 0 artifacts from P7–P12 — strictly linear graph; unexecuted phases are not implied complete (the current edge is the only enterable phase).",
    ),
    `stopped run must report 7 of 13 (got ${JSON.stringify(
      out.match(/Phase coverage: [^\n]*/)?.[0] ?? null,
    )})`,
  );
  const env = parseSystemJson(out);
  assert.deepEqual(env.phase_coverage, {
    executed: 7,
    total: 13,
    artifacts_from_p7_p12: 0,
    empty_phases: [],
  });
});

test("T-14: a completed 13-phase run reports its real 13 of 13 / 9 — matching the artifact rows", async () => {
  const fixtures = await import("./testing/fixtures.ts");
  const done = fixtures.runHeadless(fixtures.seedProject(), fixtures.ALL_PHASES);
  assert.equal(done.status, "complete");
  const out = compileAgentPacket(done);
  assert.ok(
    out.includes("Phase coverage: 13 of 13 phases executed / 9 artifacts from P7–P12"),
    `full run census (got ${JSON.stringify(out.match(/Phase coverage: [^\n]*/)?.[0] ?? null)})`,
  );
  // Independent cross-check: recount the same fact straight off the artifact
  // rows the helper consumes — the rail line may never drift from the data.
  const tail = done.artifacts.filter(
    (a) => a.phase >= 7 && a.kind !== "packet" && a.kind !== "gate",
  ).length;
  assert.equal(tail, 9, "artifact rows independently agree with the 9 the rail reports");
  const env = parseSystemJson(out);
  assert.deepEqual(env.phase_coverage, {
    executed: 13,
    total: 13,
    artifacts_from_p7_p12: 9,
    empty_phases: [],
  });
});

// ---------------------------------------------------------------------------
// W60/346-6 (lane 6) — a complete phase that produced NO deliverable is a silent
// no-op; the census's `emptyPhases` must reach BOTH packet surfaces (rail line +
// machine envelope), never stay hidden behind the tail total.
// ---------------------------------------------------------------------------
test("W60/346-6: a complete-but-empty phase is named in the rail line AND the envelope", () => {
  const p = makeProject();
  p.phases = p.phases.map((r) => (r.id === 10 ? { ...r, status: "complete" as const } : r));
  // P10 is complete but has ONLY a bookkeeping gate row — no deliverable.
  p.artifacts = [{ id: "g10", phase: 10, kind: "gate", title: "DoD gate — P10", body: "verdict: FAIL" }];
  const out = compileAgentPacket(p);
  const line = out.match(/Phase coverage: [^\n]*/)?.[0] ?? "";
  assert.match(line, /silent no-op phase\(s\): P10/, `the rail names the silent no-op (got ${JSON.stringify(line)})`);
  const env = parseSystemJson(out);
  assert.deepEqual(
    (env.phase_coverage as { empty_phases?: unknown }).empty_phases,
    [10],
    "the machine envelope carries the same silent-no-op list",
  );
});

test("runPhaseAsync returns a valid deterministic result for P0 (async entry does not throw)", async () => {
  const engine = await import("./engine.ts");
  const p = makeProject();
  const out = await engine.runPhaseAsync(p, 0);
  assert.equal(out.currentPhase, 0);
  assert.ok(out.artifacts.length > 0, "P0 produced its deterministic artifacts");
  assert.ok(out.scorecard, "scorecard present after P0");
});

// ---------------------------------------------------------------------------
// BUG WAVE 27 — empty sections render explicit placeholders, never bare headings
// ---------------------------------------------------------------------------

test("empty crew/oracle/contracts render placeholders so no section swallows the next heading", () => {
  const p = makeProject();
  p.crew = [];
  p.oracle = [];
  p.contracts = null;
  const out = compileAgentPacket(p);
  assert.ok(
    out.includes("## Crew (A8)\n(crew not yet assembled)"),
    "crew section carries a placeholder when no seats exist",
  );
  assert.ok(
    out.includes("## Contracts (A6)\n(no data contracts yet)"),
    "contracts section carries a placeholder when entities+endpoints are absent",
  );
  assert.ok(
    out.includes("## Oracle (A7)\n(no oracle tests yet)"),
    "oracle section carries a placeholder when no tests exist",
  );
  // The following headings still start their own sections on their own line.
  const crewEnd = out.indexOf("(crew not yet assembled)");
  const specStart = out.indexOf("## Spec graph order (A5)");
  assert.ok(specStart > crewEnd);
  assert.equal(
    out.slice(crewEnd + "(crew not yet assembled)".length, specStart),
    "\n\n",
    "no swallowed content between the placeholder and the next heading",
  );
});

test("a populated crew still renders rows and never the placeholder", () => {
  const p = makeProject();
  assert.ok(p.crew.length > 0, "fixture crew is populated by the engine/algorithms");
  const out = compileAgentPacket(p);
  assert.ok(!out.includes("(crew not yet assembled)"));
  assert.ok(out.includes(`## Crew (A8)\n- ${p.crew[0].role}`));
});

test("whitespace-only brief renders an explicit mission placeholder (never an empty section)", () => {
  const p = makeProject();
  p.brief = "   \n\t ";
  const out = compileAgentPacket(p);
  assert.ok(
    out.includes("## Mission\n(no brief supplied — see operator notes and the intent lattice below)"),
  );
  const idx = out.indexOf("(no brief supplied");
  const nextHeading = out.indexOf("## ", idx);
  const between = out.slice(idx + "(no brief supplied — see operator notes and the intent lattice below)".length, nextHeading);
  assert.equal(between, "\n\n", "mission placeholder stands alone before the next section");
});

// ---------------------------------------------------------------------------
// Handoff export profiles (pillar 3 — fixes/64_pillars_prompt.md)
// ---------------------------------------------------------------------------

const PROFILE_IDS = [
  "claude-code",
  "cursor",
  "cline",
  "aider",
  "devin",
  "copilot",
] as const;
const PROFILE_NAMES = ["Claude Code", "Cursor", "Cline", "Aider", "Devin", "GitHub Copilot"];

/** makeProject() + an explicit spec graph so scope assertions do not depend on
 *  which fixture branch (engine vs replica) is active. */
function makeScopedProject(): Project {
  const p = makeProject();
  p.specGraph = {
    nodes: [
      { id: "n1", file: "src/models.ts", purpose: "domain model", dependsOn: [], owner: "architect" },
      { id: "n2", file: "src/store.ts", purpose: "persistence", dependsOn: ["n1"], owner: "implementer" },
      { id: "n3", file: "tests/oracle.spec.ts", purpose: "oracle stubs", dependsOn: ["n1", "n2"], owner: "tester" },
    ],
    order: ["n1", "n2", "n3"],
  };
  return p;
}

test("exportProfiles exposes exactly the six tool profiles in fixed order, with distinct names", () => {
  assert.deepEqual(Object.keys(exportProfiles), [...PROFILE_IDS]);
  const names = PROFILE_IDS.map((id) => exportProfiles[id].name);
  assert.deepEqual(names, PROFILE_NAMES);
  assert.equal(new Set(names).size, 6, "profile names are pairwise distinct");
  for (const id of PROFILE_IDS) {
    assert.equal(typeof exportProfiles[id].wrap, "function", `${id} carries a wrap fn`);
  }
});

test("every profile wrap embeds the packet verbatim and is byte-deterministic", () => {
  const p = makeProject();
  const pkt = p.packet;
  assert.ok(pkt.length > 100, "fixture packet is non-trivial");
  for (const id of PROFILE_IDS) {
    const profile = exportProfiles[id];
    const a = profile.wrap(pkt, p);
    const b = profile.wrap(pkt, p);
    assert.equal(a, b, `${id} wrap is byte-deterministic`);
    assert.ok(a.includes(pkt), `${id} wrap embeds the packet verbatim`);
    assert.ok(a.startsWith(`# ${profile.name} handoff — Test Run`), `${id} heading line`);
    assert.ok(a.includes("## Packet (verbatim — governs)"));
    assert.ok(a.includes("## Required report"));
    assert.ok(a.includes("report_schema"), `${id} report contract references the schema`);
  }
});

test("claude-code wrap carries a CLI step plan and names the current edge", () => {
  const p = makeProject();
  const edge = PHASES[p.currentPhase];
  const out = exportProfiles["claude-code"].wrap(p.packet, p);
  assert.ok(out.includes("Produce a step plan before editing"), "step-plan directive present");
  assert.ok(out.includes("`claude -p`"), "headless CLI hint present");
  assert.ok(out.includes("plan mode"), "plan-mode guidance present");
  assert.ok(out.includes(`at ${edge.code} — ${edge.title}`), "current edge named in framing");
  assert.ok(out.includes('Resuming governed project "Test Run"'));
  assert.ok(!out.includes("@AGENTS.md"), "no cursor-ism leaks into the claude-code wrap");
});

test("cursor wrap carries @-file-reference guidance for Composer", () => {
  const p = makeScopedProject();
  const out = exportProfiles.cursor.wrap(p.packet, p);
  assert.ok(out.includes("Composer (Agent mode)"));
  assert.ok(out.includes("@-reference the packet file"));
  assert.ok(out.includes("@AGENTS.md"), "AGENTS.md @-reference conditional present");
  assert.ok(out.includes("@-reference each of these spec-graph files:"));
  assert.ok(out.includes("src/models.ts"), "scope file listed for @-reference");
});

test("aider wrap scopes the edit set to spec-graph files in graph order", () => {
  const p = makeScopedProject();
  const out = exportProfiles.aider.wrap(p.packet, p);
  assert.ok(
    out.includes("aider --read rapidtool-packet.md src/models.ts src/store.ts tests/oracle.spec.ts"),
    "aider command carries the packet as read context + the scope as the edit set",
  );
  const i1 = out.indexOf("src/models.ts");
  const i2 = out.indexOf("src/store.ts");
  const i3 = out.indexOf("tests/oracle.spec.ts");
  assert.ok(i1 !== -1 && i1 < i2 && i2 < i3, "files listed in spec-graph order");
  assert.ok(out.includes("The scope files are the EDIT set: aider may only modify them."));
  assert.ok(out.includes("minimal unit diff"), "file-diff discipline directive present");
});

test("aider wrap falls back honestly when no spec graph exists", () => {
  const p = makeProject();
  p.specGraph = null;
  const out = exportProfiles.aider.wrap(p.packet, p);
  assert.ok(!out.includes("src/models.ts"));
  assert.ok(out.includes("(no spec-graph file scope recorded"), "honest fallback note present");
  assert.ok(out.includes("aider --read rapidtool-packet.md"), "read-only packet context still given");
});

test("cline / devin / copilot wraps carry their tool-specific framing", () => {
  const p = makeProject();
  const cline = exportProfiles.cline.wrap(p.packet, p);
  assert.ok(cline.includes("## Cline mechanics"));
  assert.ok(cline.includes(".clinerules/"), "custom-instructions file conditional present");
  const devin = exportProfiles.devin.wrap(p.packet, p);
  assert.ok(devin.includes("## Devin mechanics"));
  assert.ok(devin.includes("Create the Devin session"));
  assert.ok(devin.includes("pause for the human whenever the packet names a HITL gate"));
  const copilot = exportProfiles.copilot.wrap(p.packet, p);
  assert.ok(copilot.includes("## Copilot mechanics"));
  assert.ok(copilot.includes("Copilot Chat"));
  assert.ok(copilot.includes(".github/copilot-instructions.md"), "workspace-instructions conditional present");
  assert.ok(copilot.includes("@workspace"));
});

test("all six wraps differ from each other for identical inputs", () => {
  const p = makeScopedProject();
  const outs = PROFILE_IDS.map((id) => exportProfiles[id].wrap(p.packet, p));
  for (let i = 0; i < outs.length; i++) {
    for (let j = i + 1; j < outs.length; j++) {
      assert.notEqual(outs[i], outs[j], `${PROFILE_IDS[i]} and ${PROFILE_IDS[j]} must differ`);
    }
  }
});

test("wrap is pure: no mutation of project or packet, and output tracks both inputs", () => {
  const p = makeScopedProject();
  const pkt = p.packet;
  const before = JSON.stringify(p);
  const outA = exportProfiles.aider.wrap(pkt, p);
  assert.equal(JSON.stringify(p), before, "project untouched by wrap");
  const outB = exportProfiles.aider.wrap(`${pkt}\n\n(extra trailing line)`, p);
  assert.notEqual(outA, outB, "a packet change changes the wrap output");
  const q = { ...p, name: "Other Project" };
  const outC = exportProfiles.aider.wrap(pkt, q);
  assert.notEqual(outA, outC, "a project change changes the wrap output");
  assert.ok(outC.includes("— Other Project"), "new project name appears in the heading");
});

test("empty packet wraps say so explicitly instead of embedding nothing", () => {
  const p = makeProject();
  for (const id of PROFILE_IDS) {
    const out = exportProfiles[id].wrap("", p);
    assert.ok(
      out.includes("(empty packet — run compileAgentPacket(project) first, then wrap again)"),
      `${id} prints the empty-packet line`,
    );
  }
  const withPacket = exportProfiles.aider.wrap(p.packet, p);
  assert.ok(!withPacket.includes("(empty packet — run compileAgentPacket"));
});

// ---------------------------------------------------------------------------
// fixes/115 H-05 — the compiled packet is a pure, byte-idempotent function of
// the project. compileAgentPacket used to bake new Date().toISOString() into
// compiled_at (packet prose + System JSON envelope), so two compiles of the
// SAME unchanged project differed and every refresh/approve/execute re-stamp
// rewrote the packet artifact body with a spurious diff (probe-det.ts).
// compiled_at now derives from the project's own newest state stamp.
// ---------------------------------------------------------------------------

test("H-05/D1: compileAgentPacket(p) twice on the same project is byte-identical", () => {
  const p = makeProject();
  const a = compileAgentPacket(p);
  const b = compileAgentPacket(p);
  assert.equal(a, b, "packet must not drift between compiles of an unchanged project");
  const m = a.match(/compiled_at: ([^\n]+)/);
  assert.ok(m, "compiled_at line still present");
  assert.ok(!Number.isNaN(Date.parse(m![1])), "compiled_at still parseable ISO-8601");
});

test("H-05/D2: stampPacket(p) twice is byte-identical (no compiled_at drift on re-stamp)", async () => {
  const engine = await import("./engine.ts");
  const p = makeProject();
  const one = engine.stampPacket(p);
  assert.ok(one.packet.length > 0, "first stamp produced a packet");
  const two = engine.stampPacket(one);
  assert.equal(
    two.packet,
    one.packet,
    "re-stamping an unchanged project must not rewrite the packet body",
  );
});

test("H-05/D3 (pin): compiled_at derives from the newest state stamp, never wall clock", () => {
  const p = makeProject();
  const stateStamp = p.createdAt + 5_000; // newer than any fixture log/decision
  p.decisions = [
    makeDecision({ phase: 0, decision: "approve", decidedBy: "human", decidedAt: stateStamp }),
  ];
  const expect = new Date(stateStamp).toISOString();
  const out = compileAgentPacket(p);
  assert.ok(out.includes(`compiled_at: ${expect}`), "prose compiled_at = newest decision stamp");
  const env = parseSystemJson(out);
  assert.equal(env.compiled_at, expect, "System JSON compiled_at matches the prose stamp");
  // And a recompile right after (wall clock advanced) is still byte-identical:
  assert.equal(compileAgentPacket(p), out, "same project + same decision → same bytes");
});

// ---------------------------------------------------------------------------
// F2-03 (W41 P1) — the stale-packet class: content-only inputs (operator
// notes, artifacts, memory) can never move the ISO `compiled_at` stamp (H-05
// keeps it clock-free), so the System JSON envelope also carries `input_hash`
// — an FNV-1a fold over the same inputs the compile reads, INCLUDING notes,
// artifacts and memory rows. A consumer comparing two packets can detect a
// content change the timestamp alone cannot show; the fold is deterministic
// (same project ⇒ same hash) with no wall clock anywhere in it.
// ---------------------------------------------------------------------------

test("F2-03: input_hash is present + deterministic; a notes edit moves it while compiled_at stays put", () => {
  const p = makeProject();
  const out1 = compileAgentPacket(p);
  const h1 = parseSystemJson(out1).input_hash;
  assert.equal(typeof h1, "string", "envelope carries a string input_hash");
  assert.ok((h1 as string).length > 0, "input_hash is non-empty");
  assert.equal(
    parseSystemJson(compileAgentPacket(p)).input_hash,
    h1,
    "same project compiles to the same hash (clock-free)",
  );
  const before = parseSystemJson(out1).compiled_at;
  p.notes = "Ship the offline queue first, not auth.";
  const out2 = compileAgentPacket(p);
  assert.notEqual(parseSystemJson(out2).input_hash, h1, "a notes change moves input_hash");
  assert.equal(
    parseSystemJson(out2).compiled_at,
    before,
    "the content-only edit never fakes a newer timestamp (stamp stays the state stamp)",
  );
});

test("F2-03: input_hash folds artifacts + memory content; telemetry counters are excluded", () => {
  const p = makeProject();
  const h1 = packetInputHash(p);
  p.artifacts = [...p.artifacts, { id: "art-f2-03", phase: 0, kind: "docs", title: "Carrier", body: "body" }];
  const h2 = packetInputHash(p);
  assert.notEqual(h2, h1, "an artifact append moves input_hash");
  const row = { id: "mem-f2-03", kind: "semantic" as const, phase: 0 as const, text: "row text", score: 0.5 };
  p.memory = [...p.memory, row];
  const h3 = packetInputHash(p);
  assert.notEqual(h3, h2, "a memory append moves input_hash");
  // Documented telemetry counters (types.ts MemoryEntry) are "never part of any
  // content fingerprint" — accruing them alone must not churn the hash.
  p.memory = [...p.memory.slice(0, -1), { ...row, counterEvidence: 3, reproducedCount: 2 }];
  assert.equal(packetInputHash(p), h3, "telemetry-only mutation leaves input_hash stable");
});

test("341-3: a brief edit moves input_hash while compiled_at stays put (the folded content input)", () => {
  const a = makeProject();
  const b: Project = { ...a, brief: `${a.brief} — offline-first dispatch` };
  const outA = compileAgentPacket(a);
  const outB = compileAgentPacket(b);
  assert.notEqual(
    parseSystemJson(outB).input_hash,
    parseSystemJson(outA).input_hash,
    "a brief change is a content input and must move input_hash",
  );
  assert.equal(
    parseSystemJson(outB).compiled_at,
    parseSystemJson(outA).compiled_at,
    "the brief edit is content-only — the time-derived stamp must not move",
  );
});

// ---------------------------------------------------------------------------
// W16 L4 (OV-14) — the packet half of the skip≠complete proof. The P6 reqTrace
// artifact is the production carrier of the p6-arch verdict (engine
// stampP6ReqTrace); this test proves the packet's ## Artifacts (trimmed)
// section renders that verdict for tree-carrying projects, and that a SKIPPED
// tree (no tree — keyless/legacy) leaves the packet silent: no artifact, no
// verdict. Complete + fail legs are observable through the packet; the skip
// leg is silence — the exact gap OV-14 names, with the packet-side fix
// proposal in fixes/244_lane4_pinned_windows.md §OV-14.
// ---------------------------------------------------------------------------
test("W16 L4 OV-14: the packet carries the p6-arch reqTrace verdict for tree projects; a skipped tree stays silent", async () => {
  assert.ok(
    engineStampP6ReqTrace,
    "engine.ts must be loadable for this pipeline proof (gates.test.ts imports it statically — it is)",
  );
  const { archProductComplete, archTrace } = await import("./dod.ts");
  const stamp = engineStampP6ReqTrace!;

  const specFor = (sigs: string[]) =>
    ({
      requirements: [],
      edgeCases: [],
      errorHandling: [],
      typeSignatures: sigs,
      dataFlow: [],
      negativeConstraints: [],
      source: "p6",
      briefHash: "w16-l4",
      createdAt: 1,
    }) as unknown as Project["implementationSpec"];
  const boardFile = {
    path: "src/domain/board.ts",
    source: "export function createBoard(name: string) { return { name, columns: [] }; }",
    hash: "h-w16-l4",
    attempt: 0,
  };

  // complete tree → PASS visible to a packet reader
  const complete = makeProject();
  complete.implementationSpec = specFor(["export function createBoard(name: string): Board"]);
  complete.generatedTree = [boardFile] as unknown as Project["generatedTree"];
  const stampedComplete = stamp(complete);
  assert.equal(
    archProductComplete(archTrace(stampedComplete)),
    true,
    "fixture precondition: the tree IS product-complete",
  );
  const okPacket = compileAgentPacket(stampedComplete);
  assert.ok(
    okPacket.includes("### P6 · P6 architecture trace (reqTrace)"),
    "the packet renders the reqTrace artifact (## Artifacts (trimmed)) — the surface this test pins",
  );
  assert.ok(
    okPacket.includes("**p6-arch: PASS** · tree (1 file)"),
    "the complete verdict + tree note are visible in the packet",
  );

  // failing tree → FAIL + the named missing capability visible
  const incomplete = makeProject();
  incomplete.implementationSpec = specFor([
    "export function createBoard(name: string): Board",
    "export function addColumn(board: Board, title: string): Column",
  ]);
  incomplete.generatedTree = [boardFile] as unknown as Project["generatedTree"];
  const stampedIncomplete = stamp(incomplete);
  assert.equal(
    archProductComplete(archTrace(stampedIncomplete)),
    false,
    "fixture precondition: a missing capability ⇒ not product-complete",
  );
  const failPacket = compileAgentPacket(stampedIncomplete);
  assert.ok(failPacket.includes("**p6-arch: FAIL**"), "the failing verdict is visible in the packet");
  assert.ok(failPacket.includes("Missing capabilities"), "with the named missing-capability section");

  // skipped tree → the stamp is a no-op; the packet never mentions the fact
  const skipped = makeProject();
  assert.equal(stamp(skipped), skipped, "no tree → no reqTrace write (keyless floor stays byte-identical)");
  assert.equal(
    archProductComplete(archTrace(skipped)),
    false,
    "the skip is NOT product-complete (the fact under proof)",
  );
  const skipPacket = compileAgentPacket(skipped);
  assert.ok(skipPacket.includes("## Artifacts (trimmed)"), "the artifacts section itself renders (empty placeholder)");
  assert.ok(!skipPacket.includes("reqTrace"), "no reqTrace artifact for the skip — the fact surfaces as SILENCE");
  assert.ok(!skipPacket.includes("p6-arch"), "and no p6-arch verdict anywhere in the packet");
});

// ---------------------------------------------------------------------------
// F2-04 (W41 · X1 tail · fixes/303 lane L2) — the packet budget boundary: an
// always-present ADDITIVE envelope key `budget` ({spent, cap, stop_reason}).
// CF-SE2-3a (312 · E2): a PRESENT budget is stated EXPLICITLY — null ONLY when
// no budget object exists at all; unmetered (RAPIDTOOL_TOKEN_CAP unset, the
// default posture) reports `cap: null` instead of collapsing into the absent
// case. `stop_reason` fires ONLY via isBudgetExhausted (strict `>` — landing
// exactly on the cap is still ok).
// ---------------------------------------------------------------------------

/** E3-1 (323 FIX-1): the disk-side scope label every packet envelope block
 *  carries (byte-pinned literal — the code constant is deliberately NOT
 *  imported, so a silent label change fails this pin). */
const PACKET_BUDGET_SCOPE_LITERAL =
  "process-session snapshot captured at packet build; never the run total — sum the per-leg run envelopes' budget.spent for run spend";

test("F2-04: an empty unmetered budget ⇒ explicit {spent:0, cap:null, stop_reason:null} + E3-1 scope (key always present)", () => {
  const p = makeProject();
  const env = parseSystemJson(compileAgentPacket(p, { budget: createTokenBudget(null) }));
  assert.ok("budget" in env, "the key is present even for the unmetered default (always-present, additive)");
  assert.deepEqual(
    env.budget,
    { spent: 0, cap: null, stop_reason: null, scope: PACKET_BUDGET_SCOPE_LITERAL },
    "CF-SE2-3a: unmetered-by-default is STATED (cap:null), never collapsed into the null that means 'no budget at all'",
  );
  assert.ok("spend" in env, "the OV-41 spend key is untouched (precedent intact)");
  // Default path (no opts) reads the process singleton — equally empty under
  // the default keyless test env, so the same explicit block holds.
  if (!process.env.RAPIDTOOL_TOKEN_CAP) {
    assert.deepEqual(parseSystemJson(compileAgentPacket(p)).budget, {
      spent: 0,
      cap: null,
      stop_reason: null,
      scope: PACKET_BUDGET_SCOPE_LITERAL,
    });
  }
});

test("F2-04: spend recorded, no cap ⇒ {spent>0, cap:null, stop_reason:null}", () => {
  const p = makeProject();
  const ledger = recordSpend(emptyLedger(), { promptTokens: 120, completionTokens: 30 });
  const env = parseSystemJson(compileAgentPacket(p, { budget: createTokenBudget(null, ledger) }));
  assert.deepEqual(env.budget, { spent: 150, cap: null, stop_reason: null, scope: PACKET_BUDGET_SCOPE_LITERAL });
});

test("E3-1 (323 FIX-1): the envelope budget block is LABELED as a packet-build snapshot — spent stays the ledger's own sum, and the shared reader keeps the bare triple", () => {
  const p = makeProject();
  const ledger = recordSpend(emptyLedger(), { promptTokens: 131, completionTokens: 7 });
  const budget = createTokenBudget(5_000_000, ledger);
  const block = parseSystemJson(compileAgentPacket(p, { budget })).budget as {
    spent: number;
    scope?: unknown;
  };
  assert.equal(block.spent, 138, "the number is totalTokens(budget.ledger) — never adjusted, never fabricated");
  assert.equal(block.scope, PACKET_BUDGET_SCOPE_LITERAL, "the disk block states its provenance (E3-1)");
  assert.match(String(block.scope), /packet build/, "labels WHEN the snapshot was taken");
  assert.match(String(block.scope), /never the run total/, "labels what it is NOT");
  assert.match(String(block.scope), /run envelopes' budget\.spent for run spend/, "points run spend at the authoritative per-leg envelopes");
  // Boundary pin: the SHARED reader is unchanged — summary()'s (headless.ts)
  // bare-triple parity survives; only the packet envelope adds the label.
  assert.deepEqual(packetBudgetBoundary(budget), { spent: 138, cap: 5_000_000, stop_reason: null });
});

test("F2-04: spend crossing the cap ⇒ budget_exhausted; landing ON the cap stays ok", () => {
  const p = makeProject();
  const over = createTokenBudget(10, recordSpend(emptyLedger(), { promptTokens: 25, completionTokens: 0 }));
  assert.deepEqual(
    parseSystemJson(compileAgentPacket(p, { budget: over })).budget,
    { spent: 25, cap: 10, stop_reason: "budget_exhausted", scope: PACKET_BUDGET_SCOPE_LITERAL },
  );
  const onCap = createTokenBudget(10, recordSpend(emptyLedger(), { promptTokens: 10, completionTokens: 0 }));
  assert.deepEqual(
    parseSystemJson(compileAgentPacket(p, { budget: onCap })).budget,
    { spent: 10, cap: 10, stop_reason: null, scope: PACKET_BUDGET_SCOPE_LITERAL },
    "strict `>`: landing exactly on the cap is still ok",
  );
});

test("F2-04: packetBudgetBoundary tolerates absent/hostile budgets — never throws; only ABSENT reads null", () => {
  assert.equal(packetBudgetBoundary(null), null, "no budget object at all ⇒ null (the one absent case)");
  assert.equal(packetBudgetBoundary(undefined), null, "undefined ⇒ null");
  assert.deepEqual(
    packetBudgetBoundary({} as never),
    { spent: 0, cap: null, stop_reason: null },
    "a present (even malformed) budget object reads as empty-but-stated, not a throw and not absent",
  );
  assert.deepEqual(
    packetBudgetBoundary({ ledger: {} as never, cap: Number.NaN } as never),
    { spent: 0, cap: null, stop_reason: null },
    "NaN cap ⇒ unmetered, still explicit",
  );
  const b = createTokenBudget(null, recordSpend(emptyLedger(), { promptTokens: 5, completionTokens: 0 }));
  assert.deepEqual(packetBudgetBoundary(b), { spent: 5, cap: null, stop_reason: null });
});

// ---------------------------------------------------------------------------
// L2-P4 (W42) — `project.acceptance` rides the envelope: null when absent, the
// persisted verdict when present (previously invisible to downstream agents).
// ---------------------------------------------------------------------------

test("L2-P4: envelope acceptance key — null when absent, the verdict when present", () => {
  const p = makeProject();
  p.acceptance = undefined;
  assert.equal(parseSystemJson(compileAgentPacket(p)).acceptance, null, "absent ⇒ null, never invented");
  p.acceptance = "aborted";
  assert.equal(parseSystemJson(compileAgentPacket(p)).acceptance, "aborted", "the persisted verdict rides");
  p.acceptance = "failed";
  assert.equal(parseSystemJson(compileAgentPacket(p)).acceptance, "failed");
});

// ---------------------------------------------------------------------------
// A3 (fixes/309_a3_guardset.md) — M3-13..17: the 308 hostile-probe guards.
// Each pin is the probe's exact repro; asserts a safe/coerced OUTCOME, never a
// throw (guards live in compileAgentPacket / packetInputHash).
// ---------------------------------------------------------------------------

test("A3/M3-13: compileAgentPacket(null) returns the no-project floor, never a TypeError", () => {
  const out = compileAgentPacket(null as unknown as Project);
  assert.equal(typeof out, "string");
  assert.ok(out.includes("(no project record)"), "the floor names the missing record");
  assert.ok(out.includes("nothing to compile"), "the refusal reason is stated, not silent");
});

test("A3/M3-14: compileAgentPacket({}) compiles the empty skeleton — no .filter/.map throw", () => {
  const out = compileAgentPacket({} as unknown as Project);
  assert.ok(out.includes("(no brief supplied"), "Mission falls back honestly");
  assert.ok(out.includes("(none yet)"), "Artifacts section degrades to its placeholder");
  assert.ok(out.includes("No pending HITL."), "the rail survives the empty payload");
  assert.ok(!out.includes("Execution: undefined"), "the sandbox rail renders the template claim");
});

test("A3/M3-15: a non-string brief coerces (handoff.text precedent) — never brief.trim TypeError", () => {
  const numeric = makeProject() as unknown as { brief: unknown };
  numeric.brief = 42;
  assert.ok(compileAgentPacket(numeric as unknown as Project).includes("42"), "String()-coerced into the Mission");
  const nullish = makeProject() as unknown as { brief: unknown };
  nullish.brief = null;
  assert.ok(
    compileAgentPacket(nullish as unknown as Project).includes("(no brief supplied"),
    "null ⇒ the empty-brief floor",
  );
});

test("A3/M3-16: a junk schedule degrades to no-notes / no-extra-HITL — never .length throw", () => {
  const p = makeProject() as unknown as { schedule: unknown };
  p.schedule = { tightness: "x" };
  const out = compileAgentPacket(p as unknown as Project);
  assert.ok(out.includes("Tightness x"), "the junk tightness still renders (never silently dropped)");
  assert.ok(out.includes("Extra HITL: none"), "missing extraHitl reads as none, not a throw");
});

test("A3/M3-17: packetInputHash(null) fingerprints as the empty shape — never throws", () => {
  assert.equal(packetInputHash(null as unknown as Project), packetInputHash({} as Project));
});

test("R2-f05 research citations: a url-less/corrupt item never renders `undefined` as a source", () => {
  // Regression: the item filter accepted ANY object, so a hand-built/foreign
  // payload rendered `- T1 — undefined` inside a "cite these, do not invent
  // sources" list. The render now applies the same string-url predicate
  // hydrateProject/io use; a non-citable row contributes nothing.
  const p = makeProject();
  p.research = [
    { query: "q", items: [{ title: "T1" }, { title: "T2", url: 5 }, { title: "T3", url: "https://e/x" }] },
  ] as unknown as Project["research"];
  const out = compileAgentPacket(p);
  assert.ok(!out.includes("- T1 — undefined"), "a missing url is never printed as a source");
  assert.ok(!out.includes("— 5"), "a non-string url is never printed as a source");
  assert.ok(out.includes("- T3 — https://e/x"), "a real citation still renders");
});

test("A6c/M3-18: junk collection containers compile to honest empty forms — never a TypeError (325 BUG A)", () => {
  // The 14 shapes the A6 hunt byte-anchored (fixes/325_a6_hunt.md §A): a
  // foreign `{}`/`42` in place of a collection used to crash compileAgentPacket
  // (13 shapes) or packetInputHash (4 shapes) with "not iterable" / "is not a
  // function"; each must now degrade to the empty form, exactly like M3-14.
  const base = { name: "junk", id: "j", currentPhase: 0, brief: "x" } as unknown as Project;
  const shapes: [string, Record<string, unknown>][] = [
    ["memory:{}", { memory: {} }],
    ["memory:42", { memory: 42 }],
    ["crew:{}", { crew: {} }],
    ["research:{}", { research: {} }],
    ["oracle:{}", { oracle: {} }],
    ["contracts:{entities:{},endpoints:{}}", { contracts: { entities: {}, endpoints: {} } }],
    ["specGraph:{order:{},nodes:{}}", { specGraph: { order: {}, nodes: {} } }],
    ["specGraph:{order:['a'],nodes:{}}", { specGraph: { order: ["a"], nodes: {} } }],
    ["logs:{}", { logs: {} }],
    ["decisions:{}", { decisions: {} }],
    ["artifacts:{}", { artifacts: {} }],
    [
      "scorecard:{axes:{},bottlenecks:{},attackVectors:{}}",
      { scorecard: { verdict: "x", axes: {}, bottlenecks: {}, attackVectors: {} } },
    ],
    ["lattice:{jobs:{}}", { lattice: { jobs: {} } }],
    ["lattice:42", { lattice: 42 }],
  ];
  for (const [label, extra] of shapes) {
    assert.doesNotThrow(
      () => compileAgentPacket({ ...base, ...extra } as unknown as Project),
      `compile must survive ${label}`,
    );
  }
  // honesty: the junk containers render the SAME empty forms as absence
  const memless = compileAgentPacket({ ...base, memory: {} } as unknown as Project);
  assert.ok(memless.includes(EMPTY_MEM_LINE), "memory:{} reads as no rows (the empty-memory floor)");
  const crewless = compileAgentPacket({ ...base, crew: {} } as unknown as Project);
  assert.ok(crewless.includes("(crew not yet assembled)"), "crew:{} reads as no seats");
  const latticeJunk = compileAgentPacket({ ...base, lattice: { jobs: {} } } as unknown as Project);
  assert.ok(latticeJunk.includes("Jobs: unspecified"), "lattice.jobs:{} reads as no jobs");
  const specJunk = compileAgentPacket({
    ...base,
    specGraph: { order: {}, nodes: {} },
  } as unknown as Project);
  assert.ok(specJunk.includes("(run algorithms first)"), "specGraph containers read as no graph");
  // export-profile wrapper: the same junk spec-graph containers must not throw
  // out of profileScopeFiles (fix-time discovery, same `?? []` class)
  const wrapped = exportProfiles["aider"].wrap(
    "packet-body",
    { ...base, specGraph: { order: {}, nodes: {} } } as unknown as Project,
  );
  assert.ok(
    wrapped.includes("(no spec-graph file scope recorded"),
    "junk order/nodes read as no scope in the export profile",
  );
  // packetInputHash: junk forms fingerprint EXACTLY like the empty shape
  for (const [label, extra] of [
    ["memory:{}", { memory: {} }],
    ["logs:{}", { logs: {} }],
    ["decisions:{}", { decisions: {} }],
    ["artifacts:{}", { artifacts: {} }],
  ] as [string, Record<string, unknown>][]) {
    assert.equal(
      packetInputHash({ ...base, ...extra } as unknown as Project),
      packetInputHash({ ...base } as unknown as Project),
      `input_hash must be byte-equal to the empty shape for ${label}`,
    );
  }
});

// ---------------------------------------------------------------------------
// R2-f05 (W-25e, fixes/327 L5) — ROW-level junk. The A6c/M3-18 block above
// pins junk CONTAINERS; a null ROW inside a well-formed array was still
// fatal. io.ts's own comments name the sites ("a null row crashes the packet
// crew render (c.role read)" / "…the packet oracle render (t.name read)"),
// and hydrate keeps those rows raw (engine.ts:2611-2612) — so a persisted
// payload reaches compileAgentPacket with the row shape, and a throw here
// walks the documented wipe chain (isoFromMs docblock). Each shape must
// compile to an honest form instead.
// ---------------------------------------------------------------------------

test("R2-f05: a null/foreign ROW in any project collection compiles — never a TypeError", () => {
  const base = { name: "junk", id: "j", currentPhase: 0, brief: "x" } as unknown as Project;
  const shapes: [string, Record<string, unknown>][] = [
    ["artifacts:[null]", { artifacts: [null] }],
    ["artifacts:[{no body}]", { artifacts: [{ id: "a", phase: 0, kind: "docs", title: "t" }] }],
    ["crew:[null]", { crew: [null] }],
    ["oracle:[null]", { oracle: [null] }],
    ["oracle:[42]", { oracle: [42] }],
    ["decisions:[null]", { decisions: [null] }],
    ["phases:[null]", { phases: [null] }],
    ["specGraph:{order:[42],nodes:[null]}", { specGraph: { order: [42], nodes: [null] } }],
    ["contracts:{entities:[null]}", { contracts: { entities: [null], endpoints: [] } }],
    ["contracts:{entities:[{name:'x'}]}", { contracts: { entities: [{ name: "x" }], endpoints: [] } }],
    [
      "scorecard:{axes:[null]}",
      { scorecard: { verdict: "x", axes: [null], bottlenecks: [], attackVectors: [] } },
    ],
  ];
  for (const [label, extra] of shapes) {
    assert.doesNotThrow(
      () => compileAgentPacket({ ...base, ...extra } as unknown as Project),
      `compile must survive the row-level junk shape ${label}`,
    );
  }
  // The junk row must not silently fabricate a section either: the crew section
  // still renders (its placeholder is for an EMPTY collection, not a junk one).
  const out = compileAgentPacket({ ...base, crew: [null] } as unknown as Project);
  assert.ok(out.includes("## Crew (A8)"), "crew section still renders for a junk row");
  // The export-profile wrapper reads the same spec-graph rows (profileScopeFiles).
  assert.doesNotThrow(
    () =>
      exportProfiles["aider"].wrap(
        "packet-body",
        { ...base, specGraph: { order: [42], nodes: [null] } } as unknown as Project,
      ),
    "export profiles must survive a null spec-graph node row too",
  );
});

test("R2-f05: lastTest.ok must be the boolean TRUE to render pass (declare-or-strike)", () => {
  const p = makeProject();
  p.lastTest = { ok: "yes", detail: "hand-edited" } as unknown as Project["lastTest"];
  const out = compileAgentPacket(p);
  assert.ok(out.includes("(last run): FAIL"), `a non-boolean ok is not a pass (got: ${out.match(/P6 [^\n]*/)?.[0]})`);
  assert.ok(!out.includes("(last run): pass"), 'never prints pass for {ok:"yes"}');
  const truthy = makeProject();
  truthy.lastTest = {
    label: "tested",
    ok: true,
    detail: "3/3 machine-run cases passed",
  } as Project["lastTest"];
  assert.ok(
    compileAgentPacket(truthy).includes("(last run): pass"),
    "ok === true still renders pass (the fix tightens, never weakens)",
  );
});

// ---------------------------------------------------------------------------
// W49 / 335-3 — the agent packet must carry what the agent needs to WORK the
// edge: the machine-checkable DoD exit criteria (the packet stated the rules
// and the report schema but never "done"), the ingest seam's ACTUAL acceptance
// rules, and no instruction that contradicts the current-edge-only governance.
// ---------------------------------------------------------------------------
test("W49/335-3: the packet carries the current edge's DoD exit criteria (gate verdict + checklist)", () => {
  const p = makeProject();
  const out = compileAgentPacket(p);
  assert.ok(out.includes("## Exit criteria (DoD)"), "the DoD section is present");
  assert.ok(out.includes(`Gate ${PHASES[p.currentPhase].code}:`), "the gate line names the current edge");
  assert.ok(DOD[0].length > 0, "premise: P0 registers DoD criteria");
  for (const item of DOD[0]) {
    assert.ok(out.includes(item.criterion), `criterion renders verbatim: ${item.id}`);
  }
  assert.match(out, /\n- \[[ x]\] /, "criteria render as a [x]/[ ] checklist");
});

test("W49/335-3: report_schema states the ingest seam's phase-match rule and artifact caps", () => {
  const out = compileAgentPacket(makeProject());
  assert.ok(out.includes("must equal current_phase.id"), "a report for another phase is rejected by the seam");
  assert.ok(out.includes("max 12"), "the artifact-count cap the seam enforces");
  assert.ok(out.includes("50000 chars"), "the per-body cap the seam enforces");
});

test("W49/335-3: the Scorecard fallback never instructs an out-of-scope Phase 0 run", () => {
  const p = makeProject();
  assert.equal(p.scorecard, null, "premise: the fresh project has no scorecard");
  const out = compileAgentPacket(p);
  assert.equal(out.includes("run Phase 0 first"), false, "no instruction to run a different phase");
  assert.ok(out.includes("the scorecard is a Phase 0 output"), "it names the source honestly instead");
});

test("W50/336-3: past P0 the memory-empty placeholder is state-only, never an out-of-scope Phase-0 instruction", () => {
  const p = makeProject();
  p.currentPhase = 4 as Project["currentPhase"];
  p.memory = [];
  const out = compileAgentPacket(p);
  assert.ok(out.includes("## Ranked memory (A2 FusionRank)"), "the section still renders");
  assert.equal(
    out.includes(EMPTY_MEM_LINE),
    false,
    "an edge past P0 must not instruct a Phase-0 rewrite",
  );
  assert.ok(
    out.includes("(empty — no memory rows are recorded for this project)"),
    "it states the observable fact instead",
  );
});

test("W50/336-3: the P0 memory-empty placeholder is unchanged (R4/B-05 pins the ordering, not the text)", () => {
  const p = makeProject();
  assert.equal(p.currentPhase, 0, "premise: a fresh project sits at P0");
  p.memory = [];
  const out = compileAgentPacket(p);
  assert.ok(out.includes(EMPTY_MEM_LINE), "at P0 the Phase-0 pointer is in scope and stays");
});

// ---------------------------------------------------------------------------
// W52 / 338-5 (Product) — the agent-facing sufficiency gap: every export profile
// says "run the oracle tests from the packet", but the packet named only the
// rows, never a runnable command or the spec path. A fresh agent could not
// self-check. The packet now names both (or states there is no spec yet).
// ---------------------------------------------------------------------------
test("W52/338-5: an edge with oracle rows names the runnable acceptance command + spec path", () => {
  const p = makeScopedProject();
  p.oracle = [
    { id: "orc-1", name: "job.dispatch.happy", given: "a valid tech", expect: "200 + persisted", job: "dispatch" },
  ];
  const out = compileAgentPacket(p);
  assert.ok(out.includes("npm test"), "the tree's declared test script is named");
  assert.ok(out.includes("tests/oracle.spec.ts"), "the oracle spec path is named");
  assert.ok(out.includes("tests_run"), "the agent is told to record the command it ran");
  // The command lives in the invariant required-output tail, so a truncation
  // can never strip the agent's only self-check instruction.
  assert.ok(
    out.indexOf("npm test") > out.indexOf("## Required output schema"),
    "the acceptance command rides the required-output tail",
  );
});

test("W52/338-5: with no oracle rows the packet states there is no runnable acceptance spec", () => {
  const p = makeProject();
  p.oracle = []; // the engine seeds 2 rows; strip them so no test script would be declared
  const out = compileAgentPacket(p);
  assert.equal(out.includes("npm test"), false, "no command points at a script the tree does not declare");
  assert.ok(out.includes("machine-checked DoD gate"), "the DoD gate is named as the exit signal instead");
});

// ---------------------------------------------------------------------------
// 339-5 (Packet) — the unattended-continuation fields, each a real read of
// persisted state: the EMITTED oracle spec path (the emitter's fixed contract
// path, never a spec-graph node's raw `file`), the persisted generated artifact
// (project.generatedTree / project.generatedSource) the agent continues FROM,
// and the runnable context the acceptance command needs.
// ---------------------------------------------------------------------------

/** The invariant required-output tail — where the acceptance instruction lives. */
const acceptTail = (packet: string): string =>
  packet.slice(packet.indexOf("## Required output schema"));

test("339-5: the acceptance spec path is the emitted contract path, never a spec-graph node's raw file", () => {
  const p = makeScopedProject();
  p.oracle = [{ id: "orc-1", name: "n", given: "g", expect: "e", job: "j" }];
  // A spec graph whose `tests` node names a DIFFERENT raw file, plus a foreign
  // node that merely lives under tests/: neither may become the accepted spec
  // path — the emitter always writes the tests node at tests/oracle.spec.ts.
  p.specGraph = {
    nodes: [
      { id: "n1", file: "src/models.ts", purpose: "domain model", dependsOn: [], owner: "architect" },
      { id: "tests", file: "spec/acceptance.ts", purpose: "oracle", dependsOn: [], owner: "tester" },
      { id: "n2", file: "tests/other.spec.ts", purpose: "stray", dependsOn: [], owner: "tester" },
    ],
    order: ["n1", "tests", "n2"],
  };
  const tail = acceptTail(compileAgentPacket(p));
  assert.ok(
    tail.includes("(`tests/oracle.spec.ts`)"),
    "the emitted contract path is named in the acceptance instruction",
  );
  assert.equal(
    tail.includes("(`spec/acceptance.ts`)"),
    false,
    "a raw tests-node file the emitter never writes must not be named as the spec path",
  );
  assert.equal(
    tail.includes("(`tests/other.spec.ts`)"),
    false,
    "a non-tests node under tests/ must not shadow the contract path",
  );
});

test("339-5: the acceptance instruction gives the runnable context + declared sequence", () => {
  const p = makeScopedProject();
  p.oracle = [{ id: "orc-1", name: "n", given: "g", expect: "e", job: "j" }];
  const tail = acceptTail(compileAgentPacket(p));
  assert.ok(tail.includes("from the emitted tree root"), "the working directory is stated");
  assert.ok(tail.includes("`npm install`"), "install precedes the declared scripts");
  assert.ok(tail.includes("`npm run typecheck`"), "the emitted typecheck script is named");
  assert.ok(tail.includes("`npm test`"), "the emitted test script is named");
});

test("339-5: the packet renders the persisted generated artifact (tree paths / single module / none)", () => {
  const base = makeProject();
  const none = compileAgentPacket({ ...base, generatedTree: undefined, generatedSource: "" });
  assert.ok(
    none.includes("Generated artifact: none recorded"),
    "no generated bytes → an explicit 'none recorded', never a fabricated artifact",
  );
  const single = compileAgentPacket({ ...base, generatedSource: "export function boot(){}" });
  assert.ok(
    single.includes("Generated artifact: single module (project.generatedSource)"),
    "the legacy single generatedSource is named as such",
  );
  const tree = [
    { path: "src/jobs/track.ts", source: "x", hash: "h1", attempt: 0 },
    { path: "src/jobs/dispatch.ts", source: "y", hash: "h2", attempt: 1 },
  ];
  const out = compileAgentPacket({ ...base, generatedTree: tree });
  assert.ok(
    out.includes("Generated artifact: 2 tree file(s) recorded (project.generatedTree)"),
    "the tree-file count is read from the persisted record",
  );
  assert.ok(
    out.indexOf("src/jobs/dispatch.ts") !== -1 && out.indexOf("src/jobs/track.ts") !== -1,
    "every persisted tree path renders",
  );
});

test("339-5: the packet's acceptance command names a spec path the emitted tree actually contains (template read)", async () => {
  const { scaffoldProject } = await import("./scaffold.ts");
  const p = makeScopedProject();
  p.oracle = [{ id: "orc-1", name: "n", given: "g", expect: "e", job: "j" }];
  // A `tests` node whose raw `file` differs from the emitted contract path: the
  // emitter still writes tests/oracle.spec.ts, so the packet must name THAT.
  p.specGraph = {
    nodes: [
      { id: "n1", file: "src/models.ts", purpose: "domain model", dependsOn: [], owner: "architect" },
      { id: "tests", file: "spec/acceptance.ts", purpose: "oracle", dependsOn: ["n1"], owner: "tester" },
    ],
    order: ["n1", "tests"],
  };
  const emitted = scaffoldProject(p, {});
  assert.ok(emitted.ok, "premise: the fixture emits a valid tree");
  if (!emitted.ok) return;
  const emittedPaths = emitted.files.map((f) => f.path);
  assert.ok(
    emittedPaths.includes("tests/oracle.spec.ts"),
    "premise: the emitter writes the oracle spec at the contract path, not the node's raw file",
  );
  const pkg = JSON.parse(emitted.files.find((f) => f.path === "package.json")!.body) as {
    scripts: Record<string, string>;
  };
  assert.equal(typeof pkg.scripts.test, "string", "premise: the emitted tree declares a test script");
  const tail = acceptTail(compileAgentPacket(p));
  assert.ok(tail.includes("tests/oracle.spec.ts"), "the packet names the exact path the emitted tree writes");
  assert.ok(tail.includes("npm test"), "the packet names the emitted test script by its npm alias");
});

test("339-5: the packet renders the RED criterion's state (dod.ts 339-3), not the bare static label", async () => {
  const engine = await import("./engine.ts");
  const fixtures = await import("./testing/fixtures.ts");
  // Execute P6 on the deterministic floor: the placeholder module implements
  // phase bookkeeping only, so p6-brief-fit is red BY CONSTRUCTION. dod.ts
  // (339-3) appends a state line to that unmet item's `criterion`; the packet
  // must render the augmented criterion, never the bare registry label.
  const floor = engine.applyPhaseResult(fixtures.runToGate(fixtures.seedProject(), 6), 6);
  const out = compileAgentPacket(floor);
  const row = out.split("\n").find((l) => l.startsWith("- [ ] Brief-conformance"));
  assert.ok(row, "the p6-brief-fit criterion renders as an unmet [ ] row");
  assert.ok(
    row.includes("deterministic floor state"),
    `the red row names the floor state (got ${JSON.stringify(row)})`,
  );
  assert.ok(
    row.startsWith("- [ ] Brief-conformance: required brief nouns appear as identifiers"),
    "the state line is appended to the registry criterion, not a replacement",
  );
  // Shape pin: the state text is a PROSE-only change — the fenced machine
  // envelope keeps its schema (schema_version 1) and does not gain a criterion.
  const env = parseSystemJson(out);
  assert.equal(env.schema_version, 1, "the machine block schema is unchanged");
  assert.equal(
    JSON.stringify(env).includes("deterministic floor state"),
    false,
    "the state line stays in the prose DoD checklist, not the machine envelope",
  );
});

// ---------------------------------------------------------------------------
// 341-3 (evidence -> delivery) — the persisted artifact CENSUS. The
// `## Artifacts` section listed the newest ≤8 bodies under a "(trimmed)"
// heading but never stated how many rows are on record, so an unattended
// continuation could not tell a complete list from a window. The section now
// opens with an explicit count (and the packet's own row stays excluded, the
// same bookkeeping exclusion phaseCoverage applies).
// ---------------------------------------------------------------------------
test("341-3: the packet states the persisted artifact census, not only trimmed bodies", () => {
  const p = makeProject();
  p.artifacts = [
    { id: "a1", phase: 3, kind: "gate", title: "DoD gate - P3", body: "verdict: PASS" },
    { id: "a2", phase: 5, kind: "docs", title: "Validation", body: "hitl contract" },
    { id: "a3", phase: 6, kind: "docs", title: "Codegen", body: "floor module" },
  ];
  const out = compileAgentPacket(p);
  const start = out.indexOf("## Artifacts (trimmed)");
  assert.ok(start >= 0, "the artifacts section renders");
  const section = out.slice(start, out.indexOf("## Required output schema"));
  assert.match(
    section,
    /Census: 3 artifact row\(s\) recorded/,
    `the census names the real row count (got ${JSON.stringify(section.split("\n")[1])})`,
  );
  assert.equal(
    section.includes("packet row") || section.includes("packet's own row"),
    true,
    "the census names the bookkeeping exclusion",
  );
});

test("341-3 control: a project with no artifact rows keeps the honest '(none yet)' form", () => {
  const p = makeProject();
  p.artifacts = [];
  const out = compileAgentPacket(p);
  const start = out.indexOf("## Artifacts (trimmed)");
  const section = out.slice(start, out.indexOf("## Required output schema"));
  assert.equal(section.includes("Census:"), false, "no census line without rows");
  assert.ok(section.includes("(none yet)"), "the empty form is unchanged");
});

// ---------------------------------------------------------------------------
// 343-2 (Context intelligence) — the bounded `## Repo map` section. It renders
// ONLY when the project carries generated bytes (so every no-tree packet stays
// byte-identical), names the REAL exported symbols of the persisted tree (never
// a guessed name), and is char-bounded so it cannot blow the packet budget.
// ---------------------------------------------------------------------------
test("343-2: the packet carries a ranked repo map when generated bytes exist", () => {
  const base = makeProject();
  const tree = [
    {
      path: "src/core.ts",
      source: "export function core(a: number): number { return a; }\n",
      hash: "h1",
      attempt: 0,
    },
    {
      path: "src/use.ts",
      source: 'import { core } from "./core.ts";\nexport function use(): number { return core(1); }\n',
      hash: "h2",
      attempt: 0,
    },
  ];
  const out = compileAgentPacket({ ...base, generatedTree: tree });
  assert.ok(out.includes("## Repo map"), "the section renders for a generated tree");
  const section = out.slice(out.indexOf("## Repo map"), out.indexOf("## Exit criteria (DoD)"));
  assert.ok(
    section.includes("src/core.ts: core · in 1, 2 ln"),
    `the imported file renders its real symbol and in-degree (got ${JSON.stringify(section)})`,
  );
  assert.ok(section.includes("src/use.ts: use · in 0, 3 ln"), "the leaf row renders");
  assert.ok(
    section.indexOf("src/core.ts") < section.indexOf("src/use.ts"),
    "the imported file outranks its importer",
  );
});

test("343-2: the repo map never invents a symbol (prose is not an export)", () => {
  const base = makeProject();
  const tree = [
    {
      path: "src/generated.ts",
      source: '// export function ghost() {}\nconst s = "export const phantom = 1";\n',
      hash: "h1",
      attempt: 0,
    },
  ];
  const out = compileAgentPacket({ ...base, generatedTree: tree });
  assert.ok(out.includes("## Repo map"));
  const section = out.slice(out.indexOf("## Repo map"), out.indexOf("## Exit criteria (DoD)"));
  assert.equal(section.includes("ghost"), false, "a commented export is never a symbol");
  assert.equal(section.includes("phantom"), false, "a string-literal export is never a symbol");
  assert.ok(section.includes("(no named exports)"), "the honest no-symbols form renders");
});

test("343-2: the repo map section is bounded and deterministic", () => {
  const base = makeProject();
  const tree = Array.from({ length: 60 }, (_, i) => ({
    path: `src/generated/collect-rent-${String(i).padStart(2, "0")}.ts`,
    source: `export function collectRent${i}(): number { return ${i}; }\n`,
    hash: `h${i}`,
    attempt: 0,
  }));
  const project = { ...base, generatedTree: tree };
  const a = compileAgentPacket(project);
  const b = compileAgentPacket(project);
  assert.equal(a, b, "two compiles of the same project are byte-identical");
  const start = a.indexOf("## Repo map");
  assert.ok(start >= 0, "the map renders");
  const section = a.slice(start, a.indexOf("## Exit criteria (DoD)"));
  assert.ok(section.includes("repo map elided"), "the budget elision is made visible");
});

test("343-2 control: a project with no generated bytes stays byte-identical (no section)", () => {
  const base = makeProject();
  const out = compileAgentPacket({ ...base, generatedTree: undefined, generatedSource: "" });
  assert.equal(out.includes("## Repo map"), false, "no section without generated bytes");
});
