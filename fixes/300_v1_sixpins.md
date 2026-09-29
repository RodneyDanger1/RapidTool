# fixes/300 — V1: land T2's six diagnosed reds (four stale-pin re-points + one real product fix)

HEAD on entry: `4af061a` (tree clean). T2's byte-proof diagnoses (at `3ebea43`) live in
`delegation/subagent-summary-1-20260928_223236_648284.txt`. Method: land T2's spec'd edit →
run THAT file foreground (`node --experimental-strip-types --test <file>`) → green → next.
Stale pins re-pointed asserting MORE (the new contract wins); the real bug fixed at cause with
T2's exact replacement. No keyed calls. All legs foreground.

Status: CLOSED — all six landed; every implicated file re-run foreground green.

## Evidence (file:line → before → after → why)

1. `src/lib/headless.test.ts:635-639` (`stripVolatiles`, W-02 keyless floor @:606) —
   before: masks = {`compiled_at` text+embed} only; after:
   + `.replace(/"input_hash": "[^"]+"/g, '"input_hash": "FIXED"')`.
   Why: fixes/295 (F2-03, `60c92a2`) added the envelope `input_hash: packetInputHash(project)`
   (packet.ts:135), which folds `createdAt` / `logs[].ts` / `decisions[].decidedAt` —
   wall-clock fields the pin already masks elsewhere. T2 probe: recomputing the hash over the
   time-zeroed project gives `446379525` on BOTH sides → zero behavior change, stale pin only.
   Re-run: **96/96 pass** (was 95 pass / 1 fail).

2. `src/lib/engine.ts:1318-1331` (`fitLessonEvidence`, branch @:1322-1327) —
   before: `if (room <= 0) break;` sat BEFORE the atomic branch, so a 249-char verbatim
   `unmet:` head (room = −12) discarded `class: RT_E_LLM_REJECTED` outright and the final
   `.slice(0, 240)` trampled mid-word — violating the function's own doc (@:1298-1304:
   "the class clause is ATOMIC … unmet trimmed from its tail first").
   After: the room guard moved into the tail/else branches; the atomic branch exact-fits per
   T2's replacement:
   `const keep = Math.max("unmet: ".length, budget - 3 - seg.length); out = `${out.slice(0, keep)} · ${seg}`;`
   → the class clause lands WHOLE and the fitted digest ends at exactly 240 (unmet trimmed
   from its tail first; the tail clause is sliced to remaining room as before).
   Equivalence: every previously-reachable path is byte-identical (exact-fit reduces to the
   old head-slice when the old formula fit; the empty-head floor case is unchanged) — the fix
   changes only the over-budget-head case, which previously produced a trampled string.
   Re-run: **25/25 pass** (was 1 fail). *Deviation note: T2 specced the branch body; the
   guard relocation re-derives the same intent (branch was unreachable otherwise).*

3. `src/lib/report-intake.test.ts:208,212` (applyReport blocked note; input @:201) —
   before: asserted the pre-marker bytes `"stalled on validation fixture"`; after: asserts the
   MARKED bytes `"[agent report] stalled on validation fixture"` (asserting MORE: the marker
   presence is now pinned). Why: F2-21 (W37 Y3) stamps
   `REPORT_BLOCK_MARKER = "[agent report] "` onto `rejectionNote` + `rejectionHistory[0].note`
   (report-intake.ts:426); the product comment's "re-point owed" note (:424) flipped to
   "landed (fixes/300)". Repo-wide grep: no other pin asserted the raw note.
   Re-run: **23/23 pass** (was 1 fail).

4. `src/lib/scaffold.test.ts:743,761` (leftover job-* oracle rows) —
   before: `/…\/TODO\\+\(E-15\\+\) stub\/\)/` expecting the bare `TODO+(E-15+) stub` form
   (probe: `matches spec: false`); after: `/…\/RT_E_VALIDATION · TODO\\\(E-15\\\) stub\/\)/`,
   byte-verified against the emitted row
   `await assert.rejects(route(ep.method, ep.path, {}), /RT_E_VALIDATION · TODO\(E-15\) stub/);`
   (byte dump used `<BS>` substitution; isolated probe: `NEW regex matches emitted spec: true`).
   Why: W16+W17 coded-refusal contract (`8e25180`, `EMITTED_REFUSAL_CODE = "RT_E_VALIDATION"`).
   Re-run: **37/37 pass** (was 1 fail).
   *N1/P3 suspects exonerated (T2): the P-wave/`60c92a2` scaffold diff was only a
   `deployNotes` alias.*

5. `src/lib/wild-step.test.ts:195` (sink-parity `normalize` @:172 test) — before: packet chain
   masked `compiled_at`/`project_id`; after: + `"input_hash"` mask. Why: same fixes/295 F2-03
   wall-clock fold (T2 probe: post-normalize diff = `$.packet` `input_hash` only). Re-run:
   **14/14 pass** (was 2 fails).

6. `src/lib/wild-step.test.ts:285` (W-01 seam `stripVolatiles`, test @:256) — same mask added
   to the second normalizer; same root cause. Same re-run: **14/14 pass**.

## Cross-checks after landing
- `src/lib/exec.test.ts` (T1's touched file): **19/19 pass** — stayed green.
- `src/lib/honesty-guards.test.ts` (the other `p6.seal.unmet` pin — collateral check on the
  engine fix): **13/13 pass**.
- Final consolidated re-run of all six files + `exec.test.ts` (foreground, against the
  then-current tree — sibling-lane activity had begun): identical greens —
  96 / 25 / 23 / 37 / 14 / 19, 0 fails.
- `npm run typecheck`: exit 0 (full). `npm run lint`: exit 0 (0 errors; 4 transient warnings
  in `src/lib/packet.ts` from a sibling lane's in-flight edit — not V1's files).
- Full `npm test` (canonical, both legs): **scripts 328/328 · src 2250 pass / 0 fail / 1 legit
  skip** on retry. First attempt's only red was the documented `exec.test.ts` scratch-dir
  timing flake under multi-lane machine load — standalone green ×3 (incl. immediately after),
  and the retry was 82s vs 143s, confirming load sensitivity, not a leak or a V1 delta.

## Probes / artifacts
- T2's five probes were preserved by the fixes/301 · X4 hygiene pass at
  `fixes/298_t2_probe_{parity,lesson,scaffold,scaffold2,scaffold3}.ts` (imports rebased to
  `../src/lib/…`; run from repo root).
- V1's throwaway byte-dump probe (`probe-v1-bytes.ts`) was removed after its evidence landed
  here; all proof bytes are captured in this log and in the T2 summary.

## Files touched
- `src/lib/headless.test.ts`, `src/lib/lesson-writers.test.ts` (re-run only — red was the
  engine bug), `src/lib/report-intake.test.ts`, `src/lib/report-intake.ts` (stale comment),
  `src/lib/scaffold.test.ts`, `src/lib/wild-step.test.ts`, `src/lib/engine.ts`.
