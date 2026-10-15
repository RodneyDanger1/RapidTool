import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assessNarrativeGrounding,
  createLlmTasks,
  NARRATIVE_OFF_TOPIC_SCORE,
  parseConstraintList,
  type NarrativeSource,
} from "./llm-tasks.ts";
import { RESEARCH_RELEVANCE_FLOOR } from "./research.ts";
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

  it("phaseNarrative returns a paragraph and reports an insufficient (no-source) call", async () => {
    const { phaseNarrative } = createLlmTasks(async () => ok("A feasibility paragraph."));
    assert.deepEqual(await phaseNarrative(SNAPSHOT, PHASE), {
      ok: true,
      text: "A feasibility paragraph.",
      grounded: false,
      sourceCount: 0,
      offTopic: false,
      insufficient: true,
    });
  });

  it("phaseNarrative threads the query + sources into the prompt and marks it grounded", async () => {
    const seen: string[] = [];
    const { phaseNarrative } = createLlmTasks(async (prompt) => {
      seen.push(prompt);
      return ok("Grounded summary.");
    });
    const sources: NarrativeSource[] = [
      { title: "Invoice tracker guide", url: "https://tools.example/invoice", content: "track invoices" },
    ];
    const r = await phaseNarrative(
      { ...SNAPSHOT, query: "invoice tracker", sources },
      PHASE,
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.grounded, true);
      assert.equal(r.sourceCount, 1);
      assert.equal(r.offTopic, false);
      assert.equal(r.insufficient, false);
    }
    assert.match(seen[0], /Research query: invoice tracker/);
    assert.match(seen[0], /https:\/\/tools\.example\/invoice/);
    assert.match(seen[0], /summarize ONLY these/i);
  });

  it("phaseNarrative states when sources are off-topic (no strategy invention)", async () => {
    const seen: string[] = [];
    const { phaseNarrative } = createLlmTasks(async (prompt) => {
      seen.push(prompt);
      return ok("The sources do not address the query.");
    });
    const sources: NarrativeSource[] = [
      { title: "Celebration cakes", url: "https://cakes.example/x", content: "luxury celebration cake" },
    ];
    const r = await phaseNarrative({ ...SNAPSHOT, query: "invoice tracker", sources }, PHASE);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.offTopic, true);
      assert.equal(r.grounded, false);
    }
    assert.match(seen[0], /off-topic/i);
    assert.match(seen[0], /do NOT infer a strategy/i);
  });

  it("assessNarrativeGrounding scores sources, honouring a pre-computed score", () => {
    const noSources = assessNarrativeGrounding("invoice", []);
    assert.equal(noSources.insufficient, true);
    assert.equal(noSources.offTopic, false);

    const noQuery = assessNarrativeGrounding(undefined, [
      { title: "anything", url: "https://a.example", content: "" },
    ]);
    assert.equal(noQuery.insufficient, false);
    assert.equal(noQuery.offTopic, false);
    assert.equal(noQuery.onTopicCount, 1);

    const precomputed = assessNarrativeGrounding("zzz", [
      { title: "unrelated", url: "https://a.example", content: "", score: 0.9 },
    ]);
    assert.equal(precomputed.onTopicCount, 1, "a supplied score is trusted");
    assert.equal(precomputed.offTopic, false);
  });

  it("phaseNarrative returns not-configured", async () => {
    const { phaseNarrative } = createLlmTasks(async () => notConfigured());
    assert.deepEqual(await phaseNarrative(SNAPSHOT, PHASE), { ok: false, reason: "not-configured" });
  });

  // Item 1 (context flow) + item 4 (narrative/artifact split): a later phase's
  // narrative is threaded the PRIOR phases' deliverables and told to build on
  // (never contradict) them instead of reasoning from the brief alone.
  it("phaseNarrative threads the PRIOR phase artifacts into the prompt (context flow)", async () => {
    const seen: string[] = [];
    const { phaseNarrative } = createLlmTasks(async (prompt) => {
      seen.push(prompt);
      return ok("P2 builds on P1.");
    });
    const r = await phaseNarrative(
      {
        ...SNAPSHOT,
        priorArtifacts: [
          { phase: 0, title: "Feasibility & Architecture Scorecard", body: "verdict: proceed" },
          { phase: 1, title: "Execution topology (this build)", body: "orders → kitchen → delivery" },
        ],
      },
      PHASE,
    );
    assert.equal(r.ok, true);
    assert.match(seen[0], /Prior phase artifacts/);
    assert.match(seen[0], /P0 Feasibility & Architecture Scorecard: verdict: proceed/);
    assert.match(seen[0], /P1 Execution topology \(this build\): orders → kitchen → delivery/);
    assert.match(seen[0], /do NOT restate the brief, contradict them/i);
    // With priors present the no-source honesty clause points at them, not at
    // an invented strategy.
    assert.match(seen[0], /Reason ONLY from the project brief and the prior phase artifacts/i);
  });

  it("no priors ⇒ the legacy ungrounded clause (additive-only)", async () => {
    const seen: string[] = [];
    const { phaseNarrative } = createLlmTasks(async (prompt) => {
      seen.push(prompt);
      return ok("ok");
    });
    await phaseNarrative(SNAPSHOT, PHASE);
    assert.doesNotMatch(seen[0], /Prior phase artifacts/);
    assert.match(seen[0], /reason only from the project brief and phase summary/i);
  });

  it("the narrative off-topic floor IS the retrieval relevance floor (no drift)", () => {
    assert.equal(NARRATIVE_OFF_TOPIC_SCORE, RESEARCH_RELEVANCE_FLOOR);
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
