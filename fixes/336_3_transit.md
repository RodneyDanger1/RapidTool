# W50 / 336-3 — "Transit" — the emitted product + the agent packet, wired and honest

**Lane:** 336-3, persona "Transit". **HEAD at open:** `fac37d4`, tree clean (only untracked
`wave_plans/W50/`). **Owned (STRICT):** `src/lib/scaffold.ts`, `src/lib/compile-check.server.ts`,
`src/lib/dod.ts`, `src/lib/packet.ts`, `src/lib/handoff.ts` + their `*.test.ts`; this log.
`codegen.server.ts` / `engine.ts` are 336-1's this wave — read-only for me.
**Runtime:** repo-pinned Node **22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node
**v24.15.0**; every suite on BOTH. **Scratch (outside the repo):** `%TEMP%\rt336_3\` — the repo gains
no probe file. Keyless throughout (0 of the allowed 1 keyed call); no full gate (five siblings editing);
no `npm run eval`; no secret printed.

> Note: PowerShell `Add-Content` dropped the non-ASCII glyphs (section signs, arrows) on the first
> append here, so this file was re-written once by the editor tool (same lane, same session, same
> content) to restore valid UTF-8. No history was lost; the only upstream logs read are untouched.

## 0. Step 0 — reconciliation (claimed / on disk / still open)

Read: `fixes/331_3_transit.md`, `fixes/332_3_transit.md`, `fixes/334_3_transit.md`,
`fixes/335_3_transit.md`, `fixes/335_0_parent.md`, `wave_plans/W50/README.md`,
`audit/01_core_engine_algorithms_audit.md`.

**Claimed (prior lanes):**
- 334-3: the emitted README LEADS with a declared-scripts-unverified banner; `p6-verified` requires an
  executed-green `tested` stamp; `dod.test.ts` created.
- 335-3: the packet renders the current-edge DoD exit criteria; `report_schema` states the seam's
  phase-match + caps; a red kind entry sets `outcome.error`; `cli-tool` declares `main`.
- 335-0 section 5: "R4/B-05 memory-empty phrase" carried forward as a same-class residual (my mission (c)).
- 332-3b F-4: `declaredScriptsVerified` / `unverifiedDeclaredScripts` / `unverifiedEntry` +
  `treeVerdictHash` folding; the mint evidence folds the declared-script state (`codegen.server.ts:4603`).

**On disk (verified by reading the bytes today):**
- `src/lib/engine.ts:1986-1989` — R4/B-05 ordering: `attachAlgorithms`, then `ready.memory =
  bootstrapMemory(...)`, then `ready.packet = compileAgentPacket(ready)`. **CONFIRMED.**
- `src/lib/packet.ts:971-972` — the phrase `"(empty - treat Phase 0 research as first write)"` renders
  iff `memoryRows.length === 0 && provenRows.length === 0`. **CONFIRMED.**
- `src/lib/codegen.server.ts:4659-4698` — `mintTreeRunTested` derives `lastTest` from the real
  `TreeRunOutcome` and early-returns on `ok !== true`. **CONFIRMED.**
- Baseline suites match the brief: `scaffold.test.ts` 51 · `dod.test.ts` 3 · `packet.test.ts` 69 ·
  `handoff.test.ts` 16 (139 combined on Node 22). `compile-check.server.test.ts` 81 (1 skip).

**Still open (file:line), actioned or reported below:**
1. `src/lib/packet.ts:972` — the memory-empty phrase issued an out-of-scope Phase-0 instruction from a
   render that can fire at any edge, and asserted a history the render cannot know. Mission (c). FIXED.
2. No prior lane proved the **emit -> tree-run -> DoD -> packet** chain identity end to end. Mission (a).
3. The emitted scaffold honesty audit (README/DEPLOY/package.json/configs + `tests/oracle.spec.ts`
   assertions that cannot fail). Mission (b).

## 1. Baseline (measured today, after siblings began editing)

| Suite (Node 22.23.2) | tests | pass | fail | skip |
|---|---|---|---|---|
| `scaffold.test.ts` | 51 | 51 | 0 | 0 |
| `compile-check.server.test.ts` | 81 | 80 | 0 | 1 |
| `dod.test.ts` | 3 | 3 | 0 | 0 |
| `packet.test.ts` | 69 | 69 | 0 | 0 |
| `handoff.test.ts` | 16 | 16 | 0 | 0 |

Counts match the brief exactly. `npx tsc --noEmit` = 0 diagnostics; `npx eslint` on my files = exit 0.

## 2. Mission (a) — the emit -> tree-run -> DoD -> packet chain (real path)

**Probe:** `%TEMP%\rt336_3\probe-chain.ts` + `probe-stale.ts` (keyless; only `deps.synthesize` is
injected — the documented P6 synthesis seam, unavoidable without a key). Everything else is the REAL
default: `driveP6Journey` -> `defaultP6RunTree` (real `emitProject` + real `compile-check.treeRun`) ->
real `mintTreeRunTested` -> real `recordGateInto` -> real `compileAgentPacket`.

**The real path (code-level):** `headless.ts:2703` `emitProject(project, dir)` then `:2727`
`cc.treeRun(dir)` use the SAME `dir`; the CLI ship path does the same (`rapidtool-cli.mjs:2085`
`cc.treeRun(res.dir)`). `treeRun` itself copies that dir to a scratch dir and runs the COPY
(`compile-check.server.ts:1549-1560`, skipping only `node_modules`/`.git`, junctioning the subject's
deps).

**Link 1 — the tree written is the tree smoke-tested: HOLDS.** The emitted dir contains the
synthesized tree file byte-verbatim (`readFileSync === TREE_SRC`), and `treeRun(workDir)` is green
over that byte content (its copy differs only by the two skipped dirs).

**Link 2 — the verdict the DoD reads is the verdict the tree-run produced: HOLDS (identity proven).**
`res.project.lastTest.evidenceHash` (`2779769080`) == `String(fnv1a(treeRunTestedEvidence(treeRun(workDir)).summary))`
recomputed independently after the journey. `p6-verified` is satisfied from that stamp. Named limit
(as documented): `p6-verified` reads a deterministic SUMMARY of the verdict (spec paths + counts +
declared-script state), not `treeVerdictHash` and not the artifact bytes; the gate `evidenceHash` is
a separate verdict-vector fingerprint that cannot attest content.

**Link 3 — the packet describes that tree: FAILS (the wave's mismatch class).** The project's OWN
`packet` field is STALE after the mint. Probe diff (13968 B stale vs 13953 B fresh):

```
only in the STALE project.packet:      P6 template self-test (last run): pass - tests.pass
only in the FRESH compile of the same: P6 self-test (machine-verified) (last run): pass - tree-run green:
                                       compile 8/8 ... 1 assertion(s) ... evidence 2779769080
                                       ### P6 - DoD gate - P6 / **Result: FAIL**
