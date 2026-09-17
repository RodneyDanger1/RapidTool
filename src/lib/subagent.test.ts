/**
 * subagent.test.ts — the sub-agent contract (T-107.10, W7 · L4 — fixes/216t):
 * caps, coded refusals, claim lifecycle, ledger attribution.
 *
 * Every assertion is about a REAL contract behavior: a cap, a refusal CODE, a
 * lifecycle transition, or an attribution row — never a tautology. The
 * dispatch is always an injected fake (no key, no network, no timers).
 *
 * Run: node --experimental-strip-types --test src/lib/subagent.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SUBAGENT_DEFAULT_BUDGET_TOKENS,
  SUBAGENT_MAX_BRIEF_CHARS,
  SUBAGENT_MAX_CONCURRENCY,
  SUBAGENT_MAX_TASKS,
  createSubagentContract,
  normalizeScopeEntry,
  subagentConcurrencyRefusal,
  subagentLedgerLines,
} from "./subagent.ts";
import type { SubagentTask } from "./subagent.ts";
import type { LlmResult } from "./llm.ts";

const okReply = (text: string, tokens = { promptTokens: 10, completionTokens: 10 }): LlmResult => ({
  ok: true,
  text,
  model: "fake",
  usage: tokens,
});

const task = (id: string, over: Partial<SubagentTask> = {}): SubagentTask => ({
  id,
  brief: `brief for ${id}`,
  ...over,
});

/** Contract with a deterministic clock + a recording dispatch. */
function harness(opts: {
  replies?: LlmResult[];
  configured?: () => boolean;
  cap?: number;
  concurrency?: number;
  track?: { inFlight: number; max: number };
} = {}) {
  const seen: SubagentTask[] = [];
  let i = 0;
  const replies = opts.replies ?? [];
  const contract = createSubagentContract({
    complete: async (t) => {
      seen.push(t);
      if (opts.track) {
        opts.track.inFlight += 1;
        opts.track.max = Math.max(opts.track.max, opts.track.inFlight);
        await new Promise((r) => setTimeout(r, 1));
        opts.track.inFlight -= 1;
      }
      return replies[i++] ?? okReply(t.id);
    },
    ...(opts.configured ? { configured: opts.configured } : {}),
    ...(opts.cap !== undefined ? { perAgentBudgetTokens: opts.cap } : {}),
    ...(opts.concurrency !== undefined ? { maxConcurrency: opts.concurrency } : {}),
    orchestrator: "test-orchestrator",
    now: () => 1_760_000_000_000,
  });
  return { contract, seen };
}

// ---------------------------------------------------------------------------
// 1. Caps — refused, coded, pre-dispatch
// ---------------------------------------------------------------------------

