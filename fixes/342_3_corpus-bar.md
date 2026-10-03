# 342-3 (corpus bar + M7 semantics) — append-only log

**Lane:** engineer 342-3. **Root:** `C:\Users\mnril\Desktop\RapidTool Main` (git `main`, HEAD `686d7b6`).
**Runtimes:** host `node` v24.15.0 and `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
**Ownership (STRICT):** `research/eval-corpus/graders/**`, `src/lib/maker-score.ts`, `src/lib/maker-score.test.ts`. Nothing else edited.
**Scratch:** `$env:TEMP\rt342_3\`. **Keyed budget: 0 — 0 keyed calls made.** No tracked-file deletions.

---

## 1. M7's real definition (bytes + stored numbers)

**Bytes.** `src/lib/maker-score.ts:656-684` `m7Learning` — pre-fix it was: no `prior` ⇒ `0`
(`"no prior same-domain run — no learning claim without data"`); otherwise `mineSum >= priorSum`
where `mineSum = M1+M2+M3` of this run and `priorSum = prior.m1+prior.m2+prior.m3`. The prior is
resolved in `scripts/run-eval.mjs:588-596` `priorFor` (last `history.json` row for the slug) and fed in
at `run-eval.mjs:2298`. So M7 is **a non-regression claim against a prior same-slug run** — i.e. "the
prior run's learned substance was carried forward". It is *not* a check of the no-prior path.

**Which meaning is honest.** The two candidates are (A) "lessons were reused" — legitimately 0 with
no prior — and (B) "the no-prior path is honest" — which would mint M7=1 on any first run. (B) is a
false green: it awards a learning point for stating the absence of a lesson, and would let a first run
reach 9/9 without any learning evidence, exactly what the honesty contract forbids. **We adopt (A).**
A first run has no prior lesson to reuse, so M7=0 is correct — the defect is the *bar*, not M7.

**Stored-result numbers (read, not re-run).**

- `research/eval-out/results.json` is a **single-entry, warm** artifact (`coffeehouse2home-property-ledger`,
  `generatedAt 2026-09-25T00:03:43.504Z`): M1..M9 = `0,0,0,0,1,0,0,1,1`, total **3/9**, mean 0.3333.
  Its M7=0 is a **regression** (`"M1+M2+M3 0 < prior same-domain 1"`), and the prior resolved by
  `priorFor` (last row before `generatedAt`) is `{m1:1,m2:0,m3:0}` — **not** a cold start. This file
  therefore does **not** exhibit the mission's cold-start arithmetic; that lives in the keyed scorecard
  of `fixes/341_2_provider-key.md` §2.
- The stored **first runs** are `history.json`'s earliest row per slug (6 slugs, `2026-09-08T13:38:50Z`,
  keyless floor): M7=0, total 4/9 (M5/M6/M8/M9).
- The stored **keyed** scorecard (`fixes/341_2_provider-key.md` §2, scratch dir since removed) shows the
  arithmetic plainly: `arcade-breakout`, `date-rrule-library`, `field-ops-suite`, `showing-booking`
  each **8/9 with M7 the only 0**, and §2 states files/content/behavior/kind all pass for the corpus —
  so the *only* blocking clause was `mean 8/9 < 1`.

**A second, unprompted finding (same stored file).** The old M7 minted learning points with no lesson:
`history.json` records **8 rows with `m7=1` against an all-zero `{m1:0,m2:0,m3:0}` prior** (e.g.
`coffeehouse @ 2026-09-08T22:29:44Z`, `field-ops-suite @ 2026-09-10T05:29:29Z`) — `mineSum >= 0` was
vacuously true. That is a score minted without evidence, and it is fixed here (§3).

## 2. The decision — a per-run-kind bar, not a lowered one

A first run cannot score M7 by construction. The honest consequence is a bar that judges a first run
on the criteria it CAN score (M7 omitted), with the warm bar unchanged. This is **not** a lowered bar:
every criterion is 0/1, so requiring a mean of 1 over the remaining eight demands **all eight**, exactly
as the warm bar demands all nine. Nothing is relaxed except the criterion the run legally cannot earn.
The rejected alternative — M7=1 on a first run — is covered in §1 (meaning (B), false green).

## 3. Changes

### 3.1 `src/lib/maker-score.ts` — M7 states its real definition + no vacuous mint

- `m7Learning` (`:656`) docstring now says M7 is a non-regression claim against a prior that **carried
  substance**, that a first run is 0 because there is no lesson to reuse, and that this is why the bar is
  per run kind (never lowered).
- New guard at `:663`: `if (priorSum === 0)` ⇒ `0` with evidence
  `"prior same-domain run carries no M1+M2+M3 substance (…) — nothing was learned to reuse"`. This closes
  the 8 stored `m7=1`-vs-zero-prior mints.
- Module header (`:32-37`) updated to match the bytes.

### 3.2 `src/lib/maker-score.ts` — the pure per-run-kind bar machinery (`:760-828`)

- `MakerRunKind` = `"first" | "warm"`; `MakerBarWhen` = `{ meanAtLeast; firstRun?: { meanAtLeast; excludeCriteria } | null }`.
- `FIRST_RUN_UNSCOREABLE_CRITERIA = ["M7"]` (exported so the driver and the grader JSON cite one list).
- `runKindOf(prior)` → `"warm"` iff a prior exists, else `"first"`.
- `barForRunKind(when, runKind)` → `{ meanAtLeast, excludeCriteria }`; `firstRun` applies only to first
  runs, and a grader with no `firstRun` block keeps the warm bar (back-compat).
- `criteriaMeanExcluding(card, exclude)` → mean over the remaining criteria (0, never NaN, if all excluded).
- `meetsRunKindBar(card, when, runKind)` → `{ ok, mean, meanAtLeast, excludeCriteria }`. Rubric clause only;
  the run-side files/content/behavior/kind clauses stay with the driver.

### 3.3 `research/eval-corpus/graders/*.grader.json` (all 11) — the declared bar

Inserted after `"meanAtLeast": 1` in every `passWhen`:

```json
"firstRun": {
  "meanAtLeast": 1,
  "excludeCriteria": ["M7"],
  "note": "342-3: a first run has no prior same-slug run, so M7 (learning) is 0 by construction (maker-score m7Learning); judge it on the criteria it can score — the mean over the remaining eight must be 1, exactly as the warm bar demands all nine. Warm runs (a prior exists) keep meanAtLeast over all nine."
}
```

Patch-only: +5 lines per grader, 0 deletions, LF preserved (no reformat). Warm `meanAtLeast` is
**unchanged**. All 11 still load through the real `parseGrader` (unknown `passWhen` keys tolerated) —
verified by `$env:TEMP\rt342_3\graders-load.mjs` over `run-eval.mjs`'s own `loadGrader`/`parseGrader`.

## 4. Validation

### 4.1 Stored-results recompute (no keyed spend)

`$env:TEMP\rt342_3\recompute.mjs` drives the **real** `maker-score.ts` exports over `results.json` +
`history.json`:

```
results.json coffeehouse: total 3/9 mean 0.3333 · prior {1,0,0} -> kind warm
  · rubric clause old(mean 0.3333 >= 1)=false new(mean 0.3333 >= 1)=false
  · filesOk=false contentOk=false => pass stays false
  · hypothetical FIRST-run reading of the SAME card: mean 3/8 = 0.3750 >= 1 = false
history first-run rows (6 slugs @ 2026-09-08, keyless): total 4/9 · non-M7 mean 0.5 >= 1 = false
```

So the change mints **no** pass the old bar refused; the stored artifact stays a fail, correctly.

### 4.2 RED / GREEN (both runtimes)

**RED-1** (`m7Learning` guard, before): `not ok 2 - a substance-free prior is not a lesson — it mints no
learning point` · `AssertionError: 1 !== 0` · `# tests 83 · # pass 82 · # fail 1`.
**GREEN-1** (after): `ok 2 - …` · `# tests 83 · # pass 83 · # fail 0`.

**RED-2** (bar helpers, before implementation): `SyntaxError: The requested module './maker-score.ts'
does not provide an export named 'FIRST_RUN_UNSCOREABLE_CRITERIA'` · `# tests 1 · # pass 0 · # fail 1`.
**GREEN-2** (after): `# tests 91 · # pass 91 · # fail 0` on host Node v24.15.0 **and** pinned Node v22.23.2.

The three required proofs are real assertions in `maker-score.test.ts` §"342-3 per-run-kind corpus bar":
`(a)` an 8/8 card (M7=0) clears the first-run bar; `(b)` a keyless-floor card ({M1..M4,M7}=0) still fails
at 4/8; `(c)` the same 8/9 card fails the warm bar and clears it only once M7=1.

### 4.3 Gates on owned files

- `maker-score.test.ts` **91/91** host + Node 22.
- `tsc --noEmit`: **0 maker-score errors**. (The full tree is red *only* from other lanes' concurrent
  mid-wave edits — `src/lib/engine.test.ts:381…` and `src/lib/headless.test.ts:2135` `researchLive`; not
  mine, not touched.)
- `eslint src/lib/maker-score.ts src/lib/maker-score.test.ts` → exit 0.

## 5. STOP-and-REPORT — the consumer is `scripts/run-eval.mjs` (not this lane's)

The declared `firstRun` block is **inert until the driver selects it by run kind**. Exact shape:

1. **`parseGrader`** (`run-eval.mjs:~436-521`): read `pw.firstRun` and carry it on the returned
   `passWhen`: `firstRun: firstRunMeanAtLeast !== null ? { meanAtLeast: firstRunMeanAtLeast,
   excludeCriteria: firstRunExclude } : null` (validate `0 < meanAtLeast <= 1` and each
   `excludeCriteria` against `{M1..M9}`, mirroring the existing `meanAtLeast` guard).
2. **`runTrial`** (`run-eval.mjs:2298`): hoist `const prior = priorFor(slug);` (already computed for the
   card) and persist `runKind: prior ? "warm" : "first"` (or maker-score's `runKindOf(prior)`) onto
   `entryRow` — `passesAcceptance` gets the row, not the prior.
3. **`passesAcceptance` / `acceptanceFailReason`** (`run-eval.mjs:2454` / `:2474`): replace the raw
   `row.mean < grader.passWhen.meanAtLeast` with
   `const bar = barForRunKind(grader.passWhen, row.runKind === "warm" ? "warm" : "first");
    const effMean = criteriaMeanExcluding(row, bar.excludeCriteria);`
   and compare `effMean < bar.meanAtLeast`; name the first-run bar + excluded criteria in the reason.
   Extend the import at `run-eval.mjs:97` with `runKindOf, barForRunKind, criteriaMeanExcluding`.
4. **`scripts/run-eval.test.mjs`** (not this lane's): add a pin that `passesAcceptance` on an 8/9 card
   with `runKind:"first"` is true and with `runKind:"warm"` is false.

Until (1)-(3) land, `pass@1` is unchanged end-to-end.

## 6. Mock / fake census

Files changed: 11 grader JSON (+5 each) + `maker-score.ts` (+101/-3) + `maker-score.test.ts` (+107).
**0** `TODO` bodies, **0** `as any`/`@ts-ignore` variants, **0** silent `catch {}`, **0** hardcoded-return
fakes, **0** unfalsifiable tests. Scratch `.mjs` are throwaway drivers over real repo code; no mocks.

## 7. Verdict

M7 honestly measures *"the prior run's learned substance was carried forward"*; a first run cannot score
it, so the 10/10 bar was unreachable by arithmetic — and by construction, not by capability. The fix is a
declared per-run-kind bar (`firstRun`, M7 excluded, every remaining criterion still required) plus a
tightened M7 that stops minting learning points from substance-free priors. Under it, a first run that
genuinely satisfies its eight scoreable criteria (the §2 8/9 keyed fixtures) is judged on its real
criteria, while the stored warm run (3/9) and the six stored keyless first runs (4/9) still fail — no
false green. **However, this lane alone does not move `pass@1`:** the bar is encoded and unit-proven, but
the driver (`scripts/run-eval.mjs`) does not yet select it, so `pass@1` keeps its old value until the
STOP-and-REPORT in §5 lands. Once wired, `pass@1` on a first run becomes a real capability statement
(8/8 or it fails) instead of a threshold artifact — *provided* the keyed P6 synthesis actually earns
those eight, which remains the binding product blocker (`fixes/341_0_parent.md` §5.1).

## 8. What remains / honest caveats

- **The driver selection is the missing half (§5).** Until `run-eval.mjs` reads `passWhen.firstRun` and
  selects by run kind, the new grader block is declared-but-inert and `pass@1` is byte-unchanged at run time.
- **Substance-free-prior interaction (new, deliberate).** `priorFor` returns the last history row
  whatever its mode. A slug whose only prior is the keyless floor (`{0,0,0}`) now yields M7=0 under §3.1,
  so a subsequent warm run is judged at the full 9/9 and will fail until it both grows real M1+M2+M3 and
  records a substance-bearing prior. That is the honest reading of "reuse a real lesson", but it makes
  the warm bar harder than the pre-342-3 bytes for that specific slug state — flagged, not hidden.
- **The positive first-run case rests on `fixes/341_2_provider-key.md` §2, not on a stored repo artifact.**
  The repo's `research/eval-out/results.json` is a single *warm* 3/9 run; the four 8/9 keyed fixtures that
  would now clear the first-run bar live only in that log (their scratch dirs were removed). Re-deriving
  them requires a keyed run — out of this lane's 0-key budget.
- **Other lanes are mid-edit in the shared worktree** (`headless.ts`/`engine.test.ts`/`run-eval.mjs` etc.),
  so the tree-wide `tsc`/suite is red for reasons outside this lane; only owned-file results are claimed above.

---

## 9. 342-3 vB (verifier B) — bar trust, the keyless floor, and M7's learned substance

**Scope.** `src/lib/maker-score.ts` + `src/lib/maker-score.test.ts` only (STRICT); `scripts/run-eval.mjs`
and the grader JSON are another lane's (STOP-and-REPORT below). No keyed calls (0). No tracked-file
deletions. Scratch `$env:TEMP\rt342_3\`. **No full gate** — `maker-score.test.ts` on host Node v24.15.0
and pinned Node v22.23.2, plus a read-only recompute over `research/eval-out`.

### 9.1 The bar no longer trusts the grader (hole 1)

`parseGrader` accepts any `firstRun.meanAtLeast ∈ (0,1]` and any `excludeCriteria` subset of the nine,
so `{meanAtLeast:0.5, excludeCriteria:["M7"]}` (a 4/8 floor card then passed) and
`{meanAtLeast:1, excludeCriteria:["M1","M2","M3","M4"]}` both parsed ok. `barForRunKind` now NORMALIZES
the declared block instead of trusting it: exclusions are intersected with
`FIRST_RUN_UNSCOREABLE_CRITERIA` (today `["M7"]`) and the threshold is forced to
`FIRST_RUN_BAR_MEAN_ATLEAST` (1 — every remaining criterion). A weaker first-run threshold and an
exclusion of a scoreable criterion are defects that can no longer loosen the bar, whoever wrote the JSON.
New exported companion `firstRunBarIsAdmissible(when) → {ok, defects[]}` exposes the same rule so a loader
can REJECT such a grader loudly (STOP-and-REPORT §9.5).

### 9.2 The keyless floor is structural, not empirical (hole 2)

The `fixes/154` F1 card-level floor gate fired only on `synthesisSucceeded === false`; keyless runs pass
`undefined`, so a keyless card was scored on floor-shaped greens and "the keyless floor fails" held only by
the stored numbers. `scoreMaker` now extends the SAME override to a keyless run — `journey.outcome ===
"keyless"`, `driveP6Journey`'s honest no-op (the only keyless discriminator the pure scorer receives, set by
the driver at `run-eval.mjs:2142/2147`) — forcing M1–M4 to 0 with the new exported
`KEYLESS_FLOOR_QUALIFIER_EVIDENCE`. A keyless card is now pinned to M5,M6,M7,M8,M9 (5/9 warm, 4/8 first-run)
— below every admissible bar by construction. A keyed run with a real journey but no attempt logs stays
legacy (byte-identical), which is why the F1 `true === undefined` pin still holds.

### 9.3 M7's "prior substance" now means LEARNED substance (hole 3)

The prior-substance test summed `m1+m2+m3`, so a prior of `[0,1,0]` — M2 alone, the deterministic tree-run a
keyless/floor run earns — anchored a learning claim. `m7Learning` now uses M1+M3 for BOTH the
prior-substance guard and the non-regression comparison (`mineLearned ≥ priorLearned`); M2 remains in the
evidence line but can no longer anchor or mask learning. Of the 29 stored `m7=1` rows, the 8 all-zero-prior
mints stay closed (342-3) and the 19 `[0,1,0]`-prior mints are now withdrawn (vB): 27 of 29 no longer mint.
The module header and both docstrings state the narrower truth.

### 9.4 RED / GREEN (real output, both runtimes)

**RED** (behavioral tests added first, against the pre-vB bytes):
`not ok 6 - a prior whose only substance is M2 (the deterministic tree-run) is not learned substance — M7=0`
(`expected 0 · actual 1`) · `not ok 9 - barForRunKind ignores a first-run threshold below 1 …` ·
`not ok 10 - barForRunKind clamps first-run exclusions to the genuinely unscoreable set (M7 today)` ·
`not ok 11 - meetsRunKindBar: the keyless floor cannot pass a loosely-declared first-run bar`
(`expected false · actual true`) · `not ok 12 - (d) a keyless card cannot clear the bar by construction`
(`expected 0 · actual 1`) · `# tests 97 · # pass 92 · # fail 5`.

**GREEN** (after): host `# tests 99 · # pass 99 · # fail 0`; Node 22 `# tests 99 · # pass 99 · # fail 0`.
(The +2 tests are the new `firstRunBarIsAdmissible` and `FIRST_RUN_BAR_MEAN_ATLEAST` pins.)

**Stored-result recompute** (`$env:TEMP\rt342_3\recompute-vb.mjs`, real `maker-score.ts` exports,
read-only):
```
A. results.json coffeehouse2home (warm 3/9, prior {1,0,0}): old warm mean 0.3333 >= 1 = false;
   tightened mean 0.3333 >= 1 = false; filesOk=false contentOk=false => pass stays false;
   hypothetical first-run reading 0.3750 >= 1 = false
B. history (40 rows): old bar 2 pass, tightened bar 2 pass, newly passing 0.
   six stored keyless first runs: 4/9 -> first-run mean 0.5000 >= 1 = false
C. stored m7=1 rows: 29. 342-3 (all-zero-prior guard) still mints 21; vB (M1+M3 learned guard) still
   mints 2 — the 19 M2-only-prior claims plus the 8 exact-zero ones are withdrawn.
```
No stored row newly passes; the change mints no false green and withdraws 27 false learning points.

### 9.5 STOP-and-REPORT (not this lane's files)

`barForRunKind` is now safe on its own, so the driver needs no change for correctness. Two optional
wire-ups, exact shapes, for the owner of `scripts/run-eval.mjs` / the grader JSON:

1. **Reject a loose `firstRun` block at load** instead of silently normalizing it. `run-eval.mjs` already
   imports from `../src/lib/maker-score.ts` (`:97`); add `firstRunBarIsAdmissible` to that import and, in
   `parseGrader` after the existing `firstRun` validation (`:448-477`), return
   `{ok:false, error:`RT_E_VALIDATION: passWhen.firstRun ${verdict.defects.join("; ")}`}` when
   `firstRunBarIsAdmissible({meanAtLeast, firstRun}).ok === false`.
2. **Name the driver's own sets from the constant** (closes the §3.2 claim corrected in §9.6): replace
   `run-eval.mjs`'s local `CRITERIA_IDS` (`:444`) exclusion role and the 11 graders' hardcoded
   `excludeCriteria: ["M7"]` with `FIRST_RUN_UNSCOREABLE_CRITERIA`, so validator, bar, and JSON cite one
   list. Until then, `barForRunKind` consumes the constant in production but the driver/JSON do not.

Also flagged, not fixed (driver-side): `rubricMeanForRow` defaults an absent/unknown `row.runKind` to
`"first"` (`run-eval.mjs:2523`); every live row carries `runKind`, but an external caller handing a warm row
without it would get the M7-excluded bar.

### 9.6 Correction to §3.2 (append-only; the §3.2 sentence is false against the bytes)

§3.2 line 68 says `FIRST_RUN_UNSCOREABLE_CRITERIA = ["M7"]` is *"exported so the driver and the grader JSON
cite one list."* That was false when written (its only importer was its own test; the driver defines its own
`CRITERIA_IDS`; all 11 graders hardcode `["M7"]`), and it is still false after vB: the driver and JSON still
do not import it. Accurate status: the constant is now **consumed in production by `barForRunKind`**, and its
one admissible role is exposed to loaders via `firstRunBarIsAdmissible` — but the driver and grader JSON do
not yet cite it (wire-up #2 in §9.5). The sentence should be read as corrected to that.

### 9.7 What remains / caveats

- **The driver selection is still the missing half (§5).** Unchanged by vB: `run-eval.mjs` reads
  `passWhen.firstRun` and selects by run kind (verifier B confirmed the wiring at `:2329/:2523`), so
  `pass@1` moves only once the keyed P6 synthesis earns the eight — the product blocker, not this fix.
- **Keyless detection is journey-based.** The pure scorer's only keyless marker is `journey.outcome`, fed by
  the driver's keyless `driveP6Journey`. A hypothetical caller scoring without journey evidence gets legacy
  behavior; the code says so at the gate.
- **M7's learned-substance set is M1+M3 by construction, not by proof.** The prior evidence carries only
  `{m1,m2,m3}`, so the criterion can exclude the deterministic tree-run (M2) but cannot itself distinguish a
  floor-shaped M1/M3 from model-produced ones; the F1 card-level floor is what keeps a fully-keyless card
  out, and it is now structural (§9.2).
- **Not re-measured:** end-to-end keyed `pass@1`, the full gate, and `run-eval.test.mjs` (not this lane's
  and not run per the no-full-gate rule) — the tightened `barForRunKind` could change a synthetic run-eval
  test that declares a non-1 first-run threshold or exotic exclusions; the current pin uses `meanAtLeast: 1`
  with `["M7"]` and is unaffected.
