# fixes/242 · WD-1 — watcher report on the four W15 lanes (delegation `deleg_d48ae8ef`)

**Run:** 2026-09-24 13:13–13:30 (-05:00) by W15-WD-1 (read-only subagent; wrote ONLY this file + `C:/Users/mnril/w15wd1_scratch/`; no git mutations).
**Task ref:** `wave_plans/W15/watchdogs.md` §WD-1. **Tree:** uncommitted on `7582771` (`git rev-parse HEAD`), 71 dirty entries at baseline.
**Lane map:** L1→task-0, L2→task-1, L3→task-2, L4→task-3 of `deleg_d48ae8ef` (started 13:13:13).

---

## BOTTOM LINE (final)

```text
lanes polled: 6 (13:13:45 → 13:26:35) · all 4 completed: L2 13:18:28, L3 13:21:15, L4 13:22:04, L1 13:25:52
incidents: 0 × P1 · 6 observations (O-1…O-6, none blocking; all disclosed, none hidden)
claims verified against bytes/commands: 20 OK · 0 WRONG · 2 disclosed-unverifiable (both self-labeled)
re-runs by me: 2 invocations — Run1: src/lib/headless.test.ts → # tests 92 · pass 92 · fail 0 (was 91 ✓)
                        Run2: scripts/browser-guard.test.mjs + src/lib/errors.test.ts → 4/4 + 37/37 (combined 41 pass)
rebuild flags: 0 · weak-test flags: 0 (both new tests RED-proven against the pre-fix code) · silent-catch flags: 0
```

> **VERDICT: all four W15 landings are safe to keep. Nothing is misreporting.** Zero out-of-box edits by the four lanes; zero lane corpus edits; every lane's numeric claims reproduced against the bytes. The only non-lane attention items: L3's log carried two `[fill]` placeholders at its subagent's close (parent filled the substantive one at 13:26:26; one stale cosmetic `[fill]` remains at `fixes/241_lane3_browser_residuals.md:38`), and **W16 started at ~13:22 and is already editing `console.tsx` (13:25:52) and `headless.ts` (13:27:04)** — those mtimes are W16's, not W15's (see §6).

---

## 0 · Baseline & method

Snapshot at 13:14 (`w15wd1_scratch/baseline_hashes.txt`, `baseline_gitstatus.txt`) — md5 + mtime + size for: `headless.test.ts` `5685f7e2…`/12:49:55 · `browser-guard.test.mjs` MISSING · `browser-guard.mjs` `38dbd378…` · `errors.ts` `c227f298…` · `errors.test.ts` `b99586665…` · `run-eval.mjs` `18b4423c…` · `console.tsx` `2754b130…` · `styles.css` `85d6d01d…` · `browser-smoke.mjs` `c787e144…`; plus all 12 frozen-corpus files.

Constraints respected: read-only except this report + scratch; no git mutations; **2** targeted test invocations total (`--test-concurrency=2`); no `npm run typecheck` / `npm test` / `npm run build`; `sleep`-based polling of the live transcripts.

## 1 · Poll log (real mtimes — `$HOME/AppData/Local/hermes/cache/delegation/live/deleg_d48ae8ef/task-N.log`)

| # | time | task-0 (L1) | task-1 (L2) | task-2 (L3) | task-3 (L4) | notes |
|---|---|---|---|---|---|---|
| 0 | 13:13:45 | 6904 B | 6411 B | 6119 B | 5719 B | all 4 running; manifest 13:13:13 |
| 1 | 13:15:43 | 12671 B / 52 L | 10993 B / 46 L | 17249 B / 81 L | 18730 B / 78 L | L1 mid-patch; L2 certified claim; L3 netstat+wmic; L4 anchoring rows |
| 2 | 13:17:40 | 64 L | 71 L | 126 L | 106 L | L2 errors.ts+errors.test.ts patched 13:15:49 |
| 3 | 13:19:58 | 108 L | 87 L | 188 L | 130 L | L2 **completed** 13:18:28; L1 guard 4/4 + RED-proof |
| 4 | 13:22:27 | 127 L | 87 L | 209 L | 159 L | L3 **completed** 13:21:15 (hit cap); L4 **completed** 13:22:04 |
| 5 | 13:26:35 | 127 L | 87 L | 209 L | 159 L | L1 **completed** 13:25:52 (758.6 s); all 4 logs flush together 13:25:52.74 |

## 2 · Ownership-box compliance (P1 = any out-of-box file)

Final `git status` diff vs baseline (13:14 → 13:28): every W15-lane delta is inside a box. md5 evidence in `w15wd1_scratch/final_artifacts.txt`.

