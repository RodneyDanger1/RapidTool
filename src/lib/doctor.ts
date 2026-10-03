/**
 * Factory-honest doctor field (fixes/210 G1).
 *
 * `headless.doctorStatus` derives `autonomousSoftwareFactory` through this
 * module's `factoryClaim`, so the flag can never become true without evidence:
 *
 *   leftover jobs gone (not reexports / TODO(E-15) stubs)
 *   + real multi-job product
 *   + human-approved fixtures (`decidedBy: "human"`)
 *   + product-complete bar (skip ≠ green; stubs ≠ complete)
 *
 * RapidTool-now does not meet that bar. Do not invent flip/record/show/publish
 * job bodies to fake it. Sandbox is always false (no Docker claim).
 *
 * W53 · 340-2: because the fixture conjunct is human-only by design (338-4), a
 * machine-complete run still reads `false` — truthfully. `awaitingHumanAcceptance`
 * names that one deliberate door separately, derived from the SAME evidence, so
 * an operator can tell "the machine did its part; a human must accept the bar"
 * apart from a real defect. It never flips `autonomousSoftwareFactory` and never
 * mints a human stamp.
 *
 * 185-H1: this envelope has no `ok`/`error` pair — never dual-channel.
 *
 * Client-safe: sandbox-policy + token-ledger + the pure p6-arch trace seam
 * (dod.ts — no node:fs anywhere in its graph; the console store already
 * bundles it) + the pure acceptance-state reader (fixtures.ts — no node: imports,
 * no IO). OV-9 (W18-L1): productComplete is DERIVED from real project
 * state (`productCompleteFromProject`) — never read from a caller's flag.
 *
 * OV-1 (W23 · L4, fixes/262): the provider ENV selection (`RAPIDTOOL_PROVIDER`)
 * is surfaced as `DoctorProviderTeam.envSelection` — keyed vs keyless, with the
 * honest "cloud-by-default, keyless floor" wording — read through the
 * registry's own resolvers (no second source of truth, no key VALUE read).
 * OV-41 (W23 · L4, fixes/262): measured spend (`DoctorSpend` / `doctorSpend`)
 * is read from the T-107.6 token ledger — its fields and its own helpers only,
 * never recomputed, never fabricated.
 */
import {
  coerceIsolationClaim,
  runnerIsolationClaim,
  type IsolationClaim,
} from "./sandbox-policy.ts";
import { estimateCostUsd, tokenCapFromEnv, totalTokens } from "./token-ledger.ts";
import type { TokenLedger, TokenPrices, TokenSpend } from "./token-ledger.ts";
// OV-9 (W18-L1): the product-complete producer's ONE derivation — the same
// pure p6-arch trace the phase-6 gate reads (dod.ts, no node:fs in its graph).
import { archProductComplete, archTrace } from "./dod.ts";
import { fnv1a } from "./algorithms.ts";
import { fixtureAcceptanceState, type FixtureAcceptanceState } from "./fixtures.ts";
// 345 L2-X1: the acceptance gate's placeholder rule, shared so the doctor's
// fixtures bar and maker-score's M1/M2 cannot disagree about one bar.
import { fixturesHavePlaceholder } from "./brief-fixtures.ts";
import type { Project } from "./types.ts";
// W6-L3 provider surfacing: TYPE-ONLY import — erased at compile, so the
// client-safe runtime surface (sandbox-policy + token-ledger) is unchanged.
import type { RapidToolModelRole } from "./llm/providers/registry.ts";
// 342-5: the MCP consumer surface — TYPE-ONLY here (erased), so this file's
// static graph stays client-safe; the runtime module is lazy-imported inside
// `doctorMcp`, exactly like the registry seam in `doctorProviderTeam`.
import type { McpServerConfig, McpToolsSurface } from "./mcp.server.ts";
export type { McpToolsSurface as DoctorMcp } from "./mcp.server.ts";

/** Evidence bag the latch reads. Absent fields default to RapidTool-now (not a factory). */
export type FactoryEvidence = {
  leftoverJobsAreReexportsOrStubs?: boolean;
  humanFixtures?: boolean;
  /** W53 · 340-2: the project's LIVE acceptance-decision state, derived from the
   *  record through `fixtures.fixtureAcceptanceState` (never hand-fed). It is
   *  what lets `awaitingHumanAcceptance` name the deliberate human door
   *  (`pending`) instead of guessing from the boolean: `no-fixtures` /
   *  `machine-decided` / `unattributed` / `unreadable` are defects, not a human
   *  keeping the machine waiting. Absent ⇒ the signal fails closed. */
  acceptance?: FixtureAcceptanceState;
  realMultiJobProduct?: boolean;
  /** OV-9: derived — `productCompleteFromProject` over the project's own tree
   *  bytes. Never read from a caller's flag. */
  productComplete?: boolean;
  chatHasSlashToolsOnly?: boolean;
  isolation?: unknown;
  inventory?: JobInventory | null;
};

export type DoctorFactory = {
  autonomousSoftwareFactory: boolean;
  /** W53 · 340-2: true only when every MACHINE-fixable conjunct is satisfied and
   *  the sole remaining factory gap is the deliberate human acceptance stamp
   *  (`acceptance.state === "pending"`). Derived from the same evidence `gaps`
   *  is; it never flips `autonomousSoftwareFactory` (that stays the full AND)
   *  and never mints a human stamp. False whenever the state is absent, garbled,
   *  already machine-decided, or any other gap also stands. */
  awaitingHumanAcceptance: boolean;
  leftoverJobsAreReexportsOrStubs: boolean;
  chatHasSlashToolsOnly: boolean;
  runnerIsSandbox: false;
  isolation: IsolationClaim;
  tokenCap: number | null;
  /** OV-41 (W23-L4): the measured spend attached to this summary, read from a
   *  T-107.6 token ledger the caller hands in. Absent ledger ⇒
   *  `measured:false` with all-null numbers — a fabricated 0 is never emitted. */
  spend: DoctorSpend;
  /** Why the factory bar is unmet. Empty only when autonomousSoftwareFactory is true. */
  gaps: string[];
  /** 214: computed leftover-job census when a tree was scanned; null if not scanned. */
  inventory: JobInventory | null;
};

