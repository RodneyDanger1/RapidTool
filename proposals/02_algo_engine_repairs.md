# Proposal 02 — Algorithm/Engine Repair + Enhancement Specification

**Scope** : every bug B-01..B-25 of the core-engine audit (`agentnotes.md` Part 3.1 / `audit/01_core_engine_algorithms_audit.md`, §6 register) gets a verdict + exact fix spec; then 9 algorithm-level enhancement candidates (R-201..R-209) are proposed, backed by the tech deep dives (`agentnotes.md` Part 2.3: T1 token counting, T2 RRF, T3 sandbox, T4 SSR) and industry research (Part 2.2 §1: DoD/DoR registries + generic gate + verdict math v2).
**Evidence rule** : every fix below was re-verified against the real source in `src/lib/` at proposal time (file:line cited). No re-audit performed.
**Verdict taxonomy** :
- `FIX-SMALL` — contained change (≤ half a day), one file/function, no signature ripple beyond its own callers.
- `FIX` — 0.5–2 days, multi-file, small signature/type changes with a migration note.
- `DEFER` — real defect but owned elsewhere / untestable in this environment / blocked on infra; do the zero-risk documentation part now.
- `WONTFIX` — accepted behavior; remove the misleading claim instead.

**DoD for this proposal** : every `FIX*` item lands with the named unit tests green, extended `npm test` script entry, and no localStorage payload without a version marker (B-25). Test runner is Node's built-in `node --experimental-strip-types --test` (package.json `test` script already uses it for `app-data`); new suites are plain `src/lib/*.test.ts` files importing modules **relatively** (no `@/` alias) so the runner works unchanged. Extend the `test` script with: `node --experimental-strip-types --test src/lib/algorithms.test.ts src/lib/engine.test.ts src/lib/sandbox.test.ts src/lib/packet.test.ts src/lib/machine.test.ts`.

---

## 0. Verdict summary

| # | Sev | Verdict | Work item | Size |
|---|-----|---------|-----------|------|
| B-01 | P1 | FIX | Worker sandbox + terminate timeout, two-path runner, honest claims | 1–1.5 d |
| B-02 | P2 | FIX-SMALL | Scorecard arithmetic: real ranges + 2 hard rules so `reframe` fires | 0.5 d |
| B-03 | P2 | FIX | Failed-P6 approval guard + `forceHuman` HITL flag + autopilot exclusion | 0.5 d |
| B-04 | P2 | FIX | Rejection note threads into synthesis: response block, variant salt, P6 module | 1 d |
| B-05 | P2 | FIX-SMALL | `emptyProject`: memory first, packet second | < 0.5 d |
| B-06 | P3 | FIX-SMALL | Recompile packet on every `currentPhase` advance (stamp helper) | 0.5 d |
| B-07 | P3 | FIX-SMALL | Real `healSource` repairs or honest no-repair; no blind identical re-run | < 0.5 d |
| B-08 | P3 | FIX-SMALL | `clone` = deep copy with new id + suffix | < 0.5 d |
| B-09 | P2 | FIX | SSR-safe hydration: `skipHydration` + post-mount rehydrate + factory | 0.5–1 d |
| B-10 | P2 | DEFER | Neon migration parity (doc fix now; code parity with engine-db wiring) | doc: 0.1 d |
| B-11 | P2 | FIX | One algorithm run per mutation; split static/dynamic derived state; ranked reuse | 1 d |
| B-12 | P3 | FIX-SMALL | Unique memory ids via dedupe pass (stable suffixes) | < 0.5 d |
| B-13 | P3 | FIX-SMALL | `runUntilHitl` returns `stoppedReason` + surfaces mid-loop errors | 0.5 d |
| B-14 | P3 | FIX-SMALL | PHASE map lookup + shape validator; per-id repair shared with B-25 | 0.5 d |
| B-15 | P3 | FIX | Word-boundary + inflectional-stem lexing; longest-match field keys; copy fields | 1 d |
| B-16 | P3 | FIX-SMALL | Delete dead RRF accumulation branch; real multi-list fusion → R-201 | < 0.5 d |
| B-17 | P3 | FIX-SMALL | Phase→role activity map replaces architect-blind fallback | < 0.5 d |
| B-18 | P3 | FIX-SMALL | Sandbox copy derived from real mechanism (lands with B-01) | 0.2 d |
| B-19 | P3 | FIX-SMALL | Same fix as B-06 (packet artifact body refresh) | 0 d (with B-06) |
| B-20 | P3 | DEFER | pg global type-parser mutation: document shared-driver contract | doc: 0.1 d |
| B-21 | P3 | FIX-SMALL | Real BPE token counting (gpt-tokenizer), honest `≈ ±15%` chip | 0.5 d |
| B-22 | P3 | FIX-SMALL | Delete dead scorecard fallback; libraries derived per domain | < 0.5 d |
| B-23 | P3 | FIX-SMALL | Token-set domain inference w/ specificity scoring (rides B-15); label market data | 0.5 d |
| B-24 | P3 | FIX-SMALL | Loop bound derived from phase count; explicit cap stop reason | < 0.5 d |
| B-25 | P3 | FIX-SMALL | Versioned payload + one-shot migrate + logged per-id phase repair | 0.5 d |

Shared enabler used by B-03/B-06/B-13/B-24: extract the pure state-machine step out of `store.ts` into `src/lib/machine.ts` (`advanceOnce`, `runReady`, `canAutopilot`, `runUntilHitlMachine`) so the store becomes a thin zustand shell and the machine is unit-testable. This is the only structural refactor in the batch; every other fix is additive.

---

## Part A — Bug fix specs (B-01..B-25)

### B-01 — `sandbox.ts` "sandbox" is `new Function` + bypassable denylist + no timeout — FIX

Verified: `sandbox.ts:1` `FORBIDDEN` substring regex (`import\s` misses `import(`, `fetch(` unbanned, `this.constructor.constructor` unbanned); `sandbox.ts:10` `new Function(body)` executes in page global scope; no wall-clock cap anywhere although `types.ts:184` declares `timeoutS:30`. Freeze risk is real for any future non-template source; today's only producer (engine.ts:368-387) is engine-authored and bounded, so **staging is possible and safe**.

Fix spec — rewrite `sandbox.ts` as a small two-path runner (research T3: Worker + `terminate()` is the only browser primitive that kills a synchronous loop):

1. New pure builder (extract from engine.ts:368-387): `export function buildPhase6Module(args: {name: string; jobs: string[]; note: string}): string` — byte-deterministic template module. engine.ts case 6 calls it instead of inlining string assembly.
2. Sync path (unchanged synchronous API contract `{ok, detail}` — kept ONLY for engine-authored code):
   `export type SandboxResult = { ok: boolean; detail: string };`
   `export function runGenerated(source: string): SandboxResult` — now guarded: if `source !== buildPhase6Module(...)` reconstruction from the current project fields, **refuse** with `{ok:false, detail:"non-template source requires runSandboxed()"}`. Because a byte-identical template contains no user code (all dynamic inserts are `JSON.stringify`-escaped string literals, no loops), the sync path is bounded by construction. Keep the `FORBIDDEN` regex as a **linter only** (defense-in-depth, first check).
3. Async path (the real sandbox): `export async function runSandboxed(source: string, opts?: {timeoutMs?: number}): Promise<SandboxResult>`:
   - Spawn a **fresh** worker per run from a blob URL (`new Worker(URL.createObjectURL(new Blob([workerSrc])))`); worker body: `onmessage = (e) => { const fn = new Function("fetch","WebSocket","XMLHttpRequest","console", e.data.code); ... }` — network primitives shadowed with throwing stubs; `console` collected into a string array.
   - Host: `postMessage({id, code})`; resolve on matching-id reply; `Promise.race` with `setTimeout(() => worker.terminate(), timeoutMs)`; default `timeoutMs = project.sandbox.timeoutS * 1000` (30 s today — keep the config field meaningful); timeout returns `{ok:false, detail:"killed after <n>s"}`.
   - Structured-clone-safe payloads only (no functions/classes across `postMessage`); verify `event.data.id` so stale workers cannot inject results.
4. Engine wiring (kept small): `synthesizePhase` P6 keeps the sync path **only while** the source is byte-equal to `buildPhase6Module` output (guaranteed today). The async `runSandboxed` is exported, unit-tested, and declared the **only** legal entry for any future LLM/generative source producer (see R-209); when that producer lands, P6 becomes async at exactly one call site (applyPhaseResult) — no other signature changes.
5. CSP note: host page drops `'unsafe-eval'` ambitions; `worker-src 'self' blob:`.

