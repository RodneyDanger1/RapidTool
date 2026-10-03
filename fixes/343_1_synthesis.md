# 343-1 — synthesis quality: best-of-N with gate-based selection

**Lane:** duo (analyst + engineer) 343-1, synthesis quality (the dominant blocker). **Root:**
`C:\Users\mnril\Desktop\RapidTool Main` (git `main`, HEAD `73f660a`, clean tree). **Runtimes:** host
`node` v24.15.0 and pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2. **Owned files:**
`src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts`, + ONE new file
`src/lib/synthesis-policy.ts` (+ its test). **Scratch:** `%TEMP%\rt343_1\`. **Keyed calls:** bounded ≤4
(measured usage below). No secret printed (the expected `RT_E_LLM_KEY_SHADOWED` notice fires with tails
only). This log is append-only.

---

## PART 1 — ANALYST: where the model's output can fail the gates (on bytes)

The P6 synthesis path has four deterministic gates between the model's reply and a seal. Every gate is
on `src/lib/codegen.server.ts`:

1. **Structure — `validateSynthesisModule` (`:3229`).** Refuses, in order: empty module (`:3240`),
   `>P6_MODULE_MAX_CHARS` 60 000 (`:3244`, `P6_MODULE_MAX_CHARS` at `:166`), markdown fences (`:3250`),
   a HARD or SOFT forbidden primitive (`forbiddenPrimitiveHit`, `:3256`), a non-deterministic primitive
   such as `Math.random` (`:3265`), prose-in-code (`:3276`), a claimed export not bound
   (`unboundExportNames`, `:3290`), a typeSignature function not exported (`missingSignatureNames`,
   `:3298`), a cross-chunk duplicate declaration (`crossChunkDuplicateDeclarations`, `:3309`), and an
   un-awaited async value use (`unawaitedAsyncValueUses`, `:3327`).
2. **Brief-fit — `briefFitSatisfied` (`:3350`).** The brief's required nouns must appear as code
   identifiers, bar `max(1, ceil(required × 0.35))` (`:3354`). Per-module in the single-entry lane
   (`synthesizeSingleModule` `:4519`); tree-level over the assembled entry in the chunked lane
   (`:4840`) — a per-file gate would be wrong (nouns spread across files).
3. **Pre-seal `tsc` — `defaultTreeTypecheck` (`:3631`)**, invoked through `runTreeSelfTypecheck`
   (`:3694`). It materializes the CANDIDATE emitted project into a scratch dir with the pure
   `scaffoldProject` emitter and runs its OWN declared `typecheck` via `compile-check.server.ts
   typecheckDir` (`:3656`). A `fail` is refused; a `skip` is honest non-verification (`:3657`). Call
   sites: single-module at `:4623`; chunked at `:4859` with ONE bounded repair round over the
   compiler-named chunks (`typecheckOffenderIndices` `:3736`, capped `P6_TYPECHECK_REPAIR_MAX_CHUNKS = 3`
   `:3594`), re-synthesized with the tsc tail as tree-failure context (`typecheckRepairContext` `:3753`,
   `:4876-4888`), then a second tsc (`:4925`); still red ⇒ honest partial refusal (`:4928`).
4. **Oracle harness — `verifyAndFixServer`**, single-entry path only (`:4569`, `maxIterations: 3`);
   a non-`passed` status refuses (`:4576`). The chunked lane records NO machine verify at synthesis; its
   oracle is the tree-run lane's step (`treeUpgraded` doc `:5175-5185`, `lastTest: null` `:5244`).

**Where the model's bytes actually die.** The 342 record measured the dominant class at gate 3: a tree
(or a single-entry module) that is structure-clean and brief-fit-clean but fails the emitted tree's own
strict `tsc` (`TS2322` assignment mismatch, `TS2749` value-used-as-type, `TS2440` import/local conflict —
`fixes/342_1_p6-convergence.md` §1). Today that class gets exactly ONE corrective re-prompt of the
compiler-named chunk (chunked) or NO in-function repair at all (single-entry, where the caller journey
re-runs the whole path). One sample, one corrective prompt, then refusal — `fixes/342_0_parent.md` §4
names this "the binding constraint" and `pass@1 = 0.182` (2/11), mean 6.09/9 with nine fixtures failing
on real substance/hard stops. Nothing in the pipeline blocks a passing run; the model's single sample
decides it.

---

## PART 2 — rank by (value × ease)

### Mined from the repo's own competitor research (mined before any new research)

- **SWE-agent is the explicit best-of-N harness.** `ScoreRetryLoopConfig` (`accept_score`,
  `max_accepts`, `max_attempts`, `min_budget_for_new_attempt`) plus `ChooserRetryLoop` with a
  `Preselector` + `Chooser` that "picks the best of N trajectories" —
  `research/multiagent/107_competitors_agentic.md:54` (citing `sweagent/agent/reviewer.py:81-320`).
- **Aider is the lint/test-feedback loop.** `--lint-cmd`/`--test-cmd` → `reflected_message` re-sent to
  the model until clean or `num_reflections >= max_reflections` —
  `107_competitors_agentic.md:76` (citing `aider/coders/base_coder.py:1596-1622`); restated for RapidTool
  at `90_LEAPFROG.md:1082` ("Aider's loop is *edit → lint → fix → test*").
- **Cline scores trials, not a single tick.** A 3-layer eval pyramid, smoke scenarios × 3 sequential
  trials in fresh workspaces, reported as `pass@k` / `pass^k` / a flakiness score —
  `107_competitors_agentic.md:88` (citing `evals/analysis/src/metrics.ts:5-11,80-94`).
- **PR-Agent gates on a numeric score + a dedicated self-review model.** `suggestions_score_threshold`
  (default 1) and a separate `model_reasoning` "dedicated reasoning model for self-reflection" —
  `107_competitors_agentic.md:142,144` (citing `pr_code_suggestions.py:58-73`, `configuration.toml:9-11`).
- **RapidTool already has the Reflexion shape and the executable oracle**; the missing piece is
  *sampling + deterministic selection* — `90_LEAPFROG.md:425,433` (the verify-fix loop
  `verify.server.ts:503`, L3 `{symptom, hypothesis, fix}`).
- **Fresh-model refutation** is Anthropic's recommendation ("a fresh model tries to refute the result,
  so the agent doing the work isn't the one grading it") — `90_LEAPFROG.md:589`.
- **`07_opensource_steal_catalog.md` contributes nothing to this lane** (it is a UI/rendering/export
  catalog: markdown, shiki, minisearch, jsdiff, pdfmake, mermaid, xyflow, xterm) — the only adjacent row
  is jsdiff for "P6 code-variant flips" (`07:14`), a display aid, not a convergence technique. Stated
  so the omission is not read as an oversight.

### Targeted web check (the repo's own free search, `websearch.server.ts freeWebSearch`, DuckDuckGo; every source cited)

- **Best-of-N Sampling** pattern — `https://agentpatternscatalog.github.io/patterns/patterns/best-of-n.html` (fetched via `freeWebSearch`, 2026-10-03).
- **HuggingFace TRL — Best of N sampling** ("get better model output without RLHF") — `https://huggingface.co/docs/trl/main/en/best_of_n`.
- **Scalable Best-of-N Selection for LLMs** — `https://arxiv.org/abs/2502.18581`.
- **Regularized Best-of-N Sampling** (the reward-hacking caveat that motivates a *deterministic* reward) — `https://arxiv.org/html/2404.01054v1`.
- **CodeT: Code Generation with Generated Tests** — sample programs, generate tests, select by test
  agreement — `https://arxiv.org/pdf/2207.10397v1`.
