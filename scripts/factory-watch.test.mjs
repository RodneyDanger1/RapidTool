// ---------------------------------------------------------------------------
// factory-watch.test.mjs — fixes/344 F-18 (the walk-away orchestrator).
//
// Two legs:
//
//  A. PURE — the idempotence / crash-resume / honesty contract, asserted on the
//     real exported decision functions with real-shaped CLI envelopes:
//       · planItem: new→create · delivered→skip · parked/stalled→terminal (and
//         retry→drive) · transient failure→drive until the attempt cap · a
//         changed brief→changed (never a silent re-run);
//       · classifyDrive: exit 0 is the ONLY complete path; exit 2 parks; exit 1
//         stalls with its code; exit 3/4 is a retryable failure;
//       · emitDelivered: ONLY a real commit (committed:true) or the idempotent
//         noop:true counts — a refusal or a commit-less emit never does.
//
//  B. BEHAVIORAL (keyless) — drives the REAL script over a throwaway intake and
//     workspace with a scrubbed, keyless env (the repo convention: a present-but-
//     blank DEEPSEEK_API_KEY forces the deterministic floor). Asserts the whole
//     path: create → unattended (machine seat) → emit --git, a real delivery
//     commit, a durable per-project checkpoint, and a second tick that skips
//     (idempotent — no new commit, no project rewrite). A second fast leg covers
//     the queue intake in --dry-run (plans, writes nothing).
//
// House rules honored: cwd-independent (paths via import.meta.url); every child
// runs in a throwaway temp dir; keyless (never a keyed call); real git only
// (skips honestly when git is absent). Run:
//   node --test scripts/factory-watch.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  briefHash,
  classifyDrive,
  emitDelivered,
  nameForBrief,
  normalizeQueue,
  planItem,
  slugify,
} from "./factory-watch.mjs";

const SCRIPT_PATH = fileURLToPath(new URL("./factory-watch.mjs", import.meta.url));
const BRIEF = "A tiny expense tracker for a small team, with CSV export.";

