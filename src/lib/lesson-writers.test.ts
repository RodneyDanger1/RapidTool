// ---------------------------------------------------------------------------
// lesson-writers.test.ts — L1–L5 lesson writer WIRING regression suite
// (fixes/117). Drives a real fixture through a failed seal, a vague P0, and a
// machine verify outcome, then asserts the content-addressed lesson rows landed
// in project.memory with the right tags/kinds — deterministic, no keys, no
// network.
//
// Run: node --experimental-strip-types --test src/lib/lesson-writers.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyPhaseResult, emptyProject, liveDegradeRow, runPhaseAsync, sealHonesty } from "./engine.ts";
import { applyVerifyOutcome, approve, runPhase, runUntilGate } from "./headless.ts";
import { runSummaryLesson, verifyOutcomeLesson } from "./knowledge.ts";
import { runToGate, seedProject } from "./testing/fixtures.ts";
import type { JsonLog, PhaseId, Project } from "./types.ts";

// engine.ts resolves the pure lesson builders from knowledge.ts lazily (its
// node:fs import is client-hostile). Force-load the module first so the lazy
// seam is populated before any synchronous applyPhaseResult call below.
await import("./knowledge.ts");

// fix 327 L1 — non-hermetic keyless suite. The host shell may carry a real
// DEEPSEEK_API_KEY (this box sets one in the User scope), which flips
// emptyProject's enforceDod create-default ON (engine.ts:1967) and makes
// drainToComplete park instead of completing. This suite is deterministic and
// keyless by construction, so isolate its process from the host key (node
// --test runs each file in its own child; no restore is needed).
delete process.env.DEEPSEEK_API_KEY;

/** Drive a project to completion through the headless loop (deterministic). */
async function drainToComplete(project: Project): Promise<Project> {
  let p = project;
  for (let i = 0; i < 40; i++) {
    if (p.status === "complete" || p.status === "blocked") return p;
    const res = await runUntilGate(p, { maxSteps: 1 });
    p = res.project;
    if (p.status === "awaiting_hitl") p = approve(p);
  }
  return p;
}

describe("L1 — vague-brief lesson at the P0 lattice seal", () => {
  it("a vocabulary-free brief sealing P0 mints one vague-brief lesson row (engine source)", async () => {
    await import("./knowledge.ts");
    const out = applyPhaseResult(
      emptyProject({ name: "Vague", brief: "build a tool for my team please" }),
      0,
    );
    const lessons = out.memory.filter((m) => m.id.startsWith("lesson-vague-brief-"));
    assert.equal(lessons.length, 1, "exactly one L1 row (content-addressed)");
    const row = lessons[0];
    assert.match(row.id, /^lesson-vague-brief-[0-9a-f]{8}$/);
    assert.equal(row.phase, 0);
    assert.equal(row.kind, "semantic");
    assert.equal(row.source, "engine");
    assert.ok((row.tags ?? []).includes("lesson"));
    assert.ok((row.tags ?? []).includes("vague-brief"));
    assert.ok((row.tags ?? []).includes("L1"));
    assert.ok(row.text.length <= 240, "H43-P2-2 budget");
    assert.ok(out.logs.some((l) => l.event === "lesson.capture"), "lesson.capture ledger event");
  });

  it("a rich brief sealing P0 mints no vague-brief lesson", async () => {
    await import("./knowledge.ts");
    const out = applyPhaseResult(seedProject(), 0);
    assert.ok(
      !out.memory.some((m) => m.id.startsWith("lesson-vague-brief-")),
      "no L1 row when the lattice is not vague/empty",
    );
  });
});

