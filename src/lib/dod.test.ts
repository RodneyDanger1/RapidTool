// W359 PAUSED 2026-10-15 - work in progress; see wave_plans/W359/HANDOFF.md for what landed, what is half-done and what is left.
// ---------------------------------------------------------------------------
// dod.test.ts â€” W48 / 334-3 "Transit": the P6 DoD probe vs an UNVERIFIED tree.
//
// The DoD registry lives in dod.ts; its long-standing behavioural tests live in
// gates.test.ts. This file pins the W48 T1b decision that gates.test.ts cannot:
// whether an emitted tree whose DECLARED `typecheck`/`build` scripts never ran
// satisfies `p6-test` / `p6-verified`, and where the honest line sits.
//
// Run: node --experimental-strip-types --test src/lib/dod.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  archProductComplete,
  archTrace,
  briefDeliveryKind,
  classifyModuleSource,
  gateArtifact,
  liveResearchAttemptUnavailable,
  missingOracleCaseIds,
  oracleToCaseSeeds,
  productSurfaceKindOf,
  productSurfaceTrace,
  recordGateInto,
  runGate,
  sealedWithFailures,
} from "./dod.ts";
import { runUntilGate } from "./headless.ts";
import { mintTreeRunTested } from "./codegen.server.ts";
import { deliveryKindOf, emptyProject } from "./engine.ts";
import {
  briefFitCoverage,
  briefFitSubstancePasses,
  briefNounCore,
  briefNounHits,
  buildPhase6Module,
  identifierHits,
  implementationIdentifierHits,
  maskModuleReexports,
} from "./sandbox.ts";
import type { HitlDecision, OracleTest, PhaseId, Project } from "./types.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";

const base = (): Project => emptyProject({ name: "Dod334", brief: "A dispatch board for field service." });

/**
 * A green tree-run outcome that EXECUTED its spec(s) â€” the shape the P6 journey
 * feeds `mintTreeRunTested` â€” but whose declared package.json scripts did not
 * run. `declaredScriptsVerified:false` + `unverifiedDeclaredScripts` is exactly
 * what compile-check.server's `treeRun` reports for a fresh, uninstalled tree.
 */
const greenUnverifiedOutcome = (over: Partial<TreeRunOutcome> = {}): TreeRunOutcome =>
  ({
    ok: true,
    dir: "C:/scratch/rt-dod",
    compile: { ok: true, dir: "C:/scratch/rt-dod", checked: 2, passed: 2, failed: 0, skipped: 0, verdicts: [] },
    tests: [
      {
        file: "tests/oracle.spec.ts",
        compile: { file: "tests/oracle.spec.ts", ok: true, verdict: null },
        tests: { pass: 3, fail: 0 },
        run: "pass",
      },
    ],
    run: { kind: "ui-shell", run: "skip", detail: "UI shell â€” not executable headless" },
    declaredScriptsVerified: false,
    unverifiedDeclaredScripts: ["typecheck", "build"],
    ...over,
  }) as unknown as TreeRunOutcome;

const met = (p: Project, id: string): boolean => !runGate(p, 6).unmet.some((g) => g.id === id);

describe("W48 / 334-3 (T1b) â€” p6-test / p6-verified vs an unverified declared toolchain", () => {
  it("a GREEN executed tree-run whose declared typecheck/build never ran still mints the tested verdict the P6 DoD requires", () => {
    const minted = mintTreeRunTested(base(), greenUnverifiedOutcome());
    const lt = minted.lastTest as { label?: string; detail?: string; evidenceHash?: string } | null;
    assert.equal(lt?.label, "tested", "an executed green tree-run still promotes to the tested verdict");
    assert.match(String(lt?.detail), /tree-run green/, "the stamp records the executed run, not a bare label");

    // The honest line: the criteria measure the EXECUTED self-test / machine-run
    // verdict over the tree's own specs â€” which genuinely ran green â€” so they are
    // met. They do NOT attest the declared project toolchain.
    assert.equal(met(minted, "p6-test"), true, "the executed self-test passed");
    assert.equal(met(minted, "p6-verified"), true, "a machine run promoted a genuinely executed tested verdict");
  });

  it("the DoD verdict is deliberately blind to declaredScriptsVerified â€” the limit is carried by the artifact/envelope, not folded into a criterion", () => {
    // Same green, executed run; the ONLY difference is the declared-script state.
    const verified = mintTreeRunTested(
      base(),
      greenUnverifiedOutcome({ declaredScriptsVerified: true, unverifiedDeclaredScripts: undefined }),
    );
    const unverified = mintTreeRunTested(base(), greenUnverifiedOutcome());
    const p6Ids = (p: Project): string[] => runGate(p, 6).unmet.map((g) => g.id).filter((id) => id.startsWith("p6-"));
    assert.deepEqual(
      p6Ids(unverified),
      p6Ids(verified),
      "the declared-toolchain state must not change any P6 DoD outcome â€” requiring it would be unsatisfiable on a fresh tree and would block the P6 mint",
    );
    // 2026-10-06 correction (concurrent lane A1-E13): the tested stamp NOW
    // EXPOSES the declared-toolchain state (`declaredScriptsVerified`) so the
    // limit rides the artifact/envelope loudly. The pin is that it never reaches
    // a criterion: the identical p6- outcome above holds while the stamp's own
    // field differs between the two fixtures. The pre-A1-E13 assertion that the
    // field was absent is therefore superseded â€” it pinned the old shape, not
    // the honesty property.
    const declaredField = (p: Project): unknown =>
      (p.lastTest as { declaredScriptsVerified?: unknown } | null)?.declaredScriptsVerified;
    assert.equal(declaredField(unverified), false, "the stamp exposes declaredScriptsVerified=false (A1-E13)");
    assert.equal(declaredField(verified), true, "â€¦and true for the verified fixture");
    assert.deepEqual(
      p6Ids(unverified),
      p6Ids(verified),
      "â€¦while the P6 DoD verdict stays blind to it â€” the limit is carried by the envelope, not a criterion",
    );
  });

  it("a HOLLOW 'tested' stamp (not green, or recording no detail) never satisfies p6-verified", () => {
    const withLastTest = (lt: { ok: boolean; detail: string; label?: string; evidenceHash?: string }): Project =>
      ({ ...base(), lastTest: lt }) as unknown as Project;
    assert.equal(
      met(withLastTest({ ok: false, detail: "x", label: "tested", evidenceHash: "h" }), "p6-verified"),
      false,
      "a verdict that is not ok is not a tested verdict",
    );
    assert.equal(
      met(withLastTest({ ok: true, detail: "", label: "tested", evidenceHash: "h" }), "p6-verified"),
      false,
      "a stamp recording no run detail is hollow â€” never verification",
    );
    assert.equal(
      met(withLastTest({ ok: true, detail: "tree-run green: 1 spec file(s) pass", label: "tested", evidenceHash: "h" }), "p6-verified"),
      true,
      "control: a green, detailed, hash-carrying verdict is met",
    );
  });
});

// ---------------------------------------------------------------------------
// 339-3 (W53) â€” p6-brief-fit floor honesty + satisfiability.
//
// The keyless deterministic floor can NEVER pass p6-brief-fit: the placeholder
// module implements phase bookkeeping only and carries no brief vocabulary. So
// a RED criterion must NAME the state the project is in â€” the deterministic
// floor (no keyed synthesis ran, or a refused synthesis that kept the floor)
// versus a real run that simply dropped the brief's nouns â€” instead of leaving
// a human with a bare criterion. The other satisfiability half (a legitimate
// brief-faithful module passes) is pinned here too.
// ---------------------------------------------------------------------------
const FIT_BRIEF = "A dispatch board for field service: dispatch techs, board jobs, service parts.";

