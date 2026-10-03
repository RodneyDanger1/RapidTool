# 341-5 (governance + claims truth) — the factory latch is no longer forgeable; the rubric tells one story

**Actor:** engineer 341-5 (governance + claims truth).
**Owned files (STRICT):** `src/lib/doctor.ts`, `src/lib/policy.ts`, `src/lib/maker-score.ts` + their tests.
Everything else STOP-and-REPORT (§8).
**Opened:** at HEAD `2d5ee35` (tree reported clean by `git status --short` at session start).
**Runtime:** host `node` v24.15.0 + repo-pinned Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`);
every suite run uses `--test-reporter=tap`.
**Scratch (outside the repo):** `%TEMP%\rt341_5\` (`probe1.ts` — independent forge/parity probe).
**Constraints honored:** patch-only; no tracked-file deletions; no full gate; no keyed LLM calls; no secret printed.
**No keyed calls needed:** the whole question is decidable from bytes on disk (records, inventories, source), never from a model.

---

## 0. Reconciliation — claimed / found / landed

Question owned: *"Does every user-visible claim match the bytes, and is the factory-claim latch honest?"*

| Claimed by the brief | Found on disk (pre-edit) | Landed |
|---|---|---|
| `coerceFactoryClaim` honours a hand-fed `humanFixtures:true` from an untrusted blob, minting the latch with no human stamp; zero non-test callers | **CONFIRMED.** `probe1` PRE: `coerceFactoryClaim({humanFixtures:true, leftover:false, realMultiJobProduct:true, productComplete:true}, <arch-complete project with NO record>) → latch true, gaps []` | The field is now DERIVED from the project's own acceptance record only (fail-closed); the blob key is ignored. §1 |
| "do not leave a forgeable latch reachable by any future caller" | **A second, identical-class seam:** `evidenceFromJobInventory` honoured `extra.humanFixtures === true` (`probe1` PRE → `human=true, latch=true`) | `humanFixtures` is OMITTED from the `extra` type and ignored at runtime. §1 |
| maker-score rubric claims byte-truth (incl. the inherited 0.35 parity) | **M4 was NOT the probe it claimed.** M4 read only `label`+`hash`; dod's `p6-verified` also requires `ok===true` + non-empty `detail`. `probe1` PRE: `m4(ok:false,label:"tested",hash:"h") = 1` while the P6 gate refuses. The 0.35 parity itself is **byte-true** (`probe1` POST: 0 mismatches vs `codegen.briefFitSatisfied`, k=0..20). | M4 now IS the p6-verified probe; a direct differential parity test was added. §3 |
| policy.ts statements honest | **Audited; no byte-truth overstatement found.** (One stale README test-count, not owned → §8 R2.) | No edit. §3 |
| Human door + no-isolation limit stated honestly wherever the claim surfaces | **CONFIRMED honest** (README §"honest limits" 3, console.tsx:1512/7385-7393, `factory.isolation.note`, the `fixtures` gap + `awaitingHumanAcceptance`). | No strike needed. §4 |
| 340 verifier findings | Verifier B's Claim-1 hole is the forge above; its two stale comments are already corrected; spine residuals persist (not mine). | §5 |

**Landed by this lane:**

| File | Δ |
|---|---|
| `src/lib/doctor.ts` | +15 / −8; `evidenceFromJobInventory` `extra` no longer accepts/reads `humanFixtures`; `coerceFactoryClaim` derives it from `project` only; comments corrected |
| `src/lib/doctor.test.ts` | +122; 2 forge tests + 2 gap-provenance tests; the OV-9 anti-goal test updated to the fail-closed truth |
| `src/lib/maker-score.ts` | +33 / −12; `m4MachineVerifiable` = dod's p6-verified probe exactly (`ok` + non-empty `detail` + hash); `lastTestEvidence` carries `detail`; header comment corrected |
| `src/lib/maker-score.test.ts` | +35; M4 parity tests + a live `p6BriefFitPasses`↔`briefFitSatisfied` differential |
| `fixes/341_5_governance.md` | this log (new) |

`src/lib/policy.ts` was read and audited in full; **no change was warranted** (see §3).

---

## 1. The forge path — resolution + RED/GREEN

### Decision: **derive the field from real project state (fail-closed)**, not delete.
`coerceFactoryClaim` has zero non-test callers, so deletion was permitted. I chose derivation because the
function is the module's documented *untrusted-blob coercion contract* and is pinned by the hostile-blob tests;
removing it would delete that contract. The fix narrows the input, never the bar: a genuine human-approved
record still closes the fixture term. I also closed the **sibling** hand-feed in `evidenceFromJobInventory`,
so no untrusted seam can mint the human conjunct any more.

### What changed (`doctor.ts`)

```ts
// evidenceFromJobInventory — the extra TYPE and the runtime read both drop the flag:
extra?: Omit<Partial<FactoryEvidence>, "productComplete" | "inventory" | "acceptance" | "humanFixtures"> & ProductStateEvidence,
…
humanFixtures: humanFixturesFromProject(extra?.project),      // was: extra?.humanFixtures === true || …
```
```ts
// coerceFactoryClaim — the blob's own flag is ignored:
humanFixtures: humanFixturesFromProject(project),             // was: blob.humanFixtures === true || …
```

`factoryClaim(evidence)` still reads the typed `FactoryEvidence.humanFixtures` — that is the latch's
*definition*, not an untrusted seam. The remaining blob fields (`leftoverJobsAreReexportsOrStubs`,
`realMultiJobProduct`) are census "field truth" a record-only coercion legitimately carries; they **cannot
mint the latch** because `humanFixtures` and `productComplete` are both derived, and the human term has no
blob path left (§probe below proves it).

### RED evidence (pre-fix bytes, both runtimes identical)
```
not ok 1 - coerceFactoryClaim: a hostile blob's humanFixtures:true cannot lift the latch without a real record
  error: expected: false  actual: true