```

Root cause: `mintTreeRunTested` (`codegen.server.ts:4669-4698`) and `recordGateInto` (`dod.ts:918`)
both return a project with new `lastTest`/gate/artifact state but NEVER recompile `project.packet`;
`driveP6Journey`, `store.runP6Journey` (`store.ts:1184-1196`) and `promoteEmittedTreeTested`
(`headless.ts:2780-2789`) all commit/propagate the result unchanged. `promoteEmittedTreeTested`
writes `exportProjectJson(minted)` into the emitted dir's `.rapidtool/project.json`, so the shipped
artifact's own "full exported project (packet, ...)" carries a packet that does not contain the
`evidenceHash` of the `tested` verdict written beside it (probe: `promoted=true`, record
`lastTest.evidenceHash=1206256284`, record packet does NOT contain that string). The CLI `emit --run`
then also `saveProject`s that stale-packet project to the ledger. STOP-and-REPORT (section 7).

**Secondary asymmetry (named, not changed):** `treeRun` verifies the COPY (`work`) for
compile/specs/entry/behavior/project-scripts but computes `outcome.substance` over the SUBJECT
(`compile-check.server.ts:1733`). In practice identical (the copy skips only node_modules/.git), and
the subject is deliberate for parity with `doctor --tree`; documented as a named limit, not a defect
observed on any probe.

## 3. Mission (b) — the emitted scaffold's honesty

Probe: `%TEMP%\rt336_3\probe-emit.ts` emits 6 real trees (drained 13-phase, fresh, kind app/game/tool,
P0-P2) via the REAL `scaffoldProject`; bytes read at `%TEMP%\rt336_3\emit-out\**`.

**FIX 1 (landed) — `DEPLOY.md` over-claimed what the emitted oracle spec carries.**
- With a NOT IMPLEMENTED row (fresh/kind-*/p0-p2 emissions), the README census says
  "2 of 3 pinned row(s) assert ...; 1 are NOT IMPLEMENTED", the spec emits
  `test.skip("orc-phase - NOT IMPLEMENTED")`, but `DEPLOY.md` section Test said unconditionally
  "...are REAL assertions ... - no todo stubs." A claim the bytes in the same tree did not satisfy.
- With ZERO oracle rows, `packageJson` DELETES the `test` script (`hasTests=false`) yet `DEPLOY.md`
  section Test still said `npm test`. Reproduced: `scripts={dev,build,preview,typecheck}` and DEPLOY says
  `npm test` + "REAL assertions".
- Fix (`scaffold.ts` `deployNotes`): optional `census` param (scaffoldProject passes the very
  `oracleCensus` object it rendered for the README); the Test section is now derived — no rows => the
  honest "no `test` script" note; NOT IMPLEMENTED rows => the census caveat naming the skips. Clean-row
  emissions (census.notImplemented = 0) keep byte-identical DEPLOY.md.
- RED-first: forcing the pre-fix branch (`hasOracleRows=true; notImplemented=0`) => the 2 new tests
  `# tests 2 / pass 0 / fail 2`; restored => 2/2 green (Node 22 and 24).

