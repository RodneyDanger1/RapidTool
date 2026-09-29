# fixes/304_d3_docs.md — LANE L3 ROUND 2 · DOCS (coder D3)

> Card: W42 post-C-wave round 2 (parent brief). File box: docs only — `README.md` · `START-HERE.md` ·
> `docs-FOLDER-MAP.md` · `scripts/README-cli.md` · `AGENT_GUIDE.md` · `scripts/docs-module-parity.mjs` (+ this log).
> HEAD at lane start: `8418b04` (+ untracked round-2 lane logs). No keyed calls. PATCH-FIRST. Legs FOREGROUND.
> Sibling boxes (read fresh via their 304 logs): D1 = run-eval/scorecard/fixtures · D2 = packet/crew/io/planning/store.test ·
> D4 = scripts guards + `rapidtool-cli.mjs` + `headless.ts` + `package.json`. No sibling touches a docs file.

## t0 — outcomes

| # | Item | Status | Headline evidence |
|---|---|---|---|
| 1 | C3-find (a): 34-code registry ⇄ README-cli error table | **LANDED — 18 → 34 rows, exact registry order** | `grep -c '^| \`RT_E_' scripts/README-cli.md` → 34; order == `ERROR_CODE_DOC` (script check: 34/34 exact); `node --test scripts/README-cli.test.mjs` → **12/12** |
| 2 | C3-find (b): `quarantine.ts` zero consumers | **BLOCKER recorded + docs made honest** (the wire's call site is D4's box this round — SPEC §2.0 L4 sole writer; no cross-lane tree write) | t3 + "FOR L4/D4" section |
| 3 | Census re-derive post-C-wave | **LANDED — all moved numbers re-patched** (fixes 450→456 · total 1,754→1,762 · src 210→211 · wave_plans 105→106 / dirs 35→36 · §10.6 tests 85→86) | t1 (every number by its own command) |
| 4 | README-cli classifier paragraph | **LANDED — stale signal list corrected** (errno families + thrown-code passthrough were missing from the "small set of signals" prose) | t2 |

## t1 — census re-derive (every number by its own command; cwd = repo root; run 2026-09-29 @ `8418b04` + working tree)

| # | Number | Command (as run) | Output | vs C3 @424f9e5 |
|---|---|---|---:|---|
| 1 | total tracked | `git ls-files \| wc -l` | **1762** | 1754 (+8) |
| 2 | root files | `git ls-files \| grep -v / \| wc -l` | **42** | 42 ✓ |
| 3 | fixes/ | `git ls-files fixes \| wc -l` | **456** | 450 (+6) |
| 4 | research/ | `git ls-files research \| wc -l` | **476** | 476 ✓ |
| 5 | src/ | `git ls-files src \| wc -l` | **211** | 210 (+1) |
| 6 | wave_plans/ | `git ls-files wave_plans \| wc -l` | **106** | 105 (+1) |
| 7 | scripts/ | `git ls-files scripts \| wc -l` | **45** | 45 ✓ (24 tools + 21 tests re-verified) |
| 8 | migrations · .grok | `git ls-files <dir> \| wc -l` | **2 · 89** | ✓ |
| 9 | src/lib split | tests `grep -c '\.test\.ts$'` · modules `grep -c -v` | **86 · 115** (Σ 201) | 85 · 115 |
| 10 | src/lib 4-way | direct tests `grep -cE '^src/lib/[^/]+\.test\.ts$'` → 80 · direct modules 83 (162 direct `.ts` + `error-component.tsx`) · subdir 38 files (auth 19 · app-data 7 · llm 8 · multiplayer 2 · og 1 · testing 1) = 32 modules + 6 tests | **83+80 · 32+6** (Σ 201) | 79/83/32/6 |
| 11 | verbs | `grep -c 'case "' scripts/rapidtool-cli.mjs` | **39** | ✓ |
| 12 | wave_plans dirs | `git ls-files wave_plans \| grep -oE '^wave_plans/W[0-9]+' \| sort -u \| wc -l` | **36** (W4–W24 · W26–W38 · W40 · W42; no W25) | 35 |
| 13 | §10.1 other rows | builds 50 · vault-e2e 47 · screenshots 16 · public 10 · audit-bugs 5 · audit/review/proposals **3+3+3** · server 2 · .github 1 · attachments/artifacts/.audit-g2 **1+1+1** · .t4scratch 192 (all `git ls-files <dir> \| wc -l`) | all **✓** | ✓ |
| 14 | research split | multiagent 103 · eval-corpus 23 · eval-out 345 · top-level 5 | **Σ 476 ✓** | ✓ |
| 15 | what moved | `git show 8418b04 --stat` — added `src/lib/scorecard.test.ts`, `wave_plans/W42/SPEC.md`, `fixes/302_eng_help+review`, `fixes/303_c1..c4` | +8 files = 1762 | — |

