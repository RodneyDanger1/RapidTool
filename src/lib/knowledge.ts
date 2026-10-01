// ---------------------------------------------------------------------------
// knowledge.ts — JSON-backed cross-project pattern store (Pillar 11).
//
// KnowledgeStore is a small append-only store of agent "pattern" entries
// (briefs, patterns, fixes, notes) persisted to a single JSON file whose path
// the caller supplies. Design rules:
//
//   1. Append-only — savePattern() never mutates or deletes an existing
//      entry; it only ever grows the `entries` array. Idempotent duplicates
//      (E-09 stance, same fingerprint as report-intake.ts) return the
//      existing entry with appended:false instead of forking rows.
//   2. Atomic writes — the store is rewritten to `<file>.tmp` and renamed
//      over the target, so a crash mid-save cannot corrupt a valid store.
//      A store file that is already corrupt is REFUSED with a throw — the
//      store never silently wipes append-only data.
//   3. Deterministic ranking — findPatterns() uses idf-weighted lexical
//      token overlap (title tokens ×2, tag tokens ×1.5, body tokens ×1,
//      normalized to [0,1]). HONEST LABEL: this is FusionRank-STYLE lexical
//      scoring on plain tokens, NOT a vector database and NOT embeddings —
//      synonyms and paraphrases do not match unless words are shared.
//   4. Advisory only — injectProven() returns research rows; nothing here
//      auto-applies knowledge to a project.
//
// The file format is `{ version: 1, entries: KnowledgeEntry[] }`. A store
// with no file yet is treated as empty and created on first save.
// ---------------------------------------------------------------------------
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fnv1a, fusionRank, tokenizeWords } from "./algorithms.ts";
import { briefNounHits, identifierHits } from "./sandbox.ts";
import type { ErrorCode } from "./errors.ts";
import type { HitlDecision, IntentLattice, JsonLog, MemoryEntry, PhaseId, Project } from "./types.ts";

/**
 * fixes/144 (D2): pure lesson-ranking helpers moved here from prompt-engine.ts
 * so the engine's client-safe dynamic seam can reach them WITHOUT dragging
 * prompt-engine's static deepseek.server import into the client graph
 * (tanstack import-protection). prompt-engine re-exports these for its own
 * consumers (codegen/wild-mode/prompt-engine.test) — one definition site.
 */

/** Default top-k for lesson injection into the expansion prompt (mirrors the
 *  packet's fusionRank limit). The prompt's own EXPAND_LESSON_MAX_COUNT cap
 *  still applies on top. */
export const EXPAND_LESSON_RANK_LIMIT = 5;

/** A knowledge-store row mapped for ranking (caller maps KnowledgeStore
 *  injectProven() output via provenToLessonRow). source:"research" earns the
 *  E-18 cited boost inside fusionRank — cross-project provenance stays
 *  visible in the ranking itself. */
export type RankableLessonRow = {
  id: string;
  kind: MemoryEntry["kind"];
  phase: PhaseId;
  text: string;
  score: number;
  source: MemoryEntry["source"];
  tags?: string[];
};

/** fusionRank's rankable output: id + blended rank score + text + kind. */
export type RankedLessonRow = {
  id: string;
  score: number;
  text: string;
  kind: MemoryEntry["kind"];
};

/** Map a KnowledgeStore injectProven row to a RankableLessonRow for lesson
 *  ranking (id prefixed `proven-`; source "research" earns the E-18 cited
 *  boost inside fusionRank). */
export function provenToLessonRow(p: {
  entryId: string;
  advice: string;
  score: number;
}): RankableLessonRow {
  return {
    id: `proven-${p.entryId}`,
    kind: "semantic",
    phase: 0,
    text: p.advice,
    score: p.score,
    source: "research",
    tags: ["lesson"],
  };
}

/** Rank the brief against the project's lesson rows (fusionRank, bounded).
 *  Pure: same inputs → same rows. Caller-mapped knowledge-store proven rows
 *  (opts.proven) rank alongside memory lessons. */
export function rankBriefLessons(
  brief: string,
  memory: readonly MemoryEntry[],
  opts?: { limit?: number; proven?: readonly RankableLessonRow[] },
): RankedLessonRow[] {
  if (typeof brief !== "string" || !brief.trim()) return [];
  const limit = opts?.limit;
  const cap =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(0, Math.floor(limit))
      : EXPAND_LESSON_RANK_LIMIT;
  const rows: MemoryEntry[] = [];
  for (const m of Array.isArray(memory) ? memory : []) {
    if (!m || typeof m !== "object" || typeof m.text !== "string") continue;
    if (!Array.isArray(m.tags) || !m.tags.includes("lesson")) continue;
    rows.push(m);
  }
  const proven = Array.isArray(opts?.proven) ? opts!.proven! : [];
  const withProven: MemoryEntry[] = [
    ...rows,
    ...proven.map((r): MemoryEntry => ({
      id: r.id,
      kind: r.kind,
      phase: r.phase,
      text: r.text,
      score: r.score,
      source: r.source,
      tags: ["lesson"],
    })),
  ];
  if (withProven.length === 0) return [];
  return fusionRank(brief, withProven, cap);
}

/** Prompt-ready lesson lines for the expansion prompt's advisory block:
 *  `[kind rank-score] text` — the same provenance-visible form the packet's
 *  Ranked-memory section prints. Feed the result into expandBrief's
 *  `lessons` (expansionPrompt bullets + caps them; see EXPAND_LESSON_*). */
export function lessonLinesForBrief(
  brief: string,
  memory: readonly MemoryEntry[],
  opts?: { limit?: number; proven?: readonly RankableLessonRow[] },
): string[] {
  return rankBriefLessons(brief, memory, opts).map((r) => `[${r.kind} ${r.score}] ${r.text}`);
}

/**
 * 216g (112 §4.4 — T4): resolve a configured KnowledgeStore into the lesson
 * rows the expansion prompt ranks. `rankBriefLessons` / `lessonLinesForBrief`
 * already accept cross-project rows via `opts.proven`; the missing half was the
 * store → rows resolver this function provides. The caller (the codegen/engine
 * expansion sites) passes the result straight through:
 *
 *   const proven = provenRowsFromStore(storePath, project.name);
 *   lessonLinesForBrief(brief, selectLessons(project.memory ?? [], 6, LIMIT), {
 *     limit: LIMIT, proven: proven.rows,
 *   });
 *
 * No store path configured ⇒ `{rows: [], degraded: false}` and the caller's
 * prompt stays BYTE-IDENTICAL to the legacy expansion (absent store ⇒ no
 * change). A configured path that cannot be read/parsed ⇒
 * `{rows: [], degraded: true, reason, code}` — the failure is RETURNED, never
 * thrown into a synthesis path and never silently swallowed as "no lessons":
 * the refusal state stays visible to the caller (112 §2.2 rung 6).
 * Read-only: this never appends to the store (112 §3.4 P1 — no machine writer).
 */
export type ProvenRowsResult = {
  rows: RankableLessonRow[];
  /** true when a store path was configured but the store could not be read. */
  degraded: boolean;
  /** Present when degraded: the store's own refusal message. */
  reason?: string;
  /** RT_E code for the degraded case (surfaced, never thrown). */
  code?: ErrorCode;
};

export function provenRowsFromStore(
  storePath: string | null | undefined,
  project: string,
  opts?: { limit?: number; minScore?: number; includeSuperseded?: boolean; includeRetired?: boolean },
): ProvenRowsResult {
  const path = typeof storePath === "string" ? storePath.trim() : "";
  if (!path) return { rows: [], degraded: false };
  try {
    const store = new KnowledgeStore(path);
    const proven = store.injectProven(typeof project === "string" ? project : "", {
      limit: opts?.limit ?? EXPAND_LESSON_RANK_LIMIT,
      minScore: opts?.minScore,
      includeSuperseded: opts?.includeSuperseded,
      includeRetired: opts?.includeRetired,
    });
    return { rows: proven.map((p) => provenToLessonRow(p)), degraded: false };
  } catch (err) {
    return {
      rows: [],
      degraded: true,
      reason: err instanceof Error ? err.message : String(err),
      code: "RT_E_VALIDATION",
    };
  }
}

export type KnowledgeKind = "brief" | "pattern" | "fix" | "note";

export interface KnowledgeEntry {
  /** Deterministic content fingerprint: K + fnv1a over the entry fields. */
  id: string;
  project: string;
  kind: KnowledgeKind;
  title: string;
  /** Sorted at save time so equal tag sets produce equal fingerprints. */
  tags: string[];
  body: string;
  /** Optional provenance: file/URL the pattern came from. */
  sourcePath?: string;
  /** ISO timestamp of the first save (never rewritten on duplicates). */
  savedAt: string;
  /** Maker-card score for eval-gated lesson promotion (185-U1). Optional;
   *  NEVER part of the fingerprint — score gates the write, it does not
   *  fork content-addressed identity. Missing on a lesson-tagged save
   *  refuses promotion (shouldPromoteLesson treats unknown next as false). */
  score?: number;
  /** Learning-loop telemetry (fixes/98 §4.2): how many later runs produced
   *  counter-evidence against this entry's claim. Writer-only, mutated via
   *  bumpCounterEvidence(); NEVER part of the fingerprint (else idempotent
   *  re-save would fork the row). */
  counterEvidence?: number;
  /** Learning-loop telemetry: ids of the append-only rows that superseded
   *  this entry (the mirror of a superseding row's `supersedes[]`). */
  supersededBy?: string[];
  /** Ids of older entries this NEW row supersedes. Content (declared at save
   *  time, IS part of the fingerprint) — a supersede is an append, never a
   *  delete (append-only law). */
  supersedes?: string[];
}

export type NewKnowledgeEntry = Omit<KnowledgeEntry, "id" | "savedAt">;

export interface SaveResult {
  entry: KnowledgeEntry;
  /** false when an identical entry already existed (idempotent no-op)
   *  OR when a lesson write was refused by shouldPromoteLesson. */
  appended: boolean;
  /** true when a lesson-tagged save was refused (eval-gated regression /
   *  missing maker score). Never set for non-lesson rows. Store is
   *  append-only: refuse never deletes prior rows. */
  refused?: boolean;
  /** Machine reason when refused (e.g. "eval-gated-regression"). */
  reason?: string;
  /** RT_E_* when refused. */
  code?: ErrorCode;
}

export interface KnowledgeMatch {
  entry: KnowledgeEntry;
  /** Deterministic relevance in [0,1]; 0 rows are never returned. */
  score: number;
}

export interface ProvenRow {
  source: "knowledge-store";
  entryId: string;
  project: string;
  title: string;
  score: number;
  /** One-line, paste-ready advisory derived from the stored body. */
  advice: string;
}

interface StoreFile {
  version: number;
  entries: KnowledgeEntry[];
}