| Lane | Box (per `wave_plans/W15/lanes.md`) | Files actually touched | md5 @ final | Verdict |
|---|---|---|---|---|
| L1 | `headless.test.ts` (repair region), `scripts/browser-guard.test.mjs` (new) | `src/lib/headless.test.ts` (M, +96/−0 vs HEAD), `scripts/browser-guard.test.mjs` (?? new, 4830 B) | `57fb08f5…` / `8d6cb86d…` | **IN BOX** |
| L2 | `errors.ts`, `errors.test.ts` (+read-only `run-eval.mjs`) | `src/lib/errors.ts` (+19 comments), `src/lib/errors.test.ts` (+42) | `76a72e68…` / `2af9f363…` | **IN BOX** |
| L3 | its log; `browser-smoke.mjs` arg-handling only; `styles.css`/`console.tsx` ONLY for an observed defect | `fixes/241_lane3_browser_residuals.md` only. `browser-smoke.mjs` `c787e144…` = baseline (untouched); `styles.css` `85d6d01d…` = baseline; `console.tsx` untouched **during W15** (baseline md5 held through 13:25; changed 13:25:52.93 by **W16-L3**, see §6) | — | **IN BOX** |
| L4 | `research/multiagent/241_weak_verification_strengthenings.md` (new); ZERO corpus edits | that one new file (44046 B, 437 L). All 12 frozen-corpus md5s unchanged; no other path added/modified by L4 | — | **IN BOX** |

No lane wrote to any path outside its box → **0 P1 incidents**. Corroboration: the parent's own W16 brief states the same file set ("their edits touch ONLY: headless.test.ts (L1), errors.ts+errors.test.ts (L2), browser logs (L3), a new research file (L4)").

## 3 · Incident register

**P1: none.**

- **O-1 (L3, process — disclosed):** L3 hit its iteration cap at 13:21:15 with its log at "IN PROGRESS": R6's second-look result and the §1 end-of-lane netstat re-check were `[fill]` placeholders (`fixes/241_lane3_browser_residuals.md:38` and `:101` at close). Its own final summary disclosed this ("two items still require a follow-up write"). **The parent filled R6 at 13:26:26** (log now 10840 B; labeled "filled by the parent … the lane hit its iteration cap") and recorded the R1 re-check at `:111`. One stale `[fill]` remains at `:38` (superseded by `:111` — cosmetic only).
- **O-2 (corpus, allowed-by-design):** `fixes/236_c1_wb1_deadlock_fix.md` (13:15:23, 3686→5692 B) and `fixes/238_wd_alpha_report.md` (13:14:31, 6987→14403 B) were appended **during** the watch — by the **parent**, not a lane: 238's new section is headed "appended by the parent from WD-α's closing summary" (`238:89`); 236's is a "Post-audit (WD-β) — verdict + corrections applied" in the parent's voice ("not located by the parent"). No W15/WD transcript contains a write to those paths; WD-2's manifests independently record the growth (`w15wd2_backup/manifest_start.txt` → `manifest_mid.txt`). Corpus freeze is parent-only → not a violation.
- **O-3 (hygiene, resolved):** L3's dev server (`npm run dev -- --port 8091`, vite PID 5896) was still LISTENING at 13:25 (stray). **Killed by the parent at 13:26** (`taskkill /F`, per L3 log `:110`); my final `netstat` at 13:28 shows 8091 free. Foreign `contractorapp` PID 14140 on 8080 untouched (pre-existing, out of scope).
- **O-4 (pre-existing quirk, declared):** `repairTreeDir` on green-tree-run + honestly-red gate returns `minted:false` while `project.lastTest` carries a fresh `"tested"` stamp — the known `fixes/239` F1 under-report; L1 observed it in its probe, did **not** assert on it, and declared it out-of-box (`241_lane1_…:103`). Not introduced by W15.
- **O-5 (environment artifact, declared):** node run via the background/redirected harness dies with `stdin is not a tty`/exit 1 and zero TAP (hit by L1 once; re-run foreground = authoritative). Same class as WD-β's anomaly. Declared in L1's log, not counted as a result.
- **O-6 (wave overlap, informational):** W16 lanes started ~13:22 (`wave_plans/W16/lanes-and-observer.md` mtime 13:22) **before** W15's subagents closed (L1 13:25:52). All later src mtimes belong to W16 (see §6). No W16 lane reported here.

## 4 · Claims verified against bytes (20 OK / 0 wrong)

