#!/usr/bin/env node
/**
 * P-B · Q4 — the S4 ENABLING-WAVE invariants (fixes/346).
 *
 * Lane S4 armed the bounded P6 resample BY DEFAULT (T1's measured gain): the
 * chunked tree's per-chunk acceptance + fail-fast offender resample now runs
 * with a default candidate count of 2, while the primary single-module best-of-N
 * stays opt-in (default 1). An explicit `P6_SYNTH_CANDIDATES=1` (or
 * `deps.candidates: 1`) is the opt-out that restores the byte-identical legacy
 * single sample. This module is the fail-closed tourniquet around that wave:
 *
 *   S4-01 default-armed      the chunk resample's default candidate count is > 1
 *                            (the gain is ON by default). Fires the moment the
 *                            default is reverted to 1 without an explicit
 *                            decision, or the resolver stops consuming the
 *                            armed constant.
 *   S4-02 bounded-resample   every resample loop is BOUNDED (a finite
 *                            P6_SYNTH_CANDIDATES_MAX clamp on each loop bound).
 *                            Fires when a bound is removed (an unbounded retry).
 *   S4-03 refusal-coverage   each re-pinned refusal-path suite still contains
 *                            its genuine-refusal assertions (the `p6.synthesis.
 *                            refused` event + the coded reason), and the
 *                            armed-resample "both candidates rejected" proof is
 *                            kept. Fires when a re-pin deletes or weakens a
 *                            refusal instead of moving it to an opt-out variant.
 *
 * Every detector reads the REAL bytes it guards: `src/lib/synthesis-policy.ts`,
 * `src/lib/codegen.server.ts`, the two re-pinned suites, and the frozen
 * `cassettes/refusal-coverage.json` baseline (derived from the HEAD suite
 * counts). Each carries a real mutation control — the guard fires on the
 * injected defect and stays silent on the live source; a guard that cannot fail
 * is worthless.
 *
 * Usage:
 *   node scripts/guards/enabling-wave-invariants.mjs [--json] [--selftest]
 *
 * Exit codes:
 *   0  no finding (lint) / every control proof holds
 *   1  at least one finding / a control proof failed
 *   2  usage / unreadable input (fail closed)
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, "..", "..");
export const POLICY_FILE = join(REPO_ROOT, "src", "lib", "synthesis-policy.ts");
export const CODEGEN_FILE = join(REPO_ROOT, "src", "lib", "codegen.server.ts");
export const REFUSAL_SUITE_FILE = join(REPO_ROOT, "src", "lib", "codegen.server.test.ts");
export const POLICY_SUITE_FILE = join(REPO_ROOT, "src", "lib", "synthesis-policy.test.ts");
export const REFUSAL_BASELINE_FILE = join(REPO_ROOT, "scripts", "prevention", "cassettes", "refusal-coverage.json");

/** The armed chunk-resample default constant — the lever S4 turned on. */
const ARMED_CONST = "P6_SYNTH_CHUNK_RETRY_CANDIDATES";
const MAX_CONST = "P6_SYNTH_CANDIDATES_MAX";
const REFUSAL_EVENT = "p6.synthesis.refused";

export const DEFAULT_DISARMED_CODE = "RT_E_SYNTH_DEFAULT_DISARMED";
export const UNBOUNDED_RESAMPLE_CODE = "RT_E_SYNTH_RESAMPLE_UNBOUNDED";
export const REFUSAL_COVERAGE_CODE = "RT_E_REFUSAL_COVERAGE_LOST";

