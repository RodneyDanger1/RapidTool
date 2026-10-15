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
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  behaviouralOracleExpression,
  buildOracleCasesPrompt,
  droppedPinnedOracleIds,
  ESM_MODULE_UNSUPPORTED_REASON,
  generateCases,
  NO_CALLABLE_EXPORTS_REASON,
  NO_EXPORT_REFERENCE_REASON,
  VERDICT_CHANNEL_FAILED_REASON,
  verdictChannelFailed,
  oracleBriefGrounded,
  oracleHasBehaviouralCase,
  parseOracleCases,
  parseOracleJson,
  runCases,
  sanitizeOracleExpression,
  shapeOnlyOracleCaseIds,
  verifyAndFixServer,
  failingCaseIds,
  isMonotoneFix,
  frozenOracleCases,
  COMPILE_FAILURE_CASE_ID,
} from "./verify.server.ts";
import type { VerifyCase } from "./verify.server.ts";
// 346 cross-lane: the tree-lane assertion floor, exercised head-to-head against
// behaviouralOracleExpression over one shared corpus (cross-lane parity pin).
import { specSourceHasBehaviouralAssert } from "./compile-check.server.ts";
// 346 V5: the ARMED chunk resample's selector (pure, keyless) + the tree-run
// mint seam — composed here to prove a deterministic-gate winner still cannot
// mint `tested` without the executed-assertion floor.
import { selectBestOfN } from "./synthesis-policy.ts";
import { mintTreeRunTested, treeRunTestedEvidence } from "./codegen.server.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";
import { runnerAvailable, permissionModelAvailable } from "./node-runner.server.ts";
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
  "BEHAVIOURAL ASSERTION REQUIRED: at least one case MUST constrain an exported result beyond its",
  "presence or type — compare a call/return (or a property of it) to a concrete expected value",
  "(e.g. add(2,3) === 5, mean([]) === 0, plan().length === 3, result.ok === true) or a numeric/boolean",
  "predicate (e.g. median([1,2,3]) >= 2). A set made ONLY of `typeof x === 'function'` and",
  "`f(1) !== null` / `!== undefined` presence checks is REJECTED as self-certifying — shape proves",
  "nothing about behavior. If the brief defines no observable result for a name, say so explicitly",
  "in that case's expression so the gap is recorded — never certify a shape-only set.",
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
    // 345 L1-F2: the payload must be BEHAVIOURAL (a literal-only `1 === 1` is now
    // refused by the shape-only floor); the assertion under test is the prompt
    // bytes, not the payload.
    const mock = mockChat([{ cases: [{ id: "c1", expression: "x === 1" }] }]);
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
// fixes/327 L5 — a module's own stdout cannot decide the compile verdict.
// (344 A2-F1 CHANGED THE MECHANISM: the verdict now rides the nonce-
// authenticated fd-3 channel, so stdout is non-authoritative detail outright —
// this pin no longer relies on last-marker-wins. The legacy line format is
// unchanged; only the channel moved.) The old `/^HARNESS_COMPILE fail/` (no
// `m`) matched only at position 0, so a compiling module whose OWN first stdout
// line began with the marker was falsely refused ("source failed to compile")
// even though the harness compiled it fine.
// ---------------------------------------------------------------------------
describe("fixes/327 L5 — harness compile verdict (stdout is non-authoritative)", () => {
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
// fixes/346 lane-1 — the candidate module `runCases` executes now runs under
// the full `strict` bound (fs-write confined to the per-run scratch, no
// subprocess/worker/addon). REAL subprocess proof: the module reaches fs via
// `process.getBuiltinModule('fs')` (no `require` needed — the harness passes a
// no-op require), writes a sibling of the scratch dir (denied) and the scratch
// itself (allowed). Failing-first: under the legacy (unconfined) runner the
// outside write SUCCEEDS, `outside()` returns "ESCAPED", the case is false and
// `res.pass` is false.
// ---------------------------------------------------------------------------
describe("fixes/346 lane-1 — runCases executes under the strict isolation bound", () => {
  const strictReady = available && permissionModelAvailable();

  it("denies a module write OUTSIDE the runner scratch, allows one inside it (real child)", { skip: !strictReady }, async () => {
    const escape = join(tmpdir(), `rapidtool-346-verify-escape-${process.pid}-${Date.now()}.txt`);
    try {
      const src = [
        "exports.outside = function () {",
        "  try { var fs = process.getBuiltinModule('fs');",
        `    fs.writeFileSync(${JSON.stringify(escape)}, 'pwned'); return 'ESCAPED';`,
        "  } catch (e) { return 'DENIED:' + (e && e.code); }",
        "};",
        "exports.inside = function () {",
        "  try { var fs = process.getBuiltinModule('fs');",
        "    fs.writeFileSync('./verify-inside.txt', 'ok'); return 'WROTE';",
        "  } catch (e) { return 'FAILED:' + (e && e.code); }",
        "};",
      ].join("\n");
      const res = await runCases(src, [
        { id: "outside", expression: "outside() === 'DENIED:ERR_ACCESS_DENIED'" },
        { id: "inside", expression: "inside() === 'WROTE'" },
      ]);
      assert.equal(
        res.pass,
        true,
        `strict must deny the outside write and allow the scratch write: ${JSON.stringify(res)}`,
      );
      assert.equal(existsSync(escape), false, "the escape file must never exist on disk");
    } finally {
      try {
        rmSync(escape, { force: true });
      } catch {
        /* nothing to clean */
      }
    }
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
      // W61 lane D (D2/I3): a failed machine run carries the runner-family code
      // at the top level (the D→B contract).
      assert.equal(outcome.code, "RT_E_RUNNER_FAILED", "failed carries RT_E_RUNNER_FAILED");
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
// 338-6 — a FORGED verdict cannot pass. (344 A2-F1 CHANGED THE MECHANISM: the
// harness now emits ORACLE_RESULT lines on the nonce-authenticated fd-3
// channel, not on stdout; the parser accepts each expected id exactly once and
// fails the run on any unknown/duplicate line. A module that prints its own
// ORACLE_RESULT line on stdout is impersonating the verdict channel and fails
// the run outright.) These pins prove a module that prints its own verdict line
// (the one shape a hostile payload would use to mint a green without running)
// is refused.
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
      // W61 lane D (D2/I3): the code is the TOP-LEVEL contract, not only inside
      // the lesson — the CLI branches on it instead of classifying to RT_E_UNKNOWN.
      assert.equal(outcome.code, "RT_E_RUNNER_FAILED", "the real top-level code rides the outcome");
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

  it("D2: a not-configured outcome carries RT_E_LLM_NOT_CONFIGURED at the top level", async () => {
    const saved = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      const outcome = await verifyAndFixServer(SOURCE, BRIEF);
      assert.equal(outcome.status, "not-configured");
      assert.equal(outcome.code, "RT_E_LLM_NOT_CONFIGURED", "the real class is on the outcome");
    } finally {
      if (saved !== undefined) process.env.DEEPSEEK_API_KEY = saved;
    }
  });
});

// ---------------------------------------------------------------------------
// 341-3 — wiring audit: the 340-3 "named, not closed" dead duplicate is gone.
// `oracleSignatureFunctionNames` duplicated codegen.server.ts's
// `signatureFunctionNames` and had ZERO call sites repo-wide (not even tests);
// codegen.server.ts owns the live helper and every caller threads the derived
// names in, so the verify-side copy was a declared helper nothing evaluated.
// ---------------------------------------------------------------------------
describe("341-3 — no dead oracle-signature duplicate is exported", () => {
  it("verify.server.ts no longer exports `oracleSignatureFunctionNames`", async () => {
    const mod = await import("./verify.server.ts");
    assert.equal(
      "oracleSignatureFunctionNames" in mod,
      false,
      "the dead duplicate stays removed (codegen.server.ts owns signatureFunctionNames)",
    );
  });
});

// ---------------------------------------------------------------------------
// 344 A2-F1 (Critical) — the module under test can no longer forge the verdict.
//
// The pre-fix harness emitted HARNESS_EXPORTS / HARNESS_COMPILE / ORACLE_RESULT
// on the SAME stdout as the module, and runCases parsed those lines
// last-line-wins. A module that THROWS on load and exports nothing could
// `setTimeout(() => console.log('HARNESS_EXPORTS exports');
// console.log('HARNESS_COMPILE pass'))` and turn a broken module into
// `{pass:true}` — bypassing BOTH the compile-fail and the no-callables
// refusals — which then minted `lastTest {label:"tested"}`. The verdict now
// rides a dedicated fd-3 channel authenticated by a per-run nonce delivered
// out-of-band on the child's stdin; runCases reads verdicts ONLY from that
// channel and treats stdout as non-authoritative detail. (RED before the fix:
// the two `forgery` cases below returned pass:true.)
// ---------------------------------------------------------------------------
describe("344 A2-F1 — the verdict channel is unforgeable by the module", () => {
  // The exact repro: a module that throws on load, exports nothing, and
  // schedules lookalike marker lines on stdout.
  const FORGE_THROWING =
    "setTimeout(function(){ console.log('HARNESS_EXPORTS exports'); console.log('HARNESS_COMPILE pass'); }, 0);\n" +
    "throw new Error('module is broken on load');";
  // V2's stronger shape: no throw at all — just a bare lookalike print.
  const FORGE_NO_THROW =
    "setTimeout(function(){ console.log('HARNESS_EXPORTS exports'); console.log('HARNESS_COMPILE pass'); }, 0);\n" +
    "console.log('HARNESS_EXPORTS exports');\n" +
    "console.log('HARNESS_COMPILE pass');";
  const FORGE_CASE: VerifyCase[] = [{ id: "c1", expression: "typeof exports === 'object'" }];

  it("(a) a load-throwing module that schedules lookalike markers is refused", { skip: !available }, async () => {
    const res = await runCases(FORGE_THROWING, FORGE_CASE);
    assert.equal(res.pass, false, `forgery must be refused, got ${JSON.stringify(res)}`);
    assert.equal(res.compileError, "source failed to compile in the harness");
  });

  it("(b) a plain lookalike console.log module (no throw) is refused as vacuous", { skip: !available }, async () => {
    const res = await runCases(FORGE_NO_THROW, FORGE_CASE);
    assert.equal(res.pass, false, `forgery must be refused, got ${JSON.stringify(res)}`);
    assert.equal(res.compileError, NO_CALLABLE_EXPORTS_REASON);
  });

  it("(e) a module writing lookalikes directly to fd 3 (no nonce) cannot pass", { skip: !available }, async () => {
    const src =
      'const fs = process.getBuiltinModule("fs");\n' +
      'try { fs.writeSync(3, "HARNESS_EXPORTS evil\\nHARNESS_COMPILE pass\\n"); } catch (e) {}\n' +
      'setTimeout(function(){ try { fs.writeSync(3, "ORACLE_RESULT c1 pass\\n"); } catch (e) {} }, 0);';
    const res = await runCases(src, FORGE_CASE);
    assert.equal(res.pass, false, `an unauthenticated fd-3 line must not carry the run: ${JSON.stringify(res)}`);
  });

  it("(e2) hooking fs.writeSync cannot capture the nonce and forge a verdict", { skip: !available }, async () => {
    // The module wraps fs.writeSync to harvest whatever the harness writes to
    // fd 3, then forges an authenticated-looking line. The harness captures the
    // REAL writeSync before the module runs and keeps the nonce in IIFE scope,
    // so the hook sees no nonce and the forged line is dropped.
    const src =
      'const fs = process.getBuiltinModule("fs");\n' +
      'let cap = "";\n' +
      'const real = fs.writeSync;\n' +
      'fs.writeSync = function (fd, s) { if (fd === 3 && !cap) cap = String(s).split(" ")[0]; return real.call(fs, fd, s); };\n' +
      'exports.add = (a, b) => a + b;\n' +
      'setTimeout(function(){ try { fs.writeSync(3, cap + " ORACLE_RESULT c1 pass\\n"); } catch (e) {} }, 0);';
    const res = await runCases(src, [{ id: "c1", expression: "add(2,3) === 99" }]);
    assert.equal(res.pass, false, `a harvested-nonce forgery must not pass: ${JSON.stringify(res)}`);
    assert.equal(res.results[0]?.pass, false, "the real failing case still decides the verdict");
  });

  it("(c) control: a genuinely green module still passes", { skip: !available }, async () => {
    const res = await runCases("exports.add = (a, b) => a + b;", [{ id: "add", expression: "add(2,3) === 5" }]);
    assert.equal(res.pass, true, JSON.stringify(res));
    assert.equal(res.compileError, undefined);
    assert.equal(res.results[0]?.pass, true);
  });

  it("(d) control: a genuine compile failure still refuses", { skip: !available }, async () => {
    const res = await runCases("exports.add = (", [{ id: "add", expression: "add(2,3) === 5" }]);
    assert.equal(res.pass, false);
    assert.equal(res.compileError, "source failed to compile in the harness");
  });

  it("(end-to-end) verifyAndFixServer refuses the forgery and mints no tested label", { skip: !available }, async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([{ cases: [{ id: "c1", expression: "typeof exports === 'object'" }] }]);
    try {
      const outcome = await verifyAndFixServer(FORGE_THROWING, "", { maxIterations: 1 });
      assert.notEqual(outcome.status, "passed", `the forgery must not mint a pass: ${JSON.stringify(outcome)}`);
      const applied = applyVerifyOutcome(seedProject(), outcome);
      const label = (applied.lastTest as { label?: string } | null)?.label ?? null;
      assert.notEqual(label, "tested", "no machine-proof stamp for a module that never loaded");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("(end-to-end control) a genuinely green module passes and mints tested", { skip: !available }, async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([{ cases: [{ id: "c1", expression: "add(2,3) === 5" }] }]);
    try {
      const outcome = await verifyAndFixServer("exports.add = (a, b) => a + b;", "", { maxIterations: 1 });
      assert.equal(outcome.status, "passed", JSON.stringify(outcome));
      const applied = applyVerifyOutcome(seedProject(), outcome);
      assert.equal((applied.lastTest as { label?: string } | null)?.label, "tested");
    } finally {
      mock.restore();
      restoreKey();
    }
  });
});

// ---------------------------------------------------------------------------
// 345 L1-F2 (Med) — a SHAPE-ONLY case set can no longer certify behaviour.
//
// The oracle is authored by the SAME model that wrote the module, so a case
// set that checks only presence/type (`typeof add === "function"`,
// `add(1) !== null`, `!== undefined`) certifies nothing. Reproduced: a module
// whose only export returns NaN earned `status:"passed"` → lastTest
// {label:"tested"} from the single case `boardAdd(1) !== null`.
//
// The fix requires at least one case that constrains an exported result
// beyond presence/type — a comparison to a concrete expected value or a
// numeric/boolean predicate. A shape-only set takes ONE bounded repair
// re-prompt and is then REFUSED with a coded reason; it can never pass.
// (RED before the fix: the refusal tests below returned ok:true / passed.)
// ---------------------------------------------------------------------------
describe("345 L1-F2 — shape-only case sets cannot certify behaviour", () => {
  const BROKEN = "exports.boardAdd = function () { return NaN; };";
  const SHAPE_ONLY = [{ id: "c1", expression: "boardAdd(1) !== null" }];

  it("refuses a shape-only set after one bounded repair (RT_E_VALIDATION, never a pass)", async () => {
    const restoreKey = withFakeKey();
    const payload = { cases: SHAPE_ONLY };
    const mock = mockChat([payload, payload]);
    try {
      const res = await generateCases(BROKEN, "build a board", [], "", []);
      assert.equal(res.ok, false, "a shape-only set must not commit");
      if (!res.ok) {
        assert.equal(res.reason, "error");
        assert.equal(res.code, "RT_E_VALIDATION");
        assert.match(res.error ?? "", /shape-only/i);
        assert.match(res.error ?? "", /c1/, "the offending case id is named");
      }
      assert.equal(mock.calls.length, 2, "one bounded repair retry, then an honest refusal");
      assert.match(mock.calls[1]!.prompt, /presence or type/i, "the repair demands a behavioural assertion");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("repairs a shape-only set into a behavioural one and commits it", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([{ cases: SHAPE_ONLY }, { cases: [{ id: "c1", expression: "boardAdd(1) === NaN || boardAdd(1) !== 0" }] }]);
    try {
      const res = await generateCases(BROKEN, "build a board", [], "", []);
      assert.equal(res.ok, true, JSON.stringify(res));
      assert.equal(mock.calls.length, 2, "exactly one bounded repair retry");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("control: a genuinely behavioural set commits with NO retry", async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([{ cases: [{ id: "c1", expression: "add(2,3) === 5" }] }]);
    try {
      const res = await generateCases("exports.add = (a, b) => a + b;", "", [], "", []);
      assert.equal(res.ok, true, JSON.stringify(res));
      assert.equal(mock.calls.length, 1, "a behavioural set needs no repair");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("control: a mixed set with one behavioural case commits (typeof cases alone are not enough)", async () => {
    const restoreKey = withFakeKey();
    const mixed = {
      cases: [
        { id: "c1", expression: "typeof add === 'function'" },
        { id: "c2", expression: "add(2,3) === 5" },
      ],
    };
    const mock = mockChat([mixed]);
    try {
      const res = await generateCases("exports.add = (a, b) => a + b;", "", [], "", []);
      assert.equal(res.ok, true, JSON.stringify(res));
      assert.equal(mock.calls.length, 1, "one behavioural case grounds the set");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("(end-to-end) the () => NaN stub with a shape-only oracle is refused and mints no tested label", { skip: !available }, async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([{ cases: SHAPE_ONLY }]);
    try {
      const outcome = await verifyAndFixServer(BROKEN, "build a board", { maxIterations: 1 });
      assert.notEqual(outcome.status, "passed", `a shape-only oracle must not pass: ${JSON.stringify(outcome)}`);
      assert.equal(outcome.status, "error");
      const applied = applyVerifyOutcome(seedProject(), outcome);
      const label = (applied.lastTest as { label?: string } | null)?.label ?? null;
      assert.notEqual(label, "tested", "no machine-proof stamp for a module certified only by shape");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("350: a genuine pass states the executed-assertion floor (iterations >= 1, executedAssertions >= 1, no code)", { skip: !available }, async () => {
    const restoreKey = withFakeKey();
    const mock = mockChat([{ cases: [{ id: "c1", expression: "add(2,3) === 5" }] }]);
    try {
      const outcome = await verifyAndFixServer("exports.add = (a, b) => a + b;", "", { maxIterations: 1 });
      assert.equal(outcome.status, "passed", JSON.stringify(outcome));
      assert.ok((outcome.iterations ?? 0) >= 1, "a pass reports a real executed loop iteration");
      assert.ok(
        (outcome.executedAssertions ?? 0) >= 1,
        "the honest producer states the executed-assertion floor",
      );
      assert.equal(outcome.code, undefined, "a pass carries no error code (never dual-channel)");
    } finally {
      mock.restore();
      restoreKey();
    }
  });
});

// ---------------------------------------------------------------------------
// 345 L1-F2 — the pure classifier behind the floor. Behavioural iff a module
// read is tied to a concrete expected value (strict comparison) or carries a
// relational predicate; shape-only for typeof/presence/tautology/bare-call.
// ---------------------------------------------------------------------------
describe("345 L1-F2 — behaviouralOracleExpression classifier", () => {
  const behavioural = [
    "add(2,3) === 5",
    'dispatch({ job: "dispatch" }) === true',
    "median([1,2,3]) >= 2",
    "Math.abs(mean([1,2])) > 0",
    "plan().length === 3",
    "result.ok === true",
    'VERSION === "1.0.0"',
    "E.A === 0",
    "x !== 'bad'",
    "missing === 2 && mean([1,2,3]) === 2",
    "const nums = [1,2,3]; mean(nums) === 2",
  ];
  const shapeOnly = [
    "typeof add === 'function'",
    "typeof plan() === 'object'",
    "boardAdd(1) !== null",
    "boardAdd(1) !== undefined",
    "boardAdd(1) === void 0",
    "1 === 1",
    "true",
    "f(1)",
    "x === null",
  ];
  for (const e of behavioural) {
    it(`behavioural: ${e}`, () => assert.equal(behaviouralOracleExpression(e), true, e));
  }
  for (const e of shapeOnly) {
    it(`shape-only: ${e}`, () => assert.equal(behaviouralOracleExpression(e), false, e));
  }
  // 346 oracle-lane numeric-literal parity (tree lane `hasModuleRead` /
  // `isConcreteOperand`). Before the fix a numeric literal's suffix read as a
  // module identifier (`1n` → `n`, `1e3` → `e3`, `0x1` → `x1`, `1_000` →
  // `_000`), so a literal-only tautology was "behavioural" while the genuine
  // `m.n === 1e3` was not.
  it("numeric-literal-only forms are shape-only, never behavioural", () => {
    for (const e of ["1n === 2", "1e3 === 2", "0x1 === 2", "1_000 === 2", "0b101 === 2", "0o7 === 1"]) {
      assert.equal(behaviouralOracleExpression(e), false, e);
    }
  });
  it("a module read tied to a numeric literal (bigint/exponent/hex/underscore) is behavioural", () => {
    for (const e of ["m.n === 1n", "m.width === 1e3", "count === 1_000", "m.mask === 0xff"]) {
      assert.equal(behaviouralOracleExpression(e), true, e);
    }
  });
  it("hostile input is shape-only, never a crash", () => {
    for (const junk of [null, undefined, 42, "", "   ", {}]) {
      assert.equal(behaviouralOracleExpression(junk), false, JSON.stringify(junk));
    }
  });
  it("shapeOnlyOracleCaseIds lists only the non-behavioural ids, in order; oracleHasBehaviouralCase agrees", () => {
    assert.deepEqual(
      shapeOnlyOracleCaseIds([
        { id: "a", expression: "typeof f === 'function'" },
        { id: "b", expression: "f(2) === 4" },
        { id: "c", expression: "f(1) !== null" },
      ]),
      ["a", "c"],
    );
    assert.equal(
      oracleHasBehaviouralCase([
        { id: "a", expression: "typeof f === 'function'" },
        { id: "b", expression: "f(2) === 4" },
      ]),
      true,
    );
    assert.equal(oracleHasBehaviouralCase([{ id: "a", expression: "typeof f === 'function'" }]), false);
  });
});

// ---------------------------------------------------------------------------
// 346 cross-lane — the tree-lane assertion floor in emitted specs
//
// The tree lane floors assertions in emitted spec files
// (`compile-check.server.ts` `specSourceHasBehaviouralAssert`) and the oracle
// lane floors machine-run case expressions (`verify.server.ts`
// `behaviouralOracleExpression`). They must agree on the documented rule: a form
// is behavioural iff a module read is tied to a concrete expected value (a
// string/number/boolean/object/array literal) or carries a relational predicate
// over a module read; literal-only tautologies, typeof, Array.isArray, presence
// probes (null/undefined/void 0, `.length > 0`) and no-module-read forms are NOT.
//
// The assert form ↔ expression form mapping is explicit:
//   equality family  assert.equal(a, b) / assert.deepEqual(a, b)  ↔  a === b
//   ok / notOk       assert.ok(<expr>)                            ↔  <expr>
// (deepEqual over an object/array literal maps to a strict comparison of the
// same operands — the shapes differ, the classification does not.)
// Call-outcome forms (`throws`/`rejects`/`match`) have NO boolean-expression
// counterpart in the oracle grammar (a throw is not a value); that boundary is
// recorded by the last test rather than silently dropped.
// ---------------------------------------------------------------------------
describe("346 cross-lane — tree-lane/oracle-lane behavioural parity over one corpus", () => {
  const wrap = (assertion: string): string => `test("x", () => { ${assertion} });`;

  type ParityRow = {
    id: string;
    category: string;
    assertion: string;
    /** Oracle equivalent; null = the oracle grammar has no counterpart (recorded). */
    expression: string | null;
    expected: boolean;
  };

  const corpus: ParityRow[] = [
    // concrete-value comparisons (string/number/boolean/object/array/base/exp/sep)
    { id: "A1", category: "concrete · string", assertion: `assert.strictEqual(m.name, "ok")`, expression: `m.name === "ok"`, expected: true },
    { id: "A2", category: "concrete · number", assertion: `assert.equal(add(1,1), 2)`, expression: `add(1,1) === 2`, expected: true },
    { id: "A3", category: "concrete · boolean", assertion: `assert.strictEqual(flag, true)`, expression: `flag === true`, expected: true },
    { id: "A4", category: "concrete · object", assertion: `assert.deepEqual(m.plan, {ok:true})`, expression: `m.plan === {ok: true}`, expected: true },
    { id: "A5", category: "concrete · array", assertion: `assert.deepEqual(JOBS, ["a"])`, expression: `JOBS === ["a"]`, expected: true },
    { id: "A6", category: "concrete · hex", assertion: `assert.strictEqual(m.mask, 0xff)`, expression: `m.mask === 0xff`, expected: true },
    { id: "A7", category: "concrete · bigint", assertion: `assert.strictEqual(m.n, 1n)`, expression: `m.n === 1n`, expected: true },
    { id: "A8", category: "concrete · exponent", assertion: `assert.strictEqual(m.width, 1e3)`, expression: `m.width === 1e3`, expected: true },
    { id: "A9", category: "concrete · underscore", assertion: `assert.strictEqual(count, 1_000)`, expression: `count === 1_000`, expected: true },
    // presence probes
    { id: "B1", category: "presence · null", assertion: `assert.equal(x, null)`, expression: `x === null`, expected: false },
    { id: "B2", category: "presence · undefined", assertion: `assert.equal(x, undefined)`, expression: `x === undefined`, expected: false },
    { id: "B3", category: "presence · void 0", assertion: `assert.ok(boardAdd(1) === void 0)`, expression: `boardAdd(1) === void 0`, expected: false },
    { id: "B4", category: "presence · !== undefined", assertion: `assert.ok(x !== undefined)`, expression: `x !== undefined`, expected: false },
    // typeof / Array.isArray
    { id: "C1", category: "typeof · equal", assertion: `assert.equal(typeof x, "function")`, expression: `typeof x === "function"`, expected: false },
    { id: "C2", category: "typeof · ok", assertion: `assert.ok(typeof x === "function")`, expression: `typeof x === "function"`, expected: false },
    { id: "D1", category: "Array.isArray · ok", assertion: `assert.ok(Array.isArray(x))`, expression: `Array.isArray(x)`, expected: false },
    { id: "D2", category: "Array.isArray · equal", assertion: `assert.strictEqual(Array.isArray(x), true)`, expression: `Array.isArray(x) === true`, expected: false },
    // .length operands / relational length
    { id: "E1", category: "length · operand", assertion: `assert.equal(m.plan.length, 3)`, expression: `m.plan.length === 3`, expected: true },
    { id: "E2", category: "length · ok equality", assertion: `assert.ok(m.plan.length === 3)`, expression: `m.plan.length === 3`, expected: true },
    { id: "E3", category: "length · emptiness probe", assertion: `assert.ok(names.length > 0)`, expression: `names.length > 0`, expected: false },
    { id: "E4", category: "length · relational", assertion: `assert.ok(names.length > 3)`, expression: `names.length > 3`, expected: true },
    { id: "E5", category: "length · keys emptiness", assertion: `assert.ok(Object.keys(ns).length > 0)`, expression: `Object.keys(ns).length > 0`, expected: false },
    // literal-only tautologies
    { id: "F1", category: "tautology · numbers", assertion: `assert.equal(1, 1)`, expression: `1 === 1`, expected: false },
    { id: "F2", category: "tautology · booleans", assertion: `assert.equal(true, true)`, expression: `true === true`, expected: false },
    { id: "F3", category: "tautology · objects", assertion: `assert.deepEqual({a:1}, {a:1})`, expression: `{a:1} === {a:1}`, expected: false },
    { id: "F4", category: "tautology · ok", assertion: `assert.ok(1 === 1)`, expression: `1 === 1`, expected: false },
    // two reads, no concrete expected value
    { id: "F5", category: "two-reads · equal", assertion: `assert.equal(a, b)`, expression: `a === b`, expected: false },
    { id: "F6", category: "two-reads · strict", assertion: `assert.strictEqual(a, b)`, expression: `a === b`, expected: false },
    { id: "F7", category: "two-reads · notStrict", assertion: `assert.notStrictEqual(a, b)`, expression: `a !== b`, expected: false },
    // relational predicate over a module value
    { id: "G1", category: "relational · module", assertion: `assert.ok(median([1,2,3]) >= 2)`, expression: `median([1,2,3]) >= 2`, expected: true },
    // declaration(s); final
    { id: "I1", category: "declaration · final", assertion: `const nums = [1,2,3]; assert.equal(mean(nums), 2)`, expression: `const nums = [1,2,3]; mean(nums) === 2`, expected: true },
    { id: "I2", category: "declaration · literal", assertion: `const a = 1; assert.equal(a, 1)`, expression: `const a = 1; a === 1`, expected: true },
    // numeric-literal suffixes are not module reads; the literals are concrete
    { id: "J1", category: "numeric · bigint tautology", assertion: `assert.equal(1n, 2)`, expression: `1n === 2`, expected: false },
    { id: "J2", category: "numeric · hex tautology", assertion: `assert.equal(0x1, 2)`, expression: `0x1 === 2`, expected: false },
    { id: "J3", category: "numeric · binary tautology", assertion: `assert.equal(0b101, 2)`, expression: `0b101 === 2`, expected: false },
    { id: "J4", category: "numeric · octal tautology", assertion: `assert.equal(0o7, 8)`, expression: `0o7 === 8`, expected: false },
    { id: "J5", category: "numeric · exponent tautology", assertion: `assert.equal(1e3, 2)`, expression: `1e3 === 2`, expected: false },
    { id: "J6", category: "numeric · separator tautology", assertion: `assert.equal(1_000, 2)`, expression: `1_000 === 2`, expected: false },
    { id: "J7", category: "numeric · bigint ok", assertion: `assert.ok(1n === 2)`, expression: `1n === 2`, expected: false },
    { id: "J8", category: "numeric · negative bigint", assertion: `assert.strictEqual(-1n, 2)`, expression: `-1n === 2`, expected: false },
  ];

  for (const row of corpus) {
    it(`${row.id} ${row.category}`, () => {
      assert.equal(
        specSourceHasBehaviouralAssert(wrap(row.assertion)),
        row.expected,
        `tree lane: ${row.assertion}`,
      );
      if (row.expression !== null) {
        assert.equal(
          behaviouralOracleExpression(row.expression),
          row.expected,
          `oracle lane: ${row.expression}`,
        );
      }
    });
  }

  it("records the call-outcome boundary rather than skipping it", () => {
    // The tree lane's call-outcome clauses are behavioural by rule (the assertion
    // observes a throw/rejection/match, not a value).
    for (const assertion of [
      `assert.throws(() => f(), /boom/)`,
      `assert.rejects(p(), /nope/)`,
      `assert.match(m.render(), /^ok/)`,
    ]) {
      assert.equal(specSourceHasBehaviouralAssert(wrap(assertion)), true, assertion);
    }
    // The oracle grammar has no call-outcome atom: a case is a boolean EXPRESSION
    // over the exports, and "this call throws" is not a value — the closest form
    // (the bare call) constrains nothing and stays shape-only. Recorded, not hidden.
    for (const expression of [`f()`, `p()`, `m.render()`]) {
      assert.equal(behaviouralOracleExpression(expression), false, expression);
    }
  });
});

// ---------------------------------------------------------------------------
// 346 E1 · L2-X4: a verdict-channel delivery/read failure produced an empty
// authenticated channel, which fell through to `callables === ""` and was
// mislabeled NO_CALLABLE_EXPORTS_REASON ("module exports no callable names").
// The real cause — no fd-3/nonce evidence at all — must be classified honestly
// with its own coded reason (AGENTS.md contract #4).
// ---------------------------------------------------------------------------
describe("346 E1 L2-X4 — a verdict-channel failure is not a module defect", () => {
  it("only an entirely empty authenticated channel is a channel failure", () => {
    assert.equal(verdictChannelFailed(false, false), true, "no HARNESS_EXPORTS and no HARNESS_COMPILE");
    assert.equal(verdictChannelFailed(true, false), false, "exports marker arrived");
    assert.equal(verdictChannelFailed(false, true), false, "compile-fail marker arrived");
    assert.equal(verdictChannelFailed(true, true), false);
  });

  it("the reason is distinct from the no-callable-exports reason and carries a code", () => {
    assert.match(VERDICT_CHANNEL_FAILED_REASON, /verdict channel/i);
    assert.match(VERDICT_CHANNEL_FAILED_REASON, /RT_E_RUNNER_FAILED/, "the refusal is coded");
    assert.notEqual(VERDICT_CHANNEL_FAILED_REASON, NO_CALLABLE_EXPORTS_REASON);
  });
});

// ---------------------------------------------------------------------------
// PR-20 (D2 / I6) — the monotone fix gate + the frozen spec-first oracle
// contract. A fix is accepted ONLY when it strictly SHRINKS the failing set —
// a sideways set (an equal-size member swap) is rejected even when its members
// are new, so a broken fix that merely trades one failure for another can never
// read as the empty failing set a real pass produces. Otherwise the prior best
// source is kept, the loop stops early, and the outcome says `regressed: true`.
// The frozen contract makes the SAME model unable to author both the module and
// its cases: the pinned oracle ids + spec requirements are fixed before
// synthesis and are stable across cycles.
// ---------------------------------------------------------------------------
describe("PR-20 (D2/I6) — monotone fix acceptance + frozen oracle cases", () => {
  it("failingCaseIds is sorted/deduped and marks a compile failure with a sentinel", () => {
    assert.deepEqual(
      failingCaseIds({
        results: [
          { id: "b", pass: false, detail: "" },
          { id: "a", pass: false, detail: "" },
          { id: "a", pass: false, detail: "" },
        ],
      }),
      ["a", "b"],
    );
    assert.deepEqual(failingCaseIds({ results: [], compileError: "boom" }), [COMPILE_FAILURE_CASE_ID]);
    assert.deepEqual(failingCaseIds({ results: [{ id: "a", pass: true, detail: "" }] }), []);
  });

  it("isMonotoneFix accepts ONLY a strict subset — a sideways/worse set is rejected", () => {
    assert.equal(isMonotoneFix(["a"], ["a", "b"]), true, "strict subset (one prior failure resolved)");
    assert.equal(isMonotoneFix([], ["a"]), true, "a pass is the empty strict subset");
    assert.equal(isMonotoneFix(["b", "c"], ["a", "b", "c"]), true, "strict subset by size, members kept");
    assert.equal(isMonotoneFix(["c"], ["a"]), false, "equal-size lateral swap is NOT progress");
    assert.equal(isMonotoneFix(["a", "b"], ["a"]), false, "superset is never an improvement");
    assert.equal(isMonotoneFix(["a"], ["a"]), false, "an identical set is no progress");
  });

  it("V-3: a broken fix that only compiles a new failure is rejected (never reads as progress)", () => {
    // A healthy run was failing {case-a}; the "fix" breaks compilation, whose
    // failing set is the compile sentinel — a sideways equal-size swap. Under a
    // lateral-move allowance this read as an improvement; it must be rejected so
    // only a genuine pass (the empty set) is ever accepted.
    assert.equal(
      isMonotoneFix([COMPILE_FAILURE_CASE_ID], ["case-a"]),
      false,
      "the compile-failure sentinel is not a strict subset of the prior failing set",
    );
    assert.equal(
      isMonotoneFix(["case-b"], ["case-a"]),
      false,
      "a moved failure is not a reduced failing set",
    );
  });

  it("frozenOracleCases is deterministic, pins every oracle id, and is spec-grounded", () => {
    const project = seedProject({
      oracle: ORACLE,
      implementationSpec: {
        requirements: ["Do X", "Do Y"],
        edgeCases: [],
        errorHandling: [],
        typeSignatures: ["function dispatch(x: X): boolean"],
        dataFlow: [],
        negativeConstraints: [],
        source: "p6",
        briefHash: "h",
        createdAt: 0,
      },
    });
    const a = frozenOracleCases(project);
    const b = frozenOracleCases(project);
    assert.equal(a, b, "identical project ⇒ identical frozen contract");
    for (const o of ORACLE) assert.ok(a.includes(o.id), `pinned id ${o.id} is rendered`);
    assert.match(a, /req-1: Do X/, "spec requirements are frozen with stable ids");
    assert.match(a, /function dispatch/, "required signatures are frozen");
    assert.equal(
      frozenOracleCases(seedProject({ oracle: [], implementationSpec: null })),
      "",
      "an empty contract renders '' (nothing to freeze)",
    );
  });

  it("rejects a fix that does not reduce the failing set; keeps best-so-far and reports regressed", { skip: !available }, async () => {
    const restoreKey = withFakeKey();
    const BAD = "exports.add = (a, b) => a - b;"; // fails case-1 only
    const WORSE = "exports.add = (a, b) => a + b + 1;"; // fails BOTH cases
    const gen = {
      cases: [
        { id: "case-1", expression: "add(2,3) === 5" },
        { id: "case-2", expression: "add(0,0) === 0" },
      ],
    };
    const mock = mockChat([gen, WORSE]);
    try {
      const outcome = await verifyAndFixServer(BAD, "add module", { maxIterations: 2 });
      assert.equal(outcome.status, "failed", `a worsening fix must not pass: ${JSON.stringify(outcome)}`);
      assert.match(outcome.evidence, /regressed: true/, "the regression is reported honestly");
      assert.match(outcome.evidence, /after 2 iterations/, "the loop stopped early but names its iteration");
      assert.equal(outcome.finalSource, BAD, "the worse fix is never written to finalSource");
      assert.equal(mock.calls.length, 2, "generation + exactly one fix dispatch (no further spend)");
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  it("accepts a fix that strictly reduces the failing set (progress is never blocked)", { skip: !available }, async () => {
    const restoreKey = withFakeKey();
    const BAD = "exports.add = (a, b) => a - b;"; // fails case-1 only
    const GOOD = "exports.add = (a, b) => a + b;"; // passes both
    const gen = {
      cases: [
        { id: "case-1", expression: "add(2,3) === 5" },
        { id: "case-2", expression: "add(0,0) === 0" },
      ],
    };
    const mock = mockChat([gen, GOOD]);
    try {
      const outcome = await verifyAndFixServer(BAD, "add module", { maxIterations: 2 });
      assert.equal(outcome.status, "passed", `a strict improvement must be accepted: ${JSON.stringify(outcome)}`);
      assert.equal(outcome.iterations, 2, "the fix was accepted on the second iteration");
      assert.equal(outcome.finalSource, GOOD, "the improved source is the final one");
    } finally {
      mock.restore();
      restoreKey();
    }
  });
});

// ---------------------------------------------------------------------------
// 346 V5 — the ARMED chunk resample must not lower the mint floor.
//
// The resample selects a winner with DETERMINISTIC gates (structure →
// brief-fit → pre-seal tsc), none of which observe BEHAVIOUR. So a
// structure-green winner is only "buildable", not "verified": it must still
// clear the machine oracle, and the tree-run mint must still require an
// executed behavioural assertion. These pins compose the resample SELECTOR
// with both mint seams so a green-but-vacuous winner is provably unable to
// stamp `lastTest.label:"tested"`.
// ---------------------------------------------------------------------------
describe("346 V5 — a resampled candidate cannot mint tested without the floor", () => {
  it("a selector-green but vacuous winner still fails machine verification (no tested)", { skip: !available }, async () => {
    // Candidate 1 is structure-refused; candidate 2 passes the deterministic
    // selector — exactly the "resample selected a winner" state.
    const selection = await selectBestOfN<string>(
      2,
      async (index) => (index === 0 ? "candidate-1" : "exports.boardAdd = function () { return NaN; };"),
      async (module) =>
        module === "candidate-1"
          ? { passed: false, reason: "structure refused" }
          : { passed: true, reason: "structure + brief-fit + pre-seal typecheck" },
    );
    assert.equal(selection.winner, 1, "the deterministic selector kept candidate 2 (structure-green)");
    assert.equal(selection.chosen, "exports.boardAdd = function () { return NaN; };");

    const restoreKey = withFakeKey();
    // A shape-only oracle is the vacuous certificate the floor exists to refuse.
    const shapeOnly = { cases: [{ id: "c1", expression: "boardAdd(1) !== null" }] };
    const mock = mockChat([shapeOnly, shapeOnly]);
    try {
      const outcome = await verifyAndFixServer(selection.chosen!, "build a board", { maxIterations: 1 });
      assert.equal(outcome.status, "error", `selector-green is not machine-verified: ${JSON.stringify(outcome)}`);
      const applied = applyVerifyOutcome(seedProject(), outcome);
      assert.notEqual(
        (applied.lastTest as { label?: string } | null)?.label ?? null,
        "tested",
        "a green-but-vacuous winner mints no tested label",
      );
    } finally {
      mock.restore();
      restoreKey();
    }
  });

  const treeOutcome = (over: Partial<TreeRunOutcome> = {}): TreeRunOutcome =>
    ({
      ok: true,
      dir: "C:/scratch/rt-v5",
      compile: { ok: true, dir: "C:/scratch/rt-v5", checked: 2, passed: 2, failed: 0, skipped: 0, verdicts: [] },
      tests: [
        {
          file: "tests/oracle.spec.ts",
          compile: "pass",
          tests: { pass: 3, fail: 0 },
          run: "pass",
        },
      ],
      run: null,
      ...over,
    }) as unknown as TreeRunOutcome;

  it("a resample-winner tree whose only green spec is shape-only/skip-dominated mints no tested", () => {
    const vacuous = treeOutcome({
      tests: [
        {
          file: "tests/oracle.spec.ts",
          compile: "pass",
          // 1 live case against 9 skips: the winner "ran green" but proved nothing.
          tests: { pass: 1, fail: 0, skipped: 9 },
          run: "pass",
          behavioural: false,
        },
      ],
    });
    assert.equal(
      treeRunTestedEvidence(vacuous).executed,
      false,
      "a shape-only/skip-dominated spec is not executed behavioural evidence",
    );
    const minted = mintTreeRunTested(seedProject(), vacuous);
    assert.notEqual(
      (minted.lastTest as { label?: string } | null)?.label ?? null,
      "tested",
      "no tested stamp for a vacuously green resample winner",
    );
    assert.ok(
      (minted.logs ?? []).some((l) => l.event === "p6.tree.tested.skipped"),
      "the refusal to mint is recorded visibly, never silent",
    );
  });

  it("control: a resample winner with a genuinely behavioural spec still mints tested", () => {
    const good = treeOutcome({
      tests: [
        {
          file: "tests/oracle.spec.ts",
          compile: "pass",
          tests: { pass: 3, fail: 0 },
          run: "pass",
          behavioural: true,
        },
      ],
    });
    assert.equal(treeRunTestedEvidence(good).executed, true);
    const minted = mintTreeRunTested(seedProject(), good);
    assert.equal(
      (minted.lastTest as { label?: string } | null)?.label,
      "tested",
      "a real behavioural tree-run still mints the machine verdict",
    );
  });

  it("a budgeted verify records exactly one ledger call per model call (no drop, no double-count)", async () => {
    const restoreKey = withFakeKey();
    // A shape-only reply forces one extra bounded repair call: two candidates
    // of the same generation seam.
    const shapeOnly = { cases: [{ id: "c1", expression: "typeof add === 'function'" }] };
    const behavioural = { cases: [{ id: "c1", expression: "add(2,3) === 5" }] };
    const mock = mockChat([shapeOnly, behavioural]);
    const budget = createTokenBudget(null, emptyLedger());
    try {
      const res = await generateCases("exports.add = (a, b) => a + b;", "", [], "", [], budget);
      assert.equal(res.ok, true, JSON.stringify(res));
      assert.equal(mock.calls.length, 2, "generation + one bounded repair candidate");
      assert.equal(budget.ledger.calls, 2, "each candidate call is metered exactly once");
      assert.equal(budget.ledger.promptTokens, 20, "both candidates' measured prompt tokens are recorded");
    } finally {
      mock.restore();
      restoreKey();
    }
  });
});
