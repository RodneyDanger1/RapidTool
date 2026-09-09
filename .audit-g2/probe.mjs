// G2 AUDITOR probe — deterministic refused-P6 journey + lesson read-back.
// Runs real engine/headless/knowledge/codegen code; keyless except where a
// fake DEEPSEEK_API_KEY + injected failing deps force a deterministic refusal.
import { applyPhaseResult, emptyProject } from "../src/lib/engine.ts";
import { runUntilGate, approve } from "../src/lib/headless.ts";
import { runToGate, seedProject } from "../src/lib/testing/fixtures.ts";
import { liveP6Synthesis } from "../src/lib/codegen.server.ts";
import { selectLessons, lessonRow, verifyOutcomeLesson, templateEmissionLesson } from "../src/lib/knowledge.ts";
import { lessonLinesForBrief, EXPAND_LESSON_RANK_LIMIT } from "../src/lib/prompt-engine.ts";
import { fnv1a } from "../src/lib/algorithms.ts";

await import("../src/lib/knowledge.ts"); // warm engine lazy lesson seam

const show = (title, rows) => {
  console.log(`\n=== ${title} ===`);
  for (const r of rows) {
    console.log(`- id=${r.id} kind=${r.kind} phase=${r.phase} score=${r.score} source=${r.source}`);
    console.log(`  tags=[${(r.tags ?? []).join(",")}]`);
    console.log(`  text=${r.text}`);
  }
  if (rows.length === 0) console.log("(no lesson rows)");
};

async function drain(p, opts = {}) {
  let cur = p;
  for (let i = 0; i < 50; i++) {
    if (cur.status === "complete" || cur.status === "blocked") return cur;
    const res = await runUntilGate(cur, { maxSteps: 1, live: false, ...opts });
    cur = res.project;
    if (cur.status === "awaiting_hitl") cur = approve(cur);
  }
  return cur;
}

// ---------------------------------------------------------------- journey 1
// Deterministic P6 "refused" seal (keyless floor: template emission red gate).
console.log("# JOURNEY 1 — deterministic P6 seal (keyless refused-equivalent)");
const parked6 = runToGate(seedProject(), 6);
const sealed6 = applyPhaseResult(parked6, 6);
const rec6 = sealed6.phases.find((p) => p.id === 6);
console.log(`P6 gate after seal: passed=${rec6?.gate?.passed} unmet=${JSON.stringify(rec6?.gate?.unmet)}`);
show("L2 template-emission row(s) at P6 seal", sealed6.memory.filter((m) => /^lesson-template-emission-/.test(m.id)));

// ---------------------------------------------------------------- journey 2
// Full keyless drain to completion — the honest CLI journey.
console.log("\n# JOURNEY 2 — full keyless drain to completion");
const done = await drain(seedProject());
console.log(`status=${done.status}`);
show("all lesson rows at run completion", done.memory.filter((m) => (m.tags ?? []).includes("lesson")));
const caps = done.logs.filter((l) => l.event === "lesson.capture").map((l) => l.detail);
console.log(`lesson.capture events (${caps.length}):`);
caps.forEach((c) => console.log(`  - ${c}`));

// ---------------------------------------------------------------- journey 3a
// Keyed refusal over a RED deterministic floor (seal L2 exists): liveP6Synthesis
// with injected failing deps appends the real p6.synthesis.refused log.
console.log("\n# JOURNEY 3a — keyed P6 refusal over red floor (dedupe keeps ONE L2)");
process.env.DEEPSEEK_API_KEY = "probe-dummy";
const refused3a = await liveP6Synthesis(sealed6, {
  expand: async () => ({ ok: false, reason: "error", error: "PROBE expand refused" }),
});
const refLog = refused3a.logs.filter((l) => l.event === "p6.synthesis.refused").map((l) => l.detail);
console.log(`refusal log: ${JSON.stringify(refLog)}`);
const drained3a = await drain(refused3a);
show("P6 L2 rows after drain (expect exactly the seal row)", drained3a.memory.filter((m) => m.phase === 6 && /^lesson-template-emission-/.test(m.id)));

