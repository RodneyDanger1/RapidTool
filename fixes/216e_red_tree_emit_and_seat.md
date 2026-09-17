# fixes/216e — Lane 2: F-07 red-tree emit (T-07) + the remaining half of P0-01 (TA-2)

**Lane:** 2 of RESUME.md §3.2 wave · **Date:** 2026-09-16 · **Status: in-progress**

**Owned files (only these):** `src/lib/headless.ts`, `src/lib/headless.test.ts`,
`scripts/run-eval.mjs` · **Log (sole writer):** this file.

**Specs:**
- `research/multiagent/106_rapidtool_deep_analysis.md` §6 **T-07** (finding **F-07**)
- `research/multiagent/105_plan_critique.md` **TA-2** (contradiction **C3**)

---

## Tasks

### T-07 (P0) — `emit` must refuse (coded error) or stamp an unmissable banner on an uncleared red tree-run

**Problem:** the engine logged a `p6.tree.failure` three times and shipped the tree anyway, with the
phase rail claiming P6 `complete`. `emit` after a `p6.tree.failure` with **no subsequent green
tree-run** must either fail with an `RT_E_*` coded error or stamp an **unmissable banner** into the
emitted `README.md`. **Both branches must be pinned in a test.**

**Constraint:** `parseGateTreeRows` deliberately **fails open** — that is a SETTLED decision
(RESUME §10) and must not be reverted. Only read its docstring; do not touch its semantics.

### TA-2 (P0-01's other half) — the harness seat must not be a bare machine-minted `"human"`

**Problem:** `headless.ts` `approve()` hardcodes `decidedBy: "human"`, and `scripts/run-eval.mjs`
calls it directly for the benchmark's "human seat" — so a machine path mints a human actor. T0.7
closed only the CLI path. Give the harness a **real, labelled, non-human-default seat** with the
out-of-band token path documented; never mint `decidedBy: "human"` from a machine path.

**Regression to keep green:** `ok 11 - 216 T0.7: a non-TTY approve cannot mint decidedBy:human`.

---

## Work log (append as I go)

### W2 · R2 continuation (this lane) — status: in-progress

Plan (settled design from the W1 lane summary + parent brief; NOT re-derived):
1. Wire T-07 into `emitProject`: `EmitProjectOptions.redTree` (default `"refuse"`), the
   `RT_E_TREE_RUN_FAILED` refusal before ANY write (no partial emit), the `"banner"` policy
   (prepend `redTreeBanner(trail)` to the emitted README.md, stamp `redTreeBanner:true` +
   `redTree` on the result), `"probe"` = never consult. `run-eval.mjs` passes `"banner"`.
2. Pin both branches + a green control in `headless.test.ts`; keep the T0.7 regression green.
3. TA-2: `ApproveActor` seat on `approve()` — default the harness autopilot seat (never
   machine-minted `decidedBy:"human"`), human seat gated by the out-of-band
   `RT_HUMAN_SEAT_TOKEN` presented as `opts.humanSeatToken`; CLI `:534` one-liner passes the
   human actor + env token for `--i-am-human`; token path documented in `scripts/README-cli.md`.
4. Pin (a) a non-TTY approve without the token cannot mint `decidedBy:"human"`, (b) the keyed
   human-seat path via the injected seam (test-set env token, no real key exists).

## Work log — W2 · R2 (code + verification by the R2 lane; this text completed by W3 · L2)

> **Recovery note (W3 · L2):** the R2 lane finished the code and the verification runs but hit
> its iteration cap **before writing this section**. The entries below are transcribed from its
> final report (`subagent-summary-1-20260916_200339_576955.txt`) — every command/result quoted is
> the R2 lane's real output, not re-invented. Parent boundary repairs that followed are noted
> where they superseded an R2 blocker.

