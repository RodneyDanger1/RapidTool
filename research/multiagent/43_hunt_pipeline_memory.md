# 43 — Bug Hunt: Pipeline + Memory + Context/Token Deep Pass (H5)

**Scope:** pipeline state machine (`store.ts`, `engine.ts`, `phases.ts`, `packet.ts`), persistence (`store.ts` persist middleware, `io.ts`, `knowledge.ts`, `vault.ts`), brain-memory lifecycle (engine/report-intake memory rows, FusionRank inputs), context/token handling (crew.server, chat, verify, harvest, prompt-engine, wild-mode), second pass on chat/wild/delegation after dossiers 38/39/40.
**Method:** read-only deep read + execution probes via `node --experimental-strip-types` against real modules. Probe files created in repo root and deleted after each run. Line numbers refer to the current tree at hunt time.
**Date:** 2026-09-06.

## Finding ID scheme
H43-xx · Severity P0/P1/P2/P3. Every finding verified by reading or probe; [by-reading] marks pure control-flow facts.

---

## P1

### H43-P1-1 — `startWildRun` is not serialized per project and commits whole-project state per step: any concurrent async action (executeAsync / runUntilHitlAsync / runModuleReal / rejectAsync) or sync operator edit mid-run is silently rolled back

- **Files:** `src/lib/store.ts:528-605` (`startWildRun`) vs `:120-134` (`serialized`) vs `:142-150` (`rebaseUserFields`).
- **Bug:** Every other async store action is chained through `serialized(id, ...)` and its commit applies `rebaseUserFields(next.project, live)` (protects `name`/`notes`/`createdAt` operator edits and never resurrects a deleted project). `startWildRun` does neither: it snapshots the project once (`:529`), then loops `wildStep(cur)` and for every step `set()`s a whole-project object derived from that *stale* local `cur` (`:576-579`). Wall-clock interleavings:
  1. A `serialized` action queued *before* the wild run's next step commits (executeAsync, runUntilHitlAsync, rejectAsync guidance, runModuleReal) commits fresh progress; the wild step's next `set()` then overwrites it with a project that never saw that commit → the async action's phase/artifact/log/gate changes silently vanish (the queue on `asyncChains` is per-action-call, so it does not re-read the store between its own queued steps — each wild step is a *separate* `set` outside the chain).
  2. The same in reverse: a wild step commit can be clobbered by a queued action whose snapshot predates the step.
  3. Sync operator edits during a long wild step (`rename`, `setNotes` — the exact case `rebaseUserFields` exists for) are reverted by the next wild-step commit because the commit is `cur` (pre-edit), not a rebase onto `live`.
  4. Sync `remove(id)` mid-run is respected only by *other* actions (`if (!live) return s`); the wild loop's `set` re-inserts the deleted project (`projects.map` over the current list with `cur` → resurrect). Comment at `:796` claims "deleted mid-run — never resurrect" for the other actions; the wild loop has no such guard.
- **Severity rationale:** the race is real whenever any headless/UI caller fires an async action on the same project while a wild run is stepping (each step is an LLM round-trip of seconds). No UI-lock exists in the store layer (`executeAsync` etc. do not check `wildRun.active`; `startWildRun` checks only `wildRun?.active` against *itself*). Verified by reading the chain/commit code paths.
- **Repro:** (by-reading + trace) 1) `startWildRun(id)`; 2) while step 2 is in flight, call `rename(id, "new name")` then let the step commit → project name reverts. 3) `startWildRun(id)` then `executeAsync(id)` overlapping → one of the two commits is lost (whole-project `set` from the older snapshot).
- **Fix spec:** (a) route the whole wild-run loop through the same per-id chain the other actions use: wrap the loop body in `serialized(id, async () => { step; commit with rebaseUserFields + no-resurrect guard })` — or simpler, (b) make each per-step commit read `live` inside the updater and merge `rebaseUserFields(cur, live)` + skip when `!live`, and gate every async/sync runner action on `!p.wildRun?.active` with an honest error. Also `:596-604` catch returns `ran: 0` even when steps already ran (misreport).

