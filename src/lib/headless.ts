// ---------------------------------------------------------------------------
// headless.ts — file-based headless driver for RapidTool (no browser, no store).
//
// Lets an AI agent drive a RapidTool project end-to-end with no DOM, no
// localStorage, and no Vite server. It is a thin, file-backed orchestration
// layer over the existing PURE engine/io/phases/report-intake exports — it
// IMPORTS those read-only and never mutates them (ownership contract: build
// agent #3 owns this file only).
//
// Run under bare Node (Node 22):
//   node --experimental-strip-types scripts/rapidtool-cli.mjs ...
//   node --experimental-strip-types --test src/lib/headless.test.ts
//
// Live mode (`live: true`) is OPTIONAL and off by default. When on, the live
// branch delegates to engine.liveLayer (E-12: single live implementation for
// artifact/narrative builders) and, when that layer cannot run — under bare
// Node its TanStack server-fn backends always fail — a small direct
// server-module overlay supplies real keyless research (freeWebSearch) plus an
// optional DeepSeek narrative for research phases 0/7/11, layered on the
// deterministic applyPhaseResult exactly like engine.runPhaseAsync does — and
// every failure degrades gracefully back to the deterministic floor (honesty
// contract: never fabricate live output). Deterministic paths make NO network
// calls.
// ---------------------------------------------------------------------------
import {
  applyPhaseResult,
  approveHitl,
  emptyProject,
  inferName,
  liveLayer,
  rejectHitl,
  researchQueryFor,
  sealHonesty,
  stampPacket,
  unlockRetry,
} from "./engine.ts";
import { fnv1a } from "./algorithms.ts";
import { failedGates, hardDodBlockInto, hardDodMessage, recordGateInto, runGate } from "./dod.ts";
import { approvedAcceptanceFixtures } from "./brief-fixtures.ts";
import { runSummaryLesson, templateEmissionLesson } from "./knowledge.ts";
import { exportPacketText, exportProjectJson, importProject, slugName } from "./io.ts";
import { applyReportResult, validateReport, type ReportApplyReason } from "./report-intake.ts";
import { canEnter, phaseDef, priorsSealed, STOCK_HITL } from "./phases.ts";
import { evaluatePolicy, seatLabel } from "./policy.ts";
import { applyWrite, rollback, snapshotPaths } from "./write-set.ts";
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import type { TreeRunOutcome } from "./compile-check.server.ts";
import type {
  ArtifactKind,
  GeneratedTreeFile,
  HitlDecision,
  ModelRoute,
  PhaseId,
  PhaseStatus,
  Project,
} from "./types.ts";

// ---------------------------------------------------------------------------
// File persistence (atomic write via write-then-rename).
// ---------------------------------------------------------------------------

/** Load a project from a JSON file (parse + validate + hydrate via io.importProject). */
export function loadProject(path: string, opts?: { preserveWildRun?: boolean }): Project {
  const raw = readFileSync(path, "utf8");
  const res = importProject(raw, opts);
  if (!res.ok) throw new Error(`loadProject(${path}): ${res.error}`);
  return res.project;
}

/** Persist a project to `path` atomically (write temp file, then rename over target).
 *  174-13: exclusive `.lock` (O_EXCL) so two writers cannot interleave. */
export function saveProject(path: string, project: Project): string {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  const lockPath = `${target}.lock`;
  let fd: number | null = null;
  try {
    fd = openSync(lockPath, "wx");
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
    if (code === "EEXIST") {
      const e = new Error("saveProject: another writer holds the lock");
      (e as Error & { code?: string }).code = "RT_E_BUSY";
      throw e;
    }
    throw err;
  }
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tmp, exportProjectJson(project), "utf8");
    renameSync(tmp, target);
  } catch (err) {
    try {
      if (existsSync(tmp)) rmSync(tmp, { force: true });
    } catch {
      /* best-effort temp cleanup */
    }
    throw err;
  } finally {
    try {
      if (fd !== null) closeSync(fd);
    } catch {
      /* ignore */
    }
    try {
      if (existsSync(lockPath)) unlinkSync(lockPath);
    } catch {
      /* ignore */
    }
  }
  return target;
}