| # | Lane | Claim | Evidence I read/ran | Result |
|---|---|---|---|---|
| 1 | L1 | repair seam had **zero** coverage pre-change | `git show HEAD:src/lib/headless.test.ts \| grep -c repairTreeDir` → 0 (HEAD file predates the fix; grep of HEAD is the closest byte-source) | **OK** |
| 2 | L1 | count rose 91→92 | lanes.md/watchdogs.md boundary 91; L4's grep 91 @13:14; **my Run1: `1..25 / # tests 92 / # pass 92 / # fail 0`, exit 0** (`w15wd1_scratch/rerun_headless.txt`), new test rides as `ok 11 - C-1 repair seam…` | **OK** |
| 3 | L1 | no other assertion touched | `git diff --stat`: `src/lib/headless.test.ts | 96 +` and **0 deletions**; hunks = import (+1, L1) + W14's 36-line journey test (pre-existing, in the 91) + L1's 59-line describe; no `-` lines anywhere (`git diff -U0`) | **OK** |
| 4 | L1 | new test asserts mint **and** gate-reflection | read `headless.test.ts:615-673`: `assert.equal(lt?.label,"tested")`, `evidenceHash>0`, `res.gate.passed===false`, `gate.unmet.length>0`, and `!unmet.some(…'lastTest.label === "tested"')` | **OK** |
| 5 | L1 | RED-first proof (test fails on pre-C-1 code) | `evidence/red_run.txt`: `not ok 1 … + undefined - 'tested'` (`ERR_ASSERTION`); scratch copy built from `git show HEAD:src/lib/headless.ts`; test-file md5 `57fb08f5…` = repo file | **OK** |
| 6 | L1 | guard pin 4/4 green | **my Run2: `ok 1..4`**, exit 0 (`rerun_guard_errors.txt`); L1 also ran it twice | **OK** |
| 7 | L1 | guard pin is sensitive (RED pre-fix) | `w15l1_scratch/guard_red/browser-guard.mjs` **byte-identical to `git show HEAD:scripts/browser-guard.mjs`**; `guard_red_run.txt` → accept case `ok:false`/1 fail pre-fix | **OK** |
| 8 | L2 | `RT_EVAL_STALL` @ `run-eval.mjs:946`, `RT_EVAL_REFUSED` @ `:943-944` | my `grep -n RT_EVAL scripts/run-eval.mjs` → exactly those lines | **OK** |
| 9 | L2 | neither in the registry; **0 other** unregistered `RT_E_`-shaped codes in `scripts/` | my grep: `errors.ts` contains the labels only in comments (:60-75); `ERROR_CODES` 27 quoted entries / `ERROR_CODE_DOC` 27 entries — unchanged, no `"RT_EVAL…"` registrations | **OK** |
| 10 | L2 | follow-the-convention / no invented codes | registry shape enforced by pre-existing pin `errors.test.ts:412-414` `assert.match(code, /^RT_E_[A-Z_]+$/)` — `RT_EVAL*` fails it → registering as-is would break the file's own contract; the **strike** is the convention-conformant call | **OK** |
| 11 | L2 | errors suite 34→37 green | **my Run2 (errors half): 37 pass / 0 fail** (combined invocation `# tests 41` = guard 4 + errors 37), exit 0; new describe `registry boundary — RT_EVAL_* …` at `errors.test.ts:454-485` | **OK** |
| 12 | L2 | purely additive | `git diff --stat`: `errors.ts +19` (comments), `errors.test.ts +42` (new tests), **0 deletions** both | **OK** |
| 13 | L3 | 8080 still held by foreign `contractorapp` (PID 14140, created 09:43:45) | log §1 wmic output + **my own netstat at 13:25** (`LISTENING 14140`) | **OK** |
| 14 | L3 | `public/og.jpg` EXISTS (18,347 B) | my `ls -la /c/workspace/...` and repo `public/` listing: 18347 B; `.vercel/output/static/og.jpg` also present | **OK** |
| 15 | L3 | R3 root cause = default root `/workspace`, not a repo defect | my greps: `brand-check.mjs:68` default `workspaceRoot = "/workspace"`; `browser-smoke.mjs:143` calls `computeBrandWarnings({hasCanvas})` with no root; repo's own `node scripts/brand-check.mjs` → `warnings:0` (lane artifact) | **OK** |
| 16 | L3 | smoke artifacts real, no vision claim | `w15.json`: both viewports 200, `consoleErrors: []`, `pageErrors: []`, title correct, written 13:20:35; `w15.png`/`w15-mobile.png` written 13:20:32/35. (Note: **byte-identical md5 to the W14 PNGs** — consistent with zero app-code change during W15; not a defect.) | **OK** |
| 17 | L3 | stayed out of `console.tsx`/`styles.css`/`browser-smoke.mjs` (no defect observed) | md5s = baseline all three (§2); the `[fill]` gap and stray server disclosed (O-1/O-3) | **OK** |
| 18 | L4 | 13/13 rows, 0 placeholders, summary table; ZERO corpus edits | `grep -c '^## <row>'` = 13; no `[fill`/`TODO`/angle-bracket placeholders; `git status` shows only the new file; all 12 corpus md5s unchanged | **OK** |
| 19 | L4 | cited anchors real | `headless.ts:1405` (`redTree:"banner"` advice) ✓, `:1343` `redTreeBanner(` ✓, `scripts/rapidtool-cli-lesson.test.mjs` exists ✓, C-2(a) command target `isTerminalDrainOutcome(res.outcome)` @ `run-eval.mjs:707` ✓ | **OK** |
| 20 | L1 | `headless.ts` untouched by L1 (md5 `36d0a670…`) | md5 changed only at **13:27:04** by W16-L2 (diff header `TASK-01 (W16-L2)`); WD-2's mid-watch log recorded `12:43:23` mtime for headless.ts through the W15 window | **OK (time-bounded)** |

