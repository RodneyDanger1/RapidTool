/**
 * fixes/144 (M6, lane D4) — maker-score.test.ts: unit tests for the pure
 * M1..M9 rubric. Fixtures are INLINE hand-built projects (the corpus dir is
 * D3's parallel contract and is never read here — the runner reads it at
 * runtime). Every criterion's 0/1 boundary is covered.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  scoreMaker,
  m1Substance,
  m2Runs,
  m3Iterates,
  m4MachineVerifiable,
  m5Honest,
  m6Handover,
  m7Learning,
  m8Bounded,
  m9OnTime,
  capabilityCoverage,
  treeFilesOf,
  treeRunLooksSkipped,
  treeRunToMakerEvidence,
  FLOOR_QUALIFIER_EVIDENCE,
  KEYLESS_FLOOR_QUALIFIER_EVIDENCE,
  p6BriefFitPasses,
  runKindOf,
  barForRunKind,
  criteriaMeanExcluding,
  meetsRunKindBar,
  firstRunBarIsAdmissible,
  FIRST_RUN_UNSCOREABLE_CRITERIA,
  FIRST_RUN_BAR_MEAN_ATLEAST,
  type MakerBarWhen,
  type MakerScoreInput,
  type MakerScoreCard,
} from "./maker-score.ts";
import { fixtureAcceptanceState } from "./fixtures.ts";
// W55 · 341-5: the engine's own pre-acceptance bar, for a live parity check
// against p6BriefFitPasses (the comment claims "verbatim"; this proves it).
import { briefFitSatisfied } from "./codegen.server.ts";
import type { Project } from "./types.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";

// ---------------------------------------------------------------------------
// Hand-built fixture helpers (deterministic; no fs, no clock, no key).
// ---------------------------------------------------------------------------

const BRIEF = "A property ledger with invoice tracking for landlords.";

/** Minimal Project shape — the rubric only reads brief/phases/logs/lastTest/
 *  generatedSource/generatedTree, so fixtures stay small and hand-built. */
function project(over: Record<string, unknown> = {}): Project {
  return {
    brief: BRIEF,
    status: "complete",
    phases: [],
    logs: [],
    lastTest: null,
    generatedSource: "",
    ...over,
  } as unknown as Project;
}

function phase(id: number, gate?: { passed: boolean; unmet?: string[]; evidenceHash?: string }) {
  return {
    id,
    status: gate ? "complete" : "running",
    ...(gate
      ? { gate: { passed: gate.passed, unmet: gate.unmet ?? [], evidenceHash: gate.evidenceHash ?? "abc12345", checkedAt: 1 } }
      : {}),
  };
}

const LEDGER_SRC = `export class LedgerService {
  invoicesTotal(): number { return 0; }
}`;

function input(over: Partial<MakerScoreInput> = {}): MakerScoreInput {
  return {
    project: project(),
    corpus: { kind: "library", expectedCapabilities: [] },
    ...over,
  };
}

function card(over: Partial<MakerScoreInput> = {}): MakerScoreCard {
  return scoreMaker(input(over));
}

const treeFile = (path: string, source: string) => ({ path, source, hash: "h", attempt: 0 });

// ---------------------------------------------------------------------------
// M1 substance.
// ---------------------------------------------------------------------------

