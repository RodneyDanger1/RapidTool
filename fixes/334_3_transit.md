# W48 / 334-3 — "Transit" — emitted tree, tree-run & the DoD mint (pass 3)

**Lane:** 334-3, persona "Transit". **HEAD at open:** `0d5b250`, tree clean.
**Owned files (STRICT):** `src/lib/scaffold.ts`, `src/lib/compile-check.server.ts`, `src/lib/dod.ts`
(granted this wave) + their `*.test.ts`; this log.
**Runtime:** repo-pinned Node **22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node
**v24.15.0** — every suite below run on BOTH. **Scratch (outside the repo):** `%TEMP%\rt334_3\`
(probes `probe-kinds.mjs`, `probe-main.mjs`, `probe-readme.mjs`, `probe-hash.mjs`) — the repo gained
`src/lib/dod.test.ts` only (an owned test file); no probe file landed in the repo.
Keyless throughout: no keyed call, no secret printed, no `npm run eval`, no full gate (siblings editing).

## 0. Step 0 — reconciliation (claimed / on disk / still open)

**Claimed (331-3, 332-3, 332-3b, 333 audit F-4):**
- `331-3`/`332-3`: `treeRun` carries a first-class `declaredScriptsVerified`/`unverifiedDeclaredScripts`
  machine state (renamed by F-4 from the over-broad `verified`), `unverifiedEntry` for a deliberate
  entry skip; `treeVerdictHash` folds the declared-script state.
- `332-3`: `ok` is NOT redefined; the CLI exit code / DoD mint / README banner flips were declared owed.
- `333_1_verifier.md` F-4: the field rename is landed; **the consumer flip remains owed** (top open item).

**On disk (verified today, bytes read):**
- `src/lib/compile-check.server.ts:1483-1493`, `:1696-1708` — `declaredScriptsVerified` /
  `unverifiedDeclaredScripts` / `unverifiedEntry` are computed and serialized. **CONFIRMED.**
- `src/lib/compile-check.server.ts:720-733` — `treeVerdictHash` folds them. **CONFIRMED.**
- My probes reproduce the fresh-tree state for all five kinds: `ok:true`,
  `declaredScriptsVerified:false`, `unverifiedDeclaredScripts` = `["typecheck","build"]` (webapp/game)
  or `["typecheck"]` (cli-tool/library/service), `typecheck`/`build` = `skip`, `test` = `pass`.

**Still open (with `file:line`), now actioned or reported:**
1. **No consumer refuses on the tree's unverified declared scripts** — top open item of
   `fixes/333_0_parent.md` §5. Before this lane: the emitted README said nothing about it
   (`src/lib/scaffold.ts` `readmeBody` — no banner), and `p6-verified` read only
   `label`/`evidenceHash` (`src/lib/dod.ts:617`). **My two surfaces: FIXED/decided below.**
2. **CLI `emit --run` exit code** — `scripts/rapidtool-cli.mjs` (334-4) is still owed; out of my lane.
3. **The mint's evidence hash does not fold the declared-script state** —
   `src/lib/codegen.server.ts:4483 treeRunTestedEvidence` (334-1's file). Reported (see §7).
4. **Same-class entry mis-resolution survived for `library`/`service`** —
   `src/lib/compile-check.server.ts:1272 resolveHeadlessEntry` silently dropped an npm-standard
   `main: "./src/main.ts"`. **FIXED (§3).**

**Claim-vs-bytes divergences (findings in their own right):**
- The W48 brief's baseline "`compile-check.server.test.ts` 75 (1 skip)" is stale: on-disk HEAD is
  **78 tests / 77 pass / 1 skip** (the 332-mint + F-4 +3 is not in the brief's figure). Measured today.
- The brief names `src/lib/dod.test.ts`; **no such file existed** — the DoD's own long-running tests
  live in `src/lib/gates.test.ts` (dod.ts header and gates.test.ts header both say so). I did NOT touch
  `gates.test.ts` (unowned) and created `src/lib/dod.test.ts` for the W48 decision pins only.

## 1. T1 — the DoD decision: does an unverified tree satisfy `p6-test` / `p6-verified`?

**Decision: YES — and it is the honest line, not a false claim — because the two criteria measure the
tree-run's EXECUTED self-test / machine-run verdict, which genuinely ran green, NOT the emitted
package.json's declared toolchain. The declared-toolchain gap is a NAMED LIMIT carried elsewhere.**

Evidence for the constraint (measured, `probe-kinds.mjs`, Node 22.23.2):

| kind | `ok` | `declaredScriptsVerified` | `unverifiedDeclaredScripts` | typecheck / test / build |
|---|---|---|---|---|
| webapp | true | **false** | `["typecheck","build"]` | skip / pass / skip |
| game | true | **false** | `["typecheck","build"]` | skip / pass / skip |
| cli-tool | true | **false** | `["typecheck"]` | skip / pass / skip |
| library | true | **false** | `["typecheck"]` | skip / pass / skip |
| service | true | **false** | `["typecheck"]` | skip / pass / skip |

Why `p6-test`/`p6-verified` cannot require declared-script verification:
- `mintTreeRunTested` (`codegen.server.ts:4527`) mints the `label:"tested"` stamp only when
  `outcome.ok === true` AND ≥1 spec actually executed — it does **not** read `declaredScriptsVerified`.
- `p6-verified` gates the P6 journey: `driveP6Journey` converges only when `gate.passed === true`
  (`headless.ts:2930`), and the P6 gate contains `p6-verified`/`p6-test`.
- A fresh P6 tree emits to a temp dir with no `node_modules`, so its declared `tsc`/`build` **always
  skip** (≈47 s for one `npm install`, and the whole tree pulls react+vite+tsc). Requiring
  `declaredScriptsVerified===true` would make the criterion **unsatisfiable on every fresh tree ⇒
  `gate.passed` can never be true ⇒ the keyed P6 mint is blocked forever.** That is the
  can-never-pass trap the brief warned about.

What I DID change, so the pass is not hollow: `p6-verified` now requires the stamp to be a genuinely
EXECUTED-green verdict — `ok === true` and a non-empty `detail` (the same floor `p6-test` reads) — on
top of `label === "tested"` + non-empty `evidenceHash` (`dod.ts:630`). Before, a `{label:"tested",
evidenceHash:"h", ok:false}` or detail-less stamp passed a criterion whose name reads as verification.
No criterion was added; the P6 mint path is unchanged.

## 2. T1a — the emitted README banner (`scaffold.ts`)

**Before:** `readmeBody` led with `# <name>`; nothing on the README said the declared `typecheck`/
`build` never ran. A fresh tree presented as complete.
**After:** `declaredScriptsBanner(kind)` (`scaffold.ts:2772`) is emitted as the FIRST block, in the same
GitHub-alert style as headless's red-tree banner (`> [!CAUTION]` → here `> [!WARNING]`), and names the
exact declared scripts the kind carries. Rendered README head (`probe-readme.mjs`):

