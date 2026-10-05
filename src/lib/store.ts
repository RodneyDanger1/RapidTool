import { create } from "zustand";
import { persist, type PersistOptions, type PersistStorage, type StorageValue } from "zustand/middleware";
import {
  applyPhaseResult,
  approveHitl,
  emptyProject,
  hydrateProject,
  inferName,
  readWildPlan,
  rejectHitl,
  runP6Real,
  stageWildPlan,
  stampPacket,
  unlockRetry,
  verifyPriorPhases,
  wildLog,
  wildOperatorPark,
  wildPause,
  wildStep,
  // PB-03 (E-13 seam): deepenResearch is imported under an alias so the store's
  // own public action below can share the name without shadowing the engine fn.
  deepenResearch as deepenResearchEngine,
} from "./engine.ts";
import { canEnter, PHASE_LAST, priorsSealed, phaseDef, STOCK_HITL } from "./phases.ts";
import { clientSafeServerSpecifier } from "./server-spec.ts";
import { gateArtifact, hardDodBlockInto, hardDodMessage, runGate } from "./dod.ts";
import { exportProjectJson, importProject as parseProjectJson } from "./io.ts";
import { validateReport, applyReportResult, reportGateDelta, type ReportApplyReason } from "./report-intake.ts";
import { interpretFeedback } from "./llm-tasks.ts";
import { verifyAndFix, applyVerifyOutcome } from "./verify.ts";
import { peekStall, releaseWildStart, reportRt, tryStartWild } from "./rt-client.ts";
// fixes/346 P2-6: the watchdog resume seams now have a production consumer — the
// store wild driver's resume branch refuses a silent re-entry when the stall
// latch requires an explicit human act (or crossed the 2× pause-on-resolve tier).
import { requiresHumanResume, shouldAutopause } from "./watchdog.ts";
import { WILD_STEP_BUDGET_MS } from "./rt-events.ts";
// A1-12 (346 E4 → K3 writer step): the console asks the ONE seat policy for the
// truthful verdict on a browser human-seat claim (it has no out-of-band token),
// so the ledger can record what the bytes actually support instead of a bare
// human stamp. `seatLabel`/`seatTokenPath` are that seam's single-source
// provenance vocabulary (`[seat console]` tag + `decidedVia.tokenPath`).
import { evaluatePolicy, seatLabel, seatTokenPath } from "./policy.ts";
// R14-f01 (W33 lane F1): the Node-side Auto-Review supervisor binding — null
// on every host/key state that must keep the engine's existing default.
import { createNodeWildReviewer } from "./wild-review.ts";
import type {
  Artifact,
  ChatLogRow,
  JsonLog,
  PhaseId,
  Project,
  ResearchCorpusEntry,
  WildPlan,
} from "./types";
import { classifyError, type ErrorCode } from "./errors.ts";
// P1-5 (346 L2): the persisted-run-spend arithmetic is client-safe (token-ledger
// has no node: import). `accumulateSpend` folds ONE measured model call (or one
// wild step's session-ledger delta, 346 K3) into `Project.tokenUsage`;
// `SpendSlice` is that slot's shape.
import { accumulateSpend, type SpendSlice } from "./token-ledger.ts";

export type ApproveResult =
  | { ok: true }
  // C1 (334-5): the failure arm carries the RT_E class when one is genuinely
  // known (e.g. `executeAsync`'s RT_E_PROJECT_MISSING) so a call site can name
  // the class instead of showing prose alone. Optional ⇒ every existing arm and
  // consumer is byte-compatible.
  | { ok: false; error: string; code?: ErrorCode };

/** Why a runUntilHitl loop stopped: natural resting points (hitl/complete),
 *  intervention states (blocked), failures (error), the defensive loop cap,
 *  or a P10 hard-DoD block (dod). */
export type RunStopReason = "hitl" | "complete" | "blocked" | "error" | "cap" | "dod" | null;

export type RunResult =
  | { ok: true; ran: number; stoppedReason: RunStopReason; note?: string }
  // C1 (334-5): `code` is the run's machine-readable failure class — present
  // ONLY when genuinely known (never invented for an uncoded stop). The console
  // run surface renders it; the chip's keyed class comes from the validity
  // probe instead (a keyed 401 inside a run degrades to the deterministic floor
  // rather than failing the run, so it is not a `RunResult` failure class).
  | { ok: false; ran: number; stoppedReason: RunStopReason; error: string; code?: ErrorCode };

/** The key-unusable RT_E classes (C1 · 332-5): a key is PRESENT but the last
 *  keyed call was refused — a validity fault, not absence. Shared by the console
 *  chip and the run surface so both name the same class; never prose-matched. */
export const KEY_UNUSABLE_CODES: ReadonlySet<string> = new Set([
  "RT_E_LLM_KEY_REJECTED",
  "RT_E_LLM_KEY_SHADOWED",
]);

/**
 * C1 (334-5): the honest coded failure line. The result's OWN code wins; else
 * the last keyed-call refusal the validity probe saw (a keyed run can degrade to
 * the deterministic floor without failing, so the probe is the only truthful
 * witness); with neither, the raw error stands verbatim — no class is ever
 * invented, so the label can never out-claim what was measured.
 */
export function codedFailureText(
  error: string,
  ownCode?: string | null,
  lastKeyedCode?: string | null,
): string {
  const coded =
    (typeof ownCode === "string" && ownCode.length > 0 ? ownCode : null) ??
    (typeof lastKeyedCode === "string" && KEY_UNUSABLE_CODES.has(lastKeyedCode) ? lastKeyedCode : null);
  return coded ? `${coded} — ${error}` : error;
}

/**
 * C1 (334-5): the keyed-refusal class attributable to a run that started at
 * `startedAt` (epoch ms). The probe outcome must be key-unusable AND stamped at
 * or after the run's start — a stale pre-run refusal is NEVER blamed on this run
 * (333 F-4: the label may not out-claim the measurement). Null otherwise.
 */
export function keyedRefusalSince(
  startedAt: number,
  lastKeyed: LlmKeyedOutcome | null | undefined,
): string | null {
  if (!lastKeyed) return null;
  if (typeof lastKeyed.code !== "string" || !KEY_UNUSABLE_CODES.has(lastKeyed.code)) return null;
  if (typeof lastKeyed.at !== "number" || !Number.isFinite(lastKeyed.at) || lastKeyed.at < startedAt) {
    return null;
  }
  return lastKeyed.code;
}

/**
 * P1-5 (346 L2): project a model usage envelope (the `LlmUsage` a server fn
 * returns, e.g. `chatOnceServer`'s reply) onto the ONE-CALL persisted spend
 * slice the store folds into `Project.tokenUsage`. Returns null for an
 * absent/foreign/malformed envelope — the caller must then write NOTHING, so an
 * unmeasured run never gains a fabricated zero (the chip keeps saying "spend not
 * recorded"). Pure; exported so the mapping is unit-pinned without a browser.
 */
export function measuredSpendFromUsage(usage: unknown): SpendSlice | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;
  const p = u.promptTokens;
  const c = u.completionTokens;
  if (typeof p !== "number" || !Number.isFinite(p) || p < 0) return null;
  if (typeof c !== "number" || !Number.isFinite(c) || c < 0) return null;
  const cached = u.cachedPromptTokens;
  return {
    promptTokens: Math.floor(p),
    completionTokens: Math.floor(c),
    // A completed provider call is exactly one call — this slice is the DELTA,
    // so `accumulateSpend` adds 1 to the project's running count.
    calls: 1,
    ...(typeof cached === "number" && Number.isFinite(cached) && cached >= 0
      ? { cachedPromptTokens: Math.floor(cached) }
      : {}),
  };
}

/**
 * 346 K3 (console phase-run spend): fold ONE wild step's measured session-ledger
 * delta (the engine's `onUsage` sink) into the project's persisted
 * `Project.tokenUsage`. An absent/empty delta returns the SAME project
 * reference — no write at all, so a run that measured nothing never gains a
 * fabricated zero (the SpendChip keeps saying "spend not recorded"). Pure;
 * exported so the fold is unit-pinned without a browser.
 */
