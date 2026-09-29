# fixes/303_c3_docs.md — LANE L3 · DOCS CENSUS + DOC-TRUTH (coder C3)

> Card: SPEC §2 · L3 (D-1…D-6). File box: README.md · START-HERE.md · docs-FOLDER-MAP.md ·
> scripts/README-cli.md · AGENT_GUIDE.md · scripts/docs-module-parity.mjs. Append-only.
> HEAD `424f9e5` + working tree, 2026-09-28. No keyed calls. PATCH-FIRST.

## t0 — census re-derive (every number by its own command, run 2026-09-28 @ 424f9e5)

| # | Number | Command (as run, cwd = repo root) | Output |
|---|---|---:|---:|
| 1 | total tracked | `git ls-files \| wc -l` | **1754** |
| 2 | root files | `git ls-files \| grep -v / \| wc -l` | **42** |
| 3 | fixes/ | `git ls-files fixes \| wc -l` | **450** |
| 4 | research/ | `git ls-files research \| wc -l` | **476** |
| 5 | src/ | `git ls-files src \| wc -l` | **210** |
| 6 | wave_plans/ | `git ls-files wave_plans \| wc -l` | **105** (tracked; W42 still untracked) |
| 7 | scripts/ | `git ls-files scripts \| wc -l` | **45** |
| 8 | migrations/ | `git ls-files migrations \| wc -l` | **2** |
| 9 | .grok/ | `git ls-files .grok \| wc -l` | **89** |
| 10 | src/lib split | `git ls-files src/lib \| grep -c '\.test\.ts$'` · `…grep -c -v …` | tests **85** · modules **115** (Σ 200) |
| 11 | verbs | `grep -c 'case "' scripts/rapidtool-cli.mjs` | **39** |
| 12 | research split | `git ls-files research/multiagent \| wc -l` · `research/eval-corpus` · `research/eval-out` · `research \| grep -E '^research/[^/]+$'` | **103 · 23 · 345 · 5** (Σ 476) |
| 13 | §10.1 other rows | builds **50** · vault-e2e **47** · screenshots **16** · public **10** · audit-bugs **5** · audit/review/proposals **3+3+3** · server **2** · .github **1** · attachments/artifacts/.audit-g2 **1+1+1** · .t4scratch **192** (all `git ls-files <dir> \| wc -l`) |

**SPEC card anchors vs live:** root 44→42 ✓ · fixes 429→**450** ✓ · total 1,715→**1,754** ✓ ·
research 476 ✓ · src 210 ✓ · scripts 45 ✓ · wave_plans 105 (W42 untracked; tracked census stays 105) ·
extra find: **research/eval-corpus 15→23** (§10.1 breakdown cell + §10.8 heading stale).

## Pending drift list (to patch)

- README:293/296 catalog title "1,391 today" (older stale count) → live 1,754.
- README:S10.1 table: fixes 429→450 · root 44→42 · total 1,715→1,754 · research breakdown eval-corpus 15→23.
- README:302-304 "re-derived 2026-09-27 at `ac6b151`" → W42 close (424f9e5).
- README:S10.6 :410 "200 files = 111 modules + 89 colocated tests" → 115 modules + 85 tests.
- README:S10.9 :588 "(429 tracked)" → 450.
- README:S10.7 :498 "45 tracked = 24 tools + 21 tests" → re-derive (45 = ? + ?).
- README:S10.2 all-42 named rows — set-diff vs `git ls-files | grep -v /`.
- START-HERE:26 "191 files"→200 · :28/:91 "37 verbs"→39 · :29 "(40)"→45 (re-derive).
- docs-FOLDER-MAP per-node numbers — re-derive live.
- README-cli.md: D4 fidelity pass (6 items) — pins test read first.
- docs-module-parity: DOCS += START-HERE.md; --self-check honesty.
- AGENT_GUIDE §4: name the `ingest` channel.

---

## t1 — LANDED (all six cards) + evidence (append-only)

