// ---------------------------------------------------------------------------
// scorecard.ts — T5.3 (fixes/262 LANE 5 · W23): the READ-ONLY eval scorecard
// reader for the keyed-eval harness's own documents under `research/eval-out`:
//
//   results.json          — scripts/run-eval.mjs's per-run scorecard (entries
//                           with criteria M1..M9 {score, evidence} + acceptance
//                           + grader facts + the harness's own summary).
//   history.json          — the append-only trend the M7 learning prior reads
//                           (one flat row per slug/trial: m1..m9 + total/mean).
//   run-in-progress.json  — the W16-L1 kill-safety marker (run-eval.mjs
//                           writeRunStartMarker/finishRunMarker): `done:false`
//                           + `finishedAt:null` means the run never finished.
//
// PURITY: this module imports NOTHING — no node:fs, no network, no LLM, no
// `Date.now`. The fs reads belong to the caller (`scripts/rapidtool-cli.mjs`
// `eval`), which owns the --dir resolution. AGENTS.md forbids `node:fs` in
// client-safe modules; keeping the whole parse+build seam pure also makes it
// unit-testable later with plain string fixtures (no temp dirs).
//
// HONESTY CONTRACT (AGENTS.md §no fabrication):
//   • every score / evidence string / bar fact printed here is READ from the
//     documents — nothing is recomputed into a claim. Deltas are arithmetic
//     over recorded rows and each carries the source row's `at` + `mode`.
//   • a MISSING history file is not an error: `present:false`, `rows: []` —
//     an absent trend prints as "no history", never as a fake 0 delta.
//   • a slug with no history row yields `historyDelta:null` + a `reason`.
//   • the harness's own `summary` block is carried VERBATIM as `sourceSummary`
//     next to our derived aggregates (transparent, comparable).
//   • a `criteria` cell that is absent from a row stays absent (`missing`) —
//     never defaulted to 0 (a 0 is a SCORE; absence is absence).
//
// Rubric labels (M1..M9) are transcribed from the rubric module's own doc,
// `src/lib/maker-score.ts:17-35`, because maker-score.ts exports the criterion
// functions but no label map (in-repo precedent for mirroring a literal with a
// citation: console.tsx's PACKET_TRUNC_MARKER ← packet.ts:17). The ids are
// pinned by `MakerCriterionId` (maker-score.ts:186).
// ---------------------------------------------------------------------------

/** Default eval-out dir, relative to the repo root. The CLI resolves it
 *  against its own module location; run-eval.mjs honors $EVAL_OUT_DIR, so the
 *  CLI's precedence is: `--dir` > $EVAL_OUT_DIR > this default. */
export const DEFAULT_EVAL_OUT_DIR = "research/eval-out";

export const EVAL_CRITERIA = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"] as const;
export type EvalCriterionId = (typeof EVAL_CRITERIA)[number];

/** maker-score.ts:17-35 (rubric doc) — verbatim criterion names. */
export const CRITERION_LABELS: Record<EvalCriterionId, string> = {
  M1: "substance",
  M2: "runs",
  M3: "iterates",
  M4: "verifiable",
  M5: "honest",
  M6: "handover",
  M7: "learning",
  M8: "bounded",
  M9: "on-time (stops loudly)",
};

/** The rubric maximum per entry (nine 0|1 criteria). */
export const EVAL_MAX_PER_ENTRY = EVAL_CRITERIA.length;

// ---------------------------------------------------------------------------
// Tolerant primitives (never throw — callers get a coded refusal instead)
// ---------------------------------------------------------------------------

export type JsonRead<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** `JSON.parse` without the throw: a malformed document is DATA (a refusal),
 *  never an internal error. */
