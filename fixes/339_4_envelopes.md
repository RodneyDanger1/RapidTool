# 339-4 (W53) — envelopes: honest constrained decoding for the spec envelope

**Lane:** 339-4 (persona: envelopes). **Opened** 2026-10-02 at HEAD `c4348f4`, tree clean.
**Owned files:** `src/lib/prompt-engine.ts`, `src/lib/llm.ts`,
`src/lib/llm/providers/deepseek.ts`, `src/lib/llm/providers/openai-compatible.ts`,
`src/lib/llm/providers/mock.ts`, and their colocated tests (`prompt-engine.test.ts`,
`llm.test.ts`, `llm/providers/registry.test.ts`, `llm/providers/mock.test.ts` — all four exist).
No file outside that set was modified.

---

## 1. Reconciliation — claimed / on disk / still open

**Claimed** (338 parent `fixes/338_0_parent.md` §4 last para + §5 item 4): provider-level
constrained decoding is "the largest untouched determinism lever" for the machine-checked
envelopes (spec graph, plan, oracle case set) — make those structures conformant by construction.

**On disk today (bytes read 2026-10-02):**

| Envelope | Requests JSON mode? | Evidence |
|---|---|---|
| Spec graph (`prompt-engine.ts` `expansionCall`) | **yes** | `json: true` at `prompt-engine.ts:333` |
| P6 plan/synthesis (`codegen.server.ts`) | yes | `json: true` at `codegen.server.ts:3982` and `:4282` |
| Oracle case set (`verify.server.ts`) | yes | `json: true` at `verify.server.ts:985`, `:1013`, `:1052` |
| algo-tools envelopes | yes | `json: true` at `algo-tools.ts:121`, `:466` |
| Wire forwarding | yes | `deepseek.ts:478`, `openai-compatible.ts:473` send `response_format:{type:"json_object"}` |

So **every machine-checked envelope already requests JSON mode** — the untouched lever was not
the mode request, it was that the mode is a *hint* with **no schema enforcement**, and the spec
envelope accepted a non-conforming reply with `[]` defaults.

**Still open (not mine → STOP-and-REPORT, §7):**

- `codegen.server.ts:3983` collapses every `expandBrief` failure to `RT_E_LLM_REJECTED`, dropping
  the new `expanded.code` (the file already does the right thing for synthesis at `:4119`/`:4587`).
- `codegen.server.ts:3959` validates a cached `implementationSpec` on `requirements` alone — the
  other five keys can still be `[]` in a spec persisted before this lane.
- Oracle/plan envelopes (§ above) still have no deterministic reply-shape validator of their own;
  their lanes own that work.

---

## 2. Fixes (RED-first)

### Fix A — provider-level `json` capability is now honest and explicit (item 2)

Docs only, no behavior change, no invented capability:

- `deepseek.ts:170-186` — `DeepSeekCompleteOptions.json` contract: GUARANTEED = one syntactically
  valid JSON object via the vendor's documented `json_object` mode + the explicit emit-JSON system
  instruction the mode requires; NOT GUARANTEED = any schema/key-set/type enforcement (DeepSeek has
  **no** strict `json_schema`/grammar mode). Callers must validate the parsed reply.
- `openai-compatible.ts:468-472` — the same mode-hint note at the `response_format` emit; this
  family's strict `json_schema` support is UNPROBED, so only the hint is sent.
- `llm.ts` — the public `complete`/`callModel` `json` option now carries the contract and points at
  `DeepSeekCompleteOptions.json`.

Two pins added in `llm.test.ts` (they pass before AND after — they are **regression pins, not RED
fixes**, and are reported as such): the deepseek and OpenAI-compatible bodies carry *exactly*
`{type:"json_object"}` (no `json_schema`/`schema`/`strict`/`grammar` key) and the explicit
"Respond with valid JSON only" system instruction the mode requires.

### Fix B — deterministic schema validation for the spec envelope (items 1 + 3)

`prompt-engine.ts`:

- New pure, deterministic `expandedSpecViolations(value)` (`:161`) over the canonical six-key
  `EXPANDED_SPEC_KEYS` (`:114`): ordered violation strings — `missing key "x"`,
  `"x" is not an array`, `"requirements" has no usable entries`, or `reply is not a JSON object`.
