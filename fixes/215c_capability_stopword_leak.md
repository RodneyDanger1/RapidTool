# fixes/215c — capability-coverage stopword leak (fake-green M1 closed)

Status: LANDED. typecheck 0 · lint 0e · `maker-score.test.ts` 74/74.

Follows **fixes/215** (corpus kind → `Project.kind`) and **215b**
(forbidden-primitive prompt/validator parity).

## The bug (a real fake-green, found during the keyed probe audit)

`capabilityCoverage()` (maker-score) — and therefore `m1Substance` TREE MODE,
which delegates to it — built its match forms from **every** token of a
capability label:

```ts
// before (fixes/147 E3)
const tokens = raw.split(/[^a-z0-9_$]+/).filter((t) => t.length > 1);
```

No stoplist. `identifierHits` matches a form as a **sub-identifier**
(`i.includes(t)`), so the label's function words became match forms:

- `and` → matched `handleStandardNotice` (st-**AND**-ard)
- `per` → matched `property`
- `the` → `gather`, `for` → `beforeAfter`, `with` → …

**Empirical proof** (probe, since deleted): a module containing only
`handleStandardNotice`, `gatherOtherInformation`, `beforeAfter` — zero
real-estate substance — **covered 5 of 7** Coffeehouse2Home capabilities.

Consequence: M1 could be satisfied by *any* module with ordinary identifiers,
inflating the eval headline and the maker score. That is exactly the
"green ≠ product" failure the honesty rails exist to prevent, and it made the
keyed run's M1=1 unearned.

## The fix

`formsForCapability` now filters tokens through **`BRIEF_STOPWORDS`** — the same
stoplist `briefNounHits` already uses for the p6-brief-fit DoD probe
(`sandbox.ts`). This restores the doctrine stated at the top of `maker-score.ts`
("the SAME helpers… `sandbox.identifierHits`/`briefNounHits` semantics"): the
verifier and the brief-fit probe now agree on what counts as substance
vocabulary. Stems are filtered too, so a stopped token cannot re-enter via
`canonicalStem`.

### Tests (`maker-score.test.ts`)
1. **215c leak closed** — the junk module above now covers **nothing**; every
   capability lands in `missing`.
2. **215c no over-strip** — a module with genuine substance vocabulary
   (`recordPropertyOwnership`) still covers its capability.

Existing coverage tests were re-verified: `["rent roll with payment records"]`
still covers via the token `rent` hitting `recordRentPayment` (the stopped
`with`/`records` were never what matched).

### Corroboration (this is a restore, not an over-correction)
The two sibling implementations of the same matching semantics already filter
the stoplist and document that they mirror maker-score:

- `scaffold.capabilityPresenceForms` — "lowercased content tokens
  (stopword-filtered…) — the maker-score capabilityCoverage / dod p6-arch
  matching semantics… Deliberately stopword-free: a row must never pass on a
  junk word ('the'/'with') living in a name."
- `dod.proseCapabilityTokens` — "Prose capability text → demanded identifier
  tokens (stopword-filtered…)".

`formsForCapability` was the **lone** drift from that stated contract. 215c
brings it back in line, so the maker score, the emitted arch rows and the DoD
p6-arch probe again agree on what counts as substance.

## Effect (honest direction)

M1 becomes **stricter**. The keyed run's M1=1 was partly stopword-earned; the
fix removes that credit. This can only lower eval numbers — the honest
direction. `factory.*` remains **false**; no bodies invented; no fixtures
auto-approved.

## Not a bug (checked)

`p6.synthesis.attempt` logs `240000ms` — that is the **timeout budget**
(`P6_SYNTH_TIMEOUT_MS`), not a call duration; `synthAttemptLogEntry` renders
`a.timeoutMs`. No timeout smell.
