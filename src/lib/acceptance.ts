/**
 * PR-31 / PR-32 — the machine-verified acceptance reading (design §4.8 Option A)
 * and the fleet observability metrics/alarms (design §9).
 *
 * WHAT THIS IS. An INDEPENDENT, additive reading of what a no-human run
 * actually achieved, derived from EXTERNAL, re-runnable evidence persisted on
 * each project: the P6 tree-run "tested" promotion stamp (`lastTest.label ===
 * "tested"` with a non-empty `evidenceHash`) that `codegen.mintTreeRunTested`
 * writes after a genuinely green, spec-executing tree-run — the SAME stamp the
 * DoD `p6-verified` probe reads. `autonomousFactoryV2` is satisfied by that
 * machine evidence alone.
 *
 * OWNER DECISION (Open Question 1) — recorded here as OPTION A. Build an
 * independent machine-verified acceptance path BESIDE the human door, rather
 * than Option B (unilaterally drop the human conjunct from the factory bar).
 * Rationale: the human conjunct is deliberate (What-NOT-To-Do #18) and the
 * machine may not set the bar it is graded against, so the honest move is a
 * new, separately-attributed machine reading that cannot forge a human stamp.
 * PR-30 (tree-byte evidence hygiene) is the prerequisite; this module is its
 * consumer.
 *
 * WHAT THIS IS NOT. It is not the human door. `autonomousSoftwareFactory` is
 * the AND of four machine conjuncts plus a human-approved fixture row
 * (`decidedBy:"human"`, out-of-band) — it stays BYTE-UNTOUCHED here. This
 * module never reads the human-approved acceptance oracle (`acceptanceFixtures`),
 * never writes a human stamp, and every value it emits is machine-attributed:
 * `decidedBy` is the literal `"machine"`, the seat is `"machine:tree-run"`.
 * A record claiming a human seat is refused outright, never laundered.
 *
 * FAIL-CLOSED. Absent / garbled / empty evidence refuses; a shape claim with no
 * persisted verdict is refused; two distinct briefs sharing one `evidenceHash`
 * (the BF-6 project-insensitive-stamp class) are refused, because a shared hash
 * does not identify a tree. Provenance unit tests assert the machine seat and
 * the human-seat refusal (see acceptance.test.ts).
 *
 * Client-safe: no `node:` imports, no IO — pure reads over the caller's values,
 * so `doctor.ts` (client-safe) can import it.
 */

/** The one machine verifier seat this reading reports under. Never "human". */
export const MACHINE_ACCEPTANCE_SEAT = "machine:tree-run" as const;

/** The only decider this aggregate can attribute: a machine. Never "human". */
export const MACHINE_DECIDER = "machine" as const;

/** Design §4.7 exit criterion: ≥5 of the 8 campaign briefs (7 + held-out). */
export const FLEET_ACCEPTANCE_MIN = 5;
export const FLEET_TARGET_BRIEFS = 8;

/** One coded refusal sentence per precondition. No prose is invented into a pass. */
export const ACCEPTANCE_REFUSAL = {
  noEvidence:
    "no persisted machine tree-run verdict — no external, re-runnable evidence exists on the project, so machine acceptance is unproven",
  notTested:
    'the project carries no promoted tree-run verdict — lastTest.label is not "tested" (the P6 machine-verification stamp is absent)',
  hollow:
    'the "tested" stamp is hollow — lastTest.ok/detail or its evidenceHash is missing, so no verifier could re-run and reproduce it',
  humanSeat:
    "the recorded verdict claims a human seat — machine acceptance never rides a human stamp; that door is the human-approved fixtures (decided out-of-band), not this reading",
  noBrief:
    "the evidence row carries no brief identity — an unattributed verdict cannot be counted toward a fleet reading",
  duplicateHash:
    "two distinct briefs share one evidenceHash — the stamp does not identify the tree (BF-6), so neither may count as per-tree evidence",
} as const;

export type AcceptanceDecider = typeof MACHINE_DECIDER;

