// fixes/314_f5_probe_doors.mjs — F5 door probe (keyless, NO keyed calls).
// Proves: (1) bare/non-TTY approve refuses with its next step; (2) --seat
// autopilot is an explicit working machine door; (3) a NON-TTY agent can drive
// gate --autopilot → approve --seat autopilot → … to a complete seal (the
// 311 K1 remedy's alternative: "a documented --seat autopilot non-TTY
// approval"). Read-only against the repo; writes only into a temp dir.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const CLI = resolve("scripts/rapidtool-cli.mjs");
const dir = mkdtempSync(join(tmpdir(), "f5doors-"));
const file = join(dir, "probe.json");
function cli(args) {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", CLI, ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
    timeout: 300000,
  });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* non-JSON output — keep null */ }
  return { code: r.status ?? -1, json };
}
const rows = [];
const c = cli(["create", "--brief", "Probe: a kanban board with four jobs (assign, dispatch, schedule, track) over a REST API with SQLite.", "--name", "f5doors", "--out", file, "--advisory"]);
rows.push(["create", `exit ${c.code}`]);
const g1 = cli(["gate", "--project", file, "--autopilot"]);
rows.push(["gate --autopilot #1", `exit ${g1.code}`, `P${g1.json?.summary?.currentPhase} ${g1.json?.summary?.status}`]);
const bare = cli(["approve", "--project", file]);
rows.push(["approve (bare, non-TTY)", `exit ${bare.code}`, bare.json?.json?.code ?? bare.json?.code, `remedy names --seat autopilot: ${String(bare.json?.remedy ?? "").includes("--seat autopilot")}`]);
const bogus = cli(["approve", "--project", file, "--seat", "bogus"]);
rows.push(["approve --seat bogus", `exit ${bogus.code}`]);
const both = cli(["approve", "--project", file, "--seat", "autopilot", "--i-am-human"]);
rows.push(["approve --seat autopilot --i-am-human", `exit ${both.code}`]);
let status = g1.json?.summary?.status;
let phase = g1.json?.summary?.currentPhase;
for (let i = 0; i < 16 && status !== "complete"; i++) {
  const a = cli(["approve", "--project", file, "--seat", "autopilot"]);
  if (a.code !== 0) { rows.push([`approve --seat autopilot @P${phase}`, `exit ${a.code}`, String(a.json?.error ?? "").slice(0, 90)]); break; }
  status = a.json?.summary?.status;
  phase = a.json?.summary?.currentPhase;
  const g = cli(["gate", "--project", file, "--autopilot"]);
  status = g.json?.summary?.status;
  phase = g.json?.summary?.currentPhase;
  rows.push([`gate @-> P${phase}`, `exit ${g.code}`, status]);
  if (g.code !== 0 && g.code !== 2) { rows.push(["gate error", String(g.json?.error ?? "").slice(0, 110)]); break; }
}
const proj = JSON.parse(readFileSync(file, "utf8"));
rows.push(["FINAL", `phase ${proj.currentPhase}`, `status ${proj.status}`, `decisions ${proj.decisions?.length ?? 0}`]);
rows.push(["DECISION SEATS", JSON.stringify((proj.decisions ?? []).map((d) => d.decidedBy))]);
console.log(rows.map((r) => r.join(" | ")).join("\n"));
rmSync(dir, { recursive: true, force: true });
