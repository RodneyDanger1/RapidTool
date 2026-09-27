# 275 — THE ORGANIZER (W32): folder organization, root audit, wayfinding docs

**Lane:** W32 organizer (sibling of 13 LIVE lanes: S1–S5, T1–T5, WDX-1/2/3).
**Started:** 2026-09-26 ~18:0x (HEAD `0f85c32` + ~1,726 uncommitted line-changes across 34 tracked files + 18 untracked paths).
**Contract:** wave_plans/W32/organizer.md — SAFETY CONTRACT §1–4 binding. No commits, no moves under src/scripts/migrations/eval-corpus, deletions only rule-3 (untracked + zero refs + not in lane logs), additive edits only.
**Baseline (recorded):** `git log -1` = `0f85c32`; `git ls-files | wc -l` = 1391; `git status --short | wc -l` = 52 entries (34 M + 17 ?? + …). Diff stat: 34 files changed, 1559 insertions(+), 167 deletions(-).

---

## LOG (chronological, append-only below this line)

### ~18:05 · Recon
- Read `wave_plans/W32/organizer.md` in full. Contract understood.
- Root `ls -la` captured. Root strays seen: `.audit-g2/`, `_el217g.log`, `_tc217g*.log` (×4), `probe*.ts` (×9), `w1-source-project.json`, `build.json`, `agentnotes.md` (612 KB), `arch-e2e.svg`/`flow-e2e.svg`/`phases-e2e.svg`/`design-e2e.html`/`packet-e2e.md`, `vault-e2e/`, `builds/`, `artifacts/`, `attachments/`, `audit/`, `audit-bugs/`, `proposals/`, `review/`, `screenshots/`, `.grok/`, `server/`, `startup.sh`, `AGENTS.project.md` (legacy scaffolding per AGENTS.md).
- Obligation noted (finalsprint.md rules + AGENTS.md): legacy scaffolding `.grok/`, `server/`, `startup.sh`, `AGENTS.project.md` — "Do not delete or extend them until [keep-or-descope] lands" → NOT deletable this wave regardless.
- Live lane logs enumerated (untracked): `fixes/271_lane{B,D,E1,H,P,S,U}*`, `fixes/272_s{1,3,5}*`, `fixes/274_wdx1.md`. `fixes/273_*` does not exist yet.

### ~18:12 · Command verification (the read-only set — run one-at-a-time to spare this memory-tight box)

| Command | Result (verified by running it 2026-09-26) | Notes |
|---|---|---|
| `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor` | **exit 0**, ~4.3s, single JSON object — `autonomousSoftwareFactory:false` + 4 named `gaps[]`; `runner.sandbox:false`; `llm.configured:false` | ran from repo root; the anchor command START-HERE prints |
| `npm run typecheck` | **runs; exit 2 mid-wave — RED from live lanes' in-flight edits, NOT from this lane**: `codegen.server.ts` missing `p6TokenCapFromEnv`/`emptyLedger` (S3 ledger WIP), `headless.test.ts` `null` vs `undefined` on `PhaseRecord` (E1 lane), `llm.test.ts`+`registry.test.ts` `"probe-model-id"` literal (P lane). ~75s. No fix attempted (not my box; lanes own those files). | expect red while 13 lanes edit; the boundary gate is the authority |
| `npm run lint` | **exit 0**, 1 warning `scaffold.ts:2195 'kindHandoff' unused` (lane WIP; AGENTS.md: "watch the warning"). ~61s | |
| `npm test` | **NOT RUN here** — it is the full-gate test leg ("NO full gates" is binding while lanes edit). Command definition unmodified (`package.json:19`): scripts leg then src leg. Last full-gate green: W12 boundary, `fixes/218` §5 (scripts 261/261 + src 1957/1957). | START-HERE prints it with this honest note |
| `npm run eval` | **NOT RUN** — live runs need `--keyed` + `DEEPSEEK_API_KEY` (account unfunded → 402); even the keyless floor **rewrites tracked artifacts** (`research/eval-out/results.json`, `history.json`) → would dirty the tree mid-wave (`run-eval.mjs` header). | |
| `bash scripts/gate.sh` | **NOT RUN** (boundary-only; typecheck→lint→scripts→src→build + JSON verdict) | |

Decision recorded for the watchdog: typecheck/lint are the repo's *day-to-day* gates (lanes run them constantly, read-only to files); the binding prohibition is the FULL gate (`gate.sh` / `npm test` / `build`) mid-edit — none of those were run. Delete-safe set below is empty, so `git status` file counts must NOT drop from my actions.

