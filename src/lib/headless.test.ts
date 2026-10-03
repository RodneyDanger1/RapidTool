// ---------------------------------------------------------------------------
// headless.test.ts — file-based headless driver suite (deterministic, no network).
//
// Run: node --experimental-strip-types --test src/lib/headless.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  applyVerifyOutcome,
  approve,
  createProject,
  driveP6Journey,
  emitProject,
  exportJson,
  HARNESS_APPROVE_ACTOR,
  importTreeDir,
  ingest,
  keyedTrailOutcome,
  loadProject,
  nextAction,
  p6CycleLiveDeps,
  packet,
  promoteEmittedTreeTested,
  promoteRepairedDirTested,
  reject,
  repairCycleLiveDeps,
  repairTreeDir,
  resolveDoctorKeyState,
  resolveDoctorSpendSource,
  retry,
  runAcceptance,
  runPhase,
  runP6Edge,
  runUntilGate,
  saveProject,
  summary,
  treeRunFailureFiles,
  wildPauseRun,
  wildResumeRun,
  wildStartHeadless,
  wildStartRun,
  wildStopRun,
  withCommonJsExports,
} from "./headless.ts";
import type { ApproveActor, P6JourneyCycleContext } from "./headless.ts";
import type { RankableLessonRow } from "./knowledge.ts";
import { runGate } from "./dod.ts";
import { IMPORT_MAX_CHARS, importProject } from "./io.ts";
import { checkpointPath, readCheckpoint } from "./checkpoint.server.ts";
import { evaluatePolicy } from "./policy.ts";
import { recordSessionSpend, resetSessionBudget, sessionTokenBudget } from "./token-ledger.ts";
import { FIXTURE_BRIEF } from "./testing/fixtures.ts";
import { fnv1a } from "./algorithms.ts";
import type { PhaseId, Project, WildPlan } from "./types.ts";
import type { WildReviewer } from "./engine.ts";
import type { RtEventSeed } from "./rt-events.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";
import { TREE_ENTRY_PATH } from "./codegen.server.ts";
import { compileAgentPacket } from "./packet.ts";

// fix 327 L1 — non-hermetic keyless suite. The host shell may carry a real
// DEEPSEEK_API_KEY (this box sets one in the User scope), which flips
// emptyProject's enforceDod create-default ON (engine.ts:1967) and makes
// drainToComplete park instead of completing — failing fixes/144, the
// end-to-end round-trip, E-25 and 185-H1 at their keyless preconditions. The
// create-default pins below set/restore the key themselves, so they still
// exercise the keyed branch. node --test runs each file in its own child; the
// CLI children are already forced keyless by runCli (DEEPSEEK_API_KEY: "").
delete process.env.DEEPSEEK_API_KEY;

const tempDir = (): string => mkdtempSync(join(tmpdir(), "rapidtool-headless-"));

/** 310 (B1 · M6-01/M6-02): a pid that is provably DEAD on this host — a real
 *  child spawned and fully reaped. The OS cannot recycle a pid inside the
 *  pin's window, so the liveness check sees it as an orphan (the SIGKILL
 *  residue class the reclaim pins reproduce). */
function deadPid(): number {
  const res = spawnSync(process.execPath, ["-e", ""], { encoding: "utf8" });
  assert.equal(res.status, 0, `dead-pid probe child must exit cleanly (${res.stderr ?? ""})`);
  assert.ok(typeof res.pid === "number" && res.pid > 0, "spawnSync must report the child pid");
  return res.pid;
}

/** Drive a project to completion through the headless loop (deterministic). */
async function drainToComplete(project: Project): Promise<Project> {
  let p = project;
  for (let i = 0; i < 40; i++) {
    if (p.status === "complete" || p.status === "blocked") return p;
    const res = await runUntilGate(p, { maxSteps: 1 });
    p = res.project;
    if (p.status === "awaiting_hitl") p = approve(p);
  }
  return p;
}

/** Fabricate a pending (non-stock, non-forceHuman) HITL gate on `phase`. */
function parkAt(project: Project, phase: number): Project {
  const phases = project.phases.map((r) => {
    if (r.id === phase) return { ...r, status: "awaiting_hitl" as const };
    if (r.id < phase) return { ...r, status: "complete" as const };
    return r;
  });
  return {
    ...project,
    currentPhase: phase as Project["currentPhase"],
    status: "awaiting_hitl" as const,
    hitl: { phase: phase as Project["currentPhase"], title: "Test gate", prompt: "Approve?", stakes: "test" },
    phases,
    schedule: project.schedule ? { ...project.schedule, tightness: 5 } : project.schedule,
  };
}

describe("createProject", () => {
  it("builds a fresh 13-phase project and infers name + domain", () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    assert.equal(p.phases.length, 13);
    assert.equal(p.status, "intake");
    assert.equal(p.currentPhase, 0);
    assert.ok(p.name.length > 0);
    assert.ok(p.brief === FIXTURE_BRIEF.trim());
    assert.equal(p.phases.find((r) => r.id === 0)?.status, "ready");
  });

  it("honors an explicit name", () => {
    const p = createProject({ brief: FIXTURE_BRIEF, name: "Dispatch Pro" });
    assert.equal(p.name, "Dispatch Pro");
  });

  it("215: createProject forwards a declared delivery kind (webapp → app)", () => {
    const p = createProject({ brief: FIXTURE_BRIEF, kind: "app" });
    assert.equal(p.kind, "app");
    const absent = createProject({ brief: FIXTURE_BRIEF });
    assert.equal(absent.kind, undefined, "no kind → legacy absent (library path)");
  });

  it("rejects an empty brief", () => {
    assert.throws(() => createProject({ brief: "   " }), /non-empty brief/);
  });

  // fixes/132 (C2): enforceDod create-default policy surfaces through the
  // headless seam (createProject → emptyProject). Env is saved/restored so a
  // keyed dev shell never leaks state into the rest of the suite.
  it("defaults enforceDod ON when DEEPSEEK_API_KEY is set (keyed run)", () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      process.env.DEEPSEEK_API_KEY = "sk-live-132-probe";
      const p = createProject({ brief: FIXTURE_BRIEF });
      assert.equal(p.enforceDod, true, "keyed create → hard-DoD default");
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });

  it("defaults enforceDod OFF when no key is configured (deterministic run)", () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      const p = createProject({ brief: FIXTURE_BRIEF });
      assert.equal(p.enforceDod, false, "keyless create → advisory default");
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });
});

describe("file persistence (atomic)", () => {
  it("round-trips a project through save/load", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "build.json");
      const p = createProject({ brief: FIXTURE_BRIEF });
      saveProject(path, p);
      const loaded = loadProject(path);
      assert.equal(loaded.id, p.id);
      assert.equal(loaded.name, p.name);
      assert.equal(loaded.currentPhase, p.currentPhase);
      assert.equal(loaded.phases.length, 13);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("leaves no temp files behind after a save", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "build.json");
      saveProject(path, createProject({ brief: FIXTURE_BRIEF }));
      assert.deepEqual(readdirSync(dir), ["build.json"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("174-13: refuses save when a .lock already exists (RT_E_BUSY)", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "build.json");
      writeFileSync(`${path}.lock`, "held");
      try {
        saveProject(path, createProject({ brief: FIXTURE_BRIEF }));
        assert.fail("expected lock refusal");
      } catch (err) {
        assert.equal((err as Error & { code?: string }).code, "RT_E_BUSY");
      }
      assert.ok(!existsSync(path), "must not write the project while locked");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("310 (B1 · M6-02): reclaims a stale .lock whose holder pid is dead (SIGKILL residue)", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "build.json");
      writeFileSync(`${path}.lock`, JSON.stringify({ pid: deadPid(), ts: Date.now() }));
      saveProject(path, createProject({ brief: FIXTURE_BRIEF }));
      assert.ok(existsSync(path), "a stale (dead-pid) lock must not block the save");
      assert.ok(!existsSync(`${path}.lock`), "the reclaimed lock is released after the save");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("310 (B1 · M6-02): a LIVE .lock still refuses RT_E_BUSY — liveness, not age, decides", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "build.json");
      // own pid = provably live; ts 0 = ancient, so only a real liveness check
      // can refuse this — a blanket age/force bypass would reclaim it.
      writeFileSync(`${path}.lock`, JSON.stringify({ pid: process.pid, ts: 0 }));
      try {
        saveProject(path, createProject({ brief: FIXTURE_BRIEF }));
        assert.fail("expected lock refusal");
      } catch (err) {
        assert.equal((err as Error & { code?: string }).code, "RT_E_BUSY");
      }
      assert.ok(!existsSync(path), "must not write the project while locked");
      assert.ok(existsSync(`${path}.lock`), "a live lock is never deleted by a refused writer");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("310 (B1 · M6-02): legacy identityless lock — fresh refuses, past the age bound reclaims", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "build.json");
      writeFileSync(`${path}.lock`, "held");
      try {
        saveProject(path, createProject({ brief: FIXTURE_BRIEF }));
        assert.fail("expected lock refusal on a fresh identityless lock");
      } catch (err) {
        assert.equal((err as Error & { code?: string }).code, "RT_E_BUSY");
      }
      const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
      utimesSync(`${path}.lock`, old, old);
      saveProject(path, createProject({ brief: FIXTURE_BRIEF }));
      assert.ok(existsSync(path), "an identityless lock past the bound is orphaned residue — reclaim it");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws on a missing file", () => {
    assert.throws(() => loadProject(join(tmpdir(), "does-not-exist.json")));
  });

  it("throws on malformed JSON", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "bad.json");
      saveProject(path, createProject({ brief: FIXTURE_BRIEF }));
      // overwrite with garbage
      writeFileSync(path, "{ not json", "utf8");
      assert.throws(() => loadProject(path), /Invalid JSON/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// fixes/316_h7 · ADDENDUM P1 (I3 finisher) — the interrupted-save pin. H7's
// survivability sweep verified saveProject's temp+rename atomicity
// (headless.ts:222-259) but nothing simulated an INTERRUPTED write: (a) a
// killed writer's truncated temp must be inert, (b) a temp write that fails
// inside the save must propagate with the original + lock state clean.
// ---------------------------------------------------------------------------
describe("fixes/316_h7 addendum P1 (I3) — an interrupted save never dents the original", () => {
  it("a killed writer's truncated temp is inert — the original survives, the next save lands", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "build.json");
      const v1 = createProject({ brief: FIXTURE_BRIEF });
      saveProject(path, v1);
      const v1Bytes = readFileSync(path, "utf8");
      // Exactly what an interrupted (SIGKILLed) save leaves behind: a
      // half-written temp beside an untouched target — the rename never ran.
      writeFileSync(`${path}.tmp-99999-1`, v1Bytes.slice(0, Math.floor(v1Bytes.length / 2)), "utf8");
      assert.equal(loadProject(path).id, v1.id, "a half-written temp must never affect the target");
      const v2 = createProject({ brief: FIXTURE_BRIEF + " — second build" });
      saveProject(path, v2);
      assert.equal(loadProject(path).id, v2.id, "the next save lands cleanly alongside the residue");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a temp write that fails inside the save propagates — original intact, lock released, retry lands", () => {
    const dir = tempDir();
    const realNow = Date.now;
    const FIXED = 1_700_000_000_000;
    try {
      const path = join(dir, "build.json");
      const v1 = createProject({ brief: FIXTURE_BRIEF });
      saveProject(path, v1);
      // Deterministic fault: the save's temp name is pid+clock; freeze the
      // clock and plant a DIRECTORY at that exact name, so writeFileSync
      // throws inside the save's try (the aborted-write path). No fs
      // monkeypatching — ESM named imports of node:fs are not patchable.
      Date.now = () => FIXED;
      mkdirSync(`${path}.tmp-${process.pid}-${FIXED}`);
      const v2 = createProject({ brief: FIXTURE_BRIEF + " — second build" });
      let thrown: unknown = null;
      try {
        saveProject(path, v2);
      } catch (e) {
        thrown = e;
      }
      assert.ok(thrown, "the aborted save must propagate its error, never claim success");
      assert.notEqual(
        (thrown as Error & { code?: string }).code,
        "RT_E_BUSY",
        "the lock was acquired — the throw comes from the WRITE step, not contention",
      );
      Date.now = realNow; // unblock the retry (the residue directory stays, as a killed writer's would)
      assert.equal(loadProject(path).id, v1.id, "the original bytes survive a failed save's catch path");
      assert.ok(!existsSync(`${path}.lock`), "the failed save still released its lock (finally)");
      saveProject(path, v2);
      assert.equal(loadProject(path).id, v2.id, "a retry after the failure lands");
    } finally {
      Date.now = realNow;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("runPhase (deterministic)", () => {
  it("synthesizes phase 0 (scorecard + packet) without throwing", async () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const out = await runPhase(p, 0);
    assert.equal(out.phases.find((r) => r.id === 0)?.status, "complete");
    assert.ok(out.scorecard, "scorecard should be populated");
    assert.ok(out.packet.length > 0);
    assert.ok(out.artifacts.some((a) => a.kind === "scorecard"));
  });

  it("returns the project unchanged for an invalid phase (never throws)", async () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const out = await runPhase(p, 99 as Project["currentPhase"]);
    assert.equal(out, p);
  });
});

describe("runUntilGate", () => {
  it("parks at the first stock HITL gate (P4) with no autopilot", async () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const res = await runUntilGate(p);
    assert.equal(res.project.status, "awaiting_hitl");
    assert.equal(res.project.currentPhase, 4);
    assert.ok(res.project.hitl);
    assert.ok(res.steps > 0);
    assert.equal(res.stopped, true);
  });

  it("autopilot also parks at P4 (stock HITL is never auto-approved)", async () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const res = await runUntilGate(p, { autopilot: true });
    assert.equal(res.project.status, "awaiting_hitl");
    assert.equal(res.project.currentPhase, 4);
  });

  it("autopilot auto-approves a non-stock, non-forceHuman gate", async () => {
    const p = parkAt(createProject({ brief: FIXTURE_BRIEF }), 3);
    const res = await runUntilGate(p, { autopilot: true, maxSteps: 1 });
    assert.notEqual(res.project.status, "awaiting_hitl");
    assert.equal(res.project.hitl, null);
    assert.equal(res.project.decisions.at(-1)?.decidedBy, "autopilot");
  });

  it("autopilot never approves a forceHuman gate", async () => {
    const base = parkAt(createProject({ brief: FIXTURE_BRIEF }), 6);
    const p: Project = { ...base, hitl: { ...base.hitl!, phase: 6, forceHuman: true } };
    const res = await runUntilGate(p, { autopilot: true, maxSteps: 1 });
    assert.equal(res.project.status, "awaiting_hitl");
    assert.ok(res.project.hitl, "forceHuman gate must remain open");
    assert.equal(res.project.decisions.length, 0);
  });

  it("a single maxSteps=1 step advances exactly one phase", async () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const res = await runUntilGate(p, { maxSteps: 1 });
    assert.equal(res.steps, 1);
    // P0 (no HITL) completes and the edge advances to P1 ready.
    assert.equal(res.project.phases.find((r) => r.id === 0)?.status, "complete");
    assert.equal(res.project.currentPhase, 1);
  });
});

describe("approve / reject / retry", () => {
  it("approve clears the gate and advances the edge", async () => {
    let p = createProject({ brief: FIXTURE_BRIEF });
    p = (await runUntilGate(p)).project; // parked at P4
    p = approve(p);
    assert.equal(p.status, "running");
    assert.equal(p.currentPhase, 5);
    assert.equal(p.phases.find((r) => r.id === 4)?.status, "complete");
    assert.equal(p.decisions.at(-1)?.decision, "approve");
  });

  it("reject requires ≥12 characters of qualitative feedback", async () => {
    let p = createProject({ brief: FIXTURE_BRIEF });
    p = (await runUntilGate(p)).project;
    assert.throws(() => reject(p, "too short"), /12 characters/);
  });

  it("reject → retry → regenerate applies the note and unblocks", async () => {
    let p = createProject({ brief: FIXTURE_BRIEF });
    p = (await runUntilGate(p)).project; // parked at P4
    p = reject(p, "The isolation policy must enumerate per-role OAuth scopes.");
    assert.equal(p.status, "blocked");
    assert.equal(p.phases.find((r) => r.id === 4)?.status, "rejected");

    p = retry(p);
    assert.equal(p.status, "running");
    assert.equal(p.phases.find((r) => r.id === 4)?.status, "ready");
  });

  it("322 X1 (F-1/R-A): a machine reject records the harness autopilot seat — never decidedBy:human", async () => {
    let p = createProject({ brief: FIXTURE_BRIEF });
    p = (await runUntilGate(p)).project; // parked at P4
    p = reject(p, "The isolation policy must enumerate per-role OAuth scopes.");
    const row = p.decisions.at(-1);
    assert.equal(row?.decision, "reject");
    assert.equal(row?.decidedBy, HARNESS_APPROVE_ACTOR.decidedBy, "default seat = harness autopilot actor");
    assert.equal(row?.decidedBy, "autopilot", "a machine reject can never mint decidedBy:human");

    // The human seat is claimable only EXPLICITLY (R-A seam; the CLI layer owns
    // the out-of-band token discipline for the claim — scripts/ seat flag).
    let q = createProject({ brief: FIXTURE_BRIEF });
    q = (await runUntilGate(q)).project;
    q = reject(q, "The isolation policy must enumerate per-role OAuth scopes.", {
      decidedBy: "human",
      seat: "human-cli-i-am-human",
    });
    assert.equal(q.decisions.at(-1)?.decidedBy, "human", "an explicit human seat passes through");
  });
});

describe("ingest", () => {
  it("applies a valid agent report as a distinguishable artifact", async () => {
    let p = createProject({ brief: FIXTURE_BRIEF });
    p = (await runUntilGate(p)).project;
    const before = p.artifacts.length;
    p = ingest(p, {
      phase: 4,
      status: "complete",
      summary: "Reviewed isolation policy against the threat model.",
      artifacts: [{ title: "Threat model", body: "Spoofing, tampering, repudiation." }],
    });
    assert.equal(p.artifacts.length, before + 1);
    const added = p.artifacts[before];
    assert.ok(added.id.startsWith("report-"));
    assert.ok(added.title.startsWith("[agent report] "));
    assert.ok(added.body.includes("unverified by engine"));
    assert.ok(p.logs.some((l) => l.event === "agent.report"));
  });

  it("rejects a malformed report", () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    assert.throws(() => ingest(p, { phase: 99, status: "complete", summary: "x" }), /Invalid report/);
  });
});

describe("packet / exportJson / summary", () => {
  it("packet returns the compiled agent packet text", () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const text = packet(p);
    assert.ok(text.length > 0);
    assert.ok(text === p.packet);
  });

  it("exportJson round-trips through importProject", async () => {
    const p = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    const res = importProject(exportJson(p));
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.project.id, p.id);
  });

  it("summary returns a JSON-safe snapshot", async () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const s = summary(p);
    assert.equal(s.name, p.name);
    assert.equal(s.currentPhase, 0);
    assert.equal(s.status, "intake");
    assert.deepEqual(s.phaseCounts, { ready: 1, locked: 12 });
    assert.equal(s.lastGate, null);
    // fixes/125: honest gate surfacing — clean projects report empty, JSON-safe.
    assert.deepEqual(s.failedGates, []);
    assert.equal(s.sealedWithFailures, false);
    // and it survives JSON serialization
    assert.doesNotThrow(() => JSON.stringify(s));
  });

  it("A20: nextAction reads the current edge's record by ID, not array position", () => {
    // A reordered phases array is not something hydrate produces, but
    // nextAction is an exported wire surface: positional indexing read some
    // OTHER phase's status as the current edge's (P12's locked record at
    // index 0), missing the running arm entirely.
    const p = createProject({ brief: FIXTURE_BRIEF });
    const running = p.phases.map((r) => (r.id === 0 ? { ...r, status: "running" as const } : r));
    const reordered = [...running].reverse();
    assert.equal(nextAction({ ...p, phases: reordered }).kind, "running");
    // The rejected arm reads positionally too — same law.
    const rejected = p.phases.map((r) => (r.id === 0 ? { ...r, status: "rejected" as const } : r));
    const rejectedAction = nextAction({ ...p, phases: [...rejected].reverse() });
    assert.equal(rejectedAction.kind, "run");
    assert.match(rejectedAction.why, /rejected/, "the rejected arm is named, not the generic default");
  });
});

describe("fixes/316_h6 (T5.5) — the summary envelope carries the session-budget spend half", () => {
  // F2-04 semantics mirrored onto the SUMMARY surface: the triple is read from
  // the SAME T-107.6 session ledger `recordSessionSpend` records into (via
  // packet.ts's one boundary reader), `cap: null` states the unmetered default
  // EXPLICITLY (never absent), and stop_reason fires only on a strict `>`
  // crossing — landing exactly on the cap is still ok (199).

  it("unmetered session ⇒ explicit {spent:0, cap:null, stop_reason:null} (key always present)", () => {
    resetSessionBudget();
    try {
      const p = createProject({ brief: FIXTURE_BRIEF });
      assert.deepEqual(summary(p).budget, { spent: 0, cap: null, stop_reason: null });
      assert.doesNotThrow(() => JSON.stringify(summary(p).budget));
    } finally {
      resetSessionBudget();
    }
  });

  it("recorded spend without a cap ⇒ {spent>0, cap:null, stop_reason:null}", () => {
    resetSessionBudget();
    try {
      const p = createProject({ brief: FIXTURE_BRIEF });
      recordSessionSpend({ promptTokens: 100, completionTokens: 50 });
      assert.deepEqual(summary(p).budget, { spent: 150, cap: null, stop_reason: null });
    } finally {
      resetSessionBudget();
    }
  });

  it("cap landing exactly is ok; a strict crossing flips stop_reason to budget_exhausted", () => {
    const prev = process.env.RAPIDTOOL_TOKEN_CAP;
    process.env.RAPIDTOOL_TOKEN_CAP = "100";
    try {
      resetSessionBudget(); // re-reads env ⇒ cap=100, empty ledger
      const p = createProject({ brief: FIXTURE_BRIEF });
      recordSessionSpend({ promptTokens: 100, completionTokens: 0 });
      assert.deepEqual(summary(p).budget, { spent: 100, cap: 100, stop_reason: null });
      recordSessionSpend({ promptTokens: 0, completionTokens: 1 });
      assert.deepEqual(summary(p).budget, { spent: 101, cap: 100, stop_reason: "budget_exhausted" });
    } finally {
      if (prev === undefined) delete process.env.RAPIDTOOL_TOKEN_CAP;
      else process.env.RAPIDTOOL_TOKEN_CAP = prev;
      resetSessionBudget();
    }
  });
});

describe("fixes/125 — failed-gate surfacing", () => {
  it("summary surfaces a failed P6 gate as sealedWithFailures + the unmet census", async () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    // Simulate the make-4 shape: P6 sealed complete with a recorded red gate.
    const red = {
      ...p,
      phases: (p.phases as { id: number; status: string; gate?: unknown }[]).map((ph) =>
        ph.id === 6
          ? {
              ...ph,
              status: "complete",
              gate: { passed: false, unmet: ["p6-verified", "p6-brief-fit"], evidenceHash: "abc", checkedAt: 1 },
            }
          : ph,
      ),
      currentPhase: 7,
      status: "complete",
    };
    const s = summary(red as never);
    assert.equal(s.sealedWithFailures, true);
    assert.equal(s.failedGates.length, 1);
    assert.equal(s.failedGates[0]!.phase, 6);
    assert.ok(s.failedGates[0]!.unmet.includes("p6-brief-fit"));
  });
});

describe("fixes/144 (M4-1) — completion gate: a red-gate complete is never a clean seal", () => {
  async function drained(): Promise<Project> {
    return drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
  }

  it("a complete run with recorded failed DoD gates reports sealedWithFailures:true on the RunResult", async () => {
    const red = await drained();
    // Precondition (keyless drain): P6/P7 seal red by construction — the census
    // is non-empty, so this project MUST surface as a red-gate completion.
    assert.equal(summary(red).sealedWithFailures, true);
    const res = await runUntilGate(red);
    assert.equal(res.outcome, "complete");
    assert.equal(res.sealedWithFailures, true, "red-gate complete must flag sealedWithFailures");
    assert.ok(res.events.some((e) => e.startsWith("sealed-with-")), "census event present on the run");
  });

  it("a genuinely clean complete run keeps sealedWithFailures:false (exit-0 shape unchanged)", async () => {
    const red = await drained();
    const clean: Project = {
      ...red,
      phases: red.phases.map((ph) =>
        ph.status === "complete"
          ? { ...ph, gate: { passed: true, unmet: [], evidenceHash: "clean", checkedAt: 1 } }
          : ph,
      ),
    };
    assert.equal(summary(clean).sealedWithFailures, false, "precondition: clean census");
    const res = await runUntilGate(clean);
    assert.equal(res.outcome, "complete");
    assert.equal(res.sealedWithFailures, false);
  });
});

