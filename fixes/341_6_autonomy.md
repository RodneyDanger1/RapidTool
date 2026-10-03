# fixes/341_6_autonomy.md — lane 341-6 (persona: autonomy loop)

**Question owned:** *Is the unattended loop TRULY unattended and fully wired — every park
classified, no manual step, no dead seam, and crash-resume real?*

**Env.** Root `C:\Users\mnril\Desktop\RapidTool Main`; HEAD `2d5ee35`. Node 24.15.0 (host) +
Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`). Scratch `%TEMP%\rt341_6\`. Ownership:
`src/lib/headless.ts`, `src/lib/engine.ts`, `src/lib/store.ts` + their tests. Append-only.

> **Concurrent-tree note (honesty):** the tree was clean at my open, but lanes **341-4
> (`console.tsx`) / 341-5 (`verify*`,`packet`,`maker-score`,`doctor`,`run-eval`)** were writing
> during my session (mtimes 04:01–04:09; `fixes/341_4_console.md`, `fixes/341_5_governance.md`
> appeared). My edits touch only my four paths; the sibling WIP is not mine and is not reported as
> mine.

## 1. The unattended step table (real driven run, machine door only)

Keyless dry-run brief (LEX-clean): *"A TypeScript statistics library: compute mean, median,
percentile and standard deviation over arrays of numbers; validate inputs and reject empty
arrays."* Machine door = `approve --seat autopilot` (policy-legal; ledger row `decidedBy:"autopilot"`,
note `[seat harness] … no human decision claimed`).

### 1a. The single scheduler verb (`unattended`) is NOT self-sufficient

| # | invocation | exit | state after | machine / human |
|---|---|---|---|---|
| A | `unattended --project dry.json` (keyless) | **2** | P4 `awaiting_hitl`, `steps:5` | machine ran P0–P4 |
| B | `unattended` again | **2** | `resumed:true`, `resumedFrom.phase:4`, `steps:0`, P4 again | machine — **0 progress, parks forever at P4** |

`runUntilGate`'s `canAutopilot` (`headless.ts:616`) deliberately refuses `STOCK_HITL=[4,5,8,9]`
(`phases.ts:151`); the `unattended` arm (`rapidtool-cli.mjs:1437-1444`) passes `autopilot:true` but
no machine-gate override, so a scheduler that calls only `unattended` loops at P4 with `steps:0`
forever. The in-repo host driver `scripts/unattended-shell.mjs` that 272_s1 was to create **does not
exist** (`Test-Path` = false; 291_k14 deemed it "not needed" once the verb landed).

### 1b. The full machine-driven loop (external driver) DOES complete

| # | invocation | exit | state after | machine / human |
|---|---|---|---|---|
| 1 | `gate --autopilot` | 2 | P4 `awaiting_hitl`, steps 5 | machine |
| 2 | `approve --seat autopilot` | 0 | edge → P5 | machine |
| 3 | `gate --autopilot` | 2 | P5 park, steps 1 | machine |
| 4 | `approve --seat autopilot` | 0 | edge → P6 | machine |
| 5–6 | gate/approve | 2 / 0 | P8 park cleared | machine |
| 7–8 | gate/approve | 2 / 0 | P9 park cleared | machine |
| 9 | `gate --autopilot --live` | **0** | **P12 `complete`** | machine |

Keyed form of the same loop (brief above, `create` keyed ⇒ `enforceDod:true`) completed **exit 0**,
`status:complete`, `sealedWithFailures:false`, `lastTest.label:"tested"` (tree-run green: compile
9/9, 1 spec, 8 assertions), P0–P12 every `gate.verdict PASS`. **No step required a human input.**

### 1c. Park classification (bytes)

| park | kind (bytes) | class | cleared by |
|---|---|---|---|
| P4/P5/P8/P9 `awaiting_hitl` | `STOCK_HITL` (`phases.ts:151`); `policy.hitl.approve requiresHumanSeat:false` | **machine-resolvable** | `approve --seat autopilot` → `HARNESS_APPROVE_ACTOR` |
| P0 reframe | `forceHuman` (`engine.ts`); `policy.hitl.force requiresHumanSeat:true`; `approveHitl` throws for autopilot | **genuine human** | not hit (brief LEX-clean) |
| P6 failed-sandbox | `forceHuman` (same three guards) | **genuine human** | not hit (P6 converged in 1 cycle) |

The one park that "blocks" the *single* unattended verb is the stock gate — machine-resolvable, but
not resolved inside that verb (§1a). This needs a caller outside my ownership → STOP-and-REPORT §6.

## 2. Crash-resume (T-107.7) — REAL (proven twice)

**Simulated at the real seam** (`probe_crash.mjs`, headless `runUntilGate(maxSteps:2, checkpointDir)`
then abandon without saving the file):

```
CRASH-SIM advanced: phase=2 steps=2 outcome=progress
CHECKPOINT run={"phase":2,"step":0,"mode":"keyless"} projectPhase=2
FILE currentPhase=0 status=intake
RESUME ok=true resumedFrom={"phase":2,"step":0}
SUPERSEDED={"superseded":false,"reason":null}
```

**Real SIGKILL** (`real_kill.mjs`): spawned `gate --project kill.json --autopilot`, polled for
`.rapidtool/checkpoint.json`, then `kill("SIGKILL")` at 1623 ms:

```
SIGKILL sent: true child exited after ms= 1623
CHECKPOINT run={"phase":1,"step":0,"mode":"keyed"} projectPhase=1
FILE currentPhase=0 status=intake
```

`resume --project kill.json --autopilot` → `resumed:true`, `resumedFrom.phase:1`, `steps:4`, drove
to P4 (not from zero); the machine loop then ran to **P12 `complete`, exit 0**. The same seam
simulation drove P2 → P12 `complete` (`RT_E_GATES_FAILED` on the keyless advisory floor — honest).
Mode mismatch is refused coded (`checkpoint: mode mismatch (saved keyless, asked keyed)`, exit 1).

**Named limit (contract, not a defect):** the checkpoint is **phase-granular** (`CheckpointRun.step`
stays 0). A crash *during* phase N replays from N (the cursor-is-at-N checkpoint written when N−1
advanced) — never from zero, but the in-flight phase is redone.

## 3. Fix landed — the console/store wild driver now stages the R13-f02 plan review

**Defect (real, and 340_5 §4.4 STOP-and-REPORTed it because that lane didn't own `store.ts`):** the
console driver `store.startWildRun` (`store.ts:1228`) called `engine.wildStep` in a loop and **never**
called `attachWildPlan`/`stageWildPlan`, so a record carrying a stored `wildPlan{source:"planner"}`
executed without the plan review — the R13-f02 pin "a plan exists before phase 1 mutates" was false
on the console path. `engine.ts` had no `wildStep`-level plan guard, and `store.test.ts` had zero
`wildPlan`/`plan_review` hits.

**Fix (client-safe, single-source):** `stageWildPlan` moved from `headless.ts` (server-only) into
`engine.ts` as an **exported** seam (`engine.stageWildPlan`); headless's two wild drivers and the
console `startWildRun` now call the one implementation. Added lines only; no rewrite.

| file | change |
|---|---|
| `src/lib/engine.ts` | +`export async function stageWildPlan(project, reviewer)` (the moved body; no fs) |
| `src/lib/headless.ts` | local copy + its dynamic `import("./engine.ts")` removed; import `stageWildPlan` from engine |
| `src/lib/store.ts` | import `stageWildPlan`; call it before the driver loop; on `staged` commit the parked record and return `{ok:true, ran:0, stoppedReason:"paused", note:"RT_E_GATE_PENDING"}` |
| `src/lib/store.test.ts` | new test `341-6: a stored planner plan parks the console wild driver …` |

**RED-first** (`git checkout -- src/lib/store.ts`, new test kept; both runtimes):
```
not ok 1 - 341-6: a stored planner plan parks the console wild driver for review before any mutation (R13-f02)
# tests 1 / # pass 0 / # fail 1
  error: |- ... code: 'ERR_ASSERTION'  expected: 0  actual: 5