const floorProject = (over: Partial<Project> = {}): Project => ({
  ...emptyProject({ name: "FloorFit", brief: FIT_BRIEF }),
  generatedSource: buildPhase6Module({ name: "FloorFit", jobs: ["dispatch"], rejectionNote: null, variant: 0 }),
  lastTest: { ok: true, detail: "tests.pass" },
  phases: [{ id: 6 as PhaseId, status: "complete" }],
  ...over,
});

const p6BriefFitUnmet = (p: Project) => runGate(p, 6).unmet.find((g) => g.id === "p6-brief-fit");

describe("339-3 (W53) â€” p6-brief-fit names the floor state and is satisfiable by a real module", () => {
  it("the deterministic floor can never pass p6-brief-fit, and the unmet criterion NAMES that state", () => {
    const item = p6BriefFitUnmet(floorProject());
    assert.ok(item, "the keyless floor fails p6-brief-fit (the placeholder carries no brief vocabulary)");
    assert.match(item!.reason ?? "", /deterministic floor state/);
    assert.match(item!.reason ?? "", /no keyed model synthesis ran/);
    assert.match(
      item!.criterion,
      /deterministic floor state/,
      "the criterion text every consumer reads carries the state, not a bare noun list",
    );
  });

  it("a refused keyed synthesis that kept the floor says the model ran but no cycle was accepted", () => {
    const p = floorProject({
      logs: [
        {
          ts: 1,
          phase: 6 as PhaseId,
          level: "warn",
          event: "p6.synthesis.refused",
          detail: "RT_E_RUNNER_FAILED Â· case payload rejected by harness safety check",
        },
      ],
    });
    const item = p6BriefFitUnmet(p);
    assert.match(item?.reason ?? "", /keyed model synthesis ran but no cycle was accepted/);
    assert.match(item?.reason ?? "", /p6\.synthesis\.refused/);
  });

  it("a non-floor module that dropped the brief's nouns names THAT state, never the floor", () => {
    const p = floorProject({ generatedSource: "export const add = (a, b) => a + b;" });
    const item = p6BriefFitUnmet(p);
    assert.match(item?.reason ?? "", /generated source is missing the brief's required nouns/);
    assert.ok(!/deterministic floor state/.test(item?.reason ?? ""), "a real module is not the floor");
    assert.match(item?.reason ?? "", /core missing \(/, "the state line names the missing core nouns");
  });

  it("keyed tree synthesis that dropped the nouns names the tree state", () => {
    const p = floorProject({
      generatedSource: 'export * from "./generated.ts";',
      generatedTree: [{ path: "src/generated.ts", source: "export const noop = 1;", hash: "h", attempt: 0 }],
    });
    const item = p6BriefFitUnmet(p);
    assert.match(item?.reason ?? "", /keyed tree synthesis ran \(1 file\(s\)\)/);
  });

  it("a legitimate module carrying the brief's nouns as identifiers passes (the other half)", () => {
    // W61 C1: the core bar measures the project-grounded nouns (entities +
    // lattice jobs), so a genuinely brief-faithful module names them all â€”
    // dispatch/board/service plus the grounded tech/parts/dispatcher.
    const p = floorProject({
      generatedSource:
        "export function dispatchBoard() { return 1; }\n" +
        "export function fieldService() { return 2; }\n" +
        "export function dispatcher() { return 3; }\n" +
        "export function techAssignments() { return []; }\n" +
        "export function serviceParts() { return []; }",
    });
    assert.ok(
      !runGate(p, 6).unmet.some((g) => g.id === "p6-brief-fit"),
      "a brief-faithful module satisfies p6-brief-fit",
    );
  });

  it("the recorded gate verdict and its artifact carry the same floor-state vocabulary", () => {
    const recorded = recordGateInto(floorProject(), 6);
    const gate = recorded.phases.find((r) => r.id === 6)?.gate;
    assert.ok(gate, "the P6 gate is recorded");
    assert.ok(
      gate!.unmet.some((u) => /deterministic floor state/.test(u)),
      "the recorded unmet list carries the state",
    );
    const artifact = (recorded.artifacts ?? []).find((a) => a.kind === "gate" && a.phase === 6);
    assert.ok(artifact && /deterministic floor state/.test(artifact.body), "the gate artifact body carries the state");
  });
});

// ---------------------------------------------------------------------------
// 346 L3 (A1-12 enforcement) â€” the browser console's `[seat console]` row.
//
// The console approval is human-class but UNATTESTED (no out-of-band token
// path). These pins fix the DoD routing: a truthfully tagged console row is
// classified (never `tagged-unknown`) and satisfies the p4/p5/p8/p9 `*approved`
// criteria; every hostile variant still fails closed. The failure mode this
// guards is exactly the one the E4 lane hit: without a recognized console seat
// a `[seat console]` tag is `tagged-unknown` and the criteria refuse.
// ---------------------------------------------------------------------------
const consoleApprovalRow = (over: Partial<HitlDecision> = {}): HitlDecision => ({
  id: "hitl-4-console",
  phase: 4 as PhaseId,
  title: "P4 Human approval",
  decision: "approve",
  note: "[seat console] browser console decision",
  decidedBy: "human",
  requestedAt: 1,
  decidedAt: 2,
  decidedVia: {
    action: "hitl.approve",
    resource: "gate:P4",
    reason:
      "console-seat-unattested â€” hitl.approve on gate:P4 under the browser console's human seat; unattested, never token-verified.",
    label: "human/console",
    tokenPath: false,
  },
  ...over,
});

const withDecision = (...rows: HitlDecision[]): Project => ({
  ...emptyProject({ name: "ConsoleSeat346", brief: "A dispatch board." }),
  decisions: rows,
});

const p4ApprovedMet = (p: Project): boolean => !runGate(p, 4).unmet.some((g) => g.id === "p4-approved");
const p5CompleteMet = (p: Project): boolean => !runGate(p, 5).unmet.some((g) => g.id === "p5-complete");

describe("346 L3 (A1-12) â€” a `[seat console]` row is attributed and routed truthfully", () => {
  it("a truthfully tagged console human row satisfies p4-approved (recognized seat, not tagged-unknown)", () => {
    assert.equal(p4ApprovedMet(withDecision(consoleApprovalRow())), true);
  });

  it("the same row satisfies p5-complete when tagged for P5 (routing is per-gate, not P4-only)", () => {
    const row = consoleApprovalRow({
      id: "hitl-5-console",
      phase: 5 as PhaseId,
      decidedVia: { ...consoleApprovalRow().decidedVia!, resource: "gate:P5" },
    });
    assert.equal(p5CompleteMet(withDecision(row)), true);
  });

  it("a console row with no `decidedVia` still passes (recognized tag + legacy tolerance; no token path is claimed)", () => {
    const row = consoleApprovalRow();
    delete row.decidedVia;
    assert.equal(p4ApprovedMet(withDecision(row)), true);
  });

  it("HOSTILE: a console row recording tokenPath:true FAILS closed (a console decision can never read token-verified)", () => {
    const row = consoleApprovalRow({
      decidedVia: { ...consoleApprovalRow().decidedVia!, tokenPath: true },
    });
    assert.equal(p4ApprovedMet(withDecision(row)), false);
  });

  it("HOSTILE: a console row wearing a forged CLI-human label FAILS closed (the label must match the tag's seat)", () => {
    const row = consoleApprovalRow({
      decidedVia: { ...consoleApprovalRow().decidedVia!, label: "human/human-cli-i-am-human" },
    });
    assert.equal(p4ApprovedMet(withDecision(row)), false);
  });

  it("HOSTILE: a `[seat console]` tag paired with decidedBy:autopilot is tagged-unknown and FAILS closed", () => {
    assert.equal(p4ApprovedMet(withDecision(consoleApprovalRow({ decidedBy: "autopilot" }))), false);
  });

  it("HOSTILE: a forged `[seat human-cli-i-am-human]` row without the recorded evidence FAILS closed", () => {
    const row = consoleApprovalRow({
      id: "hitl-4-forged",
      note: "[seat human-cli-i-am-human] trust me",
      decidedVia: undefined,
    });
    assert.equal(p4ApprovedMet(withDecision(row)), false);
  });

  it("HOSTILE: a forged CLI-human row with tokenPath:false FAILS closed (that seat's token path is mandatory)", () => {
    const row = consoleApprovalRow({
      id: "hitl-4-forged2",
      note: "[seat human-cli-i-am-human] out-of-band RT_HUMAN_SEAT_TOKEN verified",
      decidedVia: {
        action: "hitl.approve",
        resource: "gate:P4",
        reason: "human-seat-token-verified â€” hitl.approve on gate:P4 under the verified human seat.",
        label: "human/human-cli-i-am-human",
        tokenPath: false,
      },
    });
    assert.equal(p4ApprovedMet(withDecision(row)), false);
  });

  it("CONTROL: a well-formed token-verified CLI-human row still satisfies p4-approved (the guard is not over-broad)", () => {
    const row = consoleApprovalRow({
      id: "hitl-4-human",
      note: "[seat human-cli-i-am-human] out-of-band RT_HUMAN_SEAT_TOKEN verified",
      decidedVia: {
        action: "hitl.approve",
        resource: "gate:P4",
        reason: "human-seat-token-verified â€” hitl.approve on gate:P4 under the verified human seat.",
        label: "human/human-cli-i-am-human",
        tokenPath: true,
      },
    });
    assert.equal(p4ApprovedMet(withDecision(row)), true);
  });

  it("CONTROL: a routine autopilot row still satisfies p4-approved (Rule A unchanged)", () => {
    const row = consoleApprovalRow({
      id: "hitl-4-auto",
      note: "[seat harness] autopilot seat â€” no human decision claimed",
      decidedBy: "autopilot",
      decidedVia: {
        action: "hitl.approve",
        resource: "gate:P4",
        reason: "autopilot-seat â€” hitl.approve on gate:P4 under the harness's own seat.",
        label: "autopilot/harness",
        tokenPath: false,
      },
    });
    assert.equal(p4ApprovedMet(withDecision(row)), true);
  });
});

// ---------------------------------------------------------------------------
// 346 L6 â€” the P7 `p7-research` waiver: ATTEMPTED-but-unavailable vs never-tried.
//
// The pre-existing waiver read only `meta.liveUnavailable` (the engine live
// layer's stamp). The bare-Node research overlay (`headless.bareNodeLiveOverlay`,
// the `--live` / eval research path) instead records a coded
// `p7.live.research.failed` row and stamps NO meta â€” so a genuine offline
// attempt there stayed RED without ever applying the documented waiver, and the
// project carried a `liveUnavailable`-less record that reads like "we never
// tried". These pins fix the honest distinction: a real attempt whose backend
// was unavailable is waived; a run that never attempted stays RED (the waiver
// is never fabricated â€” see wild-step.test.ts's keyless-floor pin).
// ---------------------------------------------------------------------------
const p7Project = (over: Partial<Project> = {}): Project => ({
  ...emptyProject({ name: "P7Waiver", brief: "A dispatch board for field service." }),
  competitors: [
    { name: "A", class: "tool", strength: "x", gap: "y", source: "illustrative" },
    { name: "B", class: "tool", strength: "x", gap: "y", source: "illustrative" },
  ],
  phases: [{ id: 7 as PhaseId, status: "complete" }],
  ...over,
});

/** The coded row `liveDegradeRow` writes for a failed research backend. */
const researchFailedRow = (
  over: Partial<{ phase: PhaseId; event: string; detail: string }> = {},
): Project["logs"][number] => ({
  ts: 1,
  phase: 7 as PhaseId,
  level: "warn",
  event: "p7.live.research.failed",
  detail:
    "RT_E_RESEARCH_UNAVAILABLE Â· live research failed: Free web search unavailable â€” all providers failed â€” deterministic result used instead",
  ...over,
});

const p7ResearchUnmet = (p: Project) => runGate(p, 7).unmet.find((g) => g.id === "p7-research");

describe("346 L6 â€” p7-research waives a real attempted-but-unavailable live pass, never a fabricated one", () => {
  it("no attempt (deterministic/keyless floor): p7-research stays RED and the criterion stays VERBATIM", () => {
    const p = p7Project();
    const item = p7ResearchUnmet(p);
    assert.ok(item, "the never-attempted floor is honestly unmet");
    // Deliberate: no `unmetReason` is added. `runGate` appends a reason to the
    // criterion, and the recorded `p7.seal.unmet` digest pins this criterion
    // verbatim (lesson-writers.test.ts â€” not this lane's file). The criterion
    // already names the missing artifact precisely; the state is carried by the
    // probe's own waiver contract, not by a reworded digest.
    assert.equal(item!.criterion, "Live research corpus exists for P7 (â‰¥1 fetched finding)");
    assert.equal(item!.reason, undefined, "no state line is appended to the pinned digest");
    assert.equal(liveResearchAttemptUnavailable(p), false, "no attempt â‡’ no waiver evidence");
  });

  it("a genuine ATTEMPT whose backend was UNAVAILABLE (coded row) is WAIVED", () => {
    const p = p7Project({ logs: [researchFailedRow()] });
    assert.equal(liveResearchAttemptUnavailable(p), true);
    assert.ok(!p7ResearchUnmet(p), "the documented waiver applies to a real offline attempt");
    assert.equal(runGate(p, 7).pass, true, "the whole P7 gate passes");
  });

  it("the engine's meta.liveUnavailable waiver is unchanged (the live:true producer)", () => {
    assert.ok(!p7ResearchUnmet(p7Project({ meta: { liveUnavailable: true } })));
  });

  it("a live pass that RAN but found nothing (no failure row) stays RED â€” an attempt is not a corpus", () => {
    const p = p7Project();
    assert.equal(liveResearchAttemptUnavailable(p), false);
    assert.ok(p7ResearchUnmet(p));
  });

  it("HOSTILE: a wrong phase, a non-research live row, or a non-unavailable code never waives", () => {
    assert.equal(
      liveResearchAttemptUnavailable(p7Project({ logs: [researchFailedRow({ phase: 0 as PhaseId })] })),
      false,
      "another phase's live failure is not P7's attempt",
    );
    assert.equal(
      liveResearchAttemptUnavailable(p7Project({ logs: [researchFailedRow({ event: "p7.live.failed" })] })),
      false,
      "the unclassified live-layer row is not a research-backend attempt",
    );
    assert.equal(
      liveResearchAttemptUnavailable(
        p7Project({
          logs: [
            researchFailedRow({
              detail: "RT_E_VALIDATION Â· live research failed: empty query â€” deterministic result used instead",
            }),
          ],
        }),
      ),
      false,
      "a caller-bug code is not a backend-unavailable attempt",
    );
  });

  it("a real corpus still satisfies the probe regardless of a failure row (the OR arm is intact)", () => {
    const p = p7Project({
      research: [{ query: "q", items: [{ title: "t", url: "https://e/x", content: "c" }] }],
      logs: [researchFailedRow()],
    });
    assert.ok(!p7ResearchUnmet(p));
  });

  it("the recorded gate for the waived phase carries a clean PASSING verdict", () => {
    const recorded = recordGateInto(p7Project({ logs: [researchFailedRow()] }), 7);
    const gate = recorded.phases.find((r) => r.id === 7)?.gate;
    assert.ok(gate, "the P7 gate is recorded");
    assert.equal(gate!.passed, true, "the waiver is visible in the recorded verdict");
    assert.equal(gate!.unmet.length, 0);
  });

  it("REAL headless offline run: `researchLive:true` records a waived P7; the never-attempted default stays RED", async () => {
    const realFetch = globalThis.fetch;
    const savedKey = process.env.DEEPSEEK_API_KEY;
    const savedTavily = process.env.TAVILY_API_KEY;
    // Offline: every fetch rejects; both keys cleared. No network, no keyed call.
    globalThis.fetch = (async () => {
      throw new TypeError("network down (offline P7 pin)");
    }) as typeof fetch;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.TAVILY_API_KEY;
    const p7Ready = (): Project => {
      const p = emptyProject({ name: "P7Offline", brief: "A dispatch board for field service." });
      p.currentPhase = 7;
      p.phases = Array.from({ length: 13 }, (_, id) => ({
        id,
        status: id <= 6 ? ("complete" as const) : id === 7 ? ("ready" as const) : ("locked" as const),
      })) as Project["phases"];
      return p;
    };
    try {
      const attempted = await runUntilGate(p7Ready(), { researchLive: true, maxSteps: 2 });
      const p7 = attempted.project.phases.find((r) => r.id === 7);
      assert.equal(
        (attempted.project.research ?? []).length,
        0,
        "the offline attempt fetched no corpus â€” the gate is not satisfied by a fabricated corpus",
      );
      assert.ok(
        (attempted.project.logs ?? []).some((l) => l.event === "p7.live.research.failed"),
        "the coded research-failure row is on the record (the waiver's evidence)",
      );
      assert.equal(p7?.gate?.passed, true, "the ATTEMPTED offline P7 is waived, not an unexplained red");
      assert.notEqual(
        attempted.project.meta?.liveUnavailable,
        true,
        "the waiver is evidence-backed, never a fabricated meta stamp",
      );

      const floor = await runUntilGate(p7Ready(), { maxSteps: 2 });
      assert.equal(
        floor.project.phases.find((r) => r.id === 7)?.gate?.passed,
        false,
        "a run that never attempted live research stays honestly RED",
      );
      assert.equal(
        liveResearchAttemptUnavailable(floor.project),
        false,
        "no attempt â‡’ no waiver evidence",
      );
    } finally {
      globalThis.fetch = realFetch;
      if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = savedKey;
      if (savedTavily === undefined) delete process.env.TAVILY_API_KEY;
      else process.env.TAVILY_API_KEY = savedTavily;
    }
  });
});
// ---------------------------------------------------------------------------
// W61 lane C - C1 (p6-brief-fit core-noun calibration, R1 P0-5) and C14
// (p6-arch fail-closed on dead re-export bridges). Every first case is a
// RED->GREEN pin against the measured defect; the controls pin that honest
// trees are NOT over-blocked.
// ---------------------------------------------------------------------------

const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const TESTRUNS_ROOT = join(REPO_ROOT, "..", "testruns");

/** Load a persisted emitted Project from the sibling testruns fixtures, or null
 *  when the fixtures are absent (frozen CI checkout) - the pin then skips. */
function loadTestrun(rel: string): Project | null {
  const file = join(TESTRUNS_ROOT, rel, ".rapidtool", "project.json");
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as Project;
}

const unionOf = (p: Project): string =>
  (typeof p.generatedSource === "string" ? p.generatedSource : "") +
  "\n" +
  (Array.isArray(p.generatedTree) ? p.generatedTree : []).map((f) => f?.source ?? "").join("\n");

describe("W61 C1 - p6-brief-fit core-noun calibration (R1 P0-5)", () => {
  // The wave's mandated acceptance: the two hollow 2-file trees that cleared
  // the retired flat 0.35 bar now FAIL the core bar; flower-shop still fails;
  // the real bakery-website v2 tree PASSES.
  const FIXTURES: { rel: string; expect: boolean }[] = [
    { rel: "office-stock-tracker/emitted", expect: false },
    { rel: "office-scheduler/emitted", expect: false },
    { rel: "flower-shop-website/emitted", expect: false },
    { rel: "bakery-website/emitted.v2", expect: true },
  ];

  it("replays the real fixtures: hollow trees fail the core bar, the real tree passes", () => {
    let checked = 0;
    for (const fx of FIXTURES) {
      const p = loadTestrun(fx.rel);
      if (!p) continue;
      checked++;
      assert.equal(
        briefFitSubstancePasses(p.brief, unionOf(p), p),
        fx.expect,
        `${fx.rel} core bar (expected ${fx.expect ? "PASS" : "fail"})`,
      );
    }
    assert.ok(checked === 0 || checked === FIXTURES.length, "fixtures resolve all-or-none");
  });

  it("the retired flat 0.35 bar passed office-stock-tracker/emitted; the core bar now fails it", () => {
    const p = loadTestrun("office-stock-tracker/emitted");
    if (!p) return;
    const src = unionOf(p);
    const { required } = briefNounHits(p.brief);
    const oldHits = identifierHits(required, src).length;
    assert.ok(
      oldHits >= Math.max(1, Math.ceil(required.length * 0.35)),
      `precondition (R1 P0-5): the flat bar passed (${oldHits} >= ceil(${required.length}x0.35))`,
    );
    assert.equal(briefFitSubstancePasses(p.brief, src, p), false, "the core bar fails the hollow tree");
    const item = runGate(p, 6).unmet.find((g) => g.id === "p6-brief-fit");
    assert.ok(item, "runGate surfaces the fit failure");
    assert.match(item!.reason ?? "", /core missing \(/, "the state line names the missing product nouns");
  });

  it("briefNounCore grounds core in the project and partitions advisory", () => {
    const p = loadTestrun("office-stock-tracker/emitted");
    if (!p) return;
    const { core, advisory } = briefNounCore(p.brief, p);
    assert.ok(core.includes("inventory") || core.includes("stock"), "grounded product nouns are core");
    assert.ok(core.length > 0 && advisory.length > 0, "both partitions are populated");
    const cov = briefFitCoverage(p.brief, unionOf(p), p);
    assert.equal(cov.need, Math.max(1, Math.ceil(cov.core.length * 0.6)), "the hard bar is ceil(core x 0.6)");
    assert.ok(cov.missingCore.length > 0, "the hollow tree misses core nouns");
  });

  it("an honest module naming the core nouns passes (control: no over-block)", () => {
    const brief =
      "# Officestock - Office Supplies Inventory Tracker\n\n## Core domain\n- **Item**, **Movement**, **PurchaseRequest**.\n\n## Required features\n- **Stocktake** and **Reorder**.";
    const { core } = briefNounCore(brief, null);
    assert.ok(core.length > 0, "the H1/heading nouns form a core");
    // A genuinely faithful module names every core noun.
    const src = core.map((n) => `export function ${n}Handler() { return 1; }`).join("\n");
    const cov = briefFitCoverage(brief, src, null);
    assert.ok(cov.pass, `honest coverage ${cov.coreHits.length}/${cov.core.length} clears the bar`);
  });
});

describe("W61 C14 - p6-arch fails closed on dead re-export bridges", () => {
  const kanbanSpec: Project["implementationSpec"] = {
    requirements: [],
    typeSignatures: [
      "export function createBoard(name: string): Board",
      "export function addColumn(board: Board, title: string): Column",
    ],
    edgeCases: [],
  } as unknown as Project["implementationSpec"];

  const bridgeProject = (): Project =>
    ({
      ...emptyProject({ name: "Bridge", brief: "a kanban board" }),
      implementationSpec: kanbanSpec,
      generatedTree: [
        { path: "src/generated.ts", source: 'export * from "./impl.ts";\n', hash: "b0", attempt: 0 },
        { path: "src/impl.ts", source: 'export { createBoard, addColumn } from "./impl2.ts";\n', hash: "b1", attempt: 0 },
        { path: "src/impl2.ts", source: "export const nothing = 1;\n", hash: "b2", attempt: 0 },
      ],
    }) as Project;

  it("a pure alias re-export chain no longer maps capabilities (dead bridge fails p6-arch)", () => {
    assert.equal(
      maskModuleReexports('export { createBoard } from "          ";').includes("createBoard"),
      false,
      "the re-export clause head is masked",
    );
    const t = archTrace(bridgeProject());
    assert.deepEqual(t.missing.sort(), [
      "export function addColumn(board: Board, title: string): Column",
      "export function createBoard(name: string): Board",
    ]);
    assert.ok(runGate(bridgeProject(), 6).unmet.some((g) => g.id === "p6-arch"), "the bridge tree fails p6-arch");
  });

  it("the machine-assembled entry barrel over real in-tree chunks still passes (no false block)", () => {
    const real: Project = {
      ...emptyProject({ name: "Real", brief: "a kanban board" }),
      implementationSpec: kanbanSpec,
      generatedTree: [
        { path: "src/generated.ts", source: 'export * from "./domain/board.ts";\n', hash: "r0", attempt: 0 },
        {
          path: "src/domain/board.ts",
          source:
            "export type Board = { id: string };\n" +
            "export type Column = { id: string };\n" +
            "export function createBoard(name: string): Board { return { id: name }; }\n" +
            "export function addColumn(board: Board, title: string): Column { return { id: title }; }\n",
          hash: "r1",
          attempt: 0,
        },
      ],
    };
    const t = archTrace(real);
    assert.deepEqual(t.missing, [], "every capability maps to the real chunk");
    assert.deepEqual(t.stubFiles, [], "the in-tree barrel is not a stub");
    assert.ok(!runGate(real, 6).unmet.some((g) => g.id === "p6-arch"), "p6-arch passes");
  });

  it("a re-export clause alone is not an implementation identifier (unit)", () => {
    assert.deepEqual(implementationIdentifierHits(["board"], 'export { board } from "./x";'), []);
    assert.deepEqual(implementationIdentifierHits(["board"], "export function board() {}"), ["board"]);
  });
});

describe("E-08 oracle helpers â€” junk-row tolerance (hostile persisted payload)", () => {
  // engine.hydrateProject keeps `project.oracle` rows raw (engine.ts:2953), and
  // codegen.server/headless pass that array straight to oracleToCaseSeeds at the
  // keyed P6 verify seam, so ONE null/foreign row threw a TypeError out of the
  // live seam. These pins enforce the same non-throwing floor the sibling
  // str()/rows() helpers (packet.ts) document.
  const junkyOracle = [
    { id: "orc-1", name: "happy", given: "g", expect: "e", job: "j" },
    null,
    { id: "", name: "blank", given: "g", expect: "e", job: "j" },
    { id: "orc-2", name: "sad", given: "g2", expect: "e2", job: "j" },
  ] as unknown as OracleTest[];

  it("oracleToCaseSeeds skips junk rows instead of throwing", () => {
    assert.equal(
      oracleToCaseSeeds(junkyOracle),
      "# orc-1 happy â€” g â‡’ e\n# orc-2 sad â€” g2 â‡’ e2",
    );
    assert.equal(oracleToCaseSeeds(null as unknown as OracleTest[]), "");
  });

  it("missingOracleCaseIds never reports a junk/unseeded row as dropped", () => {
    assert.deepEqual(missingOracleCaseIds([], junkyOracle), ["orc-1", "orc-2"]);
    assert.deepEqual(missingOracleCaseIds(["orc-1"], junkyOracle), ["orc-2"]);
  });
});

// ---------------------------------------------------------------------------
// Lane G5 â€” p6-brief-fit on the REAL stalled bytes: the binding P6 miss is
// GENUINE noun absence, not a coverage miscompute.
//
// Both stalled bakery-florist-orders trees (the 9-file `bakery-florist-orders`
// run and the 4-file `default-check` run) fail p6-brief-fit. This pin proves
// the failure is the model DROPPING the brief's nouns: the role nouns the brief
// names (**Stock keeper**, **Manager**, **Counter staff**) do not occur in the
// tree union at all â€” not as identifiers and not even as raw text â€” while the
// matcher is substring+stem tolerant (`identifierHits` matches any identifier
// containing the token), so a genuine export could not be missed. The faithful
// P12 tree (`default-check/sample1`) passes both the probe and the whole P6
// gate, so the bar is satisfiable, not over-strict. If a future change widens
// the core set / relaxes the bar, this RED->GREEN pin fails with it.
// ---------------------------------------------------------------------------
describe("Lane G5 â€” p6-brief-fit fails the stalled trees on GENUINE noun absence", () => {
  const loadBuild = (rel: string): Project | null => {
    const file = join(TESTRUNS_ROOT, rel, "build.json");
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Project) : null;
  };
  /** Raw word-boundary occurrences of `t` in the unmasked tree union. */
  const rawWordCount = (src: string, t: string): number =>
    (src.match(new RegExp(`\\b${t}\\b`, "gi")) ?? []).length;
  const ROLE_NOUNS = ["keeper", "management", "staff"];

  it("the stalled 9-file and 4-file trees fail p6-brief-fit and genuinely lack the brief's role nouns", () => {
    let checked = 0;
    for (const rel of ["bakery-florist-orders", "default-check/bakery-florist-orders"]) {
      const p = loadBuild(rel);
      if (!p) continue;
      checked++;
      const src = unionOf(p);
      assert.equal(
        briefFitSubstancePasses(p.brief, src, p),
        false,
        `${rel}: p6-brief-fit fails the under-produced tree`,
      );
      assert.ok(runGate(p, 6).unmet.some((g) => g.id === "p6-brief-fit"), `${rel}: runGate surfaces it`);
      for (const t of ROLE_NOUNS) {
        assert.equal(identifierHits([t], src).length, 0, `${rel}: "${t}" is not an exported identifier`);
        assert.equal(rawWordCount(src, t), 0, `${rel}: "${t}" is absent from the tree bytes (the model dropped it)`);
      }
    }
    assert.ok(checked === 0 || checked === 2, "stalled fixtures resolve all-or-none");
  });

  it("the faithful P12 tree passes p6-brief-fit and p6-arch but NOT the kind-aware web surface (the product has no UI)", () => {
    const p = loadBuild("default-check/sample1/bakery-florist-orders");
    if (!p) return;
    assert.equal(
      briefFitSubstancePasses(p.brief, unionOf(p), p),
      true,
      "the genuinely brief-faithful tree clears the core bar",
    );
    assert.ok(!runGate(p, 6).unmet.some((g) => g.id === "p6-brief-fit"), "p6-brief-fit passes");
    assert.ok(!runGate(p, 6).unmet.some((g) => g.id === "p6-arch"), "p6-arch passes");
    // 2026-10-06 (kind-aware, additive): this is an `app` whose brief names a
    // "low-stock dashboard" and "view reports", yet the emitted bytes carry no
    // page surface and no router. The old P6 gate read green over exactly that
    // mismatch; the additive `p6-web-surface` criterion now fails it, so this
    // pin moved with the bar RISE (nothing was loosened).
    assert.ok(
      runGate(p, 6).unmet.some((g) => g.id === "p6-web-surface"),
      "the UI-less web-kind tree is caught by the new surface criterion",
    );
  });

  it("p6-test / p6-arch miss on the same genuine under-production, not on over-strictness", () => {
    const stalled = loadBuild("default-check/bakery-florist-orders");
    if (stalled) {
      const ids = runGate(stalled, 6).unmet.map((u) => u.id);
      assert.ok(ids.includes("p6-test"), "no green tree-run â‡’ lastTest absent â‡’ p6-test honestly unmet");
      assert.ok(stalled.lastTest == null, "the stalled run recorded no passing self-test");
      assert.ok(archTrace(stalled).missing.length > 0, "the tree materialised fewer files than the plan demands");
    }
    const faithful = loadBuild("default-check/sample1/bakery-florist-orders");
    if (faithful) {
      assert.equal(faithful.lastTest?.ok, true, "the faithful run minted a passing self-test");
      assert.equal((faithful.lastTest as { label?: string } | null)?.label, "tested", "â€¦promoted to a tested verdict");
      assert.deepEqual(archTrace(faithful).missing, [], "every demanded capability maps to a real tree file");
    }
  });
});

// ---------------------------------------------------------------------------
// 2026-10-05 product-quality lane â€” the p6-arch no-tree SKIP, surfaced.
// ---------------------------------------------------------------------------
describe("2026-10-05 â€” p6-arch no-tree SKIP advisory", () => {
  it("an absent tree still PASSES p6-arch, but the pass is reported as a SKIP advisory", () => {
    const p = base(); // emptyProject â€” no generatedTree
    const r = runGate(p, 6);
    assert.ok(!r.unmet.some((g) => g.id === "p6-arch"), "the keyless floor is not hard-broken");
    const adv = r.advisories.find((a) => a.id === "p6-arch");
    assert.ok(adv, "the vacuous pass is surfaced, not silent");
    assert.match(adv!.note, /SKIP/);
    assert.match(adv!.note, /NOT product-complete/);
    assert.equal(archTrace(p).present, false);
    assert.equal(archProductComplete(archTrace(p)), false, "skip is not product-complete");
  });
});

// ---------------------------------------------------------------------------
// 2026-10-06 â€” the ADDITIVE kind-aware product surface criteria. The lexical /
// structural probes never noticed the emitted product did not match the brief's
// KIND. Each criterion has a fixture that FAILS it today and a control that
// passes with the surface the emitter must produce.
// ---------------------------------------------------------------------------
const wf = (path: string, source: string) => ({ path, source, hash: `h-${path}`, attempt: 0 });

const surfaceProject = (brief: string, kind: Project["kind"], tree: ReturnType<typeof wf>[]): Project =>
  ({ ...base(), brief, ...(kind ? { kind } : {}), generatedTree: tree }) as Project;

const unmetIds = (p: Project): string[] => runGate(p, 6).unmet.map((g) => g.id);

/** W359 (resolve-kind): the REAL corpus briefs, read from the tracked fixtures â€”
 *  the gate's kind parity is pinned over them instead of over hand-written
 *  samples. `frontmatter` is the same `key: value` reader the eval driver uses. */
function corpusBySlug(): Map<string, string> {
  const dir = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), "research", "eval-corpus");
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".md") || file === "README.md") continue;
    const text = readFileSync(join(dir, file), "utf8");
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const brief = fm?.[1].split(/\r?\n/).find((l) => /^brief:\s*/.test(l));
    if (!brief) continue;
    const raw = brief.replace(/^brief:\s*/, "").trim();
    out.set(file.replace(/\.md$/, ""), raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw);
  }
  return out;
}

