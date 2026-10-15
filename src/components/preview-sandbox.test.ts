// ---------------------------------------------------------------------------
// preview-sandbox.test.ts — B2-F4: the emitted Preview runs in a realm that
// cannot reach `window` / `sessionStorage`.
//
// The defect: software-preview.tsx evaluated untrusted emitted code with
// `new Function` in the HOST page realm, where it could read the auth bearer
// token that `auth/client.ts` keeps in `sessionStorage`. The fix evaluates the
// SAME `renderEmittedComponent` inside a DedicatedWorker
// (src/components/preview-sandbox.worker.ts), a realm with no `window`,
// `document` or storage.
//
// This test proves BOTH halves of the boundary with a real worker:
//   1. In a realm that HAS `window.sessionStorage`, the emitted module reads it
//      (the leak the fix exists for).
//   2. A real `node:worker_threads` worker — which, like a browser worker,
//      inherits NO main-thread globals — cannot read it: the module throws and
//      the render fails honestly.
//   3. A benign emitted module still renders to HTML in that worker.
//
// `node:worker_threads` is the node analogue of the browser DedicatedWorker:
// same isolation property (isolated global scope), same production evaluator
// (`preview-render.ts`). The browser worker itself is verified in-browser.
// ---------------------------------------------------------------------------
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { renderEmittedComponent } from "../lib/preview-render.ts";
import type { CompiledModule } from "../lib/preview-compile.server.ts";

const ENTRY = "src/ui/app.tsx";

/** A module that tries to read the auth bearer token out of window storage. */
const WINDOW_READER: CompiledModule[] = [
  {
    path: ENTRY,
    code: [
      '"use strict";',
      'const React = require("react");',
      "function App() {",
      '  const token = window.sessionStorage.getItem("grok-auth.bearer-token");',
      '  return React.createElement("div", null, String(token));',
      "}",
      "module.exports.default = App;",
    ].join("\n"),
  },
];

/** A benign module that renders plain markup. */
const BENIGN: CompiledModule[] = [
  {
    path: ENTRY,
    code: [
      '"use strict";',
      'const React = require("react");',
      "function App() {",
      '  return React.createElement("div", null, "sandboxed hello");',
      "}",
      "module.exports.default = App;",
    ].join("\n"),
  },
];

type WorkerOutcome = { ok: boolean; html?: string; error?: string };

/** Run the SAME evaluator the browser worker uses, in a real worker realm. */
function runInWorker(modules: CompiledModule[], entryPath: string): Promise<WorkerOutcome> {
  const renderUrl = new URL("../lib/preview-render.ts", import.meta.url).href;
  const workerCode = [
    'const { parentPort, workerData } = require("node:worker_threads");',
    "import(workerData.renderUrl)",
    "  .then((m) => parentPort.postMessage(m.renderEmittedComponent(workerData.modules, workerData.entryPath)))",
    "  .catch((e) => parentPort.postMessage({ ok: false, error: String((e && e.message) || e) }));",
  ].join("\n");
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerCode, {
      eval: true,
      execArgv: ["--experimental-strip-types"],
      workerData: { renderUrl, modules, entryPath },
    });
    worker.once("message", (msg: WorkerOutcome) => {
      void worker.terminate();
      resolve(msg);
    });
    worker.once("error", reject);
  });
}

// A main-thread window with a token, exactly like the host page in the browser.
// Left in place through the worker tests to prove the worker does NOT inherit it.
const fakeWindow = { sessionStorage: { getItem: () => "Bearer SECRET-TOKEN" } };
(globalThis as unknown as { window: unknown }).window = fakeWindow;

after(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("B2-F4 preview sandbox realm", () => {
  it("host realm: emitted code CAN read window.sessionStorage (the defect)", () => {
    const host = renderEmittedComponent(WINDOW_READER, ENTRY);
    assert.equal(host.ok, true, "the host evaluator renders it");
    assert.match(host.html, /SECRET-TOKEN/, "the host realm exposes the token to emitted code");
  });

  it("worker realm: the same module cannot reach window storage", async () => {
    const outcome = await runInWorker(WINDOW_READER, ENTRY);
    assert.equal(outcome.ok, false, "the render must fail honestly in the worker");
    assert.match(String(outcome.error), /window is not defined/);
    assert.ok(!String(outcome.html ?? "").includes("SECRET-TOKEN"), "the token must never surface");
  });

  it("worker realm: a benign emitted module still renders", async () => {
    const outcome = await runInWorker(BENIGN, ENTRY);
    assert.equal(outcome.ok, true, `expected ok, got ${outcome.error ?? ""}`);
    assert.match(String(outcome.html), /sandboxed hello/);
  });
});
