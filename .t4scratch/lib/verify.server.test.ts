// ---------------------------------------------------------------------------
// verify.server.test.ts — E-08 (A4-b) oracle-seeding + pinned-id tests for the
// machine verify seam (fixes/159 F3) + the 109 T-12 verify-safety regression
// block appended at the end (fixes/216a: findings C-01/C-04/C-05/C-07).
//
// The E-08 seam (dod.ts:706-728 oracleToCaseSeeds/missingOracleCaseIds) was
// DEAD: no production caller fed the A7 oracle rows into the generation
// prompt, and nothing rejected a returned case list that dropped a pinned
// row. These tests pin the wired behavior:
//   1. generateCases/verifyAndFixServer accept the rendered seed string + the
//      pinned oracle id list (parameters — verify.server.ts never imports
//      dod.ts); the seeds are PREPENDED to the generation prompt.
//   2. A returned case list missing a pinned id is rejected (one bounded
//      repair retry, then an honest refusal — never a pass on a reduced
//      oracle).
//   3. An empty oracle (no A7 rows) keeps the legacy prompt BYTE-FOR-BYTE.
//
// The LLM is faked via a globalThis.fetch stub (completeDeepSeek → fetch);
// no network, no real key needed — and the pinned-id refusal fires before
// runCases is ever reached (runner-independent).
//
// 216i (112 T1/T2) appends the lesson-loop block at the end: an unanchored
// refusal is VISIBLE (lessonRefused, no lesson row), an anchored failure run
// mints ONE signature-id row whose repeat re-derives the SAME id and accrues
// `reproducedCount` through the consumer (verify.ts applyVerifyOutcome).
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildOracleCasesPrompt,
  droppedPinnedOracleIds,
  generateCases,
  NO_CALLABLE_EXPORTS_REASON,
  oracleBriefGrounded,
  runCases,
  sanitizeOracleExpression,
  verifyAndFixServer,
} from "./verify.server.ts";
import { runnerAvailable } from "./node-runner.server.ts";
import { createTokenBudget, emptyLedger } from "./token-ledger.ts";
import { oracleToCaseSeeds } from "./dod.ts";
import type { OracleTest } from "./types.ts";
// 216i (112 T1/T2): the lesson-loop pins below consume the client-safe
// consumer half (verify.ts applyVerifyOutcome) over a real seeded project.
import { applyVerifyOutcome } from "./verify.ts";
import { seedProject } from "./testing/fixtures.ts";

const available = runnerAvailable();

const SOURCE = "const x = 1;";

/** A project's A7 oracle rows (mirror of buildTestOracle's row shape). */
const ORACLE: OracleTest[] = [
  {
    id: "orc-1",
    name: "job.dispatch.happy",
    given: 'Authorized operator submits "dispatch" with a valid record',
    expect: "200 + persisted entity + checkpoint written",
    job: "dispatch",
  },
  {
    id: "orc-2",
    name: "job.dispatch.checkpoint",
    given: 'Operator submits "dispatch" for a tracked record',
    expect: "checkpoint row appended to the entity history",
    job: "dispatch",
  },
  {
    id: "orc-3",
    name: "constraint.valid",
    given: "Request violates constraint",
    expect: "403 or 422; no side effect; diagnostic JSON",
    job: "dispatch",
  },
];
const ORACLE_IDS = ORACLE.map((o) => o.id);
const SEEDS = oracleToCaseSeeds(ORACLE);
const BRIEF = "dispatch module"; // brief nouns: dispatch, module

