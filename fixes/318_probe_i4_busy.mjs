// MOVED (W44 · 318_a4): was repo-root probe-i4-busy.mjs — runnable as before.
// Run from the repo root: node --experimental-strip-types fixes/318_probe_i4_busy.mjs
// Path fix on move: ROOT now resolves the parent dir (file lives in fixes/) so the
// CLI path still targets <repo>/scripts/rapidtool-cli.mjs (same target; no logic change).
// probe-i4-busy.mjs — M6-04 (316 · I4) evidence probe: `ingest ∥ run` lost update.
//
// Scenarios (all keyless, temp-dir cwd, real CLI child processes):
//   A. LIVE lock held by this process while `run` drives → the save MUST refuse
//      CODED at the run verb (exit 1 + RT_E_BUSY + preserved checkpoint pointer).
//      Pre-fix truth (captured below): exit 4 (INTERNAL class) + the run's
//      completed phase work discarded (the project file never advanced).
//   B. No lock → `run` behaves normally (control arm).
//   C. DEAD-pid lock (SIGKILL residue) → the run's save reclaims the orphan
//      (fixes/310 reclaimStaleLock discipline, reached via saveProjectBusyAware)
//      and proceeds — an orphaned lock can never wedge the run verb.
//
// Run: node --experimental-strip-types fixes/318_probe_i4_busy.mjs   (from the repo root)
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), ".."); // 318_a4: file lives in fixes/ — parent = repo root
const CLI = join(ROOT, "scripts", "rapidtool-cli.mjs");
const env = { ...process.env };
for (const k of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) delete env[k];

const BRIEF = "Reduce invoice reconciliation time for a 3-person accounting team by building a small internal web tool.";

function cli(args, cwd) {
  return spawnSync(process.execPath, ["--experimental-strip-types", CLI, ...args], {
    cwd,
    env,
    encoding: "utf8",
    timeout: 120_000,
  });
}

function mkProject(cwd, name) {
  const proj = join(cwd, `${name}.json`);
  const r = cli(["create", "--brief", BRIEF, "--name", name, "--out", proj], cwd);
  if (r.status !== 0) throw new Error(`create failed (${r.status}): ${r.stdout}\n${r.stderr}`);
  return proj;
}

function readPhase(proj) {
  try {
    const j = JSON.parse(readFileSync(proj, "utf8"));
    return { currentPhase: j.currentPhase, status: j.status, artifacts: (j.artifacts ?? []).length };
  } catch (e) {
    return { error: String(e) };
  }
}

function reportJson(out) {
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}

const cwd = mkdtempSync(join(tmpdir(), "rapidtool-i4-busy-"));
console.log(`[i4-busy] cwd=${cwd}`);

// ---------------------------------------------------------------------------
// Scenario A — LIVE lock held by THIS process (a real second writer).
// ---------------------------------------------------------------------------
{
  const proj = mkProject(cwd, "liveA");
  const before = readPhase(proj);
  writeFileSync(`${proj}.lock`, JSON.stringify({ pid: process.pid, ts: Date.now() }), "utf8");
  const res = cli(["run", "--project", proj], cwd);
  const json = reportJson(res.stdout);
  console.log(`[A] exit=${res.status} json=${json ? JSON.stringify({ ok: json.ok, code: json.code, exit_code: json.exit_code, preserved: json.preserved ?? null }) : "none"}`);
  console.log(`[A] before=${JSON.stringify(before)} after=${JSON.stringify(readPhase(proj))}`);
  const cp = join(cwd, ".rapidtool", "checkpoint.json");
  console.log(`[A] checkpoint exists=${existsSync(cp)} path=${cp}`);
  console.log(`[A] stderr head=${(res.stderr ?? "").split(/\r?\n/).slice(0, 2).join(" | ").slice(0, 300)}`);
  rmSync(`${proj}.lock`, { force: true }); // release the held lock (scenario-local)
}

// ---------------------------------------------------------------------------
// Scenario B — control: no lock.
// ---------------------------------------------------------------------------
{
  const proj = mkProject(cwd, "freeB");
  const res = cli(["run", "--project", proj], cwd);
  const json = reportJson(res.stdout);
  console.log(`[B] exit=${res.status} ok=${json ? json.ok : "none"} phase=${JSON.stringify(readPhase(proj))}`);
  const cp = join(cwd, ".rapidtool", "checkpoint.json");
  console.log(`[B] checkpoint exists=${existsSync(cp)}`);
}

// ---------------------------------------------------------------------------
// Scenario C — dead-pid orphan lock (SIGKILL residue).
// ---------------------------------------------------------------------------
{
  const proj = mkProject(cwd, "orphanC");
  writeFileSync(`${proj}.lock`, JSON.stringify({ pid: 99999999, ts: Date.now() }), "utf8");
  const res = cli(["run", "--project", proj], cwd);
  const json = reportJson(res.stdout);
  console.log(`[C] exit=${res.status} ok=${json ? json.ok : "none"} phase=${JSON.stringify(readPhase(proj))}`);
  console.log(`[C] lock still present=${existsSync(`${proj}.lock`)}`);
}
