# 199 — P6 token ledger wire + honest isolation claim

## Token ledger (synthWithBackoff)
`complete()` usage is recorded. `RAPIDTOOL_TOKEN_CAP` (positive int) aborts
with `RT_E_BUDGET_EXHAUSTED` when spend **exceeds** the cap (the call that
lands on the cap still returns ok). Unset/0 → unmetered, byte-identical.
Missing `usage` on the result is a no-op even with a cap.

## OS sandbox
`sandbox-policy.ts` is the typed claim: `sandbox: false`, `kind: "none"`.
We do **not** have Docker/bwrap. Do not read this as a sandbox.
