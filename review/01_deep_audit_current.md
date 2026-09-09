# RapidTool — Deep Audit 01 · Current State (post-mission-1)

**Date:** 2026-09-05 (fresh read of the tree as it stands)
**Scope:** `src/lib/{engine,algorithms,packet,sandbox,store,dod,gate-stats,phases,types,templates,testing/fixtures}.ts`,
`src/components/console.tsx`, `src/routes/*`, plus the six core test suites.
**Mode:** READ-ONLY. Nothing in the tree was modified.
**Repo:** not git; paths relative to `C:\Users\mnril\Desktop\RapidTool Main`.

## How this audit was verified (not assumed)

- Line counts re-measured: engine.ts 1084, algorithms.ts 786, packet.ts 180, sandbox.ts 240,
  store.ts 400, dod.ts 278, gate-stats.ts 66, phases.ts 131, types.ts 234, templates.ts 26,
  fixtures.ts 104, console.tsx 1200.
- Test run, 2026-09-05, `node --experimental-strip-types --test` on the six core suites:
  **algorithms 41 · sandbox 19 · packet 21 · store 22 · gates 33 · gate-stats 9 = 145/145 pass**
  (~4 s). The mission brief's split (store 30 / gates 24 / gate-stats 18) does not match what the
  runner reports today — totals are counting-granularity sensitive (gates.test's parametrized loop
  contributes 13 `it`s). Re-measure before quoting "190"; the claim "190/190 green" itself did not
  reproduce exactly as stated (see appendix).
- `scripts/*.test.mjs` (App-Builder platform chrome: grok-pwa-og, preview, symlink CLI) shows 10
  failures on this Windows host (symlink/OG-injection cases). Those are platform tests, not
  RapidTool code — environment-conditional, excluded from scope, listed in the appendix.
- Every finding below was checked against actual bytes. The riskiest were reproduced (A02 repro) or
  confirmed by caller-graph greps (`grep -rn` across src with test files excluded where noted).
- Dead-code claims (A06, A12, A25, A26, A30) verified by import/caller greps, not eyeballing.

Severity: **P1** = breaks a headline feature or strands the user with no path forward ·
**P2** = wrong behavior/honesty defect in a real flow · **P3** = robustness/UX/defense-in-depth ·
**P4** = nit / dead weight.

---

## 1. Findings table

