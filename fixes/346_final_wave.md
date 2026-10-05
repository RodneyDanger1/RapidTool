# fixes/346 — final wave (lane X5: acceptance / observability)

**Lane:** X5 (final team, lane 6/6). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`.
**HEAD at start:** `d692104` (clean, gate GREEN). **Owned files:** `src/lib/acceptance.ts`
(+test), `src/lib/doctor.ts` (+test), `README.md`, `AGENTS.md`, `RESUME.md`, this log.
**Not touched:** `src/lib/codegen.server.ts`, `headless.ts`, `dod.ts`, `verify.server.ts`,
`scripts/**` (sibling lanes held those this session; the tree was mid-edit during this lane).

---

## 1. What changed

### 1.1 Resample telemetry, read back from the persisted journal

The armed P6 chunk resample (lanes S4/T1) already persists one
`p6.synthesis.candidates` journal row per resample decision. This lane reads those rows
back into the doctor's fleet metrics — the journal is the only source; no number is
estimated.

- `src/lib/acceptance.ts:305` — `CandidateJournalEvent` + `parseCandidateJournalRow(detail)`
  (`:319`): reads `unit`, `fail-fast`, the `candidates N` budget, the evaluated candidates
  (a `not produced` slot is not tried), and the 1-based `winner` (or null for `winner none`).
- `src/lib/acceptance.ts:334`/`:364`/`:381` — `ResampleRunUsage` / `ResampleUsage` /
  `resampleUsage(runs)`: per-run and aggregate `runs`, `events`, `candidatesRequested`,
  `candidatesTried`, `winners`, `noWinner`, `extraKeyedCalls` (= Σ max(0, tried − 1)), and
  `byRun[].winnersByEvent`.
- `src/lib/acceptance.ts:539` — `fleetMetrics` now returns `resample: resampleUsage(rows)`.
- `src/lib/doctor.ts:612` — `fleetTelemetryFromProject(record)`: derives a run's telemetry
  from the persisted project record's own `logs` (`p6.synthesis.candidates` details) and
  `tokenUsage` (tokens/calls/cache). Wired at `:671` (`evidenceFromProjectRecord`), `:723`
  (`evidenceFromJobInventory`), `:902`/`:906` (`coerceFactoryClaim`). `workingApp` is
  deliberately **not** set here — the campaign verdict needs the on-disk tree's own
  `tsc`/`npm test`, which the record alone cannot prove.

**Tokens are not in the row.** The candidate row records candidates, not token usage, so
`extraTokens` stays `null` with `tokenAccounting: "not-recorded-in-journal"`.
`extraKeyedCalls` is the counted lower bound (each extra evaluated candidate is ≥1 keyed
synthesis call; a candidate's own bounded repair call is inside one candidate and is not
separable in the row).

**Measured this session** (read-only, keyless; the persisted default-check journals):
`doctor --project testruns\default-check\bakery-florist-orders\build.json` →
`factory.fleetMetrics.resample` = `{runs:1, events:9, candidatesRequested:18,
candidatesTried:15, winners:6, noWinner:3, extraKeyedCalls:6, extraTokens:null}`. Across the
four default-check records the aggregate is **3 of 4 runs recorded rows · 17 events · 34
requested · 25 tried · 14 winners · 3 none · 8 extra keyed calls** (office-stock-tracker
recorded none). Re-derived by parsing `testruns\default-check\<slug>\build.json`
`logs[event === "p6.synthesis.candidates"]`.

### 1.2 The variance reading (never one lucky sample)

- `src/lib/acceptance.ts:447`/`:455` — `FleetMetrics.resample`,
  `workingAppSamples`, `workingAppPass`, `workingAppRate`, `workingAppByBrief`. Only a row
  carrying a boolean `workingApp` scores; an absent verdict is never inferred.
- `src/lib/acceptance.ts:180`/`:182` — `FleetAcceptance.sampleCount` + `evidencedRate`, the
  variance denominator, so a 1-sample reading cannot be mistaken for a fleet result.

### 1.3 Tests (falsifiable, with vs without the resample)

- `src/lib/acceptance.test.ts` — parser tests over VERBATIM rows read from the persisted
  default-check journal (`ROW_WIN_FIRST` / `ROW_RESAMPLED` / `ROW_BOTH_REJECTED`), a
  WITH/without-resample metric test (the `synthesisCandidates: []` opt-out shape ⇒ 0 events,
  0 extra calls), and the variance tests.
- `src/lib/doctor.test.ts` — `fleetTelemetryFromProject` derives the rows + tokens and never
  invents `workingApp`; the doctor surfaces `fleetMetrics.resample` from a record's journal
  (with vs without); the variance fields ride the doctor metrics.
- Command: `node --experimental-strip-types --test --test-reporter=tap
  src/lib/acceptance.test.ts src/lib/doctor.test.ts` → **105 pass / 0 fail / 0 skipped**.

---

## 2. Docs re-derivation (declare-or-strike)

README.md, AGENTS.md and RESUME.md each gained a "Corrections in force — appended
2026-10-05 (346 wave batch 15 / X5)" block declaring four things, every number traced:

1. **The chunked P6 resample is ARMED BY DEFAULT** — validator-selected, `candidates 2..4`
   bounded by `P6_SYNTH_CANDIDATES_MAX` (4); the armed chunk-lane default is
   `P6_SYNTH_CHUNK_RETRY_CANDIDATES` (3 this session); `P6_SYNTH_CANDIDATES=1` (or
   `deps.candidates: 1`) is the explicit opt-out and emits no candidates row. The PRIMARY
   single-module best-of-N + whole-tree resample stay opt-in (`resolveSynthesisCandidates`
   default 1). Source: `src/lib/synthesis-policy.ts`; guards `S4-01`/`S4-02`.
2. **The measured product position** — campaign #2 `workingApp` was **2/8**
   (`testruns\_report\CAMPAIGN2.md` §5); the final keyed samples disagreed:
   `testruns\default-check\TUNING.json` **3/4** and `testruns\tuning\TUNING.json` **1/6**
   (combined 4/10). Same-brief flips: `mobile-companion` and `office-stock-tracker` each
   `true` in default-check and `false` in the tuning sample; `bakery-website` `true` in
   both; `bakery-florist-orders` `false` in both.
3. **The proof layer at its current guard count** — `node
   scripts/prevention/verify-prevention.mjs --all --selftest` → **27 guards**, both signals
   clean (`fixtureIntegrity.missed:[]`, `fixPresence.pending:[]`), `skipped:[]`,
   `countFloor:27`.
4. **The honest residual** — variance is the dominant factor; the binding wall is the P6
   DoD gate (`RT_E_GATE_PENDING`), not the resample lever.

---

## 3. Honest product/quality position (as of this lane)

- **Delivery honesty holds:** 0 empty-substance commits and 0 red-tree commits in both
  campaigns (`CAMPAIGN2.md` §5/§9).
- **Product axis:** campaign #1 `0/8` → campaign #2 `2/8` → the final keyed samples
  `3/4` and `1/6`. The spread between the two final samples (on overlapping briefs) is the
  measurement: **one lucky run is not the product**, and the machine reading now says so
  (`workingAppSamples` / `workingAppPass` / `workingAppRate`, `sampleCount` /
  `evidencedRate`).
- **Binding wall:** the P6 DoD gate. The resample recovers some per-chunk validation
  refusals (14 winners / 3 no-winner across the default-check rows) but does not by itself
  clear the substance + job-materialisation criteria.
- **Residuals named, not papered over:** `extraTokens` is `null` because the journal does
  not record per-candidate token usage; `resumeAccepted` is still plumbed but not consumed
  by codegen; 5 lint warnings; cross-family failover unimplemented.

---

# fixes/346 — final finish wave (Lane X: acceptance / observability / docs)

**Lane:** X (six-lane finish wave). **HEAD at start:** `95089de` (clean, gate GREEN).
**Owned files:** `src/lib/acceptance.ts` (+test), `src/lib/doctor.ts` (+test), `README.md`,
`AGENTS.md`, `RESUME.md`, this log; measurement artifacts under `testruns\campaign3\**` +
`testruns\_report\**`. The tree was mid-edit throughout (sibling lanes S/D/G/V/Q); the
orchestrator commits.

## A. X-1 [KEYLESS] — parse the ` · tokens <int>` journal suffix

- `src/lib/acceptance.ts` — `CandidateJournalEvent` gains `extraTokens: number | null`;
  `parseCandidateJournalRow` reads the optional trailing ` · tokens <int>` (I-A suffix, producer
  lane S S-4) into it. `ResampleRunUsage` / `ResampleUsage` gain `extraTokens`; `resampleUsage`
  sums the suffix across rows and sets `tokenAccounting:"journal"` iff ≥1 row carried it, else the
  honest `null` / `"not-recorded-in-journal"` (backward compatible with every campaign #1/#2 row).
- Tests (`src/lib/acceptance.test.ts`): a suffix-bearing row parses to a number; a legacy row and a
  non-integer suffix stay `null`; the aggregate sums a mixed set and reports `"journal"`.

## B. X-4 [KEYLESS] — surface `fleetMetrics.resample.extraTokens` on the doctor

- `src/lib/doctor.ts` `fleetTelemetryFromProject` copies the candidate rows verbatim, so the token
  suffix reaches `fleetMetrics.resample.extraTokens` with no second parse; `estimatedCostUsd` stays
  `null`.
- Test (`src/lib/doctor.test.ts`): a row carrying ` · tokens 321` reads `extraTokens:321` /
  `"journal"`; a legacy row reads `null` / `"not-recorded-in-journal"`; cost stays `null`.

Command: `node --experimental-strip-types --test --test-reporter=tap src/lib/acceptance.test.ts
src/lib/doctor.test.ts` → **108 pass / 0 fail**; `npx tsc --noEmit` exit 0.

## C. X-2 [KEYED] — campaign #3

Eight briefs at the armed default (`P6_SYNTH_CANDIDATES` unset ⇒ candidates 3), every invocation
`--token-ledger testruns\campaign3\ledger.json` with `RAPIDTOOL_CAMPAIGN_TOKEN_CAP=3000000`.
Result: **`workingApp` 4/8**; **0 empty-substance commits · 0 red-tree commits**; 2 trees withheld
coded. Ledger **948,586 tokens / 179 calls**, cap 3 M not tripped; wall 2,347 s. Resample read back:
**7/8 runs · 28 events · 55 tried · 20 winners · 8 no-winner · 27 extra keyed calls · `extraTokens`
293,152 (`"journal"`)**. Full scorecard: `testruns\_report\CAMPAIGN3.md` + `CAMPAIGN3.json`.

## D. X-3 [KEYLESS] — docs close-out

README.md, AGENTS.md and RESUME.md each gained a "346 wave batch 16 / Lane X close-out" block
declaring, with sources: campaign #3 4/8; the S-1 two-sample (1/4, 2/4 ⇒ 3/8); the combined rate
(fresh 7/16 = 43.75%; all history 13/42 ≈ 31.0%) and the variance; the candidate-token accounting
(293,152 / `"journal"`); and the sibling-lane landing corroboration (S-2 `scaffold.ts:1872-1908`,
D-1 `headless.ts:3441`).

## E. Honest residuals

- `extraTokens` is a MEASURED per-resample delta; a row without the suffix contributes 0 and never
  fabricates a figure. Campaign #3's first brief (`bakery-website`) recorded rows with no suffix, so
  its per-run `extraTokens` is `null` while the fleet total is a number — the mixed case X-1 pins.
- The campaign ran against the LIVE working tree (HEAD `95089de` → `841383d`), not a frozen SHA:
  sibling lanes (including S-4) were landing during the run. This is recorded in `CAMPAIGN3.md` §0.
- The product wall is unchanged: the binding clause is the P6 DoD gate, and `workingApp` at 4/8 is
  still under the ≥5/8 target.
