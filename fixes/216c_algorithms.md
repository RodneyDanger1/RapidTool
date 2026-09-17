# fixes/216c — algorithm correctness + cost (112's T7/T8/T10, 109's T-06)

**Recovered by the parent** from the lane's final summary (the lane completed all code work and
verification but hit its iteration cap before writing this file). Content below is the lane's own
reported work; the parent re-verified the end state on the frozen tree (see §Verification).

Files changed — patch-only, exclusively the lane's four owned files:

- `src/lib/algorithms.ts` — **T7** cache key `fnv1a(text)` → the text itself (`Map<string, number>`,
  cap 100 unchanged); **T8/F3** `contiguousRun` rewritten as one KMP pass and **exported** for the
  differential test; **T8/F2** `fusionRank` sorts a parallel `{m, tokens}` list (tokenized once per
  row) instead of re-tokenizing inside the comparator *and* a third time in the scoring pass.
- `src/lib/algorithms.test.ts` — pinned T7 collision pair (both-order assertions + an `fnv1a`
  tripwire), frozen T8 golden, 10k-pair seeded differential KMP test vs the naive oracle.
- `src/lib/algo-tools.ts` — **T10/F5** masker gained template-content vs code modes; `${…}` bodies are
  now scanned as code (nested templates/strings/comments/regex handled recursively, `${` and its
  matching `}` masked so the view stays brace-balanced); **109 T-06** halving probe is **header-only**
  (`HALVING_RE.test(header)`), body-level shape → an `extras` note
  `"body-level halving detected — not counted"`; **T10/F6** `lineOf` → `linesOfIndices`, a single
  forward pass over ascending keyword indices.
- `src/lib/algo-tools.test.ts` — 5 new fixtures, 5 new tests, 2 deliberately updated assertions
  (old → new below).

## T7 — the collision, reproduced before it was fixed

`estimateTokens` keyed its cache on `fnv1a(text)`. A real collision was **reproduced**:

```
fnv1a("rjmr") === fnv1a("lasipzafzrmsnlpmtfnstxtvfmtmnet") === 933450742
   B-first → "rjmr" reported 16   (true 3)
   A-first → B reported     3    (true 16)
```

i.e. the answer depended on call **order** — and `enforceTokenBudget` (`crew.server.ts:275-290`)
trusts this value. Post-change: B→16, A→3 **in both orders**; a non-colliding neighbour is unchanged.

## Commands actually run + real results (lane-reported)

| Command | Result |
|---|---|
| pre-change probe (temp dir, absolute-URL imports) | reproduced T7 as above |
| same probe post-change | B→16, A→3 **in both orders**; non-colliding neighbour unchanged (3) |
| `--test src/lib/algorithms.test.ts` | **75 pass / 0 fail** |
| `--test src/lib/algo-tools.test.ts` | **24 pass / 0 fail** |
| `--test src/lib/typed-failures.test.ts` (maskNonCode consumer) | **4 pass / 0 fail** |
| `npm run typecheck` | **0 errors in its 4 files**; 5 errors all in `scaffold.ts` (a **sibling lane mid-edit** — duplicate `jobLabelOf`/`generated` at :2210/:2214/:2288/:2293 and the arity at :1896) |
| `npx eslint` on its 4 files | exit 0, no output |
| `sweep73-fuzz.test.ts` | **could not load** — `scaffold.ts:2288 SyntaxError: Identifier 'jobLabelOf' has already been declared` (sibling's file). Its `maskNonCode` properties were independently re-verified in a standalone probe: 47 hostile samples, **0 throws, 0 length mismatches, deterministic** |

Not run (forbidden while siblings edit): full `npm test`, `npm run build`.

## T8 golden (frozen pre-change; post-change output byte-identical)

`fusionRank("dispatch routing workflow", corpus, 20)`

```
r1 0.624 → s1 0.549 → p2 0.549 → dup 0.543 → e4 0.5 → s3 0.459 → nan-score 0.435 →
e3 0.379 → s4 0.311 → p1 0.262 → e1 0.22 → s2 0.211 → e2 0.209
```

kinds: episodic, semantic, procedural, semantic, episodic, semantic, semantic, episodic, semantic,
procedural, episodic, semantic, episodic. Corpus: 13 valid rows (all 3 kinds, one `source:"research"`
cited row, phrase runs of 3/2/1, one duplicate id) + 4 malformed rows (unknown kind, `null`,
non-string text, NaN score). The top-6 slice is pinned too.

## Assertions deliberately updated (recorded old → new)

1. **`complexityOf` binary-search fixture** (`LOGN_SRC`, body `(lo + hi) / 2`):
   **old** `O(log n)`, `halvingLoops 1` → **new** `O(n)`, `halvingLoops 0` + caveat matches
   `/body-level halving detected — not counted/`. This is the *conservative* direction of the T-06
   fix (header-only probe).
2. **`O(n log n)` fixture** (`NLOGN_SRC`, inner `while (j>1){ j = Math.floor(j/2); }` — a body step):
   **old** `O(n log n)`, `halvingLoops 1` → **new** `O(n^2)`, `halvingLoops 0` + the note.
   A new `NLOGN_HDR_SRC` (halving step in the for-update **header**) keeps `O(n log n)` pinned, so
   **both directions of the rule are covered**.

No assertion was weakened or deleted.

## Not done / flagged (lane-reported)

- **T9 (stemmer `-ies`) untouched**, as instructed — no stemming behaviour changed.
- No changes were needed outside its files.
- One deliberate refinement **beyond** the literal spec: the body-halving note is computed from *this
  loop's own* body text, stopping at a nested loop keyword, because the naive version reported the
  note for `O(n^2)` fixtures whose halving step belonged to the **inner loop's header**. Local to
  `algo-tools.ts` and pinned by tests.

## Verification (parent, on the frozen tree after all lanes stopped)

| Gate | Result |
|---|---|
| `npm test` | scripts **195/195** · src **1662/1662** · **0 fail** |
| `npm run typecheck` | **exit 0** |
| `npm run lint` | **exit 0** |
| `npm run build` | **exit 0** |

Note: the lane's `sweep73-fuzz.test.ts` load failure was caused by the **sibling lane's** duplicate
declarations in `scaffold.ts`. The parent repaired those (see the Wave-D/216b notes in
`research/multiagent/104_factory_upgrade_plan.md`); `sweep73-fuzz.test.ts` now loads and passes as
part of the green full suite above.
