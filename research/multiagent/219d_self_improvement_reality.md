# 219d — PARENT-RECOVERY NOTE (read this first)

Lane 4 exhausted its tool budget before the write; the repo was left untouched and it handed
its evidence base back for recovery. **Everything below the rule is the LANE's own content,
unedited.** Its hop-verification column is the honest part to read first: hop 6 (does a future
run actually behave differently?) is marked UNVERIFIED, and the loop verdict is PARTIAL.

- lane: W13 lane 4, persona "self-fixing / self-improving reality" · delegation `deleg_b77255e7`, task-3
- source of this text: `%LOCALAPPDATA%\hermes\cache\delegation\subagent-summary-3-20260924_112728_011343.txt`
- full tool transcript: `%LOCALAPPDATA%\hermes\cache\delegation\live\deleg_b77255e7\task-3.log`
- lane scratch: `C:/Users/mnril/w13l4_scratch/` (probeA.mjs, probeB.mjs)

---

## THE LEARNING LOOP — hop by hop

| # | Hop | file:line | Verified how |
|---|---|---|---|
| 1 | failure → record | **red seal: `engine.ts:1452-1496`** (`p6.seal.unmet` log only, dedup :1492); L2 keyed-refusal `headless.ts:615-663` (`templateEmissionLesson` :640); L2 agent-report `report-intake.ts:374-401`; L3/L4 verify `verify.server.ts:899-921`,`:992`,`:1012`; L1 `engine.ts:547-551`; L5 `headless.ts:692` | **RAN** `lesson-writers.test.ts` → 18/18 pass |
| 2 | identity minted | `failureSignature` `knowledge.ts:881-898`; `canonicalAnchor` :830; `id: lesson-<cls>-<fnv8(signature\|\|text)>` :963 | **RAN probe A**: same failure + different tail → same id `lesson-verify-failure-1346afac` |
| 3 | row stored | `engine.ts:1434` accrual-before-dedupe, 80-FIFO; `verify.ts:207-270` | read |
| 4 | selected | `selectLessons` `knowledge.ts:1012-1033` (phase-preferred, score-desc/id-asc) | **RAN probe A** step 4 |
| 5 | reaches prompt | P0 reframe `engine.ts:649-660`→:667-673; keyed expand `codegen.server.ts:2473-2480`→`prompt-engine.ts:200-205`; single-module :2553; chunked :2846-2851 | **RAN probes A+B**: lesson text appears verbatim under `PRIOR LESSONS` / in the reframe HITL prompt |
| 6 | **next run behaves differently** | — | **UNVERIFIED — the broken hop.** Keyless; advisory-only strings (`prompt-engine.ts:213-216` "never change gate inputs"). Traced-not-run and in principle unmeasured anywhere in the code. |

## IS THE LOOP CLOSED? → **PARTIAL (and OPEN for the red seal specifically)**

- A **red seal on run A changes nothing for run B, by construction** — T-11 (`engine.ts:1452`) deliberately mints **no lesson row**; the `p6.seal.unmet` log is not lesson-tagged so `selectLessons` can never see it.
- Other classes (keyed-refusal L2, verify L3/L4, L1, L5) **do** close cross-run: rows persist in `project.memory` and re-enter the prompt. Within a keyed run the *same*-run loop is genuinely closed (recorded lesson → next synthesis call).
- Hop 6 (behavior delta) remains unverified and unmeasurable here.

## THE REPAIR LOOP — can it fix its own artifact without a human?

**YES for the machine loop; NO for the edit seat.** `repairTreeDir` `headless.ts:2440-2727` is fully machine-driven: hash-checked re-import :2486 → read-only first verdict :2516 → **parse-gate before write** :2630 → apply in place → re-import :2639 → re-run :2643 → converge only on tree-green **AND** `gate.passed` :2654-2656 → budget-exhausted = honest failure :2704-2710. CLI verb `repair` `rapidtool-cli.mjs:1030-1120` (exit 1 `RT_E_REPAIR_FAILED`, ledger persisted even on failure :1105). Producers: `driveP6Journey` :1829-2003 (budget 3, :1626), `treeRunFailureTail` :1664, ctx→deps :1559, `applyStrReplace` `patch.ts:279` used at `codegen.server.ts:906`, patch opt-in `repairCycleLiveDeps` :1578, 6 bounded in-codegen repair classes :2621-2728, `verifyAndFixServer` `verify.server.ts:923-1055` (model never declares the pass :1015).

**Limits:** requires a key (keyless `driveP6Journey` is a byte-identical no-op :1839-1850); the only in-place edit verb `edit --write` is **policy/human-gated** on `repair.apply` (`rapidtool-cli.mjs:1237`, :1288-1295); non-convergence leaves the artifact as-is.