const STORE_VERSION = 1;

const STOPWORDS = new Set([
  "the", "and", "of", "to", "a", "an", "for", "in", "on", "with", "at",
  "from", "by", "is", "are", "was", "were", "be", "been", "it", "its",
  "this", "that", "these", "those", "as", "or", "but", "not", "no", "we",
  "you", "they", "our", "your", "their", "into", "over", "under", "about",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (tok) => tok.length > 1 && !/^[0-9]+$/.test(tok) && !STOPWORDS.has(tok),
  );
}

function oneLine(s: string, cap = 180): string {
  return s.replace(/\s+/g, " ").trim().slice(0, cap);
}

function isEntryRow(v: unknown): v is KnowledgeEntry {
  if (v === null || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.project === "string" &&
    typeof e.title === "string" &&
    typeof e.body === "string" &&
    Array.isArray(e.tags) &&
    e.tags.every((t) => typeof t === "string") &&
    (e.kind === "brief" || e.kind === "pattern" || e.kind === "fix" || e.kind === "note")
  );
}

/**
 * Fail-closed save seam. savePattern() may never write a row that the
 * read-back filter `isEntryRow` would drop — that is the write-only-store
 * bug (98_make_1: --save appends but entries()/--find see nothing because
 * the saved row is filtered on read). A malformed candidate (missing/non-
 * string body, out-of-enum kind, non-string tags, …) is rejected with a
 * throw instead of silently persisting an unreadable row. Mirrors the exact
 * field checks of isEntryRow so save and read can never diverge.
 */
function assertValidNewEntry(input: NewKnowledgeEntry): void {
  const e = input as unknown as Record<string, unknown>;
  const problems: string[] = [];
  if (e === null || typeof e !== "object") {
    problems.push("entry is not an object");
  } else {
    if (typeof e.project !== "string") problems.push("project must be a string");
    if (e.kind !== "brief" && e.kind !== "pattern" && e.kind !== "fix" && e.kind !== "note") {
      problems.push(`kind must be brief|pattern|fix|note (got ${JSON.stringify(e.kind)})`);
    }
    if (typeof e.title !== "string") problems.push("title must be a string");
    if (typeof e.body !== "string") problems.push("body must be a string");
    if (!Array.isArray(e.tags) || !e.tags.every((t) => typeof t === "string")) {
      problems.push("tags must be an array of strings");
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `KnowledgeStore: refusing to save a malformed entry that could never be read back — ${problems.join("; ")}.`,
    );
  }
}

/** Collapse a candidate entry to its fingerprint string (deterministic). */
function fingerprint(e: NewKnowledgeEntry): string {
  return [
    e.project,
    e.kind,
    e.title,
    [...e.tags].sort().join(","),
    e.body,
    e.sourcePath ?? "",
    // Supersede declarations are content (a superseding row is a DIFFERENT row
    // from the plain fix). Absent field = empty string = the legacy hash, so
    // pre-loop rows fingerprint identically. Telemetry (counterEvidence /
    // supersededBy) deliberately stays OUT — idempotent re-save of the same
    // content must still resolve to the same row.
    e.supersedes && e.supersedes.length > 0 ? [...e.supersedes].sort().join(",") : "",
  ].join("\u0000");
}

export class KnowledgeStore {
  private readonly filePath: string;
  private cache: KnowledgeEntry[] | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /** All entries, newest last (append order). Reads the file at most once
   *  per mutation cycle; later saves update the cache directly.
   *
   *  109 T-10: returns a DEFENSIVE COPY — a caller that empties, sorts or
   *  pushes onto the returned array must not corrupt the live cache every
   *  later read serves. Row objects are shared by identity (append-only rows
   *  are never rewritten in place by the store); callers that mutate a row
   *  object are already outside the store's contract. */
  entries(): KnowledgeEntry[] {
    if (this.cache === null) this.cache = this.readStore();
    return [...this.cache];
  }

  count(): number {
    return this.entries().length;
  }

  private readStore(): KnowledgeEntry[] {
    if (!existsSync(this.filePath)) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.filePath, "utf8"));
    } catch (err) {
      throw new Error(
        `KnowledgeStore: store file "${this.filePath}" is not valid JSON (${(err as Error).message}). ` +
          "Refusing to overwrite append-only data — repair or remove the file manually.",
      );
    }
    const store = parsed as Partial<StoreFile>;
    if (store === null || typeof store !== "object" || store.version !== STORE_VERSION || !Array.isArray(store.entries)) {
      throw new Error(
        `KnowledgeStore: store file "${this.filePath}" has an unrecognized shape ` +
          `(expected {version: ${STORE_VERSION}, entries: [...]}). Refusing to overwrite it.`,
      );
    }
    // Defensive row filtering (same stance as hydrateProject): junk rows from
    // hand edits are skipped, never allowed to poison later scans.
    return store.entries.filter(isEntryRow);
  }

  /**
   * Fresh disk rows (uncached). Fail-closed on a corrupt file exactly like
   * entries() — the store never silently overwrites append-only data.
   */
  private readDisk(): KnowledgeEntry[] {
    return existsSync(this.filePath) ? this.readStore() : [];
  }

  /** Union of disk rows (file order first) and local rows not on disk yet.
   *  Rows are deduped by id; equal fingerprints share an id, so the union is
   *  append-order-preserving and can never fork a duplicate row. This is what
   *  makes concurrent appends safe: two KnowledgeStore instances (or two
   *  processes) saving against the same file each merge the other's fresh
   *  rows instead of last-writer-wins clobbering them. */
  private mergeWithDisk(local: KnowledgeEntry[]): KnowledgeEntry[] {
    const disk = this.readDisk();
    const seen = new Set<string>();
    const out: KnowledgeEntry[] = [];
    for (const e of disk) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
    for (const e of local) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
    return out;
  }

  /** Persist one entry. Append-only + idempotent: saving an entry whose
   *  fingerprint already exists returns the original row and appends nothing.
   *  The write is merge-on-save (fresh disk rows are folded in first), so a
   *  stale in-memory cache can never erase rows another instance appended.
   *
   *  185-U1 / fixes/191: lesson-tagged rows (tags include LESSON_TAG) are
   *  eval-gated via shouldPromoteLesson against any prior same-id or
   *  same-title lesson. Regression or missing next maker score → no append,
   *  { appended:false, refused:true, reason:"eval-gated-regression",
   *  code:"RT_E_VALIDATION" }. Non-lesson rows are byte-identical to the
   *  pre-gate path. Never deletes rows. */
  savePattern(input: NewKnowledgeEntry): SaveResult {
    assertValidNewEntry(input);
    const local = this.entries();
    const id = `K${fnv1a(fingerprint(input)).toString(16).padStart(8, "0")}`;
    const base = this.mergeWithDisk(local);
    const existing = base.find((e) => e.id === id);
    if (existing) {
      this.cache = base;
      return { entry: existing, appended: false };
    }

    if (isLessonTagged(input.tags)) {
      return this.saveLessonIfImproved(input, id, base);
    }

    const entry: KnowledgeEntry = {
      ...input,
      tags: [...input.tags].sort(),
      id,
      savedAt: new Date().toISOString(),
    };
    const next = [...base, entry];
    this.writeStore(next);
    this.cache = next;
    return { entry, appended: true };
  }

  /**
   * Lesson write path (185-U1): gate on shouldPromoteLesson(prior.score,
   * incoming.score). Prior = same-id (already handled above) or same-title
   * lesson-tagged row in the same project. Append-only on promote; refuse
   * envelope on regression / unknown next score — never mutates prior rows.
   *
   * 209: human `lesson --accept` rows carry tags `accepted` + `actor:*`. The
   * human CLI flag IS the gate — do not re-block them on missing maker cards
   * (that made every accept a silent no-op: ok:true, appended:false, empty store).
   */
  private saveLessonIfImproved(
    input: NewKnowledgeEntry,
    id: string,
    base: KnowledgeEntry[],
  ): SaveResult {
    const humanAccepted =
      Array.isArray(input.tags) &&
      input.tags.includes("accepted") &&
      input.tags.some((t) => typeof t === "string" && t.startsWith("actor:"));

    const prior =
      base.find((e) => e.id === id) ??
      base.find(
        (e) =>
          e.project === input.project &&
          e.title === input.title &&
          isLessonTagged(e.tags),
      );
    const priorMaker = prior?.score;
    const nextMaker = input.score;
    if (!humanAccepted && !shouldPromoteLesson(priorMaker, nextMaker)) {
      // Candidate is built for the envelope only — never written.
      const candidate: KnowledgeEntry = {
        ...input,
        tags: [...input.tags].sort(),
        id,
        savedAt: new Date().toISOString(),
      };
      this.cache = base;
      return {
        entry: prior ?? candidate,
        appended: false,
        refused: true,
        reason: "eval-gated-regression",
        code: "RT_E_VALIDATION",
      };
    }

    const entry: KnowledgeEntry = {
      ...input,
      tags: [...input.tags].sort(),
      id,
      savedAt: new Date().toISOString(),
    };
    const next = [...base, entry];
    this.writeStore(next);
    this.cache = next;
    return { entry, appended: true };
  }

  private writeStore(entries: KnowledgeEntry[]): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    // K2 (W39): a UNIQUE staging name per writer (the checkpoint.module's A1-08
    // idiom). The fixed `${filePath}.tmp` let two writers — two KnowledgeStore
    // instances/processes saving the same file, which mergeWithDisk explicitly
    // supports — interleave on one staging path: writer A would rename B's
    // bytes (or B's rename would ENOENT and throw after a successful write).
    // rename is atomic, so the store is never torn either way; the staging
    // name is what was shared.
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      writeFileSync(tmp, JSON.stringify({ version: STORE_VERSION, entries }, null, 2), "utf8");
      renameSync(tmp, this.filePath);
    } catch (err) {
      try {
        if (existsSync(tmp)) unlinkSync(tmp);
      } catch {
        /* best-effort staging sweep */
      }
      throw err;
    }
  }

  /**
   * findPatterns — deterministic FusionRank-style lexical scoring (see the
   * HONEST LABEL in the header). Results are sorted by score desc, then title
   * asc, then id asc so equal scores never reorder between runs.
   *
   * Learning-loop read-time evaluation (fixes/98 §4.2/§6.2): an entry that a
   * newer row's `supersedes[]` declares dead, or that is retired after
   * LESSON_RETIRE_COUNTER (3) counter-evidence bumps, is excluded by default;
   * the opts include them for raw/audit reads. Surviving rows are weighted by
   * decay = 0.5 ** counterEvidence (halve per recurrence) — deterministic and
   * replayable, never a model's mood. Legacy stores (no supersedes /
   * counterEvidence fields) score byte-identically to the pre-loop behavior.
   */
  findPatterns(
    query: string,
    limit = 5,
    opts?: { includeSuperseded?: boolean; includeRetired?: boolean },
  ): KnowledgeMatch[] {
    // Fail closed on non-string callers (junk query rows, hostile code).
    if (typeof query !== "string") return [];
    const all = this.entries();
    const superseded = opts?.includeSuperseded ? new Set<string>() : this.supersededIds(all);
    const includeRetired = opts?.includeRetired === true;
    const entries = all.filter(
      (e) => !superseded.has(e.id) && (includeRetired || !this.isRetired(e)),
    );
    if (entries.length === 0) return [];

    const qTokens = [...new Set(tokenize(query))];
    if (qTokens.length === 0) return [];

    // Per-entry token index: title/tag tokens weigh more than body tokens.
    const indexed = entries.map((entry) => {
      const title = new Set(tokenize(entry.title));
      const tags = new Set(entry.tags.flatMap((t) => tokenize(t)));
      const body = new Set(tokenize(entry.body));
      return { entry, title, tags, body };
    });

    // Document frequency per query term over the whole store.
    const df = new Map<string, number>();
    for (const tok of qTokens) {
      let d = 0;
      for (const ix of indexed) {
        if (ix.title.has(tok) || ix.tags.has(tok) || ix.body.has(tok)) d += 1;
      }
      df.set(tok, d);
    }

    const n = indexed.length;
    let max = 0;
    const raws = indexed.map((ix) => {
      let raw = 0;
      for (const tok of qTokens) {
        const d = df.get(tok) ?? 0;
        if (d === 0) continue;
        const idf = Math.log(1 + n / (1 + d));
        const weight = ix.title.has(tok) ? 2 : ix.tags.has(tok) ? 1.5 : ix.body.has(tok) ? 1 : 0;
        raw += idf * weight;
      }
      if (raw > max) max = raw;
      return raw;
    });

    const matches: KnowledgeMatch[] = [];
    for (let i = 0; i < indexed.length; i += 1) {
      if (raws[i] === 0) continue;
      // Counter-evidence decay applied to the normalized score: halve per
      // recurrence. counterEvidence = 0/absent → factor 1 → byte-identical
      // to the legacy score (the pre-existing rounding survives).
      const decay = this.decayFactor(indexed[i].entry);
      const score = max > 0 ? Math.round((raws[i] / max) * 1000 * decay) / 1000 : 0;
      matches.push({ entry: indexed[i].entry, score });
    }
    matches.sort(
      (a, b) =>
        b.score - a.score !== 0
          ? b.score - a.score
          : a.entry.title !== b.entry.title
            ? a.entry.title < b.entry.title
              ? -1
              : 1
            : a.entry.id < b.entry.id
              ? -1
              : 1,
    );
    return matches.slice(0, Math.max(0, limit));
  }

  /**
   * injectProven — advisory research rows for a project drawn from OTHER
   * projects' stored entries (self-project rows are excluded so a project
   * never "researches" its own history). Purely advisory: rows are meant to
   * be surfaced to a human/agent for confirmation, never auto-applied.
   * Superseded and retired (3× counter-evidence) rows are excluded by
   * default, and surviving scores carry the counter-evidence decay — the
   * same read-time evaluation as findPatterns.
   */
  injectProven(
    project: string,
    opts?: {
      limit?: number;
      minScore?: number;
      includeSuperseded?: boolean;
      includeRetired?: boolean;
    },
  ): ProvenRow[] {
    const limit = opts?.limit ?? 3;
    const minScore = opts?.minScore ?? 0.12;
    return this.findPatterns(project, limit * 4, {
      includeSuperseded: opts?.includeSuperseded,
      includeRetired: opts?.includeRetired,
    })
      .filter((m) => m.entry.project !== project && m.score >= minScore)
      .slice(0, Math.max(0, limit))
      .map((m) => ({
        source: "knowledge-store" as const,
        entryId: m.entry.id,
        project: m.entry.project,
        title: m.entry.title,
        score: m.score,
        advice: `Reuse "${m.entry.title}" (stored from project "${m.entry.project}", score ${m.score}): ${oneLine(m.entry.body)}`,
      }));
  }

  // --- Learning-loop telemetry (fixes/98 §4.2) -----------------------------
  // Engine-owned, writer-only: these mutate TELEMETRY fields only — never
  // id/project/kind/title/tags/body/sourcePath/savedAt — so the append-only
  // law (header rule 1) survives. Callers log `lesson.decay` / `lesson.supersede`
  // BEFORE calling so the project ledger stays the audit trail. Merge-on-write
  // via readDisk keeps concurrent instances from clobbering fresh rows.

  /** Counter-evidence floor: 0/absent/NaN/junk read as 0 (decay factor 1). */
  private counterOf(e: KnowledgeEntry): number {
    const v = e.counterEvidence;
    return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  }

  /** Decay factor for retrieval weight: halve per counter-evidence unit. */
  private decayFactor(e: KnowledgeEntry): number {
    return Math.pow(0.5, this.counterOf(e));
  }

  /** Retired = the claim has been refuted enough times to stop trusting it. */
  private isRetired(e: KnowledgeEntry): boolean {
    return this.counterOf(e) >= LESSON_RETIRE_COUNTER;
  }

  /** Ids declared dead by ANY row's `supersedes[]` (append-only exclusion). */
  private supersededIds(entries: KnowledgeEntry[]): Set<string> {
    const out = new Set<string>();
    for (const e of entries) {
      if (Array.isArray(e.supersedes)) {
        for (const id of e.supersedes) if (typeof id === "string") out.add(id);
      }
    }
    return out;
  }

  /** Record one counter-evidence unit against an entry (writer-only
   *  telemetry). Returns the updated entry, or null when the id is unknown.
   *  Content fields are byte-identical; only `counterEvidence` changes. */
  bumpCounterEvidence(id: string): KnowledgeEntry | null {
    const disk = this.readDisk();
    const idx = disk.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const prev = disk[idx];
    const entry: KnowledgeEntry = { ...prev, counterEvidence: this.counterOf(prev) + 1 };
    const next = [...disk.slice(0, idx), entry, ...disk.slice(idx + 1)];
    this.writeStore(next);
    this.cache = next;
    return entry;
  }

  /** Append a superseding row id to an entry's `supersededBy` ledger (the
   *  mirror of the newer row's `supersedes[]`). Returns the updated entry,
   *  or null when the id is unknown. Content fields untouched. */
  markSuperseded(id: string, byId: string): KnowledgeEntry | null {
    const disk = this.readDisk();
    const idx = disk.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const prev = disk[idx];
    const supersededBy = Array.isArray(prev.supersededBy) ? [...prev.supersededBy] : [];
    if (!supersededBy.includes(byId)) supersededBy.push(byId);
    const entry: KnowledgeEntry = { ...prev, supersededBy };
    const next = [...disk.slice(0, idx), entry, ...disk.slice(idx + 1)];
    this.writeStore(next);
    this.cache = next;
    return entry;
  }
}

