// ---------------------------------------------------------------------------
// campaign2-invariants.test.mjs — P-B/Q3 pins for the CAMPAIGN #2 residual
// tourniquet guards (R2-01/03/05/06).
//
// Every pin reads the REAL frozen campaign #2 artifacts (the `campaign2`
// cassette copy of the real bytes, else `../testruns/campaign2`) and the REAL
// seams (`minimumTreeFileCount`, `specRowCensus`); nothing here mocks the
// object under test. Each guard's mutation control is asserted too — a guard
// that cannot fire on its defect and stay silent on an injected clean control
// is not a guard.
//
// These guards are HEALTHY (fixture-integrity green). Their OWNERS' fixes are
// not in the gate-of-record surface yet, so the P-A harness reports their
// fix-presence as pending (RED) until the fixers land — see the guard-registry
// `status:"pending"` and the harness `SEAM_CHECKS`.
//
// Run: node --test --test-reporter=tap scripts/guards/campaign2-invariants.test.mjs
// ---------------------------------------------------------------------------
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  campaign2Controls,
  detectJsxInTs,
  detectVerifiedCommit,
  resolveCampaign2Root,
  scanCampaign2,
  REPO_ROOT,
} from "./campaign2-invariants.mjs";
import { listCampaignSlugs, loadCampaignSeams, detectFloorReachability, detectSkipVacuity, campaignTreeDir, CAMPAIGN_CASSETTE_DIR } from "./campaign-invariants.mjs";

const ROOT = resolveCampaign2Root();
assert.ok(ROOT, "the campaign2 root (cassette copy or live testruns/campaign2) must resolve");

const SLUGS = listCampaignSlugs(ROOT);
const { minimumTreeFileCount } = await loadCampaignSeams();
assert.equal(typeof minimumTreeFileCount, "function", "the real minimumTreeFileCount seam loads");

const treeDir = (slug) => {
  const dir = campaignTreeDir(ROOT, slug);
  assert.ok(dir, `${slug}: emitted tree resolves (live or materialized cassette)`);
  return dir;
};
const slugDir = (slug) => join(ROOT, slug);
const firedSlugs = (detector) => SLUGS.filter((s) => detector(s).length > 0).sort();

const BELOW_FLOOR = ["bakery-florist-orders", "bakery-website", "held-out-community-tool-library", "mobile-companion", "office-invoice-tracker", "office-stock-tracker"];
const AT_FLOOR = ["flower-shop-website", "office-scheduler"];

test("R2-01 floor seal: fires on the 6 campaign2 trees sealed below the floor lacking the code", () => {
  const fired = firedSlugs((s) => detectFloorReachability(slugDir(s), treeDir(s), minimumTreeFileCount));
  assert.deepEqual(fired, BELOW_FLOOR, "every below-floor campaign2 seal lacks RT_E_PLAN_UNDERPRODUCED");
  for (const s of AT_FLOOR) {
    assert.equal(detectFloorReachability(slugDir(s), treeDir(s), minimumTreeFileCount).length, 0, `${s} reaches the floor`);
  }
  const finding = detectFloorReachability(slugDir("bakery-website"), treeDir("bakery-website"), minimumTreeFileCount)[0];
  assert.equal(finding.code, "RT_E_PLAN_UNDERPRODUCED");
  assert.equal(finding.floor, 8);
  assert.equal(finding.emitted, 3);
});

test("R2-03 JSX-in-.ts: fires on campaign2/bakery-website's validate-order-form.ts only", () => {
  const fired = firedSlugs((s) => detectJsxInTs(treeDir(s), s));
  assert.deepEqual(fired, ["bakery-website"], "only bakery-website emits a .ts module carrying JSX");
  const finding = detectJsxInTs(treeDir("bakery-website"), "bakery-website")[0];
  assert.equal(finding.code, "RT_E_JSX_IN_TS");
  assert.equal(finding.file, "src/generated/validate-order-form.ts");
  // The two P12 trees pass their own tsc — their .ts surface is JSX-free.
  for (const s of AT_FLOOR) {
    assert.equal(detectJsxInTs(treeDir(s), s).length, 0, `${s} is JSX-free in .ts`);
  }
});

