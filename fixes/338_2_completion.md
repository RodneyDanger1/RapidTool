# W52 / 338-2 — "Completion" — emitted-tree declared-toolchain execution — landing log

**Lane:** 338-2, persona "Completion". **HEAD at open:** `e7da20e`, tree clean.
**Owned files (STRICT):** `src/lib/compile-check.server.ts`, `src/lib/node-runner.server.ts`, `src/lib/exec.ts` + their
`*.test.ts`; this log. **Runtime:** repo-pinned Node **22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node
**24.15.0** for every suite touched. **Scratch (outside the repo):** `%TEMP%\rt338_2\` — the repo gained no probe file.
Keyless throughout (no keyed call needed — this is local execution); no secret printed; no full gate; no `npm run eval`;
no `git` mutation.

---

## 0. Step 0 — claimed / on disk / still open

**Claimed (the wave README + mission):** the emitted tree's declared `typecheck`/`build` never run, so
`declaredScriptsVerified` is permanently `false` even when the product is real. Root cause: `treeRun` copies the tree
into `%TEMP%` excluding `node_modules`, so `tsc`/`vite` resolve no binary and record the honest UNVERIFIED skip.

**On disk at `e7da20e` (verified by reading bytes + a real probe, `%TEMP%\rt338_2\probe_emit.mjs`):**

| Fact | Bytes |
|---|---|
| `treeRun` copies the subject with `filter: (src) => !skip.has(src)`, `skip = {node_modules, .git}` | `compile-check.server.ts:1590` |
| A junction to the SUBJECT's deps is created ONLY when `existsSync(subject/node_modules)` | `compile-check.server.ts:1594-1598` |
| A fresh emitted tree has NO `node_modules` (`has node_modules: false`, 18–19 files) | probe output |
| ⇒ declared `typecheck`+`build` both `run:"skip"`, `executed:false`, `declaredScriptsVerified:false` | probe baseline JSON (§3) |
| `runProjectScripts` skips a declared tool whose `node_modules/.bin` entry is absent | `compile-check.server.ts:1383-1406` |
| The P6 journey tree-runs a temp-emitted tree with no deps | `headless.ts:2765` (`cc.treeRun(dir)`) |
| A prior lane measured one `npm install` for ONE trivial pkg at **46,964 ms** | `fixes/332_3_transit.md` §2a |

**Still open (before this lane):** nothing in my three files made the declared toolchain executable; the junction seam
only served an already-installed subject. **Open question the mission did NOT resolve:** whether the current emitted
tree would actually PASS `tsc` if it ran — it does not (see §3), and that is a real emitted-product defect.

**Prior-lane context that bounds this lane:** `fixes/332_3_transit.md` §2 chose the "named limit" branch and explicitly
REJECTED flipping `ok` on an *unrun* declared script. This lane is the wave's decision to make it *run*; the
byproduct — a genuine RED when it fails — is handled faithfully (§4) and surfaced as a STOP-and-REPORT (§8).

---

## 1. The option chosen, with evidence — and why the others were rejected

**Chosen: link the repo's OWN installed dependency root as a fallback when the emitted subject carries no
`node_modules/`** (`sharedToolchainRoot()` → `symlinkSync(…, "junction")` into the run copy). Bounded, offline, and the
declared scripts genuinely execute.

| Option | Evidence | Verdict |
|---|---|---|
| **A. Resolve `tsc`/`vite` from the repo's own `node_modules` (junction the shared root)** | probe: repo root has `node_modules/.bin/{tsc,vite}.cmd` + `typescript/bin/tsc` + `vite/bin/vite.js`; junctioned onto a real emitted tree, `tsc --noEmit` and `vite build` BOTH genuinely ran (2.0 s / 1.1 s) | **CHOSEN** — offline, zero install, real execution |
| **B. Rewrite only the tool BINARY path (`node <repo>/node_modules/typescript/bin/tsc`)** | `tsc` still needs the tree's IMPORTS resolvable (`import react`/`react-dom`, tsconfig `types:["node"]`); with no dep root it fails on missing modules for a reason that is not the tree's | **rejected** — a full dep ROOT is required for a fair run, not just the binary |
| **C. Install into the scratch copy behind a hard timeout** | one trivial pkg = **46,964 ms** (`332_3_transit` §2a); a real tree pulls react+vite+typescript ⇒ ~1–3 min per tree-run, in-loop, per repair | **rejected** — not viable in the hot path (measured, not assumed) |
| **D. Flip `ok`/`declaredScriptsVerified` on an *unrun* script (the 332-3 "named limit" branch)** | `mintTreeRunTested` gates on `outcome.ok === true` (`codegen.server.ts:4779`); would red every fresh tree without running anything | **rejected** — a skip is never a pass (hard rule 4) |

Option A is exactly the mission's first named choice, and it is the ONLY one that executes the toolchain offline.

---

## 2. The fix (minimal, surgical — +62 lines source, comments included)

`src/lib/compile-check.server.ts`:

1. `sharedToolchainRoot()` (`:1523`): resolves `<repo>/node_modules` from the module's own URL
   (`import.meta.url` → `../..`, the SAME discovery `headless.ts:1837` uses) and returns it only when it carries a
   `.bin`. Returns `null` when there is no usable root — a toolchain is never fabricated.
2. `treeRun` (`:1591-1605`): `linkedDeps = existsSync(subjectDeps) ? subjectDeps : sharedToolchainRoot()`; junction
   either way; record `toolchainSource = linkedDeps === subjectDeps ? "tree" : "repo-shared"`.
3. `runProjectScripts` note seam (`:1699-1717`, `usedSharedToolchain` at `:1705`): when a declared script whose first token is NOT the node/npm runtime
   actually EXECUTED (`v.executed === true`) and it resolved from `repo-shared`, a loud top-level note names the shared
   root and states the emitted tree's declared devDependency VERSIONS were NOT installed — so the claim stays scoped.

No semantics were redefined: a declared script that ran red still reds the tree (unchanged T-18 rule); a genuinely
unresolvable tool still yields the honest `skip` + UNVERIFIED note; a tree with its own install is byte-identical
(`toolchainSource === "tree"`, no new note).

**Exactness of the claim (why the shared root is named):** the emitted tree declares `typescript ^5.7.0` / `vite ^7.0.0`;
the repo runs `5.x` / `vite 8.2.2`. The declared VERSIONS were not installed — only a real `tsc`/`vite` ran. The field
`declaredScriptsVerified` measures declared-script EXECUTION (its own docblock, `:396-401`), which the note now scopes.

---

## 3. Measured before / after (real verdict JSON, real probe)

Probe: `%TEMP%\rt338_2\probe_emit.mjs` / `probe_final.mjs` — emits a REAL engine-run webapp tree
(`scaffoldProject(runHeadless(seedProject({kind:"app"}), ALL_PHASES))`) to scratch and calls the REAL `treeRun`.

**BEFORE (pre-fix source = `compile-check.server.ts.bak`), real emitted tree A:**

```json
"ok": true, "declaredScriptsVerified": false, "unverifiedDeclaredScripts": ["typecheck","build"],
"project": { "typecheck": {"run":"skip","executed":false,"command":"tsc --noEmit",
   "note":"the declared \"typecheck\" tool `tsc` has no node_modules/.bin entry in this tree … UNVERIFIED … not a fabricated pass"},
   "build": {"run":"skip","executed":false,"command":"vite build",
   "note":"no node_modules/ present in the tree — \"npm run build\" was NOT executed …"} }
