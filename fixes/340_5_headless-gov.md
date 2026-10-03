# fixes/340_5_headless-gov.md — lane 340-5 (persona: headless-gov)

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD:** `a097fa8` · **Lane owns:**
`src/lib/headless.ts` · `src/lib/engine.ts` · `src/lib/quarantine.ts` · `src/lib/headless.test.ts` ·
`src/lib/quarantine.test.ts` · this log.
**Brief:** close R11-f08 (lift the forced-emit quarantine move INTO `emitProject`) and the R13-f02
classifier/pause half (plan review + pause before the first mutation). No full gate; only the two
suites on both runtimes. No keyed LLM calls.

**Environment note.** The working tree was **not** clean at start — sibling W340 lanes are editing
`cassette*`, `doctor*`, `verify*`, `scaffold*`, `llm/providers/*`, `mcp*` and their own logs. All my
edits are confined to the six owned paths above. `git stash`/`pop` was used twice: once **globally** to
check the HEAD typecheck baseline (it stashed and restored every working change, siblings' included,
with no conflict — `git stash pop` reported all files restored), and once with **only my three source
paths** specified for the RED capture (§3). No sibling file was modified by me.

---

## 0. Reconciliation (disk vs brief)

| Claim in brief | Disk verdict | Action |
|---|---|---|
| R11-f08 move lives only in the CLI `emit` arm; TODO is to lift it into `emitProject` | TRUE — `quarantine.ts:18` carried the TODO; `emitProject` returned `survivors: opts.force === true ? foreign : []` (kept in place); the CLI moved them after the fact | LIFTED (§1) |
| R13-f02 `${headless}.ts:5038/:5079` + `engine.ts:3899` name "classifier review of the rows + pause-before-mutation" | TRUE (line numbers had drifted; current markers at `headless.ts:5091`/`:5131` and `engine.ts:3899`) | IMPLEMENTED + markers removed (§2) |
| `types.ts:521` also carries `TODO(R13-f02)` | TRUE, but it is about **UI/packet surfacing** — a different piece, and `types.ts` is not mine | left; STOP-and-REPORT (§4.4) |
| CLI calls `quarantine.ts`; do not double-move | TRUE — CLI block at `scripts/rapidtool-cli.mjs:2032` | resolved by data: `survivors` is now always `[]`, so the CLI guard never fires (no double-move); envelope forwarding owed on the CLI → STOP-and-REPORT (§4.1) |

---

## 1. R11-f08 — the quarantine lift into `emitProject`

### 1.1 Bytes changed (`src/lib/headless.ts`)

| Line(s) (current) | Change |
|---|---|
| `:69` | `import type { QuarantineFailure } from "./quarantine.ts";` (type-only, erased) |
| `:2003-2017` | `EmitProjectResult.ok` gains `quarantined: string[]`, `quarantineDir: string \| null`, `quarantineMissing?: string[]`; `survivors` doc rewritten (always empty on ok — nothing survives in place) |
| `:2030-2034` | `EmitProjectResult` failure arm gains `quarantineFailed?: QuarantineFailure[]`, `judgingSkipped?: string` |
| `:2359-2388` | `emitProject` now performs the move for `opts.force === true && foreign.length > 0`: `await import("./quarantine.ts")` → `quarantineFiles(target, foreign)`; a failed move returns `{ ok:false, code:"RT_E_FOREIGN_FILES", foreign:<still-in-place>, quarantineFailed, judgingSkipped }` |
| `:2398-2403` | `survivors: []` (was `opts.force === true ? foreign : []`) + `quarantined`, `quarantineDir`, conditional `quarantineMissing` reported on the ok result |

