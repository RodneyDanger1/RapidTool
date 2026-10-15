// ---------------------------------------------------------------------------
// repair-monotonic.test.mjs — P-B pin for C-04 (typecheck-before-accept +
// monotonic repair + no-progress abort).
//
// INC-18 / INC-30: `bakery-florist-orders` repair ran 3/3 cycles, introduced
// duplicate exports, and left the tree WORSE; accepted chunks were re-bought
// each cycle. The fix (lane D, PR-07 / PR-12, consuming lane A's offenderClass/
// TreePlanCensus interface I2) keeps only a strictly-better candidate and aborts
// on a repeated failure signature.
//
// This pin reads the REAL captured repair.json, then exercises the REAL exported
// comparator (`headless.treeVerdictScore` / `headless.failureSignature`, over the
// real `BestTreeMetric {ok,ts,files}` shape) AND asserts the abort is WIRED into
// `driveP6Journey` — not merely that the symbols exist. TODAY the comparator is
// not exported, so the pin is RED and names the pending lane D interface. It
// never edits headless.ts.
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import * as headless from "../../src/lib/headless.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
// B1-F1: the run root is the TRACKED in-repo fixture subset (`<repo>/testruns`),
// so this suite is green on a clean checkout; `RAPIDTOOL_TESTRUNS` still
// overrides for a host that keeps a larger run root elsewhere.
const TESTRUNS = process.env.RAPIDTOOL_TESTRUNS || join(ROOT, "testruns");
// Tolerate a UTF-8 BOM: the captured artifacts are rewritten by parallel runs
// and a BOM is not a JSON token.
const repair = JSON.parse(readFileSync(join(TESTRUNS, "bakery-florist-orders", "repair.json"), "utf8").replace(/^\uFEFF/, ""));

test("C-04 historical artifact: the captured repair is a worsening 3/3 failure", () => {
  assert.equal(repair.ok, false, "the captured repair failed");
  assert.equal(repair.code, "RT_E_REPAIR_FAILED", "the historical code");
  assert.equal(repair.cycles, repair.budget, "the budget was exhausted (3/3)");
  assert.match(String(repair.treeTail ?? ""), /TS2308|has already been declared/, "the tree tail carries the duplicate-export defect the repair introduced");
});

test("C-04 the comparator ranks the real BestTreeMetric {ok,ts,files}", () => {
  const score = /** @type {any} */ (headless).treeVerdictScore;
  assert.equal(typeof score, "function", "headless.treeVerdictScore(outcome, files?) must be exported (lane D PR-07).");
  // The contract over the real metric shape: cover-before-errors.
  const green = { ok: true, ts: 0, files: 2 };
  const redSmall = { ok: false, ts: 0, files: 2 };
  const redWorse = { ok: false, ts: 9, files: 2 };
  assert.ok(score(green) > score(redSmall), "a green tree must rank strictly above a red one");
  assert.ok(score(redSmall) >= score(redWorse), "more compiler diagnostics must never rank higher");
});

test("C-04 driveP6Journey ABORTS on a repeated failure signature (not merely symbols)", async () => {
  const sig = /** @type {any} */ (headless).failureSignature;
  const drive = /** @type {any} */ (headless).driveP6Journey;
  assert.equal(typeof sig, "function", "headless.failureSignature(cycle) must be exported (lane D PR-07).");
  assert.equal(typeof drive, "function", "headless.driveP6Journey must be exported so the abort is behavioural (lane D PR-12).");
  // The signature is stable for the same (refusal, tail, offender set) and moves
  // for a different offender set.
  const cycle = { refusal: "RT_E_GATE_PENDING", treeTail: "TS2308: duplicate export", offenderFiles: ["src/generated.ts"] };
  assert.equal(sig(cycle), sig({ ...cycle }), "the signature is stable for the same input");
  assert.notEqual(sig(cycle), sig({ ...cycle, offenderFiles: ["src/jobs/format.ts"] }), "a different offender set changes the signature");

  // Drive the REAL journey with injected deps that reproduce the SAME failure
  // every cycle (the historical bfo shape). It must abort on cycle 2 — never
  // spending budget 3 — with the no-progress event.
  const base = { id: "c04-fixture", name: "C-04 fixture", phases: [], generatedTree: [], logs: [] };
  const withTree = (p) => ({ ...p, generatedTree: [{ path: "src/generated/a.ts", source: "export const a = 1;\n" }] });
  const redOutcome = {
    ok: false,
    dir: "",
    compile: { ok: false, dir: "", checked: 1, passed: 0, failed: 1, skipped: 0, verdicts: [] },
    tests: [],
    run: null,
    error: "src/generated/a.ts(1,1): error TS2308: Module './a.ts' has already exported a member named 'a'",
  };
  const result = await drive(base, {
    budget: 3,
    deps: { synthesize: async (p) => withTree(p), runTree: async () => redOutcome, recordGate: (p) => p },
  });
  assert.equal(result.outcome, "failed", "the journey fails honestly");
  assert.equal(result.cycles, 2, "the repeat-signature abort fires on cycle 2, leaving budget unspent");
  assert.ok(result.events.some((e) => /no progress/i.test(e)), "the abort names the reproduced failure signature");
});
