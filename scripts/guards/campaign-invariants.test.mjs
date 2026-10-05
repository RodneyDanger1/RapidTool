// ---------------------------------------------------------------------------
// campaign-invariants.test.mjs — P-B/Q2 pins for the campaign #1 residual
// guards (PR-28): C1-01 floor reachability, C1-02 UI wiring, C1-05 skip
// vacuity, C1-06 unverified claim, C1-08 withheld git-code consistency.
//
// Every pin reads the REAL frozen campaign artifacts (the `campaign1` cassette
// copy of the real bytes, else `../testruns/campaign1`) and the REAL seams
// (`minimumTreeFileCount`, `treeSubstanceOf`); nothing here mocks the object
// under test. Each guard's mutation control is asserted too — a guard that
// cannot fire on its defect and stay silent on an injected clean control is not
// a guard.
//
// Run: node --test --test-reporter=tap scripts/guards/campaign-invariants.test.mjs
// ---------------------------------------------------------------------------
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveCampaignRoot,
  listCampaignSlugs,
  detectFloorReachability,
  detectUiWiring,
  detectSkipVacuity,
  detectUnverifiedClaim,
  detectGitCodeInconsistency,
  campaignControls,
  campaignTreeDir,
  loadCampaignSeams,
} from "./campaign-invariants.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CAMPAIGN = resolveCampaignRoot();
assert.ok(CAMPAIGN, "the campaign root (cassette copy or live testruns/campaign1) must resolve");

const SLUGS = listCampaignSlugs(CAMPAIGN);
const { minimumTreeFileCount, realGeneratedExportWiring } = await loadCampaignSeams();
assert.equal(typeof minimumTreeFileCount, "function", "the real minimumTreeFileCount seam loads");
// R2-02: the UI detector consumes the ONE product seam. It has not landed yet
// (lane D), so the assertion below is conditional and the pin stays RED.
const UI_SEAM = "headless.realGeneratedExportWiring";

const treeDir = (slug) => {
  const dir = campaignTreeDir(CAMPAIGN, slug);
  assert.ok(dir, `${slug}: emitted tree resolves (live or materialized cassette)`);
  return dir;
};
const slugDir = (slug) => join(CAMPAIGN, slug);
const firedSlugs = (detector) => SLUGS.filter((s) => detector(s).length > 0).sort();

test("C1-01 floor reachability: fires on the real below-floor sealed trees, silent at the floor", () => {
  const fired = firedSlugs((s) => detectFloorReachability(slugDir(s), treeDir(s), minimumTreeFileCount));
  assert.deepEqual(
    fired,
    ["bakery-florist-orders", "bakery-website", "held-out-community-tool-library", "office-invoice-tracker", "office-scheduler", "office-stock-tracker"],
    "six campaign trees sealed below the real floor of 8 must carry RT_E_PLAN_UNDERPRODUCED",
  );
  // flower-shop (9) and mobile (9) reach the floor: the clean controls.
  for (const s of ["flower-shop-website", "mobile-companion"]) {
    assert.equal(detectFloorReachability(slugDir(s), treeDir(s), minimumTreeFileCount).length, 0, `${s} reaches the floor`);
  }
  const finding = detectFloorReachability(slugDir("office-stock-tracker"), treeDir("office-stock-tracker"), minimumTreeFileCount)[0];
  assert.equal(finding.code, "RT_E_PLAN_UNDERPRODUCED");
  assert.equal(finding.floor, 8);
  assert.equal(finding.emitted, 2);
  assert.deepEqual(finding.sealCodes.sort(), ["RT_E_SUBSTANCE_EMPTY", "RT_E_TREE_RUN_FAILED"], "the seal codes are generic — the floor code is absent");
});

test("C1-02 UI wiring (R2-02): the detector CONSUMES the one product seam", () => {
  if (typeof realGeneratedExportWiring === "function") {
    // R2-02: the guard's verdict must equal the product seam's verdict for every
    // tree — the two can no longer disagree.
    for (const s of SLUGS) {
      const dir = treeDir(s);
      const seam = realGeneratedExportWiring(dir);
      const fired = detectUiWiring(dir, realGeneratedExportWiring, s);
      assert.equal(fired.length > 0, seam.wired === false, `${s}: the guard fires iff the product seam reads unwired`);
      if (fired.length > 0) assert.equal(fired[0].seam, UI_SEAM, `${s}: the finding names the canonical seam`);
    }
    const wiredSlugs = SLUGS.filter((s) => realGeneratedExportWiring(treeDir(s)).wired === true);
    assert.deepEqual(wiredSlugs, ["office-invoice-tracker"], "the canonical seam reads exactly one campaign1 tree wired");
  } else {
    // D's predicate is absent (e.g. the gate-of-record surface): fail closed and name it.
    const fired = firedSlugs((s) => detectUiWiring(treeDir(s), realGeneratedExportWiring, s));
    assert.deepEqual(fired, SLUGS.slice().sort(), "seam absent: the guard fires on every declared UI");
    const finding = detectUiWiring(treeDir("office-invoice-tracker"), realGeneratedExportWiring, "office-invoice-tracker")[0];
    assert.equal(finding.seam, UI_SEAM, "the pin names the canonical interface it needs (R2-02)");
  }
});

