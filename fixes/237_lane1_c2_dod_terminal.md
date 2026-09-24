# fixes/237 · LANE 1 — C-2: a hard-DoD stop is a coded terminal stop in the run-eval drain

**Wave:** W14 · **Lane:** 1 · **Row:** `223` §4 C-2 / `230` OV-5(a) / `220` (M9 leg)
**Owner:** W14-L1 subagent · **Date:** 2026-09-24 · **Tree:** uncommitted on top of `7582771` (C-1 just landed)
**Status:** LANDED — drained exits the FIRST `dod` round as a coded terminal stop; tests green; headless suite kept at 91/91.

## Bottom line

A hard-DoD stop (`outcome:"dod"`, `stopped:true` — `headless.ts:587-606`) is now a **TERMINAL, CODED** stop in the
drain: the driver returns `position:"dod"`, `onTime:true`, `stall = <the hard-DoD message>`, `code:"RT_E_GATE_PENDING"`.
Measured before/after on the same input: **80 `dod.blocked` rows → 1**, `"stalled"` → `"dod"`, `onTime:false` → `true`,
`code:null` → `RT_E_GATE_PENDING`. M9's loud-coded-stop branch is now reachable and reads
`"refused run parked LOUDLY with code RT_E_GATE_PENDING"` (score 1; pre-fix evidence: `"run did not stop on time
(cap/overrun without terminal state)"`, score 0). `status:"dod"` is unchanged — a hard stop is never converted
into `"complete"`.

## What was wrong (WB-2, `223` §2)

- `headless.ts:587-606` — `runUntilGate` already returns `outcome:"dod"` with `stopped:true` (T0.4 hard-DoD stop).
- `run-eval.mjs` drain terminal set was `{complete, blocked, error}`, so a `dod` round fell through to
  "progress/cap — keep looping under the round guard" → ~80 no-op rounds appending `dod.blocked` rows → the 80-round
  guard exhausts → `position:"stalled"`, `onTime:false`, `code:null` → M9's first branch (0) and an observer sees a
  run that looks alive while it can never advance.

Pre-fix measurement (probe, see Evidence §2): `{ "roundOutcome":"dod", "position":"stalled", "onTime":false,
"stall":"drain iteration cap reached without a terminal state", "code":null, "dodRows":80, "cursor":1, "ms":7 }`.

## The change (files + exact seams)

| file | seam (post-edit anchor) | change |
|---|---|---|
| `scripts/run-eval.mjs` | `isTerminalDrainOutcome` `:656` | new exported PURE predicate over the seven `RunOutcome` values (`headless.ts:527`); `"dod"` is terminal; `"hitl"` (approved + continued) and `"progress"`/`"cap"` are not |
| `scripts/run-eval.mjs` | drain `:707` + dod branch `:707-731` | the terminal check now goes THROUGH the predicate; the `"dod"` branch exits on the FIRST round with `position:"dod"`, `onTime:true`, `stall` = the hard-DoD message (from `res.events`), `code:"RT_E_GATE_PENDING"` (the code the wild path already uses for the same hard block, `engine.ts:3571`) |
| `scripts/run-eval.mjs` | `drainPipeline` `:676` | additively exported (the test drives the real drain; the main-module guard at the file end is unchanged, so importing never starts a run) |
| `scripts/run-eval.mjs` | stop evidence `:937` | the drain's OWN coded stop wins in `stopCode` (refusal-synthesis code + legacy `RT_EVAL_STALL` remain fallbacks) |
| `scripts/run-eval.mjs` | row notes `:1043` | additive `stopCode` key — the coded stop is visible in the persisted results row |
| `scripts/run-eval.mjs` | `:819-824` | stale comment ("the honest stall evidence stands (M9=0)") corrected — a floor hard-stop now ends loud + coded |
| `scripts/run-eval.test.mjs` | `:480`, `:493` | two new pins (see below); file now 17/17 tests |
| `src/lib/headless.ts` | `"dod"` region `:587-606` | **NOT TOUCHED — 0 changed lines.** No change needed: the outcome already exists and `stopped:` already includes `"dod"`; the driver-side terminality was the whole defect, so the hot file stays as C-1 landed it |

The two new pins in `scripts/run-eval.test.mjs`:

1. `:480` — `isTerminalDrainOutcome` pinned for all seven `RunOutcome` values
   (`terminal = [complete, blocked, error, dod]`, `looping = [hitl, progress, cap]`, `Set.size === 7`).
2. `:493` — the drain itself: builds the `223` §C-2 probe shape (project COMPLETE at P1 with a red gate under
   `enforceDod:true`; the `headless.test.ts:1744` recipe), calls the REAL `drainPipeline`, and asserts
   `res.outcome==="dod"`, `position==="dod"`, `onTime===true`, `code==="RT_E_GATE_PENDING"`,
   `stall` matches `/DoD unmet/`, **exactly one** `dod.blocked` row (the "one round" observable), cursor unmoved,
   no gate approved.

