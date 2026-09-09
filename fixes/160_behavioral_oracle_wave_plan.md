# 160 — WAVE PLAN: the behavioral oracle — emission, execution, scoring, and the human-approve surface

> **For Hermes:** this is the single next wave. Grounded against the live tree at plan
> time (2026-09-09); every anchor below was re-read this pass. The prior wave
> (oracle-foundation, `deleg_106f96ce`) is IN FLIGHT — its four lanes (F1 multi-file
> expansion, F2 brief-fixtures module, F3 E-08 seam wiring, F4 journey-convergence
> honesty) must land + gate green BEFORE this wave starts. This plan assumes they did.

---

## 0. Goal (one sentence)

Make "green" mean *the produced functions satisfy human-approved, brief-derived
input→output fixtures executed by the harness* — by emitting those fixtures into the
tree, running them headless, and re-keying the scorecard on behavioral-pass instead of
identifier-presence, with a real human-approve surface in the CLI.

## 1. Why this wave is the keystone (the honest problem it solves)

Read `fixes/155_structural_audit.md` §6–§8 and `fixes/157_plan_functional.md` §4 if
context is lost. The one-line truth confirmed by the audit:

> Every machine gate checks **bookkeeping, shape, or identifier presence** — no gate
> executes the shipped artifact against a **brief-derived behavior expectation**.

Concretely (all re-verified this pass):

- **The oracle is self-truth.** `emitOracleSpec` (scaffold.ts:986) emits tests that assert
  (a) the floor's no-op `synthesize()` returns `{ok:true}` (scaffold.ts:1122-1149),
  (b) `CheckpointStore` round-trips itself (scaffold.ts:1155-1184),
  (c) `ENDPOINTS` equals the A6 table (scaffold.ts:1186-1200), and
  (d) A7 rows assert the route **REJECTS** `TODO(E-15) stub` (green = stub still intact).
- **The A7 oracle rows are prose, never executed.** `OracleTest {id, name, given, expect, job}`
  (types.ts:241-247) is `given`/`expect` as free-text strings. The seed seam
  `oracleToCaseSeeds` (dod.ts:714) has **zero production consumers** (F3 is wiring it now).
- **M1 measures identifier stems, not behavior.** `m1Substance` (maker-score.ts:274-321) tree
  mode = `capabilityCoverage` (maker-score.ts:235-257), which is `identifierHits` over masked
  code + file-path substring match. The floor is built from the brief's nouns, so
  identifier presence **cannot discriminate floor from LLM software**.
- **"machine-verified" = compile + self-test.** `treeRun` (compile-check.server.ts:271-285)
  runs specs + a kind-entry smoke that **skips webapp/game as "UI shell"** (compile-check
  .server.ts:231-236) — the app is never executed.

This wave replaces those proxies with the one thing that measures the brief's job.

---

## 2. Assumed landing state (what the in-flight wave F1–F4 will have produced)

**F2 (`src/lib/brief-fixtures.ts` — new)** — the pure core, already specified in its brief:
- `BriefFixtureCase` type: `{ id, requirementId, capability, name, given, expect, kind:
  "pure"|"effect"|"property", source: "a7"|"capability"|"human", approval: "pending"|"approved" }`
  — `given` is a **typed input literal**, `expect` is a **deterministic predicate descriptor**
  (NOT free text, NOT a code string).
- `draftBriefFixtures(args)` — deterministic conversion of A7 `given⇒expect` rows + corpus
  `expectedCapabilities` into **candidate** cases, every one `approval: "pending"`.
- `validateFixtureCase` — shape-checker (unique id, `given` is a JSON literal, `expect` is a
  supported predicate descriptor, no code strings).
- `fixtureApprovalGate` — pure `{ ok, unapproved[] }`; `ok` only when **every** case is approved.

**F3 (`verify.server.ts`)** — `generateCases`/`verifyAndFixServer` seed from A7 rows via
`oracleToCaseSeeds` + reject a returned case list dropping pinned `orc-*` ids.

**F4 (`headless.ts`)** — `driveP6Journey` returns `converged` only when `gate.passed === true`
AND `treeRun.ok` (already visible on disk at headless.ts:1387-1430).

**F1 (`algorithms.ts`)** — capability scope drives type-signature count so a 7-capability brief
yields > 8 signatures → a genuine multi-file tree (kills the single-chunk collapse).

