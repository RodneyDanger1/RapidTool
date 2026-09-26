# fixes/263 — W24 LANE B4: docs / plans / logs organization

**Status: IN PROGRESS (log opened early per the wave rule; final section lands when the fixes are in).**
**Owner:** W24-B4 · **Box:** `research/**` (new only), `fixes/**` (new/append only), `README.md`,
`scripts/README-cli.md`, `AGENT_GUIDE.md` (read-only), root docs. **HEAD:** b721f9c.

## Bottom line (as of first write)

1. **CLI verb count re-derived: 37** (`grep -c 'case "' scripts/rapidtool-cli.mjs` → 37; all 37 arms unique,
   listed below). The wave plan predicted "35→36 after the `eval` verb" — the disk says **37**, because BOTH
   `fixtures` (case at `rapidtool-cli.mjs:946`) and `eval` (`:1009`) landed in W23. `scripts/README-cli.md`
   already carries 37 (W23 corrected it); **`README.md` still says 35 at :9 / :82 / :103** → corrected to 37.
2. **`scripts/README-cli.md` stale "35 case arms"** at :363 and :434 (both sit in `verify-kind` notes whose
   own adjacent line says 37) → corrected to 37.
3. **`eval` verb row** missing from the README-cli Commands tour (#1–#33; `fixtures`/`scan` are also tour-missing
   — `scan` has its own section; findings below) → an `eval` row added mirroring the tour's shape, and the
   dangling "row #34 below" pointer for `edit` (no tour row #34 exists, never did — checked back to W14's
   `4328d20:scripts/README-cli.md`) re-pointed at the Edit section.
4. **Broken cross-reference `fixes/150 G1`** (README-cli ×5; also AGENTS.md ×1 — PROTECTED, proposed not
   edited): there is **no `fixes/150_g1.md`** and never was — `fixes/151_watchdog.md:19` states verbatim
   *"No `fixes/150_g*.md` logs exist yet (all 5 lanes)"*. The refs are to the **fixes/150 wave** (the 5-lane
   10X wave), whose watchdog record is `fixes/151_watchdog.md` §1. Marked as wave-refs pointing at 151 §1 —
   meaning preserved, not deleted.
5. **`README.md` "36 dossiers"** (:145, :170) is stale: `ls research/multiagent/*.md | wc -l` = **102** today
   (`research/multiagent/219a_inventory_and_reality.md:239` already flagged it at 78 in the W21–22 era) →
   corrected to the measured number + command.
6. **NEW `research/multiagent/263_state_of_play.md`** — the one-page sourced state (done / left / the
   run arc / the fundedness wire), every number citing its source file. Landed with this lane.

## Evidence commands (re-runnable)

```bash
grep -c 'case "' scripts/rapidtool-cli.mjs          # 37 (count source of truth per AGENTS.md)
ls research/multiagent/*.md | wc -l                  # 102
ls fixes/150_g*.md 2>/dev/null                       # (nothing) — the fixes/150 per-lane logs were never filed
grep -n 'case "' scripts/rapidtool-cli.mjs           # all 37 arms, source order
node --test scripts/README-cli.test.mjs              # doc-contract test: count claim == arm count
```

## The 37 arms (source order, `rapidtool-cli.mjs`)

create 444 · run 467 · gate 468 · approve 539 · reject 624 · retry 662 · ingest 680 · packet 749 ·
export 790 · emit 804 · fixtures 946 · eval 1009 · tree-run 1145 · repair 1216 · edit 1321 · summary 1623 ·
vault 1629 · search 1658 · crew 1676 · verify 1699 · check 1752 · scan 1783 · design 1820 · diagram 1842 ·
artifacts 1877 · harvest 1891 · swarm 1921 · prompt 1946 · bench 1970 · mine 1996 · knowledge 2028 ·
lesson 2092 · wild 2834 · chat 2913 · deepen 2972 · doctor 3028 · diagnose 3048

## Deliberately NOT touched (and why)

- **`AGENTS.md`** — PROTECTED by the wave rules. It still carries "`rapidtool-cli.mjs` (35 verbs dispatched
  today — `grep -c 'case "'` is the count source of truth …)" at :50-52 and "fixes/150 G1" at :52. Proposed
  change text is in the final section of this log; the owner (or a lane with an explicit grant) must apply it.
- **Other `fixes/**` logs + `research/**` dossiers** referencing `fixes/150` / old verb counts — append-only
  historical records; a re-write would falsify what was written at the time. Left as-is; this log is the
  correction of record.
- **`research/eval-out/*`** run artifacts — evidence, not docs.
- **Tour gaps for `fixtures` + `scan`** — real (neither has a Commands-tour row; `fixtures` also lacks a
  section headed like the others). Reported here; the parent asked specifically for the `eval` row, so only
  that row is added. Proposal: give `fixtures` a tour row + section in a follow-up pass.

