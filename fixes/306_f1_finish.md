# fixes/306_f1_finish.md — F1 · THE FINISHER (L4/E4 tail + all-lanes card walk)

> W42 close-out lane. HEAD `79f35b1` (round 3: boundary sweep 22/22 GREEN, quarantine wire, P-7/P-8, docs reconciled).
> Box (sole writer): the L4/E4 box per `304_d4_misc.md` — `scripts/gate.sh` · `scripts/gate-verdict.test.mjs` ·
> `scripts/migration-plan.mjs` · `scripts/migration-plan.test.mjs` · `scripts/write-atomic.mjs` · `scripts/write-atomic.test.mjs` ·
> `scripts/browser-guard.mjs` · `scripts/browser-guard.test.mjs` · `scripts/brand-check.mjs` · `scripts/preview.mjs` ·
> `scripts/rapidtool-cli.mjs` · `scripts/cli-exit-taxonomy.test.mjs` · `src/lib/runtime-log.server.ts` ·
> `src/lib/runtime-log.server.test.ts` · `src/lib/headless.ts` · `package.json`.
> Plus (write): `fixes/304_d4_misc.md` board + `fixes/305_e4_misc.md` close + `fixes/306_f1_finish.md` (this). 5 siblings live — read fresh.
> Rules: PATCH-FIRST, additive-only · `node --check` per edited file · legs FOREGROUND · NO keyed calls · one writer per file.

## Task 1 — E4 tail: G8 finish + G9-G13 (state at t0, byte-verified)

| Card | t0 state | Evidence |
|---|---|---|
| G8 | NOT landed — `safe()` shape-only at `rapidtool-cli.mjs:215-216`; no `ERROR_CODE_DOC` hit in the CLI; no static leg in `cli-exit-taxonomy.test.mjs` | `grep -n ERROR_CODE_DOC scripts/rapidtool-cli.mjs` → 0 |
| G9 | NOT landed — no `spend` anywhere in `src/lib/headless.ts` | `grep -in spend src/lib/headless.ts` → 0 |
| G10 | NOT landed — no `test-reporter` in `package.json` | `grep -n test-reporter package.json` → 0 |
| G11 | NOT landed — USAGE emit row `:3814` lacks `[--verify-kind] [--force]` | read `:3814` |
| G12 | TBD — check `parseArgs` refusal message | pending read |
| G13 | TBD — live-run sweep | pending |

## Task 2 — quarantine wire (from `305_e4_misc.md` Task 1) — ALREADY LANDED in `79f35b1`

- (to record with evidence below)

## Task 3 — the all-lanes SPEC card walk (L1 E-1…E-6 · L2 P-1…P-8 · L3 D-1…D-6 · L4 G-1…G-13)

- (to fill: each card → landed/struck, evidence line)

## Evidence (append-only)
