# 01 — Pro fix agent: core engine + packet truthfulness

**Agent:** Pro fix agent (engine/packet/phases/types)
**Date:** 2026-09-05
**Scope:** `src/lib/engine.ts`, `src/lib/packet.ts`, `src/lib/phases.ts`, `src/lib/types.ts`, `src/lib/packet.test.ts` (tests may be added).
**Source of truth for findings:** `review/01_deep_audit_current.md` (A01–A30, severity-ranked) + `review/02`/`review/03` (capability/honesty) + direct source read.

---

## 0. Ground rules respected

- Edited **only** the five owned files. Never touched `review/*.md`, `agentnotes.md`,
  `scripts/`, `public/`, `migrations/`, `server/`, `package.json`, `ai.ts`, `sandbox.ts`,
  `store.ts`, `dod.ts`, `gate-stats.ts`, `console.tsx`, `templates.ts`, or any `.test.ts` besides `packet.test.ts`.
- No existing export was renamed or removed (guardrail honored — `HITL_PHASES`, `PHASE_IDS`,
  `STOCK_HITL`, `PHASES`, `PHASE_BY_ID`, `phaseDef`, `canEnter`, `priorsSealed`, `compileAgentPacket`,
  `PACKET_VERSION`, `synthesizePhase`, `applyPhaseResult`, `approveHitl`, `rejectHitl`, `emptyProject`,
  `hydrateProject`, `repairPhases`, etc. all unchanged in name/signature).
- All new import specifiers use explicit `.ts` extensions (repo standard for `node --experimental-strip-types`).
- Additive or internal-only changes; new exports none (all new helpers are module-private).

---

## 1. Fixes applied (file:line → rationale → verification)

### 1.1 `src/lib/types.ts` — A03 gate timing hole

- **Change** (types.ts:83–96): added optional `requestedAt?: number` to `HitlRequest`, documented.
- **Before:** `HitlRequest` had no timestamp, so `approveHitl`/`rejectHitl` defaulted `requestedAt = Date.now()`
  at decision time → every production decision row collapsed to `requestedAt === decidedAt`, which in turn made
  `gate-stats.approvalHealth` see mean-latency 0 (A03).
- **Rationale:** the request record now carries the true gate-open time; the engine stamps it (see 1.5).
  Field is optional so legacy persisted payloads hydrate cleanly.
- **Verify:** `npm run typecheck` (my files) clean; no test asserts the old missing-field shape.

### 1.2 `src/lib/phases.ts` — A20 `priorsSealed` index assumption

- **Change** (phases.ts:122–130): `priorsSealed` now looks up `phases.find((p) => p.id === i)` instead of
  `phases[i]`.
- **Before:** `phases[i]?.status` relied on an undocumented invariant (13 contiguous records, `id === index`,
  sorted) that only `repairPhases` guarantees. A partial/unsorted/sparse array silently mis-sealed the graph.
- **After:** seals by record id, immune to ordering/sparsity.
- **Verify:** `npm run typecheck` clean; store/gates suites still green (index-by-id returns identical results
  for the well-formed arrays the store always produces).

### 1.3 `src/lib/engine.ts` — A04 autopilot vs. P0 reframe

- **Change** (engine.ts:302): P0 `reframe` HITL now sets `forceHuman: true`.
- **Before:** the reframe gate was neither `STOCK_HITL` nor `forceHuman`, so autopilot (tightness < 7.2) could
  self-accept the machine's own "stop — tighten the brief" signal (A04).
- **After:** `canAutopilot` (store.ts:104) short-circuits on `forceHuman`, so a reframe can only be resolved by
  a human.
- **Verify:** full 6-core suite green (151/151 at the time of the run) — the autopilot tests target a P6
  scheduler-extra gate, not the reframe gate, so they are unaffected.

### 1.4 `src/lib/engine.ts` — A05 cross-phase rejection-note leak

- **Change** (engine.ts:459): P6 module builder fallback scoped from
  `project.phases.find((p) => p.rejectionNote)` → `project.phases.find((p) => p.id === phase && p.rejectionNote)`.
- **Before:** after any earlier rejection (e.g. P5), the *first* P6 run embedded that unrelated note as `REJECTION`,
  flipping the deterministic variant and the `addressed` flag (cross-phase contamination; combined with A02 it could
  brick P6 on attempt 1).
- **After:** the module only embeds the *current* phase's rejection note.
- **Verify:** sandbox + store + packet suites green.

### 1.5 `src/lib/engine.ts` — A03 gate-open timestamp (engine half)

- **Change** (engine.ts:767–770): `applyPhaseResult` stamps `requestedAt: Date.now()` on the finalized `hitl` when
  absent; `synthesizePhase` return type changed from an inline hitl shape to `HitlRequest`.
