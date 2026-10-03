// ---------------------------------------------------------------------------
// cli-run-busy.test.mjs — M6-04 (308 map6; concurrency / lost update) pins.
//
// THE DEFECT (308_map6_time.md M6-04, condensed): `ingest ∥ run` on one
// project — ingest exits 0 ok:true; the run's save of its completed phase
// work was refused RT_E_BUSY by the live lock and the process exited 4
// (INTERNAL class) with the work discarded (currentPhase stayed 0).
// Contention surfaced as exit-4, not a coded busy class on the run verb.
//
// THE FIX (312 · D3/E2 spec, landed 316 · I4):
//   · `headless.saveProjectBusyAware` (on disk since E2) — bounded
//     wait-and-retry; each attempt re-enters `saveProject`, so the fixes/310
//     `reclaimStaleLock` discipline runs on every retry; ONLY RT_E_BUSY is
//     classified; a still-live writer returns a coded refusal instead of
//     throwing (the thrown form is what the global net mislabeled exit 4).
//   · the CLI run/gate arm saves through that helper and, on refusal, exits
//     the README-documented busy exit 1 carrying `preserved` — the run
//     checkpoint beside the project dir where the completed phase work lives
//     (`resume --project` re-enters it).
//
// LEGS (all keyless, no network; behavioral targets are REAL child processes):
//   1. source leg — the run/gate arm's save is the helper + the coded refusal
//      block (content-anchored: CLI line numbers drift across lanes);
//   2. unit battery — free path ok; a LIVE holder ⇒ coded RT_E_BUSY with
//      attempts+lockPath and NO half-written file; a lock that clears inside
//      the backoff window ⇒ the retry succeeds; a dead-pid orphan (SIGKILL
//      residue) ⇒ reclaimed on the FIRST attempt;
//   3. behavioral spawn — a live second writer during a real `run`:
//      exit 1 + code RT_E_BUSY + a `preserved` checkpoint that exists on disk,
//      never exit 4, never a Node stack (the 308 M3 STACK class);
//   4. companion (316 · H7, carried by I4): `crew` reads the documented
//      `--max-steps` key (the old camelCase read silently no-oped the flag).
//   5. (fixes/323 FIX-2c · window #4 item 2, behavioral spawn) the checkpoint-
//      staleness guard: `gate` parks at P4 → `approve --seat autopilot`
//      advances the FILE to P5 → `unattended` must IGNORE the superseded P4
//      snapshot WITH a notice (`checkpoint.ignored:true, superseded:true` +
//      a reason naming P5/P4) and never rewind the file (the live pre-fix
//      repro resumed the snapshot and saved the file back to P4).
//   6. (fixes/323 FIX-2c · window #4 item 4, source leg) the repair arm's
//      caller-attested dir promotion wiring: `res.minted === true` feeds
//      promoteRepairedDirTested inside the converged branch; the failed
//      branch stays a pure ledger save (a red run promotes nothing).
//
// House rules honored: cwd-independent (paths via import.meta.url); the
// behavioral leg uses temp-dir cwd isolation (AGENTS.md scripts-leg rule).
// Run: node --test scripts/cli-run-busy.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createProject, saveProjectBusyAware } from "../src/lib/headless.ts";

const CLI_PATH = fileURLToPath(new URL("./rapidtool-cli.mjs", import.meta.url));
const CLI_TEXT = readFileSync(CLI_PATH, "utf8");
const BRIEF =
  "Reduce invoice reconciliation time for a 3-person accounting team by building a small internal web tool.";

/** Keyless / seatless env for spawned CLI children (the scripts-leg scrub set). */
function scrubbedEnv() {
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  return env;
}

function fixture() {
  return createProject({ brief: BRIEF, name: "I4-Busy fixture" });
}

