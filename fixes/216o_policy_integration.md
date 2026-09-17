# 216o — Policy engine INTEGRATION (W5 · LANE 3 · Wave H T-107.3 routing) — COMPLETE

**Status:** COMPLETE. Code + pins landed by W5-L3 and W6-L2; this body was assembled by **W8-L2**
(2026-09-17) from the two lane summaries (`subagent-summary-2-20260916_213829_505012.txt` = W5-L3
routing; `subagent-summary-1-20260916_220208_508348.txt` = W6-L2 pins + provenance) and
**re-verified from fresh runs made in the W8-L2 session** — every number in §3 is that run's real
output. Run logs kept at `C:\Users\mnril\_w8l2\`.

**Mission.** W4-L2 landed the pure core (`src/lib/policy.ts`, `evaluatePolicy`, 27 tests) but
nothing routed through it. This lane routes EVERY approval through the seam:
`src/lib/headless.ts` `approve()`, `scripts/rapidtool-cli.mjs` approve verb, `src/lib/dod.ts`
approval criteria (:337-483 + the `approvalActor` reader at :54).

**Owned files:**
- `src/lib/headless.ts` (approve() seat/token decision only)
- `scripts/rapidtool-cli.mjs` (approve verb guards only — no verb-count changes)
- `src/lib/dod.ts` (approval criteria + reader only)
- `src/lib/types.ts` (ONE additive optional field — added to this lane's set in W6)
- `src/lib/headless.test.ts` / `src/lib/gates.test.ts` (pins)
- `fixes/216o_policy_integration.md` (THIS file)

## 1. Work log (append-only)

1. **RECON (W5-L3)** — `policy.ts` contract (`evaluatePolicy` :170, `KNOWN_POLICY_ACTIONS` :102,
   `seatLabel` :146, `isVerifiedHumanSeatToken` :134); `wave_plans/W4/lane-2.md`; the
   **`fixes/216n` §4 wiring list** (headless `:734`; cli `:517`; dod `:337/:349/:471/:483`) — incl.
   the cross-file need it flags: *"the ledger row records only `decidedBy` … a provenance field
   (seat label + token-path bool) requires types.ts (HitlDecision) ownership"*; `100` P0-01/P0-02/
   P0-06; the W2 `ApproveActor` / `[seat …]` pins.
2. **BASELINE (W5-L3)** — headless 84/84 (the task brief said 83 — the disk count was 84),
   gates 85/85, README-cli 5/5, typecheck 0. No regression from the routing edits.
3. **`headless.ts` `approve()` → the seam (W5-L3)** — `import { evaluatePolicy, seatLabel }` at
   :44; action = `force === true ? "hitl.force" : "hitl.approve"`; resource = `gate:P<n>`; ctx =
   `{ actor, humanSeatToken: opts.humanSeatToken, expectedHumanSeatToken: process.env.RT_HUMAN_SEAT_TOKEN }`
   (the env read stays AT THE CALL SITE — `policy.ts` is a pure, env-free leaf, purity-tested);
   deny ⇒ coded `RT_E_VALIDATION` throw naming `verdict.reason` + `verdict.fallback`; allow ⇒
   `[seat <label>]` note tags kept **BYTE-IDENTICAL** to the pre-216o strings.
4. **`rapidtool-cli.mjs` approve verb → same seam (W5-L3)** — the verb consults `evaluatePolicy`
   BEFORE handing the decision to the driver (:534-566): `--force ⇒ hitl.force` else `hitl.approve`;
   `--i-am-human` is the human-seat claim; deny ⇒ exit 1 `RT_E_VALIDATION`. The 216 non-TTY guard
   stays deliberately STRICTER; ZERO verb-count / exit-code / JSON-contract changes.
5. **`dod.ts` approval criteria → seam-consistent (W5-L3)** — `classifyRowSeat` parses the
   `[seat <label>]` tag (unregistered tag ⇒ `tagged-unknown`, fail-closed) and
   `policyConsistentApproval(row, phase)` re-asks the seam for `hitl.approve` on the row's gate;
   the four "decision ledger records the approver" criteria (p4/p5/p8/p9) route through it;
   untagged rows keep the 216 T0.8 tolerance (deliberate).
6. **PROVENANCE (W6-L2)** — `HitlDecision.decidedVia?` added in `types.ts` (:180-207; the field at
   :200 carries `action` / `resource` / `reason` / `label` / `tokenPath`, ADDITIVE + optional so
   pre-216o rows parse); `stampDecidedVia()` (`headless.ts` :753-765) stamps the ALLOWING verdict
   onto the FRESHLY appended row only (id-not-in-input guard ⇒ defensive no-ops and legacy rows
   pass through byte-identical); threaded at the approve mint (:851-863); the CLI's row provenance
   is BY CONSTRUCTION (the CLI hands the decision to `h.approve`, whose seam verdict stamps the
   row — `rapidtool-cli.mjs` :549-552 records exactly this); `provenanceConsistent()` (`dod.ts`
   :108-116) cross-checks a row's `decidedVia` against its own `[seat …]` tag (gate, action,
   label, `tokenPath === (seat.decidedBy === "human")`) and is wired into `policyConsistentApproval`
   (:134) — a contradicting row fails the approval criteria CLOSED.
7. **PINS (W6-L2)** — `headless.test.ts` NEW describe `"216o / W6-L2"` (:1423-1554), **6 added
   tests**: 3 PINs (deny un-bypassable under BOTH seats even with a verified token; autopilot
   `hitl.force` refused + coded `RT_E_VALIDATION` + fallback named + nothing minted + gate still
   parked; human-seat force without the token refused) + 1 POSITIVE CONTROL (human + token allows
   force; the row records action/resource/label/`tokenPath:true`) + 2 provenance tests (default
   approve records autopilot provenance `tokenPath:false`; CLI approve lands provenance on the row
   it mints).
8. **FINAL VERIFICATION (W8-L2, this session)** — headless **90/90** (all 6 pins green), gates
   **85/85**, README-cli snapshot with the sibling caveat below, typecheck **exit 0 / 0 errors**;
   plus the mid-edit disclosure in §3 (run 3) and §5.

## 2. Old→new string/behavior ledger

| # | What | Old | New | Reason |
|---|---|---|---|---|
| 1 | `approve()` seat/token decision | ad-hoc branch inside `headless.ts` | verdict from `evaluatePolicy` (one seam) | T-107.3 — one rule, no bypass |
| 2 | `[seat …]` note tags | `[seat harness] autopilot seat — no human decision claimed` / `[seat human-cli-i-am-human] out-of-band RT_HUMAN_SEAT_TOKEN verified` | **unchanged, byte-identical** (pinned by the pre-existing TA-2 tests + the new positive control's note assertion) | the tag names the SEAT, not the policy label vocabulary |
| 3 | `HitlDecision` shape | `{ id, phase, decision, note?, decidedBy, requestedAt, decidedAt }` | **+ optional `decidedVia`** (:200) | ledger records WHERE the decision came from (216n §4.3 need) |
| 4 | dod approval criteria | actor-proxy check (T0.8) | seam re-ask + `provenanceConsistent` on tagged rows | a tag and its recorded provenance must AGREE or fail closed |
| 5 | CLI approve | `--force` non-TTY guard only | + seam consult before the driver (defense in depth — same rule twice, one process) | P0-01/P0-06 |
| 6 | No-op approvals / legacy rows | n/a | pass through **byte-identical** (no `decidedVia` invented for rows the path didn't mint) | additive-only design |
| 7 | Seat strings | `autopilot/harness`, `human/human-cli-i-am-human` | **no rename** — deliberately byte-identical | zero-drift contract for existing pins |

## 3. Real command output (W8-L2 re-runs, 2026-09-17 — real pastes from `C:\Users\mnril\_w8l2\`)

```text
RUN 1 — 08:52 (the canonical snapshot)
$ node --experimental-strip-types --test src/lib/headless.test.ts
exit=0
# tests 90
# suites 27
# pass 90
# fail 0
# skipped 0

  # Subtest: 216o / W6-L2 — the seam's DENY is un-bypassable by both seats; approve() rows record provenance
    ok 1 - PIN — a policy DENY is un-bypassable by BOTH seats: an unregistered action denies even with a verified token
    ok 2 - PIN — hitl.force cannot self-approve: the autopilot seat's force is refused, coded, and mints nothing
    ok 3 - PIN — hitl.force via the human seat WITHOUT the out-of-band token is refused too (deny for BOTH seats)
    ok 4 - POSITIVE CONTROL — the human seat WITH the token may force, and the row records the token path
    ok 5 - the default approve records provenance: hitl.approve, autopilot/harness, no token path
    ok 6 - CLI — an approve landed by the CLI carries the provenance on the row it mints
  ok 13 - 216o / W6-L2 — the seam's DENY is un-bypassable by both seats; approve() rows record provenance

