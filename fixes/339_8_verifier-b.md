# fixes/339_8_verifier-b.md — W53 · verifier B (independent audit of lanes 339-3/4/5/6 + wave census)

**Role:** verifier B, 339 wave. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` @ HEAD `c4348f4`
+ the large uncommitted wave. **Runtimes:** host `node` v24.15.0, and Node 22.23.2
(`& "$env:LOCALAPPDATA\hermes\node\node.exe"`). Windows PowerShell.
**Constraints honored:** working tree NOT modified (only this log; `git status` before/after = 26 `M`
+ 6 `??` = this + the 5 sibling logs). No `git checkout/stash/reset/apply`. No full gate. No keyed
LLM calls. Pre-fix comparisons done on a COPY at `%TEMP%\rt339_vb\` (full tree, node_modules junctioned),
with HEAD bytes written from `git show HEAD:<file>` and restored from the repo after each mutation.

---

## 0. Baseline re-measurement (both runtimes, scratch copy, current bytes)

All lane suites re-run from `%TEMP%\rt339_vb` with `--test-reporter=tap`:

| batch | Node 24.15.0 | Node 22.23.2 |
|---|---|---|
| `dod.test.ts judgment.test.ts phases.test.ts maker-score.test.ts` | **118 / 118 / 0 fail** | **118 / 118 / 0 fail** |
| `packet.test.ts handoff.test.ts scaffold.test.ts` | **159 / 159 / 0 fail** | **159 / 159 / 0 fail** |
| `prompt-engine.test.ts llm.test.ts llm/providers/registry.test.ts llm/providers/mock.test.ts` | **106 / 106 / 0 fail** | **106 / 106 / 0 fail** |
| `verify.test.ts verify.server.test.ts entry-oracle.test.ts harvest.test.ts knowledge.test.ts` | **210 tests / 209 pass / 1 skip / 0 fail** | **210 / 209 / 1 skip / 0 fail** |

(An early run from a *partial* scratch copy failed `harvest.test.ts` / the mock-provider E2E with
`Cannot find module '…\rt339_vb\scripts\path-safety.mjs'` — an artifact of my incomplete copy, not the
wave. The full-tree scratch copy is green. Recorded here because an incomplete-copy false red is itself
an audit hazard.)

---

## 1. Claim 339-3 — p6-brief-fit names the state; bar + verdict unchanged — **CONFIRMED**

**Byte read.** `git diff -- src/lib/dod.ts`: the probe logic is factored into `briefFitSource(p)`
(byte-identical union read) and the threshold is unchanged: `hits.length >= Math.max(1,
Math.ceil(required.length * 0.35))` (`dod.ts:729-734`). `runGate` appends `unmetReason` output to the
RETURNED `unmet[i].criterion` (`dod.ts:880-893`); the evidence hash still hashes `id:pass|fail` only, so
no verdict/hash change. `judgment.ts:190-198` reads `u.reason` into the verdict detail.

**Satisfiability re-derived from real bytes (`%TEMP%\rt339_vb\probe_vb_packet.mjs`, keyless floor):**

```
P6 unmet ids: p6-verified, p6-brief-fit
- [ ] Brief-conformance: required brief nouns appear as identifiers in the generated source (single-module, or the union of the tree files in tree mode) — deterministic floor state — no keyed model synthesis ran; the P6 placeholder implements phase bookkeeping only and carries none of the brief's required nouns (missing: build, dispatch, board, hvac, techs, parts, reroutes, offline, warehouse, scan)
```

A legitimate brief-faithful module still passes (test #5: `dispatchBoard`/`fieldService` ≥ 0.35 →
`p6-brief-fit` not in `unmet`); the floor still fails (test #1). Both green on both runtimes.

**Mutation test of the state-message logic** (scratch copy; each mutation applied to fresh repo bytes,
then restored; `node --experimental-strip-types --test --test-reporter=tap src/lib/dod.test.ts
src/lib/judgment.test.ts`, 18 tests):

| mutation | injected change | result |
|---|---|---|
| M1 | `if (floorShape)` → `if (false && floorShape)` (floor branch dead) | **14 pass / 4 fail** |
| M2 | `const attempted = (p.logs ?? []).some(` → `const attempted = false && …` | **17 / 1 fail** |
| M3 | `runGate` returns the bare item (`return item;`, no `reason`/criterion append) | **12 / 6 fail** |
| M4 | `judgment.ts` `reasons` forced empty | **17 / 1 fail** |

Every mutation is caught by the new tests → the tests are load-bearing, not vacuous. **CONFIRMED.**
Caveat (minor, not a defect): the "keyed synthesis ran" branch keys off `p.logs` events
`p6.synthesis.refused` / `p6.journey.exhausted`; a keyed attempt that failed on a *different* event
would be described as "no keyed model synthesis ran". The floor-shape heuristic
(`/^const JOBS = \[/` + `function test_no_skip`) is also structural, not proof.

---

## 2. Claim 339-3 (resume) — maker-score 0.35 parity + boundary-test teeth — **CONFIRMED**

**Same criterion on bytes:** all three sites read the same helpers (`briefNounHits`,
`identifierHits` from `sandbox.ts`) and the same predicate `hits >= max(1, ceil(required × 0.35))`:

- `dod.ts:725-734` — `Math.ceil(required.length * 0.35)`
- `codegen.server.ts:3315-3319` — `briefFitSatisfied`, `need = Math.max(1, Math.ceil(required.length * 0.35))`
- `maker-score.ts:293-297` — now `Math.max(1, Math.ceil(required.length * 0.35))` (was `0.5`)

The codegen boundary pin is `codegen.server.test.ts:391-404` (N=20: 6 fail / 7 pass) and the new
maker-score test mirrors it with the identical 20-noun fixture. The only difference between the sites
is maker-score's defensive `typeof source === "string" ? source : ""` guard — robustness, not semantics.

**Teeth (scratch copy):** flipped `required.length * 0.35 → * 0.5` in `maker-score.ts` only:

```
not ok 7 - single-module bar is the shared p6-brief-fit 0.35 bar — ceil(20×0.35)=7, six hits fail / seven pass
# tests 80 / pass 79 / fail 1
```

**CONFIRMED.**

---

## 3. Claim 339-4 — spec envelope: one bounded repair + honest provider wire — **PARTIAL**

**Mechanism re-derived from real bytes** (`%TEMP%\rt339_vb\probe_vb_envelope2.mjs`, stubbed
`globalThis.fetch`, no keyed call):

```
leg1 calls: 2 ok: false code: RT_E_VALIDATION err: model returned a non-conforming expansion payload: missing key "edgeCases"; missing key "errorHandling"; missing key "typeSignatures"; missing key "dataFlow"; missing key "negativeConstraints"
leg1 response_format: [{"type":"json_object"},{"type":"json_object"}]
leg2 calls: 2 ok: true spec.requirements: 1     (partial first reply → conforming repair accepted)
leg3 calls: 1 ok: true                           (conforming first reply → no gratuitous repair)
```

**Provider wire:** `deepseek.ts:478` and `openai-compatible.ts:473` emit exactly
`response_format: { type: "json_object" as const }`; the `llm.test.ts` pins assert `deepEqual`
`{type:"json_object"}` and absence of `json_schema`/`schema`/`strict`/`grammar`. Repo-wide grep of
`src/lib/**` for `json_schema|grammar|schema enforcement|constrained decoding`: every hit is
negative-scoped ("NO strict json_schema/grammar mode", "NOT schema … enforcement") or an unrelated
internal prompt/validator (`crew.server.ts` `JSON_SCHEMA`, `vector.ts`/`render.ts` SVG grammar,
`verify.server.ts` oracle reply grammar). **No test or comment claims provider schema/grammar
enforcement. Confirmed.**

**HOLE (the valuable part) — the "strict" validator misses wrong element types and nested shapes, and
`expandBrief` then accepts the reply with silent `[]` defaults.** `expandedSpecViolations` only checks
key presence, `Array.isArray`, and (for `requirements`) usable string entries; it never checks element
types inside the other five arrays. `cleanList` silently drops non-strings. Probe
(`probe_vb_envelope.mjs`):

```
=== A: all six keys arrays, but every element is a WRONG type ===
expandedSpecViolations -> []
=== B: extra top-level keys (unknown) ===            expandedSpecViolations -> []
=== C: requirements mixes valid strings with objects ===  expandedSpecViolations -> []
=== D: nested-shape error inside an array of objects === expandedSpecViolations -> []

=== expandBrief on Case A (stubbed fetch, no real key) ===
calls: 1
ok: true
result: {"ok":true,"spec":{"requirements":["Track delivery deadlines per order."],"edgeCases":[],"errorHandling":[],"typeSignatures":[],"dataFlow":[],"negativeConstraints":[]}}
```

Case A = `{requirements:["…"], edgeCases:[42,null,{nested:true}], errorHandling:[{}],
typeSignatures:[null], dataFlow:[[]], negativeConstraints:[true]}` — a reply whose only surviving
content is one requirement is accepted on the **first** call (no repair) and the other five fields are
defaulted to `[]`. This contradicts the lane's own bytes-claim ("never a fabricated,
silently-substituted, or defaulted spec" / "Defaults are never applied") at the element-type level, and
the own doc's admission that "a conforming-looking reply can still … carry wrong types". Extra keys
(Case B) are also not rejected (probably intentional tolerance, but worth stating). Missing keys and
non-array fields ARE correctly refused (leg1) — hence **PARTIAL, not REFUTED**.

Not verified: the two keyed probe calls in §4 of the lane log (budget/no-keyed-call rule).

---

## 4. Claim 339-5 — packet renders the augmented criterion; System JSON + acceptance — **CONFIRMED**

Rendered a REAL keyless-floor record (not source reading): `%TEMP%\rt339_vb\probe_vb_packet.mjs` drives
`applyPhaseResult(runToGate(seedProject(), 6), 6)` then `compileAgentPacket` / `phaseHandoff`.

```
== floor record ==  currentPhase: 6 status: running  oracle rows: 6  generatedTree: 0
P6 unmet ids: p6-verified, p6-brief-fit

- [ ] Brief-conformance: … tree mode) — deterministic floor state — no keyed model synthesis ran; … (missing: build, dispatch, board, hvac, …)
Generated artifact: single module (project.generatedSource) — the legacy P6 floor, not a multi-file tree.
Verify before reporting, from the emitted tree root: run the tree's install and declared scripts in order (`npm install`, then `npm run typecheck`, then `npm test`) — `npm test` executes the emitted oracle spec (`tests/oracle.spec.ts`). Record each command you ran in the report's `tests_run`. A red run is not a bypass — patch and re-run.
```

`phaseHandoff(floor, 6)` renders the identical augmented row. `## System JSON (machine-readable)`
parses (`JSON.parse` ok) and its top-level key set is byte-identical to the HEAD render —
`schema_version, packet_version, compiled_at, project_id, name, project_status, current_phase,
model_route, capabilities, report_schema, research_hash, input_hash, sandbox, verdict, acceptance,
rejection_loop, decisions, phases, phase_coverage, spend, budget` — and `git diff` touches neither the
envelope code nor the `dodRows` `[x]/[ ]` flag logic.

**Pre-fix contrast** (HEAD `packet.ts`/`handoff.ts` written into the scratch copy, same probe):
bare row `- [ ] Brief-conformance: … tree mode)` and the old acceptance wording
(`run the emitted oracle spec (…) in the project tree with its declared test script (npm test)`).
The install/typecheck/test order matches the emitted README `commandBlock` (`scaffold.ts:2784-2785`) and
the DEPLOY block (`scaffold.ts:3175-3177`). **CONFIRMED.**

---

## 5. Claim 339-6 — airtight `tested` mint + non-vacuous entry oracle — **CONFIRMED** (with the declared residual)

Pre-fix holes demonstrated on HEAD bytes in the scratch copy, then the fix re-measured
(`%TEMP%\rt339_vb\probe_vb_spine.mjs`):

| probe | HEAD (pre-fix) | current (post-fix) |
|---|---|---|
| `applyVerifyOutcome` passed + `cases: []` + evidence | **tested? tested** (state changed) | **tested? null** (state unchanged) |
| passed + whitespace evidence + cases | **tested** | **null** |
| passed + ABSENT cases + evidence | **tested** | **tested** (residual) |
| passed + ABSENT cases + no evidence | **tested** | **null** |
| control genuine pass | tested | tested |
| `runEntryOracle` empty `expectStdout` | **pass** (spawned, `includes("")`) | **fail** (refused pre-spawn) |
| `runEntryOracle` empty `expectStderr` | **pass** | **fail** |
| `runEntryOracle` `expectExit:"1"` | **pass** (silently defaulted 0) | **fail** |
| control real pin | pass | pass |

The residual is exactly the one the lane STOP-and-REPORTs: an absent `cases` field with non-empty
evidence still mints `tested` (pinned by `verify.test.ts`'s 337-3 hash test — another lane's file).
`verify.server.ts:1526-1534` (genuine pass) always carries a non-empty case set + evidence string, and
`runCases` refuses an empty case set (`:710-712`), so the client guard cannot refuse a real pass.
Also: the refused `expectExit` message says "not an integer 0..255" while the check is only
`Number.isInteger` — an integer outside 0..255 is still evaluated normally (it cannot vacuously pass),
so this is a message nit, not a hollow-green path. **CONFIRMED.**

---

## 6. Wave-wide fake / mock census — added lines of `git diff` over `src/lib/**` (2131 lines)

Method: `git diff --unified=0 -- src/lib` parsed to `file:line:added-line` (`%TEMP%\rt339_vb\added_lines.txt`),
then pattern-scanned.

| pattern | added-line hits | verdict |
|---|---|---|
| `TODO` / `FIXME` / `XXX` / `HACK` | 0 | clean |
| `as any` | 0 | clean |
| `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` | 0 | clean |
| `eslint-disable` | 0 | clean |
| `.only(` | 0 | clean |
| `.skip(` | 0 | no new skip; the only added skips are conditional `{ skip: !available }` in `verify.test.ts` (339-1) |
| empty `catch {…}` / `{}` | 0 (the one `catch` hit is non-empty) | clean |
| hardcoded-return fakes | 0 found in production lines | clean |

**The one `catch`:** `src/lib/verify.server.ts:580` `} catch {` — honest, non-empty
(`return source;`), documented at `:558-577` as the fallback that preserves the harness's existing
honest `HARNESS_COMPILE fail` path ("never a silent pass"). 339-1's file, not one of the four lanes
audited, and not a violation.

**`placeholder` (8) / `mock` (18) / `fake` (9) hits** — all prose or test doubles, none production:
`dod.ts:499/520/527/528` + `dod.test.ts:110/133`, `handoff.test.ts:227`, `packet.test.ts:1480`
(deterministic-floor prose); `codegen.server.test.ts:821/863/881/2371` (`fakeDeps` test seam);
`verify.server.test.ts:1055-1164` (`mockChat`/`withFakeKey` test transport);
`prompt-engine.test.ts:91/100` (the renamed, explicitly-annotated `stub` fetch).

**Comments claiming behavior the bytes do not implement — 1 real hit:** `prompt-engine.ts` §Fix B
comment/doc ("never a fabricated, silently-substituted, or defaulted spec"; lane doc "Defaults are
never applied") is false for element-type-malformed arrays — see §3 Case A (accepted on 1 call,
five fields silently `[]`). Everything else checked (`verify.server.ts` strip-fallback doc,
`codegen.server.ts` `boundedRefusalDetail` "never exceeds max" — head+tail+marker = exactly `max`)
matches the bytes.

**No production fake/mock/placeholder code found.**

---

## 7. Destruction audit — **CLEAN**

```
$ base = $env:TEMP\rt339_parent\baseline_tracked.txt ; $cur = git ls-files
baseline count: 2066
current count: 2066
in baseline NOT current (deleted/renamed away): (empty)
in current NOT baseline (added):                (empty)
$ git stash list
(empty; stash count: 0)
```

`git status --porcelain` = 26 `M` + 6 `??` (`fixes/339_{1,2,3,4,5,6}*.md`) — **no ` D` / rename rows**,
no tracked file removed, no stash. The only file I created is this log.

---

## 8. Verdict summary

| # | claim | verdict |
|---|---|---|
| 1 | 339-3 criteria names the floor state; bar+verdict unchanged; mutation-tested | **CONFIRMED** |
| 2 | 339-3 maker-score 0.35 parity + boundary test teeth | **CONFIRMED** |
| 3 | 339-4 one bounded repair + honest provider wire | **PARTIAL** — mechanism+wire confirmed; validator misses wrong element types / nested shapes, `expandBrief` then accepts with silent `[]` defaults (contradicts its own comment) |
| 4 | 339-5 packet/handoff augmented criterion + System JSON + acceptance | **CONFIRMED** |
| 5 | 339-6 airtight tested mint + non-vacuous entry oracle | **CONFIRMED** (absent-`cases` residual is declared, not hidden) |
| 6 | wave-wide fake/mock census | **clean** except the 339-4 over-claim above |
| 7 | destruction audit | **CLEAN** (2066 = 2066, no deletions, stash empty) |

**Not verified / why:** the 339-6 keyed A/B loop-effect and the 339-4 two keyed probe calls (no keyed
calls permitted; budgets); full gate / build / cross-module integration (forbidden while the boundary
owner runs it); lanes 339-1 and 339-2 beyond the added-line census (not assigned to me).
