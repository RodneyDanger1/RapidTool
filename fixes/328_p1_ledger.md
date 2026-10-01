# fixes/328 — wave 328, persona 1 "Ledger" (Pipeline Dead-Wire & Journey Integrity)

HEAD at open: `a1f4f10` — branch `main`, working tree CLEAN at open (verified
`git log --oneline -3` / `git status --short`). Owned files: `src/lib/headless.ts`,
`src/lib/headless.test.ts`, `src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts`; this log.

> NOTE (mid-wave tree state): when I re-checked `git status --short` after starting, four sibling
> personas were concurrently editing — `scripts/rapidtool-cli.mjs`, `src/components/console.tsx`,
> `src/lib/quarantine.ts` (+ their `fixes/328_p4_switchboard.md`) — exactly as briefed. I touched
> none of them.

---

## F1 — `deps.synthesisRefusal` produced but read by NOTHING (dead wire)

**Confirmed on disk at open.** `Select-String -Path "src\**\*.ts" -Pattern "synthesisRefusal"`
returned only `src/lib/headless.ts` (producer + doc) and `src/lib/headless.test.ts` — zero codegen
reader. (Same finding the 326 wave filed as F1 PREP-2.)

### Producer chain (all pre-existing; verified, not assumed)

- `headless.ts:2284` — `if (refusal.length > 0) deps.synthesisRefusal = refusal.slice(0, P6_JOURNEY_REFUSAL_MAX);`
  (`P6_JOURNEY_REFUSAL_MAX = 200`, `headless.ts:2249`).
- `headless.ts:2479` — `synthesizeCycle` → `liveLayer(p, 6, deps)` passes the `P6CycleLiveDepsShape` object.
- `engine.ts:3161` — `upgradeP6Keyed(done, deps)` receives that same reference.
- `engine.ts:3136` — `codegen.liveP6Synthesis(p, deps)` passes **the same object, verbatim** — no
  reconstruction, no key filtering. Measured by reading the three call sites (`grep`/`read_file`).

**Consequence:** the value already arrived in codegen at runtime; only the *reader* was missing. So
closing the wire needed no `engine.ts` edit (see §Boundary below for the type-declaration gap that
does exist there).

### Fix — the codegen reader (`src/lib/codegen.server.ts`)

1. `withSynthesisRefusalContext(user, synthesisRefusal?)` added at **codegen.server.ts:1080-1093**,
   immediately mirroring `withGateRepairContext` (`:1072-1079`): defensive
   `typeof … replace(/\s+/g," ").trim()`, `if (!t) return user;` (⇒ **byte-identical when
   absent/blank**), bounded by `P6_SYNTHESIS_REFUSAL_CONTEXT_MAX = 200`. Block header states honestly
   what it is — *the previous cycle's refusal class + the model's OWN recorded reason, NOT a new
   requirement* — so the model corrects the stated cause rather than inventing scope.
2. `P6SynthesisDeps.synthesisRefusal?: string` added at **codegen.server.ts:2503** (mirrors the
   `treeFailure` / `gateRepair` seam docs).
3. Read at **codegen.server.ts:2992** (`const synthesisRefusal = deps?.synthesisRefusal;`).
4. Threaded to **both** primary-prompt drivers:
   - single-module: param at `:3117-3119`, prompt at `:3129-3131`
     (`withSynthesisRefusalContext(withGateRepairContext(p6SynthesisUserPrompt(...), gateRepair), synthesisRefusal)`).
   - chunked-tree: param at `:3420-3423`, prompt at `:3470-3472`
     (`withSynthesisRefusalContext(withGateRepairContext(p6SynthesisChunkUserPrompt(...), gateRepair), synthesisRefusal)` — once per chunk).
5. Call sites updated: `:3079` (single) and `:3087` (chunked).

Reader file:line (the answer to "where does it get consumed now"): **`src/lib/codegen.server.ts:1090`**
(`withSynthesisRefusalContext`), invoked at `:3129` (single-module) and `:3470` (every chunk).

### Struck — stale "reader is still owed" doc claims (`src/lib/headless.ts`)

The 326 close-out left the doc asserting the codegen reader did not exist. Two blocks struck
(comment-only, no behavior):

- `headless.ts:2251-2259` (`p6CycleLiveDeps` TSDoc): removed *"CARRIED on deps for the codegen seam;
  the codegen-side reader is still owed (fixes/153 P2 deferred it — no reader in tree as of 326)"* →
  now names the real reader `withSynthesisRefusalContext` (fixes/328 F1).
- `headless.ts:2457-2463` (`defaultP6Synthesize` TSDoc): same stale sentence struck/replaced.

