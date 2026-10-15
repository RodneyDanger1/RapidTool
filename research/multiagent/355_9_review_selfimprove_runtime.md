# 355-9 — lane `reviewer-selfimprove` · the self-improvement substrate: correctness, safety, validity

**Lane:** `reviewer-selfimprove` (W355, lane 6 of 7 — the gap-filling batch 355b). **Kind:** read-only code review.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (path contains a space). **Host:** Windows·PowerShell 5.1 · Node **v24.15.0**.
**HEAD:** `30bce78` on `main`, dirty (98 modified + the wave's new untracked files).
**Wrote exactly one file:** this one. No product file, doc, register, or sibling report was edited. No `npm test`,
`npm run build`, `gate.sh`, keyed LLM call, or git write was made. `selfmod` was never invoked.

> **Premise discipline.** The structural map is `cartographer`'s (`355_6_architecture_map.md`) and is **cited, not
> rebuilt**. This lane audits *behavior*: closure, safety, validity, bounds. Where a doc and the bytes disagree the
> bytes win. Every absence claim carries the query that shows absence.
>
> **This lane's scope files were almost all untouched by the 354 wave.** `git status --short` over my scope returns
> exactly five modified files — `algorithms.ts`, `judgment.ts`, `research.ts`, `sandbox.ts`, `wild-review.ts` — so
> nearly everything below is baseline `30bce78` bytes, not wave churn.

---

## 1. Method — exact commands

Every claim is a read (`read_file` / `grep` on the named path) or one of these commands, run in
`C:\Users\mnril\Desktop\RapidTool Main` this session.

```powershell
# scope inventory
Get-ChildItem src\lib -Filter "<name>.ts" | …            # line counts for all 52 scope modules
git status --short -- src/lib/selfmod.ts … src/lib/bounded-int.ts   # 5 modified, rest baseline

# reachability sweeps (the absence proofs)
Get-ChildItem src,scripts -Recurse -File | ? {$_.Extension -in '.ts','.mjs','.tsx'} |
  ? {$_.Name -notmatch '\.test\.'} | Select-String -Pattern 'selfmod'                  # → definition-only
… -Pattern 'preflightSelfmodRun|landSelfmodWorktree|collectSelfmodDiff|runSelfmodVerifyGate|discardSelfmodWorktreeChanges|validateSelfmodWorktree'
… -Pattern 'iterateToSatisfaction|createSubagentContract|crewToReport|selectDefectRepairLessons|defectRepairLesson|applyLessonDemotion|driftLesson|pressureAt|consolidatedRunNote'
… -Pattern 'judgePhase'                                                                 # → judgment.ts + judgment.test.ts only
… -Pattern 'scoreMaker|stageQualitySignals|meetsRunKindBar|barForRunKind|capabilityCoverage'
… -Pattern 'from ["''].*/(arch-tools|plugin|compaction|vector)\.ts'                      # → tests only

# the scoring-toolchain question (does the behavioral leg ever fire?)
Select-String -Path scripts\run-eval.mjs -Pattern 'behavioral'                           # → 2 comments, no call arg
Get-ChildItem src,scripts -Recurse -File | Select-String -Pattern 'behavioral:'          # → *.test.ts only

# the kind matrix
Get-ChildItem research\eval-corpus\graders -Filter *.json | % { (Get-Content $_ -Raw | ConvertFrom-Json) |
  "{0}: expectedKind={1} requireExpectedKind={2}" -f $_.BaseName, $j.expectedKind, $j.passWhen.requireExpectedKind }
Select-String -Path src\components\console.tsx -Pattern '"app"|"tool"|"service"|"library"|"game"'   # → 0 matches

# targeted per-file suites (never the full legs)
node --experimental-strip-types --test --test-reporter=tap src/lib/selfmod.test.ts src/lib/judgment.test.ts src/lib/compaction.test.ts
node --experimental-strip-types --test --test-reporter=tap src/lib/rt-events.test.ts src/lib/rt-ring.test.ts src/lib/subagent.test.ts src/lib/maker-score.test.ts
node --experimental-strip-types --test --test-reporter=tap src/lib/knowledge.test.ts src/lib/iterate.test.ts src/lib/bench.test.ts src/lib/plugin.test.ts src/lib/arch-tools.test.ts src/lib/scorecard.test.ts
node --experimental-strip-types --test --test-reporter=tap src/lib/selfmod.server.test.ts src/lib/harvest.test.ts src/lib/research.test.ts src/lib/tavily.server.test.ts src/lib/report-intake.test.ts src/lib/planning.test.ts src/lib/handoff.test.ts src/lib/vault.test.ts src/lib/swarm.test.ts src/lib/rt-client.test.ts
```

**Test result across my scope's own suites (measured):** `# tests 643 · # pass 634 · # fail 0 · # skipped 9`.
Every suite in this lane's scope is GREEN; the 9 skips are enumerated in `SI-06` — 8 of them are the entire
real-behavior half of `selfmod.server.test.ts` (host has no `bash`).

**Baseline not re-derived (quoted):** the wave brief's `npx tsc --noEmit` exit 2 / 5 errors and `npm test` exit 1
(622/607/15). Running either was out of scope.

---

## 2. Learning-loop closure — `store | writer | reader | does the value reach a prompt/policy/gate?`

The campaign goal is "RapidTool learns and improves itself and its output every run". This is the table that decides
whether that sentence is true of the bytes. `cartographer` §6 found the shape; this table re-derives it with my own
queries and adds the stores it did not cover (**consolidation**, **demotion**, **the run digest**, **compaction**,
**harvest lessons**).

### 2a. Store A · `project.memory` (lesson rows inside the project JSON) — the live half

| store / row class | writer (`file:line`) | reader (`file:line`) | reaches a prompt / policy / gate? |
|---|---|---|---|
| **L4 verified-procedure** (a SUCCESS row) | `knowledge.ts:2381` `verifyOutcomeLesson("passed",…)` ← minted at `verify.server.ts:2228`; persisted `verify.ts:359-375` by `store.ts:1611` / `rapidtool-cli.mjs:4195` | `selectLessons` (`knowledge.ts:1244`) ← `codegen.server.ts:7004-7007` (+ `:7105, :7856, :8033, :8290`); also `packet.ts:787`, `engine.ts:1038-1043, 1878` | **YES** — the P6 expansion + synthesis/repair prompts and the Agent Packet. This is the one place **success teaches**. |
| **L3 verify-failure** | `knowledge.ts:1606` ← `verify.server.ts:2086` (`failureLessonFromRecord`) | same five `selectLessons` sites | **YES** |
| **L5 user-correction** | `knowledge.ts:1693` ← `engine.ts:2376` (human reject only) | same | **YES** |
| **L2 template-emission** (refused keyed P6) | `knowledge.ts:1532` ← `headless.ts:1655-1678`; `report-intake.ts:405-477` | same | **YES** |
| **L1 vague-brief** | `engine.ts:934-940` (guarded by the lazy `lessonSurface`) | same | **YES** (cartographer's B-6 race applies) |
| **L5 run-summary** | `knowledge.ts:2398` ← `headless.ts:1707` (run completion) | `selectLessons` (`knowledge.ts:1244`) | **PARTIAL** — written with `phase: 12` (`knowledge.ts:2426`); the P6 readers ask for phase 6, so the row is injected only through the phase-agnostic fallback (`knowledge.ts:1260-1261`), i.e. only when **no** phase-6 lesson exists. See `SI-11`. |
| **defect-repair** (class-keyed remediation) | `knowledge.ts:1332` `defectRepairLesson` | **ABSENT** — `selectDefectRepairLessons` (`knowledge.ts:1358`) has zero production callers | **NO** — see `SI-03` |
| **drift** | `knowledge.ts:1725` `driftLesson` | **ABSENT** — no production writer *and* no caller (`knowledge.ts:1719-1722` declares it) | **NO** |
| **harvest negative-evidence** | `harvest.ts:796` `harvestEvidenceLesson` | **ABSENT** — no writer at all (`harvest.ts:760-765` declares it) | **NO** — see `SI-13` |

**Query that proves the three absences:**
`Get-ChildItem src,scripts -Recurse -File | ? {$_.Extension -in '.ts','.mjs'} | Select-String -Pattern 'defectRepairLesson|selectDefectRepairLessons|applyLessonDemotion|driftLesson|pressureAt|consolidatedRunNote'`
→ matches only `knowledge.ts` (definitions/comments) and `knowledge.test.ts`.

### 2b. The lifecycle verbs — consolidation, demotion, promotion

| verb | writer | reader | verdict |
|---|---|---|---|
| `pressureAt` (`knowledge.ts:1886`) — the 80-row FIFO eviction trigger | — | **ABSENT** (tests only) | **the consolidation trigger never fires** — see `SI-04` |
| `consolidatedRunNote` (`knowledge.ts:2343`) — writes a `note` when ≥3 same-class rows exist | — | **ABSENT** (tests only) | **nothing is ever consolidated** |
| `applyLessonDemotion` (`knowledge.ts:1385`) — demotes a repeatedly-injected, never-passing class | — | **ABSENT** (tests only) | a bad lesson keeps its score forever |
| `shouldPromoteLesson` (`knowledge.ts:1409`) — the eval gate | called `knowledge.ts:621` (the CLI `lesson --accept` write path) | — | **live** — the cross-project promotion gate is real |
| `lessonOutcomeReport` (`knowledge.ts:2045`) | — | `rapidtool-cli.mjs:4775` (`lesson --effect`) | **live, read-only** — a measurement read-out, not a feedback edge |
| `lessonLog` (`knowledge.ts:1893`) | the ledger append | UI/diagnose | **live** |

**Consequence (the honest bottom line of §2).** Memory in this product is an **80-row cap kept by recency**
(`engine.ts:1911` `slice(0, 80)` over a new-first list; `verify.ts:372-374` `slice(-80)` over an old-first list)
with **no consolidation, no demotion, and no eviction by value**. A lesson that
keeps being re-injected and never helps can never lose score (`applyLessonDemotion` is dead); the three same-class
rows that should collapse into one note never do (`consolidatedRunNote` is dead, and its trigger `pressureAt` is
dead). The *injection* half of the loop is genuinely closed; the *curation* half does not exist.

### 2c. Store B · the cross-project `KnowledgeStore` — a human-only loop (cartographer §6b, unchanged)

Writers are all CLI human acts (`rapidtool-cli.mjs:4908, 4958, 4969`, doctrine stated at `:4882-4884`); the reader
needs an explicit `--knowledge` flag (`rapidtool-cli.mjs:1384-1409` → `headless.ts:3173` → `codegen.server.ts:6952`).
`Select-String -Path src\lib\store.ts -Pattern 'proven|knowledge'` → 4 matches, all the word *provenance*; **the
console can never supply a cross-project lesson row.**

### 2d. The eval side — a scorecard nothing consumes

`research/eval-out/results.json` / `history.json` are written by `scripts/run-eval.mjs` and read only by the
read-only `scorecard.ts` (`rapidtool-cli.mjs:3411`) and one rubric prior (`maker-score.ts:697-720`). **Nothing reads
them back into `project.memory` or the store.** The measured-improvement loop terminates in a document.

### 2e. Other learning/memory artifacts with no consumer

| artifact | evidence | verdict |
|---|---|---|
| `compaction.ts` (the whole module: `SUMMARY_TEMPLATE`, `shouldCompact`, `compactionOutcome`, `clampToolOutput`) | its own header `compaction.ts:16-20`: *"no compaction site exists in engine.ts today"*; callers query → `compaction.test.ts` + two comments only | **dead vocabulary** — the context-compaction spec has no site (`SI-12`) |
| `judgment.ts` `judgePhase` | `Select-String -Pattern 'judgePhase'` repo-wide → `judgment.ts` (def+comments), `judgment.test.ts`, and two prose comments (`dod.ts:1773`, `engine.ts:1773`) | **dead read-out** — the phase verdict ladder has no caller (`SI-05`) |
| `iterate.ts` `iterateToSatisfaction` | zero non-test callers (cartographer B-4); the *decision* is recorded by the eval harness only (`run-eval.mjs:2635`) | **dead driver** |
| `arch-tools.ts` (scanLocalImports / dependencyGraph / codebaseMap) | zero non-test references | **dead** |
| `plugin.ts` (`createPluginRegistry`, the hook registry) | zero non-test references | **dead** |
| `vector.ts` (the two keyed generators) | zero non-test importers (cartographer B-8) | **dead** |

---

## 3. Self-modification safety assessment

### 3a. Capability, bound, approval, rollback — what the guardrails actually are

`src/lib/selfmod.ts` is a **pure** decision layer (no fs/child_process/timers, header `:1-25`) and it is strong:

| design guard | bytes | verdict |
|---|---|---|
| ① path allow-list + protected manifest | `SELFMOD_PROTECTED_PATHS` 23 entries in 6 classes (`selfmod.ts:65-92`); `allowListRefusals` checks **both directions** — a protected entry *and* a directory entry that would *cover* one (`selfmod.ts:293-327`) | **real** |
| ② worktree + branch, never main | `isMainBranch` (`selfmod.ts:266-272`) + `validateSelfmodWorktree` proving root/same-repo/clean/non-main with real git (`selfmod.server.ts:147-244`) | **real** |
| ③ self-DoD = `gate.sh` before AND after | `selfmodLandingDecision` (`selfmod.ts:557-589`) refuses on `verify == null` or `verify.ok !== true`; `landSelfmodWorktree` re-consults it and **refuses before any staging** (`selfmod.server.ts:497-500`) | **real, fail-closed** |
| ④ stock gates stay human | `humanSeat === true` → `RT_E_SELFMOD_UNGOVERNED` (`selfmod.ts:409-413`) | **real** |
| ⑤ mandatory `RAPIDTOOL_TOKEN_CAP` + `enforceDoD` | unset/junk cap ⇒ refusal (never unmetered, `selfmod.ts:386-391`); `--cap ≤ envCap` (`:397-400`); `enforceDod !== true` ⇒ refusal (`:404-408`) | **real** |
| ⑥ forbidden-path manifest | `diffWithinCaps` re-enforces protected+allow on the **real** `git diff --numstat` + untracked list (`selfmod.ts:505-512`) | **real** |
| ⑦ honest limit | `SELFMOD_HONEST_LIMITS` on every verdict (`selfmod.ts:157-163`) — "bounded local runner, NOT an OS sandbox" | **real, stated** |
| diff caps | `SELFMOD_LIMITS` default 12 files/800 lines, ceilings 40/2000 — a caller can never raise past the ceiling (`selfmod.ts:103-115`) | **real** |
| rollback | `discardSelfmodWorktreeChanges` = `reset --hard HEAD` + `clean -fd`, re-verifies non-main, refuses a still-dirty tree (`selfmod.server.ts:570-596`) | **real** |

### 3b. Can a hostile BRIEF (LLM input) reach a selfmod write, a git write, or a patch application?

| path | reachable from a brief? | evidence |
|---|---|---|
| **selfmod write / commit** | **NO — there is no production caller at all.** `preflightSelfmodRun`, `landSelfmodWorktree`, `collectSelfmodDiff`, `runSelfmodVerifyGate`, `discardSelfmodWorktreeChanges`, `validateSelfmodWorktree` are referenced only inside `selfmod.server.ts` itself; the CLI has **39 verbs and none is `selfmod`** (`Select-String -Path scripts\rapidtool-cli.mjs -Pattern 'case "'` → create/run/gate/…/diagnose). The design *required* a CLI arm (`fixes/311_se2_surfaces.md:57`) and the lane log records it as **blocked**: `fixes/314_f2_selfimprove.md:34` — *"Mount spec (blocked: scripts/rapidtool-cli.mjs owned by live lane E1…)"* `*(to fill)*`, with the whole status board unticked. | **safe by absence** (`SI-01`) |
| **git write into the host repo** | **NO.** `gitLandEmitted` refuses any dir carrying a `.git` it did not create (`git.server.ts:1610-1621`, `not-a-landing-repo`) and any dir inside an existing work tree (`:1636-1645`), and requires the emitted record `.rapidtool/project.json` (`:1596-1606`). `emit --git` therefore lands only into a fresh emission dir; the host repo is structurally un-landable. | **sound** |
| **patch application** | **YES, and bounded.** A model-returned delta is applied by `applyStrReplace` at `codegen.server.ts:1222` (`import { applyStrReplace } from "./patch.ts"` `:128`) and by the CLI `edit` verb (`rapidtool-cli.mjs:3879-3880`). `patch.ts` is pure/total and **refuses** on ambiguity: 0 matches ⇒ coded `RT_E_VALIDATION`, >1 matches ⇒ refusal naming the count, a fuzzy tie ⇒ refusal, a no-op ⇒ refusal (`patch.ts:279-390`). It writes nothing and reads nothing; the caller owns the write. **A hostile brief can therefore not steer a patch into the harness repo** — the patch target is always the emitted/generated source. | **sound** |

**Verdict on Q3.** Self-modification is **bounded and safe because it is unreachable**, not because a hostile brief
was driven through it and refused. The guardrail code is genuinely good, the executor is genuinely fail-closed, and
**no caller exists** — so the campaign's "it improves itself" claim rests on a decision layer with no driver. This is
an *honest* gap (the docs say so: `fixes/311_sd_product.md:57` "Self-mod **is** a real vision gap"), but it is the
single largest distance between the goal and the bytes, and it means **no `file:line` in this repo can answer "what
does self-mod do when it runs"** except the skipped tests.

---

## 4. Scoring validity — per score: source of truth, and whether a hollow output can earn it

| score | source of truth (bytes) | can a hollow output earn it? |
|---|---|---|
| `maker-score` **M1 substance** | **Two branches.** Behavioral branch (`maker-score.ts:414-436`) scores off the TAP (`pass`/`fail`); otherwise the **stem branch** (`:441-470`) maps each `expectedCapabilities` label to a non-stub tree file by identifier-stem substring (`capabilityCoverage` `:361-383`, `formsForCapability` `:304-317`). | **YES, in production** — the behavioral branch is **never entered**: the one production caller of `scoreMaker` (`run-eval.mjs:2344-2364`) does not pass `behavioral`, and `Select-String -Pattern 'behavioral:'` over non-test code returns **zero** hits. So M1 is identifier-substring-derived on every real score. A hollow tree whose identifiers spell the capability nouns earns M1=1. **Also vacuous by construction** when a corpus declares no capabilities: `maker-score.ts:456-459` returns `score:1 … "substance vacuously satisfied"`. `SI-02`, `SI-07` |
| `maker-score` **M2 runs** | `treeRun.ok` (+ behavioral TAP when supplied) | **YES** — a green `treeRun` over a shell is a green `treeRun`; the behavioral upgrade is dead for the same reason. The bounded spec leg's vacuity refusals (`compile-check.server.ts:1547-1572`, sibling R-10) are the only real defense. |
| `maker-score` **M3 iterates / M4 verifiable / M6 handover / M8 bounded / M9 on-time** | real recorded state (iteration count, `lastTest {label:"tested", evidenceHash}`, emit dir + `DEPLOY.md` + oracle spec ≥100b, budget cycles, stop code) | **mostly NO** — each keys on a machine artifact. M9 grants 1 to *any* run that stops on time with no refusal (`maker-score.ts:750-752`) — a free point for doing nothing wrong. |
| `maker-score` **M5 honest** | 1 when there are **no red gate records** (`maker-score.ts:613-618`, "nothing to hide") | **YES, trivially** — the criterion cannot distinguish "honest" from "no gates ran". |
| `maker-score` **M7 learning** | `m1Substance + m3Iterates` this run ≥ the prior run's (`maker-score.ts:701-722`) | **NO** — and it is well-defended: a prior with `M1+M3 === 0` scores 0 (`:712-718`), and the keyless/refused floor forces M1-M4 to 0 (`:797-810`) so a floor card cannot clear any bar. |
| the **keyless / refused floor** | `scoreMaker` card-level override → M1-M4 = 0 with one shared qualifier (`maker-score.ts:797-810`; `KEYLESS_FLOOR_QUALIFIER_EVIDENCE` `:266`) | **NO** — pinned at "5/9 warm, 4/8 first-run", below every admissible bar. This is the strongest single guard in the scoring layer. |
| **first-run bar** | `barForRunKind` **derives** rather than trusts: exclusions clamped to `["M7"]`, threshold forced to 1 (`maker-score.ts:880-890`); `firstRunBarIsAdmissible` (`:898-916`) lets a loader reject a loose grader | **NO** — a grader cannot lower a first-run bar. Sound. |
| `product-quality.ts` `quality` | a static checklist over bytes (sibling `R-06`) | **YES, cheaply** — sibling `355_2` proved a fabricated 5-file tree reads `quality:true, reasons:[]`. Cited, not re-derived. |
| `feasibilityScorecard` (P0) | a formula over the intent lattice (`algorithms.ts:1255-1305`: complexity, constraint load, `vague`, job count) | **not an output score** — it grades the *brief*. Hard rules (vague ⇒ reframe; complexity ≥8 ⇒ never straight "proceed") are real (`:1283-1285`). |
| `bench.ts` (token/time/complexity/failure-point estimates) | regex/line heuristics over real source | **NO inflation** — every estimate carries `estimate:true`, a `method` string and a "synthetic dry-run estimate" label (`bench.ts:36-39`); string/comment literals are stripped first (`:93-149`); the ternary counter excludes `??`/`?.` (`:338-345`). |
| `scorecard.ts` (eval M1-M9 aggregate) | parses `results.json`/`history.json` read-only; drops slugless rows with a note (`scorecard.ts:649`) | **NO** — read-only, never invents a row (sibling `reviewer-proof` owns the producer). |
| `judgment.ts` `judgePhase` | reads the recorded ledger/lastTest; never mints an approval; `refuse:no-proof` when nothing anchors the claim (`judgment.ts:148-281`) | **NO — and it has no caller**, so it scores nothing at all (`SI-05`). |

### 4a. Are `algorithms.ts`'s ranker and stemmer sound?

Verified by reading, not asserted:

- **`overlap`** (`algorithms.ts:666-671`) = `Σ hits / sqrt(|q|·|row|)`, with query tokens **de-duplicated first**
  (`:744`). The normalizer is symmetric and `overlap ∈ [0, √(|q|/|row|)]`, so the raw term is **not** bounded by 1 —
  the *blended* score can exceed 1 in principle. In practice `rrf ≤ 1/60.5`, `ce ≤ 0.25+0.2`, `citedBoost ≤ 0.15`,
  `phraseBoost ≤ 0.1`, so the composite stays well inside `(0, 1]` and the doc's ordering claims hold for realistic
  inputs. **Not a defect; a documented-normalizer nuance worth knowing** if a later wave extends the weights.
- **`contiguousRun`** (`:692-710`) is a real KMP preprocessing + scan, with a differential property test against a
  naive reference (docstring `:685-690`). Sound.
- **`stemToken`/`canonicalStem`** (`:1434-1470`) are length-guarded at every step and fixed-point iterated (max 4
  passes). Verified by hand: `file→fil`, `files→fil` (the PB-01 e-drop fix), `zebra≡zebras→zebr`, `user→user`.
  Sound and consistent across `tokenizeWords`/`fusionRank`/`intentLattice`.
- **`compareLessons`** (`knowledge.ts:1228-1233`) is total and symmetric — non-finite scores order below finite ones
  and equal rows compare 0 (`:1224-1228` documents the old invalid comparator). Sound.
- **`sortTokens`-free determinism**: `fusionRank` tokenizes each row once (`:783`), skips malformed rows instead of
  throwing (`:763-770`), collapses duplicate ids keeping the best-ranked (`:830-844`). Sound.
- **`patchSimilarity`** (Dice over character bigrams) is a true metric on the normalized blocks and returns 1 for
  whitespace-only variants (`patch.ts:140-159`). Sound.

**Q5 verdict.** The *scoring machinery* is careful and unusually well-defended (the keyless floor, the first-run bar,
the behaviour-gated `p3` promotion are all real). The **hollow-output vector is M1/M2**, and it is not a bug in
`maker-score.ts` — it is that the caller never supplies the behavioral evidence the criterion was built to consume.

---

## 5. End-to-end kind-coverage matrix

The kinds the product claims: `app`, `game`, `tool`, `service`, `library`. **The operator cannot choose one** —
`Select-String -Path src\components\console.tsx -Pattern '"app"|"tool"|"service"|"library"|"game"'` → **0 matches**,
and there is no `create --kind` flag (`--kind` exists only for `diagram` and `lesson`, `rapidtool-cli.mjs:4374,
6154`). The kind is always **inferred from the brief** by a keyword table (`engine.ts:219-241` `DELIVERY_KIND_KEYWORDS`
→ `deliveryKindOf` `:355`; mirrored in `dod.ts:874-911` `KIND_ROWS`/`briefDeliveryKind`, parity-pinned).

| kind | path real? | what breaks it | evidence |
|---|---|---|---|
| **app** (→ `webapp`) | **YES, best-supported** | — | 7 of 11 corpus graders declare `expectedKind:"webapp"`; `index.html` + `src/main.tsx` emitted only for `webapp`/`game` (`scaffold.ts:9003-9005`, `:7976-7979`); entry resolves `mode:"web"` (`fixes/353_validation_wave.md:147-149`) |
| **game** | **YES** | one corpus case only (`arcade-breakout`) | `scaffold.ts:6600, 5091` game shell; grader `expectedKind:"game"`; 353 lists `04-puzzle-game kind=game entry.ok=true mode=web entry=src/main.ts` |
| **tool** (→ `cli-tool`) | **real but UNPROVEN since the fix** | its one corpus case **failed its own `tsc`** (`TS2345`) and the entry assertion before the driver fix; only the *entry resolver* was re-verified, never a fresh keyed run | `scaffold.ts:7799` emits `bin/<slug>.mjs`; `:8000` declares `main`/`bin` in `package.json`; grader `invoice-csv-cli` `expectedKind:"cli-tool"`; `fixes/353_validation_wave.md:95` (`05-cli-log-analyzer … tree.webEntry + tsc TS2345`) and `:151` |
| **service** | **real but UNPROVEN since the fix** | its one corpus case failed `tsc TS2345`; entry fix verified only deterministically | grader `order-webhook-service` `expectedKind:"service"`; `fixes/353_validation_wave.md:97, :153` (`mode:"service" entry:src/main.ts`) |
| **library** | **real but UNPROVEN since the fix** | its one corpus case failed `tsc TS7006/TS2345` **and** a test; entry fix verified only deterministically | grader `date-rrule-library` `expectedKind:"library"`; `scaffold.ts:7998` (`src/main.ts` for non-web kinds); `fixes/353_validation_wave.md:99, :155` |

**Matrix honesty assessment.**

1. **The kind assertion is a self-consistency read, not an independent proof.**
   `checkExpectedKind` (`run-eval.mjs:832-875`) compares the emitted `README.md`'s `**Kind:**` line against the
   grader's declared `expectedKind`. Both values descend from the **same brief keyword table** (`dod.ts:874-911` /
   `engine.ts:219-241`). A tree that the table *calls* a service and that emits an HTML page passes this assertion.
   The genuinely independent check is the **entry** assertion (`resolveTreeEntry`, `acceptance-run.mjs:92`, kind-aware
   per `fixes/353_validation_wave.md:177-183`) — that one is real and was the wave's actual fix.
2. **Coverage is one case per non-web kind.** 11 corpus briefs: app×7, game×1, tool×1, service×1, library×1. A
   single sample cannot distinguish "the kind works" from "this brief worked".
3. **The classification is brittle in a specific, testable way.** `KIND_ROWS`/`DELIVERY_KIND_KEYWORDS` iterate
   **library → app → tool → game → service** with a `uiSurface` skip for library/tool (`engine.ts:341`, `dod.ts:909`).
   So a library brief that mentions "UI" is forced to **app**; a service brief mentioning "dashboard" is forced to
   **app**; a game brief not using the word *game*/*play*/*arcade* falls through to app. Nothing in the product lets
   the operator correct the inference.
4. **The last measurement stands at `ok 1 / 10`, `belowFloor 6`, `productQuality 0`, `declaredScriptsVerified 10`**
   (`fixes/353_validation_wave.md:72`), with all three non-app kinds in the failing set. The 353 lane fixed the
   *harness*, not the product; no fresh keyed run of 05/07/09 is recorded here.

---

## 6. Findings

`id | severity (P0/P1/P2/P3) | title | file:line | evidence | why it matters`

### SI-01 · **P1** · Self-modification has **no driver**: the whole capability is unreachable
**file:line** `selfmod.server.ts:147, 270, 340, 389, 461, 570` (the six exported entry points) · `src/lib/selfmod.ts:65-92, 557-589` (the guardrails).
**Evidence.** `Get-ChildItem src,scripts -Recurse -File | ? {$_.Extension -in '.ts','.mjs','.tsx'} | ? {$_.Name -notmatch '\.test\.'} | Select-String -Pattern 'preflightSelfmodRun|landSelfmodWorktree|collectSelfmodDiff|runSelfmodVerifyGate|discardSelfmodWorktreeChanges|validateSelfmodWorktree'` → the **definition site only**, for each. `Select-String -Path scripts\rapidtool-cli.mjs -Pattern 'case "'` → 39 verbs, **no `selfmod`**. The lane log agrees: `fixes/314_f2_selfimprove.md:34` "Mount spec (blocked: `scripts/rapidtool-cli.mjs` owned by live lane E1 this wave…) *(to fill)*"; the four `SELFMOD_CODES` are still unregistered (sibling `355_5` I355-02).
**Why it matters.** The campaign's headline capability ("learns and improves itself") has a guardrail core and no
path from any surface to it. A later wave should either build the one CLI arm the design names, or say plainly in the
top-level docs that self-mod ships as inert guardrails.

### SI-02 · **P1** · `maker-score`'s behavioral branch is dead in production — M1/M2 are identifier-substring scores
**file:line** `maker-score.ts:205-230` (`behavioral` input), `:414-436` + `:505-523` (the behavioral branches), `scripts/run-eval.mjs:2344-2364` (the sole production caller).
**Evidence.** The `scoreMaker({…})` call at `run-eval.mjs:2344` passes `project, corpus, treeRun, journey, run, handover, budget, stop, prior, synthesisSucceeded` — **no `behavioral`**. `Get-ChildItem src,scripts -Recurse -File | Select-String -Pattern 'behavioral:'` → matches `*.test.ts` only. `Select-String -Path scripts\run-eval.mjs -Pattern 'behavioral'` → 2 comment lines, no argument.
**Why it matters.** M1/M2 fall through to the stem path (`capabilityCoverage`, `maker-score.ts:441-470`), which maps
capability *labels* to tree files by identifier substring. A hollow tree whose identifiers carry the capability nouns
earns M1=1/M2=1. The criterion was built with a behavioral upgrade and the one caller never supplies it.

### SI-03 · **P1** · A header comment claims prompt injection that `file:line` shows does not exist (defect→repair loop)
**file:line** `knowledge.ts:1265-1271` (the claim) vs `knowledge.ts:1358` (`selectDefectRepairLessons`, zero callers) and `knowledge.ts:1332` (`defectRepairLesson`, zero callers).
**Evidence.** The comment: *"`selectDefectRepairLessons` feeds the matching rows into the next run's synthesis/repair prompts"*. Query: `… | Select-String -Pattern 'defectRepairLesson|selectDefectRepairLessons|applyLessonDemotion'` → `knowledge.ts` definitions + `knowledge.test.ts` only. The `P6` prompt sites (`codegen.server.ts:7004, 7105, 7856, 8033, 8290`) all call the **generic** `selectLessons`, never the class-keyed selector.
**Why it matters.** This is exactly the artefact the brief calls out: a declared caller that does not exist. It is
the difference between "the repo can derive class-keyed remediation from its own TS error codes" and "the repo
derives it into a store nothing reads".

### SI-04 · **P2** · Memory never consolidates and never demotes — the curation half of the loop is dead
**file:line** `knowledge.ts:1886` (`pressureAt`), `:2343` (`consolidatedRunNote`), `:1385` (`applyLessonDemotion`).
**Evidence.** Same query as SI-03 plus `pressureAt|consolidatedRunNote` → `knowledge.ts` + `knowledge.test.ts` only. The 80-row cap is at `engine.ts:1911` (`dedupeMemoryIds(accrueReproducedCounts([...result.memory, ...primed.memory])).slice(0, 80)`) and `verify.ts:372-374` (`.slice(-80)`).
**Why it matters.** The 80-row store is ordered by **recency**, so a recurring, unhelpful lesson displaces a useful
older one and can never lose score. The three mechanisms that would fix this (pressure trigger, consolidation
writer, demotion) exist, are pure, are tested — and are never called.

### SI-05 · **P2** · The phase verdict ladder (`judgePhase`) has no caller
**file:line** `judgment.ts:148` (definition), `:277` (self-reference).
**Evidence.** `Get-ChildItem src,scripts -Recurse -File | Select-String -Pattern 'judgePhase'` → `judgment.ts` (def +
2 comments), `judgment.test.ts` (17 call sites), `dod.ts:1773` and `engine.ts:1773` (**prose comments**). No
production call site.
**Why it matters.** The module was built to give a human one honest label per phase
(`blocked:hitl / fail:deterministic / pass:machine-evidenced / pass:deterministic-only / advise:risk /
refuse:no-proof`). Nothing surfaces it, so the ladder is a promise no operator can read.

### SI-06 · **P2** · The selfmod executor's landing discipline is **unverified on this host**
**file:line** `selfmod.server.test.ts` (the `bash`-gated suites) · `selfmod.server.ts:389-429` (`runSelfmodVerifyGate`).
**Evidence.** `node --experimental-strip-types --test --test-reporter=tap src/lib/selfmod.server.test.ts …` → `# tests 260 · pass 251 · fail 0 · skipped 9`, and the skipped lines read `# SKIP bash is not installed on this host` for: green-verdict read · red/missing-verdict read · hanging-gate bound · *"lands ONLY on a green verify: commit exists on the branch, never on main"* · *"PIN: a failed verify = NO commit"* · *"PIN: an over-cap diff is refused"* · *"PIN: a protected-path WRITE is refused coded"* · *"takes a green-change request from preflight to a landed branch commit"* (plus one research test skipped because `DEEPSEEK_API_KEY` is set on this host).
**Why it matters.** The pure guardrail logic is pinned and green (61 tests). The **executor** — the half that
actually runs `gate.sh`, stages, and commits — is skipped on Windows. On the machine where this repo is audited, the
"a red verify performs zero git mutation" claim is read from the bytes and never executed.

### SI-07 · **P2** · M1 scores 1 vacuously when a corpus declares no capabilities
**file:line** `maker-score.ts:456-459`.
**Evidence.** `if (caps.length === 0) return { score: 1, evidence: "tree … no expectedCapabilities demanded — substance vacuously satisfied" }` (read). The all-stub guard above it (`:446-452`) is real, so the vacuous pass needs only one non-stub file.
**Why it matters.** Any caller scoring without a corpus (an ad-hoc run, a future surface) grants M1 for free. The
eval corpus always declares capabilities, so this is latent, not live — but it is one line away from live.

### SI-08 · **P2** · `subagent`'s scope-overlap guard is exact-match only
**file:line** `subagent.ts:196-199` (`normalizeScopeEntry` doc: *"a directory PREFIX is not treated as an overlap"*), `:283-289` (the check).
**Evidence.** Read. Two siblings claiming `src/lib` and `src/lib/x.ts` normalize to different strings and pass.
**Why it matters.** If the R13-f14 wire plan (`subagent.ts:44-50`) ever lands, two delegated children can be handed
overlapping scopes and both may write one file — inside a module whose *stated purpose* (`:1-30`) is "parallel children
cannot fight over the same files". The caps themselves are sound: concurrency is capped at 4 and a request above it is
refused, never clamped (`:203-218, :489-604`), and the worker cursor read+increment is synchronous before any await
(`:568-570`) so no two workers take one task.

### SI-09 · **P2** · Kind coverage: one corpus case per non-web kind, and the kind assertion is a self-consistency read
**file:line** `run-eval.mjs:832-875` (`checkExpectedKind`), `run-eval.mjs:498-513` (`EXPECTED_KINDS`), `dod.ts:874-911` / `engine.ts:219-241` (the one keyword table), `console.tsx` (**0 kind matches**).
**Evidence.** Grader dump (§5) → `webapp×7, game×1, cli-tool×1, service×1, library×1`, all `requireExpectedKind:true`.
`checkExpectedKind` reads the emitted README's `**Kind:**` line (`run-eval.mjs:857`) — a value the scaffold derived
from the *same* brief keyword table the grader's expectation came from. `fixes/353_validation_wave.md:95-99` records
tool/service/library failing their own `tsc` at the last measurement.
**Why it matters.** "Any kind of software" is claimed; the end-to-end evidence is one brief per kind, the kind check
cannot catch a mis-kinded artifact that declares itself correctly, and the operator can never correct the inference.

### SI-10 · **P3** · The engine's telemetry sink is unguarded — purity is producer-provided, not engine-enforced
**file:line** `engine.ts:5790` (`opts?.onEvent?.({…})`) and `engine.ts:6379, 6392` (`emit({…})`), vs the claim at `engine.ts:4946-4950`.
**Evidence.** Read: neither call site is inside `try`. The two known producers are safe — `rt-client.ts:310-326`
(`reportRt`) and `runtime-log.server.ts:116-129` (`appendRtLine`) both swallow every failure, and the CLI's
`cliLogEvent` is wrapped (`rapidtool-cli.mjs`, `try { … } catch { /* telemetry must never break the command */ }`).
The producer-side guarantee is **test-pinned** (`rt-client.test.ts:79` "reportRt never throws on hostile inputs";
`rt-ring.test.ts:220, 248, 258, 262`). The engine-side guarantee is **not pinned anywhere**.
**Why it matters.** The doctrine says telemetry must never change engine behavior. Today that holds because the
sink happens to be non-throwing; the engine itself relies on trust in a caller-supplied callback. A one-line
`try {} catch {}` at the seam (or a pinned test) would make the doctrine structural rather than incidental.

### SI-11 · **P3** · Run-level learning is failure-only
**file:line** `knowledge.ts:2398-2413` (`runSummaryLesson`), `headless.ts:1707` (the mint).
**Evidence.** Read: `if (gateFails.length === 0 && rejectionCount === 0 && rejectedPhases.length === 0 && verifyFails.length === 0) return null;` — a **clean run mints nothing**. The success path exists only at the verify level (`verify.server.ts:2228` → `verifiedProcedureLesson`, `knowledge.ts:1656`).
**Why it matters.** For Q2 ("do successes teach?"): **yes, at the level of a proven module shape; no, at the level of
a run.** A run that went cleanly has no digest row, so nothing records *what worked* about the run. The doc's
"mistakes and successes" is half-true of the bytes.

### SI-12 · **P3** · Dead pure modules in the learning/architecture layer
**file:line** `compaction.ts:1-40` (header: *"no compaction site exists in engine.ts today"*), `plugin.ts:230` (`createPluginRegistry`), `arch-tools.ts:326` (`codebaseMap`), `vector.ts:1022, 1112` (keyed generators).
**Evidence.** `… | Select-String -Pattern 'renderCompactionSummary|shouldCompact|compactionOutcome|clampToolOutput'` → `compaction.ts` + `compaction.test.ts` + two comments. `Select-String -Pattern 'plugin\.ts|createPluginRegistry|PLUGIN_'` → `plugin.ts` only. `Select-String -Pattern 'archTool|architectureSurface|arch-tools'` → `arch-tools.ts` + `arch-tools.test.ts` + `sweep73-fuzz.test.ts`. `vector.ts` → no non-test importer (cartographer B-8).
**Why it matters.** Four real, tested, non-trivial modules (~2 800 lines) with no consumer. `compaction.ts` is the
documented context-compaction spec for a product whose P6 prompt budget is its binding constraint
(`P6_SYNTH_PROMPT_MAX_CHARS 60_000`) — the gap it fills is real; the site is missing.

### SI-13 · **P3** · The harvest lesson has no writer (self-declared)
**file:line** `harvest.ts:760-765` (the declaration), `harvest.ts:796` (`harvestEvidenceLesson`).
**Evidence.** Read: *"⚠️ DECLARE-OR-STRIKE (330 P4): no production seam calls either builder yet… in a real RUN no row is minted until a seam is specified"*. Confirmed by the SI-03 query.
**Why it matters.** Honest, and correctly declared — listed for completeness of the closure table.

### SI-14 · **P3** · 38 of 57 registered telemetry event names have no emitter (self-declared, test-pinned)
**file:line** `rt-events.ts:219-274` (the census comment), `rt-events.ts:130-213` (the catalogue).
**Evidence.** Read: the block names the 38 dead names and states the scan pattern; `rt-events.test.ts` re-derives the
partition from live source so it cannot drift.
**Why it matters.** Not a defect — a self-audited honesty artefact. It is the best-practice counterexample to SI-04:
the repo *knows* which of its catalogues are prose, writes it down, and pins it.

### What is NOT a finding (checked because it looked like one)

- **`selfmod.ts`'s path handling.** `normalizeRelPathRaw` rejects absolute/drive/`..`/empty segments (`selfmod.ts:170-184`) and `matchProtectedPath` is case- and separator-insensitive (`:187-199`). A `--allow src/lib` entry is refused because it would *cover* `src/lib/engine.ts` (`:318-324`). Nothing bypasses it.
- **`gitLandEmitted`'s host-repo refusal.** Structural, not conventional (`git.server.ts:1596-1606, 1610-1621, 1636-1645`), plus a manifest validator that rejects traversal/absolute/backslash entries (`:1494-1514`).
- **`bounded-int.ts` / `sandbox-policy.ts`.** `boundedInt` floors a hostile knob to the fallback (`:17-24`); `coerceIsolationClaim` can never re-emit `sandbox:true` (`sandbox-policy.ts:36-52`). The repo keeps `sandbox:false` honest by construction.
- **`settle.ts`.** `settleWithin` refuses the import-protection mock **before** any await (`settle.ts:89-97`) because awaiting it starves the microtask queue — the module documents the measured hang and does not pretend to bound it.

---

## 7. What is genuinely sound (required)

1. **`selfmod.ts` is a model guardrail layer.** Pure (no fs/child/timers), total, and it enforces in **both
   directions**: an allow-list entry that *is* protected and one that would *cover* a protected path are both refused
   (`selfmod.ts:293-327`); the diff gate re-checks protection and scope on the executor's **real** numstat+untracked
   list (`:469-524`); the landing decision refuses a null verdict, a red verdict, a caps violation, and a
   main-derivation branch (`:557-589`). `landSelfmodWorktree` consults it **before staging**, so a red verify performs
   zero git mutation (`selfmod.server.ts:497-500`). 61/61 tests green.
2. **`git.server.ts`'s delivery tail cannot land the host repo.** `not-an-emitted-tree` / `not-a-landing-repo` /
   `target-in-work-tree` are three independent structural refusals (`git.server.ts:1596-1645`), and the commit uses an
   explicit `-c user.*` identity with `commit.gpgsign=false` (`:1719-1732`).
3. **`patch.ts` never guesses.** 0 matches ⇒ refusal; >1 ⇒ refusal naming the count and candidate lines; a fuzzy tie
   ⇒ refusal; a no-op ⇒ refusal; a fuzzy hit self-reports `kind:"fuzzy"` + its score + the threshold it cleared
   (`patch.ts:279-390`). Pure, total, deterministic, and it writes nothing.
4. **Telemetry is genuinely bounded and genuinely non-throwing on the producer side.** Ring = 200 rows / 64 KB,
   re-applied on **hydrate** so a tampered localStorage blob cannot load unbounded (`rt-ring.ts:105-161, 229-235`);
   rows are redacted to ≤300-char messages, ≤8 flat keys ≤160 chars, ≤12 stack lines (`rt-events.ts:373-491`); every
   junk-input path is a defined no-op (`rt-ring.ts:220, 248, 258, 262`); `appendRtLine`/`readRtTail`/`logDirBytes`
   swallow every failure (`runtime-log.server.ts:116-213`).
5. **`maker-score`'s floor and first-run bar are real anti-vacuity guards.** `synthesisSucceeded === false` **and** the
   keyless journey outcome both force M1-M4 to 0 with one shared qualifier (`maker-score.ts:797-810`), and
   `barForRunKind` derives the first-run bar (clamped exclusions, threshold forced to 1) rather than trusting the
   grader (`:880-916`). A keyless/refused card is below every admissible bar by construction.
6. **`wild-review.ts` resolves the Auto-Review reviewer honestly on both hosts.** Bare Node → the provider's
   `completeDeepSeek` + a direct-env probe; browser → one live server probe then the bridge; keyless or any load
   failure → `null` and the engine's honest `not-configured` path (`wild-review.ts:86-163`). It never fabricates a
   reviewer and never throws.
7. **`research`/`websearch`/`tavily` grounding is real, live, and filtered.** `research()` selects Tavily when keyed
   and the keyless DDG/SearXNG/Wikipedia chain otherwise (`research.ts:230-239`); every provider's results are
   deduped, domain-diversified (≤2/site) and scored (`research.ts:189-228`); the relevance floor is a real constant
   (`RESEARCH_RELEVANCE_FLOOR = 0.15`, `research.ts:171`) and it **is** applied on the consumption path
   (`engine.ts:3631-3640` `researchItemRelevant` ← `filterRelevantResearch` at `engine.ts:3894`, `headless.ts:584`),
   with the same floor reused by the narrative honesty clause (`llm-tasks.ts:98-99`). Fetch bounds are real:
   4 fetches / 12 s, per-leg slices (`harvest.ts:50-59`), 20 s + 2 attempts with transient-only retry
   (`websearch.server.ts:54-58, 236-265`), `q.slice(0,400)` (`tavily.server.ts:200`).
8. **`subagent.ts`'s caps are fail-closed, not clamps.** Concurrency > 4 and batch > 24 are **refused** with codes
   (`subagent.ts:203-218, 505-513`); an over-cap task budget is refused pre-dispatch (`:306-311`); an overspending
   reply is *blocked* with the honest spend kept (`:450-456`); the ledger is append-only with a terminal row per task
   and the batch result is input-ordered, not arrival-ordered (`:568-604`).
9. **`concurrency safety today: no live path lets two writers touch one file.** The console driver is single-flight
   twice over (`tryStartWild` latch + the `wildRun.active && pause !== true` state refusal, `store.ts:1705, 1735-1745`);
   `startWildRun`'s loop commits through `commitWild` which rebases onto live store state
   (`store.ts:1951-1959`); the crew is advisory, one turn at a time; `swarmPlan` is pure and dispatches nothing.
10. **Scope test suites are green.** 643 tests / 634 pass / 0 fail / 9 skipped across 23 of my scope's suites (the 9
    are SI-06, and 1 is an ambient-key skip).

---

## 8. What I could not verify

- **No keyed run was made**, so every "reachability" claim about a real keyed journey is reasoned from the bytes. In
  particular I could not observe `runSummaryLesson` being injected (or not) into a real P6 prompt; the phase-mismatch
  argument in §2a is a read of `selectLessons` (`knowledge.ts:1259-1262`), not a measurement.
- **The 353 trees are not on disk here**, so the per-kind failures in §5 are quoted from `fixes/353_validation_wave.md`
  (lines 72, 91-99, 147-155) rather than re-measured, and I could not check whether any non-app kind has been re-run
  since the harness fix.
- **The selfmod executor's real behavior** (commit-on-green, no-commit-on-red, cap refusal) is **skipped on this
  host** (no `bash`) — see SI-06. I could not execute it, by design and by environment.
- **`run-eval.mjs`'s end-to-end scoring** was read, not run: it is `reviewer-proof`'s lane and the brief forbids the
  full legs. So "M1 is stem-derived in production" is proven by the **call-site argument** (`behavioral` absent from
  the one `scoreMaker({…})` call) and by the repo-wide `behavioral:` grep — not by observing a scored run.
- **The baseline RED verdict** (`tsc` exit 2 / 5 errors; `npm test` 622/607/15) is quoted from the brief, not
  re-derived. If one of the 5 type errors lands in a scope module, a seam below might not execute at runtime; my
  line numbers are read from the bytes on disk regardless.
- **`evidence: "…"` strings inside `maker-score`/`knowledge`** are prose; I verified the **branch conditions** that
  produce them, not that a human would agree with the wording in every case.
- **Whether `arch-tools.ts`, `plugin.ts`, `vector.ts` and `compaction.ts` are deliberately parked or forgotten.** I
  report them as unreachable-by-bytes. `compaction.ts` declares its own parking; the other three do not.

---

## 9. Recommended owners

| finding | owner (Wave 4 / Wave 5 lane) |
|---|---|
| **SI-01** (self-mod has no driver) | **Wave 4 `bus`/`dispatch`/`crew-live`** — the design already names the shape: one `selfmod` CLI arm composing `preflightSelfmodRun` → `collectSelfmodDiff` → `runSelfmodVerifyGate` → `landSelfmodWorktree` (`fixes/311_se2_surfaces.md:57`). Register the four `SELFMOD_CODES` in `errors.ts` in the same change (sibling `355_5` I355-02). |
| **SI-02** (behavioral never wired) | **Wave 5 `bench`/`algo`** + `reviewer-proof` — pass `behavioral` from the tree-run's TAP into the `scoreMaker` call at `run-eval.mjs:2344`, or strike the behavioral branch and say so on the criterion. Do not lower the bar either way. |
| **SI-03** (defect→repair header claims a caller) | **Wave 5 `lessons`** — wire `selectDefectRepairLessons` into the P6 repair prompt beside `selectLessons`, or strike the header sentence. |
| **SI-04** (no consolidation/demotion) | **Wave 5 `memory`** — call `pressureAt` + `consolidatedRunNote` on the write path (`verify.ts`/`engine.applyPhaseResult`) and `applyLessonDemotion` on the census read; all three are pure and already tested. |
| **SI-05** (`judgePhase` dead) | **Wave 5 `lessons`** — surface the ladder on the phase pane (console) and/or the `summary` verb; it needs no new logic. |
| **SI-06** (selfmod executor unverified here) | **Wave 4 `dispatch`** — a POSIX or `sh`-via-git-bash gate runner, or a recorded skip with the environment named; also record that the claim is host-conditional. |
| **SI-07** (M1 vacuous) | **Wave 5 `bench`** — make an absent capability list a **0 with a named reason**, not a 1. |
| **SI-08** (subagent scope overlap) | **Wave 4 `crew-live`** — widen `normalizeScopeEntry` to a directory-prefix overlap before any fan-out lands. |
| **SI-09** (kind matrix) | **Wave 5 `bench`** (corpus) + the scaffold owner (`reviewer-synthesis`) — add ≥2 briefs per non-app kind; add an operator-visible kind override; keep `checkExpectedKind` but say in the report that it is a consistency read. |
| **SI-10** (engine sink unguarded) | **Wave 5 `algo`/hygiene** or `reviewer-pipeline` — wrap `opts.onEvent?.()` / `emit()` and pin it. |
| **SI-11** (run digest is failure-only) | **Wave 5 `lessons`** — mint a clean-run digest (what worked) or state that run-level learning is failure-only. |
| **SI-12** (dead modules) | **Wave 5 `memory`/`algo`** — wire `compaction` into the P6 prompt assembly (the gap is real) or delete; decide `plugin`/`arch-tools`/`vector` explicitly (wire-or-strike). |
| **SI-13, SI-14** | **none** — both are correctly self-declared in code; keep them as the honesty reference. |
