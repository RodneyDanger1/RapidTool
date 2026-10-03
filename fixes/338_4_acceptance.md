# fixes/338_4_acceptance.md — W52 · lane 338-4 · THE ACCEPTANCE DECISION (gap 4)

**Lane:** W52 338-4 ("Acceptance"). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`.
**HEAD at open:** `e7da20e` (clean; only `wave_plans/W52/` untracked). **Opened EARLY, append-only.**
**File box (STRICT):** `src/lib/fixtures.ts`, `fixtures.server.ts`, `fixtures.review.ts`,
`maker-score.ts`, `policy.ts` + their tests. Everything else STOP-and-REPORT.
**Runtime:** Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`) pinned · host Node v24.15.0.
Scratch: `%TEMP%\rt338_4\`.

---

## Step 0 — claimed / on disk / still open

Read in full before any edit: `wave_plans/W52/README.md`; `fixes/337_0_parent.md` §5;
`research/multiagent/thoroughanalysis.md` A2-f01 / R11-f05 / R5-f02 rows; prior acceptance-lane
logs (`fixes/301_x2_accept.md`, `303_c1_accept.md`, `304_d1_accept.md`, `216q_eval_fixtures.md`).

### Claimed (the mission)
The 4th factory gap is *"no human-approved fixtures (`decidedBy:"human"`)"*. Fixture acceptance
requires a human stamp, and the machine door (`--seat autopilot`) deliberately does not claim a
human decision — correctly, because faking a human stamp is the worst dishonesty in a governance
harness. Today the criterion is **neither satisfiable by a machine run nor honestly explained** to
an operator asking "why is this still false?". Decide + implement the honest answer; make
`maker-score.ts` agree with the acceptance criterion instead of telling two stories.

### On disk (read today, before edits)
- `src/lib/doctor.ts:332` `fixtures: 'no human-approved fixtures (decidedBy:"human")'` (the gap
  string); `:339-345` `gapsOf` pushes it unless `evidence.humanFixtures === true`; `:371`
  `factoryClaim` requires `evidence.humanFixtures === true` for `autonomousSoftwareFactory`.
- `src/lib/doctor.ts:48,313,324` — `humanFixtures?: boolean` is a hand-fed evidence field.
- `src/lib/headless.ts:4783` — the ONLY tree-scan producer calls
  `doctor.evidenceFromJobInventory(inv)` with **no `extra`**, so `humanFixtures` is `false` in
  every real run; `headless.ts:4763` is the inline fallback gap list.
- `src/lib/policy.ts:141` — `fixtures.approve` is registered **`requiresHumanSeat: true`**;
  `policy.ts:244-269` runs Rule B for it (the autopilot seat is denied).
- `scripts/rapidtool-cli.mjs:2249-2316` — the approve arm routes through `evaluatePolicy`
  ("fixtures.approve"), stamps `decidedBy` from the **verdict** seat only
  (`human-seat-token-verified` ⇒ `"human"`, else `"autopilot"`), and returns without writing on a
  deny.
- `scripts/rapidtool-cli-fixtures.test.mjs:187-217` — an **independent pin**:
  "the autopilot seat may never self-approve", project stays byte-identical, no row flips.
- `src/lib/brief-fixtures.ts:18-22,588-611` — machine DRAFTS (every case born `approval:"pending"`);
  only `approveFixtureCases(…, {decidedBy})` flips it, and `decidedBy` is never defaulted.

### Still open (the defects this lane owns)
1. **The criterion is unsatisfiable and unexplained.** No code derives `humanFixtures` from
   `project.acceptanceFixtures` — `grep humanFixtures` producers are `doctor.ts` + tests only, and
   `headless.ts:4783` hands no `extra`. A real run therefore reads `false` no matter what state the
   acceptance decision is actually in: there is no machine-checkable distinction between
   *"waiting on a human"* and *"broken / nothing drafted"*, and no wording that tells an operator
   which one they are looking at.
2. **Two stories about the same run.** `maker-score.ts:344-354` (M1) and `:419-437` (M2) score a
   `behavioral` fixture TAP (`pass/fail`) as acceptance **without any provenance**: the scorecard
   can say `behavioral pass N` while the doctor says no acceptance decision exists, and nothing in
   the card can tell a human-decided bar from a machine-decided or undecided one. The doctor's
   criterion and the score rest on different facts.

---

## Decision — **Option B**: acceptance stays human; the criterion becomes machine-CHECKABLE

### Why Option A is not genuinely honest here
Option A would let the autopilot seat accept fixtures. Three on-disk facts make that dishonest, not
merely inconvenient:

1. **The machine DRAFTS the bar.** `brief-fixtures.ts:18-22` — every case is born
   `approval:"pending"`; the drafter is the same machine that then writes the product under test. A
   machine allowed to approve would set the bar it is then graded against, and `doctor`'s factory
   flag would certify a **self-graded product**. The flag exists to answer the owner's question
   ("does this truly work?"); a self-certified run cannot answer it.
2. **The gate is deliberate and independently pinned.** `policy.ts:141` registers `fixtures.approve`
   `requiresHumanSeat: true` (R5-f02, hardening A2-f01/R11-f05: an earlier build let an agent
   self-approve the brief-derived bar, and `decidedBy:"human"` was minted with no seat).
   `scripts/rapidtool-cli-fixtures.test.mjs:187-217` — outside my box — pins "the autopilot seat may
   never self-approve" and the byte-identical-on-deny property. Flipping the rule to reach a green
   flag is the wave's explicit prohibition (*do not weaken a real governance gate to make a flag
   green*), and would red that scripts test.
3. **Attribution does not repair self-certification.** Recording `decidedBy:"autopilot"` would make
   the record honest about *who* — but the criterion "an autonomous factory" would then be
   satisfiable by a machine that chose its own acceptance bar: a weaker claim wearing a stronger
   name. Option A is honest about provenance and dishonest about what the flag certifies.

So acceptance stays human. The half that was genuinely broken is the other one: the criterion was
**neither satisfiable nor explainable**, and the score told a second story about the same fact.

### What landed (inside the box)

**1. `src/lib/fixtures.ts` — the acceptance decision, as machine-readable data (pure, total).**
`fixtureAcceptanceState(raw)` reads a project's `acceptanceFixtures` and returns exactly one of six
states — `no-fixtures` · `unreadable` · `pending` · `machine-decided` · `unattributed` ·
`human-approved` — with `total/approved/pending` and the seats recorded on the approved rows.
`acceptanceDecisionQuestion(state)` returns the ONE honest sentence, `null` exactly at
`human-approved`. **Nothing can move a record into `human-approved`**: only the record's own
`decidedBy` seat can, and this module only reads. The seat vocabulary is
`brief-fixtures.BRIEF_FIXTURE_DECIDED_BY` (imported, not copied).

*The doctor-facing question it answers* — "is the fixture term met, and if not, is the machine
WAITING on a human or BROKEN?" — by distinct sentences:
- `pending` → "5 of 5 acceptance fixture(s) await a human decision — the machine door
  (`--seat autopilot`) may not approve them … a human decides with `fixtures --approve --ids …
  --i-am-human`" = **waiting on a human, machine path healthy**.
- `no-fixtures` → "…nothing was drafted, so there is no decision to record … this is an absent bar,
  not a human keeping the machine waiting" = **not started / broken**.
- `unreadable`, `machine-decided`, `unattributed` → the three other named failure modes (a
  malformed record; an attributed machine decision; an approval with no seat at all).

**2. `src/lib/maker-score.ts` — the score reads the SAME derivation.**
`behavioral.acceptance` (optional, additive) carries the `FixtureAcceptanceState`; M1 and M2 score 0
with the doctor's own sentence when the bar is not human-approved, so the card can no longer print
`behavioral pass N` while the factory gap says no decision exists. Absent ⇒ the legacy A4 line,
byte-identical.

**3. `src/lib/policy.ts` — the refusal now says what a machine may not do here.**
The `requiresHumanSeat` deny for `fixtures.approve` used to read "may never **force past a human
gate**" (nothing was being forced); the clause is now per-action: "may never **decide the acceptance
bar** a machine drafted and will be graded against". The reason id `force-requires-human-seat` is
kept byte-identical (the scripts pin matches on it) and the verdict/fallback behaviour is unchanged.

### Preserved (audited, not re-litigated)
- draft is pending by construction (`brief-fixtures.ts` untouched);
- approval requires the seat (`policy.ts` verdict behaviour unchanged; CLI untouched);
- a denial writes nothing and stamps no `decidedBy` (CLI untouched — re-proved below);
- no path added here mints `decidedBy:"human"`.

### Reconciliation, before → after
| | before | after |
|---|---|---|
| doctor term | `humanFixtures` boolean hand-fed; the only tree-scan producer (`headless.ts:4783`) never sets it ⇒ always `false`, unexplained | one derivation (`fixtureAcceptanceState`) + one sentence (`acceptanceDecisionQuestion`) |
| score side | M1/M2 scored the fixture TAP with no provenance (`maker-score.ts:344-354,419-437`) | M1/M2 read the same state; a non-human bar is not acceptance |
| verdict | two surfaces, two stories | one vocabulary, one story |

---

## Probe — verified WITHOUT a human (real records, keyless)

`%TEMP%\rt338_4\probe\state.ts` (scratch, read-only) over a **real** drafted record produced by the
CLI in scratch (`create --brief @research/eval-corpus/house-flip-manager.md` → `fixtures --draft`:
`drafted 5, pending 5, approvedKept 0`) and a **real** pre-fixture record:

```
real: drafted pending {"state":"pending","total":5,"approved":0,"pending":5,"decidedBy":"undecided"}
   question: 5 of 5 acceptance fixture(s) await a human decision — the machine door (`--seat autopilot`) may not approve them (`policy.fixtures.approve` requires a verified human seat); a human decides with `fixtures --approve --ids … --i-am-human`
