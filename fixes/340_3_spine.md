# 340-3 · Spine — hollow-`tested` absence, the ESM-barrel seam, and a sibling audit

**Lane:** 340-3 (persona: spine). **Opened** 2026-10-03 at HEAD `a097fa8`, tree clean.
**Owned (STRICT):** `src/lib/verify.ts`, `src/lib/verify.server.ts`, `src/lib/verify.test.ts`,
`src/lib/verify.server.test.ts` + this log. Nothing else touched.
**Runtimes:** host `node` v24.15.0; pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
**Scratch:** `%TEMP%\rt340_3\` (probes + a full-tree copy with a `node_modules` junction for the
pre-fix RED). Working tree never reverted; no `git checkout/stash/reset`. **Keyed LLM calls: 0.**

## 0. Reconciliation — claimed / on disk / closed

| # | Gap (from the 339 wave's own verifiers) | On disk at open | Disposition |
|---|---|---|---|
| 1 | `verify.ts` `applyVerifyOutcome` refuses a present-but-EMPTY `cases` array, but an ABSENT `cases` with non-empty evidence still mints `tested`; two 337-3 fixtures pin that shape | confirmed (`verify.ts:175-176`, fixtures `verify.test.ts:563/574`) | **CLOSED** — mint now requires a non-empty case set; fixtures carry a real case set |
| 2 | `headless.ts:4085` hands `project.generatedSource` (materialized ESM barrel) through `withCommonJsExports` into `runCases` → `new Function` → opaque compile error with a misleading cause | confirmed (probe below) | **CLOSED** — honest coded refusal naming ESM, before any keyed work |
| 3 | sibling class hunt in `verify.ts` + `verify.server.ts` | audited | 1 real sibling **closed** (`finalSource`), 2 stale comments **closed**, 4 items named-not-closed (below) |

Baseline at open (targeted, both runtimes): `verify.test.ts + verify.server.test.ts` **107 / 107 / 0**;
`codegen.server.test.ts` **202 / 202 / 0**.

---

## 1. Gap 1 — the last hollow-`tested` path (absent `cases`) — RED → GREEN

`applyVerifyOutcome` minted `label:"tested"` from `status === "passed"` + non-empty evidence + a
*not-present-but-empty* case set. The 339-6 guard was `Array.isArray(outcome.cases) && length === 0`,
so `cases` missing entirely slipped through — the exact shape the 337-3 hash test pinned. A `tested`
label is read as machine proof by `maker-score.ts` M4 / `judgment.ts` (label + hash, not detail), so
this was a genuine false-attestation path.

**Fix (patch-only):** the passed mint now requires a **non-empty** case set (absent OR empty is
refused) plus, as the sibling below, a non-empty `finalSource`.

**Fixtures (honest, intent preserved):** the two 337-3 outcomes (`verify.test.ts:563/574`) now carry
the SAME `cases: [{ id: "case-1", expression: "add(2,3) === 5" }]` and a non-empty `finalSource`, so
the ONLY inputs that still differ are source and evidence — the pin keeps its teeth (a restored
missing-separator bug would again collapse `("abc","DEF")` and `("abcD","EF")` to one hash). No test
deleted, no assertion weakened.

**RED** (pre-fix bytes in `%TEMP%\rt340_3\repo`, pattern `339-6`, both runtimes):
```
    not ok 1 - an ABSENT `cases` field mints no tested label (340-3: the last hollow-pass path)
    not ok 2 - a pass with no verified final source mints no tested label (340-3 sibling)
