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
