# 217i — W12 WATCHDOG 2 — live audit register (deleg_dfd587de)

Status: IN PROGRESS — register created 2026-09-24 10:44 (live audit; updated on each poll).

- Delegation under watch: `deleg_dfd587de` (started 2026-09-24 10:43:16, 7 tasks: lane-a..e + wd-1 + wd-2).
- I am task-6 (WATCHDOG 2). Read-only everywhere except this file.
- Transcripts: `C:\Users\mnril\AppData\Local\hermes\cache\delegation\live\deleg_dfd587de\task-{0..4}.log` (lanes), task-5 (wd-1), task-6 (this one).

## 1. Ownership map being enforced (from wave_plans/W12/wd-2.md)

| Lane | May write ONLY these |
|---|---|
| lane-a | `src/lib/errors.ts`, `src/lib/errors.test.ts`, `src/lib/auth/popup.server.ts`, `src/routes/__root.tsx`, `fixes/217j_*.md` |
| lane-b | `src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts`, `fixes/217k_*.md` |
| lane-c | `src/lib/knowledge.ts`, `src/lib/knowledge.test.ts`, `src/lib/algorithms.ts`, `src/lib/algorithms.test.ts`, `src/lib/harvest.ts`, `src/lib/harvest.test.ts`, `fixes/217l_*.md` |
| lane-d | `src/components/console.tsx`, `fixes/217m_*.md` |
| lane-e | `src/styles.css`, `src/routes/index.tsx`, `src/routes/run.$id.tsx`, `src/components/cmd-palette.tsx`, `src/components/runtime-timeline-pane.tsx`, `fixes/217n_*.md` |

Baseline non-violations (W11 leftovers, expected already modified): `scripts/rapidtool-cli.mjs`, `src/lib/compile-check.server.ts`, `src/lib/compile-check.server.test.ts`, `src/lib/engine.ts`, `src/lib/knowledge.ts`, `src/lib/lesson-writers.test.ts`, `src/lib/node-runner.server.ts`, `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`, `src/lib/token-ledger.ts`, `src/lib/token-ledger.test.ts`, `src/lib/headless.ts`, `src/lib/headless.test.ts`, `src/components/console.tsx`, plus `fixes/216x|216y|216z|217b..217g`, `wave_plans/W10|W11`, and (observed at baseline) `remainingwaves.md`, `taskuniverselog.md`, `src/lib/honesty-guards.test.ts`.

## 2. Baseline snapshot (taken 2026-09-24 10:43:50, before lanes landed)

### git status --short (baseline, raw)
(pasted below in §2.2)

