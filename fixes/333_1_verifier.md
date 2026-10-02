# 333-1 — WATCHDOG "Verifier" — adversarial audit of the 331 + 332 waves

**Independent verifier log (append-only).** Audited HEAD `6575669` (331: `4810e1b`/`6cd5123`;
332: `3ecd48e`/`6575669`). Read-only on production/test code; every plant this log records was
reverted and the file proven byte-identical to its git blob afterwards. No commits. Scratch work
in `%TEMP%\rt333_verify\`. Host Node **v24.15.0**; pinned Node 22.23.2 used for the counts.

> NOTE (concurrency): another writer (the 333-2 registrar) became active mid-audit — `git status`
> gained ` ?? fixes/333_2_registrar.md` plus ` M` docs after my start (which showed only
> `?? wave_plans/W47/`). I never edited those files.

---

## Boundary-gate verdicts (measured today)

| Claim | Verdict | Evidence |
|---|---|---|
| typecheck 0 (both legs) | **CONFIRMED** | `npm run typecheck` exit 0 (37.5 s); gate.sh `gates.typecheck {ok:true, exit:0}` |
| lint 0 warnings | **CONFIRMED** | `eslint .` exit 0 silent; `npx eslint . -f json` → **503 files, 0 errors, 0 warnings** |
| 398 scripts + 2734 lib, 0 fail, 2 skipped | **CONFIRMED** (gate of record) | isolated `gate.sh`: `testsScripts {pass:398,fail:0,skipped:0}` · `testsLib {pass:2734,fail:0,skipped:2}` |
| build 0 | **CONFIRMED** | `npm run build` exit 0 (28.9 s); gate.sh `gates.build {ok:true,exit:0}` |
| `gate.sh` `ok:true` | **CONFIRMED in isolation / REFUTED as load-independent** | see F-3 |

**Count caveat (not a defect).** A plain `npm test` from PowerShell reports lib
**2736 tests / 2726 pass / 10 skipped** (and Node 22 the same). The 8-test gap is the
`{ skip: !bashAvailable() }` suites: where `bash` is absent (PowerShell/WSL stub) they skip and the
TAP summary reads `# skipped 10`; where `bash` works (gate.sh via git-bash) they RUN, giving
`skipped 2` and `pass 2734`. The boundary figure "2 skipped" is therefore runtime-environment
dependent, not wrong.

**Isolated gate.sh verdict (exact JSON):**
```
{"ok":true,"double":false,"flakes":[],"hardFails":[],"skips":2,"wallMs":234909,
 "gates":{"typecheck":{"ok":true,"exit":0,"ms":28907},"lint":{"ok":true,"exit":0,"ms":22827,"problems":null},
 "assertionGaps":{"ok":true,"exit":0,"ms":861},"build":{"ok":true,"exit":0,"ms":12168},
 "testsScripts":{"ok":true,"exit":0,"ms":82366,"pass":398,"fail":0,"skipped":0},
 "testsLib":{"ok":true,"exit":0,"ms":87018,"pass":2734,"fail":0,"skipped":2}}}
```

---

## Triage (most severe first)

### F-1 · P2 · The async-await refusal is bypassable (headline "deterministic" claim is partial)
`src/lib/codegen.server.ts:2482` (property-read regex `^\s*\.` only), `:2368-2374`
(`declaredAsyncFunctionNames` only matches `async function NAME(`).

`validateSynthesisModule` — the deterministic guard the 332 headline rests on — returns `ok:true`
for several shapes that reproduce the **exact** defect it targets (a property read off an
un-awaited Promise; the rejection floats past the caller). Reproduced with a scratch harness against
the exported functions (`%TEMP%\rt333_verify\probe_async.mjs`, `probe_async2.mjs`):

```
optional-chaining property read : unawaitedAsyncValueUses -> []   validateSynthesisModule -> {"ok":true,...}
computed member read ["ok"]     : unawaitedAsyncValueUses -> []   validateSynthesisModule -> {"ok":true,...}
const getProperty = async (id)=>: asyncNamesInScope -> []  uses -> []
async function-expression const : asyncNamesInScope -> []  uses -> []
class async method              : asyncNamesInScope -> []  uses -> []
```
Baseline control (must refuse): `getProperty(id).ok` → `[{form:"property-read"}]` (refused); legal
shapes `await getProperty(id).ok`, `const { ok } = await …`, `.then/.catch` → accepted (correct).

Why it matters: `getProperty(id)?.ok` / `getProperty(id)["ok"]` read `undefined` off the Promise and
float the rejection exactly as `getProperty(id).ok` did; `const getProperty = async (…) =>` is a
very plausible model emission and the name is never even added to `asyncNamesInScope` (so the same
`const p = getProperty(id); return p.ok;` bound-then-read shape escapes entirely). The lane recorded
only the different lexical limit ("a sibling returning a Promise without `async`"), not these.
Smallest honest fix: extend the property-read rule to accept an optional `?.` and a computed
`[ … ]` access on the call tail, and extend async-name discovery to `const NAME = async (…) =>`,
`const NAME = async function`, and `async NAME(` methods.

