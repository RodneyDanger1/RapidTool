// ---------------------------------------------------------------------------
// Brief-fixture core (P0-1 oracle, F2 wave — fixes/157 §4 P0-1 + fixes/158_s2 A1/A2)
// brief-fixtures.ts — PURE, deterministic, zero-dep (no LLM / fs / network).
//
// What this is: the machine half of the behavioral oracle. A7 oracle rows are
// prose (`given ⇒ expect` sentences, algorithms.ts buildTestOracle) and corpus
// expectedCapabilities are prose too — prose carries NO executable literals, so
// a deterministic drafter can never mint concrete input→output semantics from it
// without inventing them. Per fixes/158_s2 A1 the concrete literals come from the
// producer (the LLM-assisted draft stage / the human) as a `typed` map; THIS
// module turns those typed literals into frozen candidate fixture cases with
// correct binding, kind triage, ids, and approval state, and red-cards every row
// that would otherwise be vacuous (a case with zero concrete literals asserts
// nothing — A1's deterministic shape gate rejects it; red cards go back to the
// human with the A2 approve step).
//
// Honesty contract (155_web_functional R2 / 157 §2): the machine DRAFTS, a human
// APPROVES. Every drafted case is born `approval:"pending"`. Nothing in this
// module — drafter, validator, gate — ever flips a case to "approved"; only the
// explicit, human-invoked approveFixtureCases() helper does, and the drafter
// never calls it. A run may claim "functional" only when fixtureApprovalGate()
// reports ok (every case approved AND ≥1 case exists).
//
// Determinism: same args ⇒ deep-equal result (no Date.now, no Math.random, no
// object-key iteration order dependence — capabilities are indexed 1..N in input
// order and oracle rows keep their input order).
//
// Run: node --experimental-strip-types --test src/lib/brief-fixtures.test.ts
// ---------------------------------------------------------------------------
import type { OracleTest } from "./types.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export const BRIEF_FIXTURE_KINDS = ["pure", "effect", "property"] as const;
/** pure = given ⇒ returned-output shape equality · effect = side effect or
 *  rejection (throws) asserted · property = named invariant (registry-pinned). */
export type BriefFixtureKind = (typeof BRIEF_FIXTURE_KINDS)[number];

export const BRIEF_FIXTURE_SOURCES = ["a7", "capability", "human"] as const;
export type BriefFixtureSource = (typeof BRIEF_FIXTURE_SOURCES)[number];

export const BRIEF_FIXTURE_APPROVALS = ["pending", "approved"] as const;
export type BriefFixtureApproval = (typeof BRIEF_FIXTURE_APPROVALS)[number];

/**
 * Provenance of an approval flip (184 / 207). NEVER defaulted to `"human"`.
 * Draft paths never set this. Only an explicit opts.decidedBy on
 * approveFixtureCases stamps it — agents must not mint `decidedBy:"human"`.
 */
export const BRIEF_FIXTURE_DECIDED_BY = ["human", "autopilot"] as const;
export type BriefFixtureDecidedBy = (typeof BRIEF_FIXTURE_DECIDED_BY)[number];

/**
 * Typed output predicate — a deterministic CHECK DESCRIPTOR, never free text and
 * never executable code:
 * - shape  — `value` is a plain JSON literal; the harness asserts
 *            deepEqual(actual, value) (e.g. createProperty({address,owner})
 *            ⇒ {id, history: []} becomes value: {id: "<draft>", history: []}).
 * - throws — rejection row; the harness asserts the thrown message CONTAINS
 *            `messagePattern` (plain substring, not a regex, not code).
 * - property — named invariant from the approved invariant registry (A5-iv);
 *            format-checked here (identifier, no free text); the registry pins
 *            the name set at approval time.
 */
export type BriefFixtureExpect =
  | { kind: "shape"; value: unknown }
  | { kind: "throws"; messagePattern: string }
  | { kind: "property"; name: string };

