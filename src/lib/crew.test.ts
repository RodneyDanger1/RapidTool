import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createCrew,
  createCrewRuntime,
  rolesForPhase,
  parseAgentOutput,
  CREW_ROLE_BY_PHASE,
  buildAgentContext,
  ROLE_SPECS,
  crewRegistryCompleter,
  crewRoleForModel,
  runCrewServer,
} from "./crew.server.ts";
import type { CrewCompleter, CrewSearcher } from "./crew.server.ts";
import type { CrewRole, CrewSession } from "./crew.ts";
import type { PhaseId, Project } from "./types.ts";
import { seedProject } from "./testing/fixtures.ts";
import type { LlmResult } from "./llm.ts";
import { estimateTokens } from "./algorithms.ts";
import {
  CREW_PROTOCOL_EMITS,
  SWARM_ROLES,
  SWARM_ROLE_IDS,
  isCrewProtocolEmit,
  seatsForPhase,
  swarmPlan,
} from "./swarm.ts";

const ALL_ROLES: CrewRole[] = ["planner", "researcher", "architect", "coder", "reviewer", "tester"];

function okText(text: string): LlmResult {
  return { ok: true, text, model: "deepseek-v4-flash" };
}

const notConfigured = async (): Promise<LlmResult> => ({ ok: false, reason: "not-configured" });

// --- plan-act stubs ---------------------------------------------------------
// The planner/reflection systems are planning.ts constants; routing on their
// distinctive text keeps the stub deterministic without importing internals.
const PLAN_JSON = JSON.stringify({
  steps: [
    { id: "s1", action: "gather contracts", why: "grounding for codegen" },
    { id: "s2", action: "emit schema modules", why: "lock the contracts" },
  ],
});
const KEEP_CRITIQUE_JSON = JSON.stringify({
  verdict: "keep",
  summary: "Plan held.",
  issues: [],
});

/** Route a completer reply by system prompt: plan / reflect / role turn. */
function routedCompleter(opts?: {
  plan?: string;
  reflect?: string;
  turn?: (index: number) => string;
  calls?: string[];
}): CrewCompleter {
  const calls = opts?.calls ?? [];
  const turn = opts?.turn ?? ((i: number) => `Turn ${i}`);
  return async (prompt, cOpts) => {
    calls.push(prompt);
    const system = cOpts?.system ?? "";
    if (system.includes("planning layer of a governed multi-agent crew")) {
      return okText(opts?.plan ?? PLAN_JSON);
    }
    if (system.includes("reflection step of a plan-then-act loop")) {
      return okText(opts?.reflect ?? KEEP_CRITIQUE_JSON);
    }
    const text = turn(calls.length);
    return okText(text);
  };
}

describe("crew routing", () => {
  it("routes every phase to at least one crew role", () => {
    for (let p = 0; p <= 12; p++) {
      const roles = rolesForPhase(p as 0);
      assert.ok(Array.isArray(roles) && roles.length > 0, `P${p} should route to ≥1 role`);
      for (const r of roles) assert.ok(ALL_ROLES.includes(r), `P${p} role ${r} is a valid CrewRole`);
    }
  });

  it("has an entry for every phase in CREW_ROLE_BY_PHASE", () => {
    for (let p = 0; p <= 12; p++) {
      assert.ok(Array.isArray(CREW_ROLE_BY_PHASE[p as 0]), `phase ${p} present`);
    }
  });
});

describe("parseAgentOutput", () => {
  it("extracts a structured JSON message", () => {
    const msg = parseAgentOutput(
      "architect",
      '{"type":"design","content":"Use Postgres for persistence.","artifacts":[{"title":"Plan","body":"1. schema"}]}',
    );
    assert.equal(msg.role, "architect");
    assert.equal(msg.type, "design");
    assert.equal(msg.content, "Use Postgres for persistence.");
    assert.equal(msg.artifacts?.length, 1);
    assert.equal(msg.artifacts?.[0].title, "Plan");
  });

  it("falls back to raw prose content when the reply is not JSON", () => {
    const msg = parseAgentOutput("coder", "just some prose");
    assert.equal(msg.role, "coder");
    assert.equal(typeof msg.content, "string");
    assert.ok(msg.content.length > 0);
  });

  it("splits markdown sections into artifacts", () => {
    const msg = parseAgentOutput(
      "architect",
      "Leading note.\n## Database\nUse Postgres.\n## API\nREST endpoints.",
    );
    assert.equal(msg.content, "Leading note.");
    assert.equal(msg.artifacts?.length, 2);
    assert.equal(msg.artifacts?.[0].title, "Database");
  });

  it("rescues a JSON envelope preceded by a prose line (P2-5)", () => {
    const msg = parseAgentOutput(
      "architect",
      'ok, here is the envelope\n{"type":"design","content":"Use Postgres.","artifacts":[{"title":"E","body":"entities"}]}',
    );
    assert.equal(msg.type, "design");
    assert.equal(msg.content, "Use Postgres.");
    assert.equal(msg.artifacts?.length, 1);
    assert.equal(msg.artifacts?.[0].title, "E");
    assert.equal(msg.artifacts?.[0].body, "entities");
  });

  it("does not hijack ordinary prose with incidental braces (P2-5 negative)", () => {
    const msg = parseAgentOutput("coder", "see {Figure 2} below for the layout");
    assert.equal(msg.type, "code");
    assert.equal(msg.content, "see {Figure 2} below for the layout");
    assert.equal(msg.artifacts, undefined);
    // A brace pair that round-trips as JSON but carries no envelope keys stays prose.
    const msg2 = parseAgentOutput("coder", 'we counted {"items": 12} in the scan');
    assert.equal(msg2.content, 'we counted {"items": 12} in the scan');
    assert.equal(msg2.artifacts, undefined);
  });

  it("drops JSON-envelope artifacts with an empty body (P3-3, markdown-path parity)", () => {
    const msg = parseAgentOutput(
      "reviewer",
      '{"type":"review","content":"verdict text","artifacts":[{"title":"Empty","body":""},{"title":"Real","body":"ok body"}]}',
    );
    assert.equal(msg.artifacts?.length, 1);
    assert.equal(msg.artifacts?.[0].title, "Real");
    assert.equal(msg.artifacts?.[0].body, "ok body");
  });
});

