// store.test.ts — store batch (proposal 02): approve force-guard + autopilot actor labeling
// (R3/B-03, T2), packet freshness on auto-advance (B-06/B-19), clone-as-snapshot (B-08),
// runUntilHitl honest stops + derived loop bound (B-13/B-24), refreshPacket delegation (B-06).
//
// Runs under `node --experimental-strip-types --test src/lib/store.test.ts`.
// Node has no localStorage, and zustand persist resolves its default storage
// (createJSONStorage(() => window.localStorage)) when the store module is evaluated —
// so the polyfill MUST be installed before the dynamic `await import("./store.ts")` below.

import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { dedupeMemoryIds, emptyProject, hydrateProject } from "./engine.ts";
import { fnv1a } from "./algorithms.ts";
import type { Artifact, ChatLogRow, HitlRequest, JsonLog, PhaseId, Project, WildParkInfo } from "./types.ts";

class MemoryStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
}
(globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
(globalThis as unknown as { window: unknown }).window = globalThis;

// Dynamic import: must run AFTER the polyfill so persist binds a real storage.
const { convergeRealRun, useRapid, persistStorageHealth } = await import("./store.ts");
// Let the initial rehydration (which seeds the demo project on empty storage) settle
// before the first test; beforeEach wipes state for every test regardless.
await new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
  useRapid.setState({ projects: [], activeId: null, hydrated: true, autopilot: false });
});

const NAME = "Northwind Dispatch";
const BRIEF =
  "Build a field-service dispatch board for a regional HVAC shop: jobs, techs, parts, and same-day reroutes. Same-day SLA, offline warehouse scan.";
const GUARD_ERROR =
  "Failing sandbox output requires explicit override — tick 'I reviewed the failure'.";
/** DF-09 (W23 L6 · 249 SPEC 1): a forced override of a FAILED P6 sandbox now
 *  REQUIRES a caller-supplied rationale (≥12 trimmed chars — enforced by the
 *  store's pre-check and the engine's coded RT_E_VALIDATION). The two force
 *  pins below track the new contract and assert the rationale is journaled. */
const OVERRIDE_RATIONALE =
  "Reviewed the failing sandbox crash myself — overriding the red P6 gate (fixture rationale).";

function seedProject(over?: Partial<Project>): Project {
  return { ...emptyProject({ name: NAME, brief: BRIEF }), ...over };
}

function install(p: Project): Project {
  useRapid.setState({ projects: [p], activeId: p.id, hydrated: true, autopilot: false });
  return p;
}

function current(id: string): Project {
  const p = useRapid.getState().projects.find((x) => x.id === id);
  if (!p) throw new Error(`project ${id} not in store`);
  return p;
}

/** A project parked at `phase` awaiting HITL with all prior phases sealed. */
function projectAtGate(
  phase: PhaseId,
  opts: {
    forceHuman?: boolean;
    lastTest?: { ok: boolean; detail: string; label?: string; evidenceHash?: string } | null;
    schedule?: Project["schedule"];
  } = {},
): Project {
  const p = emptyProject({ name: NAME, brief: BRIEF });
  const now = Date.now();
  const phases = p.phases.map((r) =>
    r.id < phase
      ? { ...r, status: "complete" as const, completedAt: r.completedAt ?? now }
      : r.id === phase
        ? { ...r, status: "awaiting_hitl" as const }
        : { ...r, status: "locked" as const },
  );
  const hitl: HitlRequest = {
    phase,
    title: `Gate P${phase}`,
    prompt: "Approve this gate?",
    stakes: "Test fixture",
    ...(opts.forceHuman ? { forceHuman: true } : {}),
  };
  return {
    ...p,
    phases,
    currentPhase: phase,
    status: "awaiting_hitl" as const,
    hitl,
    lastTest:
      opts.lastTest === undefined
        ? null
        : (opts.lastTest as unknown as NonNullable<Project["lastTest"]>),
    ...(opts.schedule ? { schedule: opts.schedule } : {}),
  };
}

// ---------------------------------------------------------------------------
// clone = snapshot (B-08)
// ---------------------------------------------------------------------------

test("clone deep-copies progress with fresh id, (copy) suffix, and project.cloned log", () => {
  const p = install(seedProject());
  assert.equal(useRapid.getState().execute(p.id).ok, true); // run P0 → currentPhase 1
  const orig = current(p.id);
  assert.ok(orig.packet.includes("Core Orchestration"), "precondition: packet is at P1");

  const copyId = useRapid.getState().clone(orig.id);
  assert.ok(copyId && copyId !== orig.id);
  const copy = current(copyId);
  assert.equal(copy.name, `${orig.name} (copy)`);
  assert.equal(copy.currentPhase, orig.currentPhase);
  assert.equal(copy.status, orig.status);
  assert.deepEqual(copy.phases, orig.phases);
  assert.deepEqual(copy.memory, orig.memory);
  assert.deepEqual(copy.artifacts, orig.artifacts);
  assert.deepEqual(copy.decisions, orig.decisions);
  assert.equal(copy.packet, orig.packet, "packet snapshot is carried over verbatim");
  const last = copy.logs[copy.logs.length - 1];
  assert.equal(last.event, "project.cloned");
  assert.equal(last.detail, orig.id);
  assert.equal(orig.logs.some((l) => l.event === "project.cloned"), false, "source is not touched");
});

test("clone is an independent snapshot (mutating the copy leaves the source alone)", () => {
  const p = install(seedProject());
  const copyId = useRapid.getState().clone(p.id);
  assert.ok(copyId);
  useRapid.getState().setNotes(copyId, "operator steering");
  assert.equal(current(copyId).notes, "operator steering");
  assert.equal(current(p.id).notes, "");
});

test("clone prepends the copy to the list and selects it", () => {
  const p = seedProject();
  const other = seedProject({ id: "other-project", name: "Other" });
  install(other);
  useRapid.setState({ projects: [p, other], activeId: p.id, hydrated: true, autopilot: false });
  const copyId = useRapid.getState().clone(p.id);
  assert.ok(copyId);
  const st = useRapid.getState();
  assert.equal(st.projects.length, 3);
  assert.equal(st.projects[0].id, copyId);
  assert.equal(st.activeId, copyId);
});

test("clone of a blocked project keeps the rejection state", () => {
  const p = install(projectAtGate(4));
  assert.equal(
    useRapid.getState().reject(p.id, "No external networking at all, ever, period.").ok,
    true,
  );
  const blocked = current(p.id);
  const copyId = useRapid.getState().clone(blocked.id);
  assert.ok(copyId);
  const copy = current(copyId);
  assert.equal(copy.status, "blocked");
  assert.equal(copy.phases[4].status, "rejected");
  assert.deepEqual(copy.phases[4].rejectionHistory, blocked.phases[4].rejectionHistory);
  assert.equal(copy.phases[4].rejectionNote, blocked.phases[4].rejectionNote);
  assert.deepEqual(copy.decisions, blocked.decisions);
  assert.equal(copy.hitl, null);
  assert.equal(blocked.status, "blocked", "source project unchanged");
});

// ---------------------------------------------------------------------------
// approve force-guard (R3/B-03) + decision journal actors (T2)
// ---------------------------------------------------------------------------

test("approve refuses a failing P6 gate without the explicit override", () => {
  const p = install(
    projectAtGate(6, { forceHuman: true, lastTest: { ok: false, detail: "fixture sandbox crash" } }),
  );
  const res = useRapid.getState().approve(p.id);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error, GUARD_ERROR);
  const after = current(p.id);
  assert.equal(after.status, "awaiting_hitl", "state is untouched by the refusal");
  assert.equal(after.currentPhase, 6);
  assert.equal(after.hitl?.forceHuman, true);
  assert.equal(after.decisions.length, 0);
});

test("approve with force overrides the failing P6 gate and journals the human actor", () => {
  const p = install(
    projectAtGate(6, { forceHuman: true, lastTest: { ok: false, detail: "fixture sandbox crash" } }),
  );
  // DF-09 (W23 L6): the forced override now requires a caller-supplied rationale.
  const res = useRapid.getState().approve(p.id, { force: true, note: OVERRIDE_RATIONALE });
  assert.equal(res.ok, true);
  const after = current(p.id);
  assert.equal(after.currentPhase, 7);
  assert.equal(after.status, "running");
  assert.equal(after.phases[6].status, "complete");
  assert.equal(after.hitl, null);
  const d = after.decisions[after.decisions.length - 1];
  assert.equal(d.decision, "approve");
  assert.equal(d.decidedBy, "human");
  assert.equal(d.phase, 6);
  assert.equal(d.note, OVERRIDE_RATIONALE, "DF-09: the override's rationale is journaled on the decision row");
  assert.ok(after.logs.some((l) => l.event === "hitl.approved_override"), "override is loud");
  assert.ok(
    after.memory.some((m) => m.text.startsWith("Human overrode failing sandbox at P6") && m.score === 0.4),
    "0.4 memory row records the override",
  );
});

test("approve passes requestedAt through to the decision journal", () => {
  const requestedAt = 1_700_000_123_456;
  const p = install(
    projectAtGate(6, { forceHuman: true, lastTest: { ok: false, detail: "fixture sandbox crash" } }),
  );
  const res = useRapid.getState().approve(p.id, { force: true, requestedAt, note: OVERRIDE_RATIONALE });
  assert.equal(res.ok, true);
  const d = current(p.id).decisions[current(p.id).decisions.length - 1];
  assert.equal(d.requestedAt, requestedAt);
  assert.equal(d.decidedBy, "human");
});

test("approve on a non-forceHuman stock gate still works and refreshes the packet edge", () => {
  const p = install(projectAtGate(4));
  const res = useRapid.getState().approve(p.id);
  assert.equal(res.ok, true);
  const after = current(p.id);
  assert.equal(after.currentPhase, 5);
  assert.equal(after.phases[4].status, "complete");
  assert.equal(after.phases[5].status, "ready");
  const d = after.decisions[after.decisions.length - 1];
  assert.equal(d.decision, "approve");
  assert.equal(d.decidedBy, "human");
  assert.equal(after.logs.some((l) => l.event === "hitl.approved_override"), false);
  assert.ok(
    after.packet.includes("Validation, HITL & Self-Learning"),
    "packet current edge = P5 after approval (B-19)",
  );
});

test("DoD gate verdicts are recorded on completion AND on HITL approval (A01 regression)", () => {
  // Non-HITL completion (execute P0 → auto-advance) records a gate on P0.
  const p0 = install(seedProject());
  assert.equal(useRapid.getState().execute(p0.id).ok, true);
  const after0 = current(p0.id);
  const gate0 = after0.phases[0].gate;
  assert.ok(gate0, "P0 records a gate on completion");
  assert.equal(typeof gate0.passed, "boolean");
  assert.ok(Array.isArray(gate0.unmet));
  assert.equal(typeof gate0.evidenceHash, "string");
  assert.ok(gate0.evidenceHash.length > 0);
  assert.ok(
    after0.artifacts.some((a) => a.kind === "gate" && a.phase === 0),
    "a gate artifact is emitted for P0",
  );

  // HITL approval (P4) records a gate on the just-approved phase (the bug review/01
  // suspected: that recordGate runs with the advanced currentPhase and misses).
  const p4 = install(projectAtGate(4));
  assert.equal(useRapid.getState().approve(p4.id).ok, true);
  const after4 = current(p4.id);
  const gate4 = after4.phases[4].gate;
  assert.ok(gate4, "P4 records a gate on HITL approval");
  assert.equal(typeof gate4.passed, "boolean");
  assert.ok(Array.isArray(gate4.unmet));
  assert.equal(typeof gate4.evidenceHash, "string");
  assert.ok(
    after4.artifacts.some((a) => a.kind === "gate" && a.phase === 4),
    "a gate artifact is emitted for P4",
  );
});

