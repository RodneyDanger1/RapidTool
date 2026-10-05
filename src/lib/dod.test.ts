// ---------------------------------------------------------------------------
// dod.test.ts — W48 / 334-3 "Transit": the P6 DoD probe vs an UNVERIFIED tree.
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
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { archTrace, liveResearchAttemptUnavailable, recordGateInto, runGate } from "./dod.ts";
import { runUntilGate } from "./headless.ts";
import { mintTreeRunTested } from "./codegen.server.ts";
import { emptyProject } from "./engine.ts";
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
import type { HitlDecision, PhaseId, Project } from "./types.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";

const base = (): Project => emptyProject({ name: "Dod334", brief: "A dispatch board for field service." });

/**
 * A green tree-run outcome that EXECUTED its spec(s) — the shape the P6 journey
 * feeds `mintTreeRunTested` — but whose declared package.json scripts did not
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
    run: { kind: "ui-shell", run: "skip", detail: "UI shell — not executable headless" },
    declaredScriptsVerified: false,
    unverifiedDeclaredScripts: ["typecheck", "build"],
    ...over,
  }) as unknown as TreeRunOutcome;

const met = (p: Project, id: string): boolean => !runGate(p, 6).unmet.some((g) => g.id === id);

describe("W48 / 334-3 (T1b) — p6-test / p6-verified vs an unverified declared toolchain", () => {
  it("a GREEN executed tree-run whose declared typecheck/build never ran still mints the tested verdict the P6 DoD requires", () => {
    const minted = mintTreeRunTested(base(), greenUnverifiedOutcome());
    const lt = minted.lastTest as { label?: string; detail?: string; evidenceHash?: string } | null;
    assert.equal(lt?.label, "tested", "an executed green tree-run still promotes to the tested verdict");
    assert.match(String(lt?.detail), /tree-run green/, "the stamp records the executed run, not a bare label");

    // The honest line: the criteria measure the EXECUTED self-test / machine-run
    // verdict over the tree's own specs — which genuinely ran green — so they are
    // met. They do NOT attest the declared project toolchain.
    assert.equal(met(minted, "p6-test"), true, "the executed self-test passed");
    assert.equal(met(minted, "p6-verified"), true, "a machine run promoted a genuinely executed tested verdict");
  });

  it("the DoD verdict is deliberately blind to declaredScriptsVerified — the limit is carried by the artifact/envelope, not folded into a criterion", () => {
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
      "the declared-toolchain state must not change any P6 DoD outcome — requiring it would be unsatisfiable on a fresh tree and would block the P6 mint",
    );
    // The field is not even on the stamp the probe reads, so the probe cannot
    // silently conflate it: the limit rides the emitted README banner + the
    // tree-run envelope (`declaredScriptsVerified` / `unverifiedDeclaredScripts`).
    assert.equal(
      Object.prototype.hasOwnProperty.call(unverified.lastTest ?? {}, "declaredScriptsVerified"),
      false,
      "the tested stamp carries no declared-toolchain field for a probe to over-read",
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
      "a stamp recording no run detail is hollow — never verification",
    );
    assert.equal(
      met(withLastTest({ ok: true, detail: "tree-run green: 1 spec file(s) pass", label: "tested", evidenceHash: "h" }), "p6-verified"),
      true,
      "control: a green, detailed, hash-carrying verdict is met",
    );
  });
});

// ---------------------------------------------------------------------------
// 339-3 (W53) — p6-brief-fit floor honesty + satisfiability.
//
// The keyless deterministic floor can NEVER pass p6-brief-fit: the placeholder
// module implements phase bookkeeping only and carries no brief vocabulary. So
// a RED criterion must NAME the state the project is in — the deterministic
// floor (no keyed synthesis ran, or a refused synthesis that kept the floor)
// versus a real run that simply dropped the brief's nouns — instead of leaving
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

describe("339-3 (W53) — p6-brief-fit names the floor state and is satisfiable by a real module", () => {
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
          detail: "RT_E_RUNNER_FAILED · case payload rejected by harness safety check",
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
    // lattice jobs), so a genuinely brief-faithful module names them all —
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
// 346 L3 (A1-12 enforcement) — the browser console's `[seat console]` row.
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
      "console-seat-unattested — hitl.approve on gate:P4 under the browser console's human seat; unattested, never token-verified.",
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

describe("346 L3 (A1-12) — a `[seat console]` row is attributed and routed truthfully", () => {
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
        reason: "human-seat-token-verified — hitl.approve on gate:P4 under the verified human seat.",
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
        reason: "human-seat-token-verified — hitl.approve on gate:P4 under the verified human seat.",
        label: "human/human-cli-i-am-human",
        tokenPath: true,
      },
    });
    assert.equal(p4ApprovedMet(withDecision(row)), true);
  });

  it("CONTROL: a routine autopilot row still satisfies p4-approved (Rule A unchanged)", () => {
    const row = consoleApprovalRow({
      id: "hitl-4-auto",
      note: "[seat harness] autopilot seat — no human decision claimed",
      decidedBy: "autopilot",
      decidedVia: {
        action: "hitl.approve",
        resource: "gate:P4",
        reason: "autopilot-seat — hitl.approve on gate:P4 under the harness's own seat.",
        label: "autopilot/harness",
        tokenPath: false,
      },
    });
    assert.equal(p4ApprovedMet(withDecision(row)), true);
  });
});

// ---------------------------------------------------------------------------
// 346 L6 — the P7 `p7-research` waiver: ATTEMPTED-but-unavailable vs never-tried.
//
// The pre-existing waiver read only `meta.liveUnavailable` (the engine live
// layer's stamp). The bare-Node research overlay (`headless.bareNodeLiveOverlay`,
// the `--live` / eval research path) instead records a coded
// `p7.live.research.failed` row and stamps NO meta — so a genuine offline
// attempt there stayed RED without ever applying the documented waiver, and the
// project carried a `liveUnavailable`-less record that reads like "we never
// tried". These pins fix the honest distinction: a real attempt whose backend
// was unavailable is waived; a run that never attempted stays RED (the waiver
// is never fabricated — see wild-step.test.ts's keyless-floor pin).
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
    "RT_E_RESEARCH_UNAVAILABLE · live research failed: Free web search unavailable — all providers failed — deterministic result used instead",
  ...over,
});

const p7ResearchUnmet = (p: Project) => runGate(p, 7).unmet.find((g) => g.id === "p7-research");

describe("346 L6 — p7-research waives a real attempted-but-unavailable live pass, never a fabricated one", () => {
  it("no attempt (deterministic/keyless floor): p7-research stays RED and the criterion stays VERBATIM", () => {
    const p = p7Project();
    const item = p7ResearchUnmet(p);
    assert.ok(item, "the never-attempted floor is honestly unmet");
    // Deliberate: no `unmetReason` is added. `runGate` appends a reason to the
    // criterion, and the recorded `p7.seal.unmet` digest pins this criterion
    // verbatim (lesson-writers.test.ts — not this lane's file). The criterion
    // already names the missing artifact precisely; the state is carried by the
    // probe's own waiver contract, not by a reworded digest.
    assert.equal(item!.criterion, "Live research corpus exists for P7 (≥1 fetched finding)");
    assert.equal(item!.reason, undefined, "no state line is appended to the pinned digest");
    assert.equal(liveResearchAttemptUnavailable(p), false, "no attempt ⇒ no waiver evidence");
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

  it("a live pass that RAN but found nothing (no failure row) stays RED — an attempt is not a corpus", () => {
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
              detail: "RT_E_VALIDATION · live research failed: empty query — deterministic result used instead",
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
        "the offline attempt fetched no corpus — the gate is not satisfied by a fabricated corpus",
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
        "no attempt ⇒ no waiver evidence",
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