**Disclosed-unverifiable (2, both self-labeled, not misreports):** (a) L3's focus-ring pixel — its own log marks it "PARTIAL/NOT observed → STAYS REGISTERED"; (b) L4's forward-looking thresholds for rows that have not landed yet (e.g. `test("OV-35` ≥3, `nextAction` ≥8 — today 0 each, by design of a *draft* strengthening for pending rows; the file says "definition step required first").

**Run budget used: 2 invocations** (Run1: `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts`; Run2: same flags for `scripts/browser-guard.test.mjs src/lib/errors.test.ts`). L3/L4 have no runnable suites in their boxes (L3 = docs only; L4 = draft commands) — verified via artifacts/bytes instead, as stated.

## 5 · No-rebuild + bad-code checks → 0 flags

- **Weak tests (would pass reverted):** none. Both new test artifacts are RED-proven against the *real* pre-fix bytes (L1's `git show HEAD:` scratch copies + evidence files, §4 #5/#7). L2's pins fail the moment anyone registers the labels (`!includes`, `doesNotMatch`, `classifyError → RT_E_UNKNOWN`).
- **Silent catches / stubs:** `grep` over the full lane diffs for `catch(`, `.only(`, `.skip(`, `TODO`, `FIXME`, `eslint-disable`, `@ts-ignore`, `ts-expect-error` → **NONE**. Guard test's `{ skip: SKIP }` is platform-conditional and **false** on win32 (`skipped 0` in my Run2).
- **Unbacked claims:** none found; L1/L2/L3/L4 logs each carry the producing command; the two gaps found (O-1, O-4) are self-declared.
- **Scope creep:** none — every W15 file delta is inside a box (§2); no capability re-implemented (all changes are tests/comments/docs; product files `headless.ts`/`run-eval.mjs`/`console.tsx` untouched by W15).

## 6 · Attribution facts the parent needs (W16 overlap)

- `src/components/console.tsx` changed at **13:25:52.93** (md5 `92cb3712…`, 259092 B) — **0.2 s after** the W15 logs' final flush, and `wave_plans/W16/lanes-and-observer.md` §LANE 3 owns exactly that file ("console honesty pair") → W16-L3, not a W15 incident.
- `src/lib/headless.ts` changed at **13:27:04** (+145/−2; diff header "TASK-01 (W16-L2)") → W16-L2. `scripts/next-action-arm-parity.test.mjs` is also W16's.
- Because W16 is mid-flight, the four-gate boundary must be re-run after W16 finishes before folding/committing; my verified numbers above describe the W15 close state only.
- `fixes/244_*` + `fixes/245_observer_report.md` are W16 artifacts — outside this report's scope.

## 7 · Files & scratch

- **Created:** this file (`fixes/242_wd1_w15_report.md`).
- **Scratch:** `C:/Users/mnril/w15wd1_scratch/` — `baseline_hashes.txt`, `baseline_gitstatus.txt`, `poll2_gitstatus.txt`, `final_gitstatus.txt`, `final_artifacts.txt`, `rerun_headless.txt`, `rerun_guard_errors.txt`, `guard_HEAD.mjs`, `baseline_time.txt`.
- No src/scripts/corpus/lane-log edits; no git mutations.
