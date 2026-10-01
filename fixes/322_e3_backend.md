# 322 · E3 BACKEND MONITOR — W44 "10 EXPERIMENTS" campaign (E1 operator)

Lane E3 (backend half of the E2/E3 monitor pair). Watching E1's 10 keyed builds under
`C:/Users/mnril/w44_trial/exp/`. **Read-only**: no create/gate/wild/approve/emit verbs,
no key spending, no repo edits (this log excepted), no kills.

Scope: (1) process sanity every ~5 min (`ps -W | grep node`, `pgrep` when available);
(2) per-experiment artifact reads (build.json + streams + ledgers) for
truncation/malformed/gaps; (3) spend cross-check (envelopes vs on-disk budget blocks +
approve-step `spent:0` adjudication); (4) hand-read emitted trees of COMPLETED experiments
(census + source/tests + tree `npm test` + `rt.sh doctor --tree`); (5) wall-time table.

- Baseline t0: **2026-09-30 15:47:06 CDT**
- Repo `20802b1`; `git status --short` = 2 lines (`?? fixes/321_d1_live.md`, `?? fixes/321_d2_monitor.md` — prior-wave lane logs); `git ls-files` = 1920
- `exp/` does NOT exist at t0 (`ls: cannot access .../exp/: No such file or directory`); campaign not started
- Node processes at t0: **0** (`ps -W | grep -ci node` = 0)
- Tooling note: `pgrep` is **not installed** in this git-bash (`pgrep: command not found`) → process sanity uses `ps -W | grep` as the substitute for the whole lane.

Status: **OPEN** — awaiting campaign start.

---

## Poll log (timestamped)

| # | time | exp/ state | node procs | notes |
|---|---|---|---|---|
| P0 | 15:47:06 | absent | 0 | baseline |
| P1 | 15:47:55→15:57:11 (loop: 10×55s) | 01→04 full flow (see below) | 0–3 per leg | change-diff poll; every artifact event captured |
| P2 | 15:57:52 | 04 emit done (exit0), npm test (6p/6s/0f exit0), doctor ok, diagnose | 0 | no 05 leg yet at P2 |

## Campaign timeline (file mtimes, exp/01→04) — all 10 planned: 01_website · 02_game · 03_cli · 04_library · 05_dashboard · 06_booking · 07_ledger · 08_notes · 09_scraper · 10_kanban

- **01_website** 15:47:55→15:51:15 — create, gate c0 (P4 park), approve c1, gate c2 (P5 park), approve c3, **gate c3 P6 HARD RED** (96s), approve-on-red refused, diagnose. STOP.
- **02_game** 15:51:31→15:53:08 — same shape; P6 red (`p6-brief-fit, p6-arch`, 51s). STOP.
- **03_cli** 15:53:10→15:55:31 — same shape; P6 red (`p6-verified, p6-brief-fit`, 90s). STOP.
- **04_library** 15:55:41→15:57:46 — c0 P4 park → approve → c2 P5 park → approve → **c3 P6 PASSED** (24s) → P8 park → approve → c4 park → approve → c5 exit 0 `status:"complete"` → **emit --run exit 0** (13s) → npm test → doctor → diagnose. COMPLETE.
- E1 idle-gap note: after 04 close, no new leg 15:58:39→16:02+ (>4 min idle; between 01→02→03→04 gaps were 10–30s; recorded, E1 resumed at own pace).

## Wall-time table (E1 `drive.sh` WALL bytes for 01–03; mtime-derived for 04 — E1 section pending)

| leg | 01_website | 02_game | 03_cli | 04_library |
|---|---|---|---|---|
| create | 3s | 2s | 2s | ~2s (out 15:55:41) |
| gate c0 (P4 park) | 5s | 4s | 6s | ~3-5s |
| approve c1 | 2s | 2s | 1s | ~2s |
| gate c2 (P5 park) | 3s | 2s | 1s | ~2s |
| approve c2 | 2s | 1s | 2s | ~2s |
| gate c3 (P6) | **96s** (RED) | **51s** (RED) | **90s** (RED) | **~24s** (PASS→P8 park) |
| approve c3 / c4 | — | — | — | 2s / 2s |
| gate c4 / c5 | — | — | — | ~2s / ~2s (c5 exit 0) |
| approve-on-red | 2s | 2s | 1s | — (n/a) |
| diagnose | 2s | 2s | 1s | ~2s (13_diagnose 15:57:46) |
| emit --run | — | — | — | 13s |
| npm test | — | — | — | <1s (+overhead) |
| doctor | — | — | — | <1s |
| **Σ CLI (approx)** | **~115s** | **~66s** | **~104s** | **~60s+16s tail** |