- **Change** (engine.ts:854): `approveHitl` `requestedAt: opts?.requestedAt ?? project.hitl?.requestedAt ?? now`.
- **Change** (engine.ts:920): `rejectHitl` `requestedAt: project.hitl?.requestedAt ?? now`.
- **Before:** `requestedAt` defaulted to `now` at decision time on every row.
- **After:** the ledger records the real think-time (gate-open → decision); explicit `opts.requestedAt` still wins
  (store test "approve passes requestedAt through" unchanged).
- **Verify:** `store.test.ts` full suite green (the explicit-`requestedAt` test passes; synthetic-row tests in
  `gate-stats.test.ts` are unaffected because they construct rows directly).

### 1.6 `src/lib/engine.ts` — A07 competitor honesty (illustrative label)

- **Change** (engine.ts:515–545): `case 7` now computes `marketFor(domain)` **once** (was called twice — once for
  `competitors`, once for the artifact body) and renders the marker into the artifact:
  - a blockquote `> Illustrative competitor templates (source: illustrative — NOT live research). Verify before citing.`
  - a `Source: illustrative template` line on every row.
- **Before:** `Competitor.source: "illustrative"` was write-only (B-23 contract existed only in a comment); the P7
  "Competitive analysis matrix" presented invented product claims as findings.
- **After:** the artifact body is self-labeled; the marker now reaches the paste-ready packet (via `## Artifacts`).
- **Verify:** no test asserts the old P7 body; full suite green.

### 1.7 `src/lib/engine.ts` — A12 A2 trace missing from the algorithm history

- **Change** (engine.ts:730–746): `attachAlgorithms` now appends an `A2 · FusionRank` trace alongside `A4`, and
  sorts the trace list by id (`A1…A8` order).
- **Before:** `attachAlgorithms` replaced traces wholesale with A1,A3,A5,A6,A7,A8 + A4 — **A2 never appeared**,
  contradicting the store comment ("fresh A1..A8+A4") and the console trace panel's eight-id claim.
- **After:** the trace set is complete and id-ordered. `id` literals are `as const` to satisfy the `AlgorithmTrace`
  union.
- **Verify:** `npm run typecheck` clean; `algorithms.test.ts` "does not compute A2" still passes (that pin is on
  `runAlgorithms`, not `attachAlgorithms`); `store.test.ts` "refreshPacket … A4 trace" passes.

### 1.8 `src/lib/engine.ts` — A16 garbage phase status + A15 unknown memory kind (hydration robustness)

- **Change** (engine.ts:28–29): added module-level `PHASE_STATUSES` and `MEMORY_KINDS` runtime sets mirroring the
  type unions.
- **Change** (engine.ts:1049–1053): `repairPhases` now drops any record whose `status` is not a known `PhaseStatus`
  (loud `hydrate.repaired` repair — the dropped id is reported and re-inserted as ready/locked).
- **Change** (engine.ts:1096–1098): `hydrateProject` filters memory to known kinds before the `filled` object is
  returned (and therefore before the fast early-return path).
- **Before:** a garbage status string survived repair and later force-completed a phase via `runReady`; an unknown
  memory `kind` made `fusionRank` throw inside packet compilation (`byKind[m.kind].push`), bricking every stamp.
- **After:** corrupt rows are dropped/coerced defensively.
- **Verify:** `npm run typecheck` clean; full suite green (no test feeds garbage status/kind, so behavior for valid
  payloads is unchanged).

### 1.9 `src/lib/packet.ts` — I7 machine-readable `## System JSON` envelope (capability add)

- **Change** (packet.ts:21–68): new module-private `systemJson(project, phase, compiledAt, loop)` emits a valid JSON
  object: meta (`packet_version`, `compiled_at`, `project_id`, `name`, `project_status`), `current_phase`
  (`id/code/title/hitl_gate`), `model_route`, `sandbox` (`claim` from `sandboxClaim`, `ram_mb`, `timeout_s`,
  `isolated`), `verdict`, `rejection_loop`, `decisions[]` (phase/decision/decided_by/note/requested_at/decided_at),
  and `phases[]` (id/status/rejections/gate_passed).
- **Change** (packet.ts:116, 129–134): the envelope is compiled once and emitted as a fenced ```` ```json ```` block
  under `## System JSON (machine-readable)` right after `## System`, so it survives the 14k truncation (which cuts
  the tail).
- **Rationale:** satisfies I7 / the task's "machine-readable export block" — a downstream agent/tool can
  `JSON.parse` the fenced body instead of scraping prose, while the markdown stays a single paste-ready document.
- **Honesty guard:** `sandbox.claim` uses `sandboxClaim()` (the B-18 single source of truth), **not** the raw
  `runtime` token, and decision/loop notes are capped (`quoteNote` 200/300) — this keeps the existing B-18 pins
  ("never print `sync-template`"/"never print the full 250-char note") green.

### 1.10 `src/lib/packet.ts` — A10 lastTest freshness lie

