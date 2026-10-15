# fixes/356 — lane `restore-oracle` (W356 A3 / 355-A3 L5+L6) — SKELETON

**Wave:** W356 (green recovery + ratchet). **Lane:** `restore-oracle` (persona `quill`), 1 of 6.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (path contains a space). **Shell:** Windows PowerShell 5.1.
**Host:** Node **v24.15.0** (`node -v`; the repo's `engines` contract is `>=22`).
**HEAD:** `30bce78b84903d2d64a84c4902c732f40bd14a29` (`main`) — **dirty tree**; every number below describes
**the bytes on disk**, not a frozen commit.
**Owned files (mine alone):** `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`. Nothing else was edited.
**Log:** append-only; this lane is its only writer.

## §0 — Skeleton (written BEFORE the edits, per the wave convention)

### Mission (quoted from `wave_plans/W356/restore-oracle.md`)

1. **An unwired oracle row must not condemn the tree.** The 354 emitter turned every unwired row into a
   reachable `assert.fail("<id> is NOT IMPLEMENTED")`, so any emission carrying one failed its own
   `npm test` and `emit --git` withheld. Replace it with an honest, **surfaced, counted** shortfall that
   still lets a real product be delivered. Keep the 354 honesty intent (visible, never silent) and keep
   every existing assertion for rows that ARE wired.
2. **Restore the safety default.** `underProduced` absent ⇒ `"refuse"`; `"refuse"` ⇒ zero files;
   `"banner"`/`"partial"` ⇒ land the partial WITH the unmissable banner. Cross-lane: `restore-census`
   forwards the policy explicitly from `headless.ts`; I honor it in `scaffold.ts`. `headless.ts` untouched.
3. **Fix the two drifted test cases** at `scaffold.test.ts:2712` / `:2719`
   (`Property 'gameTemplate' does not exist on type 'ScaffoldResult'`) — both classified **test-wrong** by
   the audit (`okFiles()` never narrows the union). Fix the test's narrowing, not the source.
4. **Re-verify by measurement**, both directions: the repo's own
   `--test-name-pattern="default refuses before writing"` passes; a partial with all rows wired reaches
   `treeRun.ok === true`; a partial with unwired rows is green **while reporting its shortfall**; a
   complete emission is green.

### Planned verification commands

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts
node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="default refuses before writing" src/lib/headless.test.ts
# one bounded KEYLESS emit + the emitted tree's own toolchain, into %TEMP% (never the repo)
```

### Not run (hard constraint)

`bash scripts/gate.sh`, `npm run build`, a full `npm test`, any keyed LLM call, any git write.
Probe files live in `%TEMP%\rt-oracle-probe\` only.

### Red baseline expected at dispatch (from `fixes/355_0_audit_wave.md` §0)

`npx tsc --noEmit` exit 2 (5 errors, 3 test files) · `npm test` exit 1 (15 failures, src leg never ran).

---

*The measured results, the old→new tables and the cross-lane consequences are appended below (§1–§6).*

---

# APPEND 1 — measured results (old→new), landed bytes

## §1 — Baseline measured BEFORE my edits (the bytes on disk at dispatch)

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit            # exit 2 · 5 errors in 3 test files
```
Mine (the two the audit classified **test-wrong**):
`src/lib/scaffold.test.ts(2712,25): error TS2339: Property 'gameTemplate' does not exist on type 'ScaffoldResult'`
and the same at `:2719`. (`okFiles()` returned `ScaffoldFile[]` — the union's ok-only fields were never
narrowed at the call site.) The other 3 errors were `headless.test.ts:5999` and `wild-step.test.ts:1399/1415`
(other lanes' files).

Emission baseline, measured with a probe (`%TEMP%\rt-oracle-probe\probe.mjs` + `measure.mjs`, which call
`scaffoldProject` over `src/lib/testing/fixtures.ts` fixtures, write the tree to `%TEMP%\rt-oracle-probe\trees\<name>`,
run the tree's OWN declared `npm test`, then `compile-check.server.treeRun(dir)`):

| tree (fixture) | spec `assert.fail(` | emitted tree's own `npm test` | spec leg | `treeRun.ok` |
|---|---|---|---|---|
| partial + 1 unwired row of 6 (`primed({kind:"tool"})` + substance + a recorded `RT_E_PLAN_UNDERPRODUCED`) | 1 (the row) | **exit 1** | `pass 10 / fail 1` | **false** — `RT_E_TREE_RUN_FAILED` |
| partial, all 5 rows wired | 0 | exit 0 | `pass 10 / fail 0` | true |
| complete (`runHeadless(seedProject(), ALL_PHASES)`) | 0 | exit 0 | `pass 15 / fail 0` | true |

The treeRun error text names the mechanism exactly:
`the emitted project's own \`npm run test\` fail (exit 1) … · the emitted spec tests/oracle.spec.ts fail — test "orc-phase" failed`
— i.e. **one unwired A7 row condemned the whole tree** (355-A3 **L5**, reproduced).

## §2 — old→new

### 2.1 An unwired A7 row: reachable failure → marked, counted shortfall

| | old (354 bytes) | new (my bytes) |
|---|---|---|
| row test head | `test("<id>", () => {` | `test("<id>", { skip: "<marker>" }, () => {` — `scaffold.ts:6255-6267` |
| row body | `assert.fail("<id> is NOT IMPLEMENTED — replace this failing row …")` | comments only — **no assert call** (`scaffold.ts:6407-6421`) |
| row-level marker | the assertion text (unreachable until the row fails) | `ORACLE_SHORTFALL_MARKER` (`scaffold.ts:5667-5669`), printed by the TAP reporter on the row's own line: `ok 11 - orc-phase # SKIP NOT IMPLEMENTED - no emitted module surface targets this row yet (oracle shortfall, counted in README.md; a skip is not a pass)` |
| counted total (spec header) | none | `// ORACLE SHORTFALL: <k> of <m> pinned A7 row(s) are …` — `scaffold.ts:6036-6044` |
| counted total (README census) | `<a> of <m> …; <k> are NOT IMPLEMENTED — emitted as REAL failing rows (never a skip), so \`npm test\` exits non-zero` | `ACCEPTANCE SHORTFALL — <k> of <m> … MARKED skips under their pinned ids … A skip is not a pass: the shortfall is named here and never silent: <ids>` — `scaffold.ts:8096-8106` |
| DEPLOY.md / README Commands | "FAIL this run (a real failing test, never a skip)" | "ORACLE SHORTFALL … MARKED skips … the tree-run refuses a skip-dominated spec as a vacuous green (`RT_E_SPEC_SKIP_VACUOUS`)" — `scaffold.ts:7925-7935`, `:8284-8286` |

**Why the body carries no assert** (measured constraint): `compile-check.server.ts`'s
`specSourceHasBehaviouralAssert` masks only the `test.skip(...)`/`test.todo(...)` **method** form
(`maskSkippedTests`, `compile-check.server.ts:1282-1300`). The options form is not masked, so an `assert`
inside a `{ skip: … }` body would be counted as behavioural evidence although it never executes — a hollow
green. The marker therefore lives in the options object and the comments, never as a non-executing assert.

**Kept assertions**: every row that IS wired keeps its exact assertion bytes (seam rejection, P6
phase-bookkeeping, router→job dispatch, tree-job probe, capability calls). Nothing was deleted or weakened
to reach green; `scaffold.ts`'s section-4 branch order and every `liveAssertable` branch are untouched.

### 2.2 The safety default: `"partial"` → `"refuse"`

`scaffold.ts:8591-8599` (one expression, `old → new`):

```ts
// old
const underProducedPolicy = options.underProduced === "refuse" || options.allowUnderProduced === false ? "refuse" : "partial";
// new (precedence: explicit string → legacy boolean → refuse)
const underProducedPolicy: "partial" | "refuse" =
  options.underProduced === "partial" || options.underProduced === "banner" ? "partial"
  : options.underProduced === "refuse" ? "refuse"
  : options.allowUnderProduced === true ? "partial"
  : "refuse";
```

- `ScaffoldOptions.underProduced` is now `"partial" | "refuse" | "banner"` (`scaffold.ts:126-137`);
  `"banner"` is accepted as the headless/CLI spelling of the same policy.
- The pre-write refusal path itself is unchanged (`scaffold.ts:8593-8600`): `ok:false`,
  `code:"RT_E_PLAN_UNDERPRODUCED"`, **no `files` array** ⇒ the caller writes zero files.
- The internal candidate emits (`stampEmittedSurface` `scaffold.ts:7760`; codegen's pre-seal self-typecheck
  `codegen.server.ts:6287`) still pass `allowUnderProduced: true` and keep materializing the partial.
- `src/lib/headless.ts` was **not touched**; `restore-census` already forwards
  `underProduced: underProducedPolicy === "banner" ? "partial" : "refuse"` (`headless.ts:2824,2840`).

### 2.3 The two drifted test cases (`scaffold.test.ts:2712` / `:2719`)

Classification held: **test-wrong**, not source-wrong. Fixed by narrowing the union in the test, not by
casting the source:

```ts
// scaffold.test.ts:32-42 (new)
function okResult(result: ScaffoldResult): Extract<ScaffoldResult, { ok: true }> {
  if (!result.ok) assert.fail(`expected ok: ${result.error}`);   // assert.fail is typed `never` ⇒ narrows
  return result;
}
function okFiles(result: ScaffoldResult): ScaffoldFile[] { return okResult(result).files; }
```

`okFiles()`/`bodyOf()` now route through it; the two cases read `okResult(result).gameTemplate`.

## §3 — Measurements AFTER the change (exact commands + raw numbers)

### 3.1 The three trees (probe, %TEMP% only)

```powershell
cd "$env:TEMP\rt-oracle-probe"; node probe.mjs; node measure.mjs partial-unwired-banner partial-wired complete
```

| tree | emitted tree's own `npm test` | TAP summary | `treeRun.ok` | counted shortfall visible |
|---|---|---|---|---|
| partial + 1 unwired row of 6, explicit `{underProduced:"partial"}` | **exit 0** | `# tests 11 · # pass 10 · # fail 0 · # skipped 1` | **true** (spec leg `run:"pass"`, `{pass:10, fail:0, skipped:1}`) | yes — TAP `# SKIP NOT IMPLEMENTED …`, spec header `ORACLE SHORTFALL: 1 of 6`, README `ACCEPTANCE SHORTFALL — 1 of 6 … \`orc-phase\`` |
| partial, all 5 rows wired | exit 0 | `pass 10 / fail 0` | **true** | n/a (`all 5 pinned row(s) assert …`) |
| complete (ALL_PHASES) | exit 0 | `# pass 15 · # fail 0` | **true** (typecheck+test+build all pass) | n/a |

The row-level marker on the emitted tree's own runner (raw):

```
ok 11 - orc-phase # SKIP NOT IMPLEMENTED - no emitted module surface targets this row yet (oracle shortfall, counted
in README.md; a skip is not a pass)
# tests 11 / # pass 10 / # fail 0 / # skipped 1
EXIT=0
```

### 3.2 Bounded KEYLESS CLI emits (into `%TEMP%`, never the repo)

```powershell
node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project <partial.json> --out <TEMP>\out-default
node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project <partial.json> --out <TEMP>\out-banner --red-tree banner --run
node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project <ordinary-unwired-row.json> --out <TEMP>\out-ordinary --run
```

1. **default (no opt-in)** → `"ok": false`, `"code":"RT_E_PLAN_UNDERPRODUCED"`,
   `error:"RT_E_PLAN_UNDERPRODUCED · artifact refused (below-floor plan): …"`, `"exit_code": 1`,
   **no `dir`/`count` keys** and `Test-Path <out>` → **False** ⇒ **zero files written**.
2. **`--red-tree banner --run`** → `underProducedBanner:true`, 17 files, `treeRun.ok:true` with the spec leg
   `{pass:10, fail:0, skipped:1}`, `declaredScriptsVerified:true`, and **`tested.promoted:true`
   (`label:"tested"`, `evidenceHash:"59762713"`)** — the promotion the 354 defect blocked. `exit_code: 1`
   is the deliberate **below-floor delivery seal** (`code:"RT_E_PLAN_UNDERPRODUCED"`,
   `planUnderproduced:{floor:3, emitted:1, missing:[…]}`, "the emitted tree is kept on disk"), not a tree
   failure: the tree is green and the artifact is labeled.
3. **ordinary emission carrying the same unwired row, no below-floor record** → `"ok": true`,
   `treeRun.ok:true`, spec `{pass:10, fail:0, skipped:1}`, `behavioural:true`, entry `run:"pass"` — i.e. the
   `emit --run` verdict `emit --git` re-verifies before committing (`headless.landEmittedTree`) is now GREEN
   where the 354 bytes made it red (`not ok 10 - orc-phase`).

### 3.3 Repo gates

```powershell
npx tsc --noEmit      # exit 0 (no `error TS` lines) — the 5 baseline errors are gone (mine + the other lanes')
node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts
#   # tests 133 · # pass 131 · # fail 2   (the 2 are the pre-existing UI reds — §5)
node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="default refuses before writing" src/lib/headless.test.ts
#   ok 1 - default refuses before writing; underProduced:'banner' lands the partial with the caution banner
#   # tests 1 · # pass 1 · # fail 0   (the pattern matched its own test — the AGENTS.md no-op trap checked)
node --experimental-strip-types --test --test-reporter=tap src/lib/headless.test.ts                  # 209/209
node --experimental-strip-types --test --test-reporter=tap src/lib/packet.test.ts src/lib/emitted-honesty.test.ts   # 99/99
node --experimental-strip-types --test --test-reporter=tap src/lib/sweep73-fuzz.test.ts              # 52/52
node --experimental-strip-types --test --test-reporter=tap src/lib/dod.test.ts src/lib/gates.test.ts src/lib/acceptance.test.ts  # 214/214
node --experimental-strip-types --test --test-reporter=tap src/lib/software-export.test.ts           # 9 pass / 1 FAIL — §5
```

## §4 — `scaffold.test.ts` changes (old→new), nothing deleted to reach green

| test (line) | old assertion | new assertion |
|---|---|---|
| `:703-724` hostile-prose rows | a `test.skip(` line must contain "NOT IMPLEMENTED" (vacuously true — no row was a method-form skip) | every emitted row line carries `{ skip: ` **and** `NOT IMPLEMENTED`; `!spec.includes("assert.fail(")`; header `/ORACLE SHORTFALL: 2 of 2 pinned A7 row\(s\) are/` |
| `:1121` 216b census (both branches) | branch 2: census says "REAL failing", ids matched `exits non-zero: …`, spec must contain `${id} is NOT IMPLEMENTED`, `test.skip(` count `=== 0` | branch 1 (unchanged strength + new): 0 method-form skips, no `ORACLE SHORTFALL`, no marked row. Branch 2: `/ACCEPTANCE SHORTFALL — \d+ of \d+ pinned row\(s\) are NOT IMPLEMENTED/`, `"A skip is not a pass"`, **not** "REAL failing"/"exits non-zero", ids matched after `never silent: …`, each id found as `test("<id>", …)` **with** `{ skip: …` + `NOT IMPLEMENTED`, header total matches the named-id count, no `assert.fail(`, and the false-clean claim still banned |
| `:2545` below-floor default | `D1: the DEFAULT lands the bannered partial` | **new direction**: `W356 A3: an ABSENT policy REFUSES before writing` (`ok:false`, `code:"RT_E_PLAN_UNDERPRODUCED"`) |
| `:2554` opt-in | (was the default) | `explicit 'partial' / 'banner' lands the bannered partial` — both spellings, `underProduced{code,detail}`, banner leads the README, the real partial bytes land; the superseded-success control kept |
| `:2579` STRICT | `{underProduced:"refuse"}` + `{allowUnderProduced:false}` | the **same two** plus `{}` (absent) — three refusals asserted |
| `:2598` campaign2 replay | default lands 6 below-floor trees, STRICT refuses | explicit `{underProduced:"partial"}` lands them, **absent** refuses (`strict = scaffoldProject(project)`), at-floor control unchanged |
| `:2650` R2-05 all-unwired | "REAL failing tests — zero skips", `assert.fail` present, "fixes/354 A2-F2" text | every row is a marked skip; no reachable `assert.fail`; 0 detached `test.skip(`; header total present; the spec names `RT_E_SPEC_SKIP_VACUOUS` |
| `:2682` R2-05 non-dominated | the unwired row is a real failing test | the unwired row is `test("orc-phase", { skip: … })` under its pinned id, header `ORACLE SHORTFALL: 1 of 6`, and no reachable failing assertion for it |
| `:32/:37` | `okFiles()` cast `(result as {ok:true; files})` | `okResult()` narrowing helper (§2.3) |

## §5 — Cross-lane consequences, out-of-scope items, deferred

1. **`src/lib/software-export.ts:96` (NOT edited — outside my ownership).** It calls
   `scaffoldProject(project)` with no options, so the restored `"refuse"` default now makes the console
   Preview tab refuse a below-floor project instead of landing the bannered partial. Measured:
   `node --experimental-strip-types --test --test-reporter=tap src/lib/software-export.test.ts` →
   **9 pass / 1 fail**, `not ok 1 - emitSoftware`, `error: 'the tree is surfaced rather than withheld'`
   (the assertion at `software-export.test.ts:88`). The documented behaviour it preserves
   (`RUNBOOK.md` §6a, §9.7: the Preview is *not* inert for a below-floor run) needs a one-option opt-in at
   that call site — `scaffoldProject(project, { underProduced: "partial" })` (or `allowUnderProduced: true`).
   **No W356 lane owns that file**; flagged for the parent. `RUNBOOK.md` §6a/§9.7 also becomes stale for
   the default path (I must not edit docs).
2. **Two pre-existing UI-generation reds in `scaffold.test.ts` (`:1772`, `:2700`-region) — NOT caused by
   this lane, not fixed.** Measured: `# tests 133 · # pass 131 · # fail 2` —
   `error: 'UI input bound to the real field customerId'` (A3-f07/W-14 default emitted-UI generator) and
   `error: 'a derived page reads the real sync getter'` (A2-F5 spec-derived page set).
   Evidence that the source side is unchanged by me: I reconstructed the audit baseline of both my files
   from `%TEMP%\rt-campaign\baseline-working-tree.patch` (HEAD + the wave's working-tree hunks) and
   compared it to the current bytes — the delta is exactly my hunks (166 added / 103 removed lines in
   `scaffold.ts`, 149/69 in `scaffold.test.ts`, non-ASCII folded because the patch was captured through a
   CP437 console decode), and **no delta line mentions ui/page/router/console/site/`defaultUiGeneration`
   except two comment lines I wrote myself**. The failing subject code — the 351/353 site precedence at
   `scaffold.ts:8915-8952`, which fires whenever `options.uiGeneration === undefined` and the brief/spec
   names ≥2 pages — is byte-identical to the baseline, and the two tests' own bytes are untouched. The
   audit never measured them (`fixes/355_0_audit_wave.md` §0: "the src leg never ran"). Fixing them means
   re-deciding 351/353-vs-A3-f07 precedence — a product decision outside this lane's assignment.
3. **Residual, measured, NOT a defect: a skip-dominated spec is still refused by the tree-run.**
   `compile-check.server.ts:1557` (`skipDominated = skipped > 0 && pass <= skipped`) refuses a spec whose
   live passes do not outnumber its skips (`RT_E_SPEC_SKIP_VACUOUS`). That is the correct guard for a
   vacuous green, and my emitted spec now names it on its own header. Consequence to state plainly: an
   emission whose **unwired rows outnumber its live assertions** stays red *on the tree-run leg* — the
   shortfall is counted, not hidden, and no product claim is made. The measured partial (10 live vs 1
   unwired) is green; I did not move that guard (it is `restore-census`'s file).
4. **The pre-354 ratio gate** (`notImplemented > assertable`) is deliberately NOT restored: it emitted an
   **uncounted** `test.skip("<id> — NOT IMPLEMENTED")`, which is exactly the silent-shortfall failure R2-05
   forbids. The new form keeps a skip *and* the count.

## §6 — Unverified / not run

- **The parent's full `npm test` and `bash scripts/gate.sh` were NOT run** (hard constraint). The script leg
  (39 CLI verbs, guards, acceptance) is untouched by this lane; my evidence is the per-suite runs in §3.3.
- **`emit --git` was not executed** (no git writes). The green `--run` verdicts in §3.2 are the input
  `headless.landEmittedTree` re-verifies before committing; the commit itself is unobserved.
- **A keyed run was not made** (no keyed LLM call this lane). All emissions above are keyless fixtures.
- The **`game` kind** and the **webapp** `vite build` leg were not re-emitted with an unwired row; the
  complete-emission measurement (§3.1) is a webapp and includes `build` → `run:"pass"`.
- **`fixes/356_run_guard_fields`-style renaming risk:** none identified. Nothing else in `src/**` or
  `scripts/**` matches on the emitted spec's unwired-row text (`Select-String -Pattern 'is NOT IMPLEMENTED'`
  hits only `compile-check.server.test.ts`'s own fixtures and unrelated modules).

---

# APPEND 2 — line-number correction + final re-derivation

**Correction to §5.2 (append-only; the text above is left as written):** the two pre-existing UI reds sit at
`src/lib/scaffold.test.ts:1771` (`it("binds ≥2 spec-derived fields + an interaction to a real generated
export")`) and `src/lib/scaffold.test.ts:2762` (`it("derives >=2 pages (a router + page modules) …")` — its
`src/ui/site-data.ts` assertion is the one that fails). The mechanism citation is unchanged
(`scaffold.ts:8915-8952`, the 351/353 site precedence).

**Final re-derivation, run after the last edit to my files (nothing has been changed since):**

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
#   TSC_EXIT=0   (no `error TS` lines)

node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts
#   # tests 133 · # pass 131 · # fail 2 · # skipped 0
#   not ok 20 - A3-f07 / W-14 — default emitted-UI generator …  error: 'UI input bound to the real field customerId'
#   not ok 26 - A2-F5 — spec-derived page set for a prose brief  error: 'a derived page reads the real sync getter'
#   (every oracle-row / census / below-floor test in the file: ok)

node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="default refuses before writing" src/lib/headless.test.ts
#   ok 1 - default refuses before writing; underProduced:'banner' lands the partial with the caution banner
#   # tests 1 · # suites 1 · # pass 1 · # fail 0
```

**Status of the four assigned jobs:** (1) unwired row = marked, counted skip — done, measured both by the
emitted tree's own runner and by `treeRun`; (2) safety default restored to `refuse` — done, measured
(`zero files` at the CLI and at the seam); (3) the two drifted cases fixed by narrowing — `tsc --noEmit`
exit 0; (4) both directions re-verified by measurement (§3). Nothing in the assignment is deferred; §5
lists two out-of-scope items (a call site in `software-export.ts` that must now opt in, and two pre-existing
UI-generation reds) and §6 lists what was deliberately not run.