### F-2 · P3 · A census "reconcile violation" branch that can never run; its tests cannot fail
`src/lib/codegen.server.ts:2023-2024` (`planned`/`unbound` are complementary `.filter`s of
`declared`) and `:4031` (`if (!reconcile.ok)`); tests `codegen.server.test.ts:4009,4022,4041`.

`treePlanCensusReconciles` sets `silent.push(label)` when `planned.has(label) === unbound.has(label)`.
Because `treeChunkPlanCensus` derives `planned = declared.filter(plannedLabels.has)` and
`unbound = declared.filter(!plannedLabels.has)`, that equality is **always false** ⇒ `silent` is always
`[]` ⇒ the persisted `p6.tree.shortfall` "does not reconcile" row at :4031 is unreachable and
`reconcile.ok` is always true. The three tests assert `deepEqual(treePlanCensusReconciles(census),
{ok:true,silent:[]})` over the derivation's own output, so no production change short of a
divergent re-derivation can fail them. (The docblock openly says "Empty by construction today".)
Smallest honest fix: add a synthetic `{declared:["x"],planned:["x"],unbound:["x"]}` unit test that
mints `ok:false` (proving the predicate is falsifiable), or drop the unreachable row.

### F-3 · P3 · `gate.sh` "ok:true" is load-sensitive (a concurrent suite flipped it red)
`src/lib/exec.test.ts:138` / grace loop `:163`.

First gate.sh run (launched while a second full lib leg ran under pinned Node 22) returned
`ok:false`, exit 1:
```
{"ok":false,...,"hardFails":["leaves no rapidtool-run-* scratch dir behind after a real run",
 "scratch-dir cleanup (node-runner)"],...,"testsLib":{"ok":false,"exit":1,"pass":2733,"fail":1,"skipped":2}}
```
The identical gate.sh run **alone** returned `ok:true` (JSON above). The test scans `%TEMP%` for
`rapidtool-run-*` leftovers and polls up to 45 s; a second full suite's tree-run children held those
dirs past 45 s. Not a defect in the audited code, but the "no flakes" claim is only true on an
unloaded host — worth a larger grace or a per-run marker rather than a tmpdir diff.

### F-4 · P3 · `verified:true` on a tree whose entry is a deliberate skip
`src/lib/compile-check.server.ts:1680`.

My own clean game tree (index.html + generated job) → `ok:true`,
`run:{kind:"ui-shell",run:"skip"}`, `core:{entry:"src/jobs/level.ts",run:"pass"}`, and
`verified:true`. `verified` means "no *declared project script* was left unrun", not "the tree was
verified" — the UI-shell entry was intentionally not executed. The type doc is careful and the owed
list notes no consumer reads it yet, but a future consumer naming it `verified` risks an over-read.
Smallest honest fix: either add the skipped entry to `unverified` (so `verified` stays a strong
claim) or rename to `declaredScriptsVerified` at every serialization.

### F-5 · P3 · `doctor`'s `llm.configured` still reports key *presence*, not validity
`src/lib/headless.ts` `doctorStatus` (no `lastKeyed` in its output).

The 332-5 rejected-key fix landed only in the **console chip**. `doctor --project <p> --tree <t>`
prints `llm:{configured:true,…}` with no validity field; the last-keyed failure class is exposed
only via `llmStatus` (the chip path), which `doctor` never calls. An operator scripting `doctor`
still cannot see that the last keyed call was refused. Smallest honest fix: surface the same
`lastKeyed` outcome in `doctorStatus`.

### F-6 · P3 (context, out of audited scope) · 192 tracked files under `.t4scratch/` duplicate `src/lib/**`
`.t4scratch/` is tracked at HEAD (`git ls-tree -r HEAD` → 192 files; `src/lib/exec.test.ts` etc.).
Pre-existing (not added by the four audited commits; absent from all their `--stat`). It cannot
affect the gate globs (`src/lib/**`, `scripts/**`), but it is a tracked scratch copy of the tree and
belongs out of the repo.

---

## Adversarial re-derivation of the four headline checks

1. **Un-awaited-async refusal** — REFUTED in part (F-1): the recorded rehab shape and the four
   documented value-position forms are refused, but `?.`, computed-member, and async-arrow/function-
   expression declarations bypass the refusal. Legal `await` and `.then/.catch/.finally` accepted
   (confirmed).
2. **Persisted run spend** — CONFIRMED. `doctor --project <scratch>.json --tree <tree>` on a fresh
   synthetic project reported
   `spend: 77654 tokens measured (prompt 60000 + completion 17654 · 12 call(s))` read from the file,
   not the process session. Cap isolation: code at `headless.ts:1684` keeps `cap`/`stop_reason` from
   the session budget; the test at `headless.test.ts` pins persisted `150` vs cap `100` →
   `stop_reason:null` until the session actually crosses. No keyed call made.
