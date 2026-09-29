// C1 scratch probe — step arithmetic + stock-gate behavior (read-only, no keyed calls).
import { emptyProject, wildStep } from "./src/lib/engine.ts";

const approveReviewer = async () => ({
  ok: true,
  verdict: "approve",
  feedback: "Approved after reviewing the phase artifacts and the recorded criteria in detail.",
  model: "probe",
});

const p0 = emptyProject({
  name: "Arith Probe",
  brief:
    "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.",
});

let p = p0;
p.wildMode = true;
p.wildRun = {
  active: true,
  phase: 0,
  startedAt: Date.now(),
  lastAutoLog: "probe",
  lastAutoAt: Date.now(),
  stoppedAt: null,
  pause: false,
};

const rows = [];
for (let step = 1; step <= 30; step++) {
  const before = p.currentPhase;
  const rec = p.phases.find((r) => r.id === before);
  const res = await wildStep(p, { reviewer: approveReviewer });
  const evs = (res.project.logs ?? []).slice(-3).map((l) => l.event).join(",");
  rows.push(
    `${String(step).padStart(2)} | in=P${before}(${rec?.status}) out=${res.outcome} cur=${res.project.currentPhase} pause=${res.project.wildRun?.pause} code=${res.code ?? "-"} | ${evs}`,
  );
  p = res.project;
  if (res.outcome !== "advanced") break;
}
console.log(rows.join("\n"));
console.log("FINAL status:", p.status, "decisions:", p.decisions.map((d) => `P${d.phase}:${d.decidedBy}`).join(" "));