### L3-D1 · README census — every §10 number re-derived at edit time
- Catalog preamble (:293/:296) 1,391 → **1,754** · (:303) "working tree is clean at HEAD `ac6b151`" → "counts read the tracked index at HEAD `424f9e5` + the W42 lane work (re-derived 2026-09-28)" · §10.1 heading (:305) → re-derived 2026-09-28 at `424f9e5`.
- §10.1 cells: `research/` breakdown `eval-corpus/` 15 → **23** (Σ 103+23+345+5 = 476 ✓) · `fixes/` 429 → **450** · root 44 → **42** · Total 1,715 → **1,754**. All other cells re-verified live (src 210 · scripts 45 · wave_plans 105 · .grok 89 · builds 50 · vault-e2e 47 · screenshots 16 · public 10 · audit-bugs 5 · audit/review/proposals 3+3+3 · server 2 · migrations 2 · .github 1 · attachments/artifacts/.audit-g2 1+1+1 · .t4scratch 192).
- §10.6: "111 modules + 89 tests" → **"115 modules + 85 tests"** (`git ls-files src/lib | grep -c '\.test\.ts$'` → 85; `-v` → 115; 4-way split: direct 83+79 tests, subdir 32+6 tests) · "79 direct modules" → **83** · added the one unnamed direct module `server-spec.ts` (diff loop: all 83 live names vs region 412-475 → only `server-spec` missing) with its real purpose ("the ONE runtime-assembled `*.server.*` specifier helper, A1-12", `src/lib/server-spec.ts:1-17`) · stray-temp note: "(+1 tracked stray temp artifact…)" → "the flagged `auth/.hermes-tmp.*` stray temp is no longer tracked — `git ls-files src/lib | grep -i tmp` is empty" (rc=1).
- §10.7: "45 tracked = 24 tools + 21 tests" **verified live** (`git ls-files scripts | grep -c '\.test\.mjs$'` → 21; 45−21=24) — no change needed.
- §10.8: eval-corpus "(15)" → "(23)"; **7 → 11 brief fixtures** + **7 → 11 graders** (all 11 fixture names listed: arcade-breakout, coffeehouse2home-property-ledger, date-rrule-library, field-ops-suite, house-flip-manager, invoice-csv-cli, order-webhook-service, permit-inspection-tracker, real-estate-crm, rental-portfolio, showing-booking); eval-out 345 ✓ (19 top-level tree dirs re-derived).
- §10.9: "(429 tracked)" → "(450 tracked)"; prose "(295–296 arrive untracked from the live tail waves)" → "the `295`–`301` tail set (wave-41/42 logs + probes) is tracked too — `302`–`303` arrive untracked from the live W42 tail" (`git ls-files fixes | grep -E '^fixes/(29[5-9]|30[0-9])'` → 33 files, 295…301 tracked).
- §10.2 set-diff: `for f in $(git ls-files | grep -v /); do grep -qF "$f" <§10.2 region>; done` → **0 MISSING** (all 42 named).
- Post-grep: `grep -nE "1,715|1,391|\| 429 \||111 modules|89 colocated" README.md` → **0 hits**.

### L3-D2 · START-HERE counts
- :26 `src/lib/` 191 → **200 files** · :28 + :91 "37 verbs" → **39 verbs** · :29 `scripts/` (40) → **(45)** · :30 `fixes/` (300+) → **(450)** · :31 `wave_plans/` (93) → **(105)** + range `W4→W32` → `W4→W40` · :33 `eval-corpus/` (15) → **(23)** + "7 brief fixtures" → "11".
- Done-when grep `191 files|37 verbs|(40)|(93)|(15)|300+` → **0** (rc=1).

### L3-D3 · docs-FOLDER-MAP
- src (201)→**(210)** · lib (191)→**(200)** · llm (7)→**(8)** · scripts (40)→**(45)** · verbs 37→**39** · migrations (1)→**(2)** (+ `0002_account_unique.sql` named; real file: `migrations/auth/0002_account_unique.sql`) · research (468)→**(476)** · eval-corpus (15)→**(23)** + 7→**11** fixtures · fixes (~342)→**(450)** · wave_plans (93)→**(105)** + `W4→W32`→`W4→W40` + (28 dirs)→**(35 dirs; no W25)** (`git ls-files wave_plans | grep -oE '^wave_plans/W[0-9]+' | sort -u | wc -l` → 35). Post-grep stale → 0.