### ~18:15 · Root audit — every root entry classified (git ls-files + ls -la)

Legend: **T**=tracked (delete = commit → propose-only), **I**=ignored/untracked, **P**=protected legacy scaffolding (AGENTS.md: do not delete until 94 §B1/96 lands).

**Root files — evidence items (T, propose-only):**

| Item | Size | Why it stays (evidence) | Proposed fate |
|---|---|---|---|
| `agentnotes.md` | 600K | working doc, 10+ refs | attic (see future items) |
| `build.json` | 56K | 96:345 "the fresh E2E artifact", 22 refs | attic |
| `w1-source-project.json` | 68K | cited CLI input, `219a_inventory_and_reality.md:323` | attic |
| `probe_h1_libcrash.ts`, `probe-h3-tap.ts`, `probe-h3-tap-crash.ts`, `probe-h3-balance.ts` | 0.5–9K | recent investigation probes (H-lane evidence) | attic (after refs checked) |
| `probe-b2-before.ts`, `probe-b2-runspec.ts`, `probe-b2-tree.ts` | 1–2K | re-runnable before/after evidence for `fixes/144_m2_b2` | attic |
| `probe-r5-misc.ts`, `probe-r5-vector.ts` | 3–6K | cited by `103_feature_gaps.md:94` + `90_LEAPFROG.md:991` | attic (keep refs valid) |
| `arch-e2e.svg`, `flow-e2e.svg`, `phases-e2e.svg`, `design-e2e.html`, `packet-e2e.md` | 8–23K | committed E2E artifact set; `96:322` cites `packet-e2e.md` | attic |
| `.node_modules.lock` (0 B) | — | referenced `fixes/247_lane5_infra.md` | leave to infra |

**Root files — ignored/untracked (KEEP every one; rule-3 test in next section):**
`_el217g.log`, `_tc217g.log`, `_tc217g_run2.log`, `_tc217g_run3.log`, `_tc217g_run4.log` · `.env`, `.env.bak-20260916-172737` · `.grok/preview.log` · `.hermes/environment.json` · `.rapidtool/logs/rapidtool.ndjson` (964K).

**Root dirs (all contain tracked content; none is stray junk):**
`.audit-g2/` (1, probe.mjs) · `artifacts/` (1, imagine_images jpg) · `attachments/` (1, RapidTool_Complete_Master.md) · `audit/` (3) · `audit-bugs/` (5) · `builds/` (50 — incl. `builds/vault.md/`, a tracked *directory* of 48 vault-dump notes) · `proposals/` (3) · `review/` (3) · `screenshots/` (16, 1.1M) · `vault-e2e/` (47) — historical wave outputs, "organized not stray" (B3 precedent) → **propose attic/consolidation only**. `public/` (10) + `.github/` (1 workflow) + `server/` (2) + `migrations/` (1 sql) — functional. `.grok/` (89), `server/`, `startup.sh`, `AGENTS.project.md` — **P, untouched**. `node_modules/`, `.vercel/`, `.tanstack/`, `dist/` — ignored by design.

**Root scratch/artifact files re-verified absent** (W24 sweep held): `rt_lib2.log`, `debug.log`, `probe2-4.test.ts` — all gone.

### Deletion set: **EMPTY** — rule 3 applied to every untracked candidate (all FAIL the zero-references test or are protective)

1. `_el217g.log` + `_tc217g[_run2/3/4].log` (I) — **referenced** as run-evidence in `fixes/217g_console_s1_bugs_and_compaction.md:178-221`; B3 kept them for the evidence chain (`fixes/263_lane3_organize.md:27-28,81`). Reference test FAILS → keep.
2. `.env`, `.env.bak-20260916-172737` (I) — secrets / local secret backup; deleting one is not junk cleanup (do-less rule) → keep.
3. `.rapidtool/logs/rapidtool.ndjson` (I, 964K) — the documented runtime telemetry store (`diagnose` reads it back) → keep (rotation proposed in future items).
4. `research/eval-out/_keyed-run.log` (I) — referenced by 10+ docs/lane logs → keep.
5. Emitted-tree internals `research/eval-out/**/.rapidtool/logs/*.ndjson` (I) → keep.
6. `.grok/preview.log` (I) — inside protected legacy dir → keep.
7. `fixes/.hermes-tmp.ACROWI` — **tracked** (temp junk from a Sep-6 tool run, indexed at `263_index.md:304`) → NOT deletable this wave (tracked = commit); added to future items.
No untracked + zero-reference + not-in-lane-log file exists at the root or anywhere in the tree today: **0 deletions performed**, which is the correct outcome under rule 3 (the sanctioned-deletion allowance is a permission, not a quota).

