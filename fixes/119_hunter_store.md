# 119 — Hunter H P1 store-lane fix log (H-01 + H-06, executor F-H1)

**Role**: FLASH FIXER F-H1 — 115 store-race lane (of the 115 PRO HUNTER wave).
**Owned files** (strict disjoint ownership): `src/lib/store.ts`,
`src/lib/store.test.ts`, this log (`fixes/119_hunter_store.md`). NOT touched:
`engine.ts`/`verify.server.ts`/`headless.ts` (P-D2C), `io.ts`/`packet.ts`
(siblings), any other file.
**Spec source**: `fixes/115_pro_hunter.md` §H-01 (P1) + §H-06 (P1) — applied
together per the spec's sequencing note (both own `rebaseUserFields`/
`commitWild`, one executor).
**Patch discipline**: patch-only on existing files, no export renames, zero-dep
(no new imports beyond a `ResearchCorpusEntry` *type* import in store.ts).

## Bugs fixed

### H-01 (P1) — `rebaseUserFields` whitelist drops `chatLog` (+ whitelist audit vs full Project type)

`rebaseUserFields` (store.ts, formerly the 5-field whitelist used by every
async commit: `executeAsync`, `runUntilHitlAsync`, `runModuleReal`,
`deepenResearch`, `rejectAsync`, and the wild driver's `commitWild`) preserved
only `name/notes/createdAt/enforceDod/wildMode`. `chatLog` is user-owned —
`appendChatRows` is a sync action exactly like `rename`/`setNotes`, and no
engine path ever appends chat rows — so any chat message sent while an async
run was in flight was silently rolled back by the run's whole-project commit
(`live.chatLog` is always a superset of the run's snapshot ⇒ live must win).

**Full whitelist audit** (every Project field, types.ts:249-365, diffed at
patch time — documented in the code comment above `rebaseUserFields`):
- **Added to the whitelist**: `chatLog` (H-01 core; engine never appends rows)
  and `kind` (user/operator-owned — set at create/import; no run path
  recomputes it, so live-wins is a safe pass-through).
- **Deliberately NOT whitelisted** (engine-run-owned — the committing run's
  fresh output must win over the stale live snapshot or the run rolls *itself*
  back): `id/brief/domain/status/currentPhase/phases/scorecard/competitors/
  research/artifacts/memory/logs/hitl/decisions/modelRoute/sandbox/openapi/
  adr/lattice/schedule/traces/packet/specGraph/contracts/oracle/crew/_v/meta`.
- `implementationSpec`: dual-authored (operator CLI prompt verb AND P6 keyed
  synthesis inside a run) — live-wins would discard a run's freshly generated
  spec, so it rides the committed spread (pre-existing specs survive; covered
  by R1). Concurrent engine-owned *appends* are handled by the H-06 merge.
- `wildRun`: still deliberately excluded (engine-owned mutable run state; the
  driver commits each step's own `wildRun`).

### H-06 (P1) — wild driver `commitWild` rolls back a concurrent `ingestReport`

`startWildRun`'s loop is NOT in the `serialized` chain; each step awaited
`wildStep(cur)` then wrote `commitWild(cur)` = whole-project rebase, so
engine-owned rows appended to the live record by a concurrent writer while the
step was suspended (ingestReport artifacts/logs/memory, a human approve's
decision-journal entry, deepenResearch corpus rows) were silently rolled back
by the next commit — the caller had been told they applied.

**Fix** — new pure helper `rebaseConcurrentEngine(committed, stepInput, live)`
(next to `rebaseUserFields`): unions live rows whose key is absent from the
step's *input* generation (`stepInput` = the last committed project) into the
step's committed project, for the appended-only collections:
- `artifacts` by `id`
- `logs` by `` `${ts}:${event}` `` (then `.slice(-200)` — cap preserved)
- `decisions` by `id` (journal)
- `memory` by `id`
- `research` by `query` + sorted unique URL set (the H-04 helper shape)
Scalar engine state (phases/status/hitl/wildRun/packet/currentPhase/…) stays
owned by the committing step. `commitWild(next, prev)` now merges inside the
`set` updater (live read there, per repo discipline) and **returns the merged
project**; the driver loop continues from the merged generation so
`prev ⊆ live` always holds and an adopted row is never unioned twice (C1's
no-duplicate assertion locks this). No blocking of ingest/approve during a
run — merge, don't refuse (spec).

## Regression tests (src/lib/store.test.ts, appended section)

| # | Test | Asserts (pre-fix result in parentheses) |
|---|---|---|
| R1 | `executeAsync` keeps chat rows appended mid-run AND a pre-existing `implementationSpec` | pre-existing + mid-run rows survive the run's commit; spec intact (pre-fix: mid-run row dropped) |
| R2 | `runUntilHitlAsync` preserves chat rows appended mid-run through the multi-step commit | row survives the single whole-project commit (pre-fix: dropped) |
| R3 | chatLog stays capped at 40 after the rebase (50 appended mid-run) | exactly 40 rows, newest kept (pre-fix: 0) |
| C1 | concurrent `ingestReport` during `startWildRun` | ingest artifact + `agent.report` log survive every subsequent `commitWild`; exactly ONE ingest artifact (no duplicate unions); wild `wild.exec` logs + P4 park intact (pre-fix: artifact + log gone) |
| C2 | concurrent human `approve` during a resumed wild run | the approve's `decisions` journal entry (phase 4, human) survives the driver's next `commitWild` (pre-fix: dropped) |

Interleaves: R1-R3 use the spec's `queueMicrotask` append between the async
action's snapshot and its commit; C1 ingests synchronously in the driver's
first `await wildStep` gap; C2 approves synchronously between a PA-01 resume's
return and the classifier-pause commit.

## Verification (live, this pass)

- Pre-fix probe (temporarily reverted the two semantic hunks only, backup
  `%TEMP%/store.ts.fixed.bak`, then restored): all 5 new tests FAIL — 0/5 pass.
- Post-fix restore: store.test.ts **58/58 pass** (node --experimental-strip-types
  --test src/lib/store.test.ts, ~10 s).
- Repo typecheck `npx tsc --noEmit`: **exit 0, 0 errors**.
- Scoped eslint on the two owned files: **0 errors** (1 pre-existing warning in
  store.test.ts: unused `hydrateProject` import — predates this change, left
  untouched per minimal-diff discipline).

## Files changed

- `src/lib/store.ts` — `rebaseUserFields` +whitelist audit comment, +`chatLog`,
  +`kind`; new `rebaseConcurrentEngine`; `commitWild(next, prev)` union-merge +
  returns merged; driver loop threads `prev` and continues from the merged
  generation; +`ResearchCorpusEntry` type import.
- `src/lib/store.test.ts` — +5 regression tests (H-01 R1-R3, H-06 C1-C2).
- `fixes/119_hunter_store.md` — this log.

Log created 2026-09-07 by FLASH FIXER F-H1 (115 store-race lane). No other
files touched; H-03/H-02/H-04/H-05 remain with their owning lanes.
