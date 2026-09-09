import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Copy,
  Download,
  FastForward,
  Keyboard,
  Loader2,
  Lock,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Square,
  Sun,
  Undo2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { PHASES, phaseDef } from "@/lib/phases";
import { runCrew } from "@/lib/crew";
import { persistStorageHealth, useRapid } from "@/lib/store";
import { BRIEF_TEMPLATES } from "@/lib/templates";
import { estimateTokens } from "@/lib/algorithms";
import { DOD } from "@/lib/dod";
import { approvalHealth } from "@/lib/gate-stats";
import { downloadFilename, exportPacketText, exportProjectJson, slugName } from "@/lib/io";
import { phaseHandoff } from "@/lib/handoff";
import type { Artifact, ChatLogRow, JsonLog, PhaseId, PhaseRecord, PhaseStatus, Project } from "@/lib/types";
import {
  buildVaultNotes,
  searchVault,
  vaultMarkdown,
  type VaultNote,
} from "@/lib/vault";
// Design-system + diagram generators (sibling lib modules, client-safe pure).
// DesignPane/DiagramPane normalize their exports defensively, so the tabs keep
// rendering whatever token layout / SVG shape design.ts & diagram.ts ship.
import { designHtml, designTokens } from "@/lib/design";
import { buildDiagram, type DiagramKind } from "@/lib/diagram";
// Markdown block renderer (sibling lib module, client-safe pure). Packet and
// artifact bodies render through renderMarkdownBlocks; MarkdownBody normalizes
// its output defensively so the views survive drift in the sibling's shape
// (and never fall back to innerHTML).
import { renderMarkdownBlocks } from "@/lib/render";
// Grounded copilot chat + error-code taxonomy (sibling lib modules — see
// research/multiagent/19_chat_integration_plan.md; static import is the gate
// that errors.ts / chat.ts landed). chat.ts does not re-export ChatTurn, so
// the history type is declared structurally (matches chat.server.ts's shape).
import { chatContextInfo, chatHistoryTurns, chatOnce, chatStampVersion, failedSendPrompt } from "@/lib/chat";
import { ERROR_CODE_DOC } from "@/lib/errors";
import { buildClientDiagnosis, reportRt, rtSnapshot, setBusyProbe } from "@/lib/rt-client";
import { WILD_STEP_BUDGET_MS } from "@/lib/rt-events";

/** One prior copilot turn — structural ChatTurn (chat.server.ts shape). */
type ChatTurn = { role: "user" | "assistant"; text: string };

/** Single source of truth for PhaseStatus presentation (BUG-19): tone class, glyph shape, sr-only label. */
const PHASE_STATUS_META: Record<
  PhaseStatus,
  { glyph: ReactNode; tone: string; label: string }
> = {
  complete: { glyph: <Check className="h-3.5 w-3.5 shrink-0" />, tone: "text-ok", label: "Complete" },
  locked: { glyph: <Lock className="h-3.5 w-3.5 shrink-0" />, tone: "text-faint", label: "Locked" },
  rejected: { glyph: <X className="h-3.5 w-3.5 shrink-0" />, tone: "text-danger", label: "Rejected" },
  running: {
    glyph: <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-current" />,
    tone: "text-accent",
    label: "Running",
  },
  awaiting_hitl: {
    glyph: <Shield className="h-3.5 w-3.5 shrink-0" />,
    tone: "text-warn",
    label: "Awaiting human approval",
  },
  ready: {
    glyph: <span className="h-2 w-2 shrink-0 rounded-full border border-current" />,
    tone: "text-fg",
    label: "Ready",
  },
};

function PhaseGlyph({ status }: { status: PhaseStatus }) {
  const meta = PHASE_STATUS_META[status];
  return (
    <span className="shrink-0">
      <span aria-hidden="true" className={`inline-flex items-center ${meta.tone}`}>
        {meta.glyph}
      </span>
      <span className="sr-only">{meta.label}</span>
    </span>
  );
}

type RunTab = "artifacts" | "packet" | "spec" | "crew" | "oracle" | "design" | "diagram" | "chat" | "vault" | "runtime";

/** One crew message rendered in the post-run panel (view over crew.ts CrewMessage). */
type CrewMsgView = {
  seq: number;
  role: string;
  type: string;
  to: string;
  content: string;
  artifactTitles: string[];
};

/** Outcome of the latest “Spawn crew” run, kept on screen until the next run. */
type CrewRunView = {
  ok: boolean;
  /** false when the run completed but artifact ingestion into the store failed. */
  ingested?: boolean;
  /** crew.ts CrewStopReason ("done" | "final" | "max-steps" | "cost-limit"). */
  stopped?: string;
  reason?: string;
  messages: CrewMsgView[];
};

export type EvidenceRow = { id: string; text: string; tone: "ok" | "danger" | "faint" };

/** E-07 provenance label on Project.lastTest (optional; legacy payloads lack it). */
type LastTestWithLabel = { ok: boolean; detail: string; label?: string };

const LAST_TEST_LABEL_TEXT: Record<string, string> = {
  "self-test": "self-test (template)",
  "real-run": "real run (bounded)",
  tested: "tested (machine-run)",
};

/**
 * Honest caption for a lastTest row — NEVER "sandbox" (E-03/E-21). The E-07
 * `label` field says where the verdict came from; rows without it (legacy
 * payloads, pre-label real-run merges) get the neutral "last test" wording so
 * the UI never claims a provenance it cannot see.
 */
function lastTestCaption(lt: { ok: boolean; detail: string } | null): string | null {
  if (!lt) return null;
  const raw = (lt as LastTestWithLabel).label;
  const who = raw ? (LAST_TEST_LABEL_TEXT[raw] ?? `test (${raw})`) : "last test";
  return `${who} ${lt.ok ? "pass" : "fail"} · ${lt.detail}`;
}

/** Assemble the read-only evidence bundle shown before a HITL gate decision (E-102). */
function evidenceForGate(project: Project): EvidenceRow[] {
  const h = project.hitl;
  if (!h) return [];
  const rows: EvidenceRow[] = [];
  const lt = project.lastTest;
  const test = lt ? lastTestCaption(lt) : null;
  if (lt && test) {
    rows.push({
      id: "last-test",
      text: test,
      tone: lt.ok ? "ok" : "danger",
    });
  }
  if (project.oracle.length > 0) {
    const names = project.oracle.slice(0, 3).map((t) => t.name);
    rows.push({
      id: "oracle",
      text: `Oracle ${project.oracle.length} case${project.oracle.length === 1 ? "" : "s"}${
        names.length ? ` (${names.join(", ")}${project.oracle.length > 3 ? ", …" : ""})` : ""
      }`,
      tone: "ok",
    });
  }
  if (project.contracts) {
    const entities = project.contracts.entities.map((e) => e.name).join(", ") || "—";
    rows.push({
      id: "contracts",
      text: `Contracts · ${entities} · ${project.contracts.endpoints.length} endpoints`,
      tone: "ok",
    });
  }
  for (const a of project.artifacts.filter((x) => x.phase === h.phase).slice(0, 4)) {
    rows.push({ id: `artifact-${a.id}`, text: `P${a.phase} · ${a.kind} · ${a.title}`, tone: "faint" });
  }
  if (project.specGraph && project.specGraph.order.length > 0) {
    rows.push({
      id: "spec",
      text: `Spec order · ${project.specGraph.order.length} file${
        project.specGraph.order.length === 1 ? "" : "s"
      }`,
      tone: "ok",
    });
  }
  const reviewer = project.crew.find((c) => c.role === "reviewer") ?? project.crew[0];
  if (reviewer) {
    rows.push({
      id: "crew",
      text: `Reviewer · ${reviewer.role}: ${reviewer.mandate}`,
      tone: "faint",
    });
  }
  return rows;
}

/** Human delta label for decision timestamps (41s · 2m12s · 3h5m). */
function agoLabel(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60}s`;
  return `${Math.floor(m / 60)}h${m % 60}m`;
}

function clip60(note: string): string {
  return note.length > 60 ? `${note.slice(0, 60)}…` : note;
}

/** HH:MM local clock label for the last-saved indicator. */
function fmtClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ---------- Wild Mode (B7 pillar: unattended auto-run loop UI) ----------
   The Wild-Mode store contract has landed (RapidState.setWildMode /
   startWildRun / stopWildRun / toggleWildPause — store.ts P13, B7 names in
   fixes/68_pillars_ui.md), so this UI binds to it STATICALLY: every affordance
   below calls the typed store action directly (never a runtime name lookup)
   and only surfaces genuine failures. project.wildMode / project.wildRun are
   read structurally for display normalization; a paused run shows PAUSED, an
   ended one STOPPED — no local-only toggle, no "not wired" labels remain. */

const WILD_POLL_MS = 1100;

type WildRunShape = {
  active?: boolean;
  /** Canonical (B6 types.ts WildRunState) pause flag — legacy alias `paused` also accepted. */
  pause?: boolean;
  paused?: boolean;
  startedAt?: number | null;
  updatedAt?: number;
  /** Frontier phase the unattended loop is at (B6 WildRunState.phase). */
  phase?: number;
  stoppedAt?: number | null;
  /** Newest unattended activity line (string or {text|detail|log|message, ts?}). */
  lastAutoLog?: unknown;
  /** Timestamp of the newest activity line (B6 WildRunState.lastAutoAt). */
  lastAutoAt?: number | null;
  /** Optional appended activity log (array of the same union). */
  autoLogs?: unknown;
};

type WildEntryKind = "auto" | "decision" | "log";
type WildTone = "ok" | "warn" | "danger" | "faint" | "wild";

type WildEntryView = { id: string; ts: number; kind: WildEntryKind; text: string; tone: WildTone };

/** Pull a display string (+ optional ts) out of a free-form auto-log value. */
function wildRecordOf(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function wildTextOf(v: unknown): { text: string; ts: number | null } | null {
  if (typeof v === "string") return v.length > 0 ? { text: v, ts: null } : null;
  const o = wildRecordOf(v);
  if (!o) return null;
  const text =
    (typeof o.text === "string" && o.text.length > 0
      ? o.text
      : typeof o.detail === "string" && o.detail.length > 0
        ? o.detail
        : typeof o.log === "string" && o.log.length > 0
          ? o.log
          : typeof o.message === "string" && o.message.length > 0
            ? o.message
            : typeof o.note === "string" && o.note.length > 0
              ? o.note
              : "") || "";
  if (!text) return null;
  const ts =
    typeof o.ts === "number" ? o.ts : typeof o.at === "number" ? o.at : null;
  return { text, ts };
}

/** Structural read of project.wildMode + project.wildRun (pre/post contract safe). */
function wildStateOf(project: Project): { enabled: boolean; run: WildRunShape | null } {
  const rec = project as unknown as { wildMode?: unknown; wildRun?: unknown };
  const runRaw = wildRecordOf(rec.wildRun);
  const run: WildRunShape | null = runRaw
    ? {
        active: runRaw.active === true,
        pause: runRaw.pause === true,
        paused: runRaw.paused === true,
        startedAt: typeof runRaw.startedAt === "number" ? runRaw.startedAt : undefined,
        updatedAt: typeof runRaw.updatedAt === "number" ? runRaw.updatedAt : undefined,
        phase: typeof runRaw.phase === "number" ? runRaw.phase : undefined,
        stoppedAt: typeof runRaw.stoppedAt === "number" ? runRaw.stoppedAt : undefined,
        lastAutoLog: runRaw.lastAutoLog,
        lastAutoAt: typeof runRaw.lastAutoAt === "number" ? runRaw.lastAutoAt : undefined,
        autoLogs: runRaw.autoLogs,
      }
    : null;
  return { enabled: rec.wildMode === true, run };
}

/** Pause flag across the canonical (pause) and legacy (paused) spellings. */
function wildPaused(run: WildRunShape | null): boolean {
  return run !== null && (run.pause === true || run.paused === true);
}

/** Shared pill chrome for phase-state badges (B7: DRAFT / IN REVIEW / COMPLETE /
 *  BLOCKED / RUNNING / WILD MODE RUNNING / LOCKED). Distinct colors per state. */
const BADGE_TONES = {
  ok: "border-ok/40 bg-ok/10 text-ok",
  warn: "border-warn/40 bg-warn/10 text-warn",
  danger: "border-danger/40 bg-danger/10 text-danger",
  accent: "border-accent/40 bg-accent/10 text-accent",
  wild: "border-wild/50 bg-wild/10 text-wild",
  muted: "border-border bg-raised text-muted",
  faint: "border-border/70 text-faint",
} as const;

function StatusBadge({
  project,
  phase,
  className = "",
}: {
  project: Project;
  phase: PhaseId;
  className?: string;
}) {
  const rec = project.phases[phase];
  if (!rec) return null;
  const wild = wildStateOf(project).enabled;
  const isCurrentBlocked = project.status === "blocked" && project.currentPhase === phase;
  let label = "";
  let tone: keyof typeof BADGE_TONES = "muted";
  let live = false;
  let liveWild = false;
  switch (rec.status) {
    case "complete":
      label = "COMPLETE";
      tone = "ok";
      break;
    case "awaiting_hitl":
      label = "IN REVIEW";
      tone = "warn";
      break;
    case "rejected":
      label = "BLOCKED";
      tone = "danger";
      break;
    case "running":
      label = wild ? "WILD MODE RUNNING" : "RUNNING";
      tone = wild ? "wild" : "accent";
      live = true;
      liveWild = wild;
      break;
    case "ready":
      label = "DRAFT";
      tone = "muted";
      break;
    default:
      label = "LOCKED";
      tone = "faint";
      break;
  }
  if (isCurrentBlocked && rec.status !== "rejected") {
    label = "BLOCKED";
    tone = "danger";
  }
  if (rec.status === "locked" && !isCurrentBlocked) return null;
  return (
    <span
      className={`rt-badge inline-flex max-w-full items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-[9px] font-medium tracking-wider whitespace-nowrap ${BADGE_TONES[tone]} ${className}`}
      title={`${PHASES[phase].code} · ${label}`}
    >
      {live ? (
        <span
          aria-hidden="true"
          className={`h-1 w-1 shrink-0 rounded-full bg-current ${liveWild ? "wild-live-dot" : "animate-pulse"}`}
        />
      ) : null}
      <span className="sr-only">{PHASES[phase].code} </span>
      {label}
    </span>
  );
}

/** Header toggle: bound directly to project.wildMode (the P13 store contract
 *  has landed) — flipping calls setWildMode statically and starts the
 *  autonomous loop via startWildRun when enabling. No local-only fallback, no
 *  "not wired" labels: the action either runs or surfaces a genuine error. */
function WildToggle({ project }: { project: Project }) {
  const wild = wildStateOf(project);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const errTimer = useRef<number | null>(null);
  const active = wild.enabled;

  useEffect(() => {
    return () => {
      if (errTimer.current !== null) window.clearTimeout(errTimer.current);
    };
  }, []);

  async function flip() {
    if (pending) return;
    setPending(true);
    // Read the LIVE store state — the prop snapshot may be stale by click
    // time — so the toggle always flips the current edge.
    const live = useRapid
      .getState()
      .projects.find((p) => p.id === project.id);
    const liveEnabled = live ? wildStateOf(live).enabled : wild.enabled;
    const target = !liveEnabled;
    try {
      // Direct static call on the typed RapidState contract (never a runtime
      // name lookup — the shim era is over).
      useRapid.getState().setWildMode(project.id, target);
      setErr(null);
      if (target) {
        // Enabling Wild Mode starts the autonomous loop. startWildRun is an
        // async store action that drives the bounded loop and resolves to an
        // honest result; the WildConsole strip below observes wildRun by
        // polling, so this is intentionally fire-and-forget.
        void useRapid.getState().startWildRun(project.id);
      }
    } catch (errCaught) {
      setErr(errCaught instanceof Error ? errCaught.message : String(errCaught));
    }
    setPending(false);
    if (errTimer.current !== null) window.clearTimeout(errTimer.current);
    errTimer.current = window.setTimeout(() => setErr(null), 4000);
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        onClick={() => void flip()}
        disabled={pending}
        title={
          active
            ? "Wild mode on — unattended auto-run to the next human gate"
            : "Wild mode off — run gates are handled by hand"
        }
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-sm border px-2 outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60 ${
          active
            ? "border-wild/60 bg-wild/10 text-wild"
            : "border-border text-muted hover:border-accent/40 hover:text-fg"
        }`}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span>Wild</span>
        {active ? (
          <span aria-hidden="true" className="wild-live-dot h-1.5 w-1.5 rounded-full bg-current" />
        ) : null}
      </button>
      <span role="status" className="sr-only">
        {active ? "Wild mode on" : "Wild mode off"}
        {err ? ` — ${err}` : ""}
      </span>
    </span>
  );
}

/**
 * Wild activity strip: lives under the phase progress rail while wild mode is
 * on (or a wildRun exists). Emergency PAUSE / RESUME, run clock, and a live
 * streaming feed assembled by polling the store — lastAutoLog deltas, the
 * autoLogs array when the sibling ships one, ledger auto-decisions
 * (decidedBy "autopilot") and wild./autopilot.* log events. Polling is
 * getState()-based and incremental (ref cursors), so it never re-renders the
 * console and only updates the strip when a row actually arrives.
 */
