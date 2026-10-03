# 341-1 — emitted product across kinds (webapp / cli-tool / library / game / service)

**Lane:** engineer 341-1 (emitted product across kinds). **Root:** `C:\Users\mnril\Desktop\RapidTool Main`
(git `main`, HEAD `2d5ee35`, my two owned files clean at start). **Runtimes:** host `node` v24.15.0 and
pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
**Owned files touched:** `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts` (+ this log).
`src/lib/compile-check.server.ts` / `.test.ts` read, audited, and left byte-unchanged (no defect found
in them). **Scratch:** `%TEMP%\rt341_1\`. **No full gate**; targeted files only on both runtimes.
**Keyed calls:** 5 (bounded; usage below). No secret printed.

The mission question: *can RapidTool emit a runnable, machine-verified product for EVERY advertised
kind?* Answer: **the per-kind structure is real and green on the keyless floor on both runtimes; the
KEYED product is not yet guaranteed to pass its own advertised `typecheck`** — evidence and the
out-of-slice fix shape below.

---

## 1. Per-kind reality table

Two layers, both measured. "Keyless floor" = `runHeadless(seedProject(<kind>), ALL_PHASES)` →
`scaffoldProject` → write to a temp dir → `compile-check.server.ts treeRun` (the same seam the CLI
`emit --run` / `tree-run` uses). "Keyed" = real DeepSeek P6 synthesis (`liveP6Synthesis`, funded key
from the repo `.env`).

| kind | emits | declared scripts run? | tree-run green (keyless)? | keyed reality | what is missing |
|---|---|---|---|---|---|
| **webapp** | 19 files (index.html + vite.config + `src/main.tsx` + `src/styles.css` + spec-graph modules + oracle spec) | `typecheck` pass, `test` pass, `build` (vite) pass | **yes** — `run=skip` (honest UI-shell, `unverifiedEntry` set) + generated-**core** smoke pass; compile all-pass | chunked-tree path (declared kind) → no self-typecheck | UI is generated (340-6) but the emitted tree's own `tsc` is unverified at synthesis |
| **cli-tool** | 17 files (`src/main.ts` entry + `bin/<slug>.mjs` launcher + modules + spec) | `typecheck` pass, `test` pass, no `build` (skip, absent) | **yes** — entry smoke pass (`src/main.ts`), compile all-pass, spec pass | **RED demonstrated (keyed): tree fails its OWN `typecheck`** (see §2) | P6 chunked synthesis never typechecks; the emitted `bin`/entry are structurally real |
| **game** | 19 files (index.html + plain vite.config + `src/main.ts` canvas boot + `assets/manifest.json` + modules) | `typecheck` pass, `test` pass, `build` (vite) pass | **yes** — `run=skip` (UI shell) + generated-core smoke pass | same chunked path as webapp/cli-tool | game shell is the honest canvas contract stub (no generator draws game UI) |
| **library** | 14 files (`src/main.ts` entry; `package.json` `main`+`exports`+`files`) | `typecheck` pass, `test` pass, no `build` | **yes** — entry smoke pass; `import "fixture"` from a consumer dir resolves `exports` → `{name,version}` | kind-absent via CLI ⇒ single-module `generatedSource` path (runtime harness verify only, not `tsc`) | machine-verify is `new Function` runtime, never `tsc` |
| **service** | 14 files (`src/main.ts` entry + `start` script; real `resolvePort`) | `typecheck` pass, `test` pass, `build` skip | **yes** — entry smoke pass; `npm start` runs the coded refusal (exit 1, `RT_E_VALIDATION`) | same single-module path | same |

Evidence commands (both runtimes identical): `%TEMP%\rt341_1\perkind.mjs`, `edge.mjs`, `wiring.mjs`,
`barrel-ui.mjs`. Full results: `%TEMP%\rt341_1\{perkind-result.json, edge-result.json}`.
Wiring invariants proven on the emitted dirs: every `main`/`bin`/`exports`/`files` target and every
`scripts.*` file reference exists on disk (0 dangling); CLI `bin/<slug>.mjs --help` exit 0 / refusal
exit 1; consumer `import "<lib>"` resolves via `exports`. Intake-only, full-run and tree-mode variants
of all five kinds also tree-run green (15/15 scenarios).

---

## 2. The keyed finding (real money, measured)

One bounded real synthesis: `liveP6Synthesis(runHeadless(seedProject({kind:"tool", brief:"CLI tool that
parses a CSV invoice file and converts it to JSON"}), ALL_PHASES))` via the real `completeDeepSeek` +
`expandBrief`; counted every invocation and summed `LlmUsage`.

```
ms=46517  calls={complete:4, expand:1, verify:0}
usage={ promptTokens:12243, completionTokens:10196 }   (5 model calls total)
generatedTree = [src/generated.ts(barrel,149B), src/generated/read-csv-file.ts, src/jobs/parse.ts,
                 src/jobs/convert.ts, src/jobs/invoice.ts]   (real modules, substance verdict "real")
scaffoldOk=true  files=19
treeRun.ok=FALSE
  project.typecheck = fail (exit 2)
    src/generated/read-csv-file.ts(107,92): TS2749 'TextDecoder' refers to a value, but is being
      used as a type here (the cli-tool tsconfig `lib:["ES2022"]` + @types/node 22 declares the
      global as a VALUE only without DOM)
    src/jobs/convert.ts(1..2): TS2440 Import declaration conflicts with local declaration
      (the model emitted `declare function` stubs AND imports of the same names)
  compile.failed=0 (parse OK), tests/oracle.spec.ts=pass, run=pass/cli-tool
  substance={stubs:0,reexports:0,real:3} — a REAL tree that fails its OWN advertised `typecheck`
```

Why the synthesis sealed it: the chunked path (`codegen.server.ts synthesizeChunkedTree`, ends at
`materializeImportableTree(accepted); return treeUpgraded(...)`) validates each chunk **structurally**
(forbidden primitives, export binding, cross-chunk duplicates, prose, nondeterminism) and never runs
`tsc`; `deps.verify` was invoked **0** times on this path. The single-module path (`synthesizeSingleModule`)
does call `verifyAndFixServer`, but that harness compiles with `new Function` (JS-only) and RUNS cases —
a stripped type error never fails it. So neither P6 path typechecks the artifact. The tree-run leg
correctly reds it (`ok:false`), so the system never falsely mints `tested`; the repair context
(`deps.treeFailure`) is threaded on the next cycle, but the artifact itself cannot be guaranteed green.

This is the honest "where it cannot" for a keyed product. The fix is **out of this lane's ownership**
(§6 STOP-and-REPORT).

---

## 3. Fixes in owned files (each RED → GREEN, both runtimes)

### 3.1 `scaffold.ts` — the 340-6 UI generator did not see a codegen BARREL entry (real defect)

`codegen.materializeImportableTree` writes the keyed tree's entry as an ESM **barrel** of
`export * from "./x.ts"` lines. `uiExportedCallables` scanned only the entry file's own bytes, found no
callable, and `defaultUiGeneration` emitted the honest but under-delivering "generated module exports no
callable function" panel — for **exactly** the shape a real keyed tree produces. The 340-6 claim ("binds
the tree ENTRY module's real exports") did not hold for it.

Fix: new private helpers `uiFollowStarExports` / `uiResolveTreeSpecifier` follow the entry's `export *`
specifiers over the accepted tree files (deduped, cycle-safe, bounded to 24 files); the accepted-branch
return is `uiFollowStarExports(entry, byPath)`.

RED (new test, pre-fix):
`not ok 1 - A3-f07 / W-14 …` `error: 'calls a name the barrel genuinely re-exports'` → `# fail 1`.
GREEN (post-fix): `ok 1 …` `# tests 1 # pass 1 # fail 0`.

Real keyed barrel re-emit after the fix (`barrel-ui.mjs`, on the actual keyed tree files):
```
import * as generated from "../generated.ts";
const result = generated.csvRowToObject(String(data.get("headers") ?? ""), String(data.get("row") ?? ""));
… <input id="rt-headers" name="headers" …/> <input id="rt-row" name="row" …/>
<button type="submit">{"Run csvRowToObject"}</button>
```
Every emitted field/call traces to a genuine re-export of the imported barrel.

### 3.2 `scaffold.ts` — `uiDomainFields` doc said "capped"; two of three branches were not

The doc claimed "deduped and capped", but only the spec/contract/lattice fallback ran `slice(0,4)`; the
positional and object-literal branches returned the full list. Fix: one `UI_FIELD_CAP = 4` constant
applied at all three returns.

RED (positional branch reverted): `the documented cap bounds the form (got 6: a,b,c,d,e,f)` → `# fail 1`.
GREEN: `# tests 1 # pass 1 # fail 0`. A 6-param callable now renders `["a","b","c","d"]`.

### Suites (targeted, both runtimes)
```
v24.15.0            v22.23.2
scaffold.test.ts            71/71/0            71/71/0
compile-check.server.test.ts 82/83 (1 skip)     82/83 (1 skip)
emitted-honesty.test.ts      5/5                5/5
packet.test.ts              81/81               81/81
```
(The compile-check skip is the pre-existing `RT_VERIFYKIND_INSTALL`-gated real-install test.)

---

## 4. Wiring audit (my two modules)

Every export with a real consumer (repo-wide, `src/**` + `scripts/**`):

`scaffold.ts` — `ProjectKind` (types.ts), `ScaffoldFile`/`ScaffoldResult` (emitted-honesty.test,
scaffold.test), `UiGenerationHook` (scaffold.test), `DEPLOY_HONESTY_STAMP` (scaffold.test),
`projectKindOf` (codegen.server, engine, run-eval.mjs, tests), `deployNotes`/`deplyNotes` (scaffold.test),
`scaffoldProject` (headless.ts, CLI emit, emitted-honesty.test, packet.test, sweep73-fuzz.test).

`compile-check.server.ts` — `parseVerdictForSource` (headless.ts), `compileCheckDir` (rapidtool-cli.mjs),
`treeRun` (codegen.server, headless.ts, maker-score, entry-oracle, CLI, run-eval, tests),
`treeVerdictHash` (codegen.server, maker-score, run-eval, test), `treeSubstanceOf` (test),
`installToolFor`/`SUPPLY_CHAIN_AUDIT_COMMAND`/`supplyChainFloorFor`/`verifyKindDir` (CLI, tests),
`TreeRunOutcome` and the `Tree*`/`VerifyKind*`/`SupplyChainPosture`/`Compile*` types (the named fields of
consumed composite types / the documented public shape).

**Honest allowlist (exported, zero external consumer today, pre-existing):**
`UiGenerationRequest`, `ScaffoldOptions` (the public hook/option contract types — consumers pass object
literals and infer the arg, so no import site exists); `CapabilityDemand` + `capabilityPresenceForms` +
`capabilityDemands` (internal seams of `emitOracleSpec` — `capabilityDemands` is called at
`scaffold.ts:2156`, `capabilityPresenceForms` at `:2086/:2087`; exported for the emitter API parity with
the other module seams). No false-success claim rides any of them. No export was renamed.

Emitted-UI binding audit: after §3.1 the generator's called names resolve to genuine exports of the
imported entry **for every entry shape tested** — legacy template (explicit `export { }`), single-file
tree, and the real keyed `export *` barrel. The game/cli-tool/library/service shells are `emitUi`'s
contract-level branches (the 340-6 generator applies to webapp only, by its own contract).

---

## 5. 340 verifier cross-check (findings touching this slice)

- **340-8 verifier B** — "Comment claims in `scaffold.ts` (340-6) read as consistent but were **not
  mutation-verified here**." → **NOW MUTATION-VERIFIED: 2 real drifts found and FIXED** (§3.1 barrel
  under-delivery, §3.2 cap claim). Its other two stale-comment findings were `engine.ts:4352` and
  `quarantine.ts:21` — **not my files**, not touched (out of slice). Its census listed my file's
  hardcoded-return regex hits (`scaffold.ts:1306/1317/1331/1348/1446`) are parser not-found **guards** —
  re-confirmed honest (no `return` fakes a computation).
- **340-7 verifier A — Claim 3 (emitted UI): CONFIRMED** for the shapes it probed; it reported **no defect
  in my files**. Its two nuances are honest and unchanged: (a) an earlier callable carrying ≥2 fields may
  be wired ahead of the spec-derived one — every wired name/field is a real export/param, so no
  fabrication; (b) two independent engine runs differ only by the fresh packet UUID in the header comment
  — an engine fixture property, not the emitter (same-project determinism still holds, pinned).
- **340_0 parent residuals** touching my modules: none named (`scaffold.ts`/`compile-check.server.ts` are
  not in §4's residual list).

---

## 6. STOP-and-REPORT (needed change outside owned files — exact shape)

**(a) P6 seals an artifact it never typechecks.** `src/lib/codegen.server.ts`,
`synthesizeChunkedTree` terminal block (current bytes, ~`:4540`):

```ts
  const materialized = materializeImportableTree(accepted);
  return treeUpgraded(
```
→ old → new: before `treeUpgraded(...)`, run the emitted project's OWN declared `typecheck` over the
materialized tree (write it to a scratch dir and call `compile-check.server.ts`'s `treeRun`, or a
new source-level typecheck seam — note `parseVerdictForSource` is **syntax-only** and would NOT catch
TS2749/TS2440) and, on a red verdict, take the existing bounded `treeFailure` repair path / refuse via
`partialTreeRefuse` with a coded reason. Root cause proven in §2 (verify invoked 0 times; harness is
`new Function`, never `tsc`).

**(b) A typecheck-only red names no repair target.** `src/lib/headless.ts:2716 treeRunFailureFiles(o)`
builds the repair directive's file list from `o.core`/`o.compile`/`o.run`/`o.tests` only. For the keyed
cli-tool tree the verdict is `compile.failed:0`, `tests pass`, `entry pass`, `typecheck:fail` →
`treeRunFailureFiles(outcome) === []` (measured) even though `o.error` names
`src/generated/read-csv-file.ts` and `src/jobs/convert.ts`. The tail still rides `deps.treeFailure`, so
the model sees the files; the explicit "Repair target file(s)" block (headless.ts:2553) does not. Fix
shape: also parse the declared-script `detail` / add a declared-script-offender field to
`TreeRunOutcome.project` (a **compile-check.server.ts** contract change) and consume it here.

No other file needed a change; nothing else was edited.

---

## 7. Mock / fake census (my diff only)

`git diff -- src/lib/scaffold.ts src/lib/scaffold.test.ts`: **119 added / 5 deleted**.
`as any` 0 · `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` 0 · `eslint-disable` 0 · `TODO`/`FIXME` 0 ·
empty `catch {}` 0 · `.only(`/`.skip(` 0 · hardcoded `return true/false` fakes 0. No test that cannot
fail (both new tests were RED before their fix, proven). No placeholder bodies; the two new tests drive
the real emitter; the keyed probe hit the real provider (no doubles).

---

## 8. Verdict on this slice

**Works for structure; partially works for the keyed product.** All five advertised kinds emit a
runnable, wired tree that passes its OWN declared `typecheck`/`test` (and `build` for webapp/game) under
the tree-run on **both** runtimes on the keyless floor — entries, `bin`/`exports`/`files`/`main`/`scripts`,
the game vite config, the CLI bin launcher and the service start script are real and referenced files all
exist. The two in-slice defects the 340 verifier left un-mutation-verified are fixed. **What remains
(not mine to fix):** the keyed P6 synthesis never typechecks the artifact it seals, so a real DeepSeek
tree can fail the tree's own advertised `typecheck` (demonstrated on cli-tool; the exposure is systemic
to both the chunked and single-module paths), and the repair directive omits declared-script offender
files — both STOP-and-REPORTed with exact shape in §6.

---

# RESUME — engineer 341-1: the PRE-SEAL self-typecheck gate LANDED

**Resume scope:** the §6(a) STOP-and-REPORT is now fixed **in-slice** — `src/lib/codegen.server.ts`
and `src/lib/compile-check.server.ts` (both owned this resume) + their tests. No file outside the four
was edited; `headless.ts` was read only (§R7 STOP-and-REPORT). `scaffold.ts`/`scaffold.test.ts` were
**not** touched this resume (no defect needed one; the prior-lane bytes stand).
**Runtimes:** host `node` v24.15.0 and pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
**Scratch:** `%TEMP%\rt341_1\`. `tsc --noEmit -p tsconfig.json` clean on the whole repo after the change.
**No full gate** — targeted suites only. **Keyed calls: 3 real API calls (cap reached)** — measured below.

## R1. The new gate (file:line)

**(a) `src/lib/compile-check.server.ts:1465` — `export async function typecheckDir(dir, opts?)`.**
Runs ONLY the emitted tree's OWN declared `typecheck` over an already-materialized dir, through the
SAME resolution/execution seam `treeRun`'s project leg uses (`runProjectScript` → the bounded runner).
No copy, no spec/entry/build legs; when the dir carries no `node_modules/`, the repo's installed root is
junction-linked exactly as `treeRun` does. `skip` (no declared script / un-runnable tool) is never a
pass. This is the real-compiler seam — `parseVerdictForSource` is syntax-only and provably misses
TS2749/TS2440.

**(b) `src/lib/codegen.server.ts:3600` — `export async function defaultTreeTypecheck(project)`.**
Materializes the CANDIDATE emitted project with the pure `scaffoldProject` emitter (the exact bytes the
tree-run later judges) into a `rt-p6-typecheck-*` scratch dir, runs `typecheckDir` on it, and maps the
verdict to `{run:"pass"|"fail"|"skip", detail?, files?}` (`files` parsed from the tsc rows by
`typecheckOffenderPaths`, `:3571`). Cleanup unlinks the junction before the recursive remove.
`:3663 runTreeSelfTypecheck` builds the candidate as `treeUpgraded` would (`generatedTree` +
`generatedSource`) and is **fail-closed** on a malformed verdict or a seam throw.

**(c) The gate call sites.** Resolved at `:4135`:
`deps?.typecheckTree ?? (deps?.complete === undefined && deps?.verify === undefined ? defaultTreeTypecheck : null)`.
It is part of the REAL pipeline, so production (`engine.liveLayer` forwards only
`treeFailure/gateRepair/synthesisRefusal/patchRepairs/proven` — never an LLM/verify seam) always gates.
A caller that replaces BOTH real seams owns the pipeline and must pass `typecheckTree` explicitly; unit
tests inject a deterministic verdict, and the RED/GREEN tests below pass `defaultTreeTypecheck`.
- Chunked path gate: `codegen.server.ts:4800` (bounded repair) — right before `treeUpgraded`.
- Single-module path gate: `codegen.server.ts:4561` — right before the final return.

## R2. RED-first: the measured class, BEFORE → RED → GREEN (both runtimes)

New describe `fixes/341-1 pre-seal self-typecheck gate`, 7 tests, all green on **both** runtimes
(full suite below). The RED case uses the REAL compiler (only the LLM seam is injected):

**BEFORE (the defect, in miniature).** Same typed-red module, legacy deps (no `typecheckTree` ⇒ gate
null): the tree IS sealed (`Generated source tree` artifact present, no refusal) — and then the SAME real
compiler seam reds that sealed artifact:
```
q.artifacts → "Generated source tree" present          (sealed by the legacy path)
defaultTreeTypecheck(q).run === "fail"
  detail: src/generated/chunk-0.ts(9,14): error TS2749: 'TextDecoder' refers to a value,
          but is being used as a type here.
```

**RED (gate live).** Same module + `typecheckTree: defaultTreeTypecheck`:
```
p6.synthesis.refused · RT_E_VALIDATION · … fails its OWN declared `typecheck` …
  src/generated/chunk-0.ts(9,14): error TS2749: 'TextDecoder' refers to a value, but is being used as a type here.
sealed artifact: NONE        lastTest.label !== "tested"       bounded repair fired (complete×2)
```
The gate runs real `tsc` (3.6s), catches the exact measured TS2749 class, and refuses — never seals.

**GREEN (bounded repair converges).** Deterministic seam `fail` → `pass`:
```
tcCalls === 2   complete×2   "Generated source tree" present   no refusal
repair prompt contained: 'TextDecoder' refers to a value
```
**SKIP** seals (mirroring `treeRun`'s own skip contract) **and** logs `p6.tree.typecheck.skipped`
("unverified, not a pass"). **A verdict naming only non-chunk files** (e.g. `tests/oracle.spec.ts`) is
refused with "no synthesized chunk maps …", not guessed at.

`compile-check.server.test.ts` adds 4 `typecheckDir` tests (real tsc): absent script ⇒ `skip`; declared
but unresolvable tool ⇒ `skip` + UNVERIFIED reason; real `TextDecoder`-as-type ⇒ `fail` with `TS2749`;
a typed module ⇒ `pass`. All green both runtimes.

## R3. The single-module path — COVERED (not argued), with bytes

The task offered "cover it OR state bytes why the runtime harness suffices". It does **not** suffice:
`verifyAndFixServer` compiles with `new Function` (JS-only) and RUNS cases, so a type-only error is
erased before it can fail. The single-module path (kind-absent library/service lane — §1) materializes
the SAME ESM shape (`materializeImportableTree([{path: TREE_ENTRY_PATH, source: finalModule, …}])`,
`codegen.server.ts` ~`:4558`: barrel at `src/generated.ts` + module at `src/generated/chunk-0.ts`), so
it is judged by the identical `scaffoldProject` → `typecheckDir` gate at `:4561`. A red verdict discards
the machine-verified `up` and returns `refuse(..., "RT_E_VALIDATION", …)` — no green-but-type-red
`tested`. (No in-synthesis repair here; the caller's bounded P6 cycle re-runs this path with the refusal
context — §R4.)

## R4. Repair / refusal routing + honesty contract

- **Chunked red** → ONE bounded round over the compiler-named chunks (cap
  `P6_TYPECHECK_REPAIR_MAX_CHUNKS = 3`, `:3563`): each offender is re-synthesized through the EXISTING
  `synthesizeChunkEnvelope` with `withTreeFailureContext(…, tsc tail)` on the primary prompt (so the
  model sees the compiler rows), then re-materialized and re-typechecked. Still red ⇒
  `partialTreeRefuse(..., "RT_E_VALIDATION", …)`; no chunk maps to the named file ⇒ same refusal. Every
  re-prompt is metered by the existing `accountSynthUsage`/`accountRepairUsage` + session cap and lands
  one `p6.synthesis.attempt` row — accounting unchanged.
- **Single-module red** → coded `RT_E_VALIDATION` refusal (no seal).
- **Skip** → honest `p6.tree.typecheck.skipped` log, seal proceeds (consistent with the tree-run's own
  declared-script skip: `unverifiedDeclaredScripts`, never `tested` from synthesis).
- **Unchanged:** `lastTest`/evidence semantics (synthesis still never mints `tested`; `treeUpgraded`
  path untouched), refusal codes, `partialTreeRefuse` partial-tree semantics. Existing pins: full
  `codegen.server.test.ts` is **209/209** both runtimes (the gate is null under the injected
  complete+verify deps the existing tests use, so no pin moved).

## R5. Targeted suites (both runtimes) + compile validation

```
                                v24.15.0                 v22.23.2
codegen.server.test.ts          209/209/0                209/209/0
compile-check.server.test.ts    87 (86 pass, 1 skip)*    87 (86 pass, 1 skip)*
headless.test.ts (read-only)    157/157/0                157/157/0
engine.test.ts                  17/17/0                  (host)
tsc --noEmit -p tsconfig.json   exit 0 (whole repo)
```
*the skip is the pre-existing `RT_VERIFYKIND_INSTALL`-gated real-install test. No headless pin moved.

## R6. Keyed re-prove — measured, and where it stopped (residual)

Budget was **≤3** keyed calls. Two bounded probes (real DeepSeek via `RAPIDTOOL_LLM_ENV_FILE`, persisted
conformant spec so `expand` is skipped, declared `tool` kind, jobs stripped ⇒ one chunk; the gate
wrapper ran the REAL `defaultTreeTypecheck`):

```
probe v1: ms=10594  complete=2  expand=0  verify=0  usage={p:2200,c:2944}
          refusal: RT_E_VALIDATION · chunk 1/1 refused · typeSignature functions not exported: parseInvoiceCsv
          sealed=false  treePaths=[]  (structural floor refused BEFORE the gate)
probe v2: ms=1672   complete=2 (1 real API + 1 local budget-guard)  usage={p:1248,c:31}
          refusal: RT_E_VALIDATION · chunk 1/1 refused · claimed exports not bound in the module: InvoiceRow
          sealed=false  treePaths=[]  (structural floor refused BEFORE the gate)
total REAL keyed API calls: 3 (cap reached)
```

Both keyed runs **refused to seal** (`sealed=false`, empty tree) — the measured "sealed a red tree"
outcome is gone — but both stopped at the pre-gate deterministic chunk floor, so the live-keyed
`tsc` verdict was not reached end-to-end within the cap. The gate itself is proven by the real-compiler
RED/GREEN/BEFORE tests (R2), and the production wiring always lives the gate (§R1c). **Residual: a
live-keyed tree exercising `defaultTreeTypecheck` end-to-end is unverified**; reaching it needs a
signature the model reliably claims (easiest: keep a declared `job-*` node so the plan demands a name
the model itself expanded), i.e. ≥2 further keyed calls. Reported rather than overrun.

## R7. STOP-and-REPORT — `headless.ts` repair directive (out of ownership)

The in-synthesis repair reads the compiler-named files internally, so the chunked common case is
covered. But when a typecheck red survives the bounded round (refusal) or the single-module gate refuses,
the caller's explicit directive still misses those files:

`src/lib/headless.ts:2767 treeRunFailureFiles(o: TreeRunOutcome): string[]` reads only
`o.core.entry`, `o.compile.verdicts`, non-pass `o.run.entry` and the first non-pass `o.tests` spec — it
never reads `o.project.typecheck.detail`. For a typecheck-only red the declared-script verdict carries
the offenders (e.g. `src/generated/read-csv-file.ts(107,92): error TS2749: …`) yet the block at
`headless.ts:2553` ("Repair target file(s) named by the failure") can be **empty**. My refusals DO carry
the rows (they ride `synthesisRefusal`/`treeFailure` into the next cycle's primary prompt), but the
explicit target list does not.

**Exact contract change (one of):** (1) in `treeRunFailureFiles`, after the `o.compile.verdicts` loop
(`headless.ts:2780`), parse `o.project?.typecheck?.detail` / `o.project?.test?.detail` for
`path(line,col): error TSxxxx:` rows (the same grammar `codegen.typecheckOffenderPaths` uses) and `add(p)`
each; or (2) add `offenders?: string[]` to `TreeProjectScriptVerdict` in **`compile-check.server.ts`
(my file — deliberately NOT added this resume to avoid an unconsumed field)** populated by
`runProjectScript` from the failing tail, then have headless read `o.project?.typecheck?.offenders`.
Consumption stays in `headless.ts` → not edited here.

## R8. Mock / fake census (this resume's diff only)

Diff: `codegen.server.ts` +369/-3, `codegen.server.test.ts` +189/-0, `compile-check.server.ts` +49/-0,
`compile-check.server.test.ts` +99/-1. Added-line census: `as any` 0 · `@ts-ignore`/`@ts-expect-error`/
`@ts-nocheck` 0 · `eslint-disable` 0 · `TODO`/`FIXME` 0 · `.only(`/`.skip(` 0 · empty `catch {}` 0 ·
hardcoded pass/fail fakes 0. Product code has no doubles: `defaultTreeTypecheck` runs a real `tsc`;
`typecheckDir` is the tree-run's own runner. Test doubles are the repo's standard injected seams, and the
RED/BEFORE cases use the REAL compiler (only the LLM seam is injected).

## R9. What remains

1. **Live-keyed end-to-end gate exercise (budget-bound, §R6):** not reached within the 3-call cap; needs
   ≥2 more keyed calls with a model-claimed signature (or a kept declared job node).
2. **`headless.ts` repair-target directive (§R7):** typecheck offender files are still absent from the
   explicit "Repair target file(s)" block — contract change specified, consumption out of ownership.
3. Everything else in §1–§5 of this log stands unchanged: per-kind structure is real and green on the
   keyless floor on both runtimes; the sole remaining keyed exposure (a sealed type-red tree) is now
   closed at the source — neither P6 path can seal a tree that fails its own declared `typecheck`.

---

# RESUME — engineer 341-1: the "kanban board library" kind false-red (verifier A) FIXED

**Resume scope:** verifier A's pre-seal-gate false-red — a brief that resolves `engine.uiKindOf` =
**library** while `scaffold.projectKindOf` = **webapp**, so the emitter wrote a webapp UI binding against a
library-shaped generated module (`src/ui/console.tsx(17,7) TS2345: Argument of type 'string' is not
assignable to parameter of type 'Board'`), which the pre-seal gate then refused **with no repairable
chunk**, permanently. Files touched this resume: `src/lib/scaffold.ts` + `src/lib/scaffold.test.ts`
(the two kind resolvers' divergence + the emitter binding), and `src/lib/codegen.server.ts` +
`src/lib/codegen.server.test.ts` (the gate opt-out). `compile-check.server.ts` read only, byte-unchanged.
`engine.ts` read only (STOP-and-REPORT, §S4). **Runtimes:** host `node` v24.15.0 and pinned
`& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2. **Scratch:** `%TEMP%\rt341_1\`. **No full gate**;
targeted suites only. **Keyed calls: 0** — the false-red reproduces deterministically with the real
resolvers + real emitter + real compiler, no model needed (a library-shaped module is a pure input).

## S1. The two resolvers — real behaviour, `file:line`

| resolver | file:line | input class | result |
|---|---|---|---|
| `uiKindOf` (private, 3-way) | `engine.ts:192` | brief `"A kanban board library exposing a typed board client"` | **`"library"`** — library vocabulary (`library/package/sdk/npm/module/statistics`) is checked **first**, before any UI-bearing token |
| `projectKindOf` (exported, 5-way) | `scaffold.ts:546` (order at `scaffold.ts:167`, table at `:180`) | same brief | **`"webapp"`** (pre-fix) — `KIND_ORDER` put `webapp` first and the surface noun `board` (`scaffold.ts:181`) won over `library` |

Why they disagree and why it bites: `uiKindOf` runs FIRST (`engine.ts:3206-3210`) and stamps `Project.kind`
only for `ui`→`"app"` and `cli-tool`→`"tool"`; for **library it deliberately leaves `kind` absent**
(`engine.ts:3205`, the comment says "the honest single-module library path"), because kind-absent is the
signal `codegen.singleModuleLibraryKind` (`codegen.server.ts:4105-4109`) reads to take the library module
path. Scaffold then re-inferred with a different precedence and got `webapp`. Consequence: the generated
module was a library API (`createBoard(name: string, board: Board)`), but `emitUi`'s webapp branch
(`scaffold.ts:1740`) bound a FormData form to it, coercing every arg with `String(...)`
(`scaffold.ts:1668`). Reproduced with the real resolver+emitter+gate:
`defaultTreeTypecheck → {run:"fail", detail:"src/ui/console.tsx(17,7): error TS2345: Argument of type
'string' is not assignable to parameter of type 'Board'.", files:["src/ui/console.tsx"]}` — the only
offender is the UI file, which maps to **no** synthesized chunk, so the bounded repair cannot fire.

## S2. The fix (2 in-slice changes)

1. **Kind decided consistently for the library class — `scaffold.ts:167/183` + doc `:534-545`.**
   `KIND_ORDER` now checks `library` FIRST (`["library","webapp","cli-tool","game","service"]`) and the
   library keyword row mirrors `engine.uiKindOf`'s vocabulary exactly
   (`["library","package","sdk","npm","module","statistics"]`). A brief that names a delivery kind is no
   longer captured by a generic surface noun (`board`/`dashboard`/`portal`). Same brief now →
   `projectKindOf` = **library**, matching the engine's classification and the generated module's real
   shape: the emitted tree becomes a real library package (`main`/`exports`/`files`, no `index.html`) and
   `src/ui/console.tsx` is the documented contract-level shell (`emitUi`'s non-webapp branch), which
   **typechecks** (`defaultTreeTypecheck → {run:"pass"}`).
2. **The emitter binding follows the generated entry's real shape — `scaffold.ts:1319-1324` + guard
   `:1652-1662`.** New `uiFormBindableParam`: a positional form may only bind params whose declared type
   is a coercion target the generator already produces (`string|number|boolean|int|integer|float|double|
   decimal|any|unknown`); an object binding is sound only for a single param carrying its **own**
   object-literal default (`objectKeys`, so the emitted literal mirrors the inferred type). Otherwise the
   generator emits its honest `"nothing to wire yet"` panel instead of a fabricated call. This closes the
   class for **webapp briefs too** (a webapp whose generated export happens to take a domain object), not
   just the misclassified-library case — verified with a declared-`app` project: panel emitted,
   `defaultTreeTypecheck → {run:"pass"}`.

Both changes are additive/deterministic; no export renamed.

## S3. RED → GREEN (real resolver + real emitter + real compiler; both runtimes)

**RED (pre-fix, measured with the real code):**
- `projectKindOf` test: `Expected values to be strictly equal: + actual 'webapp' - expected 'library'`
  → `not ok 1 - projectKindOf (E-15 kind mapping + inference)`.
- emitter test: `error: 'no fabricated call with a String(...) board arg'` (the fabricated
  `generated.createBoard(String(...), String(...))` was present) → `not ok`.
- gate opt-out test: `error: 'the real gate stays live under a partial seam injection'`.
- full repro (`repro_kanban.ts`): `projectKindOf: webapp`; emitted UI called
  `generated.createBoard(String(...), String(...))`; `defaultTreeTypecheck` = fail, TS2345, offender
  `src/ui/console.tsx` only.

**GREEN (post-fix):**
- `ok 1 - fixes/341-1 pre-seal self-typecheck gate` · `ok 2 - projectKindOf …` · `ok 3 - A3-f07 / W-14 …`
  → `# tests 3 # pass 3 # fail 0`.
- repro (`repro_kanban.ts`, both runtimes): `projectKindOf: library`; emitted `src/ui/console.tsx` is the
  contract-level shell (`export async function main(ctx: CliContext)`), no webapp binding;
  `defaultTreeTypecheck: {"run":"pass"}`.
- repro (`repro_emitter.ts`, declared webapp): panel
  `"shell — generated export createBoard takes a parameter a form cannot supply; nothing to wire yet"`;
  `defaultTreeTypecheck: {"run":"pass"}`.

## S4. Gate opt-out decision (`codegen.server.ts`, verifier A note)

Verifier A's note is **confirmed**: pre-fix the selector was
`deps?.typecheckTree ?? (deps?.complete === undefined && deps?.verify === undefined ? default : null)` —
injecting **either** `complete` **or** `verify` alone silently nulled the real gate (the doc, `:3399-3408`,
claimed only "injects **both**"). Fixed at `codegen.server.ts:4140` to the documented rule:
`deps?.typecheckTree ?? (deps?.complete !== undefined && deps?.verify !== undefined ? null : default)`.
So the opt-out is now EXPLICIT and narrow — **only replacing BOTH real pipeline seams** disables the gate;
a partial injection keeps the real gate live. Production is unaffected and always gates: `engine.ts`
`upgradeP6Keyed` forwards only `treeFailure/gateRepair/synthesisRefusal/patchRepairs/proven`
(`engine.ts:3134-3155`, `:3184`, `:3232`), never `complete`/`verify`. Pinned by the new test ("a PARTIAL
seam injection … does NOT silently disable the gate"), which is RED pre-fix (gate null ⇒ tree sealed ⇒
no refusal) and GREEN post-fix (real `tsc` refuses with TS2749).

## S5. Suites (targeted, both runtimes)

```
                                v24.15.0                v22.23.2
scaffold.test.ts + compile-check.server.test.ts   160 tests / 159 pass / 0 fail / 1 skip
                                                   (both runtimes; the skip is the pre-existing
                                                    RT_VERIFYKIND_INSTALL-gated real-install test)
codegen.server.test.ts          210/210/0               210/210/0   (was 209; +1 new test, no pin moved)
tsc --noEmit -p tsconfig.json   exit 0 (whole repo)
```
RED-first evidenced by reverting each of the two scaffold fixes + the gate rule one at a time, capturing
the `not ok` output above, then restoring (see §S3).

## S6. STOP-and-REPORT — the single source of truth (out of ownership)

The honest "decided once" fix belongs in **`engine.ts` / `types.ts`**, not scaffold:
- `Project.kind` (`types.ts`) is `"app" | "tool" | "game"` — it **cannot express `"library"`**, so the
  engine cannot stamp the library decision onto the project; it overloads `kind === absent` as the
  library/single-module signal (`engine.ts:3205`, read at `codegen.server.ts:4108`).
- `uiKindOf` (`engine.ts:192`) is **not exported** and is local "by design" (`engine.ts:186-190`: a
  scaffold import is a stated cycle risk), so the classifier is **duplicated** in two vocabularies.
- I aligned the two for the measured class (library precedence + vocabulary), but they can still drift:
  `uiKindOf` tokenizes with `canonicalStem` and matches `stemToken(keyword)` (`algorithms.ts:1213/1252`),
  while `projectKindOf` does an exact lowercased word-split — e.g. brief `"libraries"/"packages"` matches
  `uiKindOf` but not `projectKindOf`.

**Exact shape of the recommended change (choose one):**
1. **Widen `Project.kind` to the 5-way taxonomy (or add `deliveryKind`)** in `types.ts`, have the engine
   stamp it once in `upgradeP6Keyed` (`engine.ts:3206-3210`) from `uiKindOf` (plus game/service detection),
   and have `scaffold.projectKindOf` return the declared field when present (its existing declared-kind
   branch already does this — only the union/field needs widening). `codegen.singleModuleLibraryKind`
   (`codegen.server.ts:4108`) then reads `kind === "library"` instead of `kind === absent`.
2. Or extract the classifier to a shared leaf module (no cycle) imported by both `engine.uiKindOf` and
   `scaffold.projectKindOf`, keeping the 5-way result in one function.

Until then the two implementations must be kept in lock-step by hand; the library row is now aligned.

**Also unchanged / still stands (prior resume §R7, not mine):** `headless.ts` `treeRunFailureFiles` still
omits declared-script (`project.typecheck`) offender files from the explicit "Repair target file(s)" block.

## S7. Mock / fake census (this resume's diff only)

`scaffold.ts`: +2 helpers (`UI_FORM_BINDABLE_TYPE`, `uiFormBindableParam`), a `bindable` guard, `KIND_ORDER`
+ keyword-row edits, doc updates. `scaffold.test.ts`: +2 tests (both RED pre-fix, proven). `codegen.server.ts`:
one selector expression + doc. `codegen.server.test.ts`: +1 test (RED pre-fix, proven). Added-line census:
`as any` 0 · `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` 0 · `eslint-disable` 0 · `TODO`/`FIXME` 0 ·
`.only(`/`.skip(` 0 · empty `catch {}` 0 · hardcoded pass/fail fakes 0. The RED/GREEN evidence uses the real
resolver, the real emitter and the real `tsc`; no doubles. No file outside the four was edited; no tracked
file deleted; `engine.ts`/`compile-check.server.ts` were read only.