describe("T-11 (106 §6, F-08) — a RED seal mints no lesson; the signal is an honest log", () => {
  it("P6 sealing with the deterministic placeholder mints NO lesson row and logs p6.seal.unmet", async () => {
    await import("./knowledge.ts");
    const parked = runToGate(seedProject(), 6);
    const out = applyPhaseResult(parked, 6);
    // T-11 half 1 — the GREEN-SEAL GATE. A `complete` phase carrying an UNMET
    // DoD gate is a RED seal: it must mint no lesson row at all. Pre-T-11 the
    // engine minted a "P6 sealed with unmet DoD" template-emission row whose
    // targeted probe had never passed, so the contradiction compounded instead
    // of surfacing (F-08). This test replaces that old assertion deliberately:
    //   old → asserted `lessons.length >= 1` + a `lesson.capture` event;
    //   new → asserts exactly 0 lesson rows + 0 `lesson.capture` events.
    const lessons = out.memory.filter((m) => m.id.startsWith("lesson-template-emission-"));
    assert.equal(lessons.length, 0, "a red seal mints NO template-emission lesson row");
    // No NEW lesson row of ANY class either (the seal is the only lesson-writer
    // on this path; a P6 apply still legitimately appends its usual non-lesson
    // sandbox-execution memory row, which this assertion must not conflate).
    const before = new Set(parked.memory.filter((m) => m.id.startsWith("lesson-")).map((m) => m.id));
    const newLessons = out.memory.filter((m) => m.id.startsWith("lesson-") && !before.has(m.id));
    assert.equal(newLessons.length, 0, "a red seal mints no NEW lesson row of any class");
    assert.ok(
      !out.logs.some((l) => l.event === "lesson.capture"),
      "no lesson.capture ledger event on a red seal",
    );
    // T-11 half 2 — the red-seal signal is recorded, not swallowed: a bounded
    // warn log names the DoD probe IDS a green seal would have had to satisfy.
    const seal = out.logs.find((l) => l.event === "p6.seal.unmet");
    assert.ok(seal, "the red seal is recorded as a p6.seal.unmet log row");
    assert.equal(seal.level, "warn");
    assert.equal(seal.phase, 6);
    assert.match(seal.detail, /^red seal — 2 unmet DoD probe\(s\) \[p6-verified, p6-brief-fit\]: /);
    assert.ok(
      seal.detail.includes(
        'Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash)',
      ),
      "the unmet criterion text still rides the record verbatim",
    );
    assert.ok(
      seal.detail.slice(seal.detail.indexOf("unmet: ")).length <= 240,
      "H43-P2-2 budget",
    );
  });
});

describe("L3/L4 — verify outcome lesson (verify.server seam + headless append)", () => {
  it("verifyOutcomeLesson dispatches passed → L4 verified-procedure, failed → L3 verify-failure", () => {
    const l4 = verifyOutcomeLesson("passed", 6, "3/3 machine-run cases passed", 1);
    assert.match(l4.id, /^lesson-verified-procedure-[0-9a-f]{8}$/);
    assert.equal(l4.kind, "procedural");
    assert.ok((l4.tags ?? []).includes("L4"));
    assert.ok((l4.tags ?? []).includes("lesson"));

    const l3 = verifyOutcomeLesson("failed", 6, "cases still failing", 3);
    assert.match(l3.id, /^lesson-verify-failure-[0-9a-f]{8}$/);
    assert.equal(l3.kind, "episodic");
    assert.ok((l3.tags ?? []).includes("L3"));
    assert.ok((l3.tags ?? []).includes("lesson"));
  });

  it("applyVerifyOutcome appends the L4 lesson row on a passed outcome", () => {
    const p = seedProject();
    const lesson = verifyOutcomeLesson("passed", 6, "3/3 machine-run cases passed", 1);
    const q = applyVerifyOutcome(p, {
      status: "passed",
      iterations: 1,
      evidence: "3/3 machine-run cases passed",
      finalSource: "export const add = (a, b) => a + b;",
      cases: [{ id: "case-1", expression: "add(2,3) === 5" }],
      lesson,
    });
    assert.ok(q.memory.some((m) => m.id === lesson.id), "L4 lesson lands in project memory");
    assert.ok(q.logs.some((l) => l.event === "lesson.capture"));
  });

  it("applyVerifyOutcome appends the L3 lesson row on a failed outcome, once (idempotent)", () => {
    const p = seedProject();
    const lesson = verifyOutcomeLesson("failed", 6, "cases still failing", 3);
    const outcome = { status: "failed" as const, iterations: 3, evidence: "cases still failing", lesson };
    const q1 = applyVerifyOutcome(p, outcome);
    const q2 = applyVerifyOutcome(q1, outcome);
    const rows = (q2.memory ?? []).filter((m) => m.id === lesson.id);
    assert.equal(rows.length, 1, "re-applying a failed outcome never forks the L3 row");
  });
});

