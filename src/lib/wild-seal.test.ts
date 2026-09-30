// ---------------------------------------------------------------------------
// wild-seal.test.ts — the AGENT SEAL pins (313 D1/E1 spec; completed by 315 V1).
// Run: node --experimental-strip-types --test src/lib/wild-seal.test.ts
//
// Keyless + fully injected reviewer: no DEEPSEEK_API_KEY, no network, no TTY.
// Pins:
//   §S1  a sealed approval mints the coded classifier approver of record —
//        [seat agent-seal] + decidedVia (label autopilot/agent-seal), never a
//        human seat; the dod seam cross-check (p4-approved) passes on the
//        sealed row and FAILS CLOSED on a forged provenance; without the flag
//        the row keeps the pre-seal shape.
//   §S2  a forceHuman gate refuses in BOTH modes (seal included) — zero
//        reviewer calls, zero decision rows.
//   §S3  the bounded classifier-REJECT retry fires exactly N=2 (the default)
//        with one wild.review_retry row per attempt; reject→approve retries
//        are REAL re-asks; provider errors and DoD-floor rejects never retry.
//   §S4  the keyless sealed park carries the coded unlock class ("agent-seal");
//        without the flag the pause keeps the pre-seal park (opt-in consent).
//   §S5  full-run step arithmetic: a sealed keyless run completes in exactly
//        13 steps (1 per phase, P0..P12) — margin 7 vs the store driver's
//        20-step loop cap (store.ts:1241/:1283). C1's SE1 count (17 = gates×2)
//        is falsified by probe: a gated phase costs 1 step, not 2.
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyProject, wildStep, approveHitl, rejectHitl, unlockRetry, type WildReviewer } from "./engine.ts";
import { runGate } from "./dod.ts";
import type { HitlDecision, Project } from "./types.ts";

/** An ACTIVE wild-run project parked on one edge (gate open or phase complete). */
function wildFixture(
  opts: { phase?: 0 | 4; status?: "awaiting_hitl" | "complete"; forceHuman?: boolean } = {},
): Project {
  const phase = opts.phase ?? 0;
  const status = opts.status ?? "awaiting_hitl";
  const p = emptyProject({ name: "Sealed", brief: "A sealed brief for the autonomous loop." });
  p.wildMode = true;
  p.wildRun = {
    active: true,
    phase,
    startedAt: Date.now(),
    lastAutoLog: `Wild run started at P${phase}`,
    lastAutoAt: Date.now(),
    stoppedAt: null,
    pause: false,
  };
  p.currentPhase = phase;
  p.status = status === "awaiting_hitl" ? "awaiting_hitl" : "running";
  p.phases[phase] = { ...p.phases[phase], status };
  if (status === "awaiting_hitl") {
    p.hitl = {
      phase,
      title: `P${phase} gate`,
      prompt: "Approve?",
      stakes: "high",
      forceHuman: opts.forceHuman === true,
    };
  }
  return p;
}

const SEAL_FEEDBACK = "Sealed classifier consent for the gate — every criterion traced.";
const REJECT_FEEDBACK = "Sealed classifier rejects the gate — unmet criteria remain.";

const approving: WildReviewer = async () => ({
  ok: true,
  verdict: "approve",
  feedback: SEAL_FEEDBACK,
  model: "test",
});
const notConfigured: WildReviewer = async () => ({ ok: false, reason: "not-configured" });

/** Counted reviewer wrappers (one counter per pin). */
function counting(make: () => { ok: true; verdict: "approve" | "reject"; feedback: string; model: string }): {
  calls: () => number;
  reviewer: WildReviewer;
} {
  let n = 0;
  return {
    calls: () => n,
    reviewer: async () => {
      n += 1;
      return make();
    },
  };
}

const lastRow = (p: Project): HitlDecision | undefined => p.decisions[p.decisions.length - 1];