### ~18:18 · .gitignore audit (proposals only — NOT applied, per "propose, don't force")

Verified working (samples): `*.log` → `.gitignore:15` · `.env.bak-*` → `:12` · `.probe-tmp/` → `:18` · `.rapidtool/logs/` → `:20` · `**/.rapidtool/logs/` → `:23` (B3's W24 gap-fill, still correct) · `.hermes/` → `:26`. Proposals for the parent (future wave, see ranked list): add `*_scratch/` / `.scratch/`; decide the probe-file policy (probes are currently *tracked evidence by convention*, so `probe*.ts` ignore would contradict lanes — a decisions item, not a mechanical add); optional `.attick/`-style ignore once the attic move lands. Nothing forced.

### ~18:25 · Docs written this lane (each verified after write)

| Deliverable | Path | Result |
|---|---|---|
| Wayfinding entry point | `START-HERE.md` (new, root, untracked) | 9,300 B — every command inside was **executed** (verification table above); honest-state block dated; read order per `wave_plans/W32/organizer.md` |
| Depth-2 folder map | `docs-FOLDER-MAP.md` (new, root, untracked) | 7,600 B — generated from `git ls-files` (per-node tracked counts recorded) + spot-reads; includes navigation quick-answers + naming conventions |
| Index refresh | `fixes/263_index.md` (tracked → ` M`) | regenerated via **B3's documented mechanism** (its own generator, re-run — adapted copy at `C:/Users/mnril/w32org_scratch/gen-index.mjs`); **superset verified: `comm -23` shows 0 old links lost**; 300→342 fixes links, 21→28 wave dirs; old snapshot kept at `C:/Users/mnril/w32org_scratch/263_index.old.md`; recoverable via `git show HEAD:fixes/263_index.md` |
| Index note | `wave_plans/README.md` (tracked → ` M`) | append-only dated section (W27–W32 index + pointer to `fixes/263_index.md`); original convention text untouched |

No other tracked file touched; no deletions; no moves; no commits. (My adds are untracked, so `git ls-files` must stay 1391.)

---

## THE FUTURE-ITEMS LIST (deliverable 5) — ranked reorganization for a post-boundary, codemod-backed wave

**Preconditions for EVERY item:** all lanes stopped + boundary commit landed + full gate green on the frozen
tree. Every move runs as a codemod script: `--dry-run` → update refs → full gate → ONE commit. Reference
rule: **append-only logs (`fixes/**`, `wave_plans/**`) are historical records — they may keep stale paths**;
only living docs, code, and config must be updated. Refs to grep before any move:
`grep -rn "<name>" --include='*.md' --include='*.mjs' --include='*.ts' --include='*.json' . --exclude-dir=node_modules`

**Rank 1 — Root evidence → `attic/` (pure moves; the biggest "reads professional" win).**
Carve `attic/` with subdirs and move these tracked root entries (update refs in living docs in the same commit;
the ~8 evidence logs cited by `fixes/217g` may keep their relative names in the HISTORICAL logs — add one line
to the boundary landing record naming the new paths, closing the chain):

| Move | From | To |
|---|---|---|
| probes | `probe_h1_libcrash.ts`, `probe-h3-tap.ts`, `probe-h3-tap-crash.ts`, `probe-h3-balance.ts`, `probe-b2-before.ts`, `probe-b2-runspec.ts`, `probe-b2-tree.ts`, `probe-r5-misc.ts`, `probe-r5-vector.ts` | `attic/probes/` |
| e2e artifacts | `arch-e2e.svg`, `flow-e2e.svg`, `phases-e2e.svg`, `design-e2e.html`, `packet-e2e.md`, `build.json`, `w1-source-project.json` | `attic/e2e/` |
| run logs (untracked; move = plain `mv`, then add the boundary note) | `_el217g.log`, `_tc217g.log`, `_tc217g_run2.log`, `_tc217g_run3.log`, `_tc217g_run4.log` | `attic/logs/` |
| notes | `agentnotes.md` | `attic/agentnotes.md` |
| historical dirs | `builds/`, `vault-e2e/`, `screenshots/`, `review/`, `proposals/`, `audit/`, `audit-bugs/`, `.audit-g2/`, `artifacts/`, `attachments/` | `attic/<same names>/` (rename `builds/vault.md/` → `builds/vault-notes/` in transit — a directory named `*.md` breaks editor/tooling expectations) |
| delete in same commit | `fixes/.hermes-tmp.ACROWI` | — (tracked temp junk; last orphan in the index) |
| gated on the 94 §B1/96 descope decision | `.grok/` (89) · `server/` (2) · `startup.sh` · `AGENTS.project.md` · `public/__grok/` (8) · `scripts/grok-pwa-*` (4 incl. tests) | delete or `attic/legacy/`; then drop the README/AGENTS "legacy scaffolding" caveats |

Refs known to need updating: `README.md`, `AGENTS.md`, `AGENT_GUIDE.md`, `RESUME.md`, `research/multiagent/96`, `103`, `90_LEAPFROG.md:991`, `219a:323`, `.gitignore` (nothing added except possibly `attic/` is fine to keep TRACKED — it is evidence, not junk), and `taskuniverselog.md`. Verify: root `ls -la` shows only the professional set (docs, config, functional dirs) + `attic/`.

**Rank 2 — `src/lib/` cluster split (191 flat files → core + clusters; codemod + freeze required).**
Keep the contract-core flat at `src/lib/` root: `engine.ts`, `phases.ts`, `dod.ts`, `store.ts`, `io.ts`,
`packet.ts`, `errors.ts`, `types.ts`, `report-intake.ts`, `headless.ts`, `scaffold.ts`, `policy.ts`,
`algorithms.ts`, `brief-fixtures.ts`, `fixtures*.ts`. Move (with their `*.test.ts`):
- `deepseek.server.ts` → `llm/deepseek.server.ts` (it is a re-export shim into `llm/providers/`; keep the re-export list at its `:22-39`)
- `node-runner.server.ts` → `runner/`
- `compile-check.server.ts`, `verify.server.ts`, `maker-score.ts` → `verify/`
- `rt-events.ts`, `rt-ring.ts`, `rt-client.ts`, `watchdog.ts`, `diagnose.ts`, `runtime-log.server.ts` → `telemetry/`
- `design.ts`, `diagram.ts`, `chat.ts`, `chat.server.ts` (+ tests) → `surfaces/`
- `harvest.ts`, `knowledge.ts`, `vault.ts`, `ast-mine.ts`, `swarm.ts`, `bench.ts`, `prompt-engine.ts`, `crew.server.ts` (+ crew\*) → `pillars/`

Codemod must handle: relative imports WITH explicit `.ts` suffixes; `@/lib/...` alias specifiers; dynamic
`import("...")` string literals — including the split-literal trick (`"./head" + "less.ts"` pattern in the
wild seam); `scripts/run-eval.mjs`'s `LIB_DIR`-relative filenames (`P6_DS_SPEC` at `:996-998`, the
`liveLayer` probe at `:1237`); any fixture path strings. Verify: `typecheck` + both test legs + build +
keyless CLI smoke (`doctor` → `create` → `emit`) + `bash scripts/gate.sh --double`.

