// ---------------------------------------------------------------------------
// plugin.test.ts — T5.5 pins: the v1 registry's contracts on disk.
//
// What is pinned here (W18 LANE 4 done-when, verbatim, plus the playbook's
// traps for the T5.5 row):
//   · registration + DETERMINISTIC dispatch order — registration order, pinned
//     with reverse-alphabetical ids so a Map/object-key accident would red it;
//   · a THROWING hook's coded containment — the failure names the hook, the
//     host loop continues to the next hook, dispatch itself never throws;
//   · DUPLICATE-registration refusal — coded, the original hook untouched;
//   · (playbook trap) a state-writing hook cannot bypass `evaluatePolicy`:
//     registration refuses an unroutable claim, dispatch default-denies;
//   · (I4 + scope) a source scan of plugin.ts: no dynamic-code tokens, no
//     fs/network/env/clock/randomness tokens, and the isolation-claim word
//     appears nowhere in the module.
//
// Every block carries its own assertions (scripts/check-assertion-gaps.mjs is
// a gate). Run: node --experimental-strip-types --test --test-concurrency=2 src/lib/plugin.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  HOOK_KINDS,
  PLUGIN_API_VERSION,
  createPluginRegistry,
  type HookContext,
  type HookKind,
  type PluginHook,
} from "./plugin.ts";

/** A probe hook: appends its id to `ran` and returns its id. */
function probe(id: string, kind: HookKind, ran: string[]): PluginHook {
  return {
    id,
    apiVersion: PLUGIN_API_VERSION,
    kind,
    run: () => {
      ran.push(id);
      return id;
    },
  };
}

/** The authored module's source — the subject of the scope scan below. */
const PLUGIN_SOURCE = readFileSync(fileURLToPath(new URL("./plugin.ts", import.meta.url)), "utf8");

/**
 * Tokens the in-process boundary forbids in plugin.ts. The scan reads the RAW
 * source (comments included): a boundary claim that only holds when comments
 * are masked is not a claim worth pinning.
 */
