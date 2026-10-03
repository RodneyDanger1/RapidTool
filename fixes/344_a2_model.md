# 344 — auditor A2 (model / agentic / verification / synthesis)

**Scope:** `src/lib/` model + verification + synthesis slice (see §3 coverage). **Mode:** read-only.
**HEAD:** `4bd1988` (`main`). **Keyed calls made: 0.** Scratch: `%TEMP%\rt344_a2\`.

**Verdict up front.** The slice is unusually honest by construction — most "fake/mock/placeholder"
classes are gated, coded and mutation-tested, and the default paths are byte-parity-pinned. But the
**machine-verification harness is defeatable by the very code it verifies**: an emitted module can
forge the harness's own `HARNESS_EXPORTS` / `HARNESS_COMPILE` marker lines asynchronously and turn a
module that THROWS on load and exports nothing into a `status:"passed"` verdict that then mints the
`tested` machine-proof stamp. That is a direct answer to the mandate's question: *the factory can
seal/ship a product it should have refused.* One critical, one high (failover unarmed = single
provider), and a set of medium/low gaps follow.

---

## 1. Findings table

| id | class | file:line | sev | evidence | autonomous-factory impact | recommended fix | effort |
|----|-------|-----------|-----|----------|---------------------------|-----------------|--------|
| **A2-F1** | **Verifier unsound — verdict forgery by the code under test** | `src/lib/verify.server.ts:739` (HARNESS_EXPORTS emit), `:970-989` (last-wins parse), `:713-752` (`buildHarness`), `:994-996`/`:1006-1021` (gates) | **Critical** | Module `setTimeout(()=>{console.log('HARNESS_EXPORTS exports');console.log('HARNESS_COMPILE pass')},0); throw new Error('boom')` + case `typeof exports === 'object'` → `runCases` returns `pass:true`; through `verifyAndFixServer` (fetch-stubbed) → `STATUS = passed`, and `applyVerifyOutcome` mints `lastTest {label:"tested",evidenceHash:"2928326181"}`. Probes: `%TEMP%\rt344_a2\probe-harness-pass.mjs`, `probe-e2e-seal.mjs`, `probe-mint.mjs`. | **Blocks the core promise.** A module that cannot even load is stamped "machine-verified/tested"; could seal/ship a non-working product. Defeats the `NO_CALLABLE_EXPORTS` and `HARNESS_COMPILE fail` refusals (both bypassed in the repro). | Never accept a marker line from the child's normal stdout: have the harness emit markers over a **separate, unforgeable channel** (e.g. `process.stdout.write` on fd 3 / an IPC message, or write results to a file the module cannot name), OR: parse markers only from a **bounded prefix** emitted before the module runs, and snapshot `callables`/`compileMarker` **before** the case loop so later lines cannot overwrite. Add a regression: a module that schedules a lookalike marker must still be refused. | M |
| **A2-F2** | Unfinished feature / single point of failure — failover unarmed, second family never dispatchable | `src/lib/llm/providers/registry.ts:299-317` (`failoverArmingGap`), `:740-763` (refusal); `src/lib/llm/providers/probe.ts:132`; `src/lib/llm/providers/openai-compatible.ts:210` (`applyProbedModels`) | **High** | `retryable` grep: `probeProviderModels` is imported **only** by `registry.test.ts` (0 production consumers). `applyProbedModels` **mints** a verified descriptor but nothing registers it into `PROVIDERS`; `xai.requestModelIds === []`. Setting `RAPIDTOOL_FALLBACK_PROVIDERS=xai` → coded `RT_E_VALIDATION` refusal in `callModel`. | **Degrades to block.** A DeepSeek outage / wallet-empty / alias death halts the whole factory: there is no cross-family reroute. It fails **loudly** (won't silently ship), so it is a resilience blocker, not a correctness lie. The "probe" feature is also a finished-looking shell with no production caller. | Wire a registration seam (`registerProbedProvider(id, descriptor)` called by the probe consumer) so `resolveFallbackChain` can see a dispatchable second family, then add the transient-class router + `LlmResult` served-provider provenance. Or explicitly de-scope and delete the probe shell. | L |
| **A2-F3** | Context gap — repo map absent from single-module lane and every repair prompt | `src/lib/codegen.server.ts:4403-4410` (single), `:4894-4903` (chunk); `withRepoMapContext` defined `:1233`, used once | Med | `withRepoMapContext(` occurs exactly once (`:4894`, chunked primary). `synthesizeSingleModule` builds `user = withTreeFailureContext(withSynthesisRefusalContext(withGateRepairContext(p6SynthesisUserPrompt(...))))` — no map; all bounded repair prompts also omit it. Matches the 343 parent's own §6 note. | Degrades delivery for **library/service (single-module) products**: the model gets no ranked tree outline while the tree lane does. Not a false ship. | Wrap the single-module primary prompt (and optionally the repair prompts) with `withRepoMapContext(..., repoMapForProject(project,...))`, byte-parity-gated when no tree. | S |
| **A2-F4** | Retry-policy asymmetry between provider families | `src/lib/llm/providers/deepseek.ts:105` vs `src/lib/llm/providers/openai-compatible.ts:275` | Low-Med | DeepSeek `RETRYABLE_STATUS = {429,500,503}`; OpenAI-compatible `{429,500,502,503,504}`. A transient **502/504** gateway error on DeepSeek is treated as terminal (no retry) while the sibling family retries it. Registered in 343 §6. | Causes avoidable failed synthesis attempts (wasted budget, more refusals) on DeepSeek edge errors. Does not fabricate a pass. | Unify on one shared transient set (or document why DeepSeek's gateway never emits 502/504). | S |
| **A2-F5** | Transport asymmetry — the 327-L2 CLI crash class persists on 3 paths | `src/lib/tavily.server.ts:84`; `src/lib/harvest.ts:373,389`; `src/lib/llm/providers/probe.ts:176` | Low-Med | These still call global undici `fetch`. `websearch.server.ts:215-220` and the provider adapters migrated to one-shot `node:https` *specifically* because undici's TLS teardown handle races the CLI's in-tick `process.exit()` on Node 24/Windows (libuv `async.c:76`, `0xC0000409`). `tavilySearch` is reached from `headless.ts:4543 probeTavily` / `:421`. | An unattended CLI run that ends in-tick after a Tavily/harvest fetch could crash (lost envelope / nonzero exit). **Not reproduced here** (would need a keyed/network CLI run) — stated as an unverified risk. | Route these through the existing one-shot transport, or document why they are exempt (e.g. never followed by an in-tick exit). | S |
| **A2-F6** | Secret-redaction coverage gap | `src/lib/node-runner.server.ts:249-270` (`redactSecrets`) | Low | Exact-value redaction reads only `process.env.DEEPSEEK_API_KEY`; shape redaction covers `sk-or-`/`sk-proj-`/`sk-`/`Bearer eyJ`/`sk_live_`. An `XAI_API_KEY` (`xai-…`) or `TAVILY_API_KEY` value has no exact-redaction and no matching shape. | Low: `scrubbedEnv()` already withholds those vars from the child, so exposure needs a key value to appear in child output some other way. | Add the other provider key env values (and a generic `xai-…` shape) to `redactSecrets`. | S |
| **A2-F7** | Content-address delimiters not injective | `src/lib/knowledge.ts:331-345` (`fingerprint`, `\u0000` join); `:914-931` (`failureSignature`, `|`/`,` join) | Low | Fields are joined by a delimiter without escaping; a hostile field containing the delimiter can make two distinct entries/records hash to the same id (conflated lesson row / lost failure record). Explicitly named unfixed in 343 §6 ("knowledge NUL fingerprint delimiter"). | Silently merges two distinct records — minor data-integrity loss, not a false ship. | Length-prefix each field (or JSON.stringify the tuple) before hashing. | S |
| **A2-F8** | Trust of a self-declared capability | `src/lib/mcp.server.ts:478-486` | Low | The read-only round-trip gates on the server's own `annotations.readOnlyHint === true`; nothing enforces read-only behavior. Documented as a read-only *round-trip* gate, not a boundary. | Low: a lying MCP server can perform writes and have them reported as a read-only call. Owner-gated OFF by default. | State the trust boundary in the surface output, or restrict to owner-approved servers. | S |
| **A2-F9** | Dead exports / unused codes (unfinished wiring) | `src/lib/crew.server.ts:1468` (`crewToReport`), `src/lib/errors.ts:83,563` (`RT_E_NOT_IMPLEMENTED`), `src/lib/llm/providers/probe.ts` | Low | `crewToReport` carries `TODO(F2-09): zero code consumers`; `RT_E_NOT_IMPLEMENTED` has no emitter (`scripts/README-cli.md:1145` itself says "no live emitter today"); `probeProviderModels`/`applyProbedModels` have no production consumer (overlaps A2-F2). | Misleading surface area; none affects a verdict directly. | Wire or delete at the next ingest pass, matching the repo's own "wire or de-scope" note. | S |
| **A2-F10** | Minor robustness | `src/lib/synthesis-policy.ts:75` | Info | `selectBestOfN(NaN)` → `Math.max(1, Math.min(NaN,4))` = `NaN` → loop runs 0 times (0 samples). Only reachable by a direct caller; `codegen` passes the sanitized `resolveSynthesisCandidates`. | None in production. | Not worth doing (or clamp with `Number.isFinite` in the exported helper). | — |

**Not findings (verified sound, stated for the record):** cassette key+response binding (`cassette.ts:470-504` recomputes both FNV bindings at load and at serve time); cross-origin redirect auth-strip (`one-shot-fetch.server.ts:76-85`); one-shot transport; entry-oracle `complete`/empty-pin refusals (`entry-oracle.ts:144-173`); env allowlist excludes API keys (`node-runner.server.ts:190-218`; `entry-oracle.ts:63-88`); the `NO_CALLABLE_EXPORTS` gate **has test teeth** (see §4).

---

## 2. Work plan (ordered by severity × leverage)

1. **A2-F1 — make the verify verdict unforgeable (Critical).** `verify.server.ts`.
   - Change: emit `HARNESS_EXPORTS` / `HARNESS_COMPILE` (and ideally `ORACLE_RESULT`) on a channel the module cannot write — e.g. write the verdict to a file path passed via argv, or to fd 3 (`stdio: ["ignore","pipe","pipe","pipe"]`), and read only that. Minimum viable: snapshot `callables`/`compileMarker` immediately after the module body and freeze them (ignore marker lines seen after the case loop starts).
   - Test: a module scheduling `setTimeout(()=>console.log('HARNESS_EXPORTS …'))` must still be refused; add to `verify.test.ts` (real runner, keyless).
   - Risk: the harness string is byte-pinned by tests; a channel change touches `node-runner.server.ts` spawn stdio. Preserve the legacy line format on the unforgeable channel to keep existing pins.
2. **A2-F2 — arm or de-scope failover (High).** `registry.ts` + `probe.ts` + a new registration seam.
   - Change: add `registerProbedProvider(id, descriptor)` and have the probe consumer call it, so a verified xAI family becomes dispatchable; then implement the transient-class router + served-provider provenance. If not in scope, delete the probe shell and the unarmed-chain env var so the surface stops implying a capability.
   - Test: `resolveFallbackChain` sees a verified family; a transient DeepSeek failure reroutes (deterministic deps).
   - Risk: widening `LlmResult` provenance touches many pins; keep additive/conditional.
3. **A2-F3 — repo map on the single-module lane (Medium).** `codegen.server.ts`.
   - Change: wrap `p6SynthesisUserPrompt` output with `withRepoMapContext(…, repoMapForProject(project,…).rendered)` in `synthesizeSingleModule`; byte-parity when no tree.
   - Test: existing single-module prompt pins stay green with no tree; a new pin with a tree shows the block.
   - Risk: prompt byte-parity tests for the single lane.
4. **A2-F4 / A2-F5 — unify retry set; migrate the remaining transports (Low-Med).** `deepseek.ts`, `tavily.server.ts`, `harvest.ts`, `probe.ts`.
   - Change: one exported `TRANSIENT_STATUS` shared by both adapters; route Tavily/harvest/probe through the one-shot transport.
   - Test: pin the shared set; a stub server returning 502 verifies one retry.
   - Risk: none material; transport swap must keep the test fetch seam.
5. **A2-F6 / A2-F7 / A2-F9 — redaction coverage, injective hashing, dead-surface cleanup (Low).**
   - Change: add the other key env values/shapes to `redactSecrets`; length-prefix the fingerprint and signature joins; wire or delete `crewToReport`, `RT_E_NOT_IMPLEMENTED`, the probe shell.
   - Test: one row per change.
6. **A2-F8 — document the MCP trust boundary (Low).** Text-only.
7. **A2-F10 — not worth doing** (unreachable in production; adding a clamp is harmless but low value).

**Not worth doing / consciously deferred:** FM-04b (`codegen.server.ts:4058` widen `ModelRoute`) is blocked by A2-F2's `xai` refusal — do it when (and only when) a cross-family route becomes reachable. FM-03b (`:1082`) is a bounded-call-count optimization, not a correctness gap.

---

## 3. Coverage statement

**Read in full / line-audited:** `llm.ts`, `llm/providers/deepseek.ts`, `openai-compatible.ts`,
`registry.ts`, `probe.ts`, `mock.ts`, `one-shot-fetch.server.ts`, `key-resolution.ts`,
`key-source.server.ts`, `deepseek.server.ts`, `cassette.ts`, `synthesis-policy.ts`, `repo-map.ts`,
`prompt-engine.ts`, `verify.ts`, `verify.server.ts`, `entry-oracle.ts`, `node-runner.server.ts`,
`sandbox.ts`, `bench.ts`, `mcp.server.ts`, `websearch.server.ts`, `tavily.server.ts`.

**Read in substantive part (full structural scan + targeted line review; not every branch):**
`codegen.server.ts` (5436 ln — prompts, all `validateSynthesisModule` gates, best-of-N wiring,
`liveP6Synthesis`, single/chunked acceptance, pre-seal typecheck, seal/mint), `compile-check.server.ts`
(verdict/substance/typecheck seams), `knowledge.ts` (fingerprint, failure signatures, lesson rows),
`crew.server.ts` (dispatch, config gate, `crewToReport`), `harvest.ts`, `ast-mine.ts`,
`algo-tools.ts`, `algorithms.ts`.

**Tests:** ran (keyless, targeted) `synthesis-policy`, `repo-map`, `key-resolution`, `key-source`,
`mock`, `one-shot-fetch`, `verify`, `verify.server`, `entry-oracle`, `node-runner.server`, `sandbox`,
`cassette`, `bench`, `ast-mine`, `harvest`, `algo-tools`, `algorithms`, `knowledge`, `mcp.server`,
`websearch` — all green (≈700 tests; 1 legitimately skipped because a real `DEEPSEEK_API_KEY` is set
on this host). Did **not** run the full gate / `npm test`, `codegen.server.test.ts`,
`compile-check.server.test.ts`, `crew.test.ts` (heavy/real-npm; `crew` exercised via `harvest`/
`algo-tools` neighbors), and made **0 keyed calls**.

**Not audited:** the `llm/providers/*.test.ts` registry-failover matrix beyond reading; deep branch
enumeration inside `compile-check.server.ts`/`algorithms.ts`; anything outside `src/lib/` (out of
slice). Honest limit: for the four 1300–5400-line files I verified the paths tied to model calls,
synthesis acceptance, and verification verdicts, not every helper.

---

## 4. Test teeth (mutation check)

Copied `src/` to `%TEMP%\rt344_a2\src` (junctioned `node_modules`), mutated
`verify.server.ts`'s `if (!callables)` to `if (false)`, re-ran `verify.test.ts` → **1 test failed**
(`verify.test.ts:96`, expected `NO_CALLABLE_EXPORTS_REASON`, got `NO_EXPORT_REFERENCE_REASON`).
So the no-callables guard is genuinely pinned — which sharpens A2-F1: the guard is correct in
isolation but is **bypassed wholesale** by the async marker-forgery, i.e. the tests could not see the
bypass because none of them lets the module write to stdout after the harness.

---

## 5. Five most important findings (with evidence)

1. **A2-F1 (Critical) — the verifier is defeatable by the code it verifies.**
   `verify.server.ts:970-989` parses `HARNESS_EXPORTS`/`HARNESS_COMPILE` with last-line-wins from the
   child's normal stdout; the module runs in that same process. Repro (`probe-harness-pass.mjs`):
   ```
   module:  setTimeout(function(){ console.log('HARNESS_EXPORTS exports'); console.log('HARNESS_COMPILE pass'); }, 0);
            throw new Error("module is broken on load");
   case:    typeof exports === 'object'
   runCases => { "pass": true, "results": [ { "id": "c1", "pass": true, "detail": "true" } ] }
   ```
   End-to-end (`probe-e2e-seal.mjs`, fetch-stubbed): `verifyAndFixServer` → `STATUS = passed`,
   `EVIDENCE = 1/1 machine-run cases passed on iteration 1; lint advisory: no-console x2`. Then
   (`probe-mint.mjs`) `applyVerifyOutcome` → `lastTest {label:"tested", evidenceHash:"2928326181"}` —
   the exact machine-proof marker `maker-score`/`dod` read. Both the compile-failure and
   no-callables refusals are bypassed. **A broken, export-less module can be machine-verified and
   sealed.**
2. **A2-F2 (High) — single provider, failover unarmed.** `registry.ts:740-763` refuses a configured
   `RAPIDTOOL_FALLBACK_PROVIDERS` chain; `failoverArmingGap` (`:319-332`) derives that `xai` has
   `requestModelIds []` and `applyProbedModels` mints but never registers; `probeProviderModels` has
   zero production consumers (grep: only `registry.test.ts`). One DeepSeek outage halts the factory —
   loudly, but with no reroute.
3. **A2-F3 (Medium) — context intelligence not applied on the single-module lane.**
   `withRepoMapContext` is used once (`codegen.server.ts:4894`, chunked); `synthesizeSingleModule`
   (`:4403-4410`) and every bounded repair prompt omit the map — library/service products synthesize
   without the ranked tree outline.
4. **A2-F4 (Low-Med) — retry-set asymmetry.** `deepseek.ts:105` retries `{429,500,503}`;
   `openai-compatible.ts:275` retries `{429,500,502,503,504}`. DeepSeek 502/504 are terminal →
   avoidable refusals/wasted attempts.
5. **A2-F5 (Low-Med) — the 327-L2 CLI crash class survives on three paths.** `tavily.server.ts:84`,
   `harvest.ts:373/389`, `probe.ts:176` use global undici `fetch`; the transports that were migrated
   (`websearch.server.ts`, provider adapters) did so precisely because undici's TLS teardown handle
   races the CLI's in-tick `process.exit()`. `tavilySearch` is reachable from `headless.ts:4543`.
   Unverified reproduction (would need a keyed CLI run) — stated as risk, not fact.

---

## 6. RESUME (ENGINEER) — A2-F1 fixed: the verdict channel is now unforgeable

**Scope:** `src/lib/verify.server.ts`, `src/lib/verify.ts` (read — no change needed), `src/lib/verify.test.ts`
(read — no change needed), `src/lib/verify.server.test.ts`, `src/lib/node-runner.server.ts`,
`src/lib/node-runner.server.test.ts`. **Mode:** patch-only. **0 keyed calls.** Scratch `%TEMP%\rt344_a2\`.
**HEAD at work:** `4bd1988` + the wave's concurrent lanes (working tree also carries A1/A3/A4 edits to
`brief-fixtures*`, `maker-score*`, `scaffold*` — **not mine**, untouched by me).

### 6.1 The channel I chose, and why it is unforgeable

Verdicts now ride a **dedicated fd 3**, authenticated by a **per-run nonce delivered out-of-band on the
child's stdin**. `runCases` reads verdicts **only** from `run.verdict` (the parent's authenticated view of
fd 3); stdout is non-authoritative detail.

`runNodeBounded(code, { verdictChannel: true })` (`node-runner.server.ts`):

* spawns `node -e <code>` with `stdio: ["pipe","pipe","pipe","pipe"]` (stdin + fd 3 added; the legacy
  path stays byte-identical at `["ignore","pipe","pipe"]` and carries **no** `verdict` field);
* draws `verdictNonce = randomBytes(16).toString("hex")` and writes `nonce + "\n"` to stdin, then ends it;
* captures `child.stdio[3]` into `verdictRaw` and returns `verdict = authenticatedVerdict(verdictRaw, nonce)`
  — only lines beginning with `` `${nonce} ` `` survive, the prefix is stripped, the remainder is
  `redactSecrets`-scrubbed.

`buildHarness` (`verify.server.ts`) now emits (bytes, verbatim):

```
// rapidtool verify harness (machine-authored; do not trust the LLM's claims)
(function () {
var __fs = require('node:fs');
var __write = __fs.writeSync.bind(__fs);
var __Function = Function;
var __keys = Object.keys;
var __nonce = '';
try { __nonce = String(__fs.readFileSync(0, 'utf8')).trim(); } catch (e) { __nonce = ''; }
var __emit = function (line) { try { __write(3, __nonce + ' ' + line + '\n'); } catch (e) {} };
...
  __emit('HARNESS_EXPORTS ' + __joined);
  __emit('HARNESS_COMPILE pass');
} catch (e) {
  __emit('HARNESS_COMPILE fail ' + String(e).slice(0, 120));
}
for (var __ci = 0; __ci < __CASES.length; __ci++) {
  ...
    __emit('ORACLE_RESULT ' + c.id + ' ' + (v === true ? 'pass' : 'fail') + ' ' + String(v).slice(0, 80));
  ...
}
})();
```

Why a module under test cannot write to **or observe** it:

1. **Separate stream.** Verdict lines never touch stdout, so the confirmed `console.log('HARNESS_* …')`
   forgery has nowhere to land. stdout is parsed for exactly one thing — a line starting with
   `ORACLE_RESULT ` **is** an impersonation and fails the run — and is otherwise ignored.
2. **The nonce is out-of-band.** It is delivered on stdin and consumed by `readFileSync(0)` *before* the
   module body runs (the module can only read EOF afterwards). It is **not** in the child env, and **not**
   in the `-e` source. I verified the leak that forces this design: `process.execArgv` contains the whole
   `-e` program, so *any secret embedded in the harness bytes is readable by the module* —
   `node -e "console.log(JSON.stringify(process.execArgv))"` → `["-e","…SECRET_MARKER…"]`. A `-e`-embedded
   nonce (or verdict-file path) is therefore forgeable; stdin is not.
3. **Not global-lexical.** The harness is wrapped in an IIFE. I verified that a top-level `const` in
   `-e` becomes a global-lexical binding visible to a `new Function` body (`new Function('return N')()`
   returned the value); inside an IIFE it is not (`undefined`). So the module cannot read `__nonce` even
   though it shares the process.
4. **The real writer is captured first.** `__write` is bound from `fs.writeSync` *before* the module runs,
   so a module that swaps `fs.writeSync` to harvest the nonce (via `process.getBuiltinModule('fs')`)
   cannot intercept the harness's writes. `Function` and `Object.keys` are likewise captured, and the
   callables/iteration paths use manual loops (no `.filter/.join/[Symbol.iterator]`) — a module cannot
   prototype-pollute the export inventory or the case compiler to manufacture a marker.
5. **Fail-closed.** If the module closes fd 3 / `process.exit()`s early / the write throws, no
   authenticated line appears → `runCases` returns `pass:false` (compile-fail or
   `NO_CALLABLE_EXPORTS_REASON`). Missing proof is refusal, never a pass.

The parse is **first-marker-wins, not last-wins**: a duplicate authenticated `HARNESS_EXPORTS`/
`HARNESS_COMPILE` is a forgery signal. A lookalike on stdout can never override the channel.

### 6.2 RED / GREEN (real before/after, both runtimes)

Tests added in `verify.server.test.ts` (`describe("344 A2-F1 — the verdict channel is unforgeable
by the module")`) and two runner tests in `node-runner.server.test.ts`.

**RED before the fix** — `node[22|24] --experimental-strip-types --test --test-reporter=tap
--test-name-pattern="344 A2-F1" src/lib/verify.server.test.ts`:

```
# Node 24 (v24.15.0):            # Node 22 (v22.23.2):
not ok 1 - (a) throwing module   not ok 1 - (a) throwing module
not ok 2 - (b) plain lookalike   not ok 2 - (b) plain lookalike
not ok 7 - (end-to-end) forgery  not ok 7 - (end-to-end) forgery
# tests 8  pass 5  fail 3        # tests 8  pass 5  fail 3
```

The E2E RED output was the exact false machine-proof:

```
{"status":"passed","iterations":1,
 "evidence":"1/1 machine-run cases passed on iteration 1; lint advisory: no-console x2",
 "finalSource":"setTimeout(...console.log('HARNESS_EXPORTS exports')...);\nthrow new Error('module is broken on load');",
 ... "lesson":{"id":"lesson-verified-procedure-8d5a26db", ...}}
```

i.e. a module that **throws on load and exports nothing** was `status:"passed"` (and would mint
`lastTest {label:"tested"}` via `applyVerifyOutcome`).

**GREEN after the fix** — same command:

```
ok 1..8 on BOTH runtimes:
 (a) load-throwing module that schedules lookalike markers       -> refused
 (b) plain lookalike console.log module (no throw)               -> refused (NO_CALLABLE_EXPORTS_REASON)
 (e) module writing lookalikes directly to fd 3 (no nonce)       -> refused
 (e2) hooking fs.writeSync to harvest the nonce + forge          -> refused
 (c) control: genuinely green module                             -> PASSES
 (d) control: genuine compile failure                            -> refused
 (end-to-end) verifyAndFixServer(forgery) status != "passed", no tested label
 (end-to-end control) genuinely green -> status "passed" + mints tested
# tests 8  pass 8  fail 0  (Node 22 and Node 24)
```

### 6.3 Pins I had to move

No **literal harness-string** pin exists anywhere in the tree (`rg 'rapidtool verify harness'` → only the
producer); the pins were behavioral, and all are preserved with the **legacy line format unchanged**
(`HARNESS_EXPORTS …`, `HARNESS_COMPILE pass|fail …`, `ORACLE_RESULT <id> pass|fail [detail]`). I updated
two **stale mechanism comments** honestly (both files are mine), because they described the old
stdout/last-wins contract:

* `verify.server.test.ts` — the `fixes/327 L5` block header ("parsed last-marker-wins") and the `338-6`
  block header ("through a console bound BEFORE the module runs") now state that the channel changed and
  stdout is non-authoritative. The assertions are unchanged and still green.
* `node-runner.server.ts` — the stdio comment now documents the channel; the default path is still
  `["ignore","pipe","pipe"]`.
* `verify.server.ts` — the `__emit`/console-capture comment was replaced (there is no console capture any
  more; `console` is deliberately left untouched so module output stays ordinary stdout detail).

### 6.4 Regression counts (both runtimes)

| suite | Node 22.23.2 | Node 24.15.0 |
|---|---|---|
| `verify.server.test.ts` + `verify.test.ts` + `node-runner.server.test.ts` (owned) | **147 / 147 pass, 0 fail, 0 skip** | **147 / 147 pass, 0 fail, 0 skip** |
| `codegen.server.test.ts` (read-only regression — consumes `verify.server.ts`) | **224 / 224 pass, 0 fail** | **224 / 224 pass, 0 fail** |
| `exec.test.ts` (extra, direct consumer of the changed `runNodeBounded`) | **19 / 19 pass** | **19 / 19 pass** |

`tsc --noEmit` → **exit 0** (no diagnostics). Scoped `eslint` on the four changed files → **clean**.
No full gate run (per instruction). No tracked file deleted.

### 6.5 What remains uncaught (honest)

* The harness is still **bounded, not a sandbox** (unchanged, declared). A module with full globals can
  tamper with globals the harness still reads after the module runs (`String(v).slice(…)` for the
  ORACLE_RESULT **detail** text only) — that can alter displayed detail, never a verdict. Verdicts for a
  case come from `v === true` (the module's own returned value) and the callables inventory is captured
  before the module runs, so no case can be minted for another id.
* A module that legitimately exports a callable whose result satisfies the (LLM-authored, sanitized,
  brief-grounded) cases still passes — that is correct behavior, not forgery.
* The residual prototype-pollution surface around **detail** strings is not worth hardening further for
  the verdict guarantee; if a hostile module is in scope at all, OS isolation (a distinct, declared
  blocker) is the real answer.
* `process.execArgv` still exposes the harness source (IIFE + variable names) to the module — by design
  there is no secret in it, so this is not a forge path; noted for completeness.
