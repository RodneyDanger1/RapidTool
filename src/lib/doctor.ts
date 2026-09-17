/**
 * Factory-honest doctor field (fixes/210 G1).
 *
 * Parent `headless.doctorStatus` currently hardcodes
 * `autonomousSoftwareFactory: false`. This module is the field-truth latch
 * so that flag can never become true without evidence:
 *
 *   leftover jobs gone (not reexports / TODO(E-15) stubs)
 *   + real multi-job product
 *   + human-approved fixtures (`decidedBy: "human"`)
 *   + product-complete bar (skip ≠ green; stubs ≠ complete)
 *
 * RapidTool-now does not meet that bar. Do not invent flip/record/show/publish
 * job bodies to fake it. Sandbox is always false (no Docker claim).
 *
 * 185-H1: this envelope has no `ok`/`error` pair — never dual-channel.
 *
 * Client-safe: sandbox-policy + token-ledger only.
 */
import {
  coerceIsolationClaim,
  runnerIsolationClaim,
  type IsolationClaim,
} from "./sandbox-policy.ts";
import { tokenCapFromEnv } from "./token-ledger.ts";

/** Evidence bag the latch reads. Absent fields default to RapidTool-now (not a factory). */
export type FactoryEvidence = {
  leftoverJobsAreReexportsOrStubs?: boolean;
  humanFixtures?: boolean;
  realMultiJobProduct?: boolean;
  productComplete?: boolean;
  chatHasSlashToolsOnly?: boolean;
  isolation?: unknown;
  inventory?: JobInventory | null;
};

export type DoctorFactory = {
  autonomousSoftwareFactory: boolean;
  leftoverJobsAreReexportsOrStubs: boolean;
  chatHasSlashToolsOnly: boolean;
  runnerIsSandbox: false;
  isolation: IsolationClaim;
  tokenCap: number | null;
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

/** Classify one source file. Never invents a job body — stubs stay stubs. */
export function classifyJobSource(source: string): JobSourceKind {
  if (typeof source !== "string" || source.trim() === "") return "stub";
  if (source.includes("TODO(E-15)")) return "stub";
  if (/throw\s+new\s+Error\s*\(\s*(['"`])TODO\b/i.test(source)) return "stub";
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
 * 214: leftover-job census → factory evidence.
 * leftover true when any stub/reexport exists OR zero real jobs.
 * realMultiJobProduct true only when ≥2 real jobs and zero leftover stubs/reexports.
 * Does NOT mint humanFixtures or productComplete — those stay extra.
 */
export function evidenceFromJobInventory(
  inv: JobInventory,
  extra?: Partial<FactoryEvidence>,
): FactoryEvidence {
  const leftover = inv.stubs + inv.reexports > 0 || inv.real === 0;
  const realMulti = inv.real >= 2 && inv.stubs === 0 && inv.reexports === 0;
  return {
    leftoverJobsAreReexportsOrStubs: leftover,
    realMultiJobProduct: realMulti,
    humanFixtures: extra?.humanFixtures === true,
    productComplete: extra?.productComplete === true && realMulti && !leftover,
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
  complete: "product-complete bar not met (skip≠green; stubs≠complete)",
} as const;

function gapsOf(evidence: FactoryEvidence): string[] {
  const leftover = evidence.leftoverJobsAreReexportsOrStubs !== false;
  const human = evidence.humanFixtures === true;
  const real = evidence.realMultiJobProduct === true;
  const complete = evidence.productComplete === true;
  const gaps: string[] = [];
  if (leftover) gaps.push(FACTORY_GAP.leftover);
  if (!human) gaps.push(FACTORY_GAP.fixtures);
  if (!real) gaps.push(FACTORY_GAP.product);
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
 */
export function factoryClaim(
  evidence: FactoryEvidence = RAPIDTOOL_FACTORY_EVIDENCE,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): DoctorFactory {
  const leftover = evidence.leftoverJobsAreReexportsOrStubs !== false;
  const isolation = coerceIsolationClaim(evidence.isolation);
  const gaps = gapsOf(evidence);
  const autonomousSoftwareFactory =
    leftover === false &&
    evidence.humanFixtures === true &&
    evidence.realMultiJobProduct === true &&
    evidence.productComplete === true &&
    isolation.sandbox === false &&
    gaps.length === 0;
  const cap = tokenCapFromEnv(env);
  return {
    autonomousSoftwareFactory,
    leftoverJobsAreReexportsOrStubs: leftover,
    chatHasSlashToolsOnly: evidence.chatHasSlashToolsOnly !== false,
    runnerIsSandbox: false,
    isolation,
    tokenCap: cap ?? null,
    gaps,
    inventory: evidence.inventory ?? null,
  };
}

/**
 * Coerce any untrusted blob to an honest factory claim. Ignores
 * `autonomousSoftwareFactory: true` unless the accompanying field truth
 * actually supports it. Never re-emits `runnerIsSandbox: true`.
 */
export function coerceFactoryClaim(raw?: unknown): DoctorFactory {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return factoryClaim(RAPIDTOOL_FACTORY_EVIDENCE);
  }
  const r = raw as Record<string, unknown>;
  const evidence: FactoryEvidence = {
    leftoverJobsAreReexportsOrStubs: r.leftoverJobsAreReexportsOrStubs === false ? false : true,
    humanFixtures: r.humanFixtures === true,
    realMultiJobProduct: r.realMultiJobProduct === true,
    productComplete: r.productComplete === true,
    chatHasSlashToolsOnly: r.chatHasSlashToolsOnly !== false,
    isolation: r.isolation,
  };
  return factoryClaim(evidence);
}

/** Live RapidTool doctor factory field (always false until field truth lands). */
export function doctorFactory(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): DoctorFactory {
  return factoryClaim(RAPIDTOOL_FACTORY_EVIDENCE, env);
}

/** Isolation advertisement the doctor must emit (frozen non-sandbox). */
export function doctorIsolation(): IsolationClaim {
  return runnerIsolationClaim();
}