export type JobSourceKind = "stub" | "reexport" | "real";

export type JobInventory = {
  scanned: string | null;
  stubs: number;
  reexports: number;
  real: number;
  files: Array<{ path: string; kind: JobSourceKind }>;
};

/**
 * The deterministic keyless P6 template shape (`sandbox.buildPhase6Module`):
 * a named job list + the three template functions. A model/recorded job module
 * never carries all three (its exports are the spec's own signatures). Kept as
 * a local shape test — doctor.ts stays client-safe (no sandbox.ts import).
 */
function isDeterministicTemplateModule(source: string): boolean {
  return (
    /\bconst JOBS = \[/.test(source) &&
    /\bfunction synthesize\s*\(/.test(source) &&
    /\bfunction test_no_skip\s*\(/.test(source)
  );
}

/** Classify one source file. Never invents a job body — stubs stay stubs. */
export function classifyJobSource(source: string): JobSourceKind {
  if (typeof source !== "string" || source.trim() === "") return "stub";
  if (source.includes("TODO(E-15)")) return "stub";
  if (/throw\s+new\s+Error\s*\(\s*(['"`])TODO\b/i.test(source)) return "stub";
  // W45/331-4: the keyless floor (sandbox.buildPhase6Module) is a phase-
  // bookkeeping placeholder that never implements the brief (its own doc; the
  // p6-brief-fit DoD fails on it by construction). `scaffold.emitGeneratedHost`
  // hosts it verbatim under the first job path, so counting it `real` made the
  // census report {stubs:0,reexports:0,real:1} + leftover:false on a product
  // with no job body at all. Count it as the leftover it is.
  if (isDeterministicTemplateModule(source)) return "stub";
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "\n")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const stmts = code
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (stmts.length === 0) return "stub";
  const reexport =
    /^(export\s+(\*|\{[\s\S]*?\})\s+from\s+['"][^'"]+['"]|import\s+.+\s+from\s+['"][^'"]+['"])$/;
  if (stmts.every((st) => reexport.test(st))) return "reexport";
  return "real";
}

export function inventoryFromJobSources(
  files: ReadonlyArray<{ path: string; source: string }>,
  scanned: string | null = null,
): JobInventory {
  const rows: Array<{ path: string; kind: JobSourceKind }> = [];
  for (const f of files) {
    const path = typeof f.path === "string" ? f.path : "";
    rows.push({ path, kind: classifyJobSource(f.source) });
  }
  return {
    scanned,
    stubs: rows.filter((r) => r.kind === "stub").length,
    reexports: rows.filter((r) => r.kind === "reexport").length,
    real: rows.filter((r) => r.kind === "real").length,
    files: rows.slice(0, 32),
  };
}

/**
 * fixes/216k (106 T-13 / F-10): the counted declared-vs-materialised job census.
 * The brief declares `lattice.jobs`; the A5 spec graph (`planSpecGraph`,
 * algorithms.ts:673) materialises at most FIVE job nodes
 * (`lattice.jobs.slice(0, 5)`), so every 6+-job brief ships fewer job modules
 * than it advertised — silently, until now. This is the ONE derivation of the
 * shortfall counts: the engine persists it as a `p6.jobs.shortfall` log (rides
 * the exported project), the scaffold prints it in the emitted README, and both
 * therefore count the same rows. Pure: labels in, counts out, no guessing —
 * `missing` is exactly the declared jobs with no materialised node.
 */
export type JobScopeShortfall = {
  /** number of non-empty declared job names (lattice.jobs). */
  declared: number;
  declaredNames: string[];
  /** number of materialised spec-graph job-node labels. */
  materialised: number;
  materialisedNames: string[];
  /** declared jobs with NO materialised node — the counted shortfall. */
  missing: string[];
};

/** Count declared jobs against materialised job-node labels (see the type doc). */
export function jobScopeShortfall(
  declared: readonly unknown[] | null | undefined,
  materialisedLabels: readonly unknown[] | null | undefined,
): JobScopeShortfall {
  const clean = (xs: readonly unknown[] | null | undefined): string[] => {
    const out: string[] = [];
    for (const x of xs ?? []) {
      if (typeof x !== "string" || !x.trim()) continue;
      out.push(x.trim());
    }
    return out;
  };
  const declaredNames = clean(declared);
  const materialisedNames = clean(materialisedLabels);
  const materialisedSet = new Set(materialisedNames);
  const missing = declaredNames.filter((j) => !materialisedSet.has(j));
  return {
    declared: declaredNames.length,
    declaredNames,
    materialised: materialisedNames.length,
    materialisedNames,
    missing,
  };
}

/**
 * W45/331-4: the declared-vs-emitted job census for a SCANNED tree. `jobScopeShortfall`
 * counts declared `lattice.jobs` against materialised spec-graph NODES (the plan side);
 * this counts them against the tree's REAL job FILES (the emitted side), so a declared
 * job that has no signature naming it — e.g. the café export's `track` node — is counted
 * and named instead of silently absent. Materialisation is the spec-graph job-file rule
 * (`src/jobs/<label sanitized>.ts`, plus its `-2/-3` sibling overflow), matched against
 * the inventory's `real` rows only: a stub/reexport/template file never counts as a
 * materialised job. Pure; the caller (the `doctor --tree` path) supplies `lattice.jobs`
 * and the scan output.
 */
export type TreeEmissionCensus = {
  declared: number;
  declaredNames: string[];
  /** declared names with a REAL job module in the scan. */
  materialised: string[];
  /** declared names with no real module — the counted emitted-tree shortfall. */
  missing: string[];
  stubs: number;
  reexports: number;
  real: number;
  /** True when `missing` is non-empty — the shortfall must be surfaced, never dropped. */
  loud: boolean;
};

/** Sanitized spec-graph job-file stem for one declared label (algorithms.planSpecGraph rule). */
function jobFileStem(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

/** Count declared jobs against a tree scan's REAL job files (see `TreeEmissionCensus`). */
export function treeEmissionCensus(
  declared: readonly unknown[] | null | undefined,
  inv: JobInventory,
): TreeEmissionCensus {
  const declaredNames: string[] = [];
  for (const d of declared ?? []) {
    if (typeof d !== "string" || !d.trim()) continue;
    declaredNames.push(d.trim());
  }
  const realStems = (Array.isArray(inv?.files) ? inv.files : [])
    .filter((f) => f?.kind === "real" && typeof f.path === "string")
    .map((f) => {
      const slash = f.path.lastIndexOf("/");
      const base = slash >= 0 ? f.path.slice(slash + 1) : f.path;
      return base.replace(/\.[A-Za-z0-9]+$/, "").toLowerCase();
    });
  const materialised: string[] = [];
  const missing: string[] = [];
  for (const name of declaredNames) {
    const stem = jobFileStem(name);
    const hit = realStems.some((s) => s === stem || s.startsWith(`${stem}-`));
    (hit ? materialised : missing).push(name);
  }
  return {
    declared: declaredNames.length,
    declaredNames,
    materialised,
    missing,
    stubs: inv?.stubs ?? 0,
    reexports: inv?.reexports ?? 0,
    real: inv?.real ?? 0,
    loud: missing.length > 0,
  };
}

/**
 * OV-9 (W18-L1): the real project state the `productComplete` producer reads —
 * the live `Project` object, or the parsed `.rapidtool/project.json` export the
 * emitted tree ships (scaffold.ts:2506). Raw JSON text must be parsed by the
 * caller; a string is refused (fail-closed). This is a VALUE, never a verdict:
 * the producer computes the p6-arch bar over the project's own tree bytes.
 */
export type ProductStateEvidence = { project?: unknown };

/**
 * OV-9 (W18-L1): the ONE producer of `productComplete` field truth.
 *
 * `productComplete` was the M-B latch's hand-fed input: the sole caller
 * (`headless.doctorStatus`, the `doctor --tree` path, headless.ts:3350) passed
 * no evidence, so only a unit test could set the field
 * (220_tasklist_canonical.md OV-9; doctor.ts:167 pre-OV-9). This producer
 * derives it from REAL project state instead — the project's own
 * `generatedTree` bytes, run through dod.ts's p6-arch trace, the SAME
 * derivation `runGate(p, 6)`'s p6-arch probe uses, so the doctor and the phase
 * gate can never disagree on the bar:
 *
 *   tree present (an absent tree is the keyless single-module SKIP — skip is
 *   not green) + every expanded-spec capability maps to a real tree file +
 *   no tree file is a template stub, a TODO(E-15) stub or a reexport-only file.
 *
 * Anti-goal (stated on purpose): this must never become passable by assertion —
 * there is deliberately no boolean input, non-object state refuses, and
 * `evidenceFromJobInventory` ignores a hand-passed flag at runtime.
 */
export function productCompleteFromProject(project: unknown): boolean {
  if (!project || typeof project !== "object" || Array.isArray(project)) return false;
  return archProductComplete(archTrace(project as Project));
}

/**
 * The project's acceptance record is stale for the live brief? Same stale-set
 * rule the accepted-set reader applies (io/hydrate pending-ify): a recorded
 * `acceptanceBriefHash` that mismatches `fnv1a(brief)` belongs to a different
 * brief. Shared by `humanFixturesFromProject` and `liveAcceptanceState` so the
 * two readers of the same record use ONE staleness rule.
 */
function acceptanceRecordIsStale(p: { acceptanceBriefHash?: unknown; brief?: unknown }): boolean {
  return (
    typeof p.acceptanceBriefHash === "string" &&
    typeof p.brief === "string" &&
    p.acceptanceBriefHash !== String(fnv1a(p.brief))
  );
}

/**
 * W53 · 340-2: the project's LIVE acceptance-decision state — the same record
 * `humanFixturesFromProject` reads, through the acceptance module's ONE
 * derivation (`fixtures.fixtureAcceptanceState`). `undefined` when there is no
 * object to read or the record is stale for the live brief, so a stale set can
 * never be reported as "awaiting a human" (fail-closed). This is the input that
 * makes `awaitingHumanAcceptance` name the state rather than guess it from the
 * boolean.
 */
function liveAcceptanceState(project: unknown): FixtureAcceptanceState | undefined {
  if (!project || typeof project !== "object" || Array.isArray(project)) return undefined;
  const p = project as { acceptanceFixtures?: unknown; acceptanceBriefHash?: unknown; brief?: unknown };
  if (acceptanceRecordIsStale(p)) return undefined;
  return fixtureAcceptanceState(p.acceptanceFixtures);
}

/**
 * W52 · 338-3: the ONE producer of the factory's `humanFixtures` evidence —
 * DERIVED from the project's own acceptance record, never a caller's flag. The
 * bar applies the acceptance gate's rules: at least one case, EVERY case
 * `approval:"approved"`, at least one approved row carrying the out-of-band
 * human stamp `decidedBy:"human"` (a machine seat never mints that stamp —
 * 338-4 owns the machine-door question, not this reader), and no approved row a
 * draft sentinel (345 L2-X1: `fixturesHavePlaceholder`, the SAME predicate
 * maker-score's M1/M2 read, so the doctor and the scorer agree on one bar). A
 * recorded `acceptanceBriefHash` that does not match the live `brief` (fnv1a)
 * refuses — the same stale-set pending-ify rule io/hydrate apply, so a set
 * drafted for a different brief can never close the gap. Absent/garbled state ⇒
 * false (fail-closed: the gap stands, never hidden).
 */
export function humanFixturesFromProject(project: unknown): boolean {
  if (!project || typeof project !== "object" || Array.isArray(project)) return false;
  const p = project as { acceptanceFixtures?: unknown; acceptanceBriefHash?: unknown; brief?: unknown };
  const rows = Array.isArray(p.acceptanceFixtures) ? p.acceptanceFixtures : [];
  if (rows.length === 0) return false;
  if (acceptanceRecordIsStale(p)) return false;
  let humanApproved = false;
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    const r = row as { approval?: unknown; decidedBy?: unknown };
    if (r.approval !== "approved") return false;
    if (r.decidedBy === "human") humanApproved = true;
  }
  // 345 L2-X1: every row is approved here, so any draft sentinel is an approved
  // sentinel — a bar that asserts nothing real and must not clear the gap. The
  // shared predicate keeps this in lockstep with maker-score's M1/M2.
  if (fixturesHavePlaceholder(rows)) return false;
  return humanApproved;
}

/**
 * W52 · 338-3: the factory evidence a persisted project RECORD supports WITHOUT
 * a job-file census (the `--project <record>` path with no emitted tree to
 * scan). `productComplete` + `humanFixtures` are DERIVED from the record;
 * the two inventory-derived fields stay FAIL-CLOSED (leftover true / realMulti
 * false) because no tree was scanned — an unmeasured census is never reported
 * as a real multi-job product, and the gaps name exactly that. W53 · 340-2:
 * the live `acceptance` state is derived from the same record, so the awaiting
 * signal can read it without a tree.
 */
export function evidenceFromProjectRecord(project: unknown): FactoryEvidence {
  return {
    leftoverJobsAreReexportsOrStubs: true,
    realMultiJobProduct: false,
    humanFixtures: humanFixturesFromProject(project),
    acceptance: liveAcceptanceState(project),
    productComplete: productCompleteFromProject(project),
    chatHasSlashToolsOnly: true,
  };
}

/**
 * 214: leftover-job census → factory evidence.
 * leftover true when any stub/reexport exists OR zero real jobs.
 * realMultiJobProduct true only when ≥2 real jobs and zero leftover stubs/reexports.
 * OV-9: productComplete is DERIVED from the real project state the caller
 * hands under `project` — never from a boolean extra (a hand-passed
 * `productComplete` key is not in the type and is ignored at runtime). The 214
 * census cross-gate stays: stubs/reexports seen in the scan, or fewer than two
 * real jobs, refuse the bar. W52 · 338-3: `humanFixtures` is DERIVED from the
 * project record handed under `project` (`humanFixturesFromProject`) — a
 * genuinely human-approved fixture set closes the gap. W55 · 341-5:
 * `humanFixtures` is also OMITTED from the `extra` type and ignored at runtime,
 * so a caller can no longer mint the one conjunct 338-4 reserved for a real
 * human stamp by passing `{humanFixtures:true}` (the pre-fix forge).
 * W53 · 340-2: `acceptance` is DERIVED from `extra.project` like `productComplete`
 * — it is not in the `extra` type and a hand-passed value is ignored at runtime,
 * so the awaiting signal can never be handed in.
 */
export function evidenceFromJobInventory(
  inv: JobInventory,
  extra?: Omit<Partial<FactoryEvidence>, "productComplete" | "inventory" | "acceptance" | "humanFixtures"> &
    ProductStateEvidence,
): FactoryEvidence {
  const leftover = inv.stubs + inv.reexports > 0 || inv.real === 0;
  const realMulti = inv.real >= 2 && inv.stubs === 0 && inv.reexports === 0;
  return {
    leftoverJobsAreReexportsOrStubs: leftover,
    realMultiJobProduct: realMulti,
    humanFixtures: humanFixturesFromProject(extra?.project),
    acceptance: liveAcceptanceState(extra?.project),
    productComplete: productCompleteFromProject(extra?.project) && realMulti && !leftover,
    chatHasSlashToolsOnly: extra?.chatHasSlashToolsOnly !== false,
    isolation: extra?.isolation,
    inventory: inv,
  };
}

/** Live RapidTool field truth — leftover jobs are still stubs/reexports. */
export const RAPIDTOOL_FACTORY_EVIDENCE: FactoryEvidence = Object.freeze({
  leftoverJobsAreReexportsOrStubs: true,
  humanFixtures: false,
  realMultiJobProduct: false,
  productComplete: false,
  chatHasSlashToolsOnly: true,
});

export const FACTORY_GAP = {
  leftover: "leftover jobs are reexports or TODO(E-15) stubs — not a multi-job product",
  fixtures: 'no human-approved fixtures (decidedBy:"human")',
  product: "no real multi-job product",
  /** W53 · 340-2: a SCANNED tree whose bytes carry exactly one real module and
   *  no leftovers. That is a real product whose shape is a single entry module
   *  — legitimate for a library/service brief — and the remaining fact is the
   *  bar's BREADTH requirement (≥2 real jobs), distinct from leftover stubs. */
  singleJob:
    "single real job module with no stubs/reexports — the bar requires a multi-job product (≥2 real jobs); one entry module is a legitimate library/service shape, which is not the same failure as leftover stubs",
  complete: "product-complete bar not met (skip≠green; stubs≠complete)",
} as const;

/**
 * W53 · 340-2: which job-census gap stands — the broad fail-closed default
 * (`FACTORY_GAP.product`), or the precisely-named single-real-module state.
 *
 * The flag's EVIDENCE requirement is untouched: `realMultiJobProduct` still
 * needs ≥2 real jobs with zero stubs/reexports (no loosening), and the
 * stub/reexport classifier is unchanged. Only the operator-facing wording
 * distinguishes "a real product that happens to be one entry module" from
 * "no real product". An unmeasured or garbled census fails closed to the
 * broad default.
 */
function productGapOf(evidence: FactoryEvidence): string {
  const inv = evidence.inventory;
  if (
    inv &&
    typeof inv === "object" &&
    !Array.isArray(inv) &&
    inv.stubs === 0 &&
    inv.reexports === 0 &&
    inv.real === 1
  ) {
    return FACTORY_GAP.singleJob;
  }
  return FACTORY_GAP.product;
}

function gapsOf(evidence: FactoryEvidence): string[] {
  const leftover = evidence.leftoverJobsAreReexportsOrStubs !== false;
  const human = evidence.humanFixtures === true;
  const real = evidence.realMultiJobProduct === true;
  const complete = evidence.productComplete === true;
  const gaps: string[] = [];
  if (leftover) gaps.push(FACTORY_GAP.leftover);
  if (!human) gaps.push(FACTORY_GAP.fixtures);
  if (!real) gaps.push(productGapOf(evidence));
  if (!complete) gaps.push(FACTORY_GAP.complete);
  return gaps;
}

/**
 * Compute the factory object from field truth.
 *
 * `autonomousSoftwareFactory` is true only when leftover stubs are gone,
 * human fixtures exist, a real multi-job product exists, the product-complete
 * bar is met, AND isolation.sandbox is false. Hostile `sandbox: true` is
 * coerced away and cannot mint a factory claim.
 *
 * OV-41 (W23 · L4): `spend` (optional 3rd arg) is the CALLER's measured
 * token ledger — consumed by `doctorSpend`, never recomputed here.
 */
export function factoryClaim(
  evidence: FactoryEvidence = RAPIDTOOL_FACTORY_EVIDENCE,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  spend?: TokenSpend | TokenLedger | null,
): DoctorFactory {
  const leftover = evidence.leftoverJobsAreReexportsOrStubs !== false;
  const human = evidence.humanFixtures === true;
  const real = evidence.realMultiJobProduct === true;
  const complete = evidence.productComplete === true;
  const isolation = coerceIsolationClaim(evidence.isolation);
  const gaps = gapsOf(evidence);
  const autonomousSoftwareFactory =
    leftover === false && human === true && real === true && complete === true &&
    isolation.sandbox === false && gaps.length === 0;
  // W53 · 340-2: the ONE deliberate door, named without touching the latch.
  // `human === false` is exactly what keeps `autonomousSoftwareFactory` false
  // here, so these conjuncts say: every machine-fixable term is met AND the only
  // unmet term is the human stamp AND the record really is WAITING (`pending`).
  // A `no-fixtures`/`machine-decided`/`unattributed`/`unreadable`/absent state
  // is a defect, never "awaiting a human" — fail-closed.
  const awaitingHumanAcceptance =
    leftover === false &&
    real === true &&
    complete === true &&
    isolation.sandbox === false &&
    human === false &&
    evidence.acceptance?.state === "pending";
  const cap = tokenCapFromEnv(env);
  return {
    autonomousSoftwareFactory,
    awaitingHumanAcceptance,
    leftoverJobsAreReexportsOrStubs: leftover,
    chatHasSlashToolsOnly: evidence.chatHasSlashToolsOnly !== false,
    runnerIsSandbox: false,
    isolation,
    tokenCap: cap ?? null,
    spend: doctorSpend(spend),
    gaps,
    inventory: evidence.inventory ?? null,
  };
}

/**
 * Coerce any untrusted blob to an honest factory claim. Ignores
 * `autonomousSoftwareFactory: true` unless the accompanying field truth
 * actually supports it. Never re-emits `runnerIsSandbox: true`.
 *
 * OV-9 (W18-L1): `productComplete` is NOT read from the blob — a raw claim can
 * no longer mint it (pre-OV-9 doctor.ts:252 read `r.productComplete === true`,
 * the last assertable path). It is derived from real project state: pass the
 * project object / parsed `.rapidtool/project.json` as `project` and the bar is
 * computed there; without that state the complete gap always stands
 * (fail-closed). W52 · 338-3: humanFixtures is DERIVED from the record
 * (`humanFixturesFromProject`); W55 · 341-5: the blob's own `humanFixtures`
 * flag is IGNORED — pre-fix it ORed straight into the evidence and let a raw
 * claim mint the one conjunct 338-4 reserved for a real human stamp.
 * W53 · 340-2: the live `acceptance` state is derived the same way, and none
 * of these three is read from the blob.
 *
 * OV-41 (W23 · L4): `spend` is NOT read from the blob — a raw claim can no
 * more mint a dollar figure than it can a capability. The honest
 * `measured:false` envelope rides here; a caller with a real ledger attaches it
 * through `factoryClaim(…, spend)`.
 */
export function coerceFactoryClaim(raw?: unknown, project?: unknown): DoctorFactory {
  const blob =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const evidence: FactoryEvidence = blob
    ? {
        leftoverJobsAreReexportsOrStubs: blob.leftoverJobsAreReexportsOrStubs === false ? false : true,
        humanFixtures: humanFixturesFromProject(project),
        acceptance: liveAcceptanceState(project),
        realMultiJobProduct: blob.realMultiJobProduct === true,
        productComplete: productCompleteFromProject(project),
        chatHasSlashToolsOnly: blob.chatHasSlashToolsOnly !== false,
        isolation: blob.isolation,
      }
    : { ...RAPIDTOOL_FACTORY_EVIDENCE, productComplete: productCompleteFromProject(project), humanFixtures: humanFixturesFromProject(project), acceptance: liveAcceptanceState(project) };
  return factoryClaim(evidence);
}

/** Live RapidTool doctor factory field (always false until field truth lands). */
export function doctorFactory(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  spend?: TokenSpend | TokenLedger | null,
): DoctorFactory {
  return factoryClaim(RAPIDTOOL_FACTORY_EVIDENCE, env, spend);
}

/** Isolation advertisement the doctor must emit (frozen non-sandbox). */
export function doctorIsolation(): IsolationClaim {
  return runnerIsolationClaim();
}

// ---------------------------------------------------------------------------
// T-107.2 (fixes/216p, W6 · L3) — provider-team surfacing
// ---------------------------------------------------------------------------

/** One registered provider as the doctor reports it. Carries the env VAR NAME
 *  (never its value) and the honest configured probe for that key. */
export type DoctorProviderEntry = {
  id: string;
  label: string;
  /** The env var that holds this provider's key — the configured probe reads
   *  exactly this name; the value itself never enters this envelope. */
  apiKeyEnv: string;
  configured: boolean;
};

/** One role tier as the doctor reports it: which provider serves the role and
 *  the model id the registry would actually SEND (env pin applied). */
export type DoctorProviderTier = {
  role: RapidToolModelRole;
  provider: string | null;
  /** The `<PREFIX>_MODEL_<ROLE>` pin var, when the role's provider is known. */
  envKey: string | null;
  /** The RESOLVED request model id (pin applied); null when resolution refuses. */
  model: string | null;
  /** True when the resolved id came from the env pin (not the tier default). */
  pinned: boolean;
  /** The coded refusal reason when resolution fails (unknown pin/source);
   *  null on success. Never a silent default. */
  error: string | null;
};

/** The provider team as the doctor reports it: providers + per-role resolved
 *  model ids + the configured state. Keyless stays honestly not-configured.
 *  OV-1 (W23-L4): `envSelection` names which provider/model the ENVIRONMENT
 *  resolves to (RAPIDTOOL_PROVIDER / the default rung), keyed vs keyless. */
export type DoctorProviderTeam = {
  /** True when at least one registered provider has its key env var set. */
  configured: boolean;
  /** Status label (keyless: byte-identical to the historical
   *  `not configured (set DEEPSEEK_API_KEY)` string). */
  label: string;
  /** One-line rendering for CLI/log surfaces (`providerTeam: …`). */
  line: string;
  providers: DoctorProviderEntry[];
  tiers: DoctorProviderTier[];
  /** OV-1: the `RAPIDTOOL_PROVIDER` env selection, as the registry resolves it. */
  envSelection: DoctorProviderEnvSelection;
};

/**
 * OV-1 (W23 · L4): which provider/model the environment resolves to, and
 * whether that route is keyed or on the keyless floor. Every field is read
 * through the registry's OWN resolvers (`resolveEnvProvider` /
 * `resolveEnvSelectedRoute`) — no second source of truth. The API-key VALUE is
 * never read: `keyed` = the selected provider's `apiKeyEnv` is non-blank in
 * the passed env. An unknown `RAPIDTOOL_PROVIDER` id is surfaced as the coded
 * refusal it is (`error`), never as a silent default.
 */
export type DoctorProviderEnvSelection = {
  /** The env var read for selection (`RAPIDTOOL_PROVIDER`). */
  envVar: string;
  /** The trimmed requested value, or null when unset/blank. */
  requested: string | null;
  /** Which precedence rung fired ("default" = env unset; "env" = explicitly set). */
  source: "env" | "default";
  /** Resolved provider id / descriptor label; null on refusal. */
  provider: string | null;
  label: string | null;
  /** The provider's key env var NAME (never its value); null on refusal. */
  apiKeyEnv: string | null;
  /** True when that key env var is set — keyed; false = keyless floor. */
  keyed: boolean;
  /** The resolved `main` model id the environment routes to; null on refusal. */
  model: string | null;
  /** The `<PREFIX>_MODEL_MAIN` pin var for the selected provider. */
  modelEnvKey: string | null;
  /** True when `model` came from the env pin (not the default). */
  pinned: boolean;
  /** The coded refusal reason when selection/route fails; null on success. */
  error: string | null;
  /** One-line rendering for CLI/log summaries (`providerEnv: …`). */
  line: string;
};

/**
 * Read-only provider-team field for the doctor surfaces (T-107.2, fixes/216p):
 * the registered providers, every role tier's REAL resolved model id (env pins
 * applied — an unknown pin surfaces as a refusal, never a substituted id), and
 * the honest configured boolean for the passed env.
 *
 * The registry is loaded through a lazy `import()` seam exactly like the other
 * server-only reads in `headless.doctorStatus` — this module's STATIC graph
 * stays `sandbox-policy` + `token-ledger` (client-safe, no `node:fs`, no key
 * read at import time). The API-key VALUE is never read into this envelope —
 * only `Boolean(env[apiKeyEnv]?.trim())`.
 */
export async function doctorProviderTeam(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Promise<DoctorProviderTeam> {
  const registry = await import("./llm/providers/registry.ts");
  const providers: DoctorProviderEntry[] = registry.PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    apiKeyEnv: p.apiKeyEnv,
    configured: Boolean(env[p.apiKeyEnv]?.trim()),
  }));
  const tiers: DoctorProviderTier[] = registry.RAPIDTOOL_MODEL_ROLES.map((role) => {
    const tier = registry.ROLE_TIERS[role];
    const provider = registry.getProvider(tier.provider);
    const envKey = registry.roleModelEnvKey(role);
    const resolved = registry.resolveRoleModel(role, { env: env as NodeJS.ProcessEnv });
    return {
      role,
      provider: provider ? provider.id : null,
      envKey,
      model: resolved.ok ? resolved.model : null,
      pinned: Boolean(envKey && env[envKey]?.trim()),
      error: resolved.ok ? null : resolved.error,
    };
  });
  const configured = providers.some((p) => p.configured);
  const label = configured
    ? `${providers.map((p) => p.label).join(", ")} (configured)`
    : `not configured (set ${providers.map((p) => p.apiKeyEnv).join(", ")})`;
  const segments = tiers.map((t) => `${t.role}=${t.model ?? "refused"}`).join(" ");
  return {
    configured,
    label,
    line: `providerTeam: ${label} — ${segments}`,
    providers,
    tiers,
    envSelection: buildEnvSelection(registry, env),
  };
}

/** One-line cap for embedded refusal prose in doctor summary lines. */
function shortLine(s: string, cap = 140): string {
  return s.length > cap ? `${s.slice(0, cap)}…` : s;
}

/**
 * OV-1 (W23 · L4): build the honest env-selection summary (see
 * `DoctorProviderEnvSelection`). Reads the registry's own resolvers; the
 * "cloud-by-default, keyless floor" wording states the landed truth — the
 * default rung is a cloud API (deepseek), and a missing key is the keyless
 * floor (`RT_E_LLM_NOT_CONFIGURED` + deterministic scaffold), never fake
 * model text.
 */
function buildEnvSelection(
  registry: typeof import("./llm/providers/registry.ts"),
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): DoctorProviderEnvSelection {
  const envVar = registry.PROVIDER_ENV_VAR;
  const raw = env?.[envVar];
  const requested = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  const selection = registry.resolveEnvProvider(env as NodeJS.ProcessEnv);
  if (!selection.ok) {
    return {
      envVar,
      requested,
      source: "env",
      provider: null,
      label: null,
      apiKeyEnv: null,
      keyed: false,
      model: null,
      modelEnvKey: null,
      pinned: false,
      error: selection.error,
      line: `providerEnv: ${envVar}=${requested ?? "(blank)"} refused [${selection.code}] — ${shortLine(
        selection.error,
      )}; never silently defaulted to ${registry.DEFAULT_PROVIDER_ID}`,
    };
  }
  const provider = selection.provider;
  const keyed = Boolean(env?.[provider.apiKeyEnv]?.trim());
  const route = registry.resolveEnvSelectedRoute("main", { env: env as NodeJS.ProcessEnv });
  const modelEnvKey = `${provider.modelEnvPrefix}_MODEL_MAIN`;
  const pinned = Boolean(env?.[modelEnvKey]?.trim());
  const how =
    selection.source === "env"
      ? `${envVar}=${selection.requested} (env — explicit deployment choice)`
      : `cloud-by-default (${envVar} unset ⇒ ${provider.id})`;
  const keys = keyed
    ? `keyed (${provider.apiKeyEnv} set)`
    : `keyless floor (${provider.apiKeyEnv} unset ⇒ RT_E_LLM_NOT_CONFIGURED for ${provider.id}; deterministic scaffold — model text is never fabricated)`;
  const main = route.ok ? route.model : `refused [${route.code}] ${shortLine(route.error)}`;
  return {
    envVar,
    requested,
    source: selection.source,
    provider: provider.id,
    label: provider.label,
    apiKeyEnv: provider.apiKeyEnv,
    keyed,
    model: route.ok ? route.model : null,
    modelEnvKey,
    pinned,
    error: route.ok ? null : route.error,
    line: `providerEnv: ${how}, ${keys} · main=${main}`,
  };
}

// ---------------------------------------------------------------------------
// 342-5 — the doctor's honest MCP surface (the F1 client's consumer)
// ---------------------------------------------------------------------------

/**
 * Report MCP truthfully: the enablement gate (`RAPIDTOOL_MCP_ENABLED`) and,
 * ONLY when that is set AND a server is configured (`RAPIDTOOL_MCP_SERVER`),
 * the server's own `tools/list` result. A disabled host spawns nothing and
 * returns `tools: null` with the coded `RT_E_MCP_DISABLED` refusal; a configured
 * host that is switched off still spawns nothing. The list is never fabricated
 * and no simulator exists.
 *
 * The module is loaded through a lazy `import()` seam so this file's STATIC
 * graph stays client-safe (mirrors `doctorProviderTeam`): no `node:` import at
 * module load. `options.server` / `options.call` are programmatic overrides for
 * the CLI; the env path is the default.
 */
export async function doctorMcp(
  options: {
    env?: NodeJS.ProcessEnv;
    server?: McpServerConfig;
    call?: { tool: string; args?: Record<string, unknown> };
    timeoutMs?: number;
  } = {},
): Promise<McpToolsSurface> {
  const mcp = await import("./mcp.server.ts");
  return mcp.mcpToolsSurface(options);
}

// ---------------------------------------------------------------------------
// OV-41 (W23 · L4, fixes/262) — measured spend, read from the T-107.6 ledger
// ---------------------------------------------------------------------------

/**
 * Measured spend as a doctor summary reports it (OV-41). Every number is a
 * `token-ledger.ts` field or one of its own helpers — `totalTokens` and
 * `estimateCostUsd` — CONSUMED, never recomputed, never fabricated:
 *
 *   - no ledger handed in (or hostile base fields) ⇒ `measured:false` with
 *     every token field null — a fake 0 is never emitted;
 *   - `estimatedCostUsd` is null unless CALLER prices were supplied, because
 *     token-ledger.ts deliberately ships no price catalog (107 §11) — an
 *     unpriced spend reports tokens only;
 *   - the dollar figure is an estimate under caller prices, never a vendor
 *     bill (the ledger's own header wording).
 */
export type DoctorSpend = {
  /** True only when a usable measured ledger was handed in. */
  measured: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  /** `token-ledger.totalTokens(ledger)` — the ledger's own sum. */
  totalTokens: number | null;
  /** Recorded wire calls, when the fuller TokenLedger shape carries it. */
  calls: number | null;
  /** Cache-aware fields (T-107.6) when reported — subsets of the counts above. */
  cachedPromptTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
  /** `token-ledger.estimateCostUsd(ledger, prices)`; null when no caller prices. */
  estimatedCostUsd: number | null;
  /** True when caller-supplied prices were usable for the estimate. */
  pricesSupplied: boolean;
  /** One-line rendering for CLI/log summaries (`spend: …`). */
  line: string;
};

/** Positive-finite gate for caller prices: an estimate is emitted only when
 *  BOTH per-1M prices are usable. token-ledger floors bad prices to 0; this
 *  surface refuses them instead of printing a misleading $0. */
function usablePrices(prices: TokenPrices | null | undefined): prices is TokenPrices {
  return Boolean(
    prices &&
      typeof prices === "object" &&
      Number.isFinite(prices.inputPerMillion) &&
      prices.inputPerMillion > 0 &&
      Number.isFinite(prices.outputPerMillion) &&
      prices.outputPerMillion > 0,
  );
}

/** Deterministic USD rendering for summary lines (6 decimals; never
 *  scientific notation for sub-cent estimates). */
function usdAmount(usd: number): string {
  return `$${usd.toFixed(6)}`;
}

function numOrNull(v: number | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Read one measured ledger into the doctor's honest spend summary (OV-41).
 * `source` is a T-107.6 `TokenLedger` / `TokenSpend` — or the persisted
 * `Project.tokenUsage` slice (the run's cumulative spend; `headless.doctorStatus`
 * reads it from the product tree's `.rapidtool/project.json`, W46 · 332-2). A
 * legacy 2-key slice carries no `calls`/cache keys, so those read honestly as
 * `null` (never a fabricated 0). `prices` is CALLER-supplied (token-ledger ships
 * no catalog); omitted ⇒ tokens only, cost null. Pure; never throws (hostile
 * input ⇒ the honest `measured:false` envelope).
 */
export function doctorSpend(
  source: TokenSpend | TokenLedger | null | undefined,
  prices?: TokenPrices | null,
): DoctorSpend {
  const empty: DoctorSpend = {
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
  if (!source || typeof source !== "object") return empty;
  const promptTokens = numOrNull(source.promptTokens);
  const completionTokens = numOrNull(source.completionTokens);
  if (
    promptTokens === null ||
    promptTokens < 0 ||
    completionTokens === null ||
    completionTokens < 0
  ) {
    return empty;
  }
  const ledger = source as TokenLedger;
  const calls = numOrNull(ledger.calls);
  const cachedPromptTokens = numOrNull(ledger.cachedPromptTokens);
  const cacheWriteTokens = numOrNull(ledger.cacheWriteTokens);
  const reasoningTokens = numOrNull(ledger.reasoningTokens);
  const total = totalTokens({ promptTokens, completionTokens, calls: calls ?? 0 });
  const priced = usablePrices(prices);
  const estimatedCostUsd = priced ? estimateCostUsd(source, prices) : null;
  const callSegment = calls !== null ? ` · ${calls} call(s)` : "";
  const costSegment =
    estimatedCostUsd !== null
      ? `est. ${usdAmount(estimatedCostUsd)} (caller-supplied prices — an estimate, not a vendor bill)`
      : "est. cost n/a (no caller prices — token-ledger ships no price catalog)";
  return {
    measured: true,
    promptTokens,
    completionTokens,
    totalTokens: total,
    calls,
    cachedPromptTokens,
    cacheWriteTokens,
    reasoningTokens,
    estimatedCostUsd,
    pricesSupplied: priced,
    line: `spend: ${total} tokens measured (prompt ${promptTokens} + completion ${completionTokens}${callSegment}) · ${costSegment}`,
  };
}

// ---------------------------------------------------------------------------
// W46 · 332-2 (F-5, fixes/333_1_verifier.md) — key PRESENCE is not key VALIDITY
// ---------------------------------------------------------------------------

/**
 * The coded classes that mean the KEY itself was refused (mirrors
 * `console.tsx`'s `KEY_UNUSABLE_CODES`). Only these flip the doctor to
 * `rejected`; a transient class (timeout, insufficient funds, provider 5xx)
 * never condemns a working key.
 */
const KEY_UNUSABLE_CODES: ReadonlySet<string> = new Set([
  "RT_E_LLM_KEY_REJECTED",
  "RT_E_LLM_KEY_SHADOWED",
]);

/** True when `code` is a key-UNUSABLE class — the set that flips the doctor to
 *  `rejected` (and the same set `console.tsx`'s chip narrows on). Explicitly
 *  exported so the run-boundary writer (`headless`) shares ONE vocabulary with
 *  this reader instead of duplicating the list. */
export function isKeyUnusableCode(code: unknown): boolean {
  return typeof code === "string" && KEY_UNUSABLE_CODES.has(code);
}

/** One keyed-call outcome reported by the server probe (C1 · 332-5).
 *  `keySource` is a tail-only path/scope label (`<file> (tail …xxxx)` /
 *  `the process environment (tail …xxxx)`) — NEVER a key value. */
export type DoctorLastKeyed = { code: string; at: number; keySource?: string };

/** Doctor's explicit key-VALIDITY state. `configured` alone means only that a
 *  key is PRESENT; this states whether presence has been validated. */
export type DoctorLlmKeyState = "not-configured" | "unverified" | "rejected";

export type DoctorLlmKey = {
  keyState: DoctorLlmKeyState;
  /** The last keyed failure the process saw, when one is known (tail-only). */
  lastKeyed?: DoctorLastKeyed;
};

/** Validate a server probe's `lastKeyed` shape — a hostile or partial payload is
 *  DROPPED, never trusted (mirrors `store.readLastKeyed`). */
export function readLastKeyedOutcome(v: unknown): DoctorLastKeyed | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as { code?: unknown; at?: unknown; keySource?: unknown };
  if (typeof o.code !== "string" || o.code.length === 0) return undefined;
  if (typeof o.at !== "number" || !Number.isFinite(o.at)) return undefined;
  return {
    code: o.code,
    at: o.at,
    ...(typeof o.keySource === "string" && o.keySource.length > 0 ? { keySource: o.keySource } : {}),
  };
}

/**
 * F-5: derive the doctor's key-validity state. Presence alone NEVER implies a
 * validated key:
 *   - no key                    ⇒ `not-configured` (no `lastKeyed` — nothing to attribute)
 *   - key, no recorded outcome  ⇒ `unverified`     (the honest presence-only floor)
 *   - key + a key-unusable code ⇒ `rejected`       (+ the coded class, tail-only source)
 *   - key + any other failure   ⇒ `unverified`     (+ the outcome, never a key condemnation)
 * `llm.ts`'s tap CLEARS its record on success, so "last call succeeded" and
 * "none seen" are indistinguishable here — `unverified` is therefore the only
 * honest non-`rejected` state, never an invented green.
 */
export function doctorLlmKey(configured: boolean, lastKeyed?: unknown): DoctorLlmKey {
  if (!configured) return { keyState: "not-configured" };
  const lk = readLastKeyedOutcome(lastKeyed);
  if (lk && isKeyUnusableCode(lk.code)) return { keyState: "rejected", lastKeyed: lk };
  return lk ? { keyState: "unverified", lastKeyed: lk } : { keyState: "unverified" };
}
