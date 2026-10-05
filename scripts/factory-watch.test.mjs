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
//         noop:true counts — a refusal or a commit-less emit never does;
//       · runProved/classifyDeliverFailure: the delivery-time `emit --run`
//         verdict must be GREEN before any commit, and a failure maps to the
//         honest `stalled` terminal.
//
//  B. BEHAVIORAL (keyless) — drives the REAL script over a throwaway intake and
//     workspace with a scrubbed, keyless env (the repo convention: a present-but-
//     blank DEEPSEEK_API_KEY forces the deterministic floor). Asserts the whole
//     path: create → unattended (machine seat) → an honest stall, a durable
//     per-project checkpoint, and a second tick that skips (idempotent). The
//     deliver step is asserted directly (`deliverVerified`): a RED delivery-time
//     re-run leaves NO commit, a GREEN one commits, and the idempotent re-emit is
//     a green noop. A fast leg covers the queue intake in --dry-run (writes nothing).
//
// House rules honored: cwd-independent (paths via import.meta.url); every child
// runs in a throwaway temp dir; keyless (never a keyed call); real git only
// (skips honestly when git is absent). Run:
//   node --test scripts/factory-watch.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  briefHash,
  classifyDeliverFailure,
  classifyDrive,
  deliverVerified,
  deliveryEvidence,
  deliveryProved,
  emitDelivered,
  nameForBrief,
  normalizeQueue,
  planItem,
  runProved,
  slugify,
  treeVerified,
} from "./factory-watch.mjs";

const SCRIPT_PATH = fileURLToPath(new URL("./factory-watch.mjs", import.meta.url));
const CLI_PATH = fileURLToPath(new URL("./rapidtool-cli.mjs", import.meta.url));
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