- **AlphaCode: Competition-Level Code Generation** — "sample-and-filter": huge sampling then filter by
  example tests — `https://ar5iv.labs.arxiv.org/html/2203.07814` (and `https://storage.googleapis.com/deepmind-media/AlphaCode2/AlphaCode2_Tech_Report.pdf`).
- **Unlocking LLM Code Correction with Iterative Feedback Loops** — compiler feedback into the retry —
  `https://arxiv.org/html/2606.17514v1`.
- **Self-Reflection in Agent Loops / Reflexion** patterns — `https://aiunderstanding.org/learn/self-reflection-in-agent-loops`, `https://zylos.ai/research/2026-03-06-ai-agent-reflection-self-evaluation-patterns/`.
- **Static typing catches ~15% of public bugs** (Gao, Bird & Barr, ICSE 2017) — `90_LEAPFROG.md:1067`.

### Ranked shortlist (value × ease; only small, deterministic-to-select, one-file-integrable)

| # | Technique | Value | Ease | Verdict |
|---|---|---|---|---|
| 1 | **Lazy best-of-N with the EXISTING deterministic gates as the selector** (structure → brief-fit → pre-seal tsc). Sample only when the current candidate fails; keep the first that clears all available gates; report the count + winner + loser reasons. | **High** | **Medium** | **PICKED.** The gate is already on disk (no model judge, no new subsystem); it spends extra calls only on hard units; N=1 is byte-identical. |
| 2 | **Informed re-candidate** — carry the compiler tail (`typecheckRepairContext`) into each resample so samples are better-informed than a fresh primary prompt, without duplicating the existing repair loop. | Medium-High | Small | Absorbed into #1: the chunked tsc round's candidates are repair-context-informed; the single-entry resample is the independent sample. |
| 3 | **Test-gated selection via the oracle** (`verifyAndFixServer` cases as the reward). | High | **Large** | **Discarded for this lane.** The oracle is a `deps.verify` seam; running it per candidate is N× a 3-iteration machine loop, and the chunked lane has no in-function oracle (it lives in `headless.ts`, another owner). Not one-file. |
| 4 | **LLM-judge selector** (PR-Agent score / fresh-model refutation). | Medium | Medium | **Discarded.** Selection would be non-deterministic and adds keyed cost per candidate; the task requires deterministic selection, and the tsc gate already is a better reward. |
| 5 | **Diverse sampling knobs** (temperature / top-p / seeds). | Medium | Medium | **Discarded.** `DeepSeekCompleteOptions` exposes no temperature seam; adding one touches `src/lib/llm/providers/deepseek.ts` — outside ownership. Independent same-prompt calls are already diverse (no temperature is sent ⇒ vendor default). |
| 6 | **Separate self-critique/reflexion call** before validation. | Medium | Medium | **Discarded as the pick.** Overlaps the existing bounded repair loop and the 342-1 rule-11 guidance; a critique call is model-judged and adds cost without a deterministic accept signal. The resample in #1 is the honest, cheaper version. |

