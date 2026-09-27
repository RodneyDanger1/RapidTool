# W5 — THE FAILURE WARDEN (wave 292) · incident log

**Role:** watchdog over the 18 live work lanes. NO product edits (read-only over product;
doc-only writes = this log). No gates run, no keyed calls. Log-early: skeleton at 01:07,
appended per sweep.
**Scope:** 18 live lanes — K1–K9 (`deleg_e1758fce` tasks 0–8), K10–K15 (`deleg_2879dda4`
tasks 0–5), L1–L3 (`deleg_1eb6fe2b` tasks 0–2). Plus forensic read of tonight's three dead
batches: B/Q (`deleg_5f2a88c4`), C (`deleg_13a70aee`), WD (`deleg_d6dc772c`).
**Failure classes monitored:** (a) runner deaths (transcript stale >10 min mid-run) ·
(b) backgrounded test legs (`stdin is not a tty` + EXIT:1 phantom) · (c) full gates
mid-edit (typecheck/lint/test while siblings live) · (d) keyed calls (`--keyed`, 402, key
usage) · (e) double-writes (two lanes patching one file within minutes).
**Method:** periodic sweeps (sleep in-call) over all transcripts; per sweep grep the class
markers, timestamp, append findings with lane + excerpt. Transcripts:
`C:\Users\mnril\AppData\Local\hermes\cache\delegation\live\<deleg>/task-<n>.log`.

## SWEEP LOG

