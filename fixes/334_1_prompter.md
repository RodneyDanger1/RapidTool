# W48 / 334-1 — "Prompter" — synthesis correctness, pass 3

**Actor:** Prompter (code-synthesis correctness). **Owned files (STRICT):**
`src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts`; this log.
**HEAD at open:** `0d5b250`, tree clean (siblings edit concurrently). **Runtime:** Node 22.23.2 pinned
(`%LOCALAPPDATA%\hermes\node\node.exe`) **and** host Node v24.15.0; every `node --test` parse used
`--test-reporter=tap`. **Scratch:** `%TEMP%\rt334_1\` (outside the repo). No keyed call, no full gate,
no `npm run eval`, no secret printed, no repo probe file.

---

## §0 Step 0 — reconciliation (claimed / on disk / still open)

### Claimed (from `fixes/332_1_prompter.md` + its appended 333-1 follow-up)
- **P1 async guard:** `declaredAsyncFunctionNames`, `asyncExportNames`, `asyncNamesInScope`,
  `unawaitedAsyncValueUses` (four value-position forms: `property-read`, `computed-read`,
  `destructure`, `bound-then-read` + `floating-in-then`); `ChunkPriorFile.asyncExports`; refusal
  `RT_E_VALIDATION` wired into `validateSynthesisModule` and both synthesis paths; the one bounded
  await re-prompt (`p6SynthesisAsyncAwaitRepairPrompt`); prompt advertising (system prompt rule 9 +
  chunk-prompt async mark).
- **F-1 follow-up:** `memberAccessAfter` accepts `.name` / `?.name` / `["name"]` / `?.["name"]`; the
  `computed-read` form; async discovery extended to `const N = async (…) =>`, `= async function`,
  `exports.N = async …`, and `async N(` methods.
- **F-2 follow-up:** deleted `treePlanCensusReconciles` (export), its import, the three census
  assertions, the "does not reconcile" `p6.tree.shortfall` row, and the stray assertion; the
  partition documented as holding by construction.
- **Tests:** 161 → 163.

### On disk (bytes read today)
- `memberAccessAfter` `codegen.server.ts:2465`; `constStringLiterals` `:2515`; `asyncMethodBodyRanges`
  `:2532`; `unawaitedAsyncValueUses` `:2582`; `declaredAsyncFunctionNames` `:2372`; `asyncExportNames`
  `:2407`; `asyncNamesInScope` `:2410`; `ChunkPriorFile.asyncExports` `:1493`.
- Refusal `codegen.server.ts:3117`/`:3124`; repair prompt `:1311`; system rule 9 `:584`; chunk mark
  `:1601`/`:1629`; wire sites `:3913`, `:4338`.
- `treeChunkPlanCensus` `codegen.server.ts:2003`; **single** `p6.tree.shortfall` push at `:4175`
  (the unbound-declared-job path). `treePlanCensusReconciles` is **absent** from `src/**` (grep: only
  docs/audit references remain).
- Tests were **163** at open (`# tests 163 · # pass 163 · # fail 0`), matching the record.

**Claim-vs-bytes divergence (reported, not fixable — append-only log):** §1/§2 of the 332 body still
describe `treePlanCensusReconciles` + the "does not reconcile" row as landed; the appended F-2
*deleted* them. On disk the deletion wins; the earlier prose is superseded, not a live production
claim. No other divergence: every claimed symbol/refusal/prompt is present.

### Still open (with `file:line`)
1. **Named receiver `store.m()`** on an async-declared member — outside the guard; cannot be tied to
   the declaration without type resolution. Code documents it at `codegen.server.ts:2573-2576`.
2. **A Promise-returning callable not spelled `async`** (`function f(){ return new Promise(…) }`, a
   re-export) — undiscoverable lexically. `declaredAsyncFunctionNames` `codegen.server.ts:2372`.
3. **Dynamic computed key `fn(id)[k]`** — kept *conservative* (refused as `computed-read`): resolvable
   consts are now handled, but an unresolvable key still over-refuses the exotic `[someVar]==="then"`.
   `memberAccessAfter` `codegen.server.ts:2465`/`:2481-2485`.
4. `this.m()` receiver — **was** open on disk (gap); **closed this pass** (see §2).

---

## §1 P1a — a statically-resolvable computed key no longer over-refuses a legal chain

**Finding (over-refusal, worse than the gap):** `constStringLiterals` did not exist, so
`getProperty(id)[THEN]` with `const THEN = "then"` was classified `computed-read` with `name:null` and
**refused** — a legal Promise chain refused as a synthesis failure.

**Before (real output, `%TEMP%\rt334_1\probe-p1.ts`, pre-fix HEAD source):**
```
const THEN = "then"; getProperty(id)[THEN](... ) (LEGAL) :: uses=[{"name":"getProperty","line":2,"form":"computed-read"}] ok=false form=computed-read
```

**Fix:** `constStringLiterals(src)` (`codegen.server.ts:2515`) collects top-level `const NAME = "literal"`
values (raw line for the value + masked line must still be the declaration head, so a comment never
binds); `memberAccessAfter` (`:2465`) resolves an identifier key `[K]` through it. A resolved
`then`/`catch`/`finally` is a legal consumer; any other resolved value is still a `computed-read`;
an unresolvable key stays `name:null` (conservative).

**After (same probe, working tree):**
```
const OK = "ok"; getProperty(id)[OK]            :: uses=[{"name":"getProperty","line":2,"form":"computed-read"}] ok=false
const THEN = "then"; getProperty(id)[THEN](...) :: uses=[] ok=true
dynamic key getProperty(id)[k]                  :: uses=[{"name":"getProperty","line":1,"form":"computed-read"}] ok=false
literal ["then"] legal control                  :: uses=[] ok=true
```

## §2 P1b — a `this.m()` receiver call on an async-declared member is now refused

**Finding (gap):** the guard keyed only on bare-name calls, so `this.getProperty(id).ok` inside the
class that declares `async getProperty` sailed through — the exact defect through a receiver.

**Before (real output, `probe-p1b.ts`, pre-fix HEAD source):**
```
this.getProperty(id).ok — class declares async getProperty :: names=["getProperty"] uses=[] ok=true
```

**Fix:** `asyncMethodBodyRanges(masked)` (`codegen.server.ts:2532`) finds each `async NAME(…) { … }`
method and its enclosing class/object-literal body brace range; a `this.NAME(…)` call **inside that
range** becomes a call site. Tying the receiver to the declaring body is what keeps a same-named
member on a *different* receiver from being over-refused. The call-site loop was refactored to a
shared `AsyncCallSite` list so `this.m()` gets the identical property-read / computed-read /
bound-then-read / destructure classification.

**After (same probe):**
```
this.getProperty(id).ok — async class method   :: uses=[{"name":"getProperty","line":3,"form":"property-read"}] ok=false
this.getProperty(id).then(cb) — LEGAL control  :: uses=[] ok=true
this.getProperty(id) awaited   — LEGAL control :: uses=[] ok=true
this.getProperty(id).ok — SYNC class method    :: uses=[] ok=true
store.getProperty(id).ok — named receiver      :: uses=[] ok=true   (documented limit)
```

## §3 P2 — the F-2 deletion left no debris and the surviving row still fires

- **No debris:** `grep treePlanCensusReconciles` over the repo → docs/audit only, **zero** in
  `src/**`; `npx tsc --noEmit` has zero diagnostics in my files (so no dangling import). Only one
  `p6.tree.shortfall` push survives (`codegen.server.ts:4175`, the `census.unbound.length > 0` path).
- **The live row fires (proven with a test):** new test `334-1 P2` (`codegen.server.test.ts:4252`)
  runs the real chunked driver on `p6Base(LEDGER_BRIEF)` and asserts exactly one
  `p6.tree.shortfall` row, its full partition (`declared 4, planned 1, unbound 3`), that it names an
  unbound declared job (`track`), and that **no** row matches `/does not reconcile/i` — the removed
  branch's debris is behaviourally absent. It passes on HEAD (the deletion is already in HEAD) and on
  the working tree, i.e. the surviving live branch is intact. Existing tests `codegen.server.test.ts:1527`
  and `:4131` corroborate (one row; partition counts).

## §4 P3 — sweep

- **R12-f01 byte budget was untested.** The 331-4 test pinned only the 12-file cap; the second cut
  (per-chunk char budget) had no test. Probed (`probe-budget.ts`): 12 huge files (under the file cap)
  → 3 rendered, 9 elided with the visible `…[PRIOR-ELIDED: 9 file(s) beyond the 60,000-char prompt
  budget …]` marker; a small block renders all with no marker. **No bug found**; added a test pinning
  it (`codegen.server.test.ts:1089`).
- **Plan bounds / slice-before-signature:** `chunkTypeSignatures` guards `perChunk ≤ 0`; the plan and
  the census call it with the same default (`P6_SYNTH_CHUNK_SIZE`), so no divergence; `pathSlugFromNames`
  bounds the slug at 4 parts (a path label, not a signature); every `fnv1a` input is whole
  (`finalModule`, `brief`, `entry`, `ev.summary`), so no hash is computed over a pre-truncated list.
  No `knowledge.ts`-style slice-before-signature in this file.
- **Comment claims:** updated the `memberAccessAfter` and `unawaitedAsyncValueUses` docblocks to state
  exactly what the bytes do (const-key resolution; `this`-receiver body tie; named receiver + dynamic
  key + non-`async` Promise stay out). Verified the `asyncMethodBodyRanges` claim ("a same-named method
  on another receiver is not matched") with the two-class legal control below.
- No other fresh bug found in the touched paths.

## §5 Tests added + real results (both runtimes)

**Pre-fix proof (byte-faithful HEAD worktree at `%TEMP%\rt334_1\wt`, `--test-name-pattern="334-1"`):**
```
not ok 1 - W46/332-1 (P1) un-awaited async imports      (2 subtests failed)
   error: expected: true  actual: false   # legal `[THEN]` chain over-refused (P1a)
   error: expected: false actual: true    # this.getProperty(id).ok accepted (P1b)
ok 2 - W46/332-1 (P2) plan-coverage determinism
# tests 3 · # pass 1 · # fail 2
```
(The P2 test passes pre-fix because the F-2 deletion is already in HEAD — that is the point: the
*removed* branch is gone and the *live* one still fires.)

> Method note: my first scratch copy restored HEAD's file through PowerShell `git show | Out-File`,
> which mangled the file's curly quotes (UTF-8-through-code-page) and made `declared` empty. I redid
> the proof with `git worktree add --detach HEAD` (byte-faithful) and removed it afterwards
> (`git worktree remove --force`, junction `rmdir` first) — `git worktree list` shows only the main tree.

**Working tree, `src/lib/codegen.server.test.ts`: 163 → 167 (+4).**
```
Node 22.23.2 : # tests 167 · # pass 167 · # fail 0 · # skipped 0
Node 24.15.0 : # tests 167 · # pass 167 · # fail 0 · # skipped 0
```
New tests: `334-1 P1` computed-key (`:3931`), `334-1 P1` `this.m()` receiver (`:3968`), `334-1 P2`
shortfall survives + no debris (`:4252`), `334-1 P3` byte budget (`:1089`). Legal controls pinned in
the P1 tests: `await`, `.then`, `["then"]`, a sync member, the two-class `save` collision, and a named
receiver (stays accepted — the documented limit).

**Regression:** `src/lib/gates.test.ts` **88/88** (Node 22). `npx eslint` on both owned files → exit 0.
`npx tsc --noEmit` → zero diagnostics in my two files.

## §6 What I did NOT do / stopped on

- **Did not accept a named receiver `store.m()`** (`codegen.server.ts:2573-2576`): tying it to the
  declaration needs type/assignment tracking; guessing by name would over-refuse the legal
  collision case. Kept named, with a legal-control test pinning that it stays accepted.
- **Did not resolve a dynamic computed key** `fn(id)[k]`: kept conservative (refused as
  `computed-read`) — an over-refusal in the exotic `[someVar]==="then"` case, documented, not hidden.
- **Did not re-run the full gate / `npm run eval` / any keyed call** (five siblings edit concurrently;
  product-owner decisions untouched).
- **Did not touch `dod.ts`, `scaffold.ts`, `headless.ts`, `algorithms.ts`, or any file I do not own.**
- No repo probe file added; all scratch under `%TEMP%\rt334_1\` (probes + the removed worktree).

---

# Follow-up (W48) — 334-1c: the minted tree-run evidence must fold the declared-script state

**Finding (flagged by 334-3, again by 334-4).** `treeRunTestedEvidence` did not fold the tree-run
verdict's declared-script state into its summary — the fnv1a input of the mint's `evidenceHash`. A
green tree whose declared `typecheck`/`build` **ran** and one whose toolchain **never ran** minted the
**same** hash (`2834449053`), so the P6 DoD's proof artifact could not tell the two apart — defeating
the `declaredScriptsVerified` / `unverifiedDeclaredScripts` / `unverifiedEntry` state 334-3 (compile-check
+ `treeVerdictHash`) and 334-4 (CLI exit 5) just made first-class. The audit's F-4 lesson one level
deeper.

**Ownership:** the fix is entirely inside `src/lib/codegen.server.ts` (`treeRunTestedEvidence`,
`:4581`). `compile-check.server.ts` is 334-3's — **read, not edited**.

## RED — reproduced myself (scratch `%TEMP%\rt334_1c\probe-hash.ts`)

Two `TreeRunOutcome`s differing ONLY in the declared-script fields (`ok:true`, one passing spec, 3
assertions, `run: ui-shell skip`); hash = `fnv1a(treeRunTestedEvidence(o).summary)`. Pre-fix output:
```
verified    summary: compile 2/2 file(s) · 1 spec file(s) pass · 3 assertion(s) · specs [tests/oracle.spec.ts] · entry ui-shell skip
unverified  summary: compile 2/2 file(s) · 1 spec file(s) pass · 3 assertion(s) · specs [tests/oracle.spec.ts] · entry ui-shell skip
entry-skip  summary: compile 2/2 file(s) · 1 spec file(s) pass · 3 assertion(s) · specs [tests/oracle.spec.ts] · entry ui-shell skip
verified    hash: 2834449053
unverified  hash: 2834449053
entry-skip  hash: 2834449053
verified === unverified ? true
```
(Independently reproduced; lane 334-3's number matches.)

## Fix — booleans + a sorted name list, no prose (the `treeVerdictHash` doctrine)

In `treeRunTestedEvidence` (`codegen.server.ts:4581`):
- `unverifiedScripts` = the `unverifiedDeclaredScripts` names, de-duped, non-empty, **sorted**.
- `declaredUnverified` = `o.declaredScriptsVerified === false || unverifiedScripts.length > 0`.
- `entrySkipped` = `o.unverifiedEntry !== undefined`.
- The summary gains `declared-scripts unverified [build, typecheck]` and/or `entry-skipped` tokens.

The token is emitted **only when the state deviates** from fully-declared-verified-with-entry-run, so a
default run (and a legacy fixture that omits the fields) keeps its prior bytes — no consumer pin moves.

## GREEN — same probe, post-fix (deterministic across runs)

```
unverified  summary: … · entry ui-shell skip · declared-scripts unverified [build, typecheck]
entry-skip  summary: … · entry ui-shell skip · entry-skipped
verified    hash: 2834449053
unverified  hash: 1625406386
entry-skip  hash: 2383827441
verified === unverified ? false
legacy(no declared-script fields) hash: 2834449053   (default keeps its prior bytes)
wild-step greenExecutedOutcome hash: 3655235467 (pin unchanged)
```
A reordered list `["build","typecheck"]` hashes identically (canonical order).

## Consumers / pins (verified, no cross-file edit required)

- **`wild-step.test.ts:988` pins the hash `"3655235467"`** for its `greenExecutedOutcome`, which omits
  the declared-script fields → the conditional token keeps that fixture byte-identical, so the pin
  still holds and **no update was needed** (and the file is not mine anyway). Reported explicitly per
  the brief.
- No other test pins a minted-hash value (`grep` for a numeric `evidenceHash` pin → only that one).
- `dod.test.ts` (334-3's) stays green: it asserts the `lastTest` stamp still carries **no**
  `declaredScriptsVerified` own-property, and that `p6Ids(verified) === p6Ids(unverified)` — my change
  touches only `detail`/`evidenceHash`, never `label`/`ok`, so both hold.
- Real-seam check: `mintTreeRunTested(base(), verified)` and `…(…, unverified)` now write **different**
  `lastTest.evidenceHash` values (asserted in the new test).

## Tests + results (both runtimes)

`src/lib/codegen.server.test.ts` **167 → 170** (+3, new describe `W48/334-1c`):
```
Node 22.23.2 : # tests 170 · # pass 170 · # fail 0 · # skipped 0
Node 24.15.0 : # tests 170 · # pass 170 · # fail 0 · # skipped 0
```
New tests: verified ≠ unverified hash + canonical list order; entry-skip decisive + default/legacy
byte-identity (`2834449053` reproduced, not cited) + determinism; the real `mintTreeRunTested` seam
writes distinct hashes.

Consumer suites (Node 22): `gates.test.ts` **88/88** · `emitted-honesty.test.ts` **5/5** ·
`verify.server.test.ts` **42/42** · `dod.test.ts` **3/3** · `wild-step.test.ts` **35/35**.
`npx eslint` on both owned files → exit 0; `npx tsc --noEmit` → zero diagnostics in my files. No full
gate, no keyed call, no secret, no repo probe file (scratch `%TEMP%\rt334_1c\`).
