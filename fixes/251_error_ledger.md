# fixes/251 — W18 · WD-β · THE ERROR LEDGER (single append-only register, W13–W18)

**OWNER:** WD-β (error-ledger keeper) · **built:** 2026-09-24 14:04 → 14:1x CDT · **STATUS: COMPLETE** (skeleton landed first per lane brief; rows appended in one build pass; `#` never reused thereafter).
**Scope:** read-only everywhere else; this file + `C:/Users/mnril/w18wd_b_scratch/` are the only writes. No git mutations; ≤2 owned test runs (used: headless suite + lint, below).
**Sources:** `fixes/236..249` (W13–W18 logs), the watchdog reports (`fixes/238,239,242,243,245,248,250`), `C:/Users/mnril/w15_parent_evidence.txt`, `_w16_tc.txt`/`_w16_lint.txt`, and the two diagnostic runs this watchdog owns as the wave's living evidence (E1/E2).
**Host artifact rule:** node under the Hermes BACKGROUND harness dies `stdin is not a tty`, exit 1, zero output — never a code failure (row #1–#3). Everything here ran FOREGROUND.

---

## BOTTOM LINE (final)

```text
total errors logged: 51 · open: 23 · fixed: 22 · env-artifact: 6 · batch-fixable-now: 19
```
- **open = OPEN + MID-EDIT rows; fixed = FIXED-APPLIED + FIXED-STRIKED rows.** Env-artifact rows were never code failures and are excluded from both.
- **THE ONE THING BLOCKING THE WAVE:** row **#38** — `src/lib/scaffold.ts:741` (W17-L4's in-flight G5 edit; double-escaped backticks → module fails type-strip parse). It is the **source of finding #1 (lint ≠ 0)**, of the 9 headless failures (#39–47), of `mock.test.ts` 11/12 (#48), and of the parent's blocked 14:00 boundary attempt (`_w16_tc.txt` typecheck cascade + `_w16_lint.txt`). One line to fix; clears 11 rows + both gates.
- **BATCH-FIX ORDER (severity first):**
  1. **REAL REGRESSIONS** — fix `scaffold.ts:741` (parent fallback; W17-L4 appears capped/stale) → re-run `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` (expect **92/92**), `npm run lint` (expect **0**), then the collateral suites (`mock.test.ts`, `scaffold.test.ts`, `sweep73-fuzz.test.ts`, `emitted-honesty.test.ts`). Then finish/close W17-L4's G5+DF-04+TA-21 or strike the row. Then re-attempt the W16+W17 boundary (`typecheck`/full suite/build) and commit.
  2. **PRECISION ITEMS** — WD-2's F1 (#15, `minted: green.minted` at `headless.ts:2592`/`:2712` + a pin), stale comments F3/F4 (#16–17), stale doc F5 (#18), `fixes/236:51` typo (#14), citation re-pin (#31), stale `[fill]` (#24), `--test-name-pattern` codification (#50).
  3. **COSMETICS / PROCESS** — watchdog report fill (#49), skill-cap note (#28), I-1 strict resolution if desired (#27). Capability follow-ons, NOT batch items: chat/crew token seams (#37), W18-L5 `types.ts` provenance fold (#51).
- **Nothing on record was dropped:** every watchdog finding (WD-α/β W14, WD-1/2 W15, observer W16, WD W17), every precision strike, both gates, W17's landing status, and the three env-artifact false failures are rows below with status + owner + batch-fix note.

## Living evidence — the two diagnostic runs (WD-β, W18)

| # | exact command | ts (CDT) | result | capture |
|---|---|---|---|---|
| E1 | `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` (FOREGROUND) | 14:05:17→14:06:55 | **exit 1 · `# tests 92 · # suites 28 · # pass 83 · # fail 9 · # skipped 0 · duration 98144ms`** — failing suites: 19 (E-25, 2 subtests), 21 (A7, 4), 22 (T-07, 3) = the 9 rows #39–47 | `C:/Users/mnril/w18wd_b_scratch/headless_run.txt` (36,209 B) |
| E2 | `npm run lint` | 14:07:44 | **exit 1** — `src/lib/scaffold.ts 741:26 error Parsing error: ',' expected` (1 problem) → **finding #1** = row #38 | `C:/Users/mnril/w18wd_b_scratch/lint_run.txt` |
| P1 | probe (non-suite): dynamic `import(.../src/lib/scaffold.ts)` under strip-types | 14:09 | `LOAD_FAIL ERR_INVALID_TYPESCRIPT_SYNTAX Expected ',', got 'ident'` — the module itself fails to parse | `probe_scaffold_import.mjs` + output in this dir |

---

## THE REGISTER (append-only; `#` never reused)

Status vocabulary: `OPEN` · `FIXED-STRIKED` · `FIXED-APPLIED` · `MID-EDIT` · `ENV-ARTIFACT`.

| # | ts | wave/lane | what failed (exact test/command) | attribution (file:line or EXT-FAIL) | status | fix owner | batch-fix note |
|---|---|---|---|---|---|---|---|
| 1 | W14 13:03 | WD-β (env) | headless.test.ts run under Hermes BG harness → `stdin is not a tty`, exit 1, zero TAP output (false failure) | ENV-ARTIFACT (0 code executed; `C:/Users/mnril/w15_parent_evidence.txt`) | ENV-ARTIFACT | — | none — run FOREGROUND; parent fg re-run 91/91 |
| 2 | W14 13:19 | 237/L3 (env) | `:8091` smoke died (`SMOKE_EXIT=1`, no w15.png) (false failure) | ENV-ARTIFACT (BG/detached harness) | ENV-ARTIFACT | — | none — fg w14 smoke 13:05 stands (also blocked by #4) |
| 3 | W15 13:20 | 241/L1 (env) | headless.test.ts run → `FULL_EXIT=1`, zero output (false failure) | ENV-ARTIFACT | ENV-ARTIFACT | — | none — parent fg re-run 92/92 |
| 4 | W14 13:14–13:28 | 237/L3 | `npm run dev -- --port 8080` → exit 1 (strictPort) — port held by foreign `contractorapp` (PID 14140); literal-8080 smoke blocked | ENV-ARTIFACT (host, foreign process; netstat+wmic verified by WD-α) | ENV-ARTIFACT | — | none — `:8090/:8091` fallbacks are the honest substitute |
| 5 | W17 ~13:4x | 247/L3 | patch-tool auto-lint noise `TS6053 ... not found` on every edit (space-in-path runner artifact) | ENV-ARTIFACT (tooling, non-repo) | ENV-ARTIFACT | — | none — files load/test green |
| 6 | W17 ~13:5x | 247/L1 | bash hardline blocklist fired ×2 on long inline commands | ENV-ARTIFACT (tooling; auto-saved + recovery path executed both) | ENV-ARTIFACT | — | none — zero effect on work |
| 7 | W13→13:05 | 236/C-1 | **WB-1 deadlock:** P6 gate recorded before the mint it gates on → journey could never converge (M3/M4 certain zeros; 2026-09-10 keyed ledger: P6 complete, gate null, 80 `dod.blocked`) | `headless.ts:1917`→`:1958` pre-fix (both seams, post-fix `:1928`/`:2515`); guards `codegen.server.ts:3210/3215` | FIXED-APPLIED | parent (W0 lane 0) | done — RED-first 90/91 → 91/91; WD-β CONFIRMED; folded into `4328d20` |
| 8 | W14 13:0x | 237/L1 (C-2) | drain: 80 `dod.blocked` rounds + silent `stalled` (no coded terminal for a hard DoD stop) | `scripts/run-eval.mjs:656/707/708+`; RED `not ok 16/17` | FIXED-APPLIED | W14-L1 | done — 80→1 rounds, `position stalled→dod`, `code→RT_E_GATE_PENDING`; 17/17 → 25/25 with W16-L1's additions; folded |
| 9 | W16 14:00 | 244/L2 → parent | **lint ≠ 0 (W16 lint defect):** `scripts/README-cli.test.mjs:211:9` + `:212:26` `no-regex-spaces` ×2 | `scripts/README-cli.test.mjs:211/:212` (pre-existing from `4328d20`) | FIXED-APPLIED | parent | done — fix in tree (`^ {2}`/`^ {4}`, +2/−2); **verified by E2** (no README-cli error remains) |
| 10 | W14 | 237/L2 | transient patch error on README.md (duplicated line) | self-corrected same minute | FIXED-APPLIED | W14-L2 | none — final bytes checked |
| 11 | W17 ~13:50 | 247/L1 | fold script bug: regex match index not stored → every block sliced to EOF; pre-write assertion threw | `w17l1_scratch/fold.mjs` | FIXED-APPLIED | W17-L1 | done — corpus never touched (sha re-verified); rerun green (90 insertions/0 deletions) |
| 12 | W14 post-audit | 236 | 236 strike-1: cited range `:1968-1984` 2 lines short (return at `:1986`) | `fixes/236` §Post-audit | FIXED-APPLIED | parent | struck in place |
| 13 | W14 post-audit | 236 | 236 strike-2: "only the ORDER changed" overstated — skip-log count delta unstated (0→1 red gate / 1→2 passed) | `fixes/236` §Post-audit (log-only, benign) | FIXED-APPLIED | parent | struck in place |
| 14 | W14 | 236 | 236 strike-3: typo `verifyAndServever` → should be `verifyAndFixServer` | `fixes/236:51` — **verified still present 14:1x** | OPEN | parent | cosmetic — 1-word doc fix in batch pass |
| 15 | W15 13:19 | 243/WD-2 F1 (= WD-1 O-4) | repair FAILED returns hardcode `minted: false` while the project can carry a fresh `lastTest:"tested"`; CLI `:1085` surfaces the under-report | `headless.ts:2592`/`:2712`; truth = `green.minted` (`:2568`/`:2688`) | OPEN | parent | P3 output honesty — change to `minted: green.minted` + add a pin (91/91 did not catch it) |
| 16 | W15 13:19 | 243/WD-2 F3 | stale comment: "record the P6 DoD gate ... FIRST / **NEVER** mint `lastTest:"tested"`" sits directly above code that now does the opposite | `headless.ts:1908-1912` | OPEN | parent | P3 comment sweep |
| 17 | W15 13:19 | 243/WD-2 F4 | stale comment: "tree-green + red gate is FAILED, never ok:true / minted tested" — the "minted tested" half is false post-C-1 | `headless.ts:2550-2552` | OPEN | parent | P3 comment sweep |
| 18 | W15 13:19 | 243/WD-2 F5 | stale function doc: implies the mint belongs to the gate-passed→CONVERGED branch only | `headless.ts:1812-1816` | OPEN | parent | P4 doc sweep |
| 19 | W15 13:15 | 241/L2 | `RT_EVAL_STALL` (`run-eval.mjs:946`) / `RT_EVAL_REFUSED` (`:943-944`) look like codes but are unregistered harness labels | `errors.ts:59-76` boundary block; `errors.test.ts:445-485` (3 pins) | FIXED-STRIKED | W15-L2 | done — STRUCK as registry items, documented + pinned; W16-L1's triage (approve-throw→`RT_E_GATE_PENDING`, round-guard→`RT_E_BUDGET_EXHAUSTED`) respects the boundary; labels survive only as last-resort `stopCode` |
| 20 | W14 13:03 | 239/WD-β F6 = WD-α P1-α-01 | L2 out-of-box edit `scripts/rapidtool-cli.mjs` (+31/−3) — unlogged + unverified at first read | box was docs-only; playbook `230:281-282/494/501` + `220:113` designate the file; `lanes.md` corrected 13:15:06 | FIXED-APPLIED | parent | RATIFIED on evidence (README-cli 11/11, `node --check` OK); folded into `4328d20` |
| 21 | W14 13:09 | 238/WD-α P1-α-02 | L2 out-of-box edit `scripts/README-cli.test.mjs` (+53/0) | same class as #20 | FIXED-APPLIED | parent | RATIFIED; evidence closed |
| 22 | W14 13:07 | 238/WD-α P1-α-03 | `220_overhaul_plan.md` md5 changed mid-watch | `[PARENT · 2026-09-24] CORRECTED` annotation — parent's own edit | FIXED-APPLIED | parent | resolved non-incident (grow-only) |
| 23 | W14 | 238/239 | L2 evidence gap: landing log stayed a 34-line skeleton; "unlogged, unverified" complaint | `fixes/237_lane2_doc_truth.md` | FIXED-APPLIED | parent | log parent-completed; §Gaps-3 now discloses the out-of-box edit (WD-2 verified) |
| 24 | W15 13:26 | 242/WD-1 O-1 | stale `[fill]` placeholder (netstat re-check) — parent filled R6 but one marker remains | `fixes/241_lane3_browser_residuals.md:38` — **verified still present 14:1x** | OPEN | parent | cosmetic — fill or strike the stale marker |
| 25 | W15 13:26 | 242/WD-1 O-3 | stray vite dev server listening on `:8091` (PID 5896) at wave close | killed 13:26 (`taskkill /F`); netstat free 13:28 | FIXED-APPLIED | parent | none |
| 26 | W16 13:31 | 245/C-7 | L1's `run-eval.test.mjs` at 24/25 mid-iteration — its own brand-new "unapprovable gate → coded stall" test RED | `run-eval.test.mjs` (RED-first iteration in progress) | FIXED-APPLIED | W16-L1 | closed — final 25/25 (17 + 8 new); WD-2 certified the drain leg |
| 27 | W16 13:31 | 245/I-1 | L3 added 19 lines at `console.tsx:@@ -179,0 +180` — outside the two literally-named regions (DF-26 constants + helper) | additive, 0 deletions, no behaviour change; caused `:382→:401` drift | FIXED-APPLIED | parent | accepted after review; no action (relocate only if strict) |
| 28 | W16 13:28 | 245/I-2 | `skill_manage(rapidtool-development)` rejected — SKILL.md 101,307 B > 100K cap | non-repo (Hermes skill store) | OPEN | parent | cosmetic — split/curate the skill file (outside repo) |
| 29 | W16 13:29 | 245/I-3 | commit `4328d20` took the `console.tsx` snapshot **before** its lint verification | commit 13:29:33 vs eslint 0/0 at 13:30:11 | FIXED-APPLIED | parent | no live defect (verified after); sequence gates before commit next time |
| 30 | W16 | 245 §5 C-1/C-4/C-5/C-6 | watches for out-of-box edits (L1↔errors.ts, L4↔headless/doctor) + 92/92 confound risk | all closed: no out-of-box edit occurred; WD-2 re-ran 92/92 on final bytes | FIXED-APPLIED | — | none — closed clean |
| 31 | W16 | 245 C-2/C-3 + 243 §13 | citation drift: `console.tsx:382→:401`; `headless.ts :960/:985→:1077/:1108`; plan `run-eval :1177/:1206` stale | content-anchored tests unaffected | OPEN | parent | cosmetic — re-pin line refs at wave close |
| 32 | W14 12:53 | 237/L3 R1 | port 8080 still held by foreign `contractorapp` at lane start → re-registered | host env (see #4) | FIXED-APPLIED | W15-L3 | superseded — :8090/:8091 fallbacks + O-3 (#25) |
| 33 | W14 | 237/L3 R2 | the browser guard had no unit pin | → reassigned to W15-L1 | FIXED-APPLIED | W15-L1 | done — `scripts/browser-guard.test.mjs` landed (4/4; RED-proven), 51/51 + verdict pins 40/40 intact |
| 34 | W14 | 237/L3 R3 | `public/og.jpg` claimed missing → proven EXISTS (18,347 B) | lane-237 phrasing corrected | FIXED-APPLIED | W15-L3 | no action (non-issue; root cause = brand-check default root `/workspace`) |
| 35 | W14 | 237/L3 R4/R5/R7 | smoke artifact explained / dev-log noise / trap residuals | closed documented / out-of-box-noted | FIXED-APPLIED | — | no action |
| 36 | W15 13:21 | 241/L3 R6 | residual UI pixels second look (tiered tab strip, Export menu, focus ring, current-step line) | done; parent-filled from lane's closing summary (lane hit iteration cap) | FIXED-APPLIED | W15-L3 / parent | none |
| 37 | W17 13:5x | 247/L2 | T-107.6 residual: `chat.server.ts:561` + `crew.server.ts:885` `callModel` seams left un-wrapped (outside the lane box; unowned by any W17 lane) | row stays open on those 2 seams | OPEN | next wave | not batch — needs a file dispatch; wrapper applies verbatim (gate + record + coded refusal) |
| 38 | W17 13:47:57 | 247/L4 (G5) | **THE ROOT (finding #1):** `src/lib/scaffold.ts:741` `emitApi` emit-line double-escapes backticks (`\\\`` / `\\\${`) → the template literal closes early → module fails strip-types parse. **Blocks:** lint (E2), typecheck (`_w16_tc.txt` TS1005 cascade), all emit-path suites | `src/lib/scaffold.ts:741` (diff `@@ -718 +741 @@`, +32/−9; mtime 13:47:57; lane log still skeleton; witnessed by 247/L3 §6 at 13:44) | MID-EDIT | **W17-L4 → parent fallback** | **FIX FIRST.** Restore escapes (`\`` and `\${`); re-run E1 (expect 92/92), E2 (expect 0), then collateral suites. Note: W17-L4 may be capped/stale — parent should take it |
| 39 | W18 14:06 | headless E-25 #4 | `emit --run: treeRun{compile,tests,run} rides the envelope; a green tree exits 0 (fixes/147 E-15)` — `1 !== 0` (green tree must exit 0; CLI child, emit path) | `headless.test.ts:1180` (assert `:1189`); cause = #38 via CLI → `headless.ts:1536` dynamic import | MID-EDIT | W17-L4 | clears with #38; re-run E1 |
| 40 | W18 14:06 | headless E-25 #5 | `emit --run: a genuinely broken emitted source exits 1` — `r.json.dir` undefined (`undefined` vs temp path) | `headless.test.ts:1216` (assert `:1231`) | MID-EDIT | W17-L4 | same root |
| 41 | W18 14:06 | headless A7 #1 | `wipes leftover tests/*.spec.ts on re-emit` — `ERR_INVALID_TYPESCRIPT_SYNTAX: Expected ',', got 'ident'` at module load | `headless.test.ts:1831` | MID-EDIT | W17-L4 | same root (in-process `scaffold` import) |
| 42 | W18 14:06 | headless A7 #2 | `refuses foreign leftover without --force; keeps it with force` — same SyntaxError | `headless.test.ts:1850` | MID-EDIT | W17-L4 | same root |
| 43 | W18 14:06 | headless A7 #3 | `174-F8: refuses emit when .rapidtool-emit.lock is held (RT_E_BUSY)` — same SyntaxError | `headless.test.ts:1875` | MID-EDIT | W17-L4 | same root |
| 44 | W18 14:06 | headless A7 #4 | `174-F8: successful emit leaves no .rapidtool-emit.lock` — same SyntaxError | `headless.test.ts:1888` | MID-EDIT | W17-L4 | same root |
| 45 | W18 14:06 | headless T-07 #2 | `redTree:'banner' emits the tree with the unmissable banner + the honest metric` — same SyntaxError | `headless.test.ts:1942` | MID-EDIT | W17-L4 | same root |
| 46 | W18 14:06 | headless T-07 #3 | `a trail cleared by a later green run emits clean under both policies (control)` — same SyntaxError | `headless.test.ts:1967` | MID-EDIT | W17-L4 | same root |
| 47 | W18 14:06 | headless T-07 #4 | `'probe' never consults the trail (fields stay absent, nothing refused or stamped)` — same SyntaxError | `headless.test.ts:1995` | MID-EDIT | W17-L4 | same root |
| 48 | W17 13:44 | 247/L3 §6 | `mock.test.ts` → `not ok 1 - runs the real P6 chunked pipeline … (zero network)` — 11/12 | dynamic import chain reaches `scaffold.ts` | MID-EDIT | W17-L4 | same root; **collateral suites predicted red (not run — WD-β budget):** `scaffold.test.ts`, `sweep73-fuzz.test.ts`, `emitted-honesty.test.ts` (all import `scaffold.ts`) |
| 49 | W17→W18 | 248 | W17 watchdog report is an unfilled skeleton (`PENDING` ×all sections; 1,626 B) — the watchdog is live/finishing | `fixes/248_w17_watchdog_report.md` | OPEN | W17-WD / parent | process — fill the four polls + verdict before wave close |
| 50 | W16→W18 | 246 §remainder | `--test-name-pattern` no-op trap: a filter matching nothing can exit 0 silently (closed locally by pairing; not codified) | tooling/doc class | OPEN | parent | cosmetic — optional repo-wide codification (doc + a guard test) |
| 51 | W18 14:1x | 249/L5 | provenance type not folded onto `Artifact` in `src/lib/types.ts` (out of the lane's file box; T5.7 consumes it later) | `src/lib/io.ts` exports `ArtifactProvenance`; `types.ts` addition staged | OPEN | next lane | not batch — additive field verbatim when a lane owns `types.ts` |

**Dedupe map (cross-refs made explicit):** WD-β-F6 = P1-α-01 (#20) · WD-1-O-4 = WD-2-F1 (#15) · WD-β-F2 = 236 strike-2 (#13) · 245 C-5 confound risk folded into #30 · 245 C-6 = clean (no row). RED-first test failures inside the fix process (236 `not ok 3`; 237-L1 `not ok 16/17`; 241-L1 repair-seam + guard RED) are the intended pre-fix states of #7/#8/#33 and are not counted as errors.

## WAVE LANDING STATUS (as read at 14:1x; relevant to "when all tasks are done")

| wave | landed | state | note |
|---|---|---|---|
| W13 | C-1 fix authored (236) | folded | `git log -S` provenance: `23cc563` etc. |
| W14 | C-1 audited (WD-β CONFIRMED) · C-2 landed (237-L1) · doc-truth (237-L2, ratified) · browser pass (237-L3, R1–R7 registered) | folded into `4328d20` | env false failures #1–#4 documented |
| W15 | L1 repair-seam + guard pin (92/92, 4/4) · L2 RT_EVAL boundary (37/37) · L3 residuals · L4 13/13 strengthenings | folded into `4328d20` | WD-1/WD-2 certified; anomaly reconciled (#1–#3) |
| W16 | OV-35 preflight (25/25) · TASK-01 `nextAction` + arm-parity (4/4, 92/92) · DF-18/26 byte-mirrors · OV-18/14 pins (9/9 · 87/87 · 48/48) | **UNCOMMITTED** atop `4328d20`; boundary attempt at 14:00 blocked by #38 | needs own boundary + commit once #38 is fixed |
| W17 | L1 corpus fold (90 ins/0 del, 62 rows) · L2 T-107.6 (67/67; residual #37) · L3 thinking trio (109 tests, 0 fail) · L5 infra (46/45/1-skip; guard 4/4) | **UNCOMMITTED**; **L4 in-flight & stale — owns the #38 break**; watchdog #49 unfilled | the wave cannot close until #38 fixed + L4 resolved |
| W18 | 6 lanes in flight (skeletons live; no landings at 14:1x); WD-α live (`fixes/250`) | in progress | this ledger is the wave's error register |

## Method, honesty limits

- Read-only on everything but this file + `C:/Users/mnril/w18wd_b_scratch/`; no git mutations; 1 suite run + 1 lint run + 1 import probe (all foreground) — within the ≤2-run budget for the named diagnostics.
- Attribution of the 9+1 emit failures to `scaffold.ts:741` rests on: eslint pinpoint (E2), the strip-types parse probe (P1), the identical SyntaxError in every failing subtest, and W17-L3's independent observation (`fixes/247_lane3` §6). E-25 #5's exact envelope shape (missing `dir`) was not further excavated (read-only budget) — the root cause covers it; re-run E1 after #38 to confirm all 9 flip.
- The collateral suites in #48 were NOT run (budget): "predicted red" is labelled as prediction, not measurement. Re-run them in the batch-fix verification.
- Every row carries its producing source; where a claim is another watchdog's, the report+section is cited rather than re-asserted.
