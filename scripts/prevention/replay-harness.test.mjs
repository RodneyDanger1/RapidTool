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
  loadGuardFloor,
  scanDuplicateExports,
  scanEagerTdz,
  scanMoneySemantics,
  scanReadmeParity,
  countNumericEntities,
  withScratch,
  loadSeams,
  runAll,
  finalize,
  evaluateCanaries,
  validateCanary,
  KEY_FIELD_CANARIES,
  synthesisRowCount,
  withoutSynthesisRows,
  projectFixture,
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

test("C-14 seam control: the keyless floor is genuinely keyless, so mutationRed is reachable", async () => {
  const dod = await import("../../src/lib/dod.ts");
  const item = dod.DOD[6].find((c) => c.id === "p6-arch");
  assert.ok(item, "the real p6-arch criterion must exist");
  assert.equal(typeof item.probe, "function", "the p6-arch criterion must carry a probe");
  const base = JSON.parse(readFileSync(join(RUN_ROOT, "office-stock-tracker", "build.json"), "utf8").replace(/^\uFEFF/, ""));
  // The fixture's OWN logs carry the keyed attempt (the reason `{...base,
  // generatedTree: []}` returned false and C-14 could never leave `pending`).
  assert.ok(synthesisRowCount(base) > 0, `the real fixture carries ${synthesisRowCount(base)} p6.synthesis.* rows`);
  const keyless = projectFixture({ ...withoutSynthesisRows(base), generatedTree: [] });
  assert.equal(synthesisRowCount(keyless), 0, "the derived control carries ZERO keyed-synthesis rows");
  assert.equal(item.probe(keyless), true, "the keyless floor still passes (the legacy single-module branch)");
  assert.equal(item.probe({ ...keyless, logs: [...keyless.logs, { event: "p6.synthesis.refused" }] }), false, "a keyed refusal with no tree fails closed (mutation control)");
  const verdict = finalize(await runAll({ runRoot: RUN_ROOT, cassettes: loadCassettes(), registry: loadGuardRegistry() }));
  const c14 = verdict.detail.find((r) => r.id === "C-14");
  assert.equal(c14.fixPresence.present, true, "the p6-arch probe seam is present");
  assert.equal(c14.fixPresence.wired, true, "the fail-closed sentinel is refused");
  assert.equal(c14.fixPresence.mutationRed, true, "the keyless-floor control flips the check, so C-14 is provable");
  assert.equal(c14.fixPresence.evidence.controlSynthesisRows, 0, "the control the harness uses is the keyless floor");
  assert.ok(c14.fixPresence.evidence.fixtureSynthesisRows > 0, "the sentinel is built from the real (keyed) fixture");
  assert.ok(!verdict.pending.includes("C-14"), "C-14 leaves the pending set");
});