## §Boundary — adjacent type-declaration gap in `engine.ts` (NOT edited; reported, not blocking)

`engine.ts:3062 LiveLayerDeps` declares only `{ treeFailure?, gateRepair? }`, and the dynamic-import
cast `engine.ts:3126` declares `liveP6Synthesis?: (p, deps?: { treeFailure?: string; gateRepair?: string })`.
Both omit `synthesisRefusal` **and** the pre-existing `patchRepairs`. This does **not** block the wire:
a variable argument is not excess-property-checked, and `deps` is forwarded by reference, so the key
survives to codegen at runtime (verified). It is a type-contract looseness, not a dead wire — I left
`engine.ts` untouched per the ownership rule. If the parent wants it tightened (recommended, low risk,
30-char change, blast radius = engine.ts only, both suites already exercise the fields):
`LiveLayerDeps` + the `:3126` cast gain `synthesisRefusal?: string;` (and ideally `patchRepairs?: boolean;`).

## §Sweep results (owned files)

- **Fixed:** the F1 dead wire (above).
- **Struck:** the two stale "reader still owed" headless.ts TSDoc blocks (above).
- **Verified clean** (claims proved against disk, not restated):
  - `P6JourneyCycleContext.treeFailureTail` doc "…(or refusal)": accurate — `headless.ts:2717-2722`
    sets `treeTail` from the refusal detail when a cycle produces no tree.
  - `refusal` doc "…named on the exhausted verdict": accurate — `headless.ts:2871`, `2875`, `3602`
    append ` - last refusal: <…180…>` to the `p6.journey.exhausted` / repair verdict detail.
  - Every field of `P6SynthesisDeps` (`complete`/`expand`/`verify`/`treeFailure`/`gateRepair`/
    `synthesisRefusal`/`patchRepairs`) now has a reader; every field of `P6CycleLiveDepsShape`
    (`treeFailure`/`synthesisRefusal`/`patchRepairs`/`gateRepair`) is consumed downstream.
  - Remaining `TODO(FM-03b)` / `TODO(FM-04b)` in codegen.server.ts are honest forward-work notes with
    stated reasons (not false wire claims); left in place.
  - No other produced-but-unread field found in the four owned files by the reader/wire grep sweep.

## §Verification (real commands, real output)

- Test-count delta: HEAD codegen suite **129/129** → after **134/134** = **+5** (exactly N). Baseline
  measured in scratch off `git cat-file blob HEAD:src/lib/codegen.server.test.ts`.
- headless suite: **113/113** (0 skipped) — unchanged; my headless edits are comment-only.
- `typecheck`: final run = exit **0** (`tsc --noEmit`, 0 errors). Honest note: a mid-wave run
  reported exit 2 with 2 `TS2307: Cannot find module 'lucide-react'` errors
  (`src/components/console.tsx(36,8)`, `src/lib/error-component.tsx(2,53)`) while
  `node_modules/lucide-react/dist/lucide-react.d.ts` was temporarily absent (recursive `*.d.ts`
  count = 0). That was concurrent-sibling install churn — the typings file is present again
  (3 `.d.ts`) and typecheck is clean. No error ever named an owned file.

## §Teeth check (RESUME §13.3)

Scratch tree `C:\Users\mnril\ledger_teeth\` (outside the repo): copied `src/`, junctioned
`node_modules`, reverted **only** the SUT via raw bytes —
`git -C <repo> cat-file blob HEAD:src/lib/codegen.server.ts` (the file is 3874 lines, 0 hits for
`withSynthesisRefusalContext`). My new test file (with the 5 new tests) runs unchanged.

- Against **HEAD SUT**: `# tests 134  # pass 130  # fail 4` — RED on tests **1, 3, 4, 5** of the new
  suite; the control test **2** ("blank ⇒ byte-identical legacy") stays GREEN; the pre-existing
  `fixes/326 F1b` gateRepair suite stays GREEN (130 pass).
- Against the **fixed SUT** (in-repo): **134/134 GREEN**.

A first attempt reverted the file through PowerShell `Out-String`, which padded/wrapped lines and
corrupted byte-exact prompts (20 spurious failures). Re-done with `cat-file blob` raw redirect; the
clean 4-red/1-control result above is the one of record.

## §What I did NOT finish / caveats

- `engine.ts` type tightness (§Boundary) — reported, deliberately not edited (not my file; not needed
  for the wire to function).
- Nothing else on my owned surface. (A transient mid-wave `lucide-react` type absence made one
  `typecheck` run exit 2; it resolved — sibling install churn — and the final run is exit 0.)
