// ---------------------------------------------------------------------------
// verify.server.test.ts — E-08 (A4-b) oracle-seeding + pinned-id tests for the
// machine verify seam (fixes/159 F3).
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
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildOracleCasesPrompt,
  droppedPinnedOracleIds,
  generateCases,
  verifyAndFixServer,
} from "./verify.server.ts";
import { oracleToCaseSeeds } from "./dod.ts";
import type { OracleTest } from "./types.ts";

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
  return {
    status: 200,
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
      model: "deepseek-v4-flash",
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    }),
  } as unknown as Response;
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