```

**AFTER (this lane), the SAME emitted tree A — the declared toolchain now genuinely RUNS:**

```json
"ok": false, "declaredScriptsVerified": false, "unverifiedDeclaredScripts": null,
"project": { "ok": false,
  "typecheck": {"run":"fail","executed":true,"exitCode":2,"durationMs":2804,
     "detail":"src/jobs/dispatch.ts(11,21): error TS7006: Parameter 'spec' implicitly has an 'any' type."},
  "test":  {"run":"pass","executed":true,"exitCode":0},
  "build": {"run":"pass","executed":true,"exitCode":0} },
"error": "the emitted project's own `npm run typecheck` fail (exit 2) — src/jobs/dispatch.ts(11,21): error TS7006 …"
```

**AFTER, a byte-identical copy B with the ONE untyped param typed (a genuinely type-clean product) — the gap CLOSES:**

```json
"ok": true, "declaredScriptsVerified": true, "unverifiedDeclaredScripts": null,
"project": { "ok": true, "typecheck":{"run":"pass","executed":true,"exitCode":0},
             "test":{"run":"pass","exitCode":0}, "build":{"run":"pass","executed":true,"exitCode":0} },
"note": "the declared project scripts were resolved from the RapidTool repo's own node_modules/ (offline, no install) —
         the emitted tree's declared devDependency versions were NOT installed · SUBSTANCE MARKING …"