describe("subagent contract — caps", () => {
  it("hard caps are what they say (concurrency 4, tasks 24, budget 12k)", () => {
    assert.equal(SUBAGENT_MAX_CONCURRENCY, 4);
    assert.equal(SUBAGENT_MAX_TASKS, 24);
    assert.equal(SUBAGENT_DEFAULT_BUDGET_TOKENS, 12_000);
    assert.equal(SUBAGENT_MAX_BRIEF_CHARS, 8_000);
  });

  it("a batch asking for MORE concurrency than the cap is refused — nothing claimed, nothing dispatched", async () => {
    const { contract, seen } = harness();
    const report = await contract.runBatch([task("t1")], { maxConcurrency: SUBAGENT_MAX_CONCURRENCY + 1 });
    assert.equal(report.ok, false);
    assert.equal(report.refused?.code, "RT_E_VALIDATION");
    assert.match(report.refused?.error ?? "", /exceeds the contract cap 4/);
    assert.match(report.refused?.error ?? "", /never silently clamping/);
    assert.equal(report.dispatched, 0);
    assert.equal(report.rows.length, 0, "a refused batch mints no rows");
    assert.equal(seen.length, 0, "no dispatch happened");
  });

  it("over-cap batch size / empty batch / non-array are coded refusals", async () => {
    const { contract, seen } = harness();
    const tooMany = Array.from({ length: SUBAGENT_MAX_TASKS + 1 }, (_, n) => task(`t${n}`));
    const big = await contract.runBatch(tooMany);
    assert.equal(big.refused?.code, "RT_E_VALIDATION");
    assert.match(big.refused?.error ?? "", /exceeds the contract cap 24/);
    const empty = await contract.runBatch([]);
    assert.equal(empty.refused?.code, "RT_E_VALIDATION");
    assert.match(empty.refused?.error ?? "", /empty delegation batch/);
    const hostile = await contract.runBatch("nope" as unknown as SubagentTask[]);
    assert.equal(hostile.refused?.code, "RT_E_VALIDATION");
    assert.equal(seen.length, 0);
  });

  it("subagentConcurrencyRefusal: hostile numbers are refused, never clamped", () => {
    assert.equal(subagentConcurrencyRefusal(1), null);
    assert.equal(subagentConcurrencyRefusal(SUBAGENT_MAX_CONCURRENCY), null);
    assert.equal(subagentConcurrencyRefusal(SUBAGENT_MAX_CONCURRENCY + 1)?.code, "RT_E_VALIDATION");
    assert.equal(subagentConcurrencyRefusal(0)?.code, "RT_E_VALIDATION");
    assert.equal(subagentConcurrencyRefusal(-2)?.code, "RT_E_VALIDATION");
    assert.equal(subagentConcurrencyRefusal(1.5)?.code, "RT_E_VALIDATION");
    assert.equal(subagentConcurrencyRefusal(0 / 0)?.code, "RT_E_VALIDATION");
  });

  it("a hostile constructor config throws with the code named (programmer error, never silent)", () => {
    const thrown = (fn: () => unknown): string => {
      try {
        fn();
        return "";
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    };
    assert.match(thrown(() => createSubagentContract({ complete: undefined as never })), /RT_E_VALIDATION/);
    assert.match(thrown(() => createSubagentContract({ complete: async () => okReply("x"), perAgentBudgetTokens: 0 })), /RT_E_VALIDATION/);
    assert.match(
      thrown(() => createSubagentContract({ complete: async () => okReply("x"), maxConcurrency: 99 })),
      /exceeds the contract cap/,
    );
  });

  it("per-agent budget: an over-cap budget is refused PRE-dispatch with RT_E_BUDGET_EXHAUSTED", async () => {
    const { contract, seen } = harness({ cap: 100 });
    const report = await contract.runBatch([task("t1", { budgetTokens: 101 })]);
    assert.equal(report.ok, false);
    assert.equal(report.results.length, 1);
    const r = report.results[0]!;
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, "RT_E_BUDGET_EXHAUSTED");
      assert.match(r.note, /exceeds the per-agent cap 100/);
    }
    assert.equal(report.dispatched, 0, "the refusal happens BEFORE dispatch");
    assert.equal(seen.length, 0);
    assert.equal(contract.rows().length, 1, "the refused task still owns its terminal row");
    assert.equal(contract.rows()[0]!.event, "block");
    assert.equal(contract.rows()[0]!.code, "RT_E_BUDGET_EXHAUSTED");
  });

  it("per-agent budget: a reply that OVERSPENDS its task budget is blocked with the spend kept", async () => {
    const { contract } = harness({ replies: [okReply("big", { promptTokens: 90, completionTokens: 40 })], cap: 100 });
    const report = await contract.runBatch([task("t1", { budgetTokens: 100 })]);
    const r = report.results[0]!;
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "RT_E_BUDGET_EXHAUSTED");
    assert.equal(contract.spentTokens(), 130, "the honest spend is recorded, never clamped away");
    const row = contract.rows()[1]!;
    assert.equal(row.event, "block");
    assert.equal(row.tokens, 130);
    assert.match(row.note, /spent 130 > task budget 100/);
  });
});