describe("L5 — run-summary lesson at headless run completion", () => {
  it("runSummaryLesson returns null for a clean run and a row for a failed run", () => {
    const clean = seedProject();
    assert.equal(runSummaryLesson(clean), null, "no failure signals → no L5");

    const failed: Project = {
      ...seedProject(),
      phases: seedProject().phases.map((r) =>
        r.id === 6 ? { ...r, gate: { passed: false, unmet: ["p6-brief-fit"], evidenceHash: "deadbeef", checkedAt: 1 } } : r,
      ),
      logs: [...seedProject().logs, { ts: 1, phase: 6, level: "warn" as const, event: "verify.fail", detail: "failed" }],
    };
    const l5 = runSummaryLesson(failed);
    assert.ok(l5, "failure signals → L5 run-summary");
    assert.match(l5.id, /^lesson-run-summary-[0-9a-f]{8}$/);
    assert.equal(l5.kind, "episodic");
    assert.equal(l5.phase, 12);
    assert.equal(l5.source, "engine");
    assert.ok((l5.tags ?? []).includes("lesson"));
    assert.ok((l5.tags ?? []).includes("run-summary"));
    assert.ok((l5.tags ?? []).includes("L5"));
    assert.match(l5.text, /gate FAIL P6/);
    assert.match(l5.text, /verify FAIL/);
  });

  it("a completed run with gate failures mints the L5 run-summary lesson", async () => {
    await import("./knowledge.ts");
    const done = await drainToComplete(seedProject());
    assert.equal(done.status, "complete");
    const lessons = done.memory.filter((m) => m.id.startsWith("lesson-run-summary-"));
    assert.equal(lessons.length, 1, "exactly one L5 row on run completion");
    assert.ok(done.logs.some((l) => l.event === "lesson.capture"));
  });
});

/** Red-gate every listed phase record (complete + passed:false) on a copy. */
function redGatePhases(project: Project, phaseIds: number[]): Project {
  return {
    ...project,
    phases: project.phases.map((r) =>
      phaseIds.includes(r.id)
        ? {
            ...r,
            status: "complete" as const,
            gate: {
              passed: false,
              unmet: ["p6-brief-fit"],
              evidenceHash: "c0ffee00",
              checkedAt: 1,
            },
          }
        : r,
    ),
  };
}

describe("fixes/144 M4-1 — sealHonesty census + the P12 delivery.complete guard", () => {
  it("sealHonesty reports clean on a project with no failed gates", () => {
    assert.deepEqual(sealHonesty(seedProject()), { clean: true, failed: [] });
  });

  it("sealHonesty reports one red phase id for a failed P6 gate", () => {
    const red = redGatePhases(seedProject(), [6]);
    assert.deepEqual(sealHonesty(red), { clean: false, failed: ["P6"] });
  });

  it("sealHonesty lists every red phase id in phase order", () => {
    const red = redGatePhases(seedProject(), [9, 3]);
    assert.deepEqual(sealHonesty(red), { clean: false, failed: ["P3", "P9"] });
  });

  it("a clean P12 seal keeps the byte-identical legacy delivery.complete line", async () => {
    await import("./knowledge.ts");
    const out = applyPhaseResult(seedProject(), 12);
    const log = out.logs.filter((l) => l.event === "delivery.complete").at(-1);
    assert.ok(log, "delivery.complete log present");
    assert.equal(log!.detail, "All 13 phases sealed.");
    assert.equal(log!.level, "info");
  });

  it("a red-gate P12 seal carries the failed-gate census on delivery.complete (never a bare clean line)", async () => {
    await import("./knowledge.ts");
    const red = redGatePhases(seedProject(), [3]);
    const out = applyPhaseResult(red, 12);
    const log = out.logs.filter((l) => l.event === "delivery.complete").at(-1);
    assert.ok(log, "delivery.complete log present");
    assert.equal(log!.detail, "All 13 phases sealed. 1 failed gates: P3");
    assert.equal(log!.level, "warn");
    assert.ok(
      !out.logs.some((l) => l.event === "delivery.complete" && l.detail === "All 13 phases sealed."),
      "no bare clean delivery line survives over red gates",
    );
  });
});