### T-07 — wired (refuse default / banner / probe)
- `RedTreeRef = { failures: number; lastFailure: string }` exported (`headless.ts` ~:1086); the
  `EmitProjectResult` ok-branch gained `redTreeBanner?` + `redTree?`, and the ok:false union
  member carries `redTree?` too (~:1104-1116).
- `EmitProjectOptions { force?; redTree?: "refuse" | "banner" | "probe" }` (~:1244-1257); the
  durable trail is read via `treeRunTrail(project)` **BEFORE the scaffold compile, target dir,
  lock and any write** — a `"refuse"` (default) refusal returns `ok:false`,
  code `RT_E_TREE_RUN_FAILED`, `redTree{failures,lastFailure}` and leaves **nothing** on disk
  (pinned by asserting the emit dir itself does not exist). `"banner"` prepends `redTreeBanner(trail)`
  to the emitted `README.md` before the lock/file loop and stamps `redTreeBanner:true` +
  `redTree{...}` on the result; `"probe"` never consults the trail (both result fields stay
  absent / unset). `resolve`/lock/apply loop now thread `files` (the bannered README) through
  snapshot, write loop and `moduleEmbedded` (~:1312-1400).
- `scripts/run-eval.mjs` (~:272-281 docstring corrected; ~:424-460) now emits with
  `{ redTree: "banner" }` and records the honest `redTreeBanner` metric on the handover evidence.