/** B5: ONE writer for the terminal run stamp. Never infers accepted from a red gate. */
export function runAcceptance(
  project: Project,
  status: "accepted" | "failed" | "aborted",
  detail?: string,
): Project {
  const logs = Array.isArray(project.logs) ? project.logs : [];
  return {
    ...project,
    acceptance: status,
    logs: [
      ...logs,
      {
        ts: Date.now(),
        phase: project.currentPhase,
        level: status === "accepted" ? "info" : "error",
        event: `run.${status}`,
        detail: detail ?? status,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Project lifecycle.
// ---------------------------------------------------------------------------

/** Create a fresh project from a brief (emptyProject + inferName). */
export function createProject(input: { brief: string; name?: string; kind?: Project["kind"] }): Project {
  const brief = typeof input?.brief === "string" ? input.brief.trim() : "";
  if (!brief) throw new Error("createProject requires a non-empty brief.");
  const name = typeof input?.name === "string" && input.name.trim() ? input.name.trim() : inferName(brief);
  return emptyProject({ name, brief, ...(input.kind ? { kind: input.kind } : {}) });
}

// ---------------------------------------------------------------------------
// Live research + narrative (optional; only fires when `live: true`).
//
// E-12 (M-10 closure, honest variant): the ENGINE's exported `liveLayer` is the
// single live implementation — artifact/narrative builders, honesty footers and
// the `project.research` corpus shape all live in engine.ts. runPhase's live
// branch therefore delegates to it.
//
// Bare-Node reality check (verified 2026-09-06): engine.liveLayer reaches its
// backends through TanStack server functions (llm.ts / research.ts), which
// throw outside a Start server runtime ("No Start context found in
// AsyncLocalStorage"). Under bare Node — the ONLY host this file-based driver
// runs on — engine.liveLayer therefore ALWAYS resolves to the deterministic
// floor, and a naive full dedup would silently kill the CLI's documented
// `--live` research. Headless keeps the smallest possible remainder below:
// a direct server-module research overlay (tavily/websearch/deepseek are plain
// fetch modules) that runs ONLY when the engine layer added no live content
// (research corpus entry or narrative artifact) for a research phase.
// ---------------------------------------------------------------------------

type ResearchItem = { title: string; url: string; content?: string; score?: number };

/** Phases whose artifacts can be upgraded from illustrative to real research. */
const RESEARCH_PHASES: ReadonlySet<PhaseId> = new Set([0, 7, 11]);

/**
 * Bare-node research overlay (E-12): real keyless web search (Tavily when
 * configured, else DuckDuckGo/SearXNG/Wikipedia) + an optional DeepSeek phase
 * narrative, layered over the deterministic result `project` already carries.
 * Queries come from engine.ts's exported `researchQueryFor` (single-sourced in
 * fixes/128_x6 — no private mirror, so the corpus entries this overlay writes
 * are byte-identical to the engine's). Returns `project` unchanged when
 * nothing live succeeded — never throws, never fabricates.
 */
async function bareNodeLiveOverlay(project: Project, phase: PhaseId): Promise<Project> {
  let items: ResearchItem[] = [];
  let cited = false;
  let provider: string | null = null;
  let narrative: string | null = null;

  // 1) Real web research — Tavily when keyed, else the free keyless fallback.
  try {
    const { tavilySearch, isTavilyConfigured } = await import("./tavily.server.ts");
    const { freeWebSearch } = await import("./websearch.server.ts");
    const query = researchQueryFor(project, phase);
    const result = isTavilyConfigured() ? await tavilySearch(query) : await freeWebSearch(query);
    if (result && result.ok === true && (result.items?.length ?? 0) > 0) {
      items = result.items as ResearchItem[];
      cited = true;
      // M-10 drift fix: remember which backend actually served the findings
      // (the engine's corpus entries carry `provider`; headless's must too).
      provider =
        typeof (result as { provider?: unknown }).provider === "string"
          ? ((result as { provider?: string }).provider as string)
          : null;
    }
  } catch {
    /* research unavailable → items stay empty, not cited */
  }

  // 2) LLM phase narrative — fires whenever DeepSeek is configured, independent
  // of whether live research succeeded.
  try {
    const { completeDeepSeek, isDeepSeekConfigured } = await import("./deepseek.server.ts");
    if (isDeepSeekConfigured()) {
      const ground =
        items.length > 0
          ? `Grounded in these findings:\n${items
              .slice(0, 5)
              .map((it) => `- ${it.title}: ${(it.content ?? "").slice(0, 200)}`)
              .join("\n")}`
          : "(no live research available — reason from the brief and lattice only)";
      const comp = await completeDeepSeek(
        `Write a concise one-paragraph phase narrative for ${project.name} (${phaseDef(phase).code} ${phaseDef(phase).title}). ${ground}\n\nBrief: ${project.brief.slice(0, 400)}`,
      );
      if (comp && comp.ok === true && typeof comp.text === "string" && comp.text.trim()) {
        narrative = comp.text.trim();
      }
    }
  } catch {
    narrative = null;
  }

  if (items.length === 0 && !narrative) return project;

  const now = Date.now();
  const researchArtifacts = items.map((it, i) => ({
    id: `research-${phase}-${i}-${now}`,
    phase,
    kind: "research" as const,
    title: it.title || `Research finding ${i + 1}`,
    body: [`# ${it.title}`, "", (it.content ?? "").trim() || "(no summary)", "", `Source: ${it.url}`].join("\n"),
    language: "markdown",
  }));
  const narrativeArtifacts = narrative
    ? [
        {
          id: `narrative-${phase}-${now}`,
          phase,
          kind: "research" as const,
          title: "Phase narrative (LLM)",
          // M-07: honesty footer — never let generated prose masquerade as fact.
          body: `${narrative}${
            items.length > 0
              ? `\n\n> generated prose — grounded in ${items.length} fetched sources`
              : "\n\n> generated prose — not grounded in fetched sources; verify before relying on it"
          }`,
          language: "markdown",
        },
      ]
    : [];

  // 99 §6 (fixes/128_x6): under bare Node engine.liveLayer's server-fn
  // research seam always fails, so it stamps meta.liveUnavailable=true right
  // before this overlay runs — real findings landing HERE must clear that
  // explained dead-end flag (it must never coexist with a corpus that
  // landed), and a real DeepSeek narrative must stamp the honest route
  // (E-14) that the engine's server-fn path cannot.
  const meta = { ...(project.meta ?? {}) };
  let metaChanged = false;
  if (cited && meta.liveUnavailable === true) {
    delete meta.liveUnavailable;
    metaChanged = true;
  }
  const route: ModelRoute =
    narrative &&
    project.modelRoute !== "deepseek-pro" &&
    project.modelRoute !== "deepseek-flash"
      ? "deepseek-flash"
      : project.modelRoute;

  return {
    ...project,
    ...(metaChanged ? { meta } : {}),
    ...(narrative && route !== project.modelRoute ? { modelRoute: route } : {}),
    // M-01: real findings live in the research corpus; template competitor
    // rows stay "illustrative" (never bulk-promoted to "cited").
    research: cited
      ? [
          ...(project.research ?? []),
          {
            query: researchQueryFor(project, phase),
            provider: provider ?? undefined,
            items: items.map((it) => ({
              title: it.title,
              url: it.url,
              content: it.content ?? "",
            })),
          },
        ]
      : project.research,
    artifacts: [...(project.artifacts ?? []), ...researchArtifacts, ...narrativeArtifacts],
  };
}

/** Synthesize a single phase. `live` adds best-effort research/narrative; any
 *  failure (invalid phase, network, backend) degrades to the deterministic
 *  applyPhaseResult. Never throws. */
export async function runPhase(
  project: Project,
  phase: PhaseId,
  opts: { live?: boolean } = {},
): Promise<Project> {
  if (!Number.isInteger(phase) || phase < 0 || phase > 12) return project;
  try {
    if (!opts.live) return applyPhaseResult(project, phase);
    // E-12: delegate to the engine's liveLayer (single live implementation).
    const viaEngine = await liveLayer(project, phase);
    // Detect whether the engine layer actually produced live content. Under
    // bare Node its server-fn backends always fail, so viaEngine is identical
    // to the deterministic floor and the overlay below must supply the live
    // research the CLI's `--live` promises.
    const floor = applyPhaseResult(project, phase);
    const engineDidLive =
      viaEngine.artifacts.length > floor.artifacts.length ||
      (viaEngine.research?.length ?? 0) > (floor.research?.length ?? 0);
    if (engineDidLive || !RESEARCH_PHASES.has(phase)) return viaEngine;
    return bareNodeLiveOverlay(viaEngine, phase);
  } catch {
    return applyPhaseResult(project, phase);
  }
}

// ---------------------------------------------------------------------------
// Advance loop (store.advanceOnce parity: priorsSealed + canEnter +
// applyPhaseResult + approveHitl-when-autopilot, honoring forceHuman).
// ---------------------------------------------------------------------------

/** Mirror of store.canAutopilot: autopilot never self-approves a human-only
 *  gate (failed P6 sandbox / reframe), a stock HITL phase, a tight schedule —
 *  or a phase that fails its own DoD criteria (M-09). */
function canAutopilot(project: Project, enabled: boolean): boolean {
  if (!enabled || !project.hitl) return false;
  if (project.hitl.forceHuman) return false;
  if ((STOCK_HITL as readonly number[]).includes(project.hitl.phase)) return false;
  // M-09 (F-05 closure): autopilot must not approve a phase that fails its own
  // DoD criteria (store.canAutopilot parity). The check is scoped to gates the
  // phase genuinely RAN to reach (PhaseRecord.startedAt is set by runReady):
  // fabricated/imported awaiting states with no run trace are not real gates,
  // and treating them as DoD-verdictable would block approvals no real flow
  // can produce. Every CLI/store-produced gate has startedAt, so real runs
  // get the full store policy.
  const rec = project.phases.find((p) => p.id === project.hitl!.phase);
  if (rec?.startedAt != null && !runGate(project, project.hitl!.phase).pass) return false;
  return (project.schedule?.tightness ?? 10) < 7.2;
}

/**
 * E-20 parity (headless): when autopilot is ON but the parked gate's DoD is
 * unmet, append the machine-readable denial log the store writes
 * (`autopilot.gate_denied`, warn, unmet ids) — the old headless code parked on
 * "Waiting on human approval." with no trail at all. forceHuman and stock
 * gates are excluded: their denials are POLICY (human-only by design), not DoD
 * failures, so no DoD log is minted for them. Returns null when nothing should
 * be logged (gate passes / no gate / policy denial / gate never ran).
 */
function deniedGateLog(project: Project): Project | null {
  const gate = project.hitl;
  if (!gate || gate.forceHuman || (STOCK_HITL as readonly number[]).includes(gate.phase)) return null;
  const rec = project.phases.find((p) => p.id === gate.phase);
  if (!rec || rec.startedAt == null) return null; // not a gate a real run opened
  const r = runGate(project, gate.phase);
  if (r.pass) return null;
  return {
    ...project,
    logs: [
      ...(project.logs ?? []),
      {
        ts: Date.now(),
        phase: gate.phase,
        level: "warn" as const,
        event: "autopilot.gate_denied",
        detail: `P${gate.phase} unmet: ${r.unmet.map((g) => g.id).join(", ")}`,
      },
    ].slice(-200),
  };
}

function advanceTo(project: Project, next: PhaseId): Project {
  return {
    ...project,
    currentPhase: next,
    phases: project.phases.map((r) => (r.id === next ? { ...r, status: "ready" as const } : r)),
  };
}

async function runReady(
  project: Project,
  phase: PhaseId,
  autopilot: boolean,
  live: boolean,
): Promise<{ project: Project; stopped: boolean; error?: string; dodBlocked?: boolean }> {
  if (!priorsSealed(project.phases, phase)) {
    return { project, error: `Cannot enter P${phase} — prior phases are not sealed.`, stopped: true };
  }
  const running: Project = {
    ...project,
    currentPhase: phase,
    phases: project.phases.map((r) =>
      r.id === phase ? { ...r, status: "running" as const, startedAt: Date.now() } : r,
    ),
    status: "running" as const,
  };
  const updated = await runPhase(running, phase, { live });
  return finishPhase(updated, phase, autopilot);
}

function finishPhase(
  updated: Project,
  phase: PhaseId,
  autopilot: boolean,
): { project: Project; stopped: boolean; error?: string; dodBlocked?: boolean } {
  let p = updated;
  // E-02 (DoD gate parity with store.finishPhase): record the machine-checkable
  // verdict for every phase that completed during synthesis — deterministic
  // phases never pass through approveHitl (the only engine path that recorded a
  // gate before), so without this their PhaseRecord.gate stayed null and no
  // gate artifact existed. recordGateInto no-ops while the phase is still
  // awaiting_hitl (the record is only complete after approval).
  p = recordGateInto(p, phase);
  if (p.status === "blocked") return { project: p, stopped: true };
  if (p.status !== "awaiting_hitl" && phase < 12) {
    // T0.4 (fixes/162): store.finishPhase refuses to LEAVE when enforceDod
    // and the just-recorded gate is red. Headless used to auto-advance past
    // the P10 hard gate — rapidtool run/gate and run-eval silently skipped it.
    if (p.enforceDod === true) {
      const r = runGate(p, phase);
      if (!r.pass) {
        return {
          project: hardDodBlockInto(p, phase, r),
          stopped: true,
          error: hardDodMessage(phase, r),
          dodBlocked: true,
        };
      }
    }
    p = advanceTo(p, (phase + 1) as PhaseId);
  }
  p = stampPacket(p);
  if (canAutopilot(p, autopilot)) {
    p = approveHitl(p, { decidedBy: "autopilot" });
    // E-02 (store SWEEP-2 parity): the auto-approval just completed the phase —
    // record its DoD gate now (the call above no-op'd while awaiting_hitl), so
    // the artifact + gate.verdict log exist exactly as for human approvals.
    p = recordGateInto(p, phase);
  }
  return {
    project: p,
    stopped: p.status === "awaiting_hitl" || p.status === "complete" || p.status === "blocked",
  };
}

async function advanceOnce(
  project: Project,
  autopilot: boolean,
  live: boolean,
): Promise<{ project: Project; stopped: boolean; error?: string; dodBlocked?: boolean }> {
  const phase = project.currentPhase;
  const rec = project.phases.find((p) => p.id === phase);
  if (!rec) return { project, error: "Unknown phase.", stopped: true };
  if (project.status === "blocked" && rec.status === "rejected") {
    return { project, error: "Phase rejected — retry with the note applied.", stopped: true };
  }
  if (rec.status === "locked") return { project, error: "Phase is locked.", stopped: true };
  if (rec.status === "awaiting_hitl") {
    if (canAutopilot(project, autopilot)) {
      const approved = approveHitl(project, { decidedBy: "autopilot" });
      // E-02 (store.advanceOnce parity): record the just-approved phase's DoD
      // gate (approveHitl sets PhaseRecord.gate inline but the artifact + log
      // are recordGateInto's).
      return { project: recordGateInto(approved, phase), stopped: false };
    }
    // E-20 parity (headless): when autopilot is ON but the parked gate's DoD
    // is unmet, persist the autopilot.gate_denied trail (same exclusions as
    // the store) and say WHY in the event — the park stays a 0-progress stop.
    if (autopilot) {
      const denied = deniedGateLog(project);
      if (denied) {
        const unmet = runGate(project, phase).unmet.map((g) => g.id).join(", ");
        return {
          project: denied,
          error: `Waiting on human approval — P${phase} DoD unmet (${unmet}).`,
          stopped: true,
        };
      }
    }
    return { project, error: "Waiting on human approval.", stopped: true };
  }
  if (rec.status === "complete" && phase < 12) {
    const next = (phase + 1) as PhaseId;
    // T0.4: leaving a completed phase under enforceDod requires a passing gate
    // (store.advanceOnce parity). Cursor stays; artifact + dod.blocked log land.
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
    if (!canEnter(phase, next)) return { project, error: "Illegal transition.", stopped: true };
    if (!priorsSealed(project.phases, next)) {
      return { project, error: `P${phase} must stay sealed.`, stopped: true };
    }
    return runReady(advanceTo(project, next), next, autopilot, live);
  }
  if (rec.status === "complete") return { project, error: "Pipeline complete.", stopped: true };
  return runReady(project, phase, autopilot, live);
}

/** Why a run/gate invocation ended (F-02/F-04 closure — store's stoppedReason
 *  vocabulary plus "progress"/"cap" for non-terminal stops). */
export type RunOutcome = "hitl" | "complete" | "blocked" | "error" | "progress" | "cap" | "dod";

export type RunResult = {
  project: Project;
  /** Phases that COMPLETED (or ran into a gate) during this invocation.
   *  0 = parked/terminal with no progress — never trust `ok`/exit 0 alone. */
  steps: number;
  stopped: boolean;
  events: string[];
  /** Why the invocation ended: parked on a human gate ("hitl"), terminal
   *  ("complete"/"blocked"), an error the loop cannot advance past ("error"),
   *  mid-flight progress with more to do ("progress"), or the iteration cap
   *  hit without a park ("cap"). */
  outcome: RunOutcome;
  /** fixes/144 (M4-1): true ONLY when the run sealed complete AND at least one
   *  recorded DoD gate stands FAILED (sealHonesty(project).clean === false) —
   *  a red-gate completion that the CLI surfaces as RT_E_GATES_FAILED, never
   *  as a byte-identical clean 0. */
  sealedWithFailures: boolean;
};

/** Advance the pipeline until it parks (awaiting_hitl / complete / blocked) or
 *  hits `maxSteps` (default 40 — 13 phases × ~2 iterations + margin). */
export async function runUntilGate(
  project: Project,
  opts: { autopilot?: boolean; live?: boolean; maxSteps?: number } = {},
): Promise<RunResult> {
  const autopilot = Boolean(opts.autopilot);
  const live = Boolean(opts.live);
  const maxSteps =
    typeof opts.maxSteps === "number" && opts.maxSteps > 0 ? Math.floor(opts.maxSteps) : 40;
  let p = project;
  let steps = 0;
  let iterations = 0;
  let dodBlocked = false;
  const events: string[] = [];
  while (iterations < maxSteps) {
    iterations += 1;
    const before = p;
    const r = await advanceOnce(p, autopilot, live);
    p = r.project;
    if (r.error) events.push(r.error);
    if (r.dodBlocked) dodBlocked = true;
    // Honest step counting: an iteration counts as a step only when the phase
    // edge moved (completion / approval advance) OR new artifacts landed (a
    // phase synthesized and parked on its gate). A pure park iteration
    // ("Waiting on human approval.", locked, rejected, complete drain) is 0
    // progress and must not inflate `steps` (F-02).
    if (
      p.currentPhase !== before.currentPhase ||
      (p.artifacts?.length ?? 0) > (before.artifacts?.length ?? 0)
    ) {
      steps += 1;
    }
    if (r.stopped) break;
  }
  // Outcome derives from the parked state first, then from whether this
  // invocation made progress or burned its iteration bound on nothing.
  // T0.4: a hard-DoD block is its own terminal outcome (not "error") so CLI
  // and eval can distinguish "tool exploded" from "gate refused advance".
  const outcome: RunOutcome =
    dodBlocked
      ? "dod"
      : p.status === "awaiting_hitl"
        ? "hitl"
        : p.status === "blocked"
          ? "blocked"
          : p.status === "complete"
            ? "complete"
            : events.length > 0
              ? "error"
              : steps > 0
                ? "progress"
                : "cap";
  const stopped =
    outcome === "hitl" ||
    outcome === "complete" ||
    outcome === "blocked" ||
    outcome === "error" ||
    outcome === "dod";
  // L2-on-live-refusal capture (fixes/121 + fixes/126): a keyed P6 whose
  // synthesis refused returns a project carrying a `p6.synthesis.refused` log.
  // That refusal can leave the run parked at "hitl" (awaiting_hitl) rather than
  // "complete" — and the deterministic-seal L2 site (engine applyPhaseResult)
  // never fires for a needsHitl phase — so the template-emission lesson is
  // minted here from the refusal signal REGARDLESS of the terminal outcome.
  // Idempotent (content-addressed) and advisory-only (never gates the run).
  let finalProject = p;
  const p6Refused = (p.logs ?? []).some(
    (l) => l.event === "p6.synthesis.refused" && l.phase === 6,
  );
  if (p6Refused) {
    // fixes/127 (X3): the old guard read p.lastTest?.ok — TRUE for a refused
    // keyed P6 (the placeholder self-test passed; only the log shows the
    // refusal) so it minted unmet=[] → "gate unmet (unknown)" — a content lie.
    // A codegen refusal means the module never shipped: the template-emission
    // criteria are genuinely unmet. Derive from the recorded P6 gate when it
    // exists, else the refusal's own criteria; and dedupe against the
    // seal-site row (engine applyPhaseResult) so ONE L2 per refusal survives.
    const gate = (p.phases ?? []).find((ph) => ph.id === 6)?.gate;
    const unmet =
      gate && gate.passed === false && Array.isArray(gate.unmet) && gate.unmet.length > 0
        ? gate.unmet
        : ["p6-verified", "p6-brief-fit"];
    // Record the refusal class (RT_E code · first clause) so the content
    // address + hash differ per failure class and the row is traceable.
    const refusalDetail = (p.logs ?? []).find(
      (l) => l.event === "p6.synthesis.refused" && l.phase === 6,
    )?.detail;
    const classHash = typeof refusalDetail === "string" ? fnv1a(refusalDetail) : undefined;
    const hasSealL2 = (p.memory ?? []).some(
      (m) => m.phase === 6 && /^lesson-template-emission-/.test(m.id),
    );
    const l2 = templateEmissionLesson(
      p,
      6 as PhaseId,
      unmet,
      undefined,
      classHash ? `${classHash}-${(refusalDetail ?? "").slice(0, 60)}` : undefined,
      "engine",
    );
    if (l2 && !hasSealL2 && !(p.memory ?? []).some((m) => m.id === l2.id)) {
      finalProject = {
        ...finalProject,
        memory: [...(finalProject.memory ?? []), l2].slice(-80),
        logs: [
          ...(finalProject.logs ?? []),
          {
            ts: Date.now(),
            phase: 6 as PhaseId,
            level: "info" as const,
            event: "lesson.capture",
            detail: `L2 template-emission ${l2.id} (keyed P6 synthesis refused — red gate on a live run)`,
          },
        ].slice(-200),
      };
    }
  }
  // L5 run-summary capture (fixes/98 §2.3 / 98_make_3 §6): at terminal run
  // completion, mint ONE content-addressed run-summary lesson when the journey
  // carried gate failures / rejections / verify failures (honest digest of what
  // went wrong). Idempotent: the id hashes the digest, and a twin is dropped.
  if (outcome === "complete") {
    // fixes/127 (X1): a clean 'complete' must never hide failed DoD gates. When
    // the drain sealed with red gates, correct the misleading delivery.complete
    // record with an explicit census warn + an event so no consumer (CLI
    // envelope, summary reader, agent) can mistake it for a clean seal.
    const fg = failedGates(finalProject);
    if (fg.length > 0) {
      const census = fg.map((g) => `P${g.phase}(${g.unmet.join(",") || "unmet"})`).join("; ");
      events.push(`sealed-with-${fg.length}-failed-gates: ${census}`);
      finalProject = {
        ...finalProject,
        logs: [
          ...(finalProject.logs ?? []),
          {
            ts: Date.now(),
            phase: 12 as PhaseId,
            level: "warn" as const,
            event: "run.complete.with.failed.gates",
            detail: `sealed complete with ${fg.length} failed DoD gate(s): ${census}`,
          },
        ].slice(-200),
      };
    }
    const summaryLesson = runSummaryLesson(finalProject);
    if (summaryLesson && !(finalProject.memory ?? []).some((m) => m.id === summaryLesson.id)) {
      finalProject = {
        ...finalProject,
        memory: [...(finalProject.memory ?? []), summaryLesson].slice(-80),
        logs: [
          ...(finalProject.logs ?? []),
          {
            ts: Date.now(),
            phase: 12 as PhaseId,
            level: "info" as const,
            event: "lesson.capture",
            detail: `L5 run-summary ${summaryLesson.id} (run completed with failure signals)`,
          },
        ].slice(-200),
      };
    }
  }
  // fixes/144 (M4-1 completion gate): a COMPLETE seal carrying any recorded
  // failed DoD gate is flagged on the RunResult itself (never a byte-identical
  // clean completion). sealHonesty(engine) is the single census source — the
  // same one the P12 delivery writer uses — so the CLI gate can branch without
  // re-deriving red gates.
  const sealedWithFailures = outcome === "complete" && !sealHonesty(finalProject).clean;
  return { project: finalProject, steps, stopped, events, outcome, sealedWithFailures };
}

// ---------------------------------------------------------------------------
// Gate decisions + report intake + export helpers.
// ---------------------------------------------------------------------------

/** 216 (TA-2 / P0-01): the actor seat a HITL approval is recorded under.
 *  `approve()` used to hardcode `decidedBy: "human"`, so every machine caller
 *  (the eval harness, any headless drain) minted a human actor for a machine
 *  decision. A machine path may now only ever claim the `autopilot` seat; a
 *  row claiming `human` must additionally present the out-of-band seat token
 *  (see `approve`). */
export type ApproveActor =
  | { decidedBy: "human"; seat: "human-cli-i-am-human" }
  | { decidedBy: "autopilot"; seat: "harness" | "autopilot" };

/** The default seat of `approve()` — the harness's own autopilot actor. Named
 *  so a caller can state the default explicitly; it can never mint
 *  `decidedBy: "human"` (that needs the token path below). */
export const HARNESS_APPROVE_ACTOR: ApproveActor = { decidedBy: "autopilot", seat: "harness" };

/**
 * 216o (T-107.3 · P0-02 · W6-L2): stamp the policy verdict onto the ledger row
 * the approval just minted, as `HitlDecision.decidedVia` (types.ts). The mint
 * itself stays where it always lived (`approveHitl`, engine.ts) — this is the
 * additive provenance tail for THIS file's path: `approve()` writes every row
 * with the seam verdict that allowed it (action/resource/reason), the seat
 * label in the same `policy.seatLabel` vocabulary the `[seat …]` note tag
 * uses, and whether the out-of-band token path verified a human seat.
 *
 * Only a FRESHLY appended row is touched — identified by its id not existing
 * on the input project — so a defensive no-op approval (no pending gate, or a
 * drifted edge) and every pre-existing row pass through byte-identical. The
 * field is optional by construction: rows minted elsewhere (engine autopilot
 * steps, store approvals, fixtures) simply never carry it.
 */
function stampDecidedVia(
  project: Project,
  before: Project,
  decidedVia: NonNullable<HitlDecision["decidedVia"]>,
): Project {
  const row = project.decisions.at(-1);
  if (row === undefined || row.decision !== "approve") return project;
  if (row.phase !== before.currentPhase) return project;
  if (before.decisions.some((d) => d.id === row.id)) return project; // nothing minted
  return {
    ...project,
    decisions: project.decisions.map((d) => (d.id === row.id ? { ...d, decidedVia } : d)),
  };
}

/** Approve the pending HITL gate on the current edge (pass `force` to override
 *  a forceHuman gate such as a failed P6 sandbox). Throws when there is no
 *  pending gate on the CURRENT edge (store.approve parity — a stale gate must
 *  fail loudly, never silently no-op).
 *
 *  216 (TA-2 / P0-01): the decision is recorded under an explicit ACTOR SEAT.
 *  Default = `HARNESS_APPROVE_ACTOR` (autopilot/harness), so no machine path
 *  can mint `decidedBy: "human"`. The human seat
 *  (`{ decidedBy: "human", seat: "human-cli-i-am-human" }`) additionally
 *  requires the OUT-OF-BAND `RT_HUMAN_SEAT_TOKEN` environment secret to be set
 *  (by the person at the keyboard, in their own shell) and presented here as
 *  `opts.humanSeatToken` — a call claiming the human seat without a matching
 *  token throws instead of minting a human row. Every row's note carries a
 *  `[seat <label>]` tag so the ledger shows which seat decided.
 *
 *  216o (T-107.3 / P0-01·P0-06): the seat/token test above is no longer this
 *  file's own — the decision routes through the ONE policy seam
 *  (`evaluatePolicy`, src/lib/policy.ts) with `hitl.force` when `force` is set
 *  (a machine may never force past a human gate) and `hitl.approve` otherwise.
 *  A denied verdict throws a coded `RT_E_VALIDATION` refusal naming the
 *  sanctioned fallback; there is no seat combination that can bypass it.
 *
 *  216o (W6-L2 · ledger provenance): an ALLOWED decision also stamps the
 *  minted row's optional `decidedVia` field (types.ts) with the allowing
 *  verdict — action, resource, reason, seat label (the `seatLabel` vocabulary),
 *  and the token-path bool — so the ledger records WHERE the decision came
 *  from, not just that it happened; `dod.ts` cross-checks the field against
 *  the row's own tag when present. */
export function approve(
  project: Project,
  opts: { force?: boolean; actor?: ApproveActor; humanSeatToken?: string } = {},
): Project {
  if (!project.hitl) {
    throw new Error(`approve: no pending gate to approve (status: ${project.status}).`);
  }
  if (project.hitl.phase !== project.currentPhase) {
    throw new Error(
      `approve: pending gate is for P${project.hitl.phase} but the current edge is P${project.currentPhase} — state drifted; refusing a silent no-op.`,
    );
  }
  const actor = opts.actor ?? HARNESS_APPROVE_ACTOR;
  // 216o (T-107.3 · P0-01/P0-06 · W5-L3): the decision routes through the ONE
  // policy seam (`evaluatePolicy`, src/lib/policy.ts) instead of this file's
  // ad-hoc seat/token test. Action routing: `force` overrides a forceHuman
  // gate ⇒ `hitl.force` (Rule B — only a verified human seat may force; the
  // autopilot seat can never self-approve one); otherwise `hitl.approve` on
  // this edge's gate. The env read stays HERE on purpose: policy.ts is a pure
  // leaf that never touches `process.env` (its purity test pins that) — the
  // out-of-band RT_HUMAN_SEAT_TOKEN is the *expected* side, opts.humanSeatToken
  // the presented side.
  const policyAction = opts.force === true ? "hitl.force" : "hitl.approve";
  const policyResource = `gate:P${project.hitl.phase}`;
  const verdict = evaluatePolicy(policyAction, policyResource, {
    actor,
    humanSeatToken: opts.humanSeatToken,
    expectedHumanSeatToken: process.env.RT_HUMAN_SEAT_TOKEN,
  });
  if (verdict.decision !== "allow") {
    // Machine-readable code on the thrown Error (same shape as phases.ts:119):
    // a seat claim the seam refuses is a validation refusal, not an opaque
    // internal error, so the CLI's catch-all preserves RT_E_VALIDATION on the
    // envelope. The verdict's reason names the cause and its fallback the
    // sanctioned alternative (P0-01's mandatory-fallback shape).
    const err = new Error(
      `approve: the policy seam refused ${policyAction} on ${policyResource} (${verdict.reason}) — sanctioned fallback: ${verdict.fallback}.`,
    ) as Error & { code?: string };
    err.code = "RT_E_VALIDATION";
    throw err;
  }
  // The `[seat <label>]` tags are the 216 TA-2 ledger contract — byte-identical
  // to the pre-216o strings (pinned by headless.test.ts TA-2 tests), so the
  // tag keeps naming the seat itself, not the policy label vocabulary.
  const note =
    actor.decidedBy === "human"
      ? `[seat ${actor.seat}] out-of-band RT_HUMAN_SEAT_TOKEN verified`
      : `[seat ${actor.seat}] autopilot seat — no human decision claimed`;
  // 216o (T-107.3 · P0-02 · W6-L2 — ledger PROVENANCE): the row this approval
  // mints also records the ALLOWING verdict as `decidedVia` (types.ts): the
  // action/resource/reason the seam covered, the seat label in the SAME
  // `policy.seatLabel` vocabulary the note tag uses, and the token path —
  // branched on the reason id ("human-seat-token-verified"), the documented
  // policy.ts reason contract. The mint itself stays in approveHitl; the
  // stamp is additive and touches only the freshly appended row.
  const decidedVia: NonNullable<HitlDecision["decidedVia"]> = {
    action: policyAction,
    resource: policyResource,
    reason: verdict.reason,
    label: seatLabel(actor),
    tokenPath: verdict.reason.split(" — ")[0] === "human-seat-token-verified",
  };
  const base = stampDecidedVia(
    approveHitl(project, { decidedBy: actor.decidedBy, force: opts.force, note }),
    project,
    decidedVia,
  );
  // E-02 (store.approve parity): record the just-approved phase's DoD gate —
  // approveHitl sets PhaseRecord.gate inline but the gate artifact + log are
  // recordGateInto's, and the packet is re-stamped after the verdict so its
  // System JSON `gate_passed` is fresh. No-op approvals (no pending gate) come
  // back as the same reference and are left untouched.
  const recorded = recordGateInto(base, project.currentPhase);
  return recorded === base ? base : stampPacket(recorded);
}

/** Reject the pending HITL gate (throws unless ≥12 chars of qualitative note). */
export function reject(project: Project, note: string): Project {
  return rejectHitl(project, note);
}

/** Re-open a rejected phase for a retry (clears the block; note stays applied). */
export function retry(project: Project): Project {
  return unlockRetry(project);
}

/**
 * E-10: a rejected report (validation failure, wrong-phase report, ...) throws
 * this error instead of a bare Error. `project` carries the rejection trail
 * (a `report.rejected` warn log) so a file-backed caller can persist it — the
 * trail survives even though the report itself was never applied.
 */
export class ReportRejectedError extends Error {
  readonly project: Project;

  constructor(message: string, project: Project) {
    super(message);
    this.name = "ReportRejectedError";
    this.project = project;
  }
}

/** Validate + apply an external agent's report (rejection-free, append-only). */
export type IngestResult = {
  project: Project;
  /** false when the identical report was already applied (E-09 idempotency). */
  applied: boolean;
  reason: ReportApplyReason;
};

/**
 * E-09 rich ingest: like `ingest`, but the caller ALSO learns whether the
 * report actually landed — a duplicate retry (lost-ack recovery) returns the
 * input project unchanged with applied:false, and an envelope that claims
 * applied:true regardless would be dishonest. Rejection throws
 * ReportRejectedError carrying the trail exactly like `ingest`.
 */
export function ingestResult(project: Project, rawReport: unknown): IngestResult {
  // E-10 (store.ingestReport parity): phase-check the report against the live
  // edge — without the currentPhase argument validateReport accepted any
  // phase, so a P3 report could land while the project sat on P9.
  const v = validateReport(rawReport, project.currentPhase);
  if (!v.ok) {
    // Trail for the rejection (E-10): a warn log on the project, autopilot.
    // gate_denied-style, so the reason stays visible in the persisted state.
    const withTrail: Project = {
      ...project,
      logs: [
        ...(project.logs ?? []),
        {
          ts: Date.now(),
          phase: project.currentPhase,
          level: "warn" as const,
          event: "report.rejected",
          detail: v.error,
        },
      ].slice(-200),
    };
    throw new ReportRejectedError(`Invalid report: ${v.error}`, withTrail);
  }
  return applyReportResult(project, v.report);
}

/** Project-only facade over ingestResult (transition seam for legacy callers). */
export function ingest(project: Project, rawReport: unknown): Project {
  return ingestResult(project, rawReport).project;
}

/** Compiled agent packet text (exportPacketText). */
export function packet(project: Project): string {
  return exportPacketText(project);
}

/** Full project JSON (exportProjectJson). */
export function exportJson(project: Project): string {
  return exportProjectJson(project);
}

// ---------------------------------------------------------------------------
// Agent-facing summary.
// ---------------------------------------------------------------------------

export type PhaseCounts = Partial<Record<PhaseStatus, number>>;

export type ProjectSummary = {
  name: string;
  currentPhase: PhaseId;
  status: string;
  phaseCounts: PhaseCounts;
  lastGate: {
    phase: PhaseId;
    decision: "approve" | "reject";
    note: string | null;
    decidedBy: "human" | "autopilot";
    decidedAt: number;
  } | null;
  /** Count of cited research findings across live corpus rounds (0 on deterministic runs). */
  researchCount: number;
  /** Count of memory rows (episodic/semantic/procedural atoms; the vault's core notes). */
  memoryCount: number;
  /** Hint: true when src/lib/vault.ts exists AND the project already holds note-able content. */
  vaultReady: boolean;
  /** fixes/125: complete phases whose DoD gate recorded passed:false (never hidden). */
  failedGates: { phase: PhaseId; unmet: string[] }[];
  /** fixes/125: true when any complete phase sealed with a failed gate. */
  sealedWithFailures: boolean;
};

/** JSON-safe summary for agent consumption (safe to print / pipe / store). */
export function summary(project: Project): ProjectSummary {
  const phaseCounts: PhaseCounts = {};
  for (const r of project.phases) {
    phaseCounts[r.status] = (phaseCounts[r.status] ?? 0) + 1;
  }
  const last = project.decisions?.length ? project.decisions[project.decisions.length - 1] : null;
  const lastGate = last
    ? {
        phase: last.phase,
        decision: last.decision,
        note: last.note ?? null,
        decidedBy: last.decidedBy,
        decidedAt: last.decidedAt,
      }
    : null;
  const memoryCount = project.memory?.length ?? 0;
  const researchCount = (project.research ?? []).reduce(
    (n, round) => n + (round && Array.isArray(round.items) ? round.items.length : 0),
    0,
  );
  // fixes/125 (W1 #2): a clean 'complete' must never hide failed DoD gates —
  // surface the census + the honest sealed-with-failures flag.
  const failed = failedGates(project);
  return {
    name: project.name,
    currentPhase: project.currentPhase,
    status: project.status,
    phaseCounts,
    lastGate,
    researchCount,
    memoryCount,
    // vaultReady: the vault module is on disk AND the project has rows to note.
    vaultReady: vaultModuleAvailable() && (memoryCount > 0 || (project.artifacts?.length ?? 0) > 0),
    failedGates: failed,
    sealedWithFailures: failed.length > 0,
  };
}

/** Filesystem-safe project filename (re-exported for the CLI). */
export const filename = slugName;

// ---------------------------------------------------------------------------
// Vault (dynamic import of src/lib/vault.ts — sibling-owned module; its header
// freezes the EXACT export surface this section compiles against):
//
//   buildVaultNotes(project) -> VaultNote[]   (atomic notes, hub note first)
//   vaultMarkdown(notes)     -> string        (concatenated per-note blocks,
//                                              splittable on /^---\ntitle:/m)
//   vaultIndex(notes)        -> string        (Map-of-Content markdown)
//   searchVault(notes, query)-> VaultNote[]   (ranked, case-insensitive)
//
// vault.ts may not exist yet when this file is typechecked (it was built in
// parallel), so every reference below is a RUNTIME dynamic import through a
// non-literal specifier. When the module is absent the import throws and
// callers surface a clean { ok:false, error } — never a crash mid-JSON.
// ---------------------------------------------------------------------------

/** Structural mirror of vault.ts's frozen VaultNote contract. */
export type VaultNote = {
  title: string;
  body: string;
  tags: string[];
  links: string[];
  phase?: number;
  updatedAt: number;
  kind: "project" | "memory" | "decision" | "research" | "artifact" | "index";
};

type VaultModule = {
  buildVaultNotes(project: Project): unknown[];
  vaultMarkdown(notes: unknown[]): string;
  vaultIndex(notes: unknown[]): string;
  searchVault(notes: unknown[], query: string): unknown[];
};

/** This file's directory — vault.ts sits beside headless.ts. */
const LIB_DIR = dirname(fileURLToPath(import.meta.url));

/** True when src/lib/vault.ts exists on disk (module present → vault usable). */
export function vaultModuleAvailable(): boolean {
  try {
    return existsSync(join(LIB_DIR, "vault.ts"));
  } catch {
    return false;
  }
}

let vaultModulePromise: Promise<VaultModule> | null = null;

/**
 * Load the sibling-owned vault module once. Resolves only when every export of
 * its frozen surface is present; rejects with a readable error otherwise.
 */
function loadVaultModule(): Promise<VaultModule> {
  vaultModulePromise ??= (async () => {
    // Non-literal specifier: resolved relative to THIS module at runtime and
    // deliberately invisible to tsc, so typecheck stays green while vault.ts
    // is still mid-flight (sibling-owned file, lands in parallel).
    const spec = "./vault.ts";
    const mod = (await import(spec)) as Record<string, unknown>;
    for (const name of ["buildVaultNotes", "vaultMarkdown", "vaultIndex", "searchVault"]) {
      if (typeof mod[name] !== "function") {
        throw new Error(`vault module (src/lib/vault.ts) is missing its "${name}" export — contract drift.`);
      }
    }
    return mod as unknown as VaultModule;
  })();
  return vaultModulePromise;
}

/** Build the atomic vault notes for a project (pure, deterministic). */
export async function buildVault(project: Project): Promise<VaultNote[]> {
  const vault = await loadVaultModule();
  return vault.buildVaultNotes(project) as VaultNote[];
}

/** Whole-vault markdown export (vaultMarkdown passthrough; single Obsidian-ready string). */
export async function vaultMarkdown(project: Project): Promise<string> {
  const vault = await loadVaultModule();
  const notes = vault.buildVaultNotes(project);
  return vault.vaultMarkdown(notes);
}

/** Map-of-Content markdown over the project's notes (vaultIndex passthrough). */
export async function vaultIndex(project: Project): Promise<string> {
  const vault = await loadVaultModule();
  const notes = vault.buildVaultNotes(project);
  return vault.vaultIndex(notes);
}

// ---------------------------------------------------------------------------
// Per-note files are split out of vaultMarkdown's concatenated export on the
// /^---\ntitle:/m block boundary vault.ts documents — the CLI never hand-rolls
// note markdown, so UI/CLI/vault.ts can't drift (multiagent pitfall 4).
// ---------------------------------------------------------------------------

/** Boundary between two vaultMarkdown blocks: a line-start `---\ntitle: "…"`. */
const BLOCK_START = /(?=^---\ntitle: ")/m;

/** Split vaultMarkdown output into its per-note blocks (1:1 with the note order). */
export function splitVaultBlocks(markdown: string): string[] {
  const blocks = markdown.split(BLOCK_START);
  return blocks.map((b) => b.trimEnd()).filter((b) => b.trim().length > 0);
}

/** Parse `title: "…"` out of a block's frontmatter (vaultMarkdown quotes titles). */
function blockTitle(block: string): string {
  const m = /^---\ntitle: "((?:[^"\\]|\\.)*)"/m.exec(block);
  return m ? m[1].replace(/\\(["\\])/g, "$1") : "";
}

/** Filename-safe stand-in for "/" (illegal in file names; Obsidian treats it as
 *  a folder separator). Kept visually close so links stay greppable. */
const SAFE_SLASH = "\u2215"; // division slash
// C0 control chars (0x00–0x1F) + Windows-illegal filename chars. The control
// range is injected via String.fromCharCode so the no-control-regex rule
// (escape-based static analysis) stays satisfied.
const CONTROL_RE = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}<>:"\\\\|?*]`,
  "g",
);

/** Rewrite every [[wikilink]] target through `map` (title → safe file name). */
function rewriteLinks(text: string, map: ReadonlyMap<string, string>): string {
  return text.replace(/\[\[([^\]|#]+)((?:#[^\]|]*)?(?:\|[^\]|]*)?)\]\]/g, (whole, raw: string, rest: string) => {
    const target = raw.trim();
    const mapped = map.get(target);
    return mapped ? `[[${mapped}${rest}]]` : whole;
  });
}

/** Filesystem-safe STEM (no extension) for a note title, deduped via `used`. */
function nameForTitle(title: string, index: number, used: Set<string>): string {
  let stem = String(title ?? "")
    .replace(CONTROL_RE, "")
    .replace(/\//g, SAFE_SLASH)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  if (!stem) stem = `note-${index + 1}`;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) stem = `note-${stem}`; // NTFS reserved
  let candidate = stem;
  let n = 2;
  while (used.has(candidate)) candidate = `${stem} (${n++})`;
  used.add(candidate);
  return candidate;
}

/** Map every note title → its authoritative filesystem stem (deduped in note
 *  order). Titles survive verbatim unless they contain path-illegal characters
 *  (e.g. "/", "?") or collide with an already-claimed stem. */
function titleNameMap(blocks: string[]): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();
  for (let i = 0; i < blocks.length; i++) {
    const title = blockTitle(blocks[i]);
    if (!title) continue;
    map.set(title, nameForTitle(title, i, used));
  }
  return map;
}

/** One vault note file: filename (no directory) + markdown content. */
export function vaultFileFor(block: string, index: number): { file: string; markdown: string } {
  const used = new Set<string>();
  let file = `${nameForTitle(blockTitle(block), index, used)}.md`;
  if (file === "_index.md") file = "index-note.md"; // never collide with the MOC file
  return { file, markdown: `${block.trimEnd()}\n` };
}

export type WriteVaultResult = {
  dir: string;
  /** Number of atomic note files written (excludes _index.md). */
  count: number;
  /** Every file written, including _index.md (basenames, deterministic order). */
  files: string[];
};

/**
 * Materialize the vault on disk: one `.md` file per atomic note (content
 * straight from vaultMarkdown's per-note blocks) plus an `_index.md` MOC
 * (vaultIndex output), inside `dir` (created recursively). Deterministic:
 * same project in ⇒ same files out.
 *
 * Wikilinks stay non-dangling on disk: vault.ts writes [[targets]] by bare
 * title, so when a title contains path-illegal characters (e.g. "UI/UX") the
 * file gets a safe name and every [[target]] — in note bodies AND _index.md —
 * is rewritten to that name (only such titles are affected).
 */
/** 216 (T-07 / F-07): the bounded red-tree reference an emit result carries —
 *  the refusal's cause (`ok: false`) or the banner's trail (`ok: true`). */
export type RedTreeRef = { failures: number; lastFailure: string };

export type EmitProjectResult = {
  ok: true;
  dir: string;
  files: string[];
  summary: string;
  moduleEmbedded: boolean;
  /** A7: leftover files deleted this emit (ghost specs + byte-identical extras). */
  wiped: string[];
  /** A7: leftover files kept because `--force` (foreign user files). */
  survivors: string[];
  /** 216 (T-07 / F-07): true when the emitted `README.md` carries the red-tree
   *  banner — the artifact's own declaration that the phase rail below it is a
   *  RECORD, not a passing build (`redTree: "banner"` policy only). */
  redTreeBanner?: boolean;
  /** 216 (T-07 / F-07): the uncleared red-tree trail behind the banner, or
   *  `null` when the trail's last verdict is not red (absent on the `probe`
   *  policy, which never consults the trail). */
  redTree?: RedTreeRef | null;
} | {
  ok: false;
  error: string;
  code?: string;
  foreign?: string[];
  /** 216 (T-07 / F-07): the uncleared red-tree trail behind an
   *  `RT_E_TREE_RUN_FAILED` refusal. */
  redTree?: RedTreeRef | null;
};

const EMIT_SKIP_DIRS = new Set(["node_modules", ".git", ".vercel"]);
const GHOST_SPEC_RE = /(^|\/)[^/]+\.(spec|test)\.(ts|mts|cts|js|mjs|cjs)$/i;

function walkEmitRel(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (current: string): void => {
    let entries: import("node:fs").Dirent[] = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (EMIT_SKIP_DIRS.has(e.name)) continue;
      const full = join(current, e.name);
      if (e.isDirectory()) {
        walk(full);
        continue;
      }
      if (e.isFile()) out.push(relative(root, full).split("\\").join("/"));
    }
  };
  walk(root);
  return out;
}

// ---------------------------------------------------------------------------
// 216 (T-07 / F-07) — the red-tree emit guard. The engine logged a red tree
// three times and shipped the artifact anyway, with the phase rail reading P6
// `complete` (the phase RECORD is written independently of the tree verdict).
// `emitProject` therefore consults the durable tree-verdict trail BEFORE it
// writes anything: refuse with a coded error (default) or stamp an unmissable
// banner into the emitted README.md.
// ---------------------------------------------------------------------------

/** The tree-verdict trail read off the project's own log rows (216 T-07).
 *
 *  Red   = `p6.tree.failure` — one failed tree-run, carrying the bounded tail
 *          the journey/repair driver stamped.
 *  Green = `p6.journey.converged` (a green journey verdict),
 *          `p6.tree.tested` (minted ONLY after a green tree-run — codegen
 *          `mintTreeRunTested`), or `p6.tree.tested.skipped` (a green run that
 *          executed no specs — still a green run, explicitly labelled).
 *
 *  Anything else — DoD/gate rows, synthesis refusals, a `p6.journey.failed`
 *  after a GREEN tree with a failed gate — is not a tree verdict and never
 *  clears a red row. The LAST row wins, so a tree repaired to green by a later
 *  run emits clean: the guard blocks an uncleared red tree, not a bad history. */
export type TreeRunTrail = {
  /** The last tree verdict on the trail (`none` = the project never ran one). */
  last: "red" | "green" | "none";
  /** Count of `p6.tree.failure` rows in the trail (F-07 observed 3). */
  failures: number;
  /** The most recent failure tail, bounded like the journey's own log rows. */
  lastFailure: string;
  /** The most recent green row's detail, bounded — "" when there is none. */
  lastGreen: string;
};

export function treeRunTrail(project: Project): TreeRunTrail {
  const rows = Array.isArray(project.logs) ? project.logs : [];
  let last: TreeRunTrail["last"] = "none";
  let failures = 0;
  let lastFailure = "";
  let lastGreen = "";
  for (const row of rows) {
    const event = typeof row?.event === "string" ? row.event : "";
    const detail = typeof row?.detail === "string" ? row.detail : "";
    if (event === "p6.tree.failure") {
      last = "red";
      failures += 1;
      lastFailure = detail;
    } else if (
      event === "p6.journey.converged" ||
      event === "p6.tree.tested" ||
      event === "p6.tree.tested.skipped"
    ) {
      last = "green";
      lastGreen = detail;
    }
  }
  return {
    last,
    failures,
    lastFailure: lastFailure.slice(0, 1800),
    lastGreen: lastGreen.slice(0, 240),
  };
}

/** 216 (T-07): the unmissable banner stamped at the TOP of the emitted
 *  `README.md` under the `banner` policy. It states only what the engine knows
 *  — it never claims a pass, and it names the phase rail below it as the
 *  phase RECORD it is (F-07: `complete` is written independently of the tree
 *  verdict). Plain-text + GitHub alert syntax, so it renders unmissably in a
 *  terminal, an editor and on GitHub alike. */
export function redTreeBanner(trail: TreeRunTrail): string {
  const failed = trail.failures === 1 ? "1 failed tree-run" : `${trail.failures} failed tree-runs`;
  const tail = trail.lastFailure.trim().replace(/\r?\n/g, " ").replace(/`/g, "'");
  return [
    "> [!CAUTION]",
    "> ## RED TREE-RUN — THIS ARTIFACT IS NOT VERIFIED (RapidTool T-07 / F-07)",
    ">",
    `> The last machine tree-run over this project's generated tree FAILED: ${failed} on the`,
    "> project's own log trail (see `logs` in the run JSON), with **no green tree-run since**.",
    "> Any phase rail below that reads P6 `complete` is the engine's phase RECORD — it is",
    "> written independently of the tree verdict and is NOT evidence of a passing build.",
    tail.length > 0 ? `> Last failure: \`${tail}\`` : "> The failure tail was empty on the record.",
    ">",
    "> Clear it by reaching a green tree-run (`rapidtool tree-run --dir <dir> --project <run.json>`)",
    "> and re-emitting. Until then, do not treat this tree as a verified deliverable.",
    "",
  ].join("\n");
}

/** 216 (T-07 / F-07): what `emitProject` does when the project's tree-verdict
 *  trail is an UNCLEARED red (`p6.tree.failure` with no green run since).
 *  - `refuse` (default): return a coded `RT_E_TREE_RUN_FAILED` refusal BEFORE
 *    anything is written — an uncleared red tree is never emitted silently.
 *  - `banner`: emit anyway, prepending `redTreeBanner` to the emitted
 *    `README.md` and stamping `redTreeBanner: true` + `redTree` on the result
 *    (the eval driver's policy: the benchmark completes, and the artifact
 *    itself declares the red verdict).
 *  - `probe`: never consult the trail (result fields stay absent). */
export type EmitProjectOptions = {
  force?: boolean;
  redTree?: "refuse" | "banner" | "probe";
};

/**
 * fixes/126 (W2 #1): the CODE → RUNNABLE-APP path. A7: never silently merge
 * leftover tests/*.spec.ts (treeRun would execute ghost specs). Snapshot the
 * dir, write the scaffold, wipe ghost specs + byte-identical leftovers, refuse
 * other foreign files unless `force`.
 *
 * 216 (T-07 / F-07): the durable tree-verdict trail (`treeRunTrail`) is
 * consulted BEFORE anything is written. A trail whose last verdict is red with
 * no green run since is refused with a coded error by default, or shipped ONLY
 * under the explicit `redTree: "banner"` policy with the unmissable banner
 * stamped at the top of the emitted README.md.
 */
export async function emitProject(
  project: Project,
  dir: string,
  opts: EmitProjectOptions = {},
): Promise<EmitProjectResult> {
  // 216 (T-07 / F-07): the trail read + refusal come FIRST — before the
  // scaffold compile, the target dir, the lock and every write — so a refused
  // emit cannot leave a partial tree (not even an empty emit dir) behind.
  // `probe` opts out of the trail read entirely (result fields stay unset).
  const redTreePolicy = opts.redTree ?? "refuse";
  const trail = redTreePolicy === "probe" ? null : treeRunTrail(project);
  if (trail !== null && trail.last === "red" && redTreePolicy === "refuse") {
    const runs = trail.failures === 1 ? "1 failed tree-run" : `${trail.failures} failed tree-runs`;
    return {
      ok: false,
      error:
        `emit refused: the project's tree-run trail is RED (${runs}, no green run since) — ` +
        `reach a green tree-run (rapidtool tree-run) or emit with redTree:"banner" to ship the ` +
        `unmissable banner. Last failure: ${trail.lastFailure.slice(0, 300)}`,
      code: "RT_E_TREE_RUN_FAILED",
      redTree: { failures: trail.failures, lastFailure: trail.lastFailure },
    };
  }
  const scaffold = await import("./scaffold.ts");
  const result = scaffold.scaffoldProject(project);
  if (!result.ok) return { ok: false, error: result.error };
  // 216 (T-07): under the `banner` policy the banner is prepended to the
  // README.md body BEFORE the lock and the file loop below, so it lands
  // atomically with — and cannot drift from — the rest of the emit.
  const banner =
    trail !== null && trail.last === "red" && redTreePolicy === "banner" ? redTreeBanner(trail) : null;
  const files = banner
    ? result.files.map((f) => (f.path === "README.md" ? { ...f, body: `${banner}\n${f.body}` } : f))
    : result.files;
  const target = resolve(dir);
  const intended = new Set(files.map((f) => f.path));
  const existing = walkEmitRel(target);
  const leftovers = existing.filter((p) => !intended.has(p) && p !== ".rapidtool-emit.lock");
  const ghosts = leftovers.filter((p) => GHOST_SPEC_RE.test(p) || p.startsWith("tests/"));
  const foreign = leftovers.filter((p) => !ghosts.includes(p));
  if (foreign.length > 0 && opts.force !== true) {
    return {
      ok: false,
      error: `foreign files in emit dir (pass --force to keep): ${foreign.join(", ")}`,
      code: "RT_E_FOREIGN_FILES",
      foreign,
    };
  }
  mkdirSync(target, { recursive: true });
  const lockPath = join(target, ".rapidtool-emit.lock");
  let fd: number | null = null;
  try {
    fd = openSync(lockPath, "wx");
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
    if (code === "EEXIST") {
      return { ok: false, error: "emit: another writer holds the emit lock", code: "RT_E_BUSY" };
    }
    throw err;
  }
  const snap = snapshotPaths(
    target,
    files.map((f) => f.path),
  );
  try {
    const written: string[] = [];
    for (const f of files) {
      applyWrite(target, f.path, f.body, snap);
      written.push(f.path);
    }
    const wiped: string[] = [];
    for (const p of ghosts) {
      try {
        unlinkSync(join(target, p));
        wiped.push(p);
      } catch {
        /* leftover already gone */
      }
    }
    const moduleEmbedded = files.some((f) => f.body.includes(project.generatedSource ?? ""));
    return {
      ok: true,
      dir: target,
      files: written,
      summary: result.summary,
      moduleEmbedded,
      wiped,
      survivors: opts.force === true ? foreign : [],
      // 216 (T-07): absent under the `probe` policy (the trail was never
      // consulted); `false`/`null` when the trail was read and is not red.
      ...(trail === null
        ? {}
        : {
            redTreeBanner: banner !== null,
            redTree: banner === null ? null : { failures: trail.failures, lastFailure: trail.lastFailure },
          }),
    };
  } catch (err) {
    rollback(target, snap);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `emit rolled back: ${msg}`, code: "RT_E_INTERNAL" };
  } finally {
    try {
      if (fd !== null) closeSync(fd);
    } catch {
      /* ignore */
    }
    try {
      if (existsSync(lockPath)) unlinkSync(lockPath);
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// fixes/144 (M4-2) — the P6 journey driver: a bounded produce→run→repair loop
// around keyed P6. Each cycle calls the SAME live-layer synthesis seam the
// headless run loop uses today (runUntilGate → runReady → runPhase(live) →
// engine.liveLayer for phase 6); when the synthesized project carries a
// generatedTree the tree verdict is taken by compile-check.server's treeRun
// over an emitted temp dir. Converge = green tree-run (the P6 DoD gate is then
// recorded honestly — never force-green). Budget exhausted = an honest FAILED
// outcome with the deterministic floor standing. KEYLESS = no-op passthrough
// (byte-identical same reference). Deps are injectable so unit tests run
// deterministic fakes with no key, no fs and no runner.
// ---------------------------------------------------------------------------

/** Per-cycle synthesis context: which cycle is running and the honest failure
 *  evidence the PREVIOUS cycle recorded (tree-run failure tail + codegen
 *  refusal detail), so a repair synthesis can see exactly what failed. */
export type P6JourneyCycleContext = {
  cycle: number;
  /** Failure tail of the previous cycle's tree-run (or refusal), if any. */
  treeFailureTail?: string;
  /** Codegen refusal detail (p6.synthesis.refused log), if any. Carried into
   *  the next cycle's synthesis deps as a bounded deps.synthesisRefusal
   *  excerpt (fixes/153 P2) and named on the exhausted verdict. */
  refusal?: string;
};

/** fixes/153 (P2): deps.synthesisRefusal cap — the bounded refusal excerpt a
 *  refused cycle feeds the next (the refusal class — RT_E_* code · first
 *  clause — plus the first ~200 chars of the model's reason, mirroring the
 *  1500-char treeFailure tail cap: a long/hostile reason can never blow the
 *  next cycle's prompt budget). */
const P6_JOURNEY_REFUSAL_MAX = 200;

/** fixes/147 (E2) + fixes/153 (P2): map a journey cycle's context onto
 *  engine.liveLayer's additive P6 deps (LiveLayerDeps) — which the engine
 *  forwards verbatim into codegen liveP6Synthesis as deps.treeFailure (the
 *  tree-failure reader) and deps.synthesisRefusal (the refusal reader added
 *  by fixes/153 P2: the previous cycle's refusal class + bounded reason, so
 *  the next attempt sees WHY the prior synthesis was refused and never
 *  re-requests byte-identical work). An absent/empty context ⇒ undefined ⇒
 *  the legacy byte-identical liveLayer(p, 6) call (zero behavior change);
 *  a tree-failure-only ctx yields exactly { treeFailure } — no
 *  synthesisRefusal key — byte-identical to fixes/147. Exported so the
 *  driver's default synthesize seam and its tests share ONE mapping. */
export type P6CycleLiveDepsShape = {
  treeFailure?: string;
  /** Bounded refusal context from the previous cycle (fixes/153 P2). Present
   *  ONLY when the previous cycle's synthesis refused — the refusal class
   *  (RT_E_* code) + first ~200 chars of the model's reason. */
  synthesisRefusal?: string;
};

export function p6CycleLiveDeps(ctx: P6JourneyCycleContext): P6CycleLiveDepsShape | undefined {
  const tail = typeof ctx.treeFailureTail === "string" ? ctx.treeFailureTail : "";
  const refusal = typeof ctx.refusal === "string" ? ctx.refusal : "";
  if (tail.length === 0 && refusal.length === 0) return undefined;
  const deps: P6CycleLiveDepsShape = {};
  if (tail.length > 0) deps.treeFailure = tail;
  if (refusal.length > 0) deps.synthesisRefusal = refusal.slice(0, P6_JOURNEY_REFUSAL_MAX);
  return deps;
}

/** Injectable seams. The defaults ARE the production seams; fakes only replace
 *  them in unit tests (deterministic, no key / fs / runner). */
export type P6JourneyDeps = {
  /** Produce/repair seam — one synthesis attempt. Default: the live-layer P6
   *  synthesis seam the headless loop uses today (engine.liveLayer for phase
   *  6, which applies the deterministic floor then runs codegen
   *  liveP6Synthesis when keyed). The cycle context reaches codegen TWO ways:
   *  the tree-failure tail rides deps.treeFailure through liveLayer's additive
   *  deps param (fixes/147 E2 — codegen's only tree-failure reader) and the
   *  durable record trail is the `p6.tree.failure` log. */
  synthesize: (project: Project, ctx: P6JourneyCycleContext) => Promise<Project>;
  /** Tree verdict seam. Default: emit the generatedTree to a temp dir
   *  (emitProject — the M2/M3 tree emission path) and run it via
   *  compile-check.server's treeRun; the dir is removed afterwards unless the
   *  caller passed `workDir`. */
  runTree: (project: Project) => Promise<TreeRunOutcome>;
  /** P6 DoD gate-recording seam — fixes/159 (F4): the convergence decision
   *  reads `gate.passed` from THIS record, so the seam is injectable exactly
   *  like synthesize/runTree (fakes only in unit tests). Default: the real
   *  recordGateInto over phase 6 (real probes, never force-green — a fake
   *  tree can never buy a green verdict). */
  recordGate?: (project: Project) => Project;
};

export type P6JourneyOutcome = "converged" | "failed" | "keyless";

export type P6JourneyResult = {
  outcome: P6JourneyOutcome;
  project: Project;
  /** Synthesis cycles actually executed (0 on keyless passthrough). */
  cycles: number;
  budget: number;
  /** Last tree-run failure tail seen (null on converge / keyless / none). */
  treeTail: string | null;
  /** Last codegen refusal detail seen (p6.synthesis.refused), if any. */
  refusal: string | null;
  /** Recorded P6 DoD gate after convergence (null unless the P6 record is
   *  complete and was re-recorded — the verdict is the honest one, never
   *  force-green). */
  gate: { passed: boolean; unmet: string[]; evidenceHash: string } | null;
  /** Machine-readable cycle trail for CLI/reporting envelopes. */
  events: string[];
};

export const P6_JOURNEY_DEFAULT_BUDGET = 3;

/** Tails are capped before they enter the next cycle's synthesis context
 *  (parity with compile-check.server's VERDICT_TAIL_MAX). */
const P6_JOURNEY_TAIL_MAX = 1500;

/** Direct DeepSeek env probe (the same probe codegen.server relies on —
 *  process.env.DEEPSEEK_API_KEY, not the server-fn llmStatus that always
 *  reports unconfigured under bare Node). */
async function p6JourneyIsKeyed(): Promise<boolean> {
  try {
    const ds = (await import("./deepseek.server.ts")) as { isDeepSeekConfigured?: () => boolean };
    return typeof ds.isDeepSeekConfigured === "function" ? ds.isDeepSeekConfigured() : false;
  } catch {
    return false;
  }
}

/** Detail of the most recent recorded P6 codegen refusal, if any. */
function p6RefusalDetail(project: Project): string | null {
  const rows = (project.logs ?? []).filter((l) => l.event === "p6.synthesis.refused" && l.phase === 6);
  const last = rows[rows.length - 1];
  return last && typeof last.detail === "string" && last.detail.trim() ? last.detail : null;
}

function p6JourneyLog(project: Project, level: "info" | "warn" | "error", event: string, detail: string): Project {
  return {
    ...project,
    logs: [
      ...(project.logs ?? []),
      { ts: Date.now(), phase: 6 as PhaseId, level, event, detail: detail.slice(0, 1800) },
    ].slice(-200),
  };
}

/** First ~tail of a red TreeRunOutcome: top-level error, then the first
 *  failing spec, then (216 · T-18) a declared project script that ran red,
 *  then the entry verdict. Never empty on a !ok outcome. */
function treeRunFailureTail(o: TreeRunOutcome): string {
  if (typeof o.error === "string" && o.error.trim().length > 0) return o.error;
  const spec = (o.tests ?? []).find((t) => t.run !== "pass");
  if (spec) {
    return `${spec.file}: ${spec.run}${spec.detail ? ` — ${spec.detail}` : ""}`;
  }
  // 216 (T-18): the emitted project's own declared script can be the ONLY red
  // (every spec leg green) — it must be named, or the repair prompt would
  // chase a spec that passed. `error` normally carries this too; this branch
  // covers a verdict that reached here without it.
  const script = [o.project?.typecheck, o.project?.test].find(
    (v) => v && (v.run === "fail" || v.run === "timeout" || v.run === "error"),
  );
  if (script) {
    return `npm run ${script.script}: ${script.run}${script.detail ? ` — ${script.detail}` : ""}`;
  }
  if (o.run && o.run.run !== "pass" && o.run.run !== "skip") {
    return `entry ${o.run.entry ?? o.run.kind}: ${o.run.run}${o.run.detail ? ` — ${o.run.detail}` : ""}`;
  }
  return "tree-run not ok";
}

/** Default produce/repair seam — the live-layer P6 synthesis the headless run
 *  loop uses today. engine.liveLayer(project, 6) applies the deterministic
 *  applyPhaseResult floor and, when DeepSeek is configured, upgrades it via
 *  codegen liveP6Synthesis (fixes/116 made that branch bare-Node-safe). The
 *  caller already ran the keyless short-circuit, so this is the keyed path.
 *  The tree-failure tail is BOTH stamped onto the project record BEFORE
 *  synthesis (deduped against the last row — a durable `p6.tree.failure` trail
 *  on the record) AND threaded as deps.treeFailure through liveLayer's
 *  additive deps param (fixes/147 E2); a previous-cycle refusal rides the
 *  same additive param as deps.synthesisRefusal — a bounded excerpt of the
 *  refusal class + model reason (fixes/153 P2). codegen liveP6Synthesis reads
 *  deps?.treeFailure for tree-repair re-prompts and deps?.synthesisRefusal
 *  for refusal-aware re-prompts. p6CycleLiveDeps is the single ctx→deps
 *  mapping. */
async function defaultP6Synthesize(project: Project, ctx: P6JourneyCycleContext): Promise<Project> {
  let p = project;
  if (ctx.treeFailureTail) {
    const logs = p.logs ?? [];
    const last = logs[logs.length - 1];
    const alreadyStamped = last && last.event === "p6.tree.failure" && last.detail === ctx.treeFailureTail;
    if (!alreadyStamped) p = p6JourneyLog(p, "warn", "p6.tree.failure", ctx.treeFailureTail);
  }
  try {
    const upgraded = await liveLayer(p, 6, p6CycleLiveDeps(ctx));
    return upgraded && upgraded !== p ? upgraded : p;
  } catch {
    return applyPhaseResult(p, 6);
  }
}

/** Default tree verdict seam: emit the generatedTree to a dir (workDir when
 *  provided — kept for evidence — else a temp dir that is removed afterwards)
 *  and run it under compile-check.server's treeRun. An emission failure is a
 *  red outcome with the honest error, never a fabricated pass. */
async function defaultP6RunTree(project: Project, workDir?: string): Promise<TreeRunOutcome> {
  const dir = workDir ?? mkdtempSync(join(tmpdir(), "rapidtool-p6-"));
  try {
    // 216 (T-07) parent audit (R2 flagged this site): this is the INTERNAL
    // candidate emit — it runs on every P6 repair cycle to produce the tree the
    // verdict then judges, so it must NEVER gate on the trail (a red trail from
    // cycle N would refuse cycle N+1's candidate and kill the repair loop).
    // `redTree: "probe"` = no trail read; the refuse/banner guard stays on the
    // ship paths (the CLI emit verb keeps the default, run-eval passes "banner").
    const emitted = await emitProject(project, dir, { redTree: "probe" });
    if (!emitted.ok) {
      return {
        ok: false,
        dir,
        compile: { ok: false, dir, checked: 0, passed: 0, failed: 1, skipped: 0, verdicts: [] },
        tests: [],
        run: null,
        error: `emit failed: ${emitted.error}`,
      };
    }
    const ccSpec = "./compile-check." + "server.ts";
    const cc = (await import(ccSpec)) as { treeRun?: (d: string) => Promise<TreeRunOutcome> };
    if (typeof cc.treeRun !== "function") {
      return {
        ok: false,
        dir,
        compile: { ok: false, dir, checked: 0, passed: 0, failed: 1, skipped: 0, verdicts: [] },
        tests: [],
        run: null,
        error: "compile-check.server treeRun unavailable",
      };
    }
    return await cc.treeRun(dir);
  } finally {
    if (!workDir) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best-effort temp cleanup */
      }
    }
  }
}

/** fixes/147 (E2): the tested-equivalent mint for a CONVERGED tree-run —
 *  delegates to codegen.server's mintTreeRunTested (the same seam run-eval's
 *  single-synthesis flow consumes), which mints lastTest {label:"tested"} ONLY
 *  when the tree-run actually executed specs; a UI-shell/no-spec green run
 *  falls back to the honest current state + a coded `p6.tree.tested.skipped`
 *  note. A codegen import failure degrades to the synthesized project — the
 *  P6 DoD gate is then recorded honestly (red p6-verified), never faked. */
async function applyTreeRunTestedMint(project: Project, verdict: TreeRunOutcome): Promise<Project> {
  try {
    const codegen = (await import("./codegen.server.ts")) as {
      mintTreeRunTested?: (p: Project, o: TreeRunOutcome) => Project;
    };
    if (typeof codegen.mintTreeRunTested === "function") return codegen.mintTreeRunTested(project, verdict);
  } catch {
    /* deterministic floor stands — the honest gate record still runs */
  }
  return project;
}

/**
 * fixes/144 (M4-2): bounded produce→run→repair journey for keyed P6.
 *
 * Contract: `project` is positioned at the P6 live edge (priors sealed, the P6
 * record deterministic or awaiting). Each cycle (budget N, default 3):
 *   1. synthesize — one attempt through the live-layer P6 synthesis seam (or
 *      an injected fake), receiving the previous cycle's failure tail/refusal
 *      as context;
 *   2. when the result carries a generatedTree, run the tree verdict (emit +
 *      compile-check treeRun, or an injected fake);
 *   3. green tree-run → the P6 DoD gate is recorded honestly (recordGateInto
 *      — real probes, never force-green) and gate.passed DECIDES the outcome:
 *      green tree-run AND gate.passed → CONVERGED (the tested-equivalent
 *      lastTest is minted when the run honestly executed specs — fixes/147 E2
 *      — codegen mintTreeRunTested; a UI-shell/no-spec green run is never
 *      stamped); green tree-run but a RED (or absent) gate → FAILED naming
 *      the gate — fixes/159 (F4): a journey whose own P6 gate is red must
 *      never return a bare "converged" (fixes/155 §6/§8 links 14/15);
 *      red tree-run → the failure tail is stamped on the project
 *      (`p6.tree.failure` warn log) and becomes the next cycle's context.
 * Budget exhausted → an honest FAILED outcome: full evidence on the project
 * record (refusal + p6.journey.exhausted) and the deterministic floor
 * standing — no silent seal. The exhausted verdict names the LAST refusal
 * text (result.refusal + the exhausted log/event excerpt) so the caller/eval
 * sees the model's final reason. KEYLESS (no injected synthesize + no key) →
 * no-op passthrough returning the SAME project reference, byte-identical.
 */
export async function driveP6Journey(
  project: Project,
  opts: { budget?: number; deps?: Partial<P6JourneyDeps>; workDir?: string } = {},
): Promise<P6JourneyResult> {
  const budget =
    typeof opts.budget === "number" && opts.budget > 0 ? Math.floor(opts.budget) : P6_JOURNEY_DEFAULT_BUDGET;
  const events: string[] = [];
  const usingDefaultSeam = opts.deps?.synthesize === undefined;
  // KEYLESS = no-op passthrough: byte-identical same-reference floor. Only the
  // DEFAULT seam short-circuits — an injected synthesize owns its key policy.
  if (usingDefaultSeam && !(await p6JourneyIsKeyed())) {
    return {
      outcome: "keyless",
      project,
      cycles: 0,
      budget,
      treeTail: null,
      refusal: null,
      gate: null,
      events: ["keyless: no DEEPSEEK_API_KEY — P6 journey is a no-op passthrough (deterministic floor)"],
    };
  }
  const synthesize = opts.deps?.synthesize ?? defaultP6Synthesize;
  const runTree = opts.deps?.runTree ?? ((p: Project): Promise<TreeRunOutcome> => defaultP6RunTree(p, opts.workDir));
  // fixes/159 (F4): the gate verdict seam — default is the REAL recordGateInto
  // over phase 6 (real probes, never force-green); a fake only replaces it in
  // unit tests, exactly like the synthesize/runTree seams above.
  const recordGate = opts.deps?.recordGate ?? ((p: Project): Project => recordGateInto(p, 6 as PhaseId));
  let p = project;
  let treeTail: string | null = null;
  let refusal: string | null = null;
  for (let cycle = 1; cycle <= budget; cycle++) {
    const ctx: P6JourneyCycleContext = { cycle };
    if (treeTail !== null) ctx.treeFailureTail = treeTail;
    if (refusal !== null) ctx.refusal = refusal;
    let synthesized: Project;
    try {
      synthesized = await synthesize(p, ctx);
    } catch (err) {
      synthesized = p;
      events.push(
        `cycle ${cycle}: synthesis seam threw (${err instanceof Error ? err.message : String(err)}) — deterministic floor stands`,
      );
    }
    const ref = p6RefusalDetail(synthesized);
    if (ref !== null) refusal = ref;
    const tree = synthesized.generatedTree;
    if (!Array.isArray(tree) || tree.length === 0) {
      // No runnable tree → the cycle did not converge. The codegen refusal
      // detail (or an honest no-tree note) becomes the next cycle's context.
      treeTail = (refusal ?? `cycle ${cycle}: synthesis produced no generatedTree (deterministic floor)`).slice(
        0,
        P6_JOURNEY_TAIL_MAX,
      );
      events.push(
        `cycle ${cycle}: no generatedTree after synthesis${refusal ? ` — ${refusal.slice(0, 140)}` : ""}`,
      );
      p = synthesized;
      continue;
    }
    let verdict: TreeRunOutcome;
    try {
      verdict = await runTree(synthesized);
    } catch (err) {
      verdict = {
        ok: false,
        dir: opts.workDir ?? "",
        compile: { ok: false, dir: opts.workDir ?? "", checked: 0, passed: 0, failed: 1, skipped: 0, verdicts: [] },
        tests: [],
        run: null,
        error: `tree-run seam threw: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    if (verdict.ok === true) {
      // GREEN tree-run. Convergence is NOT automatic: fixes/155 §6/§8 (chain
      // links 14/15) + fixes/157 P0-2(b) — the pre-fixes/159 code recorded the
      // P6 DoD gate (honestly red on a stub floor) and then returned
      // "converged" WITHOUT reading gate.passed: a journey could converge
      // while its own gate was red (the recorded-then-ignored gate). Now:
      //  1. record the P6 DoD gate honestly FIRST (recordGateInto runs the
      //     real probes; never force-green);
      //  2. gate.passed === true → mint tested-equivalent lastTest THEN
      //     CONVERGED; gate red or absent → FAILED naming the gate, and
      //     NEVER mint lastTest:"tested" (T0.6 — mint-after-gate).
      let finalProject = synthesized;
      let gate: P6JourneyResult["gate"] = null;
      const rec6 = (finalProject.phases ?? []).find((ph) => ph.id === 6);
      if (rec6?.status === "complete") {
        finalProject = recordGate(finalProject);
        const g = (finalProject.phases ?? []).find((ph) => ph.id === 6)?.gate;
        if (g && typeof g === "object") {
          gate = {
            passed: g.passed === true,
            unmet: Array.isArray(g.unmet) ? g.unmet.map((u) => String(u)) : [],
            evidenceHash: typeof g.evidenceHash === "string" ? g.evidenceHash : "",
          };
        }
      }
      if (gate !== null && gate.passed === true) {
        // A6: when fixtures exist, converge only if every case is human-approved
        // AND the oracle spec actually asserted (never auto-approve; never
        // treat load-only as behavioral).
        const fx = finalProject.acceptanceFixtures;
        if (Array.isArray(fx) && fx.length > 0) {
          const approved = approvedAcceptanceFixtures(fx);
          if (!approved) {
            const pending = fx.filter((c) => c.approval !== "approved").map((c) => c.id);
            finalProject = p6JourneyLog(
              finalProject,
              "error",
              "p6.journey.failed",
              `tree-run ok + P6 gate green but fixtures pending (${pending.join(", ") || fx.length}) — never auto-approve`,
            );
            events.push(`cycle ${cycle}: fixtures pending — P6 journey FAILED`);
            return { outcome: "failed", project: finalProject, cycles: cycle, budget, treeTail: null, refusal, gate, events };
          }
          const spec = (verdict.tests ?? []).find((t) => t.file === "tests/oracle.spec.ts" || t.file.endsWith("oracle.spec.ts"));
          if (!spec || spec.run !== "pass" || spec.tests.pass === 0) {
            const why = spec?.detail ?? "no behavioral assertion ran";
            finalProject = p6JourneyLog(
              finalProject,
              "error",
              "p6.journey.failed",
              `approved fixtures did not pass under treeRun — ${why}`,
            );
            events.push(`cycle ${cycle}: fixtures red under treeRun — P6 journey FAILED`);
            return { outcome: "failed", project: finalProject, cycles: cycle, budget, treeTail: null, refusal, gate, events };
          }
        }
        finalProject = await applyTreeRunTestedMint(finalProject, verdict);
        finalProject = p6JourneyLog(
          finalProject,
          "info",
          "p6.journey.converged",
          `tree-run ok after ${cycle}/${budget} cycle(s) + P6 gate green (${gate.evidenceHash.slice(0, 8)})`,
        );
        events.push(`cycle ${cycle}: tree-run ok + P6 gate passed — P6 journey converged`);
        return { outcome: "converged", project: finalProject, cycles: cycle, budget, treeTail: null, refusal, gate, events };
      }
      // Green tree-run but the journey's OWN P6 gate is red (or was never
      // recorded) — this is a recorded failure, never convergence. The
      // evidence names the failed gate + its unmet criteria (the honest
      // qualifier: the treeRun being green is what the DoD gate just weighed
      // and found wanting — "converged" would hide it).
      const gateReason =
        gate === null
          ? "no P6 DoD gate record (phase 6 not complete) — converged cannot be asserted without a gate verdict"
          : `P6 gate FAIL · ${gate.unmet.length} unmet · ${gate.evidenceHash.slice(0, 8)}${
              gate.unmet.length > 0 ? ` — ${gate.unmet[0]!.slice(0, 120)}` : ""
            }`;
      finalProject = p6JourneyLog(
        finalProject,
        "error",
        "p6.journey.failed",
        `tree-run ok after ${cycle}/${budget} cycle(s) but ${gateReason} — journey FAILED, not converged (converged requires treeRun ok AND gate.passed)`,
      );
      events.push(`cycle ${cycle}: tree-run ok but ${gateReason} — P6 journey FAILED (converged requires gate.passed)`);
      return { outcome: "failed", project: finalProject, cycles: cycle, budget, treeTail: null, refusal, gate, events };
    }
    treeTail = treeRunFailureTail(verdict).slice(0, P6_JOURNEY_TAIL_MAX);
    p = p6JourneyLog(synthesized, "warn", "p6.tree.failure", treeTail);
    events.push(`cycle ${cycle}: tree-run fail — ${treeTail.slice(0, 140)}`);
  }
  // Budget exhausted → honest FAILED outcome; the deterministic floor (the
  // project the seam last left, with its refusal/tree-failure evidence) stands.
  p = p6JourneyLog(
    p,
    "error",
    "p6.journey.exhausted",
    `${budget} cycle(s) without a green tree-run${refusal ? ` — last refusal: ${refusal.slice(0, 180)}` : ""}`,
  );
  events.push(
    `budget exhausted after ${budget} cycle(s) — P6 journey FAILED, deterministic floor stands${
      refusal !== null ? ` — last refusal: ${refusal.slice(0, 180)}` : ""
    }`,
  );
  return { outcome: "failed", project: p, cycles: budget, budget, treeTail, refusal, gate: null, events };
}

// ---------------------------------------------------------------------------
// fixes/149 P0-1 (150-G1) — the emit→edit→re-emit continuation seam.
//
// The emitted dir is a first-class ARTIFACT; the project JSON is the LEDGER.
//   importTreeDir  — reads the dir's tree files back into project.generatedTree
//                    (path→content, per-file fnv1a hash — a NEW hash means the
//                    edit is real). Refused/missing paths are WARNINGS, never
//                    silent drops (scaffold.ts treePathRefusal parity).
//   repairTreeDir  — bounded repair cycle AGAINST the dir, reusing the
//                    driveP6Journey seam pieces above: treeRun(dir) → red tail
//                    → one bounded synthesis repair call whose ctx reaches
//                    codegen as deps.treeFailure (p6CycleLiveDeps) → the
//                    repaired tree files are applied onto the dir IN PLACE →
//                    re-import (disk truth back into the ledger) → treeRun
//                    again. Green → the tested-equivalent mint
//                    (applyTreeRunTestedMint) + the honest P6 gate record.
//                    Budget exhausted → honest FAILED + deterministic floor.
// emitProject is NEVER called here — the dir is never re-emitted over; only
// tree rows whose content changed are written back (that write IS the repair).
// ---------------------------------------------------------------------------

/** scaffold.ts treePathRefusal parity: the allowed repo-relative roots a tree
 *  file may live at (src/ subdir families + tests/). Mirrored here because
 *  scaffold.ts is not this seam's file — keep in sync (single discipline). */
const REPAIR_TREE_ALLOWED_ROOTS = [
  "src/api/",
  "src/domain/",
  "src/jobs/",
  "src/state/",
  "src/ui/",
  "src/generated/",
  "tests/",
];

/** scaffold.ts TREE_RESERVED parity — scaffold-owned files a tree row may
 *  never claim (tests/oracle.spec.ts is the machine-verified acceptance
 *  contract, always emitted by the scaffold itself). */
const REPAIR_TREE_RESERVED = new Set(["tests/oracle.spec.ts"]);

/** A single safe path segment — the same charset the emitter's own paths use. */
const REPAIR_TREE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** Validate one tree path for dir re-import/apply — null when safe, else a
 *  human refusal reason. Mirrors scaffold.ts treePathRefusal (traversal,
 *  absolute, reserved, unsafe-segment and outside-root rows are refused
 *  loudly — a hostile row can never read/write outside the emitted dir). */
function repairTreePathRefusal(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return "path is not a non-empty string";
  const p = raw;
  if (p.includes("\\"))
    return `backslash path ${JSON.stringify(p)} is not repo-relative (Windows separators refused)`;
  if (p.startsWith("/")) return `absolute path ${JSON.stringify(p)} is not repo-relative`;
  if (/^[A-Za-z]:/.test(p))
    return `drive-absolute path ${JSON.stringify(p)} is not repo-relative`;
  if (REPAIR_TREE_RESERVED.has(p))
    return `reserved scaffold file ${JSON.stringify(p)} cannot be a generated tree file`;
  const parts = p.split("/");
  if (parts.some((seg) => !seg || seg === "." || seg === ".."))
    return `path ${JSON.stringify(p)} contains an empty or traversal (..) segment`;
  if (parts.some((seg) => !REPAIR_TREE_SEGMENT.test(seg)))
    return `path ${JSON.stringify(p)} contains an unsafe segment (allowed: [A-Za-z0-9._-])`;
  if (!REPAIR_TREE_ALLOWED_ROOTS.some((root) => p.startsWith(root)))
    return `path ${JSON.stringify(p)} is outside the scaffold's src/ subdirs and tests/`;
  return null;
}

export type ImportTreeDirResult = {
  /** The ledger project with every readable tree row refreshed from the dir. */
  project: Project;
  /** Tree paths whose on-disk content was read back into the ledger. */
  imported: string[];
  /** Imported rows byte-identical to the ledger row (same hash — untouched). */
  unchanged: string[];
  /** Imported rows whose on-disk hash differs from the ledger row (real edit). */
  changed: string[];
  /** Ledger rows whose file is missing/unreadable in the dir (kept + warned). */
  missing: string[];
  /** Ledger rows whose path failed the tree-path discipline (kept + warned). */
  refused: string[];
  warnings: string[];
};

/**
 * fixes/149 P0-1: hash-checked dir→ledger re-import. For every
 * project.generatedTree row, read the file at its own path inside `dir` and
 * rebuild the row from the on-disk bytes (fnv1a hash — a hash that differs
 * from the ledger row's is a REAL edit). Pure read: no file is written, no row
 * is silently dropped — a refused path (traversal/absolute/reserved/outside
 * root, scaffold.ts discipline) or a missing file keeps the ledger row and is
 * listed in `warnings`. The returned project is the honest ledger state.
 */
export function importTreeDir(project: Project, dir: string): ImportTreeDirResult {
  const target = resolve(dir);
  const tree = Array.isArray(project.generatedTree) ? project.generatedTree : [];
  const imported: string[] = [];
  const unchanged: string[] = [];
  const changed: string[] = [];
  const missing: string[] = [];
  const refused: string[] = [];
  const warnings: string[] = [];
  const out: GeneratedTreeFile[] = [];
  for (const row of tree) {
    const raw = row as Partial<GeneratedTreeFile> | null | undefined;
    const path = raw && typeof raw.path === "string" ? raw.path : "";
    const keep = (): GeneratedTreeFile => ({
      path: path || "<no-path>",
      source: typeof raw?.source === "string" ? raw.source : "",
      hash: typeof raw?.hash === "string" ? raw.hash : "",
      attempt: typeof raw?.attempt === "number" ? raw.attempt : 0,
    });
    if (!path) {
      refused.push("<no-path>");
      warnings.push("generatedTree:refused:<no-path>:row is not a file record — kept in the ledger, never read from the dir");
      out.push(keep());
      continue;
    }
    const refusal = repairTreePathRefusal(path);
    if (refusal !== null) {
      refused.push(path);
      warnings.push(
        `generatedTree:refused:${JSON.stringify(path)}:${refusal} — row kept in the ledger, never read from the dir`,
      );
      out.push(keep());
      continue;
    }
    let body: string | null = null;
    try {
      const full = join(target, path);
      if (existsSync(full)) body = readFileSync(full, "utf8");
    } catch {
      body = null;
    }
    if (body === null) {
      missing.push(path);
      warnings.push(
        `generatedTree:missing:${JSON.stringify(path)}:no readable file in ${target} — ledger row kept (the artifact lost the file); tree-run will surface the break`,
      );
      out.push(keep());
      continue;
    }
    const hash = String(fnv1a(body));
    (hash === (typeof raw?.hash === "string" ? raw.hash : "") ? unchanged : changed).push(path);
    imported.push(path);
    out.push({
      path,
      source: body,
      hash,
      attempt: typeof raw?.attempt === "number" ? raw.attempt : 0,
    });
  }
  return {
    project: { ...project, generatedTree: out },
    imported,
    unchanged,
    changed,
    missing,
    refused,
    warnings,
  };
}

/** One repair-cycle synthesis/run seam pair — the dir-based sibling of
 *  P6JourneyDeps. Defaults are the PRODUCTION seams (live-layer P6 synthesis
 *  + compile-check treeRun over the dir); fakes replace them in unit tests
 *  only (deterministic, no key / network). */
export type RepairTreeDeps = {
  /** Produce/repair seam — one bounded synthesis attempt. Default: the SAME
   *  defaultP6Synthesize driveP6Journey uses (liveLayer phase 6; the red tail
   *  reaches codegen as deps.treeFailure via p6CycleLiveDeps). */
  synthesize: (project: Project, ctx: P6JourneyCycleContext) => Promise<Project>;
  /** Tree verdict seam over the ARTIFACT dir (never an emit — the dir is the
   *  artifact). Default: compile-check.server's dir-based treeRun. */
  runTree: (dir: string) => Promise<TreeRunOutcome>;
};

export type RepairTreeResult = {
  ok: boolean;
  /** Set only on pre-flight failure (unreadable dir / no tree to repair). */
  error?: string;
  outcome: "converged" | "failed";
  /** The ledger after the run: imported disk truth + mint/gate/log stamps. */
  project: Project;
  /** Normalized absolute artifact dir. */
  dir: string;
  /** Synthesis repair attempts executed (0 = the dir was green on first run). */
  cycles: number;
  budget: number;
  /** Last tree-run failure tail seen (null on converge / none). */
  treeTail: string | null;
  /** Last codegen refusal detail seen (p6.synthesis.refused), if any. */
  refusal: string | null;
  /** Recorded P6 DoD gate after convergence (null unless the P6 record is
   *  complete and was re-recorded — the honest verdict, never force-green). */
  gate: { passed: boolean; unmet: string[]; evidenceHash: string } | null;
  /** Final tree verdict (the run that decided converge/fail). */
  treeRun: TreeRunOutcome | null;
  /** True when this repair flipped the project's lastTest to label "tested"
   *  via the tested-equivalent mint (never on a red / no-spec run). */
  minted: boolean;
  /** First-import telemetry (the hash-checked edit report). */
  import: ImportTreeDirResult;
  /** Repair writes performed onto the dir (union across cycles). */
  applied: { written: string[]; unchanged: string[]; refused: string[]; warnings: string[] };
  events: string[];
};

/** Default repair runTree seam: compile-check.server's dir-based treeRun. An
 *  unavailable seam is a red outcome with the honest error — never a pass. */
async function defaultRepairRunTree(dir: string): Promise<TreeRunOutcome> {
  try {
    const ccSpec = "./compile-check." + "server.ts";
    const cc = (await import(ccSpec)) as { treeRun?: (d: string) => Promise<TreeRunOutcome> };
    if (typeof cc.treeRun !== "function") {
      return {
        ok: false,
        dir: resolve(dir),
        compile: { ok: false, dir: resolve(dir), checked: 0, passed: 0, failed: 1, skipped: 0, verdicts: [] },
        tests: [],
        run: null,
        error: "compile-check.server treeRun unavailable",
      };
    }
    return await cc.treeRun(dir);
  } catch (err) {
    return {
      ok: false,
      dir: resolve(dir),
      compile: { ok: false, dir: resolve(dir), checked: 0, passed: 0, failed: 1, skipped: 0, verdicts: [] },
      tests: [],
      run: null,
      error: `tree-run seam unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** 216 (T-02): the set of `generatedTree` paths whose source does NOT parse,
 *  resolved through the SAME string-computed dynamic seam `treeRun` uses —
 *  because `typescript` is a devDependency and must never enter this module's
 *  static graph. Refusing to write a non-parsing row is the whole point: the
 *  checker already existed, it just sat off the write path.
 *
 *  Deliberately fail-OPEN when the seam is unavailable: in exactly that case the
 *  tree-run verdict over the same artifact is unavailable too, so no cycle can
 *  reach a green verdict by bypassing this gate — there is no false pass to
 *  protect against, and refusing every write would break runs (e.g. a
 *  production install without devDependencies) that the tree lane already
 *  reports honestly as unverifiable. Never throws. */
async function parseGateTreeRows(synthesized: Project): Promise<ReadonlySet<string>> {
  const out = new Set<string>();
  const rows = Array.isArray(synthesized.generatedTree) ? synthesized.generatedTree : [];
  if (rows.length === 0) return out;
  try {
    const ccSpec = "./compile-check." + "server.ts";
    const cc = (await import(ccSpec)) as {
      parseVerdictForSource?: (p: string, s: string) => { verdict: string | null; detail?: string };
    };
    if (typeof cc.parseVerdictForSource !== "function") return out;
    for (const row of rows) {
      const path = typeof row?.path === "string" ? row.path : "";
      if (!path || typeof row?.source !== "string") continue; // the applier refuses these already
      const v = cc.parseVerdictForSource(path, row.source);
      if (v.verdict !== "pass") out.add(path);
    }
  } catch {
    /* seam unavailable — see the fail-open note above */
  }
  return out;
}

/** Write the tree rows of a synthesized project onto the artifact dir IN
 *  PLACE — only rows whose on-disk content differs are written (hash-checked
 *  per file against the disk), never deleting files, never touching non-tree
 *  files (README/DEPLOY/package.json/.rapidtool survive untouched — this is
 *  NOT a re-emit). Refused rows are warnings, never silent. */
function applySynthesizedTreeToDir(
  synthesized: Project,
  dir: string,
  /** 216 (T-02): paths pre-judged as non-parsing by the compile-check seam
   *  (`parseGateTreeRows`). A path in this set is refused, never written. */
  refuseNonParsing?: ReadonlySet<string>,
): { written: string[]; unchanged: string[]; refused: string[]; warnings: string[] } {
  const target = resolve(dir);
  const written: string[] = [];
  const unchanged: string[] = [];
  const refused: string[] = [];
  const warnings: string[] = [];
  const tree = Array.isArray(synthesized.generatedTree) ? synthesized.generatedTree : [];
  for (const row of tree) {
    const path = typeof row?.path === "string" ? row.path : "";
    if (!path || typeof row?.source !== "string") {
      refused.push(path || "<no-path>");
      warnings.push("repair:apply:refused:<no-path>:row is not a file record — nothing written");
      continue;
    }
    const refusal = repairTreePathRefusal(path);
    if (refusal !== null) {
      refused.push(path);
      warnings.push(`repair:apply:refused:${JSON.stringify(path)}:${refusal} — nothing written`);
      continue;
    }
    const full = join(target, path);
    let disk: string | null = null;
    try {
      if (existsSync(full)) disk = readFileSync(full, "utf8");
    } catch {
      disk = null;
    }
    // 216 (T-02): a row whose source does not parse never reaches the disk.
    // Previously the checker existed but sat OFF the write path, so corruption
    // (the `module.exports = {…}` strip leaving a dangling `};`) landed in the
    // artifact and was only discovered afterwards.
    if (refuseNonParsing !== undefined && refuseNonParsing.has(path)) {
      refused.push(path);
      warnings.push(
        `repair:apply:refused:${JSON.stringify(path)}:source does not parse — nothing written (216 T-02 parse gate)`,
      );
      continue;
    }
    if (disk === row.source) {
      unchanged.push(path);
      continue;
    }
    // 216 (T-03): write temp + rename, so a crash mid-write can never leave a
    // TRUNCATED file in the artifact. The product is the deliverable, so it is
    // now written at least as carefully as the bookkeeping — saveProject has
    // used tmp+rename (+ an O_EXCL lock) since 174-13. Cleanup is best-effort.
    const tmp = `${full}.tmp-${process.pid}-${Date.now()}`;
    try {
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(tmp, row.source, "utf8");
      renameSync(tmp, full);
      written.push(path);
    } catch (err) {
      try {
        if (existsSync(tmp)) rmSync(tmp, { force: true });
      } catch {
        /* best-effort temp cleanup */
      }
      warnings.push(
        `repair:apply:failed:${JSON.stringify(path)}:${err instanceof Error ? err.message : String(err)} — nothing written`,
      );
    }
  }
  return { written, unchanged, refused, warnings };
}

/**
 * fixes/149 P0-1: bounded repair cycle AGAINST an emitted dir. Contract: the
 * project ledger whose generatedTree was emitted to `dir` (the artifact), and
 * an agent (human or machine) has EDITED files inside that dir. Steps:
 *   1. importTreeDir — hash-checked re-import (a new hash = a real edit);
 *   2. treeRun(dir) — green ⇒ the edit already fixed it: converged with the
 *      tested-equivalent mint (applyTreeRunTestedMint) + the honest P6 gate
 *      record (driveP6Journey green-branch parity), 0 synthesis cycles;
 *      red ⇒ the failure tail becomes cycle-1 context;
 *   3. each cycle (budget N, default P6_JOURNEY_DEFAULT_BUDGET): one bounded
 *      synthesis repair call (ctx.treeFailureTail rides deps.treeFailure into
 *      codegen via p6CycleLiveDeps — the same seam driveP6Journey uses), the
 *      repaired tree rows are applied onto the dir IN PLACE, the dir is
 *      re-imported (ledger = disk truth), and treeRun(dir) decides:
 *      green ⇒ mint + gate + converged; red ⇒ tail feeds the next cycle.
 * Budget exhausted ⇒ honest FAILED (p6.tree.failure + p6.journey.exhausted on
 * the record), deterministic floor standing, no silent seal. NEVER re-emits
 * over the dir — emitProject is not part of this seam.
 */
export async function repairTreeDir(
  project: Project,
  dir: string,
  opts: { budget?: number; deps?: Partial<RepairTreeDeps> } = {},
): Promise<RepairTreeResult> {
  const target = resolve(dir);
  const budget =
    typeof opts.budget === "number" && opts.budget > 0 ? Math.floor(opts.budget) : P6_JOURNEY_DEFAULT_BUDGET;
  const events: string[] = [];
  const synthesize = opts.deps?.synthesize ?? defaultP6Synthesize;
  const runTree = opts.deps?.runTree ?? defaultRepairRunTree;
  const base = { written: [] as string[], unchanged: [] as string[], refused: [] as string[], warnings: [] as string[] };
  const fail = (error: string): RepairTreeResult => ({
    ok: false,
    error,
    outcome: "failed",
    project,
    dir: target,
    cycles: 0,
    budget,
    treeTail: null,
    refusal: null,
    gate: null,
    treeRun: null,
    minted: false,
    import: { project, imported: [], unchanged: [], changed: [], missing: [], refused: [], warnings: [] },
    applied: { ...base },
    events,
  });
  // Pre-flight: the dir must exist and the ledger must carry a tree to repair.
  if (!existsSync(target)) return fail(`repair: dir ${target} is not readable`);
  const treeRows = Array.isArray(project.generatedTree) ? project.generatedTree : [];
  if (treeRows.length === 0) {
    return fail("repair: the project carries no generatedTree — emit the tree to the dir first (the project is the ledger, the dir is the artifact)");
  }
  // 1. Hash-checked re-import of the EDITED dir into the ledger.
  const imported = importTreeDir(project, target);
  let p = imported.project;
  events.push(
    `import: ${imported.imported.length} file(s) re-read from ${target} (${imported.changed.length} changed, ${imported.unchanged.length} unchanged${imported.missing.length ? `, ${imported.missing.length} missing` : ""}${imported.refused.length ? `, ${imported.refused.length} refused` : ""})`,
  );
  const recordGreen = async (candidate: Project, verdict: TreeRunOutcome): Promise<{ project: Project; gate: RepairTreeResult["gate"]; minted: boolean }> => {
    const before = candidate.lastTest as { label?: string } | null | undefined;
    // T0.6: record the P6 gate FIRST; mint lastTest:"tested" only when it passed.
    let finalProject = candidate;
    let gate: RepairTreeResult["gate"] = null;
    const rec6 = (finalProject.phases ?? []).find((ph) => ph.id === 6);
    if (rec6?.status === "complete") {
      finalProject = recordGateInto(finalProject, 6 as PhaseId);
      const g = (finalProject.phases ?? []).find((ph) => ph.id === 6)?.gate;
      if (g && typeof g === "object") {
        gate = {
          passed: g.passed === true,
          unmet: Array.isArray(g.unmet) ? g.unmet.map((u) => String(u)) : [],
          evidenceHash: typeof g.evidenceHash === "string" ? g.evidenceHash : "",
        };
      }
    }
    if (gate !== null && gate.passed === true) {
      finalProject = await applyTreeRunTestedMint(finalProject, verdict);
    }
    const minted =
      (finalProject.lastTest as { label?: string } | null | undefined)?.label === "tested" &&
      (before as { label?: string } | null | undefined)?.label !== "tested";
    return { project: finalProject, gate, minted };
  };
  // 2. First verdict over the untouched dir (read-only — never clobber before
  //    reading: the edit is the whole point of this seam).
  let verdict: TreeRunOutcome;
  try {
    verdict = await runTree(target);
  } catch (err) {
    verdict = {
      ok: false,
      dir: target,
      compile: { ok: false, dir: target, checked: 0, passed: 0, failed: 1, skipped: 0, verdicts: [] },
      tests: [],
      run: null,
      error: `tree-run seam threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (verdict.ok === true) {
    // The edited dir is ALREADY tree-green. Convergence still requires the
    // honest P6 gate (T0.6 / 165-C-1): tree-green + red gate is FAILED, never
    // ok:true / minted tested.
    const green = await recordGreen(p, verdict);
    if (green.gate !== null && green.gate.passed === true) {
      p = p6JourneyLog(green.project, "info", "p6.journey.converged", "tree-run ok on the first run — dir green after re-import (no synthesis repair needed)");
      events.push(`cycle 0: tree-run ok over the re-imported dir — converged without synthesis`);
      return {
        ok: true,
        outcome: "converged",
        project: p,
        dir: target,
        cycles: 0,
        budget,
        treeTail: null,
        refusal: null,
        gate: green.gate,
        treeRun: verdict,
        minted: green.minted,
        import: imported,
        applied: { ...base },
        events,
      };
    }
    p = p6JourneyLog(
      green.project,
      "error",
      "p6.journey.failed",
      `tree-run ok on first run but ${green.gate === null ? "no P6 DoD gate record" : "P6 gate FAIL"} — repair FAILED, not converged (converged requires treeRun ok AND gate.passed)`,
    );
    events.push(`cycle 0: tree-run ok but P6 gate not green — repair FAILED`);
    return {
      ok: false,
      outcome: "failed",
      project: p,
      dir: target,
      cycles: 0,
      budget,
      treeTail: null,
      refusal: null,
      gate: green.gate,
      treeRun: verdict,
      minted: false,
      import: imported,
      applied: { ...base },
      events,
    };
  }
  // 3. Red first run → bounded repair cycle against the dir.
  let treeTail = treeRunFailureTail(verdict).slice(0, P6_JOURNEY_TAIL_MAX);
  p = p6JourneyLog(p, "warn", "p6.tree.failure", treeTail);
  events.push(`tree-run fail (pre-cycle): ${treeTail.slice(0, 140)}`);
  let refusal: string | null = null;
  const applied = { written: [] as string[], unchanged: [] as string[], refused: [] as string[], warnings: [] as string[] };
  for (let cycle = 1; cycle <= budget; cycle++) {
    const ctx: P6JourneyCycleContext = { cycle };
    if (treeTail !== null) ctx.treeFailureTail = treeTail;
    if (refusal !== null) ctx.refusal = refusal;
    let synthesized: Project;
    try {
      synthesized = await synthesize(p, ctx);
    } catch (err) {
      synthesized = p;
      events.push(
        `cycle ${cycle}: synthesis seam threw (${err instanceof Error ? err.message : String(err)}) — no repair applied`,
      );
    }
    const ref = p6RefusalDetail(synthesized);
    if (ref !== null) refusal = ref;
    const tree = synthesized.generatedTree;
    if (!Array.isArray(tree) || tree.length === 0) {
      // The seam produced no tree (codegen refusal / floor) — nothing to
      // apply; the dir is unchanged so a re-run would be a guaranteed repeat
      // of the same verdict. Feed the refusal/note forward (journey parity).
      treeTail = (refusal ?? `cycle ${cycle}: synthesis produced no generatedTree (deterministic floor)`).slice(
        0,
        P6_JOURNEY_TAIL_MAX,
      );
      events.push(
        `cycle ${cycle}: no generatedTree after synthesis${refusal ? ` — ${refusal.slice(0, 140)}` : ""} — nothing applied to the dir`,
      );
      p = synthesized;
      continue;
    }
    // 3a. Apply the repaired rows onto the dir IN PLACE (only changed files).
    // 216 (T-02): parse-gate FIRST — a row whose source does not parse is
    // refused rather than written, so a corrupted synthesis cannot land in the
    // artifact at all (the class that traced to 431 tsc errors).
    const nonParsing = await parseGateTreeRows(synthesized);
    const apply = applySynthesizedTreeToDir(synthesized, target, nonParsing);
    for (const w of apply.written) if (!applied.written.includes(w)) applied.written.push(w);
    for (const w of apply.warnings) if (!applied.warnings.includes(w)) applied.warnings.push(w);
    for (const r of apply.refused) if (!applied.refused.includes(r)) applied.refused.push(r);
    // 3b. Re-import: the ledger becomes the disk truth again (hash-checked).
    const reimported = importTreeDir(synthesized, target);
    p = reimported.project;
    // 3c. Verdict over the repaired artifact.
    try {
      verdict = await runTree(target);
    } catch (err) {
      verdict = {
        ok: false,
        dir: target,
        compile: { ok: false, dir: target, checked: 0, passed: 0, failed: 1, skipped: 0, verdicts: [] },
        tests: [],
        run: null,
        error: `tree-run seam threw: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    if (verdict.ok === true) {
      const green = await recordGreen(p, verdict);
      if (green.gate !== null && green.gate.passed === true) {
        p = p6JourneyLog(green.project, "info", "p6.journey.converged", `tree-run ok after ${cycle}/${budget} repair cycle(s)`);
        events.push(`cycle ${cycle}: tree-run ok — repair converged`);
        return {
          ok: true,
          outcome: "converged",
          project: p,
          dir: target,
          cycles: cycle,
          budget,
          treeTail: null,
          refusal,
          gate: green.gate,
          treeRun: verdict,
          minted: green.minted,
          import: imported,
          applied,
          events,
        };
      }
      p = p6JourneyLog(
        green.project,
        "error",
        "p6.journey.failed",
        `tree-run ok after ${cycle}/${budget} cycle(s) but ${green.gate === null ? "no P6 DoD gate record" : "P6 gate FAIL"} — repair FAILED, not converged`,
      );
      events.push(`cycle ${cycle}: tree-run ok but P6 gate not green — repair FAILED`);
      return {
        ok: false,
        outcome: "failed",
        project: p,
        dir: target,
        cycles: cycle,
        budget,
        treeTail: null,
        refusal,
        gate: green.gate,
        treeRun: verdict,
        minted: false,
        import: imported,
        applied,
        events,
      };
    }
    treeTail = treeRunFailureTail(verdict).slice(0, P6_JOURNEY_TAIL_MAX);
    p = p6JourneyLog(p, "warn", "p6.tree.failure", treeTail);
    events.push(`cycle ${cycle}: tree-run fail — ${treeTail.slice(0, 140)}`);
  }
  p = p6JourneyLog(
    p,
    "error",
    "p6.journey.exhausted",
    `${budget} repair cycle(s) without a green tree-run over ${target}${refusal ? ` — last refusal: ${refusal.slice(0, 180)}` : ""} — the edited dir stands as-is (never clobbered)`,
  );
  events.push(`budget exhausted after ${budget} repair cycle(s) — repair FAILED, the edited dir stands as-is`);
  return {
    ok: false,
    outcome: "failed",
    project: p,
    dir: target,
    cycles: budget,
    budget,
    treeTail,
    refusal,
    gate: null,
    treeRun: verdict,
    minted: false,
    import: imported,
    applied,
    events,
  };
}

export async function writeVault(project: Project, dir: string): Promise<WriteVaultResult> {
  const vault = await loadVaultModule();
  const notes = vault.buildVaultNotes(project);
  const blocks = splitVaultBlocks(vault.vaultMarkdown(notes));
  const names = titleNameMap(blocks);
  const target = resolve(dir);
  mkdirSync(target, { recursive: true });
  const files: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const title = blockTitle(blocks[i]);
    const stem = (title && names.get(title)) || nameForTitle(title ?? "", i, new Set());
    const file = `${stem}.md`;
    const markdown = rewriteLinks(blocks[i].trimEnd(), names) + "\n";
    writeFileSync(join(target, file), markdown, "utf8");
    files.push(file);
  }
  files.sort();
  const noteCount = files.length;
  files.push("_index.md");
  writeFileSync(join(target, "_index.md"), rewriteLinks(vault.vaultIndex(notes), names), "utf8");
  return { dir: target, count: noteCount, files };
}

export type VaultSearchHit = {
  title: string;
  kind: string;
  tags: string[];
};

function asSearchHit(note: unknown): VaultSearchHit | null {
  const n = note as VaultNote | undefined;
  if (!n || typeof n !== "object") return null;
  const title = typeof n.title === "string" && n.title.trim() ? n.title.trim() : "note";
  const kind = typeof n.kind === "string" && n.kind.trim() ? n.kind.trim() : "note";
  const tags = Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === "string") : [];
  return { title, kind, tags };
}

/**
 * Search the project's vault notes (buildVaultNotes → searchVault: pure
 * case-insensitive substring search over title+body+tags, ranked
 * title > tag > body). Hits are mapped to their agent-facing title/kind/tags,
 * best first, capped at `limit`.
 */
export async function vaultSearch(project: Project, query: string, limit = 10): Promise<VaultSearchHit[]> {
  const q = typeof query === "string" ? query.trim() : "";
  if (!q) throw new Error("vaultSearch requires a non-empty query.");
  const vault = await loadVaultModule();
  const notes = vault.buildVaultNotes(project);
  const want = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 200) : 10;
  return (vault.searchVault(notes, q) as unknown[])
    .map(asSearchHit)
    .filter((hit): hit is VaultSearchHit => hit !== null)
    .slice(0, want);
}

// ---------------------------------------------------------------------------
// Crew + verify (server-side orchestrators, DYNAMIC imports only so the
// deterministic headless paths never pull them; both are bare-Node friendly —
// fetch-based backends + the local bounded runner, nothing browser-bound).
// ---------------------------------------------------------------------------

export type CrewRunResultShape =
  | { ok: true; messages: unknown[]; artifacts: unknown[]; stopped: string }
  | { ok: false; reason: "not-configured" | "error"; error?: string };

/**
 * Run the advisory multi-agent crew over the project's current phase
 * (src/lib/crew.server.ts runCrewServer). Config-gated: no DEEPSEEK_API_KEY →
 * { ok:false, reason:"not-configured" } — never fabricated.
 */
export async function runCrew(
  project: Project,
  opts: { maxSteps?: number } = {},
): Promise<CrewRunResultShape> {
  const { runCrewServer } = await import("./crew.server.ts");
  return (await runCrewServer(project, opts)) as CrewRunResultShape;
}

// E-06/A3-05 (fixes/134 T1.2): VerifyOutcomeShape, withCommonJsExports and
// applyVerifyOutcome now live in the client-safe verify.ts seam (the store's
// runVerifyAsync action must apply outcomes in the browser bundle without
// pulling this module's server-only node:fs surface). Re-exported here so the
// CLI verify --apply seam (h.applyVerifyOutcome), headless.test.ts and this
// module's own verifyGeneratedSource keep one import site.
export { applyVerifyOutcome, withCommonJsExports } from "./verify.ts";
import { withCommonJsExports } from "./verify.ts";
import type { VerifyOutcomeShape } from "./verify.ts";

/**
 * Machine-run verify-fix loop over the project's generated source
 * (src/lib/verify.server.ts verifyAndFixServer; needs DEEPSEEK_API_KEY —
 * otherwise an honest { status:"not-configured" }). Throws when the project
 * has no generated source yet (codegen phases never ran).
 *
 * Root cause fixed at this seam (audit-46): the P6 engine template
 * (sandbox.ts buildPhase6Module) declares top-level functions but exports
 * nothing, and the verify harness binds oracle expressions via
 * `with(exports)` — so every machine case failed with `X is not defined`.
 * `withCommonJsExports` appends guarded CommonJS export assignments for the
 * source's top-level functions before the loop runs.
 */
export async function verifyGeneratedSource(project: Project): Promise<VerifyOutcomeShape> {
  const source = typeof project.generatedSource === "string" ? project.generatedSource : "";
  if (!source.trim()) {
    throw new Error("Project has no generatedSource yet — run the codegen phases (P10+) before verify.");
  }
  const { verifyAndFixServer } = await import("./verify.server.ts");
  return (await verifyAndFixServer(withCommonJsExports(source), project.brief)) as VerifyOutcomeShape;
}

// ---------------------------------------------------------------------------
// Design tokens + HTML (src/lib/design.ts) and diagrams (src/lib/diagram.ts):
// sibling-owned modules built in parallel, exactly like vault.ts above. Their
// headers freeze the EXACT export surface this section compiles against:
//
//   designTokens(project)        -> DesignTokens (JSON-safe object)
//   designHtml(project)          -> string       (standalone HTML document)
//   buildDiagram(project, kind)  -> string       (SVG markup; kind is one of
//                                                 phases | architecture | flow)
//
// Neither module may exist yet when this file is typechecked (both are built
// in parallel), so every reference below is a RUNTIME dynamic import through
// a non-literal specifier. When the module is absent the import throws and
// callers surface a clean { ok:false, error } — never a crash mid-JSON.
// ---------------------------------------------------------------------------

/** CLI-facing mirror of design.ts's DesignTokens (opaque, JSON-safe object). */
export type DesignTokens = Record<string, unknown>;

export const DIAGRAM_KINDS = ["phases", "architecture", "flow"] as const;
export type DiagramKind = (typeof DIAGRAM_KINDS)[number];

type DesignModule = {
  designTokens(project: Project): unknown;
  designHtml(project: Project): unknown;
};

type DiagramModule = {
  buildDiagram(project: Project, kind: DiagramKind): unknown;
};

/** True when src/lib/design.ts exists on disk (module present → design usable). */
export function designModuleAvailable(): boolean {
  try {
    return existsSync(join(LIB_DIR, "design.ts"));
  } catch {
    return false;
  }
}

/** True when src/lib/diagram.ts exists on disk (module present → diagram usable). */
export function diagramModuleAvailable(): boolean {
  try {
    return existsSync(join(LIB_DIR, "diagram.ts"));
  } catch {
    return false;
  }
}

let designModulePromise: Promise<DesignModule> | null = null;

/**
 * Load the sibling-owned design module once. Resolves only when every export
 * of its frozen surface is present; rejects with a readable error otherwise.
 */
function loadDesignModule(): Promise<DesignModule> {
  designModulePromise ??= (async () => {
    // Non-literal specifier: resolved relative to THIS module at runtime and
    // deliberately invisible to tsc, so typecheck stays green while design.ts
    // is still mid-flight (sibling-owned file, lands in parallel).
    const spec = "./design.ts";
    const mod = (await import(spec)) as Record<string, unknown>;
    for (const name of ["designTokens", "designHtml"]) {
      if (typeof mod[name] !== "function") {
        throw new Error(`design module (src/lib/design.ts) is missing its "${name}" export — contract drift.`);
      }
    }
    return mod as unknown as DesignModule;
  })();
  return designModulePromise;
}

let diagramModulePromise: Promise<DiagramModule> | null = null;

/**
 * Load the sibling-owned diagram module once. Resolves only when the
 * buildDiagram export of its frozen surface is present; rejects otherwise.
 */
function loadDiagramModule(): Promise<DiagramModule> {
  diagramModulePromise ??= (async () => {
    const spec = "./diagram.ts";
    const mod = (await import(spec)) as Record<string, unknown>;
    if (typeof mod.buildDiagram !== "function") {
      throw new Error(`diagram module (src/lib/diagram.ts) is missing its "buildDiagram" export — contract drift.`);
    }
    return mod as unknown as DiagramModule;
  })();
  return diagramModulePromise;
}

/**
 * JSON-safe design tokens for the project (design.ts designTokens passthrough).
 * Throws when design.ts is absent or its designTokens returns a non-object.
 */
export async function designTokens(project: Project): Promise<DesignTokens> {
  const design = await loadDesignModule();
  const tokens = design.designTokens(project);
  if (tokens === null || typeof tokens !== "object" || Array.isArray(tokens)) {
    throw new Error(
      "design module (src/lib/design.ts) returned a non-object from designTokens — contract drift.",
    );
  }
  return tokens as DesignTokens;
}

/**
 * Standalone HTML document embedding the design tokens (design.ts
 * designHtml passthrough). Throws when design.ts is absent or the HTML is
 * not a non-empty string.
 */
export async function designHtml(project: Project): Promise<string> {
  const design = await loadDesignModule();
  const html = design.designHtml(project);
  if (typeof html !== "string" || !html.trim()) {
    throw new Error(
      "design module (src/lib/design.ts) returned a non-string from designHtml — contract drift.",
    );
  }
  return html;
}

/**
 * SVG diagram for the project (diagram.ts buildDiagram passthrough). `kind`
 * must be one of DIAGRAM_KINDS; anything else is a hard error and never
 * reaches the sibling module. Throws when diagram.ts is absent or its
 * buildDiagram does not return a non-empty string (the SVG markup).
 */
export async function buildDiagram(project: Project, kind: string): Promise<string> {
  if (!(DIAGRAM_KINDS as readonly string[]).includes(kind)) {
    throw new Error(`buildDiagram: unknown kind "${String(kind)}" — expected one of ${DIAGRAM_KINDS.join(" | ")}.`);
  }
  const diagram = await loadDiagramModule();
  const svg = diagram.buildDiagram(project, kind as DiagramKind);
  if (typeof svg !== "string" || !svg.trim()) {
    throw new Error(
      "diagram module (src/lib/diagram.ts) returned a non-string from buildDiagram — contract drift.",
    );
  }
  return svg;
}

// ---------------------------------------------------------------------------
// Artifact listing — agent-facing projection over project.artifacts. Pure and
// module-free (always available, no dynamic import), so an agent can index
// every artifact even while the design/diagram modules are still in flight.
// ---------------------------------------------------------------------------

/** One agent-facing artifact row (body excluded — fetch full JSON via export). */
export type ArtifactLite = {
  id: string;
  phase: PhaseId;
  kind: ArtifactKind;
  title: string;
  /** UTF-8 byte length of the artifact body (approximate size on disk). */
  bytes: number;
};

/**
 * Project artifact index in stored (chronological) order — the row an agent
 * reads to decide which artifact to fetch next. Never throws.
 */
export function listArtifacts(project: Project): ArtifactLite[] {
  const rows = project.artifacts ?? [];
  return rows.map((a) => ({
    id: a.id,
    phase: a.phase,
    kind: a.kind,
    title: a.title,
    bytes: Buffer.byteLength(a.body ?? "", "utf8"),
  }));
}

// ---------------------------------------------------------------------------
// Doctor (E-25): bare-Node capability pre-flight for agent drivers. Reads the
// server modules DIRECTLY (deepseek/tavily/websearch are plain env+fetch
// modules) because the TanStack server-fn status surfaces (llm.ts /
// research.ts) cannot run outside a Start server context. The research probe
// performs one tiny real search (maxResults 1, 3 s cap) so `probed` is a real
// reachability verdict, not a promise.
// ---------------------------------------------------------------------------

export type DoctorStatus = {
  llm: { configured: boolean; label: string };
  research: { configured: boolean; probed: boolean; label: string };
  runner: { available: boolean; sandbox: false };
  node: string;
  /** Honest factory bar — agents must not infer "it ships software" from llm.configured.
   *  210: field-truth via doctor.factoryClaim — never a hardcoded true flip. */
  factory: {
    autonomousSoftwareFactory: boolean;
    leftoverJobsAreReexportsOrStubs: boolean;
    chatHasSlashToolsOnly: boolean;
    runnerIsSandbox: false;
    isolation: { sandbox: false; kind: "none"; docker: false; bwrap: false; note: string };
    tokenCap: number | null;
    /** Why the factory bar is unmet. Empty only when autonomousSoftwareFactory is true. */
    gaps: string[];
    inventory: {
      scanned: string | null;
      stubs: number;
      reexports: number;
      real: number;
      files: Array<{ path: string; kind: "stub" | "reexport" | "real" }>;
    } | null;
  };
};

/** Wait up to `ms` for a promise; resolves null on timeout (never rejects). */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** One real keyless search probe (probe = reachability + result shape check). */
async function probeKeylessSearch(): Promise<boolean> {
  try {
    const { freeWebSearch } = await import("./websearch.server.ts");
    const r = (await withTimeout(
      freeWebSearch("rapidtool connectivity probe", { maxResults: 1 }),
      3000,
    )) as { ok?: unknown } | null | undefined;
    return Boolean(r && r.ok === true);
  } catch {
    return false;
  }
}

/** One real Tavily probe (fires only when TAVILY_API_KEY is set). */
async function probeTavily(): Promise<boolean> {
  try {
    const { tavilySearch } = await import("./tavily.server.ts");
    const r = (await withTimeout(
      tavilySearch("rapidtool connectivity probe", { maxResults: 1 }),
      3000,
    )) as { ok?: unknown } | null | undefined;
    return Boolean(r && r.ok === true);
  } catch {
    return false;
  }
}

/**
 * 214: walk a product tree for leftover job modules (`src/jobs/*.ts`, `jobs/*.ts`).
 * Best-effort, never throws. Does not invent bodies — classifier reads bytes.
 */
export function collectJobSources(treeDir: string): Array<{ path: string; source: string }> {
  const out: Array<{ path: string; source: string }> = [];
  const root = resolve(treeDir);
  const candidates = [join(root, "src", "jobs"), join(root, "jobs")];
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    let names: string[] = [];
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(".ts") && !name.endsWith(".js") && !name.endsWith(".mjs")) continue;
      const full = join(dir, name);
      try {
        if (!statSync(full).isFile()) continue;
        out.push({ path: relative(root, full).replace(/\\/g, "/"), source: readFileSync(full, "utf8") });
      } catch {
        /* skip unreadable */
      }
    }
  }
  return out;
}

/**
 * E-25: capability pre-flight for agent drivers — what CAN this host do right
 * now? Reads process.env through the server modules (never the server-fn
 * status surfaces, which need a Start runtime). The research probe is a real
 * tiny search (1 result, 3 s cap); a failed probe reports configured:false so
 * an agent branches before driving instead of discovering the outage mid-run.
 * Never throws.
 *
 * 214: `opts.treeDir` scans `src/jobs/*.ts` (and `jobs/*.ts`) and feeds the
 * leftover-job census into factoryClaim. Absent tree → RAPIDTOOL_FACTORY_EVIDENCE
 * (inventory null). Never invents job bodies.
 */
export async function doctorStatus(opts?: { treeDir?: string }): Promise<DoctorStatus> {
  const llm = { configured: false, label: "not configured (set DEEPSEEK_API_KEY)" };
  try {
    const { isDeepSeekConfigured, DEEPSEEK_MODEL_IDS } = await import("./deepseek.server.ts");
    if (isDeepSeekConfigured()) {
      llm.configured = true;
      llm.label = `deepseek (${DEEPSEEK_MODEL_IDS.slice(0, 2).join(" | ")})`;
    }
  } catch {
    /* deepseek module unavailable → honest not-configured */
  }

  const research = { configured: false, probed: false, label: "unavailable" };
  let runner: DoctorStatus["runner"] = { available: false, sandbox: false };
  try {
    const { isTavilyConfigured } = await import("./tavily.server.ts");
    if (isTavilyConfigured()) {
      research.label = "tavily (keyed)";
      research.configured = await probeTavily();
      research.probed = research.configured;
      if (!research.configured) research.label = "tavily unreachable (probe failed)";
    } else {
      research.label = "free search (duckduckgo/searxng/wikipedia)";
      research.configured = await probeKeylessSearch();
      research.probed = research.configured;
      if (!research.configured) research.label = "free search unreachable (probe failed)";
    }
  } catch {
    research.label = "unavailable (search modules missing)";
  }
  try {
    const { runnerAvailable } = await import("./node-runner.server.ts");
    runner = { available: runnerAvailable(), sandbox: false };
  } catch {
    runner = { available: false, sandbox: false };
  }

  let isolation: DoctorStatus["factory"]["isolation"] = {
    sandbox: false,
    kind: "none",
    docker: false,
    bwrap: false,
    note: "RapidTool's node-runner is a bounded timeout + env allowlist. It is NOT Docker, bwrap, or a security sandbox.",
  };
  try {
    const { runnerIsolationClaim } = await import("./sandbox-policy.ts");
    isolation = runnerIsolationClaim();
  } catch {
    /* keep the inline honest floor */
  }

  // 210: field-truth factory latch — never hardcode true; RapidTool-now is false.
  // 214: optional treeDir scan computes leftover/real from actual job files.
  let factory: DoctorStatus["factory"] = {
    autonomousSoftwareFactory: false,
    leftoverJobsAreReexportsOrStubs: true,
    chatHasSlashToolsOnly: true,
    runnerIsSandbox: false,
    isolation,
    tokenCap: null,
    gaps: [
      "leftover jobs are reexports or TODO(E-15) stubs — not a multi-job product",
      'no human-approved fixtures (decidedBy:"human")',
      "no real multi-job product",
      "product-complete bar not met (skip≠green; stubs≠complete)",
    ],
    inventory: null,
  };
  try {
    const doctor = await import("./doctor.ts");
    const treeDir = typeof opts?.treeDir === "string" && opts.treeDir.trim() ? opts.treeDir.trim() : "";
    let claim = doctor.doctorFactory(process.env);
    if (treeDir) {
      const files = collectJobSources(treeDir);
      const inv = doctor.inventoryFromJobSources(files, resolve(treeDir));
      const evidence = doctor.evidenceFromJobInventory(inv);
      claim = doctor.factoryClaim(evidence, process.env);
    }
    factory = {
      autonomousSoftwareFactory: claim.autonomousSoftwareFactory,
      leftoverJobsAreReexportsOrStubs: claim.leftoverJobsAreReexportsOrStubs,
      chatHasSlashToolsOnly: claim.chatHasSlashToolsOnly,
      runnerIsSandbox: false,
      isolation: claim.isolation,
      tokenCap: claim.tokenCap,
      gaps: claim.gaps,
      inventory: claim.inventory,
    };
  } catch {
    /* keep the inline honest floor (factory stays false) */
  }

  return {
    llm,
    research,
    runner,
    node: process.version,
    factory,
  };
}

// ---------------------------------------------------------------------------
// New-pillar bridges (ADDITIVE, pillar wave): thin wrappers over the pillar
// modules — harvest.ts (Pillar 1), swarm.ts, prompt-engine.ts, bench.ts,
// ast-mine.ts, knowledge.ts — plus a bounded engine.wildStep macro-run. Each
// wrapper dynamic-imports its module (bare-Node friendly, same contract style
// as runCrew/verify/design/diagram) and NEVER mutates the wrapped module.
// ---------------------------------------------------------------------------
import type { HarvestOptions, HarvestPacketResult } from "./harvest.ts";

/** Wrapper over harvest.ts: harvestForPacket — bounded live-source harvest rows. */
export async function harvest(project: Project, opts?: HarvestOptions): Promise<HarvestPacketResult> {
  const { harvestForPacket } = await import("./harvest.ts");
  return harvestForPacket(project, opts);
}

export type SwarmPlanShape = {
  ok: true;
  advisory: true;
  engineLinear: true;
  phase: number;
  critiques: unknown[];
  artifacts: unknown[];
  refinedPlan: string;
};

/** Wrapper over swarm.ts: swarmPlan — deterministic advisory critique set. */
export async function swarmPlan(project: Project): Promise<SwarmPlanShape> {
  const { swarmPlan: plan } = await import("./swarm.ts");
  return plan(project) as unknown as SwarmPlanShape;
}

export type PromptExpandShape =
  | { ok: true; spec: unknown }
  | { ok: false; reason: "not-configured" | "error"; error?: string };

/** Wrapper over prompt-engine.ts: expandBrief (needs DEEPSEEK_API_KEY). */
export async function promptExpand(project: Project, policies?: readonly string[]): Promise<PromptExpandShape> {
  const { expandBrief } = await import("./prompt-engine.ts");
  const { expandBriefWithBackoff } = await import("./codegen.server.ts");
  // fixes/121: the standalone prompt verb timed out 2/2 at the 20s flash-tier
  // abort — the same bounded-backoff treatment P6's expansion already has.
  const res = await expandBriefWithBackoff(project.brief, (b) => expandBrief(b, policies));
  return res as unknown as PromptExpandShape;
}

export type BenchProjectShape = {
  ok: true;
  disclaimer: string;
  token: unknown;
  time: unknown;
  complexity: unknown;
  failurePoints: unknown;
};

/** Wrapper over bench.ts: all four synthetic estimators + the honest disclaimer. */
export async function benchProject(project: Project): Promise<BenchProjectShape> {
  const bench = await import("./bench.ts");
  return {
    ok: true,
    disclaimer: bench.ESTIMATE_DISCLAIMER,
    token: bench.estimateTokenCost(project),
    time: bench.projectedTime(project),
    complexity: bench.complexityScore(project),
    failurePoints: bench.failurePointScan(project),
  };
}

const MINE_SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", "out", ".vite"]);
const MINE_SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const MINE_MAX_FILES_DEFAULT = 200;
const MINE_MAX_BYTES_DEFAULT = 2_000_000;
const MINE_MAX_FILE_BYTES = 512_000;

export type MineDirResult = {
  ok: true;
  dir: string;
  files: unknown[];
  map: unknown;
  conventions: unknown;
  skipped: { excluded: number; tooLarge: number; overLimit: string[] };
};

/** Deterministic bounded walk: sorted entries, FIFO queue, skip-dir + extension filters. */
function walkSourceFiles(
  dir: string,
  opts: { maxFiles: number; maxBytes: number },
): { files: { path: string; body: string }[]; skipped: { excluded: number; tooLarge: number; overLimit: string[] } } {
  const files: { path: string; body: string }[] = [];
  const skipped = { excluded: 0, tooLarge: 0, overLimit: [] as string[] };
  const queue: string[] = [dir];
  let total = 0;
  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor];
    cursor += 1;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch (err) {
      throw new Error(`mineDir: cannot read "${current}" — ${err instanceof Error ? err.message : String(err)}`);
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!MINE_SKIP_DIRS.has(entry.name)) queue.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!MINE_SOURCE_EXTS.has(full.slice(full.lastIndexOf(".")))) {
        skipped.excluded += 1;
        continue;
      }
      let body: string;
      try {
        if (statSync(full).size > MINE_MAX_FILE_BYTES) {
          skipped.tooLarge += 1;
          continue;
        }
        body = readFileSync(full, "utf8");
      } catch {
        skipped.excluded += 1;
        continue;
      }
      total += Buffer.byteLength(body, "utf8");
      if (files.length >= opts.maxFiles || total > opts.maxBytes) {
        skipped.overLimit.push(entry.name);
        continue;
      }
      files.push({ path: full, body });
    }
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, skipped };
}

/**
 * Wrapper over ast-mine.ts: mineCodebase + conventionsMap over a real
 * directory (bounded walk — file count, byte budget, skip dirs, extension
 * filter; every skip is reported, never silent). Throws on an unreadable dir.
 */
export async function mineDir(dir: string, opts: { maxFiles?: number; maxBytes?: number } = {}): Promise<MineDirResult> {
  const { mineCodebase, conventionsMap } = await import("./ast-mine.ts");
  const { files, skipped } = walkSourceFiles(dir, {
    maxFiles: opts.maxFiles ?? MINE_MAX_FILES_DEFAULT,
    maxBytes: opts.maxBytes ?? MINE_MAX_BYTES_DEFAULT,
  });
  const map = mineCodebase(files);
  const conventions = conventionsMap("headless-mine", files);
  return { ok: true, dir, files, map, conventions, skipped };
}

export type KnowledgePatternInput = {
  project: string;
  kind: "brief" | "pattern" | "fix" | "note";
  title: string;
  tags: string[];
  body: string;
  sourcePath?: string;
};

export type KnowledgeSaveShape = { entry: unknown; appended: boolean };

/** Wrapper over knowledge.ts: append one entry to a JSON pattern store (idempotent). */
export async function knowledgeSave(storePath: string, pattern: KnowledgePatternInput): Promise<KnowledgeSaveShape> {
  const { KnowledgeStore } = await import("./knowledge.ts");
  const store = new KnowledgeStore(storePath);
  return store.savePattern(pattern);
}

/** Wrapper over knowledge.ts: deterministic FusionRank-style pattern search. */
export async function knowledgeFind(storePath: string, query: string, limit = 5): Promise<{ entry: unknown; score: number }[]> {
  const { KnowledgeStore } = await import("./knowledge.ts");
  const store = new KnowledgeStore(storePath);
  return store.findPatterns(query, limit);
}

export type WildStartShape =
  | { ok: true; project: Project; outcome: string; steps: number; note?: string }
  | { ok: false; reason: "not-wild" | "not-active"; error: string };

/**
 * Wrapper over engine.wildStep — one bounded macro-run (default 24 steps,
 * clamped 1–48). Stops on any non-"advanced" outcome (paused/completed/noop)
 * and returns the final project; the CLI persists it. Honest refusal when the
 * project has wildMode off or no active wild run.
 */
export async function wildStartHeadless(project: Project, opts: { maxSteps?: number } = {}): Promise<WildStartShape> {
  const maxSteps = Math.min(Math.max(opts.maxSteps ?? 24, 1), 48);
  if (project.wildMode !== true) {
    return { ok: false, reason: "not-wild", error: "Wild mode is not enabled (project.wildMode !== true) — nothing to run." };
  }
  if (!project.wildRun || !project.wildRun.active) {
    return { ok: false, reason: "not-active", error: "No active wild run (project.wildRun.active !== true) — start a wild run first." };
  }
  const { wildStep } = await import("./engine.ts");
  let current = project;
  let steps = 0;
  let outcome = "advanced";
  let lastError: string | undefined;
  while (steps < maxSteps) {
    const res = await wildStep(current);
    steps += 1;
    current = res.project;
    outcome = res.outcome;
    lastError = res.error;
    if (outcome !== "advanced") break;
  }
  if (steps >= maxSteps && outcome === "advanced") {
    lastError = `bounded: reached the ${maxSteps}-step cap with the wild run still advancing`;
  }
  // 185-H1: ok:true never carries `error` — pause/cap detail is `note`.
  return { ok: true, project: current, outcome, steps, ...(lastError ? { note: lastError } : {}) };
}

// ---------------------------------------------------------------------------
// Agent-visibility bridges (audit wave W1 — fixes/77, additive only): chat
// (UI Chat tab → chat.server.ts chatOnceServer — the exact function the
// browser POSTs to, so context/caps/honesty cannot drift), deepen (engine
// E-13 deepenResearch — the UI's own fallback text tells users to "re-run
// research from the CLI instead", yet no CLI/headless path existed), and the
// full Wild Mode lifecycle (enable/start/pause/resume/stop). Pre-existing
// wildStartHeadless can only STEP an already-ACTIVE run; nothing headless
// could enable or start one (UI-only store actions), so the wild verbs were
// agent-unreachable on any fresh project.
// ---------------------------------------------------------------------------

/** Structural mirror of chat.server.ts ChatResult (server-owned shape —
 *  kept local so headless compiles even if the server module is mid-flight). */
export type ChatAskShape =
  | { ok: true; reply: string; grounded: true; provenance: string }
  | {
      ok: false;
      reason: "not-configured" | "error";
      error?: string;
      /** Machine-readable failure class (errors.ts) — passthrough verbatim. */
      code?: string;
    };

/** One grounded copilot turn over the project — chat.server.ts chatOnceServer
 *  passthrough (the UI Chat tab's server side; bare-Node friendly — plain
 *  env+fetch, no server-fn invocation). */
export async function chatAsk(
  project: Project,
  userText: string,
  history?: { role: "user" | "assistant"; text: string }[],
): Promise<ChatAskShape> {
  const { chatOnceServer } = await import("./chat.server.ts");
  return (await chatOnceServer(project, userText, history)) as unknown as ChatAskShape;
}

/** One deepen outcome over a completed research phase. */
export type DeepenShape =
  | {
      ok: true;
      phase: PhaseId;
      /** False when the engine had nothing to add (identical project). */
      changed: boolean;
      /** The deepened project (persist this when changed — audit-80 M1 bug). */
      project: Project;
      /** True when live research could not run (engine E-13 explained dead-end). */
      liveUnavailable: boolean;
      /** detail of the research.deepened log row when one was appended. */
      log: string | null;
    }
  | { ok: false; reason: "not-research" | "not-complete"; error: string };

/** E-13 deepen: re-run the LIVE research layer over a COMPLETED research phase
 *  (0/7/11) — appends one deduplicated corpus entry + research artifacts, logs
 *  research.deepened and re-records the phase gate (fresh evidenceHash). Under
 *  bare Node the live backends cannot run, so the engine honestly stamps
 *  meta.liveUnavailable + a warn log and re-records against the existing
 *  corpus — never fabricated findings, never a silent no-op. Guard arms mirror
 *  the engine contract (which silently no-ops elsewhere) so the CLI can exit
 *  with a nameable state error instead of an indistinguishable no-op. */
export async function deepenPhase(project: Project, phase: PhaseId): Promise<DeepenShape> {
  if (!RESEARCH_PHASES.has(phase)) {
    return {
      ok: false,
      reason: "not-research",
      error: `deepen targets research phases 0/7/11 only (got P${phase}).`,
    };
  }
  const rec = (project.phases ?? []).find((r) => r.id === phase);
  if (!rec || rec.status !== "complete") {
    return {
      ok: false,
      reason: "not-complete",
      error: `P${phase} is not complete (status: ${rec?.status ?? "missing"}) — deepen re-runs live research over a completed research phase.`,
    };
  }
  const { deepenResearch } = await import("./engine.ts");
  const out = await deepenResearch(project, phase);
  const changed = out !== project;
  const deepened = changed
    ? [...(out.logs ?? [])].reverse().find((l) => l.event === "research.deepened")
    : undefined;
  return {
    ok: true,
    phase,
    changed,
    project: out,
    liveUnavailable:
      changed &&
      (out as unknown as { meta?: { liveUnavailable?: boolean } }).meta?.liveUnavailable ===
        true,
    log: deepened && typeof deepened.detail === "string" ? deepened.detail : null,
  };
}

/** Shared honest shape for the wild lifecycle verbs. */
export type WildLifecycleShape =
  | {
      ok: true;
      project: Project;
      /** False for idempotent no-op controls (e.g. pausing a paused run). */
      changed: boolean;
      outcome?: string;
      steps?: number;
      /** Informational only on ok:true — never dual-channel `error` (185-H1). */
      note?: string;
    }
  | {
      ok: false;
      reason: "not-wild" | "not-active" | "already-active" | "already-complete";
      error: string;
      code?: string;
    };

/** Enable Wild Mode and BEGIN a bounded macro-run — the missing headless half
 *  of the UI's enable→start flow (store.setWildMode + startWildRun parity):
 *  stamps the canonical active wildRun, logs wild.start, then drives
 *  engine.wildStep up to maxSteps (default 24, clamped 1–48). Refuses only an
 *  ALREADY-ACTIVE run (store.startWildRun parity — a duplicate start must fail
 *  loudly, never double-loop). A project already complete is ok:false
 *  (185-H1 — never dual-channel ok:true + error). */
export async function wildStartRun(
  project: Project,
  opts: { maxSteps?: number } = {},
): Promise<WildLifecycleShape> {
  const maxSteps = Math.min(Math.max(opts.maxSteps ?? 24, 1), 48);
  if (project.wildRun?.active === true) {
    return {
      ok: false,
      reason: "already-active",
      error: "A wild run is already active — stop it or let it finish before starting another.",
    };
  }
  if (project.status === "complete") {
    return {
      ok: false,
      reason: "already-complete",
      error: "Project already complete — no wild run started.",
      code: "RT_E_PHASE_ILLEGAL",
    };
  }
  const { wildStep, wildLog } = await import("./engine.ts");
  const now = Date.now();
  const started: Project = {
    ...project,
    wildMode: true,
    wildRun: {
      active: true,
      phase: project.currentPhase,
      startedAt: now,
      lastAutoLog: `Wild run started at P${project.currentPhase}`,
      lastAutoAt: now,
      stoppedAt: null,
      pause: false,
    },
  };
  let current = wildLog(
    started,
    started.currentPhase,
    "info",
    "wild.start",
    `Wild Mode run started at P${started.currentPhase}.`,
  );
  let steps = 0;
  let outcome = "advanced";
  let lastError: string | undefined;
  while (steps < maxSteps) {
    const res = await wildStep(current);
    steps += 1;
    current = res.project;
    outcome = res.outcome;
    lastError = res.error;
    if (outcome !== "advanced") break;
  }
  if (steps >= maxSteps && outcome === "advanced") {
    lastError = `bounded: reached the ${maxSteps}-step cap with the wild run still advancing`;
  }
  return {
    ok: true,
    project: current,
    changed: true,
    outcome,
    steps,
    ...(lastError ? { note: lastError } : {}),
  };
}

/** Pause an ACTIVE wild run (engine.wildPause parity: pause:true, active stays
 *  true, ledger entry). Idempotent: an already-paused run returns changed:false. */
export async function wildPauseRun(project: Project): Promise<WildLifecycleShape> {
  const run = project.wildRun;
  if (!run || !run.active) {
    return { ok: false, reason: "not-active", error: "No active wild run to pause." };
  }
  if (run.pause === true) {
    return { ok: true, project, changed: false, note: "Wild run is already paused." };
  }
  const { wildPause } = await import("./engine.ts");
  return {
    ok: true,
    project: wildPause(project, project.currentPhase, "warn", "wild.paused", "Wild run paused from the CLI."),
    changed: true,
  };
}

/** Resume a PAUSED active wild run (pause → false + wild.resume ledger row).
 *  Idempotent: a run that is not paused returns changed:false. */
export async function wildResumeRun(project: Project): Promise<WildLifecycleShape> {
  const run = project.wildRun;
  if (!run || !run.active) {
    return { ok: false, reason: "not-active", error: "No active wild run to resume." };
  }
  if (run.pause !== true) {
    return { ok: true, project, changed: false, note: "Wild run is not paused." };
  }
  const { wildLog } = await import("./engine.ts");
  const resumed: Project = {
    ...project,
    wildRun: {
      ...run,
      pause: false,
      lastAutoLog: "Wild run resumed from the CLI.",
      lastAutoAt: Date.now(),
    },
  };
  return {
    ok: true,
    project: wildLog(resumed, project.currentPhase, "info", "wild.resume", "Wild run resumed from the CLI."),
    changed: true,
  };
}

/** Stop a wild run (store.stopWildRun parity: active → false, stoppedAt
 *  stamped, pause cleared, wild.stop ledger row). Idempotent: stopping a run
 *  that is already stopped returns changed:false. */
export async function wildStopRun(project: Project): Promise<WildLifecycleShape> {
  const run = project.wildRun;
  if (!run) {
    return { ok: false, reason: "not-active", error: "No wild run to stop." };
  }
  if (!run.active && run.pause === false && run.stoppedAt !== null) {
    return { ok: true, project, changed: false, note: "Wild run is already stopped." };
  }
  const { wildLog } = await import("./engine.ts");
  const stopped: Project = {
    ...project,
    wildRun: { ...run, active: false, stoppedAt: Date.now(), pause: false },
  };
  return {
    ok: true,
    project: wildLog(stopped, project.currentPhase, "info", "wild.stop", "Wild run stopped from the CLI."),
    changed: true,
  };
}