---

## P2

### H43-P2-1 — Regenerating a rejected phase duplicates its template memory rows (same text, same score) instead of replacing them — dedupe renames but never removes; the 80-row FIFO then evicts distinct rows and FusionRank top-5 fills with duplicates

- **Files:** `src/lib/engine.ts:262-277` (`mem()` deterministic id `${phase}-${kind}-${score}`), `:183-205` (`dedupeMemoryIds` — suffix-renames duplicates, never drops), `:849` (`applyPhaseResult` merge `[...result.memory, ...primed.memory].slice(0,80)` — no same-phase filter, no text/semantic dedupe), `:983` (approveHitl same pattern), `:1037-1048` (rejectHitl).
- **Bug:** reject P0 → retry → re-synthesize produces the *same* row ids (`0-episodic-0.91`, `0-semantic-0.97`, …). `dedupeMemoryIds` keeps the old copy under a new id (`…-2`) instead of dropping it; the next regeneration makes `…-3`, etc. Each rejection/retry cycle therefore permanently adds 2–4 byte-identical rows. Memory is a strict 80-row FIFO (`slice(0,80)`, newest-first), so duplicates *displace distinct older rows* even when those carry higher value, and `fusionRank` (packet `## Ranked memory`, top-5) shows the same text twice. A project that regenerates P6 a few times can lose its P0–P3 semantic rows to P6 duplicates.
- **Repro (probe):** real modules: emptyProject → run P0 (rows 2) → reject P0 → unlockRetry → run P0 again → project.memory contains 4 rows where 2 are byte-identical text pairs (`0-episodic-0.91` + `0-episodic-0.91-2`); 3rd run → 6 rows. Packet's ranked-memory list then prints the duplicate twice.
- **Fix spec:** in the merge sites, filter `primed.memory` rows whose id-base (`phase-kind-score`) collides with any `result.memory` row *before* dedupe (replacement semantics, like the artifact filter at `:846`), then `dedupeMemoryIds`. Add a regression test: N regenerations of one phase never grow memory by template rows and never produce duplicate text in the packet top-5.

### H43-P2-2 — Rejection notes are unbounded at intake and flow verbatim into a score-1 memory row, the packet's ranked-memory, decision ledger, and rejection-history — a paste-length note permanently inflates every prompt built from the project

- **Files:** `src/lib/store.ts:994-996` (`reject` — only a 12-char *minimum*), `src/lib/engine.ts:1037-1048` (`rejectHitl`: memory row text `` `HITL rejected P${phase}: ${note}` `` — full note, no cap; score 1.0), `:1005-1009` (rejectionHistory/rejectionNote raw), `src/lib/packet.ts:268` (ranked memory printed verbatim), `:144-148` (ledger rows quote-capped at 200 but only in the *packet*).
- **Bug:** any ≥12-char note is accepted; nothing caps its length. The note lands (a) as a memory row with `score: 1` — fusionRank's top-5 memory slot is *guaranteed* (score 1.0 sorts first), so every later packet and every crew/chat context built from ranked memory embeds the full note text; (b) raw on the phase record; (c) in the decision ledger. A 10 KB paste → a >10 KB memory row that survives (score 1, inserted at FIFO head) until 80 newer rows exist, i.e. effectively forever on a normal project. It also permanently occupies one of the 5 packet memory slots.
- **Repro (probe):** reject with a 5,000-char note → memory row text length ≈ 5,028; packet (stampPacket) contains the whole note in `## Ranked memory`.
- **Fix spec:** cap the note at intake (`reject`/`rejectHitl`, e.g. 2,000 chars with an honest truncation marker) or at row-write (memory text slice, matching `slice(0,240)` used by report-intake `:332`), and keep the full note only in the ledger/log. Document the cap in the UI counter.

### H43-P2-3 — Project artifacts are uncapped in count AND per-body size on every append path; agent reports and real module runs can grow localStorage past quota with a handful of actions — and persist writes are unguarded