const FORBIDDEN_SOURCE_TOKENS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "dynamic module load", pattern: /\bimport\s*\(/ },
  { label: "string evaluation", pattern: /\beval\s*\(/ },
  { label: "Function constructor", pattern: /\bnew\s+Function\s*\(/ },
  { label: "network access", pattern: /\bfetch\s*\(/ },
  { label: "CommonJS require", pattern: /\brequire\s*\(/ },
  { label: "fs floor import", pattern: /node:/ },
  { label: "wall-clock read", pattern: /\bDate\.now\b/ },
  { label: "ambient randomness", pattern: /\bMath\.random\b/ },
  { label: "ambient environment read", pattern: /process\.env/ },
];

function scanForbidden(source: string): string[] {
  return FORBIDDEN_SOURCE_TOKENS.filter(({ pattern }) => pattern.test(source)).map(
    ({ label }) => label,
  );
}

describe("plugin — versioned shape + explicit registration", () => {
  it("pins the v1 shape: the version constant, the four declared kinds, the registry's own version", () => {
    assert.equal(PLUGIN_API_VERSION, 1);
    assert.deepEqual(
      [...HOOK_KINDS],
      ["phase.synthesized", "phase.applied", "run.sealed", "p6.synthesized"],
    );
    const registry = createPluginRegistry();
    assert.equal(registry.version, PLUGIN_API_VERSION);
    assert.deepEqual(registry.ids(), [], "a fresh registry starts empty — nothing ambient");
  });

  it("registers a hook explicitly and lists ids in registration order", () => {
    const registry = createPluginRegistry();
    const ran: string[] = [];
    const receipt = registry.register(probe("alpha", "phase.synthesized", ran));
    assert.equal(receipt.ok, true);
    if (receipt.ok) {
      assert.equal(receipt.hookId, "alpha");
      assert.equal(receipt.kind, "phase.synthesized");
    }
    assert.deepEqual(registry.ids(), ["alpha"]);
    assert.deepEqual(registry.ids("phase.synthesized"), ["alpha"]);
    assert.deepEqual(registry.ids("run.sealed"), [], "no hooks for a kind nobody registered");
    assert.deepEqual(registry.ids("not.a.kind"), [], "an unknown kind has no hooks by definition");
    assert.deepEqual(ran, [], "registration alone never runs a hook");
  });

  it("refuses a hook declaring another plugin API version — nothing registered, nothing thrown", () => {
    const registry = createPluginRegistry();
    const stale = { ...probe("stale", "run.sealed", []), apiVersion: PLUGIN_API_VERSION + 1 };
    const receipt = registry.register(stale);
    assert.equal(receipt.ok, false);
    if (!receipt.ok) {
      assert.equal(receipt.code, "RT_E_VALIDATION");
      assert.match(receipt.error, /unsupported-api-version/);
      assert.match(receipt.error, /stale/);
    }
    assert.deepEqual(registry.ids(), []);
  });

  it("refuses malformed descriptors with a code and never throws", () => {
    const registry = createPluginRegistry();
    const garbage: unknown[] = [null, undefined, 42, "hook", [], {}, { id: "" }, { id: "   " }];
    for (const value of garbage) {
      const receipt = registry.register(value as PluginHook);
      assert.equal(
        receipt.ok,
        false,
        `expected a refusal for ${JSON.stringify(value) ?? String(value)}`,
      );
      if (!receipt.ok) assert.equal(receipt.code, "RT_E_VALIDATION");
    }
    assert.deepEqual(registry.ids(), [], "no refusal may half-register anything");
  });

  it("refuses a hook with no run function and a hook with an unknown kind", () => {
    const registry = createPluginRegistry();
    const noRun = { id: "no-run", apiVersion: PLUGIN_API_VERSION, kind: "run.sealed" };
    const badKind = { ...probe("bad-kind", "run.sealed", []), kind: "gate.opened" };
    const first = registry.register(noRun as unknown as PluginHook);
    const second = registry.register(badKind as unknown as PluginHook);
    assert.equal(first.ok, false);
    if (!first.ok) {
      assert.match(first.error, /invalid-hook/);
      assert.match(first.error, /no-run/);
    }
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.match(second.error, /unknown-hook-kind/);
      assert.match(second.error, /bad-kind/);
    }
    assert.deepEqual(registry.ids(), []);
  });
});

describe("plugin — duplicate-registration refusal", () => {
  it("refuses a duplicate id by code and leaves the original hook untouched", () => {
    const registry = createPluginRegistry();
    const ran: string[] = [];
    assert.equal(registry.register(probe("dup", "run.sealed", ran)).ok, true);
    const duplicate = registry.register(probe("dup", "run.sealed", ran));
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.code, "RT_E_VALIDATION");
      assert.match(duplicate.error, /duplicate-hook-id/);
      assert.match(duplicate.error, /dup/);
    }
    const report = registry.dispatch("run.sealed");
    assert.deepEqual(
      ran,
      ["dup"],
      "the original ran exactly once — the duplicate never overwrote it",
    );
    assert.equal(report.ok, true);
    assert.deepEqual(registry.ids(), ["dup"]);
  });

  it("an id is the hook's identity across kinds too — the refused hook leaves no registration behind", () => {
    const registry = createPluginRegistry();
    const ranA: string[] = [];
    const ranB: string[] = [];
    assert.equal(registry.register(probe("same", "phase.synthesized", ranA)).ok, true);
    const clash = registry.register(probe("same", "run.sealed", ranB));
    assert.equal(clash.ok, false);
    if (!clash.ok) assert.match(clash.error, /duplicate-hook-id/);
    const sealed = registry.dispatch("run.sealed");
    assert.deepEqual(sealed.outcomes, [], "the refused hook is not dispatched anywhere");
    assert.deepEqual(ranB, []);
    registry.dispatch("phase.synthesized");
    assert.deepEqual(ranA, ["same"]);
  });
});

