/**
 * checkpoint.server.ts — W33/T-107.7 · THE REAL RUN CHECKPOINT (server-only). Hardened W36/N2 (fixes/281).
 *
 * A bounded, versioned, atomic, corrupt-safe snapshot of a run beside `.rapidtool/`, so a run that dies
 * (crash, kill, box-freeze) can be RESUMED instead of restarted from zero (the 756 s keyed journey makes
 * this the difference between usable and fragile).
 *
 * Design laws (all load-bearing):
 *  - ATOMIC: write to a UNIQUE staging path (`<path>.<pid>.<ts>.tmp`) then rename — two concurrent
 *    writers can never interleave on one staging name, and the destination is replaced only by a
 *    completed same-volume rename. (No fsync: a power-loss window can still lose the rename — stated
 *    instead of over-claimed; stale staging files are swept by the next clear.)
 *  - CORRUPT-SAFE: read NEVER throws on junk; it returns a coded refusal (`RT_E_VALIDATION` for
 *    junk/unknown shape) or `RT_E_CHECKPOINT_MISSING` when a REAL path has no checkpoint file.
 *    Callers branch on `ok`, never on exceptions. A junk/empty `projectDir` is an ARGUMENT error →
 *    `RT_E_VALIDATION` on every operation, refused BEFORE any `join()` (the order-of-operations law).
 *  - VERSIONED: `version` gates the shape; an unknown version is refused, never guessed.
 *  - BOUNDED: the heavy arrays (logs · decisions · memory · artifacts · research · chatLog) are
 *    trimmed on a COPY before write, so a checkpoint always persists within the storage budgets.
 *    `logs`/`chatLog` match store.ts's salvage caps (RESCUE_LOG_CAP/RESCUE_CHAT_CAP); the other four
 *    are checkpoint-only — salvageTrim bounds logs+chatLog only, so this is NOT a mirror of that
 *    pass (A1-03/fixes/281; a shared HISTORY_CAPS across store/io/checkpoint is the follow-up).
 *  - MINIMAL READ: the reader proves only {version, savedAt, run, project.id, project.phases} — treat
 *    `checkpoint.project` as aspirational and run `hydrateProject` before trusting fields (the resume
 *    seam, headless.loadResumableCheckpoint, does exactly that) (A1-09/fixes/281).
 *  - SERVER-ONLY: `node:fs`/`node:path` live here and nowhere client-safe. Import from the CLI/headless/
 *    store-server paths only (the `db.ts → migration-plan.mjs` cross-boundary idiom is the precedent).
 *
 * NO network. NO keyed calls. NO timestamps beyond the recorded `savedAt` (deterministic-replay friendly).
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { classifyError, type ErrorCode } from "./errors.ts";
import { PHASES } from "./phases.ts";
import type { Project } from "./types.ts";

/** Bump ONLY with a migration note; readers refuse unknown versions rather than guessing. */
export const CHECKPOINT_VERSION = 1 as const;

/**
 * The graph's last phase id, from the single authority (`phases.ts` PHASES) — never a local
 * literal (A1-15's drift class). A checkpoint phase outside P0..this is junk at write, read and
 * admit time alike (A1-07's done-when: a `phase: 99` snapshot fails closed).
 */
const CHECKPOINT_PHASE_MAX = PHASES.length - 1;

/**
 * Trim caps for the heavy arrays bound on every write. `logs` (200) / `chatLog` (40) match
 * store.ts's RESCUE_LOG_CAP / RESCUE_CHAT_CAP; `decisions`/`memory`/`artifacts`/`research` are
 * checkpoint-only bounds today (A1-03/fixes/281 — salvageTrim does NOT bound them; do not claim
 * parity until a shared HISTORY_CAPS lands across store/io/checkpoint).
 */
export const CHECKPOINT_CAPS = {
  logs: 200,
  chatLog: 40,
  decisions: 100,
  memory: 80,
  artifacts: 120,
  research: 24,
} as const;

/** Where a project's checkpoint lives. Beside the other `.rapidtool/` run evidence, never inside src/. */
export function checkpointPath(projectDir: string): string {
  return join(projectDir, ".rapidtool", "checkpoint.json");
}

/**
 * A1-01/A1-06 (fixes/281): the shared order-of-operations law — validate the argument BEFORE any
 * path is derived. `join(undefined)` throws inside node:path, so a guard placed after the
 * derivation is dead code that only looks like defense. One helper for all three operations keeps
 * the order — and the refusal class — identical everywhere: a junk/empty `projectDir` is an
 * ARGUMENT error (`RT_E_VALIDATION`), never MISSING (that class is for real paths with no file).
 */