### L3-D4 · README-cli fidelity pass (6 items; pin suite re-run green after)
1. **§Tests** (:1055+) — two-suite snippet → the REAL two-leg list: `npm test` pair; leg 1 `node --test "scripts/**/*.test.mjs"` (21 contract suites incl. this file's pins; `ls scripts/*.test.mjs` → 21); leg 2 `node --experimental-strip-types --test "src/lib/**/*.test.ts"` (headless + harvest are part of it). Sources: `package.json:23` test script.
2. **Wild dual shape** (:838) — `ok:true` + `error:"…"` example → success shape w/o `error` (detail rides `note`) + a new sentence citing 185-H1. Bytes: CLI `rapidtool-cli.mjs:3340` comment "185-H1: never dual-channel ok:true + error — detail rides as `note`"; success literal `:3331-3343`; failure shape `:3323-3328`.
3. **Missing-module exit 1 → exit 4** (verified arm catches): vault `rapidtool-cli.mjs:2076-2085` · design `:2271-2276` · diagram `:2313-2318` (all `...errCode(err,"RT_E_INTERNAL")` → 4). Agent-contract Exit-1 line drops "missing module"; Exit-4 line now names the vault/design/diagram case.
4. **verifyKind truth** — 5 blocks rewritten from "in flight/NOT on disk" to **SHIPPED** (fixes/216z · T4.1): seam `verifyKindDir` `src/lib/compile-check.server.ts:1566` (scratch copy → `npm ci`/`npm install` → declared build/test; `:1557-1564` contract); CLI flag read `rapidtool-cli.mjs:1184`, call `:1189`, failure flips envelope `ok:false` + `RT_E_VERIFY_KIND_FAILED` `:1191-1195`; code registered with a real meaning at `src/lib/errors.ts:459`. Stale pointers `:1149`/`:770` → `:1184`/`:1566`. Heading + both anchor links "in flight" → "landed"; commands #33 un-commented; error-table row de-"pre-registered".
5. **Approve seat** — Channel A (env token = expected side) + **Channel B (TTY re-entry = presented side)** documented; non-TTY `--i-am-human` refused outright (`rapidtool-cli.mjs:3736-3745`); prompt verbatim `:3720`; "only verb with this requirement" corrected → approve REQUIRES the seat for non-TTY, same claim backs `fixtures --approve`/`edit --write` when `--i-am-human` (`:1320`/`:1833`); honest ceiling line added (accountability control, not a security boundary — mirrors `:3703-3706`).
6. **reject ≥12 chars** documented at commands #4 (bytes `rapidtool-cli.mjs:919-928`, message verbatim, exit 1 `RT_E_VALIDATION`) · **emit `--verify-kind` / `--force`** documented: `--force` = refusal `RT_E_FOREIGN_FILES` without it, foreign files KEPT in place with it (bytes `src/lib/headless.ts:1799-1808` + refusal message verbatim "pass --force to keep" `:1807`); usage line #9 gains `[--verify-kind] [--force]`.

### L3-D5 · docs-module-parity
- `DOCS` += `"START-HERE.md"` (`scripts/docs-module-parity.mjs:34`).
- BEFORE (7 docs): docsScanned **7** · mentions **68** · missingCount **1** = `src/generated.ts` (claimedBy RESUME.md · remainingwaves.md · taskuniverselog.md — **not** my box; recorded).
- AFTER (8 docs): docsScanned **8** · mentions **69** · missingCount **1**, claimedBy unchanged ⇒ **START-HERE contributes 0 missing rows** (its one matched path exists).
- `--self-check`: the `fixtures` block is now computed and emitted ONLY when the flag is passed; label honest ("requested — synthetic fixtures below" vs "not requested (no fixtures computed)"). Verified: without flag → no `fixtures` key; with flag → `fixtures.missingDetected:true / existingNotFlagged:true`. Outputs differ. `node --check` OK.

### L3-D6 · AGENT_GUIDE §4 honest reword
- Intro now names the structured channel ("…or through the structured `ingest` seam (the CLI's `ingest` verb; `report-intake.ts` validates + applies the report)…"); new item **4. Structured ingest (CLI)** with one example line; cites `report-intake.ts` (validate-first `:8-11`, `report-` id + "[agent report]" prefixes, "external report — unverified by engine" footer, `applied:false` duplicate `:12-16`) and the CLI arm's real refusals (`:994-1016` — `ReportRejectedError` → `report.rejected` trail persisted + `RT_E_REPORT_INVALID`/`RT_E_REPORT_PHASE_MISMATCH` exit 1). Items 1–3 (manual / JSON round-trip / cross-tool) untouched.
- Done-when: `grep -n "ingest" AGENT_GUIDE.md` → lines 71 + 83 ✓.

### Recorded observations (NOT edited — outside the card boxes; for the boundary/next docs pass)
- **Error-code table coverage**: README-cli's RT_E table has 18 rows; `ERROR_CODE_DOC` has **34** codes (`grep -oE '^  RT_E_[A-Z_]+' src/lib/errors.ts | wc -l` → 34). CLI-surfaceable codes not in the table: `RT_E_CHECK_FAILED` (documented in the Check section), `RT_E_BUSY`, `RT_E_FOREIGN_FILES`, `RT_E_BUDGET_EXHAUSTED`, … — the intro's "this table mirrors it (one row per code…)" reads as a format note; flagged, not edited.
- **`quarantine.ts` zero consumers**: `grep -rln "quarantine" src/lib scripts | grep -v test` → only `src/lib/quarantine.ts` (its header claims the CLI emit wiring; `grep -i quarantin scripts/rapidtool-cli.mjs` → **0**). README-cli's `--force` text therefore documents the current KEPT-in-place behavior; the R11-f08 lift remains owed (module's own TODO).

### Close evidence
- `node --test scripts/README-cli.test.mjs` → **12/12 pass, 0 fail** (final, foreground; run 3× across the lane).
- Files touched (docs box only): `README.md` · `START-HERE.md` · `docs-FOLDER-MAP.md` · `scripts/README-cli.md` · `AGENT_GUIDE.md` · `scripts/docs-module-parity.mjs` (+ this log). No keyed calls. No src/runtime files touched.

