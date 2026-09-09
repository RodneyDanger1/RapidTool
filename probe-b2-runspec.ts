// probe-b2-runspec.ts — materialize the tree-mode scaffold to a temp dir and
// execute the emitted oracle spec under node --test (real cross-file imports).
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { scaffoldProject } from "./src/lib/scaffold.ts";
import { ALL_PHASES, runHeadless, seedProject } from "./src/lib/testing/fixtures.ts";

const base = runHeadless(seedProject(), ALL_PHASES);
const domainSrc = [
  "export interface Job { id: string; label: string; }",
  "export function jobLabel(job: Job): string {",
  "  return `[${job.id}] ${job.label}`;",
  "}",
].join("\n");
const entrySrc = [
  'import { jobLabel } from "../domain/logistics.ts";',
  'import type { Job } from "../domain/logistics.ts";',
  "export function dispatch(job: Job): string { return jobLabel(job); }",
  'export const CAPABILITY = "dispatch";',
].join("\n");
const extraSrc = ["export function endpointCount(): number { return 3; }"].join("\n");
const p = {
  ...base,
  generatedTree: [
    { path: "src/jobs/dispatch.ts", source: entrySrc, hash: "h-entry", attempt: 1 },
    { path: "src/domain/logistics.ts", source: domainSrc, hash: "h-domain", attempt: 0 },
    { path: "src/api/endpoints.ts", source: extraSrc, hash: "h-endpoints", attempt: 0 },
  ],
};
const r = scaffoldProject(p);
if (!r.ok) { console.log("ERR", r.error); process.exit(1); }
const dir = mkdtempSync(join(tmpdir(), "rapidtool-b2-"));
for (const f of r.files) {
  const full = join(dir, f.path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, f.body, "utf8");
}
const res = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--test", "tests/oracle.spec.ts"],
  { cwd: dir, encoding: "utf8", timeout: 60000 },
);
console.log("== status ==", res.status);
console.log("== stdout tail ==", String(res.stdout ?? "").split("\n").slice(-18).join("\n"));
console.log("== stderr tail ==", String(res.stderr ?? "").split("\n").slice(-6).join("\n"));
rmSync(dir, { recursive: true, force: true });
process.exit(res.status ?? 1);