### SWEEP 1 — 01:09–01:14 baseline (all 18 lanes + dead-batch forensics)
**Liveness:** all 18 lanes freshly active at 01:13 (ages 0–2 min; K5 already `final
status=completed` at 01:12:01 — duration 924.48s — first closure of the wave). No stale
transcript at baseline.
**Class (b) phantom legs:** ZERO. No `not a tty`, no `nohup`, no backgrounded run in any of
tonight's 23 transcripts (18 lanes + 5 wardens). Historical host artifact only (older waves'
docs: W17/W21 note `stdin is not a tty` under the background harness is a host artifact,
never a code bug) — recorded so nobody files a fiction.
**Class (c) mid-edit gates:** ZERO live gate invocations by the 18. All
`npm test`/`npm run typecheck`/`npm run lint`/`gate.sh` string hits are prose (dispatch
briefs, doc reads: L2 read 94_readiness_plan.md's historical `npm test` line; K11/K14 read
docs mentioning gate.sh). One scoped `npx eslint <files>` by K1 at 01:07 (permitted).
**Class (d) keyed:** ZERO real keyed calls. `--keyed` hits: 1, false positive (L3 reading
run-eval.mjs's docstring). `402` hits: all false positives — file sizes (4022/4029/40288/
64402), errors.ts doc text (`HTTP 402` / RT_E_LLM_NO_BALANCE), deepseek.ts source
(`case 402`). No key usage, no payment signal anywhere tonight.
**Class (e) double-writes:** no concurrent pair yet. Watchlist (shared-file pairs):
`src/lib/io.ts` (K7 "io de-dupe" vs K10) · `scripts/run-eval.mjs` (K3 scripts vs K9 eval vs
L3) · `scripts/*.test.mjs` (K15 vs K9/L3) · `research/eval-corpus/**` (K9 vs L3).
**Product writes so far (mtime):** cassette.ts 01:11 (K2) · runtime-timeline-pane.tsx 01:13
(K1) · io.ts 01:14 (K10) · engine.ts 01:23 (K10) · probe.ts 01:17 (K4) · knowledge.ts 01:17
(K2) · git.server.ts 01:20 (K2). Transient `.hermes-tmp.CuNJDB/.gliUKg` (01:14) already
cleaned themselves. Standing hygiene debris: `src/lib/auth/.hermes-tmp.pw0XNe` +
`fixes/.hermes-tmp.ACROWI` (old; K2's box).

### DEAD-BATCH FORENSICS — the 3 batches that died tonight (B/Q, C, WD)
**Signature:** transcripts end mid-tool-call ~00:20–00:21 with no result line (some
NUL-padded = killed mid-write); manifests still say "running" (orphaned). Death window
00:17–00:21; all three batches died inside the same host event.

**B/Q (`deleg_5f2a88c4`, started 00:06, died ~00:21):**
- **B1** died 00:21:27 mid-patch (3rd consecutive) on `src/components/runtime-timeline-pane.tsx`
  → possible half-edit; **K1 owns the finish** (file since rewritten, mtime 01:15:51).
- **B2** died 00:21:24 right after a landed patch (`patch ok 73.8s`). Last-writer files
  (landed, unverified): `src/lib/db.ts` mt 00:20:14 · `scripts/migration-plan.mjs` 00:20:14 ·
  `scripts/migrate.mjs` 00:17:15 · `src/lib/auth/pglite-dialect.ts` 00:17:14 ·
  `src/lib/runtime-log.server.ts` 00:17:15. **K2 owns the finish.**
- **B3 = NOT a death** — completed cleanly 00:20:49 (iteration cap, 861s): summary
  "reconnaissance complete, **no patches landed**" (honest; scripts sweep unfinished → K3 owns).
- **B4** died ~00:20:2x mid-patch on `src/lib/llm/providers/mock.ts` + `src/lib/cassette.ts`.
  mock.ts mt 00:20:19 (landed); cassette.ts since rewritten by K2 (01:11); rt-client.ts
  00:17:28. **K4 owns the finish** (already rewrote probe.ts 01:17:42).
- **Q1** died 00:21:25 mid-patch on `~/w39q1_scratch/test-name-scan.mjs` — home scratch only,
  **no product risk**.
- **Q2** died 00:21:29 mid-patch on `src/lib/auth/server.ts` (2nd of the pair; 1st landed
  mt 00:20:14, 2nd lost). At-risk (last-writer = dead Q2, landed-unverified):
  `src/lib/auth/server.ts` · `src/lib/auth/popup.server.ts` 00:17:10 · `src/router.tsx`
  00:17:09 · `src/lib/phases.ts` 00:17:10 · `src/lib/multiplayer/index.ts` 00:17:11.

**C (`deleg_13a70aee`, started 00:07, died ~00:21):**
- **C1** died 00:21:23 during recon (io.ts read) — **landed NO product patches** (only its
  log); no orphan edits.
- **C2** died 00:20:58 mid-patch on `src/lib/llm/providers/deepseek.ts` (landing
  unconfirmed; file since rewritten by K6, 01:16:59). **K6 owns the finish.**

**WD (`deleg_d6dc772c`, started 00:09, died ~00:17–00:21):** WD1 died inside `sleep 240`
(00:17:14) · WD2 inside `sleep 90` (00:21:18) · WD3 inside `sleep 180` (00:18:46). All three
watchers killed in a sleep — their ledgers stand only up to their captured sweeps.

**Remedies:**
1. *Applied:* the current wave's K-lanes are precisely continuations of the dead lanes
   (K1⊃B1, K2⊃B2, K3⊃B3, K4⊃B4+Q2, K5⊃C1, K6⊃C2, K7⊃Z3/Z5, K8⊃Z4) — every half-edit
   candidate above has a live owner re-reading bytes. No orphan product file is un-owned.
2. *Applied (this lane):* ≥10-min staleness threshold each sweep; any stall gets timestamped
   here so the parent can re-dispatch instead of waiting.
3. *Needed (process):* keep test legs FOREGROUND (phantom class); keep full gates OUT of live
   waves (typecheck/lint/test only at wave boundary, `scripts/gate.sh`); log-early +
   iteration-cap discipline (B3's honest "no patches landed" is the model for cap-outs).

### SWEEP 2 — 01:30:56 (closure wave)
**Statuses:** K1 · K2 · K4 · K6 · L1 ACTIVE (0-min ages). CLOSED (clean `final`): K5 01:12:01 ·
K9 01:15:58 · L2 01:16:30 · L3 01:17:58 · K7 01:18:25 · K8 01:21:46 · K3 01:23:57 · and the
whole K10–K15 batch at 01:30:43 (`end status=completed exit_reason=max_iterations`).
**No runner death this sweep** — all stops carry clean end markers (no mid-call cut, no
NUL-padding). Half-edit check on the K10–K15 batch: K10's last patch (engine.ts) landed
`patch ok 119.0s` at 01:28:44 before its final at 01:28:57; K11–K15 landed no patches → **no
dangling writes**.
**⚠ OPERATIONAL FINDING — mass iteration-budget exhaustion (the governing failure of the
wave):** 12 of 15 K-lanes + L2/L3 closed on `max_iterations` with recon-only or partial
delivery. Zero-patch closures: K5, K7, K9, K12, K13, K14, K15, L2, L3 (+K3/K11 partial:
K11's own summary says "0 code patches landed"; K3 partial). Each lane's own final summary
says it plainly (e.g. K7 "recon complete, ZERO product patches landed"; K12 "iteration cap
reached… ZERO product patches"). **Implication:** the night's K/L wave under-delivers by
design of its budget, not by crash — any doc claiming this wave landed the register/UI/eval
remainders must be checked against bytes (W4/W3's box). **Contributing mechanism (measured):**
individual `patch` tool calls run 74–119 s each (B2 73.8 s · L1 100.1 s · K10 119.0 s), so
recon+verify+patch cannot fit a lane budget — lanes that chose verify-first ran out before
their first patch. **Remedy needed:** pre-scoped patch lists per lane (parent supplies exact
edits), or higher per-lane iteration budget, or patch-batching.
**Keyed/phantom/gates:** still ZERO (re-verified at sweep: all counts 0; the K6 `tc=2` and
K11/K14 `gate=` hits are doc/package.json reads; K1's `node --test src/lib/rt-timeline.test.ts`
is a scoped own-file leg — permitted).
**Product writes 01:14–01:31:** io.ts 01:14 (K10) · runtime-timeline-pane.tsx 01:15 (K1) ·
deepseek.ts 01:16 (K6) · knowledge.ts + probe.ts 01:17 (K2/K4) · git.server.ts 01:20 (K2) ·
routes/__root.tsx 01:20 (K1) · scripts/path-safety.mjs + scripts/write-atomic.mjs 01:23 (K3) · store.ts
01:24 (K10) · llm.ts 01:25 (K6) · engine.ts 01:26 (K10) · tavily.server.ts 01:26 (K4) ·
store.test.ts 01:28 (K10/K15?) · node-runner.server.ts 01:29 (L1) · websearch.server.ts 01:30
(K4) · migration-plan.mjs 01:31 (K2).
**Double-write check:** no pair. K7 landed zero product edits → io.ts stays K10-only (01:14).
run-eval.mjs (20:13), console.tsx (20:05), chat.server.ts (21:31), scaffold.ts (20:22) all
untouched tonight → K9/L3/K3/K5 collisions never materialized. store.ts (01:24) vs
store.test.ts (01:28) — same lane cluster (K10/K15 interplay), not cross-lane.



<!-- W5-SWEEP-MARKER :: append each sweep ABOVE this line, newest last -->
