# fixes/247 — W17 LANE 1 · THE CORPUS FOLD (additive-only into `research/multiagent/220_tasklist_canonical.md`)

**Written:** 2026-09-24 by W17-L1. **Base tree:** `4328d20` (committed clean at lane start). **Authorized editor of `220_tasklist_canonical.md` for this task only.**
**Scope:** (a) add the accepted rows from `fixes/228` §3's ACCEPT/MODIFY verdicts (~19) into 220 §1 in the canonical schema; (b) apply `research/multiagent/241`'s 13 strengthened verifications to the named rows; (c) add a fold appendix (what was folded / what deliberately was NOT). **ADDITIVE ONLY:** never delete a row, never rewrite prose; every insertion attributable `> [FOLD-2026-09-24] … (by W17-L1)`.
**Forbidden (respected):** no `src/`/`scripts/` edits · no `npm run typecheck/test/build` · no node TEST runs (the only node process = the foreground insertion script). Scratch: `C:/Users/mnril/w17l1_scratch/`.

## BOTTOM LINE

```text
folded: 20 new rows into §1 G · 13/13 verifications strengthened per 241 · folds-not-rowed: 7 (+1 sequencing note) · F5 REJECTED (not added)
file: 56593 → 90249 bytes · 322 → 412 lines · §1 rows 42 → 62 · grep -c "FOLD-2026-09-24" = 42 (≥ 20 = row count)
git diff --numstat: 90 insertions · 0 deletions (no existing byte changed; EOL style preserved — all-LF)
statuses: C-1/C-2 folded as DONE-VERIFIED (landed + certified per fixes/246 / 4328d20); all other 18 folded rows TODO
backup of pre-fold file: C:/Users/mnril/w17l1_scratch/220_before.md (sha256 0c13ec45…, identical to the file at lane start)
post-fold sha256: e6f30807b997c343fa4f1ed8538f3937bf944b105c299f51d8d458211aae7ad3
```

## CONVENTION (stated once, per wave plan LANE 1 step b) — CHOICE: *append alongside, never strike*

- **Existing verification cells are NEVER modified**: no replacement, no strike-through, zero deleted bytes. The 241-strengthened command set lands as a `> [FOLD-2026-09-24] VERIFICATION STRENGTHENED (per 241 §…)` marker block placed **immediately after the named row**, carrying 241's runnable commands verbatim (minus the redundant `cd` line) + the observable/done-when delta. Rationale: this is the strictly-additive branch of the wave plan's "append the strengthened command alongside"; `git diff --numstat` must show **0 deletions** (it does).
- **New rows** land in a new §1 subsection **G. THE W17 FOLD** in the canonical 10-column schema; each new row is attributed by one `> [FOLD-2026-09-24] NEW ROW <id> — … (by W17-L1)` marker line after the table. `C-1`/`C-2`/`OV-35` carry their 241-strengthened done-when/verification *directly in the row* (no prior command existed to preserve); their markers also say `(verification strengthened per 241, by W17-L1)`.
- **Fold-into-existing candidates** get a marker at the absorbing row: C-3→OV-3 · OV-29→OV-13 (merged into its strengthened marker) · OV-21→G4 · OV-6/OV-31→F1 (inside F1's marker) · OV-27→OV-35 (inside OV-35's marker, incl. C5's withdrawn half + OV-42's marker half) · AUD-2 coverage→cuts/x-refs (marker in §6(b)) · sequencing re-order → additive marker in §3 · summary appendix §7.

## WHAT WAS FOLDED — the 20 new rows (§1 G, in table order)

`C-1` · `C-2` · `OV-35` · `OV-36` · `OV-37` · `OV-38` · `OV-39` · `OV-40` · `OV-41` · `OV-42` · `OV-43` · `OV-19` · `OV-20` · `OV-28` · `OV-30` · `CI-workflow` · `F1` · `F2` · `F3` · `F4`

