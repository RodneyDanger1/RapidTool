import { test } from "node:test";
import assert from "node:assert/strict";
import { compileAgentPacket, exportProfiles, PACKET_VERSION } from "./packet.ts";
import { PHASES } from "./phases.ts";
import type { CrewSeat, HitlDecision, Project } from "./types.ts";

/**
 * Packet v2 (T7 / R10 / R4) — src/lib/packet.ts pins.
 *
 * Fixture strategy: emptyProject() from "./engine" is used whenever the engine
 * module is loadable under `node --experimental-strip-types`. Today engine.ts
 * still uses extensionless relative imports (parent-owned, converted at
 * integration), so its load fails — the tests then fall back to a faithful
 * local replica of emptyProject's post-R4 shape: 13 phase records, sandbox
 * {runtime:"sync-template", ramMb:null, timeoutS:30, isolated:true}, and the
 * packet compiled AFTER memory is populated (R4/B-05) so a fresh packet never
 * claims "(empty — treat Phase 0 research as first write)".
 */

const TRUNC_MARKER = "…[TRUNCATED — regenerate at a HITL gate for the full plan]";
const EMPTY_MEM_LINE = "(empty — treat Phase 0 research as first write)";

let engineEmptyProject: ((input: { name: string; brief: string }) => Project) | null = null;
try {
  const engine = await import("./engine.ts");
  engineEmptyProject = engine.emptyProject;
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
    sandbox: { runtime: "sync-template", ramMb: null, timeoutS: 30, isolated: true },
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