not ok 2 - evidenceFromJobInventory: an untyped extra.humanFixtures is ignored; only the record derives the term
  error: expected: false  actual: true
# tests 133  # pass 130  # fail 3        (doctor + maker-score, host v24; v22 identical)
```
Independent probe PRE (`%TEMP%\rt341_5\probe1.ts`):
```
PROBE1 coerceFactoryClaim(forgeBlob, ov9Project): latch = true  | gaps = []
PROBE2 evidenceFromJobInventory(extra.humanFixtures:true): human = true | latch = true | gaps = []
```

### GREEN evidence (post-fix, both runtimes)
```
# tests 166  # pass 166  # fail 0  # skipped 0        doctor.test.ts + policy.test.ts + maker-score.test.ts
                                                      (host v24.15.0 AND pinned v22.23.2)
```
```
PROBE1 coerceFactoryClaim(forgeBlob, ov9Project): latch = false | gaps = ["no human-approved fixtures (decidedBy:\"human\")"]
PROBE2 evidenceFromJobInventory(extra.humanFixtures:true): human = false | latch = false | gaps = ["no human-approved fixtures (decidedBy:\"human\")"]
```
Controls in the same tests prove the bar is untouched: the SAME blob + a project whose own record carries
`{approval:"approved", decidedBy:"human"}` → `latch = true, gaps = []`, and the same for
`evidenceFromJobInventory`. No human stamp is minted anywhere; the module only reads.

The pre-existing OV-9 anti-goal test was updated (it had pinned the old blob-honoring behaviour as correct):
`coerceFactoryClaim(blob, ov9Project()).gaps` is now `[FACTORY_GAP.fixtures]` (not `[]`), and `[]` is reached
only with a project that genuinely carries the human-approved record.

---

## 2. Gap provenance — producer → evidence → consumer

Producers are in `gapsOf`/`productGapOf` (`doctor.ts`), fed by `evidenceFrom*`. The consumer is
`headless.doctorStatus` (`headless.ts:4887` `gaps: claim.gaps`), which the CLI `doctor` arm returns verbatim
(`scripts/rapidtool-cli.mjs:4625` `respond({ ok: true, ...status })`), pinned by `headless.test.ts:2868-2872`.
The new test `W55 · 341-5 — every factory gap has a byte-derived producer and is surfaced` proves each
constant is produced from scanned/derived bytes **and** rides the consumed `claim.gaps` string[].

| Gap constant | Byte-derived producer | Consumer |
|---|---|---|
| `FACTORY_GAP.leftover` | `gapsOf` when `evidence.leftoverJobsAreReexportsOrStubs !== false` — from `inventoryFromJobSources` over the scan, or fail-closed `true` on the record-only path | `claim.gaps` → headless → CLI `doctor` JSON |
| `FACTORY_GAP.fixtures` | `gapsOf` when `evidence.humanFixtures !== true` — `humanFixturesFromProject(project)` reads the record's approved rows + `decidedBy:"human"` + brief-hash staleness | same |
| `FACTORY_GAP.product` | `productGapOf` when the measured census is not exactly `stubs=0 ∧ reexports=0 ∧ real=1` (unmeasured / garbled / leftover all land here) | same |
| `FACTORY_GAP.singleJob` | `productGapOf` when the measured census IS exactly `0/0/1` (a real one-entry-module product; a breadth fact, not a stub fact) | same |
| `FACTORY_GAP.complete` | `gapsOf` when `evidence.productComplete !== true` — `productCompleteFromProject` → `archProductComplete(archTrace(project))` over the tree bytes | same |

**Orphans:** none. Every `FACTORY_GAP` value is reachable from a constructed byte state (proved by the test)
and every one is surfaced on the consumed `gaps[]`; `Object.values(FACTORY_GAP)` has no duplicate or unreachable
text (second test). The non-latch derived signal `FactoryEvidence.acceptance` is produced by
`liveAcceptanceState` and consumed by `factoryClaim`'s `awaitingHumanAcceptance` — not orphaned either.

**Minor (not a defect, not owned):** the inline fail-closed floor in `headless.ts:4835-4842` re-states four
gap strings as literals. If a `FACTORY_GAP` string is ever reworded, that floor drifts. It is a genuine
fail-closed floor (import-failure path), not a byte-derived producer — reported, not edited (headless.ts is
outside the box).

---

## 3. Policy / score honesty

### M4 — an overstated "p6-verified semantics" claim (found + fixed)
`maker-score.ts` claimed M4 was *"the p6-verified probe semantics, dod.ts"*, but the bytes checked only
`label === "tested"` + a non-empty `evidenceHash`. `dod.ts:693-703`'s `p6-verified` probe ALSO requires
`lt.ok === true` and a non-empty `lt.detail` (pinned by `dod.test.ts:90,95`). So a hollow
`{ok:false, detail:"x", label:"tested", evidenceHash:"h"}` scored M4=1 while the P6 gate refused it — two
stories about one record.
**Fix:** M4 now checks `label` + `ok===true` + non-empty `detail` + non-empty `evidenceHash`, exactly the probe;
the header comment and the function doc now state the full parity. The fail evidence names the missing
conjunct (`ok≠true` / `NO detail` / `NO evidenceHash`), never a vague miss.

RED (pre-fix): `not ok 6 - 341-5: M4 IS the dod p6-verified probe …` / `probe1` PRE `m4(ok:false,…) = 1`.
GREEN: `# pass 166 # fail 0`; `probe1` POST `m4(ok:false, tested, hash) = 0`.

