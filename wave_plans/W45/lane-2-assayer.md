# W45 / 331-2 — "Assayer" — verification core & lesson identity

Read `wave_plans/W45/README.md` first. Your log: `fixes/331_2_assayer.md`.

## Owned files (STRICT)

`src/lib/verify.server.ts` · `src/lib/knowledge.ts` · `src/lib/harvest.ts` · `src/lib/engine.ts`
+ their colocated `*.test.ts`.

## Mission

Close the two cross-file wires the 330 wave identified but could not land in-lane, and harden the
verification core. Your evidence base is `fixes/330_3_assayer.md`, `fixes/330_4_cartographer.md`,
`fixes/330_2_composer.md` — read them; the findings below are their extracts.

**V1 — L4 `verifiedProcedureLesson` id forks on process noise (330_4 §3.1 + §3.3).**
Probe from the 330 log: the same verified procedure produced
`lesson-verified-procedure-6720963c`, then `…a8a6d5e1`, then `…d595c979` across three iterations —
`SAME? false`. Cause: `verify.server.ts:1131` passes
`evidence = "N/N machine-run cases passed on iteration I[; lint …]"` and the L4 row id hashes that
whole string, so the **iteration count forks the row**. The adjacent comment claims a "stable
evidence-derived id" — the bytes do not support it (declare-or-strike applies).

The 330 lane proved the naive fix is wrong (normalizing the evidence tail over-collapses `3/3` and
`5/5` into one row). **The correct identity is the machine-case ids.** Owed change, two parts:
1. `knowledge.ts`: `verifiedProcedureLesson(project, phase, evidence, proof?: { anchors?: readonly
   string[] } | null)` — when `proof.anchors` is non-empty, hash a **stable signature over
   `(phase, sorted case ids)`** instead of the evidence text (add a dedicated signature kind rather
   than overloading an unrelated `FailureKind`).
2. `verify.server.ts:1131`: pass the anchors —
   `verifyOutcomeLesson("passed", 6, evidence, i + 1, cases.map((c) => c.id))` — and widen
   `verifyOutcomeLesson` (`:1986`) to forward them.

Done-when: a probe shows the **same** id across ≥3 recurrences of the same case set with different
iteration counts, and **different** ids for different case sets (`3/3` vs `5/5`). Teeth: with the
builder reverted, the new test goes RED.

**V2 — `driftLesson` has no production caller (330_4 §3.3).** `knowledge.ts:1353`, called only by
its own test; E-19 drift detection mints nothing. Wire it to a real seam in `engine.ts` (or
`verify.server.ts`) where drift is actually detected — or, if the honest answer is that no
detection exists yet, **strike the claim** and register it. Do not invent a caller that does not
observe a real drift signal.

**V3 — sweep your four files** for the classes the 330 wave found: telemetry throwing into the code
it observes, declare-or-strike violations (comments/docblocks claiming callers or behavior the bytes
do not support), slices taken before a signature, ids that ignore their anchor. Fix what is real;
strike what is not.

## Rules

Node 22 pinned at `%LOCALAPPDATA%\hermes\node\node.exe`; also record host Node 24. Targeted suites
only — no full gate:
`node --experimental-strip-types --test --test-reporter=tap src/lib/verify.server.test.ts`
(and `knowledge.test.ts`, `harvest.test.ts`, `engine.test.ts`). Patch-only, explicit `.ts`
extensions, append-only log, no fabrication, no secrets.

## Report back

Verdict per finding (fixed / struck / blocked-with-reason) · the id-stability probe output before and
after · tests added + real results · the exact `verifyOutcomeLesson` signature contract (331-3/331-4
may consume it) · anything you stopped on.