describe("plugin — deterministic dispatch order (registration order, stated)", () => {
  it("visits hooks in registration order, pinned with reverse-alphabetical ids (never a key-order accident)", () => {
    const registry = createPluginRegistry();
    const ran: string[] = [];
    for (const id of ["zeta", "alpha", "mike"]) registry.register(probe(id, "phase.applied", ran));
    const report = registry.dispatch("phase.applied", { phase: "P4" });
    assert.equal(report.ok, true);
    assert.deepEqual(
      report.outcomes.map((outcome) => outcome.hookId),
      ["zeta", "alpha", "mike"],
    );
    assert.deepEqual(ran, ["zeta", "alpha", "mike"]);
    assert.deepEqual(
      registry.ids(),
      ["zeta", "alpha", "mike"],
      "dispatch never re-sorts the registry",
    );
    const again = registry.dispatch("phase.applied", { phase: "P4" });
    assert.deepEqual(
      again.outcomes.map((outcome) => outcome.hookId),
      ["zeta", "alpha", "mike"],
      "repeat dispatch is stable",
    );
  });

  it("append semantics: a hook registered later is visited later", () => {
    const registry = createPluginRegistry();
    const ran: string[] = [];
    registry.register(probe("first", "run.sealed", ran));
    assert.deepEqual(
      registry.dispatch("run.sealed").outcomes.map((outcome) => outcome.hookId),
      ["first"],
    );
    registry.register(probe("second", "run.sealed", ran));
    assert.deepEqual(
      registry.dispatch("run.sealed").outcomes.map((outcome) => outcome.hookId),
      ["first", "second"],
    );
  });

  it("dispatch is kind-scoped: hooks of other kinds never run", () => {
    const registry = createPluginRegistry();
    const ran: string[] = [];
    registry.register(probe("synth", "phase.synthesized", ran));
    registry.register(probe("seal", "run.sealed", ran));
    assert.deepEqual(
      registry.dispatch("run.sealed").outcomes.map((outcome) => outcome.hookId),
      ["seal"],
    );
    assert.deepEqual(
      registry.dispatch("phase.synthesized").outcomes.map((outcome) => outcome.hookId),
      ["synth"],
    );
    assert.deepEqual(ran, ["seal", "synth"]);
  });

  it("an unknown kind is a contained coded refusal — nothing dispatched, nothing thrown", () => {
    const registry = createPluginRegistry();
    const ran: string[] = [];
    registry.register(probe("seal", "run.sealed", ran));
    const report = registry.dispatch("gate.opened");
    assert.equal(report.ok, false);
    assert.equal(report.code, "RT_E_VALIDATION");
    assert.match(report.error ?? "", /unknown-kind/);
    assert.deepEqual(report.outcomes, []);
    assert.deepEqual(ran, [], "default-deny: no hook ran");
  });

  it("an empty dispatch is ok with zero outcomes", () => {
    const registry = createPluginRegistry();
    const report = registry.dispatch("p6.synthesized");
    assert.equal(report.ok, true);
    assert.deepEqual(report.outcomes, []);
  });
});

