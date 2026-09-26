# 263 · LANE 1 (B1) — bug hunt: `src/lib/` core

Wave: W24 spring-clean (fixes/263 family, lane 1 of 4).
Base HEAD: `b721f9c`. Box: `src/lib/engine.ts`, `store.ts`, `phases.ts`, `dod.ts`,
`gate-stats.ts` (+ `gates.test.ts`), `packet.ts`, `io.ts`, `doctor.ts` and their
`.test.ts`. NOT console/routes (U1/U2), NOT `src/lib/llm/**`/`scripts/**` (B2).

Evidence rule used here: every fix is followed by a targeted FOREGROUND run
(`node --experimental-strip-types --test <one-file>` / `npx eslint <files>`); the
repo-wide gate was never invoked (siblings editing).

## Findings

(being filled in as the hunt progresses — this file is append-only from here)

### F1 — `gate-stats.ts` `approvalHealth`: window applied to `decidedAt` only … CHECKED, NOT A BUG

`src/lib/gate-stats.ts:62-68` — status: not a bug. The A27 comment right at line
65-68 states the request-side window is applied (`d.requestedAt >= cutoff`), and
the code does apply it. Suspicion dissolved; no patch.

Status legend: `FIXED` (patch + foreground check), `NOT-A-BUG` (with reason),
`PROPOSED` (needs a keyed run / out-of-box edit).

### F1 — RED SUITE at HEAD: `doctor.test.ts` café-export block was stale vs. the replaced fixture AND vs. the landed §P2 semantics — FIXED

**Evidence (before).** `node --experimental-strip-types --test src/lib/doctor.test.ts src/lib/packet.test.ts`
→ `# pass 67 # fail 1`; the failure:

```
not ok 2 - the REAL café export refuses on its named leftover; …
  src/lib/doctor.test.ts:392
  + actual - expected
  + []
  - [ 'src/generated.ts' ]
```

**Root cause (two overlapping drifts, both real):**
1. The tracked fixture the test reads (`research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json`)
   was replaced by a LATER real keyed run's export: at `673e349` its `generatedTree` was
   5 files (`src/generated.ts` barrel + 4 chunks); at HEAD it is **1 file**
   (`src/generated/get-property.ts`, 8060 chars — the W18–W22 "single-chunk ESM fix" output).
   The historic blob still exists, tracked, at `…coffeehouse2home-property-ledger.run-2026-09-10/`.
2. W23 (fixes/255 §P2, `dod.ts:274-297` + `dod.ts:410-426`) made an in-tree reexport barrel
   EXEMPT — `stubFiles` for the historic 5-file blob is `[]` (measured), not `["src/generated.ts"]`.
   So the test's premise ("refusal names the real leftover") no longer describes any real bytes,
   and the same block's `inv.reexports === 5` census read was stale too: the live dir no longer
   ships `src/jobs` at all (`inv.real === 0`).

**Measured truth on the tracked bytes at HEAD** (script + `node --experimental-strip-types -e`):

| blob | tree | stubFiles | missing | productComplete | census |
|---|---|---|---|---|---|
| live `…-property-ledger` | 1 | `[]` | 29 | false | real 0 / reexp 0 |
| historic `….run-2026-09-10` | 5 | `[]` | 0 | true | real 0 / reexp 5 |

**Fix** (`src/lib/doctor.test.ts:382-433`, test-only — the PRODUCER was left untouched because it
is the tested contract): re-derive every assertion from the real bytes, keeping the block
non-vacuous on both blobs — live bytes: refusal ground is the counted un-implemented capabilities
(`stubFiles: []`, `missing.length > 0`) + the zero-real-job census refuses; historic bytes: the
in-tree assembly barrel is exempt so the arch bar is met (`stubFiles: []`, `missing: []`,
`productCompleteFromProject === true`), and the 214 leftover census (5 reexport-only bridge job
files) is what still refuses the factory claim. The old "drop the file → flips" differential is
preserved in substance (verdict tracks content) and the blob-immutability check is subsumed by
reading both blobs as pure inputs.

**Check (after).** `node --experimental-strip-types --test src/lib/doctor.test.ts` → `# tests 20 # pass 20 # fail 0`.
(`doctor.ts` itself: no edit needed — every measured value above came from the unmodified producer.)

**Class.** stale wiring between a test and its real-bytes fixture + landed semantics; not an
engine defect. Left `packet.test.ts` green (68 total in the pair, only the one above was red).
