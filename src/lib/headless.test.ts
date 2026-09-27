// ---------------------------------------------------------------------------
// headless.test.ts — file-based headless driver suite (deterministic, no network).
//
// Run: node --experimental-strip-types --test src/lib/headless.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  ingest,
  loadProject,
  p6CycleLiveDeps,
  packet,
  reject,
  repairTreeDir,
  retry,
  runAcceptance,
  runPhase,
  runP6Edge,
  runUntilGate,
  saveProject,
  summary,
  wildPauseRun,
  wildResumeRun,
  wildStartRun,
  wildStopRun,
  withCommonJsExports,
} from "./headless.ts";
import type { ApproveActor, P6JourneyCycleContext } from "./headless.ts";
import { runGate } from "./dod.ts";
import { importProject } from "./io.ts";
import { evaluatePolicy } from "./policy.ts";
import { FIXTURE_BRIEF } from "./testing/fixtures.ts";
import { fnv1a } from "./algorithms.ts";
import type { PhaseId, Project } from "./types.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";

const tempDir = (): string => mkdtempSync(join(tmpdir(), "rapidtool-headless-"));

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
    assert.equal(runCalls, 3, "green tree-run on cycle 3 stops the loop (red gate is terminal)");
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
      // already masked). Strip those; every behavior byte stays compared.
      const floor = await runPhase(rewound, 6);
      const stripVolatiles = (s: string) =>
        s
          .replace(/compiled_at: [^\n]+/g, "compiled_at: FIXED")
          .replace(/"compiled_at": "[^"]+"/g, '"compiled_at": "FIXED"');
      const strip = (p: Project) => ({
        ...p,
        logs: (p.logs ?? []).map((l) => ({ ...l, ts: 0 })),
        traces: (p.traces ?? []).map((a) => ({ ...a, ranAt: 0 })),
        artifacts: (p.artifacts ?? []).map((a) => ({
          ...a,
          body: typeof a.body === "string" ? stripVolatiles(a.body) : a.body,
        })),
        packet: stripVolatiles(p.packet),
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
    assert.equal(rdeps!.synthesisRefusal!.length, 200, "bounded to the ~200-char refusal cap");
    // Both evidence kinds ride together when both exist.
    const both = p6CycleLiveDeps({ cycle: 3, treeFailureTail: tail, refusal });
    assert.deepEqual(Object.keys(both!).sort(), ["synthesisRefusal", "treeFailure"]);
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
    assert.equal(p.phases.find((r) => r.id === 4)?.gate, undefined);
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

  it("emit --run: treeRun{compile,tests,run} rides the envelope; a green tree exits 0 (fixes/147 E-15)", async () => {
    const dir = tempDir();
    try {
      const path = join(dir, "drained.json");
      const drained = await drainToComplete(createProject({ brief: FIXTURE_BRIEF }));
      assert.equal(drained.status, "complete", "drain must complete so the scaffold emits a full tree");
      saveProject(path, drained);
      const out = join(dir, "tree");
      const r = runCli(["emit", "--project", path, "--out", out, "--run"]);
      assert.equal(r.code, 0, `green tree must exit 0; stderr: ${r.stderr.slice(0, 300)}`);
      assert.equal(r.json.ok, true);
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

  it("refuses foreign leftover without --force; keeps it with force", async () => {
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
        assert.ok(forced.survivors.includes("NOTES.md"));
        assert.equal(existsSync(join(dir, "NOTES.md")), true);
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
