# fixes/314_f2_selfimprove.md — F2 · THE SELF-IMPROVEMENT SCAFFOLD (guardrails-first)

**Lane:** F2 (314 wave, deleg_0c2424e6 task-1). **HEAD at start:** 54c6649. **Mode:** keyless only. **NO keyed calls.** **Guardrails as REAL code first; never a stub that pretends.**
**Source design:** `fixes/311_se2_surfaces.md` §4b ("DESIGN — self-modification (honest minimum)") + F3's `wave_plans/W43/COMPLETION-TASKS.md` F3 ("the honest minimum = the pipeline as a bounded delegate + guard rails; scope TBD from SE2 #4b").
**File ownership this lane (STRICT — every touched file is NEW; live legs own the CLI/errors/engine):** `src/lib/selfmod.ts` · `src/lib/selfmod.test.ts` · `src/lib/selfmod.server.ts` · `src/lib/selfmod.server.test.ts` · THIS log. Zero edits to existing files.

## Status board
- [ ] G0 — design re-read + guardrail inventory locked (below)
- [ ] G1 — `src/lib/selfmod.ts`: protected-path manifest (consent/seal/ledger/pins/pipeline classes), caps (files/lines/token), preflight evaluator, diff-cap check, landing decision (failed verify ⇒ no commit), honest-limits statement — pure, dependency-light, zero side effects
- [ ] G2 — `src/lib/selfmod.server.ts`: the bounded executor — worktree validation (same-repo / non-main branch / clean start), `git diff --numstat` collection (incl. untracked), `scripts/gate.sh` before/after runner, land-only-on-green commit, rollback (discard changes)
- [ ] G3 — pins: protected-path write refused coded · over-cap diff refused · failed verify = no commit (+ every other guardrail) — REAL temp-repo integration, not mock theater
- [ ] G4 — the first allowed component: verdict (wire-or-blocker) recorded below with the design's reasoning
- [ ] Close-out — evidence (typecheck/lint/gap-lint/new suites), mount spec, blockers, gates touched

## The guardrails (design §4b → real code → pin) — locked before implementation
| # | Design guard | Real code home (this lane) | Pin |
|---|---|---|---|
| ① | Path allow-list (`physicalInside`) + protected manifest | `SELFMOD_PROTECTED_PATHS` (6 classes) + `evaluateSelfmodPreflight` (allow-list coverage check) + runner physical check | `selfmod.test.ts` §manifest/§preflight · `selfmod.server.test.ts` §physical |
| ② | git worktree + branch, never main | `validateSelfmodWorktree` (same-repo via `--git-common-dir`, branch ≠ main/master, clean start) | `selfmod.server.test.ts` §worktree |
| ③ | self-DoD = `scripts/gate.sh` before AND after; red ⇒ no commit | `runSelfmodVerifyGate` (runs `<worktree>/scripts/gate.sh`, bounded) + `landSelfmodWorktree` (re-consults the decision; no verify verdict → refuse) + `selfmodLandingDecision` (pure) | `selfmod.server.test.ts` §verify-red (real git log count unchanged) + §land-green |
| ④ | stock gates stay human — never forge the seat | `humanSeat` must be `false` in preflight (request field + coded refusal) | `selfmod.test.ts` §human-seat |
| ⑤ | mandatory `RAPIDTOOL_TOKEN_CAP` + enforceDoD on | preflight: `tokenCapFromEnv` (strict, reused) required; `--cap` ≤ env cap; `enforceDod === true` required | `selfmod.test.ts` §caps |
| ⑥ | forbidden-path manifest (run must not edit its own pipeline) | the 6-class manifest incl. design's `engine.ts`/`codegen.server.ts`/`rapidtool-cli.mjs`/`gate.sh`/`dod.ts` + consent docs + seal + ledger + pins + self-protection | `selfmod.test.ts` §manifest + §landing-diff protected refusal |
| ⑦ | honest limit: bounded local runner, NOT an OS sandbox (R13-f04/CF-4) | `SELFMOD_HONEST_LIMITS` — surfaced on every preflight verdict + landing/rollback envelopes | `selfmod.test.ts` §honest-limits |
| + | diff-size/scope caps | `SELFMOD_LIMITS` (defaults + hard ceilings), `diffWithinCaps` | `selfmod.test.ts` §caps · `selfmod.server.test.ts` §over-cap (real diff) |
| + | rollback path | `discardSelfmodWorktreeChanges` (+ never-committed-on-red semantics) | `selfmod.server.test.ts` §rollback |

## RT_E codes reserved by this lane (additive; registered into `src/lib/errors.ts` at mount — see Mount spec)
| Code | Meaning (one line) |
|---|---|
| `RT_E_SELFMOD_PROTECTED` | the request touches a protected path (allow-list covers it, or the staged diff does) |
| `RT_E_SELFMOD_CAP_EXCEEDED` | declared caps exceed the hard ceilings, or the staged diff exceeds the declared caps |
| `RT_E_SELFMOD_UNGOVERNED` | a mandatory governance precondition is missing (token cap, enforceDoD, human-seat forgery, unsafe worktree) |
| `RT_E_SELFMOD_VERIFY_FAILED` | the self-DoD gate was red/unrunnable (or absent) — never a commit/land |

## Mount spec (blocked: `scripts/rapidtool-cli.mjs` owned by live lane E1 this wave; `src/lib/errors.ts` live with 312_c6)
*(to fill)*

## G4 — the first allowed component (verdict)
*(to fill — wire-or-blocker with the design's reasoning)*

## Evidence log (filled as it lands)
*(to fill)*

## Close-out
*(to fill)*
