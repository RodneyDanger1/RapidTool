# 355_1 — lane `reviewer-pipeline` · engine & pipeline control plane (code review 1 of 3)

**Wave:** W355 (audit/freeze). **Kind:** read-only review. **Author:** lane `reviewer-pipeline`.
**Tree reviewed:** HEAD `30bce78` **+ the uncommitted "354 wave"** (98 modified / 32 untracked files).
Read-only: no product file, doc, or another lane's report was edited. Nothing was committed, stashed,
checked out, or cleaned. `npm test`, `npm run build` and `scripts/gate.sh` were **not** run.
**Bytes win:** every claim below is re-derived from the file or command named beside it; where a doc
disagrees with the bytes I say so and cite the doc.

---

## 1. Method — the exact commands run

All from `cd "C:\Users\mnril\Desktop\RapidTool Main"` (PowerShell 5.1, Node v24.15.0).

| # | Command | Purpose / result |
|---|---|---|
| M1 | `npx tsc --noEmit` | **Fails**: 5 errors in 3 test files (see F-16). |
| M2 | `node --experimental-strip-types --test --test-reporter=tap src/lib/phases.test.ts src/lib/policy.test.ts src/lib/watchdog.test.ts` | `# tests 87 · # pass 87 · # fail 0` |
| M3 | `node --experimental-strip-types --test --test-reporter=tap src/lib/dod.test.ts` | `# tests 65 · # pass 65 · # fail 0` |
| M4 | `node --experimental-strip-types --test --test-reporter=tap src/lib/engine.test.ts src/lib/wild-step.test.ts src/lib/wild-seal.test.ts` | `# tests 146 · # pass 145 · # fail 1` — `not ok 47 BUG-5 park surface budget 600 + ellipsis (fixes/320)` (wild-step.test.ts:1257). |
| M5 | `node --experimental-strip-types --test --test-reporter=tap src/lib/headless.test.ts` | `# tests 209 · # pass 205 · # fail 4` — `not ok 30 E-25 …`, `not ok 48 landEmittedTree …`, `not ok 55 W352 R2-01 …`. |
| M6 | `node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="E-25" src/lib/headless.test.ts` | Isolated the E-25 failure: subtest 19 `doctor --project …` → exit 1. |
| M7 | `node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="landEmittedTree\|W352 R2-01" …` | Isolated the other three (temp log `%TEMP%\rt_headless_sel.txt`). |
| M8 | Inline probes via `$script \| node --experimental-strip-types --input-type=module` (`await import("file:///…/src/lib/headless.ts")` etc.) | (a) emit + `treeRun` of a fresh floor project; (b) `emitProject` below-floor default vs explicit `refuse`; (c) headless console-seat approval; (d) forced untagged console approval → `runGate(p,4)`; (e) stuck red-gate P7 recovery doors; (f) `stageWildPlan` park twice. Outputs quoted inline below. |
| M9 | `git status --short -- <paths>`, `git diff -- <file>`, `git show HEAD:<file>` | Read-only: separated HEAD bytes from the uncommitted 354 edits (causality). |
| M10 | `Select-String`, `Get-Content` (no grep/head/tail on this shell) | Source reads; `console.tsx`, `rapidtool-cli.mjs`, `scaffold.ts` spot-reads (cited, not re-reviewed). |

---

## 2. Findings

Every row cites `file:line` **and** the command/read that produced it.
Severity: **P0** = broken/dishonest behaviour reachable in normal use · **P1** = a documented door or
claim that does not hold · **P2** = control-plane integrity/coherence · **P3** = hygiene/drift.

### 2.0 Answers to the eight questions (short form; detail in the rows)

1. **Gate integrity** — `keepBestTree` *does* recompute the P6 gate over the persisted tree
   (headless.ts:3845-3865, sound), but it grafts only `generatedTree`: the recomputed `p6-verified`
   criterion is still judged by the **last cycle's** `lastTest` (**F-09**). `sealedWithFailures` has two
   different definitions on the same run (**F-08**). `evidenceClass` never overclaims (sound; §3.3).
2. **Seat provenance** — **yes**, a machine path mints `decidedBy:"human"`: the `console` seat is
   claimable from any Node process with no token/TTY (**F-06**), and a forced console approval lands
   **untagged**, which `dod.policyConsistentApproval` accepts without ever reading its `decidedVia`
   (**F-07**). `headless.reject`/CLI pass an explicit seat, but `rejectHitl`'s default is `"human"`
   (**F-10**). CLI/console/machine seats *are* distinguishable on a *standard* approval
   (`[seat …]` tag + `decidedVia.label/tokenPath`) — sound (§3.5).
