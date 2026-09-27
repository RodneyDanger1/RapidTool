# 292 — W2 OBLITERATION GUARD — the campaign-memory integrity watch (18-lane campaign)

**Role:** W2 — the anti-destruction watchdog. **DOC-ONLY** (this file + scratch outside the repo; no product edits; no gates/keyed calls). **Append-only.**
**Mission:** protect the campaign's memory — snapshot sizes/md5s/markers/control-anchors; poll for **non-decrease + marker integrity + console controls + headers-not-removed**; record ANY violation mid-stride with evidence; final integrity verdict + t0-vs-tN table.
**Watch scope (protected artifacts):** `finalsprint.md` · `research/multiagent/thoroughanalysis.md` · `research/multiagent/thoroughaction.md` · `wave_plans/W34/prep.md` · `W34/code-notes.md` · `W35/factory-notes.md` · `W36/completion.md` · `W37/master-pack.md` · `W38/NEW-SESSION-PROMPT.md` · `wave_plans/W40/CONTINUE-PROMPT.md` (**as it appears** — absent at t0; K8's job includes creating it) · `fixes/263_index.md` · `src/components/console.tsx` (**no CONTROL may vanish**).
**Tooling (outside the repo):** `C:\Users\mnril\w2_guard\` — `snapshot.py` (writes JSON: bytes/md5/lines/mtime/last-line/marker-lines/headers per file + console anchors + W40 presence) · `compare.py` (violation report vs t0 + rolling-max state) · `show.py` · `bytecheck.py`. Baselines: `t0.json`, rolling `state.json`. Every number below = the script's output at the timestamped read.

## PROTOCOL (fixed at t0)

1. **Snapshot** every poll (~4–6 min cadence, sleep in-call). Per file: bytes, md5, lines, mtime, last line, marker-is-last, header list; console: `Tabs.Content`/`onClick`/`RunTab`/`Tabs.Root`/`Tabs.Trigger`/`RunTabTrigger` counts + `RUN_TABS` id list + pane exports.
2. **Violation classes:** MISSING file · size **decrease** · end-marker changed/not-last/multiplicated · header(s) removed · console anchor decrease · RUN_TABS id or pane-export loss. Any of these → incident row (file, before/after bytes + md5, marker/line, timestamp), evidence = the two snapshots.
3. **Exception clause** (from the brief): *"sizes must be NON-DECREASING (except the 2 documented corrections)"* — **the two corrections are not yet pinned from the docs at t0.** Searched so far: `finalsprint.md`, `wave_plans/W34–W38`, `research/multiagent/thoroughaction.md`, `fixes/289–292` logs, `W37/master-pack.md`, `W38/NEW-SESSION-PROMPT.md`, repo-wide greps for `documented correction|non-decreasing|MASTER-CORRECTIONS`. Candidate classes found (none yet applied as a size-decrease): (a) WDX-2's RS-01..RS-04 + CF-4 → land as **append-only `§MASTER-CORRECTIONS`** (never edit the table in place — `wave_plans/W33/unlanded-block.md:37`), so no shrink expected; (b) N4's owed "fix the binary control byte" (`fixes/281_n4_records.md`) → **t0 bytecheck: ALL 12 watched files are clean UTF-8, 0 control bytes** → nothing pending; (c) record-paste conventions where a section is "already live — verified" (`wave_plans/W36/completion.md`) → a placeholder-replacement could net-shrink by a few bytes; (d) WD-δ's "2 CORRECTIONS" (W-22/W-29a, `thoroughaction.md` §WD-7 poll 9) → already landed additively. **Adjudication rule until pinned:** any decrease gets an incident row with evidence; if a campaign doc names it as an intended correction, it is annotated `ADJUDICATED-ALLOWED (documented correction: <doc>)`, else it stands as a violation. The pinning continues during the polls.

## t0 SNAPSHOT — read 2026-09-27 01:08:24

**git provenance:** HEAD `2fa3cd9` (W29–W39 completion era; committed 00:56) · porcelain 21 (lane logs + `M finalsprint.md` **+99/−0 vs HEAD = growth-only, pre-t0**; `M src/lib/cassette.ts` +45/−2, `M src/lib/io.ts` +7/−4 = K-lane in-flight, not memory files) · console.tsx **clean vs HEAD** (any edit after t0 = new signal).

| # | protected artifact | bytes | md5 (full) | lines | hdrs | end-marker / tail state @t0 |
|---|---|---|---|---|---|---|
| 1 | `finalsprint.md` | 48,371 | f74601dacb85aedc417c0e9a7950dae5 | 262 | 17 | `END-OF-FILE-MARKER-SPRINT` = last line, marker_count=1 |
| 2 | `research/multiagent/thoroughanalysis.md` | 308,918 | 491fbef6f0b7aa922a731bde65bea980 | 1460 | 46 | `END-OF-FILE-MARKER-W25` = last line, marker_count=1 |
| 3 | `research/multiagent/thoroughaction.md` | 227,246 | 3206f8a397ab186820d2d2f4211fb414 | 744 | 58 | `END-OF-FILE-MARKER-ACTION` = last line, marker_count=1 |
| 4 | `wave_plans/W34/prep.md` | 35,521 | ddf791e251ebebdf8d3a8b729e634582 | 191 | 16 | `END-OF-FILE-MARKER-PREP` = last line, marker_count=1 |
| 5 | `wave_plans/W34/code-notes.md` | 77,459 | 4351da2de2c0bc3539b7dcdd938c4318 | 651 | 57 | `END-OF-FILE-MARKER-NOTES` = last line, marker_count=1 |
| 6 | `wave_plans/W35/factory-notes.md` | 6,951 | 5c4fc41b5d6a66a2011b6fadcb6e66f9 | 34 | 7 | `END-OF-FILE-MARKER-FACTORY` = last line, marker_count=1 |
| 7 | `wave_plans/W36/completion.md` | 7,153 | b93ab8508afa9620854c1efbe8405974 | 38 | 7 | `END-OF-BRIEF` = last line, marker_count=1 |
| 8 | `wave_plans/W37/master-pack.md` | 5,941 | ddb03454271ed008ec89703ece711377 | 54 | 9 | no end-marker; tail sentinel = "**Dispatch X1–X6 in parallel** …" (recorded) |
| 9 | `wave_plans/W38/NEW-SESSION-PROMPT.md` | 10,433 | c7684eeb4baf9d14a67e77f35b63bd0b | 48 | 9 | no end-marker; tail sentinel = "Small honest patches beats big clever ones …" (recorded) |
| 10 | `wave_plans/W40/CONTINUE-PROMPT.md` | — | — | — | — | **ABSENT at t0** (dir absent) — being created by K8 this campaign; on appearance it enters the non-decrease watch (NEW-ARRIVAL warning) |
| 11 | `fixes/263_index.md` | 22,378 | a98611b569b3576e3845538a94a1ef30 | 510 | 31 | no end-marker; tail sentinel = "- [W4/lane-5.md](../wave_plans/W4/lane-5.md)" |
| 12 | `src/components/console.tsx` | 289,102 | 25c8e79e6b5162ab7afee96b45bf8bd4 | 6832 | — | **console control anchors @t0** (below) |

**console.tsx control anchors @t0 (no CONTROL may vanish):**

| anchor | count @t0 |
|---|---|
| `Tabs.Content` | 24 |
| `onClick` | 57 |
| `RunTab` (word) | 6 |
| `Tabs.Root` | 3 |
| `Tabs.Trigger` | 2 |
| `RunTabTrigger` | 3 |
| `RUN_TABS` ids | **11**: artifacts · packet · chat · spec · crew · oracle · vault · design · diagram · runtime · fixtures |
| pane exports | **3**: `EvidenceRow` · `HomeScreen` · `RunScreen` |

**bytecheck @t0 (the "binary control byte" lore):** all 12 watched files = clean UTF-8 · 0 control bytes · no NUL · no BOM. (`finalsprint.md` reads as text; the earlier `read_file` binary-misdetection is not reproducible at t0.)

## POLL LOG (append per poll; violations flagged inline)

### POLL 1 — read 2026-09-27 01:18:17 (t0→p1 Δ = 9m53s) — **ALL CLEAN; the big records wave landed**

**Delivers this poll:** K8's owed-paste batch reached disk between t0 and p1 (attribution = the sections' own self-statements, e.g. finalsprint `:583` "Appended 2026-09-27 by **W40 K8** as the owed N4 → Z4 payout").

| artifact | t0 B | p1 B | Δ | md5 t0 → p1 | verdict |
|---|---|---|---|---|---|
| `finalsprint.md` | 48,371 | **99,602** | **+51,231** | f74601da→d12d810f | GROWTH · marker last-line ✓ · marker_count=1 ✓ · headers 17→46 (+29), **0 removed** |
| `wave_plans/W34/prep.md` | 35,521 | **45,989** | **+10,468** | ddf791e2→da0c311f | GROWTH · marker last-line ✓ · headers 16→20 (+4), 0 removed |
| `wave_plans/W34/code-notes.md` | 77,459 | **86,780** | **+9,321** | 4351da2d→495fec11 | GROWTH · marker last-line ✓ · headers 57→61 (+4), 0 removed |
| thoroughanalysis.md · thoroughaction.md · W35/factory-notes.md · W36/completion.md · W37/master-pack.md · W38/NEW-SESSION-PROMPT.md · fixes/263_index.md · console.tsx | — | — | 0 | (unchanged) | no signal |
| `wave_plans/W40/CONTINUE-PROMPT.md` | ABSENT | ABSENT | — | — | still absent (watch continues) |

**New finalsprint sections (headers added, none removed):** §T1 `:264` · §T2 `:329` · §T3 `:361` · §T4 `:398` · §T5 `:437` · §WDX-2 `:524` · §WDX-3 `:567` · §MASTER-CORRECTIONS `:583`. §S1–§S4 placeholders (`:35/:38/:41/:44`) remain `_(pending …)_` (untouched). §S5 `:244` intact.
**Console:** 0 control loss (md5 byte-identical @p1: 289,102 B · 25c8e79e — anchors all hold: 24/57/6/3/2/3 · 11 tabs · 3 pane exports).
**Violations: 0.** Warnings: 0.
**Restorability:** content backups now kept per poll at `C:\Users\mnril\w2_guard\backups\p1\` (11 files, 1.2 MB — full copies of every watched artifact as of p1).

### POLL 2 — read 2026-09-27 01:26:26 (Δ 8m09s) — ALL CLEAN; the W35 factory pastes landed

- `wave_plans/W35/factory-notes.md`: 6,951 → **31,409 B (+24,458)** · md5 5c4fc41b→fd659e5c · headers 7→24 (**+17: §F3 / §F4 / §F5 + sub-blocks**) · 0 removed · marker `-FACTORY` still last-line, marker_count=1 ✓.
- All other artifacts unchanged this poll (finalsprint 99,602 · prep 45,989 · code-notes 86,780 — hold from p1; console.tsx byte-identical).
- W40 dir still absent. **Violations: 0 · Warnings: 0.** Backups: `backups/p2`.
- Note: the four record-paste targets (finalsprint / prep / code-notes / factory-notes) are now all in their post-paste state; remaining expected signals = K8's `wave_plans/W40/CONTINUE-PROMPT.md` (NEW-ARRIVAL watch) + `fixes/283_final_ledger.md`, L1/L2/L3 lanes (L2 may edit console.tsx — additive only).
