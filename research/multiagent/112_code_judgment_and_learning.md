# 112 — Code Judgment, Durable Memory, and Learning From Its Own Mistakes (+ small algorithm fixes)

**Status:** research complete 2026-09-16 (read-only pass; two defects in §5 reproduced by executing the repo's own modules).
**Scope:** READ-ONLY research. Deliverable = this file. No repo source was modified.
**Non-overlap (checked, deliberately not re-derived):**

| Doc | Owns | This doc does not repeat |
|---|---|---|
| `102_code_quality_signals.md` | the 12 verification signals, LLM-judge bias literature, the oracle problem, mutation/coverage-as-weak-proxies | does not re-argue which signals matter |
| `103_feature_gaps.md` | capability/wiring gap register | does not re-list feature gaps |
| `89_self_learning_research.md` | shipped-agent memory systems + research systems (Voyager/Reflexion/ExpeL/MemGPT/Mem0/Zep/LangMem) fact cards | cites those only where a *new* mechanism is specified; new claims carry fresh fetched URLs |
| `100_factory_blockers.md` | actor-seam forgery (P0-01), self-referential DoD (P0-02), judge/producer inversion (P0-03) | consumes these as *constraints*, does not re-prove them |

**Method.** Every RapidTool claim: read/grep of the current tree, `file:line` cited, run this pass (2026-09-16).
Every research claim: fetched this pass (arXiv API abstracts / Wikipedia REST), URL cited in §7.
Two algorithm defects in §5 were **reproduced by executing the repo's own code** (read-only, no writes) — raw output quoted.
Anything I could not verify is marked `UNVERIFIED`.

---

## 1. What the lesson/knowledge loop does TODAY (verified)

### 1.1 Two tiers, one store — the architecture as built

| Tier | Carrier | Lifetime | Writer | Reader |
|---|---|---|---|---|
| **T1 project memory rows** | `Project.memory` (`MemoryEntry[]`), kinds `episodic\|semantic\|procedural` | **perishable** — `dedupeMemoryIds(...).slice(0, 80)` FIFO (`engine.ts:1331`, `:1388`, `:1600`, `:1665`; `report-intake.ts:435`) | engine seals, report intake, verify loop, harvest | engine prompt paths (`engine.ts:600-603`), codegen expansion (`codegen.server.ts:1326-1328`, `:1399-1401`, `:1606-1608`), packet render |
| **T2 cross-project knowledge store** | `{version:1, entries: KnowledgeEntry[]}` JSON file, path caller-supplied (`knowledge.ts:203-208`, `:24-26`) | **append-only / permanent** | `KnowledgeStore.savePattern` (`:375-400`) — reached only via the human-gated CLI `lesson --accept` | `findPatterns` (`:482-556`) → `injectProven` (`:567-592`) → `packet --knowledge` tier-1 seed (`rapidtool-cli.mjs:668-690`; `packet.ts:191-195`), and `lesson --list` |

**Verified law of the store:** append-only (`knowledge.ts:8-11`); idempotent by content fingerprint `K+fnv1a(project,kind,title,sortedTags,body,sourcePath,supersedes)` (`:274-289`, `:378`); atomic tmp+rename write (`:462-467`); a corrupt or wrong-shape store is **refused with a throw, never overwritten** (`:315-320`, `:322-327`); junk rows are filtered on read (`:330`, `isEntryRow` `:227-239`); a malformed candidate is rejected before write so save/read can never diverge (`:250-271`).

**Lifetime asymmetry that matters for "remember forever":** every lesson minted during a run lands in **T1** (`engine.ts:1388`, `report-intake.ts:435`) and is subject to the 80-row FIFO. The store in **T2** — the only permanent carrier — has **no machine writer**: the CLI comment states it outright, "there is no machine path that appends to the store" (`rapidtool-cli.mjs:1681-1683`).

### 1.2 The lesson row (M-tier) — one builder, five classes

`lessonRow(spec)` (`knowledge.ts:715-743`) is the single builder: id = `lesson-<classShort>-<fnv8(text)>` (content-addressed ⇒ a re-seal of the identical text cannot fork a row), tags sorted+deduped and always carrying `[lesson, classShort, level]`, text whitespace-collapsed and capped at `LESSON_TEXT_MAX = 240` (`:684`). Classes `L1..L5` (`:688-689`):

| Class | Builder | Trigger today (verified call site) | kind / score / source |
|---|---|---|---|
| L1 vague-brief | `vagueBriefLesson` `:860-888` | lattice fell back to demo domain, 0 LEX hits (`engine.ts:500`) | semantic 0.7 engine |
| L2 template-emission | `templateEmissionLesson` `:897-930` | a phase **sealed with the gate unmet** (`engine.ts:1366-1388`) or an agent report claiming complete with unmet DoD (`report-intake.ts:344-372`, source `agent-report`) | episodic 0.7 engine / agent-report |
| L2 drift | `driftLesson` `:1016-1041` | E-19 evidence-hash change on an earlier phase | episodic 0.6 engine |
| L3 verify-failure | `verifyFailureLesson` `:936-962` → `verifyOutcomeLesson` `:1288-1297` | verify loop failed/errored/exhausted (`verify.server.ts:761`, `:796`, `:833`) | episodic 0.7 engine |
| L4 verified-procedure | `verifiedProcedureLesson` `:966-985` | verify loop **passed** — Voyager-style commit-on-verify (`verify.server.ts:780`) | procedural 0.8 engine |
| L5 user-correction | `correctionLesson` `:992-1011` | a HITL decision row; a missing note is itself flagged (`null-note` tag, `:1009`) | semantic 0.8 human |
| L5 run-summary | `runSummaryLesson` `:1303-1336` | run completed with gate failures / rejections / verify failures; `null` for a clean run | episodic 0.6 engine |
| L2 harvest negative-evidence | `harvestEvidenceLesson` `harvest.ts:688-728`, driver `harvestResultLesson` `:729-748` | harvest rate-limit / empty / degraded | episodic 0.6 engine |

Store-side gates that are real today: lesson-tagged *store* writes go through `saveLessonIfImproved` (`knowledge.ts:412-460`) → `shouldPromoteLesson(prior, next)` (`:812-818`) — **refuse when the incoming maker score is unknown, require `next >= prior`** — and the human `lesson --accept` path is exempted by the `accepted` + `actor:*` tags (`:417-420`, deliberately, per the 209 comment at `:408-411`).

### 1.3 Read-back and injection — what actually reaches a prompt today

1. `selectLessons(memory, phase, limit)` (`:784-805`): lesson-tagged rows, optional class filter, **phase-matched first, phase-agnostic fallback** so a class trigger cannot be silenced by a phase mismatch; tiebreak score desc / id asc.
2. `rankBriefLessons(brief, memory, {limit, proven})` (`:90-122`) → `fusionRank` → `lessonLinesForBrief` (`:128-134`) emits `[kind score] text` lines (provenance visible). Cap `EXPAND_LESSON_RANK_LIMIT = 5` (`:44`).
3. `expandBrief(..., lessons)` renders them as "Known failure modes from prior runs" — advisory, never gate input (`prompt-engine.ts:69-73` `EXPAND_LESSON_MAX_CHARS=240` / `EXPAND_LESSON_MAX_COUNT=12`, `:200-203`, `:215-216`).
4. Cross-project: `packet --knowledge <store.json>` maps `injectProven` rows through `provenToLessonRow` (`knowledge.ts:71-85`) into the packet's Ranked-memory pool; `injectProven` **excludes the project's own rows** (`:582`) and drops rows under `minScore` 0.12 (`:577`), and the packet labels the section advisory (`packet.ts:464-469`).

### 1.4 Failure evidence that already exists (raw material for §4)

| Evidence | Where | Shape |
|---|---|---|
| Rejection history | `engine.ts:1622-1625` (`rejectionHistory` append, `status:"rejected"`, `rejectionNote`), `:1279-1281` (attempt = `rejectionHistory.length`, last note), `:1830` (normalizing kept rows with `gate`) | note text + `at` timestamp per rejection |
| Crew prompt side | `crew.server.ts:260` (rejections rendered into the follow-up prompt) | note list |
| Synthesis refusal | `codegen.server.ts:1042` (`p6.synthesis.refused` warn log naming the chunk index); digest form consumed at `engine.ts:1199-1215` + `:1358-1388` (`refusalClassOf` → RT_E code + tail) | RT_E code + chunk index + tail |
| Lesson capture log | `lesson.capture` rows (`engine.ts:1383-1387`, `report-intake.ts:370-371`) | lesson id + unmet ids |
| Gate failure | `recordGateInto` (`dod.ts:665`) → `failedGates` (`:651`), `sealedWithFailures` (`:661`), seal honesty census `sealHonesty` (`engine.ts:1171-1177`) | phase → unmet criterion ids + evidenceHash |
| Run diagnosis | `diagnose.ts:1-20` — pure ranked heuristic over `RtEvent` rows, first-match-wins cause list, every claim cites `evidence` row indices, honest `none-detected` floor | ranked cause + evidence indices |
| Approval health | `gate-stats.ts:1-40` — `approvalHealth` flags `rubber`/`fast` from the append-only HITL journal (human rows only) | n / latency / rejectRate / flag |

### 1.5 The five verified gaps in "learn → remember → reuse"

- **G1 — perishable.** Lessons are minted into T1 and evicted by the 80-row FIFO (`engine.ts:1331`); promotion to T2 requires a human `lesson --accept` (no machine path — `rapidtool-cli.mjs:1681-1683`). A run that never gets that human act remembers nothing durable.
- **G2 — lexical-only recall.** Declared by the module itself ("NOT a vector database and NOT embeddings — synonyms and paraphrases do not match unless words are shared", `knowledge.ts:16-20`), and the stemmer gap proven in §5 F4 makes some *inflected* pairs miss too.
- **G3 — no in-run store consultation.** The knowledge store is read by `packet --knowledge` only when the caller passes the flag (`rapidtool-cli.mjs:668-690`); nothing in the engine reads T2 during phases.
- **G4 — asserted, not proven.** A stored lesson's only machine-checkable tie is the FNV-1a evidence hash *inside the free text* (`verifyFailureLesson:945`, `templateEmissionLesson:914-917`) plus `sourcePath:"lesson:<rowid>"` (`acceptedLessonEntry:1219`). There is no re-runnable artifact reference and nothing verifies the hash still matches anything on disk.
- **G5 — no expiry for L4.** `verifiedProcedureLesson` rows are procedural-committed on one P6 pass and re-injected for **any** later brief that ranks them (`selectLessons` phase fallback, `:799-800`); nothing scopes them to the domain/brief that proved them, and `LESSON_RETIRE_COUNTER = 3` (`:686`) only retires on *counter-evidence*, which nothing generates automatically for a passing lesson.

---

## 2. The good-vs-bad decision procedure to implement

### 2.1 The three authority tiers (who is allowed to say what)

The repo already separates these; the procedure below only *names* the separation and fixes the verdict vocabulary.

| Tier | Authority | Concrete carriers today | May it write a lesson? |
|---|---|---|---|
| **D — deterministic gate** | a machine probe over recorded artifacts; no model in the loop | `dod.ts` `GateItem.probe` (`:32`) evaluated by `runGate` (`:550`); `p6-verified` requires `lastTest.label === "tested"` **and** a non-empty `evidenceHash` (`:401-419`); machine-run cases in `verify.server.ts`; `fixtureApprovalGate` + `BRIEF_FIXTURE_DECIDED_BY` discipline (`brief-fixtures.ts:41-59, 30-33`) | yes — L2/L4 rows (`engine.ts:1388`, `verify.server.ts:780`) |
| **M — machine-evidenced, non-gating** | a run recorded something reproducible, but it is not a DoD probe | `diagnose.ts` ranked cause + evidence indices; `gate-stats.ts` approval health; `bench.ts`; `algo-tools.ts` complexity heuristic (`COMPLEXITY_CAVEAT:282-283`) | yes, as *advisory* rows only |
| **A — advisory/LLM** | model prose or heuristic guess | LLM patch text in the verify loop, lesson audit proposals, harvest trend notes (`harvest.ts:593-596`), lint findings rendered as "advisory" (`verify.server.ts:270`) | **no** — advisory text may inform a human, never mint a rule |

### 2.2 The verdict ladder (the procedure the agent must implement)

Input: an artifact set for one phase + the phase's `GateItem[]` + whatever machine evidence exists.
Output: exactly one verdict, stamped with the **evidence triple** (§2.4). Order is strict — later rules never override earlier ones.

1. `blocked:hitl` — a human-only gate is open. Evidence must be an approval-row read via `approvalActor` (`dod.ts:54-58`) **carrying a real actor distinct from the producing agent**, per `100_factory_blockers.md` P0-01 (`headless.ts:734` mints `decidedBy:"human"`; guard only on the `--force` path at `rapidtool-cli.mjs:517-521`). *Never mint an approval; never treat a completed phase record as approval (P0-02, `dod.ts:337/349/471/483` + `:47-48`).*
2. `fail:deterministic` — any Tier-D probe is unmet (`runGate` → `!pass`) or a machine-run case fails. Unmet criterion **ids and verbatim criteria** are the evidence, exactly the shape `lessonEvidenceDetail` already produces (`knowledge.ts:760-774`).
3. `pass:machine-evidenced` — every Tier-D probe met *and* at least one probe was non-vacuous with a recorded `evidenceHash` (the `p6-verified` pattern). A phase that passes only because a probe was vacuous (e.g. `p6-brief-fit` returning `true` for a vocabulary-free brief, `dod.ts:417-428`) is downgraded to the next rung.
4. `pass:deterministic-only` — all probes pass but nothing was machine-verified. Honest label required in any human-visible text; this is the state keyless runs occupy by design (`gates.test.ts:111-117` pins that the deterministic floor must **not** satisfy `p6-verified`).
5. `advise:risk` — no probe failed, but Tier-M evidence names a risk (lint, complexity heuristic, trend note, a `p6.synthesis.refused` tail, an approval-health `rubber` flag). May annotate, may not gate.
6. `refuse:no-proof` — the claim cannot be tied to any artifact/row. This is the honest floor; it must be *recorded*, not silently dropped (mirrors `diagnose.ts`'s `none-detected` and `isStubSource`/`isReexportOnlySource` honesty probes at `dod.ts:113-139`).

**Never self-certify (hard prohibitions, each already proven in this repo):**

| Prohibited act | Why (evidence) |
|---|---|
| Minting an approval row, or accepting a phase-complete record as approval | P0-01 `headless.ts:734` / guard only at `rapidtool-cli.mjs:517`; P0-02 `dod.ts:47-48` vs the criteria at `:337,349,471,483` |
| Being both producer and judge of the same code | P0-03 (`wild-mode.server.ts:32` classifier vs `codegen.server.ts:133` producer); and LLM self-preference is measurable (Panickssery et al., arXiv:2404.13076) |
| Judging by "intrinsic" self-critique with no external signal | Huang et al. arXiv:2310.01798: without external feedback LLMs "struggle to self-correct… performance even degrades" |
| Flipping a fixture/oracle case to approved | `brief-fixtures.ts:30-47`: `decidedBy` is never defaulted to `"human"`; only an explicit human-invoked `approveFixtureCases()` may flip a case, and the drafter never calls it |
| Promoting a lesson on an unknown maker score | `shouldPromoteLesson` (`knowledge.ts:812-818`) returns false when `next` is not a finite number — keep it that way for every *new* promotion path |
| Writing "verified" without an evidence hash | `p6-verified` (`dod.ts:401-419`) is the precedent: label **and** non-empty hash, or the probe stays unmet |

### 2.3 Evidence triple (mandatory on every verdict and every stored lesson)

1. **Reproduce** — the command/verb that regenerates the verdict (e.g. `runGate(project, phase)`, `verify.server` cases, `diagnose`), or the exact probe id from `dod.ts`'s `DOD` map (`:285`).
2. **Bind** — a content hash over the artifact *as judged* (the repo's own convention: FNV-1a 32-bit, `algorithms.ts:1096-1103`, and `p6-verified`'s `evidenceHash`).
3. **Anchor** — the ledger row that owns it: a `JsonLog` row (`lessonLog`, `knowledge.ts:1052-1062`), a phase record id, or a `HitlDecision.id`.

A claim with fewer than three is `refuse:no-proof`. This is the same idea as proof-carrying code — the artifact travels with a checkable certificate and the host re-verifies rather than trusting the producer (Wikipedia, *Proof-carrying code*), and it is the structural fix for the actor-seam problem (Wikipedia, *Separation of duties*: more than one party required to complete a task).

### 2.4 Honest labels the agent must emit (no new vocabulary invented)

Reuse what exists: `source:"illustrative"` = scaffolding not fact (`AGENTS.md` honesty contract §1); `RT_E_*` codes from `errors.ts` on every surfaced failure (`AGENTS.md` §4); keyless ⇒ deterministic floor + honest envelope, never fabricated model text (§2); `sealedWithFailures` / `sealHonesty` (`dod.ts:661`, `engine.ts:1171-1177`) so a red seal can never print like a clean one.

---

## 3. Durable memory design — remembering the difference FOREVER

Design constraint: extend the store that exists (`knowledge.ts:291-659`) rather than add a new one. All proposed fields are **optional**, so every legacy store keeps scoring byte-identically — the module already promises that for `counterEvidence`/`supersedes` (`knowledge.ts:479-481`) and achieves it with the "absent field = empty string = legacy hash" trick at `:282-288`.

### 3.1 What to store — pattern → verdict → evidence → provenance

```ts
// Additive block on KnowledgeEntry (knowledge.ts:138-168) — kinds unchanged (brief|pattern|fix|note)
verdict?: "fail:deterministic"        // the §2.2 ladder value; the lesson's *authority class*
        | "pass:machine-evidenced"
        | "pass:deterministic-only"
        | "advise:risk"
        | "refuse:no-proof";
evidence?: {                          // CONTENT — a different proof is a different claim
  reproduce: string;                  // the command/verb or probe id that regenerates the verdict
  hash: string;                       // FNV-1a over the artifact AS JUDGED (fnv1a, algorithms.ts:1096)
  anchor: string;                     // ledger anchor: JsonLog event+ts | phase record id | HitlDecision.id
};
scope?: { domain?: string; phase?: PhaseId; briefSignature?: string };  // CONTENT
// TELEMETRY (never fingerprinted, mutated like counterEvidence, knowledge.ts:630-641):
reproducedCount?: number;  // how many later runs independently reproduced the claim
verifiedAt?: string;  // last successful `lesson verify` re-hash
stale?: boolean;      // set by `lesson verify` when the anchor no longer hashes to `evidence.hash`
```

Why the content/telemetry split is load-bearing: the fingerprint (`:274-289`) *is* the identity, so anything volatile inside it forks rows; anything stable outside it lets two different claims collapse into one. `verdict`/`evidence`/`scope` are claims ⇒ content. Counters and timestamps are observations *about* the claim ⇒ telemetry.

**What must NOT be stored:** model prose as a fact. The one place the repo already does this correctly is the L3 hypothesis, which is fenced behind a literal marker and labelled ("is model prose (Reflexion turn) and is stored ONLY behind the literal `| hypothesis:` marker — honest labeling, never as fact", `knowledge.ts:932-935`). Every new field inherits that discipline: prose goes in `body`/text, never in `verdict`/`evidence`.

### 3.2 Retrieval — making the right row appear at the right moment

Four retrieval triggers, all deterministic, all reusing the existing ranker:

| Trigger | Query construction | Filter | Cap |
|---|---|---|---|
| **phase open** | planned brief text | `selectLessons(memory, phase, …)` (`knowledge.ts:784-805`) — already phase-preferred | 2 |
| **brief similarity** | the brief | `rankBriefLessons` → `fusionRank` (`:90-122`) | `EXPAND_LESSON_RANK_LIMIT` 5 (`:44`) |
| **refusal / unmet gate** | RT_E code + unmet criterion **ids** (not the prose) | `verdict.startsWith("fail:")` + `scope.phase` match | 3 |
| **repeat failure** | the failure signature (§4.2) | exact signature match, then `reproducedCount >= 1` | 1, escalated to the human queue |

Ranking rule to add (one line, additive, deterministic): a row carrying a *valid* evidence triple outranks an equally-scored row without one — mirroring the existing "cited boost" that gives `source:"research"` +0.15 (`algorithms.ts:539-546`). Same shape, different evidence class: proved > asserted.

Retrieval-quality facts worth honouring (fetched): decomposition by session/value granularity, fact-augmented key expansion and time-aware query expansion measurably improve recall (LongMemEval, arXiv:2410.10813) — RapidTool's cheapest version of "fact-augmented keys" is indexing the **structured signature tokens** (criterion ids, RT_E codes, `domain:`/`gate:` tags — the tag convention already exists at `knowledge.ts:1009`, `:1276`) alongside the body text, without touching the stemmer.

### 3.3 Provenance and proof-carrying lessons

Every promoted row must carry the §2.3 triple, and the triple must be *checkable later*:
- `lesson --verify` (new, **read-only by default**): for each T2 row, re-hash the artifact named by `evidence.anchor` when it resolves to a file; print `ok | stale | anchor-missing`. `--mark-stale` is the only mutating form and writes telemetry only.
- The packet's Ranked-memory section (`packet.ts:430-469`) prints `stale` next to the row so a human sees a decayed proof instead of trusting it.
- Frame: the artifact travels with a certificate the host re-checks instead of trusting the producer (Wikipedia, *Proof-carrying code*); the human seat stays mandatory because two parties must complete the task (Wikipedia, *Separation of duties*).

### 3.4 Poisoning guards — the failure mode is documented, not hypothetical

| # | Guard | Evidence / rationale |
|---|---|---|
| P1 | **No machine path writes T2.** Keep `lesson --accept` as the only T2 writer (`rapidtool-cli.mjs:1681-1683`). A machine write path re-opens exactly the hole the actor-seam blocker describes (`100_factory_blockers.md` P0-01). | repo law + P0-01 |
| P2 | **Lessons require an external signal.** A row may be minted only from Tier-D/M evidence (a gate probe result, a machine-run case, a refusal code, a human decision) — never from a model's own critique. | Huang et al. 2023 (arXiv:2310.01798): intrinsic self-correction without external feedback does not reliably work and can degrade results; Reflexion's own gains come from *task feedback signals* (Shinn et al., arXiv:2303.11366) |
| P3 | **Producer ≠ promoter.** The agent that wrote the code may not promote the lesson about it; promotion is human (`--accept`) or a *later* run's machine evidence. | Panickssery et al. 2024 (arXiv:2404.13076) — self-preference is measurable: an LLM evaluator rates its own outputs higher |
| P4 | **Soak before durable.** New rows land in T1 with a `probation` tag; promotion requires `reproducedCount >= 1` (the claim recurred in a later run) **or** an explicit human accept. | Reflexion keeps reflections in an *episodic buffer* and re-uses them only for subsequent trials (arXiv:2303.11366) — trial-scoped, not immediately canonical |
| P5 | **Lessons may never widen a pass.** A lesson can add advisory context and can *narrow* (add "do not do X"), never relax a Tier-D probe. Enforce by construction: no lesson text ever reaches `dod.ts` probe inputs (today true — lessons reach only prompt text, `prompt-engine.ts:215-216`). | Memory/RAG poisoning is a live attack class: AgentPoison poisoned memories divert agent actions (Chen et al., arXiv:2407.12784); PoisonedRAG shows a handful of injected texts can steer retrieved answers (Zou et al., arXiv:2402.07867) |
| P6 | **No autophagous loop.** A lesson's evidence may never be another lesson's output, and generated code may never be the evidence for a pass about generated code. | Self-consuming generative loops degrade (Alemohammad et al., arXiv:2307.01850, "MAD") |
| P7 | **Abstain rather than guess.** When retrieval has no live row, emit "no lesson" (the `diagnose.ts` `none-detected` floor at `diagnose.ts:1-20` is the in-repo precedent) instead of the top-scoring weak row. | LongMemEval lists *abstention* as a core long-term-memory ability and shows a ~30% accuracy drop for sustained interaction (arXiv:2410.10813) |

### 3.5 Expiry, repair, contradiction (never deletion — append-only)

- **Existing:** `decayFactor = 0.5 ** counterEvidence` (`knowledge.ts:607-610`), retire at `LESSON_RETIRE_COUNTER = 3` (`:686`, `:613-615`), supersede exclusion built from other rows' `supersedes[]` (`:617-626`), and both telemetry writers are documented as ledger-first, writer-only (`:594-599`).
- **Add — verification TTL for `pass:machine-evidenced` rows.** An L4/procedural row is a *proof about one artifact* (`verifiedProcedureLesson`, `:966-985`); it should decay on artifact change: `lesson --verify` recomputes the anchor hash and marks `stale`, and a stale procedural row drops out of the phase-open trigger (stays readable, never deleted, still visible with its flag).
- **Add — contradiction ⇒ supersede, not refute.** Bumping `counterEvidence` (`:631-641`) is the soft path; when a *proved* row contradicts an older one, mint the append-only superseding row (`buildSupersedeEntry`, `:1229-1247`) + `markSuperseded` (`:646-658`) so the pair stays auditable. (Supersede is already restricted to the verified-L4-contradiction path in the caller, per the note at `:1226-1228` — keep that restriction.)
- **Knowledge-update semantics (fetched):** long-term memory benchmarks treat *knowledge updates* as a first-class ability separate from recall (LongMemEval, arXiv:2410.10813); a store that only appends and never resolves contradictions will answer with the stale fact. Supersede chains are RapidTool's answer — they must be *required*, not optional, when a contradicting proved row lands.

### 3.6 Consolidation (the "sleep on it" step)

- **Existing:** `consolidatedRunNote` (`:1255-1280`) fires under memory pressure (`pressureAt`, `:1045-1047`) when ≥3 same-class rows exist in a phase — a self-project note that survives the FIFO, with self-exclusion from `injectProven` preventing a self-feedback loop.
- **Add — offline consolidation as a read-only verb.** `--consolidate` reads the run's NDJSON log + T1 memory and emits *candidate* T2 rows for human accept. Rationale: pre-computing useful quantities offline reduces the compute needed at query time and improves answer quality (sleep-time compute, Lin et al., arXiv:2504.13171); agentic memory that links and *updates* notes beats fixed store structures (A-Mem, Xu et al., arXiv:2502.12110).
- **Add — induce procedures from successes, not only failures.** Voyager's library commits a skill only after the program is verified (Wang et al., arXiv:2305.16291 — RapidTool's `verify.server.ts:780` L4 mint is already this shape); workflow induction from past trajectories generalizes to unseen tasks (Agent Workflow Memory, Wang et al., arXiv:2409.07429). This is the same mechanism as **experience replay**: reuse a *verified past trajectory* rather than re-deriving it.
- **Add — learn from failures by pairing, not venting.** The strongest empirical setting is learning from *both* success and failed explorations (ETO, Song et al., arXiv:2403.02502); and for code specifically, the signal that works is **execution feedback**, not self-explanation (Self-Debugging, Chen et al., arXiv:2304.05128 — and where unit tests exist, the gain is largest). RapidTool's verify loop already produces exactly that pair (fail → model patch → re-run), so the pair must be recorded together.

---

## 4. Learn-from-mistakes spec: capture → dedupe → prove → consult

### 4.1 Capture — turn the failure log into a record (smallest changes)

The raw material exists (§1.4). The missing object is a **normalized failure record**; everything below is a small change at an existing site.

```ts
// NEW pure type + helper in src/lib/knowledge.ts (next to lessonRow, :715)
export type FailureRecord = {
  kind: "gate-unmet" | "verify-failed" | "synthesis-refused" | "rejected" | "harvest-degraded" | "drift";
  phase: PhaseId;
  signature: string;      // deterministic, normalized (§4.2) — the ONLY thing hashed into the id
  classCode: string | null;   // RT_E_*
  anchors: string[];      // failing case ids | unmet criterion ids | artifact row ids  (≥1 required)
  evidenceHash: string;   // fnv1a over the judged artifact (the p6-verified convention, dod.ts:401-419)
  detailTail: string;     // volatile human-readable tail — stored as TEXT, never in the id
};
```

Exact sites to touch (each is a signature/argument change, not a rewrite):

| Site | Change |
|---|---|
| `src/lib/verify.server.ts:796-801`, `:833` (failed/exhausted) and `:761` (error) | build the record from data already in hand: `run.results.filter(r => !r.pass).map(f => f.id)` are the anchors; the existing evidence string stays the row text |
| `src/lib/engine.ts:1358-1388` (L2 seal) | signature = (phase, sorted unmet **criterion ids**, refusal `RT_E` code); the digest/tail stays out of the id |
| `src/lib/report-intake.ts:344-372` (agent-report L2) | same signature rule; it already has `unmet` ids |
| `src/lib/harvest.ts:688-728` | signature = (reason, phase); the detail/notes stay text (they carry prose and limits) |
| `src/lib/knowledge.ts:992-1011` (L5 correction) | add the `HitlDecision.id` as an anchor so the correction is traceable to a ledger row |
| `scripts/rapidtool-cli.mjs:1503` | new read-only subverbs: `lesson --advise` (consult, §4.4) and `lesson --verify` (§3.3) |

### 4.2 Dedupe — the verified defect this fixes

Today the L3 row id is `lesson-verify-failure-<fnv8(text)>` where the text embeds the **free-text evidence** and the iteration count (`knowledge.ts:936-962`, text built at `:950-952`, hash at `:945`). The evidence string minted by the verify loop contains per-run case details and, on a refusal path, the model's own prose tail (`verify.server.ts:797-801`; `engine.ts:1199-1215` digest format). Consequence: **the same failure with a different tail is a different lesson**, so a repeated failure forks a new row each run instead of accruing evidence — and every fork pushes an older lesson toward the 80-row FIFO eviction (`engine.ts:1331`).

Normalization rules for `signature` (each rule is a deterministic string op, no LLM):
1. anchors: **sorted, de-duplicated ids only** (case ids, criterion ids) — ids are already stable compared to their human details;
2. paths → basenames; strip line/column numbers; strip hex digests (they belong in `evidenceHash`);
3. numbers inside prose ("after 3 iterations", "chunk 2/4") → collapse to a placeholder (iteration counts and chunk indices are *process* noise, not part of the failure);
4. `classCode` (the RT_E code of the refusal, `engine.ts:1217-1219`) is in; `detailTail` is out;
5. all whitespace collapsed, lowercased for the hash input only.

Then `id = lesson-<classShort>-<fnv8(signature)>` — the id *shape* stays `^lesson-<class>-[0-9a-f]{8}$`, which is what the tests actually pin (`lesson-writers.test.ts:75`, `:95`, `report-intake.test.ts:259`, `harvest.test.ts:637-689`, `knowledge.test.ts:353`). Test risk: **LOW** — only a test that asserts fork-on-different-evidence can break; grep for that before landing (none found in this pass: `lesson-writers.test.ts:116` asserts the opposite — idempotence).

### 4.3 Prove — a lesson without a counterexample is not a lesson

- **fail rows:** require ≥1 anchor. No named failing case id / unmet criterion id ⇒ `refuse:no-proof`, and the honest handling is a *log row*, not a lesson (`lessonLog`, `knowledge.ts:1052-1062`). The counterexample is the proof: this is the "execution feedback, not self-explanation" result (Self-Debugging, arXiv:2304.05128) applied to memory.
- **pass rows (L4):** require the anchor + `evidenceHash` — the `p6-verified` pattern, which refuses a bare label and demands `lastTest.label === "tested"` **and** a non-empty hash (`dod.ts:401-419`; the corresponding "verified-procedure" lesson is minted at `verify.server.ts:780`).
- **Bind to the artifact, not to the story:** `evidenceHash` must be computed over the judged source (the repo's FNV-1a convention, `algorithms.ts:1096-1103`), so a future `lesson --verify` can detect that the proof no longer holds (§3.3). One trap to avoid: the *hash* must not be the *id* — today's L3 text includes `evidenceHash=` **and** the free evidence inside the id input, which is the fork mechanism in §4.2.
- **Self-reference guard (proved blocker):** never let a lesson's proof be a phase record's completeness when the claim is about human approval — the P0-02 pattern (`dod.ts:47-48` testing `status === "complete"` for a criterion that asserts "HITL approved", `:337/349/471/483`). Any new criterion or lesson derived from an approval must assert the actor + provenance of the approval row, not a status.

### 4.4 Consult — how a future run actually reads the lesson

Three consult points, cheapest first:

1. **Pre-flight (new, read-only, highest leverage).** `lesson --advise --phase 6 --brief "…" [--project p.json]` → T2 `findPatterns` (`knowledge.ts:482-556`) filtered to `verdict.startsWith("fail:")` + `scope.phase`, ranked by the brief, printed with `reproducedCount` and `stale` flags. Rationale: recall at the *start* of the task, not after the failure (ExpeL retrieves experiences at inference time, Zhao et al., arXiv:2308.10144 — and RapidTool's own tier-2 seams already do this for T1/T3, `codegen.server.ts:1326-1328`).
2. **Prompt injection (exists — extend the source).** Today expansion lessons come from T1 only: `selectLessons(project.memory, 6, EXPAND_LESSON_RANK_LIMIT)` → `lessonLinesForBrief` (`codegen.server.ts:1326-1328`, `:1399-1401`, `:1606-1608`; engine path `engine.ts:600-603`). The T2 → prompt bridge exists but only offline via `packet --knowledge` (`rapidtool-cli.mjs:668-690` → `packet.ts:191-195`). Smallest change: thread the same `proven` rows (`rankBriefLessons`'s existing `opts.proven` parameter, `knowledge.ts:93`) into those three call sites when a store path is configured — the ranking code already supports it; only the plumbing is missing.
3. **Post-pass commit.** On a machine pass, mint L4 with the triple (`verify.server.ts:780`) so the *successful* shape is the thing learned — Voyager's commit-on-verify (arXiv:2305.16291) and AWM's workflow induction (arXiv:2409.07429) are the same move: persist what *worked*, and let replay apply it next time.

### 4.5 What this spec deliberately does NOT fix (honest limits)

- Paraphrase recall (G2) — no embeddings are introduced here; the docs' honest label stands (`knowledge.ts:16-20`).
- Autonomous T2 writes — stays human-gated by design (P1). Autonomy must come from *lowering the cost* of the human click (better candidates, `reproducedCount`, `--advise` previews), not from removing the seat. `100_factory_blockers.md` P0-06 shows why: a machine-minted human seat plus self-referential criteria compose into a loop that approves itself.
- Within-run memory depth — the 80-row FIFO is a context-budget decision, not a bug; consolidation (§3.6) is how durable content escapes it.

---

## 5. Algorithm/function improvements (before → after + the test that proves it)

Six candidates, ordered by strength of evidence. **F1, F4, F5 were reproduced by executing the repo's own code this pass** — raw output quoted; nothing here is inferred from reading alone.

### F1 — `estimateTokens` cache is keyed by a 32-bit hash: a real, reproduced wrong answer *(highest value)*

**Current behaviour** (`src/lib/algorithms.ts:1068-1093`): `const tokenEstimateCache = new Map<number, number>()`; the key is `fnv1a(text)` (`:1073`) — a 32-bit FNV-1a (`:1096-1103`). Two different texts that collide return each other's token count. Collision is not hypothetical — found and pinned this pass:

```
fnv1a("rjmr")                            = 933450742
fnv1a("lasipzafzrmsnlpmtfnstxtvfmtmnet") = 933450742      // equal
```

Reproduced against the live module (read-only, no writes):

```
# long string computed first, short word second
estimate(B)                = {"tokensEst":16,"tokensLo":14,"tokensHi":18}
estimate("rjmr") after B   = {"tokensEst":16,...}     // WRONG — true value is 3
# fresh process, short word first
estimate("rjmr")           = {"tokensEst":3,"tokensLo":3,"tokensHi":3}
estimate(B) after "rjmr"   = {"tokensEst":3,...}      // 31-char string reported as 3
```

**Why it matters:** `estimateTokens` is the *ground truth* for prompt budgeting by its own comment — `enforceTokenBudget` truncates against it (`crew.server.ts:275-290`) and `promptTokens` is reported from it (`crew.server.ts:1057`, `:1264`). A 31-char string under-reported as 3 tokens (5.3× low) means a prompt can pass the budget check while being materially over it, and the reported number is wrong in the same direction as the truncation guard.

**Improved behaviour:** key the cache by the text itself (`Map<string, number>`, bounded at 100 — strings this short are cheap) or by a composite `length + "\u0000" + fnv1a(text)` key. Identical results for every non-colliding input.

**Proving test (new, `src/lib/algorithms.test.ts` — extend the B-21 block at `:464-500`):** pin the collision pair with a comment explaining *how* the pair was found; in one process call `estimateTokens(B)` then `estimateTokens(A)` and assert both equal their fresh-process values (assert `{tokensEst:16}`/`{tokensEst:3}`; the exact expected numbers must be re-verified on the branch that lands it, since the tokenizer owns them), plus `assert.equal(fnv1a(A), fnv1a(B))` as the tripwire that keeps the pair valid.
**Non-breaking:** yes — no output changes except for colliding pairs, where the new output is the correct one. **Test risk: LOW.**

### F2 — `fusionRank` re-tokenizes inside the sort comparator (byte-identical fix)

**Current** (`algorithms.ts:521-528`): the per-kind sort comparator computes `overlap(q, tokenizeWords(a.text))` and `overlap(q, tokenizeWords(b.text))` on **every comparison**, then line `:528` tokenizes the item a third time. `tokenizeWords` = regex match + `canonicalStem` per token (`:1150-1155`, `:1139-1147`). Total tokenization work is O(k log k · L) per kind instead of O(k · L) for k rows of length L.

**Improved:** tokenize each row once into a parallel `{row, toks}` list; reuse `toks` in the comparator and in the scoring pass. Scores and order are **byte-identical** because `tokenizeWords` is pure and deterministic.

**Proving test:** (a) hard gate — freeze the current output (id/score/kind, in order) for a mixed corpus as a fixture and assert deep-equal after the change (extend the determinism test at `algorithms.test.ts:210-211`); (b) advisory — a `src/lib/bench.ts` bench over ~2,000 synthetic rows.
**Non-breaking:** yes. **Test risk: LOW.**

### F3 — `contiguousRun` is O(|row|·|q|) with restarts; KMP makes it linear (byte-identical)

**Current** (`algorithms.ts:445-456`): for every start index in the row, walk forward while `q[j] === row[i+j]`. Degenerate inputs (`row` all one token, `q` = that token repeated) drive the quadratic case.

**Insight (equivalence, stated so the change is provably safe):** "longest contiguous in-order run of `q` inside `row`" **is** "length of the longest prefix of `q` that occurs as a contiguous substring of `row`" — exactly what one KMP pass computes, in O(|q| + |row|).

**Proving test:** differential property test in `algorithms.test.ts` — a naive reference implementation kept in the test file, 10,000 pseudo-random token-sequence pairs (seeded, deterministic), assert equal results; plus the existing phrase-boost assertions must stay green.
**Non-breaking:** yes. **Test risk: LOW-MEDIUM** (only if some caller depended on the quadratic *shape*, which nothing can observe).

### F4 — the stemmer breaks `-ies` plurals: `policies` never matches `policy` *(reproduced; behaviour change — needs a decision)*

**Current** (`algorithms.ts:1111-1134`): the suffix loop strips `ing|ed|es|s` but there is no `-ies → y` rule, and `canonicalStem` (`:1139-1147`) merely iterates. Reproduced this pass:

```
canonicalStem("policy")   = "policy"      canonicalStem("policies")   = "polici"
canonicalStem("entity")   = "entity"      canonicalStem("entities")   = "entiti"
canonicalStem("query")    = "query"       canonicalStem("queries")    = "queri"
canonicalStem("delivery") = "delivery"    canonicalStem("deliveries") = "deliveri"
tokenizeWords("policies query") = ["polici","query"]
tokenizeWords("policy queries") = ["policy","queri"]     // zero overlap either way
```

**Why it matters here:** `tokenizeWords`/`canonicalStem` are the shared lexical core of `fusionRank`, `phraseHits`, `intentLattice` (`algorithms.ts:472-476`) and the vault search — so a brief that says "policies" scores 0 against every row that says "policy". No embeddings exist to paper over it (`knowledge.ts:16-20`).

**Improved:** before the suffix loop, `if (w.endsWith("ies") && w.length - 3 >= 3) w = w.slice(0, -3) + "y";` — `policies→policy`, `entities→entity`, `queries→query`, `deliveries→delivery`; `party`/`parts`-style words are untouched, and the existing pinned stems (`invoice→invoic`, `route→rout`, `scanning→scan`, `technology` untouched, `algorithms.test.ts:77-103`) are unaffected because none ends in `-ies`.

**Proving test:** a table test asserting `canonicalStem(pair[0]) === canonicalStem(pair[1])` for the four pairs above, plus a `fusionRank` test where a "policy" lesson must out-rank a decoy for the query "policies" (currently it cannot).
**Non-breaking:** **NO** — it deliberately raises scores for `-ies` pairs, so any golden pinning a score/order containing such a word changes. **Test risk: MEDIUM-HIGH**; land it as its own commit with an explicit re-baseline, or don't land it. Stated plainly because §5's contract is "no invented improvements"; this one is real but not free.

### F5 — `complexityOf` reports `O(1)` for loops inside template interpolations *(reproduced)*

**Current** (`algo-tools.ts:295-435` — `maskNonCode` masks strings/comments/templates/regex; its own doc says "template/regex-aware lexed view of the source, NOT a proof", `:263`): a loop inside `${…}` is masked away. Reproduced:

```
${items.map(i => { for (const x of items) { } return i; })}   → {"notation":"O(1)","loops":0,"maxNesting":0,...}
for (const x of items) { console.log(x); }                    → {"notation":"O(n)","loops":1,"maxNesting":1,...}
```

**Why it matters for judgment (§2):** this is a deterministic-looking number that can be *wrong in the optimistic direction*, exactly the class of proxy `102` warns about. Today `algo-tools.ts` has no non-test importer (verified: grep finds only self-references and a `prompt-engine.ts` comment), so the exposure is a workbench report — but a report that says O(1) about an n-loop is a false "good code" signal the moment it is wired to anything.

**Improved (two options, cheapest first):**
- **(a) honest minimum:** count template interpolations seen by the masker and, when > 0, append to `extras` ("N template-interpolation region(s) were masked; loops inside them are not counted") and add the count as a field. Keep the base `COMPLEXITY_CAVEAT` string **byte-stable**: the benchmark harness body embeds the report's *notation* (`algo-tools.ts:627-635`), and the tests assert individual report fields (`notation`, `lineRefs`, `caveat` contents via extras at `algo-tools.test.ts:143-193`), never a whole-object deep-equal.
- **(b) real fix:** unmask `${…}` bodies (the masker already tracks template state around `algo-tools.ts:357-380`) so interpolation code is scanned as code.

**Proving test:** a test asserting the interpolation case yields either the corrected notation (b) or `loops:0` **with** the new caveat flag (a) — i.e. the report can never claim O(1) silently again.
**Non-breaking:** (a) yes-additive (fields only, tests assert individual fields); (b) changes notation for such inputs only. **Test risk: (a) LOW, (b) LOW-MEDIUM.**

### F6 — `lineOf` is O(loops × source): a single pass is byte-identical

**Current** (`algo-tools.ts:492-498`): `lineOf(source, index)` scans from character 0 to `index`, and `complexityOf` calls it once per recorded loop (`:558`). Source of length n with k loops ⇒ ~n·k character steps.

**Improved:** keywords are visited in ascending index order (`kwRe.lastIndex = pos` only moves forward), so keep a running `(lineNo, cursor)` advanced to each `kwIdx` — O(n) total; or precompute newline offsets once and binary-search. `lineRefs` are byte-identical.

**Proving test:** existing exact-line assertions (`algo-tools.test.ts:146-193`) are the parity gate; add one synthetic source with many loops and assert `lineRefs` equals a naive oracle (plus an advisory bench).
**Non-breaking:** yes. **Test risk: LOW.**

### Deliberately NOT proposed

- **`fusionRank` tie-breaking.** Rows with equal scores currently fall back to `Array.prototype.sort` stability over an input-order-dependent list (`algorithms.ts:571`), and the id-dedupe keeps the first occurrence (`:572-581`). Adding an explicit tiebreak would change output order for ties — a *nicety*, not a defect, and it breaks the byte-parity rule this section is bound by. `findPatterns` already has the explicit tiebreak (`knowledge.ts:543-554`) where it is observable.
- **Any new JSON-parsing or LLM-judge heuristic for "good code".** `102` and `100` own those arguments; §2's answer is a stricter gate, not a smarter judge.

---

## 6. TASKS THIS IMPLIES

Sizes: S ≈ ≤½ day, M ≈ 1–2 days, L ≈ 3+ days (single-lane, disjoint-file). "Test risk" = chance of breaking an existing pinned expectation.

| # | Task | Why | Where (file:line) | Done when | Size | Test risk |
|---|---|---|---|---|---|---|
| **T1** | **Failure-signature ids for lesson rows** — hash the normalized signature (§4.2), keep the volatile tail as text | today the same failure forks a new lesson per run because the id hashes free-text evidence (`knowledge.ts:936-962`) and the 80-row FIFO (`engine.ts:1331`) evicts real lessons | `src/lib/knowledge.ts:715-743`, `:936-962`; `src/lib/verify.server.ts:796-801`, `:833`, `:761`; `src/lib/engine.ts:1358-1388`; `src/lib/report-intake.ts:344-372` | a repeated failing verify produces **one** row whose `reproducedCount` increments; id shape still `^lesson-verify-failure-[0-9a-f]{8}$`; `lesson-writers.test.ts` green | M | LOW |
| **T2** | **Anchors on every fail lesson (counterexample-or-nothing)** | "a lesson without a counterexample is not a lesson" (§4.3); no anchor ⇒ `refuse:no-proof` log row, no lesson | `src/lib/knowledge.ts:936-962` (signature/arg), callers as T1; `lessonLog` `:1052-1062` | a fail lesson with 0 anchors mints no row and a `lesson.refused` log lands; a case-id-anchored one does | S | LOW |
| **T3** | **Pure verdict helper** — `judgePhase(project, phase)` returning the §2.2 ladder verdict + evidence triple, reusing `runGate`/`failedGates`/`approvalActor` | the ladder exists implicitly; making it one pure function is what stops ad-hoc "looks good" judgments and keeps `refuse:no-proof` reachable | new `src/lib/judgment.ts` (+ colocated test); reuses `dod.ts:54-58`, `:550`, `:651` | a table test drives every rung: hitl-open, probe-fail, machine-evidenced, deterministic-only, advise-only, no-proof; no LLM anywhere in the module | M | LOW (new file) |
| **T4** | **Thread store rows into the expansion prompt** (`opts.proven` at the three expansion sites) | the ranker already accepts `proven` (`knowledge.ts:93`); only plumbing is missing, so cross-project lessons never reach a running prompt (G3) | `src/lib/codegen.server.ts:1326-1328`, `:1399-1401`, `:1606-1608`; `src/lib/engine.ts:600-603`; seam shape `packet.ts:191-195` | with a configured store path, an accepted lesson appears in the prompt's "Known failure modes" block, labelled by provenance; absent store ⇒ byte-identical prompt | M | LOW-MED (prompt bytes change when a store is configured — that is the point) |
| **T5** | **`lesson --advise` and `lesson --verify` (read-only verbs)** | consult *before* failing (§4.4) and detect decayed proofs (§3.3); both are read-only so they cannot open the P0-01 seam | `scripts/rapidtool-cli.mjs:1503` (`lesson` family), reuse `findPatterns` `knowledge.ts:482` | `--advise` prints ranked fail-lessons with `reproducedCount`/`stale`; `--verify` prints `ok|stale|anchor-missing` per row and never writes without `--mark-stale`; exit 0, single JSON object | M | LOW |
| **T6** | **Poisoning-guard predicates + tests** (P2/P5/P6/P7 as pure functions; P5 also as a static test) | make the guards executable instead of prose | new tests in `src/lib/knowledge.test.ts` (+ a predicate next to `shouldPromoteLesson` `knowledge.ts:812-818`) | a test proves no lesson `text` can reach any `dod.ts` probe input (P5), that a row with no external-signal evidence is not promotable (P2), and that empty retrieval yields `null`/"no lesson" rather than the top weak row (P7) | S | LOW |
| **T7** | **Fix the `estimateTokens` cache key (F1) + pinned collision test** | reproduced wrong answer; `enforceTokenBudget` trusts it (`crew.server.ts:275-290`) | `src/lib/algorithms.ts:1068-1093`; test at `algorithms.test.ts:464-500` | the pinned colliding pair returns each string's own estimate in both orders; non-colliding outputs unchanged | S | LOW |
| **T8** | **fusionRank/contiguousRun cost fix (F2+F3) with a frozen golden** | removes O(k log k) tokenizations and the quadratic restarts without changing a single score | `src/lib/algorithms.ts:467-583`, `:445-456` | golden fixture (ids+scores+order for a mixed corpus) deep-equals the pre-change output; differential KMP test green | M | LOW |
| **T9** | **Stemmer `-ies → y` (F4) — gated decision** | reproduced zero-overlap: `policies` ≠ `policy` across fusionRank/phraseHits/vault search | `src/lib/algorithms.ts:1111-1134` | pairs table test green **and** every affected golden re-baselined in the same commit with the diff called out in the fix log | S | **MED-HIGH** — do not bundle with T8 |
| **T10** | **`complexityOf` honesty for masked template interpolations (F5) + `lineOf` single pass (F6)** | the report can claim O(1) about an n-loop (reproduced); and the line scan is O(loops×n) | `src/lib/algo-tools.ts:295-435` (masker), `:492-498` (`lineOf`), `:558` (call site) | interpolation case can no longer claim O(1) silently; `lineRefs` parity with the existing exact-line assertions; base `COMPLEXITY_CAVEAT` string unchanged | S–M | LOW |
| **T11** | **Contradiction ⇒ mandatory supersede, and a `--consolidate` candidate generator (read-only)** | keeps "knowledge update" semantics honest (LongMemEval's update ability) and lets durable content escape the FIFO via a human click | `src/lib/knowledge.ts:1229-1247` (supersede builder), `:1255-1280` (consolidation), `:1045-1047` (pressure); CLI `scripts/rapidtool-cli.mjs:1503` | a proved row contradicting an older proved row produces a supersede pair (never an in-place edit); `--consolidate` emits candidates and writes nothing | M | LOW |
| **T12** | **Document the judgment contract in `AGENT_GUIDE.md`** — the §2.2 ladder, the never-self-certify table, the evidence triple | the procedure is only real if an agent can read it before acting; today the honesty contract covers fabrication, not *judgment authority* | `AGENT_GUIDE.md` (new section); cross-link `research/multiagent/100_factory_blockers.md` P0-01/02/03/06 | the guide names the six verdicts, the three tiers, and the prohibited acts with their in-repo evidence | S | none (docs) |

**Suggested wave order (disjoint files, no shared contract changes):** T7 → T10 (pure algorithm lanes) ∥ T3 → T6 (new judgment/guard lane) → T1/T2 (lesson writers) → T4/T5 (plumbing + CLI) → T11 → T9 alone (re-baseline commit) → T12 (docs last, describing what landed).

---

## 7. References (every URL fetched this pass, 2026-09-16)

**Research (arXiv API abstracts unless noted):**
- Reflexion — Shinn, Cassano, Berman et al., *Reflexion: Language Agents with Verbal Reinforcement Learning* (2023-03-20) — https://arxiv.org/abs/2303.11366
- Huang, Chen, Mishra et al., *Large Language Models Cannot Self-Correct Reasoning Yet* (2023-10-03) — https://arxiv.org/abs/2310.01798
- Panickssery, Bowman, Feng, *LLM Evaluators Recognize and Favor Their Own Generations* (2024-04-15) — https://arxiv.org/abs/2404.13076
- Chen, Xiang, Xiao et al., *AgentPoison: Red-teaming LLM Agents via Poisoning Memory or Knowledge Bases* (2024-07-17) — https://arxiv.org/abs/2407.12784
- Zou, Geng, Wang et al., *PoisonedRAG: Knowledge Corruption Attacks to Retrieval-Augmented Generation* (2024-02-12) — https://arxiv.org/abs/2402.07867
- Wu, Wang, Yu et al., *LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory* (2024-10-14) — https://arxiv.org/abs/2410.10813
- Zhong, Guo, Gao et al., *MemoryBank: Enhancing Large Language Models with Long-Term Memory* (2023-05-17, Ebbinghaus forgetting-curve-inspired updating) — https://arxiv.org/abs/2305.10250
- Park, O'Brien, Cai et al., *Generative Agents: Interactive Simulacra of Human Behavior* (2023-04-07) — https://arxiv.org/abs/2304.03442
- Wang, Xie, Jiang et al., *Voyager: An Open-Ended Embodied Agent with Large Language Models* (2023-05-25) — https://arxiv.org/abs/2305.16291
- Zhao, Huang, Xu et al., *ExpeL: LLM Agents Are Experiential Learners* (2023-08-20) — https://arxiv.org/abs/2308.10144
- Wang, Mao, Fried et al., *Agent Workflow Memory* (2024-09-11) — https://arxiv.org/abs/2409.07429
- Song, Yin, Yue et al., *Trial and Error: Exploration-Based Trajectory Optimization for LLM Agents* (2024-03-04) — https://arxiv.org/abs/2403.02502
- Chen et al., *Teaching Large Language Models to Self-Debug* (2023-04-10, execution feedback; best gains where unit tests exist) — https://arxiv.org/abs/2304.05128
- Xu, Liang, Mei et al., *A-MEM: Agentic Memory for LLM Agents* (2025-02-17) — https://arxiv.org/abs/2502.12110
- Lin, Snell, Wang et al., *Sleep-time Compute: Beyond Inference Scaling at Test-time* (2025-04-17) — https://arxiv.org/abs/2504.13171
- Chhikara, Khant, Aryan et al., *Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory* (2025-04-28) — https://arxiv.org/abs/2504.19413
- Maharana, Lee, Tulyakov et al., *Evaluating Very Long-Term Conversational Memory of LLM Agents* (2024-02-27) — https://arxiv.org/abs/2402.17753
- Alemohammad, Casco-Rodriguez, Luzi et al., *Self-Consuming Generative Models Go MAD* (2023-07-04) — https://arxiv.org/abs/2307.01850
- Madaan, Tandon, Gupta et al., *Self-Refine: Iterative Refinement with Self-Feedback* (2023-03-30) — https://arxiv.org/abs/2303.17651

**Framing concepts (Wikipedia REST summaries):**
- *Proof-carrying code* — https://en.wikipedia.org/wiki/Proof-carrying_code
- *Separation of duties* — https://en.wikipedia.org/wiki/Separation_of_duties

**In-repo precedents this spec builds on (no new mechanism invented):** `research/multiagent/100_factory_blockers.md` (P0-01/02/03/06), `102_code_quality_signals.md` (signal ranking + proxy caveats), `89_self_learning_research.md` (memory-system fact cards), `src/lib/knowledge.ts` (store + lesson tier), `src/lib/dod.ts` (probe gates), `src/lib/verify.server.ts` (machine verify loop), `src/lib/algorithms.ts` (fusionRank/stemmer), `src/lib/algo-tools.ts` (complexity heuristic), `src/lib/diagnose.ts` / `gate-stats.ts` (evidence ranking + approval health).

**UNVERIFIED / not asserted anywhere above:** whether RapidTool's shipped keyed runs actually reproduce the L3 fork rate claimed in §4.2 (not measured — no run was executed this pass); whether any deployment wires `algo-tools.ts` behind a CLI verb (grep found no importer, but a dynamic import could exist outside the searched globs); the exact token-count expectations for the F1 test on the landing branch (the tokenizer owns those numbers — re-verify, do not copy them from this doc blindly).