describe("plugin — a throwing hook is contained (coded, named, host continues)", () => {
  it("contains a throwing hook as a coded failure naming it, and the next hook still runs", () => {
    const registry = createPluginRegistry();
    const ran: string[] = [];
    registry.register(probe("before", "run.sealed", ran));
    registry.register({
      id: "boom",
      apiVersion: PLUGIN_API_VERSION,
      kind: "run.sealed",
      run: () => {
        throw new Error("kaboom");
      },
    });
    registry.register(probe("after", "run.sealed", ran));
    const report = registry.dispatch("run.sealed");
    assert.equal(report.ok, false);
    assert.deepEqual(
      report.outcomes.map((outcome) => outcome.hookId),
      ["before", "boom", "after"],
      "the visit reached the hook AFTER the failing one",
    );
    const failed = report.outcomes[1];
    assert.ok(failed);
    assert.equal(failed.status, "failed");
    if (failed.status === "failed") {
      assert.equal(failed.code, "RT_E_INTERNAL");
      assert.match(failed.error, /^hook-failed — boom:/);
      assert.match(failed.error, /kaboom/);
    }
    assert.deepEqual(
      ran,
      ["before", "after"],
      "the throwing hook's body did not complete; the host loop did",
    );
    assert.equal(report.code, "RT_E_INTERNAL");
    assert.match(report.error ?? "", /boom/, "the report's summary names the failing hook");
  });

  it("keeps a thrown RT_E code in the containment and contains non-Error throws", () => {
    const registry = createPluginRegistry();
    registry.register({
      id: "busy-hook",
      apiVersion: PLUGIN_API_VERSION,
      kind: "phase.applied",
      run: () => {
        throw Object.assign(new Error("resource busy"), { code: "RT_E_BUSY" });
      },
    });
    registry.register({
      id: "string-hook",
      apiVersion: PLUGIN_API_VERSION,
      kind: "phase.applied",
      run: () => {
        throw "literal-failure";
      },
    });
    const report = registry.dispatch("phase.applied");
    assert.equal(report.ok, false);
    assert.equal(report.outcomes.length, 2);
    const busy = report.outcomes[0];
    assert.ok(busy);
    assert.equal(busy.status, "failed");
    if (busy.status === "failed") {
      assert.equal(busy.code, "RT_E_BUSY", "a thrown RT_E_* code wins over the fallback");
      assert.match(busy.error, /resource busy/);
      assert.match(busy.error, /busy-hook/);
    }
    const literal = report.outcomes[1];
    assert.ok(literal);
    assert.equal(literal.status, "failed");
    if (literal.status === "failed") {
      assert.equal(literal.code, "RT_E_INTERNAL");
      assert.match(literal.error, /literal-failure/);
      assert.match(literal.error, /string-hook/);
    }
  });

  it("dispatch never throws even when every hook throws — the report is the containment", () => {
    const registry = createPluginRegistry();
    for (const id of ["t1", "t2", "t3"]) {
      registry.register({
        id,
        apiVersion: PLUGIN_API_VERSION,
        kind: "run.sealed",
        run: () => {
          throw new Error(`${id}-failed`);
        },
      });
    }
    const report = registry.dispatch("run.sealed"); // must resolve, not reject
    assert.equal(report.ok, false);
    assert.deepEqual(
      report.outcomes.map((outcome) => outcome.status),
      ["failed", "failed", "failed"],
    );
    assert.deepEqual(
      report.outcomes.map((outcome) => outcome.hookId),
      ["t1", "t2", "t3"],
      "every visit is recorded, in order",
    );
    assert.match(report.error ?? "", /3 of 3 hook\(s\) did not run/);
  });

  it("contains a promise-returning hook: synchronous v1 refuses it and neutralizes the unattended rejection", async () => {
    let unhandled = 0;
    const onUnhandled = (): void => {
      unhandled += 1;
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      const registry = createPluginRegistry();
      registry.register({
        id: "async-hook",
        apiVersion: PLUGIN_API_VERSION,
        kind: "p6.synthesized",
        run: () => Promise.reject(new Error("late-rejection")),
      });
      const report = registry.dispatch("p6.synthesized");
      assert.equal(report.ok, false);
      const outcome = report.outcomes[0];
      assert.ok(outcome);
      assert.equal(outcome.status, "failed");
      if (outcome.status === "failed") {
        assert.equal(outcome.code, "RT_E_VALIDATION");
        assert.match(outcome.error, /async-hook/);
        assert.match(outcome.error, /thenable/);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
      assert.equal(
        unhandled,
        0,
        "the refused promise was neutralized — no unattended rejection reached the host loop",
      );
    } finally {
      process.removeListener("unhandledRejection", onUnhandled);
    }
  });
});

describe("plugin — state-writing hooks are routed through the ONE policy seam (default-deny)", () => {
  it("runs a state-writing hook only under an allow verdict and hands it the verdict in ctx", () => {
    const registry = createPluginRegistry();
    const seen: HookContext[] = [];
    registry.register({
      id: "writer",
      apiVersion: PLUGIN_API_VERSION,
      kind: "run.sealed",
      writesState: true,
      policy: { action: "tree.emit", resource: "tree:src/lib/patch.ts" },
      run: (_payload, ctx) => {
        seen.push(ctx);
        return "written";
      },
    });
    const autopilot = registry.dispatch(
      "run.sealed",
      {},
      {
        actor: { decidedBy: "autopilot", seat: "harness" },
      },
    );
    assert.equal(autopilot.ok, true);
    const outcome = autopilot.outcomes[0];
    assert.ok(outcome);
    assert.equal(outcome.status, "ran");
    if (outcome.status === "ran") {
      assert.equal(outcome.result, "written");
      assert.equal(outcome.policy?.decision, "allow");
      assert.match(outcome.policy?.reason ?? "", /^autopilot-seat/);
    }
    assert.equal(seen[0]?.hookId, "writer");
    assert.equal(seen[0]?.policy?.decision, "allow");
    const human = registry.dispatch(
      "run.sealed",
      {},
      {
        actor: { decidedBy: "human", seat: "human-cli-i-am-human" },
        humanSeatToken: "tok-1",
        expectedHumanSeatToken: "tok-1",
      },
    );
    assert.equal(human.ok, true);
    const humanOutcome = human.outcomes[0];
    assert.ok(humanOutcome);
    assert.equal(humanOutcome.status, "ran");
    if (humanOutcome.status === "ran") {
      assert.match(humanOutcome.policy?.reason ?? "", /^human-seat-token-verified/);
    }
    assert.equal(seen.length, 2);
  });

  it("default-denies with no seat: the writer never runs, the refusal is named, the host continues", () => {
    const registry = createPluginRegistry();
    const ran: string[] = [];
    let wrote = 0;
    registry.register({
      id: "writer",
      apiVersion: PLUGIN_API_VERSION,
      kind: "run.sealed",
      writesState: true,
      policy: { action: "tree.emit", resource: "tree:out/artifact.ts" },
      run: () => {
        wrote += 1;
        return "written";
      },
    });
    registry.register(probe("observer", "run.sealed", ran));
    const report = registry.dispatch("run.sealed");
    assert.equal(report.ok, false);
    const refused = report.outcomes[0];
    assert.ok(refused);
    assert.equal(refused.status, "refused");
    if (refused.status === "refused") {
      assert.equal(refused.code, "RT_E_PERMISSION_DENIED");
      assert.equal(refused.fallback, "autopilot-seat");
      assert.match(refused.error, /^hook-refused — writer:/);
      assert.match(refused.error, /no-seat/);
    }
    assert.equal(wrote, 0, "the writer did not run without an allow verdict");
    assert.deepEqual(ran, ["observer"], "the loop continued to the next hook");
  });

  it("denies out-of-namespace with fallback none and an unverified human seat with the token fallback", () => {
    const registry = createPluginRegistry();
    let writes = 0;
    registry.register({
      id: "out-of-namespace",
      apiVersion: PLUGIN_API_VERSION,
      kind: "run.sealed",
      writesState: true,
      policy: { action: "tree.emit", resource: "gate:P4" },
      run: () => {
        writes += 1;
      },
    });
    registry.register({
      id: "human-unverified",
      apiVersion: PLUGIN_API_VERSION,
      kind: "run.sealed",
      writesState: true,
      policy: { action: "tree.emit", resource: "tree:x" },
      run: () => {
        writes += 1;
      },
    });
    const report = registry.dispatch(
      "run.sealed",
      {},
      {
        actor: { decidedBy: "human", seat: "human-cli-i-am-human" },
      },
    );
    assert.equal(report.ok, false);
    const namespace = report.outcomes[0];
    assert.ok(namespace);
    assert.equal(namespace.status, "refused");
    if (namespace.status === "refused") {
      assert.match(namespace.error, /unknown-resource/);
      assert.equal(namespace.fallback, "none");
    }
    const human = report.outcomes[1];
    assert.ok(human);
    assert.equal(human.status, "refused");
    if (human.status === "refused") {
      assert.match(human.error, /human-seat-unverified/);
      assert.equal(human.fallback, "human-seat-token");
    }
    assert.equal(writes, 0);
  });

  it("registration refuses a state-writing hook with no routable claim — no registration path bypasses the seam", () => {
    const registry = createPluginRegistry();
    const missing = registry.register({
      id: "writer-no-claim",
      apiVersion: PLUGIN_API_VERSION,
      kind: "run.sealed",
      writesState: true,
      run: () => undefined,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.code, "RT_E_VALIDATION");
      assert.match(missing.error, /unroutable-policy-claim/);
      assert.match(missing.error, /writer-no-claim/);
    }
    const badClaim = {
      id: "writer-bad-action",
      apiVersion: PLUGIN_API_VERSION,
      kind: "run.sealed",
      writesState: true,
      policy: { action: "gate.write", resource: "gate:P1" },
      run: () => undefined,
    } as unknown as PluginHook;
    const unknownAction = registry.register(badClaim);
    assert.equal(unknownAction.ok, false);
    if (!unknownAction.ok) assert.match(unknownAction.error, /unroutable-policy-claim/);
    const inert = registry.register({
      id: "inert-claim",
      apiVersion: PLUGIN_API_VERSION,
      kind: "run.sealed",
      policy: { action: "tree.emit", resource: "tree:x" },
      run: () => undefined,
    });
    assert.equal(inert.ok, false);
    if (!inert.ok) assert.match(inert.error, /inert/);
    assert.deepEqual(registry.ids(), [], "none of the refusals registered anything");
  });
});

describe("plugin — in-process only (source scan, with teeth)", () => {
  it("the scanner has teeth: planted violations are found", () => {
    assert.deepEqual(scanForbidden('const mod = await import("./foreign.ts");'), [
      "dynamic module load",
    ]);
    assert.deepEqual(scanForbidden('const t = eval("1+1");'), ["string evaluation"]);
    assert.deepEqual(scanForbidden('const t = new Function("return 1");'), [
      "Function constructor",
    ]);
    assert.deepEqual(scanForbidden("await fetch(url);"), ["network access"]);
    assert.deepEqual(scanForbidden("const p = process.env.RT_HUMAN_SEAT_TOKEN;"), [
      "ambient environment read",
    ]);
    assert.deepEqual(scanForbidden("const now = Date.now();"), ["wall-clock read"]);
    assert.deepEqual(scanForbidden("const x = 1;"), [], "a clean snippet scans clean");
  });

  it("plugin.ts contains zero forbidden tokens (no dynamic code, network, fs, env, clock, randomness)", () => {
    const hits = scanForbidden(PLUGIN_SOURCE);
    assert.deepEqual(hits, [], `forbidden tokens found in plugin.ts: ${hits.join(", ")}`);
  });

  it("the isolation-claim word appears nowhere in plugin.ts (I4)", () => {
    assert.equal(
      /sandbox/i.test(PLUGIN_SOURCE),
      false,
      "plugin.ts must not carry the isolation-claim word — the v1 scope is in-process only",
    );
  });
});
