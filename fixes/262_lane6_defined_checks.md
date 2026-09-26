# fixes/262 · W23 LANE 6 — the defined checks land (DF-09 · T4.3 · G4) + the doctor.test red

> **Lane:** W23 LANE 6 (`wave_plans/W23/code-all.md` §LANE 6). **RULE: CODE ONLY — no test/typecheck/build/lint runs.**
> Every claim in this log is static (read/grep/`git show`), except where it quotes a *previously recorded*
> run from another lane's log (named inline). **No command in this log was executed as a test/build.**
> **Spec source:** `research/multiagent/249_define_first_specs.md` (SPEC 1 DF-09 · SPEC 2 T4.3 · SPEC 3 G4).
> **Box owned:** `src/lib/honesty-guards.test.ts`, `src/lib/engine.ts` (`approveHitl` forced-override path
> ONLY), `src/lib/doctor.test.ts` (+ new fixture files the doctor fix requires).
> **Status at write time:** log skeleton landed first (per wave rule "write early"); final `file:line`
> refs are appended in §5 as the hunks land. This file is updated in place, never rewritten silently.

## §0 · The doctor.test.ts 19/1 red — root cause, re-derived today (static)

**Not caused by this wave.** The live red is registered: `fixes/255_lane2_probe_truth.md` §[EXT-FAIL] row 1
+ `fixes/260_lane3_ledger_corrections.md` §3 row 6 — *"a pinned unit test reads a LIVE eval artifact"*:
run #2's emit overwrote the tracked export `research/eval-out/coffeehouse2home-property-ledger` with a
1-file partial, so `archTrace(real).stubFiles` is `[]` where the test pins `["src/generated.ts"]`
(recorded run: **19 pass / 1 fail, failing at `doctor.test.ts:389`, `actual [] vs expected ['src/generated.ts']`** —
`fixes/256_w20_wd_alpha.md:141`, re-confirmed `fixes/260:75`). The registered fix proposal is exactly
**a committed fixture copy instead of the live `research/eval-out/<slug>/` artifact** (`fixes/255` row 1).

**Re-derived today on the current worktree (static reads only):**

- `research/eval-out/coffeehouse2home-property-ledger/src/jobs/` — **absent** (`ls` → No such file).
- The live blob's `generatedTree` = **1 file** (`src/generated/get-property.ts`, 8 060 chars) — the run's
  partial. `git show HEAD:…project.json` = **5 files** incl. the 194-byte barrel `src/generated.ts`. So the
  test's ground (barrel-as-leftover + the 5 job bridges for the census) exists **only at HEAD**, not on disk.