function refuseBadDir(projectDir: unknown): { ok: false; code: "RT_E_VALIDATION"; error: string } | null {
  if (typeof projectDir !== "string" || projectDir.length === 0) {
    return { ok: false, code: "RT_E_VALIDATION", error: "checkpoint: projectDir must be a non-empty string" };
  }
  return null;
}

/**
 * A1-04/A1-09 (fixes/281): the minimal project shape the WRITER must prove and the READER proves —
 * sharing the predicate makes write/read drift impossible (a writer that persists a file its own
 * reader refuses is self-invalidation, silent until resume time).
 */
function hasCheckpointProjectShape(value: unknown): value is { id: string; phases: unknown[] } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { id?: unknown; phases?: unknown };
  if (typeof candidate.id !== "string" || candidate.id.length === 0) return false;
  return Array.isArray(candidate.phases) && candidate.phases.length > 0;
}

/** What a runner records about itself, separate from the Project (so resume can be gated per phase). */
export type CheckpointRun = {
  /** The phase the run was committed at (1..13); resume re-enters here. */
  phase: number;
  /** The driver step within the phase (0 when the phase itself is the unit of work). */
  step: number;
  /** Which journey produced the snapshot — a keyed run resuming keyless (or vice versa) is refused. */
  mode: "keyless" | "keyed";
};

export type RunCheckpoint = {
  version: typeof CHECKPOINT_VERSION;
  savedAt: number;
  run: CheckpointRun;
  project: Project;
};

export type CheckpointWriteResult =
  | { ok: true; path: string; bytes: number }
  | { ok: false; code: ErrorCode; error: string };

/**
 * A1-09 (fixes/281): the read side proves ONLY {version, savedAt, run, project.id, project.phases} —
 * `checkpoint` is returned as a RunCheckpoint for ergonomics, but the nested project's shape is
 * ASPIRATIONAL (logs/memory/decisions/currentPhase may be junk or absent) and MUST be run through
 * `hydrateProject` before use (see engine.hydrateProject; the resume seam does this). `code` is
 * `RT_E_CHECKPOINT_MISSING` ONLY for a real path with no file; every argument/shape/I-O refusal is
 * `RT_E_VALIDATION` or `classifyError`'s verdict (EACCES → RT_E_PERMISSION_DENIED, …). `path` is
 * `""` when the argument itself was refused (no fabricated partial path).
 */
export type CheckpointReadResult =
  | { ok: true; checkpoint: RunCheckpoint; path: string }
  | { ok: false; code: ErrorCode; error: string; path: string };

/** Bound the heavy arrays on a COPY (the caller's project is never mutated by a save).
 *  A1-02 (fixes/281): TOTAL — a junk/absent array coerces to [] instead of throwing mid-bound
 *  (`asArray`, the engine-hydrate idiom); the write gate additionally requires logs/decisions to
 *  be real arrays so a partial payload is refused, not silently hollowed out. */
export function boundProjectForCheckpoint(project: Project): Project {
  const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  const fields = project as unknown as Record<string, unknown>;
  const bounded: Record<string, unknown> = { ...fields };
  bounded.logs = asArray(fields.logs).slice(-CHECKPOINT_CAPS.logs);
  bounded.decisions = asArray(fields.decisions).slice(-CHECKPOINT_CAPS.decisions);
  bounded.memory = asArray(fields.memory).slice(-CHECKPOINT_CAPS.memory);
  bounded.artifacts = asArray(fields.artifacts).slice(-CHECKPOINT_CAPS.artifacts);
  bounded.research = asArray(fields.research).slice(-CHECKPOINT_CAPS.research);
  bounded.chatLog = asArray(fields.chatLog).slice(-CHECKPOINT_CAPS.chatLog);
  return bounded as unknown as Project;
}

/** Shape validation with the smallest honest checks — enough to refuse junk, never enough to guess.
 *  A1-07 (fixes/281): run.phase/step must be INTEGERS >= 0 (a 1.5 or a 99 snapshot is junk the
 *  resume gate would otherwise admit); the project half reuses the writer's predicate. */
function isRunCheckpoint(value: unknown): value is RunCheckpoint {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<RunCheckpoint>;
  if (candidate.version !== CHECKPOINT_VERSION) return false;
  if (typeof candidate.savedAt !== "number" || !Number.isFinite(candidate.savedAt)) return false;
  const run = candidate.run as Partial<CheckpointRun> | undefined;
  if (!run || typeof run !== "object") return false;
  if (typeof run.phase !== "number" || !Number.isInteger(run.phase) || run.phase < 0 || run.phase > CHECKPOINT_PHASE_MAX) return false;
  if (typeof run.step !== "number" || !Number.isInteger(run.step) || run.step < 0) return false;
  if (run.mode !== "keyless" && run.mode !== "keyed") return false;
  return hasCheckpointProjectShape(candidate.project);
}