```
> [!WARNING]
> ## DECLARED SCRIPTS NOT RUN — `typecheck` and `build` ARE UNVERIFIED (RapidTool W48 / 334-3)
>
> The emitted `package.json` declares `typecheck` and `build`, but this emitter NEVER runs them over
> the tree it writes — no `npm install`, no declared-script execution. They are scaffold claims — NOT
> verified behavior. Run `npm install && npm run typecheck && npm run build` yourself (or re-emit with
> `--verify-kind`, which installs and builds a scratch copy) ... `declaredScriptsVerified: false` +
> `unverifiedDeclaredScripts: [...]` in its JSON.

# <name>
```

For cli-tool/library/service (no `build`) it reads `` `typecheck` IS UNVERIFIED `` / "declares
`typecheck` … NEVER runs it". It is deliberately **unconditional**: `--verify-kind` verifies a SCRATCH
COPY and records its verdict only on the CLI payload — never in the project or the tree — so no byte
the scaffold can read attests that these scripts ran over this tree. The honest default is to state the
limit on the artifact itself. (Red-tree banner tests are untouched: headless still prepends
`> [!CAUTION]` first, so `readme.startsWith("> [!CAUTION]\n")` holds.)

## 3. T3 — the same mis-resolution class: the DECLARED `main` was silently dropped

