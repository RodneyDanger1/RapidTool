// ---------------------------------------------------------------------------
// diagnose.ts — pure AI-agent diagnosis builder (fixes/109 §6).
//
// One JSON, from CLI or UI, answering "what happened, what is the active
// state, what is most likely wrong, what should I do" — machine fields only,
// no prose parsing. buildDiagnosis is a PURE ranking heuristic over observed
// rows: every claim cites `evidence` row indices, and when nothing ranks the
// verdict is the honest `none-detected` floor (DG-7 — never a fabricated
// root cause).
//
// Ranking rules (ordered, first match wins — §6.2):
//   1. wild-step-timeout   2. wild-paused-error   3. llm-unavailable
//   4. persist-failure     5. corrupt-recovery    6. runner-failing
//   7. mainthread-stall    8. freeze-pre-capture
//   9. unclassified-errors (non-park errors exist, no named rule)
//  10. honest-park (ONLY exit-2 park rows in window — the designed outcome,
//      never counted as an error; fixes/323 FIX-2c)  11. none-detected
//
// EXPORT SURFACE (compile against these — do not rename):
//   buildDiagnosis · projectWildRun · isParkRow · type DiagnosisInput ·
//   type DiagnosisJson · type DiagnosisCause
// ---------------------------------------------------------------------------

import { ERROR_CODE_DOC, type ErrorCode } from "./errors.ts";
import { WILD_STEP_BUDGET_MS, CHAT_STEP_BUDGET_MS } from "./rt-events.ts";
import type { RtEvent } from "./rt-events.ts";
import { isRtEventLike } from "./rt-ring.ts";

export type DiagnosisWildRun = {
  active: boolean;
  pause: boolean;
  phase: number | null;
  startedAt: number | null;
  lastAutoAt: number | null;
  lastAutoLog: string | null;
  /** Persisted stop timestamp, verbatim (null while the run was never stopped)
   *  — never a read-time fallback (fixes/320 G2: a parked run reads null). */
  stoppedAt: number | null;
  /** DERIVED, only while the run is genuinely progressing (active && !pause):
   *  ms since lastAutoAt (stale ⇒ the step may be wedged). Parked/stopped runs
   *  → null (fixes/320 G2 — no growing clock on a run that is not advancing). */
  overdueMs: number | null;
} | null;

export type DiagnosisProject = {
  ref: string | null;
  name: string | null;
  status: string | null;
  currentPhase: number | null;
  wildRun: DiagnosisWildRun;
};

export type DiagnosisTimelineRow = {
  ts: number;
  kind: "ledger" | "telemetry";
  event: string;
  scope?: string;
  phase?: number | null;
  detailOrMessage: string;
};

export type DiagnosisWatchdog = {
  lastHeartbeatAt: number | null;
  heartbeatLagMs: number | null;
  stall: { active: boolean; since: number; stepElapsedMs: number; class: string } | null;
  lastLongTaskMs: number | null;
  budgetsMs: { wildStep: number; chat: number };
};

export type DiagnosisGrowth = {
  rows: Record<string, number>;
  // W40 solo (K7/G4): values may be null where the surface genuinely cannot measure
  // (the browser's projectFile/logDirBytes) — null = "not measured", never a fake 0.
  bytes: Record<string, number | null>;
  counts: Record<string, number>;
};

export type DiagnosisCause = {
  rank: number;
  class: string;
  summary: string;
  evidence: string[];
};

export type DiagnosisInput = {
  source: "cli" | "ui";
  now: number;
  session: { sessionId: string; host: string; node?: string; href?: string; ua?: string };
  project: DiagnosisProject;
  /** error/critical rows, oldest-first (indices cited in evidence). */
  errors: RtEvent[];
  timeline: DiagnosisTimelineRow[];
  watchdog: DiagnosisWatchdog;
  growth: DiagnosisGrowth;
  persistHealth: { ok: boolean; lastError: string | null };
  crashSnapshot: { at: number; href: string } | null;
  /** Optional watcher surface (CAP-12) — additive field. */
  watcher?: { active: number; errors: number; refused: number };
};

