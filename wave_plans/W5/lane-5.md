# W5 · LANE 5 — T-107.5 run-side acceptance fixtures + pass@k (Wave H)

**Mission.** Make acceptance testing honest and agent-proof: move the acceptance fixtures OUT
of the agent-writable project into RUN-SIDE grader files, and add trials + pass@k/flakiness
accounting to the eval harness. Keep `run-eval.mjs`'s honest `redTreeBanner` metric intact.

**Done-when:** fixtures live in run-side grader files the emitted project cannot see/write;
`npm run eval` reports trials + pass@k honestly (keyless run still completes with honest
skips); the emitted project cannot reach its grader; typecheck 0; scripts leg green.

**Owned files:** `scripts/run-eval.mjs`, `research/eval-corpus/**` (fixture/grader layout),
`src/lib/brief-fixtures.ts` (only if a fixture path constant must move), `scripts/*.test.mjs`
(new/updated eval tests), `fixes/216q_eval_fixtures.md` (NEW).
NOT yours: codegen/scaffold/engine/doctor (L1), harvest/docs (L2), headless/cli/dod (L3),
llm/deepseek/verify/chat/crew (L4).

**MINI-TASK PLAN:**
1. RECON: read dossier 107 T-107.5 row + `100_factory_blockers.md` P0-05 if present; read
   `scripts/run-eval.mjs` fully (metrics: `redTreeBanner`, handover evidence, corpus layout);
   list every place a fixture is currently readable from inside the emitted project.
2. MOVE fixtures: grader files live run-side (e.g. `research/eval-corpus/<case>/grader/…`),
   wired from `run-eval.mjs`; the emitted tree must contain NO grader content it could read or
   game. Keep the corpus case names stable (TA-15's probe expects `coffeehouse2home-property-ledger`
   to remain census-able — coordinate: do not restructure that case's tree layout).
3. TRIALS + pass@k: run each acceptance case N trials (configurable, default small), report
   pass@k + flakiness per case; a case that flips between trials is FLAKY (honest metric, not a
   fabricated pass). Keep totals + the JSON summary shape additive.
4. Tests: a scripts-leg test proving (a) grader files are not visible to the project tree,
   (b) pass@k math on synthetic outcomes, (c) keyless run reports skips honestly.
5. `fixes/216q` — skeleton first; work log + real command output (a keyless `npm run eval` run
   is fine for evidence).

**TRAPS:** run-eval is the maker-test path — its CLI contract (flags, exit codes, JSON keys)
must stay backward-compatible (additive only). The `.env` key must never be printed or
committed; keyless runs are the honest default in your evidence.

**Verification:**
```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
npm run typecheck
node --test "scripts/**/*.test.mjs"
npm run eval   # keyless: must complete with honest skips (record the real output)
```

**Logging:** `fixes/216q_eval_fixtures.md`. Budget death ⇒ plain statement of what landed.