real: pre-fixture record (no acceptanceFixtures) {"state":"no-fixtures","total":0,"approved":0,"pending":0,"decidedBy":"undecided"}
   question: no acceptance fixtures exist — nothing was drafted, so there is no decision to record (draft with `fixtures --draft`); this is an absent bar, not a human keeping the machine waiting
crafted: autopilot-approved (the shape the policy denies a run) {"state":"machine-decided","total":1,"approved":1,"pending":0,"decidedBy":"autopilot"}
   question: 1 acceptance fixture(s) were approved under the autopilot seat — a machine may not set the bar it is graded against; an attributed machine decision is not an acceptance decision, and `decidedBy:"human"` is never minted for it
```

The third record is **crafted** (the gate forbids a run producing it) — labelled as such: it proves
the reader names an attributed machine decision rather than trusting that it cannot occur.

---

## RED-first (each fix: failing before, passing after)

| # | Fix | RED (pre-fix bytes in place) | GREEN (tree) |
|---|---|---|---|
| 1 | `fixtures.ts` acceptance-decision derivation | `fixtures.test.ts` vs `HEAD:src/lib/fixtures.ts`: `SyntaxError: The requested module './fixtures.ts' does not provide an export named 'FIXTURE_ACCEPTANCE_STATES'` → `# pass 0 / # fail 1` | `# tests 17 / # pass 17 / # fail 0` |
| 2 | `maker-score.ts` M1/M2 acceptance gate | gate lines neutralized: `not ok 7 - 338-4: a pending bar scores 0 …` + `not ok 8 - 338-4: an autopilot-decided bar is not acceptance …` → `# pass 77 / # fail 2` (actual M1/M2 = 1) | `# tests 79 / # pass 79 / # fail 0` |
| 3 | `policy.ts` per-action acceptance clause | `humanGateClause` removed: `not ok 4 - policy — fixtures.approve can never be self-approved (338-4)` → `# pass 32 / # fail 1` | `# tests 33 / # pass 33 / # fail 0` |