export type DiagnosisJson = {
  schema_version: 1;
  cmd: "diagnose";
  ok: true;
  exit_code: 0;
  generatedAt: number;
  source: "cli" | "ui";
  session: DiagnosisInput["session"];
  project: DiagnosisProject;
  errors: {
    ts: number;
    level: string;
    scope: string;
    event: string;
    code: string | null;
    message: string;
    capture: string;
    count?: number;
  }[];
  timeline: DiagnosisTimelineRow[];
  watchdog: DiagnosisWatchdog;
  growth: DiagnosisGrowth;
  persistHealth: { ok: boolean; lastError: string | null };
  watcher?: { active: number; errors: number; refused: number };
  mostLikelyCause: DiagnosisCause;
  candidates: DiagnosisCause[];
  actions: string[];
  codes: Record<string, { meaning: string; agentAction: string }>;
};

const NONE_DETECTED: DiagnosisCause = {
  rank: 1,
  class: "none-detected",
  summary: "No error rows in window — incident predates capture or is environmental.",
  evidence: [],
};

type RankedMatch = { class: string; summary: string; evidence: string[] };

/** Error-row index refs cited as evidence (row order = input errors array). */
function rowRefs(prefix: string, indices: number[]): string[] {
  return indices.map((i) => `${prefix}[${i}]`);
}

/**
 * G2 (fixes/320): the ONE canonical projection from a persisted wildRun value
 * to the diagnosis wildRun view. `raw` must be DISK TRUTH — the record as
 * stored. Callers that load a project file pass `preserveWildRun: true` so the
 * hydrate cannot force-stop a persisted active run into a read-time artifact
 * first (engine.hydrateWildRun does exactly that by default; the CLI's
 * diagnose load used to omit the flag — T1 F-D / T2 BUG-2).
 *
 * No read-time fabrication, ever:
 *   • `stoppedAt` is the persisted number-or-null, VERBATIM — a run that was
 *     never stopped keeps `null`; nothing here stamps `Date.now()`.
 *   • `overdueMs` is derived ONLY while the run is genuinely progressing
 *     (`active && !pause && lastAutoAt !== null`) — the same idiom the UI path
 *     already uses (rt-client.ts `projectToDiagnosis`); a parked or stopped
 *     run has no overdue clock, so the field is `null`, never a growing
 *     `now - lastAutoAt`.
 * Junk input (null / non-object / array) → null, never a throw — this feeds
 * both the live Runtime Log pane and the CLI envelope (M3 hostile-input
 * spirit, same as the guards inside buildDiagnosis).
 */
export function projectWildRun(raw: unknown, now: number): DiagnosisWildRun {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const w = raw as Record<string, unknown>;
  const numOrNull = (x: unknown): number | null =>
    typeof x === "number" && Number.isFinite(x) ? x : null;
  const active = w.active === true;
  const pause = w.pause === true;
  const lastAutoAt = numOrNull(w.lastAutoAt);
  return {
    active,
    pause,
    phase: numOrNull(w.phase),
    startedAt: numOrNull(w.startedAt),
    lastAutoAt,
    lastAutoLog: typeof w.lastAutoLog === "string" ? w.lastAutoLog : null,
    stoppedAt: numOrNull(w.stoppedAt),
    overdueMs: active && !pause && lastAutoAt !== null ? Math.max(0, now - lastAutoAt) : null,
  };
}

/**
 * fixes/323 FIX-2c (F-3): an exit-2 PARK row — `run`/`gate`/`resume`/
 * `unattended` parked at a HITL gate or `blocked`, stamped by the CLI as a
 * `cli.invocation` row with `payload.exitCode === 2` (plus `payload.parked:
 * true` on rows written after the fix). A park is the taxonomy's honest
 * outcome, NOT a failure — it carries no RT_E code (codes are for surfaced
 * failures) and the envelope deliberately omits `code` on a clean park. Both
 * shapes classify: legacy rows already on disk read `level:"error"` and must
 * be recognized so the verdict NAMES the park instead of counting it among
 * unclassified errors. Pure; junk rows → false, never a throw.
 */
export function isParkRow(row: RtEvent): boolean {
  if (!row || typeof row !== "object") return false;
  const payload = row.payload as { parked?: unknown; exitCode?: unknown } | null | undefined;
  if (!payload || typeof payload !== "object") return false;
  if (payload.parked === true) return true;
  return row.event === "cli.invocation" && payload.exitCode === 2;
}

/**
 * Pure §6.2 heuristic. All rules are evaluated (not just the first); the
 * highest-priority match becomes `mostLikelyCause`, the rest rank as
 * candidates (cap 3). Every claim carries evidence row indices.
 */