**Post-C-wave delta explained:** 450→456 fixes = the six C-wave logs (302 eng pair + 303_c1…c4); 105→106 = `W42/SPEC.md` now tracked (dirs 35→36); `src/` 210→211 = the NEW `scorecard.test.ts` (src/lib tests 85→86; direct tests 79→80; modules still 115).

## t2 — D-1 · the 34-code registry sync (`scripts/README-cli.md`, box mine)

- **Before:** table `## Error codes (RT_E_*)` had **18 rows**; `ERROR_CODE_DOC` (`src/lib/errors.ts:362+`, canonical) has **34 codes** (`grep -c '^  RT_E_' src/lib/errors.ts` → 34). The intro already claimed "this table mirrors it (one row per code…)" — made TRUE.
- **Landed:** +16 rows, in registry order (2 inserted mid-table, 14 appended):
  - inserted after `RT_E_RUNNER_FAILED`: **`RT_E_CHECK_FAILED`** (exit cell `1 (emit --check / \`check\`)` — CLI `:1207`/`:1241` + `:2201`).
  - inserted after `RT_E_LLM_REJECTED`: **`RT_E_LLM_NO_BALANCE`** (`4 (crew/verify backend)` — crew arm `:2124` backend→4; provider map `deepseek.ts:495`).
  - appended after `RT_E_VERIFY_KIND_FAILED`: `RT_E_BUDGET_EXHAUSTED` (`4 (crew/engine budget stop)`) · `RT_E_ABORTED` (`1 (chat abort; signal stamps exit 130/143)` — `chat-stream.test.mjs:33`; `rapidtool-cli.mjs:570-577`) · `RT_E_BUSY` (`1 (emit/save lock refusal)` — emit arm `:1157`) · `RT_E_FOREIGN_FILES` (`1 (emit --force refusal)` — consistent with `:389`) · `RT_E_PERMISSION_DENIED` · `RT_E_DISK_FULL` · `RT_E_PORT_IN_USE` · `RT_E_NETWORK_UNREACHABLE` (all four `1–4 (classified in place)` — the W12 classifier maps errno, the arm keeps its exit) · `RT_E_GIT_UNAVAILABLE` · `RT_E_UNATTENDED_UNSUPPORTED` · `RT_E_NOT_IMPLEMENTED` · `RT_E_MCP_DISABLED` (all four `— (no live emitter today …)`: verified by `grep -rn` — git.server has no runtime consumer; unattended/NOT_IMPLEMENTED/MCP_DISABLED have no emitter outside `errors.ts`+console) · `RT_E_CHECKPOINT_MISSING` (`1 (resume/unattended re-entry)` — `:773`/`:792-795`) · `RT_E_AUTH_SCHEMA_MISSING` (`1 (migrate/build preflight)` — `migrate.mjs:65-68`)`.
- **Intro paragraph** (`:931-943`): replaced the stale "deliberately small set of signals (ENOENT, abort/timeout, report rejection)" list with the real classifier surface — thrown `RT_E_*` passthrough, `ENOENT`, abort/timeout, report-rejection, errno families, `JSON.parse`→VALIDATION — and added the `emit`/`check` refusal codes to the CLI-subset sentence. Table claim now: "this table mirrors it — the full registry, one row per code".
- **Test pins kept green:** `README-cli.test.mjs` reads before edit; ran after → **12/12 pass**. None of its pins touch the error table; the `countClaimOffenders` scan (N + verbs/subcommands) has no new matches.
- **Verification (post-edit):** `grep -c '^| \`RT_E_' scripts/README-cli.md` → **34**; script check → row order == `ERROR_CODE_DOC` order, **34/34 exact**.

## t3 — D-2 · quarantine zero-consumers: **precise blocker** (wire not landable from L3)

Bytes re-verified 2026-09-29 @ `8418b04`:
- `grep -in "quarantine" scripts/rapidtool-cli.mjs` → **0** (exit 1). `grep -rln "quarantine" src scripts` → `src/lib/quarantine.ts` + `quarantine.test.ts` + a word-hit in `migration-plan.mjs` (unrelated).
- `grep -n "EMIT_SKIP_DIRS" src/lib/headless.ts` → `:1568` = `new Set(["node_modules", ".git", ".vercel"])` — `.rapidtool-quarantine` is **NOT** added (the module header's own note says it must be, for the later lift).
- So: module + test exist, zero consumers; CLI emit arm (`rapidtool-cli.mjs:1094-1248`) never calls it; `headless.ts:1851` still `survivors: opts.force === true ? foreign : []` (kept in place). README-cli `:388-390` documents KEPT-in-place — honest to today's bytes (unchanged, correct).
- **Why no wire by D3:** the seam's call sites are `scripts/rapidtool-cli.mjs` (emit arm) + `src/lib/headless.ts` (EMIT_SKIP_DIRS / lift) — both are **D4's sole-writer box this round** (SPEC §2.0; D4's `304_d4_misc.md` box list). Writing them from L3 would violate the strict disjoint-ownership rule mid-fleet. Recorded here with the exact patch spec instead.

**FOR L4/D4 (or next wave) — the ready-to-land wire (smallest, per fixes/272 §[2]):**
1. `scripts/rapidtool-cli.mjs` emit arm: after `const res = await h.emitProject(...)` and the `!res.ok` guard (`:1152-1159`), when `Array.isArray(res.survivors) && res.survivors.length > 0` → lazily import `../src/lib/quarantine.ts` (same `pathToFileURL` mechanics as `driver()`), `await quarantineFiles(target, res.survivors)`, add `payload.quarantined = moved.moved` + `payload.quarantineDir = moved.quarantineDir`; a failed move flips `ok:false` + `RT_E_FOREIGN_FILES` (module never silently drops).
2. `src/lib/headless.ts` `EMIT_SKIP_DIRS` `:1568` += `".rapidtool-quarantine"` (repeat emits never re-judge the quarantine as foreign leftovers).
3. Docs follow in the same commit (mine to hand over): README-cli `:388-390` "with it the foreign files are KEPT in place" → "moved aside into `<dir>/.rapidtool-quarantine/<stamp>/` and reported (`quarantined` + `quarantineDir`)". README.md:239 / START-HERE:100 already bucket R11-f08 under "Shelled / in progress" (accurate; keep).
4. The full lift (quarantine INSIDE `emitProject` so every forced caller quarantines) stays deferred — "headless.ts is E1b's window" (fixes/272 §[2]).

**Docs-side honesty landed instead (in-box):** `README.md:431-432` requalified — was "`quarantine.ts` (forced-emit quarantine move — foreign files moved aside, R11-f08)" (asserted behavior) → now "`quarantine.ts` (the forced-emit quarantine-move **seam** — module + test landed; **CLI/headless wiring owed**, R11-f08)".

## t4 — count patches landed (all four docs; every anchor asserted unique before write)

- `README.md`: `:293` "(1,754 today)"→"**(1,762 today)**" · `:296` "2026-09-28: … = **1,754**"→"2026-09-29: … = **1,762**" · `:302` HEAD `424f9e5`→`8418b04`, "re-derived 2026-09-28"→"2026-09-29" · `:305` §10.1 heading → "re-derived 2026-09-29 at `8418b04`" · `:310` fixes 450→**456** · `:311` src 210→**211** · `:312` wave_plans 105→**106** + "…W40 · W42" · `:327` Total 1,754→**1,762** · `:410` §10.6 "(200 files = 115 modules + 85…re-derived live 2026-09-28)"→"**(201 files = 115 modules + 86 … 2026-09-29)**" · `:412` "re-counted 2026-09-28"→"2026-09-29" · `:477-478` "**86 colocated test suites** … `= 85)`"→"`= 86)`" · `:489` test-name list += `scorecard` · `:590` §10.9 "(450 tracked)"→"**(456 tracked)**" · `:600-602` tail prose → "the `295`–`303` tail set (… + the eng-review pair + the C-wave lane logs) is tracked too — `304_d1`–`304_d4` arrive untracked from the live W42 round-2 tail" · `:606` §10.10 heading (105→**106**, +W42) · `:611` "W4–W24 + W26–W38 + W40 + W42 (106 files…)" · `:616` tail += "`W42/SPEC.md`" · `:431` quarantine requalify (t3).
- `START-HERE.md`: `:26` `src/lib/` (200)→**(201)** · `:30` fixes (450)→**(456)** · `:31` wave_plans (105)→**(106)** + `W4`→`W40`→`W42`.
- `docs-FOLDER-MAP.md`: `:11` src (210)→**(211)** · `:12` lib (200)→**(201)** · `:41` fixes (450)→**(456)** · `:43` wave_plans (105)→**(106)**, "W4→W40 (35 dirs…)"→"**W4→W42 (36 dirs**; no W25)".
- Post-grep: `grep -c "1,754" README.md` → **0**; `grep -c "424f9e5" README.md` → **0**; `grep -c "1,762"` → **3**.

## t5 — close evidence

- `node --test scripts/README-cli.test.mjs` → **12/12 pass, 0 fail** (foreground, post-edit; + re-run at close).
- `node --test scripts/cli-exit-taxonomy.test.mjs` → **3/3 pass** (README "Exit 4" sentence + seat pins intact after the README-cli edits).
- `node scripts/docs-module-parity.mjs` → docsScanned **8** · mentions **69** · missingCount **1** (`src/generated.ts`; claimedBy RESUME/remainingwaves/taskuniverselog — not an L3 doc; unchanged from C3's AFTER state).
- Files touched (docs box only): `scripts/README-cli.md` · `README.md` · `START-HERE.md` · `docs-FOLDER-MAP.md` (+ this log). **No `src/`/`scripts/*.mjs`/runtime file touched.** No keyed calls. `AGENT_GUIDE.md` unchanged (no stale claim found for these items).

### Residual notes (for the boundary)
- The 4 `— (no live emitter today …)` rows (GIT / UNATTENDED / NOT_IMPLEMENTED / MCP_DISABLED) are honest as of today; when W-44 (MCP transport), the git landing tail, or any coded-shell seam wires, its row + exit cell must be updated (the table's "one row per code" contract is now enforceable by eye; no test reads this table).
- quarantine lift fully spelled out in t3 — hand to L4/D4 or the next wave that owns `rapidtool-cli.mjs`/`headless.ts`.
- Wave-count prose in README §10.10 now reads W4–W24 + W26–W38 + W40 + W42; re-derive at every boundary (dirs 36, files 106 today).
