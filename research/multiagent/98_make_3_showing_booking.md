# 98_make_3_showing_booking — House Showing / Booking Software through the real pipeline

Builder: Flash BUILDER B3 · Coffeehouse2Home Phase 1, product 3/5 (mission 97)
Date: 2026-09-06 · Host: Windows, `C:\Users\mnril\Desktop\RapidTool Main` (not git)
Real key: **yes** — `doctor` pre-flight: `llm.configured:true` (deepseek-v4-flash|pro),
`research.configured:true` (free duckduckgo/searxng/wikipedia, probed), `runner.available:true`.
All keyed commands driven through a scratch `rt.sh` wrapper (`set -a; . ./.env; set +a`).
Scratch: `%TEMP%\rapidtool-make-b3` (full envelopes + final project JSON on disk).
Repo edits: NONE (read-only on `src/` + `scripts/`).

---

## 0. Verdict up front

**Product delivery vs brief: 1/10. Process honesty: ~9/10.** The governed pipeline
completed 13/13 phases with a live key, real web research, real DeepSeek narratives, a real
6/6 machine-run verify pass, and every CLI verb exit 0 — while producing **zero lines of
house-showing software**. The shipped "code" is the deterministic P6 toy harness
(`synthesize()` validating phase-graph rules), the scaffold is 14 files of typed stubs
(`route()` throws `TODO(E-15 stub)`; oracle tests are `todo: true`), and **no artifact in the
50-artifact record describes a showing, a booking, an open house, a reminder, or a feedback
form**. Two systemic mechanisms caused it, both traceable to file:line:

1. **Keyed P6 synthesis (`liveP6Synthesis`) is structurally unreachable on the CLI/headless
   path** — the exact path this mission mandates. It never fired; `generatedSource` is
   byte-identical to the keyless floor; P6's brief-conformance DoD criterion FAILs and the
   project still seals `complete` with a red P6 gate.
2. **The self-learning loop captured ZERO lesson rows** (0/18 memory rows carry the `lesson`
   tag) despite two should-fire moments (P6 gate FAIL at seal → L2; verify `--apply` pass → L4).
   The lesson builders exist and are unit-tested; no engine/headless/store call site invokes them.

Everything below is anchored to on-disk evidence (project JSON, envelopes, source file:line).

---

## 1. Journey transcript (all verbs, real key, live mode)

Project: `House Showing Scheduler` · brief: *"a house-showing scheduler: agents publish
open-house and private-showing slots, buyers book slots with email confirmation, reminders,
calendar sync stub, showing feedback form, per-property showing history"* · kind inferred: `webapp`.

| # | verb | exit | outcome |
|---|---|---|---|
| 00 | `doctor` | 0 | llm+research+runner all configured |
| 01 | `create` | 0 | status intake, P0 ready |
| 02 | `gate --autopilot --live` | 2 | P0–P3 complete (5 steps), parked P4 HITL; researchCount 5 |
| 03 | `approve` | 0 | P4 isolation policy |
| 04 | `gate --live` | 2 | parked P5 HITL (P5 ran, gate human) |
| 05 | `approve` | 0 | P5 validation contract |
| 06 | `gate --live` | 2 | P6 codegen + P7 research complete, parked P8; researchCount 10 |
| 07 | `approve` | 0 | P8 interface contract |
| 08 | `gate --live` | 2 | parked P9 HITL |
| 09 | `approve` | 0 | P9 production routing |
| 10 | `gate --live` | 2 | P10 + P11 research complete, parked P11 HITL; researchCount 15 |
| 11 | `approve` | 0 | P11 live tool binding |
| 12 | `gate --live` | 0 | **P12 sealed — status complete, 13/13** |
| 13 | `verify --apply` | 0 | **passed — 6/6 machine-run cases on iteration 1** (`lastTest` label `tested`) |
| 14 | `crew` | 0 | real keyed session: 5 artifacts, reviewer verdict FAIL on P12 |
| 15 | `design --html` | 0 | palette `marketplace · violet`, design.html 22.5 KB |
| 16–18 | `diagram` phases/architecture/flow | 0 | SVGs 8.2 / 19.6 / 3.8 KB |
| 19 | `vault --out` | 0 | 50 atomic notes + `_index.md` MOC |
| 20 | `search "showing booking slot"` | 0 | 10 hits (research + memory + artifact notes) |
| 21 | `harvest` | 0 | 2 real rows, `querySource:"llm"` (keyed query), real licenses/snippets |
| 22 | `prompt` | 0 | DeepSeek ExpandedSpec: 12 requirements / 15 edgeCases / 10 typeSignatures |
| 23 | `swarm` | 0 | 3 seats: keep/revise/keep, 3 advisory artifacts |
| 24 | `bench` | 0 | honest estimates (token 13836 / 450 min / complexity 131 / 0 failure pts) |
| 25–28 | `summary`/`artifacts`/`export`/`packet` | 0 | 50 artifacts; final JSON 91.7 KB; packet 12.1 KB |

