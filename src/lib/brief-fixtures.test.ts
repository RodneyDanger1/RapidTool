// ---------------------------------------------------------------------------
// Brief-fixture core tests (P0-1 oracle F2 wave) — brief-fixtures.test.ts
// Pure/deterministic module under test: src/lib/brief-fixtures.ts.
// READ-ONLY references: dod.ts oracleToCaseSeeds/missingOracleCaseIds +
// algorithms.ts buildTestOracle (the A7 producer) — consumed as inputs only.
// Run: node --experimental-strip-types --test src/lib/brief-fixtures.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import {
  approveAllFixtureCases,
  approveFixtureCases,
  BRIEF_FIXTURE_KINDS,
  deriveCapabilityKind,
  draftBriefFixtures,
  fixtureApprovalGate,
  isPlainJsonLiteral,
  jobCoveredByCapabilities,
  coerceAcceptanceFixtures,
  compileFixtureAssertion,
  fixtureCaseIsPlaceholder,
  fixtureMatchHelperSource,
  fixtureShapeValueIsVacuous,
  approvedAcceptanceFixtures,
  draftTypedLiterals,
  mergeDraftedFixtures,
  validateFixtureCase,
  validateFixtureSet,
} from "./brief-fixtures.ts";
import type { BriefFixtureCase, BriefFixtureExpect, BriefFixtureTypedDraft } from "./brief-fixtures.ts";
import type { IntentLattice, OracleTest } from "./types.ts";
import { buildTestOracle } from "./algorithms.ts";
import { missingOracleCaseIds, oracleToCaseSeeds } from "./dod.ts";

// ---------------------------------------------------------------------------
// Helpers + deterministic sample (property-ledger flavor, A7-shape rows)
// ---------------------------------------------------------------------------

const SAMPLE_ROW_NAMES = {
  recordHappy: "job.record.happy",
  showHappy: "job.show.happy",
  credit: "constraint.credit-check",
  phase: "graph.no-skip",
} as const;

function sampleOracle(): OracleTest[] {
  return [
    {
      id: "orc-1",
      name: SAMPLE_ROW_NAMES.recordHappy,
      given: "Authorized operator submits “record” with a valid property",
      expect: "200 + persisted entity + checkpoint written",
      job: "record",
    },
    {
      id: "orc-2",
      name: SAMPLE_ROW_NAMES.showHappy,
      given: "Authorized operator submits “show” with a valid property",
      expect: "200 + persisted entity + checkpoint written",
      job: "show",
    },
    {
      id: "orc-c-credit-check",
      name: SAMPLE_ROW_NAMES.credit,
      given: "Request violates credit-check",
      expect: "403 or 422; no side effect; diagnostic JSON",
      job: "record",
    },
    {
      id: "orc-phase",
      name: SAMPLE_ROW_NAMES.phase,
      given: "Agent requests P9 while P4 is open",
      expect: "Illegal transition; no deploy artifacts",
      job: "graph",
    },
  ];
}

/** Capability prose that deterministically covers jobs record + show. */
const SAMPLE_CAPABILITIES = [
  "One shared property record with ownership, address, status, and full history",
  "Showing slots publishable from any listing or rental property; buyers book with email confirmation and a per-property showing history with buyer feedback",
];

/** Producer-authored typed literals (the A1 LLM-assisted draft channel) —
 *  mirrors the 157 §4 P0-1 corpus example createProperty({address,owner})
 *  ⇒ {id, history:[]} in executable form. */
function typedForAll(): Record<string, BriefFixtureTypedDraft> {
  return {
    "orc-1": {
      given: { address: "1 Main St", owner: "Ada" },
      expect: { kind: "shape", value: { id: "p-1", history: [] } },
    },
    "orc-2": {
      given: { propertyId: "p-1", slot: "2026-09-10T15:00", buyer: "bea@example.com" },
      expect: { kind: "shape", value: { id: "s-1", propertyId: "p-1", buyer: "bea@example.com" } },
    },
    "orc-c-credit-check": {
      given: { propertyId: "p-1", creditScore: 300 },
      expect: { kind: "throws", messagePattern: "credit-check" },
    },
    "cap-1": {
      given: { address: "1 Main St", owner: "Ada" },
      expect: { kind: "shape", value: { id: "p-1", history: [] } },
    },
    "cap-2": {
      given: { propertyId: "p-1", slot: "2026-09-10T15:00", buyer: "bea@example.com" },
      expect: { kind: "shape", value: { id: "s-1", propertyId: "p-1", buyer: "bea@example.com" } },
    },
  };
}

