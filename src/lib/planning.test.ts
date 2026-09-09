// ---------------------------------------------------------------------------
// planning.test.ts — plan-then-act scaffold suite (deterministic, no network).
//
// Run: node --experimental-strip-types --test src/lib/planning.test.ts
// ---------------------------------------------------------------------------
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPlanning, backtrack, planSteps } from "./planning.ts";
import type { Plan, PlanStep } from "./planning.ts";
import type { LlmResult } from "./llm.ts";

const KEY = "DEEPSEEK_API_KEY";
let savedKey: string | undefined;

function okText(text: string): LlmResult {
  return { ok: true, text, model: "deepseek-v4-flash" };
}

function notConfigured(): LlmResult {
  return { ok: false, reason: "not-configured" };
}

const GOAL = "Seal the P6 codegen edge for the dispatch board.";
const CONTEXT = "Phase P6 — codegen against the spec-graph order and the A7 oracle.";

/** Stub completer driven by a script of replies; records every call. */
function scripted(replies: Array<LlmResult | ((prompt: string) => LlmResult)>) {
  const calls: string[] = [];
  const completer = async (
    prompt: string,
    _opts?: { system?: string },
  ): Promise<LlmResult> => {
    calls.push(prompt);
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    return typeof reply === "function" ? reply(prompt) : reply;
  };
  return { completer, calls };
}

const VALID_PLAN_JSON = JSON.stringify({
  steps: [
    { id: "s1", action: "gather contracts", why: "grounding" },
    { id: "s2", action: "emit schema", why: "lock design" },
    { id: "", action: "junk row without id", why: "" },
    { id: "s1", action: "duplicate id", why: "should be renamed" },
    { action: 42, why: "not a string action" },
  ],
});

beforeEach(() => {
  savedKey = process.env[KEY];
  delete process.env[KEY];
});

afterEach(() => {
  if (savedKey === undefined) delete process.env[KEY];
  else process.env[KEY] = savedKey;
});

describe("planSteps (createPlanning factory)", () => {
  it("normalizes a valid JSON step plan into canonical rows", async () => {
    const { completer, calls } = scripted([okText(`\`\`\`json\n${VALID_PLAN_JSON}\n\`\`\``)]);
    const api = createPlanning(completer);
    const res = await api.planSteps(GOAL, CONTEXT);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(calls.length, 1);
    assert.equal(res.plan.goal, GOAL);
    // Deterministic shape: junk + duplicate-id rows normalized, ids unique.
    assert.deepEqual(res.steps, [
      { id: "s1", action: "gather contracts", why: "grounding" },
      { id: "s2", action: "emit schema", why: "lock design" },
      { id: "step-3", action: "junk row without id", why: "" },
      { id: "step-4", action: "duplicate id", why: "should be renamed" },
    ] as PlanStep[]);
    assert.deepEqual(res.plan.steps, res.steps);
  });

  it("caps the plan at the requested step count", async () => {
    const { completer } = scripted([okText(VALID_PLAN_JSON)]);
    const api = createPlanning(completer);
    const res = await api.planSteps(GOAL, CONTEXT, { maxSteps: 2 });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.steps.length, 2);
    assert.equal(res.steps[0].id, "s1");
  });

  it("re-prompts exactly once on garbage, then reports an honest error", async () => {
    const { completer, calls } = scripted([okText("I will carefully build your app."), okText("sure thing")]);
    const api = createPlanning(completer);
    const res = await api.planSteps(GOAL, CONTEXT);
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.reason, "error");
    assert.match(res.error ?? "", /unparseable/i);
    assert.equal(calls.length, 2);
    assert.match(calls[1], /did not parse/);
  });

  it("recovers a valid plan on the second-chance re-prompt", async () => {
    const { completer, calls } = scripted([okText("prose, not json"), okText(VALID_PLAN_JSON)]);
    const api = createPlanning(completer);
    const res = await api.planSteps(GOAL, CONTEXT);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.steps.length, 4);
    assert.equal(calls.length, 2);
  });

  it("short-circuits on not-configured without a re-prompt or fabrication", async () => {
    const { completer, calls } = scripted([notConfigured()]);
    const api = createPlanning(completer);
    const res = await api.planSteps(GOAL, CONTEXT);
    assert.deepEqual(res, { ok: false, reason: "not-configured" });
    assert.equal(calls.length, 1);
  });

  it("validates inputs before calling the completer", async () => {
    const { completer, calls } = scripted([]);
    const api = createPlanning(completer);
    const res = await api.planSteps("   ", CONTEXT);
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error ?? "", /goal/i);
    assert.equal(calls.length, 0);
  });
});

