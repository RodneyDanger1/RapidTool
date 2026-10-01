# 330 · Composer (agent 2 of 6) — the synthesis-chain proven-lesson wire (T4)

**Actor:** Composer, the Synthesis-Chain Engineer (330 wave). **Owned files (only these):**
`src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts`, `src/lib/headless.ts`,
`src/lib/headless.test.ts`, `src/lib/engine.ts`, `src/lib/engine.test.ts`; this log.
**Tree at open:** branch `main`, HEAD `c024503`, `git status --porcelain` empty (CLEAN).
**Runtime:** repo-pinned Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`).

## Task — T4 (112 §4.4 / 216g): cross-project proven lessons reach the synthesis prompt

`knowledge.provenRowsFromStore` resolves a configured KnowledgeStore into rankable lesson rows
and `rankBriefLessons` / `lessonLinesForBrief` already accept `opts.proven` (`knowledge.ts:94`,
`:132`), but the prompt sites passed only `{ limit }`, so human-accepted cross-project lessons
reached the Agent Packet (329 closed the resolver's `packet` caller) yet never the synthesis
prompt. This round closes the remaining half: the wire from the caller's rows to the codegen
prompt, byte-identical when absent.

_(sections filled in incrementally below)_

---

## §1 The wire, hop by hop (every hop's file:line)

| # | Hop | File:line | What changed |
|---|---|---|---|
| 1 | Caller rows enter the run | `headless.ts:1023` (`runUntilGate` opts) | New `proven?: readonly RankableLessonRow[]` on the `runUntilGate(project, opts)` shape — the exact name the separate CLI lane will pass. |
| 2 | Run loop → phase edge | `headless.ts:1044` → `advanceOnce(..., opts.proven)` | `advanceOnce` gains the optional param (`:729`) and forwards to `runReady` (`:781`, `:784`). |
| 3 | Ready → phase | `headless.ts:652`/`:673` | `runReady` gains `proven` and forwards into `runPhase`'s opts (`:554`). |
| 4 | Phase → P6 edge | `headless.ts:564` | `runPhase` phase-6 arm passes `opts.proven` into `runP6Edge(project, opts.p6Deps, opts.proven)` (`:2932`). |
| 5 | Edge → journey | `headless.ts:2934-2937` | `runP6Edge` forwards `proven` only when non-empty (no key materialized when absent). |
| 6 | Journey opts → cycle ctx | `headless.ts:2696`/`:2703`/`:2734` | `driveP6Journey` normalizes `opts.proven` once and sets `ctx.proven = proven` on **every** cycle. |
| 7 | Cycle ctx → deps | `headless.ts:2258` (`P6JourneyCycleContext.proven`) → `:2305-2311` (`p6CycleLiveDeps`) | `p6CycleLiveDeps` materializes `{ proven }` only when rows exist; absent/empty ⇒ the legacy key-set / `undefined` is unchanged. `P6CycleLiveDepsShape.proven` at `:2298`; the repair mapping (`repairCycleLiveDeps`) spreads it through. |
| 8 | Deps → engine seam | `headless.ts:2493` (`synthesizeCycle`) → `:2506` (`liveLayer(p, 6, deps)`) | The deps object (now carrying `proven`) reaches `engine.liveLayer`. |
| 9 | Engine seam | `engine.ts:3086` (`LiveLayerDeps.proven`) + `:3152` (dynamic-import cast) | The seam **declares** the field it forwards; `upgradeP6Keyed` passes the object by reference to `codegen.liveP6Synthesis(p, deps)`. |
| 10 | Codegen reader | `codegen.server.ts:2517` (`P6SynthesisDeps.proven`) → `:3007` (`const proven = deps?.proven`) | The reader. |
| 11 | Codegen lesson sites | `:3050` (expansion), `:3141` (single-module PRIMARY), `:3486` (every tree chunk PRIMARY) | Each `lessonLinesForBrief(brief, selectLessons(...), { limit, proven })` now passes the rows; helper params added at `:3135` and `:3442`, call sites at `:3093`/`:3100`. |

`lessonLinesForBrief`/`rankBriefLessons` (`knowledge.ts:91/:129`) already ranked `opts.proven`, so
no edit there was needed — the missing half was exclusively the prompt-side wiring. All four T4
sites now carry rows except the one in §3.

## §2 Byte-identical-when-absent proof

The codegen reader normalizes nothing: absent ⇒ `proven === undefined` ⇒ each site passes
`{ limit, proven: undefined }`, which `rankBriefLessons` treats exactly as the old `{ limit }`
(`Array.isArray(undefined)` false). The proofs (all green in-repo, RED against reverted SUT — §4):

- `codegen.server.test.ts` — "single-module: proven rows append the PRIOR LESSONS block; absent/empty
  keep the legacy prompt bytes": runs the SAME single-module synthesis three ways and asserts
  `got.prompts[0] === legacy.prompts[0]` for **both** `proven: undefined` **and** `proven: []`, and
  that `expandLessons === undefined` (legacy arity) with no rows. With rows, the prompt
  `startsWith(legacy)` (only the advisory block is appended) and carries `PRIOR LESSONS` exactly once.
- `codegen.server.test.ts` — "chunked: … absent keeps the legacy bytes": every chunk prompt with rows
  `startsWith` its legacy counterpart; each legacy prompt has no `PRIOR LESSONS`.
- `headless.test.ts` — `p6CycleLiveDeps({ cycle: 1 })` and `{ cycle: 1, proven: [] }` both === `undefined`;
  `{ cycle: 1, proven: PROVEN }` → exactly `["proven"]`; absent rows on a live journey ⇒
  `ctx.proven` is `undefined` on every cycle.
- `engine.test.ts` — keyless `liveLayer(p, 6, { proven })` returns the byte-identical keyless floor as
  `liveLayer(p, 6)` (same `generatedSource`, artifact titles, log events).

## §3 `engine.ts:679` (now `:683`) — deliberately NOT wired (rows not in scope)

The fourth T4 site is in `synthesizePhase(project, phase, ctx?)` (`engine.ts:510`), a **pure phase
function** whose only inputs are the `Project` and `{ attempt, note }`. It builds the P0 reframe HITL
prompt from `project.memory` alone. There is no deps/rows channel in scope, and `proven` is a caller-
supplied cross-project value that only enters at `liveLayer`'s P6 edge. Forcing it would require
changing the pure phase signature (a design call, not a wire). Left untouched per the brief; the site
continues to rank project-local memory lessons exactly as before.

## §4 Teeth (RESUME §13.3)

Scratch tree `C:\Users\mnril\composer_teeth\` (outside the repo): copied `src/` + `scripts/`, junctioned
`node_modules`, then reverted **only the SUTs** with raw byte redirects
(`git show HEAD:src/lib/<file> > scratch/…`; the reverted blobs verified 0 hits for `deps?.proven`,
`proven?: readonly RankableLessonRow`, `ctx.proven`, `opts.proven`).

- **codegen** (SUT reverted, new tests intact): `# tests 137 # pass 134 # fail 3` — RED are exactly my
  3 new tests (single-module / expansion / chunked).