describe("fixes/144 (M4-2) — driveP6Journey (fake-deps: deterministic, no key/fs/runner)", () => {
  const emptyCompile = { ok: false, dir: "", checked: 0, passed: 0, failed: 1, skipped: 0, verdicts: [] };
  const redVerdict = (file: string, detail: string): TreeRunOutcome => ({
    ok: false,
    dir: "",
    compile: emptyCompile,
    tests: [{ file, compile: "pass", tests: { pass: 0, fail: 1 }, run: "fail", detail }],
    run: null,
  });
  const greenVerdict: TreeRunOutcome = {
    ok: true,
    dir: "",
    compile: { ...emptyCompile, ok: true, failed: 0, passed: 1, checked: 1 },
    tests: [],
    run: { kind: "library", run: "skip", detail: "no entry to smoke" },
  };
  /** The synthesized shape a real keyed cycle would leave: a generatedTree +
   *  the (complete) P6 record, so the driver's honest recordGateInto runs. */
  function withTree(base: Project): Project {
    return {
      ...base,
      generatedTree: [{ path: "src/generated.ts", source: "export const hvac = () => 1;", hash: "f1", attempt: 0 }],
    };
  }

  /** fixes/159 (F4) test seam: a gate-recorder fake that stamps a GREEN P6
   *  verdict. The real recordGateInto probes can never go green over the
   *  deterministic floor content — the green-gate CONVERGENCE branch of the
   *  journey is what this fake isolates (same injectability discipline as the
   *  synthesize/runTree fakes above; the red-gate path above uses the REAL
   *  default recorder). */
  const greenGateRecord = (p: Project): Project => ({
    ...p,
    phases: (p.phases ?? []).map((ph) =>
      ph.id === 6
        ? { ...ph, gate: { passed: true, unmet: [], evidenceHash: "159f4c0de", checkedAt: 1 } }
        : ph,
    ),
  });

  it("cycle1 tree-run fail → cycle2 context carries the tail → cycle3 green tree-run BUT the honestly-red P6 gate → FAILED naming the gate (fixes/159 F4)", async () => {
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    const seen: { cycle: number; tail: string | undefined }[] = [];
    const synthesize = async (p: Project, ctx: P6JourneyCycleContext): Promise<Project> => {
      seen.push({ cycle: ctx.cycle, tail: ctx.treeFailureTail });
      return withTree(p);
    };
    let runCalls = 0;
    const runTree = async (): Promise<TreeRunOutcome> => {
      runCalls += 1;
      if (runCalls === 1) return redVerdict("src/api/board.spec.ts", "expected dispatchBoard to exist");
      if (runCalls === 2) return redVerdict("src/api/board.spec.ts", "dispatchBoard returned undefined");
      return greenVerdict;
    };
    const res = await driveP6Journey(base, { budget: 3, deps: { synthesize, runTree } });
    // fixes/159 (F4): a green tree-run is NOT convergence — the recorded P6
    // DoD gate decides. The fake tree cannot satisfy the real probes over the
    // deterministic floor content, so the honest gate is red and the journey
    // FAILS (it must never return a bare "converged" on its own red gate).
    assert.equal(res.outcome, "failed");
    assert.equal(res.cycles, 3);
    // fixes/326 F1b: cycle 3 === budget — the gate-repair diversion is only
    // available while `cycle < budget`, so the red gate is terminal exactly
    // at the budget edge (the runCalls pin below is unchanged).
    assert.equal(runCalls, 3, "green tree-run on cycle 3 (== budget) stops the loop — no diversion budget left; terminal at the budget edge");
    assert.ok(
      !(res.project.logs ?? []).some((l) => l.event === "p6.journey.gate-repair"),
      "no gate-repair diversion at the budget edge (cycle === budget)",
    );
    // Cycle 2 + 3 each received the PREVIOUS cycle's tree-run failure tail.
    assert.equal(seen[0]!.cycle, 1);
    assert.equal(seen[0]!.tail, undefined, "cycle 1 has no prior tail");
    assert.equal(seen[1]!.cycle, 2);
    assert.ok(seen[1]!.tail!.includes("expected dispatchBoard to exist"), "cycle 2 ctx carries cycle-1 tail");
    assert.equal(seen[2]!.cycle, 3);
    assert.ok(seen[2]!.tail!.includes("dispatchBoard returned undefined"), "cycle 3 ctx carries cycle-2 tail");
    assert.equal(res.treeTail, null, "the final tree-run was green — no outstanding tree failure tail");
    assert.ok((res.project.logs ?? []).some((l) => l.event === "p6.tree.failure"), "red cycles stamped failure tails");
    // The red gate is recorded HONESTLY (real probes, never force-green) and
    // the FAILED evidence NAMES the failed gate + its unmet criteria.
    assert.ok(res.gate, "P6 gate recorded after the green tree-run");
    assert.equal(res.gate!.passed, false, "recorded verdict is the honest (red) one — and it decides failure");
    assert.ok(res.gate!.unmet.length > 0, "unmet criteria ride the gate record");
    const logs = res.project.logs ?? [];
    assert.ok(!logs.some((l) => l.event === "p6.journey.converged"), "no silent seal on a red gate — never a bare converged");
    const failed = logs.filter((l) => l.event === "p6.journey.failed");
    assert.equal(failed.length, 1, "the red-gate failure is logged once");
    assert.ok(failed[0]!.detail.includes("P6 gate FAIL"), "failure log names the failed gate");
    assert.ok(failed[0]!.detail.includes("gate.passed"), "failure log states the converged-requires-gate.passed rule");
    assert.ok(
      res.events.some((e) => e.includes("P6 gate FAIL") && e.includes("converged requires gate.passed")),
      "events trail names the failed gate for the caller/eval",
    );
    const lt = res.project.lastTest as { label?: string } | null | undefined;
    assert.notEqual(lt?.label, "tested", "T0.6: a red-gate failure must not mint lastTest tested");
  });

  it("green treeRun AND a genuinely-green P6 gate → converged (fixes/159 F4: gate.passed is required, not just a green tree)", async () => {
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    const res = await driveP6Journey(base, {
      deps: { synthesize: async (p) => withTree(p), runTree: async () => greenVerdict, recordGate: greenGateRecord },
    });
    assert.equal(res.outcome, "converged", "green treeRun + green gate = the ONLY converged shape");
    assert.equal(res.cycles, 1);
    assert.ok(res.gate, "the green gate record rides the result");
    assert.equal(res.gate!.passed, true);
    assert.equal(res.gate!.unmet.length, 0);
    assert.ok(
      (res.project.logs ?? []).some((l) => l.event === "p6.journey.converged"),
      "converged log stamped only when the gate is green",
    );
    assert.ok(
      (res.project.logs ?? []).every((l) => l.event !== "p6.journey.failed"),
      "no failure log on a genuinely-converged journey",
    );
    assert.ok(res.events.some((e) => e.includes("P6 journey converged")), "events trail says converged");
  });

  it("fixes/326 F1b: green tree-run + red fit-class gate → ONE bounded gate-repair cycle; the repaired tree re-records the gate green and converges (no shortcut)", async () => {
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    const seen: { cycle: number; gateRepair?: string }[] = [];
    // The synthesized tree carries a recorded missing-list row (the real
    // dod.reqtrace shape) so the diversion context has RECORDED evidence to
    // scrape — the engine adds no requirement the brief never had.
    const synthesize = async (p: Project, ctx: P6JourneyCycleContext): Promise<Project> => {
      seen.push({ cycle: ctx.cycle, gateRepair: ctx.gateRepair });
      const t = withTree(p);
      if (ctx.cycle === 1) {
        return {
          ...t,
          logs: [
            ...(t.logs ?? []),
            {
              ts: Date.now(),
              phase: 6 as PhaseId,
              level: "warn" as const,
              event: "dod.reqtrace",
              detail: "p6-arch FAIL · tree (2 files) · missing: track, drag, drop, persist",
            },
          ].slice(-200),
        };
      }
      return t;
    };
    // Stateful gate recorder: cycle 1's green tree weighs RED (fit-class
    // unmet — the criterion the diversion must feed forward); cycle 2's
    // repaired tree weighs GREEN. Both records come from this seam — the
    // journey gets no gate shortcut, the second record IS the repaired pass.
    let gateCalls = 0;
    const redThenGreenGate = (p: Project): Project => {
      gateCalls += 1;
      const passed = gateCalls > 1;
      return {
        ...p,
        phases: (p.phases ?? []).map((ph) =>
          ph.id === 6
            ? {
                ...ph,
                gate: passed
                  ? { passed: true, unmet: [], evidenceHash: "326f1bcafe", checkedAt: 1 }
                  : { passed: false, unmet: ["p6-brief-fit"], evidenceHash: "326f1bdead", checkedAt: 1 },
              }
            : ph,
        ),
      };
    };
    const res = await driveP6Journey(base, {
      budget: 3,
      deps: { synthesize, runTree: async () => greenVerdict, recordGate: redThenGreenGate },
    });
    assert.equal(res.outcome, "converged", "the repaired tree re-records the gate green — real convergence, never a forced pass");
    assert.equal(res.cycles, 2, "exactly ONE diverted cycle: cycle 1 red gate → cycle 2 repaired");
    assert.equal(gateCalls, 2, "the gate was recorded twice (once per green tree-run) — no shortcut");
    assert.ok(res.gate && res.gate.passed === true, "the winning verdict is the honestly re-recorded green gate");
    assert.equal(seen.length, 2, "synthesis ran exactly twice");
    assert.equal(seen[0]!.gateRepair, undefined, "cycle 1 carries no gate-repair context");
    assert.ok(
      seen[1]!.gateRepair!.includes("p6-brief-fit"),
      "cycle-2 ctx.gateRepair carries the recorded unmet criterion",
    );
    assert.ok(
      seen[1]!.gateRepair!.includes("missing: track, drag, drop, persist"),
      "cycle-2 ctx.gateRepair carries the recorded missing-list excerpt",
    );
    const logs = res.project.logs ?? [];
    const divert = logs.filter((l) => l.event === "p6.journey.gate-repair");
    assert.equal(divert.length, 1, "ONE diversion row — at most one per journey");
    assert.equal(divert[0]!.level, "warn", "the diversion is recorded as a warn row");
    assert.ok(logs.some((l) => l.event === "p6.journey.converged"), "the converged row is written only by the honest gate pass");
    assert.ok(res.events.some((e) => e.includes("one bounded gate-repair cycle")), "events trail names the diversion");
  });

  it("fixes/326 F1b: a SECOND red gate after the single diversion still FAILS — synthesize ×2, one diversion row, never converged", async () => {
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    let synthCalls = 0;
    const synthesize = async (p: Project): Promise<Project> => {
      synthCalls += 1;
      return withTree(p);
    };
    // Always-red gate with a non-empty unmet class: the first red diverts
    // ONCE; the second red must not divert again (fixes/159 F4 preserved —
    // a second red gate is terminal FAILED, never a silent seal).
    const alwaysRedGate = (p: Project): Project => ({
      ...p,
      phases: (p.phases ?? []).map((ph) =>
        ph.id === 6
          ? { ...ph, gate: { passed: false, unmet: ["p6-brief-fit"], evidenceHash: "326f1bdead", checkedAt: 1 } }
          : ph,
      ),
    });
    const res = await driveP6Journey(base, {
      budget: 3,
      deps: { synthesize, runTree: async () => greenVerdict, recordGate: alwaysRedGate },
    });
    assert.equal(res.outcome, "failed", "a second red gate still FAILS — never a silent seal");
    assert.equal(res.cycles, 2, "the second red gate is terminal");
    assert.equal(synthCalls, 2, "no third synthesis — the journey spends exactly one diversion");
    const logs = res.project.logs ?? [];
    assert.equal(logs.filter((l) => l.event === "p6.journey.gate-repair").length, 1, "exactly ONE diversion row");
    assert.equal(logs.filter((l) => l.event === "p6.journey.failed").length, 1, "the failure is recorded once");
    assert.ok(!logs.some((l) => l.event === "p6.journey.converged"), "never converged on a red gate");
    assert.equal(res.gate!.passed, false, "the recorded verdict stays red — no forced pass");
  });

  it("C-1 (WB-1): a genuinely green tree-run that EXECUTED specs mints the tested-equivalent before the gate — the deadlock must not need gate.passed to mint", async () => {
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    // The real keyed shape: the emitted tree ran its own oracle spec and it
    // passed. treeRunTestedEvidence() requires ≥1 passing spec with ≥1 executed
    // assertion for `executed:true` — that is the only honest mint precondition.
    const executedVerdict: TreeRunOutcome = {
      ok: true,
      dir: "",
      compile: { ...emptyCompile, ok: true, failed: 0, passed: 1, checked: 1 },
      tests: [
        {
          file: "tests/oracle.spec.ts",
          compile: "pass",
          run: "pass",
          tests: { pass: 1, fail: 0 },
          detail: "1 passed",
        },
      ],
      run: { kind: "library", run: "skip", detail: "no entry to smoke" },
    };
    const res = await driveP6Journey(base, {
      deps: { synthesize: async (p) => withTree(p), runTree: async () => executedVerdict },
    });
    const lt = res.project.lastTest as { label?: string; evidenceHash?: string } | null | undefined;
    // WB-1 (223 §4 C-1, parent-verified): today the ONLY mint call sits inside
    // `gate.passed === true`, whose p6-verified probe requires the very
    // lastTest the mint produces — a circular deadlock for every chunked tree.
    // The green tree-run IS the evidence; the mint must not wait on the gate.
    assert.equal(
      lt?.label,
      "tested",
      "green tree-run with executed specs ⇒ tested-equivalent minted (C-1 defuses the gate-before-mint deadlock)",
    );
    assert.ok((lt?.evidenceHash ?? "").length > 0, "the mint carries its evidence hash");
  });

  it("T9.3 (W44 · G3/320 · from 319_f3_promote §C): a green tree-run promotes the emitted dir's OWN project.json to tested + evidenceHash — red/no-spec/recordless dirs write nothing", async () => {
    const dir = tempDir();
    mkdirSync(join(dir, ".rapidtool"), { recursive: true });
    const recordPath = join(dir, ".rapidtool", "project.json");
    const base = createProject({ brief: FIXTURE_BRIEF });
    writeFileSync(recordPath, JSON.stringify(base, null, 2), "utf8");
    const executedVerdict: TreeRunOutcome = {
      ok: true,
      dir: "",
      compile: { ok: true, dir: "", checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [] },
      tests: [
        { file: "tests/oracle.spec.ts", compile: "pass", run: "pass", tests: { pass: 1, fail: 0 }, detail: "1 passed" },
      ],
      run: { kind: "library", run: "skip", detail: "no entry to smoke" },
    };
    const prom = await promoteEmittedTreeTested(base, dir, executedVerdict);
    assert.equal(prom.promoted, true, "fresh mint over a green executed run ⇒ the artifact record is promoted");
    const record = JSON.parse(readFileSync(recordPath, "utf8")) as Project;
    const lt = record.lastTest as { label?: string; evidenceHash?: string } | null | undefined;
    assert.equal(lt?.label, "tested", "the emitted record carries the tested stamp");
    assert.ok((lt?.evidenceHash ?? "").length > 0, "and its evidence hash");
    const promotedBytes = readFileSync(recordPath, "utf8");
    const red = await promoteEmittedTreeTested(base, dir, { ...executedVerdict, ok: false });
    assert.equal(red.promoted, false);
    assert.equal(readFileSync(recordPath, "utf8"), promotedBytes, "a red run writes nothing");
    const noSpec = await promoteEmittedTreeTested(base, dir, { ...executedVerdict, tests: [] });
    assert.equal(noSpec.promoted, false);
    assert.equal(readFileSync(recordPath, "utf8"), promotedBytes, "an ok run that executed no spec writes nothing");
    const bare = tempDir();
    const miss = await promoteEmittedTreeTested(base, bare, executedVerdict);
    assert.equal(miss.promoted, false, "a dir with no record is never stamped");
    assert.equal(existsSync(join(bare, ".rapidtool", "project.json")), false, "and no record is fabricated into existence");
  });

  it("W-02 (fixes/271 · §R1-f02): the P6 edge reaches the tested mint from runPhase AND through runUntilGate (run/gate/wild — ONE seam)", async () => {
    const drained = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    assert.notEqual(
      (drained.lastTest as { label?: string } | null)?.label,
      "tested",
      "precondition: the deterministic drain carries no tested verdict",
    );
    const w2Verdict: TreeRunOutcome = {
      ok: true,
      dir: "",
      compile: { ...emptyCompile, ok: true, failed: 0, passed: 1, checked: 1 },
      tests: [
        { file: "tests/oracle.spec.ts", compile: "pass", run: "pass", tests: { pass: 1, fail: 0 }, detail: "1 passed" },
      ],
      run: { kind: "library", run: "skip", detail: "no entry to smoke" },
    };
    // The real synthesis seam completes phase 6 (applyPhaseResult does); the
    // fakes stand in for it exactly like the fixes/159 F4 convergence tests.
    const synthesize = async (p: Project): Promise<Project> => {
      const t = withTree(p);
      return {
        ...t,
        phases: (t.phases ?? []).map((ph) => (ph.id === 6 ? { ...ph, status: "complete" as const } : ph)),
      };
    };
    const p6DepsW2 = { synthesize, runTree: async () => w2Verdict, recordGate: greenGateRecord };
    // (a) the direct run/gate edge — runPhase phase 6 live.
    const direct = await runPhase(drained, 6, { live: true, p6Deps: p6DepsW2 });
    const lt = direct.lastTest as { label?: string; evidenceHash?: string } | null | undefined;
    assert.equal(lt?.label, "tested", "runPhase's P6 edge mints the tested-equivalent (was synthesis-only)");
    const g = (direct.phases ?? []).find((ph) => ph.id === 6)?.gate;
    assert.ok(
      g && typeof g === "object" && (g as { passed?: unknown }).passed === true,
      "a recorded passing P6 gate rides the same call",
    );
    // (b) the advance loop: rewind the real drain to its P6 edge and thread
    // p6Deps through runUntilGate (run/gate's own driver).
    const rewound: Project = {
      ...drained,
      status: "running",
      currentPhase: 6,
      lastTest: null,
      phases: drained.phases.map((r) =>
        r.id === 6 ? ({ ...r, status: "ready" as const, gate: null, startedAt: null } as unknown as typeof r) : r,
      ),
    };
    const loop = await runUntilGate(rewound, { live: true, maxSteps: 1, p6Deps: p6DepsW2 });
    assert.equal(
      (loop.project.lastTest as { label?: string } | null)?.label,
      "tested",
      "runUntilGate threads p6Deps to the P6 edge and reaches the mint",
    );
  });

  it("W-02 keyless floor: runP6Edge without deps is the deterministic floor (no mint, no journey rows)", async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
      const rewound: Project = {
        ...base,
        status: "running",
        currentPhase: 6,
        lastTest: null,
        phases: base.phases.map((r) =>
          r.id === 6 ? ({ ...r, status: "ready" as const, gate: null, startedAt: null } as unknown as typeof r) : r,
        ),
      };
      const floored = await runP6Edge(rewound);
      assert.equal((floored.lastTest as { label?: string } | null)?.label, undefined, "no tested mint keyless");
      assert.ok(
        (floored.logs ?? []).every((l) => l.event !== "p6.journey.converged" && l.event !== "p6.journey.failed"),
        "the keyless passthrough writes no journey verdict rows",
      );
      // Byte-shape parity with the plain deterministic floor for the same edge.
      // W33 lane F1 (not-ok-10, WDX-3 precedent): two live runs stamp their own
      // wall-clocks — the byte diff is EXACTLY the volatile class (packet
      // `compiled_at` text+embed inside artifact bodies, phase record
      // startedAt/completedAt + gate.checkedAt, trace ranAt; logs ts was
      // already masked; fixes/295 F2-03's envelope `input_hash` folds those
      // same wall-clocks, so it masks with them). Strip those; every behavior
      // byte stays compared.
      const floor = await runPhase(rewound, 6);
      const stripVolatiles = (s: string) =>
        s
          .replace(/compiled_at: [^\n]+/g, "compiled_at: FIXED")
          .replace(/"compiled_at": "[^"]+"/g, '"compiled_at": "FIXED"')
          .replace(/"input_hash": "[^"]+"/g, '"input_hash": "FIXED"');
      const strip = (p: Project) => ({
        ...p,
        logs: (p.logs ?? []).map((l) => ({ ...l, ts: 0 })),
        traces: (p.traces ?? []).map((a) => ({ ...a, ranAt: 0 })),
        artifacts: (p.artifacts ?? []).map((a) => ({
          ...a,
          // The packet artifact's body IS the compiled packet — same
          // volatile-sensitive truncated tail as `packet` below; the artifact
          // content itself is compared structurally.
          body:
            typeof a.body === "string"
              ? stripVolatiles(a.body).split("## Artifacts (trimmed)")[0]
              : a.body,
        })),
        // W50 · 336-2 (pre-existing flake, reconciled): compileAgentPacket's
        // artifact-truncation BUDGET is length-sensitive to the volatile
        // compiled_at/input_hash values, so the packet's trimmed artifact TAIL
        // is not byte-stable across two compiles (the cut lands at a different
        // character). The artifact content is compared structurally in the
        // `artifacts` field below, so compare only the volatile-masked packet
        // HEAD here (System / Mission / DoD / ledger — the deterministic text).
        packet: stripVolatiles(p.packet).split("## Artifacts (trimmed)")[0],
        phases: (p.phases ?? []).map((r) => ({
          ...r,
          startedAt: typeof r.startedAt === "number" ? 0 : r.startedAt,
          completedAt: typeof r.completedAt === "number" ? 0 : r.completedAt,
          gate:
            r.gate && typeof r.gate === "object"
              ? { ...(r.gate as object), checkedAt: 0 }
              : r.gate,
        })),
      });
      assert.deepEqual(strip(floored), strip(floor), "keyless runP6Edge === applyPhaseResult(project, 6)");
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });

  it("green treeRun but NO recorded P6 gate (phase 6 not complete) → FAILED, never a bare converged (fixes/159 F4)", async () => {
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    // A synthesized project whose P6 record never completed: recordGateInto
    // no-ops (its no-op contract) and the journey must NOT infer a green gate
    // it never recorded — converged cannot be asserted without a verdict.
    const synthesize = async (p: Project): Promise<Project> => {
      const t = withTree(p);
      return {
        ...t,
        phases: (t.phases ?? []).map((ph) => (ph.id === 6 ? { ...ph, status: "ready" as const } : ph)),
      };
    };
    const res = await driveP6Journey(base, { deps: { synthesize, runTree: async () => greenVerdict } });
    assert.equal(res.outcome, "failed");
    assert.equal(res.gate, null, "no gate record exists to weigh");
    const logs = res.project.logs ?? [];
    assert.ok(!logs.some((l) => l.event === "p6.journey.converged"), "no bare converged without a gate verdict");
    assert.ok(
      logs.some((l) => l.event === "p6.journey.failed" && l.detail.includes("no P6 DoD gate record")),
      "the failure evidence names the missing gate record",
    );
    assert.ok(
      res.events.some((e) => e.includes("no P6 DoD gate record") && e.includes("converged requires gate.passed")),
      "events trail names the missing record for the caller/eval",
    );
  });

  it("budget exhaustion → FAILED outcome with the failure evidence + no silent seal", async () => {
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    const tails: string[] = [];
    const synthesize = async (p: Project, ctx: P6JourneyCycleContext): Promise<Project> => {
      tails.push(ctx.treeFailureTail ?? "");
      return withTree(p);
    };
    const alwaysRed = redVerdict("src/api/board.spec.ts", "dispatchBoard never converges");
    const res = await driveP6Journey(base, { deps: { synthesize, runTree: async () => alwaysRed } });
    assert.equal(res.outcome, "failed");
    assert.equal(res.cycles, 3, "default budget 3 burned entirely");
    assert.ok(res.treeTail!.includes("dispatchBoard never converges"));
    assert.ok(tails[1]!.includes("dispatchBoard never converges"), "exhausted loop still feeds the tail forward");
    const logs = res.project.logs ?? [];
    assert.ok(logs.some((l) => l.event === "p6.tree.failure"), "tree failure tail stamped on the project record");
    assert.ok(logs.some((l) => l.event === "p6.journey.exhausted"), "exhaustion recorded loudly");
    assert.ok(!logs.some((l) => l.event === "p6.journey.converged"), "no silent seal on exhaustion");
  });

  it("keyless → no-op passthrough: SAME project reference, byte-identical", async () => {
    const savedKey = process.env.DEEPSEEK_API_KEY;
    try {
      delete process.env.DEEPSEEK_API_KEY;
      const base = createProject({ brief: FIXTURE_BRIEF });
      const before = JSON.stringify(base);
      const res = await driveP6Journey(base);
      assert.equal(res.outcome, "keyless");
      assert.equal(res.cycles, 0);
      assert.equal(res.project, base, "same reference — byte-identical passthrough");
      assert.equal(JSON.stringify(res.project), before, "no byte changed");
      assert.equal((res.project.logs ?? []).length, (base.logs ?? []).length, "no log rows minted");
    } finally {
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
    }
  });
});

