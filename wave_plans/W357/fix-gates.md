# W357 · lane `fix-gates` — module coverage + the ratchet's own unenforced readings

**Wave:** W357. **Persona:** `ledger`. **Author:** the wave parent. Read this FIRST.

## Mission

Close the two gate-layer reds and strengthen the ratchet the W356 wave built.

## Owned files (yours alone)

`scripts/check-module-coverage.mjs` · `scripts/check-module-coverage.test.mjs` ·
`scripts/quality-ratchet.mjs` · `scripts/quality-ratchet.test.mjs` · `scripts/quality-ratchet.floors.json` ·
`scripts/typecheck-scripts.test.mjs` · `scripts/gate.sh` (additive only)

## MINI-TASK PLAN

1. **`moduleCoverage` is red with 7 stale entries.** The gate reports
   `stale:["src/lib/auth/client.ts","src/lib/auth/email-password.ts","src/lib/auth/gate-session.server.ts",
   "src/lib/auth/middleware.ts","src/lib/auth/pglite-dialect.ts","src/lib/auth/server.ts",
   "src/lib/auth/verify.server.ts"]`, `total:140`, `covered:131`, `unallowlisted:[]`. The guard's own
   message says *"remove any allowlist entry whose module is now reached"* — these modules ARE now
   reached (the 354 wave added auth tests that import them), so the correct fix is **removing the stale
   entries**, not adding new ones. Do that, then re-run to green, and say in your log why each entry
   became stale.
2. **R-3 / R-4 / R-8 from the W356 cartographer** (`research/multiagent/356_cartographer.md`): floors and
   canaries that cannot fire because they were pinned at the measured value, a zero-tree corpus that can
   never trip a floor, and the optional `jobScoped?`/`wholeTree?` typing against a required producer. Fix
   each so the check can actually fail: a floor must sit where a regression moves it, and a canary must be
   able to fire on a real shape change. Prove each with a planted case.
3. **R-5 (the owner's rule, currently undermeasured):** the ratchet's test-double reader scans **emitted
   trees only**, so RapidTool's own `src/**` is outside the reader enforcing the owner's
   `realProductOnly` rule. Extend the reader to RapidTool's own `src/**` — a test double imported from a
   production module in `src/**` must fail the invariant. Keep false positives at zero on the real tree
   (the cartographer proved `providers/mock.ts`, `mcp/stub-server.ts` and `testing/fixtures.ts` are
   test-seam-confined; keep them legitimate).
4. **Add the missing registered code.** `RT_E_RATCHET_METRIC_UNAVAILABLE` (the W356 lane could not mint it
   because it owned no `src/**` file). That needs `src/lib/errors.ts` — **which no lane owns this wave**:
   report it in your log as a one-line owed edit with the exact code + doc line, and keep your
   registered-code canary failing-closed until it lands.
5. Keep every existing floor honest: a floor may only rise, and no metric may read `pass` while
   `unavailable`.

## Verification

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
node scripts/check-module-coverage.mjs
node --test --test-reporter=tap scripts/check-module-coverage.test.mjs
node scripts/quality-ratchet.mjs --all
node scripts/quality-ratchet.mjs --selftest
node --test --test-reporter=tap scripts/quality-ratchet.test.mjs
npx tsc -p tsconfig.scripts.json --noEmit
```

## Logging

`fixes/357_fix_gates.md` — skeleton first, then append: the 7 stale entries with why each became stale,
each R-item fix with its planted proof, the `src/**` reader's false-positive check, and the owed
`errors.ts` edit.

## Do not

- Do not edit `vite.config.ts`/`migrations/**`/`scaffold.ts`/any doc/`eslint.config.mjs`/the register or
  another lane's log. Do not lower a floor or delete a guard/test to reach green.
- No keyed LLM call. Do not run the full gate (the parent runs the boundary). No git writes.
- **No mock/stub/fake/demo code on a production path.**