describe("§S1 sealed approval provenance (313 D1)", () => {
  it("mints [seat agent-seal] + decidedVia on the row — never a human seat", async () => {
    const res = await wildStep(wildFixture(), { reviewer: approving, agentSeal: true });
    assert.equal(res.outcome, "advanced");
    const row = lastRow(res.project);
    assert.ok(row, "a decision row was minted");
    assert.equal(row.decision, "approve");
    assert.equal(row.decidedBy, "autopilot", "the truthful machine actor");
    assert.ok(row.note?.includes("[seat agent-seal]"), "the coded seat tag is on the note");
    assert.ok(!/\[seat human/.test(row.note ?? ""), "a seal row can never claim a human seat");
    const via = row.decidedVia;
    assert.ok(via, "the declared decidedVia provenance lands on the row");
    assert.equal(via.action, "hitl.approve");
    assert.equal(via.resource, "gate:P0");
    assert.equal(via.label, "autopilot/agent-seal", "the policy seat-label vocabulary");
    assert.equal(via.tokenPath, false, "a machine seat never claims the human token path");
    assert.ok(via.reason.includes(" — "), "the reason carries the kebab-id — clause separator");
    const approved = res.project.logs.filter((l) => l.event === "wild.approved");
    assert.equal(approved.length, 1);
    assert.ok(approved[0].detail.includes("gate self-approved (classifier)"));
  });

  it("the sealed row passes the dod provenance cross-check — a forged via fails closed", async () => {
    const res = await wildStep(wildFixture({ phase: 4 }), { reviewer: approving, agentSeal: true });
    assert.equal(res.outcome, "advanced");
    const g = runGate(res.project, 4);
    assert.ok(
      !g.unmet.some((u) => u.id === "p4-approved"),
      "p4-approved passes on the tagged + provenance-consistent seal row",
    );
    const row = lastRow(res.project);
    assert.ok(row?.decidedVia, "row carries decidedVia (cross-check has teeth to bite)");
    const forged: Project = {
      ...res.project,
      decisions: res.project.decisions.map((d) =>
        d.id === row.id
          ? // Deliberately-forged row: the cast constructs the hostile input at the
            // type boundary — the assertions below prove dod.ts REFUSES it.
            ({ ...d, decidedVia: { ...row.decidedVia, label: "human/human-cli-i-am-human" } } as HitlDecision)
          : d,
      ),
    };
    const gForged = runGate(forged, 4);
    assert.ok(
      gForged.unmet.some((u) => u.id === "p4-approved"),
      "a forged provenance contradicts the tag — the criterion fails closed",
    );
    assert.notEqual(gForged.evidenceHash, g.evidenceHash, "content change flips the evidence hash");
  });

  it("WITHOUT the seal the row keeps the pre-seal shape (no tag, no decidedVia)", async () => {
    const res = await wildStep(wildFixture(), { reviewer: approving });
    assert.equal(res.outcome, "advanced");
    const row = lastRow(res.project);
    assert.ok(row, "a decision row was minted");
    assert.equal(row.decidedBy, "autopilot");
    assert.ok(!(row.note ?? "").includes("[seat agent-seal]"), "no seal tag without the flag");
    assert.ok(!("decidedVia" in row), "no provenance object without the flag");
  });
});

describe("§S2 forceHuman gates refuse under BOTH modes (R3/B-03)", () => {
  it("refuses WITHOUT the seal — the reviewer is never consulted", async () => {
    const c = counting(() => ({ ok: true, verdict: "approve", feedback: SEAL_FEEDBACK, model: "test" }));
    const res = await wildStep(wildFixture({ forceHuman: true }), { reviewer: c.reviewer });
    assert.equal(res.outcome, "paused");
    assert.equal(res.code, "RT_E_GATE_PENDING");
    assert.equal(c.calls(), 0, "a human-only gate is not sent to the classifier");
    assert.equal(res.project.decisions.length, 0, "no approval row can be minted");
    assert.ok(res.project.wildRun?.lastAutoLog?.includes("Wild Mode cannot self-approve it"));
  });

  it("refuses UNDER the seal too — same code, seal-specific reason", async () => {
    const c = counting(() => ({ ok: true, verdict: "approve", feedback: SEAL_FEEDBACK, model: "test" }));
    const res = await wildStep(wildFixture({ forceHuman: true }), { reviewer: c.reviewer, agentSeal: true });
    assert.equal(res.outcome, "paused", "the seal must not open a forceHuman gate");
    assert.equal(res.code, "RT_E_GATE_PENDING");
    assert.equal(c.calls(), 0);
    assert.equal(res.project.decisions.length, 0);
    assert.ok(res.project.wildRun?.lastAutoLog?.includes("the agent seal refuses it (R3/B-03)"));
  });
});

describe("§S3 bounded classifier-reject retry (313 D1)", () => {
  it("retries a classifier REJECT exactly N=2 (default) — one review_retry row per attempt", async () => {
    const c = counting(() => ({ ok: true, verdict: "reject", feedback: REJECT_FEEDBACK, model: "test" }));
    const res = await wildStep(wildFixture(), {
      reviewer: c.reviewer,
      agentSeal: true,
      retryBackoffMs: 5,
    });
    assert.equal(c.calls(), 3, "initial ask + exactly 2 retries (the default bound)");
    const rows = res.project.logs.filter((l) => l.event === "wild.review_retry");
    assert.equal(rows.length, 2, "one ledger row per retry attempt");
    assert.equal(rows[0].detail, "P0 review REJECTED (classifier) — retry 1/2 after 5ms backoff.");
    assert.equal(rows[1].detail, "P0 review REJECTED (classifier) — retry 2/2 after 10ms backoff.");
    assert.equal(res.outcome, "paused", "a persistent reject parks after the bound");
    assert.equal(res.code, "RT_E_GATE_PENDING");
    assert.equal(res.error, REJECT_FEEDBACK, "the LAST verdict's feedback is the recorded reason");
  });

  it("a reject→approve sequence is a REAL re-ask (advances on the 2nd sample)", async () => {
    let n = 0;
    const flaky: WildReviewer = async () => {
      n += 1;
      return n === 1
        ? { ok: true, verdict: "reject", feedback: "Sealed classifier rejects the gate — first sample.", model: "test" }
        : { ok: true, verdict: "approve", feedback: SEAL_FEEDBACK, model: "test" };
    };
    const res = await wildStep(wildFixture(), { reviewer: flaky, agentSeal: true, retryBackoffMs: 5 });
    assert.equal(n, 2);
    assert.equal(res.outcome, "advanced", "the retry's approval is the one that counts");
    assert.equal(res.project.logs.filter((l) => l.event === "wild.review_retry").length, 1);
  });

  it("non-retry classes: provider errors, floor rejects, and retries=0 are asked ONCE", async () => {
    // (i) provider error — a failure is not a verdict.
    let errCalls = 0;
    const errReviewer: WildReviewer = async () => {
      errCalls += 1;
      return { ok: false, reason: "error", error: "provider refused" };
    };
    const r1 = await wildStep(wildFixture(), { reviewer: errReviewer, agentSeal: true, retryBackoffMs: 5 });
    assert.equal(errCalls, 1, "no blind re-run of a provider error");
    assert.equal(r1.outcome, "paused");
    assert.equal(r1.code, "RT_E_LLM_REJECTED");

    // (ii) DoD-floor reject (keyless advance) — deterministic; re-asking is theatre.
    let floorCalls = 0;
    const floorReviewer: WildReviewer = async () => {
      floorCalls += 1;
      return { ok: false, reason: "not-configured" };
    };
    const r2 = await wildStep(wildFixture({ status: "complete" }), {
      reviewer: floorReviewer,
      agentSeal: true,
      retryBackoffMs: 5,
    });
    assert.equal(floorCalls, 1, "the deterministic floor verdict is never retried");
    assert.equal(r2.outcome, "paused");
    assert.equal(r2.project.logs.filter((l) => l.event === "wild.review_retry").length, 0);
    assert.ok(String(r2.error).includes("Deterministic DoD review"));

    // (iii) an explicit maxReviewRetries: 0 clamps to the plain resolver.
    const c = counting(() => ({ ok: true, verdict: "reject", feedback: REJECT_FEEDBACK, model: "test" }));
    const r3 = await wildStep(wildFixture(), {
      reviewer: c.reviewer,
      agentSeal: true,
      maxReviewRetries: 0,
      retryBackoffMs: 5,
    });
    assert.equal(c.calls(), 1);
    assert.equal(r3.outcome, "paused");
  });
});

describe("§S4 the keyless seal park class + opt-in consent", () => {
  it("the sealed unconfigured-gate park carries the coded agent-seal unlock", async () => {
    const res = await wildStep(wildFixture(), { reviewer: notConfigured, agentSeal: true });
    assert.equal(res.outcome, "paused");
    assert.equal(res.code, "RT_E_LLM_NOT_CONFIGURED");
    const park = res.project.wildRun?.park;
    assert.ok(park, "a coded park record is stamped");
    assert.equal(park.unlock, "agent-seal");
    assert.equal(park.code, "RT_E_LLM_NOT_CONFIGURED");
    assert.equal(park.event, "wild.paused_classifier");
    assert.ok(park.unlockText.includes("The agent seal could not consent"));
  });

  it("without the flag the same pause keeps the pre-seal park (never agent-seal)", async () => {
    const res = await wildStep(wildFixture(), { reviewer: notConfigured });
    assert.equal(res.outcome, "paused");
    assert.equal(res.code, "RT_E_LLM_NOT_CONFIGURED");
    const park = res.project.wildRun?.park;
    assert.ok(park);
    assert.equal(park.unlock, "human-retry", "the pre-seal unlock class");
    assert.notEqual(park.unlock, "agent-seal");
  });
});

describe("§S5 full-run step arithmetic (313 C1/D1 — 13 steps, 1/phase, margin 7 vs the store cap 20)", () => {
  it("a sealed keyless full run completes in exactly 13 steps — the driver's 20-step cap holds untouched", async () => {
    // The brief must match the lattice's job/entity vocabulary: a vague brief
    // falls back and P0 becomes a forceHuman gate (R3/B-03) — the run parks at
    // step 1 by design. This is the same brief C1's probe used (13/13).
    const p0 = emptyProject({
      name: "Arithmetic",
      brief:
        "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.",
    });
    let p = p0;
    p.wildMode = true;
    p.wildRun = {
      active: true,
      phase: 0,
      startedAt: Date.now(),
      lastAutoLog: "pin",
      lastAutoAt: Date.now(),
      stoppedAt: null,
      pause: false,
    };
    let steps = 0;
    for (; steps < 20; ) {
      const res = await wildStep(p, { reviewer: approving, agentSeal: true });
      p = res.project;
      steps += 1;
      if (res.outcome !== "advanced") break;
    }
    assert.equal(steps, 13, "P0..P12 at one step per phase (SE1's 17-count is falsified — a gated phase advances in-step)");
    assert.equal(p.status, "complete", "the P12 step finalizes in-step");
    assert.ok(p.logs.some((l) => l.event === "wild.complete"), "wild.complete rides the final step");
    assert.equal(p.decisions.length, 4, "the four stock HITL gates minted rows (P4/P5/P8/P9)");
    const sealedRows = p.decisions.filter((d) => (d.note ?? "").includes("[seat agent-seal]"));
    assert.equal(sealedRows.length, 4, "every sealed approval row carries the coded seat tag");
    // The store driver's loop bound (store.ts:1241 `for (let step = 0; step < 20; ...)`;
    // :1283 the coded `wild.cap` park). 13 < 20 ⇒ no cap raise needed (313 §S6).
    const STORE_WILD_LOOP_CAP = 20;
    assert.ok(steps <= STORE_WILD_LOOP_CAP, "within the driver cap");
    assert.equal(STORE_WILD_LOOP_CAP - steps, 7, "exact margin 7");
  });
});

// ---------------------------------------------------------------------------
// §S6 GAP-1 — a CLASSIFIER review REJECT mints the human decision gate the
// park's unlockText already promised (fixes/320_g1b_review_park.md · 319
// FINDING-2). Before the mint the park advertised unlock:"human-gate" while
// `hitl` stayed null: CLI approve/reject refused ("No pending gate…") and a
// resume re-reviewed → re-rejected. The mint is the fix; these pins freeze it.
// ---------------------------------------------------------------------------
describe("§S6 GAP-1 review-reject mint (fixes/320)", () => {
  const REJECT_CRITIQUE =
    "P0 artifacts are generic floor boilerplate: no real domain research, the scorecard contradicts the brief, and the security section is a template. Rework with concrete evidence before this phase may advance.";

  it("sealed reject mints a forceHuman gate on both layers; autopilot is refused; a human approve completes the phase", async () => {
    const c = counting(() => ({ ok: true, verdict: "reject" as const, feedback: REJECT_CRITIQUE, model: "test" }));
    const res = await wildStep(wildFixture(), { reviewer: c.reviewer, agentSeal: true, retryBackoffMs: 5 });
    assert.equal(res.outcome, "paused", "the run still parks — mint ≠ auto-advance");
    assert.equal(res.code, "RT_E_GATE_PENDING");
    assert.equal(c.calls(), 3, "initial ask + exactly 2 retries, then the park");

    // (1) the human door now exists on BOTH layers — the exact pair the CLI
    // quick-fail gates test (rapidtool-cli.mjs:930/:1077).
    assert.equal(res.project.status, "awaiting_hitl", "project status admits CLI approve/reject");
    const gate = res.project.hitl;
    assert.ok(gate, "was hitl:null — the dead end this helper fixes");
    assert.equal(gate.phase, 0);
    assert.equal(gate.forceHuman, true, "machine-only lock (R3/B-03)");
    assert.equal(gate.title, "Review rejected — accept the risk or reject with a note");
    assert.equal(gate.prompt, REJECT_CRITIQUE, "the FULL critique is the prompt — no slice");
    assert.equal(typeof gate.requestedAt, "number");
    assert.equal(res.project.phases[0].status, "awaiting_hitl", "the phase record enters the gate edge");

    // (2) the park is coherent now: unlockText is TRUE and a resume re-enters the gate.
    const park = res.project.wildRun?.park;
    assert.ok(park);
    assert.equal(park.unlock, "human-gate");
    assert.equal(park.resumeAction, "gate", "a resume re-enters the gate — no silent advance");
    assert.ok(park.unlockText.includes("A human must approve or reject the open gate"));

    // (3) machine seats can never clear it (R3/B-03 throw).
    assert.throws(
      () => approveHitl(res.project, { decidedBy: "autopilot" }),
      /forceHuman/,
      "autopilot may not approve the minted gate",
    );

    // (4) a sealed machine resume refuses the minted gate BEFORE any classifier
    // call (no re-review spend) and leaves the human door open.
    const resumed = { ...res.project, wildRun: { ...res.project.wildRun!, pause: false } };
    const again = await wildStep(resumed, { reviewer: c.reviewer, agentSeal: true, retryBackoffMs: 5 });
    assert.equal(again.outcome, "paused");
    assert.equal(again.code, "RT_E_GATE_PENDING");
    assert.equal(c.calls(), 3, "the refused machine resume never re-asks the classifier");
    assert.equal(again.project.status, "awaiting_hitl");
    assert.equal(again.project.hitl?.prompt, REJECT_CRITIQUE, "the same minted gate survives the refusal");

    // (5) the human approve completes the phase and moves the cursor.
    const note = "Accepting the known floor risk for this pin — the critique stays on the ledger.";
    const done = approveHitl(res.project, { decidedBy: "human", note });
    assert.equal(done.hitl, null, "the gate closes on the human decision");
    assert.equal(done.currentPhase, 1, "the cursor advances");
    assert.equal(done.phases.find((r) => r.id === 0)?.status, "complete");
    const row = done.decisions[done.decisions.length - 1];
    assert.equal(row.decision, "approve");
    assert.equal(row.decidedBy, "human");
    assert.equal(row.note, note);
    assert.equal(row.title, "Review rejected — accept the risk or reject with a note", "the ledger names the minted gate");
  });

  it("human reject-with-note records rejectionHistory; retry reopens the edge and the re-run carries the note", async () => {
    const res = await wildStep(wildFixture(), {
      reviewer: async () => ({ ok: true, verdict: "reject", feedback: REJECT_CRITIQUE, model: "test" }),
    });
    assert.equal(res.outcome, "paused", "the non-seal classifier reject also parks");
    assert.ok(res.project.hitl?.forceHuman, "the mint is not seal-conditional");

    const NOTE = "The scorecard must name the real domain and drop the boilerplate security template before P0 can stand.";
    assert.throws(() => rejectHitl(res.project, "too short"), /12 characters/);
    const rejected = rejectHitl(res.project, NOTE);
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.hitl, null, "the rejected gate closes");
    const rec = rejected.phases.find((r) => r.id === 0)!;
    assert.equal(rec.status, "rejected");
    assert.equal(rec.rejectionNote, NOTE);
    assert.deepEqual(rec.rejectionHistory?.map((h) => h.note), [NOTE], "append-only history carries the note");

    const retried = unlockRetry(rejected);
    assert.equal(retried.status, "running");
    assert.equal(retried.phases.find((r) => r.id === 0)?.status, "ready", "the retry edge reopens");

    // The note reaches the RE-RUN: applyPhaseResult(attempt=1) stamps the
    // rejection-response block onto the regenerated artifact.
    const rerun = await wildStep(
      { ...retried, wildRun: { ...retried.wildRun!, pause: false } },
      { reviewer: approving, agentSeal: true, retryBackoffMs: 5 },
    );
    assert.ok(
      rerun.project.artifacts.some((a) => a.phase === 0 && (a.body ?? "").includes(NOTE)),
      "the recorded note rides the regeneration (rejectionResponseBlock) — the repair loop closes",
    );
  });
});