test("approve keeps its existing guards (missing project / no hitl / phase mismatch)", () => {
  const missing = useRapid.getState().approve("nope");
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error, "Project missing.");

  const fresh = install(seedProject());
  const noHitl = useRapid.getState().approve(fresh.id);
  assert.equal(noHitl.ok, false);
  if (!noHitl.ok) assert.equal(noHitl.error, "No pending approval.");

  const g = projectAtGate(4);
  const drifted: Project = { ...g, currentPhase: 5, status: "running" };
  install(drifted);
  const mismatch = useRapid.getState().approve(drifted.id);
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.error, "HITL phase does not match the current edge.");
});

// ---------------------------------------------------------------------------
// autopilot exclusion + actor labeling (R3/B-03b, T2)
// ---------------------------------------------------------------------------

test("autopilot can never approve a forceHuman gate", () => {
  const p = projectAtGate(6, {
    forceHuman: true,
    lastTest: { ok: false, detail: "fixture sandbox crash" },
  });
  useRapid.setState({ projects: [p], activeId: p.id, hydrated: true, autopilot: true });
  const res = useRapid.getState().execute(p.id);
  assert.equal(res.ok, false);
  const after = current(p.id);
  assert.equal(after.status, "awaiting_hitl", "gate stays parked");
  assert.equal(after.phases[6].status, "awaiting_hitl");
  assert.equal(after.decisions.length, 0, "no autopilot decision slipped through");
});

test("autopilot approvals are journaled with the autopilot actor", () => {
  const base = projectAtGate(6, {
    schedule: { tightness: 3.5, securityDelta: 0, apiDelta: 0, extraHitl: [6], notes: [] },
    lastTest: {
      ok: true,
      detail: "fixture self-test pass",
      label: "tested",
      evidenceHash: "fixture-evidence-hash",
    },
  });
  // M-09: autopilot may only approve a phase whose DoD criteria pass — the
  // fixture must carry genuinely-complete P6 work (source + code artifact).
  const p: Project = {
    ...base,
    // P0-01 p6-brief-fit probe: the fixture source must carry brief
    // vocabulary as identifiers (the honest conformance check) —
    // console.log toys can no longer pass the gate.
    generatedSource:
      "function dispatchJobs(){ } function listTechs(){ } function orderParts(){ } function planReroutes(){ } function warehouseScan(){ } function regionalBoard(){ } function hvacShopDispatch(){ } function sameDaySla(){ } function offlineScan(){ }",
    artifacts: [
      ...base.artifacts,
      {
        id: "p6-code-fixture",
        phase: 6,
        kind: "code",
        title: "Generated module",
        body: "function dispatchJobs(){ } function listTechs(){ } function orderParts(){ } function planReroutes(){ } function warehouseScan(){ } function regionalBoard(){ } function hvacShopDispatch(){ } function sameDaySla(){ } function offlineScan(){ }",
      },
    ],
  };
  useRapid.setState({ projects: [p], activeId: p.id, hydrated: true, autopilot: true });
  const res = useRapid.getState().execute(p.id);
  assert.equal(res.ok, true);
  const after = current(p.id);
  assert.equal(after.currentPhase, 7);
  assert.equal(after.phases[6].status, "complete");
  const d = after.decisions[after.decisions.length - 1];
  assert.equal(d.decision, "approve");
  assert.equal(d.decidedBy, "autopilot");
  assert.equal(d.phase, 6);
});

test("M-09: autopilot refuses to approve a phase whose DoD fails", () => {
  // lastTest null + no generatedSource → P6 DoD unmet → autopilot must deny.
  const p = projectAtGate(6, {
    schedule: { tightness: 3.5, securityDelta: 0, apiDelta: 0, extraHitl: [6], notes: [] },
  });
  useRapid.setState({ projects: [p], activeId: p.id, hydrated: true, autopilot: true });
  useRapid.getState().execute(p.id);
  const after = current(p.id);
  assert.equal(after.status, "awaiting_hitl");
  assert.equal(after.phases[6].status, "awaiting_hitl");
  assert.ok(!after.decisions.some((dec) => dec.decision === "approve" && dec.phase === 6));
});

test("runVerifyAsync guards a project with no generated source (fixes/135 UI verify path)", async () => {
  const p = install(projectAtGate(6));
  const res = await useRapid.getState().runVerifyAsync(p.id);
  assert.equal(res.ok, false);
  assert.match(res.error ?? "", /No generated source/);
  const after = current(p.id);
  assert.equal(after.lastTest, p.lastTest, "no verify outcome applied without a source");
});

test("runP6Journey guards an unknown project id (fixes/150 M4 ms4 journey mirror)", async () => {
  const res = await useRapid.getState().runP6Journey("no-such-project");
  assert.ok(!res.ok);
  if (!res.ok) assert.match(res.error, /not found/i);
});

test("runP6Journey commits the honest budget-exhausted outcome via injected deps (fixes/150 M4 ms4)", async () => {
  const p = install(projectAtGate(6));
  const beforeLogs = p.logs.length;
  // Injected fakes (mirrors headless.test.ts's deterministic driveP6Journey
  // tests): synthesize returns the floor unchanged and never produces a
  // generatedTree, so budget 1 ends in an honest FAILED — no key, no fs, no
  // network. runTree throws if ever reached (a no-tree cycle must not run it).
  const res = await useRapid.getState().runP6Journey(p.id, {
    budget: 1,
    deps: {
      synthesize: async (project) => project,
      runTree: async () => {
        throw new Error("runTree must not run on a no-tree cycle");
      },
    },
  });
  assert.ok(res.ok);
  if (res.ok) {
    assert.equal(res.outcome, "failed");
    assert.equal(res.cycles, 1);
    assert.equal(res.budget, 1);
  }
  const after = current(p.id);
  assert.ok(after.logs.length > beforeLogs, "journey evidence committed to the store record");
  assert.ok(
    after.logs.some((l) => l.event === "p6.journey.exhausted"),
    "exhausted log landed on the committed record",
  );
});

test("execute on an awaiting gate without autopilot reports waiting and changes nothing", () => {
  const p = install(projectAtGate(6));
  const res = useRapid.getState().execute(p.id);
  assert.equal(res.ok, false);
  const after = current(p.id);
  assert.equal(after.status, "awaiting_hitl");
  assert.equal(after.decisions.length, 0);
});

// ---------------------------------------------------------------------------
// packet freshness on auto-advance (B-06/B-19)
// ---------------------------------------------------------------------------

test("auto-advance recompiles the packet to the new current edge", () => {
  const p = install(seedProject());
  const before = current(p.id);
  assert.ok(before.packet.includes("Deep Research & Feasibility"), "fresh packet describes P0");
  assert.ok(
    !before.packet.includes("Core Orchestration & State Graph"),
    "P1 edge not in the packet yet",
  );

  const res = useRapid.getState().execute(p.id);
  assert.equal(res.ok, true);
  const after = current(p.id);
  assert.equal(after.currentPhase, 1);
  assert.ok(after.packet.includes("Core Orchestration & State Graph"), "packet edge = P1 (B-06)");
  const art = after.artifacts.find((a) => a.kind === "packet");
  assert.ok(art, "packet artifact exists after the advance");
  assert.equal(art!.body, after.packet, "packet artifact body is in sync (B-19)");
});

test("refreshPacket delegates to stampPacket and refreshes packet, artifact, and A4 trace", () => {
  const p = install(seedProject());
  useRapid.getState().rename(p.id, "Renamed System");
  const renamed = current(p.id);
  assert.ok(!renamed.packet.includes("Renamed System"), "rename alone does not recompile");
  const oldA4 = renamed.traces.find((t) => t.id === "A4")?.ranAt ?? 0;

  useRapid.getState().refreshPacket(p.id);
  const after = current(p.id);
  assert.ok(after.packet.includes("Renamed System"), "packet string recompiled");
  assert.ok(after.packet.includes("# RapidTool Agent Packet v3 — Renamed System"));
  const art = after.artifacts.find((a) => a.kind === "packet");
  assert.ok(art && art.body === after.packet, "packet artifact body replaced in the same pass");
  const a4 = after.traces.find((t) => t.id === "A4");
  assert.ok(a4 && a4.ranAt >= oldA4, "A4 trace re-stamped");
  assert.ok(after.traces.some((t) => t.id === "A1"), "fresh A1..A8 traces present");
});

// ---------------------------------------------------------------------------
// runUntilHitl honest stops (B-13) + derived loop bound (B-24)
// ---------------------------------------------------------------------------

test("runUntilHitl runs P1..P4 and stops at the first stock gate with reason hitl", () => {
  const p = install(seedProject());
  assert.equal(useRapid.getState().execute(p.id).ok, true); // P0 executed → currentPhase 1
  const r = useRapid.getState().runUntilHitl(p.id);
  assert.equal(r.ok, true);
  assert.equal(r.ran, 4);
  assert.equal(r.stoppedReason, "hitl");
  // 185-H1 / 208: ok:true never carries `error`
  assert.equal("error" in r, false);
  if (r.ok) assert.equal(r.note, undefined);
  const after = current(p.id);
  assert.equal(after.currentPhase, 4);
  assert.equal(after.status, "awaiting_hitl");
  assert.equal(after.phases[4].status, "awaiting_hitl");
  assert.equal(after.decisions.length, 0);

  // A second call while the project is already waiting is an honest 0-run stop.
  const again = useRapid.getState().runUntilHitl(p.id);
  assert.equal(again.ok, false);
  assert.equal(again.ran, 0);
  assert.equal(again.stoppedReason, "hitl");
  if (!again.ok) assert.equal(again.error, "Waiting on human approval.");
});

test("cold runUntilHitl from a P0 seed executes P0..P4 (5 phases) before the gate", () => {
  const p = install(seedProject());
  const r = useRapid.getState().runUntilHitl(p.id);
  assert.equal(r.ok, true);
  assert.equal(r.ran, 5);
  assert.equal(r.stoppedReason, "hitl");
  const after = current(p.id);
  assert.equal(after.currentPhase, 4);
  assert.equal(after.phases[0].status, "complete");
  assert.equal(after.phases[3].status, "complete");
  assert.equal(after.phases[4].status, "awaiting_hitl");
});

