// ---------------------------------------------------------------------------
// preview-sandbox.worker.ts — the Preview's evaluation realm (B2-F4).
//
// software-preview.tsx used to evaluate the emitted UI with `new Function` in
// the HOST page realm, where the emitted code could read `window` /
// `sessionStorage` — including the auth bearer token `auth/client.ts` stores
// there. This worker is a separate realm: a DedicatedWorkerGlobalScope has NO
// `window`, NO `document`, NO `sessionStorage`/`localStorage`/`indexedDB`, and
// NO DOM. The emitted modules are evaluated inside it, so a module that reaches
// for window storage gets a ReferenceError instead of the token.
//
// The evaluation itself is the SAME `renderEmittedComponent` the host used
// (src/lib/preview-render.ts) — moved, not weakened. The component exchanges
// `{id, modules, entryPath}` / `{id, ok, html|error}` over postMessage.
//
// Network primitives are additionally hard-stubbed before any emitted code runs
// (the sandbox.ts posture): the emitted UI has no legitimate need to fetch, and
// a silent request could otherwise exfiltrate whatever it read. Best-effort per
// surface — a host that cannot redefine a name still gets the realm boundary.
// ---------------------------------------------------------------------------

import { renderEmittedComponent } from "../lib/preview-render.ts";
import type { CompiledModule } from "../lib/preview-compile.server.ts";

type SandboxRequest = { id: number; modules: CompiledModule[]; entryPath: string };
type SandboxReply = { id: number; ok: boolean; html?: string; error?: string };

const scope = globalThis as unknown as {
  onmessage: ((ev: { data: SandboxRequest }) => void) | null;
  postMessage: (msg: SandboxReply) => void;
};

function deny(name: string): void {
  try {
    Object.defineProperty(scope, name, {
      value: () => {
        throw new Error(`${name} is not available in the preview sandbox`);
      },
      writable: false,
      configurable: false,
    });
  } catch {
    // Surface not definable on this host — the realm boundary already removes
    // window/document/storage, which is the property this worker exists for.
  }
}

for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts"]) {
  deny(name);
}

scope.onmessage = (ev) => {
  const req = ev.data;
  const result = renderEmittedComponent(req.modules, req.entryPath);
  scope.postMessage(
    result.ok ? { id: req.id, ok: true, html: result.html } : { id: req.id, ok: false, error: result.error },
  );
};
