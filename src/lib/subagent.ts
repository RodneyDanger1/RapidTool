/**
 * Sub-agent contract — bounded delegation with coded refusals + ledger
 * attribution (T-107.10, W7 · L4 — fixes/216t).
 *
 * Dossier `research/multiagent/107_competitors_agentic.md:335` (T-107.10:
 * "Sub-agent contract + claim lifecycle for `crew`") steals the one thing the
 * competitor set does better than a plain spawn call (§:311 "Sub-agent
 * contracts, not just spawn calls"): a delegated child gets a SELF-CONTAINED
 * brief, a DECLARED file scope, a token budget, and a claim lifecycle
 * (`claim` → `complete` | `block`, keyed by task id — the
 * `team-tools.ts:399` shape, `:195-499`) so parallel children cannot fight
 * over the same files and no delegated task can end in silence.
 *
 * This module is the contract ONLY: pure bookkeeping (no fs, no network, no
 * provider import, no prompting). Client-safe; importable under bare Node for
 * the crew seam and tests. The caller injects the actual dispatch
 * (`SubagentCompleter`); the crew's DI completer stays untouched.
 *
 * Caps — every refusal is CODED (src/lib/errors.ts registry), never silent,
 * and never a silent clamp:
 *   · `SUBAGENT_MAX_CONCURRENCY` — a batch asking for more concurrency is
 *     refused (`RT_E_VALIDATION`) BEFORE anything is claimed or dispatched.
 *   · `SUBAGENT_MAX_TASKS` — the same for batch size.
 *   · `perAgentBudgetTokens` — a task whose declared budget exceeds the
 *     contract's per-agent cap is refused (`RT_E_BUDGET_EXHAUSTED`)
 *     pre-dispatch; a reply that overspends its OWN budget is blocked with the
 *     same code AFTER the honest spend is recorded.
 *   · `SUBAGENT_MAX_BRIEF_CHARS` — an over-cap brief is refused, never
 *     truncated.
 *
 * Paper trail (AGENTS.md honesty rule 6): `rows()` is append-only, each row
 * carries the actor (`actor`), ISO timestamp (`at`) + epoch (`ts`), the code
 * on every refusal, and the tokens attributed to the row. Every task ends in
 * exactly ONE terminal row (`complete` | `block`); a task refused before claim
 * gets its terminal row WITHOUT a claim row — the ledger never shows a claim
 * for work that never started.
 *
 * W31 · T3 (R13-f14) — STATUS: DE-SCOPED FOR THIS WAVE, explicitly (the
 * register's "wire-or-de-scope"). The fan-out wiring is sequenced AFTER
 * R13-f01 (the unattended keyed journey) and R13-f11 (run-budget invest
 * semantics) because orchestration is a consumer of plan + memory (`90 §6`
 * P2-2) — fanning out before the budget/invest seam exists would mint
 * unattributed parallel spend. WIRE PLAN when the sequence opens: call
 * `createSubagentContract` from the read-only parallel stages — research
 * phases {0,7,11} and the verification legs — with ledgered dispatch
 * (per-task rows), per-task budgets (`perAgentBudgetTokens`), and a
 * deterministic merge (id-ordered `results()`, never arrival-ordered).
 *
 * TODO(R13-f14): add that call site (research {0,7,11} / verification legs)
 * once R13-f01 + R13-f11 land — this contract already satisfies what they
 * will consume; nothing here is fake, it is simply not yet wired.
 */

import { estimateTokens } from "./algorithms.ts";
import type { ErrorCode } from "./errors.ts";
import type { LlmResult } from "./llm.ts";

// ---------------------------------------------------------------------------
// Caps + vocabulary
// ---------------------------------------------------------------------------

/** Hard cap on a single batch's concurrency (default when the caller does not
 *  ask for less). A request ABOVE this is refused, never clamped. */
export const SUBAGENT_MAX_CONCURRENCY = 4;