describe("fixes/144 M5-1 + T-11 — the red-seal evidence digest (unmet verbatim + refusal class) rides the seal log", () => {
  it("a recorded synthesis refusal stamps the class code + reason into the seal log detail (deterministic digest)", async () => {
    await import("./knowledge.ts");
    const parked = runToGate(seedProject(), 7); // P7 seals with the short p7-research gate unmet
    const withRefusal: Project = {
      ...parked,
      logs: [
        ...(parked.logs ?? []),
        {
          ts: 7,
          phase: 6 as PhaseId,
          level: "warn" as const,
          event: "p6.synthesis.refused",
          detail: "RT_E_LLM_REJECTED · the pro tier refused to emit an offline warehouse scan module",
        },
      ],
    };
    const out = applyPhaseResult(withRefusal, 7);
    // M5-1's intent is PRESERVED, not dropped: the record still says WHAT was
    // missing (the unmet criteria VERBATIM) plus the journey's refusal class and
    // reason in the shared lessonEvidenceDetail format. Since T-11 gates the
    // lesson-row mint on a green seal, that digest now rides the seal LOG.
    //   old → asserted an L2 lesson row whose `text` was the digest;
    //   new → asserts the `p7.seal.unmet` log detail IS that digest, and that
    //         no lesson row exists (the T-11 half).
    const seal = out.logs.find((l) => l.event === "p7.seal.unmet");
    assert.ok(seal, "the P7 red seal is recorded as a p7.seal.unmet log row");
    assert.equal(seal.level, "warn");
    assert.equal(
      seal.detail,
      "red seal — 1 unmet DoD probe(s) [p7-research]: unmet: Live research corpus exists for P7 (≥1 fetched finding) · class: RT_E_LLM_REJECTED · tail: the pro tier refused to emit an offline warehouse scan module",
      "digest carries unmet verbatim + refusal class + reason in the shared format",
    );
    assert.ok(seal.detail.slice(seal.detail.indexOf("unmet: ")).length <= 240, "H43-P2-2 budget");
    assert.equal(
      out.memory.filter((m) => m.id.startsWith("lesson-template-emission-")).length,
      0,
      "T-11: a red seal mints no lesson row",
    );
    // idempotent: re-sealing the same gate never duplicates the log row
    const again = applyPhaseResult(out, 7);
    const rows = (again.logs ?? []).filter((l) => l.event === "p7.seal.unmet");
    assert.equal(rows.length, 1, "re-seal adds no duplicate seal row (stale-read guard)");
  });

  it("the refusal class code survives the 240 budget even behind P6's long verbatim unmet list", async () => {
    await import("./knowledge.ts");
    const parked = runToGate(seedProject(), 6);
    const withRefusal: Project = {
      ...parked,
      logs: [
        ...(parked.logs ?? []),
        {
          ts: 6,
          phase: 6 as PhaseId,
          level: "warn" as const,
          event: "p6.synthesis.refused",
          detail: "RT_E_LLM_REJECTED · the pro tier refused to emit an offline warehouse scan module",
        },
      ],
    };
    const out = applyPhaseResult(withRefusal, 6);
    const seal = out.logs.find((l) => l.event === "p6.seal.unmet");
    assert.ok(seal, "the P6 red seal is recorded as a p6.seal.unmet log row");
    assert.ok(
      seal.detail.includes("unmet: Machine verification promoted a tested verdict"),
      "unmet head kept",
    );
    assert.ok(
      seal.detail.includes("class: RT_E_LLM_REJECTED"),
      "atomic class clause is never mangled by the row budget",
    );
    assert.ok(seal.detail.slice(seal.detail.indexOf("unmet: ")).length <= 240, "H43-P2-2 budget");
  });
});