### 2.2 raw output — `git status --short` at 2026-09-24 10:43:50
```
 M remainingwaves.md
 M scripts/rapidtool-cli.mjs
 M src/components/console.tsx
 M src/lib/compile-check.server.test.ts
 M src/lib/compile-check.server.ts
 M src/lib/engine.ts
 M src/lib/knowledge.ts
 M src/lib/lesson-writers.test.ts
 M src/lib/node-runner.server.ts
 M src/lib/scaffold.test.ts
 M src/lib/scaffold.ts
 M src/lib/token-ledger.test.ts
 M src/lib/token-ledger.ts
 M taskuniverselog.md
?? fixes/216x_t11_verification_and_108t7_spike.md
?? fixes/216y_oracle_and_error_audits.md
?? fixes/216z_w10_landing_record.md
?? fixes/217b_watchdog_verification.md
?? fixes/217c_phase5_spec_and_decision_register.md
?? fixes/217d_verify_kind_leg_tests_and_tree_run_build.md
?? fixes/217e_next_action_and_cli_dispatch.md
?? fixes/217f_engine_error_surface_and_tree_gitignore.md
?? fixes/217g_console_s1_bugs_and_compaction.md
?? src/lib/honesty-guards.test.ts
?? wave_plans/W10/
?? wave_plans/W11/
?? wave_plans/W12/
```
Notable: `src/lib/headless.ts` / `src/lib/headless.test.ts` (in the plan's W11 baseline list) show as *unmodified* today — the W11 tree must have been committed/reverted since; treat the above as the true baseline. Everything above matches the plan's W11-leftover list (or is parent/W11-owned: `remainingwaves.md`, `taskuniverselog.md`, `src/lib/honesty-guards.test.ts`).

### 2.3 W12-window writes observed at baseline (10:44:12)
```
10:41:43 fixes/217d_verify_kind_leg_tests_and_tree_run_build.md   <- W11 window (before W12 start 10:43:16), not a violation
10:41:50 wave_plans/W12/lane-a.md        (parent) 10:41:51 lane-b 10:42:15 lane-d/c 10:42:37 wd-1 10:42:38 lane-e 10:42:58 wd-2 10:43:27 W12/README.md
10:43:59 fixes/217m_console_simplification.md   <- lane-d skeleton (its own log; expected)
10:44:05 fixes/217i_w12_watchdog_register.md    <- me
```
No `src/` or `scripts/` file modified in the W12 window at baseline. Full mtime snapshot saved to `C:/Users/mnril/w12wd_scratch/baseline_mtimes.txt` (490 lines).

## 3. Live poll log (lane -> last transcript write -> doing now -> violations)

(see §3.x sections appended per poll)

### Poll 0 — t0 baseline @ 10:43:50 (before lanes landed anything)
- All 7 transcripts exist (task-0..task-6), each ~4-6 KB, mtime 10:43:33-10:43:36 — all lanes just started.
- No `src/`/`scripts/` write in the W12 window yet. Only `fixes/217m_console_simplification.md` (lane-d skeleton, 10:43:59).

### Poll 1 — @ 10:49:26 (observed)
| lane | transcript last write | observed doing (from transcript tail) | writes in window |
|---|---|---|---|
| lane-a (task-0) | 10:49:04 | ran `errors.test.ts` baseline **26/26 pass**; then PATCHED `src/lib/errors.ts` (10:49:08) | errors.ts 10:49:08; skeleton 217j 10:47:29 |
| lane-b (task-1) | 10:49:09 | recon of existing stubs in `codegen.server.test.ts` (`LEAKED_BLOB_PROSE`, `patchHarness`, `patchReply`) | skeleton 217k (write_file seen) |
| lane-c (task-2) | 10:49:21 | FALSIFY phase: reading `knowledge.test.ts` regions, sweeping stemmer call sites | skeleton 217l 10:47:52 |
| lane-d (task-3) | 10:49:24 | PATCHING `console.tsx` — "three T-17 patches" (enum `replace("_"," ")` region) | console.tsx ×8 patches so far;skeleton 217m 10:43:59 |
| lane-e (task-4) | 10:49:13 | recon: reading `@radix-ui/react-menu` compiled source for cmd-palette work | skeleton 217n 10:47:26 |
| wd-1 (task-5) | 10:48:29 | running the 8 targeted suites (scaffold 37/37, lesson-writers 18/18 green so far) | `fixes/217h_w11_verification_register.md` created 10:44:30 (its own deliverable) |
| wd-2 (task-6, me) | 10:49 | early probes done, report updated | 217i (mine) |

Other window writes: `src/lib/errors.ts` 10:49:08, `src/components/console.tsx` 10:49:27 — both inside their owners' maps. **No language-level ownership violation yet** (details §6).

### Poll 2 — @ 10:53:24 (observed)
- **lane-d FINAL 10:50:03** (405.98s, status=completed): "6 targeted patches landed in console.tsx; **the single end-of-lane `npm run typecheck` was NOT run** (iteration cap hit first)". Pre-edit verification found TASK-05 tiering already in-tree (verified, not assumed).
- **lane-e FINAL 10:52:03** (526.3s): "partial; honest state — I ran out of tool budget mid-lane." Writes: `src/styles.css` 10:51:25, `src/components/cmd-palette.tsx` 10:51:53.
- **wd-1 FINAL 10:52:35** (558.39s): its deliverable `fixes/217h_...md` is "**SKELETON ONLY** — §0 baseline + empty per-lane headers; parent must treat the body as unwritten" (findings live in its truncated transcript summary).
- lane-a 10:52:49: probe AFTER — "all 7 cases now carry specific codes, controls unchanged"; patching errors.test.ts.
- lane-b 10:52:52: patched codegen.server.ts (envelopeReadLogEntry builder, `p6.synthesis.envelope.unreadable`).
- lane-c 10:53:18: still in FALSIFY phase (reading 191_composer_promote.md).
- My G3 mid-probe @ 10:53:41 → specific codes (below).

### Poll 3 — @ 10:56:38 (observed)
- **lane-c FINAL 10:55:50** (753.42s): "Iteration cap reached mid-patch"; C-09 **FALSIFIED-today** (independent match to my probe).
- lane-a: G7 sites edited — `src/lib/auth/popup.server.ts` 10:55:10, `src/routes/__root.tsx` 10:56:09; sweeping + regression suites (`sweep73-fuzz.test.ts`).
- lane-b: wiring `readSink` through call sites (`parseSynthesisEnvelope(res.text, readSink)`) 10:56:06-10:56:33.
- lane-c writes: `knowledge.ts`/`algorithms.ts`/`algorithms.test.ts` all 10:54:31.
- Flat lanes: d (10:50:03), e (10:52:03), wd-1 (10:52:35).

### Poll 4 — @ 10:59:47 (observed)
- **lane-a FINAL 10:58:20** (903.62s): "G3 fixed and proven; G7 decided and documented; **landing log left INCOMPLETE**". (Its final typecheck evidence shows a `TS2688: Cannot find type definition file for 'vite/client'` line adjacent to exit_code 0 — ambiguous; see §6.)
- lane-b still active: `codegen.server.test.ts` patched 10:59:46 (test imports `ENVELOPE_READ_EXCERPT_MAX`, `envelopeReadLogEntry`).
- All other tasks flat since their finals.
- **Landing logs at poll 4: ALL FIVE still skeletons** (217j 2.0 KB @10:47:29 · 217k 1.3 KB @10:50:00 · 217l 1.7 KB @10:47:52 · 217m 1.8 KB @10:43:59 · 217n 3.2 KB @10:47:26).

### W12 src/scripts writes observed (all inside owner maps)
```
10:49:08 src/lib/errors.ts           lane-a   10:49:37 src/components/console.tsx   lane-d
10:51:25 src/styles.css              lane-e   10:51:52 src/lib/errors.ts           lane-a
10:51:53 src/components/cmd-palette.tsx lane-e 10:53:29 src/lib/errors.test.ts     lane-a
10:54:31 src/lib/knowledge.ts        lane-c   10:54:31 src/lib/algorithms.ts        lane-c
10:54:31 src/lib/algorithms.test.ts  lane-c   10:55:10 src/lib/auth/popup.server.ts lane-a
10:56:09 src/routes/__root.tsx       lane-a   10:58:26 src/lib/codegen.server.ts    lane-b
10:59:47 src/lib/codegen.server.test.ts lane-b
```
No `src/`/`scripts/` write outside the five-lane ownership map. The only out-of-map writes are `fixes/217h` (wd-1's own deliverable) and `fixes/216z` (see §6.1).

## 4. Before -> after probes

### 4.1 G3 classifier (lane-a) — probe `w12wd_scratch/probe-g3.mjs`
**EARLY @ 2026-09-24 10:45:50 local.** Result (raw):
```
EACCES         => RT_E_UNKNOWN
ENOSPC         => RT_E_UNKNOWN
ECONNREFUSED   => RT_E_UNKNOWN
ENOTFOUND      => RT_E_UNKNOWN
EADDRINUSE     => RT_E_UNKNOWN
fetch failed   => RT_E_UNKNOWN
fetch+ECONNREF   => RT_E_UNKNOWN
JSON parse err => RT_E_UNKNOWN
UNKNOWN (ctl)  => RT_E_UNKNOWN
ENOENT (ctl)   => RT_E_PROJECT_MISSING
=== classifyError(err, 'RT_E_TESTFALLBACK') on unknown: RT_E_TESTFALLBACK ===
```
**DEFECT PRESENT at wave start: 8/8 target cases collapse to RT_E_UNKNOWN.** Controls fine (ENOENT specific; fallback arg honored).

### 4.2 G6 silent sinks (lane-b) — probe `w12wd_scratch/probe-g6.mjs`
**EARLY @ 2026-09-24 10:47:08.** Both parsers, malformed/empty/non-string/no-envelope input → `null` with **0 console signals**; VALID controls still parse `{oldStr:"a",newStr:"b"}` / `{module:"m.ts",...}`. **DEFECT PRESENT at wave start** — parse failure indistinguishable from "no output". Existing seams visible in exports: `patchDeltaLogEntry`, `patchRefusalLogEntry`.
(Note: first probe attempt v1 printed nothing — my own console override buffered my output; fixed in v2, noted for honesty.)

### 4.3 C-09 live cache (lane-c) — probe `w12wd_scratch/probe-c09.mjs`
**EARLY @ 2026-09-24 10:45:51.** `KnowledgeStore.entries()` is **ALREADY a defensive copy** at wave start:
```
empty-store: entries() returns same array ref on two calls? false
empty-store: after push into returned array -> next entries().length = 0 (0 = defensive copy; 1 = LIVE cache leak; a===b: false)
savePattern REFUSED/THREW: ... refusing to save a malformed entry ... (probe's minimal entry was invalid; expected)
```
Same code in git HEAD `aa12c6c`: `return [...this.cache];` (knowledge.ts:365). **NOT REPRODUCIBLE at wave start** — a "fix" to this would be a no-op/regression risk. (Nuance: row objects are documented as shared by identity; late probe will retest with a valid entry.)

### 4.4 UI capability counts (lane-d) — `w12wd_scratch/ui_counts.sh`
**BASELINE @ 2026-09-24 10:45:51:** `<Tabs.Content value=` JSX blocks: **10** (12 grep line-matches — 2 are doc comments at :128, :2724) · RunTab union: **10** values (`:113`) · `SHORTCUTS`: **12** entries (`:1253-1270`) · `setTab(` call sites: **2** (`:1699`, `:2721`) · `onClick=`: 60 · `aria-label`: 47 · console.tsx = 6112 lines. **These numbers must not drop.**
(Baseline was taken BEFORE lane-d's first write — console.tsx mtime was 10:25:03 until lane-d's 10:49 edits; confirmed by the find timeline.)

**AFTER @ 2026-09-24 10:57:06** (console.tsx frozen since 10:49:37, lane-d final):
| metric | before | after | verdict |
|---|---|---|---|
| `<Tabs.Content` JSX panes | 10 | 10 (:2822-3021) | ✓ no drop |
| `RunTab` values | 10 (:113) | 10 (:115) | ✓ |
| `SHORTCUTS` entries | 12 | 12 | ✓ |
| `setTab(` call sites | 2 | 2 (:1734, :2785) | ✓ equal |
| `onClick=` occurrences | 60 | **55** | ⚠️ explained below |
| `onSelect=` occurrences | 3 | **9** | +6, consistent with menu consolidation |
| `aria-label` | 47 | 47 | ✓ |
| console.tsx lines | 6112 | 6185 | +73 |

**onClick −5 investigation (capability check):** the 5 removed inline `onClick=` lines are exactly the export/copy affordances (`copyPacket`, `copyHandoff`, `downloadPacket`, `downloadJson`, `copyProjectJson`). Each handler still exists (:1972-2020) and is still wired in the consolidated DropdownMenu (`onSelect=` at :2513, :2519, :2529, :2535, :2541) and in the command list (:2127-2163); an in-file comment (:1496-1497) states "the SAME handler the old button called … presentation only". **Verdict: presentation-only consolidation (UI-10), no capability loss — but lane-d's mandatory capability checklist was never written to 217m, so this is MY verification, not lane-d's evidence.**

## 4.5 Late probe results (lanes frozen)
- **G3 LATE @ 11:00:11** (errors.ts frozen 10:51:52, lane-a final): identical to mid — EACCES→`RT_E_PERMISSION_DENIED`, ENOSPC→`RT_E_DISK_FULL`, ECONNREFUSED/ENOTFOUND/fetch→`RT_E_NETWORK_UNREACHABLE`, EADDRINUSE→`RT_E_PORT_IN_USE`, JSON-parse→`RT_E_VALIDATION`; UNKNOWN control→`RT_E_UNKNOWN`; ENOENT control→`RT_E_PROJECT_MISSING`; custom fallback honored. **G3 before→after COMPLETE.**
- **C-09 v2 LATE @ 11:00:11** (knowledge.ts frozen 10:54:31): with a real saved row — `entries()===entries()` false; caller emptying/pushing into the returned array leaves `count`/fresh reads intact (row survives, no INJECTED) → **defensive copy confirmed with real rows**. Nuance: mutating a returned *row object* DOES affect the cache (rows shared by identity — documented in the method's own doc comment as outside the store's contract). Not a defect; noted.
- **G6 LATE:** pending lane-b final (still active at poll 4).

## 5. Landing-log claim verification

All five skeleton logs exist at poll 1 and are real skeletons (headers + status: in progress + section stubs):
`217j` (2.0 KB, lane-a), `217k` (1.3 KB, lane-b), `217l` (1.7 KB, lane-c), `217m` (1.8 KB, lane-d), `217n` (3.2 KB, lane-e).
Claim spot-checks are recorded here as the bodies fill (see §5.x per final poll).

## 6. Findings / violations

1. **`fixes/216z_w10_landing_record.md` modified during the wave @ 10:45:19** (was 10:27:38 at my 10:44:12 baseline; grew 203→207 lines). No W12 task transcript shows a write to it — the five lanes' `patch`/`write_file` ledger contains no 216z entry, and wd-1's register (217h) does not carry the added text. The added text ("STruck (FALSIFIED 2026-09-24 by W11-L2)", "blocked until W12-LC releases `knowledge.ts`") is W10/W11 close-out narrative plus a W12-aware repair plan — consistent with a **parent-side edit to its own record file**. It is outside the five-lane map either way; listed here with mtime, attribution NOT verifiable from transcripts ⇒ UNVERIFIED attribution, parent should confirm.
2. **Pre-W12 already-landed work collides with lane-d's headline premise**: `console.tsx` already carries TASK-05 tiering (`RUN_TABS` with `tier: "primary"|"advanced"` at :134-144, tier-derived aria-label `tabListLabel()` :149-153, "More panels" disclosure :2731-2750) — documented in `fixes/217g_...md` (:169-171) as landed by 216h and *deliberately not touched* by W11-L6. Lane-d's brief calls TASK-05 its headline ("ten peer tabs at equal weight") — **that premise is stale**. Watch lane-d: it must verify/build-on (its skeleton §2 header says "families wrapper") and must not claim the tiering as new work.
3. **Tree was not all-green at dispatch**: lane-c reports `honesty-guards.test.ts` RED today (4/5, `probeTagsFromSignature` defined :911, zero call sites). W11's gates claim vs today's bytes — subject to my independent reproduction (planned).

## 7. What the parent should do next

(to be filled)

---

## PARENT NOTE (W12 close, 2026-09-24)

**This log stopped as a skeleton — the lane ran out of tool budget before filling it.** The
parent has NOT fabricated a body. This lane's real, first-hand record is:
- its own closing summary: `C:/Users/mnril/AppData/Local/hermes/cache/delegation/subagent-summary-6-20260924_110209_463290.txt`
- its full tool/assistant transcript (every command + output): `C:/Users/mnril/AppData/Local/hermes/cache/delegation/live/<run>/task-*.log`
- the wave's consolidated close record: `fixes/218_w12_close_record.md` (§1–§2 cover this lane's
  outcome, the parent's verification of it, and what was carried forward)

State: the live register was patched 5× with real poll timestamps (10:43:50 → 10:59:47), the ownership map, the baseline, and the before→after probe tables; its last §5/§6/§7 items were cut by the iteration cap (the actionable remainder is in the summary). Its one unresolved attribution (the 10:45:19 `fixes/216z` write) is **confirmed by the parent as a parent-side edit**.
