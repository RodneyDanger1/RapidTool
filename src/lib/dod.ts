// W359 PAUSED 2026-10-15 - work in progress; see wave_plans/W359/HANDOFF.md for what landed, what is half-done and what is left.
// ---------------------------------------------------------------------------
// Machine-checkable Definition-of-Done gate registry (T8) â€” dod.ts
//
// Every phase 0..12 carries exit criteria expressed as *deterministic,
// defensive probes* over plain Project fields (artifacts, phase records,
// memory kinds, scorecard verdict, competitors, openapi/adr text, lastTest).
// runGate() evaluates the phase's DoD and returns a stable FNV-1a evidence
// hash over sorted "id:pass|fail" pairs so a recorded gate verdict can be
// re-verified later (PhaseRecord.gate.evidenceHash). readyFor() is the DoR
// side: prior phase sealed, phase not already complete, project not blocked.
// gateArtifact() renders a gate verdict as a normal "gate" artifact.
// recordGateInto() (E-02) is the shared pure gate-recorder (store.recordGate
// parity): stamps PhaseRecord.gate, swaps in the "gate" artifact and appends
// the gate.verdict log for a just-completed phase. DOD[6]'s additive
// p6-verified probe (E-07) is met only by a machine-promoted lastTest (label
// "tested" + evidenceHash) â€” p6-test stays the deterministic floor.
// oracleToCaseSeeds()/missingOracleCaseIds() (E-08) are the pure
// oracle-pinning seam consumed by the verify loop's case generation.
//
// Run: node --experimental-strip-types --test src/lib/gates.test.ts
// ---------------------------------------------------------------------------
import type { Artifact, DeliveryKind, HitlDecision, OracleTest, PhaseId, Project } from "./types.ts";
import type { ErrorCode } from "./errors.ts";
// W359 (resolve-kind): ONE TRUTH. The gate reads the engine's decision instead of
// replicating it â€” a second copy of a decision is not a parity problem, it is the
// defect (the copy was green while the corpus disagreed with the engine).
import { deliveryKindOf } from "./engine.ts";
import { canonicalStem, fnv1a } from "./algorithms.ts";
import { evaluatePolicy, seatLabel, seatTokenPath, type PolicySeat } from "./policy.ts";
import {
  BRIEF_STOPWORDS,
  briefFitCoverage,
  briefFitSubstancePasses,
  briefTokens,
  buildPhase6Module,
  implementationIdentifierHits,
} from "./sandbox.ts";

export type GateItem = {
  id: string;
  criterion: string;
  probe: (p: Project) => boolean;
  /** Optional honest STATE line for a FAILED probe. `runGate` appends it to the
   *  returned unmet item's `criterion` and exposes it as `reason`, so a RED
   *  criterion can name WHICH state the project is in (e.g. the deterministic
   *  keyless floor) instead of stranding a reader on a bare criterion. Registry
   *  items with nothing state-specific to say leave it unset. */
  unmetReason?: (p: Project) => string;
  /**
   * Optional honest QUALIFIER for a probe that PASSES but whose pass is not a
   * product-complete fact â€” the case this hook exists for is `p6-arch`'s
   * vacuous PASS when no tree exists (a SKIP). `runGate` reports it in its
   * `advisories` list, `gateArtifact` renders it, and it NEVER changes a
   * probe's pass/fail, the evidence hash, or any criterion. Absent â‡’ an
   * ordinary pass with nothing to qualify. Return a string, or an object with a
   * `code` (from `errors.ts`) so the qualifier is machine-classifiable.
   */
  advisory?: (p: Project) => string | { note: string; code?: ErrorCode } | null;
  /** `runGate`-only: the evaluated `unmetReason` (absent on registry items and
   *  on met criteria). */
  reason?: string;
  /**
   * The CLASS of evidence this criterion accepts when it passes. Additive and
   * honest: it never changes a probe's verdict or the evidence hash. It exists
   * so a green gate records WHAT it verified â€” e.g. `p6-verified` accepts an
   * EXECUTED tree-run (spec tests), NOT the emitted package.json's declared
   * `typecheck`/`build`, and `p6-arch` accepts a structural mapping that may be
   * a no-tree SKIP. Absent â‡’ `"field-predicate"`.
   */
  evidenceClass?: EvidenceClassName;
  /**
   * The registry code a FAILED criterion carries (from `errors.ts`). Additive:
   * `runGate` prepends it to the returned unmet `reason` so a red criterion is
   * machine-classifiable, never bare prose. Absent â‡’ no code (legacy items).
   */
  code?: ErrorCode;
};

/** A passed criterion whose pass is qualified (e.g. a SKIP, not product-complete). */
export type GateAdvisory = {
  id: string;
  criterion: string;
  note: string;
  /**
   * ADDITIVE (2026-10-06): the registry code naming WHAT was not verified by
   * this qualified pass (`RT_E_CLAIM_UNVERIFIED` for a pass that proves
   * presence/structure only; `RT_E_SUBSTANCE_EMPTY` for an empty-body artifact;
   * `RT_E_PLAN_UNDERPRODUCED` for a stub/as-yet-unimplemented surface). Absent
   * on a benign N/A pass that imposes no requirement. Never changes the verdict
   * or the evidence hash.
   */
  code?: ErrorCode;
};

/**
 * What a criterion's PASS actually attests. The names are deliberately narrow so
 * a reader cannot inflate a green gate into a stronger claim than the bytes
 * support (the `p6-verified` / `p6-arch` honesty gap this exists to close).
 */
export type EvidenceClassName =
  | "artifact-presence"
  | "ledger-record"
  | "field-predicate"
  | "executed-self-test"
  | "executed-tree-tests"
  | "structural-tree-map"
  | "lexical-brief-fit"
  | "product-surface-map"
  | "built-artifact";

/** One line per class explaining exactly what it verifies. */
export const EVIDENCE_CLASS_NOTE: Record<EvidenceClassName, string> = {
  "artifact-presence": "an artifact of the expected kind exists",
  "ledger-record": "a decision-ledger approval row records the actor",
  "field-predicate": "a plain project-field predicate holds",
  "executed-self-test": "the engine's deterministic template self-test executed and passed",
  "executed-tree-tests":
    "a machine tree-run executed the emitted tree's OWN spec tests â€” the emitted package.json's DECLARED typecheck/build were NOT run",
  "structural-tree-map":
    "a capabilityâ†’file structural mapping holds â€” an absent-tree pass is a SKIP, not product-complete",
  "lexical-brief-fit": "the brief's nouns appear as identifiers in the generated source",
  "product-surface-map":
    "the emitted bytes carry the surface the brief's kind demands (a page + nav path / a game input+loop+canvas / a runnable non-stub entry exposing the declared surface) â€” a STRUCTURAL byte read, NOT an execution",
  "built-artifact": "a real BUILT artifact (the emitted package's declared build actually ran)",
};

/**
 * The classes that attest the product was actually EXECUTED or BUILT. A PASS
 * whose met classes are all outside this set rests on presence/structure/ledger
 * evidence only â€” it must be read as "the bytes look right", never "the product
 * runs or builds". The single set both `buildEvidenceClass` and the acceptance
 * reader classify against.
 *
 * A3-E8 (2026-10-06): `executed-self-test` is deliberately NOT in this set. The
 * p6-test floor runs the ENGINE'S DETERMINISTIC TEMPLATE self-test â€” engine
 * code testing itself, not the emitted product â€” so a green gate whose only
 * executed arm is that floor is NON-executed product evidence and must be
 * qualified weak (`RT_E_CLAIM_UNVERIFIED`). The pre-fix set included it, which
 * let a green P6 gate resting on the placeholder read as an executed pass.
 * `executed-tree-tests` (the emitted tree's own specs) and `built-artifact`
 * (the declared build actually ran) remain the executed arms.
 */
export const EXECUTED_EVIDENCE_CLASSES: ReadonlySet<EvidenceClassName> = new Set([
  "executed-tree-tests",
  "built-artifact",
]);

/** A weak-evidence qualifier: a green gate whose met classes prove no execution. */
export type EvidenceQualification = {
  /** True iff â‰¥1 criterion passed and none was executed/built evidence. */
  weak: boolean;
  /** Why the pass is qualified (empty when not weak). */
  note: string;
  /** The registry code that names the class (`RT_E_CLAIM_UNVERIFIED`). */
  code: ErrorCode | null;
};

/**
 * The evidence-class reading a gate records alongside its verdict. Additive: it
 * never changes `pass`, `unmet`, `advisories` or `evidenceHash`.
 */
export type GateEvidenceClass = {
  /** Every criterion evaluated, with the class of its accepted/rejected evidence. */
  byCriterion: Array<{ id: string; accepted: boolean; class: EvidenceClassName; note: string }>;
  /** The classes of the MET criteria, deduped and sorted. */
  classes: EvidenceClassName[];
  /**
   * True iff some MET criterion is backed by a real BUILT artifact. No current
   * criterion is â€” `p6-verified` runs the emitted tree's own spec tests, not the
   * emitted package.json's declared `typecheck`/`build` â€” so a green P6 gate
   * reports `false`, and a green gate can never be read as "the emitted product
   * builds" when it was not built.
   */
  productBuildVerified: boolean;
  /** One sentence naming what a green gate did (and did not) verify. */
  note: string;
  /**
   * ACTIONABLE qualifier (additive): when every MET criterion rests on
   * non-executed evidence (presence/structural/ledger/lexical), this names the
   * class and carries `RT_E_CLAIM_UNVERIFIED`, so a green seal can never be read
   * as "the product builds" when nothing ran. Absent â‡’ an ordinary grep of a
   * pre-qualification object.
   */
  qualification?: EvidenceQualification;
};

// --- defensive probe helpers -------------------------------------------------

/**
 * P0-02 proxy (fixes/97 Â§1.3): the brief contains â‰¥1 token the LEX would ever
 * match â€” cheap approximation: a non-stopword token longer than 2 chars.
 */
function briefHasVocabulary(brief: string): boolean {
  return briefTokens(brief).some((t) => !BRIEF_STOPWORDS.has(t) && t.length > 2);
}

/**
 * ARTIFACT-SUBSTANCE probe (A3-E6, 2026-10-06): an artifact-presence criterion
 * is MET only when the expected artifact row exists AND carries non-empty body
 * bytes. The pre-fix probe passed on `hasArtifact` alone and reported a 0-byte
 * body only as an advisory â€” and an advisory never changes a verdict â€” so "P3
 * produced its MCP artifact" was literally true of nothing. A recorded-but-empty
 * body is now an unmet criterion (`emptyArtifactUnmetReason` names it).
 */
const artifactHasSubstance = (p: Project, phase: number, kind: string): boolean =>
  (p.artifacts ?? []).some((a) => {
    if (a?.phase !== phase || a.kind !== kind) return false;
    const body = typeof (a as { body?: unknown }).body === "string" ? (a as { body: string }).body : "";
    return body.trim() !== "";
  });

/** The honest, coded STATE line for a FAILED substance probe (A3-E6): a missing
 *  row and a recorded-but-empty body are different states, and each is coded so
 *  a red criterion is machine-classifiable rather than bare prose. */
const emptyArtifactUnmetReason =
  (phase: number, kind: string) =>
  (p: Project): string => {
    const artifacts = (p.artifacts ?? []).filter((a) => a?.phase === phase && a.kind === kind);
    if (artifacts.length === 0) {
      return `RT_E_PLAN_UNDERPRODUCED Â· no ${kind} artifact row is recorded for P${phase}`;
    }
    return `RT_E_SUBSTANCE_EMPTY Â· the ${kind} artifact row(s) for P${phase} carry EMPTY bodies (0 bytes) â€” artifact-presence proves a row was recorded, not that anything was produced`;
  };

/** 216 (T0.8 â€” actor-truthful HITL probe): the old `phaseComplete` asked only
 *  whether the phase RECORD was complete, so four criteria asserting "HITL
 *  approved" were satisfied by ANY machine approval â€” the claim was about a
 *  person, the test was about a record (the self-referential-criteria bug).
 *  This reads the DECISION LEDGER and returns who actually approved, so a
 *  criterion can assert exactly what was verified. Strictly stronger than the
 *  record check: a completed phase with no ledger row now fails.
 *
 *  216o (T-107.3 Â· P0-02/P0-06 Â· W5-L3): the read now re-asks the ONE policy
 *  seam (`evaluatePolicy`, src/lib/policy.ts) whether the row records a
 *  decision the seam permits for `hitl.approve` on this gate â€” instead of
 *  trusting the `decidedBy` string alone. See `policyConsistentApproval`. */

/** The recorded out-of-band evidence marker `headless.approve` writes into the
 *  ledger note ONLY after the token pair verified (the 216 TA-2 note contract). */
const HUMAN_SEAT_EVIDENCE_RE = /RT_HUMAN_SEAT_TOKEN verified/;

/** The human branch's stand-in the probe presents to the seam: the probe holds
 *  no out-of-band secret (it is gone by verify time), so it presents the ROW's
 *  recorded token-path marker as both sides of the check. The call therefore
 *  verifies "the row records a verified-human decision" â€” stated plainly, not
 *  overclaimed as re-running the token match (impossible offline). */