// ---------------------------------------------------------------------------
// Plan-act mode (wave-3 orchestration — fixes/51_wave3_orchestration.md)
// ---------------------------------------------------------------------------

function seededProject() {
  return seedProject({ currentPhase: 6 });
}

const stepEnvelope = (i: number, stepId: string): string =>
  JSON.stringify({
    type: "code",
    content: `Executed step ${i} (${stepId}).`,
    artifacts: [{ title: `Step ${stepId} output`, body: `Body for ${stepId}.` }],
  });

describe("runCrew plan-act mode", () => {
  it("plans first, executes each planned step as a role turn, then reflects once", async () => {
    const calls: string[] = [];
    const crew = createCrew(
      routedCompleter({
        calls,
        turn: (n) => {
          // call 1 = plan; calls 2..n-1 = step turns; last = reflection.
          const stepNo = n - 1;
          return stepEnvelope(stepNo, stepNo === 1 ? "s1" : "s2");
        },
      }),
    );

    const res = await crew.runCrew(seededProject(), {
      mode: "plan-act",
      phase: 6,
      maxSteps: 12,
      live: false,
    });

    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.mode, "plan-act");
    // 1 plan + 2 step turns + 1 reflection = 4 LLM calls, nothing more.
    assert.equal(calls.length, 4);
    // The machine plan is returned and minted as a machine artifact.
    assert.deepEqual(res.plan, [
      { id: "s1", action: "gather contracts", why: "grounding for codegen" },
      { id: "s2", action: "emit schema modules", why: "lock the contracts" },
    ]);
    assert.ok(res.artifacts.some((a) => a.title === "Plan steps (plan-act)"));
    // Honest transcript: 2 role turns (P6 table rotation coder → tester) + the
    // reflection message — every entry is a real stub/model emission.
    assert.equal(res.messages.length, 3);
    assert.equal(res.messages[0].role, "coder");
    assert.match(res.messages[0].content, /Executed step 1 \(s1\)/);
    assert.equal(res.messages[1].role, "tester");
    assert.equal(res.messages[2].role, "reviewer");
    assert.equal(res.messages[2].type, "review");
    assert.equal(res.messages[2].content, "Plan held.");
    assert.ok(
      res.messages[2].artifacts?.some((a) => a.title === "Reflection critique (plan-act)"),
    );
    assert.deepEqual(res.critique, { verdict: "keep", summary: "Plan held.", issues: [] });
    assert.equal(res.stopped, "done");
  });

  it("feeds each planned step into its executing turn (no silent re-planning)", async () => {
    const calls: string[] = [];
    const crew = createCrew(routedCompleter({ calls, turn: () => stepEnvelope(1, "s1") }));
    const res = await crew.runCrew(seededProject(), {
      mode: "plan-act",
      phase: 6,
      live: false,
    });
    assert.equal(res.ok, true);
    // Step-turn prompts carry the step directive + the exact planned action.
    const stepPrompts = calls.filter((p) => p.includes("## Plan step to execute"));
    assert.equal(stepPrompts.length, 2);
    assert.match(stepPrompts[0], /— 1 of 2/);
    assert.match(stepPrompts[0], /action: gather contracts/);
    assert.match(stepPrompts[1], /— 2 of 2/);
    assert.match(stepPrompts[1], /action: emit schema modules/);
  });

  it("short-circuits honestly on not-configured at the first planning call", async () => {
    let calls = 0;
    const crew = createCrew(async () => {
      calls++;
      return notConfigured();
    });
    const res = await crew.runCrew(seededProject(), { mode: "plan-act", phase: 6 });
    assert.deepEqual(res, {
      ok: false,
      reason: "not-configured",
      code: "RT_E_LLM_NOT_CONFIGURED",
    });
    assert.equal(calls, 1); // no step turns, no fabricated transcript
  });

  it("fails honestly on an unparseable plan — never a silent default fallback", async () => {
    let calls = 0;
    const crew = createCrew(async () => {
      calls++;
      return okText("I will carefully build your app.");
    });
    const res = await crew.runCrew(seededProject(), { mode: "plan-act", phase: 6 });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.reason, "error");
    assert.match(res.error ?? "", /unparseable/i);
    assert.equal(calls, 2); // one re-prompt, then honest stop — zero step turns
  });

  it("keeps the run honest when the closing reflection fails (non-fatal)", async () => {
    const calls: string[] = [];
    const crew = createCrew(
      routedCompleter({
        calls,
        reflect: "I have no structured opinion about this.",
        turn: (n) => stepEnvelope(n - 1, n === 2 ? "s1" : "s2"),
      }),
    );
    const res = await crew.runCrew(seededProject(), {
      mode: "plan-act",
      phase: 6,
      live: false,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // 1 plan + 2 steps + 2 reflection attempts (re-prompt) = 5 calls.
    assert.equal(calls.length, 5);
    assert.equal(res.messages.length, 2); // reflection failure pads nothing
    assert.equal(res.critique, null);
    assert.deepEqual(res.plan?.map((s) => s.id), ["s1", "s2"]);
  });

  it("bounds executed steps by maxSteps and reports max-steps honestly", async () => {
    const calls: string[] = [];
    const crew = createCrew(routedCompleter({ calls, turn: (n) => stepEnvelope(n - 1, `s${n - 1}`) }));
    const res = await crew.runCrew(seededProject(), {
      mode: "plan-act",
      phase: 6,
      maxSteps: 1,
      live: false,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // The full machine plan (2 steps) is returned + minted, but the turn cap
    // allows only 1 execution — the run reports the honest partial stop.
    assert.equal(res.plan?.length, 2);
    assert.equal(res.messages.filter((m) => m.role !== "reviewer").length, 1);
    assert.equal(res.messages.filter((m) => m.role !== "reviewer")[0].content, "Executed step 1 (s1).");
    assert.equal(res.stopped, "max-steps");
  });
});

describe("runCrew default mode regression", () => {
  it("still produces the fixed phase→role transcript (no mode fields)", async () => {
    const crew = createCrew(routedCompleter({}));
    const res = await crew.runCrew(seededProject(), { phase: 6, live: false });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // P6 route = coder, tester, reviewer — all three turn.
    assert.deepEqual(
      res.messages.map((m) => m.role),
      ["coder", "tester", "reviewer"],
    );
    assert.equal(res.mode, undefined);
    assert.equal(res.plan, undefined);
    assert.equal(res.critique, undefined);
    assert.equal(res.stopped, "done");
  });

  it("stays honestly not-configured when the very first dispatch fails", async () => {
    const crew = createCrew(notConfigured);
    const res = await crew.runCrew(seededProject(), { phase: 6 });
    assert.deepEqual(res, {
      ok: false,
      reason: "not-configured",
      code: "RT_E_LLM_NOT_CONFIGURED",
    });
  });
});

describe("runCrew budget guards + measured prompts (fixes/83 P2-3/P2-4)", () => {
  /** Completer whose every call reports a heavy 20k-token usage. */
  const heavyCompleter = (calls: string[]): CrewCompleter => async (prompt, cOpts) => {
    calls.push(prompt);
    const system = cOpts?.system ?? "";
    const text = system.includes("planning layer") ? PLAN_JSON : "turn output";
    return {
      ok: true,
      text,
      model: "deepseek-v4-flash",
      usage: { promptTokens: 20_000, completionTokens: 0 },
    };
  };

  it("stops BEFORE dispatching a turn whose projected cost would blow the cap (P2-3, default mode)", async () => {
    const calls: string[] = [];
    const crew = createCrew(heavyCompleter(calls));
    const res = await crew.runCrew(seededProject(), {
      phase: 6,
      live: false,
      maxTotalTokens: 25_000,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // One 20k turn fits; a second turn would project ~20k + prompt + role
    // budget > 25k — the guard must stop before dispatching it (old behavior:
    // two turns dispatched, 40k spent = 60% over the cap).
    assert.equal(res.stopped, "cost-limit");
    assert.equal(calls.length, 1, "second turn never dispatched — guard fires pre-dispatch");
    assert.equal(res.messages.length, 1);
  });

  it("stops plan-act before a step whose projected cost would blow the cap (P2-3)", async () => {
    const calls: string[] = [];
    const crew = createCrew(heavyCompleter(calls));
    const res = await crew.runCrew(seededProject(), {
      mode: "plan-act",
      phase: 6,
      live: false,
      maxTotalTokens: 25_000,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.stopped, "cost-limit");
    // 1 plan call + 1 executed step (20k spend); the 2nd step is guarded
    // pre-dispatch — and the closing reflection is skipped on cost-limit.
    assert.equal(calls.length, 2);
    assert.equal(res.messages.length, 1);
    assert.equal(res.critique, null);
  });

  it("keeps the FINAL researcher prompt (grounding appended) within maxPromptTokens (P2-4)", async () => {
    const calls: string[] = [];
    const search: CrewSearcher = async () => ({
      ok: true,
      query: "q",
      provider: "stub",
      items: Array.from({ length: 5 }, (_, i) => ({
        title: `T${i}`.padEnd(160, "x"),
        url: "https://example.com/a",
        content: "c".repeat(400),
      })),
    });
    const crew = createCrew(routedCompleter({ calls, turn: (n) => `Turn ${n}` }), { search });
    const res = await crew.runCrew(seededProject(), { phase: 7, live: true, maxPromptTokens: 4000 });
    assert.equal(res.ok, true);
    const first = calls[0] ?? "";
    assert.match(first, /Research grounding \(live web/, "grounding appended to the researcher turn");
    // P7's first role is the researcher — the dispatched prompt (grounding
    // included) must fit the documented prompt budget.
    assert.ok(
      estimateTokens(first).tokensEst <= 4000,
      `researcher prompt over budget: ${estimateTokens(first).tokensEst} est tokens`,
    );
  });

  it("stamps a not-configured search seam with RT_E_RESEARCH_UNAVAILABLE (99 §6)", async () => {
    const calls: string[] = [];
    const search: CrewSearcher = async () => ({ ok: false, reason: "not-configured" });
    const crew = createCrew(routedCompleter({ calls, turn: (n) => `Turn ${n}` }), { search });
    const res = await crew.runCrew(seededProject(), { phase: 7, live: true });
    assert.equal(res.ok, true);
    const first = calls[0] ?? "";
    assert.match(first, /Research grounding \(live web/);
    assert.match(first, /RT_E_RESEARCH_UNAVAILABLE/);
  });

  it("classifies error-prose search failures with the research-domain fallback (99 §6)", async () => {
    const calls: string[] = [];
    const search: CrewSearcher = async () => ({ ok: false, reason: "error", error: "backend down" });
    const crew = createCrew(routedCompleter({ calls, turn: (n) => `Turn ${n}` }), { search });
    const res = await crew.runCrew(seededProject(), { phase: 7, live: true });
    assert.equal(res.ok, true);
    const first = calls[0] ?? "";
    assert.match(first, /RT_E_RESEARCH_UNAVAILABLE/);
  });

  it("propagates a valid upstream search code verbatim, never reclassifying it (99 §6)", async () => {
    const calls: string[] = [];
    const search: CrewSearcher = async () => ({
      ok: false,
      reason: "error",
      error: "bad query",
      code: "RT_E_VALIDATION",
    });
    const crew = createCrew(routedCompleter({ calls, turn: (n) => `Turn ${n}` }), { search });
    const res = await crew.runCrew(seededProject(), { phase: 7, live: true });
    assert.equal(res.ok, true);
    const first = calls[0] ?? "";
    assert.match(first, /RT_E_VALIDATION/);
    assert.doesNotMatch(first, /RT_E_RESEARCH_UNAVAILABLE/);
  });

  it("keeps plan-act step prompts (directive appended) within maxPromptTokens (P2-4)", async () => {
    const calls: string[] = [];
    const crew = createCrew(routedCompleter({ calls, turn: (n) => stepEnvelope(n - 1, `s${n - 1}`) }));
    const res = await crew.runCrew(seededProject(), {
      mode: "plan-act",
      phase: 6,
      live: false,
      maxPromptTokens: 4000,
    });
    assert.equal(res.ok, true);
    const stepPrompts = calls.filter((p) => p.includes("## Plan step to execute"));
    assert.ok(stepPrompts.length >= 1, "step directives dispatched");
    for (const p of stepPrompts) {
      assert.match(p, /## Plan step to execute — \d+ of \d+/, "directive retained in the final prompt");
      assert.ok(
        estimateTokens(p).tokensEst <= 4000,
        `step prompt over budget: ${estimateTokens(p).tokensEst} est tokens`,
      );
    }
  });
});

describe("crew prompt quality — actionable, test-pushing, honest (fixes/95 F5)", () => {
  const project6 = () => seedProject({ currentPhase: 6 });
  const emptySession = (): CrewSession => ({
    id: "s-f95",
    projectId: "p-f95",
    messages: [],
    artifacts: [],
    steps: 0,
    promptTokens: 0,
    completionTokens: 0,
    status: "running",
    startedAt: 1,
  });
  const ctxFor = (role: CrewRole): string =>
    buildAgentContext(project6(), role, emptySession(), { phase: 6 });

  it("coder directive demands complete runnable files + named tests, never implied-done", () => {
    const ctx = ctxFor("coder");
    assert.ok(ctx.includes("no pseudocode/stubs/ellipses"), "no pseudocode/stubs/ellipses");
    assert.ok(ctx.includes("test cases and verification command"), "tests + verification named");
    assert.ok(ctx.includes("State missing pieces explicitly — never imply done"), "honest gaps");
    assert.ok(
      ROLE_SPECS.coder.system.includes("COMPLETE, working files/modules"),
      "system prompt pushes working code",
    );
  });

  it("reviewer directive demands evidence-backed PASS/FAIL verdicts with per-defect fixes", () => {
    const ctx = ctxFor("reviewer");
    assert.ok(ctx.includes("Review verdict — PASS|FAIL"), "verdict artifact titled");
    assert.ok(ctx.includes("NOT VERIFIED"), "unverifiable claims listed, never waived");
    assert.ok(ctx.includes("the required fix"), "per-defect required fix");
    assert.ok(
      ROLE_SPECS.reviewer.system.includes("never PASS on missing evidence"),
      "system prompt bans pass-on-absence",
    );
  });

  it("tester directive demands per-artifact cases with evidence and explicit not-runnable rows", () => {
    const ctx = ctxFor("tester");
    assert.ok(ctx.includes("{name, expect, actual, ok, evidence}"), "case shape with evidence");
    assert.ok(ctx.includes("ok:false"), "failure rows are first-class");
    assert.ok(
      ROLE_SPECS.tester.system.includes("Never claim a test ran unless evidence is in context"),
      "system prompt keeps the evidence bar",
    );
  });

  it("architect/planner mandates push testable acceptance lines and evidence per plan step", () => {
    assert.ok(
      ROLE_SPECS.architect.system.includes("testable acceptance line"),
      "architect acceptance lines",
    );
    assert.ok(
      ROLE_SPECS.planner.system.includes("recorded evidence that proves it done"),
      "planner steps name exit evidence",
    );
  });

  it("JSON-role system prompts demand stable, referenceable artifact titles", () => {
    for (const role of ["architect", "reviewer", "tester"] as const) {
      assert.ok(
        ROLE_SPECS[role].system.includes("Artifact titles must be stable and specific"),
        `${role} title guidance`,
      );
    }
  });

  it("keeps every context probe within a sane budget after the directive expansion", () => {
    // Seed-project context ≈ 2.3k est tokens (packet-heavy); the 16k default
    // ceiling leaves huge headroom — this only guards against a runaway
    // directive regressing the measured prompts.
    for (const role of ["planner", "researcher", "architect", "coder", "reviewer", "tester"] as const) {
      const ctx = ctxFor(role);
      assert.ok(
        estimateTokens(ctx).tokensEst <= 4000,
        `${role} context stays bounded (${estimateTokens(ctx).tokensEst} est tokens)`,
      );
    }
  });
});

describe("crew artifact window — last write wins (fixes/95 F5 regression)", () => {
  const project6 = () => seedProject({ currentPhase: 6 });
  it("replaces a re-emitted artifact title so downstream reviewers never diff stale work", async () => {
    const calls: string[] = [];
    const PLAN6 = JSON.stringify({
      steps: [
        { id: "s1", action: "emit queue module", why: "core queue" },
        { id: "s2", action: "exercise the queue", why: "oracle cases" },
        { id: "s3", action: "verdict pass 1", why: "gate review" },
        { id: "s4", action: "fix queue edge cases", why: "duplicate inputs" },
        { id: "s5", action: "exercise the fix", why: "oracle cases" },
        { id: "s6", action: "verdict pass 2", why: "gate review" },
      ],
    });
    const crew = createCrew(
      routedCompleter({
        plan: PLAN6,
        calls,
        turn: (n) => {
          // n = 1 is the plan call; n-1 = the planned step number.
          switch (n - 1) {
            case 1:
              return JSON.stringify({
                type: "code",
                content: "Emitted queue v1.",
                artifacts: [{ title: "src/lib/queue.ts", body: "VERSION ONE BODY" }],
              });
            case 2:
            case 5:
              return JSON.stringify({
                type: "test",
                content: `Oracle pass ${n - 1}.`,
                artifacts: [{ title: `Oracle verdict ${n - 1}`, body: "all green" }],
              });
            case 3:
            case 6:
              return JSON.stringify({
                type: "review",
                content: `Review ${n - 1}.`,
                artifacts: [{ title: "Review verdict — PASS", body: "evidence checked" }],
              });
            case 4:
              return JSON.stringify({
                type: "code",
                content: "Fixed queue v2.",
                artifacts: [{ title: "src/lib/queue.ts", body: "VERSION TWO BODY" }],
              });
            default:
              return JSON.stringify({ type: "handoff", content: "unexpected" });
          }
        },
      }),
    );
    const res = await crew.runCrew(project6(), {
      mode: "plan-act",
      phase: 6,
      live: false,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // One title, one slot — the window never grows duplicates…
    const queue = res.artifacts.filter((a) => a.title === "src/lib/queue.ts");
    assert.equal(queue.length, 1, "deduped by title");
    // …and the LAST write wins: the fixed file is what the run reports.
    assert.equal(queue[0].body, "VERSION TWO BODY", "last write wins in the artifact window");
    // The final reviewer turn (step 6, after the s4 fix) receives the NEW body
    // in Prior crew artifacts — stale v1 must never reach it.
    const reviewerPrompts = calls.filter((p) => p.includes("## Your mandate (reviewer)"));
    assert.equal(reviewerPrompts.length, 2, "two reviewer turns in the rotation");
    const lastReviewer = reviewerPrompts[reviewerPrompts.length - 1];
    assert.ok(lastReviewer.includes("VERSION TWO BODY"), "reviewer diffs the latest body");
    assert.ok(!lastReviewer.includes("VERSION ONE BODY"), "stale v1 never reaches the reviewer");
  });
});

describe("swarm layer — crew protocol conformance (fixes/63_pillars_swarm.md)", () => {
  it("swarm seat specs speak the crew JSON protocol (ROLE_SPECS-compatible)", () => {
    void CREW_PROTOCOL_EMITS;
    for (const id of SWARM_ROLE_IDS) {
      const spec = SWARM_ROLES[id];
      // ROLE_SPECS-shaped core: model tier + system prompt + token budget.
      assert.ok(spec.model === "flash" || spec.model === "pro", `${id} model tier`);
      assert.ok(typeof spec.system === "string" && spec.system.length > 0, `${id} system`);
      assert.ok(spec.budgetTokens > 0, `${id} budgetTokens`);
      // emit kinds must be valid crew JSON-envelope message kinds.
      for (const e of spec.emit) assert.ok(isCrewProtocolEmit(e), `${id} emit ${e}`);
      assert.ok(spec.focus.length > 0, `${id} focus`);
      assert.ok(spec.label.length > 0, `${id} label`);
    }
  });

  it("seat focus and the phase table agree that every phase gets a debate", () => {
    for (let p = 0; p <= 12; p++) {
      const seats = seatsForPhase(p as PhaseId);
      assert.ok(seats.includes("lead-architect"), `P${p} lead opens`);
      assert.ok(seats.length >= 2, `P${p} ≥2 seats`);
    }
  });

  it("every swarm critique appends a well-formed advisory CrewArtifact", () => {
    const project = seedProject();
    const plan = swarmPlan(project);
    assert.equal(plan.ok, true);
    assert.equal(plan.advisory, true, "advisory-only result");
    assert.equal(plan.engineLinear, true, "engine untouched");
    for (const critique of plan.critiques) {
      const artifact = critique.artifact;
      assert.ok(artifact.title.trim().length > 0, "artifact title non-empty");
      assert.ok(artifact.body.trim().length > 0, "artifact body non-empty");
      assert.equal(artifact.language, "markdown");
      assert.ok(
        artifact.body.includes("advisory: true"),
        "every artifact declares itself advisory-only",
      );
    }
  });

  it("swarm output never fabricates a crew session or LLM dispatch", () => {
    const project = seedProject();
    const plan = swarmPlan(project);
    for (const critique of plan.critiques) {
      assert.equal(critique.provenance, "deterministic");
      assert.ok(
        critique.artifact.body.includes("no LLM turn was dispatched"),
        "no live-analysis claim without a backend",
      );
    }
  });
});

describe("DoD gate + rejection evidence in crew context (fixes/104 H1)", () => {
  const session = (): CrewSession => ({
    id: "s-h1",
    projectId: "p-h1",
    messages: [],
    artifacts: [],
    steps: 0,
    promptTokens: 0,
    completionTokens: 0,
    status: "running",
    startedAt: 1,
  });
  const project6 = () => seedProject({ currentPhase: 6 });
  const patchRec = (p: Project, rec: Partial<NonNullable<Project["phases"][number]>>): Project => ({
    ...p,
    phases: p.phases.map((r) => (r.id === 6 ? { ...r, ...rec } : r)),
  });
  const GATE_PASS = {
    passed: true,
    unmet: [],
    evidenceHash: "abc12345def",
    checkedAt: 1,
  };
  const GATE_FAIL = {
    passed: false,
    unmet: ["P6 artifact body contains the brief noun 'dispatch'", "emitted source has no module test"],
    evidenceHash: "f00dbeef99",
    checkedAt: 1,
  };

  it("injects the recorded PASS gate verdict into every role context", () => {
    const ctx = buildAgentContext(patchRec(project6(), { gate: GATE_PASS }), "coder", session(), {
      phase: 6,
    });
    assert.ok(ctx.includes("## DoD gate (machine-checkable)"), "gate block present");
    assert.ok(ctx.includes("verdict: PASS"), "PASS verdict shown");
    assert.ok(ctx.includes("abc12345"), "evidence-hash prefix cited");
    assert.ok(!ctx.includes("unmet criteria"), "no unmet lines on a PASS");
  });

  it("injects a FAIL gate with its unmet criteria — roles grade against the real DoD", () => {
    const ctx = buildAgentContext(patchRec(project6(), { gate: GATE_FAIL }), "reviewer", session(), {
      phase: 6,
    });
    assert.ok(ctx.includes("verdict: FAIL"), "FAIL verdict shown");
    assert.ok(ctx.includes("unmet criteria:"), "unmet list opened");
    assert.ok(ctx.includes("brief noun 'dispatch'"), "first unmet criterion surfaced");
    assert.ok(ctx.includes("no module test"), "second unmet criterion surfaced");
    assert.ok(ctx.includes("f00dbeef"), "evidence-hash prefix cited");
  });

  it("steers re-runs with the recorded rejection notes (reflexion steering, not just a count)", () => {
    const p = patchRec(project6(), {
      status: "rejected",
      rejectionHistory: [
        { note: "first rejection note", at: 1 },
        { note: "second rejection note", at: 2 },
        { note: "third rejection note", at: 3 },
      ],
    });
    const ctx = buildAgentContext(p, "coder", session(), { phase: 6 });
    assert.ok(ctx.includes("recorded rejections (3):"), "rejection count recorded");
    assert.ok(ctx.includes("second rejection note"), "most recent note surfaced");
    assert.ok(ctx.includes("third rejection note"), "second-most-recent note surfaced");
    assert.ok(!ctx.includes("first rejection note"), "older notes stay out of the prompt budget");
  });

  it("falls back to the single rejectionNote when no history exists", () => {
    const ctx = buildAgentContext(
      patchRec(project6(), { status: "rejected", rejectionNote: "schema drifted" }),
      "architect",
      session(),
      { phase: 6 },
    );
    assert.ok(ctx.includes("recorded rejection note: schema drifted"), "single note surfaced");
  });

  it("renders NO gate block when nothing is recorded (honest floor, no invented verdict)", () => {
    const ctx = buildAgentContext(project6(), "coder", session(), { phase: 6 });
    assert.ok(!ctx.includes("## DoD gate (machine-checkable)"), "no block without recorded evidence");
  });

  it("puts the recorded gate in front of the plan-act planner call (plan toward the real DoD)", async () => {
    const calls: string[] = [];
    const crew = createCrew(routedCompleter({ calls }));
    const res = await crew.runCrew(patchRec(project6(), { gate: GATE_FAIL }), {
      mode: "plan-act",
      phase: 6,
      live: false,
    });
    assert.equal(res.ok, true);
    const planCall = calls[0] ?? "";
    assert.ok(planCall.includes("## DoD gate (machine-checkable)"), "planner context carries the gate");
    assert.ok(planCall.includes("verdict: FAIL"), "planner sees the FAIL verdict");
    assert.ok(planCall.includes("brief noun 'dispatch'"), "planner sees the unmet criteria");
  });
});

// fixes/152 (steal #3): reviewer sees the CHANGE — treeReviewContext.
import { treeReviewContext } from "./crew.server.ts";
describe("treeReviewContext (diff-aware review context)", () => {
  it("renders per-file change summaries with exported names; bounded", () => {
    const ctx = treeReviewContext({
      generatedTree: [
        { path: "src/domain/ledger.ts", source: "export function createLedger() { return 1 }", hash: "a", attempt: 0 },
        { path: "src/jobs/reconcile.ts", source: "export const reconcile = () => 1", hash: "b", attempt: 0 },
      ],
    } as never);
    assert.match(ctx, /2 file\(s\)/);
    assert.match(ctx, /src\/domain\/ledger\.ts/);
    assert.match(ctx, /createLedger/);
    assert.match(ctx, /src\/jobs\/reconcile\.ts/);
    assert.ok(ctx.length <= 1500, "bounded");
  });
  it("honest no-tree / no-artifact states — nothing reads as reviewed", () => {
    const none = treeReviewContext({} as never);
    assert.match(none, /No generated artifact yet/);
    const single = treeReviewContext({ generatedSource: "export const x = 1" } as never);
    assert.match(single, /Single module \(no generated tree\)/);
  });
});

describe("185-H1 crew dual-channel + RT_E stamps", () => {
  it("ok:true runs never carry an error channel", async () => {
    const crew = createCrew(routedCompleter({}));
    const res = await crew.runCrew(seededProject(), { phase: 6, live: false });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal("error" in res, false, "ok:true must not carry an error channel");
    }
  });

  it("hostile dual-channel completer fail-closes with RT_E_INTERNAL", async () => {
    const dual = async (): Promise<LlmResult> =>
      ({
        ok: true,
        text: JSON.stringify({
          type: "code",
          content: "should not land",
          artifacts: [],
        }),
        model: "deepseek-v4-flash",
        error: "already complete",
      }) as LlmResult;
    const crew = createCrew(dual);
    const res = await crew.runCrew(seededProject(), { phase: 6, live: false });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, "error");
      assert.equal(res.code, "RT_E_INTERNAL");
      assert.match(res.error ?? "", /already complete/);
    }
  });

  it("configured:false gate stamps RT_E_LLM_NOT_CONFIGURED before any dispatch", async () => {
    let calls = 0;
    const crew = createCrewRuntime({
      complete: async () => {
        calls++;
        return { ok: true, text: "nope", model: "x" };
      },
      configured: () => false,
    });
    const res = await crew.runCrew(seededProject(), { phase: 6 });
    assert.deepEqual(res, {
      ok: false,
      reason: "not-configured",
      code: "RT_E_LLM_NOT_CONFIGURED",
    });
    assert.equal(calls, 0);
  });
});

// ---------------------------------------------------------------------------
// T-107.2 (fixes/216p, W6 · L3) — REGISTRY MIGRATION PIN (crew seam).
//
// The crew's DEFAULT backend (`runCrewServer` → `defaultCrew` →
// `crewRegistryCompleter`) now routes every turn through `callModel(role, …)`
// (llm/providers/registry.ts) instead of the legacy `completeDeepSeek` binding.
// This pin proves three things on the REAL default path:
//   1. the same fetch stub is reached with the same request shape the legacy
//      binding sent (url/method/model/thinking/stream/messages);
//   2. the crew tier mapping is the registry's (pro ⇒ `reasoning`, everything
//      else ⇒ `main`) and a `DEEPSEEK_MODEL_*` pin is honored;
//   3. an unknown explicit id is REFUSED (RT_E_VALIDATION) BEFORE the network —
//      registry-only behavior the legacy binding could never have.
// ---------------------------------------------------------------------------
describe("216p T-107.2 — registry migration pin (crew seam)", () => {
  it("the real default crew path reaches the same fetch shape, and the registry rules the ids", async () => {
    const KEY = "DEEPSEEK_API_KEY";
    const savedKey = process.env[KEY];
    const savedPin = process.env.DEEPSEEK_MODEL_REASONING;
    const realFetch = globalThis.fetch;
    const calls: Array<{ url: string; method?: string; body: Record<string, unknown> }> = [];
    try {
      process.env[KEY] = "sk-crew-registry-test";
      delete process.env.DEEPSEEK_MODEL_REASONING;
      globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
        calls.push({
          url: String(url),
          method: init?.method,
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        });
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"type":"code","content":"turn done","artifacts":[]}' } }],
            model: "deepseek-v4-flash",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch;

      // (1) The real default path (runCrewServer → defaultCrew → registry completer).
      const res = await runCrewServer(seededProject(), { phase: 6, live: false, maxSteps: 2 });
      assert.equal(res.ok, true);
      assert.ok(calls.length >= 1, "the crew reached the fetch stub through the registry");
      for (const call of calls) {
        assert.equal(call.url, "https://api.deepseek.com/chat/completions");
        assert.equal(call.method, "POST");
        assert.equal(call.body.model, "deepseek-v4-flash", "every ROLE_SPECS seat is the flash/main tier");
        assert.deepEqual(call.body.thinking, { type: "disabled" });
        assert.equal(call.body.stream, false);
        const messages = call.body.messages as Array<{ role?: string; content?: string }>;
        assert.equal(messages[0]?.role, "system", "the role-scoped system prompt is still first");
        assert.equal(messages[messages.length - 1]?.role, "user");
      }

      // (2) The tier mapping + the registry pin, through the exported completer.
      assert.equal(crewRoleForModel(undefined), "main");
      assert.equal(crewRoleForModel("deepseek-v4-flash"), "main");
      assert.equal(crewRoleForModel("deepseek-v4-pro"), "reasoning");
      const before = calls.length;
      const pro = await crewRegistryCompleter("reasoning turn", { model: "deepseek-v4-pro" });
      assert.equal(pro.ok, true);
      assert.equal(calls.length, before + 1);
      assert.equal(calls[before]!.body.model, "deepseek-v4-pro");
      assert.deepEqual(calls[before]!.body.thinking, { type: "enabled" }, "the pro tier shape follows the resolved id");

      process.env.DEEPSEEK_MODEL_REASONING = "deepseek-v4-flash";
      const pinned = await crewRegistryCompleter("pinned turn", { model: "deepseek-v4-pro" });
      assert.equal(pinned.ok, true, "a call-site id beats the env pin (precedence)");
      assert.equal(
        calls[calls.length - 1]!.body.model,
        "deepseek-v4-pro",
        "call-site model wins over the DEEPSEEK_MODEL_REASONING pin",
      );

      // (3) Unknown explicit ids never leave the process.
      const countBeforeRefusal = calls.length;
      const refused = await crewRegistryCompleter("bad turn", { model: "gpt-9" as never });
      assert.equal(refused.ok, false);
      if (!refused.ok) {
        assert.equal(refused.reason, "error");
        assert.equal(refused.code, "RT_E_VALIDATION");
      }
      assert.equal(calls.length, countBeforeRefusal, "refused before any network I/O");
    } finally {
      globalThis.fetch = realFetch;
      if (savedKey === undefined) delete process.env[KEY];
      else process.env[KEY] = savedKey;
      if (savedPin === undefined) delete process.env.DEEPSEEK_MODEL_REASONING;
      else process.env.DEEPSEEK_MODEL_REASONING = savedPin;
    }
  });
});
