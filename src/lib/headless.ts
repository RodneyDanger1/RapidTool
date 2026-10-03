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
  hydrateProject,
  inferName,
  liveDegradeRow,
  liveLayer,
  liveLayerFailureRow,
  // W36 N2 (fixes/281): F3-01 residue closed — engine.ts exports readWildPlan (R13-f02 landed it;
  // store.ts consumes it); the former inline accessor in generateWildPlan is re-pointed to it.
  readWildPlan,
  rejectHitl,
  researchQueryFor,
  sealHonesty,
  stampPacket,
  unlockRetry,
  withLiveDegradeRows,
} from "./engine.ts";
import type { WildReviewer } from "./engine.ts";
import { fnv1a } from "./algorithms.ts";
import { failedGates, hardDodBlockInto, hardDodMessage, recordGateInto, runGate } from "./dod.ts";
import { approvedAcceptanceFixtures } from "./brief-fixtures.ts";
import { runSummaryLesson, templateEmissionLesson, type RankableLessonRow } from "./knowledge.ts";
import { exportPacketText, exportProjectJson, importProject, slugName } from "./io.ts";
import { applyReportResult, validateReport, type ReportApplyReason } from "./report-intake.ts";
import { canEnter, PHASES, PHASE_LAST, phaseDef, priorsSealed, STOCK_HITL } from "./phases.ts";
import { evaluatePolicy, seatLabel } from "./policy.ts";
import { applyWrite, rollback, snapshotPaths } from "./write-set.ts";
// T-107.7 (W33 lane L2 write half · W36 lane N2 read half): the real run
// checkpoint. headless IS the bare-Node host whose runs know a project working
// dir — the per-phase commit below writes the bounded snapshot beside
// `.rapidtool/` and completion clears it; `loadResumableCheckpoint` (below) is
// the read/admit/hydrate seam the CLI `resume`/`unattended` verbs consume.
// Static import is safe here: headless is a backend module (node:fs already
// top-level) and never enters the client graph (store.ts lazy-imports it).
import { classifyError, type ErrorCode } from "./errors.ts";
import { CHECKPOINT_CAPS, checkpointAdmits, clearCheckpoint, readCheckpoint, writeCheckpoint } from "./checkpoint.server.ts";
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
// R14-f01 (W33 lane F1): Node-side Auto-Review supervisor binding — headless IS
// the bare-Node host where the wild loop runs; null (keyless) keeps the engine's
// existing default byte-identical.
import { createNodeWildReviewer } from "./wild-review.ts";
import type { QuarantineFailure } from "./quarantine.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";
import type {
  ArtifactKind,
  GeneratedTreeFile,
  HitlDecision,
  JsonLog,
  ModelRoute,
  PhaseId,
  PhaseStatus,
  Project,
  WildPlan,
} from "./types.ts";
// 308 B-02 (B2): the Optional telemetry sink's seed shape — the same
// RtEventSeed the engine emits and the CLI's cliLogEvent consumes.
import type { RtEventSeed } from "./rt-events.ts";

import { isKeyUnusableCode, type DoctorLastKeyed, type DoctorLlmKey, type DoctorSpend } from "./doctor.ts";
import type { SpendSlice, TokenLedger, TokenSpend } from "./token-ledger.ts";
// T5.5 (OV-41 spend half, W43 · H6): the summary envelope's spend half reads
// the PROCESS session budget — the SAME T-107.6 accessor `recordSessionSpend`
// records into — through the SAME boundary reader the packet envelope carries
// (`packetBudgetBoundary`, F2-04), so the two surfaces can never drift.
// W46 · 332-2 (AW45-c06): the run's cumulative spend PERSISTS on the project
// (`tokenUsage`); `accumulateSpend` / `spendDelta` / `normalizeLedger` fold
// each invocation's session delta into it, and `summary`/`doctor` read it back.
// token-ledger.ts / packet.ts are client-safe pure modules (no node:fs);
// static import is safe in this backend module.
import {
  accumulateSpend,
  isMeasuredSpend,
  normalizeLedger,
  recordSessionSpend,
  sessionTokenBudget,
  spendDelta,
  totalTokens,
} from "./token-ledger.ts";
import { packetBudgetBoundary, type PacketBudget } from "./packet.ts";

// ---------------------------------------------------------------------------
// File persistence (atomic write via write-then-rename).
// ---------------------------------------------------------------------------

/** Load a project from a JSON file (parse + validate + hydrate via io.importProject).
 *  W49 · 335-2: the byte source is a local file `readFileSync` already loaded in
 *  full, so the hostile-PASTE size cap protects nothing here — it only stranded
 *  a legitimate record `saveProject` wrote. The cap is lifted for this path
 *  (a caller may still pin one via `opts.maxChars`). */
export function loadProject(path: string, opts?: { preserveWildRun?: boolean; maxChars?: number }): Project {
  const raw = readFileSync(path, "utf8");
  const res = importProject(raw, { maxChars: Number.POSITIVE_INFINITY, ...opts });
  if (!res.ok) throw new Error(`loadProject(${path}): ${res.error}`);
  return res.project;
}

// ---------------------------------------------------------------------------
// fixes/310 (B1 · M6-01/M6-02): stale-lock reclamation for the two O_EXCL lock
// sites (saveProject's `<project>.lock`, emit's `.rapidtool-emit.lock`). A
// SIGKILLed writer cannot run its release; its lock file stranded the project
// forever — every later writer refused RT_E_BUSY with no retry path short of a
// manual unlink (308 map6 probes M6-01/02). The claim now writes the holder's
// identity (pid + ts) INTO the fresh lock; on EEXIST the next claimant
// consults the holder: a DEAD pid is an orphan and is reclaimed (rename-aside
// claim + one "wx" re-attempt — the repo's own pid+ts discipline, cf.
// checkpoint.server.ts A1-08), an identityless legacy lock falls back to a
// bounded age (mtime), and a LIVE holder always refuses. Reclamation is never
// a blanket bypass: the live-lock pin forbids it and `--force` (foreign-files)
// semantics are untouched. Ceiling: pid liveness is same-machine semantics —
// these locks are local-disk files by design.
// ---------------------------------------------------------------------------
const LOCK_STALE_MAX_AGE_MS = 10 * 60 * 1000;

/** errno string of a thrown fs error, "" when the error carries none. */
function errnoCode(err: unknown): string {
  return err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
}

/** Parse a lock's holder identity (fixes/310). Absent/invalid → null — the
 *  legacy/identityless class, decided by the bounded-age fallback. */
function parseLockIdentity(content: string): { pid: number } | null {
  try {
    const parsed = JSON.parse(content) as { pid?: unknown } | null;
    if (parsed && typeof parsed === "object" && typeof parsed.pid === "number" && Number.isInteger(parsed.pid) && parsed.pid > 0) {
      return { pid: parsed.pid };
    }
  } catch {
    /* legacy/foreign content — age decides */
  }
  return null;
}

/** Is `pid` a live process on this host? EPERM means "exists but not ours" →
 *  alive (the safe direction: never reclaim a holder we merely cannot signal). */
function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return errnoCode(err) === "EPERM";
  }
}

/** Reclaim an orphaned lock. true → the stale file is gone/moved aside and the
 *  caller should re-attempt `wx` (exactly once); false → a live holder, or an
 *  identityless lock inside its age bound — refuse RT_E_BUSY. The reclaim is
 *  claimed ATOMICALLY via rename(): racing reclaimers cannot both win, and a
 *  fresh lock created by another writer can never be unlinked out from under
 *  it by a stale read (the open window a naive read→unlink order would have). */
function reclaimStaleLock(lockPath: string): boolean {
  let content: string | null = null;
  try {
    content = readFileSync(lockPath, "utf8");
  } catch {
    return true; // vanished (released/reclaimed) — let the caller re-attempt wx
  }
  const holder = parseLockIdentity(content);
  if (holder !== null) {
    if (pidIsAlive(holder.pid)) return false; // live holder — never a bypass
  } else {
    let ageMs: number;
    try {
      ageMs = Date.now() - statSync(lockPath).mtimeMs;
    } catch {
      return false; // cannot stat — leave it alone
    }
    if (ageMs < LOCK_STALE_MAX_AGE_MS) return false;
  }
  const aside = `${lockPath}.stale-${process.pid}-${Date.now()}`;
  try {
    renameSync(lockPath, aside);
  } catch {
    // Lost the reclaim race (ENOENT: already moved/released) or the file
    // cannot move (EPERM/EBUSY): only a vanished lock may proceed.
    return !existsSync(lockPath);
  }
  try {
    unlinkSync(aside);
  } catch {
    /* best-effort sweep of the moved-aside stale lock */
  }
  return true;
}

/** fixes/310 (B1): exclusive claim of `lockPath` ("wx") with the holder
 *  identity written in, reclaiming a provably-orphaned holder and retrying
 *  exactly once. Returns the open fd, or null when a live/fresh writer holds
 *  the lock (callers map that to RT_E_BUSY). Non-EEXIST fs errors throw. */
function acquireExclusiveLock(lockPath: string): number | null {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(lockPath, "wx");
      try {
        writeSync(fd, JSON.stringify({ pid: process.pid, ts: Date.now() }));
      } catch {
        /* identity is advisory — an identityless lock falls back to mtime age */
      }
      return fd;
    } catch (err) {
      if (errnoCode(err) !== "EEXIST") throw err;
      if (attempt === 1) return null; // the re-attempt lost to a racing writer
      if (!reclaimStaleLock(lockPath)) return null; // live/fresh holder
    }
  }
  return null; // unreachable (every path above returns) — keeps the type honest
}

/** Persist a project to `path` atomically (write temp file, then rename over target).
 *  174-13: exclusive `.lock` (O_EXCL) so two writers cannot interleave. */
export function saveProject(path: string, project: Project): string {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  const lockPath = `${target}.lock`;
  let fd: number | null = null;
  // fixes/310 (B1 · M6-02): stale-aware claim (acquireExclusiveLock) — an
  // SIGKILLed writer's stranded lock is reclaimed; a live holder still refuses.
  fd = acquireExclusiveLock(lockPath);
  if (fd === null) {
    const e = new Error("saveProject: another writer holds the lock");
    (e as Error & { code?: string }).code = "RT_E_BUSY";
    throw e;
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

/** M6-04 (312 · E2): the busy-aware save the CLI's run/gate arm uses instead
 *  of a bare `saveProject` — bounded wait-and-retry per the `RT_E_BUSY`
 *  agentAction remedy ("wait and retry the save"), then a CODED refusal
 *  instead of a thrown `RT_E_BUSY` the top-level net would mislabel exit 4
 *  (the README-documented busy exit is 1). Each attempt re-enters
 *  `saveProject`, so the fixes/310 `reclaimStaleLock` discipline runs on
 *  EVERY retry: an orphaned lock (dead holder, SIGKILL residue) is reclaimed
 *  on the first attempt; a transiently-held live lock usually clears inside
 *  the window; a still-live writer after the bound gets the coded refusal —
 *  the caller then surfaces `preserved` (the run checkpoint) so the completed
 *  phase work is never discarded. `sleep` is injectable for deterministic
 *  tests; ONLY `RT_E_BUSY` is classified — every other failure propagates
 *  unchanged (those are still the caller's own bugs). */
export type SaveProjectBusyAwareResult =
  | { ok: true; path: string; attempts: number }
  | { ok: false; code: "RT_E_BUSY"; error: string; attempts: number; lockPath: string };

export async function saveProjectBusyAware(
  path: string,
  project: Project,
  opts: { attempts?: number; waitMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<SaveProjectBusyAwareResult> {
  const attempts =
    typeof opts.attempts === "number" && Number.isInteger(opts.attempts) && opts.attempts > 0
      ? opts.attempts
      : 3;
  const waitMs =
    typeof opts.waitMs === "number" && Number.isFinite(opts.waitMs) && opts.waitMs >= 0 ? opts.waitMs : 120;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastMessage = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return { ok: true, path: saveProject(path, project), attempts: attempt };
    } catch (err) {
      if (errnoCode(err) !== "RT_E_BUSY") throw err;
      lastMessage = err instanceof Error ? err.message : String(err);
      if (attempt < attempts) await sleep(waitMs * attempt);
    }
  }
  return {
    ok: false,
    code: "RT_E_BUSY",
    error: `saveProject refused after ${attempts} attempt(s): ${lastMessage}`,
    attempts,
    lockPath: `${resolve(path)}.lock`,
  };
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
  // OV-29 (fixes/252, W19-L1): coded rows for the two degrades below that used
  // to be comment-only. Folded into OV-13's shape — a keyed failure (or a
  // failed keyless search) must leave a coded, visible row, never a silent
  // degrade that reads like a clean keyless run. Empty ⇒ byte-identical return.
  const degradeRows: JsonLog[] = [];

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
    } else if (!result || result.ok !== true) {
      // A coded refusal (RT_E_RESEARCH_UNAVAILABLE from either backend) — the
      // row carries the backend's OWN code. `ok:true` with zero items is NOT a
      // degrade: the backend ran and found nothing.
      degradeRows.push(
        liveDegradeRow(
          phase,
          "research",
          result ?? new Error("research backend returned no result"),
          "RT_E_RESEARCH_UNAVAILABLE",
        ),
      );
    }
  } catch (err) {
    /* research unavailable → items stay empty, not cited (recorded, never
       silent — OV-29, fixes/252) */
    degradeRows.push(liveDegradeRow(phase, "research", err, "RT_E_RESEARCH_UNAVAILABLE"));
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
      // CF-SE2-3b (312 · E2; tail landed by 317 · J3): the narrative call is
      // metered into the process session ledger — I2: EVERY response that
      // reports usage, success or refusal (a refusal that burned tokens still
      // counts against the cap).
      if (comp && comp.usage) recordSessionSpend(comp.usage);
      if (comp && comp.ok === true && typeof comp.text === "string" && comp.text.trim()) {
        narrative = comp.text.trim();
      } else {
        // OV-29's real case: the key IS present but the call failed — without
        // this row the run read exactly like a keyless one. `comp.code` carries
        // the provider's registered class (RT_E_LLM_REJECTED / …).
        degradeRows.push(
          liveDegradeRow(
            phase,
            "narrative",
            comp ?? new Error("narrative call returned no result"),
            "RT_E_LLM_REJECTED",
          ),
        );
      }
    }
  } catch (err) {
    narrative = null;
    /* recorded, never silent — OV-29, fixes/252 */
    degradeRows.push(liveDegradeRow(phase, "narrative", err, "RT_E_LLM_REJECTED"));
  }

  if (items.length === 0 && !narrative) return withLiveDegradeRows(project, degradeRows);

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

  return withLiveDegradeRows(
    {
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
    },
    degradeRows,
  );
}

/** Synthesize a single phase. `live` adds best-effort research/narrative; any
 *  failure (invalid phase, network, backend) degrades to the deterministic
 *  applyPhaseResult. Never throws. */
