# 221 · PERSONA 1 — The Feature Architect: translating competitor evidence into RapidTool designs

**Read this file FIRST.** You are one of two design agents whose work makes the overhaul's
implementation waves *obvious*. You own the **feature designs**; your sibling owns the
**integration map** (`222_codebase_integration_map.md`). Together you convert evidence into
lane-ready work.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
COMPETITOR CLONES (read-only, NEVER execute anything from them): /c/Users/mnril/rt-competitors/.
TREE STATE: green + committed (7582771); boundary gate green (fixes/218 §5).

THE OWNER'S GOAL (verbatim): "improvements to the codebase to actually achieve the goal I laid out /
bring RapidTool to fruition entirely." The goal is fixed by the repo itself: the Coffeehouse2Home /
Property Ledger real-estate suite a non-technical friend can use (`RESUME.md` §1.0; `remainingwaves.md:25`,
milestone M-A), plus the "best agentic harness" claim — which the inquest measured as **ahead on three
mechanisms** (verification depth, hard budget enforcement, honesty-as-runtime) and **behind on three**
(provider breadth, no MCP runtime client, no codebase-scale index) with the whole field's cautionary tale
being Devika's 0-byte sandbox files (`219f`).

THE STANDARD (verbatim): "no hallucinations/fake code/… 100% truth." For a design doc that means:
every design must name files that exist TODAY (verify), every seam must be a `file:line` you read TODAY
containing what you say it contains, and every competitor mechanism must cite the clone path + symbol
from `219f` (or be labelled "NOT IN THE CLONES — design from scratch"). A design that would violate an
honesty invariant is not a design — it is deleted.

RULES:
1. WRITE ONLY your deliverable. Never edit src/scripts/docs; no git mutations; never execute clone code.
2. ALLOWED: read-only greps/reads in repo + clones; ≤2 targeted test runs
   (`node --experimental-strip-types --test --test-concurrency=2 <file>`).
   FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build`.
3. Scratch outside the repo (`C:/Users/mnril/w13f_scratch/`). Skeleton first, then fill in passes.
```

**Your deliverable:** `research/multiagent/221_feature_designs.md`

## Inputs
`219f_competitor_codebases_vs_rapidtool.md` (**respect its WD-C correction markers**) ·
`219e_gap_to_best_and_plan.md` (§1 axes, §3 ranked blockers, §5 what-NOT-to-do, WD-C corrections) ·
`220_overhaul_plan.md` (the spine) · `219c` (autonomy/key) · `219d` (learning/repair) ·
`219b` (defects) · `fixes/217c` §3 (owner decisions) · `AGENTS.md` + `RESUME.md` §5.4 (invariants).

## What to design (rank by leverage; 3–5 features done PROPERLY beats 8 sketched)

Candidate set — choose and justify; you may substitute a better candidate the evidence supports:
1. **MCP runtime client** (the field's table stakes: 7 clones ship one; RapidTool has a contract artifact
   + DoD probe only). Design a *client* — honest about what the honesty contract allows: tool discovery,
   an allow-list seat, `sandbox:false` propagation into tool calls, coded refusals.
2. **Provider breadth step 2** (registry already does env selection at `registry.ts:35-38`; the stated
   bottleneck is the *live-verified-model* honesty rule). Design how a second/third verified provider is
   added **without** fabricating model claims.
3. **Cross-run learning measurement** (219d's real gap: nothing anywhere measures whether following a
   lesson helped). Design the smallest measurement that produces a falsifiable number — respecting that
   T-11's mute and `selectLessons`' static ranking are deliberate.
4. **Codebase-scale index** — but only if it serves the maker test; the honest answer may be "lexical is
   sufficient, here is the evidence, do not build this" — that is a first-class deliverable.
5. **Per-action allow-lists / autonomy boundary** (219f boundary item; design must not weaken
   `policy.ts`'s human-seat invariants).
6. **Checkpoint/resume + patch preservation** (T-107.7 / T4.3 — already in W16; a *design* here makes
   that wave's briefs obvious).

## Required shape per feature (this is what makes a lane brief writable from it)

```
### F<n> · <name>  (status: DESIGNED / DESIGN-FROM-SCRATCH / NOT-RECOMMENDED)
- Why it exists: <finding + citation>
- The field's version: <clone path + symbol, one line of what they do> (or NOT IN THE CLONES)
- RapidTool-native design: <architecture in ≤8 lines, naming real modules>
- Seams: <file:line for every insertion point — read them today>
- Reuse, don't rebuild: <existing helpers (e.g. token-ledger seams token-ledger.ts:269-339, policy seam,
  registry, knowledge selectors) with lines>
- Honesty constraints it MUST satisfy: <the invariants it touches, e.g. never mint decidedBy:"human";
  ok:true never carries error; no sandbox/E2E claim; declare-or-strike>
- Minimal first step (one lane, size S/M): <exactly what lands first>
- Tests to extend/create + exact verify command: <file + command>
- Risks / what it must NOT claim: <2-4 lines>
- Gated by: <Step 0 keyed run / an owner decision / nothing>
```

## Hard exclusions (from `219e` §5 — designing these is out of scope)
Multi-language (D-1) · multi-tenant (D-2) · any sandbox/isolation claim · any E2E-of-a-running-app
claim · widening the agent surface for its own sake · a second budget system · visual polish ·
frontier-IQ chasing. If you believe one of these is actually the highest-leverage move, do NOT design
it — write a 5-line escalation to the parent saying so, with the evidence, and move on.

## Bottom line required at the top of the file
For each feature: name · status · size · gated-by · one-line "what it buys the goal". Then one
paragraph: **if only ONE of these ships before the maker test, which and why.**