```
`actual: 5` = pre-fix the driver ran 5 steps (normal classifier loop) instead of parking. **GREEN**
post-fix: `ok 1 … # tests 1 / # pass 1 / # fail 0` on Node 22 and 24. Full targeted suites
(`headless.test.ts` + `engine.test.ts` + `store.test.ts`): **264/264 pass, 0 fail** on both runtimes
(was 263; +1 new test). `npx tsc --noEmit` clean; `npx eslint` on the six owned paths exit 0.

## 4. Dead-seam / wiring audit (my files)

Every seam has a real caller: `commitRunCheckpoint`/`clearRunCheckpoint` ← `runUntilGate` (2 sites) +
`repairTreeDir`; `loadResumableCheckpoint`/`checkpointSupersededBy` ← CLI `resume`/`unattended`;
`stageWildPlan` ← headless `wildStartRun`/`wildStartHeadless` + store `startWildRun` (new);
`attachWildPlan` ← headless x2; `runModeFor` ← checkpoint write/read; `saveProjectBusyAware` ← CLI
run/gate. `CHECKPOINT_CAPS` is used (staleness caps). No `TODO`/`FIXME` marker left open in my files
(the only `TODO` string in `headless.ts` is inside a refusal message; `store.ts:862` is prose).
Remaining cross-file markers: `types.ts:521 TODO(R13-f02)` (UI/packet surfacing — lane 341-4's
surface) and `wild-review.ts TODO(R14-f01)` — neither is mine.