## Evidence (every claim = a command run this session)

**1. RED-first** (after adding only the exports; drain behaviour untouched):
`node --experimental-strip-types --test --test-concurrency=2 scripts/run-eval.test.mjs` →
`# tests 17 · pass 15 · fail 2`
- `not ok 16 — dod must end the drain … false !== true` (predicate did not know `dod`)
- `not ok 17 — a hard stop parks as its own coded position, never a silent stall … 'stalled' !== 'dod'`
  (duration_ms 128.17 — the real 80-round spin inside the test)

**2. Pre/post measurement probe** (`C:/Users/mnril/w14l1_scratch/probe-c2.mjs`, outside the repo; same shape as
`223` §C-2's probeA step 3; `node --experimental-strip-types probe-c2.mjs`):

| field | BEFORE (unmodified drain) | AFTER (fix) |
|---|---|---|
| roundOutcome | `dod` | `dod` |
| position | `stalled` | `dod` |
| onTime | `false` | `true` |
| stall | `drain iteration cap reached without a terminal state` | `P1 DoD unmet — hard gate blocks advance: p1-graph.` |
| code | `null` | `RT_E_GATE_PENDING` |
| dodRows | **80** | **1** |
| ms | 7 | 1 |

**3. GREEN** (fix applied): `node --experimental-strip-types --test --test-concurrency=2 scripts/run-eval.test.mjs`
→ `# tests 17 · pass 17 · fail 0 · duration_ms 5506`.

**4. headless suite kept green** (its own targeted run):
`node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts`
→ `# tests 91 · suites 27 · pass 91 · fail 0` (unchanged from C-1's landing).

**5. M9 verdict probe** (`C:/Users/mnril/w14l1_scratch/probe-m9.mjs`; calls the pure `m9OnTime` with the driver's
exact before/after stop objects):
- before `{onTime:false, refused:true, loud:true, code:"RT_EVAL_REFUSED"}` → `score=0`,
  `"run did not stop on time (cap/overrun without terminal state)"`
- after `{onTime:true, refused:true, loud:true, code:"RT_E_GATE_PENDING"}` → `score=1`,
  `"refused run parked LOUDLY with code RT_E_GATE_PENDING"` ← M9's loud-stop branch
- after, no refusal signal `{onTime:true, refused:false, …}` → `score=1`, `"run stopped on time, no refusal — nothing to shout"`

**6. Lint (targeted):** `npx --no-install eslint scripts/run-eval.mjs scripts/run-eval.test.mjs` →
`errorCount:0 · warningCount:0` for both files (`--format json`).

**7. Change surface:** `git diff --numstat scripts/run-eval.mjs scripts/run-eval.test.mjs` → `65+/12−` (6 hunks) +
`58+/0−` (3 hunks); `grep` confirms only `run-eval.test.mjs` imports `run-eval.mjs` (no other suite pins its
source text — checked `scripts/*.test.mjs`).

## Honest notes / limits

- **No keyed execution** (no key on this host): the M9 *score* flip is not measured keyed. What IS measured: the
  drain's coded terminal stop (unit + probe) and the pure M9 criterion's verdict on that exact evidence (probe §5).
  The Step-0 keyed run (T0.10, owner-side) is the only remaining falsifier.
- **`status:"dod"` stays honest** — the results row keeps `status:"dod"` (`drain.res.outcome`); the change is the
  drain's POSITION/stop evidence, never a conversion to `"complete"`.
- **Two additive surface changes** beyond the minimal fix, both deliberate: `drainPipeline`/
  `isTerminalDrainOutcome` exports (needed to test the real drain; the driver only self-executes as main module)
  and the `notes.stopCode` key (the coded stop must be visible in persisted evidence — the done-when says "the stop
  carries a code"). No existing key removed or renamed.
- **Traced, not executed:** the keyed pre-drain (`p6Gate:true`) branch with a floor hard-stop — code-read only
  (`run-eval.mjs:819-824`); its behaviour follows the same drain branch, but no keyed scenario could be run here.
- **Do-not-rebuild (`220` §2) check:** this re-implements nothing on the list; it makes the EXISTING `"dod"` outcome
  terminal in the driver — exactly `223` §4 C-2's fix shape ("treat `dod` as terminal, code `RT_E_GATE_PENDING`").
  The code reused is the one the wild path already emits (`engine.ts:3571`), not an invented one.
- **Out of scope, left open honestly:** `RT_EVAL_STALL`/`RT_EVAL_REFUSED` are not in the `errors.ts` registry
  (pre-existing; unchanged by this lane).

*Provenance: W14-L1 subagent. Probes kept at `C:/Users/mnril/w14l1_scratch/{probe-c2,probe-m9}.mjs`. Every
command quoted above was run in this session; nothing here is a projection.*
