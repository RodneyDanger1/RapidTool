# 244 · LANE 4 (W16) — OV-18 + OV-14: pin the unpinned honesty windows

**Lane:** W16 LANE 4. **Box:** `src/lib/honesty-guards.test.ts`, `src/lib/gates.test.ts`, `src/lib/packet.test.ts` ONLY.
No silent semantics changes; any needed src change ⇒ exact patch proposal in this log.
**Status:** SKELETON — work in progress (`node --experimental-strip-types --test`, FOREGROUND only).

## BOTTOM LINE (to fill)

- OV-18: (pending) — what is pinned, what remains unpinned, why.
- OV-14: (pending) — surface proven, or exact patch proposal if the only correct fix is out-of-box.
- Suites: (pending) targeted foreground runs.

---

## OV-18 — clamp marker window (caps ≈64–118)

Read so far: `node-runner.server.ts` `RUNNER_OUTPUT_MAX_CHARS = 48_000` (:74); `clampRunnerOutput` (:91–128):
cap < 64 ⇒ plain head-cut slice(0, cap) with honest count; cap ≥ 64 ⇒ two-pass marker layout; final
`out.length <= cap ? out : out.slice(0, cap)` (:123) — suspected source of the ≈64–118 degradation
(marker partially cut, tail = 0). Evidence commands + pins: (pending).

## OV-14 — `archProductComplete` (skip≠complete invisible outside tests)

(pending — locate definition + existing consumers, then prove observability.)

## Evidence ledger

(every claim = the command that produced it; appended as filled)
