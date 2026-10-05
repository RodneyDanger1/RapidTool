# fixes/346_batch5_notes.md — lane 5 docs-truth record + landed-work summary

**Lane:** 5 of 6 concurrent lanes (documentation & release truth). **Base:** `main` @ `c16220b`
(clean tree). **Owned:** `AGENTS.md`, `README.md`, `RESUME.md`, this log. **Scratch:**
`%TEMP%\rt346_K5\`. **Keyed LLM calls: 0.** No `src/**` / `scripts/**` edit; no git write.

This is the append-only record of the lane-5 pass: one full gate run, the re-derived counts, the
session's landed work, the doc claims corrected (before/after), and the honest gaps that remain. It
cross-references `fixes/346_audit_autonomy.md` (the independent autonomy audit).

---

## 1. The one full gate run this session — exact JSON verdict

Command (run ONCE; no other lane runs the full gate):

```bash
& 'C:\Program Files\Git\bin\bash.exe' scripts/gate.sh
```

**Capture note:** the verdict was captured through PowerShell `*>` redirection, which mojibakes
non-ASCII (CP437); the em dashes (`—`, U+2014) in the two `hardFails` test names above are the gate's
real bytes (matching the `it(...)`/`describe(...)` titles in `compile-check.server.test.ts`).

**Confound (declared):** the tree was clean at HEAD `c16220b` when this session began, but five
sibling lanes were active and wrote `src/**` during the ~15-minute run — so this was **not** a
frozen-tree gate (the repo rule "never run the full gate while agents are mid-edit" could not be
honored for the one mandated run). At the end of the pass `git status` shows 19 modified `src/**`
files that are the other lanes' in-progress work, not mine. The result below must be read with that
caveat.

Verdict, quoted verbatim (stdout final line):

```json
{"ok":false,"double":false,"flakes":[],"hardFails":["purity — subject bodies unchanged; compile.dir is the subject not the temp copy","treeRun — execute the emitted tree in-loop (fixes/144 M3/B3)"],"quarantined":[],"quarantineCandidates":[],"skips":2,"wallMs":934455,"gates":{"typecheck":{"ok":true,"exit":0,"ms":84641},"lint":{"ok":true,"exit":0,"ms":36546,"problems":null},"assertionGaps":{"ok":true,"exit":0,"ms":1497},"build":{"ok":true,"exit":0,"ms":35358},"testsScripts":{"ok":true,"exit":0,"ms":381382,"pass":452,"fail":0,"skipped":0},"testsLib":{"ok":false,"exit":1,"ms":393026,"pass":3485,"fail":1,"skipped":2}}}
```

Tail of the lib log:

```
# tests 3488
# suites 695
# pass 3485
# fail 1
# cancelled 0
# skipped 2
# duration_ms 392471.97
```

**Read truthfully.** `ok:false`. Typecheck, lint, assertion-gap lint and build are all `ok`; the
scripts leg is 452/0; the **lib leg has ONE failure** whose `hardFails` names are the child-spawn
`compile-check.server` test `purity — subject bodies unchanged; compile.dir is the subject not the
temp copy` (leaf) and its parent describe `treeRun — execute the emitted tree in-loop (fixes/144
M3/B3)`. This was **not** a green gate, and the docs now say so.

**Why this is the documented load-sensitive flake, not a reproduced defect** (evidence run this
session, after the full gate, not a second full gate):

- `node --experimental-strip-types --test --test-reporter=tap src/lib/compile-check.server.test.ts`
  → `# tests 97  # pass 96  # fail 0  # skipped 1` — the whole suite is green standalone.
- The named leaf in isolation (`--test-name-pattern="purity — subject bodies unchanged"`) → `ok 1 …
  # pass 1 / # fail 0`; the parent describe in isolation → 23/23 pass.
- Both named tests spawn a real child (`treeRunAsConsumer` → `node --test` on the emitted tree), the
  exact class `gate.sh`'s `KNOWN_LOAD_FLAKES` documents; they are simply not on that allowlist. The
  full gate ran under heavy concurrent-lane load (the scripts leg took 381 s vs the ~147 s V2
  recorded; the lib leg 393 s vs ~148 s), which is the starvation precondition.
- The gate's own `--quarantine` path (default OFF) exists for this class; this run was the default.

**Last GREEN full gate of record:** the 346-V2 boundary (`fixes/346_v2_validate.md` §4) —
`{"ok":true,…"testsScripts":{"pass":446,"fail":0},"testsLib":{"pass":3370,"fail":0,"skipped":2}}`.

**Follow-up (not a doc fix):** one of the two named tests could be added to `gate.sh`'s
`KNOWN_LOAD_FLAKES` allowlist (or the child-spawn timeout root-caused) so a loaded boundary run does
not read red for a non-defect. `scripts/gate.sh` is not owned by this lane — recorded here, not changed.

---

## 2. Re-derived counts

**Tracked files (`git ls-files`, 2026-10-04 at `c16220b`):**

| Area | Count |
|---|---:|
| total | **1,951** |
| `src` | 250 |
| `src/lib` | 239 (127 non-test + 112 colocated test suites) |
| `scripts` | 52 (26 tools + 26 `*.test.mjs`) |
| `fixes` | 759 |
| `wave_plans` | 139 |
| `research/multiagent` | 103 |
| `research/eval-out` | 345 |
| `research/eval-corpus` | 23 |
| `research` (all) | 476 |
| root (tracked, top-level) | 41 |

**Test counts caveat:** the `scripts 452 / lib 3485 pass · 1 fail · 2 skipped` figures are the gated
tree's (mid-run, while sibling lanes were editing); a sibling lane's uncommitted test additions could
be folded in. They are the only full-suite numbers taken this session (one gate run), so the committed
HEAD's exact suite counts are not independently re-derived here — re-derive on a frozen tree.

Working tree at session start: **clean** at committed HEAD `c16220b` (`git status --porcelain` empty).
During this pass the tree became **dirty with sibling lanes' `src/**` edits** (19 modified files — not
this lane's; this lane edits only the three docs + this log). New in this wave's commits:
`scripts/factory-watch.mjs`, `scripts/factory-watch.test.mjs`, `scripts/store-crosstab.test.mjs`, and
the `fixes/346_*.md` logs.

**Commit log (HEAD `c16220b`; the four session commits):**

```
c16220b W60 (346 wave) batch 4: six-lane completion — CLI emit guard, console spend, seat provenance, isolation, bounded steps, honest tail
128a539 W60 (346 wave) batch 3: cross-lane parity, cross-tab deletes, hash-collision honesty, verified delivery
100504c W60 (346 wave) follow-up: oracle-lane numeric parity, verified delivery, watchdog resume gate
7db4d7d W60 (346 wave) — resumed and completed: SB-1/SB-2 trust fixes, V2 validation, and an agent bug-fix sweep
```

(prior: `9a8e5a3` the 346 pause point.)

---

## 3. What this session landed (byte-checked)

- **Walk-away orchestrator** `scripts/factory-watch.mjs` (+ `factory-watch.test.mjs`, 9/9 both
  runtimes; `npm run factory`): one bounded tick `create → unattended → emit --run (verify) →
  emit --git (deliver)`; durable `state/factory-state.json` checkpoint/resume; idempotent skip; honest
  refusal; corrupt-state refusal (`RT_E_VALIDATION`). Verification precedes the commit —
  `runProved` requires `treeRun.ok === true` (`factory-watch.mjs:287-299`). A keyed tick really did
  deliver one commit (`976afe8`); the wave's log claims ≤3 keyed drives / ≈$0.032 (`fixes/346_e3`
  §7) — **not reproduced here (0 keyed calls)**.
- **Real Permission-Model bound** (`isolation:"strict"`): `exec.generatedRunOptions`
  (`src/lib/exec.ts:55-60`) + `node-runner.server.ts` (`RUNNER_PERMISSION_FLAG`, `strictRunnerArgs`,
  `permissionModelAvailable`, `RunnerBound`). `doctor` (keyless, this box) reports
  `isolation.bound {mechanism:"node-permission-model", enforcedOnGeneratedCode:true, fsWriteConfined:true,
  subprocessDenied:true, heapCapMb:512}` while `isolation.sandbox` stays **false**.
- **Tree/oracle behavioural parity (SB-2)**: `compile-check.server.assertionIsShapeOnly` mirrors
  `verify.server.behaviouralOracleExpression`; the oracle lane gained the full numeric-literal grammar
  and object/array-literal operands (`verify.server.ts:1476-1527`, 346 cross-lane parity).
- **Injective knowledge fingerprints (SB-1)**: per-element content-address codec in
  `knowledge.ts` (`fingerprint`/`failureSignature`/`probeTagsFromSignature`); RED-first proof in
  `fixes/346_e2_resilience.md` §SB-1 (worktree at `988b158` → 7 pins red).
- **UI**: cross-tab lost-update fix (`mergeCrossTabProject`/`reconcileCrossTabProjects` + `storage`
  listener), corrupt-blob rescue, artifact windowing, `SpendChip` (`spend not recorded` when absent —
  never a fabricated 0), chat live-region a11y, console seat provenance (`hitl.console_decision`).
- **CLI `emit --run --git` guard** (`scripts/rapidtool-cli.mjs:2236-2255`): a red `--run` verdict
  refuses the commit (`RT_E_TREE_RUN_FAILED`) and keeps the emitted tree on disk.
- **Watchdog wiring (P2-6)**: `requiresHumanResume`/`shouldAutopause` consumed at the store resume
  branch (`store.ts` `startWildRun`); `boundedStepWatch` consumed by `engine.wildStep`
  (`engine.ts:5342`).
- **P7–P12 coverage naming**: the packet's shared line is `Phase coverage: N of 13 / M artifacts from
  P7–P12` plus `empty_phases`, derived from the real census (`phases.ts:150-159, 194-266`;
  `packet.ts:1044`).

---

## 4. Doc claims corrected (before → after)

All in the lane-owned docs; every "after" value is from a command run this session.

| Doc | Claim (before) | Correction (after) |
|---|---|---|
| `AGENTS.md` (Commands) / `README.md` (status) / `RESUME.md` (corrections) | gate of record = 343 wave, scripts 427/0 · lib 3261/0/2, `ok:true` (README's banner was older still: 2026-09-26, scripts 261/261 + src 1957, W29–W38 "uncommitted") | current: the FROZEN-tree gate (HEAD `c16220b` + the K1–K6 lanes) = `ok:true`, scripts 452/0 · lib **3507/0/2**; an earlier mid-wave run in the same session was `ok:false` on one load-flake that passes standalone; tree is committed and clean |
| `AGENTS.md` / `README.md` §10.1 / `RESUME.md` | total **1,933** · `fixes` 744 · `scripts` 49 (25 tools + 24 tests) · `src/lib` 239 = "123 modules + 112 tests" | total **1,951** · `fixes` 759 · `scripts` 52 (26 tools + 26 tests) · `src/lib` 239 = 127 non-test + 112 tests |
| `README.md` limit #3 | "No real isolation… not a sandbox — no Docker/bwrap" | generated code runs under Node's Permission Model (fs-write confinement, subprocess denial, 512 MB heap cap); still NOT a security sandbox — no network denial, no OS boundary; Windows Job Objects unavailable from pure Node |
| `README.md` limit #2 | "P7–P12 phases often produce no artifacts… unblocking them is roadmap" | the edge is gate-blind; the default advisory driver advances P7–P12 after a red P6 and writes tail artifacts (9); only `enforceDod` blocks at P6; the packet reports the real census |
| `README.md` §10.7 (script census) | `scripts` 49 tracked; test suites (24) | 52 tracked; adds `factory-watch.mjs`, test suites (26) incl. `factory-watch.test.mjs`, `store-crosstab.test.mjs` |
| `README.md` architecture / key-files | runner "not a sandbox" (flat) | runner "applies Node's Permission Model to generated code, still not a security sandbox" |
| `README.md` limit #4 | git landing / resume REAL; roadmap = scheduler + remote delivery | adds: `factory-watch` re-executes before `emit --git`; the CLI `emit --run --git` guard refuses a red-tree commit |
| `RESUME.md` §5.4 | "Never claim Docker/bwrap — isolation is honestly `sandbox:false`" | kept, strengthened: also state the real Permission-Model bound; still never claim network denial / OS boundary |
| `AGENTS.md` / `README.md` summary blocks | (new) | added dated "Corrections in force — 346 wave" blocks that supersede the stale values above |

**Not corrected (no bytes support a change):** the README's historical append-only correction blocks
(2026-10-02 / 2026-10-03) were left as records; the new 346 block supersedes them by date.

---

## 5. Honest gaps that remain (unchanged by this lane)

- **Keyed P6 synthesis is not guaranteed.** A keyed run can still stall at the P6 DoD
  (`RT_E_GATE_PENDING`, `p6-verified`/`p6-brief-fit`); the factory reports the stall, never a delivery
  (`fixes/346_e3` §9.1; `fixes/346_audit_autonomy.md` P0-2). **Not reproduced here — 0 keyed calls.**
- **Cross-family failover is NOT implemented.** The un-armed switch was deleted
  (`FALLBACK_PROVIDERS_ENV_VAR`/`resolveFallbackChain` removed from `registry.ts`);
  `RAPIDTOOL_FALLBACK_PROVIDERS` is now inert. Every role still tiers to `deepseek`.
- **The autonomy bar is human acceptance.** `doctor` prints `autonomousSoftwareFactory:false` by
  design — the flag needs an approved fixture row stamped `decidedBy:"human"`; a machine-complete run
  stays `false` (`fixes/346_audit_autonomy.md` P0-1).
- **The console seat residual.** The console records `hitl.console_decision` provenance honestly but has
  no out-of-band `RT_HUMAN_SEAT_TOKEN` delivery seam; fully routing it needs a registered `console`
  seat in `policy.ts` + `dod.ts` provenance + `handoff.ts` (STOP-and-REPORT; still open).
- **Windows Job Objects unavailable from pure Node.** No kernel-enforced memory/CPU/process-count caps;
  the Permission Model is the strongest zero-dependency primitive used.
- **P7 `p7-research` is offline** (no live research provider wired for that phase); the phase still
  writes its own artifact on the gate-blind edge.
- **Prettier drift is measured, NOT gated.** `npx prettier --check "src/**" "scripts/**"` → 244
  `[warn]` + 1 `[error]`; a global format gate would be a permanent red, so only a scoped
  `format:check` on the new files is green.
- **`emit --git` without `--run`** still commits with no verdict to consult (by design; the guard only
  covers the `--run --git` invocation).
- **Keyed log claims unverified here:** the delivery commit `976afe8`, the keyed `RT_E_GATE_PENDING`
  stall, and keyed multi-job substance are log claims (`fixes/346_e3`), not reproduced in this lane.

---

## 6. Cross-references

- `fixes/346_audit_autonomy.md` — the independent autonomy audit (verdict: "100% autonomous software
  factory" is **FALSE**, self-refuted by `doctor`; prioritized remaining work P0-1…P2-8).
- `fixes/346_0_parent.md` §6 — the wave's own resume-complete record, the per-lane landed list, and the
  known gaps (oracle/tree parity follow-up; the human acceptance stamp).
- `fixes/346_e1_verification.md` · `346_e2_resilience.md` · `346_e3_orchestrator.md` · `346_e4_ui.md` —
  the four lane logs (each with RED→GREEN evidence and its own STOP-and-REPORTs).
- `fixes/346_v1_validate.md` · `346_v2_validate.md` — the two validators (V1 found SB-1…SB-6; V2 ran
  the last green boundary gate and the browser/orchestrator adversarial probes).

---

## 7. Reconciliation — final frozen-tree gate (orchestrator, 2026-10-04)

The §1 gate JSON above was taken MID-WAVE (sibling K1–K6 lanes were still editing `src/**`), so it is a
historical record, not the landing verdict. After all six lanes stopped, the orchestrator re-ran the gate
on the frozen tree:

```json
{"ok":true,"double":false,"flakes":[],"hardFails":[],"quarantined":[],"quarantineCandidates":[],"skips":2,"wallMs":380717,"gates":{"typecheck":{"ok":true,"exit":0,"ms":32555},"lint":{"ok":true,"exit":0,"ms":18106,"problems":null},"assertionGaps":{"ok":true,"exit":0,"ms":998},"build":{"ok":true,"exit":0,"ms":12853},"testsScripts":{"ok":true,"exit":0,"ms":164549,"pass":452,"fail":0,"skipped":0},"testsLib":{"ok":true,"exit":0,"ms":150862,"pass":3507,"fail":0,"skipped":2}}}
```

So the gate of record is `ok:true` (scripts 452/0 · lib 3507/0/2); the mid-wave `ok:false` was the
documented load-sensitive child-spawn flake under concurrent lane edits, exactly as §1 concluded. AGENTS.md,
README.md, and RESUME.md were reconciled to this value.