test("runUntilHitl on a blocked project reports blocked with the retry error", () => {
  const p = install(projectAtGate(4));
  assert.equal(
    useRapid.getState().reject(p.id, "No external networking at all, ever, period.").ok,
    true,
  );
  const blocked = current(p.id);
  assert.equal(blocked.status, "blocked");
  const r = useRapid.getState().runUntilHitl(blocked.id);
  assert.equal(r.ok, false);
  assert.equal(r.ran, 0);
  assert.equal(r.stoppedReason, "blocked");
  if (!r.ok) assert.equal(r.error, "Phase rejected — retry with the note applied.");
  const after = current(p.id);
  assert.equal(after.status, "blocked", "state unchanged");
  assert.equal(after.phases[4].status, "rejected");
});

test("runUntilHitl reports a 0-run entry error with stoppedReason error", () => {
  // P1 is marked ready while P0 is still locked → the run cannot enter P1.
  const p = seedProject();
  const phases = p.phases.map((r) =>
    r.id === 0
      ? { ...r, status: "locked" as const }
      : r.id === 1
        ? { ...r, status: "ready" as const }
        : { ...r, status: "locked" as const },
  );
  install({ ...p, phases, currentPhase: 1, status: "running" });
  const r = useRapid.getState().runUntilHitl(p.id);
  assert.equal(r.ok, false);
  assert.equal(r.ran, 0);
  assert.equal(r.stoppedReason, "error");
  if (!r.ok) assert.equal(r.error, "Cannot enter P1 — prior phases are not sealed.");
});

test("runUntilHitl at the final edge completes with stoppedReason complete", () => {
  const p = seedProject();
  const phases = p.phases.map((r) =>
    r.id < 12
      ? { ...r, status: "complete" as const, completedAt: r.completedAt ?? 1 }
      : { ...r, status: "ready" as const },
  );
  install({ ...p, phases, currentPhase: 12, status: "running" });
  const r = useRapid.getState().runUntilHitl(p.id);
  assert.equal(r.ok, true);
  assert.equal(r.ran, 1);
  assert.equal(r.stoppedReason, "complete");
  const after = current(p.id);
  assert.equal(after.status, "complete");
  assert.equal(after.currentPhase, 12);
});

test("runUntilHitl on a missing project returns ok false with a null stop reason", () => {
  const r = useRapid.getState().runUntilHitl("no-such-project");
  assert.equal(r.ok, false);
  assert.equal(r.ran, 0);
  assert.equal(r.stoppedReason, null);
  if (!r.ok) assert.equal(r.error, "Project missing.");
});

test("full pipeline: runUntilHitl + approve loops to completion with honest stops, never capping", () => {
  // fixes/154: pin enforceDod=false — emptyProject's default is keyed-env
  // dependent (engine.ts keyedDeepSeekConfigured), and this is a KEYLESS floor
  // run: a stray DEEPSEEK_API_KEY in the test env must never flip the P6 gate
  // into a hard-DoD block that aborts the deterministic completion.
  const p = install({ ...seedProject(), enforceDod: false });
  const decided: number[] = [];
  let approvals = 0;
  for (;;) {
    const r = useRapid.getState().runUntilHitl(p.id);
    const st = current(p.id);
    if (r.stoppedReason === "hitl") {
      const gate = st.hitl?.phase;
      assert.ok(gate !== undefined, `hitl stop must carry a gate, got cp ${st.currentPhase}`);
      const a = useRapid.getState().approve(p.id);
      assert.equal(a.ok, true);
      decided.push(gate);
      approvals++;
    } else if (r.stoppedReason === "complete") {
      assert.equal(r.ok, true);
      break;
    } else {
      assert.fail(
        `unexpected stop ${r.stoppedReason}: ${
          r.ok === false ? r.error : "note" in r && r.note ? r.note : ""
        }`,
      );
    }
    assert.ok(approvals < 12, "loop must terminate");
  }
  const after = current(p.id);
  assert.equal(after.status, "complete");
  assert.equal(after.currentPhase, 12);
  assert.deepEqual(decided, [4, 5, 8, 9, 11], "stock gates + scheduled P11 gate all approved");
  assert.equal(after.decisions.length, 5);
  assert.ok(after.decisions.every((d) => d.decidedBy === "human"));
});

// ---------------------------------------------------------------------------
// reject journaling (engine delegation; unchanged signature)
// ---------------------------------------------------------------------------

test("reject appends rejection history and a human reject decision", () => {
  const note = "Add role-scoped OAuth before anything ships.";
  const p = install(projectAtGate(5));
  const res = useRapid.getState().reject(p.id, note);
  assert.equal(res.ok, true);
  const after = current(p.id);
  assert.equal(after.status, "blocked");
  assert.equal(after.hitl, null);
  const rec = after.phases[5];
  assert.equal(rec.status, "rejected");
  assert.equal(rec.rejectionNote, note);
  assert.equal(rec.rejectionHistory?.length, 1);
  assert.equal(rec.rejectionHistory?.[0].note, note);
  const d = after.decisions[after.decisions.length - 1];
  assert.equal(d.decision, "reject");
  assert.equal(d.decidedBy, "human");
});

// ---------------------------------------------------------------------------
// project export / import actions (io.ts delegation)
// ---------------------------------------------------------------------------

test("exportProject returns the project JSON and importProject round-trips it", () => {
  const p = install(seedProject());
  const json = useRapid.getState().exportProject(p.id);
  assert.ok(typeof json === "string" && json.length > 0);
  useRapid.setState({ projects: [], activeId: null });
  const res = useRapid.getState().importProject(json!);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.id, p.id);
    assert.equal(useRapid.getState().activeId, p.id);
    assert.equal(useRapid.getState().projects.length, 1);
    assert.equal(useRapid.getState().projects[0].name, p.name);
  }
});

test("exportProject returns null for a missing project", () => {
  assert.equal(useRapid.getState().exportProject("no-such-id"), null);
});

test("importProject replaces an existing project with the same id", () => {
  const p = install(seedProject());
  const json = useRapid.getState().exportProject(p.id)!;
  const modified = JSON.parse(json) as Project;
  modified.name = "Renamed via import";
  const res = useRapid.getState().importProject(JSON.stringify(modified));
  assert.equal(res.ok, true);
  const st = useRapid.getState();
  assert.equal(st.projects.length, 1);
  assert.equal(st.projects[0].name, "Renamed via import");
  assert.equal(st.activeId, p.id);
});

test("importProject prepends a fresh project and selects it", () => {
  const p = install(seedProject());
  const other = seedProject({ id: "imported-project", name: "Imported Build" });
  const res = useRapid.getState().importProject(JSON.stringify(other));
  assert.equal(res.ok, true);
  const st = useRapid.getState();
  assert.equal(st.projects.length, 2);
  assert.equal(st.projects[0].id, "imported-project");
  assert.equal(st.activeId, "imported-project");
  assert.equal(st.projects[1].id, p.id);
});

test("importProject rejects invalid JSON with an inline error", () => {
  const res = useRapid.getState().importProject("{ not json");
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.error, /Invalid JSON/);
});

test("importProject rejects a payload with a bad shape and leaves state untouched", () => {
  install(seedProject());
  const before = useRapid.getState().projects.length;
  const res = useRapid.getState().importProject(JSON.stringify({ id: "x" }));
  assert.equal(res.ok, false);
  assert.equal(useRapid.getState().projects.length, before);
});

// ---------------------------------------------------------------------------
// BUG WAVE 27 — ST-6: async serialization + operator-field rebase
// ---------------------------------------------------------------------------

test("ST-6: an async run preserves a rename made while the run was in flight", async () => {
  const p = install(seedProject());
  // Starts synchronously on the pre-run snapshot; rename commits BEFORE the
  // run's whole-project commit lands.
  const run = useRapid.getState().runUntilHitlAsync(p.id);
  useRapid.getState().rename(p.id, "Renamed Mid-Run");
  const res = await run;
  assert.equal(res.ok, true);
  const after = current(p.id);
  assert.equal(after.name, "Renamed Mid-Run", "rename must survive the run's commit");
  assert.equal(after.currentPhase, 4, "run still parks at the first stock gate");
  assert.equal(after.phases[4].status, "awaiting_hitl");
});

test("ST-6: overlapping async actions serialize per project — no stale-snapshot rollback", async () => {
  const p = install(seedProject());
  const [full, step] = await Promise.all([
    useRapid.getState().runUntilHitlAsync(p.id),
    useRapid.getState().executeAsync(p.id),
  ]);
  assert.equal(full.ok, true);
  if (full.ok) assert.equal(full.stoppedReason, "hitl");
  // The queued step executes against the FULL RUN's committed state (parked at
  // P4) and reports the same honest stop the sync execute reports on a gate.
  assert.equal(step.ok, false);
  if (!step.ok) assert.equal(step.error, "Waiting on human approval.");
  const after = current(p.id);
  assert.equal(
    after.currentPhase,
    4,
    "an executeAsync settling after the full run must not roll the graph back to P1",
  );
  assert.equal(after.phases[4].status, "awaiting_hitl");
  // Exactly ONE pass over P0..P4 — no duplicated synthesis from a double-fire.
  const phaseEntries = after.logs.filter((l) => l.event === "phase.enter");
  assert.equal(phaseEntries.length, 5, "each phase synthesized exactly once");
});

test("ST-6: deleting a project while an async run is queued never resurrects it", async () => {
  const p = install(seedProject());
  const run = useRapid.getState().runUntilHitlAsync(p.id);
  useRapid.getState().remove(p.id);
  const res = await run;
  // The serialized action starts after the delete lands, so it sees the missing
  // project and reports the honest entry error instead of synthesizing a ghost.
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error, "Project missing.");
  assert.equal(useRapid.getState().projects.length, 0, "the deleted project stays gone");
  assert.equal(useRapid.getState().activeId, null);
});

// ---------------------------------------------------------------------------
// BUG WAVE 27 — corrupt persisted state recovery (onRehydrateStorage error path)
// ---------------------------------------------------------------------------

test("corrupt persisted JSON is dropped: the store still hydrates, seeds, and self-heals storage", async () => {
  useRapid.setState({ projects: [], activeId: null, hydrated: false, autopilot: false, demoSeeded: false });
  localStorage.setItem("rapidtool.v4", "{ definitely not json");
  await useRapid.persist.rehydrate();
  const st = useRapid.getState();
  assert.equal(st.hydrated, true, "hydrated flips true even when storage is corrupt");
  assert.equal(st.projects.length, 1, "empty-store demo seed ran after the corrupt drop");
  assert.equal(st.activeId, st.projects[0].id);
  const healed = localStorage.getItem("rapidtool.v4") ?? "";
  assert.doesNotThrow(() => JSON.parse(healed), "the corrupt blob is overwritten with valid JSON");
  const parsed = JSON.parse(healed) as { state?: { projects?: unknown[] } };
  assert.equal(parsed.state?.projects?.length, 1);
});

// ---------------------------------------------------------------------------
// BUG WAVE 27 — M-05: ingestReport evidence warning
// ---------------------------------------------------------------------------

