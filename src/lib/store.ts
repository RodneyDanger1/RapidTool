import { create } from "zustand";
import { persist, type PersistOptions, type PersistStorage, type StorageValue } from "zustand/middleware";
import {
  applyPhaseResult,
  approveHitl,
  emptyProject,
  hydrateProject,
  inferName,
  rejectHitl,
  runP6Real,
  stampPacket,
  unlockRetry,
  wildLog,
  wildPause,
  wildStep,
  // PB-03 (E-13 seam): deepenResearch is imported under an alias so the store's
  // own public action below can share the name without shadowing the engine fn.
  deepenResearch as deepenResearchEngine,
} from "./engine.ts";
import { canEnter, priorsSealed, phaseDef, STOCK_HITL } from "./phases.ts";
import { gateArtifact, hardDodBlockInto, hardDodMessage, runGate } from "./dod.ts";
import { exportProjectJson, importProject as parseProjectJson } from "./io.ts";
import { validateReport, applyReportResult, reportGateDelta, type ReportApplyReason } from "./report-intake.ts";
import { interpretFeedback } from "./llm-tasks.ts";
import { verifyAndFix, applyVerifyOutcome } from "./verify.ts";
import { releaseWildStart, reportRt, tryStartWild } from "./rt-client.ts";
import type {
  Artifact,
  ChatLogRow,
  JsonLog,
  PhaseId,
  Project,
  ResearchCorpusEntry,
} from "./types";
import type { ErrorCode } from "./errors.ts";

export type ApproveResult = { ok: true } | { ok: false; error: string };

/** Why a runUntilHitl loop stopped: natural resting points (hitl/complete),
 *  intervention states (blocked), failures (error), the defensive loop cap,
 *  or a P10 hard-DoD block (dod). */
export type RunStopReason = "hitl" | "complete" | "blocked" | "error" | "cap" | "dod" | null;

export type RunResult =
  | { ok: true; ran: number; stoppedReason: RunStopReason; note?: string }
  | { ok: false; ran: number; stoppedReason: RunStopReason; error: string };

/**
 * fixes/150 (M4 ms4 — watchdog mirror): structural subset of
 * headless.P6JourneyResult. Deliberately NOT a type import of headless.ts —
 * that module is server-only (node:fs at top level) and is under concurrent
 * lane edit this wave; the store commits `project` and re-reads the rest.
 */
export type P6JourneySurface = {
  outcome: "keyless" | "converged" | "failed";
  project: Project;
  cycles: number;
  budget: number;
  gate: { passed: boolean; unmet: string[]; evidenceHash: string } | null;
};

/**
 * P13 Wild Mode driver result (startWildRun resolves to this). Natural stops:
 * "paused" (classifier/human/hard-DoD/error pause — wildRun.pause stays true),
 * "complete" (P0→P12 sealed), "cap" (defensive driver ceiling — paused too).
 */
export type WildRunResult =
  | { ok: true; ran: number; stoppedReason: "paused" | "complete" | "cap" | null; code?: ErrorCode }
  | { ok: false; ran: number; stoppedReason: "paused" | "complete" | "cap" | null; error: string; code?: ErrorCode };

export type ImportProjectResult =
  | { ok: true; id: string; name: string; replaced: boolean }
  | { ok: false; error: string };

/** In-memory surface for LLM wiring (never persisted — derived from llmStatus()). */
export type LlmStatusSurface = { configured: boolean; label: string; model?: string };
/** In-memory surface for the research backend (never persisted). */
export type ResearchStatusSurface = { configured: boolean; label: string };

type RapidState = {
  projects: Project[];
  activeId: string | null;
  hydrated: boolean;
  autopilot: boolean;
  setHydrated: (v: boolean) => void;
  setAutopilot: (v: boolean) => void;
  create: (brief: string, name?: string) => string;
  select: (id: string | null) => void;
  execute: (id: string) => ApproveResult;
  runUntilHitl: (id: string) => RunResult;
  approve: (id: string, opts?: { force?: boolean; requestedAt?: number; note?: string }) => ApproveResult;
  reject: (id: string, note: string) => ApproveResult;
  rejectAsync: (id: string, note: string) => Promise<ApproveResult>;
  retry: (id: string) => void;
  remove: (id: string) => void;
  clone: (id: string) => string | null;
  rename: (id: string, name: string) => void;
  setNotes: (id: string, notes: string) => void;
  // P0-2: append persisted chat rows (cap 40 = CHAT_LOG_MAX_ROWS headroom).
  appendChatRows: (id: string, rows: ChatLogRow[]) => void;
  refreshPacket: (id: string) => void;
  exportProject: (id: string) => string | null;
  importProject: (json: string) => ImportProjectResult;
  seedIfEmpty: () => void;
  demoSeeded: boolean;
  llmStatus: LlmStatusSurface;
  researchStatus: ResearchStatusSurface;
  refreshStatuses: () => Promise<void>;
  executeAsync: (id: string) => Promise<ApproveResult>;
  runUntilHitlAsync: (id: string) => Promise<RunResult>;
  // PB-03 (E-13): deepen a completed research phase (P0/P7/P11) with live/web
  // research and re-record its gate. Name is in the console's DEEPEN_ACTION_NAMES
  // probe list, so the "Run live research (P7)" affordance resolves to this.
  deepenResearch: (
    id: string,
    phase: PhaseId,
  ) => Promise<{ ok: true } | { ok: false; error: string; code?: string }>;
  /** fixes/135: run the machine-verify loop on the project's P6 module (UI path). */
  runVerifyAsync: (
    id: string,
  ) => Promise<
    | { ok: true; status?: string; iterations?: number; note?: string }
    | { ok: false; error: string; status?: string; iterations?: number }
  >;
  /** fixes/150 (M4 ms4 — watchdog mirror): async UI face of the keyed P6
   *  journey (headless.driveP6Journey). Keyless runs are honest no-ops
   *  (outcome "keyless", nothing committed); converged/failed commit the
   *  journey's project. headless is server-only, so it is imported lazily
   *  inside the action — never in the client bundle's static graph. */
  runP6Journey: (
    id: string,
    opts?: {
      budget?: number;
      /** Test/dev DI mirroring runVerifyAsync's opts.server: replaces the
       *  default live seams so deterministic tests need no key/fs/network. */
      deps?: {
        synthesize?: (
          project: Project,
          ctx: { cycle: number; treeFailureTail?: string; refusal?: string },
        ) => Promise<Project>;
        runTree?: (project: Project) => Promise<{ ok: boolean }>;
      };
    },
  ) => Promise<
    | { ok: true; outcome: "keyless" | "converged" | "failed"; cycles: number; budget: number; gate: P6JourneySurface["gate"] }
    | { ok: false; error: string }
  >;
  runModuleReal: (
    id: string,
  ) => Promise<{ ok: true; result: unknown } | { ok: false; result: unknown; error: string }>;
  ingestReport: (
    id: string,
    raw: unknown,
  ) =>
    | {
        ok: true;
        applied?: boolean;
        reason?: ReportApplyReason;
        gate_unmet?: string[];
        note?: string;
      }
    | {
        ok: false;
        error: string;
        applied?: boolean;
        reason?: ReportApplyReason;
        gate_unmet?: string[];
      };
  hasProject: (id: string) => boolean;
  // P10: per-project hard-DoD opt-in (off by default — advisory behavior unchanged).
  setEnforceDod: (id: string, on: boolean) => void;
  // P13: Wild Mode opt-in + run lifecycle (B7 contract names).
  setWildMode: (id: string, on: boolean) => void;
  startWildRun: (id: string) => Promise<WildRunResult>;
  stopWildRun: (id: string) => void;
  toggleWildPause: (id: string) => void;
};

function byId(projects: Project[], id: string) {
  return projects.find((p) => p.id === id);
}

/**
 * ST-6: per-project serialization for async store actions. Async actions capture
 * a project snapshot when called and commit a whole-project result when the
 * synthesis settles — WITHOUT a queue, two overlapping actions (double-fire, a
 * step racing a full run, any future non-UI caller) both compute from the SAME
 * pre-run snapshot and the LAST committer wins, so a single-phase `executeAsync`
 * that settles after a full `runUntilHitlAsync` silently rolls the graph back.
 * Chaining per id makes each action observe the previous action's committed
 * state (same semantics as the sync actions); the chain key is removed once the
 * tail settles so sequential calls stay unqueued.
 */
const asyncChains = new Map<string, Promise<void>>();

function serialized<T>(id: string, action: () => Promise<T>): Promise<T> {
  const prev = asyncChains.get(id) ?? Promise.resolve();
  const run = prev.then(action);
  // The stored tail swallows rejections so one failed action never poisons the
  // chain for the next caller (store actions already never throw by contract).
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  asyncChains.set(id, tail);
  void tail.then(() => {
    if (asyncChains.get(id) === tail) asyncChains.delete(id);
  });
  return run;
}

