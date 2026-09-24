# fixes/216z — W10 landing record: engine truth (T-11) · token ledger (T-107.6) · verify-kind install leg (T4.1/TA-16)

**Status:** COMPLETE (parent-written close record, 2026-09-24).
**Why this file exists:** W10 was dispatched 2026-09-17 (`wave_plans/W10/lane-1..5.md`) with five
lanes. L4 and L5 wrote their deliverables (`fixes/216x`, `fixes/216y`). **L1, L2 and L3 landed
their code edits but never wrote a landing log**, and the wave was **never verified or closed** —
no `gate.sh` run, no §7 changelog entry in `taskuniverselog.md`, 7 files left uncommitted for
seven days. On 2026-09-24 the parent (this session) verified every landing against the bytes,
repaired what was stale, and wrote this record. Where a lane's own log is missing, this file is
the substitute — and says which lane's evidence is second-hand.

**Provenance rule used throughout:** every claim below is either (a) a command run by the parent
on 2026-09-24 and pasted here, or (b) explicitly attributed to the lane's on-disk artifact. No
lane self-report is treated as evidence.

---

## §1 — What W10 landed (verified against bytes)

### L1 — engine truth: the T-11 green-seal gate + the §3 shortfall caller
**Files:** `src/lib/engine.ts`, `src/lib/knowledge.ts` (both confirmed modified vs `aa12c6c`).

1. **T-11 half 1 — a RED seal no longer mints a lesson.** `applyPhaseResult`'s seal block now
   computes `const r = runGate(merged, phase)` and, when `!r.pass`, records
   `{ ts, phase, level: "warn", event: "p<phase>.seal.unmet", detail }` instead of minting an
   `L2 template-emission` lesson row. The old mint path (`failureLessonFromRecord` via the
   `LessonSurface` seam) was **removed from `engine.ts`** along with its two now-unused type
   imports; `knowledge.ts`'s `failureLessonFromRecord` and its `refuse:no-proof` floor are
   untouched (the surviving writers — headless keyed refusals, report-intake — still use it).
   The detail carries the unmet DoD **probe ids** in a bracket head plus the fitted digest:
   `red seal — 2 unmet DoD probe(s) [p6-verified, p6-brief-fit]: unmet: …`.
   A stale-read guard suppresses a duplicate row when the same unmet gate is re-sealed.