/** One frozen candidate/approved fixture case (P0-1 A1 data model). */
export type BriefFixtureCase = {
  /** Stable unique id. For A7 rows it IS the oracle row id (orc-N / orc-c-*),
   *  so the E-08 pinning seam (missingOracleCaseIds) works on case ids directly;
   *  for corpus capabilities it is cap-<n> (n = 1-based index in input order). */
  id: string;
  /** req-N | corpus-capability id (cap-<n>) | A7 oracle row id — the requirement
   *  the future harness resolves to an entry export. */
  requirementId: string;
  /** The capability this case pins: the A7 row's job for a7-sourced cases, the
   *  expectedCapabilities prose for capability-sourced cases. */
  capability: string;
  /** Human-readable case name (A7 row.name, or a deterministic headline of the
   *  capability prose). */
  name: string;
  /** Typed input literal (plain JSON). Runner convention (A3): pass to the
   *  resolved entry export; a JSON object may encode {args: [...]} for
   *  multi-argument targets — the A3 emitter owns the exact call shape. */
  given: unknown;
  /** Typed output predicate (descriptor above). */
  expect: BriefFixtureExpect;
  kind: BriefFixtureKind;
  /** Who authored this case: the A7 oracle row, the corpus capability, or a
   *  human (human-authored cases may arrive pre-approved via approveFixtureCases). */
  source: BriefFixtureSource;
  /** Human-approval state. PENDING by construction from the drafter; the only
   *  writer of "approved" is the explicit human-invoked approval helper. */
  approval: BriefFixtureApproval;
  /**
   * Who flipped approval → approved. Absent on drafts. Never defaulted to
   * `"human"` (184/207) — only explicit approveFixtureCases opts stamp it.
   * Agents must not mint `decidedBy:"human"`.
   */
  decidedBy?: BriefFixtureDecidedBy;
  /**
   * C2 (fixes/162 A1): entry export the harness calls. Absent on legacy
   * drafts; when present it is a non-empty identifier the A2 emitter binds.
   */
  target?: string;
};

/** Producer-authored typed literals that make a draft non-vacuous. */
export type BriefFixtureTypedDraft = {
  given: unknown;
  expect: BriefFixtureExpect;
  kind?: BriefFixtureKind;
};

export type DraftBriefFixturesArgs = {
  /** A7 oracle rows (prose given⇒expect), in stable order. */
  oracle: OracleTest[];
  /** Corpus expectedCapabilities (prose), in stable order. Absent/empty ⇒ the
   *  advisory path drafts every eligible row (no corpus coverage filter). */
  capabilities?: string[];
  /** Typed literals keyed by `row.id` (e.g. "orc-1") or `cap-<n>` for
   *  capabilities. Rows/capabilities without a typed entry are red-carded as
   *  vacuous — the deterministic shape gate rejects zero-literal cases. */
  typed?: Record<string, BriefFixtureTypedDraft>;
};

export type BriefFixtureRedCard = {
  ref: string;
  reason: string;
};

export type BriefFixtureDraft = {
  /** Candidate cases — ALL approval:"pending". Never empty when red cards rule
   *  the input; the approval gate blocks on both empty and unapproved sets. */
  cases: BriefFixtureCase[];
  /** Red cards: eligible rows/capabilities the drafter could not turn into a
   *  non-vacuous case (answers belong to the human at the A2 approve step). */
  redCards: BriefFixtureRedCard[];
};

/**
 * A1-01 (fixes/344): the reserved draft sentinels. The deterministic floor
 * (draftTypedLiterals) writes them where a real typed literal is missing —
 * "<draft>" as a shape value, "<any>" as the legacy wildcard. They are NOT
 * data: a case whose given/expect carries one asserts nothing real, so no
 * layer may treat it as a substantive acceptance bar.
 */
const PLACEHOLDER_DRAFT = "<draft>";
const PLACEHOLDER_ANY = "<any>";
export const BRIEF_FIXTURE_PLACEHOLDERS = [PLACEHOLDER_DRAFT, PLACEHOLDER_ANY] as const;

/**
 * A5.0: producer-authored typed literals so draftBriefFixtures is not vacuous.
 * Deterministic floor (no LLM): empty given + shape `{id:"<draft>"}` or a
 * throws pattern for constraint rows. Never sets approval. The human still
 * must `--approve`.
 */
export function draftTypedLiterals(args: {
  oracle: OracleTest[];
  capabilities?: string[];
}): Record<string, BriefFixtureTypedDraft> {
  const typed: Record<string, BriefFixtureTypedDraft> = {};
  for (const row of Array.isArray(args.oracle) ? args.oracle : []) {
    if (!row || typeof row.id !== "string" || row.id.length === 0) continue;
    if (isControlRow(row)) continue;
    const constraint = isConstraintRow(row);
    typed[row.id] = {
      given: {},
      // A1-01: the floor's literals are SENTINELS, never guessed assertions.
      // The constraint arm used a hardcoded "invalid" message pattern, which
      // fixtureCaseIsPlaceholder did not flag — so a constraint-only floor set
      // passed fixtureApprovalGate/approvedAcceptanceFixtures as if it were a
      // substantive acceptance bar (the exact claim A1-01 forbids).
      expect: constraint
        ? { kind: "throws", messagePattern: PLACEHOLDER_DRAFT }
        : { kind: "shape", value: { id: PLACEHOLDER_DRAFT } },
      kind: constraint ? "effect" : "pure",
    };
  }
  (Array.isArray(args.capabilities) ? args.capabilities : []).forEach((cap, i) => {
    if (typeof cap !== "string" || cap.trim().length === 0) return;
    typed[`cap-${i + 1}`] = {
      given: {},
      expect: { kind: "shape", value: { id: PLACEHOLDER_DRAFT } },
      kind: "pure",
    };
  });
  return typed;
}