**If any lane did NOT land** (capped): finish it yourself BEFORE this wave — the fixture module
(F2) is a hard dependency; without it there is nothing to emit or run.

---

## 3. The work items (dependency-ordered, each fully specified)

### W1 — Persist approved fixtures on the Project (types.ts + engine hydrate)

**What:** a new additive field `acceptanceFixtures?: BriefFixtureCase[]` (and a small
`acceptance` sub-shape for the approval timestamp) on `Project`, hydrated/coerced in
`engine.ts` like `generatedTree` was.

**Where:** `src/lib/types.ts` (Project ends at :388-389); `src/lib/engine.ts` hydrate
(`hydrate` normalizes `generatedTree` with a `treeRepaired`/`generatedTree:dropped` token —
mirror that pattern for `acceptanceFixtures`); `src/lib/io.ts` sanitizeImportPayload (item-level
coercion, token `acceptanceFixtures:dropped` — mirror the `generatedTree` coercion).

**Why:** fixtures are the new acceptance artifact; they must survive the packet/persist
round-trip exactly like `generatedTree` does, and malformed imported fixtures must be dropped
loudly (never half-applied).

**What's wrong/missing now:** `Project` has `oracle` (prose) and `implementationSpec` (prose
requirements) but **no home for executable, approval-gated fixtures**. `generatedTree` was added
as an additive field (types.ts:324); fixtures need the same treatment.

**How to wire:** add the type → add a `hydrate` coercion that maps each element through
`validateFixtureCase`-shaped normalization (drop-invalid-with-token) → add the io.ts import
sanitizer arm → unit-test the round-trip.

**Purpose:** gives the fixture data a canonical, persisted home before anything emits it.

**Should do when done:** `Project.acceptanceFixtures` round-trips through import/export and
hydrate unchanged; an invalid fixture in an imported payload is dropped with the token and
never crashes the pipeline.

