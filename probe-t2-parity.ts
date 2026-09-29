// T2 probe: enumerate exact byte diffs for the three parity pins (headless W-02,
// wild #5 sink, wild W-01 seam) after their existing normalizers.
import { createProject, runPhase, runP6Edge, runUntilGate, approve } from "./src/lib/headless.ts";
import { emptyProject, applyPhaseResult, wildStep, type WildReviewer } from "./src/lib/engine.ts";
import type { Project } from "./src/lib/types.ts";
import { FIXTURE_BRIEF } from "./src/lib/testing/fixtures.ts";
import { packetInputHash } from "./src/lib/packet.ts";

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

type Out = string[];
function walk(a: unknown, b: unknown, path: string, out: Out, depth = 0): void {
  if (out.length > 60 || depth > 8) return;
  if (a === b) return;
  if (typeof a === "string" && typeof b === "string") {
    if (a !== b) {
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      out.push(`${path} @${i}\n  A: ${JSON.stringify(a.slice(Math.max(0, i - 40), i + 80))}\n  B: ${JSON.stringify(b.slice(Math.max(0, i - 40), i + 80))}`);
    }
    return;
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    out.push(`${path}\n  A: ${JSON.stringify(a)}\n  B: ${JSON.stringify(b)}`);
    return;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (!(k in ao) || !(k in bo)) {
      out.push(`${path}.${k}: key {{onlyA:${!(k in bo)} onlyB:${!(k in ao)}}}`);
      continue;
    }
    walk(ao[k], bo[k], `${path}.${k}`, out, depth + 1);
  }
}

function report(label: string, a: unknown, b: unknown): void {
  const out: Out = [];
  walk(a, b, "$", out);
  console.log(`\n===== ${label}: ${out.length} diff(s)`);
  for (const line of out.slice(0, 25)) console.log(line);
}

