# thoroughanalysis.md — the deep audit of RapidTool (W25 · 4 lanes, one shared log)

<!-- ============================================================================
PROTOCOL — READ THIS BEFORE WRITING ANYTHING IN THIS FILE. Four audit lanes share
this one log. Obliteration is the failure mode, and this protocol prevents it:

1. APPEND-ONLY VIA THE END-MARKER. The LAST line of this file is a unique HTML
   comment marker. To add findings, use the patch tool with:
     old_string = the marker line (exact)
     new_string = <your findings text>\n\n<the same marker line, unchanged>
   NEVER rewrite the file, never edit another lane's section, never touch the
   marker's own text. Corrections to a previous finding = a NEW finding that
   cites the old ID (e.g. "A2-f04 CORRECTS A1-f07: …").
2. READ BEFORE WRITING. Sibling lanes append concurrently; if a write reports the
   file changed since you read it, re-read and re-append (your text is additive —
   re-appending loses nothing).
3. YOUR IDs. A1-fNN for lane A1, A2-fNN for A2, A3-fNN, A4-fNN. Never renumber.
   Never reuse an ID even if you delete nothing (you delete nothing).
4. EVIDENCE BAR. Every finding needs: file:line (read today) or a command's real
   output; a severity; and a concrete proposed fix. "COULD-NOT-TRACE + where I
   stopped" is a valid finding — a guess is not.
5. NO KEYED CALLS (the DeepSeek account is unfunded — all calls 402). No full-gate
   runs (sibling lanes are mid-edit — the repo rule). Targeted read-only commands
   are fine.
============================================================================ -->

## THE MISSION — the standard every finding is measured against

RapidTool must be **a truly autonomous software factory / AI agentic harness**: given a brief and a
DeepSeek API-keyed model, it creates software **with GOOD code — not bad code** — and it must be able to
make **any kind of software or thing: games, websites, programs, applications, tools, and more.** It must
**continuously improve / refactor / enhance** what it produces, and the software it produces must have
**perfect UI/UX**. Audit accordingly: a defect is anything — code, wiring, process, template, UI, honesty
surface, or missing capability — that stands between RapidTool and that standard.

---

## A1 — THE FACTORY CORE (engine, phases, gates/DoD, P6 keyed synthesis, codegen/emit, tree-run, mint)
<!-- Append A1-fNN findings below. Each: ID · area · severity (P0–P3) · evidence (file:line or command) ·
     why it matters vs THE MISSION · proposed fix · verification path. -->
_(A1 findings start here)_

## A2 — THE HARNESS MECHANICS (CLI verbs, run-eval + M1–M9, gate scripts, guards, telemetry, budgets, error classes)
<!-- Append A2-fNN findings below. Same shape as A1. -->
_(A2 findings start here)_

## A3 — OUTPUT QUALITY + UNIVERSALITY (what it EMITS: code, specs, tests, READMEs, the emitted app's UI/UX; games/web/apps/tools)
<!-- Append A3-fNN findings below. Same shape as A1. -->
_(A3 findings start here)_

## A4 — RAPIDTOOL'S OWN UI/UX + DOCS (console, routes, flows, honesty surfaces, onboarding for beginner AND agent)
<!-- Append A4-fNN findings below. Same shape as A1. -->
_(A4 findings start here)_