# tests 7 / # pass 5 / # fail 2
```
(The scratch pre-fix copy is HEAD behaviour plus an inert `ESM_MODULE_UNSUPPORTED_REASON` export line,
added only so the new test files — which import that symbol — could load. Neither guard, nor the
helper, nor the `verifyAndFixServer` pre-check exists in that copy.)

**GREEN** (fixed tree): owned suite **115 / 115 / 0**, and the `339-6|340-3` slice **12 / 12 / 0**, both runtimes.

## 2. Gap 3 (sibling) — a pass with no verified `finalSource` — RED → GREEN

Same class, found in the audit: a `passed` envelope with a non-empty evidence string, a non-empty case
set, and `finalSource` ABSENT (or whitespace-only) still stamped `tested` — while `generatedSource`
was left at its prior value, i.e. the label asserted a machine verification of bytes that were never
run. `verify.server.ts`'s real pass always sets `finalSource`, and convergence is impossible without
it, so the honest mint requires it. RED/GREEN in the block above; the fixture/consumer tests all
already carried `finalSource` (`headless.test.ts:1858`, `lesson-writers.test.ts:139`,
`verify.server.test.ts` base), so nothing else moved.

## 3. Gap 2 — the ESM-barrel seam — DECISION: honest coded refusal (not a transform)

**Reproduction on the current bytes** (`%TEMP%\rt340_3\probe_esm.mjs`):
```
barrel via withCommonJsExports unchanged: true
barrel new Function: SyntaxError: Unexpected token 'export'
RUN barrel:     pass=false compileError="source failed to compile in the harness"
RUN simpleEsm:  pass=false compileError="source failed to compile in the harness"
```
The cause named was wrong: the module is not a broken CJS module — it is a valid ES module the
CommonJS harness cannot execute.

**Why refusal, not ESM→CJS lowering — the bytes support only refusal.** The bytes `headless.ts:4085`
feeds are `project.generatedSource`, which for a tree project is
`materializeImportableTree(...).entrySource` (`codegen.server.ts:4337/4739`), and that entry is a
barrel: `export * from "./generated/chunk-0.ts";` (`codegen.server.ts:3016-3019`). The re-export
TARGETS are not part of the string — they live on `project.generatedTree` — so no in-process rewrite
of `generatedSource` alone could bind them; it would have to invent the sibling modules it cannot see.
A general static `import`/`export` lowering (live bindings, `export *`, default/namespace semantics)
is likewise not achieveable correctly with a bounded text transform. The honest option is therefore a
coded refusal naming the real cause.

**Fix (patch-only, all in owned files):**
- `verify.server.ts:801` `ESM_MODULE_UNSUPPORTED_REASON` — the coded reason (carries `RT_E_RUNNER_FAILED`).
- `verify.server.ts:812` `ESM_STATEMENT_RE` — statement-boundary-anchored ESM-token scan (over
  string/comment-stripped code), so regex content, object-literal keys and `exports.x =` / dynamic
  `import(...)` are NOT false positives.
- `verify.server.ts:824` `esmModuleUnsupportedReason(source)` — gates on the harness's OWN compiler:
  the exact bytes `buildHarness` would embed (post-`stripTypeAnnotationsForHarness`) are parsed with
  `new Function` first; only a non-compilable source that additionally carries statement-level ESM
  syntax is refused.
- `verify.server.ts:892` `runCases` — refuses up front with the coded reason (so direct callers,
  including `headless.verifyGeneratedSource`, get the honest cause).
- `verify.server.ts:1689` `verifyAndFixServer` — refuses **before** `generateCases`, so a module the
  harness cannot run never spends a keyed call or a fix loop; returns `status:"error"`,
  `iterations:0`, coded evidence, and the visible unanchored `lessonRefused` via `gatedFailedMint`.

**Decision recorded:** the harness CAN compile bytes are run verbatim; typed TS CJS modules still
strip and pass; only `import`/`export` statements are refused. `withCommonJsExports` is unchanged
(it returns the barrel unchanged today, and the refusal now happens at the authoritative seam).

**RED** (pre-fix, patterns `340-3|339-6`, both runtimes) — 5 subtests:
```
    not ok 1 - returns status error with the coded ESM reason and touches no model wire
    not ok 1 - refuses an ESM tree barrel with the coded ESM reason, not a compile marker
    not ok 2 - refuses a plain ESM module (`export const`) the same way