2. **T-11 half 2 — `probe:<id>` tags on lesson rows. ⚠️ STRUCK (FALSIFIED 2026-09-24 by W11-L2).**
   `knowledge.ts` gained `probeTagsFromSignature(signature)` (module-private), which *would* read
   the `anchors:` segment back off a row's own `failureSignature` and tag the row `probe:<id>` per
   anchor — but **it is never called** (`knowledge.ts:911` defined, zero call sites; W11-L2's probe
   printed `writer_has_probe_tag: false` for both `lessonRow` and `templateEmissionLesson`, and
   `lessonRow`'s tags are byte-identical to `HEAD`). This item was originally written here as
   *"every existing and future writer inherits them"* — **that was an over-claim and is struck**
   (declare-or-strike, `AGENTS.md` §honesty 3). The honest status: **the tag half of T-11 is
   UNWIRED**; the one-line repair (call it from `lessonRow`'s tag assembly) is owned by the parent
   and blocked until W12-LC releases `knowledge.ts`. The `lessonRow` docstring carries the same
   over-claim and must be corrected with the wiring.
3. **§3 — `p6.jobs.shortfall` has a production caller.** `engine.ts` gained
   `jobLabelFromPurpose` (a local 4-line copy of the scaffold's label rule — deliberately not an
   import, see the H2 seam note in the code) and `export function p6JobsShortfallLog(project)`,
   which counts declared `lattice.jobs` against materialised `job-*` spec-graph nodes using
   `doctor.ts`'s **one** derivation (`jobScopeShortfall`) and returns a `null`-or-row; a P6 apply
   appends only a non-null row (zero-shortfall applies return the same logs array untouched).

**Verification (parent, 2026-09-24):**
- `node --experimental-strip-types --test src/lib/lesson-writers.test.ts` → **15/15 pass** after
  the repairs in §3 (the pre-repair run failed 4 tests that pinned the *old* behaviour — those are
  the strongest evidence the gate is live).
- Parent probe (`C:/Users/mnril/w11probe/probe-memory.mjs`, outside the repo): a P6 apply on the
  parked fixture prints `seal log: ["p6.seal.unmet"]` and the **only** new memory row is the
  pre-existing non-lesson `6-episodic-0.86 | Sandbox passed: tests.pass` — i.e. **zero** lesson
  rows minted on a red seal, exactly the T-11 contract.

### L2 — T-107.6: cache-aware token ledger + the runner output cap
**Files:** `src/lib/token-ledger.ts` (+265 lines), `src/lib/token-ledger.test.ts` (+219 lines),
`src/lib/node-runner.server.ts` (+105).

1. **Ledger (verified by reading the diff + running the suite):** cache fields accumulate on
   `TokenSpend`/`TokenLedger` **only when a sample reports them** (legacy 3-key shape stays
   byte-identical), plus the `TokenBudget` seam (`createTokenBudget`, `budgetCap`,
   `recordBudgetSpend` = record-then-signal with spend never clamped, `assertBudgetHeadroom`,
   `isBudgetExhausted`), `estimateCostUsd` with caller-supplied prices, and `billableInputTokens`.
   `token-ledger.test.ts` grew 219 lines covering the byte-identity of the legacy shape.
2. **Runner cap (verified wired, not merely exported):** `RUNNER_OUTPUT_MAX_CHARS = 48_000` +
   `clampRunnerOutput` + `RunnerOutputClamp`; `runNodeBounded` now redacts **then** clamps both
   streams and attaches `outputClamp` to the ok envelope **only when a stream actually crossed
   the cap** (unclamped envelopes stay byte-identical). `RUNNER_OUTPUT_MAX_CHARS` mirrors the
   Cline 48 000-char head/tail truncation cited in dossier 107 §9 row 1.

**Verification:** `token-ledger.test.ts` is in the green 1919/1919 lib run; the wiring was
confirmed by reading `runNodeBounded`'s diff. ⚠ **`clampRunnerOutput` itself has no dedicated
test yet** — W11-L2's `src/lib/honesty-guards.test.ts` is the assigned owner (no-op below cap,
counted elision above cap).

### L3 — T4.1/TA-16: the verify-kind install leg
**Files:** `src/lib/compile-check.server.ts` (+420), `scripts/rapidtool-cli.mjs` (±5).

1. `verifyKindDir` is now `async` and performs the real leg the W9-L5 spike proved was missing:
   fresh `mkdtempSync` scratch copy (top-level `node_modules`/`.git` intentionally NOT copied) →
   `installToolFor(copy)` resolves the honest tool (`npm ci --no-audit --no-fund` when a
   `package-lock.json` is present, else `npm install --no-audit --no-fund`, with the reason
   recorded on the envelope) → the tree's own declared `build` and `test` scripts, each bounded.
   Verdicts are per-step (`pass`/`fail`/`timeout`/`error`/`skip`); a red install **short-circuits**
   the scripts with an explicit "was NOT executed" note; a coded failure is
   `RT_E_VERIFY_KIND_FAILED` (`RT_E_VALIDATION` when the subject is not a kind dir). A no-`build`
   tree keeps the honest skip. `opts.installCommand` is a **test seam** and its verdict is marked
   `mocked: true` — "never evidence of a real one", asserted by the repaired test in §3.
2. `scripts/rapidtool-cli.mjs` `emit --verify-kind` now **awaits** the promise.

**Verification:** the CLI leaf's change and the async contract are exercised by the repaired
`src/lib/compile-check.server.test.ts` (green) plus the repo-wide `npm run typecheck` → 0 errors.

### L4 / L5 — as recorded in their own files
`fixes/216x_t11_verification_and_108t7_spike.md` (L4, COMPLETE 2026-09-17: the T-11
FAILS-today evidence, the byte-identical probe re-run, and the 108-T7 decision/gating) and
`fixes/216y_oracle_and_error_audits.md` (L5: the TA-11 oracle-strength audit — pin classes
REAL/GUARDED/OBSERVED-ONLY/SKIP with the weakest-classes list — and the TA-12 error-handling
audit with its ranked defect ledger **G1–G7**). Both were read by the parent; both are internally
consistent and none of their claims contradicted the bytes the parent checked.

---

## §2 — Gate state on the frozen W10 tree (parent run, 2026-09-24 09:53–10:00)

`bash scripts/gate.sh` → **RED**, exactly two gates:

| Gate | Result | Cause (attributed by file:line) |
|---|---|---|
| typecheck | **exit 2** (68.4 s) | `src/lib/compile-check.server.test.ts(694,695,706)`: `Property 'ok'/'skipped' does not exist on type 'Promise<VerifyKindResult>'` — the L3 async change left two **sync** call sites |
| lint | exit 0 (68.2 s) | — |
| assertionGaps | exit 0 (1.8 s) | — |
| tests (scripts) | exit 0 (56.8 s) | — |
| tests (lib) | **exit 1** (231.3 s) | 1920 tests, **7 fail**: 4 in `lesson-writers.test.ts` (stale pre-T-11 pins) + 2 in `compile-check.server.test.ts` (the sync-call assertions) + 1 unattributed (see §4) |
| build | exit 0 (138.0 s) | — |

**Attribution discipline:** the tree was frozen — no lane was running (W10 died on 2026-09-17);
`git status` showed only the seven W10 files modified, and their mtimes were all 2026-09-17. All
red is therefore W10's own, not a sibling's.

## §3 — Parent repairs (every intentional test change records old → new)

1. **`src/lib/compile-check.server.test.ts` — `describe("B1 verifyKindDir")` (2 tests).**
   - *Test 1 "skips honestly when there is no build script".*
     **old:** `const r = verifyKindDir(dir)` then `assert.equal(r.ok, true)` /
     `assert.equal(r.skipped, true)` — a Promise compared with booleans.
     **new:** `await`, plus two added assertions proving the leg **did not run at all** for a
     no-build tree (`r.scratch === false`, `r.install === undefined`). Nothing weakened.
   - *Test 2 "runs the declared build script and reports fail honestly".*
     **old:** sync call, `timeoutMs` only, single `assert.equal(r.ok, false)` — under the new
     contract this tree would attempt a **real `npm install` over the network**.
     **new:** rides the documented `installCommand` seam (`node -e "process.exit(0)"`), and
     asserts the full honest picture: `scratch === true`, `install.run === "pass"`,
     **`install.mocked === true`** (the honesty marking cannot silently regress),
     `build.run === "fail"`, `build.exitCode === 2`, `code === "RT_E_VERIFY_KIND_FAILED"`.
2. **`src/lib/lesson-writers.test.ts` — 4 tests pinned the pre-T-11 contract; all 4 rewritten.**
   - *`describe("L2 — template-emission lesson at engine seal")` → `describe("T-11 (106 §6, F-08)
     — a RED seal mints no lesson; the signal is an honest log")`.*
     **old:** asserted `lessons.length >= 1`, the row's id/kind/source/tags, a ≤240-char text
     budget, and a `lesson.capture` ledger event — i.e. **it asserted the F-08 defect**.
     **new:** asserts `lessons.length === 0`, **no new `lesson-` row of any class**, **no
     `lesson.capture` event**, and the replacement record: a `level:"warn"`, `phase:6`
     `p6.seal.unmet` row whose detail matches
     `^red seal — 2 unmet DoD probe(s) \[p6-verified, p6-brief-fit\]: `, still carries the first
     unmet criterion **verbatim**, and keeps the ≤240-char digest budget.
   - *`describe("fixes/144 M5-1 — L2 seal rows carry the unmet criteria verbatim + refusal class")`
     → `describe("fixes/144 M5-1 + T-11 — the red-seal evidence digest … rides the seal log")`.*
     **old:** three tests asserted the digest on the **lesson row**'s `text` (verbatim unmet +
     `class:` + `tail:`), the 240 budget, the row's content-addressed id, and the no-fork
     idempotence of a re-seal.
     **new (M5-1's intent PRESERVED, relocated):** the P7 digest is asserted **byte-exactly** on
     the `p7.seal.unmet` **log detail**
     (`red seal — 1 unmet DoD probe(s) [p7-research]: unmet: Live research corpus exists for P7
     (≥1 fetched finding) · class: RT_E_LLM_REJECTED · tail: the pro tier refused to emit an
     offline warehouse scan module`), the class clause still survives the P6 long-unmet budget,
     a red seal mints no lesson row, and a re-seal adds **no duplicate log row**. The middle
     test's P6-criteria-verbatim assertion moved into repair 2's first test (same claim, one
     home) — **net test count 16 → 15**, which is why the repaired lib leg reports 1919, not 1920.
3. **Not repaired, deliberately:** the removal of `failureLessonFromRecord` from the engine's
   `LessonSurface` seam is L1's intended design (the brief ordered it), and
   `knowledge.ts:failureLessonFromRecord` remains for its surviving callers. No revert.

## §4 — Honest gaps and debt this close does NOT fix

1. **L1/L2/L3 landing logs never landed.** `fixes/` had no `216z`/equivalent for them; this file
   is the parent's substitute and is **not** a lane self-report. Their per-lane briefs are still
   the only record of their intent (`wave_plans/W10/lane-{1,2,3}.md`).
2. **The 7th lib failure is unattributed.** The gate's stderr prints only the last 30 lines, and
   the run's per-test names were not retained before the temp dir was cleaned, so 6 of 7 failures
   are localized to file:line and the 7th is not. The most likely explanation is an **unhandled
   rejection** from the floating Promise the sync call returned (the async leg continued after the
   assertion failed; node's test runner counts an unhandled rejection as its own failure) — that
   is a hypothesis, labelled as one. The repaired tree runs **1919/1919 green**; the final
   `gate.sh --double` run at the W11 boundary is the acceptance record that would surface it as a
   flake if it recurs.
3. **New W10 exports without tests.** `p6JobsShortfallLog` (engine), the `probe:<id>` tag path
   (knowledge), `clampRunnerOutput`/`RUNNER_OUTPUT_CLAMP` (node-runner), and `installToolFor`
   (compile-check) shipped with **zero dedicated tests**. Assigned: W11-L2
   (`src/lib/honesty-guards.test.ts`) and W11-L1 (`installToolFor` + the install-leg tests).
4. **Nothing in W10 was exercised keyed.** No LLM path ran (`doctor` reports
   `llm.configured:false`); the T-11 gate is verified keyless/deterministic only.

## §5 — Evidence index (commands actually run by the parent, 2026-09-24)

```
bash scripts/gate.sh                                  → typecheck exit 2 · lint 0 · gaps 0 ·
                                                        scripts 0 · lib 1920/7 fail · build 0
npm run typecheck                                     → exit 0 (post-repair)
node --experimental-strip-types --test src/lib/lesson-writers.test.ts
                                                      → # tests 15 / # pass 15 / # fail 0
node --experimental-strip-types --test "src/lib/**/*.test.ts"
                                                      → # tests 1919 / # pass 1919 / # fail 0
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor
                                                      → ok:true · autonomousSoftwareFactory:false ·
                                                        4 gaps · isolation.note "NOT Docker, bwrap,
                                                        or a security sandbox"
node --experimental-strip-types C:/Users/mnril/w11probe/probe-memory.mjs
                                                      → NEW ROW: 6-episodic-0.86 | Sandbox passed:
                                                        tests.pass · seal log: ["p6.seal.unmet"]
git diff --stat                                       → the 7 W10 files (+1111/−114)
git status --short                                    → 7 modified + 3 untracked (216x, 216y, W10)
```
