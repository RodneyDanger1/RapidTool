# 244 · LANE 2 — TASK-01 · `nextAction` on the summary envelope

**Status:** DONE — landed, verified, and already inside the parent's wave commit `4328d20`
("W14–W16 wave … all certified", 2026-09-24 13:29:33 -0500); this log is filled after that commit.

**Bottom line:** the summary envelope now carries `nextAction: {kind, cmd, phase, why}` drawn from the
SAME 7-arm vocabulary the console renders — `NEXT_ACTION_BUTTON` in `src/components/console.tsx`
(`run · approve · retry · done · running · fix-gate · unknown`). Arm-parity is pinned by a NEW
doc-contract test (`scripts/next-action-arm-parity.test.mjs`, 4 tests) that reads the console source
TEXT and asserts set + order equality both directions, so envelope and UI can never drift. Keyless CLI
probes show the field live on both the `summary` path and a real parked run (`gate` → `approve` arm).
`src/lib/headless.test.ts` stays **92/92**. One doc touch (`scripts/README-cli.md`) is OUT of this
lane's box — exact patch proposed at the bottom; the CLI's own `USAGE` string carries the declaration
in-file instead.

---

## Box respected
- `src/lib/headless.ts` — summary envelope region ONLY (hunks @40 / @957 / @979 / @1017 vs `7582771`).
- `scripts/rapidtool-cli.mjs` — the `summary` arm ONLY (its USAGE string; the arm's code needed none).
- NEW `scripts/next-action-arm-parity.test.mjs` — the doc-contract test.
- **NOT touched:** `console.tsx` (its 45-line diff in 4328d20 is L3's work), `headless.test.ts`
  (kept at 92/92, zero edits), `README-cli.md`.

## What landed
1. `src/lib/headless.ts` (the ONE producer; no second derivation):
   - `export const NEXT_ACTION_KINDS` — runtime tuple twin of the console's `UiNextAction["kind"]`
     union (`run/approve/retry/done/running/fix-gate/unknown`), + `NextActionKind` + `NextAction`
     (`{kind, cmd, phase, why}` — the 111 §3.4 shape, `cmd: string` mirroring the console exactly).
   - `export function nextAction(project): NextAction` — faithful transcription of the console's
     `uiNextAction` branch order over PERSISTED state: empty-phases (`unknown`, returned BEFORE any
     phase lookup) → running → hitl → blocked → complete → failed gate → rejected → default run.
     `unknown` is mandatory; every other arm names a real CLI verb (status/gate/approve/retry/emit).
   - `ProjectSummary.nextAction: NextAction` + `summary()` returns `nextAction: nextAction(project)`.
   - `PHASES` added to the EXISTING `./phases.ts` import (for the console-mirrored
     "All 13 phases are sealed" sentence).
   - Console computation deliberately NOT rewired (parent decision taskuniverselog.md:534–538:
     same vocabulary, two INDEPENDENT computations this wave).
2. `scripts/rapidtool-cli.mjs` — `case "summary":` (`:1464`) needed NO code change (it serialises the
   whole `h.summary(project)` object — the playbook's "no second wiring needed"). Its USAGE entry
   now declares the field: `summary --project <file.json>   # envelope: ok + summary incl. nextAction
   {kind,cmd,phase,why} — the SAME 7-arm vocabulary the console renders (…)` (`:2942`).
3. `scripts/next-action-arm-parity.test.mjs` — NEW doc-contract test, content-anchored (see below).

## Arm-parity design (why it cannot drift)
- The test reads `src/components/console.tsx` as SOURCE TEXT (`node:fs`) — never imports the .tsx
  (scripts leg = bare Node; a component import would be invisible to `headless.test.ts` anyway).
- Matching is by SYMBOL + regex, not line numbers — console.tsx is edited by L3 in this wave; I
  watched `NEXT_ACTION_BUTTON` move `:382` → `:401` mid-session and re-verified the record bytes
  were unchanged. Line drift breaks nothing.
- It pins, both directions: `NEXT_ACTION_BUTTON` keys (exactly 7, unique) === `UiNextAction` kind
  union === wire `NEXT_ACTION_KINDS` (+ the tuple mirrors the union's declared order); all 7 arms
  reachable and DISTINGUISHABLE via fixtures (e.g. `fix-gate` cannot silently collapse into `run`);
  envelope shape exactly `{cmd,kind,phase,why}`; every `cmd` ∈ `{gate, approve, retry, emit, status}`;
  branch-order pins (running > hitl > blocked > complete > fix-gate > rejected-run > default;
  empty-phases → `unknown` even when `status:"complete"` — the console's `:313` rule).

## Evidence (every claim = the command that produced it)
1. Vocabulary read first: `sed -n '360,430p' src/components/console.tsx` → `NEXT_ACTION_BUTTON`, 7 arms.
   Drift re-check: `grep -n -A10 NEXT_ACTION_BUTTON src/components/console.tsx` → `:401`, same 7 arms.
2. `grep -c nextAction src/lib/headless.ts` → **3** (was 0; the playbook's verify condition).
3. `node --test scripts/next-action-arm-parity.test.mjs` → `# pass 4 / # fail 0`, exit 0
   (run three times: after the patch set, on final bytes, and post-commit against the committed
   console.tsx).
4. `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` →
   `# tests 92 / # pass 92 / # fail 0` (56 046 ms).
5. Keyless `summary` probe (env pinned keyless: `DEEPSEEK_API_KEY=`):
   `node --experimental-strip-types scripts/rapidtool-cli.mjs summary --project C:/Users/mnril/w16l2_scratch/probe.json`
   → exit 0; `"nextAction": {"kind":"run","cmd":"gate","phase":0,"why":"Ready when you are — run P0 (Deep Research & Feasibility)."}`
6. Keyless `gate` probe — a REAL state transition: `… gate --project …/probe.json` → exit 2 (parked),
   4 phases complete, P4 `awaiting_hitl`; envelope:
   `"nextAction": {"kind":"approve","cmd":"approve","phase":4,"why":"Phase P4 is finished — it's waiting for your approval."}`
7. Probe project minted keyless: `… create --brief "Invoice reconciliation tool for a small accounting team" --name "W16L2 probe" --out C:/Users/mnril/w16l2_scratch/probe.json` → exit 0.
8. Landed in the commit: `git show --stat 4328d20 | grep -E "next-action|244_lane2|headless.ts|rapidtool-cli|console.tsx"`
   → `fixes/244_lane2_task01.md | 27 +`, `scripts/next-action-arm-parity.test.mjs | 132 +`,
   `scripts/rapidtool-cli.mjs | 36 +-`, `src/lib/headless.ts | 147 +-`, `src/components/console.tsx | 45 +`;
   `git show HEAD:src/lib/headless.ts | grep -c nextAction` → 3; `git status --porcelain` clean at that HEAD.
9. USAGE line at HEAD: `git show HEAD:scripts/rapidtool-cli.mjs | grep -ci 'same 7-arm vocabulary'` → 1
   (worktree identical).

## Notes / honest caveats
- **HOT file concurrency (rapidtool-cli.mjs).** The patch tool flagged a concurrent sibling writer
  (`sa-1-99106cf6`) on this file; its final bytes at HEAD still carry my USAGE line (byte-identical
  worktree/HEAD, verified above). One intermediate `grep -c 'same 7-arm vocabulary'` returned 0 —
  that was a **case-sensitive grep artifact** (`same` vs the line's `SAME`), NOT a clobber; recorded
  here so the observer does not re-open a phantom incident.
- **`src/lib/headless.ts` diff vs `7582771` includes one hunk near `driveP6Journey` (~@1914) that is
  NOT this lane's** — pre-existing uncommitted W15-L1 repair-seam work already in the tree. My four
  patch anchors: the `./phases.ts` import line, `PhaseCounts`/`ProjectSummary`, the
  `sealedWithFailures` field, and the `summary()` return object.
- The console's `uiNextAction` was read and transcribed, never modified (L3 owns that file this wave).
- The wire can only read PERSISTED phase status; the console additionally folds in its in-flight
  latch — both return `running` for the recorded case, and the envelope's `running` arm is documented
  as the honest floor (comment in `headless.ts`).

## Doc proposal (out of this lane's box — exact patch for the parent)
`scripts/README-cli.md`, §"Agent contract" (~line 818), the summary-hints bullet — append one clause:
```
  ... holds note-able content — i.e. `vault` will succeed). `nextAction`
  ({kind, cmd, phase, why}) names the ONE next step in the SAME 7-arm
  vocabulary the console renders (run/approve/retry/done/running/fix-gate/unknown).
```
(`grep -c nextAction scripts/README-cli.md` = **0** today even at HEAD — this is the only part of
the playbook's TASK-01 seam not landed, because the README is outside this lane's box. The CLI's own
`USAGE` string carries the declaration in-file in the meantime.)

## Fresh re-verification (after this log was written)
- `node --test scripts/next-action-arm-parity.test.mjs` → `# pass 4 / # fail 0`, exit 0.
- CLI smoke on the edited file: no-arg invocation prints the USAGE envelope with the new `summary`
  line verbatim; `DEEPSEEK_API_KEY= … summary --project …/probe.json` → exit 0,
  `nextAction {kind:"approve", cmd:"approve", phase:4, …}` (the parked probe project).
- `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` →
  `# tests 92 / # pass 92 / # fail 0` (69 296 ms).
- `npm run lint` (full scope, run on the verification request) → **exit 1, 2 errors — both OUTSIDE
  this lane**, in `scripts/README-cli.test.mjs` `:211:9` + `:212:26` (`no-regex-spaces`). That file
  was last touched by commit `4328d20` and is clean vs HEAD (no active writer) — the errors are
  pre-existing there, NOT caused by this lane's USAGE edit. **Scoped `npx eslint
  src/lib/headless.ts scripts/rapidtool-cli.mjs scripts/next-action-arm-parity.test.mjs` → exit 0,
  clean.** Control-verified 2-char fix for the parent (scratch copy
  `C:/Users/mnril/w16l2_scratch/README-cli.fixed.mjs`; `eslint --stdin --stdin-filename` runs:
  original → same 2 errors, fixed → clean):
  - `:211` `if (/^  \}/.test(line))` → `if (/^ {2}\}/.test(line))`
  - `:212` `line.match(/^    "?([a-z][a-z-]*)"?: /)` → `line.match(/^ {4}"?([a-z][a-z-]*)"?: /)`
  (not applied — file is outside this lane's box; observer rules forbid out-of-box edits.)
- `node --test scripts/README-cli.test.mjs` → `# pass 11 / # fail 0` (it parses the CLI `USAGE` map
  this lane edited — no interaction with the `summary` USAGE edit).
- Full-tree gates (`npm test` / `npm run typecheck` / `npm run build`) NOT run by this lane —
  wave rule (parent boundary only; other lanes mid-edit in this tree).
