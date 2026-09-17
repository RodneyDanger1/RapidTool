# 216g — Lane 4: judgment + durable learning (112's T1–T4)

**Status: complete** (T1/T2/T3/T4 landed in-lane; 4 cross-lane hops reported below, none attempted)
**Owner:** Lane 4 of the RESUME.md §3 wave (5-agent wave, wave `216g`)
**Spec:** `research/multiagent/112_code_judgment_and_learning.md` §6 — tasks T1, T2, T3, T4 (T9 retired — must land alone, later).
**Owned files (only these):** `src/lib/knowledge.ts`, `src/lib/knowledge.test.ts`, NEW `src/lib/judgment.ts`, NEW `src/lib/judgment.test.ts`.

## Hard warnings carried into this lane

- **(a) Do NOT touch the stemmer** (112's T9, `-ies → y`). Behaviour change, MED-HIGH test risk, must land alone in a later wave. This lane does not modify stemming logic.
- **(b) The permanent KnowledgeStore is append-only and NO MACHINE PATH MAY WRITE IT.** Only the human `lesson --accept` path (`scripts/rapidtool-cli.mjs:1681-1683`) writes it. T2's `refuse:no-proof` is about the harness / lesson-write path, not the store. Invariant preserved and re-verified below.

## Tasks

### T1 — deterministic failure-signature ids
- Status: **done in-lane** (one half of its done-when needs a file this lane does not own — see the ⚠️)
- Problem (112 §6/§4.2): every lesson id was `lesson-<class>-<fnv8(text)>`, and a fail row's `text` embeds free-text evidence (verify tail, iteration count, chunk index, evidence hash) → the same failure minted a NEW row per recurrence, and the 80-row FIFO (`engine.ts:1331`) evicted real lessons to make room.
- Change:
  - `knowledge.ts:788` `FailureKind`, `:803` `FailureRecord` (112 §4.1 shape), private `canonicalAnchor()` (path→basename, line/col stripped) + `canonicalText()` (digits/hex/line-refs collapsed, lowercased, 200-char cap), exported **`failureSignature(record)`** at `:875-892` (112 §4.2: `kind|p<phase>|<RT_E class>|anchors:<sorted,deduped ids>`; the tail is EXCLUDED entirely when anchors exist, and only an anchor-less record falls back to the normalized tail).
  - `knowledge.ts:756-762` — `LessonSpec.signature?: string`; `knowledge.ts:925` — the id is now `fnv8(signature || text)`, so **absent signature ⇒ every pre-216g id is unchanged** and legacy rows keep their identity.
  - Routed through the signature: `templateEmissionLesson` (`:1114`, phase + sorted unmet criterion ids — noun list and evidence hash stay text), `verifyFailureLesson` (`:1158`, + new optional 6th `proof` arg carrying anchors / `classCode`), `driftLesson` (`:1247`, later phase + `earlier:P<n>` anchor + unmet ids; the old→new hash pair stays text).
  - Deliberately NOT changed, and why (recorded, not silent): `vagueBriefLesson`, `correctionLesson` and `runSummaryLesson` are already deterministic on stable inputs (the HITL decision id is already in the correction text; the run-summary counts ARE its content). None of them is the per-run fork §4.2 reproduces.
- Evidence:
  - `node --experimental-strip-types --test src/lib/knowledge.test.ts` → **`# tests 35 # pass 35 # fail 0`** (new describe `216g / 112 T1`, 2 tests; 6 new `it()` added to this file in total, verified with `awk` over the appended block).
  - Fork is pinned dead: same anchors + different tail/iteration count ⇒ **one id**; unanchored same failure with a different iteration count ⇒ one id; different case ids / phase pairs ⇒ still different rows; id shape stays `^lesson-<class>-[0-9a-f]{8}$`.
- ⚠️ **Out-of-lane hop (not attempted)**: the `reproducedCount` half of T1's done-when needs a new `MemoryEntry.reproducedCount` field (`src/lib/types.ts`) plus the accrual at the merge site (`engine.ts:1331`). Neither file is owned by this lane. **In-lane I landed the identity half only**: a recurrence now derives the existing row's id, so `dedupeMemoryIds` can no longer see two ids for one failure.

### T2 — counterexample-or-nothing
- Status: **done in-lane** (the refusal is reachable + tested; the caller-side ledger append is a reported hop)
- Change: `knowledge.ts:1270` `FailureLessonOutcome` + `knowledge.ts:1302-1374` exported **`failureLessonFromRecord(record, opts)`**:
  - **0 anchors ⇒ `refuse:no-proof`, `lesson: null`, no row built**, `code: "RT_E_VALIDATION"`, and a ready ledger payload `{ level: "warn", event: "lesson.refused", detail: "refuse:no-proof — <kind> P<n>: …" }` so the refusal is RECORDED, never a silent no-op (§2.2 rung 6).
  - Anchored record ⇒ the row is minted through the SAME builder a direct caller uses (record path and direct path derive ONE id — pinned by test, 98 §3 anti-noise (b)).
  - A kind with no builder in this module (harvest / synthesis / rejection) is refused with a reason naming the gap instead of inventing prose.
  - `verifyFailureLesson`'s new `proof` arg (`:1145`) is the anchor carrier for direct callers.
- Evidence: knowledge.test.ts `216g / 112 T2` (3 tests) — 0 anchors ⇒ refusal with `log.event === "lesson.refused"` and `lesson === null`; whitespace-only anchors refuse; a case-id anchor mints with the pinned id shape; a `gate-unmet` record without its project refuses (no invented row); the store stays at count 0 on a refusal.
- ⚠️ **Out-of-lane hop (not attempted)**: the returned `log` payload still has to be appended by the callers — `verify.server.ts:891/910/926/963` (via `verifyOutcomeLesson`), `engine.ts:1358-1388`, `report-intake.ts:344-372` — and `engine.ts`'s `LessonSurface` seam (`:63-96`) does not expose `failureLessonFromRecord` yet. Ownership forbids this lane from editing them.
- **Invariant (hard warning b) preserved**: no machine write path to the permanent store was added. `KnowledgeStore.savePattern` remains the only append seam, and the human `lesson --accept` (`rapidtool-cli.mjs:1681-1683`) remains its only caller. Test-pinned: a refusal writes nothing (store count 0); the human-accept entry path still appends.

### T3 — pure `judgePhase(project, phase)` verdict ladder
- Status: **done**
- Consumer check (`grep -rn "judgment.ts" src scripts server`): **no consumer exists** — the only matches are the word "judgment" in prose comments of other modules; nothing imports `./judgment.ts`. Surface is newly defined here; no name was changed anywhere.
- Change: NEW `src/lib/judgment.ts` (276 lines) — `JudgmentVerdict` (`:31`, the six §2.2 verdicts), `JudgmentEvidence` (`:44`, the §2.3 triple), `PhaseJudgment` (`:53`), and `judgePhase(project, phase)` (`:149`). Rungs, in strict order:
  1. `blocked:hitl` — the phase record says `awaiting_hitl`, or the project is parked on this phase; the decision-ledger actor is REPORTED (`human`/`autopilot`/`none`), never minted, and a completed record is never treated as an approval (P0-02).
  2. `fail:deterministic` — `runGate` unmet; the unmet criterion ids + the gate's own `evidenceHash` anchor the verdict.
  3. `pass:machine-evidenced` — the machine-proof probe ids are read from the **DOD registry** (`*.endsWith("-verified")`, never hardcoded to P6) AND `lastTest` carries label `"tested"` + a non-empty `evidenceHash` (the p6-verified pattern).
  4. `pass:deterministic-only` — all probes met, nothing machine-verified; needs a ledger anchor.
  5. `advise:risk` — probes met + the phase's own warn/error log rows; checked BEFORE rung 4 so a risky pass cannot print as a clean pass (documented in the header, since §2.2 lists 4 before 5).
  6. `refuse:no-proof` — the honest floor: probes met but no phase record / log row / decision row anchors the claim (empty `anchor` IS the refusal).
  No LLM, no network, no `node:fs`, no clock, no mutation.
- Evidence: `node --experimental-strip-types --test src/lib/judgment.test.ts` → **`# tests 7 # pass 7 # fail 0`** — one test per rung (premises asserted with `runGate` itself, e.g. the P3 fixture's gate passing / the P6 fixture's gate failing) plus a purity test: the project is byte-identical after three judgments, and a static scan of the module source asserts every import specifier is free of `deepseek|llm|openai|anthropic|chat|node:fs|node:net|node:http` and that the file contains no `fetch(`.
- Note: `dod.ts`'s `approvalActor` is **private** (not exported) and `failedGates` was not needed for a per-phase verdict, so the ledger read is restated in `judgment.ts` with an explicit comment. A later wave may export `approvalActor` and drop the duplicate.

### T4 — thread `KnowledgeStore` rows into the expansion prompt
- Status: **done in-lane** (resolver + consumption proven); the 4 call sites are a reported hop
- Change: `knowledge.ts:136-190` — exported `ProvenRowsResult` (`:156`) + **`provenRowsFromStore(storePath, project, opts)`** (`:166`): resolves the configured store's cross-project `injectProven` rows through `provenToLessonRow` into `RankableLessonRow[]` for the existing `opts.proven` parameter of `rankBriefLessons` / `lessonLinesForBrief` (`knowledge.ts:93` was already live; no public export name changed).
  - No store path ⇒ `{ rows: [], degraded: false }` — the caller's prompt stays byte-identical to the legacy expansion.
  - Configured-but-unreadable/corrupt store ⇒ `{ rows: [], degraded: true, reason, code: "RT_E_VALIDATION" }` — returned, never thrown into a synthesis path and never silently swallowed as "no lessons".
  - Read-only: this can never append to the store.
- Evidence: knowledge.test.ts `216g / 112 T4` — an accepted cross-project row resolves with `source:"research"` and ranks into `lessonLinesForBrief`'s output lines; absent store ⇒ `[]`; a corrupt store is reported with `RT_E_VALIDATION` **and the store file is byte-unchanged after the read**.
- ⚠️ **Out-of-lane hop (4 one-line edits, not attempted)**: `codegen.server.ts:1372`, `:1445`, `:1652` and `engine.ts:600-603` must pass `{ limit: EXPAND_LESSON_RANK_LIMIT, proven: provenRowsFromStore(storePath, project.name).rows }`. `codegen.server.ts`/`prompt-engine.ts` are Lane 3's files in this wave; `engine.ts` is unassigned.

## Cross-lane report (nothing else was touched)

1. **`npm run typecheck` is currently non-zero because of a SIBLING, not this lane**: exactly 2 errors, both `src/lib/codegen.server.ts(269,9)` + `(270,9)` `TS7022` — Lane 3 owns that file and is mid-edit. The full-project tsc output lists **zero** errors in `knowledge.ts`, `knowledge.test.ts`, `judgment.ts`, `judgment.test.ts`.
2. T1's `reproducedCount` accrual needs `src/lib/types.ts` + `engine.ts` (see T1).
3. T2's `lesson.refused` append lives at the callers (see T2).
4. T4's four call-site hops (see T4).
5. `dod.ts` `approvalActor` is private (see T3).
6. **The stemmer warning (a) is untouched by this lane**: `git status` shows `src/lib/algorithms.ts` and `src/lib/algo-tools.ts` carrying an UNCOMMITTED diff, but their mtimes are `18:43:17` / `18:55:53` — both BEFORE this lane's first write (`knowledge.ts` mtime `19:32:37`). That diff is the previous wave's (RESUME §2.3 lane C), not mine; nothing in this lane's work reads or writes the stemming rules.

## Verification (commands + real observed output)

| # | Command | Observed |
|---|---|---|
| 1 | `npm run typecheck` | exit 0, output: **2 errors, both `src/lib/codegen.server.ts(269,9)/(270,9)` TS7022 (Lane 3's file)**; none in this lane's four files |
| 2 | `node --experimental-strip-types --test src/lib/knowledge.test.ts` | `# tests 35 # pass 35 # fail 0` |
| 3 | `node --experimental-strip-types --test src/lib/judgment.test.ts` | `# tests 7 # pass 7 # fail 0` |
| 4 | `node --experimental-strip-types --test src/lib/lesson-writers.test.ts` | `# tests 16 # pass 16 # fail 0` |
| 5 | `node --experimental-strip-types --test src/lib/report-intake.test.ts` | `# tests 22 # pass 22 # fail 0` |
| 6 | `node --experimental-strip-types --test src/lib/harvest.test.ts` | `# tests 40 # pass 40 # fail 0` |
| 7 | `gates` 83/83 · `io` 44/44 · `store` 72/72 · `arch-tools` 13/13 · `sweep73-fuzz` 52/52 · `wild-step` 12/12 · `wild-mode.server` 10/10 · `chat` 69/69 (each `node --experimental-strip-types --test src/lib/<name>.test.ts`) | all pass, `# fail 0` in every suite (475 tests across rows 2–7) |
| 8 | `git status --short -- src/lib/knowledge.ts src/lib/knowledge.test.ts src/lib/judgment.ts src/lib/judgment.test.ts fixes/216g_judgment_learning.md` | `M knowledge.ts`, `M knowledge.test.ts`, `?? judgment.ts`, `?? judgment.test.ts`, `?? fixes/216g_judgment_learning.md` — nothing else in this lane |

**Deliberately NOT run**: full `npm test`, `npm run build`, `npm run lint` (repo rule: never run the full gate while siblings are editing), and `codegen.server.test.ts` / `prompt-engine.test.ts` / `headless.test.ts` (sibling lanes' in-flight files).

## Deviations / test updates old → new

- No existing test was weakened, deleted, or flipped: the pre-existing pins still hold because the id **shape** is unchanged and the pairs the suite pins (`knowledge.test.ts:597-602`, L2 source-independence) have identical signatures. All new coverage lives in NEW test blocks / a NEW test file.
- One assertion **inside my own new test** was corrected during the run (recorded per rule 7):
  - File: `judgment.test.ts`, rung 3 block. **Old**: `judgePhase(withP6Proof({ label: "self-test" })) === "pass:deterministic-only"`, and the same for a `"tested"` label with no hash. **New**: both `=== "fail:deterministic"` with `unmet.includes("p6-verified")`.
  - Reason: `p6-verified` requires BOTH the label and a non-empty hash, so without the hash P6's own gate is unmet — my first expectation assumed a passing gate. The corrected assertion is **strictly stronger**: it pins that a self-test or hashless "tested" verdict can never reach the machine-evidenced rung.
  - Observed: first run `# pass 6 # fail 1` (the wrong expectation), after the correction `# pass 7 # fail 0`.

## Hard warnings — confirmed respected

- **(a) Stemmer untouched by this lane.** No `-ies → y` (or any other stemming) behaviour was added. See cross-lane note 6 for the mtime evidence that the `algorithms.ts` diff predates this lane.
- **(b) Permanent store: append-only, no machine writer.** No new write path exists. `failureLessonFromRecord` builds `MemoryEntry` rows only and refuses without anchors; `provenRowsFromStore` is read-only; the human `lesson --accept` path is still the sole store writer. Both properties are test-pinned (see T2/T4 evidence).