test("canary: a guard's key field disappearing or being reshaped fails LOUDLY with a coded envelope", async () => {
  const seams = await loadSeams();
  const real = (dir, opts) => seams.treeSubstanceOf(dir, opts);
  const trees = loadCassettes().flatMap((c) => c.trees.map((t) => ({ slug: c.slug, tree: t, dir: join(RUN_ROOT, c.slug, t) })));

  // 1. The live seam satisfies every declared key-field contract.
  const live = await evaluateCanaries({ trees });
  assert.deepEqual(live.violations, [], "every declared key field is intact on the real seam");
  assert.deepEqual(live.checked.sort(), ["C-06", "C-14"], "both declared canaries are checked");

  // 2. PLANTED SHAPE CHANGE: the field C-06 keys on is renamed away. Before the
  //    canary the driver simply reported `fired:false` (a rename-away disarming);
  //    now the harness must fail with the coded envelope and name the field.
  const renamed = { ...seams, treeSubstanceOf: (dir, opts) => { const r = real(dir, opts); const { jobScoped: _omitted, ...rest } = r; return rest; } };
  const planted = finalize(await runAll({ runRoot: RUN_ROOT, cassettes: loadCassettes(), registry: loadGuardRegistry(), seams: renamed }));
  assert.equal(planted.ok, false, "a renamed key field must NOT read as a green harness");
  assert.ok(planted.missed.includes("<canary:C-06:RT_E_VALIDATION>"), `the coded envelope must be in missed: ${JSON.stringify(planted.missed)}`);
  assert.equal(planted.canaries.ok, false, "the canaries signal is red");
  const violation = planted.canaries.violations.find((v) => v.guard === "C-06");
  assert.equal(violation.code, "RT_E_VALIDATION", "the violation carries a registered RT_E_* code");
  assert.equal(violation.field, "jobScoped.verdict", "the violation names the field that vanished");
  assert.equal(violation.problem, "key-field-missing", "the problem class is named");
  // ...and the guard still FIRED on the historical trees it can still read, i.e.
  // the failure is attributable to the field, not to a fixture change.
  assert.equal(planted.detail.find((r) => r.id === "C-06").fixtureIntegrity.fired, false, "the disarmed reading is visible as fired:false");

  // 3. PLANTED RE-POINT: the documented top-level alias returns to the WHOLE-tree
  //    census (the A2-F3 defect). The guard's key field still resolves, so only the
  //    alias contract catches it - which is why it is declared, not assumed.
  const repointed = { ...seams, treeSubstanceOf: (dir, opts) => { const r = real(dir, opts); return { ...r, verdict: r.wholeTree.verdict }; } };
  const aliasVerdict = await evaluateCanaries({ trees, seams: repointed });
  assert.deepEqual(aliasVerdict.violations.map((v) => v.problem), ["key-field-alias-repointed"], "the re-pointed alias is caught");
  assert.match(aliasVerdict.violations[0].actual, /verdict=mixed != jobScoped\.verdict=empty/, "the violation names both readings");

  // 4. The pure validator is the unit under test: a reshaped domain and a missing
  //    required shape flag are both violations, never a silent pass.
  const entry = KEY_FIELD_CANARIES.find((e) => e.id === "C-06");
  assert.equal(validateCanary(entry, { jobScoped: { verdict: "empty" }, verdict: "empty" }), null, "an intact reading passes");
  assert.equal(validateCanary(entry, { jobScoped: { verdict: "hollow" }, verdict: "hollow" }).problem, "key-field-reshaped", "an out-of-domain value is caught");
  assert.equal(validateCanary(entry, null).problem, "key-reading-unavailable", "an unavailable reading is caught");
  const c14 = KEY_FIELD_CANARIES.find((e) => e.id === "C-14");
  assert.equal(validateCanary(c14, { phase6IsArray: true, itemFound: false, probe: "function" }).problem, "key-reading-shape-changed:itemFound", "a reshaped DOD registry is caught");
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
  assert.equal(verdict.countFloor, 34, "the guard-count floor is pinned at 34 (deleting a guard fails)");
  assert.equal(verdict.guards, 34, "34 guards: 15 W346 + 5 campaign1 + 4 campaign2 tourniquets + 5 S4 pins (S4-01..S4-05) + 5 finish-wave pins (D1-01/D2-01/D3-01/S3-01/G1-01)");
  assert.deepEqual(verdict.controlMissed, [], "every fired guard has a clean control");
  // TWO orthogonal signals on every guard.
  for (const r of verdict.detail) {
    assert.ok(r.driver, `${r.id} has a historical driver (no orphan entry)`);
    assert.ok(r.fixtureIntegrity && typeof r.fixtureIntegrity.fired === "boolean", `${r.id}: fixture-integrity signal`);
    assert.ok(r.fixPresence && typeof r.fixPresence.present === "boolean" && typeof r.fixPresence.wired === "boolean", `${r.id}: fix-presence signal`);
  }
  // Every historical detector fires AND every live seam is wired: the gate of
  // record is green, and the classification is EXACTLY disjoint + total.
  assert.deepEqual(verdict.missed, [], "no fixture-integrity miss");
  // A finish-wave pin may be RED (pending) until its owner's interface reaches
  // the gate-of-record surface; ONLY these named owners may linger.
  const RED_PENDING_OWNERS = { "D1-01": "D" };
  assert.deepEqual(verdict.pending.filter((id) => !(id in RED_PENDING_OWNERS)), [], "only the named RED pins may be pending (lane D must commit keepBestTree's recompute)");
  for (const id of verdict.pending) {
    const r = verdict.detail.find((x) => x.id === id);
    assert.match(JSON.stringify(r.fixPresence.evidence), new RegExp(RED_PENDING_OWNERS[id]), `${id} names its pending owner lane`);
    assert.match(JSON.stringify(r.fixPresence.evidence), /workingTreeHasInterface/, `${id} reports the working-tree interface state`);
  }
  assert.deepEqual(verdict.skipped, [], "no skip");
  const inv = verdict.fixPresenceInvariant;
  assert.ok(inv, "the verdict carries the fix-presence classification invariant");
  assert.equal(inv.ok, true, "the classification is disjoint + total");
  assert.deepEqual(inv.overlap, [], "no guard is both enforced and pending");
  assert.deepEqual(inv.uncovered, [], "no guard is in neither set");
  assert.deepEqual(inv.unknown, [], "no unknown id is classified");
  const allIds = verdict.detail.map((r) => r.id).sort();
  assert.deepEqual([...verdict.fixPresence.enforced, ...verdict.fixPresence.pending].sort(), allIds, "enforced ∪ pending == guards");
  assert.deepEqual([...verdict.fixPresence.pending].sort(), Object.keys(RED_PENDING_OWNERS).filter((id) => verdict.pending.includes(id)).sort(), "pending is exactly the named RED pins");
  assert.equal(new Set([...verdict.fixPresence.enforced, ...verdict.fixPresence.pending]).size, allIds.length, "union is exact (no duplicates)");
  // Both orthogonal signals fire for the five campaign-2 pins and the five
  // S4 final-wave pins (default armed / bounded resample / refusal coverage /
  // accepted-chunk reuse / default-check baselines), and for the four
  // finish-wave pins whose owners have committed their interface.
  for (const id of ["C1-02", "R2-01", "R2-03", "R2-05", "R2-06", "S4-01", "S4-02", "S4-03", "S4-04", "S4-05", "G1-01", "S3-01", "D2-01", "D3-01"]) {
    const r = verdict.detail.find((x) => x.id === id);
    assert.equal(r.fixtureIntegrity.fired, true, `${id} fires on its historical defect bytes`);
    assert.equal(r.fixPresence.present, true, `${id} fix is on the gate-of-record surface`);
    assert.equal(r.fixPresence.wired, true, `${id} seam is wired`);
    assert.equal(r.fixPresence.mutationRed, true, `${id} retains a working mutation control`);
  }
  // S4-04 names the resumeAccepted interface it guards (lane D5).
  const s404 = verdict.detail.find((r) => r.id === "S4-04");
  assert.equal(s404.fixtureIntegrity.controlClean, true, "S4-04 stays silent on the producer-bearing control");
  assert.match(JSON.stringify(s404.fixPresence.evidence), /resumeAccepted/, "S4-04 names the resumeAccepted interface");
  const c04 = verdict.detail.find((r) => r.id === "C-04");
  assert.equal(c04.fixtureIntegrity.fired, true, "the historical non-monotonic defect is visible");
  assert.equal(c04.fixPresence.present, true, "the live comparator seam is present (lane D PR-07)");
  assert.equal(c04.fixPresence.wired, true, "the comparator is wired");
  // D1-01 is the one RED pin while lane D's keepBestTree recompute is not yet on
  // the gate-of-record surface; it names its owner and reports the working-tree
  // state, and the gate of record is green exactly once every RED pin flips.
  const d101 = verdict.detail.find((r) => r.id === "D1-01");
  assert.equal(d101.fixtureIntegrity.fired, true, "D1-01 fires on the real G5 fixture (stale persisted gate)");
  assert.equal(d101.fixPresence.mutationRed, true, "D1-01 retains a working mutation control");
  assert.match(JSON.stringify(d101.fixPresence.evidence), /"ownerLane":"D"/, "D1-01 names its pending owner lane D");
  assert.equal(verdict.ok, verdict.pending.length === 0, "the gate of record is green iff every RED pin has flipped (missed/skipped/count/classification already pinned)");
});