const RECORDED_TOKEN_PATH = "recorded:RT_HUMAN_SEAT_TOKEN-verified";

/** What a ledger row's seat tag claims (the 216 TA-2 `[seat <label>]` note). */
type RowSeatClaim =
  | { kind: "seat"; seat: PolicySeat }
  | { kind: "tagged-unknown" }
  | { kind: "untagged" };

/**
 * Classify a ledger row's recorded seat. A tag that does not name a registered
 * PolicySeat matching the row's `decidedBy` is `tagged-unknown` â€” an
 * edited/forged record fails closed. A row with no tag is `untagged` (legacy
 * direct `approveHitl` records: engine autopilot steps, testing fixtures,
 * store-level approvals).
 */
const classifyRowSeat = (row: HitlDecision): RowSeatClaim => {
  const tag = /\[seat ([^\]]+)\]/.exec(row.note ?? "")?.[1];
  if (tag === undefined) return { kind: "untagged" };
  if (tag === "human-cli-i-am-human" && row.decidedBy === "human") {
    return { kind: "seat", seat: { decidedBy: "human", seat: "human-cli-i-am-human" } };
  }
  // 346 L3 (A1-12 enforcement): the browser console's registered human seat. A
  // `[seat console]` row is a recognized seat (never `tagged-unknown`), but its
  // provenance must record `tokenPath:false` â€” the console has no out-of-band
  // token delivery seam, so the decision can never read as token-verified (see
  // `provenanceConsistent` / `seatTokenPath`). A row pairing the tag with
  // `decidedBy:"autopilot"` still falls through to `tagged-unknown` (fail-closed).
  if (tag === "console" && row.decidedBy === "human") {
    return { kind: "seat", seat: { decidedBy: "human", seat: "console" } };
  }
  if ((tag === "harness" || tag === "autopilot") && row.decidedBy === "autopilot") {
    return { kind: "seat", seat: { decidedBy: "autopilot", seat: tag } };
  }
  // 313 D1 (312 C1 design): the wild agent-seal seat â€” the keyed Auto-Review
  // classifier is the approver of record for the sealed approvals, and its
  // rows carry `[seat agent-seal]` with `decidedBy: "autopilot"`. Without this
  // arm the tag would classify as `tagged-unknown` and the stock-gate
  // *approved criteria (p4/p5/p8/p9) would fail closed on every sealed row.
  if (tag === "agent-seal" && row.decidedBy === "autopilot") {
    return { kind: "seat", seat: { decidedBy: "autopilot", seat: "agent-seal" } };
  }
  return { kind: "tagged-unknown" };
};

/**
 * 216o (T-107.3 Â· P0-02 Â· W6-L2): when a row records `decidedVia` provenance
 * (minted by the headless approval path), the field must AGREE with what the
 * row itself claims â€” the seat tag's label, this gate (resource), a registered
 * action, and the token path. Only the out-of-band-token-verifiable human seat
 * has a token path (`seatTokenPath`, policy.ts), so a CLI-human row must carry
 * `tokenPath: true`, while an autopilot row AND the unattested console human
 * seat (346 L3 Â· A1-12) must carry `tokenPath: false`; any contradiction fails
 * closed. A legacy row WITHOUT the field (pre-216o payloads, direct
 * `approveHitl` writers) keeps the pre-W6 tolerance â€” the check adds teeth, it
 * never invents provenance for old rows.
 */
const provenanceConsistent = (row: HitlDecision, seat: PolicySeat, phase: number): boolean => {
  const via = row.decidedVia;
  if (via === undefined) return true; // legacy row: nothing recorded to cross-check
  if (via.resource !== `gate:P${phase}`) return false;
  if (via.action !== "hitl.approve" && via.action !== "hitl.force") return false;
  if (via.label !== seatLabel(seat)) return false;
  if (typeof via.reason !== "string" || !via.reason.includes(" â€” ")) return false;
  return via.tokenPath === seatTokenPath(seat);
};

/**
 * 216o (T-107.3 Â· P0-02/P0-06): does this ledger row record a decision the
 * policy seam permits? A TAGGED row must be policy-consistent or it fails
 * closed: an autopilot tag passes the seam's Rule A; a `human-cli-i-am-human`
 * tag must carry the recorded out-of-band evidence too â€” without it the seam
 * denies (`human-seat-unverified`, fallback `human-seat-token`) and the
 * criterion fails; a `console` tag (346 L3 Â· A1-12) is admitted as the seam's
 * UNATTESTED human seat, and its optional `decidedVia` must record
 * `tokenPath: false` (`provenanceConsistent`) or it fails closed â€” a console
 * decision can never read as token-verified. A tagged row whose optional
 * `decidedVia` provenance contradicts the
 * tag (W6-L2: wrong gate, unregistered action, forged label, impossible token
 * path) also fails closed via `provenanceConsistent`. An UNTAGGED row keeps
 * the 216 T0.8 rule (a recorded actor exists); that tolerance is deliberate:
 * the writers that could forge a human row (the headless seam, the CLI verb)
 * are both routed through the seam, and pre-216o payloads carry no tag to test.
 */
const policyConsistentApproval = (row: HitlDecision, phase: number): boolean => {
  const claim = classifyRowSeat(row);
  if (claim.kind === "tagged-unknown") return false;
  if (claim.kind === "seat" && !provenanceConsistent(row, claim.seat, phase)) return false;
  if (claim.kind === "untagged") return true;
  const recorded = HUMAN_SEAT_EVIDENCE_RE.test(row.note ?? "");
  const verdict = evaluatePolicy("hitl.approve", `gate:P${phase}`, {
    actor: claim.seat,
    humanSeatToken: recorded ? RECORDED_TOKEN_PATH : undefined,
    expectedHumanSeatToken: recorded ? RECORDED_TOKEN_PATH : undefined,
  });
  return verdict.decision === "allow";
};

/**
 * A1-35 / A3-E14: the ONE approval rule. The append-only journal's NEWEST
 * approve row that the policy seam permits speaks for the phase (mirrors
 * engine.refusalClassOf's newest-first scan); first-wins let a stale pre-reject
 * row shadow a later re-approval. The winner is VALIDATED, not trusted â€” a
 * policy-inconsistent row fails closed. Returns the ROW (not just the actor) so
 * an exported consumer can anchor to the same row the gate probe reads instead
 * of restating the rule; judgment.ts's rung-1 `blocked:hitl` actor previously
 * used an `.find` (OLDEST row, no policy re-validation) and could name a stale
 * actor this rule rejects.
 */
export function approvedDecisionRow(p: Project, phase: number): HitlDecision | null {
  const decisions = p.decisions ?? [];
  for (let i = decisions.length - 1; i >= 0; i--) {
    const row = decisions[i];
    if (row?.phase !== phase || row.decision !== "approve") continue;
    if (!policyConsistentApproval(row, phase)) return null;
    return row;
  }
  return null;
}

const approvalActor = (p: Project, phase: number): "human" | "autopilot" | null => {
  const row = approvedDecisionRow(p, phase);
  if (!row) return null;
  // A junk `decidedBy` fails the criterion instead of riding out through a
  // "human" | "autopilot" signature it never satisfied.
  return row.decidedBy === "human" || row.decidedBy === "autopilot" ? row.decidedBy : null;
};
const approved = (p: Project, phase: number): boolean => approvalActor(p, phase) !== null;

const kindsPresent = (p: Project, kinds: string[]): boolean => {
  const present: Set<string> = new Set((p.memory ?? []).map((m) => m.kind));
  return kinds.every((k) => present.has(k));
};

// --- p6-arch: capability â†’ real-tree-file mapping (fixes/144 M2 lane B4) ----
// The multi-file generation tree (Project.generatedTree â€” keyed synthesis
// only) must meet the same brief-faithfulness bar the single-module probes
// enforce, at FILE granularity: every capability the expanded spec demands
// (each typeSignature export; falling back to spec requirements, then â€”
// keyless â€” to the lattice jobs' required noun vocabulary) maps to â‰¥1 tree
// file whose CODE contains the capability's stemmed identifier (literals and
// comments masked), and no tree file is a byte-identical copy of a
// deterministic template stub (the engine floor buildPhase6Module writes for
// THIS project). archTrace() is the pure, deterministic trace both the p6-arch
// probe and the engine's P6 reqTrace stamp consume. An absent tree is the
// single-module (legacy path): the probe passes vacuously so keyless /
// deterministic runs â€” and refused keyed synthesis that landed the floor â€”
// are never broken by the tree probe.

export type ArchTraceRow = {
  /** Capability label â€” a typeSignature line, spec requirement, or lattice job. */
  capability: string;
  /** Tree file paths whose code carries â‰¥1 of the capability's identifiers. */
  files: string[];
};

export type ArchTrace = {
  /** true when generatedTree is a non-empty array (tree mode). */
  present: boolean;
  /**
   * true when the tree probe did not run (absent tree = legacy single-module).
   * Skip is NOT product-complete: `runGate` p6-arch still passes so the keyless
   * floor is not hard-broken, but `archProductComplete` is false.
   */
  skipped: boolean;
  /** Capability â†’ files mapping (tree mode; empty in legacy mode). */
  rows: ArchTraceRow[];
  /** Capability labels with NO tree file carrying their identifiers. */
  missing: string[];
  /** Tree file paths that are template stubs, TODO(E-15) stubs, or
   *  reexport-only jobs whose targets point OUTSIDE the tree. The machine-
   *  assembled entry barrel whose reexport targets all resolve in-tree is
   *  exempt (fixes/255 Â§P2). */
  stubFiles: string[];
  /** Human note: "tree (<n> files)" or "single-module (legacy path)". */
  note: string;
};

/**
 * Canonical leftover-job / floor markers. A file carrying these is not a
 * product implementation â€” never invent flip/record/show/publish bodies to
 * "fix" this; the honest bar is to refuse product-complete on stubs.
 */
export function isStubSource(source: string): boolean {
  if (typeof source !== "string") return true;
  if (hasTodoMarker(source)) return true;
  if (isReexportOnlySource(source)) return true;
  return false;
}

/**
 * The deterministic keyless P6 template shape (`sandbox.buildPhase6Module`): a
 * named job list plus the template functions. Single-sourced here (was private
 * in doctor.ts) so the two quality readers classify the same bytes identically.
 */