function expectShape(value: unknown): BriefFixtureExpect {
  return { kind: "shape", value };
}

function caseWith(c: BriefFixtureCase, over: Partial<BriefFixtureCase>): BriefFixtureCase {
  return { ...c, ...over };
}

// ---------------------------------------------------------------------------
// draftBriefFixtures — deterministic drafter
// ---------------------------------------------------------------------------

describe("draftBriefFixtures — deterministic drafter", () => {
  it("drafts typed A7 job + constraint rows and capability entries into pending candidate cases", () => {
    const draft = draftBriefFixtures({
      oracle: sampleOracle(),
      capabilities: SAMPLE_CAPABILITIES,
      typed: typedForAll(),
    });

    // 3 A7 rows (orc-1, orc-2, orc-c-credit-check) + 2 capability entries.
    assert.deepEqual(
      draft.cases.map((c) => c.id),
      ["orc-1", "orc-2", "orc-c-credit-check", "cap-1", "cap-2"],
    );
    // The engine-control row (orc-phase, job "graph") is never a fixture target.
    assert.deepEqual(draft.redCards, [
      { ref: "orc-phase", reason: "control-plane row — no executable function target" },
    ]);

    const orc1 = draft.cases[0];
    assert.equal(orc1.requirementId, "orc-1");
    assert.equal(orc1.capability, "record");
    assert.equal(orc1.name, SAMPLE_ROW_NAMES.recordHappy);
    assert.deepEqual(orc1.given, { address: "1 Main St", owner: "Ada" });
    assert.deepEqual(orc1.expect, { kind: "shape", value: { id: "p-1", history: [] } });
    assert.equal(orc1.kind, "pure");
    assert.equal(orc1.source, "a7");
    assert.equal(orc1.approval, "pending", "drafted cases are born pending human approval");

    const orc2 = draft.cases[1];
    assert.equal(orc2.capability, "show");
    assert.equal(orc2.kind, "pure");
    assert.equal(orc2.source, "a7");

    const credit = draft.cases[2];
    assert.equal(credit.kind, "effect", "constraint rows triage to effect");
    assert.deepEqual(credit.expect, { kind: "throws", messagePattern: "credit-check" });
    assert.deepEqual(credit.given, { propertyId: "p-1", creditScore: 300 });
    assert.equal(credit.source, "a7");
    assert.equal(credit.approval, "pending");

    const cap1 = draft.cases[3];
    assert.equal(cap1.requirementId, "cap-1");
    assert.equal(cap1.source, "capability");
    assert.equal(cap1.capability, SAMPLE_CAPABILITIES[0]);
    assert.equal(cap1.kind, "pure", "data-model capability prose triages pure");
    assert.equal(cap1.approval, "pending");

    const cap2 = draft.cases[4];
    assert.equal(cap2.source, "capability");
    assert.equal(cap2.kind, "effect", "book/email capability prose triages effect");
    assert.equal(cap2.name.startsWith("Showing slots"), true);
    assert.ok(cap2.name.length <= 89, "capability headline is deterministically capped");
    assert.equal(cap2.name.endsWith("…"), true);

    // Every drafted candidate passes the shape gate and is pending.
    assert.equal(validateFixtureSet(draft.cases).ok, true);
    assert.equal(draft.cases.every((c) => c.approval === "pending"), true);
  });

  it("is deterministic — same args produce a deep-equal draft", () => {
    const args = {
      oracle: sampleOracle(),
      capabilities: SAMPLE_CAPABILITIES,
      typed: typedForAll(),
    };
    const first = draftBriefFixtures(args);
    const second = draftBriefFixtures(args);
    assert.deepEqual(second, first);
    assert.deepEqual(second.cases[0].given, first.cases[0].given);
  });

  it("red-cards vacuous untyped rows/capabilities and control-plane rows", () => {
    const draft = draftBriefFixtures({
      oracle: sampleOracle(),
      capabilities: SAMPLE_CAPABILITIES,
      typed: {},
    });

    assert.equal(draft.cases.length, 0, "no typed literals ⇒ no cases");
    const byRef = new Map(draft.redCards.map((r) => [r.ref, r.reason]));
    assert.equal(byRef.get("orc-1")?.startsWith("vacuous draft"), true);
    assert.equal(byRef.get("orc-2")?.startsWith("vacuous draft"), true);
    assert.equal(byRef.get("orc-c-credit-check")?.startsWith("vacuous draft"), true);
    assert.equal(byRef.get("cap-1")?.startsWith("vacuous draft"), true);
    assert.equal(byRef.get("cap-2")?.startsWith("vacuous draft"), true);
    assert.equal(byRef.get("orc-phase"), "control-plane row — no executable function target");

    // The gate therefore blocks a draft that produced zero cases.
    assert.equal(fixtureApprovalGate(draft.cases).ok, false);
  });

  it("applies the capability coverage filter to A7 job rows", () => {
    // Only the data-model capability: covers job "record", not job "show".
    const narrow = draftBriefFixtures({
      oracle: sampleOracle(),
      capabilities: [SAMPLE_CAPABILITIES[0]],
      typed: typedForAll(),
    });
    assert.deepEqual(
      narrow.cases.map((c) => c.id),
      ["orc-1", "orc-c-credit-check", "cap-1"],
      "show row has no capability coverage and is red-carded",
    );
    const reasons = narrow.redCards.map((r) => r.reason);
    assert.equal(reasons.some((r) => r.startsWith("no capability coverage")), true);

    // Advisory path (no capability list) drafts every eligible row.
    const advisory = draftBriefFixtures({ oracle: sampleOracle(), typed: typedForAll() });
    assert.deepEqual(
      advisory.cases.map((c) => c.id),
      ["orc-1", "orc-2", "orc-c-credit-check"],
    );

    // Coverage helper semantics.
    assert.equal(jobCoveredByCapabilities("record", []), true);
    assert.equal(jobCoveredByCapabilities("record", ["One shared property record…"]), true);
    assert.equal(jobCoveredByCapabilities("publish", ["One shared property record…"]), false);
  });

  it("derives a throws expect for a constraint row whose typed expect is a shape", () => {
    const typed = {
      ...typedForAll(),
      "orc-c-credit-check": {
        given: { propertyId: "p-1", creditScore: 300 },
        expect: expectShape({ ok: true }),
      } as BriefFixtureTypedDraft,
    };
    const draft = draftBriefFixtures({
      oracle: sampleOracle(),
      capabilities: SAMPLE_CAPABILITIES,
      typed,
    });
    const credit = draft.cases.find((c) => c.id === "orc-c-credit-check");
    assert.ok(credit);
    assert.equal(credit.kind, "effect");
    assert.deepEqual(credit.expect, { kind: "throws", messagePattern: "credit-check" });
  });

  it("triages capability kind from prose lexicon deterministically", () => {
    assert.equal(deriveCapabilityKind("Properties always carry a single owner"), "property");
    assert.equal(deriveCapabilityKind("Buyers book showings with email confirmation"), "effect");
    assert.equal(deriveCapabilityKind("One shared record with ownership and status"), "pure");
  });
});