Per-row provenance (fixes/228 §3 # · source · verdict):
- **C-1** #1 · 223 §4 · ACCEPT (highest priority, W14 lane 0) → **DONE-VERIFIED** (fixes/246: 92/92, mint-before-gate both seams, WD-β CONFIRMED; 4328d20; W15-L1 repair-seam case).
- **C-2** #2 · 223 §4 · ACCEPT (same lane) → **DONE-VERIFIED** (fixes/246: `"dod"` terminal + coded RT_E_GATE_PENDING, 80→1 rounds, run-eval 17/17 with the one-round pin; 4328d20).
- **OV-35** #4 · 227 §2a/§6 · ACCEPT — absorbs **OV-27** (#5) as item 0; in-flight W16-L1 at fold time (uncommitted).
- **OV-36** #8 · 227 §2b · ACCEPT (per-site decision + request-body pin).
- **OV-37** #10 · 227 §2c · ACCEPT (S).
- **OV-38** #6 · 227 §1 R1/R2 · ACCEPT. · **OV-39** #20 · 227 §1 R4 · ACCEPT (S). · **OV-40** #21 · 227 §1 R3 · ACCEPT (S).
- **OV-41** #14 · 227 §3 C1 · ACCEPT (S; "P6-only" label).
- **OV-42** #15 · 227 §3 C2 · MODIFY (D3.4): slimmed to the overwrite-hazard half.
- **OV-43** #16 · 227 §3 C3 · MODIFY: report-only, never a gate, optional.
- **OV-19** #17 · 225 hunts 1–2 · MODIFY: scope source+test + explicit allowlist. · **OV-20** #18 · 225 hunt 1 · MODIFY (D3.3): advisory-only.
- **OV-28** #9 · 226 OV-28/A2 · MODIFY: test-pin half only, no behaviour change.
- **OV-30** #12 · 226 Half-B item 3 · MODIFY: register OV-18-style + honest 8 GB caveat.
- **CI-workflow** #7 · 224 bottom line/§2#7 · MODIFY→ACCEPT (deliberate runner choice; no keys in CI).
- **F1** #24 · 221 §F1 · ACCEPT (execution owner-gated); **absorbs OV-6** (#29, D3.1).
- **F2** #25 · 221 §F2 · ACCEPT (owner's key). · **F3** #26 · 221 §F3 · ACCEPT (T-11 muted note). · **F4** #27 · 221 §F4 · ACCEPT (engineering-first).

## THE 13 STRENGTHENED VERIFICATIONS (241) — applied, per row

- Authored directly into §1 G (new rows): **C-1 · C-2 · OV-35** (241 §C-1/§C-2/§OV-35; 241's done-when CHANGES carried).
- In-place markers after existing rows (cells byte-identical): **TASK-01 · T5.3 · OV-2 · OV-4 · OV-5 · T5.2-A · DF-18 · DF-26 · OV-13 · OV-15**.
- done-when flag per 241: CHANGES for C-1, C-2, OV-35, TASK-01, T5.3, OV-2, T5.2-A, OV-13, OV-15, OV-4, OV-5; **proof-only (NO change) for DF-18, DF-26** — each marker says so.

## EVIDENCE (commands + raw output)

```text
# before (lane start; = backup copy, both hashed identical)
$ wc -c research/multiagent/220_tasklist_canonical.md
56593 research/multiagent/220_tasklist_canonical.md
$ sha256sum …
0c13ec45d8998b8c446a4d33c49fbf014f32793122eb573ba114b3ab4c41dc02 *research/multiagent/220_tasklist_canonical.md
0c13ec45d8998b8c446a4d33c49fbf014f32793122eb573ba114b3ab4c41dc02 */c/Users/mnril/w17l1_scratch/220_before.md

# insertion script — FOREGROUND (host artifact note respected: no background node)
$ node C:/Users/mnril/w17l1_scratch/fold.mjs
payload blocks parsed: 16 · EOL detected: "\n"
PLAN (16 insertions) @ lines 49,50,55,69,70,71,92,104,105,107,111,113,137,185,306,EOF · total added (JS chars): 33122
chars: 55813 -> 88935 (+33122) · CRLF: 0 -> 0 · FOLD lines: 0 -> 42 · row lines (^| **): 42 -> 62
WRITTEN: …/research/multiagent/220_tasklist_canonical.md
(pre-write asserts enforced: anchors unique; row-count delta exactly +20; EOL style unchanged; length delta == payload sum)

# after — done-when checks
$ git diff --numstat -- research/multiagent/220_tasklist_canonical.md
90      0       research/multiagent/220_tasklist_canonical.md         # 90 insertions · 0 deletions
$ git diff -- … | grep -c '^-[^-]'
0
$ grep -c "FOLD-2026-09-24" …            → 42   (≥ 20 = folded row count; breakdown: G-header 1 + NEW ROW 20 + ROW COUNT 1 + strengthened 10 + fold-markers 4 + appendix 6)
$ grep -cF 'VERIFICATION STRENGTHENED (per 241' … → 11  (10 in-place markers + appendix prose)
$ grep -cE '^\| \*\*' …                  → 62
$ wc -c -l …                             → 90249  412
$ sha256sum …                            → e6f30807b997c343fa4f1ed8538f3937bf944b105c299f51d8d458211aae7ad3
```

Byte math note: +33,653 file bytes vs +33,122 JS chars — the delta is UTF-8 multibyte (·, —, ≥, →, ②-class punctuation). Two post-write touch-ups on MY OWN inserted lines only (table-safety: escaped a raw `|` inside the F1 and OV-39 cells; OV-39's grep became `-nE "^\| \*\*DF-"` — same semantics, ERE). Post-touch-up: still `90 0`, 412 lines, 90249 bytes, 42 FOLD.

## ISSUES / NOTES (honest)

1. **Bash hardline blocklist fired twice** on long inline commands (the same class X-1 hit in 225) — both commands were auto-saved and executed via the recovery path; zero effect on the work.
2. **First script run caught its own bug before writing**: I failed to store the regex match index when parsing payload blocks, so every block sliced to EOF; the pre-write assertion (`row-count delta != 20`) threw and **the corpus was never touched** (sha re-verified unchanged). Fixed (`marks[i+1].index`), second run green. The assertion-before-write design is what prevented a corrupted file.
3. **EOL discovery**: `file`/git were ambiguous about CRLF; node measured the file as **all-LF** (0 CRLF / 322 LF). Insertions used LF to match; post-check CRLF delta = 0. (Git prints an autocrlf warning on diff — pre-existing, content-neutral.)
4. **No test runs were needed or made** — this is a text fold; every done-when line is a grep/diff/git check, all pasted above. No `src/`/`scripts/` edits; no npm.
5. **Not touched (other writers in flight, boxes respected)**: `scripts/README-cli.test.mjs`, `.github/`, `src/lib/zero-byte-guard.test.ts`, `fixes/247_lane2-5`, `fixes/248`, W16's modified files.

## WHAT WAS NOT FOLDED (deliberate)

- **F5** stays REJECTED (fixes/228 §3 #28 + D3.2 — embeddings break the determinism axis; the stop-sign is recorded; revisit only for edit-existing-repos via an AST pass, never embeddings) — not added, appendix states it.
- **OV-TBD** stays a RESEARCH NOTE, not a product row (D3.6; 225's raw security counts stay caveat-bound).
- **C4/C5** stay no-action / withdrawn (C5's marker half landed inside OV-35).
- **C-3 · OV-27 · OV-29 · OV-31/OV-6 · OV-21 · AUD-2 coverage** — folded into their absorbers with markers (no separate rows) — see the convention & appendix lists above.
- **Existing rows' cells and statuses were NOT modified** (additive-only mandate). W14–W16 landings and the W16/W17 in-flight state are recorded in the §7 appendix STATE NOTE + `fixes/246` (statuses read from disk would otherwise contradict the frozen W13 table; the "disk wins" rule is honored by the appendix + markers, not by rewriting cells).

*End of W17-L1 deliverable. Every number above is a command output from this session; the fold is insertions-only and attributable row-by-row.*