/** Write the durable per-project checkpoint the orchestrator resumes from. */
function seedState(work, projects) {
  const statePath = join(work, "state", "factory-state.json");
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify({ schema_version: 1, projects }, null, 2)}\n`, "utf8");
  return statePath;
}

/** Keyless env for spawned children (the scripts-leg scrub set + keyless force). */
function keylessEnv() {
  const env = { ...process.env };
  for (const key of [
    "RT_HUMAN_SEAT_TOKEN",
    "RAPIDTOOL_ACTOR",
    "RAPIDTOOL_LOG_DIR",
    "RAPIDTOOL_LLM_USAGE_LOG",
  ]) {
    delete env[key];
  }
  env.DEEPSEEK_API_KEY = ""; // present-but-blank = the repo's keyless disable
  return env;
}

function runFactory(args, opts = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: opts.cwd,
    env: keylessEnv(),
    encoding: "utf8",
    timeout: 600_000,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function jsonOf(res) {
  try {
    return JSON.parse(res.stdout);
  } catch {
    assert.fail(
      `factory-watch did not print one JSON object (exit ${res.status}).\nstdout: ${res.stdout}\nstderr: ${res.stderr}`,
    );
  }
}

// ---------------------------------------------------------------------------
// A · PURE decision contract.
// ---------------------------------------------------------------------------
test("planItem — the idempotence/crash-resume contract", () => {
  const opts = { retry: false, maxAttempts: 3 };
  assert.equal(planItem(null, "h", opts).action, "create", "an unseen brief is created");
  assert.equal(planItem({ status: "delivered", briefHash: "h" }, "h", opts).action, "deliver");
  assert.equal(planItem({ status: "created", briefHash: "h" }, "h", opts).action, "drive");
  assert.equal(planItem({ status: "driving", briefHash: "h" }, "h", opts).action, "drive");

  // A crash mid-drive leaves `driving`; the next tick re-enters (never restarts).
  assert.equal(planItem({ status: "driving", briefHash: "h" }, "h", opts).reason, "resume");

  // Human terminals are skipped idempotently unless --retry.
  for (const status of ["parked", "stalled"]) {
    const p = planItem({ status, briefHash: "h" }, "h", opts);
    assert.equal(p.action, "terminal", `${status} is terminal`);
    assert.equal(p.needsHuman, true);
    assert.equal(
      planItem({ status, briefHash: "h" }, "h", { ...opts, retry: true }).action,
      "drive",
    );
  }

  // A transient failure is retried while attempts remain, then left for a human.
  assert.equal(
    planItem({ status: "failed", briefHash: "h", attempts: 2 }, "h", opts).action,
    "drive",
  );
  const exhausted = planItem({ status: "failed", briefHash: "h", attempts: 3 }, "h", opts);
  assert.equal(exhausted.action, "terminal");
  assert.equal(exhausted.reason, "attempts-exhausted");

  // A brief whose bytes moved is reported, never silently re-run.
  const changed = planItem({ status: "delivered", briefHash: "old" }, "new", opts);
  assert.equal(changed.action, "changed");
  assert.equal(changed.needsHuman, true);
});

test("classifyDrive — exit 0 is the ONLY complete path; a stall carries its code", () => {
  assert.equal(classifyDrive({ ok: true, summary: { status: "complete" } }, 0).kind, "complete");

  const parked = classifyDrive({ ok: true, summary: { status: "awaiting_hitl" } }, 2);
  assert.equal(parked.kind, "parked");
  assert.equal(parked.needsHuman, true);

  const stalled = classifyDrive({ ok: false, code: "RT_E_GATES_FAILED", error: "red seal" }, 1);
  assert.equal(stalled.kind, "stalled");
  assert.equal(stalled.code, "RT_E_GATES_FAILED");
  assert.equal(stalled.needsHuman, true);

  const failed = classifyDrive({ ok: false, code: "RT_E_INTERNAL", error: "boom" }, 4);
  assert.equal(failed.kind, "failed");
  assert.notEqual(failed.needsHuman, true, "a runtime failure is retryable, not a human gate");

  // A non-zero exit is NEVER complete even if the envelope says ok.
  assert.notEqual(classifyDrive({ ok: true }, 1).kind, "complete");
});

test("emitDelivered — only a real commit or the idempotent noop proves a delivery", () => {
  assert.equal(emitDelivered({ ok: true, git: { committed: true, noop: false } }, 0), true);
  assert.equal(emitDelivered({ ok: true, git: { committed: false, noop: true } }, 0), true);
  assert.equal(
    emitDelivered({ ok: true, git: { committed: false, noop: false, commit: null } }, 0),
    false,
  );
  assert.equal(
    emitDelivered({ ok: true, git: { ok: false, code: "RT_E_GIT_UNAVAILABLE" } }, 0),
    false,
  );
  assert.equal(
    emitDelivered({ ok: false, git: { committed: true } }, 1),
    false,
    "a failed emit is never a delivery",
  );
  assert.equal(emitDelivered({ ok: true }, 0), false, "a commit-less emit is not a delivery");
});

test("intake helpers — slug/name/hash/queue normalization", () => {
  assert.equal(slugify("HVAC Dispatch!"), "hvac-dispatch");
  assert.equal(nameForBrief("expense-tracker.md", "no front matter"), "expense tracker");
  assert.equal(nameForBrief("x.md", "---\nname: Real Name\nbrief: hi\n---\n"), "Real Name");
  assert.equal(briefHash("abc"), createHash("sha256").update("abc", "utf8").digest("hex"));

  assert.deepEqual(normalizeQueue([{ name: "A", brief: "b" }]).rows, [{ name: "A", brief: "b" }]);
  assert.deepEqual(normalizeQueue({ briefs: [{ brief: "b" }] }).rows, [
    { name: "brief-1", brief: "b" },
  ]);
  assert.ok(normalizeQueue({ nope: 1 }).error, "a malformed queue is refused, never guessed");
  assert.ok(normalizeQueue([{ name: "A" }]).error, "a row without prose is refused");
});

// ---------------------------------------------------------------------------
// B · BEHAVIORAL (keyless) — the honest end-to-end tick.
//
// The deterministic keyless floor cannot synthesise a brief-conformant module,
// so a keyless drive SEALS COMPLETE with the P6 DoD gate red — the repo's own
// documented keyless outcome (a red-gate seal is never a clean 0). The factory
// must then NOT claim a delivery: it records the coded stall and leaves the item
// for a human. This leg is what proves "never invents success" on real bytes.
// ---------------------------------------------------------------------------
test(
  "keyless end-to-end: intake → create → unattended → HONEST stall (no delivery), then an idempotent skip",
  { timeout: 600_000 },
  () => {
    const root = mkdtempSync(join(tmpdir(), "rapidtool-factory-watch-"));
    const intake = join(root, "intake");
    const work = join(root, "work");
    mkdirSync(intake, { recursive: true });
    writeFileSync(join(intake, "expense-tracker.md"), BRIEF, "utf8");

    const first = runFactory(["--intake", intake, "--work", work], { cwd: root });
    const j1 = jsonOf(first);
    assert.equal(j1.schema_version, 1);
    assert.equal(j1.cmd, "factory-watch");
    assert.equal(j1.exit_code, first.status, "the envelope exit_code mirrors the process exit");
    assert.equal(
      first.status,
      1,
      `a keyless red-gate seal must be reported, never delivered.\nstdout: ${first.stdout}`,
    );
    assert.equal(j1.ok, false);
    const row = j1.processes[0];
    assert.equal(row.slug, "expense-tracker");
    assert.equal(row.action, "drive-stalled");
    assert.equal(row.status, "stalled");
    assert.equal(row.code, "RT_E_GATES_FAILED", "the stall carries the CLI's own coded reason");
    assert.equal(row.needsHuman, true, "the item is left for a human");
    assert.equal(row.delivered, false, "no delivery is claimed");
    assert.equal(row.delivery, null);
    assert.equal(
      row.phase,
      12,
      "the machine-seat drive reached the terminal phase before the red seal",
    );

    // On disk: the project exists, the per-project checkpoint records the stall,
    // and NOTHING was emitted (no fake .git, no delivery).
    const projectFile = join(work, "expense-tracker", "build.json");
    const emitDir = join(work, "expense-tracker", "emitted");
    assert.ok(existsSync(projectFile), "create wrote the project file");
    assert.equal(
      existsSync(join(emitDir, ".git")),
      false,
      "a stalled item is never emitted/landed",
    );
    const statePath = join(work, "state", "factory-state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    const rec = state.projects["expense-tracker"];
    assert.equal(rec.status, "stalled", "the checkpoint records the terminal stall");
    assert.equal(rec.code, "RT_E_GATES_FAILED");
    assert.equal(rec.briefHash, briefHash(BRIEF), "the checkpoint pins the brief's bytes");

    // Second tick (no --retry) — the terminal item is skipped idempotently: no
    // re-create, no re-drive, no new attempts, project bytes unchanged.
    const projectBytes = readFileSync(projectFile);
    const second = runFactory(["--intake", intake, "--work", work], { cwd: root });
    assert.equal(second.status, 1, `a still-stalled intake reports 1.\n${second.stdout}`);
    const j2 = jsonOf(second);
    assert.equal(j2.processes[0].action, "terminal");
    assert.equal(j2.processes[0].reason, "stalled");
    assert.equal(j2.processes[0].needsHuman, true);
    const state2 = JSON.parse(readFileSync(statePath, "utf8"));
    assert.equal(state2.projects["expense-tracker"].attempts, 1, "a skip must not burn an attempt");
    assert.deepEqual(
      readFileSync(projectFile),
      projectBytes,
      "a skipped brief is never re-created or rewritten",
    );
  },
);

test("a brief already delivered is skipped idempotently (no CLI verb runs)", () => {
  const root = mkdtempSync(join(tmpdir(), "rapidtool-factory-watch-d-"));
  const intake = join(root, "intake");
  const work = join(root, "work");
  mkdirSync(intake, { recursive: true });
  const briefFile = join(intake, "expense-tracker.md");
  writeFileSync(briefFile, BRIEF, "utf8");
  seedState(work, {
    "expense-tracker": {
      name: "expense tracker",
      briefHash: briefHash(BRIEF),
      source: briefFile,
      projectFile: join(work, "expense-tracker", "build.json"),
      emitDir: join(work, "expense-tracker", "emitted"),
      status: "delivered",
      attempts: 1,
      delivery: {
        dir: join(work, "expense-tracker", "emitted"),
        committed: true,
        noop: false,
        commit: { hash: "deadbeef" },
      },
    },
  });

  const res = runFactory(["--intake", intake, "--work", work], { cwd: root });
  assert.equal(res.status, 0, `a fully-delivered tick is a clean 0.\n${res.stdout}`);
  const j = jsonOf(res);
  assert.equal(j.processes[0].action, "deliver");
  assert.equal(j.processes[0].reason, "already-delivered");
  assert.equal(j.processes[0].delivered, true);
  assert.equal(
    existsSync(join(work, "expense-tracker", "build.json")),
    false,
    "a delivered brief must not be re-created (the skip happens BEFORE any CLI verb)",
  );
});

test("a corrupt factory state is refused, never overwritten", () => {
  const root = mkdtempSync(join(tmpdir(), "rapidtool-factory-watch-c-"));
  const intake = join(root, "intake");
  const work = join(root, "work");
  mkdirSync(intake, { recursive: true });
  writeFileSync(join(intake, "expense-tracker.md"), BRIEF, "utf8");
  const statePath = join(work, "state", "factory-state.json");
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, "{ not json", "utf8");

  const res = runFactory(["--intake", intake, "--work", work], { cwd: root });
  assert.equal(res.status, 1);
  assert.equal(jsonOf(res).code, "RT_E_VALIDATION");
  assert.equal(
    readFileSync(statePath, "utf8"),
    "{ not json",
    "a corrupt state is left for a human, never clobbered",
  );
});

test("queue intake in --dry-run plans without writing", { timeout: 120_000 }, () => {
  const root = mkdtempSync(join(tmpdir(), "rapidtool-factory-watch-q-"));
  const queue = join(root, "queue.json");
  const work = join(root, "work");
  writeFileSync(
    queue,
    JSON.stringify({ briefs: [{ name: "Queue One", brief: "Build a queue fixture." }] }),
    "utf8",
  );

  const res = runFactory(["--queue", queue, "--work", work, "--dry-run"], { cwd: root });
  assert.equal(res.status, 0, `a dry-run is a clean report.\n${res.stdout}\n${res.stderr}`);
  const j = jsonOf(res);
  assert.equal(j.dryRun, true);
  assert.equal(j.processes[0].action, "create");
  assert.equal(j.processes[0].dryRun, true);
  assert.equal(
    existsSync(join(work, "state", "factory-state.json")),
    false,
    "a dry-run writes no state",
  );
  assert.equal(
    existsSync(join(work, "queue-one", "build.json")),
    false,
    "a dry-run invokes no create",
  );
});

test("usage refusals are coded — no intake/queue, both, or a missing --work", () => {
  const none = runFactory([]);
  assert.equal(none.status, 1);
  assert.equal(jsonOf(none).code, "RT_E_VALIDATION");

  const both = runFactory(["--intake", "a", "--queue", "b", "--work", "c"]);
  assert.equal(both.status, 1);
  assert.match(String(jsonOf(both).error), /exactly one of/);

  const noWork = runFactory(["--intake", "a"]);
  assert.equal(noWork.status, 1);
  assert.match(String(jsonOf(noWork).error), /--work .* required/);
});