Behavior: a forced emit **moves** the foreign walk leftovers into
`<dir>/.rapidtool-quarantine/<stamp>/<rel>` (recoverable, never deleted) and reports them; a move that
FAILS refuses the emit with `ok:false` + `RT_E_FOREIGN_FILES` + `judgingSkipped`, so any caller that
gates judging legs on the emit result cannot mint `tested` over a still-mixed tree. The move runs
outside the CLI **inside** the emit lock and after the write loop, so it is atomic with the emit.
`walkEmitRel` already skips `.rapidtool-quarantine` (`EMIT_SKIP_DIRS`), so a repeat emit never re-judges
it (pinned by the new test).

### 1.2 Marker removal (`src/lib/quarantine.ts`)

Header rewritten (`:14-23`): the `TODO(R11-f08)` paragraph is **gone**; the header now states the move
lives in `emitProject` for every forced caller, and that the CLI's own move is now a no-op (see §4.1).
`Select-String -Path src/lib/*.ts -Pattern "TODO\(R11-f08\)"` → **0**.

### 1.3 Idempotence / double-move resolution

`emitProject` now returns `survivors: []` on every ok result. The CLI's block
(`scripts/rapidtool-cli.mjs:2032`) is guarded by
`if (Array.isArray(res.survivors) && res.survivors.length > 0)`; with an empty list the guard is
**false**, so the CLI's `quarantineFiles` call is never made. Result: **no double-move**, and the CLI's
own `quarantineDriver()` becomes dead. This is the "removed" arm of "idempotent or removed", achieved
by data with **zero** CLI bytes. The consequence is reported (§4.1): the CLI envelope no longer carries
`quarantined`/`quarantineDir`, because the CLI builds its payload by hand and never copied the emit
result's new fields.

### 1.4 RED / GREEN (see §3 for raw output)

- RED (my three source files reverted to HEAD, new tests kept): `# tests 3 / # pass 0 / # fail 3`,
  incl. `not ok 2 - R11-f08 — emitProject quarantines forced foreign files (in-engine lift)`.
- GREEN: the two new R11-f08 tests + the updated A7 test pass on both runtimes (part of the 157/157).

---

## 2. R13-f02 — classifier plan review + pause before the first mutation

### 2.1 Bytes changed

`src/lib/engine.ts`

| Line(s) (current) | Change |
|---|---|
| `:3899-3900` | `readWildPlan` honest-empty note: `TODO(R13-f02)` removed → "...the run runs a classifier plan review and parks before the first mutation" |
| `:4344-4379` | NEW `export type WildPlanReview` + `export async function reviewWildPlan(project, reviewer, timeoutMs?)`. It routes through the **existing** `resolveWildReview` seam with `reason:"gate"` — a `"gate"` review never takes the deterministic DoD floor (that fallback is `"advance"`-only), so a plan verdict can only come from the classifier. Unconfigured/error/timeout are returned honestly. |

`src/lib/headless.ts`

| Line(s) (current) | Change |
|---|---|
| `:5091-5093` | `generateWildPlan` doc: the `TODO(R13-f02)` paragraph removed; names `stageWildPlan` as the review+pause site |
| `:5130-5132` | generated-plan `note`: no longer says "generation only … remain TODO"; states the classifier plan review + pre-mutation park |
| `:5176-5237` | NEW `async function stageWildPlan(project, reviewer)` — when a stored `source:"planner"` plan has no `wild.plan_review` row: review through `engine.reviewWildPlan` (or log an honest not-configured row when the reviewer is null), then `engine.wildPause(...)` with a real park `{ code:"RT_E_GATE_PENDING", unlock:"human-gate" }` and ledger rows `wild.plan_review` + `wild.paused_plan`; returns `{ project, staged:true }`. Idempotent: an existing `wild.plan_review` row short-circuits (a resumed run proceeds). |
| `:5277` / `:5475` | `reviewer?: WildReviewer` opts added to `wildStartHeadless` / `wildStartRun` (injectable seam; unset ⇒ `createNodeWildReviewer()` as before) |
| `:5291` / `:5497` | reviewer binding is now `opts.reviewer ?? (await createNodeWildReviewer())` |
| `:5301-5313`, `:5528-5541` | after `attachWildPlan`, call `stageWildPlan`; when `staged`, return immediately with `outcome:"paused"`, `steps:0` — the loop never runs, so no mutation happens before the review |

