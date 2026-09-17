# 213 — Grok 3-pack intake (210/211/212) + parent doctor wire + 209 close

## Pack

`deleg_f89b10d1` — 3× grok-4.6 / xai-oauth

| Lane | Fix log | Targeted |
|---|---|---|
| G1 | `fixes/210_g1_factory_honest_doctor.md` | 168/168 |
| G2 | `fixes/211_g2_treerun_runner_honesty.md` | 35/35 |
| G3 | `fixes/212_g3_harvest_knowledge_residual.md` | 175/175 |

## Parent

1. **209** — human `lesson --accept` actually appends (was silent eval-gate refuse);
   CLI promoted count honesty; lint/DRY; store dual-channel types.
2. **210 wire** — `headless.doctorStatus` now uses `doctorFactory()` field-truth latch
   (`gaps[]`, never hardcode true). Factory remains **false**.
3. **isolated:false default (213)** — `emptyProject` / hydrate default
   `sandbox.isolated` is **false** (node-runner is not Docker/bwrap). Explicit
   `isolated: true` remains legal for worker-path fixtures that opt in.
4. Four-gate after this log.

## Still false / not done

- Not an autonomous software factory; not competitor-beating.
- Real flip/record/show/publish need keyed P6 — no invented bodies.
- keyed `--all` user-gated only.
- packet/engine may still advertise `isolated: true` (residual).