**Audited clean (no change):** README declared-scripts banner (334-3) matches the emitted package.json;
`package.json` entry fields name only files the emitter writes (fonts of the 335-3 `cli-tool` `main`
fix hold); `.env.example` is PLACEHOLDER-only with no real secret; `.gitignore` names only
install/build/verify residue; `tsconfig.json` `noEmit` satisfies `allowImportingTsExtensions`; the
emitted spec contains NO `assert.ok(true)`/`length >= 0` tautology (the pre-216b class was removed) and
every live assertion is failable (verified by reading every emitted spec). Game `assets/manifest.json`
is labelled NOT engine-generated; `src/ui/` is labelled a contract-level shell.

**Named residuals (reported, not fixed — churn vs the pinned baseline):**
- `packageJson`/README/DEPLOY say "Node >= 22", but the declared scripts run
  `--experimental-strip-types` (available from 22.6.0) — the floor is over-broad for 22.0-22.5.
- webapp `devDependencies` declare `@tailwindcss/vite` + `tailwindcss`; no emitted file imports,
  configures or uses them (`vite.config.ts` plugins = `[react()]` only) — unwired devDeps.

## 4. Mission (b, second half) — assertions that cannot fail (the `await` fix's siblings)

Scanned every emitted spec for the class. Findings:
- The 331 `await` fix is present (`await (jobMod[first])(...)`) — no floating promise remains.
- `tree-job` probe legs still `catch (e) { if (e instanceof ReferenceError) throw e; }`: a non-Reference
  throw from the called function is swallowed and does NOT fail the row. It is documented as a
  "guarded probe" whose real assertions are `names.length > 0` + every-export-is-a-function, and a job
  function may legitimately reject bad input. Named as the closest surviving sibling; NOT changed
  (changing it would red honest trees whose jobs validate input).
- No other cannot-fail assertion found (the capability-presence rows, store/api/endpoints rows, the
  TODO(E-15) reject rows and the tree-entry `Object.keys().length > 0` row are all failable).

## 5. Mission (c) — the memory-empty phrase: the phrase is wrong, not the pin

**Decision.** R4 (register row, `agentnotes.md:4185`) pins only the ENGINE ORDERING — "emptyProject:
memory bootstrapped before packet compile" (done-when: "fresh packet lists 3 boot rows"). On disk
that ordering is correct (`engine.ts:1986-1989`). R4 never pins the fallback's WORDING, so 335-3's
"a named pinned contract" was a misreading: **the pin is right; the phrase is wrong.**

**Why the phrase is wrong** (`packet.ts:971-972`): "(empty - treat Phase 0 research as first write)"
fires whenever `project.memory` is the empty array, at ANY edge, and (i) issues an out-of-scope
Phase-0 instruction when the current edge is > 0 — the same class as the 335-3 Scorecard fix; (ii)
asserts a history the render cannot know (a payload stripped after P0 completed renders the same
sentence). Fix: at P0 the pointer is in scope and stays; past P0 the render states the observable fact
`(empty - no memory rows are recorded for this project)`. RED-first: forcing the pre-fix text => the
new P4 test `# tests 2 / pass 1 / fail 1`; restored => 2/2 green (both runtimes).

## 6. Mock/fake census