No edit to `src/lib/quarantine.test.ts` was required (the module's own behavior is unchanged).

### 2.2 Marker removal

`Select-String -Path src/lib/*.ts -Pattern "TODO\(R13-f02\)"` → only `src/lib/types.ts:521`
(UI/packet surfacing — a different piece, not owned; §4.4). The two `headless.ts` markers and the
`engine.ts:3899` marker are closed by the real bytes above.

### 2.3 RED / GREEN

- RED (sources reverted, new tests kept): `# tests 4 / # pass 1 / # fail 3`, `not ok 1 -
  R13-f02 — planner rows are reviewed and the run parks before the first mutation`.
- GREEN: 4/4 new R13-f02 tests pass on both runtimes.

### 2.4 Honest scope limit (also in §4.2)

The reviewer seam receives the review context whose `project.wildPlan` **is** the plan under review, so
an injected reviewer reads the rows directly. The **production** prompt
(`buildWildReviewPrompt`, `src/lib/wild-mode.server.ts`) renders project artifacts + DoD and does
**not** render `wildPlan` — so today's production classifier does not *see* the rows, and its rubric is
executed-phase-oriented. A dedicated plan-review prompt (or rendering `wildPlan`) belongs to
`wild-mode.server.ts`, which is not owned here; STOP-and-REPORTed (§4.2). The run still parks
correctly regardless (the pause is unconditional for a planner plan), so the "no execution without an
approved plan" gate is real bytes today.

---

## 3. Verification (both runtimes, RED + GREEN)

Host: `node v24.15.0`; Node 22: `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2. All runs
`--experimental-strip-types --test --test-reporter=tap`.

**Baseline (working tree at lane start — HEAD `a097fa8` plus sibling W340 lanes' in-flight edits to
files outside my ownership):** `src/lib/quarantine.test.ts` + `src/lib/headless.test.ts` →
`# tests 151 / # suites 43 / # pass 151 / # fail 0 / # skipped 0` on **both** runtimes.

**RED** — `git stash push -- src/lib/headless.ts src/lib/engine.ts src/lib/quarantine.ts` (my new tests
kept), then:

```
--test-name-pattern="R11-f08|quarantines it with force"  (node 24)
not ok 1 - A7 emitProject wipes ghost specs and refuses foreign files
not ok 2 - R11-f08 — emitProject quarantines forced foreign files (in-engine lift)
# tests 3 / # pass 0 / # fail 3

--test-name-pattern="R13-f02"  (node 24)
not ok 1 - R13-f02 — planner rows are reviewed and the run parks before the first mutation
# tests 4 / # pass 1 / # fail 3
```
`git stash pop` restored the sources; re-check `--test-name-pattern="R11-f08|quarantines it with
force|R13-f02"` → `# tests 7 / # pass 7 / # fail 0`.

**GREEN (final, both runtimes, both full files):**

| Runtime | Result |
|---|---|
| node v24.15.0 | `# tests 157 / # suites 45 / # pass 157 / # fail 0 / # cancelled 0 / # skipped 0 / # todo 0` |
| node v22.23.2 | `# tests 157 / # suites 45 / # pass 157 / # fail 0 / # cancelled 0 / # skipped 0 / # todo 0` |

Baseline 151 → 157 (**+6 tests, 0 removed**). No tracked file deleted.

**Typecheck (read-only, filtered):** `npx tsc --noEmit` reports **no** errors in `headless.ts`,
`engine.ts`, or `quarantine.ts`. The repo-wide run is red on `src/lib/scaffold.ts(1392,31)` /
`(1394,30)` — a sibling W340 lane's in-flight edit, not mine (confirmed by reverting only my paths:
HEAD `npm run typecheck` was clean).

---

## 4. STOP-and-REPORT (cross-file, not mine)

### 4.1 `scripts/rapidtool-cli.mjs` — forward the emit result's quarantine report