- **Parent audit after R2 (recorded here because it closed R2's flagged blocker):**
  `headless.ts:1619` — the INTERNAL P6 candidate emit — was audited and now passes
  `redTree: "probe"` so a red trail can never kill the repair loop; the refuse/banner guard
  stays on the ship paths (CLI `emit` keeps the default; `run-eval` passes `"banner"`).

### TA-2 — the seat (no machine path mints `decidedBy:"human"`)
- `approve()` (~:727-796) records an explicit `ApproveActor` seat. Default =
  exported `HARNESS_APPROVE_ACTOR { decidedBy: "autopilot", seat: "harness" }` — the old
  hardcoded `decidedBy: "human"` is gone, so no machine path can mint a human actor. The human
  seat `{ decidedBy: "human", seat: "human-cli-i-am-human" }` additionally requires the
  out-of-band `RT_HUMAN_SEAT_TOKEN` in the environment **and** presented as
  `opts.humanSeatToken`, otherwise it throws a coded `RT_E_VALIDATION` error and writes nothing.
  Every persisted row's note carries a `[seat <label>]` tag.
- CLI one-liner (`scripts/rapidtool-cli.mjs:534`) passes the human actor +
  `process.env.RT_HUMAN_SEAT_TOKEN` when `--i-am-human` is given; the token path is documented
  (append-only) in `scripts/README-cli.md` in the section
  *"The approve seat — --i-am-human + the out-of-band RT_HUMAN_SEAT_TOKEN (216 · TA-2)"*.
- **Regression kept green:** `ok 11 - 216 T0.7: a non-TTY approve cannot mint decidedBy:human`
  (unmodified).

## Verification (R2 lane's real output)

- `node --experimental-strip-types --test src/lib/headless.test.ts` — **baseline before edits:
  74 tests / 74 pass / 0 fail (exit 0)**; **after all edits: 83 tests / 83 pass / 0 fail
  (exit 0)** — exactly +9 (4 T-07 + 5 TA-2). TAP: `ok 11` (T0.7, untouched regression),
  `ok 12` (TA-2), `ok 20` (T-07).
- `npm run typecheck` was **exit 0** while only `headless.ts` was under edit; the final full
  typecheck read exit 2 with **38 errors ALL in `src/lib/codegen.server.test.ts`** (a sibling
  lane mid-edit, TS1160 unterminated template literal) — **zero belonging to this lane's files**
  (`grep headless` → no output). *Parent status: that sibling file was repaired at the W2
  boundary; the full gate is green on the frozen tree (`typecheck 0` / scripts 215 + src 1702).*
- Probes (throwaway scripts, since deleted by the parent): keyless drain reaches no
  `forceHuman` gate (flipping `approve()`'s default cannot stall it); the standard keyless drain
  carries no tree verdict (`emit` stays green); the CLI seat matrix — no token → exit 4,
  `RT_E_VALIDATION`, 0 decisions written, `status awaiting_hitl`; with token → exit 0, row
  `decidedBy=human` + `[seat human-cli-i-am-human] … RT_HUMAN_SEAT_TOKEN verified`; plain →
  exit 1 `RT_E_VALIDATION`.
- T-07 pins (all green): red trail + default ⇒ `ok:false`, `RT_E_TREE_RUN_FAILED`, error
  matches `/tree-run trail is RED/`, `redTree.failures === 3` (the F-07 count), emit dir does
  not exist; red trail + `"banner"` ⇒ `ok:true`, `redTreeBanner:true`, `redTree.failures===1`,
  README starts `> [!CAUTION]\n` and matches `/RED TREE-RUN|1 failed tree-run|entry module exited 1/`;
  green-cleared control ⇒ `ok:true`, `redTreeBanner:false`, `redTree:null`, README byte-identical
  to the plain one; `"probe"` ⇒ `'redTreeBanner' in res === false`, `'redTree' in res === false`.
- TA-2 pins (all green): default `approve` records `decidedBy === "autopilot"` + note
  `/^\[seat harness\]/`; human actor without/with a wrong token throws `/RT_HUMAN_SEAT_TOKEN/`
  and leaves `p.decisions.length` unchanged + `status awaiting_hitl`; the matching token via the
  injected seam records `decidedBy "human"` + `/\[seat human-cli-i-am-human\]/` +
  `/RT_HUMAN_SEAT_TOKEN verified/`; the CLI paths exit non-0/0 as above with the persisted row
  verified.
- **Assertion changes (rule 7 disclosure):** none weakened or deleted. Two deliberate,
  recorded adjustments: (a) `approve()`'s default actor flipped from hardcoded
  `decidedBy:"human"` to the harness autopilot seat — this IS the TA-2 fix; the pre-existing
  tests at `headless.test.ts:53/259/793` call `approve()` and assert only phase/status/gate/log
  effects, and all stayed green (83/83). (b) `run-eval.mjs`'s `drainPipeline` docstring said
  "the eval's human seat" — corrected to the autopilot seat (comment only).

## Files changed (R2 lane)

- `src/lib/headless.ts` ~:727-796 (TA-2 seat), ~:1086-1116 (RedTreeRef + result fields),
  ~:1244-1345 (`EmitProjectOptions` + trail-first refusal + banner), ~:1380-1408 (write loop +
  result stamps).
- `src/lib/headless.test.ts` — new TA-2 describe (5 tests) + T-07 describe (4 tests).
- `scripts/run-eval.mjs` ~:272-281 + ~:424-460; `scripts/rapidtool-cli.mjs:534`;
  `scripts/README-cli.md` (appended seat section).

## Not done / blockers (R2 lane) — status after the parent's W2 boundary

- ~~`fixes/216e` text owed~~ → **this section; done by W3 · L2** from the R2 report.
- ~~Internal caller `headless.ts:1619` inheriting the `"refuse"` default~~ → parent audited;
  now `redTree: "probe"` (deliberate, do not revert).
- ~~`codegen.server.test.ts` unparseable from a sibling lane~~ → parent repaired at the W2
  boundary (JSDoc `*/` fix); full suite green.
- ~~Three throwaway probe scripts at the repo root~~ → deleted by the parent.
- `scripts/rapidtool-cli.mjs:534` / `run-eval.mjs` / `README-cli.md` were edited under the R2
  lane's explicit ownership grant; W2 close verified no sibling change was clobbered (README-cli
  is W3-L4's file this wave — no further edits made here).
- `taskuniverselog.md` shows T-07/TA-2 as ✅ W2 (flipped by the parent at the W2 boundary) —
  nothing owed.