describe("C-1 repair seam — repairTreeDir's recordGreen mints before the gate (W15-L1)", () => {
  const emptyCompile = { ok: false, dir: "", checked: 0, passed: 0, failed: 1, skipped: 0, verdicts: [] };
  // The real keyed shape (same fixture discipline as the journey-seam C-1
  // test above): the tree ran its own oracle spec and it passed —
  // treeRunTestedEvidence()'s executed:true (≥1 passing spec with ≥1 assertion)
  // is the only honest mint precondition.
  const executedVerdict: TreeRunOutcome = {
    ok: true,
    dir: "",
    compile: { ...emptyCompile, ok: true, failed: 0, passed: 1, checked: 1 },
    tests: [
      { file: "tests/oracle.spec.ts", compile: "pass", run: "pass", tests: { pass: 1, fail: 0 }, detail: "1 passed" },
    ],
    run: { kind: "library", run: "skip", detail: "no entry to smoke" },
  };

  it("a green tree-run carrying an executed spec mints lastTest \"tested\" BEFORE the gate — and the returned gate reflects the mint (C-1's second seam)", async () => {
    const dir = tempDir();
    mkdirSync(join(dir, "src", "generated"), { recursive: true });
    writeFileSync(join(dir, "src", "generated", "hvac.ts"), "export const hvac = () => 1;\n");
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    const candidate: Project = {
      ...base,
      generatedTree: [
        { path: "src/generated/hvac.ts", source: "export const hvac = () => 1;", hash: "f1", attempt: 0 },
      ],
    };
    const res = await repairTreeDir(candidate, dir, { deps: { runTree: async () => executedVerdict } });
    // The re-imported dir is tree-green on the first run, but the honest P6
    // gate stays red over this fixture (the fixes/159 F4 shape) — so the run
    // FAILS, and the only question this test pins is WHERE the mint sits.
    assert.equal(res.outcome, "failed", "green tree-run + honestly-red gate is FAILED, never converged");
    assert.equal(res.cycles, 0, "cycle-0 converge check ran — no synthesis cycle");
    const lt = res.project.lastTest as { label?: string; evidenceHash?: string } | null | undefined;
    // Pre-C-1, recordGreen recorded the gate FIRST and minted only when it
    // passed — but the p6-verified probe needs the mint, so the gate could
    // never pass on a green tree-run: the same circular deadlock C-1 defused
    // in the journey seam. The mint now runs BEFORE the gate and must not be
    // silently reverted.
    assert.equal(
      lt?.label,
      "tested",
      "green tree-run with executed specs ⇒ tested-equivalent minted before the gate (C-1, repair seam)",
    );
    assert.ok((lt?.evidenceHash ?? "").length > 0, "the mint carries its evidence hash");
    assert.ok(res.gate, "the P6 gate was re-recorded after the re-import");
    assert.equal(res.gate!.passed, false, "the recorded gate is the honest one — the mint never force-greens it");
    // "The gate reflects the mint": p6-verified is satisfied by the mint that
    // PRECEDED the gate, so its criterion must NOT be unmet. If the mint ran
    // after a gate that can only pass with it (the pre-C-1 order), this is
    // exactly the criterion that shows up in `unmet`.
    assert.ok(res.gate!.unmet.length > 0, "the gate really evaluated criteria over this fixture (non-vacuous)");
    assert.ok(
      !res.gate!.unmet.some((u) => u.includes('lastTest.label === "tested"')),
      'p6-verified unmet ONLY when the gate ran before the mint (the pre-C-1 deadlock) — the mint must precede the gate',
    );
  });
});

// ---------------------------------------------------------------------------
// W45 (parent keyed findings C + D): the emitted tree's own entry barrel must
// round-trip through the repair dir seam, and a repair cycle must TARGET the
// file the tree-run names (including the generated-core LOAD shape) instead of
// silently repairing around it.
// ---------------------------------------------------------------------------
describe("W45 — emitted entry round-trips through repair; the failing file is targeted", () => {
  const emptyCompile = { ok: true, dir: "", checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [] };

  it("Finding C: src/generated.ts (the emitter's TREE_ENTRY_PATH) is imported AND written by repair", async () => {
    assert.equal(TREE_ENTRY_PATH, "src/generated.ts", "the emitter's entry path under test");
    const dir = tempDir();
    try {
      const barrel = 'export * from "./generated/chunk-0.ts";\n';
      const chunk = "export const x = 1;\n";
      mkdirSync(join(dir, "src", "generated"), { recursive: true });
      writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "roundtrip", type: "module" }), "utf8");
      writeFileSync(join(dir, TREE_ENTRY_PATH), barrel, "utf8");
      writeFileSync(join(dir, "src", "generated", "chunk-0.ts"), chunk, "utf8");
      const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
      const ledger: Project = {
        ...base,
        generatedTree: [
          { path: TREE_ENTRY_PATH, source: barrel, hash: String(fnv1a(barrel)), attempt: 0 },
          { path: "src/generated/chunk-0.ts", source: chunk, hash: String(fnv1a(chunk)), attempt: 0 },
        ],
      };
      // Read side: the entry barrel re-imports (pre-fix it was refused).
      const imported = importTreeDir(ledger, dir);
      assert.equal(imported.refused.includes(TREE_ENTRY_PATH), false, "the tree entry barrel is imported, not refused");
      assert.ok(imported.imported.includes(TREE_ENTRY_PATH), "the tree entry barrel is in the imported set");
      // Write side: a repair cycle that changes the barrel must WRITE it.
      const synth = async (p: Project): Promise<Project> => ({
        ...p,
        generatedTree: (p.generatedTree ?? []).map((r) =>
          r.path === TREE_ENTRY_PATH ? { ...r, source: `${r.source}// repaired\n` } : r,
        ),
      });
      const res = await repairTreeDir(ledger, dir, { budget: 1, deps: { synthesize: synth } });
      assert.equal(res.applied.refused.includes(TREE_ENTRY_PATH), false, "the entry barrel is never path-refused");
      assert.ok(res.applied.written.includes(TREE_ENTRY_PATH), `the repaired entry barrel is written: ${JSON.stringify(res.applied)}`);
      assert.equal(
        readFileSync(join(dir, TREE_ENTRY_PATH), "utf8"),
        `${barrel}// repaired\n`,
        "the repaired bytes land on disk",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Finding D: a tree-run that names the generated core targets it — an un-addressed file is refused, never skipped", async () => {
    const dir = tempDir();
    try {
      const flipPath = "src/jobs/flip.ts";
      const flipSrc = 'import { estimateARV } from "../generated/list-line-items.ts";\nexport async function estimateARV(id: string) { return id.length; }\n';
      const otherPath = "src/generated/create-property.ts";
      const otherSrc = "export function createProperty(id: string) { return { id }; }\n";
      const barrel = 'export * from "./generated/create-property.ts";\n';
      mkdirSync(join(dir, "src", "jobs"), { recursive: true });
      mkdirSync(join(dir, "src", "generated"), { recursive: true });
      mkdirSync(join(dir, ".rapidtool"), { recursive: true });
      writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "flip", type: "module" }), "utf8");
      writeFileSync(join(dir, "index.html"), "<!doctype html><html><body><div id=root></div></body></html>\n", "utf8");
      writeFileSync(join(dir, TREE_ENTRY_PATH), barrel, "utf8");
      writeFileSync(join(dir, otherPath), otherSrc, "utf8");
      writeFileSync(join(dir, flipPath), flipSrc, "utf8");
      writeFileSync(
        join(dir, ".rapidtool", "project.json"),
        JSON.stringify({ kind: "app", generatedSource: barrel, specGraph: { nodes: [{ id: "job-flip", file: flipPath }], order: ["job-flip"] } }),
        "utf8",
      );
      const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
      const ledger: Project = {
        ...base,
        generatedTree: [
          { path: TREE_ENTRY_PATH, source: barrel, hash: String(fnv1a(barrel)), attempt: 0 },
          { path: otherPath, source: otherSrc, hash: String(fnv1a(otherSrc)), attempt: 0 },
          { path: flipPath, source: flipSrc, hash: String(fnv1a(flipSrc)), attempt: 0 },
        ],
      };
      // Mimic the real codegen outcome: a repair that changes OTHER files but
      // leaves the file the tree-run named (the load failure) untouched.
      const seenTargets: (readonly string[] | undefined)[] = [];
      const synth = async (p: Project, ctx: { repairTargets?: readonly string[] }): Promise<Project> => {
        seenTargets.push(ctx.repairTargets);
        return {
          ...p,
          generatedTree: (p.generatedTree ?? []).map((r) =>
            r.path === otherPath ? { ...r, source: `${r.source}// cycle touch\n` } : r,
          ),
        };
      };
      const res = await repairTreeDir(ledger, dir, { budget: 2, deps: { synthesize: synth } });
      assert.equal(res.ok, false, "the tree stays red — no fabricated green verdict");
      assert.ok(seenTargets[0]?.includes(flipPath), `the directive names the load-failing file: ${JSON.stringify(seenTargets[0])}`);
      assert.ok(res.applied.written.includes(otherPath), "the cycle's other-file change landed");
      assert.equal(res.applied.written.includes(flipPath), false, "the failing file was NOT changed by this repair");
      assert.ok(res.applied.refused.includes(flipPath), `the un-addressed failing file is explicitly refused: ${JSON.stringify(res.applied)}`);
      const warn = res.applied.warnings.find((w) => w.includes(flipPath));
      assert.ok(warn && warn.includes("the repair did not target it"), `the refusal carries a reason: ${warn}`);
      assert.ok(res.events.some((e) => e.includes("failure-named file not addressed by the repair") && e.includes(flipPath)));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("treeRunFailureFiles: reads the core LOAD entry explicitly; excludes the scaffold oracle spec", () => {
    const coreFail: TreeRunOutcome = {
      ok: false,
      dir: "",
      compile: emptyCompile,
      tests: [],
      run: { kind: "ui-shell", run: "skip", detail: "UI shell — not executable headless" },
      core: { kind: "generated-core", entry: "src/jobs/flip.ts", run: "fail", detail: "SyntaxError" },
      error: "the emitted product's generated core module failed to LOAD (src/jobs/flip.ts): SyntaxError",
    };
    assert.deepEqual(treeRunFailureFiles(coreFail), ["src/jobs/flip.ts"], "the core LOAD entry is the named file");
    const specFail: TreeRunOutcome = {
      ...coreFail,
      core: undefined,
      run: { kind: "headless", entry: "src/main.ts", run: "fail", detail: "boom" },
      tests: [{ file: "tests/oracle.spec.ts", compile: "pass", run: "fail", tests: { pass: 0, fail: 1 }, detail: "x" }],
    };
    const files = treeRunFailureFiles(specFail);
    assert.ok(files.includes("src/main.ts"), "the failing entry is named");
    assert.equal(files.includes("tests/oracle.spec.ts"), false, "the scaffold-owned oracle spec is never a repair target");
  });

  it("repairCycleLiveDeps: folds repairTargets into the treeFailure directive (and only then)", () => {
    const tail = "the emitted product's generated core module failed to LOAD (src/jobs/flip.ts): SyntaxError";
    const plain = repairCycleLiveDeps({ cycle: 2, treeFailureTail: tail });
    assert.equal(plain.treeFailure, tail, "no targets ⇒ the legacy tail is byte-identical");
    const targeted = repairCycleLiveDeps({ cycle: 2, treeFailureTail: tail, repairTargets: ["src/jobs/flip.ts"] });
    assert.ok(targeted.treeFailure!.includes(tail), "the tail is preserved");
    assert.ok(targeted.treeFailure!.includes("Repair target file(s) named by the failure — fix these first:"));
    assert.ok(targeted.treeFailure!.includes("src/jobs/flip.ts"));
    assert.equal(targeted.patchRepairs, true, "the repair level is still on");
  });
});

// ---------------------------------------------------------------------------
// fixes/323 FIX-2c (window #4 item 4 · T9.3 repair-dir variant, from
// fixes/319_f3_promote §C4/§D.1): the repair arm's caller-attested dir
// promotion. repairTreeDir mints the tested stamp onto the LEDGER inside its
// own recordGreen, so promoteEmittedTreeTested's fresh-mint guard can never
// write the dir's OWN `.rapidtool/project.json` — the CLI arm instead attests
// the fresh mint from ITS OWN result (res.minted) and calls the caller-attested
// helper. Red / no-spec / un-attested / recordless paths write NOTHING.
// ---------------------------------------------------------------------------
describe("fixes/323 FIX-2c — repair arm's caller-attested dir promotion (T9.3 repair-dir variant)", () => {
  it("a fresh-minted ledger promotes the dir record; un-attested / untested / recordless calls write nothing", async () => {
    const dir = tempDir();
    mkdirSync(join(dir, ".rapidtool"), { recursive: true });
    const recordPath = join(dir, ".rapidtool", "project.json");
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    const mintedProject = {
      ...base,
      lastTest: { label: "tested", evidenceHash: "f2c0attest", checkedAt: 1 },
    } as unknown as Project;
    writeFileSync(recordPath, JSON.stringify(base, null, 2), "utf8");
    const beforeBytes = readFileSync(recordPath, "utf8");

    // The arm reaches this call only inside `if (res.ok)` with a fresh mint
    // (`res.minted === true`) — a red or no-spec run reports false: nothing.
    const off = promoteRepairedDirTested(mintedProject, dir, false);
    assert.equal(off.promoted, false);
    assert.equal(readFileSync(recordPath, "utf8"), beforeBytes, "no attestation ⇒ the record stands untouched");

    const on = promoteRepairedDirTested(mintedProject, dir, true);
    assert.equal(on.promoted, true, "the attested fresh mint promotes the dir's own record");
    const promotedBytes = readFileSync(recordPath, "utf8");
    const record = JSON.parse(promotedBytes) as Project;
    const lt = record.lastTest as { label?: string; evidenceHash?: string } | null | undefined;
    assert.equal(lt?.label, "tested", "the dir record carries the tested stamp");
    assert.equal(lt?.evidenceHash, "f2c0attest");

    const untested = promoteRepairedDirTested(base, dir, true);
    assert.equal(untested.promoted, false, "a ledger without the tested label is never stamped, even attested");
    assert.equal(readFileSync(recordPath, "utf8"), promotedBytes, "the record stands after the untested call");

    const bare = tempDir();
    const miss = promoteRepairedDirTested(mintedProject, bare, true);
    assert.equal(miss.promoted, false, "a dir with no record is never stamped");
    assert.equal(existsSync(join(bare, ".rapidtool", "project.json")), false, "and no record is fabricated into existence");
  });

  it("the REAL repair seam never attests a mint on the green-tree/red-gate shape — the arm's gate writes nothing", async () => {
    // C-1 shape re-derived over a real repairTreeDir call: the honest P6 gate
    // stays red on this fixture, so the run converges nowhere — the seam
    // returns minted:false BY DESIGN (recordGreen: "tree-green + red gate is
    // FAILED, never ok:true / minted tested"), and the dir record must stand
    // exactly as it was (the red path promotes nothing).
    const dir = tempDir();
    mkdirSync(join(dir, ".rapidtool"), { recursive: true });
    mkdirSync(join(dir, "src", "generated"), { recursive: true });
    writeFileSync(join(dir, "src", "generated", "hvac.ts"), "export const hvac = () => 1;\n");
    const recordPath = join(dir, ".rapidtool", "project.json");
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    writeFileSync(recordPath, JSON.stringify(base, null, 2), "utf8");
    const beforeBytes = readFileSync(recordPath, "utf8");
    const executedVerdict: TreeRunOutcome = {
      ok: true,
      dir: "",
      compile: { ok: true, dir: "", checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [] },
      tests: [
        { file: "tests/oracle.spec.ts", compile: "pass", run: "pass", tests: { pass: 1, fail: 0 }, detail: "1 passed" },
      ],
      run: { kind: "library", run: "skip", detail: "no entry to smoke" },
    };
    const candidate: Project = {
      ...base,
      generatedTree: [
        { path: "src/generated/hvac.ts", source: "export const hvac = () => 1;", hash: "f1", attempt: 0 },
      ],
    };
    const res = await repairTreeDir(candidate, dir, { deps: { runTree: async () => executedVerdict } });
    // Read the gate + attestation BEFORE the asserts (assert.equal narrows the
    // fields, which would make the verbatim `res.minted === true` a dead,
    // TS2367-flagged comparison).
    const armGateOpen = res.ok === true;
    const attestedMint = res.minted === true;
    assert.equal(res.ok, false, "precondition: the honest P6 gate stays red here — no convergence (C-1 shape)");
    assert.equal(
      res.minted,
      false,
      "the seam never attests a mint on the green-tree/red-gate shape (that shape is FAILED by design), so the arm's attestation is absent and no promotion can ride it",
    );
    // The CLI arm's promotion expression, reproduced (reached only under
    // `if (res.ok)` with the minted attestation).
    const promoted = armGateOpen ? promoteRepairedDirTested(res.project, dir, attestedMint) : { promoted: false };
    assert.equal(promoted.promoted, false, "a red-gate repair never promotes the dir record");
    assert.equal(readFileSync(recordPath, "utf8"), beforeBytes, "the record stands exactly as it was");
  });
});

describe("fixes/153 (P2) — the refusal→next-cycle loop: cycle N+1 knows cycle N's refusal", () => {
  const emptyCompile = { ok: false, dir: "", checked: 0, passed: 0, failed: 1, skipped: 0, verdicts: [] };
  const redVerdict = (file: string, detail: string): TreeRunOutcome => ({
    ok: false,
    dir: "",
    compile: emptyCompile,
    tests: [{ file, compile: "pass", tests: { pass: 0, fail: 1 }, run: "fail", detail }],
    run: null,
  });
  const greenVerdict: TreeRunOutcome = {
    ok: true,
    dir: "",
    compile: { ...emptyCompile, ok: true, failed: 0, passed: 1, checked: 1 },
    tests: [],
    run: { kind: "library", run: "skip", detail: "no entry to smoke" },
  };
  /** The synthesized shape a real keyed cycle would leave: a generatedTree +
   *  the (complete) P6 record, so the driver's honest recordGateInto runs. */
  function withTree(base: Project): Project {
    return {
      ...base,
      generatedTree: [{ path: "src/generated.ts", source: "export const hvac = () => 1;", hash: "f1", attempt: 0 }],
    };
  }
  /** fixes/159 (F4): a green-gate recorder fake — this describe tests the
   *  refusal→context loop, NOT the DoD probes; a red real-seam gate would now
   *  (correctly) fail the journey before the convergence assertions. */
  const greenGateRecord = (p: Project): Project => ({
    ...p,
    phases: (p.phases ?? []).map((ph) =>
      ph.id === 6
        ? { ...ph, gate: { passed: true, unmet: [], evidenceHash: "159f4c0de", checkedAt: 1 } }
        : ph,
    ),
  });
  /** A refused keyed synthesis: the deterministic floor + codegen's honest
   *  refusal log (codegen.server refuse() parity — `RT_E code · reason`,
   *  phase 6). The driver's p6RefusalDetail reads exactly this row. */
  function refusedSynthesis(base: Project, code: string, reason: string): Project {
    return {
      ...base,
      logs: [
        ...(base.logs ?? []),
        {
          ts: Date.now(),
          phase: 6 as PhaseId,
          level: "warn" as const,
          event: "p6.synthesis.refused",
          detail: `${code} · ${reason}`,
        },
      ].slice(-200),
    };
  }

  it("refused cycle 1 → cycle 2 synthesis deps carry the bounded refusal context", async () => {
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    const seen: { cycle: number; refusal?: string; tail?: string }[] = [];
    const synthesize = async (p: Project, ctx: P6JourneyCycleContext): Promise<Project> => {
      seen.push({ cycle: ctx.cycle, refusal: ctx.refusal, tail: ctx.treeFailureTail });
      if (ctx.cycle === 1) {
        return refusedSynthesis(p, "RT_E_LLM_REJECTED", "model refused the multi-file tree brief: returned a stub only");
      }
      return withTree(p);
    };
    const res = await driveP6Journey(base, {
      budget: 2,
      // fixes/159 (F4): the gate recorder is faked green so this describe can
      // keep asserting the refusal→recovery CONVERGENCE it exists to test —
      // under the honest semantics a green tree-run alone no longer converges.
      deps: { synthesize, runTree: async () => greenVerdict, recordGate: greenGateRecord },
    });
    assert.equal(res.outcome, "converged", "cycle 2 recovers from cycle-1 refusal and converges (green tree + green gate)");
    assert.equal(res.cycles, 2);
    // Cycle 2 KNOWS cycle 1 refused: ctx carries the refusal detail…
    assert.equal(seen[1]!.cycle, 2);
    assert.ok(
      seen[1]!.refusal!.includes("RT_E_LLM_REJECTED") && seen[1]!.refusal!.includes("model refused the multi-file tree brief"),
      "cycle 2 ctx carries cycle-1's refusal class + reason",
    );
    // …and the single ctx→deps mapping delivers it as the bounded
    // deps.synthesisRefusal the next synthesis call hands liveLayer/codegen.
    const deps = p6CycleLiveDeps({ cycle: 2, refusal: seen[1]!.refusal });
    assert.ok(deps && typeof deps.synthesisRefusal === "string", "refusal ctx maps onto deps.synthesisRefusal");
    assert.ok(deps!.synthesisRefusal!.includes("RT_E_LLM_REJECTED"), "dep carries the refusal class");
    assert.ok(deps!.synthesisRefusal!.includes("model refused the multi-file tree brief"), "dep carries the model's reason");
    assert.ok(deps!.synthesisRefusal!.length <= 200, "dep is bounded to ~200 chars");
    // The result keeps the refusal evidence too.
    assert.ok(res.refusal!.includes("RT_E_LLM_REJECTED"));
  });

  it("p6CycleLiveDeps: no prior cycle → undefined; tree-failure-only → exactly {treeFailure} (byte-identical)", () => {
    // Cycle 1 (no prior evidence) → undefined → the legacy byte-identical
    // liveLayer(p, 6) call.
    assert.equal(p6CycleLiveDeps({ cycle: 1 }), undefined, "cycle 1 has no prior refusal/tail");
    assert.equal(p6CycleLiveDeps({ cycle: 2, refusal: "" }), undefined, "empty refusal is no refusal");
    // Tree-failure-only ctx → byte-identical to fixes/147: { treeFailure }
    // with NO synthesisRefusal key.
    const tail = "src/api/board.spec.ts: fail — expected dispatchBoard to exist";
    const deps = p6CycleLiveDeps({ cycle: 2, treeFailureTail: tail });
    assert.deepEqual(deps, { treeFailure: tail }, "tree-failure-only mapping unchanged");
    assert.deepEqual(Object.keys(deps!), ["treeFailure"], "no synthesisRefusal key on a tree-failure-only cycle");
    // Refusal-only ctx (e.g. a refused synthesis that never tree-ran) →
    // { synthesisRefusal } only — the refusal mirror channel.
    const refusal = `RT_E_LLM_REJECTED · ${"model refused ".repeat(40)}`;
    const rdeps = p6CycleLiveDeps({ cycle: 2, refusal });
    assert.deepEqual(Object.keys(rdeps!), ["synthesisRefusal"]);
    assert.equal(
      rdeps!.synthesisRefusal!.length,
      refusal.length,
      "a refusal under the cap rides whole (339 wave raised the cap 200 → 1200)",
    );
    // Over-cap refusal: bounded to the 1200-char cap, never the whole reason.
    const longRefusal = `RT_E_LLM_REJECTED · ${"model refused ".repeat(200)}`;
    const lrdeps = p6CycleLiveDeps({ cycle: 2, refusal: longRefusal });
    assert.equal(
      lrdeps!.synthesisRefusal!.length,
      1200,
      "bounded to the 1200-char refusal cap",
    );
    // Both evidence kinds ride together when both exist.
    const both = p6CycleLiveDeps({ cycle: 3, treeFailureTail: tail, refusal });
    assert.deepEqual(Object.keys(both!).sort(), ["synthesisRefusal", "treeFailure"]);
  });

  it("p6CycleLiveDeps (fixes/326 F1b): gateRepair-only → exactly {gateRepair}; all-three keys; ~700 cap; absent ctx keeps the legacy key-sets", () => {
    // Absent gateRepair: the fixes/153 key-sets above stay EXACTLY as they
    // were — the additive field materializes no key (byte-identity guard).
    const tail = "src/api/board.spec.ts: fail — expected dispatchBoard to exist";
    assert.deepEqual(Object.keys(p6CycleLiveDeps({ cycle: 2, treeFailureTail: tail })!), ["treeFailure"]);
    assert.deepEqual(
      Object.keys(p6CycleLiveDeps({ cycle: 2, refusal: "RT_E_LLM_REJECTED · nope" })!),
      ["synthesisRefusal"],
      "refusal-only ctx materializes no gateRepair key",
    );
    // Gate-repair-only ctx → { gateRepair } only.
    const gateRepair = "P6 DoD unmet: p6-brief-fit | Recorded missing requirements: missing: track, drag, drop, persist";
    const g = p6CycleLiveDeps({ cycle: 2, gateRepair });
    assert.deepEqual(Object.keys(g!), ["gateRepair"]);
    assert.equal(g!.gateRepair, gateRepair);
    // All three evidence kinds ride together.
    const all = p6CycleLiveDeps({ cycle: 3, treeFailureTail: tail, refusal: "RT_E_LLM_REJECTED · nope", gateRepair });
    assert.deepEqual(Object.keys(all!).sort(), ["gateRepair", "synthesisRefusal", "treeFailure"]);
    // Bounded to the 700-char gate-repair cap (the refusal-cap discipline).
    const capped = p6CycleLiveDeps({ cycle: 2, gateRepair: "x".repeat(900) });
    assert.equal(capped!.gateRepair!.length, 700, "gate-repair context is bounded to 700 chars");
    // Empty gateRepair is no gateRepair at all.
    assert.equal(p6CycleLiveDeps({ cycle: 2, gateRepair: "" }), undefined);
  });

  it("tree-failure-only journey → no refusal context reaches cycle 2 (driver byte-identity)", async () => {
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    const refusalsSeen: (string | undefined)[] = [];
    const synthesize = async (p: Project, ctx: P6JourneyCycleContext): Promise<Project> => {
      refusalsSeen.push(ctx.refusal);
      return withTree(p);
    };
    const alwaysRed = redVerdict("src/api/board.spec.ts", "dispatchBoard never converges");
    const res = await driveP6Journey(base, { budget: 2, deps: { synthesize, runTree: async () => alwaysRed } });
    assert.equal(res.outcome, "failed");
    assert.equal(refusalsSeen.length, 2);
    assert.ok(
      refusalsSeen.every((r) => r === undefined),
      "pure tree-failure cycles carry no refusal context — byte-identical to pre-153",
    );
    assert.equal(res.refusal, null, "no refusal recorded");
    assert.ok(
      (res.project.logs ?? []).every((l) => l.event !== "p6.synthesis.refused"),
      "no refusal log minted on the record",
    );
  });

  it("budget exhaustion after refusals → the FAILED verdict names the LAST refusal text", async () => {
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    const synthesize = async (p: Project, ctx: P6JourneyCycleContext): Promise<Project> =>
      refusedSynthesis(p, "RT_E_LLM_REJECTED", `refusal reason #${ctx.cycle}: model cannot proceed`);
    const res = await driveP6Journey(base, { budget: 3, deps: { synthesize, runTree: async () => greenVerdict } });
    assert.equal(res.outcome, "failed");
    assert.equal(res.cycles, 3, "all 3 cycles refused — budget burned entirely");
    // result.refusal = the LAST refusal (cycle 3's reason), never cycle 1's.
    assert.ok(res.refusal!.includes("refusal reason #3"), "result.refusal names the last refusal");
    // p6.journey.exhausted log names the last refusal text.
    const exhausted = (res.project.logs ?? []).filter((l) => l.event === "p6.journey.exhausted");
    assert.equal(exhausted.length, 1);
    assert.ok(exhausted[0]!.detail.includes("refusal reason #3"), "exhausted log names the last refusal");
    // events trail names it too (the caller/eval-visible verdict).
    assert.ok(
      res.events.some((e) => e.includes("last refusal") && e.includes("refusal reason #3")),
      "events trail names the last refusal",
    );
    // No tree ever ran — the no-tree branch folds the refusal into the tail
    // channel (ctx doc: tree-run failure tail "(or refusal)"), so the last
    // refusal text is ALSO the outstanding tail evidence on the result.
    assert.ok(res.treeTail!.includes("refusal reason #3"), "no-tree refusal rides the tail channel as the outstanding evidence");
  });
});

