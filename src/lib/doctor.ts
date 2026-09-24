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
 * Client-safe: sandbox-policy + token-ledger + the pure p6-arch trace seam
 * (dod.ts — no node:fs anywhere in its graph; the console store already
 * bundles it). OV-9 (W18-L1): productComplete is DERIVED from real project
 * state (`productCompleteFromProject`) — never read from a caller's flag.
 */
import {
  coerceIsolationClaim,
  runnerIsolationClaim,
  type IsolationClaim,
} from "./sandbox-policy.ts";
import { tokenCapFromEnv } from "./token-ledger.ts";
// OV-9 (W18-L1): the product-complete producer's ONE derivation — the same
// pure p6-arch trace the phase-6 gate reads (dod.ts, no node:fs in its graph).
import { archProductComplete, archTrace } from "./dod.ts";
import type { Project } from "./types.ts";
// W6-L3 provider surfacing: TYPE-ONLY import — erased at compile, so the
// client-safe runtime surface (sandbox-policy + token-ledger) is unchanged.
import type { RapidToolModelRole } from "./llm/providers/registry.ts";

/** Evidence bag the latch reads. Absent fields default to RapidTool-now (not a factory). */
export type FactoryEvidence = {
  leftoverJobsAreReexportsOrStubs?: boolean;
  humanFixtures?: boolean;
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
 * 214: leftover-job census → factory evidence.
 * leftover true when any stub/reexport exists OR zero real jobs.
 * realMultiJobProduct true only when ≥2 real jobs and zero leftover stubs/reexports.
 * OV-9: productComplete is DERIVED from the real project state the caller
 * hands under `project` — never from a boolean extra (a hand-passed
 * `productComplete` key is not in the type and is ignored at runtime). The 214
 * census cross-gate stays: stubs/reexports seen in the scan, or fewer than two
 * real jobs, refuse the bar. humanFixtures stays unminted here — its producer
 * is T5.2-A's UI lane.
 */
export function evidenceFromJobInventory(
  inv: JobInventory,
  extra?: Omit<Partial<FactoryEvidence>, "productComplete" | "inventory"> & ProductStateEvidence,
): FactoryEvidence {
  const leftover = inv.stubs + inv.reexports > 0 || inv.real === 0;
  const realMulti = inv.real >= 2 && inv.stubs === 0 && inv.reexports === 0;
  return {
    leftoverJobsAreReexportsOrStubs: leftover,
    realMultiJobProduct: realMulti,
    humanFixtures: extra?.humanFixtures === true,
    productComplete: (extra as Partial<FactoryEvidence> | undefined)?.productComplete === true && realMulti && !leftover,
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
 *
 * OV-9 (W18-L1): `productComplete` is NOT read from the blob — a raw claim can
 * no longer mint it (pre-OV-9 doctor.ts:252 read `r.productComplete === true`,
 * the last assertable path). It is derived from real project state: pass the
 * project object / parsed `.rapidtool/project.json` as `project` and the bar is
 * computed there; without that state the complete gap always stands
 * (fail-closed). humanFixtures still rides the blob's field truth — its
 * producer belongs to T5.2-A.
 */
export function coerceFactoryClaim(raw?: unknown, project?: unknown): DoctorFactory {
  const blob =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const evidence: FactoryEvidence = blob
    ? {
        leftoverJobsAreReexportsOrStubs: blob.leftoverJobsAreReexportsOrStubs === false ? false : true,
        humanFixtures: blob.humanFixtures === true,
        realMultiJobProduct: blob.realMultiJobProduct === true,
        productComplete: productCompleteFromProject(project),
        chatHasSlashToolsOnly: blob.chatHasSlashToolsOnly !== false,
        isolation: blob.isolation,
      }
    : { ...RAPIDTOOL_FACTORY_EVIDENCE, productComplete: productCompleteFromProject(project) };
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
 *  model ids + the configured state. Keyless stays honestly not-configured. */
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
  };
}
