# fixes/331_2_assayer — W45 · Lane 331-2 · Assayer (verification core & lesson identity)

**Wave:** W45 (331). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · branch `main`.
**HEAD at work:** `03a6d0b` (`330 wave`). **Runtime:** pinned Node **22.23.2**
(`%LOCALAPPDATA%\hermes\node\node.exe`); host Node **24.15.0** recorded for every suite touched.
**Owned files (STRICT):** `src/lib/verify.server.ts` · `src/lib/knowledge.ts` · `src/lib/harvest.ts`
· `src/lib/engine.ts` + their colocated tests (`*.test.ts`). No other file edited.
**Only writer of this log.** No `git checkout/stash/reset/clean/commit` was run. No full gate was run
(five siblings editing concurrently). No secret was printed.

---

## Verdict summary

| # | Finding | Verdict | Where |
|---|---|---|---|
| V1 | L4 `verifiedProcedureLesson` id forks on the iteration count (330_4 §3.1) | **FIXED** (2-part: builder + caller) | `knowledge.ts:1331`, `knowledge.ts:2056`, `verify.server.ts:1217` |
| V2 | `driftLesson` has no production caller; `verifyPriorPhases` claims callers that do not exist | **STRUCK** (false caller claim) + **REGISTERED** (caller owed; needs `store.ts`, not owned) | `knowledge.ts:1389`, `engine.ts:3487` |
| V3a | `wildLog` threw into the run it observes on a project with no `logs` array (telemetry-throw) | **FIXED** | `engine.ts:3907` |
| V3b | `driftLesson` sliced anchors to 6 BEFORE the signature (id forks on input order once >6 ids) | **FIXED** | `knowledge.ts:1408` |

**Baselines (four owned suites, both nodes, before any edit):** `143 tests / 142 pass / 0 fail / 1 skipped`.
**After:** `152 tests / 151 pass / 0 fail / 1 skipped` (**+9 tests, all mine**).
**Typecheck:** `npm run typecheck` → **exit 0, 0 TS error lines** (after all source + test edits).
**Lint:** `npx eslint` on all 8 owned files → **exit 0**.
**Suites run (Node 22.23.2 AND Node 24.15.0, identical numbers):**
`knowledge.test.ts` · `verify.server.test.ts` · `harvest.test.ts` · `engine.test.ts`.

---

## V1 — L4 `verifiedProcedureLesson` id instability → FIXED

### Defect (reproduced from today's bytes)
`verify.server.ts` built `evidence = "N/N machine-run cases passed on iteration I[; lint …]"` and passed it
to the L4 builder. The L4 row id hashed that whole string, so the **iteration count** (per-run process
noise, 112 §4.2 rule 3) forked one verified procedure into a new row every recurrence. The adjacent
comment claimed a "stable evidence-derived id" — the bytes did not support it (declare-or-strike).

### The fix (two parts, exactly the 330_4 §3.1 owed change)
1. `knowledge.ts`
   - New `LessonSignatureKind = FailureKind | "verified-procedure"`; `FailureRecord.kind` widened to it
     (a WIDENING — no consumer narrows on it; `report-intake.ts` passes failure kinds and still typechecks).
   - `verifiedProcedureLesson(project, phase, evidence, proof?: { anchors?: readonly string[] } | null)`:
     when `proof.anchors` is non-empty, the id hashes
     `failureSignature({ kind: "verified-procedure", phase, anchors })` = a dedicated signature kind
     (`verified-procedure|p<phase>|none|anchors:<sorted,deduped,canonicalized ids>`), NOT the evidence
     text. The evidence prose still rides the row TEXT. Empty/absent anchors keep the legacy
     evidence-derived id — no existing row is re-minted.
   - `verifyOutcomeLesson(status, phase, evidence, iterations, anchors?)` forwards the anchors to
     BOTH branches (L4 pass and L3 fail).
2. `verify.server.ts:1217`: the pass arm now passes the anchors:
   `lesson: verifyOutcomeLesson("passed", 6, evidence, i + 1, cases.map((c) => c.id))`.
   The stale "stable evidence-derived id" comment was replaced with the true identity statement.

