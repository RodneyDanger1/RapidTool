# fixes/339_2_oracle-generation.md — lane 339-2 · ORACLE-GENERATION

**Lane:** 339-2 ("oracle-generation"). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`
(space in path — quoted everywhere; ripgrep-style tools fail on the space, terminal `Select-String` used).
**HEAD at open:** `c4348f4` (main, tree clean). **Runtime:** repo-pinned Node **22.23.2**
(`%LOCALAPPDATA%\hermes\node\node.exe`) + host Node **v24.15.0**; every parsed `node --test` run uses
`--test-reporter=tap`.
**Owned (STRICT):** `src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts`, this log.
**Read-only:** `src/lib/verify.server.ts` (lane 339-1), `src/lib/headless.ts`, `scaffold.ts`, `algorithms.ts`,
`algo-tools.ts`, `dod.ts`, every other lane's files.
**Rules obeyed:** patch-only (no rewrite/reformat of the 248 KB file); no tracked file deleted; no full gate;
targeted test file only; keyed calls bounded and held (below); no secret printed; scratch outside the repo
(`%TEMP%\rt339_2\`).

---

## 0. Step 0 — claimed / on disk / still open

**Claimed (the gap this lane owns, `fixes/338_0_parent.md` §4 + §5 items 1–4).** The 338 wave's keyed
unattended run reached P6 and hard-blocked: three synthesis cycles, each refused by the machine-verification
oracle harness, ending `p6.journey.exhausted` ("3 cycle(s) without a green tree-run"); the deterministic
floor stood (`generatedTree: 0`, no `tested` label). Two named defects are this lane's:

1. **Name-binding gap** — the oracle cases call identifiers the generated module does not define
   (cycle 2 logged `case-2: error ReferenceError: computeMean is not defined`).
2. **Clipped refusal reason** — `refuse()` wrote `detail: \`${code} · ${clean.slice(0, 160)}\``, so the
   sanitizer's own reason and the offending case id (which ride the END of the verify evidence) were cut
   out of the surfaced detail.

Plus: make the bounded repair loop load-bearing (cycle N+1 informed by cycle N), and request JSON mode on
machine-checked envelopes where missing.

**On disk at open (measured by read/grep):**

- `codegen.server.ts` — `refuse()` at `:3461` (pre-patch) slices the detail at **160** chars, head-only.
- `codegen.server.ts` — the single-module machine verify call passed the PLAN's signature names as the
  oracle contract: `verify(envelope.module, brief, { maxIterations: 3, signatureNames })` (pre-patch `:4191`).
  `signatureNames = signatureFunctionNames(specRecord.typeSignatures)` = the spec's signatures, NOT the
  module's measured export surface.
- `codegen.server.ts` — the PRIMARY synthesis prompt consumed `deps.synthesisRefusal` through
  `withSynthesisRefusalContext` with `P6_SYNTHESIS_REFUSAL_CONTEXT_MAX = 200`, and `deps.treeFailure` only
  through the bounded REPAIR re-prompts (`repairTreeFailureTail`); the primary prompt never saw the
  previous cycle's failure context.
- `codegen.server.ts` — the only two model-call sites (`synthesizeSingleModule` opts, `synthesizeChunkedModule`
  opts) already pass `json: true` (grep: exactly two `json: true` lines).
- `verify.server.ts` — the oracle generation (`generateCases`/`runCases`) is lane 339-1's file; it is the
  seam where "validate every called identifier against the inventory before the case set is committed"
  would have to live. **Not owned.**

**Still open at open:**

- No rule binds the oracle contract to the module's real export inventory.
- The refusal reason does not reach the operator (160-char head-only clip).
- The bounded loop is not load-bearing on a refusal/tree-run-red cycle.

---

## 1. What landed (surgical patches; exact sites)