export async function runPhase(
  project: Project,
  phase: PhaseId,
  opts: {
    live?: boolean;
    /** W-02 (fixes/271 · §R1-f02): injection seam for the phase-6 edge
     *  (driveP6Journey deps). Production callers omit it — the default is the
     *  real keyed journey. */
    p6Deps?: Partial<P6JourneyDeps>;
    /** T4 (112 §4.4 / 216g): caller-supplied cross-project proven lesson rows
     *  for the phase-6 synthesis prompt (driveP6Journey). Absent ⇒ legacy. */
    proven?: readonly RankableLessonRow[];
  } = {},
): Promise<Project> {
  if (!Number.isInteger(phase) || phase < 0 || phase > PHASE_LAST) return project;
  try {
    if (!opts.live) return applyPhaseResult(project, phase);
    // W-02 (fixes/271 · §R1-f02): phase 6 owns the tested-mint edge — route it
    // through the ONE runP6Edge seam (keyed ⇒ driveP6Journey synthesis +
    // tree-run mint; keyless ⇒ the same deterministic floor liveLayer(…, 6)
    // produces). Before this, run/gate could synthesize but never mint.
    if (phase === 6) return await runP6Edge(project, opts.p6Deps, opts.proven);
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
  } catch (err) {
    // fixes/255 (W20-L3 · OV-13, the "silent-skip region"): a thrown live pass
    // used to skip silently to the deterministic floor — under a key that read
    // exactly like a keyless run. Mint G2's own row (engine's runPhaseAsync
    // records the same throw the same way), never a silent skip. Non-live runs
    // record nothing: no live layer ran.
    const floor = applyPhaseResult(project, phase);
    if (!opts.live) return floor;
    return { ...floor, logs: [...floor.logs, liveLayerFailureRow(phase, err)].slice(-200) };
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
  /** W-02 (fixes/271): threaded injection seam for the phase-6 edge. */
  p6Deps?: Partial<P6JourneyDeps>,
  /** T4 (112 §4.4 / 216g): caller-supplied proven lesson rows for P6. */
  proven?: readonly RankableLessonRow[],
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
  const updated = await runPhase(running, phase, { live, p6Deps, proven });
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
  if (p.status !== "awaiting_hitl" && phase < PHASE_LAST) {
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
  /** W-02 (fixes/271): threaded injection seam for the phase-6 edge. */
  p6Deps?: Partial<P6JourneyDeps>,
  /** T4 (112 §4.4 / 216g): caller-supplied proven lesson rows for P6. */
  proven?: readonly RankableLessonRow[],
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
  if (rec.status === "complete" && phase < PHASE_LAST) {
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
    return runReady(advanceTo(project, next), next, autopilot, live, p6Deps, proven);
  }
  if (rec.status === "complete") return { project, error: "Pipeline complete.", stopped: true };
  return runReady(project, phase, autopilot, live, p6Deps, proven);
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
  /** W48 · 334-2 (L2): the coded class of the newest P6 synthesis refusal THIS
   *  invocation recorded (`<RT_E code> · <reason>`, codegen's refusal-log
   *  shape) — absent when the invocation appended no refusal. A P6-synthesis
   *  401 surfaces as RT_E_LLM_KEY_REJECTED, so a consumer (the console chip,
   *  334-5) can move on the refusal class instead of parsing prose. Additive +
   *  conditional: no existing consumer's shape changes. */
  code?: ErrorCode;
};

/**
 * T-107.7 (W33 lane L2) — the per-phase commit checkpoint (WRITE side).
 *
 * Called from `runUntilGate` NEXT TO the existing per-phase commit: every loop
 * iteration that actually moved the run (phase edge advanced, or artifacts
 * landed — the same predicate the `steps` counter uses) persists
 * `writeCheckpoint(dir, project, { phase, step, mode })` — the bounded, atomic
 * snapshot at `<dir>/.rapidtool/checkpoint.json` that `rapidtool resume`
 * re-enters from (`cp.run.phase`). `step` stays 0: this driver's unit of work
 * IS the phase (phase-granular resume), per the CheckpointRun contract.
 *
 * GUARD (load-bearing): no `dir` ⇒ NO-OP. headless runs are the only host with
 * a writable project dir; the browser/console path (store's per-phase commit —
 * zustand + engine.runPhaseAsync) has no filesystem at all, and in-process
 * callers (tests, eval) pass no `checkpointDir`, so every pre-existing path
 * keeps its exact bytes. A checkpoint failure NEVER throws into the run and
 * never changes its outcome (writeCheckpoint is itself corrupt-safe/coded).
 */
function commitRunCheckpoint(dir: string | undefined, project: Project): void {
  if (typeof dir !== "string" || dir.length === 0) return;
  try {
    writeCheckpoint(dir, project, { phase: project.currentPhase, step: 0, mode: runModeFor() });
  } catch {
    /* persistence never throws into the code it observes */
  }
}

/** T-107.7 (W33 lane L2): clear-on-complete — a terminal seal has no successor
 *  state to re-enter, so the bounded checkpoint is removed (best-effort; a
 *  missing file is already the desired state). */
function clearRunCheckpoint(dir: string | undefined): void {
  if (typeof dir !== "string" || dir.length === 0) return;
  try {
    clearCheckpoint(dir);
  } catch {
    /* best-effort */
  }
}

/**
 * T-107.7 (W36 lane N2) — the READ side of the checkpoint seam: read → admit → hydrate, so the
 * CLI `resume`/`unattended` verbs share ONE implementation of the read-side law.
 *
 * - A1-09/fixes/281: the reader proves only a MINIMAL shape — `hydrateProject` repairs it here
 *   (readers refuse; hydrators repair), so callers never touch an unhydrated snapshot.
 * - A1-07: `checkpointAdmits` owns the coded admission (identity + mode + integer phase/step);
 *   the mode is recomputed from THIS process's env (`runModeFor`) — a keyed snapshot never
 *   resumes keyless and vice versa. A named project file may pin the expected identity via
 *   `ask.projectId` (an id reused by a different brief fails closed).
 * - A20: the recorded `run.phase` is the re-entry point only when the snapshot's own phase
 *   records carry it — anything else is internally incoherent and refused here.
 */
export type CheckpointResumeResult =
  | { ok: true; project: Project; path: string; savedAt: number; resumedFrom: { phase: number; step: number } }
  | { ok: false; code: ErrorCode; error: string; path: string };

export function loadResumableCheckpoint(
  dir: string,
  ask: { projectId?: string; mode?: "keyless" | "keyed" } = {},
): CheckpointResumeResult {
  const read = readCheckpoint(dir);
  if (!read.ok) return { ok: false, code: read.code, error: read.error, path: read.path };
  const checkpoint = read.checkpoint;
  const admitted = checkpointAdmits(checkpoint, {
    projectId: typeof ask.projectId === "string" && ask.projectId.length > 0 ? ask.projectId : checkpoint.project.id,
    mode: ask.mode ?? runModeFor(),
  });
  if (!admitted.ok) return { ok: false, code: admitted.code, error: admitted.error, path: read.path };
  // A20: re-enter by RECORD ID — refuse a snapshot that cannot describe its own re-entry phase.
  const phases = Array.isArray(checkpoint.project.phases) ? checkpoint.project.phases : [];
  const hasRecord = phases.some(
    (record) => (record as { id?: unknown } | null | undefined)?.id === checkpoint.run.phase,
  );
  if (!hasRecord) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `checkpoint: snapshot has no phase record for P${checkpoint.run.phase} — refusing a re-entry the snapshot cannot describe`,
      path: read.path,
    };
  }
  try {
    const project = hydrateProject({
      ...checkpoint.project,
      currentPhase: checkpoint.run.phase as Project["currentPhase"],
    });
    return {
      ok: true,
      project,
      path: read.path,
      savedAt: admitted.savedAt,
      resumedFrom: { phase: checkpoint.run.phase, step: checkpoint.run.step },
    };
  } catch (error) {
    return { ok: false, code: classifyError(error, "RT_E_VALIDATION"), error: `checkpoint: hydrate failed (${String(error)})`, path: read.path };
  }
}

/**
 * fixes/323 FIX-2c (X2b OBS · window #4 item 2) — the checkpoint-STALENESS
 * comparison: a snapshot must never be silently resumed over a project file it
 * has been superseded by. PURE (no fs, no clock): the CLI arms hand in the
 * admitted snapshot's hydrated project + its re-entry phase and the named
 * project FILE's already-loaded state, and get back whether re-entering the
 * snapshot would override newer file state.
 *
 * Superseded when — first match names the reason:
 *   1. identity: the file's id differs from the snapshot's (a dir reused by a
 *      different project must never resume the old snapshot);
 *   2. terminal seal: the file is already `complete` (nothing to re-enter past
 *      the seal — a leftover snapshot must not rewind it);
 *   3. brief divergence: both briefs are strings and differ (the states have
 *      diverged — the snapshot no longer describes the file's intent);
 *   4. phase: the file sits BEYOND the snapshot's re-entry phase (resuming
 *      would rewind completed work — the live X2b shape: a stale gate-park
 *      snapshot at P4 silently rewound a file already advanced to P5);
 *   5. state: the file records MORE completed phases than the snapshot (the
 *      file knows work the snapshot does not);
 *   6. rejection / retry: the file records a rejection at the re-entry edge
 *      (project `blocked` or the edge record `rejected`), or a
 *      `rejectionHistory` the snapshot predates (a retried edge) — human
 *      history the snapshot cannot hold (fixes/325 A4, fixes/336 · 336-2);
 *   7. array growth: the file carries more artifacts / logs / decisions /
 *      memory rows than the snapshot (a non-drive mutation like `ingest` landed
 *      work after the per-phase commit) — skipped when the snapshot is at its
 *      bound, where the trimmed suffix makes counts incomparable (fixes/336 · 336-2).
 * A file BEHIND the snapshot is deliberately NOT superseded: that is the
 * crash-recovery shape `resume` exists for (the file is only saved at the END
 * of a drive, so a crash leaves it lagging the per-phase commits).
 *
 * Adjudicated NON-decisive axes (recorded, not silently dropped): full-project
 * or per-file content hashes and file mtimes — after a NORMAL park the file is
 * written after the checkpoint by the same drive, so it legitimately differs
 * (hitl block, park-time logs) and is strictly newer; treating that as stale
 * would flag every designed resume. The axes above are the ones that mean "the
 * file moved past / diverged from the snapshot".
 */
export function checkpointSupersededBy(
  snapshot: Project,
  snapshotPhase: number,
  file: Project,
): { superseded: boolean; reason: string | null } {
  const fileId = typeof file?.id === "string" && file.id.length > 0 ? file.id : null;
  const snapId = typeof snapshot?.id === "string" && snapshot.id.length > 0 ? snapshot.id : null;
  if (fileId !== null && snapId !== null && fileId !== snapId) {
    return {
      superseded: true,
      reason: `the project file is a different project (id ${fileId} vs the snapshot's ${snapId})`,
    };
  }
  if (file?.status === "complete") {
    return {
      superseded: true,
      reason: "the project file is already sealed complete — the snapshot predates the seal",
    };
  }
  const fileBrief = typeof file?.brief === "string" ? file.brief : null;
  const snapBrief = typeof snapshot?.brief === "string" ? snapshot.brief : null;
  if (fileBrief !== null && snapBrief !== null && fileBrief !== snapBrief) {
    return {
      superseded: true,
      reason: "the project file's brief differs from the snapshot's — the states have diverged",
    };
  }
  const filePhase =
    typeof file?.currentPhase === "number" && Number.isInteger(file.currentPhase) ? file.currentPhase : null;
  if (filePhase !== null && Number.isInteger(snapshotPhase) && filePhase > snapshotPhase) {
    return {
      superseded: true,
      reason: `the project file is at P${filePhase} — beyond the snapshot's re-entry phase P${snapshotPhase}; resuming would rewind completed work`,
    };
  }
  // 6. rejection (fixes/325 A4): the file records a HITL REJECTION the snapshot
  //    predates. The CLI `reject` verb writes the file at the SAME edge the
  //    snapshot records (phase/seal/id/brief axes all read equal): the edge
  //    record flips `awaiting_hitl` → `rejected`, project status →
  //    `blocked` (engine.rejectHitl), and a reject decision + `hitl.rejected`
  //    warn log + episodic memory row land in the append-only ledger. NONE of
  //    that is in the snapshot (a rejection is a human act after the per-phase
  //    commit; no drive path records it), so resuming the snapshot rewrites
  //    the file from it and silently drops the rejection — note,
  //    rejectionHistory, decision, memory row. Repro: a4_scratch/probe2.mts
  //    (pre-fix verdict superseded:false, then a resume-drive rewrote the file
  //    blocked/rejected → awaiting_hitl with 0 rejection rows).
  const edgeRecord = (Array.isArray(file?.phases) ? file.phases : []).find(
    (record) => (record as { id?: unknown } | null | undefined)?.id === snapshotPhase,
  ) as { status?: unknown } | null | undefined;
  if (edgeRecord?.status === "rejected" || file?.status === "blocked") {
    return {
      superseded: true,
      reason: `the project file records a rejected P${snapshotPhase} (status ${String(file?.status)}) — the snapshot predates the human rejection; resuming would drop it`,
    };
  }
  // 7. retry-after-rejection (fixes/336 · 336-2): `reject` flips the edge to
  //    rejected/blocked (axis 6); `retry` unlocks it back to ready/running but
  //    KEEPS `rejectionHistory`, and NEITHER verb updates the per-phase
  //    snapshot. Resuming the pre-rejection snapshot therefore rewinds the
  //    retried edge and drops the rejection record + its decision (live
  //    keyless probe: running/ready/history 1/decisions 1 → awaiting_hitl/
  //    history 0/decisions 0). The file holds human history the snapshot
  //    cannot describe — the file is the current truth.
  const rejectionCount = (record: unknown): number => {
    const history = (record as { rejectionHistory?: unknown } | null | undefined)?.rejectionHistory;
    return Array.isArray(history) ? history.length : 0;
  };
  const snapEdgeRecord = (Array.isArray(snapshot?.phases) ? snapshot.phases : []).find(
    (record) => (record as { id?: unknown } | null | undefined)?.id === snapshotPhase,
  );
  if (rejectionCount(edgeRecord) > rejectionCount(snapEdgeRecord)) {
    return {
      superseded: true,
      reason: `the project file records ${rejectionCount(edgeRecord)} rejection(s) at P${snapshotPhase} the snapshot predates — resuming would drop the rejection record`,
    };
  }
  // 8. array growth (fixes/336 · 336-2): a NON-DRIVE mutation (`ingest` lands a
  //    report's artifacts/logs/memory at the current edge; reject/retry land
  //    decisions) does not refresh the per-phase snapshot. Resuming the snapshot
  //    rewrites the file and DROPS that work (live keyless probe: park P4 /
  //    11 artifacts → ingest → 12 → resume → 11, the report gone). A normal
  //    park leaves checkpoint and file counts EQUAL (measured 20/20 artifacts,
  //    32/32 logs, 13/13 memory, 2/2 decisions), so growth means the file holds
  //    work the snapshot lacks. Each axis is skipped once the snapshot is AT its
  //    bound (a trimmed snapshot is a suffix — counts are not comparable then).
  const grew = (key: "artifacts" | "logs" | "decisions" | "memory", cap: number): boolean => {
    const snapshotRows = Array.isArray(snapshot?.[key]) ? (snapshot[key] as unknown[]) : [];
    const fileRows = Array.isArray(file?.[key]) ? (file[key] as unknown[]) : [];
    return snapshotRows.length < cap && fileRows.length > snapshotRows.length;
  };
  const grown = (
    [
      ["artifacts", CHECKPOINT_CAPS.artifacts],
      ["logs", CHECKPOINT_CAPS.logs],
      ["decisions", CHECKPOINT_CAPS.decisions],
      ["memory", CHECKPOINT_CAPS.memory],
    ] as const
  ).find(([key, cap]) => grew(key, cap));
  if (grown) {
    const snapshotRows = Array.isArray(snapshot?.[grown[0]]) ? (snapshot[grown[0]] as unknown[]).length : 0;
    const fileRows = Array.isArray(file?.[grown[0]]) ? (file[grown[0]] as unknown[]).length : 0;
    return {
      superseded: true,
      reason: `the project file carries ${fileRows} ${grown[0]} row(s) — more than the snapshot's ${snapshotRows}; the file holds work the snapshot does not`,
    };
  }
  const countSealed = (p: Project): number =>
    (Array.isArray(p?.phases) ? p.phases : []).filter(
      (record) => (record as { status?: unknown } | null | undefined)?.status === "complete",
    ).length;
  const fileSealed = countSealed(file);
  const snapSealed = countSealed(snapshot);
  if (fileSealed > snapSealed) {
    return {
      superseded: true,
      reason: `the project file records ${fileSealed} completed phase(s) — more than the snapshot's ${snapSealed}; the file knows work the snapshot does not`,
    };
  }
  return { superseded: false, reason: null };
}