/**
 * Write the checkpoint atomically. Creates `.rapidtool/` when absent. `project` is bounded on a
 * copy; the caller's object is untouched. NEVER throws: every argument/shape/I-O failure returns a
 * coded refusal — `RT_E_VALIDATION` for bad input/shape, `classifyError`'s verdict for I-O
 * (EACCES → RT_E_PERMISSION_DENIED, ENOSPC → RT_E_DISK_FULL: a disk-full resume must never read
 * as "the checkpoint is garbage").
 */
export function writeCheckpoint(projectDir: string, project: Project, run: CheckpointRun): CheckpointWriteResult {
  const refusedDir = refuseBadDir(projectDir);
  if (refusedDir) return refusedDir;
  if (!hasCheckpointProjectShape(project)) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: "checkpoint: project must carry a non-empty id and a non-empty phases array",
    };
  }
  const fields = project as unknown as Record<string, unknown>;
  if (!Array.isArray(fields.logs) || !Array.isArray(fields.decisions)) {
    return { ok: false, code: "RT_E_VALIDATION", error: "checkpoint: project.logs/decisions must be arrays (partial/legacy project?)" };
  }
  // A1-04: validate `run` in the READER's terms before persisting — a JS caller can slip past the
  // type ("Keyed", 1.5, an omitted mode) and the writer would then publish a file its own reader
  // refuses. The phase range comes from the graph authority (phases.ts), so nothing is duplicated.
  const phase = (run as unknown as { phase?: unknown } | undefined)?.phase;
  const step = (run as unknown as { step?: unknown } | undefined)?.step;
  const mode = (run as unknown as { mode?: unknown } | undefined)?.mode;
  if (typeof phase !== "number" || !Number.isInteger(phase) || phase < 0 || phase > CHECKPOINT_PHASE_MAX) {
    return { ok: false, code: "RT_E_VALIDATION", error: `checkpoint: run.phase must be an integer in P0..P${CHECKPOINT_PHASE_MAX} (the phases.ts graph)` };
  }
  if (typeof step !== "number" || !Number.isInteger(step) || step < 0) {
    return { ok: false, code: "RT_E_VALIDATION", error: "checkpoint: run.step must be an integer >= 0" };
  }
  if (mode !== "keyless" && mode !== "keyed") {
    return { ok: false, code: "RT_E_VALIDATION", error: `checkpoint: run.mode must be "keyless" | "keyed" (got ${JSON.stringify(mode)})` };
  }
  const path = checkpointPath(projectDir);
  let text: string;
  try {
    const payload: RunCheckpoint = {
      version: CHECKPOINT_VERSION,
      savedAt: Date.now(),
      run: { phase, step, mode },
      project: boundProjectForCheckpoint(project),
    };
    text = JSON.stringify(payload);
  } catch (error) {
    // A1-02: the bound pass rides INSIDE the try — a shape failure lands here as a coded refusal,
    // not as a throw outside the contract ("returns a coded refusal instead of throwing").
    return { ok: false, code: classifyError(error, "RT_E_VALIDATION"), error: `checkpoint: un-serializable project (${String(error)})` };
  }
  // A1-08: unique staging per writer (pid + ms) — concurrent writers cannot interleave on one
  // staging name; the destination is replaced only by a completed write + same-volume rename.
  const staging = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(staging, text, { encoding: "utf8" });
    renameSync(staging, path);
    return { ok: true, path, bytes: Buffer.byteLength(text, "utf8") };
  } catch (error) {
    try {
      if (existsSync(staging)) unlinkSync(staging);
    } catch {
      /* best-effort staging sweep */
    }
    return { ok: false, code: classifyError(error, "RT_E_VALIDATION"), error: `checkpoint: write failed (${String(error)})` };
  }
}

/** Read the checkpoint. NEVER throws: absent → MISSING; junk/unknown shape → VALIDATION; a
 *  junk/empty `projectDir` → VALIDATION with `path: ""` (argument class — no fabricated relative
 *  path). The returned checkpoint carries the MINIMAL proven shape — hydrate before trusting
 *  fields (A1-09; see CheckpointReadResult). */