export function isDeterministicTemplateModule(source: string): boolean {
  const s = typeof source === "string" ? source : "";
  return (
    /\bconst JOBS = \[/.test(s) && /\bfunction synthesize\s*\(/.test(s) && /\bfunction test_no_skip\s*\(/.test(s)
  );
}

/** The three-way class ONE module's bytes fall into (see `classifyModuleSource`). */
export type ModuleClass = "stub" | "reexport" | "real";

/**
 * The ONE module classifier (item 3 â€” the two quality readers must agree by
 * construction). Every consumer â€” `product-quality.moduleCensus` (the whole-tree
 * census) and `doctor.classifyJobSource` (the job-dir census compile-check's
 * `substance` reads) â€” routes through THIS, so the same bytes can never receive
 * two contradictory verdicts. Rules, in order:
 *
 *   1. absent/blank source            â†’ `stub`
 *   2. `TODO(E-15)` / `throw â€¦ TODO`  â†’ `stub`
 *   3. the deterministic P6 template  â†’ `stub`
 *   4. reexport/import-only after comment strip â†’ `reexport`
 *   5. otherwise                      â†’ `real`
 *
 * This is exactly the pre-unification `doctor.classifyJobSource` rule set; the
 * whole-tree census adopts it so a reexport-only bridge and a template stub can
 * never be counted `real` on one surface and a leftover on the other.
 */
export function classifyModuleSource(source: string): ModuleClass {
  if (typeof source !== "string" || source.trim() === "") return "stub";
  if (hasTodoMarker(source)) return "stub";
  if (isDeterministicTemplateModule(source)) return "stub";
  if (isReexportOnlySource(source)) return "reexport";
  return "real";
}

/** The two explicit leftover-job / floor declarations (E-15 markers). Their
 *  own predicate because the Â§P2 barrel exemption must never rescue a file
 *  that declares itself unfinished. */
function hasTodoMarker(source: string): boolean {
  const s = typeof source === "string" ? source : "";
  return s.includes("TODO(E-15)") || /throw\s+new\s+Error\s*\(\s*(['"`])TODO\b/i.test(s);
}

/** Comment-stripped, whitespace-collapsed code text â€” pure; the shared strip
 *  both reexport classifiers below read so their logic can never drift. */
function stripCommentsAndCollapse(source: string): string {
  return String(source ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "\n")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when, after comment strip, every statement is `export â€¦ from` / `import â€¦ from`. */
export function isReexportOnlySource(source: string): boolean {
  const code = stripCommentsAndCollapse(source);
  if (!code) return false;
  const stmts = code
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (stmts.length === 0) return false;
  const reexport =
    /^(export\s+(\*|\{[\s\S]*?\})\s+from\s+['"][^'"]+['"]|import\s+.+\s+from\s+['"][^'"]+['"])$/;
  return stmts.every((st) => reexport.test(st));
}

/** Quoted module specifiers of every `from "â€¦"` clause (comment-stripped).
 *  Pure; feeds the in-tree-target barrel exemption in archTrace(). */
function reexportSpecifiers(source: string): string[] {
  const code = stripCommentsAndCollapse(source);
  const out: string[] = [];
  const re = /\bfrom\s+(['"])([^'"]+)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) out.push(m[2]);
  return out;
}

/** POSIX-normalize a relative specifier against the importing file's dir. */
function resolveTreeSpecifier(spec: string, fromPath: string): string {
  const from = String(fromPath ?? "").replace(/\\/g, "/");
  const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const stack = dir ? dir.split("/").filter(Boolean) : [];
  for (const part of String(spec ?? "").replace(/\\/g, "/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}

/** Node-style candidate paths for a relative module specifier (exact,
 *  extensionless â†’ .ts/.tsx//index.ts, .js/.jsx â†’ .ts/.tsx). */
function treeSpecifierCandidates(spec: string, fromPath: string): string[] {
  if (!spec.startsWith("./") && !spec.startsWith("../")) return [];
  const base = resolveTreeSpecifier(spec, fromPath);
  const candidates = [base];
  if (!/\.[A-Za-z0-9]+$/.test(base)) {
    candidates.push(`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`);
  } else if (base.endsWith(".js")) {
    candidates.push(`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`);
  } else if (base.endsWith(".jsx")) {
    candidates.push(`${base.slice(0, -4)}.tsx`);
  }
  return candidates;
}

/** The tree file a relative specifier resolves to, or null (out-of-tree). */
function resolveTreeTarget(
  spec: string,
  fromPath: string,
  byPath: ReadonlyMap<string, { path: string; source: string }>,
): { path: string; source: string } | null {
  for (const c of treeSpecifierCandidates(spec, fromPath)) {
    const hit = byPath.get(c);
    if (hit) return hit;
  }
  return null;
}

/** fixes/255 Â§P2 + W61 C14: true when a reexport-only file's every specifier
 *  resolves to a REAL implementation in the same tree, transitively. A dead
 *  re-export bridge â€” a chain of re-exports ending in a stub, an out-of-tree
 *  target, or a cycle with no real base â€” returns false and stays a stub
 *  (FINDINGS O-03: pure alias chains used to be exempt and passed p6-arch). */
function reexportTargetsResolveToReal(
  file: { path: string; source: string },
  byPath: ReadonlyMap<string, { path: string; source: string }>,
): boolean {
  const specs = reexportSpecifiers(file.source);
  if (specs.length === 0) return false;
  return specs.every((s) => targetResolvesToReal(s, file.path, byPath, new Set([file.path])));
}

function targetResolvesToReal(
  spec: string,
  fromPath: string,
  byPath: ReadonlyMap<string, { path: string; source: string }>,
  visiting: Set<string>,
): boolean {
  const target = resolveTreeTarget(spec, fromPath, byPath);
  if (!target) return false;
  if (visiting.has(target.path)) return false; // cycle with no real base
  if (!isReexportOnlySource(target.source)) return !hasTodoMarker(target.source);
  visiting.add(target.path);
  const ok = reexportSpecifiers(target.source).some((s) =>
    targetResolvesToReal(s, target.path, byPath, visiting),
  );
  visiting.delete(target.path);
  return ok;
}

/** Product-complete tree: present, not skipped, no missing caps, no stub files. */
export function archProductComplete(t: ArchTrace): boolean {
  return (
    t.present === true &&
    t.skipped !== true &&
    t.missing.length === 0 &&
    t.stubFiles.length === 0
  );
}

/** The newest `p6.synthesis.*` journal event (or null when no synthesis ran).
 *  The ordering is the append-only log's own; the engine appends a chunk's
 *  per-attempt `p6.synthesis.attempt`, then its `p6.synthesis.candidates`, then
 *  a terminal `p6.synthesis.refused` â€” so the newest event names how a keyed
 *  synthesis ended. A pure read of project logs. */
function newestSynthesisEvent(p: Project): string | null {
  const synthLogs = (p.logs ?? []).filter(
    (l) => typeof l?.event === "string" && l.event.startsWith("p6.synthesis."),
  );
  const newest = synthLogs[synthLogs.length - 1];
  return newest ? newest.event : null;
}

/** Primary declared name a typeSignature line demands: `export function
 * createBoard(â€¦)` â†’ createBoard; `export type Order = â€¦` â†’ Order; bare
 * `createOrder(items: â€¦)` â†’ createOrder. Null when nothing parses (the line
 * then demands no identifier and is skipped, never a false fail). */
function signaturePrimaryName(sig: string): string | null {
  const s = typeof sig === "string" ? sig.trim() : "";
  if (!s) return null;
  const fn = s.match(/\b(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (fn) return fn[1];
  const decl = s.match(/\b(?:type|interface|class|enum|const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (decl) return decl[1];
  const bare = s.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
  if (bare) return bare[1];
  return null;
}

/** Prose capability text â†’ demanded identifier tokens (stopword-filtered,
 * identifier-valid). Hyphenated lattice labels ("dispatch-board") tokenize
 * into their word parts exactly like briefTokens does for real briefs. */
function proseCapabilityTokens(text: string): string[] {
  return (typeof text === "string" ? text : "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (t) => t.length > 1 && !BRIEF_STOPWORDS.has(t) && /^[a-z_$][a-z0-9_$]*$/.test(t),
    );
}

/** One capability the tree must implement. Each demanded identifier is an
 * equivalence GROUP of lowercase match forms (raw + canonicalStem) so prose
 * "scheduling" agrees with a `schedule()` implementation while a snake_case
 * signature name still matches its camelCase file. A group is met when â‰¥1 of
 * its forms appears in â‰¥1 tree file's code (identifierHits semantics). */
type ArchCapability = { label: string; groups: string[][] };

/** The expanded spec's capability list (typeSignatures first, requirements as
 * the keyed fallback, lattice jobs as the keyless fallback). */
function archCapabilities(p: Project): ArchCapability[] {
  const spec = p.implementationSpec;
  const out: ArchCapability[] = [];
  if (spec && Array.isArray(spec.typeSignatures) && spec.typeSignatures.length > 0) {
    for (const sig of spec.typeSignatures) {
      const s = String(sig).trim();
      const name = signaturePrimaryName(s);
      if (!name) continue; // unparseable signature â€” no identifier demand
      out.push({ label: s, groups: [[name.toLowerCase(), canonicalStem(name)]] });
    }
  } else if (spec && Array.isArray(spec.requirements) && spec.requirements.length > 0) {
    for (const req of spec.requirements) {
      const r = String(req).trim();
      if (!r) continue;
      const tokens = [...new Set(proseCapabilityTokens(r))];
      out.push({ label: r, groups: tokens.map((t) => [t, canonicalStem(t)]) });
    }
  } else {
    // keyless: the lattice jobs' required noun capabilities
    for (const job of p.lattice?.jobs ?? []) {
      const j = String(job).trim();
      if (!j) continue;
      const tokens = [...new Set(proseCapabilityTokens(j))];
      out.push({ label: j, groups: tokens.map((t) => [t, canonicalStem(t)]) });
    }
  }
  return out;
}

/** Deterministic template-stub texts a tree file must never equal byte-for-byte:
 * the engine floor buildPhase6Module could have produced for THIS project
 * (variant 0/1 Ã— with/without the recorded P6 rejection note). */
function templateStubTexts(p: Project): Set<string> {
  const jobs = (p.lattice?.jobs ?? ["core"]).slice(0, 5);
  const rec = (p.phases ?? []).find((r) => r.id === 6);
  const note = rec?.rejectionNote ?? null;
  const out = new Set<string>();
  for (const variant of [0, 1]) {
    for (const rejectionNote of [note, null]) {
      out.add(buildPhase6Module({ name: p.name, jobs, rejectionNote, variant }));
    }
  }
  return out;
}

/** Machine-checkable p6-arch trace over Project.generatedTree (pure, deterministic). */
export function archTrace(p: Project): ArchTrace {
  const tree = Array.isArray(p.generatedTree) ? p.generatedTree : [];
  if (tree.length === 0) {
    // Deterministic/keyless runs and refused keyed synthesis that landed the
    // single-module floor carry no tree â€” p6-arch still PASSES so the keyless
    // floor is not hard-broken, but this is a SKIP, not product-complete.
    return {
      present: false,
      skipped: true,
      rows: [],
      missing: [],
      stubFiles: [],
      note: "single-module (legacy path)",
    };
  }
  const files = tree.filter((f) => f && typeof f.source === "string" && f.source.length > 0);
  const stubs = templateStubTexts(p);
  const byPath = new Map(files.map((f) => [f.path, f] as const));
  const stubFiles = files
    .filter((f) => {
      if (stubs.has(f.source)) return true; // deterministic template floor
      // fixes/255 Â§P2 + W61 C14: the reexport-only arm is target-resolution-and-
      // realisation-aware â€” a pure reexport file is a stub unless every target
      // chain resolves to a REAL in-tree implementation. The engine's assembled
      // entry barrel (`src/generated.ts` = `export * from "./generated/chunk-0.ts"`)
      // is machine assembly, not a leftover job; a leftover pointing outside the
      // tree (E-15 `./host.ts`) stays a stub, and a DEAD re-export bridge (a pure
      // alias chain with no real base) now does too. An explicit TODO(E-15) /
      // throw-TODO marker still dominates â€” the exemption can never rescue a file
      // that declares itself unfinished (the barrel never carries one).
      if (isReexportOnlySource(f.source) && !hasTodoMarker(f.source)) {
        return !reexportTargetsResolveToReal(f, byPath);
      }
      return isStubSource(f.source);
    })
    .map((f) => f.path);
  const rows: ArchTraceRow[] = [];
  const missing: string[] = [];
  for (const cap of archCapabilities(p)) {
    if (cap.groups.length === 0) continue; // no identifier demand â€” nothing to map
    const forms = [...new Set(cap.groups.flat())];
    // W61 C14: a capability is "carried" only by IMPLEMENTATION code â€” a name
    // appearing solely in `export { â€¦ } from "./x"` does not count, so a tree
    // of alias re-exports can no longer satisfy the architecture probe.
    const fileHits = files
      .map((f) => ({ path: f.path, found: implementationIdentifierHits(forms, f.source) }))
      .filter((h) => h.found.length > 0);
    const found = new Set<string>(fileHits.flatMap((h) => h.found));
    const allMet = cap.groups.every((g) => g.some((form) => found.has(form)));
    if (allMet && fileHits.length > 0) {
      rows.push({ capability: cap.label, files: fileHits.map((h) => h.path) });
    } else {
      missing.push(cap.label);
    }
  }
  return {
    present: true,
    skipped: false,
    rows,
    missing,
    stubFiles,
    note: `tree (${files.length} file${files.length === 1 ? "" : "s"})`,
  };
}

// --- p6-brief-fit honest state (339-3, W53) ---------------------------------

/** fixes/255 Â§P1's union read, factored so the probe and its state line can
 *  never drift: the source `p6-brief-fit` measures â€” barrel + every tree file
 *  in tree mode, else the single module. */
function briefFitSource(p: Project): string {
  const tree = Array.isArray(p.generatedTree) ? p.generatedTree : [];
  return tree.length > 0
    ? [
        p.generatedSource ?? "",
        ...tree.map((f) => (f && typeof f.source === "string" ? f.source : "")),
      ].join("\n")
    : p.generatedSource ?? "";
}

/** 339-3 (W53): the honest STATE line for a FAILED p6-brief-fit. A keyless
 *  deterministic floor can NEVER pass this criterion (the placeholder module
 *  implements phase bookkeeping only and carries no brief vocabulary), so the
 *  red message must name the state instead of a bare criterion:
 *  - the floor with no keyed synthesis attempted;
 *  - the floor kept after a keyed synthesis refusal (the model ran, no cycle
 *    was accepted);
 *  - a real single module / tree whose union dropped the brief's nouns.
 *  Pure and total: reads only project state. A vocabulary-free brief never
 *  reaches here (the probe passes vacuously). */
function briefFitUnmetReason(p: Project): string {
  const source = briefFitSource(p);
  const cov = briefFitCoverage(p.brief, source, p);
  // W61 lane C (C1): name the CORE miss (the product nouns) and the advisory
  // miss separately, so a failed fit names what the brief asked for â€” not verbs.
  const fmt = (list: string[]): string =>
    `${list.slice(0, 12).join(", ")}${list.length > 12 ? ", â€¦" : ""}`;
  const coreTail =
    cov.missingCore.length > 0 ? ` core missing (${cov.coreHits.length}/${cov.core.length}): ${fmt(cov.missingCore)}` : "";
  // NOTE: never use " Â· " here â€” the lesson-evidence digest splits on that
  // separator, so a reason containing it corrupts the atomic class-clause fit.
  const advisoryTail =
    cov.missingAdvisory.length > 0
      ? `; advisory missing (${cov.advisoryHits.length}/${cov.advisory.length}): ${fmt(cov.missingAdvisory)}`
      : "";
  const tail = `${coreTail}${advisoryTail}`;
  const tree = Array.isArray(p.generatedTree) ? p.generatedTree : [];
  // The deterministic floor's exact shape: runGenerated's template contract,
  // the same signature sandbox.runGenerated admits (tree absent, source = the
  // engine-authored placeholder). A real synthesized module never opens so.
  const floorShape = tree.length === 0 && /^const JOBS = \[/.test(source) && source.includes("function test_no_skip");
  if (floorShape) {
    const attempted = (p.logs ?? []).some(
      (l) => l?.event === "p6.synthesis.refused" || l?.event === "p6.journey.exhausted",
    );
    return attempted
      ? `deterministic floor state â€” keyed model synthesis ran but no cycle was accepted (p6.synthesis.refused); the P6 placeholder implements phase bookkeeping only and carries none of the brief's required nouns${tail}`
      : `deterministic floor state â€” no keyed model synthesis ran; the P6 placeholder implements phase bookkeeping only and carries none of the brief's required nouns${tail}`;
  }
  if (tree.length > 0) {
    return `keyed tree synthesis ran (${tree.length} file(s)) but its union dropped the brief's required nouns${tail}`;
  }
  return `generated source is missing the brief's required nouns${tail}`;
}

// --- P7 live-research waiver evidence (346 L6) --------------------------------

/** The coded row `engine.liveLayer` / `headless.bareNodeLiveOverlay` append when
 *  a REAL research fetch was attempted and the backend could not serve it
 *  (`liveDegradeRow`). Event is phase-scoped; the detail leads with the code. */
const LIVE_RESEARCH_ATTEMPT_FAILED_EVENT = "p7.live.research.failed";

/**
 * 346 L6 (P7 honesty): true when THIS project's P7 live research pass ran and
 * the backend was UNAVAILABLE â€” a coded `p7.live.research.failed` warn row
 * carrying `RT_E_RESEARCH_UNAVAILABLE` proves a real fetch was attempted
 * (either the engine live layer or the bare-Node research overlay) and failed.
 * That is precisely the `p7-research` waiver condition the criterion documents
 * ("a P7 whose live pass was ATTEMPTED but the backend was unavailable").
 *
 * A run that NEVER attempted live research â€” the deterministic/keyless floor,
 * the keyless wild edge, the CLI's default advisory path â€” writes no such row,
 * so the criterion stays honestly unmet: the waiver is never fabricated. This
 * is the state the probe previously could not see, which left a genuine offline
 * attempt red for a reason that read like "we never tried".
 *
 * Pure and deterministic: reads only project log content (phase/event/detail).
 */
export function liveResearchAttemptUnavailable(p: Project): boolean {
  return (p.logs ?? []).some(
    (l) =>
      l?.phase === 7 &&
      l.event === LIVE_RESEARCH_ATTEMPT_FAILED_EVENT &&
      typeof l.detail === "string" &&
      l.detail.startsWith("RT_E_RESEARCH_UNAVAILABLE"),
  );
}

// --- kind-aware product surface (additive) ----------------------------------
//
// The lexical / structural P6 probes (p6-brief-fit, p6-arch) never noticed that
// the emitted product did not MATCH the brief's KIND: ten fresh trees carried no
// router and zero page files yet several passed the tree-run checks, a "game"
// shipped no input/loop/canvas, and a CLI could emit an entry that throws
// `TODO(E-15)`. These probes close that: they read the emitted bytes (tree +
// generatedSource) and demand the surface the brief's kind requires. They are
// ADDITIVE (appended to DOD[6]) and never loosen an existing criterion.

export type ProductSurfaceKind = "web" | "game" | "runnable" | "none";

const KIND_GAME_RE = /\b(?:game|arcade)\b/i;
/** Raw-text forms used for the SURFACE CONTRACT decision (not the kind). */
const KIND_UI_SURFACE_RE =
  /\b(?:ui|screen|screens|dashboard|desk|portal|site|website|web|page|pages|menu|catalogue|catalog|shop|storefront)\b/i;

/** The brief's delivery kind â€” a THIN DELEGATE to the ONE decision
 *  (`engine.deliveryKindOf`), never a second implementation.
 *
 *  W359 deleted the hand-replicated keyword rows that lived here (and their
 *  copied UI-surface vocabulary): a parity test over nine hand-written briefs is
 *  no substitute for one decision, and the copy was green while the CORPUS
 *  disagreed with the engine it claimed to mirror. `domain: ""` / `lattice: null`
 *  are deliberate â€” this call site carries only the brief, and the decision is
 *  defined for exactly that input (the engine scores the brief's own tokens
 *  first; `dod.test.ts` pins the delegate against the engine on every corpus
 *  brief, brief-only, so the two can no longer drift). */
export function briefDeliveryKind(brief: string): DeliveryKind {
  return deliveryKindOf({ brief, domain: "", lattice: null });
}

/** Which surface contract a project's brief demands. The stored `Project.kind`
 *  wins when present (the engine stamped it); otherwise the brief classifies.
 *  A game (by kind or by an explicit game/arcade noun) is always the game
 *  contract; a cli/library/service kind is the runnable contract; an app-kind
 *  brief imposes the web contract only when it NAMES a page surface. */
export function productSurfaceKindOf(project: Pick<Project, "brief" | "kind">): ProductSurfaceKind {
  const brief = typeof project.brief === "string" ? project.brief : "";
  const kind = project.kind ?? briefDeliveryKind(brief);
  if (kind === "game" || KIND_GAME_RE.test(brief)) return "game";
  if (kind === "tool" || kind === "library" || kind === "service") return "runnable";
  return KIND_UI_SURFACE_RE.test(brief) ? "web" : "none";
}

const PAGE_PATH_RE = /(?:^|\/)(?:pages?|routes?|views?|screens?)(?:\/|$)|(?:^|\/)page\.(?:tsx?|jsx?)$|(?:^|\/)[^/]+\.page\.(?:tsx?|jsx?)$/i;
const ROUTER_MARKER_RE =
  /@tanstack\/react-router|from\s+['"]react-router|createBrowserRouter|createFileRoute|<RouterProvider|<Routes[\s>]|<Route[\s>]|useRoutes\s*\(|next\/navigation|next\/router|vue-router/;
const NAV_MARKER_RE = /<nav[\s>]|<Link[\s>]|\bhref\s*=|useNavigate\s*\(|\brouter\s*\.\s*push\s*\(/i;
const GAME_INPUT_RE =
  /onKeyDown|onkeydown|onKeyUp|onkeyup|addEventListener\(\s*['"`]key|keydown|keyup|\bWASD\b|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|pointerdown|mousedown|touchstart|onClick|onclick/i;
const GAME_LOOP_RE = /requestAnimationFrame|\bsetInterval\s*\(|gameLoop\b|\btick\s*\(|\bloop\s*\(|fixed timestep/i;
const GAME_CANVAS_RE = /<canvas|getContext\s*\(|createCanvas|CanvasRenderingContext|\bcanvas\b/i;
const ENTRY_PATH_RE = /(?:^|\/)(?:index|main|cli|run-cli|entry|app)\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;
const BARREL_PATH_RE = /(?:^|\/)generated\.(?:ts|js|mjs)$/i;

export type RunnableEntryRead = {
  /** The entry module path found (priority: kind entry â†’ src/generated barrel), or null. */
  path: string | null;
  /** True when no entry resolved, or the entry's own bytes are a TODO/template stub. */
  stub: boolean;
  /** The declared surface names the brief names (`(`- or `<`-suffixed backticks). */
  declared: string[];
  /** Declared names NOT present as implementation identifiers in the tree union. */
  missingDeclared: string[];
};

export type ProductSurfaceTrace = {
  kind: ProductSurfaceKind;
  /** True when the criterion imposes a requirement (kind !== "none"). */
  applicable: boolean;
  /** Real page-surface files (path matches a page route/pattern). */
  pageFiles: string[];
  /** A navigation/routing path exists (router marker OR nav markup). */
  navPath: boolean;
  inputPresent: boolean;
  loopPresent: boolean;
  canvasPresent: boolean;
  entry: RunnableEntryRead;
  /** Human note naming the state (why applicable/unmet). */
  note: string;
};

/** The declared surface the brief names: backtick identifiers immediately
 *  followed by `(`/`<` (a call, a signature, or a CLI `<command> <file>`). */
export function declaredSurfaceNames(brief: string): string[] {
  const out = new Set<string>();
  for (const m of String(brief ?? "").matchAll(/`([A-Za-z_$][A-Za-z0-9_$]*)(?=\s*[<(])/g)) out.add(m[1]);
  return [...out];
}

/** The (path, source) files the surface probes read: the generated tree plus â€”
 *  as a pathless member â€” the single generatedSource module (legacy floor), plus
 *  (ADDITIVE, 2026-10-06) the emitter's OWN emitted file list when the record
 *  carries one under the additive `emittedSurface` field, and any caller-supplied
 *  `extraFiles` (the same list `readProductQuality` already unions for its
 *  byte census).
 *
 *  WHY `emittedSurface`: the scaffold OWNS the web page/router surface
 *  (`src/ui/pages/*`, `src/ui/router.tsx`), the game canvas surface
 *  (`src/ui/console.tsx`), and the entry shell (`src/main.ts`) â€” none of which
 *  is ever a `generatedTree` row (measured: a full marketing emit writes those
 *  files while `generatedTree` carries only the LLM modules). Reading only the
 *  tree made the kind-surface criteria UNSATISFIABLE by any real build, so the
 *  emitted surface is read here. Absent/foreign shape â‡’ no change (the tree read
 *  is byte-identical to before). */
function surfaceFiles(
  p: Project,
  extraFiles: readonly { path?: unknown; source?: unknown }[] = [],
): Array<{ path: string; source: string }> {
  const tree = Array.isArray(p.generatedTree) ? p.generatedTree : [];
  const out: Array<{ path: string; source: string }> = [];
  for (const f of tree) {
    if (f && typeof f.path === "string" && typeof f.source === "string") out.push({ path: f.path, source: f.source });
  }
  const emitted = (p as { emittedSurface?: unknown }).emittedSurface;
  for (const f of [...(Array.isArray(emitted) ? emitted : []), ...extraFiles]) {
    const row = f && typeof f === "object" ? (f as { path?: unknown; source?: unknown }) : null;
    if (row && typeof row.path === "string" && typeof row.source === "string") {
      out.push({ path: row.path, source: row.source });
    }
  }
  if (typeof p.generatedSource === "string" && p.generatedSource.length > 0) out.push({ path: "", source: p.generatedSource });
  return out;
}

/** True when an entry module's own bytes are a stub AND it is not a reexport-only
 *  barrel whose target chain resolves to a real in-tree implementation. */
function entrySourceIsStub(
  file: { path: string; source: string },
  byPath: ReadonlyMap<string, { path: string; source: string }>,
): boolean {
  if (!isStubSource(file.source)) return false;
  if (isReexportOnlySource(file.source) && !hasTodoMarker(file.source)) {
    return !reexportTargetsResolveToReal(file, byPath);
  }
  return true;
}

/** Pure, deterministic product-surface trace over the emitted bytes. */
export function productSurfaceTrace(
  p: Project,
  extraFiles: readonly { path?: unknown; source?: unknown }[] = [],
): ProductSurfaceTrace {
  const kind = productSurfaceKindOf(p);
  const files = surfaceFiles(p, extraFiles);
  const realFiles = files.filter((f) => f.path !== "" && f.source.trim() !== "");
  const pageFiles = realFiles.filter((f) => PAGE_PATH_RE.test(f.path.replace(/\\/g, "/"))).map((f) => f.path);
  const unionSource = files.map((f) => f.source).join("\n");
  const navPath = ROUTER_MARKER_RE.test(unionSource) || NAV_MARKER_RE.test(unionSource);
  const inputPresent = GAME_INPUT_RE.test(unionSource);
  const loopPresent = GAME_LOOP_RE.test(unionSource);
  const canvasPresent = GAME_CANVAS_RE.test(unionSource);

  const declared = declaredSurfaceNames(typeof p.brief === "string" ? p.brief : "");
  const union = unionSource;
  const missingDeclared = declared.filter((n) => implementationIdentifierHits([n], union).length === 0);
  const entryFile =
    realFiles.find((f) => ENTRY_PATH_RE.test(f.path.replace(/\\/g, "/"))) ??
    realFiles.find((f) => BARREL_PATH_RE.test(f.path.replace(/\\/g, "/"))) ??
    null;
  // The entry is a stub when absent, blank/TODO/template, or a reexport-only
  // module whose target chain does NOT resolve to a real in-tree implementation
  // â€” the SAME in-tree barrel exemption `archTrace` applies (the emitter's own
  // `src/generated.ts` entry barrel is machine assembly, not a leftover job).
  const byPath = new Map(realFiles.map((f) => [f.path, f] as const));
  const entry: RunnableEntryRead = {
    path: entryFile ? entryFile.path : null,
    stub: entryFile === null || entrySourceIsStub(entryFile, byPath),
    declared,
    missingDeclared,
  };

  const applicable = kind !== "none";
  let note: string;
  if (kind === "none") note = "N/A â€” the brief names no web/game/cli/library/service surface contract";
  else if (kind === "web") note = appliedNote(p, pageFiles.length > 0 && navPath, `page surface=${pageFiles.length ? pageFiles.join(", ") : "none"} nav/router=${navPath}`);
  else if (kind === "game") note = appliedNote(p, inputPresent && loopPresent && canvasPresent, `input=${inputPresent} loop=${loopPresent} canvas=${canvasPresent}`);
  else note = appliedNote(p, !entry.stub && missingDeclared.length === 0, `entry=${entry.path ?? "none"}${entry.stub ? " (TODO/absent stub)" : ""}${missingDeclared.length ? ` missing declared: ${missingDeclared.join(", ")}` : ""}`);

  return { kind, applicable, pageFiles, navPath, inputPresent, loopPresent, canvasPresent, entry, note };
}

function appliedNote(p: Project, ok: boolean, detail: string): string {
  const tree = Array.isArray(p.generatedTree) ? p.generatedTree.length : 0;
  return `${ok ? "met" : "UNMET"} (${tree > 0 ? `tree ${tree} file(s)` : "single-module/no tree"}): ${detail}`;
}

/** Honest STATE reason for a FAILED kind-aware surface criterion. */
function surfaceUnmetReason(p: Project, which: ProductSurfaceKind): string {
  const t = productSurfaceTrace(p);
  const code = which === "runnable" ? "RT_E_PLAN_UNDERPRODUCED" : "RT_E_UI_UNWIRED";
  const detail =
    which === "web"
      ? `page surface=${t.pageFiles.length ? t.pageFiles.join(", ") : "none"}; navigation/routing=${t.navPath}`
      : which === "game"
        ? `input=${t.inputPresent}; loop=${t.loopPresent}; canvas=${t.canvasPresent}`
        : `entry=${t.entry.path ?? "none"}${t.entry.stub ? " (TODO stub or absent)" : ""}${t.entry.missingDeclared.length ? `; declared surface not implemented: ${t.entry.missingDeclared.join(", ")}` : ""}`;
  return `${code} Â· the emitted bytes do not carry the ${which} surface the brief's kind demands â€” ${detail}`;
}

// --- DoD registry -------------------------------------------------------------

/**
 * Exit criteria per phase 0..12. Probes read ONLY project content â€” never
 * timestamps, ids or randomness â€” so runGate() is deterministic and its
 * evidence hash is reproducible across equivalent project states.
 */
export const DOD: Record<PhaseId, GateItem[]> = {
  0: [
    {
      id: "p0-scorecard",
      criterion: "Feasibility scorecard present with 5 axes",
      // Five ROW KEYS is not five ASSESSED axes: all-blank labels prove shape only.
      advisory: (p) => {
        const axes = p.scorecard?.axes ?? [];
        if (axes.length < 5) return null;
        const labelled = axes.filter((a) => typeof a?.label === "string" && a.label.trim() !== "");
        return labelled.length === 0
          ? {
              note: `SKIP â€” all ${axes.length} scorecard axis rows are unlabelled; the count probe verifies ROW COUNT, not that any axis was assessed`,
              code: "RT_E_SUBSTANCE_EMPTY",
            }
          : null;
      },
      probe: (p) => p.scorecard != null && (p.scorecard.axes?.length ?? 0) >= 5,
    },
    {
      id: "p0-verdict",
      criterion:
        "P0 verdict resolved to proceed (proceed | proceed-with-guards) â€” a reframe verdict is unmet",
      probe: (p) =>
        p.scorecard?.verdict === "proceed" || p.scorecard?.verdict === "proceed-with-guards",
    },
    {
      id: "p0-lattice",
      criterion: "Intent lattice primed with at least one job",
      // One blank job row is not one job.
      advisory: (p) => {
        const jobs = p.lattice?.jobs ?? [];
        if (jobs.length < 1) return null;
        return jobs.every((j) => typeof j !== "string" || j.trim() === "")
          ? {
              note: `SKIP â€” the lattice carries ${jobs.length} job row(s) but every one is blank; "at least one job" is unproven`,
              code: "RT_E_SUBSTANCE_EMPTY",
            }
          : null;
      },
      probe: (p) => p.lattice != null && (p.lattice.jobs?.length ?? 0) >= 1,
    },
    {
      // P0-02 (fixes/97, 87 H7): records whether a vocabulary-bearing brief
      // sailed on the fallback lattice (the 87/88 wrong-product signature).
      // The reframe HITL's approve-with-note is the human override; this
      // probe only makes the fallback visible in the recorded gate.
      id: "p0-brief-grounded",
      criterion:
        "Non-empty brief produced job/entity vocabulary (lattice.vague must be false when the brief has â‰¥1 vocabulary-bearing token)",
      // A vocabulary-free brief (a label, a stub brief) passes this probe
      // VACUOUSLY: there is no brief vocabulary to ground, so the pass verifies
      // nothing about grounding. Surfaced as a coded SKIP so it can never be
      // read as "the brief was grounded".
      advisory: (p) =>
        briefHasVocabulary(p.brief)
          ? null
          : {
              note: "SKIP â€” the brief carries NO vocabulary-bearing token, so this criterion verifies nothing (a vocabulary-free brief passes vacuously)",
              code: "RT_E_CLAIM_UNVERIFIED",
            },
      probe: (p) => !(p.lattice?.vague === true && briefHasVocabulary(p.brief)),
    },
  ],
  1: [
    {
      id: "p1-graph",
      criterion: "Dispatcher topology graph artifact exists for P1",
      evidenceClass: "artifact-presence",
      unmetReason: emptyArtifactUnmetReason(1, "graph"),
      probe: (p) => artifactHasSubstance(p, 1, "graph"),
    },
  ],
  2: [
    {
      id: "p2-memory",
      criterion: "Memory contains all three kinds (episodic, semantic, procedural)",
      // The three KINDS being present is not three non-empty rows.
      advisory: (p) => {
        const rows = p.memory ?? [];
        const kinds = new Set(rows.map((m) => m?.kind));
        if (!["episodic", "semantic", "procedural"].every((k) => kinds.has(k as never))) return null;
        const nonEmpty = rows.filter((m) => typeof m?.text === "string" && m.text.trim() !== "");
        return nonEmpty.length === 0
          ? {
              note: `SKIP â€” all three memory kinds are present but every row body is blank; kind presence is not content`,
              code: "RT_E_SUBSTANCE_EMPTY",
            }
          : null;
      },
      probe: (p) => kindsPresent(p, ["episodic", "semantic", "procedural"]),
    },
    {
      id: "p2-scorecard",
      criterion: "Feasibility scorecard carried into P2",
      probe: (p) => p.scorecard != null,
    },
  ],
  3: [
    {
      id: "p3-mcp",
      criterion: "MCP/A2A contract artifact exists for P3",
      evidenceClass: "artifact-presence",
      unmetReason: emptyArtifactUnmetReason(3, "mcp"),
      probe: (p) => artifactHasSubstance(p, 3, "mcp"),
    },
  ],
  4: [
    {
      id: "p4-security",
      criterion: "Security isolation artifact exists for P4",
      evidenceClass: "artifact-presence",
      unmetReason: emptyArtifactUnmetReason(4, "security"),
      probe: (p) => artifactHasSubstance(p, 4, "security"),
    },
    {
      // 216o (T-107.3 Â· P0-02/P0-06 Â· W5-L3): the four "decision ledger records
      // the approver" criteria (p4-approved / p5-complete / p8-complete /
      // p9-approved) re-ask the ONE policy seam via `approved()` â†’
      // `policyConsistentApproval` â€” a tagged row must be a policy-allow for
      // hitl.approve on its gate, or the criterion fails (see the helper above).
      // W6-L2: a row that carries `decidedVia` provenance must additionally
      // AGREE with its tag (label, gate, action, token path) or it fails closed.
      id: "p4-approved",
      criterion: "P4 approved â€” decision ledger records the approver (human or autopilot)",
      evidenceClass: "ledger-record",
      probe: (p) => approved(p, 4),
    },
  ],
  5: [
    {
      id: "p5-validation",
      criterion: "Validation artifact exists for P5",
      evidenceClass: "artifact-presence",
      unmetReason: emptyArtifactUnmetReason(5, "validation"),
      probe: (p) => artifactHasSubstance(p, 5, "validation"),
    },
    {
      id: "p5-complete",
      criterion: "P5 approved â€” decision ledger records the approver (human or autopilot)",
      evidenceClass: "ledger-record",
      probe: (p) => approved(p, 5),
    },
  ],
  6: [
    {
      // M-11 (audit-bugs/05): the executor behind lastTest is runGenerated's
      // ENGINE-TEMPLATE runner, so the agent-facing wording says "self-test" â€”
      // "sandbox" is reserved for real runSandboxed worker executions. The
      // probe reads the REAL lastTest verdict record (the field only the
      // engine runner writes) and never infers a pass from artifact presence;
      // gates stay advisory (header above), and this is the deterministic
      // floor a later "tested" verdict builds on (04_verification_design Â§6).
      id: "p6-test",
      criterion: "Last template self-test run passed",
      evidenceClass: "executed-self-test",
      probe: (p) =>
        p.lastTest != null &&
        p.lastTest.ok === true &&
        typeof p.lastTest.detail === "string" &&
        p.lastTest.detail.length > 0,
    },
    {
      id: "p6-source",
      criterion: "Generated source is non-empty",
      // VACUOUS-PASS fix (2026-10-06): the probe read `length > 0`, so a single
      // whitespace byte (or a lone "\n") satisfied a criterion named
      // "non-empty". Whitespace-only source is empty in substance; the trim
      // makes the criterion honest without lowering any bar.
      probe: (p) => typeof p.generatedSource === "string" && p.generatedSource.trim().length > 0,
    },
    {
      id: "p6-artifact",
      criterion: "Generated code artifact exists for P6",
      evidenceClass: "artifact-presence",
      unmetReason: emptyArtifactUnmetReason(6, "code"),
      probe: (p) => artifactHasSubstance(p, 6, "code"),
    },
    {
      // E-07 (04_verification_design Â§8.1â€“8.4): machine-verification promotion
      // probe â€” additive over p6-test, which remains the deterministic floor.
      // Met only when a real verify loop promoted a "tested" verdict carrying
      // an evidence hash (engine.runP6Real promotion branch / applyVerifyOutcome
      // mint the label; a "self-test"/"real-run" label never satisfies it).
      // lastTest.label/evidenceHash are read through a defensive shape so this
      // probe compiles and runs whether or not the types.ts fields have landed
      // yet (E-07 #1 â€” old payloads simply stay unmet, never throw).
      //
      // W48 / 334-3 (T1b) â€” the honest line, and it is a NAMED LIMIT:
      // `p6-verified` (like `p6-test`) measures the tree-run's EXECUTED
      // verdict â€” a machine run promoted a "tested" verdict whose evidence hash
      // is over real spec executions. It deliberately does NOT require the
      // emitted package.json's DECLARED `typecheck`/`build` scripts to have run
      // (that state rides the tree-run envelope as
      // `declaredScriptsVerified`/`unverifiedDeclaredScripts`, and the emitted
      // README now carries it loudly). Requiring it would make the criterion
      // unsatisfiable on every fresh tree: the P6 journey emits to a temp dir
      // with no node_modules, so its declared `tsc`/`build` always skip unless
      // the tree is installed (one `npm install` measured ~47 s), and an
      // unsatisfiable criterion blocks gate.passed â€” and therefore the keyed P6
      // mint â€” forever. So the probe is TIGHTENED to guarantee the pass is
      // genuinely EXECUTED-green (ok + detail, the same floor p6-test reads):
      // a hollow "tested" stamp with ok:false or no recorded detail can never
      // pass a criterion whose name reads as verification.
      id: "p6-verified",
      criterion:
        'Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash)',
      // The honesty line: this accepts an EXECUTED tree-run of the emitted
      // tree's own spec tests. It does NOT run the emitted package.json's
      // declared `typecheck`/`build` (unsatisfiable on every fresh temp-dir
      // tree), so the gate records `executed-tree-tests`, never `built-artifact`.
      evidenceClass: "executed-tree-tests",
      probe: (p) => {
        const lt = p.lastTest as {
          ok?: boolean;
          detail?: string;
          label?: string;
          evidenceHash?: string;
        } | null;
        return (
          lt !== null &&
          lt !== undefined &&
          lt.ok === true &&
          typeof lt.detail === "string" &&
          lt.detail.length > 0 &&
          lt.label === "tested" &&
          typeof lt.evidenceHash === "string" &&
          lt.evidenceHash.length > 0
        );
      },
    },
    {
      // P0-01 Part A (fixes/97, DF-01/DF-04): the absence of brief-derived
      // code becomes a recorded, visible FAIL instead of a silent toy pass.
      // Keyless policy: the deterministic placeholder fails this probe BY
      // CONSTRUCTION (its identifiers never carry brief vocabulary); a keyed
      // liveP6Synthesis module passes it. Vocabulary-free briefs pass
      // vacuously (nothing to conform). 322 X1 (P6-C): the conformance bar
      // was recalibrated Â½ â†’ 0.35 (measured honest coverage 40â€“50%; â‰¥1 hit of
      // margin for stochastic keyed re-runs) â€” rationale at the threshold
      // return below. Additive AFTER p6-verified so evidence-hash ordering
      // of existing pairs is untouched.
      id: "p6-brief-fit",
      criterion:
        "Brief-conformance: required brief nouns appear as identifiers in the generated source (single-module, or the union of the tree files in tree mode)",
      unmetReason: briefFitUnmetReason,
      evidenceClass: "lexical-brief-fit",
      // A vocabulary-free brief imposes no identifier demand, so the pass is
      // VACUOUS (nothing was checked). Surfaced as a coded SKIP, never silent.
      advisory: (p) =>
        briefHasVocabulary(p.brief)
          ? null
          : {
              note: "SKIP â€” the brief carries no vocabulary-bearing token, so no brief noun can be demanded (vacuous pass)",
              code: "RT_E_CLAIM_UNVERIFIED",
            },
      probe: (p) => {
        // fixes/255 Â§P1: in tree mode generatedSource is the ESM BARREL
        // (`export * from â€¦` only) â€” measured 0 brief hits on a fully
        // synthesized tree. Read the union of the barrel + every generatedTree
        // file: the SAME artifact the engine's pre-acceptance fit check
        // measures (codegen assembleTreeEntry). The union can only ADD hits,
        // so no verdict flips PASSâ†’FAIL.
        //
        // W61 lane C (C1 Â· R1 P0-5): the flat 0.35 count-bar let a 2-file
        // hollow tree pass on generic words. The bar is now the hard CORE bar
        // (ceil(coreÃ—0.6)) over the project-grounded product nouns â€” the
        // contract entities / lattice jobs / spec-graph capability labels /
        // H1 proper nouns / bold labels â€” see sandbox.briefNounCore. The union
        // read is unchanged and still monotone.
        return briefFitSubstancePasses(p.brief, briefFitSource(p), p);
      },
    },
    {
      // fixes/144 (M2, lane B4): multi-file TREE architecture probe â€” additive
      // after p6-brief-fit. Keyed multi-file synthesis must map EVERY
      // expanded-spec capability to â‰¥1 generatedTree file whose code carries
      // the capability's stemmed identifier, and no tree file may be
      // byte-identical to a deterministic template stub (the engine floor).
      // An absent tree â€” deterministic/keyless runs, or a refused keyed
      // synthesis that landed the single-module floor â€” still PASSES this
      // probe so the keyless floor is not hard-broken. That pass is a SKIP,
      // not product-complete: archProductComplete() is false, and TODO(E-15)
      // bodies join template stubs in stubFiles (fail). W23 (fixes/255 Â§P2):
      // a reexport-only file fails ONLY when â‰¥1 of its targets points outside
      // the tree â€” the machine-assembled entry barrel reexporting in-tree
      // files is exempt; an explicit TODO(E-15) / throw-TODO marker always
      // stands as a stub.
      // archTrace() carries the reqTrace detail the engine's P6 stamp surfaces.
      id: "p6-arch",
      criterion:
        "Tree architecture: every expanded-spec capability maps to a real generatedTree file carrying its stemmed identifier; no tree file is a template stub or an out-of-tree reexport-only leftover (an assembly barrel whose targets all resolve in-tree is exempt; absent tree = single-module legacy path) â€” a no-tree PASS is a SKIP, not product-complete",
      evidenceClass: "structural-tree-map",
      // The vacuous pass, surfaced honestly and WITHOUT changing the verdict:
      // an absent tree still passes (so the keyless floor is not hard-broken),
      // but `runGate` now reports this SKIP in its `advisories` list and the
      // recorded gate artifact names it â€” so a no-tree state can no longer read
      // as product-complete. archProductComplete() remains false on the skip.
      advisory: (p) =>
        archTrace(p).present
          ? null
          : {
              note: "SKIP â€” no generatedTree: p6-arch passes vacuously on the single-module/keyless path; this is NOT product-complete (archProductComplete=false)",
              code: "RT_E_CLAIM_UNVERIFIED",
            },
      // A3-E7 (2026-10-06): a FAILED no-tree p6-arch names WHICH attempt state
      // landed the floor (a dangling attempt vs a recorded refusal), coded.
      unmetReason: (p) => {
        if (archTrace(p).present) return "";
        const newest = newestSynthesisEvent(p);
        if (newest === "p6.synthesis.attempt") {
          return "RT_E_PLAN_UNDERPRODUCED Â· keyed synthesis was ATTEMPTED and dangled with no terminal outcome â€” no generatedTree landed";
        }
        if (newest === "p6.synthesis.refused") {
          return "RT_E_PLAN_UNDERPRODUCED Â· keyed synthesis was ATTEMPTED and REFUSED â€” no generatedTree landed (the single-module floor stands)";
        }
        return "";
      },
      probe: (p) => {
        const t = archTrace(p);
        if (t.present) return t.missing.length === 0 && t.stubFiles.length === 0;
        // W61 C8 (FINDINGS O-03) + A3-E7: an absent tree is a legitimate SKIP
        // only on the pure keyless floor. When the NEWEST `p6.synthesis.*` log
        // is a bare `attempt` with no terminal outcome (a dangling keyed
        // synthesis) OR a recorded terminal `refused` (a keyed synthesis ran
        // and was rejected), the probe FAILS CLOSED rather than passing
        // vacuously over exactly the under-production it exists to catch. Only
        // no synthesis log at all (the deterministic floor) leaves the legacy
        // advisory pass.
        const newest = newestSynthesisEvent(p);
        return !(newest === "p6.synthesis.attempt" || newest === "p6.synthesis.refused");
      },
    },
    {
      // ADDITIVE (kind-aware surfaces): a brief that names web pages must land
      // at least one real page surface AND a navigation/routing path. Measured:
      // ten fresh trees carried no router and zero page files yet passed the
      // tree-run checks â€” nothing checked that the product matched the brief's
      // kind. A non-web brief imposes nothing (advisory N/A). Fails CLOSED on a
      // web brief with no surface â€” a skip is never a pass.
      id: "p6-web-surface",
      criterion:
        "Web-kind product surface: a brief naming pages carries â‰¥1 real page surface AND a navigation/routing path (a non-web brief imposes nothing)",
      code: "RT_E_UI_UNWIRED",
      evidenceClass: "product-surface-map",
      advisory: (p) =>
        productSurfaceKindOf(p) === "none"
          ? "N/A â€” the brief names no web page surface; this criterion imposes no requirement"
          : null,
      unmetReason: (p) => surfaceUnmetReason(p, "web"),
      probe: (p) => {
        if (productSurfaceKindOf(p) !== "web") return true;
        const t = productSurfaceTrace(p);
        return t.pageFiles.length > 0 && t.navPath;
      },
    },
    {
      // ADDITIVE (kind-aware surfaces): a game brief must land an input surface,
      // a loop, AND a canvas/rendering surface.
      id: "p6-game-surface",
      criterion:
        "Game-kind product surface: a game brief carries an input surface, a loop, and a canvas/rendering surface (a non-game brief imposes nothing)",
      code: "RT_E_UI_UNWIRED",
      evidenceClass: "product-surface-map",
      advisory: (p) =>
        productSurfaceKindOf(p) === "none"
          ? "N/A â€” the brief names no game surface; this criterion imposes no requirement"
          : null,
      unmetReason: (p) => surfaceUnmetReason(p, "game"),
      probe: (p) => {
        if (productSurfaceKindOf(p) !== "game") return true;
        const t = productSurfaceTrace(p);
        return t.inputPresent && t.loopPresent && t.canvasPresent;
      },
    },
    {
      // ADDITIVE (kind-aware surfaces): a cli/library/service brief must land a
      // runnable entry that is NOT a throw-TODO stub and that exposes the
      // surface the brief declares (measured: one emitted CLI's entry threw
      // TODO(E-15) on every command). A non-runnable brief imposes nothing.
      id: "p6-runnable-entry",
      criterion:
        "Runnable-kind entry: a cli/library/service brief carries a non-stub entry (not a throw-TODO/absent module) implementing the declared surface (a non-runnable brief imposes nothing)",
      code: "RT_E_PLAN_UNDERPRODUCED",
      evidenceClass: "product-surface-map",
      advisory: (p) =>
        productSurfaceKindOf(p) === "none"
          ? "N/A â€” the brief names no cli/library/service surface; this criterion imposes no requirement"
          : null,
      unmetReason: (p) => surfaceUnmetReason(p, "runnable"),
      probe: (p) => {
        if (productSurfaceKindOf(p) !== "runnable") return true;
        const t = productSurfaceTrace(p);
        return !t.entry.stub && t.entry.missingDeclared.length === 0;
      },
    },
  ],
  7: [
    {
      id: "p7-competitors",
      criterion: "At least two competitors mapped",
      // Two ROWS is not two MAPPED competitors: blank names prove nothing.
      advisory: (p) => {
        const list = p.competitors ?? [];
        const named = list.filter((c) => typeof c?.name === "string" && c.name.trim() !== "");
        return list.length >= 2 && named.length < 2
          ? {
              note: `SKIP â€” ${list.length} competitor row(s) present but only ${named.length} carries a name; "mapped" is unproven for the rest`,
              code: "RT_E_SUBSTANCE_EMPTY",
            }
          : null;
      },
      probe: (p) => (p.competitors?.length ?? 0) >= 2,
    },
    {
      id: "p7-research",
      criterion: "Live research corpus exists for P7 (â‰¥1 fetched finding)",
      // audit-39 1.2: the documented liveUnavailable waiver is now REAL â€” a
      // P7 whose live pass was attempted but the backend was unavailable
      // (no key / network failure, engine.liveLayer stamps meta.liveUnavailable)
      // must not hard-block an enforceDod project forever.
      //
      // 346 L6: the waiver has TWO honest producers, and the second was missing.
      // The engine live layer stamps `meta.liveUnavailable`; the bare-Node
      // research overlay (`headless.bareNodeLiveOverlay`, the eval/`--live`
      // research path) instead records a coded `p7.live.research.failed` row
      // and stamps no meta â€” so a genuine offline attempt there stayed red
      // without ever applying the documented waiver. `liveResearchAttemptUnavailable`
      // reads that coded evidence, so an ATTEMPTED-but-unavailable pass is
      // waived while a never-attempted floor (which writes no row) stays
      // honestly RED â€” no fabricated waiver (wild-step.test.ts pins the floor).
      probe: (p) =>
        (p.research?.length ?? 0) > 0 ||
        p.meta?.liveUnavailable === true ||
        liveResearchAttemptUnavailable(p),
      // A corpus ROW with zero fetched items is an empty corpus: the probe's
      // `length > 0` would otherwise pass it. (The liveUnavailable waiver path
      // writes no rows and is documented honest, so it is not qualified here.)
      advisory: (p) => {
        const rows = p.research ?? [];
        if (rows.length === 0) return null;
        const withItems = rows.filter((r) => Array.isArray(r?.items) && r.items.length > 0);
        return withItems.length === 0
          ? {
              note: `SKIP â€” ${rows.length} research row(s) present but none carries a fetched item; the corpus is empty in substance`,
              code: "RT_E_SUBSTANCE_EMPTY",
            }
          : null;
      },
    },
  ],
  8: [
    {
      id: "p8-ui",
      criterion: "UI artifact exists for P8",
      evidenceClass: "artifact-presence",
      unmetReason: emptyArtifactUnmetReason(8, "ui"),
      probe: (p) => artifactHasSubstance(p, 8, "ui"),
    },
    {
      id: "p8-complete",
      criterion: "P8 approved â€” decision ledger records the approver (human or autopilot)",
      evidenceClass: "ledger-record",
      probe: (p) => approved(p, 8),
    },
  ],
  9: [
    {
      id: "p9-cicd",
      criterion: "CI/CD artifact exists for P9",
      evidenceClass: "artifact-presence",
      unmetReason: emptyArtifactUnmetReason(9, "cicd"),
      probe: (p) => artifactHasSubstance(p, 9, "cicd"),
    },
    {
      id: "p9-complete",
      criterion: "P9 approved â€” decision ledger records the approver (human or autopilot)",
      evidenceClass: "ledger-record",
      probe: (p) => approved(p, 9),
    },
  ],
  10: [
    {
      id: "p10-edge",
      criterion: "Edge inference artifact exists for P10",
      evidenceClass: "artifact-presence",
      unmetReason: emptyArtifactUnmetReason(10, "edge"),
      probe: (p) => artifactHasSubstance(p, 10, "edge"),
    },
  ],
  11: [
    {
      id: "p11-tools",
      criterion: "Live tool artifact exists for P11",
      evidenceClass: "artifact-presence",
      unmetReason: emptyArtifactUnmetReason(11, "tools"),
      probe: (p) => artifactHasSubstance(p, 11, "tools"),
    },
  ],
  12: [
    {
      id: "p12-openapi",
      criterion: "OpenAPI spec declares 3.1.0",
      // DM-1: accept both YAML (`openapi: 3.1.0`) and JSON (`"openapi": "3.1.0"`)
      // forms so an imported/hand-authored JSON OpenAPI document can pass the gate.
      probe: (p) =>
        typeof p.openapi === "string" &&
        (p.openapi.includes("openapi: 3.1.0") ||
          p.openapi.includes('"openapi": "3.1.0"') ||
          p.openapi.includes('"openapi":"3.1.0"')),
    },
    {
      id: "p12-adr",
      criterion: "ADR trail exists (contains an ADR- marker)",
      probe: (p) => typeof p.adr === "string" && p.adr.includes("ADR-"),
    },
  ],
};

function evaluate(project: Project, items: GateItem[]): { ok: boolean }[] {
  return items.map((item) => {
    let ok = false;
    try {
      ok = item.probe(project) === true;
    } catch {
      ok = false; // defensive: a throwing probe is an unmet criterion, never a crash
    }
    return { ok };
  });
}

/**
 * Build the additive evidence-class reading from the same probe results the
 * verdict uses. Purely descriptive: it reads `item.evidenceClass` (default
 * `"field-predicate"`) and never changes a verdict, the unmet list or the
 * evidence hash. `productBuildVerified` is true only when a MET criterion's
 * class is `"built-artifact"` â€” no current criterion is, which is the point:
 * a green P6 gate did not build the emitted package.
 */
function buildEvidenceClass(items: GateItem[], results: { ok: boolean }[]): GateEvidenceClass {
  const byCriterion = items.map((item, i) => {
    const cls = item.evidenceClass ?? "field-predicate";
    return { id: item.id, accepted: results[i].ok, class: cls, note: EVIDENCE_CLASS_NOTE[cls] };
  });
  const classes = [...new Set(byCriterion.filter((c) => c.accepted).map((c) => c.class))].sort();
  const productBuildVerified = classes.includes("built-artifact");
  const note = productBuildVerified
    ? "green evidence includes a real built artifact"
    : classes.includes("executed-tree-tests")
      ? 'green evidence is EXECUTED tree-run spec tests, not a BUILT product â€” the emitted package.json declares typecheck/build that this gate did NOT run; a green gate must not be read as "the emitted product builds"'
      : classes.length === 0
        ? "no criterion passed â€” this gate verifies nothing"
        : `green evidence classes: ${classes.join(", ")}`;
  // ACTIONABLE qualifier: every met class is non-executed evidence. This is the
  // "label / artifact-presence" case the honesty gap named â€” a green seal that
  // proves presence or structure, never that the product ran or built.
  const weak = classes.length > 0 && classes.every((c) => !EXECUTED_EVIDENCE_CLASSES.has(c));
  const qualification: EvidenceQualification = weak
    ? {
        weak: true,
        code: "RT_E_CLAIM_UNVERIFIED",
        note:
          `this PASS rests on NON-EXECUTED evidence only (classes: ${classes.join(", ")}) â€” it verifies presence/structure/` +
          `ledger, NOT that the emitted product runs or builds; a green seal here must not be read as "the product builds".`,
      }
    : { weak: false, note: "", code: null };
  return { byCriterion, classes, productBuildVerified, note, qualification };
}

// --- gate-evidence qualification over a persisted record (2026-10-06) -------
//
// The ONE reader every GREEN-GATE surface shares (acceptance's fleet reading,
// doctor's factory claim, product-quality's reading): it re-runs each COMPLETE
// phase's DoD gate and reports the CLASS of evidence the green verdict rests
// on, with `RT_E_CLAIM_UNVERIFIED` when every met criterion is non-executed
// (presence / ledger / structural / lexical). "Agree by construction": all
// three call THIS function, so they can never state a different qualification
// for the same bytes.

export type GateEvidencePhaseRow = {
  phase: number;
  /** Classes of the MET criteria for this phase's gate. */
  classes: EvidenceClassName[];
  productBuildVerified: boolean;
  /** True when the phase passed but no met criterion is executed/built evidence. */
  weak: boolean;
  note: string;
};

export type GateEvidenceReading = {
  /** One row per COMPLETE phase (the gates that are surfaced). */
  phases: GateEvidencePhaseRow[];
  /** Phases whose green gate rests on non-executed evidence only. */
  weakPhases: number[];
  /** Phases whose green evidence includes a real BUILT artifact (always [] today). */
  productBuildVerifiedPhases: number[];
  note: string;
};

/** Pure, total: a non-object input yields the empty reading (never a fabricated pass). */
export function gateEvidenceOfProject(project: unknown): GateEvidenceReading {
  const p = project && typeof project === "object" && !Array.isArray(project) ? (project as { phases?: unknown }) : null;
  const records = Array.isArray(p?.phases) ? (p!.phases as unknown[]) : [];
  const phases: GateEvidencePhaseRow[] = [];
  for (const r of records) {
    if (!r || typeof r !== "object" || Array.isArray(r)) continue;
    const row = r as { id?: unknown; status?: unknown };
    const id = typeof row.id === "number" ? row.id : Number(row.id);
    if (!Number.isInteger(id) || id < 0 || id > 12) continue;
    if (row.status !== "complete") continue;
    const gate = runGate(project as Project, id);
    const ec = gate.evidenceClass;
    phases.push({
      phase: id,
      classes: ec.classes,
      productBuildVerified: ec.productBuildVerified,
      weak: ec.qualification?.weak === true,
      note: ec.qualification?.weak ? ec.qualification.note : ec.note,
    });
  }
  const weakPhases = phases.filter((x) => x.weak).map((x) => x.phase);
  const productBuildVerifiedPhases = phases.filter((x) => x.productBuildVerified).map((x) => x.phase);
  return {
    phases,
    weakPhases,
    productBuildVerifiedPhases,
    note: phases.length === 0
      ? "no complete phase recorded â€” no gate evidence to qualify"
      : productBuildVerifiedPhases.length > 0
        ? `green evidence includes a BUILT artifact on phase(s) ${productBuildVerifiedPhases.join(", ")}`
        : weakPhases.length > 0
          ? `green gate(s) on phase(s) ${weakPhases.join(", ")} rest on NON-EXECUTED evidence only (RT_E_CLAIM_UNVERIFIED) â€” a green seal must not be read as "the product builds"`
          : "green gate evidence includes executed evidence on every complete phase",
  };
}

/**
 * Machine-checkable DoD gate for one phase. evidenceHash = FNV-1a over the
 * sorted "id:pass|fail" pairs of every probe â€” a VERDICT-VECTOR fingerprint,
 * not artifact evidence: the same probe verdict set always yields the same
 * hash and any VERDICT change flips it, but it cannot attest artifact
 * content â€” a content change that leaves every probe verdict unchanged, and
 * two distinct projects with equal verdict sets, share a hash byte-for-byte
 * (322 X3, OBS-6: e.g. every phase of D1 and EXP01 matched).
 */
export function runGate(
  project: Project,
  phase: number,
): {
  pass: boolean;
  unmet: GateItem[];
  advisories: GateAdvisory[];
  evidenceHash: string;
  evidenceClass: GateEvidenceClass;
} {
  const items = DOD[phase as PhaseId];
  // A22: an unregistered phase must fail loudly â€” never a vacuous pass with a
  // constant "empty evidence" hash.
  if (!items) {
    const unregistered: GateItem[] = [
      {
        id: `unregistered-${phase}`,
        criterion: `No DoD criteria registered for phase ${phase}`,
        // V1-M2 (345 F2): the refusal is self-describing, never a bare
        // TypeError â€” `evaluate(project, undefined)` is unreachable and the
        // reason names why the phase cannot pass vacuously.
        reason: `phase ${phase} is outside the registered gate graph â€” runGate refuses rather than passing vacuously`,
        probe: () => false,
      },
    ];
    return {
      pass: false,
      unmet: unregistered,
      advisories: [],
      evidenceHash: String(fnv1a(`unregistered:${phase}`)),
      evidenceClass: buildEvidenceClass(unregistered, [{ ok: false }]),
    };
  }
  const results = evaluate(project, items);
  // 339-3 (W53): a failed criterion with a state probe (`unmetReason`) carries
  // the honest STATE line in its returned `criterion` â€” so every consumer that
  // prints the recorded criterion (gate artifact, hard-DoD block, red-seal
  // digest, judgePhase) tells a human WHICH state the project is in, not a
  // bare criterion. The probe id is untouched; the evidence hash is unaffected
  // (it hashes `id:pass|fail` only).
  const unmet = items
    .map((item, i) => ({ item, ok: results[i].ok }))
    .filter((r) => !r.ok)
    .map(({ item }) => {
      const reason = item.unmetReason?.(project);
      // A registry code (when the item carries one) is PREPENDED to the reason so
      // a red criterion is machine-classifiable, never bare prose; the evidence
      // hash hashes `id:pass|fail` only and is unaffected.
      if (typeof reason !== "string" || reason.trim() === "") {
        if (typeof item.code === "string") {
          return { ...item, reason: item.code, criterion: `${item.criterion} â€” ${item.code}` };
        }
        return item;
      }
      return { ...item, reason, criterion: `${item.criterion} â€” ${reason}` };
    });
  // The symmetric honest surface for a QUALIFIED PASS: an `advisory`-bearing
  // criterion that PASSES reports why its pass is not product-complete (the
  // p6-arch no-tree SKIP). It never changes the verdict or the evidence hash.
  const advisories = items
    .map((item, i) => ({ item, ok: results[i].ok }))
    .filter((r) => r.ok)
    .map(({ item }) => {
      const raw = item.advisory?.(project);
      if (raw === null || raw === undefined) return null;
      const note = typeof raw === "string" ? raw : raw.note;
      if (typeof note !== "string" || note.trim() === "") return null;
      const code = typeof raw === "string" ? undefined : raw.code;
      return { id: item.id, criterion: item.criterion, note, ...(code ? { code } : {}) };
    })
    .filter((a): a is GateAdvisory => a !== null);
  // 322 X3 (OBS-6): verdict-vector fingerprint only â€” see the runGate docstring;
  // it does not cover artifact content.
  const evidence = items
    .map((item, i) => `${item.id}:${results[i].ok ? "pass" : "fail"}`)
    .sort()
    .join("|");
  return {
    pass: unmet.length === 0,
    unmet,
    advisories,
    evidenceHash: String(fnv1a(evidence)),
    evidenceClass: buildEvidenceClass(items, results),
  };
}

/**
 * Definition-of-Readiness for a phase: prior phase sealed (vacuous at P0),
 * the phase itself not already complete, and the project not blocked.
 */
export function readyFor(
  project: Project,
  phase: number,
): { ready: boolean; blockers: GateItem[] } {
  const checks: GateItem[] = [
    {
      id: "dor-prior",
      criterion: `Phase ${phase - 1} complete (vacuous at P0)`,
      probe: (p) =>
        phase === 0 || (p.phases ?? []).some((r) => r.id === phase - 1 && r.status === "complete"),
    },
    {
      id: "dor-open",
      criterion: `Phase ${phase} not already complete`,
      probe: (p) => !(p.phases ?? []).some((r) => r.id === phase && r.status === "complete"),
    },
    {
      id: "dor-unblocked",
      criterion: "Project not blocked",
      probe: (p) => p.status !== "blocked",
    },
  ];
  const results = evaluate(project, checks);
  const blockers = checks.filter((_, i) => !results[i].ok);
  return { ready: blockers.length === 0, blockers };
}

/** Render a gate verdict as a standard artifact (kind "gate", per ArtifactKind). */
export function gateArtifact(
  phase: number,
  r: {
    pass: boolean;
    unmet: string[];
    evidenceHash: string;
    advisories?: GateAdvisory[];
    evidenceClass?: GateEvidenceClass;
  },
): Artifact {
  const title = `DoD gate â€” P${phase}`;
  const advisories = Array.isArray(r.advisories) ? r.advisories : [];
  const body = [
    `# ${title}`,
    ``,
    `**Result: ${r.pass ? "PASS" : "FAIL"}**`,
    ``,
    ...(r.unmet.length > 0
      ? [`Unmet criteria:`, ...r.unmet.map((u) => `- ${u}`)]
      : [`All criteria met for phase ${phase}.`]),
    // An honest qualifier for a PASS that is not product-complete (the p6-arch
    // no-tree SKIP). Rendered only when one exists â€” an ordinary pass is
    // byte-identical to before.
    ...(advisories.length > 0
      ? [
          ``,
          `Qualified passes (**NOT** product-complete):`,
          ...advisories.map((a) => `- ${a.id}: ${a.note}${a.code ? ` [code: ${a.code}]` : ""}`),
        ]
      : []),
    // ADDITIVE (additive-only): the class of evidence a PASS accepted, so a
    // green gate records WHAT it verified â€” in particular that a green P6 gate
    // ran executed tree-run spec tests and did NOT build the emitted package.
    // Rendered only when the caller supplies the reading (an ordinary call is
    // byte-identical to before).
    ...(r.evidenceClass
      ? [
          ``,
          `Evidence class (what a PASS verified):`,
          `- accepted: ${r.evidenceClass.classes.join(", ") || "none"}`,
          `- product build verified: ${r.evidenceClass.productBuildVerified ? "yes" : "no"} â€” ${r.evidenceClass.note}`,
          // ACTIONABLE qualifier (additive): a PASS whose met evidence is all
          // non-executed (label / artifact-presence / structural) is rendered
          // LOUDLY, with its code, so a green seal is never read as "it builds".
          ...(r.evidenceClass.qualification?.weak
            ? [
                `- **QUALIFIED**: ${r.evidenceClass.qualification.note}`,
                `- code: ${r.evidenceClass.qualification.code ?? "RT_E_CLAIM_UNVERIFIED"}`,
              ]
            : []),
        ]
      : []),
    ``,
    // A3-E15: the label says what the value IS â€” a verdict-vector fingerprint,
    // not content evidence. The old "Evidence hash:" read as artifact evidence
    // a reader could trust (it never was one).
    `Verdict fingerprint (FNV-1a over sorted id:pass|fail â€” NOT artifact content): ${r.evidenceHash}`,
  ].join("\n");
  return {
    id: `gate-p${phase}-${r.evidenceHash.slice(0, 8)}`,
    phase: phase as PhaseId,
    kind: "gate",
    title,
    body,
    language: "markdown",
  };
}

/**
 * E-02: record a machine-checkable DoD verdict for a just-completed phase â€”
 * the shared DETERMINISTIC gate-recorder (store.recordGate parity; "pure"
 * would overstate it â€” the host clock stamps `checkedAt`/`ts` via Date.now(),
 * see A1-36). Semantics mirror store.recordGate (store.ts:83-124)
 * byte-for-byte so the store can delegate to this function and
 * headless.finishPhase can record gates on CLI/headless runs: no-op (same
 * project reference) unless the phase record exists and is "complete"; stamps
 * PhaseRecord.gate {passed, unmet, evidenceHash, checkedAt}, appends a capped
 * `gate.verdict` log, and swaps in a fresh kind-"gate" artifact (a prior gate
 * artifact for the phase is replaced, never duplicated).
 */
/** fixes/125 (W1 #2): the failed-gate census â€” every COMPLETE phase whose DoD
 *  gate recorded `passed:false`. A run must never present as cleanly complete
 *  while this list is non-empty. */
export function failedGates(project: Project): { phase: PhaseId; unmet: string[] }[] {
  const out: { phase: PhaseId; unmet: string[] }[] = [];
  for (const p of project.phases ?? []) {
    if (p.status !== "complete" || !p.gate || p.gate.passed !== false) continue;
    out.push({ phase: p.id as PhaseId, unmet: Array.isArray(p.gate.unmet) ? p.gate.unmet : [] });
  }
  return out;
}

/** fixes/125 (W1 #2): true when any complete phase sealed with a failed gate. */
export function sealedWithFailures(project: Project): boolean {
  return failedGates(project).length > 0;
}

export function recordGateInto(project: Project, phase: PhaseId): Project {
  // F2-84: read through optional arrays like every probe does â€” a minimal or
  // hand-built shape ({ } as Project, phases/logs/artifacts absent) must be a
  // clean no-op (same reference), never a TypeError mid-append.
  const rec = (project.phases ?? []).find((p) => p.id === phase);
  if (!rec || rec.status !== "complete") return project;
  const r = runGate(project, phase);
  const unmet = r.unmet.map((g) => g.criterion);
  const phases = (project.phases ?? []).map((p) =>
    p.id === phase
      ? {
          ...p,
          gate: {
            passed: r.pass,
            unmet,
            evidenceHash: r.evidenceHash,
            checkedAt: Date.now(),
          },
        }
      : p,
  );
  const artifact = gateArtifact(phase, {
    pass: r.pass,
    unmet,
    evidenceHash: r.evidenceHash,
    advisories: r.advisories,
    evidenceClass: r.evidenceClass,
  });
  return {
    ...project,
    phases,
    logs: [
      ...(project.logs ?? []),
      {
        ts: Date.now(),
        phase,
        level: r.pass ? ("info" as const) : ("warn" as const),
        event: "gate.verdict",
        detail: `${r.pass ? "PASS" : "FAIL"} Â· ${r.unmet.length} unmet Â· ${r.evidenceHash.slice(0, 8)}`,
      },
    ].slice(-200),
    artifacts: [
      ...(project.artifacts ?? []).filter((a) => !(a.kind === "gate" && a.phase === phase)),
      artifact,
    ],
  };
}

// --- P0-04 capability ledger (fixes/97) -------------------------------------
// Single source of truth for "what this build actually runs on" (93 DF-03/
// DF-04/DF-06). Consumed by engine artifact templates (B-18 declare-or-strike
// tails) so no artifact states an unimplemented capability as fact. Pure,
// zero-dep, deterministic. (97 specified a new src/lib/capabilities.ts; this
// lane owns no new src files, so the ledger lives here â€” a later lane may move
// it verbatim. See fixes/100 correction #2.)

export const CAPABILITIES = {
  runtime: {
    implemented: ["sync-template"],
    declared: ["worker-isolate", "node-bounded-runner"],
    claim:
      "Engine-template runner (bounded, engine-authored code only); server-side bounded runner; Worker isolate declared, not a product path (E-29).",
  },
  network: {
    implemented: ["tavily-research", "deepseek-llm"],
    declared: [],
    claim:
      "Outbound: DeepSeek API + research providers only. No MCP client, no Brave, no repo.fs, no sandbox.exec servers (P2-3 roadmap).",
  },
  memory: {
    // A1-37 closed: the T-107.7 resume wiring landed â€” headless.runUntilGate's
    // commitRunCheckpoint writes the bounded per-phase snapshot and the CLI
    // resume/unattended verbs re-enter it via loadResumableCheckpoint â€” so
    // "durable-checkpoints" moved to implemented and the claim below was
    // rewritten in the same change (the claim text copies into user-visible
    // artifacts; a stale claim here is a declare-or-strike violation).
    implemented: ["project-memory-80-row", "knowledge-store-file", "durable-checkpoints"],
    declared: ["cross-encoder-rerank"],
    claim:
      "Persistence = browser localStorage + JSON project files, plus wired per-phase run checkpoints: a bounded atomic snapshot is committed beside .rapidtool/ after every committed phase and re-entered by the resume/unattended verbs (T-107.7). No RRF/cross-encoder (FusionRank is lexical, deliberately).",
  },
  model: {
    implemented: ["deepseek-v4-flash", "deepseek-v4-pro"],
    declared: [],
    claim: "No grok-4.5, no Ollama, no failover routes. modelRoute honesty enforced (E-14).",
  },
  concurrency: {
    implemented: ["sequential-13-phase"],
    declared: ["parallel-fanout", "websocket-tool-streams"],
    claim:
      "Linear graph only (phases.ts canEnter). Parallel workflow + WebSocket progress frames do not exist.",
  },
  learning: {
    implemented: [],
    declared: ["self-learning-loop"],
    claim: "P5 self-learning title only â€” no loop behind it (90 Â§10); write-back is M-08/G-25 roadmap.",
  },
} as const;

export type CapabilityArea = keyof typeof CAPABILITIES;

/** "- <area>: IMPLEMENTED <a, b> | DECLARED <c> â€” <claim>" line for artifact bodies. */
export function capabilityLine(area: CapabilityArea): string {
  const c = CAPABILITIES[area];
  const impl = c.implemented.length > 0 ? c.implemented.join(", ") : "none";
  const decl = c.declared.length > 0 ? c.declared.join(", ") : "none";
  return `- ${area}: IMPLEMENTED ${impl} | DECLARED ${decl} â€” ${c.claim}`;
}

/** B-18 "declaration, not implementation" tail every capability-claiming artifact body ends with. */
export function b18Tail(): string {
  return `> Implementation today: ${CAPABILITIES.runtime.claim} â€” the policy above is a declaration (B-18 honesty), not an implemented runtime.`;
}

// --- E-08 oracle-pinning seam (pure core) -----------------------------------
// The deterministic A7 oracle rows (Project.oracle) anchor every machine
// verify run: generateCases must keep every seeded row as a case with its
// exact id. These two pure helpers render the seed lines and detect dropped
// ids; the wired half is verify.server.ts (`droppedPinnedOracleIds` guards
// `generateCases`'s pinnedOracleIds, refusing a reduced oracle).
//
// 346 E1 Â· A1-04 (E-08 live): the pinning IS wired at runtime â€” the production
// keyed verify callers forward `seeds: oracleToCaseSeeds(project.oracle)` +
// `pinnedOracleIds: project.oracle.map((o) => o.id)` (headless.ts
// `verifyGeneratedSource`, codegen.server.ts `defaultDeps.verify` â†’
// verifyAndFixServer). verify.server.ts threads both into `generateCases`:
// `buildOracleCasesPrompt` PREPENDS the seeds, and a returned case list that
// drops a pinned id is refused. These helpers remain pure; the consumer is live.

/** Render each A7 oracle row as a `# orc-<id> <name> â€” <given> â‡’ <expect>` seed line.
 *  Junk rows (null / non-object / invalid id) are skipped: `engine.hydrateProject`
 *  preserves raw oracle rows, so a persisted or hand-edited payload can carry one,
 *  and dereferencing `row.id` on it threw a TypeError out of the LIVE keyed P6
 *  verify seam (codegen.server/headless pass `project.oracle` straight in). */
export function oracleToCaseSeeds(oracle: OracleTest[]): string {
  return (Array.isArray(oracle) ? oracle : [])
    .filter(
      (row): row is OracleTest =>
        !!row && typeof row === "object" && typeof row.id === "string" && row.id.length > 0,
    )
    .map((row) => `# ${row.id} ${row.name} â€” ${row.given} â‡’ ${row.expect}`)
    .join("\n");
}

/**
 * Seeded oracle ids (in oracle order) that a returned case list dropped.
 * Extra/unseeded returned ids are ignored â€” only pinned rows matter. Applies the
 * SAME valid-id filter as `oracleToCaseSeeds` (they are the paired E-08 seam; the
 * verify-side mirror `droppedPinnedOracleIds` filters invalid ids too), so a junk
 * row is never reported as a "dropped" id that was never seeded.
 */
export function missingOracleCaseIds(returnedIds: string[], oracle: OracleTest[]): string[] {
  const have = new Set(
    (Array.isArray(returnedIds) ? returnedIds : []).filter((s): s is string => typeof s === "string"),
  );
  return (Array.isArray(oracle) ? oracle : [])
    .filter(
      (row): row is OracleTest =>
        !!row && typeof row === "object" && typeof row.id === "string" && row.id.length > 0,
    )
    .map((row) => row.id)
    .filter((id) => !have.has(id));
}

// --- P10 hard-DoD enforcement helpers (pure) --------------------------------
// Opt-in per-project (`Project.enforceDod`): a machine advance may not LEAVE a
// phase whose exit gate fails. The blocked-advance stamp is shared by the
// store auto-advance guard and the engine wild loop so both surfaces produce
// the SAME evidence: a fresh "Hard DoD block â€” P<n>" docs artifact (previous
// block artifact for the phase is replaced, never duplicated) + an append-only
// `dod.blocked` warn log listing the unmet criterion ids.

/** Short machine-readable block message (surfaced as the run error text). */
export function hardDodMessage(phase: number, r: { unmet: GateItem[] }): string {
  const ids = r.unmet.map((g) => g.id).join(", ");
  return `P${phase} DoD unmet â€” hard gate blocks advance${ids ? `: ${ids}` : ""}.`;
}

/** Stamp a hard-DoD block onto a project (pure). No-op-free: always stamps. */
export function hardDodBlockInto(
  project: Project,
  phase: number,
  r: { pass: boolean; unmet: GateItem[]; evidenceHash: string },
): Project {
  const unmet = r.unmet.map((g) => g.id);
  const body = [
    `# Hard DoD block â€” P${phase}`,
    ``,
    `**Advance denied**: P${phase} cannot be left while its exit criteria are unmet.`,
    ``,
    ...(unmet.length > 0
      ? [`Unmet criteria:`, ...r.unmet.map((g) => `- ${g.id}: ${g.criterion}`)]
      : [`No unmet criteria were reported (blocked on an empty/unknown gate).`]),
    ``,
    // A3-E15: the label says what the value IS (a verdict-vector fingerprint).
    `Verdict fingerprint (FNV-1a over sorted id:pass|fail â€” NOT artifact content): ${r.evidenceHash}`,
    ``,
    `> Fix the unmet evidence (re-run the phase, deepen research, run real`,
    `> verification) or turn Hard DoD off for this project to advance.`,
  ].join("\n");
  const artifact: Artifact = {
    id: `harddod-p${phase}-${r.evidenceHash.slice(0, 8)}`,
    phase: phase as PhaseId,
    kind: "docs",
    title: `Hard DoD block â€” P${phase}`,
    body,
    language: "markdown",
  };
  return {
    ...project,
    logs: [
      ...(project.logs ?? []),
      {
        ts: Date.now(),
        phase: phase as PhaseId,
        level: "warn" as const,
        event: "dod.blocked",
        detail: `P${phase} advance blocked â€” unmet: ${unmet.join(", ") || "n/a"}`,
      },
    ].slice(-200),
    artifacts: [
      ...(project.artifacts ?? []).filter(
        (a) => !(a.kind === "docs" && a.phase === phase && a.title.startsWith("Hard DoD block")),
      ),
      artifact,
    ],
  };
}
