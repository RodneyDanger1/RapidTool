# 39 — Bug Hunt: Coding Process + Backend (verified register)

**Scope (read-only):** coding-process pipeline — `src/lib/engine.ts`
(phase synthesis / applyPhaseResult paths), `src/lib/verify.server.ts` +
`src/lib/verify.ts` (verify-fix loop), `src/lib/node-runner.server.ts`
(timeout kill / scratch / stdout), `src/lib/sandbox.ts` (template gen,
healSource); backend — `src/lib/store.ts` (serialized(), partialize,
rebaseUserFields), `src/lib/headless.ts` (atomic saves, loader, envelopes),
`scripts/rapidtool-cli.mjs` (25 subcommands, exit codes, args),
`src/lib/io.ts`, `src/lib/packet.ts`, `src/lib/dod.ts`. Also read:
`phases.ts`, `types.ts`, `exec.ts`, `console.tsx` (call sites).
**Method:** full-file reads (all ~9,300 lines of the scope), call-site greps,
plus executable probes against the real modules (temp script in
`~/rt-probe-39`, since deleted — outputs quoted below). **No source file
was modified.**

Legend: **P0** = corrupts state/fabricates truth in reachable flows ·
**P1** = integrity/honesty contract broken or functional dead-end in a real
flow · **P2** = parity gap / bookkeeping / defensive gap.

---

## P1

### 1.1 runCases: machine "PASS" is forgeable by a case expression (verify-loop honesty break)
**File:line:** `src/lib/verify.server.ts:64-160` (sanitizer), `:314`
(with-wrapper eval), `:380-391` (verdict parse + mint), `:387-391` (pass
condition); `src/lib/node-runner.server.ts:227-233` (ok minted regardless of
exit code).
**Bug:** `sanitizeOracleExpression` only rejects `;`, backticks, comments,
unbalanced delimiters and line terminators. It permits immediately-invoked
function expressions and comma-operator chains, and the harness evaluates
each case as `new Function('exports', 'with(exports){ return (EXPR); }')` in
the child's **global** scope — so `console`, `process`, `Buffer` are all
reachable. One hostile expression can (a) print forged `ORACLE_RESULT <id>
pass` lines for every case, (b) **replace `console.log` with a no-op** so the
harness's own per-case verdict lines (printed after each eval) are silenced,
and (c) return `true`. The child then exits 0 with exactly `n` forged lines:
`results.length === cases.length && every pass` → `run.pass === true` even
when the real assertions would throw. The verdict stream is unauthenticated
stdout, and `runNodeBounded` marks `ok:true` for ANY exit code (`:227-233`),
so no exit-code check backstops it. `verifyAndFixServer` (`:458-466`) then
mints `status:"passed"` + evidence "n/n machine-run cases passed" —
fabricated graph truth. Reachability: the oracle cases come from a remote
model that also sees the user-controlled brief + generated source (injection
surface), and the fix-model output is re-run against the same harness.
**Repro (verified, probe B):** cases `[{id:"case-1", expression:
"(function(){ console.log('ORACLE_RESULT case-1 pass'), console.log('ORACLE_RESULT
case-2 pass'), (console.log = function(){}) })(), true"}, {id:"case-2",
expression:"(function(){ throw new Error('REAL CHECK FAILS') })()"}]` against
a source whose real behavior throws → `runCases` returned
`pass:true`, results `[case-1 pass, case-2 pass]`, no compileError. (Sanitizer
acceptance also verified standalone; node-runner `ok:true, exitCode:7`
verified in probe C.)
**Fix spec:**
1. Capture the real printer before any eval: harness uses
   `const __log = console.log.bind(console)` and every verdict line goes
   through `__log`; expression scope cannot reach `__log`.
2. Run each expression Function with parameter shadowing like the worker
   isolate: `new Function('exports','console','process','with(exports){…}')`
   passing throwing stubs — and/or extend the sanitizer to reject
   `console`, `process`, `globalThis`, `function`, `=>` tokens (mask
   strings/comments first, like sandbox.ts `maskLiteralsAndComments`).
3. Require `run.exitCode === 0` and results in exact case order with exact
   id sequence before a pass may be minted.
