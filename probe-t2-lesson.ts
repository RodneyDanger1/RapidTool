// T2 probe #2: the lesson-writers P6 red-seal digest failure — print the seal
// detail + segment lengths.
import { applyPhaseResult } from "./src/lib/engine.ts";
import { runGate } from "./src/lib/dod.ts";
import { runToGate, seedProject } from "./src/lib/testing/fixtures.ts";
import { lessonEvidenceDetail } from "./src/lib/knowledge.ts";
import type { PhaseId, Project } from "./src/lib/types.ts";

await import("./src/lib/knowledge.ts");

const parked = runToGate(seedProject(), 6);
const withRefusal: Project = {
  ...parked,
  logs: [
    ...(parked.logs ?? []),
    {
      ts: 6,
      phase: 6 as PhaseId,
      level: "warn" as const,
      event: "p6.synthesis.refused",
      detail: "RT_E_LLM_REJECTED · the pro tier refused to emit an offline warehouse scan module",
    },
  ],
};
const out = applyPhaseResult(withRefusal, 6);
const seal = out.logs.find((l) => l.event === "p6.seal.unmet");
console.log("SEAL DETAIL (len " + (seal?.detail.length ?? -1) + "):");
console.log(JSON.stringify(seal?.detail));

// raw segments as fitLessonEvidence sees them
const g = runGate(withRefusal, 6);
console.log("gate pass:", g.pass, "unmet count:", g.unmet.length);
for (const u of g.unmet) console.log("  criterion len", u.criterion.length, JSON.stringify(u.criterion.slice(0, 200)));
const digest = lessonEvidenceDetail(g.unmet.map((x) => x.criterion), "RT_E_LLM_REJECTED", "the pro tier refused to emit an offline warehouse scan module");
console.log("RAW DIGEST (len " + digest.length + "):");
console.log(JSON.stringify(digest));
console.log("SEGMENTS:");
for (const s of digest.split(" · ")) console.log("  [" + s.length + "] " + JSON.stringify(s.slice(0, 160)));