export function buildDiagnosis(input: DiagnosisInput): DiagnosisJson {
  // M3-10 (fixes/309): a junk input (null/undefined) floors to the same empty
  // shape this file already produces for `{}` — every field below keeps its
  // `?? default` / Array.isArray guard. Never a throw: this runs live in the
  // Runtime Log pane (the R4-f06 UI-crash class, rt-client.ts:268-276).
  const src = (input ?? {}) as DiagnosisInput;
  // M3-11 (fixes/309): junk rows in errors[] are dropped the same way the ring
  // drops them at hydrate — real rows keep ranking and the evidence indices
  // below stay aligned with the filtered output array.
  const errors = (Array.isArray(src.errors) ? src.errors : []).filter(isRtEventLike);
  const now = typeof src.now === "number" && Number.isFinite(src.now) ? src.now : 0;
  const project = src.project ?? {
    ref: null,
    name: null,
    status: null,
    currentPhase: null,
    wildRun: null,
  };
  const watchdog: DiagnosisWatchdog = src.watchdog ?? {
    lastHeartbeatAt: null,
    heartbeatLagMs: null,
    stall: null,
    lastLongTaskMs: null,
    budgetsMs: { wildStep: WILD_STEP_BUDGET_MS, chat: CHAT_STEP_BUDGET_MS },
  };
  const persistHealth = src.persistHealth ?? { ok: true, lastError: null };
  // M3-12 (fixes/309): only a snapshot-shaped object counts as a snapshot; a
  // junk `at` never reaches `new Date(...).toISOString()` raw (the summary
  // below refuses the unreadable timestamp instead of fabricating one).
  const crashSnapshot =
    src.crashSnapshot && typeof src.crashSnapshot === "object" && !Array.isArray(src.crashSnapshot)
      ? src.crashSnapshot
      : null;
  const timeline = Array.isArray(src.timeline) ? src.timeline : [];
  const growth = src.growth ?? { rows: {}, bytes: {}, counts: {} };

  const matches: RankedMatch[] = [];

  // 1. wild-step-timeout — active run whose lastAutoAt is past 1× budget.
  const wr = project.wildRun;
  if (wr && wr.active && !wr.pause && wr.lastAutoAt !== null && now - wr.lastAutoAt > WILD_STEP_BUDGET_MS) {
    const evidence: string[] = [
      `watchdog.stall:${watchdog.stall ? "active" : "none"}`,
      `project.wildRun.lastAutoAt:${wr.lastAutoAt}`,
    ];
    const timeoutIdx = errors.findIndex((e) => e.event === "wild.step_timeout");
    if (timeoutIdx >= 0) evidence.push(...rowRefs("errors", [timeoutIdx]));
    const stepIdx = errors.findIndex((e) => e.event === "wild.step_start" || e.event === "wild.step_ok");
    if (stepIdx >= 0) evidence.push(...rowRefs("errors", [stepIdx]));
    matches.push({
      class: "wild-step-timeout",
      summary: `Active wild run at P${wr.phase ?? "?"} has not produced an auto-decision for ${Math.round((now - wr.lastAutoAt) / 1000)}s (budget ${WILD_STEP_BUDGET_MS / 1000}s).`,
      evidence,
    });
  }

  // 2. wild-paused-error — paused run + newest wild.* error/warn row.
  if (wr && wr.pause) {
    const wildErrIdx = [...errors.keys()].reverse().find((i) => /^wild\./.test(errors[i].event));
    if (wildErrIdx !== undefined) {
      const row = errors[wildErrIdx];
      const codeClass: Record<string, string> = {
        RT_E_LLM_REJECTED: "llm-provider",
        RT_E_GATE_PENDING: "human gate",
        RT_E_PHASE_ILLEGAL: "state corruption",
        RT_E_INTERNAL: "engine bug",
      };
      matches.push({
        class: "wild-paused-error",
        summary: `Wild run parked at P${wr.phase ?? "?"} by ${row.event}${row.code ? ` (${row.code})` : ""}: ${String(row.message ?? "").slice(0, 160)}`,
        evidence: [
          ...rowRefs("errors", [wildErrIdx]),
          `code-class:${row.code && codeClass[row.code] ? codeClass[row.code] : "unknown"}`,
        ],
      });
    }
  }

  // 3. llm-unavailable — ≥ 2 llm-call error rows in the last 5 minutes.
  const llmIdx: number[] = [];
  for (let i = 0; i < errors.length; i++) {
    const e = errors[i];
    if (
      e.scope === "llm-call" &&
      now - e.ts <= 5 * 60_000 &&
      (e.level === "error" || e.level === "critical")
    ) {
      llmIdx.push(i);
    }
  }
  if (llmIdx.length >= 2) {
    matches.push({
      class: "llm-unavailable",
      summary: `${llmIdx.length} LLM-call failures in the last 5 minutes — check configuration, key and provider balance.`,
      evidence: rowRefs("errors", llmIdx),
    });
  }

  // 4. persist-failure — persist health broken or quota rows present.
  const quotaIdx = errors.findIndex((e) => e.event === "persist.quota_failed");
  if (persistHealth.ok === false || quotaIdx >= 0) {
    const evidence: string[] = [];
    if (quotaIdx >= 0) evidence.push(...rowRefs("errors", [quotaIdx]));
    if (persistHealth.ok === false) evidence.push("persistHealth.ok:false");
    matches.push({
      class: "persist-failure",
      summary: "Local persistence is failing — in-memory state will NOT survive a reload (data-loss risk).",
      evidence,
    });
  }

  // 5. corrupt-recovery — hydration repaired a corrupt blob.
  const corruptIdx = errors.findIndex((e) => e.event === "hydrate.recovered_corrupt");
  if (corruptIdx >= 0) {
    matches.push({
      class: "corrupt-recovery",
      summary: "A corrupt persisted state was dropped and repaired at hydration — expect side effects (fresh seed or trimmed history).",
      evidence: rowRefs("errors", [corruptIdx]),
    });
  }

  // 6. runner-failing — runner failure cluster.
  const runnerIdx: number[] = [];
  for (let i = 0; i < errors.length; i++) {
    if (errors[i].scope === "runner-exec" && (errors[i].event === "runner.failed" || errors[i].event === "runner.unavailable")) {
      runnerIdx.push(i);
    }
  }
  if (runnerIdx.length > 0) {
    matches.push({
      class: "runner-failing",
      summary: `${runnerIdx.length} runner failure row(s) — the generated module failed real execution or the runner is unavailable.`,
      evidence: rowRefs("errors", runnerIdx),
    });
  }

  // 7. mainthread-stall — stall/longtask rows in window.
  const stallIdx: number[] = [];
  for (let i = 0; i < errors.length; i++) {
    const e = errors[i];
    if (e.event === "sys.mainthread_stall" || e.event === "sys.longtask") stallIdx.push(i);
  }
  if (stallIdx.length > 0) {
    matches.push({
      class: "mainthread-stall",
      summary: "Main-thread stalls were observed — environment or render hot-loop; check heavy synchronous work in the UI.",
      evidence: rowRefs("errors", stallIdx),
    });
  }

  // 8. freeze-pre-capture — a previous session crashed hard.
  if (crashSnapshot) {
    // M3-12 (fixes/309): a junk `at`/`href` must not RangeError or smuggle a
    // fabricated date into the summary — refuse the unreadable parts honestly.
    const atText =
      typeof crashSnapshot.at === "number" && Number.isFinite(crashSnapshot.at)
        ? new Date(crashSnapshot.at).toISOString()
        : "an unreadable timestamp";
    const hrefText = typeof crashSnapshot.href === "string" ? crashSnapshot.href : "unknown href";
    matches.push({
      class: "freeze-pre-capture",
      summary: `A crash snapshot from ${atText} (${hrefText}) was imported — the freeze tail predates this session.`,
      evidence: ["crashSnapshot"],
    });
  }

  // Honest floor when rows exist but no named heuristic matched.
  // Claiming "No error rows in window" while errors.length > 0 is a lie
  // (lone llm-call, hydrate.repaired, sys.uncaught_error, RT_E_GATES_FAILED, …).
  // fixes/323 FIX-2c (F-3): exit-2 park rows are separated FIRST — a park is
  // the designed outcome (exit 2 = parked at a gate / blocked), never an
  // "unclassified error" and never the "not a clean bill of health" language:
  // a parks-only window ranks `honest-park`; a mixed window counts ONLY the
  // non-park rows (a park never inflates the error count).
  if (matches.length === 0 && errors.length > 0) {
    const parkIdx: number[] = [];
    const restIdx: number[] = [];
    errors.forEach((row, i) => (isParkRow(row) ? parkIdx : restIdx).push(i));
    if (restIdx.length === 0) {
      matches.push({
        class: "honest-park",
        summary: `${parkIdx.length} exit-2 park row(s) in window — the project parked at a HITL gate (awaiting a decision) or blocked; a park is the designed outcome, not an error.`,
        evidence: rowRefs("errors", parkIdx),
      });
    } else {
      matches.push({
        class: "unclassified-errors",
        summary: `${restIdx.length} error/critical row(s) in window did not match a named heuristic — not a clean bill of health.`,
        evidence: rowRefs("errors", restIdx),
      });
    }
  }

  const ordered = matches.length > 0 ? matches : [NONE_DETECTED];
  const mostLikelyCause: DiagnosisCause = { rank: 1, ...ordered[0] };
  const candidates: DiagnosisCause[] = ordered.slice(1, 4).map((m, i) => ({ rank: i + 2, ...m }));

  // Actions: class-derived + ERROR_CODE_DOC.agentAction for each distinct code.
  const actions: string[] = [];
  const classActions: Record<string, string[]> = {
    "wild-step-timeout": [
      "Stop the wild run (store.stopWildRun / `rapidtool wild --stop`) and check the LLM transport before resuming.",
      "Resume is a human act after an auto-pause — verify DEEPSEEK_API_KEY and provider latency first.",
    ],
    "wild-paused-error": [
      "Read the parked row's code (errors[].code) and apply its ERROR_CODE_DOC agent action; resume only after the cause is addressed.",
    ],
    "llm-unavailable": [
      "Check DEEPSEEK_API_KEY, provider balance and rate limits; deterministic paths keep working meanwhile.",
    ],
    "persist-failure": [
      "Export the project JSON before any reload — storage is rejecting writes.",
      "Reduce localStorage pressure (archive projects, clear old artifacts) and re-check persistStorageHealth().",
    ],
    "corrupt-recovery": [
      "State was repaired at hydration — verify the active project's phase graph and logs are as expected.",
    ],
    "runner-failing": [
      "Read the runner's stdout/stderr evidence, fix the generated module, and re-run before claiming any test verdict.",
    ],
    "mainthread-stall": [
      "Profile the hot path (Long Tasks) — the freeze class is environment/render bound, not engine state.",
    ],
    "freeze-pre-capture": [
      "Inspect the imported `sys.previous_session_crash` tail to reconstruct what froze before this session.",
    ],
    "unclassified-errors": [
      "Read errors[].event and errors[].code — a named heuristic did not rank these rows; do not treat diagnose as none-detected.",
    ],
    "honest-park": [
      "The project is parked (exit 2: awaiting_hitl / blocked) — resolve the open gate (approve/reject) or retry a rejected phase; a park is the designed outcome, not an error and not a progress signal.",
    ],
    "none-detected": ["No action — nothing ranks; re-check after reproducing the incident with the runtime tab open."],
  };
  actions.push(...(classActions[mostLikelyCause.class] ?? []));

  const distinctCodes: string[] = [];
  const codes: Record<string, { meaning: string; agentAction: string }> = {};
  for (const e of errors) {
    if (!e.code) continue;
    if (!/^RT_E_[A-Z0-9_]+$/.test(e.code)) continue;
    if (distinctCodes.includes(e.code)) continue;
    distinctCodes.push(e.code);
    const doc = ERROR_CODE_DOC[e.code as ErrorCode];
    if (doc) {
      codes[e.code] = doc;
      if (!actions.includes(doc.agentAction)) actions.push(doc.agentAction);
    }
  }

  return {
    schema_version: 1,
    cmd: "diagnose",
    ok: true,
    exit_code: 0,
    generatedAt: now,
    source: src.source,
    session: src.session,
    project,
    errors: errors.map((e) => ({
      ts: e.ts,
      level: e.level,
      scope: e.scope,
      event: e.event,
      code: e.code ?? null,
      message: e.message,
      capture: e.capture,
      ...(typeof e.count === "number" && e.count > 1 ? { count: e.count } : {}),
    })),
    timeline,
    watchdog,
    growth,
    persistHealth,
    ...(src.watcher ? { watcher: src.watcher } : {}),
    mostLikelyCause,
    candidates,
    actions,
    codes,
  };
}
