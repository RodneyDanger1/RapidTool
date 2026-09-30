# fixes/319_keyed_trial.md — THE KEYED TRIAL (W44 Phase 2)

**Run:** 2026-09-30. Tree frozen at HEAD `cdf2510` + `a3ebcdf`. Key: owner's `sk-47e…19b3` (in `.env`; wrapper `C:/Users/mnril/w44_trial/rt.sh`, key never echoed). Wallet: keyed preflight `class=wire-ok · HTTP 200` @ 2026-09-30T15:46Z.
**Team:** T1 operator (3 builds) · T2 app-response monitor · T3 back-end monitor · F1/F2/F3 fixers (hold repo edits until the GO marker `C:/Users/mnril/w44_trial/fix_go.md`). Lane logs: `fixes/319_t1_operator.md` · `319_t2_app_monitor.md` · `319_t3_backend_monitor.md` · `319_f1_io_code.md` · `319_f2_pins.md` · `319_f3_promote.md`.

## Findings ledger (append-only)

### FINDING-1 · P0 reframe park on a natural-language brief (build a, first attempt) — RESOLVED-BY-BRIEF
- **What:** the website build's sealed run (`wild --start --steps 20 --agent-seal`, keyed) advanced exactly 1 step, then parked: `outcome:"paused"` · `note:"P0 is a human-only gate."` · phase `awaiting_hitl` · gate **"Reframe the brief"** (`forceHuman:true`, R3/B-03 — refused by the seal by design, no machine door). Envelope: `C:/Users/mnril/w44_trial/website/02_wild.out`.
- **Root cause (bytes):** the brief matched **0 LEX hits** — `lattice.vague: true`, "top absent nouns: harbor, pin, roastery" (`build.json` :192 / :274-275; LEX = `src/lib/algorithms.ts:43` actor/job/object registers). Vague lattice → scorecard `overall=7.2 verdict=reframe` (`build.json` :267-268) → reframe gate → the seal refuses (design: a reframe is the machine telling a human to tighten the brief; never autopilot-approvable).
- **Judgement:** NOT a code bug — designed behavior + a real product-UX friction: a fresh natural-language brief that misses the LEX vocabulary cannot proceed unattended, and the park message says "tighten the brief" without saying how. Candidate improvement (post-trial backlog): the reframe prompt could render the LEX's absent-noun report + a suggested tightened brief (the data already exists at `build.json` :192).
- **Trial fix:** briefs rewritten to LEX vocabulary; all three re-probed keyless (`w44_trial/lexprobe.sh`; deterministic P0 only, zero spend): **lexweb / lexgame / lexcli → `outcome:"advanced"`** each (no vague, no reframe). Ready for the retry runs.
  - **lexweb** (build a): "A static marketing website for a coffee shop: visitors browse a menu page and subscribe for updates; the shop admin edits pages and publishes them. Plain HTML and CSS files, no external services, works offline."
  - **lexgame** (build b): "An arcade game for players: drag and drop blocks, track the score, and persist the high score; playable in the browser with keyboard controls."
  - **lexcli** (build c): "A command-line tool: parse a CSV file, calculate per-client totals, and generate a report; validate malformed rows and exit with an error."
- **Evidence:** `w44_trial/website/01_create.out` · `02_wild.out` · `build.json:267-275,302-312` · `w44_trial/_lexprobe/lex{web,game,cli}.wild.out`.
- **Open → resolved:** T1's own (b)/(c) briefs were probed keyless (`lexprobe2.sh`, same deterministic P0 path): **both `outcome:"advanced"`** — no retry needed for (b)/(c). Only the natural-language roastery brief was vocabulary-dead; the game brief lands on `single-player`, the CLI brief on `invoice`/`command`/`client`.

### OBSERVATION-1 · Parked-project emit chain stays honest — VERIFIED (positive evidence)
- `emit --run` on the P0-parked project returned `ok:true` (16 files) but carried the full **SUBSTANCE MARKING**: `substance:{stubs:1,reexports:0,real:0,verdict:"stub-skeleton",greenWhileStubbed:true,oracleStubTrap:true}` + the loud note "this tree is NOT product-complete … K3: exit 0 must never be read as product quality … the K4 oracle trap" (`03_emit_run.out:97,115-121`); tree legs typecheck/build = honest skips: "UNVERIFIED (npm install, then re-run to verify) — not a fabricated pass" (`:79,:94`); `verdictHash:"890750497"`.
- `doctor --tree` agrees: `stubs:1/reexports:0/real:0` + gaps "leftover jobs are reexports or TODO(E-15) stubs — not a multi-job product" · "no real multi-job product" · "product-complete bar not met (skip≠green; stubs≠complete)" (`05_doctor.out:32-37`). Also confirms `llm.configured:true (deepseek-v4-flash | deepseek-v4-pro)` · `research.configured:true (free search)` · `tokenCap:5000000` mirrored.
- Emission: no overclaiming anywhere on a never-advanced project. The honesty layer (W44-era substance marking) is working on live trial bytes.