// ---------------------------------------------------------------------------
// M-tier lesson capture — the self-learning loop's project-local half
// (fixes/98 §2/§3). Relocated here from the spec's proposed NEW
// src/lib/lessons.ts: this lane's ownership partition is
// knowledge/vault/report-intake/harvest/prompt-engine (+ tests), so the pure
// lesson surface lives next to the K-tier store it promotes into. See
// fixes/101 §Spec corrections.
//
// Rules (98 §0): advisory only (rows inform, never gate); deterministic and
// keyless (the only LLM turns are other lanes' optional reflection/propose
// seams with deterministic floors); content-addressed ids so retries and
// regenerations can NEVER fork a row (H43-P2-1 avoided for lessons by
// construction); text capped at LESSON_TEXT_MAX (never unbounded notes,
// H43-P2-2).
// ---------------------------------------------------------------------------

/** Tag every lesson row carries; the single facet for selectLessons. */
export const LESSON_TAG = "lesson";
/** True when tags mark a KnowledgeStore / memory row as a lesson (185-U1). */
export function isLessonTagged(tags: readonly string[] | undefined): boolean {
  return Array.isArray(tags) && tags.includes(LESSON_TAG);
}
/** Hard cap on a lesson row's text (bounded prompt injection, H43-P2-2).
 *  322 X3 (BUG-2): 240 → 600. At 240 the cut severed exactly the payload the
 *  L2 row exists to carry (required-noun list + evidence hash; 322_e2_monitor
 *  §BUG-2 — every live row len==240 ending mid-phrase, vs a 440-char intended
 *  payload for the EXP03 shape). 600 is the house surface cap (engine.ts
 *  `clipSurface`, SURFACE_CAP) with the same explicit-ellipsis convention
 *  (≤ LESSON_TEXT_MAX + 1 chars emitted when a cut happens). */
export const LESSON_TEXT_MAX = 600;
/** Counter-evidence units before a K-tier row is retired (98 §6.2). */
export const LESSON_RETIRE_COUNTER = 3;

/** The five §9.3 lesson classes (98 §2.3). */
export type LessonLevel = "L1" | "L2" | "L3" | "L4" | "L5";

export type LessonSpec = {
  /** Stable short class tag: vague-brief | template-emission | verify-failure |
   *  verified-procedure | user-correction | drift. */
  classShort: string;
  level: LessonLevel;
  kind: MemoryEntry["kind"];
  phase: PhaseId;
  text: string;
  score: number;
  source: MemoryEntry["source"];
  tags?: string[];
  /** 216g (112 §4.2 — T1): the canonical failure signature the id hashes.
   *  When given, ONLY this string feeds `fnv8` — the volatile `text` tail stays
   *  human-readable and can no longer fork the row's identity. Absent → the
   *  legacy content-addressed `fnv8(text)`, so every pre-216g row keeps its id. */
  signature?: string;
};

