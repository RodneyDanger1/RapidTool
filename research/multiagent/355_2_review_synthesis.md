# W355 · lane `reviewer-synthesis` — the P6 synthesis → emission → verification chain

**Author:** lane `reviewer-synthesis` (Wave 0, W355 audit/freeze). **Kind:** read-only code review.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (path contains a space). **Host:** Node **v24.15.0**
(`engines.node >= 22`).
**HEAD:** `30bce78` on `main`, **dirty** — 98 modified + 32 untracked files from the unboundaried "354
wave" (`git status --short -- src/lib/...`, below). No file in the tree was modified by this lane.

> **Premise discipline.** Three framings handed to this lane are **not true of the bytes** and are
> corrected with evidence, never restated: (i) the redactor bug is **fixed** (§3, `R-06`); (ii) the
> oracle rule is **not** `notImplemented > assertable` any more (`R-05`); (iii) the below-floor guard is
> **not** a pre-write refusal by default any more (`R-03`). Where a doc and the bytes disagree, the bytes
> win.

---

## 1. Method — exact commands

Every claim below is a read (`read_file`/`grep` on the named path) or one of these commands run in
`C:\Users\mnril\Desktop\RapidTool Main` this session. No keyed LLM call was made; no `npm test`,
`npm run build`, `gate.sh` or `acceptance-run.mjs` was run.

```powershell
# scope inventory (sizes / structure)
Get-ChildItem src\lib\{codegen.server,synthesis-policy,prompt-engine,scaffold,product-quality,verify.server,verify,compile-check.server,node-runner.server,acceptance,doctor}.ts |
  Select-Object Name,Length,@{n='Lines';e={(Get-Content $_.FullName | Measure-Object -Line).Lines}}

# which scope files are dirty at HEAD
git status --short -- src/lib/scaffold.ts src/lib/scaffold.test.ts src/lib/product-quality.ts ...   # read-only

# R-06 — the redactor, both ways (no key materialized on disk; values set in-process only)
node --experimental-strip-types -e "process.env.DEEPSEEK_API_KEY=' '; import('./src/lib/node-runner.server.ts').then(m=>console.log(JSON.stringify(m.redactSecrets('(node:1) SecurityWarning: The flag'))))"
node --experimental-strip-types -e "process.env.DEEPSEEK_API_KEY='sk-abcdefghijklmnopqrstuvwxyz0123456789ABCD'; import('./src/lib/node-runner.server.ts').then(m=>console.log(JSON.stringify(m.redactSecrets('key=sk-abcdefghijklmnopqrstuvwxyz0123456789ABCD done'))))"

# R-03 — scaffold below-floor policy: default vs explicit refuse (project constructed in-process, written to %TEMP%)
node --experimental-strip-types -e "import('./src/lib/scaffold.ts').then(m=>{const p=JSON.parse(require('fs').readFileSync(process.env.TEMP+'/probe355.json','utf8'));console.log('default:',m.scaffoldProject(p).ok,m.scaffoldProject(p).files.length,JSON.stringify(m.scaffoldProject(p).underProduced));console.log('refuse:',m.scaffoldProject(p,{allowUnderProduced:false}).ok)})"

# R-02/R-03 — headless emit surface: does the below-floor refusal or the PARTIAL banner fire?
node --experimental-strip-types -e "import('./src/lib/headless.ts').then(async m=>{const p=JSON.parse(require('fs').readFileSync(process.env.TEMP+'/probe355.json','utf8'));const r=await m.emitProject(p,process.env.TEMP+'/probe355-out');console.log(r.ok,r.redTreeBanner??null,JSON.stringify(r.underProduced??null))})"
# …and for a RT_E_VALIDATION partial (no under-production code, no red tree-run trail):
node --experimental-strip-types -e "import('./src/lib/headless.ts').then(async m=>{const p=JSON.parse(require('fs').readFileSync(process.env.TEMP+'/probe355b.json','utf8'));const r=await m.emitProject(p,process.env.TEMP+'/probe355b-out');console.log(r.ok,r.redTreeBanner??null,JSON.stringify(r.underProduced??null))})"

# R-04 — substance census on a scaffold-only tree (no generatedTree, no generatedSource)
node --experimental-strip-types -e "import('./src/lib/scaffold.ts').then(async sc=>import('./src/lib/compile-check.server.ts').then(cc=>{const r=sc.scaffoldProject({id:'probe-shell',name:'Shell Probe',brief:'a small website with a page and a form',kind:'app'},{allowUnderProduced:true});/* write r.files to an OS temp dir */ console.log(JSON.stringify(cc.treeSubstanceOf(dir,{green:true}),null,1))}))"

# R-07 — product-quality gameability (a fabricated 5-file marker tree)
$env:PROBE = '<the module/scenario in §3 R-07>'; node --experimental-strip-types -e "eval(process.env.PROBE)"

# §4 — targeted colocated suites (per-file only; never the full legs)
node --experimental-strip-types --test --test-reporter=tap src/lib/synthesis-policy.test.ts src/lib/product-quality.test.ts src/lib/node-runner.server.test.ts
node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts src/lib/acceptance.test.ts src/lib/doctor.test.ts src/lib/software-export.test.ts
```