// ---------------------------------------------------------------------------
// E-08 seam cross-reference (READ-ONLY dod.ts oracleToCaseSeeds /
// missingOracleCaseIds + algorithms.ts buildTestOracle)
// ---------------------------------------------------------------------------

describe("E-08 seam cross-reference (A7 producer → seeds → drafter)", () => {
  const lattice: IntentLattice = {
    domain: "real-estate",
    jobs: ["record"],
    entities: ["property"],
    constraints: ["credit-check"],
    nodes: [],
    complexity: 4,
  };

  it("oracleToCaseSeeds renders the A7 prose rows the drafter consumes", () => {
    const oracle = buildTestOracle(lattice);
    const seeds = oracleToCaseSeeds(oracle);
    assert.equal(
      seeds.includes("# orc-1 job.record.happy — Authorized operator submits “record” with a valid property ⇒ 200 + persisted entity + checkpoint written"),
      true,
    );
    assert.equal(seeds.includes("# orc-c-credit-check constraint.credit-check — Request violates credit-check ⇒ 403 or 422; no side effect; diagnostic JSON"), true);
  });

  it("drafted case ids ARE the pinned oracle row ids (control rows excepted)", () => {
    const oracle = buildTestOracle(lattice);
    const draft = draftBriefFixtures({
      oracle,
      typed: {
        "orc-1": {
          given: { address: "1 Main St", owner: "Ada" },
          expect: expectShape({ id: "p-1", history: [] }),
        },
        "orc-c-credit-check": {
          given: { propertyId: "p-1", creditScore: 300 },
          expect: { kind: "throws", messagePattern: "credit-check" },
        },
      },
    });
    assert.deepEqual(
      draft.cases.map((c) => c.id),
      ["orc-1", "orc-c-credit-check"],
    );
    // orc-phase is the engine-control row (job "graph") — deliberately not a
    // fixture target, so the E-08 pin reports it missing (honest exemption).
    assert.deepEqual(
      missingOracleCaseIds(
        draft.cases.map((c) => c.id),
        oracle,
      ),
      ["orc-phase"],
    );
  });
});

