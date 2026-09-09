# RapidTool — Proposal 03: Architecture & Quality Enhancements (Q-301 … Q-312)

**File:** `proposals/03_arch_quality_enhancements.md` · **Status:** proposed · **Date:** 2026-09-04
**Scope:** cross-cutting architecture/quality candidates only — engine/algorithms bug fixes (B-01…B-25) and UI/multiplayer fixes are the property of proposals 01/02; candidates here *pin* those bugs with tests where noted so fixes cannot silently regress.
**Method:** every candidate is grounded in the audit trail below, cites files + sections + URLs, and names exact files/signatures/schemas. Integration points were re-verified against source on 2026-09-04 (line refs below are current).

## Evidence key (used in every candidate)

| Ref | Source |
|---|---|
| AN | `agentnotes.md` — Part 3.1 (embedded core audit), Part 2.1 (§4 M-list, §5 gap table G1–G22, §6 borrow list), Part 2.2 (SDLC research), Part 2.3 (T1–T10 deep dives) |
| A01 | `audit/01_core_engine_algorithms_audit.md` (§6 bugs B-01…B-25, §7 dead code, §8 potentiality, §9 security) |
| A03 | `audit/03_auth_appdata_platform_audit.md` (§3 DB walkdown, §5 bugs A–H, §8 potentiality/constraints) |
| R01 | `research/01_parallel_repos_research.md` (M1–M13, gap table, borrow list, URL inventory §7) |
| R02 | `research/02_industry_sdlc_grading_research.md` (§1 DoD/DoR, §5 grading, §6 security, §7 ADR, §10 HITL UX, §11 adoption list) |
| R03 | `research/03_tech_deep_dives_research.md` (T7 PGlite, T8 packet/context) |
| MASTER | `attachments/RapidTool_Complete_Master.md` (vision doc) |

**Facts re-verified in source (2026-09-04):** `db.ts` is **server-only** — `getSql()` throws when `typeof window !== "undefined"` (db.ts:173-177); the PGlite fallback is an in-memory server-process instance (db.ts:108-130); both migration appliers read **top-level `migrations/*.sql` only** (`import.meta.glob("/migrations/*.sql")` db.ts:140, `readdir(migrationsDir)` scripts/migrate.mjs, `pendingMigrations` filters `*.sql` basenames, migration-plan.mjs:33-46 — so `migrations/auth/` stays out and a new engine migration belongs at `migrations/0002_engine.sql`); `npm test` = `node --test 'scripts/**/*.test.mjs' && node --experimental-strip-types --test <explicit .ts list>` (package.json) — new tests must be **appended to that explicit list**; test convention is `node:test` + `node:assert/strict` (gate-identity.test.ts); engine module graph is a clean acyclic fan-in toward `types.ts` with zero store imports (AN Part 3.1 §2) — pure functions, cheap to unit-test in Node; `persist` key `rapidtool.v4` (store.ts:257).

---

## 1. Ranked candidate table (value/effort; V 1–10, E S/M/L)

| Rank | ID | Candidate | Value | Effort | Rationale (one line) |
|---|---|---|---|---|---|
| 1 | Q-301 | Core unit-test suite (engine/algorithms/store/sandbox/packet) | 9 | M | Logic-dense core has **zero** tests; B-02 (unreachable verdict) & B-07 (no-op heal) shipped unnoticed (A01 §7); everything below is protected by it |
| 2 | Q-302 | Durable checkpoints: engine events → `db.ts` (migrations/0002_engine.sql + engine-db server fns + fail-open emitter) | 9 | M | Kills "lost run on iframe reload" (G1/M1); activates the orphaned ready-made data layer (AN Part 3.1 §1.4/§8-2); foundation for replay/ledger |
| 3 | Q-303 | Packet v2: operator notes + decision ledger + version stamp + honest sandbox + fresh-edge recompile | 8 | S | A4 is the only artifact that leaves the app (AN §8-4); today it omits human steering (B-04 family), prints `net-deny` fiction (B-18), goes stale (B-06/B-19) |
| 4 | Q-304 | HITL decision ledger (approve/reject + notes + source into project, export, telemetry seed) | 8 | M | Decisions vanish into logs (types.ts:80-85, engine.ts:735/760); NIST AI RMF + §10 research make override rationale a first-class record |
| 5 | Q-305 | Per-phase DoD/DoR gate registry, machine-checkable (research 2.2 §1) | 8 | M | Gates today check "approval given", not "exit criteria met" (R02 §1.2); stage-gate research: written criteria + decision record or rubber stamp |
| 6 | Q-306 | Trace history accumulation (append runs, never replace) | 7 | S | `traces` replaced on every mutation (engine.ts:632-640, AN §8-5); vision's self-optimization loop needs history to exist |
| 7 | Q-307 | ADR artifact continuity (auto-log at decision points, status lifecycle, P12 export) | 7 | M | ADRs exist only as one hard-coded P12 string (engine.ts:589-612); Nygard: record at decision time or never (R02 §7) |
| 8 | Q-308 | Structured engine event stream (typed events, pub/sub, diagnostics rail) | 7 | S | G12/M10; Q-302/304/306 otherwise hand-roll three emitters; typed events = substrate + observability semantics |
| 9 | Q-309 | `ai.ts` wiring spec: `enrichBrief` on intake with graceful degrade | 6 | S | Only LLM hook is dead code (ai.ts zero importers, AN §7); intake naming is the smallest safe activation; spec only, no key needed |
| 10 | Q-310 | Persisted-payload schema versioning + one-shot migration (B-14/B-25) | 6 | S | New arrays from Q-303/304/306/307 need defaults; hydrateProject currently resets silently on every anomaly (B-25) |
| 11 | Q-311 | Coverage targets + lint/arch rules (eslint additions, `test:core`, coverage script) | 5 | S | Quality gates for the console itself; enforces the db.ts server-only boundary mechanically |
| 12 | Q-312 | Artifact manifest + instruction-file emission (AGENTS.md) | 5 | S | G7/G9/G20 borrow-list items; makes artifacts consumable (hashes/refs) and downstream agents self-governing |