const corpusBriefs = (): string[] => [...corpusBySlug().values()];

describe("2026-10-06 â€” kind-aware product surface criteria (additive)", () => {
  it("productSurfaceKindOf: game wins over a stray 'screen'; a bare app with no page noun imposes nothing", () => {
    assert.equal(productSurfaceKindOf({ brief: "A 2D browser arcade game with a start screen" }), "game");
    assert.equal(productSurfaceKindOf({ brief: "Build a bakery website with Pages: Home, Menu" }), "web");
    assert.equal(productSurfaceKindOf({ brief: "A kanban board for dispatch", kind: "app" }), "none");
    assert.equal(productSurfaceKindOf({ brief: "A webhook delivery service", kind: "library" }), "runnable");
    assert.equal(productSurfaceKindOf({ brief: "A dispatch board for field service" }), "none");
  });

  it("briefDeliveryKind mirrors engine.deliveryKindOf (same keyword rules â€” no silent drift)", () => {
    const briefs = [
      "Build an analytics dashboard for Northwind Traders, a wholesale food distributor.",
      "Build an appointment booking service for Cedar Clinic, a three-provider family practice.",
      "Build a TypeScript library with a small HTTP API for webhook delivery.",
      "Build a 2D browser arcade game called Sky Hopper.",
      "Build a browser puzzle game called Tile Cascade: an 8x8 grid.",
      "Build logscope, a command-line tool that reads NDJSON log files.",
      "A kanban board for dispatch teams",
      "A kanban board library exposing a typed board client",
      "A mobile app with a bottom tab bar",
      // W359 (resolve-kind): the parity set is the REAL corpus now, not nine
      // hand-written briefs â€” the copy this test used to guard was green while
      // the corpus disagreed with the engine it claimed to mirror.
      ...corpusBriefs(),
    ];
    assert.ok(corpusBriefs().length >= 11, `the corpus must be present (found ${corpusBriefs().length})`);
    for (const brief of briefs) {
      const engineKind = deliveryKindOf({ brief, domain: "", lattice: null });
      assert.equal(
        briefDeliveryKind(brief),
        engineKind,
        `kind classifier drift for ${JSON.stringify(brief.slice(0, 48))}`,
      );
    }
  });

  it("W359: the gate's surface contract never overrides the ONE decided kind on the corpus", () => {
    // Before W359 the gate carried its own keyword ROWS; the two could disagree
    // silently. Now the kind comes from the engine and the game/web regexes are an
    // additive safety net â€” this pins that the net never CHANGES the answer for a
    // real brief (changing it would be a second decision by another name).
    for (const brief of corpusBriefs()) {
      const resolved = deliveryKindOf({ brief, domain: "", lattice: null });
      assert.equal(
        productSurfaceKindOf({ brief }),
        productSurfaceKindOf({ brief, kind: resolved }),
        `the brief-only surface agrees with the decided-kind surface (${brief.slice(0, 40)}â€¦)`,
      );
    }
    // The unambiguous corpus contracts, end to end (brief-only, no stored kind):
    const bySlug = corpusBySlug();
    assert.equal(productSurfaceKindOf({ brief: bySlug.get("arcade-breakout")! }), "game");
    assert.equal(productSurfaceKindOf({ brief: bySlug.get("invoice-csv-cli")! }), "runnable");
    assert.equal(productSurfaceKindOf({ brief: bySlug.get("date-rrule-library")! }), "runnable");
    assert.equal(productSurfaceKindOf({ brief: bySlug.get("order-webhook-service")! }), "runnable");
    assert.equal(productSurfaceKindOf({ brief: bySlug.get("real-estate-crm")! }), "web");
  });

  it("W359: the replicated resolver is GONE from dod.ts (one decision, read not re-implemented)", () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "dod.ts"), "utf8");
    assert.equal(/KIND_ROWS|KIND_UI_SURFACE_WORDS/.test(src), false, "no keyword rows are re-implemented here");
    assert.match(
      src,
      /import \{ deliveryKindOf \} from "\.\/engine\.ts"/,
      "the gate imports the ONE decision (a re-copy must fail this test)",
    );
  });

  it("p6-web-surface FAILS a web brief with no page surface (the measured ten-tree shape)", () => {
    const p = surfaceProject("Build a bakery website. Pages: Home, Menu, Order, Contact.", "app", [
      wf("src/generated.ts", 'export * from "./generated/bake.ts";'),
      wf("src/generated/bake.ts", "export function bakeBread() { return 1; }"),
    ]);
    assert.ok(unmetIds(p).includes("p6-web-surface"), "no page surface / router â‡’ unmet");
    const reason = runGate(p, 6).unmet.find((g) => g.id === "p6-web-surface")?.reason ?? "";
    assert.match(reason, /RT_E_UI_UNWIRED/);
    assert.match(reason, /page surface=none/);
  });

  it("p6-web-surface PASSES with a real page surface + navigation path (the fixture the emitter must satisfy)", () => {
    const p = surfaceProject("Build a bakery website. Pages: Home, Menu.", "app", [
      wf(
        "src/App.tsx",
        "import { createBrowserRouter } from 'react-router';\nexport const router = createBrowserRouter([{ path: '/' }]);",
      ),
      wf("src/pages/home.tsx", "export function HomePage() { return <Link to=\"/menu\">Menu</Link>; }"),
      wf("src/pages/menu.tsx", "export function MenuPage() { return <div>menu</div>; }"),
    ]);
    const t = productSurfaceTrace(p);
    assert.ok(t.pageFiles.length > 0, "page files detected");
    assert.equal(t.navPath, true, "router/nav detected");
    assert.ok(!unmetIds(p).includes("p6-web-surface"), "the surface criterion is met");
  });

  it("p6-game-surface FAILS a game brief with no input/loop/canvas, PASSES with all three", () => {
    const failing = surfaceProject("A 2D browser arcade game with jumping and coins.", "game", [
      wf("src/generated/render.ts", "export function scorePoints(n) { return n * 2; }"),
    ]);
    assert.ok(unmetIds(failing).includes("p6-game-surface"), "no input/loop/canvas â‡’ unmet");

    const passing = surfaceProject("A 2D browser arcade game with jumping and coins.", "game", [
      wf(
        "src/generated/render.ts",
        [
          "export function start() {",
          "  const canvas = document.createElement('canvas');",
          "  const ctx = canvas.getContext('2d');",
          "  window.addEventListener('keydown', (e) => jump(e));",
          "  const loop = () => { requestAnimationFrame(loop); };",
          "  requestAnimationFrame(loop);",
          "}",
        ].join("\n"),
      ),
    ]);
    assert.ok(!unmetIds(passing).includes("p6-game-surface"), "input + loop + canvas â‡’ met");
  });

  it("p6-runnable-entry FAILS a CLI whose entry throws TODO(E-15), PASSES a real entry exposing the declared surface", () => {
    const stubEntry = surfaceProject("Build logscope, a command-line tool reading log files.", "tool", [
      wf("src/generated.ts", 'export * from "./generated/run-cli.ts";'),
      wf(
        "src/generated/run-cli.ts",
        'export function runCli() { throw new Error("TODO(E-15) stub: implement runCli"); }',
      ),
    ]);
    assert.ok(unmetIds(stubEntry).includes("p6-runnable-entry"), "a throw-TODO entry â‡’ unmet");
    const stubReason = runGate(stubEntry, 6).unmet.find((g) => g.id === "p6-runnable-entry")?.reason ?? "";
    assert.match(stubReason, /RT_E_PLAN_UNDERPRODUCED/);
    assert.match(stubReason, /TODO stub/);

    // A declared surface the brief names but the tree does not implement â‡’ unmet.
    const missingSurface = surfaceProject(
      "Build a TypeScript library: `subscribe(url)` and `publish(event)`.",
      "library",
      [
        wf("src/index.ts", "export function subscribe(url) { return url; }"),
      ],
    );
    assert.ok(unmetIds(missingSurface).includes("p6-runnable-entry"), "declared-but-missing surface â‡’ unmet");
    assert.match(
      runGate(missingSurface, 6).unmet.find((g) => g.id === "p6-runnable-entry")?.reason ?? "",
      /declared surface not implemented: publish/,
    );

    const real = surfaceProject(
      "Build a TypeScript library: `subscribe(url)` and `publish(event)`.",
      "library",
      [
        wf("src/index.ts", "export function subscribe(url) { return url; }\nexport function publish(event) { return event; }"),
      ],
    );
    assert.ok(!unmetIds(real).includes("p6-runnable-entry"), "a real entry exposing the declared surface â‡’ met");
  });

  it("a non-matching brief imposes nothing â€” the criterion passes with an N/A advisory, never a silent skip", () => {
    const p = base(); // dispatch-board brief, no surface contract
    const r = runGate(p, 6);
    for (const id of ["p6-web-surface", "p6-game-surface", "p6-runnable-entry"]) {
      assert.ok(!r.unmet.some((g) => g.id === id), `${id} imposes nothing on a surface-less brief`);
    }
    const adv = r.advisories.filter((a) => a.id.startsWith("p6-") && a.note.startsWith("N/A"));
    assert.equal(adv.length, 3, "all three N/A passes are surfaced, not silent");
  });

  it("classifyModuleSource is the ONE classifier (the two quality readers agree by construction)", () => {
    assert.equal(classifyModuleSource(""), "stub");
    assert.equal(classifyModuleSource('export function x() { throw new Error("TODO(E-15) t"); }'), "stub");
    assert.equal(classifyModuleSource('export * from "./a.ts";'), "reexport");
    assert.equal(classifyModuleSource("export function createBoard() { return 1; }"), "real");
  });
});

