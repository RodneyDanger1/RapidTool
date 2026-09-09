# 98 — LEAPFROG §9/§12 × 89/86-88 → Self-Learning Loop: exact implementation spec (learning-loop lane)

**Pass / agent:** 2026-09-06 · Flash ANALYZER H-B (learning-loop lane, sibling of the Pro that applies this file LIVE).
**Mode:** STRICTLY read-only on RapidTool source (`src/`, `research/`, `scripts/`, `fixes/` prior). Output = this file only, written append-style for continuous Pro consumption.
**Job:** convert LEAPFROG §9 (governed lesson loop, 90_LEAPFROG.md:360-533) + §12 (agentic/DeepSeek fact base, :640-765) + dossiers 89 (self-learning fact base), 86 (kanban verdict), 87 (renamepro verdict), 88 (statkit verdict) into a **module-level implementation spec** for the self-learning loop: CAPTURE → STORE → RETRIEVE → EVALUATE/EVICT → human CORRECT. Every hook below was **re-verified on disk this pass** (grep/sed, file:line cited); no line is inherited unverified. §12.3 constraints cited from 90's own register ([H1]-[H7], fetched by that pass ✓TODAY) and the two memory-mechanism pages re-fetched THIS pass (✓TODAY, §9) — nothing else is claimed externally.
**Conventions:** M = memory-row lesson (project-local, auto), K = knowledge-store lesson (cross-project, HITL-gated). "Additive" = no renamed/removed exports; existing tests stay green.

---

## 0. Loop contract (the four laws every writer obeys)

1. **Advisory law** (knowledge.ts:21-22 header, dod.ts advisory stance, 90 §4 Axis 1): lesson rows are context that *informs*; gates are engine law that *decides*. No lesson row ever gates a phase; injection is always labeled advisory.
2. **Append-only law** (knowledge.ts:8-11): `savePattern()` never mutates/deletes an entry. New engine-owned telemetry methods (§4.2) mutate **telemetry fields only** (never id/project/kind/title/tags/body/sourcePath/savedAt) and are logged by callers.
3. **Keyless floor** (90 §5:268, §2:203): every capture/retrieve/decay step is deterministic with no key. The only LLM turns are (a) Reflexion reflection (L3, optional), (b) Devin-style `propose` — both have deterministic fallbacks.
4. **Ledger rule** (90 §9.3 HOW, :455): every lesson write, promotion, decay bump and supersede is preceded/followed by a `wildLog`-style log event (`engine.ts:2033` pattern: `{ts, phase, level, event, detail}`), events `lesson.capture` · `lesson.pressure` · `lesson.promote` · `lesson.dismiss` · `lesson.decay` · `lesson.supersede`.

---

## 1. Ground-truth inventory (verified THIS pass — the spec rides only these)

