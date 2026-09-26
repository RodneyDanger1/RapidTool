# fixes/254 — W19 · WD-β · THE ERROR LEDGER v2 (append-only continuation of fixes/251; v1 never rewritten)

**OWNER:** WD-β (error-ledger keeper, W19) · **built:** 2026-09-24 14:31 → 14:42 CDT · **STATUS: COMPLETE** (v2 snapshot; the W19 wave is mid-flight — later lane landings belong to the wave's close-out / v3).
**Scope:** READ-ONLY everywhere else; this file + `C:/Users/mnril/w19wd_b_scratch/` are the only writes. **No git mutations.** ≤2 owned FOREGROUND runs — used exactly 2: **E3** (headless suite) + **E4** (lint).
**Continuation rule (WD-β brief):** v1 (`fixes/251_error_ledger.md`) is **never rewritten**. This file **appends** rows `#52+` and **supersedes v1 rows only by marking** (§SUPERSEDE MARKS — v1's bytes stay as they were). v1's register still owns rows #1–#51 and its method notes.
**Sources:** `fixes/251` (v1 baseline) · W18 lane logs `fixes/249_lane{1..5}*` · W18 WD-α `fixes/250` · `_w1718_tc.txt` / `_w1718_lint.txt` (parent's 14:16/14:17 boundary-attempt captures) · commit `8e25180` (parent fix + registration sweep) · W19 WD-α `fixes/253` · the two living diagnostics this watchdog owns (E3/E4) · direct byte reads timestamped 14:31–14:45.
**Sources:** `fixes/251` (v1 baseline) · W18 lane logs `fixes/249_lane{1..5}*` · W18 WD-α `fixes/250` · `_w1718_tc.txt` / `_w1718_lint.txt` (parent's 14:16/14:17 boundary-attempt captures) · commit `8e25180` (parent fix + registration sweep) · W19 WD-α `fixes/253` · the two living diagnostics this watchdog owns (E3/E4) · direct byte reads timestamped 14:31–14:42.
**Host artifact rule (inherited; v1 #1–#3):** node under the Hermes BACKGROUND harness dies `stdin is not a tty`, exit 1, zero output — never a code failure. Everything here ran FOREGROUND.

---

## BOTTOM LINE (final)

```text
total: 62 · open: 16 · fixed: 40 · env-artifact: 6 · ready-to-fix-now: 5
```
- open = OPEN + MID-EDIT; fixed = FIXED-APPLIED + FIXED-STRKED; env-artifact rows were never code failures and stay excluded from both.
- **THE ONE THING:** row **#52** — `src/lib/git.server.ts:152` **TS2345** (`seatCtxOf()` returns `actor?: unknown`; `evaluatePolicy` needs `PolicyCtx.actor?: PolicySeat`) — the **only OPEN typecheck-class row** in the repo. E3 (headless **92/92**) and E4 (lint **0**) are green; the next boundary's single code blocker is #52.
- **The W19 plan's "2 TS + 1 lint" for git.server.ts is superseded by measurement:** the 14:16 boundary typecheck measured **3 TS errors** (TS2345@152 · TS2322@703 · TS2322@763); #53/#54 read as resolved in current bytes, the lint half is fixed (**E4 = 0**). WD-α `fixes/253` **C12 confirms the "unregistered" half is stale** (registered in `8e25180`).
- **READY-TO-FIX-NOW (5, ordered):** **#52** (real; smallest gate-clearing edit) → **#24** → **#14** → **#50** → **#28**. Flagged-awaiting-dispatch: **#37**, **#51**. Held by W19 lane boxes: #15–#18, #31 (and #27 if ever relocated). Full rationale in §READY-TO-FIX-NOW.
- **Delta vs v1:** **+11 rows** (#52–#62: 6 fixed, 5 open) · **12 v1 rows superseded by marking** (#38 → #49, all to FIXED-APPLIED) · **0 v1 bytes changed.**

## Living evidence — the two diagnostic runs (WD-β, W19)

| # | exact command | ts (CDT) | result | capture |
|---|---|---|---|---|
| E3 | `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` (FOREGROUND) | ran ≈14:33:38 → 14:35:35 (duration 117,795 ms) | **exit 0 · `# tests 92 · # suites 28 · # pass 92 · # fail 0 · # cancelled 0 · # skipped 0 · # todo 0`** — `grep -c "not ok"` → **0** | `C:/Users/mnril/w19wd_b_scratch/headless_v2.txt` (27,338 B) |
| E4 | `npm run lint` (FOREGROUND) | 14:36:11 | **exit 0 · zero problems** (output: the two `npm notice run …` lines only) | `C:/Users/mnril/w19wd_b_scratch/lint_v2.txt` (44 B) |

**Evidence notes (honesty):** E3 ran with `src/lib/headless.ts` at its 13:27:04 bytes (not yet touched by W19-L1 — L1's first edit landed in `engine.ts` at 14:39:41, *after* E3). E4 ran against a tree already carrying W19 lanes' in-flight edits (`engine.ts`, `chat.ts`, `policy.ts`, `run-eval.mjs`, `registry.ts` were being written 14:36–14:40); both captures carry their mtimes above. These two runs satisfy the named-diagnostics obligation; **v1's E1/E2 remain the pre-state** for comparison (v1 E1: 83/92 + 9 fails; E2: lint exit 1).

## §SUPERSEDE MARKS — v1 rows whose state changed since v1's freeze (v1 bytes untouched)

| v1 # | v1 state | NEW state | evidence (command / bytes / ts) |
|---|---|---|---|
| 38 | MID-EDIT (THE ROOT, scaffold.ts:741) | **FIXED-APPLIED** | parent fix committed in `8e25180` ("scaffold.ts:741's doubled template escaping … corrected … restored 83/92 → 92/92"); `scaffold.ts` clean vs HEAD; **E3 92/92** |
| 39 | MID-EDIT (E-25 #4) | **FIXED-APPLIED** | E3 92/92 — suite 19 green |
| 40 | MID-EDIT (E-25 #5) | **FIXED-APPLIED** | E3 92/92 |
| 41 | MID-EDIT (A7 #1) | **FIXED-APPLIED** | E3 92/92 — suite 21 green |
| 42 | MID-EDIT (A7 #2) | **FIXED-APPLIED** | E3 92/92 |
| 43 | MID-EDIT (A7 #3) | **FIXED-APPLIED** | E3 92/92 |
| 44 | MID-EDIT (A7 #4) | **FIXED-APPLIED** | E3 92/92 |
| 45 | MID-EDIT (T-07 #2) | **FIXED-APPLIED** | E3 92/92 — suite 22 green |
| 46 | MID-EDIT (T-07 #3) | **FIXED-APPLIED** | E3 92/92 |
| 47 | MID-EDIT (T-07 #4) | **FIXED-APPLIED** | E3 92/92 |
| 48 | MID-EDIT (mock.test.ts 11/12) | **FIXED-APPLIED** *(mechanism removed; suite not re-run under the 2-run budget — labelled)* | root #38 fixed+committed; `8e25180` records emitted-honesty load 5/5 (a predicted-red sibling); mock.test.ts not re-measured |
| 49 | OPEN (W17 watchdog skeleton 1,626 B) | **FIXED-APPLIED** | `fixes/248_w17_watchdog_report.md` now **18,189 B, filled** (verdicts §6, incidents §4 C-1, honest limits; mtime 14:10) |

**Stand-as-is (v1 rows re-verified / re-pinned 14:31–14:42 — still OPEN unless noted):**
- **#14** `fixes/236:51` typo `verifyAndServever` — **still present** (grep 14:40).
- **#24** `fixes/241_lane3_browser_residuals.md:38` stale `[fill]` — **still present** (grep 14:40).
- **#15** repair-FAILED `minted: false` pair — **still present, re-pinned: :2717 / :2837** (defect sites; gate: green.gate context); truth sites now **:2693 / :2813** (`minted: green.minted`). Uniform +125 drift vs v1's refs; `headless.ts` mtime 13:27:04 (the drift predates v1's freeze — v1 cited 243's W15 positions).
- **#16** stale "NEVER mint lastTest" comment — **still present at :2037** (was cited :1908-1912). **#17** stale "minted tested" comment — **still present at :2677** (was :2550-2552). **#18** stale fn doc — refs drift +~129 (:1812-1816 → ~:1941); **not re-read** this pass.
- **#37** `chat.server.ts:561` + `crew.server.ts:885` bare `callModel` seams — **still present** (grep 14:35).
- **#50 / #28 / #31** — unchanged from v1; not re-measured.
- **#51** `src/lib/types.ts` still has **no** `ArtifactProvenance` (grep 14:35 → 0 hits; `io.ts` carries the type, 13 provenance refs).
- **#27** (v1 FIXED-APPLIED, "relocate only if strict") — untouched; its file (`console.tsx`) is W19-L2-owned, so a strict-mode relocation is *held* this wave.

## §ADDENDUM — new rows (v2, `#52+`; v1's register above is untouched)

Status vocabulary (inherited): `OPEN` · `FIXED-STRIKED` · `FIXED-APPLIED` · `MID-EDIT` · `ENV-ARTIFACT`.

| # | ts | wave/lane | what failed (exact test/command) | attribution (file:line or EXT-FAIL) | status | fix owner | batch-fix note |
|---|---|---|---|---|---|---|---|
| 52 | W18 14:16 | 249/L3 | `tsc --noEmit`: `src/lib/git.server.ts(152,60): error TS2345 — Argument of type '{ actor?: unknown; … }' is not assignable to parameter of type 'PolicyCtx'` (actor `unknown` vs `PolicySeat \| undefined`) | `git.server.ts:128-141` (`seatCtxOf` returns `actor?: unknown`) + `:151-152` (call site) — read 14:38; `policy.ts:50` (`PolicySeat`) / `:89-97` (`PolicyCtx`) unchanged | **OPEN** (current-state by byte inference — typecheck is parent/boundary-only; re-measure at the next boundary) | W18-L3 → parent | **REAL — the only open typecheck blocker.** Lanes may not run typecheck (forbidden), so this surfaced only in the parent's 14:16 attempt (`_w1718_tc.txt`). Fix = narrow `seatCtxOf`'s return / map `actor` in git.server.ts |
| 53 | W18 14:16 | 249/L3 | `git.server.ts(703,9): error TS2322 — '"RT_E_GIT_UNAVAILABLE"' is not assignable to the ErrorCode union` (**the "unregistered RT_E_GIT_UNAVAILABLE"**) | `errors.ts:62` (+ doc `:469`) register it — additive mint (249_lane3 §6.1), committed in `8e25180`; WD-α `253` C12 confirms; current bytes :698-708 return `RT_E_INTERNAL` on that branch | **FIXED-APPLIED** | W18-L3 | done — registration landed; boundary re-measure recommended |
| 54 | W18 14:16 | 249/L3 | `git.server.ts(763,5): error TS2322` — `failureFromRun` returned `{reason:"git-failed"; code: ErrorCode}` not assignable to `GitLandFailure`'s runner variant (`code: "RT_E_RUNNER_FAILED"`) | current bytes: union `:221-269` now carries exact variants (git-absent `:251` · runner `:259` · internal `:269`); `failureFromRun` `:763-793` returns the matching literals | **FIXED-APPLIED** *(current-bytes inference; boundary re-measure)* | W18-L3 | done — refactor matches the union; verify at boundary |
| 55 | W18 14:17 + 14:24 | 249/L3 (+L4 EXT-FAIL) | **lint error** `git.server.ts 573:20 — Unexpected control character(s) in regular expression: \x00, \x1f (no-control-regex)` (parent `_w1718_lint.txt`; lane4 saw the same at `:577` @14:24) | current `:573-581` = char-code loop with the explanatory comment ("deliberately NOT a character-class regex") | **FIXED-APPLIED** | W18-L3 | done — **E4 = 0 problems repo-wide** (14:36) |
| 56 | W18 14:17 + 14:24 | 249/L5 (+L4 EXT-FAIL) | codegen lint items: `codegen.server.ts 2290:10 warning 'modelProvenance' is defined but never used` (14:17); `:2890 prefer-const error + unused-var warning on servedModel` (14:24) | W18-L5's io/codegen provenance landing (file mid-edit across the two reads) | **FIXED-APPLIED** | W18-L5 | done — E4 = 0 |
| 57 | W18 14:24 | 249/L4 `[EXT-FAIL]` | lane4's logged EXT-FAIL: full `npm run lint` → exit 1, 3 problems, **zero in its files**; owners named: L3 (:577 no-control-regex) + L5 (codegen items) | `fixes/249_lane4_t55.md:100-105` | **FIXED-APPLIED** (source row) | — | its two findings = #55/#56 (both resolved). **EXT-FAIL accounting (nothing dropped): L1 none · L2 none · L3 explicit-none (249_lane3 §6.4/§181) · L4 one → #57 · L5 placeholder, unfilled → #60.** L3's in-lane RED-first instrument (its §3.4) = intended pre-fix state, not counted (v1 rule) |
| 58 | W18 14:19 | 250 WD-α W1 | W18 WD-α watch: `RT_E_GIT_UNAVAILABLE` used 9× in git.server.ts but **not registered** in errors.ts (not in L3's box); flag: "either reuse a registered code or it is an I13 violation; an out-of-box errors.ts edit would be a P1" | `fixes/250_w18_wd_alpha.md` §2 W1 + §6 (L3 "at-risk") | **FIXED-APPLIED** | W18-L3 | closed by the additive mint (2 hunks / +12; `errors.test.ts` 37/37 per 249_lane3 §8; committed in `8e25180`). Also: WD-α's scaffold.ts P1-candidate resolved to W17's own G5 activity (250 §3) — no W18 touch (context for v1 #38) |
| 59 | W18→W19 | 250 | **W18 WD-α report never finalized:** §BOTTOM = "INTERIM (final at close)", §4 test re-runs PENDING, §5 in-progress, §6 interim; no p11+ poll row; file unchanged since 14:19 | `fixes/250_w18_wd_alpha.md` (mtime 14:19, 10,450 B) | **OPEN** | W18-WD / parent | process — fill §4–§6 verdicts before W18 close-out (same class as v1 #49, which *was* filled) |
| 60 | W18→W19 | 249/L1·L2·L5 | **W18 lane logs left as unfilled skeletons although their code LANDED:** L1 (28 ln; "Status: in progress"; all boxes unchecked; mtime 14:04) · L2 (18 ln; "BOTTOM LINE … PENDING"; mtime 14:05) · L5 (55 ln; evidence + EXT-FAIL boxes unchecked; mtime 14:07) | `fixes/249_lane1_ov9.md` · `249_lane2_f3.md` · `249_lane5_t54.md` (committed as-is in `8e25180`) | **OPEN** | parent | process — fill closing evidence per lane before the boundary commit (L3/L4 logs ARE filled; v1 #23/#49 precedent) |
| 61 | W19 14:37 | 253 WD-α W1 (live) | L2's proposed refusal codes `RT_E_POLICY_ACTION_DENIED` / `RT_E_POLICY_ACTION_ASK` **not in** `errors.ts` (`grep RT_E_POLICY src/lib/errors.ts` → 0); unregistered = I13-class; an out-of-box errors.ts edit by L2 would be the P1 screen | `fixes/253_w19_wd_alpha.md` §2 W1 (claim vs bytes) | **MID-EDIT** (live W19 watch) | W19-L2 | resolve **in-lane**: reuse a registered code OR register through the owner's box decision; re-check at wave close |
| 62 | W19 14:37 | 253 WD-α C12 | W19 plan header claims git.server.ts has "unregistered RT_E_GIT_UNAVAILABLE" — **STALE**: `errors.ts:62` + `:469` register it (landed in `8e25180`) | `wave_plans/W19/lanes-and-watchdogs.md:11-13` vs `errors.ts` (WD-α C12 verdict: "STALE PLAN TEXT") | **OPEN** | parent | cosmetic — rewrite the plan's KNOWN-ERRORS note at close (the ":763 type mismatch" half = #54's class) |

**New dedupe cross-refs:** #57 ⊂ #55+#56 (source row) · #58 ⊂ #53 (same registration, watchdog view) · #52–#55 = the W19 plan's "2 TS + 1 lint" expanded to the measured 3 TS + 1 lint (see BOTTOM LINE). No other duplicates.

## §MASTER TOTALS (v1 + addendum − supersedes)

| component | total | open | fixed | env |
|---|---|---|---|---|
| v1 (`fixes/251`) | 51 | 23 | 22 | 6 |
| + addendum #52–#62 (11 rows) | +11 | +5 (#52,#59,#60,#61,#62) | +6 (#53–#58) | +0 |
| − supersedes (12 v1-open → fixed: #38–#49) | 0 | −12 | +12 | 0 |
| **v2 (this file)** | **62** | **16** | **40** | **6** |

- **open list (16):** #14 · #15 · #16 · #17 · #18 · #24 · #28 · #31 · #37 · #50 · #51 · #52 · #59 · #60 · #61 · #62.
- **fixed added in v2 (18):** #38–#49 (supersedes) + #53–#58 (addendum).
- Arithmetic: 16 + 40 + 6 = 62 ✓.

## §BATCH-FIX ORDER (severity first)

1. **REAL REGRESSIONS (gate-class):**
   a. **#52** — `git.server.ts:152` TS2345 — fix first; it is the only open typecheck item (E3 92/92, E4 0 otherwise). Then the parent boundary re-measures `typecheck` (confirms #52/#53/#54 in one run) and commits the W18-late set.
   b. **#61** — W19-L2's code registration must resolve in-lane (live watch; it is F4's coded-refusal contract).
   c. Boundary hygiene: commit the W18-late set with per-file attribution (doctor/git.server/codegen/io.test/cli-lesson + L3/L4 logs); keep `.hermes-tmp.*` tool temps out of the commit.
2. **PRECISION ITEMS:** **#15** (`minted: false` → `green.minted` at :2717/:2837 + add a pin), **#16/#17/#18** (stale comments/doc), **#14** (`fixes/236:51` typo), **#31** (citation re-pin), **#24** (`[fill]`), **#50** (codification), **#51** (types.ts provenance fold — dispatch item), **#37** (chat/crew seams — dispatch item, wrapper applies verbatim).
3. **COSMETICS / PROCESS:** #59 (finalize 250), #60 (fill L1/L2/L5 logs), #62 (plan header), #28 (skill file), #27 (only if strict).

## §READY-TO-FIX-NOW (ordered shortlist)

**Rubric:** OPEN row ∧ owner has landed ∧ files stable ∧ no W19 lane box owns the file (no collision). Read at 14:31–14:42.

**Count = 5:**
1. **#52** — `git.server.ts:152` TS2345 (W18-L3 landed; file stable since 14:28; W19 boxes exclude it → parent fix). *Real: clears the last open typecheck item.*
2. **#24** — `fixes/241_lane3_browser_residuals.md:38` stale `[fill]` — one line, file committed/stable.
3. **#14** — `fixes/236:51` typo `verifyAndServever` — one word, file committed/stable.
4. **#50** — `--test-name-pattern` codification (additive doc + guard; no box collision).
5. **#28** — skill-file size/split (non-repo; house work).

**Flagged, awaiting a dispatch/owner (files stable, no owner landed yet):** **#37** (chat.server.ts:561 / crew.server.ts:885 — no W19 box; wrapper verbatim) · **#51** (types.ts additive field; io.ts side already landed).

**Held by W19 lane boxes (do NOT fix mid-wave):** #15/#16/#17/#18 (headless.ts — W19-L1) · #31 (console.tsx + headless.ts + run-eval.mjs — L1/L2/L4) · #27-if-strict (console.tsx — L2).

## §WAVE LANDING STATUS (as read 14:31–14:42; HEAD `8e25180`)

| wave | landed | state | note |
|---|---|---|---|
| W13–W17 | — | **folded** (`8e25180`; W17's C-1/P1 fixed in the same commit) | v1's table stands; #38–#49 relabeled per §SUPERSEDE |
| W18 L1 | doctor.ts(+test) landed | **UNCOMMITTED late set, stable** (mtimes 14:26) | log = skeleton (#60) |
| W18 L2 | knowledge.ts + CLI lesson arm + lesson test (late delta 4 ln, 14:26:56) | **UNCOMMITTED / committed mix; stable** | log = skeleton (#60); WD-α noted a `--list` classifier nuance (250 §5) — watch README-cli parity |
| W18 L3 | git.server.ts(+test) committed in `8e25180`; post-commit deltas (24/34 ln, 14:28/14:25) | **UNCOMMITTED deltas; stable**; log filled (207 ln) | owns #52–#55; "No [EXT-FAIL] entries" explicit |
| W18 L4 | plugin.ts(+test) committed | **landed**; log filled (115 ln) | EXT-FAIL → #57 (resolved) |
| W18 L5 | io.ts committed; codegen(+test)/io.test late (104/18/160 ln; codegen.test still grew 14:33:40) | **UNCOMMITTED; latest writer in the W18 set** | log = skeleton (#60); WD-α `253` p1 attributes the 14:33 codegen.test growth to L5 |
| W18 L6 | `research/multiagent/249_define_first_specs.md` committed | **landed** (docs) | no findings |
| W18 WD-α | `fixes/250` interim | **never finalized** (#59) | its W1 closed (#58) |
| W19 L1–L6 | **live since ~14:31** — bytes observed landing mid-read: engine.ts (14:39:41) · policy.ts (14:39:13) · chat.ts (14:39:09) · run-eval.mjs (14:39:42) · registry.ts (14:39:50) · openai-compatible.ts (14:37:48) + probe.ts · cassette.ts (14:36:53) · corpus `permit-inspection-tracker.*` · by 14:41 `headless.ts` + `chat.test.ts` also M (L1/L3 began landing) | **IN FLIGHT** | all six `fixes/252_*` logs up (skeletons); WD-α `253` live (0 P1s, 1 watch = #61); no W19 lane EXT-FAIL logged at snapshot (L5 §4 "pending"; L6 box unchecked) |

## §Method, honesty limits

- Read-only on everything but this file + `C:/Users/mnril/w19wd_b_scratch/`; **no git mutations**; exactly **2 foreground runs** (E3, E4) — the named diagnostics; no other suite was executed.
- **Measurement vs inference, labelled:** E3/E4 are measurements (exit codes + counts above). #52/#54's *current* state is **byte-read inference** — typecheck is forbidden to watchdogs (parent/boundary-only), so the parent's next boundary run is the re-measure. #48's suite was not re-run (budget) — labeled as such. #18/#28/#31/#50 were not re-measured this pass.
- The W19 plan's "2 TS errors" vs the measured 3 (14:16): both the plan's and the ledger's counts are on record; the ledger rows all three, and #62 tracks the plan's stale text.
- Host/house artifacts (never failures, no rows): `.hermes-tmp.*` tool temps (seen again 14:41 in `providers/`; a Sep-6 one in `fixes/`) — exclude from any commit; the stdin-not-a-tty rule stands (v1 #1–#3).
- This snapshot freezes at 14:42 CDT **mid-wave**: W19 lanes will keep moving; anything they log/find belongs to the wave's close-out (v3), not to this file.
