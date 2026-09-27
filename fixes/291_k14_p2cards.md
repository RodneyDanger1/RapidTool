# fixes/291_k14_p2cards.md — W40 · LANE K14 · §P2'S CODER CARDS + README-CATALOG FOLLOW-UPS + ORGANIZER STATE

**Lane:** W40 K14 (batch `deleg_2879dda4`, task-4). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell `grep` only).
**Mission:** (1) land §P2's C1–C9 coder cards — VERIFY against bytes first (several may be fixed in `2fa3cd9`/by K-lanes), smallest honest patch per open card; (2) the README-catalog follow-ups beyond K7's two (`fixes/286_readme_catalog.md`): the doc-parity `src/generated.ts` finding + the honesty additions' leftover; (3) the organizer's outstanding state items (`fixes/275_organizer.md`): docs-FOLDER-MAP staleness / untracked-file flags.
**Contract:** CODE + `node --check`; NO gates/keyed calls/full runs; read fresh before every patch (K1–K15 + L1–L3 LIVE — log `for <lane>`); append-only where shared docs; smallest honest patch; evidence = command + observed output.
**Baseline HEAD:** `2fa3cd9` ("W29-W39: the completion era — spine real, gates registered green", 00:56:08) — committed era ⇒ several P2-card "open boxes" may now be closed; re-derive from bytes, never from a card's read-time state.
**Sources:** §P2 cards = `~/AppData/Local/hermes/cache/delegation/subagent-summary-1-20260926_194745_119606.txt` (the C1–C9 byte-verified cards; §P2 itself never landed in `wave_plans/W34/prep.md` — K8 pastes it) · `fixes/286_readme_catalog.md` · `fixes/275_organizer.md` · K-lane logs on disk (k1/k2/k3/k4/k6/k7/k8/k10/k12/k13 + 292 watchers).

## STATE AT LANE START (byte reads, 2026-09-27 ~01:05–01:15)

- `git log -1` = `2fa3cd9`; `git status --short` = 2 modified product files (`src/lib/cassette.ts`, `src/lib/io.ts` — live lanes mid-edit) + untracked lane logs + `fixes/.hermes-tmp.sFg636`.
- `git ls-files | wc -l` = **1678** (the commit swept the era in: 1391 → 1678).
- **Key post-commit fact for part 2:** files README still marks "Untracked" are now TRACKED — verified `git ls-files --error-unmatch`: `START-HERE.md` · `finalsprint.md` · `docs-FOLDER-MAP.md` · `.prettierignore` · `tsconfig.scripts.json` · `migrations/auth/0002_account_unique.sql` · `scripts/path-safety.mjs` · `scripts/docs-module-parity.mjs` · `scripts/cli-exit-taxonomy.test.mjs` · `wave_plans/W38/NEW-SESSION-PROMPT.md` → ALL TRACKED.
- `node scripts/docs-module-parity.mjs` (advisory, read-only) → `missingCount: 1` = **`src/generated.ts`** claimed by `RESUME.md` + `remainingwaves.md` + `taskuniverselog.md` (exists nowhere on disk).
- K-lane collision map (read fresh): K7 owns README §10.6 split + root-35 wording (its 12e/12f) · K11 owns §A2/AGENTS.md lies + doc-parity work IN FLIGHT (transcript 01:12: `M1/M2 AGENTS.md`) · K9 owns universality/output (scaffold/run-eval) · K8 owns records pastes · K10/K12/K13 own engine/store/agents/pipeline · L2 UI · L3 eval. My untouched-earlier boxes: README's honesty annotations (untracked flags), `docs-FOLDER-MAP.md`, the 3 src/generated.ts docs (coordinate with K11), C-card verification ledger.

## C1–C9 LEDGER (verify-then-patch; one evidence line per card — appended as verified)

_Refilled by W40 M3 (`for K14`, task 293) from K14's exit summary `~/AppData/Local/hermes/cache/delegation/subagent-summary-4-20260927_013043_541389.txt`, verbatim. K14's outcome: **verification complete, ZERO patches landed** (cap hit mid-verify). The finding that changed the job: **most P2 cards are ALREADY LANDED post-`2fa3cd9`** — HEAD (00:56) committed the W29–W39 era; the cards were byte-read at `0f85c32` + uncommitted (19:47)._