export function readCheckpoint(projectDir: string): CheckpointReadResult {
  const refusedDir = refuseBadDir(projectDir);
  if (refusedDir) return { ...refusedDir, path: "" };
  const path = checkpointPath(projectDir);
  if (!existsSync(path)) {
    return { ok: false, code: "RT_E_CHECKPOINT_MISSING", error: `checkpoint: none at ${path}`, path };
  }
  let text: string;
  try {
    text = readFileSync(path, { encoding: "utf8" });
  } catch (error) {
    // A1-05: classify — unreadable-but-present is an ENVIRONMENT failure (EACCES/EBUSY/…),
    // never "the payload is bad"; agents must not retry the same path unchanged.
    return { ok: false, code: classifyError(error, "RT_E_VALIDATION"), error: `checkpoint: unreadable (${String(error)})`, path };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, code: "RT_E_VALIDATION", error: `checkpoint: not JSON (${String(error)})`, path };
  }
  if (!isRunCheckpoint(parsed)) {
    return { ok: false, code: "RT_E_VALIDATION", error: "checkpoint: unrecognized shape or version", path };
  }
  return { ok: true, checkpoint: parsed, path };
}

/** Remove the checkpoint (best-effort; a missing file is already the desired state). Also sweeps
 *  this module's staging files — the legacy fixed `.tmp` and the pid-suffixed ones (A1-08) — so
 *  stale staging cannot accumulate. A junk/empty `projectDir` refuses BEFORE any path is derived
 *  (A1-06); the sweep is deliberately bounded to `checkpoint.json*` inside `.rapidtool/`. */
export function clearCheckpoint(projectDir: string): { ok: true } | { ok: false; code: ErrorCode; error: string } {
  const refusedDir = refuseBadDir(projectDir);
  if (refusedDir) return refusedDir;
  try {
    const path = checkpointPath(projectDir);
    if (existsSync(path)) unlinkSync(path);
    const dir = dirname(path);
    if (existsSync(dir)) {
      for (const name of readdirSync(dir)) {
        if (name === "checkpoint.json.tmp" || (name.startsWith("checkpoint.json.") && name.endsWith(".tmp"))) {
          try {
            unlinkSync(join(dir, name));
          } catch {
            /* a concurrent writer's staging file may already be gone — the sweep is best-effort */
          }
        }
      }
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, code: classifyError(error, "RT_E_VALIDATION"), error: `checkpoint: clear failed (${String(error)})` };
  }
}

/**
 * The resume gate: a snapshot may only be re-entered when its run coordinates are sane AND its
 * identity + mode still match the request. `savedAt` is surfaced on admission so the caller can
 * print the snapshot age / apply a max-age policy — resume is never silent (A1-07).
 *
 * Refusals are coded so the CLI can report honestly instead of guessing. The phase range comes
 * from the single authority (`phases.ts` PHASES — imported, never a local literal), so a
 * `phase: 99` snapshot fails closed HERE; the re-entry RECORD check (A20 — the snapshot's own
 * phase records must carry the recorded id) stays in the caller, loadResumableCheckpoint. The
 * L2-era TODO is closed — the write call site landed in headless.runUntilGate (commitRunCheckpoint)
 * and the read side is consumed by the CLI `resume`/`unattended` verbs via loadResumableCheckpoint.
 */
export function checkpointAdmits(
  checkpoint: RunCheckpoint,
  ask: { projectId: string; mode: "keyless" | "keyed" },
): { ok: true; savedAt: number } | { ok: false; code: "RT_E_VALIDATION"; error: string } {
  const run = (checkpoint as unknown as { run?: Partial<CheckpointRun> } | null | undefined)?.run;
  if (
    !run ||
    typeof run.phase !== "number" ||
    !Number.isInteger(run.phase) ||
    run.phase < 0 ||
    run.phase > CHECKPOINT_PHASE_MAX
  ) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `checkpoint: run.phase ${String(run?.phase)} is not an integer in P0..P${CHECKPOINT_PHASE_MAX} — refusing this re-entry point`,
    };
  }
  if (typeof run.step !== "number" || !Number.isInteger(run.step) || run.step < 0) {
    return { ok: false, code: "RT_E_VALIDATION", error: `checkpoint: run.step ${String(run.step)} is not an integer >= 0` };
  }
  const projectId = (checkpoint as unknown as { project?: { id?: unknown } } | null | undefined)?.project?.id;
  if (typeof projectId !== "string" || projectId !== ask.projectId) {
    return { ok: false, code: "RT_E_VALIDATION", error: `checkpoint: project mismatch (${String(projectId)})` };
  }
  if (checkpoint.run.mode !== ask.mode) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `checkpoint: mode mismatch (saved ${checkpoint.run.mode}, asked ${ask.mode})`,
    };
  }
  return { ok: true, savedAt: checkpoint.savedAt };
}