/** Additive merge: never clobber already-approved ids (A5). */
export function mergeDraftedFixtures(
  existing: readonly BriefFixtureCase[] | undefined,
  drafted: readonly BriefFixtureCase[],
): BriefFixtureCase[] {
  const kept = (existing ?? []).filter((c) => c.approval === "approved");
  const approvedIds = new Set(kept.map((c) => c.id));
  return [...kept, ...drafted.filter((c) => !approvedIds.has(c.id))];
}

export type BriefFixtureValidation = { ok: boolean; errors: string[] };

export type BriefFixtureGate = {
  ok: boolean;
  total: number;
  approved: number;
  unapproved: BriefFixtureCase[];
  unapprovedIds: string[];
  /** A1-01 (fixes/344): approved rows that are placeholder-only (sentinel
   *  "<draft>"/"<any>" literals). They assert nothing real, so a set carrying
   *  one cannot satisfy the gate even when every row is "approved". */
  placeholder: BriefFixtureCase[];
  placeholderIds: string[];
};

// ---------------------------------------------------------------------------
// Deterministic derivation lexicons + helpers (pure)
// ---------------------------------------------------------------------------

/** A7 rows that describe engine/control-plane behavior, not an executable
 *  function target (buildTestOracle's trailing "graph.no-skip" row is the
 *  canonical example) — never drafted. */
export const BRIEF_FIXTURE_CONTROL_JOBS = ["graph", "workflow", "engine", "system"] as const;

const SIDE_EFFECT_WORDS = [
  "email",
  "remind",
  "notify",
  "calendar",
  "sync",
  "book",
  "booking",
  "payroll",
  "persist",
  "publish",
  "send",
  "feed",
  "accumulate",
  "roll",
  "schedule",
  "timesheet",
  "ledger",
] as const;

const INVARIANT_WORDS = ["always", "never", "invariant", "guaranteed", "each", "every"] as const;

const CAPABILITY_HEADLINE_MAX = 88;

function headlineOf(text: string, max = CAPABILITY_HEADLINE_MAX): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const cut = cleaned.slice(0, max).replace(/[;:,]+$/, "").trim();
  return cut.length < cleaned.length ? `${cut}…` : cut;
}

function isConstraintRow(row: OracleTest): boolean {
  return (
    /^orc-c-/.test(row.id) ||
    row.name.startsWith("constraint.") ||
    /\b(violates|invalid|reject|refus|forbid|denied|illegal)\b/i.test(`${row.given} ${row.expect}`)
  );
}

function isControlRow(row: OracleTest): boolean {
  if (row.id === "orc-phase" || row.name.startsWith("graph.")) return true;
  return (BRIEF_FIXTURE_CONTROL_JOBS as readonly string[]).includes(row.job);
}

/** Throws-pattern for a constraint row: the offending token run the prose names
 *  (deterministic — after "violates ", else the constraint name minus its
 *  "constraint." prefix, else the id minus "orc-c-", else the row's job). Never
 *  a regex or code. */
function constraintPattern(row: OracleTest): string {
  const violates = /violates\s+([A-Za-z0-9._-]+)/i.exec(row.given);
  if (violates) return violates[1];
  if (row.name.startsWith("constraint.")) {
    const fromName = row.name.replace(/^constraint\./, "").trim();
    if (fromName.length > 0) return fromName;
  }
  const fromId = row.id.replace(/^orc-c-/, "").trim();
  if (fromId.length > 0 && fromId !== row.id) return fromId;
  return row.job.trim();
}

/** Capability-kind triage (deterministic; property > effect > pure). */
export function deriveCapabilityKind(prose: string): BriefFixtureKind {
  const low = prose.toLowerCase();
  if (INVARIANT_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(low))) return "property";
  if (SIDE_EFFECT_WORDS.some((w) => low.includes(w))) return "effect";
  return "pure";
}

/** Does the A7 row's job fall under at least one expectedCapability prose?
 *  Deterministic token/substring coverage (len ≥ 3 guard against glue words). */