### The inherited 0.35 bar parity — verified byte-true
All three sites compute `hits.length >= Math.max(1, Math.ceil(required.length * 0.35))` and return vacuous
`true`/`ok` on `required.length === 0`:
`dod.ts:736` · `codegen.server.ts:3318` · `maker-score.ts:296`.
A live differential `p6BriefFitPasses` ↔ `codegen.briefFitSatisfied` over k=0..20 (`probe1`, and a test)
reports **0 mismatches**; the existing boundary pins agree (`maker-score.test.ts` ceil(20·0.35)=7,
`codegen.server.test.ts:391`, `gates.test.ts:587`). Declared true; no strike needed.

### policy.ts — audited, no byte-truth overstatement
Read in full. Checked: PURE-LEAF (no imports/fs/clock/randomness/env; purity pinned by
`policy.test.ts:311`); TOTAL (malformed ctx denies — pinned); default-DENY registry; the reason contract
(every reason starts with a kebab id + " — "); `requiresHumanSeat` for `hitl.force` and `fixtures.approve`
with the per-action clause (byte-identical `hitl.force` clause pinned); narrow-only `applyPolicyOverlay`.
Every statement matches the bytes. **No edit.** (The routing claim in the header — W5 routed headless/CLI/
dod provenance through `evaluatePolicy` — is true on disk: `headless.ts:1423`, `rapidtool-cli.mjs:1609/2263/2830`,
`dod.ts:158`; the line anchors in that historical note have since drifted, which is stale provenance, not an
overstatement.)