/** Hard cap on one delegation batch's task count. */
export const SUBAGENT_MAX_TASKS = 24;

/** Default per-agent token budget (also the contract's per-agent cap unless a
 *  smaller one is configured). Sized above every crew role budget
 *  (ROLE_SPECS: planner 4096 … architect/coder 8192) so the crew seam works
 *  with the default contract. */
export const SUBAGENT_DEFAULT_BUDGET_TOKENS = 12_000;

/** A brief is the child's whole context: over this it is REFUSED. */
export const SUBAGENT_MAX_BRIEF_CHARS = 8_000;

/** One delegation unit. `id` is the ledger key (claim/complete/block), `brief`
 *  is self-contained, `scope` declares the repo-relative files the child may
 *  touch (sibling overlap inside ONE batch is refused), `budgetTokens` is the
 *  per-agent budget. */
export type SubagentTask = {
  readonly id: string;
  readonly brief: string;
  /** Free-form seat label (architect/reviewer/…) — attribution only. */
  readonly role?: string;
  /** Declared repo-relative file scope; siblings must not overlap. */
  readonly scope?: readonly string[];
  readonly budgetTokens?: number;
};

/** Token accounting attributed to one row. */
export type SubagentUsage = { promptTokens: number; completionTokens: number };

/** Structured result — `{ok, code, note}` with `code: null` on success and a
 *  coded refusal (never prose-only) on failure. */
export type SubagentResult =
  | {
      readonly ok: true;
      readonly id: string;
      readonly code: null;
      readonly note: string;
      readonly output: string;
      readonly usage: SubagentUsage;
    }
  | {
      readonly ok: false;
      readonly id: string;
      readonly code: ErrorCode;
      readonly note: string;
    };

/** One append-only attribution row. */
export type SubagentLedgerRow = {
  /** Epoch ms (JsonLog parity). */
  readonly ts: number;
  /** ISO timestamp — the honesty contract's actor + ISO paper trail. */
  readonly at: string;
  readonly taskId: string;
  /** Who acted (e.g. `subagent:architect`, or the orchestrator id). */
  readonly actor: string;
  /** The orchestrating contract that minted the row. */
  readonly orchestrator: string;
  readonly event: "claim" | "complete" | "block";
  readonly code: ErrorCode | null;
  readonly note: string;
  /** Tokens accounted to this row (0 on claim + on pre-dispatch refusals). */
  readonly tokens: number;
};

/** What one batch reports back (deterministic: `results` is INPUT-ordered). */
export type SubagentBatchReport = {
  readonly ok: boolean;
  readonly results: readonly SubagentResult[];
  /** Rows this batch appended (append-only view of the contract ledger). */
  readonly rows: readonly SubagentLedgerRow[];
  readonly dispatched: number;
  readonly completed: number;
  readonly blocked: number;
  readonly spentTokens: number;
  readonly maxConcurrency: number;
  /** Batch-level refusal (caps / hostile input) — nothing was claimed then. */
  readonly refused: { code: ErrorCode; error: string } | null;
};

export type SubagentClaimOutcome =
  | { ok: true; row: SubagentLedgerRow }
  | { ok: false; code: ErrorCode; error: string };

export type SubagentSettleOutcome = { ok: true; row: SubagentLedgerRow } | { ok: false; code: ErrorCode; error: string };

/** The injected dispatch — the ONLY thing the contract does not own. */
export type SubagentCompleter = (task: SubagentTask) => Promise<LlmResult>;