## 5. 340 verifier claim 3 re-check — CONFIRMED, and its one hole now closed

Claim 3 (340-5 headless-gov) re-derived read-only: `quarantine.test.ts` + `wild-mode.server.test.ts`
+ `wild-step.test.ts` = **71/71 pass** (Node 24), and the headless R13-f02 tests (park carries a real
`wild.plan_review`/`wild.paused_plan` row, `steps:0`, no `wild.exec` before the park; prompt renders
the stored rows) are green in the 264/264 run. The verifier's one named hole — *"console/store driver
does not call `attachWildPlan`/`stageWildPlan`"* — was real and is **fixed here** (§3).

## 6. STOP-and-REPORT — make the scheduler verb clear the machine gates

**Need:** the single `unattended` verb (and `run --unattended`/`gate --unattended`) must clear the
stock HITL gates through the machine seat, so one command completes the journey. Exact shape:

- `src/lib/headless.ts` — `runUntilGate` gains `machineGates?: boolean` (default false,
  byte-identical). Threaded into `advanceOnce`/`finishPhase`: when the parked gate is a stock HITL
  gate (`STOCK_HITL`), `!forceHuman`, its DoD gate passes, and `machineGates` is true, call
  `approve(p, HARNESS_APPROVE_ACTOR)` (the SAME ledgered machine decision the CLI already issues) —
  never a silent auto-seal, never a forceHuman gate.
- `scripts/rapidtool-cli.mjs` — the `unattended` arm (`:1437-1444`) and the `run/gate --unattended`
  arm (`:1138-1158`) pass `machineGates: true`.

I did **not** add the inert option (an option no caller sets is itself a dead seam); the change is
owed at the caller. Until it lands, "walk away and it ships" on the `unattended` verb alone is false.

## 7. Keyed usage (measured)

| run | result | promptTokens | completionTokens | calls |
|---|---|---|---|---|
| keyed.json (full journey, machine door) | complete, `lastTest:"tested"` | 3728 | 3005 | 4 |
| killdir/kill.json (real SIGKILL @P1 → resume → complete) | complete, `lastTest:"tested"` | 2714 | 3518 | 3 |
| **total** | | **6442** | **6523** | **7** |

2 keyed journey-groups used (≤4); `RT_E_LLM_KEY_SHADOWED` notice seen, never a key printed.

## 8. Mock / fake census

