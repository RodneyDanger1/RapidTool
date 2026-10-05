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

import {
  POLICY_FILE,
  CODEGEN_FILE,
  REFUSAL_SUITE_FILE,
  POLICY_SUITE_FILE,
  REFUSAL_BASELINE_FILE,
  safeRead,
  readJson,
  parseConstNumber,
  detectDefaultDisarmed,
  detectUnboundedResample,
  detectRefusalCoverageLoss,
  describeBlocks,
  enablingWaveControls,
  DEFAULT_DISARMED_CODE,
  UNBOUNDED_RESAMPLE_CODE,
  REFUSAL_COVERAGE_CODE,
} from "./enabling-wave-invariants.mjs";

const policy = safeRead(POLICY_FILE);
const codegen = safeRead(CODEGEN_FILE);
const codegenSuite = safeRead(REFUSAL_SUITE_FILE);
const policySuite = safeRead(POLICY_SUITE_FILE);
const baseline = readJson(REFUSAL_BASELINE_FILE);

assert.ok(policy.length > 0, "the real synthesis-policy.ts loads");
assert.ok(codegen.length > 0, "the real codegen.server.ts loads");
assert.ok(codegenSuite.length > 0, "the real refusal suite loads");
assert.ok(policySuite.length > 0, "the real policy suite loads");
assert.ok(baseline && typeof baseline === "object", "the refusal-coverage baseline cassette loads");

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

test("S4-02 bounded resample: every loop bound is clamped to P6_SYNTH_CANDIDATES_MAX", () => {
  const max = parseConstNumber(policy, "P6_SYNTH_CANDIDATES_MAX");
  assert.equal(typeof max, "number", "the cap is a numeric literal");
  assert.ok(max !== null && max >= 2, `the cap is finite and >= 2 (${max})`);
  assert.deepEqual(detectUnboundedResample(policy, codegen), [], "the live resample loops are bounded — no finding");
  // Mutation: strip every `Math.min(P6_SYNTH_CANDIDATES_MAX, ` clamp.
  const unbounded = codegen.replace(/Math\.min\(\s*P6_SYNTH_CANDIDATES_MAX\s*,\s*/g, "(");
  const findings = detectUnboundedResample(policy, unbounded);
  assert.equal(findings.length > 0, true, "a removed bound fires");
  assert.equal(findings[0].code, UNBOUNDED_RESAMPLE_CODE);
  // Mutation: remove selectBestOfN's clamp (a policy-only unbounded retry) fires.
  const policyUnbounded = policy.replace(/Math\.min\(Math\.floor\(count\), P6_SYNTH_CANDIDATES_MAX\)/, "Math.floor(count)");
  assert.equal(detectUnboundedResample(policyUnbounded, codegen).length > 0, true, "a removed selectBestOfN clamp fires");
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

test("enabling-wave controls: every guard fires on its mutation AND stays silent on the live source", async () => {
  const controls = await enablingWaveControls();
  for (const id of ["S4-01", "S4-02", "S4-03"]) {
    const c = controls[id];
    assert.ok(c, `${id} declares a control`);
    assert.equal(c.fired, true, `${id} fires on its injected defect/mutation`);
    assert.equal(c.controlClean, true, `${id} stays silent on the live source`);
    assert.equal(c.mutationRed, true, `${id} retains a working mutation control (the guard can fail)`);
    assert.equal(c.wired, true, `${id} live seam is armed/bounded/covered`);
  }
});
