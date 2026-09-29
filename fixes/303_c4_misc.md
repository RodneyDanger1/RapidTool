# fixes/303_c4_misc.md — LANE L4 · SCRIPTS/GUARDS/CLI HYGIENE (CODER C4)

> Wave W42 · cards L4-G1…G13 per `wave_plans/W42/SPEC.md` §2 · L4. HEAD `424f9e5`.
> File box (sole writer): `scripts/gate.sh` · `scripts/gate-verdict.test.mjs` · `scripts/migration-plan.mjs`
> · `scripts/migration-plan.test.mjs` · `scripts/write-atomic.mjs` · `scripts/write-atomic.test.mjs` ·
> `scripts/browser-guard.mjs` · `scripts/browser-guard.test.mjs` · `scripts/brand-check.mjs` ·
> `scripts/preview.mjs` · `scripts/rapidtool-cli.mjs` · `scripts/cli-exit-taxonomy.test.mjs` ·
> `src/lib/runtime-log.server.ts` · `src/lib/runtime-log.server.test.ts` · `src/lib/headless.ts` · `package.json`.
> Rules honored: PATCH-FIRST, additive-only · `node --check` per edited file · legs FOREGROUND · NO keyed
> calls · per-card evidence line below (append-only, `file:line · before → after · proof`).

## Status board

| Card | What | Status |
|---|---|---|
| L4-G1 | gate.sh zero-pass guard + double-mode stderr tails + verdict test (zero-pass case) | TODO |
| L4-G2 | migration-plan de-dupe (`authSchemaCopyState`) + anti-vacuity diagnostic | TODO |
| L4-G3 | write-atomic mkdir inside try + rename-failure pin | TODO |
| L4-G4 | browser-guard dead bare `::1` drop + `[::1]` pin | TODO |
| L4-G5 | "am I main?" idiom (brand-check · preview · write-atomic) | TODO |
| L4-G6 | readRtTail bounded fd read + >256 KB tail pin | TODO |
| L4-G7 | tree-run dirDirty note | TODO |
| L4-G8 | envelope code doc-guard + static code-literal leg | TODO |
| L4-G9 | doctor spend surfacing | TODO |
| L4-G10 | package.json `--test-reporter=tap` pin (both legs) | TODO |
| L4-G11 | USAGE emit line `[--verify-kind] [--force]` | TODO |
| L4-G12 | parseArgs refusal remedy clause (verify/update) | TODO |
| L4-G13 | envelope field-check sweep (doctor/diagnose/fixtures --draft) | TODO |

## Evidence

(log opened pre-edit per spec §2 per-lane rules — 2026-09-28, coder C4.)