> [WD-B · 2026-09-24] CONTRADICTED (partial): "the only in-place edit verb `edit --write` is **policy/human-gated** on `repair.apply`" (and the BOTTOM LINE's "its only in-place edit verb is human-gated") → it is **policy-gated but NOT human-gated**: the `repair.apply` rule sets `requiresHumanSeat: false` (`src/lib/policy.ts:98`), and `evaluatePolicy` ALLOWS the autopilot seat for such actions (`policy.ts:223-225`: `autopilot-seat — … under the harness's own seat`); the CLI only chooses the seat (`rapidtool-cli.mjs:1233-1235`) and proceeds on an allow verdict (`:1242-1259`). A machine holding the project JSON can run `edit --write` in place today — the repair reach is LARGER than this dossier states. Everything else in this repair section is CONFIRMED exact (`headless.ts:2486/:2516/:2630/:2639/:2643/:2654-2656/:2704-2710`; keyless no-op `:1839-1850`). — evidence: WD-B reads of `src/lib/policy.ts` + `scripts/rapidtool-cli.mjs` 2026-09-24. (verified by WD-B, not by the lane)

## WHAT "SELF-IMPROVING" WOULD REQUIRE — absent, with building blocks noted

1. **No cross-run weight/param update** — zero fine-tune/training code.
2. **No eval-driven prompt promotion** — `run-eval.mjs` measures, **writes nothing** (no `savePattern`/lesson writes).
3. **No regression-suite growth from real failures** — building block exists (`oracleToCaseSeeds()` `dod.ts`, A7 fixtures); unwired.
4. **No memory of which repairs worked** — `p6.repair.delta` is written/read (`headless.ts:2189-2222`) but only as one-cycle telemetry.
5. **No outcome-attributed ranking** — `selectLessons` ranks on static `score`; `reproducedCount`/`counterEvidence` are recorded but **never read** by selection. `scoreMaker` (`maker-score.ts:623`) is called **only** by `run-eval.mjs:898`.
6. **No machine writer to the permanent store** — `knowledge.ts:1335-1338` + CLI :2053-2054 "there is no machine path that appends to the store"; store→prompt only via `packet --knowledge` (docs, not codegen).
7. **Dead lesson surface (zero production callers):** `driftLesson`, `correctionLesson`, `consolidatedRunNote`, `manualLesson`, `dismissLessonRows`, `harvestResultLesson`, `lessonLog`, `provenRowsFromStore`, `verifyFailureLesson` (direct).

## SMALLEST REAL UPGRADE (one proposal)

**Make the red seal teach — safely.** In `engine.ts:1464-1495`, the `if (!r.pass)` branch already has `r.unmet.map(g=>g.id)` and the digest. Add one call to the **existing** `failureLessonFromRecord({kind:"gate-unmet", phase, anchors: r.unmet.map(g=>g.id), detailTail: digest}, {project: merged})` — it already carries the `refuse:no-proof` floor, already mints `probe:<id>` tags (T-11's own second half), and already maps recurrences to ONE row. ~6 lines in `engine.ts` + one test in `lesson-writers.test.ts`. Verify: `node --experimental-strip-types --test src/lib/lesson-writers.test.ts` (the T-11 "0 lesson rows" assertion must be *deliberately* updated to "1 gate-unmet row carrying `probe:p6-verified`") plus a probe showing `selectLessons(memory,6)` returns it. **Caveat: T-11 was a deliberate decision, so this needs owner sign-off** — it is the smallest *decision* change that closes the loop, not a bug fix.

> [WD-B · 2026-09-24] CORRECTED (scope): "~6 lines in `engine.ts`" → ~6 call-site lines PLUS ≈4 seam lines: `engine.ts` deliberately cannot static-import `knowledge.ts` (`engine.ts:63-67`, disk-backed `node:fs`), so `failureLessonFromRecord` must first be added to the lazy `LessonSurface` seam (type + import map, `engine.ts:68-108` — it is not on that surface today) and called with the same null-guard the existing `vagueBriefLesson` call uses (`:551`). All other mechanics verified exact: refuse floor `knowledge.ts:1365-1369`; `probe:<id>` tags via `lessonRow`'s signature-anchor spread (`:952`); one-row recurrence mapping (`:963`). — evidence: WD-B reads 2026-09-24. (verified by WD-B, not by the lane)

## BOTTOM LINE

It **learns within a keyed run** — a failure is signed, deduped, stored, selected, and rendered into the next synthesis prompt; that chain is code-verified end-to-end except the final behavior hop. It **can repair its own artifact** without a human when keyed (`repairTreeDir`), but its only in-place edit verb is human-gated and keyless repair is a no-op. **The gap in one line:** the loop's most important teacher — a red seal — is deliberately muted, lessons are advisory text the model may ignore, and nothing anywhere measures whether following a lesson made the next run better.

> [WD-B · 2026-09-24] CROSS-REFERENCE: "its only in-place edit verb is human-gated" (this paragraph) is contradicted — see the WD-B marker under "THE REPAIR LOOP". Verified repair facts: `repairTreeDir` is fully machine-driven and can converge an already-green dir with zero model calls (`headless.ts:2531-2554`, `cycles: 0`); repairing a RED tree's synthesis requires the key (keyless synth produces no tree → honest budget-exhausted failure, `:2609-2621`). (verified by WD-B, not by the lane)

