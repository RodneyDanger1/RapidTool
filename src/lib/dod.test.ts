// ---------------------------------------------------------------------------
// dod.test.ts — W48 / 334-3 "Transit": the P6 DoD probe vs an UNVERIFIED tree.
//
// The DoD registry lives in dod.ts; its long-standing behavioural tests live in
// gates.test.ts. This file pins the W48 T1b decision that gates.test.ts cannot:
// whether an emitted tree whose DECLARED `typecheck`/`build` scripts never ran
// satisfies `p6-test` / `p6-verified`, and where the honest line sits.
//
// Run: node --experimental-strip-types --test src/lib/dod.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runGate } from "./dod.ts";
import { mintTreeRunTested } from "./codegen.server.ts";
import { emptyProject } from "./engine.ts";
import type { Project } from "./types.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";

const base = (): Project => emptyProject({ name: "Dod334", brief: "A dispatch board for field service." });

/**
 * A green tree-run outcome that EXECUTED its spec(s) — the shape the P6 journey
 * feeds `mintTreeRunTested` — but whose declared package.json scripts did not
 * run. `declaredScriptsVerified:false` + `unverifiedDeclaredScripts` is exactly
 * what compile-check.server's `treeRun` reports for a fresh, uninstalled tree.
 */
const greenUnverifiedOutcome = (over: Partial<TreeRunOutcome> = {}): TreeRunOutcome =>
  ({
    ok: true,
    dir: "C:/scratch/rt-dod",
    compile: { ok: true, dir: "C:/scratch/rt-dod", checked: 2, passed: 2, failed: 0, skipped: 0, verdicts: [] },
    tests: [
      {
        file: "tests/oracle.spec.ts",
        compile: { file: "tests/oracle.spec.ts", ok: true, verdict: null },
        tests: { pass: 3, fail: 0 },
        run: "pass",
      },
    ],
    run: { kind: "ui-shell", run: "skip", detail: "UI shell — not executable headless" },
    declaredScriptsVerified: false,
    unverifiedDeclaredScripts: ["typecheck", "build"],
    ...over,
  }) as unknown as TreeRunOutcome;

const met = (p: Project, id: string): boolean => !runGate(p, 6).unmet.some((g) => g.id === id);

describe("W48 / 334-3 (T1b) — p6-test / p6-verified vs an unverified declared toolchain", () => {
  it("a GREEN executed tree-run whose declared typecheck/build never ran still mints the tested verdict the P6 DoD requires", () => {
    const minted = mintTreeRunTested(base(), greenUnverifiedOutcome());
    const lt = minted.lastTest as { label?: string; detail?: string; evidenceHash?: string } | null;
    assert.equal(lt?.label, "tested", "an executed green tree-run still promotes to the tested verdict");
    assert.match(String(lt?.detail), /tree-run green/, "the stamp records the executed run, not a bare label");

    // The honest line: the criteria measure the EXECUTED self-test / machine-run
    // verdict over the tree's own specs — which genuinely ran green — so they are
    // met. They do NOT attest the declared project toolchain.
    assert.equal(met(minted, "p6-test"), true, "the executed self-test passed");
    assert.equal(met(minted, "p6-verified"), true, "a machine run promoted a genuinely executed tested verdict");
  });

  it("the DoD verdict is deliberately blind to declaredScriptsVerified — the limit is carried by the artifact/envelope, not folded into a criterion", () => {
    // Same green, executed run; the ONLY difference is the declared-script state.
    const verified = mintTreeRunTested(
      base(),
      greenUnverifiedOutcome({ declaredScriptsVerified: true, unverifiedDeclaredScripts: undefined }),
    );
    const unverified = mintTreeRunTested(base(), greenUnverifiedOutcome());
    const p6Ids = (p: Project): string[] => runGate(p, 6).unmet.map((g) => g.id).filter((id) => id.startsWith("p6-"));
    assert.deepEqual(
      p6Ids(unverified),
      p6Ids(verified),
      "the declared-toolchain state must not change any P6 DoD outcome — requiring it would be unsatisfiable on a fresh tree and would block the P6 mint",
    );
    // The field is not even on the stamp the probe reads, so the probe cannot
    // silently conflate it: the limit rides the emitted README banner + the
    // tree-run envelope (`declaredScriptsVerified` / `unverifiedDeclaredScripts`).
    assert.equal(
      Object.prototype.hasOwnProperty.call(unverified.lastTest ?? {}, "declaredScriptsVerified"),
      false,
      "the tested stamp carries no declared-toolchain field for a probe to over-read",
    );
  });

  it("a HOLLOW 'tested' stamp (not green, or recording no detail) never satisfies p6-verified", () => {
    const withLastTest = (lt: { ok: boolean; detail: string; label?: string; evidenceHash?: string }): Project =>
      ({ ...base(), lastTest: lt }) as unknown as Project;
    assert.equal(
      met(withLastTest({ ok: false, detail: "x", label: "tested", evidenceHash: "h" }), "p6-verified"),
      false,
      "a verdict that is not ok is not a tested verdict",
    );
    assert.equal(
      met(withLastTest({ ok: true, detail: "", label: "tested", evidenceHash: "h" }), "p6-verified"),
      false,
      "a stamp recording no run detail is hollow — never verification",
    );
    assert.equal(
      met(withLastTest({ ok: true, detail: "tree-run green: 1 spec file(s) pass", label: "tested", evidenceHash: "h" }), "p6-verified"),
      true,
      "control: a green, detailed, hash-carrying verdict is met",
    );
  });
});
