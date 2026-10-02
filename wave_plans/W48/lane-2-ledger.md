# W48 / 334-2 — "Ledger" — spend truth, run-result plumbing, record accuracy, pass 2

Read `wave_plans/W48/README.md` first (Step 0 and the hard rules are there). Your log:
`fixes/334_2_ledger.md`. Owned files: `src/lib/token-ledger.ts`, `src/lib/headless.ts`,
`src/lib/doctor.ts` + their `*.test.ts`.

## Step 0 reconciliation (do this before any edit)

Read your own `fixes/332_2_ledger.md` (including the appended F-5 follow-up), then
`fixes/333_1_verifier.md`'s F-5 and `fixes/333_2_registrar.md`'s R-9/R-10, then your files on disk. Open
your log with **claimed / on disk / still open**, with `file:line` for the last one.

## Fix work

**L1 — a prior process's key rejection is invisible to a fresh `doctor`.** Your F-5 fix added `keyState`
(`not-configured` / `unverified` / `rejected`) plus `lastKeyed`, but the tap is process-local: on a bare
Node CLI host `llmStatus()` cannot observe a *previous* `gate`/`run` process, so `doctor` honestly
degrades to `unverified` and the operator still cannot see that the last run's key was rejected. Fix it
the way you fixed spend: **persist the last keyed outcome on the project record** and read it back.
`src/lib/engine.ts` and `src/lib/types.ts` are unowned — write the exact requested field shape (name,
type, optionality, the write site, the read sites, the migration-in-place rule for records that lack it)
into your log and your report; implement everything inside your three files and say clearly what waits on
the grant. Keep the tail-only rule: a key source is a path/scope plus the last-4 tail, never a key.

**L2 — `run` / `runUntilHitlAsync` expose no `code`.** A P6-synthesis 401 therefore cannot move the
console chip or the doctor state (lane 334-5 consumes this). Surface the failure class on the run result
in your files, keeping every existing consumer's shape working, and pin it. If the honest shape needs
`RunResult` in a file you do not own, request it.

**L3 — spend from non-`gate` verbs** (`repairTreeDir`, `wildStep`, the console's `runPhaseAsync`) does not
fold into a project's spend slice — your own stated owe. Land the ones that live inside your files; name
the ones that do not.

**L4 — doc accuracy (you own this by assignment):** `fixes/331_0_parent.md` still says the CLI carries 38
typecheck errors; the real count is 0 (register `AW46-c07`). Append a dated correction — never rewrite
that log.

## Done-when

`node --experimental-strip-types --test --test-reporter=tap src/lib/token-ledger.test.ts` (baseline 39),
`src/lib/headless.test.ts` (baseline 129) and `src/lib/doctor.test.ts` (baseline 31) green on Node 22
(`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node 24 — report the new counts. `npx eslint` on your
files exits 0; `npx tsc --noEmit` zero diagnostics in your files. No full gate, no `npm run eval`, no
keyed calls (stub the tap), no secrets, no repo probe file. Append to your log; never rewrite it.