5 HITL approvals (P4/P5/P8/P9/P11) recorded in `decisions` with human actor + ISO timestamps.
All 13 phase gates recorded with evidence hashes. Research phases P0/P7/P11 each ran real
keyless DDG research + real keyed DeepSeek narratives (footers "generated prose — grounded in
5 fetched sources").

---

## 2. WRONG ledger (broken / fake / non-working / hollow)

### W1 — Keyed P6 synthesis never fires on the CLI/headless path (P0-01 Part B dead on bare Node)
- **Evidence.** Zero `codegen`/`synthesis`/`p6.*` events in the entire project `logs` array.
  `generatedSource` (1448 B) = the deterministic template verbatim: `const JOBS =
  ["schedule","publish","sync"]`, `synthesize(spec)` phase-graph validator, `test_happy /
  test_no_skip / test_rejection_addressed` (final JSON `generatedSource`; P6 artifact
  "P6 placeholder module (deterministic template)" 1044 B). The artifact title itself says
  *placeholder*. Run was keyed (narratives prove the key worked).
- **Root cause (file:line).** `src/lib/engine.ts:1827-1844` gates live P6 synthesis on
  `(await llmStatus()).configured` (`engine.ts:1829`). `llmStatus` is a TanStack
  `createServerFn` (`src/lib/llm.ts:11,46-50`) — the repo's own docs state these status
  surfaces **always fail under bare Node** ("No Start context found in AsyncLocalStorage",
  `src/lib/headless.ts:96-105` comment; rapidtool-development skill). The failure is swallowed
  by the silent `catch {}` at `engine.ts:1841-1843`, so `codegen.server.ts` is never even
  imported and no `p6.synthesis.refused` warn log is ever written. Additionally the headless
  E-12 live overlay only covers `RESEARCH_PHASES = {0,7,11}` (`headless.ts:111,251-252`), and
  `runPhase` degrades engine-liveLayer failures to the deterministic floor (`headless.ts:253-254`).
  The documented bare-node-safe probe is `isDeepSeekConfigured()` on `deepseek.server.ts`
  (skill: "bare-Node capability probes … must read the `.server.ts` modules' env fns … never
  `llm.ts`/`research.ts` status surfaces") — `engine.ts:1829` commits exactly the banned pattern.
- **Consequence.** With the real key, P6 output is byte-identical to a keyless run. The P6 DoD
  gate honestly records `passed:false, unmet:[Brief-conformance…]` (phases[6].gate; log
  `gate.verdict FAIL · 1 unmet · 64167629` at 1788756066035, re-recorded by verify --apply).
  The mission premise "liveP6Synthesis fires when keyed" is **false on this path** (true only
  on the Start-server UI host where the server-fn guard can run).
- **Fix spec (Phase 3/4 lane).** Replace the `engine.ts:1829` guard with a concatenated
  dynamic import of `deepseek.server.ts` `isDeepSeekConfigured()` (client-safe idiom already
  used at `engine.ts:1830-1833`), OR add a codegen branch to headless's `bareNodeLiveOverlay`.
  Add a regression: keyed `runPhase(p,6,{live:true})` under bare Node must yield
  `implementationSpec` + brief-noun identifiers in `generatedSource`.

### W2 — Hollow product: 50 artifacts, zero house-showing content (systemic, the 1/10 core)
All phase artifacts are engine meta-prose about **RapidTool's own graph** with the brief's
name/domain interpolated:
- **P4 Isolation policy** (artifact body): "Runtime: sync-template … Network during
  generated-code exec: deny … Authorization: Every tool call carries the invoking user OAuth
  scope" — RapidTool's runner policy, not buyer/agent permissioning for showings.
- **P7 Competitive analysis matrix** (artifact body): rows for *Shopify (Storefront)* /
  *Cursor* / *v0/Bolt/Lovable* with "Gap RapidTool exploits: …" and the closing line
  "deterministic 0–12 graph with HITL, MCP/A2A, and ADRs". Header honestly labels rows
  `source: illustrative — NOT live research` — yet the run DID have 15 real cited findings in
  `project.research` (keys `0`,`1`,`2`, provider `duckduckgo`). The matrix never consumes them.
- **Lattice** (final JSON): domain `marketplace`, jobs `[schedule, publish, sync]`, entities
  `[buyer]`, `constraints:[]`, `vague:false`. Of the brief's nouns (agent, open-house,
  private-showing, slot, booking, email confirmation, reminder, calendar sync, feedback,
  per-property history) only schedule/publish/sync/buyer surface.
- **Contracts** = `entities, endpoints`; **oracle** = 4 rows, all lattice-meta: "Authorized
  operator submits 'schedule' with a valid buyer ⇒ 200 + persisted entity + checkpoint
  written"; "Agent requests P9 while P4 is open ⇒ Illegal transition". Zero product behavior.
- **P12 OpenAPI 3.1** (artifact body): only `/v1/schedule`, `/v1/publish`, `/v1/sync` — no
  listing, booking, confirmation, reminder, feedback, or history endpoints.
- **P8 Interface contract** (artifact body): "Screens (derived from brief vocabulary — no
  expanded spec on a keyless run): Screen: buyer … prototype pending … (deterministic
  template), not an implementation". Two lies in one line on this run: the run was **keyed**
  (template text is stale — it never checks the key), and the brief vocabulary was NOT used
  (one screen "buyer" showing the string "buyer"). B-18 honest-label present but content hollow.