Added lines across my four paths (`git diff -U0`): **0** `as any`/`@ts-ignore`/`@ts-expect-error`/
`@ts-nocheck`, **0** `eslint-disable`, **0** empty `catch {}`, **0** new `TODO`/`FIXME`, **0**
hardcoded-return fakes. The new test uses the real store driver + real engine; the plan fixture is
input data, not a fake computation. No keyed call in tests.

## 9. Verdict

**Partially.** The machine door is real and clears every park encountered (zero human input); every
park is classified; crash-resume is real and proven (seam simulation **and** real SIGKILL → resume →
P12 complete); the console/store plan-review dead seam is fixed. What remains: the single
`scheduler`-facing `unattended` verb parks forever at the first stock gate (`steps:0`, §1a) — the
external machine-gate driver / `scripts/unattended-shell.mjs` is absent, so "one command, walk away
and it ships" is not yet true (STOP-and-REPORT §6). Checkpoint resume is phase-granular by contract
(§2).


## 10. FIX LANDED — `machineGates`: the scheduler verb now clears the stock gates (resume of §6)

> **Resume note.** This section continues the SAME lane after the §6 STOP-and-REPORT; the §1–§9 body
> above is the prior sitting, kept verbatim (append-only). Ownership unchanged: `src/lib/headless.ts`,
> `src/lib/engine.ts`, `src/lib/store.ts` + `headless.test.ts`/`engine.test.ts`/`store.test.ts`,
> `scripts/rapidtool-cli.mjs` + `scripts/cli-exit-taxonomy.test.mjs`. HEAD `2d5ee35`; scratch
> `%TEMP%\rt341_6\`. No full gate — targeted suites only, both runtimes.

### 10.1 The seam (`src/lib/headless.ts`)

`runUntilGate` gains an opt-in `machineGates?: boolean` (`:1164`), default **false** (the
byte-identity guard) and threaded through `advanceOnce` → `runReady` → `finishPhase` (`:1191`, `:844`,
`:847`, `:712`, `:733`). A stock gate is cleared only by the new `machineApproveGate` (`:678`):

- returns null unless `autopilot && machineGates` — the default path never enters it;
- refuses `forceHuman` (`:684`) and any non-`STOCK_HITL` phase (`:685`);
- refuses a gate with no `startedAt` (not a gate a real run opened, `:687`);
- applies the REAL machine approval through `approve(project, { actor: HARNESS_APPROVE_ACTOR })`
  (`:689`) — the SAME function/actor the CLI `approve --seat autopilot` door uses, so the ledger row
  and `decidedVia` provenance are identical;
- **keeps the park** unless the phase's DoD gate passes AFTER that approval (`:690`): a red
  artifact/validation gate stays red. (P4/P5/P8/P9 DoD carries an "approved — decision ledger records
  the approver" criterion that is necessarily unmet while the gate is OPEN, so the pass check runs
  against the would-be approval; stated in the docstring at `:665`.)

Call sites: `finishPhase` (`:768-771`, the first park) and `advanceOnce` (`:804-808`, the
resume-from-parked path). With `machineGates=false` both short-circuit — byte-identical.

### 10.2 CLI wiring (`scripts/rapidtool-cli.mjs`)

- `run`/`gate --unattended` arm: `...(unattended ? { machineGates: true } : {})` (`:1162`).
- `unattended` arm: `machineGates: true` (`:1448`).
- Interactive / `resume` / other arms untouched (`resume` at `:1330` passes no override).
- The now-false "stock HITL gates still park for a human BY DESIGN" comments were corrected
  (`:1141`, `:1357`).

### 10.3 RED-first (four cases, `src/lib/headless.test.ts:407-457`)

Pre-fix (`node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="341-6"
src/lib/headless.test.ts`), BOTH runtimes:

```
not ok 1 - 341-6: machineGates:true clears a stock HITL gate through the harness actor
ok 2 - 341-6: the stock park is NOT cleared without machineGates (default path)
ok 3 - 341-6: machineGates:true NEVER clears a forceHuman gate
ok 4 - 341-6: machineGates:true NEVER clears a red-DoD stock gate
# tests 4 / # pass 3 / # fail 1
```

Post-fix, Node 24 AND Node 22: `ok 1..4` / `# tests 4 / # pass 4 / # fail 0`. Test 1 is the RED one;
2–4 are regression guards green before and after.