### FINDING-2 · P0 review-park on substance-adequate briefs — the fresh-run wall (DESIGN + GAP)
- **What (game build):** brief passed P0's lattice (player hit, `vague:false`), the sealed run then: `wild.exec` (P0 deterministic floor) → `gate.verdict` (DoD PASS — evidence hash `3269632901`) → **`wild.review_retry` ×2** ("P0 review REJECTED (classifier) — retry 1/2 after 500ms backoff", "retry 2/2 after 1000ms") → `wild.review` (critique) → `wild.reject` → `wild.paused`. Envelope: `outcome:"paused"`, spend **2728** tokens. Park: `code:"RT_E_GATE_PENDING"` · `unlock:"human-gate"` · `resumeAction:"advance"` · unlockText "A human must approve or reject the open gate (console/CLI), then resume the run."
- **The critique (correct):** "The phase artifacts do not deliver the substance the P0 brief requires… internally contradictory… no evidence of actual domain landscape research… boilerplate… To approve, this phase must produce: (1) a concrete library/architecture comparison… (2) a completed, non-truncated scorecard… (3)…" — verified TRUE against the artifacts (generic template scorecard; security section truncated mid-sentence; job dimension fell back to `deliver-core-workflow`).
- **Build (c) program:** same park ("…internally inconsistent and largely truncated… cannot confirm the phase's actual DoD…"), spend **2811**. Mode summary: (a) reframe park (FINDING-1) · (b)/(c) review parks (mode 2).
- **Mechanics (why):** the `wild` driver = seal + keyed planner + keyed reviewer, **no live layer** (CLI opts `{maxSteps, agentSeal, onEvent}`, `rapidtool-cli.mjs:3568-3573`; `live` exists only on run/gate/resume/unattended — which refuse `--agent-seal` by design, `:690-693`). P0 on a fresh project = pure-floor artifacts. Engine design note: "a pure-floor phase parks honestly (a blind identical re-run is not a repair, B-07)" (`engine.ts:4481-4485`). The reviewer's honesty is the designed quality bar — it must never bless the floor.
- **Park-exit probes (parent, scratch copy `_approvetest/at.json`, all logged):** `approve --seat autopilot` → refused `RT_E_GATE_PENDING` "No pending gate to approve (status: running)" + remedy "…never fabricate a decision"; bare `approve` → same; `reject --note` → "No pending gate to reject"; `wild --start` resume → re-review → **re-REJECT** (fresh critique, +932 tokens). ⇒ On these bytes the review-park has **no CLI exit** — machine or human — despite the unlockText promising "(console/CLI)"; console route untested (T2's note). **GAP-1:** mint an approvable gate on review-park (honesty-preserving; human-only) or route approve/reject to parks.
- **GAP-2:** seal+live unification — today seal⇒no-live, live⇒no-seal; fresh runs cannot generate the substance the reviewer demands.
- **Judgement:** both parks are HONEST and coded; the keyed pipeline (planner/reviewer/bounded-retries/park/emit-marking) works as designed; fresh-project end-to-end completion is **blocked by design at P0's quality bar** until (a) the sealed path gains live substance or (b) a human blesses P0. The W44 "13-step sealed completion" evidence came from a P6-seeded engine run (bypassing P0-P5) — the gap is precisely freshness.
- **Trial spend so far:** website 0 · game 2728 · program 2811 · parent resume-probe 932 → **6,471 tokens total**, all genuine planner/reviewer calls on the owner's key.
- **Triage queue (post-wave):** (i) retry build (a) with the `lexweb` brief; (ii) fixer tickets GAP-1 (+GAP-2 design note); (iii) `run-eval.mjs --keyed` (bounded) — the corpus fixtures carry substance; the quantified end-to-end measurement lives there.

### FINDING-3 · two truncation classes in the review path (both VERIFIED)
- **3a — review PROMPT truncation (`wild-mode.server.ts:98-101`):** the Auto-Review prompt slices each artifact body to **320 chars** (max 8 artifacts). The game's reject thus claimed "The Security section is literally truncated mid-sentence" — an artifact of OUR OWN slice; disproved against the full artifact (`- Security posture: 7/10 — Scheduler Δ0.` reads complete; T2 caught it, parent re-verified the code cite). The reviewer's core complaint (generic floor boilerplate) stands independently. Fix candidate: honest review budget (per-artifact slice ≫320 / full bodies with a total cap) + pin.
- **3b — reject-TEXT surface truncation:** envelope `note` / `park.reason` / `lastAutoLog` cut mid-sentence (~200 chars; T1 F-C bytes: "…and (3)" / "…deliver-core-workflo"). The reader never sees the classifier's full required-fixes list (the `logs[]` row IS full). Fix candidate: raise the surface cap + ellipsis; pin.
- Both ticketed from the monitors (T1 F-C · T2 BUG-4). Cross-verified by parent.

### Bug ledger + fates (wave 1 — monitors' finds)
| # | bug | source | severity | fate |
|---|---|---|---|---|
| 1 | LEX coverage gap for consumer briefs → guaranteed reframe park | T1 F-A · T2 BUG-1 · T3 | HIGH (agent-use story) | designed honesty; trial fix = LEX-hitting brief (lexweb). Product ticket: reframe prompt could surface the absent-noun hint (data already exists) |
| 2 | review-park has **no CLI exit** (no pending gate; resume re-rejects) | parent probes | HIGH (blocks human loop) | TICKET **GAP-1** (mint approvable gate / route approve-reject) |
| 3 | `wild` has no live layer — no verb offers seal+live | parent (code read) | HIGH (fresh-run substance) | TICKET **GAP-2** (design; not a quick fix) |
| 4 | review-prompt 320-char artifact slice | T2 BUG-4 (parent-verified) | MED | TICKET (small fix + pin) |
| 5 | reject-text surface truncation | T1 F-C · T3 | LOW-MED | TICKET (small fix + pin) |
| 6 | diagnose wildRun divergence (stopped vs parked) | T1 F-D · T2 BUG-2 | MED (tooling truth) | TICKET (small fix + pin) |
| 7 | NDJSON sparse — verdicts/retries only in `build.json.logs` | T3 | LOW (observability) | noted; decision ticket |
| 8 | no per-call token/$ decomposition surfaced | T3 | LOW | noted (honesty already: "never estimated") |

### Monitors' roll-ups (wave 1)
- **T2 (app-response):** both live builds park at the first gate; envelopes coded + honest; game's critique partly grounded in our own 320-char slice (BUG-4); diagnose divergence (BUG-2); console pass not attempted (recorded honestly).
- **T3 (back-end):** zero stray/zombie processes; NDJSON sparse (`build.json.logs` = the real trail); spend = per-invocation aggregates only; cap armed; no 402s; emitted trees = honest scaffolds `real:0` — **NOT working software at this stage** (blocked at P0; the job layer never ran keyed).
- **T1 (operator):** 0/3 completed; every park documented with bytes; nothing forced; key live (classifier executed; zero `RT_E_LLM_NOT_CONFIGURED`).

## Per-build outcomes (filled at consolidation)

| build | brief as run | P0 | sealed run | emit --run | tree tests | outcome |
|---|---|---|---|---|---|---|
| a · website | Harbor-and-Pine (natural language) | **PARKED — reframe (FINDING-1)** | — | stub-skeleton 16f (honest marking, OBSERVATION-1) | 5p/1s | retry queued (lexweb) |
| b · game | T1's brief | PASS (lattice) | **PARKED — review (FINDING-2, 2728 tok)** | pending (T1; parent completes if capped) | | ticketed |
| c · program | T1's brief | PASS (lattice) | **PARKED — review (FINDING-2, 2811 tok)** | stub-skeleton 16f (honest doctor gaps) | recorded | ticketed |

## The three monitors' rolls-up (filled at consolidation)

## Bugs + fates (filled at consolidation)

## Wave-1 closure (2026-09-30)
- **Fixer proofs (parent re-run, fresh):** typecheck 0 · wild-step 30/30 · wild-seal+io+store 155/155 · cli-exit-taxonomy 12/12 · eslint 0 (7 files).
- **BOUNDARY — `bash scripts/gate.sh` → `ok:true`** (wallMs 274784): typecheck 0 · lint 0 (`problems:null`) · assertionGaps 0 · testsScripts **358/358** · testsLib **2469/2469 +1 skip** · build 0. Full suite standalone: **2828 tests · 2827 pass · 1 skip · 0 fail.**
- **Committed: `21c4731`** (fixer wave + all 319 logs; tree clean). Verification trail: `w44_tc3/ws/rest/cet/esl`, `w44_npmtest2`, `w44_gate2` logs; nothing claimed without bytes.
- **Wave-2 queue (parent):** ① GAP-1 park-exit fix (review-park mint) ② small fixes #4 (review-prompt 320-char slice) / #5 (reject-text surfaces) / #6 (diagnose wildRun divergence) ③ then the keyed DRIVER wave: lexweb retry + `gate --live --autopilot` A/B (does the live layer carry P0 with real research?) + bounded `run-eval.mjs --keyed` for scores ④ F3's T9.3 §C promotion lane (headless/cli/run-eval owners).

## Verdict (final)
(filled at consolidation — the one question: does RapidTool produce working software powered by a DeepSeek key?)
