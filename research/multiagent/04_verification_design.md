# RapidTool — 04 · Verification Design: A Zero-Hallucination Verify-Fix Loop

**File:** `research/multiagent/04_verification_design.md`
**Date:** 2026-09-05 · **Author:** Pro DESIGN agent (read-only source audit + web research)
**Repo root:** `C:/Users/mnril/Desktop/RapidTool Main` (NOT a git repo)
**Audience:** Pro build agents implementing a logically-correct, evidence-backed code pipeline that moves RapidTool from "scaffold generator" to "produces TESTED code".

This document is a **build-ready design**: exact module paths, TypeScript signatures, JSON schemas, integration points, and a safety budget. It contains **no fabricated code** — only signatures (type-level spec) and clearly-marked pseudocode. Every external concept is cited.

---

## 0. Executive summary

RapidTool's P6 today is a *deterministic template generator*: `buildPhase6Module()` emits an engine-authored module, `runGenerated()` self-tests it synchronously, and the DoD gate `runGate()` records a pass/fail. That path **cannot hallucinate** (by construction) but it also **cannot produce real, tested application code** — it always emits the same template.

The design below adds a **verify-fix loop** on top of the existing building blocks, using only primitives already in the tree:

1. **Generate** a module (future P6, DeepSeek).
2. **Generate a test oracle** (DeepSeek, `json: true`, structured `{ tests: [...] }`).
3. **Run** the module against the oracle through the **existing bounded Node runner** (`node-runner.server.ts`), via an engine-authored deterministic harness.
4. **Parse** the machine-printed pass/fail result (the runner decides, never the LLM).
5. **Feed failures back** to DeepSeek to emit a corrected full source (bounded `N` iterations).
6. **Record a final Definition-of-Done verdict** with an `evidenceHash` that covers source + oracle + results.

The core honesty invariant is: **a module is never labeled `"tested"` unless the bounded runner actually executed the harness and returned pass.** The deterministic template remains the honest floor/fallback; the verify loop is what makes LLM-authored code *safe to promote*.

---

## 1. Grounding — what already exists (verified against the tree)

The loop is assembled from parts that are already present and tested. Exact current signatures:

### 1.1 `src/lib/sandbox.ts` — deterministic self-test + denylist
- `runGenerated(source: string): SandboxResult` — **sync, page-global** gate. Accepts ONLY template modules (`source.startsWith("const JOBS = [")` && contains `function test_no_skip`); anything else returns `{ok:false, detail:"non-template source requires runSandboxed()"}`. Scans code-only tokens via `maskLiteralsAndComments()` against a `FORBIDDEN` denylist (`process|require|globalThis|window|self|fetch|WebSocket|XMLHttpRequest|eval|Function|import|document|localStorage|indexedDB`), then runs `test_happy` + `test_no_skip` in a `new Function`.
- `healSource(source, error)` — deterministic self-heal (only re-adds a missing `test_happy`).
- `buildPhase6Module(args: Phase6ModuleArgs): string` — deterministic template; dynamic inputs are JSON-escaped string literals only.
- `sandboxClaim(s): string` — **honesty claim** string used in P4/P6 artifacts.
- `runSandboxed(source, opts?): Promise<SandboxResult>` — **real Worker isolate** (async) with throwing network stubs (`fetch`/`WebSocket`/`XMLHttpRequest`) and a `terminate()` wall-clock timer. Documented as *the only legal executor for non-template source*.

### 1.2 `src/lib/node-runner.server.ts` — bounded local exec (Node host)
- `runNodeBounded(code: string, opts?: {timeoutMs?}): Promise<NodeRunResult>` — spawns `node -e <code>` with: wall-clock timeout + tree-kill (`taskkill /T /F` on win32), `maxBuffer` 1 MB + `MAX_OUTPUT` 1 MB slice, fresh `mkdtempSync` cwd, scrubbed proxy env (`NO_PROXY="*"`). **Honest label: "bounded runner, NOT a security sandbox."** Server-only.
- `runnerAvailable(): boolean`.

### 1.3 `src/lib/exec.ts` — client-facing wrapper
- `runCode(code, opts?): Promise<ExecResult>` — thin `createServerFn` wrapper over `runNodeBounded`, with a `runner` dependency-injection hook for tests. `ExecResult = { ok:true; stdout; stderr; durationMs; exitCode } | { ok:false; reason:"not-configured"|"timeout"|"error"|"refused"; error? }`.

### 1.4 `src/lib/deepseek.server.ts` — structured LLM output
- `completeDeepSeek(prompt, opts): Promise<LlmResult>` — supports `opts.json === true` → `response_format: {type:"json_object"}`. Returns honest `{ok:false, reason:"not-configured"}` when `DEEPSEEK_API_KEY` absent. Two tiers: `deepseek-v4-flash` (thinking off, 20s timeout) and `deepseek-v4-pro` (thinking on, `reasoning_effort:"high"`, 60s timeout).
- `isDeepSeekConfigured(): boolean`.

### 1.5 `src/lib/llm.ts` + `src/lib/llm-tasks.ts` — client contract + DI task pattern
- `complete(prompt, opts): Promise<LlmResult>` — client-facing `createServerFn` wrapper (never import `deepseek.server.ts` directly).
- `createLlmTasks(completeFn)` → `{ extractConstraints, interpretFeedback, phaseNarrative }` — **the house dependency-injection pattern** for testable LLM task helpers. `parseConstraintList(text)` is the model for tolerant-but-strict JSON parsing. The `Completer` type is `(prompt, opts?: {model?, system?, maxTokens?, json?}) => Promise<LlmResult>`.