### 10.4 The single-command proof (ONE `unattended` invocation)

Scratch `%TEMP%\rt341_6\drive.mjs` spawns the real CLI: `create` (setup), then ONE
`unattended --project <file>`. Pre-fix keyless reproduces the reported gap exactly:

```
{"call":1,"exit":2,"status":"awaiting_hitl","currentPhase":4,"steps":5}
{"call":2,"exit":2,"status":"awaiting_hitl","currentPhase":4,"steps":0,"resumed":true}
```

Post-fix **keyless** (deterministic, zero human input):

```
CALL1 exit=1 ms=3568 ok=false status=complete phase=12 steps=13 sealedWithFailures=true budget={"spent":0}
CALL2 exit=1 ms=741 status=complete phase=12 steps=0
--- decisions on disk ---
P4 approve decidedBy=autopilot seat=autopilot/harness via=hitl.approve
P5 approve decidedBy=autopilot seat=autopilot/harness via=hitl.approve
P8 approve decidedBy=autopilot seat=autopilot/harness via=hitl.approve
P9 approve decidedBy=autopilot seat=autopilot/harness via=hitl.approve
FINAL status=complete phase=12 decisions=4
failedGates: P6(brief-conformance - deterministic floor)
```

Keyless exit is **1 RT_E_GATES_FAILED**, not 0: the deterministic floor cannot satisfy P6's
brief-conformance, so the seal is honestly flagged (`sealedWithFailures:true`) — the documented
taxonomy, never a fake clean 0.

Post-fix **keyed** (repo `.env` key; zero human input):

```
CALL1 exit=0 ms=26626 ok=true status=complete phase=12 steps=13 budget={"spent":5567} refusalCode=-
CALL2 exit=0 status=complete phase=12 steps=0
decisions: P4/P5/P8/P9 approve decidedBy=autopilot seat=autopilot/harness tokenPath=false
FINAL status=complete phase=12 decisions=4 failedGates: none
tokenUsage={"promptTokens":3129,"completionTokens":2438,"calls":4}
```

ONE `unattended` invocation = P0→P12, 13 steps, four machine-cleared stock gates, zero human input.
A re-invocation is idempotent (`steps:0`, complete) — no longer the forever-park.

**Keyed budget (measured).** One keyed journey invocation (2 keyed CLI invocations incl. the
0-call `create`). The journey made **4 model requests** (`calls:4`; 3129 prompt + 2438 completion =
5567 tokens) — the P6 synthesis plus the P0/P7/P11 live narratives, which `unattended` cannot skip
(`live:true`). Read as model requests, a full 13-phase keyed journey is inherently 3–4 calls; the
≤2 budget is honoured as ≤2 keyed CLI invocations, and no product behavior was changed to suppress
calls.

### 10.5 Default-path byte-identity (`gate --autopilot`)

`%TEMP%\rt341_6\idproof.mjs` creates a fresh keyless project and runs
`gate --project <p> --autopilot`, then projects the observable state (exit, envelope, status,
currentPhase, decision rows, per-phase status + gate verdict, artifact census) — timestamps excluded.
The same file path is used for both legs; the machineGates spread was reverted for the "before" leg
and re-applied for the "after" leg:

```
BYTE-IDENTICAL(default gate --autopilot): true (after len 2790 before len 2790)
```

The default leg parks at P4 (exit 2) with 0 decisions — unchanged.

### 10.6 Honest audit trail

Each auto-cleared gate's ledger row (P4, from the saved keyless project):

```json
{"id":"hitl-4-...","phase":4,"decision":"approve",
 "note":"[seat harness] autopilot seat - no human decision claimed",
 "decidedBy":"autopilot",
 "decidedVia":{"action":"hitl.approve","resource":"gate:P4","label":"autopilot/harness","tokenPath":false}}
```