**Rank 3 — `scripts/` splits (keep every documented entry path stable).**
- `scripts/rapidtool-cli.mjs` (3,468 lines, 37 verbs) → thin dispatcher + `scripts/cli/verbs/<verb>.mjs` + shared `scripts/cli/lib/`. **Trap:** `scripts/README-cli.test.mjs` doc-tests the README's "**37 subcommands**" claim and the `grep -c 'case "'` count **against this very file's source** — the dispatcher must preserve a one-`case`-per-line source readable by that test, or test + README must be updated in the same commit.
- `scripts/run-eval.mjs` (2,800 lines) → `scripts/eval/` modules with `run-eval.mjs` kept as the entry (referenced by `package.json:21` and docs).
- `src/components/console.tsx` (6,668 lines) → `src/components/console/` pane modules; keep the exported component surface + tab registry identical (UI contract).
- Move the index generator INTO the repo: `C:/Users/mnril/w32org_scratch/gen-index.mjs` (the W32-refreshed copy) → `scripts/gen-index.mjs` + `"index:refresh"` npm script. It currently lives outside the repo — a repo-quality gap.

**Rank 4 — Docs consolidation + wave_plans archive (low risk; do at any boundary).**
- **Do NOT move** `AGENTS.md`/`RESUME.md`/`taskuniverselog.md`/`remainingwaves.md`/`README.md` — they are mandatory-read contract paths; moving them breaks every session's read order.
- Doc-truth pass instead: append dated "superseded-by" headers — `RESUME.md` + `taskuniverselog.md` (both 2026-09-16 snapshots) → point at `finalsprint.md` + the register; `remainingwaves.md` (W5→W12 horizon) → mark the consumed horizon. Then AGENTS.md's read-order table can name `START-HERE.md` as the cold-start entry.
- Archive: `wave_plans/W4…W15` (**80 files**) → `wave_plans/archive/` in one move; FIRST teach `gen-index.mjs` to skip/recurse `archive/` (it enumerates top-level dirs as waves today), THEN regen `fixes/263_index.md`.
- `fixes/` itself stays flat forever (the numbering IS the index; append-only culture).