3. **Game-kind entry resolution** — CONFIRMED. Clean game tree → green with `core` = the generated
   job file (never `src/main.ts`). My own corrupted cores still red:
   a top-level `throw` in the core → `ok:false, core.run:"fail"`; a barrel re-exporting a missing
   module → `ok:false, core.run:"fail"` (`ERR_MODULE_NOT_FOUND`). No blanket skip.
4. **`scripts/**` ratchet** — CONFIRMED with teeth. Appended `/** @type {number} */ const
   __rt333plant = 'not-a-number';` to `scripts/rapidtool-cli.mjs` → `node --test
   scripts/typecheck-scripts.test.mjs` **fails 2/6**, naming `scripts/rapidtool-cli.mjs(4854,7):
   error TS2322` and reporting it unbudgeted. Reverted via `git checkout --`; proved restored by
   `git hash-object --path=scripts/rapidtool-cli.mjs` == `HEAD:scripts/rapidtool-cli.mjs` ==
   `529d677d…`, `git status --porcelain` empty, marker string absent; re-ran → **6/6 pass**.

---

## Mock / fake / placeholder census over the touched files

Method: `git diff -U0 03a6d0b 6575669 -- src scripts | Select-String '^\+'` filtered for
`TODO|FIXME|XXX|HACK|@ts-ignore|@ts-expect-error|@ts-nocheck|as any|: any|as unknown as|catch {}`.

- **New placeholders/escape hatches: 0.** The only matches are (a) a `RT_E_LLM_KEY_SHADOWED`
  remedy line, (b) a deliberate, documented `@param {… runner?: (target: any) => any …}` JSDoc
  typedef in `scripts/run-eval.mjs` (loaded under `checkJs`), (c) the product-canonical
  `TODO(E-15) stub` fixture string in `cli-exit-taxonomy.test.mjs`. All `TODO(E-15)`/`TODO(R3-f06)`
  occurrences are the **emitted product's own honest stub contract**, not RapidTool placeholders.
- **New empty catches: 0.** Every added `catch` is a documented honest floor (`appendUsageRecord`
  best-effort telemetry, `persistedSpendAt` corrupt-record → null, `emitShadowWarning` stderr
  unusable). `scripts/check-assertion-gaps.mjs` over 123 test files → 0 findings.
- **New `as unknown as` double-casts: 0 production.** Added occurrences are 2 test fixtures
  (`headless.test.ts`, `key-resolution.test.ts`) plus 2 `knowledge.ts` lines that only add a
  parameter to a pre-existing `undefined as unknown as Project` call shape.
- **Fabricated/hardcoded returns: 0 found.** `verified`, `spend`, `resolveDoctorSpendSource`,
  `treeVerdictHash` all compute from real inputs (independently reproduced).
- **Dead / unreachable:** F-2 (unreachable reconcile row). `driftLesson` has no production caller —
  openly documented in the code and register as owed, not disguised.

---

## What I could not falsify (confirmed surface)

- Persisted run spend read-back and its isolation from the cap (independently reproduced).
- Game-kind entry: broken cores still red; clean game tree green with the generated core (not the
  browser boot).
- The scripts ratchet fails on a real new type error and passes after revert (plant + revert proven).
- The emitted tree-job oracle probe is awaited and its enclosing test callback is `async () =>`
  (`scaffold.ts:2065` emits `test(..., async () => {`; probe awaited at `:2160-2161`).
- Key resolution shadow signal is real and tail-only: stderr line
  `[RT_E_LLM_KEY_SHADOWED] DEEPSEEK_API_KEY conflict: the .env key (<repo>\.env, tail …19b3) WINS
  over the process-environment key (tail …42ff)` — no full key emitted.
- Module-coverage allowlist removal: `node scripts/check-module-coverage.mjs` exit 0,
  **19 allowlisted · 0 unallowlisted**; `fixtures.review.ts` / `fixtures.server.ts` are no longer
  listed (reached by the new `fixtures.review.test.ts`).
- `mintTreeRunTested` refuses a non-green or no-spec tree-run (code read at `codegen.server.ts:4484`).

## Could not reproduce (no keyed calls permitted)
- The 332 addendum's **keyed P6 PASS** / `lastTest.label:"tested"` / `emit --run ok:true` end-to-end
  (requires a paid key). Not reproduced; taken as reported.
- `npm run eval` not run (would rewrite tracked `research/eval-out/**`).

## Plants left behind: none
The only repo write is this log. The one temporary plant (`scripts/rapidtool-cli.mjs`) was reverted
and verified identical to `HEAD:scripts/rapidtool-cli.mjs` (`git hash-object` match, clean status).