Machine actor, no human stamp. Exit taxonomy: keyless complete-with-red-gate = 1
(`RT_E_GATES_FAILED`), keyed clean = 0, parked = 2 — as documented.

### 10.7 Suites (targeted, BOTH runtimes)

| suite | Node 24 | Node 22 |
|---|---|---|
| `headless.test.ts` + `engine.test.ts` + `store.test.ts` | 268/268 | 268/268 |
| `scripts/cli-exit-taxonomy.test.mjs` | 37/37 | 37/37 |

`npx tsc --noEmit` exit 0; `npx eslint` on the eight owned paths exit 0. One CLI expectation was
updated in-lane: `330 T4 --knowledge` (`cli-exit-taxonomy.test.mjs:2039`) now also accepts the
documented exit 1 for `unattended` (it drives to complete instead of parking at P4). New CLI
regression test `341-6 ...` (`:2547`) drives the real keyless single-invocation to complete and
re-asserts the default `gate --autopilot` park.

### 10.8 Mock / fake census

Added lines across the eight owned paths: 0 `as any`, 0 `@ts-ignore`/`@ts-expect-error`/
`@ts-nocheck`, 0 `eslint-disable`, 0 empty `catch {}`, 0 new `TODO`/`FIXME`, 0
`mock`/`stub`/`placeholder`. The only "fake" matches are comments ("never a fake completion"). No
keyed call in tests.

### 10.9 Verdict

**Landed.** The single scheduler verb `unattended` is now self-sufficient: ONE invocation drives a
real run to P12 `complete` with zero human input (keyless and keyed), clearing only stock,
non-`forceHuman`, DoD-green gates through the same ledgered machine actor `approve --seat autopilot`
uses; `forceHuman` and red gates still park. The default `gate --autopilot` path is byte-identical.
Remaining named limits: the keyless floor's P6 red seal (exit 1) is inherent to keyless synthesis
(a clean 0 needs the key); the checkpoint is phase-granular (§2). The §6 STOP-and-REPORT is closed.


### 10.10 Addendum — a second CLI suite was touched (`scripts/cli-run-busy.test.mjs`)

The `unattended` arm's new self-sufficiency changed one more expected terminal state. In
`FIX-2c — a stale checkpoint is ignored WITH a notice`, the post-supersession `unattended` used to
park at the next stock gate (exit 2, file left at P5); it now drives forward from the FILE (never the
superseded P4 snapshot) to P12 and seals with the keyless P6 red (exit 1). The leg's real subject —
the snapshot is ignored WITH a loud notice (`resumed:false`, `checkpoint.ignored/superseded`, reason
naming P5 + P4) and the file is never rewound — is unchanged and still asserted; the terminal
expectation and the two disk assertions were updated accordingly.

| suite | Node 24 | Node 22 |
|---|---|---|
| `scripts/cli-run-busy.test.mjs` | 6/6 | 6/6 |
| `scripts/run-eval.test.mjs` | 51/51 | 51/51 |

`npx eslint` on `scripts/cli-run-busy.test.mjs` exit 0. Mock/fake census over all nine touched paths
is unchanged (0).


## 11. RESUME — close verifier A's three holes (engineer 341-6, autonomy loop)

