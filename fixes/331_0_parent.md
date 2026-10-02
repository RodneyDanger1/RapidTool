# 331 wave (W45) — parent / boundary log

**Boundary owner:** parent. **Opened** 2026-10-02 at HEAD `03a6d0b` (`330 wave`), tree clean.
**Six lanes + three follow-ups**, all landed. Contract and lane briefs: `wave_plans/W45/README.md`.
Keyed evidence: `wave_plans/W45/parent-keyed-findings.md`. Register append: `AW45-c01…c08`
(`research/multiagent/thoroughanalysis.md`).

## 1. The headline: the keyed path was never funding-blocked

The register (W25–W30) recorded `O-1`: *"Fund the DeepSeek account — all keyed calls 402"*, and deferred
every keyed done-when against it. **That premise is false.** Measured today: the repo `.env` key returns
**200** on `/models` and on `/chat/completions` for both `deepseek-v4-flash` and `deepseek-v4-pro`, with
real completions and billed usage. The machine was sending a **stale Windows User-scope
`DEEPSEEK_API_KEY`** (tail `…42ff`) which shadowed the valid `.env` key (tail `…19b3`), and **nothing in
the repo loaded `.env`** (`grep -rn 'loadEnvFile|dotenv' src scripts .grok` → 0 hits), so every keyed
call 401'd.

Three surfaces are now fixed (lane 331-1): the **CLI**, the **provider** on read
(`key-source.server.ts`), and the **Vite dev server** (`with-app-env.mjs` declares
`RAPIDTOOL_LLM_ENV_FILE=<repo>/.env` — a path, never a secret, never `VITE_`). Precedence matrix:
present-but-blank ⇒ keyless (the disable signal); absent ⇒ `.env`; non-blank differing ⇒ `.env` wins
plus the coded `RT_E_LLM_KEY_SHADOWED` naming both last-4 tails. A 401 now classifies as
`RT_E_LLM_KEY_REJECTED` with its source named, instead of `RT_E_UNKNOWN`, and the red path exits 4
without the libuv `async.c` abort that previously killed the process on Node 24.

**Proof it end-to-end:** a **real browser keyed action** from the console ("Spawn crew", bounded to one
phase) returned real model text and measured `promptTokens 3053 / completionTokens 3705` with no 401.
First time in months.

## 2. The product: the emitted tree is a real multi-job app, and the M-A bar is MET on a keyed run

Keyed run on `research/eval-corpus/house-flip-manager.md` brief prose: `lattice.jobs =
["flip","invoice","track","rehab","bid"]`; P6 keyed synthesis emitted **7 real modules**
(`flip.ts` 27,090 B, `invoice.ts` 16,888 B, `create-property.ts` 14,755 B, `validate-line-item-input.ts`
9,659 B, `bid.ts` 5,507 B, `list-line-items.ts` 2,760 B, plus the `src/generated.ts` barrel), with
`p6-arch: PASS` and `p6-brief-fit` PASS. `treeRun.substance = {stubs:0, reexports:0, real:3}` — the
`{0,0,≥3}` bar the register measured as unmet **is met**. What still blocked the run was two generator
defects, both now fixed:

1. **cross-chunk duplicate declaration** — `flip.ts` imported `estimateARV` and also declared it →
   unloadable tree. Lane 331-4 added a deterministic synthesis-time refusal naming the identifier and
   both sites, which routes into the existing one bounded repair re-prompt.
2. **`proseLineHits` false positives** — `return a.index - b.index;` and an object-property ternary
   with a quoted arm were refused as "prose-in-code", including `repair`'s own patched output. Lane
   331-4 fixed the class (member-expression operands; expression arms that mask away) with the
   deliberation controls still caught.

And the repair loop that must heal such a tree: lane 331-3 made it **target the file the failure names**
(`src/jobs/flip.ts` was previously never written or refused across 3 cycles) and made the tree's own
barrel `src/generated.ts` round-trip through both the import and apply sides instead of being refused as
"outside the scaffold's src/ subdirs".