/** Read a text file, "" on any failure (never throws). @param {string} p @returns {string} */
export function safeRead(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

/** Read + parse a JSON file, null on absence/parse error. @param {string} p @returns {any} */
export function readJson(p) {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

/**
 * `export const <name> = <int>;` → the integer, else null (never guesses a value
 * out of a renamed/derived constant).
 * @param {string} source @param {string} name @returns {number|null}
 */
export function parseConstNumber(source, name) {
  const m = new RegExp("export\\s+const\\s+" + name + "\\s*=\\s*(-?\\d+)\\s*;").exec(String(source));
  return m ? Number(m[1]) : null;
}

/** Count non-overlapping occurrences of a literal/regex. @param {string} source @param {RegExp} re @returns {number} */
function countMatches(source, re) {
  return (String(source).match(re) || []).length;
}

// ---------------------------------------------------------------------------
// S4-01 — the default is ARMED.
// ---------------------------------------------------------------------------

/**
 * The chunk resample is ON by default iff the armed constant is > 1 AND the
 * resolver that consumes it falls back to it. A revert to 1 (or a resolver that
 * stops using the constant) disarms the wave silently — this fires on that.
 * @param {string} policySource @returns {Array<{code:string, detail:string, value?:number}>}
 */
export function detectDefaultDisarmed(policySource) {
  const src = String(policySource);
  const findings = [];
  const armed = parseConstNumber(src, ARMED_CONST);
  if (armed === null) {
    findings.push({ code: DEFAULT_DISARMED_CODE, detail: `${ARMED_CONST} is not a numeric literal in synthesis-policy.ts` });
  } else if (!(armed > 1)) {
    findings.push({
      code: DEFAULT_DISARMED_CODE,
      value: armed,
      detail: `the armed chunk-resample default is ${armed} (<= 1) — the S4 enabling gain is OFF by default`,
    });
  }
  const resolver = new RegExp("export\\s+function\\s+resolveChunkResampleCandidates[\\s\\S]*?\\n\\}").exec(src);
  if (!resolver || !resolver[0].includes(ARMED_CONST)) {
    findings.push({
      code: DEFAULT_DISARMED_CODE,
      detail: `resolveChunkResampleCandidates no longer falls back to ${ARMED_CONST} — the constant is not the default`,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// S4-02 — every resample loop is BOUNDED.
// ---------------------------------------------------------------------------

/** The bounded-loop markers the resample must keep in codegen.server.ts. */
const REQUIRED_CODEGEN_BOUNDS = [
  {
    re: /for\s*\(\s*let\s+k\s*=\s*2\s*;\s*k\s*<=\s*chunkRetry\s*;/,
    detail: "the per-chunk resample loop is not the bounded `for (let k = 2; k <= chunkRetry; k++)`",
  },
  {
    re: new RegExp("chunkRetry\\s*=\\s*Math\\.min\\(\\s*" + MAX_CONST),
    detail: `chunkRetry is not clamped to ${MAX_CONST}`,
  },
  {
    re: /for\s*\(\s*let\s+k\s*=\s*1\s*;\s*k\s*<=\s*offenderCandidates\s*;/,
    detail: "the fail-fast offender loop is not the bounded `for (let k = 1; k <= offenderCandidates; k++)`",
  },
  {
    re: new RegExp("offenderCandidates\\s*=[\\s\\S]{0,160}?Math\\.min\\(\\s*" + MAX_CONST),
    detail: `offenderCandidates is not clamped to ${MAX_CONST}`,
  },
  {
    re: /for\s*\(\s*let\s+k\s*=\s*1\s*;\s*k\s*<\s*candidates\s*;/,
    detail: "the whole-tree resample loop is not the bounded `for (let k = 1; k < candidates; k++)`",
  },
];

/**
 * Every resample loop must be bounded by a finite `P6_SYNTH_CANDIDATES_MAX`
 * clamp. A removed bound (an unbounded retry) is the defect this fires on.
 * @param {string} policySource @param {string} codegenSource @returns {Array<{code:string, detail:string}>}
 */
export function detectUnboundedResample(policySource, codegenSource) {
  const policy = String(policySource);
  const codegen = String(codegenSource);
  const findings = [];
  const max = parseConstNumber(policy, MAX_CONST);
  if (max === null || !Number.isFinite(max) || max < 2) {
    findings.push({ code: UNBOUNDED_RESAMPLE_CODE, detail: `${MAX_CONST} is not a finite integer >= 2 (the hard retry bound)` });
  }
  if (!new RegExp("Math\\.min\\(\\s*Math\\.floor\\(count\\)\\s*,\\s*" + MAX_CONST + "\\s*\\)").test(policy)) {
    findings.push({ code: UNBOUNDED_RESAMPLE_CODE, detail: `selectBestOfN does not clamp its count to ${MAX_CONST}` });
  }
  for (const b of REQUIRED_CODEGEN_BOUNDS) {
    if (!b.re.test(codegen)) findings.push({ code: UNBOUNDED_RESAMPLE_CODE, detail: b.detail });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// S4-03 — refusal coverage in the re-pinned suites.
// ---------------------------------------------------------------------------

/** Split a test file into `describe(<title>)` blocks by title substring. @param {string} source @returns {Array<{title:string, body:string}>} */
export function describeBlocks(source) {
  const parts = String(source).split(/describe\(/).slice(1);
  return parts.map((p) => {
    const m = /^\s*["'`]([^"'`]+)/.exec(p);
    return { title: m ? m[1] : "", body: p };
  });
}

/**
 * The re-pinned refusal-path suites must keep their genuine-refusal assertions:
 * the coded `p6.synthesis.refused` event, the coded reason, and (for the armed
 * path) the "both candidates rejected" proof. A re-pin that DELETES a refusal
 * instead of moving it to an opt-out variant drops a count below the pinned
 * floor — this fires on that.
 * @param {{codegenSuite:string, policySuite:string}} sources
 * @param {any} baseline
 * @returns {Array<{code:string, detail:string}>}
 */
export function detectRefusalCoverageLoss(sources, baseline) {
  const findings = [];
  if (!baseline || typeof baseline !== "object") {
    return [{ code: REFUSAL_COVERAGE_CODE, detail: "the refusal-coverage baseline cassette is missing or unparseable (fail closed)" }];
  }
  const codegen = String(sources.codegenSuite || "");
  const policy = String(sources.policySuite || "");
  const totals = baseline.totals || {};
  const refused = countMatches(codegen, new RegExp("p6\\.synthesis\\.refused", "g"));
  const coded = countMatches(codegen, new RegExp("RT_E_VALIDATION", "g")) + countMatches(codegen, new RegExp("RT_E_LLM_REJECTED", "g"));
  if (Number.isFinite(totals.refused) && refused < Number(totals.refused)) {
    findings.push({
      code: REFUSAL_COVERAGE_CODE,
      detail: `the refusal suite carries ${refused} \`${REFUSAL_EVENT}\` assertion(s), below the pinned floor of ${totals.refused} (a refusal was deleted/weakened)`,
    });
  }
  if (Number.isFinite(totals.codedReasons) && coded < Number(totals.codedReasons)) {
    findings.push({
      code: REFUSAL_COVERAGE_CODE,
      detail: `the refusal suite carries ${coded} coded-reason assertion(s), below the pinned floor of ${totals.codedReasons}`,
    });
  }
  if (typeof baseline.armedMarker === "string" && baseline.armedMarker.length > 0 && !codegen.includes(baseline.armedMarker)) {
    findings.push({
      code: REFUSAL_COVERAGE_CODE,
      detail: `the armed-resample rejection proof \`${baseline.armedMarker}\` vanished from the refusal suite`,
    });
  }
  const blocks = describeBlocks(codegen);
  for (const suite of Array.isArray(baseline.suites) ? baseline.suites : []) {
    const match = String(suite.match || "");
    const atLeast = Number(suite.refusedAtLeast || 1);
    const block = blocks.find((b) => b.title.includes(match));
    if (!block) {
      findings.push({ code: REFUSAL_COVERAGE_CODE, detail: `the re-pinned refusal suite "${match}" is gone from ${baseline.file || "the suite"}` });
      continue;
    }
    const n = countMatches(block.body, new RegExp("p6\\.synthesis\\.refused", "g"));
    if (n < atLeast) {
      findings.push({
        code: REFUSAL_COVERAGE_CODE,
        detail: `the suite "${match}" carries ${n} genuine-refusal assertion(s), below its pinned floor of ${atLeast}`,
      });
    }
  }
  for (const marker of [baseline.policyArmedMarker, baseline.policyOptOutMarker]) {
    if (typeof marker === "string" && marker.length > 0 && !policy.includes(marker)) {
      findings.push({ code: REFUSAL_COVERAGE_CODE, detail: `the policy suite lost its pinned marker \`${marker}\`` });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Controls (real source + real mutation).
// ---------------------------------------------------------------------------

/**
 * The three control proofs for the harness/test. `fired` = the detector alarms
 * on the injected defect; `controlClean` = it stays silent on the live source;
 * `wired` = the live seam is the armed/bounded/covered one.
 * @returns {Promise<Record<string, any>>}
 */
export async function enablingWaveControls() {
  const policy = safeRead(POLICY_FILE);
  const codegen = safeRead(CODEGEN_FILE);
  const codegenSuite = safeRead(REFUSAL_SUITE_FILE);
  const policySuite = safeRead(POLICY_SUITE_FILE);
  const baseline = readJson(REFUSAL_BASELINE_FILE);

  // S4-01: revert the armed constant to 1 (the disarmed default) — the guard must fire.
  const disarmedPolicy = policy.replace(new RegExp("(export\\s+const\\s+" + ARMED_CONST + "\\s*=\\s*)\\d+"), "$11");
  const s1Fired = detectDefaultDisarmed(disarmedPolicy).length > 0;
  const s1Clean = policy.length > 0 && detectDefaultDisarmed(policy).length === 0;

  // S4-02: strip every `Math.min(P6_SYNTH_CANDIDATES_MAX, ` clamp — the guard must fire.
  const unboundedCodegen = codegen.replace(new RegExp("Math\\.min\\(\\s*" + MAX_CONST + "\\s*,\\s*", "g"), "(");
  const s2Fired = detectUnboundedResample(policy, unboundedCodegen).length > 0;
  const s2Clean = policy.length > 0 && codegen.length > 0 && detectUnboundedResample(policy, codegen).length === 0;

  // S4-03: delete every genuine-refusal assertion — the guard must fire.
  const weakenedSuite = codegenSuite.replace(new RegExp("p6\\.synthesis\\.refused", "g"), "REMOVED_REFUSAL");
  const s3Fired = detectRefusalCoverageLoss({ codegenSuite: weakenedSuite, policySuite }, baseline).length > 0;
  const s3Clean =
    codegenSuite.length > 0 &&
    policySuite.length > 0 &&
    detectRefusalCoverageLoss({ codegenSuite, policySuite }, baseline).length === 0;

  return {
    "S4-01": {
      fired: s1Fired,
      controlClean: s1Clean,
      mutationRed: s1Fired && s1Clean,
      wired: s1Clean,
      armedDefault: parseConstNumber(policy, ARMED_CONST),
      seam: `${ARMED_CONST} + resolveChunkResampleCandidates`,
      evidence: { armedDefault: parseConstNumber(policy, ARMED_CONST), liveFindings: detectDefaultDisarmed(policy) },
    },
    "S4-02": {
      fired: s2Fired,
      controlClean: s2Clean,
      mutationRed: s2Fired && s2Clean,
      wired: s2Clean,
      max: parseConstNumber(policy, MAX_CONST),
      seam: "P6_SYNTH_CANDIDATES_MAX clamp on every resample loop bound",
      evidence: { max: parseConstNumber(policy, MAX_CONST), liveFindings: detectUnboundedResample(policy, codegen) },
    },
    "S4-03": {
      fired: s3Fired,
      controlClean: s3Clean,
      mutationRed: s3Fired && s3Clean,
      wired: s3Clean,
      baselineFile: baseline && typeof baseline === "object" ? baseline.file : null,
      seams: Array.isArray(baseline && baseline.suites) ? baseline.suites.map((s) => s.match) : [],
      evidence: { baseline, liveFindings: detectRefusalCoverageLoss({ codegenSuite, policySuite }, baseline) },
    },
  };
}

/** Control-proof summary consumed by `--selftest` and the P-A harness. @returns {Promise<any>} */
export async function selftest() {
  const controls = await enablingWaveControls();
  const entries = Object.entries(controls).map(([id, c]) => ({ id, ...c }));
  return { ok: entries.every((e) => e.fired && e.controlClean && e.mutationRed), entries };
}

function usage(msg) {
  if (msg) console.error(`[enabling-wave-invariants] ${msg}`);
  console.error("usage: node scripts/guards/enabling-wave-invariants.mjs [--json] [--selftest]");
}

async function main(argv) {
  const unknown = argv.filter((a) => a !== "--json" && a !== "--selftest");
  if (unknown.length > 0) {
    usage(`unknown argument(s): ${unknown.join(", ")}`);
    return 2;
  }
  const json = argv.includes("--json");
  if (argv.includes("--selftest")) {
    const r = await selftest();
    if (json) console.log(JSON.stringify({ guard: "enabling-wave-invariants", selftest: r }, null, 2));
    else for (const e of r.entries) console.log(`[enabling-wave-invariants] selftest ${e.id}: fired=${e.fired} controlClean=${e.controlClean} mutationRed=${e.mutationRed}`);
    return r.ok ? 0 : 1;
  }
  const controls = await enablingWaveControls();
  const entries = Object.entries(controls).map(([id, c]) => ({ id, ...c }));
  const ok = entries.every((e) => e.fired && e.controlClean && e.mutationRed);
  if (json) console.log(JSON.stringify({ guard: "enabling-wave-invariants", ok, entries }, null, 2));
  else for (const e of entries) console.log(`${e.fired ? "FIRE" : "----"} ${e.id}: ${e.seam || ""}`);
  return ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`[enabling-wave-invariants] ${String(e && e.message ? e.message : e)}`);
      process.exit(2);
    });
}
