# W358 · lane `close-taxonomy` — the registry/exit-code contract, the owed code, and the missing pins

**Wave:** W358 (the final closure wave). **Persona:** `ledger`. **Author:** the wave parent. Read FIRST.

## Mission

Close the `testsScripts` red and the ratchet's remaining gaps. The W357 boundary
(`%TEMP%\rt-campaign\w357-boundary-gate.log`) is **8 of 10 stages green**; the single scripts-leg failure is
`exit taxonomy — EXIT_BY_CODE is exactly the README error table (both directions)` at
`scripts/cli-exit-taxonomy.test.mjs` (per `research/multiagent/357_cartographer.md` R-9: `fix-preview` grew
`scripts/README-cli.md`'s registry table from 35 to 56 rows to match `ERROR_CODE_DOC`, and 21 of those codes
have no `EXIT_BY_CODE` mapping, so the bidirectional parity test now fails).

## Owned files (yours alone)

`scripts/README-cli.md` · `scripts/cli-exit-taxonomy.test.mjs` · `scripts/rapidtool-cli.mjs` (the
`EXIT_BY_CODE` table **only** — touch no other logic in it) · `src/lib/errors.ts` ·
`scripts/quality-ratchet.mjs` · `scripts/quality-ratchet.test.mjs` · `scripts/quality-ratchet.floors.json`

## MINI-TASK PLAN

1. **Resolve R-9 correctly.** Read the test to learn which direction it enforces, then choose the honest
   resolution: a code with **no CLI arm** has no exit code, so the README's `typical exit_code` must not
   assert one, and the parity test must express that fact (e.g. an explicit "no CLI arm" class) rather than
   be weakened to accept anything. **Do not** add invented exit codes to `EXIT_BY_CODE`, and **do not**
   delete the 21 README rows — the table *was* genuinely incomplete. State the chosen contract in the log.
2. **Land the owed registered code** that `fix-gates` armed and left documented in
   `fixes/357_fix_gates.md` §5: `RT_E_RATCHET_METRIC_UNAVAILABLE` in `src/lib/errors.ts`'s `ERROR_CODES`
   **and** `ERROR_CODE_DOC` (the exact wording is in that log). Then reconcile
   `quality-ratchet.floors.json#owedCodes` and confirm `canary.errorCodes.owed-code-not-emitted` and
   `canary.errorCodes.registered` both still behave.
3. **R-11** (`research/multiagent/357_cartographer.md`): `kindFit.game.surfaceOk` and
   `kindFit.library.surfaceOk` have **no pin at all**, so two readings the ratchet can already see failing
   cannot move it. Add the pins, and prove with a planted case that each now fails at floor−1.
4. **Re-pin the stale floor reading.** `fix-lint` moved `lint.problems` from 947 to **5** (a real
   improvement), so the floor's recorded reading is stale. Re-pin it honestly: the honest bar stays **0**
   and the reading is now 5. Verify the ratchet still cannot pass while `lint.problems > 0`.
5. Keep every floor honest: a floor may only rise, and no metric may read `pass` while `unavailable`.

## Verification

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs
node --test --test-reporter=tap scripts/README-cli.test.mjs
node scripts/quality-ratchet.mjs --all
node scripts/quality-ratchet.mjs --selftest
node --test --test-reporter=tap scripts/quality-ratchet.test.mjs
npx tsc --noEmit
```

## Logging

`fixes/358_close_taxonomy.md`. Record: the contract you chose for a code with no CLI arm (with the test's
own assertion quoted), the registered code's exact text, the two new pins with their planted proofs, and
the re-pinned lint floor.

## Do not

- Do not edit `src/lib/codegen.server.ts` / `compile-check.server.ts` (`close-kindjsx`),
  `src/lib/scaffold.ts` / `scaffold.test.ts` / `src/components/software-preview.tsx` (`close-ui`), the
  register, or another lane's log.
- Do not weaken the parity test, delete README rows, invent an exit code, or lower a floor.
- No keyed LLM call. Do not run the full gate (the parent runs the boundary). No git writes.
  **No mock/stub/fake/demo code on a production path.**
