// ---------------------------------------------------------------------------
// pipeline-rail.tsx — the pipeline-visibility surface (W307 U2, completing
// F2's 306 spec as a REAL component; console.tsx stays U1's file and imports
// this one).
//
// Three surfaces, every pixel reading a NAMED real field:
//   1. Rail      — P0→P12 from PHASES (code/title) × `project.phases`
//                  (`PhaseRecord.status` ∈ locked/ready/running/awaiting_hitl/
//                  complete/rejected) + `project.currentPhase` + the blocked
//                  project state (`project.status`).
//   2. Now-line  — the newest REAL event, in honest fallback order:
//                  `rtSnapshot().tail[0]` (client ring, newest-first, this page
//                  session) → `project.logs.at(-1)` (the persisted ledger) →
//                  `project.wildRun.lastAutoLog` + `lastAutoAt` (the wild loop's
//                  own line) → an explicit idle state. It never invents a row.
//   3. Detail    — click any phase: the store's PhaseRecord truth
//                  (status · startedAt/completedAt · gate{passed,unmet,
//                  evidenceHash,checkedAt} · rejectionNote/rejectionHistory ·
//                  gate decisions · artifact rows) plus, while the phase is the
//                  project's frontier, the live wild record
//                  (`wildRun.active/pause/phase/lastAutoAt/lastAutoLog` ·
//                  `wildRun.lastStep: WildStepSummary` ·
//                  `wildRun.park: WildParkInfo` — coded why/unlock/re-entry) and
//                  the open HITL request (`project.hitl`).
//                  W310 B6: the park payload (rail row + detail) renders ONLY
//                  while `wildRun.pause === true` (B-08 stale-park gate — the
//                  record is the CURRENT pause's), and the rail-level "Parked"
//                  row carries the same why/unlock/re-entry lines as the detail.
//
// Provenance note: console.tsx's module-private `PhaseRecordView` is NOT
// imported here — that would create a console↔pipeline-rail import cycle in the
// app's hottest module, and console.tsx is U1's box this wave. Its real-field
// reads are replicated 1:1 (ledger: fixes/307_u2_pipeline.md §2); this
// component stays self-contained so U1's wiring is a 2-line import + mount.
// W309 A6: that mount is DONE — console.tsx imports this and renders it in
// RunScreen right after PhaseProgressRail (additive; nothing replaced).
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { PHASES, PHASE_BY_ID } from "@/lib/phases";
import { rtSnapshot } from "@/lib/rt-client";
import type { RtEvent } from "@/lib/rt-events";
import type { PhaseId, PhaseStatus, Project } from "@/lib/types";

/** Same cadence as the sibling runtime panes (ring is tiny; cost negligible). */
const SNAP_POLL_MS = 2000;

/** Project status words — console.tsx's PROJECT_STATUS_LABEL values, reused. */
const PROJECT_STATUS_WORD: Record<Project["status"], string> = {
  intake: "not started",
  running: "running",
  awaiting_hitl: "waiting for you",
  complete: "complete",
  blocked: "blocked",
};

/** Phase status words — console.tsx's PHASE_STATUS_META labels, reused. */
const PHASE_STATUS_WORD: Record<PhaseStatus, string> = {
  complete: "Complete",
  locked: "Locked",
  rejected: "Rejected",
  running: "Running",
  awaiting_hitl: "Awaiting human approval",
  ready: "Ready",
};

/** ISO clock (deterministic — same clock convention as runtime-timeline-pane). */
function clockLabel(ts: number): string {
  return new Date(ts).toISOString().slice(11, 19);
}

