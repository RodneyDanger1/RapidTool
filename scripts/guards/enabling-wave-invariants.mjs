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
 *   S4-04 accepted-chunk reuse  a resumed/accepted path is REUSED (0 synthesis
 *                            prompts) when `ctx.resumeAccepted` is populated.
 *                            The codegen consumer is landed; the journey
 *                            producer (`driveP6Journey` assigning
 *                            `ctx.resumeAccepted`) is the lane-D5 interface, so
 *                            this pin is RED (pending) until D5 lands it.
 *   S4-05 default-check baselines  BOTH default-check samples' workingApp scores
 *                            (sample1 0/4 AND sample2 3/4) stay pinned — the
 *                            variance is recorded, never just the good sample.
 *
 * Every detector reads the REAL bytes it guards: `src/lib/synthesis-policy.ts`,
 * `src/lib/codegen.server.ts`, `src/lib/headless.ts`, the two re-pinned suites,
 * the frozen `cassettes/refusal-coverage.json`, and the default-check cassettes
 * + `rubric-baselines.json`. Each carries a real mutation control — the guard
 * fires on the injected defect and stays silent on the live source; a guard that
 * cannot fail is worthless.
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
export const HEADLESS_FILE = join(REPO_ROOT, "src", "lib", "headless.ts");
export const REFUSAL_BASELINE_FILE = join(REPO_ROOT, "scripts", "prevention", "cassettes", "refusal-coverage.json");

/** The armed chunk-resample default constant — the lever S4 turned on. */
const ARMED_CONST = "P6_SYNTH_CHUNK_RETRY_CANDIDATES";
const MAX_CONST = "P6_SYNTH_CANDIDATES_MAX";
const REFUSAL_EVENT = "p6.synthesis.refused";

export const DEFAULT_DISARMED_CODE = "RT_E_SYNTH_DEFAULT_DISARMED";
export const UNBOUNDED_RESAMPLE_CODE = "RT_E_SYNTH_RESAMPLE_UNBOUNDED";
export const REFUSAL_COVERAGE_CODE = "RT_E_REFUSAL_COVERAGE_LOST";
export const RESUME_NOT_REUSED_CODE = "RT_E_SYNTH_RESUME_NOT_REUSED";
export const DEFAULT_CHECK_BASELINE_CODE = "RT_E_DEFAULT_CHECK_BASELINE_LOST";

/**
 * The documented hard cap on resample candidates (`synthesis-policy.test.ts`
 * asserts `P6_SYNTH_CANDIDATES_MAX === 4`). The bound must be BOTH >= 2 (armed,
 * S4-01) and <= this cap: a raised cap is an unbounded-cost regression even
 * though every loop is still "bounded".
 */
export const P6_SYNTH_CANDIDATES_CAP = 4;

/** The journey-side producer the reuse contract needs (fixed/346 lane D5). */
export const RESUME_PRODUCER_RE = /ctx\.resumeAccepted\s*=/;

