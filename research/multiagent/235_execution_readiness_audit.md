# 235 · ENGINEERING WATCHDOG 2 — execution-readiness audit: can this plan actually be run as waves, by flash subagents, on this 8 GB host, without collisions, with verification that proves each row?

**Written:** 2026-09-24 by ENG-WD2 (W13). **Read-only** on `src/`, `scripts/`, `fixes/`, all plan files; no git mutations.
**Plan followed:** `wave_plans/W13/eng-wd2.md` (read first, in full). **Only write:** this file. Scratch `C:/Users/mnril/w13p_scratch/` was created and not needed.
**Inputs read today:** `220_tasklist_canonical.md` (42 rows + AUD-2 markers) · `220_overhaul_plan.md` §4.2/§4.6/§4.8 · `222_codebase_integration_map.md` §2/§4 (seam table, HOT map) · `230_task_execution_playbook.md` (existed at write time — cross-checked, not waited for) · `227_plan_gaps_adversarial.md` (4 unrowed record-steps; Step-0 triage; kill-safety) · `223_critical_path_premortem.md` (WB-1/WB-2/WB-6; C-1/C-2/C-3) · plus the live W13 delegation transcripts under `%LOCALAPPDATA%\hermes\cache\delegation\` (the budget-failure data in §3; commands listed in §6).

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2; git-bash /c/Users/mnril/Desktop/RapidTool Main).
SPACE in path → search_files/ripgrep FAIL; every command below was run via `cd "/c/Users/mnril/Desktop/RapidTool Main" && …`.
```

## BOTTOM LINE

`waves designed: 6 (+ Step 0 and keyed run #2 as owner windows) · lanes placed: 14 · rows placed: 17 · UNPLACEABLE: 0 · verify PROVES/WEAK/MISSING: 4/13/0 · execution risks: 3 (contested-file collision · claim-complete-with-a-hollow-file · late red boundary gate)`

> **The single change that most increases the fraction of lanes that finish their own writes — from W13's own ledger, not theory:** *make the deliverable write position independent of the investigation: skeleton (full headings + bottom-line shape) written inside the first ~8 tool calls, then sections patched in as they complete — never a "write pass" after the research "finishes".* In W13, **every one of the 5 lanes that reached its write produced a complete file on disk (lanes 1, 2, 5, 6, X-3 — 148–586 lines); all 4 lanes that deferred the write until after recon died with no file at all (lanes 3, 4, X-1, X-2 — all four parent-recovered from summaries).** Lane 1 is the proof it is the *write position*, not the budget: it hit the *same* `max_iterations` ax as the four dead lanes **after** its skeleton write at call 4 — and its 438-line dossier survives anyway. Concretely: skeleton at call ≤8; patch sections as they finish (lane 2: 18 incremental writes; lane 5 needed only 4 calls after its write); a lane whose budget dies with a skeleton on disk hands the parent a fillable outline instead of a summary transcript.

*(Read order: §1 wave plan → §2 per-row verification grades → §3 the lane-sizing rules the four failures justify → §4 risks → §5 critical path → §6 provenance, corrections for the parent, honest limits.)*

---

## §1 · THE WAVE DECOMPOSITION

**Scope placed:** the 17 rows that matter before/around Step 0 = `220` §5's first-48-hours rows (TASK-01 · T5.3 · OV-2 · TA-3 · OV-17 · DF-18 · DF-26 · T5.2 half A · OV-13 · OV-12 · OV-15) + the three `BLOCKED-KEY` rows (OV-3, OV-4, OV-5) + 223's **C-1/C-2** (which must precede Step 0 — `220` §4.6) + 227's **OV-35** (kill-safety/run-marker + preflight/triage — the "triage row" of the critical path). `T0.10` (Step 0) and `OV-8` (run #2) are owner windows, not lanes. Everything else (W16 rows, Phase-5 program, owner decisions, the three `UNVERIFIABLE-NOW` rows) is deliberately not placed — see "Not placed" below.