export function foldStepSpend(project: Project, step: SpendSlice | null | undefined): Project {
  if (!step || typeof step !== "object") return project;
  const measured =
    (typeof step.promptTokens === "number" && step.promptTokens > 0) ||
    (typeof step.completionTokens === "number" && step.completionTokens > 0) ||
    (typeof step.calls === "number" && step.calls > 0);
  if (!measured) return project;
  return { ...project, tokenUsage: accumulateSpend(project.tokenUsage, step) };
}

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
 * "stopped" (an external stop deactivated the run mid-loop — F3-05).
 * 185-H1/F3-06: ok:true NEVER carries a `code` — the pause class rides as
 * `note` (the headless/CLI convention); codes ride the refusal arm only.
 */
export type WildRunResult =
  | { ok: true; ran: number; stoppedReason: "paused" | "complete" | "cap" | "stopped" | null; note?: string }
  | { ok: false; ran: number; stoppedReason: "paused" | "complete" | "cap" | "stopped" | null; error: string; code?: ErrorCode };

export type ImportProjectResult =
  | { ok: true; id: string; name: string; replaced: boolean }
  // 319_f1: the refusal arm threads io.ImportResult.code end-to-end.
  | { ok: false; error: string; code?: ErrorCode };

/** One keyed-call outcome the server probe reports (C1 · 332-5). Never a key. */
export type LlmKeyedOutcome = { code: string; at: number; keySource?: string };

/**
 * C1 (332-5): validate the server probe's `lastKeyed` shape — a hostile or
 * partial payload is DROPPED, never trusted (the console's defensive posture
 * for every sibling result shape). Absent ⇒ undefined: the last keyed call
 * succeeded (or none was seen), so the chip stays `configured`.
 */
export function readLastKeyed(v: unknown): LlmKeyedOutcome | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as { code?: unknown; at?: unknown; keySource?: unknown };
  if (typeof o.code !== "string" || o.code.length === 0) return undefined;
  if (typeof o.at !== "number" || !Number.isFinite(o.at)) return undefined;
  return {
    code: o.code,
    at: o.at,
    ...(typeof o.keySource === "string" && o.keySource.length > 0 ? { keySource: o.keySource } : {}),
  };
}

/** In-memory surface for LLM wiring (never persisted — derived from llmStatus()). */
export type LlmStatusSurface = {
  configured: boolean;
  label: string;
  model?: string;
  /** C1 (332-5): the server probe's last keyed-call outcome — key VALIDITY,
   *  not presence. Absent when the last keyed call succeeded (or none was seen),
   *  so the chip honestly returns to `configured`. Never carries the key;
   *  `keySource` is a tail-only label. */
  lastKeyed?: LlmKeyedOutcome;
};
/** In-memory surface for the research backend (never persisted). */
export type ResearchStatusSurface = { configured: boolean; label: string };

type RapidState = {
  projects: Project[];
  activeId: string | null;
  hydrated: boolean;
  autopilot: boolean;
  /** L3-07 (346 E4): a persisted blob this build could not read was rescued to
   *  `<name>.rescue`. Set at hydration; the console renders a visible notice so
   *  the loss is never silent. Not persisted (excluded by partialize). */
  persistRecovery: { at: number; rescueKey: string } | null;
  dismissPersistRecovery: () => void;
  /** L3-02 (346 E4): the last cross-tab reconcile that adopted another tab's
   *  newer edits — `drifted` names projects whose operator/engine scalars were
   *  changed elsewhere (a clobber avoided). Shown as a warning; in-memory only. */
  crossTabNotice: { at: number; adopted: number; drifted: string[] } | null;
  dismissCrossTabNotice: () => void;
  /** L3-02 (346): project-deletion tombstones (the delete markers a cross-tab
   *  reconcile honours). Persisted, so a delete in one tab propagates to the
   *  others and a stale write cannot resurrect the project. Bounded. */
  projectTombstones: CrossTabTombstone[];
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
  /**
   * P1-5 (346 L2): fold ONE measured model call's usage (the `LlmUsage` a
   * server-fn envelope carried — today `chatOnceServer`'s reply) into the
   * project's persisted `tokenUsage`. Returns true only when a real measured
   * slice was written; an absent/foreign envelope is a NO-OP (false, no state
   * change) so a run that measured nothing never gains a fabricated zero.
   */
  recordSpend: (id: string, usage: unknown) => boolean;
  refreshPacket: (id: string) => void;
  exportProject: (id: string) => string | null;
  importProject: (json: string) => ImportProjectResult;
  seedIfEmpty: () => void;
  demoSeeded: boolean;
  llmStatus: LlmStatusSurface;
  researchStatus: ResearchStatusSurface;
  /** C1 (334-5): returns the fresh LLM surface so a caller (the run handlers)
   *  can read the just-observed keyed outcome without a second probe. */
  refreshStatuses: () => Promise<LlmStatusSurface>;
  executeAsync: (id: string) => Promise<ApproveResult>;
  runUntilHitlAsync: (id: string) => Promise<RunResult>;
  // PB-03 (E-13): deepen a completed research phase (P0/P7/P11) with live/web
  // research and re-record its gate. Name is in the console's DEEPEN_ACTION_NAMES
  // probe list, so the "Run live research (P7)" affordance resolves to this.
  deepenResearch: (
    id: string,
    phase: PhaseId,
  ) => Promise<{ ok: true } | { ok: false; error: string; code?: ErrorCode }>;
  /** fixes/135: run the machine-verify loop on the project's P6 module (UI path). */
  runVerifyAsync: (
    id: string,
  ) => Promise<
    | { ok: true; status?: string; iterations?: number; note?: string }
    | { ok: false; error: string; status?: string; iterations?: number; code?: ErrorCode }
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
    | { ok: false; error: string; code?: ErrorCode }
  >;
  runModuleReal: (
    id: string,
  ) => Promise<
    | { ok: true; result: unknown }
    | { ok: false; result: unknown; error: string; code?: ErrorCode }
  >;
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
        // C1 (334-5): the RT_E class of a refused intake (missing project /
        // malformed report) so the console can name it, not prose alone.
        code?: ErrorCode;
        applied?: boolean;
        reason?: ReportApplyReason;
        gate_unmet?: string[];
      };
  hasProject: (id: string) => boolean;
  /**
   * R13-f02 (W33 lane L2): the store's READ path for the plan-before-execute
   * surface (the console's "plan" line/section reads this). Returns the stored
   * `project.wildPlan` when the record carries one, else engine.readWildPlan's
   * HONEST EMPTY plan (`steps: []`, `source: "empty"`, note naming the row) —
   * and `null` when the id is unknown. READ-ONLY: no generation here (the
   * browser has no planner; generation is server-side — headless.generateWildPlan).
   */
  wildPlanFor: (id: string) => WildPlan | null;
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
 * W-23b (§R2-f02 · C1-f02 · 174-1 widened): a NON-driver commit computed from a
 * pre-wild snapshot must never clobber an in-flight wild run. rebaseUserFields
 * deliberately does not copy wildRun (engine-owned); the six non-driver commit
 * sites wrap their commit in this guard so a started/paused/stopped run (or a
 * run started mid-flight) survives. Only commitWild (the driver's own
 * generation) may own wildRun. Minimal condition (`active === true`) — the
 * phase-2 generalization is a separate scoped change, do not smuggle it in.
 */
function keepLiveWildRun(committed: Project, live: Project | undefined): Project {
  return live?.wildRun?.active === true ? { ...committed, wildRun: live.wildRun } : committed;
}

/**
 * R12-f05 (332-5) — edge-trigger state for the stale-run watchdog.
 *
 * The console's WildFeed watchdog evaluates the stale-run condition on every
 * heartbeat tick, and the real cadence (~11 s = WILD_POLL_MS × 10) is LARGER
 * than the §2.5 coalescing window (RT_COALESCE_MS = 5 000 ms). A repeating emit
 * therefore never merges — measured at the real cadence, three ticks wrote
 * three rows (the defect the coalescer could not absorb). The emitter must fire
 * ONCE when the run ENTERS the stale state and stay quiet for the episode; a
 * healthy tick resets the latch so the next episode reports again.
 *
 * Pure: `prev` is the caller's latch. Returns the next latch and whether to
 * emit this tick. The message itself stays coalescer-stable (seconds ride the
 * payload), so even two episodes cannot merge into a misleading count.
 */
