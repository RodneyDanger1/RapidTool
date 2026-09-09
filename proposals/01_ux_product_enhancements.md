# RapidTool Console — Product/UX Enhancement Candidates (E-101 … E-118)
**File:** `proposals/01_ux_product_enhancements.md` · **Date:** 2026-09-04 · **Author role:** enhancement designer (evidence-cited candidate list)
**Evidence base (read-only):** `agentnotes.md` Part 1 (walkdown) + Part 3.2 §1/§6/§8/§9 (UI audit: BUG-01…31, UX gaps, a11y) → companion `audit/02_ui_console_multiplayer_audit.md`; §2.1 → `research/01_parallel_repos_research.md` (M1–M13, G1–G22, borrow list); §2.2 → `research/02_industry_sdlc_grading_research.md` (§1 DoD/DoR, §10 approval UX, §11 adoption); §2.3 → `research/03_tech_deep_dives_research.md` (T1–T10); live code cross-checks (`src/lib/store.ts`, `types.ts`, `package.json`).
**Selection principle:** each candidate is SMALL (days, one module), fixes a registered bug or documented UX gap, and carries a research mechanism + citable URL. No engine re-architecture; where an engine touch is unavoidable (E-103/E-104) it is a thin additive seam.
**Effort key:** XS ≤ 0.5 d · S ≤ 1–2 d · M ≤ 3–5 d. **Value** = user-impact × evidence strength (audit severity + industry convergence). Rank = value ÷ effort.

---

## Ranking table (ranked by value ÷ effort)
| Rank | ID | Candidate | Fixes / gap | Effort | Research anchor |
|---|---|---|---|---|---|
| 1 | E-101 | Revisit any phase (read-only phase record from the rail) | UX 8.1.1, 8.3.2; BUG-27 | S | M1/G21 (LangGraph persistence) |
| 2 | E-102 | HITL evidence bundle before Approve (DoR for the human) | UX 8.1.8; 2.2 §10.2–10.3 | S | §10.1 Monperrus/NIST; HITL-v2 spec |
| 3 | E-103 | Gate decision journal (the "why" trail survives) | UX 8.1.3 | S | §10.1 NIST overrides; M1 event log |
| 4 | E-104 | Live run progress + cancel + honest running-state | BUG-03/16/07; UX 8.1.2, 8.3.1 | M | M10/G12, M9/G11 (AI SDK hooks) |
| 5 | E-105 | Rubber-stamp detector + approval-latency telemetry | 2.2 §10.2 weak-2 | S | §10.1 NIST RMF; §10.3 rule 4 |
| 6 | E-106 | Archive confirm + navigate home + "station" copy fix | BUG-01, §7.3 | XS | audit top-5 #1 |
| 7 | E-107 | Honest token/budget chip (real tokenizer + memo) | BUG-06, BUG-21; UX 8.2.1 | S | T1 gpt-tokenizer; M13/G16 |
| 8 | E-108 | Phase-scoped artifact browser (filter + selection fix) | BUG-27, BUG-05 | XS | M7/G7 artifact registry |
| 9 | E-109 | Autopilot explainer + policy readout | UX 8.1.5 | XS | M2/G18 policies; `canAutopilot` |
| 10 | E-110 | Packet freshness: staleness meta + refresh on open | BUG-21; UX 8.1.7, 8.2.4 | XS | M8/G8 budget discipline; T8 |
| 11 | E-111 | Store selector discipline (kill keystroke whole-tree re-render) | BUG-02, BUG-06 | M | T5 zustand selectors |
| 12 | E-112 | Real tab semantics (Radix Tabs, already installed) | BUG-15; §9.2.1 | S | T6; WAI-ARIA APG |
| 13 | E-113 | Status legibility, input labels, contrast sweep | BUG-18/19/30; §9.2.2–9.2.5 | S | T6 a11y; WCAG AA |
| 14 | E-114 | Clone with intent: fork-vs-snapshot + origin chip | UX 8.2.3; clone drops progress | S | M1 resume/fork; Aider git |
| 15 | E-115 | Cross-run diff (packet/artifact diff vs baseline clone) | UX 8.3.4 | M | M12/G15 spec-ledger diff |
| 16 | E-116 | Console dust-sweep: 8 micro-fixes, one PR | BUG-08/09/10/26/28, 8.1.7 | S | audit register |
| 17 | E-117 | Home overview: resume CTA + status chips + capped list | BUG-26; UX 8.1.4, 8.3.6 | S | M1 durable resume |
| 18 | E-118 | Multi-tab presence + single-writer guard (BroadcastChannel) | §7.3 "station"; T7/T10 | S | T10 phase-0; y-webrtc |

**Sequencing hint:** E-101→E-104 = one "readable paper trail + alive run" wave. E-103→E-105 chain (journal → telemetry). E-111 pairs with E-112 (same files). E-115 waits for E-114.

---