---

## FINAL — what landed (W24-B4 close)

**Status: LANDED (docs-only; no product code touched).** Targeted foreground runs only (wave rule).

**Corrections to the first write above:**
- The run-arc ledger file cited as `fixes/257` is properly **`fixes/257_error_ledger_v3.md`** (§A holds the
  #1→#2→#3 arc).
- HEAD advanced mid-lane: the parent committed **`4b7031b`** ("T5.2-A wired end-to-end + run-eval fundedness
  wire") on top of `b721f9c`; this lane's edits ride on `4b7031b`.

**Landed changes (before → after; anchors re-grepped at close):**

| # | site | before → after |
|---|---|---|
| 1 | `README.md:9` | `**35 verbs**` → `**37 verbs** — re-derived: \`grep -c 'case "' scripts/rapidtool-cli.mjs\` = 37` |
| 2 | `README.md:83` | `(35 verbs)` → `(37 verbs)` |
| 3 | `README.md:104` | `Headless CLI: 35 verbs, …` → `37 verbs, … + the read-only \`eval\` scorecard verb` |
| 4 | `README.md:146` | `(36 dossiers)` → `(100 files today — \`git ls-files research/multiagent/ \| wc -l\` = 100)` |
| 5 | `README.md:171` | `36-dossier analysis program` → `analysis program (100 files today; …)` |
| 6 | `README-cli.md:376` + `:447` | `none of the 35 case arms` → `none of the 37 case arms` (×2) |
| 7 | `README-cli.md:197` | **new Commands-tour row #34 for `eval`** (shape mirrors the tour; flags from the arm at `rapidtool-cli.mjs:1009`; USAGE parity pinned by the doc-contract test) |
| 8 | `README-cli.md:24` | dangling `row #34 below` (edit) → `its own [Edit section](#edit-edit) below` — no tour row #34 ever existed, checked back to W14 (`4328d20:scripts/README-cli.md`) |
| 9 | `README-cli.md` `fixes/150` ×5 (:27, :181, :185, :444, :891) | `fixes/150 G1` → `fixes/150 wave G1` + a top **Ref note** (:37-41) quoting `fixes/151_watchdog.md:19` / `:162` — the per-lane logs were never filed |
| 10 | `README-cli.md` scan posture | `(218 §3.4 / OV-21)` → `(fixes/218 §3 item 4 / OV-21)` (218 §3 has items 1–6, no §3.4; item 4 = G4, the scan's own lineage) |
| 11 | NEW `research/multiagent/263_state_of_play.md` (87 lines) | one-page sourced state: done / the run arc / the fundedness wire / what's left — every number cites its source file |

**Evidence runs (all targeted, foreground):**
- `node --test scripts/README-cli.test.mjs` → **11/11 pass** (after every edit; the doc-contract test binds
  the 37 claim == 37 arms == the README verb list == USAGE keys).
- `grep -c 'case "' scripts/rapidtool-cli.mjs` → **37** (re-derived at open, mid, and close).
- `node --experimental-strip-types scripts/rapidtool-cli.mjs eval` → `ok:true`, exit 0 (read-only; run as
  doc evidence).
- No repo-scope typecheck/lint/test-suite/build (wave rule — siblings mid-edit).

**Findings NOT fixed (reported, not hidden):**
1. `fixtures` (and `scan`) also lack Commands-tour rows — out of the stated scope (the brief named the
   `eval` row). Proposal: same treatment in a follow-up docs pass.
2. **`AGENTS.md` (PROTECTED) still says "35 verbs" (:50-52) + carries the `fixes/150 G1` ref (:52).**
   Proposed replacement text for the owner/consent path:
   > `- scripts/ — CLI + build tooling: rapidtool-cli.mjs (37 verbs dispatched today —`
   > `grep -c 'case "' is the count source of truth — incl. the lesson family + diagnose + the`
   > `fixes/150 wave's G1 continuation verbs tree-run/repair (per-lane logs never filed —`
   > `fixes/151_watchdog.md §1 is the record) + fixtures + scan + eval),`
3. Other `fixes/**` logs + `research/**` dossiers still quote old counts / `fixes/150` — append-only
   historical records; not rewritten (see "Deliberately NOT touched" above).
4. `README.md:138` "test counts now scripts 235/235 + src 1811/1811" is W5-era narrative — accurate as
   history under "Progress so far"; left as-is (current counts live in the top Status block, `fixes/218` §5).
5. `research/multiagent/` is 102 files on disk vs 100 tracked — the 2 untracked W24 sibling dossiers
   (`thoroughaction.md`, `thoroughanalysis.md`) are in flight, not counted.