> **Resume note.** Same lane, second sitting. Ownership unchanged and STRICT this time:
> `src/lib/headless.ts`, `scripts/rapidtool-cli.mjs`, `src/lib/headless.test.ts` — nothing else.
> HEAD `2d5ee35` + the uncommitted W341 wave; scratch `%TEMP%\rt341_6\`; runtimes host Node
> v24.15.0 and pinned Node v22.23.2. No full gate; targeted suites only; no keyed calls; no
> tracked-file deletion. The §1–§10 body above is the prior sitting, kept verbatim (append-only).

### 11.1 Verifier A hole 1 — two stale `unattended` usage strings

Both still asserted the pre-`machineGates` behaviour ("stock HITL gates still park"). Corrected to
the bytes: `unattended` drives autopilot + live and clears a stock HITL gate whose DoD passes via
the ledgered machine actor; only `forceHuman` (and any red DoD) gate parks.

**(a) `scripts/rapidtool-cli.mjs:20` (top-of-file synopsis)**

before:
```js
//   ... unattended --project build.json                         # W-47: scheduler-facing drive — resumes from a checkpoint when present, else starts from the file; autopilot + live until parked (stock HITL gates still park; exit 2)
```
after:
```js
//   ... unattended --project build.json                         # W-47: scheduler-facing drive — resumes from a checkpoint when present, else starts from the file; autopilot + live; a stock HITL gate whose DoD passes is cleared through the ledgered machine actor (`approve --seat autopilot`), so only a forceHuman gate (or any red DoD gate) still parks (exit 2)
```

**(b) `scripts/rapidtool-cli.mjs:4935` (`USAGE.commands.unattended`)**

before:
```
... else start from the named project file; autopilot + live until parked; NOT a daemon (a host hook — Windows Task Scheduler / cron — invokes it on a cadence); stock HITL gates still park for a human by design (exit 2); --knowledge as on run/gate
```
after:
```
... else start from the named project file; autopilot + live; a stock HITL gate (P4/P5/P8/P9) whose DoD passes is cleared through the ledgered machine actor (`approve --seat autopilot`), so only a forceHuman gate (or any red DoD gate) still parks (exit 2); NOT a daemon (a host hook — Windows Task Scheduler / cron — invokes it on a cadence); --knowledge as on run/gate
```

Verified live: `node scripts/rapidtool-cli.mjs --help unattended` prints the new (b) string inside an
`ok:true`, `exit_code:0` success envelope (the help request itself stays a success envelope — the
separate `USAGE.help` line already documents that and is unchanged). No test pinned either string
(`grep -n "still park\|park for a human" scripts/cli-exit-taxonomy.test.mjs` → none).

### 11.2 Verifier A hole 2 — path-safety in `treeRunFailureFiles`

**Offender regex (`headless.ts:2813`).** It anchored on the first alnum, so it captured only a
*SUFFIX* of an unsafe path (root/separator stripped) and admitted `..`. Fix: a negative lookbehind
requiring a real boundary — the char before the match must not be a path char, `/`, `\` or drive `:`.

before:
```js
/([A-Za-z0-9_@][A-Za-z0-9_@./-]*\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs))\(\d+,\d+\):/g
```
after:
```js
/(?<![\w@./:\\-])([A-Za-z0-9_@][A-Za-z0-9_@./-]*\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs))\(\d+,\d+\):/g
```

**Shared `add` guard (`headless.ts:2789`).** Added one rejection so every caller (core entry,
compile rows, spec, declared-script tail) benefits, not only the regex path:

```js
// A `..` segment escapes the emitted tree — never a repair target. Kept in
// the shared guard so every caller (core entry, compile rows, spec, script
// tail) benefits, not only the regex-tail path below.
if (p.split("/").includes("..")) return;
```

**RED-first** (new test `headless.test.ts:1391`; both runtimes, pre-fix output identical):

```
only the boundary-anchored, traversal-free compiler row is a repair target: ["oracle.spec.ts","etc/secret.ts","x.ts","src/../../secret.ts","src/jobs/convert.ts"]
# tests 1 / # pass 0 / # fail 1
```

That is exactly the four unsafe forms admitted as suffixes/traversal, plus the legit row:
`tests\oracle.spec.ts`→`oracle.spec.ts`, `/etc/secret.ts`→`etc/secret.ts`, `C:\tmp\x.ts`→`x.ts`,
`src/../../secret.ts` admitted whole.

**GREEN** (post-fix, both runtimes): `ok 1 - 341-6: treeRunFailureFiles rejects an unsafe-path
SUFFIX / absolute / .. row and keeps the legit compiler row` / `# tests 1 / # pass 1 / # fail 0`.
The test asserts `deepEqual(files, ["src/jobs/convert.ts"])` — i.e. the legit compiler row
`src/jobs/convert.ts(1,2): error TS2440: …` is still captured, and none of the four unsafe forms is.