`git status --short` for the scope (read-only), HEAD `30bce78`:

```
 M src/lib/acceptance.ts        M src/lib/codegen.server.ts   M src/lib/compile-check.server.ts
 M src/lib/doctor.ts            M src/lib/headless.ts         M src/lib/node-runner.server.ts
 M src/lib/scaffold.test.ts     M src/lib/scaffold.ts         M src/lib/synthesis-policy.ts
?? src/lib/product-quality.test.ts   ?? src/lib/product-quality.ts   ?? src/lib/software-export.ts
```

So **`product-quality.ts` and `software-export.ts` are untracked new files**, and `scaffold.ts` /
`codegen.server.ts` / `headless.ts` carry uncommitted 354-wave edits. This review judges those bytes.

---

## 2. The wall, quantified — what the bytes say about where P6 loses runs

**The wall is not synthesis quality; it is that the verification verdict cannot withhold the bytes.**

The chain is: chunked synthesis (`codegen.server.ts` `synthesizeChunkedTree`) → a real pre-seal
`tsc` gate over the candidate tree → `partialTreeRefuse` **or** `treeUpgraded` → `scaffoldProject`
writes → the tree-run judges. The pre-seal gate is real and thorough (`codegen.server.ts:8252-8455`),
**but it is not a floor on delivery**: when it fails it chooses a *refusal reason*, and the refusal path
still materializes whatever chunks were accepted.

| Fact | Source |
|---|---|
| 1/10 acceptance `ok`; `productQuality` **0/10**; 6/10 below-floor; 10/10 `declaredScriptsVerified` | `fixes/353_validation_wave.md:58-80` (given baseline; not re-litigated) |
| 6/10 emitted trees failed their **own** `tsc` (TS2345/TS2554/TS2322/TS2304/TS7006/TS1117) | `fixes/353_validation_wave.md:95-105`, `:212-218` |
| A refused cycle keeps prior chunks and emits a **partial** | `codegen.server.ts:7780-7804` (`refuse` → `partialTreeRefuse`), `:8747-8786` |
| The whole-tree `tsc` gate sits **after** the floor and brief-fit refusals | `codegen.server.ts:8189-8204`, `:8239-8246`, `:8252` |
| `scaffoldProject`'s **default** policy is "land the partial" | `scaffold.ts:8535-8536` |
| `headless.emitProject`'s "refuse" default never reaches the scaffold | `headless.ts:2824`, `:2836-2838` vs `scaffold.ts:8535-8536` |
| Two colocated scaffold tests for the UI-binding machinery are **red** | `scaffold.test.ts:1723`, `:2679` (measured §4) |

**Where a run is lost, in one line:** a candidate tree whose own `tsc` is red is (a) refused, (b) still
written as a partial by `partialTreeRefuse` → `scaffoldProject`, and (c) delivered with a banner on the
console surface but **with no machine-readable withheld reason and no banner at all** on the
`headless.emitProject` / `emit` surface (`R-01`, `R-02`). P6 productivity and P6 honesty are therefore
the *same* defect: the emitter has no door that says "these bytes fail their own compiler, do not
deliver them".

---

## 3. Findings

Format: `id | severity | title | file:line | evidence | why it matters`.

### R-01 · **P0** · The pre-seal `tsc` verdict cannot withhold the tree — a red-`tsc` tree is refused *and* emitted