- **P0 scorecard**: overall 7.6 `proceed` with engine-generic notes ("Scheduler Δ1",
  "Live-tool Δ2").
- **Memory rows (18)** all engine-authored (`src=engine`, ids `12-semantic-0.97` etc.):
  "RapidTool ships a governed lifecycle" (ph7), "State transition validation wraps every
  transfer_to_agent" (ph1) — pipeline facts, not product facts.
- **Root cause.** Deterministic `applyPhaseResult`/`synthesizePhase` templates
  (`engine.ts:227-758`) describe the pipeline; lattice vocab (algorithms.ts) drives contracts/
  oracle/scaffold. Gates check artifact presence, not brief conformance — only P6 has a
  brief-fit probe, and it fires too late/never (W1). Matches the 86/87/88 calibration exactly.

### W3 — Scaffold is 14 files of typed stubs (re-emitted deterministically, read-only)
Emitted via `scaffoldProject()` (`src/lib/scaffold.ts:988`) into scratch (`scaff/`, 110 KB):
- `src/domain/marketplace.ts` — `interface Buyer/Schedule/Publish/Sync` each `{id: ulid,
  status: enum, updatedAt: datetime}`. No Property, no slot, no reminder/feedback entity.
  Header: "TODO(E-15 stub): extend fields…".
- `src/api/routes.ts` — `ENDPOINTS = POST /v1/schedule|publish|sync`;
  `route()` body: `throw new Error("TODO(E-15 stub): implement …")`.
- `src/jobs/schedule.ts` — hosts `project.generatedSource` **verbatim** (the toy) with
  self-tests. `src/jobs/publish.ts`/`sync.ts` thin mirrors.
