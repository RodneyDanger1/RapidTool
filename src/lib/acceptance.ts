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
};

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