- `parseExpandedSpecJson` (`:196`) refactored onto shared `parseSpecReplyObject`/`normalizeExpandedSpec`
  helpers — **behavior byte-identical** (fence tolerance, missing keys → `[]`, null on no usable
  requirements); its own doc now says it is the tolerant seam and the strict check is
  `expandedSpecViolations`.
- `expansionCall` now returns a tagged outcome (`:322`); a parsed object failing
  `expandedSpecViolations` is the `nonconforming` repair class, and a provider refusal forwards its
  own `res.code`.
- `expandBrief` sends a non-conforming first reply (missing **or** malformed keys, not just
  requirements-absent) through the **same** one bounded `EXPANSION_REPAIR_LINE` re-prompt, then
  refuses with `{ ok:false, reason:"error", code:"RT_E_VALIDATION", error:"model returned a
  non-conforming expansion payload: <violations>" }` (`:399-403`). Defaults are never applied.
  No parallel request path; the existing `json` knob is the only request path.

**RED (pre-fix, HEAD bytes restored in place — captured with the scratch probe
`%TEMP%\rt339_4\red_partial_spec.mjs`):**

```
fetch calls: 1
ok: true
typeSignatures: []
dataFlow: []
edgeCases: []
```

…and the new test file against HEAD source fails to even import:

```
SyntaxError: The requested module './prompt-engine.ts' does not provide an export named 'expandedSpecViolations'
not ok 1 - src\lib\prompt-engine.test.ts   # fail 1
```

**GREEN (after):**

```
fetch calls: 2
ok: false
refusal: {"ok":false,"reason":"error","code":"RT_E_VALIDATION","error":"model returned a non-conforming
expansion payload: missing key \"edgeCases\"; missing key \"errorHandling\"; missing key
\"typeSignatures\"; missing key \"dataFlow\"; missing key \"negativeConstraints\""}
```

### Fix C — reconciled tests

- `prompt-engine.test.ts`: the two former "unparseable" pins now assert the coded refusal and the
  named violations (they described the old tolerant contract this lane changes); added 4 pure
  `expandedSpecViolations` tests and 4 `expandBrief` strict-envelope tests (refusal after exactly one
  repair; conforming repair accepted with 2 calls; malformed field named; conforming first reply →
  exactly 1 call, no gratuitous repair).
- `llm.test.ts`: 2 capability pins (Fix A).

**Test results (targeted only — no full gate):**

| Runtime | Command | Result |
|---|---|---|
| Node 22.23.2 | `--test llm.test.ts prompt-engine.test.ts registry.test.ts mock.test.ts` | **106/106 pass, 0 fail** |
| Node 24.15.0 | same | **106/106 pass, 0 fail** |
| Node 22.23.2 | `--test deepseek.server.test.ts sweep73-fuzz.test.ts` (adjacent, read-only) | **78/78 pass, 0 fail** |

Baseline at dispatch was 96 for the four owned files; this lane adds **10** tests.

---

## 3. The honest constrained-decoding contract (one paragraph)

