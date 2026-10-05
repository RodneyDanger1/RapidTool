// ---------------------------------------------------------------------------
// scripts/prevention/replay-harness.test.mjs — pins for the P-A evidence engine.
//
// Run: node --test --test-reporter=tap scripts/prevention/replay-harness.test.mjs
//
// These pins exercise the REAL seams and the REAL frozen artifacts. They import
// `inferDomain`/`deliveryKindOf`, `specSourceHasBehaviouralAssert`,
// `treeSubstanceOf`, `archTrace`/`archProductComplete` and read the emitted
// bytes — nothing here mocks the object under test. A skipped test is a guard
// that cannot fail, so the suite asserts `skipped === 0`.
// ---------------------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  resolveRunRoot,
  loadCassettes,
  loadHeldOutCassettes,
  loadGuardRegistry,
  scanDuplicateExports,
  scanEagerTdz,
  scanMoneySemantics,
  scanReadmeParity,
  countNumericEntities,
  withScratch,
  loadSeams,
  runAll,
  finalize,
} from "./replay-harness.mjs";

const RUN_ROOT = resolveRunRoot();
assert.ok(RUN_ROOT, "the frozen run root (testruns/) must be resolvable");

test("cassettes: seven real projects, thirteen emitted trees", () => {
  const cassettes = loadCassettes();
  assert.equal(cassettes.length, 7, "one cassette per historical project");
  const trees = cassettes.reduce((n, c) => n + c.trees.length, 0);
  assert.equal(trees, 13, "7 emitted + 6 emitted.v2 = 13 trees");
  for (const c of cassettes) {
    assert.ok(c.brief.length > 50, `${c.slug}: cassette carries the real brief text`);
    assert.ok(c.expected && c.expected.domain && c.expected.kind, `${c.slug}: carries the corrected label expectation`);
    assert.ok(Array.isArray(c.failureSignatures), `${c.slug}: carries normalised failure signatures`);
  }
});

test("C-12 real seam: inferDomain/deliveryKindOf resolve the corrected labels", async () => {
  const seams = await loadSeams();
  // The corrected contract as landed by lane C (C2): new web-marketing/mobile
  // registers replace the pre-fix real-estate/analytics/game/library labels.
  const expected = {
    "bakery-website": ["web-marketing", "app"],
    "flower-shop-website": ["web-marketing", "app"],
    "bakery-florist-orders": ["web-marketing", "app"],
    "mobile-companion": ["mobile", "app"],
    "office-stock-tracker": ["operations", "app"],
    "office-scheduler": ["custom-software", "app"],
    "office-invoice-tracker": ["finance-ops", "app"],
  };
  for (const [slug, [domain, kind]] of Object.entries(expected)) {
    const brief = readFileSync(join(RUN_ROOT, slug, "brief.md"), "utf8");
    assert.equal(seams.inferDomain(brief), domain, `${slug}: domain`);
    assert.equal(seams.deliveryKindOf({ brief, domain, lattice: {} }), kind, `${slug}: kind`);
  }
});

test("C-05 real seam: the office-invoice oracle spec is NOT behavioural (F-02)", async () => {
  const seams = await loadSeams();
  const spec = readFileSync(join(RUN_ROOT, "office-invoice-tracker", "emitted", "tests", "oracle.spec.ts"), "utf8");
  assert.equal(seams.specSourceHasBehaviouralAssert(spec), false, "a shape-only assert + skipped assert.fail must not count as behavioural");
  const control = 'import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { add } from "../src/impl.ts";\ntest("adds", () => { assert.equal(add(1, 1), 2); });\n';
  assert.equal(seams.specSourceHasBehaviouralAssert(control), true, "a module-read assertion is behavioural");
});

test("C-06 real seam: treeSubstanceOf reports the hollow trees as empty", async () => {
  const seams = await loadSeams();
  for (const slug of ["office-scheduler", "flower-shop-website"]) {
    for (const t of ["emitted", "emitted.v2"]) {
      const dir = join(RUN_ROOT, slug, t);
      if (!existsSync(dir)) continue;
      assert.equal(seams.treeSubstanceOf(dir, { green: true }).verdict, "empty", `${slug}/${t} is empty`);
    }
  }
  assert.equal(seams.treeSubstanceOf(join(RUN_ROOT, "bakery-website", "emitted"), { green: true }).verdict, "real", "the bakery job modules are real (control)");
});