// ---------------------------------------------------------------------------
// T4 (112 §4.4 / 216g) — the caller's cross-project proven lesson rows ride the
// journey: run opts → driveP6Journey ctx → p6CycleLiveDeps → engine LiveLayerDeps
// → codegen lesson sites. Absent/empty ⇒ ctx carries NO proven key and every
// downstream call is byte-identical to pre-330.
// ---------------------------------------------------------------------------
describe("T4 · 112 §4.4 — the caller's proven lesson rows thread into every cycle ctx", () => {
  const PROVEN: readonly RankableLessonRow[] = [
    {
      id: "proven-K1deadbeef",
      kind: "semantic",
      phase: 0,
      text: "MARKER_PROVEN: a prior accepted run shipped a board that dropped the empty-column rejection guard — keep it.",
      score: 0.95,
      source: "research",
      tags: ["lesson"],
    },
  ];
  const redVerdict = (): TreeRunOutcome => ({
    ok: false,
    dir: "",
    compile: { ok: false, dir: "", checked: 0, passed: 0, failed: 1, skipped: 0, verdicts: [] },
    tests: [{ file: "src/api/board.spec.ts", compile: "pass", tests: { pass: 0, fail: 1 }, run: "fail", detail: "never converges" }],
    run: null,
  });

  it("p6CycleLiveDeps: proven-only → exactly {proven}; absent/empty materialize NO key (byte-identity)", () => {
    assert.equal(p6CycleLiveDeps({ cycle: 1 }), undefined, "no context → undefined (legacy call)");
    assert.equal(p6CycleLiveDeps({ cycle: 1, proven: [] }), undefined, "empty proven is no proven at all");
    const d = p6CycleLiveDeps({ cycle: 1, proven: PROVEN });
    assert.deepEqual(Object.keys(d!), ["proven"], "proven-only ctx materializes only the proven key");
    assert.equal(d!.proven, PROVEN, "the rows are carried verbatim (same reference)");
    // The four-key combination keeps every prior channel intact + adds proven.
    const all = p6CycleLiveDeps({
      cycle: 3,
      treeFailureTail: "src/api/board.spec.ts: fail — x",
      refusal: "RT_E_LLM_REJECTED · nope",
      gateRepair: "P6 DoD unmet: p6-brief-fit",
      proven: PROVEN,
    });
    assert.deepEqual(Object.keys(all!).sort(), ["gateRepair", "proven", "synthesisRefusal", "treeFailure"]);
    // The repair mapping (spread) carries proven too, with patchRepairs on.
    const r = repairCycleLiveDeps({ cycle: 2, proven: PROVEN });
    assert.equal(r.proven, PROVEN, "repairCycleLiveDeps spreads proven through");
    assert.equal(r.patchRepairs, true);
  });

  it("driveP6Journey: opts.proven lands on every cycle ctx; absent leaves ctx.proven undefined", async () => {
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    const withTree = (p: Project): Project => ({
      ...p,
      generatedTree: [{ path: "src/generated.ts", source: "export const hvac = () => 1;", hash: "f1", attempt: 0 }],
    });
    const seen: (readonly RankableLessonRow[] | undefined)[] = [];
    const synthesize = async (p: Project, ctx: P6JourneyCycleContext): Promise<Project> => {
      seen.push(ctx.proven);
      return withTree(p);
    };
    const res = await driveP6Journey(base, {
      budget: 2,
      deps: { synthesize, runTree: async () => redVerdict() },
      proven: PROVEN,
    });
    assert.equal(res.outcome, "failed");
    assert.equal(seen.length, 2, "both budgeted cycles ran");
    assert.equal(seen[0], PROVEN, "cycle 1 ctx carries the caller's rows");
    assert.equal(seen[1], PROVEN, "cycle 2 ctx carries them again (constant across the journey)");
    // Control: no proven supplied ⇒ ctx carries NO key on any cycle.
    const bare: (readonly RankableLessonRow[] | undefined)[] = [];
    const synthesizeBare = async (p: Project, ctx: P6JourneyCycleContext): Promise<Project> => {
      bare.push(ctx.proven);
      return withTree(p);
    };
    await driveP6Journey(base, { budget: 2, deps: { synthesize: synthesizeBare, runTree: async () => redVerdict() } });
    assert.deepEqual(bare, [undefined, undefined], "absent proven ⇒ ctx.proven stays undefined (byte-identical journey)");
  });
});

// ---------------------------------------------------------------------------
// 216 (T-18) — the tree-run failure tail names a red PROJECT SCRIPT. A tree
// can be red ONLY because its own declared `npm test` failed while every spec
// leg passed; the next cycle's repair context must name that, not chase a
// spec that passed. (The real tail is produced by compile-check treeRun's
// `project` verdict; this pins the headless threading of it.)
// ---------------------------------------------------------------------------
describe("216 (T-18) — a red project-script verdict is named in the journey tail", () => {
  it("the next cycle's failure context names `npm run test` when every spec leg is green", async () => {
    const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
    const tails: (string | undefined)[] = [];
    const withTree = (p: Project): Project => ({
      ...p,
      generatedTree: [{ path: "src/generated.ts", source: "export const x = 1;", hash: "f1", attempt: 0 }],
    });
    // Every spec leg green; the emitted project's OWN declared test ran red.
    const redProjectOnly: TreeRunOutcome = {
      ok: false,
      dir: "",
      compile: { ok: true, dir: "", checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [] },
      tests: [{ file: "tests/oracle.spec.ts", compile: "pass", tests: { pass: 2, fail: 0 }, run: "pass" }],
      run: { kind: "ui-shell", run: "skip", detail: "UI shell — not executable headless" },
      project: {
        ok: false,
        typecheck: { script: "typecheck", run: "skip", note: "declared tool `tsc` has no node_modules/.bin entry" },
        test: { script: "test", command: "node --test tests/oracle.spec.ts", run: "fail", exitCode: 1, detail: "1 test failed" },
      },
    };
    const synthesize = async (p: Project, ctx: P6JourneyCycleContext): Promise<Project> => {
      tails.push(ctx.treeFailureTail);
      return withTree(p);
    };
    const res = await driveP6Journey(base, {
      budget: 2,
      deps: { synthesize, runTree: async () => redProjectOnly },
    });
    assert.equal(res.outcome, "failed", "a red project script can never converge the journey");
    assert.equal(tails.length, 2);
    assert.equal(tails[0], undefined, "cycle 1 starts with no failure context");
    assert.ok(
      tails[1] && tails[1]!.includes("npm run test"),
      `cycle 2's context names the red project script: ${tails[1]}`,
    );
    assert.ok(tails[1]!.includes("fail"), "the verdict class rides the tail");
  });
});

describe("end-to-end round-trip", () => {
  it("create → save → load → drain to complete → export → re-import", async () => {
    const dir = tempDir();
    try {
      const path = join(dir, "build.json");
      const created = createProject({ brief: FIXTURE_BRIEF, name: "HVAC Dispatch" });
      saveProject(path, created);

      const reloaded = loadProject(path);
      assert.equal(reloaded.id, created.id);

      const done = await drainToComplete(reloaded);
      assert.equal(done.status, "complete");
      assert.equal(done.currentPhase, 12);
      assert.equal(done.phases.filter((r) => r.status === "complete").length, 13);

      saveProject(path, done);
      const exported = exportJson(loadProject(path));
      const res = importProject(exported);
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.project.status, "complete");
        assert.equal(res.project.packet.length > 0, true);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("E-02 — DoD gate parity on headless paths (recordGateInto)", () => {
  it("records gate field + gate artifact + verdict log for every deterministic phase", async () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const res = await runUntilGate(p); // parks at the first stock HITL gate (P4)
    const proj = res.project;
    assert.equal(proj.status, "awaiting_hitl");
    assert.equal(proj.currentPhase, 4);
    for (const id of [0, 1, 2, 3]) {
      const rec = proj.phases.find((r) => r.id === id);
      assert.ok(rec?.gate, `P${id} should carry a recorded gate`);
      assert.equal(rec?.gate?.passed, true, `P${id} deterministic DoD should pass`);
      assert.ok((rec?.gate?.evidenceHash?.length ?? 0) > 0, `P${id} evidence hash`);
      assert.ok(proj.artifacts.some((a) => a.kind === "gate" && a.phase === id), `P${id} gate artifact`);
    }
    assert.ok(proj.logs.filter((l) => l.event === "gate.verdict").length >= 4);
    // The recorded verdict is content-addressed: replaying runGate over the
    // same project must reproduce the exact evidenceHash (no drift).
    assert.equal(
      proj.phases.find((r) => r.id === 0)?.gate?.evidenceHash,
      runGate(proj, 0).evidenceHash,
    );
  });

  it("records a gate for a human-approved HITL phase (approve parity)", async () => {
    let p = createProject({ brief: FIXTURE_BRIEF });
    p = (await runUntilGate(p)).project; // parked at P4, gate NOT yet recorded
    // M7-01 (fixes/310): unrecorded gate = birth-stamped `null` (was the
    // pre-stamp `undefined` sentinel); still "not yet recorded".
    assert.equal(p.phases.find((r) => r.id === 4)?.gate ?? null, null);
    const before = p.logs.length;
    p = approve(p);
    const rec = p.phases.find((r) => r.id === 4);
    assert.ok(rec?.gate, "approved phase must carry a recorded gate");
    assert.equal(rec?.gate?.passed, true);
    assert.ok(p.artifacts.some((a) => a.kind === "gate" && a.phase === 4), "P4 gate artifact");
    assert.ok(p.logs.slice(before).some((l) => l.event === "gate.verdict"), "P4 verdict log");
  });

  it("autopilot approvals of non-stock gates also record the verdict", async () => {
    const p = parkAt(createProject({ brief: FIXTURE_BRIEF }), 3);
    const res = await runUntilGate(p, { autopilot: true, maxSteps: 1 });
    const rec = res.project.phases.find((r) => r.id === 3);
    assert.ok(rec?.gate, "autopilot-approved phase must carry a recorded gate");
    assert.ok(res.project.artifacts.some((a) => a.kind === "gate" && a.phase === 3));
    assert.equal(res.project.decisions.at(-1)?.decidedBy, "autopilot");
  });
});

describe("E-10 — phase-checked ingest", () => {
  it("rejects a report about a non-current phase with the mismatch message + trail", async () => {
    let p = createProject({ brief: FIXTURE_BRIEF });
    p = (await runUntilGate(p)).project; // parked at P4 (currentPhase 4)
    let caught: unknown = null;
    try {
      ingest(p, { phase: 3, status: "complete", summary: "Stale-edge claim." });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof Error, "wrong-phase report must throw");
    assert.match(
      (caught as Error).message,
      /Report phase 3 does not match the current phase 4/,
    );
    const withProject = caught as Error & { project?: Project };
    assert.ok(withProject.project, "rejection error must carry the trail project");
    assert.ok(
      (withProject.project?.logs ?? []).some(
        (l) => l.event === "report.rejected" && l.level === "warn",
      ),
      "rejection trail log must be present on the carried project",
    );
    // The caller's original project is untouched (no partial application).
    assert.equal(p.logs.some((l) => l.event === "report.rejected"), false);
    assert.equal(p.artifacts.some((a) => a.id.startsWith("report-")), false);
  });
});

describe("E-06 — applyVerifyOutcome persistence", () => {
  const passedOutcome = {
    status: "passed" as const,
    iterations: 2,
    evidence: "3/3 machine-run cases passed on iteration 2",
    finalSource: "export const add = (a, b) => a + b;",
    cases: [{ id: "case-1", expression: "add(2, 3) === 5" }],
  };

  it("passed stamps a machine-tested lastTest + verify artifact + verify.pass log", () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const q = applyVerifyOutcome(p, passedOutcome);
    const lt = q.lastTest as {
      ok: boolean;
      detail: string;
      label?: string;
      evidenceHash?: string;
    } | null;
    assert.ok(lt, "lastTest must be stamped");
    assert.equal(lt.ok, true);
    assert.equal(lt.detail, passedOutcome.evidence);
    assert.equal(lt.label, "tested");
    assert.ok((lt.evidenceHash?.length ?? 0) > 0, "evidence hash must be set");
    const artifact = q.artifacts.find((a) => (a as { kind: string }).kind === "verify");
    assert.ok(artifact, "verify artifact must be appended");
    assert.ok(artifact.title.includes("passed"), artifact.title);
    assert.ok(artifact.body.includes(passedOutcome.evidence), "artifact carries evidence");
    assert.ok(artifact.body.includes("case-1"), "artifact lists the machine-run cases");
    assert.ok(artifact.body.includes("Iterations: 2"), "artifact records iterations");
    assert.ok(q.logs.some((l) => l.event === "verify.pass"));
    assert.equal(q.logs.some((l) => l.event === "verify.fail"), false);
  });

  it("failed never mints a tested label; appends verify.fail artifact + log", () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const q = applyVerifyOutcome(p, {
      status: "failed",
      iterations: 3,
      evidence: "machine-run cases still failing after 3 iterations: case-1: false",
      finalSource: "export const add = (a, b) => a + b;",
    });
    assert.equal(q.lastTest, p.lastTest, "no label minted on a failed verdict");
    const artifact = q.artifacts.find((a) => (a as { kind: string }).kind === "verify");
    assert.ok(artifact, "verify.fail artifact must be appended");
    assert.ok(artifact.title.includes("failed"), artifact.title);
    assert.ok(q.logs.some((l) => l.event === "verify.fail"));
    assert.equal(q.logs.some((l) => l.event === "verify.pass"), false);
  });

  it("not-configured changes nothing (same project reference)", () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const q = applyVerifyOutcome(p, {
      status: "not-configured",
      iterations: 0,
      evidence: "no DEEPSEEK_API_KEY server-side",
    });
    assert.equal(q, p);
  });
});

describe("E-12 — runPhase live delegation keeps the deterministic floor bare-Node", () => {
  it("live:true on a non-research phase equals the deterministic result (no network)", async () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const live = await runPhase(p, 1, { live: true });
    const plain = await runPhase(p, 1);
    // engine.liveLayer cannot reach its server-fn backends under bare Node, so
    // the live branch must resolve to exactly the deterministic floor — same
    // artifact set, no research corpus, phase completed.
    assert.equal(live.phases.find((r) => r.id === 1)?.status, "complete");
    assert.equal(live.artifacts.length, plain.artifacts.length);
    assert.equal(live.artifacts.filter((a) => a.kind === "research").length, 0);
    assert.equal(live.research?.length ?? 0, 0);
    assert.equal(live.phases.find((r) => r.id === 1)?.status, plain.phases.find((r) => r.id === 1)?.status);
  });
});

// ---------------------------------------------------------------------------
// E-25 — CLI machine contract, exercised through real child processes (the
// CLI's own test harness lives here because headless.test.ts owns the suite;
// npm test globs src/lib/*.test.ts, see E-05).
// ---------------------------------------------------------------------------
const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const CLI_ENTRY = join(REPO_ROOT, "scripts", "rapidtool-cli.mjs");

function runCli(
  args: string[],
  opts: { input?: string; env?: Record<string, string | undefined> } = {},
): { code: number; json: Record<string, unknown>; stderr: string } {
  // CLI children must see a real terminal env, never the suite's test-runner
  // context: node:test sets NODE_TEST_CONTEXT=child-v8 on its child processes,
  // and a process carrying it silently disables any NESTED `node --test`
  // runner it spawns (the nested runner reports into the runner's IPC instead
  // of stdout — status 0, no TAP). The CLI's `emit --run` executes emitted
  // specs via exactly such a nested runner (compile-check.server.ts treeRun),
  // so a leaked child-v8 would fake-green a red tree. Delete it like a real
  // shell would never have it.
  const cliEnv: Record<string, string | undefined> = {
    ...process.env,
    DEEPSEEK_API_KEY: "",
    TAVILY_API_KEY: "",
    ...(opts.env ?? {}),
  };
  delete cliEnv.NODE_TEST_CONTEXT;
  const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_ENTRY, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    input: opts.input,
    env: cliEnv,
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(res.error, undefined, `CLI spawn failed: ${res.error?.message ?? ""}`);
  const text = (res.stdout ?? "").trim();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    assert.fail(`CLI stdout is not a single JSON object: ${text.slice(0, 400)}`);
  }
  return { code: res.status ?? -1, json, stderr: res.stderr ?? "" };
}

