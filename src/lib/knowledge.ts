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
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fnv1a, fusionRank, tokenizeWords } from "./algorithms.ts";
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
  /** false when an identical entry already existed (idempotent no-op). */
  appended: boolean;
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
   *  per mutation cycle; later saves update the cache directly. */
  entries(): KnowledgeEntry[] {
    if (this.cache === null) this.cache = this.readStore();
    return this.cache;
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
   *  stale in-memory cache can never erase rows another instance appended. */
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
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: STORE_VERSION, entries }, null, 2), "utf8");
    renameSync(tmp, this.filePath);
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
/** Hard cap on a lesson row's text (bounded prompt injection, H43-P2-2). */
export const LESSON_TEXT_MAX = 240;
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
};

/** 8-hex FNV-1a of a string (the K-id convention, minus the prefix). */
function fnv8(s: string): string {
  return fnv1a(s).toString(16).padStart(8, "0");
}

/**
 * The one row builder every writer goes through. Deterministic: content-
 * addressed id `lesson-<class>-<fnv8(text)>` (identical text ⇒ identical id ⇒
 * dedupeMemoryIds is an exact no-op), tags sorted+deduped and always carrying
 * [LESSON_TAG, classShort, level], text collapsed to ≤ LESSON_TEXT_MAX.
 */
export function lessonRow(spec: LessonSpec): MemoryEntry {
  const text =
    typeof spec.text === "string"
      ? spec.text.replace(/\s+/g, " ").trim().slice(0, LESSON_TEXT_MAX)
      : "";
  const raw = [
    LESSON_TAG,
    spec.classShort,
    spec.level,
    ...(Array.isArray(spec.tags) ? spec.tags : []),
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
    id: `lesson-${spec.classShort}-${fnv8(text)}`,
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

/** L2 — template-emission (98 §2.3): a phase sealed with the gate unmet.
 *  Engine-detectable ⇒ factual. `evidenceHash` defaults to a deterministic
 *  content hash; pass the machine gate's hash when the caller has it.
 *  `source` mirrors M-08's E-18 provenance stamp: the engine seal path passes
 *  nothing (defaults "engine"); the agent-report path (98 §3 writer 2(a),
 *  report-intake.ts E-16 site) passes "agent-report" — same content-addressed
 *  id either way, so both writers stay idempotent (98 §3 anti-noise (b)). */
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
  const nounText = nounList.length ? nounList.join(", ") : "none computed";
  const hash =
    typeof evidenceHash === "string" && evidenceHash.trim()
      ? evidenceHash.trim().slice(0, 16)
      : fnv8(`${project.brief}:${phase}:${ids.join(",")}:${nounText}`);
  const text =
    `L2 template-emission: phase P${phase} sealed with gate unmet (${ids.join(", ") || "unknown"}); ` +
    `required brief nouns with 0 hits in emitted source: ${nounText}; evidenceHash=${hash}.`;
  return lessonRow({
    classShort: "template-emission",
    level: "L2",
    kind: "episodic",
    phase,
    text,
    score: 0.7,
    source,
  });
}

/** L3 — verify-failure (98 §2.3). The optional `hypothesis` is model prose
 *  (Reflexion turn) and is stored ONLY behind the literal `| hypothesis:`
 *  marker — honest labeling, never as fact (98 §2.3 rule). Evidence detail is
 *  clipped to 140 chars inside the 240-char row budget. */
export function verifyFailureLesson(
  project: Project,
  phase: PhaseId,
  evidence: string,
  iterations: number,
  hypothesis?: string,
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
  return lessonRow({
    classShort: "verify-failure",
    level: "L3",
    kind: "episodic",
    phase,
    text,
    score: 0.7,
    source: "engine",
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
  return lessonRow({
    classShort: "drift",
    level: "L2",
    kind: "episodic",
    phase: laterPhase,
    text,
    score: 0.6,
    source: "engine",
  });
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
    ranked = [...rows]
      .sort((a, b) => (b.score - a.score !== 0 ? b.score - a.score : a.id < b.id ? -1 : 1))
      .slice(0, cap)
      .map((m) => ({ id: m.id, score: m.score, text: m.text, kind: m.kind }));
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
  return {
    project,
    kind: "note",
    title: title || `Lesson ${row.id ?? "unknown"}`,
    tags,
    body: body.slice(0, 1200),
    sourcePath: row.id ? `lesson:${row.id}` : undefined,
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
