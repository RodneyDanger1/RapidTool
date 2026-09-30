// probe-h6-lessonchain.mjs — H6 / T7.1: the lesson-consumption trace, EXECUTED
// (keyless, deterministic, no network). One REAL lesson row minted through
// knowledge.lessonRow (the same builder the L1/L2/L5 mint sites use) is placed
// into project.memory and traced to (a) the compiled agent packet's
// ranked-memory section and (b) the P6 synthesis prompt's PRIOR LESSONS block.
import { createProject } from "./src/lib/headless.ts";
import { compileAgentPacket } from "./src/lib/packet.ts";
import {
  EXPAND_LESSON_RANK_LIMIT,
  lessonLinesForBrief,
  lessonRow,
  selectLessons,
} from "./src/lib/knowledge.ts";
import { p6SynthesisUserPrompt } from "./src/lib/codegen.server.ts";

const brief = "build a kanban board with drag-and-drop columns and per-card due dates";
const p = createProject({ brief });
const row = lessonRow({
  classShort: "template-emission",
  level: "L2",
  kind: "procedural",
  phase: 6,
  text: "PRIOR-RUN LESSON: the emitted tree must export a real entry module (kanban probe)",
  score: 0.95,
  source: "engine",
  signature: "probe-h6:kanban-entry",
});
const withLesson = { ...p, memory: [...(p.memory ?? []), row] };

const packetText = compileAgentPacket(withLesson);
const lines = lessonLinesForBrief(
  brief,
  selectLessons(withLesson.memory, 6, EXPAND_LESSON_RANK_LIMIT),
);
const prompt = p6SynthesisUserPrompt(
  brief,
  {
    requirements: ["r1"],
    edgeCases: [],
    errorHandling: [],
    typeSignatures: [],
    dataFlow: [],
    negativeConstraints: [],
  },
  lines,
);

const report = {
  rowId: row.id,
  rowTags: row.tags,
  memoryCarriesRow: (withLesson.memory ?? []).some((m) => m.id === row.id),
  packetCarriesLesson: packetText.includes(row.text),
  lessonLines: lines.length,
  linesCarryLesson: lines.some((l) => l.includes(row.text)),
  promptHasPriorLessonsBlock: prompt.includes("PRIOR LESSONS"),
  promptCarriesLesson: prompt.includes(row.text),
};
console.log(JSON.stringify(report, null, 1));
const ok =
  report.memoryCarriesRow &&
  report.packetCarriesLesson &&
  report.linesCarryLesson &&
  report.promptHasPriorLessonsBlock &&
  report.promptCarriesLesson;
process.exit(ok ? 0 : 1);