/** 8-hex FNV-1a of a string (the K-id convention, minus the prefix). */
function fnv8(s: string): string {
  return fnv1a(s).toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// 216g (112 §4.1/§4.2 — T1): failure records + canonical signatures.
//
// THE DEFECT (112 §4.2, verified from this tree): every lesson id was
// `lesson-<class>-<fnv8(text)>`, and a fail row's `text` embeds the free-text
// evidence (a verify tail, the iteration count, the chunk index, the evidence
// hash). The SAME failure with a different tail therefore minted a NEW row
// every time it recurred — and each fork pushed an older lesson toward the
// 80-row FIFO eviction (engine.ts:1331).
//
// THE FIX: the id hashes a *canonical signature* — the stable part of the
// failure (kind · phase · RT_E class · sorted anchor ids), never the volatile
// prose. Anchors are ids that are already stable across runs: failing machine
// case ids, unmet DoD criterion ids, artifact/phase row ids. The volatile tail
// stays in the row TEXT (human-readable) but can no longer fork the identity.
// ---------------------------------------------------------------------------

/** 216g (112 §4.1): the failure classes a lesson record may carry. */
export type FailureKind =
  | "gate-unmet"
  | "verify-failed"
  | "synthesis-refused"
  | "rejected"
  | "harvest-degraded"
  | "drift";

/**
 * 216g (112 §4.1): the normalized failure record — the missing object between
 * the failure log and a lesson row. `signature` is derived (never stored): the
 * ONLY thing hashed into the row id (§4.2). `detailTail` is the volatile
 * human-readable tail: it rides the row TEXT and is excluded from the id
 * whenever anchors exist.
 */
export type FailureRecord = {
  kind: FailureKind;
  phase: PhaseId;
  /** RT_E_* code of the refusal / failure class (optional; in the signature). */
  classCode?: string | null;
  /** Stable ids the failure is anchored to — failing case ids | unmet
   *  criterion ids | artifact/phase row ids. ≥1 required by the §4.3 gate
   *  (failureLessonFromRecord), else `refuse:no-proof`. */
  anchors?: readonly string[];
  /** FNV-1a (or the machine-run's own) content hash over the judged artifact.
   *  Never part of the id (§4.3: the hash must not be the identity). */
  evidenceHash?: string | null;
  /** Volatile human-readable tail — stored as TEXT, never in the id. */
  detailTail?: string | null;
};

/**
 * 216g (112 §4.2 rule 1/2): canonical anchor id — lowercased, path → basename,
 * `:line(:col)` refs stripped. Ids stay ids: anything that is not a stable id
 * belongs in the tail, not here.
 */
function canonicalAnchor(anchor: unknown): string {
  if (typeof anchor !== "string") return "";
  let a = anchor.replace(/\s+/g, " ").trim().toLowerCase();
  if (!a) return "";
  const cut = Math.max(a.lastIndexOf("/"), a.lastIndexOf("\\"));
  if (cut >= 0) a = a.slice(cut + 1);
  a = a.replace(/(:\d+){1,2}$/, "");
  return a.trim();
}

/**
 * 216g (112 §4.2 rules 2/3/5): normalize free text for the anchor-less
 * signature fallback. Deterministic string ops only, no LLM: paths →
 * basenames, line/column refs and hex digests stripped, digit runs collapsed
 * to `<n>` ("after 3 iterations", "chunk 2/4" are process noise, not part of
 * the failure), lowercased, whitespace collapsed, capped at 200 chars.
 * HONEST LABEL: this is a normalization heuristic that keeps distinct
 * unanchored failures distinct while killing per-run noise — it is NOT a
 * semantic dedupe, and it never runs when anchors are present (they are the
 * counterexample; the tail is then excluded entirely).
 */
function canonicalText(text: unknown): string {
  if (typeof text !== "string") return "";
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/\s+/)) {
    let token = raw.replace(/^[^a-z0-9]+/, "").replace(/[^a-z0-9>]+$/, "");
    if (!token) continue;
    const cut = Math.max(token.lastIndexOf("/"), token.lastIndexOf("\\"));
    if (cut >= 0) token = token.slice(cut + 1);
    token = token.replace(/(:\d+){1,2}$/, "");
    if (/^[0-9a-f]{6,}$/.test(token)) {
      out.push("<hex>");
      continue;
    }
    token = token.replace(/([=:])([0-9a-f]{8,})(?=$|[^0-9a-z])/g, "$1<hex>");
    out.push(token.replace(/\d+/g, "<n>"));
  }
  return out.join(" ").slice(0, 200);
}

/**
 * 216g (112 §4.2 — T1): the deterministic failure signature. Same inputs →
 * same string, for any call order and any process:
 *
 *   `<kind>|p<phase>|<class-or-none>|anchors:<sorted,deduped ids>`
 *   `<kind>|p<phase>|<class-or-none>|tail:<normalized tail>`  (anchors absent)
 *
 * Anchors are sorted, de-duplicated and canonicalized (rule 1); the tail is
 * excluded whenever anchors exist (rule 4). Two runs that hit the same failure
 * therefore derive the same id and map to the SAME row instead of forking one.
 */
export function failureSignature(record: FailureRecord): string {
  const kind = typeof record?.kind === "string" ? record.kind.trim().toLowerCase() : "unknown";
  const phase = Number.isFinite(record?.phase) ? Math.max(0, Math.floor(record.phase)) : 0;
  const cls = typeof record?.classCode === "string" ? record.classCode.trim().toUpperCase() : "";
  const anchors: string[] = [];
  for (const a of Array.isArray(record?.anchors) ? record.anchors : []) {
    const c = canonicalAnchor(a);
    if (c && !anchors.includes(c)) anchors.push(c);
  }
  anchors.sort();
  const tail = anchors.length > 0 ? "" : canonicalText(record?.detailTail);
  return [
    kind,
    `p${phase}`,
    cls || "none",
    anchors.length > 0 ? `anchors:${anchors.join(",")}` : `tail:${tail}`,
  ].join("|");
}

/**
 * T-11 (106 §6, F-08): the probe ids a lesson row targets, surfaced as
 * explicit `probe:<id>` tags. The ids ARE the row's own failureSignature
 * anchors (DoD criterion ids / machine case ids / artifact row ids) — the same
 * canonical, sorted, deduped set the content address hashes (216g) — read
 * back off the signature string, so every existing and future writer inherits
 * the tags with NO caller change and NO re-minted row id (the id hashes the
 * signature, not the tag set). A contradiction between a lesson and the probe
 * it names is therefore visible ON the row instead of compounding silently;
 * an anchor-less signature (`tail:` fallback) names no probe and adds no tag.
 */
function probeTagsFromSignature(signature: string): string[] {
  const seg = signature.split("|").find((s) => s.startsWith("anchors:"));
  if (!seg) return [];
  const out: string[] = [];
  for (const raw of seg.slice("anchors:".length).split(",")) {
    const id = raw.trim();
    if (id) out.push(`probe:${id}`);
  }
  return out;
}

/**
 * 322 X3 (BUG-2): the house clip idiom (engine.ts `clipSurface`): collapse
 * whitespace; when the cap actually cut, append ONE explicit ellipsis so a
 * reader can never mistake a clipped row for a complete one (≤ LESSON_TEXT_MAX
 * + 1 chars emitted). Short texts pass through byte-identically.
 */
function clipLessonText(raw: string): string {
  const flat = raw.replace(/\s+/g, " ").trim();
  return flat.length > LESSON_TEXT_MAX ? `${flat.slice(0, LESSON_TEXT_MAX)}…` : flat;
}

/**
 * The one row builder every writer goes through. Deterministic: content-
 * addressed id `lesson-<class>-<fnv8(text)>` (identical text ⇒ identical id ⇒
 * dedupeMemoryIds is an exact no-op), tags sorted+deduped and always carrying
 * [LESSON_TAG, classShort, level], text collapsed to ≤ LESSON_TEXT_MAX (+1
 * when an explicit ellipsis marks a cut).
 *
 * 216g (112 §4.2 — T1): when `spec.signature` is given the id hashes THAT
 * instead of the text, so a recurrence of the same failure (same kind/phase/
 * anchors) maps to the same row even when its free-text tail differs.
 *
 * T-11 (106 §6, F-08): a signature that carries `anchors:` additionally tags
 * the row with one `probe:<id>` per anchor (probeTagsFromSignature) — the
 * probe ids the row targets. Tags never participate in the content address,
 * so this surfaces the probes WITHOUT re-minting a single existing row id.
 */
export function lessonRow(spec: LessonSpec): MemoryEntry {
  const text =
    typeof spec.text === "string" ? clipLessonText(spec.text) : "";
  const signature = typeof spec.signature === "string" ? spec.signature.trim() : "";
  const raw = [
    LESSON_TAG,
    spec.classShort,
    spec.level,
    ...(Array.isArray(spec.tags) ? spec.tags : []),
    // T-11 half 2 (217l, F1 from 217b): the probe ids the signature's anchors
    // name, surfaced ON the row. Tags never participate in the content address
    // (the id hashes the signature), so no row id is ever re-minted; an
    // anchor-less `tail:` signature adds nothing (probeTagsFromSignature).
    ...probeTagsFromSignature(signature),
  ];
  const tags: string[] = [];
  for (const t of raw) {
    if (typeof t !== "string") continue;
    const clean = t.trim();
    if (!clean || tags.includes(clean)) continue;
    tags.push(clean);
  }
  tags.sort();
  return {
    id: `lesson-${spec.classShort}-${fnv8(signature || text)}`,
    kind: spec.kind,
    phase: spec.phase,
    text,
    score: Number.isFinite(spec.score) ? spec.score : 0.5,
    source: spec.source,
    tags,
  };
}

/**
 * Deterministic lesson-evidence digest (fixes/144 M5-1, shared helper half):
 * a single-line `unmet: <criteria verbatim, ", "-joined> · class: <RT_E
 * code> · tail: <first 300 chars>` record of WHAT was missing, not just THAT
 * something failed (fixes/99 finding). Optional segments are omitted when
 * absent; the tail is whitespace-collapsed and capped at 300 chars.
 *
 * BYTE-PARITY CONTRACT: engine.ts's private inline lessonEvidenceDetail
 * (engine.ts L1149-1163, the engine-half L2 mint) implements the SAME spec —
 * identical inputs must produce identical bytes here, so engine-minted and
 * driver-minted L2 rows converge and a later engine wave can drop its inline
 * copy for this export (extend the lazy LessonSurface seam) with no output
 * change. Null-tolerant params mirror the engine call site
 * (refusal?.code ?? null).
 */
export function lessonEvidenceDetail(
  unmet: readonly string[],
  refusalClass?: string | null,
  tail?: string | null,
): string {
  const u = (Array.isArray(unmet) ? unmet : [])
    .filter((c): c is string => typeof c === "string" && c.trim() !== "")
    .map((c) => c.trim());
  const parts: string[] = [`unmet: ${u.join(", ")}`];
  const cls = typeof refusalClass === "string" ? refusalClass.trim() : "";
  if (cls) parts.push(`class: ${cls}`);
  const t = typeof tail === "string" ? tail.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  if (t) parts.push(`tail: ${t}`);
  return parts.join(" · ");
}

/**
 * Ranked lesson selection for injection (98 §5): rows tagged LESSON_TAG,
 * optionally class-filtered, phase-matched first — when NO row matches the
 * requested phase, the pool falls back to all eligible lesson rows
 * (phase-agnostic) so a class-tagged trigger can never be silenced by a
 * phase mismatch. Tiebreak: score desc, id asc (findPatterns convention),
 * then capped at `limit`. Deterministic; junk input yields [].
 */