export function parseJsonDocument<T = unknown>(text: string): JsonRead<T> {
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// results.json — the harness's own row shape (read defensively; the driver
// owns writes, this reader must survive skips/legacy rows)
// ---------------------------------------------------------------------------

export type EvalCriterionCell = { score: number; evidence: string };

export type EvalAcceptance = {
  filesOk: boolean | null;
  contentOk: boolean | null;
  pass: boolean | null;
  missingFiles: string[];
  failedContent: string[];
  passReason: string | null;
  /** W40·N4 verdict label, surfaced by W42·L1-E2 (`verificationLabel` in
   *  run-eval.mjs): which run-side assertions graded the tree. Absent on
   *  legacy rows predating the key — null, never invented. */
  verification: string | null;
  checked: { expectedFiles: number | null; expectedContent: number | null } | null;
};

export type EvalGraderFacts = {
  path: string | null;
  hash: number | string | null;
  barChars: number | null;
  requiredIdentifiers: number | null;
  requiredCapabilities: number | null;
  fileFrozen: boolean | null;
};

export type EvalEntry = {
  slug: string;
  name: string | null;
  domain: string | null;
  kind: string | null;
  status: string | null;
  mode: string | null;
  trial: number | null;
  /** Present cells only — an absent criterion is ABSENT, never a synthetic 0. */
  criteria: Partial<Record<EvalCriterionId, EvalCriterionCell>>;
  /** Which of M1..M9 the row did not carry (honesty surface). */
  missingCriteria: EvalCriterionId[];
  total: number | null;
  mean: number | null;
  baseline: string | null;
  acceptance: EvalAcceptance | null;
  /** W40·N4 verdicts surfaced per entry (W42·L1-E2) — read from the row's
   *  `acceptance` block; null = the row predates the key (never invented). */
  behaviorOk: boolean | null;
  kindOk: boolean | null;
  /** W42·L1-E2: funded | unfunded | unmeasured (run-eval.mjs's
   *  `historyEndClass`). null = absent on the row (legacy artifact). */
  endClass: string | null;
  grader: EvalGraderFacts | null;
  coverageMissing: string[];
  emitDir: string | null;
  durationSec: number | null;
  rowSource: string | null;
  /** The trial aggregate block ({passAt1, flaky, …}) — verbatim. */
  trials: Record<string, unknown> | null;
  /** Entry notes (treeRunOk/journey/stall/stopCode/…) — verbatim. */
  notes: Record<string, unknown> | null;
};

export type EvalResultsDoc = {
  generatedAt: string | null;
  mode: string | null;
  corpusDir: string | null;
  graderDir: string | null;
  graderFreeze: { checked: number | null; ok: boolean | null; changed: string[]; note?: string } | null;
  entries: EvalEntry[];
  /** The harness's own summary block, verbatim (null when the row omitted it). */
  sourceSummary: Record<string, unknown> | null;
  /** Skipped cases the harness recorded (documentation files etc.) — verbatim. */
  skips: unknown[];
  /** Reader-internal: `entries` rows that carried no slug (surfaced as a note). */
  _droppedRows?: number;
};

function readAcceptance(raw: unknown): EvalAcceptance | null {
  if (!isRecord(raw)) return null;
  const checked = isRecord(raw.checked)
    ? {
        expectedFiles: num(raw.checked.expectedFiles),
        expectedContent: num(raw.checked.expectedContent),
      }
    : null;
  return {
    filesOk: bool(raw.filesOk),
    contentOk: bool(raw.contentOk),
    pass: bool(raw.pass),
    missingFiles: strList(raw.missingFiles),
    failedContent: strList(raw.failedContent),
    passReason: str(raw.passReason),
    verification: str(raw.verification),
    checked,
  };
}

function readGrader(raw: unknown): EvalGraderFacts | null {
  if (!isRecord(raw)) return null;
  const hash = raw.hash;
  return {
    path: str(raw.path),
    hash: typeof hash === "number" || typeof hash === "string" ? hash : null,
    barChars: num(raw.barChars),
    requiredIdentifiers: num(raw.requiredIdentifiers),
    requiredCapabilities: num(raw.requiredCapabilities),
    fileFrozen: bool(raw.fileFrozen),
  };
}

function readEntry(raw: unknown): EvalEntry | null {
  if (!isRecord(raw)) return null;
  const slug = str(raw.slug);
  if (!slug) return null; // a row without a slug cannot be attributed — dropped, named in notes
  const rawCriteria = isRecord(raw.criteria) ? raw.criteria : {};
  const criteria: Partial<Record<EvalCriterionId, EvalCriterionCell>> = {};
  const missingCriteria: EvalCriterionId[] = [];
  for (const id of EVAL_CRITERIA) {
    const cell = rawCriteria[id];
    if (isRecord(cell)) {
      const score = num(cell.score);
      // 337-3: a PRESENT cell with no numeric score is ABSENT (the honesty
      // contract above) — storing a synthetic {score: 0} made aggregateCriteria
      // count a real scored zero and buildDelta mint a "0 − before" regression.
      if (score === null) {
        missingCriteria.push(id);
      } else {
        criteria[id] = {
          score,
          evidence: typeof cell.evidence === "string" ? cell.evidence : "",
        };
      }
    } else {
      missingCriteria.push(id);
    }
  }
  const coverage = isRecord(raw.coverage) ? raw.coverage : null;
  const rawAcceptance = isRecord(raw.acceptance) ? raw.acceptance : null;
  return {
    slug,
    name: str(raw.name),
    domain: str(raw.domain),
    kind: str(raw.kind),
    status: str(raw.status),
    mode: str(raw.mode),
    trial: num(raw.trial),
    criteria,
    missingCriteria,
    total: num(raw.total),
    mean: num(raw.mean),
    baseline: str(raw.baseline),
    acceptance: readAcceptance(raw.acceptance),
    behaviorOk: rawAcceptance ? bool(rawAcceptance.behaviorOk) : null,
    kindOk: rawAcceptance ? bool(rawAcceptance.kindOk) : null,
    endClass: str(raw.endClass),
    grader: readGrader(raw.grader),
    coverageMissing: coverage ? strList(coverage.missing) : [],
    emitDir: str(raw.emitDir),
    durationSec: num(raw.durationSec),
    rowSource: str(raw.rowSource),
    trials: isRecord(raw.trials) ? raw.trials : null,
    notes: isRecord(raw.notes) ? raw.notes : null,
  };
}

/** Parse `results.json` text into the reader's shape. A document that is not an
 *  object with an `entries` array is refused (the caller maps this to a
 *  RT_E_VALIDATION refusal — a malformed scorecard is never half-read). */
export function parseEvalResults(text: string): JsonRead<EvalResultsDoc> {
  const parsed = parseJsonDocument(text);
  if (!parsed.ok) return { ok: false, error: `results.json is not valid JSON — ${parsed.error}` };
  const doc = parsed.value;
  if (!isRecord(doc)) return { ok: false, error: "results.json is not a JSON object" };
  if (!Array.isArray(doc.entries)) {
    return { ok: false, error: "results.json carries no `entries` array (not a run-eval scorecard)" };
  }
  const entries: EvalEntry[] = [];
  let droppedRows = 0;
  for (const raw of doc.entries) {
    const entry = readEntry(raw);
    if (entry) entries.push(entry);
    else droppedRows += 1;
  }
  const freeze = isRecord(doc.graderFreeze) ? doc.graderFreeze : null;
  return {
    ok: true,
    value: {
      generatedAt: str(doc.generatedAt),
      mode: str(doc.mode),
      corpusDir: str(doc.corpusDir),
      graderDir: str(doc.graderDir),
      graderFreeze: freeze
        ? {
            checked: num(freeze.checked),
            ok: bool(freeze.ok),
            changed: strList(freeze.changed),
          }
        : null,
      entries,
      sourceSummary: isRecord(doc.summary) ? doc.summary : null,
      skips: isRecord(doc.summary) && Array.isArray(doc.summary.skips) ? doc.summary.skips : [],
      // `_droppedRows` is surfaced via buildScorecard's notes (kept on the doc
      // type so the shape stays the document's own fields + this one counter).
      ...(droppedRows > 0 ? { _droppedRows: droppedRows } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// history.json — the append-only flat rows (M7 prior evidence)
// ---------------------------------------------------------------------------

export type EvalHistoryRow = {
  at: string | null;
  mode: string | null;
  slug: string;
  trial: number | null;
  trials: number | null;
  pass: boolean | null;
  /** W42·L1-E2: funded | unfunded | unmeasured (run-eval.mjs writes this
   *  since W40·N4); null = absent on legacy rows — never invented. */
  endClass: string | null;
  criteria: Partial<Record<EvalCriterionId, number>>;
  total: number | null;
  mean: number | null;
};

/** Parse `history.json` text (a JSON ARRAY of flat rows). */
export function parseEvalHistory(text: string): JsonRead<EvalHistoryRow[]> {
  const parsed = parseJsonDocument(text);
  if (!parsed.ok) return { ok: false, error: `history.json is not valid JSON — ${parsed.error}` };
  if (!Array.isArray(parsed.value)) return { ok: false, error: "history.json is not a JSON array" };
  const rows: EvalHistoryRow[] = [];
  for (const raw of parsed.value) {
    if (!isRecord(raw)) continue;
    const slug = str(raw.slug);
    if (!slug) continue;
    const criteria: Partial<Record<EvalCriterionId, number>> = {};
    for (const id of EVAL_CRITERIA) {
      const idLower = id.toLowerCase() as Lowercase<EvalCriterionId>;
      const v = num(raw[idLower]);
      if (v !== null) criteria[id] = v;
    }
    rows.push({
      at: str(raw.at),
      mode: str(raw.mode),
      slug,
      trial: num(raw.trial),
      trials: num(raw.trials),
      pass: bool(raw.pass),
      endClass: str(raw.endClass),
      criteria,
      total: num(raw.total),
      mean: num(raw.mean),
    });
  }
  return { ok: true, value: rows };
}

// ---------------------------------------------------------------------------
// run-in-progress.json — the kill-safety marker (W16-L1)
// ---------------------------------------------------------------------------

export type EvalRunMarker = {
  markerVersion: number | null;
  mode: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  done: boolean | null;
  entries: number | null;
  corpus: string | null;
  preflightClass: string | null;
  pid: number | null;
  meanOfNine: number | null;
  decision: string | null;
  resultsWritten: boolean | null;
  historyWritten: boolean | null;
  /** true when the marker says a run started and never finalized (killed). */
  unfinished: boolean;
};

export function parseEvalRunMarker(text: string): JsonRead<EvalRunMarker> {
  const parsed = parseJsonDocument(text);
  if (!parsed.ok) return { ok: false, error: `run-in-progress.json is not valid JSON — ${parsed.error}` };
  const raw = parsed.value;
  if (!isRecord(raw)) return { ok: false, error: "run-in-progress.json is not a JSON object" };
  const done = bool(raw.done);
  const finishedAt = str(raw.finishedAt);
  return {
    ok: true,
    value: {
      markerVersion: num(raw.markerVersion),
      mode: str(raw.mode),
      startedAt: str(raw.startedAt),
      finishedAt,
      done,
      entries: num(raw.entries),
      corpus: str(raw.corpus),
      preflightClass: str(raw.preflightClass),
      pid: num(raw.pid),
      meanOfNine: num(raw.meanOfNine),
      decision: str(raw.decision),
      resultsWritten: bool(raw.resultsWritten),
      historyWritten: bool(raw.historyWritten),
      unfinished: done === false || (done === null && finishedAt === null),
    },
  };
}

// ---------------------------------------------------------------------------
// the scorecard build
// ---------------------------------------------------------------------------

export type EvalCriterionAggregate = {
  id: EvalCriterionId;
  label: string;
  /** entries that carried a score for this criterion */
  scoredBy: number;
  /** sum of the scored cells */
  scored: number;
  /** scoredBy * 1 — the rubric maximum for this column across scored entries */
  possible: number;
  /** scored / possible (null when nothing scored it) */
  mean: number | null;
  zeros: number;
  zerosSlugs: string[];
  /** up to EVIDENCE_KEEP distinct evidence strings with their slug, verbatim */
  evidence: { slug: string; text: string }[];
};

export type EvalCriterionDelta = { before: number; after: number; delta: number };

export type EvalHistoryDelta = {
  slug: string;
  /** the history row this delta came from */
  at: string | null;
  mode: string | null;
  trial: number | null;
  trials: number | null;
  pass: boolean | null;
  perCriterion: Partial<Record<EvalCriterionId, EvalCriterionDelta>>;
  totalDelta: number | null;
  meanDelta: number | null;
  direction: "up" | "down" | "flat";
};

export type EvalHistoryTrend = {
  slug: string;
  rowCount: number;
  firstAt: string | null;
  lastAt: string | null;
  modes: string[];
  bestMean: number | null;
  /** last TREND_KEEP rows, oldest → newest */
  series: { at: string | null; mode: string | null; trial: number | null; total: number | null; mean: number | null }[];
  /** step-to-step totals/means deltas over `series` (i-th entry = series[i] - series[i-1]) */
  stepDeltas: { at: string | null; totalDelta: number | null; meanDelta: number | null }[];
};

export type EvalEntryRow = EvalEntry & {
  historyDelta: EvalHistoryDelta | null;
  /** why historyDelta is null ("no history row for this slug" …) — null when present */
  historyReason: string | null;
};

export type EvalScorecard = {
  ok: true;
  dir: string;
  generatedAt: string | null;
  mode: string | null;
  criteria: EvalCriterionAggregate[];
  entries: EvalEntryRow[];
  derived: {
    entries: number;
    totalSum: number;
    meanTotal: number | null;
    maxPerEntry: number;
    passCount: number;
    /** W42·L1-E2 (X2 render tail): census of the funded | unfunded |
     *  unmeasured end class over `entries`; `absent` = the row carried no
     *  `endClass` (legacy artifacts predate the key — never guessed). */
    endClass: { funded: number; unfunded: number; unmeasured: number; absent: number };
    /** W42·L1-E2: three-way census of `acceptance.pass` over `entries`;
     *  `unscored` = no boolean verdict was recorded for the row. */
    acceptance: { pass: number; fail: number; unscored: number };
    /** per-slug pass@k block from `sourceSummary.passAtK`, verbatim (null when absent) */
    passAtK: Record<string, unknown> | null;
  };
  /** the harness's own summary block, verbatim */
  sourceSummary: Record<string, unknown> | null;
  graderFreeze: EvalResultsDoc["graderFreeze"];
  history: {
    path: string;
    present: boolean;
    rows: number;
    slugs: string[];
    note: string;
  };
  runMarker: EvalRunMarker | null;
  provenance: {
    resultsPath: string;
    historyPath: string;
    runMarkerPath: string;
    corpusDir: string | null;
    graderDir: string | null;
  };
  /** honest operational notes (missing history, dropped rows, unfinished run …) */
  notes: string[];
};

const EVIDENCE_KEEP = 3;
const TREND_KEEP = 10;

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function aggregateCriteria(entries: EvalEntry[]): EvalCriterionAggregate[] {
  return EVAL_CRITERIA.map((id) => {
    const cells: { slug: string; cell: EvalCriterionCell }[] = [];
    for (const e of entries) {
      const cell = e.criteria[id];
      if (cell) cells.push({ slug: e.slug, cell });
    }
    const scored = cells.reduce((n, c) => n + c.cell.score, 0);
    const zeros = cells.filter((c) => c.cell.score === 0);
    const seen = new Set<string>();
    const evidence: { slug: string; text: string }[] = [];
    for (const c of cells) {
      const text = c.cell.evidence.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      evidence.push({ slug: c.slug, text });
      if (evidence.length >= EVIDENCE_KEEP) break;
    }
    return {
      id,
      label: CRITERION_LABELS[id],
      scoredBy: cells.length,
      scored,
      possible: cells.length,
      mean: cells.length > 0 ? round4(scored / cells.length) : null,
      zeros: zeros.length,
      zerosSlugs: zeros.map((c) => c.slug),
      evidence,
    };
  });
}

/** Latest history row per slug (the M7 prior rule: the LAST recorded row). */
function latestBySlug(rows: EvalHistoryRow[]): Map<string, EvalHistoryRow> {
  const out = new Map<string, EvalHistoryRow>();
  for (const r of rows)
    if (r.slug) out.set(r.slug, r); // rows are append-only, so the last wins
  return out;
}

function buildDelta(entry: EvalEntry, prev: EvalHistoryRow): EvalHistoryDelta {
  const perCriterion: Partial<Record<EvalCriterionId, EvalCriterionDelta>> = {};
  for (const id of EVAL_CRITERIA) {
    const after = entry.criteria[id]?.score;
    const before = prev.criteria[id];
    if (typeof after !== "number" || typeof before !== "number") continue;
    perCriterion[id] = { before, after, delta: after - before };
  }
  const totalDelta =
    typeof entry.total === "number" && typeof prev.total === "number"
      ? entry.total - prev.total
      : null;
  const meanDelta =
    typeof entry.mean === "number" && typeof prev.mean === "number"
      ? round4(entry.mean - prev.mean)
      : null;
  const direction: EvalHistoryDelta["direction"] =
    (totalDelta ?? meanDelta ?? 0) > 0 ? "up" : (totalDelta ?? meanDelta ?? 0) < 0 ? "down" : "flat";
  return {
    slug: entry.slug,
    at: prev.at,
    mode: prev.mode,
    trial: prev.trial,
    trials: prev.trials,
    pass: prev.pass,
    perCriterion,
    totalDelta,
    meanDelta,
    direction,
  };
}

function buildTrend(slug: string, rows: EvalHistoryRow[]): EvalHistoryTrend {
  const mine = rows.filter((r) => r.slug === slug);
  const series = mine.slice(-TREND_KEEP).map((r) => ({
    at: r.at,
    mode: r.mode,
    trial: r.trial,
    total: r.total,
    mean: r.mean,
  }));
  const stepDeltas: EvalHistoryTrend["stepDeltas"] = [];
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1];
    const b = series[i];
    stepDeltas.push({
      at: b.at,
      totalDelta:
        typeof a.total === "number" && typeof b.total === "number" ? b.total - a.total : null,
      meanDelta:
        typeof a.mean === "number" && typeof b.mean === "number" ? round4(b.mean - a.mean) : null,
    });
  }
  const means = mine.map((r) => r.mean).filter((m): m is number => typeof m === "number");
  return {
    slug,
    rowCount: mine.length,
    firstAt: mine[0]?.at ?? null,
    lastAt: mine[mine.length - 1]?.at ?? null,
    modes: [...new Set(mine.map((r) => r.mode).filter((m): m is string => typeof m === "string"))],
    bestMean: means.length > 0 ? Math.max(...means) : null,
    series,
    stepDeltas,
  };
}

export type BuildScorecardInput = {
  /** parsed results.json document (required — the scorecard's spine) */
  results: EvalResultsDoc;
  /** parsed history rows ([] when the file is absent) */
  history?: EvalHistoryRow[] | null;
  /** whether history.json existed on disk (honest trend accounting) */
  historyPresent?: boolean;
  /** parsed run-in-progress.json marker (null when absent) */
  marker?: EvalRunMarker | null;
  /** the eval-out dir the documents were read from (echoed verbatim) */
  dir: string;
  resultsPath?: string;
  historyPath?: string;
  runMarkerPath?: string;
  /** optional single-slug filter (the CLI refuses an unknown slug itself) */
  slug?: string | null;
};

export function buildScorecard(input: BuildScorecardInput): EvalScorecard {
  const { results, dir } = input;
  const historyRows = Array.isArray(input.history) ? input.history : [];
  const historyPresent = input.historyPresent === true;
  const notes: string[] = [];

  let entries = results.entries;
  if (input.slug) entries = entries.filter((e) => e.slug === input.slug);

  const dropped = results._droppedRows ?? 0;
  if (dropped > 0) {
    notes.push(
      `${dropped} results row(s) carried no slug and were dropped from the scorecard (never attributed to a case).`,
    );
  }
  if (results.mode) notes.push(`results.json mode: ${results.mode} (the harness's own field, echoed).`);
  if (results.graderFreeze && results.graderFreeze.ok === false) {
    notes.push(
      `graderFreeze.ok=false — the acceptance bar moved while that run was in flight (changed: ${
        results.graderFreeze.changed.join(", ") || "unnamed"
      }); the run's scores cannot be attributed to a stable bar.`,
    );
  }

  const latest = latestBySlug(historyRows);
  const entryRows: EvalEntryRow[] = entries.map((e) => {
    const prev = latest.get(e.slug);
    if (!prev) {
      return {
        ...e,
        historyDelta: null,
        historyReason: historyPresent
          ? "no history row for this slug — first recorded run (no prior to delta against)"
          : "history.json absent — no trend to delta against",
      };
    }
    return { ...e, historyDelta: buildDelta(e, prev), historyReason: null };
  });

  const criteria = aggregateCriteria(entries);
  const totals = entries
    .map((e) => e.total)
    .filter((t): t is number => typeof t === "number");
  const means = entries.map((e) => e.mean).filter((m): m is number => typeof m === "number");
  const passCount = entryRows.filter((e) => e.acceptance?.pass === true).length;
  // W42·L1-E2: the end-class + acceptance censuses over the (possibly
  // slug-filtered) entries. A row outside the classifier's three classes —
  // key absent, or a value never written by run-eval.mjs — is counted
  // `absent`, NEVER silently landed in "unmeasured" (absence is not a class).
  const endClassCensus = { funded: 0, unfunded: 0, unmeasured: 0, absent: 0 };
  for (const e of entries) {
    if (e.endClass === "funded") endClassCensus.funded += 1;
    else if (e.endClass === "unfunded") endClassCensus.unfunded += 1;
    else if (e.endClass === "unmeasured") endClassCensus.unmeasured += 1;
    else endClassCensus.absent += 1;
  }
  const acceptanceCensus = { pass: 0, fail: 0, unscored: 0 };
  for (const e of entries) {
    const p = e.acceptance ? e.acceptance.pass : null;
    if (p === true) acceptanceCensus.pass += 1;
    else if (p === false) acceptanceCensus.fail += 1;
    else acceptanceCensus.unscored += 1;
  }
  const passAtK =
    results.sourceSummary && isRecord(results.sourceSummary.passAtK)
      ? results.sourceSummary.passAtK
      : null;

  if (!historyPresent) {
    notes.push(
      "history.json absent under the eval-out dir — deltas/trend unavailable (never fabricated). Point --dir at a finished run's eval-out to see them.",
    );
  } else if (historyRows.length === 0) {
    notes.push("history.json present but empty — no recorded trend rows yet.");
  }
  if (entries.length === 0) {
    notes.push(
      input.slug
        ? `no results entry matches slug ${JSON.stringify(input.slug)} in this results.json.`
        : "results.json carries no scored entries.",
    );
  }
  // W42·L1-E2: the render tail (X2) — name both censuses as notes lines so the
  // operator reads the class/acceptance mix without decoding `derived`.
  if (entries.length > 0) {
    notes.push(
      `endClass census (${entries.length} entries): funded ${endClassCensus.funded} · unfunded ${endClassCensus.unfunded} · unmeasured ${endClassCensus.unmeasured} · absent ${endClassCensus.absent} — "absent" = the row carried no endClass (a legacy artifact predating the key); never guessed into a class.`,
    );
    notes.push(
      `acceptance census: pass ${acceptanceCensus.pass} · fail ${acceptanceCensus.fail} · unscored ${acceptanceCensus.unscored} — "unscored" = no boolean verdict was recorded (no-balance trials and rows without an acceptance block).`,
    );
  }
  if (input.marker) {
    if (input.marker.unfinished) {
      notes.push(
        `run-in-progress.json says a run started ${input.marker.startedAt ?? "(unknown time)"} and never finalized (done=${String(
          input.marker.done,
        )}) — a killed/in-flight run; results.json may predate it.`,
      );
    } else {
      notes.push(
        `run marker: done=${String(input.marker.done)} preflightClass=${input.marker.preflightClass ?? "—"} decision=${
          input.marker.decision ?? "—"
        } (read-only echo; this verb never writes the marker).`,
      );
    }
  }

  return {
    ok: true,
    dir,
    generatedAt: results.generatedAt,
    mode: results.mode,
    criteria,
    entries: entryRows,
    derived: {
      entries: entries.length,
      totalSum: totals.reduce((n, t) => n + t, 0),
      meanTotal: means.length > 0 ? round4(means.reduce((n, m) => n + m, 0) / means.length) : null,
      maxPerEntry: EVAL_MAX_PER_ENTRY,
      passCount,
      endClass: endClassCensus,
      acceptance: acceptanceCensus,
      passAtK,
    },
    sourceSummary: results.sourceSummary,
    graderFreeze: results.graderFreeze,
    history: {
      path: input.historyPath ?? "",
      present: historyPresent,
      rows: historyRows.length,
      slugs: [...new Set(historyRows.map((r) => r.slug))],
      note: historyPresent
        ? "append-only harness trend (M7 prior evidence); deltas above compare the LAST row per slug against the current results row."
        : "absent",
    },
    runMarker: input.marker ?? null,
    provenance: {
      resultsPath: input.resultsPath ?? "",
      historyPath: input.historyPath ?? "",
      runMarkerPath: input.runMarkerPath ?? "",
      corpusDir: results.corpusDir,
      graderDir: results.graderDir,
    },
    notes,
  };
}

/** Per-slug trends for the whole history (the CLI prints one object, so this
 *  rides inside `buildScorecard`'s callers; exported for the unit seam). */
export function buildTrends(rows: EvalHistoryRow[]): EvalHistoryTrend[] {
  const slugs = [...new Set(rows.map((r) => r.slug))];
  return slugs.map((slug) => buildTrend(slug, rows));
}