/** Advance the pipeline until it parks (awaiting_hitl / complete / blocked) or
 *  hits `maxSteps` (default 40 — 13 phases × ~2 iterations + margin). */
export async function runUntilGate(
  project: Project,
  opts: {
    autopilot?: boolean;
    live?: boolean;
    maxSteps?: number;
    /** W-02 (fixes/271): threaded injection seam for the phase-6 edge. */
    p6Deps?: Partial<P6JourneyDeps>;
    /** T4 (112 §4.4 / 216g): caller-supplied cross-project proven lesson rows
     *  (from `knowledge.provenRowsFromStore`) for the P6 synthesis prompt.
     *  Threaded to the phase-6 journey; absent/empty ⇒ byte-identical runs. */
    proven?: readonly RankableLessonRow[];
    /** T-107.7 (W33 lane L2): the project's working dir. When present, every
     *  committed phase writes the bounded run checkpoint beside `.rapidtool/`
     *  (`commitRunCheckpoint`) and a terminal complete clears it
     *  (`clearRunCheckpoint`). Absent (browser/console path, in-process
     *  callers) ⇒ no-op: no dir, no write, byte-identical runs. */
    checkpointDir?: string;
  } = {},
): Promise<RunResult> {
  const autopilot = Boolean(opts.autopilot);
  const live = Boolean(opts.live);
  const maxSteps =
    typeof opts.maxSteps === "number" && opts.maxSteps > 0 ? Math.floor(opts.maxSteps) : 40;
  // W46 · 332-2 (L1 / AW45-c06): the run's cost must survive the process. Each
  // CLI verb is a fresh process, so the session ledger is a per-invocation
  // number; snapshot it here and fold THIS invocation's delta into the
  // project's cumulative `tokenUsage` at the run boundary (below). The session
  // cap keeps enforcing the process ledger unchanged — persisted spend never
  // feeds the cap.
  const spendBaseline = normalizeLedger(sessionTokenBudget().ledger);
  // W48 · 334-2 (L2): the newest refusal already on the record at entry — a
  // refusal this invocation appends must be distinguishable from it, so a
  // stale coded class never attaches to a clean run.
  const refusalBefore = newestP6Refusal(project);
  let p = project;
  let steps = 0;
  let iterations = 0;
  let dodBlocked = false;
  const events: string[] = [];
  while (iterations < maxSteps) {
    iterations += 1;
    const before = p;
    const r = await advanceOnce(p, autopilot, live, opts.p6Deps, opts.proven);
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
      // T-107.7 (W33 lane L2): the per-phase commit just landed — snapshot it
      // (guarded no-op without a dir; see commitRunCheckpoint).
      commitRunCheckpoint(opts.checkpointDir, p);
    }
    if (r.stopped) break;
  }
  // T-107.7 (W33 lane L2): a COMPLETE seal is terminal — nothing to resume ⇒
  // the checkpoint is cleared. Parks / caps / errors keep theirs: those ARE the
  // crash-recovery states `resume` exists for.
  if (p.status === "complete") clearRunCheckpoint(opts.checkpointDir);
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
  // W46 · 332-2 (L1 / AW45-c06) + W48 · 334-2 (L1/L3): fold this invocation's
  // measured session spend and its newest keyed outcome onto the project record
  // so the saved record and the returned `summary` carry the RUN's cost, and a
  // fresh `doctor` can read the last run's key rejection.
  finalProject = foldInvocationEvidence(finalProject, spendBaseline);
  // W48 · 334-2 (L2): the coded class of a P6 synthesis refusal THIS invocation
  // appended (never one already on the record at entry) — a P6 401 surfaces as
  // RT_E_LLM_KEY_REJECTED for the console chip (334-5). Absent otherwise.
  const refusalAfter = newestP6Refusal(finalProject);
  const code =
    refusalAfter &&
    (refusalBefore === null ||
      refusalAfter.ts !== refusalBefore.ts ||
      refusalAfter.detail !== refusalBefore.detail)
      ? p6RefusalCode(refusalAfter.detail)
      : undefined;
  return {
    project: finalProject,
    steps,
    stopped,
    events,
    outcome,
    sealedWithFailures,
    ...(code ? { code } : {}),
  };
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

/** Reject the pending HITL gate (throws unless ≥12 chars of qualitative note).
 *
 *  322 X1 (F-1): the minted row records an explicit ACTOR SEAT — a machine
 *  caller defaults to the harness's own autopilot seat, so a machine reject
 *  can never mint `decidedBy: "human"` (pre-fix: rejectHitl hardcoded it).
 *  A human seat must be claimed explicitly by the caller (CLI: `--i-am-human`
 *  + the out-of-band `RT_HUMAN_SEAT_TOKEN`, approve parity). */
