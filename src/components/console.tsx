import { Component, Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tabs from "@radix-ui/react-tabs";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FastForward,
  Keyboard,
  Loader2,
  Lock,
  Moon,
  PanelRight,
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
import { PHASES, PHASE_BY_ID, phaseDef } from "@/lib/phases";
import { runCrew } from "@/lib/crew";
import {
  codedFailureText,
  keyedRefusalSince,
  KEY_UNUSABLE_CODES,
  persistStorageHealth,
  staleEmitStep,
  useRapid,
} from "@/lib/store";
import { BRIEF_TEMPLATES } from "@/lib/templates";
import { estimateTokens } from "@/lib/algorithms";
import { DOD } from "@/lib/dod";
import { approvalHealth } from "@/lib/gate-stats";
// F4 (fixes/252 LANE 2 · 221 §F4): the per-ACTION allow-list reader. policy.ts
// is a no-import pure leaf, so the console can surface a coded refusal without
// dragging any server code into the client bundle.
import { policyOverlayRefusal } from "@/lib/policy";
import { downloadFilename, exportPacketText, exportProjectJson, slugName } from "@/lib/io";
import { phaseHandoff } from "@/lib/handoff";
import type { Artifact, ChatLogRow, JsonLog, PhaseId, PhaseRecord, PhaseStatus, Project, ProjectStatus } from "@/lib/types";
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
import { fixturesReview } from "@/lib/fixtures.review";
// W24 U1: the row shape the review surface renders (pure/client-safe data
// module — types only, so no IO enters the client bundle).
import type { FixtureReviewRow } from "@/lib/fixtures";
import { ERROR_CODE_DOC } from "@/lib/errors";
import { buildClientDiagnosis, markBoundaryError, reportRt, rtSnapshot, setBusyProbe } from "@/lib/rt-client";
import { WILD_STEP_BUDGET_MS } from "@/lib/rt-events";
// 216m · 111 TASK-10 / TASK-11 (W4 · L4): the cmdk command palette and the
// typed timeline sibling pane. Explicit extensions, per the in-repo convention
// for cross-component imports (routes import "@/components/console.tsx").
import { CmdPalette, type CmdPaletteEntry } from "@/components/cmd-palette.tsx";
import { RuntimeTimelinePane } from "@/components/runtime-timeline-pane.tsx";
// W309 A6 (M4-01 · BUG-308-08): the pipeline-visibility rail built by W307 U2
// (fixes/307_u2_pipeline.md) — 0 importers since 800a40d until this mount.
// Additive sibling of PhaseProgressRail; nothing above is replaced.
import { PipelineRail } from "@/components/pipeline-rail.tsx";

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

/**
 * Plain-language labels for a PROJECT's status (this is the home list, not a
 * phase rail). Deliberately separate from `PHASE_STATUS_META`: a project can be
 * `intake` or `blocked`, which are NOT phase statuses, so indexing the phase
 * map with `project.status` had no key for them. It is also the honest fix for
 * the old `p.status.replace("_", " ")` form, which left the second underscore
 * in `awaiting_hitl` (110 §4 CP-7). Total by type ⇒ a project status can never
 * index a missing key.
 */
const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  intake: "not started",
  running: "running",
  awaiting_hitl: "waiting for you",
  complete: "complete",
  blocked: "blocked",
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

type RunTab = "artifacts" | "packet" | "spec" | "crew" | "oracle" | "design" | "diagram" | "chat" | "vault" | "runtime" | "fixtures";

/**
 * Run-console destinations — ONE source for the tab strip, its aria-label and
 * the progressive-disclosure tiers.
 *
 * 111 TASK-03: the strip's `aria-label` used to be a hand-written run-on
 * sentence that named `design`/`diagram` and `vault` in an order the DOM did
 * not use, so a screen reader announced a sequence the user would never Tab
 * through. Both labels below are now *derived from this array*, so they cannot
 * diverge from DOM order again.
 *
 * 111 TASK-05: ten peer tabs at equal visual weight is the owner's "LOTS OF
 * INFO" complaint. NN/g progressive disclosure (111 §2 #1) says rank and
 * defer, never delete — so all ten `RunTab` values stay reachable and every
 * `Tabs.Content value=` block below is byte-unchanged. `tier: "primary"`
 * renders on the strip; `"advanced"` is revealed by the "More panels" toggle.
 * `purpose` is the one-line plain-language information-scent text from
 * 111 §2 #9 — shown as adjacent content (not a tooltip), which is exactly the
 * shape the in-file `DIAGRAM_KINDS` `{label, hint}` pattern already uses.
 */
const RUN_TABS: { id: RunTab; label: string; purpose: string; tier: "primary" | "advanced" }[] = [
  { id: "artifacts", label: "Artifacts", purpose: "Every file this build produced", tier: "primary" },
  { id: "packet", label: "Agent packet", purpose: "The prompt to paste into a coding agent", tier: "primary" },
  { id: "chat", label: "Chat", purpose: "Ask questions about this build", tier: "primary" },
  { id: "spec", label: "Spec graph", purpose: "Which role owns which file, in order", tier: "advanced" },
  { id: "crew", label: "Crew", purpose: "Advisory agent roles for this phase", tier: "advanced" },
  { id: "oracle", label: "Oracle", purpose: "Acceptance cases the build must meet", tier: "advanced" },
  { id: "vault", label: "Vault", purpose: "Notes built from this run, searchable", tier: "advanced" },
  { id: "design", label: "Design", purpose: "Colors, type and spacing from Phase 6", tier: "advanced" },
  { id: "diagram", label: "Diagram", purpose: "A picture of how the build fits together", tier: "advanced" },
  { id: "runtime", label: "Runtime log", purpose: "Operator log and diagnostics", tier: "advanced" },
  // T5.2-A polish (W24 U1): "Fixtures" collided with the OTHER fixtures concept
  // the console now surfaces — a project's own `acceptanceFixtures` (brief-
  // fixtures.ts) in the PendingFixturesBanner. The corpus rows this tab shows
  // are the eval corpus (`research/eval-corpus`), so the label says so.
  { id: "fixtures", label: "Eval fixtures", purpose: "Corpus fixtures + their run-side bars (read-only)", tier: "advanced" },
];

/** aria-label for one rendered tablist slice — derived from the same array the
 *  triggers render from (111 TASK-03), so announced order == DOM order always. */
function tabListLabel(tier: "primary" | "advanced"): string {
  const names = RUN_TABS.filter((t) => t.tier === tier)
    .map((t) => t.label.toLowerCase())
    .join(", ");
  return tier === "primary" ? `Run console panels: ${names}` : `More panels, revealed on demand: ${names}`;
}

/** Shared trigger styling — the class string is byte-identical to the ten
 *  inline copies it replaces, so the hover/active treatment is unchanged. */
const TAB_TRIGGER_CLASS =
  "rt-tab flex shrink-0 flex-col items-start px-3 pt-1.5 pb-2 text-sm text-muted outline-none hover:text-fg data-[state=active]:border-b data-[state=active]:border-fg data-[state=active]:text-fg";

/**
 * DF-26 (W16 lane 3): the assembled packet's own truncation accounting,
 * mirrored byte-for-byte from `packet.ts:16` (`PACKET_MAX_CHARS = 14_000`) and
 * `packet.ts:17` (`TRUNC_MARKER`). The console DETECTS truncation by reading
 * this marker out of the packet text itself — it never recomputes the cut from
 * the cap (that logic lives in `packet.ts:538-569` and would silently drift if
 * the cap changed). Mirroring the literal follows the in-repo precedent of
 * `packet.test.ts:20`; exporting the constants from packet.ts instead is the
 * cleaner seam but sits outside this lane's file box (registered in
 * `fixes/244` §Deviations).
 */
const PACKET_MAX_CHARS_MIRROR = 14_000;
const PACKET_TRUNC_MARKER = "…[TRUNCATED — regenerate at a HITL gate for the full plan]";

/** DF-26: true when the packet text carries the packet.ts:17 truncation marker. */
function packetTruncated(packet: string | undefined): boolean {
  return typeof packet === "string" && packet.includes(PACKET_TRUNC_MARKER);
}

/**
 * One tab trigger: the noun label plus its plain-language purpose line
 * (111 TASK-05). Radix `Tabs` requires triggers and contents to stay under the
 * same `Tabs.Root` — both lists render inside this Root, which is why the
 * tiering is a wrapper and not a separate component tree.
 */
function RunTabTrigger({ tab }: { tab: (typeof RUN_TABS)[number] }) {
  return (
    <Tabs.Trigger value={tab.id} title={tab.purpose} className={TAB_TRIGGER_CLASS}>
      <span className="leading-tight whitespace-nowrap">{tab.label}</span>
      <span className="mt-0.5 block max-w-[10.5rem] text-xs leading-tight whitespace-normal text-faint">
        {tab.purpose}
      </span>
    </Tabs.Trigger>
  );
}

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
 *
 * Same in-file rule, R6-f02 (W-11): never "autonomous software agency/factory"
 * while `doctor` prints autonomousSoftwareFactory:false — that claim lived on
 * four surfaces (Home tagline, both route meta tags, og/site.json) until W29.
 * The honest descriptor is "governed delivery harness".
 */
function lastTestCaption(lt: { ok: boolean; detail: string } | null): string | null {
  if (!lt) return null;
  const raw = (lt as LastTestWithLabel).label;
  const who = raw ? (LAST_TEST_LABEL_TEXT[raw] ?? `test (${raw})`) : "last test";
  return `${who} ${lt.ok ? "pass" : "fail"} · ${lt.detail}`;
}

/**
 * 111 TASK-02 — the rendering half of 111's "three small changes with the
 * largest effect". Shape mirrors the proposed `nextAction` envelope from
 * 111 §3.4 (`kind · cmd · phase · why`) so this UI-side derivation can be
 * repointed at the real `summary()` field once TASK-01 lands in
 * `src/lib/headless.ts` (that file belongs to another lane in this wave — the
 * envelope half is reported in fixes/216h_ui_wave.md, not enacted here).
 */
type UiNextAction = {
  kind: "run" | "approve" | "retry" | "done" | "running" | "fix-gate" | "unknown";
  /** The CLI verb that performs this action. The UI shows this exact word
   *  next to the button, so the human and the agent never hold two
   *  vocabularies (111 §2 #2, recognition over recall). */
  cmd: string;
  phase: PhaseId;
  why: string;
};

/** OpenHands' shipped JSON-echo guard (`get-action-event-title.ts`, copied from
 *  111 §3.2): a "human sentence" that is actually serialized JSON
 *  (`field: {…}` / `field: […]`) is refused rather than rendered to a human. */
const JSON_ECHO_RE = /^[a-z][a-z0-9_]*\s*:\s*[[{]/i;

/** Documented generic sentence — used only when a `why` is refused by the
 *  guard above or the state is unknown. Never a fabricated specific claim. */
const GENERIC_NEXT_WHY = "Nothing is waiting on you — run the next phase to move the build forward.";

/**
 * HITL override predicate, single-sourced for the dock and the status panel
 * (A02: a failed P6 sandbox is human-only — the operator must tick the
 * override before Approve can pass; mirrors store.ts's guard).
 */
function hitlNeedsOverride(project: Project): boolean {
  return (
    Boolean(project.hitl?.forceHuman) &&
    project.currentPhase === 6 &&
    project.lastTest !== null &&
    !project.lastTest.ok
  );
}

/**
 * F4 (fixes/252 LANE 2 · 221 §F4): the build's per-action allow-lists, read
 * defensively. The field is additive on the project payload and absent on every
 * build that predates it — `undefined` means "no narrowing declared", never a
 * guessed default: the console must not invent authority the build never gave.
 */
function policyAllowListsOf(project: Project): unknown {
  return (project as { wildPolicy?: unknown }).wildPolicy;
}

/**
 * UI-03 (110 §3/§5): the ONE predicate for "the Execute / Run-to-gate action is
 * live right now". Read by both the action-bar buttons (their `disabled`) and
 * the Ctrl+Enter / `e` / `g` shortcut branches, so a keystroke can never start
 * an action whose button is disabled or absent: a phase already running
 * elsewhere (wild mode, or a reload with stored status "running"), a parked
 * HITL gate, a blocked phase, or a sealed build. Pure over the store snapshot;
 * `busy` folds in the caller's own in-flight latch (busyRef / busyAction).
 */
function canExecute(project: Project, busy: boolean): boolean {
  return (
    !busy &&
    !project.hitl &&
    project.status !== "blocked" &&
    project.status !== "complete" &&
    project.phases[project.currentPhase]?.status !== "running"
  );
}

/**
 * 111 TASK-02: derive the ONE next action from state the console already
 * holds. Pure — reads `project` only, writes nothing, invents nothing: every
 * branch names a real CLI verb (gate / approve / retry / emit / status) and
 * states only facts the engine recorded. Ordered so the most urgent fact wins
 * (an in-flight phase outranks a stale gate verdict; a parked gate outranks a
 * runnable phase), and the `unknown` arm is mandatory so it can never
 * fabricate a specific claim.
 */
function uiNextAction(project: Project, running: boolean): UiNextAction {
  const current = PHASES[project.currentPhase];
  if (!project.phases.length) {
    return { kind: "unknown", cmd: "status", phase: project.currentPhase, why: GENERIC_NEXT_WHY };
  }
  if (running) {
    return {
      kind: "running",
      cmd: "gate",
      phase: project.currentPhase,
      why: `${current.code} is running — wait for it to finish or stop.`,
    };
  }
  if (project.hitl) {
    return {
      kind: "approve",
      cmd: "approve",
      phase: project.currentPhase,
      why: `Phase ${current.code} is finished — it's waiting for your approval.`,
    };
  }
  if (project.status === "blocked") {
    return {
      kind: "retry",
      cmd: "retry",
      phase: project.currentPhase,
      why: `${current.code} stopped — read the rejection notes below, then retry the phase.`,
    };
  }
  if (project.status === "complete") {
    return {
      kind: "done",
      cmd: "emit",
      phase: project.currentPhase,
      why: `All ${PHASES.length} phases are sealed — the build is complete.`,
    };
  }
  const failedGate = project.phases.find((r) => r.gate && r.gate.passed === false);
  if (failedGate) {
    return {
      kind: "fix-gate",
      cmd: "gate",
      phase: failedGate.id,
      why: `A gate check on ${PHASES[failedGate.id].code} failed — review the gate record before continuing.`,
    };
  }
  if (project.phases[project.currentPhase].status === "rejected") {
    return {
      kind: "run",
      cmd: "gate",
      phase: project.currentPhase,
      why: `${current.code} was rejected — run it again after reviewing the notes.`,
    };
  }
  return {
    kind: "run",
    cmd: "gate",
    phase: project.currentPhase,
    why: `Ready when you are — run ${current.code} (${current.title}).`,
  };
}

/** True when a "human" sentence is actually serialized JSON — the OpenHands
 *  fallback guard (111 §3.2); refused sentences fall back to GENERIC_NEXT_WHY. */
function isJsonEchoSentence(s: string): boolean {
  return JSON_ECHO_RE.test(s.trim());
}

/** Button label per next-action kind. `null` = the panel deliberately renders no
 *  button for that state (the surrounding screen already owns that control, or
 *  nothing is actionable yet) — never a duplicate primary affordance. */
const NEXT_ACTION_BUTTON: Record<UiNextAction["kind"], string | null> = {
  run: "Run to next gate",
  approve: "Approve",
  "fix-gate": "Run to next gate",
  retry: null, // the "Retry phase with notes" button below the header owns this
  done: null, // the export controls own this step
  running: null,
  unknown: null,
};

/**
 * 111 TASK-02 / B1 — the always-visible "what's happening / what now" block,
 * rendered top-left in the run view above the tab strip (the F-pattern's first
 * sweep — 111 §2 #10). Three facts from state that already exists: where you
 * are, what just happened, and the ONE next action as a plain sentence plus one
 * button. Every button reuses an existing handler passed in by RunScreen — no
 * second code path to run/approve (111 TASK-02's stated risk). The JSON-echo
 * guard (OpenHands `isServerFallbackSummary`) refuses a `why` that is really
 * serialized JSON and falls back to the documented generic sentence.
 */
/** Plain-language reading of `fixtures.ts`'s `reviewState` vocabulary. The
 *  machine token stays visible in the title attribute, so the human reads a
 *  sentence while nothing is hidden or renamed (111 §2 #2, recognition over
 *  recall). Total by type ⇒ a row can never index a missing key. */
const FIXTURE_REVIEW_STATE_TEXT: Record<FixtureReviewRow["reviewState"], string> = {
  "awaiting-decision": "awaiting a human decision",
  "bar-missing": "no run-side bar for this slug",
};

/** T5.2-A — fixtures review surface (corpus read-only seat). Corpus fixtures
 *  next to their run-side grader bars, with the loader's honesty label carried
 *  verbatim.
 *
 *  DECLARE-OR-STRIKE (W24 U1): this panel renders NO approve/reject control,
 *  and this comment no longer claims one. The decision seat it used to describe
 *  has no write path: `fixtures.server.ts` is read-only by construction, the
 *  store has no fixture action, and `fixtures.ts`'s `FixtureVerdict` /
 *  `FixtureDecisionEntry` have zero consumers in `src/` (grep, W24). An approve
 *  button here would record nothing — so the pane shows the decision STATE and
 *  states its own scope, never a fake seat. Approval today is the CLI's single
 *  flip path (`brief-fixtures.ts approveFixtureCases`, called by `fixtures
 *  --approve`); the store action that would make this a human seat is registered
 *  in `fixes/263_lane5_ui_console.md` §3 for the file's real owner. */
function FixturesPanel() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fixturesReview>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void fixturesReview().then(
      (r) => {
        if (alive) setData(r);
      },
      (e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  if (error) return <p className="px-5 py-4 text-sm text-muted">Fixtures unavailable: {error}</p>;
  if (!data) return <p className="px-5 py-4 text-sm text-muted">Loading fixtures…</p>;
  const awaiting = data.rows.filter((r) => r.reviewState === "awaiting-decision").length;
  const barMissing = data.rows.length - awaiting;
  return (
    <div className="scroll-thin max-h-[65vh] overflow-y-auto px-5 py-4">
      <p className="text-xs text-muted">{data.label}</p>
      {/* The loader's label says approval is a CLI action and this view records
          no decision; this console has no such control, so the scope is stated
          here too, not implied. */}
      <p className="mt-1 text-xs text-faint">
        This console shows the review rows only — no approve/reject control is wired yet, so nothing
        here can record a decision. Approving a fixture is a CLI action
        (<span className="font-mono">fixtures --approve --ids …</span>).
      </p>
      {data.problems.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-xs text-warn">
          {data.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      {data.corpusDir ? (
        <p className="mt-2 font-mono text-xs break-all text-faint">corpus: {data.corpusDir}</p>
      ) : null}
      {data.ok ? (
        <p className="mt-2 text-xs text-muted">
          {data.rows.length} fixture(s) · {awaiting} awaiting a human decision · {barMissing} with no
          run-side bar
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">corpus dir unreadable — see the problems above.</p>
      )}
      {data.ok && data.rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted">
          No corpus fixtures under that directory — nothing to review.
        </p>
      ) : null}
      <ol className="mt-3 space-y-2">
        {data.rows.map((r) => (
          <li key={r.slug} className="rounded-md border border-border bg-raised px-3 py-3">
            <p className="font-mono text-xs text-accent">
              {r.slug} · {r.domain} · {r.kind}
            </p>
            <p className="mt-1 text-sm font-medium">{r.name}</p>
            <p className="mt-1 text-xs text-muted">{r.acceptanceBar}</p>
            <p className="mt-1 text-xs text-muted">
              {r.requiredIdentifiers.length} required identifier(s) ·{" "}
              <span className="font-mono" title={`fixtures.ts reviewState: ${r.reviewState}`}>
                {FIXTURE_REVIEW_STATE_TEXT[r.reviewState]}
              </span>
            </p>
            {r.graderProblem ? (
              <p className="mt-1 text-xs text-muted">bar problem: {r.graderProblem}</p>
            ) : null}
            {/* W24 U1: the loader already ships nouns/capabilities/baseline +
                the fixture body's provenance headings — they were parsed and
                dropped on the floor here. Additive disclosure, no new source. */}
            {r.expectedNouns.length || r.expectedCapabilities.length || r.baseline || r.provenanceHeadings.length ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted">fixture details</summary>
                <div className="mt-1 space-y-0.5 text-xs text-muted">
                  {r.baseline ? (
                    <p>
                      baseline: <span className="font-mono">{r.baseline}</span>
                    </p>
                  ) : null}
                  {r.expectedNouns.length ? <p>expected nouns: {r.expectedNouns.join(", ")}</p> : null}
                  {r.expectedCapabilities.length ? (
                    <p>expected capabilities: {r.expectedCapabilities.join(", ")}</p>
                  ) : null}
                  {r.provenanceHeadings.length ? (
                    <p>provenance headings: {r.provenanceHeadings.join(", ")}</p>
                  ) : null}
                </div>
              </details>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * T5.2-A — the human seat for a project's OWN acceptance fixtures
 * (`project.acceptanceFixtures`, `brief-fixtures.ts`). W24 U1: before this
 * banner the console had ZERO fixture hits (the module doc counted 0), so a
 * project could sit at `approval:"pending"` forever with nothing on screen
 * saying so — and `approvedAcceptanceFixtures` ships only a FULLY approved set
 * (a partial set is left out of emit entirely), which made that silence costly.
 *
 * READ-ONLY BY CONSTRUCTION. The flip must go through `brief-fixtures.ts
 * approveFixtureCases` (:588 — strips a forged `decidedBy`, never mints
 * `"human"`), the single path the CLI's `fixtures --approve` calls; committing
 * it needs a store action, and the store has none, so a button here would
 * either record nothing or (worse) mint a second approval path by writing
 * `approval:"approved"` inline — exactly the T5.2-A trap. So the banner names
 * the pending cases + the one real path instead (registered in
 * `fixes/263_lane5_ui_console.md` §3 for store.ts's owner).
 *
 * Truth is recomputed from `project` on EVERY render, never cached (the row's
 * "watch the banner's truth condition"): any case whose `approval` is not
 * `"approved"` counts as pending — mirroring `chat.server.ts`'s defensive
 * count — and `engine.ts`'s brief-hash rule reverts approvals to pending when
 * the brief changes, so the count can rise on its own.
 */
function PendingFixturesBanner({ project }: { project: Project }) {
  const cases = project.acceptanceFixtures ?? [];
  const pending = cases.filter((c) => c.approval !== "approved");
  if (pending.length === 0) return null;
  const ids = pending.map((c) => c.id);
  const shown = ids.slice(0, 8);
  const slug = slugName(project.name);
  return (
    <section
      className="border-b border-line bg-warn/5 px-5 py-3"
      aria-label="Acceptance fixtures awaiting a human decision"
    >
      <p className="font-mono text-2xs font-medium tracking-widest text-warn uppercase">
        Awaiting your decision · acceptance fixtures
      </p>
      <p className="mt-1.5 text-sm text-fg">
        {pending.length} of {cases.length} acceptance fixture case(s) read{" "}
        <span className="font-mono">pending</span> — not functional until a human approves the whole
        set; a partially approved set is left out of the emitted tree entirely.
      </p>
      <p className="mt-1 text-xs text-muted">
        case id(s):{" "}
        <span className="font-mono">
          {shown.join(", ")}
          {ids.length > shown.length ? ` +${ids.length - shown.length} more` : ""}
        </span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Approving is a CLI action (the single flip path), run on this project&apos;s exported file
        from the RapidTool folder:{" "}
        <code className="rounded-sm bg-raised px-1 font-mono text-xs">
          {`node --experimental-strip-types scripts/rapidtool-cli.mjs fixtures --project "${slug}.json" --approve --ids ${shown.join(",")}`}
        </code>{" "}
        (or <span className="font-mono">--approve-all</span>). This console cannot flip the approval
        itself — no store action exists yet — so re-import the file here after approving.
      </p>
    </section>
  );
}

function RunStatusPanel({
  project,
  action,
  onPrimary,
  primaryBlockedReason,
}: {
  project: Project;
  action: UiNextAction;
  /** Existing handler for the action's button — never a new one. */
  onPrimary: (() => void) | null;
  /** Set when the HITL override checkbox must be ticked first: the panel then
   *  withholds its Approve button instead of minting a bypass path (110 UI-01). */
  primaryBlockedReason?: string;
}) {
  const def = PHASES[project.currentPhase];
  const done = project.phases.filter((r) => r.status === "complete").length;
  const why = isJsonEchoSentence(action.why) ? GENERIC_NEXT_WHY : action.why;
  const buttonLabel = NEXT_ACTION_BUTTON[action.kind];
  const showButton = buttonLabel !== null && onPrimary !== null && !primaryBlockedReason;
  const happened = lastTestCaption(project.lastTest);
  return (
    <section
      className="border-b border-line bg-surface/60 px-5 py-4"
      aria-label="What's happening and what to do next"
    >
      <p className="font-mono text-2xs font-medium tracking-widest text-faint uppercase">
        What&apos;s happening
      </p>
      <p className="mt-1.5 text-sm text-fg">
        You&apos;re at{" "}
        <span className="font-medium">
          {def.code} · {def.title}
        </span>
        <span className="text-muted"> · step {done}/{PHASES.length} sealed</span>
      </p>
      {happened ? <p className="mt-0.5 text-sm text-muted">Last check: {happened}</p> : null}
      <p className="mt-2 max-w-2xl text-base leading-relaxed">{why}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {showButton ? (
          <button
            type="button"
            onClick={onPrimary}
            className="btn-solid inline-flex min-h-11 items-center gap-2 rounded-md bg-fg px-4 text-sm font-medium text-bg"
          >
            {buttonLabel}
          </button>
        ) : null}
        <span className="font-mono text-xs text-faint" title="The CLI verb this action runs">
          verb: {action.cmd}
        </span>
      </div>
      {primaryBlockedReason ? <p className="mt-2 text-xs text-warn">{primaryBlockedReason}</p> : null}
    </section>
  );
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
      className={`rt-badge inline-flex max-w-full items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-2xs font-medium tracking-wider whitespace-nowrap ${BADGE_TONES[tone]} ${className}`}
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
        // 336-5 wiring: the start's REFUSAL arm used to be dropped (`void
        // startWildRun(...)`), so enabling Wild on a build that cannot start
        // (e.g. already complete) left the toggle reading "on" with no
        // explanation. Handle it exactly like the resume path
        // (onPauseToggle) and render it (below) — the result is no longer lost.
        void useRapid
          .getState()
          .startWildRun(project.id)
          .then(
            (res) => {
              if (!res.ok) setErr(res.error.length > 0 ? res.error : "Wild run did not start.");
            },
            (errCaught: unknown) => {
              setErr(errCaught instanceof Error ? errCaught.message : String(errCaught));
            },
          );
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
      </span>
      {/* 336-5: the start/enable refusal is visible, not only announced — the
          result of startWildRun used to be dropped entirely. */}
      {err ? (
        <span role="alert" className="font-mono text-2xs text-danger [overflow-wrap:anywhere]">
          {err}
        </span>
      ) : null}
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
  // R12-f05 (332-5): latch for the edge-triggered stale-run emit (see staleEmitStep).
  const staleReported = useRef(false);

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
          scope: "sys", // K7 payout (W40 solo): was "wild-driver" — scope+event is the coalesce key
          // (rt-events.ts shouldCoalesce), so the old scope could never merge with rt-client's heartbeats.
          event: "sys.heartbeat",
          message: "Wild feed poll alive",
          capture: "src/components/console.tsx:WildFeed watchdog",
        });
        const live = useRapid.getState().projects.find((p) => p.id === projectId);
        const run = live ? wildStateOf(live).run : null;
        const lastAutoAt =
          run && run.active && !wildPaused(run) && typeof run.lastAutoAt === "number"
            ? run.lastAutoAt
            : null;
        const staleNow = lastAutoAt !== null && Date.now() - lastAutoAt > WILD_STEP_BUDGET_MS;
        // R12-f05 (332-5): EDGE-triggered. The tick cadence (~11 s = WILD_POLL_MS
        // × 10) exceeds the §2.5 coalescing window (5 s), so a repeating emit could
        // never merge — measured at the real cadence, three ticks wrote three rows.
        // Report once when the run ENTERS the stale state; a healthy tick resets
        // the latch so the next episode reports again. Do NOT widen the window.
        const staleStep = staleEmitStep(staleReported.current, staleNow);
        staleReported.current = staleStep.next;
        if (staleStep.emit && run && lastAutoAt !== null) {
          reportRt({
            level: "error",
            scope: "wild-step",
            event: "wild.step_timeout",
            // R12-f05: the message stays COALESCER-STABLE — the changing
            // "stale Ns" rides the payload, so the messageHash is stable per
            // phase and a (rare) adjacent episode still cannot double-count.
            message: `Wild run P${run.phase ?? "?"} stale past budget`,
            payload: {
              staleSeconds: Math.round((Date.now() - lastAutoAt) / 1000),
              budgetMs: WILD_STEP_BUDGET_MS,
            },
            capture: "src/components/console.tsx:WildFeed watchdog",
            code: "RT_E_LLM_TIMEOUT",
            phase: run.phase ?? null,
            projectId,
          });
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
            if (!res.ok)
              setNote(
                codedFailureText(
                  res.error && res.error.length > 0 ? res.error : "Could not resume the wild run.",
                  res.code,
                ),
              );
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
          className={`inline-flex items-center gap-1.5 font-mono text-xs font-medium tracking-widest ${
            running ? "text-wild" : wildPaused(wild.run) ? "text-warn" : "text-faint"
          }`}
        >
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          WILD MODE
        </p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-2xs font-medium tracking-wider ${
            running
              ? "border-wild/50 bg-wild/10 text-wild"
              : wildPaused(wild.run)
                ? "border-warn/40 bg-warn/10 text-warn"
                : "border-border text-muted"
          }`}
        >
          {running ? (
            <>
              <span aria-hidden="true" className="wild-live-dot h-1.5 w-1.5 rounded-full bg-current" />
              RUNNING
            </>
          ) : wildPaused(wild.run) ? (
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
          <span className="font-mono text-xs text-faint tabular-nums">
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
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-2xs font-medium disabled:cursor-default disabled:opacity-40 ${
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
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-danger/50 bg-danger/10 px-2.5 text-2xs font-medium text-danger hover:bg-danger/20 disabled:cursor-default disabled:opacity-40"
          >
            <Square className="h-3 w-3" aria-hidden="true" />
            Stop
          </button>
        ) : null}
        {wild.run !== null && wild.run.active !== true && !wildPaused(wild.run) ? (
          <p role="status" className="w-full font-mono text-xs leading-relaxed text-warn">
            Run stopped after reload — the wild driver is a session artifact and cannot resume
            across page loads (a paused-at-reload run is stopped, never left paused; a stopped run
            stays stopped). Start a new run from the current phase to continue.
          </p>
        ) : null}
      </div>

      {note ? (
        <p role="alert" className="mt-2 font-mono text-xs leading-relaxed text-danger">
          {note}
        </p>
      ) : null}

      {feed.length > 0 ? (
        /* 311 §2 (W312 C4): the wild feed updates silently for SR users — it is
           now a polite live region. Each row already carries a real text kind
           (`auto`/`gate`/`log`), so the tone dot is decoration, not the encoding. */
        <ul
          role="log"
          aria-live="polite"
          aria-label="Wild-mode activity rows"
          className="scroll-thin mt-2 max-h-[240px] space-y-1 overflow-y-auto pr-1"
        >
          {feed.slice(0, 30).map((r) => (
            <li
              key={r.id}
              className={`wild-row wild-row--${r.tone} flex items-baseline gap-2 rounded-sm px-1.5 py-1 font-mono text-xs leading-relaxed ${
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
        <p className="mt-2 flex items-center gap-1.5 font-mono text-xs text-faint">
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
    // R6-f06 (L2 step 4, in-app half — fixes/292/294/295): name the ingest
    // seam that ships (the console Ingest report control → store.ingestReport,
    // same seam as the CLI `ingest` verb). The guide's own limitation line
    // ("browser-local only", What-it-is-not below) is kept — ingest is a
    // paste-in seam, not a live channel.
    body: "Paste Copy-phase-handoff into the agent; paste the agent's output back into the phase's Notes so it flows into the next packet compile. A structured JSON agent report can instead be ingested verbatim via this console's Ingest report control (the same seam as the CLI `ingest` verb) — its artifacts land marked “[agent report]”. Export the project JSON to move a build between machines or archive it — it round-trips through Import with validation + repair.",
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
  // W30 (B4-f03): the meta theme-color must follow an IN-SESSION toggle too —
  // before this, only the __root.tsx boot script moved it, so light→dark left
  // the browser chrome tinted until a reload. Hexes match @theme in styles.css.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#edf3f0" : "#0a0c0b");
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
  { keys: ["a"], label: "Approve — when a gate is waiting; a failed bounded-runner gate needs the override tick first" },
  { keys: ["r"], label: "Focus the rejection note" },
  { keys: ["/"], label: "Focus artifact search" },
  { keys: ["?"], label: "Open agent guide" },
  { keys: ["Ctrl", "Enter"], label: "Execute current phase" },
  { keys: ["Ctrl", "Shift", "Enter"], label: "Run to next gate" },
  { keys: ["Ctrl", "Shift", "C"], label: "Copy agent packet" },
  { keys: ["Ctrl", "G"], label: "Toggle agent guide" },
  // 216m · 111 TASK-10: additive row for the command palette (suspends the
  // single-key shortcuts above while it is open).
  { keys: ["Ctrl", "K"], label: "Open the command palette" },
  // T-22: additive second binding for THIS list — `?` (above) stays the Guide
  // opener, so the dialog renders both bindings from this one table.
  { keys: ["Ctrl", "/"], label: "Open this shortcut list" },
];

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-border bg-raised px-1.5 py-0.5 font-mono text-2xs text-fg">
      {children}
    </kbd>
  );
}

/**
 * 111 TASK-07 — glossary-in-place. Every definition here is a re-surfacing of
 * copy that already exists (`GUIDE_SECTIONS[1]`/`[2]`, `scripts/README-cli.md`
 * and the in-file toggle captions); nothing new is authored. The point is to
 * put the definition where the jargon is used (NN/g "pull revelation" beats a
 * glossary page nobody opens). Radix `Tooltip` (already a dependency) opens on
 * hover AND keyboard focus, so the definition is not hover-only.
 */
const TERMS: Record<string, { short: string; long: string }> = {
  hitl: {
    short: "Human-in-the-loop: the run has stopped and is waiting for a person to decide.",
    long: "When a phase finishes, the run parks at its gate until you approve (continue) or reject with 12+ characters of feedback (regenerate). Keys: a = approve, r = focus the rejection note.",
  },
  dod: {
    short: "Definition of Done: the exit criteria a phase must meet before the run may move on.",
    long: "Each phase records a machine-checked pass/fail plus its unmet criteria. Advisory gates record without blocking; enforced gates park the run. The sidebar toggle switches between the two.",
  },
  agentPacket: {
    short: "The compiled prompt you paste into a coding agent — this build's contract, in one document.",
    long: "Compiled from the brief, the phase artifacts and the constraints. Copy it (or download the .md), paste it into your agent session, then paste the agent's output back through the phase's Notes.",
  },
  oracle: {
    short: "The build's acceptance cases — what “correct” means for this project.",
    long: "Template-derived given/expect prose plus an executable machine-verify block. They describe acceptance; they do not run the product.",
  },
  vault: {
    short: "Notes built from this run, kept as searchable markdown.",
    long: "An Obsidian-style note set (map of content, wikilinks, tags) generated from the build. Copy or download individual notes as .md.",
  },
  crew: {
    short: "A set of advisory agent roles for the current phase.",
    long: "The crew proposes and critiques; it never overrides the gates. Spawn it from the action bar once a phase has run and a model key is configured.",
  },
};

/**
 * Inline term with its definition on hover/focus (111 TASK-07). Each instance
 * carries its own `Tooltip.Provider` because the Provider is required by
 * Radix's `Tooltip.Root` and this file cannot mount one at the app root
 * (`src/routes/*` is outside this lane's file ownership).
 *
 * 216m (TASK-07 tail, the two remaining chips): `focusable` defaults to TRUE.
 * Every free-standing term keeps a focusable trigger, which is what makes the
 * definition reachable without a mouse (111's "hover AND keyboard focus"
 * done-when). The one chip that lives INSIDE a `<button>` — the phase-rail
 * tile, already one tab stop per phase — passes `false`: a nested `tabIndex=0`
 * there would add a second, keyboard-bogus stop to every phase row and nest a
 * focusable element inside a button. Hover still opens that definition, and the
 * same definition is keyboard-reachable from the HITL dock chip and the Guide.
 */
function Term({
  k,
  children,
  focusable = true,
}: {
  k: string;
  children: ReactNode;
  focusable?: boolean;
}) {
  const t = TERMS[k];
  if (!t) return <>{children}</>;
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            tabIndex={focusable ? 0 : undefined}
            className="cursor-help underline decoration-dotted decoration-from-font underline-offset-2"
          >
            {children}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-fg shadow-lg"
          >
            <span className="block">{t.short}</span>
            <span className="mt-1 block text-muted">{t.long}</span>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/**
 * R6-f12 (WA-01 · fixes/109 §3.4 never landed): pane-level error boundary.
 * Before this, one pane's render throw unmounted the WHOLE screen — the only
 * other catch is the router-level `AppErrorComponent` (the white-screen class).
 * This class boundary keeps the shell mounted (Home header / Run header + rail
 * + diagnostics) and reports ONE `ui.pane_crash` row; the event is registered
 * (rt-events.ts:141) and asserted by its test, but nothing ever emitted it
 * before this boundary. Same honesty doctrine as the rest of the file: name
 * what happened, keep the rest of the console usable, never fake recovery.
 */
class PaneBoundary extends Component<
  { label: string; children: ReactNode },
  { crashed: boolean; message: string | null }
> {
  state: { crashed: boolean; message: string | null } = { crashed: false, message: null };

  static getDerivedStateFromError(err: unknown): { crashed: boolean; message: string | null } {
    return { crashed: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    // R6-f12 (S4 hunk, re-applied): dev re-bubble dedupe. React re-throws a
    // boundary-caught error to window in dev, so the global handler and this
    // boundary can both see it — first reporter wins, others skip, and exactly
    // ONE ui.pane_crash row lands.
    if (!markBoundaryError(error)) return;
    try {
      reportRt({
        level: "error",
        scope: "ui-render",
        event: "ui.pane_crash",
        message: `${this.props.label} area crashed while rendering: ${
          error instanceof Error ? error.message : String(error)
        }`,
        capture: "src/components/console.tsx:PaneBoundary.componentDidCatch",
        err: error,
        stack: info?.componentStack ?? null,
        ctx: { pane: this.props.label },
      });
    } catch {
      /* telemetry must never throw into the code it observes (AGENTS.md §7) */
    }
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div role="alert" className="m-5 rounded-md border border-danger/50 bg-raised px-4 py-4 text-sm">
        <p className="font-medium text-danger">
          This area hit a render error — the rest of the console is still live.
        </p>
        <p className="mt-1 font-mono text-xs leading-relaxed text-muted [overflow-wrap:anywhere]">
          {this.state.message ?? "unknown error"}
        </p>
        <button
          type="button"
          onClick={() => this.setState({ crashed: false, message: null })}
          className="mt-3 inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs text-fg hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          Try again
        </button>
      </div>
    );
  }
}

export function HomeScreen() {
  const nav = useNavigate();
  const { projects, create, select } = useRapid();
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

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
      {/* R6-f12 (330_6): bound the Home header too — a throw in it (Mark / the
          help entry) previously unmounted the whole intake screen. Additive:
          PaneBoundary renders children unchanged when healthy. */}
      <PaneBoundary label="Home header">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <Mark />
          <div>
            <p className="font-medium tracking-tight">RapidTool</p>
            <p className="font-mono text-xs text-muted">governed delivery harness</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden font-mono text-xs text-faint sm:block">phases 0–12 · graph locked</p>
          {/* R6-f07 (A4-f06): a help entry on the FIRST screen — before this
              the Guide was reachable only after creating a build. */}
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            title="What RapidTool is and how a build flows (same agent guide as the run screen)"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-border px-2 text-xs text-muted hover:border-accent/40 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>How it works</span>
          </button>
        </div>
      </header>
      </PaneBoundary>

      {/* R6-f12: pane boundary — a render throw in the home content keeps the
          header (shell) mounted and lands one `ui.pane_crash` row. */}
      <PaneBoundary label="Home screen">
      <main id="main-content" className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:py-16">
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
            {/* R6-f07: the launch button is disabled under 12 characters — say
                why, with the same live counter shape as the rejection note.
                H4 (fixes/316 · C6-U4): the 0-character case speaks too — the
                button is disabled from the first paint, so its reason must be
                visible before anything is typed (the old branch stayed silent
                at 0/12 and left the disabled state unexplained). */}
            <p
              aria-live="polite"
              className={`w-full font-mono text-xs ${
                brief.trim().length > 0 && brief.trim().length < 12 ? "text-warn" : "text-faint"
              }`}
            >
              {brief.trim().length}/12
              {brief.trim().length === 0
                ? " · no brief yet — 12+ characters required before a build can open"
                : brief.trim().length < 12
                  ? " · brief too short — 12+ characters required before a build can open"
                  : ""}
            </p>
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
              /* H4 (fixes/316 · C6-U4): the empty box now carries the house
                 empty-state shape — status, what a build IS, and the exact
                 pathway to the first one. The old one-liner ("Paste a brief to
                 open Phase 0.") left "paste where?" open while the control it
                 named sits in the other column, and said nothing about what
                 would land here. */
              <li className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
                <p>No builds yet.</p>
                <p className="mx-auto mt-1.5 max-w-[260px] text-xs leading-relaxed text-faint">
                  A build is one brief and its governed 13-phase run. Type a brief of 12+
                  characters (or pick a template), then click Open intake — the build appears
                  here, open at Phase 0.
                </p>
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
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-raised px-3 py-3 text-left hover:border-accent/40"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium [overflow-wrap:anywhere]">{p.name}</span>
                      <span className="mt-0.5 block font-mono text-xs text-muted">
                        {p.domain} ·{" "}
                        <span title={`P${p.currentPhase}`}>Phase {p.currentPhase + 1} of 13</span> ·{" "}
                        {PROJECT_STATUS_LABEL[p.status]}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>
      </main>
      </PaneBoundary>
      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}

/**
 * UI-10 (110 §3): one row in the Export menu. The menu collapses five
 * standalone toolbar buttons into one labelled affordance; every item calls
 * the SAME handler the old button called (copyPacket / copyHandoff /
 * downloadPacket / downloadJson / copyProjectJson) — presentation only, no
 * code path removed. Uses the same `{label, hint}` shape as RUN_TABS and
 * DIAGRAM_KINDS so the plain-language purpose line stays consistent.
 */
function ExportMenuItem({
  icon,
  label,
  hint,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-start gap-2.5 rounded-sm px-2.5 py-2 outline-none select-none data-[highlighted]:bg-raised"
    >
      <span className="mt-0.5 shrink-0 text-muted">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-faint">{hint}</span>
      </span>
    </DropdownMenu.Item>
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
  const [busyAction, setBusyAction] = useState<
    null | "step" | "run" | "approve" | "reject" | "crew" | "module"
  >(null);
  const busyRef = useRef(false);
  const copyTs = useRef(0);
  // C1 (332-5): the last keyed-call outcome this screen ran (crew). The chat
  // half lives in the persisted thread, so it survives a reload; this covers
  // the keyed action the RunScreen itself dispatches.
  const [keyedOutcome, setKeyedOutcome] = useState<KeyedOutcome | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  // UI-01: focus target for the HITL override checkbox. The `a` shortcut never
  // approves a gate that needs the override — it names the real control and
  // parks focus here (same pattern as noteRef for the rejection note).
  const overrideRef = useRef<HTMLInputElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedHandoff, setCopiedHandoff] = useState(false);
  const [tab, setTab] = useState<RunTab>("artifacts");
  /** 111 TASK-05 "More panels" disclosure. A tab in the advanced tier forces
   *  the tier open while it is the active panel, so collapsing the section can
   *  never hide the trigger of the panel currently on screen. */
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const activeIsAdvanced = RUN_TABS.some((t) => t.id === tab && t.tier === "advanced");
  const showAdvanced = advancedOpen || activeIsAdvanced;
  const advancedTabCount = RUN_TABS.filter((t) => t.tier === "advanced").length;
  const [query, setQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<PhaseId | "all">("all");
  const [viewPhase, setViewPhase] = useState<PhaseId | null>(null);
  /**
   * W312 C4 · 311 §6 #4: the phase whose pipeline detail panel is open. Owned
   * HERE because the merged `PhaseProgressRail` (the single clickable strip)
   * and `PipelineRail` (now-line + detail panel) both need it.
   */
  const [railDetail, setRailDetail] = useState<PhaseId | null>(null);
  /** W312 C4 · 311 §6 #1: the mobile sidebar drawer. Below `lg` the right
   *  sidebar is a slide-over instead of a ~3 000px stacked column. */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  /** W312 C4 · 311 §6 #8: the A1–A8 algorithm cards collapse to one line. */
  const [algoOpen, setAlgoOpen] = useState(false);
  /** 336-5 mobile density: the header's read-only status chips AND the
   *  view/config controls (Guide/Settings/Shortcuts/theme) collapse behind one
   *  disclosure below `sm` (they stacked to ~7 rows before content at 390px).
   *  The run-affecting controls (Autopilot, Wild) stay visible; every collapsed
   *  control stays rendered and reachable (nothing is hidden on `sm`+). */
  const [headerStatusOpen, setHeaderStatusOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDraft, setReportDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  /**
   * 216m · 111 TASK-10: the command palette's open state. It lives HERE (not in
   * the palette) because the global key handler below must suspend itself while
   * the palette is open — and that handler reads the ref, never this state, so
   * its stale-closure-free [id]-only effect stays intact.
   */
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteOpenRef = useRef(false);
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

  // W312 C4 · 311 §6 #1: Escape closes the mobile sidebar drawer. The drawer is
  // not a modal (no focus trap — it holds ordinary page content), so this is the
  // only key affordance it needs; desktop (`lg`) never opens it.
  useEffect(() => {
    if (!sidebarOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  // 216m · 111 TASK-10: mirror the palette's open state into a ref. The global
  // key handler below deliberately depends only on `id`, so it must read the
  // REF (never the state) to suspend shortcuts while the palette is open —
  // otherwise the handler would close over a stale `false` forever.
  useEffect(() => {
    paletteOpenRef.current = paletteOpen;
  }, [paletteOpen]);

  // Global keyboard shortcuts for the run loop (enhancement 3.1). Reads the store
  // directly so the handler stays free of stale closures and TDZ issues.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // 216m · 111 TASK-10: while the command palette is open, EVERY shortcut in
      // this handler is suspended — a bare "e"/"g"/"a"/"r" press (or any mod
      // chord) must never reach run()/onApprove() behind the palette (111's
      // stated keyboard-collision risk). The palette owns the keyboard while
      // open (cmdk/Radix handle arrows, Enter, Escape). A plain early return
      // does not stop propagation, so the palette's own input keeps receiving
      // every event normally.
      if (paletteOpenRef.current) return;
      // UI-02 (110 §3/§5): suspend every shortcut while ANY modal dialog is
      // open — before this guard, `e`/`g`/`a` reached run()/onApprove()
      // invisibly behind the Guide/Settings/Shortcuts dialog. The shared
      // `Modal` renders role="dialog" aria-modal="true" only while open, so
      // this DOM check is a live signal; the AlertDialog confirm (Archive) has
      // the same obligation via role="alertdialog". The dialog keeps its own
      // Escape/close handling — when this listener bails it neither
      // preventDefaults nor stops propagation.
      if (
        document.querySelector(
          '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]',
        )
      )
        return;
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
        const p = st.projects.find((x) => x.id === id);
        if (!p) return;
        // UI-03: the same predicate the buttons use (canExecute) — a chord can
        // never start a run whose button is disabled or absent.
        if (!canExecute(p, busyRef.current)) return;
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
      } else if (mod && e.key.toLowerCase() === "k") {
        // 216m · 111 TASK-10: open the command palette. This branch can only
        // fire while the palette is CLOSED (the suspension return above runs
        // first otherwise); the palette closes via Escape / click-outside
        // through its own Radix dialog.
        e.preventDefault();
        setPaletteOpen(true);
      } else if (mod && e.key === "/") {
        // T-22 (110 §4 CP-6 + §3 UI-09): `?` keeps opening the Guide (the
        // documented, muscle-memory binding — unchanged below); Ctrl+/ is the
        // additive second binding and opens THIS shortcut list. The Shortcuts
        // dialog states both bindings (see the SHORTCUTS table).
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (!mod && !e.altKey && !e.repeat) {
        // Single-key shortcuts (enhancement 10: additive, no regressions).
        // Ignored while typing and when a modifier is held.
        const st = useRapid.getState();
        const p = st.projects.find((x) => x.id === id);
        if (!p) return;
        const key = e.key;
        if (key === "e" || key === "E") {
          e.preventDefault();
          // UI-03: the buttons' own predicate, not a busyRef-only latch — see
          // canExecute(). During a run started elsewhere (wild mode, or a
          // reload with stored status "running") this key now does nothing,
          // exactly like the disabled button.
          if (canExecute(p, busyRef.current)) void run();
        } else if (key === "g" || key === "G") {
          e.preventDefault();
          if (canExecute(p, busyRef.current)) void runUntil();
        } else if (key === "a" || key === "A") {
          if (p.hitl) {
            e.preventDefault();
            if (hitlNeedsOverride(p)) {
              // UI-01: `a` and the Approve button are the same action. The
              // button is disabled until the override is ticked, so the
              // shortcut never approves here — it surfaces one plain sentence
              // naming the real control and puts focus on it (noteRef pattern).
              setError(
                "This gate needs the override first — tick “I reviewed the failing bounded-runner output and approve anyway.” below, then approve.",
              );
              overrideRef.current?.focus();
            } else {
              onApprove();
            }
          }
        } else if (key === "r" || key === "R") {
          if (p.hitl) {
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
      <main id="main-content" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-5">
        <p className="text-sm text-muted">This build doesn't exist or was archived.</p>
        <Link to="/" className="text-sm text-accent underline-offset-4 hover:underline">
          Back to intake
        </Link>
      </main>
    );
  }

  const projectId = project.id;
  // `project` is a narrowed `const` here, but function declarations (hoisted)
  // don't carry the control-flow narrowing into their bodies — so capture a
  // plain `Project` alias for the helper functions below.
  const current = project;
  // W-29(h): honest phase-def guards — an out-of-graph currentPhase (legacy or
  // hand-built state) renders as itself instead of throwing on PHASES[id]
  // (phases.ts F3-20: look ids up in PHASE_BY_ID, never index PHASES by position).
  const currentDef = PHASE_BY_ID.get(project.currentPhase) ?? null;
  const currentCode = currentDef?.code ?? `P${project.currentPhase}`;
  // C1 (332-5): the header LLM chip shows key VALIDITY, not presence. The
  // newest keyed outcome decides whether "configured" is honest: the server
  // probe's last-call record (refreshed by a server fn — never on render, and
  // it spends nothing), the persisted chat thread, or this screen's crew run.
  // Narrowed to a key-unusable class so a transient non-key failure never
  // mislabels a working key.
  const serverKeyed: KeyedOutcome | null = llmStatus.lastKeyed
    ? {
        ok: false,
        code: llmStatus.lastKeyed.code,
        note: llmStatus.lastKeyed.keySource ?? "",
        at: llmStatus.lastKeyed.at,
        noteKind: "source",
      }
    : null;
  const lastKeyed = laterKeyedOutcome(
    laterKeyedOutcome(lastChatKeyedOutcome(project.chatLog), keyedOutcome),
    serverKeyed,
  );
  const keyUnusableCode =
    lastKeyed && !lastKeyed.ok && lastKeyed.code !== null && KEY_UNUSABLE_CODES.has(lastKeyed.code)
      ? lastKeyed.code
      : null;
  const keyDoc = keyUnusableCode ? codeDocOf(keyUnusableCode) : null;
  const llmChipLabel = !llmStatus.configured ? llmStatus.label : (keyUnusableCode ?? llmStatus.label);
  const llmChipTone: "ok" | "faint" | "danger" = !llmStatus.configured
    ? "faint"
    : keyUnusableCode
      ? "danger"
      : "ok";
  const llmChipTitle = keyUnusableCode
    ? `${keyUnusableCode}: ${
        keyDoc
          ? `${keyDoc.meaning} ${keyDoc.agentAction}`
          : "a key is present but the last keyed call was refused."
      }${
        lastKeyed && lastKeyed.note
          ? `${lastKeyed.noteKind === "source" ? " Key source: " : " Last error: "}${lastKeyed.note}`
          : ""
      }`
    : "LLM backend status";
  // 111 TASK-02: one derived next action and its single primary handler. The
  // handler is the SAME function the action bar uses — never a second path to
  // run/approve (the stated risk of TASK-02).
  const nextAction = uiNextAction(project, running);
  const nextNeedsOverride = hitlNeedsOverride(project);
  const nextPrimary =
    nextAction.kind === "approve"
      ? () => onApprove()
      : nextAction.kind === "run" || nextAction.kind === "fix-gate"
        ? () => void runUntil()
        : null;

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
      const startedAt = Date.now();
      const res = await executeAsync(projectId);
      // C1 (334-5): refresh the validity probe after the run too — a phase
      // synthesis can touch a keyed path whose refusal the header chip must
      // show, and this handler used to drop `executeAsync`'s own code. Only a
      // refusal OBSERVED during this step is attributed to it (a stale pre-run
      // outcome would let the label out-claim what it measured — 333 F-4).
      const fresh = await refreshStatuses();
      const keyedDuringRun = keyedRefusalSince(startedAt, fresh.lastKeyed);
      if (!res.ok) setError(codedFailureText(res.error, res.code, keyedDuringRun));
      else if (keyedDuringRun) {
        setError(
          `${keyedDuringRun} — the step continued on the deterministic floor; a keyed call during this step was refused.`,
        );
      }
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  }

  function onApprove(force = false) {
    setError(null);
    setNotice(null);
    // F4 (fixes/252 LANE 2): every approve path (dock button, action bar, the
    // `a` shortcut) funnels through this ONE handler, so the build's per-action
    // list is consulted once, before store state can move. An off-list action
    // is refused with its OWN code; a build with no list is byte-unchanged.
    const narrowed = policyOverlayRefusal(
      policyAllowListsOf(current),
      force ? "hitl.force" : "hitl.approve",
      `gate:P${current.currentPhase}`,
    );
    if (narrowed) {
      setError(`${narrowed.code} — ${narrowed.detail}`);
      return;
    }
    // DF-09 (W23 L6 · 249 SPEC 1): the forced-override path must carry a rationale —
    // the SAME note field the rejection path uses (≥12 chars; enforced by the store
    // pre-check + the engine's coded refusal, so the error surfaces here via setError).
    // Passed ONLY when force is set: a normal approval never inherits a stale note.
    const res = approve(projectId, { force, note: force ? note.trim() : undefined });
    if (!res.ok) setError(codedFailureText(res.error, res.code));
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
    // K5-2 (fixes/294/295): the configured path awaits an LLM feedback
    // interpretation, so a rejection is not instant — latch the dock while it
    // is in flight (busyAction already carried the "reject" member, unused)
    // so the human sees pending instead of an idle-looking button, and a
    // double-fire is dropped here before the store's serialized queue.
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyAction("reject");
    void rejectAsync(projectId, note)
      .then((res) => {
        if (!res.ok) setError(codedFailureText(res.error, res.code));
        else setNote("");
      }, (errCaught: unknown) => {
        // rejectAsync cannot reject today (the store action's contract), but a
        // rejection must not float: `.finally` does not absorb one, so handle it
        // like every other failure and surface the message (WildToggle class).
        setError(errCaught instanceof Error ? errCaught.message : String(errCaught));
      })
      .finally(() => {
        busyRef.current = false;
        setBusyAction(null);
      });
  }

  async function runUntil() {
    if (busyRef.current) return;
    setError(null);
    setNotice(null);
    busyRef.current = true;
    setBusyAction("run");
    try {
      const startedAt = Date.now();
      const res = await runUntilHitlAsync(projectId);
      // C1 (334-5): a multi-phase run can reach the keyed P6 synthesis edge.
      // Pull the validity probe so the chip reflects it, and name the coded
      // class on the run surface instead of a generic failure. A keyed refusal
      // INSIDE a run degrades to the deterministic floor without failing the
      // run, so the probe is the only witness — but ONLY a refusal observed at
      // or after this run's start is attributed to it (a stale pre-run outcome
      // must never be blamed on this run — 333 F-4).
      const fresh = await refreshStatuses();
      const keyedDuringRun = keyedRefusalSince(startedAt, fresh.lastKeyed);
      if (!res.ok) {
        setError(codedFailureText(res.error, res.code, keyedDuringRun));
      } else if (keyedDuringRun) {
        setError(
          `${keyedDuringRun} — the run continued on the deterministic floor; a keyed call during this run was refused.`,
        );
      } else if (res.note) {
        setNotice(res.note);
      }
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  }

  async function onRunModule() {
    if (busyRef.current) return; // UI-4 latch (R6-f01): double-click must fire ONE bounded run
    setError(null);
    setNotice(null);
    busyRef.current = true;
    setBusyAction("module");
    try {
      const res = await runModuleReal(projectId);
      if (!res.ok) {
        setError(codedFailureText(res.error ?? "bounded runner unavailable", res.code));
        return;
      }
      const r = res.result as { ok?: boolean; exitCode?: number; durationMs?: number };
      setNotice(
        r && r.ok
          ? `Module ran: exit ${r.exitCode} in ${r.durationMs}ms`
          : "Module run failed — see the “Real module run” artifact for details.",
      );
    } catch (e) {
      // R6-f01: this was the ONLY async handler without try/catch — a throwing
      // runner must surface a coded error, never reject into the void.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
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
    if (!res.ok) setError(codedFailureText(res.error ?? "Report rejected.", res.code));
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
      // C1 (332-5): record the outcome class so the header chip reflects key
      // validity. A crew run reaches the same provider as chat, so its success
      // clears a stale chat failure and its coded refusal names the fault.
      setKeyedOutcome(
        res.ok
          ? { ok: true, code: null, note: "", at: Date.now(), noteKind: "error" }
          : { ok: false, code: res.code ?? null, note: res.error ?? "", at: Date.now(), noteKind: "error" },
      );
      // C1 (332-5): refresh the server probe so its last-call record (the live
      // validity signal) reflects this run too. Cheap server fn — no provider
      // call, never on the render path.
      void refreshStatuses();
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
              } on ${PHASES[current.currentPhase]?.title ?? `phase ${current.currentPhase}`}.`;
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
          setError(codedFailureText(ingested.error ?? "Crew artifacts could not be ingested.", ingested.code));
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
          codedFailureText(
            `Crew run did not start (${res.reason}): ${reason}${res.error ? ` — ${res.error}` : ""}`,
            res.code,
          ),
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
        setError(codedFailureText(res.error, res.code));
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

  // 216m · 111 TASK-10: the command palette's entries. Every `run` below calls
  // the SAME handler the dock / action bar / toolbar button calls — the palette
  // adds a findable surface, never a second path to an action (111 TASK-02).
  // The `verb` chip names the matching CLI verb ONLY where one really exists in
  // scripts/rapidtool-cli.mjs; UI-only entries say so instead of inventing one.
  const paletteEntries: CmdPaletteEntry[] = [
    {
      id: "approve",
      group: "Run loop",
      label: "Approve the waiting gate",
      description: "Continue the run past the phase gate it is parked at.",
      verb: "approve",
      keywords: ["hitl", "gate", "continue", "accept"],
      run: () => onApprove(),
    },
    {
      id: "run-until",
      group: "Run loop",
      label: "Run to the next gate",
      description: "Advance phase by phase until the run parks at a gate or finishes.",
      verb: "gate",
      keywords: ["run", "until", "next", "advance", "continue"],
      run: () => void runUntil(),
    },
    {
      id: "copy-packet",
      group: "Copy & export",
      label: "Copy the agent packet",
      description: "Copy the full agent packet markdown for the current phase.",
      verb: "packet",
      keywords: ["clipboard", "markdown", "agent", "paste"],
      run: () => void copyPacket(),
    },
    {
      id: "download-packet",
      group: "Copy & export",
      label: "Download the agent packet (.md)",
      description: "Save the agent packet markdown to a file.",
      verb: "packet",
      keywords: ["save", "file", "markdown", "agent"],
      run: () => downloadPacket(),
    },
    {
      id: "copy-project-json",
      group: "Copy & export",
      label: "Copy project JSON",
      description: "Copy the whole project export to the clipboard.",
      verb: "export",
      keywords: ["clipboard", "backup", "json", "build"],
      run: () => void copyProjectJson(),
    },
    {
      id: "download-json",
      group: "Copy & export",
      label: "Download project JSON",
      description: "Save the whole project export as a .json file.",
      verb: "export",
      keywords: ["save", "file", "backup", "json"],
      run: () => downloadJson(),
    },
    {
      id: "copy-handoff",
      group: "Copy & export",
      label: "Copy the phase handoff",
      description: "Copy the handoff prompt that carries this phase into an external agent session.",
      verb: null, // phaseHandoff (src/lib/handoff.ts) has no CLI verb today
      keywords: ["handoff", "prompt", "phase", "agent", "external"],
      run: () => void copyHandoff(),
    },
    {
      id: "settings",
      group: "Panels",
      label: "Open settings",
      description: "LLM / research backend status and where the keys live (server-side .env).",
      verb: null,
      keywords: ["keys", "env", "backend", "config"],
      run: () => setSettingsOpen(true),
    },
    {
      id: "shortcuts",
      group: "Panels",
      label: "Open keyboard shortcuts",
      description: "Every single-key and Ctrl chord this screen listens for.",
      verb: null,
      keywords: ["keys", "keyboard", "hotkeys", "help"],
      run: () => setShortcutsOpen(true),
    },
    {
      id: "report",
      group: "Panels",
      label: "Toggle the agent-report panel",
      description: "Paste a JSON agent report for the current phase — the console's ingest seam.",
      verb: "ingest",
      keywords: ["report", "ingest", "json", "paste", "agent"],
      run: () => setReportOpen((v) => !v),
    },
    // W24 U1 ("link tabs logically"): every panel in the strip is also a palette
    // entry, generated from the SAME `RUN_TABS` array the triggers render from —
    // so a panel the strip hides by default (e.g. "Eval fixtures", behind "More
    // panels") is findable by name from the palette, and `run` is the same
    // `setTab` the strip's `onValueChange` calls (never a second path). `verb:
    // null` is the honest chip: switching a UI tab has no CLI verb.
    ...RUN_TABS.map((t): CmdPaletteEntry => ({
      id: `tab-${t.id}`,
      group: "Go to panel",
      label: `Go to panel: ${t.label}`,
      description: t.purpose,
      verb: null,
      keywords: ["panel", "tab", "switch", t.id],
      run: () => setTab(t.id),
    })),
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* 336-5: 335-5's run-screen-only skip link is superseded by the ONE
          global link in routes/__root.tsx (now that every screen's main
          landmark, including this one, carries id="main-content"). Keeping
          both would render two identical first-focus stops. */}
      {/* R6-f12 (330_6): the Run header (name/rename, status chips, Autopilot,
          Wild, Guide/Settings/Shortcuts) was the last unwrapped Run surface —
          a render throw there unmounted the WHOLE Run screen via the router's
          AppErrorComponent (white screen), which a browser probe confirmed
          (forced WildToggle throw → rail + sidebar + tabs all gone). Bound it
          like the rail/center/sidebar so a header crash is contained and one
          `ui.pane_crash` row lands. */}
      <PaneBoundary label="Run header">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
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
              // 335-5: a hand-built or no-whitespace brief can make `inferName`
              // (engine.ts) return a very long single token; without a cap the
              // header grew the PAGE to 2404px (probe). Cap + ellipsize here so
              // the name can never blow out the layout (the full name stays in
              // the title and the rename input).
              title={project.name}
              className="hidden max-w-[46vw] min-w-0 truncate text-sm text-muted sm:inline-block"
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
          {/* 336-5 mobile density: the six read-only status chips + the four
              view/config controls (Guide, Settings, Shortcuts, theme) stacked
              to ~7 rows before content at 390px (measured header 291px tall /
              content at 364px of 844). ONE toggle collapses BOTH groups into a
              disclosure below `sm`; the run-affecting controls (Autopilot,
              Wild) stay visible, and `sm:flex` on both groups keeps desktop
              byte-identical in DOM order. Nothing is hidden on `sm`+, and every
              collapsed control stays reachable one tap away. */}
          <button
            type="button"
            onClick={() => setHeaderStatusOpen((v) => !v)}
            aria-expanded={headerStatusOpen}
            aria-controls="run-status-strip run-options-strip"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-border px-2 hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent/40 sm:hidden"
          >
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Status &amp; options</span>
          </button>
          <div
            id="run-status-strip"
            className={`${headerStatusOpen ? "flex" : "hidden"} w-full flex-wrap items-center gap-2 sm:flex sm:w-auto`}
          >
          <span className="rounded-sm border border-border px-2 py-1">{project.domain}</span>
          <StatusChip label={llmChipLabel} tone={llmChipTone} title={llmChipTitle} />
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
            ≈{tokenEst.tokensEst} tok (est)
          </span>
          {lastSaved !== null ? (
            <span
              className="rounded-sm border border-border px-2 py-1 text-faint"
              title="Saved to this browser only"
            >
              saved {fmtClock(lastSaved)}
            </span>
          ) : null}
          </div>
          {/* 311 §2 (unnamed control #1): the input was only implicitly associated
              (wrapped label) and the probe measured no accessible name, so the
              span now carries an id and the input points at it explicitly. */}
          <label className="inline-flex min-h-9 items-center gap-2 rounded-sm border border-border px-2">
            <input
              id="autopilot-toggle"
              type="checkbox"
              checked={autopilot}
              onChange={(e) => setAutopilot(e.target.checked)}
              aria-labelledby="autopilot-toggle-label"
            />
            <span
              id="autopilot-toggle-label"
              title="Auto-approves eligible gates only: non-stock gates whose DoD check passed. Stock P4/P5/P8/P9 gates and human-only gates still stop for you."
            >
              Autopilot
              {/* 336-5 density: the scope sentence stays on `sm`+ and in the
                  title/aria name; the mobile chip shows the control's name so
                  Autopilot + Wild share one row. No claim is added. */}
              <span className="hidden sm:inline"> · auto-approve eligible gates</span>
            </span>
          </label>
          <WildToggle project={project} />
          {/* 336-5: the view/config controls are one responsive group so the
              mobile disclosure can collapse them together with the chips while
              desktop DOM order is unchanged (they still follow Autopilot/Wild). */}
          <div
            id="run-options-strip"
            className={`${headerStatusOpen ? "flex" : "hidden"} w-full flex-wrap items-center gap-2 sm:flex sm:w-auto`}
          >
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
        </div>
      </header>
      </PaneBoundary>

      <div className="grid flex-1 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        {/* R6-f12: the phase rail is its own pane — a render throw in it keeps
            the rest of the Run screen mounted instead of unmounting the grid. */}
        <PaneBoundary label="Phase rail">
          <PhaseRail
            project={project}
            viewPhase={viewPhase}
            onViewPhase={(phase) => setViewPhase((prev) => (prev === phase ? null : phase))}
          />
        </PaneBoundary>
        {/* R6-f12 (S4 hunk, re-applied): the Run content boundary — a render
            throw here keeps the Run header + phase rail + diagnostics mounted
            and lands one `ui.pane_crash` row. */}
        <PaneBoundary label="Run screen">
        <main
          id="main-content"
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
                {currentCode}
              </p>
              <p className="font-mono text-xs text-faint">
                {rec ? PHASE_STATUS_META[rec.status].label : null}
              </p>
              {rec ? <StatusBadge project={project} phase={project.currentPhase} /> : null}
            </div>
            <h1 className="mt-1 text-2xl font-medium tracking-tight [overflow-wrap:anywhere]">
              {currentDef?.title ?? `Unknown phase P${project.currentPhase}`}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {currentDef?.summary ??
                `No phase definition — P${project.currentPhase} is not in this build's phase graph (legacy or hand-built state).`}
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
                    disabled={!canExecute(project, busyAction !== null)}
                    title="Advanced — run only this phase, then stop"
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm text-fg disabled:opacity-40"
                  >
                    {busyAction === "step" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {busyAction === "step" ? "Running…" : `Execute ${currentCode}`}
                  </button>
                  {/* UI-16 (W12 Lane D): the ONE solid/primary button on this
                      screen is the "Run to next gate" / "Approve" button in the
                      RunStatusPanel above — this toolbar keeps the same action,
                      the same handler and the `g` shortcut (TASK-09's capability
                      note stands), but wears the secondary border treatment so a
                      beginner sees exactly one primary next action, not two
                      identical solids. */}
                  <button
                    type="button"
                    onClick={runUntil}
                    disabled={!canExecute(project, busyAction !== null)}
                    title="Recommended — runs phases until something needs you"
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
                      {busyAction === "module" ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {busyAction === "module" ? "Running…" : "Run module (bounded)"}
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
                onClick={() => {
                  const nid = clone(project.id);
                  if (nid) void nav({ to: "/run/$id", params: { id: nid } });
                }}
                className="min-h-11 rounded-md px-3 text-sm text-muted"
              >
                Clone
              </button>
              {/* UI-10 (110 §3): the five overlapping export affordances
                  ("Copy agent packet", "Copy phase handoff", "Download packet
                  (.md)", "Export", "Copy JSON") collapse into ONE labelled
                  menu. Presentation-only: every item still calls the same
                  handler the button called (the Ctrl+Shift+C chord and the
                  command-palette entries are untouched), so no export path
                  was removed. The `copied` / `copiedHandoff` toast now shows
                  on the trigger. */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    title="Copy or download this build — all export paths in one menu"
                    className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg data-[state=open]:text-fg"
                  >
                    <Download className="h-4 w-4" />
                    {copied ? "Copied packet ✓" : copiedHandoff ? "Copied handoff ✓" : "Export"}
                    <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="start"
                    sideOffset={6}
                    className="z-50 w-72 rounded-md border border-border bg-surface p-1 shadow-lg"
                  >
                    {/* DF-26 (W16 lane 3): the trap "a banner only inside the packet
                        body defeats the point" — so truncation also shows HERE, at
                        the copy/download affordance itself, before anything is taken. */}
                    {packetTruncated(current.packet) ? (
                      <div className="mx-1 mb-1 rounded-sm border border-warn/30 px-2 py-1.5 font-mono text-xs leading-snug text-warn">
                        Packet truncated — hit the {PACKET_MAX_CHARS_MIRROR}-char budget; copy/download
                        carries the cut packet as-is.
                      </div>
                    ) : null}
                    <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 font-mono text-2xs tracking-widest text-faint uppercase">
                      Copy
                    </DropdownMenu.Label>
                    <ExportMenuItem
                      icon={<Copy className="h-4 w-4" aria-hidden="true" />}
                      label="Agent packet"
                      hint="The prompt to paste into a coding agent"
                      onSelect={() => void copyPacket()}
                    />
                    <ExportMenuItem
                      icon={<Copy className="h-4 w-4" aria-hidden="true" />}
                      label="Phase handoff"
                      hint="The prompt that carries this phase to another agent"
                      onSelect={() => void copyHandoff()}
                    />
                    <DropdownMenu.Separator className="my-1 h-px bg-line" />
                    <DropdownMenu.Label className="px-2.5 pt-1 pb-1 font-mono text-2xs tracking-widest text-faint uppercase">
                      Download
                    </DropdownMenu.Label>
                    <ExportMenuItem
                      icon={<Download className="h-4 w-4" aria-hidden="true" />}
                      label="Packet file (.md)"
                      hint="Save the agent packet as a markdown file"
                      onSelect={() => downloadPacket()}
                    />
                    <ExportMenuItem
                      icon={<Download className="h-4 w-4" aria-hidden="true" />}
                      label="Build file (.json)"
                      hint="Save the whole build so it can be imported later"
                      onSelect={() => downloadJson()}
                    />
                    <ExportMenuItem
                      icon={<Copy className="h-4 w-4" aria-hidden="true" />}
                      label="Build JSON"
                      hint="Copy the whole build to the clipboard"
                      onSelect={() => void copyProjectJson()}
                    />
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <button
                type="button"
                onClick={() => setReportOpen((v) => !v)}
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg"
              >
                Ingest report
              </button>
              {/* 311 §2 (unnamed control #3): the visually-hidden file input was
                  label-less by design; it now carries an explicit name. */}
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg">
                <Upload className="h-4 w-4" aria-hidden="true" />
                Import
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={onImportFile}
                  aria-label="Import a build file (.json)"
                />
              </label>
              <button
                type="button"
                onClick={() => setArchiveOpen(true)}
                className="min-h-11 rounded-md px-3 text-sm text-muted hover:text-danger"
              >
                Archive
              </button>
              {/* W312 C4 · 311 §6 #1 + §3 (mobile/390px was the biggest
                  ease-of-access failure — the right sidebar stacked inline and
                  the page ran ~7 300px tall). Below `lg` the sidebar becomes a
                  slide-over drawer; this toggle is the mobile-only affordance
                  (desktop keeps the static column, so the button hides there).
                  Everything in the sidebar stays reachable — nothing removed. */}
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-expanded={sidebarOpen}
                aria-controls="run-sidebar"
                title="Notes, memory, gate log and diagnostics"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm text-fg focus-visible:ring-2 focus-visible:ring-accent/40 lg:hidden"
              >
                <PanelRight className="h-4 w-4" aria-hidden="true" />
                {sidebarOpen ? "Hide sidebar" : "Sidebar"}
              </button>
            </div>
            {project.status === "complete" ? <ExportSoftwareBlock project={project} /> : null}
            {crewRun && (crewRun.ok || crewRun.messages.length > 0) ? (
              <div className="mt-3 w-full rounded-md border border-border bg-raised px-4 py-3">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
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
                      <p className="font-mono text-xs text-accent">
                        #{m.seq} · {m.role}
                        <span className="text-faint"> → </span>
                        {m.type}
                        {m.to ? <span className="text-faint"> (to {m.to})</span> : null}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-fg/90 [overflow-wrap:anywhere]">
                        {m.content}
                      </p>
                      {m.artifactTitles.length ? (
                        <p className="mt-1 font-mono text-xs text-faint">
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

            <p className="mt-3 font-mono text-xs text-faint">
              Saved to this browser only · Export for backup
            </p>
            {/* 311 §6 #9 (W312 C4): the visible `e / g / a / r` legend that sat
                here is retired — it ate prime vertical space under the action
                bar while the authoritative list (single-key rows AND the Ctrl
                chords) already lives in the Shortcuts dialog, reachable from
                the header button, Ctrl+/ and `?`→Guide. Shortcuts themselves
                are unchanged; only the duplicate legend text is gone. */}

            <AlertDialog.Root open={archiveOpen} onOpenChange={setArchiveOpen}>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 z-40 bg-bg/80" />
                <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5">
                  <AlertDialog.Title className="text-base font-medium tracking-tight [overflow-wrap:anywhere]">
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
                  <span key={`j-${j}`} className="rounded-sm border border-border px-2 py-1 font-mono text-2xs text-accent">
                    job:{j}
                  </span>
                ))}
                {project.lattice.entities.slice(0, 5).map((e) => (
                  <span key={`e-${e}`} className="rounded-sm border border-border px-2 py-1 font-mono text-2xs text-muted">
                    {e}
                  </span>
                ))}
                {project.lattice.constraints.slice(0, 6).map((c) => (
                  <span key={`c-${c}`} className="rounded-sm border border-warn/30 px-2 py-1 font-mono text-2xs text-warn">
                    {c}
                  </span>
                ))}
                {project.lattice.constraints.length > 6 ? (
                  <span className="rounded-sm border border-warn/30 px-2 py-1 font-mono text-2xs text-warn">
                    +{project.lattice.constraints.length - 6} more
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* 111 TASK-02: status-first panel above the tab strip and the rail —
              the top-left position both F-pattern sweeps land on (111 §2 #10).
              Sentence and button derive from the same `nextAction`, so they
              cannot disagree; the panel withholds its Approve button when the
              failed-sandbox override must be ticked first (110 UI-01's class of
              shortcut/button mismatch is deliberately not reproduced here). */}
          <RunStatusPanel
            project={project}
            action={nextAction}
            onPrimary={nextPrimary}
            primaryBlockedReason={
              nextAction.kind === "approve" && nextNeedsOverride
                ? "Tick the override checkbox in the approval panel below before approving."
                : undefined
            }
          />

          <PendingFixturesBanner project={project} />

          <PhaseProgressRail
            project={project}
            openPhase={railDetail}
            onTogglePhase={(p) => setRailDetail((prev) => (prev === p ? null : p))}
          />

          {/* W309 A6 (M4-01): U2's pipeline rail — now-line + click-for-detail +
              the ring.stall latch's first continuous app reader. W312 C4
              (311 §6 #4): its duplicate P0–P12 strip is retired — the merged
              clickable strip above owns the rail, and this mount renders the
              now-line (live region) + the detail panel the strip opens. */}
          <PipelineRail
            project={project}
            openPhase={railDetail}
            onCloseDetail={() => setRailDetail(null)}
          />

          <WildConsole project={project} />

          {/* W312 C4 · 311 §6 #8: the A1–A8 cards are REAL state but were competing
              with the phase story at equal weight; the same progressive-disclosure
              pattern as "More panels" collapses them to one line (their ids — real
              fields) with an explicit "Show all N" toggle. Nothing is deleted. */}
          {project.traces.length ? (
            <div className="border-b border-line px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs text-muted">
                  Onboard algorithms · {project.traces.length} in play
                  {!algoOpen ? (
                    <span className="text-faint"> — {project.traces.map((t) => t.id).join(" · ")}</span>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={() => setAlgoOpen((v) => !v)}
                  aria-expanded={algoOpen}
                  className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {algoOpen ? "Hide the cards" : `Show all ${project.traces.length}`}
                  <ChevronRight
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 transition-transform ${algoOpen ? "rotate-90" : ""}`}
                  />
                </button>
              </div>
              {algoOpen ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {project.traces.map((t) => (
                    <div key={t.id} className="rounded-md border border-border bg-raised px-3 py-3">
                      <p className="font-mono text-xs text-accent">{t.id}</p>
                      <p className="mt-1 text-sm font-medium">{t.name}</p>
                      <p className="mt-1 text-xs leading-snug text-muted">{t.summary}</p>
                    </div>
                  ))}
                </div>
              ) : null}
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
              rejectBusy={busyAction === "reject"}
              noteRef={noteRef}
              overrideRef={overrideRef}
            />
          ) : null}

          <Tabs.Root value={tab} onValueChange={(v) => setTab(v as RunTab)}>
            {/* 111 TASK-05: progressive disclosure — three primary panels on the
                strip, the remaining seven behind "More panels". The panels
                themselves (the ten `Tabs.Content value=` blocks below) are
                byte-unchanged, and `RunTab` is untouched. The old strip used
                `overflow-x-auto`, which pushed the right-hand tabs outside both
                F-pattern sweeps (111 §2 #10); the row now wraps instead. */}
            <div className="border-b border-line px-5 pt-3">
              <div className="flex flex-wrap items-center gap-1">
                <Tabs.List aria-label={tabListLabel("primary")} className="scroll-thin flex flex-wrap gap-1">
                  {RUN_TABS.filter((t) => t.tier === "primary").map((t) => (
                    <RunTabTrigger key={t.id} tab={t} />
                  ))}
                </Tabs.List>
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  aria-expanded={showAdvanced}
                  title={
                    activeIsAdvanced && !advancedOpen
                      ? "The open panel lives in this tier, so its trigger stays visible until you switch back to a primary panel — this pre-collapses the section for when you do."
                      : undefined
                  }
                  className="ml-auto inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {showAdvanced ? "Fewer panels" : `More panels (${advancedTabCount})`}
                  <ChevronRight
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                  />
                </button>
              </div>
              {showAdvanced ? (
                <Tabs.List aria-label={tabListLabel("advanced")} className="mt-1 flex flex-wrap gap-1">
                  {RUN_TABS.filter((t) => t.tier === "advanced").map((t) => (
                    <RunTabTrigger key={t.id} tab={t} />
                  ))}
                </Tabs.List>
              ) : null}
              {/* W24 U1: while an advanced tab is the OPEN panel, `activeIsAdvanced`
                  keeps the tier open, so the toggle above changes nothing on
                  screen — a control that reads as broken. State that plainly
                  instead of leaving the human to guess (the toggle is kept, and
                  its click still pre-collapses the tier for when they leave). */}
              {activeIsAdvanced && !advancedOpen ? (
                <p className="mt-1 text-xs leading-tight text-faint">
                  This panel lives in “More panels”, so its trigger stays visible while it is open —
                  the toggle collapses the section once you switch back to a primary panel.
                </p>
              ) : null}
            </div>

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
                  artifacts.length === 0 ? (
                    /* 111 TASK-08 / B3: first-run empty state carries status +
                       learnability + one direct pathway (NN/g empty-state
                       guidelines), reusing the already-written Guide copy
                       (`GUIDE_SECTIONS[0]`, 111 §4.2) instead of new prose. */
                    <div className="max-w-2xl">
                      <p className="text-sm text-fg">
                        No files yet — every phase you run writes what it produced into this list.
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{GUIDE_SECTIONS[0].body}</p>
                      {project.status !== "complete" && project.status !== "blocked" && !project.hitl ? (
                        <button
                          type="button"
                          onClick={() => void runUntil()}
                          className="btn-solid mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-fg px-4 text-sm font-medium text-bg"
                        >
                          Run to next gate
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    "No artifacts match this filter."
                  )
                }
              />
            </Tabs.Content>

            <Tabs.Content value="packet" forceMount className="data-[state=inactive]:hidden">
              {project.packet ? (
                <div className="px-5 pt-4 pb-5">
                  {/* DF-26 (W16 lane 3): truncation made loud where the packet is
                      shown. Detection reads the packet's OWN marker (packet.ts:17)
                      out of the assembled text — the cut is never recomputed here. */}
                  {packetTruncated(project.packet) ? (
                    <div className="mb-3 rounded-md border border-warn/30 bg-raised px-3 py-2 font-mono text-xs leading-relaxed text-warn">
                      This packet is truncated — it hit the packet budget ({PACKET_MAX_CHARS_MIRROR}{" "}
                      chars) and the tail was cut. The packet's own marker in the body reads:{" "}
                      {PACKET_TRUNC_MARKER}. Copy or download carries this packet as-is.
                    </div>
                  ) : null}
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
                      <p className="font-mono text-xs text-accent">
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
              {/* 111 TASK-08 / 110 UI-05: this pane used to render an empty div
                  when there was no crew — indistinguishable from a broken tab,
                  while every sibling pane had an honest empty state. Same
                  house pattern, plain words, and it says how one gets here. */}
              {(project.crew ?? []).length === 0 ? (
                <p className="m-4 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
                  No crew yet — a crew is the advisory set of agent roles for this phase.
                  Spawn one from the action bar once a model key is configured.
                </p>
              ) : (
                <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
                  {(project.crew ?? []).map((c) => (
                    <div key={c.role} className="rounded-md border border-border bg-raised px-3 py-3">
                      <p className="font-mono text-xs text-accent">
                        {c.role}
                        {c.active ? " · active" : ""} · {c.budgetTokens} tok
                      </p>
                      <p className="mt-2 text-sm">{c.mandate}</p>
                      <p className="mt-2 text-xs text-muted">{c.handoff}</p>
                      <p className="mt-2 font-mono text-xs text-faint">{c.tools.join(" · ")}</p>
                    </div>
                  ))}
                </div>
              )}
            </Tabs.Content>

            <Tabs.Content value="oracle" forceMount className="data-[state=inactive]:hidden">
              <div className="px-5 py-4">
                <p className="font-mono text-2xs text-muted uppercase tracking-wide">
                  Acceptance prose (A7 template)
                </p>
                <ul className="mt-2 space-y-2">
                  {(project.oracle ?? []).map((t) => (
                    <li key={t.id} className="rounded-md border border-border px-3 py-3">
                      <p className="font-mono text-xs text-accent">{t.name}</p>
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

                <p className="mt-5 font-mono text-2xs text-muted uppercase tracking-wide">
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

            <Tabs.Content value="fixtures" forceMount className="data-[state=inactive]:hidden">
              <FixturesPanel />
            </Tabs.Content>

            <Tabs.Content value="runtime" forceMount className="data-[state=inactive]:hidden">
              <RuntimeLogPane project={project} />
              {/* 216m · 111 TASK-11: typed timeline sibling. Additive — the raw
                  ring list above renders byte-identically; this pane collapses to
                  a one-line honest summary and expands to paired rows (starts
                  with finishes), with the raw NDJSON reachable in a disclosure
                  and via one-click copy. No store reads, no new data source. */}
              <RuntimeTimelinePane />
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
        </main>
        </PaneBoundary>

        {/* W312 C4 · 311 §6 #1 + §3: the right sidebar. On `lg`+ this is the
            static third column (same content, byte-identical controls). Below
            `lg` it is a slide-over drawer, CLOSED by default — the old
            always-inline stack was the measured ~7 300px-tall phone page. The
            mobile-only "Sidebar" button in the action bar opens it; Escape, the
            backdrop, or the in-drawer Close button dismiss it. Nothing in the
            sidebar was removed or moved out of reach. */}
        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close the sidebar"
            className="fixed inset-0 z-40 bg-bg/70 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        {/* R6-f12: the sidebar is its own pane (gate health, shell surfaces,
            diagnostics) — a render throw here must not unmount the Run screen. */}
        <PaneBoundary label="Run sidebar">
        <aside
          id="run-sidebar"
          className={
            sidebarOpen
              ? "fixed inset-y-0 right-0 z-40 w-[300px] max-w-[86vw] overflow-y-auto border-l border-line bg-surface px-4 py-4 lg:static lg:z-auto lg:w-auto lg:max-w-none lg:overflow-visible lg:border-l-0"
              : "hidden bg-surface px-4 py-4 lg:block"
          }
        >
          {sidebarOpen ? (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/40 lg:hidden"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Close
            </button>
          ) : null}
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
                <p className="font-mono text-xs text-faint">
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
                    <p className="font-mono text-xs leading-relaxed">
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
                      <p className="mt-0.5 font-mono text-xs text-faint">{clip60(d.note)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <GateHealthCard project={project} />

          {/* W36 N3: the additive read-only shell surfaces (plan · checkpoint/
              resume · unattended · stream · cassette · seat · isolation).
              Text-only rows — no control added, moved or removed; see
              ShellSurfacesCard's doc for the per-row truth sources. */}
          <ShellSurfacesCard project={project} />

          <h2 className="mt-8 text-xs font-medium tracking-wide text-muted uppercase">Diagnostics</h2>
          <ol className="scroll-thin mt-3 max-h-[38vh] space-y-2 overflow-y-auto pr-1 font-mono text-xs leading-relaxed text-muted">
            {project.logs.slice(-10).reverse().map((l, i) => (
              <li key={`${l.ts}-${i}`}>
                <span className="text-faint">{l.event}</span>
                <span className="text-fg/80"> {l.detail}</span>
              </li>
            ))}
          </ol>
        </aside>
        </PaneBoundary>
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
      {/* 216m · 111 TASK-10: the command palette — mounted additively as the last
          child of the screen root, so no existing layout node changes. Its open
          state is owned above; the global key handler suspends single-key (and
          mod-chord) shortcuts while it is open (paletteOpenRef gate). Ctrl+K
          opens it; Escape / click-outside close it via its Radix dialog. */}
      <CmdPalette open={paletteOpen} onOpenChange={setPaletteOpen} entries={paletteEntries} />
    </div>
  );
}

/** Compact 13-segment progress rail (P0–P12): done / current / upcoming from project.phases.
 *
 *  W312 C4 (311 §6 #4): this rail is now the ONE clickable strip — the P0–P12
 *  copy that `PipelineRail` duplicated right below it is gone (its counter too),
 *  and each segment here opens the shared `pipeline-rail-detail` panel (`openPhase`
 *  is owned by RunScreen so both mounts read the same state).
 *
 *  311 §2 ("color-only status encodings get a text/icon twin"): each segment's
 *  status was previously carried by the fill color + the `rail-lbl-*` tint
 *  alone for sighted users. Exceptional states now also render a visible glyph
 *  (✓ complete · ✕ rejected/blocked · ! awaiting approval) and the full status
 *  word stays in the button's aria-label + title. */
function PhaseProgressRail({
  project,
  openPhase,
  onTogglePhase,
}: {
  project: Project;
  openPhase: PhaseId | null;
  onTogglePhase: (phase: PhaseId) => void;
}) {
  const done = project.phases.filter((r) => r.status === "complete").length;
  const total = PHASES.length;
  const pct = Math.round((done / total) * 100);
  // 111 TASK-04 / T-20: this component computed a status word for every one of
  // the 13 segments and then hid it in `title=`/`aria-label=` (invisible to a
  // sighted, mouse-less user). The words below are visible text, and the
  // segment labels are raised above the old 9px.
  const currentRec = project.phases.find((r) => r.id === project.currentPhase);
  const currentWord =
    project.status === "blocked"
      ? "Blocked — review the notes"
      : currentRec
        ? PHASE_STATUS_META[currentRec.status].label
        : "Not started yet";
  const currentTone =
    project.status === "blocked"
      ? "text-danger"
      : currentRec
        ? PHASE_STATUS_META[currentRec.status].tone
        : "text-faint";
  const attention = PHASES.flatMap((p) => {
    const rec = project.phases.find((r) => r.id === p.id);
    const st = rec?.status ?? "locked";
    if (st === "rejected" || st === "awaiting_hitl") {
      return [{ code: p.code, word: PHASE_STATUS_META[st].label }];
    }
    if (project.status === "blocked" && p.id === project.currentPhase) {
      return [{ code: p.code, word: "Blocked" }];
    }
    return [];
  });
  return (
    <section aria-label="Phase progress" className="border-b border-line px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs font-medium tracking-widest text-faint uppercase">
          Phase graph
        </p>
        <p className="font-mono text-xs text-faint tabular-nums">
          {done}/{total} sealed · {pct}%
        </p>
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-faint">Now:</span>
        <span className={`font-medium ${currentTone}`}>
          {PHASE_BY_ID.get(project.currentPhase)?.code ?? `P${project.currentPhase}`} · {currentWord}
        </span>
      </p>
      {attention.length ? (
        <p className="mt-1 font-mono text-xs leading-relaxed text-warn">
          Needs you: {attention.map((a) => `${a.code} ${a.word}`).join(" · ")}
        </p>
      ) : null}
      <ol className="mt-2 flex gap-1" aria-label="Phase rail P0 to P12 — activate a phase for detail">
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
          // Text/icon twin for the color fill (311 §2). Only the exceptional
          // states mark up — complete ✓, rejected ✕, awaiting !, blocked ✕ —
          // so the strip stays calm; the full word is in aria-label/title.
          const marker =
            status === "complete"
              ? "✓"
              : status === "rejected" || (isCurrent && project.status === "blocked")
                ? "✕"
                : status === "awaiting_hitl"
                  ? "!"
                  : null;
          const open = openPhase === p.id;
          return (
            <li key={p.id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onTogglePhase(p.id)}
                aria-expanded={open}
                aria-controls={open ? "pipeline-rail-detail" : undefined}
                aria-label={`${p.code} · ${p.title} · ${label} — ${open ? "hide" : "show"} detail`}
                title={`${p.code} · ${p.title} · ${label}`}
                className="block w-full rounded-sm focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <span
                  aria-hidden="true"
                  className={`rail-seg block h-2 w-full rounded-full ${tone} ${isCurrent ? "rail-current" : ""}`}
                />
                <span
                  className={`rail-lbl ${lblTone} mt-1 block truncate text-center font-mono text-xs leading-none text-faint`}
                >
                  {p.code}
                  {marker !== null ? (
                    <span aria-hidden="true" className="ml-0.5">
                      {marker}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
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
    <nav className="min-w-0 border-b border-line lg:border-r lg:border-b-0" aria-label="Phases">
      {/* W312 D4 · 311 §6 #1 completion (measured): the strip below `lg` is a
          horizontal scroller, but this nav is a GRID ITEM and kept its
          automatic min-content minimum — 13 `min-w-[148px]` cards with
          `truncate` titles — blowing the single mobile column out to ~2 955px
          and cutting every center-column line off-screen at 390px (probe:
          docScrollWidth 2955; instrumented `min-width: 0` on this nav → 390,
          the scroller then scrolls its 2 044px of cards inside the viewport).
          `min-w-0` lets the item shrink to the track; `lg` columns unchanged. */}
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
                <span className={`block font-mono text-xs ${meta.tone}`}>
                  {p.code}
                  {p.hitl ? (
                    <>
                      {" · "}
                      <Term k="hitl" focusable={false}>
                        HITL
                      </Term>
                    </>
                  ) : (
                    ""
                  )}
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
          {/* DF-18 (W16 lane 3): the packet carries this caveat verbatim at
              packet.ts:498 — the UI had dropped it, so the headline number read
              as live research. Mirrored exact wording, never paraphrased softer
              ("template-derived, not live research" is the force of the line). */}
          <p className="mt-1 font-mono text-xs leading-snug text-warn">
            (deterministic feasibility estimate — template-derived, not live research)
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {sc.axes.map((a) => (
          <div key={a.key} className="rounded-md border border-border bg-raised px-3 py-3">
            <p className="text-xs text-muted">{a.label}</p>
            <p className="mt-1 font-mono text-lg tabular-nums">{a.score}</p>
            <p className="mt-1 text-xs leading-snug text-faint">{a.note}</p>
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
                      className={`inline-flex items-center whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-mono text-2xs ${
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
  rejectBusy,
  noteRef,
  overrideRef,
}: {
  project: Project;
  note: string;
  setNote: (v: string) => void;
  onApprove: (force?: boolean) => void;
  onReject: () => void;
  /** K5-2 (fixes/294/295): a rejection is in flight (rejectAsync awaited) —
   *  the button reports pending instead of looking idle. */
  rejectBusy?: boolean;
  noteRef?: RefObject<HTMLTextAreaElement | null>;
  overrideRef?: RefObject<HTMLInputElement | null>;
}) {
  const [forceOverride, setForceOverride] = useState(false);
  const h = project.hitl;
  if (!h) return null;
  const evidence = evidenceForGate(project);
  // A02 (deep-audit-01): a failed P6 sandbox is human-only (forceHuman) — the
  // operator must explicitly tick the override before Approve can pass (mirrors
  // store.ts's guard). Single-sourced with the status panel above so the two
  // can never disagree about when the override is required (111 TASK-02).
  const needsOverride = hitlNeedsOverride(project);
  // E-21: when autopilot parked on this gate because the DoD gate denied its
  // approval (E-20 logs autopilot.gate_denied with the unmet criteria), show
  // the machine-readable reason under the dock instead of a bare "waiting".
  const denial = latestAutopilotDenial(project);
  // F4 (fixes/252 LANE 2): the per-action allow-list narrows THIS decision
  // before any click can pass — an off-list action is refused with its OWN
  // code (never a generic error). A build with no list is byte-unchanged.
  const gateAction = forceOverride ? "hitl.force" : "hitl.approve";
  const allowListRefusal = policyOverlayRefusal(policyAllowListsOf(project), gateAction, `gate:P${project.currentPhase}`);
  return (
    <div className="border-b border-line bg-raised px-5 py-5">
      <p className="font-mono text-xs text-warn">
        <Term k="hitl">HITL</Term> · {h.stakes}
      </p>
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
                className={`font-mono text-xs leading-relaxed ${
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
        className={`mt-1 font-mono text-xs ${
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
          {/* 311 §2 (unnamed control #2): explicit accessible name — the probe
              measured none for the wrapped-label form. */}
          <input
            ref={overrideRef}
            id="hitl-override"
            type="checkbox"
            checked={forceOverride}
            onChange={(e) => setForceOverride(e.target.checked)}
            aria-labelledby="hitl-override-label"
            className="mt-0.5 h-4 w-4"
          />
          <span id="hitl-override-label">
            I reviewed the failing bounded-runner output and approve anyway.
          </span>
        </label>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onApprove(forceOverride)}
          disabled={(needsOverride && !forceOverride) || allowListRefusal !== null}
          aria-label={
            allowListRefusal
              ? `Approve disabled — ${allowListRefusal.code} refuses ${gateAction} for this build`
              : undefined
          }
          className="btn-solid inline-flex min-h-11 items-center gap-2 rounded-md bg-fg px-4 text-sm font-medium text-bg disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Approve
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={note.trim().length < 12 || rejectBusy === true}
          aria-label={
            rejectBusy === true
              ? "Rejecting — the rejection is being recorded"
              : note.trim().length < 12
                ? "Reject disabled — the rejection note must be at least 12 characters"
                : "Reject this phase with the note above"
          }
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-danger/40 px-4 text-sm text-danger disabled:opacity-40"
        >
          {rejectBusy === true ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <X className="h-4 w-4" />
          )}
          {rejectBusy === true ? "Rejecting…" : "Reject"}
        </button>
        <span className="sr-only" aria-live="polite">
          {rejectBusy === true
            ? "Rejecting — waiting for the store to record the rejection"
            : note.trim().length < 12
              ? "Reject disabled — note must be at least 12 characters"
              : "Reject enabled"}
        </span>
      </div>
      {allowListRefusal ? (
        <p
          role="status"
          className="mt-3 rounded-md border border-danger/40 bg-raised px-3 py-2 font-mono text-xs leading-relaxed text-danger"
        >
          {allowListRefusal.code}
          <span className="mt-0.5 block text-faint">
            {allowListRefusal.detail}{" · "}
            {allowListRefusal.fallback === "human-seat-token"
              ? "fallback: a human seat presenting the out-of-band token"
              : allowListRefusal.fallback === "autopilot-seat"
                ? "fallback: claim the autopilot seat"
                : "fallback: none — the request or the build's list must change"}
          </span>
        </p>
      ) : null}
      {denial ? (
        <p
          role="status"
          className="mt-3 rounded-md border border-warn/30 bg-raised px-3 py-2 font-mono text-xs leading-relaxed text-warn"
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
      <p className="font-mono text-xs text-warn">
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
  /** Empty-state content: a sentence, or (111 TASK-08) a richer
   *  status + learnability + pathway block. The generic fallback below stays
   *  for call sites that pass nothing. */
  empty?: ReactNode;
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
              <span className="block font-mono text-xs text-faint">
                P{a.phase} · {a.kind}
              </span>
              {a.title}
            </button>
          </li>
        ))}
      </ul>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <p className="truncate font-mono text-xs text-muted">
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
            className="pt-1 font-mono text-xs font-medium text-fg/80 first:pt-0"
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
              <p className="border-b border-line px-2 py-1 font-mono text-2xs tracking-wide text-faint uppercase">
                {b.lang}
              </p>
            ) : null}
            <pre className="scroll-thin max-h-[420px] overflow-auto px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-fg/90">
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
        <span className="mt-0.5 block truncate font-mono text-xs text-faint">
          {noteKindCaption(note)}
        </span>
      </button>
    </li>
  );
}

/** Group header <li> inside the navigator list (mono, muted — mirrors aside h2 styling). */
function VaultGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <li className="px-4 pt-3 pb-1 font-mono text-2xs font-medium tracking-wide text-faint uppercase">
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
  // Store-wide project count for the diagnose growth surface (K7-6/G4).
  // READ-ONLY here: the store array is sampled for its honest length only.
  const { projects } = useRapid();
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
      // K7-6 (fixes/287_z3 + 290_k7 item 6): real growth counts. Without this
      // producer the payload's growth.counts read `{}` while rt-client.ts's
      // ClientDiagnosisInput doc promises "Growth counts from the store
      // (artifacts/memory/decisions/projects)" — declare-or-strike: the claim
      // is now true (this project's arrays + the store's project count).
      // Defensive lengths: a legacy/hand-built payload reports 0, never throws.
      const counts: Record<string, number> = {
        artifacts: Array.isArray(project.artifacts) ? project.artifacts.length : 0,
        memory: Array.isArray(project.memory) ? project.memory.length : 0,
        decisions: Array.isArray(project.decisions) ? project.decisions.length : 0,
        projects: Array.isArray(projects) ? projects.length : 0,
      };
      const d = buildClientDiagnosis({
        project: project as unknown as never,
        persistHealth,
        counts,
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
        <>
          {/* T-17 (110 §4 CP-2/CP-7): one plain-language sentence above the raw
              payload — what the blob is, and that it never leaves the browser. */}
          <p className="max-w-2xl text-muted">
            Support snapshot for this build — counters, the last runtime events, and browser-storage
            health, in raw JSON (the same fields the CLI{" "}
            <span className="font-mono">diagnose</span> verb prints). Nothing is uploaded — this
            panel reads only what is already in this browser.
          </p>
          {/* 311 §6 #6 (W312 C4): `bg-black/20` wells render as grey patches on
              white in light theme; `bg-overlay/40` resolves through the token. */}
          <pre className="max-h-96 overflow-auto rounded-md border border-line bg-overlay/40 p-3 font-mono text-xs text-fg">
          {diag}
          </pre>
        </>
      ) : null}

      {snap.tail.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-muted">
          No events yet — the ring fills when something crashes, a listener throws, persistence
          fails, or a wild step stalls. Honest silence, not a broken tab.
        </p>
      ) : (
        /* 311 §2 (W312 C4 · top a11y violation): the ring feed is the console's
           live wire — it was silent for screen readers (probe: ariaLiveCount 0
           on the run screen). It is now a polite live region; `aria-relevant`
           defaults to additions/text, so new rows narrate as they land. */
        <ul
          role="log"
          aria-live="polite"
          aria-label="Runtime telemetry ring rows"
          className="flex flex-col gap-1.5"
        >
          {snap.tail.map((row, i) => (
            <li
              key={`${row.ts}-${i}`}
              className="flex flex-col gap-0.5 rounded-md border border-line bg-overlay/40 px-3 py-2"
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
              <span className="font-mono text-xs text-muted">{row.capture}</span>
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
        const bucket = byKind.get(n.kind);
        if (bucket) bucket.push(n);
        else {
          byKind.set(n.kind, [n]);
          order.push(n.kind);
        }
      }
    }
    return { hub, kinds: order.map((k) => ({ kind: k, notes: byKind.get(k) ?? [] })) };
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
          role="group"
          className="flex flex-wrap items-center gap-1.5 px-5 pt-2"
          aria-label="Filter vault notes by tag"
        >
          {tagCounts.map(([t, count]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(tag === t ? null : t)}
              aria-pressed={tag === t}
              className={`rounded-sm border px-2 py-1 font-mono text-2xs ${
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
                  <p className="min-w-0 truncate font-mono text-xs text-muted">
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
                    <span className="font-mono text-xs text-faint">links:</span>
                    {linksOut.map((b) => (
                      <button
                        key={b.title}
                        type="button"
                        onClick={() => openNote(b.title)}
                        className="rounded-sm border border-border px-2 py-1 font-mono text-2xs text-accent hover:border-accent/40"
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
                    <p className="font-mono text-xs text-faint">
                      tags: {active.tags.join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="border-t border-line px-4 py-3">
                  <p className="font-mono text-2xs font-medium tracking-wide text-muted uppercase">
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
                            className="rounded-sm border border-border px-2 py-1 font-mono text-2xs text-accent hover:border-accent/40"
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
      <p className="px-5 pt-2 font-mono text-xs text-faint">
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
              <h3 className="font-mono text-2xs font-medium tracking-widest text-muted uppercase">
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
                      <span className="mt-1.5 block truncate font-mono text-xs text-fg/80">
                        {shortTokenName(s.name)}
                      </span>
                      <span className="block truncate font-mono text-xs text-faint">{s.value}</span>
                      {copiedToken === s.name ? (
                        <span className="mt-1 flex items-center gap-1 font-mono text-xs text-ok">
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
              <h3 className="font-mono text-2xs font-medium tracking-widest text-muted uppercase">
                Type scale · {view.sizes.length}
              </h3>
              <div className="mt-2">
                {view.sizes.map((s) => {
                  const size = cssLengthOf(s.value);
                  return (
                    <div key={`${s.name}-${s.value}`} className="border-b border-line py-2 last:border-0">
                      <p className="font-mono text-xs text-faint">
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
              <h3 className="font-mono text-2xs font-medium tracking-widest text-muted uppercase">
                Fonts · {view.fonts.length}
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {view.fonts.map((s) => {
                  const stack = safeCssValue(s.value);
                  return (
                    <div key={`${s.name}-${s.value}`} className="rounded-md border border-border bg-raised px-3 py-2">
                      <p className="font-mono text-xs text-faint">
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
              <h3 className="font-mono text-2xs font-medium tracking-widest text-muted uppercase">
                Spacing · {view.spacing.length}
              </h3>
              <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
                {view.spacing.map((s) => {
                  const w = pxOf(s.value);
                  return (
                    <div key={`${s.name}-${s.value}`} className="min-w-0">
                      <p className="font-mono text-xs text-faint">
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
              <h3 className="font-mono text-2xs font-medium tracking-widest text-muted uppercase">
                Radius · {view.radius.length}
              </h3>
              <div className="mt-2 flex flex-wrap items-end gap-4">
                {view.radius.map((s) => {
                  const rx = cssLengthOf(s.value);
                  return (
                    <div key={`${s.name}-${s.value}`} className="min-w-0">
                      <p className="font-mono text-xs text-faint">
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
              <h3 className="font-mono text-2xs font-medium tracking-widest text-muted uppercase">
                Shadows · {view.shadows.length}
              </h3>
              <div className="mt-2 flex flex-wrap items-end gap-4">
                {view.shadows.map((s) => {
                  const shadow = safeCssValue(s.value);
                  return (
                    <div key={`${s.name}-${s.value}`} className="min-w-0">
                      <p className="font-mono text-xs text-faint">
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
      <p className="px-5 pt-2 font-mono text-xs text-faint">
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
      <p className="px-5 pt-2 font-mono text-xs text-faint">{active.hint}</p>

      {error ? (
        <p role="alert" className="px-5 pt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="px-5 py-4">
        {svgText ? (
          <div
            role="group"
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
 * C1 (332-5) — key VALIDITY, not presence. The server probe behind the header
 * chip reports only whether a key EXISTS (`configured`), so a rejected key
 * still reads "configured" and the operator learns the truth only when a keyed
 * action fails. The console can see the last keyed-call OUTCOME CLASS from the
 * sources it owns: the persisted chat thread (`RT_E_*` rows `chatOnce` writes)
 * and this screen's own crew result. The chip renders that class when it is a
 * key failure; the provider's note is tail-only by construction, and a full key
 * is never rendered.
 */
type KeyedOutcome = {
  ok: boolean;
  code: string | null;
  note: string;
  at: number;
  /** What `note` is: the provider's own error text, or a tail-only key-source
   *  label (the server probe carries no message, only the source). */
  noteKind?: "error" | "source";
};

/** Codes that mean the key is present but unusable — a validity fault, not
 *  absence (the presence axis stays the server probe's `configured`). Shared
 *  with the store so the chip and the run surface name the same class. */

/** The newest keyed-chat outcome in the persisted thread, or null when the
 *  thread holds no keyed turn. The newest assistant row IS the last outcome. */
function lastChatKeyedOutcome(rows: ChatLogRow[] | undefined | null): KeyedOutcome | null {
  if (!Array.isArray(rows)) return null;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const r = rows[i];
    if (!r || r.role !== "assistant") continue;
    const code = typeof r.code === "string" && /^RT_E_[A-Z0-9_]+$/.test(r.code) ? r.code : null;
    return {
      ok: r.error !== true && code === null,
      code: r.error === true ? code : null,
      note: typeof r.text === "string" ? r.text : "",
      at: typeof r.ts === "number" && Number.isFinite(r.ts) ? r.ts : 0,
      noteKind: "error",
    };
  }
  return null;
}

/** The later of two keyed outcomes (null-safe) — the last one wins. */
function laterKeyedOutcome(a: KeyedOutcome | null, b: KeyedOutcome | null): KeyedOutcome | null {
  if (!a) return b;
  if (!b) return a;
  return b.at >= a.at ? b : a;
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
                  role="img"
                  title={doc ? doc.agentAction : "Uncatalogued error code"}
                  aria-label={
                    doc
                      ? `Error ${msg.code}: ${doc.meaning}. ${doc.agentAction}`
                      : `Error ${msg.code}: uncatalogued`
                  }
                  className={`rt-badge inline-block rounded-sm border px-1.5 py-0.5 font-mono text-2xs ${badgeClass}`}
                >
                  {msg.code}
                </span>
                {doc ? (
                  <span className="font-mono text-xs text-faint">{doc.meaning}</span>
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
                className="mt-2 rounded-sm border border-border px-2 py-1 font-mono text-2xs text-muted hover:text-fg"
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
            : codedFailureText(res.error ?? "verify failed", res.code),
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
          <p className="font-mono text-xs text-accent">
            lastTest · {ltLabel ? (LAST_TEST_LABEL_TEXT[ltLabel] ?? `test (${ltLabel})`) : "untagged"} ·{" "}
            {lt.ok ? "passed" : "failed"}
            {hash ? ` · hash ${hash}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">{lt.detail}</p>
        </div>
      ) : null}
      {verifyArtifacts.map((a) => (
        <div key={a.id} className="rounded-md border border-border px-3 py-3">
          <p className="font-mono text-xs text-accent">{a.title}</p>
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
  const { llmStatus, autopilot, appendChatRows, refreshStatuses } = useRapid();
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
  // K5-1 (N3/K5, fixes/294): count the rows chatLogToViews actually RESTORED
  // into the visible window (trimTurns keeps ≤12) — counting the raw persisted
  // chatLog (≤40) made the caption claim rows that are not on screen.
  const [restoredRows] = useState<number>(() => msgs.length);
  // Raw persisted length (≤ the 40-row storage cap) — only used by the caption
  // to EXPLAIN the window when it is shorter, never to overstate what is shown.
  const [persistedRows] = useState<number>(() =>
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
      // C1 (332-5): refresh the server probe's last-keyed record (live key
      // validity) — a cheap server fn, no provider call, never on render.
      void refreshStatuses();
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
          <p role="status" className="font-mono text-xs text-warn">
            No LLM backend — chat is read-only: DEEPSEEK_API_KEY is not set in the
            server .env, so sending is disabled (a send could only fail with
            RT_E_LLM_NOT_CONFIGURED). Set the key and reload to chat against this build.
          </p>
        ) : null}
      </div>
      {restoredRows > 0 ? (
        <p className="px-5 pt-1 font-mono text-xs text-faint">
          Thread restored from this build's log · {restoredRows} row
          {restoredRows === 1 ? "" : "s"}
          {persistedRows > restoredRows
            ? ` shown — the render window keeps the newest 12 of ${persistedRows} stored`
            : ""}
        </p>
      ) : null}
      {staleNote ? (
        <p role="status" className="px-5 pt-1 font-mono text-xs text-warn">
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
            <p className="mt-2 font-mono text-xs text-faint">
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
              <span className="mt-1 block font-mono text-xs text-faint">
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
              className="rounded-sm border border-border px-2 py-1 font-mono text-2xs text-muted hover:text-fg disabled:cursor-default disabled:opacity-40"
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
) =>
  | Promise<{ ok?: boolean; error?: string; code?: string }>
  | { ok?: boolean; error?: string; code?: string };

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
      if (res && res.ok === false) setOutcome(codedFailureText(res.error ?? "deepen failed", res.code));
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
        className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border px-2 text-2xs text-fg hover:border-accent/40 disabled:opacity-40"
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
      className="mt-2 space-y-1.5 rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs leading-relaxed"
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
  const meta =
    PHASE_STATUS_META[rec.status] ?? {
      glyph: null,
      tone: "text-muted",
      label: String(rec.status),
    };
  const arts = project.artifacts.filter((a) => a.phase === phase);
  const active = !arts.length
    ? null
    : (selected ? arts.find((a) => a.id === selected) : undefined) ?? arts[arts.length - 1] ?? null;
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
          {def.hitl ? (
            <>
              {" · "}
              <Term k="hitl">HITL</Term>
            </>
          ) : (
            ""
          )}
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
            <summary className="cursor-pointer font-mono text-xs leading-relaxed select-none">
              <Term k="dod">DoD</Term>{" "}
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
              <li key={d.id} className="font-mono text-xs leading-relaxed">
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
              <li key={`${r.at}-${i}`} className="font-mono text-xs leading-relaxed text-faint">
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
  tone: "ok" | "faint" | "danger";
  title?: string;
}) {
  return (
    <span
      className={`rounded-sm border border-border px-2 py-1 ${
        tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : "text-faint"
      }`}
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
          <span className="font-medium">
            Enforce <Term k="dod">DoD</Term> gates
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            On by default when a DeepSeek key is configured. When on, a machine advance may not
            leave a phase whose <Term k="dod">DoD</Term> gate failed — the run parks instead.
          </span>
        </span>
      </label>
      <p className="mt-2 font-mono text-xs leading-relaxed text-faint">
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
              <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs leading-relaxed text-fg/90">
                {`node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project "${slug}.json" --check`}
              </pre>
            </li>
            <li>
              The scaffold lands in the default output folder{" "}
              <code className="rounded-sm bg-raised px-1 font-mono text-xs">{dir}</code> —{" "}
              <span className="font-mono text-xs">~</span> is your home folder (here:{" "}
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
      <p className={`mt-2 font-mono text-xs leading-relaxed ${tone}`}>
        {label} · {h.n} decisions · {Math.round(h.meanLatencyMs / 1000)}s mean ·{" "}
        {Math.round(h.rejectRate * 100)}% rejects
      </p>
    </div>
  );
}

/** Radix-backed modal shell (overlay + title + Escape/click-outside close).
 *
 *  W312 C4 · 311 §2 (measured violation #3): the hand-rolled shell had no focus
 *  trap, no initial focus and no focus restore, and its full-screen overlay was
 *  a focusable `<button>` — so the first Tab stop was an invisible "Close".
 *  Radix Dialog (already a dependency, already used by the command palette)
 *  supplies the trap, initial focus (the visible Close button), focus restore,
 *  scroll lock and Escape handling, while this shell keeps the exact same
 *  visuals: same panel classes, same `[role="dialog"]` elevation from
 *  styles.css, same close control. The global shortcut guard's
 *  `[role="dialog"][aria-modal="true"]` DOM check keeps working — Radix renders
 *  exactly those attributes. `description` is announced via Dialog.Description
 *  (kept sr-only; the panels' bodies stay byte-identical). */
function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/80" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[80vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-border bg-surface p-5 focus:outline-none">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-base font-medium tracking-tight">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2 text-sm text-muted hover:text-fg"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{description}</Dialog.Description>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
    <Modal open={open} onClose={onClose} title="Settings" description="Where keys live — server-side .env, never the browser.">
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
    <Modal open={open} onClose={onClose} title="Agent guide" description="Condensed AGENT_GUIDE.md content.">
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
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" description="Every single-key and Ctrl chord this screen listens for.">
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

/**
 * W36 N3 — THE HONEST READ-ONLY SHELL SURFACES (plan · checkpoint/resume ·
 * unattended · stream · cassette · seat · isolation).
 *
 * ADDITIVE by construction: every row is text — no control was added, moved or
 * removed, and nothing here can mutate a project. The fixtures-panel doctrine
 * applies: state visible, refusal NAMED, coded reason in `title`; an enabled
 * no-op is never honest, so no no-op control exists below. The only real paths
 * the copy names are ones that exist on disk (the in-session Resume above, the
 * CLI verbs).
 *
 * Truth sources (re-verified on disk for W54 341-4; log `fixes/341_4_console.md`):
 *  - plan — `Project.wildPlan` (types.ts:172-183). The planner + classifier
 *    review are real on the server-side headless/CLI wild path (R13-f02:
 *    `headless.generateWildPlan` → `attachWildPlan` → `stageWildPlan`, which
 *    parks at the `wild.plan_review` row before the first mutation); the
 *    console's store driver (`store.startWildRun`) stages a stored plan through
 *    the SAME `stageWildPlan` seam (engine.ts's one staging site for both real
 *    wild drivers), so a stored planner plan is reviewed and parks before the
 *    first mutation — browser reviewer null ⇒ the honest "not configured"
 *    review row; no stored planner plan stages nothing (staged: false).
 *    `engine.readWildPlan` returns a stored plan when the record carries one,
 *    else the honest empty shape
 *    (`steps: []`, `source: "empty"`, a note naming the row); steps are never
 *    invented.
 *  - checkpoint/resume — `checkpoint.server.ts` is SERVER-ONLY (node:fs; atomic,
 *    corrupt-safe, `RT_E_CHECKPOINT_MISSING` when absent / `RT_E_VALIDATION` on
 *    junk), so the console has no read seam yet: this card shows the
 *    store-level truth it CAN see (the wild run state) + TODO(N2) for the seam.
 *  - unattended — the `unattended` CLI verb is REAL (W36; scheduler-facing
 *    drive). `RT_E_UNATTENDED_UNSUPPORTED` is registered (errors.ts:79/:533)
 *    but has NO throw site today, so the row names the real verb + its real
 *    limits and does not cite the unthrown code as a live refusal (W-47).
 *  - stream — T5.1 shell: one-shot transport, no `--stream`, no console pane.
 *  - cassette — T5.7 340-4: WIRED at the provider seam (`deepseek.ts` /
 *    `openai-compatible.ts`). `RAPIDTOOL_CASSETTE_MODE=record|replay` +
 *    `RAPIDTOOL_CASSETTE_TAPE` arm it; unset/off is inert. No console control
 *    and no run-eval/CLI flags yet.
 *  - seat — S4's `seat.ts` never landed (nothing on disk, no registry code);
 *    the approval dock's policy-fallback text is today's only seat surface.
 *  - isolation — R13-f04: no isolator; the local runner is bounded, NOT an OS
 *    sandbox, and is never labelled one.
 */
function ShellSurfacesCard({ project }: { project: Project }) {
  const run = wildStateOf(project).run;
  // 336-5 wiring: read the plan through the store's DOCUMENTED accessor
  // (store.ts wildPlanFor → engine.readWildPlan). Before this the card read
  // `project.wildPlan` directly, so the store action's own doc ("the console's
  // READ path for the plan-before-execute surface … reads this") named a
  // consumer it did not have. The honest empty fallback (`source: "empty"`) is
  // absence, not a plan, so the card still falls to its absence line — the same
  // rendering as before for every realistic state.
  const wildPlanFor = useRapid((s) => s.wildPlanFor);
  const rawPlan = wildPlanFor(project.id);
  const plan = rawPlan && rawPlan.source !== "empty" && Array.isArray(rawPlan.steps) ? rawPlan : null;
  const stepCount = plan ? plan.steps.length : 0;
  const resumeLine = run
    ? run.active === true
      ? wildPaused(run)
        ? `resume available — paused in-session${
            typeof run.phase === "number" ? ` at P${run.phase}` : ""
          } (Resume above)`
        : "run active — nothing to resume"
      : "run stopped — the wild driver is a session artifact; a reload cannot resume it"
    : "no run on record — nothing to resume";
  return (
    <section aria-label="Shell capability state (read-only)">
      <h2 className="mt-8 text-xs font-medium tracking-wide text-muted uppercase">Shell surfaces</h2>
      <ul className="mt-3 space-y-3">
        <li>
          <p className="text-xs font-medium text-fg">
            Wild plan <span className="text-faint">· R13-f02</span>
          </p>
          {plan ? (
            <>
              <p className="mt-0.5 font-mono text-xs text-muted">
                source: {plan.source} · {stepCount} step(s)
                {typeof plan.plannedAt === "number" ? ` · planned ${agoLabel(plan.plannedAt)}` : ""}
              </p>
              {plan.goal ? <p className="mt-0.5 text-xs text-muted">{clip60(plan.goal)}</p> : null}
              {plan.note ? (
                <p className="mt-0.5 font-mono text-xs text-faint">{clip60(plan.note)}</p>
              ) : null}
            </>
          ) : (
            <p
              className="mt-0.5 text-xs text-muted"
              title="R13-f02: planning + classifier review are real on the server-side headless/CLI wild path (generateWildPlan → attachWildPlan → stageWildPlan, which parks at the wild.plan_review row before the first mutation). The console's store driver (store.startWildRun) stages a stored plan through that SAME stageWildPlan seam — engine.ts's one staging site for both real wild drivers — so a record carrying a planner plan is reviewed and parks at the plan review before the first mutation (the browser reviewer is null, so the row is the honest 'Auto-Review classifier not configured' review); no stored planner plan stages nothing (staged: false, no write). engine.readWildPlan returns the honest empty shape (steps: [], source: 'empty') — steps are never invented."
            >
              no plan on record — the reader finds no planner plan to stage, so a console start
              carries none (plan generation runs on the keyed server-side headless/CLI path, not
              in the browser); when a stored planner plan IS on the record the console driver
              reviews it and parks at the plan review before the first mutation. The reader returns
              an honest empty plan (<span className="font-mono">source: &quot;empty&quot;</span>),
              never invented steps.
            </p>
          )}
        </li>
        <li>
          <p className="text-xs font-medium text-fg">
            Checkpoint · resume <span className="text-faint">· T-107.7</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">{resumeLine}</p>
          <p
            className="mt-0.5 font-mono text-xs text-faint"
            title="N2/T-107.7: readCheckpoint / checkpointAdmits live in checkpoint.server.ts (.rapidtool/checkpoint.json) — server-only, so the console has no read seam yet (TODO(N2)); cross-session resume stays a CLI verb until one lands."
          >
            cross-session resume: checkpoint reads are server-side — no console read seam yet.
          </p>
        </li>
        <li>
          <p className="text-xs font-medium text-fg">
            Unattended runs <span className="text-faint">· W-47</span>
          </p>
          <p
            className="mt-0.5 text-xs text-muted"
            title="W-47: there is no scheduler/daemon/queue in this product. `unattended --project` is the scheduler-facing CLI drive (it re-enters from the run checkpoint when one exists, else starts from the file, and drives autopilot+live until parked). 341-6: it passes machineGates: true, so a stock HITL gate (P4/P5/P8/P9) whose DoD passes is cleared through the ledgered machine actor — only a forceHuman gate or a red DoD gate still parks (exit 2), never a fake completion. The console has no schedule control."
          >
            no in-product scheduler — the CLI <span className="font-mono">unattended</span> verb
            resumes from a checkpoint when an external hook invokes it and clears stock HITL gates
            through the machine actor; only a forceHuman or red DoD gate parks
          </p>
        </li>
        <li>
          <p className="text-xs font-medium text-fg">
            Token streaming <span className="text-faint">· T5.1</span>
          </p>
          <p
            className="mt-0.5 text-xs text-muted"
            title="T5.1: the lib leg landed (chat.ts chatStreamNdjson) but the provider transport is one-shot (stream:false) and the CLI has no --stream arm; no console stream pane exists. Replies render whole — not yet incremental."
          >
            not wired — one-shot transport; replies render whole
          </p>
        </li>
        <li>
          <p className="text-xs font-medium text-fg">
            Cassette record/replay <span className="text-faint">· T5.7</span>
          </p>
          <p
            className="mt-0.5 text-xs text-muted"
            title="T5.7 (340-4): cassette.ts is wired at the provider seam (deepseek.ts / openai-compatible.ts). RAPIDTOOL_CASSETTE_MODE=record|replay plus RAPIDTOOL_CASSETTE_TAPE arms it; unset/off is inert and byte-identical. A replay miss, a tampered tape, or a cross-family tape is a coded refusal with no text, and a replayed call is never marked live. There is no console control and no run-eval/CLI --record/--replay flag yet, so a driver must set the env."
          >
            wired at the provider seam — arm it with{" "}
            <span className="font-mono">RAPIDTOOL_CASSETTE_MODE</span> +{" "}
            <span className="font-mono">RAPIDTOOL_CASSETTE_TAPE</span>; no console control yet
          </p>
        </li>
        <li>
          <p className="text-xs font-medium text-fg">
            Human seat <span className="text-faint">· R8-f09</span>
          </p>
          <p
            className="mt-0.5 text-xs text-muted"
            title="R8-f09: console approvals record decidedBy 'human' with no seat token; the planned seat seam (S4 seat.ts / a delivery code) is not on disk (TODO S4). Today's real seat path is the CLI's out-of-band token; the approval dock names the policy fallback."
          >
            no console delivery seam yet — the CLI carries the out-of-band token.
          </p>
        </li>
        <li>
          <p className="text-xs font-medium text-fg">
            Isolation boundary <span className="text-faint">· R13-f04</span>
          </p>
          <p
            className="mt-0.5 text-xs text-muted"
            title="R13-f04: no isolator is shipped (isolation.server.ts is not on disk) — generated code runs in the bounded local runner, which is NOT an OS sandbox. Never labelled sandboxed; a fake sandbox label is forbidden."
          >
            none — runs are bounded local, not OS-sandboxed.
          </p>
        </li>
      </ul>
    </section>
  );
}