test("C-14 real seam: archProductComplete fails closed on the 2-file historical tree", async () => {
  const dod = await import("../../src/lib/dod.ts");
  const proj = JSON.parse(readFileSync(join(RUN_ROOT, "office-stock-tracker", "emitted", ".rapidtool", "project.json"), "utf8").replace(/^\uFEFF/, ""));
  const at = dod.archTrace(proj);
  assert.equal(at.present, true, "a keyed synthesis was attempted");
  assert.deepEqual(at.missing.slice().sort(), ["approve", "scan", "show", "test"], "the historical tree is missing capabilities");
  assert.equal(dod.archProductComplete(at), false, "p6-arch must fail closed on the attempted keyed synthesis");
  assert.equal(dod.archProductComplete({ present: true, skipped: false, rows: [{ capability: "a", files: ["x"] }], missing: [], stubFiles: [], note: "" }), true, "a complete tree passes (control)");
});

test("C-02 scan: duplicate exported identifiers fire on bakery-florist-orders/emitted only", () => {
  const hits = scanDuplicateExports(join(RUN_ROOT, "bakery-florist-orders", "emitted"));
  assert.deepEqual(hits.map((h) => h.name).sort(), ["getDailyRevenueByCategory", "getTopSellingProducts", "getTotalWaste", "reconstructStockCount", "transitionOrderStatus"]);
  assert.equal(scanDuplicateExports(join(RUN_ROOT, "office-scheduler", "emitted")).length, 0, "control tree has no collision");
  assert.equal(withScratch({ "a.ts": "export const x = 1;\n", "b.ts": "export const y = 2;\n", "barrel.ts": 'export * from "./a.ts";\nexport * from "./b.ts";\n' }, (d) => scanDuplicateExports(d).length), 0, "control scratch is clean");
  assert.ok(withScratch({ "a.ts": "export const x = 1;\n", "b.ts": "export const x = 2;\n", "barrel.ts": 'export * from "./a.ts";\nexport * from "./b.ts";\n' }, (d) => scanDuplicateExports(d).length) > 0, "injected defect fires");
});

test("C-03 scan: eager use-before-declaration fires on mobile-companion/emitted", () => {
  const hits = scanEagerTdz(join(RUN_ROOT, "mobile-companion", "emitted"));
  assert.ok(hits.some((h) => h.name === "globalThisStore" && h.use === 69 && h.decl === 70), "globalThisStore L69 < L70 is detected");
  assert.equal(scanEagerTdz(join(RUN_ROOT, "bakery-florist-orders", "emitted")).length, 0, "a function-scope read is not a TDZ (control)");
});

test("C-13 scan: money-named quantity-only accumulator fires", () => {
  const hits = scanMoneySemantics(join(RUN_ROOT, "mobile-companion", "emitted"));
  assert.ok(hits.some((h) => h.name === "computeCartTotalPence"), "computeCartTotalPence is flagged");
  assert.equal(withScratch({ "m.ts": "/** total price in pence */\nexport function computeTotalPence(l: { quantity: number; pricePence: number }[]): number {\n  let t = 0;\n  for (const x of l) t = t + x.quantity * x.pricePence;\n  return t;\n}\n" }, (d) => scanMoneySemantics(d).length), 0, "a price-reading helper is clean (control)");
});

test("C-09 scan: README rows missing on disk fire on the eight historical non-parity trees", () => {
  let fired = 0;
  for (const slug of ["flower-shop-website", "office-scheduler", "office-stock-tracker", "office-invoice-tracker", "mobile-companion"]) {
    for (const t of ["emitted", "emitted.v2"]) {
      const dir = join(RUN_ROOT, slug, t);
      if (existsSync(dir) && scanReadmeParity(dir).length) fired += 1;
    }
  }
  // The registry's C-09 historicalFixtures lists all eight; PREVENTION.md's prose
  // said "7", which the frozen artifacts contradict.
  assert.equal(fired, 8, "exactly the eight historical non-parity trees fire");
  assert.equal(scanReadmeParity(join(RUN_ROOT, "bakery-florist-orders", "emitted")).length, 0, "control is clean");
});

test("C-17 scan: numeric HTML entities are present in the historical artifacts", () => {
  const n = countNumericEntities(join(RUN_ROOT, "bakery-website", "build.json"));
  assert.ok(n > 0, "the historical build.json carries leaked numeric entities");
  assert.equal(withScratch({ "build.json": '{"note":"tenant\'s"}' }, (d) => countNumericEntities(join(d, "build.json"))), 0, "clean JSON is not flagged (control)");
});

