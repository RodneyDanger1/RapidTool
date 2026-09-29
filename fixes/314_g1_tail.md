# fixes/314_g1_tail.md — G1 · THE LONG-TAIL EXTERMINATOR (time-bombs · quiet-wrongness · debris · cosmetic/UX)

**Lane:** G1 (314 wave, `deleg_de25addb`). **HEAD at start:** 54c6649 (tree dirty with live lanes' bytes — read-only on their files). **Mode:** hunt with fresh eyes in unowned files; fix only TINY + provable; everything else → SPEC. **NO keyed calls. Bytes or it didn't happen.**
**Log status:** skeleton written FIRST (311/312 lesson: reserve the write step). Filled as items land.

## FILE CLAIMS (G1 — one writer per file; never edit E3's `console.tsx`/`pipeline-rail.tsx` or E4's CLI-remedy/README; never edit F5/F6 knk/residue files)
(filled as claims land — see FIXED ledger for the actual touched files)

## Method (the 4 classes, per brief)
1. **Time-bombs** — unbounded growth, uncleared timers on error paths, handles leaked on one branch, date math, float-cents, collision-prone ids, unbounded retries, unguarded `JSON.parse` on external bytes.
2. **Quiet-wrongness** — `==` sneaks, coercion surprises, `.sort()` w/o comparator, `parseInt` w/o radix, slice off-by-ones, `Array(n)` ghosts, iteration-order assumptions, `.includes(` on possibly-undefined, optional-chain masking a should-throw.
3. **Shipped debris** — `console.*` in product paths (each checked: by-design stdout or debris), debug flags, commented-out code, dead exports, re-implemented twins of unified utilities (clamp/sleep/truncate/fnv1a/escapeHtml).
4. **Cosmetic/UX** — typos + casing inconsistencies in messages (CLI-file strings → SPEC for E4), label/tooltip mismatches, number/date formatting re-implementations, aria/tab-order gaps (console → SPEC for E3).

## Status board
- [ ] C1 — time-bomb sweep (find → verify → fix/spec)
- [ ] C2 — quiet-wrongness sweep
- [ ] C3 — debris sweep
- [ ] C4 — cosmetic/UX sweep
- [ ] C5 — close-out: ledgers + gates on touched files

## FIXED ledger (tiny, evidenced — file · what · before → after · proof)
(filled as fixes land)

## SPEC'D ledger (for E3/E4/others — file · item · why not G1)
(filled)

## HONEST-BY-DESIGN ledger (checked, kept — why)
(filled)

## Evidence log (commands + observed bytes)
(filled)

## Close-out verdict
(filled)
