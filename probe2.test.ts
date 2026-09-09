// Throwaway probe — DELETE after use. Part 2.
import { compileAgentPacket } from "./src/lib/packet.ts";
import { emptyProject, approveHitl } from "./src/lib/engine.ts";
import { phaseHandoff } from "./src/lib/handoff.ts";
import { exportProjectJson, importProject } from "./src/lib/io.ts";
import type { Project } from "./src/lib/types.ts";

const base = (): Project => emptyProject({ name: "Probe", brief: "Build a probe tool" });

function probe(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`OK    ${label}`);
  } catch (e) {
    console.log(`THROW ${label} — ${e instanceof Error ? e.constructor.name + ": " + e.message : String(e)}`);
  }
}

// 21. schedule = {} (foreign import, no fields)
probe("schedule empty object", () => {
  const p = base();
  p.schedule = {} as Project["schedule"];
  compileAgentPacket(p);
});
// 22. lattice = {} (foreign import, no complexity)
probe("lattice empty object", () => {
  const p = base();
  p.lattice = {} as Project["lattice"];
  compileAgentPacket(p);
});
// 23. lattice present but complexity undefined
probe("lattice complexity undefined", () => {
  const p = base();
  p.lattice = { ...p.lattice!, complexity: undefined as never };
  compileAgentPacket(p);
});
// 24. artifacts body numeric in handoff context
probe("handoff artifact numeric body", () => {
  const p = base();
  (p.artifacts as unknown[]).push({ id: "z", phase: 0, kind: "scorecard", title: "t", body: 42 });
  phaseHandoff(p, 1);
});
// 25. handoff artifact numeric title only
probe("handoff artifact numeric title", () => {
  const p = base();
  (p.artifacts as unknown[]).push({ id: "z", phase: 0, kind: "scorecard", title: 42, body: "b" });
  const out = phaseHandoff(p, 1);
  console.log("      title renders:", out.split("\n").find((l) => l.startsWith("- P0")));
});
// 26. io: export → import → export byte stability (clean full-run payload)
probe("io round-trip byte-stable", () => {
  const p = base();
  const once = exportProjectJson(p);
  const res = importProject(once);
  if (!res.ok) throw new Error("import failed: " + res.error);
  const twice = exportProjectJson(res.project);
  if (once !== twice) {
    // find first divergence
    const a = once.split("\n");
    const b = twice.split("\n");
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        console.log(`      first diff at line ${i + 1}:`);
        console.log(`        export: ${a[i]}`);
        console.log(`        re-imp: ${b[i]}`);
        break;
      }
    }
    throw new Error("byte-inequality");
  }
});
// 27. engine approveHitl on a phase record that is NOT awaiting_hitl
probe("approveHitl with record status ready (fabricated gate)", () => {
  const p = base();
  p.currentPhase = 4;
  p.phases = p.phases.map((r) =>
    r.id < 4
      ? { ...r, status: "complete" as const }
      : r.id === 4
        ? { ...r, status: "ready" as const }
        : r,
  );
  p.hitl = { phase: 4, title: "Gate P4", prompt: "Approve?", stakes: "fixture" };
  p.status = "running";
  const out = approveHitl(p, { decidedBy: "human" });
  const rec = out.phases.find((r) => r.id === 4);
  console.log(`      record P4 status after approveHitl: ${rec?.status}, decisions: ${out.decisions.length}, currentPhase: ${out.currentPhase}`);
});
// 28. what does hydrate do to the same payload (import path)?
probe("importProject keeps record ready + hitl mismatch", () => {
  const p = base();
  p.currentPhase = 4;
  p.phases = p.phases.map((r) =>
    r.id < 4
      ? { ...r, status: "complete" as const }
      : r.id === 4
        ? { ...r, status: "ready" as const }
        : r,
  );
  p.hitl = { phase: 4, title: "Gate P4", prompt: "Approve?", stakes: "fixture" };
  p.status = "running";
  const json = exportProjectJson(p);
  const res = importProject(json);
  if (!res.ok) throw new Error("import failed: " + res.error);
  const rec = res.project.phases.find((r) => r.id === 4);
  console.log(`      imported record P4: ${rec?.status}, hitl: ${res.project.hitl?.phase}`);
});