// ---------------------------------------------------------------------------
// Leg 1 — source leg. The run/gate arm's save goes through the ONE busy-aware
// helper and the refusal block is coded (RT_E_BUSY) + exit 1 + `preserved`.
// ---------------------------------------------------------------------------
test("M6-04 — the run/gate arm saves through saveProjectBusyAware and refuses CODED (exit 1) with a preserved pointer", () => {
  assert.match(
    CLI_TEXT,
    /await h\.saveProjectBusyAware\(path, res\.project\)/,
    "the run/gate arm must save through the busy-aware helper — a bare saveProject throws RT_E_BUSY, which the global net mislabels exit 4 (the 308 map6 lost update)",
  );
  const start = CLI_TEXT.indexOf("if (!saved.ok) {");
  const end = CLI_TEXT.indexOf("// E-25: parked awaiting human", start);
  assert.ok(start !== -1 && end > start, "M6-04 busy-refusal block boundaries not found in the CLI source");
  const block = CLI_TEXT.slice(start, end);
  assert.match(block, /code:\s*"RT_E_BUSY"/, "the refusal must carry the coded busy class (RT_E_BUSY)");
  assert.match(
    block,
    /preserved:\s*\{\s*checkpoint:\s*cpPath/,
    "the refusal must carry `preserved` naming the run checkpoint (where the completed phase work lives)",
  );
  assert.match(block, /present:\s*cpPresent/, "the preserved pointer must state checkpoint presence honestly");
  assert.match(block, /resume:\s*cpPresent \? `resume --project \$\{path\}` : null/, "the preserved pointer must name the re-entry verb");
  assert.match(block, /,\s*\n\s*1,\s*\n\s*\);/, "the busy refusal must exit 1 (the README-documented busy exit), never the global net's 4");
  // no bare save left inside the run/gate arm:
  const armStart = CLI_TEXT.indexOf('case "run":');
  const armEnd = CLI_TEXT.indexOf('case "resume":');
  assert.ok(armStart !== -1 && armEnd > armStart, "run/gate arm boundaries not found");
  assert.ok(
    !/h\.saveProject\(path, res\.project\)/.test(CLI_TEXT.slice(armStart, armEnd)),
    "a bare h.saveProject(path, res.project) is back in the run/gate arm — it would throw into the exit-4 net again",
  );
});

