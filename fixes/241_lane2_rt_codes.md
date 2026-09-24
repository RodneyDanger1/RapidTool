# fixes/241 · LANE 2 — C-2's registry gap: `RT_EVAL_STALL` / `RT_EVAL_REFUSED` + the `RT_E_*` sweep

**Wave:** W15 · **Lane:** 2 · **Source claim:** `fixes/237_lane1_c2_dod_terminal.md` "Pre-existing, left open" note
**Owner:** W15-L2 subagent · **Date:** 2026-09-24 · **Tree:** uncommitted on `7582771`
**Owns:** `src/lib/errors.ts`, `src/lib/errors.test.ts` (read-only: everything else; scratch `C:/Users/mnril/w15l2_scratch/`)
**Status:** LANDED — claim certified TRUE; decision: **STRUCK as registry items** (declare-or-strike, reason below);
boundary declared in `errors.ts` + pinned by 3 new tests; sweep: **0 other unregistered `RT_E_`-shaped strings in `scripts/`**.

## Bottom line

- **Claim certified (before-greps, §1):** `RT_EVAL_STALL` exists at `scripts/run-eval.mjs:946`; `RT_EVAL_REFUSED` at
  `:943` and `:944`; **zero hits in `src/` and zero in `src/lib/errors.ts`** (`grep` exit 1). Legacy since the initial
  commit (`git log -S RT_EVAL_STALL` → `23cc563`). Precise state: they are **returned as scoring-evidence labels**
  (`stop.code` for the M9 rubric, `notes.stopCode` in the results row) — **never thrown, never enveloped, never on an
  exit code** (no throw sites exist; the only occurrences are two string literals in the `stopCode` fallback expression).
- **Decision: STRUCK as registry items.** No code was minted; `ERROR_CODES` stays at **27** (before = after = 27/27 with
  `ERROR_CODE_DOC`). The three legs of the reason, each measured:
  1. **Shape.** The registry's enforced contract is `/^RT_E_[A-Z_]+$/` (`errors.test.ts` "error codes are RT_E_* prefixed
     and unique") and the live passthrough is `/^RT_E_/` (`errors.ts:178`). `RT_EVAL*` fails **both** (no underscore after
     the `E`) — measured: `classifyError({code:"RT_EVAL_STALL"})` → `RT_E_UNKNOWN`, while
     `RT_E_BUDGET_EXHAUSTED` in the same position is preserved. Registering the literal strings would mean bending the
     convention for every consumer — forbidden ("follow the registry's own convention exactly").
  2. **Family / no-dead-entries.** A shape-conforming rename (`RT_E_EVAL_*`) would invent an **EVAL family** (forbidden:
     "reuse the registry's families; never invent a family") and would be dead entries — nothing emits them, because the
     emitter (`scripts/run-eval.mjs`) is read-only in this lane. The file's own pre-registration precedent (`fixes/150`)
     names the adopting lane; no such lane exists here.
  3. **Semantics.** The registry covers failures **surfaced by the AI-interface layer**. These two strings label a dev
     harness's rubric inputs; the only consumer is `m9` in `src/lib/maker-score.ts:603-616`, which just requires
     `typeof s.code === "string" && s.code.length > 0` for its evidence line — it never checks registry membership.
- **Sweep (§4):** one command found **23 raw `RT_E*` tokens** in `scripts/`: **19** are code-shaped and all 19 are
  already registered; **2** are regex fragments (`RT_E`, `RT_E_`); **2** are the flagged labels. **Other unregistered
  `RT_E_`-shaped strings: 0** (before and after).
- **Before/after counts (grep, §5):** unregistered `RT_E_`-shaped codes in `scripts/`: before **0** → after **0**;
  `RT_EVAL*` labels: before **2 unregistered-and-undocumented** → after **2 on disk (emitter read-only) carrying a
  documented, test-pinned STRUCK status**; registry codes: before **27** → after **27** (nothing dead minted).
- **Done-when:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/errors.test.ts` →
  **`# tests 37 · suites 5 · pass 37 · fail 0`** (before: 34/4/34/0 — +3 tests, all new).

