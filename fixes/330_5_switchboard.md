# fixes/330_5_switchboard.md — Wave 330, persona 5 (Switchboard: CLI & Harness Engineer)

**Scope:** the machine contract — one JSON object per call, the 0/1/2/3/4 exit taxonomy, `RT_E_*`
codes, the NDJSON event log, and the `--knowledge` wire into the run-driving verbs. Two jobs:
(A) the pre-specified **T4 CLI wire** and (B) real CLI/harness defects found with probes and fixed
at the cause.

Repo: `C:\Users\mnril\Desktop\RapidTool Main`, branch `main`, HEAD `c024503`, tree clean at start.
**Owned files touched:** `scripts/rapidtool-cli.mjs` · `scripts/cli-exit-taxonomy.test.mjs` · this
log (sole writer). No other file was modified.

---

## 0. Baseline (before any edit)

| Command | Result |
|---|---|
| `npm run typecheck` | **exit 0** |
| `node --test --test-reporter=tap "scripts/**/*.test.mjs"` (host Node v24.15.0) | **371 tests · 371 pass · 0 fail · 0 skipped**, exit 0 |
| `& "...hermes\node\node.exe" --test --test-reporter=tap "scripts/**/*.test.mjs"` (pinned Node v22.23.2) | **371 tests · 371 pass · 0 fail · 0 skipped**, exit 0 |

`git status` at start: siblings editing `src/lib/{codegen.server,engine,headless,verify.server}.ts`
(the T4 sibling's `proven` option). No sibling touches my files.

---

## 1. T4 — the `--knowledge` CLI wire (run / gate / unattended)

The 329 round made `packet --knowledge` resolve cross-project lesson rows through
`knowledge.provenRowsFromStore`; the expansion-prompt half (the 4 hops through the journey) was
recorded as forward work (`fixes/329_parent_dead_wires.md`, "T4's *synthesis-prompt* half"). A
sibling lane landed the headless half this wave: `runUntilGate(project, { …, proven })` now threads
`proven` → `advanceOnce` → `runP6Edge` → `codegen`'s three lesson sites (`headless.ts:1020-1023`,
`:1044`, `:2295`, `:2702`; `codegen.server.ts:3050/3141/3486`). This lane landed the CLI edge.

**What was added (`scripts/rapidtool-cli.mjs`):**

