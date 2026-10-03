# 343 wave — watchdog 1 (destruction + ownership)

**Role:** non-mutating overseer. Watches for tracked-file deletion/rename/shrink, mass rewrites,
stash/reflog destruction events, HEAD drift, and reserved-file ownership violations. Alerts only;
never fixes, never commits, never edits product files.

**Root:** `C:\Users\mnril\Desktop\RapidTool Main` (git `main`).
**Scratch:** `%TEMP%\rt343_wd1\` (poll snapshots, baseline manifests).

## Baseline (poll 0 — setup)

_Timestamp note: the poll labels below are approximate. The only authoritative wall-clock anchor is the
reflog reset stamp `2026-10-03 09:57:20 -0500`, first observed at poll 8, which places setup + polls 1–7
in the ~09:4x–09:56 window (the bare `07:1x` labels were an early guess keyed to the HEAD commit time)._

- `git rev-parse HEAD` = `73f660a4694a817240d8f9efa94faf837b84fdd1`
  ("342 wave: six engineers + three residual resumes + two verifiers — P6 convergence, an honest
  eval, and the cleanups", 2026-10-03 07:12:40 -0500).
- Working tree: **clean** — `git status --porcelain` = 0 entries. No untracked.
- `git stash list` = empty.
- Tracked files = **1913** (295 under `src/` + `scripts/`).
- `fixes/343_0_parent.md` **not present** at setup → reserved-file ownership map not yet published.
  Ambiguity reported. Reserved paths watched by name per the brief:
  `codegen.server.ts`, `repo-map.ts`, `packet.ts`, `console.tsx`, `git.server.ts`, `headless.ts`,
  `scripts/rapidtool-cli.mjs`. (`repo-map.ts` does not exist yet; watching for its creation.)
- Sentinel blob hashes captured from HEAD in `%TEMP%\rt343_wd1\baseline_reserved_hashes.txt`.

## Ownership map (as lanes declare it)

`fixes/343_0_parent.md` was still absent at setup; the map below is read from each lane's own log
(append-only). Watch for cross-lane edits of these paths.

| Lane | Owned files |
|---|---|
| 343-1 synthesis | `src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts`, new `src/lib/synthesis-policy.ts` (+ test) |
| 343-2 context/UI | `src/lib/repo-map.ts`, `src/lib/repo-map.test.ts`, `src/lib/packet.ts`, `src/lib/packet.test.ts`, `src/components/console.tsx` |
| 343-3 delivery tail | `src/lib/git.server.ts`, `src/lib/git.server.test.ts`, `src/lib/headless.ts`, `src/lib/headless.test.ts` (self-identified in diff comments; log file not yet written) |
| CLI lane (TBD) | `scripts/rapidtool-cli.mjs` (modified +26; no log yet) |
| provider lane (TBD) | `src/lib/llm/providers/one-shot-fetch.server.ts` + `.test.ts` (no log yet) |
| bh1 bug-hunt | `engine.ts`, `types.ts`, `phases.ts`, `dod.ts`, `judgment.ts`, `store.ts`, `io.ts`, `checkpoint.server.ts`, `token-ledger.ts`, `quarantine.ts`, `planning.ts`, `wild-mode.server.ts`, `wild-review.ts`, `policy.ts`, `errors.ts`, `maker-score.ts`, `scorecard.ts`, `doctor.ts`, `fixtures*.ts`, `brief-fixtures.ts` + tests (from `fixes/343_bh1_bughunt.md`) |
| 343 wd1 / wd2 | overseers (non-mutating) — `fixes/343_wd1_watchdog.md`, `fixes/343_wd2_quality.md` |

## Alerts

### ALERT-1 — `git reset` during the wave (destruction-class signal; **non-destructive outcome**), 2026-10-03 09:57:20 -0500

- **Event:** reflog gained `73f660a HEAD@{0}: reset: moving to HEAD` at `2026-10-03 09:57:20 -0500`
  (ISO reflog stamp). Target commit `73f660a` did **not** move; first seen in my snapshot at **poll 8**
  (polls 1–7 still showed `HEAD@{0}: commit: 342 wave…`).
- **Why it is flagged:** my brief lists a reflog `reset` as a destruction-class event.
- **Outcome — verified NO content lost (at poll 30):**
  - `git status --porcelain` = 46 entries (34 modified, 12 untracked); `git ls-files --deleted` = **0**.
  - Tracked count **1913**, unchanged from baseline.
  - `src/lib/codegen.server.ts` still carries lane 343-1's work (+213/−26); new files
    `src/lib/synthesis-policy.ts`, `src/lib/repo-map.ts`, `src/lib/repo-map.test.ts`,
    `src/lib/synthesis-policy.test.ts` all present; `package.json` parses.
- **Interpretation:** consistent with a mixed/soft `git reset` that clears the index (nothing was ever
  staged — `git diff --cached` was empty every poll), **not** `git reset --hard` (which would have
  reverted all 34 modified files). The same pattern exists in prior history
  (`a097fa8 HEAD@{3}: reset: moving to HEAD`, 02:57:28). No content was at risk; **no recovery needed**.
- **Recovery path had it been `--hard`:** base bytes are recoverable via `git show 73f660a:<path>` for
  tracked files, and the 12 new files are untracked-but-present on disk — nothing was actually destroyed.
- **Could not determine:** the actor/tool that ran the reset (reflog records no actor; no shell history
  available), and the exact wall-clock of the poll-7→poll-8 interval (reflog stamp 09:57:20 is authoritative).

## Harness note

- **False-positive "missing" (fixed).** My first snapshot used default `git ls-files`, which quotes
  the 30 non-ASCII vault filenames (`builds/vault.md/…`, `vault-e2e/…`) with octal escapes; `Test-Path`
  on the escaped form failed → `missing=30` artifact, **not** deletions (git status showed 0 deletions,
  and the raw filenames exist on disk). Baseline regenerated with `git -c core.quotePath=false`.

## Poll log

| Poll | Time | HEAD changed | stash | tracked | status | modified | untracked | missing | shrunk | pkg.json | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 07:1x setup+first | no | no | 1913 | 6 | 1 | 5 | 30* | 0 | ok | *false positive (quoted paths). Writers started: 343-1/343-2 logs + synthesis-policy.ts appeared. `codegen.server.ts` +78/−2 (owned by 343-1, expected). |
| 2 | 07:2x | no | no | 1913 | 7 | 1 | 6 | 30* | 0 | ok | *artifact; git `--deleted` shows none. New `src/lib/repo-map.test.ts` (343-2). `codegen.server.ts` +162/−17 (343-1, owned). No deletions. |
| 3 | 07:2x | no | no | 1913 | 12 | 5 | 7 | 0 | 0 | ok | Harness fixed (missing=0). New: `repo-map.ts` (343-2). 343-3 started: `git.server.test.ts` +212/−1, `headless.test.ts` +85/−1 (self-identify as `fixes/343_3`; no log file yet). `packet.ts` +16, `packet.test.ts` +78 (343-2). No deletions, no stash, HEAD stable. |
| 4 | 07:3x | no | no | 1913 | 20 | 12 | 8 | 0 | 0 | ok | More lanes: `git.server.ts` +443, `headless.ts` +24 (343-3); `scripts/rapidtool-cli.mjs` +26 (CLI lane); `one-shot-fetch.server.ts` +23/−1, `.test.ts` +48 (provider lane); `console.tsx` +13 (343-2); `synthesis-policy.test.ts` new (343-1). All additive patches; no deletions/shrank/stash; HEAD stable. |
| 5 | 07:4x | no | no | 1913 | 20 | 12 | 8 | 0 | 0 | ok | **Transient blip (not an alert):** `codegen.server.ts` momentarily read clean in this snapshot; immediate re-check shows it is still modified (+162/−17, 284361 B, imports `./synthesis-policy.ts`) — 343-1's work intact. New: `cli-exit-taxonomy.test.mjs` +30 (CLI lane); `codegen.server.test.ts` +137 (343-1). No deletions/shrank/stash; HEAD stable. |
| 6 | 07:4x | no | no | 1913 | 21 | 13 | 8 | 0 | 0 | ok | codegen re-confirmed present (+162/−17). `git.server.test.ts` grew to +216, `headless.test.ts` +89. All 13 modified files are additive patches (max 443 add on `git.server.ts`); no deletions/shrank/stash; HEAD stable. |
| 7 | 07:5x | no | no | 1913 | 25 | 17 | 8 | 0 | 0 | ok | Sweep-style small edits: `dod.ts` +9/−7, `phases.ts` +1/−1, `wild-mode.server.ts` +1/−1, `checkpoint.server.test.ts` +16. All non-shrinking; no deletions/stash; HEAD stable. Still no `fixes/343_3+` logs (343-3 code is landing without a log file — attribution gap, not destruction). |
| 8 | ~09:57 | no | no | 1913 | 25 | 17 | 8 | 0 | 0 | ok | Byte-identical numstat to poll 7, **but reflog changed here** — `HEAD@{0}` flipped to `reset: moving to HEAD` (→ ALERT-1). No deletions/stash; HEAD unchanged. |
| 9 | 08:0x | no | no | 1913 | 25 | 17 | 8 | 0 | 0 | ok | Quiet — byte-identical to poll 8. No deletions/stash; HEAD stable. |
| 10 | 08:0x | no | no | 1913 | 26 | 17 | 9 | 0 | 0 | ok | New lane log `fixes/343_bh1_bughunt.md` appeared (bug-hunt lane). No new code edits (numstat byte-identical). No deletions/stash; HEAD stable. |
| 11 | 08:1x | no | no | 1913 | 27 | 18 | 9 | 0 | 0 | ok | New `src/lib/rt-ring.test.ts` +28/−1. bh1's scope (engine/phases/dod/etc.) explains the earlier `phases.ts`/`dod.ts`/`wild-mode.server.ts`/`checkpoint.server.test.ts` edits. All additive; no deletions/stash; HEAD stable. |
| 12 | 08:1x | no | no | 1913 | 32 | 23 | 9 | 0 | 0 | ok | More lanes: `auth/gates.tsx` +16/−1, `auth/sign-in-gate.test.ts` +19, `providers/registry.test.ts` +33, `rt-events.ts` +8/−1, `rt-ring.ts` +8. All additive; no deletions/stash; HEAD stable. |
| 13 | 08:2x | no | no | 1913 | 35 | 26 | 9 | 0 | 0 | ok | `providers/openai-compatible.ts` +13/−1, `rt-events.test.ts` +4. All additive; no deletions/stash; HEAD stable. |
| 14 | 08:2x | no | no | 1913 | 35 | 25 | 10 | 0 | 0 | ok | New lane log `fixes/343_bh2_bughunt.md` (bug-hunter 2); no code change (numstat byte-identical to poll 13). No deletions/stash; HEAD stable. |
| 15 | 08:3x | no | no | 1913 | 40 | 29 | 11 | 0 | 0 | ok | `design.ts` +6/−2 & `.test.ts` +19, `diagram.ts` +6/−1 & `.test.ts` +9. Lane 343-3 log `fixes/343_3_delivery.md` now present (attribution gap closed). All additive; no deletions/stash; HEAD stable. |
| 16 | 08:3x | no | no | 1913 | 40 | 29 | 11 | 0 | 0 | ok | Quiet — byte-identical numstat to poll 15. No deletions/stash; HEAD stable. |
| 17 | 08:3x | no | no | 1913 | 40 | 29 | 11 | 0 | 0 | ok | Quiet (digest `C8C4DB6D478E`). No deletions/stash; HEAD stable. |
| 18 | 08:4x | no | no | 1913 | 40 | 29 | 11 | 0 | 0 | ok | Quiet — digest unchanged (`C8C4DB6D478E`). No deletions/stash; HEAD stable. |
| 19 | 08:4x | no | no | 1913 | 41 | 29 | 12 | 0 | 0 | ok | New lane log `fixes/343_bh3_bughunt.md` (bug-hunter 3); no code change (numstat byte-identical). No deletions/stash; HEAD stable. |
| 20 | 08:5x | no | no | 1913 | 42 | 30 | 12 | 0 | 0 | ok | `scripts/README-cli.md` +4/−1 (CLI lane doc patch). All else unchanged. No deletions/stash; HEAD stable. |
| 21 | 08:5x | no | no | 1913 | 42 | 30 | 12 | 0 | 0 | ok | Quiet — digest unchanged (`03C0F6E72952`). No deletions/stash; HEAD stable. |
| 22 | 08:5x | no | no | 1913 | 42 | 30 | 12 | 0 | 0 | ok | Quiet — digest unchanged. No deletions/stash; HEAD stable. |
| 23 | 09:0x | no | no | 1913 | 44 | 32 | 12 | 0 | 0 | ok | Active: `codegen.server.ts` grew +162/−17 → +213/−26, `.test.ts` +137 → +252/−5 (343-1); new `harvest.test.ts` +57, `mcp.server.test.ts` +26. Additive patches; no deletions/shrank/stash; HEAD stable. |
| 24 | 09:0x | no | no | 1913 | 46 | 34 | 12 | 0 | 0 | ok | New `harvest.ts` +24/−5, `mcp.server.ts` +14/−5, `harvest.test.ts` → +58. All additive patches; no deletions/shrank/stash; HEAD stable. |
| 25 | 09:1x | no | no | 1913 | 46 | 34 | 12 | 0 | 0 | ok | Quiet — digest unchanged (`8403275C3650`). No deletions/stash; HEAD stable. |
| 26 | 09:1x | no | no | 1913 | 46 | 34 | 12 | 0 | 0 | ok | Quiet — digest unchanged. No deletions/stash; HEAD stable. |
| 27 | 09:2x | no | no | 1913 | 46 | 34 | 12 | 0 | 0 | ok | Quiet — digest unchanged. No deletions/stash; HEAD stable. |
| 28 | 09:2x | no | no | 1913 | 46 | 34 | 12 | 0 | 0 | ok | Quiet — digest unchanged. No deletions/stash; HEAD stable. |
| 29 | 09:2x | no | no | 1913 | 46 | 34 | 12 | 0 | 0 | ok | Quiet — digest unchanged. No deletions/stash; HEAD stable. |
| 30 | 09:3x | no | no | 1913 | 46 | 34 | 12 | 0 | 0 | ok | Quiet — digest unchanged (`8403275C3650`). Closing checks: HEAD `73f660a` unchanged, stash empty, `package.json` parses, sentinels present, ALERT-1 re-verified non-destructive. |

## Final status

**Polls run:** 30 (poll 0 = setup; polls 1–30 = watch loop, ~80–90 s cadence, ≈50 min).
**Alerts:** 1 — ALERT-1 (`git reset`, non-destructive; content verified intact).
**Ownership violations:** none observed. Every landed change matched a lane's declared or
self-identified ownership (see map above); no file was edited by a second lane.
**Mass rewrites / obliteration:** none. Largest single delta was `git.server.ts` +443/−0 (new code by
343-3), not a rewrite; every other file was a small additive patch.
**Destruction:** none. Zero tracked-file deletions/renames (`git ls-files --deleted` = 0 at every poll),
zero shrinks, `git stash list` empty at every poll, HEAD pinned at `73f660a` throughout.
**Recovery paths:** not needed (nothing lost). Had ALERT-1 been a hard reset, base bytes would come from
`git show 73f660a:<path>`; the 12 new files were never git-tracked, so they were never at risk.

**Final health: GREEN (with one non-destructive reflog alert).** Tracked files 1913; working tree holds
34 modified + 12 untracked, all additive; `src/lib/engine.ts`, `src/lib/errors.ts`, `package.json`,
`scripts/rapidtool-cli.mjs`, `src/components/console.tsx`, `src/lib/packet.ts`,
`src/lib/codegen.server.ts`, `src/lib/git.server.ts`, `src/lib/headless.ts` all present and non-shrunk;
`package.json` parses.

_Note: the `Time` column is approximate except where a reflog stamp is authoritative; the harness recorded
exact per-poll snapshots under `%TEMP%\rt343_wd1\poll_NNN.txt`._

**Stop reason:** polls 25–30 were byte-identical (digest `8403275C3650` unchanged across six consecutive
polls, ≈8 min with no writer bytes), the wave's ~50-min window had elapsed, and no deletion/stash/HEAD
drift was present. I cannot positively confirm that zero writers remain, but no tracked content changed
in the final six polls.
