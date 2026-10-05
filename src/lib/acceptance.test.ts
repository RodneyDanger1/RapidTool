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
  readMachineEvidence,
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