/** Set a fake key for the duration of one test; returns the restorer. */
function withFakeKey(): () => void {
  const saved = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "sk-e08-test";
  return () => {
    if (saved === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = saved;
  };
}

// --- legacy byte-parity baseline -------------------------------------------
// The pre-E-08 generation prompt (verify.server.ts:533-553 before fixes/159),
// frozen as an independent literal: a no-noun brief ("") + no signature names
// takes the deterministic "brief supplies no nouns" grounding branch, so the
// baseline below is the exact legacy string. Any future intentional prompt
// edit must update this pin deliberately.
const LEGACY_PROMPT = [
  "Write executable verification cases for the following source module. Return JSON ONLY:",
  '{"cases": [{"id": "case-1", "expression": "<boolean JS expression using the module\'s exported names>"}]}.',
  "Expressions must be self-contained booleans (e.g. `add(2,3) === 5`, `typeof buildPlan === 'function'`).",
  "Each expression is EXACTLY ONE boolean expression. FORBIDDEN in every case: semicolons,",
  "const/let/var declarations, assignments, multiple statements, arrow functions, and template literals.",
  "Every expression must EVALUATE WITHOUT THROWING: do NOT test rejection paths (invalid phase,",
  "unknown job, missing fields) — the harness cannot catch thrown errors, and the module's",
  "guards are correct behavior, not bugs. Test happy-path + brief-required behavior only.",
  "The module uses CommonJS: it assigns its API to `exports` (e.g. `exports.add = (a, b) => a + b`).",
  "STRICT: test ONLY behavior the brief explicitly requires. Do NOT invent extra requirements",
  "(no extra types, edge cases, bigint support, or frameworks the brief never mentions).",
  "STRICT (anti-vacuous): ground your cases in the brief's required behavior — reference the",
  "contract function names and/or the brief's domain nouns as identifiers. A case that merely",
  "re-asserts the source's own placeholder self-test helpers (e.g. a phase-graph `synthesize`",
  "or its `test_happy`/`test_no_skip`/`test_rejection_addressed` booleans) is VACUOUS and forbidden.",
  "BRIEF/CONTRACT GROUNDING: the brief supplies no nouns and no contract signatures — test the source's exported behavior directly.",
  "Brief: ",
  "Source:",
  "const x = 1;",
].join("\n");

// --- fake DeepSeek transport ------------------------------------------------
type CapturedCall = { url: string; prompt: string };

function chatReply(payload: unknown) {
  const content = typeof payload === "string" ? payload : JSON.stringify(payload);
  // A REAL Response — not a hand-rolled { ok, status, json() } object cast to
  // Response. Production reads the body with res.text() and parses defensively
  // (216 T0.6, the non-JSON-200 guard) exactly as the real API requires, so a
  // stub that implements only .json() misrepresents the type it claims to be.
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      model: "deepseek-v4-flash",
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/**
 * Stub globalThis.fetch so completeDeepSeek resolves against queued chat
 * payloads (one per LLM call; the last payload repeats). Captures each call's
 * URL and the LAST user message (the actual prompt) for assertions.
 */
function mockChat(payloads: unknown[]) {
  const calls: CapturedCall[] = [];
  const realFetch = globalThis.fetch;
  let index = 0;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const body =
      init && typeof init.body === "string"
        ? (JSON.parse(init.body) as { messages?: { role: string; content: string }[] })
        : null;
    const user = (body?.messages ?? []).filter((m) => m.role === "user");
    calls.push({
      url: String(url),
      prompt: user.length > 0 ? user[user.length - 1]!.content : "",
    });
    const payload = payloads[Math.min(index, payloads.length - 1)];
    index++;
    return chatReply(payload);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = realFetch;
    },
  };
}

/** Model payloads whose case expressions reference the brief noun `dispatch`
 *  so the anti-vacuity guard (oracleBriefGrounded) is satisfied. */
const dropOrc2 = {
  cases: [
    { id: "orc-1", expression: 'dispatch({ job: "dispatch" }) === true' },
    { id: "orc-3", expression: 'dispatch({ job: "dispatch" }) === true' },
    { id: "case-4", expression: 'typeof dispatch === "function"' },
  ],
};
const allPinned = {
  cases: [
    { id: "orc-1", expression: 'dispatch({ job: "dispatch" }) === true' },
    { id: "orc-2", expression: 'dispatch({ job: "dispatch" }) === true' },
    { id: "orc-3", expression: 'dispatch({ job: "dispatch" }) === true' },
  ],
};
const onlyOrc2 = {
  cases: [{ id: "orc-2", expression: 'dispatch({ job: "dispatch" }) === true' }],
};