export type SubagentContract = {
  /** Attribution id of the orchestrating contract (rows carry it). */
  readonly orchestrator: string;
  readonly maxConcurrency: number;
  readonly perAgentBudgetTokens: number;
  /** Claim ONE task (crew-style lifecycle). Coded refusal on an invalid task,
   *  a reused id, or a budget above the per-agent cap. */
  claim(task: SubagentTask): SubagentClaimOutcome;
  /** Settle a claimed task as done. Coded refusal on an unknown/unclaimed/
   *  already-settled id, or when the reply overspent the task budget (then the
   *  task is BLOCKED with RT_E_BUDGET_EXHAUSTED and the honest spend kept). */
  complete(
    id: string,
    outcome: { output?: string; usage?: SubagentUsage; note?: string },
  ): SubagentSettleOutcome;
  /** Settle a claimed task as blocked (coded; default RT_E_INTERNAL). */
  block(id: string, outcome: { code?: ErrorCode; note: string }): SubagentSettleOutcome;
  /** Append-only attribution ledger. */
  rows(): readonly SubagentLedgerRow[];
  /** Every settled result so far, in settlement order. */
  results(): readonly SubagentResult[];
  /** Tokens accounted across every row. */
  spentTokens(): number;
  /** Bounded-concurrency delegation of a whole batch. */
  runBatch(
    tasks: readonly SubagentTask[],
    opts?: { maxConcurrency?: number },
  ): Promise<SubagentBatchReport>;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Numbers only, never NaN/Infinity/negatives — used by budget + usage math. */
function tokenNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** Normalize a declared scope entry for the sibling-overlap check: trimmed,
 *  forward-slashed, lowercase (Windows path case-insensitivity), no trailing
 *  slash. Exact-match equality is the overlap rule (documented, deterministic:
 *  a directory PREFIX is not treated as an overlap). */
export function normalizeScopeEntry(raw: string): string {
  return raw.trim().replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

/** Coded refusal for a requested concurrency above the hard cap (never a
 *  silent clamp). Exported for the seam's own pre-checks. */
export function subagentConcurrencyRefusal(requested: number): { code: ErrorCode; error: string } | null {
  if (!Number.isInteger(requested) || requested < 1) {
    return {
      code: "RT_E_VALIDATION",
      error: `maxConcurrency must be a positive integer — got ${String(requested)}. Refusing rather than defaulting.`,
    };
  }
  if (requested > SUBAGENT_MAX_CONCURRENCY) {
    return {
      code: "RT_E_VALIDATION",
      error: `maxConcurrency ${requested} exceeds the contract cap ${SUBAGENT_MAX_CONCURRENCY} — refusing, never silently clamping.`,
    };
  }
  return null;
}

/** Compact human lines for a row set (logs/reports) — one line per row. */
export function subagentLedgerLines(rows: readonly SubagentLedgerRow[]): string[] {
  return rows.map((r) => {
    const code = r.code ? ` · ${r.code}` : "";
    const tokens = r.tokens > 0 ? ` · ${r.tokens} tok` : "";
    return `${r.at} · ${r.event} · ${r.taskId} · ${r.actor}${code}${tokens} — ${r.note}`;
  });
}

type NormalizedTask = {
  id: string;
  brief: string;
  role: string | null;
  scope: readonly string[];
  budgetTokens: number;
};

/** Per-task validation shared by `claim` and `runBatch`. `seen` carries the
 *  batch's already-accepted ids + scope entries for the sibling checks. */
function validateTask(
  raw: unknown,
  fallbackBudget: number,
  cap: number,
  seen?: { ids: Set<string>; scope: Map<string, string> },
): { ok: true; task: NormalizedTask } | { ok: false; code: ErrorCode; error: string } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, code: "RT_E_VALIDATION", error: "task must be an object with {id, brief}" };
  }
  const rec = raw as Record<string, unknown>;
  const id = typeof rec.id === "string" ? rec.id.trim() : "";
  if (!id) {
    return { ok: false, code: "RT_E_VALIDATION", error: "task id must be a non-empty string" };
  }
  if (seen?.ids.has(id)) {
    return { ok: false, code: "RT_E_VALIDATION", error: `duplicate task id ${JSON.stringify(id)} — one id, one task` };
  }
  const brief = typeof rec.brief === "string" ? rec.brief.trim() : "";
  if (!brief) {
    return { ok: false, code: "RT_E_VALIDATION", error: `task ${JSON.stringify(id)}: brief must be a non-empty string` };
  }
  if (brief.length > SUBAGENT_MAX_BRIEF_CHARS) {
    return {
      ok: false,
      code: "RT_E_VALIDATION",
      error: `task ${JSON.stringify(id)}: brief is ${brief.length} chars — the ${SUBAGENT_MAX_BRIEF_CHARS}-char cap is a cap; refused, never truncated.`,
    };
  }
  const roleRaw = rec.role;
  if (roleRaw !== undefined && (typeof roleRaw !== "string" || !roleRaw.trim())) {
    return { ok: false, code: "RT_E_VALIDATION", error: `task ${JSON.stringify(id)}: role must be a non-empty string when present` };
  }
  const scopeRaw = rec.scope;
  const scope: string[] = [];
  if (scopeRaw !== undefined) {
    if (!Array.isArray(scopeRaw)) {
      return { ok: false, code: "RT_E_VALIDATION", error: `task ${JSON.stringify(id)}: scope must be an array of path strings` };
    }
    for (const entry of scopeRaw) {
      if (typeof entry !== "string" || !entry.trim()) {
        return { ok: false, code: "RT_E_VALIDATION", error: `task ${JSON.stringify(id)}: every scope entry must be a non-empty string` };
      }
      const norm = normalizeScopeEntry(entry);
      const owner = seen?.scope.get(norm);
      if (owner !== undefined && owner !== id) {
        return {
          ok: false,
          code: "RT_E_VALIDATION",
          error: `task ${JSON.stringify(id)}: scope ${JSON.stringify(entry)} overlaps task ${JSON.stringify(owner)} — parallel siblings must not fight over the same files`,
        };
      }
      if (!scope.includes(norm)) scope.push(norm);
    }
  }
  const budgetRaw = rec.budgetTokens;
  let budgetTokens = fallbackBudget;
  if (budgetRaw !== undefined) {
    if (typeof budgetRaw !== "number" || !Number.isFinite(budgetRaw) || budgetRaw <= 0) {
      return {
        ok: false,
        code: "RT_E_VALIDATION",
        error: `task ${JSON.stringify(id)}: budgetTokens must be a positive number — got ${JSON.stringify(budgetRaw)}`,
      };
    }
    budgetTokens = Math.floor(budgetRaw);
  }
  if (budgetTokens > cap) {
    return {
      ok: false,
      code: "RT_E_BUDGET_EXHAUSTED",
      error: `task ${JSON.stringify(id)}: budget ${budgetTokens} exceeds the per-agent cap ${cap} — refused before dispatch, never silently clamped.`,
    };
  }
  return { ok: true, task: { id, brief, role: roleOf(roleRaw), scope, budgetTokens } };
}

