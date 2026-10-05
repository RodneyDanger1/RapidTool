// ---------------------------------------------------------------------------
// enabling-wave-invariants.test.mjs — Q4 pins for the S4 enabling-wave guards
// (fixes/346): S4-01 default armed, S4-02 bounded resample, S4-03 refusal
// coverage.
//
// Every pin reads the REAL bytes it guards (`src/lib/synthesis-policy.ts`,
// `src/lib/codegen.server.ts`, the two re-pinned suites) and asserts the
// MUTATION control too — a guard that cannot fire on its injected defect and
// stay silent on the live source is not a guard.
//
// Run: node --test --test-reporter=tap scripts/guards/enabling-wave-invariants.test.mjs
// ---------------------------------------------------------------------------
import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  POLICY_FILE,
  CODEGEN_FILE,
  HEADLESS_FILE,
  REFUSAL_SUITE_FILE,
  POLICY_SUITE_FILE,
  REFUSAL_BASELINE_FILE,
  DEFAULT_CHECK_CASSETTE_DIR,
  RUBRIC_BASELINES_FILE,
  P6_SYNTH_CANDIDATES_CAP,
  safeRead,
  readJson,
  parseConstNumber,
  detectDefaultDisarmed,
  detectUnboundedResample,
  detectRefusalCoverageLoss,
  detectResumeReuseContract,
  detectDefaultCheckBaselineLoss,
  describeBlocks,
  enablingWaveControls,
  DEFAULT_DISARMED_CODE,
  UNBOUNDED_RESAMPLE_CODE,
  REFUSAL_COVERAGE_CODE,
  RESUME_NOT_REUSED_CODE,
  DEFAULT_CHECK_BASELINE_CODE,
} from "./enabling-wave-invariants.mjs";

const policy = safeRead(POLICY_FILE);
const codegen = safeRead(CODEGEN_FILE);
const headless = safeRead(HEADLESS_FILE);
const codegenSuite = safeRead(REFUSAL_SUITE_FILE);
const policySuite = safeRead(POLICY_SUITE_FILE);
const baseline = readJson(REFUSAL_BASELINE_FILE);
const rubricBaselines = readJson(RUBRIC_BASELINES_FILE);
const dcSamples = [readJson(join(DEFAULT_CHECK_CASSETTE_DIR, "sample1.json")), readJson(join(DEFAULT_CHECK_CASSETTE_DIR, "sample2.json"))].filter(
  (s) => s && typeof s === "object",
);

assert.ok(policy.length > 0, "the real synthesis-policy.ts loads");
assert.ok(codegen.length > 0, "the real codegen.server.ts loads");
assert.ok(headless.length > 0, "the real headless.ts loads");
assert.ok(codegenSuite.length > 0, "the real refusal suite loads");
assert.ok(policySuite.length > 0, "the real policy suite loads");
assert.ok(baseline && typeof baseline === "object", "the refusal-coverage baseline cassette loads");
assert.ok(rubricBaselines && typeof rubricBaselines === "object", "the rubric baselines load");
assert.equal(dcSamples.length, 2, "both default-check sample cassettes load");

test("S4-01 default armed: the armed chunk-resample default is > 1 and the resolver consumes it", () => {
  const armed = parseConstNumber(policy, "P6_SYNTH_CHUNK_RETRY_CANDIDATES");
  assert.equal(typeof armed, "number", "the armed constant is a numeric literal");
  assert.ok(armed !== null && armed > 1, `the armed chunk-resample default is ${armed} (> 1: the gain is on by default)`);
  assert.deepEqual(detectDefaultDisarmed(policy), [], "the live policy is armed — no finding");
  // Mutation: revert the armed constant to 1 (the disarmed default). The guard fires.
  const disarmed = policy.replace(/(export\s+const\s+P6_SYNTH_CHUNK_RETRY_CANDIDATES\s*=\s*)\d+/, "$11");
  const findings = detectDefaultDisarmed(disarmed);
  assert.equal(findings.length > 0, true, "a reverted default fires");
  assert.equal(findings[0].code, DEFAULT_DISARMED_CODE);
  assert.equal(findings[0].value, 1, "the finding names the disarmed value");
  // Mutation: a resolver that no longer falls back to the armed constant fires.
  const detached = policy.replace(/return P6_SYNTH_CHUNK_RETRY_CANDIDATES;/g, "return 1;");
  assert.equal(detectDefaultDisarmed(detached).length > 0, true, "a resolver detached from the armed constant fires");
});

