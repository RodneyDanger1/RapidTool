# DBG-2 — file-by-file bug hunt in SYNTHESIS / DELIVERY / PROVIDERS

Branch: `rt349-dbgsynth` (base `e06595d`).

## Files reviewed (owned set)

- `src/lib/io.ts` — import/export + packet text + provenance stamp. Read fully; no provable bug.
- `src/lib/synthesis-policy.ts` — count resolution + best-of-N + adaptive chunk sizing. Read fully; no provable bug.
- `src/lib/verify.ts` — client verify seam + `applyVerifyOutcome`. Read fully; no provable bug.
- `src/lib/verify.server.ts` — sanitizer/parsers/lint/oracle floors. Read the pure seams (`sanitizeOracleExpression`, `parseOracleCases`, `lintFailures`, `stripTypeAnnotationsForHarness`, `failingCaseIds`, `isMonotoneFix`, `verdictChannelFailed`, `undefinedCaseIdentifiers`, `behaviouralOracleExpression`, `buildOracleCasesPrompt`, `runCases` guards). No high-confidence bug.
- `src/lib/compile-check.server.ts` — `parseVerdictForSource`, `compileCheckDir`, `treeVerdictHash`, `specExitIsGreen`, `specSourceHasBehaviouralAssert`, `installToolFor`, `supplyChainFloorFor`. No provable bug.
- `src/lib/codegen.server.ts` — P6 assembly/validator/normalizer/repair seams (chunk plan, order, plan census, reconcile, minimum-plan floor, normalize/materialize, envelope parsers, validators, mint seam). **1 bug fixed.**
- `src/lib/llm/providers/{registry,deepseek,openai-compatible,one-shot-fetch.server,key-resolution,key-source.server,probe,mock}.ts` — **1 bug fixed (`key-resolution.ts`).**

## Fixed bugs

### 1. `codegen.server.ts:2558` — `floorFallbackModules` crashed on a missing contract entity

- **Wrong:** `const domainName = (…lattice.domain…) || (contracted[0]!.name ?? "")… || "domain"`. The non-null assertion is TS-only; when a below-floor project has no `lattice.domain` and an empty `contracts.entities`, `contracted[0]` is `undefined` and `.name` throws `TypeError: Cannot read properties of undefined (reading 'name')`. This is reachable from the real floor path (`underProducedRefusal` → `floorFallbackModules`, and `mergeMinimumPlan` when below `minimum`).
- **Fix:** `contracted[0]?.name ?? ""`.
- **Proving test:** `codegen.server.test.ts` — "the brief floor is total when the project carries no lattice domain and no contracted entities". Failed before with the exact TypeError; passes after.

### 2. `llm/providers/key-resolution.ts:92` — `tailOf(secret, n)` echoed the WHOLE secret for `n <= 0`

- **Wrong:** `s.length > n ? s.slice(-n) : …`. With `n = 0`, `slice(-0)` is `slice(0)` → the full secret; negative/`Infinity` widths likewise returned the full value. In a module whose secrecy contract is "NEVER log the secret, diagnostics use the last-4 tail only", this is a real leak from an exported helper.
- **Fix:** clamp the width — non-number / non-finite / `<= 0` falls back to `4`; `Math.floor` otherwise. Positive widths behave exactly as before.
- **Proving test:** `key-resolution.test.ts` — "never echoes a long secret when the tail width is non-positive" (`n` in 0, -1, -100). Failed before (actual = full 35-char key); passes after.

## Candidate findings (not fixed — could not prove intent / too speculative)

- `verify.server.ts` `isMonotoneFix` compares `n.length < prior.length` using the raw prior array length instead of `new Set(prior).size`. With duplicate ids in `prior` a non-strict subset could pass. Callers feed `failingCaseIds` output (already deduped), so I could not demonstrate a real caller path; left untouched.
- `codegen.server.ts` `bindSignaturesToJobTargets` uses `normalizedLabelForm(t.label)`; a label that normalizes to `""` (e.g. `"..."`) makes `.includes("")` match every signature. `specGraphJobTargets` only enforces `label.length >= 3`, not a non-empty normalized form. No real fixture found.
- `llm/providers/registry.ts` `resolveChunkResampleCandidates` / `resolveSynthesisCandidates` edge with `explicit` numeric `0`: returns the armed/default rather than opting out — matches the pinned tests and documented "explicit 1 is the opt-out", so not a bug.

## Commands / results

- `node --experimental-strip-types --test --test-reporter=tap src/lib/codegen.server.test.ts src/lib/llm/providers/key-resolution.test.ts` → 290 pass / 0 fail (57 suites).
- `node_modules/.bin/tsc.cmd --noEmit` → exit 0.
- Baseline (pre-fix) full owned suites: 733 pass / 0 fail / 1 skip; no pre-existing reds.
