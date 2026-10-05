# 346 · finish task list — reviewer corrections (apply before resuming)

The plan-skill reviewer (see `fixes/346_finish_tasks_review.md`) verified the six-lane skeleton as
structurally sound — the owned-file sets are pairwise disjoint, both hot files have exactly one owner, and
the boundary gate is genuinely green (`scripts 530/0 · lib 3767/0/2 · prevention 29/29`) — and confirmed
every product number (0/8, 2/8, 3/4, 0/4, 1/6) against the artifacts. It returned **needs revision** for
claim-truth drift plus one incomplete task. Apply these corrections when resuming.

## Stale tasks — ALREADY DONE at `95089de` (do NOT re-do; doing so risks churn or regression)

| Task in `346_finish_tasks.md` | Reality at `95089de` |
| --- | --- |
| **D-3** "wire `runlockEditViolations`" | Already wired — `scripts/rapidtool-cli.mjs:1489-1514` refuses `RT_E_SRC_EDITED_DURING_RUN`. The doc's "open seam" is false. |
| **Q-1** "guard must consume `realGeneratedExportWiring`" | Already consumes it; the parallel `realModuleSet` census was removed in `23fb616`. |
| **D-2** "surface `RT_E_PLAN_UNDERPRODUCED` in the emit seal" | Already surfaces it (the `default-check` below-floor trees show the code). |
| **S-3** "floor refusal must carry `RT_E_PLAN_UNDERPRODUCED` / run first" | Already carried via the single `refuse()` door (`codegen.server.ts:6010-6037`). |
| **G-1** "C9 intent-first research" | Already landed — `researchQueryText` is intent-first with `RESEARCH_MAX_QUALIFIERS = 3` plus the off-intent blocklist. |

## Incomplete task — **G-2** (extend it)

The doc lists seven missing `expectedCode` registry codes; **eleven** are needed. Add these four as well,
or G-2's own acceptance ("every registry `RT_E_*` resolves in `ERROR_CODE_DOC`") cannot pass:

- `RT_E_DEFAULT_CHECK_BASELINE_LOST`
- `RT_E_REFUSAL_COVERAGE_LOST`
- `RT_E_SYNTH_RESAMPLE_UNBOUNDED`
- `RT_E_SYNTH_RESUME_NOT_REUSED`

## Other corrections

- **§2's registry claim is false:** nine `RT_E_*` codes are already registered, not two.
- **Q-2 declares an undeclared cross-lane dependency:** it pins D/S/G fixes while only interfaces I-A
  (`S→X` candidate-token suffix) and I-B (`G.recordGateInto`, read-only) are frozen. Add the missing
  producer/consumer contracts before treating Q-2 as independent.
- **Minor:** the "~4/10 combined rate" disagrees with the three named samples (4/14); V-1/V-2 are
  substantially already landed; the owned-file union omits the keyed measurement roots; "~10 minutes each"
  understates the keyed lanes' real wall clock (the time-box rule still applies — overrun only to finish
  the single edit in progress).

## Still genuinely open (the real remaining work)

- **S-1** — the two-sample keyed reliability measurement at the armed default (the dead lane's unfinished
  job) + **S-2** the form-bindable UI decision + **S-4** the candidate-token journal row.
- **D-1** — recompute the persisted phase-6 gate over the best-kept tree (the real persisted-gate mismatch).
- **G-2 (extended)** — register the eleven codes.
- **V-1/V-2/V-3** — the residual verification items (check what is already landed first).
- **Q-2/Q-3** — guards + cassettes for the genuinely new fixes; `countFloor` bump.
- **X-1/X-2/X-3/X-4** — candidate-token consumer, **campaign #3** (the final keyed measurement), docs
  close-out, doctor surfacing.
