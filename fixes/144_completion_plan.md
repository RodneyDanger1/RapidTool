# 144 — RAPIDTOOL COMPLETION PLAN: from governed pre-flight compiler to production software generator

Author: parent agent · 2026-09-07. Consumes: fixes/143_g1..g6 (the 6-agent audit), fixes/134
(S-01..S-06 factory roadmap + T-sequence + M1..M9 bar), fixes/133 (TOP-10), the six maker
dossiers (98_make_1..5, 99). Every mission below is FLASH-executable: bounded microsteps,
50-call caps respected per agent run, four gates at every boundary (typecheck 0 / lint 0 /
full suite green / build 0), patch-only (one-time writes only for brand-new files),
disjoint file ownership per lane, exit artifact = a fixes/NN log with quoted evidence.

## THE DEPENDENCY LAW (why the missions run in this order)
D1+D4 (multi-file generation) build the tree → D3 (tree-run in loop) executes it →
D2 (journey driver) iterates it → D6 (eval harness) scores it → D5 (learning) makes the
scores compound. D7-D10 are parallel-safe at any time and must NOT delay the spine.
The 10/10 maker bar (M1..M9) is only reachable when D1→D6 land; honesty items 1-4 of the
g6 checklist must stay green throughout (regression law: every wave re-runs the four gates).

---

# PHASE 0 — WAVE STRUCTURE & STANDING RULES (one page, every agent reads this)

- Working dir: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash `/c/Users/mnril/Desktop/RapidTool Main`; NOT git; quote paths; ripgrep tools fail on the space — use terminal grep after `cd`).
- Every agent: read `AGENTS.md` + `AGENT_GUIDE.md` + this plan's mission block + the dossiers it cites BEFORE touching code. Re-grep anchors at read time (they drift ±5 lines mid-wave).
- Four gates green at every mission boundary: `npm run typecheck` (0) · `npm run lint` (0 errors) · `node --experimental-strip-types --test src/lib/*.test.ts src/lib/app-data/app-data.test.ts src/lib/auth/*.test.ts` (full green) · `npm run build` (0). Known flake: exec.test.ts spawn-grace under parallel load — re-run standalone before acting (passes 19/19).
- Patch-only on existing files. No export renames without updating every consumer. No new deps. Client-safe modules never statically import node:fs (server modules only, via dynamic import seams).
- Determinism + telemetry purity: tests normalize timestamps; injected `now` clocks; rt code never changes engine behavior.
- Exit artifact per mission: `fixes/14X_<mission>.md` with quoted before/after evidence.
- Do NOT gate mid-sibling-edit: waves gate at the END of their lane on their own files, parent gates the whole tree between waves.
- Env for keyed probes: `set -a && . ./.env && set +a` (real DeepSeek key present; TAVILY empty — keyless web research is DDG/Wikipedia).
- MSYS path quirks: `/tmp` invisible to Node (use `C:/...` explicit); CLI `--out` with MSYS paths mangles — use `C:/`-style absolute args or relocate after.

---

