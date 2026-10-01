# fixes/327 — Lane 4 (L4): pipeline algorithms

**Lane:** 4 of 5 (professional bug-fixing wave, task id 327).
**Owned files (only these):** `src/lib/algorithms.ts`, `src/lib/algorithms.test.ts`,
`src/lib/algo-tools.ts`, `src/lib/algo-tools.test.ts`. This log is written only by L4.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main`, branch `main`, HEAD `6924dde`.
**Runtime:** pinned Node 22 — `C:\Users\mnril\AppData\Local\hermes\node\node.exe` (v22.23.2); host
default `node` is v24 and was NOT used.

## Baselines (parent-measured, re-verified by me with the pinned Node 22)

| suite | before | after | delta |
|---|---|---|---|
| `src/lib/algorithms.test.ts` | 79 tests / 0 fail | **80 tests / 0 fail** | +1 |
| `src/lib/algo-tools.test.ts` | 27 tests / 0 fail | **28 tests / 0 fail** | +1 |

`npm run typecheck` → **exit 0**, no `error TS` lines (log `%TEMP%\rt_l4\tc.log`).
Full gate NOT run (sibling lanes editing, per brief).

## Definitive-dossier findings — re-checked against TODAY's bytes

Every `109`/`93` finding that names my files was re-grepped on `git show HEAD:<path>` (line numbers
in the dossiers have drifted; HEAD is byte-identical to the pre-edit worktree for my files):

| id | status today | command that showed it |
|---|---|---|
| **C-02** (`exportedNamesOf` CJS regex) | **Already fixed** — HEAD has the split `cjsBare` / `cjsModule` regexes (`git show HEAD:src/lib/algo-tools.ts` → lines 190-191); `algo-tools.test.ts` T-08 (4 probe rows) green. | `git show HEAD:src/lib/algo-tools.ts \| Select-String 'cjsBare\|cjsModule'` |
| **C-03** (`complexityOf` body `0.5` → O(log n)) | **Already fixed** — HEAD probes `HALVING_RE.test(header)` only and records `bodyHalving` in `extras` (HEAD lines 637/643-644/683); 6 T-06 tests green. | `git show HEAD:src/lib/algo-tools.ts \| Select-String 'HALVING_RE\|bodyHalving'` |
| **C-06 / T-07** (`intentLattice` one-pass vs fixed-point stem) | **Already fixed for single-word terms** — HEAD line 400 is `canonicalStem(t) === termStem`; the T-07 parity test is green. **But the same class survived for multi-word terms** → see **L4-01**. | `git show HEAD:src/lib/algorithms.ts \| Select-String 'canonicalStem\(t\)'` |
| **C-10** (three stemmers under "FusionRank") | **Addressed** — the canonical-pair + scoped-exception note is at HEAD `algorithms.ts:18-35`; `knowledge.tokenize` and `engine.researchStem` are documented as intentional scoped exceptions. Comment-only fix, already landed. | `Select-String -Path src/lib/algorithms.ts -Pattern 'STEMMING — one canonical pair'` |
| **C-08** (harvest cap) | **Out of lane** — the defect is in `src/lib/harvest.ts` (`HARVEST_MAX_CANDIDATES`), which L4 does not own. Not touched. | `Select-String -Path research/multiagent/109_bughunt_core.md -Pattern 'C-08'` |
| **T7 (token-cache keying)** | **Already fixed / healthy** — keyed by the text itself, LRU cap 100, collision pair distinct. Probe `probe_cache.ts`: `band violations: 0`, `rjmr 3 / long 16` across 5 interleaved iterations. | `node --experimental-strip-types %TEMP%\rt_l4\probe_cache.ts` |

## L4-01 — multi-word register terms were under-weighted (stemming asymmetry, C-06 class)

**File:** `src/lib/algorithms.ts`, `intentLattice` frequency count (was line 400; now 433).

**Root cause.** The bag side canonicalized each *token*, but the term side ran
`canonicalStem(term)` over the **whole term string**. For a hyphenated register entry the
trailing `er` is read as an agent noun, so `canonicalStem("work-order") === "work-ord"` — which
can never equal a bag token (`work`, `order`). Every multi-word LEX term
(`work-order`, `job-cost`, `punch-list`, `follow-up`, `same-day`, `air-gapped`, `on-prem`,
`multi-tenant`, `cross-platform`, `local-first`, `rate-limit`) therefore plateaued at the **0.35
base weight** no matter how literally the brief named it — the exact under-weighting class the
109 T-07 fix closed for single-word terms.

**Probe (before fixing):** `%TEMP%\rt_l4\teeth_freq.ts` (imports the repo module AND a scratch copy
of the module reverted to `git show HEAD:...`):

```
work-order  [multi-word object] brief="create a work order for the site"
    OLD=0.35  NEW=0.55
work-order  [multi-word object] brief="work-order management"
    OLD=0.35  NEW=0.55
same-day    [multi-word constraint] brief="same-day delivery"
    OLD=0.5  NEW=0.7000000000000001
follow-up   [multi-word job] brief="set up follow-up reminders"
    OLD=0.35  NEW=0.55
ledger      [single-word control] brief="track a ledger"
    OLD=0.55  NEW=0.55
scan        [single-word control] brief="scan barcode"
    OLD=0.55  NEW=0.55
