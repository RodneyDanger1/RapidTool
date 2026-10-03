# 336 wave (W50) — parent / boundary record

**Boundary owner:** parent. **Opened** 2026-10-02 at HEAD `fac37d4`, tree clean. **Six lanes plus two
follow-ups.** Contract: `wave_plans/W50/README.md`. Lane logs: `fixes/336_1…336_6_*.md`.

The owner's brief for this wave: fix bugs, defects and pipeline issues; **no mock or fake code**; make sure
everything is **properly wired**; be thorough **from the surface to the backend**. So every lane also ran a
**mock/fake census** over its own files and reported a **wiring proof** for its slice.

**No tracked file was deleted** (the owner declined the dead-code question, so the repo's sign-off rule
stood): `git diff` shows 0 deletions, and dead code was proven and proposed instead.

## 1. Boundary gates (after every writer stopped)

| Gate | Result |
|---|---|
| typecheck | **exit 0** (both legs) |
| lint | **exit 0**, 0 warnings |
| assertions | **exit 0** |
| tests | **scripts 411 / lib 2848 / 0 fail / 2 skipped**, exit 0 |
| build | **exit 0** |
| `gate.sh` | **`ok:true`, exit 0**, `flakes: []`, `hardFails: []` |

Baseline: 408 scripts + 2797 lib → **+54 tests, all green**.

## 2. The two real state-loss defects (lane 336-2)

1. **`retry` dropped the gate record on resume.** `retry` unlocks a rejected edge but keeps
   `rejectionHistory`; the checkpoint predates both and `checkpointSupersededBy` had no axis for it, so a
   resume rewound a live project from `running / edge ready / rejHist 1 / decisions 1` to
   `awaiting_hitl / 0 / 0`. Fixed with a new supersession axis.
2. **`ingest` → `resume` dropped the ingested artifact.** `ingest` appends artifacts without refreshing
   the snapshot, so a resume went from 12 artifacts back to 11 — the ingested report vanished. Fixed with
   a growth axis (a snapshot below its bound is superseded by more rows).

Both were reproduced then fixed RED-first. The resume path — which had **zero** coverage — is now proven
from a fresh process: happy park/resume, a decisive crash-recovery case (a file rewound to P2 with a
sentinel artifact set resumes at the **recorded** P4 and the sentinel is gone), and five coded refusals
(mode mismatch, identity mismatch, corrupt bytes, missing checkpoint, advanced-past-snapshot). The
checkpoint suite went 18 → **27**.

## 3. The chain defect: the record's packet misdescribed its own verdict (336-3 → 336-2)

