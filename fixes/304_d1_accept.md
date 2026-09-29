# fixes/304_d1_accept.md — LANE L1 ROUND 2 (CODER D1) · acceptance/eval truth tail

> W42 · cards L1-E1…E-6 close-out + C1's round-1 finds. File box: `scripts/run-eval.mjs` ·
> `scripts/run-eval.test.mjs` · `src/lib/scorecard.ts` · `src/lib/scorecard.test.ts` ·
> `src/lib/fixtures.ts` · `src/lib/fixtures.server.ts` · `src/lib/fixtures.test.ts`.
> Opened EARLY, append-only. Base HEAD: `8418b04`. Evidence line per item: `file:line · before → after · proof`.
> **Result: ZERO fixes at cause** — every owed tail was run/verify-only and all of them came back green.

## Status board

| Item | What | Status |
|---|---|---|
| T1 | RUN E-6's pins (`scripts/run-eval.test.mjs`, incl. E-3's 4 + E-6's 2) | DONE — **41/41 pass, 0 fail** (both invocations) |
| T2 | L1 tail sweep (E-1…E-6 done-when residuals; keyless smoke) | DONE — exit 0, endClass rides end-to-end |
| T3 | C1's round-1 finds closed (CLI `eval` verbatim render @ :1523; log append) | DONE — ✓ verified live + bytes |
| T4 | Cross-check `scorecard.test.ts` + `fixtures.test.ts` | DONE — **13/13 pass, 0 fail** |

## Evidence

### T1 — E-6 pins run: GREEN, nothing to fix [LANDED]
- `node --experimental-strip-types --test scripts/run-eval.test.mjs` → **41/41 pass, 0 fail** (baseline 35 + E-3's 4 + E-6's 2).
- Canonical form re-run (repo scripts leg uses plain node — `package.json:23`): `node --test scripts/run-eval.test.mjs` → **41/41 pass, 0 fail**.
- Pin contents byte-read: E-6(a) `run-eval.test.mjs:1326-1351` — real atomic replacement + no `.tmp` leftovers + failed-rename (rename-onto-directory) throws and the old target survives untouched; E-6(b) `:1353-1367` — `MAX_HISTORY_ROWS === 200` + newest-survive slice semantics + wiring-guard regexes against `run-eval.mjs` (`writeJsonAtomic(RESULTS_PATH, results)` / `writeJsonAtomic(HISTORY_PATH, history.slice(-MAX_HISTORY_ROWS))`).