// ---------------------------------------------------------------------------
// 2. Task validation — coded refusals, incl. sibling scope overlap
// ---------------------------------------------------------------------------

describe("subagent contract — task validation + sibling scope", () => {
  it("invalid shapes are refused with RT_E_VALIDATION and never dispatched", async () => {
    const { contract, seen } = harness();
    const hostile = [
      null,
      "task",
      42,
      {},
      { id: "", brief: "b" },
      { id: "   ", brief: "b" },
      { id: "t", brief: "" },
      { id: "t", brief: "   " },
      { id: "t", brief: "b", role: "" },
      { id: "t", brief: "b", budgetTokens: 0 },
      { id: "t", brief: "b", budgetTokens: 0 / 0 },
      { id: "t", brief: "b", scope: "src/a.ts" },
      { id: "t", brief: "b", scope: [""] },
      { id: "t", brief: "b", scope: [7] },
    ];
    for (const raw of hostile) {
      const report = await contract.runBatch([raw as SubagentTask]);
      const r = report.results[0]!;
      assert.equal(r.ok, false, `${JSON.stringify(raw)} must be refused`);
      if (!r.ok) assert.equal(r.code, "RT_E_VALIDATION");
    }
    assert.equal(seen.length, 0, "nothing hostile ever reached the dispatcher");
  });

  it("an over-cap brief is REFUSED, never truncated", async () => {
    const { contract, seen } = harness();
    const long = "x".repeat(SUBAGENT_MAX_BRIEF_CHARS + 1);
    const report = await contract.runBatch([task("t1", { brief: long })]);
    const r = report.results[0]!;
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, "RT_E_VALIDATION");
      assert.match(r.note, /the 8000-char cap is a cap; refused, never truncated/);
    }
    assert.equal(seen.length, 0);
  });

  it("duplicate ids are refused — one id, one task", async () => {
    const { contract } = harness();
    const report = await contract.runBatch([task("dup"), task("dup")]);
    assert.equal(report.results[0]!.ok, true, "the first claim owns the id");
    const second = report.results[1]!;
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, "RT_E_VALIDATION");
      assert.match(second.note, /duplicate task id "dup"/);
    }
  });

  it("sibling scope overlap is refused — parallel children never fight over the same files", async () => {
    const { contract, seen } = harness();
    const report = await contract.runBatch([
      task("a", { scope: ["src/jobs/rent.ts", "tests/a.spec.ts"] }),
      task("b", { scope: ["SRC\\JOBS\\RENT.TS"] }), // same file, Windows casing/separators
      task("c", { scope: ["src/jobs/other.ts"] }),
    ]);
    assert.equal(report.results[0]!.ok, true);
    const b = report.results[1]!;
    assert.equal(b.ok, false);
    if (!b.ok) {
      assert.equal(b.code, "RT_E_VALIDATION");
      assert.match(b.note, /overlaps task "a"/);
    }
    assert.equal(report.results[2]!.ok, true, "a non-overlapping sibling is untouched");
    assert.equal(seen.length, 2, "only the two non-overlapping tasks dispatched");
    assert.equal(normalizeScopeEntry(" SRC\\Jobs\\Rent.TS/ "), "src/jobs/rent.ts");
  });

  it("scope normalization is exact-match (documented): a directory prefix is NOT an overlap", async () => {
    const { contract } = harness();
    const report = await contract.runBatch([task("dir", { scope: ["src/jobs"] }), task("file", { scope: ["src/jobs/x.ts"] })]);
    assert.equal(report.results[0]!.ok, true);
    assert.equal(report.results[1]!.ok, true, "prefix vs member is a documented non-overlap (exact-match rule)");
  });
});

// ---------------------------------------------------------------------------
// 3. Coded refusals from the transport + the config gate
// ---------------------------------------------------------------------------