Lane 336-3 proved the **emit → tree-run → DoD → packet** chain breaks at its last link: links 1 and 2 hold
(the tree written is the tree smoke-tested; the DoD's evidence hash recomputes from that verdict), but the
project's own **Agent Packet was stale after the mint** — it still said `P6 template self-test … tests.pass`
while a fresh compile of the same object said `P6 self-test (machine-verified) … evidence 2779769080`. The
shipped `.rapidtool/project.json` therefore carried a packet that did not contain the evidence hash of the
`tested` verdict written beside it. Its sibling: an already-`tested` project never re-minted, so
`emit --run` could report a new verdict while the record kept the old hash.

Fixed by lane 336-2: the packet is recompiled via the existing builder on every path that changes the
verification stamp or seals a gate (journey, repair-converged, promotion), and `mintTreeRunTested`'s early
return is now **hash-aware** — the same verdict keeps the stamp and logs `p6.tree.tested.unchanged`, a
different one refreshes it and names both hashes. Measured before → after: `record packet has hash: false
→ true`, `record packet == fresh compile: false → true`; the promoted record round-trips with the hash.

## 4. Determinism: the packet body was not byte-stable (336-3 follow-up)

The mint fix exposed the root cause of an **intermittent** red in `headless.test.ts` (the W-02 keyless
floor): `compileAgentPacket`'s artifact-truncation budget was consumed against the rendered text, so a
volatile-length change (`compiled_at`, `input_hash`) could move which rows were trimmed. Reproduced with a
probe outside the repo: 3 runs × 20 pairs showed **5, 10 and 9** masked-unequal pairs. Fixed by deciding
the trim on a volatile-length-normalized copy while emitting the real lines at the same indices — masks
carry no newline, every mask is ≥ its real span so the budget invariant holds by construction, and
`compiled_at`/`input_hash` stay verbatim. Post-fix: **0** unequal pairs in every run, and the formerly
flaky suite is stable (141/0 over five Node 22 runs). The lane's honest note: no in-repo unit test was
added because the trigger is structure-sensitive (a fixture-level test would have been RED only ~37% of
the time pre-fix — a flaky guard); the probe is the RED-first artifact and the suite that caught it is the
durable guard.

## 5. What else each lane found

**336-1 Prompter** — closed the pipeline's producer gap: **the P12 database schema is now real**,
derived from `project.contracts.entities` into PostgreSQL DDL and emitted as a third P12 artifact (an
empty contract emits nothing — nothing invented). It also fixed a real **census inconsistency** (the same
13-phase run read 8 under one driver and 14 under another, because the DoD gate row counted as a
deliverable), added `emptyPhases` so a complete phase that produced nothing is named, and proved a driven
run produces **all 16 artifact kinds** with no orphan. P8 component-code and P9 GPU-script stay explicit
reasoned gaps (the spec carries no component contract and no GPU input; the synthesis lane emits loadable
TS modules only). `phases.test.ts` 13 → 17, `engine.test.ts` 14 → 17, `codegen.server.test.ts` 172 → 179.

**336-4 Switchboard** — verified the CLI's wiring exhaustively: **all 39 verbs spawned, all 68 documented
flags read and exercised**, no phantom, no accepted-but-inert, no documented-but-absent, and no dead CLI
code (its one orphan-export candidate turned out to be a Vite virtual module consumed by unowned
middleware). And it **made `npm run eval` safe**: a bare run now **refuses with exit 2** before any write
with an actionable remedy, `--out <dir>`/`EVAL_OUT_DIR` writes to scratch, and an explicit
`--out research/eval-out` still regenerates the tracked scorecard on purpose. Verified independently by
the boundary owner: bare run exit 2, `git status -- research/eval-out` clean. `run-eval.test.mjs` 48 → 51.

**336-5 Chrome** — the surface-to-backend wiring audit found three real gaps: `ShellSurfacesCard` read a
plan through a path its own doc claimed but did not use, and **`WildToggle` discarded `startWildRun`'s
refusal** (`void …startWildRun()`), so a failed wild start was silent to the operator — it now renders the
refusal like the resume path already did. Polish landed: mobile header density (**291 → 101 px**, content
top 364 → 174 px at 390×844), a state-aware title (`/run/<bad-id>` → "build not found"), and a **global
skip link** through `__root.tsx` now that it owns `error-component.tsx` (verified as the first Tab stop on
all four routes). Three unwired store actions were found and **proposed rather than deleted**. New
`ui-shell-guards.test.ts` (6 pins); owned suites 130 → 136.

**336-6 Warden** — the 19-unreached-module wiring audit: **4 modules wired with real tests** (coverage
103/122 → **107/122**, allowlist 19 → **15**), every allowlist reason rewritten to state its real class
(HARNESS-BLOCKED / NO CONSUMER / NO BEHAVIOUR) with the runner's own measured error, and the factually
wrong `db.ts` reason removed. It proved **two** modules dead (`app-data/index.ts`, `multiplayer/index.ts` —
no importer at all) and proposed them; it also found that most of the auth cluster cannot be loaded by the
node runner at all, one line (`auth/server.ts:48`'s extensionless `./preview`) being the blocker for three
live modules. Its own guard caught a **no-op test it had just written** live (`[zero-assertion] … cannot
fail`) — the tools working as intended. Both deferred algorithm defects fixed: `vector.ts`'s unreachable
font-size rung and `algo-tools.ts`'s `while`-as-method false loop (with a scope stack, both directions
tested). `algo-tools.test.ts` 48 → 52, `vector.test.ts` 36 → 37, plus 3 new test files.

## 6. Boundary-owner work

1. **`AGENTS.md`** — landed the `.grok/` correction Warden wrote in the 334 wave and carried twice since
   (the blanket "not the contract" claim was false for four live read paths), and corrected the CLI exit
   taxonomy to include **exit 5** (the W49 lane added it and documented it in `README-cli.md`; `AGENTS.md`
   still said 0/1/2/3/4).
2. **`src/lib/gates.test.ts`** (unowned) — updated the two 13-phase census pins that lane 336-1's new P12
   artifact legitimately moves (8 → 9), and made the test's independent recount mirror the production
   rule (bookkeeping kinds `packet` **and** `gate` are excluded, `phases.ts:227`). 88/88 green.
3. **`README.md`** — corrected the two stale `npm run eval` lines (Switchboard's STOP item): the bare
   command is now shown refusing, with `--out <dir>` as the documented invocation.
4. **Independently verified** the eval-safety claim rather than trusting it (bare run → exit 2, tracked
   artifacts untouched).

## 8. The acceptance harness ran for the first time (keyless floor, scratch dir)

Now that a bare `npm run eval` refuses instead of dirtying tracked artifacts, the boundary owner ran it for
real — `node --experimental-strip-types scripts/run-eval.mjs --out %TEMP%\rt336_eval` — and the tracked
tree stayed clean (`git status -- research/eval-out` → 0).

**Result: 11 corpus fixtures, 1 trial, exit 0, `skips recorded: 1 — corpus`. Every fixture scored
`mean 0.56` (5/9 rubric columns) with `pass@1 = 0.00`, each ending `dod · RT_E_GATE_PENDING`.** The nine
columns are `dm/M1…M9`; every fixture shows the same profile (`M2, M5, M6, M8, M9` met; `dm, M1, M3, M4,
M7` unmet), which is what the keyless deterministic floor should produce: the floor emits a **labeled
placeholder** module, so the product-completeness DoD criteria cannot pass and the run stops at the gate
rather than sealing a false green. That is the honest picture the register's `autonomousSoftwareFactory:
false` describes, and it is now measured rather than asserted. `results.json` + `history.json` were written
to the scratch dir; the tracked scorecard was deliberately not regenerated.

Reproduce: `node --experimental-strip-types scripts/run-eval.mjs --out <scratch>` (add `--keyed` for real
model runs, and `--out research/eval-out` only when you intend to regenerate the tracked scorecard).

## 9. Still open — see §7

1. **Dead code, proven, awaiting your sign-off** (you declined the question, so nothing was removed):
   `.t4scratch/` (192 tracked files, 4.14 MB, zero readers, ~55% drifted) and two zero-importer barrels
   (`src/lib/app-data/index.ts`, `src/lib/multiplayer/index.ts`). Warden also proposed
   `src/lib/multiplayer/p2p.ts` (dormant, its only importer is the dead barrel) and flagged
   `src/lib/auth/gates.tsx` (no consumer) and `src/lib/auth/middleware.ts` (no caller).
2. **`src/lib/auth/server.ts:48`** — an extensionless `./preview` import blocks `server.ts`,
   `verify.server.ts` and `popup.server.ts` under any plain-ESM runner; adding `.ts` would make three live
   modules testable. Unowned; reported, not edited.
3. **P8 component-code and P9 GPU-script producers** — kept as explicit reasoned gaps (no input in the
   spec).
4. **`repairTreeDir` never writes or clears a checkpoint** (336-2): a repair that changes only
   `generatedTree`/`lastTest` at unchanged array sizes is not provably covered by the growth axis.
   Proposed wiring: `checkpointDir?: string` on `repairTreeDir` + one line in the CLI's `repair` arm.
5. **`npm run eval` with `--keyed`** still unrun (a funded key is available; the keyless scorecard is in
   §8).
6. **`R11-f01`** (dev server binds `0.0.0.0`) and the **stale User-scope `DEEPSEEK_API_KEY`** remain the
   owner's decisions.
7. **UI proposals not landed** (336-5): a UI control for `runP6Journey`, wiring `activeId`, a 404 tab
   title, ticket-id label suffixes.
