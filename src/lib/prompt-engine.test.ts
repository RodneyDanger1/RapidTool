// W359 PAUSED 2026-10-15 - work in progress; see wave_plans/W359/HANDOFF.md for what landed, what is half-done and what is left.
// ---------------------------------------------------------------------------
// prompt-engine.test.ts â€” hyper-prompt expansion + policy constraints
// (handoff pillar 3 + pillar 6; fixes/64_pillars_prompt.md).
// Run: node --experimental-strip-types --test src/lib/prompt-engine.test.ts
//
// Keyed tests stub globalThis.fetch (algo-tools.test.ts recipe) and delete the
// env key in beforeEach â€” node --test isolates each file in its own child
// process, so the env dance never leaks into sibling suites.
// ---------------------------------------------------------------------------
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyPolicies,
  expandBrief,
  expandedSpecViolations,
  parseExpandedSpecJson,
  rankBriefLessons,
  lessonLinesForBrief,
  provenToLessonRow,
  repairSystemPrompt,
  REPAIR_PRESERVED_RULES,
  REPAIR_FORBIDDEN_PRIMITIVE_NAMES,
  REPAIR_REFUSAL_ENVELOPE,
  type ExpandedSpec,
  EXPAND_BRIEF_MAX_CHARS,
  EXPAND_POLICY_MAX_CHARS,
  EXPAND_POLICY_MAX_COUNT,
  EXPAND_LESSON_MAX_CHARS,
  EXPAND_LESSON_MAX_COUNT,
  EXPAND_LESSON_RANK_LIMIT,
  EXPANDED_SPEC_KEYS,
  EXPANSION_REPAIR_LINE,
  DELIVERY_KIND_SPEC,
} from "./prompt-engine.ts";
// PR-18 prompt/validator parity: the validator side lives in codegen.server.ts
// (S's file) â€” imported READ-ONLY so the pure repair prompt's advertised rules
// can be checked against the checks that actually enforce them.
import {
  compactModuleUnderBound,
  contractTypeRedeclarations,
  crossChunkDuplicateDeclarations,
  forbiddenPrimitiveHit,
  FORBIDDEN_PRIMITIVE_NAMES,
  implicitAnyParameters,
  jsxHits,
  jsxNamespaceHits,
  materializedCjsResidueHits,
  missingSignatureNames,
  moneySemanticsHits,
  nondeterministicPrimitiveHit,
  P6_MODULE_MAX_CHARS,
  p6SynthesisBriefFitRepairPrompt,
  p6SynthesisExportRepairPrompt,
  p6SynthesisForbiddenRepairPrompt,
  p6SynthesisRepairPrompt,
  p6SynthesisSignatureRepairPrompt,
  proseLineHits,
  suppressionPragmaHit,
  unawaitedAsyncValueUses,
  unboundExportNames,
  validateSynthesisModule,
} from "./codegen.server.ts";
import { LESSON_TEXT_MAX, lessonRow } from "./knowledge.ts";
import { BRIEF_TEMPLATES } from "./templates.ts";
import { DELIVERY_KINDS, type DeliveryKind } from "./types.ts";
import type { MemoryEntry } from "./types.ts";

const KEY = "DEEPSEEK_API_KEY";
const realFetch = globalThis.fetch;

beforeEach(() => {
  delete process.env[KEY];
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env[KEY];
});

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const FULL_SPEC: ExpandedSpec = {
  requirements: [
    "Track delivery deadlines per order.",
    "Notify the operator before a deadline passes.",
  ],
  edgeCases: ["Zero orders on day one.", "Two orders share one deadline."],
  errorHandling: ["Deadline store unavailable: keep latest known state and log."],
  typeSignatures: ["createOrder(items: CartItem[]): Promise<Order>"],
  dataFlow: ["order form -> validation -> deadline store -> notification queue"],
  negativeConstraints: ["DO NOT add authentication.", "DO NOT use external ORMs."],
};

function modelReply(spec: unknown): unknown {
  return {
    model: "deepseek-v4-flash",
    choices: [{ message: { content: JSON.stringify(spec) } }],
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  };
}

function expandedViaFetch(
  body: unknown,
  onRequest?: (init: RequestInit) => void,
): typeof globalThis.fetch {
  return (async (_url: unknown, init?: RequestInit) => {
    onRequest?.(init ?? {});
    return okResponse(modelReply(body));
  }) as typeof fetch;
}

/** Serve one model reply per request (the last one repeats), recording every
 *  real request body so a test can assert exactly what crossed the wire. */
function sequencedFetch(replies: unknown[]): {
  fetch: typeof globalThis.fetch;
  bodies: () => Array<Record<string, unknown>>;
} {
  const bodies: Array<Record<string, unknown>> = [];
  let i = 0;
  // Explicit annotation on a NON-shadowing local: naming this `fetch` made the
  // return type's `typeof fetch` resolve to the local being declared (TS7022).
  const stub: typeof globalThis.fetch = async (
    _url: unknown,
    init?: RequestInit,
  ): Promise<Response> => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const reply = replies[Math.min(i, replies.length - 1)];
    i += 1;
    return okResponse(modelReply(reply));
  };
  return { fetch: stub, bodies: () => bodies };
}

// ---------------------------------------------------------------------------
// parseExpandedSpecJson â€” pure parser/normalizer
// ---------------------------------------------------------------------------

describe("parseExpandedSpecJson", () => {
  it("parses a full payload into the fixed six-key shape, tolerant of fences", () => {
    const parsed = parseExpandedSpecJson(`\`\`\`json\n${JSON.stringify(FULL_SPEC)}\n\`\`\``);
    assert.deepEqual(parsed, FULL_SPEC);
  });

  it("normalizes deterministically: trims, drops empties/non-strings, dedupes, fills missing keys", () => {
    const parsed = parseExpandedSpecJson(
      JSON.stringify({
        requirements: ["  one  ", "one", "", "  two", 42, "one"],
        edgeCases: null,
        // dataFlow, typeSignatures, errorHandling, negativeConstraints absent
      }),
    );
    assert.deepEqual(parsed, {
      requirements: ["one", "two"],
      edgeCases: [],
      errorHandling: [],
      typeSignatures: [],
      dataFlow: [],
      negativeConstraints: [],
    });
  });

  it("returns null for non-JSON, non-object, or requirement-less payloads", () => {
    assert.equal(parseExpandedSpecJson("just prose, not JSON"), null);
    assert.equal(parseExpandedSpecJson("[1, 2, 3]"), null);
    assert.equal(parseExpandedSpecJson('{"edgeCases": ["a"]}'), null);
    assert.equal(parseExpandedSpecJson(""), null);
  });
});

// ---------------------------------------------------------------------------
// expandedSpecViolations â€” the strict, deterministic envelope check
// ---------------------------------------------------------------------------