describe("subagent contract — transport refusals + config gate", () => {
  it("a not-configured dispatch blocks with RT_E_LLM_NOT_CONFIGURED (never a fake turn)", async () => {
    const { contract } = harness({ replies: [{ ok: false, reason: "not-configured" }] });
    const report = await contract.runBatch([task("t1")]);
    const r = report.results[0]!;
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "RT_E_LLM_NOT_CONFIGURED");
    assert.equal(report.completed, 0);
    assert.equal(report.blocked, 1);
  });

  it("a provider code rides through verbatim; an un-coded error maps to RT_E_INTERNAL", async () => {
    const { contract } = harness({
      replies: [
        { ok: false, reason: "error", error: "boom", code: "RT_E_LLM_TIMEOUT" },
        { ok: false, reason: "error", error: "mystery" },
      ],
    });
    const report = await contract.runBatch([task("t1"), task("t2")]);
    const [a, b] = report.results;
    assert.equal(a!.ok, false);
    assert.equal(b!.ok, false);
    if (!a!.ok) assert.equal(a!.code, "RT_E_LLM_TIMEOUT");
    if (!b!.ok) assert.equal(b!.code, "RT_E_INTERNAL");
  });

  it("the config gate stops the WHOLE batch before any dispatch", async () => {
    const { contract, seen } = harness({ configured: () => false });
    const report = await contract.runBatch([task("t1"), task("t2")]);
    assert.equal(report.dispatched, 0);
    assert.equal(seen.length, 0);
    assert.equal(report.blocked, 2);
    for (const r of report.results) {
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, "RT_E_LLM_NOT_CONFIGURED");
    }
    assert.equal(report.rows.filter((row) => row.event === "claim").length, 2, "claims are recorded honestly…");
    assert.equal(report.rows.filter((row) => row.event === "block").length, 2, "…and every claim has its terminal row");
  });
});

// ---------------------------------------------------------------------------
// 4. Lifecycle (claim → complete | block) + attribution ledger
// ---------------------------------------------------------------------------