| ID | Sev | File:line | Issue | Why it matters | Fix sketch |
|---|---|---|---|---|---|
| A01 | **P1** | store.ts:294 (+ engine.ts:859, store.ts:58-60) | `recordGate(approved, project.currentPhase)` runs **after** `approveHitl` already advanced `currentPhase` to phase+1, so the guard `rec.status !== "complete"` early-outs on the *next* phase | **T8 is broken for every HITL phase**: P4/P5/P8/P9 (and failing-P6) approvals never record `PhaseRecord.gate`, a gate artifact, or a `gate.verdict` log. Only non-HITL phases that complete inline (0,1,2,3,7,10,12) get verdicts | Capture `const gatePhase = project.currentPhase` before `approveHitl`; call `recordGate(approved, gatePhase)`; add store-level test asserting `.gate` after every approval path |
| A02 | **P1** | sandbox.ts:1,55 + store.ts:274-284 + console.tsx:1035-1062 | (a) `FORBIDDEN` regex matches inside JSON string literals — a rejection note containing `process` fails the P6 module (reproduced, §2); (b) that parks a `forceHuman` HITL (engine.ts:501) whose only exit is `approve(...,{force:true})` — but **no UI control exists**; the error text demands a checkbox that isn't there (`grep force` in console.tsx → only `forceMount`) | Any P6 failure strands the project at `awaiting_hitl` forever: Approve always errors; Reject→Retry regenerates a module still embedding the same note | (a) Don't regex-check engine-injected string literals (or execute via runSandboxed, which has no regex); (b) add the "I reviewed the failure" override checkbox to HitlDock |
| A03 | **P2** | types.ts:83-90 + engine.ts:828-829,894 + console.tsx:341 + gate-stats.ts:51-55 | `HitlRequest` carries no request timestamp, so `requestedAt` defaults to `Date.now()` at decision time — every production row has `requestedAt === decidedAt`; `approvalHealth` excludes those rows from the mean (gate-stats.ts:51) and reports mean 0 → **any 3 human approvals flag "rubber"/"fast"** regardless of reality; also `approvalHealth` has **zero callers outside tests** | The E-105 rubber-stamp detector is either silent (unwired) or wrong (once wired) — a detector nobody sees and nobody can satisfy | Stamp `requestedAt` on the HitlRequest when the gate opens; wire approvalHealth into the gate-log UI with an explicit "no timing data" state |
| A04 | **P2** | store.ts:101-107 + engine.ts:287-295 + store.ts:121-124,171-174,156,294 | Autopilot may approve a **P0 reframe** HITL: `canAutopilot` excludes only STOCK_HITL and `forceHuman`; a reframe verdict gate (phase 0) is neither — reachable with autopilot on + tightness < 7.2 (vague brief, low-risk domain → tightness ≈ 4.75). Same path approves scheduler-extra gates — and **no autopilot approval ever gets a DoD verdict** (recordGate ran pre-approval while `awaiting_hitl`, and post-approval targets the wrong phase, A01) | The machine silently accepts its own "stop — human must tighten the brief" signal (B-03/R3 spirit), and those gates leave no machine-checkable record | Mark reframe gates `forceHuman: true`; run recordGate with the pre-approval phase on every approval path |
| A05 | **P2** | engine.ts:448 (+ unlockRetry keeps rejectionNote, engine.ts:926-932) | P6's module builder picks `project.phases.find((p) => p.rejectionNote)` — the **first phase anywhere** with a rejection note — so after any earlier rejection (P5…) the *first* P6 run embeds that unrelated note as `REJECTION`, flipping the deterministic variant and the "addressed" flag | Cross-phase contamination: the module claims to address a rejection from another phase; combined with A02 it can brick P6 on the first attempt | Scope the lookup to the phase being run (`p.id === phase`); use ctx-note only |
| A06 | **P2** | sandbox.ts:168-240 vs engine.ts:12 + engine.ts:1040-1041 | `runSandboxed` (blob Worker + timeout + network stubs) has **no callers outside its own test file**; engine always runs `runGenerated` (sync template path). Yet `hydrateProject` preserves a persisted `runtime:"worker"`, and `sandboxClaim` (sandbox.ts:93-96) + the P4 artifact (engine.ts:401) would claim "Worker isolate, 30s hard cap" for code that actually ran synchronously in the page; `sandbox.timeoutS` never reaches the runner (constant default, sandbox.ts:114) | The headline "real worker sandbox" is unreachable from the app; any persisted `runtime:"worker"` payload produces a false execution claim | Dispatch: when `runtime === "worker"`, route P6 through `runSandboxed` with `timeoutS`; otherwise never preserve/claim "worker" |
| A07 | **P2** | engine.ts:25-52,509-527 + types.ts:63-64 + console.tsx:963-984 | `Competitor.source: "illustrative"` is **write-only**: no consumer reads it. The P7 "Competitive analysis matrix" artifact and the console table present template rows about real products (Cursor, ServiceTitan…) with no disclaimer anywhere | B-23 honesty contract exists only in a comment; fabricated competitive analysis is shown as fact | Render the marker — footnote on the table + artifact body whenever any row is `source:"illustrative"` |
| A08 | **P2** | console.tsx:320-329 vs store.ts:394-397 (HomeScreen-only fallback, console.tsx:148-155) | Deep-linking/reloading `/run/:id` renders before zustand persist rehydrates → flash of "This build doesn't exist or was archived."; nothing forces hydration on RunScreen (Home has an 80 ms fallback) | Broken-looking cold start on the main work surface | Gate on `hydrated` (loading state) or hoist the hydration fallback to RunScreen |
| A09 | **P2** | engine.ts:778,872,922 (`.slice(0, 80)`) + console.tsx:837-844 | Memory capped at 80 rows with **silent oldest-first eviction** on every phase run; memory pane shows `slice(0,8)` with no overflow indicator | The "hierarchical memory" quietly forgets; early episodic rows (incl. rejection records that steer T9) vanish without a trace | Log evictions; show "of N" counts; keep rejection memories above the cap |
| A10 | **P2** | packet.ts:126 + engine.ts:793-794 | `Sandbox: pass/fail` prints `project.lastTest`, written **only by P6** and never reset — so the P9-P12 packet and header strip (console.tsx:626-630) report "Sandbox: pass · tests.pass" as if the *current edge* was tested | Misleading freshness signal at later phases | Label the row "P6 sandbox:" or clear `lastTest` when advancing past P6 |
| A11 | **P2** | store.ts:300-310 vs 265-271 | `reject()` never checks `hitl.phase === currentPhase` or that the record is actually awaiting (approve checks both); `rejectHitl` (engine.ts:877-924) then marks the current phase rejected and blocks the project | Guard asymmetry: a stale/corrupt `hitl` rejects the wrong phase record and bricks the run | Mirror approve's guards in reject |
| A12 | **P2** | engine.ts:704-727 + store.ts:367-368 comment + console.tsx:657-670 | `attachAlgorithms` **replaces** `traces` wholesale on every stamp (every phase, approve, refreshPacket/copy/export); the store comment claims "fresh A1..A8+A4" but the actual set is A1,A3,A5,A6,A7,A8+A4 — **A2 never appears** (fusionRank runs only inside compileAgentPacket, algorithms.ts:615-617) | Algorithm history erased on every refresh; trace panel and comments misrepresent what ran | Append-and-dedupe traces (last run per id) or fix the comment; include A2 in the trace set |
| A13 | **P3** | sandbox.ts:5-27 | The sync "sandbox" executes `new Function(body)` with **full page globals** — template-shaped source could call bare `fetch`/`self.fetch` or loop forever on the UI thread; the regex (A02) and the shape gate (sandbox.ts:15) are the only guards; no wall-clock bound in the sync path | Defense-in-depth gap; contradicts "bounded by construction"; a future producer bug = network call or frozen tab | Ban `fetch`/`self.*` too; the real fix is routing non-template source to runSandboxed (A06) |
| A14 | **P3** | sandbox.ts:205-240 | `runSandboxed` never wires the worker `onerror`; a worker that dies before replying costs the full 30 s timeout with the misleading detail "killed after 30s" (it wasn't killed — it never started) | Bad diagnostics on CSP/parse failures; slow UX in the one place real failures show | Add onerror → settle({ok:false, detail:"worker crashed"}); keep timeout as backstop |
| A15 | **P3** | algorithms.ts:225 + engine.ts:1064 | Persisted memory with an unexpected `kind` makes fusionRank throw inside packet compilation (`byKind[m.kind].push`); hydrate never sanitizes memory rows | One corrupt row bricks every stamp/execute/packet | Skip unknown kinds (or coerce) during hydrate |
| A16 | **P3** | engine.ts:1013-1024 + console.tsx:907 | `repairPhases` validates `id` only — a record with a garbage `status` string is kept; `PHASE_STATUS_META[rec.status]` then renders undefined meta and store logic falls through to `runReady`, force-completing the phase | Corrupt storage → invisible UI breakage or silent state jumps instead of a loud repair | Validate status ∈ PhaseStatus; drop/repair invalid records loudly (B-25 style) |
| A17 | **P3** | engine.ts:831,902 (`slice(-100)`) vs types.ts:202 ("append-only") | Decision journal capped at 100 rows with silent oldest-drop; rejectionHistory is uncapped | "Append-only" promises more than the code keeps; at 25+ gates history disappears | Remove the cap or document + log eviction |
| A18 | **P3** | console.tsx:1171-1197 | PhaseRecordView renders each rejection twice: once from `decisions` ("reject · human") and once from `rejectionHistory` ("rejection ·") — same event, same text, no linkage | Looks like two events; two sources of truth shown unjoined | Render one list keyed by `at`, or join by note+at |
| A19 | **P3** | console.tsx:827-833 + store.ts:360-363 | Every keystroke in Notes runs a full zustand set → persist JSON-serializes **all projects** (packets up to 14 KB each) to localStorage | Typing lag grows with project count/size; quota risk on long notes | Debounce notes persistence (or persist notes separately) |
| A20 | **P3** | phases.ts:122-128 (priorsSealed) | `priorsSealed` checks `phases[i]` **by array index**, relying on an undocumented invariant (13 contiguous records, id==index, sorted — only repairPhases guarantees it) | Any future partial/unsorted phase array silently mis-seals the graph | Index by `r.id`, or assert the invariant in repairPhases |
| A21 | **P3** | packet.ts:25-28 + engine.ts:184-187 | Artifacts trimmed `slice(-8)` with 900-char `body.slice` — cuts mid-content, no marker; on `refreshPacket` the *previous* packet artifact is still in `artifacts` while the new packet compiles, so the new packet embeds a stale excerpt of itself | Self-referential, stale, silently truncated content in the paste-ready artifact | Exclude `kind==="packet"` from the trim pool; add per-artifact ellipses |
| A22 | **P3** | dod.ts:211 (`DOD[phase as PhaseId] ?? []`) | `runGate(project, <unregistered number>)` returns `pass:true` with the hash of the empty string | Unknown phases pass vacuously; the "evidence hash" is a constant | Return `pass:false` (or throw) for unregistered phases |
| A23 | **P3** | console.tsx:299,508-510 | Execute is synchronous, so `running` is never observable across renders — `disabled={running}` can't stop a fast double-click; two `execute()` calls advance **two** phases | Accidental phase skip on double-click | Synchronous `busy` latch before the store call |
| A24 | **P3** | console.tsx:184-189 vs 657-670 | Home copy: "four onboard algorithms: Intent Lattice, FusionRank, Constraint Scheduler, and an Agent Packet compiler" — the trace panel shows seven ids; eight actually run | Copy drift; "onboard algorithms" means different counts in two places | Rewrite home copy to match the trace set |
| A25 | **P4** | phases.ts:130 | `HITL_PHASES` exported, never imported anywhere | Dead export | Delete or use |
| A26 | **P4** | types.ts:164 | `ContractEndpoint.method` includes `"PATCH"`; A6 only ever emits GET/POST (algorithms.ts:421) | Dead type member | Trim or implement |
| A27 | **P4** | gate-stats.ts:47 | Window filters on `decidedAt` only; a request that sat 6 days and was decided today counts its full (mostly pre-window) latency | Window semantics skew the mean for old requests | Also window on `requestedAt >= now - windowMs` |
| A28 | **P4** | engine.ts:113-115 | `scorecard()` throws when lattice/schedule are absent; all current callers prime first, but `synthesizePhase` is exported and callable on an unprimed project | Latent footgun for future callers | Return degraded scorecard or document the precondition at the export |
| A29 | **P4** | sandbox.ts:113-114 + engine.ts:972 | `SANDBOX_DEFAULT_TIMEOUT_MS = 30_000` duplicates the type default `timeoutS: 30`; no shared constant | Two sources of truth for one cap | Derive from one constant |
| A30 | **P4** | store.ts:157-159,177 + store.ts:116-118 | `runReady`'s `blocked` branch and "Pipeline complete"/locked error paths are unreachable today (applyPhaseResult never returns blocked) | Dead defensive branches, untested | Make reachable via a test hook or delete |

---

## 2. Evidence for the P1s

### A01 — T8 gate verdicts never recorded for HITL phases (traced call-by-call)

1. `store.ts:58-60` — `recordGate` early-outs unless `rec.status === "complete"` for the phase passed in.
2. `store.ts:294` (human approve) — `const updated = recordGate(approved, project.currentPhase);`
3. `engine.ts:859` (`approveHitl`) — `currentPhase: phase === 12 ? 12 : next` — so by step 2 the
   current phase is already `approved + 1`, whose record was just set to `"ready"` (engine.ts:815)
   → early-out → **verdict never recorded**.
4. The only place a verdict *is* recorded is `store.ts:156` inside `runReady`, immediately after
   `applyPhaseResult` — but HITL phases are `awaiting_hitl` at that moment (engine.ts:761), so
   `recordGate` no-ops for them too. Net effect: P4/P5/P8/P9/failing-P6 approvals produce no
   `PhaseRecord.gate`, no `gate.verdict` log, no gate artifact. Non-HITL phases (0,1,2,3,7,10,12)
   do get verdicts.
5. Test blindness: `grep -rn "\.gate\b" src/lib/*.test.ts` → **zero hits**. No test asserts a verdict
   exists after a store-level approval, so 145 green tests ship this.

### A02 — P6 sandbox dead-end (reproduced)

```
buildPhase6Module({ name:"Tracker", jobs:["dispatch"],
  rejectionNote:"Please document the flow and process each job in order." })
→ runGenerated ⇒ { ok:false, detail:"Forbidden primitive in generated module." }
```

- Cause: `sandbox.ts:1` regex (`\bprocess\b`, `\brequire\b`, `\beval\b`, `\bimport\s`…) is applied to
  the **whole module text, including the JSON-escaped string literals the engine itself injects**
  (rejection note at sandbox.ts:55, project name at sandbox.ts:66). "process" in a human rejection
  note is a realistic, innocent word.
- Consequence chain: P6 fails → `forceHuman:true` HITL (engine.ts:501) → plain approve is refused
  (store.ts:274-284) with the error *"Failing sandbox output requires explicit override — tick 'I
  reviewed the failure'"* → **no such checkbox exists** — HitlDock (console.tsx:1035-1062) offers
  Approve / Reject / note only. Reject→Retry regenerates a module that still embeds the same note →
  identical failure (healSource only patches a *missing* `test_happy`, sandbox.ts:29-34). Exits:
  archive the project, or keep rejecting with notes that dodge every forbidden word.
- Reachability today: yes — any ≥12-char rejection note (or future producer source) containing a
  lowercase forbidden word. Capitalized project names pass (`inferName` capitalizes, engine.ts:98-105),
  which is why happy-path tests never trip it.

---

## 3. Module-by-module deep notes

### 3.1 `engine.ts` (1084 ln)

- The phase content pipeline is a genuine state machine: `emptyProject` (934-997) primes algorithms
  + packet + bootstrap memory (R4/B-05 ordering at 990-995 is correct); `applyPhaseResult` (729-798)
  merges deterministically, keeps foreign-phase artifacts, appends packet artifact via
  `sealPacketArtifact` (167-181). `attachAlgorithms` + `compileAgentPacket` per mutation is idempotent
  in content but re-stamps timestamps (see A12).
- **Correct detail worth keeping:** `dedupeMemoryIds` (158-165) is order-preserving and only renames on
  true duplicates; logs are capped at 200 (`slice(-200)`) consistently — but memory at 80 (A09) and
  decisions at 100 (A17) are silent, while logs aren't.
- `repairPhases` (1003-1035) is genuinely good — id-known first-wins, loud repair log — but stops at
  id validation (A16).
- `hydrateProject` (1037-1084) fills every new field with a default and preserves legacy `runtime`
  (A06), but deliberately skips re-priming when packet+lattice+specGraph exist — meaning **persisted
  traces can be empty or stale while the UI's trace panel (console.tsx:657) renders nothing**; the
  early return also skips memory sanitization (A15).
- `approveHitl` (800-875): force-override logging and override-memory are well done; the decision row
  correctly records actor (T2). Problems: no recordGate (A01), `requestedAt` collapse (A03), and the
  forcedOverride predicate (820) re-derives `phase === 6 && lastTest fail` instead of trusting
  `hitl.forceHuman` — if lastTest were ever cleared between gate-open and approve, the override
  memory/log would silently not fire.
- `rejectHitl` (877-924): reject rows land in both journal and rejectionHistory — consistent by
  design, but console renders them as two events (A18); `requestedAt: now` (894) loses think-time (A03).
- P6 case (444-505): heal logging distinguishes repaired vs noop (B-07) — good. The `variant`
  flip from `(fnv1a(note)+attempt) % 2` is deterministic but means retry 1 and retry 2 produce
  different modules for the same note — acceptable, undocumented.
- Phase 0 reframe HITL (287-295) lacks `forceHuman` (A04). P11 extra-gate HITL (641-648) is
  conditional on scheduler — consistent with canAutopilot, modulo A04.
- P12 openapi/adr generation (650-700) is deterministic and probes `openapi: 3.1.0`/`ADR-` markers
  match the produced text (dod.ts:180-185) — good coupling.
- `scorecard()` throw (113-115): fine today, latent (A28).

### 3.2 `algorithms.ts` (786 ln)

- A1 `intentLattice`: word-boundary, stem-aware phrase matching (133-142) with frequency weights is
  solid; the `vague` flag is computed pre-fallback (182) — correct per its own doc; health-ops
  hipaa/phi auto-insert (170-175) is a domain policy, fine. Note `nodes: unique.slice(0,18)` means
  complexity (189) saturates at ~11.1 → clamped 10 — so complexity is capped by node count only for
  briefs with >18 vocab hits; fine at this scale.
- A2 `fusionRank`: per-kind normalization (237) prevents singleton domination — real thought went in.
  Ranking is O(n log n) per call and runs inside every packet compile (3× per phase via
  attachAlgorithms churn) — negligible at n≤80.
- A3 `scheduleConstraints`: extraHitl is a Set, but tightness ignores extraHitl count — a project can
  gain extra gates without tightness rising; intended? The autopilot boundary (`<7.2`, store.ts:106)
  is an unlabeled magic constant duplicated in no type — P4 note: extract to a shared constant with a
  comment (see A04's fix).
- A5 topo (285-314) throws on cycles — loud, good. A6 copies bank rows (417) — mutation-safe, good.
  A7 oracle (429-454) mixes jobs + constraints + graph case — nice.
- A8 `routeCrew`: ACTIVE_BY_PHASE covers 0..12 (461-475), tested; budgets shift with tightness only
  for architect/implementer — reviewer/tester budgets are static even though their workloads change —
  cosmetic.
- `estimateTokens` (674-693): honest ±15% band, empty→0, LRU cap 100 with recency refresh — good;
  cl100k_base bundle weight in a browser console is the only cost (P4 perf note: gpt-tokenizer vocab
  ~1.2 MB gzipped into the client bundle — worth a lazy-load if the bundle budget ever matters).
- `fnv1a`/`stemToken`/`tokenizeWords` (700-736): correct and well-tested; stemmer never returns
  shorter-than-3 unless input was (729) — good.

### 3.3 `packet.ts` (180 ln)

- v2 stamp, honest truncation marker, ledger quoting, compact prior-rejection pointer (45-58) vs
  legacy detail dump, loop-count section, per-phase next-edge line (166-168) — all correct and
  pinned by 21 tests.
- Ordering hazard: `hasRejectDecisions` (48) collapses the prior-rejection block to a pointer to
  "## Decision ledger (HITL)" — but the ledger section is only emitted when `ledgerRows.length` (128).
  A project with rejectionHistory but zero decisions (legacy) takes the detail branch (52) — the two
  branches are consistent, good; a project with *approve-only* rows and a legacy rejectionNote prints
  the pointer to a ledger that exists (approve rows) but contains no reject note — the pointer says
  "see ledger" and the reject note is *not* in the ledger. Minor honesty gap: mixed legacy
  (rejectionNote) + new (decisions) state loses the rejection text from the packet. P4.
- `lastTest` line (126) phase-staleness — A10. Artifact trim — A21. `slice(-8)` includes the gate
  artifacts of recent phases; fine.
- Whitespace filter `.filter((line) => line !== "")` (172) collapses intentional blank-line
  separators in `notes`/ADRs — cosmetic only.
- Decision rows: `new Date(d.decidedAt).toISOString()` per row — deterministic given data, good.

### 3.4 `sandbox.ts` (240 ln)

- `runGenerated` sync gate is honest about being a template runner (9-17) — the model for B-18.
  The shape check `startsWith("const JOBS = [")` + `includes("function test_no_skip")` is weak
  (a template-shaped hostile source still executes, A13), but today only engine-authored modules flow
  here.
- `healSource` (29-34) is exactly one bounded repair — no blind retry — good; but its trigger is
  error-text matching (`error.includes("test_happy")`) which is brittle if a future producer's error
  message coincidentally contains "test_happy".
- `buildPhase6Module` (49-85): all dynamic inputs JSON-escaped — but the module text is then run
  through FORBIDDEN *including* those literals (A02). The `REJECTION && phase === 9` throw
  (62) only fires for P9 jobs — a leftover semantic from deploy-steering that never fires in current
  tests; dead branch inside the template.
- `runSandboxed` (168-240): id-guarded reply matching, settle-once, terminate-on-settle, blob
  revoke-on-settle — protocol quality is high. Missing: onerror (A14), no caller (A06), default
  timeout not derived from project config (A29). Fake-worker tests exercise the full protocol, which
  is the right call under node:test.

### 3.5 `store.ts` (400 ln)

- `recordGate` (58-99) itself is well-formed (log + artifact swap + verdict); its call sites are the
  problem (A01).
- `canAutopilot` (101-107) — see A04. Note it reads `project.schedule?.tightness ?? 10` — a project
  without schedule (pre-prime) is never autopilot-approved; conservative, fine.
- `advanceOnce`/`runReady` (109-179): the auto-advance + stampPacket ordering (160-170) is right
  (packet describes the NEW edge — B-06 pinned by store.test:309). `runReady`'s double-approve shape
  (171-174 canAutopilot after possible advance) is safe because advance only happens when status is
  not awaiting.
- `runUntilHitl` (212-264): the maxRuns bound (221) `(13 - currentPhase) * 2 + 2` is exactly the
  worst case (run→park + approve per phase, +2 margin) — good; the ok/ran/stoppedReason contract
  (257-263) is the honest B-13 shape, pinned by five tests.
- `approve` (265-299): guards are good except the force-control gap (A02) and the recordGate phase
  bug (A01). `reject` (300-310) lacks approve's phase/state guards (A11). Note-length guard 12 chars
  lives only in store (301) — engine `rejectHitl` accepts any note, so future callers bypass the rule
  (P4: move the guard into rejectHitl or document).
- `clone` (324-352): structuredClone + fresh id/name/createdAt + cloned log — good; it duplicates
  decision ids and gate hashes (same `gate-p{phase}-{hash}` artifact ids in two projects) — harmless
  because React keys are per-list, but id-uniqueness is now cross-project false (P4).
- `seedIfEmpty` (373-385) hydrates-but-doesn't-reprime existing projects when the store is non-empty
  — the seed brief ("Northwind Dispatch") only applies on true emptiness; fine.
- persist `partialize` (389-393) correctly excludes functions; `onRehydrateStorage` ordering
  (394-397) works, but nothing forces hydration on RunScreen (A08).

### 3.6 `dod.ts` (278 ln) / `gate-stats.ts` (66 ln) / `phases.ts` (131 ln)

- DoD probe registry: content-only probes, deterministic, throw-defensive (190-200) — exemplary.
  Registry coverage 0..12 pinned by parametrized test. `runGate` evidence is sorted-pair FNV — correct
  canonicalization (array `.sort()` on pairs, dod.ts:214-218 — not a character sort, verified).
- `readyFor` (225-251): clean DoR (prior sealed / not complete / not blocked) — note it does *not*
  consult DoD, which is the right separation. `runGate` on unregistered phases (A22).
- `gateArtifact` id embeds the hash prefix — deterministic; two consecutive identical verdicts on the
  same phase would collide as artifact ids, but recordGate filters the previous gate artifact first
  (store.ts:95) — safe.
- gate-stats: clean math on synthetic rows; production data can never satisfy it (A03) and no UI
  consumes it (grep: zero callers). As shipped it is a well-tested module with no job.
- phases.ts: `canEnter` strict +1 — right. `priorsSealed` index assumption (A20). `HITL_PHASES` dead
  export (A25). PHASE_BY_ID/phaseDef throw loudly — good.

### 3.7 `console.tsx` (1200 ln)

- Structure: PhaseRail + live pane + Notes/Memory/Gate-log/Diagnostics aside + read-only
  PhaseRecordView archive + HitlDock evidence — coherent IA, all state flows through the store.
- Good UX details already listed in §5. Gaps: force-override (A02), hydration flash (A08),
  double-execute (A23), duplicate rejection rows (A18), notes persistence (A19), illustrative label
  (A07), memory overflow indicator (A09), sandbox-chip ambiguity (chip shows "sync-template · 30s"
  — the 30s is never enforced in sync mode; see A13/A29).
- `evidenceForGate` (67-117) falls back to `project.crew[0]` when no reviewer seat is active and then
  labels the row "Reviewer · implementer: …" (108-114) — mislabeled on P0/P1/P2/P3/P6/P7/P8/P10/P11
  (only 4/5/9/12 have reviewers; P6 has implementer+tester) — P3 wording defect on the evidence
  bundle.
- ArtifactPane always auto-selects the newest artifact (311); after an archive/phase change the
  selected id is reset via `visibleArtifacts` fallback — consistent.
- ScorecardBlock renders only when scorecard exists; phase-0 scorecard is also shown inside
  PhaseRecordView(0) — duplicated block instances are fine.
- `agoLabel` (120-126): no day granularity — a 3-day-old decision reads "72h0m" — cosmetic.
- Header sandbox chip (423-427) shows ramMb only when non-null; runtime worker legacy would show
  "worker · 30s" while sync-executing (A06).

### 3.8 `types.ts` / `templates.ts` / `testing/fixtures.ts`

- types.ts is disciplined; `_v` documented (224-225); `HitlRequest` lacks `requestedAt` (A03);
  `Competitor.source` read-never (A07); `PATCH` dead (A26). `JsonLog.level` is a 3-union, good.
- templates.ts: four briefs, all ≥12 chars, vocab-rich per domain — good demo seeds. Note the
  "dispatch" template omits "same-day SLA" vs the store's Northwind seed — trivial.
- fixtures.ts: `runHeadless` sorts requested phases ascending — a caller asking `[4,2]` gets 2 then 4
  even if the project state made 4 first illegal — fixture-level abstraction, fine; both helpers sign
  "human" which is correct per B-03 and documented.

---

## 4. Data-honesty sweep (residual simulated-as-real risks)

- **Competitors (A07)** — the only true residual: real product names with invented "gap" claims shown
  unlabeled. Everything else checks out:
- P6 "tests.pass" is real execution of real module code (even if trivial), and failure paths log
  `tests.fail` with the actual error — no fake green.
- Scorecard/libraries are deterministic template math, but the console never claims they came from
  live research; P7's artifact *title* ("Competitive analysis matrix") is the closest thing to an
  overclaim — fix with A07.
- `sandboxClaim` and packet Execution lines are honest for every runtime the code can actually
  produce today (A06 is about the *persisted legacy* case).
- `lastTest` staleness (A10) is a freshness lie at P9-12, not a fabrication.
- Gate verdicts: absent for HITL phases (A01) — the audit trail is *thinner* than advertised, which
  is the opposite failure mode from faking, but still a claim-vs-code mismatch ("T8 … recorded at
  phase completion" in types.ts:111-112 vs what actually happens).

---

## 5. Great things to keep (no changes needed)

1. **Honest runtime labels (B-18)** — sandboxClaim text, the sync-template shape gate (sandbox.ts:15),
   "sync-template · 30s" chip, P4 artifact's "Implementation today:" sentence (engine.ts:401). This is
   the model for honesty the rest of the app should follow.
2. **Loud repairs (B-25)** — repairPhases reports dropped/inserted ids in a `hydrate.repaired` log
   (engine.ts:1069-1081) instead of silently rewriting.
3. **Packet honesty mechanics** — explicit TRUNCATED marker (packet.ts:175-178), ledger rows quoting
   reject notes (packet.ts:33-37), version stamp v2, loop-count section (packet.ts:131-136).
4. **Bounded, visible stop semantics** — RunStopReason + ran counter + "ok requires progress"
   (store.ts:253-263); B-24 loop bound derived from the graph with a visible `cap` reason.
5. **B-03 exclusions exist** (store.ts:101-107) — the shape is right even where A04 shows a coverage
   gap (reframe gate).
6. **Deterministic DoD probes** — content-only, throw-defensive probes (dod.ts:190-200), stable FNV
   evidence, clean runGate/readyFor separation.
7. **R7 stemmer + word-boundary matching** — real correctness work (algorithms.ts:133-142,715-736)
   with tests; no substring false hits.
8. **Bounded template builder** — only JSON-escaped literals + fixed test fns (sandbox.ts:49-85);
   healSource repairs exactly one known gap, never blind-retries (B-07).
9. **Evidence bundle before gates** (console.tsx:67-117) and the read-only phase archive with gate
   trail — real E-101/E-102 substance.
10. **Deterministic fixtures** — runHeadless/runToGate with explicit human signing (fixtures.ts:51-104),
    no sleeps, bounded loops. Test-infra quality is high.
11. **Edge-case UX care** — Escape cancels rename, selection reset on filter, clipboard failure
    surfaced, blob-URL revocation, stale-worker id guard (sandbox.ts:231).

---

## 6. Test coverage gaps (what the suites miss — 145 green is not enough here)

1. **No assertion anywhere that `PhaseRecord.gate` is populated** after store-level human approval,
   autopilot approval, or a failing-P6 force-approval (A01/A04 shipped green).
2. **No integration test of gate-stats over real store decisions** — approvalHealth is only tested
   with synthetic rows (gate-stats.test.ts:21 explicitly manufactures `requestedAt === decidedAt`);
   the production untimed-row collapse (A03) is untested and unwired.
3. **No console/UI tests at all** — console.tsx (1200 ln: Radix tabs, archive dialog, evidence
   bundle, phase archive, gate log) has zero component tests; the A02 dead-end and A08 hydration
   flash are UI-contract bugs no suite can catch.
4. **Sandbox**: FORBIDDEN only tested for intended primitives — no string-literal false-positive
   test (A02), none for `fetch`/`self.fetch` in template-shaped source (A13), none asserting
   runSandboxed is invoked by engine/store (A06), none for worker onerror/dead-worker timing (A14).
   Protocol tests use a fake worker only (sandbox.test.ts:13-16).
5. **P6 rejection steering**: no test that the module embeds only the *current phase's* note (A05),
   or that reject→retry→re-run doesn't leak earlier notes into later phases.
6. **State-machine edges untested**: double-execute within one tick (A23); reject with stale `hitl`
   (A11); runGate/readyFor on unregistered phases (A22); priorsSealed on non-contiguous arrays (A20).
7. **Persistence robustness**: no hydrate tests for garbage status strings (A16), unknown memory
   kinds (A15), missing phases with non-empty currentPhase, or oversized legacy payloads.
8. **Eviction semantics (A09/A17)** untested — nothing verifies what is dropped when, or that
   rejection memories survive the 80-row cap.
9. **DoD semantics**: no pin that a force-approved failing P6 yields a visible FAIL gate verdict
   (advisory-by-design but should be pinned), and no test that HITL phases' verdicts exist at all
   (gap 1).
10. **Packet**: no test for lastTest staleness at P9-12 (A10), none for artifact-excerpt
    self-inclusion on refresh (A21), none pinning body determinism across identical stamps.

**Suggested new tests (highest value first):**
`store.test`: "approve at P5 records PhaseRecord.gate with passed=true" (fails today — A01);
"autopilot approve of an extra gate records a gate verdict" (A04); "reject with a mismatched hitl.phase
is refused" (A11); "approve twice in the same tick advances exactly one phase" (A23).
`sandbox.test`: "rejection note containing 'process' does not fail the module" (A02 — fails today);
"string literals are not scanned by FORBIDDEN"; "runSandboxed settles fast on worker onerror" (A14).
`engine.test`: "P6 module embeds current-phase rejection note only" (A05 — fails today);
"memory cap eviction logs an entry" (A09); "hydrate with garbage phase status repairs loudly" (A16).
`packet.test`: "P9 packet labels the sandbox row as P6" (A10); "refreshPacket does not embed the
previous packet in Artifacts" (A21).
`gates.test`: "runGate(13) fails, not vacuous-pass" (A22).
`gate-stats.test`: "untimed production rows never produce a rubber flag without real timing" (A03).
A small `console.test.tsx` (happy-dom + store install): "approve button disabled for failing P6 until
override checked" (A02) and "RunScreen does not flash missing before hydration" (A08).

---

## 7. Top 10 things I would fix first

1. **A01 — recordGate phase bug.** One-line capture of the pre-approval phase restores T8 for every
   HITL phase; add a store-level test asserting `PhaseRecord.gate` after each approval path (human,
   autopilot, force).
2. **A02 — P6 dead-end.** Stop regex-matching engine-injected string literals (or route P6 through
   runSandboxed, which has no regex), and add the promised force-approve checkbox to HitlDock so a
   genuinely failing sandbox is human-overridable per the R3 contract.
3. **A04 — autopilot vs reframe.** Mark the P0 reframe gate `forceHuman` so the machine can never
   self-accept its own reframe; route autopilot approvals through the same recordGate path as humans.
4. **A03 — real gate timing.** Add `requestedAt` to `HitlRequest` at gate-open (one field, set where
   the hitl is created), then either wire approvalHealth into the Gate log UI or delete the module —
   a detector nobody sees and nobody can satisfy is worse than none.
5. **A07 — competitor honesty.** Render `source:"illustrative"` (one footnote component) in the
   scorecard table and the P7 artifact body; the field already exists and is never read.
6. **A06 — make the worker real or the claim small.** Wire runSandboxed as the executor whenever
   `runtime === "worker"` (passing `timeoutS`); otherwise stop preserving/claiming "worker" on
   hydrate. As shipped the most impressive sandbox feature is unreachable from the app.
7. **A08 — hydration gate on RunScreen.** One `if (!hydrated)` branch kills the "This build doesn't
   exist" flash on every deep link.
8. **A05 — scope the P6 rejection-note lookup to the current phase.** One earlier rejection must not
   silently rewrite the P6 module's contract and variant.
9. **A09/A17 — make eviction visible.** Log memory/decision caps when they drop rows; show "of N"
   counts in the memory pane; pin eviction behavior in tests.
10. **A13 + A14 — sandbox hardening.** Ban bare `fetch`/`self.*` in the sync gate and wire worker
    `onerror` to a fast, honest failure instead of a 30 s "killed" lie.

---

## 8. Appendix — verification log

- `wc -l` on all scoped files (listed in header) — matches brief's ~1085/~786/~1200 estimates.
- Core suites re-run 2026-09-05: 145/145 pass in ~4 s. Per-file: algorithms 41, sandbox 19, packet 21,
  store 22, gates 33, gate-stats 9. Brief's "190/190" not reproduced as stated (145 core + 45
  app-data/auth tests measured; counting differs by granularity — gates.test reports 33 because its
  phase-coverage loop contributes 13 subtests).
- `scripts/*.test.mjs` on this Windows host: 195 reported, 10 fail — all in grok-pwa-og / symlink /
  preview chrome (platform tests, not RapidTool code); excluded from findings.
- Greps performed: `force` in console.tsx (only forceMount — A02); `approvalHealth` callers (tests
  only — A03); `.source` readers (none — A07); `runSandboxed` callers (test only — A06);
  `recordGate` sites (store.ts:156,294 — A01); `\.gate` in all test files (zero — A01 test gap);
  `HITL_PHASES`, `PATCH`, `lib/ai` importers (none — dead code A25/A26; src/lib/ai.ts is orphaned,
  not in the scoped list but flagged for the next cleanup pass).
- Empirical repro for A02 (node --experimental-strip-types): rejection note with "process" →
  `{ok:false, detail:"Forbidden primitive in generated module."}`; capitalized "Process" name → pass
  (explains why the suite never caught it).

## 9. One-line summary

The mission-1 core is genuinely solid — deterministic algorithms with real tests, honest labels,
loud repairs, bounded loops — but the two headline governance features have silent holes: **T8 DoD
verdicts are never recorded for HITL-approved phases (A01)** and **a failing P6 sandbox has no
working human override while the store's own error message demands one (A02)**. Both are small,
surgical fixes with clear test pins; the remaining P2s are honesty/robustness gaps (competitor
labeling, gate timing, trace bookkeeping, hydration flash) rather than architectural problems.