// ---------------------------------------------------------------------------
// 2026-10-06 â€” item 1/2/6: the kind-surface reading reads the EMITTER's own
// emitted surface, the entry barrel is exempted like p6-arch, and vacuous
// passes carry CODED advisories.
// ---------------------------------------------------------------------------
const emittedFile = (path: string, source: string) => ({ path, source });

describe("2026-10-06 â€” kind-surface reads the emitter's emitted surface (item 1)", () => {
  it("p6-web-surface: the scaffold's own emitted pages+router satisfy the criterion although generatedTree carries none", () => {
    const p = {
      ...surfaceProject("Build a bakery website. Pages: Home, Menu, Order.", "app", [
        wf("src/generated.ts", 'export * from "./generated/bake.ts";'),
        wf("src/generated/bake.ts", "export function bakeBread() { return 1; }"),
      ]),
      emittedSurface: [
        emittedFile(
          "src/ui/router.tsx",
          "export function SiteRouter() { return <nav><a href=\"/menu\">Menu</a></nav>; }",
        ),
        emittedFile("src/ui/pages/HomePage.tsx", "export function HomePage() { return <main>home</main>; }"),
        emittedFile("src/ui/pages/MenuPage.tsx", "export function MenuPage() { return <main>menu</main>; }"),
      ],
    } as Project;
    const t = productSurfaceTrace(p);
    assert.ok(t.pageFiles.length >= 2, "the emitter's page files are read");
    assert.equal(t.navPath, true, "the emitter's router/nav is read");
    assert.ok(!unmetIds(p).includes("p6-web-surface"), "the emitter's OWN page surface satisfies the criterion");
  });

  it("without the emitted surface the SAME brief still FAILS (the reading did not lower the bar)", () => {
    const p = surfaceProject("Build a bakery website. Pages: Home, Menu, Order.", "app", [
      wf("src/generated.ts", 'export * from "./generated/bake.ts";'),
      wf("src/generated/bake.ts", "export function bakeBread() { return 1; }"),
    ]);
    assert.ok(unmetIds(p).includes("p6-web-surface"), "no page surface anywhere => unmet");
  });

  it("p6-game-surface: the scaffold's emitted canvas shell satisfies input+loop+canvas", () => {
    const p = {
      ...surfaceProject("A 2D browser arcade game with jumping and coins.", "game", [
        wf("src/generated/render.ts", "export function scorePoints(n) { return n * 2; }"),
      ]),
      emittedSurface: [
        emittedFile(
          "src/ui/console.tsx",
          [
            "export function startGame() {",
            "  const canvas = document.createElement('canvas');",
            "  const ctx = canvas.getContext('2d');",
            "  window.addEventListener('keydown', () => {});",
            "  const loop = () => requestAnimationFrame(loop);",
            "  requestAnimationFrame(loop);",
            "}",
          ].join("\n"),
        ),
      ],
    } as Project;
    assert.ok(!unmetIds(p).includes("p6-game-surface"), "the emitted canvas game surface satisfies the criterion");
  });
});