Restores were done from byte backups (`%TEMP%\rt338_4\*.backup.ts`) and re-verified GREEN.

## Counts (this lane's suites, both runtimes)

| file | before | after |
|---|---|---|
| `src/lib/fixtures.test.ts` | 8 | 17 (+9) |
| `src/lib/fixtures.review.test.ts` | 7 | 7 |
| `src/lib/maker-score.test.ts` | 75 | 79 (+4) |
| `src/lib/policy.test.ts` | 28 | 33 (+5) |
| `src/lib/policy-overlay.test.ts` | 25 | 25 |
| **total** | **143 / 0 fail** | **161 / 0 fail** (+18) |

Identical on pinned Node 22.23.2 and host Node v24.15.0. Targeted regression run of the unowned pin
`scripts/rapidtool-cli-fixtures.test.mjs` (the policy clause it matches on):
**4/4 pass** — "the autopilot seat may never self-approve … writes nothing" still holds.

## Mock/fake census (the six changed files)
`grep -i 'TODO|FIXME|XXX|@ts-ignore|as any|as unknown as|catch {}|placeholder|mock|fake|stub|hardcod'`:
- `src/lib/fixtures.ts` — 2 hits, both pre-existing comments describing *real* past defects
  (`:206`, `:221`, W-29(g) fake review row). No new hits.