With the lift, `res.survivors` is always `[]`, so the CLI's block at `:2032` is skipped (no
double-move). The CLI payload must now read the report from the emit result.

- **Success path — exact one-line insertion after `const payload = {` closes (currently `:1995-2001`,
  insert after `:2001`'s `};`):**

  ```js
  if (Array.isArray(res.quarantined)) { payload.quarantined = res.quarantined; payload.quarantineDir = res.quarantineDir; if (res.quarantineMissing?.length) payload.quarantineMissing = res.quarantineMissing; }
  ```

- **Failure path — `:1992`:**

  old: `respond({ ok: false, error: res.error, code: res.code ?? "RT_E_VALIDATION", foreign: res.foreign }, 1);`
  new: `respond({ ok: false, error: res.error, code: res.code ?? "RT_E_VALIDATION", foreign: res.foreign, ...(res.quarantineFailed ? { quarantineFailed: res.quarantineFailed, judgingSkipped: res.judgingSkipped } : {}) }, 1);`

  (The legs are already suppressed on this path: `!res.ok` returns before `--verify-kind`/`--check`/
  `--run`; this change only surfaces `judgingSkipped`/`quarantineFailed` verbatim.)

- The now-dead block at `:2019-2050` (and its `QUARANTINE_PATH`/`quarantineDriver()` helper at
  `:490-497`) can be deleted.

### 4.2 `src/lib/wild-mode.server.ts` — plan-review prompt

`buildWildReviewPrompt` does not render `project.wildPlan`, so the production classifier cannot see the
plan rows for `reviewWildPlan`. A dedicated plan-review prompt (or rendering `wildPlan` in the
`"gate"` arm) is owed there; not owned by this lane.

### 4.3 `scripts/README-cli.md`

`:497-500` / `:1127` document `quarantined`/`quarantineDir` **on the CLI envelope**. Until §4.1 lands,
the CLI envelope no longer carries those keys (the emit *result* still does). The doc is accurate again
once the one-liner lands.

### 4.4 `src/lib/types.ts:521` and the console driver

- `types.ts:521` `TODO(R13-f02)` ("UI/packet surfacing") remains — a different piece, not owned.
- `src/lib/store.ts`'s console wild driver does not call `attachWildPlan`/`stageWildPlan` (it never
  generated a plan either), so a console-started run over a record carrying a stored planner plan would
  not park. Not owned; flagged for the store owner.

---

## 5. Mock / fake census

`Select-String` over `src/lib/headless.ts`, `src/lib/engine.ts`, `src/lib/quarantine.ts` for
`as any|@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable|catch {}|TODO(R11-f08)|TODO(R13-f02)|FIXME|XXX`
→ **0 hits**. Over my test edits for
`as any|@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable|.only(|.skip(` → **0 hits**.

The only test doubles are the **injected `reviewer` seam** (a plain async function returning a real
`WildClassifierResult` shape) — the repo's existing wild-review injection point, used by every
`wild-step`/`engine` test. No network, no key, no `DEEPSEEK_API_KEY` anywhere in the new tests. No
keyed LLM calls were made by this lane. No hardcoded "pass" returns in production code: the new tests
assert real state (park record, `pause`, ledger rows, on-disk quarantined bytes, and the failure arm
leaves the foreign file in place).

Every new test is falsifiable: RED above shows each fails with the pre-fix bytes.

---

## 6. What I did not do

- Did not touch any file outside the six owned paths (no `scripts/`, no `types.ts`, no
  `wild-mode.server.ts`, no `store.ts`, no CLI, no docs) — those needs are §4.
- Did not run the full gate, build, or any keyed/network path; ran only `src/lib/quarantine.test.ts` +
  `src/lib/headless.test.ts` on both runtimes, plus the filtered read-only `tsc` (§3).
- Did not delete any tracked file.
- Did not implement `@ts-*` suppressions, `as any`, silent catches, or placeholder bodies.
- Did not close the `types.ts:521` UI/packet-surfacing TODO (not owned) and did not wire the console
  store driver to the plan review (§4.4).