/**
 * ST-6: rebase an async run's result onto the LIVE project record so operator
 * edits made while the run was in flight (rename/setNotes — sync, atomic) are
 * not silently rolled back by the run's whole-project commit. Engine-owned
 * fields (phases, artifacts, logs, packet, ...) always come from the run.
 *
 * fixes/115 H-01 whitelist audit — every Project field (types.ts:249-365)
 * diffed against this list at patch time:
 *  - name/notes/createdAt/enforceDod/wildMode — operator-owned sync actions
 *    (rename/setNotes/setEnforceDod/setWildMode); the run only passes them
 *    through, so the live value wins (H39-2.3).
 *  - chatLog — user-owned: appendChatRows is a sync action exactly like
 *    rename/setNotes and the engine NEVER appends chat rows, so live.chatLog
 *    is always a superset of the run's snapshot. Added here (H-01): a message
 *    sent while any async run was in flight used to vanish because the run's
 *    whole-project commit replaced chatLog with its own stale snapshot.
 *  - kind — user/operator-owned (set at create/import; no run path recomputes
 *    it), so live wins is a safe pass-through that also protects a concurrent
 *    operator write from a stale whole-project commit.
 *  - NOT whitelisted (engine-run-owned: the committing run's FRESH output must
 *    win over the stale live snapshot or the run rolls itself back):
 *    id/brief/domain/status/currentPhase/phases/scorecard/competitors/research/
 *    artifacts/memory/logs/hitl/decisions/modelRoute/sandbox/openapi/adr/
 *    lattice/schedule/traces/packet/specGraph/contracts/oracle/crew/_v/meta.
 *    Concurrent engine-owned APPENDS to artifacts/logs/decisions/memory/
 *    research made while the run was in flight are merged — not clobbered — by
 *    rebaseConcurrentEngine at the wild driver's commitWild (H-06).
 *  - implementationSpec — dual-authored: operator (CLI prompt verb) AND P6
 *    keyed synthesis INSIDE a run. Live-wins would discard a run's freshly
 *    generated spec, so it rides the committed spread (a pre-existing spec
 *    survives via the spread; H-01 regression R1 covers this).
 *  - wildRun — deliberately NOT copied: it is engine-owned mutable run state;
 *    the wild driver commits each step's OWN wildRun, so the live record must
 *    not win over a step result.
 */
function rebaseUserFields(committed: Project, live: Project | undefined): Project {
  if (!live) return committed;
  return {
    ...committed,
    name: live.name,
    notes: live.notes,
    createdAt: live.createdAt,
    // H39-2.3: operator toggles are sync actions and must survive an async
    // action's whole-project commit (setEnforceDod/setWildMode mid-flight were
    // silently rolled back before). wildRun is deliberately NOT copied here —
    // it is engine-owned mutable run state; the wild driver commits each
    // step's OWN wildRun, so the live record must not win over a step result.
    enforceDod: live.enforceDod,
    wildMode: live.wildMode,
    // H-01 (fixes/115): chatLog is user-owned — the engine never appends chat
    // rows, so live.chatLog is always a superset of the run's snapshot and
    // must win (rows appended mid-run used to be silently dropped).
    chatLog: live.chatLog,
    kind: live.kind,
  };
}

/**
 * fixes/115 H-06: union engine-owned rows a CONCURRENT writer appended while an
 * async step was in flight into the step's committed project. `stepInput` is
 * the generation the step was computed FROM (the last committed project), so
 * concurrent rows are exactly those in `live` whose key is absent from the
 * step input (ingestReport artifacts/logs/memory, a human approve's decision
 * journal entry, deepenResearch corpus rows, ...). Appended-only collections
 * union by row key; scalar engine state (phases/status/hitl/wildRun/packet/
 * currentPhase/...) stays owned by the committing step — the caller keeps the
 * run's own generation authoritative for every field it computes.
 *
 * The merge is idempotent under the driver's read-merge-commit loop: the loop
 * continues from the MERGED project, so once a row is adopted it is part of
 * the next step's input and can never be unioned twice.
 */
function rebaseConcurrentEngine(committed: Project, stepInput: Project, live: Project): Project {
  const idsOf = (rows: readonly { id: string }[] | undefined): Set<string> =>
    new Set((rows ?? []).map((r) => r.id));
  const prevArtifactIds = idsOf(stepInput.artifacts);
  const prevDecisionIds = idsOf(stepInput.decisions);
  const prevMemoryIds = idsOf(stepInput.memory);
  const logKey = (l: JsonLog): string => `${l.ts}:${l.event}`;
  const prevLogKeys = new Set((stepInput.logs ?? []).map(logKey));
  const urlsOf = (items: readonly { url: string }[] | undefined): string =>
    [...new Set((items ?? []).map((i) => i.url))].sort().join("\n");
  const researchKey = (e: ResearchCorpusEntry): string => `${e.query}\u0000${urlsOf(e.items)}`;
  const prevResearchKeys = new Set((stepInput.research ?? []).map(researchKey));
  const unseen = <T extends { id: string }>(rows: T[] | undefined, prev: Set<string>): T[] =>
    (rows ?? []).filter((r) => !prev.has(r.id));
  return {
    ...committed,
    artifacts: [...(committed.artifacts ?? []), ...unseen(live.artifacts, prevArtifactIds)],
    logs: [...(committed.logs ?? []), ...(live.logs ?? []).filter((l) => !prevLogKeys.has(logKey(l)))].slice(-200),
    decisions: [...(committed.decisions ?? []), ...unseen(live.decisions, prevDecisionIds)],
    memory: [...(committed.memory ?? []), ...unseen(live.memory, prevMemoryIds)],
    research: [
      ...(committed.research ?? []),
      ...(live.research ?? []).filter((e) => !prevResearchKeys.has(researchKey(e))),
    ],
  };
}

/**
 * T8: record a machine-checkable DoD verdict when a phase completes (advisory —
 * gates never block a run; they make the exit criteria visible and auditable).
 * Sets PhaseRecord.gate, appends a gate.verdict log, and swaps in a `gate` artifact.
 */
function recordGate(project: Project, phase: PhaseId): Project {
  const rec = project.phases.find((p) => p.id === phase);
  if (!rec || rec.status !== "complete") return project;
  const r = runGate(project, phase);
  const unmet = r.unmet.map((g) => g.criterion);
  const phases = project.phases.map((p) =>
    p.id === phase
      ? {
          ...p,
          gate: {
            passed: r.pass,
            unmet,
            evidenceHash: r.evidenceHash,
            checkedAt: Date.now(),
          },
        }
      : p,
  );
  const artifact = gateArtifact(phase, {
    pass: r.pass,
    unmet,
    evidenceHash: r.evidenceHash,
  });
  return {
    ...project,
    phases,
    logs: [
      ...project.logs,
      {
        ts: Date.now(),
        phase,
        level: r.pass ? ("info" as const) : ("warn" as const),
        event: "gate.verdict",
        detail: `${r.pass ? "PASS" : "FAIL"} · ${r.unmet.length} unmet · ${r.evidenceHash.slice(0, 8)}`,
      },
    ].slice(-200),
    artifacts: [
      ...project.artifacts.filter((a) => !(a.kind === "gate" && a.phase === phase)),
      artifact,
    ],
  };
}

/**
 * E-03: converge a REAL bounded P6 run into the recorded DoD state (pure —
 * exported as the runModuleReal test seam). `base` carries the
 * runP6Real-returned project (engine re-stamped lastTest from the real exit
 * code, labeled "real-run" by the caller) plus the run artifact/log; the
 * recorded P6 gate (PhaseRecord.gate + gate artifact + gate.verdict log) is
 * re-evaluated against that REAL shape so a failing exit code flips the
 * recorded verdict to FAIL. No-op on the gate while P6 is not complete
 * (approval records it then — recordGate's own guard).
 */
export function convergeRealRun(base: Project, artifact: Artifact, log: JsonLog): Project {
  const updated: Project = {
    ...base,
    artifacts: [...base.artifacts, artifact],
    logs: [...base.logs, log].slice(-200),
  };
  return recordGate(updated, 6 as PhaseId);
}

function canAutopilot(project: Project, enabled: boolean) {
  if (!enabled || !project.hitl) return false;
  // R3/B-03: a gate the engine marked human-only (failed P6 sandbox) is never autopilot-approved.
  if (project.hitl.forceHuman) return false;
  if ((STOCK_HITL as readonly number[]).includes(project.hitl.phase)) return false;
  // M-09: autopilot must not approve a phase that fails its own DoD criteria.
  if (!runGate(project, project.hitl.phase).pass) return false;
  return (project.schedule?.tightness ?? 10) < 7.2;
}