| Site (post-patch) | Change |
|---|---|
| `codegen.server.ts:122` | `import { exportedNamesOf } from "./algo-tools.ts";` — reuse the repo's MEASURED export-inventory helper (no parallel parser; `algo-tools.ts` is client-safe and already pulls `verify.server.ts`, so no new runtime dep and no cycle). |
| `codegen.server.ts:1153` | `P6_SYNTHESIS_REFUSAL_CONTEXT_MAX` **200 → 1200** (documented): the reader cap was one tenth of the refusal budget, so the failing case + the harness reason (past char 200) never reached the next cycle's PRIMARY prompt. |
| `codegen.server.ts:1158-1179` | new `withTreeFailureContext(user, treeFailure)` + `P6_TREE_FAILURE_CONTEXT_MAX = 1200`: the PRIMARY-prompt reader for `deps.treeFailure` (the journey's recorded previous-cycle failure — the tree-run tail, or the refusal detail when the cycle produced no tree). Bounded, whitespace-collapsed; absent/blank ⇒ byte-identical legacy prompt. |
| `codegen.server.ts:3170` | new `oracleContractNames(module, claimedExports)` — the module's MEASURED top-level export surface via `exportedNamesOf` (fallback: the validated claimed exports). Deterministic, no LLM. |
| `codegen.server.ts:3534-3553` | `P6_REFUSAL_DETAIL_MAX = 1200` + `boundedRefusalDetail(detail, max)` — head + tail preserved with a visible middle-elision marker; never a silent head-only cut, result never exceeds `max`. |
| `codegen.server.ts:3564` | `refuse()` now writes `detail: \`${code} · ${boundedRefusalDetail(clean)}\`` — event name `p6.synthesis.refused` and the RT_E_* contract unchanged. |
| `codegen.server.ts:4070` | `synthesizeSingleModule` PRIMARY prompt: `withTreeFailureContext(withSynthesisRefusalContext(withGateRepairContext(…)))`. |
| `codegen.server.ts:4290-4294` | the single-module machine verify call now passes `signatureNames: oracleContractNames(envelope.module, envelope.exports)` — the oracle is grounded on the module's REAL exports. |
| `codegen.server.ts:4462` | `synthesizeChunkedTree` PRIMARY chunk prompt: same `withTreeFailureContext(…)` composition. |

**Honest scope of the name-binding fix (NOT overclaimed):** grounding the oracle CONTRACT on the measured
export inventory removes the plan-list/real-surface disagreement. It **cannot by itself** stop a model from
inventing a name from the brief's nouns (the `computeMean` class is invented from "mean"). The actual
enforcement — *validate every called identifier against the inventory BEFORE the case set is committed* —
lives in `verify.server.ts` (`generateCases`/`runCases`), which this lane does not own. **STOP-and-REPORTed**
with the exact shape in §6.1.

---

## 2. RED → GREEN (real output, both captured)

**RED (pre-fix bytes restored, load-compatible test edits, Node 22.23.2).** Backed the fixed files up to
`%TEMP%\rt339_2\`, `git checkout -- src/lib/codegen.server.ts`, and removed only the three new-symbol imports
+ the two pure-helper tests (so the file would load against pre-fix code); the integration tests are unchanged.
Failing (8 new + the updated cap pin):

```
not ok 3  - single-module: multi-line reason is whitespace-collapsed and the block is bounded to 1200 chars
not ok 15 - W52/339-2 oracleContractNames (…the REAL export surface) #1
             the machine oracle is contracted to the measured exports … : Expected values to be strictly deep-equal
not ok 16 - W52/339-2 the refusal detail reaches the operator AND the next cycle
  not ok 1 - a long verify evidence keeps the failing case id + the sanitizer's reason (not clipped at 160)
             error: 'the offending case id reached the record'
  not ok 2 - a long synthesisRefusal reaches the next cycle's PRIMARY prompt uncut (≤ the raised cap)
             error: 'the whole recorded reason (past char 200) reaches the primary prompt'
not ok 17 - W52/339-2 deps.treeFailure reaches the PRIMARY synthesis prompt (cycle N+1 is informed)
  not ok 1 - single-module: the block is appended once; absent/blank keeps the legacy bytes
             error: 'the failure block is appended once to the legacy prompt bytes'
  not ok 2 - chunked: every PRIMARY chunk prompt carries the block once
  not ok 3 - composition order: gateRepair, then refusal, then the failure context
```

(The two pure `boundedRefusalDetail` / `oracleContractNames` unit tests are new SYMBOLS — pre-fix the import
itself fails to resolve, which is why they were excluded from the load-compatible RED copy.)

**GREEN (after, both runtimes):**

```
# tests 196 / # suites 37 / # pass 196 / # fail 0   (Node 22.23.2)
# tests 196 / # suites 37 / # pass 196 / # fail 0   (Node 24.15.0)
```

Baseline was 186 (338-1's last count) → **+10 tests**. Re-run after lane 339-1 landed its
`verify.server.ts` changes (mtime 23:00): still 196/196 on both runtimes.

---

## 3. Tests added (all in `src/lib/codegen.server.test.ts`)

- `W52/339-2 boundedRefusalDetail` (2): short/garbage identity; a >max detail keeps head AND tail —
  the offending case id and the sanitizer's own reason survive, with a visible elision marker, `≤ max`.
- `W52/339-2 oracleContractNames` (3): MEASURED exports win over the claimed subset; fallback to claimed
  when the surface is unmeasurable; **integration** — the machine oracle receives
  `["addColumn","createBoard","dragCard","kanbanBoard"]` (the module's real exports) even though the plan's
  signatures name only `createBoard`/`addColumn`.
- `W52/339-2 the refusal detail reaches the operator AND the next cycle` (2): a long verify evidence keeps
  `case-9` + `template literals are not allowed` (not clipped at 160); a 900-char `synthesisRefusal` reaches
  the next primary prompt uncut.
- `W52/339-2 deps.treeFailure reaches the PRIMARY synthesis prompt` (3): single-module byte-exact block
  (absent/blank ⇒ legacy bytes); chunked — every primary chunk prompt carries the block once and the tree
  shape is unchanged; composition order `gateRepair → refusal → failure context`.
- Updated the pre-existing cap pin (`block is bounded to 200 chars` → `1200`) to the new documented bound.

---

## 4. Machine-checked envelopes — JSON mode audit (mission item 4)

`json: true` is the ONLY model-call option shape in `codegen.server.ts`; grep finds exactly two
`json: true` sites — the single-module synthesis opts and the chunked synthesis opts — and every bounded
repair re-prompt reuses the SAME `opts` object (so it inherits `json: true`). **There is no envelope call
in this file that omits JSON mode; nothing to change.** Confirmed the provider forwards it:
`deepseek.ts:478` / `openai-compatible.ts:473` — `...(opts.json ? { response_format: { type: "json_object" } } : {})`.
The spec envelope (`prompt-engine.ts:254 expandBrief`) and the oracle envelope
(`verify.server.ts` `generateCases` → `callModel("weak", prompt, { json: true })`) already pass it in their
own modules. No strict-schema/grammar claim is made anywhere — `json_object` is a mode hint, and the
deterministic validators (`validateSynthesisModule`, the oracle grounding/runCases gates) remain the real gate.

---

## 5. Mock / fake census (owned files)

Pattern scan over added lines only (`git diff -U0 … | Select-String "^\+"` for
`as any | @ts-ignore | @ts-expect-error | @ts-nocheck | catch { | TODO | FIXME | placeholder | mock | fake`):
**0 prohibited constructs.** The only matches were the pre-existing test helper name `fakeDeps(` (an
injected test seam — the repo's documented fake-injection precedent, not a fake of a computation) and the
word "any" inside a doc comment.

- No `as any` / `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` added.
- No silent `catch {}` added (no new catch at all).
- No `TODO`/`FIXME`/placeholder bodies added.
- No test that cannot fail: all 10 new tests failed on the pre-fix bytes (§2), and the two pure-helper tests
  assert deterministic values (elision boundary; measured-vs-claimed inventory) that a behaviour change flips.
- No comment claims more than the bytes do: the `oracleContractNames` docblock explicitly disclaims the
  enforcement half.

---

## 6. STOP-and-REPORT (files I do not own — exact shape, NOT applied)

### 6.1 `src/lib/verify.server.ts` — the enforcement half of the name-binding fix (owner: lane 339-1)

Today a case that calls an undefined identifier is still COMMITTED and RUN: `runCases` compiles the case
`with(exports){ … return (expr) }`, so `computeMean(nums) === 2` throws `ReferenceError: computeMean is not
defined`, which the harness reports as a case failure (`fail error …`) — never a machine pass, but a
guaranteed refusal regardless of code quality. The case set is committed in `generateCases` at the
`return { ok: true, cases };` line (**currently `verify.server.ts:1251`**). Exact shape (requires 339-1's
file, so reported, not applied):

1. Immediately before that return (after the existing `oracleBriefGrounded` gate at `:1247`), filter/reject
   the case set against the module's measured export inventory. Reuse the file's own helpers:
   `referenceIdentifiers` (`verify.server.ts:913`, already drops property accesses / object keys / regex
   content) with an added "is it called" check, and the inventory supplied by the caller.
2. The inventory is now available on the contract the caller passes: **this lane changed codegen to pass the
   module's MEASURED exports as `signatureNames`** (`codegen.server.ts:4293` via `oracleContractNames`), so
   `generateCases`' `contract` param IS the real export surface. A case whose called identifier is not in
   `contract` ∪ a small JS-globals allowlist (`Number`, `Math`, `String`, `Boolean`, `Array`, `Object`,
   `JSON`, `parseInt`, `parseFloat`, `isNaN`, `Date`, …) must be dropped/refused with a reason naming
   `<case-id>` → `<undefined-identifier>`, one bounded repair retry, then an honest `RT_E_VALIDATION` refusal
   — never silently run to a `ReferenceError`.
3. Beware the false-positive classes a naive scan hits: member calls (the regex in the private
   `calledIdentifiers` at `verify.server.ts:845` captures `round` from `Math.round(x)`), and globals. Use the
   value-position `referenceIdentifiers` and a NOT-preceded-by-`.` guard; keep the JS-globals allowlist a
   named, pinned constant.
4. Keep the E-08 pinned-row repair (a dropped pinned id is still a hard refusal) — the new filter must not
   silently drop a pinned oracle row; drop/repair only self-authored steering cases, and refuse the set when
   a pinned row would be dropped.

### 6.2 `src/lib/headless.ts:2426` — the journey's refusal reader cap (owner: 338-3 / boundary)

`const P6_JOURNEY_REFUSAL_MAX = 200;` → raise to `P6_REFUSAL_DETAIL_MAX` (1200), i.e.
`const P6_JOURNEY_REFUSAL_MAX = 1200;`, so `p6CycleLiveDeps`' `deps.synthesisRefusal` carries the whole
recorded refusal (this lane raised codegen's reader to 1200 and `refuse()`'s writer to 1200). **Not blocking:**
this lane's new `withTreeFailureContext` primary-prompt reader already carries the same refusal (up to the
1500-char `P6_JOURNEY_TAIL_MAX` tail, `headless.ts:2552`) into cycle N+1, so the failing case + reason reach
the next cycle even without this change. The 200-char slice only limits the (now redundant) PREVIOUS-REFUSAL
block; raising it removes the duplication-free truncation.

---

## 7. Keyed usage (measured)

**0 keyed calls spent; both allowed calls held in reserve.** Per `fixes/338_3_autonomy.md` §4 and the
338-1b typing proof, the residual P6 red on this brief is **structural, not stochastic**: (a) the
name-binding ENFORCEMENT is out-of-file (§6.1) and (b) lane 339-1's sanitizer grammar fix had to land for
the harness to accept the model's own case payloads at all — it did land during this lane, but a keyed run
would then exercise the out-of-file enforcement gap rather than this lane's in-file half. A keyed run today
therefore could not be *decisive* about the claim this lane owns ("the oracle contract now binds to the
emitted exports"), which the deterministic injected-deps integration test already proves
(`codegen.server.test.ts` — the verify seam receives the measured exports). Spending tokens on a run whose
outcome is decided by an unlanded sibling fix would not change any verdict, so the calls are held, documented,
and available to the boundary owner. No `npm run eval` was run; no secret printed.

---

## 8. What I did NOT do, and why

- Did **not** touch `verify.server.ts` (lane 339-1), `headless.ts`, `scaffold.ts`, `dod.ts`, `algorithms.ts`,
  or any other file — §6 reports the two needed changes instead.
- Did **not** claim the name-binding gap is fully closed: the in-file half (contract bound to measured
  exports) is landed and tested; the enforcement half is STOP-and-REPORTed and honestly disclaimed in the
  code docblock.
- Did **not** rebuild the verify loop: `verifyAndFixServer` remains the reuse seam; the primary-prompt
  failure reader reuses the existing `deps.treeFailure` plumbing rather than a new channel.
- Did **not** run the full gate / `npm test` / `npm run build` (six lanes mid-edit). Targeted test file only,
  both runtimes; `npx tsc --noEmit` on the whole repo reports only a sibling-WIP error in
  `src/lib/prompt-engine.test.ts(89,9) TS7022` (not this lane's files); `npx eslint` on both owned files → 0
  errors, 0 warnings.
- Did **not** run `npm run eval` against the tracked dir; no tracked file deleted; all scratch under
  `%TEMP%\rt339_2\`.

---

## 9. Residual variance, named

The oracle case set is still **model-generated**, so a hallucinated identifier remains possible until §6.1
lands; this lane's contract binding narrows the source (the oracle is grounded on the module's measured
exports instead of the plan's list) and the next-cycle failure reader makes the loop informative, but the
guarantee "a case calling an undefined identifier cannot be committed" requires the out-of-file filter. That
is the measured residual, stated as a boundary — not a claim of closure.

---

## 10. RESUME (same lane 339-2) — the two 339-4 residuals + the one-line headless allowance

**Re-opened** 2026-10-02 at HEAD `c4348f4` (main, six lanes mid-edit). **Owned this resume:** the same
`src/lib/codegen.server.ts` + `src/lib/codegen.server.test.ts` + this log, plus the ONE granted line in
`src/lib/headless.ts`. Nothing else was touched. Runtime pins and rules unchanged (patch-only, RED-first,
no full gate, targeted `codegen.server.test.ts` only, keyed-free, scratch `%TEMP%\rt339_2\`).

### 10.1 Deliverable 1 — the coded `expandBrief` refusal is preserved

`codegen.server.ts` (legacy single-module path). Before: every non-`not-configured` expansion failure was
flattened to `RT_E_LLM_REJECTED`. After (`:3984`), matching the file's own synthesis pattern at
`:4119`/`:4587`:

```
expanded.reason === "not-configured" ? "RT_E_LLM_NOT_CONFIGURED" : (expanded.code ?? "RT_E_LLM_REJECTED"),
```

RED (before, pinned Node 22.23.2): `not ok 12 - a coded expandBrief refusal surfaces its own code, never
RT_E_LLM_REJECTED` → `actual: 'RT_E_LLM_REJECTED · expandBrief failed: model returned a non-conforming
expansion payload: missing key "edgeCases"'`. GREEN: `ok 12` (same run also pins the no-code fallback:
`ok 13 - an uncoded expandBrief error still falls back to RT_E_LLM_REJECTED`).

### 10.2 Deliverable 2 — cached-spec reuse validates all six keys

`codegen.server.ts` `:3957-3962`. Before, reuse required only `Array.isArray(existing.requirements) &&
length > 0`. After, the guard is `expandedSpecViolations(existing).length === 0` (the helper now imported
from `prompt-engine.ts` at `:131`). RED: `not ok 8 - a cached spec missing the other five keys is NOT
reused — it is re-expanded` (`expand` never called). GREEN: `ok 8`, and the pre-existing
`reuses a brief-faithful persisted spec (expand never called — 87 S7 orphan closed)` still passes — a
genuinely complete cached spec (all six keys present, `requirements` non-empty) is still reused.

**Honest scope of "`[]`":** `expandedSpecViolations` is the authority and rejects a *missing* key or a
non-array; it accepts a present **empty** array for the five non-`requirements` keys (only
`requirements` must have usable entries). So the closed defect is "missing/non-array other keys"; a
present-`[]` other key is conformant by design — and the existing "genuinely complete cached spec" fixture
(`:783`, `edgeCases/errorHandling/dataFlow/negativeConstraints: []`) relies on exactly that, which is why
its behavior is preserved. The mission's "`[]`/missing" wording therefore lands as "missing" only; that is
the authority's semantics, not a shortcut.

### 10.3 Deliverable 3 — one-line headless allowance

Exact line changed in `src/lib/headless.ts` (the ONLY line touched there):

```
src/lib/headless.ts:2426
-const P6_JOURNEY_REFUSAL_MAX = 200;
+const P6_JOURNEY_REFUSAL_MAX = 1200;
```

`git diff --numstat src/lib/headless.ts` → `1  1  src/lib/headless.ts` (one insertion, one deletion).
Test reachability: the cap is module-local but its consumer `p6CycleLiveDeps` is exported and pure, so it
IS reachable from this lane's owned test file — pinned there (no model), RED-first:
`not ok 1 - a >200-char refusal is carried whole through p6CycleLiveDeps (not clipped at 200)`
(`expected: 618, actual: 200`) and `not ok 2 - a hostile megabyte reason is still bounded to 1200`
(`expected: 1200, actual: 200`); GREEN after: both `ok`.

### 10.4 Results — targeted file, both runtimes

| State | Runtime | `codegen.server.test.ts` |
|---|---|---|
| RED (pre-fix bytes) | Node 22.23.2 | **201 tests / 197 pass / 4 fail** (the 4 = D1's 1, D2's 1, D3's 2) |
| GREEN (after) | Node 22.23.2 | **201 tests / 201 pass / 0 fail** |
| GREEN (after) | Node 24.15.0 | **201 tests / 201 pass / 0 fail** |

Baseline at resume open was **196/196**; this resume adds **5** tests (201). ≥196/196 holds on both runtimes.

### 10.5 Regression I introduced in headless.ts's OWN suite (owner: boundary, not me)

`headless.test.ts` pins the old cap: `src/lib/headless.test.ts:1530`
`assert.equal(rdeps!.synthesisRefusal!.length, 200, "bounded to the ~200-char refusal cap")`. That pin is
now stale. Measured (pinned Node 22.23.2, read-only run of the headless suite — NOT part of the required
gate, run only to report the truth):

```
not ok 2 - p6CycleLiveDeps: no prior cycle → undefined; tree-failure-only → exactly {treeFailure} (byte-identical)
  expected: 200
  actual: 580
# tests 146 / # pass 145 / # fail 1
```

The fix is the owner's one-token edit (`200` → `1200`); `headless.test.ts:1509`'s `<= 200` still passes.
**I did not edit `headless.test.ts`** (outside this resume's ownership).

### 10.6 Residual comment drift in headless.ts (named, not fixed — one-line grant)

`headless.ts:2423-2425` still reads "plus the first ~200 chars of the model's reason". The granted allowance
is exactly one line, so the stale `~200` in that docblock is left for the boundary owner. Reported, not
silently "fixed".

### 10.7 What I did NOT do

- Did not touch any file outside `codegen.server.ts`, `codegen.server.test.ts`, and the single
  `headless.ts:2426` constant line (verified: `git diff --numstat src/lib/headless.ts` = `1 1`; no other
  file staged by this resume).
- Did not edit `headless.test.ts` (its stale 200-pin is reported in §10.5, not applied).
- Did not update the `headless.ts:2423-2425` doc comment (§10.6).
- Did not run the full gate / `npm test` / `npm run build`; no keyed calls; no tracked file deleted;
  scratch stayed in `%TEMP%\rt339_2\`.
- `npx tsc --noEmit` filtered for the three files → **0 errors** (concurrent-lane noise excluded);
  `npx eslint` on the three files → **0 errors, 0 warnings**.

---

## 11. RESUME 2 (same lane 339-2) — the over-rejection vector in the export inventory (verifier A)

**Re-opened** 2026-10-02. **Owned this resume:** `src/lib/algo-tools.ts`, `src/lib/algo-tools.test.ts`
(the ONE-TIME grant — the inventory helper's home) plus the previously-owned `src/lib/codegen.server.ts`
and `src/lib/codegen.server.test.ts`. Nothing else touched. Runtime pins and rules unchanged (patch-only,
RED-first, no full gate, targeted files only, keyed-free, scratch `%TEMP%\rt339_2\`).

### 11.1 Defect (verifier A: `%TEMP%\rt339_va\exports_probe.mjs`) — LOW-MEDIUM over-rejection

`codegen.server.ts:4295` binds the oracle contract to `oracleContractNames(module, claimedExports)`, which
returns `exportedNamesOf(module)` when non-empty. The measured inventory (`algo-tools.ts:353`) missed four
REAL CommonJS export forms, and because the claimed-exports fallback fires only when the measured list is
EMPTY, a module mixing a recognised export with a computed one **drops** the computed name:

```
BEFORE  oracleContractNames("function add(){}; function sub(){}; module.exports.add = add; module.exports['sub'] = sub;", ["add","sub"]) => ["add"]
```

so an oracle case calling the real export `sub` is flagged undefined and repaired/refused. That is the
over-rejection verifier A found.

### 11.2 What landed (all in `src/lib/algo-tools.ts`)

| New / changed helper | Recognises |
|---|---|
| `objectLiteralKeys(masked, source, openBrace)` (extracted from `moduleExportsObjectNames`) | object-literal keys, now incl. quoted `{ "x": v }`; shared by the object and Object.assign scanners |
| `moduleExportsStringKeyNames(masked, source)` | `module.exports['x'] =` / `module.exports["x"] =` / `exports['x'] =` |
| `objectAssignExportNames(masked, source)` | `Object.assign(module.exports, { … })` / `Object.assign(exports, { … })` |
| `topLevelBindingNames(masked)` + `moduleExportsAliasNames(masked)` | `module.exports = <ident>` alias — reported only when `<ident>` is a depth-0 `function`/`class`/`const`/`let`/`var` binding |
| `esmDeclaratorNames` | now returns `{ names, end }` so the alias scanner resumes past a declarator list (the ESM path in `exportedNamesOf` uses `.names`) |

All three new scanners reuse the SAME `maskNonCode` view (no ad-hoc lexer) and keep the 109 T-08 / 330 P3
boundary discipline. For a computed key the masker has blanked the literal, so the bracket interior is
located structurally in `masked` and the literal recovered from the length-preserving `source` at the
same indices (comments/strings in prose still cannot contribute).

### 11.3 Boundary discipline preserved (pins in `src/lib/algo-tools.test.ts`)

- dot forms unchanged: `obj.module.exports.x`, `my_module.exports.x` → `[]`; `module.exports.z`/`exports.real` kept.
- new forms' left boundary: `obj.module.exports['x']`, `my_module.exports['x']`, `myexports['x']`,
  `obj.module.exports = sub`, `obj.Object.assign(module.exports, {sub})` → `[]`.
- non-code: `const s = "module.exports['x'] = 1;";`, `// module.exports['x'] = 1` → `[]`.
- `==` is a comparison, not an assignment: `module.exports['x'] == 1`, `module.exports == sub` → `[]` (new forms use `=(?!=)`).
- alias is expression-scoped: `sub.x`, `sub()`, an undeclared name, a function-expression name, and a
  parameter all → `[]` (only a real top-level binding counts).
- `module.exports = { … }` with nested/computed/spread keys is unchanged (`["run","wrap"]` etc.).

### 11.4 RED → GREEN (real output)

**BEFORE** (pre-fix `algo-tools.ts` restored with `git checkout -- src/lib/algo-tools.ts`; host node v24.15.0):

```
[]       <- module.exports['sub'] = sub
[]       <- exports['sub'] = sub
[]       <- module.exports = sub
[]       <- Object.assign(module.exports,{sub})
oracleContractNames over computed-export module: []
```

**AFTER** (verifier A's probe, both runtimes):

```
["sub"]  <- module.exports['sub'] = sub
["sub"]  <- exports['sub'] = sub
["sub"]  <- module.exports = sub
["sub"]  <- Object.assign(module.exports,{sub})
oracleContractNames over computed-export module: ["sub"]
```

**RED (pre-fix bytes + the new pins):** `# tests 260 / # pass 255 / # fail 5` — the four new
`algo-tools.test.ts` form pins (`not ok 1..4` in the 339-2 describe) plus the codegen over-rejection pin
(`not ok 3 - ORACLE-CONTRACT: a computed real export is not dropped when mixed with a recognised one`,
`actual: ['add']  - expected: ['add','sub']`).

**GREEN (after, targeted files, both runtimes):**

| File | Node v24.15.0 | pinned Node v22.23.2 |
|---|---|---|
| `src/lib/algo-tools.test.ts` | **58 / 58 pass, 0 fail** | **58 / 58 pass, 0 fail** |
| `src/lib/codegen.server.test.ts` | **202 / 202 pass, 0 fail** | **202 / 202 pass, 0 fail** |

`codegen.server.test.ts` was 201/201 at open of this resume → 202 (≥201 holds); `algo-tools.test.ts` was
52/52 → 58 (+6).

### 11.5 The over-rejection pin (so it cannot return)

`src/lib/codegen.server.test.ts` — inside `W52/339-2 oracleContractNames`:

```ts
it("ORACLE-CONTRACT: a computed real export is not dropped when mixed with a recognised one", () => {
  const mixed =
    "function add(){}; function sub(){}; module.exports.add = add; module.exports['sub'] = sub;";
  assert.deepEqual(oracleContractNames(mixed, ["add", "sub"]), ["add", "sub"]);   // was ["add"]
  assert.deepEqual(oracleContractNames("function sub(){}; module.exports['sub'] = sub;", []), ["sub"]);
  assert.deepEqual(oracleContractNames("function sub(){}; module.exports = sub;", []), ["sub"]);
  assert.deepEqual(oracleContractNames("function sub(){}; Object.assign(exports, { sub });", []), ["sub"]);
});
```

The four per-form pins live in `src/lib/algo-tools.test.ts` (`describe("exportedNamesOf — 339-2 computed
keys, alias, Object.assign (real CJS exports)")`): computed keys (single/double/spaced), the reassignment
alias (declared-vs-not), `Object.assign` literal keys (incl. quoted), quoted object-literal keys, the
boundary-discipline rows, and a pre-existing-forms control.

### 11.6 What I did NOT do

- Touched only `algo-tools.ts`, `algo-tools.test.ts`, `codegen.server.test.ts` this resume;
  `codegen.server.ts` bytes are the PRIOR resume's (122/14 diff), unchanged here.
- Did not add a new scan/lexer: the three new scanners reuse `maskNonCode` + `objectLiteralKeys`.
- Did not change the dot-form `==` behaviour (pre-existing; only the new forms use `=(?!=)`), and did not
  decode string-literal escapes in a key (`'su\u0062'` reports the raw literal — exotic, out of scope).
- Did not run the full gate / `npm test` / `npm run build`; no keyed calls; no tracked file deleted;
  scratch stayed in `%TEMP%\rt339_2\`. `npx tsc --noEmit` filtered for the owned files → **0 errors**;
  `npx eslint` on the owned files → **0 errors, 0 warnings** (after dropping two `no-useless-escape`
  escapes in the alias regex). `sweep73-fuzz.test.ts` (the non-required determinism/leniency sibling that
  imports `maskNonCode`/`exportedNamesOf`) re-run read-only → **52/52**, so the shared helpers did not
  regress.