export function selectLessons(
  memory: readonly MemoryEntry[],
  phase: PhaseId,
  limit = 2,
  onlyClass?: readonly string[],
): MemoryEntry[] {
  const rows = (Array.isArray(memory) ? memory : []).filter(
    (m): m is MemoryEntry =>
      !!m && typeof m === "object" && Array.isArray(m.tags) && m.tags.includes(LESSON_TAG),
  );
  if (rows.length === 0) return [];
  const classes = onlyClass === undefined ? null : new Set(onlyClass);
  const eligible = rows.filter((m) =>
    classes === null ? true : (m.tags ?? []).some((t) => classes.has(t)),
  );
  const phaseRows = eligible.filter((m) => m.phase === phase);
  const pool = phaseRows.length > 0 ? phaseRows : eligible;
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return [...pool]
    .sort((a, b) => (b.score - a.score !== 0 ? b.score - a.score : a.id < b.id ? -1 : 1))
    .slice(0, cap);
}

/**
 * C: eval-gated promotion. A lesson may be written into the live read-back
 * pool only when the new maker card is a number AND did not regress vs prior.
 * Missing scores → refuse (never promote on unknown).
 */
export function shouldPromoteLesson(priorMaker: unknown, nextMaker: unknown): boolean {
  const prior = typeof priorMaker === "number" && Number.isFinite(priorMaker) ? priorMaker : null;
  const next = typeof nextMaker === "number" && Number.isFinite(nextMaker) ? nextMaker : null;
  if (next === null) return false;
  if (prior === null) return true;
  return next >= prior;
}

const ABSENT_NOUN_STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "these", "those", "from", "into",
  "your", "our", "their", "build", "app", "tool", "using", "should", "must",
  "will", "have", "has", "need", "needs", "want", "wants", "like", "also",
]);

/**
 * Best-effort deterministic noun detector for the L1 row: brief word tokens
 * that appear in NEITHER the lattice's jobs/entities NOR any node label.
 * HONEST LABEL: the engine's private LEX-hit ledger (algorithms.ts) is the
 * ground truth for "0 LEX hits" — this is a lattice-derived approximation
 * for lanes that cannot import it; callers with real hit data should pass
 * those nouns into vagueBriefLesson instead. Capped at 5, deterministic.
 */
export function absentLexNouns(brief: string, lattice: IntentLattice | null): string[] {
  const vocab = new Set<string>();
  if (lattice && typeof lattice === "object") {
    for (const field of [lattice.jobs, lattice.entities]) {
      for (const v of Array.isArray(field) ? field : []) {
        for (const t of tokenizeWords(String(v))) vocab.add(t);
      }
    }
    for (const n of Array.isArray(lattice.nodes) ? lattice.nodes : []) {
      if (n && typeof n === "object" && typeof n.label === "string") {
        for (const t of tokenizeWords(n.label)) vocab.add(t);
      }
    }
  }
  const out: string[] = [];
  for (const t of tokenizeWords(typeof brief === "string" ? brief : "")) {
    if (t.length < 3 || ABSENT_NOUN_STOPWORDS.has(t)) continue;
    if (vocab.has(t) || out.includes(t)) continue;
    out.push(t);
    if (out.length >= 5) break;
  }
  return out;
}

/** L1 — vague-brief (98 §2.3): the P0 lattice fell back on its demo domain.
 *  Engine-detectable ⇒ factual. Phase 0, semantic, score 0.7, source "engine". */
export function vagueBriefLesson(
  project: Project,
  absentNouns: readonly string[] = [],
): MemoryEntry {
  const lattice = project.lattice ?? null;
  const jobs = lattice && Array.isArray(lattice.jobs) ? lattice.jobs : [];
  const entities = lattice && Array.isArray(lattice.entities) ? lattice.entities : [];
  const domain =
    lattice && typeof lattice.domain === "string" && lattice.domain.trim()
      ? lattice.domain
      : jobs[0] ?? "unknown";
  const nouns = (Array.isArray(absentNouns) ? absentNouns : [])
    .filter((n): n is string => typeof n === "string" && n.trim() !== "")
    .map((n) => n.trim())
    .slice(0, 3);
  const text =
    `L1 vague-brief: lattice fell back to jobs=[${jobs.join(",")}] entities=[${entities.join(",")}]; ` +
    `brief vocabulary had 0 LEX hits (top absent nouns: ${nouns.length ? nouns.join(", ") : "none computed"}); ` +
    `fallback domain ${domain}. Tighten brief or extend LEX.`;
  return lessonRow({
    classShort: "vague-brief",
    level: "L1",
    kind: "semantic",
    phase: 0,
    text,
    score: 0.7,
    source: "engine",
  });
}

/**
 * 322 X3 (BUG-3): the union-tree brief-noun census for the L2 row — runs the
 * SAME measurement the p6-brief-fit DoD probe runs (dod.ts:630-648): required
 * brief nouns vs identifierHits over the union of the barrel `generatedSource`
 * plus every `generatedTree` file. Returns null when there is no brief or no
 * emitted artifact to measure — the row then says so instead of any hit claim.
 * Pre-fix the row printed a literal "0 hits … none computed" on every live P6
 * refusal while the sealed trees measured 6/22 (EXP01) and 7/18 (EXP02) — it
 * misinformed about the red's cause (322_e2_monitor §BUG-3). Pure.
 */
function briefCensusOf(
  project: Project,
): { hits: number; required: number; missing: string[] } | null {
  const brief = typeof project.brief === "string" ? project.brief : "";
  if (!brief.trim()) return null;
  const tree = Array.isArray(project.generatedTree) ? project.generatedTree : [];
  const source =
    tree.length > 0
      ? [
          project.generatedSource ?? "",
          ...tree.map((f) => (f && typeof f.source === "string" ? f.source : "")),
        ].join("\n")
      : project.generatedSource ?? "";
  if (!source) return null;
  const { required } = briefNounHits(brief);
  if (required.length === 0) return null;
  const hits = identifierHits(required, source);
  return {
    hits: hits.length,
    required: required.length,
    missing: required.filter((t) => !hits.includes(t)),
  };
}

/** L2 — template-emission (98 §2.3): a phase sealed with the gate unmet.
 *  Engine-detectable ⇒ factual. `evidenceHash` defaults to a deterministic
 *  content hash; pass the machine gate's hash when the caller has it.
 *  `source` mirrors M-08's E-18 provenance stamp: the engine seal path passes
 *  nothing (defaults "engine"); the agent-report path (98 §3 writer 2(a),
 *  report-intake.ts E-16 site) passes "agent-report" — same content-addressed
 *  id either way, so both writers stay idempotent (98 §3 anti-noise (b)).
 *  322 X3 (BUG-3): the text carries the real union-tree brief-noun census when
 *  the project holds an emitted artifact (`briefCensusOf`) — never a literal
 *  "0 hits" claim from an unmeasured surface; `nouns` callers supply the 0-hit
 *  list explicitly. */
export function templateEmissionLesson(
  project: Project,
  phase: PhaseId,
  unmet: readonly string[],
  nouns: readonly string[] = [],
  evidenceHash?: string,
  source: MemoryEntry["source"] = "engine",
): MemoryEntry {
  const ids = (Array.isArray(unmet) ? unmet : [])
    .filter((u): u is string => typeof u === "string" && u.trim() !== "")
    .map((u) => u.trim())
    .slice(0, 6);
  const nounList = (Array.isArray(nouns) ? nouns : [])
    .filter((n): n is string => typeof n === "string" && n.trim() !== "")
    .map((n) => n.trim())
    .slice(0, 5);
  // 322 X3 (BUG-3): never print a hit claim that was not measured. With an
  // emitted artifact present, state the real union-tree census (hits/total +
  // the 0-hit nouns — caller-supplied nouns win as the 0-hit list); without
  // one, say so. The pre-fix "0 hits … none computed" text read as "zero hits"
  // on rows whose sealed trees measured 6/22 and 7/18 (322_e2_monitor §BUG-3).
  const census = briefCensusOf(project);
  const missingText = nounList.length
    ? nounList.join(", ")
    : census && census.missing.length > 0
      ? census.missing.slice(0, 5).join(", ") + (census.missing.length > 5 ? ", …" : "")
      : "none";
  const nounText = census
    ? `required brief nouns present as identifiers in emitted source: ${census.hits}/${census.required} (0 hits: ${missingText})`
    : nounList.length
      ? `required brief nouns with 0 hits in emitted source: ${nounList.join(", ")}`
      : `required brief noun hit census not computed (no emitted artifact on this project)`;
  const hash =
    typeof evidenceHash === "string" && evidenceHash.trim()
      ? evidenceHash.trim().slice(0, 16)
      : fnv8(`${project.brief}:${phase}:${ids.join(",")}:${nounText}`);
  const text =
    `L2 template-emission: phase P${phase} sealed with gate unmet (${ids.join(", ") || "unknown"}); ` +
    `${nounText}; evidenceHash=${hash}.`;
  // 216g (112 §4.2 — T1): signature = (phase, sorted unmet criterion ids). The
  // noun list and the evidence hash are process noise and stay in the text —
  // re-sealing the same unmet gate can no longer fork a row per emission.
  const signature = failureSignature({ kind: "gate-unmet", phase, anchors: ids });
  return lessonRow({
    classShort: "template-emission",
    level: "L2",
    kind: "episodic",
    phase,
    text,
    score: 0.7,
    source,
    signature,
  });
}

/** L3 — verify-failure (98 §2.3). The optional `hypothesis` is model prose
 *  (Reflexion turn) and is stored ONLY behind the literal `| hypothesis:`
 *  marker — honest labeling, never as fact (98 §2.3 rule). Evidence detail is
 *  clipped to 140 chars inside the LESSON_TEXT_MAX row budget.
 *
 *  216g (112 T1/T2): the optional `proof` carries the record's stable anchors
 *  (failing machine-case ids) and the RT_E class code. With anchors the id
 *  hashes ONLY (kind · phase · class · anchors) — the free-text tail can no
 *  longer fork the row. Without them the id falls back to the normalized tail
 *  (numbers/hex refs collapsed), so the per-run iteration count and the
 *  `evidenceHash=` suffix stop minting a new row each recurrence. The §4.3
 *  gate that REFUSES an anchor-less fail lesson lives in
 *  `failureLessonFromRecord`. */
export function verifyFailureLesson(
  project: Project,
  phase: PhaseId,
  evidence: string,
  iterations: number,
  hypothesis?: string,
  proof?: { anchors?: readonly string[]; classCode?: string | null } | null,
): MemoryEntry {
  const ev = (typeof evidence === "string" ? evidence : "").replace(/\s+/g, " ").trim().slice(0, 140);
  const n = Number.isFinite(iterations) ? Math.max(0, Math.floor(iterations)) : 0;
  const hash = fnv8(typeof evidence === "string" ? evidence : "");
  const hyp =
    typeof hypothesis === "string" && hypothesis.trim()
      ? ` | hypothesis: ${hypothesis.replace(/\s+/g, " ").trim().slice(0, 120)}`
      : "";
  const text =
    `L3 verify-failure: machine-run cases failing after ${n} iteration(s): ` +
    `${ev || "evidence absent"}; evidenceHash=${hash}.${hyp}`;
  const signature = failureSignature({
    kind: "verify-failed",
    phase,
    classCode: proof?.classCode,
    anchors: proof?.anchors,
    detailTail: evidence,
  });
  return lessonRow({
    classShort: "verify-failure",
    level: "L3",
    kind: "episodic",
    phase,
    text,
    score: 0.7,
    source: "engine",
    signature,
  });
}