describe("E-08 oracle seeding (A4-b — prompt builder)", () => {
  it("seeds every A7 row as a `# orc-…` line PREPENDED above the legacy instructions", () => {
    const prompt = buildOracleCasesPrompt({
      source: SOURCE,
      brief: BRIEF,
      seeds: SEEDS,
    });
    const seedLines = SEEDS.split("\n");
    assert.equal(seedLines.length, 3, "one seed line per oracle row");
    for (const line of seedLines) {
      assert.ok(line.startsWith("# orc-"), `seed line shape: ${line}`);
      assert.ok(prompt.includes(line), `prompt carries the seed line: ${line}`);
    }
    assert.equal(
      prompt.split("\n").filter((l) => l.startsWith("# orc-")).length,
      3,
      "exactly the 3 seeded rows appear",
    );
    assert.ok(
      prompt.startsWith("PINNED A7 ORACLE ROWS (E-08)"),
      "seed block is FIRST (prepended)",
    );
    assert.ok(
      prompt.indexOf("Write executable verification cases") > prompt.indexOf("# orc-1 "),
      "legacy instructions follow the seed block",
    );
  });

  it("an empty oracle (no A7 rows) keeps the legacy prompt byte-for-byte", () => {
    assert.equal(oracleToCaseSeeds([]), "");
    assert.equal(
      buildOracleCasesPrompt({ source: SOURCE, brief: "", seeds: "" }),
      LEGACY_PROMPT,
      "seeds:'' must equal the pre-E-08 prompt bytes",
    );
    assert.equal(
      buildOracleCasesPrompt({ source: SOURCE, brief: "", seeds: undefined }),
      LEGACY_PROMPT,
      "seeds:undefined must equal the pre-E-08 prompt bytes",
    );
    assert.equal(
      buildOracleCasesPrompt({ source: SOURCE, brief: "", seeds: "   \n " }),
      LEGACY_PROMPT,
      "whitespace-only seeds must not alter the prompt",
    );
    const seeded = buildOracleCasesPrompt({ source: SOURCE, brief: BRIEF, seeds: SEEDS });
    assert.equal(
      seeded.endsWith(buildOracleCasesPrompt({ source: SOURCE, brief: BRIEF, seeds: "" })),
      true,
      "the legacy instruction body is preserved verbatim under seeding",
    );
  });
});

describe("droppedPinnedOracleIds (E-08 pure mirror of dod missingOracleCaseIds)", () => {
  it("reports only dropped pinned ids, in seed order; extras are ignored", () => {
    assert.deepEqual(droppedPinnedOracleIds([...ORACLE_IDS, "extra-case"], ORACLE_IDS), []);
    assert.deepEqual(
      droppedPinnedOracleIds(["orc-1", "orc-3", "extra"], ORACLE_IDS),
      ["orc-2"],
    );
    assert.deepEqual(droppedPinnedOracleIds(["extra-case"], ORACLE_IDS), ORACLE_IDS);
    assert.deepEqual(droppedPinnedOracleIds([], []), []);
  });

  it("is defensive: non-string returned ids count as absent; empty pinned ids never pin", () => {
    assert.deepEqual(
      droppedPinnedOracleIds([42 as unknown as string, "orc-1"], ORACLE_IDS),
      ["orc-2", "orc-3"],
    );
    assert.deepEqual(droppedPinnedOracleIds([], ["", "orc-2", "orc-2"]), ["orc-2", "orc-2"]);
  });
});

