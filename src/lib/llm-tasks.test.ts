import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLlmTasks, parseConstraintList } from "./llm-tasks.ts";
import type { LlmResult } from "./llm.ts";
import { completeDeepSeek } from "./deepseek.server.ts";
import type { PhaseDef } from "./types.ts";

const KEY = "DEEPSEEK_API_KEY";

function ok(text: string): LlmResult {
  return { ok: true, text, model: "deepseek-v4-flash" };
}
const notConfigured = (): LlmResult => ({ ok: false, reason: "not-configured" });
const failed = (msg = "boom"): LlmResult => ({ ok: false, reason: "error", error: msg });

const PHASE: PhaseDef = {
  id: 0,
  code: "P0",
  title: "Deep Research & Feasibility",
  summary: "Feasibility before any code.",
  hitl: false,
};

const SNAPSHOT = {
  name: "Marketplace",
  brief: "Build a marketplace app.",
  domain: "ecommerce",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const realFetch = globalThis.fetch;

describe("parseConstraintList", () => {
  it("parses an object with a constraints array", () => {
    assert.deepEqual(parseConstraintList('{"constraints":["A","B"]}'), ["A", "B"]);
  });

  it("parses a bare array", () => {
    assert.deepEqual(parseConstraintList('["A","B"]'), ["A", "B"]);
  });

  it("drops empty and non-string entries and trims whitespace", () => {
    assert.deepEqual(parseConstraintList('{"constraints":["A", "", 3, "  B  "]}'), ["A", "B"]);
  });

  it("strips markdown fences", () => {
    assert.deepEqual(parseConstraintList('```json\n{"constraints":["A"]}\n```'), ["A"]);
  });

  it("returns null for invalid JSON", () => {
    assert.equal(parseConstraintList("not json"), null);
  });

  it("returns null when the constraints key is missing", () => {
    assert.equal(parseConstraintList('{"foo":"bar"}'), null);
  });
});

describe("createLlmTasks (injected completer)", () => {
  it("extractConstraints returns not-configured when the backend is absent", async () => {
    const { extractConstraints } = createLlmTasks(async () => notConfigured());
    assert.deepEqual(await extractConstraints("brief"), { ok: false, reason: "not-configured" });
  });

  it("extractConstraints forwards the backend error", async () => {
    const { extractConstraints } = createLlmTasks(async () => failed("rate limit"));
    const r = await extractConstraints("brief");
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "error");
      assert.equal(r.error, "rate limit");
    }
  });

  it("extractConstraints parses constraints from model JSON", async () => {
    const { extractConstraints } = createLlmTasks(async () =>
      ok('{"constraints":["Budget < $10k","Launch in 6 weeks"]}'),
    );
    assert.deepEqual(await extractConstraints("brief"), {
      ok: true,
      constraints: ["Budget < $10k", "Launch in 6 weeks"],
    });
  });

  it("extractConstraints errors on an unparseable payload", async () => {
    const { extractConstraints } = createLlmTasks(async () => ok("not json"));
    const r = await extractConstraints("brief");
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "error");
      assert.equal(r.code, "RT_E_VALIDATION");
    }
  });

  it("interpretFeedback trims guidance on success", async () => {
    const { interpretFeedback } = createLlmTasks(async () => ok("  Tighten the security story.  "));
    assert.deepEqual(await interpretFeedback("too vague", "Security"), {
      ok: true,
      guidance: "Tighten the security story.",
    });
  });

  it("interpretFeedback returns not-configured", async () => {
    const { interpretFeedback } = createLlmTasks(async () => notConfigured());
    assert.deepEqual(await interpretFeedback("n", "P0"), { ok: false, reason: "not-configured" });
  });

  it("interpretFeedback errors on empty guidance", async () => {
    const { interpretFeedback } = createLlmTasks(async () => ok("   "));
    const r = await interpretFeedback("n", "P0");
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "error");
      assert.equal(r.code, "RT_E_LLM_REJECTED");
    }
  });

  it("phaseNarrative returns a grounded paragraph", async () => {
    const { phaseNarrative } = createLlmTasks(async () => ok("A feasibility paragraph."));
    assert.deepEqual(await phaseNarrative(SNAPSHOT, PHASE), {
      ok: true,
      text: "A feasibility paragraph.",
    });
  });

  it("phaseNarrative returns not-configured", async () => {
    const { phaseNarrative } = createLlmTasks(async () => notConfigured());
    assert.deepEqual(await phaseNarrative(SNAPSHOT, PHASE), { ok: false, reason: "not-configured" });
  });
});

describe("llm-tasks end-to-end via completeDeepSeek (mocked fetch)", () => {
  beforeEach(() => {
    delete process.env[KEY];
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env[KEY];
  });

  it("propagates not-configured through the real fetch layer", async () => {
    const { extractConstraints } = createLlmTasks(completeDeepSeek);
    assert.deepEqual(await extractConstraints("brief"), {
      ok: false,
      reason: "not-configured",
      code: "RT_E_LLM_NOT_CONFIGURED",
    });
  });

  it("parses constraints from a mocked DeepSeek JSON response", async () => {
    process.env[KEY] = "sk-test";
    globalThis.fetch = (async () =>
      jsonResponse({
        model: "deepseek-v4-pro",
        choices: [
          { message: { content: '{"constraints":["Use React","Ship in 30 days"]}' } },
        ],
      })) as typeof fetch;

    const { extractConstraints } = createLlmTasks(completeDeepSeek);
    assert.deepEqual(await extractConstraints("brief"), {
      ok: true,
      constraints: ["Use React", "Ship in 30 days"],
    });
  });
});
