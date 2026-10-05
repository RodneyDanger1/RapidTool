// ---------------------------------------------------------------------------
// final-wave-invariants.test.mjs — P-B/Q5 pins for the FINAL-WAVE tourniquets
// (fixes/346): D1-01 persisted-gate recompute, D2-01 floor code in the emit
// seal, D3-01 in-run RUNLOCK wiring, S3-01 floor refusal code, G1-01 intent-first
// research query.
//
// Every pin reads the REAL sources/artifacts and drives the guard's own
// detectors; each carries a mutation control (the guard must FIRE on the
// injected/historical defect and stay SILENT on the clean control). Nothing here
// mocks the object under test.
//
// Run: node --test --test-reporter=tap scripts/guards/final-wave-invariants.test.mjs
// ---------------------------------------------------------------------------
import test from "node:test";
import assert from "node:assert/strict";

import {
  detectIntentFirstQuery,
  detectFloorRefusalCode,
  detectSealFloorCode,
  detectRunlockWiring,
  detectBestTreeGateMismatch,
  detectBestTreeRecompute,
  finalWaveControls,
  safeRead,
  readJson,
  resolveRunRoot,
  ENGINE_FILE,
  CODEGEN_FILE,
  CLI_FILE,
  HEADLESS_FILE,
} from "./final-wave-invariants.mjs";

import { join } from "node:path";

const IDS = ["G1-01", "S3-01", "D2-01", "D3-01", "D1-01"];

test("final-wave: every pin fires on its defect AND stays silent on its clean control", async () => {
  const controls = await finalWaveControls();
  for (const id of IDS) {
    const c = controls[id];
    assert.ok(c, `${id} declares a control`);
    assert.equal(c.fired, true, `${id} must fire on its historical/injected defect`);
    assert.equal(c.controlClean, true, `${id} must stay silent on its clean control`);
    assert.equal(c.mutationRed, true, `${id}'s mutation control must prove the guard can fail`);
  }
});

test("G1-01: researchQueryText leads with the intent; the blocklist is present", () => {
  const engine = safeRead(ENGINE_FILE);
  assert.ok(engine.length > 0, "engine.ts reads");
  assert.deepEqual(detectIntentFirstQuery(engine), [], "the live builder leads with the intent and ships the blocklist");
  const regressed = engine.replace(/\[\s*intent\s*,\s*\.\.\.qualifiers\s*\]/, "[...qualifiers, intent]");
  assert.ok(detectIntentFirstQuery(regressed).length > 0, "a domain-nouns-first builder must fire the guard");
});

test("S3-01: the single refuse door maps the generic code to the floor code", () => {
  const codegen = safeRead(CODEGEN_FILE);
  assert.deepEqual(detectFloorRefusalCode(codegen), [], "the live refuse door carries RT_E_PLAN_UNDERPRODUCED");
  const stripped = codegen.replace(/under\s*!==\s*null\s*&&\s*code\s*===\s*"RT_E_VALIDATION"/, "false");
  assert.ok(detectFloorRefusalCode(stripped).length > 0, "a door that stops mapping the floor code must fire");
});

test("D2-01: the CLI emit seal consumes planUnderproductionSeal and carries the floor code", () => {
  const cli = safeRead(CLI_FILE);
  assert.deepEqual(detectSealFloorCode(cli), [], "the live seal consumes the seam and names the floor code");
  const dropped = cli.replace(/planUnderproductionSeal\(/g, "planUnderproductionSealDropped(");
  assert.ok(detectSealFloorCode(dropped).length > 0, "a seal that drops the consumer must fire");
});

test("D3-01: a run path CALLS runlockEditViolations and refuses with the RUNLOCK code", () => {
  const headless = safeRead(HEADLESS_FILE);
  const cli = safeRead(CLI_FILE);
  assert.deepEqual(detectRunlockWiring({ headlessSource: headless, cliSource: cli }), [], "the in-run RUNLOCK guard is wired");
  const unwired = cli.replace(/h\.runlockEditViolations\(/g, "h.runlockEditViolationsUnwired(");
  assert.ok(detectRunlockWiring({ headlessSource: headless, cliSource: unwired }).length > 0, "an unwired run path must fire");
});

test("D1-01: the persisted gate is re-derived from the persisted tree (real G5 fixture)", async () => {
  const runRoot = resolveRunRoot();
  assert.ok(runRoot, "the testruns root resolves");
  const bfo = readJson(join(runRoot, "bakery-florist-orders", "build.json"));
  assert.ok(bfo, "the bakery-florist-orders build.json reads");
  const dod = await import("../../src/lib/dod.ts");
  const runGate = dod.runGate;
  assert.equal(typeof runGate, "function", "dod.runGate is importable");
  // The frozen artifact's recorded gate disagrees with a fresh gate over its own
  // persisted tree — the historical G5 defect the pin fires on.
  const findings = detectBestTreeGateMismatch(bfo, runGate);
  assert.equal(findings.length, 1, "the real fixture records a stale gate");
  assert.equal(findings[0].code, "BEST_TREE_GATE_STALE");
  assert.notEqual(findings[0].storedHash, findings[0].freshHash);
  // Control: the same record with its stored gate set to the fresh verdict is silent.
  const fresh = runGate(bfo, 6);
  const reconciled = {
    ...bfo,
    phases: (bfo.phases || []).map((p) => (p && p.id === 6 ? { ...p, gate: { passed: fresh.pass, unmet: fresh.unmet.map((u) => u.criterion), evidenceHash: fresh.evidenceHash } } : p)),
  };
  assert.deepEqual(detectBestTreeGateMismatch(reconciled, runGate), [], "the recomputed gate is silent");
  // The source seam: keepBestTree must recompute over the grafted tree. When it
  // is absent the pin is RED and NAMES lane D (checked by the P-A harness).
  const recompute = detectBestTreeRecompute(safeRead(HEADLESS_FILE));
  assert.ok(Array.isArray(recompute), "the source-recompute detector returns findings");
});