Edge cases: timeout must also fire for `while(1){}` and `for(;;){}` (worker `terminate()` handles both); empty source → `{ok:false, detail:"empty source"}`; code that calls `postMessage` itself cannot spoof the host (id check); worker creation failure (CSP) → `{ok:false, detail:"worker unavailable"}` so P6 parks HITL instead of crashing.

Tests (`sandbox.test.ts`): `runSandboxedReturnsOkForTemplateModule`, `runSandboxedTimesOutInfiniteLoop` (while(1), 100 ms timeout, assert detail contains "killed"), `runSandboxedBlocksFetch` (code calling `fetch` → throws stub → ok:false), `runGeneratedRefusesNonTemplateSource`, `runGeneratedAcceptsByteIdenticalTemplate`, `buildPhase6ModuleIsDeterministic` (same args → identical bytes).

### B-02 — `verdict:"reframe"` unreachable — FIX-SMALL

Verified arithmetic (algorithms.ts:497-512): `feas = clamp(round(9 − complexity·0.15))` with complexity ∈ [3,10] yields feas ∈ {8,9} only; `sec = 8+Δ` ∈ [8,10]; `api = 7−Δ` ∈ [4,7]; `scale` ∈ {7,8}; `delivery` = 8 always (A1 fallback `["deliver-core-workflow"]`, algorithms.ts:169). Minimum overall = (8+7+8+4+8)/5 = **7.0** > 6 ⇒ engine.ts:208-216 reframe HITL dead.

Fix spec — recalibrate axes so genuinely weak briefs can score < 6, and add two stage-gate style hard rules (research 2.2 §1.3.C: "hard rules + kill thresholds", mirroring spec-kit `go / clarify / kill`):

1. Add `vague: boolean` to `IntentLattice` (types.ts): set in `intentLattice` when **both** fallbacks fired — no jobs AND no entities extracted from the brief (evidence the brief has no domain vocabulary).
2. New axis formulas in `feasibilityScorecard` (algorithms.ts:497-501), floors lowered so the spread is real (all clamped `max(1, min(10, …))`, still integer /10):
   - `feas = round(10 − complexity·0.6 − (complexity ≥ 8 ? 1.5 : 0))` → range ≈ 2..8 (complexity 3 → 8; complexity 8 → 4; complexity 10 → 3; +1.5 penalty pushes ≥8-complexity briefs to ≤ 4).
   - `scale = round(9 − (realtime ? 1.5 : 0) − (constraintLoad ≥ 3 ? 1 : 0))` → range 6..9.
   - `sec = round(7 + securityDelta·1.5)` → range 7..10 (unchanged semantics, wider bottom).
   - `api = round(8 − apiDelta·1.5)` → range 4..8 (Δ0 → 8 … Δ3 → 4).
   - `delivery = lattice.vague ? 4 : lattice.jobs.length <= 1 ? 6 : 8` → range 4/6/8.
3. Hard rules evaluated **before** the mean (verdict can never exceed these):
   - HR-1: `lattice.vague` ⇒ verdict `"reframe"` (brief too vague to scope — this is the "jobs empty" class the audit calls out).
   - HR-2: `complexity ≥ 8` ⇒ verdict never `"proceed"` (max `"proceed-with-guards"`); combined with the feas penalty this yields overall ≤ ~5.4 for maximal-risk briefs → `"reframe"` reachable through the mean as well.
4. Thresholds unchanged: `overall ≥ 7.5 → proceed`, `≥ 6 → proceed-with-guards`, else `reframe` (engine.ts:512 consumers untouched; P0 HITL branch at engine.ts:208-216 and `canAutopilot` interplay now live). Worst-case legitimate mean: (3+6+7+4+4)/5 = 4.8; typical health-ops brief ≈ (6..8 mean) unchanged in the proceed band.
5. `scheduleConstraints` untouched (A3 output feeds sec/api only via Δs already in the formulas).

Edge cases: complexity cap 10 unchanged (algorithms.ts:173); briefs with zero vocabulary terms now produce `vague:true` + reframe HITL at P0 (the intended "checkpoint can block" behavior); do NOT remove A1's job fallback (downstream A5/A6/A7 need ≥1 job) — vagueness is captured by the flag, not by empty arrays.

Tests (`algorithms.test.ts`): `feasibilityScorecardReturnsReframeForVagueBrief`, `feasibilityScorecardReturnsReframeForHighComplexity` (crafted lattice, complexity 10, marketplace Δ3, realtime, ≥3 constraints → overall < 6), `verdictNeverProceedWhenComplexityAtLeast8`, `feasibilityScorecardProceedForSolidBrief` (Northwind seed brief → ≥ 7.5), `intentLatticeMarksVagueWhenNoVocabularyHits`. Engine-level: `synthesizePhase0EmitsReframeHitlForVagueBrief`, `reframeHitlIsNotAutopilotApproved`.

### B-03 — Failed P6 sandbox sealed by approve; autopilot waves failures through — FIX

Verified: `approveHitl` (engine.ts:715-740) never inspects `lastTest`; `canAutopilot` (store.ts:42-46) auto-approves any non-stock HITL when `tightness < 7.2` — including the "Sandbox failed — review" gate (engine.ts:415) for every low-tightness domain; engine.ts:651-658 fallback is unreachable because case 6 always sets its own HITL when tests fail.

Fix spec:

1. `HitlRequest` (types.ts:80-85) gains `forceHuman?: boolean`. Set `forceHuman: true` in **both** P6 failure HITL producers (engine.ts:412-421 and the engine.ts:651-658 fallback — consolidate both into one helper `sandboxFailureHitl(phase, detail)` so the unreachable branch and the main branch can never drift).
2. `canAutopilot` (moved to `machine.ts`): add `if (project.hitl.forceHuman) return false;` — autopilot may never approve a gate the machine marked human-only. (Stock phases stay excluded as today.)
3. `approveHitl` stays pure/`Project → Project` but the **store** guard owns policy: `store.approve(id, opts?: {force?: boolean})` returns `{ok:false, error:"Failing sandbox output requires explicit override — tick 'I reviewed the failure'."}` when `project.hitl.forceHuman && phase === 6 && project.lastTest && !project.lastTest.ok && !opts?.force`. HITL dock (console.tsx HitlDock) shows an extra checkbox in exactly that state; checkbox state is local UI state (no schema change).
4. When an explicit force-approval happens, `approveHitl` (new optional arg `{force?: boolean}`) writes a `warn` log `hitl.approved_override` + prepends an episodic memory row (`score 0.4`, id from B-12 scheme): `Human overrode failing sandbox at P6: <detail slice>`. The phase still seals with `lastTest.ok === false` — now visibly, deliberately, and logged.
5. Extract pure machine (see shared enabler above) so `canAutopilot`/`advanceOnce` policy is unit-testable without the zustand singleton.

Edge cases: P6 scheduler-flagged HITL with **passing** tests (`forceHuman` false) stays autopilot-eligible as today (that gate is risk-flagging, not failure); failure HITL on phase 6 only — `forceHuman` on any other phase is ignored by policy; `approve` with wrong-phase HITL still rejected (existing guard store.ts:168-170).

Tests (`machine.test.ts` / `engine.test.ts`): `canAutopilotRefusesForceHumanHitl`, `canAutopilotStillApprovesSchedulerFlaggedPassingP6`, `approveRefusesFailedSandboxWithoutForce`, `approveWithForceSealsAndLogsOverride`, `autopilotCannotApproveSandboxFailure`, `p6FailureHitlCarriesForceHumanFlag`.

### B-04 — Rejection notes don't steer regeneration — FIX

Verified: `rejectHitl` stores the note + memory row (engine.ts:742-775); `unlockRetry` flips status to ready (engine.ts:777-783); re-running `synthesizePhase` is byte-deterministic except P6's canned `REJECTION` constant (engine.ts:367-387). Retry is theatrical for P0/P4/P5/P8/P9.

Fix spec — the note becomes a first-class input to synthesis:

1. Types: `PhaseRecord` gains `rejectionHistory?: { note: string; at: number }[]` (types.ts:87-93). `rejectHitl` appends `{note, at: Date.now()}` (keeps current single-slot `rejectionNote` for display/back-compat, packet.ts:22-25 reads it). A second rejection no longer erases the first.
2. `applyPhaseResult` derives a retry context before synthesis: `ctx = { attempt: phases[phase].rejectionHistory?.length ?? 0, note: last note ?? null }` and passes it to `synthesizePhase(project, phase, ctx)` (optional 3rd arg; existing callers unaffected). Only a phase with a stored rejection gets `attempt ≥ 1`.
3. Deterministic variant steering (no RNG — same note ⇒ same output, different note ⇒ different output):
   - `variant = stableHash(note) % 3` where `stableHash` is a small FNV-1a over the note (new export in algorithms.ts). Attempt counter raises a `regenDepth` band: `variant = (stableHash(note) + attempt) % 3`.
   - **P0/P4/P5/P8/P9/P11 (text phases)**: the phase's primary artifact gains a final section `## Rejection response (attempt #N)` that (a) quotes the note, (b) states 2-3 concrete deltas the regenerated plan makes (derived from note keywords against the LEX vocabulary — e.g. note mentioning `security|auth|oauth` adds an isolation-policy bullet; `ui|screen|layout` adds a surface bullet; unknown keywords fall back to a generic "scope tightened per operator note"), and (c) picks canned alternate phrasing for 1-2 paragraphs from the variant band so the artifact visibly differs from the rejected bytes.
   - **P6**: module builder `buildPhase6Module` (B-01) gains the variant band: v0 = today's module; v1 adds `test_rejection_addressed()` asserting `synthesize` returns `addressed:true` when `REJECTION` is set; v2 additionally classifies note keywords and adds a guard (note with `deploy|publish|prod` keeps the phase-9 deploy denial — today's behavior — while other notes relax it and instead assert job-guard integrity). The `REJECTION` constant (engine.ts:370) already flows in; the variant changes *behavior*, not just bytes.
4. Packet (packet.ts) already prints prior rejection notes; extend to the full `rejectionHistory` so a copied packet shows the loop context.
5. `notes` (operator steering channel, store `setNotes`) is appended to the compiled packet under `## Operator notes` — the audit's §8.4 finding that human corrections never reach the agent is closed here (2-line change in packet.ts).

Edge cases: attempt counter comes from history length, so reject → retry → reject → retry gives attempts 1,2 (variant shifts each cycle); identical note re-entered after a different note produces the same variant as the first time that note was used (determinism per note+attempt); empty/whitespace note impossible (store.ts:178 gate); P6 note containing template-breaking quotes is JSON-escaped before interpolation (unchanged).

Tests (`engine.test.ts`): `regeneratedP0ArtifactContainsRejectionResponse`, `sameRejectionProducesSameRegeneratedArtifact`, `differentRejectionProducesDifferentArtifactVariant`, `p6ModuleVariant1AddsRejectionAddressedTest`, `rejectionHistoryAppendsOnSecondReject`, `packetEmbedsOperatorNotes`, `applyPhaseResultPassesRetryContextOnlyAfterRejection`.

### B-05 — Packet compiled before memory bootstrap — FIX-SMALL

Verified: `emptyProject` (engine.ts:837-839) runs `attachAlgorithms` (packet says "(empty — treat Phase 0 research as first write)", packet.ts:86) and only then replaces `memory` with `bootstrapMemory` — A2/packet never saw the 3 boot rows.

Fix spec — reorder in `emptyProject`:
```
const ready = attachAlgorithms(base);            // A1-A8 + A4 packet (A2 sees empty memory: "warm start")
ready.memory = bootstrapMemory(ready.lattice!);  // 3 boot rows, ids boot-sem/boot-proc/boot-epi
ready.packet = compileAgentPacket(ready);        // recompile WITH memory → ranked memory section lists boot rows
ready.traces = replaceA4Trace(ready.traces);     // keep A4 trace summary honest ("compiled P0 packet")
return ready;
```
(`replaceA4Trace` = existing pattern from store.ts:233-236; extract tiny helper `upsertA4Trace(project)` shared with B-06.) Cost: one extra `fusionRank` at creation — absorbed by the B-11 memoization.

Tests (`engine.test.ts`): `emptyProjectPacketListsBootstrapMemory`, `emptyProjectPacketDoesNotSayMemoryEmpty`, `emptyProjectMemoryHasThreeBootEntries`.

### B-06 + B-19 — Stale packet / packet artifact after phase advance — FIX-SMALL