describe("M1 substance", () => {
  test("tree with every expectedCapability mapped to a file scores 1", () => {
    const p = project({
      generatedTree: [
        treeFile("src/ledger.ts", "export function ledgerTotals() {}"),
        treeFile("src/invoice.ts", "export function invoiceScan() {}"),
      ],
    });
    const c = m1Substance(input({ project: p, corpus: { expectedCapabilities: ["ledger", "invoice"] } }));
    assert.equal(c.score, 1);
    assert.match(c.evidence, /reqTrace: ledger->/);
  });

  test("tree missing one expectedCapability scores 0 and names it", () => {
    const p = project({ generatedTree: [treeFile("src/ledger.ts", "export function ledgerTotals() {}")] });
    const c = m1Substance(input({ project: p, corpus: { expectedCapabilities: ["ledger", "invoice"] } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /missing: invoice/);
  });

  test("multi-file tree with no expectedCapabilities demanded passes vacuously", () => {
    const p = project({ generatedTree: [treeFile("src/a.ts", "export const a = 1;"), treeFile("src/b.ts", "export const b = 2;")] });
    const c = m1Substance(input({ project: p, corpus: { expectedCapabilities: [] } }));
    assert.equal(c.score, 1);
  });

  test("tree mode is strict: a brief-fit single module does not rescue a tree that misses a capability", () => {
    const p = project({
      generatedSource: LEDGER_SRC,
      generatedTree: [treeFile("src/ledger.ts", "export function ledgerTotals() {}")],
    });
    const c = m1Substance(input({ project: p, corpus: { kind: "library", expectedCapabilities: ["ledger", "invoice"] } }));
    assert.equal(c.score, 0);
  });

  test("single-module library kind whose generatedSource passes p6-brief-fit scores 1", () => {
    const p = project({ brief: "Ledger invoices", generatedSource: LEDGER_SRC });
    const c = m1Substance(input({ project: p, corpus: { kind: "library", expectedCapabilities: [] } }));
    assert.equal(c.score, 1);
    assert.match(c.evidence, /p6-brief-fit/);
  });

  test("single-module library kind whose source carries no brief vocabulary scores 0", () => {
    const p = project({ generatedSource: "export function genericThing() { return 42; }" });
    const c = m1Substance(input({ project: p, corpus: { kind: "library" } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /fails p6-brief-fit/);
  });

  // -------------------------------------------------------------------------
  // 339-3 (W53): M1's single-module bar IS the engine's p6-brief-fit bar —
  // dod.ts's probe and codegen.server.ts briefFitSatisfied both use
  // max(1, ceil(required × 0.35)) (322 X1 recalibrated ½ → 0.35). Pre-fix the
  // rubric used a stale 0.5 half-bar while its comment claimed "verbatim"
  // parity, so a 0.35–0.49-coverage module passed the engine's pre-acceptance
  // check but scored M1 "fails p6-brief-fit". One bar, one story.
  // -------------------------------------------------------------------------
  test("single-module bar is the shared p6-brief-fit 0.35 bar — ceil(20×0.35)=7, six hits fail / seven pass", () => {
    const nouns =
      "aurora basalt cipher dune ember fjord glade harbor isle juniper kestrel lagoon mesa nimbus orchid peak quarry ridge summit tundra".split(" ");
    const brief = nouns.join(" ");
    const src = (k: number) => nouns.slice(0, k).map((n) => `const ${n} = 0;`).join("\n");
    // Boundary is the SAME one codegen.server.test.ts pins for briefFitSatisfied.
    assert.equal(p6BriefFitPasses(brief, src(7)), true, "seven hits meet the 0.35 bar");
    assert.equal(p6BriefFitPasses(brief, src(6)), false, "six hits are one short of the 0.35 bar");
    const one = { project: project({ brief, generatedSource: src(7) }), corpus: { kind: "library", expectedCapabilities: [] } };
    const zero = { project: project({ brief, generatedSource: src(6) }), corpus: { kind: "library", expectedCapabilities: [] } };
    assert.equal(m1Substance(input(one)).score, 1, "7/20 nouns pass M1 (the stale 0.5 bar would have failed it)");
    assert.equal(card(one).criteria.M1.score, 1, "the scorecard tells the same story as the engine");
    assert.equal(m1Substance(input(zero)).score, 0, "6/20 nouns is one short and scores 0");
  });

  test("single-module webapp kind never passes the single-module bar (not a library kind)", () => {
    const p = project({ generatedSource: LEDGER_SRC });
    const c = m1Substance(input({ project: p, corpus: { kind: "webapp" } }));
    assert.equal(c.score, 0);
  });

  test("absent corpus kind blocks the single-module pass (conservative)", () => {
    const p = project({ generatedSource: LEDGER_SRC });
    const c = m1Substance(input({ project: p, corpus: { expectedCapabilities: [] } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /corpus kind absent/);
  });

  test("empty project (no tree, no source) scores 0", () => {
    assert.equal(m1Substance(input()).score, 0);
  });

  test("TODO(E-15) stub tree cannot score substance (not product-complete)", () => {
    const stub = `export function runAlpha(input: unknown): { ok: boolean } {
  void input;
  throw new Error("TODO(E-15) stub: implement job alpha");
}`;
    const p = project({ generatedTree: [treeFile("src/jobs/alpha.ts", stub)] });
    const c = m1Substance(input({ project: p, corpus: { expectedCapabilities: ["alpha"] } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /stubs\/reexports/);
  });

  test("reexport-only leftover job cannot cover a capability", () => {
    const p = project({
      generatedTree: [
        treeFile("src/jobs/alpha.ts", 'export { runCore as runAlpha } from "./core.ts";\n'),
        treeFile("src/core.ts", "export function runCore() { return 1; }"),
      ],
    });
    const cov = capabilityCoverage(p, ["alpha"]);
    assert.deepEqual(cov.missing, ["alpha"], "reexport-only file does not cover alpha");
    const c = m1Substance(input({ project: p, corpus: { expectedCapabilities: ["alpha"] } }));
    assert.equal(c.score, 0);
  });

  test("all-stub tree with no expectedCapabilities still scores 0 (vacuous is not product-complete)", () => {
    const stub = 'export { x } from "./host.ts";\n';
    const p = project({ generatedTree: [treeFile("src/jobs/leftover.ts", stub)] });
    const c = m1Substance(input({ project: p, corpus: { expectedCapabilities: [] } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /stubs\/reexports/);
  });
});

// ---------------------------------------------------------------------------
// capabilityCoverage (fixes/147 E3 — the M1 divergence-1 report input).
// ---------------------------------------------------------------------------

describe("capabilityCoverage", () => {
  const tree = () => [
    treeFile("src/ledger.ts", "export function ledgerTotals() { return 0; }"),
    treeFile("src/invoice.ts", "export function invoiceScan(id: string) {}"),
    treeFile("src/payroll.ts", "export const weeklyPayroll = [];"),
  ];

  test("every capability covered maps label -> its hit file paths", () => {
    const cov = capabilityCoverage(project({ generatedTree: tree() }), ["ledger", "invoice"]);
    assert.deepEqual(Object.keys(cov.covered).sort(), ["invoice", "ledger"]);
    assert.equal(cov.covered.ledger.length, 1);
    assert.match(cov.covered.ledger[0], /ledger\.ts$/);
    assert.equal(cov.missing.length, 0);
  });

  test("an uncovered capability lands in missing and NOT in covered", () => {
    const cov = capabilityCoverage(project({ generatedTree: tree() }), ["ledger", "showing"]);
    assert.equal(cov.covered.ledger.length, 1);
    assert.equal(cov.missing.length, 1);
    assert.equal(cov.missing[0], "showing");
    assert.equal(cov.covered.showing, undefined);
  });

  test("stem forms match (capability phrase tokens stem like the rubric's)", () => {
    // "Rent roll with payment records" must hit a rentRoll/pay identifier via
    // token + canonical stem, mirroring m1Substance's formsForCapability.
    const p = project({
      generatedTree: [treeFile("src/rent.ts", "export function recordRentPayment() {}")],
    });
    const cov = capabilityCoverage(p, ["rent roll with payment records"]);
    assert.equal(cov.missing.length, 0);
    assert.equal(cov.covered["rent roll with payment records"].length, 1);
  });

  test("path hits count (identifier in the file path)", () => {
    const p = project({ generatedTree: [treeFile("src/tenant.ts", "export const x = 1;")] });
    const cov = capabilityCoverage(p, ["tenant"]);
    assert.equal(cov.missing.length, 0);
  });

  test("no tree files -> every capability missing (the M1=0 divergence-1 shape)", () => {
    const cov = capabilityCoverage(project(), ["ledger", "invoice"]);
    assert.deepEqual(cov.covered, {});
    assert.deepEqual(cov.missing, ["ledger", "invoice"]);
  });

  test("no capabilities demanded -> nothing missing, nothing covered", () => {
    const cov = capabilityCoverage(project({ generatedTree: tree() }), []);
    assert.deepEqual(cov.covered, {});
    assert.deepEqual(cov.missing, []);
  });

  test("215c: capability function words are NOT match forms (stopword leak closed)", () => {
    // Before 215c this junk module "covered" real-estate capabilities purely
    // because `and` is a substring of `handleStandardNotice` and `per` of
    // `property` — a fake-green M1. Function-word tokens must not be forms.
    const junk = [
      "function handleStandardNotice(x) { return x; }",
      "function gatherOtherInformation(y) { return y; }",
      "function beforeAfter(z) { return z; }",
    ].join("\n");
    const p = project({ generatedTree: [treeFile("src/generated.ts", junk)] });
    const cap =
      "One shared Property Ledger record per property (ownership, address, status, full history) across brokerage, flipping, rentals, and field services";
    const cov = capabilityCoverage(p, [cap]);
    assert.deepEqual(Object.keys(cov.covered), [], "junk module must cover nothing");
    assert.deepEqual(cov.missing, [cap]);
  });

  test("215c: real substance vocabulary still covers (stoplist does not over-strip)", () => {
    const p = project({
      generatedTree: [treeFile("src/ledger.ts", "function recordPropertyOwnership(propertyId) {}")],
    });
    const cov = capabilityCoverage(p, [
      "One shared Property Ledger record per property (ownership, address, status, full history)",
    ]);
    assert.equal(cov.missing.length, 0);
    assert.equal(cov.covered[Object.keys(cov.covered)[0]].length, 1);
  });

  test("coverage verdict agrees with m1Substance score 0/1 (no drift)", () => {
    const p = project({ generatedTree: tree() });
    const all = capabilityCoverage(p, ["ledger", "invoice"]);
    const one = capabilityCoverage(p, ["ledger", "showing"]);
    assert.equal(m1Substance(input({ project: p, corpus: { expectedCapabilities: ["ledger", "invoice"] } })).score, 1);
    assert.equal(all.missing.length, 0);
    assert.equal(m1Substance(input({ project: p, corpus: { expectedCapabilities: ["ledger", "showing"] } })).score, 0);
    assert.deepEqual(one.missing, ["showing"]);
  });

  test("treeFilesOf skips tree entries without real source", () => {
    const p = project({
      generatedTree: [
        treeFile("src/a.ts", "export const a = 1;"),
        { path: "src/empty.ts", source: "", hash: "h", attempt: 0 },
        { path: "src/b.ts", source: "export const b = 2;", hash: "h", attempt: 0 },
      ],
    });
    const files = treeFilesOf(p);
    assert.equal(files.length, 2);
    assert.deepEqual(files.map((f) => f.path), ["src/a.ts", "src/b.ts"]);
  });
});

// ---------------------------------------------------------------------------
// M2 runs.
// ---------------------------------------------------------------------------

describe("M2 runs", () => {
  test("precomputed treeRun ok scores 1", () => {
    const c = m2Runs(input({ treeRun: { ok: true, dir: "research/eval-out/x", testsPass: 4, testsFail: 0 } }));
    assert.equal(c.score, 1);
  });

  test("red treeRun scores 0 with the failure tail in evidence", () => {
    const c = m2Runs(input({ treeRun: { ok: false, dir: "d", detail: "AssertionError: expected 1 to equal 2" } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /AssertionError/);
  });

  test("absent treeRun verdict scores 0 (never assume a run)", () => {
    assert.equal(m2Runs(input({ treeRun: null })).score, 0);
  });

  test("A4: behavioral pass re-keys M1=M2=1 naming the count; fail names the id", () => {
    const pass = input({
      treeRun: { ok: true, dir: "d", testsPass: 3, testsFail: 0 },
      behavioral: { pass: 3, fail: 0 },
    });
    assert.equal(m1Substance(pass).score, 1);
    assert.match(m1Substance(pass).evidence, /behavioral pass 3/);
    assert.equal(m2Runs(pass).score, 1);
    const fail = input({
      treeRun: { ok: true, dir: "d", testsPass: 2, testsFail: 1 },
      behavioral: { pass: 2, fail: 1, failedIds: ["orc-1"] },
    });
    assert.equal(m1Substance(fail).score, 0);
    assert.match(m1Substance(fail).evidence, /orc-1/);
    assert.equal(m2Runs(fail).score, 0);
  });

  test("A4: absent behavioral keeps legacy M2 (byte-identical path)", () => {
    const c = m2Runs(input({ treeRun: { ok: true, dir: "research/eval-out/x", testsPass: 4, testsFail: 0 } }));
    assert.equal(c.score, 1);
    assert.match(c.evidence, /treeRun ok/);
  });

  // -------------------------------------------------------------------------
  // 338-4 (W52): the score and the doctor's acceptance criterion read ONE
  // derivation — a behavioral pass is acceptance only over a HUMAN-approved
  // bar. These build the state with the real `fixtureAcceptanceState` (not a
  // literal), so a drift in the derivation reds them.
  // -------------------------------------------------------------------------

  test("338-4: behavioral pass over a human-approved bar keeps M1/M2 = 1", () => {
    const acceptance = fixtureAcceptanceState([
      { id: "a", approval: "approved", decidedBy: "human" },
      { id: "b", approval: "approved", decidedBy: "human" },
    ]);
    assert.equal(acceptance.state, "human-approved", "fixture precondition");
    const pass = input({
      treeRun: { ok: true, dir: "d", testsPass: 3, testsFail: 0 },
      behavioral: { pass: 3, fail: 0, acceptance },
    });
    assert.equal(m1Substance(pass).score, 1);
    assert.match(m1Substance(pass).evidence, /behavioral pass 3/);
    assert.equal(m2Runs(pass).score, 1);
  });

  test("338-4: a pending bar scores 0 with the doctor's own sentence (waiting ≠ accepted)", () => {
    const acceptance = fixtureAcceptanceState([{ id: "a", approval: "pending" }]);
    const c = m1Substance(
      input({
        treeRun: { ok: true, dir: "d", testsPass: 3, testsFail: 0 },
        behavioral: { pass: 3, fail: 0, acceptance },
      }),
    );
    assert.equal(c.score, 0);
    assert.match(c.evidence, /await a human decision/);
    assert.match(c.evidence, /--seat autopilot/, "the machine door is named as the door that may not approve");
  });

  test("338-4: an autopilot-decided bar is not acceptance — M2 = 0, never scored as human", () => {
    const acceptance = fixtureAcceptanceState([{ id: "a", approval: "approved", decidedBy: "autopilot" }]);
    assert.equal(acceptance.state, "machine-decided", "fixture precondition");
    const c = m2Runs(
      input({
        treeRun: { ok: true, dir: "d", testsPass: 3, testsFail: 0 },
        behavioral: { pass: 3, fail: 0, acceptance },
      }),
    );
    assert.equal(c.score, 0);
    assert.match(c.evidence, /autopilot seat/);
  });

  test("338-4: absent acceptance keeps the legacy A4 line byte-for-byte", () => {
    const pass = input({ treeRun: { ok: true, dir: "d", testsPass: 3, testsFail: 0 }, behavioral: { pass: 3, fail: 0 } });
    assert.equal(m1Substance(pass).score, 1);
    assert.equal(
      m1Substance(pass).evidence,
      "behavioral pass 3 fixture assertion(s)",
      "no acceptance field ⇒ legacy evidence, byte-identical",
    );
  });

  // -------------------------------------------------------------------------
  // A1-01 (fixes/344): a human-approved bar made of DRAFT SENTINELS
  // ("<draft>"/"<any>") asserts nothing real. The decision seat may say
  // human-approved, but the bar is placeholder-only — a behavioral pass over it
  // is not acceptance and must not re-key M1/M2 green.
  // -------------------------------------------------------------------------

  test("A1-01: a placeholder-only approved bar cannot score M1/M2 green", () => {
    const acceptance = fixtureAcceptanceState([{ id: "orc-1", approval: "approved", decidedBy: "human" }]);
    assert.equal(acceptance.state, "human-approved", "fixture precondition");
    const placeholderBar = project({
      acceptanceFixtures: [
        {
          id: "orc-1",
          requirementId: "orc-1",
          capability: "record",
          name: "job.record.happy",
          given: {},
          expect: { kind: "shape", value: { id: "<draft>" } },
          kind: "pure",
          source: "a7",
          approval: "approved",
          decidedBy: "human",
        },
      ],
    });
    const pass = input({
      project: placeholderBar,
      treeRun: { ok: true, dir: "d", testsPass: 3, testsFail: 0 },
      behavioral: { pass: 3, fail: 0, acceptance },
    });
    assert.equal(m1Substance(pass).score, 0, "a sentinel bar is not substance");
    assert.match(m1Substance(pass).evidence, /placeholder/i);
    assert.equal(m2Runs(pass).score, 0, "a green TAP over a sentinel bar is not the accepted bar");
    assert.match(m2Runs(pass).evidence, /placeholder/i);
  });

  test("A1-01: a real typed-literal bar still scores M1/M2 = 1 (no weakening)", () => {
    const acceptance = fixtureAcceptanceState([{ id: "orc-1", approval: "approved", decidedBy: "human" }]);
    const realBar = project({
      acceptanceFixtures: [
        {
          id: "orc-1",
          requirementId: "orc-1",
          capability: "record",
          name: "job.record.happy",
          given: { address: "1 Main St" },
          expect: { kind: "shape", value: { id: "p-1" } },
          kind: "pure",
          source: "a7",
          approval: "approved",
          decidedBy: "human",
        },
      ],
    });
    const pass = input({
      project: realBar,
      treeRun: { ok: true, dir: "d", testsPass: 3, testsFail: 0 },
      behavioral: { pass: 3, fail: 0, acceptance },
    });
    assert.equal(m1Substance(pass).score, 1);
    assert.equal(m2Runs(pass).score, 1);
  });

  test("skip ≠ green: ok:true with 0 assertions scores 0", () => {
    const c = m2Runs(input({ treeRun: { ok: true, dir: "d", testsPass: 0, testsFail: 0 } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /skip is not green/);
  });

  test("skip ≠ green: skipped flag scores 0 even if ok:true", () => {
    const c = m2Runs(input({ treeRun: { ok: true, skipped: true, testsPass: 2, testsFail: 0, dir: "d" } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /skip is not green/);
  });

  test("skip ≠ green: ok:true without testsPass is skip-shaped", () => {
    assert.equal(m2Runs(input({ treeRun: { ok: true } })).score, 0);
    assert.equal(treeRunLooksSkipped({ ok: true }), true);
  });

  test("treeRunToMakerEvidence: skip-only TAP is not ok", () => {
    const ev = treeRunToMakerEvidence({
      ok: true,
      dir: "d",
      compile: { ok: true, dir: "d", checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [] },
      tests: [
        {
          file: "tests/oracle.spec.ts",
          compile: "pass",
          tests: { pass: 0, fail: 0 },
          run: "skip",
          detail: "no entry",
        },
      ],
      run: { kind: "cli-tool", run: "skip", detail: "no package.json main" },
    } as TreeRunOutcome);
    assert.equal(ev!.ok, false);
    assert.equal(ev!.skipped, true);
    assert.equal(ev!.testsPass, 0);
  });

  test("treeRunToMakerEvidence: real TAP pass stays ok", () => {
    const ev = treeRunToMakerEvidence({
      ok: true,
      dir: "d",
      compile: { ok: true, dir: "d", checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [] },
      tests: [
        {
          file: "tests/oracle.spec.ts",
          compile: "pass",
          tests: { pass: 3, fail: 0 },
          run: "pass",
        },
      ],
      run: { kind: "cli-tool", run: "pass", entry: "src/generated.ts" },
    } as TreeRunOutcome);
    assert.equal(ev!.ok, true);
    assert.equal(ev!.skipped, false);
    assert.equal(ev!.testsPass, 3);
  });
});

// ---------------------------------------------------------------------------
// M3 iterates.
// ---------------------------------------------------------------------------

describe("M3 iterates", () => {
  test("journey outcome converged scores 1", () => {
    const c = m3Iterates(input({ journey: { outcome: "converged", cycles: 2, budget: 3 } }));
    assert.equal(c.score, 1);
  });

  test("keyless journey + recorded green P6 gate + lastTest ok derives convergence", () => {
    const p = project({
      phases: [phase(6, { passed: true })],
      lastTest: { ok: true, detail: "self-test", label: "self-test" },
    });
    const c = m3Iterates(input({ project: p, journey: { outcome: "keyless", cycles: 0, budget: 3 } }));
    assert.equal(c.score, 1);
  });

  test("keyless journey with a red P6 gate scores 0", () => {
    const p = project({ phases: [phase(6, { passed: false, unmet: ["p6-brief-fit"] })] });
    const c = m3Iterates(input({ project: p, journey: { outcome: "keyless", cycles: 0, budget: 3 } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /FAIL/);
  });

  test("green P6 gate without any lastTest record does not derive convergence", () => {
    const p = project({ phases: [phase(6, { passed: true })] });
    const c = m3Iterates(input({ project: p }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /lastTest/);
  });

  test("failed journey with refusal scores 0 and quotes the refusal", () => {
    const c = m3Iterates(input({ journey: { outcome: "failed", cycles: 3, budget: 3, refusal: "RT_E_SYNTH: brief too hard" } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /refusal/);
  });

  test("no journey evidence and no gate scores 0", () => {
    assert.equal(m3Iterates(input()).score, 0);
  });

  // 337-3 Trust: m2/m4 read every optional hash through `typeof`; m3 did not,
  // so a gate that is not the typed PhaseRecord.gate shape (no evidenceHash)
  // crashed the whole rubric with a TypeError instead of returning a criterion.
  test("a green P6 gate without an evidenceHash is read defensively, never crashing the scorer", () => {
    const p = project({
      phases: [{ id: 6, status: "complete", gate: { passed: true, unmet: [], checkedAt: 1 } }],
      lastTest: { ok: true, detail: "self-test", label: "self-test" },
    });
    const c = m3Iterates(input({ project: p, journey: { outcome: "keyless", cycles: 0, budget: 3 } }));
    assert.equal(c.score, 1, "a green gate + ok lastTest still derives convergence");
    assert.match(c.evidence, /no hash/);
    assert.doesNotMatch(c.evidence, /undefined/);
  });
});

// ---------------------------------------------------------------------------
// M4 machine-verifiable.
// ---------------------------------------------------------------------------

describe("M4 machine-verifiable", () => {
  test('lastTest "tested" with evidenceHash scores 1', () => {
    const p = project({ lastTest: { ok: true, detail: "verify pass", label: "tested", evidenceHash: "deadbeef1234" } });
    const c = m4MachineVerifiable(input({ project: p }));
    assert.equal(c.score, 1);
    assert.match(c.evidence, /deadbeef/);
  });

  test('"tested" without an evidenceHash scores 0', () => {
    const p = project({ lastTest: { ok: true, detail: "verify pass", label: "tested" } });
    const c = m4MachineVerifiable(input({ project: p }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /NO evidenceHash/);
  });

  test("self-test label (deterministic floor) scores 0", () => {
    const p = project({ lastTest: { ok: true, detail: "engine-template", label: "self-test" } });
    const c = m4MachineVerifiable(input({ project: p }));
    assert.equal(c.score, 0);
  });

  test("real-run label without hash scores 0 (not a machine verification)", () => {
    const p = project({ lastTest: { ok: true, detail: "ran", label: "real-run" } });
    const c = m4MachineVerifiable(input({ project: p }));
    assert.equal(c.score, 0);
  });

  test("absent lastTest scores 0", () => {
    assert.equal(m4MachineVerifiable(input()).score, 0);
  });

  // -------------------------------------------------------------------------
  // W55 · 341-5: M4's doc claims "the p6-verified probe semantics, dod.ts", but
  // it checked only label + hash — dod's probe ALSO requires ok === true and a
  // non-empty detail (dod.ts:693-703, pinned by dod.test.ts:90,95). M4 is now
  // that probe exactly: one record, one verdict, no two stories.
  // -------------------------------------------------------------------------
  test("341-5: M4 IS the dod p6-verified probe — ok:false or an empty/absent detail cannot score, hash or not", () => {
    const noOk = project({ lastTest: { ok: false, detail: "x", label: "tested", evidenceHash: "h" } });
    assert.equal(m4MachineVerifiable(input({ project: noOk })).score, 0, "p6-verified requires lastTest.ok === true");
    const noDetail = project({ lastTest: { ok: true, detail: "", label: "tested", evidenceHash: "h" } });
    assert.equal(m4MachineVerifiable(input({ project: noDetail })).score, 0, "p6-verified requires a non-empty detail");
    const absentDetail = project({ lastTest: { ok: true, label: "tested", evidenceHash: "h" } });
    assert.equal(m4MachineVerifiable(input({ project: absentDetail })).score, 0, "an absent detail is not a verdict");
    const full = project({ lastTest: { ok: true, detail: "verify pass", label: "tested", evidenceHash: "h" } });
    assert.equal(m4MachineVerifiable(input({ project: full })).score, 1, "the full p6-verified shape still scores");
  });

  // -------------------------------------------------------------------------
  // W55 · 341-5: the 0.35 brief-fit bar was recalibrated on the engine sites
  // (322 X1) and maker-score.ts claimed "verbatim" parity. Prove it against the
  // codegen pre-acceptance function directly (the third engine site), not just
  // by a shared literal — a future drift on either side reds this.
  // -------------------------------------------------------------------------
  test("341-5: p6BriefFitPasses is byte-parity with codegen's briefFitSatisfied across the whole boundary", () => {
    const nouns = "aurora basalt cipher dune ember fjord glade harbor isle juniper kestrel lagoon mesa nimbus orchid peak quarry ridge summit tundra".split(" ");
    const brief = nouns.join(" ");
    for (let k = 0; k <= nouns.length; k++) {
      const src = nouns.slice(0, k).map((n) => `const ${n} = 0;`).join("\n");
      assert.equal(p6BriefFitPasses(brief, src), briefFitSatisfied(brief, src).ok, `parity at k=${k} (0.35 bar)`);
    }
  });
});

// ---------------------------------------------------------------------------
// M5 honest.
// ---------------------------------------------------------------------------

describe("M5 honest", () => {
  test("no red gate records scores 1", () => {
    const p = project({ phases: [phase(6, { passed: true })] });
    assert.equal(m5Honest(input({ project: p })).score, 1);
  });

  test("red gate surfaced by the sealedWithFailures flag scores 1", () => {
    const p = project({ phases: [phase(6, { passed: false })] });
    const c = m5Honest(input({ project: p, run: { sealedWithFailures: true } }));
    assert.equal(c.score, 1);
    assert.match(c.evidence, /surfaced loudly/);
  });

  test("red gate surfaced by the census log scores 1", () => {
    const p = project({
      phases: [phase(6, { passed: false })],
      logs: [{ ts: 1, phase: 12, level: "warn", event: "run.complete.with.failed.gates", detail: "sealed complete with 1 failed DoD gate(s)" }],
    });
    assert.equal(m5Honest(input({ project: p })).score, 1);
  });

  test("red gate surfaced by a warn gate.verdict log for that phase scores 1", () => {
    const p = project({
      phases: [phase(6, { passed: false })],
      logs: [{ ts: 1, phase: 6, level: "warn", event: "gate.verdict", detail: "FAIL · 2 unmet · abc12345" }],
    });
    assert.equal(m5Honest(input({ project: p })).score, 1);
  });

  test("red gate hiding under a clean seal (no flag, no logs) scores 0", () => {
    const p = project({ status: "complete", phases: [phase(6, { passed: false })] });
    const c = m5Honest(input({ project: p }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /under a clean seal/);
  });

  test("red record on a non-complete phase with no surfacing scores 0 (census blind spot)", () => {
    const p = project({
      status: "complete",
      phases: [{ id: 6, status: "running", gate: { passed: false, unmet: ["p6-verified"], evidenceHash: "abc", checkedAt: 1 } }],
    });
    assert.equal(m5Honest(input({ project: p })).score, 0);
  });
});

// ---------------------------------------------------------------------------
// M6 handover.
// ---------------------------------------------------------------------------

describe("M6 handover", () => {
  const fullHandover = { emitted: true, deployMd: true, oracleSpec: true, oracleSpecBytes: 4200 };

  test("emitted dir with DEPLOY.md + real oracle spec scores 1", () => {
    assert.equal(m6Handover(input({ handover: fullHandover })).score, 1);
  });

  test("missing DEPLOY.md scores 0", () => {
    const c = m6Handover(input({ handover: { ...fullHandover, deployMd: false } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /incomplete/);
  });

  test("stub oracle spec (<100b) scores 0", () => {
    const c = m6Handover(input({ handover: { ...fullHandover, oracleSpecBytes: 40 } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /stub/);
  });

  test("failed emission scores 0 with the emit error", () => {
    const c = m6Handover(input({ handover: { emitted: false, deployMd: false, oracleSpec: false, oracleSpecBytes: 0, emitError: "no generatedSource" } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /no generatedSource/);
  });

  test("absent handover evidence scores 0", () => {
    assert.equal(m6Handover(input({ handover: null })).score, 0);
  });
});

// ---------------------------------------------------------------------------
// M7 learning.
// ---------------------------------------------------------------------------

describe("M7 learning", () => {
  /** A fully-green M1+M2+M3 project. */
  function greenProject(): Project {
    return project({
      generatedTree: [treeFile("src/ledger.ts", "export function ledgerTotals() {}")],
      phases: [phase(6, { passed: true })],
      lastTest: { ok: true, detail: "ok", label: "self-test" },
    });
  }

  test("no prior same-domain run scores 0 (no claim without data)", () => {
    const c = m7Learning(input({ project: greenProject(), treeRun: { ok: true, testsPass: 1, testsFail: 0 }, journey: { outcome: "converged", cycles: 1, budget: 3 }, prior: null }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /no prior/);
  });

  // 342-3 (W56): a prior row whose own M1+M2+M3 sum is 0 carries no lesson,
  // so matching it reuses nothing. Pre-fix any run scored M7=1 against such a
  // prior (mineSum ≥ 0), minting a learning point with no evidence — the
  // exact false-green the corpus bar must not inherit.
  test("a substance-free prior is not a lesson — it mints no learning point", () => {
    const c = m7Learning(
      input({ project: greenProject(), treeRun: { ok: true, testsPass: 1, testsFail: 0 }, journey: { outcome: "converged", cycles: 1, budget: 3 }, prior: { m1: 0, m2: 0, m3: 0 } }),
    );
    assert.equal(c.score, 0);
    assert.match(c.evidence, /nothing was learned to reuse/);
  });

  test("M1+M3 ≥ prior learned substance scores 1", () => {
    const c = m7Learning(
      input({ project: greenProject(), treeRun: { ok: true, testsPass: 1, testsFail: 0 }, journey: { outcome: "converged", cycles: 1, budget: 3 }, prior: { m1: 1, m2: 0, m3: 1 } }),
    );
    assert.equal(c.score, 1);
    assert.match(c.evidence, /M1\+M3 2 ≥ prior learned substance 2/);
  });

  test("equality with the prior run still passes (run 2 ≥ run 1)", () => {
    const c = m7Learning(
      input({ project: greenProject(), treeRun: { ok: true, testsPass: 1, testsFail: 0 }, journey: { outcome: "converged", cycles: 1, budget: 3 }, prior: { m1: 1, m2: 1, m3: 1 } }),
    );
    assert.equal(c.score, 1);
  });

  test("regression below the prior same-domain run scores 0", () => {
    const p = project({
      // M1: tree misses the capability → 0; M3: red gate → 0; M2 still runs (assertions existed).
      generatedTree: [treeFile("src/other.ts", "export function other() {}")],
      phases: [phase(6, { passed: false, unmet: ["p6-brief-fit"] })],
    });
    const c = m7Learning(
      input({ project: p, corpus: { kind: "library", expectedCapabilities: ["ledger"] }, treeRun: { ok: true, testsPass: 1, testsFail: 0 }, journey: { outcome: "keyless", cycles: 0, budget: 3 }, prior: { m1: 1, m2: 1, m3: 1 } }),
    );
    assert.equal(m1Substance(input({ project: p, corpus: { kind: "library", expectedCapabilities: ["ledger"] } })).score, 0);
    assert.equal(c.score, 0);
    assert.match(c.evidence, /regression/);
  });

  // 342-3 vB (verifier B): the prior's "substance" must be the criteria that
  // represent LEARNED substance (M1 substance + M3 iterate — model-produced
  // code and its convergence), never M2, the deterministic tree-run that even
  // a keyless/floor run earns. Pre-vB a prior of {m1:0,m2:1,m3:0} minted M7=1
  // (mineSum ≥ 1) — a learning claim from a floor-only prior. 19 of the 29
  // stored m7=1 rows had exactly that prior shape.
  test("a prior whose only substance is M2 (the deterministic tree-run) is not learned substance — M7=0", () => {
    const c = m7Learning(
      input({ project: greenProject(), treeRun: { ok: true, testsPass: 1, testsFail: 0 }, journey: { outcome: "converged", cycles: 1, budget: 3 }, prior: { m1: 0, m2: 1, m3: 0 } }),
    );
    assert.equal(c.score, 0);
    assert.match(c.evidence, /learned substance/);
  });

  test("a prior with real learned substance (M3, not M2) is carried forward — M7=1", () => {
    const c = m7Learning(
      input({ project: greenProject(), treeRun: { ok: true, testsPass: 1, testsFail: 0 }, journey: { outcome: "converged", cycles: 1, budget: 3 }, prior: { m1: 0, m2: 0, m3: 1 } }),
    );
    assert.equal(c.score, 1);
  });
});

// ---------------------------------------------------------------------------
// M8 bounded.
// ---------------------------------------------------------------------------

describe("M8 bounded", () => {
  test("journey inside budget scores 1", () => {
    const c = m8Bounded(input({ budget: { used: 2, budget: 3 } }));
    assert.equal(c.score, 1);
  });

  test("journey exhausting the budget exactly (used == budget) is still bounded", () => {
    assert.equal(m8Bounded(input({ budget: { used: 3, budget: 3 } })).score, 1);
  });

  test("journey overrunning its budget scores 0", () => {
    const c = m8Bounded(input({ budget: { used: 4, budget: 3 } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /overran/);
  });

  test("absent budget evidence scores 0", () => {
    assert.equal(m8Bounded(input({ budget: null })).score, 0);
  });
});

// ---------------------------------------------------------------------------
// M9 on-time / stop-loudly.
// ---------------------------------------------------------------------------

describe("M9 on-time", () => {
  test("clean on-time run with no refusal scores 1", () => {
    const c = m9OnTime(input({ stop: { onTime: true, refused: false, loud: false } }));
    assert.equal(c.score, 1);
  });

  test("refused run parked loudly with a code scores 1", () => {
    const c = m9OnTime(input({ stop: { onTime: true, refused: true, loud: true, code: "RT_E_GATES_FAILED" } }));
    assert.equal(c.score, 1);
    assert.match(c.evidence, /RT_E_GATES_FAILED/);
  });

  test("refused run stopping silently scores 0", () => {
    const c = m9OnTime(input({ stop: { onTime: true, refused: true, loud: false, code: null } }));
    assert.equal(c.score, 0);
    assert.match(c.evidence, /SILENTLY/);
  });

  test("run that did not stop on time scores 0", () => {
    assert.equal(m9OnTime(input({ stop: { onTime: false, refused: false, loud: false } })).score, 0);
  });

  test("absent stop evidence scores 0", () => {
    assert.equal(m9OnTime(input({ stop: null })).score, 0);
  });
});

// ---------------------------------------------------------------------------
// The card: total = mean over nine.
// ---------------------------------------------------------------------------

describe("scoreMaker card", () => {
  test("all-green inputs land a 9/9 = 1.0 card", () => {
    const p = project({
      generatedTree: [treeFile("src/ledger.ts", "export function ledgerTotals() {}")],
      phases: [phase(6, { passed: true })],
      lastTest: { ok: true, detail: "verify pass", label: "tested", evidenceHash: "deadbeef1234" },
    });
    const c = card({
      project: p,
      corpus: { kind: "library", expectedCapabilities: ["ledger"] },
      treeRun: { ok: true, dir: "d", testsPass: 2, testsFail: 0 },
      journey: { outcome: "converged", cycles: 1, budget: 3 },
      handover: { emitted: true, deployMd: true, oracleSpec: true, oracleSpecBytes: 4200 },
      prior: { m1: 1, m2: 1, m3: 1 },
      budget: { used: 1, budget: 3 },
      stop: { onTime: true, refused: false, loud: false },
    });
    assert.equal(c.total, 9);
    assert.equal(c.mean, 1);
  });

  test("stub leftover jobs cannot land a 9/9 product-complete card", () => {
    const stub = `export function runAlpha(input: unknown): { ok: boolean } {
  void input;
  throw new Error("TODO(E-15) stub: implement job alpha");
}`;
    const p = project({
      generatedTree: [treeFile("src/jobs/alpha.ts", stub)],
      phases: [phase(6, { passed: true })],
      lastTest: { ok: true, detail: "verify pass", label: "tested", evidenceHash: "deadbeef1234" },
    });
    const c = card({
      project: p,
      corpus: { kind: "library", expectedCapabilities: ["alpha"] },
      treeRun: { ok: true, dir: "d", testsPass: 2, testsFail: 0 },
      journey: { outcome: "converged", cycles: 1, budget: 3 },
      handover: { emitted: true, deployMd: true, oracleSpec: true, oracleSpecBytes: 4200 },
      prior: { m1: 1, m2: 1, m3: 1 },
      budget: { used: 1, budget: 3 },
      stop: { onTime: true, refused: false, loud: false },
    });
    assert.ok(c.total < 9, `stub jobs must not score product-complete, got ${c.total}/9`);
    assert.equal(c.criteria.M1.score, 0);
  });

  test("skip treeRun cannot land M2 green on an otherwise 9/9 shape", () => {
    const p = project({
      generatedTree: [treeFile("src/ledger.ts", "export function ledgerTotals() {}")],
      phases: [phase(6, { passed: true })],
      lastTest: { ok: true, detail: "verify pass", label: "tested", evidenceHash: "deadbeef1234" },
    });
    const c = card({
      project: p,
      corpus: { kind: "library", expectedCapabilities: ["ledger"] },
      treeRun: { ok: true, dir: "d", testsPass: 0, testsFail: 0, skipped: true },
      journey: { outcome: "converged", cycles: 1, budget: 3 },
      handover: { emitted: true, deployMd: true, oracleSpec: true, oracleSpecBytes: 4200 },
      prior: { m1: 1, m2: 1, m3: 1 },
      budget: { used: 1, budget: 3 },
      stop: { onTime: true, refused: false, loud: false },
    });
    assert.equal(c.criteria.M2.score, 0);
    assert.ok(c.total < 9);
  });

  test("deterministic keyless floor lands the honest low card", () => {
    // The keyless floor: placeholder single-module source with NO brief
    // vocabulary, self-test only, red P6 gate surfaced by the census.
    const p = project({
      generatedSource: "export function placeholderModule() { return 42; }",
      phases: [phase(6, { passed: false, unmet: ["p6-verified", "p6-brief-fit"] })],
      lastTest: { ok: true, detail: "engine-template self-test", label: "self-test" },
      logs: [{ ts: 1, phase: 12, level: "warn", event: "run.complete.with.failed.gates", detail: "sealed complete with 1 failed DoD gate(s)" }],
    });
    const c = card({
      project: p,
      corpus: { kind: "library", expectedCapabilities: [] },
      treeRun: { ok: true, dir: "d", testsPass: 1, testsFail: 0 },
      journey: { outcome: "keyless", cycles: 0, budget: 3 },
      handover: { emitted: true, deployMd: true, oracleSpec: true, oracleSpecBytes: 3100 },
      budget: { used: 0, budget: 3 },
      stop: { onTime: true, refused: false, loud: false },
    });
    // 342-3 vB: a keyless run is floored exactly like a refused keyed run —
    // M1-M4 are the deterministic scaffold, not model-produced software.
    // M1-M4 0 (keyless floor) · M5 1 (census log surfaces the red gate) ·
    // M6 1 · M7 0 (no prior) · M8 1 · M9 1
    assert.equal(c.total, 4);
    assert.equal(c.mean, 4 / 9);
    for (const m of ["M1", "M2", "M3", "M4"] as const) {
      assert.equal(c.criteria[m].score, 0);
      assert.equal(c.criteria[m].evidence, KEYLESS_FLOOR_QUALIFIER_EVIDENCE);
    }
  });
});

// ---------------------------------------------------------------------------
// fixes/154 (F1) — the synthesisSucceeded floor gate (scorer vacuity).
// ---------------------------------------------------------------------------

describe("fixes/154 F1 — synthesisSucceeded floor gate", () => {
  /** The 9/9 artifact shape: every M1..M9 probe green on its face — the
   *  refused-run project whose tree/run/mint evidence is the deterministic
   *  floor (brief-noun-shaped by construction). Pre-fixes/154 this carded
   *  9/9 while no LLM-produced software existed (fixes/145 correction +
   *  fixes/153 finding). */
  function nineGreenRefusedRunInput(): MakerScoreInput {
    return input({
      project: project({
        generatedTree: [treeFile("src/ledger.ts", "export function ledgerTotals() {}")],
        phases: [phase(6, { passed: true })],
        lastTest: { ok: true, detail: "verify pass", label: "tested", evidenceHash: "deadbeef1234" },
      }),
      corpus: { kind: "library", expectedCapabilities: ["ledger"] },
      treeRun: { ok: true, dir: "d", testsPass: 2, testsFail: 0 },
      journey: { outcome: "converged", cycles: 1, budget: 3 },
      handover: { emitted: true, deployMd: true, oracleSpec: true, oracleSpecBytes: 4200 },
      prior: { m1: 1, m2: 1, m3: 1 },
      budget: { used: 1, budget: 3 },
      stop: { onTime: true, refused: false, loud: false },
    });
  }

  test("refused 9/9 shape (synthesisSucceeded:false) forces M1-M4 = 0 with the shared floor qualifier — card 5/9", () => {
    const base = scoreMaker(nineGreenRefusedRunInput()); // no flag → legacy 9/9
    assert.equal(base.total, 9);
    const floored = scoreMaker({ ...nineGreenRefusedRunInput(), synthesisSucceeded: false });
    // The headline: the artifact card drops 9/9 → 5/9, honestly.
    assert.equal(floored.total, 5);
    assert.equal(floored.mean, 5 / 9);
    for (const m of ["M1", "M2", "M3", "M4"] as const) {
      assert.equal(floored.criteria[m].score, 0);
      assert.equal(floored.criteria[m].evidence, FLOOR_QUALIFIER_EVIDENCE);
    }
    // The qualifier is ONE honest statement, and it says what it means.
    assert.match(FLOOR_QUALIFIER_EVIDENCE, /deterministic floor/);
    assert.match(FLOOR_QUALIFIER_EVIDENCE, /no LLM-produced software exists/);
    // M5-M9 byte-identical (score AND evidence) — including M7, whose
    // internal M1+M2+M3 math runs over the UNFORCED criteria.
    for (const m of ["M5", "M6", "M7", "M8", "M9"] as const) {
      assert.deepEqual(floored.criteria[m], base.criteria[m]);
      assert.equal(floored.criteria[m].score, 1);
    }
  });

  test("succeeded input byte-pins the legacy card (synthesisSucceeded:true === undefined)", () => {
    const base = scoreMaker(nineGreenRefusedRunInput());
    const ok = scoreMaker({ ...nineGreenRefusedRunInput(), synthesisSucceeded: true });
    assert.deepEqual(ok, base);
    assert.equal(ok.total, 9);
  });

  test("the floor gate is a CARD-level override — exported criteria keep their own semantics for direct callers", () => {
    // m1..m4 over the refused-run's project still report the tree's real
    // reqTrace/run/mint facts: the vacuity judgment is scoreMaker's job.
    // Putting the gate inside the criteria would leak forced zeros into
    // m7Learning's internal M1+M2+M3 sum and read a refused run as a
    // LEARNING REGRESSION against a keyed prior — false.
    const refused = { ...nineGreenRefusedRunInput(), synthesisSucceeded: false };
    assert.equal(m1Substance(refused).score, 1);
    assert.equal(m2Runs(refused).score, 1);
    assert.equal(m3Iterates(refused).score, 1);
    assert.equal(m4MachineVerifiable(refused).score, 1);
    const floored = scoreMaker(refused);
    assert.equal(floored.criteria.M1.score, 0); // the gate lands at the card
    const base = scoreMaker(nineGreenRefusedRunInput());
    assert.deepEqual(floored.criteria.M7, base.criteria.M7); // M7 evidence unforced
  });
});

// ---------------------------------------------------------------------------
// 342-3 (W56) — the corpus bar is per run kind.
// A first run cannot score M7 (m7Learning), so its bar must judge the criteria
// it CAN score — M7 excluded, every remaining criterion still required.
// ---------------------------------------------------------------------------

/** A card-like criteria record with exactly the criteria the caller names set
 *  to 1 (the rest 0). No casts: the nine ids are written out. */
function barCard(one: Partial<Record<"m1" | "m2" | "m3" | "m4" | "m5" | "m6" | "m7" | "m8" | "m9", 0 | 1>>): Pick<MakerScoreCard, "criteria"> {
  const v = (x: 0 | 1 | undefined): { score: 0 | 1; evidence: string } => ({ score: x ?? 0, evidence: "test" });
  return {
    criteria: {
      M1: v(one.m1),
      M2: v(one.m2),
      M3: v(one.m3),
      M4: v(one.m4),
      M5: v(one.m5),
      M6: v(one.m6),
      M7: v(one.m7),
      M8: v(one.m8),
      M9: v(one.m9),
    },
  };
}

/** The bar every corpus grader declares: warm = 1 over all nine; first run =
 *  1 over the eight it can score (M7 excluded). */
const CORPUS_BAR: MakerBarWhen = {
  meanAtLeast: 1,
  firstRun: { meanAtLeast: 1, excludeCriteria: ["M7"] },
};

describe("342-3 per-run-kind corpus bar", () => {
  test("runKind is first with no prior and warm with a prior", () => {
    assert.equal(runKindOf(null), "first");
    assert.equal(runKindOf(undefined), "first");
    assert.equal(runKindOf({ m1: 1, m2: 1, m3: 1 }), "warm");
  });

  test("barForRunKind: a first run drops exactly M7; a warm run drops nothing", () => {
    assert.deepEqual(barForRunKind(CORPUS_BAR, "first"), { meanAtLeast: 1, excludeCriteria: ["M7"] });
    assert.deepEqual(barForRunKind(CORPUS_BAR, "warm"), { meanAtLeast: 1, excludeCriteria: [] });
    assert.deepEqual(FIRST_RUN_UNSCOREABLE_CRITERIA, ["M7"]);
  });

  test("barForRunKind: a grader with no firstRun block keeps the warm bar (back-compat)", () => {
    assert.deepEqual(barForRunKind({ meanAtLeast: 0.5 }, "first"), { meanAtLeast: 0.5, excludeCriteria: [] });
  });

  test("criteriaMeanExcluding skips the excluded ids (8/8 = 1, not 8/9)", () => {
    const eight = barCard({ m1: 1, m2: 1, m3: 1, m4: 1, m5: 1, m6: 1, m8: 1, m9: 1 });
    assert.equal(criteriaMeanExcluding(eight, ["M7"]), 1);
    assert.equal(criteriaMeanExcluding(eight, []), 8 / 9);
    assert.equal(criteriaMeanExcluding(eight, FIRST_RUN_UNSCOREABLE_CRITERIA), 1);
  });

  test("criteriaMeanExcluding: excluding EVERY criterion returns 0, never NaN (nothing to score is no pass)", () => {
    const all = barCard({ m1: 1, m2: 1, m3: 1, m4: 1, m5: 1, m6: 1, m7: 1, m8: 1, m9: 1 });
    const mean = criteriaMeanExcluding(all, ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"]);
    assert.equal(mean, 0, "an all-excluded set is 0, not NaN");
    assert.equal(Number.isNaN(mean), false);
  });

  test("(a) a first run that meets its real criteria clears the bar", () => {
    const first = barCard({ m1: 1, m2: 1, m3: 1, m4: 1, m5: 1, m6: 1, m7: 0, m8: 1, m9: 1 });
    const r = meetsRunKindBar(first, CORPUS_BAR, runKindOf(null));
    assert.equal(r.ok, true, `expected 8/8 to clear the first-run bar, got mean ${r.mean} vs ${r.meanAtLeast}`);
    assert.equal(r.mean, 1);
    assert.deepEqual(r.excludeCriteria, ["M7"]);
  });

  test("(b) a stub / zero-substance first run still fails", () => {
    // The keyless floor shape: M1-M4 forced 0 (synthesis refused), M7 0.
    const floor = barCard({ m5: 1, m6: 1, m8: 1, m9: 1 });
    const r = meetsRunKindBar(floor, CORPUS_BAR, runKindOf(null));
    assert.equal(r.ok, false);
    assert.equal(r.mean, 4 / 8);
  });

  test("(c) a warm run must still earn M7 — 8/9 with M7=0 fails the unchanged warm bar", () => {
    const warmEight = barCard({ m1: 1, m2: 1, m3: 1, m4: 1, m5: 1, m6: 1, m7: 0, m8: 1, m9: 1 });
    const fail = meetsRunKindBar(warmEight, CORPUS_BAR, "warm");
    assert.equal(fail.ok, false, "a warm run cannot drop M7");
    assert.equal(fail.mean, 8 / 9);
    // ...and clears it only once M7 is actually earned.
    const warmNine = barCard({ m1: 1, m2: 1, m3: 1, m4: 1, m5: 1, m6: 1, m7: 1, m8: 1, m9: 1 });
    assert.equal(meetsRunKindBar(warmNine, CORPUS_BAR, "warm").ok, true);
  });

  test("the same 8/9 card flips with the run kind — the bar, not the card, decides", () => {
    const card = barCard({ m1: 1, m2: 1, m3: 1, m4: 1, m5: 1, m6: 1, m7: 0, m8: 1, m9: 1 });
    assert.equal(meetsRunKindBar(card, CORPUS_BAR, "first").ok, true);
    assert.equal(meetsRunKindBar(card, CORPUS_BAR, "warm").ok, false);
  });

  // 342-3 vB (verifier B): a declared firstRun block is trusted by parseGrader,
  // so maker-score must not honor a loose one. Only the genuinely unscoreable
  // criteria may be excluded, and the first-run threshold must demand ALL the
  // remaining criteria (mean 1) — a weaker first-run threshold is a defect,
  // not a configuration.
  test("barForRunKind ignores a first-run threshold below 1 — a weaker first-run bar is a defect, not a config", () => {
    const loose: MakerBarWhen = { meanAtLeast: 1, firstRun: { meanAtLeast: 0.5, excludeCriteria: ["M7"] } };
    assert.deepEqual(barForRunKind(loose, "first"), { meanAtLeast: 1, excludeCriteria: ["M7"] });
  });

  test("barForRunKind clamps first-run exclusions to the genuinely unscoreable set (M7 today)", () => {
    const loose: MakerBarWhen = { meanAtLeast: 1, firstRun: { meanAtLeast: 1, excludeCriteria: ["M1", "M2", "M3", "M4"] } };
    assert.deepEqual(barForRunKind(loose, "first"), { meanAtLeast: 1, excludeCriteria: [] });
    const mixed: MakerBarWhen = { meanAtLeast: 1, firstRun: { meanAtLeast: 1, excludeCriteria: ["M7", "M1"] } };
    assert.deepEqual(barForRunKind(mixed, "first"), { meanAtLeast: 1, excludeCriteria: ["M7"] });
  });

  test("meetsRunKindBar: the keyless floor cannot pass a loosely-declared first-run bar", () => {
    // verifier B's demonstration: {meanAtLeast:0.5, excludeCriteria:["M7"]}
    // made a 4/8 floor card pass. The pure bar must refuse it structurally.
    const loose: MakerBarWhen = { meanAtLeast: 1, firstRun: { meanAtLeast: 0.5, excludeCriteria: ["M7"] } };
    const floor = barCard({ m5: 1, m6: 1, m8: 1, m9: 1 });
    assert.equal(meetsRunKindBar(floor, loose, "first").ok, false);
  });

  // 342-3 vB (hole 2): the keyless floor guarantee must be structural, not a
  // property of the stored numbers. A keyless card (journey outcome
  // "keyless" — driveP6Journey's honest no-op) has no machine-verified
  // synthesis, so scoreMaker forces M1-M4 to the keyless floor and the card
  // cannot clear any admissible corpus bar by construction.
  const keylessNineOnItsFace = () => ({
    project: project({
      generatedTree: [treeFile("src/ledger.ts", "export function ledgerTotals() {}")],
      phases: [phase(6, { passed: true })],
      lastTest: { ok: true, detail: "verify pass", label: "tested", evidenceHash: "deadbeef1234" },
    }),
    corpus: { kind: "library", expectedCapabilities: ["ledger"] },
    treeRun: { ok: true, dir: "d", testsPass: 2, testsFail: 0 },
    journey: { outcome: "keyless" as const, cycles: 0, budget: 3 },
    handover: { emitted: true, deployMd: true, oracleSpec: true, oracleSpecBytes: 4200 },
    prior: { m1: 1, m2: 1, m3: 1 },
    budget: { used: 0, budget: 3 },
    stop: { onTime: true, refused: false, loud: false },
  });

  test("(d) a keyless card cannot clear the bar by construction — M1-M4 are the keyless floor", () => {
    const c = card(keylessNineOnItsFace());
    for (const m of ["M1", "M2", "M3", "M4"] as const) {
      assert.equal(c.criteria[m].score, 0, `${m} must be the keyless floor, not a floor-shaped green`);
    }
    // The best a keyless card can reach is M5,M6,M7,M8,M9 = 5/9; the first-run
    // bar (M7 excluded) is 4/8 = 0.5 < 1. Neither bar is reachable.
    assert.equal(c.total, 5);
    assert.equal(meetsRunKindBar(c, CORPUS_BAR, "first").ok, false);
    assert.equal(meetsRunKindBar(c, CORPUS_BAR, "warm").ok, false);
  });

  test("firstRunBarIsAdmissible: the corpus block is admissible; loose blocks are rejected", () => {
    assert.deepEqual(firstRunBarIsAdmissible(CORPUS_BAR), { ok: true, defects: [] });
    const weak = firstRunBarIsAdmissible({ meanAtLeast: 1, firstRun: { meanAtLeast: 0.5, excludeCriteria: ["M7"] } });
    assert.equal(weak.ok, false);
    assert.match(weak.defects.join(" "), /meanAtLeast must be 1/);
    const ducked = firstRunBarIsAdmissible({ meanAtLeast: 1, firstRun: { meanAtLeast: 1, excludeCriteria: ["M1", "M2"] } });
    assert.equal(ducked.ok, false);
    assert.match(ducked.defects.join(" "), /may name only/);
    assert.deepEqual(firstRunBarIsAdmissible({ meanAtLeast: 0.5 }), { ok: true, defects: [] });
  });

  test("FIRST_RUN_BAR_MEAN_ATLEAST is 1 — the only first-run threshold that demands every scoreable criterion", () => {
    assert.equal(FIRST_RUN_BAR_MEAN_ATLEAST, 1);
  });
});