**Boundary gate for every wave:** lanes stop → one parent-only `bash scripts/gate.sh` (≈160 s per the wave brief; it runs 5 gates in order — typecheck, lint, assertion-gaps, tests (scripts leg then src/lib), build — `scripts/gate.sh` header, read today) → next wave. The gate does **not** inspect `research/**` deliverables (risk #2 in §4).

### W0 — "break the deadlock" (4 lanes)

| lane | row(s) | owned files | why disjoint | what it unblocks |
|---|---|---|---|---|
| **P1** | **C-1** gate-before-mint deadlock | `src/lib/headless.ts`, `src/lib/codegen.server.ts`, `src/lib/headless.test.ts` | sole writer of both source files in W0; `codegen.server.ts` is HOT → one lane (`222` §4) | M3/M4 reachability; frees `headless.ts` for W1 K3; starts the codegen chain (Z1/Z3, W5/W6) |
| **P2** | **C-2** hard-DoD → coded terminal stop | `scripts/run-eval.mjs`, `scripts/run-eval.test.mjs` | sole `run-eval.mjs` writer in W0 | M9 reachability; frees `run-eval.mjs` for OV-35 (W1) |
| **K1** | **DF-18 + DF-26** (S+S, same file — `220` §5 item 5) | `src/components/console.tsx` (reads the caveat string `packet.ts:498` and `TRUNC_MARKER` `packet.ts:17` — `packet.ts` itself is not edited) | only `console.tsx` writer in W0 (HOT) | frees `console.tsx` for T5.2-A (W1) and OV-2 findings (W2) |
| **K2** | **OV-12** register truth fix | `fixes/217c_phase5_spec_and_decision_register.md` | doc-only; shares no code file | nothing downstream — the cheapest dispatchable row (230's on-ramp #1) |

*Split option:* W0a {P1, P2} → gate → W0b {K1, K2} if the parent wants the Step-0 prerequisites gated with zero co-riders (~+1 gate). **Boundary:** `gate.sh`.

### W1 — "kill-safety + first contract lanes" (3 lanes)

| lane | row(s) | owned files | why disjoint | what it unblocks |
|---|---|---|---|---|
| **S1** | **OV-35** — internal order: (a) run-start marker/kill-safety → (b) preflight + failure-class triage | `scripts/run-eval.mjs`, `scripts/run-eval.test.mjs`, `src/lib/doctor.ts`, `src/lib/doctor.test.ts` | `run-eval.mjs` free after P2; `doctor.ts` touched by no other lane | Step 0 safety (WB-6) + triage; frees `run-eval.mjs` for T5.3 |
| **K3** | **TASK-01** nextAction wire contract | `src/lib/headless.ts`, `src/lib/headless.test.ts`, `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md` | `headless.ts` free after P1; CLI + README-cli have no other W1 writer | frees CLI for T5.3 (W2) |
| **K4** | **T5.2 half A** fixtures review UI + store actions | `src/components/console.tsx`, `src/lib/store.ts`, `src/lib/brief-fixtures.ts` (only if a helper is needed), `src/lib/brief-fixtures.test.ts` + new store tests | `console.tsx` free after K1; `store.ts` only writer this wave | frees `store.ts` for OV-13 (W2); feeds the M-B latch input |

*Contract:* S1 keeps **off** `README-cli.md` this wave (K3 owns it); the preflight's doc line lands in W3's doc lane or in S1 if the file is free at dispatch — never two writers. **Boundary:** `gate.sh`.

### W2 — "contract + pixels + silent degrades" (3 lanes)

| lane | row(s) | owned files | why disjoint | what it unblocks |
|---|---|---|---|---|
| **K5** | **T5.3** `eval` verb | `scripts/rapidtool-cli.mjs`, `scripts/run-eval.mjs`, `scripts/README-cli.md`, `scripts/*.test.mjs` | CLI free after K3; `run-eval.mjs` free after S1 | TA-3's eval-verb doc-contract extension (W3); puts M1–M9 in a driving agent's hands |
| **K6** | **OV-2** guard fix → smoke → findings (console/styles edits only if findings demand) | `scripts/browser-guard.mjs`, `scripts/browser-smoke.mjs`, `scripts/browser-smoke-verdict.mjs`, `src/components/console.tsx` + `src/styles.css` (findings only) | `console.tsx` free after K4; browser scripts owned by nobody else | retires "nobody has looked at these pixels"; becomes the browser acceptance for DF-18/DF-26/T5.2-A |
| **K7** | **OV-13** silent degrades → visible rows | `src/lib/engine.ts` (HOT — single writer), `src/lib/store.ts`, `src/lib/verify.server.ts` + their two suites | `engine.ts` one lane; `store.ts` free after K4; `verify.server.ts` free until Z3/W6 | distinguishability of a degraded keyed pass from a keyless one |

*Host note:* K6 is the heaviest lane of the plan (`npm run dev` + Chromium on the 8 GB box). Run it in a light wave or parent-serialize the smoke; 230's fallback stands — guard fix + unit checks alone, with "the pixel pass did not run" registered. **Boundary:** `gate.sh`.

### W3 — "truth sweep" (1 lane — the plan's largest merge, flagged)

| lane | row(s) | owned files | why disjoint | what it unblocks |
|---|---|---|---|---|
| **K8** | **TA-3 + OV-17 + OV-15** | `README.md`, `AGENTS.md`, `scripts/README-cli.md`, `scripts/rapidtool-cli.mjs`, `src/lib/headless.ts` (OV-15's refusal text :1405 / option :1366–1373), `taskuniverselog.md`, `remainingwaves.md`, `scripts/README-cli.test.mjs` | one writer on CLI + `headless.ts`; every other file doc-only | final pre-Step-0 truth pass; count re-derived at 36 after T5.3 |

*Why merged:* all three rows touch the same `rapidtool-cli.mjs` file (W3 is the only free slot in the CLI chain K3→K5→K8) and are all S-sized; the same-file-S-rows merge rule of §3 covers it. **Split option (safer):** K8a {TA-3+OV-17} → gate → K8b {OV-15} (+1 wave). **Boundary:** `gate.sh`.

### W4 — Step 0 (owner window — no lanes, quiet host)

`npm run eval -- --keyed`, exactly as recorded at `research/eval-out/_keyed-run.log:2` (`220` T0.10). Requires W0+W1 landed and `gate.sh` green; "do not run it while five agents share the host" (230 T0.10); WB-7 wall-clock: the failed 09-10 keyed run was 756 s and failed early — worst case hours. Paste the score into `taskuniverselog.md` §5 as the new T0.10 evidence.

### W5 — "the zeros I" (2 lanes, post-Step-0 — each reads T0.10's log first)

| lane | row(s) | owned files | why disjoint | what it unblocks |
|---|---|---|---|---|
| **Z1** | **OV-3** (M2 leg) | `src/lib/compile-check.server.ts`, `src/lib/scaffold.ts`, `src/lib/codegen.server.ts` + suites | codegen free after P1 | M2; the emitted-tree diagnosis |
| **Z2** | **OV-5** (M9/M7 leg) | `scripts/run-eval.mjs`, `src/lib/maker-score.ts`, `src/lib/headless.ts` (stop paths only) | `headless.ts` free after K8; `run-eval.mjs` free after K5 | M7/M9 score legs |

### W6 — "the zeros II" (1 lane, post-Step-0)

| lane | row(s) | owned files | why disjoint | what it unblocks |
|---|---|---|---|---|
| **Z3** | **OV-4** (M3/M4 leg) | `src/lib/headless.ts`, `src/lib/codegen.server.ts`, `src/lib/dod.ts`, `src/lib/headless.test.ts` | codegen free after Z1; `headless.ts` free after Z2 | M3/M4 score legs; then OV-8 (owner run #2) |

### The one-lane-per-HOT-file rule — shown enforced

HOT = touched in W10–W12 (`222` §4). Every HOT file this scope touches has exactly one writer per wave, and contested files are serialized across waves:

| HOT (or contested) file | writers by wave | serialization chain |
|---|---|---|
| `codegen.server.ts` (HOT) | W0 P1 · W5 Z1 · W6 Z3 | C-1 → OV-3 → OV-4 |
| `console.tsx` (HOT) | W0 K1 · W1 K4 · W2 K6 | DF-18/26 → T5.2-A → OV-2 findings |
| `rapidtool-cli.mjs` (HOT) | W1 K3 · W2 K5 · W3 K8 | TASK-01 → T5.3 → TA-3/OV-15 |
| `engine.ts` (HOT) | W2 K7 only | OV-13 (the only in-scope engine row) |
| `headless.ts` (cold but the hottest magnet) | W0 P1 · W1 K3 · W3 K8 · W5 Z2 · W6 Z3 | C-1 → TASK-01 → OV-15 → OV-5 → OV-4 |
| `run-eval.mjs` | W0 P2 · W1 S1 · W2 K5 · W5 Z2 | C-2 → OV-35 → T5.3 → OV-5 |
| `store.ts` · `verify.server.ts` | W1 K4 → W2 K7 / W2 K7 → W6 Z3 | T5.2-A → OV-13 / OV-13 → OV-4 |
| `compile-check.server.ts`, `scaffold.ts` (HOT) | W5 Z1 only | — |
| remaining HOT files (`algorithms.ts`, `errors.ts`, `honesty-guards.test.ts`, `knowledge.ts`, `lesson-writers.test.ts`, `node-runner.server.ts`, `token-ledger.ts`, `cmd-palette.tsx`, `__root.tsx`, `styles.css`, `auth/popup.server.ts`) | not touched by this scope (styles.css only as an OV-2 findings target — K6 alone) | — |

**Cross-wave contracts (pre-specified, per the repo's wave discipline):** (1) each successive owner of `run-eval.mjs` leaves its own suite green and records the previous wave's semantics it must not break (marker fields from S1 survive K5's driver export; the `dod`-terminal set from P2 survives S1/K5/Z2); (2) the verb count moves 35→36 at K5, and K8 re-derives every count by command, never hardcodes (the doc-contract test computes `realCount` — `README-cli.test.mjs:74–90`, read today); (3) Z3 builds on P1's shared mint helper — never write a second mint (230 OV-4).

**UNPLACEABLE findings (in-scope): 0.** Two placement *conditions* instead: OV-2 is host-heavy (K6 note above); K8 is the largest bundle (split option above). **Not placed (out of scope, with reasons):** the W16/Phase-5 rows (`220` §1 C/D) and all 6 owner decisions — outside the 48 h/critical-path set by the plan's own design; and the three `UNVERIFIABLE-NOW` rows (**DF-09** — no check defined; **T4.3** — no preservation probe defined; **G4** — no scan defined) — pulling any of them into a wave would itself be an `UNPLACEABLE: <row> — its verification does not exist yet` finding; they belong in a definition pass first (230 Part 4 agrees).

---

## §2 · VERIFICATION ADEQUACY — every row in the waves

**Rubric (stated so it can be audited):** `PROVES` = the recorded command(s), run as written, fail when the row's done-when is unmet *durably* (a re-runnable in-repo check). `WEAK` = the command can be green while a plausible partial/broken implementation stands — the hidden failure is named. `MISSING` = no command at all. Grades use the union of the row's own verify cell and 230's named assertions (230 was on disk and cross-checked). **None of the commands below was executed by me** (read-only mandate; 0 of ≤3 test runs used — see §6); grades are read from the commands and the tests they name.

| # | row | wave | recorded verify (exact) | grade | what a green WEAK command could hide (the red row) | cheapest strengthening |
|---|---|---|---|---|---|---|
| 1 | **C-1** | W0 | new `src/lib/headless.test.ts` case, **default** `recordGate`, assert `converged` + `gate.passed` + `lastTest.label==="tested"` + hash; `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` | **WEAK** | The row's scope is **two** seams (journey `headless.ts:1916–1958` **and** the repair mirror `:2493–2515` — 223 WB-5). The named test exercises the journey only: a lane can leave `repairTreeDir.recordGreen` deadlocked and the suite stays green — `repair` on an already-green chunked dir still returns FAILED (WB-5: "no machine path out of the WB-1 state"). | A second case over the repair path (or route both seams through one helper *and* assert both call sites' behaviour); grep alone is not enough — the failure is behavioural. |
| 2 | **C-2** | W0 | predicate/terminal-set pin in `scripts/run-eval.test.mjs` (a case per `RunOutcome`) + scratch probe: exactly ONE drain round returns `dod` | **WEAK** | The predicate export is *optional* in the recorded fix shape: a lane can export + unit-test `isTerminalDrainOutcome` while `drainPipeline`'s real terminal set never calls it — suite green, drain still spins its 80-round guard, **M9 still 0**. The scratch probe is not durable, so the regression re-opens silently. | Make `drainPipeline` consume the predicate; commit the one-round drain assertion as a test (or an integration case on the drain's exit path), not a scratch probe. |
| 3 | **OV-35** | W1 | `node --experimental-strip-types --test --test-concurrency=2 scripts/run-eval.test.mjs`; keyless `npm run eval` byte-identical (diff pre/post) | **WEAK** | Three clauses unasserted: (a) **ordering** — a marker written *after* the first entry (or at the end) passes an existence check but re-opens WB-6 (killed run leaves the stale 2026-09-17 keyless `results.json` 6/9 readable as current); (b) **classes** — collapsing {401,402,400,not-configured} into one message passes "coded output" while the triage the row exists for is gone; (c) byte-identity is a manual diff a busy lane skips — and a keyless path that touches the marker is exactly what it must catch. | Commit three assertions: marker written before entry 1 (read order), one distinct code per class (stubbed 401/402/400), a suite case pinning no new fields on the keyless path. |
| 4 | **TASK-01** | W1 | `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts`; `grep -c nextAction src/lib/headless.ts` > 0 (+ CLI probe) | **WEAK** | (a) The grep passes on a **comment**; (b) 230's requirement "pin each of the seven arms as its own case" — if not followed, arms collapsing (`fix-gate`→`retry`, `done`≡`unknown`) pass a one-arm test while breaking the 111 wire contract (`taskuniverselog:533-539`); (c) the done-when's "two computations independent" is unasserted — 230's own trap: a lane refactoring `uiNextAction` to consume the wire field leaves the suite green and changes UI behaviour invisibly. | Per-arm cases + empty-phases case (230's list); add a diff-scope check that `console.tsx` is untouched in the handoff. |
| 5 | **T5.3** | W2 | `node --experimental-strip-types scripts/rapidtool-cli.mjs eval --limit=1`; `node --test scripts/README-cli.test.mjs` | **WEAK** | The probe proves "one JSON object + exit 0"; it does not witness the payload (the nine M-criteria present, `schema_version`/`cmd`/`exit_code`), the corpus-missing coded refusal, or stdout purity on other paths — a thin stub-shaped verb passes. Note the AUD-2 correction: only the `--limit=` equals form parses (`run-eval.mjs:85–86`); a space-form regression is silently ignored. | A committed scripts-leg test asserting the criterion keys + the refusal code; one run against an empty corpus. |
| 6 | **OV-2** | W2 | `node scripts/browser-smoke.mjs http://localhost:8080/ C:/workspace/screenshots/w13-l4.png` with `npm run dev` up → `{ok:true}` + PNG written | **WEAK** | (a) Guard fixed only at the exercised call path — four call sites hardcode `["/workspace"]` (`browser-smoke.mjs:30/:32/:33/:41`) and the smoke only walks some; (b) a blank/erroring page renders fine and writes a PNG — `ok:true` with a white screenshot is a pass that inspected nothing (230: "no findings + no evidence of a rendered page is not a pass"); (c) the findings register can list nothing while pixels are broken. | Extend `browser-smoke-verdict.test.mjs` with a case per call-site shape; cite PNG + verdict JSON in the wave log; require the rendered-page evidence. |
| 7 | **TA-3** | W3 | `grep -c 'case "' scripts/rapidtool-cli.mjs` vs every doc claim; `node --test scripts/README-cli.test.mjs`; `grep -c 'diagnose:'` > 0 (230) | **PROVES** | — (the doc-contract test computes `realCount` from disk and rejects stale numbers — `README-cli.test.mjs:74–90/:125–141`, read today). Residual: the guard scans **README-cli.md only** — the same, real drift in `README.md:9/:80/:101` and `AGENTS.md:50` is not scanned by any test; verify by grep in the same commit (the row says so). | (carry the residual) |
| 8 | **OV-17** | W3 | run the corrected Quickstart block against a scratch dir; each command exits per the taxonomy (`create` → 0; `run` → 0/2 parked; `approve` → 0/2); reference RED = 219a's probes (`new` → `Unknown subcommand`) | **PROVES** | — (behavioural probes of the exact fixed text; strike-or-fix is decisive). | — |
| 9 | **DF-18** | W0 | `grep -cE 'feasibility\|template-derived\|not live research' src/components/console.tsx` → ≥ 1 (0 today) | **WEAK** | The string can land in a comment, another component, or a never-rendered branch — grep green, the scorecard headline still reads as researched. No `console.tsx` test file exists (`222` §6 UNMAPPED 3). | Grep at the `ScorecardBlock` region (`:3303`) with context, and make the post-OV-2 browser pass the registered acceptance. |
| 10 | **DF-26** | W0 | `grep -c TRUNC src/components/console.tsx` → ≥ 1 (0 today) | **WEAK** | Importing `TRUNC_MARKER` (or naming a variable) without rendering it; or a banner behind an affordance nobody opens — the packet tail still silently lost. | Same as DF-18 + assert the surface reads the packet's own accounting (`packet.ts:16/:17/:561`) rather than recomputing the cap. |
| 11 | **T5.2-A** | W1 | `node --experimental-strip-types --test --test-concurrency=2 src/lib/brief-fixtures.test.ts` + new store-action tests (+ CLI probe) | **WEAK** | The two runnable halves prove the *backend*; the row's done-when is a **UI** claim ("approving one case in the UI flips …"), and there is no console test target — a lane can land store action + tests, skip the surface, and every command is green ("do not claim the row complete without the surface" — 230). | Declare the UI half UNVERIFIABLE-NOW in the lane handoff; the post-OV-2 browser pass is its registration point. |
| 12 | **OV-13** | W2 | extended `src/lib/store.test.ts` + `src/lib/verify.server.test.ts` runs (+ engine-side pins "mirroring the sealed-log pin pattern"; `engine.test.ts` does not exist) | **WEAK** | The engine sites (`engine.ts:3011–3012`, `:3029–3030`) are 2 of 4; 230's "If blocked" path legitimizes landing them **unasserted** (grep-marker + registered follow-up) — then a keyed degrade still reads byte-identical to a keyless run while both suites are green, exactly the class the row exists to kill. | One asserting case per site (engine pins via `gates.test.ts`/`headless.test.ts`) + a case that the degraded keyed path is *distinguishable*. |
| 13 | **OV-12** | W0 | `grep -n 'PROBE RESULT\|UNKNOWN at write time' fixes/217c…md` → stale strings replaced by the settled text (read) | **PROVES** | — (text-only row; mechanical check + same-pass read). Residual: wording must cite 217b §2, not pre-empt T-107.8's decision — covered by the read. | — |
| 14 | **OV-15** | W3 | `grep -n 'redTree' scripts/rapidtool-cli.mjs` (new flag) AND refusal text unchanged (option a) or updated (option b) + scratch emit probe on a red-trail project | **WEAK** | A flag wired to the wrong policy (`redTree:"probe"` instead of `"banner"`) or bypassing the banner contract is grep-green to both greps; the behaviour probe catches it only if actually run and read — it is scratch, not durable. | Commit the probe shape where possible; grep both sides (CLI flag + `headless.ts:1405` text) in one check. |
| 15 | **OV-3** | W5 | new case in `src/lib/compile-check.server.test.ts`: `treeRun(dir).ok === true` and executed-test count ≥ 1, **without installing anything**; plus a red-tree case stays `ok:false` | **PROVES** | — (the test IS the diagnosis, 223 §4 C-3; `testsPass ≥ 1` defeats skip-dressed-as-pass). Residual: assert the third outcome (unverified ≠ pass) explicitly so a later weakening of that branch is caught; keep `:841`/`:917–918` byte-identical (diff-check). | (carry the residual) |
| 16 | **OV-4** | W6 | `headless.test.ts` new case, **default** `recordGate` → `converged` + `gate.passed` + `tested` + non-empty hash (RED today → GREEN after) | **WEAK** | (a) The **red path** is untested — a reorder that mints on a red/unsure tree-run passes the green case and violates T0.6's "never mint on unsure evidence" + I8; (b) the repair seam, same as C-1. | Add the red-path case (no mint, no `"tested"`, gate red) + the repair-seam case — both are the actual invariants, not extras. |
| 17 | **OV-5** | W5 | (a) predicate pin + probe (C-2 family); (b) M7: `npm run eval -- --trials=2` (keyless, heavy — owner window) then a second same-domain run's row cites run #1's | **WEAK** | (a) inherits C-2's wiring gap; (b) a keyless `--trials=2` invocation is **two trials of one entry — not two runs**, and does not produce the *keyed* baseline the done-when names ("citing run #1's row" = T0.10's keyed row): a lane can run it keyless, see a prior displayed, and claim M7 while the keyed citation path stays untested. | State that the M7 half completes only after Step 0; pin the prior-citation against the real keyed row post-run #1. |

**Counts: PROVES 4 · WEAK 13 · MISSING 0** (TA-3, OV-17, OV-12, OV-3 / the other 13 → 4 + 13 = 17 placed rows). `MISSING: 0` is scoped: none of the 17 placed rows is command-less — the 42-list's three command-less rows (DF-09, T4.3, G4) are deliberately **outside** this wave set (definition-first; §1 Not-placed). **The dangerous class is the 13 WEAK**, in three families: (i) **five can be green while nothing the user sees changed** — grep-flips and UI-halves (DF-18, DF-26, OV-2, T5.2-A, OV-15); (ii) **five can be green while the mechanism is unwired** — C-1's repair seam, C-2's drain wiring, OV-5, OV-13's engine sites, OV-4's red path; (iii) **three can be green while the contract is wrong** — TASK-01 (arm collapse / computation independence), T5.3 (payload + refusal), OV-35 (marker ordering + triage classes). Each has a ≤1-hour strengthening above; the highest-leverage three: **C-2's drain wiring test, C-1's repair-seam case, DF-26/DF-18's render-evidence** — they sit on the critical path's own outputs.

---

## §3 · LANE-SIZING RULES FROM THE FOUR OBSERVED FAILURES

**The ledger (all from today's transcript parsing — commands in §6; "calls" = `tool` lines in the transcript, a batched `terminal(… +N commands)` counts once):**

| lane | deliverable | tool calls | exit | **first deliverable write** | file on disk? |
|---|---|---|---|---|---|
| 1 | `219a` (438 lines) | 96 | `max_iterations` | **call 4** (skeleton), patches 94–95 | ✅ |
| 2 | `219b` (211) | 65 | `completed` | **call 15**, then 18 incremental writes | ✅ |
| 3 | `219c` | 80 | `max_iterations` | **never** (1 write — scratch `drain.sh` @73) | ❌ parent-recovered |
| 4 | `219d` | 78 | `max_iterations` | **never** (2 writes — scratch probes @43/45) | ❌ parent-recovered |
| 5 | `219e` (349) | 57 | `completed` | **call 52 of 57** (5-call margin) | ✅ |
| 6 | `219f` (586) | 83 | `completed` | **call 76 of 83** (7-call margin) | ✅ |
| X-1 | `225` | 86 | `max_iterations` | **never** (2 writes — scratch @24/32; +14 `process poll`s) | ❌ parent-recovered |
| X-2 | `226` | 59 | `max_iterations` | **never** (12 writes — all scratch `probe1…10.sh`) | ❌ parent-recovered |
| X-3 | `227` (148) | 51 | `completed` | **call 44 of 51** (7-call margin) | ✅ |

**The pattern in plain numbers:** 5/5 lanes that reached their write survived with a complete file; 0/4 that deferred it produced nothing. The four failures each died *mid-work with the write still ahead of them* (lane 3: "ran out of tool-call budget mid-investigation"; X-1: "cut off before the write pass"; X-2: "the write pass never happened"; lane 4: "exhausted its tool budget before the write"). Lane 1 hit the same cap as lane 3 and still finished — because the file existed from call 4. `delegation.max_iterations: 50` in the hermes config (`%LOCALAPPDATA%\hermes\config.yaml:120`, read today) is the shared cap; tool-call counts exceed it through batching, so *raising the cap is not the fix the data supports* — the write position is.

**Rules (each: the failure it would have prevented):**

1. **Skeleton by call 8 — mandatory, not advisory.** Full headings + the mandated bottom-line shape + the row list, written to the real deliverable path before deep reading. *Prevents:* lanes 3, 4, X-1, X-2 — all four. Every W13 brief already said "Skeleton first, then fill" (23 of the 25 W13 briefs contain the skeleton instruction — `grep -l skeleton wave_plans/W13/*.md | wc -l` = 23, run today), and it still failed 4/9 lanes, because "then fill" was read as permission to finish recon first. The rule must have ordering teeth: *the write is the lane's second or third action, before the evidence is complete.*
2. **One row per lane; merge only same-file S rows.** *Prevents:* X-2 (Half A + a 6-question Half B + self-rejections + proposed rows in one lane — "research complete, write pending" when the cap hit) and lane 4 (a 5-part hop-by-hop trace + repair-loop trace + upgrade proposal). Contrast lane 2: one dossier, one theme, completed in 65 calls with 18 incremental writes. This is what §1 enforces: 14 lane-slots for 17 rows, the two merges both being same-file S+S bundles (DF-18+26; TA-3+OV-17+OV-15).
3. **Cap the read phase: ≤2 files read in full; batch every grep (3–12 commands per terminal call); stop recon at ~60 % of the expected call budget even with open questions.** *Prevents:* lane 3 (57 terminal + 22 reads, still probing at call 77 — its last calls were `node -e` probes, not writing) and lane 4 (51 + 25, still grepping at call 78). Contrast X-3: wrote at 44 after 29 terminal + 16 reads and then stopped; lane 5's terminal calls averaged ~6 batched commands (37 batch calls / 212 extra commands).
4. **Scratch budget: ≤2 scratch writes per lane; batch all probes into ONE script.** *Prevents:* X-2 — its 12 `write_file` calls all targeted `w13k_scratch/probe*.sh`: the write budget was spent on probes, the deliverable never created. Lane 2 shows the alternative: one scratch `.sh` per sweep theme, batched.
5. **No background processes in a lane.** *Prevents:* X-1 — 14 `process poll` calls babysitting a stray `security_tests_counts.sh`; its last six calls were polls and count-greps, never the deliverable.
6. **Write-as-you-go after the skeleton; never hold a write pass for the end.** *Prevents:* the razor-thin margins of lanes 5 (52/57), 6 (76/83) and X-3 (44/51) becoming losses — each survived only because post-write needs were tiny (patches + a `wc`). Any one extra investigative detour before the write would have joined the failure set. Patch-per-section also means a dying lane leaves *fillable* sections (recovery becomes paste-and-continue, not reconstruction).
7. **The parent's dispatch ritual:** every lane brief carries (a) deliverable path, (b) required headings + bottom-line shape, (c) the exact verify command, (d) "skeleton by call 8"; and the parent checks the file **exists mid-wave** (one `ls` when ~half the lanes' typical runtime has elapsed — the W13 run shows a missing file at mid-wave is the reliable predictor of a dead lane). Keep the parent-recovery habit (4/4 recoveries succeeded) as the *fallback*, never the plan.

---

## §4 · THE THREE EXECUTION RISKS (ranked, with detection signals and cheapest mitigation)

**R1 — Contested-file collision (two lanes write one file).** Ranked first: it corrupts silently (the gate sees only the final bytes) and is the easiest to introduce by a well-meaning brief — `engine.ts` alone is a seam for six rows (`222` §4), and my own §1 needed serialization chains on six files (`headless.ts` ×5 waves, `run-eval.mjs` ×4, `rapidtool-cli.mjs` ×3, `console.tsx` ×3, `codegen.server.ts` ×3, `store.ts`/`verify.server.ts` ×2 each) to keep every wave disjoint. *Detection signals:* (a) at dispatch — intersect all lanes' ownership boxes; any shared path = stop; (b) mid-wave — `git diff --name-only` vs the boxes; (c) at handoff — a lane's changed-file list must equal its box (a lane touching a file outside its box is a collision in progress). *Cheapest mitigation:* the dispatch-time intersection check (≈1 minute/wave) + the standing rule "sequence, never line-split" for flash lanes (line-range splits need contracts the lanes cannot audit themselves). *Cost of the usual shortcut:* two lanes on `headless.ts` in the same wave can land a plausible-looking merge of C-1 and TASK-01 that the gate accepts and the tests under-cover.

**R2 — Claim-complete-with-a-hollow-file (a skeleton passes as done).** Precedent on disk today: `fixes/217e` = 40 lines, `fixes/217f` = 36 lines — the wave brief names exactly this set (`217e/217f/217h`) as "skeletons on disk" while their titles name landings (`217e_next_action_and_cli_dispatch`, `217f_engine_error_surface_and_tree_gitignore`; `217h` = 160 lines, read today). The boundary gate **cannot catch it**: `gate.sh` checks typecheck/lint/assertion-gaps/tests/build and never looks at `research/**`. *Detection signals:* `wc -l` vs the declared section count; required-heading grep (`grep -c '^## '`); zero `file:line` citations; the mandated bottom line absent or hollow. *Cheapest mitigation:* a 30-second per-lane acceptance checklist in the parent's boundary routine — path exists, `wc -l` ≥ declared minimum, required headings present, citations > 0, verify command recorded in the file — anything failing means that lane's work is not done and the wave log says so. (Numbers from this audit to seed it: W13 recovered bodies ran 54–132 lines while complete ones ran 148–586.)

**R3 — Late red boundary gate.** Loud but expensive: a red gate after lanes are torn down costs the wave's re-dispatch plus host time (≈160 s per gate, parent-only, and never mid-edit — `AGENTS.md`: "Never run the full gate while agents are mid-edit"; a concurrent heavy-command spike already froze this 8 GB box once, per the wave brief). *Detection signals:* `gate.sh` exit ≠ 0 and which gate (its header prints per-gate exit codes; `--double` for flake-vs-hard-failure); attribution via `git diff --name-only` × ownership boxes; a flake shows as pass↔fail between the two `--double` legs. *Cheapest mitigation:* each lane must run its **own** targeted verify before handoff (the §2 command for its row) so the boundary gate is confirmatory, not diagnostic; on red, attribute to the owning lane and dispatch **one** fix lane against the failing gate's targeted form — do not re-run the wave, and never re-run the full gate mid-edit to "see".

---

## §5 · THE 48-HOUR CRITICAL PATH — from today's green tree to the owner's keyed run

**State of record:** HEAD `7582771`, tree clean at measurement; gate baseline from `fixes/218` §5 (typecheck 0 · lint 0 · assertionGaps 0 · scripts 261/261 · lib 1957/1957 (+1 skip) · build 0 — taken from the record, not re-run). Everything below is designed to spend the *fewest* keyed runs and the fewest wasted runs.

**The chain (each step justified by the failure it prevents):**

1. **W0 — C-1 + C-2 first.** *C-1* (mint-before-gate at both seams): without it **M3+M4 are zeros by construction for every chunked keyed synthesis** — the P6 gate is recorded before the only mint, verified circular (`headless.ts:1916–1917` → `:1958`; `dod.ts:500–517`; corroborated by the surviving 09-10 keyed ledger showing P6 complete with no green gate). Running Step 0 as-is measures a deadlocked program and can score *below* the keyless 6/9 floor — a demoralising, misleading number. *C-2* (`"dod"` terminal): without it the drain spins its 80-round guard and **M9=0 is certain**; with it, the hard stop becomes a coded terminal stop. (~2 h lanes + gate.)
2. **W1 — OV-35, in its internal order: (a) run-start marker → (b) preflight/triage.** *(a) kill-safety:* `results.json` is written once at the end (`run-eval.mjs:1177`) and the stale **2026-09-17 keyless 6/9 stays in place** if the run is killed (8 GB host; WB-7 wall-clock: 756 s on the failed 09-10 run, worst case hours) — the marker makes a killed run unmistakable. *(b) triage:* `run-eval.mjs:83` checks key **presence only**; an invalid (401), broke (402) or drifted (400 model-id) key currently reads as *bad quality*, and a ≤4/9 outcome has no named branch (`227` §2a). Both sub-steps must be in before the run. (~3 h lane + gate.)
3. **Quiet-host window → Step 0 (owner).** `npm run eval -- --keyed` — exactly as `_keyed-run.log:2`. Do not run it while agents share the box (230); expect **3–6/9, centred 4–5/9** per 223's pre-mortem — with C-1/C-2 landed the number is *informative* (three near-certain greens M5/M6/M8; M1/M2 the coupled coin-flips; M3/M4/M9 now reachable rather than certain-zero). Read the log through the ≤4/9 branch from OV-35(b) before concluding anything. Paste the score into `taskuniverselog.md` §5.
4. **W5/W6 — close the zeros from the log** (OV-3 M2 · OV-5 M9/M7 · OV-4 M3/M4), each gated on reading T0.10's log first (the plan's own rule: no log → diagnosis memo, do not patch blind). Note: **M2=0 in run #1 is expected** — 223 C-3 stays post-Step-0 by design; the log decides its fix.
5. **OV-8 — run #2 (owner), same domain**, so M7 can cite run #1's keyed row; claims flip only in the same commit as the evidence.

**MUST precede Step 0:** C-1 · C-2 · OV-35(a) marker · OV-35(b) triage. **SHOULD precede:** a green boundary gate on W0+W1 and a quiet host (WB-7); optionally the W1 co-riders (TASK-01, T5.2-A) since they are already dispatched — but they are *not* prerequisites. **CAN wait:** W2/W3 keyless rows (T5.3, OV-2, OV-13, TA-3+OV-17, OV-15), all of W5/W6, all owner decisions, the W16/Phase-5 backlog.

**If the key arrives tonight — the minimum path:** W0 {C-1, C-2} → `gate.sh` → W1's **S1 alone** (OV-35) → `gate.sh` → quiet window → Step 0. Two gates (~5.5 min) + two lane-waves; everything else follows after the number exists.

**Hour bands (loose):** 0–2 h W0 dispatch; 2–3 h gate; 3–6 h W1; 6–7 h gate; 7–12 h W2/W3 ride in parallel with waiting for the key/quiet window; Step 0 in the first quiet window ≤48 h; W5/W6 same day as the log. The **rate-limiter is the key's arrival + a quiet host**, not the engineering (three S/M-sized lanes).

---

## §6 · PROVENANCE, CORRECTIONS FOR THE PARENT, HONEST LIMITS

**What I ran today (read-only; 0 of ≤3 targeted test runs used — none was needed):** the greps/`wc`/`sed` behind every anchor (`headless.ts` seam regions cited come from 223/230/222, which I read in full today, not re-opened by me beyond the file-list checks); `wc -l` on the W13 deliverables; `git log --oneline -1` + `git status --short` (read-only) → HEAD `7582771`; `head -25 scripts/gate.sh`; `sed -n` on `scripts/README-cli.test.mjs`; `wc -l` on `fixes/217e|217f|217h`; and the transcript analysis of the 9 delegation logs under `%LOCALAPPDATA%\hermes\cache\delegation\live\{deleg_b77255e7,deleg_471d953e,deleg_0f1252a3}` + `%LOCALAPPDATA%\hermes\config.yaml:120`. No `npm` command, no typecheck/test/build, no git mutations, no writes but this file.

**Corrections / notes for the parent (I edited no plan file):**

1. **The W13 budget-failure ledger, precisely.** The brief's "4 of 6 work lanes (lanes 3, 4, X-1, X-2)" and "Lanes 1, 5, 6/X-3 finished" undercounts the finishers: the nine write-obligated lanes split **4 failed / 5 finished** — lane 2 (`219b`) also finished (`deleg_b77255e7` task-1, `exit_reason: completed`, 65 calls, file written at call 15), and lane 1 finished *its write* before its own `max_iterations` exit (skeleton at call 4; its later death is budget-exhaustion **after** the deliverable existed). The four failures are real and are 2/6 work lanes + 2/3 adversary lanes. §3's rules use the per-lane data.
2. **OV-35 (and 223's C-1/C-2/C-3) are not rows of the 42-row canonical list**, and `230_task_execution_playbook.md` predates them (its OV-4/OV-5 blocks carry C-1/C-2 as *fix shapes* only; OV-35 has no playbook block). My waves dispatch them as standalone pre-Step-0 lanes; the parent should fold OV-35 into the canonical list + playbook so the wave brief carries its strengthened verify cell (§2 row 3), and C-1/C-2 as their own rows so they are not lost inside OV-4/OV-5 ("If blocked: deliver the C-1 fix anyway" — 230 — is exactly how a row goes missing).
3. **Scope note for `UNPLACEABLE: 0`:** zero in-scope rows failed placement. If the parent pulls the `UNVERIFIABLE-NOW` rows (DF-09, T4.3, G4) into a wave before their checks are defined, each is `UNPLACEABLE: <row> — no verification command exists yet` (its definition is the first small deliverable, per 230 Part 4).
4. **Non-findings, checked:** `230`'s global lane rules (L1–L7 landmines, forbidden commands, HOT rule, house style) and §3's rules are complementary — no contradiction found; `230` §3's cross-references (TA-3/OV-17 share `README.md`; DF-18/DF-26 same `console.tsx`; OV-3/4/5 read T0.10's log first) are all honored in §1's serialization chains. The wave brief's "`gate.sh` ≈160 s" is cited as given — not re-measured (I did not run the gate).
5. **For the runner of W13's next wave:** the four failing lanes' deliverables exist **only as parent-recovery notes** with the lanes' own content under a header (`219c`–`219d`, `225`–`226`) — treat them as lane-authored, not parent-edited, and re-read at dispatch (`222` §6's own rule: re-read, never trust a dossier).

**Honest limits of this audit.** (a) No verify command in §2 was executed by me — grades are analyses of the commands + the tests they name (I read `README-cli.test.mjs`'s guard directly; the other pins are cited from 222/223/230, read in full today). (b) Call counts are transcript `tool`-line counts (one per tool invocation; batched shell commands inside a `terminal` call show as `+N commands`); the exact turn arithmetic behind `max_iterations` was not reconstructible from logs — the ordering facts (who wrote, when, relative to the cap) are what §3 relies on and are robust to that. (c) The wave design is a design: it assumes lanes re-read their seams at dispatch and that ownership boxes are honored; the parent's dispatch-time intersection check (R1) is what makes it hold. (d) `fixes/217e|217f` are cited as the hollow-file precedent at 40/36 lines — I did not judge whether those two landings were complete-by-intent (their titles claim landings; the brief names them as skeletons).

*End of ENG-WD2 deliverable. Read-only audit; this file is the only write.*
