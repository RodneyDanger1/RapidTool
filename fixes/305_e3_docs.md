# fixes/305_e3_docs.md — LANE L3 ROUND 3 · DOCS (coder E3)

> Wave W42 post-D round 3 (parent brief). File box: docs — `README.md` · `START-HERE.md` ·
> `docs-FOLDER-MAP.md` · `scripts/README-cli.md` · `AGENT_GUIDE.md` · `scripts/docs-module-parity.mjs`
> + the E3-assigned reconciliation set `RESUME.md` · `remainingwaves.md` · `taskuniverselog.md`
> (+ this log). HEAD at lane start: `0deca1e`, tree clean. No keyed calls. PATCH-FIRST. Legs FOREGROUND.
> Sibling boxes (read fresh): E1/E2/E4 live — E4 owns `scripts/rapidtool-cli.mjs` + `src/lib/headless.ts`
> and lands the quarantine wire (E3 owns the DOC side of it).

## t0 — state at lane start (2026-09-29 @ `0deca1e`, tree clean)

- All 6 D-cards landed in `0deca1e` (registry 34-row sync · quarantine blocker doc'd + wire spec · counts re-derived · D1-D4 code tails).
- `git status --short` → empty. `grep -in quarantine scripts/rapidtool-cli.mjs` → 0 (`src/lib/headless.ts` → 0): the wire is **NOT landed yet** (E4 live).
- `node scripts/docs-module-parity.mjs` → docsScanned 8 · mentions 69 · missingCount **1** = `src/generated.ts`, claimedBy RESUME · remainingwaves · taskuniverselog (the P4-proven lexical false positive — TREE_ENTRY_PATH).
- Work list: (1) `--force` README-cli text (post-wire, both-state safe) · (2) 3-doc `src/generated.ts` reconciliation · (3) SPEC L3 tail re-walk + docs-parity `--self-check` confirm · (4) counts re-derive post-D-rounds · (5) `node --test scripts/README-cli.test.mjs`.

## t1 — evidence (append-only)

### E3-1 · the `--force` README-cli follow-up text (post-wire) — **LANDED**

- **Wire first, docs after** (never wired-before-wired): E4's round-3 wire verified in the working tree @ `0deca1e`+dirty:
  - `grep -n quarantine scripts/rapidtool-cli.mjs` → lazy seam `:275-290` (`QUARANTINE_PATH` `:283` → `../src/lib/quarantine.ts`; `quarantineDriver()` `:287-290`); call site in the `emit` arm `:1203-1224` (payload keys `:1213-1218`).
  - arm bytes: `if (Array.isArray(res.survivors) && res.survivors.length > 0)` → `payload.quarantined = moved.moved;` · `payload.quarantineDir = moved.quarantineDir;` · `quarantineMissing` when non-empty; failed move → `payload.ok=false` + `quarantineFailed` + `code="RT_E_FOREIGN_FILES"`; emit arm closes `respond(payload, payload.ok ? 0 : 1)` ⇒ failure exits 1.
  - `src/lib/headless.ts:1568-1571` — `EMIT_SKIP_DIRS` gains `.rapidtool-quarantine` (`repeat emit never re-judges the quarantine`).
- **Landed text:** `scripts/README-cli.md:388-392` — was "the foreign files are KEPT in place (the refusal message's own \"pass --force to keep\")" → now "moved **aside** into `<dir>/.rapidtool-quarantine/<stamp>/` — recoverable, never deleted, and never judged by a later tree-run — and reported on the envelope (`quarantined` … · `quarantineDir` …). A failed move is loud: `ok:false` + `RT_E_FOREIGN_FILES` with `quarantineFailed` (R11-f08 · W42)." (D3's exact change note, `304_d3_docs.md` t3 item 3, + the failure clause byte-verified.)
- `scripts/README-cli.md:982` — `RT_E_FOREIGN_FILES` row: remedy "intend to overwrite" → "accept the foreign files moving aside …"; exit cell → `1 (emit --force refusal / quarantine move failure)` (failure exit verified at `rapidtool-cli.mjs` emit-arm tail).
- `README.md:431-433` — `quarantine.ts` requalified: "CLI wire landed (W42: `emit --force` moves survivors aside + reports `quarantined`/`quarantineDir`); the in-engine lift for every forced caller owed".
- `README.md:239` + `START-HERE.md:100` — bucket line kept "Shelled / in progress", requalified: `--force` quarantine (R11-f08 — CLI wire landed W42; in-engine lift owed).
- Pin check: `grep -n "force\|KEPT\|quarantine" scripts/README-cli.test.mjs` → **0 hits** (no pin reads this prose); suite green post-edit (E3-5).

### E3-2 · the `src/generated.ts` doc reconciliation (RESUME · remainingwaves · taskuniverselog) — **LANDED**

- **Proof lines (shared by all three edits):** `git ls-files src/generated.ts | wc -l` → **0**; `test -f src/generated.ts` → **ABSENT** (not a repo file); `grep -n TREE_ENTRY_PATH src/lib/codegen.server.ts` → **`1514:export const TREE_ENTRY_PATH = "src/generated.ts";`** (the *emitted* tree's entry; test pin `codegen.server.test.ts:1240` "entry path stable (scaffold fallback host parity)"). The parity finding is the P4-proven lexical false positive: prose mentions of an emitted-tree path, not module claims.
- `taskuniverselog.md:195` — T-04 row: `Declared tree entry src/generated.ts` → **"…(the *emitted* tree's entry path — `TREE_ENTRY_PATH`, `codegen.server.ts:1514`; **not a file in this repo**)…"** (status/evidence cells untouched).
- `remainingwaves.md:72-74` — barrel risk line: → "`src/generated.ts` — the *emitted* tree's barrel path (`TREE_ENTRY_PATH`, `codegen.server.ts:1514`; not a file in this repo)".
- `RESUME.md:249-253` — §3.1 T-04 brief: present-tense stale defect claim ("is refused … dropped in silence") → **"T-04 (✅ landed W2 …)"** with path attribution, refs-as-issued, and the landed fix (`scaffold.ts:296` allow-list `TREE_ALLOWED_FILES`, bytes `:274-296`; loud refusals `:2397` "a refused generatedTree row is NEVER a silent").
- **Parity after:** `node scripts/docs-module-parity.mjs` → docsScanned **8** · mentions **69** (unchanged — attribution used no new `src/…` backticked paths) · missingCount **1** (`src/generated.ts`, claimedBy the same 3 docs — remains as the proven lexical false positive; the script's own header documents this class). Docs now say the truth; no strike needed.

### E3-3 · SPEC · L3 tail re-walk + the docs-parity `--self-check` card — **CONFIRMED, no tail**

- **D1** catalog: root set-diff `for f in $(git ls-files | grep -v /); do grep -qF "$f" README.md || echo "MISS:$f"; done` → **0 MISS** (all 42 named); all §10.1 cells re-derived (E3-4).
- **D2** START-HERE: `grep -n "191 files\|37 verbs\|(40)" START-HERE.md` → no hits (rc=1).
- **D3** docs-FOLDER-MAP: subdir counts live = `auth 19 · app-data 7 · llm 8 · multiplayer 2 · og 1 · testing 1` ✓; src 211 · lib 201 · scripts 45 · verbs 39 · migrations 2 · research 476 (103/23/345/5) · fixes 460 · wave_plans 106 (36 dirs) — all match (§10-region verified in E3-4).
- **D4** README-cli: error table `grep -c '^| \`RT_E_'` → **34** ✓; §Tests real commands on disk (`:1087` `node --test "scripts/**/*.test.mjs"`) ✓; `--force` fidelity now post-wire (E3-1).
- **D5** `--self-check` final state — **landed round 1 (C3, `fixes/303_c3_docs.md` t1·L3-D5); bytes stable today** (`scripts/docs-module-parity.mjs:97-106`): without flag → `"selfCheck": "not requested (no fixtures computed)"` and **no `fixtures` key** (only that label line contains the word); with flag → `"requested — synthetic fixtures below"` + `fixtures.missingDetected:true / existingNotFlagged:true`. Outputs differ ✓.
- **D6** AGENT_GUIDE: `grep -n ingest AGENT_GUIDE.md` → `:71` + `:83` (structured CLI channel named) ✓.

### E3-4 · counts re-derived post-D-rounds — **LANDED (drift fixed)**

Every number by its own command, run 2026-09-29 @ `0deca1e`, cwd = repo root:

| # | Number | Command (as run) | Output | vs D3 (1762-era) | doc action |
|---|---|---|---:|---|---|
| 1 | total tracked | `git ls-files \| wc -l` | **1766** | 1762 (+4) | README `:293` `:296` `:327` patched |
| 2 | root files | `git ls-files \| grep -v / \| wc -l` | **42** | ✓ | — |
| 3 | fixes/ | `git ls-files fixes \| wc -l` | **460** | 456 (+4) | README `:310` `:590` · START-HERE `:30` · FOLDER-MAP `:41` patched |
| 4 | research/ | `git ls-files research \| wc -l` | **476** | ✓ | — |
| 5 | src/ | `git ls-files src \| wc -l` | **211** | ✓ | — |
| 6 | wave_plans/ | `git ls-files wave_plans \| wc -l` | **106** | ✓ | — |
| 7 | scripts/ | `git ls-files scripts \| wc -l` | **45** | ✓ | (24 tools + 21 tests: `grep -c '\.test\.mjs$'` → 21) |
| 8 | migrations · .grok | `git ls-files <dir> \| wc -l` | **2 · 89** | ✓ | — |
| 9 | src/lib split | tests `grep -c '\.test\.ts$'` · modules `-vc` | **86 · 115** (Σ 201) | ✓ | — |
| 10 | src/lib 4-way | direct 80 tests / 83 modules (`grep -cE '^src/lib/[^/]+\.test\.ts$'` + `.ts/.tsx` non-test) · subdir 38 files | **80/83 + 38** | ✓ | — |
| 11 | verbs | `grep -c 'case "' scripts/rapidtool-cli.mjs` | **39** | ✓ | — |
| 12 | wave dirs | `git ls-files wave_plans \| grep -oE '^wave_plans/W[0-9]+' \| sort -u \| wc -l` | **36** | ✓ | — |
| 13 | §10.1 others | builds 50 · vault-e2e 47 · screenshots 16 · public 10 · audit-bugs 5 · audit/review/proposals 3+3+3 · server 2 · .github 1 · attachments/artifacts/.audit-g2 1+1+1 · .t4scratch 192 (`git ls-files <dir> \| wc -l` each) | all ✓ | ✓ | — |
| 14 | research split | multiagent 103 · eval-corpus 23 · eval-out 345 · top-level 5 | **Σ 476 ✓** | ✓ | — |
| 15 | HEAD refs | README `:302`/`:305` | `8418b04` → **`0deca1e`** | moved | patched |
| 16 | §10.9 tail prose | `:600-602` | "`295`–`303` … `304_d1`–`304_d4` untracked" → **"`295`–`304` tracked … `305_*` round-3 lane logs untracked"** | moved | patched |

**Delta explained:** 1762→1766 / 456→460 = the four round-2 lane logs (`304_d1_accept` … `304_d4_misc`) tracked in `0deca1e`. Post-grep: `grep -n "1,762\|456\|8418b04" README.md START-HERE.md docs-FOLDER-MAP.md` → **0 hits**; `grep -c "1,766" README.md` → **3**.

### E3-5 · close

- `node --test scripts/README-cli.test.mjs` → **12/12 pass, 0 fail** (foreground; run post-edit AND again at close).
- `node scripts/docs-module-parity.mjs` (final) → docsScanned 8 · mentions 69 · missingCount 1 (see E3-2).
- Files touched (docs box only): `scripts/README-cli.md` · `README.md` · `START-HERE.md` · `docs-FOLDER-MAP.md` · `RESUME.md` · `remainingwaves.md` · `taskuniverselog.md` (+ this log). **No `src/`/`scripts/*.mjs` runtime file touched**; no keyed calls. Witnessed siblings (read fresh): E4 = wire in `rapidtool-cli.mjs`/`headless.ts`; E2 = `store.test.ts` pin; E1 = verify-only. No file collision at any patch (diffs re-checked per file).

| # | Item (parent brief) | Status | Evidence |
|---|---|---|---|
| 1 | `--force` README-cli follow-up text (post-wire; both-state safe) | **DONE** | E3-1 — wire bytes `rapidtool-cli.mjs:1203-1224` + `headless.ts:1568-1571` read BEFORE the doc flip; text + table row + README/START-HERE qualifiers landed; 12/12 |
| 2 | `src/generated.ts` doc reconciliation (3 docs) | **DONE** | E3-2 — `git ls-files` → 0 / `test -f` → ABSENT / `TREE_ENTRY_PATH` `codegen.server.ts:1514`; 3 docs attributed; parity missingCount 1 = the proven lexical false positive |
| 3 | SPEC L3 tail re-walk + docs-parity `--self-check` confirmation | **DONE** | E3-3 — D1 0-MISS · D2 rc=1 · D3 subdirs ✓ · D4 34 rows ✓ · D5 outputs-differ ✓ (round-1 landing, bytes stable) · D6 `:71`/`:83` |
| 4 | Counts re-derived post-D-rounds; drift fixed | **DONE** | E3-4 — 1766/460 + HEAD→`0deca1e` patched in 4 docs; all other numbers re-verified by their own commands |
| 5 | `node --test scripts/README-cli.test.mjs` ≥12/12 | **DONE** | E3-5 — **12/12 pass, 0 fail** (foreground, twice) |