**file:line** `src/lib/codegen.server.ts:8252-8455` (gate + bounded repair), `:8429-8443` (still-red
refusal), `:7780-7804` (`refuse` → `partialTreeRefuse`), `:8747-8786` (`partialTreeRefuse`), and
`src/lib/scaffold.ts:8535-8538` (default `partial` policy) + `:8519-8554` (`scaffoldProject` entry).

**Evidence (read).** The gate is genuinely a real compiler run: `defaultTreeTypecheck`
(`codegen.server.ts:6267-6338`) materializes the candidate via `scaffoldProject(project,
{allowUnderProduced:true})` and runs the tree's OWN declared `typecheck` through `typecheckDir`
(`compile-check.server.ts:1894-1927`). When it fails: one bounded repair round, monotonic-revert on a
non-improving repair (`:8395-8421`), and on a still-red tree two `refuse(...)` sites (`:8429`, `:8437`).
But `refuse` (`:7780`) has exactly one exit: `partialTreeRefuse(...)` (`:7788`, `:8793`), which sets
`generatedTree`/`generatedSource` to the accepted prefix (`:8767-8782`) — **the tree the compiler just
rejected is the tree that is kept**. Per-chunk fail-fast (`:7996-8140`) only protects *later* chunks, and
it is skipped for the last chunk (`i < plan.length - 1`, `:8004`). The floor refusal (`:8189`) and the
tree-level brief-fit refusal (`:8239`) both return *before* the typecheck gate, so those partials are
never whole-tree typed either.

**Why it matters.** This is the measured 6/10. "Refused" here means "the phase record does not seal";
it does not mean "the bytes are withheld". Every downstream honesty reading that trusts a refusal to
mean *nothing shipped* is wrong. The fix is a delivery policy, not a prompt: the emitter needs a
`refuse`-on-red-`tsc` mode (or an explicit `underProduced`-style machine field on the partial that names
the compiler verdict), so a consumer can tell a red-`tsc` partial from a floor partial.

### R-02 · **P0** · `headless.emitProject` never reports and never banners a synthesis **PARTIAL**

**file:line** `src/lib/headless.ts:2834-2838` (only the `banner` policy computes
`underProducedDetail`), `:2859-2861` (banners = red-trail + under-produced only), `:2529-2540`
(`EmitProjectResult` has **no `partial` field**), vs `src/lib/software-export.ts:105-122` (which *does*
carry `result.partial` into `redTree`).

**Evidence (command).** A project carrying real substance and a phase-6 `p6.synthesis.refused` with a
`RT_E_VALIDATION` detail (no under-production code, no `p6.tree.failure` row):

```
node … -e "emitProject(probe355b, %TEMP%\probe355b-out)"
→ ok= true  files= 14  partial= null  redTreeBanner= false  underProduced= null
→ README has CAUTION/BELOW-FLOOR/RED: false   (first bytes: "> [!WARNING] ## DECLARED SCRIPTS NOT RUN …")
```

`scaffold.trailVerdictOf` (`scaffold.ts:8416-8437`) *does* compute `partial: true` for exactly this
project, and `emitSoftware` acts on it — so the two emit surfaces disagree about the same bytes. The CLI
default `emit` inherits the headless shape: `res.ok === true` takes the success branch
(`rapidtool-cli.mjs:2730-2754`), and the post-write `planUnderproductionSeal` (`:2937-2964`) returns
`null` for a floor-meeting partial, so the payload is `ok:true` with no `underProduced` and no banner.

**Why it matters.** The repo's declared contract is "a refused plan is never silently presented as a
cleared build" (`software-export.ts:49-56`). That contract holds on the console Preview and **does not
hold** on the headless/CLI emit surface for a non-floor partial — the dominant refusal shape in the
353 wave. Reachability caveat in §5.

### R-03 · **P1** · `headless.emitProject`'s `underProduced: "refuse"` default is inert — "refused BEFORE any write" is false at the bytes

**file:line** `src/lib/headless.ts:2710-2712` (the doc comment: "refused BEFORE any write by default"),
`:2824` (`const underProducedPolicy = opts.underProduced ?? "refuse"`), `:2836-2838` (passes
`undefined` for every non-`banner` policy), `src/lib/scaffold.ts:8535-8536`
(`options.underProduced === "refuse" || options.allowUnderProduced === false ? "refuse" : "partial"`).