## E-101 — Revisit any phase: the rail becomes a read-only phase-record browser
**Problem.** PhaseRail (console.tsx L618–646) is display-only `<div>`s; the center column always shows the *current* phase (L308–317). For a "paper trail" product the operator cannot re-read Phase 0's scorecard, a past gate's evidence, or an earlier phase's artifacts in situ — audit calls this "the single biggest storytelling gap" (§8.1.1). The raw material already persists: every Artifact carries `phase` (types.ts).
**Research backing.** Durable, replayable phase history is the industry norm: LangGraph checkpoints (research/01 §4 M1 — https://docs.langchain.com/oss/python/langgraph/persistence), ChatDev log+replay, gpt-pilot `--step` rewind; gap G21 "replay/debug of past runs — RapidTool: None". Borrow shape: "persist append-only phase events … so runs can replay, rewind, fork" (agentnotes §2.1 M1).
**Exact change** (console.tsx + optional 10-line helper):
1. PhaseRail rows become `<button type="button">`.
2. New local state `viewPhase: PhaseId | null`; row click sets it, click on active row clears it.
3. When `viewPhase !== null && viewPhase !== project.currentPhase`, center column renders `<PhaseRecordView>` instead of the live header: banner "Viewing P{code} · read-only · {status}" + "Back to live phase"; phase summary; that phase's artifacts (ArtifactPane filtered by `a.phase === viewPhase`); ScorecardBlock when phase 0 & scorecard exists; gate decision line when gate phase (see E-103); matching traces.
4. `viewPhase === currentPhase` ⇒ today's behavior. No store change needed.
**UI sketch**
```
┌ P0 ✓─┐          P3 · ready   Running live phase...        ← click row
│ P1 ✓ │  click → ┌──────────────────────────────────────────┐
│ P2 ✓─┘          │ ◀ Viewing P2 · read-only · complete   [Back to live] │
│ P3 ▶ │          │ Memory & Context Consolidation                      │
│ P4 🔒│          │ Artifacts: [P2·memory] checkpoint · [P2·algo] A2 …   │
└──────┘          └──────────────────────────────────────────┘
```
**Verification.** Unit: `artifactsForPhase(project, phase)` filters only that phase. Manual: seed run P0–P2 → click P0 row → scorecard visible; Back-to-live returns to P3; rail rows keyboard-focusable. Typecheck + `npm test`. **Effort S · Value:** closes audit's #1 product gap with zero new data.

---

## E-102 — HITL evidence bundle: Definition-of-Review before Approve
**Problem.** HitlDock (L705–758) shows stakes + one confirmation sentence. The human must trust or deep-dive — the two ends of the rubber-stamp spectrum (2.2 §10.2). Evidence already on the project (sandbox `lastTest`, oracle cases, per-phase artifact titles, spec-graph order, contracts count, reviewer mandate) is never assembled in front of Approve.
**Research backing.** §10.1 "The End of Code Review" (Monperrus, https://arxiv.org/abs/2606.13175): agent-speed review degrades into rubber-stamping; §10.3 HITL-gate-v2: **evidence bundle mandatory — "no bundle, no request (DoR for the human)"**; §11 item 1 (per-phase DoD/DoR registries, evidence hashes, no silent PASS — Scrum.org/Agile Alliance DoD); UI pattern "diff-first presentation with evidence attachments" (§10.1); M3 "show evidence, not assertion" (research/01 §4 M3 — https://www.anthropic.com/engineering/claude-code-best-practices).
**Exact change** (console.tsx + pure helper, no store change):
1. `evidenceForGate(project): EvidenceRow[]` from existing state: sandbox verdict (`lastTest`), oracle count + first 3 case names, contracts entities/endpoints summary, this phase's artifact titles/kinds, reviewer-seat mandate line, spec order file count.
2. HitlDock gains a collapsible "Evidence for this gate (N)" block between prompt and buttons; Approve stays one click away; each artifact row opens that artifact in the viewer (reuses `onSelect`).
3. Empty bundle → explicit "No evidence recorded for this gate." (DoR honesty, §10.3 rule 1) — never a silent blank.
**UI sketch**
```
HITL · Sandbox and authorization boundary — high stakes
Approve isolation policy — Confirm 256 MB / 30s isolate, deny-network …
▸ Evidence for this gate (5)          ← collapsible, default open
  ✓ sandbox pass · tests.pass   ✓ Oracle 6 cases (AC-1, AC-2 …)
  ✓ A6 contracts 3 endpoints    ✓ Spec order 8 files · ✓ Reviewer: "A6+A7 green"
[ Approve ]  [ Reject (note ≥ 12) ]
```
**Verification.** Unit: `evidenceForGate` on a seeded gate project returns expected rows incl. lastTest; empty artifacts ⇒ honest empty line. Manual: drive to P4 gate → open dock → expand evidence → artifact row click loads viewer. Typecheck. **Effort S · Value:** direct NIST-aligned anti-rubber-stamp mechanism, zero data work.

---

## E-103 — Gate decision journal: approvals & rejections stay visible forever
**Problem.** UX 8.1.3: verdicts exist only as ephemeral log lines (L601–611); the rejection note is never shown again once the phase regenerates. `PhaseRecord.rejectionNote` persists (types.ts) but nothing renders it; approvals leave no human record at all.
**Research backing.** §10.1 NIST AI RMF 1.0 (https://doi.org/10.6028/NIST.AI.100-1): "Data about the frequency and rationale with which humans overrule AI system output … may be useful to collect and analyze"; §10.3 `human_action` record `{verdict, note ≥12, latency_s}`; §11 item 5 audit-log event store (SOC 2 CC6/CC7); M1 append-only `phase_events[]` (research/01 §4 M1).
**Exact change** (types + store seam + UI):
1. `types.ts`: `type GateDecision = { id; phase: PhaseId; verdict: "approved"|"rejected"; note?; actor: "human"|"autopilot"; at: number; latencyMs? }`; Project gains `decisions: GateDecision[]` (`emptyProject` seeds `[]`).
2. `store.ts`: `approve(id, meta?)` / `reject(id, note, meta?)` append `{actor:"human", note?, latencyMs: meta?.latencyMs}` (optional param keeps signatures backward compatible); autopilot auto-approvals (L61/L104 `approveHitl` call sites) append `{actor:"autopilot"}` via a `logDecision` flag.
3. `console.tsx`: HitlDock records `openedAt = Date.now()` on mount and passes `latencyMs` (feeds E-105). New right-rail **GATE LOG** section (or per-phase block inside E-101's PhaseRecordView): last N decisions as mono lines `P4 · approved · human · 41s`; rejected entries expand to show the note verbatim.
4. Migration: `hydrateProject` (engine.ts) backfills `decisions` from `phases[].rejectionNote`.
**UI sketch**
```
GATE LOG (right rail)      P4 · security   approved   human · 41s
                           P5 · validation rejected   human · 2m12s
                             ▸ "Oracle AC-3 has no rollback case — regenerate…"
```
**Verification.** Unit: approve/reject append correct records; legacy persisted projects hydrate a decision from `rejectionNote`. Manual: reject P5 with note → regenerate → note still visible on P5 record. Typecheck. **Effort S · Value:** NIST override-analytics primitive; unblocks E-105.

---

## E-104 — Live run progress + cancel + honest running-state
**Problem.** `execute`/`runUntilHitl` are fully synchronous (store.ts L132–163): status "running" (L84–91) is overwritten in the same tick and **never paints**; no spinner/progress/cancel; Execute + Run-to-gate stay enabled for `running` (BUG-03); no `aria-busy`, no `role="alert"` error (BUG-16); the "factory" feel is absent (8.1.2; 8.3.1 = audit's #1 unlock: "turns a form into a factory").
**Research backing.** M10 structured trace streaming — AI SDK lifecycle hooks `onToolExecutionStart/End` (research/01 §4 M10 — https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling), OTel GenAI agent spans (https://opentelemetry.io/docs/specs/semconv/gen-ai/); M9 bounded autonomy, step caps, escalation (research/01 §4 M9); cancel-by-heartbeat mirrors T3 Worker terminate (https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate). Borrow #11: "structured event stream feeding the diagnostics tab".
**Exact change** (UI first, thin engine seam second):
1. **UI (console.tsx):** branch action cluster on `rec.status`: `running` → `<PhaseRunning>`: pulsing dot (cf. E-113), mono line `step 3/8 · P4 security`, **Cancel** button, `aria-busy="true"` on phase block; Execute/Run-to-gate disabled (BUG-03); error line gets `role="alert"` (BUG-16).
2. **Store:** ephemeral non-persisted `run: {phase, step, total, startedAt} | null` + `cancelRequested` flag; `execute` becomes async, running the existing engine advance inside a scheduler that emits heartbeats between internal stages (`for s of stages { if (cancelRequested) return {ok:false,error:"Cancelled"}; set({run:{…}}); await tick(30ms) }`).
3. **Engine seam:** where `applyPhaseResult` sequences algorithm/trace work, expose per-phase `STAGES`; if none exist today, emit a deterministic 6–8-tick heartbeat while the sync result computes, then finish — never fake stages the engine doesn't have; real LLM steps later await between ticks.
4. Cancel semantics: phase returns to `ready`, log `run.cancelled`; deterministic reducer keeps the graph unharmed.
**UI sketch**
```
P4 · running ────● (pulse)      Security, Isolation & Authorization
[ Cancel ]        Execute / Run-to-gate: disabled        aria-busy
▸ step 4/8 · scanning OAuth scope probes · 2.1s
```
**Verification.** Unit (fake-async executor): execute emits increasing steps then completes; cancel mid-run leaves phase `ready` + `run.cancelled` logged; runUntilHitl honors cancel between phases. Manual: seeded project → Execute → spinner/progress visible (never painted before) → completes to gate. Typecheck. **Effort M (UI S + seam S–M) · Value:** the console's biggest perceived gap; precondition for real LLM wiring.

---

## E-105 — Rubber-stamp detector & approval-latency readout
**Problem.** §10.2 weak-2: "zero telemetry on the human side: no approval-latency tracking, no rubber-stamp detector … approval fatigue will arrive silently."
**Research backing.** §10.1 NIST AI RMF 1.0 — collect frequency AND rationale of overrides (https://doi.org/10.6028/NIST.AI.100-1); §10.3 rule 4: "warn when 7-day rolling mean approval < 20 s or reject rate < 5 % with reviewer-seat blocking findings > 0, then escalate the next N requests"; rule 5 → `overrides_by_phase, override_rationale_taxonomy, latency_by_tier`; Google review speed (https://google.github.io/eng-practices/review/reviewer/speed.html); §11 item 10 (HITL v2) rated S — cheap once E-103 exists.
**Exact change** (consumes E-103 `decisions[]`; ~40 lines + UI):
1. Pure `approvalHealth(decisions, windowMs=7d): {n, meanLatencyMs, rejectRate, flag:"fast"|"rubber"|"ok"}` in new `src/lib/gate-stats.ts` (no React).
2. HitlDock footer quiet mono line when n ≥ 3: `gates this run: 6 · mean review 34s · reject rate 17%`. When `flag==="fast"` (mean < 20 s AND reject rate < 5 %): amber nudge "You've approved the last N gates in under 20 s each — open the evidence bundle first." Soft nudge only; blocking escalation is a later knob.
3. Optional: after reject, offer conventional-comment labels as chips (§10.3 rule 3) — the rejection-taxonomy seed.
**UI sketch**
```
▸ Evidence for this gate (5)      [ Approve ] [ Reject ]
gate telemetry · 6 gates · mean 34s · 1 rejection (17%)   ← mono faint
```
**Verification.** Unit: `approvalHealth` thresholds (20 s / 5 % / n≥3), window edges; fast-approve fixture flags `fast`; mixed fixture `ok`. Manual: approve 3 gates fast on a seeded run → amber line. Typecheck. **Effort S (after E-103) · Value:** the prescribed anti-fatigue circuit breaker as a whisper, not a wall.

---

## E-106 — Archive: confirm, then land somewhere real
**Problem.** BUG-01 (P2, audit top-5 fix #1): `remove(id)` fires with no confirmation and no navigation (console.tsx L402–408); the user is stranded on `/run/$id` rendering the ghost fallback "That build is not on this station." (L200–209 — stranded multi-station copy, §7.3). Permanent data loss on one click (persisted store).
**Research backing.** Agentnotes §3.2 §12 top-5 #1; §8.3.3 "undo/archive-restore … confirm dialogs for Archive". Radix `@radix-ui/react-alert-dialog` **already installed** (package.json) — zero new deps.
**Exact change** (console.tsx only):
1. "Archive" opens Radix AlertDialog: "Archive {name}?" / "Phases, artifacts, memory and gate decisions are deleted from this browser." / `Keep build` | `Archive`.
2. On confirm: `remove(id)` **then** `nav({to:"/"})` — never the ghost screen.
3. Reword fallback copy → "This build doesn't exist or was archived." (Link home already exists).
4. Optional follow-up (not required): soft-delete `archivedAt` + restore in Builds list.
**Verification.** Manual: Archive → Keep cancels (project intact, URL unchanged); Archive confirms → home, project gone, no ghost. Unit: render test asserts dialog copy + confirm calls remove-then-navigate. Typecheck. **Effort XS · Value:** kills the only destructive one-click path + a stranded-copy confusion.

---

## E-107 — Honest token chip: real tokenizer, memoized, budget-context
**Problem.** Header chip `~{estimateTokens(project.packet).tokensEst} tok` (L290–292) uses the **len/4 heuristic** (algorithms.ts) — off >2× on code/JSON, the console's main content — recomputed every render (BUG-06), and can display a stale packet (BUG-21). UX 8.2.1: the algorithms module's only UI consumer powers a passive misleading chip.
**Research backing.** T1 (research/03 T1): "`len/4` is the worst kind of estimate … code, identifiers, JSON, and CJK text diverge by 2–5×"; recommendation: `gpt-tokenizer` (pure JS, sync, no WASM — https://github.com/niieani/gpt-tokenizer), model→encoding map, render `≈ 1,240 tok` with stated ± band, `isWithinTokenLimit` for over-budget, debounce + memoize (https://developers.openai.com/cookbook/examples/how_to_count_tokens_with_tiktoken; https://zats.io/blog/counting-tokens-in-foundation-models/). M13/G16 token accounting as product surface (Anthropic: token usage explains 80 % of eval variance — https://www.anthropic.com/engineering/multi-agent-research-system).
**Exact change:**
1. Add `gpt-tokenizer` (lazy `import()` per encoding).
2. `algorithms.ts`: reimplement `estimateTokens` → `encode(text).length` on `MODEL_TOKENIZER_MAP` (`grok-*` o200k-ish, `deepseek-*` cl100k); return `{tokens, bound:{lo,hi}}` (±15 %); signature kept.
3. `console.tsx`: `useMemo(…, [packet])` (BUG-06); chip renders `≈ 1,240 tok` with Radix Tooltip "estimate · o200k_base · ±15% · {modelRoute}".
4. Crew tab: seat `budgetTokens` vs packet-size context line now; `used/budget` when E-104 metering lands.
**UI sketch**
```
[ grok-4.5 ] [ local-edge · wasm 256MB ] [ ≈ 1,240 tok ⓘ ]   ⓘ estimate · o200k_base · ±15%
```
**Verification.** Unit: on a code-heavy fixture `estimateTokens` differs from len/4 by >1.5× and equals `encode().length`; render-count test proves memoization. Manual: type notes → chip doesn't recompute (with E-111). Typecheck. **Effort S · Value:** removes a misleading number (T1 shortlist #2, "highest correctness-per-hour") and seeds every later budget UI.

---

## E-108 — Phase-scoped artifact browser
**Problem.** BUG-27 (P2 UX): Artifacts tab's only filter is free-text over title/kind/body (L564–568); every artifact carries `a.phase` (rendered L789) but there is no phase filter. BUG-05 (P3): selecting A then typing a query excluding A leaves the preview showing a hidden artifact while the list can be empty.
**Research backing.** M7/G7 artifact registry as first-class navigation (research/01 §4 M7 — filesystem artifacts + references: https://www.anthropic.com/engineering/multi-agent-research-system; A2A artifact parts); 8.3.2 "per-phase artifacts filter" (E-101 consumes the same control).
**Exact change** (console.tsx only):
1. Next to the filter input (L555–562): `<select aria-label="Filter by phase">` — All / P0…P12 from `PHASES`, with counts (`P4 · 3`). Native select is fine and lightest.
2. `list = artifacts.filter(matchesQuery && (phase==="all" || a.phase===phase))`.
3. BUG-05: on query/phase change set `selected = null`; `activeArt` resolves inside the filtered set with fallback to newest; "No artifacts match" only when truly empty.
4. Give the filter input a label (a11y §9.2.4 — placeholder-only today).
**Verification.** Manual: after a 3-phase run pick "P2" → only P2 rows; select one, type excluding query → preview clears (BUG-05 gone). Unit: filter fn on 2-phase fixture. Typecheck. **Effort XS · Value:** flagged P2 browsing gap closed with a tiny diff.

---

## E-109 — Autopilot: explain what it actually does, show its scope
**Problem.** UX 8.1.5: "Autopilot · extra gates" checkbox (L293–300) has no explanation; store-global but lives in the run header; toggled blind. Real semantics (store.ts `canAutopilot` L42–46): auto-approves only **non-stock** HITL (`STOCK_HITL`, phases.ts) and only when schedule tightness < 7.2; stock gates P4/P5/P8/P9 always stop for the human.
**Research backing.** M2/G18 approval policies — LangGraph `interrupt` + policy, AI SDK per-tool `toolApproval` (research/01 §4 M2 — https://docs.langchain.com/oss/python/langgraph/interrupts; https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling): "per-tool/per-phase approval-policy table … so autopilot mode isn't all-or-nothing"; §10.1 risk-tiered permissions (Claude Code permission modes).
**Exact change** (console.tsx + copy only):
1. Replace bare checkbox with label + Radix Switch + helper copy (verified against `canAutopilot`): "Autopilot runs phases back-to-back. Locked gates (P4 security, P5 validation, P8 UI lock, P9 deploy) still stop for your approval. Extra gates the scheduler adds auto-approve only on low-tightness runs."
2. When `autopilot && project.hitl`: HitlDock banner appends "autopilot is on — this is a locked gate, so you're being asked" (answers the #1 autopilot confusion: why did it stop?).
3. a11y: `aria-describedby` between switch and copy.
**Verification.** Copy unit test asserting the explainer matches `canAutopilot` semantics (drift guard). Manual: autopilot on → stock gate still docks with the "locked gate" note; low-tightness extra gates auto-approve and appear in E-103 journal as `autopilot`. Typecheck. **Effort XS · Value:** removes a blind toggle + explains the most surprising behavior (why it stopped at a gate).

---

## E-110 — Packet freshness: say when it was compiled, refresh on open
**Problem.** BUG-21 (P3) + UX 8.1.7: packet tab renders `project.packet` verbatim (L501–504); `refreshPacket` runs only on copy/export (8.2.4); a stale packet is indistinguishable from a fresh one; the empty state "Execute a phase to compile the packet." presumes never-compiled.
**Research backing.** M8/G8 context discipline — packets must reflect the current run (research/01 §4 M8); T8 grounding: never assert ungrounded state (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents); audit §8.1.7 honesty theme.
**Exact change** (console.tsx + one store field):
1. Store: add `packetCompiledAt` to Project, set in `refreshPacket` (store.ts L223–241 already stamps an A4 trace `ranAt`) and by the engine when a phase completes.
2. Packet tab header (mono faint): `compiled after P5 · 3 phases ago`; when stale (any phase completed after compile): amber `stale — refresh` button calling `refreshPacket(id)`.
3. Empty state distinguishes: no A4 trace → "Execute a phase to compile the packet."; A4 exists but stale → amber line (never the misleading empty state).
**Verification.** Unit: `isPacketStale(project)`. Manual: run P3 → open packet (fresh) → execute P4 → stale banner → refresh clears it. Typecheck. **Effort XS · Value:** kills a silent-truth bug on the core interop artifact.

---

## E-111 — Store selector discipline (kill the keystroke whole-tree re-render)
**Problem.** BUG-02 (P2): `useRapid()` with no selector (L168–182) + `setNotes` per keystroke (L578–584) + un-memoized `estimateTokens` (L291) = one typed character in Notes re-renders the entire 801-line tree. BUG-06 same root. Audit top-5 #2 — silent on a 1-project demo, audible once the store grows.
**Research backing.** T5 (research/03 T5): "`useStore((s) => s)` anywhere in a keystroke path ⇒ every keystroke updates the store ⇒ whole subtree re-renders"; narrow primitive selectors + `useShallow` for compound outputs; transient updates for high-frequency state (https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow; https://zustand.docs.pmnd.rs/learn/guides/transient-updates-for-often-occurring-state-changes; zustand v5 removed default shallow equality). T5 target: "typing re-renders ≤ 3 components".
**Exact change:**
1. `console.tsx`: replace blanket destructure with narrow selectors (`useRapid(s => s.projects)`, `useRapid(s => s.autopilot)`); each component selects only its slice; compound picks wrapped in `useShallow`.
2. Notes textarea: local draft + commit on blur, or 250 ms debounce — never `setNotes` per keystroke; same for rename input.
3. `estimateTokens` in `useMemo` keyed on `project.packet` (BUG-06).
4. Optional per T5: keep E-104's ephemeral `run` slice out of the persisted store.
**Verification.** React DevTools "Highlight updates": typing in Notes re-renders ≤ 3 components (was the full tree). Render test: type 5 chars in Notes → header chips don't re-render. Typecheck + `npm test`. **Effort M (mechanical, wide diff) · Value:** audit's #2 fix; prerequisite for smooth E-104 telemetry.

---

## E-112 — Real tab semantics (Radix Tabs)
**Problem.** BUG-15 (P2 a11y): five styled `<button>`s (L464–500) with no tablist/tab/tabpanel roles, no `aria-selected`, no arrow keys; selected state is color+border only; panel switches not announced. §9.2.1.
**Research backing.** T6 (research/03 T6): Radix Tabs ships the full WAI-ARIA APG pattern and is **already installed** (@radix-ui/react-tabs ^1.1.13) — "the Radix route is strictly less code to maintain" (https://www.radix-ui.com/primitives/docs/components/tabs; APG: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
**Exact change** (console.tsx L464–500 swap):
1. `<Tabs.Root value={tab} onValueChange={setTab}>` (controlled; tab state local, L188) → `<Tabs.List aria-label="Run artifacts and agents">` → five `<Tabs.Trigger>` → panels in `<Tabs.Content>`.
2. T6 pitfall honored: `forceMount` (or lazy + keep-mounted) on panels so future live streams/previews never die on unmount; Radix manages `aria-hidden`.
3. Same PR: rename internal key `"tests"` → `"oracle"` (label already says Oracle — 8.1.7).
**Verification.** Keyboard: Tab in, arrows move+activate, Home/End; NVDA/VoiceOver announces "Oracle, tab, selected". axe on the tab region; render test asserts `aria-selected` toggling. Typecheck. **Effort S · Value:** P2 a11y bug fixed with an installed dep (audit top-5 #4).

---

## E-113 — Status legibility, input labels, contrast sweep
**Problem.** BUG-18 (P3): `ready/running/awaiting_hitl` share one accent dot in StatusGlyph (L648–653); rail scanning can't tell "ready" from "running" without the 11 px mono text. BUG-19: duplicated PhaseStatus→presentation maps (`statusTone` L22–29 vs glyph internals) drift. BUG-30: glyphs uncoordinated with the a11y tree. §9.2.4: Notes textarea (L578–584) + artifact filter (L555–562) unlabeled. §9.2.5: `text-faint` (#5c615e) ≈ 2.9:1 — below WCAG AA 4.5:1 on content-bearing 11–12 px captions (L111, L130, L591, L607, L736, L788…).
**Research backing.** T6/WAI-ARIA APG (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/); WCAG 1.4.3; audit §9.2 list.
**Exact change** (console.tsx + styles.css tokens):
1. One `PHASE_STATUS_META: Record<PhaseStatus, {glyph, tone, label}>` replacing `statusTone` + glyph internals (BUG-19); distinct shapes: `ready` hollow dot · `running` pulsing filled dot (`animate-pulse`, reduced-motion safe) · `awaiting_hitl` shield (lucide Shield installed) · `complete` Check · `locked` Lock · `rejected` X — glyphs `aria-hidden` + adjacent `sr-only` text (BUG-30).
2. Labels: Notes textarea `aria-label="Operator notes"`; filter `aria-label="Filter artifacts"` (§9.2.4).
3. Contrast: content-bearing faint captions lift to `text-muted` (#8b908c ≈ 5.6:1) or a new ≥4.5:1 token; true-faint only for decorative text.
**Verification.** axe on RunScreen (labels/contrast); unit: `PHASE_STATUS_META` shape-uniqueness; visual: ready/running/awaiting_hitl distinguishable without color. Manual SR spot check. Typecheck. **Effort S · Value:** daily rail legibility + 4 a11y violations in one small sweep.

---

## E-114 — Clone with intent: fork the brief or snapshot the run
**Problem.** UX 8.2.3: "Clone" (L367–376) silently builds a **fresh** project — `clone` calls `emptyProject({name: name+" copy", brief})` (store.ts L201–211) — so cloning mid-run to try another route loses all progress with no warning, and the copy arrives as "X copy" with no rename prompt and no visible relation to the origin.
**Research backing.** M1/G1 resume/fork semantics: a cursor that resumes or forks is the industry primitive (LangGraph `thread_id` resume, gpt-pilot `--step` — research/01 §4 M1, https://docs.langchain.com/oss/python/langgraph/persistence); Aider git: every state is committable and forkable (https://aider.chat/docs/git.html); M7 snapshot-as-artifact-copy.
**Exact change** (store.ts + console.tsx, small):
1. `clone(id, opts?: {mode?: "fork"|"snapshot"; name?: string})`:
   - `"fork"` (default; today's behavior, honestly labeled): fresh P0 run from the same brief — "Fork brief (start over from P0)".
   - `"snapshot"`: deep-copy phases/artifacts/packet/scorecard/memory/logs into the new project — progress preserved, a true run clone.
2. Console: Clone opens a small menu/dialog: name input (pre-filled "… copy") + mode choice (Radix Dialog/DropdownMenu installed).
3. Set `fromProjectId` on the copy; header chip on cloned projects: `fork of Northwind Dispatch @ P5` (mono faint), click navigates to origin. This chip is E-115's baseline pointer.
**Verification.** Unit: snapshot clone deep-equals phases/artifacts (distinct object identity, equal content); fork starts at P0 with same brief. Manual: P5 project → Clone → snapshot → new console shows identical rail + artifacts; origin chip navigates back. Typecheck. **Effort S · Value:** the "how do I experiment from here?" flow stops silently discarding progress.

---

## E-115 — Cross-run diff: compare a clone against its origin
**Problem.** UX 8.3.4: "Artifact diffing across clones … side-by-side packet/artifact diff between the original and a clone after a regenerate loop." Today artifacts live in per-project tabs; the paper trail can't show what changed between two attempts.
**Research backing.** M12/G15 spec-ledger-as-diff: every gate reviewable as a diff (Aider auto-commit per change — https://aider.chat/docs/git.html; ChatDev git mode); 2.2 §3 diff-first review presentation; M4 fresh-context review "sees only the diff + criteria" (research/01 §4 M4 — https://www.anthropic.com/engineering/claude-code-best-practices).
**Exact change** (needs E-114's `fromProjectId`):
1. Tiny dependency-free line-diff util `src/lib/text-diff.ts` (~60 L, Myers-lite over lines → `{added, removed, same}[]`) — no new npm dep.
2. Artifacts tab gains "Compare" when `project.fromProjectId` exists (or a baseline picker): select baseline project + artifact → unified diff `▼ baseline / ▲ this run`, ok/danger coloring, summary strip `packet: 214 lines changed · P5 oracle +2 cases`.
3. E-102 integration: when a baseline exists, evidence bundle appends `spec diff vs {origin}: N lines changed`.
**Verification.** Unit: text-diff on fixture pair (added/removed/unchanged counts); diff-selector stable row set. Manual: fork a P5 run, tweak brief, run P6 → Compare shows exactly the changed artifact bodies. Typecheck. **Effort M · Value:** high story value; defer until E-114 lands.

---

## E-116 — Console dust-sweep: eight micro-fixes, one PR
**Problem.** Registered P3 nits that each cost a small trust ding; individually trivial, together they separate "demo" from "tool".
**Research backing.** Audit register §3.2 §6 + T6/T8 conventions; all fix surfaces already installed (Radix, lucide).
**Exact change** (console.tsx; each bullet = one behavior):
1. BUG-08: clipboard failure → show error only; **stop** force-switching to Packet tab.
2. BUG-09: `URL.revokeObjectURL` after `setTimeout(…, 1000)`, not same-tick.
3. BUG-10: cap constraint chips at 6 like jobs/entities (L428–432) + "and N more" expander.
4. BUG-26: cap Home Builds list height (max-h + scroll) as the guard (search lands in E-117).
5. BUG-28: Escape in rename input cancels edit and restores the name.
6. BUG-17 belt-and-braces: `onReject` also guards ≥12 chars (store already guards at store.ts L178 — keep both layers).
7. 8.1.7: rename internal tab key `"tests"` → `"oracle"`.
8. BUG-31 partial: on <lg show a compact native phase `<select>` above the rail strip (13×148 px ≈ 1,924 px of scroll otherwise); keep the strip, add the ladder.
**Verification.** One manual click-path checklist per bullet (~5 min each); `npm test` green; typecheck. Bullets 1–7 are near single-line diffs. **Effort S · Value:** eight registered defects closed in one reviewable PR.

---

## E-117 — Home overview: resume CTA, status chips, searchable builds
**Problem.** UX 8.1.4/8.3.6: Builds card (L127–160) is the only multi-project surface — no "resume where you left off", no cross-project status, unbounded list (BUG-26). An operator returning to a queue must remember which run was mid-gate.
**Research backing.** M1 durable resume cursor — state already carries `currentPhase`/`status`; exposing it as a resume affordance is the UI half of "reusing the same thread resumes the same checkpoint" (research/01 §4 M1 — https://docs.langchain.com/oss/python/langgraph/persistence); 8.3.6 explicit audit ask.
**Exact change** (HomeScreen only):
1. Sort Builds by most-recent activity (max of phase startedAt/completedAt/log ts — derivable, or add `touchedAt` in store actions).
2. Row meta (L149–153) gains a project-status tone dot reusing E-113's meta map; `awaiting_hitl` rows get a warn tag "needs your approval".
3. Most-recent non-complete row gets `Resume →` CTA; card gets scroll cap (BUG-26 real fix) + ≥6-char filter input (search).
**UI sketch**
```
Builds (3)                          [filter…]
▶ Northwind Dispatch   ops · P4 · awaiting_hitl  needs your approval  [Resume →]
  Clinic intake v2      health · P9 · running …
  Shop quoting v1       field · P12 · complete ✓
```
**Verification.** Manual: seed 2 projects, complete one → order + resume CTA correct; awaiting_hitl tag shows; filter narrows. Unit: tone-map coverage for all 5 ProjectStatus values. Typecheck. **Effort S · Value:** the daily return-flow answers "where was I?" in 5 seconds.

---

## E-118 — Multi-tab presence + single-writer guard (BroadcastChannel)
**Problem.** §7.3: the only "shared" artifact is the stranded phrase "not on this station"; no awareness that the same build is open elsewhere — yet two tabs writing the same persisted store (zustand localStorage; future PGlite `idb://`) is a real hazard (T7: "two tabs opening the same idb:// DB concurrently corrupt/contend" — https://pglite.dev/docs/multi-tab-worker), and Archive from one tab would silently gut the other.
**Research backing.** T10 phase-0 (research/03 T10): "same-browser multi-tab via BroadcastChannel + the host-authoritative engine (no WebRTC at all) — proves the sync protocol"; y-webrtc README: same-browser tabs sync via BroadcastChannel (https://github.com/yjs/y-webrtc); audit §8.4 shared "factory floor" vision (host-authoritative control).
**Exact change** (new `src/lib/presence.ts` ~70 L + console.tsx + home):
1. `presence.ts`: heartbeat on `BroadcastChannel("rapidtool-presence")` — `{kind:"hello"|"bye", projectId, tabId}` on focus/visibility + 2 s interval while a run screen is open; `Map<projectId, Set<tabId>>`; export `usePresence(projectId)` hook (subscribe → count state).
2. RunScreen header chip (mono): `2 tabs viewing` when >1; tooltip "Another tab is viewing this build — Archive is disabled there." (second tab disables Archive, refresh via `storage` event).
3. Home: builds open elsewhere tagged `open in another tab` — the "station" concept becomes real, replacing the ghost copy (E-106).
4. Explicitly NOT multiplayer: presence + write-guard only, no state sync, no WebRTC (T10 phases 1–2 out of scope by design).
**Verification.** Manual: same run in two tabs → both show "2 tabs viewing" within ~3 s; Archive from A → B sees the E-106 fallback, not a ghost; closing a tab drops the count. Unit: presence reducer (join/leave/dedup by tabId, stale expiry > 5 s). Typecheck. **Effort S · Value:** cheap honest first step of the shared-session story + prevents a real dual-write hazard class.

---

## Explicitly out of scope (so the list stays small & honest)
- Real LLM wiring, real sandboxing (T3), WebRTC rooms + relay (T10 phases 1–2), PGlite/Neon store migration (T7), full checkpoint/replay engine (M1), A1–A8 algorithm repairs, per-tool approval policies (M2 full) — engine/architecture work; E-101/E-103/E-104/E-105/E-118 are shaped so those land *on top of* them later.
- Not re-proposed: preview-bridge P3s (BUG-11…14), multiplayer library defects M-1…M-12 (inert today), auth/app-data findings — owned by other workstreams.

## Cross-cutting acceptance criteria
- Determinism: no new async hazard outside the E-104 scheduler pattern; all new logic lands in unit-testable pure helpers (`evidenceForGate`, `approvalHealth`, `isPacketStale`, `text-diff`, presence reducer).
- a11y: new interactive elements ship roles/labels from day one (E-112/E-113 set the pattern).
- Honesty rule: no UI number, status, or empty state the data can't back (E-102 empty-evidence line, E-107 ±band, E-110 staleness, E-109 policy copy).