**Bugs to watch for:** (a) forgetting the io.ts sanitizer → an imported payload with a malformed
fixture crashes `advanceOnce`; (b) hydrate mutating in place (the `generatedTree` hydrate returns
a NEW project — copy that, don't mutate); (c) the byte-parity pin: legacy payloads with no
`acceptanceFixtures` must serialize identically (absence, not `[]`).

---

### W2 — Emit the fixtures + a behavioral runner spec (scaffold.ts)

**What:** extend `emitOracleSpec` (scaffold.ts:986) with a NEW branch (like `treeEntryOk`,
`hostOk`, `storeOk`, `apiOk`) that, when the project carries **approved** fixtures:
- writes `tests/fixtures.brief.json` (the approved fixtures serialized — `given` literals +
  `expect` descriptors, no code);
- emits a `tests/brief.spec.ts` that `import * as entry from <tree entry>` + `readFileSync`s the
  fixture JSON + for each `kind:"pure"` case, calls the mapped function with `given` and asserts
  the `expect` descriptor holds; for `effect`/`property` cases, assert the recorded effect/property.

**Where:** `emitOracleSpec` (scaffold.ts:986-1330). The emission is `ctx`-driven (OracleSurfaceCtx
:851-868); add `fixtures?: BriefFixtureCase[]` + `fixtureTargetPath?: string` to the ctx (or read
`project.acceptanceFixtures` directly — cleaner, since emitOracleSpec already takes `project`).

**Why:** this is the keystone emission — the first time the shipped tree carries an executable
acceptance suite that imports the produced code and checks real input→output.

**What's wrong/missing now:** `emitOracleSpec` emits module-truth + store-truth + endpoint-truth +
stub-reject rows + identifier-presence rows. **No branch asserts a brief requirement with a real
input→output pair.** The `expect` descriptor→assertion compilation (JSON descriptor → `assert.deepEqual`
/ `assert.ok` / property check) does not exist anywhere.

**How to wire:** (1) a pure `compileFixtureAssertion(case)` helper (in brief-fixtures.ts) that
turns `{given, expect}` + the `kind` into a generated `assert` line WITHOUT eval'ing arbitrary code
(a whitelist of predicate descriptors: `deepEquals`, `hasKey`, `isTruthy`, `matchesType`, `throws`,
`propertyHolds` — each rendered as a fixed assert template with the `given` literal inlined as JSON);
(2) in emitOracleSpec, add `fixtureOk = Array.isArray(project.acceptanceFixtures) &&
project.acceptanceFixtures.every(f => f.approval === "approved")`; (3) when `fixtureOk`, emit the
JSON + the spec importing the tree entry (the same `tsImportPath("tests", ctx.treeEntryPath)` idiom
already at :1069) and calling each fixture's mapped function.

**Purpose:** turn "the machine drafted fixtures" (F2) into "the emitted tree carries + runs them".

**Should do when done:** a project with ≥1 approved fixture emits `tests/fixtures.brief.json` +
`tests/brief.spec.ts`; `npm test` in the emitted dir runs the fixture assertions against the real
entry module. A project with NO approved fixtures emits **byte-identical** output to today (the
`fixtureOk` guard is false → no new lines — preserve the fixes/150 byte-parity pin).

**Bugs to watch for:** (a) emitting the fixture spec when only SOME fixtures are approved —
the `every` guard is mandatory or a pending fixture would silently fail the run; (b) the
`compileFixtureAssertion` helper accidentally rendering arbitrary code (the descriptor whitelist
MUST be closed; a `given` containing `"); process.exit(1); //` must be JSON-stringified, never
interpolated raw); (c) tree-entry import path mismatch (`.ts` vs `.tsx` — reuse the existing
`tsImportPath` + `/\\.ts$/` guard, never import a `.tsx` entry); (d) forgetting that `treeRun` runs
`tests/*.spec.ts` via `node --test` — the fixture spec MUST be under `tests/` or it won't run.

---

### W3 — Execute the data layer (compile-check.server.ts treeRun)

**What:** the fixture spec (W2) is a `tests/*.spec.ts`, so `treeRun` (compile-check.server.ts:271-285)
already runs it automatically. The remaining gap is the **kind-entry smoke**: webapp/game currently
"honest skip" (compile-check.server.ts:231-236). Keep the DOM skip, but ADD a **data-layer execution**:
when the tree has a non-`.tsx` entry module (a `.ts` entry like `src/generated.ts`/the hosted job
module), `treeRun.run` must **import the entry headless** and report pass/fail — a webapp whose DATA
layer is `.ts` is executable even when its `main.tsx` shell is not.

**Where:** `compile-check.server.ts` `treeRun` + the entry-resolution logic (:299-330 region — the
`COARSE_KIND_LABEL` + `ENTRY_EXTS` + the kind-entry smoke).

**Why:** the audit's chain-link 11 is `treeRun STUB — entry never executed`. "UI shell skip" is
honest about the DOM but it also skips the one artifact that carries the brief's logic. Executing the
data layer closes the single largest execution gap.

**What's wrong/missing now:** the entry smoke resolves `main.tsx` (webapp) → skip. It never tries the
tree's `.ts` entry (the assembled `src/generated.ts` or the hosted job module) when the UI shell is
present. So a webapp's entire data layer is never imported.

**How to wire:** (1) when kind is webapp/game AND a `.ts` tree entry exists (from `ctx.treeEntryPath`
or the project's `generatedTree` entry), run BOTH: the honest `skip` for the UI shell (recorded as
`run: "skip"` with the existing reason) AND a second `TreeEntryVerdict` for the `.ts` data entry
(import → pass/fail). This is additive — the existing `skip` verdict stays so nothing downstream
breaks; add `dataEntry?: TreeEntryVerdict` to `TreeRunOutcome`.

**Purpose:** make `treeRun.run` mean "the data layer actually loaded" for every kind, not "the DOM
skipped".

**Should do when done:** a webapp emission with a `.ts` data entry reports `run: skip (UI shell)` +
`dataEntry: pass`; `TreeRunOutcome.ok` requires the data entry to load when one exists. A pure-DOM
tree with no `.ts` entry keeps today's exact behavior.

**Bugs to watch for:** (a) importing a `.ts` entry that itself imports `react`/DOM deps → a load crash
reported as fail when it's really "UI-only" — gate the data-entry import on the entry being a known
headless module (the same `isTemplateModule`/`src/generated.ts`/job-module resolution the scaffold
already uses), never a blanket import; (b) changing `TreeRunOutcome` shape breaks `maker-score`
`m2Runs` (it reads `tr.ok`/`tr.testsPass`) — keep those fields, add `dataEntry` without renaming;
(c) the runner's 30s wall-clock (DEFAULT_RUN_TIMEOUT_MS:287) — the data import must stay bounded
(reuse runNodeBounded, never a raw `await import` in-process).

---

### W4 — Re-key M1/M2 on behavioral pass (maker-score.ts)

**What:** when `project.acceptanceFixtures` has ≥1 approved case, M1 substance = "all approved
fixture cases pass in the treeRun" (not identifier presence); M2 = `treeRun.ok` AND the fixture spec
passed with ≥1 assertion; the evidence strings carry the behavioral count.

**Where:** `maker-score.ts` `m1Substance` (:274-321), `m2Runs` (:324-345). The fixture-pass signal must
be plumbed into `MakerScoreInput` (a new optional `behavioral?: { cases: number; passed: number }`).

**Why:** M1/M2 are the "does it exist / does it run" criteria; they currently measure stems/compile.
For the scorecard to mean "functional", the existence/run criteria must key on the behavioral fixture
suite when it exists.

**What's wrong/missing now:** `m1Substance` tree mode is pure identifier coverage (:290-298);
`m2Runs` reads `treeRun.ok` only (:324-345). Neither knows about fixtures.

**How to wire:** (1) add `behavioral?: { cases: number; passed: number; failed: string[] }` to
`MakerScoreInput`; (2) in `m1Substance`, when approved fixtures exist, return `score: 1` only when
`behavioral.cases > 0 && behavioral.failed.length === 0`, evidence `"${passed}/${cases} approved
acceptance fixture(s) pass against the emitted tree entry"`; when fixtures exist but some fail →
`score: 0` naming the failed case ids; when NO fixtures exist → **fall back to today's identifier
path** (a keyless/floor run stays scored as today — but see W5, the floor can no longer claim
functional); (3) in `m2Runs`, when fixtures exist, require `treeRun.ok && behavioral.passed > 0`.

**Purpose:** redefine substance + runs around the brief's actual behavior when it's measured.

**Should do when done:** a run with approved fixtures that all pass scores M1=M2=1 with evidence
naming the case count; a run whose fixtures fail scores M1=0 naming the failures; a run with no
fixtures scores exactly as today (byte-parity on evidence strings).

**Bugs to watch for:** (a) the no-fixture fallback must stay byte-identical or every existing
maker-score test breaks; (b) `behavioral` coming from the treeRun evidence must be computed by the
RUNNER (W3), not self-reported by the model — wire it from the actual `node --test` TAP of
`tests/brief.spec.ts`, never from a log the synthesizer could fabricate; (c) M7 learning math
(reads prior M1-M3) must not drift — keep the integer `total`/`mean` unforced (the F1 gate-location
pin protects this; don't move it).

---

### W5 — The human-approve surface (CLI verb + store action + console affordance)

**What:** a CLI verb `fixtures` with subcommands `draft` (machine-draft candidates, print them),
`approve` (mark all/selected approved — the ONE human act), `reject` (send back with a note); a
store action `setAcceptanceFixtures(id, fixtures)` / `approveAcceptanceFixtures(id, ids)`; a console
affordance that shows `pending` vs `approved` fixture counts.

**Where:** `scripts/rapidtool-cli.mjs` (verbs live in `main()`'s switch — `emit` :663, `tree-run`
:751, `repair` :822, `lesson` :1348; add `fixtures` as a new case); `src/lib/store.ts` action map
(approve/reject/runP6Journey/setEnforceDod at :91-157 — add the sync `approveAcceptanceFixtures`);
`src/components/console.tsx` (add a small fixture-count badge/panel near the P6 affordances).

**Why:** the research (155_web_functional) is unambiguous — a brief alone can't be the oracle
(OpenAI filtered 68.3% of SWE-bench for underspecification/unfair tests); the machine **drafts**, a
human **approves**. Without an approve surface, the fixtures stay `pending` forever and the run can
never honestly claim functional (correctly, per W4's fallback).

**What's wrong/missing now:** fixtures don't exist yet (W1), and there is no surface to approve them.
The `lesson` verb has a human-gated `accept` (the F3 lesson family) — mirror that gate pattern.

**How to wire:** (1) `rapidtool-cli.mjs` `case "fixtures"`: `draft` loads the project, calls
`draftBriefFixtures` (F2), writes them to the project as `pending`, prints them as a numbered list;
`approve [ids...|--all]` flips `approval: "approved"` + stamps `approvedAt`; `reject [ids...]` removes
them with the note; (2) store: `approveAcceptanceFixtures` is a SYNC action (like `setEnforceDod`)
that maps the project's `acceptanceFixtures` — never an async journey; (3) console: read the
project's `acceptanceFixtures` length + approved count, show "N fixture(s), M approved" with a hint
that unapproved fixtures block a "functional" claim.

**Purpose:** give the honest one-human-act its UI/CLI face, so "functional" is a claim a human can
actually gate.

**Should do when done:** `rapidtool fixtures draft && rapidtool fixtures approve --all` produces a
project with all fixtures approved; the console shows the count; the journey (next run) can then
score behaviorally.

**Bugs to watch for:** (a) `approve --all` auto-approving on a keyless/floor run (approval must be an
explicit human act — never auto-approve in `driveP6Journey`, `runUntilHitl`, or wildStep); (b) the
store action committing whole-project over a concurrently-running async journey (use the same
sync-action H39-2.3 survival rule the operator toggles already follow — store.ts:240-241); (c) the
CLI `draft` overwriting a human's already-approved fixtures (draft must be additive + refuse to
clobber approved ids, or mark them explicitly).

---

### W6 — Gate the journey + DoD on the behavioral pass (headless.ts + dod.ts)

**What:** (1) `driveP6Journey` convergence (F4 lands gate.passed) must, when approved fixtures exist,
require the fixture suite green **too** — a gate that passed on identifier-presence while the
behavioral fixtures are red is not convergence; (2) the p6-verified / p6-brief-fit DoD probes
(dod.ts:337-355, 364-373) must key on the behavioral pass when fixtures exist (demote the stem probes
to advisory, per fixes/157 P1-2).

**Where:** `headless.ts` `driveP6Journey` (:1387-1430, F4's region); `dod.ts` p6-verified
(:337-355) + p6-brief-fit (:364-373) probes.

**Why:** the audit's chain-links 14/15 show the gate recorded then ignored; F4 fixes the "ignored"
half. This item closes the "gate measures the right thing" half — a green identifier gate is not a
green behavioral gate.

**What's wrong/missing now:** the P6 gate probes are identifier/compile/self-test based; even a
fully-wired `gate.passed` (F4) can be true while the brief's behavior is unimplemented.

**How to wire:** (1) in `driveP6Journey`, after F4's `gate.passed === true` check, add: if
`approvedFixtures.length > 0` and the treeRun's `tests/brief.spec.ts` did NOT pass → outcome
`"failed"` with evidence naming the failing cases (reuse the refusal/tail channel); (2) in dod.ts,
when `project.acceptanceFixtures` has approved cases, the p6-verified criterion's pass condition
becomes "the fixture suite passed" (the existing `lastTest.label === "tested"` mint is retained but
gated on the fixture pass), and p6-brief-fit stays as advisory telemetry only.

**Purpose:** make the journey + the hard-DoD gate measure the brief's behavior, so "converged" is
unforgeable by a floor or an identifier-sprinkled stub.

**Should do when done:** a keyed run with approved fixtures that fail returns `outcome: "failed"` even
if the identifier gate is green; a run whose fixtures pass converges with evidence naming the case
count.

**Bugs to watch for:** (a) the no-fixture path must stay byte-identical (keyless/floor journeys
unchanged); (b) reading the fixture spec's TAP result requires the runner to have surfaced it (W3) —
don't recompute the fixture pass from the source files (that re-introduces a second, driftable probe);
(c) the `lastTest` mint: don't mint `"tested"` on a run where the fixture spec failed (the mint must
require the behavioral pass when fixtures exist).

---

## 4. Wiring map (who feeds whom — the integration order)

```
W1 (types/hydrate/io: acceptanceFixtures home)
  └─► W2 (scaffold: emit fixtures.brief.json + brief.spec.ts)
        └─► W3 (compile-check treeRun: run the .ts data entry + surface TAP)
              └─► W4 (maker-score: behavioral{cases,passed,failed} → M1/M2)
                    └─► W6 (headless/dod: journey + gate key on behavioral)
W5 (CLI/store/console approve surface) — parallel to W2–W4, feeds W6's "approved" precondition
```

Integration order for the wave: **W1 → W2 → W3 → W4 → W5 → W6**, gating after W1, after W2+W3, and
at the end (full four-gate: `npm test` + typecheck + lint + build).

## 5. Tests / validation (the honest bar for each item)

- **W1:** hydrate round-trips approved fixtures; io.ts drops a malformed fixture with the token;
  legacy payload (no field) serializes identically.
- **W2:** `emitOracleSpec` with 1 approved `pure` fixture emits `fixtures.brief.json` + `brief.spec.ts`
  importing the entry; with 0 approved fixtures output is byte-identical; a `given` containing a
  quote/paren/semicolon is emitted JSON-escaped (no raw interpolation) — the injection guard.
- **W3:** a `.ts` data entry yields `dataEntry: pass`; a pure-DOM tree yields today's `skip` +
  `dataEntry` absent; `TreeRunOutcome.ok` false when the data entry fails to load.
- **W4:** fixtures-all-pass → M1=M2=1 naming the count; one-fail → M1=0 naming the id; no-fixtures →
  byte-identical evidence.
- **W5:** `fixtures draft` writes pending candidates; `approve --all` flips them; the store action is
  idempotent + never auto-approves.
- **W6:** gate green + fixtures red → `outcome:"failed"`; gate green + fixtures green → `converged`;
  no fixtures → unchanged.

## 6. Risks, tradeoffs, open questions (honest)

1. **The oracle's own correctness.** Machine-drafted fixtures can be wrong (self-authored-test
   overfitting, arXiv 2511.16858: refining against auto-tests RAISES overfitting). The approval gate
   is the mitigation, but a human can also approve a bad fixture. **Open question:** should `approve`
   require the human to see the `given`/`expect` rendered as plain English before confirming? (Leaning
   yes — render, don't raw-dump.)
2. **Effect/property cases are hard to assert deterministically.** `pure` cases (pure functions) are
   straightforward; `effect` (writes to a store) and `property` (invariant) need the harness to run
   the effect against a real store fixture. **Tradeoff:** ship `pure` first (fully deterministic);
   make `effect`/`property` emit an explicit "asserted as effect-record" row, not a deep behavioral
   check, until the effect harness exists.
3. **The webapp data-layer import (W3) can drag in DOM deps.** Gate on the known-headless entry
   (template/generated/job module), never a blanket `.ts` import.
4. **Scope creep.** This wave is already 6 items; W5 (UI/console) can be deferred to a follow-up wave
   if the CLI verb + store action land (the console badge is polish, not correctness). **Decision:
   land W1–W4 + W6 as the correctness core; W5's console badge is optional.**
5. **The honest re-run only happens after W1–W4 + W6.** The keyed Property Ledger must then show a
   multi-file tree (F1) whose approved fixtures pass (W2–W6) — that scorecard is the first that means
   "functional."

## 7. Files touched (exact)

| File | Item | Nature |
|---|---|---|
| `src/lib/types.ts` | W1 | add `acceptanceFixtures` + approval stamp |
| `src/lib/engine.ts` | W1 | hydrate coercion |
| `src/lib/io.ts` | W1 | import sanitizer |
| `src/lib/scaffold.ts` | W2 | `emitOracleSpec` fixture branch + `compileFixtureAssertion` |
| `src/lib/brief-fixtures.ts` | W2 | `compileFixtureAssertion` (extends F2's module) |
| `src/lib/compile-check.server.ts` | W3 | data-entry execution + `TreeRunOutcome.dataEntry` |
| `src/lib/maker-score.ts` | W4 | `behavioral` input + M1/M2 re-key |
| `scripts/run-eval.mjs` | W4 | compute `behavioral` from the treeRun TAP |
| `scripts/rapidtool-cli.mjs` | W5 | `fixtures draft/approve/reject` verb |
| `src/lib/store.ts` | W5 | `approveAcceptanceFixtures` action |
| `src/lib/headless.ts` | W6 | journey convergence requires behavioral pass |
| `src/lib/dod.ts` | W6 | p6-verified keys on behavioral when fixtures exist |
| `src/components/console.tsx` | W5 | (optional) fixture-count badge |