**Found and fixed.** `sanitizeRelPath` rejects any "." path segment (traversal guard), but npm's `main`
convention is `./src/main.ts` — exactly what the scaffold emits for `library`/`service`
(`scaffold.ts` `packageJson`). `resolveHeadlessEntry` therefore returned `null` for the declared main
and the smoke fell through to an unrelated job module. Reproduced (`probe-main.mjs`):

**BEFORE** (the declared `main` is corrupted to throw at import — the tree still reads green):
```
library  pkgMain="./src/main.ts"  cleanEntry="src/jobs/deliver_core_workflow.ts" cleanOk=true
         corruptedEntry="src/jobs/deliver_core_workflow.ts" corruptedOk=true     <- FALSE GREEN
service  pkgMain="./src/main.ts"  corruptedEntry="src/jobs/bill.ts"  corruptedOk=true  <- FALSE GREEN
```
**AFTER** (`compile-check.server.ts:1274/1281` — strip the harmless leading `./` before sanitizing;
`..` still fails):
```
library  cleanEntry="src/main.ts" cleanOk=true  corruptedEntry="src/main.ts" corruptedOk=false
service  cleanEntry="src/main.ts" cleanOk=true  corruptedEntry="src/main.ts" corruptedOk=false
```
This is the same class as the 332 `game`/`index.html ⇒ ui-shell` fix: the entry a consumer actually
loads is now the one smoke-checked. Clean trees are unchanged (`ok:true`); the corrupted declared main
now REDs instead of riding green. New pin: `compile-check.server.test.ts` "W48 / 334-3 (T3) …".

## 4. T3 sweep — `verifyKindDir` cleanup, comments, other kinds

- **`verifyKindDir` cleanup (re-checked, no change needed).** `cleanScratch()`/`finish()` cover the
  copy-failure and work-block returns; the `finally` keeps a safety net; `finish` appends the
  "scratch copy could not be removed" note on a failed `rmSync` (the same contract `treeRun` uses).
  No silent `catch {}` remains in the cleanup paths.
- **Entry resolution for the other kinds (verified, not assumed).** `resolveHeadlessEntry` is reached
  for every non-`ui-shell` kind via `resolveEntry` (`:1326`) and for the UI-shell core smoke (`:1620`).
  `game`/`webapp` (root `index.html`) keep the honest UI-shell skip with the generated-core smoke
  (332 fix intact — probe shows `core.run:"pass"` for both). `library`/`service` fixed (§3).
  **Named residual:** `cli-tool` declares no `main`; its runnable program is `src/main.ts` reached via
  the `bin/<slug>.mjs` launcher, and that launcher spawns on import (not a load-smoke target), so the
  tree smokes the generated job module instead. Not fixed — the declared path is not derivable from
  `package.json` without executing the launcher.
- **Comments corrected (claims the bytes no longer supported):**
  - `scaffold.ts:110` `ScaffoldOptions` said "omitted ⇒ pre-277 bytes" — false once the banner is
    emitted unconditionally; now states the additive/omitted-hook meaning and points at the banner.
  - `scaffold.ts` `PKG_SCRIPTS` honesty note said verify-kind runs "the declared build"; `verifyKindDir`
    runs install + `build` + `test` — corrected, and it now points at the banner.
- The `treeRun`/`declaredScriptsVerified`/`unverifiedEntry` docs (`compile-check.server.ts:396-467`)
  match the code as read.

## 5. Tests added + real results (both runtimes)

| Test | File | Node 22.23.2 | Node v24.15.0 |
|---|---|---|---|
| T1a: README LEADS with the banner, names typecheck + build unverified | `scaffold.test.ts` | pass | pass |
| T1a: names only the scripts the kind declares (cli-tool has no build) | `scaffold.test.ts` | pass | pass |
| T1b: a GREEN executed run whose declared tsc/build never ran still mints the tested verdict p6-test/p6-verified require | `dod.test.ts` (NEW) | pass | pass |
| T1b: the DoD verdict is deliberately blind to `declaredScriptsVerified` (limit carried by the artifact/envelope) | `dod.test.ts` (NEW) | pass | pass |
| T1b: a HOLLOW 'tested' stamp (ok:false / no detail) never satisfies p6-verified | `dod.test.ts` (NEW) | pass | pass |
| T3: a './'-prefixed declared main is smoke-loaded; a broken declared main REDs | `compile-check.server.test.ts` | pass | pass |

