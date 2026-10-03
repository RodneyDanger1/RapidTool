# 346 · validator V1 — independent re-derivation of lanes E1 + E2, and a whole-tree trust sweep

**Root:** `C:\Users\mnril\Desktop\RapidTool Main` (git `main`, base HEAD `988b158` + the wave's
uncommitted changes). **Windows / PowerShell.** **Runtimes:** host `node v24.15.0`; Node
`v22.23.2` at `& "$env:LOCALAPPDATA\hermes\node\node.exe"`.
**MANDATE HONORED:** READ-ONLY. The only file written is this one. No `git checkout/stash/reset/apply`,
no commit, no product/test/config edit. **0 keyed calls** (every transport touched was a
`globalThis.fetch`/`opts.fetch` stub or a pure function; no live provider key was used or printed).
**No full gate run** (`npm test`/`build`/`gate.sh` were NOT executed). Probes live under
`%TEMP%\rt346_v1\` and import product modules with `--experimental-strip-types`.

All counts below were re-derived from the bytes on this box; where a report and the bytes disagree,
the bytes win.

---

## 1. Validation table (headline claims)

| # | Claim (source) | Verdict | My evidence | Correction / caveat |
|---|----------------|---------|-------------|---------------------|
| E1-1a | E-08 oracle feeds are genuinely live at both call sites (`codegen.server.ts`, `headless.ts`) | **CONFIRMED** | `codegen.server.ts:4692–4697` passes `seeds: oracleToCaseSeeds(project.oracle)` + `pinnedOracleIds`; `defaultDeps.verify` = `verifyAndFixServer` (`:3645`); `verify.server.ts:1995–2000` forwards both into `generateCases`, which prepends via `buildOracleCasesPrompt` (`:1628`) and refuses dropped ids via `droppedPinnedOracleIds` (`:1743–1781`). `headless.ts:4291–4301` identical. Pin tests `346 E1 A1-04` green (`# tests 2 # pass 2`) and the headless pin asserts `PINNED A7 ORACLE ROWS (E-08)` + every `# <id> ` line is in the real captured prompt. | None. (The stale `dod.ts:1113–1120` DORMANT comment is real and E1 correctly STOP-and-REPORTs it.) |
| E1-1b | New behavioural floor + tree-lane requirement stop "no constraint at all" | **PARTIAL** | Oracle-lane `behaviouralOracleExpression` (`verify.server.ts:1519`) reproduces: rejects `typeof`, `f() !== null/undefined/void 0`, bare call, `1 === 1`, empty/whitespace; accepts concrete/relational/`declaration; final`. Tree-lane three legs present and work: `scaffold.ts:2587–2603` row has `assert.equal(__jobOutcomeOk, true)`; `runSpecFile` shape-only ⇒ `run:"fail", behavioural:false` (`compile-check.server.ts:1288–1300`); `treeRunTestedEvidence` requires `behaviouralSpecs.length > 0` and treats absent as legacy (`codegen.server.ts:5493–5536`). Pins green. **But** the tree-lane classifier is materially weaker than the oracle-lane one — see SB-2. | The report sentence "*the equality family rejects a type/presence/length marker*" is imprecise: `assert.equal(x, undefined)`, `assert.equal(x, null)`, `assert.equal(names.length, 0)` and literal tautologies `assert.equal(1,1)` are all classified **behavioural** (over-accepting). The stated limit (a constant-returning stub compared to its own constant, e.g. `get() === 0`, still passes) is inherent and IS disclosed in E1 §5. |
| E1-1c | `specSourceHasBehaviouralAssert`, `moduleEmbedded`, empty-shape rejection, `VERDICT_CHANNEL_FAILED_REASON` | **CONFIRMED** | Each reproduced by probe: `specSourceHasBehaviouralAssert` true for genuine/`throws`/`match`, false for shape-only/commented/quoted/empty; `moduleEmbedded` predicate `len>0 && some(body.includes)` false for empty gen (byte read `headless.ts:2460`); `fixtureShapeValueIsVacuous({})==true, ([]==true, ({a:1})==false` and `compileFixtureAssertion` red-cards empty shape (`brief-fixtures.ts:685,722`); `verdictChannelFailed(false,false)==true` and the reason is distinct from `NO_CALLABLE_EXPORTS_REASON` (`verify.server.ts:799–810,1054`). | None. |
| E2-2a | One shared transient-retry set; 502/504 now retries on the DeepSeek path | **CONFIRMED** | `TRANSIENT_RETRY_STATUS = {429,500,502,503,504}` exported `deepseek.ts:109`, imported `openai-compatible.ts:63`; both retry loops key on it (`deepseek.ts:289`, `openai-compatible.ts:313`). Pin `fixes/346 A2-F4` green (`# tests 2 # pass 2`), incl. a real stub over `[502,504,200]` → succeeds on attempt 3. | None. |
| E2-2b | Three transport sites use the one-shot seam; static guard has teeth | **CONFIRMED** | `probe.ts:181`, `tavily.server.ts:90`, `harvest.ts:375,390,394` all route through `oneShotFetch`; guard `one-shot-fetch.test.ts:146–160` passes (`# tests 8 # pass 8`). **Teeth verified against the actual pre-fix bytes:** `git show HEAD:` each file contains a bare `fetch(` (tavily `await fetch(url, init)`, harvest two `await fetch(url, {`, probe `fetch(...args)`), so the guard would have RED'd. | Guard regex `(?<![A-Za-z0-9_.])fetch\s*\(` does **not** catch `globalThis.fetch(` or `window.fetch(` (evaded as long as `oneShotFetch` stays referenced elsewhere in the file) — see SB-3. `opts.fetch(` is the intended injection seam. |
| E2-2c | Redaction: no over-match (`xai-based-tool` intact), real key shape redacted | **CONFIRMED** | Probe: `"xai-based-tool"`/`"tvly-dev"`/`"xai-short"` byte-identical; `"xai-"+40a` and `"tvly-"+40b` → `[secret-hidden]`; `XAI_API_KEY`/`TAVILY_API_KEY` env values redacted. Pins `A2-F6` green. | None. |
| E2-2d | Fingerprint injective for NUL/`|`/`,` and byte-identical when delimiter-free | **PARTIAL / REFUTED for the tag-list case** | `failureSignature` comma case distinct (`anchors:a\x01cb` vs `anchors:a,b`), NUL-shift knowledge case distinct, delimiter-free `failureSignature` byte-identical, existing pins green. **BUT** `fingerprint` still collides `tags:["a,b"]` with `tags:["a","b"]` (and the same for `supersedes`) because it joins with `,` **before** escaping. Reproduced: both save to id `K8803dc5b`; the second `savePattern` returns `appended:false` and the store holds **1** row — the two distinct rows are silently merged. See SB-1. | A2-F7's claim ("tags/supersedes lists … the inner `,` join, so no field can shift another") is **false as written** for the tag/supersedes list. The test suite only pins the NUL-boundary case and the `failureSignature` comma case, so the hole is untested. |
| E2-2e | Failover deletion: no caller references the removed symbols/env var; no live capability silently deleted | **CONFIRMED** | `grep` over `src/` + `scripts/`: `FALLBACK_PROVIDERS_ENV_VAR` / `resolveFallbackChain` / `failoverArmingGap` / `RAPIDTOOL_FALLBACK_PROVIDERS` appear **only** in comments and the rewritten pin `registry-failover.test.ts` (which asserts their absence); zero product code. Nobody registered the probed descriptor and `xai.requestModelIds === []`, so failover was never live (pin `# tests 3 # pass 3`). | Honest nuance: the deletion also removed a **loud coded `RT_E_VALIDATION` refusal** and replaced it with silent inert behavior — setting `RAPIDTOOL_FALLBACK_PROVIDERS=xai,deepseek` now does nothing instead of telling the operator failover is unimplemented. No live capability was lost; a small honesty signal was traded for silence. E2 states the intent plainly, so this is disclosed, not hidden. |

