// probe-b2-before.ts — capture the legacy scaffold emission baseline (fixes/144_m2_b2 before-evidence)
import { scaffoldProject } from "./src/lib/scaffold.ts";
import { ALL_PHASES, runHeadless, seedProject } from "./src/lib/testing/fixtures.ts";

const p = runHeadless(seedProject(), ALL_PHASES);
console.log("== spec graph ==");
for (const n of p.specGraph!.nodes) console.log(`${n.id}\t${n.file}`);
console.log("== generatedSource template?", /^const JOBS = \[/.test(p.generatedSource.trim()), "len", p.generatedSource.length);
console.log("== oracle rows", p.oracle.length);
const r = scaffoldProject(p);
if (!r.ok) { console.log("ERR", r.error); process.exit(1); }
console.log("== emitted files (legacy) ==");
for (const f of r.files) console.log(f.path);
console.log("== summary ==", r.summary);