**Evidence (command).** `scaffoldProject(probe355)` with **no options** → `default-ok= true files= 14
underProduced= {"code":"RT_E_PLAN_UNDERPRODUCED",…}`; `scaffoldProject(probe355, {allowUnderProduced:false})`
→ `refuse-ok= false code= RT_E_PLAN_UNDERPRODUCED`. And `emitProject(probe355, dir)` (default opts) →
`ok= true`, **12 files written**, `underProducedField= null`, `redTreeBanner= false` (README still carries
the scaffold's `BELOW-FLOOR PLAN` banner, because `scaffold.ts:9366-9377` prepends it unconditionally).

**Why it matters.** `headless` computes a policy it never transmits, so the pre-write refusal is
unreachable from every shipped surface (no caller in `src/` or `scripts/` passes
`allowUnderProduced:false` / `underProduced:"refuse"` — grep over `*.{ts,mjs,tsx}`). Two consequences:
(i) the `emitProject` envelope drops the `underProduced` field for the default policy, so a driver
that trusts it sees a clean emit; (ii) `run-eval.mjs:2186` emits with only `{redTree:"banner"}`, so its
envelope cannot report the below-floor state at all. The CLI is saved only by its separate
`planUnderproductionSeal`. This is a declare-or-strike violation (AGENTS.md #3): the comment claims a
guard the bytes do not apply.

### R-04 · **P1** · The whole-tree substance census counts the emitter's own shell as "real substance"

**file:line** `src/lib/compile-check.server.ts:730-760` (`collectTreeCodeSources`),
`:783-800` (`treeSubstanceOf`), `:762-763` (`substanceVerdictOf`), `scripts/acceptance-run.mjs:340-342`
(the `tree.substantive` assertion), `src/lib/dod.ts:464-469` (`classifyModuleSource`).

**Evidence (command).** A scaffold-only webapp (no `generatedTree`, no `generatedSource`, `kind:"app"`)
→ `treeSubstanceOf(dir,{green:true})` → `files= 13  verdict= real  stubs=0  reexports=0  real=2`
(`src/main.tsx:real`, `vite.config.ts:real`). The acceptance assertion is
`(substance.real ?? 0) > 0 && (substance.stubs ?? 0) === 0` — **satisfied by a tree with zero generated
product**.

**Why it matters.** `fixes/354 A2-F3` (the comment at `:720-729`) widened the census from the job dirs
to the whole tree to stop a green-and-empty tree reading `real:0`. It removed that false negative and
left a false positive: the emitter's own infrastructure is now "product substance". The discriminating
reading exists (`jobScoped`, `:771`, and `product-quality.ts:778-780`), but neither acceptance nor the
`ok` bar reads it. Any Wave-2/3 change to that bar must use a census that excludes scaffold-owned files
(the `TREE_RESERVED` / `emitUi` set in `scaffold.ts:350-378`, `:5049-5052`), not the whole-tree count.

### R-05 · **P1** · The oracle rule is now "ANY unwired row reds the tree" — a *partially* wired keyed tree can never be green

**file:line** `src/lib/scaffold.ts:5823-5833` (`unwiredRowsRed = oracleCensus.notImplemented.length > 0`;
the ratio gate `notImplemented > assertable` is explicitly struck at `:5824-5828`), `:5625-5640`
(`oracleRowKind`), `:6213-6217` (`skipRow`), `:6275`, `:6348`, `:6374` (the three `assert.fail("… is NOT
IMPLEMENTED …")` emissions), `:8045-8051` (the README census sentence).

**Evidence (read).** The dispatch is a pure function of the emitted surface: a row whose `job` is in
`surface.jobModules` → `tree-job`; a row whose job the emit `wired` → `endpoint-live`/`live-job`; a row
whose job is `bridged` and the host importable → `bridged-host`; a row with an endpoint on an importable
`.ts` api → `endpoint-stub`/`endpoint-live`; anything else → `not-implemented` → a real failing test.
`.tsx` modules are never importable (`:5582-5583`, `:5593-5605` test `/\.ts$/`), and `treeEntryOk` is
computed but never used by `oracleRowKind`.

**Assessment (the brief's Q3).** The widened rule is *right for honesty*: `fixes/354 A2-F2 / D4` records
that the ratio gate let a not-dominated oracle exit 0 with unwired rows, so the README's "never green"
promise was false. But it makes the partially-wired case structurally unsatisfiable: one unwired row reds
`tests/oracle.spec.ts` → reds the tree's own `npm test` → reds `treeRun.ok` → no `lastTest` mint → unmet
`p6-verified` → the P6 DoD park. The proposed shape in the brief is achievable inside this machinery:
keep the unwired row's pinned id and its `assert.fail` in the *spec*, but have the tree-run's promotion
read a per-row execution class (the machinery already exists — `TreeSpecVerdict.behavioural`,
`compile-check.server.ts:1569-1580`, and the `jobScoped` census) so that a row the emitted surface
*cannot* execute is reported as a NOT-IMPLEMENTED row rather than silently counted as a red product test.
That narrows what "wired" must mean (a row bound to an importable `.ts` surface the tree can call) without
weakening an unwired row (which keeps its failing assertion, its README count and its pinned id).

### R-06 · **P1** · `product-quality.ts`'s `quality` is cheaply gameable — a static checklist, not a product read

**file:line** `src/lib/product-quality.ts:844-929` (`readProductQuality`), `:923`
(`quality: reasons.length === 0`), `:407-408` (page-path regexes), `:410-420` (router markers),
`:432-437` (form element + submit-wire regexes), `:591-606` (`webEntryReading`), `:750-767`
(`moduleCensus`), `:778-780` (`jobModuleCensus`).

**Evidence (command).** A fabricated 5-file tree — `index.html` → `src/main.tsx` (which only imports a
package and exports a function returning a *string*), one unreferenced `src/pages/home.tsx`
(`return null`), one `src/order-lib.ts`, one `src/styles.css` — read:

```
{ "quality": true, "reasons": [], "real": 3, "distinctPages": 1, "router": true, "styled": true, "order": true }
```

**Why it matters (the brief's Q7).** The reader is *honest about its inputs* — every sub-reading is a
labelled byte read, absent `source` is reported absent and never guessed
(`toTreeFile`, `:453-459`), the reachability bound is real (`:858-869`), and
`gateEvidence`/`kindSurface`/`determinism` are additively separated from `quality` (`:871-889`). It is
**not honest about the claim**: `quality:true` with `reasons:[]` asserts nothing about behaviour, and the
top-level boolean carries none of the sub-readings' caveats. A later wave can move
`productQuality 0/10 → 10/10` **without a product** by prompting for five marker strings — and because
the campaign quotes `productQuality 0/10` as its headline reading (`fixes/353_validation_wave.md:80`),
that would read as progress. **Wave 3 must not treat this field as evidence of improvement, and must not
lower it further.** Callers: `acceptance.ts:74`, `:349` (explicitly "never consulted by any field above",
`:347-349`), `doctor.ts:858`, `scripts/acceptance-run.mjs:483-503` (the only caller that passes
disk-derived `emittedFiles` — the persisted-record callers read the record's own claim).

### R-07 · **P2** · The pre-seal typecheck can silently degrade to `skip` and still seal, and `skip` is not a pass

**file:line** `src/lib/codegen.server.ts:8444-8453` (the `first.run === "skip"` branch **falls through**
to `treeUpgraded`), `:6306-6313` (skip ⇒ "the declared typecheck script was not executed … UNVERIFIED"),
`src/lib/compile-check.server.ts:1905-1916` (`typecheckDir` creates the node_modules junction;
`catch {}` on symlink failure), `:2001-2009` (`sharedToolchainRoot()` returns `null` when
`<repo>/node_modules/.bin` is absent).

**Evidence (read).** The gate is engaged in production — `p6CycleLiveDeps` (`headless.ts:3169-3190`)
never sets `complete`/`verify`, and `liveP6Synthesis` only nulls the gate when **both** injected seams
are present (`codegen.server.ts:6929-6934`) — so the hole is not "the gate is off", it is "the gate can
answer UNVERIFIED and the tree still seals". A tree sealed on a `skip` has its `tsc` judged for the
first time by the tree-run, which is exactly the 353 shape (10/10 `declaredScriptsVerified` at
acceptance time, 6/10 red — the shared toolchain *is* resolvable in the acceptance process).

**Why it matters.** `skip` is the correct honest answer, but pairing it with a **seal** converts
non-verification into a product. Either the seal should be withheld on `skip` (a coded
`RT_E_CLAIM_UNVERIFIED`), or `emitProject` should carry the `treeRun`/typecheck state it already knows.

### R-08 · **P2** · Two colocated scaffold suites are RED on the dirty tree — in the exact UI-wiring machinery the campaign blames

**file:line** `src/lib/scaffold.test.ts:1723` (suite at `:1679`), `:2679` (suite at `:2627`).

**Evidence (command).**

```
node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts \
     src/lib/acceptance.test.ts src/lib/doctor.test.ts src/lib/software-export.test.ts
→ # tests 265  # pass 263  # fail 2
   not ok 20 - A3-f07 / W-14 — default emitted-UI generator (real fields + interaction)
     scaffold.test.ts:1740  AssertionError: 'UI input bound to the real field customerId'  expected true
   not ok 26 - A2-F5 — spec-derived page set for a prose brief
     scaffold.test.ts:2679  AssertionError: 'a derived page reads the real sync getter'
```

**Why it matters.** These two are the emitted-UI binding and the spec-derived page set — the "UI wiring"
clause `fixes/353_validation_wave.md:222-227` names as the dominant `productQuality 0/10` cause. The
baseline classification (the 354 wave is unboundaried and the tree is RED at HEAD) applies; this lane
does not re-litigate it, but a reviewer of the chain must know the failing tests sit **inside** this
lane's scope, on `scaffold.ts`'s own generated-UI path.

### R-09 · **P3** · REFUTED — the secret redactor no longer garbles whitespace

**file:line** `src/lib/node-runner.server.ts:449-452`.

**Evidence (command).** `process.env.DEEPSEEK_API_KEY=' '` → `redactSecrets("(node:1) SecurityWarning:
The flag")` returns the input **byte-identical**; a real-shaped value → `"key=[secret-hidden] done"`.
The bytes require `typeof apiKey === "string" && apiKey.trim().length > 0` and the in-file comment names
the fix (`347`). The claim survives only in `research/multiagent/wildmode-diagnosis.md:163-165` and in the
W355 dispatch brief; both are stale. (The ambient `DEEPSEEK_API_KEY` on this host is also still set —
`RT_E_LLM_KEY_SHADOWED` fires on every CLI call, tails only — which is the documented owner action, not a
defect.)

### R-10 · **P2** · The runner's two legs disagree *by construction*, and the bounded spec leg is the green authority

**file:line** `src/lib/compile-check.server.ts:2279-2281` (`outcome.ok = compile.ok && specsGreen &&
entryGreen && coreGreen && projectLeg.verdict.ok && behavior.ok`), `:2228-2250`
(`specScriptDisagreement`), `:1482-1592` (`runSpecFile`; `:1547-1572` the vacuity / skip-domination
refusal), `:1441-1447` (`specSourceHasBehaviouralAssert`), `:1411-1413` (`assertionIsShapeOnly`),
`:2161-2188` (the declared `npm run <script>` project leg).

**Evidence (read) + answer (the brief's Q8).** The two legs are **ANDed**, so neither alone decides
`ok`; but they are not peers. The bounded spec leg is authoritative for the *green claim* because it is
the only one that can refuse a vacuous spec: a green `node --test` exit with 0 live cases, a shape-only
assertion set, or a skip-dominated spec becomes `run:"fail"` with `RT_E_SPEC_VACUOUS` /
`RT_E_SPEC_SKIP_VACUOUS` (`:1556-1572`), and when the declared `npm test` exits 0 on the same spec the
disagreement is stamped (`:2243-2250`) rather than reconciled. The declared leg answers "does the
*product's own* declared toolchain run?" — a different question, and one the emitted tree can pass while
certifying nothing. So: a declared-`npm test` exit 0 **cannot rescue** a spec the bounded leg refused.
The previously observed 0-pass/0-fail disagreement (`wildmode-diagnosis.md:124-127`) is the runner
reporting a spec that loaded and asserted nothing — the bounded leg is correct to red it.

### R-11 · **P2** · Doc-vs-bytes drift cluster in this chain (declare-or-strike)

| Claim | Where | Bytes |
|---|---|---|
| "refused BEFORE any write by default" | `headless.ts:2710-2712` | false — `R-03` |
| "`scaffoldProject`'s `allowUnderProduced` … the pre-write refusal" | `wildmode-diagnosis.md:222`, its 2026-10-05 correction block | superseded — the default is `partial` (`scaffold.ts:8522-8536`) |
| "`notImplemented > assertable`" | W355 brief Q3, `wildmode-diagnosis.md:118-120` (line refs `:2464-2472`) | superseded — `:5824-5833` (`> 0`), lines moved |
| "the redactor replaces every space" | `wildmode-diagnosis.md:163-165` | false — `R-09` |
| `underProductionRefusalOf` "`:5808`", pre-write "`:5861-5862`" | `wildmode-diagnosis.md` correction block | actual: `underProductionRefusalOf` at `:8453`, the pre-write refusal at `:8538-8545` |

The bytes win. None of these are product bugs by themselves; each is a place where a later wave can be
misled about which guard is armed.

---

## 4. What is genuinely sound (with evidence)

1. **The redactor (fixes/347).** `node-runner.server.ts:449-452` gates on a non-blank value; measured both
   ways above. Shape-based redaction (`:458-468`) is a metachar-safe `split/join` + anchored regexes, and
   the runner redacts **before** clamping (`:798-803`).
2. **The `p6-verified` promotion is fail-closed — I could not find a path from a red tree to promoted.**
   Three independent gates: the single-module mint is only reached on `outcome.status === "passed"`
   (`codegen.server.ts:7482-7502` → `upgraded()` `:6775-6848`); the tree mint requires `outcome.ok ===
   true` (`:9048`), `ev.executed` (≥1 `run:"pass"` spec with a behavioural assertion, `:9053-9056` +
   `:8948-9004`), and `declaredScriptsVerified` on any tree that carries its own `node_modules`
   (`:9078-9098`); and the probe additionally demands `ok===true` + non-empty `detail` + `label==="tested"`
   + non-empty `evidenceHash` (`dod.ts:1303-1319`). Both tree-producing paths **invalidate** a prior stamp
   (`treeUpgraded` `:8860-8867`, `partialTreeRefuse` `:8779-8781`), and a changed verdict refreshes rather
   than keeps a stale hash (`:9110-9157`). **A red tree cannot read as promoted.**
3. **`p6-verified` states its evidence class.** `evidenceClass: "executed-tree-tests"` with the explicit
   note that it does **not** run the declared `typecheck`/`build` (`dod.ts:1292-1302`) — the gate cannot
   be read as "the product builds".
4. **The bounded runner is a real bound, honestly labelled.** `strict` denies `child_process`;
   `confined` allows it explicitly for compile-check (`node-runner.server.ts:149-180`, `:520-545`), the
   heap cap rides both (`:127-138`), and the envelope carries a `bound` record plus `sandbox:false`
   (`:603-610`) — no pretend boundary.
5. **The pre-seal typecheck is a real compiler, not a parse.** `defaultTreeTypecheck`
   (`codegen.server.ts:6267-6338`) scaffolds the *exact bytes the tree-run later judges* and runs the
   tree's own declared `typecheck` via `typecheckDir` → `runProjectScript`
   (`compile-check.server.ts:1894-1927`); the per-chunk fail-fast uses the same seam and is Pareto (a
   converging first sample pays nothing, `:8110-8140`).
6. **Monotonic repair.** A repair that does not strictly reduce the diagnostic count is reverted and the
   pre-repair chunk stands (`codegen.server.ts:8395-8421`) — a compile-failure sentinel cannot read as
   progress.
7. **Deterministic pre-emit validation covers real failure classes** with one repair each:
   non-determinism (`:5734-5739`), prose-in-code, CJS residue after the ESM conversion (`:5797-5809`),
   TS7006 implicit-any (`:5811-5826`, chunked opt-in), cross-chunk duplicate declaration (`:5857-5873`),
   shared-contract redeclaration (`:5845-5856`), TS2554 sibling arity (`:5875-5896`), un-awaited async
   value use (`:5897-5913`), unbound claimed exports (`:5829-5836`), JSX namespace in `.ts`
   (`:5775-5784`).
8. **The candidates policy is honest and bounded.** `resolveChunkResampleCandidates` defaults to 3, is
   clamped to `P6_SYNTH_CANDIDATES_MAX = 4`, and honors an explicit `1` as a byte-identical opt-out
   (`synthesis-policy.ts:54`, `:78-99`); the `p6.synthesis.candidates` detail reserves the token suffix
   inside its 1000-char budget so the accounting can never be truncated away (`:200-218`); the armed
   default is lazy, so a passing first sample buys nothing (`:136-137`).
9. **The CLI's floor seal is real.** `planUnderproductionSeal` runs post-write and flips `payload.ok` to
   false with the floor code, withholding `--git` (`rapidtool-cli.mjs:2937-2964`, `:2664-2728`) — the
   reason the CLI is *not* exposed by `R-03`.
10. **Targeted scope suites are green.** `synthesis-policy.test.ts` + `product-quality.test.ts` +
    `node-runner.server.test.ts` → **100 tests / 100 pass / 0 fail** (§1 command).

---

## 5. What I could not verify

- **No keyed run was made, and no `acceptance-run.mjs` execution.** Every "reachability" claim about a
  real keyed journey is reasoned from the bytes, not measured. Specifically, **`R-02`'s reachability is
  conditional**: I proved by probe that `emitProject` drops the partial, and by reading that the CLI
  inherits it, but I did **not** verify that a real keyed journey can reach `emit` with a partial that has
  no `p6.tree.failure` row (which would trip the CLI's red-trail refusal first). The `R-02` defect is
  unconditional as an *API* defect; its user-facing reachability is inferred.
- **The 353 trees are not on disk here** (`%TEMP%\rt10` was not present at review time), so the exact
  per-brief mapping of "below-floor" vs "red `tsc`" to the `partialTreeRefuse` path is a structural
  inference from `fixes/353_validation_wave.md` §1/§5 plus the code — not a re-measurement.
- **The two red `scaffold.test.ts` failures** were observed but not attributed: both `scaffold.ts` and
  `scaffold.test.ts` are modified/untracked on this dirty tree, and I did not diff them against HEAD
  (a write-free `git diff` was not needed for this review's conclusions).
- **The baseline RED verdict** (`npx tsc --noEmit` exit 2 / 5 errors; `npm test` 622/607/15) was supplied
  as already measured and is **classified, not re-derived** — the brief forbids the full legs.
- **`prompt-engine.ts`** was read for structure but I found no defect in it worth a finding; prompt rule
  coverage is cited from `codegen.server.ts`'s own prompt constants (rules 2/10/11 at `:715`, `:744`,
  `:756`), not from `prompt-engine.ts`.
- **The doc claim that `underProductionRefusalOf`'s line numbers moved** (`wildmode-diagnosis.md`
  correction block) is itself stale (`:8453`, not `:5808`); I re-derived the actual lines rather than
  trusting either.

---

## 6. Recommended owners (Wave 2 lanes)

| Finding | Recommended owner |
|---|---|
| **R-01** (red-`tsc` tree still emitted) | the codegen/emission lane (`src/lib/codegen.server.ts` + the delivery policy) — **P0** |
| **R-02** (headless drops/banners no partial) | the headless/emit lane (`src/lib/headless.ts` `EmitProjectResult` + `emitProject`), with `software-export.ts` as the parity reference — **P0** |
| **R-03** (`underProduced:"refuse"` inert) | same headless lane; the fix is to actually pass `{allowUnderProduced:false}` (or `{underProduced:"refuse"}`) when the policy is `refuse` — **P1** |
| **R-04** (substance census counts the shell) | the compile-check/acceptance lane (`compile-check.server.ts` census + `acceptance-run.mjs` bar) — **P1** |
| **R-05** (oracle any-unwired-row) | the scaffold/oracle lane (`src/lib/scaffold.ts` `oracleRowKind` + `emitOracleSpec`) — **P1**, decision required (it deliberately widened red trees; do not silently re-narrow) |
| **R-06** (`product-quality` gameability) | the product-quality lane — **P1** as a *warning to Wave 3*, not a code change except: state the caveat on the `quality` field itself |
| **R-07** (typecheck `skip` seals) | codegen (seal withholding) or headless (carry the verdict) — **P2** |
| **R-08** (two red scaffold tests) | the boundary owner / the 354 wave's author — **P2**, fix-before-freeze |
| **R-09** (redactor) | **none** — fixed; strike the stale claim from the diagnosis doc |
| **R-10, R-11** | the docs-truth lane (append corrections; the bytes win) — **P2/P3** |