`opts.json` **requests** the vendor's JSON output mode — `response_format:{type:"json_object"}` on
the wire (`deepseek.ts:478`, `openai-compatible.ts:473`), plus the explicit "Respond with valid JSON
only" system instruction the mode requires (without it DeepSeek can loop on whitespace until the
token cap). What that **guarantees** is a request for one syntactically valid JSON *object* through
the vendor's documented mode — nothing more. What it does **not** guarantee, and what this lane does
not claim, is schema, key-set, or type enforcement: DeepSeek exposes no strict `json_schema`/grammar
mode (the xAI/OpenAI-compatible family's strict-schema support is UNPROBED here), so a
conforming-looking reply can still omit fields or carry wrong types. Conformance is therefore
established **after** the call, deterministically, by `expandedSpecViolations` on the parsed reply;
a violation is refused with `RT_E_VALIDATION` after one bounded repair re-prompt — the model was
never constrained, the reply was validated, and the two are never conflated.

---

## 4. Keyed usage (2 bounded calls, both reported)

Both via the real `completeDeepSeek` spec-envelope options (`flash`, `json:true`, `maxTokens:900`),
request body captured by wrapping `globalThis.fetch` and forwarding to the real transport:

1. Ambient process key → **refused HTTP 401** (stale ambient key, tail `…42ff`); 0 tokens billed.
   Captured real body before the refusal: keys `model,messages,thinking,max_tokens,response_format,stream`;
   `response_format = {"type":"json_object"}`.
2. Declared repo `.env` key (`RAPIDTOOL_LLM_ENV_FILE`) → **ok:true**, served `deepseek-flash`
   (requested `deepseek-v4-flash`); **usage {promptTokens:132, completionTokens:255,
   cachedPromptTokens:0, cacheMissTokens:132}** (387 tokens total); same body keys and
   `response_format = {"type":"json_object"}`; reply `expandedSpecViolations → []` (conforming),
   `parseExpandedSpecJson → 4 requirements / 3 typeSignatures`.

The resolver emitted `RT_E_LLM_KEY_SHADOWED` (tails only) confirming the `.env` key wins over the
stale ambient one. No secret was printed.

---

## 5. Mock / fake census

Census over the changed files + `mock.ts` for `TODO|FIXME|XXX|HACK|as any|@ts-ignore|
@ts-expect-error|placeholder|hardcoded|catch {}`: **0** in `prompt-engine.ts`,
`prompt-engine.test.ts`, `llm.ts`, `llm.test.ts`, `deepseek.ts`, `mock.ts`; the 2 hits in
`openai-compatible.ts` are **pre-existing** header prose ("no vendor's model list is ever
hardcoded", line 10/34), not new code. `mock.ts` was **not modified** — the test double is
untouched and still fabricates nothing (exhausted queue → coded `RT_E_LLM_REJECTED`). The keyless
proof used a stubbed `globalThis.fetch` and the mock's logged `opts`; **0 real keyed calls** were
made for the keyless leg (the 2 keyed probes in §4 are the only real spend).

---

## 6. What I did NOT do

- Did not add a `json_schema`/grammar capability, and did not claim the model is constrained.
- Did not add a parallel request path — `expansionCall` remains the single envelope call.
- Did not touch `mock.ts`, `codegen.server.ts`, `algo-tools.ts`, `verify.server.ts`, or any other
  lane's files.
- Did not run `npm test`, `npm run build`, or `scripts/gate.sh` (six concurrent lanes).
- Did not delete any tracked file.

---

## 7. STOP-and-REPORT (not applied)

1. **`src/lib/codegen.server.ts` — propagate the coded spec-envelope refusal.** The P6 expansion
   refusal collapses the new code:

   ```
   src/lib/codegen.server.ts:3983
   - expanded.reason === "not-configured" ? "RT_E_LLM_NOT_CONFIGURED" : "RT_E_LLM_REJECTED",
   + expanded.reason === "not-configured" ? "RT_E_LLM_NOT_CONFIGURED" : (expanded.code ?? "RT_E_LLM_REJECTED"),
   ```

   This is the same pattern the file already uses for synthesis (`:4119`, `:4587`), so a
   non-conforming spec (now `RT_E_VALIDATION`) would surface its real class instead of
   `RT_E_LLM_REJECTED`. Owner: 339-2.

2. **`src/lib/codegen.server.ts:3959` — cached-spec validation is requirements-only.** A cached
   `implementationSpec` is reused when `Array.isArray(existing.requirements) && length > 0`; the
   other five keys can still be `[]` from a spec persisted before this lane. Shape: additionally
   require the five keys to be arrays (or re-validate with `expandedSpecViolations` on the persisted
   object). Owner: 339-2. I did not apply it; a persisted-project migration is an owner decision.

3. **Oracle + plan envelopes** still lack a deterministic reply-shape validator of their own; the
   `json_object` mode hint does not make them conformant. Named, not fixed (not my files).

---

## 8. Resume — TS7022 fix + residual re-verification (2026-10-02)

Owned this resume (strict): `prompt-engine.ts`, `prompt-engine.test.ts`, `llm.ts`,
`llm/providers/deepseek.ts`, `llm/providers/openai-compatible.ts`. No other file edited.

### D1 (BLOCKING) — the TS7022 I introduced, fixed

`npx tsc --noEmit` **before**: exit `2`, exactly

```
src/lib/prompt-engine.test.ts(89,9): error TS7022: 'fetch' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.
```

Cause: the `sequencedFetch` helper declared `const fetch = (async …) as typeof fetch`. The local
`const fetch` shadows the global, so the initializer's `typeof fetch` resolved to the local being
declared — a self-reference.

**After** (real annotation, no `as any`, no `@ts-ignore`/`@ts-expect-error`): the local is renamed
`stub`, explicitly annotated `typeof globalThis.fetch`, and given an explicit `Promise<Response>`
return — the cast-to-self is gone:

```ts
const stub: typeof globalThis.fetch = async (
  _url: unknown,
  init?: RequestInit,
): Promise<Response> => { … };
return { fetch: stub, bodies: () => bodies };
```

`npx tsc --noEmit` **after**: exit `0`, no output, whole repo. Callers (`seq.fetch`) unchanged and
byte-identical in behavior.

### D2 — caller-facing coded refusal preserved, pinned

On bytes, independent scratch probe `%TEMP%\rt339_4\probe_refusal.mjs` (stubbed fetch, partial
six-key spec served twice):

```
calls: 2
caller-facing refusal: {"ok":false,"reason":"error","code":"RT_E_VALIDATION","error":"model returned a non-conforming expansion payload: missing key \"edgeCases\"; missing key \"errorHandling\"; missing key \"typeSignatures\"; missing key \"dataFlow\"; missing key \"negativeConstraints\""}
code preserved: true
```

The `code` survives `expansionCall` → `expandBrief`; no path drops it (`expansionCall`'s provider
failure spreads `res.code`; the `nonconforming` tag is minted as `RT_E_VALIDATION` at
`prompt-engine.ts:400-403`). **Pin already in place** (this lane, verified passing):
`prompt-engine.test.ts` "refuses a partial spec after ONE bounded repair re-prompt, coded
RT_E_VALIDATION" asserts `res.code === "RT_E_VALIDATION"` (+ exactly 2 calls, named violations);
"returns a CODED error (never a fabricated spec) on unparseable model JSON" `deepEqual`s the exact
caller-facing object including `code`. No redundant duplicate pin added.

### D3 — `json_object` contract re-verified; over-claim audit

Independent probe `%TEMP%\rt339_4\probe_wire.mjs` captured the real bodies of both adapters:

| Provider | `response_format` | `Object.keys(response_format)` | body keys | first message |
|---|---|---|---|---|
| deepseek | `{"type":"json_object"}` | `["type"]` | model, messages, thinking, max_tokens, response_format, stream | `Respond with valid JSON only — no prose, no markdown fences.` |
| openai-compatible | `{"type":"json_object"}` | `["type"]` | model, messages, response_format, stream | `Respond with valid JSON only — no prose, no markdown fences.` |

Exactly `{type:"json_object"}`, no `json_schema`/`schema`/`strict`/`grammar` key on either body.
The existing `llm.test.ts` pins assert the same (`:107`, `:138` deepEqual; `:108`/`:139` absence
loops) and pass on both runtimes.

**Over-claim audit: none found.** In the owned files every mention is negative-scoped —
`llm.ts:176-178` GUARANTEED is "a *request* for one syntactically valid JSON object", immediately
"NOT GUARANTEED: schema, key-set, or type enforcement"; `deepseek.ts:178-185` and
`openai-compatible.ts:468-472` say the mode hint is not schema/grammar enforcement;
`prompt-engine.ts:155-159` says `json` is a MODE HINT with no enforcement and validates the reply.
Repo-wide, the only other `grammar`/`schema` hits (`verify.server.ts:213` oracle reply grammar,
`crew.server.ts` internal `JSON_SCHEMA`, `vector.ts`/`render.ts` SVG grammar, `handoff.ts:33`
hydration) are internal validators/prompts, not claims the provider enforces a schema. No test or
comment claims schema/grammar enforcement.

### Targeted tests (both runtimes; no full gate)

| Runtime | Before D1 fix | After D1 fix |
|---|---|---|
| node v24.15.0 | 54 tests, 54 pass, 0 fail | 54 tests, 54 pass, 0 fail |
| node v22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`) | 54 tests, 54 pass, 0 fail | 54 tests, 54 pass, 0 fail |

`prompt-engine.test.ts` + `llm.test.ts` only. D1 is a type-only change, so the strip-types runtime
count is identical before/after; the proof for D1 is `tsc --noEmit` exit 0.

### What this resume did NOT do

- No keyed/short calls (held): probes stubbed `globalThis.fetch` only.
- Did not edit any file outside the five owned paths — `llm.test.ts` was read and run, never written.
- Did not run `npm test`, `npm run build`, or `scripts/gate.sh`.
- Did not delete any tracked file; scratch lives under `%TEMP%\rt339_4\`.
- Did not add a `json_schema`/grammar claim or capability; did not add redundant duplicate pins.

---

## 9. Resume 2 — element-type envelope validation (verifier-B MEDIUM, 2026-10-02)

Owned this resume (strict): `prompt-engine.ts`, `prompt-engine.test.ts`. No other file edited
(`llm.ts`, both providers, `mock.ts` were read only). HEAD `c4348f4`, tree carries concurrent
lanes' edits.

### The defect, reproduced

verifier-B's `%TEMP%\rt339_vb\probe_vb_envelope.mjs` (stale repo copy) showed Case A —
`{requirements:["Track delivery deadlines per order."], edgeCases:[42,null,{nested:true}],
errorHandling:[{}], typeSignatures:[null], dataFlow:[[]], negativeConstraints:[true]}` — passed
`expandedSpecViolations` with `[]` and `expandBrief` **accepted it on the FIRST call**:

```
=== A === expandedSpecViolations -> []
=== expandBrief on Case A === calls: 1  ok: true
result: {"ok":true,"spec":{"requirements":["Track delivery deadlines per order."],"edgeCases":[],"errorHandling":[],"typeSignatures":[],"dataFlow":[],"negativeConstraints":[]}}
```

The old validator checked key presence and `Array.isArray` only; `cleanList` then silently
dropped every wrong-typed element into `[]`, contradicting the file's "never a partial one with
defaults" / "Defaults are never applied" claim at the element level.

### Real element shape (read from producers/consumers)

**All six keys are arrays of plain non-empty STRINGS. There is no array-of-objects key.**

| Key | Element shape | Evidence read |
|---|---|---|
| `requirements` | non-empty string | `ExpandedSpec` (`prompt-engine.ts:50`); `types.ts:539-549` `Project["implementationSpec"]`; `p6SynthesisChunkUserPrompt` renders each as a line |
| `edgeCases` | string | same type + p6 prompt |
| `errorHandling` | string | same type + p6 prompt |
| `typeSignatures` | string | `signatureFunctionNames` (`codegen.server.ts:3093-3098`) skips non-strings; `signaturePrimaryName` (`dod.ts:343-352`) string-only; `archCapabilities` (`dod.ts:379-390`) `String(sig).trim()` |
| `dataFlow` | string | `engine.ts:789` `dataFlow.join(" → ")` |
| `negativeConstraints` | string | `applyPolicies` (`prompt-engine.ts:414`) filters `typeof === "string"` |

The persisted record (`types.ts:539-549`) has `requirements/edgeCases/errorHandling/typeSignatures/
dataFlow/negativeConstraints: string[]` plus provenance keys. Case D's nested object is therefore
just a non-string element, caught by the element rule.

### The fix (`expandedSpecViolations`, prompt-engine.ts:185-213)

Per key, after the array check, every element must be a non-empty (`trim() !== ""`) string; each
offending index is named: `"<key>" has non-string or blank entries at index i, j`. `requirements`
keeps its existing ≥1-usable-entry rule. **`[]` is allowed on the five non-requirements keys** —
an explicit empty array is the model's stated answer, not a dropped element; only a non-empty
array whose elements are all unusable becomes a violation (it would otherwise silently default to
`[]`). The comment states exactly this and no more.

The violation flows through the unchanged path: `expansionCall` → `nonconforming` → the existing
ONE `EXPANSION_REPAIR_LINE` re-prompt → a second non-conforming reply → coded
`{ok:false, reason:"error", code:"RT_E_VALIDATION"}` naming the violations. `EXPANSION_REPAIR_LINE`
gained one clause ("Every array element must be a plain, non-empty string …").

**Extra top-level keys are TOLERATED — decided and documented:** the six keys are a MINIMUM shape.
`codegen.server.ts:3962` re-validates the persisted `implementationSpec` (which legitimately
carries `source`/`briefHash`/`createdAt`) with this same function, so a forbidden-extras rule
would strand every cached spec. Pinned both in the code doc and by test.

### Comments corrected

- Module header: "not a six-key STRING-ARRAY JSON object (unparseable, a missing key, a non-array
  key, or a non-string/blank element) … no malformed element is silently dropped into a `[]` default."
- `EXPANDED_SPEC_KEYS` doc and the `expandBrief` honesty ladder: same element-level wording.
- `expandedSpecViolations` doc: the element rule, the explicit-`[]` allowance, and the extra-key
  tolerance (with the `codegen.server.ts` reason).
- Repair-path comment: "carrying a non-string/blank element … no malformed element silently becomes
  a `[]` default."

### Proof

Scratch probe `%TEMP%\rt339_4\probe_caseA.mjs` imports the FIXED module by absolute path (the
verifier's own probe imported a stale copy of the repo).

**Before** (pre-resume source, same new tests) — both runtimes:
```
# tests 43  # pass 39  # fail 4
  not ok - names a non-string/blank element by index (the silent-default class this lane closes)
  not ok - rejects a nested-object element — no key is an array of objects
  not ok - refuses verifier-B's Case A after ONE repair (element junk never silently defaults)
  not ok - accepts a conforming reply that REPAIRS Case A (2 calls, no defaults)
```

**After** — `expandedSpecViolations`:
```
Case A -> ["\"edgeCases\" has non-string or blank entries at index 0, 1, 2", ... , "\"negativeConstraints\" has non-string or blank entries at index 0"]
Case B (extra key) -> []
Case C -> ["\"requirements\" has non-string or blank entries at index 0, 2"]
Case D -> ["\"typeSignatures\" has non-string or blank entries at index 0"]
conforming control -> []
```

**After** — `expandBrief`:
```
Case A served twice      -> calls: 2 | ok: false | code: RT_E_VALIDATION (names the element violations)
Case A then conforming   -> calls: 2 | ok: true  | spec = the conforming reply (no defaults)
conforming control       -> calls: 1 | ok: true  (no gratuitous repair)
```

**Tests** (`prompt-engine.test.ts` + `llm.test.ts`, targeted only — no full gate):

| Runtime | Before (RED) | After (GREEN) |
|---|---|---|
| node v24.15.0 | prompt-engine 43/39/4 | **60 tests, 60 pass, 0 fail** |
| node v22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`) | prompt-engine 43/39/4 | **60 tests, 60 pass, 0 fail** |

Added 6 pins: 4 pure `expandedSpecViolations` (element junk, nested object, extra-key tolerance,
explicit-`[]` allowance) + 2 `expandBrief` (Case A refused after one repair; Case A repaired to
conforming and accepted). The pre-existing "does not repair a conforming first reply (exactly one
call)" control stays green.

`npx tsc --noEmit`: **zero diagnostics in any owned file.** Repo-wide the command was red on
concurrent lanes' live edits, and the error changed between two runs (`algo-tools.ts(420,7)
TS2322` → `verify.test.ts(8,3) TS2305: no exported member 'undefinedCalledNames'`) — churn in
files this lane does not own, not caused by these bytes.

### What this resume did NOT do

- Did not edit any file outside `prompt-engine.ts` / `prompt-engine.test.ts`.
- Did not reject extra top-level keys (deliberate — see above, pinned).
- Did not require non-empty arrays for the five non-requirements keys (explicit `[]` is the
  model's answer, not a default — stated in the code, not over-claimed).
- Did not add a `json_schema`/grammar claim; did not weaken the mock test double.
- Did not run `npm test`, `npm run build`, or `scripts/gate.sh`; no keyed calls.
- Did not delete any tracked file; scratch under `%TEMP%\rt339_4\`.