describe("expandedSpecViolations â€” deterministic envelope check", () => {
  it("returns [] for a conforming six-key spec object", () => {
    assert.deepEqual(expandedSpecViolations(FULL_SPEC), []);
  });

  it("names every missing key in canonical order, deterministically", () => {
    assert.deepEqual(expandedSpecViolations({ requirements: ["x"] }), [
      'missing key "edgeCases"',
      'missing key "errorHandling"',
      'missing key "typeSignatures"',
      'missing key "dataFlow"',
      'missing key "negativeConstraints"',
    ]);
  });

  it("flags an empty requirements list and a malformed (non-array) field", () => {
    assert.deepEqual(
      expandedSpecViolations({ ...FULL_SPEC, requirements: [], edgeCases: "nope" }),
      ['"requirements" has no usable entries', '"edgeCases" is not an array'],
    );
  });

  it("rejects non-objects and junk deterministically", () => {
    for (const value of [null, undefined, 42, "text", [FULL_SPEC]]) {
      assert.deepEqual(expandedSpecViolations(value), ["reply is not a JSON object"]);
    }
  });

  it("names a non-string/blank element by index (the silent-default class this lane closes)", () => {
    // verifier-B Case A: six arrays, five of them containing only wrong-typed
    // elements â€” HEAD accepted this and silently defaulted them to [].
    assert.deepEqual(
      expandedSpecViolations({
        requirements: ["Track delivery deadlines per order."],
        edgeCases: [42, null, { nested: true }],
        errorHandling: [{}],
        typeSignatures: [null],
        dataFlow: [[]],
        negativeConstraints: [true],
      }),
      [
        '"edgeCases" has non-string or blank entries at index 0, 1, 2',
        '"errorHandling" has non-string or blank entries at index 0',
        '"typeSignatures" has non-string or blank entries at index 0',
        '"dataFlow" has non-string or blank entries at index 0',
        '"negativeConstraints" has non-string or blank entries at index 0',
      ],
    );
  });

  it("rejects a nested-object element â€” no key is an array of objects", () => {
    // verifier-B Case D: every one of the six keys is a STRING array
    // (Project.implementationSpec), so an object element is a type violation.
    assert.deepEqual(
      expandedSpecViolations({ ...FULL_SPEC, typeSignatures: [{ signature: { nested: ["x"] } }] }),
      ['"typeSignatures" has non-string or blank entries at index 0'],
    );
  });

  it("tolerates extra top-level keys (the persisted record carries provenance keys)", () => {
    // Decision, pinned: the six keys are a MINIMUM shape, not an exact set â€”
    // codegen.server.ts re-validates the persisted implementationSpec (which
    // carries source/briefHash/createdAt) with this same function, so a
    // forbidden-extras rule would strand every cached spec.
    assert.deepEqual(
      expandedSpecViolations({ ...FULL_SPEC, evilExtra: { deeply: { wrong: 1 } } }),
      [],
    );
  });

  it("allows an explicit [] on the five non-requirements keys but not on requirements", () => {
    const emptyOk = {
      requirements: ["Ship it."],
      edgeCases: [],
      errorHandling: [],
      typeSignatures: [],
      dataFlow: [],
      negativeConstraints: [],
    };
    assert.deepEqual(
      expandedSpecViolations(emptyOk),
      [],
      "explicit [] is the model's stated answer, not a dropped element",
    );
    assert.deepEqual(
      expandedSpecViolations({ ...emptyOk, requirements: [] }),
      ['"requirements" has no usable entries'],
    );
  });
});

// ---------------------------------------------------------------------------
// expansionPrompt â€” brief fidelity, truncation honesty, build-ready framing
// (fixes/95 F5: prompt quality)
// ---------------------------------------------------------------------------

/** Run expandBrief against the fetch stub and return the captured user content. */
async function captureUserContent(
  brief: string,
  policies?: readonly string[],
): Promise<string> {
  process.env[KEY] = "sk-test";
  let userContent = "";
  globalThis.fetch = expandedViaFetch(FULL_SPEC, (init) => {
    const body = JSON.parse(String(init.body)) as {
      messages?: Array<{ content?: string }>;
    };
    userContent =
      body.messages?.find((m) => m.content?.includes("Brief:"))?.content ?? "";
  });
  const res = await expandBrief(brief, policies);
  assert.equal(res.ok, true, "stub expansion succeeds so the prompt can be inspected");
  return userContent;
}

describe("expansionPrompt fidelity + build-ready framing (fixes/95)", () => {
  it("carries three real product briefs VERBATIM and demands full coverage + test-verifiable phrasing", async () => {
    for (const t of BRIEF_TEMPLATES) {
      if (t.id !== "dispatch" && t.id !== "clinic" && t.id !== "market") continue;
      const content = await captureUserContent(t.brief);
      assert.ok(content.includes(t.brief), `${t.id}: brief verbatim on the wire`);
      assert.ok(content.includes("BUILD-READY"), `${t.id}: build-ready framing`);
      assert.ok(
        content.includes("so a test can observe and verify it"),
        `${t.id}: test-observable phrasing demanded`,
      );
      assert.ok(
        content.includes("none of the brief's asks may be dropped"),
        `${t.id}: full-coverage rule present`,
      );
      assert.ok(
        content.includes("Every requirement must trace to a sentence in the brief"),
        `${t.id}: traceability-to-brief rule present`,
      );
      assert.ok(
        content.includes("at least one signature for EVERY requirement"),
        `${t.id}: signature-coverage rule present (fixes/215d â€” one module per capability)`,
      );
    }
  });

  it("marks an over-budget brief with a truncation marker instead of silently slicing it", async () => {
    const tail = "TAIL_SENTINEL_MUST_NOT_APPEAR";
    const brief = "Z".repeat(EXPAND_BRIEF_MAX_CHARS + 200) + tail;
    const content = await captureUserContent(brief);
    const after = content.slice(content.indexOf("Brief:") + "Brief:".length + 1);
    const head = after.slice(0, after.indexOf("\n"));
    assert.equal(head.length, EXPAND_BRIEF_MAX_CHARS, "brief head cut exactly at the cap");
    assert.ok(
      after.includes("[TRUNCATED â€” input longer than the budget cap"),
      "the cut is marked â€” the model can see evidence was dropped",
    );
    assert.ok(!content.includes(tail), "the tail beyond the cap never reaches the model");
  });

  it("fixes/348: a realistic 8k-char brief reaches the model IN FULL (the non-negotiables are not sliced)", async () => {
    const filler = "Build the menu, the admin order queue and the staff ordering app. ".repeat(120);
    const brief =
      "# Bloedow Bakery â€” Website\n\n" +
      filler +
      "\n\n## Non-negotiables\n- No invented prices. NONNEGOTIABLE_TAIL_SENTINEL";
    assert.ok(brief.length > 4_000 && brief.length <= EXPAND_BRIEF_MAX_CHARS, `fixture is a realistic over-4k brief (${brief.length})`);
    const content = await captureUserContent(brief);
    assert.ok(content.includes(brief), "the WHOLE brief rides the wire");
    assert.ok(content.includes("NONNEGOTIABLE_TAIL_SENTINEL"), "the non-negotiables reach the model");
    assert.ok(!content.includes("[TRUNCATED"), "nothing was cut");
  });

  it("caps the policy list at EXPAND_POLICY_MAX_COUNT and marks over-long policies", async () => {
    const long =
      "DO NOT vendor a dependency beyond the policy character budget " +
      "w".repeat(EXPAND_POLICY_MAX_CHARS) +
      " LONGTAIL_MUST_NOT_APPEAR";
    const shortOnes: string[] = [];
    for (let i = 0; i < EXPAND_POLICY_MAX_COUNT; i++) {
      shortOnes.push(`DO NOT add policy ${i} unless really needed here`);
    }
    const content = await captureUserContent("Build a fleet healthcheck tool", [
      long,
      ...shortOnes,
    ]);
    const block = content.slice(content.indexOf("Policy constraints ("));
    const bullets = block.split("\n").filter((l) => l.startsWith("- "));
    assert.equal(bullets.length, EXPAND_POLICY_MAX_COUNT, "policy count capped at 12");
    assert.ok(content.includes("â€¦[TRUNCATED]"), "over-long policy is cut WITH a marker");
    assert.ok(!content.includes("LONGTAIL_MUST_NOT_APPEAR"), "policy tail never reaches the model");
    // The 13th distinct policy (shortOnes[11]) is dropped by the count cap â€”
    // and the drop is MARKED, never silent (W49/335-1: the module contract).
    assert.ok(!content.includes("DO NOT add policy 11 unless"), "beyond-count policy dropped");
    assert.ok(
      content.includes("POLICIES-ELIDED: 1 policy row(s)"),
      "the beyond-count drop is marked with its count, never a silent slice",
    );
  });
});