test("M-05: complete report WITH tests_run evidence is not flagged as evidence-less", () => {
  const p = install(seedProject());
  const base = { phase: 0, status: "complete" as const, summary: "P0 delivered with a test pass" };
  const withTests = useRapid.getState().ingestReport(p.id, {
    ...base,
    tests_run: [{ command: "npm test", pass: true }],
  });
  assert.equal(withTests.ok, true);
  assert.equal(
    current(p.id).logs.some(
      (l) => l.event === "agent.report" && l.detail.includes("no tests_run evidence"),
    ),
    false,
    "an evidence-carrying complete report must not trip the no-evidence warn",
  );
  const noTests = useRapid.getState().ingestReport(p.id, base);
  assert.equal(noTests.ok, true);
  assert.equal(
    current(p.id).logs.some(
      (l) => l.event === "agent.report" && l.detail.includes("no tests_run evidence"),
    ),
    true,
    "a genuinely evidence-less complete report still gets the explicit warn",
  );
});

test("M-05: malformed tests_run payloads count as absent (warn fires, no crash)", () => {
  const p = install(seedProject());
  const res = useRapid.getState().ingestReport(p.id, {
    phase: 0,
    status: "complete",
    summary: "P0 delivered",
    tests_run: "not-an-array",
  });
  assert.equal(res.ok, true);
  assert.equal(
    current(p.id).logs.some(
      (l) => l.event === "agent.report" && l.detail.includes("no tests_run evidence"),
    ),
    true,
  );
});

// ---------------------------------------------------------------------------
// CORE sweep (58_ready_core) — truncated persisted STATE hydration. Valid JSON
// whose project rows were cut (missing arrays/scalars) must hydrate into a
// runnable project, never throw inside seedIfEmpty's hydrateProject pass.
// ---------------------------------------------------------------------------

test("CORE sweep: truncated persisted state (partial project object) hydrates into a runnable project", async () => {
  useRapid.setState({ projects: [], activeId: null, hydrated: false, autopilot: false, demoSeeded: true });
  localStorage.setItem(
    "rapidtool.v4",
    JSON.stringify({
      state: {
        projects: [
          {
            id: "trunc-1",
            name: "Half a project",
            brief: "Build a field-service dispatch board for HVAC: jobs, techs, parts, same-day reroutes.",
          },
        ],
        activeId: "trunc-1",
        autopilot: false,
        demoSeeded: true,
      },
      version: 0,
    }),
  );
  await useRapid.persist.rehydrate();
  const p = useRapid.getState().projects.find((x) => x.id === "trunc-1");
  assert.ok(p, "the truncated project survives rehydration instead of bricking the store");
  assert.equal(p.phases.length, 13, "missing phase records are re-inserted");
  assert.equal(typeof p.brief, "string", "brief survives");
  assert.ok(p.name.length > 0, "a present name survives");
  assert.ok(p.packet.length > 0, "packet recompiles on the repaired state");
  const res = useRapid.getState().execute("trunc-1");
  assert.equal(res.ok, true, "the repaired project is runnable from its fresh edge");
  assert.equal(current("trunc-1").currentPhase, 1, "P0 ran and the edge advanced");
});

test("CORE sweep: junk artifact rows in persisted state are dropped on hydrate, never crash a run", () => {
  const base = seedProject();
  const valid = {
    id: "a-1",
    phase: 0,
    kind: "docs" as const,
    title: "Real row",
    body: "body",
  };
  const withJunk = {
    ...base,
    artifacts: [null, 42, valid, ...base.artifacts] as unknown as typeof base.artifacts,
  };
  useRapid.setState({ projects: [withJunk], activeId: withJunk.id, hydrated: true, autopilot: false });
  useRapid.getState().seedIfEmpty(); // store rehydration pass → hydrateProject
  const stored = current(withJunk.id);
  assert.equal(stored.artifacts.length, 1, "junk rows dropped, the well-formed row survives");
  assert.equal(stored.artifacts[0].id, "a-1");
  assert.equal(useRapid.getState().execute(withJunk.id).ok, true, "execute survives the repaired state");
});

// ---------------------------------------------------------------------------
// H-02/H-03 (fixes/115): dedupeMemoryIds suffix-collision + research/implSpec
// hydrate normalization (a corrupt research value must never wipe the store).
// ---------------------------------------------------------------------------

function mem(id: string, rank = 1) {
  return { id, rank, phase: 0 as PhaseId, score: rank, kind: "semantic" as const, text: `row ${id}`, tags: [], ts: 1 };
}

test("H-02 M1/M2: dedupeMemoryIds mints globally-unique ids even with prior-pass suffixes", () => {
  const m = mem;
  const out1 = dedupeMemoryIds([m("X"), m("X"), m("X-2"), m("X")]);
  const ids1 = out1.map((r) => r.id);
  assert.equal(new Set(ids1).size, ids1.length, `no duplicates: ${ids1.join(",")}`);
  const out2 = dedupeMemoryIds([m("X"), m("X"), m("X"), m("X-2")]);
  const ids2 = out2.map((r) => r.id);
  assert.equal(new Set(ids2).size, ids2.length, `no duplicates: ${ids2.join(",")}`);
});

test("H-02 M3: dedupeMemoryIds is idempotent on its own output", () => {
  const m = mem;
  const once = dedupeMemoryIds([m("X"), m("X"), m("X-2"), m("X"), m("Y"), m("Y")]);
  const twice = dedupeMemoryIds(once);
  assert.deepEqual(twice.map((r) => r.id), once.map((r) => r.id), "re-running is a no-op");
});

test("H-03 P2/P4: hydrateProject normalizes a corrupt research/implementationSpec value loudly", () => {
  for (const bad of [5, {}, "str", { 0: "x" }]) {
    const p = hydrateProject({ ...seedProject(), research: bad as never });
    assert.ok(Array.isArray(p.research), "research coerced to an array");
    assert.equal(p.research.length, 0, "corrupt research dropped to []");
    const repaired = p.logs.some((l) => l.detail.includes("research:dropped"));
    assert.ok(repaired, "the drop is LOUD (hydrate.repaired row)");
    assert.equal(typeof p.packet, "string", "packet recompiles without throwing");
  }
  const p2 = hydrateProject({ ...seedProject(), implementationSpec: 42 as never });
  assert.equal(p2.implementationSpec, null, "non-object implementationSpec coerced to null");
});

// ---------------------------------------------------------------------------
// S2 backend sweep (fixes/72_sweep_backend.md): the P10/P13 store actions +
// ingest envelope honesty. These actions had ZERO suite coverage before the
// sweep — the pillar wave landed the bodies but ran out of iterations before
// the tests. Probed live first (probe-s2-store.ts), then pinned here.
// ---------------------------------------------------------------------------

test("S2: setWildMode flips wildMode on and off; off nulls an active run", () => {
  const p = install(seedProject());
  useRapid.getState().setWildMode(p.id, true);
  assert.equal(current(p.id).wildMode, true);
  useRapid.getState().setWildMode(p.id, false);
  assert.equal(current(p.id).wildMode, false, "off == explicit false (emptyProject default)");
  // Turning the mode OFF while a run exists nulls it (no zombie runs).
  useRapid.getState().setWildMode(p.id, true);
  useRapid.setState((s) => ({
    projects: s.projects.map((x) =>
      x.id === p.id
        ? { ...x, wildRun: { active: true, phase: 0, startedAt: 1, lastAutoLog: "", lastAutoAt: 1, stoppedAt: null, pause: false } }
        : x,
    ),
  }));
  useRapid.getState().setWildMode(p.id, false);
  assert.equal(current(p.id).wildRun, null);
});

test("S2: setEnforceDod flips enforceDod on and off", () => {
  const p = install(seedProject());
  useRapid.getState().setEnforceDod(p.id, true);
  assert.equal(current(p.id).enforceDod, true);
  useRapid.getState().setEnforceDod(p.id, false);
  assert.equal(current(p.id).enforceDod, false, "off == explicit false (emptyProject default)");
});

test("S2: startWildRun refuses honestly when wildMode is off (code + error, zero state change)", async () => {
  const p = install(seedProject());
  const res = await useRapid.getState().startWildRun(p.id);
  assert.equal(res.ok, false);
  assert.equal(res.code, "RT_E_PHASE_ILLEGAL");
  assert.ok(typeof res.error === "string" && res.error.length > 0);
  assert.equal(res.ran, 0);
  assert.equal(current(p.id).wildRun ?? null, null, "no run was stamped");
});

