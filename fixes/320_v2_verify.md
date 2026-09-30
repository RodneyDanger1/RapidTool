# 320 · V2 · INDEPENDENT VERIFIER — W44 wave-2.5 (review-park mint)

**Status: COMPLETE — parent-completed.** V2 (lane task-1 of `deleg_13cfe614`) capped at its iteration limit exactly when verification began; its required deliverable was OWED. The parent executed V2's OWN validated tooling (built and pre-validated by V2 against the pre-fix tree) and this file records the results. Clearly split below: V2's recon vs parent execution.

Repo: `C:\Users\mnril\Desktop\RapidTool Main` · base `c1049ba` + wave-2/2.5 edits. No code edits by V2 or the parent in this verification.

## V2's recon (from its summary; artifacts under `C:/Users/mnril/v2_scratch/`)

- `v2_adv_repro.mjs` — adversarial repro, **validated against the PRE-fix engine**: baseline (`v2_adv_prestate.out`) showed exactly **11 mint-dependent checks FAIL** (A2–A10, C2) while the DoD-floor no-mint cases passed (`hitl=null`). Post-fix it must flip all 11 → PASS.
- `v2_legs.sh` — scoped-leg runner (seal/step/mode + `node --check` + eslint).
- `v2_postsnap.sh`/`.txt` — stray-edit map + numstat vs `c1049ba`; `v2_presnap.txt` — pre-state sha1s.
- Pre-existing invariants it read-verified before capping: `approveHitl` forceHuman+autopilot throw (`engine.ts:1690`); pins `store.test.ts:310`, `headless.test.ts:374`, `wild-seal §S2 (:151-171, decisions.length===0)`; `honesty-guards.test.ts` (approveHitl controls); `wildParkInfo.reason.slice(0,200)` / `lastAutoLog.slice(0,300)`.

## Parent execution (fresh, 2026-09-30, post-fix bytes)

| Check (V2's tooling) | Result | Verdict |
|---|---|---|
| `bash v2_legs.sh` | seal **13/13** · step **34/34** · mode **12/12** · check 0 · eslint 0 | **VERIFIED** |
| `node ... v2_adv_repro.mjs` (after one harness correction, below) | **ALL PASS — 20/20** (baseline was 11 FAIL) | **VERIFIED** |
| `bash v2_postsnap.sh` | 12 modified files, all inside G2/G3/G1bis boxes; only expected untracked logs; no strays | **VERIFIED** |
| Deletion-line audit (all files, wave-2+2.5) | Only designed replacements (old inline diagnose block, slice sites, import lines); no pin data deleted | **VERIFIED** |

### Adversarial coverage (20 checks, all pass)
A1/A1b advance-reject parks + reviewer asked once · A2/A3/A3b mint present, `forceHuman:true`, targets current edge · A4/A5 phase+project `awaiting_hitl` · A6 autopilot approve throws (R3/B-03) · **A7 seal refuses minted gate, 0 reviewer calls** · A8 human approve completes (cur→1, next ready) · A9 note-reject → history + blocked · **A10 unlockRetry → re-run → advanced (cur=1)** · A11 <12-char note refused · B-sealed/B-unsealed (×3 each): DoD-floor reject parks, **hitl=null** (no mint — scoping) · C1/C2 gate-arm reject → mint forces human seat.

### [PARENT CORRECTION] Harness flow fix (recorded honestly)
Run #1: **2 FAILED — A7, A10** (`outcome=noop code=undefined calls=0`). Cause: the harness stepped a **PAUSED** run directly; the engine's by-design guard returns the silent noop **"Wild run is paused."** (`engine.ts:4838`). The product flow (and the CLI) performs **`wild --resume`** first (`headless.wildResumeRun`, `:4557`). Parent corrected the harness by 3 anchored edits (import headless; resume before the A7 step; resume before the A10 step) with `[PARENT CORRECTION]` comments — then **all 20 checks PASS**. The correction is a harness-flow fix, not a product change; the pre-fix baseline (11 FAIL) remains valid because those checks were mint-dependent, not flow-dependent.

## Boundary (this tree, quiet, alone)

- `npm run typecheck` → exit 0 (0 errors) · `npm run lint` → exit 0 (`problems:null`).
- `npm test` → scripts **359/359** · lib **2482 pass · 1 skip · 0 fail** (2842 tests total; +9 pins vs wave-1).
- `bash scripts/gate.sh` → **`ok:true`** (wallMs 253226): all six gates exit 0 — full JSON in `C:/Users/mnril/w44_gate3.log`.

## Zero-loss sweep

- G1bis's log: proofs block + trailer completed by parent (all content byte-accurate; see `320_g1b_review_park.md` END).
- V2's deliverable: this file (parent-completed; V2's recon preserved above).
- Nothing found-but-unwritten remains; nothing fabricated anywhere in this file.

=== END 320_v2_verify — COMPLETE (V2 recon + parent execution of V2's validated tooling; harness flow correction recorded) ===