// ---------------------------------------------------------------------------
// expandBrief â€” keyed hyper-prompt expansion
// ---------------------------------------------------------------------------

describe("expandBrief", () => {
  it("returns honest not-configured when the key is deleted (no fetch)", async () => {
    globalThis.fetch = (async () => {
      throw new Error("fetch must not run keyless");
    }) as typeof fetch;
    assert.deepEqual(await expandBrief("Build a fleet healthcheck tool"), {
      ok: false,
      reason: "not-configured",
    });
  });

  it("rejects an empty/whitespace brief pre-network when configured", async () => {
    process.env[KEY] = "sk-test";
    globalThis.fetch = (async () => {
      throw new Error("fetch must not run for a blank brief");
    }) as typeof fetch;
    assert.deepEqual(await expandBrief("   \n\t "), {
      ok: false,
      reason: "error",
      error: "brief must be a non-empty string",
    });
  });

  it("expands a brief via flash json:true and returns the parsed spec", async () => {
    process.env[KEY] = "sk-test";
    // Closure-mutated capture (algo-tools.test.ts pattern): initialize the
    // container non-null so TS never narrows it to never past the await.
    const captured: { body: RequestInit } = { body: {} };
    globalThis.fetch = expandedViaFetch(FULL_SPEC, (init) => {
      captured.body = init ?? {};
    });
    const res = await expandBrief("Build a fleet healthcheck tool");
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(res.spec, FULL_SPEC);

    const body = JSON.parse(String(captured.body.body)) as {
      model?: unknown;
      messages?: Array<{ content?: string }>;
      response_format?: unknown;
      thinking?: unknown;
      max_tokens?: unknown;
    };
    assert.equal(body.model, "deepseek-v4-flash", "flash tier pinned explicitly");
    assert.deepEqual(body.response_format, { type: "json_object" }, "json:true on the wire");
    assert.deepEqual(body.thinking, { type: "disabled" }, "flash thinking disabled");
    assert.equal(body.max_tokens, 3000, "generous budget for an exhaustive spec");
    const userMsg = body.messages?.find((m) => m.content?.includes("Brief:"));
    assert.ok(userMsg?.content?.includes("Build a fleet healthcheck tool"));
  });

  it("feeds policies into the prompt when provided (and the brief stays intact)", async () => {
    process.env[KEY] = "sk-test";
    let userContent = "";
    globalThis.fetch = expandedViaFetch(FULL_SPEC, (init) => {
      const body = JSON.parse(String(init.body)) as { messages?: Array<{ content?: string }> };
      userContent =
        body.messages?.find((m) => m.content?.includes("Brief:"))?.content ?? "";
    });
    const res = await expandBrief("Build a fleet healthcheck tool", [
      "DO NOT use external ORMs",
      "   ",
      "DO NOT use external ORMs",
    ]);
    assert.equal(res.ok, true);
    assert.ok(userContent.includes("Policy constraints (the build must obey these"));
    assert.ok(userContent.includes("- DO NOT use external ORMs"));
    assert.ok(userContent.includes("Build a fleet healthcheck tool"));
  });

  it("returns a CODED error (never a fabricated spec) on unparseable model JSON", async () => {
    process.env[KEY] = "sk-test";
    globalThis.fetch = (async () =>
      okResponse({
        model: "deepseek-v4-flash",
        choices: [{ message: { content: "Here is a lovely prose specâ€¦" } }],
      })) as typeof fetch;
    const res = await expandBrief("Build a fleet healthcheck tool");
    assert.deepEqual(res, {
      ok: false,
      reason: "error",
      code: "RT_E_VALIDATION",
      error: "model returned a non-conforming expansion payload: reply is not a JSON object",
    });
  });

  it("returns a coded error when the model omits requirements entirely", async () => {
    process.env[KEY] = "sk-test";
    globalThis.fetch = expandedViaFetch({ edgeCases: ["x"], negativeConstraints: [] });
    const res = await expandBrief("Build a fleet healthcheck tool");
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.reason, "error");
    assert.equal(res.code, "RT_E_VALIDATION");
    assert.match(res.error ?? "", /non-conforming expansion payload/);
    assert.match(res.error ?? "", /missing key "requirements"/);
  });

  it("propagates a rejected backend as an honest error result", async () => {
    process.env[KEY] = "sk-test";
    // 400 is non-retryable: single attempt, no backoff sleeps in the test.
    globalThis.fetch = (async () => okResponse({ error: { message: "boom" } }, 400)) as typeof fetch;
    const res = await expandBrief("Build a fleet healthcheck tool");
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.reason, "error");
    assert.match(res.error ?? "", /DeepSeek rejected the request \(HTTP 400/);
  });

  it("185-H1: keyed success never carries an error channel", async () => {
    process.env[KEY] = "sk-test";
    globalThis.fetch = expandedViaFetch(FULL_SPEC);
    const res = await expandBrief("Build a fleet healthcheck tool");
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal("error" in res, false, "ok:true must not carry error");
  });
});

// ---------------------------------------------------------------------------
// expandBrief â€” strict spec-envelope validation (never defaults)
// ---------------------------------------------------------------------------
// The spec graph is the input to plan/oracle generation, so a reply that omits
// a machine-checked field must be REFUSED with a coded reason after ONE bounded
// repair â€” never accepted with `[]` defaults.