```

**Verdict on the gap's own bar:** `declaredScriptsVerified` becomes **true when the toolchain genuinely ran and
passed** (tree B), stays **false with the named reason when the tool could not run** (unresolvable-tool skip, §6), and
**no path records a fabricated pass** — the emitted floor tree's declared `typecheck` genuinely FAILS on a real error
(§3, §8). **The current emitter does NOT type-clean its generated modules, so the floor/model trees genuinely fail
their own `tsc`** — a real finding owned outside my files (§8).

### Measured wall time added to a tree-run

Fixed type-clean emitted tree, identical bytes, `probe_delta.mjs`:

| Source | treeRun wall | typecheck | build | test | specs |
|---|---|---|---|---|---|
| pre-fix (skips) | **1,379 ms** | skip (0 ms) | skip (0 ms) | 405 ms | 431 ms |
| this lane | **4,458 ms** | pass 2,006 ms | pass 1,069 ms | 389 ms | 429 ms |

**Added: +3,079 ms (~3.1 s) per tree-run**, entirely offline (`tsc --noEmit` ≈2.0 s + `vite build` ≈1.1 s). No network,
no install, bounded by the existing `treeRun` timeout.

---

## 4. Per-fix RED / GREEN

**RED-first.** The two new "shared root RUNS" tests and the F-4 game-tree test were written before the source fix and
run against the pre-fix source (`compile-check.server.ts.bak` restored in place, then the patched file restored
byte-for-byte):

```
pre-fix source + new tests:  # tests 83  # pass 79  # fail 3  # skipped 1
    not ok 1 - 338-2: a declared `tsc --noEmit` with no in-tree node_modules RUNS … → declaredScriptsVerified:true
    not ok 2 - 338-2: a declared `vite build` with no in-tree node_modules RUNS from the shared root and passes
    not ok 1 - clean game tree: green with its declared toolchain RUN, and the UI-shell skip is an UNVERIFIED entry