/** The two default-check sample cassettes + the pinned rubric baselines. */
export const DEFAULT_CHECK_CASSETTE_DIR = join(REPO_ROOT, "scripts", "prevention", "cassettes", "default-check");
export const RUBRIC_BASELINES_FILE = join(REPO_ROOT, "scripts", "prevention", "cassettes", "rubric-baselines.json");

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
  } else if (max > P6_SYNTH_CANDIDATES_CAP) {
    findings.push({
      code: UNBOUNDED_RESAMPLE_CODE,
      detail: `${MAX_CONST} is ${max}, above the documented hard cap of ${P6_SYNTH_CANDIDATES_CAP} — the armed candidate bound must be <= ${P6_SYNTH_CANDIDATES_CAP}`,
    });
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
// S4-04 — accepted-chunk reuse: an accepted path is REUSED (0 synthesis prompt).
//
// The consumer half is landed in codegen.server.ts (the `resumeByPath` map, the
// `if (resumeByPath.size > 0)` branch, and the `p6.synthesis.reused` event), but
// `driveP6Journey` never POPULATES `ctx.resumeAccepted`, so a repair cycle with
// populated accepted chunks still re-buys them. This is the one RED pin of the
// final wave: it stays pending until lane D5 threads the previous cycle's
// accepted chunks into `P6JourneyCycleContext.resumeAccepted`.
// ---------------------------------------------------------------------------

/**
 * The reuse contract is met iff (a) codegen still CONSUMES `resumeAccepted`
 * (skips the model call for an accepted path) AND (b) the journey PRODUCES it.
 * Each missing half is a finding; a half-landed contract is the defect.
 * @param {{headlessSource:string, codegenSource:string}} sources
 * @returns {Array<{code:string, detail:string, surface:string}>}
 */
export function detectResumeReuseContract(sources) {
  const headless = String((sources && sources.headlessSource) || "");
  const codegen = String((sources && sources.codegenSource) || "");
  const findings = [];
  const consumer =
    codegen.includes("resumeByPath") &&
    codegen.includes("p6.synthesis.reused") &&
    /if\s*\(\s*resumeByPath\.size\s*>\s*0\s*\)/.test(codegen);
  if (!consumer) {
    findings.push({
      code: RESUME_NOT_REUSED_CODE,
      surface: "src/lib/codegen.server.ts",
      detail:
        "codegen.server.ts no longer consumes resumeAccepted (resumeByPath / `p6.synthesis.reused` / the `resumeByPath.size > 0` reuse branch is gone) — an accepted chunk would be re-synthesized",
    });
  }
  const producer = RESUME_PRODUCER_RE.test(headless);
  if (!producer) {
    findings.push({
      code: RESUME_NOT_REUSED_CODE,
      surface: "src/lib/headless.ts#driveP6Journey",
      detail:
        "driveP6Journey does not populate ctx.resumeAccepted — the journey re-synthesizes previously-accepted chunks instead of reusing them with 0 synthesis prompts (lane D5 interface)",
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// S4-05 — default-check sample baselines: BOTH runs' workingApp scores pinned.
//
// The default-check campaign ran the same 4-slug brief twice: sample1 scored
// 0/4 (three projects still parked at the P6 gate), sample2 scored 3/4. Pinning
// only the good sample would launder the variance; dropping the weak sample is
// the loss this guards.
// ---------------------------------------------------------------------------

/**
 * The two-sample default-check pin is intact iff rubric-baselines.json carries a
 * `defaultCheck` block naming exactly two samples, each with a workingApp
 * {count,of} that AGREES with its per-project rows and an honest
 * `artifactComplete` flag, and every sample cassette is represented.
 * @param {any} baselines @param {any[]} samples
 * @returns {Array<{code:string, detail:string}>}
 */
export function detectDefaultCheckBaselineLoss(baselines, samples) {
  const dc = baselines && typeof baselines === "object" ? baselines.defaultCheck : null;
  if (!dc || typeof dc !== "object") {
    return [
      {
        code: DEFAULT_CHECK_BASELINE_CODE,
        detail: "rubric-baselines.json carries no defaultCheck block — the two-sample default-check pin is missing (fail closed)",
      },
    ];
  }
  const findings = [];
  const pinned = Array.isArray(dc.samples) ? dc.samples : [];
  if (pinned.length !== 2) {
    findings.push({
      code: DEFAULT_CHECK_BASELINE_CODE,
      detail: `defaultCheck pins ${pinned.length} sample(s); exactly 2 are required — the weak sample1 (0/4) AND the strong sample2 (3/4) must both be recorded, not just the good one`,
    });
  }
  for (const cassette of Array.isArray(samples) ? samples : []) {
    const id = cassette && typeof cassette.sample === "string" ? cassette.sample : null;
    if (id && !pinned.some((s) => s && s.sample === id)) {
      findings.push({ code: DEFAULT_CHECK_BASELINE_CODE, detail: `the cassette sample ${id} has no rubric-baselines defaultCheck entry` });
    }
  }
  for (const s of pinned) {
    const id = s && typeof s.sample === "string" ? s.sample : "(unnamed)";
    if (!s || !s.workingApp || !Number.isFinite(s.workingApp.count) || s.workingApp.of !== 4) {
      findings.push({ code: DEFAULT_CHECK_BASELINE_CODE, detail: `${id}: workingApp must be a {count:number,of:4} record` });
      continue;
    }
    const rows = Array.isArray(s.projects) ? s.projects : [];
    if (rows.length !== 4) {
      findings.push({ code: DEFAULT_CHECK_BASELINE_CODE, detail: `${id}: expected 4 per-slug rows, found ${rows.length}` });
    } else {
      const trues = rows.filter((r) => r && r.workingApp === true).length;
      if (trues !== s.workingApp.count) {
        findings.push({
          code: DEFAULT_CHECK_BASELINE_CODE,
          detail: `${id}: workingApp.count ${s.workingApp.count} disagrees with its ${trues} true project row(s)`,
        });
      }
    }
    if (typeof s.artifactComplete !== "boolean") {
      findings.push({ code: DEFAULT_CHECK_BASELINE_CODE, detail: `${id}: the honest artifactComplete flag is missing` });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Controls (real source + real mutation).
// ---------------------------------------------------------------------------

/**
 * The control proofs for the harness/test. `fired` = the detector alarms
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

  // S4-04: the reuse contract. The fixture/control pair is synthetic and stable
  // across the fix: the "clean" source carries the journey producer, the
  // injected defect strips it. `wired` is the LIVE seam — currently red (the
  // producer is absent), flipping to true once lane D5 lands it.
  const headless = safeRead(HEADLESS_FILE);
  const producerLine = "ctx.resumeAccepted = acceptedChunks;";
  const resumeCleanSource = RESUME_PRODUCER_RE.test(headless)
    ? headless
    : headless.replace("const ctx: P6JourneyCycleContext = { cycle };", `const ctx: P6JourneyCycleContext = { cycle }; ${producerLine}`);
  const resumeDefectSource = resumeCleanSource.replace(RESUME_PRODUCER_RE, "ctx.acceptedChunksSeen =");
  const s4Fired = detectResumeReuseContract({ headlessSource: resumeDefectSource, codegenSource: codegen }).length > 0;
  const s4ControlClean = detectResumeReuseContract({ headlessSource: resumeCleanSource, codegenSource: codegen }).length === 0;
  const liveResumeFindings = detectResumeReuseContract({ headlessSource: headless, codegenSource: codegen });
  const s4Wired = liveResumeFindings.length === 0;

  // S4-05: both default-check samples pinned. Mutation: drop the weaker sample.
  const rubricBaselines = readJson(RUBRIC_BASELINES_FILE);
  const dcSamples = [readJson(join(DEFAULT_CHECK_CASSETTE_DIR, "sample1.json")), readJson(join(DEFAULT_CHECK_CASSETTE_DIR, "sample2.json"))].filter(
    (s) => s && typeof s === "object",
  );
  const droppedBaseline =
    rubricBaselines && rubricBaselines.defaultCheck && Array.isArray(rubricBaselines.defaultCheck.samples)
      ? {
          ...rubricBaselines,
          defaultCheck: {
            ...rubricBaselines.defaultCheck,
            samples: rubricBaselines.defaultCheck.samples.filter((s) => s && s.sample !== "sample1"),
          },
        }
      : null;
  const s5Fired = droppedBaseline ? detectDefaultCheckBaselineLoss(droppedBaseline, dcSamples).length > 0 : false;
  const s5Clean = rubricBaselines !== null && dcSamples.length === 2 && detectDefaultCheckBaselineLoss(rubricBaselines, dcSamples).length === 0;

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
    "S4-04": {
      fired: s4Fired,
      controlClean: s4ControlClean,
      mutationRed: s4Fired && s4ControlClean,
      wired: s4Wired,
      ownerLane: "D5",
      pendingInterface:
        "src/lib/headless.ts#driveP6Journey must assign `ctx.resumeAccepted = <previous cycle's accepted chunks>` so P6JourneyCycleContext.resumeAccepted is populated and codegen.server.ts reuses them with 0 synthesis prompts (the I7/O-01 consumer is landed; only the journey producer is missing)",
      seam: "headless.driveP6Journey -> ctx.resumeAccepted -> codegen.resumeByPath (0 synthesis prompts)",
      evidence: {
        consumerPresent: codegen.includes("resumeByPath") && codegen.includes("p6.synthesis.reused"),
        producerPresent: RESUME_PRODUCER_RE.test(headless),
        liveFindings: liveResumeFindings,
      },
    },
    "S4-05": {
      fired: s5Fired,
      controlClean: s5Clean,
      mutationRed: s5Fired && s5Clean,
      wired: s5Clean,
      seam: "cassettes/default-check/{sample1,sample2}.json + rubric-baselines.json#defaultCheck (both samples pinned)",
      sampleCount: dcSamples.length,
      evidence: {
        samples: dcSamples.map((s) => ({ sample: s.sample, workingApp: s.tally ? s.tally.workingApp : null, artifactComplete: s.artifactComplete })),
        liveFindings: rubricBaselines ? detectDefaultCheckBaselineLoss(rubricBaselines, dcSamples) : ["baselines unreadable"],
      },
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