/** L4 — verified-procedure (98 §2.3, Voyager commit-on-verify): a machine-run
 *  verify pass that PASSED. First lesson-derived `procedural` writer. No LLM. */
export function verifiedProcedureLesson(
  project: Project,
  phase: PhaseId,
  evidence: string,
): MemoryEntry {
  const ev = (typeof evidence === "string" ? evidence : "").replace(/\s+/g, " ").trim().slice(0, 140);
  const hash = fnv8(typeof evidence === "string" ? evidence : "");
  const text =
    `L4 verified-procedure: P${phase} verify passed — ${ev || "evidence absent"}; ` +
    `evidenceHash=${hash}. Reuse this module shape next run.`;
  return lessonRow({
    classShort: "verified-procedure",
    level: "L4",
    kind: "procedural",
    phase,
    text,
    score: 0.8,
    source: "engine",
  });
}

/** L5 — user-correction (98 §2.3, approval→guardrail): a HITL decision row
 *  minted by a human. The decision TITLE is the best available gate
 *  identifier on the row (HitlDecision carries no gate id). A missing note —
 *  the 86/87/88 null-note anti-pattern — is itself the flagged lesson and
 *  gets the extra `null-note` tag so the record cannot repeat silently. */
export function correctionLesson(project: Project, decision: HitlDecision): MemoryEntry {
  const note = typeof decision.note === "string" ? decision.note.replace(/\s+/g, " ").trim() : "";
  const gate = String(decision.title ?? "gate")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  const text =
    `L5 user-correction: gate ${gate} on P${decision.phase} decided ${decision.decision}` +
    ` note="${note.slice(0, 200) || "(none — null-note override flagged)"}"; decision row ${decision.id}.`;
  return lessonRow({
    classShort: "user-correction",
    level: "L5",
    kind: "semantic",
    phase: decision.phase,
    text,
    score: 0.8,
    source: "human",
    tags: [`gate:${gate}`, ...(note ? [] : ["null-note"])],
  });
}

/** Drift rows (98 §2.3): a later phase touched an earlier phase's files and
 *  the evidence hash changed (E-19 verifyPriorPhases). Episodic, score 0.6,
 *  never auto-promoted. */
export function driftLesson(
  project: Project,
  laterPhase: PhaseId,
  earlierPhase: PhaseId,
  oldHash: string,
  newHash: string,
  unmetNow: readonly string[],
): MemoryEntry {
  const ids = (Array.isArray(unmetNow) ? unmetNow : [])
    .filter((u): u is string => typeof u === "string" && u.trim() !== "")
    .map((u) => u.trim())
    .slice(0, 6);
  const text =
    `L2-style drift: phase P${laterPhase} touched files of P${earlierPhase}; ` +
    `evidence hash changed ${String(oldHash).slice(0, 8)}->${String(newHash).slice(0, 8)}; ` +
    `unmetNow=${ids.join(", ") || "none"}.`;
  // 216g (112 §4.2 — T1): signature = (later phase, earlier phase, unmet ids).
  // The old→new hash pair is per-detection noise and stays in the text.
  const signature = failureSignature({
    kind: "drift",
    phase: laterPhase,
    anchors: [...ids, `earlier:P${earlierPhase}`],
  });
  return lessonRow({
    classShort: "drift",
    level: "L2",
    kind: "episodic",
    phase: laterPhase,
    text,
    score: 0.6,
    source: "engine",
    signature,
  });
}

/**
 * 216g (112 §4.3 — T2): the counterexample-or-nothing outcome. Either the row
 * (plus the signature its id hashed) or a REFUSAL that must be recorded — never
 * a silent no-op: `log` is the exact ledger payload the caller appends via
 * lessonLog().
 */
export type FailureLessonOutcome =
  | { verdict: "fail:deterministic"; refused: false; lesson: MemoryEntry; signature: string }
  | {
      verdict: "refuse:no-proof";
      refused: true;
      lesson: null;
      signature: string;
      reason: string;
      code: ErrorCode;
      log: { level: JsonLog["level"]; event: "lesson.refused"; detail: string };
    };

/**
 * 216g (112 §4.3/§4.2 — T2): "a lesson without a counterexample is not a
 * lesson". A fail record is minted ONLY when it carries ≥1 anchor — a failing
 * machine-case id, an unmet DoD criterion id, or an artifact/phase row id — the
 * execution feedback the failure is actually tied to. No anchor ⇒
 * `refuse:no-proof` (the §2.2 rung-6 honest floor), NO row is built, and the
 * caller gets a `lesson.refused` ledger payload to append with lessonLog(): the
 * refusal is recorded, never dropped. A kind with no builder in this module
 * (harvest / synthesis / rejection rows are minted by their owning writers) is
 * refused with the same visible envelope and a reason naming the gap.
 *
 * The row comes from the SAME builder a direct caller uses, with the anchors
 * threaded through as `proof` — so the record path and the direct path derive
 * ONE id (98 §3 anti-noise (b)), never two rows for one failure.
 *
 * HONESTY INVARIANT (112 §3.4 P1, preserved): this mints PROJECT-MEMORY rows
 * only. The permanent KnowledgeStore stays append-only with NO machine writer —
 * the human `lesson --accept` path (rapidtool-cli.mjs:1681-1683) remains its
 * only writer.
 */
export function failureLessonFromRecord(
  record: FailureRecord,
  opts?: { project?: Project | null; iterations?: number; hypothesis?: string },
): FailureLessonOutcome {
  const anchors: string[] = [];
  for (const a of Array.isArray(record?.anchors) ? record.anchors : []) {
    const clean = typeof a === "string" ? a.trim() : "";
    if (clean !== "" && !anchors.includes(clean)) anchors.push(clean);
  }
  const signature = failureSignature(record);
  const kind = typeof record?.kind === "string" ? record.kind : "unknown";
  const phase = (Number.isFinite(record?.phase) ? Math.max(0, Math.floor(record.phase)) : 0) as PhaseId;
  const refuse = (reason: string): FailureLessonOutcome => ({
    verdict: "refuse:no-proof",
    refused: true,
    lesson: null,
    signature,
    reason,
    code: "RT_E_VALIDATION",
    log: {
      level: "warn",
      event: "lesson.refused",
      detail: `refuse:no-proof — ${kind} P${phase}: ${reason}`,
    },
  });
  if (anchors.length === 0) {
    return refuse(
      "no anchor: a fail lesson requires ≥1 failing case id, unmet criterion id, or artifact row id (112 §4.3)",
    );
  }
  if (kind === "verify-failed") {
    return {
      verdict: "fail:deterministic",
      refused: false,
      signature,
      lesson: verifyFailureLesson(
        undefined as unknown as Project,
        phase,
        typeof record.detailTail === "string" ? record.detailTail : "",
        opts?.iterations ?? 0,
        opts?.hypothesis,
        { anchors, classCode: record.classCode },
      ),
    };
  }
  if (kind === "gate-unmet") {
    const project = opts?.project ?? null;
    if (!project) {
      // The builder's fallback evidence hash binds the project's brief — a
      // record without the project cannot mint the same row a direct caller
      // would, so it refuses rather than invent a different one.
      return refuse(
        "gate-unmet needs opts.project: templateEmissionLesson binds the brief into its fallback evidence hash",
      );
    }
    return {
      verdict: "fail:deterministic",
      refused: false,
      signature,
      lesson: templateEmissionLesson(
        project,
        phase,
        anchors,
        [],
        typeof record.evidenceHash === "string" ? record.evidenceHash : undefined,
      ),
    };
  }
  return refuse(
    `no builder registered in knowledge.ts for kind '${kind}' — its owning writer must mint the row`,
  );
}

/** Pressure predicate (98 §4.2): memory at/over `threshold` rows means the
 *  80-row FIFO is about to evict — the consolidation trigger. */
export function pressureAt(memory: readonly MemoryEntry[], threshold = 60): boolean {
  return (Array.isArray(memory) ? memory.length : 0) >= Math.max(0, Math.floor(threshold));
}

/** Thin ledger alias (98 §3): append one JsonLog row (wildLog pattern, capped
 *  at 200) and return the new project. Callers log BEFORE mutating stores so
 *  the ledger is the audit trail for every lesson write. */
export function lessonLog(
  p: Project,
  phase: PhaseId,
  level: JsonLog["level"],
  event: string,
  detail: string,
): Project {
  const logs = [...p.logs];
  logs.push({ ts: Date.now(), phase, level, event, detail });
  return { ...p, logs: logs.slice(-200) };
}

// ---------------------------------------------------------------------------
// F3 (221 §F3 — W18 lane 2): cross-run learning MEASUREMENT.
//
// 219d hop 6 ("next run behaves differently") had a mechanism with no
// measurement: rows accrue a `reproducedCount` when the same failure signature
// recurs (engine.accrueReproducedCounts, report-intake.ts's twin accrual, and
// verify.ts's repro-accrual), and NOTHING read the counter — selectLessons
// ranks on static score. This block is that measurement, and only that: a
// pure, read-only census of lesson-tagged memory rows plus their post-minting
// recurrence telemetry.
//
// HONESTY FLOORS (221 §F3 "Honesty constraints it MUST satisfy"):
//   (a) recurrence ≠ causation — LESSON_OUTCOME_LABEL rides INSIDE the object;
//   (b) no rate claim below n=2 targets — `claim` says "baseline only"
//       (echoing m7Learning's "no learning claim without data");
//   (c) read-only by construction — pure function, no writer, no store, no log;
//   (d) the census window (the engine's 80-row memory FIFO) is disclosed so a
//       rate is never read as all-time;
//   (e) never presented as an eval score — M1–M9 stay the scorecard.
// T-11 stays MUTED here: this block reads rows, it never mints one. A red
// seal's `p*.seal.unmet` log is not lesson-tagged, so it cannot appear in this
// census — the mute is structural, not a flag.
// ---------------------------------------------------------------------------

/** F3 (constraint a): the honest label that rides inside every report — a bare
 *  rate would read as proof the lesson was followed. */
export const LESSON_OUTCOME_LABEL =
  "recurrence after minting — not proof the lesson was followed (recurrence ≠ causation)";

