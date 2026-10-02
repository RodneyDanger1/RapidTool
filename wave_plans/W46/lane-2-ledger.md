# W46 / 332-2 — "Ledger" — spend truth and budget

Read `wave_plans/W46/README.md` first. Your log: `fixes/332_2_ledger.md`.

## Owned files (STRICT)

`src/lib/token-ledger.ts` · `src/lib/headless.ts` · `src/lib/doctor.ts` + their `*.test.ts`

## Findings you are fixing

**L1 — `summary.budget.spent` reports per-invocation spend, so a run's cost is invisible.** Measured
across three successive `gate` calls on ONE project: `spent: 446` → `spent: 0` → `spent: 77654`. Each
CLI invocation is a fresh process, so the session ledger starts empty; the operator reading
`summary.budget` sees the last call, not the run. `doctor` is worse: its spend block reads
`calls: 0, promptTokens: 0, completionTokens: 0` even after a project has run keyed.

Terminology you must get right before changing anything: `token-ledger.ts` documents **one ledger +
one cap** where `RAPIDTOOL_TOKEN_CAP` binds the whole *session*, and `sessionTokenBudget()` is the
accessor. Read `:2856–2916` of `codegen.server.ts` (not yours) and the ledger's own docblock so your
change does not weaken the existing cap semantics. Deliver: **per-project persisted spend** so
- `summary.budget.spent` reports the project's **cumulative** token spend for the run,
- `doctor`'s spend block reports the project's real recorded spend (and keeps `estimatedCostUsd: null`
  with its honest "no price catalog" line when no prices are supplied),
- the existing session cap still stops a runaway.

`src/lib/engine.ts` and `src/lib/types.ts` are **unowned** (W46 contract C2): the persisted field needs
them. **Do not edit them** — write the exact requested shape (field name, type, default, the read/write
sites and the migration-in-place rule for records that lack it) into your log and in your final report,
and implement everything that lives inside your three files. If the parent grants the files at the
boundary, the change should be mechanical.

**L2 — the cap must stop a runaway, not just one call.** Verify on disk which production call sites
still pass `emptyLedger()`/no ledger. Any site that does is a real hole: record it, name it, and fix it
if it is inside your files. Register rows: `R12-f02`, and `AW45-c06`.

**L3 — sweep your three files** for the usual classes: silent drops, claims the bytes do not support,
`spent`/`cap` arithmetic that disagrees with the ledger's own `totalTokens`, and any place a budget stop
is swallowed instead of surfaced with its code.

## Rules

Do not weaken or re-derive `RAPIDTOOL_TOKEN_CAP` parsing (`tokenParse`/`tokenCapFromEnv` own it). No
keyed calls needed — drive the shape with a stubbed transport or a recorded project. Node 22 + host
Node 24, `--test-reporter=tap`. Targeted suites: `node --experimental-strip-types --test
--test-reporter=tap src/lib/token-ledger.test.ts` (and `headless.test.ts` — baseline **121** tests,
`doctor.test.ts` — baseline **23**). No full gate, no `npm run eval`, no secrets.

## Report back

Verdict per finding · the before/after `summary.budget` and `doctor` spend output from a real command ·
the exact engine/types change you are requesting, with consumers listed · tests added and their real
results on both runtimes · what you stopped on.
