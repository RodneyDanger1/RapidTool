# fixes/343_3_delivery.md -- lane 343-3 (DELIVERY): land the EMITTED product + parity check

**Boundary:** opened 2026-10-03 at HEAD `73f660a` (`git main`, clean at briefing). Node host
v24.15.0; Node 22.23.2 at `%LOCALAPPDATA%\hermes\node\node.exe`. **0 keyed calls** (the two
live citations below come from the repo's free keyless search, `freeWebSearch`).
**Log is append-only.** No RapidTool-repo commit/stash/reset was performed; every git mutation
this lane ran lives under `%TEMP%\rt343_3` (asserted; see E5).

Persona pairing: ANALYST (brief + shortlist + discarded ideas, sections 1-3) then ENGINEER
(seam, wiring, tests, proofs, sections 4-7).

---

## 1. ANALYST -- what RapidTool does today at emit/land (on bytes)

**Emit works; land does not exist for the user.**

- Emit: `headless.emitProject` writes the scaffold tree (`src/lib/headless.ts:2347`; CLI arm
  `scripts/rapidtool-cli.mjs:1952`). The emitted tree already ships a `.gitignore`
  (`src/lib/scaffold.ts:583` `gitignoreFile()`, pushed at `:4068`) that keeps
  `node_modules/`, `dist/` and `.rapidtool/logs/` out of a review diff (TA-17 satisfied).
- Land: `src/lib/git.server.ts` DOES carry a seat-gated landing tail -- `gitLandingAvailable`
  (`:889`), `gitLandInit` (`:945`), `gitLandCommit` (`:1048`), `gitLandReadBack` (`:1229`) --
  but a repo-wide grep for its exports finds **zero product call sites**: the only non-test
  importer is `src/lib/selfmod.server.ts`, and it deliberately uses only
  `runBoundedChild`/`gitLandingAvailable` (its own comment, `selfmod.server.ts:12`, explains
  `gitLandCommit` cannot be used there). **So an emitted app was never versioned: the seam
  existed, the delivery did not.** This is exactly the "no git landing" limit recorded for the
  341 wave (`fixes/341_0_parent.md` sec.5, "Does not work"), and the A7 gap in
  `research/multiagent/103_feature_gaps.md:175` / the T4.2 row `104_factory_upgrade_plan.md:606`
  ("CLI `emit --git`", "generated product lands as reviewable units").

Free keyless search (`freeWebSearch`, DuckDuckGo; 343-3 probe, keyless):
`Conventional Commits` -> https://www.conventionalcommits.org/en/v1.0.0/ ;
`Git integration - aider` -> https://aider.chat/docs/git.html .

## 2. ANALYST -- what the competitor repos do (commit-pinned, from the repo's own research)

| Repo | Git-native delivery behaviour | Source (repo research) |
|---|---|---|
| **Aider** | **Git is the safety net**: edits the real working tree and **auto-commits each agent turn**; `/undo` reverts the last aider commit; `--auto-commits`/`--dirty-commits`. | `research/multiagent/107_competitors_agentic.md` sec.3 (`aider/repo.py:131` `def commit`, `:581-596`; `aider/commands.py:553-648` `cmd_undo`; `aider/args.py:440,446`) |
| **Cline** | Every session is **git-checkpointed** so a human can diff/restore a run (`checkpoint-diff`/`checkpoint-restore`). | `107_...md` sec.4 |
| **OpenHands** | Git diff + a **git-sync** surface (`GitChange`/`GitChangeDiff`, `GitSyncStatus`); repo state synchronized, not patched by the canvas. | `107_...md` sec.5 |
| **gpt-engineer** | `stage_uncommitted_to_git` stages existing uncommitted files before generating. | `research/multiagent/108_competitors_app_generators.md` (`gpt_engineer/core/git.py:71`) |
| **MetaGPT** | Emits into a **project git repo**; `add_change()`/`commit()`/`archive(comments)` commit everything. | `108_...md` (`metagpt/utils/git_repository.py:142,:237`) |
| **Dyad** | **One git commit per assistant message** stored as `commitHash`. | `108_...md` (`src/ipc/handlers/version_handlers.ts`) |

Common shape: **a fresh generated tree is committed as a reviewable unit, with a machine-generated
message.** None of the required-reading competitors uses a human-seat token for that delivery
commit; the message discipline is the honest differentiator RapidTool can add (Conventional
Commits from the real spec).

## 3. ANALYST -- shortlist, chosen design, discarded ideas

**Chosen (smallest honest design).** A `land` seam, `git.server.ts:1565 gitLandEmitted`, called at
ONE product call site: the CLI **`emit --git`** flag (`rapidtool-cli.mjs:2205`). It:
1. requires the emitted record `.rapidtool/project.json` (`EMITTED_RECORD_REL`) as proof the target
   is a RapidTool emission -- else coded `not-an-emitted-tree`;
2. `git init` (only when `.git` is absent and the dir is not inside any work tree) then **one**
   commit staged from the emitted manifest ONLY (`add -- <files>`), so a foreign file is reported
   (`foreign[]`) and left untracked, never silently committed;
3. derives a Conventional Commits message from the REAL brief/spec:
   `feat(<slug>): <first implementationSpec requirement, else brief's first line>`
   (`conventionalLandMessage`, `git.server.ts:1436`);
4. is **idempotent**: a clean tree is `noop:true`, `committed:false` -- never an empty commit;
5. inherits the module's discipline: fixed subcommand allowlist (`GIT_LANDING_SUBCOMMANDS`), argv
   arrays only, no shell, scrubbed child env (no secret key), wall-clock timeout, coded failures.

**Seat note (deliberate, stated).** The existing `gitLandInit/Commit/ReadBack` stay exactly as they
are: human-seat-gated, untouched, still the interactive/console door. The new delivery seam is
machine-callable by design because the task's contract for this lane is "no secrets" and the
original plan's call site is `emit --git`. It is NOT a weakening: it adds structural guards that do
not depend on a seat -- emitted-record proof, a delivery marker written **inside `.git/`**
(`GIT_LAND_DELIVERY_MARKER`, invisible to the emit walker, so re-emit stays clean), a
work-tree-nesting refusal, and manifest-only staging. The host repo is refused even when it carries
an emitted record, because a foreign `.git` root has no delivery marker (tested). The
seat-vs-structural question for delivery is flagged under "what remains" for the owner.

**Discarded (and why).**
- **Branch-per-build / branch stacks** -- a fresh emitted dir is one linear delivery; branches only
  matter against a remote/reviewer. `branch`/`checkout`/`switch` are absent from the allowlist by
  design; adding them is scope without a consumer.
- **Remotes + `push`** -- network family verbs are absent by design and would need credentials,
  breaking "no secrets". `push`/`pull`/`fetch`/`clone`/`remote` are explicitly refused.
- **Pull-request creation** -- needs a git host + auth (network + secrets); out of scope for a
  local delivery tail.
- **Per-file / multi-commit-per-cycle** -- the emitted tree is ONE reviewable unit; one commit keeps
  idempotency (`nothing-to-commit` -> honest no-op) trivial and honest.
- **History rewrite (`--amend`, `reset`, `rebase`)** -- absent from the allowlist; a delivery tail
  must never rewrite.
- **Folding land INTO `emitProject` (unconditional)** -- rejected: emit is used by the eval harness
  and journey drivers over throwaway temp dirs; minting git history on every emit is wrong. Land is
  opt-in via `--git`.

---

## 4. ENGINEER -- the seam and the wiring (file:line)

- `src/lib/git.server.ts:1332` -- new section "6b - the delivery seam" (doctrine).
- `src/lib/git.server.ts:1362` `GIT_LAND_DELIVERY_MARKER` (`rapidtool-landing.json`, inside `.git/`);
  `:1367` `EMITTED_RECORD_REL` (`.rapidtool/project.json`).
- `src/lib/git.server.ts:1436` -- `conventionalLandMessage(subject)` (pure, total).
- `src/lib/git.server.ts:1565` -- `gitLandEmitted(subject, dir, opts)` (the seam).
- `src/lib/headless.ts:2537/:2540` -- `LandEmittedTreeOptions` + `landEmittedTree` wrapper (headless
  IS the CLI's bare-Node host; dynamic-imports the git child seam).
- `scripts/rapidtool-cli.mjs:2205` -- `if (flag(args, "git")) { ... h.landEmittedTree(project, res.dir, { files: res.files }) ... }`
  at the end of the `emit` arm; `payload.git` carries the real commit; a land refusal flips
  `payload.ok=false` (exit 1) while the emitted tree still exists.
- `scripts/rapidtool-cli.mjs` USAGE.emit now documents `[--git]`.
- `scripts/cli-exit-taxonomy.test.mjs` -- source pin "343-3 -- `emit --git` is wired to the delivery seam".

## 5. ENGINEER -- RED-first evidence

RED (Node 24, before any implementation; imports absent):

```
$ node --experimental-strip-types --test --test-reporter=tap src/lib/git.server.test.ts
# SyntaxError: The requested module './git.server.ts' does not provide an export named 'EMITTED_RECORD_REL'
not ok 1 - src\lib\git.server.test.ts   # fail 1

$ node --experimental-strip-types --test --test-reporter=tap src/lib/headless.test.ts
# SyntaxError: The requested module './headless.ts' does not provide an export named 'landEmittedTree'
not ok 1 - src\lib\headless.test.ts     # fail 1
```

## 6. ENGINEER -- temp-repo proofs (real emitted trees, `%TEMP%\rt343_3`)

Seam proofs live in `src/lib/git.server.test.ts` sec.9; end-to-end proof (REAL `emitProject` tree)
in `src/lib/headless.test.ts`. Git for every test runs under `%TEMP%\rt343_3`
(`RT343_3_SCRATCH_ROOT` / `mkdtempSync(tmpdir()/rt343_3)`).

Proven, with real temp repos:
1. **Fresh emitted tree is committed** with the conventional message; `git log --oneline` shows
   `feat(land-delivery): <brief>`; work tree clean (`git status --porcelain` empty).
2. **Second land is idempotent** -- `noop:true`, `committed:false`, `commit:null`, and
   `git rev-list --count HEAD` stays `1` (no empty commit).
3. **Foreign file handled per design** -- `NOTES.md` added after emit is NOT staged/committed and
   is reported in `foreign[]`; `git status` shows `?? NOTES.md`.
4. **Host repo refused structurally** -- the repo root is refused; a scratch FOREIGN repo carrying
   the emitted record is refused (`not-a-landing-repo`, 0 commits); a subdir of any work tree is
   refused (`target-in-work-tree`); no `.git` is ever created in the repo.
5. **RapidTool HEAD unchanged** -- asserted explicitly before/after a full delivery cycle and in the
   host-guard tests: `git -C <repo> rev-parse HEAD` = `73f660a4694a817240d8f9efa94faf837b84fdd1`
   (unchanged); `git stash list` empty; `src/.git` and `.rapidtool/landing.json` absent.
6. **Coded git-absent** -- `gitBin: BOGUS_GIT` -> `RT_E_GIT_UNAVAILABLE`, nothing written.

CLI end-to-end (`emit --git`, real):
```
$ node scripts/rapidtool-cli.mjs create --brief "A tiny expense tracker for a small team, with CSV export." --name "CLI Smoke" --out build.json
$ node scripts/rapidtool-cli.mjs emit --project build.json --out tree --git
  "ok": true,
  "git": { "message": "feat(cli-smoke): A tiny expense tracker for a small team, with CSV export.",
           "committed": true, "noop": false, "foreign": [] }
exit=0
$ git -C tree log --oneline      -> 6670d6a feat(cli-smoke): A tiny expense tracker for a small team, with CSV export.
$ git -C tree status --porcelain -> (empty)
$ git -C <repo> rev-parse HEAD   -> 73f660a4694a817240d8f9efa94faf837b84fdd1
# second run:
$ node scripts/rapidtool-cli.mjs emit --project build.json --out tree --git
  "ok": true, "overwritten": true, "committed": false, "noop": true
$ git -C tree rev-list --count HEAD -> 1     (idempotent)
$ git -C <repo> rev-parse HEAD      -> 73f660a (unchanged)
```

## 7. GREEN -- both runtimes (targeted suites only)

| Suite | Node 24.15.0 | Node 22.23.2 |
|---|---|---|
| `src/lib/git.server.test.ts` | **49 pass / 0 fail** | **49 pass / 0 fail** |
| `src/lib/headless.test.ts` (full file) | **163 pass / 0 fail** | **163 pass / 0 fail** |
| `scripts/cli-exit-taxonomy.test.mjs` (full) | **43 pass / 0 fail** | pin re-run: 1 pass / 0 fail |
| `scripts/cli-exit-taxonomy.test.mjs --test-name-pattern "343-3"` | `ok 1 - 343-3 ...` | `ok 1 - 343-3 ...` |
| `scripts/README-cli.test.mjs` (verb/USAGE parity) | **12 pass / 0 fail** | **12 pass / 0 fail** |
| `scripts/typecheck-scripts.test.mjs` | **6 pass / 0 fail** | -- |
| `tsc --noEmit` | exit **0** | -- |
| eslint (6 changed files) | exit **0** | -- |

**Interim flake, stated honestly:** one full `headless.test.ts` run under concurrent load reported
`not ok 43 - landEmittedTree ...` with `# fail 2`; the filtered log lost the assertion detail, so
the exact assertion is uncharacterized. Two subsequent FULL runs (Node 24 163/163, Node 22 163/163)
and a standalone `--test-name-pattern "landEmittedTree"` run (2/2) are green. Treated as the repo's
known load-sensitive child-spawn class (cf. `runBoundedChild` pins / `exec.test.ts`); not hidden.

---

## 8. Verdict

**The gap is closed for the emitted product.** `emit --git` now lands a freshly emitted app as ONE
Conventional-Commits commit derived from the real brief/spec, idempotently, with only the emitted
files staged and the host repo structurally un-landable. The pre-existing seat-gated
`gitLandInit/Commit/ReadBack` are untouched. Not "100% competitor parity": RapidTool has no branch
stacks, remotes, push or PRs -- those were deliberately discarded (section 3), so the delivery is a
local, single-commit, reviewable unit, not a hosted PR flow.

**What remains (honest):**
1. **`scripts/README-cli.md` doc drift (STOP-and-REPORT, unowned).** Exact shape: add `[--git]` to
   the emit synopsis at `README-cli.md:179`, and a short `--git` paragraph beside the `--red-tree`
   text at `~:486`. Tests do NOT depend on it (README-cli 12/12 green without it), but
   declare-or-strike wants the README to match the CLI's new flag.
2. **Seat-vs-structural policy decision (owner).** The delivery tail is machine-callable and
   guarded structurally; if the owner wants the human-seat token on delivery too, mount
   `humanSeatClaim` in the CLI `emit --git` arm (a 3-line change) -- flagged, not silently chosen.
3. **Interim full-suite flake** (section 7) is named but not root-caused.
4. No branch/remote/push/PR surface (by design; see section 3).

**STOP-and-REPORT:** only item 1 above (a cross-file doc line in `scripts/README-cli.md`, which this
lane does not own). No source change outside the owned set
(`src/lib/git.server.ts`, `src/lib/git.server.test.ts`, `src/lib/headless.ts`,
`src/lib/headless.test.ts`, `scripts/rapidtool-cli.mjs`, `scripts/cli-exit-taxonomy.test.mjs`) was
made or is needed.
