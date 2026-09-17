# 210 G1 — factory-honest doctor + skip≠green + stub≠complete

Lane: G1 residual of 201 / 192 / 154. Owned files only. Incremental.

## Scope

- `src/lib/doctor.ts` + `doctor.test.ts` (NEW — field-truth factory latch)
- `src/lib/maker-score.ts` + `maker-score.test.ts`
- `src/lib/dod.ts` + `gates.test.ts` (DoD tests live here)
- `src/lib/sandbox-policy.ts` + `sandbox-policy.test.ts` (consumed, not re-shaped)
- `fixes/210_g1_factory_honest_doctor.md` (this log)

**Do not touch:** `headless.ts`, `store.ts`, `engine.ts`, `scripts/rapidtool-cli.mjs`, `README.md`.
**Do not invent** flip/record/show/publish job bodies.
**Do not run** keyed eval `--all`.

## Honest bar

Green tests ≠ factory. `doctor.factory.autonomousSoftwareFactory` stays **false**
until field truth supports it: leftover jobs gone + real multi-job product +
human fixtures (`decidedBy:"human"`) + product-complete (skip ≠ green, stubs ≠
complete). Sandbox always false (no Docker claim). 185-H1: this envelope has
no `ok`/`error` pair.

Parent `headless.doctorStatus` still hardcodes `autonomousSoftwareFactory: false`
(parent-owned). This lane lands the latch headless can later import.

## Findings + fixes

### 1. doctor — never claim factory without field truth

`headless.ts` advertised a literal `false` with no computer. A later edit could
flip the flag while leftover jobs were still TODO(E-15) stubs.

**Landed** `src/lib/doctor.ts`:

| API | Behavior |
|---|---|
| `RAPIDTOOL_FACTORY_EVIDENCE` | live truth: leftover stubs, no human fixtures, not product-complete |
| `factoryClaim(evidence, env?)` | `autonomousSoftwareFactory` true **only** when leftover=false AND humanFixtures AND realMultiJobProduct AND productComplete AND isolation.sandbox===false |
| `coerceFactoryClaim(raw)` | hostile `autonomousSoftwareFactory:true` / `sandbox:true` coerce false unless field truth actually supports it |
| `doctorFactory()` | RapidTool-now snapshot — always false today |
| `doctorIsolation()` | frozen `runnerIsolationClaim()` |

Isolation is always `coerceIsolationClaim` (sandbox/docker/bwrap false).
`tokenCap` from `tokenCapFromEnv` (unset → null). Gaps named when the bar is unmet.

### 2. maker-score — skip ≠ green; stubs ≠ product-complete

**Residual:** `treeRunToMakerEvidence` copied `tr.ok`; M2 scored 1 on
`{ok:true}` with 0 assertions. TODO(E-15) / reexport-only tree files could
vacuous-pass M1 (no expectedCapabilities) or cover a capability via an alias
reexport. Stub jobs could theoretically 9/9.

**Landed:**

- `treeRunLooksSkipped` — 0 assertions, `skipped:true`, or entry skip with no TAP pass
- `treeRunToMakerEvidence` — skip-only TAP → `ok:false`, `skipped:true`
- M2 = 1 only when `ok` AND `testsPass > 0` AND `testsFail === 0` AND not skipped
- M1 — all-stub trees score 0 (even vacuous); `capabilityCoverage` ignores stub files
- Stub leftover jobs cannot land a 9/9 card

### 3. DoD — gap honesty

**Residual:** `p6-arch` treated absent tree as a green pass (skip=green for
product-complete). Stub detection was only byte-identical `buildPhase6Module`
templates — TODO(E-15) throw stubs and reexport-only leftovers could pass.

**Landed:**

- `ArchTrace.skipped` — absent tree is a skip
- `archProductComplete(t)` — false when skipped / missing / stubFiles
- `isStubSource` / `isReexportOnlySource` — TODO(E-15) + reexport-only join template stubs in `stubFiles`
- `p6-arch` probe **still PASSES** on absent tree so the keyless floor is not
  hard-broken (engine/headless/store stay parent-owned). That pass is a skip,
  not product-complete.

### 4. sandbox-policy

Unchanged this pass (207 already froze + coerce). Doctor consumes
`coerceIsolationClaim` / `runnerIsolationClaim`. Existing suite still pins
sandbox/docker/bwrap false.

## Verification

```text
node --experimental-strip-types --test \
  src/lib/doctor.test.ts \
  src/lib/maker-score.test.ts \
  src/lib/sandbox-policy.test.ts \
  src/lib/gates.test.ts
# tests 168  pass 168  fail 0
```

Full `npm test` **not** run. No keyed eval `--all`. No live DeepSeek burns.

## Files touched

| File | Action |
|------|--------|
| `src/lib/doctor.ts` | NEW field-truth factory latch |
| `src/lib/doctor.test.ts` | RapidTool-now false, hostile coerce, latch-true only on full evidence |
| `src/lib/maker-score.ts` | skip≠green M2; stub trees cannot M1/9/9 |
| `src/lib/maker-score.test.ts` | skip / stub / 9/9 denial pins; M7 fixtures carry testsPass |
| `src/lib/dod.ts` | skipped + stub detectors + archProductComplete |
| `src/lib/gates.test.ts` | skip≠complete; TODO(E-15)/reexport fail p6-arch |
| `fixes/210_g1_factory_honest_doctor.md` | this log |

## Honest residual (could not fix in-lane)

1. **Parent doctor wire** — `headless.doctorStatus` still hardcodes the factory
   object. Latch is ready; parent must `import { doctorFactory }` (or
   `factoryClaim`) to emit the computed field.
2. **p6-arch keyless pass** — probe still returns true on absent tree so
   engine/store/headless P6 hashes stay stable. Product-complete consumers
   must use `archProductComplete()`.
3. **Packet sandbox claim** — `packet.ts` / `sandbox.ts` still advertise
   `isolated: true` (parent residual, same as 207).
4. **No flip/record/show/publish bodies** — leftover jobs stay stubs. That is
   why `leftoverJobsAreReexportsOrStubs: true` and factory stays false.