**Owned source** (`scaffold.ts`, `compile-check.server.ts`, `dod.ts`, `packet.ts`, `handoff.ts`):
- `as any` = 0 · `@ts-ignore`/`@ts-expect-error` = 0 · `eslint-disable` = 0 · empty `catch {}` = 0.
- Every `stub`/`placeholder`/`mock` hit is the documented contract or machinery that DETECTS stubs
  (`isStubSource`, `treeSubstanceOf`, the `mocked:true` verify-kind install seam marked "never evidence
  of a real one", `emitJobStub`'s declared TODO(E-15) refusal). No fabricated computation, no
  hardcoded result, no silent swallow.

**Emitted scaffold** (`emit-out/**`, 6 real trees): every hit is the honest `TODO(E-15)` coded-refusal
contract (or the same-family `TODO(R3-f06)` entries) — `mock`/`fake`/`as any`/`@ts-ignore` = 0. The
README declares the contract and the oracle spec asserts the refusals. **Clean census.**

## 7. STOP-and-REPORT (no owned file to patch)

1. **Stale packet after the P6 mint** (section 2, Link 3). Owners: `codegen.server.ts:4659` (336-1)
   and/or `headless.ts` `driveP6Journey`/`promoteEmittedTreeTested` (336-2) and/or `store.ts:1184`
   (336-5). Suggested minimal shape: recompile (`engine.stampPacket`) after `mintTreeRunTested` / the
   gate record on every path that returns or persists the project (journey, store commit, promotion write).
2. **An already-`tested` project never re-mints on a fresh tree-run** — `mintTreeRunTested` early-returns
   when `lastTest.label === "tested"`, so a CLI `emit --run` over an edited tree reports the NEW verdict
   in its envelope but leaves the record's `evidenceHash` from the OLD tree; a re-run DoD then reads the
   old verdict. Documented as intentional ("real verify evidence outranks"), but it is the same
   different-artifact class — owner 336-1 to confirm or scope the hash.
3. **`packet.test.ts` T-14 was red from a SIBLING edit** — 336-1 (logged) added a P12 PostgreSQL schema
   deliverable and excluded kind `"gate"` rows in `phaseCoverage` (`phases.ts` +45, `engine.ts` +68,
   `codegen.server.ts` +12); the completed-run rail moved 8 -> 9 artifacts. 336-1's log section 9
   explicitly handed the two pins to me (packet.test.ts owner). **RECONCILED in my file** — see the
   Addendum. The same 8->9 pin in the **unowned** `src/lib/gates.test.ts:428` remains for the parent.
4. **`treeRun`/`substance` subject-vs-copy asymmetry** (section 2) — named, not changed.

## 8. Tests added + real results (both runtimes)

| Test | File | Node 22.23.2 | Node 24.15.0 |
|---|---|---|---|
| W50/336-3: a NOT IMPLEMENTED oracle row makes DEPLOY.md carry the census | `scaffold.test.ts` | pass | pass |
| W50/336-3: no oracle rows => DEPLOY.md never says `npm test` | `scaffold.test.ts` | pass | pass |
| W50/336-3: past P0 the memory-empty placeholder is state-only | `packet.test.ts` | pass | pass |
| W50/336-3: the P0 memory-empty placeholder is unchanged (R4/B-05 pins the ordering, not the text) | `packet.test.ts` | pass | pass |

| Suite | Node 22 | Node 24 |
|---|---|---|
| `scaffold.test.ts` (baseline 51) | **53 / 53 / 0** | 53 / 53 / 0 |
| `packet.test.ts` (baseline 69) | **71 / 71 / 0** | 71 / 71 / 0 |
| `dod.test.ts` | 3 / 3 / 0 | 3 / 3 / 0 |
| `handoff.test.ts` | 16 / 16 / 0 | 16 / 16 / 0 |
| `compile-check.server.test.ts` (unchanged, re-run for the record) | **81 / 80 / 0 / 1 skip** | — |
| combined fast owned (scaffold+packet+dod+handoff) | **143 / 143 / 0** | 143 / 143 / 0 |

`npx eslint` on the 4 changed files = exit 0; `npx tsc --noEmit` = 0 diagnostics.

## 9. RED-first teeth (each reverted in place, run, restored)

- packet: pre-fix text forced (`"(RED-FIRST PROBE...)"`) => the P4 test `# tests 2 / pass 1 / fail 1`
  (the P0-unchanged control stayed green); restored, byte-identical.
- scaffold: pre-fix branch forced (`hasOracleRows=true; notImplemented=0`) => the 2 DEPLOY tests
  `# tests 2 / pass 0 / fail 2`; restored, byte-identical.

## 10. What I did NOT do and why

- Did not touch `codegen.server.ts` / `engine.ts` (336-1), `headless.ts` (336-2), `store.ts` (336-5),
  the CLI (336-4) or any unowned file; the section-7 defects live there and are reported with probes.
- Did not rewrite the census ARITHMETIC (336-1's) — only consumed its logged 8->9 outcome in my own pin.
- Did not change the Node engine floor or the unwired tailwind devDeps (section 3 residuals): both are
  broader than an honesty patch and churn pinned scaffold bytes; reported instead.
- Did not change the `tree-job` guarded-probe catch (section 4) — it is the documented line, recorded as
  the nearest sibling.
- No keyed call at all (0 of the allowed 1); no `npm run eval`; no full gate (siblings mid-edit);
  no secret printed; scratch outside the repo (`%TEMP%\rt336_3\`); the repo gained only the 4 owned
  source/test edits and this log.

---

# Addendum — 336-1's census hand-off reconciled

336-1's log (`fixes/336_1_prompter.md` section 9) landed its P12 PostgreSQL schema producer + the
`phaseCoverage` bookkeeping-row exclusion and explicitly handed the two census pins to me (packet.test.ts
owner). Reconciled minimally in MY file, `src/lib/packet.test.ts` (T-14):
- docblock "13 of 13 / 8 tail artifacts" -> 9, and the exclusion wording now names BOTH bookkeeping kinds
  ("packet" and each phase's recorded "gate" row) per the new `phaseCoverage` rule;
- test title + rail assertion "/ 8 artifacts" -> "/ 9 artifacts";
- the independent recount now mirrors the helper's documented exclusions (`kind !== "packet" && kind !== "gate"`)
  and asserts 9;
- the System JSON `phase_coverage.artifacts_from_p7_p12` 8 -> 9.

Measured (Node 22 and Node 24, real): `packet.test.ts` **71 / 71 / 0**; owned fast suites
(scaffold+packet+dod+handoff) **143 / 143 / 0** on BOTH runtimes. `readFileSync`-verified rail line:
"Phase coverage: 13 of 13 phases executed / 9 artifacts from P7-P12 ...". So section 7.3 is CLOSED *in
my file*; the same 8->9 pin in the **unowned** `src/lib/gates.test.ts:428` remains for the parent
(336-1's own STOP item, not mine to touch). Section 8's earlier "1 fail" line is superseded by this
addendum.

This edit is a consumer-side reconciliation of a LOGGED, landed sibling contract, not a rewrite of the
census arithmetic (which stays 336-1's). No other owned file changed; red-first teeth for my two fixes
(section 9) are unaffected.

---

# Follow-up (336-3b) - the artifact-truncation budget was length-sensitive to volatile fields

Read `fixes/336_2_ledger.md` follow-up first (F3-F8): 336-2 landed the packet-refresh on mint
(`mintTreeRunTested` now recompiles the packet; an already-`tested` project refreshes on a hash change)
and handed me the root cause it found in my file - `compileAgentPacket`'s artifact-truncation budget,
measured against the rendered text, moved its cut when the volatile `compiled_at`/`input_hash` WIDTH
changed. It reconciled only its consumer test (`headless.test.ts` W-02, comparing a volatile-masked
packet head). The root is fixed here. I did not disturb its `headless.ts`/`codegen.server.ts` work.

## G1. Reproduction (probe OUTSIDE the repo: `%TEMP%\rt336_3b\probe-w02.ts`)

The probe drives the exact failing path (drain -> rewind to P6 -> `runP6Edge` and `runPhase(.,6)`,
the same two compiles W-02 compares), then masks `compiled_at`/`input_hash` and compares the FULL
packet. PRE-FIX (fix reverted in place), three runs of 20 pairs:

    run 1: N=20 masked-unequal=5  both-truncated=20 provenance-present=20 over-budget=0
    run 2: N=20 masked-unequal=10 both-truncated=20 provenance-present=20 over-budget=0
    run 3: N=20 masked-unequal=9  both-truncated=20 provenance-present=20 over-budget=0

Masked divergence (one sample): the two compiles kept a DIFFERENT number of content lines - A survived
`All criteria met for phase 12.`, B dropped it (a whole block) - and the raw lengths differed 13999 vs
13969. So the surviving rows were not a function of stable state. 0 of these are stable-content
differences: after masking, the two runs' stable content is identical.

## G2. The fix - the budget decides on a volatile-length-NORMALIZED copy

`src/lib/packet.ts` `truncateToBudget`: the DECISION (which "\n\n" boundary fits, how many lines
survive) is now taken on `maskVolatileLengths(assembled)`; the emitted bytes are the REAL lines at the
same line indices. `maskVolatileLengths` masks ONLY the exact rendered volatile shapes -
`"compiled_at": "<24-char ISO>"`, the `compiled_at: <24-char ISO>` header line, and
`"input_hash": "<1-10 digits>"` - to fixed-width masks (ISO 24, fnv1a decimal ceiling 10). Because
every mask is at least as wide as the real span, the normalized copy is never shorter than the real
one, so the existing "result never exceeds the budget" invariant holds by construction (probe:
over-budget=0 across 60 compiles). Masks contain no newline, so line index k names the same line in
both copies - the mapping is exact and the volatile values stay verbatim in the output:
- `compiled_at` and `input_hash` are NOT removed and NOT reformatted (provenance intact; probe:
  provenance-present=20/20);
- the TRUNCATED marker still renders (probe: both-truncated=20/20) - the elision stays honest;
- an UNDER-budget packet never calls this function, so it is byte-identical to before.

Honest named limit: the mask targets the exact current render shapes (ISO 24 / 1-10 digits). If a
future change alters those shapes, the mask stops matching and the old budget behaviour returns -
the coupling is stated in the helper's docblock.

POST-FIX, same probe (three runs of 20):

    run 1: N=20 masked-unequal=0 both-truncated=20 provenance-present=20 over-budget=0
    run 2: N=20 masked-unequal=0 both-truncated=20 provenance-present=20 over-budget=0
    run 3: N=20 masked-unequal=0 both-truncated=20 provenance-present=20 over-budget=0

## G3. Why no new in-repo unit test

The trigger is STRUCTURE-sensitive: I could not reduce it to a deterministic single-project fixture.
A controlled volatile-only difference (two log ts values whose `input_hash` widths are 9 vs 10, with
the packet padded over 14000) was swept by hand - `%TEMP%\rt336_3b\probe-synth.ts`, `probe-synth2.ts`,
`probe-ts.ts`, `probe-red.ts`: pad body 1..6000 x 1..6 artifacts x 3 ts pairs - and the pre-fix cut did
NOT flip in any of them (the chosen "\n\n" boundary sat far enough below `budget` that a 1-char shift
did not cross it). The defect only surfaced through the real two-run journey (the runs' own wall-clock
logs push the packet over 14000 and place a boundary at the edge). A test built on the two-run path
would be RED only ~37% of the time pre-fix, i.e. a flaky guard. So the RED-first artefact is the probe
(above), and the durable guard is the suite that caught it - `headless.test.ts` W-02 - which is now
stable. This is a measurement, not a preference; the fix itself is proven by the probe both ways.

## G4. Results (Node 22.23.2 and host Node 24.15.0)

| suite | count | Node 22 | Node 24 |
|---|---|---|---|
| `packet.test.ts` (baseline 71) | **71** | 71 / 0 | 71 / 0 |
| `headless.test.ts` (baseline 141) | **141** | 141 / 0 (5 runs) | 141 / 0 (2 runs) |
| `gates.test.ts` | 88 | 88 / 0 | 88 / 0 |
| `emitted-honesty.test.ts` | 5 | 5 / 0 | 5 / 0 |
| `dod.test.ts` | 3 | 3 / 0 | 3 / 0 |
| `handoff.test.ts` | 16 | 16 / 0 | 16 / 0 |
| packet-adjacent consumers (store, io, honesty-guards, maker-score, sweep73-fuzz, wild-step, patch-preservation) | 329 | 329 / 0 | - |

`headless.test.ts` stability post-fix: Node 22 5/5 green, Node 24 2/2 green (each a fresh process, so
the wall-clock varies run to run). `npx eslint src/lib/packet.ts` exit 0; `npx tsc --noEmit` 0
diagnostics.

## G5. Did NOT do

- Did not touch `headless.ts` / `codegen.server.ts` (336-2's landed refresh fix) or any unowned file;
  the change is `src/lib/packet.ts` only.
- Did not remove or reformat `compiled_at` / `input_hash` (the mission's constraint) and did not touch
  `PACKET_VERSION`, `packetInputHash`, `runGate`, or any DoD semantics.
- Did not add an in-repo test that cannot reliably fail (G3); no full gate, no `npm run eval`, no keyed
  call, no secret, no deletion; scratch outside the repo (`%TEMP%\rt336_3b\`).