// ---------------------------------------------------------------------------
// fixes/217f (216y §2.3 G2) — an unexpected live-layer error is RECORDED, never
// swallowed: runPhaseAsync still returns the deterministic floor, and the
// returned project carries a bounded warn row naming the real thrown message.
// ---------------------------------------------------------------------------
describe("fixes/217f (216y §2.3 G2) — a live-layer throw is recorded, never swallowed", () => {
  /**
   * Fault injection, deliberately NOT a production hook: on the research-phase
   * path liveLayer's stamp() spreads `base.meta` — a step applyPhaseResult never
   * takes — so an enumerable getter that throws detonates exactly that live-only
   * step while the deterministic floor for the same input still succeeds. (A
   * keyless suite cannot summon a real provider failure: no network, no key, and
   * the brief forbids adding a production-only test seam.)
   */
  function throwingMeta(message: string): NonNullable<Project["meta"]> {
    const meta = {} as NonNullable<Project["meta"]>;
    Object.defineProperty(meta, "w11-l5-detonator", {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error(message);
      },
    });
    return meta;
  }

  /** Log rows without their wall-clock stamp (two runs never share a ms). */
  const stripTs = (rows: JsonLog[]) =>
    rows.map((r) => ({ phase: r.phase, level: r.level, event: r.event, detail: r.detail }));

  it("returns the deterministic floor AND records the bounded p0.live.failed warn row", async () => {
    const hostile: Project = {
      ...seedProject(),
      meta: throwingMeta("live-layer exploded: provider reply was not JSON"),
    };
    const out = await runPhaseAsync(hostile, 0);
    const floor = applyPhaseResult(hostile, 0);
    // The floor: every observable the synchronous engine produces for the same input.
    assert.equal(out.status, floor.status);
    assert.equal(out.currentPhase, floor.currentPhase);
    assert.deepEqual(
      out.phases.map((r) => [r.id, r.status]),
      floor.phases.map((r) => [r.id, r.status]),
    );
    assert.deepEqual(out.artifacts.map((a) => a.title), floor.artifacts.map((a) => a.title));
    assert.equal(out.logs.length, floor.logs.length + 1, "exactly one row is appended");
    assert.deepEqual(
      stripTs(out.logs.slice(0, -1)),
      stripTs(floor.logs),
      "floor logs preserved verbatim (timestamps aside)",
    );
    // The record: the throw is visible with its REAL message, unclassified, and the
    // floor statement is explicit — a degraded run is no longer indistinguishable
    // from a deliberately deterministic one (the audit's G2 wording).
    const row = out.logs.at(-1)!;
    assert.equal(row.level, "warn");
    assert.equal(row.event, "p0.live.failed");
    assert.equal(row.phase, 0);
    assert.equal(
      row.detail,
      "live layer failed (unclassified): live-layer exploded: provider reply was not JSON — deterministic floor used instead",
    );
    assert.ok(row.detail.length <= 240, "bounded detail (H43-P2-2-style budget)");
  });

  it("clips an oversized thrown message on the budget — marked, and the clipped tail never leaks", async () => {
    const long = "x".repeat(500) + "TAIL-MARKER";
    const out = await runPhaseAsync({ ...seedProject(), meta: throwingMeta(long) }, 7);
    const row = out.logs.at(-1)!;
    assert.equal(row.event, "p7.live.failed", "the event is phase-scoped");
    assert.ok(row.detail.length <= 240, `bounded detail (got ${row.detail.length})`);
    assert.ok(row.detail.includes("…"), "truncation is marked, never a silent cut");
    assert.ok(!row.detail.includes("TAIL-MARKER"), "the clipped tail never leaks into the row");
  });

  it("a normal (non-throwing) keyless run records NO live-failure row and logs exactly the floor", async () => {
    const p = seedProject();
    const out = await runPhaseAsync(p, 0);
    assert.equal(
      out.logs.some((l) => l.event === "p0.live.failed"),
      false,
      "no false positive on a clean live pass",
    );
    const floor = applyPhaseResult(p, 0);
    assert.equal(out.status, floor.status);
    assert.deepEqual(stripTs(out.logs), stripTs(floor.logs));
  });
});

