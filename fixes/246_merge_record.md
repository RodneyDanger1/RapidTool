# fixes/246 — MERGE RECORD: W14–W16 wave folded and committed (`4328d20`)

**Written by the parent, 2026-09-24 ~13:30.** This is the plan's own "commit at merge" step, executed on
certified evidence — not on self-reports.

## What was committed (`4328d20`, 88 files, 0 deletions, tree clean after)

**Code (all boundary-verified by the parent, foreground):**
| file | what | proof of record |
|---|---|---|
| `src/lib/headless.ts` | C-1: mint-before-gate in BOTH seams (journey + repairTreeDir) | 92/92 · WD-β CONFIRMED (mint really before gate; guards intact) |
| `src/lib/headless.test.ts` | C-1's RED-first journey test + W15-L1's repair-seam test (`ok 11`) | 91→92, +96/−0, sensitivity-proven RED |
| `scripts/run-eval.mjs` + `.test.mjs` | C-2: `"dod"` terminal, coded (`RT_E_GATE_PENDING`), 80 rounds → 1 | 17/17 with the one-round pin |
| `scripts/browser-guard.mjs` + **new** `scripts/browser-guard.test.mjs` | OV-2: Windows prefix fix + the 4-case pin | 40/40 verdict pins intact · guard 4/4 · live smoke exit 0 |
| `scripts/rapidtool-cli.mjs`, `README.md`, `AGENTS.md`, `README-cli.md` + test | doc-truth: 35 verbs, real Quickstart, `emit --red-tree`, counts re-derived | README-cli 11/11 · all arms probed |
| `src/lib/errors.ts` + test | RT_EVAL_* classified as labels (registry 27/27, no invented codes) | 37/37 · shape pin `errors.test.ts:412-414` forces the strike |
| `fixes/217c` | isolation slot SETTLED: ABSENT | independent re-run (docker/bwrap 127, WSL 0) |

**Corpus (now in git — the day-long untracked risk is over):** `research/multiagent/219a–241` (the inquest
+ audits + playbook + strengthenings), `fixes/218–243` + `256` (=`236`), `wave_plans/W13–W16`, the boards.

## Certifications folded (all independent, none self-reported)

- **WD-α / WD-β (W14)** — lanes safe; C-1 CONFIRMED; 3 precision strikes on `fixes/236` applied (2 fixed, 1
  open-cosmetic); P1-α-01/02 adjudicated *against the parent's brief*, corrected on disk.
- **WD-1 (W15)** — `6 polls · 0 P1 · 20 claims OK / 0 wrong · 0 rebuild flags`; every box md5-verified
  (L3 touched nothing but its log — no defect justified an edit).
- **WD-2 (W15)** — `W14 closures: 2 certified / 0 asserted-only (7/7 rows) · P1-α-01 RATIFIABLE (naming
  verified at 230:281-282/494/501 + 220:113) · corpus growth-only · behavior defects: 0`.
- **Environment anomaly resolved**: `stdin is not a tty` / exit 1 kills node under Hermes's BACKGROUND
  harness (3 false failures today: WD-β's run, L3's smoke, L1's run; 8+ contradicting foreground runs). In
  memory + `C:/Users/mnril/w15_parent_evidence.txt`; all briefs since W16 carry the warning.

## What is explicitly NOT done here (the honest remainder — next session/lane)

1. **The row-by-row fold into `220_tasklist_canonical.md`**: the ~19 accepted new rows (OV-19…OV-43 per
   `fixes/228` §3's ACCEPT/MODIFY table) are NOT yet rows in the canonical table; they exist in the
   dossiers + the chat task list. And **`research/multiagent/241_weak_verification_strengthenings.md`**
   (13/13 strengthened commands; 11 change the done-when) is **specified but not applied** to the rows.
   → This is the next parent/lane job; it is a text fold with zero code risk, specified to the last command.
2. **The W16 wave** (4 lanes + observer) is in flight on top of `4328d20` — its landings (OV-35 preflight,
   TASK-01, DF-18/26, OV-18/14) will need their own boundary + commit.
3. **Precision items left open (non-blocking)**: WD-2's 4 (3×P3 + 1×P4); `fixes/236`'s unnamed typo;
   the `--test-name-pattern` no-op trap is closed by pairing but could be codified repo-wide.
4. **The 63-item chat task list** stands: 7 ✅ · W15's loose ends now closed (repair-seam test, RT codes,
   browser residuals, strengthenings) · W16 in flight · the rest pending per the tiers.

## The one-line state

`4328d20` carries a tree that is **verifiably better than `7582771`** on 7 completed task rows, with every
claim certified by an agent whose job was to falsify it — and with the next fold (rows + verifications)
specified to the command.