### 1.6 `src/lib/dod.ts` — machine-checkable Definition-of-Done gate
- `runGate(project, phase): { pass; unmet: GateItem[]; evidenceHash }` — deterministic probes; `evidenceHash = fnv1a(sorted "id:pass|fail" pairs)` (reproducible across equivalent states). P6 gate currently: `p6-test` (`lastTest.ok===true`), `p6-source` (non-empty `generatedSource`), `p6-artifact`.
- `gateArtifact(phase, r)` — renders a verdict artifact.

### 1.7 `src/lib/engine.ts` — the async seams
- `synthesizePhase(project, phase, ctx?)` — deterministic P0–P12 (P6 = case 6, above).
- `runPhaseAsync(project, phase)` — async entry: `fetchResearch` for P0/P7/P11 + LLM narratives; everything else is exactly `applyPhaseResult`.
- `runP6Real(project): Promise<{ok, result: ExecResult|null}>` — **the existing P6 real-execution seam**: runs `project.generatedSource` once through `runCode`; returns `{ok:false, result:null}` on not-configured/absent/throw. Does NOT alter sync P6.
- `applyPhaseResult`, `recordGateInline`, `approveHitl`, `rejectHitl`, `unlockRetry`.

### 1.8 `src/lib/types.ts` — data model hooks
- `Project.lastTest: { ok: boolean; detail: string } | null` — the single "did it pass" field the gate reads.
- `Project.oracle: OracleTest[]` — an **existing but unused** test-oracle shape: `OracleTest = { id; name; given; expect; job }`.
- `Project.generatedSource: string`; `PhaseRecord.gate?: { passed; unmet; evidenceHash; checkedAt }`.
- `ArtifactKind` union has `"code"`, `"gate"`, `"docs"`, … but **no `"verify"` kind yet**.

### 1.9 `src/lib/report-intake.ts` — the honest external-ingest precedent
- `validateReport` / `applyReport` — validate-before-apply, append-only, and a load-bearing footer: `"> external report — unverified by engine"`. This is the exact labeling discipline the verify loop inherits.

**Takeaway:** nothing new needs to be invented for *execution* (bounded runner exists), *structured LLM output* (`json:true` exists), *evidence hashing* (`fnv1a` + `runGate` pattern exists), or *honest fallback* (`{ok:false, reason:"not-configured"}` is house style). The verify loop is orchestration + schemas + harness + honesty labels.

---

## 2. Prior art (what is borrowed, and why)