/** F3 (constraint b): the n≥2 floor — below it the report says "baseline
 *  only"; a single target is an anecdote, not a rate (mirrors maker-score.ts
 *  m7Learning's "no learning claim without data"). */
export const LESSON_OUTCOME_MIN_N = 2;

/** F3 (constraint d): the engine's memory FIFO cap (`…slice(0, 80)`,
 *  engine.ts's applyPhaseResult merge) — disclosed in `censusWindow` so a rate
 *  is never read as all-time. */
export const LESSON_CENSUS_CAP = 80;

/**
 * F3: the classShort tag of ONE lesson row — ONE classifier shared by
 * `lesson --list`'s `class` field and this report's `perClass` grouping.
 * Skips the lesson marker, the L1–L5 level, `accepted`, and the machine
 * telemetry tag families (`probe:` from T-11's probe tags, `actor:` from the
 * human-gated accept). Without those two skips the classifier reports a PROBE
 * tag as the class on any probe-tagged row — observed on disk: the keyed W16
 * record's `lesson --list` printed `class: "probe:p6-brief-fit"` for a
 * template-emission row. Null when no class tag is present (junk tolerated).
 */
export function lessonClassTag(tags: readonly string[] | undefined): string | null {
  if (!Array.isArray(tags)) return null;
  const found = tags.find(
    (t): t is string =>
      typeof t === "string" &&
      t.trim() !== "" &&
      t !== LESSON_TAG &&
      !/^L[1-5]$/.test(t) &&
      t !== "accepted" &&
      !t.startsWith("probe:") &&
      !t.startsWith("actor:"),
  );
  return found ? found.trim() : null;
}

/** F3: one lesson target's outcome row — the per-row evidence behind the rate. */
export type LessonOutcomeEvidence = {
  id: string;
  /** classShort tag (lessonClassTag); null on a row with no class tag. */
  class: string | null;
  /** L1–L5 tag when present, else null. */
  level: string | null;
  phase: PhaseId;
  /** The `probe:<id>` tags the row targets, verbatim and sorted. */
  probes: string[];
  /** Live telemetry read off the row: absent/NaN reads 0, never fabricated. */
  reproducedCount: number;
  /** `reproducedCount > 0` — a recurrence was recorded after minting. */
  reproduced: boolean;
  /** The `lesson.reproduced` ledger details that accrued this row's counter,
   *  read from `opts.logs` when supplied (the real write sites: verify.ts's
   *  repro-accrual and report-intake.ts's twin accrual); [] when no log
   *  matched or no logs were supplied — never synthesized. */
  ledgerRows: string[];
  /** One-line digest: id · reproducedCount=N (recurred N× | no recurrence) · probes. */
  evidence: string;
};

/** F3: one lesson class's outcome aggregate. */
export type LessonOutcomeClass = {
  class: string;
  total: number;
  reproduced: number;
  unreproduced: number;
  /** reproduced / total (a class exists only with ≥1 row, so never null). */
  recurrenceRate: number;
};

/** F3: the read-only cross-run learning measurement (221 §F3 step A). */
export type LessonOutcomeReport = {
  label: string;
  readOnly: true;
  measurement: string;
  /** The memory census the report was computed over — totalRows is the whole
   *  memory (the FIFO's unit), lessonRows the lesson-tagged subset. */
  censusWindow: { totalRows: number; lessonRows: number; cap: number; atCap: boolean };
  total: number;
  reproduced: number;
  unreproduced: number;
  /** reproduced / total, or null when there are no rows — never a fabricated 0. */
  recurrenceRate: number | null;
  perClass: LessonOutcomeClass[];
  evidence: LessonOutcomeEvidence[];
  /** total ≥ LESSON_OUTCOME_MIN_N. */
  sufficientSample: boolean;
  /** The n-floor verdict; carries "baseline only" below the floor. */
  claim: string;
  /** What this is not, verbatim — so a JSON consumer cannot misread it. */
  note: string;
};

/**
 * F3 (221 §F3 step A): the cross-run learning measurement. Reads ONLY
 * lesson-tagged memory rows (plus, optionally, the project's own ledger rows to
 * attribute the accruals) and returns the recurrence census:
 *
 *   total / reproduced / unreproduced + recurrenceRate (reproduced ÷ total),
 *   perClass[] (grouped by classShort), evidence[] (id · probe:<id> tags ·
 *   reproducedCount · the `lesson.reproduced` ledger details that accrued it),
 *   and the disclosed censusWindow the rows were read from.
 *
 * Pure and deterministic: same inputs → same report; nothing is written, no
 * row is minted, ranked, promoted or demoted; junk input is tolerated (junk
 * rows are not lesson-tagged and are counted only in totalRows). Ordering is
 * id-asc in evidence[] and class-asc in perClass[] (the house tiebreak).
 */
