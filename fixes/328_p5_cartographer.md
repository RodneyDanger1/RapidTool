# fixes/328_p5_cartographer — Persona 5: Knowledge & Learning-Loop Engineer (328 wave)

**Status: complete** (one in-lane fix landed, every other 112 candidate re-verified against disk).
**Owner:** Cartographer — persona 5 of 5 (328 wave). **Branch:** `main`, `HEAD a1f4f10` (tree was clean at start).
**Spec:** `research/multiagent/112_code_judgment_and_learning.md` §6 (T1–T12), re-verified task-by-task.
**Owned files (only these):** `src/lib/knowledge.ts`, `src/lib/knowledge.test.ts`, `src/lib/harvest.ts`,
`src/lib/harvest.test.ts`, `src/lib/judgment.ts`, `src/lib/judgment.test.ts`.
**Landing log (only writer):** this file.

## Method (disk wins)

The dossier's line numbers have drifted and several tasks already landed. Every status below was
re-checked against today's bytes with a command, not carried forward. Two invariants were treated as
load-bearing and re-proven: (a) the permanent `KnowledgeStore` is append-only with **no machine
writer** (only human `lesson --accept`); (b) telemetry never throws into the code it observes.

### Environment note (pre-existing, not a repo defect)

On arrival `node_modules/` was **empty** — the pinned suites could not load (`ERR_MODULE_NOT_FOUND:
Cannot find package 'gpt-tokenizer' imported from src/lib/algorithms.ts`). I ran `npm install
--no-audit --no-fund` (375 packages). One package extracted corrupt (`lucide-react`, tar ENOENTs),
which made `npm run typecheck` report 2 spurious `TS2307 Cannot find module 'lucide-react'` errors;
`npm install lucide-react@0.510.0 --force` repaired it and typecheck returned to **0**. This was an
install artifact, not a source defect.

## Per-112-task verdicts