### Explicitly discarded — need a new subsystem (and why)

- **Full agent loop** (Aider/OpenHands edit→run→fix over many turns): needs a new orchestration subsystem
  + an isolation boundary; out of one-file scope. (`107:194,304`.)
- **Sandboxed per-candidate execution** (SWE-ReX Docker per instance, `107:50`): host-tooling policy +
  a second process/container model; the repo's runner is deliberately *not* a sandbox.
- **Vector DB / embedding retrieval** (mem0/Letta, `07:110`): a new persistent service for a ranking we
  do not need — the deterministic gate is the ranker.
- **Mutation testing** (Stryker, `107:106`): a new dependency + harness, not a selection primitive.
- **Fresh-model refutation pass on a pro tier** (`90:589`): touches provider/tier wiring and is
  non-deterministic; a candidate beyond ownership and beyond the "deterministic to select" rule.

**Pick:** **#1 — opt-in, lazy best-of-N with the existing deterministic gate chain as the selector.**
It is the smallest change that directly attacks the measured pre-seal-`tsc`/brief-fit class, its
selector is already on disk and pure, it is bounded (hard cap 4) and cost-honest (extra samples only on
failure), and N=1 reproduces today byte-for-byte.

---

## PART 3 — ENGINEER: the implementation

**Owned files touched:** `src/lib/codegen.server.ts` (+162 / −17, patch-only), `src/lib/codegen.server.test.ts`
(+5 tests), new `src/lib/synthesis-policy.ts`, new `src/lib/synthesis-policy.test.ts` (+8 tests). No tracked
file deleted; nothing outside the owned box touched. **Scratch:** `%TEMP%\rt343_1\`.

### 3a. The policy module (`src/lib/synthesis-policy.ts`)

Pure and model-free, so the count + selection contract is unit-testable:

- `P6_SYNTH_CANDIDATES_DEFAULT = 1`, `P6_SYNTH_CANDIDATES_MAX = 4` (the hard cap).
- `resolveSynthesisCandidates(explicit, env)` (`:35`) — `deps.candidates` wins over `P6_SYNTH_CANDIDATES`;
  anything non-integer / non-positive / absent ⇒ 1; every value clamped to 4.
- `selectBestOfN(count, produce, evaluate)` (`:79`) — lazy: candidate `i` is produced on demand and
  production STOPS at the first candidate that clears every gate; `count <= 1` produces exactly one
  candidate; a `null` sample counts as lost, never a crash; no winner ⇒ `null` so the caller keeps its
  legacy fallback.
- `candidatesLogDetail(unit, count, winner, outcomes)` (`:108`) — the bounded
  `p6.synthesis.candidates` detail.

### 3b. The wiring (`src/lib/codegen.server.ts`, patch-only)

- Import of the policy: `:149-155`.
- `P6SynthesisDeps.candidates?: number` documented at `:3448-3456` (env `P6_SYNTH_CANDIDATES` is the
  production knob; the option wins for explicit callers/tests).
- Resolved once in `liveP6Synthesis`: `:4224-4227`; threaded into both lanes at `:4314` and `:4322`.
- **Single-entry lane** (`synthesizeSingleModule`, signature `:4364-4365`): the best-of-N block at
  `:4443-4496` judges each candidate against the ordered deterministic gates — structure
  (`validateSynthesisModule`), brief-fit (`briefFitSatisfied`), then the REAL pre-seal tsc
  (`runTreeSelfTypecheck` over the materialized candidate). The winner replaces `envelope`; when none
  passes, the primary stands and the EXISTING bounded repair path still runs. Extra samples are produced
  lazily and metered through `accountRepairUsage` (session budget). The event fires at `:4490`.
- **Chunked lane** (`synthesizeChunkedTree`, signature `:4772-4774`): the pre-seal-tsc repair round
  `:4944-5046` now probes the informed single sample first and, only if it fails the real tsc, resamples
  the offender chunk up to `candidates` times with the same compiler-informed prompt, keeping the first
  sample whose substituted assembled tree clears the real tsc. All samples rejected ⇒ the informed sample
  stands and the existing second gate refuses. The event fires at `:5046`. With `candidates === 1` the
  block is bypassed entirely (byte-identical legacy single re-synthesis).
- No gate weakened: `validateSynthesisModule`, `briefFitSatisfied`, `defaultTreeTypecheck`, the oracle, the
  forbidden/prose/nondeterminism/async/duplicate checks are untouched. No `any` added, no tsc suppressed.

### 3c. RED → GREEN (targeted suite, both runtimes)

**RED (real output, the feature absent — HEAD bytes restored, new tests run against them):**
```
# Subtest: fixes/343-1 opt-in best-of-N synthesis (gate-based selection)
    not ok 2 - GREEN: with N>1 an independent resample that clears the tree's tsc is selected and sealed
    not ok 3 - all candidates rejected ⇒ the first structure-valid sample stands and the second gate refuses
    not ok 4 - single-entry lane: an independent resample that clears the pre-seal tsc is selected and sealed
    not ok 5 - P6_SYNTH_CANDIDATES drives the count when no explicit option is given