test("fix-presence classification: disjoint + total, and `ok` is FALSE on any pending or inconsistent set", () => {
  const results = [{ id: "A" }, { id: "B" }];
  const base = { guards: 2, count: 2, countFloor: 2, missed: [], controlMissed: [], skipped: [], detail: results, pending: [] };
  // Consistent + fully enforced → green.
  const green = finalize({ ...base, fixPresence: { enforced: ["A", "B"] } });
  assert.equal(green.ok, true, "a consistent, fully-enforced set is green");
  assert.equal(green.fixPresenceInvariant.ok, true, "invariant holds");
  // Any pending guard → red.
  const pendingAny = finalize({ ...base, fixPresence: { enforced: ["A"] }, pending: ["B"] });
  assert.equal(pendingAny.ok, false, "any pending guard fails the gate of record");
  // An id in BOTH sets → red (the exact defect this lane exists to prevent).
  const overlap = finalize({ ...base, fixPresence: { enforced: ["A", "B"] }, pending: ["A"] });
  assert.equal(overlap.ok, false, "an id in both enforced and pending fails");
  assert.equal(overlap.fixPresenceInvariant.ok, false, "the overlap is detected");
  assert.deepEqual(overlap.fixPresenceInvariant.overlap, ["A"], "the overlapping id is named");
  assert.ok(overlap.missed.includes("<fix-presence-classification>"), "the inconsistency is folded into missed");
  // An id in NEITHER set → red (a silently-dropped guard).
  const uncovered = finalize({ ...base, fixPresence: { enforced: ["A"] } });
  assert.equal(uncovered.ok, false, "an unclassified guard fails closed");
  assert.deepEqual(uncovered.fixPresenceInvariant.uncovered, ["B"], "the uncovered id is named");
  assert.ok(uncovered.missed.includes("<fix-presence-classification>"), "the uncovered guard is named");
});