// ---------------------------------------------------------------------------
// Leg 2 — unit battery on the helper (in-process, deterministic; injected
// sleep keeps every window synchronous).
// ---------------------------------------------------------------------------
test("M6-04 — saveProjectBusyAware: free ok · live holder refuses coded · transient lock clears · dead-pid orphan reclaimed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rapidtool-i4-busy-unit-"));

  // 2a — free path: one attempt, file lands.
  const p1 = join(dir, "free.json");
  const r1 = await saveProjectBusyAware(p1, fixture());
  assert.equal(r1.ok, true, "a free path must save on the first attempt");
  assert.equal(r1.ok && r1.attempts, 1);
  assert.ok(existsSync(p1), "the saved project file must exist on the free path");

  // 2b — LIVE holder (this process): coded refusal after the bound; no
  // half-written project file; the holder's lock is never reclaimed.
  const p2 = join(dir, "busy.json");
  writeFileSync(`${p2}.lock`, JSON.stringify({ pid: process.pid, ts: Date.now() }), "utf8");
  const r2 = await saveProjectBusyAware(p2, fixture(), { attempts: 2, waitMs: 1 });
  assert.equal(r2.ok, false, "a live holder must be refused, not waited past forever");
  assert.equal(r2.ok === false && r2.code, "RT_E_BUSY", "the refusal is coded RT_E_BUSY");
  assert.equal(r2.ok === false && r2.attempts, 2, "the refusal reports the attempts burned");
  assert.equal(r2.ok === false && r2.lockPath, `${p2}.lock`, "the refusal names the lock that stayed held");
  assert.ok(!existsSync(p2), "a refused save must never leave a half-written project file");
  assert.ok(existsSync(`${p2}.lock`), "a live holder's lock is never reclaimed by a refused save");
  rmSync(`${p2}.lock`, { force: true });

  // 2c — transient holder: the lock clears during the first backoff ⇒ retry wins.
  const p3 = join(dir, "transient.json");
  writeFileSync(`${p3}.lock`, JSON.stringify({ pid: process.pid, ts: Date.now() }), "utf8");
  let slept = 0;
  const r3 = await saveProjectBusyAware(p3, fixture(), {
    attempts: 3,
    waitMs: 5,
    sleep: async () => {
      slept += 1;
      rmSync(`${p3}.lock`, { force: true }); // the other writer finished
    },
  });
  assert.equal(r3.ok, true, "a transiently-held lock must clear inside the bounded window");
  assert.equal(r3.ok && r3.attempts, 2, "the retry (attempt 2) must be the one that saved");
  assert.equal(slept, 1, "exactly one backoff elapses before the successful retry");

  // 2d — dead-pid orphan (SIGKILL residue): reclaimed on the FIRST attempt —
  // saveProject's own acquireExclusiveLock runs reclaimStaleLock per attempt.
  const p4 = join(dir, "orphan.json");
  writeFileSync(`${p4}.lock`, JSON.stringify({ pid: 99999999, ts: Date.now() }), "utf8");
  const r4 = await saveProjectBusyAware(p4, fixture());
  assert.equal(r4.ok, true, "a dead-holder orphan must never wedge the run verb (fixes/310 reclaim)");
  assert.equal(r4.ok && r4.attempts, 1, "the orphan is reclaimed inside the first save attempt");
  assert.ok(!existsSync(`${p4}.lock`), "the reclaimed lock is swept");
});