# MISSION M1 — FINDABLE OUTPUT + TRUTH-IN-DOCS (D7 + D9-small + g4 fix) — PARALLEL-SAFE, FIRST
**Goal:** a lone user's software lands in a findable folder; every user-visible claim matches behavior on disk.
**Why first:** zero risk, zero dependency, closes 3 of the user's 4 direct questions (where does it go / how does it present itself), and gives every later mission a sane output target.
**Ownership:** scripts/rapidtool-cli.mjs (emit/vault/create defaults only) · README.md · AGENT_GUIDE.md · scripts/README-cli.md · src/lib/phases.ts (P5 summary line) · src/lib/packet.ts comment · src/components/console.tsx (settings copy + enforceDod toggle + a "Run machine verify" button) · src/lib/store.ts (setEnforceDod surface already exists — wire a CLI flag + console toggle) · their tests.
**Microsteps:**
1. **Default output folder (g4 patch):** in rapidtool-cli.mjs `emit`, change the default from `./emit/` to `<home>/RapidTool Software/<slug(project.name)>/` (home = `os.homedir()`; fall back to CWD when homedir unwritable; `--out` keeps overriding). Same pattern for `vault` (default `<project-slug>/vault` under the same parent). CHECK: live probe `create`+`emit` with NO `--out` → folder exists at the documented path with the project's name; `emit` twice → second run overwrites cleanly (documented) not merges silently; deterministic.
2. **UI "Export software" affordance:** console emits are CLI-only today — add one Export button on the completed-build view that runs the same emitProject through the server fn seam into a download (zip via a tiny server endpoint, or honest instruction text if zip needs deps — prefer instruction + path, no new deps) + a toast with the exact folder path. CHECK: button visible on a complete project; label honest; no new deps; build green.
3. **Docs drift pass (g6 D7 list):** packet version v2→v3 sweep (README, AGENT_GUIDE, any copy) · verb count 27→30 + document `check`/`diagnose`/`emit` in README-cli · gate-authority copy ("advisory… never block" → "advisory keyless; enforced by default when a DeepSeek key is configured; `--advisory` to relax") in console settings + AGENT_GUIDE · P5 phase summary truth ("capture live; retrieval partial — roadmap") · AGENT_GUIDE artifact table. CHECK: grep for "v2" / "27 verb" / "never block" returns only intentional history; the four gates green.
4. **enforceDod + verify UI wiring (D9):** console Settings toggle wiring `setEnforceDod` (per-project, honest label) + a "Run machine verify" button next to "Run module" on the Oracle tab calling `store.runVerifyAsync` (the seam exists — verify.ts header + store.ts:25) with busy state + outcome line. CHECK: typecheck; store.test still 62/62; a node-level probe calls runVerifyAsync's no-source guard.
5. **Wild-resume driver bug (g3 finding):** the UI Resume button calls only toggleWildPause (driverless run). Fix: Resume button calls `startWildRun` when the project has an active-but-paused wildRun (the tested resume path store.ts:900-916), or shows honest "start a new run from current phase". CHECK: regression test: paused run + resume → driver active again (store.test pattern); console copy honest.
**Exit criteria:** all four gates green · probe quotes in fixes/144_m1.md · the three user questions answered on disk: output folder exists by name, docs match the code, UI surfaces match the CLI.
**Log:** fixes/144_m1.md.

---