describe("expandBrief â€” strict spec-envelope validation", () => {
  const PARTIAL = { requirements: ["Track delivery deadlines per order."] };

  it("refuses a partial spec after ONE bounded repair re-prompt, coded RT_E_VALIDATION", async () => {
    process.env[KEY] = "sk-test";
    const seq = sequencedFetch([PARTIAL, PARTIAL]);
    globalThis.fetch = seq.fetch;
    const res = await expandBrief("Build a fleet healthcheck tool");
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.reason, "error");
    assert.equal(res.code, "RT_E_VALIDATION");
    assert.match(res.error ?? "", /non-conforming expansion payload/);
    assert.match(res.error ?? "", /missing key "typeSignatures"/);
    assert.match(res.error ?? "", /missing key "dataFlow"/);
    assert.equal(seq.bodies().length, 2, "exactly one bounded repair re-prompt");
    // Item 1 audit pin: BOTH the first and the repair call request JSON mode
    // over the real body (json:true -> response_format json_object).
    for (const body of seq.bodies()) {
      assert.deepEqual(body.response_format, { type: "json_object" }, "json mode on every envelope call");
    }
    const repairUser =
      (seq.bodies()[1]!.messages as Array<{ content?: string }> | undefined)?.find((m) =>
        m.content?.includes("Brief:"),
      )?.content ?? "";
    assert.ok(
      repairUser.includes("Your previous reply was not a valid expansion payload"),
      "the repair call re-sends the strict envelope line",
    );
  });

  it("accepts the conforming repair reply and returns it (2 calls, no defaults)", async () => {
    process.env[KEY] = "sk-test";
    const seq = sequencedFetch([PARTIAL, FULL_SPEC]);
    globalThis.fetch = seq.fetch;
    const res = await expandBrief("Build a fleet healthcheck tool");
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(res.spec, FULL_SPEC, "the conforming repair reply is used, not a defaulted first reply");
    assert.equal(seq.bodies().length, 2, "exactly one repair re-prompt then success");
  });

  it("names the malformed field when a key is present but not an array", async () => {
    process.env[KEY] = "sk-test";
    const bad = { ...FULL_SPEC, typeSignatures: "createOrder(): Order" };
    globalThis.fetch = sequencedFetch([bad, bad]).fetch;
    const res = await expandBrief("Build a fleet healthcheck tool");
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "RT_E_VALIDATION");
    assert.match(res.error ?? "", /"typeSignatures" is not an array/);
  });

  it("refuses verifier-B's Case A after ONE repair (element junk never silently defaults)", async () => {
    process.env[KEY] = "sk-test";
    const caseA = {
      requirements: ["Track delivery deadlines per order."],
      edgeCases: [42, null, { nested: true }],
      errorHandling: [{}],
      typeSignatures: [null],
      dataFlow: [[]],
      negativeConstraints: [true],
    };
    const seq = sequencedFetch([caseA, caseA]);
    globalThis.fetch = seq.fetch;
    const res = await expandBrief("Build a fleet healthcheck tool");
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.code, "RT_E_VALIDATION");
    assert.match(res.error ?? "", /"edgeCases" has non-string or blank entries at index 0, 1, 2/);
    assert.match(res.error ?? "", /"negativeConstraints" has non-string or blank entries at index 0/);
    assert.equal(seq.bodies().length, 2, "exactly one bounded repair re-prompt");
  });

  it("accepts a conforming reply that REPAIRS Case A (2 calls, no defaults)", async () => {
    process.env[KEY] = "sk-test";
    const caseA = {
      requirements: ["Track delivery deadlines per order."],
      edgeCases: [42, null, { nested: true }],
      errorHandling: [{}],
      typeSignatures: [null],
      dataFlow: [[]],
      negativeConstraints: [true],
    };
    const seq = sequencedFetch([caseA, FULL_SPEC]);
    globalThis.fetch = seq.fetch;
    const res = await expandBrief("Build a fleet healthcheck tool");
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.deepEqual(res.spec, FULL_SPEC, "the conforming repair is used, not element junk normalized to []");
    assert.equal(seq.bodies().length, 2);
  });

  it("does not repair a conforming first reply (exactly one call)", async () => {
    process.env[KEY] = "sk-test";
    const seq = sequencedFetch([FULL_SPEC]);
    globalThis.fetch = seq.fetch;
    const res = await expandBrief("Build a fleet healthcheck tool");
    assert.equal(res.ok, true);
    assert.equal(seq.bodies().length, 1, "a conforming reply never triggers a repair call");
  });
});

// ---------------------------------------------------------------------------
// expandBrief â€” prior-run lesson injection (fixes/98 Â§5 Tier 3)
// ---------------------------------------------------------------------------

describe("expandBrief â€” prior-run lesson injection (fixes/98 Â§5 Tier 3)", () => {
  async function captureWithLessons(lessons?: readonly string[]): Promise<string> {
    process.env[KEY] = "sk-test";
    let userContent = "";
    globalThis.fetch = expandedViaFetch(FULL_SPEC, (init) => {
      const body = JSON.parse(String(init.body)) as { messages?: Array<{ content?: string }> };
      userContent = body.messages?.find((m) => m.content?.includes("Brief:"))?.content ?? "";
    });
    const res = await expandBrief("Build a fleet healthcheck tool", undefined, lessons);
    assert.equal(res.ok, true, "stub expansion succeeds so the prompt can be inspected");
    return userContent;
  }

  it("renders prior-run lessons as a labeled advisory list after the brief", async () => {
    const content = await captureWithLessons([
      "L1 vague-brief: lattice fell back to jobs=[deliver-core-workflow]",
      "L3 verify-failure: machine-run cases failing after 2 iterations",
    ]);
    assert.ok(content.includes("Known failure modes from prior runs (advisory"));
    assert.ok(content.includes("- L1 vague-brief: lattice fell back"));
    assert.ok(content.includes("- L3 verify-failure: machine-run cases failing"));
    assert.ok(
      content.indexOf("Brief:") < content.indexOf("Known failure modes"),
      "advisory tail renders after the brief, never before it",
    );
  });

  it("omits the lessons block entirely when none are passed (byte-stable prompt)", async () => {
    const absent = await captureWithLessons(undefined);
    const empty = await captureWithLessons([]);
    assert.ok(!absent.includes("Known failure modes"), "absent param -> no block");
    assert.deepEqual(absent, empty, "empty list -> byte-identical prompt to the absent case");
  });

  it("normalizes lessons: dedupes, drops junk, caps count + line length with markers", async () => {
    const long = "L".repeat(EXPAND_LESSON_MAX_CHARS) + " TAIL_MUST_NOT_APPEAR";
    const many = Array.from({ length: EXPAND_LESSON_MAX_COUNT }, (_, i) => `lesson ${i}`);
    const content = await captureWithLessons([
      "  dup row  ",
      "dup row",
      42 as unknown as string,
      "",
      "   ",
      long,
      ...many,
    ]);
    const block = content.slice(content.indexOf("Known failure modes"));
    const bullets = block.split("\n").filter((l) => l.startsWith("- "));
    assert.equal(bullets.length, EXPAND_LESSON_MAX_COUNT, "count capped at 12");
    assert.ok(!content.includes("TAIL_MUST_NOT_APPEAR"), "over-long lesson tail never reaches the model");
    assert.ok(content.includes("â€¦[TRUNCATED]"), "the cut is marked, never silent");
    assert.equal(bullets.filter((b) => b === "- dup row").length, 1, "deduped to one bullet");
    assert.ok(!content.includes("lesson 10"), "beyond-count lesson dropped");
    assert.ok(content.includes("- lesson 9"), "the 12th slot still fits");
    assert.ok(
      content.includes("LESSONS-ELIDED: 2 lesson row(s)"),
      "the beyond-count lesson drop is marked with its count, never a silent slice (W49/335-1)",
    );
  });

  it("325 BUG E: a 500-char row (legal in-record at the 600 cap) is still cut at the prompt cap, WITH the marker", async () => {
    // Deliberate differential (322 X3 Â§Coupling sweep): record vs prompt are
    // different budgets â€” the record cap is LESSON_TEXT_MAX (600), the
    // prompt-side re-cap stays EXPAND_LESSON_MAX_CHARS (240). This pin makes
    // the differential explicit: a row that is LEGAL in the record still
    // reaches the prompt cut, and that cut is never silent.
    const legalRow = "R".repeat(500);
    assert.ok(legalRow.length <= LESSON_TEXT_MAX, "fixture premise: 500 is legal in-record");
    const content = await captureWithLessons([legalRow]);
    assert.ok(content.includes("â€¦[TRUNCATED]"), "the prompt-side cut is marked");
    assert.ok(!content.includes(legalRow), "the full 500-char row never reaches the model whole");
    assert.ok(
      content.includes("R".repeat(EXPAND_LESSON_MAX_CHARS)),
      `keeps exactly the ${EXPAND_LESSON_MAX_CHARS}-char prompt budget`,
    );
  });
});