/**
 * E-20 (M-09 completion): when autopilot is ON but the parked gate's DoD is
 * unmet, append the machine-readable denial log the audit asked for
 * (`autopilot.gate_denied`, warn, unmet ids) — the old code parked on
 * "Waiting on human approval." with no trail at all. forceHuman and stock
 * gates are excluded: their denials are POLICY (human-only by design), not
 * DoD failures, so no DoD log is minted for them. Returns null when nothing
 * should be logged (gate passes / no gate / policy denial).
 */
function deniedGateLog(project: Project): Project | null {
  const gate = project.hitl;
  if (!gate || gate.forceHuman || (STOCK_HITL as readonly number[]).includes(gate.phase)) return null;
  const r = runGate(project, gate.phase);
  if (r.pass) return null;
  const entry: JsonLog = {
    ts: Date.now(),
    phase: gate.phase,
    level: "warn",
    event: "autopilot.gate_denied",
    detail: `P${gate.phase} unmet: ${r.unmet.map((g) => g.id).join(", ")}`,
  };
  return {
    ...project,
    logs: [...project.logs, entry].slice(-200),
  };
}

function advanceOnce(
  project: Project,
  autopilot: boolean,
): { project: Project; error?: string; stopped?: boolean; gateDenied?: boolean; dodBlocked?: boolean } {
  const phase = project.currentPhase;
  const rec = project.phases[phase];
  if (!rec) return { project, error: "Unknown phase." };
  if (project.status === "blocked" && rec.status === "rejected") {
    return { project, error: "Phase rejected — retry with the note applied.", stopped: true };
  }
  if (rec.status === "locked") return { project, error: "Phase is locked." };
  if (rec.status === "awaiting_hitl") {
    if (canAutopilot(project, autopilot)) {
      // T2: autopilot approvals land in the decision journal with their actor.
      // SWEEP-2 (st-7): the just-approved phase gets its DoD gate recorded
      // (gate field + artifact + gate.verdict log) exactly like store.approve
      // records a HUMAN approval — previously only approveHitl's inline
      // record landed here, so autopilot-driven runs silently lacked the gate
      // artifact and log that manual runs carry.
      return { project: recordGate(approveHitl(project, { decidedBy: "autopilot" }), phase) };
    }
    // E-20: log the DoD-fail denial (park stays a 0-progress stop; the log
    // rides along so operators/agents see WHY autopilot parked).
    if (autopilot) {
      const denied = deniedGateLog(project);
      if (denied) {
        return {
          project: denied,
          error: "Waiting on human approval.",
          stopped: true,
          gateDenied: true,
        };
      }
    }
    return { project, error: "Waiting on human approval.", stopped: true };
  }
  if (rec.status === "complete" && phase < 12) {
    // P10 hard-DoD: advancing means LEAVING the completed current phase — when
    // enforcement is on, its exit gate must pass or the advance is blocked
    // (artifact + dod.blocked log appended, run stops with an honest error).
    if (project.enforceDod === true) {
      const r = runGate(project, phase);
      if (!r.pass) {
        return {
          project: hardDodBlockInto(project, phase, r),
          error: hardDodMessage(phase, r),
          stopped: true,
          dodBlocked: true,
        };
      }
    }
    const next = (phase + 1) as PhaseId;
    if (!canEnter(phase, next)) return { project, error: "Illegal transition." };
    if (!priorsSealed(project.phases, next)) return { project, error: `P${phase} must stay sealed.` };
    const advanced: Project = {
      ...project,
      currentPhase: next,
      phases: project.phases.map((p) => (p.id === next ? { ...p, status: "ready" } : p)),
    };
    return runReady(advanced, next, autopilot);
  }
  if (rec.status === "complete") return { project, error: "Pipeline complete.", stopped: true };
  return runReady(project, phase, autopilot);
}

function runReady(
  project: Project,
  phase: PhaseId,
  autopilot: boolean,
): { project: Project; error?: string; stopped?: boolean; dodBlocked?: boolean } {
  if (!priorsSealed(project.phases, phase)) {
    return { project, error: `Cannot enter P${phase} — prior phases are not sealed.` };
  }
  const running: Project = {
    ...project,
    currentPhase: phase,
    phases: project.phases.map((p) =>
      p.id === phase ? { ...p, status: "running", startedAt: Date.now() } : p,
    ),
    status: "running",
  };
  const updated = applyPhaseResult(running, phase);
  return finishPhase(updated, phase, autopilot);
}

/**
 * Post-synthesis pass shared by the sync and async run paths: record the DoD gate,
 * advance the current edge, and re-stamp the packet. ST-1: the packet is re-stamped
 * AFTER the gate verdict is recorded, so the System JSON `gate_passed` for the phase
 * is fresh — on auto-advance AND on the P12 completion leaf (previously only the
 * auto-advance branch re-stamped).
 *
 * P10: when `enforceDod` is on, the auto-advance branch refuses to LEAVE the
 * just-completed phase unless runGate passes — the phase record stays complete,
 * a "Hard DoD block" artifact + `dod.blocked` log are appended, the cursor does
 * not move, and the run stops with an honest error.
 */
function finishPhase(
  updated: Project,
  phase: PhaseId,
  autopilot: boolean,
): { project: Project; stopped: boolean; error?: string; dodBlocked?: boolean } {
  updated = recordGate(updated, phase);
  if (updated.status === "blocked") return { project: updated, stopped: true };
  if (updated.status !== "awaiting_hitl" && phase < 12) {
    if (updated.enforceDod === true) {
      const r = runGate(updated, phase);
      if (!r.pass) {
        return {
          project: hardDodBlockInto(updated, phase, r),
          stopped: true,
          error: hardDodMessage(phase, r),
          dodBlocked: true,
        };
      }
    }
    const next = (phase + 1) as PhaseId;
    updated = {
      ...updated,
      currentPhase: next,
      phases: updated.phases.map((p) => (p.id === next ? { ...p, status: "ready" } : p)),
    };
  }
  updated = stampPacket(updated);
  if (canAutopilot(updated, autopilot)) {
    updated = approveHitl(updated, { decidedBy: "autopilot" });
    // SWEEP-2 (st-7): the finishPhase auto-approval (non-stock extra-HITL gate
    // that opened during THIS synthesis) completes the phase — record its DoD
    // gate now so the artifact + gate.verdict log exist exactly as they do for
    // human approvals and non-HITL completions (recordGate above no-op'd while
    // the phase was still awaiting_hitl).
    updated = recordGate(updated, phase);
  }
  return {
    project: updated,
    stopped:
      updated.status === "awaiting_hitl" || updated.status === "complete" || updated.status === "blocked",
  };
}

/**
 * Best-effort async phase synthesis (LLM/research engine path). When a live backend
 * is configured it delegates to `engine.runPhaseAsync`; otherwise — or on any async
 * failure — it degrades to the deterministic synchronous engine. Never throws.
 */
async function synthesizeAsync(
  project: Project,
  phase: PhaseId,
  configured: boolean,
): Promise<Project> {
  if (configured) {
    try {
      const mod = await import("./engine.ts");
      const fn = (mod as { runPhaseAsync?: unknown }).runPhaseAsync;
      if (typeof fn === "function") {
        const out = await (fn as (p: Project, ph: PhaseId) => Promise<Project>)(project, phase);
        if (out && typeof out === "object" && Array.isArray((out as Project).phases)) {
          return out as Project;
        }
      }
    } catch {
      // engine.runPhaseAsync unavailable or threw → deterministic fallback below.
    }
  }
  return applyPhaseResult(project, phase);
}

async function runReadyAsync(
  project: Project,
  phase: PhaseId,
  autopilot: boolean,
  configured: boolean,
): Promise<{ project: Project; error?: string; stopped?: boolean; dodBlocked?: boolean }> {
  if (!priorsSealed(project.phases, phase)) {
    return { project, error: `Cannot enter P${phase} — prior phases are not sealed.` };
  }
  const running: Project = {
    ...project,
    currentPhase: phase,
    phases: project.phases.map((p) =>
      p.id === phase ? { ...p, status: "running", startedAt: Date.now() } : p,
    ),
    status: "running",
  };
  const updated = await synthesizeAsync(running, phase, configured);
  return finishPhase(updated, phase, autopilot);
}