// ---------------------------------------------------------------------------
// fixes/252 (W19-L1 · OV-13 + OV-29) — a live degrade is a CODED visible row:
// a KEYED failure must never read like a keyless run (OV-29's real case at
// `headless.ts:231`), and a failed keyless web search is recorded too (:208).
//
// Half 1 pins the exported row factory + its append helper. The engine's two
// keyed catch sites in `liveLayer` sit behind `if ((await llmStatus()).configured)`,
// and `llmStatus` is a TanStack server-fn whose own catch reports
// `configured: false` under bare Node — a keyless suite cannot enter that branch
// by construction (241 §OV-13), so those sites' wiring is the keyed follow-up
// fixes/252 registers; their row shape is pinned here instead.
//
// Half 2 IS the real end-to-end case, no production test seam: `runPhase(...,
// { live: true })` drives the shipped overlay path with the key present and
// global `fetch` stubbed to the providers' own refusal (HTTP 401) — the keyed
// failure must leave its coded row, and the same input run keyless must differ
// by exactly that row.
// ---------------------------------------------------------------------------
describe("fixes/252 (W19-L1 · OV-13 + OV-29) — keyed live failures leave coded rows, never a keyless look", () => {
  /** The row set this row (OV-13/OV-29) owns, for one phase. */
  const liveRowEvents = (proj: Project, phase: PhaseId = 0) =>
    proj.logs.filter(
      (l) =>
        l.event === `p${phase}.live.research.failed` || l.event === `p${phase}.live.narrative.failed`,
    );
  /** Everything except the OV-13/OV-29 rows (G2's stamp-stripping idiom). */
  const stripTs = (rows: JsonLog[]) =>
    rows.map((r) => ({ phase: r.phase, level: r.level, event: r.event, detail: r.detail }));
  const nonLiveRows = (proj: Project) =>
    stripTs(proj.logs.filter((l) => !l.event.includes(".live.")));

  const KEY = "DEEPSEEK_API_KEY";
  const TAVILY = "TAVILY_API_KEY";
  const realFetch = globalThis.fetch;

  /** Run `fn` under a stubbed network + explicit key state; always restored. */
  async function withStubbedNet(
    env: Record<string, string | undefined>,
    fn: () => Promise<void>,
  ): Promise<void> {
    const saved: Record<string, string | undefined> = {};
    for (const k of [KEY, TAVILY]) saved[k] = process.env[k];
    try {
      for (const [k, v] of Object.entries(env)) process.env[k] = v;
      await fn();
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      globalThis.fetch = realFetch;
    }
  }

  /** Every request is refused with the provider's own 401 shape (no network). */
  const stubRefusal = (async () =>
    new Response("stub: this suite never touches the network", { status: 401 })) as typeof fetch;

  /** DuckDuckGo/SearXNG refused; Wikipedia (keyless provider) really served. */
  const stubWikipedia = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : String(input);
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    if (/wikipedia\.org/.test(url) && /list=search/.test(url)) {
      return json({ query: { search: [{ title: "Rapid tool", snippet: "<b>stub</b> finding" }] } });
    }
    if (/wikipedia\.org/.test(url) && /prop=extracts/.test(url)) {
      return json({ query: { pages: { "1": { extract: "Stub extract body." } } } });
    }
    return new Response("stub: refusal", { status: 401 });
  }) as typeof fetch;

  it("liveDegradeRow: a coded failure keeps its own registered code, bounded, with the explicit floor statement", () => {
    const row = liveDegradeRow(
      0,
      "narrative",
      {
        ok: false,
        reason: "error",
        error: 'DeepSeek API key is invalid (HTTP 401) — requested model: "deepseek-v4-pro"',
        code: "RT_E_LLM_REJECTED",
      },
      "RT_E_LLM_REJECTED",
    );
    assert.equal(row.level, "warn");
    assert.equal(row.event, "p0.live.narrative.failed");
    assert.equal(row.phase, 0);
    assert.ok(
      row.detail.startsWith("RT_E_LLM_REJECTED · live narrative failed: "),
      `coded, layer-named detail (got: ${row.detail})`,
    );
    assert.ok(row.detail.endsWith(" — deterministic result used instead"));
    assert.ok(row.detail.includes("HTTP 401"), "the provider's own prose rides along");
    assert.ok(row.detail.length <= 240, "bounded detail (H43-P2-2-style budget)");
  });

  it("liveDegradeRow: an unregistered code is NOT trusted, a throw is classified by the caller's fallback", () => {
    const bogus = liveDegradeRow(
      7,
      "research",
      { code: "RT_E_NOT_A_REGISTERED_CODE", error: "made up" },
      "RT_E_RESEARCH_UNAVAILABLE",
    );
    assert.ok(
      bogus.detail.startsWith("RT_E_RESEARCH_UNAVAILABLE · "),
      "a foreign/typo label must not mint a fake code",
    );
    const plain = liveDegradeRow(2, "constraints", new Error("boom"), "RT_E_LLM_REJECTED");
    assert.ok(plain.detail.startsWith("RT_E_LLM_REJECTED · live constraints failed: boom"));
    // classifyError's tier-1 matchers still win for a real classed throw.
    const aborted = Object.assign(new Error("request aborted"), { name: "AbortError" });
    const timeout = liveDegradeRow(7, "narrative", aborted, "RT_E_LLM_REJECTED");
    assert.ok(timeout.detail.startsWith("RT_E_LLM_TIMEOUT · "));
    // A configured-gate pass whose call then found no key is its own registered code.
    const vanished = liveDegradeRow(3, "narrative", { ok: false, reason: "not-configured" }, "RT_E_LLM_REJECTED");
    assert.ok(vanished.detail.startsWith("RT_E_LLM_NOT_CONFIGURED · "));
  });

  it("liveDegradeRow: clips on the budget (marked, tail never leaks) and NEVER throws on a hostile failure", () => {
    const long = new Error("x".repeat(500) + "TAIL-MARKER");
    const row = liveDegradeRow(2, "constraints", long, "RT_E_LLM_REJECTED");
    assert.ok(row.detail.length <= 240, `bounded detail (got ${row.detail.length})`);
    assert.ok(row.detail.includes("…"), "truncation is marked, never a silent cut");
    assert.ok(!row.detail.includes("TAIL-MARKER"), "the clipped tail never leaks into the row");

    const hostile: Record<string, unknown> = {};
    for (const prop of ["code", "error"]) {
      Object.defineProperty(hostile, prop, {
        enumerable: true,
        configurable: true,
        get() {
          throw new Error("hostile getter");
        },
      });
    }
    const safe = liveDegradeRow(3, "narrative", hostile, "RT_E_LLM_REJECTED");
    assert.equal(safe.level, "warn", "telemetry never throws into the code it observes");
    assert.ok(safe.detail.startsWith("RT_E_LLM_REJECTED · live narrative failed: "));
    assert.ok(safe.detail.length <= 240);
  });

  it("headless.ts:231 — the KEYED failure's row set differs from the keyless run's by exactly its coded row", async () => {
    await withStubbedNet({ [KEY]: "", [TAVILY]: "" }, async () => {
      globalThis.fetch = stubRefusal;
      const keyless = await runPhase(seedProject(), 0, { live: true });

      const keyedProject = seedProject();
      process.env[KEY] = "sk-stub-not-a-real-key";
      const keyed = await runPhase(keyedProject, 0, { live: true });

      // (a) The keyed narrative failure is VISIBLE and CODED (the OV-29 case:
      // without this row the run is indistinguishable from the keyless one).
      const keyedNarr = liveRowEvents(keyed).filter((l) => l.event === "p0.live.narrative.failed");
      assert.equal(keyedNarr.length, 1, "one row per failed keyed narrative");
      const narr = keyedNarr[0];
      assert.equal(narr.level, "warn");
      assert.ok(
        narr.detail.startsWith("RT_E_LLM_KEY_REJECTED · live narrative failed: "),
        `the provider's own registered class leads the row (got: ${narr.detail})`,
      );
      assert.ok(narr.detail.endsWith(" — deterministic result used instead"));

      // (b) The keyless run must NOT carry it — the difference IS the proof.
      assert.equal(
        liveRowEvents(keyless).some((l) => l.event === "p0.live.narrative.failed"),
        false,
        "a keyless run mints no narrative row (the key gates it)",
      );
      assert.notDeepEqual(
        stripTs(liveRowEvents(keyed)),
        stripTs(liveRowEvents(keyless)),
        "a keyed failure and a keyless run are never the same record",
      );

      // (c) The failed web-search leg is coded in BOTH runs (keyless included).
      for (const [label, proj] of [["keyless", keyless], ["keyed", keyed]] as const) {
        const search = liveRowEvents(proj).filter((l) => l.event === "p0.live.research.failed");
        assert.equal(search.length, 1, `${label}: one row for the failed research leg`);
        assert.ok(search[0].detail.startsWith("RT_E_RESEARCH_UNAVAILABLE · "), `${label}: coded`);
      }

      // (d) Evidence only, never behavior: every other byte matches (the
      // degrade does not change the deterministic outcome).
      assert.equal(keyed.status, keyless.status);
      assert.equal(keyed.currentPhase, keyless.currentPhase);
      assert.deepEqual(keyed.artifacts.map((a) => a.title), keyless.artifacts.map((a) => a.title));
      assert.deepEqual(nonLiveRows(keyed), nonLiveRows(keyless), "floor logs preserved verbatim");
    });
  });

  it("headless.ts:208/231 — a live pass the keyless provider really serves mints NO degrade row (no false positive)", async () => {
    await withStubbedNet({ [KEY]: "", [TAVILY]: "" }, async () => {
      globalThis.fetch = stubWikipedia;
      const clean = await runPhase(seedProject(), 0, { live: true });
      assert.ok(
        clean.research?.some((e) => e.provider === "wikipedia"),
        "the stub really served the live leg (assertion below is not vacuous)",
      );
      assert.equal(liveRowEvents(clean).length, 0, "a served live pass stays row-free");
    });
  });
});