/** Spawn a factory tick without blocking — for the concurrent-ticks race. */
function runFactoryAsync(args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT_PATH, ...args], {
      cwd: opts.cwd,
      env: keylessEnv(),
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

/** Spawn a real CLI verb (keyless) for the deliver-path fixtures. */
function runCliSync(args) {
  return spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, ...args], {
    env: keylessEnv(),
    encoding: "utf8",
    timeout: 600_000,
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** A real created project file (its emitted tree re-runs green at delivery). */
function createProject(dir, name) {
  const projectFile = join(dir, "build.json");
  const res = runCliSync(["create", "--brief", BRIEF, "--name", name, "--out", projectFile]);
  assert.equal(res.status, 0, `create failed (exit ${res.status}).\n${res.stdout}\n${res.stderr}`);
  return projectFile;
}

/**
 * Run `fn` with the process env forced keyless. `deliverVerified` calls the
 * imported module's runCli, which reads process.env — so the in-process deliver
 * path must be scrubbed exactly like a spawned child (present-but-blank key).
 */
function withKeylessEnv(fn) {
  const keys = [
    "DEEPSEEK_API_KEY",
    "RT_HUMAN_SEAT_TOKEN",
    "RAPIDTOOL_ACTOR",
    "RAPIDTOOL_LOG_DIR",
    "RAPIDTOOL_LLM_USAGE_LOG",
  ];
  const saved = new Map(keys.map((k) => [k, process.env[k]]));
  process.env.DEEPSEEK_API_KEY = "";
  for (const k of keys.slice(1)) delete process.env[k];
  try {
    return fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
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

test("deliveryProved — a commit alone is NOT a delivery; the emitted tree must re-run green", () => {
  // A real `emit --run` envelope: green tree (parse + specs + entry smoke), the
  // project's declared scripts execution state, and the landed commit.
  const greenTree = {
    ok: true,
    dir: "emitted",
    compile: { ok: true, checked: 1, passed: 1, failed: 0 },
    tests: [{ file: "tests/oracle.spec.ts", run: "pass", tests: { pass: 1, fail: 0 } }],
    run: { kind: "library", run: "skip", detail: "no entry to smoke" },
    declaredScriptsVerified: true,
    verdictHash: "verdict-hash-1",
  };
  const committed = {
    ok: true,
    git: { committed: true, noop: false, commit: { hash: "abc123" } },
    treeRun: greenTree,
    declaredScriptsVerified: true,
    tested: { promoted: true, label: "tested", evidenceHash: "ev1dence" },
  };
  assert.equal(
    deliveryProved(committed, 0, true),
    true,
    "a committed + tree-run-green emit IS a verified delivery",
  );

  // THE regression: the pre-change proof (commit + .git, no tree evidence) must
  // no longer count — "delivered" carried a commit, never a re-run verdict.
  assert.equal(
    deliveryProved({ ok: true, git: { committed: true, noop: false } }, 0, true),
    false,
    "a commit with no tree-run evidence is not a verified delivery",
  );
  // The idempotent re-emit (`noop`) is still a delivery IF the tree re-ran green.
  assert.equal(
    deliveryProved(
      { ok: true, git: { committed: false, noop: true }, treeRun: greenTree },
      0,
      true,
    ),
    true,
    "the idempotent noop re-delivery stays green",
  );

  // A red tree never delivers, even with a commit and a .git on disk.
  assert.equal(
    deliveryProved(
      {
        ok: false,
        code: "RT_E_TREE_RUN_FAILED",
        git: { committed: true },
        treeRun: { ok: false, error: "spec failed" },
      },
      1,
      true,
    ),
    false,
    "a red tree must not deliver",
  );
  // A green tree that was never committed is not a delivery.
  assert.equal(
    deliveryProved(
      { ok: true, git: { committed: false, noop: false }, treeRun: greenTree },
      0,
      true,
    ),
    false,
  );
  // A green tree with no `.git` on disk is not a delivery.
  assert.equal(
    deliveryProved({ ok: true, git: { committed: true }, treeRun: greenTree }, 0, false),
    false,
  );

  assert.equal(treeVerified(committed), true);
  assert.equal(treeVerified({ ok: true, git: { committed: true } }), false);

  // The evidence persisted into the delivery record names the tree verdict.
  const ev = deliveryEvidence(committed);
  assert.equal(ev.treeRun.ok, true);
  assert.equal(ev.treeRun.declaredScriptsVerified, true);
  assert.deepEqual(ev.treeRun.specs, { total: 1, passed: 1 });
  assert.equal(ev.treeRun.verdictHash, "verdict-hash-1", "PR-21: the verdict hash proves a rebuilt/tested artifact");
  assert.equal(ev.verdictHash, "verdict-hash-1");
  assert.equal(ev.evidenceHash, "ev1dence");
  // An older envelope without a verdict hash persists null — never fabricated.
  const legacy = deliveryEvidence({ treeRun: { ok: true } });
  assert.equal(legacy.treeRun.verdictHash, null);
  assert.equal(legacy.verdictHash, null);

  // C1-06 (campaign #1): the delivery record must state whether the UI is wired
  // and whether this is a fully verified product — a commit over a green tree
  // with an unwired UI (the campaign's flower-shop / bfo / mobile) is NOT one.
  const withWiredUi = deliveryEvidence({
    ...committed,
    git: { committed: true, verification: { uiWired: true, unverifiedReasons: [] } },
  });
  assert.equal(withWiredUi.uiWired, true);
  assert.equal(withWiredUi.verifiedProduct, true, "a green, toolchain-verified, UI-wired tree is a verified product");

  const unwired = deliveryEvidence({
    ...committed,
    git: { committed: true, verification: { uiWired: false, unverifiedReasons: ["mounted UI imports … but never calls an exported function"] } },
  });
  assert.equal(unwired.uiWired, false);
  assert.equal(unwired.verifiedProduct, false, "committed:true with an unwired UI is NOT a verified product (C1-06)");
  assert.deepEqual(unwired.unverifiedReasons, ["mounted UI imports … but never calls an exported function"]);

  // An older envelope with no git.verification keeps honoured nulls (never a
  // fabricated true) and is not presented as a verified product.
  const noVerification = deliveryEvidence(committed);
  assert.equal(noVerification.uiWired, null);
  assert.equal(noVerification.verifiedProduct, false);
});

test("runProved / classifyDeliverFailure — a red delivery-time tree-run is a commitless `stalled`", () => {
  const green = { ok: true, treeRun: { ok: true }, tested: { evidenceHash: "e" } };
  assert.equal(runProved(green, 0), true, "exit 0 + ok + a green treeRun verifies a delivery");
  assert.equal(runProved({ ok: false, treeRun: { ok: false } }, 1), false);
  assert.equal(runProved({ ok: true, treeRun: { ok: false } }, 0), false, "a red tree never verifies");
  assert.equal(runProved({ ok: true }, 0), false, "a run with no treeRun is not verification");
  assert.equal(runProved(green, 1), false, "a non-zero exit is never verified");

  // Either failed stage maps to the honest stall row.
  const redRow = classifyDeliverFailure({
    stage: "verify",
    verified: { exitCode: 1, envelope: { code: "RT_E_TREE_RUN_FAILED", error: "typecheck red" } },
    committed: null,
  });
  assert.equal(redRow.status, "stalled");
  assert.equal(redRow.code, "RT_E_TREE_RUN_FAILED");
  assert.equal(redRow.needsHuman, true);
  const commitRow = classifyDeliverFailure({
    stage: "commit",
    verified: { exitCode: 0, envelope: { ok: true, treeRun: { ok: true } } },
    committed: { exitCode: 1, envelope: { code: "RT_E_GIT_UNAVAILABLE", error: "no git" } },
  });
  assert.equal(commitRow.status, "stalled");
  assert.equal(commitRow.code, "RT_E_GIT_UNAVAILABLE");
});

test("factory-watch's deliver step VERIFIES (`--run`) before it COMMITS (`--git`)", () => {
  const src = readFileSync(SCRIPT_PATH, "utf8");
  const verifyCall = src.indexOf('["emit", "--project", projectFile, "--out", emitDir, "--run"]');
  const commitCall = src.indexOf('["emit", "--project", projectFile, "--out", emitDir, "--git"]');
  assert.ok(verifyCall !== -1, "deliverVerified must emit --run (no commit) to verify the tree first");
  assert.ok(commitCall !== -1, "deliverVerified must issue a separate emit --git for the commit");
  assert.ok(
    verifyCall < commitCall,
    "verification must precede the commit so a red re-run leaves no commit",
  );
  assert.equal(
    src.includes('"--out", emitDir, "--run", "--git"'),
    false,
    "no combined `emit --run --git` call may remain (it committed even when --run was red)",
  );
  assert.match(src, /deliverVerified\(/, "main must route delivery through deliverVerified");
  assert.match(
    src,
    /classifyDeliverFailure\(/,
    "a failed delivery must map through classifyDeliverFailure",
  );
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

// --- Deliver ordering (the gap `emit --run --git` disclosed) ------------------
// These drive the factory's OWN deliver seam (`deliverVerified`) with the real
// CLI, keyless. A full tick cannot reach deliver keyless (the deterministic
// floor always red-seals P6 at drive), so the deliver step is exercised directly
// — still real CLI calls over real emitted bytes, never a mock.
test(
  "a RED delivery-time tree-run leaves NO commit (verify precedes commit)",
  { timeout: 600_000 },
  () => {
    const root = mkdtempSync(join(tmpdir(), "rapidtool-factory-watch-red-"));
    const projectFile = createProject(root, "red-tree");
    // A real ledger edit: a generatedTree whose module does not compile, so the
    // emitted tree genuinely re-runs RED at delivery time.
    const project = JSON.parse(readFileSync(projectFile, "utf8"));
    project.generatedTree = [
      {
        path: "src/jobs/track.ts",
        source: "export const broken: number = ;\n",
        hash: "deadbeef",
        attempt: 0,
      },
    ];
    writeFileSync(projectFile, `${JSON.stringify(project, null, 2)}\n`, "utf8");
    const emitDir = join(root, "emitted");

    const delivered = withKeylessEnv(() => deliverVerified(projectFile, emitDir, 600_000));

    assert.equal(delivered.ok, false, "a red tree-run must never deliver");
    assert.equal(delivered.stage, "verify", "the red verdict stops at verification");
    assert.equal(delivered.verified.envelope.treeRun.ok, false);
    assert.equal(delivered.verified.envelope.code, "RT_E_TREE_RUN_FAILED");
    assert.equal(
      existsSync(join(emitDir, ".git")),
      false,
      "a red delivery-time re-run must leave NO commit (.git) on disk",
    );
    const stall = classifyDeliverFailure(delivered);
    assert.equal(stall.status, "stalled", "the factory records the honest stall");
    assert.equal(stall.code, "RT_E_TREE_RUN_FAILED");
    assert.equal(stall.needsHuman, true);
  },
);

test(
  "a GREEN delivery-time tree-run commits, and the idempotent re-emit stays a green noop",
  { timeout: 900_000 },
  () => {
    const root = mkdtempSync(join(tmpdir(), "rapidtool-factory-watch-green-"));
    const projectFile = createProject(root, "green-tree");
    const emitDir = join(root, "emitted");

    const first = withKeylessEnv(() => deliverVerified(projectFile, emitDir, 600_000));
    assert.equal(
      first.ok,
      true,
      `a green tree must deliver.\n${first.committed?.stdout}\n${first.committed?.stderr}`,
    );
    assert.equal(first.committed.envelope.git.committed, true);
    assert.equal(first.committed.envelope.git.noop, false);
    assert.equal(existsSync(join(emitDir, ".git")), true);
    assert.equal(first.proof.treeRun.ok, true);
    const ev = deliveryEvidence(first.proof);
    assert.equal(ev.treeRun.ok, true);
    assert.ok(typeof ev.evidenceHash === "string" && ev.evidenceHash, "the verdict evidence is kept");

    const second = withKeylessEnv(() => deliverVerified(projectFile, emitDir, 600_000));
    assert.equal(second.ok, true, "the idempotent re-delivery stays green");
    assert.equal(second.committed.envelope.git.committed, false);
    assert.equal(second.committed.envelope.git.noop, true, "an identical tree re-emits as a noop");
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

// Two ticks sharing one --work dir concurrently must not lose each other's
// durable record. The old blind atomic overwrite was last-writer-wins: both
// projects were driven, but only one survived in factory-state.json.
test(
  "concurrent ticks on one --work keep BOTH project records (no lost update)",
  { timeout: 600_000 },
  async () => {
    const root = mkdtempSync(join(tmpdir(), "rapidtool-factory-watch-x-"));
    const work = join(root, "work");
    const intakeA = join(root, "intakeA");
    const intakeB = join(root, "intakeB");
    mkdirSync(intakeA, { recursive: true });
    mkdirSync(intakeB, { recursive: true });
    writeFileSync(join(intakeA, "alpha.md"), BRIEF, "utf8");
    writeFileSync(join(intakeB, "beta.md"), BRIEF, "utf8");

    const [a, b] = await Promise.all([
      runFactoryAsync(["--intake", intakeA, "--work", work], { cwd: root }),
      runFactoryAsync(["--intake", intakeB, "--work", work], { cwd: root }),
    ]);
    assert.equal(a.status, 1, `alpha tick reports its keyless stall.\n${a.stdout}\n${a.stderr}`);
    assert.equal(b.status, 1, `beta tick reports its keyless stall.\n${b.stdout}\n${b.stderr}`);

    // Both projects really were driven on disk...
    assert.ok(existsSync(join(work, "alpha", "build.json")), "alpha project was created");
    assert.ok(existsSync(join(work, "beta", "build.json")), "beta project was created");

    // ...and BOTH durable records survive the concurrent commits.
    const statePath = join(work, "state", "factory-state.json");
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    assert.ok(state.projects.alpha, "alpha's record survived the concurrent commit");
    assert.ok(state.projects.beta, "beta's record survived the concurrent commit");
    assert.equal(state.projects.alpha.briefHash, briefHash(BRIEF));
    assert.equal(state.projects.beta.briefHash, briefHash(BRIEF));
    assert.equal(state.projects.alpha.status, "stalled");
    assert.equal(state.projects.beta.status, "stalled");
    assert.equal(existsSync(`${statePath}.lock`), false, "the state lock is released");
  },
);

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

test("usage refusals are coded — a valueless/empty --limit and --timeout-ms are refused, never a silent default", () => {
  const root = mkdtempSync(join(tmpdir(), "rapidtool-factory-watch-int-"));
  const intake = join(root, "intake");
  const work = join(root, "work");
  mkdirSync(intake, { recursive: true });
  mkdirSync(work, { recursive: true });

  // Pre-fix a bare --limit parsed as `true`, and intFlag returned the fallback
  // (Infinity) — the tick silently processed EVERY brief instead of refusing.
  const bareLimit = runFactory(["--intake", intake, "--work", work, "--limit"]);
  assert.equal(bareLimit.status, 1, "a bare --limit must refuse, never silently mean unlimited");
  assert.match(String(jsonOf(bareLimit).error), /--limit expects a non-negative integer/);

  const bareTimeout = runFactory(["--intake", intake, "--work", work, "--timeout-ms"]);
  assert.equal(bareTimeout.status, 1);
  assert.match(String(jsonOf(bareTimeout).error), /--timeout-ms expects a positive integer/);

  const emptyLimit = runFactory(["--intake", intake, "--work", work, "--limit="]);
  assert.equal(emptyLimit.status, 1);
  assert.match(String(jsonOf(emptyLimit).error), /--limit expects a non-negative integer/);
});
