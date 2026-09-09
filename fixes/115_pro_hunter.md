# 115 — PRO HUNTER H: hard bug classes (state corruption, races, P6 error paths, persistence, determinism, io)

- **File:** `fixes/115_pro_hunter.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`).
- **Role:** PRO HUNTER H (deep codebase hunter). **STRICT READ-ONLY** — no source file was or will be edited by this lane. The ONLY artifact is this file (plus throwaway probes under `C:/Users/mnril/AppData/Local/Temp/rt-hunter/`, never in the repo).
- **Date:** 2026-09-06. Mission: hunt the HARD bug classes the earlier audits (fixes/110-114, research/93) missed — cross-module state corruption, races, P6 error paths, persistence edge cases, memory/evidence, determinism, io round-trips.
- **Protocol for Flash executors:** every `## H-XX` block is a COMPLETE self-contained spec (file, exact anchor, bug, fix, regression test, priority, tag). Re-grep anchors at patch time (line drift is expected).
- **Verification marks:** `[V]` verified on disk · `[L]` live-run this pass (real node execution, output quoted) · `[R]` reasoned from verified anchors. 0 false positives: items that are NOT bugs are listed in §N, not as findings.

---

## §0 — Findings at a glance

| # | Bug class | Priority | Tag | Probe |
|---|---|---|---|---|
| H-01 | `rebaseUserFields` whitelist drops `chatLog` (user chat silently rolled back by any async run commit) | P1 | functionality | [L] probe-store.ts |
| H-02 | `dedupeMemoryIds` suffix collision mints duplicate memory ids | P2 | functionality | [L] probe-dedupe.ts |
| H-03 | `hydrateProject`/`importProject` never normalize `research` → corrupt/hostile value throws in the repair pass (whole-store wipe on reload) + confusing import error | P1 | functionality | [L] probe-debug.ts, probe-io.ts |
| H-04 | `liveLayer` appends research corpus entries with NO dedup → unbounded growth + `research_hash` churns on duplicate | P2 | functionality | [L] probe-research.ts |
| H-05 | `compileAgentPacket` bakes `new Date().toISOString()` into `compiled_at` → packet is not idempotent | P2 | functionality | [L] probe-det.ts |
| H-06 | Wild driver `commitWild` rolls back concurrent `ingestReport` (race) | P1 | functionality | [L] probe-race.ts |

All six reproduced with live node probes (quoted output below each). H-01 and H-06 share the root cause (the `rebaseUserFields` whitelist) but are separate manifestations with separate fixes.

---

## H-01 — `rebaseUserFields` drops `chatLog`: user chat silently rolled back by any async run commit

**Priority: P1 · Tag: functionality · Evidence: [V] store.ts:152-167 + [L] probe-store.ts**

