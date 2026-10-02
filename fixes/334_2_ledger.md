# W48 / 334-2 — "Ledger" — spend truth, run-result plumbing, record accuracy (pass 3)

Lane log (append-only). Repo `C:\Users\mnril\Desktop\RapidTool Main` (path has a space).
HEAD at open **`0d5b250`**, tree clean except `wave_plans/W48/`. Pinned Node **22.23.2**
(`%LOCALAPPDATA%\hermes\node\node.exe`); host Node **24.15.0**; every parsed `node --test` run used
`--test-reporter=tap`. Owned files (STRICT): `src/lib/token-ledger.ts`, `src/lib/headless.ts`,
`src/lib/doctor.ts` + their `*.test.ts`, plus the doc correction in `fixes/331_0_parent.md` (assigned
this wave). No keyed calls, no `npm run eval`, no full gate; scratch under `%TEMP%\rt334_2\`.
`src/lib/types.ts` / `src/lib/engine.ts` were **not edited** (unowned) — the exact request is §4.

---

## 1. Step 0 reconciliation — claimed / on disk / still open

### Claimed (332-2 + its F-5 follow-up, `fixes/332_2_ledger.md`)

- L1 spend truth: `SpendSlice` / `normalizeLedger` / `accumulateSpend` / `spendDelta` added to
  `token-ledger.ts`; `runUntilGate` folds the session delta into `Project.tokenUsage`;
  `summary.budget.spent` and `doctorStatus`/`doctorSpend` read it back via `resolveDoctorSpendSource`.
- F-5: `doctorLlmKey` (`not-configured` / `unverified` / `rejected`), `readLastKeyedOutcome`,
  `headless.resolveDoctorKeyState`, `DoctorStatus.llm.keyState` + tail-only `lastKeyed`.
- Stated owe: non-`gate` verbs (`repairTreeDir`, `wildStep`, console `runPhaseAsync`) do not fold
  spend; a prior process's key rejection is invisible to a fresh `doctor` (the tap is process-local).

### On disk (re-verified today by grep/read)

- `token-ledger.ts`: `SpendSlice` (:158), `isMeasuredSpend` (:175), `normalizeLedger` (:195),
  `accumulateSpend` (:218), `spendDelta` (:245) — all present, unchanged this pass.
- `headless.ts` (HEAD): the `runUntilGate` spend fold (:1224–1230), `resolveDoctorSpendSource`
  (:4281), `resolveDoctorKeyState` (:4319), `readStatusLastKeyed` (:4302), the `doctorStatus` LLM
  `Object.assign` (:4389).
- `doctor.ts` (HEAD): `doctorSpend` (:711), `readLastKeyedOutcome` (:800), `doctorLlmKey` (:823),
  `KEY_UNUSABLE_CODES` (:778) — the F-5 vocabulary is real bytes.
- **Claim-vs-bytes divergence: none.** Every falsifiable claim in `fixes/332_2_ledger.md` reproduced.

### Still open (with `file:line` at HEAD `0d5b250`) — this pass's work

1. **L1** a prior process's key rejection is invisible to a fresh `doctor` — the tap is process-local.
   - `headless.ts:4302` `readStatusLastKeyed` (process-local `llmStatus`), `:4389` `doctorStatus`
     never reads the project record for a persisted outcome; `Project` has no
     `lastKeyedOutcome` (request, §4).
2. **L2** `run`/`runUntilHitlAsync` expose no `code` — `headless.ts:802` `RunResult` has no coded
   class, so a P6-synthesis 401 cannot move the console chip (334-5) or the doctor state.
3. **L3** non-`gate` verb spend not folded — `headless.ts:3505` `repairTreeDir` (no
   `sessionTokenBudget` snapshot), `:4796` `wildStartHeadless`, `:4975` `wildStartRun`; console
   `engine.ts:3689` `runPhaseAsync` (unowned — named, not fixed).
4. **L4** `fixes/331_0_parent.md:105-106` still says the CLI carries 38 `tsconfig.scripts.json`
   errors; the real count is 0 (register `AW46-c07`, `fixes/333_2_registrar.md` R-10).

---

## 2. Fixes — before / after with real commands

### L1 — persist the last keyed outcome on the project record; a fresh `doctor` reads it back

**Root cause (bytes).** The F-5 tap lives in `llm.ts` (`lastKeyedOutcome`, process-local) and
`headless.readStatusLastKeyed` reads `llmStatus()` best-effort — on a bare-Node CLI host that server
fn cannot run, so a fresh `doctor` process returns `unverified` for a project whose LAST run was a
401. The evidence of that 401 is already on the project: codegen's `p6.synthesis.refused` rows carry
`<RT_E code> · <reason>`, and the reason carries the tail-only `key source:` label.

**Fix, inside my files.**
- `doctor.ts` — exported `isKeyUnusableCode` (the ONE key-unusable vocabulary; `doctorLlmKey` now uses
  it) so writer and reader share the set instead of duplicating it.
- `headless.ts` — new pure `keyedTrailOutcome(project)`: newest-first over the P6 trail;
  - a `p6.synthesis.attempt` ending `· ok` ⇒ `success` (clears a persisted rejection),
  - a `p6.synthesis.refused` whose class is key-unusable ⇒ `rejected` + ts + tail-only `keySource`,
  - anything else skipped (a transient/non-key failure never condemns a key — F-5's posture).
  `foldLastKeyedOutcome` writes that onto the record (`Project.lastKeyedOutcome`) at the run
  boundary via `foldInvocationEvidence`, now shared by `runUntilGate`, `repairTreeDir` and the wild
  macros. `resolveDoctorKeyState(configured, keyedOutcome?, recordPath?)` now reads the persisted
  field from `opts.projectPath` (else `<treeDir>/.rapidtool/project.json`); priority is explicit
  override → persisted record → process status surface.

**Before / after — real CLI (fresh process, no keyed call).** Scratch record with
`lastKeyedOutcome = { code: "RT_E_LLM_KEY_REJECTED", at: 1759000000000, keySource: "the process
environment (tail …a1b2)" }`:

```
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --project <tmp>\proj.json
```

```
BEFORE (HEAD 0d5b250): "llm": { "configured": true, …, "keyState": "unverified" }
AFTER  (this lane):    "llm": { "configured": true, …,
                                "keyState": "rejected",
                                "lastKeyed": { "code": "RT_E_LLM_KEY_REJECTED",
                                               "at": 1759000000000,
                                               "keySource": "the process environment (tail ...a1b2)" } }
```

`cli exit: 0`; the source label is tail-only — no key value is read or printed. The same record
round-trips through `saveProject`→`loadProject` (asserted in the new test), because
`exportProjectJson` serializes the whole object and `hydrateProject`'s `...raw` spread preserves it.

### L2 — surface the failure class on `RunResult`

`headless.ts` `RunResult` gains `code?: ErrorCode` = the coded class of the newest
`p6.synthesis.refused` row **this invocation appended** (identity-diffed against the newest refusal
present at entry, so a refusal already on the record never attaches to a clean run). A P6-synthesis
401 surfaces as `RT_E_LLM_KEY_REJECTED`. Additive + conditional — no existing consumer's shape
changes. Pinned by the new test (asserts `res.code === "RT_E_LLM_KEY_REJECTED"`). A keyed end-to-end
CLI/intake demonstration is not reproducible here (needs a paid key; the wave forbids keyed calls) —
the class is unit-pinned from codegen's own refusal-log shape.

### L3 — fold non-`gate` verb spend into the project slice

`foldInvocationEvidence(project, spendBaseline)` (spend delta + keyed fold) is now called by:
- `repairTreeDir` — every post-pre-flight return goes through a local `finish()` wrapper;
- `wildStartHeadless` and `wildStartRun` — the returned project is folded once.

Named, **not** fixed (not in my files): the console's `engine.ts:3689 runPhaseAsync` — the browser
path has no headless project file to fold into; it needs an engine.ts change (unowned).

### L4 — record accuracy

Appended a dated correction block to `fixes/331_0_parent.md` (§6 item 2: CLI = **0** errors, not 38;
`npm run typecheck` = `tsc --noEmit && node --test scripts/typecheck-scripts.test.mjs`, exit 0).
Also noted §6 item 6 (`budget.spent` resets per invocation) is superseded. The block is an append —
the §6 body is left byte-identical.

---

## 3. Tests added — real results, both runtimes

Run under Node 22.23.2 and Node 24.15.0 with `--experimental-strip-types --test --test-reporter=tap`.

| suite | baseline | after | Node 22.23.2 | Node 24.15.0 |
|---|---|---|---|---|
| `src/lib/token-ledger.test.ts` | 39 | 39 (unchanged) | 39 pass / 0 fail | 39 pass / 0 fail |
| `src/lib/doctor.test.ts` | 31 | 31 (unchanged) | 31 pass / 0 fail | 31 pass / 0 fail |
| `src/lib/headless.test.ts` | 129 | **134** (+5) | **133 pass / 1 fail** † | **133 pass / 1 fail** † |
| `src/lib/headless.test.ts` (W48 subset) | — | 5 | 5 pass / 0 fail | 5 pass / 0 fail |

† The single headless failure is **not this lane's**: subtest 24
`E-25 · emit --run: … a green tree exits 0` (an `emit --run` integration test over the
sibling-owned `scaffold.ts` / `compile-check.server.ts` / `rapidtool-cli.mjs`, all modified
concurrently this wave). It reproduces **with this entire lane stashed**
(`git stash push -- src/lib/headless.ts src/lib/doctor.ts src/lib/headless.test.ts` → still
`not ok 1`), and it is the only failure on both runtimes. My 5 new tests pass 5/5 on both.

Added (all in `headless.test.ts`, `describe("W48 · 334-2 …")`):
- `keyedTrailOutcome`: reads a key-unusable refusal (code/ts/tail-only source); a later `· ok`
  attempt ⇒ `success`; a non-key refusal ⇒ `none`; asserts no `sk-` shape can ride through.
- `runUntilGate` persists a P6-synthesis 401 on the record and surfaces `res.code`; then
  save→load→`resolveDoctorKeyState` reads it back with no override (`rejected`).
- `resolveDoctorKeyState`: record read-back, explicit override wins, a legacy record stays
  `unverified`.
- `repairTreeDir` folds its injected synthesis spend into `res.project.tokenUsage`.
- `wildStartRun` folds its macro-run's session spend into `res.project.tokenUsage` (spend recorded
  via the caller's `onEvent` sink — no key).

**RED-first (real).** (a) Pre-fix: with the two src files stashed, the whole headless suite fails to
link — `# tests 1 / # pass 0 / # fail 1`,
`SyntaxError: The requested module './headless.ts' does not provide an export named 'keyedTrailOutcome'`.
(b) Granular mutation: disabling the keyed fold + `RunResult.code` + the record-path read + the spend
fold, `--test-name-pattern="W48"` gives `# tests 5 / # pass 1 / # fail 4` (only the pure-extraction
test survives). All mutations were reverted; `MUTATION-RED` greps empty; W48 subset back to 5/5 and
the full suite re-run green (modulo the sibling E-25 failure above).

`npx eslint` on all six owned files exits 0. `npx tsc --noEmit` reports **zero diagnostics in
`headless.ts` / `doctor.ts` / `token-ledger.ts` / their tests**.

---

## 4. The `types.ts` / `engine.ts` request (unowned — parent lands at the boundary)

**REQUEST (types.ts, additive optional — no runtime behaviour, no `_v` bump):**

```ts
// on `Project` (types.ts)
/**
 * W48 · 334-2 (L1): the last keyed-call outcome this project's run observed —
 * key VALIDITY across processes. The provider tap (llm.ts) is process-local, so
 * a fresh `doctor` process cannot see a prior `gate`/`run` process's key
 * rejection; the run boundary persists the newest keyed outcome from the
 * project's own P6 trail here. `keySource` is a tail-only path/scope label —
 * NEVER a key. Absence = no keyed outcome recorded (readers report `unverified`,
 * never an implied green).
 */
lastKeyedOutcome?: { code: string; at: number; keySource?: string };
```

- **Name / type / optionality:** `lastKeyedOutcome?`, same shape as `llm.ts`'s `LastKeyedOutcome` /
  `doctor.DoctorLastKeyed` (`{ code: string; at: number; keySource?: string }`). Optional/absent by
  default.
- **Write site:** `headless.ts` `foldLastKeyedOutcome` (called by `foldInvocationEvidence` at the
  `runUntilGate`, `repairTreeDir`, `wildStartHeadless`, `wildStartRun` boundaries) — the ONLY writer.
  It sets the field only when the trail names a key-unusable refusal, clears it when a newer
  `p6.synthesis.attempt · ok` proves the last keyed call succeeded, and leaves a legacy record
  untouched when there is no keyed evidence.
- **Read sites:** `headless.persistedKeyedOutcomeAt` → `resolveDoctorKeyState(…, recordPath)` →
  `doctorStatus.llm`; `doctor.readLastKeyedOutcome` / `doctorLlmKey` validate it. Lane **334-5** may
  read `record.lastKeyedOutcome` as a cross-process chip signal (its own file).
- **Migration-in-place:** a record without the field stays absent; readers never invent it (raw value
  is validated; junk is dropped). No `_v` bump — pure additive widening.
- **Consumer impact:** none breaking. `saveProject`/`exportProjectJson` serialize the whole object and
  `hydrateProject` spreads `...raw`, so the value already round-trips at runtime; the grant only makes
  the field type-visible/type-checked.
- **What waits on the grant:** nothing runtime — the writer/reader compile today via a local
  intersection type (`Project & { lastKeyedOutcome?: DoctorLastKeyed }`) and the persisted value
  round-trips. The grant is needed so the field is a first-class `Project` property (discoverable,
  excess-property-checked) for future consumers.

**SECOND REQUEST (store.ts, owned by 334-5 this wave — reported, not implemented here):**
store's `RunResult` (`src/lib/store.ts:51`) should gain `code?: ErrorCode` on the failure arm,
populated from the P6 refusal class, so the console chip (334-5) can move on a P6-synthesis 401. My
`headless.RunResult.code` covers the CLI `run`/`gate` verbs; the console path is `store.advanceOnceAsync`
→ `engine`, so the class must be surfaced there. `engine.ts:3689 runPhaseAsync` (console) is likewise
named for the L3 spend fold.

---

## 5. What I did NOT do / stopped on

- **Did not edit `src/lib/types.ts` or `src/lib/engine.ts`** — the request is §4.
- **Did not fix the console path** (`engine.runPhaseAsync`, `store.RunResult`) — not my files;
  lane 334-5 owns `store.ts`/`llm.ts` this wave.
- **Did not reproduce a keyed 401 end-to-end** — no keyed calls permitted; the L1/L2 behaviour is
  pinned against codegen's own refusal-log shape with stubbed evidence.
- **Did not run the full gate / `npm run eval`**, and did not touch any file beyond my six + the
  assigned doc correction. The single headless failure (E-25 `emit --run`) is a concurrent sibling
  edit, proven independent of this lane by stashing it.