test("S4-02 bounded resample: every loop bound is clamped to P6_SYNTH_CANDIDATES_MAX in [2,4]", () => {
  const max = parseConstNumber(policy, "P6_SYNTH_CANDIDATES_MAX");
  assert.equal(typeof max, "number", "the cap is a numeric literal");
  assert.ok(max !== null && max >= 2, `the cap is finite and >= 2 (${max})`);
  assert.ok(max !== null && max <= P6_SYNTH_CANDIDATES_CAP, `the cap is <= the documented cost bound ${P6_SYNTH_CANDIDATES_CAP} (${max})`);
  assert.deepEqual(detectUnboundedResample(policy, codegen), [], "the live resample loops are bounded — no finding");
  // Mutation: strip every `Math.min(P6_SYNTH_CANDIDATES_MAX, ` clamp.
  const unbounded = codegen.replace(/Math\.min\(\s*P6_SYNTH_CANDIDATES_MAX\s*,\s*/g, "(");
  const findings = detectUnboundedResample(policy, unbounded);
  assert.equal(findings.length > 0, true, "a removed bound fires");
  assert.equal(findings[0].code, UNBOUNDED_RESAMPLE_CODE);
  // Mutation: remove selectBestOfN's clamp (a policy-only unbounded retry) fires.
  const policyUnbounded = policy.replace(/Math\.min\(Math\.floor\(count\), P6_SYNTH_CANDIDATES_MAX\)/, "Math.floor(count)");
  assert.equal(detectUnboundedResample(policyUnbounded, codegen).length > 0, true, "a removed selectBestOfN clamp fires");
  // Mutation: raising the cap ABOVE the documented bound fires (an unbounded-cost regression).
  const overCap = policy.replace(/(export\s+const\s+P6_SYNTH_CANDIDATES_MAX\s*=\s*)\d+/, "$15");
  const capFindings = detectUnboundedResample(overCap, codegen);
  assert.equal(capFindings.length > 0, true, `a cap above ${P6_SYNTH_CANDIDATES_CAP} fires`);
  assert.equal(capFindings[0].code, UNBOUNDED_RESAMPLE_CODE);
});

test("S4-03 refusal coverage: each re-pinned suite keeps its genuine-refusal assertion", () => {
  assert.deepEqual(detectRefusalCoverageLoss({ codegenSuite, policySuite }, baseline), [], "the live re-pinned suites preserve refusal coverage");
  const totals = baseline.totals;
  const refused = (codegenSuite.match(/p6\.synthesis\.refused/g) || []).length;
  assert.ok(refused >= totals.refused, `the suite carries >= ${totals.refused} refusal assertions (HEAD 52 → live ${refused}); no re-pin weakened a refusal`);
  // Each pinned re-pinned suite still exists AND still carries a genuine refusal.
  const blocks = describeBlocks(codegenSuite);
  for (const suite of baseline.suites) {
    const block = blocks.find((b) => b.title.includes(suite.match));
    assert.ok(block, `the re-pinned refusal suite "${suite.match}" is still present`);
    const n = (block.body.match(/p6\.synthesis\.refused/g) || []).length;
    assert.ok(n >= suite.refusedAtLeast, `"${suite.match}" still carries ${n} genuine-refusal assertion(s)`);
  }
  // The armed "both candidates rejected" proof survives.
  assert.ok(codegenSuite.includes(baseline.armedMarker), `the armed rejection proof \`${baseline.armedMarker}\` survives`);
  assert.ok(policySuite.includes(baseline.policyArmedMarker), "the policy suite keeps its armed-default marker");
  assert.ok(policySuite.includes(baseline.policyOptOutMarker), "the policy suite keeps its explicit-opt-out marker");
  // Mutation: delete every genuine-refusal assertion. The guard fires.
  const weakened = codegenSuite.replace(/p6\.synthesis\.refused/g, "REMOVED_REFUSAL");
  const findings = detectRefusalCoverageLoss({ codegenSuite: weakened, policySuite }, baseline);
  assert.equal(findings.length > 0, true, "a weakened suite fires");
  assert.equal(findings[0].code, REFUSAL_COVERAGE_CODE);
  // Fail closed: a missing baseline is a finding, never a silent pass.
  assert.equal(detectRefusalCoverageLoss({ codegenSuite, policySuite }, null).length > 0, true, "a missing baseline fails closed");
});

test("S4-04 accepted-chunk reuse: the reuse contract is met iff the journey producer is present (D5 landed it)", () => {
  const producerPresent = /ctx\.resumeAccepted\s*=/.test(headless);
  const live = detectResumeReuseContract({ headlessSource: headless, codegenSource: codegen });
  // The contract is met IFF the journey producer is present — the invariant.
  assert.equal(live.length === 0, producerPresent, "the reuse contract is met iff driveP6Journey populates ctx.resumeAccepted");
  // The codegen consumer half is landed and must never be the finding.
  assert.ok(!live.some((f) => f.surface === "src/lib/codegen.server.ts"), "the codegen consumer half is landed (resumeByPath + p6.synthesis.reused)");
  // Lane D5 landed the producer: driveP6Journey threads the previous cycle's
  // accepted chunks. If that reverts, the finding NAMES the interface instead.
  assert.equal(producerPresent, true, "driveP6Journey populates ctx.resumeAccepted (lane D5 landed)");
  if (!producerPresent) {
    const finding = live.find((f) => f.surface === "src/lib/headless.ts#driveP6Journey");
    assert.ok(finding, "the missing journey producer is the finding (RED)");
    assert.equal(finding.code, RESUME_NOT_REUSED_CODE);
    assert.match(finding.detail, /resumeAccepted/, "the finding NAMES the interface");
  }
  // Mutation control: the live producer-bearing source is silent; removing EVERY
  // producer assignment fires.
  assert.equal(live.length, 0, "the live journey + codegen satisfy the contract (control)");
  const stripped = headless.replace(/ctx\.resumeAccepted\s*=/g, "ctx.__noResume =");
  const strippedFindings = detectResumeReuseContract({ headlessSource: stripped, codegenSource: codegen });
  assert.equal(strippedFindings.length > 0, true, "removing every journey producer assignment fires");
  assert.equal(strippedFindings[0].code, RESUME_NOT_REUSED_CODE);
  // A removed consumer also fires.
  assert.equal(
    detectResumeReuseContract({ headlessSource: headless, codegenSource: codegen.replace(/resumeByPath/g, "__absent__") }).length > 0,
    true,
    "a removed codegen consumer fires",
  );
});

test("S4-05 default-check baselines: both samples' workingApp scores are pinned (the variance is recorded)", () => {
  assert.equal(dcSamples.length, 2, "both default-check sample cassettes load");
  assert.deepEqual(detectDefaultCheckBaselineLoss(rubricBaselines, dcSamples), [], "the live baselines are complete");
  const s1 = dcSamples.find((s) => s.sample === "sample1");
  const s2 = dcSamples.find((s) => s.sample === "sample2");
  assert.equal(s1.tally.workingApp, 0, "sample1 is pinned at 0/4 (the weak run, kept on purpose)");
  assert.equal(s2.tally.workingApp, 3, "sample2 is pinned at 3/4");
  assert.notEqual(s1.tally.workingApp, s2.tally.workingApp, "the VARIANCE is real and recorded, not just the good sample");
  assert.equal(s1.artifactComplete, false, "sample1 is honestly flagged artifact-incomplete (no emitted/ tree on disk)");
  assert.equal(s2.artifactComplete, true, "sample2's emitted trees are on disk");
  // Mutation: drop the weaker sample1 entry -> fires.
  const dropped = {
    ...rubricBaselines,
    defaultCheck: { ...rubricBaselines.defaultCheck, samples: rubricBaselines.defaultCheck.samples.filter((s) => s.sample !== "sample1") },
  };
  const droppedFindings = detectDefaultCheckBaselineLoss(dropped, dcSamples);
  assert.equal(droppedFindings.length > 0, true, "dropping the weaker sample fires");
  assert.equal(droppedFindings[0].code, DEFAULT_CHECK_BASELINE_CODE);
  // Mutation: a workingApp.count that disagrees with its rows fires.
  const badCount = {
    ...rubricBaselines,
    defaultCheck: {
      ...rubricBaselines.defaultCheck,
      samples: rubricBaselines.defaultCheck.samples.map((s) => (s.sample === "sample2" ? { ...s, workingApp: { count: 4, of: 4 } } : s)),
    },
  };
  assert.ok(detectDefaultCheckBaselineLoss(badCount, dcSamples).length > 0, "a count/row disagreement fires");
  // Fail closed: a missing block is a finding, never a silent pass.
  assert.equal(detectDefaultCheckBaselineLoss({}, dcSamples).length > 0, true, "a missing defaultCheck block fails closed");
});

test("enabling-wave controls: every guard fires on its mutation AND stays silent on its clean control", async () => {
  const controls = await enablingWaveControls();
  for (const id of ["S4-01", "S4-02", "S4-03", "S4-04", "S4-05"]) {
    const c = controls[id];
    assert.ok(c, `${id} declares a control`);
    assert.equal(c.fired, true, `${id} fires on its injected defect/mutation`);
    assert.equal(c.controlClean, true, `${id} stays silent on the clean control`);
    assert.equal(c.mutationRed, true, `${id} retains a working mutation control (the guard can fail)`);
    assert.equal(c.wired, true, `${id} live seam is armed/bounded/covered/reused/pinned`);
  }
  // S4-04 names the interface it guards (owner lane D5; landed, so now wired).
  const c4 = controls["S4-04"];
  assert.equal(c4.ownerLane, "D5", "S4-04 names its owning lane");
  assert.match(String(c4.pendingInterface), /resumeAccepted/, "S4-04 names the interface");
});