$ node --experimental-strip-types --test src/lib/gates.test.ts
exit=0
# tests 85
# suites 15
# pass 85
# fail 0
# skipped 0

$ node --test scripts/README-cli.test.mjs
exit=1
# tests 8
# pass 5
# fail 3
  # the five pre-existing TASK-06 tests: ok (the approve contract + the verb-count equalities hold)
  not ok 6 - W7-L3: the `edit` arm exists, reads the documented dry-run/write flags
  not ok 7 - W7-L3: the `edit` write path reuses the str_replace primitive + the ONE policy seam
  not ok 8 - W7-L3: the README documents the `edit` verb's dry-run default + --write flag
  # ^ the 3 failures are W8-L3's re-landed tests (file mtime 08:51:24) awaiting their subject
  #   (the `edit` arm + its README section), NOT this lane's contract. See §5.

$ npx tsc --noEmit
typecheck exit=0
error TS lines: 0
```

```text
RUN 3 disclosure — 08:57 (a sibling was mid-edit; recorded for honesty)
$ node --experimental-strip-types --test src/lib/headless.test.ts
exit=1
# tests 90
# pass 81
# fail 9
  # ALL 9 failures are: ReferenceError — "Cannot access 'unmaterialisedJobs' before
  # initialization" at src/lib/scaffold.ts:2351 (Module.scaffoldProject → emitProject,
  # headless.ts:1412). scaffold.ts mtime 08:55:42 = W8-L1's in-flight edit. NOT attributable
  # to 216o. The 216o block itself stayed green in this run: "ok 13 - 216o / W6-L2 …"
  # with pins ok 1-6 (re-read from /c/Users/mnril/_w8l2/headless_run3.log).