// ---------------------------------------------------------------------------
// Leg 3 — behavioral spawn: `ingest ∥ run` with a REAL live second writer.
// THE 308 M6-04 SCENARIO, at the verb.
// ---------------------------------------------------------------------------
test("M6-04 — behavioral: a live second writer during `run` ⇒ exit 1 + RT_E_BUSY + preserved checkpoint (never exit 4, never a stack)", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-i4-busy-spawn-"));
  const env = scrubbedEnv();
  const proj = join(cwd, "busy-run.json");
  const created = spawnSync(
    process.execPath,
    ["--experimental-strip-types", CLI_PATH, "create", "--brief", BRIEF, "--name", "I4Busy", "--out", proj],
    { cwd, env, encoding: "utf8", timeout: 120_000 },
  );
  assert.equal(created.status, 0, `create must exit 0.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);

  // The second writer: THIS process, alive for the child's whole retry window.
  writeFileSync(`${proj}.lock`, JSON.stringify({ pid: process.pid, ts: Date.now() }), "utf8");
  const res = spawnSync(
    process.execPath,
    ["--experimental-strip-types", CLI_PATH, "run", "--project", proj],
    { cwd, env, encoding: "utf8", timeout: 120_000 },
  );
  rmSync(`${proj}.lock`, { force: true });

  const stderr = res.stderr ?? "";
  assert.ok(
    !/(^|\n)\s+at\s/.test(stderr),
    `a coded busy refusal must never print a Node stack (the 308 M3 STACK class — the pre-fix global-net path did):\n${stderr}`,
  );
  assert.equal(
    res.status,
    1,
    `busy contention at the run verb is the README-documented exit 1 — the pre-fix defect exited 4 (INTERNAL class).\nstdout: ${res.stdout}\nstderr: ${stderr}`,
  );
  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch {
    /* surfaced below */
  }
  assert.ok(json, `the run verb must print exactly one JSON envelope.\nstdout: ${res.stdout}\nstderr: ${stderr}`);
  assert.equal(json.ok, false, "contention is a refusal envelope, never a fake success");
  assert.equal(json.code, "RT_E_BUSY", "the refusal carries the coded busy class on the run verb");
  assert.equal(json.exit_code, res.status, "the envelope's exit_code must equal the process exit");
  assert.ok(
    json.preserved && typeof json.preserved === "object",
    "the refusal must carry `preserved` — the work-preserved pointer (the M6-04 lost update closed)",
  );
  assert.equal(
    json.preserved.checkpoint,
    join(cwd, ".rapidtool", "checkpoint.json"),
    "`preserved.checkpoint` must name the run checkpoint beside the project dir",
  );
  assert.equal(json.preserved.present, true, "the run committed per-phase work before the save was refused — the checkpoint must exist");
  assert.match(String(json.preserved.resume), /^resume --project /, "`preserved.resume` must name the re-entry verb");
  assert.ok(existsSync(json.preserved.checkpoint), "the preserved checkpoint must be a real file on disk");
  // The refused save leaves the pre-run project file untouched (no half-write).
  const onDisk = JSON.parse(readFileSync(proj, "utf8"));
  assert.equal(onDisk.currentPhase, 0, "the refused save must not advance the on-disk project (the work rides the checkpoint instead)");
});

// ---------------------------------------------------------------------------
// Leg 4 — companion (316 · H7, carried by I4): `crew` must read the
// documented `--max-steps` key; the old `args.maxSteps` read no-oped it.
// ---------------------------------------------------------------------------
test("316 H7 — crew reads the documented `--max-steps` key (parseArgs stores the raw key)", () => {
  assert.ok(
    CLI_TEXT.includes('typeof args["max-steps"] === "string"'),
    'the crew arm must read args["max-steps"] — parseArgs stores the raw flag key, so args.maxSteps never matched',
  );
  assert.ok(
    !CLI_TEXT.includes("typeof args.maxSteps"),
    "the camelCase read is back — it silently ignores the ONE documented crew knob",
  );
});

// ---------------------------------------------------------------------------
// Leg 5 (fixes/323 FIX-2c · window #4 item 2, behavioral spawn) — checkpoint
// staleness vs the named project file (X2b OBS). Live pre-fix repro
// (2026-09-30, keyless): this exact sequence rewound the file — `gate` parks
// at P4 (snapshot phase 4) → `approve --seat autopilot` moves the file to
// P5/running → `unattended` resumed the P4 snapshot (steps:0) and saved the
// file BACK to P4/awaiting_hitl. Post-fix the snapshot is ignored WITH a
// notice and the drive starts from the file (P5).
// ---------------------------------------------------------------------------
test("FIX-2c — a stale checkpoint is ignored WITH a notice: an approve-advanced file is never rewound by `unattended`", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-i4-supersede-"));
  const env = scrubbedEnv();
  const BRIEF_FIX2C =
    "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.";
  try {
    const proj = join(cwd, "supersede.json");
    const created = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "create", "--brief", BRIEF_FIX2C, "--name", "Supersede", "--out", proj],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);

    // Park at the P4 stock gate: the run commits a phase-4 checkpoint.
    const gated = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, "gate", "--project", proj], {
      cwd,
      env,
      encoding: "utf8",
      timeout: 240_000,
    });
    assert.equal(gated.status, 2, `gate must park (exit 2).\nstdout: ${gated.stdout}\nstderr: ${gated.stderr}`);
    assert.equal(
      JSON.parse(gated.stdout).summary?.status,
      "awaiting_hitl",
      "harness precondition: the keyless gate run must park ON a gate (a drifted fixture — fix the fixture, never the assertions)",
    );
    const cpPath = join(cwd, ".rapidtool", "checkpoint.json");
    assert.ok(existsSync(cpPath), "harness precondition: the parked run committed its per-phase checkpoint");
    assert.equal(
      JSON.parse(readFileSync(cpPath, "utf8")).run?.phase,
      4,
      "harness precondition: the snapshot re-enters at P4",
    );

    // The file advances PAST the snapshot — the X2b divergence.
    const approved = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "approve", "--project", proj, "--seat", "autopilot"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(
      approved.status,
      0,
      `approve --seat autopilot must land.\nstdout: ${approved.stdout}\nstderr: ${approved.stderr}`,
    );
    const afterApprove = JSON.parse(readFileSync(proj, "utf8"));
    assert.equal(afterApprove.currentPhase, 5, "harness precondition: the file advanced to P5");
    assert.equal(afterApprove.status, "running");

    // The stale snapshot must not be consumed — and must not be silent. 341-6:
    // the `unattended` arm now clears the stock gates (machineGates:true), so it
    // drives from the FILE (P5) to P12 and seals with the keyless advisory P6
    // red (the documented exit 1) — the supersession notice is what this leg pins.
    const unatt = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, "unattended", "--project", proj], {
      cwd,
      env,
      encoding: "utf8",
      timeout: 240_000,
    });
    assert.equal(
      unatt.status,
      1,
      `unattended must drive from the file (keyless P6 red ⇒ exit 1).\nstdout: ${unatt.stdout}\nstderr: ${unatt.stderr}`,
    );
    const json = JSON.parse(unatt.stdout);
    assert.equal(json.exit_code, unatt.status, "the envelope's exit_code must equal the process exit");
    assert.equal(json.resumed, false, "the superseded snapshot is NOT resumed (pre-fix: resumed:true + a rewind)");
    assert.equal(json.checkpoint?.ignored, true, "the ignore is loud (checkpoint.ignored) — never silent");
    assert.equal(json.checkpoint?.superseded, true, "the envelope names the supersession verdict");
    assert.match(String(json.checkpoint?.reason), /P5/, `the reason names the file's phase: ${json.checkpoint?.reason}`);
    assert.match(
      String(json.checkpoint?.reason),
      /P4/,
      `the reason names the snapshot's re-entry phase: ${json.checkpoint?.reason}`,
    );
    const onDisk = JSON.parse(readFileSync(proj, "utf8"));
    assert.notEqual(onDisk.currentPhase, 4, "the file is never rewound (pre-fix it fell back to 4/awaiting_hitl)");
    assert.equal(onDisk.currentPhase, 12, "the drive continued forward from the file's P5 to the seal");
    assert.equal(onDisk.status, "complete");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 6 (fixes/323 FIX-2c · window #4 item 4, source leg) — the repair arm's
// caller-attested dir promotion wiring. The helper + its red/absent paths are
// pinned in src/lib/headless.test.ts; this leg keeps the CALL SITE from
// silently regressing out of the converged branch.
// ---------------------------------------------------------------------------
test("FIX-2c — the repair arm promotes the emitted dir's record via the caller-attested mint (source leg)", () => {
  assert.match(
    CLI_TEXT,
    /h\.promoteRepairedDirTested\(res\.project,\s*res\.dir,\s*res\.minted === true\)/,
    "the repair arm must promote the dir record through the caller-attested helper with res.minted as the attestation",
  );
  const armStart = CLI_TEXT.indexOf('case "repair":');
  const armEnd = CLI_TEXT.indexOf('case "edit":');
  assert.ok(armStart !== -1 && armEnd > armStart, "repair arm boundaries not found in the CLI source");
  const arm = CLI_TEXT.slice(armStart, armEnd);
  assert.match(
    arm,
    /if \(res\.ok\) \{[\s\S]{0,1200}h\.promoteRepairedDirTested\(/,
    "the promotion must sit inside the converged (res.ok) branch",
  );
  const failedStart = arm.indexOf("RT_E_REPAIR_FAILED");
  assert.ok(failedStart !== -1, "the failure branch must stay coded RT_E_REPAIR_FAILED");
  assert.ok(
    !arm.slice(failedStart).includes("promoteRepairedDirTested"),
    "a red/exhausted repair promotes nothing — the failed branch is a pure ledger save",
  );
});