- **`resolveProvenRows(cmdName, args, project)`** — the ONE resolver used by `run`/`gate`/
  `unattended`, placed beside `respondDriveOutcome` (before `main()`). It:
  - returns `{ present: false }` when `--knowledge` is **absent** → the `proven` option is omitted
    from the `runUntilGate` opts object, so the drive stays **byte-identical** to today;
  - refuses a **valueless/empty** `--knowledge` (`pathFlagMissing` → exit 1, `RT_E_VALIDATION`,
    `packet --out`'s R5-f10 class);
  - otherwise resolves with the **codegen chain's own limit constant**
    (`k.EXPAND_LESSON_RANK_LIMIT`, `knowledge.ts:45` = 5 — never an inline magic number):
    `k.provenRowsFromStore(resolve(args.knowledge), project.name, { limit: k.EXPAND_LESSON_RANK_LIMIT })`;
  - on `degraded: true` refuses with the **packet arm's exact shape** — exit **4**, the store's own
    `reason`, code `resolved.code ?? "RT_E_INTERNAL"`.
- **`run`/`gate`** arm: `const proven = await resolveProvenRows(cmd, args, project);` then
  `h.runUntilGate(project, { autopilot, live, maxSteps, checkpointDir, ...(proven.present ? { proven: proven.rows } : {}) })`.
- **`unattended`** arm: the same resolver, spread into its `runUntilGate` opts.
- `packet` arm: `{ limit: 5 }` → `{ limit: k.EXPAND_LESSON_RANK_LIMIT }` (no behaviour change;
  removes the magic-number fork from the resolver's own constant).
- `USAGE.run` / `USAGE.gate` / `USAGE.unattended` document the new flag.

**Exact flag / option names (the cross-lane contract):**

| surface | name |
|---|---|
| CLI flag | `--knowledge <store.json>` (on `run` · `gate` · `unattended`; `packet` already had it) |
| resolver | `k.provenRowsFromStore(resolve(args.knowledge), project.name, { limit: k.EXPAND_LESSON_RANK_LIMIT })` |
| driver option | **`proven`** — `h.runUntilGate(project, { autopilot, live, maxSteps, checkpointDir, proven })` (name unchanged, as specified) |

**Real smoke run — both paths** (`sw330_scratch/t4_probe.mjs`, keyless; scratch under the OS temp
dir, never the repo cwd; `DEEPSEEK_API_KEY` deleted from the child env):

```
=== A: run (no --knowledge) ===        exit 2  ok=true   status=awaiting_hitl steps=1
=== B: run --knowledge store.json ===  exit 2  ok=true   status=awaiting_hitl steps=0
=== C: run --knowledge corrupt.json === exit 4  ok=false  code=RT_E_VALIDATION
        error: "run: cannot seed proven lessons from …\bad.json: KnowledgeStore: store file …"
=== D: run --knowledge (no value) ===  exit 1  ok=false  code=RT_E_VALIDATION
        error: "run --knowledge requires a path (got a flag with no value)"
=== E: gate --knowledge store.json === exit 2  ok=true   status=awaiting_hitl
=== F: unattended --knowledge store === exit 2 ok=true   status=awaiting_hitl
```

The rows really resolve (the driver is inert keyless, so the resolver is proven directly — the same
call the CLI helper makes — plus the packet arm on the same resolver, `sw330_scratch/t4_rows_probe.mjs`):

```
EXPAND_LESSON_RANK_LIMIT = 5
resolved.degraded = false | rows = 1
rows JSON = [{"id":"proven-K9a36a1c5","kind":"semantic","phase":0,
  "text":"Reuse \"Calibrate servo loop gains before tuning\" (stored from project \"OTHER PROJECT\", score 1): …",
  "score":1,"source":"research","tags":["lesson"]}]
packet bytes without = 6597 | with = 6945 | grew = true
```

Keyless the P6 deterministic floor makes no model call, so `proven` cannot change a keyless run's
observable output; the wire is verified at the resolver + option-plumbing level and pinned
behaviourally (accept / coded-degrade / valueless-refuse) in the taxonomy suite (§3, test 23).

---

## 2. Part B — CLI/harness defects found (probes + real bytes)

### D1 · `packet --knowledge` silently absorbed a VALUELESS flag — FIXED

- **What:** `args.knowledge` is read as `typeof args.knowledge === "string" && args.knowledge.trim()`
  — but `parseArgs` turns a bare `--knowledge` into `true`, so `packet --project P --knowledge`
  **served the UNSEEDED packet under a success envelope**. The exact R5-f10/A2-f11 class the
  `--out` guard already closes.
- **Pre-fix bytes:** `packet-knoledge-bare  exit=0 cmd=packet ok=true code=-`
  (matrix probe, `sw330_scratch/matrix_probe.mjs`).
- **Fix:** a `pathFlagMissing(args.knowledge)` guard in the packet arm → exit 1, `RT_E_VALIDATION`,
  `packet --knowledge requires a path (got a flag with no value)`.
- **Post-fix bytes:** `packet-knoledge-bare  exit=1 cmd=packet ok=false code=RT_E_VALIDATION`.

### D2 · `--agent-seal` was silently absorbed by every non-wild verb our own docs say must refuse it — FIXED

- **What:** the CLI banner (`rapidtool-cli.mjs:44`) and `USAGE.wild` both state `wild` is **"the
  ONLY verb that accepts it"**. Only five drive verbs actually refused it (316 H3); the other ~30
  **silently absorbed** the governance flag and returned a *success* envelope — a caller could
  believe the classifier-as-approver seal had applied when it never could.
- **Pre-fix bytes** (`sw330_scratch/seal_probe.mjs`; `reject` on a parked P4 gate):

```
approve (docs: refuses)    exit=1 ok=false code=RT_E_VALIDATION
reject  (docs: silent?)    exit=0 ok=true  code=-          <<< absorbed
edit    (docs: silent?)    exit=1 ok=false code=RT_E_VALIDATION (refused for an unrelated reason)
emit    (docs: silent?)    exit=0 ok=true  code=-          <<< absorbed
create  (docs: silent?)    exit=0 ok=true  code=-          <<< absorbed
scan    (docs: silent?)    exit=0 ok=true  code=-          <<< absorbed
```

  (36-verb sweep in the new pin: pre-fix only `approve/gate/run/resume/unattended` refused.)
- **Fix:** hoist the refusal to **ONE pre-dispatch guard** in `main()`, after `ensureErrorCodes()`
  and the missing-subcommand check, so it fires for **every** verb but `wild` — and before ANY
  project load:
  ```js
  if (cmd !== "wild" && flag(args, "agent-seal")) return refuseAgentSeal(cmd);
  ```
  The five per-arm calls (run/gate, resume, unattended, approve) were removed as now-redundant
  (their comments point at the hoisted guard); `refuseAgentSeal` itself is unchanged.
- **Post-fix bytes:** the same 36-verb sweep exits 1 / `ok:false` / `RT_E_VALIDATION` for every
  non-wild verb, and `wild --project P --start --agent-seal --steps 1` still **accepts** it
  (`exit_code=0 ok=True action=start outcome=advanced`) — the ONE door is intact.

### D3 · `scan` findings shipped an EMPTY `error`, classifying every findings result as opaque `RT_E_UNKNOWN` — FIXED (partial; code gap REPORTED)

- **What:** like its sibling check-verbs `scan` returns `ok:false` + exit 1 on findings, but it
  shipped **no `error`** while `check` carries its reason and `tree-run` its first not-ok tail.
  With empty prose the classifier matched nothing → **`code:"RT_E_UNKNOWN"`, `error:""`** — the
  registry's own "the failure is opaque" code on a *designed, advisory* outcome.
- **Pre-fix bytes** (`sw330_scratch/scan_probe.mjs`, a dir with one `catch-empty`):
  `scan findings  exit=1 ok=false code=RT_E_UNKNOWN err=` (empty).
- **Fix:** when findings exist, name the outcome:
  `error: "scan: N advisory finding(s) in <dir> — heuristics, not verdicts; review findings[].rule (advisory, never blocks an emit)"`.
  Envelope shape and exit are unchanged (additive field).
- **Post-fix bytes:** `scan findings  exit=1 ok=false code=RT_E_UNKNOWN err=scan: 1 advisory finding(s) in …`.
- **REPORTED (not fixed — needs a file I do not own):** the `code` is still the generic
  `RT_E_UNKNOWN` fallback because **no scan-specific code exists** and adding one means editing
  `src/lib/errors.ts` (`ERROR_CODE_DOC` + `ERROR_CODES`) and `scripts/README-cli.md` — neither is in
  my owned set (rule 5). The honest closure is a registered `RT_E_SCAN_FINDINGS` (typical exit 1),
  mirroring `RT_E_CHECK_FAILED`/`RT_E_TREE_RUN_FAILED`.

### Hunted, NOT reproduced (probes ran; disk is clean — recorded so no one re-hunts blind)

- **Envelope vs exit code.** A 29-case matrix (`matrix_probe.mjs`) and a 25-case failure matrix
  (`matrix_probe2.mjs`) across create/run/gate/resume/approve/reject/ingest/packet/export/emit/
  fixtures/eval/tree-run/repair/edit/summary/vault/search/crew/verify/check/scan/design/diagram/
  artifacts/harvest/swarm/prompt/bench/mine/knowledge/lesson/wild/chat/deepen/doctor: **0**
  `exit_code != process.exit`, **0** `ok:false` without `code`, **0** exit-2 rows with `ok:false`,
  **0** stacks on stderr. The only non-`RT_E_*`-specific code was D3's `RT_E_UNKNOWN`.
- **Missing `exit_code` (the OPS-1 one-arg `respond()` class).** A paren-matching scan of all
  **217** `respond(...)` call sites found **0** single-argument calls (the 15 lexical hits are
  `respond()` mentions inside comments).
- **NDJSON rows.** A probe driving 20 verbs plus a real `wild --start` read back every
  `.rapidtool/logs/*.ndjson` row: every `event` is in `RT_EVENT_NAMES` with the catalogued `scope`,
  and every `cli.invocation` row's `payload.cmd` equals the dispatched verb (`cli.invocation` +
  engine-seeded `wild.step_start`/`wild.step_ok` only). The sole `payload.cmd:null` row is the
  genuine no-subcommand refusal. Clean.
- **`diagnose` reading rows it does not emit.** `src/lib/diagnose.ts` reads only catalogued events
  (`wild.step_timeout|start|ok`, `persist.quota_failed`, `hydrate.recovered_corrupt`,
  `runner.failed|unavailable`, `sys.mainthread_stall|longtask`, `cli.invocation`) and its payload
  keys match the emitters (`sys.heartbeat_lag`/`sys.mainthread_stall` → `payload.lagMs`,
  `sys.longtask` → `payload.durationMs`, `cli.invocation` → `payload.exitCode`). A REAL keyless
  `gate` park + `diagnose` returns `mostLikelyCause:"honest-park"` (never `unclassified-errors`) —
  the exit-2 park is read honestly. Clean.
- **`--agent-seal` doc claim** is now TRUE on disk (was D2).

### Other valueless flags seen (NOT fixed — reported, not silently changed)

The same `parseArgs`→`true` class still lets a bare `--history` (chat), `--phase` (deepen),
`--budget` (repair), `--max-steps` (crew), `--steps` (wild), `--limit`/`--brief` (lesson list)
fall back to their defaults. Each is a *documented value-flag* whose valueless spelling is silently
ignored — the same class as D1 — but changing six verbs' flag semantics is broader than this lane's
brief; flagged here for a dedicated sweep. (None produced a wrong/unsafe envelope: they either hit
an unrelated honest refusal or a benign default.)

---

## 3. Pins added (additive; existing legs untouched)

`scripts/cli-exit-taxonomy.test.mjs` — three spawn-based legs (numbered 21-23):

| # | pin |
|---|---|
| 21 | `330 Switchboard — --agent-seal refuses CODED on every verb but wild (the ONE door)`: 35 non-wild verbs, bare `--agent-seal`, no `--project` → exit 1 / `ok:false` / `RT_E_VALIDATION` / `"<verb>: --agent-seal does not apply here"` / remedy names `wild --start --agent-seal`; `wild --agent-seal` is NOT caught by the guard. |
| 22 | `330 Switchboard — packet --knowledge refuses a valueless/empty flag CODED, a real store still seeds`: `--knowledge` and `--knowledge=` → exit 1 `RT_E_VALIDATION`; a real store still seeds (exit 0 `ok:true`). |
| 23 | `330 Switchboard (T4) — run/gate/unattended --knowledge`: a readable store is accepted on all three (exit 0/2, no knowledge refusal); a corrupt store → exit 4 `RT_E_VALIDATION` + the resolver's own reason; a valueless flag → exit 1. |

No test was weakened or deleted.

---

## 4. Verification (both runtimes, after every edit)

| Command | Result |
|---|---|
| `npm run typecheck` | **exit 0** |
| `npx eslint scripts/rapidtool-cli.mjs scripts/cli-exit-taxonomy.test.mjs` | **exit 0** (clean) |
| `node --check scripts/rapidtool-cli.mjs` | SYNTAX OK |
| `node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs` (host Node 24) | **23 tests · 23 pass · 0 fail** (was 20) |
| `& "...hermes\node\node.exe" --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs` (pinned Node 22) | **23 tests · 23 pass · 0 fail** |
| `node --test --test-reporter=tap "scripts/**/*.test.mjs"` (host Node 24) | **374 tests · 374 pass · 0 fail · 0 skipped**, exit 0 (×3 runs) |
| `& "...hermes\node\node.exe" --test --test-reporter=tap "scripts/**/*.test.mjs"` (pinned Node 22) | **374 tests · 374 pass · 0 fail · 0 skipped**, exit 0 |

**Suite counts before → after:** scripts leg **371 → 374 (+3)** on both runtimes — exactly the 3
tests added; no other count moved. Baseline was 371/371; the +3 matches the new pins.

**One flake observed, not reproduced:** the first host-Node full-suite run reported
`# tests 374 / # pass 373 / # fail 1`; the immediately following two runs (and the pinned run)
were 374/374. The failing test name was not captured before the rerun, and it did not recur across
three further runs — noted honestly rather than claimed clean.

---

## 5. Owed / not mine (STOP-and-REPORT)

1. **D3's code.** A scan-specific `RT_E_*` code needs `src/lib/errors.ts` + `scripts/README-cli.md`
   (not owned). The `error` text is now honest; the `code` remains `RT_E_UNKNOWN`.
2. **Valueless flags on six other verbs** (§2) — a dedicated sweep, out of this brief's scope.
3. **Keyed end-to-end proof of `proven`.** Keyless the P6 floor makes no model call, so the rows'
   effect on the synthesis prompt is only observable keyed (funding blocked, O-1). The wire is
   proven at the resolver + option plumbing and pinned behaviourally.

---

_Log written incrementally; final at close of this lane._
