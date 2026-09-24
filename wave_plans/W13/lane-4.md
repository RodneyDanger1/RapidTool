# 219d · Self-fixing / self-improving: what is real, what is ritual

**You are lane 4 of 5 in a read-only "state of the factory" inquest. The owner asked:**
> *"So what is going on? What is left to do / what's broken / silently broken? What is preventing
> RapidTool from being the best agentic AI harness / software factory / autonomous software factory /
> **self-fixing and self-improving coder** out there?"*

You own the **learning-and-repair question**: does this thing actually get better at its job, and can
it actually fix its own output? Trace it in code, end to end, then say plainly what is real and what
is ritual. Siblings own inventory, defects, autonomy and the plan; the parent synthesises.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
TREE STATE: green as of 2026-09-24 11:08 (gate {"ok":true}). NO API key is available
(`doctor` → `llm.configured: false`) — every keyed path you discuss must be traced in code and
labelled traced-not-run. W10/L11/L12 just landed: read `fixes/216z` §1-L1 (the T-11 green-seal gate),
`fixes/217b` (the watchdog's falsification of the probe-tag half and its repair) and `fixes/218`.

THE STANDARD — the owner's words: "100% solid and no hallucinations/fake code/ and is zero bullshit
100% truth." Every claim: a `file:line` read TODAY, a command run TODAY with output pasted, or an
explicit UNVERIFIED label. Never invent a mechanism the code does not have — and be equally careful
not to hand-wave away the mechanisms it DOES have.

RULES:
1. READ-ONLY: write ONLY your dossier. No src/scripts/doc edits. No git mutations.
2. ALLOWED heavy commands: `node --experimental-strip-types --test --test-concurrency=2 <file>` (≤3)
   plus read-only greps and `node -e`/`.mjs` probes OUTSIDE the repo. FORBIDDEN: `npm run typecheck`,
   `npm test`, `npm run build`.
3. Scratch OUTSIDE the repo (`C:/Users/mnril/w13l4_scratch/`).
4. Skeleton first, then fill.
```

**Your dossier:** `research/multiagent/219d_self_improvement_reality.md`

## What to establish

1. **The learning loop, traced end to end.** Produce an ordered chain with a `file:line` per hop:
   *something fails → a record is written → an identity/signature is minted → the row is stored →
   it is SELECTED for a future run → it reaches a prompt → the next run behaves differently.*
   The relevant modules are `knowledge.ts` (lesson rows, `failureSignature`, `lessonRow`,
   `failureLessonFromRecord` + its `refuse:no-proof` floor, `selectLessons`, `lessonLinesForBrief`,
   the `probe:<id>` tags), `engine.ts` (the T-11 green-seal gate and the seal logs), `judgment.ts`,
   `prompt-engine.ts`, `harvest.ts`, `vault.ts`, `report-intake.ts`, and the writers exercised by
   `lesson-writers.test.ts`. **At each hop say whether you verified it by reading code, by running a
   test, or neither.** A chain with one unverified hop is a broken chain — name it.
2. **Is the loop closed?** Concretely: after a red seal on run A, does anything change in run B that
   would NOT have happened otherwise? Find the strongest evidence for or against (a test you can run,
   or a probe that prints the selected lessons for a synthetic project). State your conclusion as
   CLOSED / OPEN / PARTIAL with the evidence. Do not accept "it is wired" without showing the path
   from the store into the prompt.
3. **The repair loop (`self-FIXING`).** Trace: failing gate → who/what decides a repair is needed →
   what produces the patch (`patch.ts` `applyStrReplace`, `codegen.server.ts` repair paths,
   `headless.ts` `repairTreeDir`, the `repair` verb) → what re-verifies it (`verify.server.ts`,
   `maker-score.ts`, `compile-check.server.ts`, the DoD gate) → and where a human is required. Then
   answer: **can RapidTool fix a broken artifact it produced, without a human, today?** Cite the code
   that says yes or no. Include the honest limits (patch-budget / conflict semantics / anything
   registered as still-open).
4. **What "self-improving" would require that does not exist here.** Be specific and technical, not
   aspirational: e.g. no cross-run weight/parameter updates, no eval-driven prompt promotion, no
   automatic regression-suite growth from real failures, no memory of *which repairs worked*, no
   outcome-attributed ranking. For each, state whether the repo has ANY building block for it
   (file:line) or nothing at all.
5. **The smallest real upgrade that would make the loop meaningfully closed.** ONE proposal, sized
   honestly, with the exact files it would touch and how a future session would verify it worked.
   (Lane 5 owns the full plan — keep yours to the single highest-leverage change and hand the rest to
   it explicitly.)
6. **Plain-language bottom line (3–6 sentences)**: does it learn? does it fix itself? what is the
   gap in one line?
