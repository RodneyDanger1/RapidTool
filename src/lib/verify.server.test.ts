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
  ESM_MODULE_UNSUPPORTED_REASON,
  generateCases,
  NO_CALLABLE_EXPORTS_REASON,
  NO_EXPORT_REFERENCE_REASON,
  oracleBriefGrounded,
  parseOracleCases,
  parseOracleJson,
  runCases,
  sanitizeOracleExpression,
  verifyAndFixServer,
} from "./verify.server.ts";
import { runnerAvailable } from "./node-runner.server.ts";
import { createTokenBudget, emptyLedger } from "./token-ledger.ts";
import { oracleToCaseSeeds } from "./dod.ts";
import type { OracleTest, Project } from "./types.ts";
// 216i (112 T1/T2): the lesson-loop pins below consume the client-safe
// consumer half (verify.ts applyVerifyOutcome) over a real seeded project.
import { applyVerifyOutcome } from "./verify.ts";
// 331 V1: the L4 anchor contract this seam forwards cases.map(c => c.id) into.
import { failureLessonFromRecord, verifyOutcomeLesson } from "./knowledge.ts";
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
  "Expressions must be self-contained booleans (e.g. add(2,3) === 5, typeof buildPlan === 'function').",
  "Return EXACTLY ONE boolean expression per case, over the module's exported names, and do NOT wrap",
  "it in backticks. Avoid semicolons, const/let/var declarations, assignments, multiple statements,",
  "arrow functions and template literals. (A declaration followed by a final boolean is a tolerated",
  "repair the harness reduces to the final expression, and its declarations are DISCARDED — never",
  "rely on it; emit the bare boolean expression.)",
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

  it("339-1: the prompt states the CLEAN single-expression form and never backticks the example", () => {
    const prompt = buildOracleCasesPrompt({ source: SOURCE, brief: "", seeds: "" });
    assert.ok(
      !prompt.includes("`add(2,3) === 5`"),
      "the worked example must NOT be backtick-wrapped — the model echoes backticks, which the sanitizer rejects by design",
    );
    assert.ok(prompt.includes("add(2,3) === 5"), "the worked example is present, unwrapped");
    assert.ok(
      prompt.includes("do NOT wrap") && prompt.includes("in backticks"),
      "the prompt tells the model explicitly not to wrap the expression in backticks",
    );
    assert.ok(
      !prompt.includes("FORBIDDEN in every case"),
      "the old blanket FORBIDDEN-declarations rule is reconciled with the tolerated repair",
    );
    assert.ok(
      prompt.includes("tolerated") && prompt.includes("DISCARDED"),
      "the declaration(s); final-boolean form is described honestly as a tolerated repair whose declarations never run",
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
// fixes/327 L5 — the compile verdict is parsed last-marker-wins, exactly like
// HARNESS_EXPORTS. The old `/^HARNESS_COMPILE fail/` (no `m`) matched only at
// position 0, so a compiling module whose OWN first stdout line began with the
// marker was falsely refused ("source failed to compile") even though the
// harness compiled it fine. The harness's real marker is emitted after the
// module body, so it always wins.
// ---------------------------------------------------------------------------
describe("fixes/327 L5 — harness compile verdict (last-marker-wins)", () => {
  it("a module that prints the compile marker but COMPILES is not falsely refused", { skip: !available }, async () => {
    const res = await runCases('console.log("HARNESS_COMPILE fail"); exports.add = (a, b) => a + b;', [
      { id: "add", expression: "add(2,3) === 5" },
    ]);
    assert.equal(
      res.pass,
      true,
      `a compiling module must not be refused by its own stdout: ${JSON.stringify(res)}`,
    );
    assert.equal(res.compileError, undefined);
    assert.equal(res.results[0]?.pass, true);
  });

  it("control: a real syntax error still names the compile failure", { skip: !available }, async () => {
    const res = await runCases("exports.add = (", [{ id: "add", expression: "add(2,3) === 5" }]);
    assert.equal(res.pass, false);
    assert.equal(res.compileError, "source failed to compile in the harness");
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
// 331 V1 (verify-core) — the L4 PASS identity end-to-end through the verify
// seam. A pass on iteration 1 and a pass on iteration 2 of the SAME proven
// case set must mint ONE lesson id; pre-331 the id hashed the evidence tail
// (iteration count), so a recurrence forked the row (probe:
// fixes/330_4_cartographer §3.1).
// ---------------------------------------------------------------------------
describe("331 V1 — the verify seam anchors the L4 row to the proven case set", () => {
  const PASS_SRC = "exports.add = (a, b) => a + b;";
  const FAIL_SRC = "exports.add = (a, b) => a - b;";
  const passCase = { cases: [{ id: "case-1", expression: "add(2,3) === 5" }] };

  it("a pass at iteration 1 and a pass at iteration 2 (same case set) mint ONE id", { skip: !available }, async () => {
    const restoreKey = withFakeKey();
    // Run A passes immediately; run B fails once then the model returns the
    // passing source, so B's evidence tail names iteration 2 — the exact
    // per-run noise that used to fork the L4 row.
    const mock = mockChat([passCase, passCase, PASS_SRC]);
    try {
      const a = await verifyAndFixServer(PASS_SRC, "", { maxIterations: 1 });
      const b = await verifyAndFixServer(FAIL_SRC, "", { maxIterations: 2 });
      assert.equal(a.status, "passed", `run A should pass: ${JSON.stringify(a)}`);
      assert.equal(b.status, "passed", `run B should pass on its fix: ${JSON.stringify(b)}`);
      assert.match(a.evidence, /iteration 1/, "run A's tail names iteration 1");
      assert.match(b.evidence, /iteration 2/, "run B's tail names iteration 2");
      const aLesson = a.lesson;
      const bLesson = b.lesson;
      assert.ok(aLesson, "run A minted the L4 row");
      assert.ok(bLesson, "run B minted the L4 row");
      assert.equal(aLesson.id, bLesson.id, "iteration drift must not fork the verified-procedure id");
      assert.match(aLesson.id, /^lesson-verified-procedure-[0-9a-f]{8}$/);
      // Call-site contract: verify.server.ts must forward `cases.map(c => c.id)`;
      // recomputing the anchored id from the returned outcome must match it.
      const aIds = (a.cases ?? []).map((c) => c.id);
      assert.deepEqual(aIds, ["case-1"]);
      assert.equal(
        verifyOutcomeLesson("passed", 6, a.evidence, a.iterations, aIds).id,
        aLesson.id,
        "verifyOutcomeLesson recomputed with the same anchors reproduces the seam's id",
      );
      // And the id is NOT the unanchored evidence-derived id — proof the seam
      // really passed anchors, not just that two strings happened to match.
      assert.notEqual(
        verifyOutcomeLesson("passed", 6, a.evidence, a.iterations).id,
        aLesson.id,
        "the seam really forwarded anchors (else the ids would coincide)",
      );
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

// ---------------------------------------------------------------------------
// fixes/328 P3 — three pins the 327 wave registered as OWED:
//   (1) parseOracleCases discriminates a valid-but-EMPTY reply from a
//       malformed one (parseOracleJson's legacy `null` collapsed them);
//   (2) runCases refuses a case set that never references an export (109
//       C-01's intersection half — a literal-only set could mint a pass);
//   (3) generateCases diagnoses an empty reply honestly ("valid JSON but no
//       cases"), not with the false "not valid JSON" repair prompt.
// Each assertion is RED against HEAD's verify.server.ts (proven in the
// scratch tree; see fixes/328_p3_assayer.md §teeth).
// ---------------------------------------------------------------------------

describe("fixes/328 P3 — parseOracleCases vs legacy parseOracleJson", () => {
  it("a valid-but-empty reply is 'empty' — NOT 'unparseable' (the owed pin)", () => {
    assert.deepEqual(parseOracleCases('{"cases":[]}'), { ok: false, reason: "empty" });
    assert.deepEqual(parseOracleCases("[]"), { ok: false, reason: "empty" });
    assert.deepEqual(parseOracleCases('{"cases":[{"id":"","expression":"x"}]}'), {
      ok: false,
      reason: "empty",
    });
    assert.deepEqual(parseOracleCases("not json"), { ok: false, reason: "unparseable" });
    assert.deepEqual(parseOracleCases("{}"), { ok: false, reason: "unparseable" });
    assert.deepEqual(parseOracleCases('{"cases":"nope"}'), { ok: false, reason: "unparseable" });
    assert.deepEqual(parseOracleCases(42 as unknown as string), { ok: false, reason: "unparseable" });
  });

  it("ok:true always carries >=1 case; determinism over the valid shape", () => {
    const parsed = parseOracleCases('{"cases":[{"id":"a","expression":"1===1"}]}');
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.deepEqual(parsed.cases, [{ id: "a", expression: "1===1" }]);
    assert.deepEqual(
      parseOracleJson('{"cases":[{"id":"a","expression":"1===1"}]}'),
      parseOracleJson('{"cases":[{"id":"a","expression":"1===1"}]}'),
    );
  });

  it("legacy parseOracleJson is byte-stable: BOTH failure reasons flatten to null", () => {
    assert.equal(parseOracleJson('{"cases":[]}'), null);
    assert.equal(parseOracleJson("not json"), null);
    assert.deepEqual(parseOracleJson('{"cases":[{"id":"a","expression":"1===1"}]}'), [
      { id: "a", expression: "1===1" },
    ]);
  });
});

describe("fixes/328 P3 — runCases refuses a set that never references an export", () => {
  const SRC = "exports.add = (a, b) => a + b; exports.buildPlan = () => ({ ok: true });";

  it("a literal-only set can no longer mint a machine pass (109 C-01 shape)", { skip: !available }, async () => {
    const res = await runCases(SRC, [{ id: "c1", expression: "1 === 1" }]);
    assert.equal(res.pass, false);
    assert.equal(res.compileError, NO_EXPORT_REFERENCE_REASON);
    assert.equal(
      res.results[0]?.pass,
      true,
      "the literal itself evaluates TRUE — the reference gate, not the case, refuses the pass",
    );
  });

  it("an object-bookkeeping literal is refused too", { skip: !available }, async () => {
    const res = await runCases(SRC, [{ id: "c1", expression: "({board:1}).board === 1" }]);
    assert.equal(res.pass, false);
    assert.equal(res.compileError, NO_EXPORT_REFERENCE_REASON);
  });

  it("control: BOTH prompt-allowed forms still pass (typeof and a call)", { skip: !available }, async () => {
    const t = await runCases(SRC, [{ id: "c1", expression: "typeof buildPlan === 'function'" }]);
    assert.equal(t.pass, true, `typeof <export> is an allowed prompt form: ${JSON.stringify(t)}`);
    assert.equal(t.compileError, undefined);
    const c = await runCases(SRC, [{ id: "c1", expression: "add(2,3) === 5" }]);
    assert.equal(c.pass, true, `calling an export is an allowed prompt form: ${JSON.stringify(c)}`);
  });

  it("control: a mixed set with one real case still passes", { skip: !available }, async () => {
    const res = await runCases(SRC, [
      { id: "good", expression: "add(2,3) === 5" },
      { id: "noise", expression: "1 === 1" },
    ]);
    assert.equal(res.pass, true, `one real case grounds the set: ${JSON.stringify(res)}`);
  });
});

describe("fixes/328 P3 — generateCases diagnoses an empty reply honestly", () => {
  it("a valid-but-empty reply gets the EMPTY repair prompt, never 'not valid JSON'", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([{ cases: [] }, { cases: [] }]);
    try {
      const res = await generateCases(SOURCE, BRIEF, [], SEEDS, ORACLE_IDS);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.reason, "error");
        assert.equal(res.code, "RT_E_VALIDATION");
        assert.match(res.error ?? "", /empty oracle/);
        assert.doesNotMatch(res.error ?? "", /unparseable/);
      }
      assert.equal(mock.calls.length, 2, "one bounded repair retry");
      assert.match(mock.calls[1]!.prompt, /valid JSON but carried no cases/);
      assert.doesNotMatch(mock.calls[1]!.prompt, /not valid JSON/);
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("control: a malformed reply keeps the 'not valid JSON' retry and RT_E_INTERNAL", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat(["totally not json", "totally not json"]);
    try {
      const res = await generateCases(SOURCE, BRIEF, [], SEEDS, ORACLE_IDS);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "RT_E_INTERNAL");
        assert.match(res.error ?? "", /unparseable oracle payload/);
      }
      assert.equal(mock.calls.length, 2);
      assert.match(mock.calls[1]!.prompt, /not valid JSON/);
    } finally {
      mock.restore();
      restoreKey();
    }
  });
});

// ---------------------------------------------------------------------------
// 339-1 deliverable 2 — the name-binding gate in generateCases. A case may
// READ or CALL only an exported name in the caller's measured `contract` (the
// signatureNames codegen threads from oracleContractNames) or a pinned JS
// global; anything else can only throw `ReferenceError: <name> is not
// defined` at machine-run time. One bounded repair retry names
// `<case-id> → <identifier>`, then an honest RT_E_VALIDATION refusal. The
// control proves a fully-bound set still commits with no retry; the pinned-row
// tests prove a pinned row is REPAIRED in place, never dropped.
// ---------------------------------------------------------------------------
describe("339-1 generateCases name-binding gate (a case cannot commit an undefined identifier)", () => {
  const CONTRACT = ["mean", "median"];

  it("repairs a case calling an undefined identifier, then commits the fixed expression", async () => {
    const restoreKey = withFakeKey();
    const bad = { cases: [{ id: "c1", expression: "mean(computeAvg([1,2,3])) === 2" }] };
    const good = { cases: [{ id: "c1", expression: "mean([1,2,3]) === 2" }] };
    const mock = mockChat([bad, good]);
    try {
      const res = await generateCases(SOURCE, "mean module", CONTRACT, "", []);
      assert.equal(res.ok, true, "the repaired case commits");
      if (res.ok) assert.equal(res.cases[0]?.expression, "mean([1,2,3]) === 2");
      assert.equal(mock.calls.length, 2, "exactly one bounded repair retry");
      assert.match(mock.calls[1]!.prompt, /c1/, "the repair prompt names the offending case id");
      assert.match(mock.calls[1]!.prompt, /computeAvg/, "the repair prompt names the undefined identifier");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("refuses after the retry when the undefined identifier survives (RT_E_VALIDATION, offender named)", async () => {
    const restoreKey = withFakeKey();
    const bad = { cases: [{ id: "c7", expression: "mean(computeAvg([1,2,3])) === 2" }] };
    const mock = mockChat([bad, bad]);
    try {
      const res = await generateCases(SOURCE, "mean module", CONTRACT, "", []);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.reason, "error");
        assert.equal(res.code, "RT_E_VALIDATION");
        assert.match(res.error ?? "", /c7/);
        assert.match(res.error ?? "", /computeAvg/);
        assert.match(res.error ?? "", /undefined identifier/);
      }
      assert.equal(mock.calls.length, 2, "one bounded repair retry, then an honest refusal");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  // 339-1 resume #3 (verifier A): the gate inspected CALL position only, so a
  // bare VALUE read of an undefined identifier committed with no retry and then
  // died at run time (`ReferenceError: missing is not defined`). It must now be
  // repaired before commit.
  it("repairs a bare VALUE-READ of an undefined identifier (not only a call)", async () => {
    const restoreKey = withFakeKey();
    const bad = { cases: [{ id: "c1", expression: "missing === 2 && mean([1,2,3]) === 2" }] };
    const good = { cases: [{ id: "c1", expression: "mean([1,2,3]) === 2" }] };
    const mock = mockChat([bad, good]);
    try {
      const res = await generateCases(SOURCE, "mean module", CONTRACT, "", []);
      assert.equal(res.ok, true, "the repaired case commits");
      if (res.ok) assert.equal(res.cases[0]?.expression, "mean([1,2,3]) === 2");
      assert.equal(mock.calls.length, 2, "exactly one bounded repair retry");
      assert.match(mock.calls[1]!.prompt, /missing/, "the repair prompt names the undefined identifier");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("repairs a method call on an undefined object (obj.mean())", async () => {
    const restoreKey = withFakeKey();
    const bad = { cases: [{ id: "c1", expression: "obj.mean() === 2" }] };
    const good = { cases: [{ id: "c1", expression: "mean([1,2,3]) === 2" }] };
    const mock = mockChat([bad, good]);
    try {
      const res = await generateCases(SOURCE, "mean module", CONTRACT, "", []);
      assert.equal(res.ok, true);
      assert.equal(mock.calls.length, 2);
      assert.match(mock.calls[1]!.prompt, /obj/);
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("control: a fully-bound case set (exports + JS globals) commits with no retry", async () => {
    const restoreKey = withFakeKey();
    const ok = {
      cases: [
        { id: "c1", expression: "mean([1,2,3]) === 2" },
        { id: "c2", expression: "Math.abs(median([1,2,3])) >= 0" },
        { id: "c3", expression: "typeof mean === 'function'" },
      ],
    };
    const mock = mockChat([ok]);
    try {
      const res = await generateCases(SOURCE, "mean module", CONTRACT, "", []);
      assert.equal(res.ok, true);
      assert.equal(mock.calls.length, 1, "no retry when every called name is bound");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("repairs a PINNED row in place — a pinned id is never dropped to satisfy the gate", async () => {
    const restoreKey = withFakeKey();
    const offPinned = {
      cases: [
        { id: "orc-1", expression: 'dispatch({ job: "dispatch" }) === true' },
        { id: "orc-2", expression: 'missingHelper({ job: "dispatch" }) === true' },
        { id: "orc-3", expression: 'dispatch({ job: "dispatch" }) === true' },
      ],
    };
    const fixed = { cases: [{ id: "orc-2", expression: 'dispatch({ job: "dispatch" }) === true' }] };
    const mock = mockChat([offPinned, fixed]);
    try {
      const res = await generateCases(SOURCE, BRIEF, ["dispatch"], SEEDS, ORACLE_IDS);
      assert.equal(res.ok, true);
      if (res.ok) {
        const ids = res.cases.map((c) => c.id);
        for (const id of ORACLE_IDS) assert.ok(ids.includes(id), `pinned ${id} preserved`);
        assert.equal(
          res.cases.find((c) => c.id === "orc-2")?.expression,
          'dispatch({ job: "dispatch" }) === true',
          "the pinned row was repaired in place, not dropped",
        );
      }
      assert.equal(mock.calls.length, 2);
      assert.match(mock.calls[1]!.prompt, /orc-2/, "the repair prompt names the offending pinned row");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("refuses (never drops the pinned row) when the pinned repair still calls an undefined identifier", async () => {
    const restoreKey = withFakeKey();
    const offPinned = {
      cases: [
        { id: "orc-1", expression: 'dispatch({ job: "dispatch" }) === true' },
        { id: "orc-2", expression: 'missingHelper({ job: "dispatch" }) === true' },
        { id: "orc-3", expression: 'dispatch({ job: "dispatch" }) === true' },
      ],
    };
    const mock = mockChat([offPinned, offPinned]);
    try {
      const res = await generateCases(SOURCE, BRIEF, ["dispatch"], SEEDS, ORACLE_IDS);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.code, "RT_E_VALIDATION");
        assert.match(res.error ?? "", /orc-2/);
        assert.match(res.error ?? "", /missingHelper/);
      }
      assert.equal(mock.calls.length, 2);
    } finally {
      mock.restore();
      restoreKey();
    }
  });
});

// ---------------------------------------------------------------------------
// fixes/330 P3 — the reference gate must require a VALUE-position read. The
// 328 P3 gate scanned every identifier TOKEN, so a data-only mention of the
// export name — an object-literal KEY (`({add:1}).add === 1`) or regex content
// (`({r:/add/})`) — satisfied it while the module was never touched: the exact
// 109 C-01 shape, re-opened one layer down. Each forge row is RED against
// HEAD's verify.server.ts; the controls prove the stricter scan still accepts
// every prompt-allowed form (typeof, a call, a property OF the export, a
// ternary alternate, and legitimate division/regex text).
// ---------------------------------------------------------------------------
describe("fixes/330 P3 — runCases reference gate rejects data-only mentions", () => {
  const SRC = "exports.add = (a, b) => a + b;";

  it("an object key that spells the export name is NOT a reference", { skip: !available }, async () => {
    const res = await runCases(SRC, [{ id: "c1", expression: "({add:1}).add === 1" }]);
    assert.equal(res.results[0]?.pass, true, "the literal itself is TRUE — the gate refuses the pass");
    assert.equal(res.pass, false);
    assert.equal(res.compileError, NO_EXPORT_REFERENCE_REASON);
  });

  it("regex content that spells the export name is NOT a reference", { skip: !available }, async () => {
    const res = await runCases(SRC, [{ id: "c1", expression: "({r:/add/}).r.source.length === 3" }]);
    assert.equal(res.results[0]?.pass, true);
    assert.equal(res.pass, false);
    assert.equal(res.compileError, NO_EXPORT_REFERENCE_REASON);
  });

  it("a property access alone is NOT a reference (a value-position read is required)", { skip: !available }, async () => {
    // `add` appears twice — as the object KEY and as the property — and neither
    // reads the exported binding.
    const res = await runCases(SRC, [{ id: "c1", expression: "typeof ({add:1}).add === 'number'" }]);
    assert.equal(res.results[0]?.pass, true);
    assert.equal(res.pass, false);
    assert.equal(res.compileError, NO_EXPORT_REFERENCE_REASON);
  });

  it("control: typeof, a call, a property OF the export, division and ternary text all still reference", { skip: !available }, async () => {
    const forms = [
      "typeof add === 'function'",
      "add(2,3) === 5",
      "add.length === 2",
      "add.length / 2 === 1",
      "true ? 1 === 1 : add(1,1) === 2",
      "add.length === 2 && /^\\d+$/.test('12')",
    ];
    for (const expression of forms) {
      const res = await runCases(SRC, [{ id: "c1", expression }]);
      assert.equal(res.pass, true, `${expression} must stay a valid reference: ${JSON.stringify(res)}`);
      assert.equal(res.compileError, undefined);
    }
  });

  it("control: a mixed set with one real case still passes", { skip: !available }, async () => {
    const res = await runCases(SRC, [
      { id: "good", expression: "add(2,3) === 5" },
      { id: "noise", expression: "({add:1}).add === 1" },
    ]);
    assert.equal(res.pass, true, `one real reference grounds the set: ${JSON.stringify(res)}`);
  });
});

// ---------------------------------------------------------------------------
// 338-6 — a FORGED verdict cannot pass. The harness emits ORACLE_RESULT lines
// through a console bound BEFORE the module runs; the parser accepts each
// expected id exactly once and fails the run on any unknown/duplicate line.
// These pins prove a module that prints its own verdict line (the one shape a
// hostile payload would use to mint a green without running) is refused.
// ---------------------------------------------------------------------------
describe("338-6 — a forged ORACLE_RESULT line can never mint a pass", () => {
  it("a module printing a fake pass for the real id is refused (real case fails)", { skip: !available }, async () => {
    const src = 'exports.add = (a, b) => a + b;\nconsole.log("ORACLE_RESULT c1 pass");';
    const res = await runCases(src, [{ id: "c1", expression: "add(2,3) === 99" }]);
    assert.equal(res.pass, false, `the forged line must not carry the run: ${JSON.stringify(res)}`);
  });

  it("a module printing an UNKNOWN oracle id is refused even when the real case passes", { skip: !available }, async () => {
    const src = 'exports.add = (a, b) => a + b;\nconsole.log("ORACLE_RESULT ghost pass");';
    const res = await runCases(src, [{ id: "c1", expression: "add(2,3) === 5" }]);
    assert.equal(res.pass, false, `an unknown id is forged evidence: ${JSON.stringify(res)}`);
  });

  it("control: the same module without the forged line passes", { skip: !available }, async () => {
    const src = "exports.add = (a, b) => a + b;";
    const res = await runCases(src, [{ id: "c1", expression: "add(2,3) === 5" }]);
    assert.equal(res.pass, true, JSON.stringify(res));
  });
});

// ---------------------------------------------------------------------------
// 338-6 — the learning loop is real and load-bearing: a lesson HARVESTED from
// a real machine-run failure (the anchored L3 record the verify seam mints),
// persisted into project.memory by applyVerifyOutcome, is RANKED and SEEDED
// into the ACTUAL P6 expansion site's `lessons` argument (codegen
// liveP6Synthesis — the same call `expandBrief` receives as its advisory list).
// Deterministic: every model seam is injected, so no key is used and the fetch
// tripwire proves no network was touched.
// ---------------------------------------------------------------------------
describe("338-6 — a harvested lesson changes the P6 expansion input", () => {
  it("a failed run's anchored lesson rides the expansion site's `lessons` argument", { skip: !available }, async () => {
    const { liveP6Synthesis } = await import("./codegen.server.ts");
    const brief = "Build a kanban board with drag-and-drop task columns";
    const src = "exports.add = (a, b) => a + b;";
    // 1. a real machine-run failure.
    const run = await runCases(src, [{ id: "kanban-column-order", expression: "add(2,3) === 99" }]);
    assert.equal(run.pass, false);
    const failingIds = run.results.filter((r) => !r.pass).map((r) => r.id);
    const evidence = `machine-run cases still failing after 1 iterations: ${run.results
      .map((f) => `${f.id}: ${f.detail}`)
      .join("; ")}`;
    // 2. the anchored L3 lesson (the verify seam's own harvest gate).
    const mined = failureLessonFromRecord(
      { kind: "verify-failed", phase: 6, classCode: null, anchors: failingIds, detailTail: evidence },
      { iterations: 1 },
    );
    assert.equal(mined.refused, false, "a real anchored failure mints a lesson");
    if (mined.refused) return;
    // 3. persistence into project.memory (the client-safe consumer half).
    const base = { ...seedProject(), brief, implementationSpec: undefined };
    const applied = applyVerifyOutcome(base, {
      status: "failed",
      iterations: 1,
      evidence,
      finalSource: src,
      cases: [{ id: "kanban-column-order", expression: "add(2,3) === 99" }],
      lesson: mined.lesson,
    });
    assert.ok(
      (applied.memory ?? []).some((m) => m.id === mined.lesson.id),
      "the lesson row is persisted to memory",
    );
    // 4. the ACTUAL expansion site, with the model seam captured.
    const capture = async (project: Project): Promise<readonly string[] | undefined> => {
      let got: readonly string[] | undefined;
      await liveP6Synthesis(project, {
        expand: async (_b: string, lessons?: readonly string[]) => {
          got = lessons;
          return { ok: false as const, reason: "error" as const, error: "capture-only" };
        },
        complete: async () => ({ ok: false as const, reason: "error" as const, error: "never called" }),
        verify: async () => ({ status: "error" as const, iterations: 0, evidence: "never called" }),
      });
      return got;
    };
    const prev = process.env.DEEPSEEK_API_KEY;
    let networkTouched = false;
    const realFetch = globalThis.fetch;
    process.env.DEEPSEEK_API_KEY = "sk-3386-no-network";
    globalThis.fetch = (async () => {
      networkTouched = true;
      throw new Error("network must not be touched");
    }) as typeof fetch;
    try {
      const without = await capture(base);
      const withLesson = await capture(applied);
      assert.equal(without, undefined, "with no lesson the expansion input is the legacy shape");
      assert.ok(
        (withLesson ?? []).some((l) => l.includes("L3 verify-failure")),
        `the harvested lesson rides the expansion input: ${JSON.stringify(withLesson)}`,
      );
      assert.notDeepEqual(withLesson, without, "the expansion input CHANGED");
      assert.equal(networkTouched, false, "no keyed call: every model seam was injected");
    } finally {
      globalThis.fetch = realFetch;
      if (prev === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = prev;
    }
  });
});

// ---------------------------------------------------------------------------
// 339-6 + 340-3 — the `tested` mint is airtight: a hollow "passed" envelope is
// REFUSED at the client seam, never stamped tested. verify.server.ts's genuine
// runner pass always carries the non-empty case set it evaluated, a non-empty
// evidence string, AND the finalSource it ran; anything else is a fabrication
// path that maker-score M4 / judgment.ts read as machine proof (they check the
// label + hash, not the detail dod.ts checks). 340-3 closed the last two
// shapes: an ABSENT `cases` field (the 337-3 fixtures now carry a real case
// set) and a pass with no verified finalSource.
// ---------------------------------------------------------------------------
describe("339-6 — a hollow 'passed' outcome never mints tested", () => {
  const base = {
    status: "passed" as const,
    iterations: 1,
    finalSource: "exports.add = (a, b) => a + b;",
  };
  const testedLabel = (p: Project): string | null =>
    (p.lastTest as { label?: string } | null)?.label ?? null;

  it("an ABSENT `cases` field mints no tested label (340-3: the last hollow-pass path)", () => {
    const p = seedProject();
    const q = applyVerifyOutcome(p, {
      ...base,
      evidence: "1/1 machine-run cases passed on iteration 1",
    });
    assert.equal(testedLabel(q), null, "a pass that never names the cases it ran is not a runner pass");
    assert.equal(q, p, "a refused hollow verdict changes no state");
  });

  it("a pass with no verified final source mints no tested label (340-3 sibling)", () => {
    const p = seedProject();
    const q = applyVerifyOutcome(p, {
      ...base,
      evidence: "1/1 machine-run cases passed on iteration 1",
      cases: [{ id: "c1", expression: "add(2,3) === 5" }],
      finalSource: "   ",
    });
    assert.equal(testedLabel(q), null, "a pass naming no verified bytes cannot converge generatedSource");
    assert.equal(q, p, "a refused hollow verdict changes no state");
  });

  it("a present-but-empty case set (`cases: []`) mints no tested label", () => {
    const p = seedProject();
    const q = applyVerifyOutcome(p, {
      ...base,
      evidence: "1/1 machine-run cases passed on iteration 1",
      cases: [],
    });
    assert.equal(testedLabel(q), null, "an empty case set is not a runner pass");
    assert.equal(q, p, "a refused hollow verdict changes no state");
  });

  it("a whitespace-only evidence string mints no tested label", () => {
    const p = seedProject();
    const q = applyVerifyOutcome(p, {
      ...base,
      evidence: "   ",
      cases: [{ id: "c1", expression: "add(2,3) === 5" }],
    });
    assert.equal(testedLabel(q), null, "a pass with no evidence text is not a runner pass");
    assert.equal(q, p, "a refused hollow verdict changes no state");
  });

  it("control: a genuine pass (non-empty evidence + case set) still mints tested", () => {
    const p = seedProject();
    const q = applyVerifyOutcome(p, {
      ...base,
      evidence: "1/1 machine-run cases passed on iteration 1",
      cases: [{ id: "c1", expression: "add(2,3) === 5" }],
    });
    assert.equal(testedLabel(q), "tested");
  });

  it("a non-iterable `cases` never throws into the caller (never-throws contract)", () => {
    const p = seedProject();
    const q = applyVerifyOutcome(p, {
      status: "failed",
      iterations: 1,
      evidence: "boom",
      cases: 7 as never,
    });
    assert.ok(q && typeof q === "object", "applyVerifyOutcome returned a project, never threw");
    assert.ok((q.logs ?? []).some((l) => l.event === "verify.fail"), "the failed verdict is still recorded");
  });
});

// ---------------------------------------------------------------------------
// 340-3 — the manual Oracle/CLI seam (headless.verifyGeneratedSource) can hand
// verifyAndFixServer a materialized ESM tree entry (`export * from …`). The
// CommonJS harness cannot compile it, so the honest outcome is a coded error
// refusal naming ESM — returned BEFORE any keyed case generation or fix loop.
// ---------------------------------------------------------------------------
describe("340-3 — an ESM module is refused before any keyed work", () => {
  it("returns status error with the coded ESM reason and touches no model wire", async () => {
    const restoreKey = withFakeKey();
    const realFetch = globalThis.fetch;
    let called = 0;
    globalThis.fetch = (async () => {
      called++;
      throw new Error("no keyed call may run for a module the harness cannot execute");
    }) as typeof fetch;
    try {
      const outcome = await verifyAndFixServer('export * from "./generated/chunk-0.ts";\n', BRIEF);
      assert.equal(outcome.status, "error");
      assert.equal(outcome.iterations, 0, "no machine run was minted");
      assert.equal(outcome.evidence, ESM_MODULE_UNSUPPORTED_REASON);
      assert.match(outcome.evidence, /RT_E_RUNNER_FAILED/, "the refusal is coded");
      assert.equal(outcome.lesson, undefined, "an unanchored pre-run refusal mints no lesson row");
      assert.equal(called, 0, "the structural refusal precedes case generation");
    } finally {
      globalThis.fetch = realFetch;
      restoreKey();
    }
  });

  it("control: a CJS module still reaches case generation (no false ESM refusal)", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([allPinned]);
    try {
      const outcome = await verifyAndFixServer(SOURCE, BRIEF, {
        seeds: SEEDS,
        pinnedOracleIds: ORACLE_IDS,
      });
      assert.notEqual(outcome.evidence, ESM_MODULE_UNSUPPORTED_REASON);
      assert.equal(mock.calls.length > 0, true, "generation was attempted for a CJS module");
    } finally {
      mock.restore();
      restoreKey();
    }
  });
});