3. **Phase edges** — `canEnter` is gate-blind and id-exact; the P6→P7 guard is `priorsSealed` +
   `canEnter` only, and the advisory/`enforceDod` split is implemented consistently in
   `advanceOnce`/`wildLeavePhase` (sound, §3.2). P7–P12 stay `locked` only on an `enforceDod` run
   blocked at P6, and the surfaces that misdescribed that park were corrected in this wave (A4-E1) —
   but the corrected park is now **unrecoverable through the CLI** (**F-05**).
4. **`forceHuman` class** — see §2.4 below (3 mint sites; do not remove).
5. **The wild loop** — `stageWildPlan`, `wildStep` and the console driver agree on `pause`/`park`
   mechanics, but the **plan park** advertises an approve/reject door that exists on no surface and
   re-parks on resume (**F-04**), and the hard-DoD/red-gate park is a dead end (**F-05**). Those two
   are the "silently unrecoverable" answers.
6. **The driver** — RUNLOCK (rapidtool-cli.mjs:1143-1165, 1765-1790), the no-progress guard
   (:1213-1236, :1837-1865) and the outcome stamp are coherent and ordered; the step cap is the weak
   seam: `outcome:"cap"` is only reachable at `steps === 0`, so a run that burns the whole iteration
   bound *with* progress reports `progress` + exit 0 and carries no `capped` flag (**F-11**). The two
   outcome mappers have drifted (**F-12**).
7. **Error discipline** — the main driver paths are coded (`RT_E_BUSY`, `RT_E_SRC_EDITED_DURING_RUN`,
   `RT_E_GATES_FAILED`, `RT_E_GATE_PENDING`, `RT_E_TREE_RUN_FAILED`) — sound. Named swallows:
   `driveP6Journey`'s synthesize catch (headless.ts:4050-4057 — events string only, no code, no ledger
   row), `verifyEmittedDirBeforeCommit`'s silent skip (headless.ts:3032-3034), `wildDodRepairOnce`'s
   dropped failure class (engine.ts:5277-5283) — **F-13**, **F-14**.
8. **Tests** — the engine/wild/dod/phases tests pass (M2, M3); the **failing** ones are named in
   M4/M5 and F-01/F-02/F-16. Specific unpinned cases: the explicit `underProduced:"refuse"` value
   (F-01), the `doctor --project` call the pre-existing E-25 test does pin (F-03 — pinned and red),
   `retry` on a completed non-P6 red-gate phase (F-05), the plan park's unlock door (F-04), and the
   `lastTest`-vs-grafted-tree pairing (F-09).

### 2.1 Findings table