- **Files:** append sites without any cap: `store.ts:835-846` (runModuleReal: body = whole stdout+stderr of the real run), `store.ts:1034-1041` (rejectAsync guidance artifact), `report-intake.ts:351` (`artifacts: [...project.artifacts, ...artifacts]` — unbounded count *and* unbounded `a.body` (validator `:106-108` enforces type only)), `engine.ts:845-848` (per-phase replace only — safe), packet window `packet.ts:128-135` caps *display* to last 8 × 900 chars, not storage. Persist side: `store.ts:1160-1184` — zustand `persist` writes the entire projects array (all artifacts/logs/packet strings) to localStorage on *every* `set()`, with no `version`/`migrate`, no quota handling; a `QuotaExceededError` is only console-warned by zustand, state continues in memory and the user believes the work is saved — next reload silently reverts to the last successful write.
- **Bug:** a delegation/wild loop that ingests N agent reports (each with several multi-KB artifacts — the two-way packet path is the *primary* documented use) appends N×K artifacts forever; each `runModuleReal` click appends a full-run transcript artifact. There is no total-size or count cap anywhere in the write paths or hydrate (hydrateProject only shape-filters rows `engine.ts:1384-1388`). Together with unbounded per-entry sizes, a few hundred KB of reports (or one 5 MB report artifact) blows the ~5 MB localStorage ceiling.
- **Repro (probe):** apply 30 synthetic reports of 5 artifacts × 4 KB each to one project → artifacts array grows 150 entries/~600 KB; export JSON and persisted payload grow linearly; simulate quota by patching localStorage.setItem to throw → zustand warns; `useRapid.getState()` still shows the new state while reload restores the old.
- **Fix spec:** (a) cap `report.artifacts` count (e.g. 12) and per-body size (e.g. 50 KB) in `validateReport` with an explicit rejection; (b) add a project-level artifact byte/count cap in the append paths (or evict oldest non-gate, non-packet artifacts once a byte budget is exceeded, loudly via a log); (c) install a `storage` wrapper in persist that detects quota failure and records a `persist.quota_error` log/flag instead of failing silently.

### H43-P2-4 — `startWildRun` error path leaves `wildRun.active: true` persisted (or commits an inconsistent half-run) when `wildStep` throws mid-loop, and the cap/pause returns report `ran: 0` despite executed steps

- **File:** `src/lib/store.ts:570-604`.
- **Bug:** the loop commits every step to the store; if `wildStep` (an LLM call — network errors are plausible) throws after step k, control jumps to `catch` (`:596`) which returns `{ok:false, ran:0, error}` **without** stopping the run (`wildRun.active` stays true, `pause` false). The caller sees a failed start while the store claims a live run; the next `startWildRun` refuses with "already active" (`:546-553`) and only a manual `stopWildRun` unblocks. Also the catch reports `ran:0` even when k steps already committed.
- **Repro (probe):** stub `wildStep` to advance once then throw (module-level rewire via the dynamic import in a temp probe) → store state has the step's commit and `wildRun.active===true`; result says `ok:false ran:0`.
- **Fix spec:** in `catch`, first `wildPause`/`stopWildRun`-style park (set `active:false`, `stoppedAt`, append a `wild.error` log with the message) then return the honest `ran` count; treat throws as a pause class so a subsequent `startWildRun` can resume.

### H43-P2-5 — Packet/memory/footprint of `## Research sources (live)` grows without bound across research re-runs (per-entry × up to 5 items, no entry cap in packet view)

