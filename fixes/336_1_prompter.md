# W50 / 336-1 — "Prompter" — pipeline completeness (pass 5)

**Actor:** Prompter (producer gaps + the P0→P12 wiring proof). **Owned files (STRICT):**
`src/lib/phases.ts`, `src/lib/prompt-engine.ts`, `src/lib/codegen.server.ts`, `src/lib/engine.ts` (granted this
wave) + their tests; this log. **HEAD at open:** `fac37d4`, tree clean (siblings edit concurrently).
**Contract:** `wave_plans/W50/README.md`. **Runtime:** Node 22.23.2 pinned
(`%LOCALAPPDATA%\hermes\node\node.exe`) **and** host Node v24.15.0; every `node --test` parse used
`--test-reporter=tap`. **Scratch:** `%TEMP%\rt336_1\` (outside the repo). No keyed call, no full gate, no
`npm run eval`, no secret printed, no repo probe file.

---

## §0 Step 0 — reconciliation (claimed / on disk / still open)

### Claimed (from `fixes/331_1_keywright.md`, `fixes/332_1_prompter.md` + the 333-1 follow-up,
`fixes/334_1_prompter.md` + 334-1c, `fixes/335_1_prompter.md`, `fixes/335_0_parent.md` §5, `fixes/335_7_guardian.md` §F)
- **332-1 P1 async guard** (`declaredAsyncFunctionNames`, `asyncExportNames`, `asyncNamesInScope`,
  `unawaitedAsyncValueUses`, `ChunkPriorFile.asyncExports`, refusal `RT_E_VALIDATION`, one bounded await
  re-prompt, system rule 9 + chunk async mark). **333-1 F-1/F-2** (`memberAccessAfter` shapes, `computed-read`,
  `constStringLiterals`, `asyncMethodBodyRanges`/`this.m()`, deletion of `treePlanCensusReconciles`).
  **334-1** (const-key, `this.m()`, shortfall row survives, R12-f01 byte budget) + **334-1c** (evidence hash
  folds declared-script state).
- **335-1**: closed the optional-call `?.(` bypass; scoped system rule 2; wrote honest P8/P9/P12 summaries;
  added `POLICIES-ELIDED`/`LESSONS-ELIDED` markers in `prompt-engine.ts`; verified a driven keyless run reaches
  P12 with every tail artifact. `codegen.server.test.ts` 170→172, `phases.test.ts` 10→13.
- **335-0 §5.1 (the STOP item this wave closes):** P8 "component code with a live key", P9 "GPU allocation
  scripts", P12 "database schemas / frontend-backend parity" have no producer; the P12 DB schema is derivable
  from `project.contracts.entities`. Owner: the next wave that takes an engine grant — **this one**.

### On disk (bytes read today, 2026-10-02)
- `phases.ts` — `PHASE_TAIL_START` `:160`; `PhaseCoverage` type `:171`; `phaseCoverage` `:211`;
  `phaseCoverageLine` `:249`; the T-14 docblock `:163-170`. All present.
- `engine.ts` — `synthesizePhase` `:572`; P12 case `:1215-1290`; `applyPhaseResult` `:1477`;
  `art()` `:275-290`; `attachAlgorithms` `:1292`. All present.
- `codegen.server.ts` — system prompt rules 1–9 `:550-596`; `unawaitedAsyncValueUses` `:2592`;
  `asyncMethodBodyRanges` `:2532`; `chunkTypeSignatures` `:1679`; `treeChunkPlanCensus` `:2008`; the single
  `p6.tree.shortfall` push `:4186-4196`. All present.
- `prompt-engine.ts` — `POLICIES-ELIDED`/`LESSONS-ELIDED` markers present (335-1 4D). No 336-1 change needed.
- Baseline suites (read today, Node 22): `phases.test.ts` **13** · `prompt-engine.test.ts` **29** ·
  `codegen.server.test.ts` **172** · `engine.test.ts` **14**.

### Still open (with `file:line`, before this pass)
1. **P8 producer gap** — "component code with a live key" — `phases.ts:70-77` named it a gap; no producer.
2. **P9 producer gap** — "GPU allocation scripts" — `phases.ts:78-85` named it a gap; no producer.
3. **P12 producer gap** — "database schemas / frontend-backend parity" — `phases.ts:100-107`; DB schema
   derivable from `project.contracts.entities` (`types.ts:391`).
4. **Census disagreement** — `phaseCoverage` (`phases.ts:211`) counted the driver's DoD **gate** row
   (`kind:"gate"`) as a phase deliverable: the same 13-phase run reported **8** deliverables under
   `testing/fixtures.ts:runHeadless` (no gate rows) but **14** under `headless.runUntilGate` (each phase's gate
   row) — and it could not name a complete phase that produced nothing.
5. **P6 residual — prompt rule 9 over-claimed** its enforcement (the guard cannot see a named receiver, an
   indirect call, or a non-`async` Promise-returner) — `codegen.server.ts:588-596`.
6. **P6 residuals — async limits / chunk bounds / `p6.tree.shortfall`** were *stated* (335-1 §5) but several
   were un-pinned prose.
7. **Async guard lexical limit (stated, kept)** — a method whose `async NAME(` declaration does not begin its
   own line is not discoverable by `asyncMethodBodyRanges` (`codegen.server.ts:2532`); the docblock did not say so.
8. **STOP-and-REPORT expectation:** no do-not-touch file needed this wave; the async named-receiver / indirect /
   non-`async`-Promise limits remain genuine undecidables and stay documented, not "fixed".

---

## §1 Checkpoint — intended patches (per hard rule 9, before applying)

- **A. `engine.ts` (P12 producer):** add `databaseSchemaSql(contracts)` (pure DDL deriver) + wire a third P12
  artifact. Surgical; re-read before patch.
- **B. `phases.ts`:** P8/P9 summaries state the *reason*; P12 summary states the schema is produced and parity
  remains the gap; `phaseCoverage` excludes the packet **and gate** bookkeeping rows and reports `emptyPhases`.
- **C. `codegen.server.ts`:** scope rule 9's enforcement claim (the 4B doctrine) + a precise docblock clause on
  the line-anchored `this`-receiver discovery.
- **D. Tests:** `phases.test.ts` (+4), `engine.test.ts` (+3), `codegen.server.test.ts` (+4); RED against a
  byte-faithful HEAD worktree.
- All strictly inside the four owned files + their tests.

## §2 The three producers — decision per deliverable (with the driven probe)

Driven, keyless advisory run in scratch (`%TEMP%\rt336_1\census.ts`), exactly the CLI the operator drives:
`createProject({brief, name})` → `runUntilGate` + `approve` loop to completion. The run reached **P12**
(`status:"complete"`, 13/13 records). Per-phase census (real output):

```
status: complete currentPhase: 12   complete records: 13
P0  rec=complete enter=true gate=pass n=3 kinds=[algorithm,gate,scorecard]
P1  rec=complete enter=true gate=pass n=2 kinds=[gate,graph]
P2  rec=complete enter=true gate=pass n=2 kinds=[gate,memory]
P3  rec=complete enter=true gate=pass n=2 kinds=[gate,mcp]
P4  rec=complete enter=true gate=pass n=2 kinds=[gate,security]
P5  rec=complete enter=true gate=pass n=2 kinds=[gate,validation]
P6  rec=complete enter=true gate=FAIL n=3 kinds=[code,gate]
P7  rec=complete enter=true gate=FAIL n=2 kinds=[gate,research]
P8  rec=complete enter=true gate=pass n=2 kinds=[gate,ui]
P9  rec=complete enter=true gate=pass n=3 kinds=[cicd,gate]
P10 rec=complete enter=true gate=pass n=2 kinds=[edge,gate]
P11 rec=complete enter=true gate=pass n=2 kinds=[gate,tools]
P12 rec=complete enter=true gate=pass n=(docs,gate,packet)
artifact-kind union coverage: 16/16 produced (scorecard graph memory mcp security validation code
  research ui cicd edge tools docs packet algorithm gate)
```

**P12 — database schema: IMPLEMENTED.** `project.contracts.entities` genuinely carries the input (6 entities ×
`{name, fields:[{name,type}]}`, types `ulid|string|enum|int|datetime` + `?`), so the DDL is DERIVED, never
invented. New pure producer `databaseSchemaSql` + a third P12 `docs`/`sql` artifact (see §3).
**P12 — frontend/backend parity: REASONED GAP.** `DataContract` is `{entities, endpoints:{method,path,job}}`
(`types.ts:389-393`): the P8 screen/action surface is an artifact *body* and no field binds a screen/action to
an endpoint, so a parity table would have to invent the mapping. A repo-wide scan finds no `parity` artifact or
producer. The phase summary now says exactly that instead of a bare "roadmap declaration".
**P8 — component code with a live key: REASONED GAP.** The spec graph does name one UI node —
`algorithms.ts:775` `{id:"ui", file:"src/ui/console.tsx", purpose:"Operator surfaces bound to store fields"}`
— but there is no component-level contract (no JSX/props/state), and the P6 synthesis lane is a
TypeScript-**module** generator whose output is validated by `validateSynthesisModule` and materialized as
loadable ESM `.ts` (`materializeImportableTree`); `strip-types` cannot load `.tsx`. Probe: repo-wide grep for a
`.tsx`-emitting synthesis path finds none (scaffold only writes the static `src/main.tsx` shell;
`scaffold.ts:2928` states "`src/ui/` is a contract-level shell (P8 interface contract), not a finished UI").
Emitting component code would mean inventing both the contract and the runtime support.
**P9 — GPU allocation scripts: REASONED GAP.** Repo-wide grep (`src/**` non-test + `scripts/**`) finds the token
`gpu` exactly once outside the phases table: `engine.ts:1150` `gpu: provision only for local-edge promotion
jobs` — a line inside the recorded IaC sketch. No brief/spec field names a GPU workload, model or instance
class. A GPU script would have to be invented.

Because the summaries are pinned, `phases.test.ts` now asserts the reason for P8/P9 and both the produced
schema and the parity gap for P12 (§7).

## §3 Fix — the P12 database-schema producer (landed, RED-first)

**Landed (`engine.ts`):** `schemaSqlType(type)` `:515` (int→INTEGER, datetime→TIMESTAMP, ulid/string/enum→TEXT,
unknown→TEXT) and `export function databaseSchemaSql(contracts)` `:542`; wired at the P12 case `:1270-1275`:

```ts
const schema = databaseSchemaSql(project.contracts);
artifacts: [
  art(12, "docs", "Architecture Decision Records", adr, "markdown"),
  art(12, "docs", "OpenAPI 3.1", openapi, "yaml"),
  ...(schema ? [art(12, "docs", "Database schema (SQL DDL)", schema, "sql")] : []),
],
```

Every table/column comes from a contract entity/field; `id` (non-null) is the PRIMARY KEY; a `?`-suffixed type
is nullable; a contract with no entities returns `""` and emits **no** artifact (no fabricated schema). The
body's own header declares the dialect and the honesty (B-18): `-- Declarative spec only: the emitted scaffold
provisions and runs no database (B-18).` Real produced bytes (driven run):

```
-- Database schema derived from the A6 data contract (project.contracts.entities).
-- Declarative spec only: the emitted scaffold provisions and runs no database (B-18).
-- Dialect: PostgreSQL.

CREATE TABLE IF NOT EXISTS "Shop" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "status" TEXT NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);
… (Flipper, Ledger, House, Property, Home — one table per contract entity)
```

**RED — before (real command output, pre-change tree):** the driven P12 artifact census listed only
`Architecture Decision Records`, `OpenAPI 3.1`, `DoD gate — P12`, `Agent packet (A4)` — **no schema**. The new
`phases.test.ts` test "W50/336-1: P12 produces the database schema derived from the A6 data contract" and the
new census field assertion both FAIL against a byte-faithful HEAD worktree (`%TEMP%\rt336_1\wt`, `git worktree
add --detach HEAD` + node_modules junction, removed afterwards):

```
    not ok 1 - W50/336-1: P12 produces the database schema derived from the A6 data contract
    not ok 2 - W50/336-1: every phase enters, records and hands off — no empty phase, no orphaned artifact kind
    not ok 5 - W50/336-1 phaseCoverage bookkeeping
    # tests 10 · # pass 3 · # fail 7
```

**GREEN — after (working tree):** the P12 artifact row exists with `kind:"docs"`, `language:"sql"`, one
`CREATE TABLE` per contract entity and every contract column present, and the schema is honest about not being
executed. All owned suites green on both runtimes (§7).

## §4 Fix — the `phaseCoverage` census now agrees with what each phase produces

**Finding (real):** on HEAD, `phaseCoverage` excluded only the packet row, so the driver's per-phase DoD **gate**
row counted as a deliverable. The same 13-phase run therefore reported **8** artifacts under the fixture driver
(`testing/fixtures.ts:runHeadless`, no gate rows) and **14** under the product driver
(`headless.runUntilGate`, one gate row per phase) — an inconsistency between surfaces, and it could not name a
complete phase that produced nothing.

**Landed (`phases.ts`):**
- `phaseCoverage` `:211` now excludes **both** bookkeeping kinds (`isBookkeeping` `:226`: `"packet"` and
  `"gate"`), so `tailArtifacts` counts only rows a phase producer wrote and is driver-independent.
- `PhaseCoverage` gained `emptyPhases: PhaseId[]` (`:188`) — complete phases that recorded **no** deliverable
  row; a silent no-op is named instead of hidden behind the tail total (`:236-241`).
- The T-14 docblock states both exclusions and the `emptyPhases` meaning (`:190-210`). `phaseCoverageLine`
  is **unchanged** (byte-identical), so no rail/envelope pin moves for the 0/7-phase cases.

Driven run after the change: `coverage: {"executed":13,"total":13,"tailArtifacts":9,"tailStart":7,
"emptyPhases":[]}` — 9 deliverables (P7 research 1, P8 ui 1, P9 cicd 2, P10 edge 1, P11 tools 1, P12 docs 3),
`emptyPhases` empty.

## §5 P6 residuals — audit, fix, pin

**Prompt rules (FIXED — an enforcement over-claim).** Rule 9 (`codegen.server.ts:595`) said
"…never `const x = getProperty(id); x.ok` **(validator-enforced: an un-awaited async call reads `undefined` off a
Promise …)**" — but the guard only sees direct calls, `this`-receiver calls inside a discoverable declaring
class, and optional calls `?.(`; it cannot see a named receiver, an indirect invocation, or a Promise-returner
not spelled `async`. That is the same class of over-claim 335-1 4B fixed for rule 2, and it is corrected the
same way: the parenthetical is scoped, the reason is kept, and the undetectable shapes are named as the model's
own duty. RED/GREEN proof (`%TEMP%\rt336_1\red-rule9.ts`, evaluating the new assertions against HEAD's rule-9
bytes read from git and against the working tree):

```
PRE-FIX (HEAD) rule 9:   FAIL unscoped parenthetical gone
                         FAIL scoped sentence present
                         FAIL Promise-returner over-claim gone
POST-FIX (working tree): PASS / PASS / PASS
```

A new drift-proof pin asserts the rules carrying the literal `(validator-enforced)` are **exactly {2, 4, 8}**
(rule 4's primitive list is pinned elsewhere at `codegen.server.test.ts` 215b; rules 2/4/8 each map to a real
check in `validateSynthesisModule`). Rules 1/3/5/6/7 make no enforcement claim and stay model instructions.

**Async guard's stated limits (PINNED + docblock precision).** New test pins each documented limit against the
bytes: `store.getProperty(id).ok` (named receiver) → accepted; `getProperty.call(null,id).ok`,
`(getProperty)(id).ok`, `(0, getProperty)(id).ok` (indirect) → accepted; `function f(){ return new
Promise(()=>{}) }` → `asyncNamesInScope` = [] (undiscoverable); `getProperty(id)[k]` → refused as
`computed-read` (the one conservative refusal). It also pins the newly-stated sub-limit: a `this.m()` read is
refused when the `async NAME(` declaration begins its own line and accepted when it does not (the line-anchored
`asyncMethodBodyRanges`). The docblock (`:2590-2598`) now states that line-anchored requirement.

**Chunk bounds (PINNED).** New test pins `chunkTypeSignatures(sigs, perChunk)` for `perChunk ∈ {0, -1, NaN,
Infinity}` → all fall back to `P6_SYNTH_CHUNK_SIZE` (`[8,8,4]` for 20 sigs), and that duplicates, blanks and
non-strings never fork a chunk (`["a","a","b","","b",5]` → `[["a","b"]]`).

**`p6.tree.shortfall` row (VERIFIED, unchanged).** The row is emitted once at `codegen.server.ts:4196` when
`treeChunkPlanCensus(...).unbound.length > 0`, carries the full `declared/planned/unbound` partition, and is
pinned by the existing tests "W45/331-4 … ONE p6.tree.shortfall warn" and "334-1 P2: the surviving
unbound-declared-job shortfall row fires; the deleted reconcile row left no debris" (both green in the 176/176
run). No defect found; the row's documented scope difference vs the p6-arch DoD probe (census counts job
**labels**, `archCapabilities` demands **signature** names) remains explicitly stated in 332-1 §2 and is pinned
by the run-A/run-B recorded-bytes tests, not silently "reconciled".

**`prompt-engine.ts` — no change.** 335-1's `POLICIES-ELIDED`/`LESSONS-ELIDED` markers are present and its two
count-cap assertions remain green (`prompt-engine.test.ts` 29/29). No new defect found in the touched paths.

## §6 The wiring proof — a driven run: every phase enters, records, hands off

Path: `createProject` → `headless.runUntilGate` (maxSteps 1) + `approve` to completion, the same driver the CLI
uses. Asserted for the driven run (new `phases.test.ts` test, green on both runtimes):

- **Enters:** every one of P0–P12 logged `phase.enter` (asserted per phase id).
- **Records:** all 13 phase records `status:"complete"`, each with a recorded DoD verdict `gate`.
- **Produces:** every phase wrote ≥1 non-bookkeeping artifact of its declared kind (`TAIL_KIND`), and **all 16
  `ArtifactKind` members are produced** — no orphaned kind.
- **Hands off:** the packet is recorded (`kind:"packet"`) and names the current edge (`## Current edge`); the
  census reports `13 of 13 phases executed / 9 artifacts from P7–P12` with `emptyPhases: []`.
- P12 wrote non-empty `openapi`, `adr`, and the new `Database schema (SQL DDL)`.

## §7 Tests added + real results (both runtimes)

| Suite | Before | After | Added |
|---|---|---|---|
| `src/lib/phases.test.ts` | 13 | **17** | +4 (P12 producer; wired-run enter/record/handoff + kinds; census bookkeeping ×2) |
| `src/lib/engine.test.ts` | 14 | **17** | +3 (`databaseSchemaSql` derive / fabricate-nothing / determinism+escape) |
| `src/lib/codegen.server.test.ts` | 172 | **176** | +4 (rule-9 scoping; enforcement-claim set; async limits; chunk bounds) |
| `src/lib/prompt-engine.test.ts` | 29 | 29 | 0 (unchanged) |

**RED (byte-faithful HEAD worktree `%TEMP%\rt336_1\wt`, new tests vs pre-fix sources):** `# tests 10 · # pass 3 ·
# fail 7` — the P12-producer, wired-run, census, summary-pin and rule-9 tests all red on HEAD; the three
*pins* (enforcement-claim set, async limits, chunk bounds) pass on HEAD as they should (they describe existing
behaviour).

**GREEN — owned suites, both runtimes:**
```
Node 22.23.2 : # tests 239 · # suites 50 · # pass 239 · # fail 0 · # skipped 0
Node 24.15.0 : # tests 239 · # suites 50 · # pass 239 · # fail 0 · # skipped 0
```
Consumers (Node 22): `diagram`/`io`/`headless`/`store`/`maker-score`/`algorithms` **480/480**; the seven-suite
batch `gates`/`packet`/`scaffold`/`dod`/`wild-step`/`verify.server`/`arch-tools` = **301 tests · 299 pass · 2
fail**, where the only two failures are the STOP pins in §9 (`scaffold`/`dod`/`wild-step`/`verify.server`/
`arch-tools` are 144/144). `npx tsc --noEmit` → **0 errors**; `npx eslint` on all seven owned files → **exit 0**.

## §8 Mock/fake census over my files

`grep` for `TODO|FIXME|XXX|as any|@ts-ignore|@ts-expect-error|catch {}|placeholder|mock|fake|stub|HACK` over
`engine.ts`, `phases.ts`, `prompt-engine.ts`, `codegen.server.ts`:

- **`as any` / `@ts-ignore` / `@ts-expect-error` / empty `catch {}`: none.**
- `mock`/`fake` mentions are all doc comments describing the **injected-deps test seam** (the repo's own
  precedent, e.g. `headless.applyVerifyOutcome` in codegen) — no fake computation.
- `placeholder`/`stub` mentions all describe the **honest deterministic-floor module** (`P6 placeholder module
  (deterministic template)`, `template-stub files`), which is a documented product artifact, not a hidden fake.
- **Findings (pre-existing, unchanged, not a placeholder body):** two `TODO(FM-03b)`/`TODO(FM-04b)` comment
  markers in `codegen.server.ts` (`:1024`, `:3553`) documenting a bounded future widening, and the
  `TODO(R13-f02)` token inside `engine.ts`'s honest empty-plan note (`:3899`) — a cross-reference to the console's
  labelled R13-f02 disclosure (`console.tsx:7297`), not a stub. No `TODO` functions, no hardcoded returns.

**Census verdict: clean** (no fake/mock/placeholder behaviour in my files).

## §9 STOP-and-REPORT (do NOT edit — unowned files)

**1. Two census pins now read 8 where the honest value is 9.** Adding the P12 database-schema deliverable
moves `phaseCoverage.tailArtifacts` from 8 to 9 for a completed 13-phase run. Two **unowned** suites pin 8 and
now fail by exactly one:

| File (owner) | Line | Current | Needed |
|---|---|---|---|
| `src/lib/gates.test.ts` (unassigned) | `:428` | `"…13 of 13 phases executed / 8 artifacts from P7–P12"` | `… / 9 artifacts …` |
| `src/lib/gates.test.ts` | `:436` | `assert.equal(tail, 8, …)` | `assert.equal(tail, 9, …)` |
| `src/lib/packet.test.ts` (336-3 Transit) | `:572` | `"… / 8 artifacts from P7–P12"` | `… / 9 artifacts …` |
| `src/lib/packet.test.ts` | `:580` | `assert.equal(tail, 8, …)` | `assert.equal(tail, 9, …)` |
| `src/lib/packet.test.ts` | `:582` | `{ executed: 13, total: 13, artifacts_from_p7_p12: 8 }` | `… : 9 }` |

Observed failure (Node 22, real): `# tests 301 · # pass 299 · # fail 2` — `not ok 12 - T-14 — phase coverage
census on real runs` and `not ok 53 - T-14: a completed 13-phase run reports its real 13 of 13 / 8 — matching
the artifact rows`. Every other consumer is green. The 0/7-phase pins (`gates.test.ts:447`, `packet.test.ts:525`
/`:556`/`:563`) are unaffected (their tail count is 0). Per the ownership rule I did **not** edit these files;
the parent (and 336-3, who owns `packet.test.ts`) should apply the 8→9 update, or authorize me to.

**2. Nothing else STOPped.** No do-not-touch path was read-modified; no secret; no deletion.

## §10 What I did NOT do, and why

- **No keyed call — usage 0 tokens.** The mission's deliverable (producer + wiring proof + census) is provable
  keylessly and was; the keyed P6-PASS reference is already recorded (332-0 §4). No `npm run eval`, no full
  gate, no `npm test`, no build.
- **Did not invent a P8 component-code path or a P9 GPU script** (§2) — the input genuinely does not exist and
  the runtime cannot load TSX; both stay explicit reasoned gaps, now with the reason in the phase table.
- **Did not produce a frontend/backend parity artifact** — the contract binds no screen/action to an endpoint;
  a parity table would fabricate the mapping.
- **Did not chase the async guard's named-receiver / indirect / non-`async`-Promise limits** — undecidable from
  a bare name without type resolution; kept documented and pinned, not guessed.
- **Did not edit `gates.test.ts` / `packet.test.ts`** (STOP item §9), `headless.ts`, `dod.ts`, `scaffold.ts`,
  `types.ts`, or any other unowned file.
- **Did not touch the pre-existing `TODO(FM-03b)`/`TODO(FM-04b)`/`R13-f02` comment markers** — they document
  bounded future work / a labelled disclosure; removing them is out of the mission's scope and would be an
  unrequested cleanup (hard rule 2).
- No repo probe file: all scratch (`census.ts`, `probe-p6.ts`, `probe-async.ts`, `red-rule9.ts`, the removed
  worktree) lives under `%TEMP%\rt336_1\`; `git worktree list` shows only the main tree.

## §11 Verdict

**The producer gaps are closed where the input is real and reasoned where it is not.** P12 now produced a
database schema genuinely derived from `project.contracts.entities` (driven-run bytes in §3); P8 and P9 remain
explicit, reasoned gaps (the brief/spec carries no component contract and no GPU input) with the reason now in
the phase table. The `phaseCoverage` census now counts what each phase produces — the packet **and gate**
bookkeeping rows are excluded, so the same run reports the same total under either driver, and a complete
phase that produced nothing is named via `emptyPhases`. The P6 residuals are cleared: rule 9's over-claimed
enforcement is scoped (RED→GREEN), the async guard's limits and the chunk bounds are pinned against the bytes,
and the `p6.tree.shortfall` row is verified intact. A real driven run proves every phase enters, records and
hands off, with all 16 artifact kinds produced and no empty phase. 239/239 owned tests on both runtimes;
typecheck 0; lint 0. The only STOP item is two unowned census pins that must read 9 instead of 8 (§9).