// ---------------------------------------------------------------------------
// validateFixtureCase / validateFixtureSet — the deterministic shape gate
// ---------------------------------------------------------------------------

describe("validateFixtureCase / validateFixtureSet — shape gate", () => {
  function validCase(): BriefFixtureCase {
    return {
      id: "orc-1",
      requirementId: "orc-1",
      capability: "record",
      name: "job.record.happy",
      given: { address: "1 Main St", owner: "Ada" },
      expect: expectShape({ id: "p-1", history: [] }),
      kind: "pure",
      source: "a7",
      approval: "pending",
    };
  }

  it("accepts a well-formed pending case and an approved human-authored case", () => {
    assert.deepEqual(validateFixtureCase(validCase()), { ok: true, errors: [] });
    const human = caseWith(validCase(), {
      id: "h-1",
      requirementId: "req-1",
      source: "human",
      approval: "approved",
    });
    assert.equal(validateFixtureCase(human).ok, true);
    assert.deepEqual(validateFixtureSet([validCase(), caseWith(validCase(), { id: "cap-1" })]), {
      ok: true,
      errors: [],
    });
  });

  it("rejects a code-string expect (executable expression smuggled as output)", () => {
    const bad = caseWith(validCase(), {
      expect: expectShape({ ok: "actual => actual.id" }) as BriefFixtureExpect,
    });
    const v = validateFixtureCase(bad);
    assert.equal(v.ok, false);
    assert.equal(v.errors.some((e) => e.includes("expect.value") && e.includes("code")), true);
  });

  it("rejects a code-string messagePattern and a free-text property name", () => {
    const throwsBad = caseWith(validCase(), {
      expect: { kind: "throws", messagePattern: 'throw new Error("denied")' },
    });
    const tv = validateFixtureCase(throwsBad);
    assert.equal(tv.ok, false);
    assert.equal(tv.errors.some((e) => e.includes("messagePattern")), true);

    const propertyBad = caseWith(validCase(), {
      expect: { kind: "property", name: "always fresh id" },
    });
    const pv = validateFixtureCase(propertyBad);
    assert.equal(pv.ok, false);
    assert.equal(pv.errors.some((e) => e.includes("registry identifier")), true);

    const propertyOk = caseWith(validCase(), {
      kind: "property",
      expect: { kind: "property", name: "historyEmptyOnCreate" },
    });
    assert.equal(validateFixtureCase(propertyOk).ok, true);
  });

  it("rejects non-plain-JSON given (function, undefined prop, NaN) and code-string leaves", () => {
    assert.equal(
      validateFixtureCase(caseWith(validCase(), { given: { cb: (() => 1) as unknown } })).ok,
      false,
    );
    assert.equal(
      validateFixtureCase(caseWith(validCase(), { given: { id: undefined as unknown } })).ok,
      false,
    );
    assert.equal(validateFixtureCase(caseWith(validCase(), { given: { n: NaN } })).ok, false);
    const codeLeaf = validateFixtureCase(
      caseWith(validCase(), { given: { address: "1 Main => 2" } }),
    );
    assert.equal(codeLeaf.ok, false);
    assert.equal(codeLeaf.errors.some((e) => e.includes("given.address")), true);
  });

  it("rejects unsupported kind/source/approval and set-level duplicate ids", () => {
    assert.equal(
      validateFixtureCase(caseWith(validCase(), { kind: "nope" as BriefFixtureCase["kind"] })).ok,
      false,
    );
    assert.equal(
      validateFixtureCase(caseWith(validCase(), { source: "llm" as BriefFixtureCase["source"] })).ok,
      false,
    );
    const dup = validateFixtureSet([validCase(), validCase()]);
    assert.equal(dup.ok, false);
    assert.equal(dup.errors.some((e) => e.includes("duplicate case id")), true);
  });

  it("isPlainJsonLiteral is precise about JSON-carriable data", () => {
    assert.equal(isPlainJsonLiteral({ a: [1, "x", null, true] }), true);
    assert.equal(isPlainJsonLiteral({ a: undefined }), false);
    assert.equal(isPlainJsonLiteral({ a: NaN }), false);
    assert.equal(isPlainJsonLiteral(new Date()), false);
    assert.equal(isPlainJsonLiteral(() => 1), false);
    assert.equal(isPlainJsonLiteral(undefined), false);
    assert.equal(isPlainJsonLiteral(null), true);
    assert.equal(isPlainJsonLiteral(Infinity), false);
    assert.equal(BRIEF_FIXTURE_KINDS.includes("pure"), true);
  });
});

