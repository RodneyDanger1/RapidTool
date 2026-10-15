# W356 · lane `restore-guards` — make the two broken prevention guards real again

**Wave:** W356 (green recovery + ratchet). **Persona:** `ledger`. **Author:** the wave parent.
**You are 1 of 6 lanes.** Read this FIRST — it is your authoritative plan.

## Mission

Restore the two prevention-guard defects the audit wave root-caused, without weakening any guard and
without editing a fixture to reach green.

Verified facts (parent + adversarial panel, `fixes/355_0_audit_wave.md` §2.3):

- `node scripts/prevention/verify-prevention.mjs --all --selftest` → `ok:false`, `guards:34`,
  `countFloor:34`, `fixtureIntegrity.missed:["C-06"]`, `fixPresence.pending:["C-14"]`.
- **C-06**: the substance driver fires only on `verdict==="empty"`; the census change (owned by
  `restore-census`) made no corpus tree read `empty`, so the guard stopped firing. The guard's
  *protected behaviour* was retired along with the field it read.
- **C-14 is permanently pending**: its "keyless floor" control is built from
  `testruns/office-stock-tracker/build.json`, whose logs already carry `p6.synthesis.attempt` ×6 +
  `p6.synthesis.refused` ×2, so the fail-closed `p6-arch` probe returns `false` for the control too →
  `mutationRed` can never be true (`replay-harness.mjs` ~`:594`). `scripts/guards/gate-invariants.test.mjs:207`
  asserts the identical unsatisfiable condition.

## Owned files (yours alone)

- `scripts/prevention/**` (harness, drivers, `README.md`, and `cassettes/**` **read-only** — see below)
- `scripts/guards/**` (incl. `guard-registry.json` and the `*.test.mjs` suites)

## MINI-TASK PLAN

1. **C-06**: point its driver at the shell-detecting field that `restore-census` restores. If the field
   is not yet present when you start, read that lane's log `fixes/356_restore_census.md` for the exact
   field name; if it is still absent, implement the guard so it keys on the job-scoped/`empty` reading
   and state the assumption in your log. Re-verify with the harness.
2. **C-14**: build the seam check's "keyless floor" control from a fixture that **genuinely is** the
   keyless floor (zero `p6.synthesis.*` rows). Fix the same unsatisfiable assertion in
   `gate-invariants.test.mjs:207`. C-14 must leave `pending`.
3. **Strengthen, do not weaken.** While you are in the harness: make a guard's reading
   **canary-protected** where it is cheap — if the field a guard keys on disappears or changes shape,
   the harness must FAIL loudly (a coded `RT_E_*` envelope) rather than silently report `fired:false`.
   A guard that can be disarmed by renaming the field it reads is not a guard.
4. **Report the tracking gap, do not fix it.** The whole fixture basis (`testruns/`, 325 files) and
   `scripts/prevention/cassettes/guard-floor.json` are **untracked** while the README claims tracked +
   green on a clean checkout. Confirm the README's exact claim text and record it in your log as an
   **owner decision** (the wave cannot commit). Do not edit the README; `docs-ledger` territory.
5. **Keep the floor honest.** `guard-floor.json` is `countFloor:34` with all 34 ids and must stay that
   way. Do not lower any floor, do not delete a guard, do not edit a cassette's bytes to make a guard
   fire.

## Verification (exact commands)

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
node scripts/prevention/verify-prevention.mjs --all --selftest
node --test --test-reporter=tap scripts/prevention/replay-harness.test.mjs
node --test --test-reporter=tap scripts/guards/gate-invariants.test.mjs
node --test --test-reporter=tap scripts/guards/delivery-gate.test.mjs
```

Target: `ok:true`, `missed:[]`, `pending:[]`, `skipped:[]`, `count >= countFloor`.

## Logging

`fixes/356_restore_guards.md` — skeleton first, then append. Record the two root causes, the canary you
added, the README claim text you found, and the owner decision you are escalating.

## Do not

- Do not edit `src/**` (`restore-census`, `restore-oracle`), `scripts/rapidtool-cli.mjs` or the red test
  files (`restore-tests`), any doc, the README, the register, or another lane's log.
- Do not lower a floor, delete a guard, or edit a cassette to reach green. That is the exact failure
  this wave exists to remove.
- Do not run `gate.sh` / `npm run build` / full `npm test`. No keyed call. No git writes.
- **No mock/stub/fake/demo code on a production path.**