/** One brief's machine evidence, extracted from its persisted project record. */
export type MachineBriefEvidence = {
  /** Brief identity (project id/name) the verdict is attributed to. */
  brief: string;
  /** Verifier seat: the machine tree-run. Never "human". */
  seat: typeof MACHINE_ACCEPTANCE_SEAT;
  label: "tested";
  /** FNV-1a evidence hash written by the mint — integrity, not cryptography. */
  evidenceHash: string;
  /** Optional tree-run verdict hash, when the record carries one. */
  verdictHash?: string;
  detail: string;
};

export type MachineEvidenceRead =
  | { ok: true; evidence: MachineBriefEvidence }
  | { ok: false; reason: string };

type ProjectLike = {
  id?: unknown;
  name?: unknown;
  brief?: unknown;
  lastTest?: unknown;
  treeRun?: unknown;
  verdictHash?: unknown;
};

function asRecord(v: unknown): ProjectLike | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as ProjectLike) : null;
}

function briefOf(record: ProjectLike, fallback?: string): string {
  // The record's OWN identity wins; the positional fallback is last resort.
  for (const v of [record.id, record.name, record.brief, fallback]) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function textOf(v: unknown): string {
  return typeof v === "string" && v.length > 0 ? v : "";
}

/**
 * The ONE per-brief reader. Reads ONLY the persisted machine `lastTest` stamp —
 * never `acceptanceFixtures` (the human-authored bar). A human-seat claim is
 * refused; a missing/hollow stamp is refused with its coded reason. Never throws.
 */
export function readMachineEvidence(project: unknown, brief?: string): MachineEvidenceRead {
  const record = asRecord(project);
  if (!record) return { ok: false, reason: ACCEPTANCE_REFUSAL.noEvidence };
  const lt = asRecord(record.lastTest);
  if (!lt) return { ok: false, reason: ACCEPTANCE_REFUSAL.notTested };
  const l = lt as {
    ok?: unknown;
    detail?: unknown;
    label?: unknown;
    evidenceHash?: unknown;
    decidedBy?: unknown;
    seat?: unknown;
  };
  if (l.decidedBy === "human" || l.seat === "human") {
    return { ok: false, reason: ACCEPTANCE_REFUSAL.humanSeat };
  }
  if (l.label !== "tested") return { ok: false, reason: ACCEPTANCE_REFUSAL.notTested };
  const detail = textOf(l.detail);
  const evidenceHash = textOf(l.evidenceHash);
  if (l.ok !== true || detail === "" || evidenceHash === "") {
    return { ok: false, reason: ACCEPTANCE_REFUSAL.hollow };
  }
  const id = briefOf(record, brief);
  if (id === "") return { ok: false, reason: ACCEPTANCE_REFUSAL.noBrief };
  const tr = asRecord(record.treeRun);
  const verdictHash =
    textOf(record.verdictHash) || (tr ? textOf((tr as { verdictHash?: unknown }).verdictHash) : "");
  return {
    ok: true,
    evidence: {
      brief: id,
      seat: MACHINE_ACCEPTANCE_SEAT,
      label: "tested",
      evidenceHash,
      detail,
      ...(verdictHash ? { verdictHash } : {}),
    },
  };
}

export type FleetAcceptance = {
  /** PR-31 additive reading. Never flips `autonomousSoftwareFactory`. */
  autonomousFactoryV2: boolean;
  /** Provenance by construction: this aggregate is machine-decided. Never "human". */
  decidedBy: AcceptanceDecider;
  seat: typeof MACHINE_ACCEPTANCE_SEAT;
  /** Briefs presented, evidenced (valid + unique), and the acceptance floor. */
  briefs: number;
  evidenced: number;
  required: number;
  /** Briefs whose persisted machine evidence counts. */
  accepted: string[];
  /** Refused briefs with their coded reasons. */
  refused: Array<{ brief: string; reason: string }>;
  /** True when two distinct briefs shared one evidenceHash (BF-6 class). */
  evidenceHashCollision: boolean;
  /** True when any record claimed a human seat — poisoned, never laundered. */
  forgedHumanStamp: boolean;
  /**
   * fixes/346-X5: the number of briefs/samples the reading was computed over —
   * the variance denominator. The machine reading carries it so a caller cannot
   * read a single lucky sample as a fleet result; `evidencedRate` names the
   * actual pass fraction.
   */
  sampleCount: number;
  /** evidenced / sampleCount; null when no brief was presented. Never a fabricated 1. */
  evidencedRate: number | null;
  /** Why `autonomousFactoryV2` is false (empty iff true). */
  reasons: string[];
};

/**
 * The fleet/machine acceptance aggregate (design §4.8 Option A). Grounded in
 * per-brief external evidence; refuses (false) when the evidence is absent,
 * hollow, unattributed, colliding, or below the floor. Never mints a human
 * stamp; never reads the human acceptance door.
 *
 * `required` defaults to 1 (any one genuinely-evidenced brief) and may be
 * raised — the campaign reading uses `FLEET_ACCEPTANCE_MIN`. The floor is
 * clamped below at 1 so a caller cannot pass 0 to force a pass; it is NOT
 * clamped to the presented count, so a 2-brief fleet cannot satisfy an
 * 8-brief campaign floor by shrinking.
 */
export function fleetAcceptanceFromProjects(
  projects: readonly unknown[],
  opts?: { required?: number },
): FleetAcceptance {
  const rows = Array.isArray(projects) ? projects : [];
  const accepted: MachineBriefEvidence[] = [];
  const refused: Array<{ brief: string; reason: string }> = [];
  let forgedHumanStamp = false;

  rows.forEach((p, i) => {
    const r = asRecord(p);
    const read = readMachineEvidence(p, `brief-${i + 1}`);
    if (read.ok) {
      accepted.push(read.evidence);
      return;
    }
    if (read.reason === ACCEPTANCE_REFUSAL.humanSeat) forgedHumanStamp = true;
    refused.push({ brief: briefOf(r ?? {}, `brief-${i + 1}`) || `brief-${i + 1}`, reason: read.reason });
  });

  // BF-6: an evidenceHash shared by two distinct briefs does not identify a
  // tree, so neither may count — and the collision is a hard refusal.
  const byHash = new Map<string, MachineBriefEvidence[]>();
  for (const e of accepted) {
    const list = byHash.get(e.evidenceHash) ?? [];
    list.push(e);
    byHash.set(e.evidenceHash, list);
  }
  const collided = new Set<string>();
  for (const [, list] of byHash) {
    if (list.length > 1) for (const e of list) collided.add(e.brief);
  }
  const unique = accepted.filter((e) => !collided.has(e.brief));
  for (const e of accepted.filter((e) => collided.has(e.brief))) {
    refused.push({ brief: e.brief, reason: ACCEPTANCE_REFUSAL.duplicateHash });
  }
  const evidenceHashCollision = collided.size > 0;

  const briefs = rows.length;
  const rawRequired = typeof opts?.required === "number" && Number.isFinite(opts.required) ? opts.required : 1;
  const required = Math.max(1, Math.floor(rawRequired));

  const reasons: string[] = [];
  if (forgedHumanStamp) reasons.push(ACCEPTANCE_REFUSAL.humanSeat);
  if (evidenceHashCollision) reasons.push(ACCEPTANCE_REFUSAL.duplicateHash);
  if (unique.length < required) {
    reasons.push(
      `only ${unique.length} of ${briefs} brief(s) carry valid, unique machine evidence — the acceptance floor is ${required}`,
    );
  }

  const autonomousFactoryV2 = unique.length >= required && !forgedHumanStamp && !evidenceHashCollision;
  return {
    autonomousFactoryV2,
    decidedBy: MACHINE_DECIDER,
    seat: MACHINE_ACCEPTANCE_SEAT,
    briefs,
    evidenced: unique.length,
    required,
    accepted: unique.map((e) => e.brief),
    refused,
    evidenceHashCollision,
    forgedHumanStamp,
    sampleCount: briefs,
    evidencedRate: briefs > 0 ? unique.length / briefs : null,
    reasons: autonomousFactoryV2 ? [] : reasons,
  };
}

// ---------------------------------------------------------------------------
// PR-32 — fleet metrics + falsifiable alarms (design §9.1/§9.3)
// ---------------------------------------------------------------------------

/** One run's measured telemetry, as the ledger / `doctor --tree` reports it.
 *  `estimatedCostUsd` must stay null (tokens are reported, never a fabricated $). */
export type FleetRunTelemetry = {
  brief?: string;
  keyed?: boolean;
  /** Synthesis chunks in the run (the cache prefix repeats per chunk). */
  chunks?: number;
  tokens?: number;
  calls?: number;
  cachedPromptTokens?: number;
  estimatedCostUsd?: number | null;
  /** Rubric total for this tree (/14). Absent/null ⇒ not scored. */
  rubricScore?: number | null;
  evidenceHash?: string;
  /** fixes/346-X5: the run's persisted `p6.synthesis.candidates` journal details,
   *  verbatim. Absent/empty ⇒ no resample was recorded for this run. */
  synthesisCandidates?: readonly unknown[];
  /** fixes/346-X5: the campaign `workingApp` verdict for this sample, when the
   *  caller's scorer supplies it. Absent/null ⇒ not scored (never inferred). */
  workingApp?: boolean | null;
};

// ---------------------------------------------------------------------------
// fixes/346-X5 — the armed P6 chunk-resample, read back from the journal
// ---------------------------------------------------------------------------

/**
 * One parsed `p6.synthesis.candidates` journal row — the persisted record of a
 * bounded, validator-selected resample decision (fixes/346 lanes S4/T1). The
 * detail is a single line: `chunk N/M [(fail-fast)] · candidates K · winner
 * <i|none> · candidate 1: … | candidate 2: …`. This reader reports ONLY what
 * the bytes recorded — never an inferred token or a fabricated winner.
 */
export type CandidateJournalEvent = {
  /** The unit that was resampled, e.g. `chunk 3/10 (fail-fast)`. */
  unit: string;
  /** True when the offender fail-fast path (not the per-chunk acceptance) ran. */
  failFast: boolean;
  /** The `candidates K` budget the row names. */
  requested: number;
  /** Candidate slots actually evaluated (a `not produced` slot is not tried). */
  tried: number;
  /** 1-based selected candidate index, or null for `winner none`. */
  winner: number | null;
};

/** Parse one `p6.synthesis.candidates` detail; null when it is not such a row. Pure. */
export function parseCandidateJournalRow(detail: unknown): CandidateJournalEvent | null {
  if (typeof detail !== "string") return null;
  const m = /candidates\s+(\d+)\s*·\s*winner\s+(none|\d+)/.exec(detail);
  if (!m) return null;
  const requested = Number(m[1]);
  if (!Number.isFinite(requested)) return null;
  const winner = m[2] === "none" ? null : Number(m[2]);
  const head = detail.split("· candidate ")[0];
  const unit = head.split("· candidates")[0].trim();
  const slots = detail.match(/candidate\s+\d+:/g) ?? [];
  const notProduced = (detail.match(/candidate\s+\d+:\s*not produced/g) ?? []).length;
  return { unit, failFast: /\(fail-fast\)/.test(unit), requested, tried: slots.length - notProduced, winner };
}

/** One run's resample usage, summarised from its journal rows. */
export type ResampleRunUsage = {
  brief: string;
  /** Rows parsed for this run. */
  events: number;
  /** Σ the rows' `candidates K` budget. */
  candidatesRequested: number;
  /** Σ candidates actually evaluated (a `not produced` slot excluded). */
  candidatesTried: number;
  /** Rows where a candidate was selected (`winner <i>`). */
  winners: number;
  /** Rows where every candidate was rejected (`winner none`). */
  noWinner: number;
  /** Extra keyed synthesis calls: Σ max(0, candidatesTried − 1). */
  extraKeyedCalls: number;
  /** Winner index per row, in journal order; null = `winner none`. */
  winnersByEvent: Array<number | null>;
};

/**
 * The armed resample's measured usage over the fleet. Derived ONLY from the
 * persisted `p6.synthesis.candidates` journal rows — candidates requested and
 * tried are counted, and `winner` is read, never invented.
 *
 * TOKENS ARE NOT IN THE ROW. The candidate row records candidates, not token
 * usage, so `extraTokens` stays null with `tokenAccounting` naming that gap —
 * a fabricated per-resample token figure would be exactly the over-claim the
 * honesty contract forbids. `extraKeyedCalls` is the counted lower bound: each
 * extra evaluated candidate is ≥1 keyed synthesis call (a candidate's own
 * bounded repair call is inside one candidate and is not separable here).
 */
export type ResampleUsage = {
  /** Runs whose telemetry named ≥1 candidates row. */
  runs: number;
  events: number;
  candidatesRequested: number;
  candidatesTried: number;
  winners: number;
  noWinner: number;
  extraKeyedCalls: number;
  /** Never fabricated — the journal records no token usage per candidate. */
  extraTokens: null;
  tokenAccounting: "not-recorded-in-journal";
  /** Per-run detail, so the doctor reading names each run, not just a total. */
  byRun: ResampleRunUsage[];
};

/** Aggregate the armed-resample usage from per-run telemetry rows (pure). */
export function resampleUsage(runs: readonly unknown[]): ResampleUsage {
  const rows = (Array.isArray(runs) ? runs : []).filter(
    (r): r is FleetRunTelemetry => !!r && typeof r === "object" && !Array.isArray(r),
  );
  const byRun: ResampleRunUsage[] = [];
  let events = 0;
  let candidatesRequested = 0;
  let candidatesTried = 0;
  let winners = 0;
  let noWinner = 0;
  let extraKeyedCalls = 0;
  rows.forEach((r, i) => {
    const details = Array.isArray(r.synthesisCandidates) ? r.synthesisCandidates : [];
    const parsed = details
      .map((d) => parseCandidateJournalRow(d))
      .filter((e): e is CandidateJournalEvent => e !== null);
    if (parsed.length === 0) return;
    const brief = typeof r.brief === "string" && r.brief.trim() ? r.brief.trim() : `run-${i + 1}`;
    const runExtra = parsed.reduce((n, e) => n + Math.max(0, e.tried - 1), 0);
    const runWinners = parsed.filter((e) => e.winner !== null).length;
    byRun.push({
      brief,
      events: parsed.length,
      candidatesRequested: parsed.reduce((n, e) => n + e.requested, 0),
      candidatesTried: parsed.reduce((n, e) => n + e.tried, 0),
      winners: runWinners,
      noWinner: parsed.length - runWinners,
      extraKeyedCalls: runExtra,
      winnersByEvent: parsed.map((e) => e.winner),
    });
    events += parsed.length;
    candidatesRequested += parsed.reduce((n, e) => n + e.requested, 0);
    candidatesTried += parsed.reduce((n, e) => n + e.tried, 0);
    winners += runWinners;
    noWinner += parsed.length - runWinners;
    extraKeyedCalls += runExtra;
  });
  return {
    runs: byRun.length,
    events,
    candidatesRequested,
    candidatesTried,
    winners,
    noWinner,
    extraKeyedCalls,
    extraTokens: null,
    tokenAccounting: "not-recorded-in-journal",
    byRun,
  };
}

export type FleetMetrics = {
  runs: number;
  keyedRuns: number;
  tokens: number;
  calls: number;
  cachedPromptTokens: number;
  /** True when a keyed run with ≥2 chunks observed a non-zero cache hit. */
  cacheObserved: boolean;
  synthesisCalls: number;
  rubricScored: number;
  rubricMean: number | null;
  uniqueEvidenceHashes: number;
  /** Non-empty hashes seen on more than one distinct brief. */
  duplicateEvidenceHashes: string[];
  /** fixes/346-X5: the armed chunk-resample usage read from the journals. */
  resample: ResampleUsage;
  /**
   * fixes/346-X5 — the VARIANCE reading. The final keyed samples disagreed
   * across runs on the same briefs, so the machine reading reports the working
   * sample count and the per-sample `workingApp` rather than a single lucky
   * run. Only rows carrying a boolean `workingApp` count; an absent verdict is
   * NOT scored (never inferred).
   */
  workingAppSamples: number;
  workingAppPass: number;
  /** workingAppPass / workingAppSamples; null when no sample was scored. */
  workingAppRate: number | null;
  workingAppByBrief: Array<{ brief: string; workingApp: boolean }>;
  /** Honesty: never fabricated. Always null — tokens are the reported unit. */
  estimatedCostUsd: null;
};

/** Thresholds that fail the wave (design §9.3). Falsifiable — see the fixtures. */
export const FLEET_ALARM_THRESHOLDS = {
  /** A keyed run with this many chunks must show a cache hit. */
  cache: { minChunks: 2 },
  /** Any run above this many keyed calls trips the spend/loop alarm. */
  synthesisCalls: { perRunMax: 40 },
  /** Fleet rubric mean (of this scale) below target trips the quality alarm. */
  rubric: { meanMin: 10, scale: 14 },
} as const;

function finiteNonNeg(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Aggregate per-run telemetry into the fleet metrics (pure, hostile-safe). */
export function fleetMetrics(runs: readonly unknown[]): FleetMetrics {
  const rows = (Array.isArray(runs) ? runs : []).filter(
    (r): r is FleetRunTelemetry => !!r && typeof r === "object" && !Array.isArray(r),
  );
  let keyedRuns = 0;
  let tokens = 0;
  let calls = 0;
  let cachedPromptTokens = 0;
  let cacheObserved = false;
  let rubricSum = 0;
  let rubricScored = 0;
  let workingAppSamples = 0;
  let workingAppPass = 0;
  const workingAppByBrief: Array<{ brief: string; workingApp: boolean }> = [];
  const hashToBriefs = new Map<string, Set<string>>();
  rows.forEach((r, i) => {
    const t = finiteNonNeg(r.tokens);
    if (t !== null) tokens += t;
    const c = finiteNonNeg(r.calls);
    if (c !== null) calls += c;
    const cc = finiteNonNeg(r.cachedPromptTokens);
    if (cc !== null) cachedPromptTokens += cc;
    const keyed = r.keyed === true;
    if (keyed) keyedRuns += 1;
    const chunks = finiteNonNeg(r.chunks) ?? 0;
    if (keyed && chunks >= FLEET_ALARM_THRESHOLDS.cache.minChunks && cc !== null && cc > 0) cacheObserved = true;
    const rs = finiteNonNeg(r.rubricScore);
    if (rs !== null) {
      rubricSum += rs;
      rubricScored += 1;
    }
    // fixes/346-X5: only a supplied boolean scores; an absent verdict is not inferred.
    if (typeof r.workingApp === "boolean") {
      const brief = typeof r.brief === "string" && r.brief.trim() ? r.brief.trim() : `run-${i + 1}`;
      workingAppSamples += 1;
      if (r.workingApp) workingAppPass += 1;
      workingAppByBrief.push({ brief, workingApp: r.workingApp });
    }
    if (typeof r.evidenceHash === "string" && r.evidenceHash.length > 0) {
      const brief = typeof r.brief === "string" && r.brief.trim() ? r.brief.trim() : `run-${i + 1}`;
      const set = hashToBriefs.get(r.evidenceHash) ?? new Set<string>();
      set.add(brief);
      hashToBriefs.set(r.evidenceHash, set);
    }
  });
  const duplicateEvidenceHashes = [...hashToBriefs.entries()]
    .filter(([, set]) => set.size > 1)
    .map(([hash]) => hash);
  return {
    runs: rows.length,
    keyedRuns,
    tokens,
    calls,
    cachedPromptTokens,
    cacheObserved,
    synthesisCalls: calls,
    rubricScored,
    rubricMean: rubricScored > 0 ? rubricSum / rubricScored : null,
    uniqueEvidenceHashes: [...hashToBriefs.keys()].filter((h) => (hashToBriefs.get(h)?.size ?? 0) === 1).length,
    duplicateEvidenceHashes,
    resample: resampleUsage(rows),
    workingAppSamples,
    workingAppPass,
    workingAppRate: workingAppSamples > 0 ? workingAppPass / workingAppSamples : null,
    workingAppByBrief,
    estimatedCostUsd: null,
  };
}

export type FleetAlarm = { id: string; tripped: boolean; detail: string };

export type FleetAlarms = {
  /** cachedPromptTokens === 0 on a keyed run with ≥2 chunks (C-10). */
  cacheCold: FleetAlarm;
  /** A run's synthesis calls exceed the per-run cap (C-08). */
  synthesisCalls: FleetAlarm;
  /** Fleet rubric mean below target (quality). */
  rubricBelowTarget: FleetAlarm;
  /** Two distinct briefs share one evidenceHash (BF-6 hard failure). */
  evidenceHashCollision: FleetAlarm;
  /** A run reports a non-null estimatedCostUsd — spend must never be fabricated. */
  spendFabricated: FleetAlarm;
  tripped: boolean;
};

/** Compute the threshold alarms over per-run telemetry (pure, hostile-safe). */
export function fleetAlarms(runs: readonly unknown[]): FleetAlarms {
  const rows = (Array.isArray(runs) ? runs : []).filter(
    (r): r is FleetRunTelemetry => !!r && typeof r === "object" && !Array.isArray(r),
  );
  const cold: string[] = [];
  const overCalls: string[] = [];
  const fabricated: string[] = [];
  rows.forEach((r, i) => {
    const brief = typeof r.brief === "string" && r.brief.trim() ? r.brief.trim() : `run-${i + 1}`;
    const chunks = finiteNonNeg(r.chunks) ?? 0;
    const cached = finiteNonNeg(r.cachedPromptTokens);
    if (r.keyed === true && chunks >= FLEET_ALARM_THRESHOLDS.cache.minChunks && cached === 0) cold.push(brief);
    const calls = finiteNonNeg(r.calls);
    if (calls !== null && calls > FLEET_ALARM_THRESHOLDS.synthesisCalls.perRunMax) overCalls.push(`${brief} (${calls})`);
    if (r.estimatedCostUsd !== null && r.estimatedCostUsd !== undefined) fabricated.push(brief);
  });
  const metrics = fleetMetrics(rows);
  const cacheCold: FleetAlarm = {
    id: "cache-cold",
    tripped: cold.length > 0,
    detail: cold.length
      ? `keyed run(s) with ≥${FLEET_ALARM_THRESHOLDS.cache.minChunks} chunks and cachedPromptTokens===0: ${cold.join(", ")}`
      : "no keyed ≥2-chunk run reported a zero cache hit",
  };
  const synthesisCalls: FleetAlarm = {
    id: "synthesis-calls",
    tripped: overCalls.length > 0,
    detail: overCalls.length
      ? `run(s) over the ${FLEET_ALARM_THRESHOLDS.synthesisCalls.perRunMax}-call cap: ${overCalls.join(", ")}`
      : `every run is within the ${FLEET_ALARM_THRESHOLDS.synthesisCalls.perRunMax}-call cap`,
  };
  const rubricBelowTarget: FleetAlarm = {
    id: "rubric-below-target",
    tripped: metrics.rubricMean !== null && metrics.rubricMean < FLEET_ALARM_THRESHOLDS.rubric.meanMin,
    detail:
      metrics.rubricMean === null
        ? "no rubric scores reported — nothing to compare against the target"
        : `rubric mean ${metrics.rubricMean.toFixed(2)}/${FLEET_ALARM_THRESHOLDS.rubric.scale} vs target ≥${FLEET_ALARM_THRESHOLDS.rubric.meanMin}`,
  };
  const evidenceHashCollision: FleetAlarm = {
    id: "evidence-hash-collision",
    tripped: metrics.duplicateEvidenceHashes.length > 0,
    detail: metrics.duplicateEvidenceHashes.length
      ? `evidenceHash shared across distinct briefs: ${metrics.duplicateEvidenceHashes.join(", ")}`
      : "every evidenceHash is unique to its brief",
  };
  const spendFabricated: FleetAlarm = {
    id: "spend-fabricated",
    tripped: fabricated.length > 0,
    detail: fabricated.length
      ? `run(s) report a non-null estimatedCostUsd (spend must stay null): ${fabricated.join(", ")}`
      : "no run fabricates a cost estimate (estimatedCostUsd stays null)",
  };
  const alarms = { cacheCold, synthesisCalls, rubricBelowTarget, evidenceHashCollision, spendFabricated };
  return {
    ...alarms,
    tripped: Object.values(alarms).some((a) => a.tripped),
  };
}