describe("2026-10-06 â€” entry barrel exemption + coded advisories (items 2/6)", () => {
  it("p6-runnable-entry: a reexport barrel entry whose target is a real in-tree module is NOT a stub", () => {
    const p = surfaceProject("Build logscope, a command-line tool reading log files.", "tool", [
      wf("src/generated.ts", 'export * from "./generated/run-cli.ts";'),
      wf("src/generated/run-cli.ts", "export function runCli(argv) { return 0; }"),
    ]);
    assert.ok(!unmetIds(p).includes("p6-runnable-entry"), "the in-tree entry barrel is exempt (not a stub)");
  });

  it("p6-runnable-entry: a barrel whose target is OUTSIDE the tree stays a stub (fail-closed)", () => {
    const p = surfaceProject("Build logscope, a command-line tool reading log files.", "tool", [
      wf("src/generated.ts", 'export * from "./host.ts";'),
    ]);
    assert.ok(unmetIds(p).includes("p6-runnable-entry"), "a dead/out-of-tree bridge is still a stub");
  });

  it("p6-source: whitespace-only generated source is NOT non-empty", () => {
    const p = { ...base(), generatedSource: "   \n\t  " } as Project;
    assert.ok(runGate(p, 6).unmet.some((g) => g.id === "p6-source"), "whitespace-only source is empty in substance");
    const ok = runGate({ ...p, generatedSource: "export const x = 1;" } as Project, 6);
    assert.ok(!ok.unmet.some((g) => g.id === "p6-source"), "real bytes pass");
  });

  // A3-E6 (2026-10-06, REPLACES the pre-fix advisory pin): a 0-byte artifact
  // body used to pass its presence probe with only an advisory (and an advisory
  // never changes a verdict), so "P8 produced its UI artifact" was literally
  // true of nothing. The empty body is now a FAILED probe.
  it("an empty-bodied artifact FAILS its presence probe (0 bytes is not a deliverable)", () => {
    const p = {
      ...base(),
      artifacts: [{ id: "a", phase: 8, kind: "ui", title: "UI", body: "", language: "markdown" }],
    } as unknown as Project;
    const r = runGate(p, 8);
    assert.ok(r.unmet.some((g) => g.id === "p8-ui"), "a 0-byte body is not a produced deliverable");
    const u = r.unmet.find((g) => g.id === "p8-ui")!;
    assert.match(u.reason ?? "", /RT_E_SUBSTANCE_EMPTY/);
    assert.match(u.reason ?? "", /EMPTY/);
    assert.ok(!r.advisories.some((a) => a.id === "p8-ui"), "a fail is not an advisory");
  });

  it("a non-empty artifact passes p8-ui with no advisory", () => {
    const p = {
      ...base(),
      artifacts: [{ id: "a", phase: 8, kind: "ui", title: "UI", body: "real ui body", language: "markdown" }],
    } as unknown as Project;
    const r = runGate(p, 8);
    assert.ok(!r.unmet.some((g) => g.id === "p8-ui"), "real bytes pass");
    assert.ok(!r.advisories.some((a) => a.id === "p8-ui"), "a real body is unqualified");
  });

  it("A3-E6: an empty-bodied artifact makes the recorded gate red and counts in sealedWithFailures", () => {
    const p = {
      ...base(),
      phases: [{ id: 8 as PhaseId, status: "complete" }],
      artifacts: [{ id: "a", phase: 8 as PhaseId, kind: "ui", title: "UI", body: "", language: "markdown" }],
    } as unknown as Project;
    const recorded = recordGateInto(p, 8 as PhaseId);
    const rec = recorded.phases.find((r) => r.id === 8)!;
    assert.equal(rec.gate?.passed, false, "the recorded gate is red");
    assert.ok(
      (rec.gate?.unmet ?? []).some((u) => u.includes("RT_E_SUBSTANCE_EMPTY")),
      "the unmet census names the empty deliverable, coded",
    );
    assert.equal(sealedWithFailures(recorded), true, "an empty deliverable is a seal failure, not a green skip");
  });

  it("a vocabulary-free brief passes p0-brief-grounded but carries a coded SKIP advisory", () => {
    const p = emptyProject({ name: "Blip", brief: "x" });
    const r = runGate(p, 0);
    assert.ok(!r.unmet.some((g) => g.id === "p0-brief-grounded"), "no vocabulary to ground => still passes");
    const adv = r.advisories.find((a) => a.id === "p0-brief-grounded");
    assert.ok(adv, "the vacuous pass is surfaced");
    assert.equal(adv!.code, "RT_E_CLAIM_UNVERIFIED");
  });

  it("gateArtifact renders an advisory code so the green artifact body is actionable", () => {
    const art = gateArtifact(3, {
      pass: true,
      unmet: [],
      evidenceHash: "abcdef01",
      advisories: [{ id: "p8-ui", criterion: "c", note: "SKIP â€” empty", code: "RT_E_SUBSTANCE_EMPTY" }],
    });
    assert.match(art.body, /code: RT_E_SUBSTANCE_EMPTY/);
  });
});