## Artifact integrity (01–04; every `.out` read via `e3_scratch/x_env.py`)

- **Envelopes: 0 malformed, 0 truncation** — all 01–03 (8 `.out` each) + 04 (13 `.out`) parse as a single JSON object followed by 0 trailing bytes (`trail=0B`). Sizes 316–4,176B (refusals are the 316B byte-identical `RT_E_GATE_PENDING` envelope).
- **`04/11_npm_test.out` is TAP v13 text, not JSON** (expected for `npm test`; my parser's NOT-JSON flag is expected-class). Content: `# tests 12 · # pass 6 · # fail 0 · # skipped 6` (15:57:26). Independent re-run by me: identical counts, exit 0 (`NPM-EXIT=0`).
- **NDJSON** (`*/\.rapidtool/logs/rapidtool.ndjson`): 8/8/8/11+ lines, every line `json.loads`-clean, final newline present — no partial-line truncation, no gaps (one `cli.invocation` row per leg; 04 grew further after close reads). Honest parks (`gate exit 2`) log as `level:"error", code:null` — same as 321·F-3 (known).
- **build.json**: full valid JSON at every read (112–117KB); no mid-write captures.
- **Checkpoint lifecycle**: `\.rapidtool/checkpoint.json` present for stopped 01/02/03 (last write at P6 leg), **absent for completed 04** — removed between 15:56:09–15:57:08 (completion clears it; logs/ only remains). `checkpoint.run={mode,phase,step}` — resume cursor, no budget.

## SPEND cross-check (task item 3) — envelopes vs on-disk

| exp | gate c0 | approve legs | gate c2 | P6 leg | post-P6 legs | **Σ envelope spent** | **packet block on disk** |
|---|---|---|---|---|---|---|---|
| 01 | 567 | 0,0 | 0 | 35,627 | 0 (refusal) | **36,194** | `15884` |
| 02 | 612 | 0,0 | 0 | 18,378 | — | **18,990** | `0` |
| 03 | 520 | 0,1 | 0 | 30,885 | — | **31,405** | `21820` |
| 04 | 417 | 0,0 | 0 | 4,141 | c5:500 | **5,058** | `500` |

- `cap: 5000000` on every envelope; no 402/no cap/stop_reason bytes anywhere; max single leg = 35,627 (0.71% of cap).
- **approve `spent:0` EXPLAINED (task Q)**: `budget.spent` = per-process session ledger (D2's code verification `headless.ts:1477-1484` T5.5); approve legs run no LLM calls ⇒ 0, NOT a reset. Same for gate-c2 resume legs (`steps:1`, 0). Each leg is a fresh process; nothing carries across. 12 approve/resume legs across 4 exps ALL 0 — pattern fully consistent.
- **[BUG E3-1 · MED] On-disk budget block does NOT reconcile with any envelope — the only budget bytes on disk are a FROZEN per-process snapshot inside the stored Agent Packet markdown** (`build.json .packet` + its `artifacts[N].body` copy; fenced-JSON `budget:{spent,cap,stop_reason}`).
  - Bytes: 01: `.packet` says `"spent": 15884` (vs its P6 envelope 35,627 / Σ 36,194); **02: `.packet` says `"spent": 0` while its P6 leg envelope says 18,378** (worst case — a disk reader sees zero spend); 03: `21820` (vs 30,885); 04: `500` = matches ONLY its last leg (gate c5), not Σ 5,058.
  - Mechanism (read-only source read): `compileAgentPacket(project, {budget})` defaults `budget` to the **process singleton `sessionTokenBudget()`** (`packet.ts:517-520`); engine call sites pass none (`engine.ts:1247`, `engine.ts:1974`) ⇒ whatever process compiled the packet freezes ITS partial spend into the doc; later legs never refresh it (02's shows a pre-LLM 0).
  - Repro: pick any P6-stopped experiment; compare `build.json .packet` fenced budget vs `05_gate_c3_p6.out .summary.budget.spent`.
  - Consequence: `fixes/321` "envelope `spent` is the ledger" is confirmed, and disk-side spend truth is ABSENT/stale — consumers must sum envelopes, never read the packet block as run spend.

## Process sanity (task item 1; `pgrep` unavailable — `ps -W | grep` substitute)

| time | PID (WINPID) | cmd | observed | note |
|---|---|---|---|---|
| 15:47:52 | 1404? (11048) | hermes node (rt.sh exec) | ±3s | 01 create leg |
| 15:49:13→15:50:49 | 13556 (likely) | node | ≥78s seen, ≤134s | 01 P6 synthesis (96s wall) — longest observed |
| 15:50:32 | 11108 | node | short | 01 diagnose / 02 create window |
| 15:51:57 / 15:53:18 / 15:53:53 | 6480 / 8844 / 12900 | node | ≤90s | 02 diagnose, 03 create, 03 P6 (12900 still alive ≥80s @15:55:13) |
| 15:55:54–15:56:09 | 4408 + node.exe ×2 | node | ≤24s | 04 P6 pass leg + emit children |
| 15:56:42–15:57:08 | 4277/13008, 4205308/11004, 4402/5072, 4410/5040 | node + node.exe pairs | short | 04 c4/c5/emit/test legs |
| 15:57:11+ | — | — | 0 | idle |

No zombies observed; no kills made; one process per leg (P6 legs the only long ones). Windows-native `node.exe` children appear only during emit/tree-run legs.

## 04_library emitted-tree hand-read (task item 4) — **VERDICT: REAL CORE + DECLARED SHELL EDGE (not a fabricated pass)**

- Census: **15 files / ~183KB** (`04_library/emitted/`): src 7 + tests 1 + config 5 + `.rapidtool/project.json` (= same 116,552B as build.json) + README/DEPLOY.
- **REAL**: `src/generated/chunk-0.ts` (4,811B) — genuine implementation: `validateDataset` (:10-25), `mean` (:35-42), `percentile` (:54-86, linear interpolation, sort-copy, guards), `generateSummaryReport` (:98-123); exports @:124. `tree.entry` import test passes (cross-file resolution proven).
- **Declared SHELL**: `src/main.ts` package entry — `main()` throws `RT_E_VALIDATION · TODO(E-15) stub: implement the library surface per the oracle (R3-f06)` (:17-19); comment @:15-16 states the refusal stands until implemented. Bridges: `generated.ts` (40B re-export), `analytics.ts` (`export * from "../generated.ts"` + fixes/144 M2 note), routes/store/console likewise.
- **Tests honest**: 6/6 oracle rows VISIBLY `test.skip("... — NOT IMPLEMENTED")` (oracle.spec.ts:64-122); passes = 1 load assertion + 5 capability-presence proxies (spec itself: "presence proxy: a name is NOT behavior", :125-131). No always-true asserts (fixes/135/216b cited in-spec).
- **My independent legs**: `npm test` → 12 tests, 6 pass / 6 skip / 0 fail, exit 0. `rt.sh doctor --tree` → `ok:true` exit 0, inventory `{stubs:0,reexports:0,real:0,files:[]}`, `leftoverJobsAreReexportsOrStubs:true`, gaps list = honest "skip≠green; stubs≠complete".
- **[OBS E3-2] zero-census is SCOPE, not a scanner crash**: `treeSubstanceOf` reports `"empty"` when no `src/jobs/**|jobs/**` files exist (`compile-check.server.ts:617`; enumeration `headless.ts:3789`; doctor leftover := `real===0` `doctor.ts:222`). 04's tree has NO jobs dir (its generatedTree = 2 files at `src/generated*`; emit summary: "3 job nodes unmaterialised (never bridged)"). Read `substance.verdict:"empty"` as "no job modules", never as "tree content-free" — the tree demonstrably compiles 8/8 and the chunk module is real.

## [BUG]/[OBS] tags so far

- **[BUG E3-1 · MED]** stored Agent-Packet budget block frozen/stale vs envelopes (bytes+anchors+repro above).
- **[OBS E3-2]** substance/inventory zero-census = job-source scope (anchors above).
- **[OBS E3-3]** honest `gate exit 2` parks logged `level:"error", code:null` in NDJSON (matches 321·F-3; adjudication pending).
- **Campaign-rate signal**: 3/4 experiments stopped at P6 hard DoD red (01: `p6-brief-fit`; 02: `+p6-arch`; 03: `p6-verified+p6-brief-fit`); 1/4 (04_library) completed to emit. No key-spend incidents (no 402/cap rows).

---
<!-- APPEND -->

=== END 322_e3_backend — PARTIAL (parent-closed 2026-09-30; lane capped before the marker + before 05–10 monitoring (moot: campaign halted at 4/10 — see 322_e1_ten.md closure). Fresh consolidated counts: fixes/322c_v4_verify.md) ===