Verified: store `runReady` advances `currentPhase` to next and marks it ready **without** recompiling (store.ts:96-103); `approveHitl` recompiles the packet string (engine.ts:723 `attachAlgorithms`) but never refreshes the `packet` **artifact** body (applyPhaseResult's artifact re-pack at engine.ts:700-711 is not run by approveHitl); packet.ts:111 prints `P${min(12, currentPhase+1)}` = "only P12" at phase 12.

Fix spec — one shared helper, three call sites:

1. Engine export `stampPacket(project: Project): Project` (extract from store.refreshPacket logic, store.ts:223-241): recompiles `project.packet = compileAgentPacket(project)`, swaps the `kind==="packet"` artifact for `{id: packet-<currentPhase>, body: packet}` (pattern of engine.ts:701-711), and upserts the A4 trace.
2. Call sites: (a) store `runReady` after the auto-advance block (store.ts:96-103) — `updated = stampPacket(updated)`; (b) store `approve` after `approveHitl` (B-19 artifact divergence); (c) `refreshPacket` action now delegates to `stampPacket`.
3. packet.ts:111: emit the "Next legal edge" line only when `currentPhase < 12`, else `Next legal edge: none — pipeline complete.`

Edge cases: phase 12 complete → packet must not claim a P13; stamping must not duplicate packet artifacts (filter-then-append, engine.ts:701 pattern); `refreshPacket` on a blocked project still works (no phase change).

Tests (`packet.test.ts`/`machine.test.ts`): `autoAdvanceRecompilesPacketToNewPhase` (advance P0→P1, packet contains "P1 — Core Orchestration"), `approveHitlRefreshesPacketArtifactBody`, `packetAtPhase12OmitsNextEdgeLine`, `stampPacketDoesNotDuplicatePacketArtifacts`.

### B-07 — `healSource` no-op double-run — FIX-SMALL

Verified: `healSource` (sandbox.ts:18-23) only appends a missing `test_happy`, but the P6 template always defines it (engine.ts:377) ⇒ condition never true; engine.ts:388-392 then re-runs **byte-identical** source. The "self-healing refactor loop" is scaffolding.

Fix spec — make heal real and honest:

1. `healSource(source, error)` becomes a pure repair chain returning `{source: string; repaired: boolean}`:
   - R1 (existing): missing `test_happy` → append fallback definition.
   - R2 (new): error is `deploy blocked until rejection addressed` (engine.ts:374) and the rejection note contains none of `deploy|publish|prod|go-live` → return variant v2 module from B-04 with the phase-9 guard relaxed (keyword-classified rejection scope).
   - R3 (new): error mentions `unknown job` and the offending job string equals `lattice.jobs[0]` fallback (algorithms.ts:169) → regenerate module over the *first real* lattice job if any, else surface as-is.
   - Otherwise `repaired:false`, source unchanged.
2. engine.ts:388-392: run heal, and **re-run only when `repaired === true`**; when not repaired, log `heal.noop` once and record in `lastTest.detail = "<original error> (no automatic repair applicable)"` — the second identical `runGenerated` disappears.
3. P6 HITL prompt (engine.ts:418) gains `Heal attempted: yes/no`.

Tests (`sandbox.test.ts`, `engine.test.ts`): `healSourceReturnsRepairedFalseWhenNoRuleApplies`, `healSourceAddsMissingTestHappy`, `healR2RelaxesDeployGuardOnlyForNonDeployNotes`, `engineDoesNotReRunWhenHealDidNotRepair` (assert single `tests.fail` log), `engineRerunsOnceWhenHealRepaired`.

### B-08 — Clone loses progress — FIX-SMALL

Verified: store `clone` (store.ts:201-211) builds `emptyProject` from name+brief — zero progress copied.

Fix spec:
```
clone: (id) => {
  const project = byId(projects, id); if (!project) return null;
  const copy: Project = {
    ...structuredClone(project),          // JSON-safe per invariant B.3.4 (localStorage)
    id: crypto.randomUUID?.() ?? `p-${Date.now()}`,   // new identity
    name: `${project.name} (copy)`,
    createdAt: Date.now(),
    logs: [...project.logs, {ts: Date.now(), phase: project.currentPhase, level: "info",
           event: "project.cloned", detail: project.id}].slice(-200),
  };
  set(...) // prepend, select copy — unchanged shape
}
```
Semantics: a clone duplicates the build **at its current state** (phases, artifacts, memory, packet, HITL included) so the two runs can diverge from the same checkpoint — the UI label's promise. `notes` copied automatically via the spread.

Edge cases: cloned project awaiting HITL keeps `hitl` whose `phase === currentPhase` — approve guard (store.ts:168) still holds; cloning while `blocked` keeps the rejection state (retry applies on the copy too); `structuredClone` available in all target browsers (ES2022); fall back to `JSON.parse(JSON.stringify(...))` if a legacy runtime is ever targeted (not needed today).

Tests (`store.test.ts` via factory — see B-09): `clonePreservesPhasesArtifactsAndMemory`, `cloneGetsNewIdAndCopySuffix`, `cloneMidRunKeepsCurrentPhase`, `cloneOfBlockedProjectStaysBlocked`.

### B-09 — SSR hydration mismatch — FIX

Verified: store singleton hydrates synchronously at module import (localStorage is sync; zustand persist `onRehydrateStorage` store.ts:263-266) and `seedIfEmpty` creates the demo project **before first render**; SSR output renders an empty list ⇒ first client render ≠ SSR markup on every fresh visit (console.tsx:47-54 80 ms fallback confirms the fragility). Fix per research T4 (no module singletons for SSR; persisted slices hydrate after mount; skipHydration + manual rehydrate).

Fix spec:

1. Store module exports a factory instead of only a singleton:
   `export const createRapidStore = (init?: Partial<RapidState>) => create<RapidState>()(...)` and `export const useRapid = createRapidStore()` for current importers. `persist` config gains `skipHydration: true` and `version: 1` (payload versioning from B-25 slots in here); the `onRehydrateStorage` handler no longer seeds — it only sets `hydrated:true` when rehydration ran.
2. New `src/lib/client-bootstrap.ts` (client-only): `export function bootstrapClient() { const s = useRapid.getState(); void useRapid.persist.rehydrate().then(() => { s.seedIfEmpty(); }); }` — called from a `useEffect` in `routes/__root.tsx` (client effects never run during SSR). Seeding therefore happens **post-mount, post-hydration** — first client paint still renders `projects: []`, matching SSR bytes.
3. Mount-guard for components that must not paint persisted data pre-hydration: `HomeScreen`/`RunScreen` read a `mounted`/`hydrated` flag first and render the empty-state shell until `hydrated === true` (both already tolerate the empty shape; the 80 ms console fallback effect is deleted in favor of the deterministic bootstrap).
4. Provider/context pattern (T4 full pattern) is **not** required yet — single-user localStorage app, one store instance per tab is the intended design; the factory exists so tests and future multi-store needs can create isolated instances.

Tests (`store.test.ts`, `bootstrap.test.ts`): `storeFactoryCreatesIsolatedInstances`, `seedDoesNotRunBeforeRehydrate` (fresh factory: projects stays [] until `rehydrate()` resolves), `bootstrapSeedsDemoProjectOnEmptyStorage`, `bootstrapPreservesExistingProjects`.

### B-10 — Neon never auto-migrates (docstring vs code) — DEFER (doc now)

Verified: db.ts:183-188 docstring claims auto-apply "on both backends"; `createNeonSql` (88-106) has no migration pass — only `createPgliteSql` (139-157) applies `migrations/*.sql`. `db.ts` is orphaned from the engine (no core importer) and shared with the auth subsystem (another owner).

Do now (zero risk): correct the docstring to "PGLite auto-applies migrations at first query; Neon expects `npm run db:migrate` at build/deploy (package.json `build` already chains it)" + note in `scripts/migration-plan.mjs` header.
Defer (with spec for when engine↔db wiring lands, proposal R-2xx tracking): extract `applyPendingMigrations(run, {glob})` shared by both drivers and call it inside `createNeonSql` guarded by the same `_migrations` tracking table + transaction pattern (db.ts:152-155); untestable here without a live `DATABASE_URL`.

Tests: none this pass (documentation change); acceptance later: `neonBootWithUnmigratedSchemaAppliesPendingMigrations` in a Neon-integration suite.

### B-11 — Redundant algorithm runs — FIX

Verified: `attachAlgorithms` runs on every mutation — 2× per `applyPhaseResult` (engine.ts:648 pre-synthesis, 700 post-merge) plus 1× per approve and per seed/hydrate; each run executes A1-A8; `runAlgorithms` computes `ranked` that `attachAlgorithms` discards (engine.ts:623-640) while `compileAgentPacket` recomputes `fusionRank` a second time (packet.ts:10-14).

Fix spec — split derived state into static vs dynamic, run each once per mutation:

1. `runAlgorithms(project)` → two functions in algorithms.ts:
   - `deriveStatic(project): { lattice; schedule; specGraph; contracts; oracle }` — pure over `(brief, domain)` only (A1, A3, A5, A6, A7; verify: A3 uses lattice+domain, A5/A6/A7 lattice-only). Memoized: `cache = new Map<string, …>` keyed by `${project.id}|${brief}|${domain}` (bounded: entry evicted when the project is removed/edited; cap 50 entries, LRU by insertion). Lattice never changes after creation today (brief immutable) so this is a creation-time computation afterwards.
   - `deriveDynamic(project, static): { ranked; crew; traces; packet }` — A2 (query = `PHASES[currentPhase].title + brief + jobs` ⇒ depends on currentPhase + memory) + A8 (lattice + schedule + currentPhase) + A4 compile. No memo needed beyond B-06's "compile only when phase or memory changed".
2. `attachAlgorithms(project)` = `deriveStatic` (memo) + `deriveDynamic`; **the pre-synthesis call inside `applyPhaseResult` (engine.ts:648) passes the memoized static half** so A1/A3/A5/A6/A7 run 0 times on the second call; the post-merge call (engine.ts:700) recomputes only dynamic parts over merged memory/phase.
3. A2 single-run: `deriveDynamic` computes `ranked` **once** and hands it to `compileAgentPacket(project, ranked)` (new optional param, packet.ts:10-14 uses it when provided; signature stays valid for external callers). Delete `ranked` from the old `runAlgorithms` return type (dead export, audit §7) — no caller outside packet/attach.
4. `Date.now()` churn: traces re-stamped only when recompiled (dynamic path), so a mutation that changes nothing dynamic keeps the previous trace `ranAt` (B-06 stamping already re-runs only on advance/approve).

Edge cases: memory changes (rejection prepend, phase results) always bump the dynamic path (compare `memory[0]?.id + length`); same-phase re-execution after unlockRetry has new memory → fresh ranked; project edit of `brief` is impossible via UI today but the memo key handles it.

Tests (`algorithms.test.ts`): `deriveStaticIsMemoizedPerBriefAndDomain` (same reference on second call), `deriveStaticInvalidatesOnBriefChange`, `deriveDynamicReflectsMemoryChange`, `compileAgentPacketUsesProvidedRanked` (inject sentinel ranked; assert its ids appear verbatim — proves no second fusionRank), `applyPhaseResultRunsDynamicDerivationOnce`.

### B-12 — Memory id collisions — FIX-SMALL

Verified: `mem()` id = `` `${phase}-${kind}-${score}` `` (engine.ts:147) — two rows same phase+kind+score collide (e.g. re-running rejected P6 recreates `6-episodic-0.86`); React keys (console.tsx:588) and FusionRank's id-keyed map (algorithms.ts:203) misbehave.

Fix spec — deterministic dedupe at the merge point (engine.ts:682):
```
export function dedupeMemoryIds(rows: MemoryEntry[]): MemoryEntry[] {
  const seen = new Map<string, number>();
  return rows.map((m) => {
    const n = (seen.get(m.id) ?? 0) + 1; seen.set(m.id, n);
    return n === 1 ? m : { ...m, id: `${m.id}-${n}` };
  });
}
```
`applyPhaseResult` wraps the merged list: `memory: dedupeMemoryIds([...result.memory, ...primed.memory]).slice(0, 80)`. Deterministic: the same run history always yields the same suffixes (stable React keys across reloads). `rejectHitl`'s id already embeds `Date.now()` (engine.ts:766) — leave. Cap 80 applies post-dedupe (order preserved, newest-first).

Edge cases: >9 duplicates get `-10` (string suffix, no parsing anywhere); bootstrap ids (`boot-*`) never collide with `N-kind-score` shape; FusionRank's map now sees unique keys, so B-16's dead branch truly dies.

Tests (`engine.test.ts`): `applyPhaseResultProducesUniqueMemoryIdsAcrossReruns` (reject→retry→execute P6 twice; assert all ids unique), `dedupeMemoryIdsIsDeterministic`, `dedupeStableSuffixOrder`.

### B-13 — `runUntilHitl` swallows mid-loop errors — FIX-SMALL

Verified: store.ts:150-155 breaks on error after progress and returns `{ok:true, ran}` — UI shows success for a partial, erroring run.

Fix spec (inside the B-03 machine extraction): `runUntilHitlMachine(project, autopilot, opts?: {maxRuns?: number})` returns
`{ project, ok, ran, stoppedReason: "hitl" | "complete" | "blocked" | "error" | "cap" | null, error?: string }`:
- `"error"` when `advanceOnce` returned an error after ≥1 successful run (keep first error message in `error`); `ok:false` **only** when 0 runs succeeded (today's contract) — partial runs return `ok:true` + `stoppedReason:"error"` + `error`.
- Store `runUntilHitl` delegates; console.tsx renders a non-fatal line when `stoppedReason === "error"` (`Partial run stopped: <error>`) instead of silence.

Tests (`machine.test.ts`): `runUntilHitlReportsStoppedReasonHitl`, `runUntilHitlReportsMidLoopErrorWithProgress` (inject a machine step that fails at run 3 via dependency-injection hook `step?`), `runUntilHitlZeroRunsReturnsOkFalse`.

### B-14 — `PHASES[phase]` index coupling + silent wipe — FIX-SMALL (shared with B-25)

Verified: index-ordered array invariant is relied on everywhere (`PHASES[phase]` phases.ts:110, engine.ts:129, packet.ts:7, `project.phases[phase]` console.tsx:623, store.ts:53); `hydrateProject` wholesale-resets when length ≠ 13 (engine.ts:860-863) — B-25.

Fix spec:
1. `phases.ts`: export `const PHASE_BY_ID = new Map(PHASES.map(p => [p.id, p])) as ReadonlyMap<PhaseId, PhaseDef>`; `phaseDef(id)` = `PHASE_BY_ID.get(id)` (the currently dead export becomes the real lookup). Engine/packet/store read-sites switch to `phaseDef(id)` — array order stops being the meaning of ids for **PHASES** (project.phases stays an ordered array for persistence; see 2).
2. New validator (engine.ts, used by hydrateProject): `repairPhases(raw: PhaseRecord[]): { phases: PhaseRecord[]; repaired: boolean }` — per-id repair: keep every record whose `id` is a known `PhaseId` (dedupe by id, first wins), insert missing ids as `locked` (id 0 → `ready`), drop unknown ids; `repaired = true` iff anything changed. No wholesale reset ever again.
3. `priorsSealed`/`canEnter`/`advanceOnce` read phases by `.find(p => p.id === i)` semantics via the repaired array (order now validated at hydrate: assert `phases.length === 13 && phases.every((p,i) => p.id === i)`; if violated → repair + log, then proceed).

Tests (`phases.test.ts`/`engine.test.ts`): `phaseDefResolvesByIdIndependentlyOfOrder`, `repairPhasesKeepsKnownHistoryAndFillsMissing`, `repairPhasesDropsUnknownIds`, `hydrateProjectNeverWholesaleResets`.

### B-15 — Substring matching noise — FIX

Verified: `phraseHits` substring `includes` (algorithms.ts:131-134: "tech"⊂"technology", "scan"⊂"scanning", "bill"⊂"billable"); A1 weight freq double-counts (142); A6 field-bank key `name.includes(k)` (379: "jobs"→job bank, any "order"-containing name→order bank); `tokens` keeps "job"/"jobs" distinct (double-counted overlap, A2). Rides on B-23 domain inference.

Fix spec:

1. `tokens(text)` keeps its sanitizer but applies `stem()` per token: `stem(t)`: lowercase; if len ≤ 3 return t; strip longest of `ing|ed|es|s`; if the result ends in a doubled consonant, drop one (`scanning→scann→scan`, `routing→rout` — note `rout` vs `route`: rule 2); if the *original* ended in `e` after stripping `ing`/`ed`, re-add nothing — instead compare e-less. Concretely compare canonical `c(t) = stem(t)` and treat `route`/`routing` equal via `c("route") = rout` (strip trailing `e` before suffix rules when len > 4). Keep stopword filter **before** stemming (STOP words are unstemmed literals). This unifies "job"/"jobs", "schedule"/"scheduling", "invoice"/"invoicing".
2. `phraseHits(text, vocab)` matches on the **token set of the text**, not substrings: `textTokens = new Set(stemmedTokens(text))`; term hits iff `termTokens(term)` (stemmed, phrase-terms all) ⊆ tokens, where single-term vocab entries match by stem equality, and multi-word terms (e.g. "same-day", "follow-up") match as full token equality on the hyphenated token (tokens() keeps `+`/`-` inside tokens, algorithms.ts:126). "tech support" no longer produces actor `tech` unless the token `tech` exists; "scanning" still yields job `scan` via stemming — the *intended* recall with no false prefixes.
3. A1 freq (142): count bag tokens whose stem equals the term's stem (or contains the first word's stem for phrases) — no `term.includes(t)` direction.
4. A6 longest-match keys (379): `key = [...Object.keys(FIELD_BANK)].sort((a,b)=>b.length-a.length).find(k => nameTokens.some(t => t === c(k)) || (k==="job" && nameTokens includes c("jobs")))` — tokens of the entity name compared by stem; longest key wins ("sales-order" → order bank via token `order`, never default; "job-board" → job bank). Also **copy** the bank arrays: `fields: (FIELD_BANK[key] ?? FIELD_BANK.default).map(f => ({...f}))` — kills the shared-reference hazard (audit A6 card).
5. `overlap` unchanged (operates on already-stemmed tokens).

Edge cases: vocab term that is a substring of a *different* single token but legitimately absent as a word now correctly misses (fix target); plurals in LEX ("jobs" object term) stem to the same canonical as "job" — dedupe on `kind:stemmedLabel` in A1 (150-156) so actor `job` + object `jobs`… careful: "job" appears as actor AND object vocab with different intents; A1 dedupes on `kind:label` today and keeps dual roles intentionally (audit A1 card). With stemming, actor term "job" and object term "jobs" from one brief produce two nodes with identical stem — keep both labels but that's the pre-existing dual-role design; dedupe key becomes `kind:label` unchanged, no behavior loss.

Tests (`algorithms.test.ts`): `phraseHitsDoesNotMatchSubstrings` ("technology support" → no `tech`), `phraseHitsMatchesPluralViaStem` ("scanning barcode" → `scan`), `tokensStemsJobAndJobsEqually`, `synthesizeContractsPicksLongestMatchingKey` ("sales-order" → order fields), `synthesizeContractsCopiesFieldArrays` (mutating one entity's fields leaves the other untouched), `intentLatticeNoFalsePrefixWeights`.

### B-16 — Dead RRF accumulation branch — FIX-SMALL (real fusion → R-201)

Verified: algorithms.ts:217-218 `prev.rrf + rrf` unreachable — items are partitioned by kind (196-201), so each id appears in exactly one bucket. Also: the "1-entry kind always outranks crowded kinds" artifact (rank-0 rrf 1/61 regardless of population).

Fix spec (minimal, now): restructure `fusionRank` to score each item in one pass per kind (drop the `fused` map + accumulation branch entirely — return per-kind ranks merged and sorted by the existing blend formula). Document the function honestly: "per-kind ranked blend with kind prior — **not** RRF (single list per item)". The kind-population imbalance is then mitigated by normalizing the per-kind rank contribution: `rrf = 1/(60 + rank_i + kindSize·0.5)` (crowded kinds discount slower). The *true* multi-retriever RRF over a shared candidate universe is delivered by R-201 (T2 research), which replaces this function's internals and deletes the blend constants (`ce`) per the research's "never expose per-kind ce constants pretending to be RRF".

Tests (`algorithms.test.ts`): `fusionRankNoDeadAccumulation` (structural: every id appears once in the ranked output), `crowdedKindTailCanBeatSingletonKindWhenRelevant` (a strong textual match in a 100-row kind outranks a weak singleton), `fusionRankReturnsDeterministicOrder`.

### B-17 — Crew fallback force-activates architect — FIX-SMALL

Verified: algorithms.ts:460 `if (!seats.some(active)) seats[0].active = true` — P4/P7/P11 show architect `[ACTIVE]`; implementer never active on P7.

Fix spec — explicit phase→role table replaces the blind fallback:
```
const ACTIVE_BY_PHASE: Record<number, CrewRole[]> = {
  0:[architect],1:[architect],2:[architect],3:[architect],
  4:[reviewer],            // security/isolation review — reviewer mandate extended for P4
  5:[reviewer,tester], 6:[implementer,tester], 7:[architect],   // market research = architecture synthesis
  8:[implementer], 9:[reviewer], 10:[implementer], 11:[implementer], 12:[reviewer],
};
```
`routeCrew` sets `active: ACTIVE_BY_PHASE[phase]?.includes(role) ?? false`, and **no** post-pass fallback: the table covers every phase 0..12 (a `Map` + a `for (0..12) assert coverage` unit test prevents future gaps). Seat mandates gain a phase-conditional tail so the active role's mandate reads correctly for P4 ("Review isolation policy against the threat model…") and P7 ("Synthesize market findings into architecture deltas…") — templated, deterministic.

Tests (`algorithms.test.ts`): `routeCrewEveryPhaseHasAtLeastOneActiveSeat` (property over 0..12), `routeCrewP4MarksReviewerNotArchitect`, `routeCrewP7MarksArchitectOnly`, `routeCrewP11MarksImplementer`, `routeCrewMatchesPacketOutput` (packet crew lines show [ACTIVE] exactly on table roles).

### B-18 — Sandbox claims are fiction — FIX-SMALL (ships with B-01)

Verified: packet.ts:77 hard-codes "net-deny on generated exec"; types.ts:181-186 + engine.ts:817-822 declare `wasm/256MB/30s/isolated`; the real path is `new Function` with no caps (sandbox.ts). B-01 turns the mechanism real; this fix makes the **copy** derive from it.

Fix spec:
1. `Project.sandbox` semantics (types.ts:181-186): `runtime: "worker" | "sync-template"` (drop aspirational `wasm|cgroups-v2|gvisor` from the union; hydrate maps legacy values → `"worker"`), `ramMb` removed or set `null` unless quickjs memory caps land (R-2xx; do not display), `timeoutS` stays and is **enforced** by `runSandboxed`'s terminate (B-01), `isolated: true` stays.
2. New `sandboxClaim(sandbox): string` (sandbox.ts): `runtime === "worker"` → `Worker isolate, ${timeoutS}s hard cap, network primitives stubbed (fetch/WebSocket/XHR throw)`; `"sync-template"` → `Engine-template runner (bounded, no user code)`. packet.ts:77 and the P4 policy artifact (engine.ts:311-315) use it — one source of truth, both honest.
3. `emptyProject` defaults new projects to `runtime: "worker"` once B-01 lands; legacy hydrated rows get the claim of their mapped runtime.

Tests (`packet.test.ts`, `sandbox.test.ts`): `packetSandboxLineClaimsOnlyImplementedMechanisms`, `sandboxClaimWorkerMentionsTimeoutAndNetworkStub`, `hydrateMapsLegacyRuntimeToWorker`.

### B-19 — see B-06 (same root cause; fixed by `stampPacket` at the approve + auto-advance sites). Zero additional work.

### B-20 — pg global type-parser mutation — DEFER

Verified: db.ts:93-95 `types.setTypeParser(20, Number)` mutates the process-global `pg` parser registry; any other `pg` consumer (auth's shared driver) silently gets int8→number, losing precision past 2^53. Core engine never imports `db.ts` today, and auth owns the shared-driver contract.

Do now: module docstring on db.ts explaining the global contract ("this process registers int8→Number globally; consumers needing BigInt must cast `::text` in SQL — see comment db.ts:41-46") and a pointer in the auth layer's dialect file.
Defer (when engine wiring lands): scope parsers per pool via `pg.Pool({ types: … })` custom instance or move the registration behind an explicit `registerCoreTypeParsers()` that auth calls before its Kysely dialect — decision recorded in an ADR at wiring time, not now.

Tests: none now; acceptance later in the Neon integration suite: `int8RoundTripsAsNumberInCoreQueries`, `otherPgConsumersUnaffectedByCoreRegistration`.

### B-21 — `estimateTokens` len/4 heuristic — FIX-SMALL (research T1)

Verified: algorithms.ts:593-596 `len/4`; console.tsx:291 renders `~{tokensEst} tok`; `usd` never consumed (dead export, audit §7). T1: 4 chars/token is off by 2-5× for code/JSON — RapidTool packet content is mostly code + JSON.

Fix spec:
1. Add dependency `gpt-tokenizer` (pure TS, synchronous, no WASM — T1's recommended option; ~compact vocab, lazy-loadable).
2. `estimateTokens(text: string): { tokensEst: number; tokensLo: number; tokensHi: number }`:
   - `tokensEst = text.trim() ? encode(text).length : 0` (default `cl100k_base`; model map `{ "grok-*": "cl100k_base", "deepseek-*": "cl100k_base" }` with a comment that neither vendor publishes a browser tokenizer — closest-encoding rule per T1).
   - `tokensLo = round(tokensEst * 0.85)`, `tokensHi = round(tokensEst * 1.15)` — the ±15% honesty band T1 prescribes; the UI chip renders `≈{tokensEst} tok` with a `±15%` title/tooltip instead of false precision.
   - Delete `usd` (dead) — or return `usd?: number` computed from `gpt-tokenizer`'s cost tables only when a known model is configured; not rendered anywhere yet.
3. Perf: module-level LRU cache keyed by `fnv1a(text)` (cap 100); console.tsx memoizes the estimate with a 150 ms debounce (skip recompute when `project.packet` reference unchanged — B-06 stamping already minimizes packet churn).
4. `gpt-tokenizer` import is ESM-safe in the TanStack/Vite client bundle; keep it out of server routes (not needed there).

Edge cases: empty packet → 0 tokens (was `max(1, …)`); enormous packets (14000-char cap) encode in ~1 ms (fine on main thread); non-ASCII/CJK briefs now count honestly instead of len/4's 2-5× error.

Tests (`algorithms.test.ts`): `estimateTokensCountsCodeHeavierThanLenOver4` (JSON-heavy string: tokensEst < len/4·0.6), `estimateTokensEmptyIsZero`, `estimateTokensBandContainsEstimate`, `estimateTokensCacheHitReturnsSameObject`, `consoleChipUsesEstimateNotLen` (component-level assertion in the UI suite).

### B-22 — Dead scorecard fallback + hard-coded libraries — FIX-SMALL

Verified: engine.ts:76-85 placeholder branch is unreachable (`attachAlgorithms` always primes lattice/schedule — invariant B.3.3); engine.ts:89-95 `libraries` is static marketing copy not derived from anything.

Fix spec:
1. Delete the `if (!lat || !sched)` placeholder branch; `scorecard(project)` documents the precondition (`lattice && schedule` present — guaranteed post-`emptyProject`/`hydrateProject`/every mutation) and reads them directly. Type-level guard: accept `Project` narrowed by `lattice != null`.
2. Replace the static list with `librariesFor(domain, lattice)` in algorithms.ts — a small deterministic table: base row (TanStack Start: typed shell; Zod: schema lock) + domain rows (health-ops → HIPAA-aware logging/audit libs; finance-ops → ledger + payment SDKs; marketplace → checkout/dispute; logistics → geo/dispatch; agent-platform → FastMCP/Ollama/LiteLLM — the current copy lands here, honestly labeled) + constraint rows (realtime → WS lib; offline → sync engine). Artifact text gains a footnote: "Illustrative baseline — verify licenses before adoption" (closes the B-23-adjacent fabrication concern for libraries too).
3. `FeasibilityScorecard.libraries` type unchanged.

Tests (`engine.test.ts`): `scorecardDerivesLibrariesFromDomain`, `scorecardLibraryRowsFollowConstraints`, `scorecardRequiresPrimedProject` (no placeholder path — constructing with null lattice throws a descriptive invariant error in tests only? no — assert the function reads primed fields; keep runtime behavior pure).

### B-23 — `inferDomain` first-match misrouting + static competitors — FIX-SMALL (rides B-15)

Verified: engine.ts:51-62 regex ladder — "healthcheck tool for fleets" → health-ops before logistics; `marketFor` (15-41) appends Cursor/v0 rows to every domain and rows are static strings presented as research.

Fix spec:
1. Replace the regex ladder with token-set scoring using the B-15 stemmer: `DOMAIN_TERMS: Record<domain, string[]>` (terms per domain, stemmed at module load). `inferDomain(brief)`: tokenize+stem the brief once; `score(d) = Σ_term∈terms(d) (tokenStem === stem(term) ? stem(term).length : 0)`; pick max score; ties break by the declared order (documented). "healthcheck tool for fleets": tokens {healthcheck, tool, fleet…} — `health` ≠ `healthcheck` stem (`healthcheck` stems to `healthcheck` — no suffix rule strips `check`), so health-ops scores 0; logistics scores `fleet` → correct routing.
2. Keep the regex table as a fallback for multi-word domain idioms (e.g. "revenue ops", "crm") — word-boundary token match covers single terms; idioms list adds phrase tokens.
3. `marketFor` rows: add `source: "illustrative" | "cited"` to `Competitor` (types.ts) — all current rows `illustrative`; P7 artifact + packet print `Illustrative market snapshot — verify before decisions` (packet.ts artifact trimming already flows through). No URL fabrication until a real research phase exists (P11 live tooling is the future cited path).

Tests (`engine.test.ts`): `inferDomainHealthcheckToolForFleetsIsLogistics`, `inferDomainClinicBriefIsHealthOps`, `inferDomainMarketplaceWithHealthWordsWinsBySpecificity` ("patient marketplace for clinics": marketplace `marketplace+buyer` terms vs health `clinic+patient` — both 2 hits; tie-break by total matched length, patient+clinic (13) vs marketplace+buyer (14+4) — expected per rule; encode the chosen rule in the test), `competitorRowsCarryIllustrativeSource`, `p7ArtifactDeclaresSnapshotCaveat`.

### B-24 — `runUntilHitl` magic 16 cap — FIX-SMALL

Verified: store.ts:148 `for (let i = 0; i < 16; i++)` unlabeled; if gate topology changed, 16 could truncate a run with `ok:true`.

Fix spec (inside the machine extraction, B-13): `maxRuns` derives from the graph: `(13 − currentPhase) · 2 + 2` (worst case: every remaining phase parks a HITL that autopilot approves — 13 advances; each advance is one loop iteration; dynamic extras can at most double the count — bound +2 margin). Loop invariants: each iteration either advances `currentPhase` or returns a terminal/error state, so the derived bound is a *defensive* ceiling, not a policy; hitting it returns `stoppedReason:"cap"` (visible, not silent). `advanceOnce`/`runReady` unchanged.

Tests (`machine.test.ts`): `runUntilHitlCapDerivesFromPhaseCount` (phase 5 start ⇒ maxRuns = 18), `capStopReturnsStoppedReasonCap`, `fullAutopilotRunCompletesWithoutHittingCap` (synthetic 13-phase project, autopilot on, stock gates excluded ⇒ stops at complete with ran == phases executed).

### B-25 — `hydrateProject` silent reset — FIX-SMALL

Verified: engine.ts:842-867 default-fills every boot (`seedIfEmpty` maps all projects, store.ts:244-247) and wholesale-rebuilds `phases` when length ≠ 13 with no log; no payload version exists.

Fix spec:
1. Payload versioning: zustand `persist` config gains `version: 2` + `migrate(persisted, version)` (B-09's factory change hosts this): v1→v2 migration = run `hydrateProject`-style filling once, stamp `_v: 2` on each project, append a `migration.ran` log entry (`detail: "v1→v2"`). `partialize` persists `_v`. Hydrate skips re-filling when `raw._v === 2 && raw.phases` valid (length 13, ids 0..12 in order).
2. Phase repair uses B-14's `repairPhases` (per-id, history-preserving) — never a wholesale reset; when `repaired === true`, append log `hydrate.repaired` listing dropped/inserted ids + `console.warn` once in dev.
3. `seedIfEmpty` stops re-hydrating projects whose `_v === 2` (pass-through), so boot cost for existing projects drops to a version check.

Edge cases: corrupted localStorage (truncated JSON) → zustand persist drops the key and seeds demo (existing behavior, now logged); a project saved by a *newer* version (`_v > 2`) → pass through untouched (forward-compat rule, logged once).

Tests (`engine.test.ts`): `hydrateProjectDoesNotMutateWhenVersionMatches`, `hydrateProjectRepairsPhasesPerIdKeepingHistory`, `hydrateProjectLogsRepair`, `migrateV1ToV2PreservesPhaseHistoryAndAppendsMigrationLog`.

---

## Part B — Algorithm enhancement candidates (R-201..R-209)

Ranked by value-per-effort for the *engine as an artifact generator + governed graph*. Each: motivation (evidence) → spec → sequencing → tests. All are additive on top of Part A; none changes the 13-phase contract.

### R-201 — True multi-retriever RRF + hybrid ranking over memory (replaces A2 internals) — 1–1.5 d
**Motivation** : research 2.3-T2: A2's kind-bucketed pseudo-RRF "is not RRF" — RRF needs ranked lists **over the same candidate universe**; Anthropic contextual-retrieval measured −49% top-20 retrieval failures for BM25+embeddings fused by RRF(k=60). RapidTool's memory is small (<80 rows) but the *scoring architecture* is the seed for the packet's ranked-memory section and any future RAG.
**Spec** : candidate universe = all memory entries. List-1 = MiniSearch BM25 over `text` (new dep `minisearch`, in-memory, zero deps, custom `processTerm` = B-15 stemmer); List-2 = recency/score signal (score·0.15 + 1/(1+ageDays) — a real second *retriever*, not a weight); List-3 (optional) = kind prior as a boolean filter list (procedural ⊇ semantic ⊇ episodic when query mentions graph rules). `rrfFuse(lists, k=60)` = verbatim TS port of the Anthropic function (dedupe by id, 1-indexed ranks). Delete the `ce` blend constants; per-kind display bucketing moves downstream of ranking (T2: "buckets become a UI concern"). `fusionRank` keeps its public signature (`query, memory, limit`) so packet.ts callers don't change.
**Sequencing** : after B-16 (dead-branch removal) and B-15 (stemmer) — both are prerequisites; delivers the "real RRF(k=60)" the P2/P12 artifacts already claim.
**Tests** : `rrrFuseMatchesAnthropicReference` (replay the research post's worked example), `rrfBoostsItemsPresentInMultipleLists`, `fusionRankSingleKindPopulationDoesNotDominate`, `packetRankedSectionUsesFusedScores`.

### R-202 — Intent-lattice lexer v2: token-lattice + domain boosting — 1 d
**Motivation** : B-15 fixes *noise*; this fixes *recall*. The LEX vocabulary (algorithms.ts:22-109) is static and domain-flat: a "patient marketplace" brief splits intent across health and commerce with no interaction, and weights cap at 1.0 (A1 card, audit Appendix A).
**Spec** : two-stage lattice. Stage 1 = B-15 token matching producing *matched terms with positions*; Stage 2 = domain-boost pass: `boost = DOMAIN_RISK[domain].security`-style tables per domain that (a) re-rank nodes by `weight = min(1.5, baseWeight + domainAffinity(kind,label,domain))`, (b) synthesize *cross-domain nodes* when ≥2 domains co-occur (e.g. health+marketplace → `phi-safe checkout` constraint node), (c) replace the flat complexity formula with a token-entropy term so a brief that repeats one word 10× doesn't inflate complexity. Keep output shape (`IntentLattice`) — downstream A3/A5/A6/A7/A8 untouched.
**Sequencing** : after B-15 (same lexer core). **Tests**: `latticeWeightsRespectDomainAffinity`, `crossDomainBriefGainsCompoundConstraint`, `repeatedVocabularyDoesNotInflateComplexity`, `latticeOutputSchemaUnchanged`.

### R-203 — Machine-checkable per-phase DoD registry + generic gate — 1–1.5 d
**Motivation** : research 2.2 §1: RapidTool gates check "approval given" more than "artifacts satisfy named exit criteria"; the research's own mapping table (per-phase DoD + DoR, generic `run_gate`, evidence hashes, "no silent PASS") is ready to adopt verbatim.
**Spec** : new `src/lib/dod.ts`: `DOD: Record<PhaseId, GateItem[]>` where each item is `{id, criterion, probe(project): boolean}` — deterministic probes over artifacts/memory/scorecard (e.g. P0: `scorecard.axes.length === 5 && verdict ∈ set && guards non-empty iff verdict=proceed-with-guards`; P2: memory has all three kinds scored; P6: `lastTest.ok`; P12: openapi contains `openapi: 3.1.0` and ≥1 ADR). Generic `runGate(project, phase): {pass: boolean; unmet: GateItem[]}`. Wire into `applyPhaseResult` post-synthesis: a failing **non-HITL** gate converts the phase to `awaiting_hitl` with a gate-specific prompt (or logs `gate.reject` + blocks like a rejection); DoR variant `readyFor(project, phase)` runs before `runReady` allows entry. Gate events append to logs + episodic memory with score (research: "no PASS without evidence; append-only audit trail").
**Sequencing** : after B-02 (scorecard verdicts honest) and B-25 (logs/versioning). **Tests**: `runGateP0PassesOnCompleteScorecard`, `runGateP6FailsWhenLastTestNotOk`, `gateRejectParksHitlWithUnmetCriteria`, `everyPhaseHasAtLeastOneDoDItem` (property).

### R-204 — Spec-graph file-diff ledger + artifact evidence hashes — 1 d
**Motivation** : audit §8.6: artifacts are browsable but not consumable; the spec graph (A5) names files nothing ever writes. A ledger makes the *artifact generator* auditable as if it produced a repo.
**Spec** : new `project.ledger: FileDiff[]` (types) where each phase result registers `{phase, file (specGraph node or artifact slug), action: "create"|"annotate"|"seal", sha1: fnv/hash of body}`. `applyPhaseResult` appends ledger rows per artifact; P12's delivery log gains a final manifest (files × phases × hash chain: each row hashes the previous row — tamper-evident within localStorage's trust model). Spec-graph tab renders "file → which phases touched it" instead of only the static A5 order.
**Sequencing** : after B-06 (stamping), B-12 (ids). **Tests**: `applyPhaseResultAppendsLedgerRows`, `ledgerChainHashChangesWhenArtifactBodyChanges`, `p12ManifestListsAllLedgerFiles`, `ledgerSurvivesHydrate`.

### R-205 — Trace accumulation & algorithm history — 1 d
**Motivation** : audit §8.5: `AlgorithmTrace` is replaced on every mutation (engine.ts:632-640) — no history, no drift analysis, no "self-optimization" loop. The UI already renders trace cards; history turns them into a diagnostics timeline.
**Spec** : `project.traces` becomes append-only: each `attachAlgorithms`/`stampPacket` run appends `{...trace, runId}` (runId = monotonic counter persisted on project) instead of replacing; cap 200 (log-style). Add `project.traceIndex` summary row computed at P12: per-algorithm run counts + first/last summary delta (drift between A1 summaries across runs = brief/memory drift signal). Diagnostics rail gains a "traces" filter. Packet unchanged (it doesn't print traces).
**Sequencing** : after B-11 (run-count reduction makes appends cheap). **Tests**: `tracesAppendAcrossMutations`, `traceCapEvictsOldest`, `traceRunIdsMonotonic`, `p12TraceIndexSummarizesDrift`.

### R-206 — Verdict math v2: evidence strength + hard rules + guard extraction — 1 d
**Motivation** : research 2.2 §1.3-C (verbatim recipe): per-axis evidence strength (0-1), weighted mean, hard rules, confidence interval, guard extraction — "every axis < 7 emits ≥1 named guard with owner phase"; mirrors spec-kit's `go/clarify/kill`. B-02 makes reframe reachable; this makes the verdict *explainable*.
**Spec** : `FeasibilityScorecard` gains `evidence: Record<axisKey, 0..1>` (deterministic proxy: derived from whether the axis's inputs came from brief vocabulary vs fallbacks — e.g. delivery evidence 0.4 when `vague`, security evidence = securityDelta/2), `guards: {axis, text, ownerPhase}[]` extracted from every axis < 7 (owner = the phase whose work lifts it, e.g. security<7 → guard "threat-model at P4"), and `confidence: "low"|"medium"|"high"` from evidence spread. Overall becomes evidence-weighted mean; verdict thresholds unchanged; hard rules from B-02 stay (now *listed* in the scorecard, not implicit).
**Sequencing** : after B-02/B-22 (scorecard shape already churning there). **Tests**: `verdictMathWeightsByEvidence`, `axisBelowSevenEmitsNamedGuard`, `confidenceLowWhenEvidenceSpreadWide`, `hardRulesListedInScorecard`.

### R-207 — Token budget honesty: model map, per-seat budgets, metering — 1 d
**Motivation** : T1 end-to-end: crew seats advertise `budgetTokens` (algorithms.ts A8) nobody meters; packet ~14 KB sliced blind at 14000 chars (packet.ts:117) can cut mid-fence; `estimateTokens` B-21 fixes the number, this fixes the *system*.
**Spec** : (a) `TokenBudget` middleware-style helper `spend(seat, text)` recording `{seat, in, out}` into a per-project `budgets` log (types) — A8 seat budgets become the caps checked when the packet is compiled per phase: packet compile emits a `## Budget` line with per-seat used/allocated and **refuses** (or trims with a visible notice) a packet whose trimmed artifact section would exceed the active seat's budget — replaces the blind `.slice(0, 14000)` with `isWithinTokenLimit`-style short-circuit (T1). (b) `modelRoute` becomes real data: `{primary: "grok-4.5", edge: "local-edge", active: "grok-4.5"}` with the model map feeding R-207's tokenizer choice and cost display (`estimateCost` from gpt-tokenizer models — T1) — kills the `modelRoute` fiction (audit §7).
**Sequencing** : after B-21. **Tests**: `packetTrimIsTokenAware`, `budgetLineReflectsActiveSeatAllocation`, `oversizePacketEmitsNoticeNotSilentSlice`, `costEstimateUsesActiveModelMap`.

### R-208 — Packet version stamping + payload schema + embedded context — 0.5–1 d
**Motivation** : the packet is the only artifact that leaves the app (audit §8.4). Today it has no version, omits operator notes (fixed in B-04), and its 14 KB cap can truncate silently. An external agent consuming a packet cannot tell which engine release produced it or whether it was truncated.
**Spec** : (a) header line `RapidTool packet v2 · engine <pkg.version> · project <id> · phase <n>/12 · generated <ISO ts>`; (b) when `.slice(0,14000)` would truncate, append `…[TRUNCATED — regenerate at a HITL gate for the full plan]` instead of cutting mid-fence (R-207's token-aware trim supersedes in the budget path); (c) `X-Packet-Checksum: fnv1a(body)` footer so a consumer can verify copy integrity; (d) emit `## Operator notes` (from B-04) and `## Rejection history` in the context section.
**Sequencing** : after B-04/B-06/B-25. **Tests**: `packetHeaderCarriesVersionAndPhase`, `truncatedPacketMarksTruncation`, `packetChecksumVerifiesRoundTrip`, `packetOmitsNothingFromContextSections`.

### R-209 — Regeneration loop v2: deterministic variation + LLM-ready synthesis seams — 1.5–2 d
**Motivation** : B-04 makes rejection *steer*; this makes the loop *converge* and prepares the generative backend the audit (§8.1) identifies as the missing piece: "swapping each case to call an LLM with zod-validated output would activate the whole graph with no structural changes."
**Spec** : (a) per-phase `attemptBudget = 3`: a phase rejected 3× with the same stableHash band parks `blocked` with `error: "Rejection loop exhausted — rewrite the brief or approve as-is"` (deterministic guard against the "infinite aimless regeneration" the vision forbids); (b) synthesis seams: `synthesizePhase` gains an optional `generator` hook `(ctx) => Promise<{artifacts…} | null>` — when provided (future server route via ai.ts), deterministic content is the *fallback*, LLM content the primary; zod validation of LLM output happens before merge (research: "schema lock"); (c) `rejectionHistory` + retry context (B-04) are the hook's input, so the loop is steerable end-to-end the day a model is wired.
**Sequencing** : after B-04 (context plumbing), B-07 (heal honesty). **Tests**: `attemptBudgetParksBlockedAfterThreeRejections`, `generatorHookFallsBackToDeterministicOnNull`, `zodInvalidGeneratorOutputRejected`, `retryContextReachesGenerator`.

---

## Sequencing & risk notes

- **Wave 1 (correctness, no deps)** : B-02, B-05, B-07, B-08, B-12, B-16, B-17, B-22, B-24, B-25 + B-14 (one shared hydrate change) + machine extraction (B-03/B-13/B-24 enabler). All pure-function changes with unit tests; no UI or persistence break.
- **Wave 2 (sandbox + honesty)** : B-01 + B-18 (one change), B-21, B-06/B-19. B-01 is the only P1 — do it first if any LLM-sourced text can ever reach `runGenerated`; otherwise Wave 1 first is safe (verified: only engine-authored bytes run today).
- **Wave 3 (steering + structure)** : B-03, B-04, B-09 (factory), B-11, B-15 (+ B-23), B-13. B-15 changes lexer outputs globally → run the full algorithm suite tests + the Northwind seed trace (Appendix B.2) as a regression baseline before/after.
- **Deferred** : B-10, B-20 (documented; code parity waits for engine↔db wiring). No WONTFIX items — every remaining defect is either fixed, documented, or owned elsewhere.
- **Risk register** : B-02 recalibration changes verdicts for existing projects at next recompile (intended — scorecards are recomputed live; hydrate v2 migration preserves history); B-15 stemming changes lattice content for all briefs (mitigate with the regression trace above); B-01 worker path adds ~1 MB blob budget at runtime (created per run, GC'd; lazy).
- **Test-script change (this proposal's DoD)** : extend package.json `test` to run the new suites listed in the header; keep `node --experimental-strip-types --test` (no vitest dependency added); app-data/auth suites untouched.

*Proposal 02 closes the audit's P1 (B-01), makes every P2 gate real (B-02 reframe reachable, B-03 no silent failure promotion, B-04 rejection steers, B-09 SSR-safe), removes all P3 noise/fiction (B-05..B-25), and hands the engine 9 ranked enhancement candidates — the first four (R-201, R-202, R-203, R-205) are direct adoptions of the Part 2.2/2.3 research recipes.*
