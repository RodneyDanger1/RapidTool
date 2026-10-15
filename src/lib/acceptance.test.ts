/**
 * PR-30 / PR-31 / PR-32 — the machine acceptance reading + fleet observability.
 * Run: node --experimental-strip-types --test --test-reporter=tap src/lib/acceptance.test.ts
 *
 * PR-30 (S-side mint): the persisted "tested" evidenceHash must identify the
 * TREE BYTES, so two distinct trees can never share one (BF-6 / design §4.8).
 * PR-31: the additive machine acceptance aggregate — machine-attributed by
 * construction, human-seat claims refused, non-evidenced claims coerced false.
 * PR-32: falsifiable fleet metrics/alarms.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACCEPTANCE_REFUSAL,
  FLEET_ACCEPTANCE_MIN,
  FLEET_ALARM_THRESHOLDS,
  MACHINE_ACCEPTANCE_SEAT,
  fleetAcceptanceFromProjects,
  fleetAlarms,
  fleetMetrics,
  gateEvidenceOfProject,
  parseCandidateJournalRow,
  readMachineEvidence,
  resampleUsage,
  stageWiringReading,
} from "./acceptance.ts";
import { mintTreeRunTested, treeBytesDigest, treeRunTestedEvidence } from "./codegen.server.ts";
import { fnv1a } from "./algorithms.ts";
import type { Project } from "./types.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";

// ---------------------------------------------------------------------------
// PR-30 (S-side) — the minted evidence must identify the tree bytes
// ---------------------------------------------------------------------------

const outcome = (over: Partial<TreeRunOutcome> = {}): TreeRunOutcome =>
  ({
    ok: true,
    dir: "C:/scratch/rt-bf6",
    compile: { ok: true, dir: "C:/scratch/rt-bf6", checked: 2, passed: 2, failed: 0, skipped: 0, verdicts: [] },
    tests: [
      {
        file: "tests/oracle.spec.ts",
        compile: { file: "tests/oracle.spec.ts", ok: true, verdict: "pass" },
        tests: { pass: 1, fail: 0 },
        run: "pass",
        behavioural: true,
      },
    ],
    run: { kind: "webapp", run: "pass", entry: "src/main.tsx", detail: "started" },
    ...over,
  }) as unknown as TreeRunOutcome;

type TreeFile = { path: string; source: string };

const project = (tree?: TreeFile[]): Project =>
  ({
    lastTest: null,
    logs: [],
    ...(tree
      ? { generatedTree: tree.map((f) => ({ ...f, hash: String(fnv1a(f.source)), attempt: 0 })) }
      : {}),
  }) as unknown as Project;

const hashOf = (p: Project): string =>
  String((p.lastTest as { evidenceHash?: string } | null | undefined)?.evidenceHash ?? "");

describe("PR-30 (S-side) — the tested evidenceHash is derived from the TREE BYTES", () => {
  it("treeBytesDigest: empty/absent input yields '' (no tree → legacy hash preserved)", () => {
    assert.equal(treeBytesDigest([]), "");
    assert.equal(treeBytesDigest(undefined), "");
    assert.equal(treeBytesDigest(null), "");
    assert.equal(treeBytesDigest("not-an-array"), "");
  });

  it("treeBytesDigest is deterministic and order-independent (sorted path\\0hash)", () => {
    const a = [{ path: "src/a.ts", source: "export const a = 1;" }];
    const b = [{ path: "src/b.ts", source: "export const b = 2;" }];
    assert.equal(treeBytesDigest(a), treeBytesDigest([...a]));
    assert.equal(treeBytesDigest([...a, ...b]), treeBytesDigest([...b, ...a]), "input order must not matter");
    assert.notEqual(treeBytesDigest(a), treeBytesDigest(b));
  });

  it("RED→GREEN: two distinct trees with an IDENTICAL run summary mint DIFFERENT hashes", () => {
    // The BUILD_FORENSICS §3.8 collision class: same spec path + counts, one
    // generic verdict, different tree bytes (761559975 was reused across three
    // projects). The run summary is byte-identical; only the tree differs.
    const o = outcome();
    const summaryHash = String(fnv1a(treeRunTestedEvidence(o).summary));
    const treeA = project([{ path: "src/generated/a.ts", source: "export function alpha() { return 1; }" }]);
    const treeB = project([{ path: "src/generated/a.ts", source: "export function beta() { return 2; }" }]);
    const treeC = project([{ path: "src/generated/a.ts", source: "export function gamma() { return 3; }" }]);

    const a = hashOf(mintTreeRunTested(treeA, o));
    const b = hashOf(mintTreeRunTested(treeB, o));
    const c = hashOf(mintTreeRunTested(treeC, o));

    assert.notEqual(a, b, "distinct tree bytes must not share an evidenceHash");
    assert.notEqual(b, c);
    assert.notEqual(a, c);
    // Each equals the digest-bound hash, and none equals the summary-only hash.
    assert.notEqual(a, summaryHash, "the tree bytes are decisive — not merely the run summary");
    assert.notEqual(b, summaryHash);
    assert.notEqual(c, summaryHash);
  });

  it("the SAME tree re-run keeps the stamp (byte-identical) and says so", () => {
    const p = project([{ path: "src/generated/a.ts", source: "export function alpha() { return 1; }" }]);
    const first = mintTreeRunTested(p, outcome());
    const again = mintTreeRunTested(first, outcome());
    assert.equal(hashOf(again), hashOf(first));
    assert.equal(again.lastTest, first.lastTest, "the recorded stamp is not rewritten for the same tree");
    assert.ok((again.logs ?? []).some((l) => l.event === "p6.tree.tested.unchanged"));
  });

  it("an EDITED tree refreshes the hash — never keeps a stale one", () => {
    const p = project([{ path: "src/generated/a.ts", source: "export function alpha() { return 1; }" }]);
    const first = mintTreeRunTested(p, outcome());
    const edited = { ...first, generatedTree: (first.generatedTree ?? []).map((f) => ({ ...f, source: f.source + "\n// edit" })) } as Project;
    const refreshed = mintTreeRunTested(edited, outcome());
    assert.notEqual(hashOf(refreshed), hashOf(first));
    assert.ok((refreshed.logs ?? []).some((l) => l.event === "p6.tree.tested.refreshed"));
  });

  it("legacy byte-compatibility: a project with NO generatedTree keeps the summary-only hash", () => {
    const legacy = mintTreeRunTested(project(), outcome());
    assert.equal(hashOf(legacy), String(fnv1a(treeRunTestedEvidence(outcome()).summary)));
  });
});

// ---------------------------------------------------------------------------
// PR-31 — the machine acceptance aggregate (design §4.8 Option A)
// ---------------------------------------------------------------------------

const stamp = (hash: string) => ({
  ok: true,
  detail: "tree-run green",
  label: "tested",
  evidenceHash: hash,
});

const evidenced = (brief: string, hash: string) => ({
  id: brief,
  name: brief,
  lastTest: stamp(hash),
});

describe("PR-31 — machine acceptance aggregate (never mints a human stamp)", () => {
  it("readMachineEvidence: a persisted machine stamp reads ok under the machine seat", () => {
    const read = readMachineEvidence(evidenced("bakery", "hash-1"));
    assert.equal(read.ok, true);
    if (read.ok) {
      assert.equal(read.evidence.seat, MACHINE_ACCEPTANCE_SEAT);
      assert.equal(read.evidence.label, "tested");
      assert.equal(read.evidence.evidenceHash, "hash-1");
      assert.equal(read.evidence.brief, "bakery");
    }
  });

  it("readMachineEvidence refuses absent / non-tested / hollow / human-seat records", () => {
    assert.equal(readMachineEvidence(null).ok, false);
    assert.equal(readMachineEvidence({}).ok, false);
    assert.equal(readMachineEvidence({ lastTest: { ok: true, label: "untested" } }).ok, false);
    assert.equal(readMachineEvidence({ lastTest: { ok: false, label: "tested", detail: "x", evidenceHash: "h" } }).ok, false);
    assert.equal(readMachineEvidence({ lastTest: { ok: true, label: "tested", detail: "", evidenceHash: "h" } }).ok, false);
    assert.equal(readMachineEvidence({ lastTest: { ok: true, label: "tested", detail: "x", evidenceHash: "" } }).ok, false);
    const human = readMachineEvidence({ id: "x", lastTest: { ...stamp("h"), decidedBy: "human" } });
    assert.equal(human.ok, false);
    if (!human.ok) assert.equal(human.reason, ACCEPTANCE_REFUSAL.humanSeat);
  });

  it("empty fleet ⇒ false, machine-attributed, fail-closed", () => {
    const a = fleetAcceptanceFromProjects([]);
    assert.equal(a.autonomousFactoryV2, false);
    assert.equal(a.decidedBy, "machine");
    assert.equal(a.seat, MACHINE_ACCEPTANCE_SEAT);
    assert.equal(a.evidenced, 0);
    assert.ok(a.reasons.length > 0);
  });

  it("one genuinely-evidenced brief satisfies the default floor (machine-only)", () => {
    const a = fleetAcceptanceFromProjects([evidenced("bakery", "hash-1")]);
    assert.equal(a.autonomousFactoryV2, true);
    assert.deepEqual(a.accepted, ["bakery"]);
    assert.deepEqual(a.reasons, []);
    assert.equal(a.forgedHumanStamp, false);
    assert.equal(a.evidenceHashCollision, false);
  });

  it("HOSTILE: a non-evidenced machine claim coerces false (no stamp ⇒ no reading)", () => {
    // A brief with no persisted verdict at all.
    const a = fleetAcceptanceFromProjects([{ id: "bakery", name: "bakery" }]);
    assert.equal(a.autonomousFactoryV2, false);
    assert.equal(a.evidenced, 0);
    assert.equal(a.refused.length, 1);
    // A roll-up claim (boolean) with no evidence cannot mint the reading.
    const b = fleetAcceptanceFromProjects([{ id: "x", autonomousFactoryV2: true } as unknown]);
    assert.equal(b.autonomousFactoryV2, false);
  });

  it("HOSTILE: a FORGED decidedBy:'human' still fails — refused, never laundered", () => {
    const forged = {
      id: "forged",
      lastTest: { ...stamp("hash-x"), decidedBy: "human" },
    };
    const a = fleetAcceptanceFromProjects([forged]);
    assert.equal(a.autonomousFactoryV2, false, "a human claim is not machine evidence");
    assert.equal(a.forgedHumanStamp, true);
    assert.equal(a.decidedBy, "machine", "the aggregate can only attribute a machine");
    assert.deepEqual(a.accepted, []);
    // A human SEAT (not just decidedBy) is refused the same way.
    assert.equal(fleetAcceptanceFromProjects([{ id: "s", lastTest: { ...stamp("h"), seat: "human" } }]).autonomousFactoryV2, false);
  });

  it("PROVENANCE: accepted evidence is machine-seated; the aggregate never emits 'human'", () => {
    const a = fleetAcceptanceFromProjects([evidenced("a", "h1"), evidenced("b", "h2")]);
    assert.equal(a.decidedBy, "machine");
    assert.equal(a.seat, MACHINE_ACCEPTANCE_SEAT);
    // Re-read each accepted brief's evidence and assert the seat/decidedBy are machine.
    for (const brief of a.accepted) {
      const read = readMachineEvidence(evidenced(brief, brief === "a" ? "h1" : "h2"));
      assert.equal(read.ok, true);
      if (read.ok) {
        assert.equal(read.evidence.seat, MACHINE_ACCEPTANCE_SEAT);
        assert.notEqual(read.evidence.seat, "human");
      }
    }
    assert.equal(a.forgedHumanStamp, false);
  });

  it("BF-6: a shared evidenceHash across two distinct briefs is a hard refusal", () => {
    const a = fleetAcceptanceFromProjects([evidenced("flower", "761559975"), evidenced("scheduler", "761559975")]);
    assert.equal(a.evidenceHashCollision, true);
    assert.equal(a.autonomousFactoryV2, false, "a shared hash does not identify a tree");
    assert.deepEqual(a.accepted, []);
    assert.ok(a.refused.every((r) => r.reason === ACCEPTANCE_REFUSAL.duplicateHash));
  });

  it("the floor is a real threshold: required > evidenced refuses", () => {
    const two = [evidenced("a", "h1"), evidenced("b", "h2")];
    assert.equal(fleetAcceptanceFromProjects(two, { required: 2 }).autonomousFactoryV2, true);
    const short = fleetAcceptanceFromProjects(two, { required: FLEET_ACCEPTANCE_MIN });
    assert.equal(short.autonomousFactoryV2, false);
    assert.equal(short.required, FLEET_ACCEPTANCE_MIN);
    // A caller cannot pass 0 to force a pass.
    assert.equal(fleetAcceptanceFromProjects(two, { required: 0 }).required, 1);
  });

  it("the HUMAN door is untouched: human-approved fixtures alone never satisfy V2", () => {
    // A project with a human-approved acceptance record but NO machine stamp.
    const humanOnly = {
      id: "human-only",
      acceptanceFixtures: [{ id: "fx", approval: "approved", decidedBy: "human" }],
    };
    const a = fleetAcceptanceFromProjects([humanOnly]);
    assert.equal(a.autonomousFactoryV2, false, "the machine reading never rides the human door");
    assert.equal(a.evidenced, 0);
  });
});

// ---------------------------------------------------------------------------
// PR-32 — fleet metrics + falsifiable alarms
// ---------------------------------------------------------------------------

describe("PR-32 — fleet metrics (spend never fabricated)", () => {
  it("aggregates tokens/calls/cache/rubric and ALWAYS reports estimatedCostUsd:null", () => {
    const m = fleetMetrics([
      { brief: "a", keyed: true, chunks: 3, tokens: 1000, calls: 10, cachedPromptTokens: 400, rubricScore: 12, evidenceHash: "h1" },
      { brief: "b", keyed: true, chunks: 2, tokens: 500, calls: 5, cachedPromptTokens: 0, rubricScore: 8, evidenceHash: "h2" },
    ]);
    assert.equal(m.runs, 2);
    assert.equal(m.keyedRuns, 2);
    assert.equal(m.tokens, 1500);
    assert.equal(m.calls, 15);
    assert.equal(m.cachedPromptTokens, 400);
    assert.equal(m.cacheObserved, true, "a keyed ≥2-chunk run with a hit proves the cache works");
    assert.equal(m.rubricMean, 10);
    assert.equal(m.uniqueEvidenceHashes, 2);
    assert.equal(m.estimatedCostUsd, null, "spend is never fabricated");
    // A hostile input cost estimate is ignored by the metric.
    assert.equal(fleetMetrics([{ estimatedCostUsd: 0.82 }]).estimatedCostUsd, null);
  });

  it("rubricMean is null when nothing is scored (never a fabricated 0)", () => {
    assert.equal(fleetMetrics([{ brief: "a" }]).rubricMean, null);
    assert.equal(fleetMetrics([]).rubricMean, null);
  });
});

describe("PR-32 — threshold alarms are falsifiable", () => {
  it("cache-cold trips on a keyed ≥2-chunk run with cachedPromptTokens===0", () => {
    const cold = fleetAlarms([{ brief: "a", keyed: true, chunks: 2, cachedPromptTokens: 0, calls: 3 }]);
    assert.equal(cold.cacheCold.tripped, true);
    assert.equal(cold.tripped, true);
    const warm = fleetAlarms([{ brief: "a", keyed: true, chunks: 2, cachedPromptTokens: 100, calls: 3 }]);
    assert.equal(warm.cacheCold.tripped, false);
    // Keyless or <2 chunks is not the alarm's case.
    assert.equal(fleetAlarms([{ brief: "a", keyed: false, chunks: 2, cachedPromptTokens: 0 }]).cacheCold.tripped, false);
    assert.equal(fleetAlarms([{ brief: "a", keyed: true, chunks: 1, cachedPromptTokens: 0 }]).cacheCold.tripped, false);
  });

  it("synthesis-calls trips above the per-run cap", () => {
    const cap = FLEET_ALARM_THRESHOLDS.synthesisCalls.perRunMax;
    assert.equal(fleetAlarms([{ brief: "a", calls: cap }]).synthesisCalls.tripped, false);
    assert.equal(fleetAlarms([{ brief: "a", calls: cap + 1 }]).synthesisCalls.tripped, true);
  });

  it("rubric-below-target trips under the mean floor; untripped at/above it", () => {
    assert.equal(fleetAlarms([{ brief: "a", rubricScore: 4 }]).rubricBelowTarget.tripped, true);
    assert.equal(fleetAlarms([{ brief: "a", rubricScore: 10 }]).rubricBelowTarget.tripped, false);
    assert.equal(fleetAlarms([{ brief: "a" }]).rubricBelowTarget.tripped, false, "no scores ⇒ nothing to compare");
  });

  it("evidence-hash-collision trips when two briefs share a hash", () => {
    const tripped = fleetAlarms([
      { brief: "flower", evidenceHash: "761559975" },
      { brief: "scheduler", evidenceHash: "761559975" },
    ]);
    assert.equal(tripped.evidenceHashCollision.tripped, true);
    assert.equal(tripped.tripped, true);
    assert.equal(fleetAlarms([{ brief: "a", evidenceHash: "h1" }, { brief: "b", evidenceHash: "h2" }]).evidenceHashCollision.tripped, false);
  });

  it("spend-fabricated trips on any non-null estimatedCostUsd (honesty alarm)", () => {
    assert.equal(fleetAlarms([{ brief: "a", estimatedCostUsd: 0.82 }]).spendFabricated.tripped, true);
    assert.equal(fleetAlarms([{ brief: "a", estimatedCostUsd: null }]).spendFabricated.tripped, false);
    assert.equal(fleetAlarms([{ brief: "a" }]).spendFabricated.tripped, false);
  });
});

// ---------------------------------------------------------------------------
// fixes/346-X5 — the armed chunk-resample telemetry + the variance reading.
// The detail strings below are VERBATIM rows read from the persisted
// default-check journal (`testruns/default-check/<slug>/build.json`
// `logs[event === "p6.synthesis.candidates"]`) this session — not fabricated.
// ---------------------------------------------------------------------------

const ROW_WIN_FIRST =
  "chunk 1/10 (fail-fast) · candidates 2 · winner 1 · candidate 1: selected — pre-seal typecheck";
const ROW_RESAMPLED =
  'chunk 2/10 · candidates 2 · winner 2 · candidate 1: rejected — RT_E_VALIDATION: typeSignature functions not exported: computeLineTotal | candidate 2: selected';
const ROW_BOTH_REJECTED =
  "chunk 3/10 (fail-fast) · candidates 2 · winner none · candidate 1: rejected — structure refused (RT_E_VALIDATION) | candidate 2: rejected — tsc refused (src/generated/get-low-stock-products.ts(57,3): error TS2719)";

describe("fixes/346-X5 — parseCandidateJournalRow (report the journal, invent nothing)", () => {
  it("parses a winner-first row: the armed budget is named, ONE candidate was tried", () => {
    const e = parseCandidateJournalRow(ROW_WIN_FIRST);
    assert.ok(e);
    assert.equal(e.failFast, true);
    assert.equal(e.unit, "chunk 1/10 (fail-fast)");
    assert.equal(e.requested, 2);
    assert.equal(e.tried, 1, "lazy/Pareto — the first sample passed, so no resample was bought");
    assert.equal(e.winner, 1);
  });

  it("parses a resampled row: candidate 2 selected after candidate 1 was refused", () => {
    const e = parseCandidateJournalRow(ROW_RESAMPLED);
    assert.ok(e);
    assert.equal(e.failFast, false);
    assert.equal(e.unit, "chunk 2/10");
    assert.equal(e.requested, 2);
    assert.equal(e.tried, 2);
    assert.equal(e.winner, 2);
  });

  it("parses a both-rejected row: winner is null, both candidates were tried", () => {
    const e = parseCandidateJournalRow(ROW_BOTH_REJECTED);
    assert.ok(e);
    assert.equal(e.tried, 2);
    assert.equal(e.winner, null);
  });

  it("a `not produced` slot is not a tried candidate (no keyed call to count)", () => {
    const e = parseCandidateJournalRow(
      "chunk 7/8 · candidates 2 · winner none · candidate 1: not produced | candidate 2: rejected — RT_E_VALIDATION",
    );
    assert.ok(e);
    assert.equal(e.tried, 1);
    assert.equal(e.requested, 2);
  });

  it("fixes/346-X1 (I-A consumer): parses the ` · tokens <int>` suffix; a legacy row stays null", () => {
    const withTokens = parseCandidateJournalRow(`${ROW_RESAMPLED} · tokens 1234`);
    assert.ok(withTokens);
    assert.equal(withTokens.extraTokens, 1234);
    assert.equal(withTokens.winner, 2, "the suffix does not disturb the parsed winner");
    // A row without the suffix (every campaign #1/#2 row) stays the honest null.
    assert.equal(parseCandidateJournalRow(ROW_RESAMPLED)?.extraTokens, null);
    // A non-integer suffix is not a token figure — never guessed.
    assert.equal(parseCandidateJournalRow(`${ROW_RESAMPLED} · tokens x`)?.extraTokens, null);
  });

  it("refuses anything that is not a candidates row (fail-closed, never guessed)", () => {
    assert.equal(parseCandidateJournalRow(null), null);
    assert.equal(parseCandidateJournalRow(undefined), null);
    assert.equal(parseCandidateJournalRow(""), null);
    assert.equal(parseCandidateJournalRow("chunk 1/10 · attempt 1 · 240000ms · ok"), null);
    assert.equal(parseCandidateJournalRow({ detail: ROW_WIN_FIRST }), null);
  });
});

describe("fixes/346-X5 — the armed resample's usage, WITH vs WITHOUT the resample", () => {
  it("WITH the resample: requested/tried/winner + the extra keyed calls are counted", () => {
    const m = fleetMetrics([
      { brief: "bfo", keyed: true, synthesisCandidates: [ROW_WIN_FIRST, ROW_RESAMPLED, ROW_BOTH_REJECTED] },
    ]);
    assert.equal(m.resample.runs, 1);
    assert.equal(m.resample.events, 3);
    assert.equal(m.resample.candidatesRequested, 6, "3 rows × the 2-candidate budget");
    assert.equal(m.resample.candidatesTried, 5, "1 + 2 + 2 evaluated candidates");
    assert.equal(m.resample.winners, 2);
    assert.equal(m.resample.noWinner, 1, "both-rejected is recorded, not hidden");
    assert.equal(m.resample.extraKeyedCalls, 2, "Σ max(0, tried−1): 0 + 1 + 1");
    assert.equal(m.resample.extraTokens, null, "the journal records no token usage per candidate");
    assert.equal(m.resample.tokenAccounting, "not-recorded-in-journal");
    assert.equal(m.resample.byRun.length, 1);
    assert.deepEqual(m.resample.byRun[0].winnersByEvent, [1, 2, null]);
  });

  it("fixes/346-X1: the ` · tokens <int>` suffix is summed into extraTokens (accounting:'journal')", () => {
    const withTokens = resampleUsage([
      { brief: "bfo", keyed: true, synthesisCandidates: [`${ROW_WIN_FIRST} · tokens 100`, `${ROW_RESAMPLED} · tokens 250`] },
    ]);
    assert.equal(withTokens.extraTokens, 350);
    assert.equal(withTokens.tokenAccounting, "journal");
    assert.equal(withTokens.byRun[0].extraTokens, 350);
    // Mixed: a recorded row keeps the reading non-null even with a legacy sibling.
    const mixed = resampleUsage([
      { brief: "bfo", keyed: true, synthesisCandidates: [ROW_WIN_FIRST, `${ROW_RESAMPLED} · tokens 7`] },
    ]);
    assert.equal(mixed.extraTokens, 7);
    assert.equal(mixed.tokenAccounting, "journal");
    // A run with no recorded suffix still reports null per-run and fleet-wide.
    const legacy = resampleUsage([{ brief: "bfo", keyed: true, synthesisCandidates: [ROW_WIN_FIRST, ROW_RESAMPLED] }]);
    assert.equal(legacy.extraTokens, null);
    assert.equal(legacy.tokenAccounting, "not-recorded-in-journal");
    assert.equal(legacy.byRun[0].extraTokens, null);
  });

  it("WITHOUT the resample (the P6_SYNTH_CANDIDATES=1 opt-out shape): zero events, zero extra calls", () => {
    const optOut = fleetMetrics([{ brief: "bfo", keyed: true, synthesisCandidates: [] }]);
    assert.equal(optOut.resample.runs, 0);
    assert.equal(optOut.resample.events, 0);
    assert.equal(optOut.resample.candidatesRequested, 0);
    assert.equal(optOut.resample.candidatesTried, 0);
    assert.equal(optOut.resample.extraKeyedCalls, 0);
    assert.equal(optOut.resample.extraTokens, null, "no resample ⇒ no token claim either");
    // An absent field is the same honest empty reading.
    const absent = fleetMetrics([{ brief: "bfo", keyed: true }]);
    assert.deepEqual(absent.resample, optOut.resample);
    assert.equal(fleetMetrics([]).resample.events, 0);
    // A row whose details are all unparseable counts as no resample, never a guessed one.
    assert.equal(resampleUsage([{ brief: "x", synthesisCandidates: ["junk", null, 7] }]).events, 0);
  });
});

describe("fixes/346-X5 — the variance reading (never one lucky sample)", () => {
  it("records per-sample workingApp and the sample count; the rate follows the samples", () => {
    // The final keyed samples disagreed on the SAME briefs — mobile-companion
    // passed in default-check and failed in the tuning sample.
    const m = fleetMetrics([
      { brief: "mobile-companion", workingApp: true },
      { brief: "mobile-companion", workingApp: false },
      { brief: "office-stock-tracker", workingApp: true },
      { brief: "office-stock-tracker", workingApp: false },
      { brief: "bakery-website", workingApp: true },
      { brief: "no-verdict-yet" },
    ]);
    assert.equal(m.workingAppSamples, 5, "only rows carrying a boolean verdict score");
    assert.equal(m.workingAppPass, 3);
    assert.equal(m.workingAppRate, 3 / 5);
    assert.equal(m.workingAppByBrief.length, 5, "per-sample, not collapsed to one row per brief");
    assert.deepEqual(m.workingAppByBrief[0], { brief: "mobile-companion", workingApp: true });
    assert.deepEqual(m.workingAppByBrief[1], { brief: "mobile-companion", workingApp: false });
  });

  it("an absent verdict is NOT scored — the rate is null, never a fabricated 0 or 1", () => {
    const m = fleetMetrics([{ brief: "a", keyed: true }, { brief: "b", workingApp: null }]);
    assert.equal(m.workingAppSamples, 0);
    assert.equal(m.workingAppPass, 0);
    assert.equal(m.workingAppRate, null);
    assert.deepEqual(m.workingAppByBrief, []);
  });

  it("fleetAcceptance reports the sample count + evidenced rate (the variance denominator)", () => {
    const empty = fleetAcceptanceFromProjects([]);
    assert.equal(empty.sampleCount, 0);
    assert.equal(empty.evidencedRate, null);
    const one = fleetAcceptanceFromProjects([evidenced("a", "h1")]);
    assert.equal(one.sampleCount, 1);
    assert.equal(one.evidencedRate, 1);
    const mixed = fleetAcceptanceFromProjects([evidenced("a", "h1"), { id: "b" }]);
    assert.equal(mixed.sampleCount, 2);
    assert.equal(mixed.evidenced, 1);
    assert.equal(mixed.evidencedRate, 0.5, "one of two samples evidenced — the 1-sample reading is not overstated");
  });
});

// ---------------------------------------------------------------------------
// 2026-10-05 product-quality lane — `FleetAcceptance.productQuality` is a NEW,
// additive, byte-derived reading. It must never change the machine acceptance
// reading or any existing field.
// ---------------------------------------------------------------------------
describe("2026-10-05 — FleetAcceptance.productQuality (additive, never touches the bar)", () => {
  it("is zeroed for an empty fleet and does not change autonomousFactoryV2", () => {
    const empty = fleetAcceptanceFromProjects([]);
    assert.equal(empty.productQuality.projects, 0);
    assert.equal(empty.autonomousFactoryV2, false, "an empty fleet still refuses");
    const one = fleetAcceptanceFromProjects([evidenced("bakery", "h1")]);
    assert.equal(one.autonomousFactoryV2, true, "evidence alone still satisfies the machine reading");
    assert.equal(one.productQuality.projects, 1);
    assert.equal(
      one.productQuality.withTree,
      0,
      "the evidenced row carries no tree bytes — it is not counted as a tree",
    );
  });

  it("reads a tree-bearing record's real product signals beside the acceptance reading", () => {
    const withTree = {
      id: "tree-brief",
      brief: "ordering website",
      generatedTree: [
        { path: "index.html", source: "<html></html>" },
        { path: "src/main.tsx", source: 'import { RouterProvider } from "@tanstack/react-router";' },
        { path: "src/pages/menu.tsx", source: "export function MenuPage() { return <div/>; }" },
        { path: "src/styles.css", source: ".x { }" },
      ],
    };
    const a = fleetAcceptanceFromProjects([evidenced("full", "h1"), withTree]);
    assert.equal(a.productQuality.projects, 2);
    assert.equal(a.productQuality.withTree, 1);
    assert.equal(a.productQuality.quality, 0, "no ordering flow/form ⇒ not product-quality");
    assert.equal(a.autonomousFactoryV2, true, "the evidenced row alone meets the default floor");
    assert.equal(a.evidenced, 1, "the tree-bearing row has no evidence stamp and is not counted");
  });

  it("a record with a real empty tree trips the empty-tree count", () => {
    const a = fleetAcceptanceFromProjects([{ id: "empty", brief: "x", generatedTree: [] }]);
    assert.equal(a.productQuality.emptyTree, 1);
    assert.equal(a.productQuality.withTree, 0);
  });
});

// ---------------------------------------------------------------------------
// 2026-10-06 � item 2 (actionable evidence class) + item 4 (stage wiring). The
// fleet acceptance aggregate now carries the gate-evidence qualification and the
// P0�P12 stage-wiring census of the presented record, so a green seal whose
// evidence is presence-only is visibly qualified.
// ---------------------------------------------------------------------------
describe("2026-10-06 � gate-evidence qualification + stage wiring ride the fleet reading", () => {
  const record = (extra: Record<string, unknown>) => ({ id: "r1", brief: "x", ...extra });

  it("a green gate resting on artifact-presence only is qualified weak with RT_E_CLAIM_UNVERIFIED", () => {
    const g = gateEvidenceOfProject(
      record({
        phases: [{ id: 3, status: "complete" }],
        artifacts: [{ id: "a", phase: 3, kind: "mcp", title: "mcp", body: "contract" }],
      }),
    );
    assert.deepEqual(g.weakPhases, [3]);
    assert.ok(g.phases[0].classes.includes("artifact-presence"));
    assert.match(g.phases[0].note, /NON-EXECUTED/);
    assert.match(g.note, /RT_E_CLAIM_UNVERIFIED/);
  });

  // A3-E8 (2026-10-06, REPLACES the pre-fix pin): the engine's DETERMINISTIC
  // TEMPLATE self-test is not the product running, so a green P6 gate resting
  // on it is NON-executed evidence and must be qualified WEAK. The old pin
  // called `executed-self-test` executed evidence, which let a green gate that
  // never left the floor read as an executed pass.
  it("a green gate whose only executed arm is the deterministic template self-test is WEAK", () => {
    const g = gateEvidenceOfProject(
      record({
        phases: [{ id: 6, status: "complete" }],
        generatedSource: "export const x = 1;",
        lastTest: { ok: true, detail: "engine self-test ok" },
      }),
    );
    const p6 = g.phases.find((x) => x.phase === 6);
    assert.ok(p6, "P6 is surfaced");
    assert.equal(p6!.weak, true, "the engine template self-test is NOT product execution");
    assert.ok(p6!.classes.includes("executed-self-test"), "the class is still reported");
    assert.ok(g.weakPhases.includes(6));
    assert.match(g.note, /RT_E_CLAIM_UNVERIFIED/);
  });

  it("a gate whose met evidence includes a real executed tree-run is NOT weak", () => {
    const g = gateEvidenceOfProject(
      record({
        phases: [{ id: 6, status: "complete" }],
        generatedSource: "export const x = 1;",
        artifacts: [{ id: "c", phase: 6, kind: "code", title: "code", body: "x" }],
        lastTest: { ok: true, detail: "tree-run green", label: "tested", evidenceHash: "abc" },
      }),
    );
    const p6 = g.phases.find((x) => x.phase === 6)!;
    assert.equal(p6.weak, false, "executed tree-run spec tests are executed evidence");
    assert.ok(p6.classes.includes("executed-tree-tests"));
  });

  it("a non-object record yields the empty gate-evidence reading (fail-closed, never a fabricated pass)", () => {
    const g = gateEvidenceOfProject(null);
    assert.deepEqual(g.phases, []);
    assert.deepEqual(g.weakPhases, []);
    assert.match(g.note, /no complete phase/);
  });

  it("stageWiringReading + gateEvidence are carried on FleetAcceptance for the first record", () => {
    const a = fleetAcceptanceFromProjects([
      record({
        phases: [{ id: 0, status: "complete" }],
        artifacts: [{ id: "a", phase: 0, kind: "scorecard", title: "s", body: "body" }],
      }),
    ]);
    assert.ok(a.stageWiring, "the wiring census rides the aggregate");
    assert.equal(a.stageWiring.rows.length, 13);
    assert.ok(a.gateEvidence, "the gate-evidence reading rides the aggregate");
    assert.deepEqual(a.gateEvidence.weakPhases, [0], "P0's gate is presence-only ? weak");
  });

  it("stageWiringReading flags a complete phase that produced no deliverable (coded, never silent)", () => {
    const w = stageWiringReading(
      record({
        phases: [{ id: 0, status: "complete" }, { id: 1, status: "complete" }],
        artifacts: [{ id: "g0", phase: 0, kind: "gate", title: "gate", body: "x" }],
      }),
    );
    assert.equal(w.ok, false);
    assert.equal(w.failures.find((f) => f.phase === 0)?.code, "RT_E_PLAN_UNDERPRODUCED");
  });
});
