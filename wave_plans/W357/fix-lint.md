# W357 · lane `fix-lint` — lint must pass without hiding a real error

**Wave:** W357. **Persona:** `ledger`. **Author:** the wave parent. Read this FIRST.

## Mission

Make `npm run lint` exit 0 **honestly**. The W356 boundary measured `lint:{ok:false,exit:1,
problems:947}` — `51 errors, 896 warnings`. `934 of the 947` come from the **untracked** `testruns/**`
fixture corpus that `eslint .` crawls (generated artifacts of past runs of the factory's own output).

Two distinct jobs: stop linting things that are not source, and fix the real problems in what is source.

## Owned files (yours alone)

`eslint.config.mjs` · `package.json` (the `lint` script only) · `.prettierignore` if needed
Plus: you may fix lint problems in **source files no other W357 lane owns** (see the do-not list). If a
real error sits in a file another lane owns, **report it in your log and leave it** — do not edit it.

## MINI-TASK PLAN

1. **Separate generated output from source.** `testruns/**` is untracked run output (325 files) and must
   not be linted. Do this in the eslint config (an ignore), and justify it in the log: linting generated
   third-party-shaped output is not a quality signal. Also check whether any other generated directory
   (`dist/`, `.vercel/`, `builds/`, `vault-e2e/`, `research/eval-out/**`) is being crawled.
2. **Report the real count** after the ignore: re-run and record the true source-problem count.
3. **Fix the real errors at source.** Every remaining error must be fixed properly — a correct type, a
   `const`, a removed unused import, a real regex escape. **Do not** silence an error with an inline
   disable comment unless the code is *correct as written* and you say exactly why in the log.
4. **Do not weaken a rule to reach zero.** If a rule catches a genuine class, keep it. If you must change
   a rule, name the class it was catching and the evidence that the class is not real here.
5. Keep `eslint-config-prettier` in force (formatting stays prettier's job).

## Verification

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npm run lint                        # expect exit 0
npm run lint 2>&1 | Select-String "problems"   # record the residual count
npx tsc --noEmit
```

## Logging

`fixes/357_fix_lint.md` — skeleton first, then append: before/after problem counts, the ignore list you
added with the reason, every source error fixed (file:line + old→new), and every disable comment with its
justification.

## Do not

- Do not edit `vite.config.ts`/`migrations/**`/`src/lib/db.ts`/`pglite-dialect.ts`/`scripts/migrate*.mjs`
  (`fix-build`), `src/lib/software-export*` or any doc (`fix-preview`),
  `scripts/check-module-coverage.mjs` / `scripts/quality-ratchet*` (`fix-gates`),
  `src/lib/scaffold.ts` / `scaffold.test.ts` / `wild-step.test.ts` / `headless.test.ts` (`fix-tests`),
  the register, or another lane's log.
- Do not reach zero by disabling rules wholesale, by adding blanket ignores for `src/**`, or by
  suppressing real errors. A green lint that hides a defect is the failure mode this campaign exists to
  remove.
- No keyed LLM call. No git writes. **No mock/stub/fake/demo code on a production path.**