| Anchor (file:line) | Verified content this pass |
|---|---|
| `types.ts:97-111` | `MemoryEntry {id, kind: episodic\|semantic\|procedural, phase, text, score, source?: "engine"\|"agent-report"\|"human"\|"research", url?, tags?}` — **`tags?` exists** → lesson taxonomy needs ZERO type change. |
| `engine.ts:48` | `MEMORY_KINDS = episodic\|semantic\|procedural` (runtime guard). |
| `engine.ts:183` | `dedupeMemoryIds(rows)` — dedupe that **renames** rather than removes (H43-P2-1). Lesson ids are content-addressed so dedupe is an exact no-op for them. |
| `engine.ts:262-277` | `mem(kind, text, score, source="engine")` row builder; **id = `` `${phase}-${kind}-${score}` ``** (fork-on-retry defect, H43-P2-1). E-18 provenance comment at :266. Lesson writers must NOT use this helper. |
| `engine.ts:334-344` | P0 reframe HITL creation: `hitl {phase:0, title:"Reframe the brief", prompt:"Scorecard verdict is reframe…", stakes, forceHuman:true}` — **the L1 capture site and the Tier-2 injection site**. |
| `engine.ts:1891-1918` | `verifyPriorPhases(project, touchingPhase, files)` → `{phase, drift, unmetNow, wasPassed}[]` — E-19 drift scanner (counter-evidence source). |
| `engine.ts:2033+` | `wildLog` ledger append pattern (`logs` slice(-200)). |
| `engine.ts:2163-2174` | `wildApproveGate` forceHuman guard — human-only gates pause Wild Mode (`wild.paused_human`). L5 note rule hooks here. |
| `packet.ts:137` | `compileAgentPacket(project)` export. |
| `packet.ts:143-151` | `fusionRank(`${phase.title} ${project.brief} ${lattice.jobs}`, memoryRows, 5)` — **the Tier-1 ranked-memory query (task brief's `:145` = the call)**. |
| `packet.ts:292-310` | `## Ranked memory (A2 FusionRank)` block prints `[kind score] text` per row + honesty labels — provenance already visible in every packet. |
| `knowledge.ts:31` | `KnowledgeKind = brief\|pattern\|fix\|note`. |
| `knowledge.ts:33-46` | `KnowledgeEntry` fields incl. `sourcePath?` (provenance string) + `savedAt`. |
| `knowledge.ts:96-108` | `isEntryRow` — validates only id/project/title/body/tags/kind → **additive optional fields survive round-trips untouched**. |
| `knowledge.ts:111-120` | `fingerprint()` = project,kind,title,tags,body,sourcePath joined — **decay fields MUST stay out of it** (else idempotence forks). |
| `knowledge.ts:178-193` | `mergeWithDisk` — concurrent-save safe (union by id). H43-P3-4 (same-`.tmp` race) still open: promotion path must use ONE store instance per process. |
| `knowledge.ts:199-219` | `savePattern` append-only, id `K${fnv1a8}`, atomic tmp+rename (:221-226), corrupt-file fail-closed (:141-162). |
| `knowledge.ts:233-294` | `findPatterns(query, limit=5)` idf lexical scoring, ties by title/id. |
| `knowledge.ts:302-316` | `injectProven(project, {limit=3, minScore=0.12})` — self-project rows excluded; **no production consumer today** (87 §4 verified). |
| `report-intake.ts:56-65` | `AgentReport {phase, status: complete\|blocked\|partial, summary, artifacts?, files?, tests_run?}`. |
| `report-intake.ts:289-306` | **E-16 site**: on `status==="complete"` with unmet DoD → warn log `report.gate_unmet` + `memoryPrefix "(DoD unmet: …)"` — deterministic capture trigger, today writes nothing else. |
| `report-intake.ts:322-344` | **M-08**: `complete` → 1 semantic row (score 0.7, 240-char text) + 1 episodic row/artifact (score 0.6), ids `report-semantic-…-fp8`, then `dedupeMemoryIds([...]).slice(-80)`. **Rows carry NO `source` field** (H43-P3-3 confirmed live at :327-342) — spec fixes this. |
| `report-intake.ts:365-367` | `applyReport` facade; `applyReportResult` returns {project, applied, reason}. |
| `verify.server.ts:48` | `MAX_ITERATIONS = 3` (clamped 1..5 at call). |
| `verify.server.ts:446-495` | `generateCases(source, brief)` — prompt build; brief enters at ~:475; audit-88 one-bounded-repair-retry landed (:480-499). |
| `verify.server.ts:501-582` | `verifyAndFixServer(source, brief, {maxIterations})` — exit paths: `passed` (evidence `N/N machine-run cases passed on iteration i`), `failed` (evidence lists failing cases or `exhausted N iterations`); fail→patch→re-run loop mid-way; **never declares pass itself**. |
| `headless.ts:939-1017` | `runVerify` → `applyVerifyOutcome(project, outcome)` mints `lastTest {ok, detail, label:"tested", evidenceHash}` (hash = fnv1a(finalSource+evidence), :985) + `verify-{status}-{hash8}` artifact. **L4/L3 write site for engine-run verifies.** |
| `headless.ts:1476-1486` | `knowledgeSave(storePath, pattern)` / `knowledgeFind(storePath, query, limit)` — the ONLY production KnowledgeStore entry points; store path is caller-supplied. |
| `crew.server.ts:294-357` | `buildAgentContext(project, role, session, opts)` — embeds `compileAgentPacket` output cut to 14 000 chars (:325-330) → **crew researcher/architect/reviewer context already carries ranked memory**; researcher is a first-class role (`ACTIVE_BY_PHASE[0]=[researcher,planner,architect]`, :138). |
| `wild-mode.server.ts:71-104` | `buildWildReviewPrompt(ctx)` — Auto-Review classifier context = phase artifacts (≤8), lastTest, DoD unmet list, brief (≤400) — **does NOT include ranked memory/packet today** → Tier-2 injection point for the wild classifier. |
| `prompt-engine.ts:171-215` | `expandBrief` (DeepSeek, json:true) / `applyPolicies` :206 — Tier-3 listing seam. |
| `algorithms.ts:194-208` | `intentLattice` end: `vague = jobs.length===0 && entities.length===0`; fallbacks `jobs:[deliver-core-workflow]` :203, `entities:[operator,record]` :204 — L1's root-cause signal. |
| `algorithms.ts:~618-633` | `bootstrapMemory` — **writes one `procedural` row today** (`boot-proc`, source "engine", static text) → **correction to 89 §3's "nothing writes procedural rows today"**: a static procedural row exists; what's missing is *lesson-derived* procedural rows. |
| `algorithms.ts:232+` | `fusionRank(query, memory, limit=6)` export; per-kind RRF; unknown kinds skipped. |
| `dod.ts:47-165` | DOD table; `p6-test` :126, `p6-source` :135, `p6-artifact` :140, `p6-verified` :153 (label==="tested" + evidenceHash). |
| `dod.ts:264` / `dod.ts:362` | `runGate(project, phase)` / `recordGateInto(project, phase)` (pure, E-02, stamps gate {passed, unmet, evidenceHash, checkedAt}). |
| `vault.ts:230-244` | Memory rows → vault notes (kind "memory", tags ["memory", kind]) — vault = the **human-readable read/edit surface** (pure export; human edits apply to project JSON / next vault run, see §7). |
| `scripts/rapidtool-cli.mjs:786-790` | CLI `knowledge` verb exists, requires `--store` path arg. |
| `gate-stats.ts` (exists) | Gate statistics module on disk — Pro must read it before wiring the eval trend (§6.4). |

**Anchor drift vs 90 §9.7:** all §9.7 anchors re-measured agree. Two precision notes added: (a) 89 §3's "procedural kind … nothing writes procedural rows today" is stale — `bootstrapMemory` writes one static `procedural` row (algorithms.ts:~625); no *lesson-derived* procedural rows exist (statement stands in that narrower form); (b) H43-P3-3 (M-08 rows omit `source`) is live on current disk and this spec fixes it as part of M-08 extension.

---

## 2. Lesson row schema — exact fields (fits EXISTING shapes, zero type changes)

### 2.1 M-form (project-local, auto) — `MemoryEntry` (types.ts:97-111)
```ts
{
  id: `lesson-${classShort}-${fnv1a8(text)}`,   // content-addressed → retries/regeneration NEVER fork (H43-P2-1 fix for lessons)
  kind: "episodic" | "semantic" | "procedural", // per class table below
  phase: PhaseId,                               // phase of ORIGIN (where the event fired)
  text: string,                                 // ≤ 240 chars, template-built (§2.3), NEVER raw unbounded notes (H43-P2-2)
  score: number,                                // per class table; 0.6-0.8 band
  source: "engine" | "human",                   // L1-L4 engine; L5 human (fixes H43-P3-3 for lessons)
  tags: ["lesson", classTag, "L1"|"L2"|"L3"|"L4"|"L5", ...extra],  // tags[] already exists on MemoryEntry
}
```

### 2.2 K-form (cross-project promotion, HITL-gated) — `KnowledgeEntry` (knowledge.ts:33-46)
```ts
{
  project: "<origin project name>",
  kind: "fix" | "pattern" | "note",             // L1/L2/L3/L5 → "fix"; L4 → "pattern"; supersede markers → "note"
  title: "<≤80 chars, verb-first short title>",
  tags: ["lesson", classTag, "L1".."L5", "domain:<detected-domain>", "gate:<gate-id>"],
  body: "<multi-line, file:line + evidenceHash embedded>",
  sourcePath: `phase:P<origin> gate:<gate-id> hash:<evidenceHash> project:<origin>`, // provenance field already exists
}
```

### 2.3 The five classes (LEAPFROG §9.3 table :427-435 → exact text templates)

| # | Class tag | M kind | Score | Capture trigger (verified site) | M text template (deterministic, ≤240 chars) | K promotion (kind/tags) |
|---|---|---|---|---|---|---|
| L1 | `vague-brief` | semantic | 0.7 | P0 lattice `vague:true` + reframe HITL created (algorithms.ts:200-204 signal at engine.ts:334-344 site) | `L1 vague-brief: lattice fell back to jobs=[deliver-core-workflow] entities=[operator,record]; brief vocabulary had 0 LEX hits (top absent nouns: <n1,n2,n3>); fallback domain <domain>. Tighten brief or extend LEX.` | fix, `[domain:<fallback>]` |
| L2 | `template-emission` | episodic | 0.7 | DoD-unmet-on-complete claim (E-16 site, report-intake.ts:294-306) OR conformance count=0 when `p6-brief-fit` lands (88 §7.1#7 — interface only, see §8 note) | `L2 template-emission: phase P<origin> sealed with gate unmet (<unmet ids, comma>); required brief nouns with 0 hits in emitted source: <nouns>; evidenceHash=<hash>.` | fix, `[gate:<id>]` |
| L3 | `verify-failure` | episodic | 0.7 | `verifyAndFixServer` → `failed` (failed exits at verify.server.ts:539 iteration-cap and :575 exhausted) at the caller (`applyVerifyOutcome` site, headless.ts:980) | `L3 verify-failure: machine-run cases failing after <n> iterations: <case ids/detail ≤140 chars>; evidenceHash=<hash>.` + optional `| hypothesis: <Reflexion text>` | fix |
| L4 | `verified-procedure` | procedural | 0.8 | `applyVerifyOutcome` mints `label:"tested"` (headless.ts:1017) — Voyager commit-on-verify (89 §2.1 [S12]) | `L4 verified-procedure: P<origin> module passed <N>/<N> machine-run cases (iteration <i>); evidenceHash=<hash>. Procedure location: <generatedSource host> — reuse this shape next run.` | pattern (human-triggered distill optional) |
| L5 | `user-correction` | semantic | 0.8 | HITL reject with note, or approve-with-note over an unmet DoD (decision apply paths; §7) | `L5 user-correction: gate <gate-id> on P<phase> decided <approve|reject> note="<≤200 chars>"; decision row <id>.` | fix, `[gate:<id>]` |
| — | `drift` | episodic | 0.6 | `verifyPriorPhases` returns `drift:true` (engine.ts:1912) at its callers (store/headless ingest) | `L2-style drift: phase P<later> touched files of P<earlier>; evidence hash changed <old>→<new>; unmetNow=<ids>.` | (never auto-promoted) |

**Honest labeling rule (90 §9.6 #2):** L3's Reflexion text is model prose → stored only after the literal prefix `| hypothesis:` and never as fact; L1/L2/drift rows are engine-detectable and therefore factual. `propose`-drafted K rows are always reviewed by a human before `knowledgeSave` (§7), matching Devin Knowledge Suggestions (89 §1.4 [S1], re-fetched ✓TODAY §9).

---

## 3. CAPTURE — writers and exact call sites (all additive)

New pure module **`src/lib/lessons.ts`** (imports only `./types.ts` + `fnv1a` from `./algorithms.ts`; zero server/deepseek imports → trivially testable):

```ts
export function lessonRow(spec: LessonSpec): MemoryEntry            // id content-addressed, tags normalized (sorted, deduped)
export function selectLessons(memory: MemoryEntry[], phase: PhaseId, limit = 2,
  onlyClass?: string[]): MemoryEntry[]                               // tags include "lesson"; score desc, id asc (findPatterns tiebreak); phase-match OR phase-agnostic when none match
export function vagueBriefLesson(project: Project, absentNouns: string[]): MemoryEntry        // L1 builder
export function templateEmissionLesson(project: Project, phase: PhaseId, unmet: string[], nouns: string[]): MemoryEntry
export function verifyFailureLesson(project: Project, phase: PhaseId, evidence: string, iterations: number, hypothesis?: string): MemoryEntry
export function verifiedProcedureLesson(project: Project, phase: PhaseId, evidence: string): MemoryEntry
export function correctionLesson(project: Project, decision: DecisionRecord): MemoryEntry     // L5 builder
export function lessonLog(p: Project, phase: PhaseId, level: JsonLog["level"], event: string, detail: string): Project  // thin wildLog alias kept in lessons.ts so engine.ts isn't the only importer
export const LESSON_TAG = "lesson";
```

**Writers (call sites, in ship order):**

1. **L1** — at the reframe-HITL creation block (engine.ts:334-344): after `hitl` is built for `sc.verdict==="reframe"`, when `project.lattice?.vague === true`, compute absent nouns = brief tokens with zero LEX/phraseHits (a small pure helper `absentLexNouns(brief, lattice)` in lessons.ts reusing the tokenizer stance of `tokenizeWords`, algorithms.ts) and append `lessonRow(vagueBriefLesson(...))` to `project.memory` via `dedupeMemoryIds([...rows, row]).slice(-80)`; `lessonLog(…, "info", "lesson.capture", "L1 vague-brief …")`.
2. **L2** — two sites, one writer: (a) the E-16 branch (report-intake.ts:294-306) when `unmet.length > 0` fires — ALSO append one L2 row (kind episodic; `source: "agent-report"` mirroring M-08's E-18 stamp, types.ts:103-105) with the unmet ids; M-08 rows land in the same function (:322-344) — write BEFORE the `slice(-80)`; (b) engine-sealed runs (the 86/87/88 shape — CLI/headless approvals, no agent reports): at the phase-seal functions `finishPhase` (headless.ts:342 and store.ts:360) when the phase is being sealed `complete` while `runGate`'s result has `pass:false` (the advisory-gate anomaly, 88 §4.11) — append one L2 row (source `"engine"`) with the unmet ids. Content-addressed ids make (a)+(b) idempotent even if both ever fire for one phase.
3. **L3** — caller-side only: in `runVerify`/`applyVerifyOutcome` region (headless.ts:980-1017) after outcome `status==="failed"` append `lessonRow(verifyFailureLesson(project, phase, outcome.evidence, outcome.iterations))`. **Reflexion fail→pass (89 §2.2 [S13])**: additive export in verify.server.ts:
   ```ts
   export async function reflectFailure(source: string, brief: string,
     failingCases: string[]): Promise<{ ok: true; text: string } | { ok: false; reason: "not-configured" | "error" }>
   ```
   One bounded flash turn (`completeDeepSeek`, json:false), prompt: `"A module failed machine-run cases <ids+detail>. One sentence: why did the FIRST attempt fail, and what changed to fix it? Answer as: symptom; hypothesis; fix."` Keyless/parse-fail → `{ok:false}` and the caller stores the L3 row WITHOUT the hypothesis suffix (deterministic floor preserved). Caller: runVerify when final status is `failed` AND `outcome.iterations > 1` (only fail→pass pairs and multi-attempt failures earn the reflection; single-shot failures store evidence only).
4. **L4** — in the same region (headless.ts:1017) when `applyVerifyOutcome` minted `label:"tested"`: append `lessonRow(verifiedProcedureLesson(project, phase, evidence))` — first **lesson-derived** `procedural` writer (89 §3 gap, corrected per §1). No LLM: evidence text is the machine verdict; optional LLM distill of the procedure is a `propose`-verb concern (§7), never automatic.
5. **L5** — decision-apply paths: wherever a HITL decision with `decision==="reject"` and `note` (≥12 chars per ADR-002) lands, or an `approve` carries a note while the phase gate has `passed:false` (the 86/87/88 null-note anti-pattern inverted, 90 §9.3 #3 :454): append `lessonRow(correctionLesson(...))`. Verified apply seams: `headless.ts` approve/reject verbs (per §9.5 P1-4, `src/lib/adr.ts` mint site + engine HITL reject path — Pro must locate the exact decision-append line while wiring; decision shape is rendered at packet.ts:115-127: `{phase, decision, decidedBy, note, requestedAt, decidedAt}`).
6. **Drift rows** — at `verifyPriorPhases` callers (store/headless ingest paths that log `regression.drift`): for each `drift:true` row append a drift lesson (score 0.6). These are ALSO the counter-evidence input to §6.1(b).
7. **M-08 extension (part of writer 2):** stamp `source: "agent-report"` on the M-08 semantic/episodic rows (report-intake.ts:327-342) — closes H43-P3-3; ids keep the fp8 scheme (backward-compatible; no dedupe semantics change).

**Anti-noise rules (bind all writers):** (a) one row per class per phase per distinct text — content-addressed id makes repeats no-ops; (b) L1 suppressed when a same-text L1 exists for the same project run (id dedupe covers it); (c) L3 rows cap iterations/case detail at the 240-char text budget (H43-P2-2 lesson — never embed unbounded notes); (d) writers NEVER block or flip phase state (advisory law); (e) all rows pass through `dedupeMemoryIds(...).slice(-80)` exactly like M-08 (:343) so the cap is uniform.

---

## 4. STORE — where rows live, idempotency, and the two store upgrades

### 4.1 Project memory tier (fast, automatic, per-project)
- Location: `project.memory` (types.ts:277) — already ranked into every packet (packet.ts:143-151) and exported to vault (vault.ts:230-244).
- Cap: 80 rows — every writer above passes `dedupeMemoryIds([...rows, ...new]).slice(-80)` (report-intake.ts:343 convention).
- Idempotency: content-addressed ids (§2.1) → re-synthesis, re-verify, report re-apply can never fork rows (H43-P2-1 avoided for lessons by construction; engine's `mem()` helper is untouched — out of this lane's scope).

### 4.2 Knowledge-store tier (durable, cross-project, HITL-gated)
- **Schema-additive fields** (knowledge.ts:33-46): `counterEvidence?: number` and `supersededBy?: string[]` (engine-owned telemetry, writer-only) + `supersedes?: string[]` (declared at save time by the NEW superseding row — it IS content). `isEntryRow` (:96-108) untouched (validates a subset → tolerant). `fingerprint()` (:111-120) gains `e.supersedes ?? ""` in the join ONLY — backward-compatible for existing rows (absent field = empty string = same hash); `counterEvidence`/`supersededBy` stay OUT of the fingerprint so idempotent re-save of the original content still dedupes to the same row.
- **Two engine-owned methods on `KnowledgeStore`** (append-only law preserved — content fields never mutate; telemetry fields only; caller logs `lesson.decay`/`lesson.supersede` BEFORE calling so the ledger is the audit trail):
  ```ts
  bumpCounterEvidence(id: string): KnowledgeEntry | null      // counterEvidence = (v ?? 0) + 1; rewrites file via existing writeStore; null if unknown id
  markSuperseded(id: string, byId: string): KnowledgeEntry | null  // appends to supersededBy[]
  ```
- **Retrieval filter**: `findPatterns` (:233) and `injectProven` (:302) gain an internal `isSuperseded(entry, all)` pass — an entry whose id appears in any newer entry's `supersedes[]` is excluded from results (deterministic, read-time, zero deletion). Additive optional param `{ includeSuperseded?: boolean }` defaulting false if the Pro wants to keep raw search behavior; default behavior change is acceptable ONLY if `knowledge.test.ts` pins it (check existing pins first — prefer opt-in `opts` to avoid breaking byte-pinned tests).
- **Promotion path** (only via human accept, §7): `knowledgeSave(storePath, …)` (headless.ts:1476). One store instance per process for the accept flow (H43-P3-4 open: `mergeWithDisk` makes interleaved appends safe-ish, but two instances still share one `.tmp` — serialize accepts in the CLI verb).
- **Pressure promotion (MemGPT-style, 89 §6 menu #2 [S15])**: pure `pressureAt(memory, threshold=60): boolean`. At every 80-cap write site, when `memory.length >= 60`: log `lesson.pressure` (warn) and — only if a knowledge store path is configured for the run (env `RAPIDTOOL_KNOWLEDGE` or CLI arg; **unset = no-op**, keyless floor) — deterministically consolidate: for each phase with ≥3 same-classTag lesson rows, `savePattern` ONE self-project `note` row (title `Run lessons P<phase> <classTag>`, tags `["lesson","consolidated","domain:<d>"]`, body = the top-3 rows' texts joined with their ids) — self-project rows never re-inject into their own project (`injectProven` self-exclusion :306), so no feedback loop; the content survives the imminent `slice(-80)` eviction. Cross-project reach still requires the human accept.

### 4.3 Vault tier (read/edit surface)
Memory rows already render as vault notes (vault.ts:230-244); decisions and ADRs render too. Lesson rows flow into vault automatically once in `project.memory` — no vault code change. The vault is the **human review surface** (§7); the CLI verb is the **human edit surface** on the store itself.

---

## 5. RETRIEVE — exact injection points (deterministic; tiers mirror 89 §4)

### Tier 1 — always-on, scored: ranked-memory slot (rides existing machinery)
- Lesson rows are `MemoryEntry`s → they enter the P6 codegen prompt, crew context, and every phase prompt **through the existing FusionRank call** (packet.ts:143-151 → `## Ranked memory` :292, printed as `[kind score] text`). No packet change required for M-form lessons. **Verify with a test** (packet.test.ts): a project whose memory contains an L1 row with tag `vague-brief` and a P0-phase packet query containing a kanban-style brief ranks the L1 row ≥ an unrelated row.
- **Cross-project proven rows enter the same slot** (87 §4 H3 / 88 §7.2 RETRIEVE, today unwired): at `compileAgentPacket`, BEFORE `fusionRank`, when a knowledge store path is configured: `store.injectProven(project.name, {limit: 3})` (knowledge.ts:302) → map each `ProvenRow` to a transient rankable row `{id: "proven-"+entryId, kind:"semantic", phase, text: advice.slice(0,240), score: score, source:"research"}` and pass `[...memoryRows, ...provenRows]` into `fusionRank`. Provenance + score print automatically via the :292 formatter; the honest label "advisory" is inherited from `advice` text ("Reuse \"…\" (stored from project …)"). Guard: keep `injectProven`'s `minScore 0.12` default (:304) — a wrong-domain lesson must not "help" every run (90 §9.6 #4).
- **P6 codegen prompt** = `generateCases` (verify.server.ts:446): additive optional param `lessons?: string[]` appended as an `## Prior lessons (advisory — verify only what the brief requires)` block after `Brief:` (:475), rendered by the caller (headless `runVerify`) via `selectLessons(project.memory, 6, 2)` filtered to tags `["lesson"]`. Param default `undefined` keeps every existing call/test byte-stable.

### Tier 2 — on-trigger (the 86/87/88 failure-mode brake)
- **P0 reframe HITL** (engine.ts:334-344): when building the `hitl` object for a `vague` lattice, append to `hitl.prompt` (today a static string) up to 2 prior `[vague-brief]` lesson texts: `` `\n\nPrior lesson (advisory): ${text}` `` from `selectLessons(project.memory, 0, 2, ["vague-brief"])` — a second kanban/statkit/renamepro brief meets its own failure class before the fallback fires.
- **Wild classifier context** (wild-mode.server.ts:76 `buildWildReviewPrompt`): insert one block after the `Unmet DoD criteria` section: `Prior lessons (advisory):\n<top-2 selectLessons(ctx.project.memory, ctx.phase, 2) texts>`; empty → omit block (byte-stable when no lessons — existing wild tests stay green). Pure-function change; no ctx shape change needed (builder already receives the full project).

### Tier 3 — model/manual (optional, provenance-stamped)
- `expandBrief` (prompt-engine.ts:171): additive optional `lessons?: readonly string[]` folded into `expansionPrompt(brief, policies, lessons)` as a `Known failure modes from prior runs (advisory):` list. CLI `prompt` verb (headless.ts:1352-1359) passes `selectLessons(...)` rows when available.
- Crew researcher: **already covered by Tier 1** (buildAgentContext embeds the packet, crew.server.ts:325-330; researcher role active at phases 0/7). No crew change needed — only a test pin (crew.test.ts: context contains lesson text when memory has lesson rows).

**Provenance rule (all tiers):** every injected row keeps its `[kind score]`/source visible (packet formatter :292), and M rows are ≤240 chars so prompt budgets stay bounded (H43-P2-2). Injection NEVER changes gate inputs (advisory law) — dod.ts `runGate` is untouched.

---

## 6. EVALUATE / EVICT — verify-gate hook + counter-evidence decay (deterministic)

### 6.1 What counts as counter-evidence (a `fix` lesson is only re-trusted if its claim still holds)
- **(a) E-19 drift recurrence** (engine.ts:1891-1918): `verifyPriorPhases` drift rows for phase Pk are matched against lesson rows tagged `["lesson","gate:<g>"]` where `<g>` ∈ `unmetNow`; each match → one counter-evidence unit on the K-form row's origin (see §6.2 for the K-side mechanics; M-side rows just age out of the 80-cap naturally).
- **(b) Same failure-mode recurrence**: an L2 capture fires (writer 2) for a gate that a K-row `fix` claims to prevent (match by `gate:` tag + domain tag). Deterministic match = same gate id in `unmet` list AND same domain tag; no semantic guessing.
- **(c) Human override** (§7 `lesson supersede` / `lesson dismiss`).

### 6.2 Decay rule (pure, ledgered, replayable — 90 §9.3 :447 "not a model's mood")
- K-form rows carry `counterEvidence` (0 default). Retrieval weight = `effectiveScore = score * 0.5 ** counterEvidence` (halve per recurrence). At `counterEvidence >= 3` the row is **retired**: excluded from `injectProven`/Tier-1 seeding and from `findPatterns` default results, still present in the store file and vault export with a `(retired — 3× counter-evidence)` tag so nothing is ever silently deleted (append-only law).
- Decay is computed at read time (no background job); bumps are write events logged `lesson.decay` with `{entryId, counterEvidence: n}` detail. The recomputation is byte-deterministic given the store file — replayable for the eval harness.
- **Supersede (Graphiti validity window scaled down, 89 §6 #7 [S21])**: a NEW append-only row (kind `note`, tags `["lesson","supersede"]`, `supersedes: [oldId]`, body cites the old id + the evidence/human note) + `markSuperseded(oldId, newId)`. Read-time exclusion per §4.2. Machine-initiated supersede is ONLY allowed from path (b) when a *verified* L4 row (`label:"tested"` evidence) contradicts a `fix` row's claimed remedy for the same gate+domain — otherwise supersede stays human-initiated (§7). (Honest negative: automatic semantic contradiction detection is not reliable enough to trust beyond the tagged gate+domain match — 90 §9.6 #2.)
- **M-form eviction** = the existing 80-row FIFO + §4.2 pressure promotion. No new eviction machinery.

### 6.3 Verify-gate hook (the "memory is re-checked before re-trusted" claim)
The recompute already exists: `runGate` (dod.ts:264) re-derives `evidenceHash`; `verifyPriorPhases` (engine.ts:1891) is the drift scanner. What this lane adds is ONLY the capture/decay wiring above. No dod.ts probe is added by this lane (`p6-lessons` per 90 §9.3 belongs to P1-1's probe work — dod.ts is heavily test-pinned; keep the touch surface minimal).

### 6.4 Falsification metric (90 §5:268, §9.3 :449 — the loop is decorative unless measurable)
Add to the eval harness (`npm run eval`, gate-stats.ts exists — read it first): per-failure-mode counters over runs — (i) runs reaching `complete` with a `[template-emission]`/L2-class gate unmet in phases 0/6/12; (ii) % of packets containing ≥1 lesson row (countable from packet text at :292); (iii) verify `failed` rate; (iv) K-store row retirement rate. **Kill criterion (unchanged from 90): gate-rejection rate per failure mode must decrease by run 6 once L1-L5 rows are live, or the loop is ripped out.**

---

## 7. Human correction path (machine-proposes / human-disposes, 89 §3)

**CLI verb `lesson`** (new case in `scripts/rapidtool-cli.mjs` next to `knowledge` at :786; new headless verbs mirroring `knowledgeSave`/`knowledgeFind` at headless.ts:1476-1486 — pure functions, no server deps):

| Subcommand | Semantics | Writes |
|---|---|---|
| `lesson list [--phase N] [--class L1..L5]` | rows from `project.memory` filtered by `tags ∋ "lesson"`, rendered `[id kind score] text` + tags | — |
| `lesson add --class <L1..L5> --tag <classTag> --text "<…>"` | manual M-row (source `"human"`, content-addressed id) | project memory |
| `lesson dismiss <id>` | remove an M-row (project memory is mutable per-project data — append-only applies to the knowledge store, not `project.memory`) | project memory + `lesson.dismiss` log |
| `lesson propose [--store <path>]` | Devin-style suggestion (89 §1.4 [S1] — re-fetched ✓TODAY §9): ONE bounded flash LLM turn drafts a K-form entry from the {latest verify-fail evidence, rejection note, L3/L5 rows} triple; keyless/unparseable → deterministic template `fix` row from the raw evidence (never a fabricated proposal). Output = **editable JSON on stdout**, nothing saved. | none (draft only) |
| `lesson accept --store <path> [--title … --edit-json …]` | human-approved (optionally edited) proposal → `knowledgeSave` (headless.ts:1476) + `lesson.promote` log | knowledge store |
| `lesson supersede <id> --store <path> --reason "<…>"` | appends the superseding `note` row (`supersedes:[id]`) + `markSuperseded` + `lesson.supersede` log | knowledge store |
| `lesson learn` | run writers 3/5 over the current project's tail state (verify outcome + decisions) as a repair/backfill — deterministic, idempotent | project memory |

- **Why CLI, not chat, for P0:** the chat path is a grounded one-shot context builder (chat.server.ts:48 `CHAT_CONTEXT_MAX_CHARS=2500`, no command router) — a chat correction verb would need a new chat-surface contract; the 86/87/88 runs were all CLI/headless-driven, and `console.tsx` HITL is the panel surface. **Honest staging:** CLI verb + HITL panel proposals first (§9.5 P1-3 renders lesson rows as artifact cards with "Proposed knowledge — edit/dismiss/promote"); a chat `/lesson` verb is a later, separate decision — do not invent it here.
- **Proposal persistence between `propose` and `accept`:** reuse the report-intake distinguishable-prefix pattern (report-intake.ts:48-50 `[agent report]` id/title prefixes the engine never emits): proposals land as kind-`docs` artifacts titled `[lesson proposal] <title>` with a footer `> lesson proposal — unverified by engine`; `accept`/`dismiss` verbs act on those artifacts. Zero Project-schema change.
- **L5 capture double-duty:** the ≥12-char-note requirement on approve-over-unmet-DoD (88 §7.1 #9 — an engine-side HITL change, §9.5 P1-4's lane) is the *input* this lane consumes: when such decisions exist, writer 5 fires. Approvals with `note:null` over a failing gate (86 §4.2, 87 S2, 88 §5.2) additionally log `lesson.decay`-class info — the anti-pattern itself becomes a lesson candidate row (class `user-correction`, tags `["gate:<id>","null-note"]`) so the record can't repeat silently.

---

## 8. Web-verification — which competitor memory patterns fit RapidTool's constraints (DeepSeek §12.3 binds)

Pages re-fetched THIS pass (2026-09-06, ✓TODAY): Claude Code memory doc (`code.claude.com/docs/en/memory`) and Devin Knowledge doc (`docs.devin.ai/product-guides/knowledge`) — both confirm the 89 [S5]/[S1] claims used above (auto memory "learnings and patterns… first 200 lines or 25KB", CLAUDE.md correction triggers, "context, not enforced configuration"; Devin trigger-description contract, automatic recall "when relevant", Knowledge Suggestions edit/dismiss/regenerate, pinning, keep-items-small). Remaining mechanism claims are cited to 89's same-day [S#] register / 90 §9 [✓TODAY] register — not re-fetched, flagged as inherited.

| Pattern (source) | Fit verdict for RapidTool | Binding constraint (90 §12.3, [H#]) |
|---|---|---|
| Claude auto memory: correction-triggered notes, 200-line/25KB cap [S5, ✓TODAY] | **ADOPT as L5 + M-row cap.** RapidTool's 80-row FIFO + 240-char text ≈ the cap; correction-trigger = writer 5. "Context, not enforced configuration" = advisory law already in knowledge.ts:21. NOT copied: load-everything (RapidTool ranks top-k). | 12.3.2-9: 1M ctx is a cost trap — never dump the store; ranked top-k only ([H2]). |
| Claude recorded recipes `/verify`, anti-churn edit-only-when-wrong [S6] | **ADOPT as L4** (verified-procedure, evidence-hashed) + anti-churn rule: machine never edits a K row; only new append-only rows (supersede). | Byte-stable prompts → cache-hit economics (12.3.2-5, [H2]): lessons ride the packet compiled once per run (crew reuses it, crew.server.ts:325), and injection blocks are fixed-format → keep lesson text template-fixed per class. |
| Devin Knowledge: trigger-description + content; suggestions edit/dismiss/regenerate; pinning [S1, ✓TODAY] | **ADOPT the suggestion HITL as `lesson propose/accept`** (§7) and trigger-tags ≈ K-row `tags`. NOT copied: opaque recall backend (89 §1.4 honest limit) — retrieval stays deterministic idf/FusionRank (Axis 2, 90 §2:203). | JSON-not-grammar (12.3.2-1 [H3]): `propose` output must be schema-validated before display, exactly like `parseOracleJson` + its one bounded repair retry (verify.server.ts:480-499). |
| Codex: approval→rule; extract-then-consolidate; secret redaction [S10][S11] | **ADOPT approval→guardrail as L5** (a rejection-with-note mints a durable row) and the consolidation idea as §4.2 pressure promotion. **ADOPT redaction-by-construction**: M text never embeds raw notes >240 chars (H43-P2-2). | 12.3.2-3 ([H6]): if any future tool-bearing lesson turn exists, `reasoning_content` must round-trip — today's capture turns carry no `tools`, so no risk; note it for `propose` if it ever gains tools. |
| Cursor frontmatter triple always/globs/model-decided [S7][S8] | **PARTIAL**: lessons are tag-filtered deterministically (≈globs); Tier-3 model-decided loading is optional + provenance-stamped, never the primary path (90 §9.6 #6). | — |
| MemGPT memory-pressure [S15] / Graphiti validity windows [S21] | **ADOPT scaled down**: pressure event ≥60 rows (§4.2), supersede rows (§6.2). Full temporal KG stays out of scope (89 §6 #8). | — |
| Reflexion [S13] / ExpeL [S14] / Voyager commit-on-verify [S12] | **ADOPT**: L3 hypothesis suffix (Reflexion), `lesson propose` batch insight (ExpeL), L4 commit-on-verified (Voyager). | 12.3.2-2 ([H6]): thinking-mode disables temperature — reflection turns use default settings; no creativity knob needed. |
| Cascade auto-memory retirement [S3] | **DON'T COPY**: auto rows stay project-local + FIFO-capped; only HITL-gated rows reach the durable store (90 §9.6 #2) — the design above already enforces this. | — |

**Honest negatives (this pass):** Claude auto-memory generation/retrieval internals beyond the docs table not published (89 §7); Devin recall backend opaque (89 §7); no shipped competitor counter-evidence-decays a lesson (90 §9.2 — RapidTool's §6 decay remains the differentiator); memory-retrieval quality gain is only measurable via §6.4's falsification metric.

---

## 9. Module-level spec for the Pro (apply in this order; every item additive + tested)

| Step | File | Change (additive) | Test |
|---|---|---|---|
| 1 | `src/lib/lessons.ts` (NEW) | Pure module per §2/§3: `LessonSpec`, `lessonRow`, `selectLessons`, builders L1-L5 + drift, `absentLexNouns`, `pressureAt`, `lessonLog`. | NEW `src/lib/lessons.test.ts`: id content-addressing (same spec twice → same id, no growth — H43-P2-1 regression), tag normalization, selectLessons tiebreak (score desc, id asc), ≤240-char text invariant, keyless builders never throw, absentLexNouns determinism. |
| 2 | `report-intake.ts` | Writer 2 (L2 at E-16 site :294-306) + M-08 `source: "agent-report"` stamp (:327-342) + lesson rows before `slice(-80)` (:343). | report-intake tests: complete-report-with-unmet-DoD now ALSO yields 1 L2 row + source stamp present; byte-identical when no unmet (no-row case). |
| 3 | `engine.ts` | Writer 1 (L1 at reframe-HITL block :334-344); Tier-2 prompt append (same site); L2(b) writer at the phase-seal `finishPhase` sites (headless.ts:342 / store.ts:360 — call `runGate`-unmet check there or in `recordGateInto` callers, dod.ts:362); drift-row writers at `verifyPriorPhases` callers. | engine tests: vague-lattice project → memory contains 1 `[vague-brief]` row after P0; non-vague → none. |
| 4 | `headless.ts` + `verify.server.ts` | Writers 3+4 at `applyVerifyOutcome` region (:980-1017); `reflectFailure` additive export; L3 row with optional hypothesis; `generateCases` additive `lessons?` param threaded from `runVerify` via `selectLessons(…, 6, 2)`. | verify/headless tests: failed outcome → L3 row appended; passed (`label:"tested"`) → L4 procedural row; reflection unconfigured → no hypothesis suffix, row still written. |
| 5 | `wild-mode.server.ts` | Tier-2 block in `buildWildReviewPrompt` (:76-104) after unmet-DoD section; empty-lessons → byte-identical prompt. | wild tests: lesson rows in memory → block present with top-2; none → existing byte pins unchanged. |
| 6 | `knowledge.ts` | §4.2: additive fields, fingerprint `supersedes` join, `bumpCounterEvidence`, `markSuperseded`, read-time supersede filter (+ `includeSuperseded` opt), retire-at-3 in `injectProven`/`findPatterns`. | knowledge.test.ts: fingerprint stability for legacy rows (no `supersedes` → same id as today), bump never touches content fields, superseded row excluded from `injectProven`, retired-at-3 exclusion, concurrent mergeWithDisk behavior unchanged. |
| 7 | `packet.ts` | Tier-1 proven seeding (§5) behind configured-store guard; no change to the :292 formatter. | packet.test.ts: seeded proven row appears in ranked section with score; unconfigured → byte-identical packet. |
| 8 | `prompt-engine.ts` | `expandBrief` additive `lessons?` param (+ expansionPrompt block). | prompt-engine tests: param present → advisory list in prompt; absent → unchanged. |
| 9 | `headless.ts` verbs + `scripts/rapidtool-cli.mjs` | `lesson` verb family (§7): list/add/dismiss/propose/accept/supersede/learn + `[lesson proposal]` artifacts. | headless/CLI tests: accept writes via `knowledgeSave` once (idempotent second accept no-ops), dismiss logs, supersede excludes from later `knowledgeFind`. |
| 10 | crew.test.ts pin + eval | Tier-1 crew context pin; §6.4 counters into `npm run eval` (read gate-stats.ts first). | crew test: lesson text inside `buildAgentContext` output when rows exist. |

**Ordering:** 1 → 2 → 3 → 4 (capture closed, all M-tier) → 5 (Tier-2 retrieval) → 7/8 (Tier-1/3 retrieval) → 6 (K-tier decay — needs 9's accept verb to be useful, so land 9 before or with 6) → 10. Steps 1-5 need no key, no store path, no new state — they are the immediate, lowest-risk wave (90 §5: both write-back edges are M-effort). L2's richer form waits on the P1-1 conformance probe (`p6-brief-fit`, dod.ts near :153 — another lane); writer 2's E-16 trigger is the standing deterministic fallback until it lands.

**Acceptance criteria (definition of done for the whole lane):** (1) a second vague-brief project run shows the L1 row inside the P0 reframe HITL prompt and the `## Ranked memory` packet section (assertable from project JSON + packet text); (2) a verify `failed` outcome writes exactly one L3 M-row (idempotent on re-apply); (3) `lesson accept` is the only path that grows the knowledge store from a project run; (4) a superseded/retired K-row never appears in `injectProven` output; (5) all pre-existing tests stay green (lib suite 962+ pass baseline per fixes/75/78 headers); (6) keyless runs produce identical lesson behavior minus the two optional LLM turns.