| Card | Verified state (evidence) |
|---|---|
| C1 checkpoint wiring | **LANDED** — `headless.ts:646` `commitRunCheckpoint` · `:658` `clearRunCheckpoint` · `:741` `checkpointDir?` opt · `:771/:779` call sites; CLI passes `checkpointDir` at `:593` (run) · `:693` (resume) · `:756` (unattended) |
| C2 `resume` verb | **LANDED** — `rapidtool-cli.mjs:670 case "resume"` · `:408 resolveCheckpointTarget` · `headless.ts:684 loadResumableCheckpoint`; arm count **39** (was 37) |
| C3 `run --unattended` | **LANDED** — `:713 case "unattended"` · `:583` `--unattended` flag; no `unattended-shell.mjs` needed |
| C4 `readWildPlan` | **LANDED** — `engine.ts:3585` · `store.ts:9/:1550 wildPlanFor` · `headless.ts:3869` |
| C5 E-25 + edit-test pins | **LANDED** — `headless.test.ts:1608` (pin ①) + `:1753` (pin ②) re-pointed to the two-channel contract; `rapidtool-cli-edit.test.mjs` (mtime 20:06) re-pointed (`:307/:433` "refused"); `scripts/cli-exit-taxonomy.test.mjs` **EXISTS** (9,245 B, tracked) → the CLI's `:812/:1790` citations are no longer lies |
| C6 4 kind emitters | **LANDED** — `scaffold.ts:668-687` per-kind `main`/`bin`/`exports`/`files`; `emitViteConfig(kind)` at `:2994`; service PORT wiring `:2177-2188`; `PKG_SCRIPTS.service.start` `:631` |
| C7 graders + `verification` | **PARTIAL — still open** — `run-eval.mjs:343-380` parses `expectedBehavior` (SHAPE only); **no corpus grader carries `expectedBehavior`**; `verification` label absent. **K9's box** |
| C8 UI panes | **LANDED (N3)** — `console.tsx:6686+` honest read-only shell surfaces; checkpoint/resume at `:6762-6769` with coded reason in `title` |
| C9 records paste | **K8's box** — not K14's |

## PART 2 — README-CATALOG FOLLOW-UPS (beyond K7's two)

_(found by K14, NOT patched — K14's cap; handed to W40 M3 (task 293) for the coordinated README pass. Verbatim from its exit summary.)_

- **Root cause of the leftover is the commit:** `git ls-files | wc -l` = **1,678** (README says **1,391** everywhere: §10.1 total + §10.2 header + §10.13).
- **README's entire untracked-marking layer is now false** — verified TRACKED: `START-HERE.md` · `finalsprint.md` · `docs-FOLDER-MAP.md` · `tsconfig.scripts.json` · `.prettierignore` · `migrations/auth/0002_account_unique.sql` · `scripts/path-safety.mjs` · `docs-module-parity.mjs` · `cli-exit-taxonomy.test.mjs` (README `:334/:338/:339/:348/:352/:380/:504/:505/:524`) and `wave_plans/W29…W38/*` (`:599-601`).
- **`§10.13` is wholly superseded** — the `.t4scratch/` (192) it calls scratch is **tracked** (committed).
- Drifted censuses: `src/` 201→**208** · `scripts/` 40→**45** (24 tools + 21 tests, was "22+18") · `migrations/` 1→**2** · `fixes/` 321+50→**387** · `wave_plans/` 93→**104** · `research/multiagent` 103 ok.
- `§10.6`: **159 direct files = 81 modules + 78 tests**; `src/lib` 198 = **114 modules + 84 tests**; subdir modules **33** (will shift as lanes land). The README's 78+32 split is stale — this is **K7's item 12e**.
- `docs-module-parity.mjs` finding: `missing` = **`src/generated.ts`** only (claimed by `RESUME.md`, `remainingwaves.md`, `taskuniverselog.md`). **K11's ledger row `M4` owns it** (`fixes/291_k11_periphery.md:29`).

## PART 3 — ORGANIZER STATE ITEMS

_(found by K14, NOT patched — path correction: **`fixes/275_organizer.md`**, the W32 organizer. Handed to W40 M3 (task 293). Verbatim from its exit summary.)_

- `docs-FOLDER-MAP.md` (18:17, stale): `src/` 201→208 · `lib/` 191→198 · `scripts/` 40→45 · `migrations/` 1→2 · `fixes/` ~342→387 · `wave_plans/` 93→104 **and "W4→W32 + 28 dirs" → 34 dirs, W37** · `auth/` 19→20 · missing modules `checkpoint.server.ts`/`quarantine.ts`/`wild-review.ts`.
- Untracked-file flags: `START-HERE.md` line 4 ("HEAD `0f85c32` + uncommitted lanes") is stale post-commit.