- **Files:** `src/lib/packet.ts:136-139` (`researchSources` renders **every** `project.research` entry's first 5 items), corpus writer in `engine.ts` `liveLayer` (see H38-R3: re-runs append entries; dedupe exists only in deepenResearch). Checked: no `.slice` on the entry list at the packet site, so an N-run project prints ≤5N source lines into the packet (and into any crew/chat context embedding the packet), while `researchHash` (`:22-31`) scans the full corpus each compile — per-call O(corpus) rescan on every stamp (each phase run stamps ≥3 times: applyPhaseResult, approveHitl, recordGate paths).
- **Severity:** context bloat + per-stamp rescan. Reproducible by 10 research-phase re-runs → 50 source lines in every later packet.
- **Fix spec:** render `(project.research ?? []).slice(-5)` entries; compute `researchHash` incrementally or accept the cost (note only); align with H38-R3's dedupe fix.

---

## P3

### H43-P3-1 — Autopilot approvals (advanceOnce:275 and finishPhase:380-388) stamp the packet *before* recordGate appends the gate artifact + `gate.verdict` log; human approvals re-stamp after (store.ts:988) — autopilot paths persist a packet whose trimmed-artifact window omits the gate artifact until the next stamp
- **File:** `src/lib/store.ts:275`, `:379-388` vs `:988`. System JSON `gate_passed` is populated (recordGateInline inside approveHitl), so impact is limited to the `## Artifacts (trimmed)` window and artifact/log ordering in exported packets. Fix: re-stamp after the final recordGate on both autopilot branches (one line).

### H43-P3-2 — io.importProject rejects phase arrays whose length ≠ 13 even though hydrateProject (which runs on the imported payload) exists precisely to repair truncated/garbage phase arrays; a hand-trimmed export (e.g. one dropped record at end of file) that localStorage hydration would repair is refused on import
- **File:** `src/lib/io.ts:67-69` + `:84-86`. Deliberate per the docstring, but inconsistent with the documented "import gets exactly the same repair pass as persisted state" (header `:12-14`). Fix: validate `phases` is an array of *plain objects* and let repairPhases handle count/status, keeping a hard failure only for non-array.

### H43-P3-3 — report-intake memory rows (report-intake.ts:327-342) carry no `source` field while engine rows default to "engine" and HITL rows to "human" (engine.ts:262-277, 960-962, 1044-1046); E-18 provenance (types.ts:105) is documented as stamped per call site ("agent-report") but the call site omits it
- **File:** `src/lib/report-intake.ts:326-344` (E-18 comment at engine.ts:266-269 claims report-intake stamps its own source). Fix: `source: "agent-report"` on both row kinds; add to the hydrate filter whitelist if it ever becomes strict.

### H43-P3-4 — KnowledgeStore file-level write is atomic against crashes but not against concurrent writers: two processes (or two instances) interleaving savePattern lose one entry silently (both write the same `.tmp` path and rename over the target; no lock); per-call `new KnowledgeStore` in headless.ts:1477-1479/1484-1486 makes this the normal pattern across processes
- **File:** `src/lib/knowledge.ts:166-189`. Fix: lock file or compare-and-swap on rename; at minimum document single-writer requirement and surface a conflict error when the on-disk entry count changed between read and write.

### H43-P3-5 — hydrateProject never re-applies the 80-row memory cap / artifact/log caps to payloads that pass shape filtering; a persisted/imported payload with 400 well-formed memory rows keeps all 400 (engine.ts:1391-1397), so FusionRank and packet memory cost scale beyond any engine-writable state
- **File:** `src/lib/engine.ts:1384-1397` + `:1422-1464`. Fix: apply `.slice(0,80)` to hydrated memory and the 200-cap to logs to mirror engine write invariants.

---

## Verified clean (probed/hunted, no bug)

- Phase-transition guards (`canEnter`, `priorsSealed`, locked/rejected/awaiting_hitl handling) in sync and async mirrors are identical.
- `serialized()` chain itself is correct (rejection-safe tail, key cleanup).
- Corrupt persisted state on load: zustand `onRehydrateStorage` error path recovers and overwrites the corrupt blob (store.ts:1168-1183).
- runModuleReal convergence path re-stamps lastTest/gate from the real run (store.ts:831-853).
- `dedupeMemoryIds` suffix allocation is collision-safe (occupied-set walk).

<!-- APPEND BELOW -->
