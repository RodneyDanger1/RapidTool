// ---------------------------------------------------------------------------
// judgment.ts — the phase verdict ladder (112 §2.2, landed as task T3 by 216g).
//
// PURE MODULE: no LLM, no network, no node:fs, no clock. `judgePhase()` reads
// the project's RECORDED state (DoD probes, phase records, decision ledger,
// log rows, lastTest) and returns exactly one verdict from the §2.2 ladder,
// stamped with the §2.3 evidence triple. It never mutates the project and
// never mints an approval: a human-only gate that is open stays `blocked:hitl`
// until the ledger itself carries a decision (112 §2.1; P0-01/P0-02).
//
// The ladder is evaluated top-down — a later rung never overrides an earlier
// one, and each rung may decline so the next can fire:
//
//   1. blocked:hitl                a human-only gate is open
//   2. fail:deterministic          a Tier-D probe is unmet (runGate)
//   3. pass:machine-evidenced      all probes met + a recorded machine proof
//   4. pass:deterministic-only     all probes met, nothing machine-verified
//   5. advise:risk                 all probes met + Tier-M risk evidence
//   6. refuse:no-proof             the claim cannot be tied to any row
//
// §2.2 lists rung 4 before rung 5; rung 4 therefore declines when Tier-M risk
// evidence exists (otherwise rung 5 could never fire and a "passed but risky"
// phase would print as a clean pass). Every verdict is an honest LABEL, never
// an approval, and never a gate input.
// ---------------------------------------------------------------------------
import { DOD, runGate } from "./dod.ts";
import { fnv1a } from "./algorithms.ts";
import type { JsonLog, PhaseId, Project } from "./types.ts";

/** 112 §2.2: the six verdicts. No other string is ever returned. */
export type JudgmentVerdict =
  | "blocked:hitl"
  | "fail:deterministic"
  | "pass:machine-evidenced"
  | "pass:deterministic-only"
  | "advise:risk"
  | "refuse:no-proof";

/**
 * 112 §2.3: the evidence triple every verdict carries.
 * `refuse:no-proof` is exactly the verdict whose `anchor` is empty — a claim
 * with fewer than three parts cannot be tied to anything.
 */
export type JudgmentEvidence = {
  /** The probe/ledger read that regenerates the verdict. */
  reproduce: string;
  /** Content hash over the artifact AS JUDGED (FNV-1a, the repo convention). */
  hash: string;
  /** The ledger row that owns it: phase record id | log row | decision id. */
  anchor: string;
};

export type PhaseJudgment = {
  phase: PhaseId;
  verdict: JudgmentVerdict;
  /** One-line honest why, naming the probe ids / ledger rows / risk events. */
  detail: string;
  evidence: JudgmentEvidence;
  /** Unmet DoD criterion ids (rung 2 only; empty otherwise). */
  unmet: string[];
  /** Tier-M risk events (rung 5 only; empty otherwise). */
  risks: string[];
};

/** The phase record for `phase`, or null. Defensive: hand-built payloads may
 *  omit `phases` entirely. */
function phaseRecord(project: Project, phase: number): Project["phases"][number] | null {
  return (Array.isArray(project?.phases) ? project.phases : []).find((r) => r && r.id === phase) ?? null;
}

/**
 * Decision-ledger read mirroring dod.ts's private `approvalActor` rule (that
 * helper is not exported there, so the rule is restated here rather than
 * edited into a file this lane does not own): who actually decided this phase,
 * read from the ledger — never inferred from a phase-record status (P0-02).
 */
function approvalRow(project: Project, phase: number) {
  return (
    (Array.isArray(project?.decisions) ? project.decisions : []).find(
      (d) => d && d.phase === phase && d.decision === "approve",
    ) ?? null
  );
}

/**
 * The machine-proof marker: a `lastTest` promoted by a real verify loop —
 * label "tested" WITH a non-empty evidenceHash, the p6-verified pattern
 * (dod.ts:401-419). A "self-test"/"real-run" label never satisfies it.
 */