---

## 7. Resume 340-5 (headless-gov) — §4.1 and §4.2 closed

**Env.** Both runtimes: node `v24.15.0`; Node 22 `& "$env:LOCALAPPDATA\hermes\node\node.exe"`
`v22.23.2`. All runs `--experimental-strip-types --test --test-reporter=tap`. Scratch `$env:TEMP\rt340_5\`.
No repository file outside the four owned /* this resume's */ paths was changed; `src/lib/headless.ts`
stays the sibling lane's (this resume never opened it for edit).

**Ownership delta for this resume:** `src/lib/wild-mode.server.ts` + `src/lib/wild-mode.server.test.ts`,
and `scripts/rapidtool-cli.mjs` + `scripts/cli-exit-taxonomy.test.mjs` (the relevant behavioral CLI
suite) + `scripts/README-cli.test.mjs` (CLI source guard, run read-only). Nothing else.

### 7.1 Task 1 — the R13-f02 review now SEES the plan in production

`buildWildReviewPrompt` (`src/lib/wild-mode.server.ts`) rendered artifacts + DoD only. The plan review
(`engine.reviewWildPlan` → `resolveWildReview(..., "gate")` → the reviewer seam →
`wildClassifierReview` → this prompt) therefore judged an ABSENT plan — a real park over a vacuous
review. The stored planner rows are now rendered:

| `file:line` | Change |
|---|---|
| `src/lib/wild-mode.server.ts:179-197` | `PLAN_STEP_CAP = 12`; read `p.wildPlan`; render ONLY when `source === "planner"` and `steps.length > 0`; one line per row (`- <id>: <action> — <why>`, whitespace-collapsed so a row is always one line); row count capped with a named elision `… (N further step(s) omitted — the prompt shows at most 12)`. No invented rows, no prose. |
| `src/lib/wild-mode.server.ts:204` | `...(planLines.length > 0 ? ["", ...planLines] : [])` inserted after `Review reason:` — an absent/empty plan adds NO bytes (legacy prompt). |

Real before/after (gate review, 2 planner rows):
```
Review reason: an approval gate is open for this phase
                                   <-- legacy: plan absent (nothing between reason and the blank)
Plan under review (2 step(s)):
- s1: draft the core module — the brief's evidence row requires it
- s2: verify the module — machine-verification is the P6 bar
```
Byte-identical control across the change: the no-plan prompt is `717` UTF-8 bytes from HEAD and `717`
bytes from the fixed source, and the line arrays compare equal — the legacy prompt is unchanged.

**RED-first (new tests kept, `wild-mode.server.ts` reverted to HEAD via `git checkout --`, file backed
up in scratch and restored):**
```
--test-name-pattern="340-5"  (node 24)
not ok 1 - (a) a stored planner plan appears in the built prompt, one line per row
ok     2 - (b) absent or empty plan leaves the prompt byte-identical (legacy control)
not ok 3 - (c) the row cap is enforced with a visible elision marker
# tests 3 / # suites 1 / # pass 1 / # fail 2
```
The RED failure printed the legacy prompt with no `Plan under review` line — the exact vacuous-review
bytes. GREEN: 3/3 (see §7.3).

### 7.2 Task 2 — the CLI now forwards the quarantine report

Exact shapes from §4.1, landed:
- `scripts/rapidtool-cli.mjs:1992` — failure `respond` extended with
  `...(res.quarantineFailed ? { quarantineFailed: res.quarantineFailed, judgingSkipped: res.judgingSkipped } : {})`.
- `scripts/rapidtool-cli.mjs:2002` — after the ok `payload` closes:
  `if (Array.isArray(res.quarantined)) { payload.quarantined = res.quarantined; payload.quarantineDir = res.quarantineDir; if (res.quarantineMissing?.length) payload.quarantineMissing = res.quarantineMissing; }`.

The now-dead CLI move block (`:2032`) is left untouched (patch-only, minimal): `res.survivors` is always
`[]`, so its guard never fires and there is no double-move.

**Real forced-emit output** (temp emit dir, no keyed calls — `create` then `emit --force`):

Ok, one foreign file `CONTAMINANT.txt` present (`exit 0`):
```json
{ "ok": true, "count": 18,
  "quarantined": ["CONTAMINANT.txt"],
  "quarantineDir": "…\\tree\\.rapidtool-quarantine\\2026-10-03T08-13-44-636Z",
  "exit_code": 0 }