# MISSION M2 — MULTI-FILE GENERATION: THE TREE (S-01/T2 = g6 D1+D4) — THE SUBSTANCE SPINE, LARGEST
**Goal:** a keyed P6 journey produces a real multi-file source tree (≥1 file per brief-required capability, brief nouns as identifiers, no template contamination) — `Project.generatedTree` — assembled into the scaffold, per-file versioned + hashed.
**Why second:** every later mission (run-the-tree, iterate, eval) operates on THIS tree. Nothing else moves the maker bar.
**Ownership:** src/lib/codegen.server.ts (liveP6Synthesis + chunked synthesis) · src/lib/engine.ts (types + P6 record region + hydrate/generatedTree repair) · src/lib/types.ts (generatedTree shape) · src/lib/scaffold.ts (assembly: tree → files instead of one verbatim module) · src/lib/dod.ts (new p6-arch probe + brief-fit over the TREE) · src/lib/algorithms.ts if dependencyGraph lands there · their tests · fixes/144_m2.md.
**Design (from 134 §4 S-01 + the A-c1 research + the rotating-refusal root cause):**
- Add `Project.generatedTree?: { path: string; source: string; hash: string; attempt: number }[]` (types.ts) — additive, hydrate-repaired like other arrays.
- Replace the ONE 60k envelope with **chunked sequential synthesis**: expandBrief gives typeSignatures; group them ≤8 per chunk (MetaGPT-style, 134 cites it); each chunk = one pro-tier call (shared brief + reqTrace so later chunks see earlier exports); deterministic assembly; per-file content-addressed hashes; per-attempt file versioning (attempt N keeps prior attempt's files available to repair prompts).
- The verify loop's oracle cases now target the assembled TREE's entry module (imports resolve across files).
- Keyless floor unchanged (deterministic template) — the tree path is keyed-only, honestly labeled.
- New `p6-arch` DoD probe: every brief-required capability maps to ≥1 tree file (reqTrace) + no file is an untouched template stub (each carries its hash).
**Microsteps (each agent-visible check):**
1. Types + hydrate repair for generatedTree (agent 1: types.ts/engine.ts/io.ts round-trip + tests). CHECK: a hand-built generatedTree survives export→import byte-identically; corrupt rows repaired loudly.
2. Chunked synthesis driver in codegen.server.ts (agent 2, the core): expand → chunk typeSignatures ≤8 → sequential pro calls → assembly → hash. CHECK: unit tests with an injected fake pro caller (deterministic, no key): 20 signatures → 3 chunks; later chunks receive earlier chunk exports; refusal in chunk N keeps chunks 0..N-1 (honest partial + log); deterministic given same inputs.
3. Tree→scaffold assembly (agent 3): scaffoldProject consumes generatedTree (paths map into src/api|domain|jobs|state per the spec graph), host file references the tree instead of embedding one verbatim module; oracle.spec imports the tree entry. CHECK: scaffold tests updated; emitted npm test passes with a fake tree (real assertions over cross-file imports).
4. p6-arch probe + brief-fit over the tree (agent 4): dod.ts probes run over generatedTree file bodies (identifier hits per file), reqTrace mapping. CHECK: regression: tree missing a required capability → gate FAIL lists it; template-only tree fails.
5. Live keyed proof (agent 5 or parent): one bounded keyed journey to P6 → inspect generatedTree: ≥2 files, brief nouns as identifiers across the tree, hashes stable; refuse-path: a deliberately hard brief still lands the deterministic floor + honest refusal. CHECK: quotes in fixes/144_m2.md.
**Exit criteria:** four gates green · generatedTree round-trips · chunked driver unit-tested with fakes · emitted tree with ≥2 real files builds + its oracle tests pass on a live keyed run · fixes/144_m2.md with the live tree listing.
**Sizing note:** 4-6 Flash agent runs with ownership sub-split above; the live proof may need 2 attempts (bounded, real key cost ~1-2 pro synthesis rounds).

---

# MISSION M3 — RUN THE TREE IN LOOP (S-02/T3 = g6 D3) — CLOSES THE FRACTURE
**Goal:** the emitted tree is executed by the engine itself (compile + tests + entry run under the bounded runner) and tree failures flow back into the repair prompts. **The generated thing becomes the run thing.**
**Ownership:** src/lib/compile-check.server.ts (extend — the run half) · src/lib/headless.ts (emit report: add TreeRunOutcome; a `tree-run` verb or --run on emit) · src/lib/codegen.server.ts (repair prompts gain tree-failure context) · src/lib/node-runner.server.ts (reuse — no new sandbox) · scripts/rapidtool-cli.mjs (emit --run surface) · their tests · fixes/144_m3.md.
**Microsteps:**
1. `compileCheckDir` gains a run mode: for each emitted `*.spec.ts`/`*.test.ts` under tests/, execute via the existing runNodeBounded seam with per-file verdicts (compile → tests → run), output caps + hard timeout reused; never fabricate a pass. CHECK: unit tests — a deliberately failing emitted spec yields verdict `fail` with the failure tail; passing spec yields pass; timeout honored.
2. Kind entry run: for library/cli kinds, execute the kind's entry module (a smoke invocation) under the runner; webapp kinds report "UI shell — not executable headless" honestly (no fake run). CHECK: regression per kind.
3. `emit --run` / `tree-run` verb: emit → compile → tests → entry run → one report JSON `{compile, tests, run}` + exit taxonomy. CHECK: live probe on a keyed-emitted tree: npm install NOT required (runner uses the repo's node + strip-types against the tree's tsconfig-independent specs) — verify this claim in the probe and state the honest constraint if npm-install is genuinely required (then the report says so).
4. Failure channel: codegen repair prompts (signature/brief-fit/oracle classes) append the tree-run failure tail (first ~1.5k chars, coded) as context; the oracle-grounding step can cite a failing emitted test by name. CHECK: unit test — a repair prompt for a module whose tree test failed contains the failure text.
5. Determinism + purity regression: tree-run must never mutate the project record (pure verdict + log). CHECK: project hash unchanged after emit --run.
**Exit criteria:** gates green · TreeRunOutcome live-proven on an emitted keyed tree (quote per-file + entry verdicts) · failure text demonstrably enters repair prompts · fixes/144_m3.md.
**Dependency note:** M2's tree must exist for the live proof; M3's runner can be built in parallel with M2's agent 3-4 by a second lane IF ownership is disjoint (compile-check.server.ts vs codegen/engine — they are disjoint; the PARENT may run M2 and M3 as two parallel waves after M1).

---

# MISSION M4 — JOURNEY-LEVEL ITERATE-UNTIL-PASS + COMPLETION GATE (S-03/T4 = g6 D2)
**Goal:** a bounded produce→run→test→repair driver around keyed P6 (+ the phases whose gates fail), and a completion path that REFUSES a clean seal while any FAIL gate stands (or seals with the failure loud + coded, never silent).
**Ownership:** src/lib/headless.ts (the journey driver + completion gate) · src/lib/engine.ts (phase-record FAIL handling + seal path) · src/lib/dod.ts (completion gate helper) · src/lib/store.ts (UI/async driver mirror) · scripts/rapidtool-cli.mjs (run --fix / gate --fix surface) · their tests · fixes/144_m4.md.
**Microsteps:**
1. **Completion gate (small, first):** at seal time, if failedGates(project) is non-empty: outcome "complete-with-failures" + exit code distinct from clean complete (extend the CLI taxonomy 0/1/3/4 with a documented 5? — decide: reuse 1 with a `sealedWithFailures:true` field vs new code; prefer a NEW stable code RT_E_GATES_FAILED with exit 5 documented in README-cli) — and the console + summary already surface the census (M1 keeps it honest). CHECK: regression: red-gate run can no longer present byte-identical output to a clean run.
2. **P6 journey driver (the meat):** bounded loop (budget N=3 produce cycles, configurable): each cycle = synthesize-or-repair (using the recorded refusal class + M3's tree-failure tail as context) → tree-run → verdict; on pass, converge gate + stamp L4 (learned); on budget exhaustion, record FAIL with full evidence + the deterministic floor + honest refusal. Deterministic floor when keyless. CHECK: unit tests with fake synthesis: cycle 1 fails-brief-fit → cycle 2 context contains the failure → cycle 3 passes → gate converges; budget exhaustion → FAIL + floor + no silent seal.
3. **Wild-mode parity:** wildStep may use the driver for P6 when keyed (today wild runs only the deterministic floor — g3 finding) so a keyed wild run can produce the LLM module. CHECK: wild keyed P6 journey produces generatedTree (no key → floor, unchanged).
4. **Driver verb:** `run --fix` (CLI) + store async mirror for the UI. CHECK: live bounded keyed probe — one brief whose first synthesis refuses lands a converged or loudly-failed P6 with the tree-run evidence attached.
**Exit criteria:** gates green · completion gate regression-tested · driver unit-tested with fakes · one live keyed P6 driver probe quoted · fixes/144_m4.md.

---

# MISSION M5 — LEARNING THAT COMPOUNDS (S-05/T5 = g6 D5)
**Goal:** a same-domain run's lessons appear in the NEXT run's plan + codegen prompts (tier 2), packet Ranked-memory is populated (tier 1), promotion is human-gated, wrong lessons decay + can be falsified, and the gain is measurable by M6.
**Ownership:** src/lib/engine.ts (P0 reframe prompt + wild classifier context + L2/L4 content richness) · src/lib/packet.ts (Ranked-memory slot) · src/lib/knowledge.ts (injectProven consumers + counter-evidence + read-time supersede filter) · src/lib/codegen.server.ts (tier-1 lesson injection already at 743-750 — extend content) · scripts/rapidtool-cli.mjs (`lesson` verb family: list/propose/accept/supersede/refute) · their tests · fixes/144_m5.md.
**Microsteps:**
1. **Lesson content richness (fixes/99 finding — rows record THAT something failed, not WHAT was missing):** L2 rows gain `evidence`: the unmet criteria verbatim + the refusal-class code + the tree-run failure tail excerpt (first 300 chars) + the repair that would address it (from M4's driver when it knows). CHECK: a refused keyed P6 journey's lesson row contains the unmet list + class + tail.
2. **Tier-2 injection:** P0 reframe HITL prompt + wild classifier context consume selectLessons(brief) → lessonLinesForBrief (the helper exists — codegen.server.ts uses it; move/export for shared use). Zero-lesson memory keeps byte-identical prompts (regression). CHECK: unit test — prompt builder with a same-domain lesson contains the lesson line; without → byte-identical to legacy.
3. **Tier-1 packet Ranked-memory:** packet.ts Ranked-memory slot seeds from a configured knowledge store via injectProven (knowledge.ts:370-378 — zero consumers today). CHECK: packet test with a configured store shows ranked prior-run lessons; without → empty slot, byte-identical.
4. **`lesson` verb family + human gate:** `lesson list --project` (read-only), `lesson propose` (bounded flash draft of a cross-project row), `lesson accept` (THE only cross-project write, human-gated, records actor), `lesson supersede`/`refute` (counter-evidence bump + read-time supersede filter: superseded rows are filtered at read-back, kept for audit). CHECK: CLI probes for each; only accept writes across projects; refuted lessons stop appearing in read-back but remain in the store.
5. **Decay + falsification counters:** rows carry counterEvidence; read-time weight decay; the M6 runner bumps counters. CHECK: unit tests — a refuted lesson is excluded from read-back; decay changes ranking deterministically.
**Exit criteria:** gates green · lesson content rich on a live refused run · tier-1+2 read-back regression-tested · verb family probed · fixes/144_m5.md.

---

# MISSION M6 — THE MAKER-LOOP EVAL HARNESS (S-06/T6 = g6 D6) — THE SCORECARD + FALSIFICATION GATE
**Goal:** a machine can score brief→software on a fixed corpus and print the maker scorecard; the trend is the falsification gate (90 §5: no improvement by run N ⇒ rip the learning loop out).
**Ownership (mostly NEW files — one-time writes allowed):** research/eval-corpus/*.md (6-8 brief fixtures + expected noun sets/kinds/acceptance from 98_make_1..5 + 99 + the merged Property Ledger) · scripts/run-eval.mjs (driver: create→…→emit per corpus entry, keyed when configured, keyless = floor regression) · src/lib/maker-score.ts (pure rubric M1..M9) · src/lib/dod.ts (advisory p6-maker probe) · fixes/144_m6.md.
**Microsteps:**
1. Corpus fixtures from the six real maker briefs + their expected outcomes (already documented in the dossiers — transcribe). CHECK: each fixture has expected domain/nouns/kind/acceptance + a recorded baseline verdict.
2. `maker-score.ts` pure rubric: M1 substance (tree exists, ≥N real files, reqTrace full) · M2 runs (tree-run pass) · M3 iterates (driver converged) · M4 machine-verifiable (verify passed + hash) · M5 honest (no fake pass, refusal coded) · M6 handover (folder + report) · M7 learning (same-domain run 2 ≥ run 1 on M1-M3) · M8 cost/bounded · M9 on-time/stop-loudly. Each = 0..1 with deterministic inputs. CHECK: unit tests over hand-built projects: each criterion's boundary.
3. `run-eval.mjs`: per entry drive create → (keyed? full live drain with stock-HITL approvals via the driver : keyless drain) → emit to `research/eval-out/<slug>/` → tree-run → score → table printed + JSON. CHECK: keyless run completes on the corpus with honest floor scores; one keyed entry live-probed (bounded cost).
4. `p6-maker` advisory probe + npm script `npm run eval`. CHECK: probe runs, script exits 0 with the table.
5. Baseline recorded in fixes/144_m6.md (the honest 1-3/10 floor) — the target the following waves push.
**Exit criteria:** gates green · eval runs end-to-end keyless · one keyed entry live-probed · baseline scorecard written · fixes/144_m6.md.

---

# MISSION M7 — PRODUCTION PROOF + HANDOFF (the 10/10 attempt)
**Goal:** against the M6 corpus, run the FULL keyed pipeline on the friend's real-estate suite (Property Ledger merged brief — Coffeehouse2Home Phase 4) with M2-M5 all live; score M1..M9; land the best artifact yet in the M1 output folder; write the handoff.
**Ownership:** fixes/145_m7.md + the emitted artifact folder (RapidTool Software/…) · research/eval-out. No src changes unless a NEW defect appears — then it becomes a bounded fix lane first.
**Microsteps:**
1. Run M6 eval keyed across the corpus (bounded budget per entry). 
2. Deep run on the Property Ledger suite brief (real key): create → driver P6 (M4) → tree-run (M3) → verify → P7-P12 with stock HITL approvals → emit to the M1 output folder → npm install + npm test + (kind-appropriate) run in the emitted folder.
3. Score M1..M9 with maker-score; quote every criterion's evidence. 
4. Any RapidTool defect found → log as fixes/145 bugs → bounded fix → re-run that entry. Repeat until the entry's score stops improving or budget exhausts (honest).
5. Write the handoff: the standalone report (how to run, what was verified, honest limits) INSIDE the emitted folder + the fixes/145_m7.md verdict vs the 1-2/10 baseline.
**Exit criteria:** a scored, emitted, verified artifact in the findable folder · the maker delta (baseline → this run) quoted · fixes/145_m7.md.

---

# WAVE ORCHESTRATION (how the parent runs this with Flash fleets)
- **Wave A (parallel, after M1 lands):** M2 agents 1+2 (types/hydrate; chunked driver) ‖ M3 agent 1 (tree-run extension) — disjoint files (engine/types/io vs compile-check.server/headless). M2 agent 3 waits for M2 agent 1-2's types (sequential within M2); OR run M2 as its own 4-agent wave and M3 as a parallel 1-2 agent wave on disjoint files.
- **Wave B:** M2 assembly + p6-arch (agents 3-4) + M3 finish + M4 completion gate.
- **Wave C:** M4 journey driver + M5 (parallel-safe once M2's read-back target exists; M5's tier-2 injection needs M2's content-rich L2 from M4 — sequence M5 after M4's driver lands L4 stamps).
- **Wave D:** M6 eval harness (needs M2-M4 artifacts) + M1's doc fixes can ride along.
- **Wave E:** M7 production proof.
- Parent integrates EVERY wave: gates → fix pins → transcribe capped-agent summaries to their fix logs IMMEDIATELY (the fixes/111 pattern) → dispatch next wave. Between waves the four gates are the checkpoint; a wave that reddens the tree is not complete.

## FOOLPROOFING RULES (the failure modes this plan pre-empts)
1. **Capped agents:** every mission's exit artifact is a fix log + quoted evidence; agents that cap mid-mission leave their anchors + partial state in the log/summary (parent transcribes within the hour).
2. **Anchor drift:** every agent re-greps before patching (dossiers pin ±5 lines).
3. **Determinism:** all new code unit-tested with injected fakes FIRST (no real key in unit tests); live keyed probes are bounded and separate.
4. **The honesty lattice:** no mission may weaken a gate or fake a pass — the eval harness (M6) scores honesty (M5) so regressions are caught mechanically.
5. **Regression law:** the g6 checklist items 1-4 (install/honesty/keyless/keyed-module) stay green at every boundary — any wave that breaks them stops the line.
6. **Cost guard:** keyed probes bounded per run (M2: ≤2 synthesis rounds; M6 keyed: ≤1 corpus entry per run; M7: the deep run has a hard stop after budget) — the DeepSeek key is real and pro-tier synthesis is the expensive call.
7. **The known flakes** (exec grace, watchdog timing) never gate a wave — re-run standalone, document, move on.
