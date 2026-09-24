# W12 · LANE C — Bug hunter 3: knowledge/algorithms correctness (the 109 C-series)

**Read this file FIRST.** Then `AGENTS.md`, `RESUME.md` §4 item 18 (the C-series list), §4 item 16-17,
`research/multiagent/109_*` (the source dossier for C-0x), `src/lib/knowledge.ts`,
`src/lib/algorithms.ts`, `src/lib/harvest.ts` headers, and `fixes/216c_algorithms.md` (what the
algorithms wave already landed, so you do not re-fix it).

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2, git-bash /c/Users/mnril/Desktop/RapidTool Main).
PATH HAS A SPACE → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
MANDATORY RULES (the parent rejects violations):
1. PATCH-ONLY targeted edits with the `patch` tool. Never write_file on an existing file.
2. No mock/demo/stub/placeholder/TODO code. Real logic, file style, explicit `.ts` import extensions.
3. NEVER run git checkout/stash/reset/clean/commit.
4. Stay strictly inside your owned files. Need a change elsewhere? STOP and report it.
5. Verify with `node --experimental-strip-types --test --test-concurrency=2 <your test file>` and
   AT MOST ONE `npm run typecheck` at the very END. NEVER run `npm test` or `npm run build`
   (6 other lanes share this 8 GB machine; never run two heavy commands at once).
6. Every claim needs a command you actually ran + its real output. Never invent counts. If you run
   out of budget, say so plainly and describe the real state.
7. If an existing test pins OLD behaviour you may update it — record old → new + why. Never weaken
   an assertion or delete a test to get green.
8. Write your landing log at the path below (only writer): skeleton FIRST, then fill.
```

**Owned files (ONLY these):** `src/lib/knowledge.ts`, `src/lib/knowledge.test.ts`,
`src/lib/algorithms.ts`, `src/lib/algorithms.test.ts`, `src/lib/harvest.ts`, `src/lib/harvest.test.ts`
**Landing log:** `fixes/217l_knowledge_algorithms_defects.md`

**Persona:** you are the correctness hunter for the *knowledge and ranking* layer — the code that
decides which lessons and findings reach a prompt. A silent bug here changes what every future run
believes.

## ⚠️ Rule one: FALSIFY BEFORE FIXING

The C-series was written against an older tree and several items have since landed. For **each**
item below: (1) locate the code today, (2) write a standalone probe **outside the repo**
(`C:/Users/mnril/w12c_scratch/`) or a failing test that demonstrates the defect, (3) paste the raw
output. If it does **not** reproduce, mark it **FALSIFIED-today** with the command that disproved it
and move on — do not "fix" working code. Only reproduced defects get patches.

## Candidate defects (verify each; the dossier owns the wording, the disk owns the truth)

- **C-09 — `KnowledgeStore.entries()` returns its live cache array.** If a caller can mutate the
  store's internal array, that is an encapsulation bug with a silent-corruption blast radius. Check
  the real shape today, and whether any production caller mutates the returned array (grep the
  callers). Fix by returning a copy **only if** it reproduces and does not break a hot path — if a
  caller relies on identity, report it instead of silently changing semantics.
- **C-06 — stemmer asymmetry.** Two paths that should stem the same way do not (e.g. query-side vs
  corpus-side, or one builder missed the stemmer). Prove it with a probe that feeds the same token
  through both paths and prints the two outputs.
- **C-10 — three stemmers feeding "FusionRank".** The ranking stack reportedly mixes plural
  reduction sources. Establish the truth: how many distinct stemming implementations actually
  participate in `fusionRank`, and do they disagree on a fixed corpus? If they do, the honest fix is
  usually to route all three through **one** documented stemmer (the dossier may name the intended
  one) — never to delete a stemmer whose behaviour other tests pin without recording old → new.
- **C-02 — phantom export.** A symbol that appears exported but is not reachable/used. Verify with
  `grep -rn` for importers; fix the honest way (remove the dead export, or make it real) and record
  which you did and why.
- **C-08 — harvest cap.** `RESUME.md` records the harvest cap + zero-budget tests as landed in W5-L2.
  **Verify it** (find the cap enforcement and its test, run it) and mark FALSIFIED-today if it holds.
  Also check the two documented zero-budget note branches.

## Then

- **Anti-regression beat:** `knowledge.ts` is imported by `engine.ts` (lazily) and by
  `lesson-writers.test.ts`; `algorithms.ts` has a determinism guard. After your edits run, in this
  order: `knowledge.test.ts`, `algorithms.test.ts`, `harvest.test.ts`, then
  `lesson-writers.test.ts` — paste all four result tails. If any drops versus the counts you
  recorded BEFORE editing, that is your regression to fix.
- **Then** one final `npm run typecheck`.
- **Log:** per item — VERIFIED-today (probe output) / FALSIFIED-today (command) / FIXED (file:line,
  old → new, tests added, blast radius). Plus a closing list of everything you did NOT do.