// ---------------------------------------------------------------------------
// fixtureApprovalGate + approveFixtureCases — human approval owns "functional"
// ---------------------------------------------------------------------------

describe("fixtureApprovalGate + approveFixtureCases", () => {
  function draftCases(): BriefFixtureCase[] {
    return draftBriefFixtures({
      oracle: sampleOracle(),
      capabilities: SAMPLE_CAPABILITIES,
      typed: typedForAll(),
    }).cases;
  }

  it("blocks on an all-pending draft and lists every blocking requirement", () => {
    const cases = draftCases();
    const gate = fixtureApprovalGate(cases);
    assert.equal(gate.ok, false, "a run may not claim functional on pending candidates");
    assert.equal(gate.total, 5);
    assert.equal(gate.approved, 0);
    assert.deepEqual(gate.unapprovedIds, ["orc-1", "orc-2", "orc-c-credit-check", "cap-1", "cap-2"]);
    assert.deepEqual(
      gate.unapproved.map((c) => c.id),
      gate.unapprovedIds,
    );
  });

  it("stays blocked on partial approval (subset of ids)", () => {
    const approved = approveFixtureCases(draftCases(), ["orc-1", "cap-1"]);
    const gate = fixtureApprovalGate(approved);
    assert.equal(gate.ok, false);
    assert.equal(gate.approved, 2);
    assert.deepEqual(gate.unapprovedIds, ["orc-2", "orc-c-credit-check", "cap-2"]);
  });

  it("passes only when every case is explicitly approved — never automatically", () => {
    const approved = approveAllFixtureCases(draftCases());
    const gate = fixtureApprovalGate(approved);
    assert.equal(gate.ok, true);
    assert.equal(gate.total, 5);
    assert.equal(gate.approved, 5);
    assert.deepEqual(gate.unapproved, []);
  });

  it("blocks an empty set (no cases ⇒ no functional claim)", () => {
    const gate = fixtureApprovalGate([]);
    assert.equal(gate.ok, false);
    assert.equal(gate.total, 0);
  });

  it("drafter output stays pending — nothing in the module auto-approves", () => {
    const cases = draftCases();
    // Immediate gate right after drafting: still blocked (pending by default).
    assert.equal(fixtureApprovalGate(cases).ok, false);
    assert.equal(cases.every((c) => c.approval === "pending"), true);
  });

  it("approveFixtureCases is pure: input untouched, unknown ids ignored", () => {
    const cases = draftCases();
    const before = JSON.stringify(cases);
    const after = approveFixtureCases(cases, ["nope-1", "orc-1"]);
    assert.equal(JSON.stringify(cases), before, "input array is not mutated");
    assert.equal(after[0].approval, "approved");
    assert.equal(cases[0].approval, "pending");
    assert.equal(fixtureApprovalGate(after).unapprovedIds.includes("orc-1"), false);
  });

  it("draft never mints decidedBy; approve without opts never mints decidedBy:human", () => {
    const cases = draftCases();
    assert.ok(cases.every((c) => c.decidedBy === undefined), "drafter must not stamp decidedBy");
    const bare = approveFixtureCases(cases, ["orc-1"]);
    assert.equal(bare[0]!.approval, "approved");
    assert.equal(bare[0]!.decidedBy, undefined, "no default decidedBy:human");
    // Forged prior decidedBy:human is stripped when opts omit decidedBy
    const forged: BriefFixtureCase = { ...cases[0]!, decidedBy: "human" };
    const stripped = approveFixtureCases([forged], [forged.id]);
    assert.equal(stripped[0]!.approval, "approved");
    assert.equal(stripped[0]!.decidedBy, undefined, "forged human provenance stripped without opts");
  });

  it("approve with explicit decidedBy:human stamps only when opted in", () => {
    const cases = draftCases();
    const human = approveFixtureCases(cases, ["orc-1"], { decidedBy: "human" });
    assert.equal(human[0]!.decidedBy, "human");
    const auto = approveAllFixtureCases(cases, { decidedBy: "autopilot" });
    assert.ok(auto.every((c) => c.decidedBy === "autopilot"));
    assert.throws(
      () => approveFixtureCases(cases, ["orc-1"], { decidedBy: "agent" as "human" }),
      /decidedBy/,
    );
  });
});