patched source + same tests: # tests 83  # pass 82  # fail 0  # skipped 1
```

| Fix | Test (file) | RED (pre-fix) | GREEN (patched) |
|---|---|---|---|
| Shared root resolves the declared `tsc` and it passes | `compile-check.server.test.ts` (T2 338-2) | fail | pass |
| Shared root resolves the declared `vite build` and it passes | `compile-check.server.test.ts` (217d 338-2) | fail | pass |
| The real F-4 game tree's declared tsc+build run and pass | `compile-check.server.test.ts` (F-4) | fail | pass |
| Genuinely unresolvable tool → honest skip (guard, passes on both) | `compile-check.server.test.ts` (T2 338-2 / 216 338-2) | pass | pass |

---

## 5. Mock / fake census (owned files)

Ran the census over `compile-check.server.ts` / `node-runner.server.ts` / `exec.ts` + their tests:

| Pattern | Hits in MY new bytes | Verdict |
|---|---|---|
| `as any` / `@ts-ignore` / `@ts-expect-error` / `eslint-disable` | 0 | clean |
| `TODO`/`FIXME` placeholder bodies | 0 (all `TODO(E-15)` hits are the PRODUCT CONTRACT marker the emitted oracle asserts — pre-existing, not mine) | clean |
| silent `catch {}` faking a computation | 0 new — `sharedToolchainRoot`'s `catch { return null; }` is a documented best-effort that yields the HONEST skip, never a pass | clean |
| `mock`/`fake`/`placeholder` code | 0 new — the `mocked:true` install-seam (tests only) and the fake-secret strings in `node-runner.server.test.ts` are pre-existing, deliberate, and never evidence of a real run | clean |
| tests that cannot fail | none — every added assertion has a real, observable subject (exit codes, `executed`, resolved-path notes) | clean |

**No mock, fake, or placeholder code was added.** The mechanism spawns a REAL `tsc`/`vite` from the repo's own install.

---

## 6. Tests added / updated + real results on both runtimes

| Test | File | Node 22 | Node 24 |
|---|---|---|---|
| `338-2: a declared tsc … RUNS from the shared root → declaredScriptsVerified:true` | `compile-check.server.test.ts` | pass | pass |
| `338-2: a genuinely unresolvable declared tool stays the honest UNVERIFIED skip` | `compile-check.server.test.ts` | pass | pass |
| `338-2: a declared build the shared root cannot resolve → honest skip + UNVERIFIED note` | `compile-check.server.test.ts` | pass | pass |
| `338-2: a declared vite build … RUNS from the shared root and passes` | `compile-check.server.test.ts` | pass | pass |
| `F-4 clean game tree … the UI-shell skip is an UNVERIFIED entry` (updated: declared tsc/vite now RUN) | `compile-check.server.test.ts` | pass | pass |
| `216 338-2: a declared tool the shared root cannot resolve → honest skip` (updated) | `compile-check.server.test.ts` | pass | pass |

| Command | Result |
|---|---|
| Node 22 `--test compile-check + node-runner + exec` (baseline 114 / 113 / 0 / 1) | **116 tests / 115 pass / 0 fail / 1 skip** (+2) |
| Node 24 same three suites | **116 / 115 pass / 0 fail / 1 skip** |
| Node 22 `--test compile-check.server.test.ts` (baseline 81/80/0/1) | **83 / 82 / 0 / 1** (+2) |
| Node 22 dependents `emitted-honesty + maker-score + honesty-guards + wild-step` | **132 / 132 pass / 0 fail** |
| Node 22 `dod + scaffold` | **64 / 64 pass / 0 fail** |
| Node 22 `codegen.server.test.ts` (the mint consumer) | **183 / 183 pass / 0 fail** |
| Node 22 `patch-preservation.test.ts` | **1 / 1 pass** |
| `npx eslint` on the four changed owned files | **exit 0** |
| `npx tsc --noEmit` (full repo leg) | **exit 0, zero diagnostics** |

`node-runner.server.ts` and `exec.ts` were NOT changed — their suites are green on both runtimes unchanged.

---

## 7. What this change means, precisely

- **`declaredScriptsVerified` is no longer permanently false.** On a fresh emitted tree whose declared toolchain
  genuinely passes, it is `true` (tree B, §3). It stays `false` only when a declared script genuinely could not run
  (unresolvable tool → skip) or genuinely failed (a real red).
- **The "unverified-but-`ok`" state is now narrower.** It survives only for a tool neither the node runtime nor any
  `node_modules/.bin` can resolve. For the real scaffold (`tsc`/`vite`) it is GONE: the tools resolve and RUN.
- **The emitted tree's own `tsc` FAILS on the current emitter** (`sandbox.ts:209`'s floor template emits
  `function synthesize(spec)` — an untyped param under the emitted `strict: true` tsconfig; real keyed modules are
  likewise untyped, e.g. `async function estimateARV(propertyId)` recorded at `wave_plans/W45/parent-keyed-findings.md:71`).
  This is a REAL product defect the toolchain-skip previously hid — STOP-and-REPORT (§8).

---

## 8. STOP-and-REPORT (unowned; the exact shape)

1. **`src/lib/sandbox.ts:209` — the P6 floor template emits an UNTYPED parameter.** `buildPhase6Module` writes
   `function synthesize(spec)`; the emitted `tsconfig.json` is `strict:true`, so the tree's declared `tsc --noEmit`
   genuinely fails `TS7006`. Probe proof: typing ONLY that param makes `tsc --noEmit` exit 0 (tree B, §3). **Shape:**
   annotate the emitted param (e.g. `spec: { name: string; phase: number; job: string }`) or otherwise make the floor
   module type-clean. Until landed, EVERY floor tree reds its own declared typecheck. `sandbox.ts` is in no lane.
2. **Generated model modules are untyped too.** `codegen.server.ts`'s P6 contract ("TypeScript-style CommonJS") plus
   its worked example `function add(a, b)` produce untyped params; a keyed emitted tree would likewise fail its own
   `tsc`. **Shape:** require annotations in the prompt (338-1 owns `codegen.server.ts`), OR relax the emitted
   `noImplicitAny` in `tsconfigJson` (338-5 owns `scaffold.ts`). Without one of these, the P6 `tested` mint
   (`codegen.server.ts:4779` gates on `outcome.ok`) blocks once the declared typecheck actually runs.
3. **`src/lib/headless.test.ts:2035` (338-3's file) — 1 test now FAILS.**
   `"emit --run: treeRun{compile,tests,run} rides the envelope; a green tree exits 0"` asserts the emitted floor tree
   is `ok:true` / exit 0 / `unverified:true`. With the declared toolchain running, the floor tree's `tsc` genuinely
   fails ⇒ `ok:false`, CLI exit 1, no `unverified` flag. **Shape:** reconcile the expectation to the new honest state
   (a tree whose declared toolchain runs and fails is RED), or land (1)/(2) so the fresh tree VERIFIES instead.
4. **`scripts/cli-exit-taxonomy.test.mjs` — 1 test now FAILS (frozen `scripts/**`).**
   `"W49 · 335-4: emit --run / tree-run default to exit 0 on a green-but-unverified tree; --require-verified opts into
   exit 5"` — the same cause as (3). The W49 335-4 "fresh tree is ALWAYS unverified" premise is superseded by gap 2:
   once the toolchain runs, a fresh tree is either VERIFIED (emitter fixed) or RED (emitter not fixed) — never the
   "green but unverified" default. **Shape:** update the taxonomy test + the CLI usage prose (`rapidtool-cli.mjs:28-29`,
   `:4932`, `:4935`) — owner: the boundary owner (`scripts/**` is frozen).
5. **`src/lib/scaffold.ts` (338-5's file) — the emitted README banner is now stale.** (`NEVER runs` at `:2859`.) It states the emitter
   "NEVER runs them … A fresh tree-run reports the same state as `declaredScriptsVerified: false`". The EMITTER still
   doesn't run them, but the tree-run NOW CAN; the banner's "same state" claim is no longer true for a type-clean tree.
   **Shape:** 338-5 reviews the banner text; `scaffold.test.ts:1296` pins the bytes (still passes — bytes unchanged).

No owned file outside the four was edited. No tracked file was deleted.

---

## 9. What I did NOT do and why

- **Did not edit `sandbox.ts`, `codegen.server.ts`, `scaffold.ts`, `headless.ts`/`.test.ts`, or `scripts/**`** — outside
  my strict ownership; all reported as STOP-and-REPORT with file:line and the exact shape (§8).
- **Did not run a network `npm install` in `treeRun`** — 46,964 ms for one package (332-3 §2a); Option C rejected.
- **Did not redefine `ok`, the T-18 "declared red can never be ok" rule, or `unverifiedDeclaredScripts`** — a genuine
  declared red still reds the tree; redefining it to protect the mint would soften an honest result.
- **Did not edit `node-runner.server.ts` / `exec.ts`** — the gap is entirely in `treeRun`'s dep-root resolution; those
  two files' suites are untouched and green.
- **Did not run the full gate / `npm test` / `npm run eval`; no keyed call** — targeted suites only (five siblings
  mid-edit); the boundary gate is the parent's.
- **Did not delete `%TEMP%\rt338_2\`** — scratch outside the repo; harmless, and the probes document the measurements.

---

# W52 follow-up — 338-2b (2026-10-02) — floor template type-clean + test reconciliation

**Trigger:** the boundary gate after lane 338-2's landing: four failures, all of the class "a fresh tree is
green-but-unverified" — a premise 338-2's toolchain-execution fix invalidated. Plus the floor-template defect
338-2 surfaced (STOP item 1). **Files touched:** `src/lib/sandbox.ts`, `src/lib/headless.test.ts`,
`scripts/cli-exit-taxonomy.test.mjs`, `src/lib/llm/providers/mock.test.ts`, the one banner line in
`src/lib/scaffold.ts` + `scaffold.test.ts`. No other owned file changed; `src/lib/codegen.server.ts` untouched
(338-1b's). No deletions; no keyed calls; no full gate.

## Job 1 — the P6 floor template is now type-clean (`sandbox.ts`)

**Fix (`sandbox.ts:215`):** `function synthesize(spec)` → `function synthesize(spec = { name: "", phase: 0, job: "" })`.

Why a DEFAULT, not a TS `spec: {…}` annotation: the SAME template bytes are ALSO executed as plain JS —
`engine.ts:939` runs `buildPhase6Module(...)` output through `runGenerated()` → `new Function(body)`, where a
TS-only annotation is a SyntaxError (`sandbox.test.ts` "accepts and executes buildPhase6Module output" pins that
path). The default object is valid JS AND types `spec` by inference under the emitted `strict:true` tsconfig's
`noImplicitAny`. No sibling untyped emission exists in the template (the three `test_*` helpers take no
parameters; the `catch (e)` binding is unused). **The emitted tsconfig's strictness is UNCHANGED.**

**RED → GREEN (real emitted floor tree, `%TEMP%\rt338_2\probe_final.mjs`, real `treeRun`):**

| sandbox.ts | ok | declaredScriptsVerified | typecheck |
|---|---|---|---|
| untyped (temporarily reverted) | false | false | **fail exit 2 — `src/jobs/dispatch.ts(11,21): error TS7006: Parameter 'spec' implicitly has an 'any' type`** |
| default-typed (this lane) | **true** | **true** | **pass** |

`sandbox.test.ts` 36/36 — the `new Function` execution path is intact.

## Job 2 — the tests whose premise 338-2 invalidated, reconciled to real behaviour

A fresh emitted tree is now GREEN **and VERIFIED** (`declaredScriptsVerified:true`, exit 0, no `unverified`
flag) — proven on a real emission (Job 1 table). Each pin below was moved to that reality; where a genuine
behaviour still exists it was re-pinned by CONSTRUCTING the condition honestly, never by deleting coverage.

### 2a. `src/lib/headless.test.ts` — "emit --run …; a green tree exits 0" (the E-25 describe)
- **Reconciled to:** a fresh tree is VERIFIED → exit 0, `declaredScriptsVerified:true`,
  `unverified`/`unverifiedDeclaredScripts` absent; `--require-verified` stays 0 on a verified tree.
- **Teeth kept:** the W49 exit-5 pin is re-constructed on the read-only `tree-run` verb — edit the emitted
  `package.json` to declare `typecheck: "rapidtool-not-a-real-tool-338 --noEmit"` (a tool no
  `node_modules/.bin` resolves) → `tree-run` defaults exit 0 with `unverified:true` +
  `unverifiedDeclaredScripts:["typecheck"]`, and `--require-verified` → exit 5.
- **RED (pre-reconcile):** `not ok 4 - emit --run … a green tree exits 0` — 146 tests / 145 pass / 1 fail.
- **GREEN:** 146 / 146, both runtimes.

### 2b. `scripts/cli-exit-taxonomy.test.mjs` — "W49 · 335-4 … green-but-unverified … exit 5"
- **Reconciled to:** the same verified default (`emit --run` exit 0, `declaredScriptsVerified:true`, no
  unverified flag); `--require-verified` on a verified tree stays 0.
- **Teeth kept:** the constructed unresolvable-tool tree on `tree-run` (exit 0 default / exit 5 strict).
- **RED (pre-reconcile):** `not ok 46 - W49 · 335-4 …` — 46 tests / 45 pass / 1 fail.
- **GREEN:** 34 / 34 (cli-exit-taxonomy alone), both runtimes.

### 2c. `src/lib/llm/providers/mock.test.ts` — `5 !== 4` (338-1 log §7)
- **Reconciled to:** compute the plan the SAME way the pipeline does —
  `orderTreeChunks(treeChunkPlan(base, reconcilePlanTypeSignatures(base, E2E_SPEC.typeSignatures).typeSignatures))`
  — one canned envelope per plan row; pins become `plan.length === 6`, `calls().length === 1 + plan.length`,
  `tree.length === 1 + plan.length`, paths `[TREE_ENTRY_PATH, ...plan.map((c) => c.path)]`.
- **RED (committed bytes, byte-exact via `git cat-file` blob, 19,647 B):** `not ok 1 - …E2E…` —
  `1 expansion + 3 chunk synthesis calls — exactly what the pipeline asked` / **`5 !== 4`**.
- **GREEN:** 12 / 12, both runtimes.

### 2d. `src/lib/scaffold.ts` banner + its pin
- **Reconciled to:** the banner's last sentence now states the true tree-run outcomes (a type-clean tree
  reports `declaredScriptsVerified: true`; an unresolvable declared tool reports `false` +
  `unverifiedDeclaredScripts`). `scaffold.test.ts` pins both strings.
- **RED (old banner):** `not ok 1 - the emitted README LEADS with the banner …` — 61 tests / 60 pass / 1 fail.
- **GREEN:** 61 / 61.

## Mock / fake census (new bytes)

Zero `as any` / `@ts-ignore` / `@ts-expect-error` / `eslint-disable`; zero new TODO/placeholder bodies (all
`TODO(E-15)` hits are the emitted product-contract marker); no mock/fake code. The sandbox default is real
JS+TS, exercised by the real `new Function` path.

## Verification (done-when)

| Command | Node 22.23.2 | Node 24.15.0 |
|---|---|---|
| compile-check + headless + sandbox + mock | **277 / 276 pass / 0 fail / 1 skip** | **277 / 276 pass / 0 fail / 1 skip** |
| `scripts/cli-exit-taxonomy.test.mjs` | **34 / 34 pass / 0 fail** | **34 / 34 pass / 0 fail** |
| `npx tsc --noEmit` | **exit 0** | — |
| `npx eslint` (changed files) | **exit 0** | — |

Supporting suites (Node 22): `scaffold` 61/61; `dod`+`doctor`+`gates`+`engine`+`emitted-honesty`+
`maker-score`+`verify`+`verify.server` **363/363**; `codegen.server`+`node-runner`+`exec` **219/219**.

## STOP-and-REPORT (still unowned)

- **`scripts/rapidtool-cli.mjs` usage prose + `scripts/README-cli.md`** still state the superseded "a fresh
  tree has no node_modules → its toolchain is ALWAYS unverified" premise (`rapidtool-cli.mjs:28-29`, `:4932`,
  `:4935`; `README-cli.md:470-475`, `:1032-1043`). The envelope FIELDS those docs describe are unchanged; only
  the "always unverified" premise is stale. `scripts/**` is frozen — owner: boundary owner.
- **`src/lib/doctor.test.ts:271-281`** — the `KEYLESS_TEMPLATE` literal is described as "the exact keyless P6
  floor shape"; it is now one token off (the real template's param carries an inference-anchoring default).
  The test itself is unaffected (it classifies a hand-embedded shape; the classifier regexes
  `function synthesize\s*\(` / `function test_no_skip\s*\(` still match both forms). Not owned; cosmetic.

