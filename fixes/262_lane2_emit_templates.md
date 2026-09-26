# 262 · LANE 2 (W23) — the emitter side: the 28 coverage reds grouped + emit-template fixes + OV-16 README truth

**Lane box:** `src/lib/codegen.server.ts`, `src/lib/scaffold.ts` (both read fully; codegen.server.ts was already DIRTY
from W21-258 → my hunks kept separable and noted per file:line). **CODE ONLY — no test/typecheck/build/lint runs by
this lane** (wave rule). All reds below are grounded in existing bytes/records, never in a fresh run.
**Inputs read:** `wave_plans/W23/code-all.md` (LANE 2), `fixes/255_lane1_tree_green.md`,
`fixes/255_lane2_probe_truth.md` §5, `fixes/260_lane2_certify_fix.md` §2/§3 (the certified 43/9/28/6 shape),
`fixes/256_w20_wd_alpha.md`, the emitted artifact `research/eval-out/coffeehouse2home-property-ledger/**`.

## 0 · Baseline (what the 28 reds actually are — from the certified record)

`fixes/260_lane2` §2 measured on run #2's real accepted bytes (re-materialized post-W21-258):

```text
TAP summary: # tests 43 | # pass 9 | # fail 28 | # skipped 6
failing capability rows: 28 (capability.9 … 36) · other failing rows: []
treeRun() ok:false — caused ONLY by those 28 rows (compile 10/10; ui-shell entry skip is green-compatible)
```

So: **the 28 reds are exactly the 28 capability-presence rows whose demanded identifiers are absent from run #2's
1-file partial tree** (`generatedTree` = 1 row; 7-chunk plan, chunk 2/7 refused → 8/36 capabilities materialised).
The rows are honest; they are NOT the template defect. The template defect is what makes the emitted suite and the
emitted artifact *disagree about the same capability set* — see §1.

## 1 · Grouping the 28 reds by cause (why a fresh emit's suite can still red)

_(pending — filled with the per-signature byte analysis below)_

## 2 · Template edits (by file:line)

_(pending)_

## 3 · OV-16 — emitted-README labelled unmaterialised-jobs truth

_(pending)_

## 4 · Self-check — claims vs bytes

_(pending)_