function machineProofOf(project: Project): { hash: string } | null {
  const lt = project?.lastTest as { label?: string; evidenceHash?: string } | null | undefined;
  if (!lt || lt.label !== "tested") return null;
  return typeof lt.evidenceHash === "string" && lt.evidenceHash.length > 0
    ? { hash: lt.evidenceHash }
    : null;
}

/**
 * The probe ids that make machine verification a REGISTERED Tier-D criterion
 * for this phase (today only P6's `p6-verified`). Read from the DOD registry —
 * never hardcoded to phase 6 — so a later wave that registers a machine-proof
 * probe for another phase lights rung 3 up automatically.
 */
function machineProofProbeIds(phase: number): string[] {
  const items = DOD[phase as PhaseId] ?? [];
  return items
    .filter((i) => typeof i?.id === "string" && i.id.endsWith("-verified"))
    .map((i) => i.id);
}

/**
 * Tier-M risk evidence: the phase's own warn/error ledger rows. The advisory
 * channel only — rung 5 may annotate, it may never gate (112 §2.1 tier M).
 */
function riskRows(project: Project, phase: number): JsonLog[] {
  return (Array.isArray(project?.logs) ? project.logs : []).filter(
    (l) => l && l.phase === phase && (l.level === "warn" || l.level === "error"),
  );
}

/**
 * The ledger row that owns a pass claim (§2.3 anchor): the phase record first,
 * then a log row for the phase, then a decision row. Returns null when the
 * project recorded nothing for the phase — which is exactly when the verdict
 * falls to `refuse:no-proof`.
 */
function ledgerAnchor(project: Project, phase: number): { anchor: string; reproduce: string } | null {
  const rec = phaseRecord(project, phase);
  if (rec) {
    return { anchor: `phase:P${phase}`, reproduce: `project.phases (P${phase} record, status ${rec.status})` };
  }
  const log = (Array.isArray(project?.logs) ? project.logs : []).find((l) => l && l.phase === phase);
  if (log) {
    return { anchor: `log:${log.event}@${log.ts}`, reproduce: `project.logs (${log.event})` };
  }
  const dec = (Array.isArray(project?.decisions) ? project.decisions : []).find((d) => d && d.phase === phase);
  if (dec) {
    return { anchor: `decision:${dec.id}`, reproduce: `project.decisions (${dec.id})` };
  }
  return null;
}

/**
 * 112 §2.2 (T3): judge ONE phase and return the ladder verdict + evidence
 * triple. Pure: same project + phase → same judgment, no mutation, no LLM, no
 * I/O. Never mints an approval and never treats a completed phase record as
 * one — rung 1 reads the ledger's actor.
 */