| Task | Verdict | Evidence (command → observed) |
|---|---|---|
| **T1** failure-signature ids | **verified-landed** (knowledge.ts half) + **fixed in-lane** (harvest.ts half, below) | `knowledge.ts:904 failureSignature`; `lessonRow` hashes `fnv8(signature || text)` (`:995`); `templateEmissionLesson`/`verifyFailureLesson`/`driftLesson` route a signature. `knowledge.test.ts` `describe("216g / 112 T1 …")` (:890) green. |
| **T2** counterexample-or-nothing | **verified-landed** | `failureLessonFromRecord` (`knowledge.ts:1426`): 0 anchors ⇒ `refuse:no-proof`, `lesson:null`, `lesson.refused` payload. Consumer wiring real: `verify.server.ts:940 gatedFailureMint`, `report-intake.ts:66`, and the ledger append at `verify.ts:237-244`. `describe("216g / 112 T2 …")` (:968) green. |
| **T3** pure `judgePhase` ladder | **verified-landed** | `judgment.ts` exists (276 lines, no LLM/fs/net); `judgment.test.ts` **7/7** — one test per rung + a purity/static-import scan. ⚠️ no production consumer yet (see Open). |
| **T4** thread store rows → expansion prompt | **half-landed; consumer MISSING (out-of-lane)** | Resolver `provenRowsFromStore` exists (`knowledge.ts:167`). But **no production caller**: all four prompt sites pass `{ limit }` only — `codegen.server.ts:3034`, `:3121`, `:3463`, `engine.ts:679` — and a grep for `proven` in `codegen.server.ts`/`engine.ts` finds only the word "provenance". Not fixable in-lane (both files are other lanes'). |
| **T5** `lesson --advise` / `--verify` | **verified-landed** | `scripts/rapidtool-cli.mjs:3363` (`advise`) and `:3522` (`verify`), registered in the action error (:3055) and dispatch map (:4398). Exercised for real (below). |
| **C-08** harvest cap leak + zero-budget note | **verified-landed (was already fixed)** | `HARVEST_MAX_CANDIDATES = 6` named constant (`harvest.ts:57`); outer-loop cap re-check at `:417`; zero-budget note branches on `fetches > 0` (`:509-514`). Pinned by `harvest.test.ts` "candidate cap… (loop-top break)" (:317) and "zero fetch budget… never a tried-and-failed claim" (:353) — green. |
| T9 stemmer `-ies → y` | **not touched** (hard warning) | No edit to `algorithms.ts` by this lane (`git diff --stat` lists only my two owned files). |

## The one in-lane fix — T1 convergence, the harvest half

**Gap (re-verified):** `harvestEvidenceLesson` (`harvest.ts:707`) built its row with **no
`signature`**, so the id hashed the row TEXT — which embeds the volatile `detail` note (a rate-limit
message varies per backend/run). The SAME harvest failure forked a new row per recurrence, exactly
the T1 defect 216g closed for the knowledge.ts builders but explicitly left to "their owning
writers" — and `harvest.ts` is one of this lane's owned files.

**Fix:** thread a stable signature `failureSignature({ kind: "harvest-degraded", phase, classCode: reason })`
into the builder. The reason IS the failure class; no anchors and no detail tail ride the signature,
so a differing note cannot fork the id. The human-readable detail still rides the row TEXT.
`harvest.ts:707-760`; import of `failureSignature` added at `:31`.

**Teeth (empirical, reverted-behaviour reproduction):** a probe run outside the repo imported the
real `lessonRow`/`failureSignature` and computed both id formulas for one failure with two different
notes — `<TEMP>/p5_teeth.mjs`:

```
signature                = "harvest-degraded|p1|RATE-LIMIT|tail:"
OLD (no signature) ids   = lesson-harvest-rate-limit-d8703d83 | lesson-harvest-rate-limit-121a889c => FORK
NEW (signature) ids      = lesson-harvest-rate-limit-cdad9122 | lesson-harvest-rate-limit-cdad9122 => CONVERGE
text still distinct      = true
```

**New test (additive):** `harvest.test.ts` — `it("328 P5: the SAME harvest failure converges on ONE
row (a differing detail tail cannot fork it)")`. It asserts: same reason+phase + different note ⇒ one
id; the two texts still differ; a different reason and a different phase each stay a distinct row
(never over-collapse); and `harvestResultLesson` inherits the convergence across two differing notes.
Harvest suite **44 → 45 tests** (raise by exactly 1). No existing assertion weakened or deleted; the
preexisting idempotency pin (`identical inputs ⇒ identical id`) still holds because identical inputs
still hash identically.

## T5 — real read-only exercise (not just a grep)

Store fixture + anchor in `%TEMP%`, then:

- `lesson --advise --knowledge-file <store> --brief "verify failure cases"` → exit 0, one JSON object,
  `readOnly:true`, the fail-class row ranked (`class:"verify-failure"`, `level:"L3"`).
- `lesson --verify --knowledge-file <store> --anchor <file>` → exit 0, `readOnly:true`,
  `anchorHash` computed, row status `stale` (recorded `deadbeef` ≠ current `11dfe0cc`), `marked:null`.
- **Append-only invariant:** `Get-FileHash` of the store was **byte-identical** before and after both
  read-only runs (`5C26B6CE…` == `5C26B6CE…`), proving the consult verbs never write the store.

## Suite counts (before → after) and typecheck

| Suite | Before | After | Fail |
|---|---|---|---|
| `src/lib/knowledge.test.ts` | 43 | 43 | 0 |
| `src/lib/harvest.test.ts` | 44 | **45** | 0 (1 skipped) |
| `src/lib/judgment.test.ts` | 7 | 7 | 0 |
| `npm run typecheck` | exit 0 | **exit 0** | — |

Harvest re-run 3× post-edit for stability (`45 / 44 pass / 0 fail / 1 skipped` each time). One isolated
earlier run reported `fail 1` while `typecheck` and a second `node` process ran concurrently; it did
not reproduce across 3 sequential runs and no failing test name was captured — recorded honestly as an
unreproduced flicker under load, not claimed clean.

## Open items / cross-file hops (NOT attempted — outside owned files)

1. **T4 consumer.** `provenRowsFromStore(...).rows` must be passed as `opts.proven` at
   `codegen.server.ts:3034`, `:3121`, `:3463` and `engine.ts:679` (and a store path resolved). Four
   one-line edits; both files belong to other lanes. Until then the resolver is produced-but-unread.
2. **T3 consumer.** `judgePhase` has no production caller — a `diagnose`/CLI seam would have to call
   it. Out of lane.
3. **Harvest lesson dead path.** `harvestEvidenceLesson` / `harvestResultLesson` are exported and
   tested but have **no non-test caller** (grep over `src`,`scripts` finds only `harvest.test.ts`;
   `headless.ts:4174` wires only `harvestForPacket`). The harvest negative-evidence lesson therefore
   never reaches project memory in a real run. Wiring it needs `engine.ts`/`headless.ts` — out of lane.
4. **Invariant (b) sweep.** `provenRowsFromStore` catches read/parse failures and returns
   `{degraded:true, code:"RT_E_VALIDATION"}` (never throws into a synthesis path); `lessonLog`/`lessonRow`
   are pure string/ledger ops; `judgment.ts` is pure. No telemetry path in the owned files can throw
   into observed code. No `Math.random`/determinism leak in owned files (only the store's `savedAt`
   ISO stamp and the ledger `ts`, both intended).

## Hard invariants — confirmed respected

- **No machine writer to the permanent store.** No new append seam was added; `savePattern` remains
  the only write path and human `lesson --accept` its only caller. The read-only verbs were proven
  byte-neutral on the store file (above).
- **No stemmer change.** `git diff --stat` lists only `src/lib/harvest.ts` and
  `src/lib/harvest.test.ts`.
- **No test weakened or deleted.** All new coverage is additive.
