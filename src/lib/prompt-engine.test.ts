// ---------------------------------------------------------------------------
// prompt-engine.test.ts — hyper-prompt expansion + policy constraints
// (handoff pillar 3 + pillar 6; fixes/64_pillars_prompt.md).
// Run: node --experimental-strip-types --test src/lib/prompt-engine.test.ts
//
// Keyed tests stub globalThis.fetch (algo-tools.test.ts recipe) and delete the
// env key in beforeEach — node --test isolates each file in its own child
// process, so the env dance never leaks into sibling suites.
// ---------------------------------------------------------------------------
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyPolicies,
  expandBrief,
  parseExpandedSpecJson,
  rankBriefLessons,
  lessonLinesForBrief,
  provenToLessonRow,
  type ExpandedSpec,
  EXPAND_BRIEF_MAX_CHARS,
  EXPAND_POLICY_MAX_CHARS,
  EXPAND_POLICY_MAX_COUNT,
  EXPAND_LESSON_MAX_CHARS,
  EXPAND_LESSON_MAX_COUNT,
  EXPAND_LESSON_RANK_LIMIT,
} from "./prompt-engine.ts";
import { LESSON_TEXT_MAX, lessonRow } from "./knowledge.ts";
import { BRIEF_TEMPLATES } from "./templates.ts";
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

// ---------------------------------------------------------------------------
// parseExpandedSpecJson — pure parser/normalizer
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
// expansionPrompt — brief fidelity, truncation honesty, build-ready framing
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
        `${t.id}: signature-coverage rule present (fixes/215d — one module per capability)`,
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
      after.includes("[TRUNCATED — input longer than the budget cap"),
      "the cut is marked — the model can see evidence was dropped",
    );
    assert.ok(!content.includes(tail), "the tail beyond the cap never reaches the model");
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
    assert.ok(content.includes("…[TRUNCATED]"), "over-long policy is cut WITH a marker");
    assert.ok(!content.includes("LONGTAIL_MUST_NOT_APPEAR"), "policy tail never reaches the model");
    // The 13th distinct policy (shortOnes[11]) is dropped by the count cap —
    // and the drop is MARKED, never silent (W49/335-1: the module contract).
    assert.ok(!content.includes("DO NOT add policy 11 unless"), "beyond-count policy dropped");
    assert.ok(
      content.includes("POLICIES-ELIDED: 1 policy row(s)"),
      "the beyond-count drop is marked with its count, never a silent slice",
    );
  });
});

// ---------------------------------------------------------------------------
// expandBrief — keyed hyper-prompt expansion
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

  it("returns an honest error (never a fabricated spec) on unparseable model JSON", async () => {
    process.env[KEY] = "sk-test";
    globalThis.fetch = (async () =>
      okResponse({
        model: "deepseek-v4-flash",
        choices: [{ message: { content: "Here is a lovely prose spec…" } }],
      })) as typeof fetch;
    const res = await expandBrief("Build a fleet healthcheck tool");
    assert.deepEqual(res, {
      ok: false,
      reason: "error",
      error: "model returned an unparseable expansion payload",
    });
  });

  it("returns an honest error when the model omits requirements entirely", async () => {
    process.env[KEY] = "sk-test";
    globalThis.fetch = expandedViaFetch({ edgeCases: ["x"], negativeConstraints: [] });
    const res = await expandBrief("Build a fleet healthcheck tool");
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.reason, "error");
    assert.match(res.error ?? "", /unparseable expansion payload/);
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
// expandBrief — prior-run lesson injection (fixes/98 §5 Tier 3)
// ---------------------------------------------------------------------------

describe("expandBrief — prior-run lesson injection (fixes/98 §5 Tier 3)", () => {
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
    assert.ok(content.includes("…[TRUNCATED]"), "the cut is marked, never silent");
    assert.equal(bullets.filter((b) => b === "- dup row").length, 1, "deduped to one bullet");
    assert.ok(!content.includes("lesson 10"), "beyond-count lesson dropped");
    assert.ok(content.includes("- lesson 9"), "the 12th slot still fits");
    assert.ok(
      content.includes("LESSONS-ELIDED: 2 lesson row(s)"),
      "the beyond-count lesson drop is marked with its count, never a silent slice (W49/335-1)",
    );
  });

  it("325 BUG E: a 500-char row (legal in-record at the 600 cap) is still cut at the prompt cap, WITH the marker", async () => {
    // Deliberate differential (322 X3 §Coupling sweep): record vs prompt are
    // different budgets — the record cap is LESSON_TEXT_MAX (600), the
    // prompt-side re-cap stays EXPAND_LESSON_MAX_CHARS (240). This pin makes
    // the differential explicit: a row that is LEGAL in the record still
    // reaches the prompt cut, and that cut is never silent.
    const legalRow = "R".repeat(500);
    assert.ok(legalRow.length <= LESSON_TEXT_MAX, "fixture premise: 500 is legal in-record");
    const content = await captureWithLessons([legalRow]);
    assert.ok(content.includes("…[TRUNCATED]"), "the prompt-side cut is marked");
    assert.ok(!content.includes(legalRow), "the full 500-char row never reaches the model whole");
    assert.ok(
      content.includes("R".repeat(EXPAND_LESSON_MAX_CHARS)),
      `keeps exactly the ${EXPAND_LESSON_MAX_CHARS}-char prompt budget`,
    );
  });
});

// ---------------------------------------------------------------------------
// rankBriefLessons / lessonLinesForBrief — FusionRank-ranked lesson injection
// (fixes/98 §5 Tier 3): top-k lesson rows from project memory + knowledge
// store, ranked by the same fusionRank the packet uses.
// ---------------------------------------------------------------------------

describe("rankBriefLessons — FusionRank-ranked lesson injection (fixes/98 §5)", () => {
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
      // A NON-lesson row — even a highly scored relevant one — must never enter
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
// applyPolicies — pure negative-constraint injection
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
    // Hostile entries are out of the typed contract — exercise the runtime
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