function roleOf(roleRaw: unknown): string | null {
  return typeof roleRaw === "string" && roleRaw.trim() ? roleRaw.trim() : null;
}

function usageOf(res: LlmResult, task: NormalizedTask): SubagentUsage {
  if (res.ok && res.usage) {
    return {
      promptTokens: tokenNumber(res.usage.promptTokens),
      completionTokens: tokenNumber(res.usage.completionTokens),
    };
  }
  // No usage reported by the transport: estimate the PROMPT side honestly and
  // never invent a completion figure.
  return { promptTokens: estimateTokens(task.brief).tokensEst, completionTokens: 0 };
}

// ---------------------------------------------------------------------------
// The contract
// ---------------------------------------------------------------------------

export function createSubagentContract(deps: {
  complete: SubagentCompleter;
  /** Real-backend pre-flight probe; absent ⇒ the caller owns the gate. */
  configured?: () => boolean;
  /** Attribution id minted onto every row. Default "subagent-contract". */
  orchestrator?: string;
  /** Default per-agent budget (and the per-agent cap). Default 12 000. */
  perAgentBudgetTokens?: number;
  /** Batch default concurrency (≤ SUBAGENT_MAX_CONCURRENCY). Default 4. */
  maxConcurrency?: number;
  /** Clock seam (tests). */
  now?: () => number;
}): SubagentContract {
  if (typeof deps?.complete !== "function") {
    // The code is attached, not just named in the prose: classifyError reads
    // `.code`, so a parenthetical alone left this refusal as RT_E_UNKNOWN.
    throw Object.assign(
      new Error("createSubagentContract: deps.complete must be a function (RT_E_VALIDATION)"),
      { code: "RT_E_VALIDATION" },
    );
  }
  const orchestrator =
    typeof deps.orchestrator === "string" && deps.orchestrator.trim()
      ? deps.orchestrator.trim()
      : "subagent-contract";
  const cap =
    deps.perAgentBudgetTokens === undefined
      ? SUBAGENT_DEFAULT_BUDGET_TOKENS
      : tokenNumber(deps.perAgentBudgetTokens);
  if (cap <= 0) {
    throw Object.assign(
      new Error("createSubagentContract: perAgentBudgetTokens must be a positive number (RT_E_VALIDATION)"),
      { code: "RT_E_VALIDATION" },
    );
  }
  const concurrencyRefusal = subagentConcurrencyRefusal(deps.maxConcurrency ?? SUBAGENT_MAX_CONCURRENCY);
  if (concurrencyRefusal) {
    throw Object.assign(
      new Error(`createSubagentContract: ${concurrencyRefusal.error} (${concurrencyRefusal.code})`),
      { code: concurrencyRefusal.code },
    );
  }
  const maxConcurrency = deps.maxConcurrency ?? SUBAGENT_MAX_CONCURRENCY;
  const now = deps.now ?? (() => Date.now());

  const ledger: SubagentLedgerRow[] = [];
  const settled: SubagentResult[] = [];
  const claims = new Map<string, NormalizedTask>();
  let spent = 0;

  function row(
    event: SubagentLedgerRow["event"],
    taskId: string,
    actor: string,
    code: ErrorCode | null,
    note: string,
    tokens = 0,
  ): SubagentLedgerRow {
    const ts = now();
    const r: SubagentLedgerRow = {
      ts,
      at: new Date(ts).toISOString(),
      taskId,
      actor,
      orchestrator,
      event,
      code,
      note,
      tokens,
    };
    ledger.push(r);
    return r;
  }

  function actorFor(task: NormalizedTask): string {
    return task.role ? `subagent:${task.role}` : `subagent:${orchestrator}`;
  }

  function claim(task: SubagentTask): SubagentClaimOutcome {
    const v = validateTask(task, cap, cap);
    if (!v.ok) return { ok: false, code: v.code, error: v.error };
    if (claims.has(v.task.id)) {
      return {
        ok: false,
        code: "RT_E_VALIDATION",
        error: `task ${JSON.stringify(v.task.id)} is already claimed — one claim per task id`,
      };
    }
    claims.set(v.task.id, v.task);
    return { ok: true, row: row("claim", v.task.id, actorFor(v.task), null, v.task.role ? `claimed (${v.task.role}) · budget ${v.task.budgetTokens}` : `claimed · budget ${v.task.budgetTokens}`) };
  }

  function settleBlocked(task: NormalizedTask, code: ErrorCode, note: string, tokens: number): SubagentSettleOutcome {
    spent += tokens;
    const r = row("block", task.id, actorFor(task), code, note, tokens);
    settled.push({ ok: false, id: task.id, code, note });
    return { ok: true, row: r };
  }

  function complete(
    id: string,
    outcome: { output?: string; usage?: SubagentUsage; note?: string },
  ): SubagentSettleOutcome {
    const task = typeof id === "string" ? claims.get(id.trim()) : undefined;
    if (!task) {
      return { ok: false, code: "RT_E_VALIDATION", error: `unknown or unclaimed task id ${JSON.stringify(id)} — claim before complete` };
    }
    if (isSettled(task.id)) {
      return { ok: false, code: "RT_E_VALIDATION", error: `task ${JSON.stringify(task.id)} is already settled — never double-settled` };
    }
    const usage: SubagentUsage = {
      promptTokens: tokenNumber(outcome.usage?.promptTokens),
      completionTokens: tokenNumber(outcome.usage?.completionTokens),
    };
    const tokens = usage.promptTokens + usage.completionTokens;
    if (tokens > task.budgetTokens) {
      return settleBlocked(
        task,
        "RT_E_BUDGET_EXHAUSTED",
        `spent ${tokens} > task budget ${task.budgetTokens} — blocked, spend kept (never a silent clamp)`,
        tokens,
      );
    }
    spent += tokens;
    const note = outcome.note ?? `${tokens} tokens`;
    const r = row("complete", task.id, actorFor(task), null, note, tokens);
    settled.push({
      ok: true,
      id: task.id,
      code: null,
      note,
      output: typeof outcome.output === "string" ? outcome.output : "",
      usage,
    });
    return { ok: true, row: r };
  }

  function block(id: string, outcome: { code?: ErrorCode; note: string }): SubagentSettleOutcome {
    const task = typeof id === "string" ? claims.get(id.trim()) : undefined;
    if (!task) {
      return { ok: false, code: "RT_E_VALIDATION", error: `unknown or unclaimed task id ${JSON.stringify(id)} — claim before block` };
    }
    if (isSettled(task.id)) {
      return { ok: false, code: "RT_E_VALIDATION", error: `task ${JSON.stringify(task.id)} is already settled — never double-settled` };
    }
    const code = outcome.code ?? "RT_E_INTERNAL";
    const note = typeof outcome.note === "string" && outcome.note.trim() ? outcome.note.trim() : `${code} (no note)`;
    return settleBlocked(task, code, note, 0);
  }

  function isSettled(id: string): boolean {
    return settled.some((s) => s.id === id);
  }

  async function runBatch(
    tasks: readonly SubagentTask[],
    opts: { maxConcurrency?: number } = {},
  ): Promise<SubagentBatchReport> {
    const requested = opts.maxConcurrency ?? maxConcurrency;
    const refuse = (code: ErrorCode, error: string): SubagentBatchReport => ({
      ok: false,
      results: [],
      rows: [],
      dispatched: 0,
      completed: 0,
      blocked: 0,
      spentTokens: 0,
      maxConcurrency: requested,
      refused: { code, error },
    });

    if (!Array.isArray(tasks)) return refuse("RT_E_VALIDATION", "tasks must be an array of SubagentTask rows");
    if (tasks.length === 0) return refuse("RT_E_VALIDATION", "refusing an empty delegation batch — never a silent no-op");
    if (tasks.length > SUBAGENT_MAX_TASKS) {
      return refuse(
        "RT_E_VALIDATION",
        `batch of ${tasks.length} exceeds the contract cap ${SUBAGENT_MAX_TASKS} — split it; never silently dropped.`,
      );
    }
    const bad = subagentConcurrencyRefusal(requested);
    if (bad) return refuse(bad.code, bad.error);

    const ids = new Set<string>();
    const scope = new Map<string, string>();
    const accepted: NormalizedTask[] = [];
    const resultsByIndex: (SubagentResult | null)[] = new Array(tasks.length).fill(null);
    let blockedCount = 0;

    // 1) Validate in input order; a refused task still gets its terminal row.
    tasks.forEach((raw, i) => {
      const v = validateTask(raw, cap, cap, { ids, scope });
      if (!v.ok) {
        const id = idOf(raw);
        row("block", id, `subagent:${orchestrator}`, v.code, v.error);
        resultsByIndex[i] = { ok: false, id, code: v.code, note: v.error };
        blockedCount += 1;
        return;
      }
      ids.add(v.task.id);
      for (const s of v.task.scope) scope.set(s, v.task.id);
      claims.set(v.task.id, v.task);
      row("claim", v.task.id, actorFor(v.task), null, `claimed · budget ${v.task.budgetTokens}`);
      accepted.push(v.task);
    });

    // 2) Config gate — one honest stop before ANY dispatch.
    if (deps.configured && !deps.configured()) {
      for (const task of accepted) {
        const note = "RT_E_LLM_NOT_CONFIGURED — the backend is not configured; nothing dispatched, nothing fabricated";
        settleBlocked(task, "RT_E_LLM_NOT_CONFIGURED", note, 0);
        const idx = indexOfTask(tasks, task.id);
        if (idx >= 0) resultsByIndex[idx] = { ok: false, id: task.id, code: "RT_E_LLM_NOT_CONFIGURED", note };
        blockedCount += 1;
      }
      return {
        ok: false,
        results: resultsByIndex.map((r, i) => r ?? refusalFor(tasks[i], "RT_E_INTERNAL", "not dispatched")),
        rows: ledger.slice(),
        dispatched: 0,
        completed: 0,
        blocked: blockedCount,
        spentTokens: 0,
        maxConcurrency: requested,
        refused: null,
      };
    }

    // 3) Bounded-concurrency dispatch (deterministic: results stay input-ordered).
    let cursor = 0;
    let dispatched = 0;
    let completed = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        const task = accepted[cursor];
        cursor += 1;
        if (!task) return;
        dispatched += 1;
        const i = indexOfTask(tasks, task.id);
        // Parent boundary fix (W7): NormalizedTask carries `role: string | null`
        // while the public completer contract takes the optional-field input
        // shape — map null back to absent at this one seam, no contract change.
        const res = await deps.complete({ ...task, role: task.role ?? undefined });
        if (!res.ok) {
          const code: ErrorCode = res.code ?? (res.reason === "not-configured" ? "RT_E_LLM_NOT_CONFIGURED" : "RT_E_INTERNAL");
          const note = res.error ?? `provider refused (${res.reason})`;
          settleBlocked(task, code, note, 0);
          resultsByIndex[i] = { ok: false, id: task.id, code, note };
          blockedCount += 1;
          continue;
        }
        const usage = usageOf(res, task);
        const settledRow = complete(task.id, { output: res.text, usage, note: `${task.role ?? "task"} turn · ${usage.promptTokens + usage.completionTokens} tok` });
        if (!settledRow.ok) {
          resultsByIndex[i] = { ok: false, id: task.id, code: settledRow.code, note: settledRow.error };
          blockedCount += 1;
          continue;
        }
        const last = settled[settled.length - 1]!;
        resultsByIndex[i] = last;
        if (last.ok) completed += 1;
        else blockedCount += 1;
      }
    };
    await Promise.all(Array.from({ length: Math.min(requested, accepted.length) }, () => worker()));

    return {
      ok: blockedCount === 0,
      results: resultsByIndex.map((r, i) => r ?? refusalFor(tasks[i], "RT_E_INTERNAL", "not dispatched")),
      rows: ledger.slice(),
      dispatched,
      completed,
      blocked: blockedCount,
      spentTokens: spent,
      maxConcurrency: requested,
      refused: null,
    };
  }

  return {
    orchestrator,
    maxConcurrency,
    perAgentBudgetTokens: cap,
    claim,
    complete,
    block,
    rows: () => ledger.slice(),
    results: () => settled.slice(),
    spentTokens: () => spent,
    runBatch,
  };
}

function idOf(raw: unknown): string {
  if (raw !== null && typeof raw === "object") {
    const id = (raw as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return "<no-id>";
}

function indexOfTask(tasks: readonly unknown[], id: string): number {
  return tasks.findIndex((t) => idOf(t) === id);
}

function refusalFor(raw: unknown, code: ErrorCode, note: string): SubagentResult {
  return { ok: false, id: idOf(raw), code, note };
}