export function lessonOutcomeReport(
  memory: readonly MemoryEntry[],
  opts?: { logs?: readonly JsonLog[] },
): LessonOutcomeReport {
  const mem: readonly unknown[] = Array.isArray(memory) ? memory : [];
  const rows = mem.filter(
    (m): m is MemoryEntry =>
      !!m &&
      typeof m === "object" &&
      typeof (m as MemoryEntry).id === "string" &&
      Array.isArray((m as MemoryEntry).tags) &&
      ((m as MemoryEntry).tags as readonly string[]).includes(LESSON_TAG),
  );
  const logs = Array.isArray(opts?.logs) ? opts.logs : [];
  const evidence: LessonOutcomeEvidence[] = rows
    .map((m) => {
      const tags = (Array.isArray(m.tags) ? m.tags : []).filter((t): t is string => typeof t === "string");
      const probes = tags.filter((t) => t.startsWith("probe:")).sort();
      const level = tags.find((t) => /^L[1-5]$/.test(t)) ?? null;
      const count = Number.isFinite(m.reproducedCount)
        ? Math.max(0, Math.floor(m.reproducedCount as number))
        : 0;
      const ledgerRows = logs
        .filter(
          (l) =>
            !!l &&
            typeof l === "object" &&
            l.event === "lesson.reproduced" &&
            typeof l.detail === "string" &&
            l.detail.includes(m.id),
        )
        .map((l) => l.detail);
      const outcome = count > 0 ? `recurred ${count}× after minting` : "no recurrence recorded after minting";
      const probeText = probes.length > 0 ? `probes: ${probes.join(", ")}` : "no probe ids";
      return {
        id: m.id,
        class: lessonClassTag(tags),
        level,
        phase: (Number.isFinite(m.phase) ? Math.max(0, Math.floor(m.phase)) : 0) as PhaseId,
        probes,
        reproducedCount: count,
        reproduced: count > 0,
        ledgerRows,
        evidence: `${m.id} · reproducedCount=${count} (${outcome}) · ${probeText}`,
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byClass = new Map<string, { total: number; reproduced: number }>();
  for (const e of evidence) {
    const key = e.class ?? "unclassed";
    const agg = byClass.get(key) ?? { total: 0, reproduced: 0 };
    agg.total += 1;
    if (e.reproduced) agg.reproduced += 1;
    byClass.set(key, agg);
  }
  const perClass: LessonOutcomeClass[] = [...byClass.entries()]
    .map(([cls, a]) => ({
      class: cls,
      total: a.total,
      reproduced: a.reproduced,
      unreproduced: a.total - a.reproduced,
      recurrenceRate: a.reproduced / a.total,
    }))
    .sort((a, b) => (a.class < b.class ? -1 : a.class > b.class ? 1 : 0));
  const total = evidence.length;
  const reproduced = evidence.filter((e) => e.reproduced).length;
  const unreproduced = total - reproduced;
  const sufficientSample = total >= LESSON_OUTCOME_MIN_N;
  const claim =
    total === 0
      ? "no lesson targets in this record — nothing measured (baseline only)"
      : total === 1
        ? "insufficient runs — baseline only (1 lesson target observed; a recurrence rate needs n≥2)"
        : `${reproduced}/${total} lesson targets recurred after minting (n=${total}) — recurrence ≠ causation`;
  const atCap = mem.length >= LESSON_CENSUS_CAP;
  const note = [
    "read-only measurement — nothing was written",
    "not an eval score (M1–M9 stay the scorecard)",
    "a 0 rate means no recurrence was RECORDED in this census window (absence of evidence is not evidence of absence)",
    atCap
      ? `the census window is at its ${LESSON_CENSUS_CAP}-row cap — older rows may already have been evicted (FIFO), so read the rate as windowed, never all-time`
      : `census window below the ${LESSON_CENSUS_CAP}-row cap`,
    "T-11 stays muted: a red seal mints no lesson row, so it cannot appear in this census",
  ].join("; ");
  return {
    label: LESSON_OUTCOME_LABEL,
    readOnly: true,
    measurement: "cross-run learning — recurrence of a lesson's target after minting",
    censusWindow: { totalRows: mem.length, lessonRows: rows.length, cap: LESSON_CENSUS_CAP, atCap },
    total,
    reproduced,
    unreproduced,
    recurrenceRate: total === 0 ? null : reproduced / total,
    perClass,
    evidence,
    sufficientSample,
    claim,
    note,
  };
}

// ---------------------------------------------------------------------------
// Human correction path — pure helpers behind the `lesson` verb family
// (98 §7). The CLI/headless wiring is the integration lane's; these are the
// deterministic cores with honest floors (no fabricated proposals).
// ---------------------------------------------------------------------------

/** `lesson add` core: a manual M-row (source "human", content-addressed). */
export function manualLesson(spec: Omit<LessonSpec, "source">): MemoryEntry {
  return lessonRow({ ...spec, source: "human" });
}

/** `lesson dismiss` core: drop one row id from project memory (mutable
 *  per-project data — append-only applies to the knowledge STORE, not to
 *  project.memory, 98 §7). Returns the filtered rows; the caller writes them
 *  back and logs `lesson.dismiss`. */
export function dismissLessonRows(
  memory: readonly MemoryEntry[],
  id: string,
): MemoryEntry[] {
  return (Array.isArray(memory) ? memory : []).filter((m) => m.id !== id);
}

/** `lesson propose` deterministic floor (98 §7): the keyless template drafted
 *  from raw evidence when the optional LLM turn is unconfigured or fails.
 *  Normalizes title/body/tags; never fabricates — everything traces to the
 *  input. The caller owns the editable-JSON display and the `accept` save. */
export function proposeLessonFallback(input: {
  project: string;
  kind: "fix" | "pattern" | "note";
  title: string;
  tags?: string[];
  body: string;
  sourcePath?: string;
}): NewKnowledgeEntry {
  const title = (typeof input.title === "string" ? input.title : "").replace(/\s+/g, " ").trim().slice(0, 80) || "Untitled lesson";
  const body = (typeof input.body === "string" ? input.body : "").replace(/\s+/g, " ").trim().slice(0, 1200);
  const tags = [
    LESSON_TAG,
    ...(Array.isArray(input.tags) ? input.tags : []),
  ]
    .filter((t): t is string => typeof t === "string" && t.trim() !== "")
    .map((t) => t.trim())
    .sort()
    .filter((t, i, a) => i === 0 || a[i - 1] !== t);
  const entry: NewKnowledgeEntry = { project: input.project, kind: input.kind, title, tags, body };
  if (typeof input.sourcePath === "string" && input.sourcePath.trim()) entry.sourcePath = input.sourcePath.trim();
  return entry;
}

/** `lesson accept` row selector (fixes/144 M5-4, 98 §7): the project's own
 *  lesson-tagged memory rows ranked against its brief by FusionRank (the same
 *  read-back semantics the tier-2 seams use — rankBriefLessons), resolved back
 *  to their FULL rows (tags/class/level intact) in rank order so the caller can
 *  promote them with provenance. Deterministic; junk input → []. A blank brief
 *  degrades to the score-desc/id-asc order (the selectLessons convention)
 *  instead of returning nothing. */
export function topLessonRows(
  memory: readonly MemoryEntry[],
  brief: string,
  limit = 5,
): MemoryEntry[] {
  const rows = (Array.isArray(memory) ? memory : []).filter(
    (m): m is MemoryEntry =>
      !!m &&
      typeof m === "object" &&
      typeof m.id === "string" &&
      Array.isArray(m.tags) &&
      m.tags.includes(LESSON_TAG),
  );
  if (rows.length === 0) return [];
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  if (cap === 0) return [];
  const briefText = typeof brief === "string" ? brief.trim() : "";
  let ranked: RankedLessonRow[] = [];
  if (briefText) {
    ranked = rankBriefLessons(briefText, rows, { limit: cap });
  } else {
    ranked = [];
  }
  if (ranked.length === 0) {
    // Blank/unrankable brief: score-desc, id-asc (selectLessons tiebreak) so
    // the human still sees the strongest rows, deterministically.
    // Non-finite scores coerce to 0 so junk rows never NaN-sort.
    const lessonScore = (m: MemoryEntry): number =>
      typeof m.score === "number" && Number.isFinite(m.score) ? m.score : 0;
    ranked = [...rows]
      .sort((a, b) => {
        const d = lessonScore(b) - lessonScore(a);
        return d !== 0 ? d : a.id < b.id ? -1 : 1;
      })
      .slice(0, cap)
      .map((m) => ({ id: m.id, score: lessonScore(m), text: m.text, kind: m.kind }));
  }
  const byId = new Map<string, MemoryEntry>();
  for (const r of rows) byId.set(r.id, r);
  const out: MemoryEntry[] = [];
  for (const r of ranked) {
    const full = byId.get(r.id);
    if (full) out.push(full);
  }
  return out;
}

/** `lesson accept` row mapper (fixes/144 M5-4, 98 §7): one MemoryEntry lesson
 *  row → the NewKnowledgeEntry the human-gated accept appends to the store.
 *  The actor is recorded IN the entry's content (tags `actor:<name>` + the
 *  body provenance line) so it participates in the content fingerprint — a
 *  different actor's accept is a different row, and re-accept by the same
 *  actor stays idempotent. Title = `Lesson <level> <class>` from the row's own
 *  tags (fallback to the row id); the row text rides in the body so the
 *  store's reuse-advice (`Reuse "<title>" …: <body>`) carries the lesson. */
export function acceptedLessonEntry(opts: {
  project: string;
  actor: string;
  row: MemoryEntry;
}): NewKnowledgeEntry {
  const project = (typeof opts.project === "string" ? opts.project : "").replace(/\s+/g, " ").trim();
  const actor =
    (typeof opts.actor === "string" ? opts.actor : "").replace(/\s+/g, " ").trim().slice(0, 60) ||
    "cli-human";
  const row = opts.row ?? ({} as MemoryEntry);
  const text = (typeof row.text === "string" ? row.text : "").replace(/\s+/g, " ").trim();
  const rowTags = Array.isArray(row.tags)
    ? row.tags.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim())
    : [];
  const level = rowTags.find((t) => /^L[1-5]$/.test(t)) ?? null;
  const cls = rowTags.find(
    (t) => t !== LESSON_TAG && !/^L[1-5]$/.test(t) && t !== "accepted" && !t.startsWith("actor:"),
  ) ?? null;
  const tags = [
    LESSON_TAG,
    "accepted",
    `actor:${actor}`,
    ...(level ? [level] : []),
    ...(cls ? [cls] : []),
  ]
    .filter((t, i, a) => a.indexOf(t) === i)
    .sort();
  const title = ["Lesson", ...(level ? [level] : []), ...(cls ? [cls] : [])]
    .join(" ")
    .slice(0, 80);
  const body =
    `${text || "(empty lesson text)"} — accepted from project "${project}" by ${actor} ` +
    `(source lesson row ${row.id ?? "unknown"}).`;
  // 209: carry the memory row's maker score so 185-U1 eval-gate can admit the
  // first human accept (shouldPromoteLesson refuses unknown next). Score is
  // NOT part of the fingerprint — same content re-accept stays idempotent.
  const score =
    typeof row.score === "number" && Number.isFinite(row.score) ? row.score : undefined;
  return {
    project,
    kind: "note",
    title: title || `Lesson ${row.id ?? "unknown"}`,
    tags,
    body: body.slice(0, 1200),
    sourcePath: row.id ? `lesson:${row.id}` : undefined,
    ...(score !== undefined ? { score } : {}),
  };
}

/** `lesson supersede` core (98 §7): the NEW append-only row that declares an
 *  old entry dead — a supersede is an append, never a delete. The caller
 *  saves it (savePattern), then calls markSuperseded(oldId, newId) and logs
 *  `lesson.supersede`. Machine-initiated supersede is restricted by the
 *  caller to the verified-L4-contradiction path (98 §6.2). */
export function buildSupersedeEntry(opts: {
  oldId: string;
  reason: string;
  project: string;
  title?: string;
  by?: "machine" | "human";
}): NewKnowledgeEntry {
  const reason = (typeof opts.reason === "string" ? opts.reason : "").replace(/\s+/g, " ").trim();
  const title = (opts.title ?? `Supersedes ${opts.oldId}`).replace(/\s+/g, " ").trim().slice(0, 80);
  return {
    project: opts.project,
    kind: "note",
    title,
    tags: ["lesson", "supersede", opts.by === "machine" ? "machine-initiated" : "human-initiated"],
    body: `Supersedes ${opts.oldId}: ${reason || "(no reason recorded)"}`,
    sourcePath: `supersedes:${opts.oldId}`,
    supersedes: [opts.oldId],
  };
}

/** Pressure-promotion consolidation (98 §4.2): when a phase has ≥3 same-
 *  classTag lesson rows, one self-project `note` row survives the imminent
 *  slice(-80) eviction. Self-project rows never re-inject into their own
 *  project (injectProven self-exclusion), so no feedback loop; cross-project
 *  reach still requires the human accept. Returns null when nothing to
 *  consolidate (deterministic, keyless). */
export function consolidatedRunNote(
  project: Project,
  phase: PhaseId,
  classTag: string,
  rows: readonly MemoryEntry[],
): NewKnowledgeEntry | null {
  const matches = (Array.isArray(rows) ? rows : []).filter(
    (m) => m.phase === phase && Array.isArray(m.tags) && m.tags.includes(classTag),
  );
  if (matches.length < 3) return null;
  const top = [...matches]
    .sort((a, b) => (b.score - a.score !== 0 ? b.score - a.score : a.id < b.id ? -1 : 1))
    .slice(0, 3);
  const domain =
    project.lattice && typeof project.lattice.domain === "string" && project.lattice.domain.trim()
      ? project.lattice.domain
      : "unknown";
  return {
    project: project.name,
    kind: "note",
    title: `Run lessons P${phase} ${classTag}`,
    tags: ["lesson", "consolidated", `domain:${domain}`],
    body: top.map((r) => `${r.id} ${r.text}`).join("\n"),
    sourcePath: `phase:P${phase}`,
  };
}

/** L3/L4 outcome writer (project-free) — the verify.server.ts outcome seam.
 *  verifyFailureLesson / verifiedProcedureLesson ignore their `project` arg
 *  (they read only phase/evidence/iterations), so a seam with no Project in
 *  scope can still reuse the same builders — one content-addressed id either
 *  way (98 §3 anti-noise (b)). Passed → L4 verified-procedure; failed/error →
 *  L3 verify-failure. `not-configured` never reaches here (no lesson). */
export function verifyOutcomeLesson(
  status: "passed" | "failed" | "error",
  phase: PhaseId,
  evidence: string,
  iterations: number,
): MemoryEntry {
  return status === "passed"
    ? verifiedProcedureLesson(undefined as unknown as Project, phase, evidence)
    : verifyFailureLesson(undefined as unknown as Project, phase, evidence, iterations);
}

/** L5 — run-summary (98 §2.3 completion digest): one content-addressed lesson
 *  minted at run completion when the journey carried gate failures, rejections,
 *  or verify failures. Honest digest of WHAT went wrong (never fabricated
 *  prose); null for a clean run. Deterministic + keyless. */
export function runSummaryLesson(project: Project): MemoryEntry | null {
  const gateFails = (Array.isArray(project.phases) ? project.phases : [])
    .filter((r) => r && r.gate && r.gate.passed === false)
    .map((r) => `P${r.id}`);
  const rejectionCount = (Array.isArray(project.decisions) ? project.decisions : []).filter(
    (d) => d && d.decision === "reject",
  ).length;
  const rejectedPhases = (Array.isArray(project.phases) ? project.phases : [])
    .filter((r) => r && (r.rejectionHistory?.length ?? 0) > 0)
    .map((r) => `P${r.id}`);
  const verifyFails = (Array.isArray(project.logs) ? project.logs : []).filter(
    (l) => l && l.event === "verify.fail",
  ).length;
  if (gateFails.length === 0 && rejectionCount === 0 && rejectedPhases.length === 0 && verifyFails === 0) {
    return null;
  }
  const parts: string[] = [];
  if (gateFails.length > 0) parts.push(`gate FAIL ${gateFails.join(",")}`);
  if (rejectionCount > 0) parts.push(`${rejectionCount} rejection(s)`);
  if (rejectedPhases.length > 0) parts.push(`rejected phase ${rejectedPhases.join(",")}`);
  if (verifyFails > 0) parts.push(`verify FAIL (${verifyFails})`);
  const text =
    `L5 run-summary: run completed with ${parts.join("; ")}; ` +
    `reconcile the failed gates and lesson rows before reuse.`;
  return lessonRow({
    classShort: "run-summary",
    level: "L5",
    kind: "episodic",
    phase: 12,
    text,
    score: 0.6,
    source: "engine",
  });
}