const savedKey = process.env.DEEPSEEK_API_KEY;
delete process.env.DEEPSEEK_API_KEY;
try {
  // ---- red #1: headless W-02 -------------------------------------------------
  {
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
    const floor = await runPhase(rewound, 6);
    report("W-02 raw floored vs floor", floored, floor);
    const stripVolatiles = (s: string) =>
      s.replace(/compiled_at: [^\n]+/g, "compiled_at: FIXED").replace(/"compiled_at": "[^"]+"/g, '"compiled_at": "FIXED"');
    const strip = (p: Project) => ({
      ...p,
      logs: (p.logs ?? []).map((l) => ({ ...l, ts: 0 })),
      traces: (p.traces ?? []).map((a) => ({ ...a, ranAt: 0 })),
      artifacts: (p.artifacts ?? []).map((a) => ({ ...a, body: typeof a.body === "string" ? stripVolatiles(a.body) : a.body })),
      packet: stripVolatiles(p.packet),
      phases: (p.phases ?? []).map((r) => ({
        ...r,
        startedAt: typeof r.startedAt === "number" ? 0 : r.startedAt,
        completedAt: typeof r.completedAt === "number" ? 0 : r.completedAt,
        gate: r.gate && typeof r.gate === "object" ? { ...(r.gate as object), checkedAt: 0 } : r.gate,
      })),
    });
    report("W-02 after strip()", strip(floored), strip(floor));
    // hash-fold inputs on each side: zero the time-bearing fields, recompute
    const hashNorm = (p: Project) => packetInputHash({
      ...p,
      createdAt: 0,
      logs: (p.logs ?? []).map((l) => ({ ...l, ts: 0 })),
      decisions: (p.decisions ?? []).map((d) => ({ ...d, decidedAt: 0 })),
    } as Project);
    console.log("hashNorm floored:", hashNorm(floored), "floor:", hashNorm(floor));
    console.log("embedded occurrences floored:", (JSON.stringify(floored).match(/input_hash/g) ?? []).length,
      "floor:", (JSON.stringify(floor).match(/input_hash/g) ?? []).length);
  }
  // ---- red #5: wild sink parity ----------------------------------------------
  {
    const notConfiguredReviewer: WildReviewer = async () => ({ ok: false, reason: "not-configured", error: "no key" });
    const wildFixture = (status: "locked" | "rejected" | "awaiting_hitl"): Project => {
      const p = emptyProject({ name: "Wild", brief: "A wild brief for the autonomous loop." });
      p.wildMode = true;
      p.wildRun = { active: true, phase: 0, startedAt: Date.now(), lastAutoLog: "Wild run started at P0", lastAutoAt: Date.now(), stoppedAt: null, pause: false };
      p.currentPhase = 0;
      p.status = status === "awaiting_hitl" ? "awaiting_hitl" : "running";
      p.phases[0] = { ...p.phases[0], status };
      if (status === "awaiting_hitl") p.hitl = { phase: 0, title: "P0 reframe gate", prompt: "Approve the reframe?", stakes: "high", forceHuman: false };
      return p;
    };
    const withSink = await wildStep(wildFixture("awaiting_hitl"), { reviewer: notConfiguredReviewer, onEvent: () => undefined });
    const without = await wildStep(wildFixture("awaiting_hitl"), { reviewer: notConfiguredReviewer });
    const normalize = (p: Project) => ({
      ...p,
      id: "fixture",
      createdAt: 0,
      logs: p.logs.map((l) => ({ ...l, ts: 0 })),
      packet: p.packet.replace(/compiled_at: [^\n]+/g, "compiled_at: FIXED").replace(/project_id: [^\n]+/g, "project_id: FIXED").replace(/"compiled_at": "[^"]+"/g, '"compiled_at": "FIXED"').replace(/"project_id": "[^"]+"/g, '"project_id": "FIXED"'),
      traces: (p.traces ?? []).map((a) => ({ ...a, ranAt: 0 })),
      wildRun: p.wildRun ? { ...p.wildRun, startedAt: 0, lastAutoAt: 0 } : p.wildRun,
    });
    report("wild #5 raw", withSink.project, without.project);
    report("wild #5 after normalize()", normalize(withSink.project), normalize(without.project));
  }
  // ---- red #6: W-01 seam parity ----------------------------------------------
  {
    const notConfiguredReviewer: WildReviewer = async () => ({ ok: false, reason: "not-configured", error: "no key" });
    const p6WildFixture = (): Project => {
      const p = emptyProject({ name: "WildP6", brief: "A wild brief for the autonomous loop." });
      p.wildMode = true;
      p.wildRun = { active: true, phase: 6, startedAt: Date.now(), lastAutoLog: "Wild run at P6", lastAutoAt: Date.now(), stoppedAt: null, pause: false };
      p.currentPhase = 6;
      p.status = "running";
      p.phases = p.phases.map((r) => (r.id < 6 ? { ...r, status: "complete" as const } : r.id === 6 ? { ...r, status: "ready" as const } : r));
      return p;
    };
    const seamless = await wildStep(p6WildFixture(), { reviewer: notConfiguredReviewer });
    const control = await wildStep(p6WildFixture(), { reviewer: notConfiguredReviewer, p6Edge: async (q) => applyPhaseResult(q, 6) });
    const stripVolatiles = (s: string) =>
      s.replace(/compiled_at: [^\n]+/g, "compiled_at: FIXED").replace(/project_id: [^\n]+/g, "project_id: FIXED").replace(/"compiled_at": "[^"]+"/g, '"compiled_at": "FIXED"').replace(/"project_id": "[^"]+"/g, '"project_id": "FIXED"');
    const normalize = (p: Project) => ({
      ...p,
      id: "fixture",
      createdAt: 0,
      artifacts: (p.artifacts ?? []).map((a) => ({ ...a, body: stripVolatiles(a.body) })),
      logs: (p.logs ?? []).map((l) => (l.event === "wild.exec" ? { ...l, ts: 0, detail: "FIXED" } : { ...l, ts: 0 })),
      packet: stripVolatiles(p.packet),
      traces: (p.traces ?? []).map((a) => ({ ...a, ranAt: 0 })),
      wildRun: p.wildRun ? { ...p.wildRun, startedAt: 0, lastAutoAt: 0 } : p.wildRun,
      phases: (p.phases ?? []).map((r) => ({
        ...r,
        startedAt: r.startedAt === null ? null : 0,
        completedAt: typeof r.completedAt === "number" ? 0 : r.completedAt,
        gate: r.gate && typeof r.gate === "object" ? { ...(r.gate as object), checkedAt: 0 } : r.gate,
      })),
    });
    report("W-01 raw", seamless.project, control.project);
    report("W-01 after normalize()", normalize(seamless.project), normalize(control.project));
  }
} finally {
  if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = savedKey;
}