export function judgePhase(project: Project, phase: PhaseId): PhaseJudgment {
  const rec = phaseRecord(project, phase);
  const gate = runGate(project, phase);
  const unmetIds = gate.unmet.map((u) => u.id);

  // 1. blocked:hitl — a human-only gate is open: the phase record says
  //    awaiting_hitl, or the project is parked on this phase. The recorded
  //    actor is reported, never invented.
  const hitlOpen =
    rec?.status === "awaiting_hitl" ||
    (project?.status === "awaiting_hitl" && project?.currentPhase === phase);
  if (hitlOpen) {
    const decision = approvalRow(project, phase);
    const actor = decision ? decision.decidedBy : "none";
    return {
      phase,
      verdict: "blocked:hitl",
      detail: `P${phase} is parked at a human-only gate (awaiting_hitl); approval ledger actor: ${actor}.`,
      evidence: {
        reproduce: `project.phases (status) + project.decisions (approval rule)`,
        hash: String(fnv1a(`${phase}:${decision?.id ?? "no-decision"}:${actor}`)),
        anchor: decision ? `decision:${decision.id}` : `phase:P${phase}`,
      },
      unmet: [],
      risks: [],
    };
  }

  // 2. fail:deterministic — a Tier-D probe is unmet. The unmet criterion ids
  //    ARE the refutation (§4.3): they anchor the verdict.
  if (!gate.pass) {
    if (unmetIds.length === 0) {
      return {
        phase,
        verdict: "refuse:no-proof",
        detail: `P${phase} gate is unmet but carries no criterion id — nothing to bind the verdict to.`,
        evidence: { reproduce: `runGate(project, ${phase})`, hash: gate.evidenceHash, anchor: "" },
        unmet: [],
        risks: riskRows(project, phase).map((l) => l.event),
      };
    }
    return {
      phase,
      verdict: "fail:deterministic",
      detail: `P${phase} gate unmet (${unmetIds.length} probe(s)): ${unmetIds.join(", ")}.`,
      evidence: {
        reproduce: `runGate(project, ${phase})`,
        hash: gate.evidenceHash,
        anchor: ledgerAnchor(project, phase)?.anchor ?? `criterion:${unmetIds[0]}`,
      },
      unmet: unmetIds,
      risks: [],
    };
  }

  // Rungs 3–6 all require a recorded row to tie the pass claim to (§2.3).
  const anchor = ledgerAnchor(project, phase);
  const risks = riskRows(project, phase).map((l) => l.event);
  const proofProbes = machineProofProbeIds(phase);
  const proof = machineProofOf(project);

  // 3. pass:machine-evidenced — every probe met AND a registered machine-proof
  //    criterion carries its marker. (A probe passing VACUOUSLY can never
  //    satisfy this rung: the marker is an external artifact, lastTest.)
  if (anchor && proofProbes.length > 0 && proof) {
    return {
      phase,
      verdict: "pass:machine-evidenced",
      detail: `P${phase} gate met; machine verification recorded (${proofProbes.join(", ")}, evidenceHash ${proof.hash.slice(0, 8)}).`,
      evidence: {
        reproduce: `runGate(project, ${phase}) + ${proofProbes.join(", ")} (lastTest.label === "tested")`,
        hash: proof.hash,
        anchor: anchor.anchor,
      },
      unmet: [],
      risks: [],
    };
  }

  // 5. advise:risk — probes met, Tier-M evidence names a risk. Checked before
  //    rung 4 so a risky pass cannot print as a clean deterministic pass.
  if (anchor && risks.length > 0) {
    return {
      phase,
      verdict: "advise:risk",
      detail: `P${phase} gate met; ${risks.length} Tier-M risk row(s): ${risks.slice(0, 4).join(", ")}.`,
      evidence: {
        reproduce: `project.logs (warn/error rows for P${phase})`,
        hash: String(fnv1a(risks.join("|"))),
        anchor: anchor.anchor,
      },
      unmet: [],
      risks,
    };
  }

  // 4. pass:deterministic-only — every probe met, nothing machine-verified:
  //    the honest label the keyless floor occupies by design.
  if (anchor) {
    return {
      phase,
      verdict: "pass:deterministic-only",
      detail: `P${phase} gate met; no machine verification recorded (deterministic floor).`,
      evidence: {
        reproduce: `runGate(project, ${phase})`,
        hash: gate.evidenceHash,
        anchor: anchor.anchor,
      },
      unmet: [],
      risks: [],
    };
  }

  // 6. refuse:no-proof — the honest floor: the claim cannot be tied to any
  //    artifact/row. Recorded here (with an empty anchor), never dropped.
  return {
    phase,
    verdict: "refuse:no-proof",
    detail: `P${phase} gate met but no phase record, ledger row, or decision row anchors the claim.`,
    evidence: {
      reproduce: `judgePhase(project, ${phase})`,
      hash: gate.evidenceHash,
      anchor: "",
    },
    unmet: [],
    risks,
  };
}