describe("E-25 — CLI machine contract (exit codes + envelope + doctor)", () => {
  it("usage errors exit 1 with the envelope (schema_version/cmd/exit_code)", () => {
    for (const args of [[], ["frobnicate"]]) {
      const r = runCli(args);
      assert.equal(r.code, 1);
      assert.equal(r.json.schema_version, 1);
      assert.equal(r.json.cmd, args[0] ?? null);
      assert.equal(r.json.exit_code, 1);
      assert.equal(r.json.ok, false);
      assert.ok(typeof r.json.error === "string" && r.json.error.length > 0);
    }
  });

  it("create exits 0; gate parks at a stock HITL gate → exit 2 with gates recorded", async () => {
    const dir = tempDir();
    try {
      const path = join(dir, "proj.json");
      const created = runCli([
        "create",
        "--brief",
        "Build a field-service dispatch board for HVAC.",
        "--name",
        "HVAC Dispatch",
        "--out",
        path,
      ]);
      assert.equal(created.code, 0);
      assert.equal(created.json.ok, true);
      assert.equal(created.json.cmd, "create");
      assert.equal(created.json.exit_code, 0);
      assert.equal(created.json.schema_version, 1);

      const gated = runCli(["gate", "--project", path]);
      assert.equal(gated.code, 2, "parked awaiting human → exit 2");
      assert.equal(gated.json.ok, true);
      assert.equal(gated.json.stopped, true);
      assert.equal((gated.json.summary as { status: string }).status, "awaiting_hitl");
      assert.equal(gated.json.exit_code, 2);

      // E-02 through the real CLI: every deterministic phase carries a gate.
      const proj = loadProject(path);
      for (const id of [0, 1, 2, 3]) {
        assert.ok(proj.phases.find((r) => r.id === id)?.gate, `P${id} gate recorded in file`);
      }
      assert.ok(proj.artifacts.some((a) => a.kind === "gate" && a.phase === 3));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("verify: no generatedSource → 1; generatedSource without a key → 3 (not-configured)", async () => {
    const dir = tempDir();
    try {
      const emptyPath = join(dir, "empty.json");
      saveProject(emptyPath, createProject({ brief: FIXTURE_BRIEF }));
      const r1 = runCli(["verify", "--project", emptyPath]);
      assert.equal(r1.code, 1);
      assert.ok(/no generatedSource/.test(String(r1.json.error)));

      const drainedPath = join(dir, "drained.json");
      saveProject(drainedPath, await drainToComplete(createProject({ brief: FIXTURE_BRIEF })));
      const r2 = runCli(["verify", "--project", drainedPath, "--apply"]);
      assert.equal(r2.code, 3, "not-configured → exit 3");
      assert.equal(r2.json.status, "not-configured");
      assert.equal(r2.json.applied, false, "not-configured must never write the project");
      // File untouched: still carries no verify artifact.
      const after = loadProject(drainedPath);
      assert.equal(after.artifacts.some((a) => a.id.startsWith("verify-")), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emit --run: treeRun{compile,tests,run} rides the envelope; a fresh tree is VERIFIED and exits 0 (fixes/147 E-15 / 338-2)", async () => {
    const dir = tempDir();
    try {
      const path = join(dir, "drained.json");
      const drained = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
      assert.equal(drained.status, "complete", "drain must complete so the scaffold emits a full tree");
      saveProject(path, drained);
      const out = join(dir, "tree");
      const r = runCli(["emit", "--project", path, "--out", out, "--run"]);
      // 338-2 (W52) SUPERSEDED the W48/W49 "a fresh tree is ALWAYS unverified"
      // premise. The tree-run now resolves the declared tools (the tree's own
      // node_modules, else the emitting repo's installed root) and runs them,
      // and the floor template is type-clean — so a fresh emitted tree is GREEN
      // and VERIFIED (`declaredScriptsVerified:true`, no `unverified` flag). The
      // W49 · 335-4 opt-in exit-5 arm still exists for a tree whose declared
      // tool genuinely cannot resolve; its teeth are re-pinned below by
      // CONSTRUCTING that condition on the read-only `tree-run` verb.
      assert.equal(
        r.code,
        0,
        `a verified green tree is a default pass; stderr: ${r.stderr.slice(0, 300)}`,
      );
      assert.equal(r.json.ok, true, "the tree is green — nothing ran red");
      assert.equal(r.json.declaredScriptsVerified, true, "338-2: the declared typecheck/build genuinely ran and passed");
      assert.notEqual(r.json.unverified, true, "a verified tree carries no unverified flag");
      assert.equal(r.json.unverifiedDeclaredScripts, undefined, "nothing declared was left unrun");
      assert.equal(r.json.code, undefined, "a green tree exit is not an error class — no RT_E code rides it");
      const tr = r.json.treeRun as
        | {
            ok: boolean;
            compile: { ok: boolean; checked: number; failed: number };
            tests: { file: string; run: string; tests: { pass: number; fail: number }; detail?: string }[];
            run: { run: string; detail?: string } | null;
          }
        | undefined;
      assert.ok(tr, "payload.treeRun must ride the emit envelope");
      assert.equal(tr!.compile.ok, true, "every emitted file parses");
      assert.ok(tr!.compile.checked > 0, "compile verdicts carried");
      // fixes/147 E-1: the canonical TODO(E-15) stub markers make the emitted
      // oracle reject-rows PASS — the deterministic floor's honest suite is
      // green end-to-end (specs that assert real template behavior pass).
      assert.equal(tr!.ok, true, "treeRun agrees the tree is green");
      assert.ok(tr!.tests.length > 0, "emitted specs executed");
      assert.ok(tr!.tests.every((t) => t.run === "pass"), "all emitted specs pass after the E-15 fix");
      assert.ok(tr!.run, "kind-entry verdict present");
      assert.equal(tr!.run!.run, "skip", "webapp UI shell is an honest skip, never a fake pass");
      assert.match(String(tr!.run!.detail ?? ""), /UI shell/);

      // A VERIFIED tree stays exit 0 under --require-verified (nothing to gate).
      const strictVerified = runCli([
        "emit",
        "--project",
        path,
        "--out",
        `${out}-strict`,
        "--run",
        "--require-verified",
      ]);
      assert.equal(
        strictVerified.code,
        0,
        `--require-verified stays 0 on a verified tree; stderr: ${strictVerified.stderr.slice(0, 300)}`,
      );

      // W49 · 335-4 TEETH: construct the genuine unverified condition — one
      // DECLARED script points at a tool no node_modules/.bin provides — on the
      // read-only `tree-run` verb (`emit` re-emits and would overwrite the edit).
      const pkgPath = join(out, "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { scripts?: Record<string, string> };
      pkg.scripts = { ...pkg.scripts, typecheck: "rapidtool-not-a-real-tool-338 --noEmit" };
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

      const unv = runCli(["tree-run", "--dir", out]);
      assert.equal(unv.code, 0, `a green-but-unverified tree defaults to exit 0; stderr: ${unv.stderr.slice(0, 300)}`);
      assert.equal(unv.json.declaredScriptsVerified, false, "the declared tool did not resolve/run");
      assert.equal(unv.json.unverified, true, "the envelope names the unverified toolchain");
      assert.ok(
        Array.isArray(unv.json.unverifiedDeclaredScripts) &&
          (unv.json.unverifiedDeclaredScripts as string[]).includes("typecheck"),
        `unverifiedDeclaredScripts must name the unrun declared script, saw ${JSON.stringify(
          unv.json.unverifiedDeclaredScripts,
        )}`,
      );

      const strict = runCli(["tree-run", "--dir", out, "--require-verified"]);
      assert.equal(
        strict.code,
        5,
        `--require-verified must make the genuinely-unverified tree exit 5; stderr: ${strict.stderr.slice(0, 300)}`,
      );
      assert.equal(strict.json.ok, true, "the strict arm is still a green tree");
      assert.equal(strict.json.unverified, true, "the strict arm still names the unverified toolchain");
      assert.equal(strict.json.code, undefined, "exit 5 is not an error class — no RT_E code rides it");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emit --run: a genuinely broken emitted source exits 1 (red tree is never a clean emit)", async () => {
    const dir = tempDir();
    try {
      const path = join(dir, "drained.json");
      const drained = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
      assert.equal(drained.status, "complete");
      // Corrupt the generated module BEFORE emit: the scaffold hosts it
      // verbatim, so the emitted tree carries a syntax error → compile red.
      saveProject(path, { ...drained, generatedSource: "function broken( {" });
      const out = join(dir, "tree");
      const r = runCli(["emit", "--project", path, "--out", out, "--run"]);
      assert.equal(r.code, 1, `broken source must exit 1; stderr: ${r.stderr.slice(0, 300)}`);
      assert.equal(r.json.ok, false, "a red tree is never a clean emit");
      assert.equal(r.json.cmd, "emit");
      assert.equal(r.json.exit_code, 1);
      assert.equal(r.json.dir, out);
      const tr = r.json.treeRun as { ok: boolean; compile: { ok: boolean } } | undefined;
      assert.ok(tr, "payload.treeRun must ride the emit envelope");
      assert.equal(tr!.ok, false, "treeRun agrees the tree is red");
      assert.equal(tr!.compile.ok, false, "the broken file fails compile-check");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ingest --report @file round-trips; wrong-phase report exits 1 + persists the trail", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "proj.json");
      runCli(["create", "--brief", FIXTURE_BRIEF, "--out", path]);
      const good = join(dir, "good.json");
      writeFileSync(
        good,
        JSON.stringify({
          phase: 0,
          status: "complete",
          summary: "Reviewed feasibility.",
          artifacts: [{ title: "findings", body: "Feasible, 3 competitor gaps." }],
        }),
        "utf8",
      );
      const ok = runCli(["ingest", "--project", path, "--report", `@${good}`]);
      assert.equal(ok.code, 0);
      assert.equal(ok.json.ok, true);
      assert.equal(ok.json.applied, true);

      const bad = join(dir, "bad.json");
      writeFileSync(
        bad,
        JSON.stringify({ phase: 9, status: "complete", summary: "Wrong-edge claim." }),
        "utf8",
      );
      const rejected = runCli(["ingest", "--project", path, "--report", `@${bad}`]);
      assert.equal(rejected.code, 1, "rejected report → exit 1");
      assert.equal(rejected.json.rejected, true);
      assert.ok(/does not match the current phase/.test(String(rejected.json.error)));

      const proj = loadProject(path);
      assert.ok(
        proj.logs.some((l) => l.event === "report.rejected"),
        "rejection trail must be persisted into the project file",
      );
      // Only the good report landed.
      assert.equal(proj.artifacts.filter((a) => a.id.startsWith("report-")).length, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ingest --report - reads the report from stdin", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "proj.json");
      runCli(["create", "--brief", FIXTURE_BRIEF, "--out", path]);
      const r = runCli(["ingest", "--project", path, "--report", "-"], {
        input: JSON.stringify({
          phase: 0,
          status: "complete",
          summary: "Via stdin.",
          artifacts: [{ title: "stdin-findings", body: "ok" }],
        }),
      });
      assert.equal(r.code, 0);
      assert.equal(r.json.applied, true);
      const proj = loadProject(path);
      assert.equal(proj.artifacts.filter((a) => a.id.startsWith("report-")).length, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("S2: a duplicate ingest reports applied:false + reason:duplicate (E-09 honesty)", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "proj.json");
      runCli(["create", "--brief", FIXTURE_BRIEF, "--out", path]);
      const report = JSON.stringify({
        phase: 0,
        status: "complete",
        summary: "Feasibility review complete.",
        artifacts: [{ title: "findings", body: "Feasible." }],
      });
      const first = runCli(["ingest", "--project", path, "--report", report]);
      assert.equal(first.code, 0);
      assert.equal(first.json.applied, true);
      assert.equal(first.json.reason, "new");
      const second = runCli(["ingest", "--project", path, "--report", report]);
      assert.equal(second.code, 0, "duplicate retry is success (lost-ack recovery)");
      assert.equal(second.json.ok, true);
      assert.equal(second.json.applied, false, "the envelope says the report did NOT land again");
      assert.equal(second.json.reason, "duplicate");
      const proj = loadProject(path);
      assert.equal(proj.artifacts.filter((a) => a.id.startsWith("report-")).length, 1, "no artifact fork");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("S2: knowledge/mine usage errors carry RT_E_VALIDATION, never RT_E_UNKNOWN", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "proj.json");
      runCli(["create", "--brief", FIXTURE_BRIEF, "--out", path]);
      const k = runCli(["knowledge", "--save", "{}"]);
      assert.equal(k.code, 1);
      assert.equal(k.json.code, "RT_E_VALIDATION");
      const m = runCli(["mine"]);
      assert.equal(m.code, 1);
      assert.equal(m.json.code, "RT_E_VALIDATION");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("S2: approve/reject on a drifted gate exit 1 with RT_E_PHASE_ILLEGAL (never exit 4)", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "drifted.json");
      // Fabricate a pending gate for P3 while the current edge is P0.
      const drifted: Project = {
        ...createProject({ brief: FIXTURE_BRIEF }),
        currentPhase: 0 as Project["currentPhase"],
        status: "awaiting_hitl",
        hitl: { phase: 3 as Project["currentPhase"], title: "Stale gate", prompt: "Approve?", stakes: "test" },
      };
      saveProject(path, drifted);
      const ap = runCli(["approve", "--project", path]);
      assert.equal(ap.code, 1);
      assert.equal(ap.json.code, "RT_E_PHASE_ILLEGAL");
      assert.match(String(ap.json.error), /state drifted/);
      const rj = runCli(["reject", "--project", path, "--note", "This gate is stale and wrong."]);
      assert.equal(rj.code, 1);
      assert.equal(rj.json.code, "RT_E_PHASE_ILLEGAL");
      assert.match(String(rj.json.error), /state drifted/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("216 T0.7: a non-TTY approve cannot mint decidedBy:human without --i-am-human (actor-seam regression)", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "forge.json");
      const pending: Project = {
        ...createProject({ brief: FIXTURE_BRIEF }),
        status: "awaiting_hitl",
        hitl: { phase: 0 as Project["currentPhase"], title: "Gate", prompt: "Approve?", stakes: "test" },
      };
      saveProject(path, pending);
      // The reproduced exploit: an agent process (no TTY) approves with no
      // --force and no seat evidence. Before 216 this exited 0 and appended a
      // ledger row reading `decidedBy: human`.
      const ap = runCli(["approve", "--project", path]);
      assert.equal(ap.code, 1, "non-TTY approve without --i-am-human must be refused");
      assert.equal(ap.json.code, "RT_E_VALIDATION");
      assert.match(String(ap.json.error), /i-am-human/);
      // And nothing may have been minted on disk.
      const raw = JSON.parse(readFileSync(path, "utf8")) as {
        decisions?: Array<{ decidedBy?: string }>;
        status?: string;
      };
      assert.ok(
        (raw.decisions ?? []).every((d) => d.decidedBy !== "human"),
        "no human-seat decision may exist without the explicit human flag",
      );
      assert.equal(raw.status, "awaiting_hitl", "the project must still be parked at the gate");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("216 TA-2 — approve() records an actor seat; no machine path mints decidedBy:human", () => {
    const HUMAN_ACTOR: ApproveActor = { decidedBy: "human", seat: "human-cli-i-am-human" };
    /** A project parked at a fabricated P0 gate (approve-callable). */
    const pendingProject = (): Project => ({
      ...createProject({ brief: FIXTURE_BRIEF }),
      status: "awaiting_hitl",
      hitl: { phase: 0 as Project["currentPhase"], title: "Gate", prompt: "Approve?", stakes: "test" },
    });

    it("the default approve records the harness autopilot seat, never a human actor", async () => {
      let p = createProject({ brief: FIXTURE_BRIEF });
      p = (await runUntilGate(p)).project; // parked at P4
      const out = approve(p);
      const row = out.decisions.at(-1);
      assert.equal(
        row?.decidedBy,
        HARNESS_APPROVE_ACTOR.decidedBy,
        "the machine default is the harness autopilot seat — never auto-minted human",
      );
      assert.equal(row?.decidedBy, "autopilot");
      assert.match(String(row?.note), /^\[seat harness\]/, "the row label names the seat that decided");
    });

    it("the human seat WITHOUT the out-of-band token throws — nothing minted", async () => {
      let p = createProject({ brief: FIXTURE_BRIEF });
      p = (await runUntilGate(p)).project; // parked at P4
      const before = p.decisions.length;
      const saved = process.env.RT_HUMAN_SEAT_TOKEN;
      try {
        delete process.env.RT_HUMAN_SEAT_TOKEN; // the machine default state: no token
        assert.throws(
          () => approve(p, { actor: HUMAN_ACTOR }),
          /RT_HUMAN_SEAT_TOKEN/,
          "claiming the human seat without the token must throw, never mint",
        );
        assert.throws(
          () => approve(p, { actor: HUMAN_ACTOR, humanSeatToken: "not-the-token" }),
          /RT_HUMAN_SEAT_TOKEN/,
          "a mismatched token must not mint either",
        );
      } finally {
        if (saved === undefined) delete process.env.RT_HUMAN_SEAT_TOKEN;
        else process.env.RT_HUMAN_SEAT_TOKEN = saved;
      }
      assert.equal(p.decisions.length, before, "the input project is untouched (no row minted)");
      assert.equal(p.status, "awaiting_hitl", "still parked at the gate");
    });

    it("the human seat works via the injected seam when the out-of-band token matches", async () => {
      let p = createProject({ brief: FIXTURE_BRIEF });
      p = (await runUntilGate(p)).project; // parked at P4
      const saved = process.env.RT_HUMAN_SEAT_TOKEN;
      try {
        // The out-of-band secret is injected here (no real key exists — the
        // env var IS the seam; a machine path without it cannot pass above).
        process.env.RT_HUMAN_SEAT_TOKEN = "test-seat-token";
        const out = approve(p, { actor: HUMAN_ACTOR, humanSeatToken: "test-seat-token" });
        const row = out.decisions.at(-1);
        assert.equal(row?.decidedBy, "human");
        assert.match(String(row?.note), /\[seat human-cli-i-am-human\]/, "the row label names the human seat");
        assert.match(String(row?.note), /RT_HUMAN_SEAT_TOKEN verified/, "the out-of-band evidence is echoed");
      } finally {
        if (saved === undefined) delete process.env.RT_HUMAN_SEAT_TOKEN;
        else process.env.RT_HUMAN_SEAT_TOKEN = saved;
      }
    });

    it("CLI: a non-TTY approve --i-am-human WITHOUT the token refuses (RT_E_VALIDATION), mints nothing", () => {
      const dir = tempDir();
      try {
        const path = join(dir, "seatless.json");
        saveProject(path, pendingProject());
        const ap = runCli(["approve", "--project", path, "--i-am-human"], { env: { RT_HUMAN_SEAT_TOKEN: "" } });
        assert.notEqual(ap.code, 0, "a seat claim without its out-of-band evidence must not exit 0");
        assert.equal(ap.json.ok, false);
        assert.equal(ap.json.code, "RT_E_VALIDATION");
        assert.match(String(ap.json.error), /RT_HUMAN_SEAT_TOKEN/);
        const raw = JSON.parse(readFileSync(path, "utf8")) as {
          decisions?: Array<{ decidedBy?: string }>;
          status?: string;
        };
        assert.equal((raw.decisions ?? []).length, 0, "no ledger row minted");
        assert.equal(raw.status, "awaiting_hitl", "still parked at the gate");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("CLI: a non-TTY --i-am-human is refused even WITH the env token — the two-channel seat needs the TTY re-entry (R5-f12 Track 1)", () => {
      // R5-f12 (W29 · spec `thoroughanalysis.md:869-877`): the human seat is
      // TWO channels — the env token (claim) PLUS an interactive TTY re-entry
      // (confirmation). This child process has no TTY, so the claim is refused
      // by `humanSeatClaim` BEFORE the policy seam: no second channel exists
      // here, so no human row may be minted. This pin replaces the old
      // expectation (env-token-alone ⇒ exit 0) — exactly the
      // "env-var-non-empty ⇒ human" degeneracy R5-f12 closed ("it must never
      // be VACUOUS again"). The TTY-positive path is deliberately NOT
      // automated (a TTY cannot be faked from an agent; verified manually per
      // R5-f12 §verify) — the positive rows above stay at the library seam.
      const dir = tempDir();
      try {
        const path = join(dir, "seated.json");
        saveProject(path, pendingProject());
        const ap = runCli(["approve", "--project", path, "--i-am-human"], {
          env: { RT_HUMAN_SEAT_TOKEN: "test-seat-token" },
        });
        assert.equal(ap.code, 1, `a non-TTY human-seat claim must be refused; stderr: ${ap.stderr.slice(0, 300)}`);
        assert.equal(ap.json.ok, false);
        assert.equal(ap.json.code, "RT_E_VALIDATION");
        assert.match(String(ap.json.error), /needs an interactive confirmation/);
        assert.match(String(ap.json.error), /not a TTY/);
        assert.match(String(ap.json.error), /RT_HUMAN_SEAT_TOKEN/);
        const raw = JSON.parse(readFileSync(path, "utf8")) as {
          decisions?: Array<{ decidedBy?: string; note?: string }>;
          status?: string;
        };
        assert.equal((raw.decisions ?? []).length, 0, "a refused seat claim mints no row (never a vacuous pass)");
        assert.equal(raw.status, "awaiting_hitl", "the gate stays parked");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("216o / W6-L2 — the seam's DENY is un-bypassable by both seats; approve() rows record provenance", () => {
    const HUMAN_ACTOR: ApproveActor = { decidedBy: "human", seat: "human-cli-i-am-human" };
    /** A project parked at a fabricated force-human P6 gate — the strongest bypass target. */
    const forceHumanGate = (): Project => {
      const base = parkAt(createProject({ brief: FIXTURE_BRIEF }), 6);
      return { ...base, hitl: { ...base.hitl!, phase: 6, forceHuman: true } };
    };
    /** Run `fn` with RT_HUMAN_SEAT_TOKEN deleted (the machine default), restoring it after. */
    const withoutToken = (fn: () => void): void => {
      const saved = process.env.RT_HUMAN_SEAT_TOKEN;
      try {
        delete process.env.RT_HUMAN_SEAT_TOKEN;
        fn();
      } finally {
        if (saved === undefined) delete process.env.RT_HUMAN_SEAT_TOKEN;
        else process.env.RT_HUMAN_SEAT_TOKEN = saved;
      }
    };

    it("PIN — a policy DENY is un-bypassable by BOTH seats: an unregistered action denies even with a verified token", () => {
      // approve() derives its action from `force` (never caller-supplied), so no
      // approve() input can present an unregistered action; pin the default-deny
      // at the seam this file consumes — deny for the autopilot seat AND for the
      // human seat even WITH a matching token. Evidence never beats the
      // default-deny, so no seat combination can bypass a denied action.
      for (const actor of [HUMAN_ACTOR, HARNESS_APPROVE_ACTOR] as const) {
        const verdict = evaluatePolicy("hitl.bypass", "gate:P4", {
          actor,
          humanSeatToken: "seat-token",
          expectedHumanSeatToken: "seat-token",
        });
        assert.equal(verdict.decision, "deny", `hitl.bypass must deny under the ${actor.decidedBy} seat`);
        if (verdict.decision === "deny") {
          assert.match(verdict.reason, /^unknown-action —/, "the refusal names the unknown-action id");
          assert.equal(verdict.fallback, "none", "an unknown action has no sanctioned fallback");
        }
      }
    });

    it("PIN — hitl.force cannot self-approve: the autopilot seat's force is refused, coded, and mints nothing", () => {
      const p = forceHumanGate();
      const before = p.decisions.length;
      let caught: (Error & { code?: string }) | undefined;
      try {
        approve(p, { force: true }); // the autopilot default seat, forcing hard
      } catch (err) {
        caught = err as Error & { code?: string };
      }
      assert.ok(caught, "an autopilot force must be refused — never silently allowed");
      assert.equal(caught.code, "RT_E_VALIDATION", "the refusal keeps the coded shape");
      assert.match(caught.message, /force-requires-human-seat/, "the verdict names the rule");
      assert.match(caught.message, /human-seat-token/, "the refusal names the sanctioned fallback");
      assert.equal(p.decisions.length, before, "no ledger row may be minted by a refused force");
      assert.equal(p.status, "awaiting_hitl", "the gate stays parked");
    });

    it("PIN — hitl.force via the human seat WITHOUT the out-of-band token is refused too (deny for BOTH seats)", () => {
      const p = forceHumanGate();
      const before = p.decisions.length;
      withoutToken(() => {
        assert.throws(
          () => approve(p, { force: true, actor: HUMAN_ACTOR, humanSeatToken: "not-the-token" }),
          /human-seat-unverified|RT_HUMAN_SEAT_TOKEN/,
          "a human-seat force without the matching token must throw, never mint",
        );
        assert.throws(
          () => approve(p, { force: true, actor: HUMAN_ACTOR }),
          /RT_HUMAN_SEAT_TOKEN/,
          "no presented token at all must throw as well",
        );
      });
      assert.equal(p.decisions.length, before, "refused forces mint nothing");
      assert.equal(p.status, "awaiting_hitl", "still parked at the gate");
    });

    it("POSITIVE CONTROL — the human seat WITH the token may force, and the row records the token path", () => {
      const p = forceHumanGate();
      const saved = process.env.RT_HUMAN_SEAT_TOKEN;
      try {
        process.env.RT_HUMAN_SEAT_TOKEN = "test-seat-token";
        const out = approve(p, { force: true, actor: HUMAN_ACTOR, humanSeatToken: "test-seat-token" });
        const row = out.decisions.at(-1);
        assert.equal(row?.decision, "approve");
        assert.equal(row?.decidedBy, "human");
        assert.match(String(row?.note), /\[seat human-cli-i-am-human\]/, "the 216 note tag is unchanged");
        assert.equal(row?.decidedVia?.action, "hitl.force");
        assert.equal(row?.decidedVia?.resource, "gate:P6");
        assert.equal(row?.decidedVia?.label, "human/human-cli-i-am-human");
        assert.equal(row?.decidedVia?.tokenPath, true, "the verified token path is recorded");
        assert.match(String(row?.decidedVia?.reason), /^human-seat-token-verified — hitl\.force on gate:P6/);
      } finally {
        if (saved === undefined) delete process.env.RT_HUMAN_SEAT_TOKEN;
        else process.env.RT_HUMAN_SEAT_TOKEN = saved;
      }
    });

    it("the default approve records provenance: hitl.approve, autopilot/harness, no token path", async () => {
      let p = createProject({ brief: FIXTURE_BRIEF });
      p = (await runUntilGate(p)).project; // parked at P4
      const out = approve(p);
      const row = out.decisions.at(-1);
      assert.equal(row?.decidedBy, "autopilot");
      assert.equal(row?.decidedVia?.action, "hitl.approve");
      assert.equal(row?.decidedVia?.resource, "gate:P4");
      assert.equal(row?.decidedVia?.label, "autopilot/harness");
      assert.equal(row?.decidedVia?.tokenPath, false, "the machine seat never claims the token path");
      assert.match(String(row?.decidedVia?.reason), /^autopilot-seat — hitl\.approve on gate:P4/);
    });

    it("CLI — a non-TTY approve mints NO row: no provenance may land from a machine", () => {
      // R5-f12 Track 1 (see the TA-2 re-point above): a child process cannot
      // furnish the human seat's second channel, so the CLI mints nothing.
      // The old expectation (a CLI-minted hitl.approve row, decidedVia
      // tokenPath:true) is unreachable without a TTY BY DESIGN — what is
      // pinned here instead is the machine-safe half: the refused claim must
      // leave the ledger byte-identical (BEFORE/AFTER snapshot, non-vacuous).
      // Row-level provenance coverage stays at the library seam (POSITIVE
      // CONTROL + default-approve cases above).
      const dir = tempDir();
      try {
        const path = join(dir, "cli-provenance.json");
        saveProject(path, parkAt(createProject({ brief: FIXTURE_BRIEF }), 4));
        const before = JSON.parse(readFileSync(path, "utf8")) as {
          decisions?: Array<{ decidedBy?: string }>;
        };
        const ap = runCli(["approve", "--project", path, "--i-am-human"], {
          env: { RT_HUMAN_SEAT_TOKEN: "test-seat-token" },
        });
        assert.equal(ap.code, 1, `a non-TTY approve must be refused; stderr: ${ap.stderr.slice(0, 300)}`);
        assert.equal(ap.json.ok, false);
        assert.equal(ap.json.code, "RT_E_VALIDATION");
        const raw = JSON.parse(readFileSync(path, "utf8")) as {
          decisions?: Array<{ decidedBy?: string; decidedVia?: Record<string, unknown> }>;
          status?: string;
        };
        assert.equal(
          (raw.decisions ?? []).length,
          (before.decisions ?? []).length,
          "a refused machine claim mints no row — the ledger stays byte-identical",
        );
        assert.ok(
          (raw.decisions ?? []).every((d) => d.decidedBy !== "human"),
          "no machine path may mint decidedBy:human",
        );
        assert.equal(raw.status, "awaiting_hitl", "the gate stays parked");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  it("doctor returns the capability pre-flight shape (no project required)", () => {
    const r = runCli(["doctor"]);
    assert.equal(r.code, 0);
    assert.equal(r.json.ok, true);
    const doctor = r.json as {
      llm: { configured: boolean; label: string };
      research: { configured: boolean; probed: boolean; label: string };
      runner: { available: boolean; sandbox: boolean };
      node: string;
      factory: {
        autonomousSoftwareFactory: boolean;
        runnerIsSandbox: boolean;
        leftoverJobsAreReexportsOrStubs?: boolean;
        gaps?: string[];
        inventory?: unknown;
      };
    };
    assert.equal(typeof doctor.llm.configured, "boolean");
    assert.ok(typeof doctor.llm.label === "string" && doctor.llm.label.length > 0);
    assert.equal(typeof doctor.research.configured, "boolean");
    assert.equal(typeof doctor.research.probed, "boolean");
    assert.equal(typeof doctor.runner.available, "boolean");
    assert.equal(doctor.runner.sandbox, false);
    assert.match(doctor.node, /^v\d+/);
    assert.equal(doctor.factory.autonomousSoftwareFactory, false, "doctor must not claim RapidTool is a factory");
    assert.equal(doctor.factory.runnerIsSandbox, false);
    assert.equal(doctor.factory.leftoverJobsAreReexportsOrStubs, true);
    assert.ok(Array.isArray(doctor.factory.gaps) && doctor.factory.gaps.length > 0, "210: gaps name why factory is false");
    assert.equal("error" in doctor, false, "doctor envelope is not dual-channel");
    assert.equal(doctor.factory.inventory ?? null, null, "no --tree → inventory null");
  });

  it("214 doctor --tree scans leftover jobs; factory stays false (no invented bodies)", () => {
    // HERMETIC (fixes/215e): synthesize the tree instead of scanning the live
    // research/eval-out dir. The old version flaked whenever a keyed eval
    // rewrote that directory — it leaked machine state into the suite.
    const dir = tempDir();
    const jobs = join(dir, "src", "jobs");
    mkdirSync(jobs, { recursive: true });
    writeFileSync(join(jobs, "flip.ts"), "export function flip() {\n  // TODO(E-15): hosted job — not wired\n}\n");
    writeFileSync(join(jobs, "record.ts"), 'export * from "./hosted.js";\n');
    writeFileSync(join(jobs, "publish.ts"), 'export { publish } from "./hosted.js";\n');
    const r = runCli(["doctor", "--tree", dir]);
    assert.equal(r.code, 0, JSON.stringify(r.json));
    assert.equal(r.json.ok, true);
    const factory = (r.json as { factory: {
      autonomousSoftwareFactory: boolean;
      leftoverJobsAreReexportsOrStubs: boolean;
      inventory: { stubs: number; reexports: number; real: number; files: Array<{ path: string; kind: string }> } | null;
    } }).factory;
    assert.equal(factory.autonomousSoftwareFactory, false);
    assert.equal(factory.leftoverJobsAreReexportsOrStubs, true);
    assert.ok(factory.inventory, "tree scan must produce inventory");
    assert.equal(factory.inventory!.stubs, 1, "flip is a TODO(E-15) stub");
    assert.equal(factory.inventory!.reexports, 2, "record/publish are reexport bridges");
    assert.equal(factory.inventory!.real, 0, "no invented bodies — classifier reads bytes only");
    assert.ok(
      factory.inventory!.files.some((f) => f.path.includes("flip") && f.kind === "stub"),
      "flip is a leftover, not real",
    );
    assert.equal("error" in (r.json as object), false);
  });

  it("W52 · 338-3: doctor --tree derives the factory claim from the real record (product-complete + human fixtures CLOSE)", () => {
    const dir = tempDir();
    try {
      const jobs = join(dir, "src", "jobs");
      mkdirSync(jobs, { recursive: true });
      writeFileSync(join(jobs, "board.ts"), "export function createBoard() { return { id: 'b1' }; }\n");
      writeFileSync(join(jobs, "column.ts"), "export function addColumn() { return { id: 'c1' }; }\n");
      const recordDir = join(dir, ".rapidtool");
      mkdirSync(recordDir, { recursive: true });
      const record = {
        name: "wired",
        brief: "a board tool",
        lattice: { domain: "boards", jobs: ["board", "column"], entities: [], constraints: [], nodes: [], complexity: 2 },
        phases: [],
        implementationSpec: {
          requirements: ["Board shows cards by status"],
          edgeCases: [],
          errorHandling: [],
          typeSignatures: [
            "export function createBoard(name: string): Board",
            "export function addColumn(board: Board, title: string): Column",
          ],
          dataFlow: [],
          negativeConstraints: [],
          source: "p6",
          briefHash: "wired",
          createdAt: 1,
        },
        generatedTree: [
          {
            path: "src/domain/board.ts",
            source: "export type Board = { id: string };\nexport function createBoard(name: string): Board { return { id: name }; }\n",
            hash: "h1",
            attempt: 0,
          },
          {
            path: "src/domain/column.ts",
            source: "export type Column = { id: string };\nexport function addColumn(board: Board, title: string): Column { return { id: title }; }\n",
            hash: "h2",
            attempt: 0,
          },
        ],
        acceptanceFixtures: [{ id: "fx-1", approval: "approved", decidedBy: "human" }],
      };
      writeFileSync(join(recordDir, "project.json"), JSON.stringify(record));
      const r = runCli(["doctor", "--tree", dir]);
      assert.equal(r.code, 0, JSON.stringify(r.json));
      const factory = (r.json as { factory: {
        autonomousSoftwareFactory: boolean;
        leftoverJobsAreReexportsOrStubs: boolean;
        gaps: string[];
        inventory: { real: number } | null;
      } }).factory;
      assert.equal(factory.leftoverJobsAreReexportsOrStubs, false);
      assert.equal(factory.inventory?.real, 2);
      assert.ok(
        !factory.gaps.some((g) => g.includes("product-complete")),
        `the product-complete gap must CLOSE on a real arch-complete record: ${JSON.stringify(factory.gaps)}`,
      );
      assert.ok(
        !factory.gaps.some((g) => g.includes("human-approved fixtures")),
        `the fixtures gap must CLOSE on a human-approved set: ${JSON.stringify(factory.gaps)}`,
      );
      assert.equal(factory.autonomousSoftwareFactory, true, "every signal genuinely met ⇒ the latch reports the truth");
      assert.deepEqual(factory.gaps, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("W53 · 340-2: doctor --tree surfaces awaitingHumanAcceptance — machine-complete but unaccepted vs. a leftover tree", () => {
    // One real archived record, two trees. The record is the same arch-complete
    // keyed shape the 338-3 test closes the product bar on, but its fixture set
    // is drafted-and-PENDING: the ONE deliberate human door, not a defect.
    const record = {
      name: "wired",
      brief: "a board tool",
      lattice: { domain: "boards", jobs: ["board", "column"], entities: [], constraints: [], nodes: [], complexity: 2 },
      phases: [],
      implementationSpec: {
        requirements: ["Board shows cards by status"],
        edgeCases: [],
        errorHandling: [],
        typeSignatures: [
          "export function createBoard(name: string): Board",
          "export function addColumn(board: Board, title: string): Column",
        ],
        dataFlow: [],
        negativeConstraints: [],
        source: "p6",
        briefHash: "wired",
        createdAt: 1,
      },
      generatedTree: [
        {
          path: "src/domain/board.ts",
          source: "export type Board = { id: string };\nexport function createBoard(name: string): Board { return { id: name }; }\n",
          hash: "h1",
          attempt: 0,
        },
        {
          path: "src/domain/column.ts",
          source: "export type Column = { id: string };\nexport function addColumn(board: Board, title: string): Column { return { id: title }; }\n",
          hash: "h2",
          attempt: 0,
        },
      ],
      acceptanceFixtures: [{ id: "fx-1", approval: "pending" }],
    };
    const build = (jobs: Array<[string, string]>) => {
      const dir = tempDir();
      const jobsDir = join(dir, "src", "jobs");
      mkdirSync(jobsDir, { recursive: true });
      for (const [name, source] of jobs) writeFileSync(join(jobsDir, name), source);
      const recordDir = join(dir, ".rapidtool");
      mkdirSync(recordDir, { recursive: true });
      writeFileSync(join(recordDir, "project.json"), JSON.stringify(record));
      return dir;
    };
    const realDir = build([
      ["board.ts", "export function createBoard() { return { id: 'b1' }; }\n"],
      ["column.ts", "export function addColumn() { return { id: 'c1' }; }\n"],
    ]);
    const leftoverDir = build([
      ["board.ts", "export function createBoard() {\n  throw new Error('TODO(E-15) stub: implement board');\n}\n"],
      ["column.ts", "export { addColumn } from './board.ts';\n"],
    ]);
    try {
      const a = runCli(["doctor", "--tree", realDir]);
      assert.equal(a.code, 0, JSON.stringify(a.json));
      const fa = (a.json as { factory: {
        autonomousSoftwareFactory: boolean;
        awaitingHumanAcceptance: boolean;
        gaps: string[];
        inventory: { real: number } | null;
      } }).factory;
      assert.equal(fa.inventory?.real, 2);
      assert.equal(fa.autonomousSoftwareFactory, false, "the human stamp is still required");
      assert.equal(fa.awaitingHumanAcceptance, true, "the sole remaining reason is the deliberate human door");
      assert.deepEqual(fa.gaps, ['no human-approved fixtures (decidedBy:"human")']);

      const b = runCli(["doctor", "--tree", leftoverDir]);
      assert.equal(b.code, 0, JSON.stringify(b.json));
      const fb = (b.json as { factory: {
        autonomousSoftwareFactory: boolean;
        awaitingHumanAcceptance: boolean;
        gaps: string[];
      } }).factory;
      assert.equal(fb.autonomousSoftwareFactory, false);
      assert.equal(fb.awaitingHumanAcceptance, false, "a leftover tree is a real defect, not the human door");
      assert.ok(fb.gaps.some((g) => g.includes("leftover jobs")));
    } finally {
      rmSync(realDir, { recursive: true, force: true });
      rmSync(leftoverDir, { recursive: true, force: true });
    }
  });

  it("W52 · 338-3: doctor --project derives productComplete/humanFixtures but keeps the census gaps (fail-closed)", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "record.json");
      writeFileSync(
        path,
        JSON.stringify({
          name: "named",
          brief: "a board tool",
          lattice: { domain: "boards", jobs: ["board"], entities: [], constraints: [], nodes: [], complexity: 1 },
          phases: [],
          implementationSpec: {
            requirements: ["Board shows cards"],
            edgeCases: [],
            errorHandling: [],
            typeSignatures: ["export function createBoard(name: string): Board"],
            dataFlow: [],
            negativeConstraints: [],
            source: "p6",
            briefHash: "named",
            createdAt: 1,
          },
          generatedTree: [
            {
              path: "src/domain/board.ts",
              source: "export type Board = { id: string };\nexport function createBoard(name: string): Board { return { id: name }; }\n",
              hash: "h1",
              attempt: 0,
            },
          ],
          acceptanceFixtures: [{ id: "fx-1", approval: "approved", decidedBy: "human" }],
        }),
      );
      const r = runCli(["doctor", "--project", path]);
      assert.equal(r.code, 0, JSON.stringify(r.json));
      const factory = (r.json as { factory: { autonomousSoftwareFactory: boolean; gaps: string[] } }).factory;
      assert.ok(!factory.gaps.some((g) => g.includes("product-complete")), "the record closes the complete gap");
      assert.ok(!factory.gaps.some((g) => g.includes("human-approved fixtures")), "the set closes the fixtures gap");
      assert.ok(factory.gaps.some((g) => g.includes("leftover jobs")), "no census scanned ⇒ leftover fail-closed");
      assert.ok(factory.gaps.some((g) => g.includes("no real multi-job product")), "no census ⇒ product fail-closed");
      assert.equal(factory.autonomousSoftwareFactory, false, "an unmeasured census never mints the factory");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("chat --ask /help is keyless exit 0 (slash tools, no DeepSeek)", () => {
    const dir = tempDir();
    try {
      const path = join(dir, "proj.json");
      const created = runCli([
        "create",
        "--brief",
        "Build a tiny field ledger.",
        "--out",
        path,
      ]);
      assert.equal(created.code, 0);
      const r = runCli(["chat", "--project", path, "--ask", "/help"]);
      assert.equal(r.code, 0, "slash /help must not require a key");
      assert.equal(r.json.ok, true);
      assert.ok(String(r.json.reply).includes("/ls"));
      assert.ok(String(r.json.reply).includes("/read"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fixes/144 M4-1: a red-gate COMPLETE run exits 1 with RT_E_GATES_FAILED + sealedWithFailures (never a clean 0)", async () => {
    const dir = tempDir();
    try {
      const redPath = join(dir, "red.json");
      const cleanPath = join(dir, "clean.json");
      const red = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
      assert.equal(
        summary(red).sealedWithFailures,
        true,
        "precondition: a keyless drain seals complete with red gates (P6/P7) by construction",
      );
      saveProject(redPath, red);
      // A genuinely clean seal: every complete phase records a GREEN DoD gate.
      const clean: Project = {
        ...red,
        phases: red.phases.map((ph) =>
          ph.status === "complete"
            ? { ...ph, gate: { passed: true, unmet: [], evidenceHash: "clean", checkedAt: 1 } }
            : ph,
        ),
      };
      saveProject(cleanPath, clean);

      const redRun = runCli(["gate", "--project", redPath]);
      assert.equal(redRun.code, 1, "red-gate complete → exit 1, never 0");
      assert.equal(redRun.json.ok, false);
      assert.equal(redRun.json.code, "RT_E_GATES_FAILED");
      assert.equal(redRun.json.sealedWithFailures, true);
      assert.match(String(redRun.json.error), /failed DoD gate/);
      assert.match(String(redRun.json.error), /P6\(/);

      const cleanRun = runCli(["gate", "--project", cleanPath]);
      assert.equal(cleanRun.code, 0, "clean complete → exit 0 unchanged");
      assert.equal(cleanRun.json.ok, true);
      assert.equal(
        (cleanRun.json.summary as { sealedWithFailures: boolean }).sealedWithFailures,
        false,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("withCommonJsExports (audit-46 verify seam)", () => {
    it("appends guarded exports for top-level functions", () => {
      const out = withCommonJsExports("function synthesize(spec) { return 1; }\nfunction test_happy() {}");
      assert.ok(out.includes("module.exports.synthesize = synthesize;"));
      assert.ok(out.includes("module.exports.test_happy = test_happy;"));
      assert.ok(out.includes('typeof module !== "undefined"'));
    });
    it("is a no-op when the source already exports", () => {
      const src = "module.exports = { add: (a,b) => a + b };";
      assert.equal(withCommonJsExports(src), src);
    });
    it("is a no-op for non-function sources", () => {
      const src = "const x = 1;\nconsole.log(x);";
      assert.equal(withCommonJsExports(src), src);
    });
    it("dedupes repeated names", () => {
      const out = withCommonJsExports("function f(){}\nfunction f(){}\nfunction g(){}");
      assert.equal(out.match(/module\.exports\.f = f;/g)!.length, 1);
      assert.ok(out.includes("module.exports.g = g;"));
    });
  });
});

describe("T0.4 — headless honors enforceDod (hard-DoD is not a silent skip)", () => {
  it("runUntilGate stops with outcome dod and unmoved cursor when leaving a red-gate phase", async () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const stepped = await runUntilGate({ ...p, enforceDod: false }, { maxSteps: 1 });
    assert.equal(stepped.project.currentPhase, 1, "precondition: P0 advanced under advisory");
    const sabotaged: Project = {
      ...stepped.project,
      enforceDod: true,
      currentPhase: 1 as PhaseId,
      phases: stepped.project.phases.map((ph) =>
        ph.id === 1 ? { ...ph, status: "complete" as const, startedAt: Date.now() } : ph,
      ),
    };
    const res = await runUntilGate(sabotaged, { maxSteps: 1 });
    assert.equal(res.outcome, "dod", "hard-DoD is its own terminal outcome");
    assert.equal(res.project.currentPhase, 1, "cursor unmoved");
    assert.ok(
      (res.project.logs ?? []).some((l) => l.event === "dod.blocked"),
      "dod.blocked log landed",
    );
    assert.ok(
      (res.project.artifacts ?? []).some((a) => a.title.startsWith("Hard DoD block")),
      "block artifact landed",
    );
  });
});

describe("A7 emitProject wipes ghost specs and refuses foreign files", () => {
  it("wipes leftover tests/*.spec.ts on re-emit", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rt-emit-"));
    try {
      const p = createProject({ brief: FIXTURE_BRIEF, name: "EmitWipe" });
      const first = await emitProject(p, dir);
      assert.equal(first.ok, true, first.ok ? "" : first.error);
      mkdirSync(join(dir, "tests"), { recursive: true });
      writeFileSync(join(dir, "tests", "ghost.spec.ts"), "test('ghost', () => {});");
      const second = await emitProject(p, dir);
      assert.equal(second.ok, true, second.ok ? "" : second.error);
      if (second.ok) {
        assert.ok(second.wiped.includes("tests/ghost.spec.ts"), JSON.stringify(second.wiped));
        assert.equal(existsSync(join(dir, "tests", "ghost.spec.ts")), false);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses foreign leftover without --force; quarantines it with force", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rt-emit-"));
    try {
      const p = createProject({ brief: FIXTURE_BRIEF, name: "EmitForeign" });
      const first = await emitProject(p, dir);
      assert.equal(first.ok, true, first.ok ? "" : first.error);
      writeFileSync(join(dir, "NOTES.md"), "user notes");
      const second = await emitProject(p, dir);
      assert.equal(second.ok, false);
      if (!second.ok) {
        assert.equal(second.code, "RT_E_FOREIGN_FILES");
        assert.ok(second.foreign?.includes("NOTES.md"));
      }
      assert.equal(existsSync(join(dir, "NOTES.md")), true, "refused emit does not delete foreign");
      const forced = await emitProject(p, dir, { force: true });
      assert.equal(forced.ok, true, forced.ok ? "" : forced.error);
      if (forced.ok) {
        // R11-f08: a forced emit MOVES the foreign file aside (never in place).
        assert.ok(forced.quarantined.includes("NOTES.md"));
        assert.equal(existsSync(join(dir, "NOTES.md")), false);
        assert.equal(forced.survivors.length, 0, "nothing survives in place");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("174-F8: refuses emit when .rapidtool-emit.lock is held (RT_E_BUSY)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rt-emit-"));
    try {
      const p = createProject({ brief: FIXTURE_BRIEF, name: "EmitLock" });
      writeFileSync(join(dir, ".rapidtool-emit.lock"), "held");
      const res = await emitProject(p, dir);
      assert.equal(res.ok, false);
      if (!res.ok) assert.equal(res.code, "RT_E_BUSY");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("174-F8: successful emit leaves no .rapidtool-emit.lock", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rt-emit-"));
    try {
      const p = createProject({ brief: FIXTURE_BRIEF, name: "EmitCleanLock" });
      const res = await emitProject(p, dir);
      assert.equal(res.ok, true, res.ok ? "" : res.error);
      assert.equal(existsSync(join(dir, ".rapidtool-emit.lock")), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// R11-f08 (in-engine lift) — a forced emit MOVES the foreign files aside into
// `<dir>/.rapidtool-quarantine/<stamp>/` and reports them, so EVERY forced
// caller (not just the CLI) quarantines and no later tree-run judges bytes the
// factory never authored. A failed move refuses the emit (`ok:false`,
// RT_E_FOREIGN_FILES) with `judgingSkipped`, so the CLI's --verify-kind/--check/
// --run legs cannot mint `tested` over a still-mixed tree.
// ---------------------------------------------------------------------------
describe("R11-f08 — emitProject quarantines forced foreign files (in-engine lift)", () => {
  it("moves forced foreign files into .rapidtool-quarantine/<stamp>/ (recoverable, never deleted)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rt-emit-q-"));
    try {
      const p = createProject({ brief: FIXTURE_BRIEF, name: "EmitQuarantine" });
      const first = await emitProject(p, dir);
      assert.equal(first.ok, true, first.ok ? "" : first.error);
      writeFileSync(join(dir, "NOTES.md"), "user notes");
      writeFileSync(join(dir, "scratch.txt"), "scratch");
      const forced = await emitProject(p, dir, { force: true });
      assert.equal(forced.ok, true, forced.ok ? "" : forced.error);
      if (!forced.ok) return;
      assert.deepEqual(forced.quarantined, ["NOTES.md", "scratch.txt"]);
      assert.ok(forced.quarantineDir, "the quarantine dir is reported");
      assert.equal(forced.survivors.length, 0, "nothing is left in place");
      assert.equal(existsSync(join(dir, "NOTES.md")), false);
      assert.equal(
        readFileSync(join(forced.quarantineDir!, "NOTES.md"), "utf8"),
        "user notes",
        "quarantine means recoverable — the bytes move, they are not deleted",
      );
      // A repeat forced emit never re-judges the quarantine as foreign leftovers.
      const again = await emitProject(p, dir, { force: true });
      assert.equal(again.ok, true, again.ok ? "" : again.error);
      if (again.ok) assert.equal(again.quarantined.length, 0, "the quarantine dir is skipped by the emit walk");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a failed quarantine move refuses the emit and suppresses judging", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rt-emit-qf-"));
    try {
      const p = createProject({ brief: FIXTURE_BRIEF, name: "EmitQuarantineFail" });
      const first = await emitProject(p, dir);
      assert.equal(first.ok, true, first.ok ? "" : first.error);
      writeFileSync(join(dir, "NOTES.md"), "user notes");
      // `.rapidtool-quarantine` exists as a FILE, so the quarantine mkdir fails.
      writeFileSync(join(dir, ".rapidtool-quarantine"), "not a directory");
      const forced = await emitProject(p, dir, { force: true });
      assert.equal(forced.ok, false, "a failed move must refuse, never report a mixed tree as emitted");
      if (forced.ok) return;
      assert.equal(forced.code, "RT_E_FOREIGN_FILES");
      assert.ok(forced.foreign?.includes("NOTES.md"), "the still-in-place foreign file is named");
      assert.match(String(forced.judgingSkipped), /did not run/, "judging is suppressed over the mixed tree");
      assert.equal(existsSync(join(dir, "NOTES.md")), true, "the failed move leaves the file in place");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// W-03 (fixes/271 · §R3-f01 + AMENDMENT) — emit-time materialization. The
// stored-bytes-verbatim emit shipped `module.exports.*` into a `"type":
// "module"` tenant (import-time TypeError). The repair: emitProject feeds a
// CJS-residue-carrying tree through codegen.materializeImportableTree BEFORE
// the scaffold, so the emitted files AND the `.rapidtool/project.json` record
// carry the same importable ESM bytes. The guard is residue-based (the
// materializer is NOT idempotent — a ≠-guard would re-rewrite endlessly).
// ---------------------------------------------------------------------------
describe("W-03 (fixes/271 · §R3-f01) — emit-time materialization of CJS-residue trees", () => {
  const cjsSource = [
    "function getProperty(state, id) { return state[id] ?? null; }",
    "module.exports.getProperty = getProperty;",
    "module.exports.getPropertyCount = function () { return 1; };",
  ].join("\n");
  const residueProject = (): Project => {
    const p = createProject({ brief: FIXTURE_BRIEF, name: "EmitCjs" });
    return {
      ...p,
      generatedTree: [{ path: "src/generated/get-property.ts", source: cjsSource, hash: String(fnv1a(cjsSource)), attempt: 2 }],
    };
  };

  it("RED-first (pre-fix bytes carry module.exports): a stored CJS tree emits importable ESM — 0 residue, consistent record, real import", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rt-emit-cjs-"));
    try {
      const res = await emitProject(residueProject(), dir);
      assert.equal(res.ok, true, res.ok ? "" : res.error);
      assert.ok(res.files.includes("src/generated.ts"), "the ESM barrel lands at the tree entry path");
      assert.ok(res.files.includes("src/generated/get-property.ts"), "the chunk keeps its declared path");
      const chunk = readFileSync(join(dir, "src/generated", "get-property.ts"), "utf8");
      assert.equal(chunk.includes("module.exports"), false, "0 module.exports in the emitted chunk");
      assert.ok(chunk.includes("export {"), "the recovered surface lands as ESM named exports");
      const record = JSON.parse(readFileSync(join(dir, ".rapidtool", "project.json"), "utf8")) as {
        generatedTree: { path: string; source: string; hash: string; attempt: number }[];
      };
      const paths = record.generatedTree.map((r) => r.path);
      assert.ok(paths.includes("src/generated.ts") && paths.includes("src/generated/get-property.ts"), JSON.stringify(paths));
      for (const row of record.generatedTree) {
        assert.equal(/module\.exports/.test(row.source), false, `record row ${row.path} carries no CJS residue`);
        assert.equal(row.hash, String(fnv1a(row.source)), `record row ${row.path} hash matches its emitted bytes`);
      }
      const chunkRow = record.generatedTree.find((r) => r.path === "src/generated/get-property.ts");
      assert.equal(chunkRow?.attempt, 2, "the row keeps its synthesis attempt");
      // A REAL import smoke under this `node --test` run: the emitted barrel
      // must load as an ES module and expose the recovered surface.
      const mod = (await import(pathToFileURL(join(dir, "src/generated.ts")).href)) as {
        getProperty?: unknown;
        getPropertyCount?: unknown;
      };
      assert.equal(typeof mod.getProperty, "function", "the emitted barrel imports");
      assert.equal(typeof mod.getPropertyCount, "function", "the residual export survived the rewrite");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emit-twice is byte-stable (the residue guard never re-rewrites) and clean trees stay verbatim", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rt-emit-cjs2-"));
    try {
      const q = residueProject();
      const a = await emitProject(q, dir);
      assert.equal(a.ok, true, a.ok ? "" : a.error);
      const snap = (files: readonly string[]): [string, string][] =>
        files.map((p) => [p, readFileSync(join(dir, p), "utf8")]);
      const first = snap(a.ok ? a.files : []);
      const b = await emitProject(q, dir);
      assert.equal(b.ok, true, b.ok ? "" : b.error);
      assert.deepEqual(snap(b.ok ? b.files : []), first, "second emit is byte-identical to the first");
      // A clean (residue-free) tree still passes through VERBATIM — the
      // scaffold verbatim pin + 2-file fixture class.
      const cleanSrc = 'export * from "./generated/chunk-0.ts";\n';
      const clean: Project = {
        ...createProject({ brief: FIXTURE_BRIEF, name: "EmitClean" }),
        generatedTree: [{ path: "src/generated.ts", source: cleanSrc, hash: String(fnv1a(cleanSrc)), attempt: 0 }],
      };
      const dir2 = mkdtempSync(join(tmpdir(), "rt-emit-clean-"));
      try {
        const c = await emitProject(clean, dir2);
        assert.equal(c.ok, true, c.ok ? "" : c.error);
        assert.equal(
          readFileSync(join(dir2, "src/generated.ts"), "utf8"),
          cleanSrc,
          "no residue ⇒ exact stored bytes on disk (guard byte-parity)",
        );
      } finally {
        rmSync(dir2, { recursive: true, force: true });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // T1 (331-3 · fixes/330 §6.1): the zero-row early return used to skip the
  // materializer entirely, so a LONE generatedSource with CJS residue was
  // never rewritten — 330 Fix A then refused it (safe, but the path never
  // converted). The materializer now treats it as a single-row tree plan at
  // TREE_ENTRY_PATH, so the path CONVERTS: ESM chunk + src/generated.ts barrel
  // the `"type":"module"` tenant can import.
  const loneCjs = (): Project => ({
    ...createProject({ brief: FIXTURE_BRIEF, name: "EmitLoneCjs" }),
    generatedTree: [],
    generatedSource: "function add(a, b) { return a + b; }\nmodule.exports.add = add;\n",
  });

  it("T1 RED-first: a lone generatedSource with CJS residue CONVERTS — importable ESM at the tree entry, real import", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rt-emit-lone-cjs-"));
    try {
      const res = await emitProject(loneCjs(), dir);
      assert.equal(res.ok, true, res.ok ? "" : res.error);
      assert.ok(res.files.includes("src/generated.ts"), "the ESM barrel lands at the tree entry path");
      assert.ok(res.files.includes("src/generated/chunk-0.ts"), "the module is relocated and rewritten");
      const barrel = readFileSync(join(dir, "src/generated.ts"), "utf8");
      const chunk = readFileSync(join(dir, "src/generated/chunk-0.ts"), "utf8");
      assert.equal(barrel.includes("module.exports"), false, "0 residue in the barrel");
      assert.equal(chunk.includes("module.exports"), false, "0 residue in the chunk");
      assert.ok(chunk.includes("export { add }"), "the CJS surface is recovered as an ESM named export");
      const record = JSON.parse(readFileSync(join(dir, ".rapidtool", "project.json"), "utf8")) as {
        generatedTree: { path: string; source: string; hash: string }[];
      };
      assert.deepEqual(
        record.generatedTree.map((r) => r.path),
        ["src/generated.ts", "src/generated/chunk-0.ts"],
        "the record carries the materialized tree",
      );
      for (const row of record.generatedTree) {
        assert.equal(/module\.exports/.test(row.source), false, `record row ${row.path} carries no CJS residue`);
        assert.equal(row.hash, String(fnv1a(row.source)), `record row ${row.path} hash matches its bytes`);
      }
      // A REAL import smoke under this `node --test` run: the emitted entry
      // must load as an ES module and expose the recovered function.
      const mod = (await import(pathToFileURL(join(dir, "src/generated.ts")).href)) as { add?: unknown };
      assert.equal(typeof mod.add, "function", "the converted generated entry imports");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("T1 control: a CLEAN lone generatedSource is untouched — no synthesized tree, legacy host verbatim", async () => {
    const cleanSrc = "function add(a: number, b: number): number { return a + b; }\nexport { add };\n";
    const p: Project = {
      ...createProject({ brief: FIXTURE_BRIEF, name: "EmitLoneClean" }),
      generatedTree: [],
      generatedSource: cleanSrc,
    };
    const dir = mkdtempSync(join(tmpdir(), "rt-emit-lone-clean-"));
    try {
      const res = await emitProject(p, dir);
      assert.equal(res.ok, true, res.ok ? "" : res.error);
      assert.equal(existsSync(join(dir, "src/generated.ts")), false, "no residue ⇒ no synthesized tree");
      const host = res.ok
        ? res.files.find((f) => readFileSync(join(dir, f), "utf8").includes(cleanSrc.trim()))
        : undefined;
      assert.ok(host, "the clean generatedSource still hosts verbatim at its legacy path");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("216 T-07 — emit refuses or banners on an uncleared red tree-run (F-07)", () => {
  type TrailRow = NonNullable<Project["logs"]>[number];
  const trailRow = (level: TrailRow["level"], event: string, detail: string): TrailRow => ({
    ts: Date.now(),
    phase: 6 as PhaseId,
    level,
    event,
    detail,
  });
  /** The project with a fabricated tree-verdict trail appended (the injected
   *  seam — no real tree-run needed). */
  const withTrail = (p: Project, ...rows: TrailRow[]): Project => ({
    ...p,
    logs: [...(p.logs ?? []), ...rows].slice(-200),
  });

  it("a red trail is refused with RT_E_TREE_RUN_FAILED before ANY write (default policy)", async () => {
    const dir = tempDir();
    try {
      const p = withTrail(
        createProject({ brief: FIXTURE_BRIEF, name: "RedRefuse" }),
        trailRow("warn", "p6.tree.failure", "compile: 2 emitted files failed to parse"),
        trailRow("warn", "p6.tree.failure", "tests: oracle.spec.ts 1 fail / 3 pass"),
        trailRow("warn", "p6.tree.failure", "run: entry module exited 1"),
      );
      const out = join(dir, "out");
      const res = await emitProject(p, out);
      assert.equal(res.ok, false, "an uncleared red tree is never emitted by default");
      if (!res.ok) {
        assert.equal(res.code, "RT_E_TREE_RUN_FAILED");
        assert.match(String(res.error), /tree-run trail is RED/);
        assert.equal(res.redTree?.failures, 3, "F-07 observed three failed tree-runs");
        assert.match(String(res.redTree?.lastFailure), /entry module exited 1/);
      }
      assert.equal(existsSync(out), false, "a refused emit must not even create the emit dir");
      assert.equal(existsSync(join(out, "README.md")), false, "nothing was written");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("redTree:'banner' emits the tree with the unmissable banner + the honest metric", async () => {
    const dir = tempDir();
    try {
      const p = withTrail(
        createProject({ brief: FIXTURE_BRIEF, name: "RedBanner" }),
        trailRow("warn", "p6.tree.failure", "run: entry module exited 1"),
      );
      const out = join(dir, "out");
      const res = await emitProject(p, out, { redTree: "banner" });
      assert.equal(res.ok, true, res.ok ? "" : res.error);
      if (res.ok) {
        assert.equal(res.redTreeBanner, true, "the emitted README carries the banner");
        assert.equal(res.redTree?.failures, 1);
        assert.match(String(res.redTree?.lastFailure), /entry module exited 1/);
      }
      const readme = readFileSync(join(out, "README.md"), "utf8");
      assert.ok(readme.startsWith("> [!CAUTION]\n"), "the banner heads the README");
      assert.match(readme, /RED TREE-RUN/);
      assert.match(readme, /1 failed tree-run/);
      assert.match(readme, /entry module exited 1/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a trail cleared by a later green run emits clean under both policies (control)", async () => {
    const dir = tempDir();
    try {
      const p = withTrail(
        createProject({ brief: FIXTURE_BRIEF, name: "RedCleared" }),
        trailRow("warn", "p6.tree.failure", "run: entry module exited 1"),
        trailRow("info", "p6.tree.tested", "tree-run ok: 2 specs, 1 skipped (no runner)"),
      );
      const plain = join(dir, "plain");
      const bannered = join(dir, "bannered");
      const a = await emitProject(p, plain); // default refuse — a cleared trail is not refused
      assert.equal(a.ok, true, a.ok ? "" : a.error);
      if (a.ok) {
        assert.equal(a.redTreeBanner, false);
        assert.equal(a.redTree, null, "the trail was consulted and is not red");
      }
      const b = await emitProject(p, bannered, { redTree: "banner" });
      assert.equal(b.ok, true, b.ok ? "" : b.error);
      if (b.ok) assert.equal(b.redTreeBanner, false, "no banner without an uncleared red");
      const readPlain = readFileSync(join(plain, "README.md"), "utf8");
      const readBanner = readFileSync(join(bannered, "README.md"), "utf8");
      assert.equal(readPlain.includes("RED TREE-RUN"), false);
      assert.equal(readBanner, readPlain, "on a non-red trail the banner policy is byte-identical");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("'probe' never consults the trail (fields stay absent, nothing refused or stamped)", async () => {
    const dir = tempDir();
    try {
      const p = withTrail(
        createProject({ brief: FIXTURE_BRIEF, name: "RedProbe" }),
        trailRow("warn", "p6.tree.failure", "run: entry module exited 1"),
      );
      const out = join(dir, "out");
      const res = await emitProject(p, out, { redTree: "probe" });
      assert.equal(res.ok, true, res.ok ? "" : res.error);
      if (res.ok) {
        assert.equal("redTreeBanner" in res, false, "probe leaves the result fields absent");
        assert.equal("redTree" in res, false);
      }
      assert.equal(readFileSync(join(out, "README.md"), "utf8").includes("RED TREE-RUN"), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("B5 runAcceptance is the single terminal writer", () => {
  it("stamps accepted|failed|aborted and a run.* log", () => {
    const p = createProject({ brief: FIXTURE_BRIEF, name: "Accept" });
    const a = runAcceptance(p, "accepted", "ok");
    assert.equal(a.acceptance, "accepted");
    assert.ok((a.logs ?? []).some((l) => l.event === "run.accepted"));
    const b = runAcceptance(p, "aborted", "SIGTERM");
    assert.equal(b.acceptance, "aborted");
    assert.equal(p.acceptance, undefined, "input not mutated");
  });
});

describe("185-H1 wild lifecycle — ok:true never carries error", () => {
  it("idempotent pause/resume/stop use note, not error", async () => {
    const base = createProject({ brief: FIXTURE_BRIEF, name: "WildH1" });
    const started = await wildStartRun(base, { maxSteps: 1 });
    assert.equal(started.ok, true);
    if (!started.ok) return;
    assert.equal("error" in started, false, "ok:true start must not carry error");

    const paused = await wildPauseRun(started.project);
    assert.equal(paused.ok, true);
    if (!paused.ok) return;
    assert.equal(paused.changed, true);

    const again = await wildPauseRun(paused.project);
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.equal(again.changed, false);
    assert.equal("error" in again, false);
    assert.equal(again.note, "Wild run is already paused.");

    const resumeIdle = await wildResumeRun(paused.project);
    assert.equal(resumeIdle.ok, true);
    if (!resumeIdle.ok) return;
    assert.equal(resumeIdle.changed, true);
    assert.equal("error" in resumeIdle, false);

    const resumeAgain = await wildResumeRun(resumeIdle.project);
    assert.equal(resumeAgain.ok, true);
    if (!resumeAgain.ok) return;
    assert.equal(resumeAgain.changed, false);
    assert.equal("error" in resumeAgain, false);
    assert.equal(resumeAgain.note, "Wild run is not paused.");

    const stopped = await wildStopRun(resumeAgain.project);
    assert.equal(stopped.ok, true);
    if (!stopped.ok) return;
    assert.equal(stopped.changed, true);

    const stopAgain = await wildStopRun(stopped.project);
    assert.equal(stopAgain.ok, true);
    if (!stopAgain.ok) return;
    assert.equal(stopAgain.changed, false);
    assert.equal("error" in stopAgain, false);
    assert.equal(stopAgain.note, "Wild run is already stopped.");
  });
});

// ---------------------------------------------------------------------------
// 312 D2 (B-01/M4-06 + the C2 stop completion): the park-record invariants at
// the headless CLI read sites. Every pause stamps a machine-readable record
// (wildOperatorPark — its first call site is wildPauseRun), resume CLEARS it
// ("present iff pause"), and stop must never let a carried park ride the
// rest-spread onto a stopped run (the one gap the b3161da batch missed).
// ---------------------------------------------------------------------------
describe("312 D2 — park present iff pause across the headless wild lifecycle", () => {
  it("pause stamps the uncoded operator park; resume clears it; stop clears it and keeps it cleared", async () => {
    const base = createProject({ brief: FIXTURE_BRIEF, name: "WildParkClear" });
    const active: Project = {
      ...base,
      wildMode: true,
      wildRun: {
        active: true,
        phase: 4,
        startedAt: 1,
        lastAutoLog: "",
        lastAutoAt: 1,
        stoppedAt: null,
        pause: false,
      },
    };

    const paused = await wildPauseRun(active);
    assert.equal(paused.ok, true);
    if (!paused.ok) return;
    assert.equal(paused.project.wildRun?.pause, true, "pause keeps active, sets pause");
    const park = paused.project.wildRun?.park;
    assert.ok(park, "the CLI pause must stamp its park record (M4-06 — wildOperatorPark's first call site)");
    assert.equal(park.code, null, "operator pauses are uncoded");
    assert.equal(park.unlock, "resume", "what unlocks an operator pause is a plain resume");
    assert.equal(typeof park.at, "number");

    // B-01: resume clears the record — a preserved park must never linger on a live run.
    const resumed = await wildResumeRun(paused.project);
    assert.equal(resumed.ok, true);
    if (!resumed.ok) return;
    assert.equal(resumed.project.wildRun?.pause, false);
    assert.equal(resumed.project.wildRun?.park ?? null, null, "resume clears the park");

    // Re-pause, then STOP the park-carrying paused run: the stop must clear the
    // park rather than let the spread leak it onto a stopped surface.
    const repaused = await wildPauseRun(resumed.project);
    assert.equal(repaused.ok, true);
    if (!repaused.ok) return;
    assert.ok(repaused.project.wildRun?.park, "re-pause stamps the park again");
    const stopped = await wildStopRun(repaused.project);
    assert.equal(stopped.ok, true);
    if (!stopped.ok) return;
    assert.equal(stopped.project.wildRun?.active, false);
    assert.equal(stopped.project.wildRun?.pause, false);
    assert.equal(
      stopped.project.wildRun?.park ?? null,
      null,
      "stop clears the carried park (never rides the spread onto a stopped run)",
    );
    assert.equal(typeof stopped.project.wildRun?.stoppedAt, "number");
  });
});

// ---------------------------------------------------------------------------
// 312 D2 (B-02): the headless legs must THREAD the caller's onEvent sink —
// every caller dropped it, so finishStep's wild.step_* telemetry never fired
// on the CLI path. Emission-side only (project bytes unchanged); this pin
// asserts the wildStartRun caller seam actually receives the step seeds.
// ---------------------------------------------------------------------------
describe("312 D2 — wildStartRun threads the caller's onEvent sink (B-02)", () => {
  it("a keyless macro-run step emits its wild.step_* seeds through opts.onEvent", async () => {
    const p = createProject({ brief: FIXTURE_BRIEF, name: "WildSink" });
    const rows: RtEventSeed[] = [];
    const res = await wildStartRun(p, { maxSteps: 1, onEvent: (seed) => rows.push(seed) });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.ok(
      rows.some((r) => r.event === "wild.step_start"),
      `wild.step_start must reach the caller's sink (got: ${rows.map((r) => r.event).join(", ") || "<none>"})`,
    );
    assert.ok(
      rows.some((r) => r.event === "wild.step_ok" || r.event === "wild.step_paused" || r.event === "wild.step_error"),
      `the step's terminal row must reach the caller's sink (got: ${rows.map((r) => r.event).join(", ") || "<none>"})`,
    );
  });
});

// ---------------------------------------------------------------------------
// R13-f02 — the classifier/pause half. A real planner plan is REVIEWED by the
// Auto-Review classifier and the run PARKS before the first mutation (a real
// park state + `wild.plan_review` ledger row), so "no execution without an
// approved plan" is machine state, not a note. The reviewer is the existing
// injectable seam (no keyed call in tests).
// ---------------------------------------------------------------------------
describe("R13-f02 — planner rows are reviewed and the run parks before the first mutation", () => {
  const plannerPlan = (): WildPlan => ({
    goal: "deliver the brief",
    steps: [
      { id: "s1", action: "draft the core module", why: "the brief's evidence row requires it" },
      { id: "s2", action: "verify the module", why: "machine-verification is the P6 bar" },
    ],
    source: "planner",
    plannedAt: 1,
    note: "planner rows (test)",
  });

  it("reviews the rows with the classifier and parks before any step mutates", async () => {
    const base = createProject({ brief: FIXTURE_BRIEF, name: "PlanReview" });
    const seeded: Project = { ...base, wildPlan: plannerPlan() };
    const seen: Project[] = [];
    const reviewer: WildReviewer = async (ctx) => {
      seen.push(ctx.project);
      return {
        ok: true,
        verdict: "approve",
        feedback: "The plan's steps are concrete, ordered, and grounded in the brief's evidence.",
        model: "test-reviewer",
      };
    };
    const res = await wildStartRun(seeded, { maxSteps: 4, reviewer });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.outcome, "paused", "a planner plan parks the run before execution");
    assert.equal(res.steps, 0, "no step may mutate before the plan is reviewed");
    assert.equal(res.project.wildRun?.pause, true);
    assert.ok(res.project.wildRun?.park, "the pause carries a real park record");
    assert.equal(res.project.wildRun?.park?.unlock, "human-gate");
    assert.equal(res.project.wildRun?.park?.code, "RT_E_GATE_PENDING");
    assert.ok(
      (res.project.logs ?? []).some((l) => l.event === "wild.plan_review"),
      "the review lands a ledger row",
    );
    assert.ok((res.project.logs ?? []).some((l) => l.event === "wild.paused_plan"), "the park lands a ledger row");
    assert.equal(seen.length, 1, "the classifier is called exactly once for the plan");
    assert.deepEqual(
      seen[0]?.wildPlan?.steps.map((s) => s.id),
      ["s1", "s2"],
      "the review context carries the planner rows",
    );
  });

  it("does not re-review a stored plan once the review row exists (idempotent)", async () => {
    const base = createProject({ brief: FIXTURE_BRIEF, name: "PlanReviewIdem" });
    const seeded: Project = { ...base, wildPlan: plannerPlan() };
    const first = await wildStartRun(seeded, {
      maxSteps: 2,
      reviewer: async () => ({
        ok: true,
        verdict: "approve",
        feedback: "The plan's steps are concrete and grounded in the brief's evidence.",
        model: "test",
      }),
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    let calls = 0;
    const counting: WildReviewer = async () => {
      calls += 1;
      return { ok: true, verdict: "approve", feedback: "no re-review should reach here", model: "test" };
    };
    const step = await wildStartHeadless(first.project, { maxSteps: 1, reviewer: counting });
    assert.equal(step.ok, true);
    assert.equal(calls, 0, "a plan whose review row exists is never re-reviewed");
  });

  it("keyless (no reviewer): still parks, with an honest not-configured review row", async () => {
    const base = createProject({ brief: FIXTURE_BRIEF, name: "PlanReviewKeyless" });
    const seeded: Project = { ...base, wildPlan: plannerPlan() };
    const res = await wildStartRun(seeded, { maxSteps: 2 });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.outcome, "paused");
    assert.equal(res.steps, 0);
    assert.equal(res.project.wildRun?.pause, true);
    const row = (res.project.logs ?? []).find((l) => l.event === "wild.plan_review");
    assert.ok(row, "a keyless host records the honest not-configured review row");
    assert.match(String(row?.detail), /not configured/i);
  });

  it("a classifier REJECT still parks and never executes the plan", async () => {
    const base = createProject({ brief: FIXTURE_BRIEF, name: "PlanReviewReject" });
    const seeded: Project = { ...base, wildPlan: plannerPlan() };
    const res = await wildStartRun(seeded, {
      maxSteps: 2,
      reviewer: async () => ({
        ok: true,
        verdict: "reject",
        feedback: "Step s2 cannot be verified from the brief; the plan omits the evidence row.",
        model: "test",
      }),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.outcome, "paused");
    assert.equal(res.steps, 0);
    const row = (res.project.logs ?? []).find((l) => l.event === "wild.plan_review");
    assert.match(String(row?.detail), /reject/i);
  });
});

describe("209 — CLI lesson --accept (human-gated store write)", () => {
  it("accept promotes lesson rows; re-accept is idempotent; empty lessons fail closed", () => {
    const dir = mkdtempSync(join(tmpdir(), "rt-lesson-accept-"));
    try {
      const projPath = join(dir, "proj.json");
      const storePath = join(dir, "lessons.json");
      const created = runCli([
        "create",
        "--brief",
        "Build a field-service dispatch board for HVAC.",
        "--name",
        "HVAC Dispatch",
        "--out",
        projPath,
      ]);
      assert.equal(created.code, 0, JSON.stringify(created.json));
      assert.equal(created.json.ok, true);

      // Seed one lesson-tagged memory row into the project file (CLI accept reads disk).
      const raw = JSON.parse(readFileSync(projPath, "utf8")) as {
        memory?: Array<Record<string, unknown>>;
        brief?: string;
        name?: string;
      };
      raw.memory = [
        ...(Array.isArray(raw.memory) ? raw.memory : []),
        {
          id: "m-lesson-1",
          kind: "episodic",
          text: "HVAC dispatch board field service ranking must stay deterministic",
          score: 0.88,
          phase: 6,
          tags: ["lesson", "L3", "verify-failure"],
          source: "test",
        },
      ];
      writeFileSync(projPath, JSON.stringify(raw, null, 2));

      const empty = runCli([
        "lesson",
        "--accept",
        "--project",
        join(dir, "empty.json"),
        "--out",
        storePath,
        "--actor",
        "qa-human",
      ]);
      // missing project file → fail closed
      assert.equal(empty.json.ok, false);

      const accept = runCli([
        "lesson",
        "--accept",
        "--project",
        projPath,
        "--out",
        storePath,
        "--actor",
        "qa-human",
        "--limit",
        "3",
      ]);
      assert.equal(accept.code, 0, JSON.stringify(accept.json));
      assert.equal(accept.json.ok, true);
      assert.equal(accept.json.action, "accept");
      assert.equal(accept.json.actor, "qa-human");
      assert.equal(accept.json.promoted, 1, "first human accept must append");
      assert.equal(accept.json.attempted, 1);
      assert.equal(accept.json.refused, 0);
      assert.equal("error" in accept.json, false, "ok:true must not carry error");

      const again = runCli([
        "lesson",
        "--accept",
        "--project",
        projPath,
        "--out",
        storePath,
        "--actor",
        "qa-human",
        "--limit",
        "3",
      ]);
      assert.equal(again.code, 0, JSON.stringify(again.json));
      assert.equal(again.json.ok, true);
      assert.equal(again.json.promoted, 0, "re-accept identical content appends 0");
      assert.equal(again.json.attempted, 1);
      const rows = again.json.rows as Array<{ appended?: boolean }> | undefined;
      assert.ok(Array.isArray(rows) && rows.length === 1);
      assert.equal(rows[0]!.appended, false, "re-accept same actor is idempotent");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("W46 · 332-2 (L1/AW45-c06) — per-project persisted run spend", () => {
  const greenVerdict = (): TreeRunOutcome => ({
    ok: true,
    dir: "",
    compile: { ok: true, dir: "", checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [] },
    tests: [],
    run: { kind: "library", run: "skip", detail: "no entry to smoke" },
  });

  it("summary.budget.spent reports the project's persisted cumulative spend, not the empty session", () => {
    const savedCap = process.env.RAPIDTOOL_TOKEN_CAP;
    delete process.env.RAPIDTOOL_TOKEN_CAP;
    resetSessionBudget();
    try {
      // A variable (not a fresh literal) carries `calls` until types.ts widens
      // `Project.tokenUsage` to token-ledger's `SpendSlice` (W46 C2 request).
      const persisted = { promptTokens: 60000, completionTokens: 17654, calls: 12 };
      const p: Project = { ...createProject({ brief: FIXTURE_BRIEF }), tokenUsage: persisted };
      // BEFORE the fix this read the fresh process's empty session ledger: 0.
      assert.deepEqual(summary(p).budget, { spent: 77654, cap: null, stop_reason: null });
    } finally {
      if (savedCap !== undefined) process.env.RAPIDTOOL_TOKEN_CAP = savedCap;
      resetSessionBudget();
    }
  });

  it("the session cap still crosses on the session ledger; spent stays the run total", () => {
    const savedCap = process.env.RAPIDTOOL_TOKEN_CAP;
    process.env.RAPIDTOOL_TOKEN_CAP = "100";
    try {
      resetSessionBudget(); // re-reads env: cap=100, empty ledger
      const persisted = { promptTokens: 150, completionTokens: 0, calls: 1 };
      const p: Project = { ...createProject({ brief: FIXTURE_BRIEF }), tokenUsage: persisted };
      recordSessionSpend({ promptTokens: 100, completionTokens: 0 }); // lands exactly on the cap: ok
      assert.deepEqual(summary(p).budget, { spent: 150, cap: 100, stop_reason: null });
      recordSessionSpend({ promptTokens: 0, completionTokens: 1 }); // strict crossing
      assert.deepEqual(summary(p).budget, { spent: 150, cap: 100, stop_reason: "budget_exhausted" });
    } finally {
      if (savedCap === undefined) delete process.env.RAPIDTOOL_TOKEN_CAP;
      else process.env.RAPIDTOOL_TOKEN_CAP = savedCap;
      resetSessionBudget();
    }
  });

  it("runUntilGate folds THIS invocation's measured spend into project.tokenUsage (persisted run cost)", async () => {
    const savedCap = process.env.RAPIDTOOL_TOKEN_CAP;
    delete process.env.RAPIDTOOL_TOKEN_CAP;
    resetSessionBudget();
    try {
      const drained = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
      const rewound: Project = {
        ...drained,
        status: "running",
        currentPhase: 6,
        lastTest: null,
        phases: drained.phases.map((r) =>
          r.id === 6 ? ({ ...r, status: "ready" as const, gate: null, startedAt: null } as unknown as typeof r) : r,
        ),
      };
      // The injected synthesize owns the key policy (driveP6Journey runs it
      // regardless of DEEPSEEK_API_KEY) and records one metered call per cycle.
      let synthCalls = 0;
      const synthesize = async (p: Project): Promise<Project> => {
        synthCalls += 1;
        recordSessionSpend({ promptTokens: 400, completionTokens: 46 });
        const t = {
          ...p,
          generatedTree: [{ path: "src/generated.ts", source: "export const hvac = () => 1;", hash: "f1", attempt: 0 }],
        };
        return {
          ...t,
          phases: t.phases.map((ph) => (ph.id === 6 ? { ...ph, status: "complete" as const } : ph)),
        };
      };
      const res = await runUntilGate(rewound, {
        live: true,
        maxSteps: 1,
        p6Deps: { synthesize, runTree: async () => greenVerdict() },
      });
      assert.ok(synthCalls >= 1, "the injected P6 synthesis actually ran");
      assert.deepEqual(
        res.project.tokenUsage,
        { promptTokens: 400 * synthCalls, completionTokens: 46 * synthCalls, calls: synthCalls },
        "the invocation's session delta persists on the project record",
      );
      assert.equal(
        summary(res.project).budget.spent,
        446 * synthCalls,
        "summary now reports the run's measured cost (every metered cycle summed)",
      );
    } finally {
      if (savedCap !== undefined) process.env.RAPIDTOOL_TOKEN_CAP = savedCap;
      resetSessionBudget();
    }
  });

  it("a spent invocation round-trips through save/load, so the NEXT process still sees the cost", async () => {
    const dir = tempDir();
    try {
      const file = join(dir, "proj.json");
      const persisted = { promptTokens: 446, completionTokens: 0, calls: 1 };
      const p: Project = { ...createProject({ brief: FIXTURE_BRIEF }), tokenUsage: persisted };
      saveProject(file, p);
      const reloaded = loadProject(file);
      assert.deepEqual(reloaded.tokenUsage, { promptTokens: 446, completionTokens: 0, calls: 1 });
      assert.equal(summary(reloaded).budget.spent, 446);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolveDoctorSpendSource: explicit spend wins, else the project file, else the tree record, else the session", () => {
    const dir = tempDir();
    try {
      const projectFile = join(dir, "proj.json");
      const persisted = { promptTokens: 60000, completionTokens: 17654, calls: 12 };
      saveProject(projectFile, { ...createProject({ brief: FIXTURE_BRIEF }), tokenUsage: persisted });
      const explicit = { promptTokens: 1, completionTokens: 2, calls: 3 };
      assert.deepEqual(resolveDoctorSpendSource({ projectPath: projectFile, spend: explicit }), explicit);
      assert.deepEqual(resolveDoctorSpendSource({ projectPath: projectFile }), {
        promptTokens: 60000,
        completionTokens: 17654,
        calls: 12,
      });
      // The tree record lives at <dir>/.rapidtool/project.json.
      const treeDir = join(dir, "tree");
      mkdirSync(join(treeDir, ".rapidtool"), { recursive: true });
      writeFileSync(
        join(treeDir, ".rapidtool", "project.json"),
        JSON.stringify({ tokenUsage: { promptTokens: 7, completionTokens: 8, calls: 1 } }),
        "utf8",
      );
      assert.deepEqual(resolveDoctorSpendSource({ treeDir }), { promptTokens: 7, completionTokens: 8, calls: 1 });
      // No project anywhere ⇒ the process session ledger (never a fabricated spend).
      resetSessionBudget();
      const session = resolveDoctorSpendSource({ treeDir: join(dir, "empty-no-record") });
      assert.equal(session, sessionTokenBudget().ledger);
      // A legacy record without tokenUsage loses its rung honestly, too.
      const legacyFile = join(dir, "legacy.json");
      saveProject(legacyFile, createProject({ brief: FIXTURE_BRIEF }));
      resetSessionBudget();
      assert.equal(resolveDoctorSpendSource({ projectPath: legacyFile }), sessionTokenBudget().ledger);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      resetSessionBudget();
    }
  });
});

describe("W46 · 332-2 (F-5) — doctor key state (presence ≠ validity)", () => {
  it("a stubbed keyed rejection surfaces as rejected with the tail-only source", async () => {
    const state = await resolveDoctorKeyState(true, {
      code: "RT_E_LLM_KEY_REJECTED",
      at: 1759000000000,
      keySource: "the process environment (tail …a1b2)",
    });
    assert.equal(state.keyState, "rejected");
    assert.equal(state.lastKeyed?.code, "RT_E_LLM_KEY_REJECTED");
    assert.equal(state.lastKeyed?.keySource, "the process environment (tail …a1b2)");
    // The source label is tail-only — no full-key shape can ride through.
    assert.ok(!/sk-/.test(state.lastKeyed?.keySource ?? ""), "no key material in the source label");
  });

  it("no keyed call recorded (key present) is the honest unverified floor", async () => {
    // No override: reads the process status surface best-effort. On a bare-Node
    // host the TanStack server fn cannot run, so nothing was captured — the
    // state must be `unverified`, never an implied green.
    const state = await resolveDoctorKeyState(true);
    assert.equal(state.keyState, "unverified");
    assert.equal(state.lastKeyed, undefined);
    // A hostile explicit payload is dropped the same way.
    assert.deepEqual(await resolveDoctorKeyState(true, {}), { keyState: "unverified" });
  });

  it("no key is not-configured; a transient failure stays unverified", async () => {
    assert.deepEqual(await resolveDoctorKeyState(false), { keyState: "not-configured" });
    const transient = await resolveDoctorKeyState(true, { code: "RT_E_LLM_TIMEOUT", at: 1 });
    assert.equal(transient.keyState, "unverified");
    assert.equal(transient.lastKeyed?.code, "RT_E_LLM_TIMEOUT");
  });
});

// ---------------------------------------------------------------------------
// W48 · 334-2 — the run's keyed outcome on the project record (L1), the coded
// failure class on the RunResult (L2), and non-gate-verb spend folding (L3).
// Deterministic: no key, no network — the keyed path is stubbed.
// ---------------------------------------------------------------------------
describe("W48 · 334-2 — persisted keyed outcome, run-result code, verb spend", () => {
  const log6 = (
    event: string,
    detail: string,
    ts: number,
  ): { ts: number; phase: PhaseId; level: "warn"; event: string; detail: string } => ({
    ts,
    phase: 6 as PhaseId,
    level: "warn",
    event,
    detail,
  });
  const greenVerdict = (): TreeRunOutcome => ({
    ok: true,
    dir: "",
    compile: { ok: true, dir: "", checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [] },
    tests: [],
    run: { kind: "library", run: "skip", detail: "no entry to smoke" },
  });
  const KEY_REJECTION =
    'RT_E_LLM_KEY_REJECTED · DeepSeek returned HTTP 401 — requested model: "deepseek-v4-pro" — key source: the process environment (tail …a1b2)';

  it("keyedTrailOutcome: a key-unusable refusal is read; a later success clears it; non-key failures never condemn", () => {
    const base = createProject({ brief: FIXTURE_BRIEF });
    assert.deepEqual(keyedTrailOutcome(base), { kind: "none" }, "no keyed evidence");
    const rejected: Project = { ...base, logs: [log6("p6.synthesis.refused", KEY_REJECTION, 5)] };
    assert.deepEqual(keyedTrailOutcome(rejected), {
      kind: "rejected",
      code: "RT_E_LLM_KEY_REJECTED",
      at: 5,
      keySource: "the process environment (tail …a1b2)",
    });
    // A later `ok` synthesis attempt means the last keyed call succeeded.
    const cleared: Project = {
      ...rejected,
      logs: [...rejected.logs, log6("p6.synthesis.attempt", "chunk 1/1 · attempt 1 · 90000ms · ok", 6)],
    };
    assert.deepEqual(keyedTrailOutcome(cleared), { kind: "success" });
    // A non-key refusal (the model declined the brief) is not a keyed outcome.
    const other: Project = {
      ...base,
      logs: [log6("p6.synthesis.refused", "RT_E_LLM_REJECTED · model refused the brief", 7)],
    };
    assert.deepEqual(keyedTrailOutcome(other), { kind: "none" });
    // The tail-only source never carries a key shape.
    assert.ok(!/sk-/.test(JSON.stringify(keyedTrailOutcome(rejected))), "no key material in the trail outcome");
  });

  it("runUntilGate persists a P6-synthesis 401 on the record and surfaces its code (L1+L2)", async () => {
    resetSessionBudget();
    try {
      const drained = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
      const rewound: Project = {
        ...drained,
        status: "running",
        currentPhase: 6,
        lastTest: null,
        phases: drained.phases.map((r) =>
          r.id === 6 ? ({ ...r, status: "ready" as const, gate: null, startedAt: null } as unknown as typeof r) : r,
        ),
      };
      const synthesize = async (p: Project): Promise<Project> => ({
        ...p,
        logs: [...(p.logs ?? []), log6("p6.synthesis.refused", KEY_REJECTION, 1759000000000)].slice(-200),
      });
      const res = await runUntilGate(rewound, {
        live: true,
        maxSteps: 1,
        p6Deps: { synthesize, runTree: async () => greenVerdict() },
      });
      const persisted = (res.project as Project & { lastKeyedOutcome?: { code: string; at: number; keySource?: string } })
        .lastKeyedOutcome;
      assert.ok(persisted, "the run moved the keyed outcome onto the project record");
      assert.equal(persisted!.code, "RT_E_LLM_KEY_REJECTED");
      assert.equal(persisted!.at, 1759000000000);
      assert.match(persisted!.keySource ?? "", /tail …a1b2/);
      assert.ok(!/sk-/.test(JSON.stringify(persisted)), "no key material persisted");
      assert.equal(res.code, "RT_E_LLM_KEY_REJECTED", "the RunResult carries the coded failure class");
      // Persist → re-load → read back with no override: the fresh-process path
      // a real `doctor` takes after a `gate`.
      const dir = tempDir();
      try {
        const file = join(dir, "run.json");
        saveProject(file, res.project);
        const raw = JSON.parse(readFileSync(file, "utf8")) as { lastKeyedOutcome?: { code?: string } };
        assert.equal(raw.lastKeyedOutcome?.code, "RT_E_LLM_KEY_REJECTED", "the saved record carries the field");
        assert.deepEqual(await resolveDoctorKeyState(true, undefined, file), {
          keyState: "rejected",
          lastKeyed: {
            code: "RT_E_LLM_KEY_REJECTED",
            at: 1759000000000,
            keySource: "the process environment (tail …a1b2)",
          },
        });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    } finally {
      resetSessionBudget();
    }
  });

  it("resolveDoctorKeyState reads a FRESH project's persisted key rejection (L1)", async () => {
    const dir = tempDir();
    try {
      const file = join(dir, "proj.json");
      writeFileSync(
        file,
        JSON.stringify({
          lastKeyedOutcome: {
            code: "RT_E_LLM_KEY_REJECTED",
            at: 1759000000000,
            keySource: "the process environment (tail …a1b2)",
          },
        }),
        "utf8",
      );
      const state = await resolveDoctorKeyState(true, undefined, file);
      assert.equal(state.keyState, "rejected", "the record read-back flips the doctor to rejected");
      assert.equal(state.lastKeyed?.code, "RT_E_LLM_KEY_REJECTED");
      assert.equal(state.lastKeyed?.keySource, "the process environment (tail …a1b2)");
      // An explicit override still wins over the record.
      const override = await resolveDoctorKeyState(true, { code: "RT_E_LLM_KEY_SHADOWED", at: 9 }, file);
      assert.equal(override.lastKeyed?.code, "RT_E_LLM_KEY_SHADOWED");
      // A legacy record with no field stays the honest unverified floor.
      const legacy = join(dir, "legacy.json");
      writeFileSync(legacy, JSON.stringify({ tokenUsage: { promptTokens: 1, completionTokens: 1 } }), "utf8");
      assert.deepEqual(await resolveDoctorKeyState(true, undefined, legacy), { keyState: "unverified" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("repairTreeDir folds its synthesis spend into the project slice (L3)", async () => {
    const dir = tempDir();
    resetSessionBudget();
    try {
      mkdirSync(join(dir, "src", "generated"), { recursive: true });
      writeFileSync(join(dir, "src", "generated", "hvac.ts"), "export const hvac = () => 1;\n", "utf8");
      const base = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
      const ledger: Project = {
        ...base,
        generatedTree: [
          { path: "src/generated/hvac.ts", source: "export const hvac = () => 1;", hash: "f1", attempt: 0 },
        ],
      };
      let calls = 0;
      const synth = async (p: Project): Promise<Project> => {
        calls += 1;
        recordSessionSpend({ promptTokens: 400, completionTokens: 46 });
        return p;
      };
      const red: TreeRunOutcome = {
        ok: false,
        dir: "",
        compile: { ok: false, dir: "", checked: 0, passed: 0, failed: 1, skipped: 0, verdicts: [] },
        tests: [],
        run: null,
        error: "red",
      };
      const res = await repairTreeDir(ledger, dir, {
        budget: 1,
        deps: { synthesize: synth, runTree: async () => red },
      });
      assert.ok(calls >= 1, "the repair synthesis ran");
      assert.deepEqual(
        res.project.tokenUsage,
        { promptTokens: 400 * calls, completionTokens: 46 * calls, calls },
        "the repair's measured spend persists on the returned ledger",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
      resetSessionBudget();
    }
  });

  it("wildStartRun folds the macro-run's measured spend into the project slice (L3)", async () => {
    resetSessionBudget();
    try {
      const p = createProject({ brief: FIXTURE_BRIEF, name: "WildSpend" });
      let recorded = 0;
      const res = await wildStartRun(p, {
        maxSteps: 1,
        onEvent: () => {
          // Stand in for a keyed step's metered usage without a key: the engine
          // records real usage into the SAME session ledger this seam folds.
          if (recorded === 0) {
            recordSessionSpend({ promptTokens: 500, completionTokens: 60 });
            recorded = 1;
          }
        },
      });
      assert.equal(res.ok, true);
      if (!res.ok) return;
      assert.deepEqual(
        res.project.tokenUsage,
        { promptTokens: 500, completionTokens: 60, calls: 1 },
        "the wild macro-run's session delta persists on the returned project",
      );
    } finally {
      resetSessionBudget();
    }
  });
});

// ---------------------------------------------------------------------------
// W49 · 335-2 — the journey driver + state integrity (the wave's "no work is
// lost" theme). (a) every phase advances and records through headless.ts;
// (b) a real record round-trips save→load losslessly INCLUDING the W46/W48
// fields (`tokenUsage`, `lastKeyedOutcome`); a record LACKING them still loads
// and migrates in place; and the file loader reads back what its own writer
// wrote. (c) the atomic-write + doctor/spend truth live in their own blocks.
// ---------------------------------------------------------------------------
describe("W49 · 335-2 — journey drive + save/load integrity", () => {
  /** Drive a fresh project through ALL 13 phases, approving each stock HITL park. */
  async function driveAllPhases(): Promise<Project> {
    let p = createProject({ brief: FIXTURE_BRIEF });
    for (let i = 0; i < 80; i++) {
      if (p.status === "complete" || p.status === "blocked") break;
      const res = await runUntilGate(p, { maxSteps: 1 });
      p = res.project;
      if (p.status === "awaiting_hitl") p = approve(p);
    }
    return p;
  }

  it("(a) every one of the 13 phases runs, records a gate artifact + verdict, and advances", async () => {
    const p = await driveAllPhases();
    assert.equal(p.status, "complete", "the 13-phase journey seals complete");
    assert.equal(p.currentPhase, 12);
    assert.equal(p.phases.filter((r) => r.status === "complete").length, 13);
    for (let id = 0; id <= 12; id++) {
      const rec = p.phases.find((r) => r.id === id);
      assert.equal(rec?.status, "complete", `P${id} is complete`);
      assert.ok(rec?.startedAt != null, `P${id} recorded a start`);
      assert.ok(rec?.gate, `P${id} recorded its DoD gate verdict`);
      assert.ok(
        p.artifacts.some((a) => a.phase === id && a.kind === "gate"),
        `P${id} recorded its gate artifact`,
      );
      assert.ok(
        p.logs.some((l) => l.phase === id && l.event === "gate.verdict"),
        `P${id} recorded its gate.verdict log`,
      );
      assert.ok(
        p.logs.some((l) => l.phase === id && l.event === "phase.enter"),
        `P${id} recorded its phase.enter log`,
      );
    }
  });

  it("(b) a driven record + the W46/W48 fields round-trips save→load losslessly", async () => {
    const dir = tempDir();
    try {
      let partial = createProject({ brief: FIXTURE_BRIEF });
      for (let i = 0; i < 6; i++) {
        const r = await runUntilGate(partial, { maxSteps: 1 });
        partial = r.project;
        if (partial.status === "awaiting_hitl") partial = approve(partial);
      }
      const spend = { promptTokens: 60000, completionTokens: 17654, calls: 12, cachedPromptTokens: 5 };
      const keyed = {
        code: "RT_E_LLM_KEY_REJECTED",
        at: 1759000000000,
        keySource: "the process environment (tail …a1b2)",
      };
      const record: Project = { ...partial, tokenUsage: spend, lastKeyedOutcome: keyed };
      const file = join(dir, "run.json");
      saveProject(file, record);
      const loaded = loadProject(file);
      assert.deepEqual(loaded.tokenUsage, spend, "the persisted run spend survives the file round-trip");
      assert.deepEqual(
        loaded.lastKeyedOutcome,
        keyed,
        "the persisted keyed outcome survives the file round-trip",
      );
      // Whole-record losslessness: the loaded record re-serializes byte-identically.
      assert.equal(exportJson(loaded), exportJson(record), "no field is lost or reordered by save→load");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(b) a legacy record lacking tokenUsage/lastKeyedOutcome still loads and migrates in place", async () => {
    const dir = tempDir();
    try {
      const p = await driveAllPhases();
      const raw = JSON.parse(exportJson(p)) as Record<string, unknown>;
      delete raw.tokenUsage;
      delete raw.lastKeyedOutcome;
      raw._v = 1; // an older marker
      const file = join(dir, "legacy.json");
      writeFileSync(file, JSON.stringify(raw), "utf8");
      const loaded = loadProject(file);
      assert.equal(loaded.id, p.id);
      assert.equal("tokenUsage" in loaded, false, "absent spend stays absent — never fabricated");
      assert.equal("lastKeyedOutcome" in loaded, false, "absent keyed outcome stays absent");
      assert.equal((loaded as { _v?: number })._v, 2, "the record migrates in place to the current marker");
      // It still loads its REAL state, not an empty shell.
      assert.equal(loaded.phases.filter((r) => r.status === "complete").length, 13);
      assert.ok((loaded.artifacts?.length ?? 0) > 0, "the real artifacts survived the migration");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(b) the file loader reads back a record its own writer produced — even past the paste-import cap", () => {
    const dir = tempDir();
    try {
      const file = join(dir, "big.json");
      // A legitimate record can exceed the hostile-PASTE cap; the file path must
      // read back exactly what saveProject wrote (pre-fix this threw "Import
      // payload too large" — a record unreadable by its own reader).
      const padding = "x".repeat(IMPORT_MAX_CHARS + 100);
      const record = {
        ...createProject({ brief: FIXTURE_BRIEF }),
        futureLargeField: padding,
      } as unknown as Project;
      saveProject(file, record);
      assert.ok(statSync(file).size > IMPORT_MAX_CHARS, "the saved record exceeds the paste cap");
      const loaded = loadProject(file);
      assert.equal(loaded.id, record.id, "the loader reads its own writer's record");
      // The browser/console PASTE defense is untouched: the same oversized string is refused.
      const pasted = importProject(readFileSync(file, "utf8"));
      assert.equal(pasted.ok, false, "an oversized PASTE is still refused (hostile-input cap preserved)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// W50 · 336-2 — the minted record's OWN Agent Packet must describe the mint.
// The packet is compiled by stampPacket and rendered from the project's state;
// the P6 mint (lastTest) and the gate record change that state. The journey,
// the repair arm and the promotion must recompile the packet before the record
// is persisted, or the shipped record carries a packet whose P6 line predates
// its own `tested` stamp (the stale-vs-fresh divergence 336-3 measured).
// ---------------------------------------------------------------------------
describe("W50 · 336-2 — the minted record's own packet describes the mint", () => {
  /** A green, EXECUTED tree-run verdict (the mint's precondition). */
  const greenExecuted = (): TreeRunOutcome =>
    ({
      ok: true,
      dir: "/scratch/tree",
      compile: { ok: true, dir: "/scratch/tree", checked: 2, passed: 2, failed: 0, skipped: 0, verdicts: [] },
      tests: [{ file: "tests/oracle.spec.ts", run: "pass", tests: { pass: 3, fail: 0 }, detail: "3 passed" }],
      run: { kind: "webapp", run: "pass", entry: "src/main.tsx", detail: "started" },
      declaredScriptsVerified: true,
      unverifiedDeclaredScripts: [],
    }) as unknown as TreeRunOutcome;

  /** A P6-complete project whose tree satisfies the REAL P6 gate probes
   *  (brief-fit + arch), so the journey exercises the real mint + real gate. */
  function p6Fixture(): Project {
    const p = createProject({ brief: "probe", name: "PacketProbe" });
    p.currentPhase = 6;
    p.phases = Array.from({ length: 13 }, (_, id) => ({
      id,
      status: id <= 6 ? ("complete" as const) : id === 7 ? ("ready" as const) : ("locked" as const),
    })) as Project["phases"];
    p.generatedSource = "export const probe = 1;";
    p.generatedTree = [
      { path: "src/index.ts", source: "export const probe = 1;", hash: "h1", attempt: 0 },
      { path: "src/domain/core.ts", source: "export function deliverCoreWorkflow() { return 1; }", hash: "h2", attempt: 0 },
    ];
    p.artifacts = [{ id: "code-6", phase: 6, kind: "code", title: "P6 code", body: "export const probe = 1;" }];
    p.lastTest = null;
    p.specGraph = null;
    return p;
  }

  it("the converged record's own packet carries the minted hash, its DoD line, and equals a fresh compile", async () => {
    const res = await driveP6Journey(p6Fixture(), {
      deps: { synthesize: async () => p6Fixture(), runTree: async () => greenExecuted() },
    });
    assert.equal(res.outcome, "converged", "the real mint + real gate converge over this fixture");
    const hash = (res.project.lastTest as { evidenceHash?: string } | null)?.evidenceHash;
    assert.ok(hash && hash.length > 0, "the tested stamp was minted");
    assert.ok(res.project.packet.includes(hash!), "the record's packet names the minted evidence hash");
    assert.match(res.project.packet, /self-test \(machine-verified\)/);
    assert.match(res.project.packet, /Gate P6: PASS/);
    // The record is its own artifact: a fresh compile of it must agree byte-for-byte.
    assert.equal(res.project.packet, compileAgentPacket(res.project), "the packet is not stale (agrees with a fresh compile)");
  });

  it("the packet ARTIFACT body is the freshly compiled packet, not a stale copy beside it", async () => {
    const res = await driveP6Journey(p6Fixture(), {
      deps: { synthesize: async () => p6Fixture(), runTree: async () => greenExecuted() },
    });
    const art = (res.project.artifacts ?? []).find((a) => a.kind === "packet");
    assert.ok(art, "the sealed packet artifact exists");
    assert.equal(art!.body, res.project.packet, "the artifact body is the freshly compiled packet");
  });

  it("promotion of an already-tested project refreshes a stale hash and recompiles the emitted record's packet", async () => {
    const dir = tempDir();
    try {
      mkdirSync(join(dir, ".rapidtool"), { recursive: true });
      const recordPath = join(dir, ".rapidtool", "project.json");
      const stale = {
        ...p6Fixture(),
        lastTest: { ok: true, detail: "tree-run green: OLD TREE", label: "tested", evidenceHash: "OLDSTALE" },
      } as Project;
      writeFileSync(recordPath, exportJson(stale), "utf8");
      const prom = await promoteEmittedTreeTested(stale, dir, greenExecuted());
      assert.equal(prom.promoted, true, "a refreshed stamp is promoted (the old hash described another tree)");
      const hash = (prom.project.lastTest as { evidenceHash?: string } | null)?.evidenceHash;
      const rec = JSON.parse(readFileSync(recordPath, "utf8")) as Project;
      assert.equal((rec.lastTest as { evidenceHash?: string } | null)?.evidenceHash, hash, "the emitted record carries the refreshed hash");
      assert.ok(rec.packet.includes(hash!), "the emitted record's own packet names the refreshed hash");
      assert.equal(rec.packet, compileAgentPacket(prom.project), "the promoted record's packet agrees with a fresh compile");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// W51/337-1 (336-2 §9.4) — the `repair` verb refreshes the run checkpoint.
// `repairTreeDir` mutates generatedTree / lastTest / the P6 gate without
// necessarily growing a bounded array, so the supersession growth axis alone
// cannot prove a stale snapshot is behind the file; the CLI passes the project
// dir and the repair now writes (or, on a terminal seal, clears) the snapshot
// exactly like runUntilGate.
// ---------------------------------------------------------------------------
describe("W51/337-1 — repairTreeDir refresh the run checkpoint (336-2 §9.4)", () => {
  const emptyCompile = { ok: false, dir: "", checked: 0, passed: 0, failed: 1, skipped: 0, verdicts: [] };
  const greenVerdict: TreeRunOutcome = {
    ok: true,
    dir: "",
    compile: { ...emptyCompile, ok: true, failed: 0, passed: 1, checked: 1 },
    tests: [
      { file: "tests/oracle.spec.ts", compile: "pass", run: "pass", tests: { pass: 1, fail: 0 }, detail: "1 passed" },
    ],
    run: { kind: "library", run: "skip", detail: "no entry to smoke" },
  };

  it("writes a resumable snapshot carrying the repaired ledger when given a checkpointDir", async () => {
    const dir = tempDir();
    const cpDir = tempDir();
    try {
      mkdirSync(join(dir, "src", "generated"), { recursive: true });
      writeFileSync(join(dir, "src", "generated", "hvac.ts"), "export const hvac = () => 1;\n");
      // Parked at P6 (not complete) so the repair's post-work exit takes the
      // WRITE arm, not the terminal-seal clear arm.
      const base = parkAt(createProject({ brief: FIXTURE_BRIEF }), 6);
      const candidate: Project = {
        ...base,
        generatedTree: [{ path: "src/generated/hvac.ts", source: "export const hvac = () => 1;", hash: "f1", attempt: 0 }],
      };
      assert.equal(readCheckpoint(cpDir).ok, false, "no snapshot before the repair");
      const res = await repairTreeDir(candidate, dir, {
        checkpointDir: cpDir,
        deps: { runTree: async () => greenVerdict },
      });
      const cp = readCheckpoint(cpDir);
      assert.equal(cp.ok, true, "the repair wrote a resumable snapshot (336-2 §9.4)");
      if (cp.ok) {
        assert.equal(cp.checkpoint.run.phase, res.project.currentPhase, "the snapshot re-enters at the repaired edge");
        assert.equal(cp.checkpoint.project.id, res.project.id);
        const snapTree = cp.checkpoint.project.generatedTree ?? [];
        assert.equal(snapTree.length, 1, "the snapshot carries the repaired tree, not a hollow copy");
        assert.equal(snapTree[0]?.path, "src/generated/hvac.ts");
        // The re-import refreshed the row hash from the on-disk bytes — the
        // repair really changed the ledger, which is why the snapshot matters.
        assert.notEqual(snapTree[0]?.hash, "f1", "the imported hash is the on-disk truth");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(cpDir, { recursive: true, force: true });
    }
  });

  it("without a checkpointDir the repair writes nothing (legacy bytes preserved)", async () => {
    const dir = tempDir();
    try {
      mkdirSync(join(dir, "src", "generated"), { recursive: true });
      writeFileSync(join(dir, "src", "generated", "hvac.ts"), "export const hvac = () => 1;\n");
      const base = parkAt(createProject({ brief: FIXTURE_BRIEF }), 6);
      const candidate: Project = {
        ...base,
        generatedTree: [{ path: "src/generated/hvac.ts", source: "export const hvac = () => 1;", hash: "f1", attempt: 0 }],
      };
      await repairTreeDir(candidate, dir, { deps: { runTree: async () => greenVerdict } });
      assert.equal(existsSync(checkpointPath(dir)), false, "no dir ⇒ no checkpoint, nowhere on disk");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