// ---------------------------------------------------------------- journey 3b
// Keyed refusal on a P6 parked at a NON-forceHuman extraHitl gate (the one real
// shape where the engine seal site is skipped — needsHitl — so no seal L2 exists
// and the headless refusal-site can mint its refusal-class row).
console.log("\n# JOURNEY 3b — keyed P6 refusal while parked at extraHitl (refusal-class L2 expected)");
// health-ops domain → scheduleConstraints adds extraHitl[6] (hitlBias 1), so the
// real engine parks P6 awaiting_hitl (non-forceHuman) and liveP6Synthesis runs.
const hitl6 = seedProject({
  name: "Health",
  brief: "Build a patient intake portal for a clinic: appointments, HIPAA-compliant medical records, billing.",
});
const parked6b = runToGate(hitl6, 6);
const gSealed = parked6b; // already sealed awaiting_hitl by the real engine (extraHitl)
const rec6b = gSealed.phases.find((p) => p.id === 6);
console.log(`domain=${gSealed.lattice?.domain} extraHitl=[${(gSealed.schedule?.extraHitl ?? []).join(",")}]`);
console.log(`P6 after runToGate: status=${rec6b?.status} hitl.phase=${gSealed.hitl?.phase} hitl.forceHuman=${gSealed.hitl?.forceHuman} sealL2=${gSealed.memory.some((m) => m.phase === 6 && /^lesson-template-emission-/.test(m.id))}`);
const refused3b = await liveP6Synthesis(gSealed, {
  expand: async () => ({ ok: false, reason: "error", error: "PROBE expand refused" }),
});
console.log(`refusal log: ${JSON.stringify(refused3b.logs.filter((l) => l.event === "p6.synthesis.refused").map((l) => l.detail))}`);
const drained3b = await drain(refused3b);
show("P6 lesson rows after approve+drain (refusal-class row expected)", drained3b.memory.filter((m) => m.phase === 6 && /^lesson-template-emission-/.test(m.id)));

// ---------------------------------------------------------------- read-back probe
console.log("\n# READ-BACK — selectLessons -> lessonLinesForBrief (what liveP6Synthesis feeds expand)");
const brief = seedProject().brief;
const l2 = templateEmissionLesson(sealed6, 6, ["p6-verified", "p6-brief-fit"], ["hvac", "dispatch"], "abc123");
const l3 = verifyOutcomeLesson("failed", 6, "cases still failing: reroute overlap", 3);
const mem = [...sealed6.memory, l2, l3].filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i);
const sel = selectLessons(mem, 6, EXPAND_LESSON_RANK_LIMIT);
console.log(`selected ${sel.length} lesson rows for P6 expansion (rank limit ${EXPAND_LESSON_RANK_LIMIT}):`);
sel.forEach((r) => console.log(`  - [${(r.tags ?? []).join(",")}] ${r.text.slice(0, 90)}`));
const lines = lessonLinesForBrief(brief, sel, { limit: EXPAND_LESSON_RANK_LIMIT });
console.log("lesson lines rendered for expandBrief:");
lines.forEach((ln) => console.log(`  ${ln.slice(0, 160)}`));

// spec-reuse short-circuit: after a successful expansion, same-brief re-run must
// NOT consult lessons (spec cached by briefHash).
console.log("\n# READ-BACK — spec cache short-circuit (same-brief re-run skips lessons)");
const spec = {
  requirements: ["Build an HVAC dispatch board"], edgeCases: [], errorHandling: [],
  typeSignatures: ["dispatch(jobs: Job[]): void"], dataFlow: [], negativeConstraints: [],
  source: "p6", briefHash: String(fnv1a(brief)), createdAt: Date.now(),
};
const cachedProj = { ...drained3a, implementationSpec: spec };
let expandCalled = false;
const refusedCache = await liveP6Synthesis(cachedProj, {
  expand: async () => { expandCalled = true; return { ok: false, reason: "error", error: "should-not-expand" }; },
  complete: async () => ({ ok: false, reason: "error", error: "PROBE synthesis refused" }),
});
console.log(`spec reused (expand NOT called): ${!expandCalled}`);
console.log(`refusal code present: ${JSON.stringify(refusedCache.logs.filter((l) => l.event === "p6.synthesis.refused").map((l) => l.detail))}`);

// and the no-cache case: lessons DO reach expand
let receivedLessons;
const noCache = { ...drained3a, implementationSpec: null };
await liveP6Synthesis(noCache, {
  expand: async (_b, lessons) => { receivedLessons = lessons; return { ok: false, reason: "error", error: "PROBE expand refused" }; },
});
console.log(`no-cache run: expand received ${Array.isArray(receivedLessons) ? receivedLessons.length : typeof receivedLessons} lesson line(s)`);
if (Array.isArray(receivedLessons)) receivedLessons.forEach((l) => console.log(`  ${l.slice(0, 160)}`));

delete process.env.DEEPSEEK_API_KEY;
console.log("\nPROBE COMPLETE");
