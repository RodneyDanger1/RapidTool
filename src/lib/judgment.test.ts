// ---------------------------------------------------------------------------
// judgment.test.ts — the phase verdict ladder (216g, 112 §2.2 task T3).
//
// A table test drives EVERY rung of the ladder with real DoD probes (runGate
// over the DOD registry) and real fixture projects — no mocks, no LLM, no
// network. Also pins the module's purity: judging never mutates the project,
// and the module imports no LLM/network/fs seam.
//
// Run: node --experimental-strip-types --test src/lib/judgment.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { judgePhase } from "./judgment.ts";
import { runGate } from "./dod.ts";
import { applyPhaseResult, emptyProject } from "./engine.ts";
import { approve } from "./headless.ts";
import { buildPhase6Module } from "./sandbox.ts";
import { runToGate, seedProject } from "./testing/fixtures.ts";
import type { PhaseId, Project } from "./types.ts";

/** A phase-3 project whose only probe (p3-mcp) is met by the artifact. */
function withP3(overrides: Partial<Project> = {}): Project {
  return {
    ...seedProject(),
    artifacts: [{ id: "art-p3-mcp", phase: 3 as PhaseId, kind: "mcp", title: "MCP contract", body: "probe" }],
    phases: [{ id: 3 as PhaseId, status: "complete" }],
    ...overrides,
  };
}

/** A passing P6 project: vocabulary-free brief keeps p6-brief-fit vacuous-OK,
 *  and the "tested" + hash verdict is the p6-verified machine proof. */
function withP6Proof(lastTest: unknown): Project {
  return {
    ...emptyProject({ name: "judge-machine", brief: "a" }),
    generatedSource: "export const add = (a, b) => a + b;",
    artifacts: [{ id: "art-p6-code", phase: 6 as PhaseId, kind: "code", title: "code", body: "x" }],
    phases: [{ id: 6 as PhaseId, status: "complete" }],
    lastTest: lastTest as Project["lastTest"],
  };
}