test("R2-05 skip vacuity: fires on the 6 skip-dominated campaign2 oracles", () => {
  const fired = firedSlugs((s) => detectSkipVacuity(treeDir(s), s));
  assert.deepEqual(fired, BELOW_FLOOR, "the six hollow/bridge oracles are skip-dominated");
  for (const s of AT_FLOOR) {
    assert.equal(detectSkipVacuity(treeDir(s), s).length, 0, `${s} has a live-dense oracle`);
  }
});

test("R2-06 verified product: fires on a committed record with NO verification block; silent on the honest block", () => {
  // The real historical fixture: campaign #1's committed envelopes carry no block.
  const c1 = ["flower-shop-website", "bakery-florist-orders", "mobile-companion"];
  const fired = c1.filter((s) => detectVerifiedCommit(join(CAMPAIGN_CASSETTE_DIR, s)).length > 0).sort();
  assert.deepEqual(fired, ["bakery-florist-orders", "flower-shop-website", "mobile-companion"], "campaign1 committed records carry no verification block");
  const finding = detectVerifiedCommit(join(CAMPAIGN_CASSETTE_DIR, "flower-shop-website"))[0];
  assert.equal(finding.code, "RT_E_VERIFIED_PRODUCT_UNEVIDENCED");
  assert.match(finding.reason, /without a verification block/);
  // The designed campaign #2 shape — block present, verifiedProduct:false with the
  // honest "entry not executed" reason — IS the conjunction and stays silent.
  for (const s of ["flower-shop-website", "office-scheduler"]) {
    assert.equal(detectVerifiedCommit(slugDir(s)).length, 0, `${s} carries a complete block whose verifiedProduct equals its evidence conjunction`);
  }
  for (const s of BELOW_FLOOR) {
    assert.equal(detectVerifiedCommit(slugDir(s)).length, 0, `${s} was withheld, so it claims nothing`);
  }
});

test("campaign2 scan: the three generation detectors fire; R2-06's fixture lives in campaign1", async () => {
  const result = await scanCampaign2(ROOT);
  assert.deepEqual(result.counts, { seal: 6, jsx: 1, skip: 6, verify: 0 });
  assert.equal(result.ok, false, "a campaign2 with open generation residuals is not clean");
});

test("campaign2 guards: every detector fires on its real defect AND its mutation control stays silent", async () => {
  const controls = await campaign2Controls(ROOT);
  for (const id of ["R2-01", "R2-03", "R2-05", "R2-06"]) {
    const c = controls[id];
    assert.ok(c, `${id} declares a control`);
    assert.equal(c.fired, true, `${id} must fire on the real campaign2 artifact`);
    assert.equal(c.controlClean, true, `${id} must stay silent on its clean control`);
    assert.equal(c.mutationRed, true, `${id} must be silenced by its injected clean mutation (the guard can fail)`);
  }
});

test("rubric baselines: the 8 campaign2 scores are pinned and workingApp is honest", () => {
  const j = JSON.parse(readFileSync(join(REPO_ROOT, "scripts", "prevention", "cassettes", "rubric-baselines.json"), "utf8"));
  const cb = j.campaign2;
  assert.ok(cb, "rubric-baselines.json carries the campaign2 section");
  assert.equal(cb.treeCount, 8);
  assert.equal(cb.baselines.length, 8);
  const bySlug = new Map(cb.baselines.map((b) => [b.slug, b]));
  for (const s of SLUGS) assert.ok(bySlug.has(s), `${s} has a pinned campaign2 baseline`);
  assert.equal(bySlug.get("flower-shop-website").score, 4);
  assert.equal(bySlug.get("office-scheduler").workingApp, true);
  assert.equal(bySlug.get("office-stock-tracker").workingApp, false);
  const working = cb.baselines.filter((b) => b.workingApp === true).map((b) => b.slug).sort();
  assert.deepEqual(working, ["flower-shop-website", "office-scheduler"], "workingApp is true on exactly the two P12 trees");
});
