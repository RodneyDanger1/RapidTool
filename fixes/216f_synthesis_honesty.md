# 216f — Lane 3: Wave E synthesis honesty (T-09, T-10, T-15)

**Lane:** 3 of the RESUME.md §3.3 wave · **Status: in-progress (W2 · R3 — finish lane)**
**Owned files:** `src/lib/codegen.server.ts` (+ `.test.ts`), `src/lib/prompt-engine.ts` (+ `.test.ts`), this log
**Spec:** `research/multiagent/106_rapidtool_deep_analysis.md` §6 Wave B — T-09, T-10, T-15
**Baselines at handoff:** codegen 72/72, prompt-engine 28/28 (both re-verified on disk before any W2 edit).

## Task status

| Task | Status | Notes |
|---|---|---|
| T-09 — reject prose-in-code at synthesis | in-progress | detector landed in W1 (`proseLineHits`, codegen.server.ts ~:259), UNWIRED at W1 exit — this lane wires the refusal + repair class + tests |
| T-10 — resolve the synthesis prompt contradiction | in-progress | untouched at W1 exit (`p6SynthesisSystemPrompt` rule 1 vs chunk prompt "implement every one") |
| T-15 — ban `Math.random()` in generated code | in-progress | detector landed in W1 (`nondeterministicPrimitiveHit` ~:206), UNWIRED |

## Tier re-confirmation note (T-09/T-10)

T-09 (F-04 prose leak) and T-10 (F-08 prompt contradiction) were observed on the
**pro-tier** keyed run. The default tier is **flash** (T0.1). This lane runs with
**no `DEEPSEEK_API_KEY`** in the sandbox, so a live keyed flash run cannot be executed
here. **Verdict: T-09/T-10 are CARRIED FORWARD UN-REPRODUCED under flash** — what this
lane re-confirms deterministically is that the on-disk pro-tier artifact
(`research/eval-out/coffeehouse2home-property-ledger/src/generated/chunk-0.ts:340-362`)
contains the leaked prose and the model's own statement of the contradiction, and that
the wired gate refuses exactly that artifact shape. Never fabricated.

## What changed

_(work log filled as patches land — skeleton first, per W2 rule 9)_

## Evidence (commands + real observed output)

_(filled at the end)_

## The chunk-0.ts:342 residual gap

_(status filled at the end: tightened vs documented)_

## The src/main.tsx:11 false-positive + the chunk-gate scope decision

_(filled at the end)_

## Verification

_(commands + real observed output; filled at the end)_
