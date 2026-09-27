// B1 evidence probe (rescued by K1 — see fixes/290_k1_components.md §F1):
// replicate runtime-timeline-pane's exact pipeline and show whether the
// newest-first rtTail() feed mispairs spans. This file was committed at
// 2fa3cd9 as a repo-root scratch accident; kept as durable evidence, moved
// under fixes/ and its import path rebased. Run from the repo root:
//   node --experimental-strip-types fixes/290_k1_timeline_probe.mjs
import { parseTimeline, summarizeTimeline } from "../src/lib/rt-timeline.ts";

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

// K1/290 addendum (F3): the pane's "paired" badge, old vs fixed, on both feeds.
// Old count = rows carrying a duration (both ends of a pair -> doubles a span).
// Fixed count = rows that closed a span (`closes !== null`) -> one per pair.
const oldPaired = (rows) => rows.filter((r) => r.durationMs !== null).length;
const newPaired = (rows) => rows.filter((r) => r.closes !== null).length;
console.log("pane 'paired' OLD (rows w/ duration):", JSON.stringify({ newestFirst: oldPaired(bad), chronological: oldPaired(good) }));
console.log("pane 'paired' FIXED (closed spans):  ", JSON.stringify({ newestFirst: newPaired(bad), chronological: newPaired(good) }));