## 3. Boundary gates (parent-run, after every writer stopped)

| Gate | Command | Result |
|---|---|---|
| typecheck | `npm run typecheck` | **exit 0** |
| lint | `npm run lint` | **exit 0**, 0 warnings (baseline had 1) |
| tests | `npm test` | **788 suites / 2682 tests / 2672 pass / 0 fail / 10 skipped**, exit 0 |
| build | `npm run build` | **exit 0** (`db:migrate` prints the honest PGLite-fallback note) |
| gate of record | `bash scripts/gate.sh` (via git-bash) | **`ok:true`, exit 0** — `flakes: []`, `hardFails: []`, testsScripts 394/0, testsLib 2680/0/2 skipped |

Baseline at wave open: 774 suites / 2621 tests / **2611 pass** / 0 fail / 10 skipped. **+61 tests, all
green.**

**The gate script itself needed a fix to produce that verdict.** `scripts/gate.sh` invoked
`node --test …` (lines 88/89–90/97/98–99) **without** `--test-reporter=tap`, while its verdict builder
parses TAP (`# pass`, `not ok N - name`). On the host runtime (Node 24) `node --test` defaults to the
`spec` reporter, so both legs exited 0 with zero parseable `# pass` lines and the script's own
"vacuous green" guard correctly refused the verdict (`ok:false`, `hardFails: ["testsScripts (exit 0 but
zero '# pass' lines …)"]`). `AGENTS.md` already states that `gate.sh` passes the reporter explicitly —
it did not. All four invocations now pass `--test-reporter=tap`, which is what makes the `ok:true`
above trustworthy on both runtimes.

## 4. Lane outcomes

| Lane | Outcome |
|---|---|
| 331-1 Keywright | Key resolution fixed on CLI + provider + dev server; `RT_E_LLM_KEY_REJECTED` / `RT_E_LLM_KEY_SHADOWED`; libuv abort gone; blank-key precedence preserved; real keyed call proven. |
| 331-2 Assayer | L4 id stability fixed (anchors, two-part); `driftLesson`'s false caller claim **struck** and the owed caller registered; `wildLog` telemetry-throw fixed; drift anchor-slice fork fixed. Owned suites 143→152. |
| 331-3 Transit | `materializeEmitTree`'s zero-row early return removed — a lone CJS `generatedSource` now **converts** into a loadable ESM chunk + barrel (proven by a real `import()`); guard sweep per emit path; `src/generated.ts` round-trips through `repair`; repair targets the failure-named file. |
| 331-4 Composer | `treeChunkPlanCensus` + a persisted `p6.tree.shortfall` warning (no more silent job drops); the keyless placeholder now classifies as `stub`, not `real`; `proseLineHits` class fix; cross-chunk duplicate refusal; R10-f01 contracts coverage added. |
| 331-5 Chrome | Zero edits needed — the R6 rows were already landed in `2fa3cd9`; every one browser-proved (busy latch proves 1 POST vs 2 with the latch stripped; disabled-launch explanation; `Phase n of 13`; `?? null`; tablist a11y; PaneBoundary containment re-run), desktop 1440×900 + mobile 390×844, 0 console errors. |
| 331-6 Warden | `tsconfig.scripts.json` wired with a **per-file ratchet budget** (173 errors pinned, 39 cross-lane named by owner); assertion-gap guard extended with `tautology:presence-only` / `tautology:typeof-only` + RED-first teeth; new `check-module-coverage.mjs` (100/121 reached, explicit allowlist); `with-app-env.mjs` `isMainModule` silent-no-op fixed. Flake not reproduced (4 runs). |

## 5. Boundary-owner fixes (files no lane owned)

- `src/lib/lesson-writers.test.ts:579` — updated to the new specific code after 331-1's classifier
  change; no lane owned it and both 331-2 and 331-3 reported it.