export function reject(
  project: Project,
  note: string,
  actor: ApproveActor = HARNESS_APPROVE_ACTOR,
): Project {
  return rejectHitl(project, note, { decidedBy: actor.decidedBy });
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

// ---------------------------------------------------------------------------
// TASK-01 (W16-L2) — the wire-side next action.
//
// The 7-arm vocabulary is PINNED by the UI: `NEXT_ACTION_BUTTON` in
// `src/components/console.tsx` (W16-brief coordinate :382; the symbol is the
// anchor — L3 edits that file in this same wave, so line numbers drift) whose
// keys are the `UiNextAction["kind"]` union (:251). This block is the wire
// twin; the arm-parity doc-contract test
// (`scripts/next-action-arm-parity.test.mjs`) asserts set-equality between
// `NEXT_ACTION_KINDS`, the console's union, and the console's Record keys, so
// the envelope and the UI can never drift. Parent decision
// (taskuniverselog.md:534–538): implement 111's action vocabulary as the wire
// contract; keep the two computations INDEPENDENT this wave — do not rewire
// the console onto this field.
// ---------------------------------------------------------------------------

/** The pinned 7 arms as a runtime tuple (order mirrors the console union). */
export const NEXT_ACTION_KINDS = [
  "run",
  "approve",
  "retry",
  "done",
  "running",
  "fix-gate",
  "unknown",
] as const;

export type NextActionKind = (typeof NEXT_ACTION_KINDS)[number];

/** Wire mirror of the console's `UiNextAction` (the 111 §3.4 `kind · cmd ·
 *  phase · why` shape). `cmd` names the CLI verb that performs the action —
 *  the UI shows the same word next to its button (one vocabulary, two
 *  computations). */
export type NextAction = {
  kind: NextActionKind;
  cmd: string;
  phase: PhaseId;
  why: string;
};

/** Documented generic sentence — only ever used by the `unknown` arm; never a
 *  fabricated specific claim (mirrors console.tsx `GENERIC_NEXT_WHY`). */
const GENERIC_NEXT_WHY = "Nothing is waiting on you — run the next phase to move the build forward.";

/**
 * TASK-01 (W16-L2) — the ONE next action for the summary envelope: a faithful
 * transcription of the console's `uiNextAction` branch order (console.tsx:311)
 * over the PERSISTED project state. Most urgent fact wins, exactly as in the
 * console: empty phases → running → hitl → blocked → complete → failed gate →
 * rejected → default run. The console additionally folds in its in-flight
 * latch; the wire reads the recorded phase status — the honest floor.
 * The `unknown` arm is mandatory (empty phases returns it BEFORE any phase
 * lookup) so the field can never fabricate a specific claim; every other arm
 * names a real CLI verb (status / gate / approve / retry / emit).
 */
export function nextAction(project: Project): NextAction {
  if (!project.phases.length) {
    return { kind: "unknown", cmd: "status", phase: project.currentPhase, why: GENERIC_NEXT_WHY };
  }
  const current = phaseDef(project.currentPhase);
  // A20: the edge's record is looked up by ID, never by array position — a
  // sparse/reordered phases array (hand-built or foreign payload) otherwise
  // reads some OTHER phase's status as the current edge's.
  if (project.phases.find((r) => r.id === project.currentPhase)?.status === "running") {
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
      why: `A gate check on ${phaseDef(failedGate.id).code} failed — review the gate record before continuing.`,
    };
  }
  if (project.phases.find((r) => r.id === project.currentPhase)?.status === "rejected") {
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
  /** TASK-01 (W16-L2): the ONE next action (`kind · cmd · phase · why`) drawn
   *  from the SAME 7-arm vocabulary the console renders — `kind` ∈
   *  `NEXT_ACTION_KINDS` above, pinned arm-parity by
   *  `scripts/next-action-arm-parity.test.mjs`. A caller never guesses the
   *  next step; `unknown` when nothing specific is knowable. */
  nextAction: NextAction;
  /** T5.5 (OV-41 spend half, W43 · H6) + W46 · 332-2 (L1 / AW45-c06): the
   *  spend boundary at summary time. `spent` is the RUN's cumulative cost —
   *  the project's persisted `tokenUsage` slice when it carries one (written by
   *  runUntilGate across invocations), else the process session ledger, which a
   *  fresh CLI process starts empty. `cap`/`stop_reason` stay the process
   *  session's (the `RAPIDTOOL_TOKEN_CAP` runaway stop) — persisted spend never
   *  feeds the cap. Always present: the session budget always exists; `cap:
   *  null` states the unmetered default explicitly (never collapsed into an
   *  absent case — CF-SE2-3a). Read-only — summary() never spends, records, or
   *  throws. */
  budget: PacketBudget;
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
  // T5.5 (OV-41 spend half): the session ledger boundary — packet.ts's ONE
  // reader (F2-04) over the process session accessor. The accessor always
  // returns a budget object (lazily created), so the reader's null arm (no
  // budget at all) is unreachable; the explicit unmetered floor keeps the
  // envelope key ALWAYS PRESENT instead of absent — same key, same triple.
  const sessionBudget: PacketBudget = packetBudgetBoundary(sessionTokenBudget()) ?? {
    spent: 0,
    cap: null,
    stop_reason: null,
  };
  // W46 · 332-2 (L1 / AW45-c06): `spent` is the RUN's cumulative cost. Every
  // CLI invocation is a fresh process whose session ledger starts empty, so a
  // bare session read reported the last call (measured `446 → 0 → 77654`);
  // when the project carries a persisted `tokenUsage` slice (written by
  // runUntilGate), it is the run total. `cap`/`stop_reason` stay the PROCESS
  // session's — the session cap is what stops a runaway — so a project with no
  // persisted slice keeps the byte-identical session triple.
  const budget: PacketBudget = isMeasuredSpend(project.tokenUsage)
    ? {
        spent: totalTokens(normalizeLedger(project.tokenUsage)),
        cap: sessionBudget.cap,
        stop_reason: sessionBudget.stop_reason,
      }
    : sessionBudget;
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
    // TASK-01 (W16-L2): the ONE next action — same 7-arm vocabulary as the UI.
    nextAction: nextAction(project),
    // T5.5 (OV-41): the spend half — measured from the real session ledger, never estimated.
    budget,
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
  /** A7: leftover files kept because `--force` (foreign user files). R11-f08:
   *  a forced emit no longer KEEPS them — it quarantines them (below), so this
   *  is always empty on a successful emit (kept for envelope compatibility). */
  survivors: string[];
  /** R11-f08: emit-dir-relative foreign files MOVED into quarantine this emit
   *  (`<dir>/.rapidtool-quarantine/<stamp>/<rel>`). Empty when nothing was
   *  foreign. Recoverable, never deleted. */
  quarantined: string[];
  /** R11-f08: `<dir>/.rapidtool-quarantine/<stamp>` — null when nothing moved. */
  quarantineDir: string | null;
  /** R11-f08: requested foreign paths that were already gone (unreachable on
   *  the emit path — reported, never a silent drop). */
  quarantineMissing?: string[];
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
  /** R11-f08: moves that threw — the tree still holds these files. */
  quarantineFailed?: QuarantineFailure[];
  /** R11-f08: set when a failed quarantine move suppressed a caller's judging
   *  legs (`--verify-kind`/`--check`/`--run`) — the tree is still mixed. */
  judgingSkipped?: string;
  /** 216 (T-07 / F-07): the uncleared red-tree trail behind an
   *  `RT_E_TREE_RUN_FAILED` refusal. */
  redTree?: RedTreeRef | null;
};

// R11-f08 (W42 · L4/E4): `.rapidtool-quarantine` joins the skip set — the CLI
// emit wire moves forced-emit survivors there (src/lib/quarantine.ts), and a
// repeat emit over the same dir must never re-judge them as foreign leftovers.
const EMIT_SKIP_DIRS = new Set(["node_modules", ".git", ".vercel", ".rapidtool-quarantine"]);
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

/** W-03 (fixes/271 · §R3-f01 + AMENDMENT): CJS residue the emit-time
 *  materializer exists to rewrite — `module.exports` anywhere, or a bare
 *  `exports.`/`exports =` assignment head (never `xexports.`/`reexports.`
 *  look-alikes). The GUARD IS RESIDUE-BASED, deliberately NOT a byte-diff:
 *  `materializeImportableTree` is NOT idempotent (proved live on the W29 E1
 *  lane — a recompute-and-compare guard would re-rewrite endlessly), while
 *  clean ESM bytes carry no residue and must pass through VERBATIM (the
 *  scaffold.test.ts verbatim pin + the 2-file fixture). */
const CJS_RESIDUE_RE = /module\.exports|(?:^|[^\w$.])exports\s*(?:\.|=[^=])/;

/**
 * W-03 (fixes/271 · §R3-f01 PROVEN REPAIR): emit-time materialization. A
 * stored tree that still carries CJS residue is rewritten through codegen's
 * materializeImportableTree into real ESM (chunk file(s) + the
 * TREE_ENTRY_PATH barrel) BEFORE the scaffold runs — so BOTH the emitted tree
 * files AND the `.rapidtool/project.json` record (exportProjectJson inside
 * scaffoldProject) carry the SAME materialized bytes, and the emitted
 * `"type":"module"` tenant can actually import them (the old verbatim push
 * shipped `module.exports.*` bytes the tenant died on at import). `exports:
 * []` is deliberate: GeneratedTreeFile stores no exports list, and
 * neutralizeResidualCjsExports alone recovers the surface from the residue
 * (proven live). Record fields are recomputed through codegen's own
 * toGeneratedTreeFile (fnv1a hash + preserved attempt) so the stored row never
 * disagrees with the emitted bytes. Returns the SAME project reference when
 * there is no materializable residue (exact current bytes); a seam-load
 * failure also returns the project untouched — never a half-materialized tree.
 *
 * T1 (331-3 · fixes/330 §6.1): a LONE generatedSource (zero tree rows) is the
 * legacy host path — the scaffold writes it verbatim at the first job node.
 * The pre-331 guard early-returned on zero rows, so a `module.exports` body
 * that reached an imported/stale record was never materialized and shipped
 * unloadable into the `"type":"module"` package (330 Fix A then refused it —
 * safe, but the path never CONVERTED). Treat that lone source as a
 * single-row tree plan at TREE_ENTRY_PATH and run it through the SAME
 * materializeImportableTree seam, so the path now converts: ESM chunk +
 * src/generated.ts barrel that the emitted tenant can actually import. The
 * multi-row branch is untouched (byte-identical to pre-331 for every stored
 * tree). Residue in a generatedSource BESIDE a non-empty tree is dead data
 * (tree mode never hosts generatedSource) and never reaches an emitted code
 * file, so it is deliberately left alone rather than reshaping the tree.
 */
async function materializeEmitTree(project: Project): Promise<Project> {
  const rows = Array.isArray(project.generatedTree) ? project.generatedTree : [];
  const generatedSource = typeof project.generatedSource === "string" ? project.generatedSource : "";
  const treeHasResidue = rows.some((r) => CJS_RESIDUE_RE.test(String(r?.source ?? "")));
  const loneSourceHasResidue = rows.length === 0 && CJS_RESIDUE_RE.test(generatedSource);
  if (!treeHasResidue && !loneSourceHasResidue) return project;
  try {
    const codegen = await import("./codegen.server.ts");
    const input =
      rows.length > 0
        ? rows.map((r) => ({ path: r.path, source: r.source, exports: [] }))
        : [{ path: codegen.TREE_ENTRY_PATH, source: generatedSource, exports: [] }];
    const { files, entrySource } = codegen.materializeImportableTree(input);
    if (files.length === 0) return project;
    const attempts = new Map(rows.map((r) => [r.path, typeof r.attempt === "number" ? r.attempt : 0]));
    return {
      ...project,
      generatedTree: files.map((f) => codegen.toGeneratedTreeFile(f.path, f.source, attempts.get(f.path) ?? 0)),
      generatedSource: entrySource,
    };
  } catch {
    return project;
  }
}

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
  // W-03 (fixes/271 · §R3-f01 + AMENDMENT): emit-time materialization — a
  // stored tree that still carries CJS residue is rewritten to importable ESM
  // BEFORE the scaffold runs (so the tree files AND the exported
  // `.rapidtool/project.json` record carry the same bytes). Clean / no-tree
  // projects return the same reference: byte-identical emits.
  const emitProjectInput = await materializeEmitTree(project);
  const result = scaffold.scaffoldProject(emitProjectInput);
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
  // 310 B3 (M7-02, fixes/310_b3_boundary.md): mkdir is a boundary the emit
  // CONTRACT owns — a parent-is-a-FILE target (ENOTDIR) or an unwritable
  // parent (EPERM/EACCES) used to THROW straight through `{ok:false}` and the
  // CLI collapsed it to exit 4 `RT_E_INTERNAL` while every other emit failure
  // is coded. Catch → the coded-refusal shape (classifyError: ENOTDIR →
  // RT_E_PATH_KIND_MISMATCH, EPERM → RT_E_PERMISSION_DENIED — the CLI's own
  // mapping).
  try {
    mkdirSync(target, { recursive: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `emit: cannot create ${target} (${msg})`, code: classifyError(err, "RT_E_INTERNAL") };
  }
  const lockPath = join(target, ".rapidtool-emit.lock");
  let fd: number | null = null;
  // fixes/310 (B1 · M6-01): stale-aware claim — an SIGKILLed emit's stranded
  // lock is reclaimed; a live writer still refuses RT_E_BUSY, and `--force`
  // (foreign-files) semantics are unchanged: it never bypasses the lock.
  try {
    fd = acquireExclusiveLock(lockPath);
  } catch (err) {
    // 310 B3 (M7-03): a non-EEXIST lock failure (EPERM on a read-only target
    // dir, …) is the same coded refusal — the API-level throw bypassed the
    // emit contract (the CLI already classified EPERM as RT_E_PERMISSION_DENIED).
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `emit: cannot open the emit lock at ${lockPath} (${msg})`,
      code: classifyError(err, "RT_E_INTERNAL"),
    };
  }
  if (fd === null) {
    return { ok: false, error: "emit: another writer holds the emit lock", code: "RT_E_BUSY" };
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
    const moduleEmbedded = files.some((f) => f.body.includes(emitProjectInput.generatedSource ?? ""));
    // R11-f08 (lifted from the CLI's emit arm): a forced emit MOVES the
    // foreign files aside into `<target>/.rapidtool-quarantine/<stamp>/` and
    // reports them — so EVERY forced caller quarantines, not just the CLI, and
    // a later tree-run never judges bytes the factory never authored (A1-f07).
    // A failed move means the tree is STILL mixed, so the emit refuses
    // (`ok:false`, RT_E_FOREIGN_FILES) and names `judgingSkipped`: a caller
    // must not run its judging legs and mint `tested` over that tree.
    let quarantined: string[] = [];
    let quarantineDir: string | null = null;
    let quarantineMissing: string[] = [];
    if (opts.force === true && foreign.length > 0) {
      const q = await import("./quarantine.ts");
      const moved = await q.quarantineFiles(target, foreign);
      quarantined = moved.moved;
      quarantineDir = moved.quarantineDir;
      quarantineMissing = moved.missing;
      if (!moved.ok) {
        return {
          ok: false,
          error:
            "emit: forced foreign files could not be quarantined — " +
            moved.failed.map((f) => `${f.path} (${f.error})`).join(", "),
          code: "RT_E_FOREIGN_FILES",
          foreign: moved.failed.map((f) => f.path),
          quarantineFailed: moved.failed,
          judgingSkipped:
            "foreign files could not be quarantined — --verify-kind/--check/--run did not run (the tree is still mixed; R11-f08 · A1-f07)",
        };
      }
    }
    return {
      ok: true,
      dir: target,
      files: written,
      summary: result.summary,
      moduleEmbedded,
      wiped,
      // R11-f08: the foreign files no longer survive in place — they moved
      // into quarantine (reported below). Kept for envelope compatibility.
      survivors: [],
      quarantined,
      quarantineDir,
      ...(quarantineMissing.length > 0 ? { quarantineMissing } : {}),
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
  /** fixes/326 F1b: the ONE bounded gate-repair cycle's context — the recorded
   *  unmet P6 DoD requirements (criteria + missing lists) from a green
   *  tree-run/red-gate cycle, fed to the next synthesis as deps.gateRepair.
   *  Present ONLY on a diverted repair cycle (at most one per journey). */
  gateRepair?: string;
  /** T4 (112 §4.4 / 216g): the caller's resolved cross-project proven lesson
   *  rows (`knowledge.provenRowsFromStore(...).rows`), supplied once through
   *  the run options and carried on EVERY cycle so the synthesis prompt ranks
   *  them with the project's own memory lessons. Absent/empty ⇒
   *  `p6CycleLiveDeps` materializes no key and the call is byte-identical. */
  proven?: readonly RankableLessonRow[];
  /** W45 (parent keyed finding D): the repo-relative file path(s) the previous
   *  tree-run NAMED as failing (`treeRunFailureFiles` — the generated-core
   *  LOAD shape included). `repairCycleLiveDeps` folds them into
   *  `deps.treeFailure` as an explicit "Repair target file(s)" directive, so a
   *  repair cycle targets the file it was told to fix instead of repairing
   *  around it. Absent/empty ⇒ the directive is byte-identical to the legacy
   *  tail. Set only by the repair drivers. */
  repairTargets?: readonly string[];
};

/** fixes/153 (P2): deps.synthesisRefusal cap — the bounded refusal excerpt a
 *  refused cycle feeds the next (the refusal class — RT_E_* code · first
 *  clause — plus the model's reason, up to this cap, mirroring the 1500-char
 *  treeFailure tail cap: a long/hostile reason can never blow the next cycle's
 *  prompt budget). Raised 200 → 1200 by the 339 wave so the oracle/case reason
 *  reaches the next cycle instead of being clipped out. */
const P6_JOURNEY_REFUSAL_MAX = 1200;

/** fixes/147 (E2) + fixes/153 (P2) + fixes/328 F1: map a journey cycle's
 *  context onto engine.liveLayer's additive P6 deps (LiveLayerDeps) — which
 *  the engine forwards verbatim into codegen liveP6Synthesis as
 *  deps.treeFailure (the bounded repair re-prompts' tree-failure reader) and
 *  deps.synthesisRefusal (the previous cycle's refusal class + bounded
 *  reason — read by codegen's PRIMARY-prompt reader
 *  withSynthesisRefusalContext; fixes/328 F1 closed the reader fixes/153 P2
 *  deferred) and deps.proven (T4 · 112 §4.4: the caller's cross-project
 *  lesson rows, ranked by codegen's lesson sites alongside project memory).
 *  An absent/empty context ⇒ undefined ⇒
 *  the legacy byte-identical liveLayer(p, 6) call (zero behavior change);
 *  a tree-failure-only ctx yields exactly { treeFailure } — no
 *  synthesisRefusal key — byte-identical to fixes/147. Exported so the
 *  driver's default synthesize seam and its tests share ONE mapping. */
export type P6CycleLiveDepsShape = {
  treeFailure?: string;
  /** Bounded refusal context from the previous cycle (fixes/153 P2). Present
   *  ONLY when the previous cycle's synthesis refused — the refusal class
   *  (RT_E_* code) + the model's reason, up to P6_JOURNEY_REFUSAL_MAX (1200). */
  synthesisRefusal?: string;
  /** T-107.1 (216r · W7-L1): the opt-in patch (str_replace) repair level —
   *  set ONLY by `repairCycleLiveDeps` (the repair drivers). `p6CycleLiveDeps`
   *  never sets it, so the journey mapping stays byte-identical to fixes/153. */
  patchRepairs?: boolean;
  /** fixes/326 F1b: bounded unmet-requirements context for the ONE
   *  gate-repair cycle (see P6JourneyCycleContext.gateRepair). */
  gateRepair?: string;
  /** T4 (112 §4.4 / 216g): the caller's cross-project proven lesson rows,
   *  carried verbatim onto engine.LiveLayerDeps.proven ⇒ codegen's lesson
   *  sites. Present ONLY when the campaign supplied at least one row. */
  proven?: readonly RankableLessonRow[];
};

export function p6CycleLiveDeps(ctx: P6JourneyCycleContext): P6CycleLiveDepsShape | undefined {
  const tail = typeof ctx.treeFailureTail === "string" ? ctx.treeFailureTail : "";
  const refusal = typeof ctx.refusal === "string" ? ctx.refusal : "";
  const gateRepair = typeof ctx.gateRepair === "string" ? ctx.gateRepair : "";
  const proven = Array.isArray(ctx.proven) && ctx.proven.length > 0 ? ctx.proven : null;
  if (tail.length === 0 && refusal.length === 0 && gateRepair.length === 0 && proven === null) return undefined;
  const deps: P6CycleLiveDepsShape = {};
  if (tail.length > 0) deps.treeFailure = tail;
  if (refusal.length > 0) deps.synthesisRefusal = refusal.slice(0, P6_JOURNEY_REFUSAL_MAX);
  if (gateRepair.length > 0) deps.gateRepair = gateRepair.slice(0, P6_JOURNEY_GATE_REPAIR_MAX);
  if (proven !== null) deps.proven = proven;
  return deps;
}
/**
 * T-107.1 (216r · W7-L1): the repair drivers' ctx→deps mapping — the journey
 * mapping (fixes/153 P2) PLUS the opt-in patch (str_replace) repair level. A
 * repair cycle is exactly where a bounded per-file delta beats a whole-module
 * re-emit: codegen applies a returned delta against the module it just
 * produced for that file via `applyStrReplace` and revalidates it with the
 * EXISTING deterministic validator; any refusal returns the legacy
 * full-rewrite repair path UNCHANGED. Exported so the repair seam and its
 * tests share ONE mapping without a model.
 */
export function repairCycleLiveDeps(ctx: P6JourneyCycleContext): P6CycleLiveDepsShape {
  const base = p6CycleLiveDeps(ctx) ?? {};
  const deps: P6CycleLiveDepsShape = { ...base, patchRepairs: true };
  // W45 (parent keyed finding D): the failure tail NAMES the file, but codegen
  // only appends `treeFailure` to a repair prompt that some OTHER defect
  // triggered — so the named file can be repaired around. Pin it as an
  // explicit directive block on the SAME `treeFailure` seam codegen already
  // forwards (no new deps key, nothing dead). Capped so the prompt stays
  // bounded; empty ⇒ byte-identical legacy deps.
  const targets = Array.isArray(ctx.repairTargets)
    ? ctx.repairTargets.filter((p): p is string => typeof p === "string" && p.length > 0).slice(0, 8)
    : [];
  if (targets.length > 0) {
    const block = `Repair target file(s) named by the failure — fix these first:\n${targets.join("\n")}`;
    deps.treeFailure = base.treeFailure ? `${base.treeFailure}\n\n${block}` : block;
  }
  return deps;
}

/** Injectable seams. The defaults ARE the production seams; fakes only replace
 *  them in unit tests (deterministic, no key / fs / runner). */
export type P6JourneyDeps = {
  /** Produce/repair seam — one synthesis attempt. Default: the live-layer P6
   *  synthesis seam the headless loop uses today (engine.liveLayer for phase
   *  6, which applies the deterministic floor then runs codegen
   *  liveP6Synthesis when keyed). The cycle context reaches codegen through
   *  liveLayer's additive deps param (engine forwards the object verbatim):
   *  treeFailure (fixes/147 E2), synthesisRefusal (fixes/153 P2 · 328 F1),
   *  gateRepair (fixes/326 F1b) and proven (T4 · 330); the `p6.tree.failure`
   *  log is the durable record trail. */
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
/** fixes/326 F1b: cap for the one-shot gate-repair context (parity with the
 *  refusal cap discipline — a long unmet list can never blow the prompt). */
const P6_JOURNEY_GATE_REPAIR_MAX = 700;

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

/**
 * T-107.7 (W33 lane L2): the key state a checkpoint records as `run.mode` —
 * and the exact probe `checkpointAdmits` compares on resume (a keyed snapshot
 * never resumes keyless, and vice versa). Plain sync env read with
 * `engine.keyedDeepSeekConfigured` (:1820) / `deepseek.server.isDeepSeekConfigured`
 * trim semantics. Bare-Node hosts only; a browser host never reaches a
 * checkpoint write (no dir — see commitRunCheckpoint).
 */
export function runModeFor(): "keyless" | "keyed" {
  try {
    if (typeof process === "undefined") return "keyless";
    const value = process.env?.DEEPSEEK_API_KEY;
    return typeof value === "string" && value.trim().length > 0 ? "keyed" : "keyless";
  } catch {
    return "keyless";
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

/** fixes/326 F1b PREP: the bounded context for the ONE gate-repair cycle —
 *  the recorded unmet criteria + the concrete missing lists already on the
 *  record (latest p6.synthesis.refused / dod.reqtrace rows). Recorded
 *  evidence only; the engine adds no requirement the brief never had. */
function gateRepairContextOf(project: Project, unmet: readonly string[]): string {
  const logs = project.logs ?? [];
  const scraped: string[] = [];
  for (let i = logs.length - 1; i >= 0 && scraped.length < 3; i--) {
    const l = logs[i];
    if ((l.event === "p6.synthesis.refused" || l.event === "dod.reqtrace") && typeof l.detail === "string") {
      const at = l.detail.indexOf("missing:");
      if (at >= 0) scraped.push(l.detail.slice(at, at + 300));
    }
  }
  return [
    `P6 DoD unmet: ${unmet.join(" | ")}`,
    scraped.length > 0 ? `Recorded missing requirements: ${scraped.join(" · ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, P6_JOURNEY_GATE_REPAIR_MAX);
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

/** W45 (parent keyed finding D): the repo-relative file path(s) a red
 *  tree-run NAMES as its failing subject. The generated-core LOAD failure
 *  (`o.core`, the UI-shell shape) is read EXPLICITLY — it is distinct from the
 *  per-spec test failure shape (`o.tests`) and from the emitted project's own
 *  `npm run` leg — plus non-pass compile rows and a non-pass entry smoke. Used
 *  by `repairTreeDir` to (a) put the named file into the repair directive so a
 *  cycle can target it and (b) surface it as an explicit refusal when a cycle
 *  does not address it, so a failing file is never silently skipped.
 *  Deterministic order, deduped, repo-relative POSIX paths only. */
export function treeRunFailureFiles(o: TreeRunOutcome): string[] {
  const out: string[] = [];
  const add = (p: unknown): void => {
    if (typeof p !== "string" || p.length === 0) return;
    if (p.includes("\\") || p.startsWith("/") || /^[A-Za-z]:/.test(p)) return;
    // The scaffold-owned oracle spec is never a repair target: telling the
    // model to "fix" the acceptance contract invites editing the test to pass
    // instead of fixing the product. Its failure is still in the tail.
    if (REPAIR_TREE_RESERVED.has(p)) return;
    if (!out.includes(p)) out.push(p);
  };
  if (o.core && o.core.run !== "pass") add(o.core.entry);
  for (const v of o.compile?.verdicts ?? []) if (v.verdict !== "pass") add(v.file);
  if (o.run && o.run.run !== "pass" && o.run.run !== "skip") add(o.run.entry);
  const spec = (o.tests ?? []).find((t) => t.run !== "pass");
  if (spec) add(spec.file);
  return out;
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
 *  refusal class + model reason, read by codegen's PRIMARY-prompt reader
 *  withSynthesisRefusalContext (fixes/328 F1). codegen liveP6Synthesis reads
 *  deps?.treeFailure for tree-repair re-prompts. p6CycleLiveDeps is the
 *  single ctx→deps mapping. */
/** The shared cycle-synthesis core: floor stamping + the live-layer call. The
 *  two defaults below differ ONLY in the ctx→deps mapping they pass. */
async function synthesizeCycle(
  project: Project,
  ctx: P6JourneyCycleContext,
  deps: P6CycleLiveDepsShape | undefined,
): Promise<Project> {
  let p = project;
  if (ctx.treeFailureTail) {
    const logs = p.logs ?? [];
    const last = logs[logs.length - 1];
    const alreadyStamped = last && last.event === "p6.tree.failure" && last.detail === ctx.treeFailureTail;
    if (!alreadyStamped) p = p6JourneyLog(p, "warn", "p6.tree.failure", ctx.treeFailureTail);
  }
  try {
    const upgraded = await liveLayer(p, 6, deps);
    return upgraded && upgraded !== p ? upgraded : p;
  } catch {
    return applyPhaseResult(p, 6);
  }
}

async function defaultP6Synthesize(project: Project, ctx: P6JourneyCycleContext): Promise<Project> {
  return synthesizeCycle(project, ctx, p6CycleLiveDeps(ctx));
}

/** T-107.1 (216r · W7-L1): the `repairTreeDir` default synthesis seam —
 *  `defaultP6Synthesize` with the patch-repair level ON (a repair cycle is
 *  exactly where a per-file delta beats a whole-module re-emit). Everything
 *  else is identical: same floor, same refusal passthrough, same log
 *  stamping. */
async function defaultRepairSynthesize(project: Project, ctx: P6JourneyCycleContext): Promise<Project> {
  return synthesizeCycle(project, ctx, repairCycleLiveDeps(ctx));
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
 * T9.3 promotion (W44 · G3 · applied from fixes/319_f3_promote §C): a genuinely
 * GREEN tree-run over an EMITTED dir promotes the dir's OWN
 * `.rapidtool/project.json` record to the tested stamp + evidence hash the run
 * just earned — the same self-guarded mint the journeys use (mintTreeRunTested:
 * outcome.ok AND ≥1 executed assertion). A red run, an ok run that executed no
 * spec, or a dir that carries no record writes NOTHING into the dir (absence is
 * honest; a stamp is never fabricated or downgraded). A re-run over an
 * already-`tested` project writes nothing when the verdict is unchanged, and
 * DOES promote when this verdict refreshed a stale hash (fixes/336 · 336-2) —
 * the refreshed record's packet is recompiled before it is written, so the
 * emitted record never describes a different verification state.
 */
export async function promoteEmittedTreeTested(
  project: Project,
  dir: string,
  outcome: TreeRunOutcome,
): Promise<{ project: Project; promoted: boolean }> {
  const beforeHash = (project.lastTest as { evidenceHash?: string } | null | undefined)?.evidenceHash ?? null;
  const minted = await applyTreeRunTestedMint(project, outcome);
  const afterLabel = (minted.lastTest as { label?: string } | null | undefined)?.label ?? null;
  const afterHash = (minted.lastTest as { evidenceHash?: string } | null | undefined)?.evidenceHash ?? null;
  // Promote when THIS verdict produced (or REFRESHED — fixes/336 · 336-2) the
  // stamp the record must carry; a same-verdict re-run (hash unchanged) writes
  // nothing (no churn), and an already-`tested` project whose recorded hash was
  // stale is now promoted so the emitted record never keeps a hash from a
  // different tree.
  if (afterLabel !== "tested" || afterHash === null || afterHash === beforeHash) {
    return { project: minted, promoted: false };
  }
  // The promotion writes the WHOLE record, so its packet must describe the
  // verification stamp this verdict just earned (refresh BEFORE persisting).
  const refreshed = stampPacket(minted);
  const recordPath = resolve(dir, ".rapidtool", "project.json");
  if (!existsSync(recordPath)) return { project: refreshed, promoted: false };
  try {
    writeFileSync(recordPath, exportProjectJson(refreshed), "utf8");
    return { project: refreshed, promoted: true };
  } catch {
    // best-effort: the minted LEDGER still returns to the caller; the artifact
    // record is left exactly as emitted (never half-promoted).
    return { project: refreshed, promoted: false };
  }
}

/**
 * fixes/323 FIX-2c (T9.3 repair-dir variant · fixes/319_f3_promote §C4/§D.1) —
 * the repair arm's dir promotion. `repairTreeDir` mints the tested stamp onto
 * the LEDGER inside its own `recordGreen` before the CLI layer ever sees the
 * result, so `promoteEmittedTreeTested`'s `before === "tested"` early return
 * can never write the emitted dir's own `.rapidtool/project.json` — the T9.3
 * promotion would never fire for the repair arm (adjudicated in
 * fixes/323_f2_register.md). Here the CALLER attests the fresh mint from THIS
 * invocation's own evidence (`result.minted` — set only when this repair run
 * flipped the label to "tested"; never a pre-existing label, never a red or
 * no-spec run). Keep this self-guarded: the write still requires the attested
 * fresh `tested` label AND an existing dir record; a red run, a no-spec green
 * run, an un-attested call, or a recordless dir writes NOTHING (absence is
 * honest; a stamp is never fabricated into existence).
 */
export function promoteRepairedDirTested(
  project: Project,
  dir: string,
  attestedFreshMint: boolean,
): { promoted: boolean } {
  if (attestedFreshMint !== true) return { promoted: false };
  const label = (project.lastTest as { label?: string } | null | undefined)?.label ?? null;
  if (label !== "tested") return { promoted: false };
  const recordPath = resolve(dir, ".rapidtool", "project.json");
  if (!existsSync(recordPath)) return { promoted: false };
  try {
    writeFileSync(recordPath, exportProjectJson(project), "utf8");
    return { promoted: true };
  } catch {
    // best-effort: the minted LEDGER still returns to the caller; the artifact
    // record is left exactly as it stood (never half-promoted).
    return { promoted: false };
  }
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
  opts: {
    budget?: number;
    deps?: Partial<P6JourneyDeps>;
    workDir?: string;
    /** T4 (112 §4.4 / 216g): caller-supplied cross-project proven lesson rows
     *  carried on EVERY cycle's ctx (⇒ p6CycleLiveDeps ⇒ codegen). */
    proven?: readonly RankableLessonRow[];
  } = {},
): Promise<P6JourneyResult> {
  const budget =
    typeof opts.budget === "number" && opts.budget > 0 ? Math.floor(opts.budget) : P6_JOURNEY_DEFAULT_BUDGET;
  // T4: normalize once — an absent/empty supply materializes no ctx key, so a
  // journey without rows builds the exact ctx it did before (byte-identity).
  const proven = Array.isArray(opts.proven) && opts.proven.length > 0 ? opts.proven : null;
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
  // fixes/326 F1b: at most ONE gate-repair diversion per journey.
  let gateRepair: string | null = null;
  let gateRepairUsed = false;
  for (let cycle = 1; cycle <= budget; cycle++) {
    const ctx: P6JourneyCycleContext = { cycle };
    if (proven !== null) ctx.proven = proven;
    if (treeTail !== null) ctx.treeFailureTail = treeTail;
    if (refusal !== null) ctx.refusal = refusal;
    if (gateRepair !== null) {
      ctx.gateRepair = gateRepair;
      gateRepair = null; // consume-once: the diversion is exactly one cycle
    }
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
        // C-1 (WB-1 defusal, 2026-09-24): mint the tested-equivalent from THIS
        // cycle's genuinely green tree-run BEFORE recording the gate. T0.6's
        // intent is preserved untouched — the mint is still never forced:
        // mintTreeRunTested() self-guards on `outcome.ok === true` AND ≥1
        // executed assertion, and a non-executed green run mints nothing
        // (p6.tree.tested.skipped). Only the ORDER changes: the old order made
        // p6-verified — which requires the mint's lastTest — a precondition of
        // gate.passed, which gated the mint. Circular: every chunked keyed tree
        // could never converge (223 §4 C-1; RED-first test added in
        // headless.test.ts "C-1 (WB-1)"). The post-gate mint below is idempotent
        // (mintTreeRunTested returns early when already tested) and stays.
        finalProject = await applyTreeRunTestedMint(finalProject, verdict);
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
      // fixes/336 · 336-2: the mint and the DoD/gate record just changed this
      // project's verification state — recompile the packet (the SAME builder
      // every other stamp site uses) so the record's OWN packet describes the
      // stamp and gate it now carries. Without this the persisted record ships
      // a packet whose P6 line / DoD section predate the mint (the live
      // stale-vs-fresh divergence 336-3 measured).
      finalProject = stampPacket(finalProject);
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
        // Re-stamp LAST (fixes/336 · 336-2): the converged log is the final
        // record mutation, so compile the packet AFTER it — the returned
        // record's own packet is then byte-identical to a fresh compile of the
        // record, and never lags the verification state it describes.
        finalProject = stampPacket(finalProject);
        events.push(`cycle ${cycle}: tree-run ok + P6 gate passed — P6 journey converged`);
        return { outcome: "converged", project: finalProject, cycles: cycle, budget, treeTail: null, refusal, gate, events };
      }
      // Green tree-run but the journey's OWN P6 gate is red (or was never
      // recorded) — this is a recorded failure, never convergence. The
      // evidence names the failed gate + its unmet criteria (the honest
      // qualifier: the treeRun being green is what the DoD gate just weighed
      // and found wanting — "converged" would hide it).
      // fixes/326 F1b: ONE bounded gate-repair cycle. A green tree-run with a
      // red fit-class gate is REPAIRABLE within the existing budget — the
      // artifact runs; the red criteria name the brief's own unmet
      // vocabulary/capabilities. Spend exactly one cycle re-synthesizing WITH
      // those recorded requirements as context. Honesty is untouched: the
      // repaired tree faces the SAME tree-run + real gate probes; convergence
      // still requires gate.passed === true, and a second red gate FAILS.
      if (!gateRepairUsed && gate !== null && gate.unmet.length > 0 && cycle < budget) {
        gateRepairUsed = true;
        gateRepair = gateRepairContextOf(finalProject, gate.unmet);
        p = p6JourneyLog(
          finalProject,
          "warn",
          "p6.journey.gate-repair",
          `tree-run ok but P6 gate FAIL (${gate.unmet.length} unmet) — one bounded gate-repair cycle with the unmet requirements as context`,
        );
        events.push(
          `cycle ${cycle}: tree-run ok but P6 gate FAIL — one bounded gate-repair cycle (unmet requirements fed as context)`,
        );
        continue;
      }
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

/**
 * W-02 (fixes/271 · §R1-f02 + §W27-A — the ONE P6-edge seam): phase 6's keyed
 * path for run / gate / wild / console-live. Wraps driveP6Journey — keyless
 * (no injected synthesize + no key) ⇒ the deterministic floor, byte-identical
 * to today's liveLayer(p, 6). The "failed" branch is decided explicitly: a
 * journey that RAN but did not converge returns j.project — its synthesis/
 * gate/mint evidence (including the failed-with-fixtures shape) must reach the
 * caller (repair/journey parity); only "keyless" (nothing ran) swaps back to
 * the floor, so a failed cycle is never silently hidden behind it.
 */
export async function runP6Edge(
  project: Project,
  deps?: Partial<P6JourneyDeps>,
  /** T4 (112 §4.4 / 216g): caller-supplied proven lesson rows for P6. */
  proven?: readonly RankableLessonRow[],
): Promise<Project> {
  const j = await driveP6Journey(project, {
    ...(deps ? { deps } : {}),
    ...(Array.isArray(proven) && proven.length > 0 ? { proven } : {}),
  });
  return j.outcome === "keyless" ? applyPhaseResult(project, 6) : j.project;
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

/** scaffold.ts TREE_ALLOWED_FILES parity — exact repo-relative paths a tree
 *  row may claim even though they sit outside every allowed root prefix.
 *  `codegen.TREE_ENTRY_PATH` is `src/generated.ts` (the ESM barrel EVERY
 *  materialized tree lands at): the emitter writes it, so the repair
 *  re-import/apply discipline MUST admit it too — pre-331 the mirror lacked
 *  this exact-file allowance, so the tree's own barrel was refused on both the
 *  read (import) and write (apply) sides and could never round-trip. Exact
 *  match (never a prefix) so a look-alike like `src/generated.ts.bak` stays
 *  refused, exactly as scaffold.ts declares. */
const REPAIR_TREE_ALLOWED_FILES = new Set(["src/generated.ts"]);

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
  if (
    !REPAIR_TREE_ALLOWED_ROOTS.some((root) => p.startsWith(root)) &&
    !REPAIR_TREE_ALLOWED_FILES.has(p)
  )
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

/** T-107.1 (216r · W7-L1): one landed patch (str_replace) delta as the repair
 *  result reports it — the structured half of the `p6.repair.delta` record
 *  codegen writes (`codegen.server.ts patchDeltaLogEntry`; keep the two in
 *  step). */
export type RepairDeltaRecord = {
  path: string;
  kind: "exact" | "fuzzy";
  score: number;
  threshold: number | null;
  matches: number;
  removedLines: number;
  addedLines: number;
  unified: string;
};

/** Read the patch-repair records a synthesis cycle wrote onto the project:
 *  `p6.repair.delta` (structured JSON detail — the codegen codec) and
 *  `p6.repair.patch.refused` (coded refusal details). Pure and total: a
 *  malformed record is skipped, never thrown, and non-string details are
 *  ignored. */
export function repairPatchRecords(project: Project): { deltas: RepairDeltaRecord[]; refusals: string[] } {
  const deltas: RepairDeltaRecord[] = [];
  const refusals: string[] = [];
  for (const entry of project.logs ?? []) {
    if (!entry || typeof entry.event !== "string" || typeof entry.detail !== "string") continue;
    if (entry.event === "p6.repair.delta") {
      try {
        const raw = JSON.parse(entry.detail) as Partial<RepairDeltaRecord> | null;
        if (
          raw &&
          typeof raw.path === "string" &&
          (raw.kind === "exact" || raw.kind === "fuzzy") &&
          typeof raw.score === "number"
        ) {
          deltas.push({
            path: raw.path,
            kind: raw.kind,
            score: raw.score,
            threshold: typeof raw.threshold === "number" ? raw.threshold : null,
            matches: typeof raw.matches === "number" ? raw.matches : 0,
            removedLines: typeof raw.removedLines === "number" ? raw.removedLines : 0,
            addedLines: typeof raw.addedLines === "number" ? raw.addedLines : 0,
            unified: typeof raw.unified === "string" ? raw.unified : "",
          });
        }
      } catch {
        /* malformed record — skipped, never thrown */
      }
    } else if (entry.event === "p6.repair.patch.refused") {
      refusals.push(entry.detail);
    }
  }
  return { deltas, refusals };
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
  /** Repair writes performed onto the dir (union across cycles). `refused`
   *  carries two honest kinds, each with its reason in `warnings`: a row the
   *  applier refused (path discipline / parse gate), and — W45 finding D — a
   *  file the tree-run NAMED as its failure that the cycle neither wrote nor
   *  refused, so a silently-skipped failing file can never look like progress. */
  applied: {
    written: string[];
    unchanged: string[];
    refused: string[];
    warnings: string[];
    /** T-107.1 (216r): the patch (str_replace) deltas the cycles LANDED —
     *  structured + unified, read back from the p6.repair.delta records the
     *  codegen repair wrote onto the project's log ledger. */
    deltas: RepairDeltaRecord[];
    /** Coded patch refusals (p6.repair.patch.refused) — each is a delta that
     *  did NOT land and whose legacy full-rewrite repair ran. */
    patchRefusals: string[];
  };
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
  opts: {
    budget?: number;
    deps?: Partial<RepairTreeDeps>;
    /** W51/337-1 (336-2 §9.4): the project's working dir. When present, the
     *  repair refreshes the run checkpoint beside `.rapidtool/` (or clears it
     *  on a terminal seal) so a later `resume` re-enters the repaired ledger
     *  instead of rewinding it — the repair path mutates generatedTree/lastTest
     *  without necessarily growing a bounded array, which the supersession
     *  growth axis alone cannot prove. Absent ⇒ no-op (the pre-wiring bytes). */
    checkpointDir?: string;
  } = {},
): Promise<RepairTreeResult> {
  const target = resolve(dir);
  const budget =
    typeof opts.budget === "number" && opts.budget > 0 ? Math.floor(opts.budget) : P6_JOURNEY_DEFAULT_BUDGET;
  const events: string[] = [];
  // W48 · 334-2 (L3): snapshot the session ledger at entry and fold this
  // repair's synthesis spend onto the returned ledger — a repair verb is a
  // drive verb, and its cost must survive the process like `run`/`gate` spend.
  const spendBaseline = normalizeLedger(sessionTokenBudget().ledger);
  const finish = (r: RepairTreeResult): RepairTreeResult => {
    const project = foldInvocationEvidence(r.project, spendBaseline);
    // T-107.7 (W33 · N2) · W51/337-1: every post-work exit refreshes the run
    // checkpoint with the repaired ledger; a complete seal clears it (nothing to
    // resume) — exactly runUntilGate's terminal policy. Guarded no-op without a
    // dir, so the browser/in-process/test paths keep their exact bytes.
    if (project.status === "complete") clearRunCheckpoint(opts.checkpointDir);
    else commitRunCheckpoint(opts.checkpointDir, project);
    return { ...r, project };
  };
  // T-107.1 (216r · W7-L1): the dir repair runs its cycles with the patch
  // (str_replace) repair level ON (defaultRepairSynthesize). A custom
  // deps.synthesize seam replaces it verbatim — the caller owns the level then.
  const synthesize = opts.deps?.synthesize ?? defaultRepairSynthesize;
  const runTree = opts.deps?.runTree ?? defaultRepairRunTree;
  const base = {
    written: [] as string[],
    unchanged: [] as string[],
    refused: [] as string[],
    warnings: [] as string[],
    deltas: [] as RepairDeltaRecord[],
    patchRefusals: [] as string[],
  };
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
    // C-1 (WB-1 defusal, 2026-09-24) — same fix as the journey seam: mint the
    // tested-equivalent from the green tree-run FIRST, then record the gate.
    // The old "gate FIRST; mint only when it passed" order was the deadlock:
    // p6-verified needs the mint, and the mint needed gate.passed. The mint is
    // self-guarded (mintTreeRunTested: outcome.ok + ≥1 executed assertion), so
    // "never mint on red / never mint unexecuted" is unchanged.
    let finalProject = candidate;
    let gate: RepairTreeResult["gate"] = null;
    const rec6 = (finalProject.phases ?? []).find((ph) => ph.id === 6);
    if (rec6?.status === "complete") {
      finalProject = await applyTreeRunTestedMint(finalProject, verdict);
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
    // fixes/336 · 336-2: the mint/gate pair changed the verification state —
    // recompile the packet so the ledger (and the promoted emitted record)
    // describes the stamp it now carries.
    finalProject = stampPacket(finalProject);
    const beforeLt = before as { label?: string; evidenceHash?: string } | null | undefined;
    const afterLt = finalProject.lastTest as { label?: string; evidenceHash?: string } | null | undefined;
    // A FRESH mint OR a REFRESHED stale hash both mean "this run's verdict is
    // now the recorded one" — either qualifies the caller attestation for the
    // emitted dir's own record.
    const minted =
      afterLt?.label === "tested" &&
      (beforeLt?.label !== "tested" ||
        (typeof afterLt.evidenceHash === "string" && afterLt.evidenceHash !== beforeLt?.evidenceHash));
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
      // Re-stamp LAST (fixes/336 · 336-2) — the converged log is the final
      // record mutation, so the packet describes the record as returned.
      p = stampPacket(p);
      events.push(`cycle 0: tree-run ok over the re-imported dir — converged without synthesis`);
      return finish({
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
      });
    }
    p = p6JourneyLog(
      green.project,
      "error",
      "p6.journey.failed",
      `tree-run ok on first run but ${green.gate === null ? "no P6 DoD gate record" : "P6 gate FAIL"} — repair FAILED, not converged (converged requires treeRun ok AND gate.passed)`,
    );
    events.push(`cycle 0: tree-run ok but P6 gate not green — repair FAILED`);
    return finish({
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
    });
  }
  // 3. Red first run → bounded repair cycle against the dir.
  let treeTail = treeRunFailureTail(verdict).slice(0, P6_JOURNEY_TAIL_MAX);
  // W45 (parent keyed finding D): the file(s) the verdict NAMES — carried on
  // each cycle's ctx so the directive explicitly targets them (and, below, so
  // an un-addressed one is refused explicitly rather than silently skipped).
  let failureFiles = treeRunFailureFiles(verdict);
  p = p6JourneyLog(p, "warn", "p6.tree.failure", treeTail);
  events.push(`tree-run fail (pre-cycle): ${treeTail.slice(0, 140)}`);
  let refusal: string | null = null;
  const applied = {
    written: [] as string[],
    unchanged: [] as string[],
    refused: [] as string[],
    warnings: [] as string[],
    deltas: [] as RepairDeltaRecord[],
    patchRefusals: [] as string[],
  };
  for (let cycle = 1; cycle <= budget; cycle++) {
    const ctx: P6JourneyCycleContext = { cycle };
    if (treeTail !== null) ctx.treeFailureTail = treeTail;
    if (refusal !== null) ctx.refusal = refusal;
    if (failureFiles.length > 0) ctx.repairTargets = failureFiles;
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
    // T-107.1 (216r · W7-L1): read back the patch-repair records the cycle's
    // synthesis wrote onto the project's log ledger — the structured deltas it
    // LANDED and the coded refusals whose legacy full-rewrite repair ran.
    const patchRecords = repairPatchRecords(synthesized);
    for (const d of patchRecords.deltas) applied.deltas.push(d);
    for (const r of patchRecords.refusals) if (!applied.patchRefusals.includes(r)) applied.patchRefusals.push(r);
    // 3a. Apply the repaired rows onto the dir IN PLACE (only changed files).
    // 216 (T-02): parse-gate FIRST — a row whose source does not parse is
    // refused rather than written, so a corrupted synthesis cannot land in the
    // artifact at all (the class that traced to 431 tsc errors).
    const nonParsing = await parseGateTreeRows(synthesized);
    const apply = applySynthesizedTreeToDir(synthesized, target, nonParsing);
    for (const w of apply.written) if (!applied.written.includes(w)) applied.written.push(w);
    for (const w of apply.warnings) if (!applied.warnings.includes(w)) applied.warnings.push(w);
    for (const r of apply.refused) if (!applied.refused.includes(r)) applied.refused.push(r);
    // W45 (parent keyed finding D): the tree-run NAMED the file it failed on —
    // for the generated-core LOAD shape that is `treeRun.core.entry`. If this
    // cycle neither WROTE nor already refused a named file, record an explicit
    // coded refusal for it: a repair that silently skips the file it was told
    // to fix can never converge and must not read as progress. A file the
    // applier refused for path/parse is already reported above.
    for (const path of failureFiles) {
      if (apply.written.includes(path) || apply.refused.includes(path)) continue;
      if (!applied.refused.includes(path)) applied.refused.push(path);
      const warning = `repair:apply:refused:${JSON.stringify(path)}:${
        tree.some((r) => r?.path === path)
          ? "the tree-run failure names this file but the cycle left it unchanged — the repair did not target it"
          : "the tree-run failure names this file but the cycle produced no tree row for it — the repair did not target it"
      }`;
      if (!applied.warnings.includes(warning)) applied.warnings.push(warning);
      events.push(`cycle ${cycle}: failure-named file not addressed by the repair: ${path}`);
    }
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
        // Re-stamp LAST (fixes/336 · 336-2) — the converged log is the final
        // record mutation, so the packet describes the record as returned.
        p = stampPacket(p);
        events.push(`cycle ${cycle}: tree-run ok — repair converged`);
        return finish({
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
        });
      }
      p = p6JourneyLog(
        green.project,
        "error",
        "p6.journey.failed",
        `tree-run ok after ${cycle}/${budget} cycle(s) but ${green.gate === null ? "no P6 DoD gate record" : "P6 gate FAIL"} — repair FAILED, not converged`,
      );
      events.push(`cycle ${cycle}: tree-run ok but P6 gate not green — repair FAILED`);
      return finish({
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
      });
    }
    treeTail = treeRunFailureTail(verdict).slice(0, P6_JOURNEY_TAIL_MAX);
    // Re-derive the named file(s) each cycle: the next directive must target
    // the CURRENT failure, not the one the previous cycle started with.
    failureFiles = treeRunFailureFiles(verdict);
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
  return finish({
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
  });
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
  // R4-f03 (W30 · LANE S3): thread the PROCESS session budget into the verify
  // seam — the same ledger `synthWithBackoff` records into, so the token cap
  // binds the whole run across codegen + verify (R12-f02). Unmetered (no
  // RAPIDTOOL_TOKEN_CAP) ⇒ the seam's no-op path, byte-identical.
  const { sessionTokenBudget } = await import("./token-ledger.ts");
  return (await verifyAndFixServer(withCommonJsExports(source), project.brief, {
    budget: sessionTokenBudget(),
  })) as VerifyOutcomeShape;
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
  /** F-5 (W46 · 332-2): `configured` is key PRESENCE only; `keyState` states
   *  whether that presence has been validated (`unverified` is the honest floor
   *  — llm.ts's tap clears on success, so "valid" is never inventable here), and
   *  `lastKeyed` carries the last keyed failure class + tail-only source when
   *  one is known. Never a key value. */
  llm: { configured: boolean; label: string } & DoctorLlmKey;
  research: { configured: boolean; probed: boolean; label: string };
  runner: { available: boolean; sandbox: false };
  node: string;
  /** Honest factory bar — agents must not infer "it ships software" from llm.configured.
   *  210: field-truth via doctor.factoryClaim — never a hardcoded true flip. */
  factory: {
    autonomousSoftwareFactory: boolean;
    /** W53 · 340-2: true only when every machine-fixable conjunct is met and the
     *  sole remaining gap is the deliberate human acceptance stamp. Derived from
     *  the same evidence as `autonomousSoftwareFactory`; it never flips that
     *  latch and never mints a human stamp. Fail-closed. */
    awaitingHumanAcceptance: boolean;
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
    /** OPS-8 (W42 · L4/G9): the caller's measured spend — the session
     *  budget's ledger by default; honest `measured:false` nulls when unmetered. */
    spend: DoctorSpend;
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

/** OPS-8 (W42 · L4/G9): the pre-import floor's honest spend — byte-mirror of
 *  `doctorSpend(null)`'s `empty` envelope (doctor.ts) so the catch-fallback
 *  factory never diverges from the real helper's unmetered shape. */
const DOCTOR_SPEND_FLOOR: DoctorSpend = {
  measured: false,
  promptTokens: null,
  completionTokens: null,
  totalTokens: null,
  calls: null,
  cachedPromptTokens: null,
  cacheWriteTokens: null,
  reasoningTokens: null,
  estimatedCostUsd: null,
  pricesSupplied: false,
  line: "spend: none measured (no token-ledger sample handed in — keyless/unmetered or pre-synthesis; never estimated)",
};

/**
 * W46 · 332-2 (L1/AW45-c06): the persisted run spend a project record carries.
 * Returns its `tokenUsage` slice ONLY when it is a usable measured spend (both
 * base counts finite and non-negative); anything else — absent file, unreadable,
 * unparsable, a legacy record without the field — returns null so the caller
 * keeps its own honest floor. Read-only; never throws; the file body is never
 * surfaced beyond its token counters.
 */
function persistedSpendAt(recordPath: string): SpendSlice | null {
  if (!recordPath) return null;
  try {
    if (!existsSync(recordPath)) return null;
    const parsed = JSON.parse(readFileSync(recordPath, "utf8")) as { tokenUsage?: unknown } | null;
    return isMeasuredSpend(parsed?.tokenUsage) ? parsed.tokenUsage : null;
  } catch {
    return null; // unreadable/corrupt record → the caller's honest floor, never a throw
  }
}

/** The product tree's scaffold-shipped record: `<treeDir>/.rapidtool/project.json`
 *  (the CLI gate's save target — "the project JSON is the LEDGER"). */
function persistedTreeSpend(treeDir: string): SpendSlice | null {
  return treeDir ? persistedSpendAt(join(resolve(treeDir), ".rapidtool", "project.json")) : null;
}

// ---------------------------------------------------------------------------
// W48 · 334-2 — the run's keyed outcome + coded failure on the project record
// ---------------------------------------------------------------------------

/** What a project's own P6 log trail says about the LAST keyed model call.
 *  `rejected` is a credential refusal (RT_E_LLM_KEY_REJECTED /
 *  RT_E_LLM_KEY_SHADOWED — doctor.ts's `isKeyUnusableCode` set, ONE definition
 *  for writer and reader); `success` is a recorded `ok` synthesis attempt;
 *  `none` is no keyed evidence at all. */
type KeyedTrailOutcome =
  | { kind: "rejected"; code: string; at: number; keySource?: string }
  | { kind: "success" }
  | { kind: "none" };

/** The newest recorded `p6.synthesis.refused` row (ts + detail), or null. Used
 *  to tell a refusal THIS invocation appended from one already on the record. */
function newestP6Refusal(project: Project): { ts: number; detail: string } | null {
  const logs = Array.isArray(project?.logs) ? project.logs : [];
  for (let i = logs.length - 1; i >= 0; i--) {
    const l = logs[i] as { event?: unknown; phase?: unknown; ts?: unknown; detail?: unknown } | null | undefined;
    if (!l || typeof l !== "object") continue;
    if (l.event !== "p6.synthesis.refused" || l.phase !== 6 || typeof l.detail !== "string") continue;
    return { ts: typeof l.ts === "number" && Number.isFinite(l.ts) ? l.ts : 0, detail: l.detail };
  }
  return null;
}

/** The `<RT_E code>` a `p6.synthesis.refused` detail names (`<code> · <reason>`),
 *  or undefined when the detail carries none. Matches engine.refusalClassOf's
 *  parse of codegen's refusal-log shape. */
function p6RefusalCode(detail: string | null | undefined): ErrorCode | undefined {
  if (typeof detail !== "string") return undefined;
  const m = /^(RT_E_[A-Z0-9_]+)/.exec(detail.trim());
  return m ? (m[1] as ErrorCode) : undefined;
}

/**
 * W48 · 334-2 (L1): read the newest keyed-call outcome from a project's own P6
 * trail, newest-first:
 *   - a `p6.synthesis.attempt` ending `· ok` means the last keyed call
 *     SUCCEEDED ⇒ `success` (clears any persisted rejection);
 *   - a `p6.synthesis.refused` whose class is key-unusable ⇒ `rejected`, with
 *     its ts and the tail-only `key source:` label parsed from the reason;
 *   - any other row is skipped: a transient/non-key failure never condemns a
 *     key (F-5's posture).
 * Pure. Never reads a key value; the source label is tail-only by construction
 * (deepseek.ts `describeKeySource`). Exported so the writer's vocabulary is
 * pinned by unit tests.
 */
export function keyedTrailOutcome(project: Project): KeyedTrailOutcome {
  const logs = Array.isArray(project?.logs) ? project.logs : [];
  for (let i = logs.length - 1; i >= 0; i--) {
    const l = logs[i] as { event?: unknown; phase?: unknown; ts?: unknown; detail?: unknown } | null | undefined;
    if (!l || typeof l !== "object" || l.phase !== 6) continue;
    if (typeof l.event !== "string" || typeof l.detail !== "string") continue;
    if (l.event === "p6.synthesis.attempt") {
      if (/·\s*ok\s*$/.test(l.detail)) return { kind: "success" };
      continue;
    }
    if (l.event === "p6.synthesis.refused") {
      const code = p6RefusalCode(l.detail);
      if (!code || !isKeyUnusableCode(code)) continue;
      const label = /key source:\s*(.+)$/.exec(l.detail)?.[1]?.trim();
      return {
        kind: "rejected",
        code,
        at: typeof l.ts === "number" && Number.isFinite(l.ts) ? l.ts : 0,
        ...(label ? { keySource: label } : {}),
      };
    }
  }
  return { kind: "none" };
}

/**
 * W48 · 334-2 (L1): fold the project's newest keyed outcome onto its own record
 * (`Project.lastKeyedOutcome` — the types.ts request): a key-unusable rejection
 * persists (tail-only), a recorded success clears the field, and no keyed
 * evidence leaves a legacy record untouched. Returns the SAME object when
 * nothing changed, so a keyless run never churns the record. The field is not
 * yet on the `Project` type (unowned types.ts) — the local intersection makes
 * the writer compile today and the exact shape is the requested grant.
 */
function foldLastKeyedOutcome(project: Project): Project {
  const trail = keyedTrailOutcome(project);
  const withField = project as Project & { lastKeyedOutcome?: DoctorLastKeyed };
  if (trail.kind === "none") return project;
  if (trail.kind === "success") {
    if (withField.lastKeyedOutcome === undefined) return project;
    const cleared: Project & { lastKeyedOutcome?: DoctorLastKeyed } = { ...withField };
    delete cleared.lastKeyedOutcome;
    return cleared;
  }
  const next: DoctorLastKeyed = {
    code: trail.code,
    at: trail.at,
    ...(trail.keySource ? { keySource: trail.keySource } : {}),
  };
  const prev = withField.lastKeyedOutcome;
  if (prev && prev.code === next.code && prev.at === next.at && prev.keySource === next.keySource) {
    return project;
  }
  const merged: Project & { lastKeyedOutcome?: DoctorLastKeyed } = { ...withField, lastKeyedOutcome: next };
  return merged;
}

/**
 * W48 · 334-2 (L1/L3): fold THIS invocation's measured session spend and its
 * newest keyed-call outcome onto the project record. Shared by every drive verb
 * that can spend and 401 — `runUntilGate` (the `run`/`gate`/`resume` verbs),
 * `repairTreeDir` and the wild macros. A zero-spend invocation leaves any
 * existing persisted spend slice untouched (never a fabricated zero); the keyed
 * fold is idempotent when no keyed evidence exists.
 */
function foldInvocationEvidence(project: Project, spendBaseline: TokenLedger): Project {
  let next = project;
  const delta = spendDelta(sessionTokenBudget().ledger, spendBaseline);
  if (totalTokens(delta) > 0 || delta.calls > 0) {
    next = { ...next, tokenUsage: accumulateSpend(next.tokenUsage, delta) };
  }
  return foldLastKeyedOutcome(next);
}

/**
 * W46 · 332-2 (L1/AW45-c06): resolve the measured-spend source the doctor
 * surfaces report — priority: an explicit caller `spend`, then the
 * `projectPath` file's persisted `tokenUsage`, then the product tree's
 * `.rapidtool/project.json` record, then the process session ledger (empty at
 * fresh-process start, hence the old `calls: 0`). Never throws; a missing or
 * unusable record simply loses its rung.
 */
export function resolveDoctorSpendSource(opts?: {
  treeDir?: string;
  projectPath?: string;
  spend?: TokenSpend | TokenLedger | null;
}): TokenSpend | TokenLedger | SpendSlice {
  if (opts?.spend) return opts.spend;
  const byPath = opts?.projectPath ? persistedSpendAt(opts.projectPath) : null;
  if (byPath) return byPath;
  const byTree = persistedTreeSpend(typeof opts?.treeDir === "string" ? opts.treeDir : "");
  if (byTree) return byTree;
  return sessionTokenBudget().ledger;
}

/**
 * F-5 (W46 · 332-2): best-effort read of the last keyed outcome from the ONE
 * server status surface (`llm.ts`'s `llmStatus`, C1 · 332-5). Installs nothing,
 * makes no provider call. The TanStack server fn cannot run outside a Start
 * context (the same reason `engine.liveLayer` degrades under bare Node), so on
 * a CLI host this resolves to the honest `undefined` — doctor then reports
 * `unverified`, never an implied green.
 */
async function readStatusLastKeyed(): Promise<unknown> {
  try {
    const { llmStatus } = await import("./llm.ts");
    const status = await llmStatus();
    return (status as { lastKeyed?: unknown }).lastKeyed;
  } catch {
    return undefined;
  }
}

/**
 * F-5 (W46 · 332-2) + W48 · 334-2 (L1): classify the doctor's key state.
 * `keyedOutcome` is the caller's explicit last keyed outcome (validated by
 * `doctor.doctorLlmKey`, so a hostile/partial payload is dropped). When absent,
 * `recordPath` (the project file or the tree's scaffold-shipped record) is read
 * for the persisted `Project.lastKeyedOutcome` — this is what lets a FRESH
 * `doctor` process see a prior `gate`/`run` process's key rejection, since the
 * provider tap is process-local. Only then is the process status surface read
 * best-effort (`readStatusLastKeyed`). Pure apart from those reads; never
 * throws — an unavailable doctor module keeps the honest floor.
 */
export async function resolveDoctorKeyState(
  configured: boolean,
  keyedOutcome?: unknown,
  recordPath?: string,
): Promise<DoctorLlmKey> {
  const fallback: DoctorLlmKey = { keyState: configured ? "unverified" : "not-configured" };
  try {
    const { doctorLlmKey } = await import("./doctor.ts");
    const persisted =
      keyedOutcome !== undefined
        ? keyedOutcome
        : recordPath
          ? persistedKeyedOutcomeAt(recordPath)
          : undefined;
    return doctorLlmKey(configured, persisted ?? (await readStatusLastKeyed()));
  } catch {
    return fallback;
  }
}

/**
 * W48 · 334-2 (L1): the persisted last keyed outcome a project record carries
 * (`Project.lastKeyedOutcome`, written at the run boundary), or undefined for
 * an absent/unreadable/legacy record. The RAW value is handed back — the same
 * `doctor.readLastKeyedOutcome` validation every keyed payload passes, so a
 * hostile field can never mint `rejected`. Read-only; never throws; never
 * surfaces the file body beyond that one field.
 */
function persistedKeyedOutcomeAt(recordPath: string): unknown {
  if (!recordPath) return undefined;
  try {
    if (!existsSync(recordPath)) return undefined;
    const parsed = JSON.parse(readFileSync(recordPath, "utf8")) as { lastKeyedOutcome?: unknown } | null;
    return parsed?.lastKeyedOutcome;
  } catch {
    return undefined;
  }
}

/** W48 · 334-2 (L1): the record a doctor reads the persisted keyed outcome
 *  from — the named project file, else the product tree's scaffold-shipped
 *  `.rapidtool/project.json`. Undefined when neither is given. */
function keyedRecordPath(opts?: { treeDir?: string; projectPath?: string }): string | undefined {
  if (typeof opts?.projectPath === "string" && opts.projectPath) return opts.projectPath;
  const tree = typeof opts?.treeDir === "string" && opts.treeDir.trim() ? opts.treeDir.trim() : "";
  return tree ? join(resolve(tree), ".rapidtool", "project.json") : undefined;
}

/**
 * W52 · 338-3: the persisted project RECORD the doctor derives its factory
 * evidence from — an explicit `projectPath` (the CLI's `--project`), else the
 * tree's scaffold record `<treeDir>/.rapidtool/project.json`. Parsed object or
 * null; never throws (absent/unreadable/non-object ⇒ null), so the caller's
 * honest floor stands and no fabricated evidence is ever minted.
 */
function persistedProjectRecord(opts?: { treeDir?: string; projectPath?: string }): unknown | null {
  const path = keyedRecordPath(opts);
  if (!path) return null;
  try {
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
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
 *
 * W46 · 332-2 (L1/AW45-c06): the spend block used to read the PROCESS session
 * ledger, which a fresh `doctor` process starts empty (`calls: 0` after a keyed
 * run). `opts.projectPath` (the CLI's `--project`) or `opts.treeDir`'s
 * scaffold-shipped record resolves the run's persisted `Project.tokenUsage`,
 * read read-only and never fabricated. Priority: explicit `opts.spend` →
 * `opts.projectPath` → `treeDir` record → the process session ledger (or the
 * honest `measured:false` floor).
 *
 * F-5 (fixes/333_1_verifier.md): the `llm` block carries `keyState` so a
 * present key never reads as a validated one — `unverified` unless a keyed
 * outcome was recorded, `rejected` only for a key-unusable coded class, with
 * the tail-only `lastKeyed` when known. Matches the console chip's validity
 * posture (332-5) on the doctor surface.
 *
 * W48 · 334-2 (L1): `opts.projectPath` / `opts.treeDir`'s record is also read
 * for the persisted `Project.lastKeyedOutcome`, so a FRESH `doctor` process can
 * see a prior run's key rejection (the provider tap is process-local).
 */
export async function doctorStatus(opts?: {
  treeDir?: string;
  /** W46 · 332-2: the project file whose persisted `tokenUsage` is the run's
   *  recorded spend (wins over the `treeDir` record). */
  projectPath?: string;
  /** OPS-8 (W42 · L4/G9): caller-measured spend; defaults to the process
   *  session budget's ledger (`sessionTokenBudget().ledger`). */
  spend?: TokenSpend | TokenLedger | null;
  /** F-5 (W46 · 332-2): an explicit last keyed outcome, validated by
   *  `doctor.doctorLlmKey` (a hostile/partial payload is dropped). When omitted
   *  the process status surface (`llmStatus`) is read best-effort. */
  keyedOutcome?: DoctorLastKeyed | null;
}): Promise<DoctorStatus> {
  const llm: DoctorStatus["llm"] = {
    configured: false,
    label: "not configured (set DEEPSEEK_API_KEY)",
    keyState: "not-configured",
  };
  try {
    const { isDeepSeekConfigured, DEEPSEEK_MODEL_IDS } = await import("./deepseek.server.ts");
    if (isDeepSeekConfigured()) {
      llm.configured = true;
      llm.label = `deepseek (${DEEPSEEK_MODEL_IDS.slice(0, 2).join(" | ")})`;
    }
  } catch {
    /* deepseek module unavailable → honest not-configured */
  }
  // F-5 (fixes/333_1_verifier.md): presence ≠ validity. The key state comes
  // from doctor.ts's ONE vocabulary, fed by the caller's explicit override or
  // the server status surface (llm.ts's llmStatus, C1 · 332-5) — never a
  // provider call, never the key value.
  Object.assign(
    llm,
    await resolveDoctorKeyState(llm.configured, opts?.keyedOutcome, keyedRecordPath(opts)),
  );

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
    awaitingHumanAcceptance: false,
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
    spend: DOCTOR_SPEND_FLOOR,
  };
  try {
    const doctor = await import("./doctor.ts");
    const treeDir = typeof opts?.treeDir === "string" && opts.treeDir.trim() ? opts.treeDir.trim() : "";
    // OPS-8 (W42 · L4/G9) + W46 · 332-2 (L1/AW45-c06): the measured-spend
    // source — an explicit `opts.spend` wins, then the product tree's persisted
    // `Project.tokenUsage` (the run's recorded cost), then the process session
    // ledger (empty at fresh-process start, hence the old `calls: 0`). Shape
    // lives in doctorSpend.
    const spendSource = resolveDoctorSpendSource({ treeDir, projectPath: opts?.projectPath, spend: opts?.spend });
    // W52 · 338-3: the factory claim is derived from REAL signals — the tree's
    // job-file census AND the persisted project record (`--project`, else the
    // tree's `.rapidtool/project.json`). Before this the tree path passed no
    // project, so `productComplete` was a constant false and `humanFixtures`
    // had no producer: no real run could ever close those gaps.
    const record = persistedProjectRecord({ treeDir, projectPath: opts?.projectPath });
    let claim = doctor.doctorFactory(process.env, spendSource);
    if (treeDir) {
      const files = collectJobSources(treeDir);
      const inv = doctor.inventoryFromJobSources(files, resolve(treeDir));
      const evidence = doctor.evidenceFromJobInventory(inv, record ? { project: record } : undefined);
      // The tree scan replaces the factory EVIDENCE, never the measured spend —
      // before this, the `factoryClaim` here dropped the spend block entirely
      // (measured:false) even when the tree carried a persisted run record.
      claim = doctor.factoryClaim(evidence, process.env, spendSource);
    } else if (record) {
      // A named record with no tree to scan: productComplete + humanFixtures
      // close on the record, the census fields stay fail-closed (see
      // doctor.evidenceFromProjectRecord) — never a fabricated real product.
      claim = doctor.factoryClaim(doctor.evidenceFromProjectRecord(record), process.env, spendSource);
    }
    factory = {
      autonomousSoftwareFactory: claim.autonomousSoftwareFactory,
      awaitingHumanAcceptance: claim.awaitingHumanAcceptance,
      leftoverJobsAreReexportsOrStubs: claim.leftoverJobsAreReexportsOrStubs,
      chatHasSlashToolsOnly: claim.chatHasSlashToolsOnly,
      runnerIsSandbox: false,
      isolation: claim.isolation,
      tokenCap: claim.tokenCap,
      gaps: claim.gaps,
      inventory: claim.inventory,
      spend: claim.spend,
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
 * R13-f02 (W33 lane L2) — the minimal REAL `wild.plan` generation.
 *
 * The seam: `planning.planSteps(goal, context)` — that module's own honesty
 * contract already encodes the key rule (keyed ⇒ one bounded flash JSON call;
 * keyless ⇒ `{ ok: false, reason: "not-configured" }`, never a fabricated
 * plan). This function: returns the stored plan when one exists (idempotent),
 * else asks the planner; a REAL plan lands as `source: "planner"`; every
 * refusal/failure returns `engine.readWildPlan`'s honest empty plan with the
 * reason appended to its note — never invented rows. Lazy computed-specifier
 * import keeps planning.ts (server-only: deepseek.server) out of any static
 * graph.
 *
 * Generation is real here; the classifier review of these rows and the
 * pause-before-first-mutation live in `stageWildPlan` (below), which the wild
 * start/step paths run right after this attaches a plan.
 */
export async function generateWildPlan(project: Project): Promise<WildPlan> {
  // W36 N2 (fixes/281): F3-01 residue closed — engine.readWildPlan IS the single source for the
  // stored-plan / honest-empty accessor (record shape-guarded there); this function only appends
  // the planner outcome to its note. No inline copy left to drift.
  const honest: WildPlan = readWildPlan(project);
  if (honest.source === "planner") return honest;
  const goal =
    typeof project.brief === "string" && project.brief.trim().length > 0
      ? project.brief.trim()
      : project.name;
  const context = [
    `Project: ${project.name} (kind: ${project.kind})`,
    `Current phase: P${project.currentPhase} — ${phaseDef(project.currentPhase)?.title ?? ""}`.trim(),
    `Governed phases: ${PHASES.length} (P0–P12)`,
  ].join("\n");
  try {
    const planningSpec = "./plan" + "ning.ts";
    const planning = (await import(planningSpec)) as {
      planSteps?: (
        goal: string,
        context: string,
        opts?: { maxSteps?: number },
      ) => Promise<
        | { ok: true; steps: WildPlan["steps"] }
        | { ok: false; reason: string; error?: string }
      >;
    };
    if (typeof planning.planSteps !== "function") return honest;
    const res = await planning.planSteps(goal, context, { maxSteps: 8 });
    if (res.ok === true && Array.isArray(res.steps) && res.steps.length > 0) {
      return {
        goal,
        steps: res.steps,
        source: "planner",
        plannedAt: Date.now(),
        note:
          "planner rows (R13-f02) — the wild run runs a classifier plan review " +
          "and parks before the first mutation (stageWildPlan)",
      };
    }
    const why =
      res.ok === false && res.reason === "not-configured"
        ? "planner not configured (no DEEPSEEK_API_KEY)"
        : `planner failed: ${res.ok === false ? (res.error ?? res.reason) : "no rows returned"}`;
    return { ...honest, note: `${honest.note} · ${why}` };
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return { ...honest, note: `${honest.note} · planner import/call failed: ${why}` };
  }
}

/**
 * R13-f02 (W33 lane L2): attach a REAL planner plan to a wild run when — and
 * only when — the planner is actually configured (keyed). Keyless ⇒ the
 * project is returned UNCHANGED (no planner call, no field, no log row: the
 * keyless wild-run bytes stay exactly as they are); keyed + planner refusal ⇒
 * also unchanged (the honest empty plan stays readable via `readWildPlan` but
 * is never written into the record as if it were a plan). A real plan lands
 * with the `wild.plan` ledger row (the event named in the R13-f02 spec).
 */
async function attachWildPlan(project: Project): Promise<Project> {
  if (project.wildPlan && project.wildPlan.source === "planner") return project;
  if (runModeFor() !== "keyed") return project;
  const plan = await generateWildPlan(project);
  if (plan.source !== "planner") return project;
  return {
    ...project,
    wildPlan: plan,
    logs: [
      ...(project.logs ?? []),
      {
        ts: Date.now(),
        phase: project.currentPhase,
        level: "info" as const,
        event: "wild.plan",
        detail: `wild.plan (planner): ${plan.steps.length} step(s) for "${plan.goal.slice(0, 80)}"`,
      },
    ].slice(-200),
  };
}

/**
 * R13-f02 — review the planner rows and PARK before the first mutation.
 *
 * Runs right after `attachWildPlan` on both wild start/step paths. When the
 * record carries a real planner plan with no `wild.plan_review` row yet, the
 * rows are judged through the injectable Auto-Review reviewer seam
 * (`engine.reviewWildPlan`) and the run parks — `wildRun.pause` + a park
 * record + the `wild.plan_review` / `wild.paused_plan` ledger rows — BEFORE
 * any step can mutate. The pause IS the "no execution without an approved
 * plan" gate; a human resume executes it. `staged:true` tells the caller to
 * stop before its loop. Idempotent: once the review row exists the stored
 * plan is never re-reviewed (a resume proceeds).
 */
async function stageWildPlan(
  project: Project,
  reviewer: WildReviewer | null,
): Promise<{ project: Project; staged: boolean }> {
  const plan = project.wildPlan;
  if (!plan || plan.source !== "planner" || !Array.isArray(plan.steps) || plan.steps.length === 0) {
    return { project, staged: false };
  }
  const logs = Array.isArray(project.logs) ? project.logs : [];
  if (logs.some((r) => r?.event === "wild.plan_review")) return { project, staged: false };
  const { reviewWildPlan, wildLog, wildPause } = await import("./engine.ts");
  const phase = project.currentPhase;
  let reviewed: Project;
  if (reviewer === null) {
    reviewed = wildLog(
      project,
      phase,
      "warn",
      "wild.plan_review",
      `wild.plan (${plan.steps.length} row(s)) could not be reviewed — Auto-Review classifier not configured; parked for human review (R13-f02).`,
    );
  } else {
    const verdict = await reviewWildPlan(project, reviewer);
    reviewed = verdict.ok
      ? wildLog(
          project,
          phase,
          "info",
          "wild.plan_review",
          `wild.plan (${plan.steps.length} row(s)) review (classifier): ${verdict.verdict} — ${verdict.feedback.slice(0, 300)}`,
        )
      : wildLog(
          project,
          phase,
          "warn",
          "wild.plan_review",
          `wild.plan (${plan.steps.length} row(s)) review failed (${verdict.reason}): ${verdict.error.slice(0, 300)} — parked for human review (R13-f02).`,
        );
  }
  const parked = wildPause(
    reviewed,
    phase,
    "warn",
    "wild.paused_plan",
    `wild.plan reviewed; execution parked before the first mutation — ${plan.steps.length} row(s). Approve to execute (R13-f02).`,
    { code: "RT_E_GATE_PENDING", unlock: "human-gate" },
  );
  return { project: parked, staged: true };
}

/** 316 H3 (315 V2 finding #1): the P6 execution edge threaded into every
 *  wild step this module drives — the SAME `runP6Edge` seam run/gate execute
 *  through (W-02: keyed synthesis + the tree-run mint; keyless ⇒ the
 *  documented floor passthrough). Both headless wild loops pass it as
 *  `wildStep`'s `p6Edge`, so the agent seal's ONE DoD-repair pass re-runs the
 *  REAL non-floor edge on a production sealed run instead of parking for
 *  want of a seam nobody passed (the repair was production-dead — it read
 *  `opts.p6Edge` and both loops passed none).
 *  Keyed-only by construction: `runModeFor()` is the same trim-semantics
 *  probe the engine's own guard reads, and a keyless host threads NOTHING —
 *  its bytes stay exactly the pre-wire floor. `opts.p6Edge` (the explicit
 *  injection seam) wins in ANY key state — the wildStep contract — so a
 *  keyless pin can prove the hop end-to-end. */
function p6EdgeForWildStep(opts: {
  p6Edge?: (p: Project) => Promise<Project>;
}): ((p: Project) => Promise<Project>) | undefined {
  if (typeof opts.p6Edge === "function") return opts.p6Edge;
  return runModeFor() === "keyed" ? runP6Edge : undefined;
}

/**
 * Wrapper over engine.wildStep — one bounded macro-run (default 24 steps,
 * clamped 1–48). Stops on any non-"advanced" outcome (paused/completed/noop)
 * and returns the final project; the CLI persists it. Honest refusal when the
 * project has wildMode off or no active wild run.
 */
export async function wildStartHeadless(
  project: Project,
  opts: {
    maxSteps?: number;
    onEvent?: (seed: RtEventSeed) => void;
    agentSeal?: boolean;
    /** 316 H3: injection seam for the P6 edge (mirrors the engine's
     *  `p6Edge`); production callers omit it — see `p6EdgeForWildStep`. */
    p6Edge?: (p: Project) => Promise<Project>;
    /** R13-f02: injection seam for the Auto-Review classifier that reviews a
     *  stored planner plan (tests); production omits it — `createNodeWildReviewer`
     *  binds the Node-side classifier, null keyless. */
    reviewer?: WildReviewer;
  } = {},
): Promise<WildStartShape> {
  const maxSteps = Math.min(Math.max(opts.maxSteps ?? 24, 1), 48);
  if (project.wildMode !== true) {
    return { ok: false, reason: "not-wild", error: "Wild mode is not enabled (project.wildMode !== true) — nothing to run." };
  }
  if (!project.wildRun || !project.wildRun.active) {
    return { ok: false, reason: "not-active", error: "No active wild run (project.wildRun.active !== true) — start a wild run first." };
  }
  // W48 · 334-2 (L3): fold this macro-run's measured spend + keyed outcome onto
  // the returned project, like every other drive verb.
  const spendBaseline = normalizeLedger(sessionTokenBudget().ledger);
  const { wildStep } = await import("./engine.ts");
  // R14-f01 (W33 lane F1): bind the reviewer once per macro-run — bare Node +
  // key ⇒ the classifier actually verdicts; null ⇒ the engine default (the
  // keyless runs keep their exact bytes).
  const reviewer = opts.reviewer ?? (await createNodeWildReviewer());
  // 316 H3: resolve the P6 edge ONCE per macro-run (keyed ⇒ the real
  // runP6Edge; keyless with no injected seam ⇒ undefined — nothing threaded).
  const p6Edge = p6EdgeForWildStep(opts);
  // R13-f02 (W33 lane L2): a keyed host plans before the loop advances; keyless
  // ⇒ attachWildPlan returns the project unchanged (no field, no log row).
  let current = await attachWildPlan(project);
  // R13-f02: review the planner rows and park before the first mutation.
  const staged = await stageWildPlan(current, reviewer);
  current = staged.project;
  if (staged.staged) {
    return {
      ok: true,
      project: foldInvocationEvidence(current, spendBaseline),
      outcome: "paused",
      steps: 0,
      note: "Plan review parked the run before the first mutation (R13-f02).",
    };
  }
  let steps = 0;
  let outcome = "advanced";
  let lastError: string | undefined;
  while (steps < maxSteps) {
    // 308 B-02 (B2): thread the host's telemetry sink into the step — every
    // caller dropped it, so finishStep's wild.step_* emits never fired on this
    // leg. headless has no in-file rt writer; the CALLER's opts.onEvent is the
    // honest seam (CLI leg: cliLogEvent → NDJSON). Absent ⇒ a no-op default —
    // emission-side only, the project bytes are unchanged (DG-8).
    const res = await wildStep(current, {
      ...(reviewer ? { reviewer } : {}),
      ...(opts.agentSeal ? { agentSeal: true } : {}),
      // 316 H3: the real P6 edge — the seal's DoD-repair pass re-runs it.
      ...(p6Edge ? { p6Edge } : {}),
      onEvent: opts.onEvent ?? (() => undefined),
    });
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
  return { ok: true, project: foldInvocationEvidence(current, spendBaseline), outcome, steps, ...(lastError ? { note: lastError } : {}) };
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
  opts: {
    maxSteps?: number;
    onEvent?: (seed: RtEventSeed) => void;
    agentSeal?: boolean;
    /** 316 H3: injection seam for the P6 edge (mirrors the engine's
     *  `p6Edge`); production callers omit it — see `p6EdgeForWildStep`. */
    p6Edge?: (p: Project) => Promise<Project>;
    /** R13-f02: injection seam for the Auto-Review classifier that reviews a
     *  planner plan (tests); production omits it — `createNodeWildReviewer`
     *  binds the Node-side classifier, null keyless. */
    reviewer?: WildReviewer;
  } = {},
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
  // W48 · 334-2 (L3): fold this driven run's measured spend + keyed outcome onto
  // the returned project (the CLI persists it).
  const spendBaseline = normalizeLedger(sessionTokenBudget().ledger);
  // R14-f01 (W33 lane F1): bind the Node-side Auto-Review classifier once for
  // the whole driven run (bare Node + key); null keeps the engine default.
  const reviewer = opts.reviewer ?? (await createNodeWildReviewer());
  // 316 H3: resolve the P6 edge ONCE for the whole driven run (keyed ⇒ the
  // real runP6Edge; keyless with no injected seam ⇒ undefined).
  const p6Edge = p6EdgeForWildStep(opts);
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
  // R13-f02 (W33 lane L2): plan-before-execute for the keyed journey (keyless ⇒
  // unchanged bytes — see attachWildPlan).
  current = await attachWildPlan(current);
  // R13-f02: review the planner rows and park before the first mutation.
  const staged = await stageWildPlan(current, reviewer);
  current = staged.project;
  if (staged.staged) {
    return {
      ok: true,
      project: foldInvocationEvidence(current, spendBaseline),
      changed: true,
      outcome: "paused",
      steps: 0,
      note: "Plan review parked the run before the first mutation (R13-f02).",
    };
  }
  let steps = 0;
  let outcome = "advanced";
  let lastError: string | undefined;
  while (steps < maxSteps) {
    // 308 B-02 (B2): same sink threading as wildStartHeadless above — the
    // caller's opts.onEvent is the honest seam; absent ⇒ no-op default.
    const res = await wildStep(current, {
      ...(reviewer ? { reviewer } : {}),
      ...(opts.agentSeal ? { agentSeal: true } : {}),
      // 316 H3: the real P6 edge — the seal's DoD-repair pass re-runs it.
      ...(p6Edge ? { p6Edge } : {}),
      onEvent: opts.onEvent ?? (() => undefined),
    });
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
    project: foldInvocationEvidence(current, spendBaseline),
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
  const { wildPause, wildOperatorPark } = await import("./engine.ts");
  return {
    ok: true,
    // 308 M4-06 (B2): the CLI operator pause stamps its own park record via
    // wildOperatorPark (its FIRST repo-wide call site — the export was dead):
    // uncoded ({code:null, unlock:"resume"}), so the pause answers
    // why/what-unlocks/where-resume like every other pause.
    project: wildPause(
      project,
      project.currentPhase,
      "warn",
      "wild.paused",
      "Wild run paused from the CLI.",
      wildOperatorPark(project, "Wild run paused from the CLI."),
    ),
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
      // 308 B-01 (B2): park is present iff pause — resume clears the record so
      // a preserved park can never linger on a live run again.
      park: null,
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
    wildRun: {
      ...run,
      active: false,
      stoppedAt: Date.now(),
      pause: false,
      // 308 B-01 (B2, C2 completion): park is present iff pause — stop must
      // CLEAR a preserved park, not let it ride the spread onto a stopped run
      // (the resume/stop family rule; store.stopWildRun parity).
      park: null,
    },
  };
  return {
    ok: true,
    project: wildLog(stopped, project.currentPhase, "info", "wild.stop", "Wild run stopped from the CLI."),
    changed: true,
  };
}