describe("A1 coerceAcceptanceFixtures + C2 target", () => {
  function validCase(): BriefFixtureCase {
    return {
      id: "orc-1",
      requirementId: "orc-1",
      capability: "record",
      name: "job.record.happy",
      given: { address: "1 Main St", owner: "Ada" },
      expect: { kind: "shape", value: { id: "p-1" } },
      kind: "pure",
      source: "a7",
      approval: "pending",
    };
  }

  it("absence / null / [] / non-array → value undefined (never [])", () => {
    assert.equal(coerceAcceptanceFixtures(undefined).value, undefined);
    assert.equal(coerceAcceptanceFixtures(null).value, undefined);
    assert.equal(coerceAcceptanceFixtures([]).value, undefined);
    assert.equal(coerceAcceptanceFixtures("nope").containerDropped, true);
    assert.equal(coerceAcceptanceFixtures("nope").value, undefined);
  });

  it("keeps a valid case (copy) and optional target; drops invalid rows", () => {
    const src = { ...validCase(), target: "createProperty" };
    const r = coerceAcceptanceFixtures([src, { id: "" }, null, validCase()]);
    assert.equal(r.dropped, 2);
    assert.equal(r.value?.length, 2);
    assert.equal(r.value?.[0]?.target, "createProperty");
    assert.notEqual(r.value?.[0], src, "copied, not aliased");
    src.approval = "approved";
    assert.equal(r.value?.[0]?.approval, "pending", "copy is independent");
  });

  it("validateFixtureCase accepts target when a non-empty string; rejects empty", () => {
    assert.equal(validateFixtureCase({ ...validCase(), target: "createProperty" }).ok, true);
    assert.equal(validateFixtureCase({ ...validCase(), target: "" }).ok, false);
    assert.equal(validateFixtureCase(validCase()).ok, true, "absent target is legal");
  });

  it("A2 approvedAcceptanceFixtures is null unless every case is approved", () => {
    const pending = { ...validCase(), approval: "pending" as const, target: "createProperty" };
    const approved = { ...validCase(), approval: "approved" as const, target: "createProperty" };
    assert.equal(approvedAcceptanceFixtures([pending]), null);
    assert.equal(approvedAcceptanceFixtures([approved, pending]), null);
    assert.equal(approvedAcceptanceFixtures([approved])?.length, 1);
    assert.equal(approvedAcceptanceFixtures(undefined), null);
  });

  it("A2 compileFixtureAssertion JSON-escapes given; throws uses includes; property red-cards", () => {
    const shape = compileFixtureAssertion({
      ...validCase(),
      approval: "approved",
      target: "createProperty",
      given: { address: "1 Main" },
      expect: { kind: "shape", value: { id: "p-1", history: [] } },
    });
    assert.equal(shape.ok, true);
    if (shape.ok) {
      assert.ok(shape.body.includes(JSON.stringify({ address: "1 Main" })));
      assert.ok(shape.body.includes("__fxPartialMatch"));
      assert.ok(!shape.body.includes("${"), "no template interpolation of given");
    }
    const thr = compileFixtureAssertion({
      ...validCase(),
      approval: "approved",
      target: "createProperty",
      kind: "effect",
      expect: { kind: "throws", messagePattern: "required" },
    });
    assert.equal(thr.ok, true);
    if (thr.ok) assert.ok(thr.body.includes('.includes("required")'));
    const prop = compileFixtureAssertion({
      ...validCase(),
      approval: "approved",
      target: "createProperty",
      expect: { kind: "property", name: "idempotentCreate" },
    });
    assert.equal(prop.ok, false);
  });

  it("A5.0 draftTypedLiterals unblocks draftBriefFixtures; merge never clobbers approved", () => {
    const oracle = [
      { id: "orc-1", name: "job.record.happy", job: "record", given: "x", expect: "y" },
    ];
    const typed = draftTypedLiterals({ oracle: oracle as never, capabilities: ["record"] });
    assert.ok(typed["orc-1"]);
    const draft = draftBriefFixtures({ oracle: oracle as never, capabilities: ["record"], typed });
    assert.ok(draft.cases.length >= 1, JSON.stringify(draft.redCards));
    assert.ok(draft.cases.every((c) => c.approval === "pending"));
    const approved = approveFixtureCases(draft.cases, [draft.cases[0]!.id]);
    const again = mergeDraftedFixtures(approved, draft.cases);
    assert.equal(again.find((c) => c.id === draft.cases[0]!.id)?.approval, "approved");
  });

  it("coerce copies decidedBy only when enum-valid; never invents human", () => {
    const withHuman = {
      ...validCase(),
      approval: "approved" as const,
      decidedBy: "human" as const,
    };
    const withJunk = { ...validCase(), id: "orc-2", requirementId: "orc-2", decidedBy: "agent" };
    const r = coerceAcceptanceFixtures([withHuman, withJunk, validCase()]);
    assert.equal(r.value?.find((c) => c.id === "orc-1")?.decidedBy, "human");
    // junk decidedBy fails validate → dropped (or stripped). Either way not invented.
    const junkKept = r.value?.find((c) => c.id === "orc-2");
    if (junkKept) assert.equal(junkKept.decidedBy, undefined);
    const plain = coerceAcceptanceFixtures([validCase()]);
    assert.equal(plain.value?.[0]?.decidedBy, undefined);
    assert.equal(
      validateFixtureCase({ ...validCase(), decidedBy: "agent" as "human" }).ok,
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// A1-01 (fixes/344): a draft sentinel ("<draft>"/"<any>") is NOT an acceptance
// bar. The drafter mints sentinels to unblock the draft flow; a human may
// approve them, but they assert nothing real — no gate, emit guard, compiler,
// or matcher may treat such a row as substantive.
// ---------------------------------------------------------------------------

describe("A1-01 — placeholder sentinels are not substantive fixtures", () => {
  function placeholderCase(): BriefFixtureCase {
    return {
      id: "orc-draft",
      requirementId: "orc-draft",
      capability: "record",
      name: "job.record.happy",
      given: {},
      expect: { kind: "shape", value: { id: "<draft>" } },
      kind: "pure",
      source: "a7",
      approval: "approved",
      decidedBy: "human",
      target: "createProperty",
    };
  }
  function realCase(): BriefFixtureCase {
    return {
      ...placeholderCase(),
      id: "orc-real",
      requirementId: "orc-real",
      given: { address: "1 Main St" },
      expect: { kind: "shape", value: { id: "p-1" } },
    };
  }

  it("fixtureApprovalGate does not call a fully-approved placeholder set ok", () => {
    const gate = fixtureApprovalGate([placeholderCase()]);
    assert.equal(gate.ok, false, "approved sentinels assert nothing — the gate must refuse");
    assert.deepEqual(gate.placeholderIds, ["orc-draft"]);
    assert.equal(fixtureApprovalGate([realCase()]).ok, true, "a real typed-literal set is unaffected");
  });

  it("approvedAcceptanceFixtures refuses a placeholder set; a real set still folds", () => {
    assert.equal(approvedAcceptanceFixtures([placeholderCase()]), null, "a sentinel bar never emits");
    assert.equal(
      approvedAcceptanceFixtures([placeholderCase(), { ...placeholderCase(), id: "orc-2", requirementId: "orc-2" }]),
      null,
    );
    assert.equal(approvedAcceptanceFixtures([realCase()])?.length, 1);
  });

  it("compileFixtureAssertion red-cards a placeholder case; the emitted matcher carries no sentinel escape", () => {
    const compiled = compileFixtureAssertion(placeholderCase());
    assert.equal(compiled.ok, false, "a sentinel must never compile to a vacuous assertion");
    if (!compiled.ok) assert.match(compiled.reason, /placeholder/i);
    const helper = fixtureMatchHelperSource();
    assert.ok(
      !helper.includes("<draft>") && !helper.includes("<any>"),
      "the emitted matcher must have no sentinel escape hatch",
    );
  });
});

// ---------------------------------------------------------------------------
// 346 E1 (L1-F5): an EMPTY-OBJECT shape value (`{}`) is not a sentinel, so the
// A1-01 placeholder scan missed it — yet `__fxPartialMatch(actual, {})` is true
// for ANY object (Object.keys of an empty expectation trivially `.every`). Such
// a row asserts only "returns an object"; it is rejected at the same seam the
// placeholder rule uses (case predicate + compile red-card). An empty ARRAY is
// NOT vacuous (346 A6): the matcher's array branch is an exact-length check, so
// `[]` is a substantive bar and stays accepted.
// ---------------------------------------------------------------------------

describe("346 E1 L1-F5 — an empty expect.shape is near-vacuous and refused", () => {
  function emptyShapeCase(): BriefFixtureCase {
    return {
      id: "orc-empty",
      requirementId: "orc-empty",
      capability: "record",
      name: "job.record.happy",
      given: { address: "1 Main St" },
      expect: { kind: "shape", value: {} },
      kind: "pure",
      source: "human",
      approval: "approved",
      decidedBy: "human",
      target: "createProperty",
    };
  }

  it("fixtureShapeValueIsVacuous recognises only an empty OBJECT (not [])", () => {
    assert.equal(fixtureShapeValueIsVacuous({}), true);
    assert.equal(fixtureShapeValueIsVacuous([]), false);
    assert.equal(fixtureShapeValueIsVacuous({ id: "p-1" }), false);
    assert.equal(fixtureShapeValueIsVacuous([1]), false);
    assert.equal(fixtureShapeValueIsVacuous("x"), false);
    assert.equal(fixtureShapeValueIsVacuous(null), false);
  });

  it("the approval gate refuses a fully-approved empty-shape bar", () => {
    const gate = fixtureApprovalGate([emptyShapeCase()]);
    assert.equal(gate.ok, false, "an empty-shape row asserts nothing real");
    assert.deepEqual(gate.placeholderIds, ["orc-empty"]);
  });

  it("approvedAcceptanceFixtures and compileFixtureAssertion refuse it", () => {
    assert.equal(approvedAcceptanceFixtures([emptyShapeCase()]), null, "never emits a vacuous bar");
    const compiled = compileFixtureAssertion(emptyShapeCase());
    assert.equal(compiled.ok, false, "an empty shape must never compile to a vacuous assertion");
    if (!compiled.ok) assert.match(compiled.reason, /empty/i);
  });

  it("a non-empty shape still compiles (real behavioural row unaffected)", () => {
    const real = { ...emptyShapeCase(), expect: { kind: "shape" as const, value: { id: "p-1" } } };
    assert.equal(fixtureShapeValueIsVacuous((real.expect as { value: unknown }).value), false);
    assert.equal(compileFixtureAssertion(real).ok, true);
    assert.equal(approvedAcceptanceFixtures([real])?.length, 1);
  });

  // 346 A6: an EMPTY-ARRAY shape is a REAL exact-length assertion, not a
  // vacuous one. `__fxPartialMatch(actual, [])` is true ONLY for an empty
  // array (the helper's array branch checks `actual.length !== 0`), rejecting
  // [1] / {} / "x" — so treating [] as a placeholder falsely refused a
  // legitimate "returns []" acceptance bar. Only an empty OBJECT is vacuous.
  it("an empty-array shape is a substantive bar, not a placeholder", () => {
    const helperJs = stripTypeScriptTypes(fixtureMatchHelperSource(), { mode: "strip" });
    const match = new Function(`${helperJs}\nreturn __fxPartialMatch;`)() as (
      a: unknown,
      e: unknown,
    ) => boolean;
    assert.equal(match([], []), true, "empty array matches the empty expectation");
    assert.equal(match([1], []), false, "a non-empty array must NOT match []");
    assert.equal(match({}, []), false, "an object must NOT match []");
    assert.equal(match("x", []), false, "a primitive must NOT match []");

    const emptyArrayCase: BriefFixtureCase = {
      ...emptyShapeCase(),
      expect: { kind: "shape", value: [] },
    };
    assert.equal(fixtureShapeValueIsVacuous([]), false, "[] is not vacuous");
    assert.equal(fixtureCaseIsPlaceholder(emptyArrayCase), false, "an [] shape asserts something real");
    assert.equal(compileFixtureAssertion(emptyArrayCase).ok, true, "an [] shape compiles");
    assert.equal(approvedAcceptanceFixtures([emptyArrayCase])?.length, 1, "an [] bar is approved, not refused");
    assert.equal(fixtureApprovalGate([emptyArrayCase]).ok, true, "the gate admits an [] bar");
  });
});