/** Async mirror of `advanceOnce`: same transition guards, async synthesis. */
async function advanceOnceAsync(
  project: Project,
  autopilot: boolean,
  configured: boolean,
): Promise<{ project: Project; error?: string; stopped?: boolean; gateDenied?: boolean; dodBlocked?: boolean }> {
  const phase = project.currentPhase;
  const rec = project.phases[phase];
  if (!rec) return { project, error: "Unknown phase." };
  if (project.status === "blocked" && rec.status === "rejected") {
    return { project, error: "Phase rejected — retry with the note applied.", stopped: true };
  }
  if (rec.status === "locked") return { project, error: "Phase is locked." };
  if (rec.status === "awaiting_hitl") {
    if (canAutopilot(project, autopilot)) {
      // T2: autopilot approvals land in the decision journal with their actor.
      // SWEEP-2 (st-7): record the DoD gate like the sync path (and store.approve).
      return { project: recordGate(approveHitl(project, { decidedBy: "autopilot" }), phase) };
    }
    // E-20: mirror the sync denial logging (see deniedGateLog / advanceOnce).
    if (autopilot) {
      const denied = deniedGateLog(project);
      if (denied) {
        return {
          project: denied,
          error: "Waiting on human approval.",
          stopped: true,
          gateDenied: true,
        };
      }
    }
    return { project, error: "Waiting on human approval.", stopped: true };
  }
  if (rec.status === "complete" && phase < 12) {
    // P10 hard-DoD mirror of the sync advanceOnce guard (leave requires a pass).
    if (project.enforceDod === true) {
      const r = runGate(project, phase);
      if (!r.pass) {
        return {
          project: hardDodBlockInto(project, phase, r),
          error: hardDodMessage(phase, r),
          stopped: true,
          dodBlocked: true,
        };
      }
    }
    const next = (phase + 1) as PhaseId;
    if (!canEnter(phase, next)) return { project, error: "Illegal transition." };
    if (!priorsSealed(project.phases, next)) return { project, error: `P${phase} must stay sealed.` };
    const advanced: Project = {
      ...project,
      currentPhase: next,
      phases: project.phases.map((p) => (p.id === next ? { ...p, status: "ready" } : p)),
    };
    return runReadyAsync(advanced, next, autopilot, configured);
  }
  if (rec.status === "complete") return { project, error: "Pipeline complete.", stopped: true };
  return runReadyAsync(project, phase, autopilot, configured);
}

/**
 * H4 — store persistence hardening (quota errors, corrupt-state recovery,
 * unbounded-payload guards). Everything below exists so a hostile or broken
 * storage layer can never (a) throw through a store action, (b) strand
 * hydration, or (c) grow memory without bound.
 */

/** The persisted slice — exactly what partialize() writes to storage. */
type PersistedSlice = Pick<RapidState, "projects" | "activeId" | "autopilot" | "demoSeeded">;

/**
 * H4: engine/UI caps reused by the quota-salvage write. The engine already
 * trims logs to 200 and chatLog to 40 rows on every append, so a salvage
 * write that trims a project to these same caps loses nothing the engine
 * would not have trimmed on its next write anyway — while keeping the
 * persisted snapshot valid JSON the next reload can hydrate.
 */
const RESCUE_LOG_CAP = 200;
const RESCUE_CHAT_CAP = 40;

/** Last fully-failed persist write (quota/blocked AND salvage failed), if any. */
let lastPersistFailure: string | null = null;

/** H4: surface persist-write health so tooling can warn operators that the
 *  in-memory state will NOT survive a reload (storage rejected the write). */