describe("generateCases E-08 wiring (real path, fetch-stubbed)", () => {
  it("a 3-row oracle seeds 3 `# orc-` lines into the generation prompt and pins their ids", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([allPinned]);
    try {
      const res = await generateCases(SOURCE, BRIEF, [], SEEDS, ORACLE_IDS);
      assert.equal(res.ok, true);
      if (res.ok) {
        const ids = res.cases.map((c) => c.id);
        for (const id of ORACLE_IDS) assert.ok(ids.includes(id), `pinned ${id} kept`);
        assert.equal("error" in res, false, "ok:true must not carry an error channel");
      }
      assert.equal(mock.calls.length, 1, "no repair retry needed");
      const prompt = mock.calls[0]!.prompt;
      for (const line of SEEDS.split("\n")) {
        assert.ok(prompt.includes(line), `generation prompt seeded with: ${line}`);
      }
      assert.equal(
        prompt.split("\n").filter((l) => l.startsWith("# orc-")).length,
        3,
      );
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("a no-oracle project produces the legacy prompt (no seed block, byte-parity)", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([{ cases: [{ id: "c1", expression: "1 === 1" }] }]);
    try {
      const res = await generateCases(SOURCE, "", [], "", []);
      assert.equal(res.ok, true);
      const prompt = mock.calls[0]!.prompt;
      assert.equal(
        prompt,
        LEGACY_PROMPT,
        "unseeded generation prompt is byte-identical to legacy",
      );
      assert.ok(!prompt.includes("PINNED A7 ORACLE ROWS"), "no seed header without oracle rows");
      assert.ok(!prompt.includes("# orc-"), "no seed lines without oracle rows");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("rejects a returned case list that drops a pinned id (repair retry, then honest refusal)", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([dropOrc2, dropOrc2]);
    try {
      const res = await generateCases(SOURCE, BRIEF, [], SEEDS, ORACLE_IDS);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.reason, "error");
        assert.equal(res.code, "RT_E_VALIDATION");
        assert.match(res.error ?? "", /orc-2/, "evidence names the dropped pinned row");
        assert.match(res.error ?? "", /refused/, "refusal is explicit, never a silent accept");
      }
      assert.equal(mock.calls.length, 2, "one bounded repair retry was attempted");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("accepts a case list after a bounded repair retry re-adds the dropped pinned id", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([dropOrc2, onlyOrc2]);
    try {
      const res = await generateCases(SOURCE, BRIEF, [], SEEDS, ORACLE_IDS);
      assert.equal(res.ok, true, "repair reply merged the missing pinned row");
      if (res.ok) {
        const ids = res.cases.map((c) => c.id);
        assert.ok(ids.includes("orc-2"), "orc-2 restored by the repair merge");
        assert.ok(ids.includes("orc-1") && ids.includes("orc-3"), "originals kept by the merge");
      }
      assert.equal(mock.calls.length, 2);
    } finally {
      mock.restore();
      restoreKey();
    }
  });
});

describe("verifyAndFixServer E-08 refusal (dropped pinned id never reaches the loop)", () => {
  it("returns status error with the dropped id in the evidence — never a pass on a reduced oracle", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([dropOrc2, dropOrc2]);
    try {
      const outcome = await verifyAndFixServer(SOURCE, BRIEF, {
        seeds: SEEDS,
        pinnedOracleIds: ORACLE_IDS,
      });
      assert.equal(outcome.status, "error");
      assert.equal(outcome.iterations, 0, "no machine run was minted");
      assert.match(outcome.evidence, /orc-2/);
      assert.match(outcome.evidence, /refused/);
      assert.equal(mock.calls.length, 2, "generation + one bounded repair retry, then refusal");
    } finally {
      mock.restore();
      restoreKey();
    }
  });
});

// ---------------------------------------------------------------------------
// 109 T-12 — verify-safety regression block (findings C-01/C-04/C-05/C-07).
// All four defects were live in a green suite: nothing ever pinned a
// literal-only case, a shift assignment, a `constructor` escape, or a
// `module.exports` module. Each assertion below goes red if its fix is
// reverted; the two `pass` rows are the positive controls that go red if the
// new gates over-reject. See fixes/216a for the landing log.
// ---------------------------------------------------------------------------
describe("109 T-12 — verify-safety regression block", () => {
  it("T-01: a module that exports nothing can never mint a machine pass", { skip: !available }, async () => {
    const res = await runCases("const helper = 1;", [
      { id: "c1", expression: "({board:1}).board===1" },
    ]);
    // The expression itself evaluates TRUE — the export-inventory gate, not
    // the case, is what refuses the pass (that is the whole finding).
    assert.equal(res.results[0]?.pass, true);
    assert.equal(res.pass, false);
    assert.equal(res.compileError, NO_CALLABLE_EXPORTS_REASON);
  });

  it("T-01 control: an `exports.x =` module still machine-passes", { skip: !available }, async () => {
    const res = await runCases("exports.add = (a, b) => a + b;", [
      { id: "add", expression: "add(2,3) === 5" },
    ]);
    assert.equal(res.pass, true, `exports.add style must stay green: ${JSON.stringify(res)}`);
    assert.equal(res.compileError, undefined);
    assert.equal(res.results[0]?.pass, true);
  });

  it("T-05: a `module.exports = {…}` module machine-passes (reassignment folded back)", { skip: !available }, async () => {
    const res = await runCases("module.exports = { add: (a, b) => a + b };", [
      { id: "add", expression: "add(2,3) === 5" },
    ]);
    assert.equal(res.pass, true, `module.exports style must compile AND export: ${JSON.stringify(res)}`);
    assert.equal(res.compileError, undefined);
    assert.equal(res.results[0]?.pass, true);
  });

  it("T-03: shift assignments are rejected; comparisons and the arrow reason are exact", () => {
    for (const expr of ["x >>= 1", "x <<= 1", "x >>>= 1"]) {
      const chk = sanitizeOracleExpression(expr);
      assert.equal(chk.ok, false, `${expr} must be rejected`);
      if (!chk.ok) assert.equal(chk.reason, "assignment is not allowed");
    }
    for (const expr of ["x >= 1", "x <= 1", "x == 1", "x === 1"]) {
      assert.equal(sanitizeOracleExpression(expr).ok, true, `${expr} must stay accepted`);
    }
    const arrow = sanitizeOracleExpression("a => a");
    assert.equal(arrow.ok, false);
    if (!arrow.ok) assert.equal(arrow.reason, "arrow functions are not allowed");
    const parenArrow = sanitizeOracleExpression("(a) => a");
    assert.equal(parenArrow.ok, false);
    if (!parenArrow.ok) assert.equal(parenArrow.reason, "arrow functions are not allowed");
  });

  it("T-04: `constructor.constructor` escapes are rejected; the word in a string stays data", () => {
    const escapes = [
      "[].constructor.constructor('return console')().log('ORACLE_RESULT case-1 pass')",
      "[].constructor.constructor('return process')().platform.length > 0",
    ];
    for (const expr of escapes) {
      const chk = sanitizeOracleExpression(expr);
      assert.equal(chk.ok, false, `${expr} must be rejected`);
      if (!chk.ok) assert.equal(chk.reason, "disallowed construct (function/eval/global access)");
    }
    assert.equal(
      sanitizeOracleExpression("typeof f === 'function'").ok,
      true,
      "a keyword inside a string literal is still data",
    );
  });

  it("T-02: a literal-only case set cannot ground a function-exporting module", () => {
    const literalOnly = [{ id: "c1", expression: "({board: 1}).board === 1" }];
    const grounded = oracleBriefGrounded(
      literalOnly,
      "board ledger",
      [],
      "exports.board = () => ({ board: 1 });",
    );
    assert.equal(grounded.ok, false, "object-key data must not certify a module the case never calls");
    if (!grounded.ok) assert.match(grounded.reason, /reference no brief noun or contract function/);
    // Same set, no callable exports in the source: legacy behavior (nothing to
    // tighten against — the runCases T-01 gate owns that shape), and a case
    // that actually CALLS the export grounds normally.
    assert.equal(oracleBriefGrounded(literalOnly, "board ledger", [], "const helper = 1;").ok, true);
    const called = oracleBriefGrounded(
      [{ id: "c1", expression: "createBoard({ board: 1 }).board === 1" }],
      "board ledger",
      [],
      "exports.createBoard = (o) => o;",
    );
    assert.equal(called.ok, true);
  });
});

// ---------------------------------------------------------------------------
// 216i (112 T1/T2) — the lesson-loop pins. W3-L3 wired the record-gated mint
// (verify.server.ts `gatedFailureMint`) and the consumer accrual (verify.ts
// `applyVerifyOutcome`) but landed ZERO pins; these four assertions go red if
// either half is reverted. See fixes/216i_knowledge_integration.md.
//   • an anchor-less refusal mints NO lesson row and surfaces `lessonRefused`
//     (the visible `lesson.refused` ledger row lands via the consumer);
//   • an anchored failing run mints exactly ONE signature-id row;
//   • a repeat re-derives the SAME id and the ONE stored row's
//     `reproducedCount` accrues in place (never a forked twin);
//   • the signature id is stable across repeats (run-tail drift — e.g. the
//     iteration count — never forks the row) and distinct per anchor set.
// ---------------------------------------------------------------------------

/** The queued generation reply whose 3 pinned cases all fail against SOURCE:
 *  `dispatch` is not defined in `const x = 1;`, so with maxIterations 1 the
 *  loop returns on the first observed failure anchored to the 3 case ids. */
const anchoredFailingRun = () =>
  verifyAndFixServer(SOURCE, BRIEF, {
    seeds: SEEDS,
    pinnedOracleIds: ORACLE_IDS,
    maxIterations: 1,
  });

describe("216i (112 T1/T2) — verify lesson loop (refusal · signature id · accrual)", () => {
  it("T2: an anchor-less refusal mints NO lesson and surfaces lessonRefused (visible lesson.refused)", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([dropOrc2, dropOrc2]);
    try {
      const outcome = await verifyAndFixServer(SOURCE, BRIEF, {
        seeds: SEEDS,
        pinnedOracleIds: ORACLE_IDS,
      });
      assert.equal(outcome.status, "error", "the generation refusal never becomes a run");
      assert.equal(outcome.iterations, 0, "no case ever ran");
      assert.equal(outcome.lesson, undefined, "an unprovable L3 row must never be minted");
      const refusal = outcome.lessonRefused;
      assert.ok(refusal, "the refusal envelope rides the outcome — never a silent no-op");
      assert.equal(refusal.verdict, "refuse:no-proof");
      assert.equal(refusal.code, "RT_E_VALIDATION");
      assert.equal(refusal.log.event, "lesson.refused");
      assert.match(refusal.reason, /no anchor/);
      assert.match(refusal.log.detail, /no anchor/);
      // Consumer half (verify.ts applyVerifyOutcome): the refusal lands as ONE
      // visible ledger row and project memory gains NO lesson row.
      const applied = applyVerifyOutcome(seedProject(), outcome);
      assert.equal(
        applied.memory.filter((m) => m.id.startsWith("lesson-")).length,
        0,
        "no lesson row for a refusal",
      );
      assert.ok(
        applied.logs.some((l) => l.event === "lesson.refused" && l.detail.includes("no anchor")),
        "lesson.refused is visible in the ledger",
      );
      assert.ok(!applied.logs.some((l) => l.event === "lesson.capture"), "no capture log on a refusal");
      assert.ok(applied.logs.some((l) => l.event === "verify.fail"), "the outcome itself still records");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("T1: an anchored failing run mints exactly ONE signature-id lesson row", { skip: !available }, async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([allPinned]);
    try {
      const outcome = await anchoredFailingRun();
      assert.equal(outcome.status, "failed", "3 failing pinned cases exhaust the run");
      assert.equal(outcome.lessonRefused, undefined, "an anchored failure is provable — never refused");
      const lesson = outcome.lesson;
      assert.ok(lesson, "the failing run mints the L3 signature row");
      assert.match(lesson.id, /^lesson-verify-failure-[0-9a-f]{8}$/, "id hashes the 216g signature");
      assert.ok((lesson.tags ?? []).includes("L3"), "L3 tag present");
      assert.ok((lesson.tags ?? []).includes("verify-failure"), "class tag present");
      assert.match(lesson.text, /orc-1/, "the row text names a failing case anchor");
      assert.equal(lesson.phase, 6, "P6 is the verify loop's phase");
      // Consumer half: exactly ONE row lands in project memory.
      const applied = applyVerifyOutcome(seedProject(), outcome);
      assert.equal(applied.memory.filter((m) => m.id === lesson.id).length, 1, "ONE row, not a fork");
      assert.ok(
        applied.logs.some((l) => l.event === "lesson.capture" && l.detail.includes(lesson.id)),
        "lesson.capture names the row",
      );
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("T1: a repeat re-derives the SAME id and accrues reproducedCount on the ONE row", { skip: !available }, async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([allPinned, allPinned]);
    try {
      const first = await anchoredFailingRun();
      const second = await anchoredFailingRun();
      assert.equal(first.status, "failed");
      assert.equal(second.status, "failed");
      const firstLesson = first.lesson;
      const secondLesson = second.lesson;
      assert.ok(firstLesson, "the first run minted the row");
      assert.ok(secondLesson, "the repeat minted the row again");
      const id = firstLesson.id;
      assert.equal(secondLesson.id, id, "the recurrence re-derives the SAME signature id");
      const applied1 = applyVerifyOutcome(seedProject(), first);
      const afterFirst = applied1.memory.filter((m) => m.id === id);
      assert.equal(afterFirst.length, 1, "first landing stores ONE row");
      assert.equal(afterFirst[0]?.reproducedCount, undefined, "a first landing carries no reproduction count");
      const applied2 = applyVerifyOutcome(applied1, second);
      const afterSecond = applied2.memory.filter((m) => m.id === id);
      assert.equal(afterSecond.length, 1, "the twin folds into the stored row — never two rows");
      assert.equal(afterSecond[0]?.reproducedCount, 1, "the reproduction accrues in place");
      assert.ok(
        applied2.logs.some((l) => l.event === "lesson.reproduced" && l.detail.includes("reproducedCount=1")),
        "lesson.reproduced records the accrual",
      );
      assert.equal(
        applied2.logs.filter((l) => l.event === "lesson.capture").length,
        applied1.logs.filter((l) => l.event === "lesson.capture").length,
        "a twin never re-captures (the first landing's capture row stays the only one)",
      );
      const applied3 = applyVerifyOutcome(applied2, first);
      assert.equal(
        applied3.memory.filter((m) => m.id === id)[0]?.reproducedCount,
        2,
        "the count increments, never resets",
      );
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("T1: the signature id is stable across repeats and distinct for a different anchor set", { skip: !available }, async () => {
    const restoreKey = withFakeKey();
    // A: 1 iteration. B: 2 iterations (one fix round-trip) — same anchors,
    // different run tail. C: a different pinned anchor set (only orc-2).
    const mock = mockChat([allPinned, allPinned, "const x = 1;", onlyOrc2]);
    try {
      const one = await anchoredFailingRun();
      const two = await verifyAndFixServer(SOURCE, BRIEF, {
        seeds: SEEDS,
        pinnedOracleIds: ORACLE_IDS,
        maxIterations: 2,
      });
      assert.equal(one.status, "failed");
      assert.equal(two.status, "failed");
      assert.match(one.evidence, /after 1 iterations/, "run A's tail names its iteration count");
      assert.match(two.evidence, /after 2 iterations/, "run B's tail differs");
      const oneLesson = one.lesson;
      const twoLesson = two.lesson;
      assert.ok(oneLesson, "run A minted a row");
      assert.ok(twoLesson, "run B minted a row");
      assert.equal(twoLesson.id, oneLesson.id, "tail drift never forks the signature id");
      const three = await verifyAndFixServer(SOURCE, BRIEF, {
        seeds: SEEDS,
        pinnedOracleIds: ["orc-2"],
        maxIterations: 1,
      });
      assert.equal(three.status, "failed");
      const threeLesson = three.lesson;
      assert.ok(threeLesson, "run C minted a row for its own anchor set");
      assert.notEqual(threeLesson.id, oneLesson.id, "a different failing anchor set is a different row");
    } finally {
      mock.restore();
      restoreKey();
    }
  });
});

// ---------------------------------------------------------------------------
// T-107.2 (fixes/216p, W6 · L3) — REGISTRY MIGRATION PIN (verify seam).
//
// W5 switched `generateCases` from the legacy `completeDeepSeek(prompt, {json})`
// binding to `callModel("weak", prompt, {json})` (llm/providers/registry.ts).
// This pin proves BOTH halves:
//   1. the same fetch stub is reached with the SAME request shape the
//      pre-registry call sent (url/method/model/thinking/max_tokens/
//      response_format/stream/messages), and
//   2. the REGISTRY resolution is genuinely the code in the path — a
//      `DEEPSEEK_MODEL_WEAK` env pin changes the requested model id, which the
//      legacy binding (a hardcoded flash default) could never have honored.
// ---------------------------------------------------------------------------
describe("216p T-107.2 — registry migration pin (verify seam)", () => {
  it("generateCases reaches the same fetch shape, and the `weak` registry role is the code in the path", async () => {
    const restoreKey = withFakeKey();
    const realFetch = globalThis.fetch;
    const savedPin = process.env.DEEPSEEK_MODEL_WEAK;
    const calls: Array<{ url: string; method?: string; body: Record<string, unknown> }> = [];
    try {
      globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
        calls.push({
          url: String(url),
          method: init?.method,
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        });
        return chatReply(allPinned);
      }) as typeof fetch;

      // (1) No pin: the exact pre-registry request shape.
      delete process.env.DEEPSEEK_MODEL_WEAK;
      const first = await generateCases(SOURCE, BRIEF, [], SEEDS, ORACLE_IDS);
      assert.equal(first.ok, true);
      assert.equal(calls.length, 1, "one generation call, no repair retry");
      const plain = calls[0]!;
      assert.equal(plain.url, "https://api.deepseek.com/chat/completions");
      assert.equal(plain.method, "POST");
      assert.equal(plain.body.model, "deepseek-v4-flash", "the `weak` tier model — the id the legacy call sent");
      assert.deepEqual(plain.body.thinking, { type: "disabled" });
      assert.deepEqual(plain.body.response_format, { type: "json_object" });
      assert.equal(plain.body.stream, false);
      assert.equal(plain.body.max_tokens, 1024, "flash default max_tokens");
      const messages = plain.body.messages as Array<{ role?: string; content?: string }>;
      assert.equal(messages[0]?.role, "system", "json:true still prepends the JSON instruction");
      assert.equal(messages[messages.length - 1]?.role, "user");

      // (2) A role env pin changes the requested id ⇒ the registry resolved it.
      process.env.DEEPSEEK_MODEL_WEAK = "deepseek-v4-pro";
      const second = await generateCases(SOURCE, BRIEF, [], SEEDS, ORACLE_IDS);
      assert.equal(second.ok, true);
      assert.equal(calls.length, 2);
      assert.equal(
        calls[1]!.body.model,
        "deepseek-v4-pro",
        "the registry env pin is honored — the legacy hardcoded binding could not do this",
      );
    } finally {
      globalThis.fetch = realFetch;
      if (savedPin === undefined) delete process.env.DEEPSEEK_MODEL_WEAK;
      else process.env.DEEPSEEK_MODEL_WEAK = savedPin;
      restoreKey();
    }
  });
});

// ---------------------------------------------------------------------------
// T-107.6 (A3 · D2.3 · 226 A3): the budget seam — a budget stop is the CODED
// outcome (RT_E_BUDGET_EXHAUSTED), never RT_E_INTERNAL, and the measured
// usage of every wire response lands in the caller-owned ledger. The default
// cap stays UNSET: with no budget passed the path is byte-identical (every
// test above this block runs budgetless).
// ---------------------------------------------------------------------------
describe("T-107.6 budget seam (A3 catch wrapper)", () => {
  it("records the measured spend then returns the coded refusal (not RT_E_INTERNAL) when the call crosses the cap", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([allPinned]);
    try {
      const budget = createTokenBudget(5); // the fake reply reports 10+10 = 20 tokens
      const res = await generateCases(SOURCE, BRIEF, [], SEEDS, ORACLE_IDS, budget);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.reason, "error");
        assert.equal(res.code, "RT_E_BUDGET_EXHAUSTED");
        assert.notEqual(res.code, "RT_E_INTERNAL");
        assert.match(res.error ?? "", /RT_E_BUDGET_EXHAUSTED/);
      }
      // record-then-signal: the crossing kept the spend it measured.
      assert.deepEqual(budget.ledger, { promptTokens: 10, completionTokens: 10, calls: 1 });
      assert.equal(mock.calls.length, 1, "the response that crossed the cap really landed");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("refuses BEFORE the wire when the budget is already spent to the cap (0 fetch calls)", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([allPinned]);
    try {
      const budget = { ledger: { promptTokens: 10, completionTokens: 0, calls: 1 }, cap: 10 };
      const res = await generateCases(SOURCE, BRIEF, [], SEEDS, ORACLE_IDS, budget);
      assert.equal(res.ok, false);
      if (!res.ok) assert.equal(res.code, "RT_E_BUDGET_EXHAUSTED");
      assert.equal(mock.calls.length, 0, "over-cap refuses BEFORE the wire");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("an unmetered budget (cap unset — D2.3) records spend and never refuses", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([allPinned]);
    try {
      const budget = { ledger: emptyLedger(), cap: undefined };
      const res = await generateCases(SOURCE, BRIEF, [], SEEDS, ORACLE_IDS, budget);
      assert.equal(res.ok, true);
      assert.deepEqual(budget.ledger, { promptTokens: 10, completionTokens: 10, calls: 1 });
      assert.equal(mock.calls.length, 1);
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("verifyAndFixServer surfaces the coded budget stop (status error + coded evidence)", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([allPinned]);
    try {
      const budget = { ledger: { promptTokens: 12, completionTokens: 3, calls: 1 }, cap: 15 };
      const outcome = await verifyAndFixServer(SOURCE, BRIEF, {
        seeds: SEEDS,
        pinnedOracleIds: ORACLE_IDS,
        budget,
      });
      assert.equal(outcome.status, "error");
      assert.match(outcome.evidence, /RT_E_BUDGET_EXHAUSTED/);
      assert.equal(mock.calls.length, 0, "no wire call under an exhausted budget");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("a budget stop at the FIX dispatch exits coded (the loop never spins on a spent budget)", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([allPinned]);
    try {
      // gen spends 20 (10+10) < 25, so generation runs; the fix reply pushes
      // the ledger to 40 > 25, so the FIX dispatch is the seam that stops.
      const budget = { ledger: emptyLedger(), cap: 25 };
      const outcome = await verifyAndFixServer(SOURCE, BRIEF, {
        seeds: SEEDS,
        pinnedOracleIds: ORACLE_IDS,
        budget,
      });
      assert.equal(outcome.status, "error");
      assert.match(outcome.evidence, /fix dispatch refused/);
      assert.match(outcome.evidence, /RT_E_BUDGET_EXHAUSTED/);
      assert.equal(
        budget.ledger.promptTokens + budget.ledger.completionTokens,
        40,
        "generation + fix spend are both kept",
      );
      assert.equal(mock.calls.length, 2, "generation + the fix dispatch that crossed the cap");
    } finally {
      mock.restore();
      restoreKey();
    }
  });
});
