# fixes/292_l3_eval.md — W40 · LANE L3 · THE EVAL/ACCEPTANCE/OBSERVABILITY REMAINDER

**Lane:** W40 L3 (`deleg_1eb6fe2b` task-2; per `292_w1_recorder.md` lane map). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → shell grep only; SHORT one-liners).
**Mission:** (1) `run-eval.mjs` surfaces beyond K9's grader work — results/history schema polish (every field real), the acceptance label rendered wherever the operator reads results (CLI + console), funded vs unfunded end classes in output; (2) fixtures verb server-side completeness beyond N5 (`fixes/281_n5_ops.md`) — draft/approve paths, seat refusals' rendering, review UI data path (`fixtures.review.ts`); (3) run-observability — `run-in-progress.json` marker correctness, checkpoint operator visibility (K7 owns the diagnose-arm item — check first), telemetry pane inputs vs real fields (K12 settles the registry — coordinate).
**Contract:** CODE + `node --check`; targeted single-leg runs allowed (FOREGROUND only, expected counts recorded); NO full gates / NO keyed calls. Verify-then-fix, one evidence line per item. Log `for <lane>` on files other lanes own; lower-ID wins on collisions. Read fresh bytes immediately before every patch (K9 + L3 both touch `run-eval.mjs`).
**Baseline HEAD:** `2fa3cd9` (live lanes K1–K15 + L1/L2 writing concurrently at open).

## Sources read at open (t≈01:05–01:20)

- `292_w1_recorder.md` (18-lane map) · `fixes/292_l1_register.md` (L3 = W-14/W-15 residuals + checkpoint visibility) · K-lane logs on disk: `290_k7_tinyfixes.md` (item 9 = diagnose `checkpoint:{present,path,savedAt}` PENDING; item 3 = packet `project.acceptance` label) · `291_k12_agents.md` (events settlement; registry) · `290_k8_records.md`.
- **K9 re-read when it landed** (`290_k9_universality.md`, t≈01:20): K9 owns `scaffold.ts` emit + `run-eval.mjs` **grader logic** (`checkExpectedBehavior` + `verification` label + `passesAcceptance` clauses) + `eval-corpus/**` (new fixtures/graders). K9's own log warns L3 is a "possible same-file neighbour — re-read bytes before every patch". ⇒ L3 MUST NOT touch: grader parse/assert logic, `checkAcceptance` structural additions, corpus/graders. L3 territory: persistence/output/marker/render.
- `fixes/281_n5_ops.md` (N5: OPS-1 `exit_code` on draft/approve envelopes landed; OPS-3 exit-taxonomy test created; **item 3 (grader cards) NOT landed** — K9 picked it up).
- F4 summary `subagent-summary-3-20260926_195114_773501.txt` (grader cards; `meanAtLeast:1` unreachable-on-first-run contradiction; grader leak scan bounds; crash handler; priorFor last-trial).

## Findings + fixes ledger (append-only; evidence = command + observed output)

_(starting — verifying now)_