export function jobCoveredByCapabilities(job: string, capabilities: readonly string[]): boolean {
  const j = job.toLowerCase();
  if (j.length < 3 || capabilities.length === 0) return capabilities.length === 0;
  const jobTokens = new Set(j.split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
  for (const cap of capabilities) {
    const c = cap.toLowerCase();
    if (c.includes(j)) return true;
    const capTokens = c.split(/[^a-z0-9]+/);
    for (const t of jobTokens) if (capTokens.includes(t)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// draftBriefFixtures — the deterministic drafter (P0-1 A1 machine half)
// ---------------------------------------------------------------------------

export function draftBriefFixtures(args: DraftBriefFixturesArgs): BriefFixtureDraft {
  const oracle = Array.isArray(args.oracle) ? args.oracle : [];
  const capabilities = Array.isArray(args.capabilities) ? args.capabilities : [];
  const typed = (args.typed ?? {}) as Record<string, BriefFixtureTypedDraft>;
  const cases: BriefFixtureCase[] = [];
  const redCards: BriefFixtureRedCard[] = [];
  const seenRequirementIds = new Set<string>();

  // --- A7 oracle rows (stable input order) ---------------------------------
  for (const row of oracle) {
    const ref = row.id;
    if (typeof ref !== "string" || ref.length === 0) {
      redCards.push({ ref: "<unnamed>", reason: "malformed A7 row — missing id" });
      continue;
    }
    if (typeof row.name !== "string" || row.name.length === 0 || typeof row.job !== "string") {
      redCards.push({ ref, reason: "malformed A7 row — missing name or job" });
      continue;
    }
    if (isControlRow(row)) {
      redCards.push({ ref, reason: "control-plane row — no executable function target" });
      continue;
    }
    if (capabilities.length > 0 && !jobCoveredByCapabilities(row.job, capabilities)) {
      redCards.push({ ref, reason: `no capability coverage — job "${row.job}" matches no expectedCapability` });
      continue;
    }
    if (seenRequirementIds.has(ref)) {
      redCards.push({ ref, reason: "duplicate A7 row id — requirement already drafted" });
      continue;
    }
    const t = typed[ref];
    if (!t || typeof t !== "object" || !("given" in t) || !t.expect) {
      redCards.push({
        ref,
        reason:
          `vacuous draft — A7 prose carries no executable literals; supply typed["${ref}"] ` +
          "(producer-authored given/expect) or author the case by hand",
      });
      continue;
    }
    const kind = t.kind ?? (isConstraintRow(row) ? "effect" : "pure");
    const expect =
      isConstraintRow(row) && t.expect.kind !== "throws"
        ? ({ kind: "throws", messagePattern: constraintPattern(row) } as const)
        : t.expect;
    seenRequirementIds.add(ref);
    cases.push({
      id: ref,
      requirementId: ref,
      capability: row.job,
      name: row.name,
      given: t.given,
      expect,
      kind,
      source: "a7",
      approval: "pending",
    });
  }

  // --- Corpus expectedCapabilities (stable input order; cap-<n> ids) --------
  capabilities.forEach((capProse, i) => {
    const ref = `cap-${i + 1}`;
    const prose = typeof capProse === "string" ? capProse.trim() : "";
    if (prose.length === 0) {
      redCards.push({ ref, reason: "empty capability prose" });
      return;
    }
    if (seenRequirementIds.has(ref)) {
      redCards.push({ ref, reason: "duplicate capability id — already drafted" });
      return;
    }
    const t = typed[ref];
    if (!t || typeof t !== "object" || !("given" in t) || !t.expect) {
      redCards.push({
        ref,
        reason:
          `vacuous draft — capability prose carries no executable literals; supply typed["${ref}"] ` +
          "(producer-authored given/expect) or author the case by hand",
      });
      return;
    }
    seenRequirementIds.add(ref);
    cases.push({
      id: ref,
      requirementId: ref,
      capability: prose,
      name: headlineOf(prose),
      given: t.given,
      expect: t.expect,
      kind: t.kind ?? deriveCapabilityKind(prose),
      source: "capability",
      approval: "pending",
    });
  });

  return { cases, redCards };
}

// ---------------------------------------------------------------------------
// validateFixtureCase / validateFixtureSet — the deterministic shape gate (A1)
// ---------------------------------------------------------------------------

const CODE_MARKERS = [
  "=>",
  "`",
  "function",
  "return ",
  "class ",
  "new ",
  "eval(",
  "require(",
  "process.",
  "import ",
  "export ",
] as const;

/** True when the string carries JS code markers — a "code string" a fixture
 *  literal must never contain (fixtures are data, never executable text). */
export function containsCodeString(s: string): boolean {
  for (const marker of CODE_MARKERS) {
    if (s.includes(marker)) return true;
  }
  return false;
}

const PROPERTY_NAME_RE = /^[a-z][a-zA-Z0-9_]{0,63}$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Plain JSON literal: a value JSON can carry losslessly — no undefined-valued
 *  props, NaN/Infinity, functions, bigint, symbols, Dates, RegExps, class
 *  instances, or cycles. Arrays/objects/primitives pass. */
export function isPlainJsonLiteral(v: unknown): boolean {
  if (v === null) return true;
  const t = typeof v;
  if (t === "string" || t === "boolean") return true;
  if (t === "number") return Number.isFinite(v);
  if (t === "object") {
    if (Array.isArray(v)) return v.every((item) => isPlainJsonLiteral(item));
    if (v instanceof Date || v instanceof RegExp || v instanceof Map || v instanceof Set) return false;
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return false;
    return Object.keys(v as object).every((key) => isPlainJsonLiteral((v as Record<string, unknown>)[key]));
  }
  return false; // function / symbol / bigint / undefined
}

/** Recursively assert every string leaf is code-string-free. */
function stringLeavesAreClean(v: unknown, path: string, errors: string[]): void {
  if (typeof v === "string") {
    if (containsCodeString(v)) errors.push(`${path}: string carries JS code markers`);
    return;
  }
  if (Array.isArray(v)) {
    v.forEach((item, i) => stringLeavesAreClean(item, `${path}[${i}]`, errors));
    return;
  }
  if (isPlainObject(v)) {
    for (const key of Object.keys(v)) {
      stringLeavesAreClean(v[key], `${path}.${key}`, errors);
    }
  }
}

/** Shape-check ONE candidate case. Set-level uniqueness is validateFixtureSet's
 *  job (needs the sibling set); everything else is per-case. */
export function validateFixtureCase(c: BriefFixtureCase): BriefFixtureValidation {
  const errors: string[] = [];

  if (!isPlainObject(c)) {
    return { ok: false, errors: ["case is not an object"] };
  }
  if (typeof c.id !== "string" || c.id.length === 0) errors.push("id: non-empty string required");
  if (typeof c.requirementId !== "string" || c.requirementId.length === 0)
    errors.push("requirementId: non-empty string required");
  if (typeof c.capability !== "string" || c.capability.length === 0)
    errors.push("capability: non-empty string required");
  if (typeof c.name !== "string" || c.name.length === 0) errors.push("name: non-empty string required");
  if (!(BRIEF_FIXTURE_KINDS as readonly string[]).includes(c.kind))
    errors.push(`kind: must be one of ${BRIEF_FIXTURE_KINDS.join("|")}`);
  if (!(BRIEF_FIXTURE_SOURCES as readonly string[]).includes(c.source))
    errors.push(`source: must be one of ${BRIEF_FIXTURE_SOURCES.join("|")}`);
  if (!(BRIEF_FIXTURE_APPROVALS as readonly string[]).includes(c.approval))
    errors.push(`approval: must be one of ${BRIEF_FIXTURE_APPROVALS.join("|")}`);
  const decidedBy = (c as { decidedBy?: unknown }).decidedBy;
  if (decidedBy !== undefined) {
    if (!(BRIEF_FIXTURE_DECIDED_BY as readonly string[]).includes(decidedBy as string)) {
      errors.push(`decidedBy: must be one of ${BRIEF_FIXTURE_DECIDED_BY.join("|")} when present`);
    }
  }

  // given: a plain JSON literal (never code, never a runtime object).
  if (!isPlainJsonLiteral(c.given)) {
    errors.push("given: must be a plain JSON literal (no functions/undefined/NaN/cycles)");
  } else {
    stringLeavesAreClean(c.given, "given", errors);
  }

  // expect: a supported descriptor, shape-checked per kind.
  const ex = c.expect as BriefFixtureExpect | null | undefined;
  if (!ex || typeof ex !== "object") {
    errors.push("expect: descriptor required");
  } else if (ex.kind === "shape") {
    if (!isPlainJsonLiteral(ex.value)) {
      errors.push("expect.value: must be a plain JSON literal");
    } else {
      stringLeavesAreClean(ex.value, "expect.value", errors);
    }
  } else if (ex.kind === "throws") {
    if (typeof ex.messagePattern !== "string" || ex.messagePattern.length === 0) {
      errors.push("expect.messagePattern: non-empty plain string required");
    } else if (containsCodeString(ex.messagePattern)) {
      errors.push("expect.messagePattern: string carries JS code markers (plain substring only)");
    }
  } else if (ex.kind === "property") {
    if (typeof ex.name !== "string" || !PROPERTY_NAME_RE.test(ex.name)) {
      errors.push(
        "expect.name: registry identifier required (lowerCamel, no spaces/free text) — the approved invariant registry pins the name set",
      );
    }
  } else {
    errors.push("expect.kind: must be one of shape|throws|property");
  }

  // C2: optional target — when present, a non-empty identifier (entry export).
  const target = (c as { target?: unknown }).target;
  if (target !== undefined) {
    if (typeof target !== "string" || target.trim().length === 0) {
      errors.push("target: non-empty string when present");
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Set-level shape gate: every case individually valid AND ids unique. */
export function validateFixtureSet(cases: readonly BriefFixtureCase[]): BriefFixtureValidation {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const c of cases) {
    const one = validateFixtureCase(c);
    for (const e of one.errors) errors.push(e);
    if (seen.has(c.id)) errors.push(`duplicate case id: "${c.id}"`);
    seen.add(c.id);
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Approval gate (P0-1 A2 machine half) — blocks claims, never approves
// ---------------------------------------------------------------------------

/** A run may only claim "functional" when ≥1 case exists AND every case is
 *  approved. Pending cases are returned so the caller can surface exactly which
 *  requirements are blocking. This gate NEVER flips approval — it only reads. */
export function fixtureApprovalGate(cases: readonly BriefFixtureCase[]): BriefFixtureGate {
  const list = Array.isArray(cases) ? cases : [];
  const unapproved = list.filter((c) => c.approval !== "approved");
  // A1-01 (fixes/344): an approved-but-placeholder row asserts nothing real —
  // it blocks the gate exactly like an unapproved row, so a run can never claim
  // "functional" over a set of sentinels.
  const placeholder = list.filter((c) => c.approval === "approved" && fixtureCaseIsPlaceholder(c));
  return {
    ok: list.length > 0 && unapproved.length === 0 && placeholder.length === 0,
    total: list.length,
    approved: list.length - unapproved.length,
    unapproved,
    unapprovedIds: unapproved.map((c) => c.id),
    placeholder,
    placeholderIds: placeholder.map((c) => c.id),
  };
}

// ---------------------------------------------------------------------------
// Explicit human approval helper (the ONLY writer of "approved")
// ---------------------------------------------------------------------------

export type ApproveFixtureOpts = {
  /**
   * Provenance of this approve. REQUIRED to stamp `decidedBy` on the case.
   * NEVER defaulted — omitting opts leaves `decidedBy` absent (does not mint
   * `decidedBy:"human"`). Callers that are not a human seat must pass
   * `"autopilot"` (or omit) rather than forging `"human"`.
   */
  decidedBy?: BriefFixtureDecidedBy;
};

/**
 * Pure, explicit approval flip for the named case ids. The
 * drafter/validator/gate never call this — only the A2 human-approve verb/UI
 * (or an honest autopilot seat) may. Unknown ids are ignored. Returns a NEW
 * array (input untouched).
 *
 * decidedBy is NEVER defaulted to `"human"` (184/207 residual). Draft paths
 * never set it. Agent code must not pass `decidedBy:"human"`.
 */
export function approveFixtureCases(
  cases: readonly BriefFixtureCase[],
  ids: readonly string[],
  opts?: ApproveFixtureOpts,
): BriefFixtureCase[] {
  const wanted = new Set(ids);
  const decidedBy = opts?.decidedBy;
  if (decidedBy !== undefined && !(BRIEF_FIXTURE_DECIDED_BY as readonly string[]).includes(decidedBy)) {
    // Coded refusal (errors.ts registry) so an A2 caller classifies the bad
    // seat on the code, never on the message.
    const err = new Error(
      `approveFixtureCases: decidedBy must be one of ${BRIEF_FIXTURE_DECIDED_BY.join("|")} when provided`,
    ) as Error & { code?: string };
    err.code = "RT_E_VALIDATION";
    throw err;
  }
  return cases.map((c) => {
    if (!wanted.has(c.id)) return c;
    // Spread then set approval; strip any forged decidedBy unless opts stamps one.
    const { decidedBy: _forged, ...rest } = c;
    const next: BriefFixtureCase = { ...rest, approval: "approved" as const };
    if (decidedBy !== undefined) {
      next.decidedBy = decidedBy;
    }
    // else: deliberately omit decidedBy — never mint decidedBy:"human"
    return next;
  });
}

/** Approve every case (the "accept the whole drafted set" A2 action). */
export function approveAllFixtureCases(
  cases: readonly BriefFixtureCase[],
  opts?: ApproveFixtureOpts,
): BriefFixtureCase[] {
  return approveFixtureCases(
    cases,
    cases.map((c) => c.id),
    opts,
  );
}

/**
 * A2 (fixes/162): the emit guard. Returns the frozen approved set only when
 * EVERY case is `approval:"approved"` and the set is non-empty. Partial
 * approval → null (emit stays byte-identical to the no-fixture path).
 */
export function approvedAcceptanceFixtures(raw: unknown): BriefFixtureCase[] | null {
  const c = coerceAcceptanceFixtures(raw);
  if (!c.value || c.value.length === 0) return null;
  if (!c.value.every((f) => f.approval === "approved")) return null;
  // A1-01 (fixes/344): an approved set that still carries draft sentinels
  // asserts nothing real — it is NOT a substantive acceptance bar, so the emit
  // guard refuses it exactly like a partial approval (byte-identical to the
  // no-fixture emission). A real typed-literal set is unaffected.
  if (c.value.some(fixtureCaseIsPlaceholder)) return null;
  return c.value;
}

/**
 * A1-01 (fixes/344): the reserved draft sentinels are declared with the drafter
 * (draftTypedLiterals) above; these predicates read them.
 */

/** True when any string leaf of `v` is a draft sentinel. Fixtures are plain
 *  JSON literals by validateFixtureCase, so this recursion is cycle-free. */
export function fixtureValueIsPlaceholder(v: unknown): boolean {
  if (typeof v === "string") return (BRIEF_FIXTURE_PLACEHOLDERS as readonly string[]).includes(v);
  if (Array.isArray(v)) return v.some((item) => fixtureValueIsPlaceholder(item));
  if (v !== null && typeof v === "object") {
    return Object.keys(v as object).some((k) => fixtureValueIsPlaceholder((v as Record<string, unknown>)[k]));
  }
  return false;
}

/** 346 E1 (L1-F5): an EMPTY OBJECT shape expectation (`{}`) makes
 *  `__fxPartialMatch(actual, {})` vacuously true for ANY object (its
 *  `Object.keys(expected).every(...)` runs over zero keys). An empty ARRAY is
 *  NOT vacuous: the helper's array branch requires `actual.length ===
 *  expected.length`, so `[]` is a real exact-length assertion (it rejects a
 *  non-empty array, an object, or a primitive) — 346 A6. Pure. */
export function fixtureShapeValueIsVacuous(v: unknown): boolean {
  if (Array.isArray(v)) return false;
  if (v !== null && typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

/** A case is "placeholder-only" (asserts nothing real) when its given or its
 *  expect literal carries a draft sentinel, OR its expect.shape value is an
 *  empty OBJECT (346 E1 · L1-F5: `{}` is vacuous, not substantive; an empty
 *  array is a real assertion — 346 A6). Such a row can never be an acceptance
 *  bar. A real typed-literal case is unaffected. */
export function fixtureCaseIsPlaceholder(c: unknown): boolean {
  if (!c || typeof c !== "object") return false;
  const rec = c as BriefFixtureCase;
  if (fixtureValueIsPlaceholder(rec.given)) return true;
  const ex = rec.expect;
  if (ex && typeof ex === "object" && ex.kind === "shape") {
    if (fixtureValueIsPlaceholder(ex.value)) return true;
    if (fixtureShapeValueIsVacuous(ex.value)) return true;
    return false;
  }
  if (ex && typeof ex === "object" && ex.kind === "throws") return fixtureValueIsPlaceholder(ex.messagePattern);
  return false;
}

/** True when any case of the set is placeholder-only. Absent/non-list ⇒ false. */
export function fixturesHavePlaceholder(cases: readonly unknown[] | null | undefined): boolean {
  return Array.isArray(cases) && cases.some(fixtureCaseIsPlaceholder);
}

/**
 * A2: compile ONE approved fixture into the body of a node:test callback.
 * Assumes a namespace `entry` (the tree barrel / host module) is in scope.
 * `given` is JSON.stringified — never interpolated. `throws` is substring
 * includes (not regex). `property` is a red-card (no registry).
 */
export function compileFixtureAssertion(c: BriefFixtureCase): { ok: true; body: string } | { ok: false; reason: string } {
  if (!c || typeof c !== "object") return { ok: false, reason: "case is not an object" };
  if (c.expect?.kind === "shape" && fixtureShapeValueIsVacuous(c.expect.value)) {
    return {
      ok: false,
      reason:
        "expect.shape value is an empty object ({}) — __fxPartialMatch is vacuously true for any object; supply at least one expected key (an empty array [] is a real assertion and is accepted)",
    };
  }
  // A1-01 (fixes/344): a draft sentinel asserts nothing real. Red-card it (the
  // emitter turns a red card into a visible assert.fail) — never a vacuous
  // always-true assertion.
  if (fixtureCaseIsPlaceholder(c)) {
    return {
      ok: false,
      reason: `placeholder sentinel literal (${BRIEF_FIXTURE_PLACEHOLDERS.join("/")}) — draft rows assert nothing; supply producer-authored typed literals`,
    };
  }
  if (c.expect?.kind === "property") {
    return { ok: false, reason: "property fixtures have no registry (C5 red-card)" };
  }
  const target = typeof c.target === "string" ? c.target.trim() : "";
  if (!target) return { ok: false, reason: "no target export (C2)" };
  const givenLit = JSON.stringify(c.given);
  const call = [
    `  const __fn = (entry as Record<string, unknown>)[${JSON.stringify(target)}];`,
    `  assert.equal(typeof __fn, "function", ${JSON.stringify(`fixture ${c.id}: export ${target} is not a function`)});`,
    `  const __given = ${givenLit} as unknown;`,
    `  const __args = __given !== null && typeof __given === "object" && !Array.isArray(__given) && Array.isArray((__given as { args?: unknown }).args)`,
    `    ? ((__given as { args: unknown[] }).args)`,
    `    : [__given];`,
  ];
  if (c.expect?.kind === "throws") {
    const pat = JSON.stringify(c.expect.messagePattern);
    return {
      ok: true,
      body: [
        ...call,
        `  let __threw: unknown = undefined;`,
        `  try { (__fn as (...a: unknown[]) => unknown)(...__args); } catch (e) { __threw = e; }`,
        `  assert.ok(__threw !== undefined, ${JSON.stringify(`fixture ${c.id}: expected throw`)});`,
        `  const __msg = String((__threw as { message?: unknown })?.message ?? __threw);`,
        `  assert.ok(__msg.includes(${pat}), ${JSON.stringify(`fixture ${c.id}: throw message must include the pattern`)} + " — got: " + __msg);`,
      ].join("\n"),
    };
  }
  if (c.expect?.kind === "shape") {
    const expLit = JSON.stringify(c.expect.value);
    return {
      ok: true,
      body: [
        ...call,
        `  const __actual = (__fn as (...a: unknown[]) => unknown)(...__args);`,
        `  assert.ok(__fxPartialMatch(__actual, ${expLit}), ${JSON.stringify(`fixture ${c.id}: return value did not partial-match expect.shape`)});`,
      ].join("\n"),
    };
  }
  return { ok: false, reason: "unsupported expect.kind" };
}

/** Runtime helper source emitted once into oracle.spec.ts when fixtures exist.
 *  A1-01 (fixes/344): no sentinel escape hatch — a "<draft>"/"<any>" literal
 *  compares exactly like any other value, so a placeholder row can never
 *  partial-match a real return value. */
export function fixtureMatchHelperSource(): string {
  return [
    `function __fxPartialMatch(actual: unknown, expected: unknown): boolean {`,
    `  if (expected !== null && typeof expected === "object" && actual !== null && typeof actual === "object") {`,
    `    if (Array.isArray(expected)) {`,
    `      if (!Array.isArray(actual) || actual.length !== expected.length) return false;`,
    `      return expected.every((e, i) => __fxPartialMatch(actual[i], e));`,
    `    }`,
    `    const exp = expected as Record<string, unknown>;`,
    `    const act = actual as Record<string, unknown>;`,
    `    return Object.keys(exp).every((k) => Object.prototype.hasOwnProperty.call(act, k) && __fxPartialMatch(act[k], exp[k]));`,
    `  }`,
    `  return Object.is(actual, expected);`,
    `}`,
  ].join("\n");
}

/**
 * A1 (fixes/162): coerce an unknown import/persist payload into a copied
 * fixture array. Invalid rows are dropped (never half-applied). Empty /
 * missing / non-array → ABSENCE (`undefined`), never `[]` — legacy payloads
 * stay byte-identical.
 */
export function coerceAcceptanceFixtures(raw: unknown): {
  value: BriefFixtureCase[] | undefined;
  dropped: number;
  containerDropped: boolean;
} {
  if (raw === undefined || raw === null) {
    return { value: undefined, dropped: 0, containerDropped: false };
  }
  if (!Array.isArray(raw)) {
    return { value: undefined, dropped: 0, containerDropped: true };
  }
  const kept: BriefFixtureCase[] = [];
  let dropped = 0;
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      dropped += 1;
      continue;
    }
    const rec = row as BriefFixtureCase;
    const v = validateFixtureCase(rec);
    if (!v.ok) {
      dropped += 1;
      continue;
    }
    const copy: BriefFixtureCase = {
      id: rec.id,
      requirementId: rec.requirementId,
      capability: rec.capability,
      name: rec.name,
      given: rec.given,
      expect: { ...rec.expect } as BriefFixtureExpect,
      kind: rec.kind,
      source: rec.source,
      approval: rec.approval,
    };
    // Copy decidedBy only when it is a real enum member — never invent "human".
    if (
      typeof (rec as { decidedBy?: unknown }).decidedBy === "string" &&
      (BRIEF_FIXTURE_DECIDED_BY as readonly string[]).includes((rec as { decidedBy: string }).decidedBy)
    ) {
      copy.decidedBy = (rec as { decidedBy: BriefFixtureDecidedBy }).decidedBy;
    }
    if (typeof rec.target === "string" && rec.target.trim().length > 0) {
      copy.target = rec.target.trim();
    }
    kept.push(copy);
  }
  return {
    value: kept.length > 0 ? kept : undefined,
    dropped,
    containerDropped: false,
  };
}