**Sequencing (waves):** W1 = Q-301 + Q-310 (tests first, versioned payload before new fields land) + Q-303. W2 = Q-304 + Q-306 + Q-307 + Q-308 (ledger/traces/ADRs all ride the typed event diff from Q-308; land Q-308's `diffEngineEvents` inside the Q-302/Q-304 work to avoid rework). W3 = Q-302 (consumes events) + Q-305. W4 = Q-309 + Q-311 + Q-312. Dependency note: Q-308's pure diff function is extracted *during* W2; Q-302's emitter subscribes to it.

---

## Q-301 — Core unit-test suite (Rank 1)

**Problem (evidence).** `npm test` covers `scripts/**` + `app-data` + `auth` only; the most logic-dense files — `advanceOnce`, `applyPhaseResult`, `fusionRank`, `topo`, `feasibilityScorecard` — are untested (A01 §7 "TODOs / markers"; AN Part 3.1 §7). That is how B-02 (reframe verdict **unreachable by arithmetic**, A01 §6) and B-07 (`healSource` no-op for every real input) shipped unnoticed. The module graph makes this cheap: engine/algorithms/packet/sandbox/phases are pure, acyclic, zustand-free (AN Part 3.1 §2).

**Research backing.** R01 §4 M5 / gap G5/G22 — "if RapidTool is a software agency, the agency itself needs CI"; SWE-bench + Terminal-Bench harness culture and Anthropic end-state eval ("break evaluation into discrete checkpoints where specific state changes should have occurred") — https://www.anthropic.com/engineering/multi-agent-research-system · https://raw.githubusercontent.com/SWE-bench/SWE-bench/main/README.md. R02 §4 verification-driven development (tests first). R03 T9 (agent crews need CI too).

**Exact change.**
1. New test files (node:test + `node:assert/strict`, same conventions as `src/lib/auth/gate-identity.test.ts`; **pure TS, no platform imports** — store tests need a localStorage shim, see below). Each file tests *current* behavior; every B-xx fix from proposals 01/02 lands with its regression test updated in the same commit ("tests mirror fixes").
2. `package.json`: append to the existing `test` script's explicit list: `src/lib/phases.test.ts src/lib/algorithms.test.ts src/lib/engine.test.ts src/lib/packet.test.ts src/lib/sandbox.test.ts src/lib/store.test.ts src/lib/events.test.ts src/lib/gates.test.ts src/lib/adr.test.ts src/lib/manifest.test.ts src/lib/engine-events.test.ts` (explicit list is the established convention — Node does not auto-discover `.ts`; quoted `*.test.mjs` glob stays for scripts).
3. `src/lib/store.test.ts` preamble (persist middleware needs a storage shim before the module evaluates — dynamic import after shim):
```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};
const { useRapid } = await import("./store.ts");
```

**Test inventory (proposed; counts are per-file targets).** Full list in §15.

| File | Guards / pins |
|---|---|
| `phases.test.ts` (~10) | `canEnter` adjacency; `priorsSealed` (incl. status-only semantics, B-14); PHASES length 13 + id==index invariant (regression for B-14); `STOCK_HITL = [4,5,8,9]` vs `HITL_PHASES` agreement |
| `algorithms.test.ts` (~35) | `tokens`/`phraseHits` substring mis-lexing pins (B-15: "technology"→`tech`, "billable"→`bill`); A1 hipaa-without-phi suppression edge (AN 3.3 A1-4); complexity ∈ [3,10]; A2 single-bucket dead-`else` pin (B-16) + max-score ≈0.5 bound; A3 extraHitl P6/P11 rules; A5 topo stable order + cycle throw; A6 substring field-bank collision ("jobs"→job fields) + shared-array-by-reference mutation-hazard guard; A7 shapes + `orc-phase` row; A8 active-seat map incl. P4/P7/P11 architect fallback (B-17); **feasibilityScorecard: minimum overall == 7.0 ⇒ verdict never "reframe" (B-02 pin)**; `bootstrapMemory` ids; `estimateTokens` bounds |
| `engine.test.ts` (~30) | `inferDomain` ordering ("healthcheck tool for fleets"→health-ops, B-23); `inferName` verb-strip; `emptyProject` packet-vs-memory disagreement (B-05 pin); `applyPhaseResult`: phase→complete, per-phase artifact replacement keeps only latest packet, memory cap 80, logs cap 200; P6 `lastTest.ok=false` ⇒ `awaiting_hitl` + hitl "Sandbox failed — review"; `approveHitl` seals + advances + `hitl:null`; `rejectHitl` note ≥12 + status blocked; `unlockRetry` re-enters; `hydrateProject` 13-length rule + non-13 reset (B-14/B-25 pins) |
| `packet.test.ts` (~10) | 14k slice cap; current-edge staleness after auto-advance (B-06/B-19 pin); `(empty — treat Phase 0 research…)` only when memory truly empty (B-05); sandbox-copy fiction pin (B-18 — flips when Q-303 lands); rejection notes present; output-schema tail "Next legal edge" |
| `sandbox.test.ts` (~6) | denylist literal bans; `[].filter.constructor("…")()` bypass **escape attempt must fail** (B-01 regression; no infinite-loop case — no timeout exists yet, documented skip); `healSource` no-op when `test_happy` present (B-07 pin); heal inserts fallback when missing |
| `store.test.ts` (~25) | create/select; execute; `runUntilHitl` stops at HITL with `ran`; 16-iteration cap behavior (B-24 pin); approve phase-mismatch guard (store.ts:168-170); reject <12 chars → error; autopilot never auto-approves stock gates; autopilot auto-approves extra gates at tightness<7.2 **incl. failing P6 test gate (B-03 pin)**; clone shallow semantics (B-08 pin); persist partialize shape; rehydrate→`seedIfEmpty` demo seed (B-09-related pin) |

**Verification.** `npm test` green (target ~110-130 cases total); count in inventory matches reality; coverage baseline captured (Q-311).

---

## Q-302 — Durable checkpoints: engine events → `db.ts` (Rank 2)

**Problem (evidence).** The entire 13-phase run lives in zustand + `localStorage` under `rapidtool.v4` (store.ts:257); a refresh, tab close, or iframe reload silently kills a multi-hour run — nothing can resume or rewind (A01 §1.4; AN Part 2.1 M1). The vision demands "Durable Checkpointing: persist step states to resume execution instantly upon failure" (MASTER:19) and P2's own phase summary promises it (phases.ts:24-25) — but the ready-made dual-driver `db.ts` (Neon/PGlite, atomic migrations, HMR-proof globals) is **orphaned: no core module imports it** (AN Part 3.1 §1.4/§4; A03 §3). localStorage also approaches the ~5 MB quota with many projects (A01 §9.6).

**Research backing.** R01 §4 M1 + gap G1 — LangGraph checkpointers (`thread_id` resume; "use a durable checkpointer in production") https://docs.langchain.com/oss/python/langgraph/persistence; Temporal Event History as "a complete and durable log of everything that has happened" https://docs.temporal.io/workflow-execution/event; gpt-pilot sqlite step DB + `--step` resume (R01 §3.5). Borrow-list #2: "kills the lost-run class of bugs; enables every later mechanism" (R01 §6). R03 T7 PGlite practice (below). A03 §3.4-3.5 migration mechanics/drift.

**Constraint discovered (read of source).** `getSql()`/`getPglite()` are **server-only** (db.ts:173-177 throws in browser) and the preview PGlite is an in-memory server-process instance (db.ts:108-130) — so the engine (client-side) cannot call the DB directly. Checkpoints must therefore be a **server-function mirror**: client derives typed events, POSTs them to a `createServerFn` (the established server pattern — `ai.ts` already uses one; AGENTS.md §0.5 database-ON/auth-OFF rules apply: unowned rows, no personal data).

**Exact change.**

1. **`migrations/0002_engine.sql`** (top level — see Evidence key for the non-recursive applier rule; basename dedupe makes it safe alongside `migrations/auth/`):
```sql
-- RapidTool engine checkpoint mirror (Q-302). Auth-off unowned rows per AGENTS.md §0.5:
-- NO brief text / artifact payloads server-side — only id, name, brief sha256, state summary.
create table if not exists engine_projects (
  id             text primary key,
  name           text not null,
  brief_sha256   text not null,
  status         text not null,
  current_phase  int  not null,
  model_route    text not null default 'local-edge',
  events_seen    bigint not null default 0,
  last_event_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create table if not exists engine_events (
  seq        bigint generated always as identity primary key,
  project_id text not null references engine_projects(id) on delete cascade,
  phase      int  not null,
  kind       text not null check (kind in ('project.created','phase.started','phase.completed',
             'phase.failed','hitl.requested','hitl.decided','gate.verdict','trace.run','packet.compiled')),
  verdict    text,
  note       text,
  meta       jsonb not null default '{}',
  prev_hash  text not null,                 -- sha256 of canonical previous row → append-only audit chain (R02 §11-5)
  ts         timestamptz not null default now()
);
create index if not exists engine_events_project_idx on engine_events (project_id, seq);
```
2. **`src/lib/engine-db.ts`** (new, server module; never imported by client code at module scope):
```ts
import { createServerFn } from "@tanstack/react-start";
export type EngineEventIn = { kind: string; phase: number; verdict?: string; note?: string; meta?: Record<string, unknown> };
export const recordEngineEvents = createServerFn({ method: "POST" })
  .validator((input: { projectId: string; name: string; briefSha256: string; events: EngineEventIn[] }) => input)
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");   // dynamic: keeps db.ts out of the client bundle
    // tx: upsert engine_projects (status/current_phase from last event meta), then insert events
    // with prev_hash = sha256(canonical json of previous row for this project); return { ok: true }
  });
export const fetchEngineCheckpoint = createServerFn({ method: "GET" }) // future resume UI; spec'd, not required now
  .validator((input: { projectId: string }) => input)
  .handler(async ({ data }) => { /* last 50 events + project row */ });
```
3. **`src/lib/engine-events.ts`** (new, client-safe, zero server imports): `EngineEvent` union (shared with Q-308), pure `diffEngineEvents(before: Project | null, after: Project): EngineEvent[]` (transitions: `project.created`, `phase.started/completed` from `PhaseRecord.status/startedAt/completedAt` diffs, `hitl.decided` when `hitl` clears, `phase.failed` on `status==='blocked'`), a bounded queue (cap 200) + `flushEngineEvents(): Promise<void>` that fire-and-forgets `recordEngineEvents({ data })`; on failure sets `checkpointState: "local-only"`, drops the queue after 3 consecutive failures, **never throws into the UI call path**; `checkpointStatus(): "synced" | "pending" | "local-only"`.
4. **`src/lib/store.ts`** wiring: every mutating action (`create`, `execute`, `runUntilHitl`, `approve`, `reject`, `retry`) captures `before` and after `set` calls `queueEngineEvents(diffEngineEvents(before, next)); void flushEngineEvents();` — non-blocking; rehydrate emits one `run.resumed`-style meta event per project (Q-308 kind set) so the mirror tracks activity even when local-only.
5. **Fail-open contract (explicit):** localStorage remains the **sole source of truth**; the DB is an append-only checkpoint mirror. DB unavailable (preview restart, offline, 500, no DATABASE_URL) ⇒ chip in console diagnostics rail reads "cloud checkpoints: local-only" — zero functional loss. No action ever awaits the DB.
6. **Documented upgrade path (not built now):** browser-side PGlite `idb://` per R03 T7 ("recommended IndexedDB VFS… `relaxedDurability` for console scratch", https://pglite.dev/docs/filesystems) when offline multi-tab durability is wanted; pitfalls recorded there (single exclusive connection ⇒ multi-tab worker, SSR guard at call site, `.exec()` never parameterized).

**Verification.** Unit: `engine-events.test.ts` — `diffEngineEvents` transition matrix (create, complete-with/without-HITL, approve, reject→blocked, retry, no-op mutations emit nothing). Integration (manual, dev only): run with `DATABASE_URL` set ⇒ after seed+create+execute P0+approve, `engine_events` holds `project.created`, `phase.completed` P0, `hitl.decided`; rows hash-chain (`prev_hash` continuity — assert with a tiny SQL query). Without DATABASE_URL ⇒ chip shows local-only, app behaves identically. `npm run build` applies 0002 via migrate.mjs (A03 §3.4).

---

## Q-303 — Packet v2 (Rank 3)

**Problem (evidence).** A4 is "the under-leveraged killer feature — the only artifact meant to leave the app" (AN Part 3.1 §8-4), yet the compiled packet: (a) never embeds `project.notes` — the operator's steering channel — so a copied packet omits exactly the human corrections the rejection policy depends on (AN §8-4c, B-04 family); (b) prints the sandbox fiction "`wasm`, 256MB, 30s, **net-deny on generated exec**" (packet.ts:77) while real execution is an unconstrained `new Function` with no timeout (B-18, B-01; types.ts:181-186 "configuration theater", AN §7); (c) goes stale — after a non-HITL phase completes, the packet still describes the just-completed phase as "Current edge" until the next action (B-06/B-19, store.ts:96-103); (d) claims "(empty — treat Phase 0 research as first write)" on fresh projects whose memory rail already shows 3 bootstrap entries (B-05, engine.ts:837-839); (e) crew section force-labels the architect `[ACTIVE]` on P4/P7/P11 (B-17).

**Research backing.** R01 §4 M7/G7 (artifact handoff that keeps paste-ability) + borrow #3; G20/G9 (agents.md/AGENTS.md convention ecosystem — a packet that omits the operator's steering is context rot for the receiving agent). R03 T8 context engineering: "the smallest possible set of high-signal tokens" (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — version stamping + honest framing are signal, fiction is noise.

**Exact change** (`src/lib/packet.ts`, `src/lib/store.ts`, `src/lib/engine.ts`):
1. **Version stamp** — `export const PACKET_VERSION = 2;` header becomes `# RapidTool Agent Packet v${PACKET_VERSION} — <name>` plus `packet_version: 2`, `compiled_at: <ISO-8601>`, `project_id: <id>` lines under `## System`. Downstream agents can now detect stale copies (B-06/B-19 fix: extract a store helper `recompilePacket(project)` — `refreshPacket` already exists at store.ts:223 — and call it whenever `currentPhase` changes inside `advanceOnce`'s auto-advance path, per A01 §6 B-06 suggested fix).
2. **`## Operator notes (human steering)`** — `project.notes` verbatim when non-empty, prefixed `These override earlier instructions.` (closes AN §8-4c).
3. **`## Decision ledger (HITL)`** — rows from the new `hitlLedger` (Q-304): `- P4 · approve · human · 2026-09-04T…` / `- P6 · reject · human · "…"`; replaces the free-form `Prior rejection notes:` block (packet.ts:22-25, 79) with a one-line compat summary + full ledger.
4. **Honest sandbox section** — replace packet.ts:77 with:
```
Execution: in-page JS evaluator (new Function + denylist, no timeout) — NOT OS-isolated.
Do not paste untrusted or model-authored code into this project until real isolation exists.
Declared target (unimplemented): wasm · 256MB · 30s · net-deny — aspirational, see packet_version 2 changelog.
```
5. **Honest memory line** — `(empty — treat Phase 0 research as first write)` only when `memory.length === 0`; and fix B-05 ordering in `emptyProject` (engine.ts:837): set `bootstrapMemory` **before** `attachAlgorithms` so the first packet already sees the 3 entries.
6. **Crew honesty** — `[ACTIVE]` mapping per A8 seat rules; P4/P7/P11 no seat → `(no seat active — human gate phase)` instead of the B-17 architect fallback (copy-level fix now; deep fix belongs to 01).
7. Keep the 14k slice and the Required-output-schema tail stable (downstream agents parse it; T8).

**Verification.** `packet.test.ts`: version stamp present & exact `packet_version: 2`; notes embedded when set, absent otherwise; ledger rows when ledger non-empty (Q-304 fixture); sandbox copy contains none of `net-deny on generated exec`/`wasm, 256` as assertions (assert the honest string); empty-state line only when memory empty; store test: immediately after a non-HITL phase completes, packet's "Current edge" == next phase (B-06 regression). Existing `scripts/browser-smoke.mjs` re-run for copy regressions.

---

## Q-304 — HITL decision ledger (Rank 4)

**Problem (evidence).** HITL decisions **vanish**: `HitlRequest` has no id/decision fields and is "ephemeral, replaced wholesale" (types.ts:80-85, AN Part 3.1 §3.1); `approveHitl`/`rejectHitl` only append a `JsonLog` string line (engine.ts:735, 760) and rejection additionally writes one episodic memory (engine.ts:764-773). Autopilot approvals are indistinguishable from human ones (B-03(b) — autopilot waves through failing P6 test gates; canAutopilot at store.ts:42-46). Nothing records *who decided, when, and why* — yet NIST AI RMF calls exactly that telemetry for oversight ("data about the frequency and rationale with which humans overrule AI system output… useful to collect", R02 §10.1), and the vision requires "mandatory qualitative feedback… preventing infinite aimless regeneration" (MASTER:70).

**Research backing.** R02 §10.1 (NIST https://doi.org/10.6028/NIST.AI.100-1 ; Google eng-practices reviewer guidance; Monperrus rubber-stamp warning https://arxiv.org/abs/2606.13175) + §10.3 gate-v2 JSON (`human_action: {verdict, note ≥12, labels, latency_s}`) and adoption item 10; R02 §7.3 traceability — gate/HITL records "reference artifact id + note + human id". R01 M2 (LangGraph `interrupt()` resume values https://docs.langchain.com/oss/python/langgraph/interrupts).

**Exact change.**
1. `src/lib/types.ts`:
```ts
export type HitlDecision = {
  id: string;                 // `hitl-<phase>-<ts>` (B-12 lesson: never kind+score only)
  phase: PhaseId; title: string;
  decision: "approve" | "reject";
  note: string;               // reject: ≥12 chars (store.ts:178); approve: "" or optional note
  decidedBy: "human" | "autopilot";
  requestedAt: number; decidedAt: number;
  artifactIds?: string[];     // evidence refs (R02 §7.3), empty until Q-305 gate artifacts land
};
// Project gains: hitlLedger: HitlDecision[];   // append-only, capped 100 (drop-oldest + log line)
```
2. `src/lib/engine.ts`: `approveHitl(project, opts?: { decidedBy?: "human" | "autopilot"; note?: string }): Project` — appends ledger entry (back-compat: default `"human"`); `rejectHitl(project, note)` appends with `decision:"reject"`; `unlockRetry` does **not** append (a reject + retry is one reject decision, then a fresh run). `emptyProject`/`hydrateProject` init `hitlLedger: []` (defaults guarded by Q-310).
3. `src/lib/store.ts`: autopilot branch (store.ts:60-62) calls `approveHitl(p, { decidedBy: "autopilot" })`; `approve` action (store.ts:164-176) calls with `{ decidedBy: "human" }`. Add `exportLedgerMarkdown(project): string` (pure) + `ledgerToJson(project): string` (pure, for a console "Export decisions" copy/download button next to the packet tab).
4. Console diagnostics rail (console.tsx, memory/diagnostics strip ~1.12): summary line `HITL: 5 approved · 2 rejected (1 by autopilot) · mean human latency 41s` — latency = `decidedAt − requestedAt`; this is the R02 §10 rubber-stamp/telemetry seed (full detector deferred).
5. Ledger rows are emitted as `hitl.decided` engine events (Q-308) → persisted by Q-302 → survive refresh.
6. Packet v2 `## Decision ledger` consumes it (Q-303).

**Verification.** `engine.test.ts` additions: approve appends `{phase, decision:"approve", decidedBy, note, decidedAt≥requestedAt}` and clears `hitl`; autopilot approve marks source; reject ≥12 stores note; unlockRetry adds no entry; cap at 100 with oldest dropped; `exportLedgerMarkdown` round-trip contains phases/decisions/notes; store-level: autopilot fixture yields `decidedBy:"autopilot"` **only** for non-stock gates (B-03 pin).

---

## Q-305 — Per-phase DoD/DoR gate registry (Rank 5)

**Problem (evidence).** RapidTool has the strongest *shape* of gating in the surveyed ecosystem (13-phase graph, ≥12-char rejection rule) but gates check "approval given" more than "artifacts satisfy named exit criteria"; there is no per-phase DoD checklist the state graph can verify, no DoR ("ready for phase") predicate, and no structured gate decision record (R02 §1.2 "RapidTool: stronger/weaker"). Stage-gate research is blunt: gates without written criteria, an owner, and a decision record "become rubber stamps" (R02 §1.1 Cooper; §10 Monperrus). R02 §11 adoption item 1 targets exactly this for P0–P12.

**Research backing.** R02 §1.1-1.3 — Agile Alliance DoD glossary https://www.agilealliance.org/glossary/definition-of-done/ ("a DoD that is merely a shared understanding… may lose much of its effectiveness"), DoR https://www.agilealliance.org/glossary/definition-of-ready/, Scrum.org DoD example lists mapping 1:1 onto codegen exit criteria; §1.3's abridged per-phase registry (P0: 5 axes + verdict + guards; P4: sandbox policy + note; P5: every AC has ≥1 test; P6: oracle + evidence; P9: promote preconditions) and generic gate function with evidence hashes; §11 row 1.

**Exact change.**
1. **`src/lib/gates.ts`** (new, pure):
```ts
export type GateProbe = { id: string; criterion: string;
  check: (p: Project, phase: PhaseId) => { ok: boolean; evidence?: string; hint?: string } };
export type GateChecklist = { phase: PhaseId; version: number; exit: GateProbe[]; entry: GateProbe[] };
export const DOD_REGISTRY: Record<PhaseId, GateChecklist>;   // all 13 phases, ≥2 exit probes each
export function checkExitGate(p: Project, phase: PhaseId):
  { pass: boolean; results: GateProbeResult[]; evidenceHash: string };   // sha256 over ok+evidence
export function checkEntryGate(p: Project, phase: PhaseId): { pass: boolean; results: GateProbeResult[] };
```
Registry probes are phrased deterministically over the *current* data model (honest for the canned engine — no fake "tests ran" claims): P0: scorecard has 5 axes + verdict ∈ enum + guards non-empty iff `proceed-with-guards` (R02 §1.3 C); P4 [HITL]: sandbox-policy artifact exists for phase 4 **or** a ≥12-char waiver note on the gate; P5 [HITL]: every rejection/waiver note ≥12 chars + no unresolved note on sealed priors; P6: oracle list non-empty, `lastTest` present, `lastTest.ok || hitl==="Sandbox failed"` consistency (B-03); P7: ≥2 competitor rows with sources field non-empty; P8 [HITL]: prototype artifact exists per spec flow (artifact-kind presence); P9 [HITL]: release-manifest-ish artifact (openapi/adr/lastTest evidence block) present; P12: `openapi` non-empty + ADRs exist for arch phases (Q-307); generic entry probes: prior phases sealed, phase not `rejected`.
2. `src/lib/engine.ts` integration (advisory first, enforcement later): in `applyPhaseResult`, when the phase flips to `complete`, run `checkExitGate` and (a) attach a `gate-verdict-P<id>` artifact (`ArtifactKind` gains `"gate"` in types.ts — extend the 15-kind union), (b) record `PhaseRecord.gate = { passed, results, evidenceHash, checkedAt }`, (c) log `event:"gate.verdict"` and emit `gate.verdict` engine event (Q-308). `runReady` (store.ts:80) runs `checkEntryGate` advisory and logs unmet probes. `const GATE_ENFORCE = false` module flag documents the flip point; existing seed/demo runs must never be blocked (honest "advisory fail" is a finding, not a stop).
3. Registry edits are code changes with the checklist `version` bumped — the R02 §7.3 "editable only via PR" discipline, enforced by review, not by tooling.

**Verification.** `gates.test.ts` (~20): registry has 13 entries, each ≥2 exit + ≥1 entry probe; every probe runs without throwing on (a) `emptyProject` fixture and (b) a project advanced through P0–P12 by the Q-301 fixture helper; seed "Northwind Dispatch" after P0 yields the *expected documented* probe failures (gate is not a rubber stamp either way); `checkExitGate` evidenceHash changes when an artifact body changes; types compile with `kind:"gate"`.

---

## Q-306 — Trace history accumulation (Rank 6)

**Problem (evidence).** `AlgorithmTrace` exists and the UI renders trace cards, but traces are **replaced on every mutation** (engine.ts:632-640 inside `attachAlgorithms`, which runs on every phase result *and* every approve/refresh — B-11 counts the churn) — "no history, no drift analysis, no self-optimization loop the vision describes" (AN Part 3.1 §8-5; MASTER:35 "Structured Diagnostics… fuel continuous system self-optimization"). R02 §7 traceability wants the artifact lineage; G21 (replay of past runs) needs it too (R01 §5).

**Research backing.** R01 M10/G12 (typed lifecycle events; OTel GenAI telemetry https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) + G21 (ChatDev log+replay, LangGraph time travel); MASTER:35.

**Exact change.**
1. `src/lib/types.ts`:
```ts
export type TraceRun = { runId: string; phase: PhaseId; ranAt: number;
  origin: "seed" | "phase" | "approve" | "refresh"; traces: AlgorithmTrace[] };
// Project gains: traceHistory: TraceRun[];   // capped 24 runs / ~32 KB total, drop-oldest w/ log line
```
2. `src/lib/engine.ts`: `attachAlgorithms(project, origin: TraceRun["origin"] = "phase")` — appends a `TraceRun` to `traceHistory` while `traces` stays the latest snapshot (UI reads stay compatible); every caller updated (`emptyProject`→"seed", `applyPhaseResult`→"phase", `approveHitl`→"approve", store `refreshPacket`→"refresh"). `runId = <phase>-<Date.now()>-<counter>` (B-12 collision lesson).
3. Console: traces card in the diagnostics rail shows latest run; a small history picker lists prior runs (same renderer, no new component library — R03 T6: existing Radix/Tabs if a tab strip is needed).
4. Emit `trace.run` engine event per appended run (Q-308); Q-302 persists it — cross-session trace history becomes possible without UI state changes.

**Verification.** `engine.test.ts`: every `applyPhaseResult` appends exactly one `TraceRun` containing A1–A8 (A4 appended post-run per AN §1.5 step 4); `approveHitl`/`refreshPacket` append with correct `origin`; cap 24 keeps order and drops oldest; no mutation leaves `traces` diverged from `traceHistory[last].traces`. Manual: run P0→P2, history lists 3 runs.

---

## Q-307 — ADR artifact continuity (Rank 7)

**Problem (evidence).** ADRs exist only as a hard-coded string synthesized inside the P12 docs case — `ADR-001 Graph before code / ADR-002 HITL requires a reason / ADR-003 Domain isolate` (engine.ts:589-612) — i.e., *post-hoc prose at the end of the run*, while the vision demands the system "automatically logs why specific architectural choices were made during Phase 1 and Phase 7" (MASTER:91; phases.ts:105 P12 summary). Research: "nothing forces an ADR at the moment of decision (P0 stack choice, P4 isolation design, P6 codegen runtime, P9 target env)… no decision-owner or status lifecycle; P1 state graph has no per-ADR link" (R02 §7.2); hard-coded numbering also violates Nygard's "sequentially and monotonically numbered, superseded ADRs kept, numbers never reused" (R02 §7.1).

**Research backing.** R02 §7.1 — Nygard, "Documenting Architecture Decisions" https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions.html ("write each ADR as if it is a conversation with a future developer"; Status: proposed/accepted/deprecated/superseded); ecosystem https://adr.github.io/; §7.3 auto-emission rule: every gate changing architecture/deps/interfaces/security (P0/P4/P6/P9/P10/P12) attaches an ADR, mirrored as hash+summary into semantic memory; adoption item 11.

**Exact change.**
1. `src/lib/types.ts`:
```ts
export type AdrStatus = "proposed" | "accepted" | "superseded";
export type AdrEntry = { id: string;            // "ADR-001"… monotonic per project, never reused
  phase: PhaseId; title: string; status: AdrStatus;
  context: string; decision: string; consequences: string;
  createdAt: number; acceptedAt?: number; supersededBy?: string };
// Project gains: adrs: AdrEntry[];   // existing `adr: string` becomes the derived P12 export (kept for artifact compat)
```
2. **`src/lib/adr.ts`** (new, pure): `recordAdr(project, input: Omit<AdrEntry,"id"|"status"|"createdAt">): Project` (assigns next monotonic id; if an open `proposed` ADR exists for the same `phase`+topic, marks it `superseded`); `renderAdrDocs(project): string` (Nygard five-section markdown per entry, status included); `renderAdrIndex(project): string`; `adrMemoryMirror(project)` (semantic entry w/ hash per R02 §7.3).
3. **Trigger registry** `ADR_TRIGGERS: PhaseId[] = [0, 1, 4, 6, 9, 10, 12]` (R02 §7.3); each trigger phase's synthesis (engine.ts `synthesizePhase` cases + P6/P9 canned content) additionally returns an `adrDraft: {title, context, decision, consequences}` describing what the phase actually decided — including the honest P4 stance ("isolation is declarative only; execution is in-page `new Function` — see proposal 01 for the worker path"). Status lifecycle: `proposed` at write; `approveHitl` flips matching open ADRs to `accepted` when the human (or autopilot — recorded as such) passes that HITL phase; a later draft for the same topic supersedes.
4. `renderAdrDocs(project)` feeds the P12 docs artifact (replacing engine.ts:589-612 string) and packet.ts:101 `## ADRs` section; semantic-memory mirror entry per R02 §7.3. Export/download in the Artifacts tab via existing copy affordance.

**Verification.** `adr.test.ts` (~12): trigger phases emit `proposed` ADRs with all five fields; ids monotonic and never reused after supersede; `approveHitl` on P4 accepts the open P4 ADR (and autopilot path records acceptance source at Q-304 level); a second P6 run supersedes the first (`supersededBy` set, old entry kept); `renderAdrDocs` contains exactly Nygard's sections; packet includes ADRs only when `adrs.length > 0`.

---

## Q-308 — Structured engine event stream (Rank 8)

**Problem (evidence).** The diagnostics rail is string `JsonLog` lines (types.ts:72-78); nothing emits typed lifecycle events. Q-302/304/306 otherwise each hand-roll an emitter; G12 names the gap ("String diagnostics log" vs "Typed lifecycle events; OTel GenAI agent spans; trace UI"), and M10/G21 (replay, time travel, spend dashboards) all consume one stream (R01 §4 M10, §5 G12/G21). AN Part 3.1 §8-7 flags the diagnostics rail as the natural surface.

**Research backing.** R01 §4 M10 + URL inventory: OpenTelemetry GenAI semantic conventions https://opentelemetry.io/docs/specs/semconv/gen-ai/ and agent spans https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/ (map `phase.completed` ≈ agent-span end, `packet.compiled` ≈ `gen_ai.agent` output, `hitl.decided` ≈ approval event); LangSmith observability (R01 §3.23). Borrow-list #11 "one pub/sub refactor; unblocks traces, replay, and spend dashboards" (R01 §6).

**Exact change.**
1. **`src/lib/events.ts`** (new, client-safe, zero deps):
```ts
export type EngineEvent =
  | { type: "project.created"; projectId: string; at: number }
  | { type: "phase.started"; projectId: string; phase: PhaseId; at: number }
  | { type: "phase.completed"; projectId: string; phase: PhaseId; ok: boolean; gate?: { passed: boolean; evidenceHash: string }; at: number }
  | { type: "hitl.requested"; projectId: string; phase: PhaseId; at: number }
  | { type: "hitl.decided"; projectId: string; phase: PhaseId; verdict: "approve" | "reject"; decidedBy: "human" | "autopilot"; note?: string; at: number }
  | { type: "trace.run"; projectId: string; phase: PhaseId; runId: string; at: number }
  | { type: "packet.compiled"; projectId: string; phase: PhaseId; bytes: number; at: number }
  | { type: "error"; projectId: string; phase: PhaseId; message: string; at: number };
export function diffEngineEvents(before: Project | null, after: Project): EngineEvent[];  // canonical home (Q-302 imports this)
export function subscribeEngineEvents(fn: (e: EngineEvent) => void): () => void;           // Set-based pub/sub
export const engineEventLog: EngineEvent[];                                                 // ring buffer, cap 500
export function toOtelSpanMeta(e: EngineEvent): Record<string, string>;                     // semconv mapping helper (spec'd)
```
2. `src/lib/store.ts`: one internal `commit(current, next)` helper used by all actions — sets state, runs `diffEngineEvents`, pushes to the ring, notifies subscribers; `seedIfEmpty`/`refreshPacket` emit too. Q-302's emitter subscribes here (decoupling store from network), Q-304's telemetry line reads `hitl.decided` events, Q-306 appends on `trace.run`.
3. Console diagnostics rail renders the tail of `engineEventLog` with kind badges above/beside the existing string log (compat: `JsonLog` untouched).

**Verification.** `events.test.ts` (~15): diff matrix (started/completed/hitl/no-op ⇒ []) — same fixtures as engine-events.test.ts (single source of truth for fixtures in `src/lib/testing/fixtures.ts`); pub/sub ordering + unsubscribe; ring cap 500; `toOtelSpanMeta` maps every union member without throw. Store smoke: one `execute()` emits `phase.started` + `phase.completed` in order.

---

## Q-309 — `ai.ts` wiring spec: `enrichBrief` on intake (Rank 9)

**Problem (evidence).** `ai.ts` (`enrichBrief`, xAI grok-4.5 via `createServerFn`, `XAI_API_KEY` from server env) has **zero importers in src/** — the only LLM hook in the app is dead code, and AGENTS.md's `XAI_API_KEY` guidance is moot for the core (A01 §7; AN Part 3.1 §3.9). Project creation is fully local (console.tsx `launch()`: `create(brief)` at console.tsx:59; `modelRoute` hard-codes `"local-edge"` while `"grok-4.5"`/`"failover"` exist only as labels — types.ts:13, engine.ts:816, AN §7). AN Part 3.1 §8-1: the deterministic fallback content gives "a genuinely good design property" — a graceful degrade path for exactly this wiring; §8-4a: `enrichBrief` could name/domain-tag at creation.

**Research backing.** R01 M8 (context engineering), §3.12 Claude Code conventions; the deterministic-fallback-first design is the audit's own recommended activation path (AN Part 3.1 §8-1, §11 headline verdict: "then wiring ai.ts + db.ts into the graph"). A01 §9.2 (current secrets posture: server-only key, TLS, no logging — keep it that way).

**Exact change (spec only — no key required to land the code).**
1. **`src/lib/ai.ts` hardening** (small): add `AbortSignal.timeout(10_000)` to the fetch; hoist `const XAI_URL = "https://api.x.ai/v1/chat/completions"`; keep the discriminated `{ok:false,error:"edge"|"failover"}` | `{ok:true,name,note}` shape; document that `error:"edge"` = no key, `"failover"` = upstream failure.
2. **`src/lib/enrich.ts`** (new, pure — the testable seam):
```ts
export function applyEnrichment(project: Project, r: { name?: string; note?: string }): Project;
// no-op when name empty; otherwise rename + append note (≤220 chars) as an intake artifact
// "Intake enrichment (grok-4.5)" kind "algorithm", phase 0; never touches phases/status.
```
3. **Console wiring** (console.tsx `launch()`, line ~59): after `const id = create(brief.trim())`, fire-and-forget:
```ts
void enrichBrief({ data: { brief: brief.trim() } }).then((r) => {
  if (!r.ok) return;                                   // edge/failover/network ⇒ keep local result (graceful degrade)
  const s = useRapid.getState();
  s.rename(id, r.name);
  s.setNotes(id, `enriched: ${r.note}`);               // flows into packet v2 operator notes (Q-303)
});
```
Navigation proceeds immediately; enrichment lands ~1-2 s later with a small toast (sonner is installed). If `setNotes` should not clobber user notes, use a `notePrefix` concat — spec: append with newline, never overwrite.
4. **Not changed:** no client-side key (server env only — A01 §9.2); `modelRoute` semantics untouched (documented in the P0 ADR draft, Q-307); real per-phase LLM synthesis remains out of scope (proposal 01+).

**Verification.** `enrich.test.ts` (~6): `applyEnrichment` no-ops on empty name; renames; appends note artifact ≤220 chars; preserves phases/status/packet-adjacent fields. Manual (dev only): without `XAI_API_KEY` app behavior byte-identical; with key set, name+note appear within ~2 s; grep built bundle for `api.x.ai` — server-only (createServerFn handler never ships to client).

---

## Q-310 — Persisted-payload schema versioning + one-shot migration (Rank 10)

**Problem (evidence).** `hydrateProject` (engine.ts:842-867) "mutates legacy rows on every boot… rewrites `phases` from scratch when length ≠ 13 — no log/notice of the reset" (B-25) and silently wipes history on malformed storage (B-14); it also only fills the fields known at audit time — every new `Project` field added by Q-303/304/306/307 (`hitlLedger`, `traceHistory`, `adrs`, `gate`) needs a default or old payloads break. The persist layer has no versioning today (`persist(..., { name: "rapidtool.v4", partialize })`, store.ts:256-262).

**Research backing.** A01 §6 B-14/B-25; R03 T4 (SSR-hydration-safe client persistence: versioned migrations inside the persist middleware) — best practice per https://docs.pmnd.rs/zustand/integrations/persisting-store-data (zustand persist `version` + `migrate`); AN Part 3.1 §8-2 ("store's hydrateProject already anticipates versioned persistence").

**Exact change.**
1. `src/lib/store.ts`: bump the persist contract —
```ts
persist(..., {
  name: "rapidtool.v4",                 // keep key; shape changes inside
  version: 2,
  migrate: (persisted, version) => version < 2
    ? { projects: (persisted as { projects: Project[] }).projects, activeId: null, autopilot: false }
    : (persisted as PersistedShape),
  partialize: (s) => ({ schemaVersion: 2, projects: s.projects, activeId: s.activeId, autopilot: s.autopilot }),
})
```
2. `src/lib/engine.ts`: `hydrateProject(raw)` gains repair reporting — returns `{ project, repaired: string[] }` (internally; store maps it) and fills the new-array fields with `[]` defaults; the non-13 `phases` reset stays but now **logs** `phaseHistoryReset` into `logs` (B-25: no silent reset) and is run once by the version bump, not every boot (move the map-over-projects re-hydration out of `seedIfEmpty`'s every-boot path into the v2 migrate step; `seedIfEmpty` keeps seeding).
3. Storage-usage warning: tiny helper `estimateStorageUsageKb(projects)` surfaced in diagnostics when > ~4 MB of the ~5 MB quota (A01 §9.6).
4. SSR note: this touches `onRehydrateStorage` only; the B-09 hydration-text mismatch fix (gate seeding behind mounted-state guard) belongs to proposal 02 — do not fold it in here.

**Verification.** `store.test.ts` additions: seed a v1-shaped payload (bare `{projects}` array) in the shim → rehydrate → projects retained, new fields defaulted, `schemaVersion:2` written back; 12-phase corrupt payload → reset **plus** a `phaseHistoryReset` log entry (assert it exists — the B-25 regression); empty/corrupt JSON → graceful `projects: []` + demo seed, no throw.

---

## Q-311 — Coverage targets + lint/arch rules (Rank 11)

**Problem (evidence).** `npm run lint` = eslint flat config with recommended + react-hooks only (eslint.config.mjs); there are no per-area quality gates, no coverage tooling, and nothing mechanically enforces the one architectural boundary that matters for Q-302: `db.ts` is server-only (db.ts:173-177) yet nothing stops a future client module from importing it. The console's own QA loop (Part 6 release QA: smoke/lint/type/test/build; scripts/browser-smoke.mjs + verdict JSONs) has no unit-coverage signal (A03 §4.3, §4.7).

**Research backing.** R01 M5/G22 (the console itself needs CI); R02 §4 verification-driven development; the existing scripts QA pattern (A03 §4.3) extends naturally.

**Exact change.**
1. `package.json` scripts:
```jsonc
"test:core": "node --experimental-strip-types --test src/lib/phases.test.ts src/lib/algorithms.test.ts src/lib/engine.test.ts src/lib/packet.test.ts src/lib/sandbox.test.ts src/lib/store.test.ts src/lib/events.test.ts src/lib/gates.test.ts src/lib/adr.test.ts src/lib/manifest.test.ts src/lib/enrich.test.ts src/lib/engine-events.test.ts",
"test:coverage": "node --experimental-strip-types --experimental-test-coverage --test <same explicit list>"
```
(`test` keeps the full union: existing scripts + app-data/auth + `test:core` files.) Node's built-in experimental coverage prints per-file % (no new devDependency; strict thresholds later can be added via a thin `scripts/coverage-gate.mjs` reading the lcov/text output if the parent wants hard gates).
2. Coverage targets (documented in this proposal; enforced by review until a gate script lands): phases 100% · packet ≥90% · sandbox ≥90% · events ≥90% · adr ≥90% · gates ≥85% · algorithms ≥85% · engine ≥70% (large canned-synthesis strings excluded via `/* v8 ignore next */` where cited) · store ≥75% (shim + async paths).
3. `eslint.config.mjs` additions (minimal, style-consistent):
```js
rules: {
  eqeqeq: ["error", "always", { null: "ignore" }],
  "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }], // codebase already uses `import type`
  "no-warning-comments": ["warn", { terms: ["TODO", "FIXME", "HACK"] }],
  "no-restricted-imports": ["error", { patterns: [{ group: ["@/lib/db"], message: "db.ts is server-only — call it from a createServerFn handler, never client code." }] }],
}
```
The `no-restricted-imports` rule mechanically enforces the A03/AN boundary that Q-302's design depends on.

**Verification.** `npm run lint` clean; `npm run typecheck` clean; `npm run test:coverage` prints per-file % meeting the targets table (record baseline before W1, re-run after each wave); a deliberate test import of `@/lib/db` from a client module fails lint with the boundary message.

---

## Q-312 — Artifact manifest + instruction-file emission (Rank 12)

**Problem (evidence).** Artifacts are "browsable but not consumable" — P9 YAML / P12 OpenAPI/ADR bodies are read-only text in a `<pre>` (AN Part 3.1 §8-6); interop is a single ≤14k paste (G7: "artifact handoff through conversation copying or one big paste"); the packet "re-invents conventions ad hoc" instead of emitting the AGENTS.md/CLAUDE.md format 30+ tools consume (G20/G9); nothing server-side can fetch a packet (AN §8-4b). No id links artifacts → tests → approvals (R02 §7.2 weaker: "no traceability ids").

**Research backing.** R01 §4 M7/G7 + borrow #3 (artifact registry + reference-based packets preserving paste-ability; A2A envelopes), G9/G20 + borrow #7 ("Emit AGENTS.md/CLAUDE.md into generated repos… 30+ tools consume the format" — OpenAI agents.md https://agents.md, Anthropic/Claude Code conventions), GitHub Spec Kit (spec→plan→tasks chain) — R01 §7 URL inventory. R02 §7.3 traceability-ID scheme (`RT-<phase>-<seq>`, AC↔test enforcement deferred to Q-305).

**Exact change.**
1. **`src/lib/manifest.ts`** (new, pure):
```ts
export type ArtifactRef = { id: string; phase: PhaseId; kind: ArtifactKind; title: string;
  rtId: string; sha256: string; bytes: number; updatedAt: number };
export type ArtifactManifest = { schema: "rapidtool.manifest/1"; projectId: string; name: string;
  currentPhase: PhaseId; packetVersion: number; artifacts: ArtifactRef[] };
export function buildManifest(p: Project): ArtifactManifest;
// rtId = `RT-P<phase>-<idx>` assigned deterministically over a stable sort (R02 §7.3);
// sha256 over artifact.body (pure JS SHA-256 via crypto.subtle where available, sync FNV fallback
// documented as pre-subtle — or keep body hashes async; spec: compute in attachAlgorithms, async-safe)
```
2. `src/lib/engine.ts`: `attachAlgorithms` refreshes `Project.manifest` alongside the packet (same cadence, cheap: ≤14k packet + 900-char bodies).
3. `src/lib/packet.ts` (v2): new short `## Artifact manifest` section listing `id · kind · sha256(12)` refs **instead of** full bodies — the M7 "reference-based packet" step that ends the 14k ceiling pressure; full bodies stay in the app's artifact tabs.
4. **`emitInstructions(project): { fileName: "AGENTS.md"; body: string }`** (new, in manifest.ts or `instructions.ts`): generates the repo-convention instruction file for the generated project — mission, phase lock ("current phase P<n> only"), DoD pointer (Q-305), decision-ledger pointer (Q-304), no-secrets rule — mirroring the packet's System section in the format downstream agents auto-read (G9/G20).
5. Console: Artifacts tab gains "Copy manifest (JSON)" and "Download AGENTS.md" buttons (small; existing copy affordances).

**Verification.** `manifest.test.ts` (~10): `rtId`s stable across identical builds and monotonic; sha256 changes iff body changes; manifest reflects `currentPhase`; packet v2 contains the manifest ref section; `emitInstructions` output parses as valid AGENTS.md front-matter-free markdown and names the current phase; store smoke: after P0 run, manifest.artifacts non-empty and matches Artifacts tab count.

---

## 14. Test inventory (all files, with owners)

| File | New? | Domain | Est. cases | Depends on |
|---|---|---|---|---|
| `src/lib/phases.test.ts` | new | transition predicates + table invariants | ~10 | — |
| `src/lib/algorithms.test.ts` | new | A1–A8, scoring, B-pins | ~35 | — |
| `src/lib/engine.test.ts` | new | engine orchestration, HITL, hydrate | ~30 (+Q-304/306 additions) | — |
| `src/lib/packet.test.ts` | new | A4 v1 pins + v2 (Q-303) | ~10 → ~16 | Q-303 |
| `src/lib/sandbox.test.ts` | new | denylist/heal pins | ~6 | — |
| `src/lib/store.test.ts` | new | store actions, autopilot, persist shim | ~25 (+Q-310) | shim pattern |
| `src/lib/events.test.ts` | new | diff matrix, pub/sub, ring (Q-308) | ~15 | Q-308 |
| `src/lib/gates.test.ts` | new | DoD/DoR probes, fixture runs (Q-305) | ~20 | Q-305, fixtures |
| `src/lib/adr.test.ts` | new | ADR lifecycle/rendering (Q-307) | ~12 | Q-307 |
| `src/lib/manifest.test.ts` | new | hashes/rtIds/instructions (Q-312) | ~10 | Q-312 |
| `src/lib/enrich.test.ts` | new | `applyEnrichment` (Q-309) | ~6 | Q-309 |
| `src/lib/engine-events.test.ts` | new | checkpoint diff + queue fail-open (Q-302) | ~12 | Q-302/Q-308 diff |
| `src/lib/testing/fixtures.ts` | new | shared fixture builder (brief → project at phase n) | — | shared |
| `src/lib/app-data/app-data.test.ts`, `auth/*.test.ts`, `scripts/*.test.mjs` | existing | untouched | — | — |

**Shared fixtures rule:** one `fixtures.ts` builder (`projectAtPhase(n)`, `runHeadless(project, phases)`) reused by engine/gates/store/packet tests — the seed of the M5/G22 "headless P0–P12 harness" without adding a harness framework.

## 15. Cross-cutting acceptance checklist

1. `npm test` green with the extended explicit list; new files only via `node --experimental-strip-types`.
2. No new runtime dependencies (node:test/assert, crypto, zustand persist, existing createServerFn — all present). PGlite browser path is documented, not added.
3. All server-side DB writes go through `getSql()` inside `createServerFn` handlers; `no-restricted-imports` enforces it; fail-open never blocks a UI action.
4. No brief text, artifacts, or notes leave the client for the DB (Q-302 sha256-only) — AGENTS.md §0.5 auth-off posture preserved; revisit only if auth turns on (add `user_id` + scope then).
5. Every candidate lists its verification; Q-301 pins double as regression tests for proposals 01/02 fixes.