**Rank 5 — Mechanical hygiene.** `.rapidtool/logs/rapidtool.ndjson` (964K) → size-capped rotation
(~5MB, keep N) · `.gitignore` additions `*_scratch/` + `.scratch/` (proposal; probe-file policy stays
"tracked evidence" until the parent decides) · `package.json` name `"app-builder-workspace"` → `"rapidtool"`
(+ lockfile sync) · CI: enable the commented `windows-leg` in `.github/workflows/gate.yml` only after a
first green remote run (the file's own honest note).

**Rank 6 — Content (NOT reorganization; listed so it is not confused with the above).** The real
capability work stays where `finalsprint.md` + `remainingwaves.md` + the register's IDs point; nothing
here should be done before those.

---

### Closing record (W32 organizer, for the watchdog to verify against bytes)

- **HEAD:** `0f85c32` unchanged — no commits. **`git ls-files | wc -l`:** 1391 → 1391 (my adds are untracked).
- **`git status` count:** 52 at lane start → 97 at lane end; delta = live-lane churn (continuously landing docs/code) + **5 sanctioned additions of mine**: `START-HERE.md` ?? · `docs-FOLDER-MAP.md` ?? · `fixes/275_organizer.md` ?? · `fixes/263_index.md` M · `wave_plans/README.md` M. **ZERO file-count drops from my actions.**
- **Deletions:** 0 (delete-safe set empty, §Deletion set). **Moves/renames:** 0. **Lane files touched:** none.
- **Lane files read (to build the audit):** all of `fixes/271_*`, `fixes/272_*`, `fixes/273_*`, `fixes/274_*` (headers/first lines) + `fixes/275_watchdog_organizer.md` + precedents `fixes/263_lane3_organize.md`.
- **Re-run helpers:** index refresh = `node "C:/Users/mnril/w32org_scratch/gen-index.mjs"`; old index snapshot = `C:/Users/mnril/w32org_scratch/263_index.old.md`; link-set diff files = `old.links` / `new.links` in the same dir.
- **Ambiguities resolved by "do less":** (1) `npm test` not run mid-wave (full-gate rule > literal command-verification list; recorded); (2) `.env.bak` kept; (3) `probe*.ts` kept (tracked + referenced); (4) `.gitignore` proposals recorded, nothing forced; (5) index refreshed by regeneration (the file's documented mechanism) with superset proof.

### Final verification pass (~18:40)

- **Index link integrity:** 439 links in the regenerated `fixes/263_index.md`, **0 broken** (programmatic check resolving every link relative to `fixes/`).
- **Search-and-verify count corrections** (made after re-counting bytes): probes ×8 → **×9**; corpus briefs 8 → **7** — corrected in `START-HERE.md`, `docs-FOLDER-MAP.md`, and this log.
- **Final bytes:** `START-HERE.md` 9,300 B · `docs-FOLDER-MAP.md` 7,600 B · `fixes/275_organizer.md` ~18 KB · `fixes/263_index.md` (342 fixes links · 28 wave dirs) · `wave_plans/README.md` (+~700 B appendix).
- **Final counters:** HEAD `0f85c32` ✓ (no commit) · `git ls-files` 1391 ✓ · `git status` 52 → 103 — **increases only** (13 lanes' continuous landings + my 5 sanctioned changes: 3 new untracked docs + 2 tracked index refreshes); zero drops.
- **Scratch (outside the repo, per convention):** `C:/Users/mnril/w32org_scratch/` = `gen-index.mjs` (W32-refreshed generator) · `263_index.old.md` (pre-refresh snapshot) · `old.links` / `new.links` (superset diff evidence).