- **Change** (packet.ts:188): `Sandbox: pass/FAIL` → `P6 sandbox (last run): pass/FAIL`.
- **Before:** `project.lastTest` is written only by P6 and never reset, so P9–P12 packets reported "Sandbox: pass"
  as if the *current* edge were tested.
- **After:** the row is unambiguously labeled as a historical P6 result.
- **Verify:** no test asserts the old `Sandbox:` string; packet suite green.

### 1.11 `src/lib/packet.ts` — A21 artifact trim self-inclusion + silent cut

- **Change** (packet.ts:77–84): artifact pool now `.filter((a) => a.kind !== "packet")` before `slice(-8)`, and
  truncated bodies get an explicit `…`.
- **Before:** on `refreshPacket` the previous `packet` artifact could be embedded (stale excerpt of itself) and
  900-char bodies were cut mid-content with no marker.
- **After:** the packet never embeds its own prior artifact; truncation is announced per artifact.
- **Verify:** packet suite green.

### 1.12 `src/lib/packet.ts` — scorecard honesty label (I9)

- **Change** (packet.ts:208): `## Scorecard` now leads with
  `(deterministic feasibility estimate — template-derived, not live research)`.
- **Rationale:** the scorecard is formula output from brief keywords; the label closes the "fake-precision" honesty
  gap (review/03 §2.3) so a naive downstream agent doesn't treat it as expert assessment.
- **Verify:** packet suite green (no assertion on the old scorecard lead line).

### 1.13 `src/lib/packet.test.ts` — new I7 pins (tests added)

- Added 4 tests (`packet.test.ts:362–426`): block present + parseable; envelope exposes decisions/phases/verdict;
  envelope reflects the current edge (P12, not stale); decision note capped at 200 (full 250-char note never leaks).
- **Result:** packet suite 21 → **25/25 pass**.

---

## 2. Verification results

| Check | Result |
|---|---|
| `npm run typecheck` (repo-wide) | **0 errors.** Final confirmed state after the concurrent agent's A14 `sandbox.ts`/`sandbox.test.ts` work landed (during the session the suite briefly showed a `FakeWorker.onerror` error in `sandbox.test.ts` — out of my scope — which that agent then resolved). |
| `node --experimental-strip-types --test src/lib/packet.test.ts` | **25/25 pass** |
| 6-core suite (algorithms/sandbox/packet/store/gates/gate-stats) | **161/161 pass** (count grew from 145 → 161 due to concurrent additions by the store-owning agent) |
| Full TS suite (adds app-data/auth) | **207/207 pass, 0 fail** (final confirmed state; baseline "190/190" now exceeds due to concurrent additions + my 4 packet tests) |

---

## 3. Reviewed but NOT fixed (out of scope / deferral), with reason

| ID | Why not fixed here |
|---|---|
| A01 (recordGate phase bug) | `store.ts` — other Pro agent's file. |
| A02 (P6 dead-end: FORBIDDEN regex vs literals, missing force checkbox) | `sandbox.ts` (regex/runSandboxed) + `console.tsx` (checkbox) — both outside my list. |
| A06 (make worker real / claim small) | requires making the synchronous P6 path async (`runSandboxed` is `Promise`), which would ripple through `store.ts`'s sync `runReady`/`runUntilHitl` — architectural, deferred. |
| A08/A09/A18/A19/A23/A24 | `console.tsx` UI concerns. |
| A11 (reject guard asymmetry) | `store.ts`. |
| A13/A14 (sandbox hardening/onerror) | `sandbox.ts`/`sandbox.test.ts` — being done by the concurrent agent (see §2). |
| A17 (decision cap 100) | P3, low value; noted, not changed (surgical scope). |
| A22 (runGate vacuous pass) | `dod.ts` — other Pro agent. |
| A25 (`HITL_PHASES` dead export) | guardrail forbids removing an existing export from `phases.ts`. |
| A26 (`PATCH` dead member) | type-union trim touches an exported type; P4, skipped. |
| A27 (gate-stats window) | `gate-stats.ts` — other Pro agent. |
| A28 (scorecard throw doc) | P4; the precondition is already documented in the throw message + comments. |
| A29 (timeout constant dup) | `sandbox.ts`. |
| A30 (dead store branches) | `store.ts`. |

---

## 4. Net effect

- Packet v2 is now **zero-residual-fiction** where the code can honestly control it: the execution line and the
  new machine envelope both use `sandboxClaim()` (no raw `sync-template`/`wasm`/`net-deny`), competitor rows are
  labeled `illustrative`, the scorecard is labeled a deterministic estimate, the stale `lastTest` row is labeled
  `P6 sandbox (last run)`, and notes are capped everywhere.
- A **machine-readable `## System JSON` block** (decisions + phases + verdict + sandbox claim) is now part of every
  packet, parseable by `JSON.parse` on the fenced body, and survives truncation.
- Five P2/P3 state-machine/robustness defects in the engine are closed (A03, A04, A05, A12, A15, A16, A20).