4. Validate/sanitize case `id` (strip control chars incl. `\n`) before the
   harness interpolates it (`verify.server.ts:347`, `:315`).
5. Optionally per-run random nonce prefix on `ORACLE_RESULT` so only the
   harness can mint parseable verdict lines.

### 1.2 DoD p7-research waiver is documented but never implemented — enforceDod projects dead-end at P7 when live research is unavailable
**File:line:** `src/lib/dod.ts:179-183` (probe) vs the contract claims in
`src/lib/types.ts:310-316` ("meta.liveUnavailable … the DoD p7-research
waiver key") and `src/lib/errors.ts:176` ("set liveUnavailable so the
documented gate waiver applies").
**Bug:** `engine.liveLayer` (`engine.ts:1662-1677`) and `deepenResearch`
(`:1854-1856`) stamp `meta.liveUnavailable = true` when a research phase ran
but live research could not execute (no key / network failure), and two
contract comments promise a "gate waiver" — but `runGate`'s `p7-research`
probe only checks `(p.research?.length ?? 0) > 0` and never reads
`meta.liveUnavailable`. With `enforceDod: true` (P10 opt-in), a P7 whose
live pass was attempted-but-unavailable is **hard-blocked forever**: the
store finishPhase/advanceOnce guards (`store.ts:296-306`, `:361-371`) and the
wild leave check (`engine.ts:2266-2279`) refuse to leave P7, and the escape
(`deepenResearch`) requires working live research — exactly what is
unavailable. The recorded `gate.verdict` is likewise FAIL while the packet
carries an explained `liveUnavailable` dead-end.
**Repro:** project with `enforceDod:true`; P7 synthesized via liveLayer with
research backend failing/not configured (items 0, `unavailable:true`,
`meta.liveUnavailable:true`, deterministic P7 corpus) → `runGate(p,7).pass`
is false (`p7-research` unmet) → any auto-advance stops with a Hard DoD block
artifact; no waiver anywhere (`grep liveUnavailable` hits only engine/errors/
types/swarm — never dod.ts).
**Fix spec:** make the waiver real and honest in `dod.ts:182`:
`probe: (p) => (p.research?.length ?? 0) > 0 || p.meta?.liveUnavailable === true`
— and have `recordGateInto`/`store.recordGate` surface the waiver in the gate
artifact body + `gate.verdict` log (e.g. "p7-research waived:
liveUnavailable") so a recorded PASS stays explainable. Gate-recording call
sites need no other change. Alternatively drop the waiver wording from
types.ts/errors.ts if a hard block is truly intended — today the docs and
behavior contradict each other.

### 1.3 Real module run of a healthy P6 always flips the recorded gate to FAIL (quiet-run detail "")
**File:line:** `src/lib/engine.ts:1966-1968` (`runP6Real` detail =
`(stdout || stderr || "").slice(0,400)`), `src/lib/dod.ts:126-133`
(`p6-test` probe requires `detail.length > 0`), `src/lib/store.ts:210-217`
+ `:846` (`convergeRealRun` → re-recorded gate).
**Bug:** the P6 engine template (`sandbox.ts:125-161`) only declares
functions and prints nothing when executed. A real bounded run
(`store.runModuleReal` → `runP6Real` → `runCode`) of a healthy module exits 0
with empty stdout/stderr, so `lastTest = {ok:true, detail:""}` — and the
`p6-test` probe demands a non-empty `detail` string. `convergeRealRun`
re-records the P6 gate against that shape, so **every** successful real run
turns a previously PASSING P6 gate into FAIL (`gate.verdict` warn + FAIL gate
artifact). With `enforceDod:true` the project then hard-blocks at P6 forever
— re-running the real module reproduces the same empty detail.
**Repro (verified, probes D1+D2):** `runNodeBounded(buildPhase6Module({name,
jobs:["core"]}))` → `ok:true, exitCode:0, stdout:"", stderr:""`; then
`runGate(project6, 6)` with `lastTest:{ok:true, detail:""}` →
`unmet: [p6-test, p6-verified]`, `pass:false`.
**Fix spec:** in `engine.ts:1967` give quiet runs a non-empty honest detail,
e.g.
`const detail = (result.stdout || result.stderr || \`exit ${result.exitCode} (no output)\`).slice(0,400);`
— keeps the probe semantics (real evidence exists) without inventing a
pass. Optionally also relax `dod.ts` p6-test to accept `label:"real-run"`
with `ok:true`; engine-side detail fallback is the smaller, sufficient fix.

---

## P2

### 2.1 executeAsync drops the hard-DoD block branch (sync execute has it) — 0-progress "success"
**File:line:** `src/lib/store.ts:727` (condition lacks `|| next.dodBlocked`;
sync `execute` at `:642` includes it); `advanceOnceAsync` emits dodBlocked at
`:477-489`; UI swallows the lie at `src/components/console.tsx:1334-1337`
(error shown only when `!res.ok`).
**Bug:** after a run parks on a hard-DoD block (cursor on a complete phase,
enforceDod on, gate failing), the next `executeAsync` (UI step button) hits
advanceOnceAsync's dod-blocked error — but the branch test misses
`dodBlocked`, so the block artifact IS committed by the fall-through `set`
and the action returns `{ok:true}` with the error text discarded. The UI
shows a successful step that made zero progress, and the honest
`dod.blocked`/error is invisible. runUntilHitlAsync (`:761`) handles
dodBlocked correctly — single-step async does not.
**Fix spec:** mirror `execute`: `if (next.error && (next.project === project
|| next.gateDenied || next.dodBlocked))`, persist `next.project` when
`dodBlocked && next.project !== project`, return `{ok:false, error}`.

### 2.2 ingestReport appends the "no tests_run evidence" warn on duplicate retries
**File:line:** `src/lib/store.ts:884-899` (warn appended unconditionally
inside `set`), E-09 duplicate contract at `report-intake.ts:263-265`.
**Bug:** a duplicate retry of an evidence-less "complete" report returns
`applied:false` but still gets a fresh `agent.report` warn log row each
retry — the duplicate no-op contract (lost-ack recovery = success, no state
change) is violated and logs fork per retry.
**Fix spec:** gate the warn on `result.applied`: only append
`"complete report with no tests_run evidence"` when the apply actually
landed.

### 2.3 rebaseUserFields preserves only name/notes/createdAt — operator toggles clobbered by async commits
**File:line:** `src/lib/store.ts:142-150` (rebaseUserFields), call sites
`:744`, `:798`, `:851`, `:1046`.
**Bug:** sync user edits that land mid-flight of a serialized async action
are preserved for name/notes/createdAt only. `setEnforceDod` /
`setWildMode` / `stopWildRun` / `toggleWildPause` (all sync) are reverted by
the async action's whole-project commit computed from the pre-toggle
snapshot — e.g. toggling enforceDod ON while an LLM-backed run is in flight
is silently undone on commit.
**Fix spec:** widen the rebase to the operator-owned surface:
`enforceDod`, `wildMode`, `wildRun`, `autopilot`-adjacent per-project flags
(and any future toggle) — copy them from `live` like name/notes; or rebase
per-field with an explicit engine-owned field allowlist.

### 2.4 Headless driver never enforces enforceDod (store parity gap) — CLI/agent runs ignore P10
**File:line:** `src/lib/headless.ts:342-371` (finishPhase auto-advance),
`:373-419` (advanceOnce complete-branch) — no `enforceDod` gate anywhere in
the file; store parity: `store.ts:296-306` / `:361-371`.
**Bug:** a project persisted with `enforceDod:true` advances past failing
exit gates on every headless path (`run`/`gate`, `wild` wrapper at
`headless.ts:1499-1524` still delegates to engine.wildStep whose own
leave check exists but headless runUntilGate + CLI `approve`→`finishPhase`
advance regardless). An agent driving via the CLI bypasses the only
machine-level guarantee the flag promises.
**Fix spec:** mirror store: in headless `advanceOnce` complete-branch and
`finishPhase` auto-advance, when `project.enforceDod === true` run
`runGate(project, phase)` and return/stop with
`hardDodBlockInto(project, phase, r)` + `hardDodMessage` (imports already
present).

### 2.5 CLI approve can approve a failing-P6 gate without --force (store guard parity gap)
**File:line:** `src/lib/headless.ts:498-515` (headless.approve passes
`force` straight through; engine `approveHitl` `engine.ts:916-920` only
blocks autopilot) vs the store's explicit-override requirement
`src/lib/store.ts:962-975`.
**Bug:** the UI requires ticking "I reviewed the failure" (`opts.force`) to
approve a failed P6 sandbox gate; `rapidtool-cli.mjs approve --project …`
(no `--force`) succeeds silently on the same gate — the R3/B-03
override ritual (and its `hitl.approved_override` warn log + override memory
row, minted only when `opts.force` was passed, `engine.ts:928-964`) is
skippable on the agent path.
**Fix spec:** in headless.approve (or CLI) refuse when
`project.hitl.forceHuman && phase===6 && lastTest && !lastTest.ok &&
!opts.force` with the same error the store returns; require `--force`.

### 2.6 Approval path lacks priors-sealed / phase-record guards (imported-state integrity)
**File:line:** `src/lib/engine.ts:900-991` (approveHitl — no
`priorsSealed`/status check), `src/lib/store.ts:955-993` (store.approve)
vs the reject-side status guard at `store.ts:1004` and the
advance-guard parity in wildLeavePhase `engine.ts:2283-2292`.
**Bug:** a shape-valid imported/persisted payload (phases 0-3 locked, P4
`awaiting_hitl` + stale `hitl`, `currentPhase:4`) hydrates cleanly —
`hydrateProject` only repairs a LOCKED record at the edge — and
approve/CLI-approve happily completes P4 and marks P5 ready over an unsealed
history (a state no engine flow can produce). Subsequent runReady guards
stop further progress, but the ledger now carries a fabricated
completion+approval. Engine approveHitl also never checks the record is
`awaiting_hitl`.
**Fix spec:** in approveHitl refuse (return project unchanged) when
`rec?.status !== "awaiting_hitl"` or `!priorsSealed(project.phases, phase)`
— the same parity `rejectHitl`/advance paths already enforce.

### 2.7 node-runner: output-cap kill mislabeled reason "timeout"; POSIX timeout leaves grandchildren
**File:line:** `src/lib/node-runner.server.ts:185-202`
(ERR_CHILD_PROCESS_STDIO_MAXBUFFER → `reason:"timeout"`), `:56-63` +
`:236-244` (tree-kill is win32-only `taskkill`; POSIX timeout kills only the
direct child with SIGKILL — grandchildren survive and keep running).
**Bug:** (a) a 1 MB runaway writer is reported as a timeout — verify
evidence ("killed: output exceeded the 1 MB capture cap" is the message but
`reason:"timeout"` shapes the caller's branch: `runCases` compileError reads
"timeout"); (b) on Linux/macOS a timed-out child that spawned its own
processes leaks them (no process-group kill; the module's own header claims
"tree-kill + SIGKILL" without the win32 caveat).
**Fix spec:** (a) mint a distinct reason (`"error"` with the honest message,
or a new `"output-cap"` reason + code) for the maxBuffer kill; (b) spawn the
child in its own process group on POSIX (`detached:true` + `process.kill(-pid,
'SIGKILL')` on timeout) so the wall-clock kill reaps the tree, mirroring
taskkill /T.

### 2.8 healSource can never fire for engine templates (dead healing path)
**File:line:** `src/lib/sandbox.ts:105-110` (healSource trigger:
`error.includes("test_happy") && !source.includes("function test_happy")`);
call site `src/lib/engine.ts:504-511`.
**Bug:** engine P6 sources always contain `function test_happy`, and every
error a template run can throw ("job mismatch", "expected ok", "invalid
phase", "unknown job", "should reject illegal phase", "deploy blocked…",
"rejection not addressed") lacks the substring `test_happy` — so the heal
branch is dead by construction and `heal.repaired` (logged with
"self-healing produced a repaired module") can never be true; the heal.noop
honesty log is the only reachable arm (verified probe E1: healSource returns
the template unchanged for a template failure).
**Fix spec:** delete the branch or make it real — e.g. recognize the known
thrown-error classes and append the missing `test_*` helper deterministically
— or at minimum drop the misleading `heal.repaired` wording/event when the
branch cannot fire.

### 2.9 VerifyCase id is interpolated unsanitized into the verdict line
**File:line:** `src/lib/verify.server.ts:315` (`c.id` raw into the
console.log line), `:185`/`:347` (id accepted as any string).
**Bug:** a hostile/malformed case id containing `\n` (or `ORACLE_RESULT …`)
injects fake lines into the verdict stream; harmless alone (the count check
usually defeats it) but it is a second unauthenticated-input hole on the same
stream as 1.1 and costs nothing to close.
**Fix spec:** normalize ids at parse time (`:185-191`, `:347`): collapse
`\s+` → ` ` and reject/neutralize control chars; keep the `case-N` fallback.

### 2.10 misc parity/consistency notes (small)
- `report-intake.ts:343` memory trim uses `.slice(-80)` while every engine
  path uses `.slice(0, 80)` (`engine.ts:849, 983, 1048`) — same cap, opposite
  retention direction; harmless today, unify to one convention.
- `rapidtool-cli.mjs:898-900`: no `help`/`--help`/`-h` handler — `help`
  prints "Unknown subcommand: help" + usage at **exit 1** (usage/help errors
  conventionally exit 0); add a `help` case.
- `engine.ts:503-511` + wild/UI flows re-run `synthesizePhase` case 6 per
  regeneration — on a healed second run the phase's `heal.repaired` log +
  `hitl` produced only for the failing shape; consistent, verified no
  double-hitl.
- `headless.ts:961-968` verify error text says "run the codegen phases
  (P10+)" — P6 is the codegen phase; message should say P6 (wording only).

---

## Verified-clean checks (hunted, no bug found)

- **systemJson backtick escaping** (`packet.ts:112`): `\u0060` replacement
  is JSON-safe incl. strings containing backslash+backtick; fence extractors
  stay intact; 14 KB truncation marker lands after the System JSON block.
- **serialized() chain** (`store.ts:118-134`): queued actions read `get()`
  at execution time (post-predecessor-commit), tail swallows rejections, key
  cleanup guarded — no stale-snapshot overwrite among async actions.
- **persist partialize** (`store.ts:1160-1186`): whole projects persist, so
  `wildRun`/`enforceDod`/`meta` survive round-trips; corrupt-storage
  rehydration seeds and overwrites the blob.
- **hydrateProject** (`engine.ts:1324-1535`): edge-promotion honors
  priorsSealed; per-row filters match what compileAgentPacket/runGate can
  actually throw on; hydrate.repaired rows are loud.
- **io.ts**: corrupt JSON / wrong-shape payloads rejected before hydration;
  unknown extra fields ride through `...raw` (documented wild-field
  persistence is real, not lossy).
- **saveProject** write-then-rename with pid+ts temp names
  (`headless.ts:57-74`); unowned-temproot fallback never rmSyncs tmpdir
  (`node-runner.server.ts:90-97`).
- **node-runner timer/close races**: single `settled` latch + finish paths
  all clear the timer; no double-resolve; killTimer set before any async
  exit can fire.
- **dod.ts runGate**: unregistered phases fail loudly (no vacuous pass);
  probes are try/caught per item; evidence hash stable across equivalent
  states.
- **rejectHitl/12-char/decision-ledger** invariants hold on both store and
  headless paths; CLI reject enforces the 12-char floor at exit 1.
- **report-intake fingerprints**: fp8 over normalized content + phase checks
  + id anchors behave as documented (blocked-without-artifacts re-apply
  appends an attempt row by design — documented in-module).

## Probe evidence (all against real modules, script deleted after)

```
A1 sanitizer accepts IIFE+comma+console reassignment: true
B1 forged run.pass: true | results: [case-1 pass, case-2 pass]   (case-2's real assertion throws)
B2 compileError: (none)
C1 ok: true exitCode: 7 stdout: "hi\n"
D1 template real-run ok: true exitCode: 0 stdout: "" stderr: ""
D2 p6-test unmet after quiet real-run: p6-test,p6-verified | pass: false
E1 healSource changes engine-template failure: false
```
