# fixes/308_map5_parent.md — THE PARENT'S PIPELINE ANALYSIS (industry-standard lens)

**Date:** 2026-09-29 · **HEAD:** 800a40d · **Author:** the parent (commander lane), during the 4-mapper hunt
**Purpose:** the pipeline-spine analysis asked for by the owner — major-problem findings, each with the
thought process of whether it IS a problem; verified-clean items recorded so no mapper re-hunts them.

---

## §1 — VERIFIED CLEAN (do not re-hunt; evidence today)

| # | Candidate problem | Verdict | Evidence |
|---|---|---|---|
| V-1 | **The C-1 chain: `treeRunOk:false` → mint silently skipped** | **DEAD SCHEME — verified superseded.** | `grep -n "treeRunOk" src/lib/*.ts` → 3 hits, ALL historical: `codegen.server.test.ts:1155` (a comment describing the old failure), `codegen.server.ts:2105` (the comment explaining the one-chunk fix), `scorecard.ts:159` (a notes field). No live consumer anywhere. The live chain is the one-chunk materialization + gate verdict + the seal gates at `engine.ts:1474` (GREEN-SEAL: "a RED seal never mints a lesson row") and `:557` (the engine-minted lesson). |
| V-2 | **The phase-state machine's legality** | Structurally sound at the read points. | `engine.ts:3488` ("the same tested-mint seam run/gate/wild use; Phase 6 + keyed ⇒ route"), `:3591` (the reject→`RT_E_GATE_PENDING` · locked/rejected/missing-record/illegal matrix), `:1474-1507` (green-seal + no-re-mint). |
| V-3 | **Determinism of the pipeline's evidence bytes** | By design: volatiles excluded. | `packetInputHash` folds createdAt/logs[].ts/decisions/notes/artifacts/memory — **no wall-clock**; the `compiled_at` embed + `startedAt/completedAt` are the masked volatile class (stripVolatiles). |

## §2 — MAJOR-PROBLEM LEADS (hand to the FIXER wave — each is a real row, boxed)

| # | Finding | Why it IS a problem (the careful think) | Box |
|---|---|---|---|
| P-1 | **`wildRun.park` persists `null` on every non-blocked pause** (B1's probe: classifier/locked/rejected/DoD/guard pauses advertise `WildParkInfo` in `types.ts` but the W43 shim injects no park record; only `status==="blocked"` (:4211) passes `{code,unlock}`). | The pipeline's pause UX + the new rail's park display + any agent reading the run state sees `pause:true, park:null` — **structurally present, functionally empty** = the exact class the owner ordered hunted. A paused run that can't say WHY is a broken state machine contract. | A (engine/store) | **✅ FIXED + PROVEN (parent, 10:32)** — `finishStep` now stamps `parkIfNull(result)` before `summarized` (the ONE seam every pause producer funnels through: the 4 emitPaused sites AND wildApproveGate/wildLeavePhase — the probe proved the gate arm bypassed the shim). Evidence: fresh scratch `wild --start` → `park` = `{code:RT_E_GATE_PENDING, reason:"P0 is a human-only gate.", unlock:"human-gate", unlockText:…, resumePhase:0, resumeAction:"gate", at:…}` + `lastStep.park` populated; typecheck 0; wild-step 14/14; store 77/77. |
| P-2 | **The `finishStep` shim is a compatibility delegate, not a park-recorder** (engine.ts:~4150, my W43 repair). | Related to P-1: the shim preserved pause semantics byte-identically BUT inherited the no-park-record hole. The correct fix = inject the wildPause-style park at the shim (one site fixes all four legacy callers) OR at finishStep's pause path. | A (engine) | **✅ FIXED + PROVEN (parent, 10:32)** — done at `finishStep`'s path (BETTER than the shim: covers the gate/leave arms too — the probe caught the gate arm bypassing the shim). `parkIfNull` uses the canonical `wildParkInfo` builder (no guessed fields; unlock class from the code). Same evidence as P-1. |
| P-3 | **`wild.auto` emitted by `pipeline-rail.tsx:145` is NOT in `RT_EVENT_NAMES`** (B3's reverse-audit flag). | An emit to an unregistered event name = the telemetry silently drops or the registry pin fails later; the rail's own provenance line can't be traced. Register it (additive). | D (UI/rail) or C (rt-events) |
| P-4 | **`pipeline-rail.tsx` is built but not imported** (U2's note: console.tsx needs the 3-line import; U1 owns console). | A delivered component not mounted = the "not wired" class — the owner's exact complaint. | D (UI) |
| P-5 | **The P6 keyed mint route** (`engine.ts:3488`: "Phase 6 + keyed ⇒ route") | **NOT A BUG — owner-gated by design.** The route is structurally present and honest; only the funded keyed run exercises it. Flagged so no mapper mislabels it a defect. | OWNER |

## §3 — The industry-standard lens applied (what was checked, beyond the rows)

1. **Fail-safe audit**: every pause path carries a code (B1's probes: `RT_E_GATE_PENDING`, coded refusals at all sites) — the ONE hole is the park record (P-1/P-2).
2. **State-machine audit**: phase legality enforced at the read points (V-2); the sealed-priors guard is real (`priorsSealed`); no illegal transitions found.
3. **Determinism audit**: volatile bytes consistently masked; identity hashes exclude them by design (V-3).
4. **Data-flow audit**: the spine's new fields walked (consumer-check walk is the tracer's job — this file records only the mint/spine findings above).

**END OF PARENT ANALYSIS — appended above nothing; mappers own their own files (308_map2/3/4, 308_bugmap).**