## C1 — CODE CLEANERS I · bad/poorly-written code + wiring/calls/errors in THE RUNTIME CHAIN
<!-- Append C1-fNN findings below. Same shape as A1 (ID · area · severity · evidence file:line read today ·
     why vs mission · fix · verify). Focus: poorly written code, broken/mismatched wiring, wrong calls,
     error-causing patterns — not feature gaps (that is A1–A4's). -->
_(C1 findings start here)_

## C2 — CODE CLEANERS II · bad/poorly-written code + wiring/calls/errors in THE PERIPHERY + UI
<!-- Append C2-fNN findings below. Same shape. Scope: scripts/**, src/lib/llm/**, console/routes,
     docs' code examples. -->
_(C2 findings start here)_

## C3 — BUG HUNTER H1 · crash-class + work-prevention in the runtime chain (findings; fixes logged in fixes/266_lane1_bugs.md)
<!-- Append C3-fNN rows below. Row shape: ID · file:line (read time) · PROOF (command+output or byte fact) ·
     fix (before→after) · re-check. -->
_(C3 rows start here)_

## C4 — BUG HUNTER H2 · harness/handoff/delegation crash-class (fixes/266_lane2_bugs.md)
<!-- Append C4-fNN rows below. Same shape. -->
_(C4 rows start here)_

## C5 — BUG HUNTER H3 · provider/LLM + *.server.ts + telemetry crash-class (fixes/266_lane3_bugs.md)
<!-- Append C5-fNN rows below. Same shape. -->
_(C5 rows start here)_

## C6 — BUG HUNTER H4 · UI/routes crash-class + doc-example reality gap (fixes/266_lane4_bugs.md)
<!-- Append C6-fNN rows below. Same shape. -->
_(C6 rows start here)_

**A4 LANE (RapidTool's own UI/UX + docs) — read window 2026-09-26 15:35→15:48 local.** `console.tsx`
churned 6369→6537 lines across 5 hashes while W24-U1 edited it; `__root.tsx` churned under W24-U2. Every
anchor below is stamped with its read time; the final verification sweep was 15:48:04, `console.tsx`
md5 `fa6aa7965a71b7c8b1afa1c01d36d2db` (6537 lines). Re-grep anchors before patching. Two candidates were
OBSOLETED mid-audit by sibling fixes (A4-x01/x02, recorded at the end, no action owed).

**A4-f01 · HONESTY (self-description) · P1 ·** Every surface calls RapidTool an "autonomous software agency"
while the product's own truth surface says it is not.
- Evidence (read 15:42–15:48): `src/components/console.tsx:1643` home tagline (`autonomous software agency`,
  md5 `fa6aa79…`); `src/routes/index.tsx:7` meta title "RapidTool — autonomous software agency";
  `src/routes/__root.tsx:41` meta description "RapidTool is an autonomous software agency. …" (md5 `a911139…`).
- Counter-truth: `src/lib/doctor.test.ts:28-30` pins `autonomousSoftwareFactory === false` for RapidTool-now;
  README.md:15-18 "RapidTool is **not yet** an autonomous software factory"; `console.tsx:1421` (in-app Guide,
  section "What RapidTool is"): "It does not build software itself".
- Why vs mission: the mission demands a truly autonomous factory — until `doctor` says true, declare-or-strike
  forbids the claim; it sits on every browser tab + the home header a beginner sees first.
- Fix: reword to a true descriptor (“governed delivery harness — brief → audited 13-phase run → Agent Packet”)
  or render the phrase from the doctor claim. Owners: U1 (console), U2 (routes).
- Verify: `grep -rn "autonomous software agency" src/` → 0 hits; `doctor` keeps printing false.

**A4-f02 · LABEL vs EFFECT · P2 ·** The fixtures loader's honesty label promises an approval no surface implements.
- Evidence (read 15:38 + 15:45): `src/lib/fixtures.server.ts:25-26` LOAD_LABEL "…**approving here records a
  decision**, it does not modify the bar" (same string in `fixtures.review.ts:36` fallback), rendered verbatim at
  `console.tsx:490`; U1's new paragraph at `console.tsx:493-497` says "no approve/reject control is wired yet,
  so nothing here can record a decision". The store has no fixture action (`fixes/263_lane5_ui_console.md` §3
  registers it as owed); the only real flip is CLI `fixtures --approve --ids` (`brief-fixtures.ts:588`
  `approveFixtureCases`, called at `scripts/rapidtool-cli.mjs:983-1000`).
- Why vs mission: same screen asserts two opposite things; a label must describe an effect the code can deliver.
- Fix: rewrite LOAD_LABEL (both files) to the truth — e.g. "read-only review — approval is a CLI action
  (`fixtures --approve --ids …`); this view records no decision". `fixtures.server.ts` is outside U1's file box.
- Verify: reload the Eval-fixtures tab — label and panel paragraph agree; `grep -rn "approving here" src/` → 0.

**A4-f03 · HONESTY/VOCABULARY · P2 ·** The highest-stakes control in the UI names a "sandbox" the docs say does
not exist.
- Evidence (read 15:45–15:48): `console.tsx:3773` override checkbox "I reviewed the failing **sandbox** output and
  approve anyway."; `console.tsx:1503` SHORTCUTS "a failed **sandbox** gate needs the override tick first";
  `console.tsx:1965` the `a`-key error repeats it. Against: `console.tsx:262` in-file rule "NEVER \"sandbox\"
  (E-03/E-21)"; README.md:118-120 "**No real isolation** … it is **not** a sandbox — Doctor says `sandbox: false`,
  and nothing may claim otherwise"; AGENT_GUIDE.md:83. The engine's P4 copy is careful ("Engine-template runner
  (bounded…)") but its stakes line (`engine.ts:801`) still says "Sandbox and authorization boundary".
- Why vs mission: a beginner ticking that box believes an OS sandbox failed; a jargon term appears undefined at
  the exact point a human decision is made.
- Fix: reword the three console strings to "bounded-runner self-test output" (or add `TERMS["runner"]` + `<Term>`),
  and align `engine.ts:801`'s stakes line (A1's lane).
- Verify: `grep -n "sandbox" src/components/console.tsx` → only comments + `project.sandbox` field reads; the
  checkbox reads bounded-runner.

**A4-f04 · DOCS CONTRADICT THE PRODUCT · P1/P2 ·** "It does not build software itself" vs the P6-synthesis +
tree-run story.
- Evidence (read 15:35–15:48): AGENT_GUIDE.md:4-7 + :52-54 ("RapidTool is a deterministic, governed **pre-flight
  compiler**: it does not build software itself… P6 is a bounded *template self-test*… The **real** code is yours
  to write"), reproduced in the in-app Guide `console.tsx:1421`. README.md:71-74 "Synthesis: P6 asks a model for
  module code in signature-bound chunks, then compile-checks and runs each job module's own oracle";
  README.md:95 "tree-run = the product builds and tests ✅".
- Why vs mission: AGENT_GUIDE is the agent's mandatory read and the Guide dialog is the beginner's; both are told
  the tool does not build software while the capability table says it does. Neither reader can tell what the
  P6-synthesized module actually is.
- Fix: ONE reconciled story with a verified census (see A4-f11): e.g. "emits + verifies a real module set through
  P6 synthesis (census: <verified>); breadth beyond the reference corpus is limited by <X>".
- Verify: the corrected sentence's census reproduces via `node scripts/rapidtool-cli.mjs doctor --tree <fresh
  keyless emit>`.

**A4-f05 · DOCS / AGENT ONBOARDING · P2 ·** AGENT_GUIDE says there is no feedback channel; the product ships `ingest`.
- Evidence (read 15:35, md5 `d3a3034…`): AGENT_GUIDE.md:69 "RapidTool has no live LLM/research/sandbox feedback
  channel (client-side, localStorage-only)"; §2 step 4 "Import the resulting report JSON **if the app offers it**"
  — it does: CLI `ingest` (`scripts/rapidtool-cli.mjs:680`; README-cli.md:80-83, :933) and the console's Ingest
  report panel (`console.tsx:2834-2837` toggle, `:2138` `onIngestReport`, textarea ~`:2900-2927`), plus crew
  artifact ingestion (`console.tsx:2158-2182`).
- Why vs mission: the guide is how an agent learns to close the loop; omitting the one verb that does it pushes
  agents to hand-copy into Notes.
- Fix: rewrite AGENT_GUIDE §4 item 1 to name `ingest --report …` (CLI) and the console's Ingest report panel,
  keeping the localStorage caveat.
- Verify: grep AGENT_GUIDE for `ingest` ≥1 hit; the documented path runs keyless.

**A4-f06 · ONBOARDING (beginner) · P3 ·** The first screen offers no help entry and hides the 12-char minimum.
- Evidence (read 15:35 + 15:48): HomeScreen (console.tsx ~1508-1608 at first read) renders the brief box,
  templates and Builds only; `Guide/Settings/Shortcuts` buttons render ONLY in RunScreen's header
  (`setGuideOpen(true)` hits at console.tsx:1983 — `?` shortcut — and :2563 — header button; no Home occurrence).
  Launch is `disabled={brief.trim().length < 12}` (console.tsx:~1676) and `launch()` silently returns under 12
  (:1629) — no visible reason.
- Why vs mission: beginner onboarding must be self-explanatory; a disabled primary button with no hint + help one
  click deeper (after creating a build) is the dead end the Guide exists to prevent.
- Fix: add a "How it works" button on HomeScreen reusing `GuideDialog`; add a hint line under the launch button
  ("briefs need 12+ characters — the button unlocks then").
- Verify: open `/` — help affordance present; type 5 chars — hint visible; create still gated at 12.

**A4-f07 · ORGANIZATION/DOCS (risk) · P3 ·** The app's manifest link is served only by legacy scaffolding the repo
declares non-contract.
- Evidence (read 15:43–15:47): `src/routes/__root.tsx:48` `<link rel="manifest" href="/__grok/manifest.webmanifest">`.
  `find public -iname "*manifest*"` → nothing (15:42): the path is served dynamically by
  `server/middleware/grok-pwa.ts:73` (prod; registered because vite.config.ts sets `serverDir: "./server"`) and
  `scripts/grok-pwa-plugin.mjs:55` (dev). AGENTS.md §Legacy scaffolding calls `server/` middleware + `.grok/`
  "stale scaffolding … **not the contract**", fate undecided (94 §B1 / 96). The same middleware also injects PWA/OG
  head tags.
- Why vs mission: a load-bearing dependency on code marked for possible deletion; if 94 §B1 axes it the head link
  dies silently. README documents no PWA/install capability either way.
- Fix: record the dependency explicitly in 94 §B1/96, or promote the manifest to a static `public/` file (with a
  test), or drop the link + install flow deliberately.
- Verify: `grep -rn "manifest.webmanifest" src/ server/ scripts/` shows one coherent owner; dev + prod both 200.

**A4-f08 · DOCS CONTRADICT EACH OTHER · P2 ·** ".env enables LLM-backed phases" vs "the CLI does not load .env".
- Evidence (read 15:35–15:45): README.md:45 "Environment: `DEEPSEEK_API_KEY` in `.env` enables LLM-backed phases
  (P6 synthesis, Chat, expansion)" — directly under the CLI quickstart; scripts/README-cli.md:231-233 "Keys are
  read from `process.env` only (the CLI does **not** load `.env` — export them in the shell, or use `.env`-loading
  tooling around the CLI)."
- Why vs mission: a beginner following the README quickstart puts the key in `.env`, runs the CLI verbs, gets
  keyless skips, and concludes the tool is broken. Two onboarding docs must not disagree on the setup step.
- Fix: split the sentence — "Browser app (`npm run dev`): key in `.env`. CLI: export `DEEPSEEK_API_KEY` in the
  shell (the CLI does not read `.env` — README-cli §Live mode)".
- Verify: read both docs; `node scripts/rapidtool-cli.mjs doctor` with `.env` present but unexported → llm not
  configured (matches the corrected wording).

**A4-f09 · JARGON / CONTROL LABEL · P3 ·** "Autopilot · extra gates" — a governance switch that doesn't say what it does.
- Evidence (read 15:40 + 15:48): `console.tsx:2558` bare checkbox `<span>Autopilot · extra gates</span>`, no
  title/caption. Semantics: `store.ts:378-386` `canAutopilot` auto-approves parked NON-stock, NON-forceHuman gates
  whose DoD passes (stock P4/P5/P8/P9 + forceHuman never; E-20 parks + logs `autopilot.gate_denied` on DoD fail).
  The CLI doc states it properly (README-cli.md:70 "auto-approves non-stock, non-forceHuman gates only").
- Why vs mission: the label reads as MORE gates; the effect is fewer human stops under a machine seat. A beginner
  flips governance invisibly; the owner hates jargon.
- Fix: title + caption in the EnforceDodToggle style: "Auto-approve eligible gates (non-stock, DoD-passing).
  Stock P4/P5/P8/P9 and human-only gates still stop."
- Verify: hover text present; park a non-stock gate with autopilot on → ledger row `decidedBy: autopilot`.

**A4-f10 · UI CONSISTENCY (Wild) · P3 ·** Paused-run badge tone reads only the legacy flag.
- Evidence (read 15:47): `console.tsx:1298` badge TEXT uses the canonical `wild.run?.pause === true` → "PAUSED",
  but the warn tint above it (`console.tsx:1288`) is conditioned on the legacy `wild.run?.paused === true`. The
  file's own single-source helper `wildPaused()` (:846) accepts both. A store that sets only the canonical flag
  renders PAUSED in neutral chrome.
- Why vs mission: state color is the operator's fastest read of "run paused at a human gate"; a legacy-flag copy
  of a canonical field is exactly the drift class this wave hunts.
- Fix: use `wildPaused(wild.run)` for both text and tone.
- Verify: construct a stored wildRun with only `pause: true` → badge is warn-toned PAUSED; typecheck/eslint clean.

**A4-f11 · DOCS CURRENCY (numbers) · P2 ·** TA-15's telling is inconsistent across the docs the mission leans on.
- Evidence (read 15:45–15:47): README.md:108-114 "the rewire is fully designed (Wave 4) and lands in **W6** …
  until then, RapidTool does **not** emit a real multi-job product" (corpus census `{stubs: 0, reexports: 5,
  real: 0}`); `remainingwaves.md:12, :27, :233` "TA-15 → W6-L1", "Never claim multi-job emission before TA-15
  lands (`reexports:5, real:0` is the truth)"; vs `taskuniverselog.md:466-468` "**2026-09-17 (wave 8 close) —
  TA-15 ACCEPTANCE MET through the real scaffold path (census `{0,0,3}`)**". Also README.md:139-140 "test counts
  **now** scripts **235/235** + src **1811/1811**" vs its own header's 261/261 + 1957/1957 (README.md:12-14).
- COULD-NOT-TRACE: which telling is current cannot be settled read-only — it needs a fresh keyless emit +
  `doctor --tree` census (A1/A3 territory; I stopped there rather than guess).
- Why vs mission: the M-A maker test acceptance and the "not yet" honesty block both hinge on this number;
  contradictory live docs let either side be quoted.
- Fix: one re-derivation, then update README limit #1 (+ remainingwaves M-A row) to the measured census; change
  the "Progress so far" counts' "now" to "at W5 close".
- Verify: `doctor --tree <fresh emit>` matches the number written into README.

**A4-x01 (OBSOLETED mid-audit, no action) ·** README.md said "35 verbs" at 15:35:09 (lines 9/82/103) while
`grep -c 'case "' scripts/rapidtool-cli.mjs` → 37; by 15:42 B4 had updated README to "37 verbs" (lines 9/83/104)
and README-cli.md:10 to "**37 subcommands** (verified on disk…)". Recorded so WD-1 sees the churn — not a finding.

**A4-x02 (OBSOLETED mid-audit, for the record) ·** U1 rewrote `FixturesPanel` between 15:35 and 15:38 (added the
scope paragraph console.tsx:493-497, reworded the TSDoc, added review-state plain-language map) — the same label
problem A4-f02 records. A4-f02 STANDS because the loader string itself (fixtures.server.ts / fixtures.review.ts)
still says "approving here records a decision".

**Journey trace (functional, read-only):** open (`/` HomeScreen → brief ≥12 chars → `create` → `/run/$id`) →
brief (P0 status panel "What's happening" + one next action) → run (`Execute Pn` one step / `Run to next gate`;
`canExecute` gates buttons + `e`/`g`/Ctrl+Enter chords) → WILD (`WildToggle` → `startWildRun`; `WildConsole`
polling feed, Pause/Resume/Stop, honest "stopped after reload" note; `wild.step_timeout` watchdog telemetry) →
gates (HitlDock: evidence bundle, 12+ char rejection + counter, forceHuman override, coded policy refusals) →
emit (`ExportSoftwareBlock` only when complete; says CLI-only + exact `emit --check` command + default dir) →
hand-over (`Export` menu: packet/handoff/copy/download; `Ingest report` panel; phase Notes; packet truncation
banners). All steps trace to real handlers — no dead ends found in the journey; controls map to real store
actions. **Honesty surfaces that held up (do not "fix"):** RunStatusPanel, EnforceDodToggle per-state captions,
ExportSoftwareBlock, SettingsDialog (no client key field), RuntimeLogPane ("Honest silence, not a broken tab"),
ScorecardBlock caveat, PendingFixturesBanner, packet-truncation banners, `lastTest` caption rule, cmd-palette
verb chips ("console only" where no verb exists), ChatPane no-backend/disabled-composer honesty.

### A1 findings — appended by LANE A1 (THE FACTORY CORE). Evidence read 2026-09-26 15:30–15:50 CDT (W24/W25 siblings mid-edit in several of these files — line numbers are as-read today). Full lane log: `fixes/264_lane1_audit_core.md`.

**A1-f01 · engine/wildStep (autonomous loop) · P0 — Wild Mode never calls keyed P6 synthesis; the flagship autonomous loop cannot produce LLM-authored code at all.**
- Evidence (read today): `src/lib/engine.ts:3986` — `wildStep`'s only execution call is `const executed = applyPhaseResult(running, phase);` (the synchronous deterministic floor; it never async-calls the live layer). `upgradeP6Keyed` — the only path that reaches `codegen liveP6Synthesis` — is defined at `src/lib/engine.ts:2869` and has exactly ONE caller, `liveLayer` at `src/lib/engine.ts:2920`. The section comment at `src/lib/engine.ts:2853-2856` claims this seam is "shared by liveLayer AND the wild P6 step — ONE seam for both faces of the product" — that claim is drift: no wild path calls it. Both wild drivers loop `wildStep`: CLI `wild --start` via `headless.ts:3805` (`wildStartRun`) and the console via `store.ts:1105` (Wild Mode loop, 20-step cap). The only keyed-P6 callers that exist: `headless.ts:1887` (`synthesizeCycle` ← `defaultP6Synthesize` ← `driveP6Journey`, i.e. the eval journey) and the console per-phase path (`store.ts:560-580` → `engine.runPhaseAsync` → `liveLayer`).
- Why vs mission: THE MISSION demands a truly autonomous factory driven by a DeepSeek-keyed model. Wild Mode is RapidTool's autonomy face; it structurally cannot call the model. Worse, with `enforceDod` ON (keyed default, `engine.ts:1902-1903`) the P6 floor fails `p6-brief-fit` by construction (`dod.ts:604-632`) and `wildLeavePhase` hard-blocks (`engine.ts:3760-3772`, RT_E_GATE_PENDING) — the run can never complete; with advisory (every console-created project — see A1-f09) it silently "completes" a placeholder-code run. Committed evidence (read today): `research/eval-out/results.json` notes `stall:"P6 DoD unmet — hard gate blocks advance: p6-verified, p6-brief-fit."`, `stopCode:"RT_E_GATE_PENDING"`.
- Proposed fix: route `wildStep`'s P6 edge through the live seam when keyed (`upgradeP6Keyed`/`runPhaseAsync` for phase 6), then the tree-run mint + `recordGateInto` — or delegate the P6 edge to `driveP6Journey`. Minimum honest stopgap: refuse a keyed Wild start loudly instead of presenting a deterministic completion.
- Verification path: `src/lib/wild-step.test.ts` — inject a fake live seam, assert keyed P6 invokes it; funded: `rapidtool wild --start` asserts a `p6.synthesis.attempt` log exists.

**A1-f02 · engine/gates/mint chain · P0 — the "tested" mint is unreachable outside `eval`/`repair`: a chunked (app/game/tool) keyed run can never pass `p6-verified` from run/gate/console/wild.**
- Evidence (read today): chunked trees get `lastTest: null` at synthesis (`codegen.server.ts:3383` in `treeUpgraded`, 3323-3399); the only mint `mintTreeRunTested` (`codegen.server.ts:3450-3489`) is called from exactly two sites, both in the journey/repair drivers: `headless.ts:2100` + `2142` (`driveP6Journey` green branch) and `headless.ts:2681` (`repairTreeDir`). The run paths never tree-run or mint: `headless.ts:350-380` (`runPhase`; live:true only forwards to `liveLayer`), `scripts/rapidtool-cli.mjs:467-536` (`run`/`gate`), `scripts/rapidtool-cli.mjs:2834-2911` (`wild`); the CLI never calls `driveP6Journey` (grep: only a comment at `rapidtool-cli.mjs:1224`). The kindless ≤8-signature single-module path mints via its own verify branch (`codegen.server.ts:2511-2518` `testedLastTestStamp`) — so libraries can converge but apps/games/tools cannot.
- Why vs mission: "games, websites, programs, applications, tools" are exactly the chunked kinds. Today every normal verb (`run --live`, `gate --live`, console phase-run, Wild Mode) hard-stops at P6 with `RT_E_GATE_PENDING` even when synthesis produced a good tree, because `p6-verified` (`dod.ts:583-601`) requires the mint that only the eval path performs.
- Proposed fix: when a live P6 pass lands a `generatedTree` (single-module path already self-mints), run the journey's final step in place — candidate emit → `treeRun` → `applyTreeRunTestedMint` → `recordGateInto` — inside `runPhase`/`gate` (or call `driveP6Journey` from the CLI verbs when keyed).
- Verification path: funded: webapp brief → `gate --live` to the P6 edge → expect P7 reachable (not `RT_E_GATE_PENDING`); headless test injecting a fake synthesis seam asserts the mint is reached from `runUntilGate`.

**A1-f03 · P6 verification integrity · P1 — the "machine-verified (tested)" mint is earned by load+presence, not behaviour: hollow or throwing trees pass every gate.**
- Evidence (read today): `codegen.server.ts:3416-3431` `treeRunTestedEvidence` counts `specs.length>0 && assertions>0` — any spec file that runs with ≥1 passing assertion, regardless of what it asserts. The emitted TREE-mode acceptance is: a `tree.entry` row asserting `Object.keys(treeModule).length > 0` (`scaffold.ts:1412-1421`, passes via the CJS↔ESM `default` interop key even for an empty export surface) and A7 `tree-job` rows that assert "exports are functions" then CALL the first export inside `try { … } catch (e) { if (e instanceof ReferenceError) throw e; }` — every other throw is swallowed by design (`scaffold.ts:1596-1615`). Capability rows assert identifier presence in source text only (`scaffold.ts:1651-1700`). So a tree whose functions all `throw new Error("not implemented")` yields green treeRun → mints `lastTest.label:"tested"` → `p6-verified` PASS (`dod.ts:583-601`); `p6-arch` only checks capability→file identifier mapping + template-stub/TODO(E-15) markers (`dod.ts:650-657`).
- Why vs mission: "GOOD code, not bad code" — the product's strongest verification claim is satisfied without exercising a single demanded capability's behaviour. The tree-run lane's own verdict (`compile-check.server.ts` per-spec TAP counts) is honest about what ran; the MINT over-reads it.
- Proposed fix: (a) make the tree-job row assert the call does not throw + a shape of its return (stop swallowing non-ReferenceError); (b) mint only when ≥1 assertion exercised a demanded capability (tag the generated rows so `treeRunTestedEvidence` can count them); (c) add a `p6-behavior` DoD row fed by that evidence.
- Verification path: RED-first — run `driveP6Journey` fakes with a throwing-stub tree and assert no mint; extend `codegen.server.test.ts`.

**A1-f04 · DoD registry · P1 — no criterion measures behaviour or quality; the phase-6 content gates are identifier-presence proxies (over-credit AND over-block).**
- Evidence (read today): full registry `dod.ts:460-731`; P6's only content probes are `p6-brief-fit` (`dod.ts:610-632` — ≥ ceil(50%) of brief nouns must appear as identifiers in the barrel+tree union) and `p6-arch` (`dod.ts:650-657`). Nothing reads tree-run functional results, coverage, or the emitted UI; P7–P12 gates are artifact-presence only. Flip side: a legitimately-built tree that uses different vocabulary fails `p6-brief-fit` and, keyed+enforceDod, HARD-STOPS the run (`engine.ts:3760-3772`).
- Why vs mission: "GOOD code" as a machine claim needs at least one behavioural criterion; vocabulary presence both over-credits hollow code and over-blocks well-named code. (Behaviour-heavy universality findings belong to A3 — cross-ref.)
- Proposed fix: add behaviour-backed P6 criteria (mint evidence: per-capability executed assertions) and split "floor visibility" (advisory) from "hard block" for the vocabulary proxy so a correct-but-differently-named tree parks for review instead of dying.
- Verification path: build a brief-named hollow tree → `runGate(p,6)` currently PASS; after fix expect FAIL; build a well-behaved tree with off-vocabulary names → expect park-not-die.

**A1-f05 · codegen refusal path · P1 — `partialTreeRefuse` keeps the floor's green `lastTest` while replacing `generatedSource`: stale "self-test passed" evidence over a different artifact.**
- Evidence (read today): `codegen.server.ts:3289-3309` returns `{...project, generatedTree, generatedSource: materialized.entrySource, modelRoute}` and never touches `lastTest`, while `treeUpgraded` explicitly nulls it (`codegen.server.ts:3376-3383`: "A stale green stamp outliving its artifact is exactly how a shipped packet came to record `lastTest.ok:true` while the shipped test exited 1"). Next reader is `p6-test` (`dod.ts:556-563` — `lastTest.ok===true` + non-empty detail).
- Why vs mission: honesty contract (declare-or-strike) — a green gate must describe the artifact on disk. With a partial LLM tree landed, the template self-test verdict survives and `p6-test` reads green for code it never tested (advisory runs then advance on it).
- Proposed fix: null `lastTest` in `partialTreeRefuse` exactly as `treeUpgraded` does.
- Verification path: `codegen.server.test.ts` — seam accepts chunk 0, refuses chunk 1; assert `lastTest === null` on the result.

**A1-f06 · gates / honesty surface · P2 — a hard-DoD stall writes NO gate record, so red-gate censuses read clean while the run is stalled on unmet criteria.**
- Evidence (read today): `recordGateInto` is a no-op unless the phase record is `complete` (`dod.ts:865-870`); `failedGates` counts only complete phases (`dod.ts:851-858`). The hard-DoD block stamps an artifact + paused `wildRun` only (`engine.ts:3702-3714`, `3760-3772`; `headless.ts` `dodBlocked` path). Committed row (read today): `research/eval-out/results.json` — M5 evidence "no red DoD gate records — nothing to hide" sits next to `notes.stall:"P6 DoD unmet — hard gate blocks advance: p6-verified, p6-brief-fit."`
- Why vs mission: an honesty surface that says "nothing to hide" on a run stopped by unmet DoD — the failed criteria exist only in prose notes/logs, not in the machine census a packet reader checks.
- Proposed fix: on a hard block record a distinct `gate.blocked` row `{phase, unmet, evidenceHash, blockedAt}` (new event; phase-record semantics unchanged) and teach censuses/M5 to read it.
- Verification path: `wild-step.test.ts` — after a P6 hard block assert the blocked row exists with the unmet ids.

**A1-f07 · emit/handover · P2 — emit refuses over any stale workspace (RT_E_FOREIGN_FILES) and `--force` KEEPS the foreign files: re-emits either fail or mix trees; the clean fix exists only in run-eval.**
- Evidence (read today): refusal at `headless.ts:1596-1607`; force path `headless.ts:1639-1647` (`survivors: opts.force === true ? foreign : []` — foreign files stay and the following tree-run then judges a mixed tree). The W23-L1 fix landed ONLY in the eval driver: `scripts/run-eval.mjs:783` `prepareCleanEmitDir` called at `:1793`. Committed evidence: `results.json` `notes.emitError:"foreign files in emit dir (pass --force to keep): src/generated/get-property.ts"` + M6=0; the stale tree still sits at `research/eval-out/coffeehouse2home-property-ledger/` (mtime 2026-09-24 14:48).
- Why vs mission: the mission includes "continuously improve / refactor / enhance what it produces" — an iteration loop must re-emit its own workspace; today the CLI/console path refuses or produces mixed-tree evidence the tree-run then weighs.
- Proposed fix: expose a guarded `--clean-target` (eval-driver parity, restricted to a driver-owned dir) on `emit`, or per-file replace actions in the refusal payload.
- Verification path: emit twice into one dir → second emit succeeds (or fails with an explicit clean instruction); eval keeps its clean report.

**A1-f08 · codegen/docs drift · P3 — comments claim P6 synthesis runs on the PRO tier; the code requests and stamps flash.**
- Evidence (read today): `codegen.server.ts:8` "one json:true synthesis call on deepseek-v4-pro"; `:2732` "one pro-tier call PER chunk"; `:2753`, `:3283` "modelRoute deepseek-pro" — but `P6_SYNTH_MODEL = DEEPSEEK_MODELS.flash` (`codegen.server.ts:150`; `= "deepseek-v4-flash"` per `llm/providers/deepseek.ts:53-56`) and the code stamps `modelRoute: "deepseek-flash"` (`codegen.server.ts:3304`, `3385`). Grep: no P6 synthesis call anywhere requests `DEEPSEEK_MODELS.pro`.
- Why vs mission: declare-or-strike; and if flash is a deliberate cost choice, the "GOOD code" bar the docs advertise is being aimed at the cheaper tier — make that an explicit, testable decision (env override + docs) rather than comment drift.
- Proposed fix: correct the comments or make the tier explicit/switchable in one source of truth.
- Verification path: a doc-drift test asserting the comments' tier matches `P6_SYNTH_MODEL`; funded: assert the served model on a synthesis call.

**A1-f09 · engine create / console · P2 — console-created projects are never `enforceDod=true`; the "On by default when a DeepSeek key is configured" caption is false in the app.**
- Evidence (read today): console create runs in the browser — `store.ts:1164-1168` `emptyProject({brief, name})`; `keyedDeepSeekConfigured()` is a `process.env` read that returns false when `process` is undefined (`engine.ts:1820-1826`), so `enforceDod` defaults false (`engine.ts:1902-1903`). The console caption claims the keyed default (`console.tsx:6264-6284`; its own comment cites a stale line ref `engine.ts:1498-1499`).
- Why vs mission: honesty surface overstates enforcement on the primary UI path; combined with A1-f01 a keyed console run advances advisory past failing gates while producing no LLM code.
- Proposed fix: thread the server-reported `llmStatus.configured` into the console create action (or stamp `enforceDod` on first hydrate for keyed projects), or strike the in-app wording.
- Verification path: console test — keyed server status → created project has `enforceDod === true`.

**Trace limits / corrections (A1 lane).** (1) No keyed calls were made (account unfunded — all calls 402 per `fixes/262`), so f01–f03 are code traces; last funded evidence = the 2026-09-24 keyed rows in `research/eval-out/history.json` (best 2026-09-24T19:49:11Z m1=1/m6=1/m7=1 mean 0.667; latest 2026-09-25T00:03:43Z mean 0.333 with `synthesisSucceeded:false`). (2) The brief's `_step0_run*.log` files are NOT in the repo (`find . -iname '*step0*'` → only `src/lib/wild-step.test.ts`); readable keyed evidence = `research/eval-out/_keyed-run.log` (2026-09-10, 4/9, M1=1), `results.json`, `history.json`, `run-in-progress.json` (`preflightClass:"balance-exhausted"`). (3) **`src/lib/gates.ts` does not exist** — gate code lives in `src/lib/dod.ts` + `src/lib/engine.ts` (recorded so siblings don't chase a phantom file). (4) The provider's 402→`RT_E_LLM_NO_BALANCE` classification IS present today (`src/lib/llm/providers/deepseek.ts:431-443`) — the W23-L1 no-balance chain is code-present; its end-to-end proof needs a funded run.

### §A2 — findings (PARENT-COMPLETED from lane A2's own summary; the author hit the call cap before the append — nothing invented, all evidence read by A2 today)
- **A2-f01 · P1 · `fixtures --approve` mints human-approved acceptance fixtures with NO seat/token/provenance.** `rapidtool-cli.mjs:977-998` stamps `acceptanceApprovedAt` + `approval:"approved"` with no actor/`decidedBy`/`RT_HUMAN_SEAT_TOKEN` — while `approve` in the same file (`:566-618`) requires exactly that, and `policy.ts:156-180` deliberately refuses an unverified human seat; README `:22` claims fixtures "stay pending until a human approves". An agent can self-approve the brief-derived bar and the record cannot tell. Fix: route through `evaluatePolicy`/seat+token, or record `decidedVia` and rename the claim. Verify: `fixtures --approve-all` non-TTY + inspect the persisted row.
- **A2-f02 · P1 · `gate.sh` can report GREEN with a red test leg.** `gate.sh:154-178`: `legStats` collects only `not ok N - name` lines; the exit (`:178`) gates on typecheck/lint/assertionGaps/**build** only — `testsScripts`/`testsLib` exits are recorded but never gate `code` → a leg exiting non-zero WITHOUT a TAP line (crash, runner-refusal, missing file) = `ok:true`, exit 0. Fix: add `!gates.testsScripts.ok || !gates.testsLib.ok` to the exit condition.
- **A2-f03 · P2 · Internal errors exit 1, contradicting the documented taxonomy (exit 4) in ≥7 verbs.** `deepen :3022`, `harvest :1912`, `swarm :1937`, `bench :1987`, `design :1833`, `diagram :1868` respond `RT_E_INTERNAL` on exit **1**; `vault :1650-1654` states it. README `:845-846`/`:897` say internal = exit 4 → an agent branching on `exit_code` takes the usage-error path. Fix: exit 4 (or re-code to a 1-class code).
- **A2-f04 · P2 · `eval`'s "no writes" claim is false as written.** `rapidtool-cli.mjs:1018-1024` + USAGE `:3177` claim strictest read-only; `respond()` (`:143-163`) unconditionally appends an NDJSON row via `resolveLogDir(CLI_PROJECT)` → `cwd/.rapidtool/logs`. Fix: narrow the claim to "never writes the eval-out documents".
- **A2-f05 · P2 · Stale `preflightClass:"balance-exhausted"` has no producer.** The live `run-in-progress.json` carries it; `classifyLlmPreflight` (`run-eval.mjs:1017-1165`) emits only `no-balance`/`auth-rejected`/`wire-ok`/…; `grep` → 0 hits. The `eval` verb echoes it verbatim (`scorecard.ts:682`); `preflightLimits()` has no case. Fix: reconcile vocabulary + legacy alias, or render as unknown-class.
- **A2-f06 · P2 · The 3/9 wallet artefact is surfaced too weakly.** Marker: `meanOfNine 2.9997`, `decision retrace-first`, `preflightClass balance-exhausted`; `eval` prints `derived.meanTotal 0.3333` as the headline with only buried evidence; no envelope-level NOT-A-MEASUREMENT flag. Fix: derive a top-level `measurement:false` from the marker's fundedness/no-balance evidence.
- **A2-f07 · P2 · `RAPIDTOOL_TOKEN_CAP` is not a session cap on the codegen path.** `synthWithBackoff` (`codegen.server.ts:2310-2317`) defaults `ledger=emptyLedger()`; both production call sites (`:2817`, `:3174`) pass no ledger → each call starts from ZERO → only a single call exceeding the whole cap can trip. Also `headless.ts:3027` (verify) passes no `budget` → T-107.6 seams inert on the CLI path. Fix: thread one process-scoped ledger (or rename to per-call).
- **A2-f08 · P2 · README-cli.md is stale on `emit --verify-kind` in four places.** The arm exists (`rapidtool-cli.mjs:879-891`, `RT_E_VERIFY_KIND_FAILED`) while README `:30-35`, `:186-190`, `:360-368`, `:431-436`, `:466-470` insist "NOT on disk"; its own reasoning self-refutes (the flag never needed a case arm). Also internal count drift 35 vs 37 (`:363` vs `:31`).
- **A2-f09 · P2 · Two shipped verbs have NO contract section.** `fixtures` + `eval` appear only in the verb list (`:14`) — no `## Fixtures`/`## Eval` sections though README calls itself "the agent-facing contract". Also `:19` lists the lesson family without `--effect` (USAGE `:3199` documents it).
- **A2-f10 · P2/P3 · `fixtures --draft` silently clears `acceptanceApprovedAt`.** `rapidtool-cli.mjs:965` deletes it while `mergeDraftedFixtures` keeps approved rows → approved fixtures with a null approval timestamp read "no".
- **A2-f11 · P3 · Valueless `--out` refused in 2 verbs, silently honoured as absent in 5.** `emit :817` + `vault :1634` guard `args.out === true`; `packet :779`, `export :793`, `design :1825`, `diagram :1861`, `create :456` do not — `create --out` silently writes `<slug>.json` into CWD.
- **A2-f12 · P3 · `checkedOutputPath`'s Windows fix turned a hard refusal into a drive-root write.** `browser-guard.mjs:34-48` + `browser-smoke.mjs:30-33` accept any `C:\workspace\…` and `mkdirSync` it (dev-only; registered S-04 in audit-bugs/04).
**Verified-clean (A2):** `zero-byte-guard.test.ts` (anti-stale allowlist; coverage limit noted: `git ls-files` only) · `test-name-pattern-guard.test.mjs` · `errors.ts` registry completeness (`RT_E_LLM_NO_BALANCE` registered) · `policy.ts` token check (symmetric) · `doctor`/`summary` envelopes · `scan`/`tree-run`/`repair` exit codes.

### §A3 — findings (PARENT-COMPLETED from lane A3's own summary; the author hit the call cap before the append — nothing invented, all evidence read/run by A3 today)
- **A3-f01 · P0 · emitted code cannot load — the fix exists only at synthesis time, not at emit time.** `research/eval-out/coffeehouse2home-property-ledger/src/generated/get-property.ts:250-258` ends in CJS `module.exports.*` while `package.json:5` declares `"type":"module"`; live: `node --experimental-strip-types --test tests/oracle.spec.ts` → `ReferenceError: module is not defined in ES module scope` (`pass 0/fail 1`). Fixed at synthesis (`materializeImportableTree`, `codegen.server.ts:1924,3135`) but NOT at emit: re-emitting the stored project with today's code still writes the CJS file because `scaffold.ts:2543-2565` passes `generatedTree[].source` through **verbatim**. Fix: emit-time materialization/validation (an import-smoke or reuse `materializeImportableTree`) before writing.
- **A3-f02 · P1 · the emit prompt teaches shapes that fail the emitted tsconfig.** `codegen.server.ts:465-492` mandates "TypeScript-style **CommonJS**" + "Assign module.exports"; `scaffold.ts:618` emits `"strict": true`. On the emitted tree: `tsc --strict` → **15× TS7006** + **TS2306 "not a module"** for the 3 bridges → `npm run typecheck` (a README-advertised command) is RED on the shipped artifact.
- **A3-f03 · P1 · partial synthesis = total failure.** Today's emit repro: `43 tests · 9 pass · 28 fail · 6 skipped`; the 28 reds are `capability.9–36` (chunks that were refused). `treeRun ok:false` → default `redTree:"refuse"` blocks emit entirely; the real run shipped only under `redTree:"banner"` with **0 delivery**.
- **A3-f04 · P1 · `emit` has no self-cleaning; the eval driver does.** `run-eval.mjs:783,1793` deletes the prior workspace (`prepareCleanEmitDir`, W23); the CLI emit (`rapidtool-cli.mjs:352,851`) does not → a real agent's second emit hits `RT_E_FOREIGN_FILES` — exactly run #1's failure (`results.json:41-43,124`). Fix: same pre-clean (or the `--force` semantics) on the CLI emit path.
- **A3-f05 · P1 · the graders don't grade the product.** All 7 graders demand `expectedFiles: [package.json, index.html, README.md]` (scaffold infra) and the single `expectedContent` is `package.json contains "test"`. The acceptance layer passes a tree whose generated code is CJS-broken — the bar is unrelated to "GOOD code"/"perfect UI/UX".
- **A3-f06 · P1 · universality is untested.** All 7 fixtures are `kind:"webapp"`; zero game/cli/library/service. The 5-kind taxonomy exists (`scaffold.ts:84,115-121`); only `game` has real depth (canvas shell `:914-935` + `assets/manifest.json:1747`); cli-tool/library/service emit only a throwing stub (`:936-955`). "Any kind of software → games, websites, programs, applications, tools" is **UNMEASURED**.
- **A3-f07 · P2 · emitted UI is a name-dump, and by design can never improve.** `src/ui/console.tsx:14-21` renders `generated exports (N): names`; `scaffold.ts:2567-2570` states the webapp/game UI is deliberately **never** machine-generated → "perfect UI/UX for said software" is structurally out of reach of today's emitter.
- **A3-f08 · P2 · README table overclaims shipping.** `README.md:40-44` lists `src/jobs/track|record|flip|show|lease.ts` as shipped while **no `src/jobs/` exists on disk** (the honest-boundaries line `:93` disagrees with the table).
- **A3-f09 · P3 · game kind declares scripts without support files.** `scaffold.ts:560-566` gives game `build:"vite build"` but `:2529` pushes `vite.config.ts` only for webapp.
- **A3-f10 · P3 · COULD-NOT-TRACE** — whether a fully accepted keyed tree yields a green `typecheck` (no keyed calls permitted).

### §C3–§C6 — BUG-HUNTER OUTCOMES (PARENT-RECORDED from the four hunters' own saved summaries; each hunter hit the call cap before writing its log/append — nothing invented)
**Recording debt (next turn):** the four lane logs `fixes/266_lane1..4_bugs.md` are NOT on disk; the full per-finding detail (proofs, stack traces, before→after) sits in the hunters' saved summaries at
`C:\Users\mnril\AppData\Local\hermes\cache\delegation\subagent-summary-{0..3}-20260926_160103_*.txt`. Transcribe from there; do not re-hunt.
- **C3 (H1) · hunt ran, 0 fixes, 0 entries.** Real runs: ast-mine+report-intake+node-runner 43/43 · bench+verify 46/46 · eslint 22 files clean · 4 live CLI verbs ok · **73-case hostile-shape probe → 11 throws** with traces. Coverage gaps found: `vault.backlinksFor` untested (1/10 exports), `bench.projectedTime`/`stripStringsAndComments`/`minutesForPhase`/`phaseStatusWeight` untested (12/21). Two confirmed-bug candidates (B1-f01/f02) detailed in summary-0 — **no fixes applied** (honest).
- **C4 (H2) · fixes LANDED, entries owed.** **B2-f01 · P1 · `npm test` never ran 2 real test files** (proof: discovery-only run → its lib leg resolves **79** files vs `**` → **81**; the 2 missing = `src/lib/llm/providers/mock.test.ts` + `registry.test.ts`, 51 tests, individually green; `gate.sh` uses `**` so the two legs disagreed on what "the suite" is) → **FIXED** at `package.json:19` (`"src/lib/**/*.test.ts"`; RED proof 79 on record; GREEN re-check owed). Plus run-eval.mjs marker fixes: atomic marker write, fail-safe `runMarkerState`, null-safe `runWithMarker` log. Detail in summary-1.
- **C5 (H3) · 1 fixed, 1 unfixed, 2 more confirmed.** **B3-f01 · FIXED (re-check owed)** — `deepseek.ts:585-594` `tapLlmCall`: an **async** tap's rejected promise = fatal unhandled rejection (probe exit 1, trace at `:590`) that kills the very run the telemetry observes; patch applied (promise channel contained). **B3-f02 · UNFIXED** — `openai-compatible.ts:488-495`: xAI 402 → `RT_E_LLM_REJECTED` (msg "xAI account balance exhausted (HTTP 402)") vs DeepSeek's `RT_E_LLM_NO_BALANCE` doctrine (W23-L1/fixes-262) — sibling providers disagree on the same vendor class. Detail in summary-2.
- **C6 (H4) · findings confirmed, no repo edits.** **B4-f01 · P1 · `README.md:111-114` — the quoted `doctor --tree` census is NOT reproducible** (real command run). More confirmed findings (read times recorded; console.tsx was mid-U1-edit) in summary-3. Nothing edited in the repo; entries owed.

### §C1 — findings (PARENT-RECORDED from cleaner C1's own closed summary; the append never landed — author hit the tool cap. All read-evidenced by C1 today; none probed)
- **C1-f01 · P2 · unguarded date render.** `packet.ts:484` `new Date(d.decidedAt).toISOString()` is unguarded while the same file clamps the identical hazard at `:193-215` ("8.64e15 ms … beyond it toISOString throws"); `engine.ts:2021-2037 wellFormedDecisionRow` accepts `Infinity`/`1e300` (typeof-only) → a JSON import of `decidedAt: 1e300` throws `RangeError` inside `compileAgentPacket`; engine's own comment (`:2242-2246`) calls that class a whole-store wipe. Fix: reuse the clamp or tighten the row guard.
- **C1-f02 · P2 · missing in-flight guard.** `store.ts:1291-1294` (`executeAsync`) guards with "174-1: do not clobber an in-flight wild run"; **`runUntilHitlAsync` (`:1345-1351`) has no such guard** → wild-run state mutated mid-flight is silently rolled back. Fix: mirror the guard.
- **C1-f03 · P2 · honesty: the named model didn't serve.** All three `llm-tasks.ts` sites (`:127,157,188`) request `model:"deepseek-v4-pro"` while `liveLayer` stamps `modelRoute:"deepseek-flash"` when `llmRan` (`engine.ts:2960-2963`) → the packet's `model_route` + the "Current edge" rail name a model that did not serve the call.
- **C1-f04 · P3 · divergent validators.** `io.ts:247-262` keeps any scorecard whose `axes` rows are plain objects; `hydrateProject.scorecardOk` (`engine.ts:2290-2301`) also requires a string label → io reports "kept" for a card the engine drops.
- **C1-f05 · P3 · prose-coupled gate criteria.** `dod.ts:114` — `p4-approved/p5-complete/p8-complete/p9-complete` depend on `via.reason.includes(" — ")` (em-dash prose); a cosmetic revision of the reason builder flips a legitimate approval to FAIL (fail-closed direction noted).
- **C1-f06 · P3 · inconsistent defensive posture.** `packet.ts:465,483,531` assumes a hydrated shape (`a.body.length`, `d.decidedAt`, `e.fields.map`) while sibling `dod.ts:866-868` explicitly defends hand-built shapes ("`{ } as Project` … must be a clean no-op").
- **C1-f07 · P3 · silent catches vs the OV-13 invariant.** `engine.ts:2790-2792,2813-2815` — a thrown research call and a narrative failure are swallowed (`catch { unavailable = true }` / `catch { narrative = null }`) → for P0/P7/P11 a keyed refusal records **no coded row**, contrary to the module's own statement at `:3288-3300`.
- **C1-f08 · P3 · facade type gap.** `llm.ts:79-84` — `complete()`'s public opts omit `thinking` (accepted by the validator at `:50-62`, whose doc asserts the facade forwards it) → only `llm-tasks`' own `Completer` typing keeps it working.
- **C1-f09 · P3 · unvalidated model ids.** `deepseek.ts:343-347` — `completeDeepSeekInner` performs no model-id validation and treats every non-pro id as flash; the header claims "unknown ids are refused before any network I/O" — that rule lives only in `registry.ts`.
- **C1-f10 · P3 · duplication (drift risk).** `store.ts:415-478/604-661/1201-1259/1300-1356` — four near-identical transition/stop-reason implementations; compared, **no live divergence** — recorded as drift risk, not a bug.
- **C1-f11 · P3 · dead branch.** `engine.ts:2883` `p.kind === null` is unreachable (`hydrateProject:2425-2427` deletes out-of-set kinds).
- **C1 PROCESS WARNING (adopt repo-wide):** tool output **redacts secrets** (`Authorization: ***`) — this made `engine.ts:778-779` *appear* corrupt (a false P0); `node --experimental-strip-types --check src/lib/engine.ts` exit 0 proved valid. **Never judge syntax from redacted tool output; verify with `node --check`.**
- C1 not-traced (stop points): `registry.ts` role→model resolution, `scaffold.ts` deep pass, `codegen.server.ts` chunked-tree body, `archProductComplete()` callers.

### §C2 — findings (PARENT-RECORDED from cleaner C2's own closed summary; append never landed. All evidence-backed by C2 today)
1. **C2-f01 · P2 · README census not reproducible + all-zero census ambiguous.** `README.md:108-115` claims `doctor --tree …coffeehouse2home-property-ledger` → `{stubs:0, reexports:5, real:0}`; re-ran: that dir has **no `src/jobs/` at all** → `{0,0,0, files:[]}` with `ok:true`; only `…--trial-1` has jobs (`{0,4,1}`). **Fix:** re-derive on the trial dir; update README + `remainingwaves.md:12/27/233`; make the census emit a "no job modules found" note. *(Supplies the trace A4-f11 stopped short of.)*
2. **C2-f02 · P2 · dead enforcement branch.** `rapidtool-cli.mjs:1393-1401` (`edit --write`) + `:598-610` (`approve`) pass `humanSeatToken` **and** `expectedHumanSeatToken` from the *same* env var → `isVerifiedHumanSeatToken` (`policy.ts:171-181`) degenerates to "the env var is non-empty"; the `human-seat-unverified` branch is unreachable from both sites. **Fix:** source the expected token from another channel, or document the degeneracy.
3. **C2-f03 · P3 · count drift the doc-contract test can't see.** `README-cli.md:363`/`:434` say "35 case arms" while `:10/:364/:432` say 37; `README-cli.test.mjs:122-145` only inspects lines containing `grep -c 'case "'` → stale lines pass. **Fix:** 35→37 + widen the check.
4. **C2-f04 · P2 · missing busy latch → double-spawn.** `console.tsx:2122-2136 onRunModule` / `:2138 onIngestReport` never set `busyAction` (union `:1801`) → buttons re-enable instantly; a double-click fires two bounded module runs, each spawning a real child process. **Fix:** add a `"module"` member + wrap like `run()`.
5. **C2-f05 · P3 · unwired legacy script.** `scripts/write-atomic.mjs` — no npm-script/`src/` caller (only `.grok/skills/**` docs) → legacy scaffolding; symlink aliasing still defeats its `public/` refusal (confirms `audit-bugs/04` S-05). **Fix:** fold into the 94 §B1 descope, or realpath before containment.
6. **C2-f06 · P4 · cross-ref anchor** for A4-f02 at `fixtures.review.ts:39-40`.
**C2 COULD-NOT-TRACE (with stop points):** (a) `gate.sh:89-90` vs `package.json:19` lib-leg equivalence (needs the suite — forbidden mid-wave; NOTE: hunter H2 later **proved** the legs differ, 79 vs 81 — see §C4); (b) `console.tsx:5719` `void chatContextInfo(...).then(onFulfilled)` rejection-handler reachability (depends on `chat.ts:178`'s internal catch; unfinished).
**C2 verified-negatives (spare future lanes):** `doctor` runs without `--experimental-strip-types` (README:154 ok) · no stdout truncation (3× byte-identical through a pipe) · parity+guard tests 7/7 · one "missing comma" was a read artifact. In-flight guard respected (never opened `src/lib/llm/**`).

<!-- END-OF-FILE-MARKER-W25 · every lane appends ABOVE this line · never edit or delete this line -->