describe("216g / 112 T3 — judgePhase verdict ladder (pure, no LLM)", () => {
  it("rung 1 — blocked:hitl when a human-only gate is open (ledger actor reported, never minted)", () => {
    const parked: Project = {
      ...seedProject(),
      status: "awaiting_hitl",
      currentPhase: 4 as PhaseId,
      phases: [{ id: 4 as PhaseId, status: "awaiting_hitl" }],
    };
    const j = judgePhase(parked, 4);
    assert.equal(j.verdict, "blocked:hitl");
    assert.ok(j.detail.includes("awaiting_hitl"));
    assert.ok(j.detail.includes("none"), "no ledger decision exists yet — reported as none, not invented");
    assert.equal(j.evidence.anchor, "phase:P4");
    assert.ok(j.evidence.reproduce.length > 0 && j.evidence.hash.length > 0);
    assert.deepEqual(j.unmet, []);
    assert.deepEqual(j.risks, []);

    // A COMPLETED phase record is never an approval (P0-02): the p4-approved
    // criterion still reads the decision ledger, so the verdict is a FAIL.
    const completed = { ...parked, status: "running" as const, phases: [{ id: 4 as PhaseId, status: "complete" as const }] };
    const jc = judgePhase(completed, 4);
    assert.equal(jc.verdict, "fail:deterministic");
    assert.ok(jc.unmet.includes("p4-approved"), "record completeness ≠ HITL approval");

    // An autopilot stamp is reported as autopilot — never as a human.
    const autopilot: Project = {
      ...parked,
      decisions: [
        {
          id: "d9",
          phase: 4 as PhaseId,
          title: "Approve security",
          decision: "approve",
          decidedBy: "autopilot",
          requestedAt: 1,
          decidedAt: 2,
        },
      ],
    };
    const ja = judgePhase(autopilot, 4);
    assert.equal(ja.verdict, "blocked:hitl");
    assert.ok(ja.detail.includes("autopilot"));
    assert.equal(ja.evidence.anchor, "decision:d9");
  });

  // A3-E14 (2026-10-06): the approval rule must be the ONE rule dod.ts's probe
  // uses — the NEWEST approve row, re-validated against the policy seam. The
  // old `.find` named the OLDEST row and validated nothing, so a stale
  // policy-rejected actor could be reported as the gate's decider.
  it("A3-E14 — the ledger actor is the NEWEST policy-valid approve row, not the oldest", () => {
    const parked: Project = {
      ...seedProject(),
      status: "awaiting_hitl",
      currentPhase: 4 as PhaseId,
      phases: [{ id: 4 as PhaseId, status: "awaiting_hitl" }],
      decisions: [
        {
          id: "stale",
          phase: 4 as PhaseId,
          title: "Approve security",
          decision: "approve",
          decidedBy: "human",
          note: "[seat human-cli-i-am-human] no token recorded",
          requestedAt: 1,
          decidedAt: 1,
        },
        {
          id: "fresh",
          phase: 4 as PhaseId,
          title: "Approve security",
          decision: "approve",
          decidedBy: "autopilot",
          note: "[seat harness] machine",
          requestedAt: 2,
          decidedAt: 2,
        },
      ],
    };
    const j = judgePhase(parked, 4);
    assert.equal(j.verdict, "blocked:hitl");
    assert.match(j.detail, /actor: autopilot/, "names the newest policy-valid actor");
    assert.equal(j.evidence.anchor, "decision:fresh", "anchors the row the gate probe accepts");

    // A single FORGED human approve row (no out-of-band token evidence) is
    // policy-denied: the gate probe rejects it, so the verdict must report NO
    // actor — never the rejected `human`.
    const forged: Project = {
      ...parked,
      decisions: [
        {
          id: "forged",
          phase: 4 as PhaseId,
          title: "Approve security",
          decision: "approve",
          decidedBy: "human",
          note: "[seat human-cli-i-am-human] told you so",
          requestedAt: 1,
          decidedAt: 1,
        },
      ],
    };
    const jf = judgePhase(forged, 4);
    assert.equal(jf.verdict, "blocked:hitl");
    assert.match(jf.detail, /actor: none/, "a policy-rejected row yields no actor");
    assert.equal(jf.evidence.anchor, "phase:P4");
  });

  it("rung 2 — fail:deterministic, with the unmet criterion ids as the refutation", () => {
    const parkedAtP6 = runToGate(seedProject(), 6);
    const gate = runGate(parkedAtP6, 6);
    assert.equal(gate.pass, false, "premise: the P6 fixture fails its gate");
    const j = judgePhase(parkedAtP6, 6);
    assert.equal(j.verdict, "fail:deterministic");
    assert.deepEqual(j.unmet, gate.unmet.map((u) => u.id));
    assert.ok(j.unmet.includes("p6-verified"));
    assert.equal(j.evidence.hash, gate.evidenceHash, "the gate's own evidence hash binds the verdict");
    assert.equal(j.evidence.anchor, "phase:P6");
    assert.deepEqual(j.risks, []);
  });

  it("rung 3 — pass:machine-evidenced only with a recorded tested verdict", () => {
    const machine = withP6Proof({ ok: true, detail: "3/3 machine-run cases passed", label: "tested", evidenceHash: "abcdef0123" });
    assert.equal(runGate(machine, 6).pass, true, "premise: the machine-proof fixture passes its gate");
    const j = judgePhase(machine, 6);
    assert.equal(j.verdict, "pass:machine-evidenced");
    assert.equal(j.evidence.hash, "abcdef0123", "the tested verdict's hash is the binding");
    assert.ok(j.detail.includes("p6-verified"));
    assert.deepEqual(j.unmet, []);

    // A self-test label is NOT machine proof: the p6-verified probe stays
    // unmet, so P6's own gate refuses — the deterministic floor can never
    // masquerade as machine evidence.
    const selfTest = withP6Proof({ ok: true, detail: "engine self-test ok", label: "self-test" });
    const js = judgePhase(selfTest, 6);
    assert.equal(js.verdict, "fail:deterministic");
    assert.ok(js.unmet.includes("p6-verified"));
    // A "tested" label WITHOUT the hash cannot claim machine proof either — the
    // p6-verified pattern requires BOTH label and non-empty hash (dod.ts:401-419).
    const hashless = withP6Proof({ ok: true, detail: "tested, trust me", label: "tested" });
    const jh = judgePhase(hashless, 6);
    assert.equal(jh.verdict, "fail:deterministic");
    assert.ok(jh.unmet.includes("p6-verified"));
  });

  it("rung 4 — pass:deterministic-only on a clean deterministic floor", () => {
    const p = withP3();
    assert.equal(runGate(p, 3).pass, true, "premise: the P3 fixture passes its gate");
    const j = judgePhase(p, 3);
    assert.equal(j.verdict, "pass:deterministic-only");
    assert.equal(j.evidence.anchor, "phase:P3");
    assert.ok(j.detail.includes("no machine verification"));
    assert.deepEqual(j.unmet, []);
    assert.deepEqual(j.risks, []);
  });

  it("rung 5 — advise:risk annotates a passing phase and never changes the probes", () => {
    const risky: Project = {
      ...withP3(),
      logs: [{ ts: 1, phase: 3 as PhaseId, level: "warn", event: "p6.synthesis.refused", detail: "chunk 2/4 refused" }],
    };
    assert.equal(runGate(risky, 3).pass, true, "premise: the risk row does not unset any probe");
    const j = judgePhase(risky, 3);
    assert.equal(j.verdict, "advise:risk");
    assert.deepEqual(j.risks, ["p6.synthesis.refused"]);
    assert.ok(j.detail.includes("p6.synthesis.refused"));
    assert.ok(j.detail.includes("Tier-M"));

    // An info row is not risk evidence.
    const info: Project = {
      ...withP3(),
      logs: [{ ts: 1, phase: 3 as PhaseId, level: "info", event: "gate.verdict", detail: "PASS" }],
    };
    assert.equal(judgePhase(info, 3).verdict, "pass:deterministic-only");
  });

  it("rung 6 — refuse:no-proof is the recorded floor when nothing anchors the claim", () => {
    const orphan: Project = { ...seedProject(), artifacts: withP3().artifacts, phases: [], logs: [], decisions: [] };
    assert.equal(runGate(orphan, 3).pass, true, "premise: probes pass on the artifact alone");
    const j = judgePhase(orphan, 3);
    assert.equal(j.verdict, "refuse:no-proof");
    assert.equal(j.evidence.anchor, "", "an empty anchor IS the refusal");
    assert.ok(j.detail.includes("no phase record"));
    assert.deepEqual(j.unmet, []);
  });

  it("purity — judgePhase never mutates the project, and the module has no LLM/IO seam", () => {
    const p = withP3({
      logs: [{ ts: 5, phase: 3 as PhaseId, level: "warn", event: "lint.note", detail: "advisory" }],
    });
    const before = JSON.stringify(p);
    judgePhase(p, 3);
    judgePhase(p, 4);
    judgePhase(p, 6);
    assert.equal(JSON.stringify(p), before, "same inputs → same project, byte-identical");

    // Static check of the §2.2 rule: NO LLM in the module.
    const src = readFileSync(fileURLToPath(new URL("./judgment.ts", import.meta.url)), "utf8");
    const specifiers = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
    assert.ok(specifiers.length > 0, "sanity: the scan finds the module's imports");
    for (const s of specifiers) {
      assert.ok(
        !/deepseek|llm|openai|anthropic|chat|node:fs|node:net|node:http/i.test(s),
        `judgment.ts must not import ${s}`,
      );
    }
    assert.ok(!/\bfetch\s*\(/.test(src), "no network call anywhere in the module");
  });
});

// ---------------------------------------------------------------------------
// 339-3 (W53) — the verdict ladder reads the honest DoD state vocabulary, and
// the park classification is proven on the ledger: a stock park is clearable by
// the MACHINE seat (autopilot row), a forceHuman park is not.
// ---------------------------------------------------------------------------
describe("339-3 (W53) — verdict detail vocabulary + park classification", () => {
  it("rung 2 names the deterministic floor state, not just the probe id", () => {
    const floor: Project = {
      ...emptyProject({
        name: "JudgeFloor",
        brief: "A dispatch board for field service: dispatch techs, board jobs, service parts.",
      }),
      generatedSource: buildPhase6Module({ name: "JudgeFloor", jobs: ["dispatch"], rejectionNote: null, variant: 0 }),
      lastTest: { ok: true, detail: "tests.pass" },
      phases: [{ id: 6 as PhaseId, status: "complete" }],
    };
    const j = judgePhase(floor, 6);
    assert.equal(j.verdict, "fail:deterministic");
    assert.ok(j.unmet.includes("p6-brief-fit"), "the unmet id is still the machine anchor");
    assert.match(j.detail, /deterministic floor state/, "the verdict detail names the state");
  });

  it("a stock park is cleared by the machine seat; a forceHuman park is not", () => {
    // Stock P4 park: approve()'s default actor is the autopilot/harness seat —
    // the machine door the policy seam permits for hitl.approve. runToGate
    // stops at the phase MOUTH, so actually execute P4 to open its stock gate.
    const parked = applyPhaseResult(runToGate(seedProject(), 4), 4 as PhaseId);
    assert.equal(parked.status, "awaiting_hitl", "premise: P4 parks at a stock HITL gate");
    const cleared = approve(parked);
    assert.ok(
      !runGate(cleared, 4).unmet.some((g) => g.id === "p4-approved"),
      "the machine door satisfies p4-approved (machine-resolvable park)",
    );
    const row = (cleared.decisions ?? []).find((d) => d.phase === 4 && d.decision === "approve");
    assert.ok(row, "the approval lands on the append-only ledger");
    assert.equal(row!.decidedBy, "autopilot");
    assert.match(row!.note ?? "", /\[seat harness\]/, "the row names the machine seat, never a human");

    // forceHuman park (a reframe gate): no autopilot path may clear it.
    const forced: Project = {
      ...seedProject(),
      currentPhase: 0 as PhaseId,
      status: "awaiting_hitl",
      hitl: { phase: 0 as PhaseId, title: "Reframe", prompt: "x", stakes: "y", forceHuman: true },
    };
    assert.throws(() => approve(forced), /forceHuman/, "a machine seat may never approve a forceHuman gate");
  });
});