### Id-stability probe — BEFORE (probe imported the real `.ts`; throwaway, outside the repo, deleted)
The unanchored path still reproduces the pre-fix formula exactly, so the fork is shown in-process on
today's bytes:
```
anchored iter1 id lesson-verified-procedure-a5fcf370
anchored iter2 id lesson-verified-procedure-a5fcf370  SAME? true
anchored iter3 id lesson-verified-procedure-a5fcf370  SAME? true
anchored 5-case id lesson-verified-procedure-da1e1165  DIFFERENT from 3-case? true
legacy(no anchors) iter1 id lesson-verified-procedure-6720963c
legacy(no anchors) iter2 id lesson-verified-procedure-a8a6d5e1  SAME? false   <-- the pre-fix fork
verifyOutcomeLesson iter1 lesson-verified-procedure-a5fcf370 iter2 ...a5fcf370  SAME? true
PROBE OK
```
The two `legacy` ids `6720963c` / `a8a6d5e1` are **byte-identical** to the 330_4 §3.1 probe's
`iter1`/`iter2` ids — provenance continuity, same defect, same numbers.

### Id-stability probe — AFTER (HEAD source in a scratch tree, new tests, Node 22)
```
# tests 92  # pass 87  # fail 5      (knowledge.test.ts + verify.server.test.ts)
  not ok 1  the same proven case set mints ONE id across iteration/lint drift (RED on HEAD)
            expected: 'lesson-verified-procedure-6c4e45b8'
            actual:   'lesson-verified-procedure-6720963c'
  not ok 2  the id is order-independent and case-set-sensitive
            expected: 'lesson-verified-procedure-bf9aff67'  actual: '...2cf31433'
  not ok 3  no anchors keeps the legacy evidence-derived id
  not ok 4  verifyOutcomeLesson forwards the anchors to the L4 builder
  not ok 1  (verify.seam) a pass at iteration 1 and a pass at iteration 2 mint ONE id
            expected: 'lesson-verified-procedure-9fd6800f'  actual: '...02423f4a'   (two REAL runs)
```
On the fixed bytes the same suites are `92 / 92 / 0`.

### Tests added (V1)
- `knowledge.test.ts` `describe("331 V1 — verifiedProcedureLesson id is anchored to the proven case set")`
  — 4 `it`s: (a) same case set across iteration/lint drift → ONE id (RED on HEAD); (b) order-independent
  and case-set-sensitive (3/3 ≠ 5/5); (c) no-anchor legacy id preserved; (d) `verifyOutcomeLesson`
  forwards anchors.
- `verify.server.test.ts` `describe("331 V1 — the verify seam anchors the L4 row to the proven case set")`
  — 1 `it` driving `verifyAndFixServer` twice (a pass at iteration 1 vs a pass at iteration 2 after a
  fix round-trip) with a stubbed transport; asserts ONE id, and recomputes the anchored id through
  `verifyOutcomeLesson` to pin the call-site forwarding. RED on HEAD: `9fd6800f` vs `02423f4a`.

### `verifyOutcomeLesson` signature contract (331-3 / 331-4 consumers)
```ts
export function verifyOutcomeLesson(
  status: "passed" | "failed" | "error",
  phase: PhaseId,
  evidence: string,
  iterations: number,
  anchors?: readonly string[],           // 331 V1; optional, omission = legacy behavior
): MemoryEntry
```
- `status === "passed"` → `verifiedProcedureLesson(project, phase, evidence, { anchors })`.
  Non-empty `anchors` ⇒ id = `lesson-verified-procedure-<fnv8("verified-procedure|p<phase>|none|anchors:<sorted ids>")>`.
  Empty/omitted ⇒ legacy evidence-derived id (back-compat).
- `status === "failed" | "error"` → `verifyFailureLesson(project, phase, evidence, iterations, undefined, { anchors })`.
  Non-empty `anchors` ⇒ id hashes `verify-failed|p<phase>|none|anchors:…`; empty/omitted ⇒ legacy tail id.