test("PR-25 held-out cassette + rubric baselines: present, disjoint, and complete", async () => {
  const held = loadHeldOutCassettes();
  assert.equal(held.length, 1, "one held-out brief cassette");
  assert.ok(held[0].brief.length > 50, "the held-out brief carries real text (not a fixture noun list)");
  assert.deepEqual(held[0].trees, [], "the held-out brief has no historical tree (it is future replay)");
  const verdict = await runAll({ runRoot: RUN_ROOT, cassettes: loadCassettes(), registry: loadGuardRegistry() });
  assert.equal(verdict.heldOut.ok, true, "the held-out cassette is structurally valid");
  assert.equal(verdict.heldOut.disjoint, true, "the held-out brief is NOT one of the seven fixtures (R-08)");
  assert.equal(verdict.rubricBaselines.ok, true, "each of the 13 trees carries a pinned rubric baseline");
  assert.equal(verdict.rubricBaselines.covered, 13, "13 baselines pinned");
  assert.deepEqual(verdict.rubricBaselines.missing, [], "no historical tree is missing a baseline");
});

test("single command: the two signals are reported and the gate of record is exact", async () => {
  const registry = loadGuardRegistry();
  assert.equal(registry.present, true, "P-B's guard-registry.json is present");
  const verdict = finalize(await runAll({ runRoot: RUN_ROOT, cassettes: loadCassettes(), registry }));
  // `skipped` is DERIVED (an array), never the old hardcoded 0.
  assert.ok(Array.isArray(verdict.skipped), "skipped is a derived array");
  assert.deepEqual(verdict.skipped, [], "a skip is a hard failure");
  assert.equal(verdict.guards, registry.guards.length, "every registered guard is evaluated");
  assert.ok(verdict.count >= verdict.countFloor, `count ${verdict.count} must meet the pinned floor ${verdict.countFloor}`);
  assert.equal(verdict.countFloor, 24, "the guard-count floor is pinned at 24 (deleting a guard fails)");
  assert.equal(verdict.guards, 24, "24 guards: 15 W346 + 5 campaign1 + 4 campaign2 tourniquets");
  assert.deepEqual(verdict.controlMissed, [], "every fired guard has a clean control");
  // TWO orthogonal signals on every guard.
  for (const r of verdict.detail) {
    assert.ok(r.driver, `${r.id} has a historical driver (no orphan entry)`);
    assert.ok(r.fixtureIntegrity && typeof r.fixtureIntegrity.fired === "boolean", `${r.id}: fixture-integrity signal`);
    assert.ok(r.fixPresence && typeof r.fixPresence.present === "boolean" && typeof r.fixPresence.wired === "boolean", `${r.id}: fix-presence signal`);
  }
  // Every historical detector fires; the gate of record is RED because the
  // campaign-2 tourniquets' owners have not landed their fixes on the
  // gate-of-record surface. The pending list NAMES each red pin.
  assert.deepEqual(verdict.missed, [], "no fixture-integrity miss");
  assert.deepEqual([...verdict.pending].sort(), ["C1-02", "R2-01", "R2-03", "R2-05", "R2-06"], "the named pins left red pending their owners");
  for (const id of ["R2-01", "R2-03", "R2-05", "R2-06"]) {
    const r = verdict.detail.find((x) => x.id === id);
    assert.equal(r.fixtureIntegrity.fired, true, `${id} fires on the real campaign2 defect bytes`);
    assert.equal(r.fixPresence.present, false, `${id} fix is not yet on the gate-of-record surface (HEAD)`);
    assert.equal(r.fixPresence.mutationRed, true, `${id} retains a working mutation control`);
  }
  assert.equal(verdict.detail.find((r) => r.id === "C1-02").fixtureIntegrity.fired, true, "C1-02 fires on the campaign1 bytes (R2-02 guard re-pointed)");
  const c04 = verdict.detail.find((r) => r.id === "C-04");
  assert.equal(c04.fixtureIntegrity.fired, true, "the historical non-monotonic defect is visible");
  assert.equal(c04.fixPresence.present, true, "the live comparator seam is present (lane D PR-07)");
  assert.equal(c04.fixPresence.wired, true, "the comparator is wired");
  assert.equal(verdict.ok, false, "the gate of record is RED while any owner pin is pending (missed/pending/skipped/count semantics)");
});

test("fix-presence: a status:pending entry always fails the gate of record", async () => {
  // Forge a `pending` status on a guard whose live seam DOES pass: the harness
  // must still report it pending (a pending declaration is a hard failure).
  const registry = loadGuardRegistry();
  const forged = { ...registry, guards: registry.guards.map((g) => (g.id === "C-05" ? { ...g, status: "pending" } : g)) };
  const verdict = finalize(await runAll({ runRoot: RUN_ROOT, cassettes: loadCassettes(), registry: forged }));
  assert.ok(verdict.pending.includes("C-05"), "a status:pending entry fails even when its seam is wired");
  assert.equal(verdict.ok, false, "the gate of record is red while any pending entry remains");
});