```
`CONTAMINANT.txt` is gone from the tree and present under `quarantineDir` (verified on disk).

Failed move (`.rapidtool-quarantine` is a FILE, so the quarantine mkdir/copy cannot create the stamp
dir — `exit 1`):
```json
{ "ok": false, "code": "RT_E_FOREIGN_FILES",
  "quarantineFailed": [{ "path": "CONTAMINANT.txt", "error": "move failed: ENOENT: …copyfile…" }],
  "judgingSkipped": "foreign files could not be quarantined — --verify-kind/--check/--run did not run (the tree is still mixed; R11-f08 · A1-f07)",
  "exit_code": 1 }
```
`CONTAMINANT.txt` remains in place (never dropped). Both legs are pinned by the new behavioral tests
in `scripts/cli-exit-taxonomy.test.mjs` (real spawns, real temp dirs).

**RED-first (new tests kept, `rapidtool-cli.mjs` reverted to HEAD):**
```
--test-name-pattern="R11-f08 \(340-5\)"  (node 24)
not ok 1 - …forwards quarantined + quarantineDir        (envelope.quarantined: undefined)
not ok 2 - …surfaces quarantineFailed + judgingSkipped  (quarantineFailed not forwarded)
# tests 2 / # pass 0 / # fail 2
```

### 7.3 Regression counts (both runtimes)

| Suite | node v24.15.0 | node v22.23.2 | Baseline → now |
|---|---|---|---|
| `src/lib/wild-mode.server.test.ts` | `# tests 31 / # suites 8 / # pass 31 / # fail 0` | same `31/8/31/0` | 28 → 31 (+3) |
| `scripts/cli-exit-taxonomy.test.mjs` | `# tests 36 / # suites 0 / # pass 36 / # fail 0` | same `36/0/36/0` | 34 → 36 (+2) |
| `scripts/README-cli.test.mjs` (source guard, read-only) | `# tests 12 / # pass 12 / # fail 0` | same `12/12/0` | unchanged |

No tracked file deleted. Test diffs are additive only (`+145 / -0` across the two test files).

### 7.4 Mock / fake census

`Select-String` over `src/lib/wild-mode.server.ts` + `scripts/rapidtool-cli.mjs` for
`as any|@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable|catch {}|FIXME|XXX` → **0 hits**.
Over the new test code for `.only(|.skip(|as any|@ts-*|eslint-disable` → **0 hits**. No mock/stub/fake
module, no placeholder body, no invented rows. The CLI tests are real end-to-end spawns against temp
emit dirs; the wild-mode tests call the real `buildWildReviewPrompt` (no network, no key, no
`DEEPSEEK_API_KEY`). No keyed LLM calls were made by this resume.

### 7.5 What this resume did not do

- Did not edit `src/lib/headless.ts` (now another lane's) — its ` M` in `git status` predates this
  resume; not touched. Did not edit `engine.ts`, `quarantine.ts`, `store.ts`, `types.ts`, or any doc.
- Did not delete the dead CLI move block at `:2032` (minimal patch; it is inert by data).
- Did not run the full gate, build, or any keyed/network path; ran only the three suites above on both
  runtimes (§7.3). Did not run repo-wide `tsc` (out of the stated run set); the TS change is
  type-shaped and tests exercise it under `--experimental-strip-types`.
- Did not close `types.ts:521` (UI/packet surfacing) or wire the console store driver (§4.4) — still
  not owned.

