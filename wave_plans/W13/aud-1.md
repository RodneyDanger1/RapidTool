# 223 · AUDITOR 1 — Critical-path pre-mortem: will the owner's keyed run (Step 0) succeed, and where exactly will it break?

**Read this file FIRST.** You are the coding-analysis agent on the overhaul. Four siblings are running
(feature designs, integration map, canonical task list, external verification). None of them reads the
**keyed execution path at code level**. You do. Your product tells the owner what Step 0 is about to do
— before he spends it — and hands Phase C concrete, file-level targets.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
TREE STATE: green + committed (7582771); boundary gate green (fixes/218 §5).

HOST TRUTH (do not re-litigate): NO model key on this machine (`doctor` → `llm.configured:false`), so you
CANNOT execute the keyed path. Your audit is a code-level pre-mortem: read the keyed branches, trace what
they will do when a key IS present, and find the places where they will break, stall, silently degrade,
or refuse. Label every finding: `TRACED` (read in code) — never imply you ran it.

THE OWNER'S STANDARD (verbatim): "no hallucinations/fake code/… 100% truth … things not working,
incomplete portions, bad code." Every finding = `file:line` read today + the behaviour you can prove from
the code + what it costs. If a branch is too tangled to follow, say `COULD-NOT-TRACE + where you stopped`
— that is a finding too, not a failure.

RULES:
1. WRITE ONLY your deliverable. Never edit src/scripts/docs; no git mutations; never execute clone code.
2. ALLOWED: read-only reads/greps; ≤3 targeted test runs
   (`node --experimental-strip-types --test --test-concurrency=2 <file>`); keyless CLI runs on a scratch
   project OUTSIDE the repo (`C:/Users/mnril/w13h_scratch/`, Windows-style paths: `C:/Users/…`).
   FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build`.
3. Skeleton first, then fill in passes. Honest partial > invented completeness.
```

**Your deliverable:** `research/multiagent/223_critical_path_premortem.md`

## The chain to audit (in execution order — budget your reads to the decisive functions)

1. **The driver:** `scripts/run-eval.mjs` — what a keyed run actually does end-to-end; what it writes
   (`results.json`, `_keyed-run.log`); where it could throw before writing anything (the worst failure
   mode: a crash that produces no number at all).
2. **P6 synthesis — the artifact ceiling:** `codegen.server.ts` `liveP6Synthesis` (~:2423) and
   `engine.ts` `upgradeP6Keyed` (~:2851-2887). Trace: what a keyed synthesis must return for
   `p6-brief-fit` to pass (the probe's own conditions), and every parse/validation gate the model's reply
   must survive (the envelope readers — `219_wdC` verified the G6 seam; check there is no remaining
   silent-null path on the *success* path).
3. **The verify loop:** `verify.server.ts` `verifyAndFixServer` (~:923-1055) — the model may never
   declare the pass (:1015); where do failures land; does a non-converging loop burn the budget or stop
   clean?
4. **The budget seams:** `token-ledger.ts:269-339` + wherever `SessionBudgetExceeded` is thrown. A keyed
   maker run that dies on a budget throw is the most plausible silent "4/9" cause on this tree. Find the
   default caps a keyed run would meet (`create` printed `tokenCap:null` — trace what null means with a
   key) and say whether the defaults are survivable for a 13-phase run.
5. **The seal + emit:** `engine.ts:1452-1496` (seal + `p<phase>.seal.unmet`), `headless.ts:669-691`
   (`sealedWithFailures`), `scaffold.ts` emit + `.gitignore`, `compile-check.server.ts` `treeRun` — does
   the emitted artifact path survive a red seal, and what exit code does the owner actually see?
6. **The repair loop:** `headless.ts` `repairTreeDir` (~:2440-2727) — the three converge conditions
   (~:2654-2656) and the budget-exhausted path (~:2704-2710). Keyed, does it converge on a realistic
   failure or spin?
7. **The scorecard:** `maker-score.ts` M1–M9 — for each criterion, the code that decides it, and which
   criteria CANNOT be green given today's code (the four zeros: M2 runs, M3 convergence, M4
   verified-with-evidenceHash, M9 clean stop). This is the "predicted score" section.

## The deliverable's shape

1. **Top: the pre-mortem verdict.** A predicted outcome for a keyed run on this tree, as a *range with
   reasons* (e.g. "5–6/9, failing M2/M3/M4/M9 for these code reasons"), plus the single most likely
   crash-and-no-number point.
2. **Will-break table:** `id | where (file:line) | what happens | why | cost | fix shape (1 line) |
   verified-how (TRACED / RAN-keyless / COULD-NOT-TRACE)`. Rank by damage to Step 0.
3. **Per-criterion table (M1–M9):** the deciding code, today's expected value, and what would have to
   change on this tree for it to flip.
4. **The 3 highest-value Phase C targets** — for each: the file, the seam, and the one test that would
   prove the fix.
5. **Honest coverage:** what you read, what you did not, and where you ran out of budget.