describe("2026-10-06 â€” more coded advisories (item 2): vacuous P6/P7 passes", () => {
  it("a vocabulary-free brief also qualifies the vacuous p6-brief-fit pass", () => {
    const p = emptyProject({ name: "Blip", brief: "x" });
    const r = runGate(p, 6);
    const adv = r.advisories.find((a) => a.id === "p6-brief-fit");
    assert.ok(adv, "the vacuous fit pass is surfaced");
    assert.equal(adv!.code, "RT_E_CLAIM_UNVERIFIED");
  });

  it("two blank competitor rows pass the count probe but carry a coded SKIP advisory", () => {
    const p = {
      ...base(),
      competitors: [{ name: "", class: "", strength: "", gap: "" }, { name: "   ", class: "", strength: "", gap: "" }],
    } as unknown as Project;
    const r = runGate(p, 7);
    assert.ok(!r.unmet.some((g) => g.id === "p7-competitors"), "the count probe passes");
    const adv = r.advisories.find((a) => a.id === "p7-competitors");
    assert.ok(adv, "blank rows are surfaced, not counted as mapped");
    assert.equal(adv!.code, "RT_E_SUBSTANCE_EMPTY");
  });
});

describe("2026-10-06 â€” coded advisories for the remaining vacuous P0/P2/P7 passes", () => {
  it("p0-scorecard: five unlabelled axes pass the count probe with a coded SKIP", () => {
    const p = {
      ...base(),
      scorecard: { overall: 0, verdict: "proceed", axes: Array.from({ length: 5 }, () => ({ key: "k", label: "", score: 0, note: "" })), bottlenecks: [], attackVectors: [], libraries: [] },
    } as unknown as Project;
    const r = runGate(p, 0);
    assert.ok(!r.unmet.some((g) => g.id === "p0-scorecard"));
    assert.equal(r.advisories.find((a) => a.id === "p0-scorecard")?.code, "RT_E_SUBSTANCE_EMPTY");
  });

  it("p0-lattice: a single blank job row passes with a coded SKIP", () => {
    const p = {
      ...base(),
      lattice: { domain: "d", jobs: ["  "], entities: [], constraints: [], nodes: [], complexity: 0 },
    } as unknown as Project;
    const r = runGate(p, 0);
    assert.ok(!r.unmet.some((g) => g.id === "p0-lattice"));
    assert.equal(r.advisories.find((a) => a.id === "p0-lattice")?.code, "RT_E_SUBSTANCE_EMPTY");
  });

  it("p2-memory: three kinds present but every body blank passes with a coded SKIP", () => {
    const p = {
      ...base(),
      memory: [
        { id: "1", kind: "episodic", phase: 0, text: "", score: 0 },
        { id: "2", kind: "semantic", phase: 0, text: "  ", score: 0 },
        { id: "3", kind: "procedural", phase: 0, text: "", score: 0 },
      ],
    } as unknown as Project;
    const r = runGate(p, 2);
    assert.ok(!r.unmet.some((g) => g.id === "p2-memory"));
    assert.equal(r.advisories.find((a) => a.id === "p2-memory")?.code, "RT_E_SUBSTANCE_EMPTY");
  });

  it("p7-research: a corpus row with zero fetched items passes with a coded SKIP", () => {
    const p = { ...base(), research: [{ query: "q", items: [] }] } as unknown as Project;
    const r = runGate(p, 7);
    assert.ok(!r.unmet.some((g) => g.id === "p7-research"));
    assert.equal(r.advisories.find((a) => a.id === "p7-research")?.code, "RT_E_SUBSTANCE_EMPTY");
  });
});