export function staleEmitStep(prev: boolean, staleNow: boolean): { emit: boolean; next: boolean } {
  return { emit: staleNow && !prev, next: staleNow };
}

/** JSON for an object with recursively key-SORTED objects, so two rows with the
 *  same content but a different literal field order hash identically. Used for
 *  the concurrent-writer union keys (fixes/115 H-06); a row that is not a plain
 *  JSON value serializes to "" rather than throwing into the commit path. */
function canonicalKey(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        out[k] = sort((v as Record<string, unknown>)[k]);
      }
      return out;
    }
    return v;
  };
  try {
    return JSON.stringify(sort(value)) ?? "";
  } catch {
    return "";
  }
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
  // A log row's key must be INJECTIVE: the old `${ts}:${event}` collapsed two
  // distinct concurrent rows written in the same ms with the same event but a
  // different detail, so both were treated as already-seen and dropped. A
  // key-sorted JSON of the whole row distinguishes every field while staying
  // idempotent across re-applies (a merged row re-serializes identically).
  const logKey = (l: JsonLog): string => canonicalKey(l);
  const prevLogKeys = new Set((stepInput.logs ?? []).map(logKey));
  // The item-url list is deduped + sorted (deliberately order-insensitive), but
  // it must be encoded injectively: joining with "\n" made `items: []` and
  // `items: [{url: ""}]` collide. JSON.stringify of the list keeps the two
  // distinct (`[]` vs `[""]`) without making the key order-sensitive.
  const urlsOf = (items: readonly { url: string }[] | undefined): string =>
    JSON.stringify([...new Set((items ?? []).map((i) => i.url))].sort());
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
  // A3 (M3-18 · 308 hostile probe): a null/non-object base has no recorded
  // state to converge — return it unchanged (the same-reference no-op floor
  // applyVerifyOutcome uses for junk input) instead of a TypeError; a foreign
  // base with junk collections bounds them to [] instead of "not iterable".
  if (!base || typeof base !== "object") return base;
  const baseArtifacts = Array.isArray(base.artifacts) ? base.artifacts : [];
  const baseLogs = Array.isArray(base.logs) ? base.logs : [];
  // F6 (314 residue — the LAST M3 throw survivor, hostile probe case
  // `store.converge-junk-all` = convergeRealRun({},{},{})): `phases` gets the
  // same [] floor. recordGate reads `project.phases.find` FIRST, so a junk base
  // with no phases key threw past the artifacts/logs bounds above; with phases
  // bounded, recordGate's own not-complete guard (`!rec → return project`)
  // no-ops honestly instead of a TypeError.
  const basePhases = Array.isArray(base.phases) ? base.phases : [];
  const updated: Project = {
    ...base,
    phases: basePhases,
    artifacts: [...baseArtifacts, artifact],
    logs: [...baseLogs, log].slice(-200),
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
  // A20/A1-16: index by record id, not array position — a partial, unsorted,
  // or sparse phase array must never mis-seal the graph (phases.ts law).
  const rec = project.phases.find((p) => p.id === phase);
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
  if (rec.status === "complete" && phase < PHASE_LAST) {
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
  if (updated.status !== "awaiting_hitl" && phase < PHASE_LAST) {
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
    } catch (err) {
      // A1-19: "not configured" stays the quiet expected path; a THROW from
      // runPhaseAsync is not expected — keep the deterministic fallback but
      // stamp a coded warn row so the audit trail distinguishes a keyless run
      // from a broken keyed one (the engine's liveDegrade discipline).
      const fallback = applyPhaseResult(project, phase);
      return {
        ...fallback,
        logs: [
          ...(fallback.logs ?? []),
          {
            ts: Date.now(),
            phase,
            level: "warn" as const,
            event: "llm.degrade",
            detail: `runPhaseAsync failed (${classifyError(err)}) — deterministic floor used.`,
          },
        ].slice(-200),
      };
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
  // A20/A1-16: id-match (async mirror of advanceOnce's guard).
  const rec = project.phases.find((p) => p.id === phase);
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
  if (rec.status === "complete" && phase < PHASE_LAST) {
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

/** The persisted slice — exactly what partialize() writes to storage. The
 *  tombstone list is written ONLY when non-empty, so a legacy blob with no
 *  deletion is byte-identical to before. */
type PersistedSlice = Pick<RapidState, "projects" | "activeId" | "autopilot" | "demoSeeded"> & {
  projectTombstones?: CrossTabTombstone[];
};

/**
 * H4: the quota-salvage write's caps. They bound logs/chatLog — the two
 * fields the engine append-trims (200 / 40 via RESCUE_LOG_CAP and
 * CHAT_LOG_MAX_ROWS) — so a salvage write loses nothing the engine would not
 * have trimmed on its next append anyway, while keeping the persisted
 * snapshot valid JSON the next reload can hydrate.
 *
 * A1-17: this does NOT make a payload quota-proof — decisions/memory/
 * artifacts/research are unbounded append targets elsewhere, so a salvage
 * whose bulk is those arrays can still fail. TODO(A1-17): extend this trim to
 * the same field set the checkpoint bounds (A1-03), from ONE shared caps
 * source (A1-44).
 */
const RESCUE_LOG_CAP = 200;
/** A1-20: the one chat-row cap — the appendChatRows surface comment and the
 *  salvage both mean THIS number (it used to cite a symbol that did not exist). */
const CHAT_LOG_MAX_ROWS = 40;
const RESCUE_CHAT_CAP = CHAT_LOG_MAX_ROWS;

/** Last fully-failed persist write (quota/blocked AND salvage failed), if any. */
let lastPersistFailure: string | null = null;

/** 346 E4 · L3-07: the pending corrupt-blob recovery notice. `useRapid` does not
 *  exist while the persist middleware hydrates inside `create(...)`, so the
 *  notice is stashed here and synced into the store once the binding exists. */
let pendingPersistRecovery: { at: number; rescueKey: string } | null = null;
/** True once the `useRapid` binding exists (create() returned). */
let storeReady = false;

/** L3-07: record that an unreadable/malformed persisted blob was rescued to
 *  `<name>.rescue`, so a consumer can surface a visible notice instead of the
 *  blob being lost silently. Safe to call during hydration: before the store is
 *  bound it stashes, and the post-create sync commits the notice. */
function notePersistRecovery(): void {
  const notice = { at: Date.now(), rescueKey: PERSIST_RESCUE_NAME };
  pendingPersistRecovery = notice;
  if (storeReady) useRapid.setState({ persistRecovery: notice });
}

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
      let raw: string | null;
      try {
        raw = store.getItem(name);
      } catch (err) {
        // A read that throws is a storage fault, not a content defect — there
        // is nothing on disk to rescue, so report and hydrate empty.
        console.warn(`[store] persist read of "${name}" failed: ${errText(err)}`);
        return null;
      }
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as StorageValue<PersistedSlice>;
      } catch {
        // L3-07 (346 E4): unparseable/truncated blob. Rescue the raw bytes
        // BEFORE the seed's next persist write overwrites them and record a
        // visible notice — this branch used to drop every build silently.
        preserveUnreadableBlob();
        notePersistRecovery();
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
  if (preserveUnreadableBlob()) notePersistRecovery();
  useRapid.setState({ hydrated: true, projects: [], activeId: null, demoSeeded: false, projectTombstones: [] });
  useRapid.getState().seedIfEmpty();
}

/**
 * L3-03 (fixes/345 · looker-3): a persisted `running` phase record is a SESSION
 * artifact — the driver that marked it running (store.execute / runUntilHitl)
 * died with the previous page. Left as-is it wedges the build: the rail renders
 * `Pn RUNNING`, `canExecute` disables Execute / Run-to-gate forever, and no
 * control can clear it (only Archive-and-reimport or the CLI `repair`).
 *
 * On hydrate, reset every `running` record to `ready` and trail ONE
 * `run.interrupted` ledger row, so the graph can run again and the UI never
 * claims a live run with no driver. `project.status` is left as the engine
 * leaves it for a ready frontier ("running" = build in progress); the wedge is
 * the per-phase record, which is what `canExecute` reads.
 */
function markInterruptedRuns(project: Project): Project {
  const phases = Array.isArray(project.phases) ? project.phases : [];
  const interrupted = phases.filter((r) => r.status === "running");
  if (interrupted.length === 0) return project;
  const codes = interrupted.map((r) => `P${r.id}`).join(", ");
  const logs = Array.isArray(project.logs) ? project.logs : [];
  return {
    ...project,
    phases: phases.map((r) => (r.status === "running" ? { ...r, status: "ready" as const } : r)),
    logs: [
      ...logs,
      {
        ts: Date.now(),
        phase: project.currentPhase,
        level: "warn" as const,
        event: "run.interrupted",
        detail: `${codes} was marked running in the persisted build, but the driver that started it did not survive the reload — reset to ready; run it again when you are ready.`,
      },
    ].slice(-200),
  };
}

const PERSIST_NAME = "rapidtool.v4";
/** K2: the one-slot rescue copy of a blob this build could not read. */
const PERSIST_RESCUE_NAME = `${PERSIST_NAME}.rescue`;
/** K2: cap so the rescue copy itself cannot blow a localStorage-class budget. */
const PERSIST_RESCUE_MAX_CHARS = 2_000_000;

/**
 * K2 (W39): before recovery OVERWRITES the persisted blob, keep a one-slot copy
 * of its raw bytes under `<name>.rescue`.
 *
 * Why: recovery is destructive by design (clean re-seed), but not every blob it
 * drops is junk. A blob whose `version` is NEWER than this build (a downgrade,
 * or a stale tab after a deploy) is a v(n+1) payload this build cannot read —
 * `migrate` throws for it on purpose (never guess a future shape), and the old
 * comment claimed "the blob is never overwritten on a version mismatch". That
 * claim was already false once H4's recovery landed: `setState` → the seed's
 * persist write replaces the blob, so a downgrade silently destroyed the
 * user's newer data. The rescue copy makes the recovery non-destructive in
 * fact: bytes are preserved, loudly (console.warn names the key), and the
 * operator can hand them to a newer build.
 *
 * Best-effort by contract: an absent/blocked/quota-full storage skips the copy
 * (in-memory state is authoritative either way) and nothing here throws —
 * it runs INSIDE the hydration callback. */
function preserveUnreadableBlob(): boolean {
  try {
    const store = currentStorage();
    if (!store) return false;
    const raw = store.getItem(PERSIST_NAME);
    if (raw === null || raw.length === 0 || raw.length > PERSIST_RESCUE_MAX_CHARS) return false;
    store.setItem(PERSIST_RESCUE_NAME, raw);
    console.warn(
      `[store] persisted state at "${PERSIST_NAME}" was unreadable — a rescue copy is kept at ` +
        `"${PERSIST_RESCUE_NAME}" before the clean re-seed overwrites the original.`,
    );
    return true;
  } catch {
    // rescue is best-effort — never let it throw out of the hydration callback.
    return false;
  }
}

const persistOptions: PersistOptions<RapidState, PersistedSlice> = {
  name: PERSIST_NAME,
  // T0.1 (fixes/162): version the blob BEFORE any schema add. zustand defaults
  // version:0 with no migrate — a later bump would wipe every user and re-wipe
  // every reload (the unmigratable blob is rescued to `<name>.rescue` before
  // the re-seed write overwrites it — see the K2 note below).
  // v0 → v1 is an identity migrate (legacy blobs keep their projects).
  // A FUTURE blob (fromVersion > 1) throws so onRehydrateStorage recovers via
  // recoverFromCorruptPersistence (clean re-seed), never silent-drop.
  // K2 (W39): "never silent-drop" is now literally true — the throw path
  // preserves the future blob under PERSIST_RESCUE_NAME before the re-seed
  // write overwrites it (preserveUnreadableBlob; the old comment stopped being
  // true the moment H4's recovery started persisting the seed).
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
    // Omit when empty so the legacy persisted blob is byte-identical.
    ...(Array.isArray(s.projectTombstones) && s.projectTombstones.length > 0
      ? { projectTombstones: s.projectTombstones }
      : {}),
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
    // L3-07 (346 E4): a projects array whose entries are ALL unrepairable
    // (e.g. every row's `phases` is an object) is a total loss — hydrateProject
    // would drop them and the seed would replace the user's builds with no
    // signal. Rescue the raw blob and recover loudly instead.
    if (state.projects.length > 0 && !state.projects.some(isRepairableProjectEntry)) {
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

/** L3-10 (346 E4): the Artifacts pane renders a bounded window of a long list.
 *  A real build can carry hundreds of artifacts; one `<button>` per row is
 *  linear DOM cost. The window keeps the NEWEST `cap` rows visible (the pane's
 *  default selection is the newest artifact) and reports how many older rows
 *  are hidden behind the pane's "show older" control. Pure + total: a
 *  non-finite/≤0 cap or a shorter list returns the list unchanged. */
export function windowArtifacts<T>(
  rows: readonly T[],
  cap: number,
): { rows: T[]; hiddenOlder: number } {
  const list = Array.isArray(rows) ? rows : [];
  if (!Number.isFinite(cap) || cap <= 0) return { rows: [...list], hiddenOlder: 0 };
  const limit = Math.floor(cap);
  if (list.length <= limit) return { rows: [...list], hiddenOlder: 0 };
  return { rows: list.slice(list.length - limit), hiddenOlder: list.length - limit };
}

/* ---------- L3-02 (346 E4): cross-tab reconciliation ---------------------- */

/** The append-only collections a cross-tab reconcile union-merges. Scalar and
 *  engine fields take the OTHER tab's record (it is the newer writer); local
 *  rows the remote blob lacks are preserved so a just-made edit is never lost. */
const CROSS_TAB_ARRAY_KEYS = ["artifacts", "memory", "decisions", "logs", "chatLog"] as const;

/** A stable union key for a persisted row: its `id` when it has one, else its
 *  canonical JSON (log/chat rows carry no id). Persisted rows are JSON-safe by
 *  construction, so `JSON.stringify` cannot throw here. */
function crossTabRowKey(row: unknown): string {
  if (row !== null && typeof row === "object" && typeof (row as { id?: unknown }).id === "string") {
    return `id:${(row as { id: string }).id}`;
  }
  return `j:${JSON.stringify(row)}`;
}

/** Union two row arrays by key: local rows first (the tab's own history), then
 *  remote-only rows appended. Idempotent, so the reconcile write loop settles. */
function unionRows(local: readonly unknown[], remote: readonly unknown[]): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<string>();
  for (const row of [...local, ...remote]) {
    const key = crossTabRowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Do two row arrays carry the same rows in the same order (the union's key
 *  sequence)? Used to decide whether a reconcile actually changed THIS tab's
 *  record — the union always begins with the tab's own rows, so comparing
 *  against `remote` (the old bug) missed a remote-only append and never
 *  committed it. */
function sameRows(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (crossTabRowKey(a[i]) !== crossTabRowKey(b[i])) return false;
  return true;
}

/** Scalar/engine fields whose change in another tab is genuine drift worth
 *  warning about (a rename/notes/status/phase this tab had not seen), plus the
 *  operator-owned toggles (enforceDod/wildMode/kind) whose change — unlike an
 *  engine append — alters no row array, so `union.length` alone would miss it
 *  and the reconcile would report `changed: false`, silently keeping this tab's
 *  stale value (a lost cross-tab update). */
function crossTabDrifted(local: Project, remote: Project): boolean {
  return (
    local.name !== remote.name ||
    local.notes !== remote.notes ||
    local.status !== remote.status ||
    local.currentPhase !== remote.currentPhase ||
    local.enforceDod !== remote.enforceDod ||
    local.wildMode !== remote.wildMode ||
    local.kind !== remote.kind
  );
}

/** L3-02 (346): a project-deletion tombstone. `at` orders deletions so the set
 *  can be pruned deterministically; `id` is the deleted project id. */
export type CrossTabTombstone = { id: string; at: number };

/** Cap so tombstones cannot grow without bound. Oldest deletions are dropped
 *  first, so a tab stale by more than this many deletes may resurrect one — the
 *  finite bound that keeps the marker list bounded. */
const CROSS_TAB_TOMBSTONE_CAP = 200;

/** Deterministic union of two tombstone lists: dedupe by id (earliest deletion
 *  wins), sort oldest-first, keep the newest CAP. Idempotent — re-merging the
 *  same lists yields the identical array, so the reconcile write loop settles. */
function unionTombstones(
  local: readonly CrossTabTombstone[],
  remote: readonly CrossTabTombstone[],
): CrossTabTombstone[] {
  const byId = new Map<string, number>();
  for (const t of [...(local ?? []), ...(remote ?? [])]) {
    if (!t || typeof t.id !== "string" || t.id.length === 0) continue;
    const at = typeof t.at === "number" && Number.isFinite(t.at) ? t.at : 0;
    const prev = byId.get(t.id);
    if (prev === undefined || at < prev) byId.set(t.id, at);
  }
  return [...byId.entries()]
    .map(([id, at]) => ({ id, at }))
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(-CROSS_TAB_TOMBSTONE_CAP);
}

/** Read tombstones off an untrusted persisted snapshot; junk rows are dropped. */
function readTombstones(raw: unknown): CrossTabTombstone[] {
  if (!Array.isArray(raw)) return [];
  const out: CrossTabTombstone[] = [];
  for (const t of raw) {
    if (t === null || typeof t !== "object") continue;
    const id = (t as { id?: unknown }).id;
    if (typeof id !== "string" || id.length === 0) continue;
    const at = (t as { at?: unknown }).at;
    out.push({ id, at: typeof at === "number" && Number.isFinite(at) ? at : 0 });
  }
  return out;
}

/** Value-equality for two union-sorted tombstone lists (change detection). */
function tombstonesEqual(a: readonly CrossTabTombstone[], b: readonly CrossTabTombstone[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i].id !== b[i].id || a[i].at !== b[i].at) return false;
  return true;
}

/** Record a deletion (idempotent: an id already present returns the SAME array
 *  reference, so a redundant remove is a no-op). */
function addTombstone(list: readonly CrossTabTombstone[], id: string): CrossTabTombstone[] {
  if (typeof id !== "string" || id.length === 0) return list as CrossTabTombstone[];
  if ((list ?? []).some((t) => t.id === id)) return list as CrossTabTombstone[];
  return unionTombstones(list ?? [], [{ id, at: Date.now() }]);
}

/** Clear tombstones for ids a tab has just (re)created. */
function clearTombstones(list: readonly CrossTabTombstone[], ids: readonly string[]): CrossTabTombstone[] {
  const drop = new Set(ids);
  const kept = (list ?? []).filter((t) => !drop.has(t.id));
  return kept.length === (list ?? []).length ? (list as CrossTabTombstone[]) : kept;
}

/** The set of deleted ids (defensive against junk in an untrusted caller). */
function deletedIdSet(ids: readonly string[]): Set<string> {
  return new Set((ids ?? []).filter((id): id is string => typeof id === "string" && id.length > 0));
}

/** Merge one project: the remote record wins for scalar/engine fields, while
 *  every append-only collection is union-merged so neither tab's rows are lost.
 *  A tombstoned id (`deletedIds`) merges as deleted — the caller drops it. */
export function mergeCrossTabProject(
  local: Project,
  remote: Project,
  deletedIds: readonly string[] = [],
): { project: Project; changed: boolean; drifted: boolean; deleted: boolean } {
  if (deletedIdSet(deletedIds).has(local.id)) {
    return { project: remote, changed: false, drifted: false, deleted: true };
  }
  const next = { ...remote };
  let changed = false;
  for (const key of CROSS_TAB_ARRAY_KEYS) {
    const localRows = (local as unknown as Record<string, unknown>)[key];
    const remoteRows = (remote as unknown as Record<string, unknown>)[key];
    const l = Array.isArray(localRows) ? localRows : [];
    const r = Array.isArray(remoteRows) ? remoteRows : [];
    const union = key === "chatLog" ? unionRows(l, r).slice(-CHAT_LOG_MAX_ROWS) : unionRows(l, r);
    // Compare against THIS tab's rows, not the remote's: the union always
    // contains every local row, so `union !== local` is exactly "the remote
    // added a row (or a chatLog trim shifted the window)" — the condition that
    // must commit. `union.length !== r.length` missed a strict remote superset
    // (local ⊆ remote) and silently never adopted the other tab's appends.
    if (!sameRows(union, l)) changed = true;
    (next as unknown as Record<string, unknown>)[key] = union;
  }
  const drifted = crossTabDrifted(local, remote);
  return { project: next, changed: changed || drifted, drifted, deleted: false };
}

/** Reconcile the whole projects array against another tab's snapshot. Remote
 *  projects are adopted (new ids added, existing ids merged); local-only
 *  projects are kept UNLESS their id is tombstoned. A tombstone (`deletedIds`,
 *  an id deleted in the remote snapshot or held locally) removes the project
 *  locally and keeps it removed even when a later stale snapshot lists it
 *  again — no ping-pong resurrection. With no tombstone the behaviour is the
 *  legacy one byte-for-byte. Pure + total. */
export function reconcileCrossTabProjects(
  local: readonly Project[],
  remote: readonly Project[],
  deletedIds: readonly string[] = [],
): { projects: Project[]; changed: boolean; adopted: number; drifted: string[] } {
  const dead = deletedIdSet(deletedIds);
  const localById = new Map(local.map((p) => [p.id, p]));
  const remoteIds = new Set(remote.map((p) => p.id));
  const projects: Project[] = [];
  const drifted: string[] = [];
  let changed = false;
  for (const rp of remote) {
    const lp = localById.get(rp.id);
    if (!lp) {
      if (dead.has(rp.id)) continue; // a dead id is never (re)adopted
      projects.push(rp);
      changed = true;
      continue;
    }
    const merged = mergeCrossTabProject(lp, rp, deletedIds);
    if (merged.deleted) {
      changed = true; // tombstoned id present on both sides → dropped
      continue;
    }
    projects.push(merged.project);
    if (merged.changed) changed = true;
    if (merged.drifted) drifted.push(rp.id);
  }
  for (const lp of local) {
    if (remoteIds.has(lp.id)) continue;
    if (dead.has(lp.id)) {
      changed = true; // the tombstoned local-only project is removed
      continue;
    }
    projects.push(lp);
  }
  return { projects, changed, adopted: drifted.length, drifted };
}

export const useRapid = create<RapidState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeId: null,
      projectTombstones: [],
      // PB-03 (E-13 seam): live-research deepening via engine.deepenResearch —
      // commits through the store so the console affordance actually works.
      deepenResearch: async (id: string, phase: PhaseId) =>
        serialized(id, async () => {
        const p = get().projects.find((x) => x.id === id);
        if (!p) return { ok: false, error: "Project not found.", code: "RT_E_PROJECT_MISSING" };
        try {
          const next = await deepenResearchEngine(p, phase);
          set((s) => ({
            projects: s.projects.map((x) => (x.id === id ? keepLiveWildRun(rebaseUserFields(next, x), x) : x)),
          }));
          return { ok: true };
        } catch (err) {
          // 318_a2: classify the thrown path — the declaration above carries code?.
          return { ok: false, error: err instanceof Error ? err.message : String(err), code: classifyError(err, "RT_E_INTERNAL") };
        }
      }),
      runVerifyAsync: (id: string) =>
        serialized(id, async () => {
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
            projects: s.projects.map((x) => (x.id === id ? keepLiveWildRun(rebaseUserFields(applied, x), x) : x)),
          }));
          return {
            ok: true,
            status: outcome.status,
            iterations: outcome.iterations,
          };
        } catch (err) {
          // 317_l1w: classify the thrown path — the declaration above carries code?.
          return { ok: false, error: err instanceof Error ? err.message : String(err), code: classifyError(err, "RT_E_INTERNAL") };
        }
        }),
      // fixes/150 (M4 ms4 — watchdog mirror): async P6-journey face for the
      // console/UI. headless.ts is server-only (node:fs at module top), so the
      // import happens HERE at call time — the client bundle never statically
      // pulls headless in; keyless runs commit nothing (byte-identical
      // passthrough), converged/failed runs commit via rebaseUserFields so
      // user-owned fields (name/notes/chatLog/toggles) survive the commit.
      runP6Journey: (id, opts) =>
        serialized(id, async () => {
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
          const headlessSpec = clientSafeServerSpecifier("headless", "ts");
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
                x.id === id ? keepLiveWildRun(rebaseUserFields(res.project, fresh), fresh) : x,
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
          // 317_l1w: classify the thrown path — the declaration above carries code?.
          return { ok: false, error: err instanceof Error ? err.message : String(err), code: classifyError(err, "RT_E_INTERNAL") };
        }
        }),
      hydrated: false,
      autopilot: false,
      demoSeeded: false,
      persistRecovery: null,
      dismissPersistRecovery: () => set({ persistRecovery: null }),
      crossTabNotice: null,
      dismissCrossTabNotice: () => set({ crossTabNotice: null }),
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
          // fixes/346 P2-6: never auto-resume a stalled run. A stall latch that
          // requires a human act (step-timeout / mainthread-stall), or whose
          // recorded step elapsed crossed the 2× pause-on-resolve tier, blocks
          // silent re-entry until that latch is explicitly cleared (a human
          // resume). An absent latch — or a recoverable step-overdue latch, or
          // one owned by another project — leaves the PA-01 path byte-identical.
          const stallLatch = peekStall();
          if (
            stallLatch !== null &&
            (stallLatch.projectId === null || stallLatch.projectId === id) &&
            (requiresHumanResume(stallLatch) ||
              shouldAutopause(stallLatch.stepElapsedMs, WILD_STEP_BUDGET_MS))
          ) {
            return {
              ok: false,
              ran: 0,
              stoppedReason: null,
              error:
                "Wild run is stalled and requires an explicit human resume — clear the stall latch before re-entering the loop.",
              code: "RT_E_GATE_PENDING",
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
            // 308 B-01 (B2): resume must not erase the last executed step's
            // summary (same key-erasure class the hydrator used to inflict);
            // park stays absent — it is present iff pause.
            ...(resuming && p.wildRun!.lastStep ? { lastStep: p.wildRun!.lastStep } : {}),
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
          // R14-f01 (W33 lane F1): bind the Node-side Auto-Review classifier at
          // the driver's real call site. Bare Node + key ⇒ the classifier can
          // actually verdict (engine logs `wild.review (classifier)`); browser /
          // keyless ⇒ null ⇒ wildStep's existing default path, byte-identical.
          const reviewer = await createNodeWildReviewer();
          let cur = withStartLog;
          // 344 A1-06 / 345 F2: the console driver owns the SAME attach step
          // the headless driver performs (headless.attachWildPlan). Without it
          // the loop executed with NO plan review at all — R13-f02's pin was
          // silently vacuous on this path. Attach via the exported
          // headless.generateWildPlan when the server reports a key; otherwise
          // record the absence loudly (a console run is then honestly the
          // deterministic floor, never presented as plan-reviewed).
          if (cur.wildPlan?.source !== "planner") {
            let attached: Project | null = null;
            if (get().llmStatus.configured) {
              try {
                const headlessSpec = clientSafeServerSpecifier("headless", "ts");
                const hl = (await import(headlessSpec)) as {
                  generateWildPlan?: (p: Project) => Promise<WildPlan>;
                };
                if (typeof hl.generateWildPlan === "function") {
                  const plan = await hl.generateWildPlan(cur);
                  if (plan.source === "planner" && plan.steps.length > 0) {
                    attached = wildLog(
                      { ...cur, wildPlan: plan },
                      cur.currentPhase,
                      "info",
                      "wild.plan",
                      `wild.plan (planner): ${plan.steps.length} step(s) — attached by the console driver (R13-f02)`,
                    );
                  }
                }
              } catch {
                /* browser / server module unavailable — the honest absent path below */
              }
            }
            const planHandled =
              attached ??
              wildLog(
                cur,
                cur.currentPhase,
                "warn",
                "wild.plan_absent",
                "console wild start has no planner plan to review (planner not configured or unreachable) — the run executes the deterministic floor, not a plan-reviewed run (R13-f02)",
              );
            // Commit the plan change (preserving concurrent rows in the STORE)
            // but keep `cur` free of adopted rows: the loop's own commitWild
            // re-adopts concurrent appends (H-06). Folding them into `cur` here
            // would mask the next step's legitimate phase artifact replacement.
            commitWild(planHandled, cur);
            cur = planHandled;
          }
          // R13-f02 (341-6): the console driver stages the plan review too —
          // a stored planner plan is judged (reviewer) and the run parks
          // BEFORE the first mutation, exactly as headless's wild drivers do.
          const staged = await stageWildPlan(cur, reviewer);
          if (staged.staged) {
            commitWild(staged.project, null);
            return { ok: true, ran: 0, stoppedReason: "paused", note: "RT_E_GATE_PENDING" };
          }
          for (let step = 0; step < 20; step++) {
            const prev = cur; // the generation this step is computed from
            // 308 B-02: the wild-step telemetry was dead in production — every
            // caller dropped opts.onEvent, so finishStep's wild.step_* emits
            // never fired. The store's driver feeds them to the same ring the
            // console reads (reportRt, the file's own rt seam).
            // 346 K3: the engine hands back the model usage it metered into the
            // process session ledger for THIS step (`onUsage`); it fires only
            // when something was measured, so an unmeasured run folds nothing.
            let stepSpend: SpendSlice | null = null;
            const res = await wildStep(cur, {
              ...(reviewer ? { reviewer } : {}),
              onEvent: (seed) => reportRt(seed),
              onUsage: (usage) => {
                stepSpend = stepSpend === null ? usage : accumulateSpend(stepSpend, usage);
              },
            });
            const resProject = foldStepSpend(res.project, stepSpend);
            const merged = commitWild(resProject, prev);
            // Continue from the MERGED generation, not the raw step output:
            // the next step's input then already carries the concurrent rows
            // this commit adopted, so a later union can never re-add them.
            cur = merged ?? resProject;
            if (!res.ran) break;
            ran += 1;
            if (cur.wildRun?.pause) {
              // Carry the pause class from the step that parked the run (B5).
              // F3-06 (185-H1): ok:true never dual-channels — the pause class
              // rides as `note`; `code` stays on the refusal arm only.
              return { ok: true, ran, stoppedReason: "paused", ...(res.code ? { note: res.code } : {}) };
            }
            if (cur.status === "complete") {
              return { ok: true, ran, stoppedReason: "complete" };
            }
            if (!cur.wildRun?.active) {
              // F3-05: name the class — an external stop (stopWildRun) is a
              // real stop, not "no reason".
              return { ok: true, ran, stoppedReason: "stopped" };
            }
          }
          // 308 M4-05 (B2): the cap stamps the uncoded park — code null (the
          // WildParkInfo doc names operator toggles + this defensive cap as the
          // uncoded sources) with unlock "operator" (the run state itself looks
          // wrong — inspect, repair, resume; WILD_UNLOCK_TEXT). The old bare
          // call left park:null, making the UI's "parked · uncoded" branch
          // unreachable for this pause.
          const capped = wildPause(
            cur,
            cur.currentPhase,
            "warn",
            "wild.cap",
            "Wild loop step cap (20) reached — run parked.",
            { code: null, unlock: "operator" },
          );
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
        }
        } finally {
          // A1-13: ONE release path for the whole action — the loop's own
          // finally was redundant (this finally runs immediately after it)
          // and read like a latch refcount bug. Early returns (missing
          // project / wildMode off / already active / complete) land here too
          // (174-2), and a paused run's resume re-enters (PB-04).
          releaseWildStart(id);
        }
      },
      stopWildRun: (id) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id && p.wildRun
              ? { ...p, wildRun: { ...p.wildRun, active: false, stoppedAt: Date.now(), pause: false, park: null } }
              : p,
          ),
        })),
      toggleWildPause: (id) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (!(p.id === id && p.wildRun && p.wildRun.active)) return p;
            // 308 M4-06 (B2): the operator toggle stamps its park record on
            // pause (wildOperatorPark: uncoded, unlock "resume") and clears it
            // on resume — park is present iff pause (types.ts WildRunState.park;
            // the toggle used to leave park:null on pause and a stale record on
            // resume).
            const paused = p.wildRun.pause !== true;
            return {
              ...p,
              wildRun: {
                ...p.wildRun,
                pause: paused,
                park: paused ? wildOperatorPark(p, "Wild run paused from the console.") : null,
              },
            };
          }),
        })),
      create: (brief, name) => {
        const project = emptyProject({
          brief,
          name: name?.trim() || inferName(brief),
          // W-18 (fixes/274 · WDX-3 · §W27-B · A1-f09/R8-f04): the browser has no
          // `process.env`, so emptyProject's keyed default is unreachable there and
          // the sidebar caption ("On by default when a DeepSeek key is configured")
          // read false on every console-created project. The status probe is the
          // console's honest view of the SERVER's key: when it says configured, the
          // created project joins the keyed default (hard-DoD ON). When it does not
          // (or has not run), the engine's own default stands untouched — node hosts
          // with a process key keep today's behavior byte-for-byte.
          ...(get().llmStatus.configured ? { enforceDod: true } : {}),
        });
        set((s) => ({
          projects: [project, ...s.projects],
          activeId: project.id,
          demoSeeded: true,
          projectTombstones: clearTombstones(s.projectTombstones, [project.id]),
        }));
        return project.id;
      },
      // ST-5: reject ids that do not exist — a persisted activeId pointing at a
      // deleted project must not leave the UI pointing at nothing.
      select: (id) =>
        set((s) => ({ activeId: id !== null && byId(s.projects, id) ? id : null })),
      execute: (id) => {
        const project = byId(get().projects, id);
        if (!project) return { ok: false, error: "Project missing.", code: "RT_E_PROJECT_MISSING" };
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
        if (!start) return { ok: false, ran: 0, stoppedReason: null, error: "Project missing.", code: "RT_E_PROJECT_MISSING" };
        let current = start;
        let ran = 0;
        let error: string | undefined;
        let stoppedReason: RunStopReason = null;
        // B-24: the loop bound derives from the graph, not a magic constant. Worst case every
        // remaining phase parks a HITL that autopilot approves (~2 iterations per phase) + 2 margin.
        const maxRuns = (PHASE_LAST + 1 - start.currentPhase) * 2 + 2;
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
                  // F3-10 (fixes/293 M2): the denial-log commit is the async
                  // branch's twin of the wrapped success path below — a stale
                  // execute snapshot must not clobber operator-owned fields
                  // (name/notes/enforceDod/wildMode/chatLog/kind) or an
                  // in-flight wild run.
                  projects: s.projects.map((p) =>
                    p.id === id ? keepLiveWildRun(rebaseUserFields(next.project, live), live) : p,
                  ),
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
                // 174-1 (widened by W-23b · §R2-f02): do not clobber an
                // in-flight wild run with a stale execute snapshot — the guard
                // now rides keepLiveWildRun, shared with the five siblings.
                return keepLiveWildRun(rebaseUserFields(next.project, live), live);
              }),
            };
          });
          return { ok: true };
        }),
      runUntilHitlAsync: (id) =>
        serialized(id, async () => {
          const start = byId(get().projects, id);
          if (!start) return { ok: false, ran: 0, stoppedReason: null, error: "Project missing.", code: "RT_E_PROJECT_MISSING" };
          const configured = get().llmStatus.configured || get().researchStatus.configured;
          let current = start;
          let ran = 0;
          let error: string | undefined;
          let stoppedReason: RunStopReason = null;
          const maxRuns = (PHASE_LAST + 1 - start.currentPhase) * 2 + 2;
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
              projects: s.projects.map((p) => (p.id === id ? keepLiveWildRun(rebaseUserFields(current, live), live) : p)),
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
                  projects: s.projects.map((p) => (p.id === id ? keepLiveWildRun(rebaseUserFields(updated, live), live) : p)),
                };
              });
              return { ok: true, result: r };
            }
            // F3-08: coded refusal — this seam must not flatten "runner
            // unavailable / nothing to run" into an uncoded error.
            return {
              ok: false,
              result: out.result,
              error: "bounded runner unavailable or no generated module",
              code: "RT_E_RUNNER_UNAVAILABLE",
            };
          } catch (err) {
            // 317_l1w: F3-08 residue — the thrown path must not stay uncoded.
            return { ok: false, result: null, error: err instanceof Error ? err.message : String(err), code: classifyError(err, "RT_E_INTERNAL") };
          }
        }),
      // Ingest an external agent's report (the two-way packet path). Validates
      // first (never touches state on malformed input), then applies as
      // clearly-marked "[agent report]" artifacts + a log. Gate advancement stays
      // with approve/execute — this is pure intake.
      ingestReport: (id, raw) => {
        const project = byId(get().projects, id);
        if (!project) return { ok: false, error: "Project missing.", code: "RT_E_PROJECT_MISSING" };
        const v = validateReport(raw, project.currentPhase);
        if (!v.ok) return { ok: false, error: v.error, code: "RT_E_VALIDATION" };
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
          // E-19 (344 A1-03 / 345 F2): a report that names files in a prior
          // COMPLETE phase's file space re-checks that phase's RECORDED gate
          // against a fresh evaluation — a hash mismatch is real regression
          // drift and is surfaced (warn) on the ledger. Advisory: prior records
          // are never mutated (engine.verifyPriorPhases is pure).
          const touchingFiles = Array.isArray(v.report.files) ? v.report.files : [];
          if (result.applied && touchingFiles.length > 0) {
            const drifting = verifyPriorPhases(live, v.report.phase, touchingFiles).filter((d) => d.drift);
            if (drifting.length > 0) {
              const driftRows: JsonLog[] = drifting.map((d) => ({
                ts: Date.now(),
                phase: d.phase as PhaseId,
                level: "warn" as const,
                event: "regression.drift",
                detail:
                  `P${d.phase} exit evidence drifted after an agent report touched its file space (${touchingFiles.join(", ")}) — ` +
                  `fresh gate ${d.unmetNow.length === 0 ? "passes" : `unmet: ${d.unmetNow.join(", ")}`} (recorded ${d.wasPassed ? "passed" : "failed"})`,
              }));
              updated = { ...updated, logs: [...(updated.logs ?? []), ...driftRows].slice(-200) };
            }
          }
          // L3-06 (346 E4): only a report that actually LANDED can be warned
          // about — a duplicate (applied:false) is a no-op, so trailing a
          // "no tests_run evidence" row would count reports that were dropped.
          if (warnNoEvidence && result.applied) {
            const warnEntry: JsonLog = {
              ts: Date.now(),
              phase: live.currentPhase,
              level: "warn",
              event: "agent.report",
              detail: "complete report with no tests_run evidence",
            };
            updated = { ...updated, logs: [...updated.logs, warnEntry].slice(-200) };
          }
          // F2-03b (W42 · L2-P8): the ingested "[agent report]" artifacts (and
          // the no-evidence warn row) must ride the COMPILED packet too — a
          // downstream agent reading project.packet would otherwise see the
          // pre-intake snapshot.
          updated = stampPacket(updated);
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
      // R13-f02 (W33 lane L2): read-only wildPlan accessor (see the state type
      // above) — stored plan, else the honest empty plan; null for unknown ids.
      wildPlanFor: (id) => {
        const project = byId(get().projects, id);
        return project ? readWildPlan(project) : null;
      },
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
              const anyS = s as { configured?: unknown; model?: unknown; label?: unknown; lastKeyed?: unknown };
              llm.configured = Boolean(anyS.configured);
              if (typeof anyS.model === "string" && anyS.model) llm.model = anyS.model;
              llm.label = anyS.configured
                ? (llm.model ?? "configured")
                : typeof anyS.label === "string" && anyS.label
                  ? anyS.label
                  : "deterministic engine";
              // C1 (332-5): carry the server probe's last keyed-call outcome
              // (validity). Validated — a hostile/partial shape is dropped, never
              // trusted; absent means "last keyed call succeeded / none seen".
              const lk = readLastKeyed(anyS.lastKeyed);
              if (lk) llm.lastKeyed = lk;
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
        return llm;
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
        // A1-12 (346 K3 — the WRITER step). Route the console decision through
        // the ONE seat policy under the console's OWN registered, UNATTESTED
        // human seat. A stock gate approval is ADMITTED under the distinct
        // `console-seat-unattested` reason id — the row is tagged `[seat console]`
        // and its `decidedVia` records `tokenPath:false`, so the p4/p5/p8/p9
        // `*approved` criteria pass on a TRUTHFUL provenance and the decision can
        // never read as the token-verified CLI seat. A force (`hitl.force`) is
        // refused for the console seat by the same seam; the store still honours
        // the operator's explicit override (a recorded DF-09 rationale) but stamps
        // the refusal reason + `tokenPath:false`, so a forced console decision is
        // an honest UNATTESTED override, never a verified human one.
        const consoleActor = { decidedBy: "human", seat: "console" } as const;
        const policyAction = opts?.force === true ? "hitl.force" : "hitl.approve";
        const policyResource = `gate:P${project.currentPhase}`;
        const consoleVerdict = evaluatePolicy(policyAction, policyResource, { actor: consoleActor });
        const decidedVia = {
          action: policyAction,
          resource: policyResource,
          reason: consoleVerdict.reason,
          label: seatLabel(consoleActor),
          tokenPath: seatTokenPath(consoleActor),
        };
        const seatRow: JsonLog = {
          ts: Date.now(),
          phase: project.currentPhase,
          level: "info",
          event: "hitl.console_decision",
          detail:
            `P${project.currentPhase} approved from the browser console under the unattested console human seat` +
            (opts?.force === true ? " (operator override with rationale)" : "") +
            ` — the seat policy reports ${policyAction} as ${consoleVerdict.decision} (${consoleVerdict.reason}); ` +
            `the console has no out-of-band RT_HUMAN_SEAT_TOKEN path, so this row records an UNATTESTED console ` +
            `human decision, never a token-verified one.`,
        };
        // Engine stamps the packet + packet artifact + A4 trace on approval (B-19); the journal
        // entry records the human actor (T2). A standard approval carries the `[seat console]`
        // tag (an untagged row reads as legacy provenance); a forced override keeps the caller's
        // rationale VERBATIM (DF-09's observable) and rides `decidedVia` instead.
        const approved = approveHitl(project, {
          decidedBy: "human",
          force: opts?.force,
          requestedAt: opts?.requestedAt,
          note: opts?.force
            ? opts?.note
            : `[seat console] ${opts?.note?.trim() || "approved from the browser console"}`,
          decidedVia,
        });
        // T8: the just-approved gate phase gets its DoD verdict recorded too.
        const recorded = recordGate(approved, project.currentPhase);
        // ST-1: re-stamp AFTER the gate verdict so the packet's System JSON
        // `gate_passed` for the just-approved phase is fresh (approveHitl stamps
        // first, before the verdict exists). The seat-provenance row rides the
        // same stamp so packet/artifact/ledger stay in sync.
        const updated = stampPacket({
          ...recorded,
          logs: [...(recorded.logs ?? []), seatRow].slice(-200),
        });
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
        // A20: id-match, never array position (same law as the transition guards).
        if (project.phases.find((p) => p.id === project.currentPhase)?.status !== "awaiting_hitl") {
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
                    projects: s.projects.map((p) => (p.id === id ? keepLiveWildRun(rebaseUserFields(updated, live), live) : p)),
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
          // L3-02 (346): persist a delete marker so the deletion crosses tabs.
          projectTombstones: addTombstone(s.projectTombstones, id),
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
        // A1-18: hydrate's doctrine — a persisted ACTIVE run is a session
        // artifact and the copy has no driver, so an active surface would be a
        // lie (and blocks startWildRun with "already active" until reload).
        // Stop it + trail it, like hydrateWildRun's stop branch.
        if (copy.wildRun?.active) {
          copy.wildRun = {
            ...copy.wildRun,
            active: false,
            pause: false,
            stoppedAt: copy.wildRun.stoppedAt ?? Date.now(),
          };
          copy.logs = [
            ...copy.logs,
            {
              ts: Date.now(),
              phase: copy.currentPhase,
              level: "info" as const,
              event: "wild.stop",
              detail: "Clone: active wild run stopped — the driver loop is a session artifact (hydrate doctrine).",
            },
          ].slice(-200);
        }
        set((s) => ({
          projects: [copy, ...s.projects],
          activeId: copy.id,
          demoSeeded: true,
          projectTombstones: clearTombstones(s.projectTombstones, [copy.id]),
        }));
        return copy.id;
      },
      rename: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
        }));
      },
      // F2-03b (W42 · L2-P8): the compiled packet embeds the operator-notes
      // block ("## Operator notes (human steering)"), so the notes write
      // re-stamps the packet — the persisted packet (packet pane, export,
      // tree consumers) never serves pre-edit notes. `stampPacket` replaces
      // the packet artifact and rebuilds the A4 trace, so repeated writes
      // cannot accumulate rows.
      setNotes: (id, notes) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? stampPacket({ ...p, notes }) : p)),
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
              ? { ...p, chatLog: [...(p.chatLog ?? []), ...list].slice(-CHAT_LOG_MAX_ROWS) }
              : p,
          ),
        }));
      },
      recordSpend: (id, usage) => {
        const slice = measuredSpendFromUsage(usage);
        // Nothing measured → no write at all (never a fabricated zero).
        if (slice === null) return false;
        let wrote = false;
        set((s) => {
          const live = byId(s.projects, id);
          if (!live) return s;
          wrote = true;
          return {
            projects: s.projects.map((x) =>
              x.id === id ? { ...x, tokenUsage: accumulateSpend(x.tokenUsage, slice) } : x,
            ),
          };
        });
        return wrote;
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
        // 319_f1: forward the refusal code (undefined on the message-only arms).
        if (!parsed.ok) return { ok: false, error: parsed.error, code: parsed.code };
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
            projectTombstones: clearTombstones(s.projectTombstones, [project.id]),
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
              .map((p) => markInterruptedRuns(hydrateProject(p))),
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

storeReady = true;

/** L3-02 (346 E4): apply another tab's persisted snapshot (a storage event's
 *  newValue) to the live store. A malformed/foreign value is ignored — it never
 *  clobbers. Returns true when a commit happened.
 *
 *  L3-02 (346): the snapshot's delete markers are union-merged with the ones
 *  this tab already holds and passed to the reconcile. The marker is STICKY:
 *  a tombstoned project is removed locally AND rides this tab's next write, so
 *  a stale tab cannot resurrect it and re-applying the same snapshot is a
 *  no-op (no write loop). */
export function applyCrossTabSnapshot(raw: string | null): boolean {
  if (!raw) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("[store] cross-tab sync ignored an unparseable persisted snapshot");
    return false;
  }
  const slice = (parsed as {
    state?: { projects?: unknown; demoSeeded?: unknown; projectTombstones?: unknown };
  } | null)?.state;
  if (!slice || !Array.isArray(slice.projects)) return false;
  const remote = slice.projects.filter(isRepairableProjectEntry);
  if (slice.projects.length > 0 && remote.length === 0) return false;
  const current = useRapid.getState();
  const localTombstones = Array.isArray(current.projectTombstones) ? current.projectTombstones : [];
  const tombstones = unionTombstones(localTombstones, readTombstones(slice.projectTombstones));
  const merged = reconcileCrossTabProjects(
    current.projects,
    remote,
    tombstones.map((t) => t.id),
  );
  const tombsChanged = !tombstonesEqual(tombstones, localTombstones);
  if (!merged.changed && !tombsChanged) return false;
  // A deleted active project must not leave the UI pointing at nothing.
  const activeId =
    current.activeId !== null && merged.projects.some((p) => p.id === current.activeId)
      ? current.activeId
      : null;
  useRapid.setState({
    projects: merged.projects,
    projectTombstones: tombstones,
    activeId,
    demoSeeded: current.demoSeeded || slice.demoSeeded === true,
    crossTabNotice:
      merged.drifted.length > 0
        ? { at: Date.now(), adopted: merged.drifted.length, drifted: merged.drifted }
        : current.crossTabNotice,
  });
  return true;
}

/* L3-02 (346 E4): a `storage` event fires in every OTHER same-origin tab when
 * one tab writes the persist key. Reconcile that snapshot so a rename/approve
 * made in tab A is never clobbered by tab B's next write; genuine scalar drift
 * raises a notice the console shows, and a delete marker (L3-02 346) propagates
 * the deletion. Guarded for SSR/Node. */
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("storage", (event) => {
    if (event.key !== PERSIST_NAME) return;
    applyCrossTabSnapshot(event.newValue);
  });
}

// L3-07: commit a recovery notice stashed while the store was still binding.
if (pendingPersistRecovery) useRapid.setState({ persistRecovery: pendingPersistRecovery });