test("C1-05 skip vacuity: fires on the 6 skip-dominated oracles, silent on the live-dense ones", () => {
  const fired = firedSlugs((s) => detectSkipVacuity(treeDir(s), s));
  assert.deepEqual(
    fired,
    ["bakery-florist-orders", "bakery-website", "held-out-community-tool-library", "office-invoice-tracker", "office-scheduler", "office-stock-tracker"],
    "the hollow/bridge oracles are 78-90% SKIP",
  );
  for (const s of ["flower-shop-website", "mobile-companion"]) {
    assert.equal(detectSkipVacuity(treeDir(s), s).length, 0, `${s} has a live-dense oracle`);
  }
  const finding = detectSkipVacuity(treeDir("office-scheduler"), "office-scheduler")[0];
  assert.equal(finding.code, "RT_E_SPEC_SKIP_VACUOUS");
  assert.equal(finding.skipped, 9);
  assert.equal(finding.live, 1);
});

test("C1-06 verified claim: fires on the real-substance commits, silent on the withheld envelopes", () => {
  const fired = firedSlugs((s) => detectUnverifiedClaim(slugDir(s), treeDir(s)));
  assert.deepEqual(fired, ["bakery-florist-orders", "flower-shop-website", "mobile-companion"], "the three landed commits state no UI wiring and no unverified flag");
  // The five withheld trees make no product claim (git.committed:false).
  for (const s of ["bakery-website", "office-invoice-tracker", "office-scheduler", "office-stock-tracker", "held-out-community-tool-library"]) {
    assert.equal(detectUnverifiedClaim(slugDir(s), treeDir(s)).length, 0, `${s} was withheld, so it claims nothing`);
  }
  const finding = detectUnverifiedClaim(slugDir("flower-shop-website"), treeDir("flower-shop-website"))[0];
  assert.equal(finding.code, "RT_E_CLAIM_UNVERIFIED");
  assert.equal(finding.readmeWarns, true, "the emitted README still warns DECLARED SCRIPTS NOT RUN");
});

test("C1-08 withheld git code: fires on the frozen inconsistent envelopes, silent on committed ones", () => {
  const fired = firedSlugs((s) => detectGitCodeInconsistency(slugDir(s)));
  assert.deepEqual(
    fired,
    ["bakery-website", "held-out-community-tool-library", "office-invoice-tracker", "office-scheduler", "office-stock-tracker"],
    "five withheld envelopes carry git.code RT_E_TREE_RUN_FAILED beside a different top-level code",
  );
  const finding = detectGitCodeInconsistency(slugDir("office-stock-tracker"))[0];
  assert.equal(finding.reason, "substance-empty");
  assert.equal(finding.gitCode, "RT_E_TREE_RUN_FAILED");
  assert.equal(finding.topCode, "RT_E_SUBSTANCE_EMPTY");
  // Committed envelopes carry no git.code: clean controls.
  for (const s of ["flower-shop-website", "bakery-florist-orders", "mobile-companion"]) {
    assert.equal(detectGitCodeInconsistency(slugDir(s)).length, 0, `${s} committed, so its git envelope has no withheld code`);
  }
});

test("campaign guards: every detector fires on its real defect AND its mutation control stays silent", async () => {
  const controls = await campaignControls(CAMPAIGN);
  for (const id of ["C1-01", "C1-02", "C1-05", "C1-06", "C1-08"]) {
    const c = controls[id];
    assert.ok(c, `${id} declares a control`);
    assert.equal(c.fired, true, `${id} must fire on the real campaign artifact`);
    assert.equal(c.controlClean, true, `${id} must stay silent on its clean control`);
    if (id === "C1-02" && c.wired === false) {
      // R2-02: the canonical seam is absent, so the mutation control cannot run
      // yet — the pin is RED and must NAME the interface (checked in the harness).
      assert.equal(c.seamPending, UI_SEAM, "C1-02 names the pending realGeneratedExportWiring seam");
      continue;
    }
    assert.equal(c.mutationRed, true, `${id} must be silenced by its injected clean mutation (the guard can fail)`);
  }
  // C1-08's live seam is the CLI's withheld-envelope builder naming the deciding code.
  assert.equal(controls["C1-08"].wired, true, "scripts/rapidtool-cli.mjs sets payload.git.code = withheld.code");
});

test("rubric baselines: the 8 campaign scores are pinned", () => {
  const j = JSON.parse(readFileSync(join(ROOT, "scripts", "prevention", "cassettes", "rubric-baselines.json"), "utf8"));
  const cb = j.campaign1;
  assert.ok(cb, "rubric-baselines.json carries the campaign1 section");
  assert.equal(cb.treeCount, 8);
  assert.equal(cb.baselines.length, 8);
  const bySlug = new Map(cb.baselines.map((b) => [b.slug, b.score]));
  for (const s of SLUGS) assert.ok(bySlug.has(s), `${s} has a pinned campaign baseline`);
  assert.equal(bySlug.get("office-invoice-tracker"), 2);
  assert.equal(bySlug.get("held-out-community-tool-library"), 0);
  for (const b of cb.baselines) assert.equal(b.workingApp, false, `${b.slug}: workingApp stays false (no mounted real generated export)`);
});