- `src/lib/codegen.server.test.ts` — replaced an always-true assertion
  (`… || true`) with the real check that an already-bound export is never re-injected.
- `src/lib/node-runner.server.test.ts` — replaced an always-true `typeof … || true` with a real
  non-empty-PATH assertion. Both now pass honestly (148/148 and 12/12).
- `scripts/typecheck-scripts.test.mjs` — removed an unused import to return lint to zero warnings.
- `scripts/gate.sh` — added `--test-reporter=tap` to all four test-leg invocations (the gate of record
  could not read its own runner's output on Node 24; see §3).

## 6. Owed / reported, not fixed (honest)

1. **`O-1` is owner-only and still open in a different form:** the stale User-scope
   `DEEPSEEK_API_KEY` (`…42ff`) was deliberately **left in place** — other tools on this host may read
   it. The repo now wins over it and says so, out loud, by tail. Clearing the variable silences the
   signal.
2. **`scripts/rapidtool-cli.mjs` carries 38 of the 173 `tsconfig.scripts.json` errors.** They are
   pinned by a per-file ratchet budget, so no new error can appear, but the CLI is not yet
   typecheck-clean. Making `npm run typecheck` cover `scripts/**` needs `package.json` (not owned by
   any lane this wave).
3. **`npm run eval` was not run** — keyless or keyed it rewrites tracked
   `research/eval-out/**`. The keyed `run-eval` scorecard and the `{0,0,3}` trial evidence remain
   un-refreshed.
4. **T5.2-A honesty-surface coverage:** `src/lib/fixtures.review.ts` + `fixtures.server.ts` are reached
   only by untested `console.tsx`; reported by 331-6, owned by nobody this wave.
5. **`create --brief <path>` still silently treats the path as the brief** (`AW45-c07`).
6. **`budget.spent` still resets per invocation** (`AW45-c06` / `R12-f02`).
7. 331-3's earlier report of a **game-kind false-red** in `resolveHeadlessEntry` (a browser boot
   importing an extensionless `./ui/console`) is real and un-owned; the wave's product kinds are
   unaffected.
8. **The last mile to a green keyed tree is a generated-code async defect** (found by the parent on a
   second bounded keyed run, after the wave's fixes). That run's tree **compiles 13/13**, its
   **generated core loads and runs** (`core.entry src/jobs/invoice.ts → run:"pass"`), and its spec is
   **24 pass / 1 fail** — where the earlier run died at load with the duplicate declaration. The single
   remaining failure is an **unhandled rejection**: the generated `src/jobs/rehab.ts` calls the async
   `getProperty(propertyId)` **without `await`** and then reads `property.ok === false` on the returned
   Promise, so the promise rejects after the test ends
   (`ValidationError: propertyId is required and must be a non-empty string`) and node:test reds the
   whole spec file.
   - The parent landed the necessary half in `scaffold.ts`: the emitted tree-job guard now **awaits**
     the probe call (plus a pinning test), so a returned rejection is caught instead of floating.
     Regenerating the tree confirms the emitted bytes changed — the rejection that remains is created
     **inside** the generated module by a fire-and-forget call, which no probe-side guard can catch.
   - Remaining honest work (next wave, `codegen.server.ts`): teach the synthesis prompt/validator that
     an imported async function must be awaited, or make `validateSynthesisModule` refuse a
     `Promise.resolve().then(...)` body that reads a property off a non-awaited async callee. Until
     then a keyed run can still produce a tree that loads and then fails its own spec.
   - Also still true and un-fixed: `p6-test`/`p6-verified` require a **green tree-run** to mint
     (`mintTreeRunTested`), and `lattice` coverage varies run to run — the first keyed run emitted 7
     files (`p6-arch` PASS), the second emitted 5 (`p6-arch` FAIL). Keyed synthesis is not
     deterministic in coverage today.