// ---------------------------------------------------------------------------
// rankBriefLessons / lessonLinesForBrief â€” FusionRank-ranked lesson injection
// (fixes/98 Â§5 Tier 3): top-k lesson rows from project memory + knowledge
// store, ranked by the same fusionRank the packet uses.
// ---------------------------------------------------------------------------

describe("rankBriefLessons â€” FusionRank-ranked lesson injection (fixes/98 Â§5)", () => {
  const kanbanRow = () =>
    lessonRow({
      classShort: "vague-brief",
      level: "L1",
      kind: "semantic",
      phase: 0,
      text: "L1 vague-brief: kanban board brief fell back to demo domain; tighten the brief.",
      score: 0.7,
      source: "engine",
    });
  const hvacRow = () =>
    lessonRow({
      classShort: "template-emission",
      level: "L2",
      kind: "episodic",
      phase: 6,
      text: "L2 template-emission: HVAC dispatch phase sealed with gate unmet (p6-test).",
      score: 0.7,
      source: "engine",
    });

  it("ranks a brief-relevant lesson row above an irrelevant one (injection regression)", () => {
    const memory: MemoryEntry[] = [
      hvacRow(),
      kanbanRow(),
      // A NON-lesson row â€” even a highly scored relevant one â€” must never enter
      // the lesson ranking (tag filter is the lesson gate).
      { id: "plain", kind: "semantic", phase: 0, text: "Kanban board best practices for small teams.", score: 0.9 },
    ];
    const ranked = rankBriefLessons("Build a kanban board tool for task tracking", memory);
    assert.ok(ranked.length > 0, "lesson rows rank in");
    assert.ok(ranked[0].text.includes("kanban"), "the brief-relevant lesson ranks first");
    assert.ok(!ranked.some((r) => r.id === "plain"), "non-lesson rows never enter lesson ranking");
  });

  it("ranks caller-mapped knowledge-store proven rows alongside memory lessons", () => {
    const proven = provenToLessonRow({
      entryId: "Kabc1234",
      advice:
        "Reuse \"Kanban drag-drop reorder fix\" (stored from project \"kanban-run\", score 0.8): reorder cards by index, never by timestamp.",
      score: 0.8,
    });
    const ranked = rankBriefLessons("Build a kanban board with drag-and-drop reordering", [hvacRow()], {
      proven: [proven],
    });
    assert.ok(ranked.length >= 2, "memory lesson + proven row both rank");
    assert.equal(ranked[0].id, "proven-Kabc1234", "the research-proven kanban row outranks the HVAC lesson");
  });

  it("floors deterministically: blank brief, junk memory, no lesson rows -> []", () => {
    assert.deepEqual(rankBriefLessons("", [kanbanRow()]), [], "blank brief ranks nothing");
    assert.deepEqual(
      rankBriefLessons("kanban", [{} as unknown as Parameters<typeof rankBriefLessons>[1][number]]),
      [],
      "junk rows are skipped, never thrown",
    );
    assert.deepEqual(
      rankBriefLessons("kanban", [
        { id: "x", kind: "semantic", phase: 0, text: "not a lesson", score: 0.5 },
      ]),
      [],
      "rows without the lesson tag are not lessons",
    );
  });

  it("respects the limit and is byte-deterministic across calls", () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      lessonRow({
        classShort: "template-emission",
        level: "L2",
        kind: "episodic",
        phase: 6,
        text: `L2 template-emission: kanban phase ${i} sealed with gate unmet.`,
        score: 0.7,
        source: "engine",
      }),
    );
    const ranked = rankBriefLessons("kanban phase gate", rows, { limit: 3 });
    assert.equal(ranked.length, 3, "top-k capped at the requested limit");
    assert.deepEqual(ranked, rankBriefLessons("kanban phase gate", rows, { limit: 3 }), "deterministic");
    assert.equal(
      rankBriefLessons("kanban phase gate", rows).length,
      EXPAND_LESSON_RANK_LIMIT,
      "default limit = EXPAND_LESSON_RANK_LIMIT",
    );
  });

  it("lessonLinesForBrief formats [kind score] text lines and feeds expandBrief's advisory block", async () => {
    const memory = [kanbanRow(), hvacRow()];
    const lines = lessonLinesForBrief("Build a kanban board", memory);
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^\[(semantic|episodic|procedural) [0-9.]+\] L/, "provenance-visible line form");

    process.env[KEY] = "sk-test";
    let userContent = "";
    globalThis.fetch = expandedViaFetch(FULL_SPEC, (init) => {
      const body = JSON.parse(String(init.body)) as { messages?: Array<{ content?: string }> };
      userContent = body.messages?.find((m) => m.content?.includes("Brief:"))?.content ?? "";
    });
    const res = await expandBrief("Build a kanban board", undefined, lines);
    assert.equal(res.ok, true, "stub expansion succeeds");
    assert.ok(userContent.includes("Known failure modes from prior runs (advisory"));
    assert.ok(userContent.includes("L1 vague-brief: kanban board"), "ranked lesson text reaches the model");
  });
});

// ---------------------------------------------------------------------------
// applyPolicies â€” pure negative-constraint injection
// ---------------------------------------------------------------------------