```

## 4. Cross-file needs (NOT this lane's files)

- **`types.ts` was the flagged cross-file need** (216n §4.3) — it was folded into this lane's
  ownership in W6 and LANDED (:180-207). No open need.
- **`gates.test.ts` pin owed (small):** the suite is 85/85 and NOT grown — no dedicated dod pin yet
  exercises the `decidedVia`↔tag CONTRADICTION branch (`provenanceConsistent` is written and wired;
  the 6 headless pins cover the mints + refusals, not the dod contradiction path). Recorded in §5.
- **`engine.ts` untouched on purpose** — the mint stays in `approveHitl` (engine.ts); the stamp is
  the additive tail in `headless.ts`. No change needed.
- `scripts/README-cli.test.mjs` is W8-L3-owned and mid-land this session (see §5) — not a need of
  this lane.

## 5. Not done / deferred

- **gates suite NOT grown (85/85):** the dedicated dod pin for a `decidedVia`↔`[seat …]`
  contradiction was flagged by W6-L2 and is still owed. The branch fails closed by construction; it
  just has no direct pin.
- **README-cli at W8-L2 verification time (W8-L3-owned, mid-land):** run 1 (08:53) = 8 tests /
  5 pass / 3 fail; re-polls during the window = 4/4 then 6/2 converging as W8-L3 lands the `edit`
  arm (arm appeared at :1115, `grep -c 'case "'` = 35 at 08:56) + its README section. The five
  pre-existing tests were green in run 1 — **the 216o CLI contract (exit codes / JSON / verb-count
  equalities) is intact**; the transient failures are W7-L3's re-landed tests awaiting their subject
  (W8-L3's done-when), never a 216o regression.
- **Sibling-edit disclosure:** run 3 (§3) went red via `scaffold.ts:2351` (W8-L1 mid-edit). Kept
  here so the wave boundary can attribute it correctly instead of re-deriving it.
- **Authorship note:** the work-log facts are the two lane summaries' claims **verified against the
  disk** (grep/sed on every cited hunk) — not re-run claims. The only numbers carried forward are
  the historical baselines (84, 85, 5, typecheck 0 W5-L3); everything in §3 is this session.