## 1. Certification (the exact commands + output)

```
$ grep -rn "RT_EVAL_STALL" src scripts
scripts/run-eval.mjs:946:        ? "RT_EVAL_STALL"

$ grep -rn "RT_EVAL_REFUSED" src scripts
scripts/run-eval.mjs:943:        ? refusedCode.match(/RT_E[A-Z_0-9]*/)?.[0] ?? "RT_EVAL_REFUSED"
scripts/run-eval.mjs:944:        : "RT_EVAL_REFUSED"

$ grep -n "RT_EVAL" src/lib/errors.ts
(no output — exit 1)

$ git log --oneline -S "RT_EVAL_STALL" -- scripts/run-eval.mjs
23cc563 Initial commit: RapidTool autonomous software factory
```

Usage context (post-C-2 `scripts/run-eval.mjs:929-947`): the drain's own coded stop (`RT_E_GATE_PENDING`) wins; these
two are the **fallbacks** of the `stopCode` derivation (`RT_EVAL_REFUSED` when a refusal signal carries no code;
`RT_EVAL_STALL` when the drain stalled without a terminal state). Repo-wide (`--exclude-dir=.git,node_modules,.output`),
the strings appear nowhere else — no doc, test, or envelope references them besides the plan/log files of this wave.

## 2. Convention read (neighbours + header, before deciding)

- Header contract (`errors.ts:2-20`): codes are for failures "surfaced by the AI-interface layer (chat copilot, LLM
  calls, report intake, headless/CLI commands)"; **additive-only**; a code without a doc entry fails `errors.test.ts`.
- Neighbour `RT_E_GATES_FAILED` (`:386-390`): emitted by the engine's red-gate seal; doc = one-line `meaning` + one-line
  `agentAction`, no newlines. Neighbour `RT_E_BUDGET_EXHAUSTED` (`:406-410`): "a journey or wild run hit its hard
  cycle/token budget and stopped without converging" — the closest semantic relative of a *stall*, but like every other
  entry it is **emitted by a real surfaced path**, which is precisely what the two labels are not.
- Test-enforced invariants (`errors.test.ts:390-443`): doc coverage, no orphans, `^RT_E_[A-Z_]+$`, uniqueness.
- Also read the in-file precedent at `errors.ts:206-209` ("no new code is minted for a case an existing code already
  names") — the register-or-strike decision here follows the same discipline, one step further (no code is minted for a
  case that never surfaces as a failure at all).

## 3. Decision + change

| file | change | lines |
|---|---|---|
| `src/lib/errors.ts` | **Declared boundary** comment block after `ERROR_CODES` (`:59-76`): the two labels are `RT_E*`-looking but NOT codes, with the three reasons above and the migration path. **No code added** — `ERROR_CODES` 27 → 27, `ERROR_CODE_DOC` 27 → 27. | `+19/−0` |
| `src/lib/errors.test.ts` | New describe `"registry boundary — RT_EVAL_* harness labels (W15-L2 / fixes/241)"` with 3 tests: (1) both labels absent from `ERROR_CODES` **and** `ERROR_CODE_DOC`; (2) both fail `/^RT_E_[A-Z_]+$/` (documents *why* registration as-is is impossible); (3) `classifyError` degrades a non-`RT_E_` label to the honest fallback (`RT_E_UNKNOWN`; with `RT_E_INTERNAL` fallback → `RT_E_INTERNAL`) while `RT_E_BUDGET_EXHAUSTED` in the same position is preserved. | `+42/−0` |

Teeth: pin (1) fails the moment either label is added to `ERROR_CODES`; pin (3) pins the measured boundary behaviour of
the coded channel (fixture message "drain ended without a terminal state" hits no matcher — verified in scratch).

## 4. The sweep (step 2) — one command + programmatic membership

```
$ grep -rhoE "RT_E[A-Z_0-9]*" scripts | sort -u        # 23 raw tokens
```

Membership checked in scratch (`C:/Users/mnril/w15l2_scratch/check-sweep.mjs`, imports the real `ERROR_CODES`):
**19 code-shaped tokens, all 19 registered; 2 regex fragments; 2 flagged labels; 0 others.**