- **headless** (SUT reverted): `# tests 115 # pass 113 # fail 2` — RED are exactly my 2 new tests.
- **engine** (SUT reverted): `# tests 11 # pass 11 # fail 0` — **honest note:** the engine hop is a
  type/TSDoc declaration of an object forwarded *by reference*; it has no runtime branch, so an
  engine revert cannot flip a behavioral assertion. Its evidence is the headless test (the deps object
  carries `proven`) + the codegen test (the reader consumes it) + `npm run typecheck` on the seam.
  Reported, not papered over.

## §5 Other defects found / fixed / struck

- **Fixed (strike-worthy stale doc):** `headless.ts` `P6JourneyDeps.synthesize` TSDoc claimed "the cycle
  context reaches codegen **TWO ways**" (treeFailure + the `p6.tree.failure` log). 326/328 already made
  that false (synthesisRefusal, gateRepair) and 330 adds proven. Struck the narrow "TWO ways" framing for
  the accurate channel list (`headless.ts:2330-2338`). Comment-only, no behavior.
- **Verified, no defect:** every field of `P6SynthesisDeps` (`complete`/`expand`/`verify`/`treeFailure`/
  `gateRepair`/`synthesisRefusal`/`patchRepairs`/`proven`), of `P6CycleLiveDepsShape`, of `LiveLayerDeps`
  and of `P6JourneyCycleContext` now has a reader (grep + read of each site). No other produced-but-unread
  field in the six files.
- **Left as honest forward work:** the pre-existing `TODO(FM-03b)` (`codegen.server.ts:981`) and
  `TODO(FM-04b)` (`:2853`) are forward-work notes with stated reasons, not false wire claims — 328
  reached the same conclusion; unchanged.
- **Not touched (not my files):** the CLI `--knowledge` flag that will call `provenRowsFromStore(...)`
  and pass `proven` is the separate lane's job; this log fixes the name/`runUntilGate` shape it needs.

## §6 Verification (real commands, real output)

- Baselines (before my edits): codegen **134/134**, headless **113/113**, engine **10/10**.
- After: codegen **137/137**, headless **115/115**, engine **11/11** — exactly +3 / +2 / +1 (N added).
- `npm run typecheck` → exit **0** (twice: after the wire and after the tests).
- `npm run lint` → exit **0**.
- Suites run with the pinned Node 22.23.2 via `--experimental-strip-types --test --test-reporter=tap`.
- Scratch teeth tree removed after the run (`C:\Users\mnril\composer_teeth` gone).

## §7 What remains / honest limits

- The engine hop has no behavioral teeth (by construction — pass-by-reference type declaration); see §4.
- The `repairTreeDir` continuation path (`headless.ts:3531` ctx) does not accept `proven`; it was not in
  the required wire and receives no rows from any caller. If a later wave wants proven lessons in the
  emit→edit→re-emit repair loop, that is a new opt on that entry, not a missing reader here.
- The pure reframe-HITL site (`engine.ts:683`) is out of scope (§3).
