# Eval Corpus — maker-brief fixtures (mission 144 M6 · lane D3)

Machine-readable corpus for the maker-loop eval harness (fixes/144_completion_plan.md
mission M6 step 1). Each `<slug>.md` file is **one maker brief** with YAML frontmatter
carrying the exact cross-lane schema below. The eval driver (lane D4, `run-eval.mjs`)
reads these fixtures to score brief→software per the M1..M9 rubric and to record the
baseline that later waves must beat.

## File layout

```
research/eval-corpus/
  README.md                                   ← this file (schema + provenance)
  real-estate-crm.md                          ← Make 1/5
  house-flip-manager.md                       ← Make 2/5
  showing-booking.md                          ← Make 3/5
  rental-portfolio.md                         ← Make 4/5
  field-ops-suite.md                          ← Make 5/5
  coffeehouse2home-property-ledger.md         ← Phase-2 merged suite (99)
```

Six fixtures, one per real maker journey. Every brief text below the frontmatter of the
fixtures was transcribed **verbatim** from the on-disk run evidence (see provenance
table), not paraphrased from the dossiers.

## Frontmatter schema (exact keys — do not rename, reorder, or extend)

| Key | Type | Meaning |
|---|---|---|
| `name` | string (single line) | Human product name of the fixture |
| `brief` | string (single line) | The **verbatim** maker brief text fed to `create` |
| `kind` | enum `webapp\|library\|cli\|service` | Software kind the brief demands |
| `domain` | string | **Expected** lattice domain (the classification a correct run must land) |
| `expectedNouns` | array of strings | Nouns the software must carry as identifiers (lattice/entities/types/columns) |
| `expectedCapabilities` | array of strings | Free-text capability lines the software must implement |
| `acceptance` | string (single line) | The one-line 10/10 bar: what a runnable product must demonstrably do |
| `baseline` | string (single line) | The documented maker verdict at corpus time (delivery/process split where recorded) |

Escaping rules: every scalar is double-quoted YAML, single-line; arrays are block lists
of double-quoted single-line strings. A fixture file may carry a `## Provenance` body
after the frontmatter — parsers must ignore everything after the closing `---`.

## Provenance (which dossier / evidence each fixture came from)

| Fixture | Dossier | Run evidence (scratch) | Brief source | Recorded project name |
|---|---|---|---|---|
| `real-estate-crm.md` | `research/multiagent/98_make_1_realestate_crm.md` (Phase 1, 1/5) | `%TEMP%\rapidtool-make-b1\` (34 envelopes, project, vault/53) | `brief` field of `realestate-crm-export.json`/`proj.json` (439 chars) | `RealEstate CRM` |
| `house-flip-manager.md` | `research/multiagent/98_make_2_flip_manager.md` (Phase 1, 2/5) | `%TEMP%\rapidtool-make-b2\` (flip.json, logs, probe-live.mjs, vault/49) | `brief` field of `flip.json`/`export.json` (209 chars) | `Flip Manager` |
| `showing-booking.md` | `research/multiagent/98_make_3_showing_booking.md` (Phase 1, 3/5 — deep dossier) | `%TEMP%\rapidtool-make-b3\out\` (house-showing-final.json 91.7 KB, envelopes 00–28, vault/, scaff/) | Brief **quoted verbatim in the dossier** (line 39); byte-identical to `house-showing.json` `brief` (205 chars) | `House Showing Scheduler` |
| `rental-portfolio.md` | `research/multiagent/98_make_4_rental_portfolio.md` (Phase 1, 4/5) | `%TEMP%\rapidtool-make-b4\` (rental.json, rental-final.json 98.6 KB, vault/50, packet.md) | `brief` field of `rental.json`/`rental-final.json` (285 chars) | `Rental Portfolio Manager` |
| `field-ops-suite.md` | `research/multiagent/98_make_5_field_ops_suite.md` (Phase 1, 5/5) | `%TEMP%\rapidtool-make-b5\` (field-ops.json at P8, field-ops2.json, ~15 envelopes, probe-l2*.mjs, drive-journey.sh) | `brief` field of `field-ops.json` (267 chars) | `FieldOps Suite` |
| `coffeehouse2home-property-ledger.md` | `research/multiagent/99_coffeehouse2home.md` (Phase 2 merged) + `97_coffeehouse2home_mission.md` | `%TEMP%\rapidtool-make-merge\` (c2h.json, c2h-at-p8.json, c2h-final.json 106 KB, envelopes 00–25, vault/) | `brief` field of `c2h-final.json` (1412 chars; identical across all three c2h JSONs) | `Coffeehouse2Home` |

All scratch dirs were present on disk at corpus-write time (2026-09-08); no dossier was
missing, so no reconstruction from secondary evidence was needed. Verbatim brief strings
were extracted from the run JSONs' `brief` fields (the exact text passed to `create`),
then cross-checked against the dossiers' quoted fragments (e.g. make_3 line 39).

## Expected-domain mapping rationale

The `domain` value is the classification a *correct* run must produce — not the
misclassification the Phase-1 runs actually landed. `src/lib/algorithms.ts` `DOMAIN_RISK`
documents the lattice taxonomy; the 118 P-D3 comment adds `real-estate` and `construction`
precisely for these maker briefs.

| Fixture | Actual (broken) run landed | Expected (`domain`) |
|---|---|---|
| real-estate-crm | template/e-commerce relic lattice (`order` entity) | `real-estate` |
| house-flip-manager | `analytics`, jobs `[invoice, track]` (dossier §broken-2) | `real-estate` |
| showing-booking | `marketplace`, jobs `[schedule, publish, sync]`, entity `[buyer]` (dossier W2) | `real-estate` |
| rental-portfolio | lattice relic `order` (weight 0.9501) contaminating schemas | `real-estate` |
| field-ops-suite | jobs `[track]` + noise entities listing/list | `construction` |
| coffeehouse2home-property-ledger | brand-name research pollution; Property Ledger never surfaced | `real-estate` |

`expectedNouns` were derived from the brief's noun phrases plus the dossiers' documented
identifier evidence (make_1 `ShowingNote`/`parseInboundEmail`; make_4 anti-vacuity noun
family and expandBrief signatures createProperty/createLease/recordPayment/
createMaintenanceRequest/createWorkOrder/getVacantUnits/getCashFlowDashboard; make_3 W2
brief-noun list). Identifiers are written camelCase where the dossier shows code
identifiers, plain lowercase otherwise; runners should match case-insensitively.

`expectedCapabilities` decompose each brief into its requirement clauses (one line per
runnable behavior). `acceptance` is the single-line 10/10 bar the harness's M1..M3
criteria ladder toward. `baseline` quotes each dossier's verdict verbatim in spirit —
delivery N/10 plus the process-honesty score where the dossier recorded one.

## Baseline at corpus time (the bar to beat)

| Fixture | Delivery | Process honesty |
|---|---|---|
| real-estate-crm | 1/10 (RenamePro bar) | n/s (dossier ≈ 1/10 composite) |
| house-flip-manager | ~0–2/10 | 10/10 |
| showing-booking | 1/10 | ~9/10 |
| rental-portfolio | ≈ 1/10 | ≈ 9/10 |
| field-ops-suite | ≈ 1/10 (interim, parked at P8) | n/s |
| coffeehouse2home-property-ledger | ≈ 1/10 | ≈ 8/10 |

Zero shipped modules across all six journeys. See `fixes/144_m6_d3.md` for the write log.

*Corpus authored 2026-09-08 by lane D3 (fixes/144 mission M6 step 1). Schema is the
cross-lane contract for lane D4's `run-eval.mjs` — change it only via a plan revision.*