- `src/lib/maker-score.ts` — pre-existing hits only (`isStubSource` import, `stub`/`TODO(E-15)`
  evidence strings); none in the new lines.
- `src/lib/policy.ts` — **0 hits**.
- tests — pre-existing `as unknown as` hostile-input idiom and stub-fixture strings only; my added
  tests contain none.
No `TODO` body, no `as any`, no `@ts-ignore`, no silent catch, no hardcoded return faking a
computation was added.

## Gates run (targeted; siblings mid-edit)
- `tsc --noEmit` at open: **exit 0**. Re-run at close: **exit 2**, exactly **one** error, in
  `src/lib/verify.server.test.ts:1170` — a **sibling lane's in-flight file** (338-6). **0 errors in
  any file this lane touched.** Per rule 7 no full gate was run.
- `eslint` over the six changed files: **exit 0, 0 warnings**.

---

## STOP-and-REPORT (exact shapes; files outside the box)

### R1 — `src/lib/doctor.ts` + `src/lib/headless.ts` (owner 338-3)
**What:** derive the fixture term from the record and replace the static gap with the state's own
sentence, so the criterion becomes machine-checkable and the flag explains itself.
**Exact shape:**
```ts
// doctor.ts — type-only import of the pure module (zero external deps, client-safe)
import { acceptanceDecisionQuestion, fixtureAcceptanceState, type FixtureAcceptanceState } from "./fixtures.ts";

export type FactoryEvidence = {
  // … existing …
  humanFixtures?: boolean;          // keep, but DERIVED — never hand-fed
  acceptance?: FixtureAcceptanceState;  // NEW: the one derivation
};

// evidenceFromJobInventory: derive the boolean from the state when supplied
const acceptance = extra?.acceptance;
humanFixtures: acceptance ? acceptance.state === "human-approved" : extra?.humanFixtures === true,
acceptance,

// gapsOf: push the state's OWN sentence
if (!human) {
  const q = evidence.acceptance ? acceptanceDecisionQuestion(evidence.acceptance) : null;
  gaps.push(q ?? FACTORY_GAP.fixtures);   // FACTORY_GAP.fixtures becomes the "no state supplied" fallback
}
```
```ts
// headless.doctorStatus (338-3) — the tree/project record is already parsed there for spend:
const acceptance = fixtures.fixtureAcceptanceState(record?.acceptanceFixtures);
const evidence = doctor.evidenceFromJobInventory(inv, { acceptance });
```
**Wording I would want** (the strings are already in `fixtures.ts`, so `doctor` renders them
verbatim and the CLI needs no change — see R3 for the console):
- `FACTORY_GAP.fixtures` fallback (no state supplied, kept as a named constant):
  `'no human-approved fixtures (decidedBy:"human")'` — unchanged, so `doctor.test.ts:43-46` (which
  matches by symbol) keeps passing.