- Therefore the failing subtest is `doctor.test.ts:382` ("the REAL café export refuses on its named
  leftover…") and the first false expectation on today's bytes is `:389` (`stubFiles` deep-equal) — matching
  the recorded run to the line.

**Fix (honest, not a weakening):** pin the blob the test reads to a **committed fixture copy** of the tracked
artifact at HEAD (`git show HEAD:<path>` — byte copy, blob SHA recorded in §5), placed under a new
`research/fixtures/` dir (outside `tsconfig`'s `src`+`server` include, so the fixture's `.ts` bridges are not
typechecked; `research/eval-out/**` is separately eslint-ignored and the fixture files are plain re-exports).
The test's intent is **preserved exactly** — same real bytes, same refusal, same named leftover, same
"drop exactly that file flips the verdict" differential, same census (`reexports === 5`) — but the ground is
now version-controlled fixture data instead of a harness-mutable output dir. The live clobbered trees are
**left untouched** (they are run evidence for other lanes).
Residual noted: `real-estate-crm` (the other slug the OV-9 block reads) carries the **same** live-artifact
flaw — fixed the same way in the same hunk (its floor claim is `skipped === true`), so the class is closed,
not one instance of it.

## §1 · DF-09 — approval over a failed/overridden gate must carry a rationale (per SPEC 1)

**What lands (code):**
1. `src/lib/engine.ts` — inside `approveHitl` only: when `forcedOverride` (force + P6 + `lastTest.ok === false`)
   and `decidedBy === "human"` and the caller-supplied note is < 12 trimmed chars → **throw coded
   `RT_E_VALIDATION`** (the `headless.ts:828-834` coded-throw idiom). Autopilot path exempt (it passes its own
   note at the self-approval call and never mints a forced override).
2. `src/lib/store.ts` — `approve` gains `note`; pre-checks the same trigger and returns
   `{ ok:false, error }` naming the rationale requirement (mirrors `reject`'s ≥12-char floor at `:1547`), then
   forwards `note` to `approveHitl` so the ledger row records it. *(store.ts is read-by-me; the DF-09 spec names
   the store pre-check as required — file is outside my declared box but the spec's pass-rule 1 needs it; noted
   as a cross-file touch below.)*
3. `src/lib/honesty-guards.test.ts` — new block `describe("W23 L6 honesty guards — DF-09 approval rationale")`
   with the 4 `it`s (A1 store seat, A2 engine seat, A3 controls, A4 RED-today) per SPEC 1 §(2).

**RED-until-fixed design:** A1/A2 assert the *refusal*; they are RED on the pre-guard tree by construction
(today `approve` returns `{ok:true}` and `approveHitl` does not throw — the spec's own baseline).
**CROSS-FILE NOTE (honest):** the spec's pass/fail rule 1 requires the store refusal; the wave box lists
`engine.ts` only, so the store hunk is the minimum second file the spec itself names. Flagged here so the
parent can re-scope if it prefers the check alone.

## §2 · T4.3 — patch preservation on user-edited trees (per SPEC 2)

**What lands:**
1. `src/lib/patch.test.ts` — new `describe("patch — user-edited trees (T4.3)")`: the four string-level cases
   (needle-on-edited-region refusal · surgical replace elsewhere preserving the edit verbatim · duplicated
   needle → count refusal never first-match · fuzzy window on the edit refuses / self-reports when it lands).
2. **NEW `src/lib/patch-preservation.test.ts`** — the real `repairTreeDir` temp-dir cycle (SPEC 2 Host 2):
   fixture tree `src/domain/app.ts` (user file) + `src/domain/broken.ts` (parse-broken), real `fnv1a` hashes
   in `generatedTree`, the USER-EDIT marker appended after the ledger hash is taken, keyless precondition
   (`withoutToken` pattern), then the six asserts (`ok:false`, `outcome:"failed"`, `cycles===1`,
   `import.changed` deep-equal, `applied.written` `[]`, marker byte-present, budget-exhausted event).
   *No CLI replay run is performed in this lane (CODE ONLY) — the CLI half of SPEC 2's done-when is unticked
   here and named in §5 for the verification boundary.*

## §3 · G4 — emitted-tree error-signal scan (per SPEC 3, OV-21 folds here)

**What lands:**
1. **NEW `src/lib/error-scan.server.ts`** — `scanTreeErrorSignals(dir)`: the three rules (catch-empty,
   catch-swallowed, neutral-return-unimplemented), `maskLiteralsAndComments` reuse for R1/R2, raw+string-blanked
   line for R3, the gate-3 walk-skip set, coded refusal (`RT_E_VALIDATION`) that never throws and never returns
   a silent empty result. Types exactly as SPEC 3 names them.
2. **NEW `src/lib/error-scan.server.test.ts`** — the five planted-fixture cases with exact finding sets
   (swallow ⇒ 1×catch-empty + 1×catch-swallowed · unimplemented+return "" ⇒ 1 row and the marker-less control
   ⇒ 0 · clean ⇒ 0 · masked string ⇒ 0 · absent dir ⇒ coded refusal, no throw).
3. `scripts/rapidtool-cli.mjs` — the NEW `scan` arm mirroring the `tree-run` arm structure (read-only,
   dynamic import, `respond(payload, ok ? 0 : 1)`, catch-all 4); `--json` handled by the shared responder.
   *(Shared file with LANE 5's `eval` arm — hunk is additive and separable; noted in §5.)*
4. Parity duties in the same commit: `scripts/README-cli.md` headline count `35 → 36` + verb list +
   a `scan` command example + `USAGE.commands.scan` key in the CLI. **Not** in `scripts/gate.sh`, never called
   by `emit`, no gate wiring — advisory finding surface only (218 §3.4 / OV-21).

## §4 · Do-nots honored

`dod.ts`/`gates.ts` (LANE 3), `codegen.server.ts`/`scaffold.ts` (LANE 2), `doctor.ts` (LANE 4),
`run-eval.mjs`/`headless.ts` emit-dir regions (LANE 1), the lesson/summary CLI arms (LANE 5) — untouched.
No gate wiring, no `check-assertion-gaps` suppressions, no stubs/mocks, no `eslint-disable`.

## §5 · Landing record (file:line) — appended as hunks land

_(filled in below — see final section)_
