// ---------------------------------------------------------------------------
// headless.test.ts — file-based headless driver suite (deterministic, no network).
//
// Run: node --experimental-strip-types --test src/lib/headless.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyVerifyOutcome,
  approve,
  createProject,
  driveP6Journey,
  emitProject,
  exportJson,
  ingest,
  loadProject,
  p6CycleLiveDeps,
  packet,
  reject,
  retry,
  runAcceptance,
  runPhase,
  runUntilGate,
  saveProject,
  summary,
  withCommonJsExports,
} from "./headless.ts";
import type { P6JourneyCycleContext } from "./headless.ts";
import { runGate } from "./dod.ts";
import { importProject } from "./io.ts";
import { FIXTURE_BRIEF } from "./testing/fixtures.ts";
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

  it("doctor returns the capability pre-flight shape (no project required)", () => {
    const r = runCli(["doctor"]);
    assert.equal(r.code, 0);
    assert.equal(r.json.ok, true);
    const doctor = r.json as {
      llm: { configured: boolean; label: string };
      research: { configured: boolean; probed: boolean; label: string };
      runner: { available: boolean };
      node: string;
    };
    assert.equal(typeof doctor.llm.configured, "boolean");
    assert.ok(typeof doctor.llm.label === "string" && doctor.llm.label.length > 0);
    assert.equal(typeof doctor.research.configured, "boolean");
    assert.equal(typeof doctor.research.probed, "boolean");
    assert.equal(typeof doctor.runner.available, "boolean");
    assert.match(doctor.node, /^v\d+/);
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