test("S2: startWildRun drives deterministically and parks honestly when the classifier is unconfigured", async () => {
  // Determinism: the Auto-Review classifier reads DEEPSEEK_API_KEY — blank it
  // for the test so the run parks at the first approval gate instead of
  // making real LLM calls.
  const savedKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "";
  try {
    const p = install(seedProject());
    useRapid.getState().setWildMode(p.id, true);
    const res = await useRapid.getState().startWildRun(p.id);
    assert.equal(res.ok, true);
    assert.equal(res.stoppedReason, "paused", "first stock gate (P4) parks the run");
    // 185-H1/F3-06 (store.ts:72-77): ok:true NEVER carries `code` — the pause
    // class rides as `note` (the ok-pause return at store.ts:1186 spreads
    // `...(res.code ? { note: res.code } : {})`). Pin the doctrine's field:
    assert.equal((res as { note?: string }).note, "RT_E_LLM_NOT_CONFIGURED", "honest pause class surfaces");
    assert.equal((res as { code?: string }).code, undefined, "ok:true never dual-channels a code (185-H1/F3-06)");
    const after = current(p.id);
    assert.equal(after.wildRun?.active, true, "paused runs stay active (resumable)");
    assert.equal(after.wildRun?.pause, true);
    assert.equal(after.status, "awaiting_hitl");
    assert.equal(after.currentPhase, 4);
    assert.ok(after.logs.some((l) => l.event === "wild.start"), "wild.start ledgered");
    assert.ok(after.logs.some((l) => l.event === "wild.paused_classifier"), "pause reason ledgered");
    assert.ok(after.logs.some((l) => l.event === "wild.exec"), "deterministic floor executions ledgered");
  } finally {
    process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

test("S2: a second startWildRun while one is ACTIVE+UNPAUSED is refused with a code", async () => {
  const p = install(seedProject());
  useRapid.getState().setWildMode(p.id, true);
  useRapid.setState((s) => ({
    projects: s.projects.map((x) =>
      x.id === p.id
        ? {
            ...x,
            wildRun: {
              active: true,
              phase: 0,
              startedAt: Date.now(),
              lastAutoLog: "",
              lastAutoAt: Date.now(),
              stoppedAt: null,
              pause: false,
            },
          }
        : x,
    ),
  }));
  const second = await useRapid.getState().startWildRun(p.id);
  assert.equal(second.ok, false);
  assert.equal(second.code, "RT_E_PHASE_ILLEGAL");
});

test("S2: startWildRun on a PAUSED active run resumes it (PA-01 resume path)", async () => {
  const savedKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "";
  try {
    const p = install(seedProject());
    useRapid.getState().setWildMode(p.id, true);
    const first = await useRapid.getState().startWildRun(p.id);
    assert.equal(first.ok, true);
    // The unconfigured driver parks the run paused — the second start is the
    // PA-01 resume path, not a double-start refusal.
    const resumed = await useRapid.getState().startWildRun(p.id);
    assert.equal(resumed.ok, true, "paused run resumes instead of refusing");
  } finally {
    process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

test("S2: toggleWildPause resumes and re-pauses an active run; stopWildRun deactivates + stamps stoppedAt", () => {
  const p = install(seedProject());
  useRapid.getState().setWildMode(p.id, true);
  // A run parked in the paused state (as the unconfigured driver parks it).
  useRapid.setState((s) => ({
    projects: s.projects.map((x) =>
      x.id === p.id
        ? {
            ...x,
            wildRun: { active: true, phase: 4, startedAt: 1, lastAutoLog: "", lastAutoAt: 1, stoppedAt: null, pause: true },
            status: "awaiting_hitl",
          }
        : x,
    ),
  }));
  useRapid.getState().toggleWildPause(p.id);
  const resumed = current(p.id).wildRun!;
  assert.equal(resumed.active, true);
  assert.equal(resumed.pause, false, "one toggle resumes a paused run");
  useRapid.getState().toggleWildPause(p.id);
  assert.equal(current(p.id).wildRun!.pause, true, "second toggle re-pauses");
  useRapid.getState().stopWildRun(p.id);
  const stopped = current(p.id).wildRun!;
  assert.equal(stopped.active, false);
  assert.equal(stopped.pause, false, "stop clears the pause flag too");
  assert.equal(typeof stopped.stoppedAt, "number");
});

test("312 D2 (M4-06/B-01): operator toggle stamps an uncoded park on pause, clears it on resume; stop never leaks it", () => {
  const p = install(seedProject());
  useRapid.getState().setWildMode(p.id, true);
  // A run paused the way the driver parks it — the operator park record riding
  // the pause (uncoded {code:null, unlock:"resume"} — the wildOperatorPark shape).
  const rider: WildParkInfo = {
    code: null,
    event: null,
    reason: "Wild run paused from the console.",
    unlock: "resume",
    unlockText: "Resume the run to retry the step.",
    resumePhase: 4,
    resumeAction: "execute",
    at: 1,
  };
  useRapid.setState((s) => ({
    projects: s.projects.map((x) =>
      x.id === p.id
        ? {
            ...x,
            wildRun: {
              active: true,
              phase: 4,
              startedAt: 1,
              lastAutoLog: "",
              lastAutoAt: 1,
              stoppedAt: null,
              pause: true,
              park: rider,
            },
            status: "awaiting_hitl",
          }
        : x,
    ),
  }));

  // Resume: park is present iff pause — the toggle must CLEAR the record.
  useRapid.getState().toggleWildPause(p.id);
  const resumed = current(p.id).wildRun!;
  assert.equal(resumed.pause, false, "one toggle resumes a paused run");
  assert.equal(resumed.park ?? null, null, "resume clears the park (present iff pause)");

  // Re-pause: the operator toggle stamps its own uncoded record (M4-06).
  useRapid.getState().toggleWildPause(p.id);
  const repaused = current(p.id).wildRun!;
  assert.equal(repaused.pause, true, "second toggle re-pauses");
  assert.ok(repaused.park, "an operator pause stamps a park record");
  assert.equal(repaused.park!.code, null, "operator pauses are uncoded");
  assert.equal(repaused.park!.unlock, "resume", "what unlocks an operator pause is a plain resume");
  assert.equal(typeof repaused.park!.at, "number");

  // Stop: the park must not ride the spread onto a stopped run (the C2 gap class).
  useRapid.getState().stopWildRun(p.id);
  const stopped = current(p.id).wildRun!;
  assert.equal(stopped.active, false);
  assert.equal(stopped.pause, false, "stop clears the pause flag too");
  assert.equal(stopped.park ?? null, null, "stop clears the park");
  assert.equal(typeof stopped.stoppedAt, "number");
});

test("S2: enforceDod blocks leaving a DoD-failing phase (artifact + dod.blocked log + cursor stays)", () => {
  const p = install(seedProject());
  useRapid.getState().setEnforceDod(p.id, true);
  assert.equal(useRapid.getState().execute(p.id).ok, true, "P0 passes its own gate and advances");
  assert.equal(current(p.id).currentPhase, 1);
  // Sabotage: mark P1 complete WITHOUT its graph artifact, so leaving P1
  // fails the p1-graph probe.
  useRapid.setState((s) => ({
    projects: s.projects.map((x) =>
      x.id === p.id
        ? {
            ...x,
            phases: x.phases.map((ph) => (ph.id === 1 ? { ...ph, status: "complete" as const, startedAt: Date.now() } : ph)),
          }
        : x,
    ),
  }));
  const res = useRapid.getState().execute(p.id);
  assert.equal(res.ok, false);
  assert.ok(/DoD unmet/.test(res.error ?? ""), "honest error text names the hard block");
  const after = current(p.id);
  assert.equal(after.currentPhase, 1, "cursor did not move");
  assert.ok(
    after.artifacts.some((a) => a.kind === "docs" && a.title.startsWith("Hard DoD block")),
    "block artifact landed",
  );
  assert.ok(after.logs.some((l) => l.event === "dod.blocked"), "dod.blocked log landed");
  const run = useRapid.getState().runUntilHitl(p.id);
  assert.equal(run.ok, false);
  assert.equal(run.stoppedReason, "dod", "runUntilHitl reports the hard-DoD stop reason");
});

test("S2: runModuleReal without a generated module fails honestly (no throw, error text)", async () => {
  const p = install(seedProject());
  const res = await useRapid.getState().runModuleReal(p.id);
  assert.equal(res.ok, false);
  assert.ok(typeof res.error === "string" && res.error.length > 0);
  // Idempotent-honest on repeat: same shape, never throws.
  const again = await useRapid.getState().runModuleReal(p.id);
  assert.equal(again.ok, false);
});

test("S2: remove archives a project and clears a stale activeId", () => {
  const a = install(seedProject());
  const b = useRapid.getState().create(BRIEF, "Second");
  assert.equal(useRapid.getState().hasProject(a.id), true);
  useRapid.getState().remove(a.id);
  assert.equal(useRapid.getState().hasProject(a.id), false);
  assert.equal(useRapid.getState().activeId, b, "activeId untouched when it pointed elsewhere");
  useRapid.getState().select(b);
  useRapid.getState().remove(b);
  assert.equal(useRapid.getState().activeId, null, "removing the active project clears the pointer");
});

test("W-18 (fixes/274 · WDX-3 · §W27-B · A1-f09/R8-f04): a keyed status probe threads enforceDod into create", () => {
  // The console's honest view of the SERVER's key is llmStatus.configured; on a
  // keyed server the keyed default (hard-DoD ON) must reach console-created
  // projects. Not-configured (or probe not run) leaves the engine default in
  // place — the keyless path stays advisory, byte-for-byte.
  const prev = useRapid.getState().llmStatus;
  const savedKey = process.env.DEEPSEEK_API_KEY;
  try {
    delete process.env.DEEPSEEK_API_KEY;
    useRapid.setState({ llmStatus: { configured: true, label: "deepseek · configured" } });
    const keyedId = useRapid.getState().create("A brief for the keyed wire.", "KeyedWire");
    assert.equal(
      current(keyedId).enforceDod,
      true,
      "keyed probe ⇒ console-created project joins the keyed default",
    );

    useRapid.setState({ llmStatus: { configured: false, label: "deterministic engine" } });
    const keylessId = useRapid.getState().create("A brief for the keyless wire.", "KeylessWire");
    assert.equal(
      current(keylessId).enforceDod,
      false,
      "no configured probe ⇒ the engine's keyless default stands",
    );
  } finally {
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = savedKey;
    useRapid.setState({ llmStatus: prev });
  }
});

test("S2: ingestReport surfaces applied/reason/gate_unmet (E-09 envelope honesty)", () => {
  const p = install(seedProject());
  useRapid.getState().execute(p.id); // P0 → P1
  const report = {
    phase: 1,
    status: "complete" as const,
    summary: "Topology planned with evidence".padEnd(28, "."),
    artifacts: [{ title: "Topo", body: "nodes and edges" }],
  };
  const first = useRapid.getState().ingestReport(p.id, report);
  assert.equal(first.ok, true);
  assert.equal(first.applied, true, "first apply lands");
  assert.equal(first.reason, "new");
  const second = useRapid.getState().ingestReport(p.id, report);
  assert.equal(second.ok, true, "a duplicate retry is success, not an error");
  assert.equal(second.applied, false, "duplicate is reported honestly");
  assert.equal(second.reason, "duplicate");
  assert.equal(
    current(p.id).artifacts.filter((a) => a.id.startsWith("report-")).length,
    1,
    "no fork on re-apply",
  );
  // gate_unmet: strip P1's graph artifact, then a complete claim on P1 must
  // surface the unmet DoD ids.
  useRapid.setState((s) => ({
    projects: s.projects.map((x) =>
      x.id === p.id ? { ...x, artifacts: x.artifacts.filter((a) => !(a.phase === 1 && a.kind === "graph")) } : x,
    ),
  }));
  const unmet = useRapid.getState().ingestReport(p.id, {
    phase: 1,
    status: "complete",
    summary: "Second complete claim, no graph artifact".padEnd(28, "."),
  });
  assert.equal(unmet.ok, true);
  assert.ok(Array.isArray(unmet.gate_unmet) && unmet.gate_unmet.includes("p1-graph"), "unmet DoD ids surface");
  const wrongPhase = useRapid.getState().ingestReport(p.id, { phase: 9, status: "complete", summary: "Wrong edge." });
  assert.equal(wrongPhase.ok, false, "wrong-phase report refuses");
  assert.ok(typeof wrongPhase.error === "string" && wrongPhase.error.length > 0);
});

// ---------------------------------------------------------------------------
// H4 (107) — hang/failure hardening: corrupt-state recovery + quota-safe writes
// ---------------------------------------------------------------------------

/** Storage that rejects writes above a byte budget (quota simulation). */
class BudgetStorage extends MemoryStorage {
  private budget: number;
  constructor(budget: number) {
    super();
    this.budget = budget;
  }
  override setItem(k: string, v: string): void {
    if (String(v).length > this.budget) {
      throw new Error(`QuotaExceededError: ${String(v).length} bytes > ${this.budget} budget`);
    }
    super.setItem(k, String(v));
  }
}

const storageGlobal = (): Storage => (globalThis as unknown as { localStorage: Storage }).localStorage;

test("H4: VALID-JSON junk state (projects not an array) recovers instead of crashing hydration", async () => {
  useRapid.setState({ projects: [], activeId: null, hydrated: false, autopilot: false, demoSeeded: false });
  // Valid JSON, corrupt SHAPE — the old success path crashed seedIfEmpty's
  // .map(hydrateProject) here (projects is a string, not an array), throwing
  // out of the hydration callback and stranding `hydrated` false forever.
  localStorage.setItem(
    "rapidtool.v4",
    JSON.stringify({ state: { projects: "garbage", activeId: "x", autopilot: true, demoSeeded: true }, version: 0 }),
  );
  await useRapid.persist.rehydrate(); // must resolve, never reject/throw
  const st = useRapid.getState();
  assert.equal(st.hydrated, true, "hydrated flips true even for junk-SHAPE state");
  assert.ok(Array.isArray(st.projects), "projects recovered to an array");
  assert.equal(st.projects.length, 1, "demo seed ran after the junk-state drop (even with demoSeeded persisted true)");
  assert.equal(st.activeId, st.projects[0].id);
  const healed = localStorage.getItem("rapidtool.v4") ?? "";
  assert.doesNotThrow(() => JSON.parse(healed), "the junk blob is overwritten with valid JSON");
  const parsed = JSON.parse(healed) as { state?: { projects?: unknown[]; demoSeeded?: boolean } };
  assert.equal(parsed.state?.projects?.length, 1);
});

test("H4: junk project ENTRIES are dropped before repair — rehydration cannot crash", async () => {
  const good = emptyProject({ name: "Good Build", brief: BRIEF });
  const blob = JSON.stringify({
    state: {
      // null / string / phases-as-object entries would each crash the old
      // hydrateProject map (null deref / for..of over a non-iterable).
      projects: [null, "oops", { id: "bad", phases: { 0: "x" } }, good],
      activeId: null,
      autopilot: false,
      demoSeeded: true,
    },
    version: 0,
  });
  useRapid.setState({ projects: [], activeId: null, hydrated: false, demoSeeded: true });
  localStorage.setItem("rapidtool.v4", blob);
  await useRapid.persist.rehydrate();
  const st = useRapid.getState();
  assert.equal(st.hydrated, true);
  const ids = st.projects.map((p) => p.id);
  assert.deepEqual(ids, [good.id], "junk entries dropped; the well-formed entry is kept");
  assert.ok(st.projects[0].phases.length === 13, "kept entry is fully repaired");
});

test("H4: quota errors never throw through a store action; health surfaces the failure", async () => {
  const real = storageGlobal();
  const failing = new BudgetStorage(1); // rejects every write
  (globalThis as unknown as { localStorage: Storage }).localStorage = failing;
  try {
    const p = install(seedProject());
    // The persist write inside this action hits the quota — the action must
    // still succeed (old code: the throw escaped set() into the caller).
    assert.doesNotThrow(() => useRapid.getState().rename(p.id, "Renamed under quota"));
    assert.equal(current(p.id).name, "Renamed under quota", "in-memory state stays authoritative");
    const health = persistStorageHealth();
    assert.equal(health.ok, false, "a fully-failed write is surfaced");
    assert.match(health.lastError ?? "", /QuotaExceededError/);
  } finally {
    (globalThis as unknown as { localStorage: Storage }).localStorage = real;
  }
});

test("H4: quota salvage retries with engine-capped history so a valid snapshot still persists", async () => {
  const real = storageGlobal();
  const p = install(seedProject());
  // Over-cap logs + chat rows (engine caps: 200 logs / 40 chat rows).
  const logs = Array.from({ length: 400 }, (_, i) => ({
    ts: i,
    phase: 0 as const,
    level: "info" as const,
    event: "log",
    detail: `row ${i}`,
  }));
  const chat: ChatLogRow[] = Array.from({ length: 100 }, (_, i) => ({
    role: "user" as const,
    text: `msg ${i}`,
    ts: 1_000 + i,
  }));
  useRapid.setState((s) => ({
    projects: s.projects.map((x) => (x.id === p.id ? { ...x, logs, chatLog: chat } : x)),
  }));
  const fullBlob = localStorage.getItem("rapidtool.v4") ?? "";
  assert.ok(fullBlob.length > 0);
  // Budget: the FULL write (400 logs + 100 chat) must fail, the salvage write
  // (≤200 logs + ≤40 chat ≈ 6 KB lighter) must fit.
  const failing = new BudgetStorage(fullBlob.length - 3000);
  (globalThis as unknown as { localStorage: Storage }).localStorage = failing;
  try {
    assert.doesNotThrow(() => useRapid.getState().rename(p.id, "Salvaged rename"));
    assert.equal(current(p.id).name, "Salvaged rename", "in-memory state unchanged");
    const saved = failing.getItem("rapidtool.v4") ?? "";
    assert.ok(saved.length > 0, "the salvage write landed a snapshot");
    const parsed = JSON.parse(saved) as {
      state?: { projects?: { logs?: unknown[]; chatLog?: unknown[]; name?: string }[] };
    };
    assert.equal(parsed.state?.projects?.[0]?.name, "Salvaged rename");
    assert.ok(
      (parsed.state?.projects?.[0]?.logs?.length ?? 999) <= 200,
      `salvaged logs capped at 200 (got ${parsed.state?.projects?.[0]?.logs?.length})`,
    );
    assert.ok(
      (parsed.state?.projects?.[0]?.chatLog?.length ?? 999) <= 40,
      `salvaged chatLog capped at 40 (got ${parsed.state?.projects?.[0]?.chatLog?.length})`,
    );
    const health = persistStorageHealth();
    assert.equal(health.ok, true, "a successful salvage counts as persisted");
  } finally {
    (globalThis as unknown as { localStorage: Storage }).localStorage = real;
  }
});

// ---------------------------------------------------------------------------
// fixes/115 H-01 + H-06 — rebaseUserFields whitelist gap + wild-driver
// commitWild clobbering concurrent writers (store lane, executor F-H1)
// ---------------------------------------------------------------------------

/** A minimal valid implementationSpec (the E-30 prompt-verb shape). */
function seededImplementationSpec(): NonNullable<Project["implementationSpec"]> {
  return {
    requirements: ["req-a"],
    edgeCases: [],
    errorHandling: [],
    typeSignatures: [],
    dataFlow: [],
    negativeConstraints: [],
    source: "prompt-verb",
    briefHash: "h-01-test",
    createdAt: 1,
  };
}

test("H-01 R1: executeAsync keeps chat rows appended mid-run AND a pre-existing implementationSpec (rebaseUserFields whitelist)", async () => {
  const before: ChatLogRow[] = [
    { role: "user", text: "hello before the run", ts: 1 },
    { role: "assistant", text: "context reply", ts: 2 },
  ];
  const midRun: ChatLogRow = { role: "user", text: "hello DURING the async run", ts: 3 };
  const spec = seededImplementationSpec();
  const p = install(seedProject({ chatLog: before, implementationSpec: spec }));
  // executeAsync captures its pre-run snapshot on a microtask; the mid-run row
  // is appended (queueMicrotask) after that snapshot but before the run's
  // whole-project commit — the exact interleave that used to drop it.
  const run = useRapid.getState().executeAsync(p.id);
  queueMicrotask(() => useRapid.getState().appendChatRows(p.id, [midRun]));
  const res = await run;
  assert.equal(res.ok, true);
  const after = current(p.id);
  const texts = (after.chatLog ?? []).map((r) => r.text);
  assert.ok(
    texts.includes("hello before the run"),
    "pre-existing chat rows must survive the async commit",
  );
  assert.ok(
    texts.includes("hello DURING the async run"),
    "a chat row appended WHILE the async run was in flight must survive its commit (H-01)",
  );
  assert.deepEqual(
    after.implementationSpec,
    spec,
    "a pre-existing implementationSpec rides the run's committed spread untouched",
  );
});

test("H-01 R2: runUntilHitlAsync preserves chat rows appended mid-run through the multi-step commit", async () => {
  const p = install(seedProject());
  const row: ChatLogRow = { role: "user", text: "kept across the whole run", ts: 1 };
  const run = useRapid.getState().runUntilHitlAsync(p.id);
  queueMicrotask(() => useRapid.getState().appendChatRows(p.id, [row]));
  const res = await run;
  assert.equal(res.ok, true);
  const after = current(p.id);
  assert.equal(after.currentPhase, 4, "the run still parks at the first stock gate");
  assert.ok(
    (after.chatLog ?? []).some((r) => r.text === "kept across the whole run"),
    "chat appended mid-runUntilHitl must survive the run's single whole-project commit (H-01)",
  );
});

test("H-01 R3: chatLog stays capped at 40 rows after the rebase (50 appended mid-run → 40 kept)", async () => {
  const p = install(seedProject());
  const fifty: ChatLogRow[] = Array.from({ length: 50 }, (_, i) => ({
    role: "user" as const,
    text: `mid-run message ${i}`,
    ts: 1_000 + i,
  }));
  const run = useRapid.getState().runUntilHitlAsync(p.id);
  queueMicrotask(() => useRapid.getState().appendChatRows(p.id, fifty));
  const res = await run;
  assert.equal(res.ok, true);
  const chat = current(p.id).chatLog ?? [];
  assert.equal(chat.length, 40, "appendChatRows caps at 40 and the rebase must not resurrect dropped rows");
  assert.equal(
    chat[chat.length - 1].text,
    "mid-run message 49",
    "the newest row survives the cap + rebase",
  );
});

test("H-06 C1: a concurrent ingestReport survives every commitWild of a wild run (union-merge, no duplicates)", async () => {
  const savedKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "";
  try {
    const p = install(seedProject());
    useRapid.getState().setWildMode(p.id, true);
    // The driver commits commitWild(withStartLog) synchronously, then suspends
    // at its first `await wildStep` — ingestReport lands in exactly that gap,
    // i.e. between two commitWilds (the H-06 race window).
    const run = useRapid.getState().startWildRun(p.id);
    const ingest = useRapid.getState().ingestReport(p.id, {
      phase: 0,
      status: "complete",
      summary: "P0 intake delivered mid wild run".padEnd(28, "."),
      artifacts: [{ title: "Mid-flight intake", body: "external agent report" }],
    });
    assert.equal(ingest.ok, true);
    assert.equal(ingest.applied, true, "the ingest is applied while the run is suspended");
    const res = await run;
    assert.equal(res.ok, true);
    const after = current(p.id);
    assert.equal(
      after.artifacts.filter((a) => a.id.startsWith("report-0-0-")).length,
      1,
      "the ingest artifact must survive every commitWild the run makes after it landed",
    );
    assert.equal(
      after.artifacts.filter((a) => a.id.startsWith("report-")).length,
      1,
      "union-merge must not duplicate the ingest artifact across subsequent commits",
    );
    assert.ok(
      after.logs.some((l) => l.event === "agent.report"),
      "the ingest's agent.report log must survive the run",
    );
    assert.ok(
      after.logs.some((l) => l.event === "wild.exec"),
      "the wild steps' OWN ledger rows are present too — the merge never drops the run's output",
    );
    assert.equal(after.currentPhase, 4, "the run itself still progressed to the first stock gate");
  } finally {
    process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

test("H-06 C2: a concurrent human approve is not rolled back — its decision-journal entry survives the next commitWild", async () => {
  const savedKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "";
  try {
    const p = install(seedProject());
    useRapid.getState().setWildMode(p.id, true);
    // First run: the deterministic floor parks PAUSED at the P4 stock gate
    // (driver exited; wildRun.active + pause stay true = the PA-01 resume path).
    const first = await useRapid.getState().startWildRun(p.id);
    assert.equal(first.ok, true);
    assert.equal(first.stoppedReason, "paused");
    assert.equal(current(p.id).currentPhase, 4);
    assert.equal(current(p.id).hitl?.phase, 4, "parked at the P4 gate with an open approval request");
    // Resume: the driver re-enters the loop from its OWN snapshot of the open
    // P4 gate and suspends at the first wildStep await (classifier review) —
    // the resumed startWildRun call returns at that suspension point.
    const resumed = useRapid.getState().startWildRun(p.id);
    // The human approval lands while the resumed loop is in flight: it is a
    // sync action, so it commits NOW, before the driver's classifier-pause
    // commitWild writes its stale snapshot over the live record.
    const approval = useRapid.getState().approve(p.id);
    assert.equal(approval.ok, true, "the open P4 gate is approvable while the run is suspended");
    const res = await resumed;
    assert.equal(res.ok, true);
    const after = current(p.id);
    assert.equal(
      after.decisions.filter((d) => d.phase === 4 && d.decision === "approve" && d.decidedBy === "human").length,
      1,
      "the concurrent human approval's decision-journal entry must survive the driver's next commitWild (H-06)",
    );
  } finally {
    process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

// ---------------------------------------------------------------------------
// F3-10 W42 L2-P7 (A-5 residual) — the keepLiveWildRun + rebaseUserFields pin.
// Every NON-driver whole-project commit wraps its result in
// `keepLiveWildRun(rebaseUserFields(next.project, live), live)` (helpers
// store.ts:268/:299; here the executeAsync success commit :1425-1429 and its
// denial-log twin :1407-1413, F3-10 fixes/293 M2): operator-owned fields
// (name/notes/createdAt/enforceDod/wildMode/chatLog/kind) rebase from the LIVE
// record and an ACTIVE live wild run is re-attached — while the step's own
// engine-owned progress still lands.
// Adjacent finding (recorded, NOT fixed here — W43-ENGINE material): after the
// rebase the notes FIELD is fresh but the compiled packet is NOT re-stamped, so
// the persisted packet serves the snapshot's pre-edit notes until the next
// stamp. Probe + smallest-fix sketch: fixes/305_e2_packet.md §Findings.
// ---------------------------------------------------------------------------

/** The live-run marker the guard must re-attach — distinct values so any
 *  snapshot-clobber shows up as a mismatch (identity checked by value). */
function liveWildRunMarker(): NonNullable<Project["wildRun"]> {
  return {
    active: true,
    phase: 2,
    startedAt: 424_242,
    lastAutoLog: "",
    lastAutoAt: 7,
    stoppedAt: null,
    pause: false,
  };
}

test("F3-10 P-7a: a wild run started MID-FLIGHT + operator edits survive executeAsync's stale success commit (:1425-1429)", async () => {
  const p = install(seedProject());
  const marker = liveWildRunMarker();
  const before = current(p.id);
  const run = useRapid.getState().executeAsync(p.id);
  // The commit is computed from executeAsync's ENTRY snapshot; this callback
  // lands in the gap after that snapshot but before the whole-project commit
  // (the same interleave H-01 R1 pins) — a run that starts + notes that are
  // typed WHILE the snapshot is still in flight.
  queueMicrotask(() => {
    useRapid.getState().setNotes(p.id, "steer the crew mid-flight");
    useRapid.getState().rename(p.id, "Renamed mid-flight");
    useRapid.setState((s) => ({
      projects: s.projects.map((x) => (x.id === p.id ? { ...x, wildRun: marker } : x)),
    }));
  });
  const res = await run;
  assert.equal(res.ok, true);
  const after = current(p.id);
  // The step's own (engine-owned) commit still landed — the guard merges; it
  // never blocks the commit.
  assert.ok(
    after.currentPhase > before.currentPhase,
    `the executeAsync step still progressed (P${before.currentPhase} -> P${after.currentPhase})`,
  );
  // ...but the ACTIVE live wild run was re-attached, not clobbered by the
  // snapshot's null wildRun (the F3-10/174-1 guard, store.ts:299).
  assert.deepEqual(
    after.wildRun,
    marker,
    "a wild run started mid-flight survives the stale commit (keepLiveWildRun :299)",
  );
  // Operator-owned fields rebase from the LIVE record (store.ts:268).
  assert.equal(after.notes, "steer the crew mid-flight", "notes typed mid-flight are operator-owned — live wins");
  assert.equal(after.name, "Renamed mid-flight", "a rename mid-flight rides the same rebase");
});

test("F3-10 P-7b: the executeAsync DoD-denial commit (:1407-1413, fixes/293 M2) keeps the live wild run + operator edits", async () => {
  const p = install(seedProject());
  useRapid.getState().setEnforceDod(p.id, true);
  assert.equal(useRapid.getState().execute(p.id).ok, true, "P0 passes its own gate and advances");
  assert.equal(current(p.id).currentPhase, 1);
  // Sabotage (the S2 recipe, store.test.ts:1061-1091): mark P1 complete
  // WITHOUT its graph artifact, so leaving P1 fails the p1-graph probe and the
  // DENIAL branch fires for real.
  useRapid.setState((s) => ({
    projects: s.projects.map((x) =>
      x.id === p.id
        ? {
            ...x,
            phases: x.phases.map((ph) =>
              ph.id === 1 ? { ...ph, status: "complete" as const, startedAt: Date.now() } : ph,
            ),
          }
        : x,
    ),
  }));
  const marker = liveWildRunMarker();
  const run = useRapid.getState().executeAsync(p.id);
  queueMicrotask(() => {
    useRapid.getState().setNotes(p.id, "operator steering while the denial commits");
    useRapid.setState((s) => ({
      projects: s.projects.map((x) => (x.id === p.id ? { ...x, wildRun: marker } : x)),
    }));
  });
  const res = await run;
  assert.equal(res.ok, false, "a hard-DoD block stays a 0-progress stop");
  assert.ok(/DoD unmet/.test(res.error ?? ""), "honest error text names the block");
  const after = current(p.id);
  assert.equal(after.currentPhase, 1, "the cursor does not move");
  // The denial commit itself DID run: its artifact + dod.blocked log landed.
  assert.ok(
    after.artifacts.some((a) => a.kind === "docs" && a.title.startsWith("Hard DoD block")),
    "the denial-log commit's block artifact landed (the :1407-1413 branch executed)",
  );
  assert.ok(after.logs.some((l) => l.event === "dod.blocked"), "dod.blocked log landed");
  // ...and it merged over the LIVE record instead of clobbering it (F3-10 fixes/293 M2).
  assert.deepEqual(after.wildRun, marker, "keepLiveWildRun re-attaches the live run on the denial twin too");
  assert.equal(after.notes, "operator steering while the denial commits", "notes rebase on the denial twin");
});

test("P8: setNotes/ingestReport re-stamp the persisted packet (F2-03b) — fresh content rides, repeats never accumulate", () => {
  const p = install(seedProject());
  assert.ok(!current(p.id).packet.includes("steer the crew mid-flight"), "baseline packet carries no notes text");
  useRapid.getState().setNotes(p.id, "steer the crew mid-flight");
  const a = current(p.id);
  assert.equal(a.notes, "steer the crew mid-flight");
  assert.ok(
    a.packet.includes("steer the crew mid-flight"),
    "setNotes re-stamps the packet — a notes write never leaves the persisted packet pre-edit (F2-03b)",
  );
  assert.ok(a.packet.includes("## Operator notes (human steering)"), "the compiled notes block rides the packet");
  assert.equal(a.artifacts.filter((x) => x.kind === "packet").length, 1, "the stamp replaces the packet artifact");
  useRapid.getState().setNotes(p.id, "steer the crew mid-flight, again");
  assert.equal(
    current(p.id).artifacts.filter((x) => x.kind === "packet").length,
    1,
    "repeated notes writes cannot accumulate packet artifacts (sealPacketArtifact replaces)",
  );
  const res = useRapid.getState().ingestReport(p.id, {
    phase: 0,
    status: "complete",
    summary: "late intake report from an external agent",
    artifacts: [{ title: "Late intake artifact", body: "external body" }],
  });
  assert.equal(res.ok, true);
  const c = current(p.id);
  assert.ok(c.artifacts.some((x) => x.id.startsWith("report-0-0-")), "the ingest artifact applied");
  assert.ok(
    c.packet.includes("Late intake artifact"),
    "ingestReport re-stamps the packet — the report rides the compiled packet (F2-03b)",
  );
});

// ---------------------------------------------------------------------------
// fixes/144 M1 · lane L4 — store-side regression pins for the L3 console seams
// (144_completion_plan.md M1 steps 4-5 + fixes/143_g3_continuation.md §2):
//   (A) wild-resume = driver RE-ENTRY (PA-01), never a driverless flag flip —
//       startWildRun on a paused active run stamps active+unpaused, ledgeres
//       wild.resume, and takes >= 1 more step (the g3 UI-Resume defect);
//   (B) reload honesty: hydration force-stops a paused persisted run, so the
//       run is honestly not-active afterwards and startWildRun is a FRESH run
//       (new epoch), never a silent resume of the dead session (g3 §2);
//   (C) setEnforceDod is per-project — the console Settings toggle must not
//       leak across builds (M1 step 4 wiring).
// ---------------------------------------------------------------------------

test("144 L4: startWildRun on a paused run re-enters the DRIVER (active+unpaused stamp, wild.resume log, >=1 more step)", async () => {
  const savedKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "";
  try {
    const p = install(seedProject());
    useRapid.getState().setWildMode(p.id, true);
    // A running wild run parked the way the keyless driver parks it: PAUSED at
    // the first stock gate (P4) with an open approval request.
    const first = await useRapid.getState().startWildRun(p.id);
    assert.equal(first.ok, true);
    assert.equal(first.stoppedReason, "paused");
    const parked = current(p.id);
    assert.equal(parked.currentPhase, 4);
    assert.equal(parked.hitl?.phase, 4, "parked at the P4 gate with an open approval request");
    assert.equal(parked.wildRun?.active, true);
    assert.equal(parked.wildRun?.pause, true, "PA-01 precondition: paused + active (driver exited)");
    const epoch = parked.wildRun!.startedAt;

    // The human reviews and approves the open gate. The wildRun surface is NOT
    // touched by approve — the console Resume button's only job is to re-enter
    // the driver, not to re-approve or flip a flag (the g3 UI-Resume defect).
    const approval = useRapid.getState().approve(p.id);
    assert.equal(approval.ok, true);
    const approved = current(p.id);
    assert.equal(approved.currentPhase, 5, "gate 4 sealed, cursor on P5");
    assert.equal(approved.wildRun?.active, true);
    assert.equal(approved.wildRun?.pause, true, "approve never unparks the run (driver still exited)");

    // Resume. Do NOT await yet: the start stamp + wild.resume log commit
    // synchronously before the driver's first `await wildStep`, so this
    // mid-flight snapshot is the observable proof the DRIVER re-entered
    // (active + pause:false), as opposed to a driverless toggleWildPause.
    const resumed = useRapid.getState().startWildRun(p.id);
    const mid = current(p.id);
    assert.equal(mid.wildRun?.active, true, "resumed driver stamped the run active");
    assert.equal(mid.wildRun?.pause, false, "resumed driver cleared pause (driver re-entered)");
    assert.equal(mid.wildRun?.startedAt, epoch, "PA-01 epoch stability: same run keeps startedAt");
    assert.ok(mid.logs.some((l) => l.event === "wild.resume"), "wild.resume ledgered on re-entry");

    const res = await resumed;
    assert.equal(res.ok, true);
    assert.ok(res.ran >= 1, `resumed driver took >= 1 step (got ${res.ran})`);
    const after = current(p.id);
    assert.ok(after.currentPhase > 4, `driver progressed past the approved gate (now P${after.currentPhase})`);
    assert.equal(after.wildRun?.active, true, "run stays active after the resumed driver re-parks");
  } finally {
    process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

test("144 L4: a paused run force-stopped by a simulated reload is honestly not-active — startWildRun starts FRESH, never resumes the dead session", async () => {
  const savedKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "";
  try {
    const p = install(seedProject());
    useRapid.getState().setWildMode(p.id, true);
    const first = await useRapid.getState().startWildRun(p.id);
    assert.equal(first.ok, true);
    const parked = current(p.id);
    assert.equal(parked.wildRun?.active, true);
    assert.equal(parked.wildRun?.pause, true, "run parked paused (the persisted PA-01 resume shape)");
    const epoch = parked.wildRun!.startedAt;

    // Simulated reload: storage rehydration and the CLI load path both repair a
    // saved project through engine.hydrateProject, which force-stops a
    // persisted ACTIVE run — no driver survives a reload (engine hydrateWildRun
    // + the loud wild.stop log; headless.wildResumeRun on the resulting shape
    // returns { ok: false, reason: "not-active" }).
    const reloaded = hydrateProject(parked);
    assert.equal(reloaded.wildRun?.active, false, "hydration force-stops the persisted active run");
    assert.equal(reloaded.wildRun?.pause, false, "pause flag cleared with the run");
    assert.equal(typeof reloaded.wildRun?.stoppedAt, "number", "stoppedAt stamped");
    assert.ok(
      reloaded.logs.some((l) => l.event === "wild.stop"),
      "loud wild.stop log says the session died with the page",
    );
    install(reloaded);

    // The store's only resume entry is startWildRun-while-PAUSED-ACTIVE
    // (store.ts:900-916). After the reload the run is NOT ACTIVE, so the same
    // call must be a FRESH start from the current phase (new epoch + wild.start
    // log), never a wild.resume masquerading as the dead driver continuing.
    const fresh = await useRapid.getState().startWildRun(p.id);
    assert.equal(fresh.ok, true);
    const after = current(p.id);
    assert.notEqual(after.wildRun?.startedAt, epoch, "fresh run mints a NEW epoch (startedAt changed)");
    assert.ok(after.logs.some((l) => l.event === "wild.start"), "ledgered as wild.start");
    assert.ok(
      !after.logs.some((l) => l.event === "wild.resume"),
      "never ledgered as wild.resume — the pre-reload run was honestly not-active",
    );
  } finally {
    process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

test("144 L4: setEnforceDod toggles the TARGET project only (console toggle must not leak across builds)", () => {
  const a = install(seedProject());
  const b = seedProject();
  useRapid.setState({ projects: [a, b], activeId: a.id, hydrated: true, autopilot: false });
  // Engine default (emptyProject) is keyed: keyless → false (advisory),
  // DEEPSEEK_API_KEY configured → true. The toggle semantics must not depend
  // on the ambient key, so pin relative to whatever the engine seeded.
  const dflt = current(a.id).enforceDod;
  useRapid.getState().setEnforceDod(a.id, true);
  assert.equal(current(a.id).enforceDod, true, "toggle on → project.enforceDod true");
  assert.equal(current(b.id).enforceDod, dflt, "sibling build untouched (per-project opt-in)");
  useRapid.getState().setEnforceDod(a.id, false);
  assert.equal(current(a.id).enforceDod, false, "toggle back off");
  assert.equal(current(b.id).enforceDod, dflt, "still untouched after the second toggle");
});

test("T0.1: legacy version:0 blob identity-migrates (projects survive rehydrate)", async () => {
  const good = emptyProject({ name: "Legacy v0", brief: BRIEF });
  useRapid.setState({ projects: [], activeId: null, hydrated: false, autopilot: false, demoSeeded: true });
  localStorage.setItem(
    "rapidtool.v4",
    JSON.stringify({
      state: { projects: [good], activeId: good.id, autopilot: false, demoSeeded: true },
      version: 0,
    }),
  );
  await useRapid.persist.rehydrate();
  const st = useRapid.getState();
  assert.equal(st.hydrated, true);
  assert.ok(st.projects.some((p) => p.id === good.id), "v0 blob is not wiped by the v1 migrate");
});

test("T0.1: future-version blob (version>1) re-seeds instead of hydrating unknown schema", async () => {
  const alien = emptyProject({ name: "From the future", brief: BRIEF });
  useRapid.setState({ projects: [], activeId: null, hydrated: false, autopilot: false, demoSeeded: false });
  localStorage.setItem(
    "rapidtool.v4",
    JSON.stringify({
      state: { projects: [alien], activeId: alien.id, autopilot: false, demoSeeded: true },
      version: 99,
    }),
  );
  await useRapid.persist.rehydrate();
  const st = useRapid.getState();
  assert.equal(st.hydrated, true, "hydration completes (never stranded)");
  assert.ok(Array.isArray(st.projects));
  assert.equal(
    st.projects.some((p) => p.id === alien.id),
    false,
    "unknown-future schema is not trusted — recovered via clean re-seed",
  );
});

test("T0.3: executeAsync returns ok:false on a hard-DoD block (does not commit success)", async () => {
  const p = install(seedProject());
  useRapid.getState().setEnforceDod(p.id, true);
  assert.equal((await useRapid.getState().executeAsync(p.id)).ok, true, "P0 passes and advances");
  assert.equal(current(p.id).currentPhase, 1);
  useRapid.setState((s) => ({
    projects: s.projects.map((x) =>
      x.id === p.id
        ? {
            ...x,
            phases: x.phases.map((ph) => (ph.id === 1 ? { ...ph, status: "complete" as const, startedAt: Date.now() } : ph)),
          }
        : x,
    ),
  }));
  const res = await useRapid.getState().executeAsync(p.id);
  assert.equal(res.ok, false, "async path must not report success past a hard-DoD block");
  assert.ok(/DoD unmet/.test(res.error ?? ""), "honest error text");
  const after = current(p.id);
  assert.equal(after.currentPhase, 1, "cursor did not move");
  assert.ok(after.logs.some((l) => l.event === "dod.blocked"), "dod.blocked log persisted");
});

test("T0.5: hydrate clamps a hole-in-phases payload (P0-2 complete, P3 locked, P4 complete, edge=4)", () => {
  const base = emptyProject({ name: "Holed", brief: BRIEF });
  const holed: Project = {
    ...base,
    currentPhase: 4 as PhaseId,
    phases: base.phases.map((ph) => {
      if (ph.id <= 2) return { ...ph, status: "complete" as const, startedAt: 1, completedAt: 1 };
      if (ph.id === 3) return { ...ph, status: "locked" as const };
      if (ph.id === 4) return { ...ph, status: "complete" as const, startedAt: 1, completedAt: 1 };
      return ph;
    }),
  };
  const p = hydrateProject(holed);
  assert.equal(p.currentPhase, 3, "edge clamped to first unsealed slot after contiguous completes");
  assert.equal(p.phases.find((r) => r.id === 3)?.status, "ready", "hole record promoted so the graph can run");
  assert.ok(
    (p.logs ?? []).some((l) => l.event === "hydrate.repaired" && String(l.detail).includes("hole:")),
    "repair is loud",
  );
});

test("A1: hydrate pending-ifies approved fixtures when acceptanceBriefHash ≠ fnv1a(brief)", () => {
  const base = emptyProject({ name: "StaleFx", brief: BRIEF });
  const caseOk = {
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
  const p = hydrateProject({
    ...base,
    acceptanceFixtures: [caseOk],
    acceptanceApprovedAt: 99,
    acceptanceBriefHash: "not-the-brief-hash",
  });
  assert.equal(p.acceptanceFixtures?.[0]?.approval, "pending", "never silently re-approve a stale set");
  assert.equal(p.acceptanceApprovedAt, undefined, "approved-at cleared");
  assert.ok((p.logs ?? []).some((l) => l.event === "acceptance.stale"), "loud acceptance.stale log");
  const live = String(fnv1a(BRIEF));
  const matching = hydrateProject({
    ...base,
    acceptanceFixtures: [caseOk],
    acceptanceApprovedAt: 99,
    acceptanceBriefHash: live,
  });
  assert.equal(matching.acceptanceFixtures?.[0]?.approval, "approved", "matching hash keeps approval");
  assert.equal(matching.acceptanceApprovedAt, 99);
});

// ---------------------------------------------------------------------------
// K2 (W39) — the future-version blob is NOT destroyed by recovery
// ---------------------------------------------------------------------------

test("K2: a FUTURE-version blob recovers loudly and is preserved under the .rescue key", async () => {
  // The old comment claimed "the blob is never overwritten on a version
  // mismatch", but H4's recovery persists the re-seed, which OVERWRITES it —
  // a downgrade (or a stale tab after a deploy) silently destroyed newer data.
  // The rescue copy keeps the raw bytes the new build could still read.
  useRapid.setState({ projects: [], activeId: null, hydrated: false, autopilot: false, demoSeeded: false });
  const future = JSON.stringify({
    state: {
      projects: [{ id: "future-1", name: "From A Newer Build", phases: [] }],
      activeId: "future-1",
      autopilot: false,
      demoSeeded: true,
    },
    version: 2, // this build reads version 1; migrate() refuses to guess
  });
  localStorage.setItem("rapidtool.v4", future);
  localStorage.removeItem("rapidtool.v4.rescue");
  try {
    await useRapid.persist.rehydrate(); // must resolve, never reject/throw
    const st = useRapid.getState();
    assert.equal(st.hydrated, true, "hydration completes for a future-version blob");
    assert.equal(st.projects.length, 1, "clean re-seed ran (the newer payload is not guessed at)");
    assert.equal(
      localStorage.getItem("rapidtool.v4.rescue"),
      future,
      "the newer build's raw blob is preserved byte-for-byte under the rescue key",
    );
    const healed = localStorage.getItem("rapidtool.v4") ?? "";
    assert.doesNotThrow(() => JSON.parse(healed), "the main key is rewritten with this build's valid JSON");
  } finally {
    localStorage.removeItem("rapidtool.v4.rescue");
  }
});

// ---------------------------------------------------------------------------
// A3 (fixes/309_a3_guardset.md) — M3-18: convergeRealRun hostile-shape guards
// (the runModuleReal test seam must no-op on junk, never throw).
// ---------------------------------------------------------------------------

test("A3/M3-18: convergeRealRun junk input — same-reference no-op; junk collections bound to []", () => {
  assert.equal(
    convergeRealRun(null as unknown as Project, null as unknown as Artifact, null as unknown as JsonLog),
    null,
    "a null base has no recorded state to converge — returned unchanged, never a TypeError",
  );
  const base = { ...emptyProject({ name: "converge-junk", brief: "b" }), artifacts: 42, logs: "junk" };
  const artifact = { id: "a1", phase: 6, kind: "code", title: "T", body: "B" } as Artifact;
  const log = { ts: 1, phase: 6, level: "info", event: "runner.real", detail: "exit 0" } as JsonLog;
  const out = convergeRealRun(base as unknown as Project, artifact, log);
  assert.deepEqual(out.artifacts, [artifact], "junk artifacts bound to [] before the append");
  assert.deepEqual(out.logs, [log], "junk logs bound to [] before the append");
});
