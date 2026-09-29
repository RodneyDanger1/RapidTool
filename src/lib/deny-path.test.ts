// ---------------------------------------------------------------------------
// deny-path.test.ts — 312 C5 (fixes/312_c5_trust.md; CF-SE2-1, severity high).
//
// The import-protection DENY PATH. In the client bundle the TanStack plugin
// statically denies `*.server.*` imports and REWRITES runtime-assembled
// specifiers to an access-reporting mock proxy whose every property is a
// callable, truthy, never-settling thenable (SE2, fixes/311_se2_surfaces.md §1;
// starvation measured by 312 C3, fixes/312_c3_lifecycle.md §1). Trusting that
// proxy hung the wild driver and held the wild-start latch. The engine fix
// (engine.ts + settle.ts): refuse by HOST check — only a bare-Node host may
// resolve those specifiers; a denied host stays denied even under a spoofed
// "keyed" env, and never attempts a keyed call it cannot make.
//
// These pins drive the PUBLIC seams (wildStep, liveLayer) with a browser-shaped
// `process` shim: a keyed ENV (what a bundler define / mock can spoof) but NO
// `versions.node` — the one discriminator a client host cannot fake. The
// control leg proves the spoof IS visible to the provider module, so a pass is
// the HOST CHECK refusing, not env blindness. Zero network: fetch is stubbed.
//
// Run: node --experimental-strip-types --test src/lib/deny-path.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyProject, liveLayer, wildStep } from "./engine.ts";
import { isBareNodeHost } from "./settle.ts";
import type { Project } from "./types.ts";

/** Browser-shaped denied-host shim: keyed env present, versions.node absent. */
function makeDeniedProcess(): unknown {
  return { env: { DEEPSEEK_API_KEY: "sk-spoofed" }, versions: {} };
}

/** Swap `globalThis.process` for the denied-host shim; restore in `finally`. */
function spoofDeniedHost<T>(fn: () => Promise<T>): Promise<T> {
  const real = (globalThis as { process?: unknown }).process;
  (globalThis as { process?: unknown }).process = makeDeniedProcess();
  return fn().finally(() => {
    (globalThis as { process?: unknown }).process = real;
  });
}

/** An ACTIVE wild-run project with a machine-approvable gate open at P0. */
function gateFixture(): Project {
  const p = emptyProject({ name: "Deny", brief: "A wild brief for the deny-path pin." });
  p.wildMode = true;
  p.wildRun = {
    active: true,
    phase: 0,
    startedAt: Date.now(),
    lastAutoLog: "Wild run started at P0",
    lastAutoAt: Date.now(),
    stoppedAt: null,
    pause: false,
  };
  p.currentPhase = 0;
  p.status = "awaiting_hitl";
  p.phases[0] = { ...p.phases[0], status: "awaiting_hitl" };
  p.hitl = {
    phase: 0,
    title: "P0 reframe gate",
    prompt: "Approve the reframe?",
    stakes: "high",
    forceHuman: false,
  };
  return p;
}

describe("CF-SE2-1 denied-host pins (312 C5)", () => {
  it("a denied host stays denied under a spoofed proxy env — the gate pauses coded, never hangs", async () => {
    await spoofDeniedHost(async () => {
      assert.equal(isBareNodeHost(), false, "the spoofed host must read as denied");
      // NO injected reviewer: the engine's DEFAULT resolution decides. Before
      // the fix it resolved the import-protection mock and the await never
      // settled (the step never returned; store.ts's wild-start latch stayed
      // held). After the fix: the honest not-configured reviewer, coded pause.
      const res = await wildStep(gateFixture(), {});
      assert.equal(res.outcome, "paused");
      assert.equal(res.ran, true);
      assert.equal(res.code, "RT_E_LLM_NOT_CONFIGURED");
      assert.equal(res.project.wildRun?.pause, true);
      assert.ok(
        (res.project.logs ?? []).some((l) => l.event === "wild.paused_classifier"),
        "the coded classifier pause row must be recorded",
      );
    });
  });

  it("a denied host keeps P6 on the deterministic floor — a spoofed keyed env triggers ZERO keyed calls", async () => {
    const realFetch = (globalThis as { fetch?: unknown }).fetch;
    const calls: string[] = [];
    (globalThis as { fetch?: unknown }).fetch = (...args: unknown[]): Promise<never> => {
      calls.push(String(args[0]));
      return Promise.reject(new Error("deny-path pin: no network in this test"));
    };
    try {
      await spoofDeniedHost(async () => {
        // CONTROL: the spoof IS visible to the provider module (a keyed env),
        // so the refusal below is the HOST CHECK — not env blindness.
        const ds = await import("./deepseek.server.ts");
        assert.equal(ds.isDeepSeekConfigured(), true, "control: spoofed env must read keyed");
        const p = emptyProject({
          name: "Deny P6",
          brief: "A ledger brief about tenants, leases and rent payments.",
        });
        const res = await liveLayer(p, 6);
        assert.ok(res && typeof res === "object");
        assert.equal(
          calls.length,
          0,
          `no fetch may be attempted from a denied host, even under a keyed env spoof (saw: ${calls.join(", ")})`,
        );
      });
    } finally {
      (globalThis as { fetch?: unknown }).fetch = realFetch;
    }
  });
});