---

## 4. Limits truth — human door + no-isolation boundary

Audited every surface that carries the factory claim or its limits; **nothing overstates**:

- **No isolation boundary:** `factory.isolation` is the coerced frozen claim (`sandbox:false`, `kind:"none"`,
  `note` = `RUNNER_IS_NOT_A_SANDBOX`), README §"honest limits" item 3 ("it is **not** a sandbox … Doctor says
  `sandbox: false`, and nothing may claim otherwise"), console.tsx:1512 ("bounded local runner — NOT a
  security sandbox") and :7385-7393 ("Isolation boundary · none — runs are bounded local, not OS-sandboxed").
  `runnerIsSandbox` is `false` by type and at runtime.
- **Human-acceptance door:** the `fixtures` gap names it (`no human-approved fixtures (decidedBy:"human")`),
  `awaitingHumanAcceptance` names it as the *sole* remaining reason when the machine half is complete, and
  both reach the operator through `doctor`'s JSON (`headless.ts:4881`). README's governance lines
  ("no machine path can mint `decidedBy:"human"`", "a human seat that requires an out-of-band token") match
  the policy seam. The machine door is stated, not hidden.
- **Factory latch:** README says the flag is false with named `gaps[]` and must not be claimed otherwise;
  `probe1` shows RapidTool-now-style record-only inputs stay `false`.

No claim was struck; none needed striking.

---

## 5. Cross-check of the 340 verifier logs

| 340 finding | Status |
|---|---|
| **Verifier B §1 hole:** `coerceFactoryClaim` honours a hand-fed `humanFixtures:true` (latent — zero non-test callers) | **FIXED** here, and the identical `extra.humanFixtures` sibling closed too. §1 |
| Verifier B §1 boundary: `acceptanceRecordIsStale` only fires when both `acceptanceBriefHash` and `brief` are strings | Unchanged pre-existing rule, shared by both readers; not an overstatement. Still present (not mine) |
| Verifier B stale comments: `engine.ts` "production prompt does not render `wildPlan`"; `quarantine.ts` "CLI no longer forwards the report" | **Verified corrected at the 340 boundary** — current bytes (`engine.ts:4352-4357`, `quarantine.ts:20-23`) now match behaviour |
| Verifier B spine residuals: `oracleSignatureFunctionNames` (exported, 0 call sites); `VerifyOutcome.lint` (produced, never read); `withCommonJsExports` under-cover; `import.meta` ESM → generic marker; `applyVerifyOutcome` accepts junk `cases` | **Still present, not fixed** — `verify.ts`/`verify.server.ts` are outside my ownership. These are exactly the "producer nothing consumes" class §2 names → reported (§8 R1) |
| Verifier A holes: MCP duplicate-id/trailing-garbage partial pass; cassette response-unbound/v1 | **Closed at the 340 boundary** per `fixes/340_0_parent.md` §3 (sticky `faulted`; `CASSETTE_VERSION` 2 + `responseHash` + provider family). Not mine; stated as closed per the boundary log |
| `340_0` §4 residuals: MCP not wired to a live consumer; console/store wild driver does not stage the plan review; `.t4scratch/` cleanup; declared limits stand | **Open, not mine.** Reported, no action |

No governance finding inside my three files remains open.

---

## 6. Mock / fake census (changed files)

`grep -i 'TODO|FIXME|XXX|@ts-ignore|@ts-expect-error|@ts-nocheck|as any|catch {}|placeholder|mock|fake|hardcod'`:
- `src/lib/doctor.ts` — 6 hits, all pre-existing and honest: the `TODO(E-15)` classifier regex/strings (a
  classifier INPUT) and one `placeholder` comment describing the keyless template. **No `as any`/`@ts-*`/silent
  catch/hardcoded return; nothing new.**
- `src/lib/doctor.test.ts` — new tests use `as never` twice and `as unknown as Project` once, the repo's
  established *hostile/untyped-caller* idiom (`doctor.test.ts:555` pre-existing), to prove a hand-fed value is
  IGNORED — the opposite of a fake computation. Every new test fails on pre-fix bytes.
- `src/lib/maker-score.ts` — 1 hit, pre-existing `TODO(E-15)` comment.
- `src/lib/maker-score.test.ts` — no new fake; the parity test calls the two REAL functions.
- `src/lib/policy.ts` — **0 hits; unchanged.**

---

## 7. Targeted suites + gates (both runtimes)

| Check | host v24.15.0 | pinned v22.23.2 |
|---|---|---|
| `doctor.test.ts` + `policy.test.ts` + `maker-score.test.ts` | **166 / 166 / 0** | **166 / 166 / 0** |
| `headless.test.ts` (the consumer of `claim.gaps`) | 153 / 153 / 0 | 153 / 153 / 0 (re-run; see note) |
| `npx tsc --noEmit` | exit 0 | — |
| `npx eslint` over the 5 changed files | exit 0, 0 warnings | — |

Baseline at open was 160 tests; +6 new (2 forge, 2 gap-provenance, 2 M4/parity) → 166.
**Note (honesty):** on the first `headless.test.ts` v22 run one packet-mint test failed
(`W50 · 336-2 — the minted record's own packet describes the mint`); it passes standalone on v22 and the whole
suite re-ran v22 **153/153**. It is a packet-path test whose module (`packet.ts`) was being edited by a sibling
lane at 04:08 (after my 04:01 edits) — a transient mid-edit artifact, not attributable to this lane's change
(my edits touch no packet/mint code). Recorded rather than smoothed over.

---

## 8. STOP-and-REPORT / what I did not do

**R1 — spine residuals (owner: the 340 spine / verify lane).** `oracleSignatureFunctionNames` (zero call
sites), `VerifyOutcome.lint` (produced, never read), `withCommonJsExports` under-covering `async`/generator
declarations, `applyVerifyOutcome` minting `tested` over a junk `cases` array. Exact shape: either consume the
producer or strip it, per the §2 producer/consumer rule. Not mine (`verify.ts`/`verify.server.ts`).

**R2 — README stale count (owner: docs).** `README.md:202` says `policy.ts (28 test blocks today)`; the file
carries **33** `it(` blocks today (and `policy-overlay.test.ts` is separate). An *undercount*, not an
overstatement — declare-or-strike would update the number. README is outside the box.

**R3 — headless inline floor duplication.** `headless.ts:4835-4842` re-states four `FACTORY_GAP` strings as
literals; a reword would drift from the constants. Recommend rendering the constants (the floor is otherwise
honest). Not mine.

**Did NOT:** delete `coerceFactoryClaim` (chose derive, §1); weaken any gate/latch (the fixture term still
requires a real human-approved record; `realMultiJobProduct`, the stub/reexport classifier, the p6-verified
M4 bar, and the 0.35 bar are all unchanged-or-stricter); mint or record any approval; touch `headless.ts`,
`policy.ts`, `verify*`, `packet*`, scripts, or docs; run the full gate (`gate.sh`); make keyed LLM calls.

**Workspace drift (observed, not mine):** the tree was clean at session start but `git status` now lists 13
modified files; 9 of them (`scripts/run-eval.mjs`, `src/components/console.tsx`, `src/lib/llm/providers/*`,
`src/lib/packet*`, `src/lib/verify*`) are other lanes' uncommitted edits (mtimes 04:08, after my 04:01). My
diff is exactly the four owned files (§0). The v22 headless blip traces to that concurrent state.

---

## 9. Honest verdict

**Works** for the assigned question, with named residuals. Every user-visible claim I own now matches the
bytes: the factory latch's human conjunct is neither blob-forgeable nor extra-forgeable (RED→GREEN on both
runtimes), every gap string has a byte-derived producer and a real consumer (tested), M4 is exactly the
p6-verified probe it claimed to be, the 0.35 bar is proven byte-parity across all three sites, policy.ts
overstates nothing, and the human door + no-isolation limit are stated honestly wherever the claim surfaces.
Typecheck and lint are 0. **Remaining:** the spine producer-without-consumer residuals and the stale README
policy-test count are outside my ownership (R1/R2); `coerceFactoryClaim` is now non-forgeable but still has
zero non-test callers (a deliberate derive-instead-of-delete choice, §1); and one v22 headless packet test
flaked against a sibling's mid-edit `packet.ts`, passing standalone and on re-run.
