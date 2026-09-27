# fixes/287_z1_boundary_close.md — W39 · LANE Z1 · THE BOUNDARY CLOSER

**Lane:** W39 Z1. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell grep only).
**Mission:** close the boundary — fix the `store.test.ts:972` pin to the 185-H1/F3-06 note-doctrine; run that leg to 73/73;
clear the 2 registered lint warnings; re-run typecheck+lint direct. CODE-ONLY + the single leg run.
**Baseline HEAD:** `0f85c32` + the W29–W39 uncommitted era.

## The doctrine (read FIRST — `src/lib/store.ts:72-77`)

> 185-H1/F3-06: ok:true NEVER carries a `code` — the pause class rides as `note`
> (the headless/CLI convention); codes ride the refusal arm only.

Runtime confirmation: the ok-pause return at `store.ts:1186` spreads `...(res.code ? { note: res.code } : {})`.

## Item ledger

1. `src/lib/store.test.ts:972` — pin asserts `res.code`; doctrine says `note` — **DONE** (note-pin + no-dual-channel pin; leg 73/73)
2. `scripts/rapidtool-cli.mjs:267` — unused `checkpointDriver` — **DONE** (dead loader trio removed + recording comment; eslint clean)
3. `src/lib/checkpoint.server.test.ts:15` — unused `readFileSync` import — **DONE** (import pruned; eslint clean)

## Log (append-only)

### [t0] before-state captured — doctrine read, evidence in hand

- **Leg BEFORE** (`node --experimental-strip-types --test src/lib/store.test.ts`): EXIT:1 — `# tests 73 / # pass 72 / # fail 1`.
  - `not ok 48 - S2: startWildRun drives deterministically and parks honestly when the classifier is unconfigured`
    (`store.test.ts:960`), failure `honest pause class surfaces`: `+ actual - expected … + undefined` —
    the old pin asserts `(res as { code?: string }).code` but the doctrine moved the pause class to `note`.
- **Lint BEFORE** (`npx eslint scripts/rapidtool-cli.mjs src/lib/checkpoint.server.test.ts src/lib/store.test.ts`):
  2 warnings / 0 errors —
  - `scripts/rapidtool-cli.mjs:267:16 warning 'checkpointDriver' is defined but never used`
  - `src/lib/checkpoint.server.test.ts:15:59 warning 'readFileSync' is defined but never used`
- **Edit-3 decision:** N2 (cli:257-260) rerouted `resume`/`unattended` through
  `headless.loadResumableCheckpoint` (read→admit→hydrate in ONE place); `resolveCheckpointTarget` (cli:414)
  never touches `checkpoint.server.ts`. The direct loader NEVER gained a consumer → **removed with a comment**
  recording why (the 0-warning gate forbids dead code; reintroduce with a future read-only `resume --list`).
  Repo-wide grep: `checkpointDriver` appears only at its own definition — no test pins it.

### [t1] fixes landed — leg + lint + gates all re-run

- **Fix 1 — `store.test.ts:972` (the last red):** pin migrated to the doctrine —
  `assert.equal((res as { note?: string }).note, "RT_E_LLM_NOT_CONFIGURED", "honest pause class surfaces")`
  plus a doctrine-enforcement line `assert.equal((res as { code?: string }).code, undefined, "ok:true never dual-channels a code (185-H1/F3-06)")`,
  both cited to `store.ts:72-77` in a comment. Same honest protection, the correct field, and the never-dual-channel
  clause now pinned too.
- **Leg AFTER** (`node --experimental-strip-types --test src/lib/store.test.ts`): **EXIT:0 — `# tests 73 / # pass 73 / # fail 0`** (0 `not ok` lines). BEFORE 72/73 → AFTER 73/73.
- **Fix 2 — `rapidtool-cli.mjs`:** removed `CHECKPOINT_PATH` + `checkpointServer` + `checkpointDriver` (all three would
  otherwise orphan into warnings), replaced by the W39 Z1 recording comment. `node --check` → SYNTAX-OK;
  `pathToFileURL` still used 11× elsewhere (no orphaned imports).
- **Fix 3 — `checkpoint.server.test.ts`:** `readFileSync` dropped from the `node:fs` import.
- **Lint AFTER (my 3 files)** (`npx eslint scripts/rapidtool-cli.mjs src/lib/checkpoint.server.test.ts src/lib/store.test.ts`): **EXIT:0 — 0 problems** (BEFORE: 2 warnings).
- **Static gate 1 — `npm run typecheck` (direct, unpiped): GREEN — TYPECHECK-EXIT:0** (tsc --noEmit, no output).
- **Static gate 2 — `npm run lint` (direct, unpiped): GREEN — LINT-EXIT:0, zero output** — repo-wide 0 errors / **0 warnings**
  (the registered 2-warning debt is fully cleared).

**BOUNDARY COMPLETE — ready for the parent's commit.**