not ok 41 - fixes/343-1 opt-in best-of-N synthesis (gate-based selection)
# tests 222
# pass 218
# fail 4
```
(Test 1 — "with the default N=1 the same brief refuses" — passes on HEAD by construction: it asserts the
legacy behavior. The 4 above fail because the feature does not exist on HEAD.)

**GREEN (feature restored):**
```
                         v24.15.0        v22.23.2
codegen.server.test.ts   222 / 222 / 0   222 / 222 / 0   (# tests / # pass / # fail)
synthesis-policy.test.ts   8 /   8 / 0     8 /   8 / 0
```
The 217 pre-existing `codegen.server.test.ts` pins did not move (215 → 217 was 342-1's; 217 + my 5 = 222).
`npx eslint` on the four files: exit 0. `npx tsc --noEmit` filtered to the owned files: no rows (clean).

### 3d. Keyed measurement (real money, measured; 4 of 4 calls used)

Probe `%TEMP%\rt343_1\probe.mjs` / `probe2.mjs` drive the REAL `liveP6Synthesis` with the REAL DeepSeek
provider, the REAL pre-seal tsc gate (`defaultTreeTypecheck`), a persisted conformant spec, and a HARD
keyed-call cap (a cap-trip returns a coded refusal with NO network call). The expected
`RT_E_LLM_KEY_SHADOWED` notice fired (tails only).

| # | Lane / brief | N | calls | usage (prompt/completion) | outcome |
|---|---|---|---|---|---|
| 1 | chunked · `invoice-csv-cli` | 4 | **1** | 1719 / 2117 | **sealed**; no candidates event (candidate 1 cleared the real tsc ⇒ 0 extra samples) |
| 2 | chunked · `invoice-csv-cli` | 1 | **1** | 1719 / 2123 | **sealed**; identical 1-call cost |
| 3 | single-module/service · `order-webhook-service` | 4 | **2** | 3464 / 3442 | **sealed** — candidate 1 REJECTED by the real tsc; candidate 2 selected |

**Call 3 is the headline.** With N=4 on the real `order-webhook-service` brief, the primary sample failed
the emitted tree's own strict `tsc`, and an independent resample cleared it:
```
"candidatesEvent": "single-module · candidates 4 · winner 2 · candidate 1: rejected — pre-seal typecheck
refused (src/generated/chunk-0.ts(68,17): error TS2323: Cannot redeclare exported variable 'resolvePort'.
src/generated/chunk-0.ts(101,17): error TS2323: Cannot redeclare exported variable 'validateOrderEvent') |
candidate 2: selected — structure + brief-fit + pre-seal typecheck"
"sealed": true, "refusal": null, "realKeyedCalls": 2, "typecheckSkipped": null
```
The N=1 pipeline stops at candidate 1 (one sample + one informed repair) and would refuse this sample; the
event records candidate 1's real `TS2323` rejection as direct evidence, and the run converged on the next
independent sample. The gate ran (not a skip), the module sealed, and the total cost was 2 keyed calls.
**Honest scope:** the model is stochastic — this is one measured run, not a rate. It is direct evidence
that the mechanism converts a real strict-ts failure into a seal, not a guarantee that it always will.

Calls 1 vs 2 show the Pareto property: when the primary sample already clears the gate, N=4 spends exactly
the same 1 call and ~the same tokens as N=1 (2117 vs 2123 completion tokens — provider jitter) and emits no
candidates event. Best-of-N is not a cost tax on the common case.

### 3e. Default-unchanged proof

1. `resolveSynthesisCandidates(undefined, undefined) === 1` (unit test), so both `if (candidates > 1)`
   blocks are dead code on the default path.
2. The RED-baseline integration test asserts N=1 emits NO `p6.synthesis.candidates` event and makes
   exactly 2 synthesis calls (one primary + one bounded repair) — the legacy shape.
3. The full 222-pin `codegen.server.test.ts` suite (which includes the byte-parity/materialization pins and
   every 341/342 prompt-byte pin) is green on both runtimes with the feature restored — every pre-existing
   default-path assertion still holds.
4. Keyed call 2 vs call 1: identical 1-call cost on the same brief.

### 3f. Mock / fake census (my added lines)

`as any` 0 · `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` 0 · `eslint-disable` 0 · `TODO`/`FIXME` 0 (the
2 `TODO`s in `codegen.server.ts` are pre-existing at `:1066`/`:4028`, none in my added lines) · empty
`catch {}` 0 · `.only(`/`.skip(` 0 · hardcoded pass/fail fakes 0. Product code has no doubles: the policy
is real control flow, the gates are the existing real validator/compiler, and the extra samples are real
provider calls. The probe harness's stub mode uses a scripted module + injected seam purely to validate
plumbing keylessly (0 keyed calls, never in product code); the stub oracle in probe 2 is labeled
"not measured" and the synthesis+tsc legs are real. RED evidence is real `node --test` output; the keyed
numbers are measured usage. No tracked file deleted.

### 3g. Honest verdict

**Materially improved, mechanically sound, and measured to work — but it is an amplifier, not a fix for
model capability.** The change is exactly the competitor pattern (`SWE-agent` ChooserRetryLoop selecting
the best of N; `AlphaCode` sample-and-filter; `CodeT` test-gated selection) reduced to the smallest
deterministic form: the selector is the pipeline's OWN strict gates, not a model judge. The keyed run
shows the mechanism does what it claims — a real `TS2323` type-red primary was replaced by a tsc-clean
resample and the tree sealed — at 2 calls, and the default path is provably untouched. It cannot make a
weak model write correct types; it buys independent attempts and keeps only gate-clean ones, so the
expected `pass@1` rises with N on precisely the briefs that fail on a single sample (at up to N× the calls
on those units, reported honestly). The safe bound (≤4) and the Pareto behavior (0 extra calls when the
first sample passes) keep the cost predictable. **What I did NOT prove: a pass-rate delta across the 11
fixtures** — that needs a full keyed `eval` scorecard, which is beyond this lane's 4-call budget.

### 3h. What remains

1. **A full keyed `eval --keyed --all` scorecard at N=1 vs N=2/3** is the only honest pass-rate metric; it
   is the natural next measurement (12–25 min, many calls).
2. **The chunked-lane resample needs ≥3 calls per offender** to reach candidate 2 (primary + informed
   repair + resample); the single-entry lane reaches it in 2. A future pass could probe candidate 1's tsc
   before the informed-repair call to shave one call in the chunked lane.
3. **The oracle is not a selector here.** Test-gated selection via `verifyAndFixServer` (technique #3) was
   discarded for this lane — it lives partly in `headless.ts` and costs N× a 3-iteration machine loop.
4. **Diversity is vendor-default temperature** (no temperature is sent by `DeepSeekCompleteOptions`); a
   future lane could expose a temperature/seed seam in `src/lib/llm/providers/deepseek.ts` (outside this
   box) to sharpen independent sampling. Flagged, not done.
5. **TS2323 (duplicate exported variable) is a NEW measured class** not named in rule 11 (which names
   TS2322/TS2749/TS2440). The prompt could name it too — a one-line follow-up in `p6SynthesisSystemPrompt`;
   flagged, not done (a needed change is inside my file but was outside this lane's proven scope).

---

## PART 4 — FOLLOW-UP (landed): name TS2323, and hand the model the 343-2 repo map

**Root:** same tree, git `main`. **Runtimes:** host `node` v24.15.0 and pinned
`& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2. **Owned files touched:** `src/lib/codegen.server.ts`,
`src/lib/codegen.server.test.ts` only. **Read-only:** `src/lib/repo-map.ts` (343-2's finished file — imported,
never edited), `src/lib/repo-map.test.ts`, `src/lib/synthesis-policy.ts` (+ its test). No tracked file
deleted. **Keyed calls: 0** — see §4d. Scratch: `$env:TEMP\rt343_1\`.

Two follow-ups that make the best-of-N work and the sibling 343-2 lane pay off.

### 4a. Task 1 — rule 11 now names TS2323 (`codegen.server.ts:648,653`)

The keyed best-of-N probe (§3d, call 3) rejected candidate 1 with a real strict-`tsc` error the prompt never
advertised: `error TS2323: Cannot redeclare exported variable 'resolvePort'`. Rule 11 named TS2322/TS2749/
TS2440 only (`codegen.server.ts:653`, one string element of `p6SynthesisSystemPrompt`).

- **Edit:** the rule-11 comment (`:648`) records the 343-1 measured class; the rule text changes "Three
  classes it refuses" → "**Four classes it refuses**" and adds the **required shape** as clause (d):
  *"TS2323 DUPLICATE EXPORTED VARIABLE — `Cannot redeclare exported variable`: declare each exported
  variable exactly ONCE at top level. Never declare the same exported `const`/`let`/`var`/`function`/`class`
  name twice in one module, and never reuse a name an earlier file already exports; a second top-level
  declaration of an exported name fails the compile — emit ONE declaration, then assign
  `module.exports.<name>` once."*
- **Prompt pinned** (`codegen.server.test.ts:3932-3948`): the existing rule-11 test now asserts
  `s.includes("TS2323")`, `s.match(/Cannot redeclare exported variable/)`, and the required shape
  `/declare each exported variable exactly ONCE|never declare the same exported/i`; the pre-existing
  TS2322/TS2749/TS2440 assertions and the no-false-enforcement pin are unchanged. The rule claims no
  validator enforcement (real `tsc` is the gate) — the `!/11\.[^\n]*\(validator-enforced\)/` pin still holds.

### 4b. Task 2 — the persisted tree's repo map rides the chunked P6 primary prompt

343-2's STOP-and-REPORT (`fixes/343_2_context.md` §5/§8) asked the P6 owner to feed
`repoMapForProject(project, { budget })` into the synthesis prompt. Wired in `src/lib/codegen.server.ts`,
patch-only:

- **Import** `repoMapForProject` (`:161`) — client-safe, dependency-free, so a server module may import it.
- **Budget constant** `P6_SYNTH_REPO_MAP_BUDGET = 1_200` (`:221`), exported (single source of truth for the
  test and the render).
- **Helper** `withRepoMapContext(user, rendered)` (`:1233-1236`): appends
  `\n\nREPO MAP (deterministic outline of the tree so far — path: exported symbols, ranked):\n<rendered>`
  **iff `rendered` is non-empty**; otherwise returns `user` untouched.
- **Caller** (`synthesizeChunkedTree`, the caller named in §5 as the tree-synthesis path): the map is built
  once (`:4876-4883`) and appended to every PRIMARY chunk prompt (`:4894-4902`).
- **Tree-only input.** The map is built from `project.generatedTree` alone:
  `repoMapForProject({ generatedTree: Array.isArray(project.generatedTree) ? project.generatedTree : null }, { budget: P6_SYNTH_REPO_MAP_BUDGET })`.
  The reason is on bytes: `project.generatedSource` at synthesis time is the **keyless floor placeholder**
  (`sandbox.buildPhase6Module`, written by `engine.ts:987,1011`) — not a tree the run is extending. Passing
  the whole project would have rendered that placeholder as a fake `src/generated.ts` outline on every
  fresh run and changed every chunked prompt byte. Tree-only makes "keyless/no tree" mean **no map**, which
  is exactly the conditional the task requires. The map still uses the sibling's export/shape, so no
  algorithm or dependency is forked.

**Real rendered block (the test's persisted 3-file tree, `repoMapForProject(..., {budget:1200})`):**
```
chars: 131 budget: 1200 empty: false truncated: false
src/generated.ts: (no named exports) · in 0, 3 ln · entry
src/core.ts: core · in 1, 2 ln
src/jobs/rent.ts: collectRent · in 1, 4 ln
```
The tree carried a commented `export function ghost` and a string-literal `export function phantom`; neither
appears (the map's masked read reports only real exports — the no-invention guarantee the task leaned on).

**Byte-identity pin (the no-tree prompt).** `codegen.server.test.ts:5815-5834` asserts, on the REAL primary
prompt the lane hands its `complete` seam:

```
withTree.prompts[0] === noTree.prompts[0]
  + "\n\nREPO MAP (deterministic outline of the tree so far — path: exported symbols, ranked):\n"
  + repoMapForProject({ generatedTree: PERSISTED_TREE }, { budget: 1200 }).rendered
```

plus `!noTree.prompts[0].includes("REPO MAP")` and `map.rendered.length <= P6_SYNTH_REPO_MAP_BUDGET <= 1200`.
That is the exact statement: when no tree is rendered the block contributes **zero bytes**, so the prompt is
byte-identical to today; when a tree exists the prompt gains **exactly** the appended block and no other
byte moves. The control test (`:5842-5854`) pins that an **undefined** and an **empty** `generatedTree`
produce the identical prompt and an empty `rendered`.

**Which byte pins moved, and why (honest).** None of the pre-existing pins moved, because no existing test
feeds a project with `generatedTree` into `liveP6Synthesis` (verified: `grep 'generatedTree:'` in the suite
has zero input occurrences — every one is a read of a result). So every no-tree prompt pin (gate-repair /
refusal / tree-failure / proven-lessons, single-module and chunked) stays exact. A **tree-mode** prompt does
legitimately gain the block — that is the whole point ("a re-synthesis/resume sees the tree it is extending")
— and the new test pins that gain as one appended block; no existing pin needed editing, and none was
silently relaxed.

Scope note: only the chunked-tree caller was wired (the caller §5 named). The single-module
`p6SynthesisUserPrompt` path and the bounded repair re-prompt are untouched, so their bytes are unchanged.

### 4c. RED → GREEN (real output, both runtimes)

**RED (tests added, source at the pre-follow-up bytes):**
```
    not ok 9 - W56/342-1 + 343-1: the system prompt names the four strict-ts classes and their required shape
        error: "names the duplicate-exported-variable class (343-1's measured keyed probe)"
    not ok 1 - GREEN: a persisted tree is rendered as ONE bounded block appended to the primary chunk prompt
not ok 30 - 216f T-10 — prompt contract: signature ceiling vs requirement duty      (suite, subtest 9)
not ok 42 - fixes/343-1 follow-up: the chunked P6 prompt carries the persisted repo map (343-2)
# tests 224   # pass 222   # fail 2      (identical on v24.15.0 and v22.23.2)
```
Exactly the two target tests fail (the rule-11 pin and the repo-map GREEN); the no-tree control already
passes by construction (it asserts the legacy zero-byte contribution).

**GREEN (follow-up landed):**

| Suite | Node 24.15.0 | Node 22.23.2 |
|---|---|---|
| `codegen.server.test.ts` | **224 / 224 / 0** | **224 / 224 / 0** |
| `synthesis-policy.test.ts` + `repo-map.test.ts` (read-only) | **23 / 23 / 0** | **23 / 23 / 0** |

(222 → 224 = the two new tests; the 343-1 suite was 222/222.) `npx tsc --noEmit` filtered to the owned
files: no rows. `npx eslint` on the five files (owned + read-only `repo-map.ts`): exit 0. No full gate was
run (per the lane budget).

### 4d. Keyed usage — 0 calls, and why

The task allowed ≤2 keyed calls **only if** a live probe was genuinely needed to show the map reaching a
real prompt. It is not: `repoMapForProject` and `withRepoMapContext` run deterministically **before** any
provider call, and the new test drives the REAL `liveP6Synthesis` → REAL `synthesizeChunkedTree` → REAL
`p6SynthesisChunkUserPrompt` + context wrappers → the REAL `complete` seam, asserting the exact prompt bytes
the provider would receive. A keyed call would exercise the identical assembly and only add stochastic
model text on top. **0 keyed calls used.**

### 4e. Mock / fake census (my added lines)

`as any` 0 · `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` 0 · `eslint-disable` 0 · `TODO`/`FIXME` 0 ·
empty `catch {}` 0 · `.only(`/`.skip(` 0. Product code has no doubles: the map is the sibling's real
deterministic builder over the project's real persisted `generatedTree`, and the block is real string
assembly. The test's injected `complete` seam is the file's existing seam pattern (no network), and its
assertions are on real prompt bytes.

### 4f. What remains

1. **Surface the same map in the single-module lane / bounded repair re-prompt** — deliberately out of this
   follow-up's scope (the task named the one chunked caller). A resumed library/service run could benefit
   equally; it is a one-wrapper change at `synthesizeSingleModule`'s `user` (`codegen.server.ts:4405`).
2. **A keyed resume probe** (a project seeded with a real `generatedTree`, a real key, one chunk) would show
   the block on the wire end-to-end; not needed for correctness (the assembly is deterministic and pinned)
   and not spent here.
3. **The 343-2 `…[repo map elided …]` marker** is exercised by the map's own suite at its default 1600
   budget; the P6 1200 budget is small enough that a large persisted tree would elide — the marker rides the
   rendered text verbatim, so the prompt would carry it with no extra handling. Untested at the prompt layer
   with a >1200-char tree; flagged.