**The bug.** `rebaseUserFields` (store.ts:152-167) is the rebase used by every async store action (`executeAsync` 1012, `runUntilHitlAsync` 1066, `runModuleReal` 1119, `deepenResearch` 719, `rejectAsync` 1314, and the wild driver's `commitWild` 828). It preserves exactly five fields from the live record:

```ts
return { ...committed, name: live.name, notes: live.notes, createdAt: live.createdAt,
         enforceDod: live.enforceDod, wildMode: live.wildMode };
```

The `Project` type has grown since that whitelist was written: `chatLog` (types.ts:343) is a **user-owned** field appended by the sync action `appendChatRows` (store.ts:1383-1393), exactly like `notes`/`name`. It is NOT in the whitelist, so when a user sends a chat message while *any* async run is in flight, the run's whole-project commit replaces `chatLog` with its own stale snapshot (the run never appends chat rows) and the message **vanishes**.

**Live proof** (`probe-store.ts`): fire `executeAsync` then append a chat row in the inter-await gap:
```
executeAsync result: {"ok":true}
chatLog after async run: []
CHAT ROW DROPPED BY ASYNC COMMIT: true
```

**Blast radius.** The same narrow whitelist also drops `implementationSpec`, `kind`, and `meta` if they were written by a concurrent path (e.g. the CLI `prompt` verb or a `deepenResearch` writing `meta.liveUnavailable`) — but the clear, always-reachable case is `chatLog`. (Engine-authored concurrent-mutation rollback is H-06, a different fix.)

**Patch spec — `src/lib/store.ts` `rebaseUserFields` (152-167):** add the user-owned chat thread to the whitelist:

```ts
return {
  ...committed,
  name: live.name,
  notes: live.notes,
  createdAt: live.createdAt,
  enforceDod: live.enforceDod,
  wildMode: live.wildMode,
  // H-01: chatLog is user-owned (appendChatRows is a sync action, exactly like
  // rename/setNotes) — the engine never appends chat rows, so live.chatLog is
  // always a superset of the run's snapshot and must win.
  chatLog: live.chatLog,
};
```

**Regression tests:**

| # | Test | Asserts |
|---|---|---|
| R1 | store.test: `create` → `const p = executeAsync(id)` → `queueMicrotask(() => appendChatRows(id,[row]))` → `await p` → `current(id).chatLog` still contains `row` | |
| R2 | store.test: `runUntilHitlAsync` same interleave → chatLog preserved through the multi-step commit | |
| R3 | store.test: chatLog still capped at 40 after rebase (append 50 rows mid-run → 40 kept) | |

**Gates:** `npm run typecheck`; `node --experimental-strip-types --test src/lib/store.test.ts` green + R1-R3.

---

## H-02 — `dedupeMemoryIds` mints duplicate memory ids (suffix collision)

**Priority: P2 · Tag: functionality · Evidence: [V] engine.ts:207-227 + [L] probe-dedupe.ts**

**The bug.** `dedupeMemoryIds` (engine.ts:207-227) renames the 2nd+ occurrence of a repeated id to `${id}-${suffix}`, bumping `suffix` only while `occupied.has(id)`. But `occupied` is computed once from the input (line 214) and **is never updated when a fresh suffixed id is minted**. So when the input contains a *prior-pass* suffixed id (`X-2`) and ≥3 occurrences of `X`, the 2nd occurrence mints `X-3` (not in `occupied`), and the 3rd occurrence later mints `X-3` again — collision.

**Live proof** (`probe-dedupe.ts`):
```
CASE X, X, X-2, X  (prior-pass suffix + 3 same-id)
  input:  [X, X, X-2, X]
  output: [X, X-3, X-2, X-3]     DUPLICATE: true
CASE X, X, X, X-2 (4 same-id + prior suffix)
  input:  [X, X, X, X-2]
  output: [X, X-3, X-3, X-2]     DUPLICATE: true
```

The comment at 209-213 claims to handle the "run 3" scenario but only covers the exact `X-2` suffix, not the transitive case. This is reachable by construction: the engine mints memory ids as `${phase}-${kind}-${score}` (engine.ts:295), so distinct rows sharing phase+kind+score legitimately collide, and repeated regeneration parks `X-2`/`X-3` rows (the exact B-12 scenario this function exists for).

**Impact.** Downstream, `fusionRank`'s duplicate-id guard (algorithms.ts:485-490) collapses same-id rows to the FIRST (highest-ranked) occurrence, and `compileAgentPacket` surfaces the displacement via `countIdCollisions` (packet.ts:52-61) — but the underlying list is now corrupt: a legitimately-distinct memory row is silently dropped from the ranked packet view, and `countIdCollisions` reports a false "displacement" for a list that dedupe just produced.

**Patch spec — `src/lib/engine.ts` `dedupeMemoryIds` (207-227):** add freshly-minted ids to `occupied`:

```ts
return rows.map((m) => {
  const n = (seen.get(m.id) ?? 0) + 1;
  seen.set(m.id, n);
  if (n === 1) return m;
  let suffix = n;
  let id = `${m.id}-${suffix}`;
  while (occupied.has(id) && suffix < 10_000) {
    suffix += 1;
    id = `${m.id}-${suffix}`;
  }
  occupied.add(id);   // H-02: register the minted id so later occurrences skip it
  return { ...m, id };
});
```

**Regression tests:**

| # | Test | Asserts |
|---|---|---|
| M1 | engine.test (or a dedupe unit): `dedupeMemoryIds(["X","X","X-2","X"])` → all four ids distinct, no `X-3` duplicate | |
| M2 | `dedupeMemoryIds(["X","X","X","X-2"])` → distinct ids | |
| M3 | idempotency: re-running dedupe on its own output is a no-op (still holds after the fix) | |

**Gates:** typecheck; engine/io/packet suites green + M1-M3.

---

## H-03 — `hydrateProject`/`importProject` never normalize `research`: a corrupt/hostile value throws in the repair pass (whole-store wipe on reload)

**Priority: P1 · Tag: functionality · Evidence: [V] engine.ts:1577-1620 (no `research` normalization) + [L] probe-debug.ts, probe-io.ts**

**The bug.** `hydrateProject` defensively normalizes nearly every collection field (artifacts 1536, logs 1537, decisions 1538, memory 1539-1545, competitors 1618, chatLog 1573, traces 1601-1603, oracle 1607, crew 1608) but **`research` (and `implementationSpec`) ride through the `...raw` spread unvalidated** (line 1578). A non-array `research` (number/string/plain-object) survives and then throws inside `compileAgentPacket`'s `researchSources`/`researchHash`:

**Live proof** (`probe-debug.ts`, direct hydrate):
```
hydrate research=5   -> THREW: (project.research ?? []).slice is not a function
hydrate research={}  -> THREW: (project.research ?? []).slice is not a function
hydrate research="str" -> THREW: (project.research ?? []).slice(...).flatMap is not a function
```

**Two consequences:**

1. **Persistence / data-loss:** the persist repair path `seedIfEmpty` maps `hydrateProject` over the stored projects with **no per-project try/catch** (store.ts:1434-1438), and `onRehydrateStorage` catches any throw → `recoverFromCorruptPersistence()` (store.ts:695-702) → `setState({ projects: [], … })` + demo re-seed (store.ts:670-673). So **one project entry whose `research` is not an array wipes the entire store on reload** — exactly the "a corrupt persisted row must never take down rehydration" guarantee the H4 layer (store.ts:521-703, `isRepairableProjectEntry` comment 563-567) was written to enforce, and `research` was added after that sweep.

2. **Import honesty:** `importProject` (io.ts:56-111) validates id/name/brief/phases/currentPhase/artifacts/logs but not `research`, so a hostile import returns a **misleading** failure:
```
import research=5 -> import FAILED: Import failed during hydration: (project.research ?? []).slice is not a function
```
instead of a clean shape-validation message (and, for a payload whose `packet`/`lattice`/`specGraph` are present so hydrate returns early, the corrupt value would land in the store and crash the NEXT `stampPacket`/`approve`/`execute` — which are NOT try/caught, e.g. store.ts:1256 `stampPacket(recorded)` inside `approve`).

**Patch spec — `src/lib/engine.ts` `hydrateProject` (filled object, ~1618):** normalize `research` like its siblings, and shape-guard `implementationSpec`:

```ts
// near the other per-field normalizations (competitors/chatLog/…):
const research = Array.isArray(raw.research)
  ? raw.research.filter((e) => e && typeof e === "object" && Array.isArray((e as {items?:unknown}).items))
  : [];
const implementationSpec =
  raw.implementationSpec && typeof raw.implementationSpec === "object"
    ? (raw.implementationSpec as Project["implementationSpec"])
    : null;
// include `research` and `implementationSpec` in the returned `filled` object,
// and add `raw.research !== undefined && !Array.isArray(raw.research)` to the
// `rowRepaired`/log-detection so the drop is LOUD (parity with chatLogRepaired).
```

Also add an explicit check in `io.ts importProject` (after the logs check, ~103) so imports fail fast with a clean message instead of a hydration exception:

```ts
if (p.research !== undefined && !Array.isArray(p.research)) {
  return { ok: false, error: "Project research must be an array." };
}
```

**Regression tests:**

| # | Test | Asserts |
|---|---|---|
| P1 | engine/io.test: `importProject(valid but research:5)` → `{ok:false, error:"Project research must be an array."}` (not a hydration throw) | |
| P2 | engine.test: `hydrateProject({...valid, research:{}})` → returns with `research: []` (or null), `compileAgentPacket` does NOT throw | |
| P3 | store.test: seed localStorage with 2 projects (one healthy, one `research:5`) → after rehydrate BOTH projects survive, healthy project intact, corrupt project has `research:[]` + a `hydrate.repaired` log (NO whole-store wipe) | |
| P4 | fuzz parity: `hydrateProject` handles `research` = number/string/object/`{0:"x"}` without throwing (mirror the existing chatLog/memory fuzz cases) | |

**Gates:** typecheck; io/engine/store suites green + P1-P4.

---

## H-04 — `liveLayer` appends research corpus entries with no dedup → unbounded growth + `research_hash` churn

**Priority: P2 · Tag: functionality · Evidence: [V] engine.ts:1891-1895 vs 1995-2016 + [L] probe-research.ts**

**The bug.** `liveLayer` (the normal research-phase path used by `runPhaseAsync`) appends the new corpus entry unconditionally:

```ts
// engine.ts:1891-1895
return stamp({ ...done, research: [...(done.research ?? []), corpusEntry], artifacts: [...done.artifacts, ...researchArtifacts] });
```

`deepenResearch` (engine.ts:1995-2016) dedups by `query + sorted URL set` — but `liveLayer` does not. On any research-phase regeneration (P0/P7/P11 rejected → retried), `fetchResearch` runs again and appends a **duplicate** corpus entry for the same query. Consequences, both proven:

1. **Unbounded growth:** `project.research` is never capped (memory is capped 80, logs 200 — research has no cap), so repeated rejections grow the persisted blob and push toward the localStorage quota that `salvageTrim` (store.ts:577-590) cannot reclaim (it only trims `logs`/`chatLog`).
2. **`research_hash` is not idempotent:** `researchHash` (packet.ts:31-39) hashes the flat, **duplicate-preserving** URL list (`urls.sort().join`), so appending an entry whose URL set already exists changes the fingerprint even though the corpus did not actually change.

**Live proof** (`probe-research.ts`):
```
single-entry    research_hash: 2753627861
duplicate-entry research_hash: 767367997
research_hash CHANGES when a duplicate corpus entry is appended: true
```

**Patch spec — `src/lib/engine.ts` `liveLayer` (1891-1895):** mirror `deepenResearch`'s dedup before appending:

```ts
const urlsOf = (items: {url:string}[]): string =>
  [...new Set(items.map((it) => it.url))].sort().join("\n");
const already = (done.research ?? []).some(
  (e) => e.query === researchQueryFor(project, phase) && urlsOf(e.items ?? []) === urlsOf(real.items),
);
return stamp(already
  ? { ...done, artifacts: [...done.artifacts, ...researchArtifacts] }   // corpus unchanged
  : { ...done, research: [...(done.research ?? []), corpusEntry], artifacts: [...done.artifacts, ...researchArtifacts] });
```

Optionally also make `researchHash` (packet.ts:31-39) dedupe the URL set (`[...new Set(urls)]`) so a stray duplicate can never churn the fingerprint — one line, low-risk.

**Regression tests:**

| # | Test | Asserts |
|---|---|---|
| G1 | engine test with injected `fetcher`: run a research phase twice (simulate reject→retry) via the live layer → `project.research` has ONE entry for the query (not two) | |
| G2 | `compileAgentPacket` on a project with a duplicate corpus entry (hand-built) → `research_hash` equals the single-entry hash after the packet-side dedupe | |

**Gates:** typecheck; engine/packet suites green + G1/G2.

---

## H-05 — `compileAgentPacket` bakes `new Date().toISOString()` into the packet → non-idempotent output

**Priority: P2 · Tag: functionality · Evidence: [V] packet.ts:235 (`compiledAt`) + packet.ts:98/259 (both render it) + [L] probe-det.ts**

**The bug.** `compileAgentPacket` computes `const compiledAt = new Date().toISOString()` (packet.ts:235) and stamps it into BOTH the prose (`compiled_at: ${compiledAt}`, line 259) and the System JSON envelope (`compiled_at: compiledAt`, line 98). So two compiles of the *same, unchanged* project differ:

**Live proof** (`probe-det.ts`):
```
compileAgentPacket twice on SAME object — byte-identical: false
stampPacket twice on SAME object — packet byte-identical: false
  first diff at line 4:
    run1: compiled_at: 2026-09-07T04:55:01.639Z
    run2: compiled_at: 2026-09-07T04:55:01.641Z
```

**Impact.** `stampPacket`/`refreshPacket` (documented "B-06/B-19 … delegate to the engine stamp") is not idempotent: every refresh/approve/execute re-writes the packet artifact body (and therefore the persisted project + `exportProjectJson` output) with a new timestamp. An agent diffing two exports of an unchanged build sees a spurious `compiled_at` + packet-body change; the "same brief → same packet" determinism the engine elsewhere promises (e.g. dedupeMemoryIds idempotency) is broken at the packet boundary. (Note: this does NOT affect the DoD `evidenceHash` — runGate hashes only `id:pass|fail` probe pairs, dod.ts:321-327 — so gate drift detection is safe.)

**Patch spec — `src/lib/packet.ts`:** make `compiled_at` deterministic, e.g. derive it from the project's own stable identity instead of wall-clock:

```ts
// packet.ts:235 (replace)
const compiledAt = new Date(project.createdAt).toISOString();
```
or stamp the latest decision/log timestamp so it still reflects project freshness but is stable for an unchanged graph. If a wall-clock "compiled at" is genuinely desired, keep it in a field that does NOT feed the artifact body / is explicitly excluded from export diffs — but the simplest correct fix is the deterministic derivation above (update `packet.test.ts`'s compiled_at expectations accordingly).

**Regression tests:**

| # | Test | Asserts |
|---|---|---|
| D1 | packet.test: `compileAgentPacket(p)` twice on the same project → byte-identical strings | |
| D2 | `stampPacket(p)` twice → identical `p.packet` (no `compiled_at` drift) | |

**Gates:** typecheck; packet.test green + D1/D2.

---

## H-06 — Wild driver `commitWild` rolls back a concurrent `ingestReport` (race)

**Priority: P1 · Tag: functionality · Evidence: [V] store.ts:824-830 + [L] probe-race.ts**

**The bug.** `ingestReport` (store.ts:1133-1174) is careful — it validates on a snapshot and applies inside the updater on the **live** record. But it is a *sync* action, while `startWildRun` (store.ts:745-873) is an *async* loop that is **not** in the `serialized` chain. Each wild step reads `cur`, awaits `wildStep(cur)`, then `commitWild(cur)` writes `rebaseUserFields(cur, live)` (store.ts:824-830). `rebaseUserFields` preserves only the five whitelisted user fields (H-01); engine-owned fields — `artifacts`, `logs`, `memory`, `decisions`, `hitl`, `research` — come from the step's stale snapshot `cur`. So an `ingestReport` that lands while the driver is suspended at `await wildStep` is **silently rolled back by the next `commitWild`**.

**Live proof** (`probe-race.ts`): fire `startWildRun` then synchronously `ingestReport` (which reports `applied:true`):
```
ingestReport result: {"ok":true,"applied":true,"reason":"new","gate_unmet":["p0-scorecard","p0-verdict"]}
wild run result: {"ok":true,"ran":5,"stoppedReason":"paused","code":"RT_E_LLM_NOT_CONFIGURED"}
external ingest artifact survived the wild commit: false
ingest log survived: false
```

The caller was told the report applied; the very next wild step destroyed it. The same clobber hits a concurrent `approve`/`reject`/`deepenResearch`/`runModuleReal` if it lands during an active wild run.

**Patch spec — `src/lib/store.ts` `commitWild` (824-830):** merge concurrent engine-owned additions instead of wholesale-replacing. The loop already holds `cur` (the step INPUT) before `wildStep`, so concurrent rows are exactly those in `live` whose ids are NOT in the step input:

```ts
// new helper (near rebaseUserFields):
function rebaseConcurrent(prev: Project, next: Project, live: Project): Project {
  const union = <T extends { id: string }>(n: T[], l: T[], prevIds: Set<string>) =>
    [...n, ...l.filter((x) => !prevIds.has(x.id))];
  const prevArtifacts = new Set((prev.artifacts ?? []).map((a) => a.id));
  const prevLogs = new Set((prev.logs ?? []).map((l) => `${l.ts}:${l.event}`));
  return {
    ...next,
    artifacts: union(next.artifacts ?? [], live.artifacts ?? [], prevArtifacts),
    logs: [...next.logs, ...(live.logs ?? []).filter((l) => !prevLogs.has(`${l.ts}:${l.event}`))].slice(-200),
    // decisions/memory are unioned by id the same way; research by query (H-04 helper).
  };
}
```
and in the loop (store.ts:838-841) replace `commitWild(cur)` with `commitWild(rebaseConcurrent(prevCur, res.project, /* live read inside set */ …))`. Simplest robust form: pass `prevCur` into `commitWild` and compute the union inside the `set` updater where `live` is already read. (Do NOT put `ingestReport`/`approve`/`reject` behind an "active wild run" refusal — agents legitimately report into a running build; merge, don't block.)

Alternative (smaller but weaker): add `chatLog` to the H-01 whitelist AND route `ingestReport`/`approve`/`reject` through `serialized(id, …)` so they serialize against `startWildRun` — but `startWildRun` is not in that chain, so this alone does not close the race; the union-merge is the correct fix.

**Regression tests:**

| # | Test | Asserts |
|---|---|---|
| C1 | store.test: startWildRun on a wild project → synchronously ingestReport while suspended → await run → the ingested artifact + `agent.report` log SURVIVE (union-merge), and the wild step's own artifacts are also present | |
| C2 | store.test: concurrent `approve` during a wild run does not have its decision-journal entry rolled back by the next commitWild | |

**Gates:** typecheck; store/wild-step suites green + C1/C2.

---

## §N — Verified NOT bugs (checked this pass, 0 false positives)

1. **Knowledge supersession / decay math (mission §5):** `decayFactor = 0.5 ** counterEvidence`, `isRetired = counterEvidence >= LESSON_RETIRE_COUNTER(3)`, `counterOf` floors NaN/junk to 0, `supersededIds` collects `supersedes[]`, `findPatterns`/`injectProven` exclude both by default (knowledge.ts:379-404, 260-333). Deterministic and correct — no finding.
2. **`fusionRank` counter-evidence boundary (mission §5):** decay is a per-row multiplier applied after normalization, applied only in `knowledge.ts` (not in `algorithms.ts fusionRank`); legacy stores score byte-identical. Correct.
3. **P6 error paths (mission §3):** `liveP6Synthesis` (codegen.server.ts:446-565) returns the deterministic floor on every failure via `refuse()` (appends a `p6.synthesis.refused` warn log; never fabricates a pass). `liveLayer` (engine.ts:1818-1844) catches a throwing codegen and keeps `done`. `verifyAndFixServer` "failed/error/not-configured" all map through `codeForVerifyStatus` → `refuse` (codegen.server.ts:321-325). Coherent on all branches — no finding. `verify.server.ts`/`verifyAndFixServer` disagreement is not a coherence bug.
4. **io round-trip fidelity (mission §7):** `exportProjectJson → importProject → exportProjectJson` is **byte-identical** for a valid payload (probe-io.ts: `byte-identical=true`), and `research`/`chatLog` survive the round-trip. The 10 MB `IMPORT_MAX_CHARS` cap and the strict shape checks (io.ts:56-104) work. Proto-pollution via `{"__proto__":…}` is a non-issue (JSON.parse + object-spread define an own property, never mutate the prototype). No finding (the `research` normalization gap is H-03, a separate crash vector).
5. **40-row chatLog cap vs views (mission §4):** `appendChatRows` caps at 40 (store.ts:1389), `chatLogToViews`/`trimTurns` render ≤12 (console.tsx:4390-4422), `chatHistoryTurns` replays ≤12 valid rows (chat.ts:96-114), server caps to 6 turns. 40 > 12 headroom holds; no consumer can see beyond the cap. No finding.
6. **`partialize` vs `RapidState` (mission §4):** `partialize` writes `projects/activeId/autopilot/demoSeeded` only (store.ts:678-683); `llmStatus`/`researchStatus`/`hydrated` are correctly in-memory-only (derived). Hydrate merge is shallow and safe. No field silently dropped that should be persisted. No finding.
7. **Race — sync `approve`/`reject` during an *async* run:** sync actions can't interleave each other; the wild driver auto-approves its own gates and parks (returns) at forceHuman/HITL stops, so a human approval during an *active* (unpaused) wild loop has no realistic window. Not reported (no concrete repro; the ingest case in H-06 is the reproducible one).
8. **`Math.random` leaks in deterministic paths:** the only `Math.random()` in the src chain is `rt-ring.ts:73` (a telemetry session id, not a deterministic path). `design.ts`/`diagram.ts`/`vector.ts` explicitly use none. No finding.

---

## Sequencing / ownership notes

- **H-01 + H-06 both touch `rebaseUserFields`/`commitWild` in store.ts:152-167/824-841** — apply together, one executor, so the whitelist addition and the union-merge don't collide.
- **H-03 touches engine.ts `hydrateProject` + io.ts `importProject`** — a second executor can take this in parallel (disjoint regions from H-01/H-06).
- **H-02 (engine.ts dedupeMemoryIds), H-04 (engine.ts liveLayer + packet.ts researchHash), H-05 (packet.ts compiledAt)** are all disjoint single-function edits — parallelize freely.
- Prioritize P1s (H-01, H-03, H-06) before P2s.

File created 2026-09-06 by PRO HUNTER H. No source modified. Probes live under `C:/Users/mnril/AppData/Local/Temp/rt-hunter/` (probe-dedupe.ts, probe-io.ts, probe-debug.ts, probe-store.ts, probe-det.ts, probe-research.ts, probe-race.ts). Executors must re-grep anchors before patching (line drift expected).