describe("reflect (createPlanning factory)", () => {
  const STEPS: PlanStep[] = [
    { id: "s1", action: "gather contracts", why: "grounding" },
    { id: "s2", action: "emit schema", why: "lock design" },
  ];
  const OUTCOME = "[coder|code] Executed s1: contracts gathered.\n[tester|test] Executed s2: schema emitted.";

  it("parses a keep critique", async () => {
    const { completer, calls } = scripted([
      okText(JSON.stringify({ verdict: "keep", summary: "Plan held.", issues: [] })),
    ]);
    const api = createPlanning(completer);
    const res = await api.reflect(GOAL, STEPS, OUTCOME);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(calls.length, 1);
    assert.deepEqual(res.critique, { verdict: "keep", summary: "Plan held.", issues: [] });
  });

  it("parses a revise critique and normalizes revisedSteps", async () => {
    const { completer } = scripted([
      okText(
        JSON.stringify({
          verdict: "revise",
          summary: "Schema drifted from the contracts.",
          issues: ["Step 2 invented an endpoint."],
          revisedSteps: [
            { id: "r1", action: "re-read contracts", why: "drift" },
            { id: "", action: "", why: "" },
          ],
        }),
      ),
    ]);
    const api = createPlanning(completer);
    const res = await api.reflect(GOAL, STEPS, OUTCOME);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.critique.verdict, "revise");
    assert.deepEqual(res.critique.revised, [{ id: "r1", action: "re-read contracts", why: "drift" }]);
    assert.deepEqual(res.critique.issues, ["Step 2 invented an endpoint."]);
  });

  it("re-prompts once on an invalid verdict, then reports an honest error", async () => {
    const { completer, calls } = scripted([
      okText(JSON.stringify({ verdict: "maybe", summary: "unsure" })),
      okText(JSON.stringify({ verdict: "continue", summary: "still unsure" })),
    ]);
    const api = createPlanning(completer);
    const res = await api.reflect(GOAL, STEPS, OUTCOME);
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error ?? "", /unparseable/i);
    assert.equal(calls.length, 2);
  });

  it("short-circuits on not-configured", async () => {
    const { completer, calls } = scripted([notConfigured()]);
    const api = createPlanning(completer);
    const res = await api.reflect(GOAL, STEPS, OUTCOME);
    assert.deepEqual(res, { ok: false, reason: "not-configured" });
    assert.equal(calls.length, 1);
  });

  it("validates inputs before calling the completer", async () => {
    const { completer, calls } = scripted([]);
    const api = createPlanning(completer);
    const res = await api.reflect(GOAL, [], OUTCOME);
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error ?? "", /step/i);
    assert.equal(calls.length, 0);
  });
});

describe("backtrack (pure, deterministic)", () => {
  const plan: Plan = {
    goal: GOAL,
    steps: [
      { id: "s1", action: "gather contracts", why: "grounding" },
      { id: "s2", action: "emit schema", why: "lock design" },
      { id: "s3", action: "wire routes", why: "contracts" },
    ],
  };

  it("rewinds to the last known-good prefix, reporting the failed step and tail", () => {
    const bt = backtrack(plan, "s2");
    assert.deepEqual(bt.plan, { goal: GOAL, steps: [{ id: "s1", action: "gather contracts", why: "grounding" }] });
    assert.deepEqual(bt.failedStep, { id: "s2", action: "emit schema", why: "lock design" });
    assert.deepEqual(bt.rewound, [
      { id: "s2", action: "emit schema", why: "lock design" },
      { id: "s3", action: "wire routes", why: "contracts" },
    ]);
  });

  it("is a no-op for an unknown step id", () => {
    const bt = backtrack(plan, "s99");
    assert.equal(bt.failedStep, null);
    assert.deepEqual(bt.rewound, []);
    assert.deepEqual(bt.plan, plan);
  });

  it("is pure — the input plan is never mutated and output is deterministic", () => {
    const before = JSON.stringify(plan);
    const a = backtrack(plan, "s1");
    const b = backtrack(plan, "s1");
    assert.equal(JSON.stringify(plan), before);
    assert.deepEqual(a, b);
    assert.deepEqual(a.plan.steps, []);
    assert.deepEqual(a.rewound, plan.steps);
    assert.equal(a.plan.goal, GOAL);
  });

  it("never aliases the input plan or its steps (caller mutation cannot leak)", () => {
    const before = JSON.stringify(plan);
    // Found path: mutate every returned row + the plan + failedStep + rewound.
    const hit = backtrack(plan, "s2");
    hit.plan.steps[0].action = "MUTATED";
    hit.failedStep!.action = "MUTATED";
    hit.rewound[0].action = "MUTATED";
    hit.plan.steps.push({ id: "x", action: "extra", why: "" });
    assert.equal(JSON.stringify(plan), before);

    // Unknown-id path: the returned plan is a copy, not the input reference.
    const miss = backtrack(plan, "s99");
    miss.plan.steps[0].action = "MUTATED";
    miss.plan.steps.push({ id: "x", action: "extra", why: "" });
    assert.equal(JSON.stringify(plan), before);
  });
});

describe("default bindings (real DeepSeek backend)", () => {
  it("planSteps is honestly not-configured without a key — zero network, zero fabrication", async () => {
    const res = await planSteps(GOAL, CONTEXT);
    assert.deepEqual(res, { ok: false, reason: "not-configured" });
  });
});
