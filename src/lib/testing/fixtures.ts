// ---------------------------------------------------------------------------
// Shared test fixtures over the real engine (deterministic, no sleeps) —
// src/lib/testing/fixtures.ts
//
// seedProject  -> a fresh, algorithm-primed project (emptyProject + overrides)
// runHeadless  -> apply applyPhaseResult for each listed phase, auto-clearing
//                 every HITL park via approveHitl({ decidedBy: "human" })
//                 (autopilot may never self-approve — B-03/R3 — so fixtures
//                 sign human); the store's autopilot path is the caller's job.
// runToGate    -> execute phases strictly BELOW targetPhase (sealing each,
//                 approving gates only to keep moving) and park at the mouth
//                 of targetPhase: currentPhase === targetPhase, phases[0..t-1]
//                 complete, readyFor(target) true. If the project arrives
//                 already awaiting_hitl AT the target phase, it stays parked
//                 awaiting (that human gate is the target).
//
// Run: node --experimental-strip-types --test src/lib/gates.test.ts
// ---------------------------------------------------------------------------
import { applyPhaseResult, approveHitl, emptyProject } from "../engine.ts";
import type { PhaseId, Project } from "../types.ts";

/** Field-service dispatch board — rich enough that P0 proceeds without reframe. */
export const FIXTURE_BRIEF =
  "Build a field-service dispatch board for HVAC: jobs, techs, parts, same-day reroutes. Offline warehouse scan.";

export const ALL_PHASES: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function seedProject(overrides: Partial<Project> = {}): Project {
  const base = emptyProject({ name: "Fixture", brief: FIXTURE_BRIEF });
  return { ...base, ...overrides };
}

/** Advance currentPhase to `next` and mark that record ready (store.runReady parity). */
function advanceTo(project: Project, next: number): Project {
  return {
    ...project,
    currentPhase: Math.min(12, next) as PhaseId,
    phases: project.phases.map((r) =>
      r.id === next ? { ...r, status: "ready" as const } : r,
    ),
  };
}

/**
 * Run the given phases in ascending order. Each phase is applied via
 * applyPhaseResult; when a phase parks awaiting_hitl it is immediately
 * approved with decidedBy "human" (approvals are part of the requested run).
 * Phases already complete are skipped; a phase already awaiting_hitl at the
 * current cursor is cleared the same way.
 */
export function runHeadless(p: Project, phasesToRun: number[]): Project {
  let cur = p;
  const order = [...phasesToRun].sort((a, b) => a - b);
  for (const phase of order) {
    if (phase < 0 || phase > 12) continue;
    const rec = cur.phases.find((r) => r.id === phase);
    if (rec?.status === "complete") continue;
    if (rec?.status === "awaiting_hitl") {
      if (cur.currentPhase === phase) cur = approveHitl(cur, { decidedBy: "human" });
      continue;
    }
    cur = applyPhaseResult(cur, phase as PhaseId);
    if (cur.status === "awaiting_hitl" && cur.hitl?.phase === phase) {
      cur = approveHitl(cur, { decidedBy: "human" });
    }
  }
  // A "full run" fixture includes live research (the research phases fetched real
  // findings), so DoD's p7-research (live corpus, M-09 tightening) is satisfied.
  if (order.includes(7)) {
    cur = {
      ...cur,
      research: [
        {
          query: "fixture live research",
          provider: "duckduckgo",
          items: [
            {
              title: "Fixture competitor finding",
              url: "https://example.com/fixture",
              content: "fixture research corpus",
            },
          ],
        },
      ],
    };
  }
  return cur;
}

/**
 * Park a project at the mouth of targetPhase without executing it: every
 * phase below targetPhase is sealed (HITL gates below the target are approved
 * with decidedBy "human" only to keep the pipeline moving), then execution
 * stops with currentPhase === targetPhase — unless the project arrives at the
 * target already awaiting a human decision, in which case it stays parked
 * awaiting (status "awaiting_hitl"), or it is blocked (returned as-is).
 * Bounded and deterministic: at most one apply per phase, no sleeps.
 */
export function runToGate(p: Project, targetPhase: number): Project {
  let cur = p;
  // Pass fuse: each phase costs one apply pass plus (for HITL phases) one human
  // approval pass — 13 applies + up to 13 approvals = 26 passes worst case, plus
  // one pass each for the await/complete return conditions. 40 is a true ceiling,
  // never a throttle: every pass strictly progresses currentPhase or returns, so
  // the loop cannot spin; the bound only guards against a future engine regression
  // that forgets to advance. (Formerly 15 — too small: runToGate(project, 12)
  // exhausted the fuse at phase 11 and returned short of the target's mouth.)
  for (let i = 0; i < 40; i++) {
    if (cur.status === "blocked") return cur;
    if (cur.status === "awaiting_hitl") {
      // Parked at a human gate: if it is the target, stay awaiting; otherwise
      // clear it (human decision) so the pipeline can keep advancing.
      if (cur.currentPhase === targetPhase) return cur;
      cur = approveHitl(cur, { decidedBy: "human" });
      continue;
    }
    if (cur.currentPhase === targetPhase) return cur;
    if (cur.status === "complete") return cur; // pipeline fully sealed
    const rec = cur.phases.find((r) => r.id === cur.currentPhase);
    if (rec?.status === "complete") {
      cur = advanceTo(cur, cur.currentPhase + 1);
      continue;
    }
    cur = applyPhaseResult(cur, cur.currentPhase as PhaseId);
    if (cur.status !== "awaiting_hitl" && cur.status !== "complete" && cur.currentPhase < 12) {
      // Non-HITL phase sealed: store parity — advance to the next record.
      cur = advanceTo(cur, cur.currentPhase + 1);
    }
  }
  return cur;
}