function WildConsole({ project }: { project: Project }) {
  const projectId = project.id;
  const wild = wildStateOf(project);
  const runSeen =
    wild.run !== null &&
    (wild.run.active === true ||
      wild.run.lastAutoLog !== undefined ||
      wild.run.autoLogs !== undefined ||
      wild.run.updatedAt !== undefined);
  const running = wild.run?.active === true && !wildPaused(wild.run);
  const [feed, setFeed] = useState<WildEntryView[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pause" | "resume" | "stop" | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  // Incremental cursors — the strip only re-renders on real activity.
  const seenLast = useRef<string | null>(null);
  const decisionsAt = useRef(-1);
  const logsAt = useRef(-1);
  const autoLogsAt = useRef(-1);

  // PB-04: register the LIVE busy probe so the rt-client heartbeat chain
  // (sys.heartbeat_lag → sys.mainthread_stall) sees a console-driven wild run.
  useEffect(() => {
    setBusyProbe(() => {
      const st = useRapid.getState();
      const p = st.projects.find((x) => x.id === projectId);
      if (!p) return null;
      const run = wildStateOf(p).run;
      if (!run || run.active !== true) return null;
      return {
        projectId,
        phase: typeof run.phase === "number" ? run.phase : null,
        active: true,
        pause: wildPaused(run),
        startedAt: typeof run.startedAt === "number" ? run.startedAt : null,
        lastAutoAt: typeof run.lastAutoAt === "number" ? run.lastAutoAt : null,
      };
    });
    return () => setBusyProbe(null);
  }, [projectId]);

  useEffect(() => {
    // Prime with existing history once per project, then stream deltas.
    const st = useRapid.getState();
    const proj = st.projects.find((p) => p.id === projectId);
    if (!proj) return;
    const w = wildStateOf(proj);
    const prime: WildEntryView[] = [];
    const pushPrime = (
      id: string,
      ts: number,
      kind: WildEntryKind,
      text: string,
      tone: WildTone,
    ) => {
      prime.push({ id, ts, kind, text, tone });
    };
    if (w.run?.autoLogs && Array.isArray(w.run.autoLogs)) {
      w.run.autoLogs.forEach((raw, i) => {
        const t = wildTextOf(raw);
        if (t) pushPrime(`a-${i}`, t.ts ?? proj.createdAt, "auto", t.text, "wild");
      });
      autoLogsAt.current = w.run.autoLogs.length;
    }
    proj.decisions.forEach((d) => {
      if (d.decidedBy !== "autopilot") return;
      pushPrime(
        `d-${d.id}`,
        d.decidedAt,
        "decision",
        `auto-${d.decision} · P${d.phase} · ${d.title}${d.note ? ` — ${clip60(d.note)}` : ""}`,
        d.decision === "approve" ? "ok" : "danger",
      );
    });
    decisionsAt.current = proj.decisions.length;
    proj.logs.forEach((l, i) => {
      if (!/^(wild|autopilot)\./.test(l.event)) return;
      pushPrime(`l-${l.ts}-${i}`, l.ts, "log", `${l.event}: ${l.detail}`, "warn");
    });
    logsAt.current = proj.logs.length;
    prime.sort((a, b) => b.ts - a.ts);
    if (prime.length) setFeed(prime.slice(0, 40));
  }, [projectId]);

  useEffect(() => {
    if (!wild.enabled && !runSeen) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      setClock(Date.now());
      const st = useRapid.getState();
      const proj = st.projects.find((p) => p.id === projectId);
      if (!proj) return;
      const w = wildStateOf(proj);
      const rows: WildEntryView[] = [];
      // 1) lastAutoLog — a single streaming "latest activity" line.
      const last = w.run ? wildTextOf(w.run.lastAutoLog) : null;
      if (last) {
        const key = `${last.ts ?? 0}|${last.text}`;
        if (seenLast.current !== key) {
          seenLast.current = key;
          const ts = last.ts ?? Date.now();
          rows.push({ id: `last-${key}`, ts, kind: "auto", text: last.text, tone: "wild" });
        }
      }
      // 2) autoLogs — append-only activity log when the sibling ships one.
      if (w.run?.autoLogs && Array.isArray(w.run.autoLogs)) {
        const arr = w.run.autoLogs as unknown[];
        if (autoLogsAt.current > arr.length) autoLogsAt.current = -1; // ledger shrank — reset
        for (let i = autoLogsAt.current < 0 ? 0 : autoLogsAt.current; i < arr.length; i++) {
          const t = wildTextOf(arr[i]);
          if (t) rows.push({ id: `a-${i}`, ts: t.ts ?? Date.now(), kind: "auto", text: t.text, tone: "wild" });
        }
        autoLogsAt.current = arr.length;
      }
      // 3) ledger auto-decisions (decidedBy "autopilot").
      const decs = proj.decisions;
      if (decisionsAt.current > decs.length) decisionsAt.current = -1;
      for (let i = decisionsAt.current < 0 ? 0 : decisionsAt.current; i < decs.length; i++) {
        const d = decs[i];
        if (d.decidedBy !== "autopilot") continue;
        rows.push({
          id: `d-${d.id}`,
          ts: d.decidedAt,
          kind: "decision",
          text: `auto-${d.decision} · P${d.phase} · ${d.title}${d.note ? ` — ${clip60(d.note)}` : ""}`,
          tone: d.decision === "approve" ? "ok" : "danger",
        });
      }
      decisionsAt.current = decs.length;
      // 4) wild./autopilot.* diagnostic events.
      const logs = proj.logs;
      if (logsAt.current > logs.length) logsAt.current = -1;
      for (let i = logsAt.current < 0 ? 0 : logsAt.current; i < logs.length; i++) {
        const l = logs[i];
        if (!/^(wild|autopilot)\./.test(l.event)) continue;
        rows.push({ id: `l-${l.ts}-${i}`, ts: l.ts, kind: "log", text: `${l.event}: ${l.detail}`, tone: "warn" });
      }
      logsAt.current = logs.length;
      if (rows.length) {
        setFeed((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          const fresh = rows.filter((r) => !seen.has(r.id));
          return fresh.length ? [...fresh, ...prev].sort((a, b) => b.ts - a.ts).slice(0, 40) : prev;
        });
      }
    };
    tick();
    const iv = window.setInterval(tick, WILD_POLL_MS);
    // 109 CAP-D watchdog: heartbeat + stale-run stall telemetry from the SAME
    // poll — a frozen loop still stamps heartbeats here, so the gap between
    // them is the stall signal. Bounded (every 10th tick) + coalesced.
    let hbTicks = 0;
    const hb = window.setInterval(() => {
      hbTicks += 1;
      if (hbTicks % 10 !== 0) return;
      try {
        reportRt({
          level: "info",
          scope: "wild-driver",
          event: "sys.heartbeat",
          message: "Wild feed poll alive",
          capture: "src/components/console.tsx:WildFeed watchdog",
        });
        const live = useRapid.getState().projects.find((p) => p.id === projectId);
        const run = live ? wildStateOf(live).run : null;
        if (run && run.active && !wildPaused(run) && typeof run.lastAutoAt === "number") {
          if (Date.now() - run.lastAutoAt > WILD_STEP_BUDGET_MS) {
            reportRt({
              level: "error",
              scope: "wild-step",
              event: "wild.step_timeout",
              message: `Wild run P${run.phase ?? "?"} stale ${Math.round((Date.now() - run.lastAutoAt) / 1000)}s past budget`,
              capture: "src/components/console.tsx:WildFeed watchdog",
              code: "RT_E_LLM_TIMEOUT",
              phase: run.phase ?? null,
              projectId,
            });
          }
        }
      } catch {
        /* watchdog must never take the feed down */
      }
    }, WILD_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(iv);
      window.clearInterval(hb);
    };
  }, [projectId, wild.enabled, runSeen]);

  const visible = wild.enabled || runSeen || feed.length > 0 || note !== null;
  if (!visible) return null;

  async function onPauseToggle() {
    // Read live state — the prop snapshot may be stale by click time.
    const live = useRapid
      .getState()
      .projects.find((p) => p.id === projectId);
    const paused = live ? wildPaused(wildStateOf(live).run) : wildPaused(wild.run);
    setBusy(paused ? "resume" : "pause");
    try {
      if (paused) {
        // fixes/144 M1-L3 (g3 finding): a paused run has NO driver — the
        // loop that parked it already exited. Resuming must RE-ENTER the
        // driver, which is exactly startWildRun's tested PA-01 resume path
        // (store.ts:900-916, store.test.ts:956-971). toggleWildPause alone
        // would clear the flag and leave an active:true, pause:false run
        // with nothing stepping it — rendered RUNNING but driverless.
        // Fire-and-forget like the Wild enable toggle (the driver parks
        // itself at the next gate/cap; the store's single-flight latch
        // refuses a genuine double-start), and surface a later failure via
        // the strip note instead of holding the buttons busy for the run.
        void useRapid.getState().startWildRun(projectId).then(
          (res) => {
            if (!res.ok) setNote(res.error && res.error.length > 0 ? res.error : "Could not resume the wild run.");
          },
          (errCaught: unknown) => {
            setNote(errCaught instanceof Error ? errCaught.message : String(errCaught));
          },
        );
        setNote(null);
      } else {
        // Pausing an actively stepping run: the store's toggleWildPause flips
        // the run's pause flag (the contract ships a toggle, not a setter) —
        // the UI computed the target edge from the live state above, so this
        // lands on the same side. The running driver exits at the next phase
        // boundary; the resume branch above re-enters it later.
        useRapid.getState().toggleWildPause(projectId);
        setNote(null);
      }
    } catch (errCaught) {
      setNote(errCaught instanceof Error ? errCaught.message : String(errCaught));
    } finally {
      setBusy(null);
    }
  }

  async function onStop() {
    setBusy("stop"); // PB-05a: the Stop button gets its own busy mode
    try {
      useRapid.getState().stopWildRun(projectId);
      setNote("Wild run stopped.");
    } catch (errCaught) {
      setNote(errCaught instanceof Error ? errCaught.message : String(errCaught));
    } finally {
      setBusy(null);
    }
  }

  const startedAt = wild.run?.startedAt;

  return (
    <div role="region" aria-label="Wild mode activity" className="border-b border-line bg-surface/50 px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p
          className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-widest ${
            running ? "text-wild" : wildPaused(wild.run) ? "text-warn" : "text-faint"
          }`}
        >
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          WILD MODE
        </p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider ${
            running
              ? "border-wild/50 bg-wild/10 text-wild"
              : wild.run?.paused === true
                ? "border-warn/40 bg-warn/10 text-warn"
                : "border-border text-muted"
          }`}
        >
          {running ? (
            <>
              <span aria-hidden="true" className="wild-live-dot h-1.5 w-1.5 rounded-full bg-current" />
              RUNNING
            </>
          ) : wild.run?.pause === true ? (
            "PAUSED"
          ) : wild.run?.active === true ? (
            "STOPPED"
          ) : wild.run !== null ? (
            "STOPPED"
          ) : (
            "IDLE"
          )}
        </span>
        {startedAt != null ? (
          <span className="font-mono text-[10px] text-faint tabular-nums">
            since {Math.max(0, Math.round((clock - startedAt) / 1000))}s
          </span>
        ) : null}
        <span className="flex-1" />
        {wild.run?.active === true ? (
          <button
            type="button"
            onClick={() => void onPauseToggle()}
            disabled={busy !== null}
            title={
              running
                ? "Emergency pause — stop the unattended loop at the next phase boundary"
                : "Resume the unattended run — re-enters the wild driver at the current phase"
            }
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium disabled:cursor-default disabled:opacity-40 ${
              running
                ? "border-danger/50 bg-danger/10 text-danger hover:bg-danger/20"
                : "border-border text-fg hover:border-accent/40"
            }`}
          >
            {busy !== null ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : running ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {running ? "Pause" : "Resume"}
          </button>
        ) : null}
        {wild.run?.active === true || wildPaused(wild.run) ? (
          <button
            type="button"
            onClick={() => void onStop()}
            disabled={busy !== null}
            title="Emergency stop — end the unattended run entirely"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-danger/50 bg-danger/10 px-2.5 text-[11px] font-medium text-danger hover:bg-danger/20 disabled:cursor-default disabled:opacity-40"
          >
            <Square className="h-3 w-3" aria-hidden="true" />
            Stop
          </button>
        ) : null}
        {wild.run !== null && wild.run.active !== true && !wildPaused(wild.run) ? (
          <p role="status" className="w-full font-mono text-[11px] leading-relaxed text-warn">
            Run stopped after reload — the wild driver is a session artifact and cannot resume
            across page loads (a paused-at-reload run is stopped, never left paused; a stopped run
            stays stopped). Start a new run from the current phase to continue.
          </p>
        ) : null}
      </div>

      {note ? (
        <p role="alert" className="mt-2 font-mono text-[11px] leading-relaxed text-danger">
          {note}
        </p>
      ) : null}

      {feed.length > 0 ? (
        <ul className="scroll-thin mt-2 max-h-[240px] space-y-1 overflow-y-auto pr-1">
          {feed.slice(0, 30).map((r) => (
            <li
              key={r.id}
              className={`wild-row wild-row--${r.tone} flex items-baseline gap-2 rounded-sm px-1.5 py-1 font-mono text-[11px] leading-relaxed ${
                r.kind === "auto" ? "wild-row-auto text-fg/90" : "text-fg/75"
              }`}
            >
              <span className="shrink-0 text-faint tabular-nums">{fmtClock(r.ts)}</span>
              <span className="shrink-0 font-medium tracking-wide uppercase">
                <span
                  className={
                    r.tone === "wild"
                      ? "text-wild"
                      : r.tone === "ok"
                        ? "text-ok"
                        : r.tone === "danger"
                          ? "text-danger"
                          : r.tone === "warn"
                            ? "text-warn"
                            : "text-faint"
                  }
                >
                  {r.kind === "auto" ? "auto" : r.kind === "decision" ? "gate" : "log"}
                </span>
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{r.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-faint">
          {running ? (
            <>
              <span aria-hidden="true" className="wild-live-dot h-1 w-1 rounded-full bg-current" />
              listening for auto decisions…
            </>
          ) : (
            "No auto activity yet — wild mode acts silently until the next gate decision."
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Condensed AGENT_GUIDE.md content for the in-app Guide panel. Kept static and
 * honest (the full guide lives at AGENT_GUIDE.md; keys are NEVER entered here).
 */
const GUIDE_SECTIONS: { title: string; body: string }[] = [
  {
    title: "What RapidTool is",
    body: "A deterministic, governed pre-flight compiler. It turns a client brief into a paste-ready Agent Packet plus a 13-phase (P0–P12) audit trail. It does not build software itself — a real agent does the building under enforced, auditable constraints.",
  },
  {
    title: "Honesty contract",
    body: "RapidTool never fabricates research, code, or sandbox results. Items marked source:\"illustrative\" are scaffolding, not facts — verify before depending on them. DoD gates are advisory for keyless runs and enforced by default when a DeepSeek key is configured (a failing gate then parks the run) — the per-project “Enforce DoD gates” toggle in the build's sidebar relaxes or enforces.",
  },
  {
    title: "How to use a project",
    body: "Run Execute / Run-to-next-gate until the run stops at a HITL gate. Approve or reject with 12+ characters of feedback (rejections steer regeneration). When the packet describes your target phase, copy it (or download the .md) and paste it into your coding-agent session.",
  },
  {
    title: "Feed results back",
    body: "Paste Copy-phase-handoff into the agent; paste the agent's output back into the phase's Notes so it flows into the next packet compile. Export the project JSON to move a build between machines or archive it — it round-trips through Import with validation + repair.",
  },
  {
    title: "What it is not",
    body: "With DEEPSEEK_API_KEY set it calls a real LLM (DeepSeek) for phase narratives; research uses Tavily when TAVILY_API_KEY is set, otherwise free keyless DuckDuckGo/Wikipedia search. Code execution is a bounded local runner — NOT a security sandbox. It does not deploy. It persists browser-local only. Evidence hashes are FNV-1a (integrity, not cryptographic security).",
  },
];

function Mark() {
  return (
    <span className="inline-flex h-7 w-7 items-end justify-center gap-px rounded-sm bg-raised ring-1 ring-border">
      <span className="mb-1.5 h-3.5 w-1 bg-accent" />
      <span className="mb-1.5 h-2.5 w-1 bg-fg" />
      <span className="mb-1.5 h-1.5 w-1 bg-muted" />
    </span>
  );
}

/* ---------- Theme (light/dark) ---------- */

const THEME_KEY = "rapid.theme";
type Theme = "light" | "dark";

function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readTheme());
  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable — the theme still applies for this session */
    }
  }, [theme]);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={!dark}
      title={dark ? "Light mode" : "Dark mode"}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-border px-2 hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}

/* ---------- Keyboard shortcuts ---------- */

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["e"], label: "Execute current phase" },
  { keys: ["g"], label: "Run to next gate" },
  { keys: ["a"], label: "Approve — when a gate is waiting" },
  { keys: ["r"], label: "Focus the rejection note" },
  { keys: ["/"], label: "Focus artifact search" },
  { keys: ["?"], label: "Open agent guide" },
  { keys: ["Ctrl", "Enter"], label: "Execute current phase" },
  { keys: ["Ctrl", "Shift", "Enter"], label: "Run to next gate" },
  { keys: ["Ctrl", "Shift", "C"], label: "Copy agent packet" },
  { keys: ["Ctrl", "G"], label: "Toggle agent guide" },
];

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-border bg-raised px-1.5 py-0.5 font-mono text-[10px] text-fg">
      {children}
    </kbd>
  );
}

export function HomeScreen() {
  const nav = useNavigate();
  const { projects, create, select } = useRapid();
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const s = useRapid.getState();
      if (!s.hydrated) s.setHydrated(true);
      s.seedIfEmpty();
    }, 80);
    return () => window.clearTimeout(t);
  }, []);

  function launch() {
    if (brief.trim().length < 12) return;
    setBusy(true);
    const id = create(brief.trim());
    setBusy(false);
    void nav({ to: "/run/$id", params: { id } });
  }

  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <Mark />
          <div>
            <p className="font-medium tracking-tight">RapidTool</p>
            <p className="font-mono text-xs text-muted">autonomous software agency</p>
          </div>
        </div>
        <p className="hidden font-mono text-xs text-faint sm:block">phases 0–12 · graph locked</p>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:py-16">
        <section>
          <p className="font-mono text-xs tracking-widest text-accent uppercase">Governed delivery</p>
          <h1 className="mt-3 max-w-xl text-4xl font-medium leading-tight tracking-tight text-fg sm:text-5xl">
            Research first. Code second. Ship with a paper trail.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted">
            RapidTool runs a deterministic 13-phase graph with four onboard
            algorithms: Intent Lattice, FusionRank memory, Constraint Scheduler,
            and an Agent Packet compiler that turns the run into a paste-ready
            prompt for other agents. Illegal jumps are rejected.
          </p>

          <label className="mt-8 block text-xs font-medium text-muted" htmlFor="brief">
            Client brief
          </label>
          <textarea
            id="brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={6}
            placeholder="Describe the system to build — who it is for, the jobs it must do, and any hard constraints."
            className="mt-2 w-full resize-y rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-fg outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/40"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={brief.trim().length < 12 || busy}
              onClick={launch}
              className="btn-solid inline-flex min-h-11 items-center gap-2 rounded-md bg-fg px-4 text-sm font-medium text-bg disabled:opacity-40"
            >
              Open intake
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="font-mono text-xs text-faint">Phase 0 starts locked to the brief</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {BRIEF_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setBrief(t.brief)}
                className="min-h-10 rounded-md border border-border px-3 text-xs text-muted hover:text-fg"
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <aside className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Builds</h2>
            <span className="font-mono text-xs text-faint tabular-nums">{projects.length}</span>
          </div>
          <ul className="scroll-thin mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {projects.length === 0 ? (
              <li className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
                No builds yet. Paste a brief to open Phase 0.
              </li>
            ) : (
              projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      select(p.id);
                      void nav({ to: "/run/$id", params: { id: p.id } });
                    }}
                    className="flex w-full items-center justify-between rounded-md border border-border bg-raised px-3 py-3 text-left hover:border-accent/40"
                  >
                    <span>
                      <span className="block text-sm font-medium">{p.name}</span>
                      <span className="mt-0.5 block font-mono text-xs text-muted">
                        {p.domain} · P{p.currentPhase} · {p.status.replace("_", " ")}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-faint" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>
      </main>
    </div>
  );
}

export function RunScreen({ id }: { id: string }) {
  const nav = useNavigate();
  const {
    projects,
    approve,
    rejectAsync,
    retry,
    remove,
    refreshPacket,
    clone,
    rename,
    setNotes,
    exportProject,
    importProject,
    autopilot,
    setAutopilot,
    executeAsync,
    runUntilHitlAsync,
    runModuleReal,
    ingestReport,
    refreshStatuses,
    hasProject,
    llmStatus,
    researchStatus,
  } = useRapid();
  const project = projects.find((p) => p.id === id);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [crewRun, setCrewRun] = useState<CrewRunView | null>(null);
  const [busyAction, setBusyAction] = useState<null | "step" | "run" | "approve" | "reject" | "crew">(null);
  const busyRef = useRef(false);
  const copyTs = useRef(0);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedHandoff, setCopiedHandoff] = useState(false);
  const [tab, setTab] = useState<RunTab>("artifacts");
  const [query, setQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<PhaseId | "all">("all");
  const [viewPhase, setViewPhase] = useState<PhaseId | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDraft, setReportDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [prevName, setPrevName] = useState<string | null>(null);
  const undoNameTimer = useRef<number | null>(null);

  // Refresh the in-memory LLM/research status surface once on mount.
  useEffect(() => {
    void refreshStatuses();
  }, [refreshStatuses]);

  // Last-saved indicator: stamp whenever this project's state changes.
  useEffect(() => {
    if (project) setLastSaved(Date.now());
  }, [project]);

  // Clear the undo-rename toast timer on unmount.
  useEffect(() => {
    return () => {
      if (undoNameTimer.current !== null) window.clearTimeout(undoNameTimer.current);
    };
  }, []);

  // Global keyboard shortcuts for the run loop (enhancement 3.1). Reads the store
  // directly so the handler stays free of stale closures and TDZ issues.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing =
        t &&
        (t.tagName === "TEXTAREA" ||
          t.tagName === "INPUT" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);
      if (typing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "Enter") {
        e.preventDefault();
        const st = useRapid.getState();
        if (!st.projects.some((p) => p.id === id)) return;
        if (busyRef.current) return;
        if (e.shiftKey) void runUntil();
        else void run();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const p = useRapid.getState().projects.find((x) => x.id === id);
        if (!p) return;
        void navigator.clipboard.writeText(p.packet ?? "").then(
          () => setCopied(true),
          () => setError("Clipboard blocked — unable to copy the agent packet."),
        );
      } else if (mod && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setGuideOpen((v) => !v);
      } else if (!mod && !e.altKey && !e.repeat) {
        // Single-key shortcuts (enhancement 10: additive, no regressions).
        // Ignored while typing and when a modifier is held.
        const st = useRapid.getState();
        if (!st.projects.some((p) => p.id === id)) return;
        const key = e.key;
        if (key === "e" || key === "E") {
          e.preventDefault();
          if (!busyRef.current) void run();
        } else if (key === "g" || key === "G") {
          e.preventDefault();
          if (!busyRef.current) void runUntil();
        } else if (key === "a" || key === "A") {
          if (st.projects.find((x) => x.id === id)?.hitl) {
            e.preventDefault();
            onApprove();
          }
        } else if (key === "r" || key === "R") {
          if (st.projects.find((x) => x.id === id)?.hitl) {
            e.preventDefault();
            noteRef.current?.focus();
          }
        } else if (key === "/") {
          e.preventDefault();
          setTab("artifacts");
          window.setTimeout(() => searchRef.current?.focus(), 50);
        } else if (key === "?") {
          e.preventDefault();
          setGuideOpen(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const rec = project?.phases[project.currentPhase];
  const artifacts = useMemo(() => project?.artifacts ?? [], [project?.artifacts]);
  const running = rec?.status === "running";
  const visibleArtifacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return artifacts.filter(
      (a) =>
        (phaseFilter === "all" || a.phase === phaseFilter) &&
        (!q || `${a.title} ${a.kind} ${a.body}`.toLowerCase().includes(q)),
    );
  }, [artifacts, phaseFilter, query]);
  const activeArt = useMemo(() => {
    if (!visibleArtifacts.length) return null;
    const picked = selected ? visibleArtifacts.find((a) => a.id === selected) : undefined;
    return picked ?? visibleArtifacts[visibleArtifacts.length - 1];
  }, [selected, visibleArtifacts]);
  const phaseCounts = useMemo(() => {
    const counts = new Map<PhaseId, number>();
    for (const a of artifacts) counts.set(a.phase, (counts.get(a.phase) ?? 0) + 1);
    return counts;
  }, [artifacts]);
  const tokenEst = useMemo(() => estimateTokens(project?.packet ?? ""), [project?.packet]);

  if (!project) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-5">
        <p className="text-sm text-muted">This build doesn't exist or was archived.</p>
        <Link to="/" className="text-sm text-accent underline-offset-4 hover:underline">
          Back to intake
        </Link>
      </div>
    );
  }

  const projectId = project.id;
  // `project` is a narrowed `const` here, but function declarations (hoisted)
  // don't carry the control-flow narrowing into their bodies — so capture a
  // plain `Project` alias for the helper functions below.
  const current = project;

  function flashCopied(setter: (v: boolean) => void) {
    const my = ++copyTs.current;
    setter(true);
    window.setTimeout(() => {
      if (copyTs.current === my) setter(false); // UI-7: only the latest copy clears the toast
    }, 1600);
  }

  async function run() {
    if (busyRef.current) return; // UI-4: busy latch prevents double-execute
    setError(null);
    setNotice(null);
    busyRef.current = true;
    setBusyAction("step");
    try {
      const res = await executeAsync(projectId);
      if (!res.ok) setError(res.error);
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  }

  function onApprove(force = false) {
    setError(null);
    setNotice(null);
    const res = approve(projectId, { force });
    if (!res.ok) setError(res.error);
    else setNote(""); // UI-5: clear any stale rejection note after an approval
  }

  function onReject() {
    setError(null);
    setNotice(null);
    // BUG-17: the 12-char gate lives in the button's disabled attribute AND
    // here — any future caller (shortcut, AT path) cannot bypass it.
    if (note.trim().length < 12) {
      setError("Rejection note must be at least 12 characters before rejecting.");
      return;
    }
    void rejectAsync(projectId, note).then((res) => {
      if (!res.ok) setError(res.error);
      else setNote("");
    });
  }

  async function runUntil() {
    if (busyRef.current) return;
    setError(null);
    setNotice(null);
    busyRef.current = true;
    setBusyAction("run");
    try {
      const res = await runUntilHitlAsync(projectId);
      if (!res.ok) setError(res.error);
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  }

  async function onRunModule() {
    setError(null);
    setNotice(null);
    const res = await runModuleReal(projectId);
    if (!res.ok) {
      setError(res.error ?? "bounded runner unavailable");
      return;
    }
    const r = res.result as { ok?: boolean; exitCode?: number; durationMs?: number };
    setNotice(
      r && r.ok
        ? `Module ran: exit ${r.exitCode} in ${r.durationMs}ms`
        : "Module run failed — see the “Real module run” artifact for details.",
    );
  }

  function onIngestReport() {
    setError(null);
    setNotice(null);
    let raw: unknown;
    try {
      raw = JSON.parse(reportDraft);
    } catch {
      setError("Report is not valid JSON.");
      return;
    }
    const res = ingestReport(projectId, raw);
    if (!res.ok) setError(res.error ?? "Report rejected.");
    else {
      setNotice("Agent report ingested — artifacts marked “[agent report]”.");
      setReportDraft("");
      setReportOpen(false);
    }
  }

  // Advisory multi-agent crew: runCrew() dispatches one DeepSeek call per role
  // (deterministic phase→role table; crew.ts client wrapper → crew.server.ts).
  // The run is advisory — DoD gates keep ruling. Crew artifacts re-enter the
  // project through the existing ingest seam (ingestReport → validateReport +
  // applyReport), landing as “[agent report]” artifacts with the honest footer.
  async function onSpawnCrew() {
    if (busyRef.current) return; // UI-4 busy latch prevents double-spawn
    setError(null);
    setNotice(null);
    setCrewRun(null);
    busyRef.current = true;
    setBusyAction("crew");
    try {
      const res = await runCrew(current);
      if (res.ok) {
        const messages = res.messages.map((m, i) => ({
          seq: i,
          role: m.role,
          type: m.type,
          to: "",
          content: m.content,
          artifactTitles: (m.artifacts ?? []).map((a) => a.title),
        }));
        // Guard stops arrive as ok:true with an honest partial transcript
        // (crew.ts CrewStopReason): label the ingest “partial”, never “complete”.
        const partial = res.stopped === "max-steps" || res.stopped === "cost-limit";
        const last = res.messages[res.messages.length - 1];
        const rawSummary = last?.content.trim() ?? "";
        const summary =
          rawSummary.length > 400
            ? `${rawSummary.slice(0, 400)}…`
            : rawSummary ||
              `Crew run ${partial ? "partial" : "complete"} — ${res.messages.length} turn${
                res.messages.length === 1 ? "" : "s"
              } on ${PHASES[current.currentPhase].title}.`;
        const ingested = ingestReport(projectId, {
          phase: current.currentPhase,
          status: partial ? "partial" : "complete",
          summary,
          artifacts: res.artifacts.map((a) => ({ title: a.title, body: a.body })),
        });
        if (ingested.ok) {
          const n = res.artifacts.length;
          setNotice(
            partial
              ? `Crew run stopped (${res.stopped}) — ${res.messages.length} message${
                  res.messages.length === 1 ? "" : "s"
                } · ${n} artifact${n === 1 ? "" : "s"} ingested as “[agent report]” (partial).`
              : `Crew run complete — ${res.messages.length} message${
                  res.messages.length === 1 ? "" : "s"
                } · ${n} artifact${n === 1 ? "" : "s"} ingested as “[agent report]”.`,
          );
        } else {
          setError(ingested.error ?? "Crew artifacts could not be ingested.");
        }
        if (messages.length > 0) {
          setCrewRun({ ok: true, ingested: ingested.ok, stopped: res.stopped, messages });
        }
      } else {
        // Config gate / transport failure: no session was fabricated, so no
        // transcript exists — the deterministic engine result stays authoritative.
        const reason =
          res.reason === "not-configured"
            ? "no LLM backend configured — the deterministic engine stands"
            : "a crew call failed mid-run";
        setError(
          `Crew run did not start (${res.reason}): ${reason}${res.error ? ` — ${res.error}` : ""}`,
        );
      }
    } catch (err) {
      setError(`Crew run failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  }

  async function copyPacket() {
    setError(null); // UI-6: stale errors must not survive copy/export actions
    refreshPacket(projectId);
    const text = useRapid.getState().projects.find((p) => p.id === projectId)?.packet ?? "";
    try {
      await navigator.clipboard.writeText(text);
      flashCopied(setCopied);
    } catch {
      // BUG-08: surface the failure, never hijack the active tab.
      setError("Clipboard blocked — open the Agent packet tab and select the text.");
    }
  }

  async function copyHandoff() {
    setError(null);
    const text = phaseHandoff(current, current.currentPhase);
    try {
      await navigator.clipboard.writeText(text);
      flashCopied(setCopiedHandoff);
    } catch {
      setError("Clipboard blocked — unable to copy the phase handoff.");
    }
  }

  async function copyProjectJson() {
    setError(null);
    const json = exportProject(projectId) ?? exportProjectJson(current);
    try {
      await navigator.clipboard.writeText(json);
      setNotice("Project JSON copied to the clipboard.");
    } catch {
      setError("Clipboard blocked — unable to copy the project JSON.");
    }
  }

  function downloadJson() {
    setError(null);
    const json = exportProject(projectId) ?? exportProjectJson(current);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename(current);
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Project JSON exported — ${downloadFilename(current)}`);
  }

  function downloadPacket() {
    setError(null);
    const text = exportPacketText(current);
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename(current, "md");
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Agent packet downloaded — ${downloadFilename(current, "md")}`);
  }

  function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const json = typeof reader.result === "string" ? reader.result : "";
      // UI-2: guard silent same-id overwrite — confirm before replacing an existing build.
      let incomingId: string | null = null;
      try {
        const parsed = JSON.parse(json) as { id?: unknown };
        incomingId = typeof parsed.id === "string" ? parsed.id : null;
      } catch {
        incomingId = null;
      }
      if (incomingId && hasProject(incomingId)) {
        const ok = window.confirm(
          "A build with this id already exists. Replace it with the imported file?",
        );
        if (!ok) return;
      }
      const res = importProject(json);
      if (res.ok) {
        setError(null);
        setNotice(`Imported “${res.name}”${res.replaced ? " (replaced existing build)" : ""}.`);
        // UI-2: navigate to the imported project so the screen matches the store's activeId.
        void nav({ to: "/run/$id", params: { id: res.id } });
      } else {
        setError(res.error);
      }
    };
    reader.onerror = () => setError("Failed to read the selected file.");
    reader.readAsText(file);
  }

  function commitRename() {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setEditingName(false);
      return;
    }
    const prev = current.name;
    rename(projectId, trimmed);
    setPrevName(prev);
    setEditingName(false);
    if (undoNameTimer.current !== null) window.clearTimeout(undoNameTimer.current);
    undoNameTimer.current = window.setTimeout(() => setPrevName(null), 5000);
  }

  function undoRename() {
    if (prevName !== null) rename(projectId, prevName);
    setPrevName(null);
    if (undoNameTimer.current !== null) {
      window.clearTimeout(undoNameTimer.current);
      undoNameTimer.current = null;
    }
  }

  function archiveAndHome() {
    remove(projectId);
    void nav({ to: "/" });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <Mark />
            <span className="font-medium tracking-tight">RapidTool</span>
          </Link>
          <span className="hidden text-faint sm:inline">/</span>
          {editingName ? (
            <input
              aria-label="Build name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                // BUG-28: Escape cancels the edit and restores the name.
                else if (e.key === "Escape") {
                  setDraftName(project.name);
                  setEditingName(false);
                }
              }}
              className="h-9 w-40 rounded-md border border-border bg-surface px-2 text-sm"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="hidden text-sm text-muted sm:inline"
              onClick={() => {
                setDraftName(project.name);
                setEditingName(true);
              }}
            >
              {project.name}
            </button>
          )}
          {prevName !== null && !editingName ? (
            <button
              type="button"
              onClick={undoRename}
              className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-xs text-warn hover:border-accent/40"
              title={`Undo rename to “${prevName}”`}
            >
              <Undo2 className="h-3 w-3" />
              Undo rename
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
          <span className="rounded-sm border border-border px-2 py-1">{project.domain}</span>
          <StatusChip
            label={llmStatus.label}
            tone={llmStatus.configured ? "ok" : "faint"}
            title="LLM backend status"
          />
          <StatusChip
            label={`research · ${researchStatus.label}`}
            tone={researchStatus.configured ? "ok" : "faint"}
            title="Research backend status"
          />
          <span className="rounded-sm border border-border px-2 py-1">
            {project.sandbox.ramMb === null
              ? `${project.sandbox.runtime} · ${project.sandbox.timeoutS}s`
              : `${project.sandbox.runtime} · ${project.sandbox.ramMb} MB`}
          </span>
          <span
            className="rounded-sm border border-border px-2 py-1 tabular-nums"
            title={`estimate · ±15% · ${project.modelRoute}`}
          >
            ≈{tokenEst.tokensEst} tok
          </span>
          {lastSaved !== null ? (
            <span
              className="rounded-sm border border-border px-2 py-1 text-faint"
              title="Saved to this browser only"
            >
              saved {fmtClock(lastSaved)}
            </span>
          ) : null}
          <label className="inline-flex min-h-9 items-center gap-2 rounded-sm border border-border px-2">
            <input
              type="checkbox"
              checked={autopilot}
              onChange={(e) => setAutopilot(e.target.checked)}
            />
            <span>Autopilot · extra gates</span>
          </label>
          <WildToggle project={project} />
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-border px-2 hover:border-accent/40"
            title="Agent guide (Ctrl+G)"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Guide</span>
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-border px-2 hover:border-accent/40"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-border px-2 hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent/40"
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Shortcuts</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="grid flex-1 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <PhaseRail
          project={project}
          viewPhase={viewPhase}
          onViewPhase={(phase) => setViewPhase((prev) => (prev === phase ? null : phase))}
        />
        <section
          className="min-w-0 border-b border-line lg:border-b-0 lg:border-r"
          aria-busy={running || undefined}
        >
          {viewPhase !== null && viewPhase !== project.currentPhase ? (
            <PhaseRecordView
              project={project}
              phase={viewPhase}
              selected={selected}
              onSelect={setSelected}
              onBack={() => setViewPhase(null)}
            />
          ) : (
            <>
          <div className="border-b border-line px-5 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs text-accent">
                {PHASES[project.currentPhase].code}
              </p>
              <p className="font-mono text-xs text-faint">
                {rec?.status.replace("_", " ")}
              </p>
              {rec ? <StatusBadge project={project} phase={project.currentPhase} /> : null}
            </div>
            <h1 className="mt-1 text-2xl font-medium tracking-tight [overflow-wrap:anywhere]">
              {PHASES[project.currentPhase].title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {PHASES[project.currentPhase].summary}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fg/90 [overflow-wrap:anywhere]">{project.brief}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {project.status === "blocked" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      retry(project.id);
                      setError(null);
                      setNotice("Phase reopened — review the rejection notes, then re-run.");
                    }}
                    className="btn-solid inline-flex min-h-11 items-center gap-2 rounded-md bg-fg px-4 text-sm font-medium text-bg"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Retry phase with notes
                  </button>
                  {rec?.rejectionNote ? (
                    <p className="w-full font-mono text-xs text-faint">
                      rejected: {clip60(rec.rejectionNote)}
                    </p>
                  ) : null}
                  <BlockedGuidanceBlock project={project} />
                </>
              ) : project.hitl ? (
                <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-warn/40 bg-raised px-3 text-sm text-warn">
                  <Shield className="h-4 w-4" />
                  Human approval required
                </span>
              ) : project.status === "complete" ? (
                /* fixes/133 #8: a failed-gate 'complete' must never show the
                   all-green sealed posture — surface the census honestly. */
                project.phases.some((ph) => ph.status === "complete" && ph.gate && ph.gate.passed === false) ? (
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-warn/50 bg-raised px-3 text-sm text-warn">
                    <Shield className="h-4 w-4" />
                    Sealed with {project.phases.filter((ph) => ph.gate && ph.gate.passed === false).length} failed gate
                    {project.phases.filter((ph) => ph.gate && ph.gate.passed === false).length === 1 ? "" : "s"} — review the gate records
                  </span>
                ) : (
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-ok/40 bg-raised px-3 text-sm text-ok">
                    <Check className="h-4 w-4" />
                    Delivery sealed
                  </span>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={run}
                    disabled={running || busyAction !== null}
                    className="btn-solid inline-flex min-h-11 items-center gap-2 rounded-md bg-fg px-4 text-sm font-medium text-bg disabled:opacity-40"
                  >
                    {busyAction === "step" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {busyAction === "step" ? "Running…" : `Execute ${PHASES[project.currentPhase].code}`}
                  </button>
                  <button
                    type="button"
                    onClick={runUntil}
                    disabled={running || busyAction !== null}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm text-fg disabled:opacity-40"
                  >
                    {busyAction === "run" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <FastForward className="h-4 w-4" />
                    )}
                    {busyAction === "run" ? "Running…" : "Run to next gate"}
                  </button>
                  {project.generatedSource ? (
                    <button
                      type="button"
                      onClick={() => void onRunModule()}
                      disabled={busyAction !== null}
                      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm text-fg disabled:opacity-40"
                    >
                      Run module (bounded)
                    </button>
                  ) : null}
                  {busyAction !== null ? (
                    <p className="w-full font-mono text-xs text-accent">
                      <span
                        aria-hidden="true"
                        className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current align-middle"
                      />
                      running…
                    </p>
                  ) : null}
                </>
              )}
              {llmStatus.configured ? (
                <button
                  type="button"
                  onClick={() => void onSpawnCrew()}
                  disabled={busyAction !== null}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm text-fg disabled:opacity-40"
                  title="Spawn the advisory multi-agent crew for this phase (runCrew). Advisory only — DoD gates keep ruling."
                >
                  {busyAction === "crew" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                  {busyAction === "crew" ? "Spawning crew…" : "Spawn crew"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void copyPacket()}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm text-fg"
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copied packet" : "Copy agent packet"}
              </button>
              <button
                type="button"
                onClick={() => void copyHandoff()}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm text-fg"
              >
                <Copy className="h-4 w-4" />
                {copiedHandoff ? "Copied handoff" : "Copy phase handoff"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const nid = clone(project.id);
                  if (nid) void nav({ to: "/run/$id", params: { id: nid } });
                }}
                className="min-h-11 rounded-md px-3 text-sm text-muted"
              >
                Clone
              </button>
              <button
                type="button"
                onClick={downloadPacket}
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg"
              >
                <Download className="h-4 w-4" />
                Download packet (.md)
              </button>
              <button
                type="button"
                onClick={downloadJson}
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                type="button"
                onClick={() => void copyProjectJson()}
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg"
              >
                <Copy className="h-4 w-4" />
                Copy JSON
              </button>
              <button
                type="button"
                onClick={() => setReportOpen((v) => !v)}
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg"
              >
                Ingest report
              </button>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg">
                <Upload className="h-4 w-4" />
                Import
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={onImportFile}
                />
              </label>
              <button
                type="button"
                onClick={() => setArchiveOpen(true)}
                className="min-h-11 rounded-md px-3 text-sm text-muted hover:text-danger"
              >
                Archive
              </button>
            </div>
            {project.status === "complete" ? <ExportSoftwareBlock project={project} /> : null}
            {crewRun && (crewRun.ok || crewRun.messages.length > 0) ? (
              <div className="mt-3 w-full rounded-md border border-border bg-raised px-4 py-3">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted">
                  <Bot className="h-3.5 w-3.5" />
                  <span>
                    {crewRun.ok
                      ? `Crew run ${
                          crewRun.stopped === "max-steps" || crewRun.stopped === "cost-limit"
                            ? `partial — ${crewRun.stopped} (guard stop)`
                            : "complete"
                        } · ${crewRun.messages.length} message${
                          crewRun.messages.length === 1 ? "" : "s"
                        }${crewRun.ingested === false ? " · artifact ingestion failed (see error above)" : ""}`
                      : `Crew run did not start — ${crewRun.reason ?? "error"}`}
                  </span>
                </p>
                <ul className="scroll-thin mt-3 max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                  {crewRun.messages.map((m) => (
                    <li
                      key={`crew-msg-${m.seq}`}
                      className="rounded-md border border-border bg-bg px-3 py-2"
                    >
                      <p className="font-mono text-[11px] text-accent">
                        #{m.seq} · {m.role}
                        <span className="text-faint"> → </span>
                        {m.type}
                        {m.to ? <span className="text-faint"> (to {m.to})</span> : null}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-fg/90 [overflow-wrap:anywhere]">
                        {m.content}
                      </p>
                      {m.artifactTitles.length ? (
                        <p className="mt-1 font-mono text-[11px] text-faint">
                          artifacts: {m.artifactTitles.join(" · ")}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {reportOpen ? (
              <div className="mt-3 w-full">
                <textarea
                  value={reportDraft}
                  onChange={(e) => setReportDraft(e.target.value)}
                  placeholder={'Paste an agent report JSON: {"phase":1,"status":"complete","summary":"...","artifacts":[{"title":"...","body":"..."}]}'}
                  className="min-h-24 w-full rounded-md border border-border bg-raised px-3 py-2 font-mono text-xs text-fg"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={onIngestReport}
                    className="btn-solid rounded-md bg-fg px-3 py-1.5 text-xs font-medium text-bg"
                  >
                    Ingest
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <p className="mt-3 font-mono text-[11px] text-faint">
              Saved to this browser only · Export for backup
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-faint">
              <span className="sr-only">Keyboard shortcuts:</span>
              <span className="inline-flex items-center gap-1">
                <Kbd>e</Kbd> execute
              </span>
              <span className="inline-flex items-center gap-1">
                <Kbd>g</Kbd> run-to-gate
              </span>
              <span className="inline-flex items-center gap-1">
                <Kbd>a</Kbd> approve
              </span>
              <span className="inline-flex items-center gap-1">
                <Kbd>r</Kbd> reject note
              </span>
              <span className="inline-flex items-center gap-1">
                <Kbd>/</Kbd> search
              </span>
              <span className="inline-flex items-center gap-1">
                <Kbd>?</Kbd> guide
              </span>
            </p>

            <AlertDialog.Root open={archiveOpen} onOpenChange={setArchiveOpen}>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 z-40 bg-bg/80" />
                <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5">
                  <AlertDialog.Title className="text-base font-medium tracking-tight">
                    Archive {project.name}?
                  </AlertDialog.Title>
                  <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-muted">
                    Phases, artifacts, memory and gate decisions are deleted from this browser.
                  </AlertDialog.Description>
                  <div className="mt-5 flex justify-end gap-2">
                    <AlertDialog.Cancel asChild>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm text-fg"
                      >
                        Keep build
                      </button>
                    </AlertDialog.Cancel>
                    <AlertDialog.Action asChild>
                      <button
                        type="button"
                        onClick={archiveAndHome}
                        className="inline-flex min-h-10 items-center rounded-md border border-danger/50 bg-raised px-3 text-sm font-medium text-danger"
                      >
                        Archive
                      </button>
                    </AlertDialog.Action>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Portal>
            </AlertDialog.Root>

            {error ? (
              <p role="alert" className="rt-alert rt-alert-err mt-3 [overflow-wrap:anywhere]">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p role="status" aria-live="polite" className="rt-alert rt-alert-ok mt-3">
                {notice}
              </p>
            ) : null}
            {project.lastTest && lastTestCaption(project.lastTest) ? (
              <p
                className={`mt-3 font-mono text-xs ${
                  project.lastTest.ok ? "text-ok" : "text-danger"
                }`}
              >
                {lastTestCaption(project.lastTest)}
              </p>
            ) : null}
            {project.lattice ? (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {project.lattice.jobs.slice(0, 6).map((j) => (
                  <span key={`j-${j}`} className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-accent">
                    job:{j}
                  </span>
                ))}
                {project.lattice.entities.slice(0, 5).map((e) => (
                  <span key={`e-${e}`} className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-muted">
                    {e}
                  </span>
                ))}
                {project.lattice.constraints.slice(0, 6).map((c) => (
                  <span key={`c-${c}`} className="rounded-sm border border-warn/30 px-2 py-1 font-mono text-[11px] text-warn">
                    {c}
                  </span>
                ))}
                {project.lattice.constraints.length > 6 ? (
                  <span className="rounded-sm border border-warn/30 px-2 py-1 font-mono text-[11px] text-warn">
                    +{project.lattice.constraints.length - 6} more
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <PhaseProgressRail project={project} />

          <WildConsole project={project} />

          {project.traces.length ? (
            <div className="border-b border-line px-5 py-4">
              <p className="font-mono text-xs text-muted">Onboard algorithms</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {project.traces.map((t) => (
                  <div key={t.id} className="rounded-md border border-border bg-raised px-3 py-3">
                    <p className="font-mono text-[11px] text-accent">{t.id}</p>
                    <p className="mt-1 text-sm font-medium">{t.name}</p>
                    <p className="mt-1 text-[11px] leading-snug text-muted">{t.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {project.scorecard ? <ScorecardBlock project={project} /> : null}

          {project.hitl ? (
            <HitlDock
              project={project}
              note={note}
              setNote={setNote}
              onApprove={onApprove}
              onReject={onReject}
              noteRef={noteRef}
            />
          ) : null}

          <Tabs.Root value={tab} onValueChange={(v) => setTab(v as RunTab)}>
            <Tabs.List
              aria-label="Run console tabs: artifacts, agent packet, spec graph, crew, oracle, design, diagram, chat, vault, runtime log"
              className="scroll-thin flex gap-1 overflow-x-auto border-b border-line px-5 pt-3"
            >
              <Tabs.Trigger
                value="artifacts"
                className="rt-tab shrink-0 min-h-10 px-3 text-sm whitespace-nowrap text-muted outline-none hover:text-fg data-[state=active]:border-b data-[state=active]:border-fg data-[state=active]:text-fg"
              >
                Artifacts
              </Tabs.Trigger>
              <Tabs.Trigger
                value="packet"
                className="rt-tab shrink-0 min-h-10 px-3 text-sm whitespace-nowrap text-muted outline-none hover:text-fg data-[state=active]:border-b data-[state=active]:border-fg data-[state=active]:text-fg"
              >
                Agent packet
              </Tabs.Trigger>
              <Tabs.Trigger
                value="spec"
                className="rt-tab shrink-0 min-h-10 px-3 text-sm whitespace-nowrap text-muted outline-none hover:text-fg data-[state=active]:border-b data-[state=active]:border-fg data-[state=active]:text-fg"
              >
                Spec graph
              </Tabs.Trigger>
              <Tabs.Trigger
                value="crew"
                className="rt-tab shrink-0 min-h-10 px-3 text-sm whitespace-nowrap text-muted outline-none hover:text-fg data-[state=active]:border-b data-[state=active]:border-fg data-[state=active]:text-fg"
              >
                Crew
              </Tabs.Trigger>
              <Tabs.Trigger
                value="oracle"
                className="rt-tab shrink-0 min-h-10 px-3 text-sm whitespace-nowrap text-muted outline-none hover:text-fg data-[state=active]:border-b data-[state=active]:border-fg data-[state=active]:text-fg"
              >
                Oracle
              </Tabs.Trigger>
              <Tabs.Trigger
                value="vault"
                className="rt-tab shrink-0 min-h-10 px-3 text-sm whitespace-nowrap text-muted outline-none hover:text-fg data-[state=active]:border-b data-[state=active]:border-fg data-[state=active]:text-fg"
              >
                Vault
              </Tabs.Trigger>
              <Tabs.Trigger
                value="design"
                className="rt-tab shrink-0 min-h-10 px-3 text-sm whitespace-nowrap text-muted outline-none hover:text-fg data-[state=active]:border-b data-[state=active]:border-fg data-[state=active]:text-fg"
              >
                Design
              </Tabs.Trigger>
              <Tabs.Trigger
                value="diagram"
                className="rt-tab shrink-0 min-h-10 px-3 text-sm whitespace-nowrap text-muted outline-none hover:text-fg data-[state=active]:border-b data-[state=active]:border-fg data-[state=active]:text-fg"
              >
                Diagram
              </Tabs.Trigger>
              <Tabs.Trigger
                value="chat"
                className="rt-tab shrink-0 min-h-10 px-3 text-sm whitespace-nowrap text-muted outline-none hover:text-fg data-[state=active]:border-b data-[state=active]:border-fg data-[state=active]:text-fg"
              >
                Chat
              </Tabs.Trigger>
              <Tabs.Trigger
                value="runtime"
                className="rt-tab shrink-0 min-h-10 px-3 text-sm whitespace-nowrap text-muted outline-none hover:text-fg data-[state=active]:border-b data-[state=active]:border-fg data-[state=active]:text-fg"
              >
                Runtime log
              </Tabs.Trigger>
            </Tabs.List>

            {/* forceMount keeps every panel mounted so future live streams survive tab switches. */}
            <Tabs.Content value="artifacts" forceMount className="data-[state=inactive]:hidden">
              <div className="flex gap-2 px-5 pt-3">
                <input
                  ref={searchRef}
                  aria-label="Search artifacts"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelected(null); // BUG-05: never leave a selection hidden by the filter.
                  }}
                  placeholder="Search artifacts (title + body)"
                  className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                />
                <select
                  aria-label="Filter by phase"
                  value={phaseFilter}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPhaseFilter(v === "all" ? "all" : (Number(v) as PhaseId));
                    setSelected(null); // BUG-05: never leave a selection hidden by the filter.
                  }}
                  className="h-10 rounded-md border border-border bg-surface px-2 font-mono text-xs outline-none focus:ring-2 focus:ring-accent/40"
                >
                  <option value="all">All · {artifacts.length}</option>
                  {PHASES.map((p) => (
                    <option key={p.id} value={p.id}>
                      P{p.id} · {phaseCounts.get(p.id) ?? 0}
                    </option>
                  ))}
                </select>
              </div>
              <ArtifactPane
                artifacts={visibleArtifacts}
                active={activeArt}
                onSelect={setSelected}
                empty={
                  artifacts.length === 0
                    ? undefined
                    : "No artifacts match this filter."
                }
              />
            </Tabs.Content>

            <Tabs.Content value="packet" forceMount className="data-[state=inactive]:hidden">
              {project.packet ? (
                <div className="px-5 pt-4 pb-5">
                  <div className="term-frame">
                    <div className="term-bar" role="presentation">
                      <span aria-hidden="true" className="term-dot" />
                      <span aria-hidden="true" className="term-dot" />
                      <span aria-hidden="true" className="term-dot" />
                      <span className="term-name">agent-packet.md</span>
                      <span className="term-meta">
                        markdown · ≈{tokenEst.tokensEst} tok · {project.packet.length} chars
                      </span>
                    </div>
                    <div
                      role="region"
                      aria-label="Packet body"
                      className="term-body scroll-thin wrap-any max-h-[460px] overflow-auto px-5 py-4"
                    >
                      <MarkdownBody text={project.packet} />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="px-5 py-4 font-mono text-xs leading-relaxed text-fg/90">
                  Execute a phase to compile the packet.
                </p>
              )}
            </Tabs.Content>

            <Tabs.Content value="spec" forceMount className="data-[state=inactive]:hidden">
              <ol className="scroll-thin max-h-[65vh] space-y-2 overflow-y-auto px-5 py-4">
                {(project.specGraph?.order ?? []).map((id, i) => {
                  const n = project.specGraph?.nodes.find((x) => x.id === id);
                  if (!n) return null;
                  return (
                    <li key={id} className="rounded-md border border-border bg-raised px-3 py-3">
                      <p className="font-mono text-[11px] text-accent">
                        {i + 1} · {n.owner}
                      </p>
                      <p className="mt-1 text-sm font-medium">{n.file}</p>
                      <p className="mt-1 text-xs text-muted">{n.purpose}</p>
                    </li>
                  );
                })}
                {!project.specGraph?.nodes.length ? (
                  <li className="text-sm text-muted">Lattice empty — open a brief first.</li>
                ) : null}
              </ol>
            </Tabs.Content>

            <Tabs.Content value="crew" forceMount className="data-[state=inactive]:hidden">
              <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
                {(project.crew ?? []).map((c) => (
                  <div key={c.role} className="rounded-md border border-border bg-raised px-3 py-3">
                    <p className="font-mono text-[11px] text-accent">
                      {c.role}{c.active ? " · active" : ""} · {c.budgetTokens} tok
                    </p>
                    <p className="mt-2 text-sm">{c.mandate}</p>
                    <p className="mt-2 text-xs text-muted">{c.handoff}</p>
                    <p className="mt-2 font-mono text-[11px] text-faint">{c.tools.join(" · ")}</p>
                  </div>
                ))}
              </div>
            </Tabs.Content>

            <Tabs.Content value="oracle" forceMount className="data-[state=inactive]:hidden">
              <div className="px-5 py-4">
                <p className="font-mono text-[11px] text-muted uppercase tracking-wide">
                  Acceptance prose (A7 template)
                </p>
                <ul className="mt-2 space-y-2">
                  {(project.oracle ?? []).map((t) => (
                    <li key={t.id} className="rounded-md border border-border px-3 py-3">
                      <p className="font-mono text-[11px] text-accent">{t.name}</p>
                      <p className="mt-1 text-sm">{t.given}</p>
                      <p className="mt-1 text-xs text-muted">expect {t.expect}</p>
                    </li>
                  ))}
                  {(project.oracle ?? []).length === 0 ? (
                    <li className="text-sm text-muted">
                      No oracle cases — run a phase to synthesize acceptance cases.
                    </li>
                  ) : null}
                </ul>
                <p className="mt-2 text-xs text-muted">
                  Template-derived from the fixed lattice — acceptance prose, not runnable
                  checks (99 §4).
                </p>

                <p className="mt-5 font-mono text-[11px] text-muted uppercase tracking-wide">
                  Machine verify (executable)
                </p>
                <OracleVerifyBlock project={project} />
              </div>
              {project.contracts ? (
                <p className="px-5 pb-4 text-xs text-muted">
                  Contracts: {project.contracts.entities.map((e) => e.name).join(", ")} ·{" "}
                  {project.contracts.endpoints.length} endpoints
                </p>
              ) : null}
            </Tabs.Content>

            <Tabs.Content value="vault" forceMount className="data-[state=inactive]:hidden">
              <VaultPane project={project} />
            </Tabs.Content>

            <Tabs.Content value="runtime" forceMount className="data-[state=inactive]:hidden">
              <RuntimeLogPane project={project} />
            </Tabs.Content>

            <Tabs.Content value="design" forceMount className="data-[state=inactive]:hidden">
              <DesignPane project={project} />
            </Tabs.Content>

            <Tabs.Content value="diagram" forceMount className="data-[state=inactive]:hidden">
              <DiagramPane project={project} />
            </Tabs.Content>

            <Tabs.Content value="chat" forceMount className="data-[state=inactive]:hidden">
              <ChatPane project={project} />
            </Tabs.Content>
          </Tabs.Root>
            </>
          )}
        </section>

        <aside className="bg-surface px-4 py-4">
          <EnforceDodToggle project={project} llmConfigured={llmStatus.configured} />
          <h2 className="mt-8 text-xs font-medium tracking-wide text-muted uppercase">
            <label htmlFor="notes">Notes</label>
          </h2>
          <textarea
            id="notes"
            aria-label="Operator notes for the crew"
            value={project.notes}
            onChange={(e) => setNotes(project.id, e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm outline-none"
            placeholder="Operator notes for the crew…"
          />

          <h2 className="mt-8 text-xs font-medium tracking-wide text-muted uppercase">Memory</h2>
          <ul className="scroll-thin mt-3 max-h-[46vh] space-y-3 overflow-y-auto pr-1">
            {project.memory.slice(0, 8).map((m) => (
              <li key={m.id} className="border-b border-line pb-3 last:border-0">
                <p className="font-mono text-[11px] text-faint">
                  {m.kind} · P{m.phase} · {m.score.toFixed(2)}
                </p>
                <p className="mt-1 text-sm leading-snug text-fg">{m.text}</p>
              </li>
            ))}
            {project.memory.length === 0 ? (
              <li className="text-sm text-muted">Empty until Phase 0 writes a checkpoint.</li>
            ) : null}
          </ul>

          {project.decisions.length > 0 ? (
            <>
              <h3 className="mt-8 text-xs font-medium tracking-wide text-muted uppercase">
                Gate log
              </h3>
              <ul className="mt-3 space-y-2">
                {project.decisions.slice(-6).reverse().map((d) => (
                  <li key={d.id} className="border-b border-line pb-2 last:border-0">
                    <p className="font-mono text-[11px] leading-relaxed">
                      <span className="text-fg/80">P{d.phase}</span>
                      <span className="text-faint"> · </span>
                      <span className={d.decision === "approve" ? "text-ok" : "text-danger"}>
                        {d.decision}
                      </span>
                      <span className="text-faint">
                        {" "}
                        · {d.decidedBy} · {agoLabel(d.decidedAt)}
                      </span>
                    </p>
                    {d.note ? (
                      <p className="mt-0.5 font-mono text-[11px] text-faint">{clip60(d.note)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <GateHealthCard project={project} />

          <h2 className="mt-8 text-xs font-medium tracking-wide text-muted uppercase">Diagnostics</h2>
          <ol className="scroll-thin mt-3 max-h-[38vh] space-y-2 overflow-y-auto pr-1 font-mono text-[11px] leading-relaxed text-muted">
            {project.logs.slice(-10).reverse().map((l, i) => (
              <li key={`${l.ts}-${i}`}>
                <span className="text-faint">{l.event}</span>
                <span className="text-fg/80"> {l.detail}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        llmLabel={llmStatus.label}
        llmConfigured={llmStatus.configured}
        researchLabel={researchStatus.label}
        researchConfigured={researchStatus.configured}
      />
      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

/** Compact 13-segment progress rail (P0–P12): done / current / upcoming from project.phases. */
function PhaseProgressRail({ project }: { project: Project }) {
  const done = project.phases.filter((r) => r.status === "complete").length;
  const total = PHASES.length;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="border-b border-line px-5 py-3" aria-label="Phase progress">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-medium tracking-widest text-faint uppercase">
          Phase graph
        </p>
        <p className="font-mono text-[10px] text-faint tabular-nums">
          {done}/{total} sealed · {pct}%
        </p>
      </div>
      <ol className="mt-2 flex gap-1">
        {PHASES.map((p) => {
          const rec = project.phases.find((r) => r.id === p.id);
          const status = rec?.status ?? "locked";
          const isCurrent = project.currentPhase === p.id;
          let tone = "bg-faint";
          let label = "Upcoming";
          let lblTone = "";
          if (status === "complete") {
            tone = "bg-ok";
            label = "Complete";
            lblTone = "rail-lbl-done";
          } else if (status === "rejected") {
            tone = "bg-danger";
            label = "Rejected";
            lblTone = "rail-lbl-bad";
          } else if (status === "awaiting_hitl") {
            tone = "bg-warn";
            label = "Awaiting approval";
            lblTone = "rail-lbl-warn";
          } else if (status === "running") {
            tone = "bg-accent";
            label = wildStateOf(project).enabled ? "Wild mode running" : "Running";
            lblTone = "rail-lbl-now";
          } else if (isCurrent) {
            tone = "bg-accent";
            label = project.status === "blocked" ? "Blocked" : "Current";
            lblTone = project.status === "blocked" ? "rail-lbl-bad" : "rail-lbl-now";
          }
          return (
            <li
              key={p.id}
              className="min-w-0 flex-1"
              title={`${p.code} · ${p.title} · ${label}`}
              aria-label={`${p.code} · ${label}`}
            >
              <span
                aria-hidden="true"
                className={`rail-seg block h-2 w-full rounded-full ${tone} ${isCurrent ? "rail-current" : ""}`}
              />
              <span
                className={`rail-lbl ${lblTone} mt-1 block truncate text-center font-mono text-[9px] leading-none text-faint`}
              >
                {p.code}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PhaseRail({
  project,
  viewPhase,
  onViewPhase,
}: {
  project: Project;
  viewPhase: PhaseId | null;
  onViewPhase: (phase: PhaseId) => void;
}) {
  return (
    <nav className="border-b border-line lg:border-r lg:border-b-0" aria-label="Phases">
      <div className="flex gap-2 overflow-x-auto px-3 py-3 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-3 lg:py-4">
        {PHASES.map((p) => {
          const rec = project.phases[p.id];
          const meta = PHASE_STATUS_META[rec.status];
          const isCurrent = project.currentPhase === p.id;
          const isViewed = viewPhase === p.id;
          const highlighted = viewPhase === null ? isCurrent : isViewed;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onViewPhase(p.id)}
              aria-current={isCurrent ? "true" : undefined}
              aria-pressed={isViewed ? true : undefined}
              title={isCurrent ? `${p.code} · live phase` : `${p.code} · view record`}
              className={`rt-phase flex min-w-[148px] items-center gap-2 rounded-md px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40 lg:min-w-0 ${
                highlighted ? "bg-raised" : ""
              }`}
            >
              <PhaseGlyph status={rec.status} />
              <span className="min-w-0">
                <span className={`block font-mono text-[11px] ${meta.tone}`}>
                  {p.code}
                  {p.hitl ? " · HITL" : ""}
                </span>
                <span className="block truncate text-xs text-fg">{p.title}</span>
              </span>
              <span className="ml-auto hidden shrink-0 lg:inline-flex" aria-hidden="false">
                <StatusBadge project={project} phase={p.id} />
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ScorecardBlock({ project }: { project: Project }) {
  const sc = project.scorecard;
  if (!sc) return null;
  return (
    <div className="border-b border-line px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">Phase 0 scorecard</p>
          <p className="mt-1 text-lg font-medium">
            {sc.overall}
            <span className="text-muted"> / 10</span>
            <span className="ml-3 font-mono text-xs text-accent">{sc.verdict}</span>
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {sc.axes.map((a) => (
          <div key={a.key} className="rounded-md border border-border bg-raised px-3 py-3">
            <p className="text-xs text-muted">{a.label}</p>
            <p className="mt-1 font-mono text-lg tabular-nums">{a.score}</p>
            <p className="mt-1 text-[11px] leading-snug text-faint">{a.note}</p>
          </div>
        ))}
      </div>
      {project.competitors.length ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="pb-2 font-medium">Competitor</th>
                <th className="pb-2 font-medium">Class</th>
                <th className="pb-2 font-medium">Gap RapidTool takes</th>
                <th className="pb-2 text-right font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {project.competitors.map((c) => (
                <tr key={c.name} className="border-t border-line">
                  <td className="py-2 pr-3 font-medium">{c.name}</td>
                  <td className="py-2 pr-3 text-muted">{c.class}</td>
                  <td className="py-2 pr-3 text-muted">{c.gap}</td>
                  <td className="py-2 text-right">
                    <span
                      title={
                        c.source === "cited"
                          ? "Labelled “cited” by the engine — confirm the backing research artifact"
                          : "Deterministic template row — never present template prose as live research"
                      }
                      className={`inline-flex items-center whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-mono text-[10px] ${
                        c.source === "cited" ? "border-ok/40 text-ok" : "border-warn/30 text-warn"
                      }`}
                    >
                      {c.source === "cited" ? "cited" : "illustrative template"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function HitlDock({
  project,
  note,
  setNote,
  onApprove,
  onReject,
  noteRef,
}: {
  project: Project;
  note: string;
  setNote: (v: string) => void;
  onApprove: (force?: boolean) => void;
  onReject: () => void;
  noteRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const [forceOverride, setForceOverride] = useState(false);
  const h = project.hitl;
  if (!h) return null;
  const evidence = evidenceForGate(project);
  // A02 (deep-audit-01): a failed P6 sandbox is human-only (forceHuman) — the operator
  // must explicitly tick the override before Approve can pass (mirrors store.ts guard).
  const needsOverride =
    Boolean(h.forceHuman) &&
    project.currentPhase === 6 &&
    project.lastTest !== null &&
    !project.lastTest.ok;
  // E-21: when autopilot parked on this gate because the DoD gate denied its
  // approval (E-20 logs autopilot.gate_denied with the unmet criteria), show
  // the machine-readable reason under the dock instead of a bare "waiting".
  const denial = latestAutopilotDenial(project);
  return (
    <div className="border-b border-line bg-raised px-5 py-5">
      <p className="font-mono text-xs text-warn">HITL · {h.stakes}</p>
      <h2 className="mt-1 text-lg font-medium">{h.title}</h2>
      <p className="mt-2 text-sm text-muted">{h.prompt}</p>
      <details open className="mt-4 rounded-md border border-border bg-bg px-3 py-2">
        <summary className="cursor-pointer font-mono text-xs text-muted select-none">
          Evidence for this gate ({evidence.length})
        </summary>
        {evidence.length === 0 ? (
          <p className="mt-2 text-xs text-faint">No evidence recorded for this gate.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {evidence.map((r) => (
              <li
                key={r.id}
                className={`font-mono text-[11px] leading-relaxed ${
                  r.tone === "ok" ? "text-ok" : r.tone === "danger" ? "text-danger" : "text-faint"
                }`}
              >
                <span className="text-faint">· </span>
                {r.text}
              </li>
            ))}
          </ul>
        )}
      </details>
      <label className="mt-4 block text-xs text-muted" htmlFor="hitl-note">
        Rejection note (min 12 characters)
      </label>
      <textarea
        id="hitl-note"
        ref={noteRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        aria-invalid={note.trim().length > 0 && note.trim().length < 12}
        className="mt-2 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        placeholder="Why this phase must be regenerated…"
      />
      <p
        aria-live="polite"
        className={`mt-1 font-mono text-[11px] ${
          note.trim().length > 0 && note.trim().length < 12 ? "text-warn" : "text-faint"
        }`}
      >
        {note.trim().length}/12
        {note.trim().length > 0 && note.trim().length < 12
          ? " · rejection note too short — 12+ characters required"
          : ""}
      </p>
      {needsOverride && (
        <label className="mt-3 flex items-start gap-2 text-sm text-danger">
          <input
            type="checkbox"
            checked={forceOverride}
            onChange={(e) => setForceOverride(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>I reviewed the failing sandbox output and approve anyway.</span>
        </label>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onApprove(forceOverride)}
          disabled={needsOverride && !forceOverride}
          className="btn-solid inline-flex min-h-11 items-center gap-2 rounded-md bg-fg px-4 text-sm font-medium text-bg disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Approve
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={note.trim().length < 12}
          aria-label={
            note.trim().length < 12
              ? "Reject disabled — the rejection note must be at least 12 characters"
              : "Reject this phase with the note above"
          }
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-danger/40 px-4 text-sm text-danger disabled:opacity-40"
        >
          <X className="h-4 w-4" />
          Reject
        </button>
        <span className="sr-only" aria-live="polite">
          {note.trim().length < 12
            ? "Reject disabled — note must be at least 12 characters"
            : "Reject enabled"}
        </span>
      </div>
      {denial ? (
        <p
          role="status"
          className="mt-3 rounded-md border border-warn/30 bg-raised px-3 py-2 font-mono text-[11px] leading-relaxed text-warn"
        >
          autopilot gate denied — {denial.detail}
          <span className="mt-0.5 block text-faint">
            approve manually below, or reject with notes to steer regeneration
          </span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * E-21: newest autopilot denial trail entry (E-20 logs event
 * "autopilot.gate_denied" with detail "P<n> unmet: <ids>" when an autopilot
 * run parks because the phase's DoD gate fails). Scans from the tail — logs
 * are capped everywhere, so the newest entry is what matters.
 */
function latestAutopilotDenial(project: Project): JsonLog | null {
  for (let i = project.logs.length - 1; i >= 0; i--) {
    if (project.logs[i].event === "autopilot.gate_denied") return project.logs[i];
  }
  return null;
}

/** M-12: latest “Rejection guidance (LLM)” artifact for the current edge. The
 *  store appends one per async rejection (`guidance-` id prefix; the engine
 *  never emits that title), so the most recent body is the freshest steering.
 *  While the project is blocked the HITL dock is null (its only other surface
 *  is the artifacts tab), so the blocked-state UI renders this itself. */
function latestRejectionGuidance(project: Project): Artifact | null {
  for (let i = project.artifacts.length - 1; i >= 0; i--) {
    const a = project.artifacts[i];
    if (a.phase === project.currentPhase && a.title.startsWith("Rejection guidance")) {
      return a;
    }
  }
  return null;
}

function BlockedGuidanceBlock({ project }: { project: Project }) {
  const g = latestRejectionGuidance(project);
  if (!g) return null;
  return (
    <div className="mt-2 w-full rounded-md border border-warn/30 bg-raised px-4 py-3">
      <p className="font-mono text-[11px] text-warn">
        Rejection guidance (LLM) · advisory — deterministic deltas on regeneration may differ
      </p>
      <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-fg/90 [overflow-wrap:anywhere]">{g.body}</p>
    </div>
  );
}

function ArtifactPane({
  artifacts,
  active,
  onSelect,
  empty,
}: {
  artifacts: Artifact[];
  active: Artifact | null;
  onSelect: (id: string) => void;
  empty?: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const copyTs = useRef(0);

  function copyArtifact(art: Artifact) {
    const my = ++copyTs.current;
    setCopyState("idle");
    navigator.clipboard
      .writeText(art.body)
      .then(() => {
        if (copyTs.current !== my) return;
        setCopyState("copied");
        window.setTimeout(() => {
          if (copyTs.current === my) setCopyState("idle");
        }, 1600);
      })
      .catch(() => {
        if (copyTs.current !== my) return;
        setCopyState("failed");
      });
  }

  if (!artifacts.length) {
    return (
      <div className="px-5 py-10 text-sm text-muted">
        {empty ?? "Execute the current phase to write artifacts into the workspace."}
      </div>
    );
  }
  return (
    <div className="grid min-h-[280px] md:grid-cols-[200px_minmax(0,1fr)]">
      <ul className="scroll-thin max-h-[60vh] overflow-y-auto border-b border-line md:border-r md:border-b-0">
        {artifacts.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onSelect(a.id)}
              className={`w-full px-4 py-3 text-left text-sm ${
                active?.id === a.id ? "bg-raised text-fg" : "text-muted hover:text-fg"
              }`}
            >
              <span className="block font-mono text-[11px] text-faint">
                P{a.phase} · {a.kind}
              </span>
              {a.title}
            </button>
          </li>
        ))}
      </ul>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <p className="truncate font-mono text-[11px] text-muted">
            {active ? `P${active.phase} · ${active.kind} · ${active.title}` : "Select an artifact"}
          </p>
          {active ? (
            <button
              type="button"
              onClick={() => copyArtifact(active)}
              aria-label={`Copy artifact ${active.title} to clipboard`}
              title="Copy artifact body"
              className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <Copy className="h-3.5 w-3.5" />
              {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}
            </button>
          ) : null}
        </div>
        {active ? (
          <div
            role="region"
            aria-label={`Body of ${active.title}`}
            className="scroll-thin wrap-any max-h-[60vh] min-h-[280px] overflow-auto px-4 py-4"
          >
            <MarkdownBody text={active.body} />
          </div>
        ) : (
          <p className="px-4 py-4 font-mono text-xs text-faint">
            Select an artifact to read its body.
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- Markdown block bodies (packet + artifact views) ---------- */

/** Block shape renderMarkdownBlocks ships (see src/lib/render.ts). List-item
 *  blocks carry a whole contiguous RUN (items joined by "\n", `ordered` when
 *  the run was numbered); unknown types are folded defensively (extra heading
 *  levels → "h2", anything else → "p") so a sibling drift never silently
 *  blanks a body. */
type MdBlock = {
  type: "h1" | "h2" | "h3" | "p" | "code" | "li" | "hr";
  text: string;
  lang?: string;
  ordered?: boolean;
};

const MD_TYPES = new Set(["h1", "h2", "h3", "p", "code", "li", "hr"]);

function mdBlocksOf(text: string): MdBlock[] {
  try {
    const raw = renderMarkdownBlocks(text);
    if (!Array.isArray(raw)) return [];
    const out: MdBlock[] = [];
    for (const b of raw) {
      if (!b || typeof b !== "object") continue;
      const t = (b as { type?: unknown }).type;
      const txt = (b as { text?: unknown }).text;
      const lang = (b as { lang?: unknown }).lang;
      const ordered = (b as { ordered?: unknown }).ordered;
      if (typeof t !== "string" || typeof txt !== "string") continue;
      const type: MdBlock["type"] =
        MD_TYPES.has(t) ? (t as MdBlock["type"]) : /^h[1-6]$/.test(t) ? "h2" : "p";
      out.push({
        type,
        text: txt,
        lang: typeof lang === "string" && lang.length > 0 ? lang : undefined,
        ordered: type === "li" && typeof ordered === "boolean" ? ordered : undefined,
      });
    }
    return out;
  } catch {
    // renderer threw (unexpected host drift) — render the raw text below instead.
    return [];
  }
}

/**
 * Render a markdown body as plain React elements — never innerHTML. List runs
 * (one li block per run, items joined by "\n") become <ul>/<ol> item lists;
 * fenced code becomes a bordered <pre> with a language caption. Text blocks
 * keep pre-wrap whitespace so raw (non-markdown) artifact bodies — JSON,
 * YAML — stay readable line by line.
 */
function MarkdownBody({ text }: { text: string }) {
  const blocks = useMemo(() => mdBlocksOf(text), [text]);
  if (blocks.length === 0) {
    if (!text) return null;
    // Defensive fallback: keep the body visible even if the renderer folded to
    // nothing or threw (still React-escaped text, never innerHTML).
    return (
      <p className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-fg/90">{text}</p>
    );
  }
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "li") {
      // A single block carries the whole contiguous list run: text is items
      // joined by "\n", ordered when the run was numbered.
      const items = b.text
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => (
          <li key={key++} className="font-mono text-xs leading-relaxed text-fg/90">
            {line}
          </li>
        ));
      i += 1;
      if (items.length === 0) continue;
      nodes.push(
        b.ordered ? (
          <ol key={key++} className="list-decimal space-y-0.5 pl-4">
            {items}
          </ol>
        ) : (
          <ul key={key++} className="list-disc space-y-0.5 pl-4">
            {items}
          </ul>
        ),
      );
      continue;
    }
    switch (b.type) {
      case "h1":
        nodes.push(
          <h2
            key={key++}
            className="pt-2 font-mono text-sm font-semibold tracking-tight text-fg first:pt-0"
          >
            {b.text}
          </h2>,
        );
        break;
      case "h2":
        nodes.push(
          <h3
            key={key++}
            className="pt-2 font-mono text-xs font-semibold tracking-wide text-fg/90 first:pt-0"
          >
            {b.text}
          </h3>,
        );
        break;
      case "h3":
        nodes.push(
          <h4
            key={key++}
            className="pt-1 font-mono text-[11px] font-medium text-fg/80 first:pt-0"
          >
            {b.text}
          </h4>,
        );
        break;
      case "code":
        nodes.push(
          <div
            key={key++}
            className="overflow-hidden rounded-md border border-border bg-raised"
          >
            {b.lang ? (
              <p className="border-b border-line px-2 py-1 font-mono text-[10px] tracking-wide text-faint uppercase">
                {b.lang}
              </p>
            ) : null}
            <pre className="scroll-thin max-h-[420px] overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-fg/90">
              <code>{b.text}</code>
            </pre>
          </div>,
        );
        break;
      case "hr":
        nodes.push(<hr key={key++} className="my-2 border-line" />);
        break;
      default:
        nodes.push(
          <p key={key++} className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-fg/90">
            {b.text}
          </p>,
        );
    }
    i += 1;
  }
  return (
    <div className="wrap-any min-w-0 space-y-2.5 font-mono">
      {nodes}
    </div>
  );
}

/* ---------- Vault tab (2nd brain: MOC + notes over memory rows & artifacts) ---------- */

/** Kind section labels mirror vault.ts's own MOC wording (vaultIndex KIND_SECTION). */
const VAULT_KIND_LABELS: Record<VaultNote["kind"], string> = {
  project: "Project",
  memory: "Memory",
  decision: "Decisions",
  research: "Research",
  artifact: "Artifacts",
  index: "Map of content",
};

/** Compact mono caption for a note row/detail: the hub reads "map of content",
 *  everything else "kind · P{phase}" ("—" when the note carries no phase). */
function noteKindCaption(note: VaultNote): string {
  const label = VAULT_KIND_LABELS[note.kind];
  if (note.kind === "index") return label.toLowerCase();
  return `${label.toLowerCase()} · ${note.phase === undefined ? "—" : `P${note.phase}`}`;
}

const WIKILINK_RE = /\[\[([^[\]]+)\]\]/g;

/**
 * Render a vault note body as monospace pre-wrap text where [[wikilinks]]
 * become clickable note buttons. vault.ts links are bare unique titles
 * ([[Title]] in bodies, `links` without brackets), so resolution is an exact
 * title lookup; aliases ([[Title|label]]) and heading links ([[Title#h]]) are
 * tolerated, and links to titles not in this vault render dead (disabled,
 * dashed, struck-through — Obsidian's unresolved-link style).
 */
function renderVaultBody(
  body: string,
  byTitle: Map<string, VaultNote>,
  onOpen: (title: string) => void,
): ReactNode[] {
  const out: ReactNode[] = [];
  WIKILINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  let last = 0;
  let key = 0;
  while ((m = WIKILINK_RE.exec(body)) !== null) {
    if (m.index > last) out.push(body.slice(last, m.index));
    const inner = m[1];
    const pipe = inner.lastIndexOf("|");
    const alias = pipe >= 0 ? inner.slice(pipe + 1) : null;
    const rawTarget = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
    const hash = rawTarget.indexOf("#");
    const target = (hash >= 0 ? rawTarget.slice(0, hash) : rawTarget).trim();
    const label = alias ?? rawTarget;
    const note = byTitle.get(target);
    if (note) {
      out.push(
        <button
          key={`wl-${key++}`}
          type="button"
          onClick={() => onOpen(note.title)}
          className="vault-link"
          title={note.title}
          aria-label={`Open note ${note.title}`}
        >
          {label}
        </button>,
      );
    } else {
      out.push(
        <button
          key={`wl-${key++}`}
          type="button"
          disabled
          className="vault-link vault-link-dead"
          title={`“${target}” is not in this vault`}
          aria-label={`Note ${target} is not in this vault`}
        >
          {label}
        </button>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out.length > 0 ? out : [body];
}

/** One clickable row in the vault navigator (hub or plain note). */
function VaultNoteRow({
  note,
  active,
  onOpen,
}: {
  note: VaultNote;
  active: boolean;
  onOpen: (title: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(note.title)}
        aria-current={active ? "true" : undefined}
        className={`w-full px-4 py-3 text-left text-sm ${
          active ? "bg-raised text-fg" : "text-muted hover:text-fg"
        }`}
      >
        <span className="block min-w-0 truncate font-medium">{note.title}</span>
        <span className="mt-0.5 block truncate font-mono text-[11px] text-faint">
          {noteKindCaption(note)}
        </span>
      </button>
    </li>
  );
}

/** Group header <li> inside the navigator list (mono, muted — mirrors aside h2 styling). */
function VaultGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <li className="px-4 pt-3 pb-1 font-mono text-[11px] font-medium tracking-wide text-faint uppercase">
      {label} · {count}
    </li>
  );
}

/**
 * Vault tab body: MOC hub at top, grouped note list, search via searchVault,
 * whole-vault copy/download via vaultMarkdown, per-note copy, clickable
 * [[wikilinks]] and an Obsidian-style “Linked from” (backlinks) section.
 * Pure read-only view over vault.ts — no store writes.
 */
/** Runtime Log pane — live ring-buffer view + AI-agent diagnosis (109 CAP-F). */
function RuntimeLogPane({ project }: { project: Project }) {
  const [snap, setSnap] = useState(() => rtSnapshot());
  const [diag, setDiag] = useState<string | null>(null);

  // Bounded poll (2 s) — the ring is tiny; render cost is negligible.
  useEffect(() => {
    const id = setInterval(() => setSnap(rtSnapshot()), 2000);
    return () => clearInterval(id);
  }, []);

  const runDiagnosis = () => {
    try {
      // PB-02: real persist health, never a hardcoded green. persistStorageHealth()
      // is a pure read of the store's last-write failure latch (idempotent), so
      // sampling it at click time is honest: a quota/blocked failure that happened
      // earlier now surfaces in the diagnosis JSON instead of "ok: true".
      const persistHealth = persistStorageHealth();
      const d = buildClientDiagnosis({
        project: project as unknown as never,
        persistHealth,
      });
      setDiag(JSON.stringify(d, null, 2));
    } catch (err) {
      setDiag(`diagnose failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex flex-col gap-3 px-5 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted">
          Runtime telemetry — uncaught errors, rejections, boundary crashes, persist failures and
          watchdogs. Ring: {snap.stats.rows} row(s) · {snap.stats.criticalCount} critical · last
          heartbeat {snap.ring.lastHeartbeat?.ts ?? null}
        </p>
        <button
          type="button"
          onClick={runDiagnosis}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-fg transition-colors hover:border-accent/50"
        >
          Diagnose
        </button>
      </div>

      {diag !== null ? (
        <pre className="max-h-96 overflow-auto rounded-md border border-line bg-black/20 p-3 font-mono text-xs text-fg">
          {diag}
        </pre>
      ) : null}

      {snap.tail.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-muted">
          No events yet — the ring fills when something crashes, a listener throws, persistence
          fails, or a wild step stalls. Honest silence, not a broken tab.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {snap.tail.map((row, i) => (
            <li
              key={`${row.ts}-${i}`}
              className="flex flex-col gap-0.5 rounded-md border border-line bg-black/20 px-3 py-2"
            >
              <span className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className={row.level === "critical" ? "text-danger" : row.level === "error" ? "text-warn" : "text-muted"}>
                  {row.level}
                </span>
                <span className="text-fg">{row.event}</span>
                {row.code ? <span className="text-accent">{row.code}</span> : null}
                <span className="ml-auto text-muted">
                  {row.scope}
                  {row.phase !== null ? ` · P${row.phase}` : ""}
                </span>
              </span>
              <span className="break-words text-fg/90">{row.message}</span>
              <span className="font-mono text-[11px] text-muted">{row.capture}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VaultPane({ project }: { project: Project }) {
  const notes = useMemo(() => buildVaultNotes(project), [project]);
  const vaultMd = useMemo(() => vaultMarkdown(notes), [notes]);
  const byTitle = useMemo(() => {
    const m = new Map<string, VaultNote>();
    for (const n of notes) m.set(n.title, n); // vault.ts titles are unique per vault
    return m;
  }, [notes]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copyTs = useRef(0);
  const copyAllTs = useRef(0);

  // vault.ts searchVault(notes, query): case-insensitive substring over
  // title+body+tags, ranked title > tag > body. Blank query → no results.
  const results = useMemo(() => {
    const query = q.trim();
    return query ? searchVault(notes, query) : null;
  }, [q, notes]);

  // Tag chips (from the VaultNote.tags field) + counts.
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes) {
      for (const t of n.tags) m.set(t, (m.get(t) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [notes]);

  // Notes visible under the active search + tag filter.
  const visible = useMemo(() => {
    const list = results ?? notes;
    return tag === null ? list : list.filter((n) => n.tags.includes(tag));
  }, [results, notes, tag]);

  // Detail default: the hub note (kind "index") — its body embeds the MOC
  // (vault.ts builds it from vaultIndex), so the tab opens on the Map of Content.
  const active = useMemo(() => {
    if (!visible.length) return null;
    const picked = selectedTitle
      ? visible.find((n) => n.title === selectedTitle)
      : undefined;
    return picked ?? visible.find((n) => n.kind === "index") ?? visible[0];
  }, [visible, selectedTitle]);

  // Browse layout: hub pinned on top, remaining notes grouped by kind with the
  // same section wording vault.ts uses in its exported MOC.
  const grouped = useMemo(() => {
    if (results) return null; // searching → flat ranked list instead of groups
    const hub: VaultNote[] = [];
    const byKind = new Map<VaultNote["kind"], VaultNote[]>();
    const order: VaultNote["kind"][] = [];
    for (const n of visible) {
      if (n.kind === "index") hub.push(n);
      else {
        if (!byKind.has(n.kind)) {
          byKind.set(n.kind, []);
          order.push(n.kind);
        }
        byKind.get(n.kind)!.push(n);
      }
    }
    return { hub, kinds: order.map((k) => ({ kind: k, notes: byKind.get(k)! })) };
  }, [results, visible]);

  // Obsidian-style panels over vault.ts's frozen `links` field (bare titles):
  // outgoing links of the active note + backlinks (notes linking to it).
  const linksOut = useMemo(() => {
    if (!active) return [];
    return active.links
      .map((t) => byTitle.get(t))
      .filter((n): n is VaultNote => Boolean(n));
  }, [active, byTitle]);

  const backlinks = useMemo(() => {
    if (!active) return [];
    return notes.filter((n) => n.links.includes(active.title));
  }, [notes, active]);

  function openNote(title: string) {
    setSelectedTitle(title);
    setError(null);
  }

  function flash(ref: { current: number }, setter: (v: boolean) => void) {
    const my = ++ref.current;
    setter(true);
    window.setTimeout(() => {
      if (ref.current === my) setter(false); // latest action only clears the toast
    }, 1600);
  }

  async function copyNote(note: VaultNote) {
    setError(null);
    try {
      await navigator.clipboard.writeText(note.body);
      flash(copyTs, setCopied);
    } catch {
      setError("Clipboard blocked — unable to copy this note.");
    }
  }

  async function copyVault() {
    setError(null);
    try {
      await navigator.clipboard.writeText(vaultMd);
      flash(copyAllTs, setCopiedAll);
    } catch {
      setError("Clipboard blocked — unable to copy the vault markdown.");
    }
  }

  function downloadVault() {
    setError(null);
    const blob = new Blob([vaultMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename(project, "md");
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSelectedTitle(null); // never leave a selection hidden by the filter
          }}
          aria-label="Search vault notes"
          placeholder="Search vault (title, body, tags)"
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="button"
          onClick={() => void copyVault()}
          aria-label="Copy whole vault as markdown"
          title="Copy the whole vault (.md export: frontmatter, MOC hub, wikilinks)"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Copy className="h-3.5 w-3.5" />
          {copiedAll ? "Copied vault" : "Copy whole vault"}
        </button>
        <button
          type="button"
          onClick={downloadVault}
          aria-label="Download vault as a markdown file"
          title="Download the whole vault as one .md file"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Download className="h-3.5 w-3.5" />
          Download vault.md
        </button>
      </div>

      {tagCounts.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-1.5 px-5 pt-2"
          aria-label="Filter vault notes by tag"
        >
          {tagCounts.map(([t, count]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(tag === t ? null : t)}
              aria-pressed={tag === t}
              className={`rounded-sm border px-2 py-1 font-mono text-[11px] ${
                tag === t ? "border-accent/60 text-accent" : "border-border text-muted hover:text-fg"
              }`}
            >
              #{t} · {count}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="px-5 pt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="px-5 py-10 text-sm text-muted">
          {q.trim() || tag !== null
            ? "No notes match this filter."
            : "No notes yet — run a phase to write memory rows and artifacts into the vault."}
        </div>
      ) : (
        <div className="grid min-h-[300px] md:grid-cols-[220px_minmax(0,1fr)]">
          <ul className="scroll-thin max-h-[560px] overflow-y-auto border-b border-line md:border-r md:border-b-0">
            {grouped ? (
              <>
                {grouped.hub.length > 0 ? (
                  <>
                    <VaultGroupHeader label="Map of content" count={grouped.hub.length} />
                    {grouped.hub.map((n) => (
                      <VaultNoteRow
                        key={n.title}
                        note={n}
                        active={active?.title === n.title}
                        onOpen={openNote}
                      />
                    ))}
                  </>
                ) : null}
                {grouped.kinds.map((g) => (
                  <Fragment key={g.kind}>
                    <VaultGroupHeader label={VAULT_KIND_LABELS[g.kind]} count={g.notes.length} />
                    {g.notes.map((n) => (
                      <VaultNoteRow
                        key={n.title}
                        note={n}
                        active={active?.title === n.title}
                        onOpen={openNote}
                      />
                    ))}
                  </Fragment>
                ))}
              </>
            ) : (
              <>
                <VaultGroupHeader label={`Results · ${q.trim()}`} count={visible.length} />
                {visible.map((n) => (
                  <VaultNoteRow
                    key={n.title}
                    note={n}
                    active={active?.title === n.title}
                    onOpen={openNote}
                  />
                ))}
              </>
            )}
          </ul>

          <div className="min-w-0">
            {active ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
                  <p className="min-w-0 truncate font-mono text-[11px] text-muted">
                    {noteKindCaption(active)}
                    <span className="text-faint"> · </span>
                    <span className="text-fg/90">{active.title}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyNote(active)}
                    aria-label={`Copy note ${active.title} to clipboard`}
                    title="Copy this note's markdown body"
                    className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? "Copied" : "Copy note"}
                  </button>
                </div>
                {linksOut.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2">
                    <span className="font-mono text-[11px] text-faint">links:</span>
                    {linksOut.map((b) => (
                      <button
                        key={b.title}
                        type="button"
                        onClick={() => openNote(b.title)}
                        className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-accent hover:border-accent/40"
                        title={`Open ${b.title}`}
                      >
                        {b.title}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="scroll-thin wrap-any max-h-[52vh] overflow-y-auto space-y-3 px-4 py-3">
                  <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-fg/90">
                    {renderVaultBody(active.body, byTitle, openNote)}
                  </div>
                  {active.tags.length > 0 ? (
                    <p className="font-mono text-[11px] text-faint">
                      tags: {active.tags.join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="border-t border-line px-4 py-3">
                  <p className="font-mono text-[11px] font-medium tracking-wide text-muted uppercase">
                    Linked from
                  </p>
                  {backlinks.length === 0 ? (
                    <p className="mt-1 text-xs text-faint">No notes link to this one.</p>
                  ) : (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {backlinks.map((b) => (
                        <li key={b.title}>
                          <button
                            type="button"
                            onClick={() => openNote(b.title)}
                            className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-accent hover:border-accent/40"
                            title={`Open ${b.title}`}
                          >
                            {noteKindCaption(b)} · {b.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <div className="px-4 py-10 text-sm text-muted">Select a note.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Design system tab (tokens → swatches, type scale, spacing/radius/shadow, exports) ----------
   Pure view over src/lib/design.ts's exports: designTokens (palette/scale data) and
   designHtml (standalone design.html document). designTokens is normalized
   defensively (grouped categories or a flat CSS-variable dictionary), so the pane
   renders whichever token layout design.ts ships. All colors/labels resolve through
   --color-* utilities, so the light theme re-themes every swatch automatically. */

type DesignSample = { name: string; value: string; usage?: string };

type DesignView = {
  colors: DesignSample[];
  fonts: DesignSample[];
  sizes: DesignSample[];
  spacing: DesignSample[];
  radius: DesignSample[];
  shadows: DesignSample[];
  /** Palette identity from design.ts's palette.name/base (e.g. "marketplace · violet"). */
  meta?: { name: string; base: string };
};

const EMPTY_DESIGN_VIEW: DesignView = {
  colors: [],
  fonts: [],
  sizes: [],
  spacing: [],
  radius: [],
  shadows: [],
};

function recordOf(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Flatten any plausible token container (array of entries, [name, value] pairs, bare strings, ...). */
function samplesOf(v: unknown): DesignSample[] {
  if (Array.isArray(v)) {
    const out: DesignSample[] = [];
    for (const item of v) {
      if (item === null || item === undefined) continue;
      if (typeof item === "string") {
        out.push({ name: item, value: item });
      } else if (Array.isArray(item)) {
        const [k, val] = item;
        if (typeof k === "string" && (typeof val === "string" || typeof val === "number")) {
          out.push({ name: k, value: String(val) });
        }
      } else {
        const o = recordOf(item);
        if (!o) continue;
        const name =
          typeof o.name === "string"
            ? o.name
            : typeof o.label === "string"
              ? o.label
              : typeof o.token === "string"
                ? o.token
                : "";
        const value =
          typeof o.value === "string"
            ? o.value
            : typeof o.value === "number"
              ? String(o.value)
              : typeof o.hex === "string"
                ? o.hex
                : typeof o.px === "number"
                  ? `${o.px}px`
                  : typeof o.size === "number"
                    ? `${o.size}px`
                    : typeof o.size === "string"
                      ? o.size
                      : typeof o.stack === "string"
                        ? o.stack
                        : typeof o.css === "string"
                          ? o.css
                          : "";
        if (name && value) {
          out.push({ name, value, usage: typeof o.usage === "string" ? o.usage : undefined });
        }
      }
    }
    return out;
  }
  const o = recordOf(v);
  if (!o) return [];
  return Object.entries(o)
    .filter((e): e is [string, string | number] => typeof e[1] === "string" || typeof e[1] === "number")
    .map(([k, val]) => ({ name: k, value: String(val) }));
}

function pickFirst(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

const COLOR_LIKE_RE =
  /^(#[0-9a-f]{3,8}|(rgb|hsl|oklch|lab|lch|hwb|color-mix|light-dark)\(|transparent|currentcolor)$/i;

/** Display labels for design.ts's 7-step type ramp (index 0 = smallest). */
const RAMP_LABELS = ["xs", "sm", "base", "md", "lg", "xl", "2xl"];

/**
 * Precise view over design.ts's DesignTokens shape:
 * { palette: { name, base, tokens: Record<string, hex> }, typography: { scale: string[], mono },
 *   spacing: number[], radius: number[], shadows: string[] }.
 * Returns null when the object does not look like that shape (caller falls back to the
 * generic normalizer so a future design.ts refactor still renders something sane).
 */
function tokensView(out: unknown): DesignView | null {
  const root = recordOf(out);
  if (!root) return null;
  const palette = recordOf(root.palette);
  const paletteTokens = palette ? recordOf(palette.tokens) : null;
  const typography = recordOf(root.typography);
  const scaleArr = typography && Array.isArray(typography.scale) ? typography.scale : null;
  const monoStr = typography && typeof typography.mono === "string" ? typography.mono : null;
  const spacingArr = Array.isArray(root.spacing) ? root.spacing : null;
  const radiusArr = Array.isArray(root.radius) ? root.radius : null;
  const shadowsArr = Array.isArray(root.shadows) ? root.shadows : null;
  if (!paletteTokens && !scaleArr && !monoStr && !spacingArr && !radiusArr && !shadowsArr) {
    return null;
  }
  const view: DesignView = { colors: [], fonts: [], sizes: [], spacing: [], radius: [], shadows: [] };
  if (paletteTokens) {
    for (const [k, v] of Object.entries(paletteTokens)) {
      if (typeof v === "string") view.colors.push({ name: k, value: v });
    }
    if (palette && typeof palette.name === "string") {
      view.meta = { name: palette.name, base: typeof palette.base === "string" ? palette.base : "" };
    }
  }
  if (scaleArr) {
    view.sizes = scaleArr.map((s, i) => ({
      name: RAMP_LABELS[i] ?? `size-${i + 1}`,
      value: typeof s === "string" ? s : `${s}px`,
    }));
  }
  if (monoStr) view.fonts.push({ name: "mono", value: monoStr });
  if (spacingArr) {
    view.spacing = spacingArr
      .filter((n): n is number => typeof n === "number")
      .map((n) => ({ name: `${n}`, value: `${n}px` }));
  }
  if (radiusArr) {
    view.radius = radiusArr
      .filter((n): n is number => typeof n === "number")
      .map((n) => ({ name: `${n}`, value: `${n}px` }));
  }
  if (shadowsArr) {
    view.shadows = shadowsArr.map((s, i) => ({ name: `${i}`, value: String(s) }));
  }
  return view;
}

/** Invoke a generator defensively; returns null when it throws (module still in flight). */
function safeInvoke<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** Normalize design.ts's designTokens export into the pane's render model. */
function designView(raw0: unknown): DesignView {
  const raw = recordOf(raw0);
  if (!raw) return EMPTY_DESIGN_VIEW;
  // Some shapes wrap the palette under a single holder key — recurse into it.
  for (const holder of ["tokens", "css", "variables", "designTokens", "theme"]) {
    const inner = raw[holder];
    if (inner !== null && typeof inner === "object" && !Array.isArray(inner)) {
      return designView(inner);
    }
  }
  // DesignTokens-like objects that the precise normalizer did not recognize (a changed
  // design.ts layout) must not be misfiled by the generic probes below — stay empty instead.
  for (const k of ["palette", "typography", "spacing", "radius", "shadows"]) {
    if (raw[k] !== undefined && raw[k] !== null) return EMPTY_DESIGN_VIEW;
  }
  const view: DesignView = { colors: [], fonts: [], sizes: [], spacing: [], radius: [], shadows: [] };
  const grouped = pickFirst(raw, ["colors", "color", "palette", "swatches"]);
  if (grouped !== undefined) {
    view.colors = samplesOf(grouped);
    view.fonts = samplesOf(pickFirst(raw, ["fonts", "fontFamilies", "fontStacks"]));
    view.sizes = samplesOf(pickFirst(raw, ["sizes", "typeScale", "type", "typography", "fontSizes", "text"]));
    view.spacing = samplesOf(pickFirst(raw, ["spacing", "space", "spacings"]));
    view.radius = samplesOf(pickFirst(raw, ["radius", "radii", "rounded", "borderRadius"]));
    view.shadows = samplesOf(pickFirst(raw, ["shadows", "shadow", "elevation"]));
    return view;
  }
  // Flat CSS-variable dictionary shape: { "--color-bg": "#0b0c0e", "--space-2": "8px", ... }.
  const entries = Object.entries(raw).filter(
    (e): e is [string, string] => typeof e[1] === "string",
  );
  for (const [k, v] of entries) {
    const name = k.startsWith("--") ? k : `--${k}`;
    const sample: DesignSample = { name, value: v };
    if (name.startsWith("--color") || COLOR_LIKE_RE.test(v)) view.colors.push(sample);
    else if (name.startsWith("--font")) view.fonts.push(sample);
    else if (name.startsWith("--radius") || name.includes("radius")) view.radius.push(sample);
    else if (name.startsWith("--space")) view.spacing.push(sample);
    else if (name.startsWith("--shadow") || name.includes("elevation")) view.shadows.push(sample);
    else view.sizes.push(sample);
  }
  return view;
}

/** Format the normalized tokens as a paste-ready `:root { … }` CSS variable block. */
function cssVarsText(view: DesignView): string {
  const lines: string[] = [];
  const push = (prefix: string, samples: DesignSample[]) => {
    for (const s of samples) {
      const stem = s.name
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "");
      if (!stem) continue;
      const key = stem.startsWith("--") ? stem : `--${prefix}${stem}`;
      const line = `  ${key}: ${s.value};`;
      if (!lines.includes(line)) lines.push(line);
    }
  };
  push("color-", view.colors);
  push("font-", view.fonts);
  push("text-", view.sizes);
  push("space-", view.spacing);
  push("radius-", view.radius);
  push("shadow-", view.shadows);
  return `:root {\n${lines.join("\n")}\n}`;
}

/** Short display name for a token (strips the CSS-variable prefix for chips/labels). */
function shortTokenName(name: string): string {
  return name.replace(/^--(color-)?/, "");
}

/** Parse a CSS length ("14px", "0.875rem", "50%", bare "12") into a width in px, when possible. */
function pxOf(value: string): number | undefined {
  const m = /^(\d+(?:\.\d+)?)(px|rem|em)?$/.exec(value.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = m[2];
  if (unit === "rem" || unit === "em") return n * 16;
  return n;
}

/** Re-emit a token value as a valid CSS length when it parses; undefined otherwise. */
function cssLengthOf(value: string): string | undefined {
  const t = value.trim();
  if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(t)) return t;
  if (/^\d+(\.\d+)?$/.test(t)) return `${t}px`;
  return undefined;
}

/** Values that are safe to forward into a CSS property (no injection seams from pure modules). */
const SAFE_CSS_RE = /^[^;{}]{1,160}$/;

function safeCssValue(value: string): string | undefined {
  return SAFE_CSS_RE.test(value.trim()) ? value.trim() : undefined;
}

/** Standalone design.html generator; bridged through unknown so a still-in-flight
    design.ts signature (project-less or project-taking) cannot break this build. */
const designHtmlForProject = designHtml as unknown as (project: Project) => string;

/** designTokens may ship as a static object or a project function — load and normalize both. */
function loadDesignView(project: Project): DesignView {
  const rawTokens: unknown = designTokens;
  const raw: unknown =
    typeof rawTokens === "function"
      ? safeInvoke(() => (rawTokens as (project: Project) => unknown)(project))
      : rawTokens;
  return tokensView(raw) ?? designView(raw);
}

function DesignPane({ project }: { project: Project }) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedCss, setCopiedCss] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flashTs = useRef(0);

  const view = useMemo(() => loadDesignView(project), [project]);
  const cssVars = useMemo(() => cssVarsText(view), [view]);
  const hasTokens =
    view.colors.length +
      view.fonts.length +
      view.sizes.length +
      view.spacing.length +
      view.radius.length +
      view.shadows.length >
    0;

  function flashToken(name: string) {
    const my = ++flashTs.current;
    setCopiedToken(name);
    window.setTimeout(() => {
      if (flashTs.current === my) setCopiedToken(null);
    }, 1400);
  }

  async function copyValue(sample: DesignSample) {
    setError(null);
    try {
      await navigator.clipboard.writeText(sample.value);
      flashToken(sample.name);
    } catch {
      setError("Clipboard blocked — unable to copy the token value.");
    }
  }

  async function copyCssVars() {
    setError(null);
    try {
      await navigator.clipboard.writeText(cssVars);
      setCopiedCss(true);
      window.setTimeout(() => setCopiedCss(false), 1600);
    } catch {
      setError("Clipboard blocked — unable to copy the CSS variables.");
    }
  }

  function downloadDesignHtml() {
    setError(null);
    let html = "";
    try {
      html = designHtmlForProject(project);
    } catch {
      setError("design.html generation failed — design.ts did not return a document.");
      return;
    }
    if (!html.trim()) {
      setError("design.ts returned an empty design.html for this project.");
      return;
    }
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugName(project.name)}-design.html`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const toolBtn =
    "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
        <button
          type="button"
          onClick={downloadDesignHtml}
          aria-label="Download design.html for this build"
          title="Standalone design system page generated by design.ts"
          className={toolBtn}
        >
          <Download className="h-3.5 w-3.5" />
          Download design.html
        </button>
        <button
          type="button"
          onClick={() => void copyCssVars()}
          aria-label="Copy design tokens as CSS variables"
          title="Copy the token palette as a :root CSS variable block"
          className={toolBtn}
        >
          <Copy className="h-3.5 w-3.5" />
          {copiedCss ? "Copied CSS" : "Copy CSS variables"}
        </button>
      </div>
      <p className="px-5 pt-2 font-mono text-[11px] text-faint">
        Deterministic design system for this build{view.meta ? ` · ${view.meta.name}` : ""} — generated
        by design.ts, previewed below.
      </p>

      {error ? (
        <p role="alert" className="px-5 pt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!hasTokens ? (
        <div className="px-5 py-8 text-sm text-muted">
          No design tokens to preview — design.ts returned an empty palette for this project.
        </div>
      ) : (
        <div className="pb-4">
          {view.colors.length > 0 ? (
            <section aria-label="Color tokens" className="px-5 pt-4">
              <h3 className="font-mono text-[11px] font-medium tracking-widest text-muted uppercase">
                Color palette · {view.colors.length}
              </h3>
              <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2">
                {view.colors.map((s) => {
                  const color = COLOR_LIKE_RE.test(s.value.trim()) ? s.value.trim() : undefined;
                  return (
                    <button
                      key={`${s.name}-${s.value}`}
                      type="button"
                      onClick={() => void copyValue(s)}
                      aria-label={`Copy color ${shortTokenName(s.name)} — ${s.value}`}
                      title={s.usage ? `${s.usage} — click to copy ${s.value}` : `Click to copy ${s.value}`}
                      className="group min-w-0 rounded-md border border-border bg-raised p-2 text-left outline-none hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      <span
                        aria-hidden="true"
                        className={`block h-10 w-full rounded-sm ${color ? "" : "bg-faint"}`}
                        style={color ? { background: color } : undefined}
                      />
                      <span className="mt-1.5 block truncate font-mono text-[10px] text-fg/80">
                        {shortTokenName(s.name)}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-faint">{s.value}</span>
                      {copiedToken === s.name ? (
                        <span className="mt-1 flex items-center gap-1 font-mono text-[10px] text-ok">
                          <Check className="h-3 w-3" /> Copied
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {view.sizes.length > 0 ? (
            <section aria-label="Typography scale" className="px-5 pt-4">
              <h3 className="font-mono text-[11px] font-medium tracking-widest text-muted uppercase">
                Type scale · {view.sizes.length}
              </h3>
              <div className="mt-2">
                {view.sizes.map((s) => {
                  const size = cssLengthOf(s.value);
                  return (
                    <div key={`${s.name}-${s.value}`} className="border-b border-line py-2 last:border-0">
                      <p className="font-mono text-[11px] text-faint">
                        {shortTokenName(s.name)} · {s.value}
                      </p>
                      <p
                        className="mt-1 truncate text-fg/90"
                        style={size ? { fontSize: size } : undefined}
                      >
                        Ag — RapidTool governed delivery
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {view.fonts.length > 0 ? (
            <section aria-label="Font families" className="px-5 pt-4">
              <h3 className="font-mono text-[11px] font-medium tracking-widest text-muted uppercase">
                Fonts · {view.fonts.length}
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {view.fonts.map((s) => {
                  const stack = safeCssValue(s.value);
                  return (
                    <div key={`${s.name}-${s.value}`} className="rounded-md border border-border bg-raised px-3 py-2">
                      <p className="font-mono text-[11px] text-faint">
                        {shortTokenName(s.name)} · {s.value}
                      </p>
                      <p className="mt-1 truncate text-xl text-fg" style={stack ? { fontFamily: stack } : undefined}>
                        Ag
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {view.spacing.length > 0 ? (
            <section aria-label="Spacing scale" className="px-5 pt-4">
              <h3 className="font-mono text-[11px] font-medium tracking-widest text-muted uppercase">
                Spacing · {view.spacing.length}
              </h3>
              <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
                {view.spacing.map((s) => {
                  const w = pxOf(s.value);
                  return (
                    <div key={`${s.name}-${s.value}`} className="min-w-0">
                      <p className="font-mono text-[10px] text-faint">
                        {shortTokenName(s.name)} · {s.value}
                      </p>
                      <span
                        aria-hidden="true"
                        className="mt-1 block h-2 rounded-sm bg-accent/60"
                        style={{ width: w !== undefined ? Math.min(Math.max(w, 1), 240) : 56 }}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {view.radius.length > 0 ? (
            <section aria-label="Border radius tokens" className="px-5 pt-4">
              <h3 className="font-mono text-[11px] font-medium tracking-widest text-muted uppercase">
                Radius · {view.radius.length}
              </h3>
              <div className="mt-2 flex flex-wrap items-end gap-4">
                {view.radius.map((s) => {
                  const rx = cssLengthOf(s.value);
                  return (
                    <div key={`${s.name}-${s.value}`} className="min-w-0">
                      <p className="font-mono text-[10px] text-faint">
                        {shortTokenName(s.name)} · {s.value}
                      </p>
                      <span
                        aria-hidden="true"
                        className="mt-1 block h-9 w-16 rounded-sm border border-border bg-raised"
                        style={rx ? { borderRadius: rx } : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {view.shadows.length > 0 ? (
            <section aria-label="Shadow tokens" className="px-5 pt-4">
              <h3 className="font-mono text-[11px] font-medium tracking-widest text-muted uppercase">
                Shadows · {view.shadows.length}
              </h3>
              <div className="mt-2 flex flex-wrap items-end gap-4">
                {view.shadows.map((s) => {
                  const shadow = safeCssValue(s.value);
                  return (
                    <div key={`${s.name}-${s.value}`} className="min-w-0">
                      <p className="font-mono text-[10px] text-faint">
                        {shortTokenName(s.name)} · {s.value}
                      </p>
                      <span
                        aria-hidden="true"
                        className="mt-1 block h-9 w-16 rounded-sm border border-border bg-raised"
                        style={shadow ? { boxShadow: shadow } : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ---------- Diagram tab (buildDiagram SVG: kind switcher, render, copy, download) ----------
   Pure view over src/lib/diagram.ts's buildDiagram(project, kind: DiagramKind) → SVG markup.
   Rendered through a data: URI <img> (no innerHTML anywhere, per the console's
   injection posture). The export surface is still in flight, so the SVG text is
   extracted defensively (string, or an object carrying .svg) and any throw is
   contained to the pane. */

const DIAGRAM_KINDS: { id: DiagramKind; label: string; hint: string }[] = [
  { id: "phases", label: "Phases", hint: "13-phase graph — current position, gates, and statuses." },
  { id: "architecture", label: "Architecture", hint: "Modules, onboard algorithms, and their couplings." },
  { id: "flow", label: "Flow", hint: "Control flow — HITL gates, approvals, reject loops, handoffs." },
];

function toSvgText(out: unknown): string {
  if (typeof out === "string") return out;
  const o = recordOf(out);
  const s = o?.svg;
  return typeof s === "string" ? s : "";
}

function DiagramPane({ project }: { project: Project }) {
  const [kind, setKind] = useState<DiagramKind>("phases");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copyTs = useRef(0);
  const active = DIAGRAM_KINDS.find((k) => k.id === kind) ?? DIAGRAM_KINDS[0];

  const svgText = useMemo(() => {
    try {
      return toSvgText(buildDiagram(project, kind));
    } catch {
      return ""; // diagram.ts still in flight or thrown on this project shape — pane stays alive.
    }
  }, [project, kind]);
  const svgUri = useMemo(
    () => (svgText ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}` : ""),
    [svgText],
  );

  async function copySvg() {
    setError(null);
    try {
      await navigator.clipboard.writeText(svgText);
      const my = ++copyTs.current;
      setCopied(true);
      window.setTimeout(() => {
        if (copyTs.current === my) setCopied(false);
      }, 1600);
    } catch {
      setError("Clipboard blocked — unable to copy the SVG.");
    }
  }

  function downloadSvg() {
    setError(null);
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugName(project.name)}-diagram-${kind}.svg`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
        <button
          type="button"
          onClick={downloadSvg}
          disabled={!svgText}
          aria-label="Download the diagram as an SVG file"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          Download SVG
        </button>
        <button
          type="button"
          onClick={() => void copySvg()}
          disabled={!svgText}
          aria-label="Copy the diagram SVG markup"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-40"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied SVG" : "Copy SVG"}
        </button>
      </div>
      <p className="px-5 pt-2 font-mono text-[11px] text-faint">
        Rendered from diagram.ts · {active.label.toLowerCase()} view of this build.
      </p>

      <div role="group" aria-label="Diagram kind" className="flex flex-wrap gap-1 px-5 pt-3">
        {DIAGRAM_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            aria-pressed={kind === k.id}
            className={`min-h-9 rounded-md border px-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              kind === k.id
                ? "border-accent/60 text-accent"
                : "border-border text-muted hover:text-fg hover:border-accent/40"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="px-5 pt-2 font-mono text-[11px] text-faint">{active.hint}</p>

      {error ? (
        <p role="alert" className="px-5 pt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="px-5 py-4">
        {svgText ? (
          <div
            className="overflow-auto rounded-md border border-border bg-surface"
            aria-label={`${active.label} diagram`}
          >
            <img
              src={svgUri}
              alt={`${active.label} diagram for ${project.name}`}
              className="mx-auto block h-auto"
            />
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            No {active.label.toLowerCase()} diagram yet — diagram.ts returned no SVG for this build.
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Chat tab (grounded copilot — wave 48 lib, wave 49 UI) ---------- */

/** One chat row rendered in the Chat pane (view over chat.ts turns). */
type ChatMsgView = {
  id: number; // incrementing local counter
  role: "user" | "assistant";
  text: string;
  ts: number;
  code?: string; // normalized "RT_E_*" when the turn failed (or not-configured)
  error?: boolean; // true ⇒ rendered as a failure row with badge
  provenance?: string; // "Grounded in build context v… as of P…" stamp on ok turns
};

/** Keep only the newest 12 rows (= last 6 user/assistant turns). */
function trimTurns(rows: ChatMsgView[]): ChatMsgView[] {
  return rows.length > 12 ? rows.slice(-12) : rows;
}

/** P0-2: map persisted Project.chatLog rows into local views with fresh local
 *  ids. Defensive — a hostile/corrupt persisted row never reaches the render
 *  (structural guards mirror chat.ts sanitizeChatLog). */
function chatLogToViews(
  rows: ChatLogRow[] | undefined | null,
  nextId: { current: number },
): ChatMsgView[] {
  const out: ChatMsgView[] = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== "object") continue;
    if (r.role !== "user" && r.role !== "assistant") continue;
    if (typeof r.text !== "string" || r.text.length === 0) continue;
    out.push({
      id: nextId.current++,
      role: r.role,
      text: r.text,
      ts: typeof r.ts === "number" && Number.isFinite(r.ts) ? r.ts : Date.now(),
      ...(r.error === true ? { error: true } : {}),
      ...(typeof r.code === "string" && /^RT_E_[A-Z0-9_]+$/.test(r.code)
        ? { code: r.code }
        : {}),
      ...(typeof r.provenance === "string" && r.provenance.length > 0
        ? { provenance: r.provenance }
        : {}),
    });
  }
  return trimTurns(out);
}

/** P0-2: a display row → persisted row (id dropped — ids stay local). */
function toChatLogRow(m: ChatMsgView): ChatLogRow {
  return {
    role: m.role,
    text: m.text,
    ts: m.ts,
    ...(m.error === true ? { error: true } : {}),
    ...(typeof m.code === "string" ? { code: m.code } : {}),
    ...(typeof m.provenance === "string" && m.provenance.length > 0
      ? { provenance: m.provenance }
      : {}),
  };
}

/** Accept only well-formed RT_E_* codes (never trust a sibling result shape). */
function normalizeCode(c: unknown): string | null {
  return typeof c === "string" && /^RT_E_[A-Z0-9_]+$/.test(c) ? c : null;
}

/**
 * ERROR_CODE_DOC is a sibling export — never trust its shape. Landed rows are
 * { meaning, agentAction } (fixes/48); tone is derived locally: actionable
 * state/not-configured families read "warn", hard failures read "danger".
 */
const WARN_TONE_CODES = new Set([
  "RT_E_LLM_NOT_CONFIGURED",
  "RT_E_RUNNER_UNAVAILABLE",
  "RT_E_RESEARCH_UNAVAILABLE",
  "RT_E_GATE_PENDING",
]);
type ChatDocRow = { meaning: string; tone: "warn" | "danger"; agentAction: string };
function codeDocOf(code: string): ChatDocRow | null {
  try {
    const doc = (ERROR_CODE_DOC as unknown as Record<string, unknown>)[code];
    if (!doc || typeof doc !== "object") return null;
    const row = doc as { meaning?: unknown; agentAction?: unknown };
    if (typeof row.meaning !== "string" || typeof row.agentAction !== "string") return null;
    return {
      meaning: row.meaning,
      tone: WARN_TONE_CODES.has(code) ? "warn" : "danger",
      agentAction: row.agentAction,
    };
  } catch {
    return null;
  }
}

/** One message bubble: user text, copilot markdown, or a failure row + code badge. */
function ChatMsgRow({ msg, onRetry }: { msg: ChatMsgView; onRetry?: () => void }) {
  const doc = msg.code ? codeDocOf(msg.code) : null;
  const badgeClass = doc
    ? doc.tone === "warn"
      ? "border-warn/30 text-warn"
      : "border-danger/30 text-danger"
    : "border-border text-faint";
  const roleLabel = msg.role === "user" ? "you" : msg.error ? "error" : "copilot";
  const rowClass =
    msg.role === "user" ? "chat-row-user" : msg.error ? "chat-row-error" : "chat-row-assistant";
  return (
    <div className={`chat-row ${rowClass}`}>
      <div className="chat-bubble">
        <p className="chat-meta">
          <span className="chat-meta-role">{roleLabel}</span>
          <span>{fmtClock(msg.ts)}</span>
        </p>
        {msg.error ? (
          <div>
            <p className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-danger [overflow-wrap:anywhere]">
              {msg.text}
            </p>
            {msg.code ? (
              <span className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                <span
                  title={doc ? doc.agentAction : "Uncatalogued error code"}
                  aria-label={
                    doc
                      ? `Error ${msg.code}: ${doc.meaning}. ${doc.agentAction}`
                      : `Error ${msg.code}: uncatalogued`
                  }
                  className={`rt-badge inline-block rounded-sm border px-1.5 py-0.5 font-mono text-[11px] ${badgeClass}`}
                >
                  {msg.code}
                </span>
                {doc ? (
                  <span className="font-mono text-[11px] text-faint">{doc.meaning}</span>
                ) : null}
              </span>
            ) : null}
            {onRetry ? (
              // 93 §3.14: the honest retry is a NEW send (failure rows are
              // never replayed by chatHistoryTurns) — copy the failed text
              // back into the draft, never a silent resubmit.
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-muted hover:text-fg"
              >
                Retry — copy into draft
              </button>
            ) : null}
          </div>
        ) : msg.role === "user" ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
            {msg.text}
          </p>
        ) : (
          <div>
            <MarkdownBody text={msg.text} />
            {msg.provenance ? <p className="chat-prov">{msg.provenance}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One grounded copilot turn, defensively normalized: chat.ts is a sibling
 * module — never trust it to keep its {ok:false} contract.
 */
type ChatOutcome =
  | { ok: true; reply: string; provenance?: string }
  | { ok: false; error: string; code?: string };
async function chatOnceSafe(
  project: Project,
  text: string,
  history: ChatTurn[],
): Promise<ChatOutcome> {
  try {
    const res = await chatOnce(project, text, history);
    if (res && typeof res === "object" && (res as { ok?: unknown }).ok === true) {
      const reply = (res as { reply?: unknown }).reply;
      const provenance = (res as { provenance?: unknown }).provenance;
      if (typeof reply === "string") {
        return {
          ok: true,
          reply,
          provenance: typeof provenance === "string" ? provenance : undefined,
        };
      }
      // 99 §3.2: an unparseable SUCCESS shape IS an internal serialization
      // failure — carry RT_E_INTERNAL (never code:null, never prose-guessed).
      return { ok: false, error: "Chat backend returned an unparseable response.", code: "RT_E_INTERNAL" };
    }
    const fail = res as { error?: unknown; code?: unknown };
    return {
      ok: false,
      error:
        typeof fail.error === "string" && fail.error.length > 0
          ? fail.error
          : "Chat failed.",
      code: normalizeCode(fail.code) ?? "RT_E_INTERNAL",
    };
  } catch {
    // chatOnce threw (unexpected host drift / transport failure) — render an
    // honest failure with the internal-transport code (99 §3.2), never a
    // badge-less null. The message says the request failed BEFORE a reply —
    // it must not blame an "unparseable response" it never saw (156 E2).
    return {
      ok: false,
      error: "Chat request failed before a reply — the backend did not respond.",
      code: "RT_E_INTERNAL",
    };
  }
}

/**
 * Oracle tab — machine verify block (99 §4.5, DF-15/DF-16 visibility): the
 * last verify run is ALWAYS visible here, even when the A7 template-prose
 * case list above is empty. Reads project.lastTest (provenance label,
 * evidenceHash, pass/fail) and the "verify" gate artifacts stamped by
 * headless.applyVerifyOutcome (kind "verify", id prefix "verify-"). Honest by
 * construction: with no machine verify outcome on record, the block says so —
 * the template prose is never presented as a runnable check.
 */
function OracleVerifyBlock({ project }: { project: Project }) {
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);
  const hasSource = typeof (project as { generatedSource?: unknown }).generatedSource === "string" &&
    ((project as { generatedSource?: string }).generatedSource ?? "").trim().length > 0;
  const runVerify = async () => {
    setVerifyBusy(true);
    setVerifyNote(null);
    try {
      const res = await useRapid.getState().runVerifyAsync(project.id);
      if (!res.ok) {
        setVerifyNote(
          res.status === "not-configured"
            ? "No LLM backend configured — machine verify needs a DeepSeek key server-side."
            : res.error ?? "verify failed",
        );
      } else {
        setVerifyNote(`verify ${res.status} after ${res.iterations} iteration(s) — outcome recorded.`);
      }
    } catch (err) {
      setVerifyNote(err instanceof Error ? err.message : String(err));
    } finally {
      setVerifyBusy(false);
    }
  };
  const lt = project.lastTest;
  const ltLabel = lt ? (lt as LastTestWithLabel).label : undefined;
  const hash =
    lt && typeof (lt as { evidenceHash?: unknown }).evidenceHash === "string"
      ? ((lt as { evidenceHash?: unknown }).evidenceHash as string).slice(0, 8)
      : null;
  // Verify artifacts are appended chronologically; newest first for display.
  const verifyArtifacts = (project.artifacts ?? [])
    .filter((a) => (a as { kind?: unknown }).kind === "verify")
    .slice()
    .reverse();
  const hasMachineVerify =
    Boolean(lt && ltLabel === "tested") || verifyArtifacts.length > 0;

  return (
    <div className="mt-2 space-y-2">
      {lt ? (
        <div className="rounded-md border border-border px-3 py-3">
          <p className="font-mono text-[11px] text-accent">
            lastTest · {ltLabel ? (LAST_TEST_LABEL_TEXT[ltLabel] ?? `test (${ltLabel})`) : "untagged"} ·{" "}
            {lt.ok ? "passed" : "failed"}
            {hash ? ` · hash ${hash}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">{lt.detail}</p>
        </div>
      ) : null}
      {verifyArtifacts.map((a) => (
        <div key={a.id} className="rounded-md border border-border px-3 py-3">
          <p className="font-mono text-[11px] text-accent">{a.title}</p>
          <p className="mt-1 text-xs text-muted [overflow-wrap:anywhere]">
            {a.body.replace(/^#.*\n/, "").slice(0, 160)}
            {a.body.length > 160 ? "…" : ""}
          </p>
        </div>
      ))}
      {!hasMachineVerify ? (
        <p className="text-xs text-muted">
          No oracle run yet — the machine verify loop has not produced an outcome for this
          build. Executable check cases are generated from brief + source at run time (never
          the template prose above); run “rapidtool verify” from the CLI to land one here.
        </p>
      ) : null}
      {verifyNote ? (
        <p className="text-xs text-muted" role="status">
          {verifyNote}
        </p>
      ) : null}
      {hasSource ? (
        <button
          type="button"
          disabled={verifyBusy}
          onClick={runVerify}
          className="btn-solid inline-flex min-h-9 items-center gap-2 rounded-md bg-fg px-3 text-xs font-medium text-bg disabled:opacity-40"
        >
          {verifyBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" />}
          {verifyBusy ? "Verifying…" : "Run machine verify"}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Chat tab: grounded copilot over this build (chat.ts chatOnce → chat.server.ts
 * DeepSeek FLASH). P0-2: the thread persists to Project.chatLog via the
 * store's appendChatRows — a reload restores the log (render ≤12 rows; the
 * model sees ≤6 turns; storage caps at 40). forceMount keeps the thread alive
 * across tab switches; the route key remounts per project (run.$id.tsx UI-1).
 */
function ChatPane({ project }: { project: Project }) {
  const { llmStatus, autopilot, appendChatRows } = useRapid();
  // No-key honesty: `configured` is the live server-boundary probe result.
  // When it is false the composer is disabled (no dead send that can only
  // produce an RT_E_LLM_NOT_CONFIGURED row) and the grounding-context meter
  // is not presented as if a reply could consume it.
  const noBackend = !llmStatus.configured;
  const nextId = useRef(1);
  const [msgs, setMsgs] = useState<ChatMsgView[]>(() =>
    chatLogToViews(project.chatLog, nextId),
  );
  // Frozen at mount: the "Thread restored" caption shows only for a genuine
  // reload/remount, never for rows appended during this session (99 §3.3).
  const [restoredRows] = useState<number>(() =>
    Array.isArray(project.chatLog) ? project.chatLog.length : 0,
  );
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // re-entrant sends ignored while busy
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // PB-05b (DF-13/P1-5): grounding-context meter — the exact chars/version the
  // next reply is grounded in. Fetched only while a backend is configured:
  // with no key there is no next reply, so the meter goes idle instead of
  // claiming a grounding that cannot be used. Null ⇒ fetch refused → caption.
  const [ctxInfo, setCtxInfo] = useState<{ chars: number; max: number; version: number } | null>(null);
  // sendSeq: bumped when a send completes (success OR failure). It forces the
  // meter to re-read the CURRENT build-context version once the reply lands,
  // so the staleness note below can compare the reply's stamped version to
  // the state as it is NOW — a project that changed while the model was
  // answering must be flagged, not silently re-read as current (156 E2).
  const [sendSeq, setSendSeq] = useState(0);
  useEffect(() => {
    if (noBackend) {
      setCtxInfo(null);
      return;
    }
    let alive = true;
    void chatContextInfo(project).then((info) => {
      if (alive) setCtxInfo(info);
    });
    return () => {
      alive = false;
    };
  }, [project, noBackend, sendSeq]);
  // 99 §2.4.1: honest liveness ticker — a live elapsed counter replaces the
  // dead pulse so "hung or working?" is never ambiguous during a one-shot send.
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!busy) {
      setElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    const iv = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [busy]);

  // Auto-scroll the message region to the newest row.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  async function send(promptOverride?: string) {
    const text = (promptOverride ?? draft).trim();
    // noBackend guard: the composer is disabled in that state; this also keeps
    // a stale chip/Enter race from turning into a dead send.
    if (!text || busyRef.current || noBackend) return;
    // F2: history = REAL turns only. Failure rows stay in the display log but
    // are never replayed to the model as assistant speech.
    const history: ChatTurn[] = chatHistoryTurns(msgs);
    const userRow: ChatMsgView = {
      id: nextId.current++,
      role: "user",
      text,
      ts: Date.now(),
    };
    setMsgs((prev) => trimTurns([...prev, userRow]));
    setDraft("");
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await chatOnceSafe(project, text, history);
      const turn: ChatMsgView = res.ok
        ? {
            id: nextId.current++,
            role: "assistant",
            text: res.reply,
            ts: Date.now(),
            provenance: res.provenance,
          }
        : {
            id: nextId.current++,
            role: "assistant",
            text: res.error,
            ts: Date.now(),
            error: true,
            code: res.code ?? undefined,
          };
      setMsgs((prev) => trimTurns([...prev, turn]));
      // P0-2 (99 §1.4b): persist the user row + the terminal turn in ONE atomic
      // append. Every path lands here — chatOnceSafe converts throws to error
      // rows — so a finally-persist (which would store nothing on throw) is
      // never needed; the store update is atomic per turn and caps at 40.
      appendChatRows(project.id, [toChatLogRow(userRow), toChatLogRow(turn)]);
    } finally {
      busyRef.current = false;
      setBusy(false);
      // Re-read the context meter so the next render compares reply stamps
      // against the CURRENT build version, not the send-time one (156 E2).
      setSendSeq((s) => s + 1);
    }
  }

  // --- Quick-action chips: prompts built from LIVE project state (§2.4). ---
  function explainGatePrompt(): string {
    const h = project.hitl;
    if (h) {
      return `Explain the approval gate now open at P${h.phase} — ${h.title}: what it is asking (${h.prompt}), its stakes (${h.stakes}), and exactly what evidence an approval needs${h.forceHuman ? " (this is a human-only forceHuman gate)" : ""}. What makes its DoD pass or fail?`;
    }
    if (project.status === "blocked") {
      return `This build is blocked at P${project.currentPhase} (${phaseDef(project.currentPhase).title}). Explain why a build parks as blocked, what a retry does, and what a rejection note must contain to unlock it.`;
    }
    return `No gate is open: project status "${project.status}" at P${project.currentPhase} (${phaseDef(project.currentPhase).title}), phase status ${project.phases[project.currentPhase]?.status ?? "unknown"}. Explain the current pipeline state and what would open the next gate.`;
  }
  function nextActionPrompt(): string {
    return `What is the single next legal action for this build? State: project "${project.status}" at P${project.currentPhase} (${phaseDef(project.currentPhase).title}); that phase's status: ${project.phases[project.currentPhase]?.status ?? "unknown"}; autopilot: ${autopilot ? "on" : "off"}. Evaluate run/gate step, approve, reject, retry-after-rejection, ingest agent report, and packet/export — say which are legal now and which are not, and why, per the phase machine's transition rules.`;
  }
  function packetPrompt(): string {
    if (project.packet) {
      return `Summarize this build's agent packet (currently ${project.packet.length} chars) for a fresh agent: goal, architecture, current phase, gate status, top constraints, and the single most useful next step. Keep it under 200 words; do not invent details not in the packet.`;
    }
    return `The agent packet for "${project.name}" is not compiled yet (project at P${project.currentPhase}, status ${project.status}). Summarize where the build stands from the phase state instead, and say what action compiles the packet.`;
  }

  const chips: { label: string; prompt: () => string }[] = [
    { label: "explain current gate", prompt: explainGatePrompt },
    { label: "next legal action", prompt: nextActionPrompt },
    { label: "summarize packet", prompt: packetPrompt },
  ];

  const backendLabel = llmStatus.configured
    ? llmStatus.model ?? llmStatus.label
    : llmStatus.label;

  // 156 E2 — stale-grounding honesty: an assistant row whose provenance stamp
  // names a context version other than the CURRENT meter version is speech
  // grounded in a superseded build state (a restored thread from an earlier
  // state, or a project that changed while an answer was being composed).
  // One quiet note when the meter is live; with no backend / refused fetch
  // (ctxInfo null) no claim is made either way — the per-row stamps shown on
  // each bubble still say what that answer was grounded in.
  const currentCtxVersion = ctxInfo?.version ?? null;
  const staleVersions =
    currentCtxVersion === null
      ? []
      : [
          ...new Set(
            msgs
              .filter((m) => !m.error && m.role === "assistant" && m.provenance)
              .map((m) => chatStampVersion(m.provenance))
              .filter(
                (v): v is number => v !== null && v !== currentCtxVersion,
              ),
          ),
        ].sort((a, b) => a - b);
  const staleNote =
    currentCtxVersion === null || staleVersions.length === 0
      ? null
      : `Some answers in this thread are grounded in an earlier build state (context v${staleVersions.join(", v")}) — the current context is v${currentCtxVersion}. Ask a fresh question for guidance that reflects the build now.`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-3">
        <p className="font-mono text-xs text-muted">
          Chat · {backendLabel}
          <span className="text-faint"> · advice-only — never changes the build</span>
          <span className="text-faint"> · no stop/stream yet (one-shot replies)</span>
          {noBackend ? (
            <span className="text-faint"> · context meter idle (no LLM backend)</span>
          ) : ctxInfo ? (
            <span className="text-faint">
              {" "}
              · {Math.round(ctxInfo.chars)}/{ctxInfo.max} chars · context v{ctxInfo.version}
            </span>
          ) : (
            <span className="text-faint"> · context meter unavailable</span>
          )}
        </p>
        {noBackend ? (
          <p role="status" className="font-mono text-[11px] text-warn">
            No LLM backend — chat is read-only: DEEPSEEK_API_KEY is not set in the
            server .env, so sending is disabled (a send could only fail with
            RT_E_LLM_NOT_CONFIGURED). Set the key and reload to chat against this build.
          </p>
        ) : null}
      </div>
      {restoredRows > 0 ? (
        <p className="px-5 pt-1 font-mono text-[11px] text-faint">
          Thread restored from this build's log · {restoredRows} row
          {restoredRows === 1 ? "" : "s"}
        </p>
      ) : null}
      {staleNote ? (
        <p role="status" className="px-5 pt-1 font-mono text-[11px] text-warn">
          {staleNote}
        </p>
      ) : null}

      <div
        ref={scrollRef}
        role="region"
        aria-label="Chat history"
        className="chat-scroll max-h-[480px] space-y-3 overflow-auto px-5 py-4"
      >
        {msgs.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-6 text-center">
            <p className="font-mono text-xs text-muted">
              Grounded copilot — advice only: it answers from this build's live
              state and never changes the build.
            </p>
            <p className="mt-2 font-mono text-[11px] text-faint">
              To act (run · approve · reject), use the console controls or the
              rapidtool CLI. Try: explain current gate · next legal action ·
              summarize packet
            </p>
          </div>
        ) : (
          msgs.slice(-12).map((m) => {
            // 156 E2: a failed send's "Retry" restores the FAILED PROMPT — the
            // preceding user row — never the error row's own failure text.
            // When that prompt is no longer in the visible window the
            // affordance is hidden (copying an error message into the draft
            // would be a dishonest retry). failedSendPrompt is the pure rule.
            const retryText = m.error ? failedSendPrompt(msgs, m) : null;
            let onRetry: (() => void) | undefined;
            if (retryText !== null) {
              const failedPrompt = retryText;
              onRetry = () => setDraft(failedPrompt);
            }
            return <ChatMsgRow key={m.id} msg={m} onRetry={onRetry} />;
          })
        )}
        {busy ? (
          <div className="chat-row chat-row-assistant">
            <div className="chat-bubble chat-thinking">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted">
                <span
                  aria-hidden="true"
                  className="chat-thinking-dot h-2 w-2 inline-block rounded-full bg-current"
                />
                thinking… {elapsedSec}s
              </span>
              <span className="mt-1 block font-mono text-[11px] text-faint">
                one-shot reply — flash answers usually land &lt;20s; timeouts
                surface as RT_E_LLM_TIMEOUT (no stream/stop yet)
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-5 pt-3">
        <div className="chat-quick flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => void send(c.prompt())}
              disabled={busy || noBackend}
              title={noBackend ? "No LLM backend — sending is disabled" : c.label}
              className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-muted hover:text-fg disabled:cursor-default disabled:opacity-40"
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="chat-composer-row -mx-5 mt-3 flex gap-2 px-5 pt-3 pb-5">
          <input
            aria-label="Ask about this build"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={busy || noBackend}
            placeholder={
              noBackend
                ? "Chat is read-only — no LLM backend configured"
                : "Ask about this build… (Enter to send)"
            }
            className="chat-input h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3.5 text-sm outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-40"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || noBackend || !draft.trim()}
            title={noBackend ? "Set DEEPSEEK_API_KEY in the server .env to enable chat" : undefined}
            className="chat-send inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border px-4 text-xs disabled:cursor-default disabled:opacity-40"
          >
            Ask
            <span aria-hidden="true" className="rt-send-arrow" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * E-13's deepen seam may land in the store after this UI ships: feature-detect
 * the action by name at runtime, so the drill-down's "Run live research"
 * affordance appears exactly when the engine supports it (additive wiring —
 * absent action ⇒ honest note, never a dead button).
 */
type DeepenAction = (
  projectId: string,
  phase: number,
) => Promise<{ ok?: boolean; error?: string }> | { ok?: boolean; error?: string };

const DEEPEN_ACTION_NAMES = ["deepenResearchAsync", "deepenResearch", "deepenAsync", "runDeepen"] as const;

function findDeepenAction(): DeepenAction | null {
  const s = useRapid.getState() as unknown as Record<string, unknown>;
  for (const name of DEEPEN_ACTION_NAMES) {
    const fn = s[name];
    if (typeof fn === "function") return fn as unknown as DeepenAction;
  }
  return null;
}

/**
 * E-21: "Run live research" affordance shown when a recorded gate FAILED with
 * p7-research unmet (deterministic P7 runs record that honestly). Calls E-13's
 * deepen store action when present; the record view live-updates when the
 * deepened gate is re-recorded.
 */
function DeepenResearchButton({ project, phase }: { project: Project; phase: PhaseId }) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const action = useMemo(findDeepenAction, []);
  if (!action) {
    return (
      <p className="text-faint">
        p7-research unmet — this phase completed without live research; the deepen seam is not
        available in this build, so re-run research from the CLI instead.
      </p>
    );
  }
  async function runDeepen() {
    if (!action) return;
    setBusy(true);
    setOutcome(null);
    try {
      const res = await action(project.id, phase);
      if (res && res.ok === false) setOutcome(res.error ?? "deepen failed");
      else setOutcome("live research running — the gate re-records when it completes");
    } catch (err) {
      setOutcome(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => void runDeepen()}
        disabled={busy}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-fg hover:border-accent/40 disabled:opacity-40"
      >
        <RotateCcw className="h-3 w-3" />
        {busy ? "Running live research…" : "Run live research (P7)"}
      </button>
      {outcome ? <p className="mt-1 text-faint">{outcome}</p> : null}
    </div>
  );
}

/**
 * E-21: honest gate verdict drill-down (wired into the phase-record view's gate
 * row). The compact summary line shows only PASS/FAIL + an 8-char hash;
 * expanding lists every recorded unmet criterion by id with its DoD-registry
 * wording and stamps the advisory nature ("recorded, not blocking") — a
 * completed phase with a recorded FAIL now shows WHY, instead of an
 * unexplained hash. FAIL rows are expanded by default (details open).
 */
function GateVerdictDetail({
  project,
  phase,
  gate,
}: {
  project: Project;
  phase: PhaseId;
  gate: NonNullable<PhaseRecord["gate"]>;
}) {
  const unmet = gate.unmet ?? [];
  const registry = DOD[phase] ?? [];
  const criterionById = new Map(registry.map((g) => [g.id, g.criterion]));
  return (
    <div
      role="group"
      aria-label="Recorded gate verdict"
      className="mt-2 space-y-1.5 rounded-md border border-border bg-bg px-3 py-2 font-mono text-[11px] leading-relaxed"
    >
      {gate.passed && unmet.length === 0 ? (
        <p className="text-ok">all recorded criteria met at completion</p>
      ) : unmet.length > 0 ? (
        <>
          <ul className="list-none space-y-1">
            {unmet.map((id) => {
              const criterion = criterionById.get(id);
              return (
                <li key={id} className="text-danger">
                  ✗ {id}
                  {criterion ? <span className="text-muted"> — {criterion}</span> : null}
                </li>
              );
            })}
          </ul>
          {gate.passed ? null : (
            <p className="text-warn">
              gate FAIL recorded at completion — DoD gates are advisory, so the phase still moved
              on
            </p>
          )}
        </>
      ) : (
        <p className="text-danger">gate FAIL recorded — no unmet criteria stored</p>
      )}
      <p className="text-faint">advisory — recorded, not blocking</p>
      {unmet.includes("p7-research") ? <DeepenResearchButton project={project} phase={phase} /> : null}
      <p className="text-faint">
        checked {gate.checkedAt ? agoLabel(gate.checkedAt) : "n/a"} · evidence {gate.evidenceHash}
      </p>
    </div>
  );
}

/** Read-only record browser for a past phase (E-101): banner, summary, artifacts, scorecard, gate trail. */
function PhaseRecordView({
  project,
  phase,
  selected,
  onSelect,
  onBack,
}: {
  project: Project;
  phase: PhaseId;
  selected: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const def = PHASES[phase];
  const rec = project.phases[phase];
  const meta = PHASE_STATUS_META[rec.status];
  const arts = project.artifacts.filter((a) => a.phase === phase);
  const active = !arts.length
    ? null
    : (selected ? arts.find((a) => a.id === selected) : undefined) ?? arts[arts.length - 1];
  const gateDecisions = project.decisions.filter((d) => d.phase === phase);
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
          Viewing {def.code} · read-only
          <StatusBadge project={project} phase={phase} />
        </p>
        <button
          type="button"
          onClick={onBack}
          className="min-h-9 rounded-md border border-border px-3 text-xs text-fg hover:border-accent/40"
        >
          Back to live
        </button>
      </div>
      <div className="border-b border-line px-5 py-5">
        <p className={`font-mono text-xs ${meta.tone}`}>
          {def.code}
          {def.hitl ? " · HITL" : ""}
        </p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">{def.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{def.summary}</p>
        {rec.rejectionNote ? (
          <p className="mt-3 font-mono text-xs text-faint">
            rejected: {clip60(rec.rejectionNote)}
          </p>
        ) : null}
        {rec.gate ? (
          <details
            key={phase}
            open={!rec.gate.passed}
            className="mt-3 rounded-md border border-border bg-raised px-3 py-2"
          >
            <summary className="cursor-pointer font-mono text-[11px] leading-relaxed select-none">
              DoD{" "}
              {rec.gate.passed ? (
                <span className="text-ok">PASS</span>
              ) : (
                <span className="text-danger">FAIL</span>
              )}
              <span className="text-faint"> · {rec.gate.evidenceHash.slice(0, 8)}</span>
              {rec.gate.unmet.length ? (
                <span className="text-faint"> · {rec.gate.unmet.length} unmet</span>
              ) : null}
            </summary>
            <GateVerdictDetail project={project} phase={phase} gate={rec.gate} />
          </details>
        ) : null}
      </div>
      <div className="border-b border-line px-5 pt-4">
        <p className="font-mono text-xs text-muted">Artifacts · {def.code}</p>
      </div>
      <ArtifactPane
        artifacts={arts}
        active={active}
        onSelect={onSelect}
        empty="No artifacts were recorded for this phase."
      />
      {phase === 0 && project.scorecard ? <ScorecardBlock project={project} /> : null}
      {gateDecisions.length > 0 ? (
        <div className="border-b border-line px-5 py-4">
          <p className="font-mono text-xs text-muted">Gate decisions · {def.code}</p>
          <ul className="mt-3 space-y-2">
            {gateDecisions.map((d) => (
              <li key={d.id} className="font-mono text-[11px] leading-relaxed">
                <span className={d.decision === "approve" ? "text-ok" : "text-danger"}>
                  {d.decision}
                </span>
                <span className="text-faint">
                  {" "}
                  · {d.decidedBy} · {agoLabel(d.decidedAt)}
                </span>
                {d.note ? (
                  <span className="block pl-3 text-faint">{clip60(d.note)}</span>
                ) : null}
              </li>
            ))}
            {(rec.rejectionHistory ?? []).map((r, i) => (
              <li key={`${r.at}-${i}`} className="font-mono text-[11px] leading-relaxed text-faint">
                rejection · {agoLabel(r.at)}
                <span className="block pl-3">{clip60(r.note)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function StatusChip({
  label,
  tone,
  title,
}: {
  label: string;
  tone: "ok" | "faint";
  title?: string;
}) {
  return (
    <span
      className={`rounded-sm border border-border px-2 py-1 ${tone === "ok" ? "text-ok" : "text-faint"}`}
      title={title}
    >
      {label}
    </span>
  );
}

/** fixes/144 M1-L3 (D9): per-project DoD enforcement toggle wiring the store's
 *  setEnforceDod. Reads the CURRENT value off project.enforceDod — the engine
 *  defaults it ON for keyed runs (engine.ts:1498-1499) and the CLI --advisory
 *  sends false; keyless runs stay advisory because the deterministic floor
 *  cannot pass p6-brief-fit by construction (dod.ts:192-208). Honest label +
 *  per-state caption so the toggle never reads as "enforcement for free". */
function EnforceDodToggle({
  project,
  llmConfigured,
}: {
  project: Project;
  llmConfigured: boolean;
}) {
  const on = project.enforceDod === true;
  return (
    <div className="rounded-md border border-border bg-raised px-3 py-3">
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => useRapid.getState().setEnforceDod(project.id, e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <span className="font-medium">Enforce DoD gates</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            On by default when a DeepSeek key is configured. When on, a machine advance may not
            leave a phase whose DoD gate failed — the run parks instead.
          </span>
        </span>
      </label>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-faint">
        {on
          ? "Enforced — a failing gate parks the run (wild mode: a “Hard DoD block”)."
          : llmConfigured
            ? "Advisory — gates record exit criteria; they do not block a run."
            : "Advisory — no LLM backend configured; gates record and never block."}
      </p>
    </div>
  );
}

/** fixes/144 M1-L3 (D7/D9): "Export software" — the honest emit-path
 *  affordance. Emit is a CLI/server-seam action (scaffold.ts writes folders via
 *  node:fs); this page is client-side over localStorage and must NOT pretend to
 *  spawn the CLI. Surface = the exact command + the default output folder. The
 *  folder convention (<home>/RapidTool Software/<slug>/) duplicates the CLI's
 *  emit default on purpose — a browser cannot read os.homedir(); keep in sync
 *  with scripts/rapidtool-cli.mjs defaultOutputDir (fixes/144 M1 microstep 1). */
function softwareOutDirHint(project: Project): string {
  return `~/RapidTool Software/${slugName(project.name)}/`;
}

function ExportSoftwareBlock({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const slug = slugName(project.name);
  const dir = softwareOutDirHint(project);
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-accent/40 px-4 text-sm text-accent hover:border-accent/70 hover:bg-accent/5"
      >
        <Download className="h-4 w-4" />
        Export software
      </button>
      {open ? (
        <div className="mt-3 w-full rounded-md border border-border bg-raised px-4 py-3">
          <p className="text-sm leading-relaxed text-fg">
            Software export runs in the CLI — the emit seam writes folders server-side, and this
            build lives in this browser, so there is no one-click folder export from this page.
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
            <li>
              Save this project&apos;s JSON with the <span className="font-mono text-fg/80">Export</span>{" "}
              button above (e.g. <code className="rounded-sm bg-raised px-1 font-mono text-xs">{slug}.json</code>).
            </li>
            <li>
              From the RapidTool folder, emit the scaffold:
              <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-bg px-3 py-2 font-mono text-[11px] leading-relaxed text-fg/90">
                {`node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project "${slug}.json" --check`}
              </pre>
            </li>
            <li>
              The scaffold lands in the default output folder{" "}
              <code className="rounded-sm bg-raised px-1 font-mono text-xs">{dir}</code> —{" "}
              <span className="font-mono text-[11px]">~</span> is your home folder (here:{" "}
              <code className="rounded-sm bg-raised px-1 font-mono text-xs">C:\Users\&lt;you&gt;</code>);
              pass <code className="rounded-sm bg-raised px-1 font-mono text-xs">--out &lt;dir&gt;</code> to
              override. Then <code className="rounded-sm bg-raised px-1 font-mono text-xs">npm install &amp;&amp; npm test</code>{" "}
              inside the emitted folder runs its real oracle tests.
            </li>
          </ol>
        </div>
      ) : null}
    </div>
  );
}

/** Rubber-stamp whisper surfaced in the rail (DM-2 / LLM-GAP-6). */
function GateHealthCard({ project }: { project: Project }) {
  const h = approvalHealth(project.decisions);
  if (h.n === 0) return null;
  const tone =
    h.flag === "rubber" ? "text-danger" : h.flag === "fast" ? "text-warn" : "text-muted";
  const label =
    h.flag === "rubber" ? "rubber-stamp risk" : h.flag === "fast" ? "fast approvals" : "healthy";
  return (
    <div className="mt-8">
      <h3 className="text-xs font-medium tracking-wide text-muted uppercase">Approval health</h3>
      <p className={`mt-2 font-mono text-[11px] leading-relaxed ${tone}`}>
        {label} · {h.n} decisions · {Math.round(h.meanLatencyMs / 1000)}s mean ·{" "}
        {Math.round(h.rejectRate * 100)}% rejects
      </p>
    </div>
  );
}

/** Minimal modal shell (overlay + title + Escape/click-outside close). */
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Lock body scroll while the modal is open (one scroll context at a time —
    // nested regions inside the dialog keep their own thin scrollbars).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-bg/80" onClick={onClose} />
      <div className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-medium tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-sm text-muted hover:text-fg"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/** Settings surface: explains where keys live (server-side .env, never the browser). */
function SettingsDialog({
  open,
  onClose,
  llmLabel,
  llmConfigured,
  researchLabel,
  researchConfigured,
}: {
  open: boolean;
  onClose: () => void;
  llmLabel: string;
  llmConfigured: boolean;
  researchLabel: string;
  researchConfigured: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <p className="text-sm leading-relaxed text-muted">
        RapidTool keys live server-side in{" "}
        <code className="rounded-sm bg-raised px-1 font-mono text-xs text-fg">.env</code> — never in the
        browser. There is intentionally no client-side key field: a key entered here would be readable by
        any visitor of a deployed build.
      </p>
      <dl className="mt-4 space-y-2 font-mono text-xs">
        <div className="flex items-center justify-between rounded-md border border-border bg-raised px-3 py-2">
          <dt className="text-muted">LLM backend</dt>
          <dd className={llmConfigured ? "text-ok" : "text-faint"}>{llmLabel}</dd>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border bg-raised px-3 py-2">
          <dt className="text-muted">Research backend</dt>
          <dd className={researchConfigured ? "text-ok" : "text-faint"}>{researchLabel}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-faint">
        With no backend configured the app runs in honest deterministic mode: research and scaffold rows
        are labeled <span className="font-mono">illustrative</span> — scaffolding, not facts.
      </p>
    </Modal>
  );
}

/** Condensed AGENT_GUIDE.md content. */
function GuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Agent guide">
      <div className="space-y-4">
        {GUIDE_SECTIONS.map((s) => (
          <div key={s.title}>
            <h3 className="text-sm font-medium">{s.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
          </div>
        ))}
        <p className="pt-2 text-xs text-faint">Full guide: AGENT_GUIDE.md in the project root.</p>
      </div>
    </Modal>
  );
}

/** Keyboard-shortcut reference (single-key + existing Ctrl chords). */
function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts">
      <ul className="space-y-1">
        {SHORTCUTS.map((s) => (
          <li
            key={s.keys.join("+")}
            className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0"
          >
            <span className="text-sm text-muted">{s.label}</span>
            <span className="flex items-center gap-1">
              {s.keys.map((k, i) => (
                <span key={k} className="flex items-center gap-1">
                  {i > 0 ? <span className="text-faint">+</span> : null}
                  <Kbd>{k}</Kbd>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-faint">
        Shortcuts are ignored while you're typing in an input or textarea.
      </p>
    </Modal>
  );
}