# tests 12 / # pass 7 / # fail 5   (Node 22; identical name set on Node 24)
```
**GREEN** (fixed tree): the `340-3` controls prove no over-refusal — CJS + typed TS CJS still pass;
regex/string/object-key/dynamic-import sources are not flagged — and the `verifyAndFixServer` ESM test
asserts `called === 0` (zero model wire). Owned suite **115 / 115 / 0** and `339-6|340-3` **12 / 12 / 0**
on both runtimes.

**Reachability note:** the codegen single-module path passes a CJS module; the ESM entry reaches this
seam only through the manual Oracle/CLI path (`headless.verifyGeneratedSource`, `rapidtool-cli.mjs:3151`).
The CLI already treats a non-`passed` outcome honestly (`ok:false`, `applyVerifyOutcome` appends
`verify.fail`, no `tested` mint).

## 4. Sibling-hunt table (class / reachable / disposition)

| # | Finding (`file:line`) | Class | Reachable? | Disposition |
|---|---|---|---|---|
| 1 | `verify.ts:176-177` passed mint accepted ABSENT `cases` | declared field a check never evaluates | yes (store/CLI/headless) | **closed** (§1) |
| 2 | `verify.ts:177` passed mint accepted absent/blank `finalSource` | same class | yes (foreign envelope) | **closed** (§2) |
| 3 | `verify.server.ts:687-692` RESIDUAL doc claimed `runCases` reports the generic compile marker for `import`/`export` | comment claims behaviour the bytes no longer implement | n/a (doc) | **closed** (doc updated in place) |
| 4 | `verify.ts:170-173` doc claimed "An ABSENT `cases` field stays accepted" | same | n/a (doc) | **closed** (doc updated) |
| 5 | `verify.server.ts:979` `oracleSignatureFunctionNames` — exported, **zero call sites repo-wide** | declared helper never evaluated | no (dead export) | **named, not closed** — removing a public export is a cross-module contract change; no false-pass path |
| 6 | `verify.server.ts` `VerifyOutcome.lint` — produced/typed, never read by `applyVerifyOutcome` (not in `VerifyOutcomeShape`) | declared field no consumer evaluates | n/a | **named, not closed** — the lint summary rides `evidence` (`lintSuffix`), so no information loss and no false pass |
| 7 | `verify.ts:122` `withCommonJsExports` binds only `/^function\s+NAME\s*\(/m` — misses `async function`, generators, `export function` | declared transform under-covers | yes | **named, not closed** — under-binding degrades to an honest `NO_CALLABLE_EXPORTS` refusal, never a false pass |
| 8 | `runCases` `results.every(r => r.pass)` / `[...expected].every(...)` | `every()`-on-empty | no — `validated`/`expected` are non-empty (zero cases refused at `:834`; a rejection short-circuits at `:852`) | re-audited: not vacuous |
| 9 | `oracleBriefGrounded` returns `ok:true` for a vocabulary-free brief | `every()`-on-empty analogue | yes | documented boundary; `runCases`' export-reference gate still applies |
| 10 | always-zero counter | — | — | none found in either file |
| 11 | `applyVerifyOutcome` hash (`verify.ts:199`) claims `source \u0002 evidence \u0002 cases` | hash omits a claimed input | — | matches the claim; `iterations` is not a verdict input and is carried inside `evidence` |

**Net sibling closures: 2 code paths (`cases`, `finalSource`) + 2 stale doc comments.**

## 5. Regression count (both runtimes)

| suite | Node 24.15.0 | Node 22.23.2 |
|---|---|---|
| `verify.test.ts` + `verify.server.test.ts` (owned) | **115 / 115 / 0** | **115 / 115 / 0** |
| `codegen.server.test.ts` (read-only regression — depends on `verify.server.ts`) | **202 / 202 / 0** | **202 / 202 / 0** |

Baseline was 107 owned (now 115; +8: 4 ESM runCases, 2 ESM `verifyAndFixServer` incl. 1 control, 2
hollow-pass) and 202 codegen (unchanged). **No full gate; no `npm test`; no build.**

## 6. Mock / fake census (added lines of the four owned files)

`git diff -U0` added-line scan for `TODO|FIXME|as any|@ts-ignore|@ts-expect-error|@ts-nocheck|
catch {}|.only(|it.skip|.skip(|eslint-disable`: **0 hits**.
- The two `catch` blocks added (`esmModuleUnsupportedReason`) are **parse probes**, not silent
  swallowers: a `new Function` throw IS the signal under test, and the non-ESM case falls through to
  the generic harness marker. Documented in-line.
- Test doubles used are PRE-EXISTING real-transport seams: `mockChat` returns a real `Response`
  (`verify.server.test.ts:130`) and `withFakeKey()` injects a fake env key; both were already in the
  file. The new ESM tests use an inverted tripwire `fetch` that **throws** if called (proving zero
  model wire), never a fake verdict.
- Every new test can fail: RED captured above.

## 7. STOP-and-REPORT

None. Gap 2 was solvable entirely inside the owned files; **no `headless.ts` call-site change is
needed** (the refusal is emitted at `runCases` and before case generation in `verifyAndFixServer`).
No cross-file contract change was required.

## 8. What I did NOT do

- Did **not** run the full gate, `npm test`, `npm run build`, `npm run eval`, or `tsc` (sibling lanes
  `cassette`, `doctor`, `scaffold`, the llm providers and `mcp` are mid-edit on this tree).
- Did **not** make any keyed LLM call (0 budget used; all model seams stubbed/tripwired).
- Did **not** touch `headless.ts` or any consumer; read-only inspection only.
- Did **not** attempt an ESM→CJS transform (decision + bytes in §3).
- Did **not** delete or rename any tracked file; the only new file is this log.
- Did **not** close the named-not-closed items in the table (dead export, unread `lint` field,
  `withCommonJsExports` async/generator under-coverage) — each is reported with its class.