| Concept | Source | What RapidTool borrows |
|---|---|---|
| **Test-first flow engineering** | AlphaCodium — Ridnik et al., *Code Generation with AlphaCodium: From Prompt Engineering to Flow Engineering* (https://arxiv.org/abs/2401.08500) | Generate an initial solution, then **generate tests independently**, run, iterate; fix the *code*, never "fix" a failing test to match the code. |
| **Dual execution agreement** | CodeT — Chen et al., *CodeT: Code Generation with Generated Tests* (https://arxiv.org/abs/2207.10397) | Use generated tests as an *executable oracle* and score the code by real execution, not by model self-report. |
| **Verbal reflection loop** | Reflexion — Shinn et al., *Reflexion: Language Agents with Verbal Reinforcement Learning* (https://arxiv.org/abs/2303.11366) | Maintain an episodic buffer of *what failed and why* across iterations, feed it back into the next attempt (91% pass@1 on HumanEval). |
| **Iterative self-feedback** | Self-Refine — Madaan et al., *Self-Refine: Iterative Refinement with Self-Feedback* (https://arxiv.org/abs/2303.17651) | Same model generates → critiques → refines, iteratively; ~20% abs. gain with a single model. |
| **Execution feedback for debugging** | Self-Debugging — Chen et al., *Teaching LLMs to Self-Debug* (https://arxiv.org/abs/2304.05128) | Feed *real execution results + error messages* (not the model's opinion) back to drive the fix. |
| **Verification by execution** | LEVER — Ni et al., *Learning to Verify Language-to-Code Generation with Execution* (https://arxiv.org/abs/2302.08468) | The verifier signal is *program execution outcomes*, decoupled from the generator. |
| **External-tool critique** | CRITIC — Gou et al., *CRITIC: LLMs Can Self-Correct with Tool-Interactive Critiquing* (https://arxiv.org/abs/2305.11738) | Cross-check output against an *external tool* (here: the bounded runner) rather than trusting self-critique. |
| **Independent judge** | Zheng et al., *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena* (https://arxiv.org/abs/2306.05685) | A separate *evaluator* pass for the semantic-correctness gap that execution cannot catch (basis for Enhancement E2). |
| **Grounding against real APIs** | De-Hallucinator — Eghbali & Pradel, *Mitigating LLM Hallucinations in Code Generation via Iterative Grounding* (https://arxiv.org/abs/2401.01701) | Inject the *permitted surface* (allowed built-ins, the entry contract) as ground context so the model cannot invent APIs (basis for Enhancement E4). |

**Design consequence:** the loop must treat **the runner's output as the only source of truth** for "pass", and the LLM only as a *proposer* (of modules, oracles, and fixes). That separation is what makes the pipeline zero-hallucination *by construction*.

---

## 3. The Verify-Fix Loop (core design)

### 3.1 The entry contract

LLM-authored P6 modules must satisfy a minimal, testable contract (the oracle targets this):

- A single pure entrypoint, default name **`synthesize`** (matches the existing P6 template so the deterministic self-test and the LLM path share one contract). The oracle's `entry` field names it explicitly, so the harness never guesses.
- `synthesize(input: object) -> object` — pure, no I/O, no timers, no randomness; may **throw** on invalid input (the oracle can assert a throw).
- No imports, no `require`, no network. (Enforced defensively by the harness stubs, §6; the real boundary remains the bounded runner + Worker sandbox.)

### 3.2 Stage diagram

```
                    ┌─────────────────────────────────────────────┐
  brief + lattice   │  STAGE A  generate module (DeepSeek pro)      │
  ─────────────────▶│  → candidate source S₀                        │
                    └──────────────────────────────┬──────────────┘
                                                   │ S₀
                    ┌──────────────────────────────▼──────────────┐
                    │  STAGE B  generate TEST ORACLE (DeepSeek,   │
                    │            json:true) → { tests:[...] } O    │
                    └──────────────────────────────┬──────────────┘
                                                   │ (S₀, O)
                    ┌──────────────────────────────▼──────────────┐
                    │  STAGE C  run harness(S₀, O) through         │
                    │            runNodeBounded()  → VerifyOutcome  │
                    └──────────────┬───────────────────────────────┘
                        pass? ────┴── fail?
                         │              │
                         ▼              ▼
              ┌────────────────┐  ┌───────────────────────────────┐
              │ STAGE D  DONE  │  │ STAGE E  fix: feed failures +  │
              │ label "tested" │  │ Sᵢ + O back to DeepSeek (json: │
              │ + evidenceHash │  │ true) → Sᵢ₊₁; i++; if i<N goto C│
              └────────────────┘  └───────────────┬───────────────┘
                                                   │ budget exhausted / error
                                                   ▼
                                      ┌──────────────────────────────┐
                                      │ STAGE F  honest fallback:      │
                                      │ keep deterministic template,   │
                                      │ label "self-test" (never       │
                                      │ "tested"); DoD still runnable  │
                                      └──────────────────────────────┘
```

### 3.3 Loop pseudocode (spec — not compiled code)

```
// verify.server.ts — runVerifyLoop (pseudocode)
async function runVerifyLoop(spec: VerifySpec): Promise<VerifyLoopResult> {
  if (!isDeepSeekConfigured())  return { ok:false, reason:"not-configured" }
  if (!runnerAvailable())       return { ok:false, reason:"not-configured" }

  const N       = clamp(spec.maxIterations ?? 3, 1, 5)
  const timeout = clamp(spec.timeoutMs     ?? 30_000, 5_000, 60_000)
  const history = []                       // episodic failure buffer (Reflexion)

  let source = spec.source                  // from P6 (or prior iteration)

  // STAGE B: oracle is generated ONCE (independent of source, AlphaCodium style)
  const oracle = await generateTestOracle(spec)      // json:true
  if (!oracle.ok || oracle.tests.length === 0)
      return { ok:false, reason:"no-tests", error: oracle.error }
  if (oracle.tests.length > MAX_TESTS)               // cap, §7
      oracle.tests = oracle.tests.slice(0, MAX_TESTS)

  for (let i = 0; i < N; i++) {
    // STAGE C: run the engine-authored harness through the bounded runner
    const harness = buildHarness(source, oracle)     // deterministic, §6
    const run = await runNodeBounded(harness, { timeoutMs: timeout })
    if (!run.ok) {                                   // timeout / error / refused
      history.push({ iter:i, kind:"runner", detail: run.error })
      continue                                       // do NOT fabricate a pass
    }
    const outcome = parseRunnerOutcome(run.stdout)   // machine-printed result
    if (!outcome) {
      history.push({ iter:i, kind:"unparseable" })
      continue
    }
    if (outcome.ok) {
      return {
        ok:true, source, outcome, iterations:i+1,
        evidenceHash: evidenceHashOf(source, oracle, outcome),   // §7.3
        history,
      }
    }

    // STAGE E: fix — feed ONLY real failures + source + oracle back
    const patch = await generateCodePatch({
      spec, source, oracle,
      failures: outcome.results.filter(r => !r.ok),   // never fabricate failures
    })                                                // json:true
    if (!patch.ok) {
      history.push({ iter:i, kind:"fixer", detail: patch.error })
      break                                          // no blind identical re-run
    }
    source = patch.source                            // FULL replacement (no diff ambiguity)
    history.push({ iter:i, kind:"fixed", summary: patch.summary,
                   failed: outcome.results.filter(r=>!r.ok).map(r=>r.id) })
  }

  return { ok:false, reason:"max-iterations", history, source }
}
```

**Invariants (the zero-hallucination contract, enforced by control flow, not by trust):**
1. **The LLM never declares "pass".** Pass/fail comes only from `parseRunnerOutcome(run.stdout)`, where `run.stdout` is produced by the engine-authored harness executing on the bounded runner.
2. **The oracle is fixed before the fix loop.** The fixer may not edit the oracle (this is AlphaCodium's explicit anti-pattern — "you don't learn anything when you fix a test"; you fix the *code*).
3. **Failures are replayed verbatim**, not re-summarized into a plausibly-correct retelling, when fed to the fixer.
4. **No blind identical re-run** (mirrors `engine.ts`'s existing `heal.noop` / B-07 discipline): if the fixer returns nothing usable, the loop breaks.
5. **Every exit path is honest.** `not-configured`, `max-iterations`, `error`, `no-tests` are all explicit, and the caller falls back to the deterministic path.

---

## 4. Structured-output schemas (DeepSeek `json:true`)

Three JSON documents exist in the loop. Two are **LLM-authored** (validated strictly); one is **machine-authored** (the runner's output).

### 4.1 `TestOracle` (LLM-authored, `json:true`, flash tier is enough)

```jsonc
{
  "schema": "rapidtool.test-oracle@1",
  "entry": "synthesize",            // module entrypoint under test
  "tests": [
    {
      "id": "t01",
      "name": "happy path returns ok and echoes the job",
      "kind": "returns",            // "returns" | "throws"
      "given": { "name": "ACME", "phase": 6, "job": "dispatch" },
      "expect": { "ok": true, "job": "dispatch" }
    },
    {
      "id": "t02",
      "name": "unknown job is rejected",
      "kind": "throws",             // assert the entrypoint THROWS
      "given": { "name": "x", "phase": 6, "job": "nope" },
      "expectError": "unknown job"  // substring the thrown message must contain
    }
  ]
}
```

Validation rules (`parseTestOracle`, tolerant-but-strict like `parseConstraintList`):
- `schema` must be `"rapidtool.test-oracle@1"` (version pin — unknown version → reject).
- `entry` must match `^[A-Za-z_$][A-Za-z0-9_$]*$` (identifier — blocks injection via the entry name).
- `tests` non-empty array, `id` unique non-empty, `kind ∈ {returns, throws}`.
- `kind === "returns"` ⇒ `expect` present (deep-equal target); `kind === "throws"` ⇒ `expectError` present (non-empty string).
- Reject any test whose `given`/`expect` stringifies to a forbidden-primitive usage (reuse `sandbox.ts`'s denylist spirit — see §7.4).
- Return `null` (→ honest `"no-tests"` / `"error"`) on any structural violation.

### 4.2 `CodePatch` (LLM-authored, `json:true`, pro tier — needs reasoning)

```jsonc
{
  "schema": "rapidtool.code-patch@1",
  "source": "// FULL corrected module source (not a diff)\nfunction synthesize(input) { ... }",
  "summary": "Reject unknown jobs before validating phase; t02 now throws.",
  "fixedTestIds": ["t02"]
}
```

Validation rules (`parseCodePatch`):
- `schema` must be `"rapidtool.code-patch@1"`.
- `source` is a **complete, self-contained module source** (not a diff). This is a deliberate anti-hallucination choice: diff application (line numbers, context matching) is itself a common failure mode. Full-source replacement is trivially deterministic to apply.
- `source` must be non-empty, ≤ a byte cap (§7.2), and must define the oracle's `entry`.
- `summary` non-empty, ≤ 400 chars (kept short to cap prompt cost).
- `fixedTestIds` ⊆ oracle test ids (a claim, recorded for the evidence trail — it is **not** trusted to mark anything pass).

### 4.3 `VerifyOutcome` (machine-authored by the harness — NEVER by the LLM)

```jsonc
{
  "schema": "rapidtool.verify-outcome@1",
  "ok": false,
  "total": 2,
  "passed": 1,
  "results": [
    { "id": "t01", "ok": true,  "detail": "pass" },
    { "id": "t02", "ok": false, "detail": "expected throw /unknown job/ but returned {\"ok\":true}" }
  ],
  "durationMs": 214,
  "exitCode": 0
}
```

This document is produced by the engine-authored harness (`buildHarness`), printed on a single marker line, and parsed by `parseRunnerOutcome(stdout)`. The LLM is never asked to produce it, so it cannot hallucinate a pass.

---

## 5. The test harness (engine-authored, deterministic)

`buildHarness(source, oracle): string` produces a single self-contained Node program that the existing `runNodeBounded` can run verbatim (no new execution primitive). It is the **trusted** half of the pipeline; the module + oracle are the **untrusted** half.

What it does (pseudocode spec):

```
buildHarness(source, oracle):
  emit marker = "__RAPIDTOOL_RESULT__"
  program = `
    // 1) DEFENSE STUBS (best-effort, mirrors sandboxWorkerSource):
    //    run the module inside a Function scope that shadows Node globals
    //    require, process, fetch, WebSocket, XMLHttpRequest, setTimeout,
    //    setInterval, console → throwing stubs / captured console.
    //    (Honest label: this is defense-in-depth, NOT a security sandbox.)

    // 2) LOAD MODULE:
    //    run `source` inside that shadowed scope, capture its `entry` fn.

    // 3) RUN ORACLE:
    //    for each test in oracle.tests:
    //      try:
    //        out = entry(test.given)
    //        if kind=="returns": pass = deepEqual(out, test.expect)
    //        if kind=="throws":  pass = false   (did not throw as expected)
    //      catch e:
    //        if kind=="throws":  pass = message(e).includes(test.expectError)
    //        else:               pass = false
    //      collect { id, ok: pass, detail }

    // 4) EMIT RESULT on one line, then exit:
    //    console.log(marker + JSON.stringify({
    //      schema:"rapidtool.verify-outcome@1",
    //      ok: all(pass), total, passed, results, durationMs, exitCode: 0
    //    }))
  `
  return program
```

Design notes:
- **`deepEqual`** is the harness's own structural comparison (JSON-stable). It is engine-authored and unit-testable in isolation.
- **Deterministic ordering**: tests run in oracle order; `results` preserve order so `evidenceHashOf` is stable.
- **Single-line marker output** makes `parseRunnerOutcome` trivially robust: it scans `stdout` for the marker line, then `JSON.parse`s the suffix; the rest of stdout/stderr is ignored except as diagnostics.

---

## 6. Honesty contract (load-bearing)

This is the part that makes the loop **zero-hallucination**. It extends the existing honesty language (`source:"illustrative"` vs `"cited"`; `sandboxClaim()`; the `report-intake` "unverified by engine" footer).

### 6.1 The label lattice

Every generated module carries exactly one of three labels, recorded on `Project.lastTest` and derivable from the artifact trail:

| Label | Meaning | Set when | Gate effect |
|---|---|---|---|
| `illustrative` | deterministic template / placeholder; **not** a live product of a run | `buildPhase6Module` produced it and nothing ran it | never blocks, but never claims testing |
| `self-test` | deterministic sync self-test passed (`runGenerated` / `runSandboxed`) | the engine-template self-test returned `ok` | satisfies existing `p6-test` gate (the floor) |
| `tested` | the bounded runner executed the harness against a generated oracle and **returned pass** | `runVerifyLoop` returned `{ok:true, evidenceHash}` | satisfies `p6-test` **and** the new `p6-verified` gate (§8.3) |

**The one-way invariant:** a module is labeled `tested` **if and only if** `runVerifyLoop` returned `ok:true`. No other code path may set it. There is no "tested by implication", no "tests would pass", no "looks correct".

### 6.2 `lastTest` shape upgrade (types.ts)

```ts
// proposed (superset of the current { ok; detail }):
lastTest: {
  ok: boolean;
  detail: string;
  label: "illustrative" | "self-test" | "tested";   // NEW — always present
  evidenceHash?: string;      // present ONLY when label === "tested"
  iterations?: number;        // fix-iterations used (tested only)
  checkedAt?: number;         // epoch ms
} | null
```

The existing `{ ok, detail }` fields are preserved, so the current `p6-test` probe (`lastTest.ok === true`) keeps working unchanged — the upgrade is additive.

### 6.3 The evidence hash

```ts
// pseudocode — mirrors runGate()'s FNV-1a evidence discipline
function evidenceHashOf(source, oracle, outcome): string {
  return String(fnv1a([
    "verify@1",
    fnv1a(source),                    // module bytes
    fnv1a(stableStringify(oracle)),   // oracle (sorted keys)
    outcome.results.map(r => `${r.id}:${r.ok ? "pass" : "fail"}`).join("|"),
  ].join("|")))
}
```

Any change to the source, the oracle, or any single test result flips the hash — so a recorded `tested` verdict is re-verifiable later, exactly like `PhaseRecord.gate.evidenceHash` already is.

### 6.4 What the loop must NEVER claim
- Never say "tested" when `runNodeBounded` returned `timeout`/`error`/`refused`/`not-configured` (fall through to fallback, §8.1).
- Never say "passed N tests" unless `outcome.results` literally contains N `ok:true` entries from the runner.
- Never let the fixer's `fixedTestIds` claim substitute for a real pass (it is recorded as provenance only).
- Never run LLM-authored source through the **sync page-global** `runGenerated()` path — that path is for the deterministic template only; LLM code goes through the bounded runner / Worker sandbox (this is already `sandbox.ts`'s stated rule, now enforced end-to-end).

---

## 7. New module signatures

Two new files, mirroring the existing client/server split (`llm.ts` ⇄ `deepseek.server.ts`, `exec.ts` ⇄ `node-runner.server.ts`).

### 7.1 `src/lib/verify.server.ts` — server-only orchestration (raw layer)

Imports `completeDeepSeek` (deepseek.server.ts) and `runNodeBounded` (node-runner.server.ts) directly; never imported from client code.

```ts
// ---- types (spec) ----
export type OracleCase = {
  id: string;
  name: string;
  kind: "returns" | "throws";
  given: unknown;
  expect?: unknown;          // kind:"returns"
  expectError?: string;      // kind:"throws"
};
export type TestOracle = {
  schema: "rapidtool.test-oracle@1";
  entry: string;
  tests: OracleCase[];
};
export type CodePatch = {
  schema: "rapidtool.code-patch@1";
  source: string;            // FULL replacement module source
  summary: string;           // ≤400 chars
  fixedTestIds: string[];
};
export type VerifyOutcome = {
  schema: "rapidtool.verify-outcome@1";
  ok: boolean;
  total: number;
  passed: number;
  results: { id: string; ok: boolean; detail: string }[];
  durationMs: number;
  exitCode: number;
};
export type VerifySpec = {
  name: string;              // project name (grounding)
  jobs: string[];            // lattice jobs (grounding)
  brief: string;             // brief slice (grounding)
  source: string;            // candidate module source
  maxIterations?: number;    // default 3, hard cap 5
  timeoutMs?: number;        // default 30_000, cap 60_000
};
export type VerifyLoopResult =
  | { ok: true;  source: string; outcome: VerifyOutcome; iterations: number;
      evidenceHash: string; history: VerifyEvent[] }
  | { ok: false; reason: "not-configured" | "max-iterations" | "no-tests" | "error";
      error?: string; source?: string; history?: VerifyEvent[] };
export type VerifyEvent =
  | { iter: number; kind: "runner"; detail: string }
  | { iter: number; kind: "unparseable" }
  | { iter: number; kind: "fixer"; detail: string }
  | { iter: number; kind: "fixed"; summary: string; failed: string[] };

// ---- pure, exported for unit testing ----
export function buildHarness(source: string, oracle: TestOracle): string;      // §5
export function parseRunnerOutcome(stdout: string): VerifyOutcome | null;      // marker-line parse
export function parseTestOracle(text: string): TestOracle | null;              // §4.1 validation
export function parseCodePatch(text: string): CodePatch | null;                // §4.2 validation
export function evidenceHashOf(source: string, oracle: TestOracle,
                               outcome: VerifyOutcome): string;                // §6.3

// ---- LLM-backed (json:true), honest result shapes ----
export async function generateTestOracle(
  spec: VerifySpec,
): Promise<{ ok: true; oracle: TestOracle } | { ok: false; reason: "not-configured" | "error"; error?: string }>;

export async function generateCodePatch(
  input: { spec: VerifySpec; source: string; oracle: TestOracle;
           failures: VerifyOutcome["results"] },
): Promise<{ ok: true; patch: CodePatch } | { ok: false; reason: "not-configured" | "error"; error?: string }>;

// ---- the loop ----
export async function runVerifyLoop(spec: VerifySpec): Promise<VerifyLoopResult>;   // §3.3
```

Prompt notes (build-ready):
- `generateTestOracle` prompt must instruct the model to derive tests from the **brief + jobs only** (independent of `source`), to return the `@1` schema verbatim, and to include at least one happy-path `returns` and one failure `throws` case. Use `model: "deepseek-v4-flash"` + `json: true` (speed; oracle correctness is cross-checked by execution, not by the model's confidence).
- `generateCodePatch` prompt receives the **verbatim `outcome.results` JSON** for failing cases + the current `source` + the oracle; it must return the `@1` schema with a **full corrected `source`** and a `summary`. Use `model: "deepseek-v4-pro"` + `json: true` (reasoning effort helps the fix).

### 7.2 `src/lib/verify.ts` — client-facing typed contract (DI factory)

Mirrors `llm-tasks.ts` exactly: pure parsers + a `createVerifier(deps)` factory so tests can inject stubs; default export binds the real `complete` (llm.ts) and `runCode` (exec.ts).

```ts
import type { Completer } from "./llm-tasks.ts";     // reuse the house Completer type

export type RunnerFn = (code: string, opts?: { timeoutMs?: number }) => Promise<ExecResult>;

export function createVerifier(deps: {
  complete: Completer;      // injected → complete() in prod, stub in tests
  runCode: RunnerFn;        // injected → runCode() in prod, stub in tests
  runnerAvailable: () => boolean;
}) {
  return {
    generateTestOracle(spec): Promise<...>,   // delegates to verify.server.ts via complete(json:true)
    generateCodePatch(input): Promise<...>,
    runVerifyLoop(spec): Promise<...>,        // delegates to verify.server.ts runVerifyLoop
  };
}

// Default bindings wired to the real DeepSeek client contract + real runner.
export const verifier = createVerifier({ complete, runCode, runnerAvailable });
```

(The server round-trip goes through `complete()`/`runCode()`'s existing `createServerFn` wrappers — no new network surface, no key handling in client code.)

### 7.3 Caps & constants (single source of truth in `verify.server.ts`)

```ts
export const VERIFY_LIMITS = {
  MAX_TESTS: 20,            // oracle test count cap
  MAX_SOURCE_BYTES: 64_000, // module + patch source cap
  MAX_ORACLE_BYTES: 16_000,
  MAX_ITERATIONS: 5,        // hard ceiling (default 3)
  DEFAULT_TIMEOUT_MS: 30_000,
  MAX_TIMEOUT_MS: 60_000,
} as const;
```

---

## 8. Integration points

### 8.1 `engine.ts` — `runP6Real` becomes the verify-loop seam

**Today:** `runP6Real(project)` runs `project.generatedSource` once through `runCode` and returns `{ok, result}` — a fire-and-forget real check that does not change sync P6.

**Proposed:** `runP6Real` is extended (behind `runPhaseAsync`'s existing config-gated, try/caught pattern) to drive the verify loop and, **only on a real pass**, promote the module and its evidence:

```ts
// pseudocode — replaces the current runP6Real body
export async function runP6Real(project: Project): Promise<{
  ok: boolean;
  result: ExecResult | null;
  verify?: VerifyLoopResult;          // NEW: full provenance when the loop ran
}> {
  const source = project.generatedSource;
  if (!source) return { ok: false, result: null };

  // 1) deterministic floor FIRST (unchanged behavior): real self-test via runCode
  //    (existing path — keep it so the "self-test" label still has a live source)

  // 2) NEW: only when DeepSeek + runner are configured, run the verify loop
  if (await llmStatus().then(s => s.configured)) {
    const v = await verifier.runVerifyLoop({
      name: project.name,
      jobs: project.lattice?.jobs ?? [],
      brief: project.brief,
      source,
    });
    if (v.ok) {
      // promote: source = v.source (the TESTED revision), lastTest.label = "tested",
      // lastTest.evidenceHash = v.evidenceHash, iterations = v.iterations,
      // and emit a "verify" artifact (§8.4).
      return { ok: true, result: null, verify: v };
    }
    // v not ok → honest fallback; deterministic template + "self-test" stand.
    return { ok: false, result: null, verify: v };
  }
  return { ok: false, result: null };   // unchanged not-configured fallback
}
```

**Key rule:** the promotion (label `"tested"`, evidence hash, source swap) happens **only inside the `if (v.ok)` branch**. Every other path leaves the deterministic floor intact.

### 8.2 `engine.ts` — P6 `synthesizePhase` / `applyPhaseResult`

- `synthesizePhase` (case 6) keeps producing the deterministic template + `lastTest` from `runGenerated` **unchanged** (the sync floor must never regress). Its `lastTest` gains `label: "self-test"`.
- `applyPhaseResult` (and the `runPhaseAsync` P6 branch) call the new `runP6Real`, and when it returns `verify.ok`, apply the promotion described above (source swap + label + evidence + verify artifact + log events `verify.pass` / `verify.fail` / `verify.fallback`). This is the same seam where `runPhaseAsync` already layers real research artifacts.
- The HITL semantics are **preserved and tightened**: a module that is only `"self-test"` (not `"tested"`) keeps the existing failing-sandbox `forceHuman` rule; a `"tested"` module can clear the `forceHuman` gate but is still subject to the normal P6 HITL when `schedule.extraHitl` includes 6.

### 8.3 `dod.ts` — `runGate` gains a `p6-verified` probe (additive)

```ts
// proposed addition to DOD[6] — does NOT break the deterministic path
{
  id: "p6-verified",
  criterion: "Module is runner-verified 'tested' with a non-empty evidence hash",
  probe: (p) =>
    p.lastTest != null &&
    p.lastTest.label === "tested" &&
    typeof p.lastTest.evidenceHash === "string" &&
    p.lastTest.evidenceHash.length > 0,
}
```

**Crucial:** this probe is **not** required for the P6 gate to pass when the project is running in deterministic mode — the existing `p6-test` (`lastTest.ok`) remains the floor. The `p6-verified` probe is how the *higher bar* ("produces TESTED code, not just self-tested code") is encoded. A build agent that wants "tested or block" can *require* `p6-verified` via a project setting (`schedule.extraHitl`/notes), while default autopilot keeps the deterministic floor. (Exact policy toggling is left to the implementing agent; the probe is the hook.)

### 8.4 `types.ts` — additive model changes

1. `lastTest` shape upgrade (§6.2) — superset of the current `{ ok, detail }`.
2. `ArtifactKind` union: add `"verify"` — so the loop's evidence (outcome + hash + history) persists as a normal artifact alongside the existing "Sandbox result" JSON artifact, via the existing `art()` helper.
3. Optional `Project.verify?: { status: "pass"|"fail"|"fallback"; evidenceHash?: string; iterations?: number; checkedAt: number } | null` — the durable field `runGate`/`recordGateInline` read for the `p6-verified` probe.

### 8.5 Log events (append-only, `JsonLog`)

`verify.pass` (level info), `verify.fail` (warn), `verify.fallback` (warn, with reason), `verify.iteration` (info, per fix round). These feed the existing memory/log ledger so the verification trail is part of the packet.

---

## 9. Safety budget

Every number is a hard ceiling, single-sourced in `VERIFY_LIMITS` (§7.3).

| Axis | Bound | Mechanism (already in tree) |
|---|---|---|
| **Wall-clock timeout** | 30 s default, 60 s cap, per run | `runNodeBounded` timeout + `treeKill`/`SIGKILL` (node-runner.server.ts) |
| **Output caps** | 1 MB `maxBuffer`, 1 MB kept | `runNodeBounded` `maxBuffer` + `MAX_OUTPUT` slice |
| **Iterations** | `N = 3` default, hard cap 5 | `runVerifyLoop` loop bound (§3.3) |
| **Oracle size** | ≤ 20 tests, ≤ 16 KB | `parseTestOracle` validation |
| **Module/patch size** | ≤ 64 KB | `parseCodePatch` validation |
| **LLM latency** | flash 20 s / pro 60 s (AbortController) | `completeDeepSeek` per-tier timeout |
| **No-network** | best-effort proxy scrub + harness stubs | `scrubbedEnv()` + harness shadow-stubs (§5); honest label: real denial needs OS boundary |
| **No stdin / no shell** | `node -e` argument, `stdio:["ignore",...]` | `runNodeBounded` spawn opts |
| **Scratch cwd** | fresh `mkdtempSync` per run, cleaned on settle | `runNodeBounded` |
| **Deterministic fallback** | any `not-configured`/`error`/`timeout`/unparseable → deterministic template + `"self-test"` | control flow §3.3 / §8.1 |
| **No blind re-run** | unusable fixer output breaks the loop | §3.3 invariant #4 |

**Non-goal, stated honestly (unchanged from node-runner.server.ts):** this is a *bounded runner*, not a security sandbox. The verify loop does not and must not claim filesystem confinement, memory/CPU rlimits, or true network denial. Untrusted third-party code still requires an OS-level boundary (Docker/WSL2/Windows Sandbox/AppContainer/VM). The verify loop only ever runs *RapidTool's own LLM-generated modules* under these bounds — which is the intended, documented threat model.

---

## 10. Enhancement proposals (ranked)

### E1 — **Regression-pinned oracle: turn passing oracles into durable tests** (highest value, moderate effort)
The `Project.oracle: OracleTest[]` field already exists and is unused. Persist every **passing** oracle into it (id, name, given, expect, job mapped onto the new `OracleCase` shape), and re-run prior oracles on any future P6 regeneration. This gives the verify loop *memory across generations*: a module that regresses a previously-passing behavior fails even if its own fresh oracle passes. Directly implements Reflexion's episodic buffer as a *machine-checkable* (not just textual) artifact. Effort: one persistence function + a pre-run pass that concatenates `project.oracle` with the fresh oracle.

### E2 — **Independent evaluator judge for semantic correctness** (high value, moderate effort)
Execution-only verification can pass *wrong-but-consistent* code (the well-known gap that the "Revisit Self-Debugging with Self-Generated Tests" work flags: biased self-tests pass their own buggy logic). Add a separate **evaluator** DeepSeek pass (LLM-as-a-Judge, https://arxiv.org/abs/2306.05685) that scores the module against the *brief* on structured criteria and returns `{ correctness, issues: string[] }`. Its verdict is recorded as a **separate, honestly-labeled** signal ("evaluator opinion — not execution evidence") and can *only* add HITL review, never flip a fail to pass and never mint a `"tested"` label (that remains runner-exclusive). Effort: one more `json:true` call + an artifact; no new safety surface.

### E3 — **Tamper-evident attestation artifact + re-verify endpoint** (medium value, low effort)
Emit a dedicated `"verify"` artifact containing the full `VerifyOutcome`, the source hash, the oracle hash, and `evidenceHash`, then add a `re-verify` path that re-runs `runGate` and re-computes `evidenceHashOf` on demand to prove the recorded verdict still matches the stored source. This turns the "tested" claim into a **re-checkable attestation** (the same discipline `runGate`'s `evidenceHash` already establishes, extended to the loop). Effort: one artifact builder + one pure re-hash function; both trivial given §6.3.

### E4 — **Grounding against the permitted surface (anti-API-hallucination)** (medium value, higher effort)
Before generation, construct a compact **ground-context** block (the exact `entry` contract, the allowed built-in whitelist, the `OracleCase`/module shape) and inject it into both the module-generator and fixer prompts; validate that generated `source` and oracle `given`/`expect` reference only permitted identifiers (De-Hallucinator's iterative grounding, https://arxiv.org/abs/2401.01701). This attacks the *API-hallucination* class (inventing `require("fs")`, calling non-existent helpers) at the prompt + validation layer, complementing the runner's execution feedback. Effort: prompt template + an identifier-scan validator; highest-risk of the four because identifier analysis must reuse `maskLiteralsAndComments` semantics to avoid false positives (same pitfall A02 already documents).

**Ranking rationale:** E1 is ranked first because it reuses a field that already exists and directly strengthens the core "logically-correct" goal; E2 closes the most important *correctness* gap; E3 is near-free credibility; E4 is valuable but the hardest to do without regressing the A02 denylist lessons.

---

## 11. References (borrowed concepts)

1. AlphaCodium — Ridnik, Kredo, Friedman, *Code Generation with AlphaCodium: From Prompt Engineering to Flow Engineering* (2024). https://arxiv.org/abs/2401.08500
2. CodeT — Chen, Zhang, Nguyen, Zan, Lin, Lou, Chen, *CodeT: Code Generation with Generated Tests* (2022). https://arxiv.org/abs/2207.10397
3. Reflexion — Shinn, Cassano, Berman, Gopinath, Narasimhan, Yao, *Reflexion: Language Agents with Verbal Reinforcement Learning* (NeurIPS 2023). https://arxiv.org/abs/2303.11366
4. Self-Refine — Madaan et al., *Self-Refine: Iterative Refinement with Self-Feedback* (NeurIPS 2023). https://arxiv.org/abs/2303.17651
5. Self-Debugging — Chen, Lin, Schärli, Zhou, *Teaching Large Language Models to Self-Debug* (2023). https://arxiv.org/abs/2304.05128
6. LEVER — Ni et al., *Learning to Verify Language-to-Code Generation with Execution* (2023). https://arxiv.org/abs/2302.08468
7. CRITIC — Gou, Shao, Gong, Shen, Yang, Duan, Chen, *CRITIC: Large Language Models Can Self-Correct with Tool-Interactive Critiquing* (ICLR 2024). https://arxiv.org/abs/2305.11738
8. LLM-as-a-Judge — Zheng et al., *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena* (NeurIPS 2023). https://arxiv.org/abs/2306.05685
9. De-Hallucinator — Eghbali, Pradel, *Mitigating LLM Hallucinations in Code Generation Tasks via Iterative Grounding* (2024). https://arxiv.org/abs/2401.01701

**In-repo sources read (read-only) for this design:** `src/lib/engine.ts`, `src/lib/sandbox.ts`, `src/lib/dod.ts`, `src/lib/node-runner.server.ts`, `src/lib/exec.ts`, `src/lib/deepseek.server.ts`, `src/lib/llm.ts`, `src/lib/llm-tasks.ts`, `src/lib/types.ts`, `src/lib/report-intake.ts`.