| token(s) | count | status |
|---|---|---|
| `RT_E_CHECK_FAILED · RT_E_GATE_PENDING · RT_E_GATES_FAILED · RT_E_INTERNAL · RT_E_LLM_NOT_CONFIGURED · RT_E_LLM_REJECTED · RT_E_LLM_TIMEOUT · RT_E_PHASE_ILLEGAL · RT_E_PROJECT_MISSING · RT_E_REPAIR_FAILED · RT_E_REPORT_INVALID · RT_E_REPORT_PHASE_MISMATCH · RT_E_RESEARCH_UNAVAILABLE · RT_E_RUNNER_FAILED · RT_E_RUNNER_UNAVAILABLE · RT_E_TREE_RUN_FAILED · RT_E_UNKNOWN · RT_E_VALIDATION · RT_E_VERIFY_KIND_FAILED` | 19 | **ALREADY REGISTERED** (programmatic check) |
| `RT_E`, `RT_E_` | 2 | **NOT CODES** — regex-scrape fragments from `/^RT_E/` (`run-eval.mjs:938,942`) and `/RT_E[A-Z_0-9]*/` (`:943`); a fragment never rides an envelope |
| `RT_EVAL_REFUSED`, `RT_EVAL_STALL` | 2 | **STRUCK** as registry items — harness-local scoring-evidence labels (reason §Bottom line); documented in `errors.ts` + pinned in `errors.test.ts` |

## 5. Evidence — done-when + before/after counts

```
$ node --experimental-strip-types --test --test-concurrency=2 src/lib/errors.test.ts   # AFTER
# tests 37 · suites 5 · pass 37 · fail 0 · duration_ms 1011
# (BEFORE, same command on the untouched files: # tests 34 · suites 4 · pass 34 · fail 0 · duration_ms 677)
```

```
$ grep -rn "RT_EVAL" src scripts        # AFTER: emitter (read-only) + my two files' comment/test lines only
scripts/run-eval.mjs:943/944/946        # unchanged by me (read-only file)
src/lib/errors.ts:63,69                 # boundary comment
src/lib/errors.test.ts:444-485          # pins (file ends at 485)
```

Change surface: `git diff --numstat -- src/lib/errors.ts src/lib/errors.test.ts` → `19/0` + `42/0` (**purely additive**;
0 deletions). Targeted lint: `npx --no-install eslint src/lib/errors.ts src/lib/errors.test.ts --format json` →
`errorCount:0 · warningCount:0` for both.

## Honest notes / limits

- **The two labels stay on disk** in `scripts/run-eval.mjs` (read-only here — the emitter's owner is the run-eval lane).
  What closed is the *open question*: the registry now declares them non-codes with reasons, and the tests pin the
  boundary, so no consumer can mistake them for registered codes. If the run-eval owner wants real codes, the
  shape-conforming rename + emitter adoption is that lane's work; if they prefer, the stall semantic is closest to
  `RT_E_BUDGET_EXHAUSTED` (existing doc: "hit its hard cycle/token budget and stopped without converging") — named
  here as the natural mapping, **not applied**, because assigning it without an emitter change would be a claim without
  behaviour.
- Noted, untouched (read-only): the harness's private `drainStopCode` check uses a looser `/^RT_E/` than the registry's
  `/^RT_E_/` (`run-eval.mjs:938`) — harmless today (only `RT_E_GATE_PENDING`/null flow through it), worth tightening if
  a run-eval lane ever adopts real codes for `stopCode`.
- C-2's note says "thrown/returned"; measured precisely: **never thrown** (there are no throw sites — the strings occur
  only inside the `stopCode` fallback expression), returned only as scoring evidence.
- No re-run of anything outside the lane's done-when command; forbidden commands (`npm run typecheck` / `npm test` /
  `npm run build`) were not run. Scratch kept at `C:/Users/mnril/w15l2_scratch/check-sweep.mjs` (outside the repo).

*Provenance: W15-L2 subagent. Every command quoted above was run in this session; nothing here is a projection.*