- `src/ui/console.tsx` — `useState("shell — implement the P8 interface-contract surfaces…")`.
- `tests/oracle.spec.ts` — 4 `todo: true` tests that `assert.fail("TODO(E-15 stub)…")`.
- README/DEPLOY honest about the boundary ("machine-verified core is the generated P6
  module… everything else is a typed stub" analog). **0% brief-feature completeness** — the
  mission's "front-to-back UI→backend" audit ends at a shell screen and throwing routes.

### W4 — Self-learning loop captured nothing (the mission's verification clause FAILS)
- **Evidence.** `0/18` memory rows tagged `lesson`; no `lesson-*` row ids anywhere in the
  final JSON; vault has no lesson notes. Two should-fire moments occurred:
  1. P6 sealed complete with `runGate().pass === false` (the spec's L2 trigger — "template-emission");
  2. `verify --apply` passed → `lastTest` stamped `label:"tested"` (the spec's L4 trigger —
     "verified-procedure").
- **Wiring map.** `knowledge.ts` HAS the full M-tier surface — `lessonRow`,
  `vagueBriefLesson`(L1), `templateEmissionLesson`(L2), `verifyFailureLesson`(L3),
  `verifiedProcedureLesson`(L4), `correctionLesson`(L5), `driftLesson`, `selectLessons`,
  `lessonLog` (knowledge.ts:440-810). Call sites: **unit tests only** (`knowledge.test.ts`)
  plus ONE lazy production binding — `report-intake.ts:52-59` resolving
  `templateEmissionLesson` for the E-16 agent-report intake branch (`report-intake.ts:362-366`).
  `headless.ts` contains **zero** occurrences of "lesson"; `store.ts` `finishPhase`
  (`store.ts:370`) contains none; the P0 reframe HITL block (`engine.ts:385-391`, the spec's
  L1 capture site — line-drifted from the fixes/98 citation of :334-344) contains none.
  The spec's "standing fallback" — L2 at finishPhase when an
  engine-sealed run closes with `pass:false` (`headless.ts:342` per fixes/98 §2.3) — was
  **never implemented**. The CLI/headless full-run shape (86/87/88/97 style, no agent
  reports) therefore can never write a lesson, by construction.
- **Root cause.** Lesson builders landed as pure functions + tests; the always-on capture
  sites (finishPhase, applyVerifyOutcome, reframe) were left unwired (relocation to
  knowledge.ts documented in fixes/101; wiring evidently deferred and never landed).
- **Fix spec (Phase 3).** Wire L2 into headless `advanceOnce`/store `finishPhase` when the
  sealing phase's gate `passed:false`; wire L4 into `applyVerifyOutcome` pass arm
  (`headless.ts:~1017`); wire L1 into the reframe-HITL block. Then re-run this product and
  show `lesson-*` rows + vault notes appear (the mission's before/after evidence).

### W5 — Provenance contradiction in the final record (cosmetic, known E-14 quirk)
`meta: {"liveUnavailable": true}` and `modelRoute: "deterministic"` in the final export
DESPITE 15 real cited findings (provider duckduckgo) and 3 real DeepSeek narrative artifacts.
Cause: live content is added by headless's E-12 overlay which bypasses the E-14 stamping
(headless.ts:96-252; documented in product-verdicts §4). An auditor reading `meta` alone
would wrongly conclude research never ran.

### W6 — Verified-but-meaningless oracle cases (design consequence, honest labels intact)
The 6/6 machine-run pass executed cases about the **toy**: `case-1: typeof synthesize ===
'function'`, `case-2: synthesize({name:'House Showing Scheduler', phase:6,
job:'schedule'}).ok === true` … (P6 "Verify outcome — passed" artifact body). Real runner,
real pass, honest `lastTest` — but the oracle derives from the lattice, so a 100% pass on
the wrong program is fully consistent. The only brief-fit guard (P6 DoD) FAILed and was
advisory: project still sealed `complete`. **Gates record; they do not block** (AGENTS.md
honesty rule 5) — product-fatal for this mission's acceptance bar.

---

## 3. RIGHT ledger (what genuinely worked)

| # | Area | Evidence |
|---|---|---|
| R1 | Governed journey integrity | 13/13 phases sealed; 5 human HITL decisions with actor+timestamps in `decisions`; per-phase gate records + FNV evidence hashes; envelope/exit-code contract held on all 28 verbs (0/2 taxonomy respected) |
| R2 | Real keyed research | 15 cited findings across P0/P7/P11, real DDG fetches, domain-relevant titles (sellabl.app showing-scheduler articles, ConnectLinx, Showingly, Taskade) persisted under `research[0/1/2]` with provider+query; genuinely grounded |
| R3 | Real LLM narrative | 3 "Phase narrative (LLM)" artifacts — real DeepSeek prose about *showing lifecycles*, each closed with the M-07 honesty footer "generated prose — grounded in 5 fetched sources" |
| R4 | Real machine verify | `verify --apply`: bounded node-runner executed 6/6 oracle cases, `lastTest {label:"tested", evidenceHash}` stamped, `verify.pass` log event, honest `no-var x3` lint advisory; P6 gate re-recorded honestly as FAIL (not flipped) |
| R5 | Crew self-audit honesty | Real keyed crew session: the reviewer's artifact is a genuine FAIL verdict that faults the P12 DoD gate artifact — "merely claims PASS with a hash but provides no evidential reasoning or test traces" — and lists missing contracts/schemas. The engine's own crew independently reproduces this dossier's W2 findings |
| R6 | Best brief-faithful artifact: `prompt` | DeepSeek ExpandedSpec (12 requirements incl. booking slots, confirmation, reminders, feedback; 15 edgeCases; 10 typeSignatures) — the ONLY genuine product spec produced, and it is orphaned (nothing consumes it; P8's text even claims "no expanded spec" while it exists in the run's own envelope) |
| R7 | Deterministic pillars | design tokens + 22.5 KB standalone HTML; 3 SVGs (phases/architecture/flow); vault 50 interlinked notes + MOC; search 10 relevant hits; harvest 2 real GitHub rows (`querySource:"llm"`); swarm 3-seat critique (secops revise); bench labeled estimates; knowledge store surfaces unit-tested |
| R8 | Honesty labels throughout | B-18 declarations ("policy above is the P4 declaration", "prototype pending — … (deterministic template)"), M-01 "illustrative — NOT live research" on template competitor rows, illustrative-vs-cited never conflated, honest P6 FAIL gate, README/DEPLOY scaffold framing |
| R9 | No repo mutation | Full journey ran read-only against `src/`/`scripts/`; all artifacts in scratch |

---

## 4. Learning-loop verification (mission clause: "verify the loop ACTUALLY captures lessons")

**Result: NOT captured — the loop is unwired on the path this mission uses.** Checks run:
1. `memory` rows: 18 present, **0** carry `tags:["lesson",…]` or `lesson-*` ids (audit1 dump).
2. Vault: 50 notes mirror memory/artifacts/research; no lesson notes (vault/ listing).
3. Source wiring: lesson builders invoked only from `knowledge.test.ts` and the
   `report-intake.ts:52-59/362-366` lazy E-16 branch (agent-report ingest — unused this run).
4. Should-fire triggers that DID occur but wrote nothing: P6 seal with `gate.passed:false`
   (L2), verify pass stamping `label:"tested"` (L4).
Positive control: `knowledge.test.ts` (317-388) proves `lessonRow`/`selectLessons`/
L1–L5 builders produce valid content-addressed rows when called. The gap is **call sites**,
not the store. K-tier (`knowledge --store`) was not exercised — no store path configured;
per fixes/98 the always-on half is project memory, which is where the zero sits.

---

## 5. Phase-by-phase: went right vs wrong

| Phase | Went right | Went wrong |
|---|---|---|
| P0 research/feasibility | 5 real cited findings + grounded narrative; scorecard honest (proceed 7.6) | Lattice collapse → jobs schedule/publish/sync, entity buyer; brief-fit not enforced at intake (vague:false despite thin extraction) |
| P1–P3 | gates pass; P2 memory row genuinely names the product ("Persistence plan written for House Showing Scheduler…") | artifacts = Dispatcher topology / Integration contracts (engine meta) |
| P4/P5 | HITL approvals recorded; B-18 honest declaration | Isolation policy describes the runner, not the app's authz model |
| P6 codegen | verify 6/6 machine pass; lastTest tested; gate re-recorded honestly | **liveP6Synthesis dead on CLI (W1)**; placeholder module shipped; brief-fit DoD red; scaffold job hosts the toy |
| P7 research | 5 real cited findings + matrix header honest | Matrix rows still engine meta vs Shopify/Cursor/v0 — real research never promoted into it |
| P8 UI | contract recorded | "Screens: buyer / shows buyer"; claims keyless-run; no UI code (prototype pending is honest) |
| P9–P11 | gates + HITL + real research round | CI/IaC/edge/MCP artifacts are pipeline boilerplate (workflow 278 B etc.) |
| P12 docs | OpenAPI + ADRs emitted | OpenAPI endpoints = lattice verbs only |
| Crew/verify/design/diagram/vault/harvest/prompt/swarm/bench | all exit 0 with genuine outputs (R2–R8) | crew FAIL verdict on P12 corroborates W2; prompt spec orphaned (R6) |

---

## 6. Lessons for Phase 2/3 (Coffeehouse2Home + loop improvement)

1. **A keyed run ≠ a keyed-codegen run.** Bare-Node hosts (CLI, headless, any future
   automation) can never reach liveP6Synthesis until the `engine.ts:1829` guard stops routing
   through the `llm.ts` server-fn. This is the single highest-leverage fix for the 1/10 bar:
   without it, every CLI-made product ships the toy + hollow scaffold.
2. **The prompt-verb spec must feed P8/P6.** `expandBrief` produced a genuine product spec;
   wiring it into P8 (screens/contracts) and P6 (synthesis context) is the cheapest route to
   brief-faithful artifacts. P8's stale "no expanded spec on a keyless run" line is the tell.
3. **DoD gates must block or the completeness claim needs an asterisk.** P6 shipped red and
   the project says `complete`. For a product pipeline, either enforce-DoD for the
   brief-conformance criterion or surface `gate.passed:false` phases in `summary`/packet.
4. **Learning loop = call sites, not builders.** L1–L5 builders are done and tested; wire the
   three capture sites (finishPhase-L2, applyVerifyOutcome-L4, reframe-L1) before Phase 2 or
   Phase-1 lessons cannot demonstrably improve Phase-2 output (mission Phase-3 requirement).
5. **E-14 stamping should run on the overlay path** so `meta.liveUnavailable`/`modelRoute`
   don't contradict the live corpus (W5).
6. **Process honesty is real and worth preserving.** Every "fake" artifact here carries an
   honest label; the crew self-critiques truthfully; the machine-run verify really ran. The
   failure is product substance, not integrity — fix the codegen seam and the loop, keep the
   honesty lattice untouched.

## 7. Fix-spec index (for Phase 3/4 waves, all read-only observations)
- `engine.ts:1829` — swap `llmStatus()` server-fn guard for `isDeepSeekConfigured()` via
  concatenated dynamic import (W1).
- `headless.ts:240-252` — extend the E-12 overlay (or runPhase delegation) to phase 6 /
  codegen so keyed CLI runs reach liveP6Synthesis (W1).
- `headless.ts` advanceOnce seal arm + `store.ts:370` finishPhase — append
  `templateEmissionLesson` when sealing a phase with `gate.passed:false` (W4/L2).
- `headless.ts` applyVerifyOutcome pass arm — append `verifiedProcedureLesson` (W4/L4).
- `engine.ts:385-391` reframe HITL — append `vagueBriefLesson` (W4/L1).
- P8 artifact template + P8 synthesis — consume `implementationSpec`/expanded spec when
  present; fix the stale keyless-run sentence (W2).
- Optional: surface non-passing DoD gates in `summary`/packet; stamp E-14 in the overlay (W5).

*Evidence on disk:* `%TEMP%\rapidtool-make-b3\out\house-showing-final.json` (91.7 KB),
`00-…28-*.json` envelopes, `vault/` (50 notes), `scaff/` (14 files), `14-crew.json` (reviewer
FAIL verdict), `13-verify.json`, `22-prompt.json`.
