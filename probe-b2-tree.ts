// probe-b2-tree.ts — exercise tree-mode assembly (fixes/144_m2_b2)
import { scaffoldProject } from "./src/lib/scaffold.ts";
import { ALL_PHASES, runHeadless, seedProject } from "./src/lib/testing/fixtures.ts";

const base = runHeadless(seedProject(), ALL_PHASES);

const domainSrc = [
  "// Domain types for the logistics brief (generated tree fixture).",
  "export interface Job {",
  "  id: string;",
  "  label: string;",
  "}",
  "",
  "export function jobLabel(job: Job): string {",
  "  return `[${job.id}] ${job.label}`;",
  "}",
  "",
].join("\n");

const entrySrc = [
  "// Tree ENTRY module — first job capability (dispatch).",
  'import { jobLabel } from "../domain/logistics.ts";',
  'import type { Job } from "../domain/logistics.ts";',
  "",
  "export function dispatch(job: Job): string {",
  "  return jobLabel(job);",
  "}",
  "",
  "export const CAPABILITY = \"dispatch\";",
  "",
].join("\n");

const extraSrc = [
  "// Extra tree file not aligned to any spec-graph node path.",
  "export function endpointCount(): number {",
  "  return 3;",
  "}",
  "",
].join("\n");

const treeProject = {
  ...base,
  generatedTree: [
    { path: "src/jobs/dispatch.ts", source: entrySrc, hash: "h-entry", attempt: 1 },
    { path: "src/domain/logistics.ts", source: domainSrc, hash: "h-domain", attempt: 0 },
    { path: "src/api/endpoints.ts", source: extraSrc, hash: "h-endpoints", attempt: 0 },
  ],
};

const r = scaffoldProject(treeProject);
if (!r.ok) { console.log("ERR", r.error); process.exit(1); }
console.log("== summary ==", r.summary);
console.log("== warnings ==", r.warnings ?? "(none)");
for (const f of r.files) console.log(f.path);
console.log("== dispatch body byte-identical? ==", r.files.find((f) => f.path === "src/jobs/dispatch.ts")?.body === entrySrc);
console.log("== bridge src/jobs/reroute.ts ==");
console.log(r.files.find((f) => f.path === "src/jobs/reroute.ts")?.body);
console.log("== ui file head ==");
const ui = r.files.find((f) => f.path === "src/ui/console.tsx")?.body ?? "";
console.log(ui.slice(0, 200));
console.log("== oracle spec (tree section) ==");
const spec = r.files.find((f) => f.path === "tests/oracle.spec.ts")?.body ?? "";
console.log(spec.slice(0, 1600));