| Suite | Node 22 | Node 24 |
|---|---|---|
| `scaffold.test.ts` (baseline 48) | **50 / 50 / 0** | 50 / 50 / 0 |
| `compile-check.server.test.ts` (baseline 78 / 77 / 1) | **79 / 78 / 0 fail / 1 skip** | 79 / 78 / 1 skip |
| `dod.test.ts` (baseline: **absent**) | **3 / 3 / 0** | 3 / 3 / 0 |
| `gates.test.ts` (the pre-existing DoD test home, must stay green) | **88 / 88 / 0** | 88 / 88 / 0 |
| Combined owned + dependents (`emitted-honesty`, `sweep73-fuzz`, `honesty-guards`, `maker-score`, `wild-step`, `patch-preservation`, `gates`, `scaffold`, `dod`, `compile-check`) | **400 tests / 399 pass / 0 fail / 1 skip** | **400 / 399 / 0 / 1** |
| `npx eslint` on the six owned files | **exit 0** | — |
| `npx tsc --noEmit` | **exit 0**, zero diagnostics in my files | — |

## 6. RED-first teeth (each change reverted in place, run, then restored)

- **T3 main fix reverted** (`sanitizeRelPath(pkg.main)`): the new compile-check test → `not ok 1`
  (`# tests 1 / pass 0 / fail 1`). Restored → green.
- **T1a banner removed** (body led with `# name`): the two new scaffold tests →
  `# tests 2 / pass 0 / fail 2`. Restored → green.
- **T1b guard dropped** (`ok`/`detail` removed from `p6-verified`): `dod.test.ts` →
  `# tests 3 / pass 2 / fail 1` (the hollow-pass test). `gates.test.ts` stayed green throughout
  (all its fixtures are `ok:true`). Restored → green.
- `git diff` after the restores shows only the intended hunks (banner + comment fixes in
  `scaffold.ts`; the `mainRaw` normalization in `compile-check.server.ts`; the `ok`/`detail` guard +
  comment in `dod.ts`).

## 7. STOP-and-REPORT / what I did NOT do

- **STOP:** the mint's evidence hash does not fold the declared-script state — `codegen.server.ts:4483
  treeRunTestedEvidence` (owned by 334-1). Reproduced (`probe-hash.mjs`): two outcomes identical
  except `declaredScriptsVerified` false-vs-true mint the **same** `lastTest.evidenceHash`
  (`2834449053`), and the stamp's `detail` ("tree-run green: compile 2/2 … entry ui-shell skip") does
  not mention the skipped declared scripts. An unverified declared toolchain can therefore ride a
  "tested" hash indistinguishable from a verified one. Suggested shape: fold
  `declaredScriptsVerified` + sorted `unverifiedDeclaredScripts` into `treeRunTestedEvidence`'s
  canonical summary (exactly as `treeVerdictHash` already does). **Not mine this wave.**
- **STOP:** the CLI `emit --run` / `tree-run` exit code on `declaredScriptsVerified:false` is
  334-4's surface (`scripts/rapidtool-cli.mjs` + `scripts/README-cli.md`); I did not touch it.
- **Reported, not fixed:** a red kind-entry leaves `outcome.error` unset (`compile-check.server.ts`
  `treeRun` — only compile errors, red declared scripts, a failed behavior contract and a bad UI-shell
  core set it). The red entry is still surfaced (`headless.treeRunFailureTail` names
  `entry <path>: <run>`, and `treeRunFailureFiles` lists it), so no silent failure; changing the
  top-level `error` would broaden CLI output for a pre-existing shape, so I left it named.
- **Reported, not fixed:** the `cli-tool` declared-entry residual (§4).
- Did **not** redefine `outcome.ok`, the CLI exit code, or `mintTreeRunTested`'s gate (T2 constraint).
- Did **not** touch `gates.test.ts`, `codegen.server.ts`, `headless.ts`, the CLI, or any unowned file.
- Did **not** run the full gate / `npm test` / `npm run eval`; targeted suites only; no keyed call; no
  secret printed; no probe file written inside the repo.

---