OLD under-weighted (<=0.5) count: 4 / 6
NEW correctly weighted (>=0.55) count: 6 / 6
parity scan "scan scan scanning scans barcode" OLD 1 NEW 1
parity listing "Track listing status..." OLD 0.55 NEW 0.55
parity listing "Track listings status..." OLD 0.55 NEW 0.55
new repeated hyphenated: once 0.55 thrice 0.9500000000000001
stem sanity: canonicalStem('work-order')= work-ord tokenizeWords('work-order')= ["work","order"]
```

**Fix (patch).**
- New module-private `phraseCount(bag, term)` (`algorithms.ts:388`) counts contiguous,
  overlapping occurrences of a stemmed term sequence in a stemmed token bag. A single-token term
  reduces to a token count (byte-identical to the old single-word path); a multi-word term requires
  its words adjacent, so one phrase mention == one hit == the same weight a one-word mention earns.
- `const bag = tokens(text).map(canonicalStem)` (`:410`) — bag tokens canonicalized once.
- `const freq = phraseCount(bag, tokens(term).map(canonicalStem))` (`:433`) — the term is tokenized
  through the same `tokens()` rule (so hyphen/STOP handling matches the bag) instead of being
  stemmed as one string.
- The `fusionRank` doc line that called `tokens()` the *unstemmed* bag was corrected.

**Single-word byte-parity:** no LEX term is a STOP word or a 1-char token, so `tokens(term)` for a
one-word term is `[term]` and the count is unchanged (verified by the `parity` lines above; the
existing T-07, `scan` weighting and 95 P0-A tests stay green).

**Teeth.** The scratch reverted copy gives 0.35/0.5 where the new code gives 0.55/0.7 — the
assertion in the new test (`expectWeight(1,false)=0.55`, `expectWeight(1,true)=0.7`) is RED on HEAD
code and GREEN on the fix. Scratch tree: `%TEMP%\rt_l4\old\` (full `src/lib` copy, only
`algorithms.ts` reverted to `git show HEAD; node_modules` junction to the repo).

**Regression test:** `algorithms.test.ts` → `326 L4 — multi-word register terms weight by phrase
mentions` (+1 test).

## L4-02 — loop keywords inside an unmasked regex literal were counted as loops

**File:** `src/lib/algo-tools.ts`, `complexityOf` keyword scan (guard at lines 622-636).

**Root cause.** `maskNonCode` treats a `/` after `}` / `)` / `]` as division (it cannot distinguish
statement-position regex from a division operand — `(a+b)/2` vs `}` then `/re/`). A regex literal in
that position is therefore left as code, and `complexityOf`'s `\b(for|while|do)\b` scan counted the
`for`/`while` **inside the literal** as a phantom loop — publishing `O(n)`/`O(n^2)` for a function
with no loops, in an artifact (`benchmarkHarness`) that ships the notation as a fact.

**Probe (before fixing):** `%TEMP%\rt_l4\teeth_complexity.ts`:

```
regex /for/ after }: OLD loops=2 lines=[2,3] O(n)  ->  NEW loops=1 lines=[3] O(n)
regex /while/ after ): OLD loops=1 lines=[1] O(n)  ->  NEW loops=0 lines=[] O(1)
mask of the phantom region (unchanged): "}\n/for/.test(x);"
control plain for loops 1 O(n)
control while loops 1 O(n)
control do-while loops 1 O(n)
control for await loops 1 O(n)
control braceless for loops 1 O(n)
```

**Fix (patch).** Before recording a loop, assert a real JS invariant: a genuine `for`/`while` head
is always parenthesized (`for await (` for the async form), so after the keyword (and whitespace) the
next char must be `(`. A keyword with no `(` after it is inside an unmasked regex literal and is
skipped. `do` has no head, so it is left to the masker (see residual below). Real loops — including
`for await`, braceless bodies and do-while terminators — are untouched (controls above).

**Teeth.** Scratch reverted copy reports 2 and 1 phantom loops where the fix reports 1 and 0 — the
new test's `assert.equal(a.loops, 1)` / `assert.equal(b.loops, 0)` are RED on HEAD code, GREEN on
the fix.

**Regression test:** `algo-tools.test.ts` → `326 L4 — regex-literal loop keywords are not counted as
loops` (+1 test).

## Reproduced but intentionally NOT fixed (recorded, not silently left)

- **`while (cond);` (empty body) is not counted** as a loop: the `while`-terminator rule that skips
  do-while tails cannot distinguish it from a do-while terminator without tracking the preceding
  `do` body. Probe `probe_mask.ts`: `empty while body | loops 0`. Left as-is (needs parser-level
  do-tracking; no dossier finding; low reach).
- **`/do/` in statement position still phantom-counts** (`regex-after-brace /do/ | loops 1`): the
  `do` keyword has no head, so the L4-02 invariant cannot separate it from `do {…}` / `do x();`
  without also rejecting real forms (`/do x/` would slip a gap-based rule). Narrowed, not closed.
- **`exportedNamesOf` under-inventories** multi-declarator / destructured ESM exports
  (`export const a=1,b=2` → `["a"]`; `export const {a,b}=…` → `[]`). This is a pre-existing,
  test-pinned limitation (the T-08 test asserts `["a"]`), not a regression; changing it would move a
  pinned expectation and is outside this lane's defect set.

## Verification (all run by me, pinned Node 22)

```
node --experimental-strip-types --test --test-reporter=tap src/lib/algorithms.test.ts
  # tests 80 / pass 80 / fail 0
node --experimental-strip-types --test --test-reporter=tap src/lib/algo-tools.test.ts
  # tests 28 / pass 28 / fail 0
npm run typecheck            # exit 0, no error TS
```

No `git checkout/stash/reset/clean/commit` was run. The teeth scratch trees live OUTSIDE the repo
(`%TEMP%\rt_l4\old\`, `%TEMP%\rt_l4\*.ts`); no tracked file was reverted or rewritten except the two
owned sources and their two owned test files.