// ---------------------------------------------------------------------------
// fixes/255 (W20-L3 · pickup of OV-13) — the "silent-skip region": a THROWN
// live pass under headless.runPhase is recorded with G2's own row, never a
// silent skip to the floor. Proven pre-fix 2026-09-24 (W20-L3 probe): the same
// injected throw that mints `p0.live.failed` under engine.runPhaseAsync left
// ZERO rows under the CLI path — a keyed failure read exactly like a keyless
// run (raw probe output in fixes/255_lane3_ov13.md).
// ---------------------------------------------------------------------------
describe("fixes/255 (W20-L3) — headless.runPhase's outer catch records G2's row, never a silent skip", () => {
  /** G2's detonator idiom (lesson-writers.test.ts:336) — a live-only step. */
  function detonatorMeta(message: string): NonNullable<Project["meta"]> {
    const meta = {} as NonNullable<Project["meta"]>;
    Object.defineProperty(meta, "w20-l3-detonator", {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error(message);
      },
    });
    return meta;
  }

  const stripTs = (rows: JsonLog[]) =>
    rows.map((r) => ({ phase: r.phase, level: r.level, event: r.event, detail: r.detail }));

  it("a thrown live layer leaves G2's p0.live.failed row + the deterministic floor", async () => {
    const hostile: Project = {
      ...seedProject(),
      meta: detonatorMeta("w20-l3: live-layer exploded: provider reply was not JSON"),
    };
    const out = await runPhase(hostile, 0, { live: true });
    const floor = applyPhaseResult(hostile, 0);
    // Floor outcome preserved (evidence only, never behavior).
    assert.equal(out.status, floor.status);
    assert.equal(out.currentPhase, floor.currentPhase);
    assert.deepEqual(out.artifacts.map((a) => a.title), floor.artifacts.map((a) => a.title));
    // Exactly one row appended, and it is G2's row.
    assert.equal(out.logs.length, floor.logs.length + 1, "exactly one row is appended");
    assert.deepEqual(
      stripTs(out.logs.slice(0, -1)),
      stripTs(floor.logs),
      "floor logs preserved verbatim (timestamps aside)",
    );
    const row = out.logs.at(-1)!;
    assert.equal(row.level, "warn");
    assert.equal(row.event, "p0.live.failed");
    assert.equal(row.phase, 0);
    assert.equal(
      row.detail,
      "live layer failed (unclassified): w20-l3: live-layer exploded: provider reply was not JSON — deterministic floor used instead",
    );
    assert.ok(row.detail.length <= 240, "bounded detail (H43-P2-2-style budget)");
  });

  it("a non-live run mints no live-failure row (the guard arm is silent by design)", async () => {
    const out = await runPhase(seedProject(), 0);
    assert.equal(
      out.logs.some((l) => l.event.includes(".live.")),
      false,
      "no live layer ran → nothing recorded",
    );
  });
});
