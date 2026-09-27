// B1 evidence probe: replicate runtime-timeline-pane's exact pipeline and show
// whether newest-first tail input mispairs spans.
import { parseTimeline, summarizeTimeline } from "./src/lib/rt-timeline.ts";

const start = { ts: 1000, level: "info", scope: "wild-driver", event: "wild.step_start", message: "step start" };
const okRow = { ts: 1500, level: "info", scope: "wild-driver", event: "wild.step_ok", message: "step ok" };

// Chronological ring rows -> rtTail(): slice(-n).reverse() === newest-first (same as pane feed today)
const chronological = [start, okRow];
const newestFirstTail = [...chronological].slice(-50).reverse();

const asLines = (rows) => rows.map((r) => JSON.stringify(r));

const bad = parseTimeline(asLines(newestFirstTail));
const good = parseTimeline(asLines(chronological));

console.log("FEED newest-first (today's pane):");
for (const r of bad) console.log(`  L${r.line} ${r.event} status=${r.status} closes=${r.closes} closedBy=${r.closedBy} dur=${r.durationMs}`);
console.log("  summary:", JSON.stringify(summarizeTimeline(bad)));

console.log("FEED chronological (fixed):");
for (const r of good) console.log(`  L${r.line} ${r.event} status=${r.status} closes=${r.closes} closedBy=${r.closedBy} dur=${r.durationMs}`);
console.log("  summary:", JSON.stringify(summarizeTimeline(good)));