- `anchors` are canonicalized (lowercased, basename, `:line`/`:col` stripped), de-duped, sorted; the
  FULL set participates in the signature (no display cap). Non-strings and blank strings are dropped.
- Row TEXT is unchanged by anchors (evidence prose still human-readable) and gains `probe:<id>` tags
  via the existing T-11 `probeTagsFromSignature` path.

---

## V2 — `driftLesson` has no production caller → STRIKE + REGISTER (blocked on an unowned file)

### Evidence (commands run today)
```
$ git grep -n "driftLesson"
  src/lib/knowledge.ts:1389  (definition + docblock)
  src/lib/knowledge.test.ts:27,641,965,966,970,1041,1049,1050   (its own test only)
$ git grep -n "verifyPriorPhases"
  src/lib/engine.ts:3498   (definition)
  src/lib/knowledge.ts:1357 (docblock mention)
$ git grep -n "regression.drift"
  src/lib/engine.ts:3494   (docblock claim ONLY — no emitter anywhere)
```
So both the E-19 detector (`engine.ts verifyPriorPhases`) and the drift-row builder (`knowledge.ts
driftLesson`) are unwired; nothing on a real run observes a file-touch drift signal. The detector's
docblock **claimed** "callers (store/headless ingest) surface the drift as a `regression.drift` warn
log" — a false claim (declare-or-strike).

### Action taken (in-lane, honest)
- **Struck** the false caller claim in `engine.ts:3487` (`verifyPriorPhases` docblock) and replaced it
  with the true status: no production caller; needs the report-ingest seam that holds `report.files`.
- **Struck** the implied live path in `knowledge.ts` `driftLesson`'s docblock, stating plainly that no
  production caller exists and the caller is owed.
- **REGISTERED** here: the required caller is `store.ts ingestReport` (`src/lib/store.ts:1616`, which
  holds `applyReportResult` and `report.files`) and/or the headless ingest path — **files this lane does
  NOT own**. Rule 7 (STOP-and-REPORT): I did not reach across. No caller was invented; no fake drift
  signal was wired. The row SHAPE stays test-pinned (existing drift tests unchanged + new V3b test).

If the parent wants the wire landed, the exact 3-line change lives in `store.ts ingestReport` (call
`verifyPriorPhases(live, live.currentPhase, report.files)` after `applyReportResult`, log one
`regression.drift` warn row per `drift:true` flip, and `driftLesson(...)` into `project.memory` for each)
— assign it to a lane that owns `store.ts`.

---

## V3 — sweep of the four owned files

### V3a `wildLog` threw into the run it observes (`engine.ts:3907`) → FIXED
Same class the 330 wave fixed in `knowledge.ts lessonLog`. Pre-fix `logs: [...p.logs, row]` raised
`TypeError: p.logs is not iterable` on a hand-built / foreign project with no `logs` array. Fix mirrors
the established guard: `const logs = Array.isArray(p?.logs) ? p.logs : [];` then append + cap at 200.
Neighbouring `withLiveDegradeRows` already used `base.logs ?? []`, so the guard is the house convention.

### V3b `driftLesson` sliced before the signature (`knowledge.ts:1408`) → FIXED
The builder did `.slice(0, 6)` and fed the DISPLAY list into `failureSignature`, so once **>6** unmet ids
arrived the row id depended on input ORDER (the same drift forked a row). Same class as 330_4 §2.2
(`templateEmissionLesson`). Fix: `allIds` (the full filtered set) feeds the signature; `ids =
allIds.slice(0, 6)` still bounds the display TEXT. For ≤6 ids nothing changes.

### V3c telemetry / anchoring sweep results (checked, no change needed)
- `knowledge.ts lessonLog` — already guarded (330 P4).
- `harvest.ts harvestEvidenceLesson` — no anchors by design; signature is `harvest-degraded|p<phase>|<reason>`.
  No slice-before-signature; detail tail excluded from the id.
