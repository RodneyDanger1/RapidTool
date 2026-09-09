# 94 — Readiness Plan: What-Is-Left, Basic → Big, for 100% Production Readiness

- **File:** `research/multiagent/94_readiness_plan.md` (repo root `C:\Users\mnril\Desktop\RapidTool Main` — NOT a git repo).
- **Date / agent:** 2026-09-06 · Flash **PLANNER A1 (PRODUCT-READINESS GAP)** — **strictly read-only on RapidTool source**; this file is the only output.
- **Mission:** the definitive what-is-left plan from BASIC to BIG for 100% production-ready + truly usable, **accounting for the in-flight Pro wave** (`deleg_ee964d63`, 3 fixers live since 17:13, mid-edit). Their lanes are marked **"PENDING THIS WAVE"** — never re-planned here.
- **Sibling contract:** 95 (competitor-superiority continuation) and 96 (engineering completion checklist: tests/coverage/warnings/docs/stability gates/scorecard) are authored in parallel and own those surfaces. This file owns the **ranked basic→big gap inventory + execution order**. Where an item overlaps a sibling, ownership is flagged inline.
- **0-hallucination rule:** every current-state claim below carries a `file:line` read or grepped this session (2026-09-06 ~17:00–17:30), or is explicitly flagged `[UNVERIFIED]`. One live gate run was executed this session (`npm test`, see B1).
- **Consumes:** fixes/97/98/99 (the wave's specs), fixes/100/101 (wave landing logs), research/multiagent/10 (production pipeline), 13 (top-20 gaps), 86/87/88 (verdicts), 90 (LEAPFROG), 93 (design-flaw ledger DF-01…DF-38), live transcripts `deleg_ee964d63/task-0..2.log`, live designer `deleg_5e66e816` (fixes/109 spec).
- **Effort key:** S ≤ 0.5 day · M 0.5–2 days · L 2–5 days · XL > 5 days. **Impact:** H (gating/trust) / M / L (polish).

---

## §0 TL;DR — the verdict and the one ranked order

1. **The product is 80% built and honest; the remaining 20% splits into three tiers.** BASIC tier is cheap (≤ M effort each) and mostly polish/docs/gate-hygiene. MID tier is the production trust layer (telemetry/watchdog/packaging). BIG tier is the product-differentiation layer (real codegen, streaming, undo, multi-project, closed learning loop).
2. **Two hard reds exist on disk right now:** (a) `npm test` is RED — 10 failures in `scripts/grok-pwa-plugin.test.mjs` (+2 symlink tests), and because the test script chains with `&&`, the entire `src/lib` suite never runs (verified this session, see B1). (b) The **wrong-product P0 defect family** (93 DF-01/02/03/04/05/08) is only partially fixed — Part A landed (previous wave `deleg_77f07ffe`, max_iterations at 15:52), Part B (real brief-faithful codegen) is **landing right now** in the in-flight wave (task-0). Do not re-plan either; both have owners (B1 → 96's lane; Part B → live fixers).
3. **The in-flight wave owns the whole P0/learning/UX-tail seam** (fixes/97+98+99). Everything in §4 G1/G6 and §3 M2/M3 is "pending this wave" with acceptance criteria restated here so the post-wave re-plan has a checklist.
4. **fixes/105 (H2 findings, dead-control re-audit) is NOT on disk yet** (fixes/ dir tops out at 101). fixes/109 (runtime error/telemetry + wild-loop watchdog + `diagnose` verb) **is being designed live** by `deleg_5e66e816` — treat as in-design, build only after it lands.
5. **Recommended single execution order** (rationale in §5):

| # | Item | Tier | Effort | Blocked? |
|---|---|---|---|---|
| 1 | B1 Test gate green end-to-end (fix 10 scripts failures / descope platform chrome) | basic | S–M | no |
| 2 | B7 Install/run story + root README + first-run UX honesty | basic | S–M | no |
| 3 | B2/B3 Dead controls + empty states/labels re-audit (fixes/105 H2 + this file's spot list) | basic | M | no (re-audit now; H2 will extend) |
| 4 | B4 Docs accuracy sweep (AGENTS.md stale Grok contract; README-cli vs 27 verbs) | basic | S | no |
| 5 | B5 Keyboard/a11y audit | basic | M | no |
| 6 | B6 Error-feedback completion (RT_E classify sweep — wave finishes most) | basic | S | wave tail |
| 7 | M5 enforceDod default decision + DF-08 gate-honesty UX | mid | S–M | no (decide; patch after wave) |
| 8 | M6 Packaging/hosting: clean prod build, preview boot check, deploy doc, P9 runbook | mid | M | no |
| 9 | M1 Runtime error/telemetry system + M4 wild-loop watchdog (from fixes/109) | mid | L | **yes — fixes/109 in-design** |
| 10 | M2 chat persistence UI + M3 verification visibility (verify wave lands clean) | mid | S | **yes — wave task-2** |
| 11 | G1 Codegen Part B close-out (liveP6Synthesis, CLI/scaffold wiring, p6-brief-fit live proof) | big | M–L | **yes — wave task-0** |
| 12 | G6 Self-learning loop close-out (lesson injection, writers, report stamps) + P5 truth | big | M | **yes — wave task-1** |
| 13 | G2 Streaming chat + stop button | big | M–L | no |
| 14 | G3 Undo/checkpoint/restore | big | L | no |
| 15 | G4 Project management at scale (workspace export, delete/rename UX, import fidelity) | big | L | no |
| 16 | G5 Multi-project workflows (cross-project learning wiring, reverse-handoff) | big | L | no |
| 17 | G7 Production auth decision (accounts or single-tenant local-first) | big | S–M | no |

---

## §1 In-flight wave ledger (what is landing RIGHT NOW — treat as pending, not open)

**Delegation `deleg_ee964d63`** (3 Pro fixers, live since 17:13:10, status `running`). Ownership is strict per-lane; landing logs are `fixes/100_profix_P0.md` (P-A3) and `fixes/101_profix_loop.md` (P-B3), both append-only.

| Lane | Goal (manifest.json) | On-disk evidence this pass | State |
|---|---|---|---|
| **task-0 — P-A3 "WIRE THE CODEGEN CORE"** | Create `src/lib/codegen.server.ts` (`liveP6Synthesis`) + engine P6 path + verify/wild convergence seams; live-prove a brief-faithful keyed generation passes `p6-brief-fit`; gates green. Ownership: codegen.server.ts (new), engine.ts, sandbox.ts, dod.ts, phases.ts, headless.ts + tests + fixes/100. | `codegen.server.ts` does not exist yet (fixer mid-read of engine.ts:933+ / verify.server.ts / headless.ts). `implementationSpec` already in types.ts:352 (earlier lane). fixes/100 table: P0-01 Part A ✅ (sandbox helpers, dod.ts `p6-brief-fit`, P6 artifact title/HITL copy), Part B ⏳ (codegen.server.ts, headless/CLI wiring, scaffold embed). P0-08 wild packet re-stamp → store.ts autopilot branch ⏳. P0-09 verify `--apply` → headless.ts:980 `applyVerifyOutcome` ✅ (CLI `case "verify"` at rapidtool-cli.mjs:525 ✅). | **PENDING THIS WAVE** |
| **task-1 — P-B3 "FINISH THE LEARNING LOOP"** | prompt-engine.ts lesson injection; vault.ts/harvest.ts lesson writers; report-intake.ts stamps — additive, tested. Ownership: knowledge.ts, vault.ts, report-intake.ts, harvest.ts, prompt-engine.ts + tests + fixes/101. | knowledge.ts largely complete (lessonToEntry, classShort, fusionRank at algorithms.ts:252). fixes/101 still shows `(waiting on 98)` — fixer is mid-analysis; nothing appended yet. | **PENDING THIS WAVE** |
| **task-2 — P-C3 "WIRE THE UX/VERIFICATION TAIL"** | Chat liveness ticker; Oracle-tab verification visibility; RT_E seam completion + inventory test; chatLog UI persistence. Ownership: chat.ts, chat.server.ts, verify.server.ts, errors.ts, algo-tools.ts, crew.server.ts (search seam), report-intake RT_E seam. | Foundations landed by previous wave: `ChatLogRow` type + `store.appendChatRows` (store.ts:74, 525 trim-to-40), chat path already calls `appendChatRows(project.id, [toChatLogRow(userRow), toChatLogRow(turn)])` (console.tsx ≈4455–4560), RT_E codes in errors.ts, honest liveness interim in place. Fixer is tying off the remaining seams + inventory test. | **PENDING THIS WAVE** |

**Live designer `deleg_5e66e816`** (started 17:16:32): writing the **runtime error/telemetry system spec → `fixes/109`** (event taxonomy, capture-point map with file:line anchors, bounded storage, wild-loop watchdog, AI `diagnose` verb). Read-only on source. → **fixes/109 = IN-DESIGN; do not build M1/M4 before it lands.**

**Not on disk yet:** `fixes/105` (H2 dead-control findings) — no analyzer delegation for it is live. B2 therefore carries this file's own spot audit; H2 extends it when it lands.

---

## §2 BASIC tier — ship-tomorrow hygiene (each ≤ M effort)

### B1. Test gate is RED — make `npm test` green end-to-end. *(Hand off detail to 96; decision recorded here.)*
- **Current state:** `npm test` (package.json:12) chains `node --test "scripts/**/*.test.mjs" && node --experimental-strip-types --test "src/lib/*.test.ts" "src/lib/app-data/app-data.test.ts" "src/lib/auth/*.test.ts"`. Executed this session: the scripts leg reports **195 tests, 185 pass, 10 fail** and its non-zero exit short-circuits the `&&` — **the entire src/lib suite does not run**. The 10 failing test names (this session): 80 + 184 (CLI invoked via a symlink) and 89/101/105/106/107/109/110/113 (platform-chrome og-meta injection, head-element injection, case-insensitive `</HEAD>` streaming) — all in the `scripts/**` leg (grok-pwa-plugin suite + CLI harness).
- **Why they exist:** the Grok platform chrome is still LIVE — `vite.config.ts:10` imports `grokPwaPlugin`, wired at `vite.config.ts:167`; `server/middleware/grok-pwa.ts` still present. This is legacy sandbox scaffolding from the repo's Grok origin, not RapidTool product surface.
- **Done / pending / missing:** pending = fix the 10 tests **or** descope the platform chrome from the build and the test gate (single decision, not both). Missing = a `npm run ci` unified gate (spec'd in fixes/99 §5-1) that runs typecheck + full tests + dep scan.
- **Effort/impact:** S–M / **H** (a red gate nullifies every "gates green" claim in this repo).
- **Plan (who/order/rationale):** 96's engineering lane decides chrome fate; if descoped, delete `grokPwaPlugin` from vite.config.ts + server/middleware, and drop the two test globs; if kept, fix the 10 (they look Windows/path/streaming-environment fragile, not product bugs). Then add the `ci` script.
- **Acceptance:** `npm test` exit 0 with all three legs executed and summarized; `npm run ci` exists.

### B2. Dead buttons / controls — re-audit (fixes/105 H2 not landed).
- **Current state:** previous waves swept this partially: `deleg_8063b8af` task-1 ("eliminate every fake/mock/placeholder/dead control", completed max_iterations) + fixes/78_ui_tinyfixes.md. 93's ledger still lists DF-27 (Home CTA silently disabled under 12 chars, console.tsx:1076–1084), DF-29 (run header ≈25 controls, no grouping/progressive disclosure, console.tsx:1616–1947), DF-26 (packet truncation marker has no UI affordance, packet.ts:349–351 vs console.tsx:2274). No `TODO`/`FIXME`/stub markers remain in console.tsx (grep this pass: only `placeholder=` hits — all legit inputs).
- **Done / pending / missing:** pending = H2's fixes/105 register + this spot list (DF-27 counter, DF-29 grouping, DF-26 affordance). Missing = an inventory test that walks every button/control in console.tsx and asserts a non-no-op handler.
- **Effort/impact:** M / M.
- **Plan:** one UI fixer: enumerate controls, kill-or-wire, add the console control-inventory test. After fixes/105 lands, reconcile against H2.
- **Acceptance:** every `<button>`/tab/action in console.tsx has a wired handler or is removed; no disabled-without-guidance controls (DF-27 fixed with a live char counter).

### B3. Empty states + labels.
- **Current state:** empty states are broadly present (home builds list console.tsx:1107–1110; artifacts search 2248–2251; lattice 2301; phase artifacts 2844; design 3900; phase-0 4854; oracle no-cases ≈2332–2336). Labels exist on the brief textarea (console.tsx:1064–1066) and approval-note textarea (contextual ≥12-char label per fixes/99 §3.1 spec, landed in the P0 wave).
- **Done / pending / missing:** missing = a systematic empty-state checklist across all 9 tabs + HITL dock + memory sidebar (each tab: present? actionable? points at the next legal action?).
- **Effort/impact:** S / L–M.
- **Plan:** fold into the B2 UI fixer's sweep; each empty state must name the action that fills it.
- **Acceptance:** table of 12+ surfaces × empty-state present + actionable = ✓.

### B4. Docs accuracy (root README missing; AGENTS.md stale; README-cli vs 27 verbs).
- **Current state:** **no root README.md exists** (repo root listing this pass; only `scripts/README-cli.md`). `AGENTS.md` (18,904 B) is the **stale Grok sandbox contract** — literally opens "You are Grok Build, in an isolated Linux sandbox" and references `/workspace` and `imagine_*` tools that do not exist here. `AGENT_GUIDE.md` is RapidTool-real but its honesty contract ("DoD gates are advisory — they never block a run") will need refresh after the enforceDod decision (M5). **README-cli.md verb claim verified accurate on disk:** it documents **27 subcommands** and `rapidtool-cli.mjs` has exactly **27 `case "` arms** (grep counts this pass: 27/27). Option-level accuracy (flags, exit codes per verb) has not been diffed this pass `[UNVERIFIED]`.
- **Done / pending / missing:** missing = root README (what it is, install, run, 27-verb pointer, honesty contract, deploy). Missing = AGENTS.md rewrite-or-delete (it misinforms every future agent). Pending = doc-vs-implementation diff script for README-cli (each documented flag exists in the case arm; each arm documented).
- **Effort/impact:** S / M–H (AGENTS.md actively misleads agents).
- **Plan:** docs lane (could be me/96's sibling): root README first, AGENTS.md replace with a pointer to AGENT_GUIDE.md + README, then the README-cli diff check as a script test.
- **Acceptance:** `AGENTS.md` no longer mentions Grok/`/workspace`; root README.md exists with install/run/deploy; README-cli diff test green.

### B5. Keyboard + a11y audit.
- **Current state:** keyboard shortcuts EXIST — console.tsx:992 ("Keyboard shortcuts" section), global run-loop shortcuts at 1211–1243, an onKeyDown path at 1631. a11y basics present: tabs carry aria-label (2153), wild strip has role=status/alert/region (777–856), switch has role+aria-checked (553–554).
- **Done / pending / missing:** missing = a real audit: every interactive control reachable/focusable, visible focus rings, aria-labels on icon-only buttons, contrast on the faint text tier, shortcut sheet accuracy (does every listed shortcut work?).
- **Effort/impact:** M / L–M.
- **Plan:** one UI QA pass (browser tools per repo convention); fix top findings; add a Shortcuts modal accuracy test.
- **Acceptance:** tab-through of Home + Run console reaches every control; zero icon-only buttons without aria-label; shortcuts modal matches handlers.

### B6. Error feedback completion.
- **Current state:** strong foundation: error-component.tsx (router boundary, 500-char message cap), chat rows carry `RT_E_*` codes + error badges (console.tsx:4215–4221, 4410–4414 `RT_E_INTERNAL` fallback), errors.ts is the machine-code registry, notice/toast system in console.tsx (sonner).
- **Done / pending / missing:** pending = the fixes/99 §6 classify-string sweep + RT_E inventory test (wave task-2). Missing after that = a lint-style test asserting every surfaced failure path carries an RT_E code.
- **Effort/impact:** S / M.
- **Plan:** finish with task-2; then the follow-on enforcement test (99 §6.1).
- **Acceptance:** every user-visible failure (chat, crew, verify, wild, deepen, ingest) renders a code badge or code string; inventory test enumerates the RT_E universe.

### B7. Install / run story + first-run UX.
- **Current state:** npm scripts are complete and env-safe: `dev`/`build`/`preview` route through `scripts/with-app-env.mjs` (port 8080, `VITE_AUTH_ENABLED` carrier), `db:migrate` runs inside `build`, `startup.sh` is the restart contract, `typecheck`/`lint`/`check:auth` exist (package.json:8–18). First-run UX: HomeScreen (console.tsx:1015) — brief textarea + 4 ops templates + builds list + `seedIfEmpty()` demo project (console.tsx:1021–1028). `.env.example` exists.
- **Done / pending / missing:** missing = a root README quickstart (see B4) and the DF-28 honesty fix: the auto-seeded demo project is presented as a build (93: DF-28, templates.ts:1–26, store.ts:1163–1178) — label it "sample/demo" or replace seeding with a guided empty state.
- **Effort/impact:** S–M / M.
- **Plan:** docs lane for README; UI fixer for DF-28.
- **Acceptance:** a new user follows README → `npm run dev` → creates a project in ≤ 2 actions; demo seed is visibly labeled sample, not build.

---

## §3 MID tier — the production trust layer

### M1. Runtime error / telemetry system. *(fixes/109 — IN-DESIGN)*
- **Current state:** no unified runtime telemetry exists. Pieces that will feed it: RT_E codes (errors.ts), tracing.ts (wave-3), chat/crew/verify honest failure envelopes, gate diagnostics JSON (one event per orchestration step, engine.ts:565), store salvage/quota-caps (store.ts:525–568), `.vercel` hosting.
- **Done / pending / missing:** missing = everything fixes/109 specifies (event taxonomy, capture-point map, bounded storage, `diagnose` verb). **Do not build until the spec lands** (designer `deleg_5e66e816` live).
- **Effort/impact:** L / H (this is the observability backbone for production support).
- **Plan:** after fixes/109 lands → one Pro lane implements core (taxonomy + capture + bounded ring storage + CLI `diagnose`), one Flash lane wires UI surface (diagnostics tab / error drawer). Order after packaging (M6) so capture points include deploy context.
- **Acceptance:** every engine/store/server failure path emits a typed event; `rapidtool-cli.mjs diagnose` renders a ranked, actionable trace; storage bounded (ring + cap, per spec).

### M2. Chat persistence UI. *(wave task-2)*
- **Current state:** data layer done (ChatLogRow, store.appendChatRows, trim-to-40 store.ts:525); UI append already wired (console.tsx ≈4455–4560, "Every path lands here — appendChatRows(...)"); persistence survives reload via store hydration.
- **Pending this wave:** task-2 final wiring + tests.
- **Acceptance (restated for post-wave check):** send N turns → reload → history intact (≤ 40 rows); error turns persist with codes; empty state when no rows.
- **Effort/impact:** S / M. **Plan:** verify wave lands clean; re-open only on test failure.

### M3. Verification visibility (Oracle tab + verify loop). *(wave task-2)*
- **Current state:** Oracle tab exists (RunTab includes `"oracle"`, console.tsx:105; tab renders name/given/expect ≈2321–2336) but shows **no verdicts** (93 DF-15); verify-fix machine loop exists (verify.server.ts:503 `verifyAndFixServer`) but is invisible in UI (93 DF-16).
- **Pending this wave:** task-2 wires Oracle-tab verification visibility (verdicts per case) + the verify surface.
- **Acceptance:** each oracle case shows its live run verdict (pass/fail/not-configured) with evidence; a run button executes machine verification from the tab; RT_E-coded failures.
- **Effort/impact:** S / H (verification is the product's trust axis, 90 §Axis-2).

### M4. Wild-loop watchdog. *(part of fixes/109 spec)*
- **Current state:** wild runs are bounded by steps only (engine.ts:2145/2487 "P13 bounded autonomous step"; CLI `wild --steps 24` cap at rapidtool-cli.mjs:119); pause/resume/stop exist; `hydrateWildRun` forces stale runs to `stopped` on reload (engine.ts ≈1560–1566). **No wall-clock/cost watchdog, no runaway-loop detector, no machine-readable pause code in UI** (93 DF-23: wild strip renders pauses without the code).
- **Plan:** build from fixes/109's watchdog section (in-design). Interim (before 109): DF-23 code display is a one-line UI fix — do it in B2's sweep.
- **Acceptance:** a wild run that exceeds step/clock/cost bounds self-pauses with an RT_E code surfaced in the strip; `diagnose` explains it.

### M5. enforceDod default decision.
- **Current state:** `enforceDod` exists but defaults **OFF** — engine.ts:1270 `enforceDod: false` (emptyProject); store branches at store.ts:305/357–370/488; `setEnforceDod` toggle at store.ts:701 + tests store.test.ts:838–843, 926. Gates are advisory by default; a FAIL-gated phase still advances under autopilot (93 DF-08: store.ts:360–401, console.tsx:2460–2462). fixes/97 P0 covers the honesty half; the default is still a decision nobody has made.
- **Decision (recommended):** default ON for every machine-driven advance (autopilot, wild, CLI `gate --autopilot`), OFF only for manual human `approve` overrides — the "trust wave" position of 90 §6-P0. Keeps the human escape hatch while killing silent FAIL advancement.
- **Effort/impact:** S–M / H.
- **Plan:** decide in the post-wave consolidation (not now — the wave is mid-edit in engine/store); one fixer flips the default + updates the 3–4 test pins that assume OFF; AGENT_GUIDE.md honesty contract refreshed (B4).
- **Acceptance:** no FAIL-gated phase can be left by an autopilot/wild/CLI-autopilot advance without an explicit human note; manual override still possible with ≥12-char note (P0-06).

### M6. Packaging / build output / hosting story.
- **Current state:** `npm run build` = `vite build` + `db:migrate` (package.json:9); nitro preset **vercel** wired (vite.config.ts:8, 172–173); a `.vercel/output` build exists on disk (built Sep 6 16:52 — config.json/functions/nitro.json/static). `migrate.mjs` runs against `DATABASE_URL` on deploy, PGLite fallback locally (scripts/migrate.mjs:1–18). P9 CI/IaC is still static sketches (engine.ts:579–623; 10-doc E5 unbuilt); no release-bundle materializer (10-doc E3); no deploy documentation.
- **Done / pending / missing:** pending = a clean-slate `npm run build` + `npm run preview` boot check this session was NOT run (build while fixers edit engine.ts is invalid — do it post-wave). Missing = deploy README section (Vercel + env vars: DEEPSEEK_API_KEY, TAVILY, DATABASE_URL), P9 honest runbook artifact, E3 bundle.
- **Effort/impact:** M / H (production = deployable + documented).
- **Plan:** post-wave: fresh build → preview smoke (browser) → write deploy doc → E3/E5 as their own lane.
- **Acceptance:** clean `npm run build` exits 0; `npm run preview` boots and renders HomeScreen; deploy doc walks env setup to a live URL; P9 artifact names a real host path, never an unimplemented claim (P0-04 rule).

---

## §4 BIG tier — the product-differentiation layer

### G1. Codegen Part B — real brief-faithful P6. *(wave task-0)*
- **Current state:** the P6 "wrong product" defect (93 DF-01: sandbox.ts:125–161 phase-gate simulator) has Part A fixed (dod.ts `p6-brief-fit` probe, engine P6 title/HITL copy — fixes/100 table). Part B — `codegen.server.ts` (`liveP6Synthesis`), engine P6 path, verify/wild convergence, headless/CLI wiring, scaffold embed — is **being created right now** by P-A3.
- **Acceptance (restated for post-wave):** a keyed generation for a brief emits source that (a) references the brief's entities/verbs (p6-brief-fit passes), (b) degrades honestly to the deterministic template when DEEPSEEK is unconfigured, (c) passes the existing sandbox self-test path, (d) gates stay green.
- **After the wave:** Part B's residual = scaffold-embed fidelity + the p6-brief-fit live proof harness in CI (if P-A3 doesn't finish both, they slot here — check fixes/100's final table).
- **Effort/impact:** M–L / **H** (the single biggest "wrong product" complaint across 86/87/88/93).

### G2. Streaming chat + stop button.
- **Current state:** chat is one-shot, non-streamed, no abort — `deepseek.server.ts:233` `stream: false`; no stream/abort matches in chat.ts (grep this pass). 93 DF-12. fixes/99 §2 carries the **bounded typed-stream design + interim plan** (web-verified 2026-09-06): interim = honest "thinking…" liveness (already landed); then chunked SSE/stream with a typed parser and a Stop button.
- **Done / pending / missing:** missing = backend stream mode + client consumer + Stop (AbortController) + persistence of streamed turns.
- **Effort/impact:** M–L / H (chat feels broken without it; 42-rank #1).
- **Plan:** one backend lane (deepseek.server.ts stream option + chat.server.ts pass-through) then one UI lane (chunked render, stop, RT_E on abort). Follow fixes/99 §2 exactly — it's already the build spec.
- **Acceptance:** tokens render incrementally; Stop cancels within the turn and persists a coded `RT_E_ABORTED`-style row; not-configured path unchanged.

### G3. Undo / checkpoints / restore.
- **Current state:** NONE user-facing. 93 DF-06 (P4 "durable checkpoint" artifact claims persistence that no layer provides — engine.ts:384–386 vs store.ts:1180–1206) and DF-10 (no undo anywhere; ledger append-only; engine.ts:2033). store.ts has an internal pre-run snapshot only for last-writer-wins concurrency (store.ts:111–114), not a user surface. Honest framing line exists at engine.ts:467 ("no durable checkpoint layer").
- **Done / pending / missing:** missing = phase-scoped checkpoint stack (snapshot Project before each `wildStep`/`execute`/`approve`), a bounded undo ring, a UI restore affordance, and the DF-06 copy fix (either implement or strike the claim — P0-04's declare-or-strike rule applies).
- **Effort/impact:** L / H (competitor-parity: Gemini CLI checkpointing, per 93).
- **Plan:** after G1/G6 close (store churn settles): one lane implements checkpoint+undo in store/headless with tests; one lane wires the UI (undo button in HITL dock + diagnostics). DF-06 copy fix belongs to the P0 lane NOW if the wave misses it.
- **Acceptance:** undo restores a prior phase state exactly (deterministic, hydration-safe); ring bounded (e.g. last 10); ledger entries for restores (paper-trail axis unbroken).

### G4. Project management at scale.
- **Current state:** multi-project data exists (store.ts:55 `projects: Project[]`, activeId, select/create/import; home builds list console.tsx:1103–1133). Per-project import/export exist in UI (console.tsx:1527–1577) and io.ts (`exportProjectJson`/`importProject` with 10 MB cap io.ts:31, validation-first io.ts:56–66, 13-phase strict). Missing: **workspace-level export/import bundle** (all projects + knowledge in one artifact), project **delete/rename/duplicate UX** (clone exists in store B-08), import **fidelity-at-scale proof** (10 MB payload, 13 phases × many artifacts round-trip lossless).
- **Done / pending / missing:** as above.
- **Effort/impact:** L / M.
- **Plan:** one lane: workspace bundle format + delete/rename/duplicate UI + a scale fixture test (generate max-size project, export → import, deep-equal modulo hydration repairs).
- **Acceptance:** 10 MB project round-trips byte-faithful on every Project field (or documents every intentional normalization); delete has a confirm; rename updates packet/title references.

### G5. Multi-project workflows.
- **Current state:** the learning pillars (knowledge/harvest/bench/ast-mine/watcher) are **CLI-only and unwired to any run** (93 DF-24; headless.ts:1476–1483). knowledge.ts (cross-project pattern store, Pillar 11) exists and is complete at the store level; `watcher.ts` reverse-handoff is opt-in only (watcher.ts:1–14). Six handoff profiles landed but never wired (93 DF-25: packet.ts:434–600 vs console.tsx:1507).
- **Done / pending / missing:** missing = wire knowledge retrieval INTO engine runs (cross-project lesson injection), wire handoff profiles into the UI, surface watcher activity, crew multi-project context.
- **Effort/impact:** L / M–H (the "compounds per run" axis 90 §Axis-5 depends on it).
- **Plan:** after G6 closes the loop mechanics: one lane wires retrieval at phase boundaries (prompt-engine + engine cases), one lane wires profiles + watcher notes UI.
- **Acceptance:** a run on project B retrieves and applies lessons scored from project A; handoff profile picker functional; no pillar remains CLI-only.

### G6. Self-learning loop completion. *(wave task-1)*
- **Current state:** loop core landed (knowledge.ts: capture/store/retrieve/evaluate/evict; fusionRank algorithms.ts:252). P5 still titled "…& Self-Learning" while the loop wasn't real (93 DF-20; phases.ts:44–50 — title fix is P0-04's). Task-1 is landing: prompt-engine lesson injection, vault/harvest lesson writers, report-intake stamps.
- **Acceptance (restated for post-wave):** lessons captured from a report-intake → persisted → retrieved and injected into the next prompt expansion → evaluated/evicted; P5 title/copy truthful; every step tested (fixes/101 table filled).
- **Effort/impact:** M / H (90 §Axis-5).

### G7. Production auth decision.
- **Current state:** better-auth + src/lib/auth/ fully wired at the lib layer (client, email-password, gate middleware, PGLite dialect, tests) and `check:auth` script exists — but **no auth UI routes** (grep this pass: no login/signIn in src/routes) and `src/lib/app-data` (Grok viewer-connector gate) is imported by nothing in routes/console. Auth is latent infrastructure.
- **Decision (recommended):** local-first single-tenant now (auth stays latent, documented), accounts later — matches RapidTool's anti-cloud positioning (90 §Axis-2). Do NOT ship a half-surfaced login.
- **Effort/impact:** S–M / M.
- **Plan:** document the decision in README; only if accounts are chosen, a dedicated lane wires the auth UI + server functions.
- **Acceptance:** README states the auth posture honestly; no dead auth artifacts presented as features.

---

## §5 The single recommended execution order — rationale

1. **Gate first (B1).** Every other item's "gates green" acceptance depends on a green gate. It's S–M effort and unblocks honest status reporting for the wave itself.
2. **Docs + run story next (B7/B4).** These are S effort, no code churn, and they immediately convert "built but unusable" into "usable" for humans AND agents (the product's second customer). B4's AGENTS.md fix is urgent: it actively misleads every future agent in this repo.
3. **UI hygiene (B2/B3/B5/B6)** — M effort, wave-independent (the wave doesn't touch console.tsx's home/header shells except chat/oracle areas; coordinate: B2's sweep must NOT collide with task-2's console.tsx edits — schedule B2 after the wave lands).
4. **MID tier after the wave:** M5 enforceDod (small, needs engine/store quiescence) → M6 packaging (needs green build + green tests) → M1/M4 telemetry+watchdog (needs fixes/109) → M2/M3 verification of wave output.
5. **BIG tier:** G1/G6 close-out immediately post-wave (the fixers' logs + fixes/100/101 final tables ARE the spec of what's left) → G2 streaming (independent, high perceived value) → G3 undo (depends on settled store semantics from the wave) → G4/G5 (scale + compounding, last because they build on a stable loop) → G7 auth decision (parallelizable, low urgency).
6. **Wave-coordination rule:** nothing in this plan may edit `src/lib/engine.ts`, `store.ts`, `dod.ts`, `phases.ts`, `sandbox.ts`, `headless.ts`, `chat*.ts`, `verify.server.ts`, `errors.ts`, `knowledge/vault/harvest/report-intake/prompt-engine.ts`, or `console.tsx` chat/oracle regions while `deleg_ee964d63` is `running` (its ownership is strict; collisions = lost work). The wave's own "gates green" mandate is the final gate for items 9–12.

## §6 Post-wave re-plan triggers + scorecard handoff

- When the wave completes: re-verify B1's src/lib legs actually run green, re-read fixes/100/101/102 final tables, then flip each "PENDING THIS WAVE" item to done-or-replan against this document (this file IS the re-plan checklist).
- 96 owns the engineering scorecard (coverage %, warnings, scripts-leg, stability gates); 95 owns the competitor-superiority continuation. Cross-references: 95 G-items build on 94 G1–G6 landing; 96's B1/B4 overlap is recorded above.
- Hard acceptance for "100% production-ready": **B1–B7 all green + M1–M6 landed + G1–G6 landed (G7 = documented decision)** — with every user-visible claim passing the declare-or-strike rule (P0-04) and every failure carrying an RT_E code.