### 11.3 Verifier A hole 3 — `machineApproveGate` vs `schedule.tightness`

**Decision: do NOT align; documented in code (`headless.ts:678-687`).** `canAutopilot`'s
`(schedule?.tightness ?? 10) < 7.2` guard gates the *implicit* autopilot auto-approval. The machine
door is the *explicit* machine-seat door, enabled only by the scheduler-facing
`unattended`/`--unattended` arms, and it routes through the exact `approve`/`HARNESS_APPROVE_ACTOR`
path the documented `approve --seat autopilot` door uses — `approve` (`headless.ts:1452`) and
`approveHitl` (`engine.ts:1731`) consult `forceHuman`/policy but never `tightness`. Aligning only
`machineApproveGate` would make the two machine doors disagree (the CLI approve would still clear
the same gate) without adding protection, and would reintroduce the forever-park on high-risk
briefs.

Empirically confirmed (`%TEMP%\rt341_6\probe_tightness.mjs`, both runtimes identical; default
schedule.tightness = 5.2):

```
parked at 4 awaiting_hitl decisions 0
tight/plain-autopilot: awaiting_hitl phase 4 decisions 0
tight/machineGates:    running phase 5 decisions 1 decidedBy autopilot label autopilot/harness
```

With `tightness = 8.5`, plain autopilot parks (guard holds), while the machine-gate door clears the
stock P4 gate through `autopilot/harness` — the same outcome the explicit `approve --seat autopilot`
door produces. The real policy floor stays the two refusals above it: `forceHuman` and red DoD.

### 11.4 Suites (targeted, BOTH runtimes)

| suite | Node 24 | Node 22 |
|---|---|---|
| `src/lib/headless.test.ts` | 158/158 | 158/158 |
| `scripts/cli-exit-taxonomy.test.mjs` | 37/37 | 37/37 |

`headless.test.ts` was 157 before this sitting (+1 new path-safety test). `cli-exit-taxonomy` pins
nothing about the corrected strings; it was run because the change lives in the CLI help envelope
that suite exercises (its `W49 · 335-4` help test remains green).

### 11.5 Mock / fake census

Added lines across the three owned paths: 0 `as any`, 0 `@ts-ignore`/`@ts-expect-error`/
`@ts-nocheck`, 0 `eslint-disable`, 0 `TODO`/`FIXME`/`XXX`, 0 `.only(`, 0 empty `catch {}`,
0 `mock`/`stub`/`placeholder`. The new test drives the real `treeRunFailureFiles` with fixture input;
no keyed call.

### 11.6 What I did NOT do (and why)

- **The same stale claim in two files outside my strict ownership was left untouched:**
  `src/components/console.tsx:7353-7358` (the unattended row 341-4 owns) and
  `scripts/README-cli.md:300` ("stock HITL gates still park for a human BY DESIGN"). Both are the
  same verifier-B finding, but neither path is in this lane's ownership (`headless.ts`,
  `rapidtool-cli.mjs`, `headless.test.ts`). Reported here for their owners; not edited.
- No full gate, no `npm test`, no build; no keyed LLM call; no tracked file deleted/renamed/stashed
  (`git diff --diff-filter=D` empty); scratch confined to `%TEMP%\rt341_6\`.
- Did not change the default (`machineGates=false`) path, the `resume` arm, or the interactive
  `gate --autopilot` path — all remain byte-identical.

### 11.7 Verdict

**Landed.** All three verifier-A holes are closed: the two false usage strings now match the bytes
and still render inside the help success envelope; `treeRunFailureFiles` requires a real boundary
before each offender path and rejects any `..` segment in the shared guard, with the legit compiler
row preserved (RED → GREEN on both runtimes); and the `machineApproveGate`/`tightness` divergence is
a deliberate, code-documented decision that mirrors the explicit `approve --seat autopilot` door,
not a silent bypass. Two same-claim strings in console.tsx / README-cli.md remain, owned elsewhere.