- `knowledge.ts verifyFailureLesson` / `failureLessonFromRecord` — signature uses the FULL `proof.anchors`
  / `record.anchors`; no pre-signature slice.
- `engine.ts p6JobsShortfallLog` (pure, guarded), `liveLayerFailureRow` (hostile-input tolerant),
  `withLiveDegradeRows` (`base.logs ?? []`) — clean.
- `engine.ts` inline `logs:` spreads at `:1769/:1835/:1927` are engine-internal transition/new-project
  constructions on a valid `Project`, not telemetry helpers; left unchanged (out of the class scope).
- `engine.ts` has no direct `lessonRow`/`failureSignature` call — it goes through the knowledge.ts
  builders, so it inherits the anchored ids.

---

## Tests added (all additive; none weakened or deleted)

| File | Added | Real result (Node 22 + Node 24) |
|---|---|---|
| `knowledge.test.ts` | 4 (V1) + 1 (V3b drift anchors) = **5** | green |
| `verify.server.test.ts` | 1 (V1 end-to-end seam) | green |
| `engine.test.ts` | 3 (V3a wildLog control + no-logs + 200-cap) = **3** | green |

**RED-first proof (HEAD source in a scratch tree `.t4scratch331`, new tests, Node 22):**
```
knowledge.test.ts + engine.test.ts + verify.server.test.ts : # tests 107 / pass 100 / fail 7
  not ok 2  (engine) a hand-built project without a `logs` array still yields the row — TypeError: p.logs is not iterable
  not ok 4  (knowledge) 331 V3: drift signature hashes the FULL unmet set — expected ...622ac430 actual ...7e8985d9
  not ok 1..4 (knowledge) 331 V1 verified-procedure block (4)
  not ok 1  (verify.server) 331 V1 seam — expected ...9fd6800f actual ...02423f4a
```
Each assertion detects the pre-fix bytes; on the fix all are green. The controls (`wildLog` normal
append, `≤200` cap) pass on HEAD AND on the fix. The scratch tree was deleted (`Test-Path` → `False`);
its byte source was `git show HEAD:<path>` (no git state was mutated).

**Consumer suites (read-only, to catch a shared-type regression):**
`lesson-writers.test.ts + honesty-guards.test.ts + verify.test.ts` → `64 / 63 / 1 fail`, SAME on both nodes.

---

## Observed cross-lane interaction (NOT mine — reported, not touched)

The single red in the consumer run is **caused by lane 331-1's concurrent `src/lib/errors.ts` change**,
not by this lane:
```
not ok 14 - fixes/252 … keyed live failures leave coded rows
  expected detail to start with RT_E_LLM_REJECTED
  got: RT_E_LLM_KEY_REJECTED · live narrative failed: DeepSeek API key is invalid (HTTP 401 …
```
`git diff src/lib/errors.ts` shows 331-1 (Keywright) added `RT_E_LLM_KEY_REJECTED` / `RT_E_LLM_KEY_SHADOWED`
and reclassifies HTTP 401 to the new family. `lesson-writers.test.ts:578` still asserts the old class.
That assertion (and `lesson-writers.test.ts`, which this lane does not own) is 331-1's consumer update to
make; I did not edit it. My four owned suites are 0-fail on both nodes.

---

## What I did NOT do, and why

- **Did not edit `store.ts` / `headless.ts` / `report-intake.ts`** — wiring V2's real drift caller needs
  the report-ingest seam there; those are outside my owned files (rule 7 STOP-and-REPORT). Registered above.
- **Did not invent a drift caller** in `engine.ts` — no in-engine seam observes `report.files`, and a
  caller that does not observe a real drift signal would be fabrication.
- **Did not run the full gate, `npm test`, `npm run build`, keyed calls, or `npm run eval`** — five
  siblings are editing concurrently; keyed calls/eval are forbidden in this wave.
- **Did not print any secret** — no key was read or echoed.
- **Did not touch `FailureKind`'s existing members or `failureSignature`'s algorithm** — V1 adds a new
  signature KIND via a widening `LessonSignatureKind`; every pre-331 signature is byte-identical.