describe("subagent contract — claim lifecycle + ledger attribution", () => {
  it("claim is idempotent-guarded: one claim per task id", () => {
    const { contract } = harness();
    const first = contract.claim(task("t1", { role: "architect", budgetTokens: 500 }));
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.row.event, "claim");
      assert.equal(first.row.taskId, "t1");
      assert.equal(first.row.actor, "subagent:architect", "attribution names the child seat");
      assert.equal(first.row.orchestrator, "test-orchestrator");
      assert.equal(first.row.code, null);
      assert.equal(first.row.at, new Date(1_760_000_000_000).toISOString(), "ISO paper trail");
      assert.equal(first.row.ts, 1_760_000_000_000);
    }
    const again = contract.claim(task("t1"));
    assert.equal(again.ok, false);
    if (!again.ok) {
      assert.equal(again.code, "RT_E_VALIDATION");
      assert.match(again.error, /already claimed/);
    }
  });

  it("complete/block refuse unknown, unclaimed and double-settled ids", () => {
    const { contract } = harness();
    const unknown = contract.complete("ghost", { output: "x" });
    assert.equal(unknown.ok, false);
    if (!unknown.ok) {
      assert.equal(unknown.code, "RT_E_VALIDATION");
      assert.match(unknown.error, /claim before complete/);
    }
    contract.claim(task("t1"));
    const done = contract.complete("t1", { output: "out", usage: { promptTokens: 5, completionTokens: 5 } });
    assert.equal(done.ok, true);
    if (done.ok) {
      assert.equal(done.row.event, "complete");
      assert.equal(done.row.tokens, 10);
    }
    const twice = contract.complete("t1", { output: "again" });
    assert.equal(twice.ok, false);
    if (!twice.ok) assert.match(twice.error, /already settled/);
    const afterBlock = contract.block("t1", { note: "late" });
    assert.equal(afterBlock.ok, false);
  });

  it("block defaults to RT_E_INTERNAL and always carries a note", () => {
    const { contract } = harness();
    contract.claim(task("t1"));
    const b = contract.block("t1", { note: "" });
    assert.equal(b.ok, true);
    if (b.ok) {
      assert.equal(b.row.event, "block");
      assert.equal(b.row.code, "RT_E_INTERNAL");
      assert.equal(b.row.note, "RT_E_INTERNAL (no note)");
    }
    const settledResult = contract.results()[0]!;
    assert.equal(settledResult.ok, false);
    if (!settledResult.ok) assert.equal(settledResult.code, "RT_E_INTERNAL");
  });

  it("every batch task owns exactly one claim and one terminal row (never silent)", async () => {
    const { contract } = harness({ replies: [okReply("a"), { ok: false, reason: "error", error: "x", code: "RT_E_LLM_REJECTED" }] });
    const report = await contract.runBatch([task("t1"), task("t2")]);
    assert.equal(report.dispatched, 2);
    assert.equal(report.completed, 1);
    assert.equal(report.blocked, 1);
    const rows = report.rows;
    for (const id of ["t1", "t2"]) {
      assert.equal(rows.filter((r) => r.taskId === id && r.event === "claim").length, 1, `${id} claimed once`);
      assert.equal(
        rows.filter((r) => r.taskId === id && (r.event === "complete" || r.event === "block")).length,
        1,
        `${id} has exactly one terminal row`,
      );
    }
    assert.deepEqual(
      report.results.map((r) => r.id),
      ["t1", "t2"],
      "results stay INPUT-ordered (deterministic)",
    );
    const lines = subagentLedgerLines(rows);
    assert.equal(lines.length, rows.length, "one human line per row");
    assert.ok(lines[0]!.includes("claim · t1"));
    assert.ok(lines.some((l) => l.includes("block · t2 · subagent:test-orchestrator · RT_E_LLM_REJECTED")));
  });

  it("attribution: rows name the child seat + carry the usage, and the ok result is {ok:true, code:null, note}", async () => {
    const { contract } = harness({ replies: [okReply("built it", { promptTokens: 120, completionTokens: 30 })] });
    const report = await contract.runBatch([task("t1", { role: "coder" })]);
    const r = report.results[0]!;
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.code, null, "success carries code:null — the {ok, code, note} contract");
      assert.equal(r.output, "built it");
      assert.deepEqual(r.usage, { promptTokens: 120, completionTokens: 30 });
      assert.ok(r.note.length > 0);
    }
    const rows = contract.rows();
    assert.equal(rows[0]!.actor, "subagent:coder");
    assert.equal(rows[1]!.actor, "subagent:coder");
    assert.equal(rows[1]!.tokens, 150);
    assert.equal(contract.spentTokens(), 150);
    assert.equal(report.spentTokens, 150);
  });

  it("determinism: identical inputs → identical rows/results under a pinned clock", async () => {
    const run = async () => {
      const { contract } = harness({ replies: [okReply("x")] });
      const report = await contract.runBatch([task("t1", { role: "reviewer" })]);
      return { rows: contract.rows(), results: report.results };
    };
    const a = await run();
    const b = await run();
    assert.deepEqual(a, b);
  });

  it("honors the concurrency bound (observed in-flight never exceeds it) and returns input order", async () => {
    const track = { inFlight: 0, max: 0 };
    const { contract } = harness({ concurrency: 2, track, replies: [okReply("1"), okReply("2"), okReply("3"), okReply("4")] });
    const report = await contract.runBatch([task("a"), task("b"), task("c"), task("d")], { maxConcurrency: 2 });
    assert.ok(track.max <= 2, `in-flight ${track.max} must never exceed 2`);
    assert.equal(report.dispatched, 4);
    assert.equal(report.completed, 4);
    assert.equal(report.maxConcurrency, 2);
    assert.deepEqual(
      report.results.map((r) => r.id),
      ["a", "b", "c", "d"],
    );
  });
});
