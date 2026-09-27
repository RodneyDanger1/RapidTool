import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPhase6Module,
  healSource,
  runGenerated,
  runSandboxed,
  sandboxWorkerSource,
} from "./sandbox.ts";
import type { SandboxWorker } from "./sandbox.ts";

// ---------------------------------------------------------------------------
// Helpers: a fake worker that exercises runSandboxed WITHOUT a real web Worker
// (Node has none). It mirrors the real worker protocol exactly: the host posts
// {id, code}; the fake evaluates the code the way sandboxWorkerSource() does
// (same throwing network stubs, same test_happy/test_no_skip tail), then
// delivers {id, ok, detail} through onmessage. Strategy knobs let tests
// exercise silence (timeout/terminate) and stale (id-mismatched) replies.
// ---------------------------------------------------------------------------

const STUB_ERROR = "network primitives are stubbed in the sandbox worker";
const TEST_TAIL =
  '\n;if (typeof test_happy === "function") test_happy();\nif (typeof test_no_skip === "function") test_no_skip();';

type HostMessage = { id: number; code: string };
type Reply = { id: number; ok: boolean; detail: string };

function evaluateLikeWorker(code: string): { ok: boolean; detail: string } {
  const stub = (): never => {
    throw new Error(STUB_ERROR);
  };
  const quietConsole = { log() {}, warn() {}, error() {} };
  try {
    const fn = new Function("fetch", "WebSocket", "XMLHttpRequest", "console", `${code}${TEST_TAIL}`);
    fn(stub, stub, stub, quietConsole);
    return { ok: true, detail: "tests.pass" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

type FakeBehavior = "eval" | "silent" | "wrong-id-only" | "wrong-id-then-eval" | "crash";

class FakeWorker implements SandboxWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  terminated = false;
  posted: HostMessage[] = [];
  private readonly behavior: FakeBehavior;

  constructor(behavior: FakeBehavior) {
    this.behavior = behavior;
  }

  postMessage(data: unknown): void {
    const msg = data as HostMessage;
    this.posted.push(msg);
    const deliver = (payload: Reply): void => {
      queueMicrotask(() => {
        this.onmessage?.({ data: payload });
      });
    };
    if (this.behavior === "silent") return;
    if (this.behavior === "crash") {
      // Worker dies before ever replying (CSP block / blob parse failure):
      // fire onerror only — the host must settle via the A14 error path.
      queueMicrotask(() => {
        this.onerror?.(new Error("worker exploded"));
      });
      return;
    }
    if (this.behavior === "wrong-id-only") {
      deliver({ id: msg.id + 1000, ok: true, detail: "stale-worker reply" });
      return;
    }
    const real = evaluateLikeWorker(msg.code);
    if (this.behavior === "wrong-id-then-eval") {
      deliver({ id: msg.id + 1000, ok: true, detail: "stale-worker reply" });
    }
    deliver({ id: msg.id, ok: real.ok, detail: real.detail });
  }

  terminate(): void {
    this.terminated = true;
  }
}

function fakeWorker(behavior: FakeBehavior): FakeWorker {
  return new FakeWorker(behavior);
}

const NON_TEMPLATE_MSG = "non-template source requires runSandboxed()";

// ---------------------------------------------------------------------------
// runGenerated — honest sync template gate (B-01)
// ---------------------------------------------------------------------------

describe("runGenerated (sync template gate)", () => {
  it("refuses arbitrary non-template code (console.log only)", () => {
    const res = runGenerated('console.log("hello");');
    assert.equal(res.ok, false);
    assert.equal(res.detail, NON_TEMPLATE_MSG);
  });

  it("refuses code containing fetch()", () => {
    const res = runGenerated('fetch("https://example.com");');
    assert.equal(res.ok, false);
    assert.equal(res.detail, NON_TEMPLATE_MSG);
  });

  it("refuses dynamic import() code", () => {
    const res = runGenerated('import("./lazy.js");');
    assert.equal(res.ok, false);
    assert.equal(res.detail, NON_TEMPLATE_MSG);
  });

  it("keeps the denylist message for forbidden tokens even inside template-shaped code", () => {
    const res = runGenerated('const JOBS = ["a"];\nfunction test_no_skip() {}\nprocess.exit(0);');
    assert.equal(res.ok, false);
    assert.equal(res.detail, "Forbidden primitive in generated module.");
  });

  it("accepts and executes buildPhase6Module output", () => {
    const code = buildPhase6Module({ name: "demo", jobs: ["job-a"] });
    const res = runGenerated(code);
    assert.equal(res.ok, true);
    assert.equal(res.detail, "tests.pass");
  });

  it("accepts and executes buildPhase6Module variant 1 output", () => {
    const code = buildPhase6Module({ name: "demo", jobs: ["job-a"], rejectionNote: "needs work", variant: 1 });
    const res = runGenerated(code);
    assert.equal(res.ok, true);
    assert.equal(res.detail, "tests.pass");
  });

  // --- A02 regression: the denylist must never scan engine-injected prose ---

  it("passes a module whose rejection-note prose contains 'process'/'fetch'/'require' (A02)", () => {
    const code = buildPhase6Module({
      name: "Tracker",
      jobs: ["dispatch"],
      rejectionNote: "Please document the flow and process each job in order; no fetch of remote state before require sign-off, eval the diff.",
      variant: 1,
    });
    const res = runGenerated(code);
    assert.equal(res.ok, true, `A02 false positive: ${res.detail}`);
    assert.equal(res.detail, "tests.pass");
  });

  it("treats denylist words inside string literals of template-shaped code as text (A02)", () => {
    const code = 'const JOBS = ["process", "fetch"];\nfunction test_no_skip() { if (JOBS.length !== 2) throw new Error("x"); }';
    const res = runGenerated(code);
    assert.equal(res.ok, true, res.detail);
  });

  it("does not flag denylist words inside comments of template-shaped code (A02)", () => {
    const code =
      'const JOBS = ["a"];\n// prose: process, fetch, require, eval, import — a human note\nfunction test_no_skip() { var ok = true; if (!ok) throw new Error("x"); }';
    const res = runGenerated(code);
    assert.equal(res.ok, true, res.detail);
  });

  it("still refuses REAL process/require identifiers outside literals (A02 keeps its teeth)", () => {
    const processExit = 'const JOBS = ["a"];\nfunction test_no_skip() {}\nprocess.exit(0);';
    const viaRequire = 'const JOBS = ["a"];\nfunction test_no_skip() {}\nvar fs = require("fs");';
    for (const code of [processExit, viaRequire]) {
      const res = runGenerated(code);
      assert.equal(res.ok, false);
      assert.equal(res.detail, "Forbidden primitive in generated module.");
    }
  });

  // --- A13 regression: bare page-global escapes are blocked in the sync path ---

  it("blocks bare fetch()/WebSocket/self.* in template-shaped code (A13)", () => {
    const sources = [
      'const JOBS = ["a"];\nfunction test_no_skip() {}\nfetch("https://example.com");',
      'const JOBS = ["a"];\nfunction test_no_skip() {}\nnew WebSocket("wss://example.com");',
      'const JOBS = ["a"];\nfunction test_no_skip() {}\nself.fetch("https://example.com");',
      'const JOBS = ["a"];\nfunction test_no_skip() {}\nwindow.location.href = "https://example.com";',
    ];
    for (const code of sources) {
      const res = runGenerated(code);
      assert.equal(res.ok, false, `must refuse: ${code.split("\n")[2]}`);
      assert.equal(res.detail, "Forbidden primitive in generated module.");
    }
  });
});

// ---------------------------------------------------------------------------
// buildPhase6Module — deterministic template builder
// ---------------------------------------------------------------------------

describe("buildPhase6Module", () => {
  it("is deterministic: identical args yield byte-identical output", () => {
    const args = { name: "demo", jobs: ["job-a", "job-b"], rejectionNote: "n/a" };
    const a = buildPhase6Module(args);
    const b = buildPhase6Module(args);
    assert.equal(a, b);
    assert.equal(buildPhase6Module({ name: "demo", jobs: ["job-a"] }), buildPhase6Module({ name: "demo", jobs: ["job-a"] }));
  });

  it("different inputs yield different output", () => {
    const a = buildPhase6Module({ name: "demo", jobs: ["job-a"] });
    const b = buildPhase6Module({ name: "demo", jobs: ["job-b"] });
    assert.notEqual(a, b);
  });

  it("variant 1 adds test_rejection_addressed; variant 0 does not", () => {
    const base = buildPhase6Module({ name: "demo", jobs: ["job-a"], variant: 0 });
    const v1 = buildPhase6Module({ name: "demo", jobs: ["job-a"], variant: 1 });
    assert.ok(!base.includes("test_rejection_addressed"));
    assert.ok(v1.includes("test_rejection_addressed"));
  });
});

// ---------------------------------------------------------------------------
// healSource — unchanged semantics, output must still pass the sync gate
// ---------------------------------------------------------------------------

describe("healSource", () => {
  it("no-ops when test_happy is already present", () => {
    const code = buildPhase6Module({ name: "demo", jobs: ["job-a"] });
    const healed = healSource(code, "ReferenceError: test_happy is not defined");
    assert.equal(healed, code);
  });

  it("repairs a module missing test_happy and the repaired output passes the gate", () => {
    const code = buildPhase6Module({ name: "demo", jobs: ["job-a"] });
    const stripped = code.replace(/function test_happy\(\) \{\n[\s\S]*?\n\}/, "");
    assert.ok(!stripped.includes("function test_happy"));
    // Stripped module is still template-shaped and passes on its own.
    assert.equal(runGenerated(stripped).ok, true);
    // healSource appends a template-shaped test_happy (B-07 flow)…
    const healed = healSource(stripped, "ReferenceError: test_happy is not defined");
    assert.notEqual(healed, stripped);
    assert.ok(healed.includes("function test_happy"));
    // …and the healed source still passes the sync gate and runs green.
    const res = runGenerated(healed);
    assert.equal(res.ok, true);
    assert.equal(res.detail, "tests.pass");
  });
});

// ---------------------------------------------------------------------------
// sandboxWorkerSource — real worker body contents
// ---------------------------------------------------------------------------

describe("sandboxWorkerSource", () => {
  it("defines throwing fetch/WebSocket/XMLHttpRequest stubs and console capture", () => {
    const src = sandboxWorkerSource();
    assert.ok(src.includes("fetch"), "worker source mentions fetch stub");
    assert.ok(src.includes("WebSocket"), "worker source mentions WebSocket stub");
    assert.ok(src.includes("XMLHttpRequest"), "worker source mentions XMLHttpRequest stub");
    assert.ok(src.includes("network primitives are stubbed"), "stubs throw a network-denied error");
    assert.ok(src.includes("onmessage"), "worker registers a message handler");
    assert.ok(src.includes("console"), "worker shadows console for capture");
  });
});

// ---------------------------------------------------------------------------
// runSandboxed — real async sandbox protocol, exercised via injected fakes
// ---------------------------------------------------------------------------

describe("runSandboxed", () => {
  it("reports worker unavailable when the factory throws (no web Worker in Node)", async () => {
    const res = await runSandboxed("whatever();", {
      timeoutMs: 100,
      workerFactory: () => {
        throw new Error("no worker");
      },
    });
    assert.equal(res.ok, false);
    assert.equal(res.detail, "worker unavailable");
  });

  it("happy path: template module passes inside the worker", async () => {
    const code = buildPhase6Module({ name: "demo", jobs: ["job-a"] });
    const worker = fakeWorker("eval");
    const res = await runSandboxed(code, { timeoutMs: 2000, workerFactory: () => worker });
    assert.equal(res.ok, true);
    assert.ok(res.detail.includes("tests.pass"));
    assert.equal(worker.posted.length, 1);
    assert.equal(worker.posted[0].code, code);
    assert.equal(typeof worker.posted[0].id, "number");
  });

  it("surfaces thrown test errors as ok:false with the error text", async () => {
    const worker = fakeWorker("eval");
    const res = await runSandboxed('function test_happy() { throw new Error("boom-in-worker"); }', {
      timeoutMs: 2000,
      workerFactory: () => worker,
    });
    assert.equal(res.ok, false);
    assert.ok(res.detail.includes("boom-in-worker"), `detail was: ${res.detail}`);
  });

  it("blocks fetch() inside the worker via the throwing stub", async () => {
    const worker = fakeWorker("eval");
    const res = await runSandboxed('fetch("https://example.com");', {
      timeoutMs: 2000,
      workerFactory: () => worker,
    });
    assert.equal(res.ok, false);
    assert.ok(res.detail.includes("stubbed"), `detail was: ${res.detail}`);
  });

  it("kills a never-replying worker via terminate() and reports the timeout", async () => {
    const worker = fakeWorker("silent");
    const res = await runSandboxed("while (true) {}", {
      timeoutMs: 20,
      workerFactory: () => worker,
    });
    assert.equal(res.ok, false);
    assert.ok(res.detail.includes("killed"), `detail was: ${res.detail}`);
    assert.equal(worker.terminated, true, "terminate() must have been called");
  });

  it("ignores id-mismatched (stale) replies and only resolves via the timeout", async () => {
    const worker = fakeWorker("wrong-id-only");
    const res = await runSandboxed('console.log("x");', {
      timeoutMs: 20,
      workerFactory: () => worker,
    });
    // The stale reply claimed ok:true; it must NOT have resolved the promise.
    assert.equal(res.ok, false);
    assert.ok(res.detail.includes("killed"), `detail was: ${res.detail}`);
    assert.ok(!res.detail.includes("stale-worker reply"));
    assert.equal(worker.terminated, true);
  });

  it("still resolves once a matching-id reply arrives after a stale one", async () => {
    const code = buildPhase6Module({ name: "demo", jobs: ["job-a"] });
    const worker = fakeWorker("wrong-id-then-eval");
    const res = await runSandboxed(code, { timeoutMs: 2000, workerFactory: () => worker });
    assert.equal(res.ok, true);
    assert.ok(res.detail.includes("tests.pass"), `detail was: ${res.detail}`);
  });

  it("settles fast with 'worker crashed' when the worker fires onerror before replying (A14)", async () => {
    const worker = fakeWorker("crash");
    const res = await runSandboxed("worker dies before this ever executes", {
      // Long timeout on purpose: without the onerror path this test would hang
      // ~5s and lie with "killed after 5s" (it was never killed — it crashed).
      timeoutMs: 5000,
      workerFactory: () => worker,
    });
    assert.equal(res.ok, false);
    assert.equal(res.detail, "worker crashed");
    assert.equal(worker.terminated, true, "terminate() must follow a crash settle");
  });
});

// fixes/152 (steal #2): post-hoc claim gates — verifyClaims against an artifact map.
import { verifyClaims, type ClaimRow } from "./sandbox.ts";
describe("verifyClaims (post-hoc claim gates)", () => {
  const artifacts = {
    "src/generated.ts": "export function createBoard() { return 1 }",
    "src/api/routes.ts": "// placeholder",
  };
  it("all claims met → ok, no unmet", () => {
    const claims: ClaimRow[] = [
      { kind: "file-exists", target: "src/generated.ts" },
      { kind: "dir-non-empty", target: "src/" },
      { kind: "contains-identifier", target: "src/generated.ts", expect: "createBoard" },
    ];
    assert.deepEqual(verifyClaims(claims, artifacts), { ok: true, unmet: [] });
  });
  it("missing file / empty dir / absent identifier → honest unmet list, never silent", () => {
    const claims: ClaimRow[] = [
      { kind: "file-exists", target: "src/nope.ts" },
      { kind: "dir-non-empty", target: "src/jobs/" },
      { kind: "contains-identifier", target: "src/generated.ts", expect: "rentRoll" },
    ];
    const r = verifyClaims(claims, artifacts);
    assert.equal(r.ok, false);
    assert.equal(r.unmet.length, 3);
    assert.match(r.unmet[0]!, /missing file: src\/nope\.ts/);
    assert.match(r.unmet[1]!, /empty dir: src\/jobs\//);
    assert.match(r.unmet[2]!, /identifier absent: rentRoll/);
  });
  it("junk claims and absent maps are unmet, never thrown", () => {
    const r = verifyClaims([null, { kind: "file-exists" }] as unknown as ClaimRow[], {});
    assert.equal(r.ok, false);
    assert.equal(r.unmet.length, 2);
  });
});
