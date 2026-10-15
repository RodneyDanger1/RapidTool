# W356 · lane `restore-tests` — the CLI, the remaining test drift, and the stale hard-coded values

**Wave:** W356 (green recovery + ratchet). **Persona:** `ledger`. **Author:** the wave parent.
**You are 1 of 6 lanes.** Read this FIRST — it is your authoritative plan.

## Mission

Close the test-drift cluster this lane owns and fix the two mechanical CLI defects the red suite is
pinning. Every fix must state whether the **source** or the **test** was wrong.

Verified facts (parent + adversarial panel, `fixes/355_0_audit_wave.md` §2.7):

| red item | classification | where |
|---|---|---|
| `wild-step.test.ts:1399` / `:1415` — `'"complete"' not assignable to '"awaiting_hitl" \| "rejected" \| "locked"'` | **test-wrong** (the `wildFixture` helper is narrowed to 3 of 6 `PhaseStatus` values) | your file |
| test **367** — `C-14 p6-arch must fail closed on a keyed attempt with no tree` | **test-wrong** (its `keylessNoTree` fixture keeps 8 `p6.synthesis.*` rows, newest `refused`, so it is not the keyless floor it claims) | your file / fixture |
| test **233** — `348 (W1) diagnose --project … per-phase stages` | **source-wrong** (a hard-coded `capture:"scripts/rapidtool-cli.mjs:455"` vs the real site at `:519`) | `scripts/rapidtool-cli.mjs` |
| test **208** — `341-6 keyless unattended seals complete` | **source-wrong** (a new `terminalStatusOf` renames `summary.status`, leaving `scripts/README-cli.md:332` and the test stale) | `scripts/rapidtool-cli.mjs` + the doc claim |
| test **585** — `scripts typecheck: no NEW errors beyond the recorded per-file budget` | **source-wrong** (a new `TS2339` at `typecheck-scripts.test.mjs:219`) | your file |
| test **586** — `npm run typecheck runs BOTH legs` | red only because leg 1 carries the type errors — re-verify after the other lanes land | your file |
| L14 — `doctor --project <file>` refused as an unknown flag while the arm consumes it (`:275-285` vs `:1419`, `:5731`), breaking the pre-existing E-25 test | **source-wrong** | `scripts/rapidtool-cli.mjs` |

Note: the remaining failures (204/216/217/218/246/345/407/415 and tests 163/164, 233's sibling) are
**source-wrong in other lanes' files**. `restore-tests` is a lane, and they land in
`restore-oracle` / `restore-census` / `restore-guards`. Re-derive them at the end; if any is still red
because of a file you own, fix it; otherwise report it.

## Owned files (yours alone)

- `src/lib/wild-step.test.ts`
- `scripts/rapidtool-cli.mjs` (+ its `*.test.mjs` suites: `cli-exit-taxonomy.test.mjs`,
  `rapidtool-cli-352.test.mjs`, `rapidtool-cli-edit.test.mjs`, `rapidtool-cli-fixtures.test.mjs`,
  `rapidtool-cli-lesson.test.mjs`, `cli-run-busy.test.mjs`)
- `scripts/typecheck-scripts.test.mjs`
- `scripts/README-cli.md`
- the test fixture for item 367 (name it in your log)

## MINI-TASK PLAN

1. Fix the two `wild-step.test.ts` type errors at the **cause** — widen the fixture helper so it can
   express every `PhaseStatus`, rather than casting at the call site. Say in your log which side was
   wrong and why.
2. Fix test 367 by giving it a fixture that genuinely is the keyless floor (zero `p6.synthesis.*`
   rows), or by re-pointing it at one. **Coordinate:** `restore-guards` owns `scripts/prevention/**`
   and `scripts/guards/**`; if 367's fixture lives there, report it in your log and leave that file
   alone.
3. Fix `doctor --project` so the documented flag is accepted.
4. Fix the stale `capture:"…:455"` path and reconcile `terminalStatusOf`'s rename with
   `scripts/README-cli.md:332` — the doc and the bytes must agree, and if the doc is the stale side,
   update the doc **and** say so.
5. Fix the `typecheck-scripts.test.mjs:219` `TS2339` at its cause (the typing nuance), not by loosening
   the budget. The ratchet must keep biting.
6. Re-derive the full red list at the end of your run and report which items are still red **and whose
   file owns each**.

## Verification (exact commands)

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
npx tsc -p tsconfig.scripts.json --noEmit
node --experimental-strip-types --test --test-reporter=tap src/lib/wild-step.test.ts
node --test --test-reporter=tap scripts/typecheck-scripts.test.mjs
node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --project build.json
```

## Logging

`fixes/356_restore_tests.md` — skeleton first, then append. One row per fixed item:
`item | source-or-test | old→new | evidence command`.

## Do not

- Do not edit `src/lib/{scaffold,scaffold.test,headless,headless.test,compile-check.server}*.ts`,
  `scripts/prevention/**`, `scripts/guards/**`, the root docs, the register, or another lane's log.
- Do not loosen a ratchet, a budget, or an assertion to reach green.
- Do not run `gate.sh` / `npm run build` / full `npm test`. No keyed call. No git writes.
- **No mock/stub/fake/demo code on a production path.**