**Supporting pure-predicate probes** (all under `%TEMP%\rt346_v1\`, run with
`node --experimental-strip-types`): `probe_behaviour.mjs`, `probe_e1c.mjs`, `probe_e2.mjs`,
`probe_collision.mjs`, `probe_treefloor.mjs`, `probe_misc.mjs`.

---

## 2. Defeat-attempt results (Scope A attacks)

Commands used: `& "$env:LOCALAPPDATA\hermes\node\node.exe"` and `node --experimental-strip-types`
against the probe files; targeted pin runs via
`node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="…" <file>`
(TAP reading enforced, per the `--test-name-pattern` no-op trap in AGENTS.md).

| Attack the mandate named | Result | Detail |
|---|---|---|
| Stub whose only export returns a constant (`0`,`""`,`[]`) with a case `=== that constant` | **Bypasses the oracle floor (by design)** | `behaviouralOracleExpression("get() === 0")`, `("get() === ''")`, `("x === 0")` all **true**. `("get() === []")` is **false** (arrays/objects are not "concrete expected tokens"). The floor stops *shape-only*, not *trivial*; E1 §5 discloses this. |
| Case whose "expected value" the author can trivially satisfy | **Bypasses; disclosed limit** | Same as above + tree lane: `assert.equal(f(), 0)` with `const f = () => 0` ⇒ `specSourceHasBehaviouralAssert` **true**. Not a false report — the floor's stated job is "no constraint at all". |
| `!==` chained with `||` | **Correct** | `"a() !== 1 || b() === 2"` true; `"a() !== 1 && b() !== 2"` true; per-atom split works. |
| String-literal expectation | **Correct** | `E.VERSION === "1.0.0"` true (string masked to a marker and treated as concrete); tree lane `assert.equal(f(), "")` true. |
| Tolerated `declaration; final` repair form | **Correct** | `"const r = f(); r === 5"` true and `"const r = f(); r !== 0"` true, classified at the final statement. |
| Pinned row | **Correct** | The pin only requires the id be present; the behavioural requirement is separate (`oracleHasBehaviouralCase`, `verify.server.ts:1844`). A pinned empty/shape row cannot itself satisfy the floor. |
| Empty / whitespace case | **Correct** | `behaviouralOracleExpression("")==false`, `("   ")==false`, `(";")==false`; `specSourceHasBehaviouralAssert("")==false`, whitespace false. |
| Tree-lane: a spec whose only assertion is a **literal tautology** | **DEFEATED** | `assert.equal(1,1)`, `assert.equal(true,true)`, `assert.equal(undefined,undefined)`, `assert.ok(1===1)` all return **true** (behavioural). The oracle-lane equivalent `1 === 1` returns **false**. Concrete integration proof: `compile-check.server.test.ts` "purity — subject bodies unchanged" writes a spec with `assert.equal(1, 1)` and asserts the tree-run is `ok:true`; that test passes (`# tests 2 # pass 2`). |
| Tree-lane: `assert.equal(x, undefined)` / `assert.equal(x, null)` presence-only | **DEFEATED** | Both return **true**; `assert.notStrictEqual(ep, null)` and `assert.equal(names.length, 0)` also true. These are the presence/length shapes the report says the equality family rejects. |
| `assert.ok(true)` / bare `assert(...)` / shape-only control | **Correctly rejected** | `assert.ok(true)` false (bare-read), `assert(1 === 1)` false (no `assert.<name>`), `assert.ok(typeof f === "function")` false. |
| `VERDICT_CHANNEL_FAILED_REASON` reachability | **Correct** | `verdictChannelFailed` is checked at `:1054` **before** the `!callables` branch; no-key returns `not-configured` first. Reproduction of the truth table matched the report. |
| `moduleEmbedded` empty-source defeat | **Correct** | Predicate `len>0 && some(includes)` → empty gen is `false` under both empty and non-empty file bodies. |
| Empty-shape `{}`/`[]` fixture defeat | **Correct** | Vacuous predicate true, non-empty false; `compileFixtureAssertion` returns `ok:false` with the precise reason. `[]` is (strictly) not fully vacuous in `__fxPartialMatch` (it requires an empty actual array), so red-carding it is conservative, not wrong. |
| E2: 502/504 DeepSeek retry | **Correct** | Green pin drives a real stub `[502,504,200]` → `ok:true`, 3 calls. |
| E2: static guard teeth | **Mostly has teeth** | Caught by the actual HEAD bytes; evadable via `globalThis.fetch(` (SB-3). |
| E2: redaction over-match / under-match | **Correct** | Both directions reproduced. |
| E2: NUL/`|`/`,` injectivity | **NUL + `failureSignature` OK; tag-list `,` DEFEATED** | See SB-1. |
| E2: failover removal left dangling callers | **No dangling references** | Confirmed by grep. |

---

## 3. Scope-B findings (whole-tree trust sweep)

The sweep looked for: verdicts minted without a green run; evidence/gate hashes that omit a claimed
input; claim comments outrunning bytes; checks that cannot fail; unwired seams whose absence is not
disclosed; dead/mock code reachable in production.

### SB-1 — `knowledge.fingerprint` tag/supersedes join is NOT injective; two distinct rows silently merge (HIGH)
- **Where:** `src/lib/knowledge.ts:375–395` (`fingerprint`); the tag join is at `:384`, the
  supersedes join at `:388–391`. The claim-comment at `:375–377` asserts injectivity.
- **Root cause:** each list is `.join(",")` **first**, then `encodeAddressField(..., ["\u0000", ","])`.
  Escaping the *joined* string cannot distinguish a separator comma from a literal comma inside a
  tag. (The `failureSignature` path is correct because it escapes **each** anchor before joining —
  `:984–985`.)
- **Reproduction** (`%TEMP%\rt346_v1\probe_collision.mjs`):
  ```
  node --experimental-strip-types "$env:TEMP\rt346_v1\probe_collision.mjs"
  A tags=['a,b']  -> K8803dc5b appended: true  tags stored: ["a,b"]
  B tags=['a','b']-> K8803dc5b appended: false tags stored: ["a,b"]
  COLLISION (same id): true
  entries after two DISTINCT rows: 1
  ```
  The second `savePattern` returns `appended:false` and the store keeps 1 row: a distinct knowledge
  row (different tag set) is silently swallowed and the caller is handed the *other* row's tags.
  Reachable: `assertValidNewEntry` (`:307–326`) imposes no comma restriction on tags, and A2-F7
  itself introduces `probe:a,b` tag values.
- **Severity:** real correctness/honesty defect in a content-addressed store, in the exact class
  A2-F7 claimed to close. Fix: escape per element
  (`e.tags.map(t => encodeAddressField(t, [","])).sort().join(",")`), same for `supersedes`; add a
  pin for the tag/supersedes comma case.
- **Not a regression:** the pre-A2-F7 bytes also collided here. But the *claim* of injectivity is new
  and false.

### SB-2 — the tree-lane behavioural floor accepts tautological / presence-only assertions (MEDIUM)
- **Where:** `src/lib/compile-check.server.ts:1144–1198` (`isShapeMarker`, `assertionIsShapeOnly`,
  `specSourceHasBehaviouralAssert`); consumed at `runSpecFile` `:1288–1300` and
  `codegen.server.ts:treeRunTestedEvidence` `:5506,5536`.
- **Root cause:** for the equality family, `assertionIsShapeOnly` returns shape-only **only** if some
  argument matches `isShapeMarker` (a comparison expression containing `typeof`/`Array.isArray`/
  `== null`/`.length > N`). A bare `undefined`/`null` operand, a `.length` *operand*, or a pure
  literal do not match, so `assert.equal(x, undefined)`, `assert.equal(names.length, 0)` and
  `assert.equal(1, 1)` are all counted as **behavioural**.
- **Reproduction** (`%TEMP%\rt346_v1\probe_treefloor.mjs`, `probe_misc.mjs`):
  ```
  true  literal tautology assert.equal(1,1)
  true  always-true assert.equal(undefined,undefined)
  true  assert.equal(x, undefined) PRESENCE
  true  assert.equal(names.length, 0)
  false  (oracle-lane) 1 === 1
  ```
  Integration proof that this mints green: `compile-check.server.test.ts` "purity" writes a spec
  whose only assertion is `assert.equal(1, 1)` and asserts the tree-run `ok:true`; it passes.
- **Reachability:** `walkSpecFiles` (`:589–611`) runs **every** `tests/**/*.(spec|test).*`
  (`SPEC_FILE_RE:578`), not just the scaffold's `tests/oracle.spec.ts` (`TREE_RESERVED`,
  `scaffold.ts:311`) — so a model-emitted spec file with a tautological assertion satisfies the
  floor and can contribute the one "behavioural" spec `treeRunTestedEvidence` requires for a
  `tested` stamp.