test("guard-count floor: pinned OUTSIDE the mutable registry, so deleting a guard AND lowering the registry floor still fails", async () => {
  // The reviewed floor is a cassettes/ fixture, independent of guard-registry.json.
  const floor = loadGuardFloor();
  assert.equal(floor.present, true, "the reviewed guard-floor.json is present");
  assert.equal(floor.countFloor, 34, "the pinned floor is 34");
  assert.equal(floor.guardIds.length, 34, "the pinned guard-id set names all 34 guards");
  // The hole this closes: dropping a guard id and lowering the registry's own
  // countFloor in one edit used to pass (the floor rode the mutable registry).
  const registry = loadGuardRegistry();
  const forged = { ...registry, countFloor: 1, guards: registry.guards.filter((g) => g.id !== "C-01") };
  const verdict = finalize(await runAll({ runRoot: RUN_ROOT, cassettes: loadCassettes(), registry: forged }));
  assert.equal(verdict.ok, false, "deleting a guard + lowering the registry floor must still be red");
  assert.ok(verdict.countFloor >= 34, `the effective floor stays pinned (${verdict.countFloor})`);
  assert.ok(verdict.floorViolations.some((v) => v.startsWith("registry-count-floor-lowered")), "the lowered registry floor is named");
  assert.ok(verdict.floorViolations.includes("guard-id-missing:C-01"), "the deleted guard id is named");
  assert.ok(verdict.missed.some((m) => m.startsWith("<floor:")), "the floor violation is folded into missed");
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
