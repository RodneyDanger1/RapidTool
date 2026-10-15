# W357 · lane `fix-preview` — the console Preview broke, and the docs now lie

**Wave:** W357. **Persona:** `aperture`. **Author:** the wave parent. Read this FIRST.

## Mission

Repair the console Preview/export path that the restored refuse default broke, and reconcile every doc
claim that the new emission semantics made stale. Both are honesty surfaces: a Preview that dead-ends and
a RUNBOOK that describes the old behaviour are the same class of defect.

## The evidence

- `restore-oracle` (`fixes/356_restore_oracle.md`): `src/lib/software-export.ts:96` calls
  `scaffoldProject(project)` with **no options**, so with `underProduced` now defaulting to `refuse`, the
  console Preview/index returns the coded refusal for a below-floor run. Measured:
  `software-export.test.ts` **9/10**, `error: 'the tree is surfaced rather than withheld'`.
- The same log flags `RUNBOOK.md` §6a and §9.7 as stale: they describe the old "no archive for a
  below-floor run" behaviour, which the 354 wave deliberately changed to "surface the tree with the
  unmissable RED TREE banner and return a downloadable ZIP".

## Owned files (yours alone)

`src/lib/software-export.ts` · `src/lib/software-export.test.ts` · `RUNBOOK.md` · `scripts/README-cli.md` ·
`START-HERE.md` · `AGENTS.md` · `README.md`

## MINI-TASK PLAN

1. **Fix the Preview at the cause.** The console's `emitSoftware` must explicitly opt in to surfacing a
   below-floor tree (the `allowUnderProduced` / banner policy), so a below-floor run shows the tree with
   its RED TREE banner and offers the ZIP — while a run that is red for any *other* reason still returns
   the coded refusal with no archive. Keep the distinction the docs describe.
2. **Keep the CLI honest too.** Confirm the CLI's refuse/banner semantics and `scripts/README-cli.md`
   agree on the bytes (the CLI default is refuse; `--red-tree banner` surfaces).
3. **Reconcile the docs to the bytes.** Fix the stale claims, and while you are in the docs fix the
   high-value drifted ones the audit recorded (`fixes/355_0_audit_wave.md` §2.6 L28–L30): `AGENTS.md`
   `:347-348` (`resumeAccepted` is consumed — 7 hits in `codegen.server.ts`), the count blocks in
   `AGENTS.md:243-246` / `README.md:454-456` / `docs-FOLDER-MAP.md:18-20`, and the 13 undocumented
   `RT_E_*` codes (add them to the doc list; `src/lib/errors.ts` is **not yours** — the code registry
   itself is owed to `fix-gates`, so document only what `ERROR_CODE_DOC` already carries and report the
   rest).
4. **Re-derive every count you touch** with the command beside it. Never paste a number you did not
   measure.

## Verification

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
node --experimental-strip-types --test --test-reporter=tap src/lib/software-export.test.ts
node --test --test-reporter=tap scripts/README-cli.test.mjs
npx tsc --noEmit
```

## Logging

`fixes/357_fix_preview.md` — skeleton first, then append: the Preview fix, the before/after test result,
and one row per doc claim (`claim | where | bytes | command | old→new`).

## Do not

- Do not edit `scaffold.ts` (`fix-tests`), `vite.config.ts`/`migrations/**` (`fix-build`),
  `eslint.config.mjs` (`fix-lint`), `scripts/check-module-coverage.mjs`/`quality-ratchet*` (`fix-gates`),
  `src/lib/errors.ts`, the register, or another lane's log.
- Do not raise the number of emitted files for a refused run to "fix" the Preview — the refusal is a
  safety policy; the Preview must opt in instead.
- No keyed LLM call. No git writes. **No mock/stub/fake/demo code on a production path.**