| id | sev | title | file:line | evidence (command / read) | why it matters |
|---|---|---|---|---|---|
| **F-01** | **P0** | `emitProject`'s `underProduced:"refuse"` is **inert** — a below-floor partial materializes on the default *and* on the explicitly-refusing path | `src/lib/headless.ts:2824`, `:2834`, `:2838`; `src/lib/scaffold.ts:8535-8536` | M8(b): `emitProject(p, dir)` → `DEFAULT ok=true · dir exists=true · files=13`; `emitProject(p, dir, {underProduced:"refuse"})` → `EXPLICIT-REFUSE ok=true · dir exists=true` (p = `createProject` + `generatedSource` + a final `p6.synthesis.refused` carrying `RT_E_PLAN_UNDERPRODUCED`). New test disagrees the same way: M7 `W352 R2-01 …` → `true !== false` (headless.test.ts:5898). `headless.ts:2838` passes `undefined` unless the policy is `"banner"`, and `scaffold.ts:8535` now defaults `"partial"` (354 A2-F4/D1). | The documented/CLI-documented below-floor refusal (`RT_E_PLAN_UNDERPRODUCED`, "raised at scaffold time before any flag is read" — `rapidtool-cli.mjs:6140` emit help) no longer fires. A partial below-floor tree ships where the caller asked for a refusal; `--allow-empty`'s documented "does NOT lift the SEPARATE below-floor refusal" is now vacuous. |
| **F-02** | **P0** | Every unwired oracle row is emitted as a hard `assert.fail`, so a fresh keyless tree can never pass its own `npm test` → `emit --run` / `--git` / `landEmittedTree` are structurally red | `src/lib/scaffold.ts:6374` (+ `:6360-6375`) | M8(a): `EMIT ok=true` then `TREERUN ok=false · bad=[{file:"tests/oracle.spec.ts", run:"fail"}]`; the emitted spec text (read from the probe dir) ends with `assert.fail("orc-phase is NOT IMPLEMENTED — replace this failing row with the row's real acceptance assertion")`. M5/M7: `not ok 48 landEmittedTree — real emitted tree → committed delivery` → **2 subtests fail**, error `git delivery refused: the emitted tree did not re-verify green immediately before the commit (… npm run test fail (exit 1))` (headless.test.ts:5411/5423, :5454/5466). Causality (M9): the 354 diff replaces HEAD's `emitSkip ? test.skip(…) : assert.fail(…)` with an unconditional `assert.fail`; the wave's own new test documents it (`src/lib/scaffold.test.ts:2599-2620`: "The pre-354 ratio gate … let that row emit `test.skip("orc-phase — NOT IMPLEMENTED")` so `npm test` exited 0 … It must now be a real failing test"); `headless.test.ts` has **no diff hunks** in the landEmittedTree suite (5398-5480), so that suite passed at HEAD. | The delivery-verification loop the repo sells (`emit --run`, `emit --git`, `factory-watch`'s "treeRun.ok === true before emit --git") can never be green on the keyless floor, and two pre-existing repo tests are red. `AGENTS.md:160-163` ("A fresh `emit --run` … reports `declaredScriptsVerified: true` and exits 0") is now false for that state. The honesty intent (an unwired row must not read green) may be right, but it is unreconciled with the delivery contract, the docs, and the suite. |
| **F-03** | **P0** | `doctor --project <file>` is refused as an unknown flag although the doctor arm consumes it | `scripts/rapidtool-cli.mjs:275-285` (`refuseVerbFlag`), `:259-269` (`acceptedFlagsFor` from the verb's synopsis), `:5731` (`projectPath: CLI_PROJECT`), `:1418` (`CLI_PROJECT = args.project`) | M6: `not ok 19 … doctor --project derives productComplete/humanFixtures …` → envelope `{"cmd":"doctor","ok":false,"error":"doctor: --project is not a flag \`doctor\` accepts — it is documented for a different verb…","code":"RT_E_VALIDATION","exit_code":1}` → `1 !== 0` (headless.test.ts:3796). Live: `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --project <path>` → exit 1. Read: the `doctor` synopsis (511 chars) does **not** contain `--project`, while `diagnose`'s does (M10 `Select-String '^\s*doctor: "'`). | A real, already-implemented cross-verb flag is now refused before dispatch: the per-verb allow-list was derived from a synopsis that omits it. The feature (338-3 doctor-on-a-record) is unreachable from the CLI and a pre-existing test is red. Same class for any future verb whose arm reads `CLI_PROJECT` without documenting `--project`. |
| **F-04** | **P1** | The plan park advertises "A human must approve or reject the open gate (console/CLI)" while minting **no** gate, and no surface can approve a plan — a resume re-parks | `src/lib/engine.ts:5616-5624` (park), `:5549-5572` (verdict-keyed re-park), `:5525-5531`; consumers: `src/lib/store.ts:1918`, `src/lib/headless.ts:6758`, `:7003` | M8(f): `stageWildPlan(p, null, {agentSeal:true})` → `FIRST staged=true pause=true · park={"code":"RT_E_GATE_PENDING","unlock":"human-gate","unlockText":"A human must approve or reject the open gate (console/CLI), then resume the run."} · hitl=null · status=intake`; after clearing `pause` (the human resume) → `SECOND staged=true pause=true park.unlock=human-gate`. CLI `approve` requires `status==="awaiting_hitl" && hitl` (`rapidtool-cli.mjs:2082-2098`) → refuses. The console only *renders* the plan (`src/components/console.tsx:7800-7875`, read-only card). `engine.ts:5522` names `headless.planReviewApproved` — `Select-String` over `src/lib/*.ts` + `scripts/rapidtool-cli.mjs` finds that identifier **only in that comment**: the driver-side reader it promises does not exist. | This is the exact defect class the repo already fixed twice (GAP-1 review park, 320_g1b; A4-E1 hard-DoD park → `human-retry`). It survives for the plan park: a keyless/unconfigured (or rejecting) classifier parks the console run with a promise no door keeps, and a resume re-parks forever. Only a new approving classifier verdict (or hand-editing logs) escapes. |
| **F-05** | **P1** | A red DoD gate on a **completed non-P6** phase parks with `unlock:"human-retry"` ("fix, regenerate or retry"), but *every* CLI door refuses — the park is unrecoverable without editing the record | `src/lib/engine.ts:6060-6089` (the leave-park), `:2390` (`unlockRetry` needs `rejected` + `blocked`), `src/lib/headless.ts:1989-1998` (`recoverRedRunningP6` is P6-only), `src/lib/headless.ts:2171-2180` (`nextAction` → `fix-gate`/`cmd:"gate"`); `scripts/rapidtool-cli.mjs:2372-2392` (retry guard) | M8(e): a `running` project, P0–P6 complete, P7 complete with `gate.passed:false`, `enforceDod:true` → `isRedRunningP6=false · retry is a no-op: true · nextAction={"kind":"fix-gate","cmd":"gate","phase":7}`. Live CLI on that record: `retry` → exit 1 `RT_E_PHASE_ILLEGAL · "Nothing to retry (status: running) — retry applies to rejected/blocked projects and a stalled red P6."`; `gate` → exit 1 `RT_E_GATE_PENDING · "P7 DoD unmet — hard gate blocks advance: p7-competitors, p7-research — resolve the unmet DoD criteria before advancing."` with the remedy "fix the phase's artifacts or re-run the phase" — no verb re-opens a completed non-P6 phase. | The A4-E1 correction (this wave) honestly renamed the park `human-retry`, but the door it names is P6-only. `nextAction` sends the operator to a verb that reproduces the same block, so a red tail gate is a loop with no in-product exit (hand-editing `enforceDod`/the gate record, or `--advisory` at create time, are the only ways). |
| **F-06** | **P1** | A machine path **does** mint `decidedBy:"human"`: the unattested console seat is claimable by any Node caller, and the row satisfies the P4/P5/P8/P9 approval criteria | `src/lib/policy.ts:55-57`, `:203-206`, `:336-350`; `src/lib/headless.ts:1779-1788`, `:1884-1935`; `src/lib/dod.ts:326-338`, `:1214-1217`; doc: `AGENTS.md:308-311` | M8(c): `h.approve(p, { actor: { decidedBy: "human", seat: "console" } })` (plain Node, no TTY, no token, no browser) → row `{"decidedBy":"human","note":"[seat console] unattested human seat — no out-of-band token path (never token-verified)","via":{…"reason":"console-seat-unattested …","label":"human/console","tokenPath":false}}`. `dod.classifyRowSeat` accepts the untagged/console shapes and `policyConsistentApproval` re-asks the seam, which **allows** the console seat for `hitl.approve` (`policy.ts:341-350`). | `AGENTS.md:308` states "**A machine path may never mint `decidedBy:"human"`**". The bytes say a machine path can — the row is honestly *labelled* unattested, but nothing proves it came from a browser, and the DoD criteria that assert "the decision ledger records the approver" accept it. The claim either needs the seat to be un-forgeable (a host/attestation check) or the doc must be struck to "no machine path mints a *token-verified* human row". |
| **F-07** | **P2** | The DoD reader ignores `decidedVia` on untagged rows, and the store's force path writes exactly such a row — so a forced override the policy seam **denied** passes the "P4 approved" gate | `src/lib/dod.ts:329-330` (`untagged ⇒ true`, `provenanceConsistent` never called); `src/lib/store.ts:2494-2536`; `src/lib/policy.ts:294-308` vs doc `AGENTS.md:219-221` | M8(d): reproduce the store's forced row (`approveHitl(p, {decidedBy:"human", force:true, note:"I accept this isolation risk …", decidedVia:{action:"hitl.force", …reason:"force-requires-human-seat — the unattested console human seat may never force past a human gate…"}})`) → row tag-in-note `false`; `runGate(out,4)` → `gate pass=true unmet=[] classes=["artifact-presence","ledger-record"]`. Store bytes: it builds `consoleActor`, calls `evaluatePolicy("hitl.force", …)` (a **deny**), then still calls `approveHitl(… force, note: opts?.note …)` — the caller's rationale, i.e. no `[seat …]` tag (:2531-2535). | Two holes compose: (a) the store honours an override its own seam refused (only P6 got a rationale floor — `store.ts:2458-2490`), and (b) the gate's ledger-record criterion cannot see it because untagged rows skip the provenance cross-check. The recorded `decidedVia` literally carries the DENY reason while the gate reads green. `AGENTS.md:219` ("refused for `hitl.force`") is false at the store layer. |
| **F-08** | **P2** | `sealedWithFailures` means two different things on the same run — they disagree on any non-`complete` terminal state | `src/lib/headless.ts:1730` (RunResult) vs `:2299` (`summary()`); `src/lib/dod.ts:1937-1949` | Read: `RunResult.sealedWithFailures = outcome === "complete" && !sealHonesty(finalProject).clean`; `summary().sealedWithFailures = failedGates(project).length > 0`. M8(e) fixture (not complete, one red recorded gate): `summary.sealedWithFailures=true` while the run's `outcome` is not `complete`. `headless.test.ts:696-720` pins only the complete case. | An agent (or the eval harness) that branches on `summary.sealedWithFailures` and one that branches on `res.sealedWithFailures` get opposite answers for the same run; `maker-score.ts:645` reads the RunResult flag while the console reads the summary. One name, two laws. |
| **F-09** | **P2** | `keepBestTree` grafts the best tree but not its verification state — `p6-verified` can be decided by an execution that never ran over the persisted tree | `src/lib/headless.ts:3836-3838` (only `generatedTree` is grafted), `:3845-3851` (gate recomputed over the grafted tree with the **last** cycle's `lastTest`), `:4093-4123` (the mint happens before the graft on the current cycle) | Static read of the three sites + `git diff` (the graft/recompute is the 354 G5 piece). I did **not** build a live repro (would need a two-cycle journey with a better-but-red earlier tree) — stated as a read-based finding. `dod.ts:1295-1319` shows `p6-verified` probes `p.lastTest.label/evidenceHash`, and `p6-verified` is one of the two keyed criteria that bind the P6 gate. | The G5 recompute fixed the verdict/tree pairing only halfway: `p6-brief-fit`/`p6-arch` re-read the grafted tree, but `p6-verified` reads a `lastTest` minted for the *other* tree. A recorded verdict can therefore still describe evidence produced elsewhere — the exact class the wave says it closed (`AGENTS.md:458-459`). |
| **F-10** | **P2** | `rejectHitl` defaults to a **human** stamp with no seat, token or policy consult (asymmetric with `approveHitl`) | `src/lib/engine.ts:2339` (`decidedBy: opts?.decidedBy ?? "human"`) vs `:2188-2192` (`approveHitl` *throws* without an explicit `decidedBy`); callers: `src/lib/store.ts:2587`, `src/lib/headless.ts:1955` | `Select-String "rejectHitl\("` over `src/lib/*.ts` + `scripts/*.mjs` → production callers are `store.ts:2587` (console) and `headless.ts:1955` (passes the seat). Read of both sites. | The "no machine path mints a human actor" doctrine is enforced by a **required argument** at the approve seam and only by **caller convention** at the reject seam. Any future in-process caller (or a script) that forgets `opts` writes a human reject row with no evidence. |
| **F-11** | **P2** | The step cap is only reported when nothing advanced — a run that burns the iteration bound reports `progress` + exit 0 with no `capped` flag | `src/lib/headless.ts:1603-1616` (`… : steps > 0 ? "progress" : "cap"`), `:1100-1130` (`RunOutcome`), `src/lib/headless.ts:1487-1488` (default `maxSteps = 40`) | Read of the outcome derivation; `scripts/rapidtool-cli.mjs:1837-1865` (no-progress guard fires only at `steps === 0`) and the ok/exit-0 tail (`:1867-1890`). `scripts/acceptance-run.mjs:127`/`scripts/acceptance-run.test.mjs:127` carry a `capped` flag the engine `RunResult` does not. | A driver cannot distinguish "advanced and stopped for a legitimate reason" from "hit the iteration ceiling mid-graph" — the honest `cap` class is unreachable precisely when the loop is doing work but not terminating. |
| **F-12** | **P3** | The two CLI outcome mappers have drifted: the `run`/`gate` arm omits `outcome` (and `refusalCode`) where `respondDriveOutcome` includes them | `scripts/rapidtool-cli.mjs:1820-1836` (RT_E_GATES_FAILED branch, no `outcome`) vs `:1189-1207` and `:1238-1258` (adds `outcome` + `refusalCode`) | Read of both branches (M10). `headless.test.ts:3830-3870` (M5/M7-run set) pins the run/gate envelope shape. | A scheduler branching on `outcome` sees `undefined` on exactly the keyed red-seal path, and loses the newest `RT_E_LLM_*` refusal class that the resume path reports. Same verb family, two contracts. |
| **F-13** | **P3** | The pre-commit re-verification guard silently skips (no verification, no row) when the dir has no `.rapidtool/project.json` | `src/lib/headless.ts:3032-3034` (`if (!existsSync(join(target,".rapidtool","project.json"))) return null`) | Read; the emitted tree *does* carry that file (M8(a) listing: `.rapidtool\project.json` present, so the guard ran there). | The guard's contract is "a commit is evidence of a verified tree" (`AGENTS.md:486-489`); a caller landing a tree without that file gets an unguarded commit and no signal. Hazard, not observed in the emit path. |
| **F-14** | **P3** | Named swallows: a caught synthesis-seam error becomes an `events` string (no code, no ledger row); a repair-pass failure loses its class | `src/lib/headless.ts:4050-4057`; `src/lib/engine.ts:5277-5283`; `src/lib/engine.ts:4086-4092` | Read of the three catch sites + the callers' park codes (`RT_E_GATE_PENDING`, `RT_E_LLM_REJECTED`). `defaultP6Synthesize` → `synthesizeCycle` → `liveLayer` (engine) has its own coded degrade rows, so the first swallow is mostly the injected seam — noted as such. | The error-discipline rule ("every surfaced failure carries an `RT_E_*` code from errors.ts", `AGENTS.md:105-106`) is not met at those seams; a real seam throw is invisible in the ledger. |
| **F-15** | **P3** | A comment cites an API that does not exist: `headless.planReviewApproved` | `src/lib/engine.ts:5521-5522` | `Select-String "planReviewApproved"` over `src/lib/*.ts` + `scripts/rapidtool-cli.mjs` → 1 hit, the comment itself. | A reader (and F-04's analysis) is told a driver-side reader exists; it does not. Doc-vs-bytes at the exact seam that has no door. |
| **F-16** | **P1** | The tree does not typecheck (5 errors, 3 test files) and the src-leg test suite is red | `src/lib/headless.test.ts:5999`, `src/lib/scaffold.test.ts:2712`, `:2719`, `src/lib/wild-step.test.ts:1399`, `:1415` | M1: `npx tsc --noEmit` → `error TS18048: 'res.steps' is possibly 'undefined'` (headless.test.ts:5999); `TS2339: Property 'gameTemplate' does not exist on type 'ScaffoldResult'` ×2 (scaffold.test.ts:2712/2719); `TS2345: Argument of type '"complete"' is not assignable to parameter of type '"awaiting_hitl" \| "rejected" \| "locked"'` ×2 (wild-step.test.ts:1399/1415). M4/M5: 5 failing tests in the scope files (plus 3 more in-headless subtests). Two of the five errors are in code appended by the 354 wave (headless.test.ts:5999, wild-step.test.ts:1399/1415). | The freeze wave's own gate cannot be green. `git diff` shows `scaffold.test.ts` at 2712 reads `gameTemplate` off a `ScaffoldResult` that carries no such member — i.e. a new test written against a shape the emitter no longer returns. |

### 2.4 The `forceHuman` class — every gate no machine seat can clear (Wave 6 needs this list; **not** a removal proposal)

| # | Mint site | When it exists | What it protects |
|---|---|---|---|
| 1 | `src/lib/engine.ts:1065` (`synthesizePhase`, case 0) | scorecard verdict is `reframe` | The machine may not accept a below-proceed-line feasibility verdict on its own; a human either accepts the risk or tightens the brief. |
| 2 | `src/lib/engine.ts:1312` (`synthesizePhase`, case 6) and `:1866` (`applyPhaseResult`) | a P6 whose self-test/`lastTest` failed (`forceHuman: !result.ok`) | A red/broken generated module may never be machine-approved past P6; the override needs a human rationale (≥12 chars, `engine.ts:2219-2231`; console equivalent `store.ts:2458-2490`). |
| 3 | `src/lib/engine.ts:5717-5729` (`mintReviewGatePark`, called from `wildApproveGate` and `wildLeavePhase`) | a **classifier** review REJECT (an open gate or a phase leave) | An Auto-Review reject becomes a human decision. The agent seal cannot clear it (`:5761-5768`) — the seal's only escape is the explicitly-declared machine risk acceptance (`opts.acceptRiskUnderSeal`, `:5834-5858`, `:6000-6019`), which is `decidedBy:"autopilot"` and still faces the DoD post-check. |

Not `forceHuman` (machine-clearable by a *named* seat only): stock HITL gates P4/P5/P8/P9
(`src/lib/engine.ts:1193-1207`, `:1239-1245`, `:1427-1433`, `:1475-1480`) — cleared only by
`approve --seat autopilot`, or by `unattended`'s `machineGates` when the DoD passes
(`src/lib/headless.ts:1460-1467` + `store.canAutopilot` `src/lib/store.ts:672-679`); and a P6 gate raised
by `schedule.extraHitl` with a **passing** self-test (`engine.ts:1301-1313`, `forceHuman: !result.ok`).

---

## 3. What is genuinely sound — do not "fix" these

**3.1 `policy.ts` is a real seam (pure, total, default-deny, narrow-only).** No imports, no env read
(purity pinned by its own test), malformed input denies instead of throwing; `applyPolicyOverlay` can
only return the input verdict or a deny and never constructs an allow (`src/lib/policy.ts:16-40`,
`:253-268`, `:564-591`). Evidence: M2 → the whole `policy — …` block passes (7 suites, part of 87/87).
Rule B (`hitl.force`, `fixtures.approve`) genuinely refuses the autopilot seat and the console seat
(`policy.ts:294-330`), and the CLI refuses `--seat console`, a non-TTY human claim, and `--force` with a
machine seat before the driver is called (`scripts/rapidtool-cli.mjs:2134-2200`).

**3.2 The phase graph is id-exact and phantom-safe.** `canEnter` denies non-adjacent/unknown ids,
`priorsSealed` refuses an out-of-graph target instead of returning vacuously true, and
`stageWiringReading`/`phaseCoverage` match records by id (never array position), exclude bookkeeping
rows (`gate`/`packet`) and agent-origin report rows, and name a silent no-op phase
(`src/lib/phases.ts:155-176`, `:267-297`, `:433-520`). Evidence: M2, 13/13 phase suites (incl.
"A3-E16 — an ingested agent report is not a phase deliverable", "2026-10-06 — stage wiring …").

**3.3 The DoD evidence classification never overclaims.** `EXECUTED_EVIDENCE_CLASSES` deliberately
excludes `executed-self-test` (the engine testing its own template is not product evidence), so a green
P6 resting on the floor is qualified weak with `RT_E_CLAIM_UNVERIFIED`; `productBuildVerified` is true
only for `built-artifact`, which no criterion carries today; the gate artifact renders the fingerprint
as a *verdict vector*, not content evidence (`src/lib/dod.ts:96-180`, `:137-141`, `:1630-1657`,
`:1906-1911`). `p6-verified` reads the executed tree-run and explicitly *does not* claim the declared
`typecheck`/`build` ran (`dod.ts:1279-1319`). Evidence: M3 → 65/65.

**3.4 The wild loop cannot machine-clear a human-only gate, and it re-checks the DoD after approving.**
`wildApproveGate` refuses `gate.forceHuman` under the seal too, with the reason recorded
(`src/lib/engine.ts:5761-5768`); the post-approval `enforceDod` check discards the approved candidate
(no ledger row, no cursor move) when the gate is red (`:5913-5940`); the seal's rows are
`decidedBy:"autopilot"` + `[seat agent-seal]` + `decidedVia.tokenPath:false` (`:5893-5907`). Evidence:
M4 — the wild suites that pass include "the seal must not open a forceHuman gate" /
"machine-only lock (R3/B-03)".

**3.5 Seat provenance on a *standard* decision is honest and machine-readable.** `headless.approve`
routes through `evaluatePolicy`, stamps `[seat <label>]` + `decidedVia{action,resource,reason,label,
tokenPath}` on the fresh row only, and the token-path branch reads `seatTokenPath` (not `decidedBy`) so
the console seat can never read as token-verified (`src/lib/headless.ts:1779-1935`); `dod`'s
`provenanceConsistent` cross-checks label/gate/action/token path and fails closed on a forged tag
(`src/lib/dod.ts:258-338`). CLI/console/machine seats are therefore distinguishable on every *tagged*
approval (F-06/F-07 are about the untagged/claimable edges).

**3.6 The watchdog seams are wired, not decorative.** `boundedStepWatch` wraps the phase-execution await
inside `wildStepBody` (`src/lib/engine.ts:6551-6589`), the pause-on-resolve reads
`shouldAutopause(watched.elapsedMs, stepBudgetMs)` (`:6647-6663`), and the store's resume branch blocks
silent re-entry on `requiresHumanResume`/`shouldAutopause` (`src/lib/store.ts:1747-1762`). Evidence: M2
→ 9/9 watchdog suites, incl. "the wild-step wrap's tiers are the pure decision boundaries".

**3.7 The driver's RUNLOCK / no-progress / sealed-with-failures ordering is coherent.** The in-run guard
is first, kills a moving-tree result coded (`RT_E_SRC_EDITED_DURING_RUN`) in `respondDriveOutcome`
*and* run/gate, a hard-DoD block has its own `dod` outcome, a red seal is `RT_E_GATES_FAILED` with the
census, and a stuck 0-step drive is refused rather than returned as exit 0
(`scripts/rapidtool-cli.mjs:1136-1236`, `:1765-1865`; `src/lib/headless.ts:1443-1616`,
`:1726-1765`).

**3.8 The P6 gate/verdict pairing is *mostly* right.** `driveP6Journey` records the gate with the real
`recordGateInto` probes, never force-green; a green tree-run with a red gate FAILS the journey instead
of "converging"; `keepBestTree` recomputes the gate over the persisted tree and logs
`p6.journey.gate-recomputed`; the packet is re-stamped after every verification-state change
(`src/lib/headless.ts:4099-4231`, `:3845-3865`). F-09 is the residual, not a refutation.

---

## 4. What I could not verify

1. **The scripts-leg failures.** The baseline's 15 failures live in `scripts/*.test.mjs`; I did not run
   that leg (`npm test` is prohibited). Whether any of them share the F-01/F-02/F-03 root causes is
   therefore unverified — F-03's CLI refusal is *consistent* with such a failure, but I did not measure it.
2. **F-09 (`keepBestTree` + `lastTest`).** Static read only: I did not build a journey fixture with a
   better-but-earlier tree plus a later minted `tested` verdict, so I have not *observed* a false green —
   only the mechanism that permits one.
3. **F-07's reachability from the shipped UI.** I reproduced the store's exact forced-row shape and the
   resulting `runGate(…,4).pass === true`, and read `store.ts:2494-2536`, but I did not exercise
   `store.approve` (client zustand action) or the console's override control, so whether the *checkbox*
   is offered at a non-P6 gate is unverified.
4. **F-04's reachability from the shipped console.** Verified at the engine seam (`stageWildPlan` ×2) and
   by reading the two drivers and the read-only console card; I did not run a console wild session, so
   whether `attachWildPlan` ever lands a `source:"planner"` plan on a keyless host is unverified.
5. **Any keyed/live behaviour.** No model calls were made (no keyed run, no `emit --run` against a live
   model); all "keyed path" statements are read from the code and its comments.
6. **Whether the repo owner considers F-02's honest-red intent acceptable.** I report the bytes and the
   broken contract; the intent judgement is the wave parent's.

## 5. Recommended owners (later waves)

| Finding | Suggested lane |
|---|---|
| F-16 (typecheck + red tests) | **Boundary owner first** — nothing else can be verified green until `npx tsc --noEmit` and the src leg are clean. |
| F-01, F-02 | The emitter/scaffold lane (owner of the 354 `A2-F2`/`A2-F4` decisions: `scaffold.ts`, `emitProject`) — either restore the `refuse` mapping in `headless.emitProject` and reconcile the delivery contract/tests, or re-open the delivery decision explicitly. |
| F-03, F-12 | The CLI lane (owner of the B1-F2 per-verb flag allow-list and `USAGE.commands`). |
| F-04, F-05 | The wild/engine lane (park doors + the recovery verbs). |
| F-06, F-07, F-10 | The policy/DoD lane (seat attestation + the untagged-row tolerance + the store's force arm). |
| F-08, F-09, F-11, F-13, F-14 | The headless driver lane (one `sealedWithFailures` law, the graft's verification state, a `capped` outcome, the pre-commit guard, coded seam failures). |
| F-15 | Doc/comment hygiene — fold into whichever lane touches `stageWildPlan` next. |

*Lane `reviewer-pipeline` · W355 lane 1 of 6 · W0 (audit/freeze). No product file was modified.*