- **Severity:** Medium — latent (the engine's own emitted specs carry real assertions), but this is
  precisely the trust boundary the floor advertises, and it is weaker than the oracle-lane floor it
  is paired with.
- **Fix:** reject literal-only equality operands on both sides and bare `null`/`undefined` operands,
  mirroring `isConcreteExpectedToken`/`behaviouralOracleExpression`.

### SB-3 — A2-F5 static guard evadable via `globalThis.fetch(` (LOW)
- **Where:** `src/lib/llm/providers/one-shot-fetch.test.ts:152`
  (`const BARE_FETCH = /(?<![A-Za-z0-9_.])fetch\s*\(/`).
- **Reproduction** (`%TEMP%\rt346_v1\probe_e2.mjs`): `BARE_FETCH.test("globalThis.fetch(url)") === false`
  and `.test("window.fetch(url)") === false`, while `"await fetch(url)"` is `true`.
- **Impact:** a future regression that swaps `oneShotFetch(url, …)` for `globalThis.fetch(url, …)`
  while leaving the `import { oneShotFetch }` line would pass the guard. The guard's stated purpose
  ("no bare global fetch") is only partly covered. Current files are clean, so this is a guard
  limitation, not a present defect.

### SB-4 — `dod.ts:1113–1120` still claims the E-08 pinning is DORMANT (LOW; already disclosed)
- The comment still says the callers "pass neither `seeds` nor `pinnedOracleIds`" and "nothing here
  claims a live consumer". The bytes at `codegen.server.ts:4694` and `headless.ts:4298` now forward
  both. This **under-claims** (stale doc) rather than inflating trust, and E1's STOP-and-REPORT #1
  names it explicitly. Owner (dod.ts) should update/strike it.

### SB-5 — A2-F5 line numbers in the E2 report drifted (COSMETIC)
- Report: `probe.ts:175`, `tavily.server.ts:84`, `harvest.ts:373,388`. Actual:
  `probe.ts:181`, `tavily.server.ts:90`, `harvest.ts:375,390,394`. No substantive impact.

### SB-6 — failover deletion traded a loud refusal for silence (INFO / disclosed)
- Covered in the table row E2-2e. Not a hidden deletion; the removed switch never routed anywhere.

### Theories examined and found clean (no reproduction ⇒ not reported as defects)
- **Verdict-without-green-run:** `treeRun` `ok` requires compile + all specs pass/skip-handled +
  entry green + core green + project leg + behavior (`compile-check.server.ts:1926–1956`);
  `mintTreeRunTested` refuses red outcomes and no-spec runs (`codegen.server.ts:5560–5582`). No
  bypass found other than SB-2's floor hole.
- **Evidence hash omitting a claimed input:** `treeVerdictHash` (`:732–774`) folds the decisive
  verdict fields incl. per-spec `[file, run]` (so a shape-only spec, which is forced to `run:"fail"`,
  cannot hide); `treeRunTestedEvidence` folds spec paths + counts + declared-script state. No
  omission found.
- **Unwired seams undisclosed:** the `watchdog.ts` header (`:5–10`) now states plainly that
  `watchdogDecision`/`shouldAutopause`/`requiresHumanResume`/`boundedStepWatch` have no production
  consumer (grep confirms consumers only in `watchdog.test.ts`). The browser verify seam
  (`verify.ts:36–43`) genuinely omits `seeds`/`pinnedOracleIds` and E1 STOP-and-REPORTs it. Both
  disclosed.
- **Mock/dead code reachable in production:** the test `mock` provider is absent from `PROVIDERS`
  (`registry.ts:58–61,119–120,250`); no env flag selects it.
- **`checkpointAdmits` `savedAt`:** boundary reproduced (`undefined`/`"x"`/`NaN`/`-1`/`8.64e15+1` ⇒
  `RT_E_VALIDATION`; `0`/`8.64e15`/`Date.now()` ⇒ ok) — `checkpoint.server.ts:418–431`.
- **`token-ledger` A1-08:** `err.code = "RT_E_VALIDATION"` attached with the message byte-identical
  (`token-ledger.ts:577–582`).

---

## 4. How much of the two reports can be trusted as written

**E1 (`fixes/346_e1_verification.md`) — trustworthy, with one overstated sentence.**
Every headline mechanism I could reach is real and pinned: the E-08 feeds are genuinely live at both
call sites and terminate in the real consumer (prepend + dropped-id refusal); the tree-lane
requirement exists at all three legs; `moduleEmbedded`, the empty-shape rejection and the
`VERDICT_CHANNEL_FAILED_REASON` classification all reproduce. Its honesty disclosures (§5
"deliberately modest" tree-job probe, STOP-and-REPORT for `dod.ts` and the browser seam) are accurate.
Two caveats: (1) the sentence "the equality family rejects a type/presence/length marker" overstates
the classifier — presence/length **operands** and literal tautologies are accepted (SB-2); (2) the
report implies the tree-lane floor closes the "weakest assertion" hole comparably to the oracle lane,
but the tree-lane floor is strictly weaker (the oracle lane rejects `1 === 1`; the tree lane accepts
`assert.equal(1,1)`). No inflated counts or fabricated evidence were found; the pin tests I re-ran were
green.

**E2 (`fixes/346_e2_resilience.md`) — mostly trustworthy; one claim is false as written.**
A2-F4 (shared retry set + 502/504 DeepSeek retry), A2-F5 (one-shot seam, guard teeth against the real
pre-fix bytes), A2-F6 (redaction both directions), A1-08, `checkpointAdmits`, the `requiresHumanResume`
strike, and the failover deletion's "no dangling reference / never live" all re-derived clean, and the
pins are genuine tests, not tautologies. **One refuted claim:** A2-F7's fingerprint injectivity — the
tag-list/supersedes `,` join is still non-injective and silently merges two distinct rows (SB-1); the
suite never pins that case. Everything else in A2-F7 (NUL-shift, `failureSignature` comma case,
delimiter-free byte-parity) is correct. Severity in the report was not inflated anywhere I checked;
the only over-claim is A2-F7's "no field can shift another".

**Bottom line:** the wave's central trust additions are real and mostly well-pinned. The two gaps that
matter are both *claimed stronger than the bytes*: E1's tree-lane behavioural floor is evadable by a
literal tautology / presence operand, and E2's content-address codec is still non-injective for a
comma inside a tag or supersede id (silent row merge). Both are reproducible with the probes in
`%TEMP%\rt346_v1\`, and both should be fixed before the claims stand.