/** Human delta label (41s · 2m12s · 3h5m) — mirrors console.tsx's agoLabel. */
function agoLabel(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60}s`;
  return `${Math.floor(m / 60)}h${m % 60}m`;
}

function clip(note: string, n = 90): string {
  return note.length > n ? `${note.slice(0, n)}…` : note;
}

/** Ring-row tone — the RuntimeLogPane mapping (console.tsx:4546), reused. */
function ringLevelTone(level: RtEvent["level"]): string {
  if (level === "critical") return "text-danger";
  if (level === "error") return "text-warn";
  if (level === "warn") return "text-warn";
  return "text-muted";
}

/** Ledger tone — JsonLog levels are info|warn|error (no critical tier). */
function ledgerLevelTone(level: "info" | "warn" | "error"): string {
  if (level === "error") return "text-danger";
  if (level === "warn") return "text-warn";
  return "text-muted";
}

type NowLine = {
  source: "ring" | "ledger" | "wild" | "idle";
  ts: number | null;
  tone: string;
  event: string | null;
  text: string;
  code: string | null;
  phase: number | null;
  count: number | null;
  note: string;
};

/**
 * Pick the newest REAL event for the now-line. Pure over its inputs; the
 * fallback chain is explicit and each branch labels its own provenance.
 */
function pickNowLine(project: Project, tail: RtEvent[], ringRows: number): NowLine {
  const newest = tail.length > 0 ? tail[0] : null;
  if (newest) {
    return {
      source: "ring",
      ts: newest.ts,
      tone: ringLevelTone(newest.level),
      event: newest.event,
      text: newest.message,
      code: newest.code ?? null,
      phase: typeof newest.phase === "number" ? newest.phase : null,
      count: newest.count !== undefined && newest.count > 1 ? newest.count : null,
      note: `newest row of the client telemetry ring · ${ringRows} row${ringRows === 1 ? "" : "s"} this page session`,
    };
  }
  const last = project.logs.length > 0 ? project.logs[project.logs.length - 1] : null;
  if (last) {
    return {
      source: "ledger",
      ts: last.ts,
      tone: ledgerLevelTone(last.level),
      event: last.event,
      text: last.detail,
      code: null,
      phase: last.phase,
      count: null,
      note: "ring empty this session — newest entry of the project ledger",
    };
  }
  const wr = project.wildRun ?? null;
  if (wr && wr.lastAutoLog.length > 0) {
    return {
      source: "wild",
      ts: wr.lastAutoAt,
      tone: "text-wild",
      // Display-only provenance label, NOT a telemetry event: nothing passes
      // "wild.auto" to reportRt and it is deliberately absent from
      // RT_EVENT_NAMES (308_bugmap NOTE-308-03 / 309 A6; the N6 census
      // conflated this display row with real emitters).
      event: "wild.auto",
      text: wr.lastAutoLog,
      code: null,
      phase: wr.phase,
      count: null,
      note: "no telemetry rows and no ledger entries — the wild loop's own newest activity line",
    };
  }
  return {
    source: "idle",
    ts: null,
    tone: "text-faint",
    event: null,
    text: "No telemetry rows, no ledger entries, no wild activity — nothing has stepped yet.",
    code: null,
    phase: null,
    count: null,
    note: "honest idle — the ring and the ledger are both empty",
  };
}

/** Rail-segment presentation for one phase record (colors mirror PhaseProgressRail). */
function segmentMeta(
  status: PhaseStatus,
  isCurrent: boolean,
  blocked: boolean,
  wildActive: boolean,
): { tone: string; word: string; lblCls: string } {
  if (status === "complete") return { tone: "bg-ok", word: "Complete", lblCls: "rail-lbl-done" };
  if (status === "rejected") return { tone: "bg-danger", word: "Rejected", lblCls: "rail-lbl-bad" };
  if (status === "awaiting_hitl") return { tone: "bg-warn", word: "Awaiting approval", lblCls: "rail-lbl-warn" };
  if (status === "running") {
    return { tone: "bg-accent", word: wildActive ? "Wild mode running" : "Running", lblCls: "rail-lbl-now" };
  }
  if (isCurrent) {
    return blocked
      ? { tone: "bg-danger", word: "Blocked", lblCls: "rail-lbl-bad" }
      : { tone: "bg-accent", word: "Current", lblCls: "rail-lbl-now" };
  }
  if (status === "ready") return { tone: "bg-fg/50", word: "Ready", lblCls: "" };
  return { tone: "bg-faint", word: "Locked", lblCls: "" };
}

/**
 * Per-phase detail. Replicates console.tsx `PhaseRecordView`'s real-field reads
 * 1:1 (def code/title/summary/hitl · rec status/startedAt/completedAt/
 * rejectionNote/rejectionHistory/gate · phase decisions · phase artifacts) and
 * adds the live wild + HITL record for the frontier phase. No callbacks into
 * console: this renders read-only truth, it never mutates.
 */
function PhaseRecordDetail({
  project,
  phase,
  onClose,
}: {
  project: Project;
  phase: PhaseId;
  onClose: () => void;
}) {
  const def = PHASE_BY_ID.get(phase) ?? null;
  const rec = project.phases.find((r) => r.id === phase) ?? null;
  const arts = project.artifacts.filter((a) => a.phase === phase);
  const decisions = project.decisions.filter((d) => d.phase === phase);
  const isCurrent = project.currentPhase === phase;
  const wr = project.wildRun ?? null;
  const hitl = project.hitl !== null && project.hitl.phase === phase ? project.hitl : null;
  // B-08 gate: park is the CURRENT pause's record — render it only while the
  // run is actually paused (stopWildRun/toggleWildPause leave it in place).
  const park = wr && wr.pause === true ? wr.park ?? null : null;

  return (
    <div
      id="pipeline-rail-detail"
      className="mt-2 rounded-md border border-border bg-raised px-3 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-muted">
          {def ? `${def.code} · ${def.title}` : `P${phase} — not in this build's phase graph`}
          {def?.hitl ? " · HITL gate" : ""}
          {rec ? "" : " · no record"}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-8 rounded-md border border-border px-2.5 text-xs text-fg hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          Hide detail
        </button>
      </div>

      {def ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">{def.summary}</p> : null}

      {rec ? (
        <>
          <p className="mt-2 font-mono text-[11px] text-fg">
            {PHASE_STATUS_WORD[rec.status]}
            {rec.startedAt !== undefined ? ` · started ${agoLabel(rec.startedAt)} ago` : " · never started"}
            {rec.completedAt !== undefined ? ` · completed ${agoLabel(rec.completedAt)} ago` : ""}
          </p>

          {rec.gate ? (
            <p className="mt-1.5 font-mono text-[11px]">
              <span className="text-muted">DoD </span>
              {rec.gate.passed ? (
                <span className="text-ok">PASS</span>
              ) : (
                <span className="text-danger">FAIL</span>
              )}
              <span className="text-faint">
                {" "}
                · checked {agoLabel(rec.gate.checkedAt)} ago · evidence {rec.gate.evidenceHash.slice(0, 8)}
              </span>
              {rec.gate.unmet.length ? <span className="text-warn"> · {rec.gate.unmet.length} unmet</span> : null}
            </p>
          ) : (
            <p className="mt-1.5 font-mono text-[11px] text-faint">No DoD gate verdict recorded yet.</p>
          )}
          {rec.gate && rec.gate.unmet.length > 0 ? (
            <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-warn">
              {rec.gate.unmet.map((u) => (
                <li key={u}>unmet: {u}</li>
              ))}
            </ul>
          ) : null}

          {rec.rejectionNote ? (
            <p className="mt-2 text-xs leading-relaxed text-danger">
              Rejected: <span className="[overflow-wrap:anywhere]">{rec.rejectionNote}</span>
            </p>
          ) : null}
          {(rec.rejectionHistory ?? []).length > 0 ? (
            <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-faint">
              {(rec.rejectionHistory ?? []).map((r, i) => (
                <li key={`${r.at}-${i}`}>
                  rejection · {agoLabel(r.at)} ago · <span className="[overflow-wrap:anywhere]">{clip(r.note, 120)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="mt-2 rounded-md border border-dashed border-line px-3 py-3 text-xs text-muted">
          No record stored for this phase — the store has never entered it (locked).
        </p>
      )}

      {decisions.length > 0 ? (
        <div className="mt-2">
          <p className="font-mono text-[11px] text-muted">Gate decisions</p>
          <ul className="mt-1 space-y-1">
            {decisions.map((d) => (
              <li key={d.id} className="font-mono text-[11px] leading-relaxed">
                <span className={d.decision === "approve" ? "text-ok" : "text-danger"}>{d.decision}</span>
                <span className="text-faint">
                  {" "}
                  · {d.decidedBy}
                  {d.decidedVia ? ` (${d.decidedVia.label})` : ""} · {agoLabel(d.decidedAt)} ago
                </span>
                {d.note ? (
                  <span className="block pl-3 text-faint [overflow-wrap:anywhere]">{clip(d.note, 120)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-2 font-mono text-[11px] text-muted">
        Artifacts · {arts.length} row{arts.length === 1 ? "" : "s"}
      </p>
      {arts.length > 0 ? (
        <>
          <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-faint">
            {arts.slice(-6).map((a) => (
              <li key={a.id} className="truncate">
                {a.kind} · {a.title}
              </li>
            ))}
          </ul>
          {arts.length > 6 ? (
            <p className="mt-0.5 font-mono text-[11px] text-faint">
              +{arts.length - 6} more — the Artifacts pane in the Run console holds the full browser.
            </p>
          ) : null}
        </>
      ) : null}

      {isCurrent && wr ? (
        <div className="mt-3 border-t border-line pt-2">
          <p className="font-mono text-[11px] text-wild">
            Wild run — {wr.active ? (wr.pause ? "paused" : "active") : "stopped"} · frontier P{wr.phase}
            {wr.lastAutoAt !== null ? ` · last auto ${agoLabel(wr.lastAutoAt)} ago` : ""}
            {wr.startedAt !== null ? ` · started ${agoLabel(wr.startedAt)} ago` : ""}
            {wr.stoppedAt !== null ? ` · stopped ${agoLabel(wr.stoppedAt)} ago` : ""}
          </p>
          {wr.lastStep ? (
            <p className="mt-1 font-mono text-[11px] text-muted">
              last step · {wr.lastStep.outcome} · {wr.lastStep.action} · P{wr.lastStep.phase}
              {wr.lastStep.completedPhase !== null ? ` · sealed P${wr.lastStep.completedPhase}` : ""}
              {wr.lastStep.advancedTo !== null ? ` · advanced to P${wr.lastStep.advancedTo}` : ""}
              {` · next ${wr.lastStep.nextAction} P${wr.lastStep.nextPhase} · +${wr.lastStep.artifacts} artifacts`}
            </p>
          ) : null}
          {wr.lastAutoLog.length > 0 ? (
            <p className="mt-1 text-xs leading-relaxed text-fg/90 [overflow-wrap:anywhere]">
              {clip(wr.lastAutoLog, 200)}
            </p>
          ) : null}
          {park !== null ? (
            <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-warn">
              parked · {park.code ?? "uncoded"} · {park.reason}
              <span className="block pl-3 text-faint [overflow-wrap:anywhere]">{park.unlockText}</span>
              <span className="block pl-3 text-faint">
                resume at P{park.resumePhase} · {park.resumeAction} · parked {agoLabel(park.at)} ago
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {hitl ? (
        <div className="mt-3 border-t border-line pt-2">
          <p className="font-mono text-[11px] text-warn">
            Human approval requested — {hitl.title}
            {hitl.forceHuman ? " · human-only (autopilot may not approve)" : ""}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-fg/90 [overflow-wrap:anywhere]">{hitl.prompt}</p>
          <p className="mt-0.5 font-mono text-[11px] text-faint">
            stakes: <span className="[overflow-wrap:anywhere]">{hitl.stakes}</span>
            {hitl.requestedAt !== undefined ? ` · requested ${agoLabel(hitl.requestedAt)} ago` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The pipeline view: rail + now-line + click-for-detail. Additive sibling of
 * `PhaseProgressRail` (mounted after it by the console). Read-only — nothing
 * here mutates the store.
 */
export function PipelineRail({ project }: { project: Project }) {
  const [snap, setSnap] = useState(() => rtSnapshot());
  const [openPhase, setOpenPhase] = useState<PhaseId | null>(null);

  // Same bounded poll as the runtime panes; the ring is per page-load and tiny.
  useEffect(() => {
    const id = setInterval(() => setSnap(rtSnapshot()), SNAP_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const done = project.phases.filter((r) => r.status === "complete").length;
  const total = PHASES.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const wildActive = project.wildRun !== null && project.wildRun !== undefined && project.wildRun.active === true;
  const now = pickNowLine(project, snap.tail, snap.stats.rows);

  // Per-phase attention rows — all real fields (mirrors + extends PhaseProgressRail).
  const attention: { code: string; word: string; tone: string }[] = [];
  for (const p of PHASES) {
    const rec = project.phases.find((r) => r.id === p.id);
    const st = rec?.status ?? "locked";
    if (st === "rejected") {
      attention.push({ code: p.code, word: rec?.rejectionNote ? `Rejected — ${clip(rec.rejectionNote)}` : "Rejected", tone: "text-danger" });
    } else if (st === "awaiting_hitl") {
      attention.push({ code: p.code, word: "Awaiting approval", tone: "text-warn" });
    }
  }
  if (project.status === "blocked") {
    const cur = PHASE_BY_ID.get(project.currentPhase);
    attention.push({ code: cur?.code ?? `P${project.currentPhase}`, word: "Blocked — review the notes", tone: "text-danger" });
  }
  // B-08 gate (308_bugmap FIX-D · payload of 310 B6): render the park record
  // only while the run is ACTUALLY paused. `stopWildRun` (store.ts:1281-1288)
  // and `toggleWildPause` (:1289-1296) leave `park` in place ⇒ the ungated row
  // kept claiming "Parked" for a stopped/resumed run (probe-proven stale render
  // — 310 B6). The record is the CURRENT pause's why/unlock/re-entry
  // (WildParkInfo, written by engine.wildPause/wildOperatorPark + parkIfNull).
  const park = project.wildRun && project.wildRun.pause === true ? project.wildRun.park ?? null : null;
  // §5.2/§5.3 stall latch (ring sidecar). W307 U2 delivered this component but
  // it had ZERO importers until W309 A6 mounted it in console's RunScreen — so
  // the old "First real reader" claim was false at delivery (zero readers) and
  // holds only from the mount, precisely stated: this is the latch's first
  // CONTINUOUS app-surface reader (the Diagnose pane's buildClientDiagnosis
  // folds r.stall into its JSON on click only — rt-client.ts:663). It reads the
  // latch through the rtSnapshot ring view (`snap.ring.stall`, raw RtRing), NOT
  // `peekStall()` (test-only consumers). Writer: installRtClient's heartbeat
  // ("mainthread-stall", critical lag while a busy run ticks — rt-client.ts:528).
  // Read path pinned in rt-client.test.ts (M4-02, 309 A6).
  const stall = snap.ring.stall;

  return (
    <section className="border-b border-line px-5 py-3" aria-label="Pipeline rail and telemetry">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-medium tracking-widest text-faint uppercase">Pipeline</p>
        <p className="font-mono text-[10px] text-faint tabular-nums">
          {done}/{total} sealed · {pct}% · project {PROJECT_STATUS_WORD[project.status]}
        </p>
      </div>

      <ol className="mt-2 flex gap-1" aria-label="Phase rail P0 to P12 — activate a phase for detail">
        {PHASES.map((p) => {
          const rec = project.phases.find((r) => r.id === p.id);
          const status: PhaseStatus = rec?.status ?? "locked";
          const isCurrent = project.currentPhase === p.id;
          const meta = segmentMeta(status, isCurrent, project.status === "blocked", wildActive);
          const open = openPhase === p.id;
          return (
            <li key={p.id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setOpenPhase((prev) => (prev === p.id ? null : p.id))}
                aria-expanded={open}
                aria-controls={open ? "pipeline-rail-detail" : undefined}
                aria-label={`${p.code} · ${p.title} · ${meta.word} — ${open ? "hide" : "show"} detail`}
                title={`${p.code} · ${p.title} · ${meta.word}`}
                className="block w-full rounded-sm focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <span
                  aria-hidden="true"
                  className={`rail-seg block h-2 w-full rounded-full ${meta.tone} ${isCurrent ? "rail-current" : ""}`}
                />
                <span
                  className={`rail-lbl ${meta.lblCls} mt-1 block truncate text-center font-mono text-[11px] leading-none text-faint`}
                >
                  {p.code}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-xs">
        <span className="text-faint">{now.source === "idle" ? "IDLE" : now.source.toUpperCase()}</span>
        {now.ts !== null ? <span className="text-faint tabular-nums">{clockLabel(now.ts)}</span> : null}
        {now.event !== null ? <span className="text-fg">{now.event}</span> : null}
        {now.code !== null ? <span className="text-accent">{now.code}</span> : null}
        {now.phase !== null ? <span className="text-faint">P{now.phase}</span> : null}
        {now.count !== null ? <span className="text-faint">×{now.count} repeats</span> : null}
        <span className={`${now.tone} [overflow-wrap:anywhere]`}>{now.text}</span>
      </div>
      <p className="mt-0.5 font-mono text-[10px] text-faint">{now.note}</p>

      {attention.length > 0 || park !== null || stall !== null ? (
        <div className="mt-1.5 space-y-0.5 font-mono text-[11px] leading-relaxed">
          {stall !== null ? (
            <p className={stall.class === "step-overdue" ? "text-warn" : "text-danger"}>
              Stalled · {stall.class} · step {stall.stepElapsedMs}ms · since {agoLabel(stall.since)} ago
              {stall.projectId !== null ? ` · ${stall.projectId}` : ""}
            </p>
          ) : null}
          {attention.map((a) => (
            <p key={a.code + a.word} className={a.tone}>
              Needs you: {a.code} · {a.word}
            </p>
          ))}
          {park !== null ? (
            <p className="text-warn">
              Parked · {park.code ?? "uncoded"} · {park.reason}
              <span className="block pl-3 text-faint [overflow-wrap:anywhere]">{park.unlockText}</span>
              {/* 310 B6: the rail-level row now answers WHERE a resume re-enters
                  too (same re-entry line the detail block renders) — additive. */}
              <span className="block pl-3 text-faint">
                resume at P{park.resumePhase} · {park.resumeAction} · parked {agoLabel(park.at)} ago
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {openPhase !== null ? (
        <PhaseRecordDetail project={project} phase={openPhase} onClose={() => setOpenPhase(null)} />
      ) : null}
    </section>
  );
}