- supplied state renders exactly: the five sentences quoted in the probe section above (pending /
  no-fixtures / unreadable / machine-decided / unattributed), `null` ⇒ no gap at `human-approved`.
- one-line flag summary for an operator: `human-accepted fixtures: <state> (decidedBy: <seat>) —
  <question>` is the shape I'd put in the doctor's human-readable rendering, if 338-3 adds one.

### R2 — `scripts/run-eval.mjs` (unowned)
**What:** the `behavioral` acceptance seam exists in `maker-score.ts` but no real trial ever
supplies it (`grep behavioral scripts/run-eval.mjs` → 0 producer), so the reconciliation currently
only fires in unit tests.
**Exact shape:** at the `scoreMaker({ … })` call site (`run-eval.mjs:2260`), supply
```js
behavioral: <the trial's tests/oracle.spec.ts TAP, already lifted by treeRunToMakerEvidence> && {
  pass, fail, failedIds,
  acceptance: fixtureAcceptanceState(finalProject.acceptanceFixtures),   // import from ../src/lib/fixtures.ts
}
```
`finalProject.acceptanceFixtures` are exactly the cases the tree's `tests/oracle.spec.ts` compiles
(`brief-fixtures.compileFixtureAssertion`), so the two facts belong on the same evidence object.

### R3 — CLI / console surfaces (unowned)
The CLI `doctor` arm responds `{ ok: true, ...status }` verbatim (`rapidtool-cli.mjs:4624`), so R1's
`factory.gaps` sentence reaches an operator through `doctor`'s JSON with **no CLI change**. The
console does **not** render `factory.gaps` today (`grep gaps src/components src/routes src/lib/store.ts`
→ 0 hits), so if the operator should read the waiting-vs-broken state in the UI, a console change
would be needed — out of my box, reported only. No STOP needed for the CLI path.

## Keyed usage
**0 of 2** — none needed. The gap is decidable from records on disk (probe above), and by
construction a keyed model call cannot settle "who may accept the bar".

## What I did NOT do, and why
- **Did not take Option A** — flipping `policy.ts`'s `requiresHumanSeat` for `fixtures.approve` would
  weaken a pinned governance gate to reach a green flag (argument in the Decision section).
- **Did not touch** `doctor.ts` / `headless.ts` (338-3), `brief-fixtures.ts` (unowned/frozen),
  `scripts/**`, `research/**`.
- **Did not edit `fixtures.server.ts` / `fixtures.review.ts`** — the acceptance decision is pure
  data (no IO), and those two are the *corpus* review surface; a project-file reader added there
  would have no consumer in this lane (a dead export, the exact defect the 337 round flagged). The
  needed wiring is reported as R1/R2 instead.
- **Did not run the full gate** (siblings mid-edit) and **did not run `npm run eval`**.
- **Did not mint or record any acceptance decision** — every state above was read from a record.

---

## Coordination with 338-3 (read at close, per the lane contract)

`fixes/338_3_autonomy.md` (opened while I worked; Step 0 only at close) names the same defect as its
still-open item 2: "`humanFixtures` has NO producer: it is a hand-fed boolean … a genuinely-approved
set cannot flip the flag; a broken set cannot be told apart from 'waiting on a human'"
(`doctor.ts:313,324,339,371,414`) — machine-resolvable, **its file**. That is exactly R1 above: my
`fixtureAcceptanceState` / `acceptanceDecisionQuestion` are the missing input and the missing
sentence, and 338-3 owns both call sites (`doctor.ts`, `headless.ts`). No conflict of ownership:
338-4 supplies the derivation, 338-3 wires it.



