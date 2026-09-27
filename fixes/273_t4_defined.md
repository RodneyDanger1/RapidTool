# fixes/273 · W31 T4 — THE DEFINED SPECS (249: DF-09 check · T4.3 preservation probe · G4 scan+runner)

> **Lane:** W31 T4 (`wave_plans/W31/gap-finshers.md` §T4). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`, HEAD `0f85c32` + live sibling edits.
> **Spec source:** `research/multiagent/249_define_first_specs.md` (SPEC 1 DF-09 · SPEC 2 T4.3 · SPEC 3 G4 / OV-21).
> **Rules honored:** targeted checks only (no full gates) · no keyed calls · log-and-continue · additive edits only ·
> §T4 appended to `finalsprint.md` above the marker after a re-read.

## §0 · AS-FOUND (byte-verified before any edit, 2026-09-26)

The W31 planner's premise — "three DEFINED rows, not yet implemented" — is **stale by one wave**: W23 LANE 6 landed
all three in commit `b721f9c` ("W18–W23: the code-all wave — … defined checks") under that wave's **CODE ONLY**
rule ("no test/typecheck/build/lint runs"), and its lane-close record (`fixes/262` §5 landing table + the
RED-by-design note) was never written. So the *code* existed; the *verification boundary* did not. This lane's job
became: run every pin, fix what is broken, complete the missing evidence (CLI replay, teeth proofs), and record.

Verified state BEFORE any edit of mine (all `grep`/`git show`/test-run on today's bytes):

| host | state found today |
|---|---|
| `src/lib/engine.ts:1660-1675` | DF-09 guard landed: `forcedOverride` (force + P6 + `lastTest.ok===false`) + `decidedBy==="human"` + note < 12 trimmed ⇒ throws coded `RT_E_VALIDATION` |
| `src/lib/store.ts:1528-1547` | store pre-check `{ok:false, error:"… requires a rationale — at least 12 characters …"}` + forwards `note` to `approveHitl` |
| `src/components/console.tsx:2193` (= `git show HEAD:…` line 2086) | override path passes `note: force ? note.trim() : undefined` — the spec's "console half" is committed |
| `src/lib/honesty-guards.test.ts:437-550` | DF-09 block (A1/A2/A3a/A3b) — **RUN: 12 pass / 1 fail** (A2 red — a pin bug, §1) |
| `src/lib/patch.test.ts:270+` + `src/lib/patch-preservation.test.ts` | T4.3 hosts — **RUN: green** (combined leg below) |
| `src/lib/error-scan.server.ts` + `.test.ts` + CLI `scan` arm `scripts/rapidtool-cli.mjs:1932` | G4 landed — **RUN: green** |
| `scripts/README-cli.md` (`**37 subcommands**` incl. `scan` + `## Scan (scan)` section) | parity bound by `scripts/README-cli.test.mjs` — **RUN: 11/11 green** |

Baselines run by this lane (targeted, foreground):

- `node --experimental-strip-types --test --test-concurrency=2 src/lib/honesty-guards.test.ts`
  → `# tests 13 · # pass 12 · # fail 1` — the red is `honesty-guards.test.ts:473` (A2), `2 !== 0`.
- `node --experimental-strip-types --test --test-concurrency=2 src/lib/patch.test.ts src/lib/patch-preservation.test.ts src/lib/error-scan.server.test.ts`
  → `# tests 31 · # pass 31 · # fail 0`.
- `node --test scripts/README-cli.test.mjs` → `# tests 11 · # pass 11 · # fail 0` (count/list/USAGE parity intact).

Also verified: `scan` is **not** in `scripts/gate.sh` (0 hits) and `scanTreeErrorSignals` has exactly ONE call site
— the CLI arm (`rapidtool-cli.mjs:1962`) — never `emit`, never a gate (the 218 §3.4 / OV-21 advisory posture holds).

## §1 · DF-09 — the as-found RED explained, fixed, teeth proven

**The as-found failure is a PIN bug, not a guard gap.** `l6Gated()` builds its fixture via
`runToGate(seedProject(), 6)` (`testing/fixtures.ts:99`), which journals decision rows for every below-target HITL
gate it clears (fixtures.ts:114 `approveHitl(cur, { decidedBy: "human" })`). The fixture therefore arrives with
**2** decision rows. A2 then asserted `gated.decisions.length === 0` — "a thrown refusal journals nothing" — which
can never pass against a fixture that legitimately carries history. The honest pin is a BEFORE/AFTER snapshot: the
engine throw must leave the input project untouched (pure-function contract), which is exactly what "journals
nothing" means when the call never returns a project.

**Fix (this lane):** `src/lib/honesty-guards.test.ts:458-478` — snapshot `decisionsBefore` before `assert.throws`,
assert `decisionsBefore > 0` (documents the fixture's own history so the compare is non-vacuous), then compare
`gated.decisions.length === decisionsBefore` "a thrown refusal journals nothing (the input project is untouched)".
Teeth unchanged: with the guard removed the call no longer throws and `assert.throws` fails FIRST — red.

_(results appended below as runs land — §1.1 GREEN after fix · §1.2 teeth)_

## §2 · T4.3 — preservation probe completion (CLI replay + teeth)

Host 1 (`patch.test.ts` user-edit cases) and Host 2 (`patch-preservation.test.ts`, real `repairTreeDir` temp-dir
cycle, 7 asserts) are green (§0). Remaining per SPEC 2's done-when — the two parts W23 never ran:
(a) Host 3: the CLI replay over a hand-built scratch tree+ledger, envelope pasted; (b) the one-mutation teeth
proof (drop the `disk === row.source` guard in `applySynthesizedTreeToDir`, `headless.ts:2667`) must turn Host 2 RED.

_(results appended below — §2.1 CLI replay · §2.2 teeth)_

## §3 · G4 — runner verification (CLI `scan` end-to-end)

Module + colocated test green (§0). Remaining per SPEC 3's done-when: the CLI `scan` returns **exit 1** with exactly
the expected findings on a swallow fixture and **exit 0** on a clean tree; README-cli parity leg green (§0 ✓);
stated posture: never a gate.

_(results appended below — §3.1 fixtures + envelopes)_

## §4 · The RED-by-design note (kept honest)

SPEC 1's A4 required the DF-09 block to be RED on the pre-guard tree and GREEN after the store+engine guard. On
today's tree the guard IS landed (W23), so the honest end-state is **GREEN with mutation teeth** — the RED is
reproduced as the teeth proof (guard removed in a scratch copy ⇒ block red), and the as-found red (the A2 pin bug)
is recorded above with its exact cause. No assertion was weakened: the A2 fix replaces a can-never-pass literal
compare with a strictly stronger non-vacuity precondition + snapshot compare. Nothing here is claimed as red that
runs green, and nothing green that has not been run.

## §5 · Landing record (file:line) + what is still owed

_(appended at lane close — see below)_