describe("applyPolicies", () => {
  const spec: ExpandedSpec = {
    requirements: ["Ship the offline queue first."],
    edgeCases: [],
    errorHandling: ["Store down: keep last known state."],
    typeSignatures: [],
    dataFlow: ["input -> queue -> store"],
    negativeConstraints: ["DO NOT add authentication."],
  };

  it("appends new policies verbatim, in caller order, after model-derived constraints", () => {
    const out = applyPolicies(spec, ["DO NOT use external ORMs", "DO NOT call the network at import time"]);
    assert.deepEqual(out.negativeConstraints, [
      "DO NOT add authentication.",
      "DO NOT use external ORMs",
      "DO NOT call the network at import time",
    ]);
  });

  it("dedupes exact matches (case-sensitive, trimmed): present policies and repeated inputs never duplicate", () => {
    const out = applyPolicies(spec, [
      "  DO NOT use external ORMs ",
      "DO NOT use external ORMs",
      "DO NOT ADD AUTHENTICATION.",
      "DO NOT add authentication.",
    ]);
    assert.deepEqual(out.negativeConstraints, [
      "DO NOT add authentication.",
      "DO NOT use external ORMs",
      "DO NOT ADD AUTHENTICATION.",
    ]);
  });

  it("is pure: input spec is untouched and result arrays are fresh copies", () => {
    const before = JSON.stringify(spec);
    const out = applyPolicies(spec, ["DO NOT use external ORMs"]);
    assert.equal(JSON.stringify(spec), before, "input never mutated");
    assert.notEqual(out, spec, "fresh container object");
    assert.notEqual(out.requirements, spec.requirements, "fresh requirements array");
    assert.notEqual(out.negativeConstraints, spec.negativeConstraints, "fresh constraints array");
    out.negativeConstraints.push("DO NOT leak into the input");
    out.requirements.push("This must not appear in the input.");
    assert.deepEqual(spec.negativeConstraints, ["DO NOT add authentication."]);
    assert.deepEqual(spec.requirements, ["Ship the offline queue first."]);
  });

  it("is deterministic: identical inputs produce identical outputs", () => {
    const policies = ["DO NOT use external ORMs", "DO NOT add authentication."];
    const a = applyPolicies(spec, policies);
    const b = applyPolicies(spec, policies);
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("filters non-strings and blanks; no policies yields an equal fresh copy", () => {
    // Hostile entries are out of the typed contract â€” exercise the runtime
    // filter through an unknown-level cast (never through the public type).
    const hostile = [42, "", "   ", null, undefined, "DO NOT use external ORMs"] as unknown as string[];
    const out = applyPolicies(spec, hostile);
    assert.deepEqual(out, {
      requirements: ["Ship the offline queue first."],
      edgeCases: [],
      errorHandling: ["Store down: keep last known state."],
      typeSignatures: [],
      dataFlow: ["input -> queue -> store"],
      negativeConstraints: ["DO NOT add authentication.", "DO NOT use external ORMs"],
    });
    const none = applyPolicies(spec);
    assert.deepEqual(none, spec);
    assert.notEqual(none, spec);
    assert.deepEqual(none.negativeConstraints, [...spec.negativeConstraints]);
  });

  it("keeps the other five fields byte-identical through the merge", () => {
    const out = applyPolicies(spec, ["DO NOT use external ORMs"]);
    assert.equal(JSON.stringify(out.requirements), JSON.stringify(spec.requirements), "requirements untouched");
    assert.equal(JSON.stringify(out.dataFlow), JSON.stringify(spec.dataFlow));
    assert.equal(JSON.stringify(out.errorHandling), JSON.stringify(spec.errorHandling));
  });
});

// ---------------------------------------------------------------------------
// PR-18 â€” the pure dedicated repair prompt + the prompt/validator parity
// extension. Drift-proof: the repair prompt may not advertise a rule the
// validators do not enforce, and may not omit one they do (the repo's 215b
// principle). Every advertised rule family is linked to its live validator, and
// every codegen repair re-prompt is checked against the same contract.
// ---------------------------------------------------------------------------
describe("PR-18 â€” dedicated repair prompt + prompt/validator parity", () => {
  it("carries the pure repair contract: delta first, full envelope second, no success claims, checks protected, refusal channel", () => {
    const s = repairSystemPrompt();
    assert.ok(s.includes("bounded repair agent"), "repair persona named");
    assert.ok(s.includes('{"patch"'), "delta form offered");
    assert.ok(s.includes('{"module"'), "full-envelope form offered");
    assert.ok(s.includes("may not claim the repair succeeded"), "success claims forbidden");
    assert.ok(s.includes("may not weaken"), "checks protected");
    assert.ok(s.includes(REPAIR_REFUSAL_ENVELOPE), "the legal refusal channel is advertised verbatim");
    for (const rule of REPAIR_PRESERVED_RULES) {
      assert.ok(s.includes(rule), `the advertised rule list omits: ${rule}`);
    }
  });

  it("is pure: identical calls produce an identical string", () => {
    assert.equal(repairSystemPrompt(), repairSystemPrompt());
  });

  it("names EVERY validator-enforced forbidden primitive, and the mirrored list cannot drift", () => {
    assert.deepEqual(
      [...REPAIR_FORBIDDEN_PRIMITIVE_NAMES],
      [...FORBIDDEN_PRIMITIVE_NAMES],
      "the mirrored primitive list must equal codegen's validator list",
    );
    const s = repairSystemPrompt();
    for (const name of FORBIDDEN_PRIMITIVE_NAMES) {
      assert.ok(
        s.includes(name),
        `repair prompt omits forbidden primitive \`${name}\` â€” the model would be blind-sided by the validator`,
      );
    }
  });

  it("every advertised rule family is backed by a LIVE validator (no unenforced advertising)", () => {
    for (const name of FORBIDDEN_PRIMITIVE_NAMES) {
      const hit = forbiddenPrimitiveHit(name);
      assert.ok(
        hit.hard !== null || hit.soft !== null,
        `\`${name}\` is advertised but no validator matches it`,
      );
    }
    assert.ok(
      nondeterministicPrimitiveHit("const x = Math.random();") !== null,
      "Math.random has a live validator",
    );
    assert.ok(
      proseLineHits("I will write the code now and make sure it works.").length > 0,
      "prose-in-code has a live validator",
    );
    assert.ok(
      unawaitedAsyncValueUses("async function f(){}\nfunction g(): number { return f().ok; }", ["f"]).length > 0,
      "un-awaited async has a live validator",
    );
    assert.ok(
      crossChunkDuplicateDeclarations("function estimateARV(): number { return 1; }", [
        { path: "a.ts", exports: ["estimateARV"] },
      ]).length > 0,
      "cross-chunk duplicate declaration has a live validator",
    );
    assert.deepEqual(
      missingSignatureNames(["a"], ["a", "b"]),
      ["b"],
      "the missing-signature rule has a live validator",
    );
    // fixes/349-P6: the three rules added for the emit-killing classes.
    assert.ok(
      materializedCjsResidueHits("const x = module.exports.y;", ["x"]).length > 0,
      "the non-ESM rule has a live validator",
    );
    assert.ok(
      implicitAnyParameters("function f(a) { return a; }").length > 0,
      "the implicit-any rule has a live validator",
    );
    const bloat = `/**\n${"// filler comment line\n".repeat(40)} */\nfunction f(): void { return; }\n`;
    const compacted = compactModuleUnderBound(bloat, 60);
    assert.ok(compacted !== null && compacted.length <= 60, "the size rule has a live compaction (deterministic repair)");
    assert.ok(P6_MODULE_MAX_CHARS > 0, "the size bound is a real constant");
  });

  it("EACH codegen repair re-prompt restates the preserved-rules contract (parity across every repair prompt)", () => {
    const prompts: [string, string][] = [
      ["resend", p6SynthesisRepairPrompt()],
      ["export-binding", p6SynthesisExportRepairPrompt(["createBoard"])],
      ["forbidden-primitive", p6SynthesisForbiddenRepairPrompt("fetch")],
      ["signature", p6SynthesisSignatureRepairPrompt(["createBoard"])],
      ["brief-fit", p6SynthesisBriefFitRepairPrompt(["lease"])],
    ];
    for (const [name, prompt] of prompts) {
      assert.match(prompt, /forbidden primitive/i, `${name}: names the forbidden-primitive rule`);
      assert.match(prompt, /no markdown fences|JSON ONLY/i, `${name}: restates the JSON-only output contract`);
    }
  });
});

// ---------------------------------------------------------------------------
// 353 â€” prompt contract: every validator predicate is stated in the prompt the
// model actually receives (no hidden rules). Two prompts live in this module:
// the expansion prompt (its reply is checked by `expandedSpecViolations`) and
// the dedicated repair prompt (its reply is checked by `validateSynthesisModule`
// in codegen.server.ts). Each predicate below is linked BOTH to the prompt line
// that tells the model and to a live validator reading.
// ---------------------------------------------------------------------------
describe("353 â€” every expandedSpecViolations predicate is stated in the expansion prompt", () => {
  it("states the object / exact-six-key / array / non-empty-string / non-empty-requirements rules", async () => {
    const content = await captureUserContent("Build a fleet healthcheck tool");
    assert.ok(content.includes("ONE JSON object with EXACTLY these six keys"), "object + exact-key rule stated");
    assert.ok(content.includes("EACH of the six keys MUST be a JSON array of strings"), "array rule stated");
    assert.ok(content.includes("every array element MUST be a plain, non-empty string"), "string-element rule stated");
    assert.ok(content.includes("requirements MUST be a NON-EMPTY array"), "non-empty-requirements rule stated");
  });

  it("each stated rule matches a live expandedSpecViolations predicate", () => {
    assert.deepEqual(expandedSpecViolations([1]), ["reply is not a JSON object"], "object rule is live");
    assert.ok(
      expandedSpecViolations({ requirements: ["x"] }).some((v) => v.startsWith("missing key")),
      "six-key rule is live",
    );
    assert.ok(
      expandedSpecViolations({ ...FULL_SPEC, edgeCases: "nope" }).includes('"edgeCases" is not an array'),
      "array rule is live",
    );
    assert.ok(
      expandedSpecViolations({ ...FULL_SPEC, typeSignatures: [null] }).some((v) => /non-string or blank/.test(v)),
      "non-empty-string rule is live",
    );
    assert.ok(
      expandedSpecViolations({ ...FULL_SPEC, requirements: [] }).some((v) => /no usable entries/.test(v)),
      "non-empty-requirements rule is live",
    );
  });
});

describe("353 â€” every validateSynthesisModule predicate is advertised in the repair prompt", () => {
  const PROMPT = repairSystemPrompt();
  const cases: { name: string; phrase: string; live: () => boolean }[] = [
    { name: "forbidden primitive", phrase: "forbidden primitive", live: () => forbiddenPrimitiveHit("const x = eval('1');").hard !== null },
    { name: "Math.random", phrase: "Math.random", live: () => nondeterministicPrimitiveHit("const x = Math.random();") !== null },
    { name: "prose-in-code", phrase: "planning prose", live: () => proseLineHits("I will write the code now and make sure it works.").length > 0 },
    {
      name: "un-awaited async",
      phrase: "await every async call",
      live: () => unawaitedAsyncValueUses("async function f(){}\nfunction g(): number { return f().ok; }", ["f"]).length > 0,
    },
    {
      name: "cross-chunk duplicate",
      phrase: "redeclare a name another chunk already exports",
      live: () => crossChunkDuplicateDeclarations("function estimateARV(): number { return 1; }", [{ path: "a.ts", exports: ["estimateARV"] }]).length > 0,
    },
    { name: "missing signature", phrase: "EXACTLY the required signatures", live: () => missingSignatureNames(["a"], ["a", "b"]).length > 0 },
    { name: "non-ESM residue", phrase: "CommonJS module/exports residue", live: () => materializedCjsResidueHits("const x = module.exports.y;", ["x"]).length > 0 },
    { name: "implicit any", phrase: "annotate EVERY function parameter", live: () => implicitAnyParameters("function f(a) { return a; }").length > 0 },
    {
      name: "module size",
      phrase: "module size bound",
      live: () => compactModuleUnderBound(`/**\n${"// filler comment line\n".repeat(40)} */\nfunction f(): void { return; }\n`, 60) !== null,
    },
    { name: "suppression pragma", phrase: "suppression pragma", live: () => suppressionPragmaHit("// @ts-ignore\nfunction f(): void {}") !== null },
    {
      name: "JSX-free .ts chunk",
      phrase: "JSX-free",
      live: () =>
        jsxHits('const x = <Widget title="a" />;\n').length > 0 &&
        jsxNamespaceHits("function f(): JSX.Element { return null; }").length > 0,
    },
    {
      name: "money semantics",
      phrase: "unit price Ã— quantity",
      live: () =>
        moneySemanticsHits("function computeCartTotalPence() {\n  var total = 0;\n  total = total + quantity;\n  return total;\n}").length > 0,
    },
    {
      name: "shared contract type",
      phrase: "shared contract type",
      live: () => contractTypeRedeclarations("type Property = { id?: string };\nfunction f(): void {}", ["Property"]).length > 0,
    },
    { name: "unbound export", phrase: "every name the reply's `exports` list claims", live: () => unboundExportNames("function f(): void {}", ["g"]).length > 0 },
    { name: "JSON only / fences", phrase: "no markdown fences", live: () => validateSynthesisModule("```\nfunction f(): void {}\n```", ["f"], ["f"]).ok === false },
  ];

  it("advertises every rule the repair validator enforces", () => {
    for (const c of cases) {
      assert.ok(PROMPT.includes(c.phrase), `repair prompt omits the ${c.name} rule (expected: "${c.phrase}")`);
    }
  });

  it("each advertised rule is backed by a LIVE validator (no unenforced advertising)", () => {
    for (const c of cases) assert.ok(c.live(), `no live validator backs the ${c.name} rule`);
  });

  it("validateSynthesisModule actually refuses the previously-unstated classes", () => {
    assert.equal(validateSynthesisModule("", [], []).ok, false, "empty module refused");
    assert.equal(
      validateSynthesisModule("// @ts-ignore\nfunction f(): void {}\nmodule.exports.f = f;", ["f"], ["f"]).ok,
      false,
      "suppression pragma refused",
    );
    assert.equal(
      validateSynthesisModule('function f(): void { const x = <Widget title="a" />; }', ["f"], ["f"]).ok,
      false,
      "raw JSX refused",
    );
    assert.equal(
      validateSynthesisModule("function f(): JSX.Element { return null; }", ["f"], ["f"]).ok,
      false,
      "JSX namespace refused",
    );
    assert.equal(
      validateSynthesisModule("type Property = { id?: string };\nfunction f(): void {}\nmodule.exports.f = f;", ["f"], ["f"], null, ["Property"]).ok,
      false,
      "contract-type redeclaration refused",
    );
  });
});

// ---------------------------------------------------------------------------
// W359 (kind fidelity) â€” the resolved delivery kind in the EXPANSION prompt.
// It rides as PROMPT TEXT: the envelope stays exactly six keys, `ExpandedSpec`'s
// persisted shape (`Project.implementationSpec`) is untouched, and
// `expandedSpecViolations` is unchanged. The kind changes what the model is
// ASKED to write, never what it may return.
// ---------------------------------------------------------------------------

/** The corpus `game` brief verbatim (research/eval-corpus/arcade-breakout.md). */
const ARCADE_BRIEF =
  "A browser arcade game for players: drag the paddle to bounce the ball and break rows of bricks across three levels of increasing speed; track the score live and persist the high score between sessions; keyboard controls, pause and resume, and win or lose screens â€” canvas only.";

/** Run expandBrief against the fetch stub with a delivery kind and return the
 *  captured user content (the exact bytes the expansion model receives). */
async function captureKindPrompt(kind?: DeliveryKind | null): Promise<string> {
  process.env[KEY] = "sk-test";
  let userContent = "";
  globalThis.fetch = expandedViaFetch(FULL_SPEC, (init) => {
    const body = JSON.parse(String(init.body)) as {
      messages?: Array<{ content?: string }>;
    };
    userContent =
      body.messages?.find((m) => m.content?.includes("Brief:"))?.content ?? "";
  });
  const res = await expandBrief(ARCADE_BRIEF, undefined, undefined, kind);
  assert.equal(res.ok, true, "stub expansion succeeds so the prompt can be inspected");
  return userContent;
}

describe("W359 â€” the delivery kind is expansion PROMPT TEXT, never a seventh key", () => {
  it("renders every kind's paragraph + REQUIRED rows, and only that kind's", async () => {
    for (const kind of DELIVERY_KINDS) {
      const content = await captureKindPrompt(kind);
      const spec = DELIVERY_KIND_SPEC[kind];
      assert.ok(content.includes(spec.paragraph), `${kind}: the DELIVERY KIND paragraph is on the wire`);
      assert.ok(
        content.indexOf(spec.paragraph) < content.indexOf("Brief:"),
        `${kind}: the paragraph sits by Brief: (immediately before the brief text)`,
      );
      assert.ok(
        content.indexOf(spec.paragraph) > content.indexOf("STRICT honesty + fidelity"),
        `${kind}: the paragraph follows the field rules it qualifies`,
      );
      for (const rule of spec.rules) {
        assert.ok(content.includes(rule), `${kind}: REQUIRED row on the wire (${rule.slice(0, 48)}â€¦)`);
      }
      assert.ok(
        content.indexOf(spec.rules[0]!) < content.indexOf("- dataFlow:"),
        `${kind}: the REQUIRED rows sit INSIDE the field-rules block`,
      );
      for (const other of DELIVERY_KINDS) {
        if (other === kind) continue;
        assert.ok(!content.includes(DELIVERY_KIND_SPEC[other].paragraph), `${kind}: no ${other} paragraph leaks in`);
        for (const rule of DELIVERY_KIND_SPEC[other].rules) {
          assert.ok(!content.includes(rule), `${kind}: no ${other} REQUIRED row leaks in`);
        }
      }
    }
  });

  it("states the per-kind REQUIRED contract the wave asked for", () => {
    const game = [DELIVERY_KIND_SPEC.game.paragraph, ...DELIVERY_KIND_SPEC.game.rules].join("\n");
    assert.match(game, /keyboard AND pointer/, "game: input");
    assert.match(game, /game loop/, "game: the loop");
    assert.match(game, /<canvas>/, "game: the canvas");
    assert.match(
      game,
      /renderFrame\(ctx: CanvasRenderingContext2D, dtMs: number\): void/,
      "game: a loop/render signature",
    );
    const tool = [DELIVERY_KIND_SPEC.tool.paragraph, ...DELIVERY_KIND_SPEC.tool.rules].join("\n");
    assert.match(tool, /main\(argv: string\[\]\): Promise<number>/, "tool: the main(argv) entry");
    assert.match(tool, /exit-code edge cases/, "tool: the exit-code edge cases");
    const service = [DELIVERY_KIND_SPEC.service.paragraph, ...DELIVERY_KIND_SPEC.service.rules].join("\n");
    assert.match(service, /startServer\(port: number\)/, "service: a listen signature");
    assert.match(service, /readiness/i, "service: readiness");
    const library = [DELIVERY_KIND_SPEC.library.paragraph, ...DELIVERY_KIND_SPEC.library.rules].join("\n");
    assert.match(library, /importable named exports/, "library: an importable public API");
    assert.match(library, /JSX\/\.tsx|\.tsx/, "library: a JSX prohibition");
  });

  it("no kind / null kind / an unknown kind keep the legacy prompt byte-identical", async () => {
    const legacy = await captureUserContent(ARCADE_BRIEF);
    assert.ok(!legacy.includes("DELIVERY KIND"), "the legacy prompt carries no kind block");
    assert.equal(await captureKindPrompt(), legacy, "an omitted kind keeps the legacy bytes");
    assert.equal(await captureKindPrompt(null), legacy, "a null kind keeps the legacy bytes");
    assert.equal(await captureKindPrompt("nonsense" as DeliveryKind), legacy, "an unknown kind keeps the legacy bytes");
  });

  it("adds NO seventh envelope key â€” the six-key reply contract and its strict check are unchanged", async () => {
    const content = await captureKindPrompt("game");
    assert.ok(content.includes("Reply with ONE JSON object with EXACTLY these six keys"), "the exact-six-keys rule stands");
    assert.ok(
      content.includes(
        '{"requirements": ["..."], "edgeCases": ["..."], "errorHandling": ["..."], "typeSignatures": ["..."], "dataFlow": ["..."], "negativeConstraints": ["..."]}.',
      ),
      "the six-key reply contract line is unchanged",
    );
    assert.ok(!content.includes("deliveryKind"), "the kind is never asked for as a JSON key");
    assert.deepEqual([...EXPANDED_SPEC_KEYS].sort(), ["dataFlow", "edgeCases", "errorHandling", "negativeConstraints", "requirements", "typeSignatures"], "the envelope is still exactly six keys");
    assert.deepEqual(expandedSpecViolations(FULL_SPEC), [], "a six-key reply is still conforming with a kind in play");
    assert.equal(
      expandedSpecViolations({ requirements: FULL_SPEC.requirements }).length,
      5,
      "the strict check is unchanged (five missing keys are still five violations)",
    );
  });

  it("the one bounded repair re-prompt re-sends the SAME kind contract", async () => {
    process.env[KEY] = "sk-test";
    const seq = sequencedFetch([{ notASpec: true }, FULL_SPEC]);
    globalThis.fetch = seq.fetch;
    const res = await expandBrief(ARCADE_BRIEF, undefined, undefined, "game");
    assert.equal(res.ok, true, "the repaired reply conforms");
    const bodies = seq.bodies();
    assert.equal(bodies.length, 2, "one primary call + one bounded repair");
    const contents = bodies.map((b) => {
      const msgs = (b.messages ?? []) as Array<{ content?: string }>;
      return msgs.find((m) => typeof m.content === "string" && m.content.includes("Brief:"))?.content ?? "";
    });
    for (const [i, content] of contents.entries()) {
      assert.ok(content.includes(DELIVERY_KIND_SPEC.game.paragraph), `call ${i + 1} carries the kind paragraph`);
      assert.ok(content.includes(DELIVERY_KIND_SPEC.game.rules[0]!), `call ${i + 1} carries the REQUIRED rows`);
    }
    assert.ok(contents[1]!.includes(EXPANSION_REPAIR_LINE), "the repair line is appended to the SAME prompt (kind included)");
  });
});