### T2 — L1 tail sweep: the one owed done-when (keyless smoke) [LANDED]
- **Keyless `EVAL_OUT_DIR` scratch smoke** (owed by E-1/E-2/E-6 done-when; C1's summary ⚠3): `EVAL_OUT_DIR=C:/Users/mnril/AppData/Local/Temp/d1_eval_smoke node --experimental-strip-types scripts/run-eval.mjs --limit=2` → **exit 0**; artifacts written ONLY to the Temp scratch (run log line: `wrote C:\…\Temp\d1_eval_smoke\results.json · 2 entries · history appended to …history.json`) — repo `research/eval-out` untouched.
- `results.json`: 2 entries (`arcade-breakout`, `coffeehouse2home-property-ledger`) — **each carries `endClass: "unmeasured"`** ∈ the 3 values; `history.json`: 2 rows — each carries `endClass`. Scratch dir: **no `.tmp` leftovers** (atomic writes clean).
- Keyless ⇒ every row classifies `unmeasured` by design (the classifier funds only `mode==="keyed"`); funded/unfunded arms ride E-3's tri-state unit pin. Pre-existing F4#3 `meanAtLeast:1` unreachability fired as expected in the smoke (`mean 0.44/0.56 < 1 → pass=no`) — RECORDED, not fixed (SPEC trap).
- E-1 crash-row `endClass:"unmeasured"`: bytes at `run-eval.mjs:3265-3268` (per R1) + E-1 wiring-guard pin; the smoke can't force a harness crash — declared, not fabricated.
- E-4/E-5 bytes re-verified fresh: `fixtures.ts:239` `reviewState: f.ok && graderOk ? "awaiting-decision" : "bar-missing"`; `fixtureProblem` `:223`/`:237`; `@de-scoped` blocks `:23-31` (above `FixtureVerdict` `:36`) + `:252-262` (above `fixtureDecisionEntry` `:256`). Repo-wide grep `FixtureVerdict|FixtureDecisionEntry|fixtureDecisionEntry` → `src/lib/fixtures.ts` (definitions) + `src/components/console.tsx:465-466` (W24 **comment** reach, not a consumer) — zero code consumers stands; console is parked (§4), not touched.
- E-6(b)/(c) bytes: `MAX_HISTORY_ROWS = 200` `run-eval.mjs:2871`; slice-before-write `:2948`; `isMainModule` `:3372-3378` = the resolve+lowercase target idiom (struck by C1 as already landed `e97e72d` — re-read, confirmed).

### T3 — C1's round-1 finds closed [LANDED]
- **The find — CLI `eval` render of the new scorecard fields:** `rapidtool-cli.mjs:1421-1424` resolves `--dir` / `EVAL_OUT_DIR`; `:1505-1523` builds the scorecard and `respond({ ...scorecard, notes, trends: sc.buildTrends(historyRows) }, 0)` — **verbatim, no field remapping** (the SPEC's `:1523` anchor verified byte-exact).
- **No cli.mjs edit (free render) proven:** `grep -c "endClass" scripts/rapidtool-cli.mjs` → **0**; `grep -c "verification" scripts/rapidtool-cli.mjs` → **0**.
- **Live render proof** (`EVAL_OUT_DIR=<scratch> … rapidtool-cli.mjs eval`, cwd=scratch, `C:/…` script form, exit 0): response carries `derived.endClass {funded:0,unfunded:0,unmeasured:2,absent:0}` · `derived.acceptance {pass:0,fail:2,unscored:0}` · entry `{endClass:"unmeasured", behaviorOk:true, kindOk:true, acceptance.verification:"files+content+behavior (5/6 rows pass, 1 ui-shell skip)"}` · both census notes verbatim. (`history` key = summary object `{path,present,rows,slugs,note}` by design; history-row `endClass` is parsed+typed at `scorecard.ts:316`/`:345` and pinned in `scorecard.test.ts` (b) `:103-112`.)
- **C1's log tail item 2 (log not appended):** `fixes/303_c1_accept.md` status board brought to final + round-2 close-out appended there (this file is the full evidence).

### T4 — cross-checks + hygiene [LANDED]
- `node --experimental-strip-types --test src/lib/scorecard.test.ts src/lib/fixtures.test.ts` → **13/13 pass, 0 fail** (5 + 8).
- `node --check scripts/run-eval.mjs` → **exit 0**.
- No code edits this round (verify-only). `git status --short`: only untracked lane logs (`fixes/304_d*.md`) + sibling D2's `M src/lib/planning.ts` (L2 lane, untouched by me); NOTHING changed inside the L1 file box.

## Lane table — card → status → evidence

| Card | Status | Evidence |
|---|---|---|
| L1-E1 `endClass` on entries + crash row | DONE (R1) + smoke-verified (R2) | entryRow seam in `run-eval.mjs`; scratch smoke 2/2 entries + 2/2 history rows carry `endClass`; wiring-guard pin in leg |
| L1-E2 scorecard reader + NEW `scorecard.test.ts` | DONE (R1) + render-verified (R2) | `scorecard.test.ts` 5/5; live CLI render carries `derived.endClass`/`derived.acceptance`/verification; cli.mjs grep 0/0 |
| L1-E3 missing pins (U1 + Q4-b/c) | DONE (R1) + R2 run | 4 new tests; leg **41/41** (strip + plain) |
| L1-E4 fixtures: no fake review rows | DONE (R1) + bytes re-verified (R2) | `fixtures.ts:239`; `fixtures.test.ts` 8/8 |
| L1-E5 dead fixture-decision exports | DONE (R1) + grep re-verified (R2) | `@de-scoped` blocks `fixtures.ts:23-31`/`:252-262`; consumers = none (console hit is a comment) |
| L1-E6 hygiene cluster (atomic/cap/main-check) | DONE (R2) — pins RUN green | E-6(a)/(b) pins pass; `node --check` 0; smoke exit 0, no `.tmp` leftovers |

Scratch (outside repo): `C:/Users/mnril/AppData/Local/Temp/d1_eval_smoke/` (+ `d1_smoke.log`, `d1_eval_render.json`, inspectors). No keyed calls anywhere.