export function persistStorageHealth(): { ok: boolean; lastError: string | null } {
  return { ok: lastPersistFailure === null, lastError: lastPersistFailure };
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Resolve the CURRENT storage object per call (tests swap it mid-suite). */
function currentStorage(): Storage | undefined {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

/** H4: a project entry is repairable only when its shape cannot crash the
 *  repair pass. hydrateProject tolerates junk FIELDS and junk ROWS, but a
 *  `phases` value that is neither an array nor absent (e.g. a plain object)
 *  would throw inside repairPhases's for..of — drop such entries before the
 *  map so one corrupt persisted row can never take down rehydration. */
function isRepairableProjectEntry(p: unknown): p is Project {
  if (typeof p !== "object" || p === null || Array.isArray(p)) return false;
  const phases = (p as { phases?: unknown }).phases;
  return phases === undefined || Array.isArray(phases);
}

/** H4: quota-salvage — trim per-project logs/chatLog to engine caps and
 *  retry the write ONCE so an over-quota payload still lands as a valid,
 *  hydratable snapshot instead of being dropped entirely. */
function salvageTrim(value: StorageValue<PersistedSlice>): StorageValue<PersistedSlice> {
  const projects: Project[] = Array.isArray(value.state?.projects)
    ? value.state.projects.map((p): Project => {
        if (typeof p !== "object" || p === null || Array.isArray(p)) return p;
        const rec = p as Record<string, unknown>;
        const logs = Array.isArray(rec.logs) ? (rec.logs as unknown[]).slice(-RESCUE_LOG_CAP) : rec.logs;
        const chatLog = Array.isArray(rec.chatLog)
          ? (rec.chatLog as unknown[]).slice(-RESCUE_CHAT_CAP)
          : rec.chatLog;
        return { ...rec, logs, chatLog } as unknown as Project;
      })
    : (value.state?.projects as Project[] | undefined) ?? [];
  return { ...value, state: { ...value.state, projects } };
}

/**
 * H4: quota-safe persist storage. Wraps localStorage so a quota error or a
 * blocked/absent storage can NEVER throw through a zustand set() into a store
 * action (the UI button that triggered the write would otherwise crash). A
 * failed full write is retried ONCE with engine-capped history; if even that
 * is rejected the write is dropped with a warn and surfaced through
 * persistStorageHealth() — in-memory state stays authoritative either way.
 * getItem swallows unreadable/corrupt blobs as "empty" so hydration always
 * completes and the next persist write heals the blob.
 */
function quotaSafePersistStorage(): PersistStorage<PersistedSlice> | undefined {
  if (!currentStorage()) return undefined; // zustand's persist handles absence
  return {
    getItem: (name) => {
      const store = currentStorage();
      if (!store) return null;
      try {
        const raw = store.getItem(name);
        if (raw === null) return null;
        return JSON.parse(raw) as StorageValue<PersistedSlice>;
      } catch {
        // Corrupt blob: treat as empty — hydration completes, and the seed's
        // next persist write overwrites the unreadable payload with valid JSON.
        return null;
      }
    },
    setItem: (name, value) => {
      const store = currentStorage();
      if (!store) {
        lastPersistFailure = `persist write to "${name}" failed: localStorage unavailable`;
        return;
      }
      try {
        store.setItem(name, JSON.stringify(value));
        lastPersistFailure = null;
        return;
      } catch (err) {
        // Quota exceeded / storage blocked. Never propagate into the action.
        const first = errText(err);
        try {
          store.setItem(name, JSON.stringify(salvageTrim(value)));
          console.warn(
            `[store] persist write to "${name}" exceeded storage capacity — retried with engine-capped history; in-memory state unchanged.`,
          );
          lastPersistFailure = null;
        } catch (err2) {
          lastPersistFailure = `persist write to "${name}" failed: ${first} (salvage retry also failed: ${errText(err2)})`;
          try {
            reportRt({
              level: "error",
              scope: "store-persist",
              event: "persist.quota_failed",
              message: lastPersistFailure,
              capture: "src/lib/store.ts:persist setItem salvage",
              err: err2,
            });
          } catch {
            /* telemetry must never propagate */
          }
          console.warn(
            `[store] ${lastPersistFailure} — in-memory state is kept but will not survive a reload.`,
          );
        }
      }
    },
    removeItem: (name) => {
      try {
        currentStorage()?.removeItem(name);
      } catch {
        // best effort — a blocked remove must never throw into callers.
      }
    },
  };
}

/** H4: corrupt/unusable persisted state — drop it, mark hydrated, and let the
 *  demo seed run (the seed's persist write also overwrites the corrupt blob,
 *  so the next load rehydrates cleanly). Never strands hydration. */
function recoverFromCorruptPersistence(): void {
  useRapid.setState({ hydrated: true, projects: [], activeId: null, demoSeeded: false });
  useRapid.getState().seedIfEmpty();
}

const persistOptions: PersistOptions<RapidState, PersistedSlice> = {
  name: "rapidtool.v4",
  // T0.1 (fixes/162): version the blob BEFORE any schema add. zustand defaults
  // version:0 with no migrate — a later bump would wipe every user and re-wipe
  // every reload (the blob is never overwritten on a version mismatch).
  // v0 → v1 is an identity migrate (legacy blobs keep their projects).
  // A FUTURE blob (fromVersion > 1) throws so onRehydrateStorage recovers
  // via recoverFromCorruptPersistence (clean re-seed), never silent-drop.
  version: 1,
  migrate: (persistedState, fromVersion) => {
    if (typeof fromVersion === "number" && fromVersion > 1) {
      throw new Error(`rapidtool persist: future schema version ${fromVersion}`);
    }
    return persistedState as PersistedSlice;
  },
  storage: quotaSafePersistStorage(),
  partialize: (s) => ({
    projects: s.projects,
    activeId: s.activeId,
    autopilot: s.autopilot,
    demoSeeded: s.demoSeeded,
  }),
  onRehydrateStorage: () => (state, error) => {
    // H4: the previous code only handled a JSON PARSE error. A VALID-JSON
    // blob whose state shape is junk (e.g. `{"state":{"projects":"x"}}`) used
    // to sail through the success path and crash seedIfEmpty's
    // `.map(hydrateProject)` — throwing out of the hydration callback and
    // leaving `hydrated` false forever (or surfacing as an unhandled
    // rejection). Both corrupt families now land in the same recovery.
    if (error || !state || !Array.isArray(state.projects)) {
      recoverFromCorruptPersistence();
      return;
    }
    try {
      state.setHydrated(true);
      state.seedIfEmpty();
    } catch {
      // Belt and braces: a repair that somehow still throws must not escape
      // the hydration callback — recover instead of stranding.
      recoverFromCorruptPersistence();
    }
  },
};

export const useRapid = create<RapidState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeId: null,
      // PB-03 (E-13 seam): live-research deepening via engine.deepenResearch —
      // commits through the store so the console affordance actually works.
      deepenResearch: async (id: string, phase: PhaseId) =>
        serialized(id, async () => {
        const p = get().projects.find((x) => x.id === id);
        if (!p) return { ok: false, error: "Project not found.", code: "RT_E_PROJECT_MISSING" };
        try {
          const next = await deepenResearchEngine(p, phase);
          set((s) => ({
            projects: s.projects.map((x) => (x.id === id ? rebaseUserFields(next, x) : x)),
          }));
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      }),
      runVerifyAsync: async (id: string) => {
        const p = get().projects.find((x) => x.id === id);
        if (!p) return { ok: false, error: "Project not found.", code: "RT_E_PROJECT_MISSING" };
        const source = p.generatedSource ?? "";
        if (typeof source !== "string" || source.trim().length === 0) {
          return {
            ok: false,
            error: "No generated source to verify (P6 has not produced a module).",
          };
        }
        try {
          const outcome = await verifyAndFix(source, p.brief, { maxIterations: 3 });
          if (outcome.status === "error" || outcome.status === "not-configured") {
            return {
              ok: false,
              status: outcome.status,
              iterations: outcome.iterations,
              error: outcome.evidence,
            };
          }
          const fresh = get().projects.find((x) => x.id === id);
          if (!fresh) return { ok: false, error: "Project not found." };
          const applied = applyVerifyOutcome(fresh, outcome as never);
          set((s) => ({
            projects: s.projects.map((x) => (x.id === id ? rebaseUserFields(applied, x) : x)),
          }));
          return {
            ok: true,
            status: outcome.status,
            iterations: outcome.iterations,
          };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
      // fixes/150 (M4 ms4 — watchdog mirror): async P6-journey face for the
      // console/UI. headless.ts is server-only (node:fs at module top), so the
      // import happens HERE at call time — the client bundle never statically
      // pulls headless in; keyless runs commit nothing (byte-identical
      // passthrough), converged/failed runs commit via rebaseUserFields so
      // user-owned fields (name/notes/chatLog/toggles) survive the commit.
      runP6Journey: async (id, opts) => {
        const p = byId(get().projects, id);
        if (!p) return { ok: false, error: "Project not found.", code: "RT_E_PROJECT_MISSING" };
        // fixes/150 (integration): headless.ts statically imports node:fs and is
        // server-only — it must NEVER enter the browser bundle (the H2 crash
        // class + the import-protection build guard). The spec is assembled at
        // runtime (the concatenated idiom, as engine.ts does for its server
        // probes) so rolldown cannot statically pull headless into the client
        // graph; in the browser the import itself fails (the module is not in
        // the bundle) and the catch below returns the honest refusal; node
        // (tests, CLI-hosted) resolves + runs the real driveP6Journey.
        try {
          const headlessSpec = "./headless." + "ts";
          const headless = (await import(headlessSpec)) as {
            driveP6Journey?: (
              project: Project,
              o: { budget?: number; deps?: unknown },
            ) => Promise<P6JourneySurface>;
          };
          if (typeof headless.driveP6Journey !== "function") {
            return { ok: false, error: "P6 journey backend unavailable in this runtime." };
          }
          const res = await headless.driveP6Journey(p, {
            budget: opts?.budget,
            deps: opts?.deps as unknown,
          });
          if (res.outcome !== "keyless") {
            const fresh = byId(get().projects, id);
            if (!fresh) return { ok: false, error: "Project not found." };
            set((s) => ({
              projects: s.projects.map((x) =>
                x.id === id ? rebaseUserFields(res.project, fresh) : x,
              ),
            }));
          }
          return {
            ok: true,
            outcome: res.outcome,
            cycles: res.cycles,
            budget: res.budget,
            gate: res.gate,
          };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
      hydrated: false,
      autopilot: false,
      demoSeeded: false,
      llmStatus: { configured: false, label: "deterministic engine" },
      researchStatus: { configured: false, label: "not configured" },
      setHydrated: (v) => set({ hydrated: v }),
      setAutopilot: (v) => set({ autopilot: v }),
      // P10: per-project hard-DoD opt-in (off by default — advisory unchanged).
      setEnforceDod: (id, on) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, enforceDod: on } : p)),
        })),
      // P13: Wild Mode opt-in + run lifecycle.
      setWildMode: (id, on) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, wildMode: on, wildRun: on ? p.wildRun : null } : p,
          ),
        })),
      startWildRun: async (id) => {
        // PB-04: single-flight latch — the rt-client latch guards against a
        // double-click racing two loops before the state commit lands.
        if (!tryStartWild(id)) {
          return {
            ok: false,
            ran: 0,
            stoppedReason: null,
            error: "A wild start is already in flight for this project.",
            code: "RT_E_PHASE_ILLEGAL",
          };
        }
        try {
        const p = get().projects.find((x) => x.id === id);
        if (!p)
          return {
            ok: false,
            ran: 0,
            stoppedReason: null,
            error: "Project not found.",
            code: "RT_E_PROJECT_MISSING",
          };
        if (p.wildMode !== true)
          return {
            ok: false,
            ran: 0,
            stoppedReason: null,
            error: "Wild Mode is not enabled for this project.",
            code: "RT_E_PHASE_ILLEGAL",
          };
        if (p.wildRun?.active) {
          // PA-01: a PAUSED active run is a run whose driver exited —
          // re-entering the loop here is exactly the resume path
          // (toggleWildPause cleared pause). An UNPAUSED active run is a
          // genuine double-start and stays refused.
          if (p.wildRun.pause !== true) {
            return {
              ok: false,
              ran: 0,
              stoppedReason: null,
              error: "A wild run is already active.",
              code: "RT_E_PHASE_ILLEGAL",
            };
          }
          // fall through: resumed run — the started block below re-stamps the
          // active surface and keeps startedAt/lastAutoAt (PA-01).
        }
        if (p.status === "complete")
          return {
            ok: false,
            ran: 0,
            stoppedReason: "complete",
            error: "Project already complete.",
            code: "RT_E_PHASE_ILLEGAL",
          };
        // PA-01: a paused active run resumes its own epoch (runRef stability
        // for telemetry correlation = String(wildRun.startedAt)); a fresh or
        // stopped run mints a new one.
        const resuming = p.wildRun?.active === true && p.wildRun.pause === true;
        const started: Project = {
          ...p,
          wildRun: {
            active: true,
            phase: p.currentPhase,
            startedAt: resuming ? p.wildRun!.startedAt : Date.now(),
            lastAutoLog: resuming
              ? `Wild run resumed at P${p.currentPhase}`
              : `Wild run started at P${p.currentPhase}`,
            lastAutoAt: Date.now(),
            stoppedAt: null,
            pause: false,
          },
        };
        // Audit-31: every machine decision is ledgered, nothing is silent.
        const withStartLog = wildLog(
          started,
          p.currentPhase,
          "info",
          resuming ? "wild.resume" : "wild.start",
          resuming
            ? `Wild Mode run resumed at P${p.currentPhase}.`
            : `Wild Mode run started at P${p.currentPhase}.`,
        );
        // audit-43 P1-1: every commit rebases onto the LIVE store state and
        // never resurrects a deleted project (same discipline as the other
        // async actions) — a concurrent operator edit or async action must
        // never be silently rolled back by a stale whole-project set().
        // fixes/115 H-06: `prev` is the generation the step was computed FROM
        // (the last project committed to the store). While the step awaited, a
        // concurrent writer (ingestReport/approve/deepenResearch/...) may have
        // APPENDED engine-owned rows to the live record — rebaseConcurrentEngine
        // unions exactly those rows (live rows absent from `prev`) into the
        // commit, so a wild step can never roll back an ingest or approval that
        // landed mid-flight. The MERGED project is returned so the driver loop
        // continues from the merged generation (prev ⊆ live then holds, and no
        // adopted row is ever unioned twice).
        const commitWild = (next: Project, prev: Project | null): Project | null => {
          let committedMerged: Project | null = null;
          set((s) => {
            const live = byId(s.projects, id);
            if (!live) return s; // deleted mid-run — never resurrect
            const rebased = rebaseUserFields(next, live);
            const merged = prev ? rebaseConcurrentEngine(rebased, prev, live) : rebased;
            committedMerged = merged;
            return { projects: s.projects.map((x) => (x.id === id ? merged : x)) };
          });
          return committedMerged;
        };
        commitWild(withStartLog, null);
        let ran = 0;
        try {
          // Bounded driver loop (engine documents the loop as the caller's
          // job): step until the run parks (pause/error) or completes. Cap =
          // 20 steps so a stuck project can never spin the caller.
          let cur = withStartLog;
          for (let step = 0; step < 20; step++) {
            const prev = cur; // the generation this step is computed from
            const res = await wildStep(cur);
            const merged = commitWild(res.project, prev);
            // Continue from the MERGED generation, not the raw step output:
            // the next step's input then already carries the concurrent rows
            // this commit adopted, so a later union can never re-add them.
            cur = merged ?? res.project;
            if (!res.ran) break;
            ran += 1;
            if (cur.wildRun?.pause) {
              // Carry the pause class from the step that parked the run (B5).
              return { ok: true, ran, stoppedReason: "paused", code: res.code };
            }
            if (cur.status === "complete") {
              return { ok: true, ran, stoppedReason: "complete" };
            }
            if (!cur.wildRun?.active) {
              return { ok: true, ran, stoppedReason: null };
            }
          }
          const capped = wildPause(cur, cur.currentPhase, "warn", "wild.cap", "Wild loop step cap (20) reached — run parked.");
          commitWild(capped, cur);
          return { ok: true, ran, stoppedReason: "cap" };
        } catch (e) {
          // audit-43 P1-1: report the steps that ACTUALLY ran — never a
          // fabricated ran:0 after progress was committed.
          return {
            ok: false,
            ran,
            stoppedReason: null,
            error: String(e),
            code: "RT_E_INTERNAL",
          };
        } finally {
          // PB-04: release the single-flight latch once the loop ends so a
          // paused run's resume can re-enter (the auto-expiry is the backstop).
          releaseWildStart(id);
        }
        } finally {
          // 174-2: early returns (missing project / wildMode off / already
          // active / complete) must also release the latch.
          releaseWildStart(id);
        }
      },
      stopWildRun: (id) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id && p.wildRun
              ? { ...p, wildRun: { ...p.wildRun, active: false, stoppedAt: Date.now(), pause: false } }
              : p,
          ),
        })),
      toggleWildPause: (id) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id && p.wildRun && p.wildRun.active
              ? { ...p, wildRun: { ...p.wildRun, pause: !p.wildRun.pause } }
              : p,
          ),
        })),
      create: (brief, name) => {
        const project = emptyProject({
          brief,
          name: name?.trim() || inferName(brief),
        });
        set((s) => ({
          projects: [project, ...s.projects],
          activeId: project.id,
          demoSeeded: true,
        }));
        return project.id;
      },
      // ST-5: reject ids that do not exist — a persisted activeId pointing at a
      // deleted project must not leave the UI pointing at nothing.
      select: (id) =>
        set((s) => ({ activeId: id !== null && byId(s.projects, id) ? id : null })),
      execute: (id) => {
        const project = byId(get().projects, id);
        if (!project) return { ok: false, error: "Project missing." };
        const next = advanceOnce(project, get().autopilot);
        if (next.error && (next.project === project || next.gateDenied || next.dodBlocked)) {
          // E-20: an autopilot DoD-denial is still a 0-progress stop (ok:false,
          // same error text) — but its machine-readable gate_denied log is
          // persisted so the park carries a reason. P10 parity: a hard-DoD
          // block persists its artifact + dod.blocked log the same way.
          if ((next.gateDenied || next.dodBlocked) && next.project !== project) {
            set((s) => ({
              projects: s.projects.map((p) => (p.id === id ? next.project : p)),
            }));
          }
          return { ok: false, error: next.error };
        }
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? next.project : p)),
        }));
        return { ok: true };
      },
      runUntilHitl: (id) => {
        const start = byId(get().projects, id);
        if (!start) return { ok: false, ran: 0, stoppedReason: null, error: "Project missing." };
        let current = start;
        let ran = 0;
        let error: string | undefined;
        let stoppedReason: RunStopReason = null;
        // B-24: the loop bound derives from the graph, not a magic constant. Worst case every
        // remaining phase parks a HITL that autopilot approves (~2 iterations per phase) + 2 margin.
        const maxRuns = (13 - start.currentPhase) * 2 + 2;
        for (let i = 0; i < maxRuns; i++) {
          const next = advanceOnce(current, get().autopilot);
          if (next.error && (next.project === current || next.gateDenied || next.dodBlocked)) {
            // E-20: a gate_denied park carries its denial log on the project
            // (persisted below) but still counts as a 0-progress stop. P10: a
            // hard-DoD block does the same with its artifact + dod.blocked log.
            if ((next.gateDenied || next.dodBlocked) && next.project !== current) current = next.project;
            // B-13: surface the stop honestly instead of pretending a partial run succeeded.
            error = next.error;
            stoppedReason = next.dodBlocked
              ? "dod"
              : current.status === "awaiting_hitl"
                ? "hitl"
                : current.status === "blocked"
                  ? "blocked"
                  : current.status === "complete"
                    ? "complete"
                    : "error";
            break;
          }
          current = next.project;
          ran++;
          if (current.status === "awaiting_hitl" && !canAutopilot(current, get().autopilot)) {
            stoppedReason = "hitl";
            break;
          }
          if (current.status === "complete") {
            stoppedReason = "complete";
            break;
          }
          if (current.status === "blocked") {
            stoppedReason = "blocked";
            break;
          }
        }
        // B-24: defensive ceiling — visible stop reason, never a silent truncation.
        if (!stoppedReason) stoppedReason = "cap";
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? current : p)),
        }));
        // B-13 contract: ok requires progress. A run that stopped at 0 iterations (already
        // waiting on a gate, blocked, complete, or errored on entry) reports ok:false with the
        // honest stoppedReason + error; partial runs (>=1 phase advanced) stay ok:true even when
        // the stop was an error or the defensive cap.
        // 185-H1 / 204: ok:true never carries `error` — surface stop detail as `note`.
        const progressed = ran > 0;
        if (progressed) return { ok: true, ran, stoppedReason, ...(error ? { note: error } : {}) };
        return { ok: false, ran, stoppedReason, error: error ?? "Run made no progress." };
      },
      // LLM-GAP-1 (async engine path): await the live engine when configured,
      // fall back to the deterministic sync runner otherwise. Same public result
      // shape as `execute`, so callers treat both identically. ST-6: serialized
      // per project so an overlap never commits a stale snapshot over a newer run.
      executeAsync: (id) =>
        serialized(id, async () => {
          const project = byId(get().projects, id);
          if (!project) return { ok: false, error: "Project missing.", code: "RT_E_PROJECT_MISSING" };
          const configured = get().llmStatus.configured || get().researchStatus.configured;
          const next = await advanceOnceAsync(project, get().autopilot, configured);
          if (next.error && (next.project === project || next.gateDenied || next.dodBlocked)) {
            // E-20: persist the denial log (see execute); still a 0-progress stop.
            // T0.3 (fixes/162): a hard-DoD block must NOT commit as ok:true —
            // match sync execute / runUntilHitlAsync (store.ts:1143 / :1262).
            if ((next.gateDenied || next.dodBlocked) && next.project !== project) {
              set((s) => {
                const live = byId(s.projects, id);
                if (!live) return s;
                return {
                  projects: s.projects.map((p) => (p.id === id ? next.project : p)),
                };
              });
            }
            return { ok: false, error: next.error };
          }
          set((s) => {
            const live = byId(s.projects, id);
            if (!live) return s; // deleted mid-run — never resurrect
            return {
              projects: s.projects.map((p) => {
                if (p.id !== id) return p;
                const committed = rebaseUserFields(next.project, live);
                // 174-1: do not clobber an in-flight wild run with a stale execute snapshot.
                if (live.wildRun?.active === true) return { ...committed, wildRun: live.wildRun };
                return committed;
              }),
            };
          });
          return { ok: true };
        }),
      runUntilHitlAsync: (id) =>
        serialized(id, async () => {
          const start = byId(get().projects, id);
          if (!start) return { ok: false, ran: 0, stoppedReason: null, error: "Project missing." };
          const configured = get().llmStatus.configured || get().researchStatus.configured;
          let current = start;
          let ran = 0;
          let error: string | undefined;
          let stoppedReason: RunStopReason = null;
          const maxRuns = (13 - start.currentPhase) * 2 + 2;
          for (let i = 0; i < maxRuns; i++) {
            const next = await advanceOnceAsync(current, get().autopilot, configured);
            if (next.error && (next.project === current || next.gateDenied || next.dodBlocked)) {
              // E-20: a gate_denied park carries its denial log on the project
              // (persisted below) but still counts as a 0-progress stop. P10: a
              // hard-DoD block does the same with its artifact + dod.blocked log.
              if ((next.gateDenied || next.dodBlocked) && next.project !== current) current = next.project;
              error = next.error;
              stoppedReason = next.dodBlocked
                ? "dod"
                : current.status === "awaiting_hitl"
                  ? "hitl"
                  : current.status === "blocked"
                    ? "blocked"
                    : current.status === "complete"
                      ? "complete"
                      : "error";
              break;
            }
            current = next.project;
            ran++;
            if (current.status === "awaiting_hitl" && !canAutopilot(current, get().autopilot)) {
              stoppedReason = "hitl";
              break;
            }
            if (current.status === "complete") {
              stoppedReason = "complete";
              break;
            }
            if (current.status === "blocked") {
              stoppedReason = "blocked";
              break;
            }
          }
          if (!stoppedReason) stoppedReason = "cap";
          set((s) => {
            const live = byId(s.projects, id);
            if (!live) return s; // deleted mid-run — never resurrect
            return {
              projects: s.projects.map((p) => (p.id === id ? rebaseUserFields(current, live) : p)),
            };
          });
          const progressed = ran > 0;
          // 185-H1 / 204: ok:true never carries `error` — stop detail is `note`.
          if (progressed) return { ok: true, ran, stoppedReason, ...(error ? { note: error } : {}) };
          return { ok: false, ran, stoppedReason, error: error ?? "Run made no progress." };
        }),
      // Real bounded execution of the P6 generated module (opt-in; the runner is
      // a bounded local process, NOT a security sandbox). Appends an honest
      // "Real module run" artifact + log; never mutates phase status. ST-6:
      // serialized per project like the other async actions.
      runModuleReal: (id) =>
        serialized(id, async () => {
          const project = byId(get().projects, id);
          if (!project) return { ok: false, result: null, error: "Project missing." };
          try {
            const out = await runP6Real(project);
            if (out.ok && out.result) {
              const r = out.result;
              const now = Date.now();
              const body = r.ok
                ? `exit code ${r.exitCode} (${r.durationMs}ms)\n\nstdout:\n${r.stdout}\n\nstderr:\n${r.stderr}`
                : `not run / failed: ${r.reason}${r.error ? ` — ${r.error}` : ""}`;
              const detail = r.ok
                ? `exit ${r.exitCode} in ${r.durationMs}ms — ${(r.stdout || "").slice(0, 200) || "(no stdout)"}`
                : `${r.reason}${r.error ? `: ${r.error}` : ""}`;
              const logEntry: JsonLog = {
                ts: now,
                phase: 6 as PhaseId,
                level: r.ok ? "info" : "warn",
                event: "runner.real",
                detail,
              };
              // G2 (production-readiness): honor runP6Real's re-stamped project —
              // lastTest/gate state must reflect the REAL run, never the stale
              // pre-run snapshot, or DoD p6-test can read green while it failed.
              const base = out.project ?? project;
              const artifact: Artifact = {
                id: `run-${id}-${now}`,
                phase: 6 as PhaseId,
                kind: "docs",
                title: "Real module run (bounded)",
                body,
              };
              // audit-31 P1: converge the REAL shape into the recorded DoD
              // state — a failing exit code must flip the recorded P6 verdict
              // to FAIL (convergeRealRun re-evaluates PhaseRecord.gate + the
              // gate artifact/log against the re-stamped project).
              const updated = convergeRealRun(base, artifact, logEntry);
              set((s) => {
                const live = byId(s.projects, id);
                if (!live) return s; // deleted mid-run — never resurrect
                return {
                  projects: s.projects.map((p) => (p.id === id ? rebaseUserFields(updated, live) : p)),
                };
              });
              return { ok: true, result: r };
            }
            return { ok: false, result: out.result, error: "bounded runner unavailable or no generated module" };
          } catch (err) {
            return { ok: false, result: null, error: err instanceof Error ? err.message : String(err) };
          }
        }),
      // Ingest an external agent's report (the two-way packet path). Validates
      // first (never touches state on malformed input), then applies as
      // clearly-marked "[agent report]" artifacts + a log. Gate advancement stays
      // with approve/execute — this is pure intake.
      ingestReport: (id, raw) => {
        const project = byId(get().projects, id);
        if (!project) return { ok: false, error: "Project missing." };
        const v = validateReport(raw, project.currentPhase);
        if (!v.ok) return { ok: false, error: v.error };
        // M-05/E-01: validateReport now forwards tests_run (SWEEP-2 + E-01), so the
        // typed report is authoritative — no raw-payload shim needed anymore.
        const hasTestEvidence = (v.report.tests_run?.length ?? 0) > 0;
        const warnNoEvidence = v.report.status === "complete" && !hasTestEvidence;
        // E-09 envelope honesty: the idempotency verdict is computed from the
        // read snapshot (a sync action cannot interleave) so the caller can
        // surface a duplicate retry (applied:false) instead of guessing. The
        // apply below still runs inside the updater on the freshest record —
        // identical here, since the read and the set are one synchronous turn.
        const result = applyReportResult(project, v.report);
        const gateUnmet = result.applied ? reportGateDelta(project, v.report) : [];
        // ST-6: validate against the read snapshot (sync — cannot interleave), but
        // APPLY inside the updater so the artifacts/logs are computed from the
        // freshest record for the id (never a stale pre-run snapshot).
        set((s) => {
          const live = byId(s.projects, id);
          if (!live) return s; // removed between read and apply — drop the intake
          let updated = applyReportResult(live, v.report).project;
          if (warnNoEvidence) {
            const warnEntry: JsonLog = {
              ts: Date.now(),
              phase: live.currentPhase,
              level: "warn",
              event: "agent.report",
              detail: "complete report with no tests_run evidence",
            };
            updated = { ...updated, logs: [...updated.logs, warnEntry].slice(-200) };
          }
          return { projects: s.projects.map((p) => (p.id === id ? updated : p)) };
        });
        return {
          ok: true,
          applied: result.applied,
          reason: result.reason,
          ...(gateUnmet.length > 0 ? { gate_unmet: gateUnmet } : {}),
        };
      },
      hasProject: (id) => Boolean(byId(get().projects, id)),
      // Best-effort status probe (in-memory, never persisted): reads llmStatus()
      // and the research backend's status when those modules exist; degrades to
      // the honest "not configured" default otherwise.
      refreshStatuses: async () => {
        const llm: LlmStatusSurface = { configured: false, label: "deterministic engine" };
        const research: ResearchStatusSurface = { configured: false, label: "not configured" };
        try {
          const mod = await import("./llm.ts");
          const fn = (mod as { llmStatus?: unknown }).llmStatus;
          if (typeof fn === "function") {
            const s = await (fn as () => Promise<unknown> | unknown)();
            if (s && typeof s === "object") {
              const anyS = s as { configured?: unknown; model?: unknown; label?: unknown };
              llm.configured = Boolean(anyS.configured);
              if (typeof anyS.model === "string" && anyS.model) llm.model = anyS.model;
              llm.label = anyS.configured
                ? (llm.model ?? "configured")
                : typeof anyS.label === "string" && anyS.label
                  ? anyS.label
                  : "deterministic engine";
            }
          }
        } catch {
          // llm.ts not present yet — deterministic engine.
        }
        try {
          const mod = await import("./research.ts");
          const probe = (mod as { researchStatus?: unknown; isResearchConfigured?: unknown });
          const fn = probe.researchStatus ?? probe.isResearchConfigured;
          if (typeof fn === "function") {
            const s = await (fn as () => Promise<unknown> | unknown)();
            if (s && typeof s === "object") {
              research.configured = Boolean((s as { configured?: unknown }).configured);
              const lbl = (s as { label?: unknown }).label;
              if (typeof lbl === "string" && lbl.trim()) research.label = lbl.trim();
            } else if (typeof s === "boolean") {
              research.configured = s;
            }
          }
        } catch {
          // research.ts not present yet — deterministic fallback.
        }
        if (research.configured && research.label === "not configured") {
          research.label = "configured";
        }
        set({ llmStatus: llm, researchStatus: research });
      },
      approve: (id, opts) => {
        const project = byId(get().projects, id);
        if (!project) return { ok: false, error: "Project missing." };
        if (!project.hitl) return { ok: false, error: "No pending approval." };
        if (project.hitl.phase !== project.currentPhase) {
          return { ok: false, error: "HITL phase does not match the current edge." };
        }
        // R3/B-03: a failing P6 sandbox is human-only — the operator must explicitly tick the
        // override checkbox; autopilot can never reach here (canAutopilot excludes forceHuman).
        if (
          project.hitl.forceHuman &&
          project.currentPhase === 6 &&
          project.lastTest &&
          !project.lastTest.ok &&
          !opts?.force
        ) {
          return {
            ok: false,
            error: "Failing sandbox output requires explicit override — tick 'I reviewed the failure'.",
          };
        }
        // DF-09 (W23 L6 · 249 SPEC 1): a forced override of a FAILED P6 sandbox is a
        // red gate a human waves through — it must carry a caller-supplied rationale
        // (≥12 trimmed chars, the SAME floor the reject path below enforces). Refused
        // HERE as a typed refusal; the engine's approveHitl throws the same verdict as
        // coded RT_E_VALIDATION for every non-store caller (defense in depth). A
        // rubber-stamp override is never ledger'd.
        const rationale = (opts?.note ?? "").trim();
        if (
          opts?.force &&
          project.currentPhase === 6 &&
          project.lastTest &&
          !project.lastTest.ok &&
          rationale.length < 12
        ) {
          return {
            ok: false,
            error:
              "Overriding a FAILED P6 sandbox requires a rationale — at least 12 characters (pass { note }).",
          };
        }
        // Engine stamps the packet + packet artifact + A4 trace on approval (B-19); the journal
        // entry records the human actor (T2).
        const approved = approveHitl(project, {
          decidedBy: "human",
          force: opts?.force,
          requestedAt: opts?.requestedAt,
          note: opts?.note,
        });
        // T8: the just-approved gate phase gets its DoD verdict recorded too.
        const recorded = recordGate(approved, project.currentPhase);
        // ST-1: re-stamp AFTER the gate verdict so the packet's System JSON
        // `gate_passed` for the just-approved phase is fresh (approveHitl stamps
        // first, before the verdict exists).
        const updated = stampPacket(recorded);
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? updated : p)),
        }));
        return { ok: true };
      },
      reject: (id, note) => {
        if (note.trim().length < 12) return { ok: false, error: "Rejection requires at least 12 characters of feedback." };
        const project = byId(get().projects, id);
        if (!project) return { ok: false, error: "Project missing." };
        if (!project.hitl) return { ok: false, error: "No pending approval." };
        // ST-2: mirror the approve() phase-match guard so a stale/duplicated hitl
        // object cannot be rejected out-of-phase.
        if (project.hitl.phase !== project.currentPhase) {
          return { ok: false, error: "HITL phase does not match the current edge." };
        }
        if (project.phases[project.currentPhase]?.status !== "awaiting_hitl") {
          return { ok: false, error: "Phase is not awaiting approval." };
        }
        const updated = rejectHitl(project, note.trim());
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? updated : p)),
        }));
        return { ok: true };
      },
      // Async rejection: same guards + rejection as `reject`, plus a best-effort
      // LLM interpretation of the feedback into actionable guidance (config-gated,
      // never blocks the rejection). Guidance lands as a clearly-marked artifact.
      // ST-6: serialized so the guidance commit never races a run's commit.
      rejectAsync: (id, note) =>
        serialized(id, async () => {
          const base = get().reject(id, note);
          if (!base.ok) return base;
          try {
            const project = byId(get().projects, id);
            if (project && get().llmStatus.configured) {
              const fb = await interpretFeedback(note.trim(), phaseDef(project.currentPhase).title);
              if (fb.ok) {
                const now = Date.now();
                const logEntry: JsonLog = {
                  ts: now,
                  phase: project.currentPhase,
                  level: "info",
                  event: "llm.guidance",
                  detail: "rejection feedback interpreted",
                };
                const updated: Project = {
                  ...project,
                  artifacts: [
                    ...project.artifacts,
                    { id: `guidance-${id}-${now}`, phase: project.currentPhase, kind: "docs", title: "Rejection guidance (LLM)", body: fb.guidance },
                  ],
                  logs: [...project.logs, logEntry].slice(-200),
                };
                set((s) => {
                  const live = byId(s.projects, id);
                  if (!live) return s; // deleted mid-flight — never resurrect
                  return {
                    projects: s.projects.map((p) => (p.id === id ? rebaseUserFields(updated, live) : p)),
                  };
                });
              }
            }
          } catch {
            /* guidance optional — never block the rejection */
          }
          return { ok: true };
        }),
      retry: (id) => {
        const project = byId(get().projects, id);
        if (!project) return;
        const updated = unlockRetry(project);
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? updated : p)),
        }));
      },
      remove: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),
      clone: (id) => {
        const project = byId(get().projects, id);
        if (!project) return null;
        // B-08: clone = full snapshot with a fresh identity — deep copy, never an empty fork.
        let copy: Project;
        try {
          copy = structuredClone(project);
        } catch {
          copy = JSON.parse(JSON.stringify(project)) as Project;
        }
        copy.id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `p-${Date.now()}`;
        copy.name = `${project.name} (copy)`;
        copy.createdAt = Date.now();
        copy.logs = [
          ...copy.logs,
          {
            ts: Date.now(),
            phase: copy.currentPhase,
            level: "info" as const,
            event: "project.cloned",
            detail: project.id,
          },
        ].slice(-200);
        set((s) => ({ projects: [copy, ...s.projects], activeId: copy.id, demoSeeded: true }));
        return copy.id;
      },
      rename: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
        }));
      },
      setNotes: (id, notes) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, notes } : p)),
        })),
      // P0-2: append chat rows to one project's persisted thread. Additive only —
      // never replaces the log, never touches other projects. The cap trims on
      // write (headroom: the pane renders ≤12 rows and the model sees ≤6 turns,
      // so a reload shows more history than either consumer). Rows are trusted
      // caller data (the ChatPane maps its own sanitized views); hostile shapes
      // are still bounded by the cap.
      appendChatRows: (id, rows) => {
        const list = Array.isArray(rows) ? rows : [];
        if (list.length === 0) return;
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? { ...p, chatLog: [...(p.chatLog ?? []), ...list].slice(-40) }
              : p,
          ),
        }));
      },
      refreshPacket: (id) => {
        const project = byId(get().projects, id);
        if (!project) return;
        // B-06/B-19: delegate to the engine stamp — packet string, packet artifact, and the
        // A4 trace are refreshed in one pass (traces are replaced with fresh A1..A8+A4).
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? stampPacket(p) : p)),
        }));
      },
      exportProject: (id) => {
        const project = byId(get().projects, id);
        return project ? exportProjectJson(project) : null;
      },
      importProject: (json) => {
        const parsed = parseProjectJson(json);
        if (!parsed.ok) return { ok: false, error: parsed.error };
        const project = parsed.project;
        // Add/replace: importing a project with an id already in the store
        // replaces it in place; otherwise the import is prepended. Either way
        // it becomes the active build.
        let replaced = false;
        set((s) => {
          const exists = s.projects.some((p) => p.id === project.id);
          replaced = exists;
          return {
            projects: exists
              ? s.projects.map((p) => (p.id === project.id ? project : p))
              : [project, ...s.projects],
            activeId: project.id,
            demoSeeded: true,
          };
        });
        return { ok: true, id: project.id, name: project.name, replaced };
      },
      seedIfEmpty: () => {
        if (!get().hydrated) return;
        const projects = get().projects;
        if (Array.isArray(projects) && projects.length > 0) {
          // H4: repair only repairable entries (see isRepairableProjectEntry) —
          // a corrupt persisted row must never crash the repair map.
          set((s) => ({
            projects: (Array.isArray(s.projects) ? s.projects : [])
              .filter(isRepairableProjectEntry)
              .map((p) => hydrateProject(p)),
          }));
          return;
        }
        // H4: a persisted `projects` value that is not an array is corrupt —
        // drop it and fall through to the demo seed instead of crashing on
        // `.length`/`.map` (the old code threw out of the hydration callback).
        if (!Array.isArray(projects)) {
          set({ projects: [], demoSeeded: false });
        }
        // ST-3: seed the demo exactly once per storage — never resurrect it after
        // the operator archived the last build (or after any explicit create/clone/import).
        if (get().demoSeeded) return;
        const project = emptyProject({
          name: "Northwind Dispatch",
          brief:
            "Build a field-service dispatch board for a regional HVAC shop: jobs, techs, parts, and same-day reroutes. Same-day SLA, offline warehouse scan.",
        });
        set({ projects: [project], activeId: project.id, demoSeeded: true });
      },
    }),
    persistOptions,
  ),
);
