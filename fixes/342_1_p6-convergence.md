# 342-1 — keyed P6 convergence (the strict-`ts` classes)

**Lane:** engineer 342-1 (keyed P6 convergence). **Root:** `C:\Users\mnril\Desktop\RapidTool Main`
(git `main`, HEAD `686d7b6`). **Runtimes:** host `node` v24.15.0 and pinned
`& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2. **Owned files touched:**
`src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts` (+ this log). **Scratch:** `%TEMP%\rt342_1\`.
**No full gate**; targeted suite only. **Keyed calls: 1 real API call** (cap was 4; measured usage below).
No secret printed (the expected `RT_E_LLM_KEY_SHADOWED` notice fired with tails only).

The mission question: *what makes keyed P6 fail to converge, and how do I raise it honestly?* Answer:
**two of the three named classes were absent from the prompt the model is steered by, and the third
(TS2440) had a deterministic in-file root cause in the cross-chunk duplicate detector.** Both are now
closed; a focused keyed probe converged in ONE call through the real pre-seal `tsc` gate.

---

## 1. Diagnosis on bytes

### 1a. The prompt never named the classes the compiler refuses

`p6SynthesisSystemPrompt()` (`codegen.server.ts:566`) is the only steering the model gets about the
emitted tree's own strict compile. Rule 10 (`codegen.server.ts:619`) named exactly two failures:
TS7006 (unannotated parameter) and TS2304 (undeclared named type). The worked example (`:571`/`:573`)
demonstrates only `add(a: number, b: number): number`. Nothing named:

- **TS2322** (assignment type) — the measured `src/jobs/validate.ts(46,11): Type 'Record<string, unknown>'
  is not assignable to type 'number'` (341_0 §4a). A helper annotated `number` while returning a
  structured value. Rule 10 demanded annotations but never stated that the annotation must MATCH the
  returned value, so the model re-emits the mismatch every cycle.
- **TS2749** (value used as a type) — the measured `TextDecoder` used in type position
  (341_1 §2, `src/generated/read-csv-file.ts(107,92)`). Rule 10 listed allowed built-ins but never said a
  runtime VALUE (`TextDecoder`) cannot stand in a type position.
- **TS2440** (import/local conflict) — §1c below: not (only) a model mistake, a detector hole.

The bounded repair re-emits the same class because the model was never told the class exists.

### 1b. The repair context path ALREADY carried the compiler offender file + its `tsc` tail

This is confirmed on bytes — the mission asked to verify it, and it is not the gap:

- **In-synthesis (chunked) repair:** `typecheckOffenderIndices` (`codegen.server.ts:3726`) maps the
  compiler-named file back to its accepted chunk via `materializedPathForAccepted`; `typecheckRepairContext`
  (`codegen.server.ts:3743`) builds the compiler report; the repair re-prompt is
  `withTreeFailureContext(..., context)` (call site `codegen.server.ts:4855`), which appends it (bounded
  to `P6_TREE_FAILURE_CONTEXT_MAX = 1200`, `codegen.server.ts:1191`). Pinned by the existing GREEN test
  (`codegen.server.test.ts`, "the tsc tail rode the repair prompt") and by the new TS2322 pin below.
- **Journey → next cycle:** `treeRunFailureTail` (`headless.ts:2780`) returns `o.error`, which IS the
  compiler line(s) (the observed `p6.tree.failure` detail); `p6CycleLiveDeps`
  (`headless.ts:2611`) forwards it as `deps.treeFailure`; the PRIMARY prompt's reader
  `withTreeFailureContext` (`codegen.server.ts:1192`) appends it. `treeRunFailureFiles`
  (`headless.ts:2813`) parses the same `path(line,col): error TSxxxx:` rows into the explicit repair
  targets (`repairCycleLiveDeps`, `headless.ts` ~`:2618`).

So: the offender file and its `tsc` tail reach the retry on both paths; the missing piece was the
model's knowledge of what to do with it.

### 1c. TS2440 has a deterministic in-file root cause (the important finding)

`materializeImportableTree` (`codegen.server.ts:2990`) emits a real
`import { <prior exports> } from "./prior.ts"` into EVERY later file (its `importLines.push(...)` block);
the only guard
against a later chunk re-declaring an imported name is `crossChunkDuplicateDeclarations`
(`codegen.server.ts:2484`), whose name source `localBindingLines` (`codegen.server.ts:2446`) matched
only `function`/`class`/`const`/`let`/`var`. It did **not** see `type X`, `interface X`, or
`declare function X`. Reproduced against the pre-fix function (real code, no stub):

```
localBindingLines("type InvoiceRow = …\ninterface Vendor {…}\ndeclare function validate(…): boolean;")
  → InvoiceRow: undefined · Vendor: undefined · validate: undefined
crossChunkDuplicateDeclarations("type InvoiceRow = …", [{path:"src/generated/a.ts", exports:["InvoiceRow"]}])
  → []        (the collision is missed)
```

The materializer then emits `import { InvoiceRow }` + the local `type InvoiceRow`, and REAL `tsc`
refuses it — the exact class, confirmed on the pinned compiler:

```
b.ts(1,10): error TS2440: Import declaration conflicts with local declaration of 'InvoiceRow'.
```

This also explains the 341_1 record's "`declare function` stubs AND imports of the same names": the
model's `declare function` stub was not counted as a duplicate, so the materializer's import collided.

---

## 2. The fix (3 patches, `src/lib/codegen.server.ts`)

1. **Rule 11 in the synthesis system prompt** (`codegen.server.ts:628`) — names all three classes and the
   required shape for each: TS2322 (an annotation must EXACTLY match the value; a `Record`-shaping helper
   is typed `Record<string, unknown>`, never `number`), TS2749 (`TextDecoder` is a value-only constructor
   here; type positions take permitted built-ins or module-declared `type`/`interface`), TS2440 (declare
   each helper exactly once; never a local + import collision). No `(validator-enforced)` claim — real
   `tsc` is the gate (the drift-proof rule test still sees exactly rules 2/4/8 claiming enforcement).
2. **`localBindingLines` widened** (`codegen.server.ts:2446`) to also capture `type X` / `interface X` /
   `declare function X`, so `crossChunkDuplicateDeclarations` refuses the TS2440 class before the tree is
   materialized and routes it into the EXISTING bounded duplicate-declaration repair (naming the
   identifier, line and exporting sibling). Doc updated: it is now a documented SUPERSET of
   `localBindingNames`, which stays runtime-only (export binding must not be satisfied by a type).
   No gate weakened; no new refusal class; no prompt bytes for other rules changed.
3. **`singleModuleLibraryKind` cross-lane contract** (`codegen.server.ts:4131`) — accepts BOTH the current
   absence signal (`undefined`/`null`) AND `kind === "library"`; the parameter union
   `Project["kind"] | "library" | null` compiles with or without the 342-4 widening. No other kind's
   routing changed.

## 3. RED → GREEN (targeted suite, both runtimes)

New tests: 4 (system-prompt classes; TS2322 repair feed; library kind; TS2440 detector).

**RED (pre-fix, real output):**
```
not ok 1 - singleModuleLibraryKind: only kind-absent projects are single-module-library eligible
  error: declared library → single-module eligible   expected: true   actual: false
not ok 9 - W56/342-1: the system prompt names the three strict-ts classes and their required shape
  error: 'names the assignment-mismatch class (Record<string, unknown> → number)'
not ok 1 - W45/331-4 (Finding B) cross-chunk duplicate declarations
  + actual - expected                                  (the type/declare collision is missed)
# tests 212 # pass 210 # fail 2     (host; the TS2322 repair-feed pin was already GREEN — the mechanism exists)
```

**GREEN (post-fix):**
```
                         v24.15.0        v22.23.2
codegen.server.test.ts   213 / 213 / 0   213 / 213 / 0   (# tests / # pass / # fail)
tsc --noEmit             my files clean (no codegen error row)
```
The three W56/342-1 tests report `ok`; the TS2440 detector test reports `ok`. The pre-existing 209 pins
did not move. The 341-1 gate tests (BEFORE/RED/GREEN/SKIP) all still pass.

## 4. Keyed convergence probe (real money, measured)

Focused probe `%TEMP%\rt342_1\probe.mjs`: a real brief ("A CLI tool that parses an invoice CSV export,
validates every row, and writes per-vendor JSON totals"), a persisted conformant spec that uses
`Record<string, unknown>` / `Record<string, number>` signatures (the exact zone of the TS2322 class),
job nodes dropped so the plan is ONE chunk, the REAL DeepSeek provider, the REAL pre-seal `tsc` gate,
and a HARD cap of 4 real calls (a cap-trip returns a coded refusal WITHOUT a network call).

**Before (record, 341_0 §4a):** a keyed run whose module machine-verified 10/10 but then failed the
emitted tree's own `typecheck`: `src/jobs/validate.ts(46,11): error TS2322: Type 'Record<string, unknown>'
is not assignable to type 'number'` — refused.

**After (measured just now, keyed):**
```
[RT_E_LLM_KEY_SHADOWED] ... the .env key (tail …19b3) WINS over the process-environment key (tail …42ff)
{ "ms": 10706, "realKeyedCalls": 1,
  "usage": { "promptTokens": 1651, "completionTokens": 2681 },
  "rule11Present": true,
  "generatedTreePaths": ["src/generated.ts", "src/generated/chunk-0.ts"],
  "refusal": null,
  "synthesis": "Chunked synthesis: 2 file(s) in 1 chunk(s) ...",
  "typecheckSkipped": null }
```
**Converged in ONE keyed call**: no refusal, no repair round (`realKeyedCalls: 1`), the real `tsc` gate
ran and passed (`typecheckSkipped: null` — not a skip), and the tree sealed. The new rule was live in the
prompt the model saw (`rule11Present: true`). A stub-mode dry run of the same harness beforehand (0 keyed
calls) proved the flow, the one-chunk routing, and that the real gate runs and seals.

## 5. Cross-lane kind contract — and one observation for the wave owner

`singleModuleLibraryKind` now returns true for `kind === "library"` as well as absence, so the 342-4
widening (`types.ts` `DeliveryKind = "app"|"tool"|"game"|"library"|"service"`) is safe in either
direction. **Observation (not acted on — out of my instruction):** the 342-4 engine now STAMPS
`deliveryKindOf` on every project (`engine.ts`), and `deliveryKindOf` can return `"service"`. Pre-widening
a service brief carried kind-absent (single-module lane); post-widening it carries `kind:"service"`, which
my function does NOT accept, so it now routes to the chunked tree. The mission said "accept BOTH the
current absence signal and `kind === "library"` … do not change anything else about kind routing", so I
left `service` alone. If the wave owner intends service to keep the single-module lane, the exact change
is one more `|| project.kind === "service"` here (plus its pin) — flagged, not made.

## 6. Honest verdict

**P6 convergence is materially improved, but not proven reliable.** The three named classes now have:
(a) explicit prompt guidance naming each class and its required shape (before: the model was blind to
TS2322/TS2749 and had no matching/mismatch rule); (b) the repair round already carried the compiler-named
file + `tsc` tail and now the model can act on it; (c) the TS2440 class has a deterministic pre-tsc
refusal that routes into the existing bounded duplicate repair (root-caused and reproduced).

The keyed probe is ONE sample: it converged in one call on a `Record`-heavy brief through the real gate
with the new prompt live. That is a genuine positive signal, not a guarantee — P6 quality remains
stochastic and the honest metric is a full `eval --keyed` scorecard, not one probe.

## 7. What remains

1. **A full keyed `eval` scorecard** (11 fixtures) is the convergence metric; not run here (budget: 1 of 4
   calls used on the focused probe). Prior measurement was mean ≈6/9, pass@1 0/11, dominated by P6.
2. **TS2322's deeper source is model output quality**; rule 11 reduces it but cannot force the model.
   A deterministic post-fix (e.g. a tsc-row→annotation rewrite) is unexplored and would be a new lane.
3. **`service` routing under the 342-4 widening** (§5) — wave-owner decision.
4. **`headless.ts:2813 treeRunFailureFiles`** already parses declared-script offender rows (the 341-1 §R7
   gap is closed there), and `headless.ts` is another lane's file — no change needed from me.

## 8. STOP-and-REPORT

None blocking: every change is inside my two owned files. The only cross-lane item is the `service`
routing observation in §5, which is a decision (and a one-line change in my file if the owner wants it),
not a defect I was asked to fix.

## 9. Mock / fake census (my diff only)

`git diff` for my two files: +121 / −6 (codegen.server.ts +37/−6; test +90). Added-line census:
`as any` 0 · `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` 0 · `eslint-disable` 0 · `TODO`/`FIXME` 0 ·
empty `catch {}` 0 · `.only(`/`.skip(` 0 · hardcoded pass/fail fakes 0. Product code has no doubles: rule
11 is real prompt text; `localBindingLines` is the real detector the materializer's guard reads;
`singleModuleLibraryKind` is the real router. The keyed probe used the real provider and the real gate; its
stub dry-run is a probe-harness scaffold only (0 keyed calls, never in product code). RED evidence is real
test output (and a real `tsc` TS2440 reproduction), not narration. No tracked file deleted; no file outside
the two owned was edited.

---

## 10. Follow-up (342-1b): the `service` routing decision

**Lane:** engineer 342-1 follow-up (P6 convergence). **Owned files touched:** `src/lib/codegen.server.ts`,
`src/lib/codegen.server.test.ts` (+ this section). **Runtimes:** host `node` v24.15.0 and pinned
`& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2. **Scratch:** `%TEMP%\rt342_1\`. **Keyed calls: 0**
(injected seams + the real classifier). **No full gate** — only `src/lib/codegen.server.test.ts` on both
runtimes (+ a targeted `eslint` on the two files and a `tsc --noEmit` filtered to them: clean). No tracked
file deleted.

### 10a. The decision

`service` routes to the **single-module lane** (the ≤8-signature runtime harness), not the chunked tree.
§5's observation was correct that the 342-4 stamping moved it; this follow-up accepts `kind === "service"`
in `singleModuleLibraryKind` (`codegen.server.ts:4137`), restoring the lane.

### 10b. The bytes behind it (all say service is a single-entry product, like a library)

- `src/lib/codegen.server.ts` (HEAD baseline, pre-edit): `synthesizeSingleModule`'s own doc says *"The
  single-module path covers library/service products"* (:4316) and *"The single-module path is the
  library/service product lane"* (:4593). Two independent comments in the file I own already named service
  as this lane's product.
- `fixes/341_1_kinds.md` §1 table: **service** = *"same single-module path"*; §R3: *"The single-module path
  (kind-absent library/service lane)"*. The lane is named for both.
- `scripts/run-eval.mjs:2016-2035` (fixes/215): the corpus→`Project.kind` mapper deliberately returns
  `undefined` for `library`/`service` — *"'library'/'service'/'' stay absent — the honest single-module
  library path"*. The eval driver skips the tree for a service.
- `research/eval-corpus/order-webhook-service.md`: *"the driver maps it to the single-module path (no
  `Project.kind` override)"* — the authored eval intent.
- `src/lib/scaffold.ts`: `emitKindEntry` emits **one** `src/main.ts` for both `library` and `service`
  (`:3105` / `:3076`), and `package.json` for each declares that single entry (`main`/`exports` for the
  library, `main`/`start` for the service, `:703`/`:708`). A service is one runnable product, not a
  per-capability file set.
- `src/lib/engine.ts:199-209` (342-4): `deliveryKindOf` infers `"service"` from the api/service/webhook/
  worker vocabulary; the real `order-webhook-service` brief (`webhook worker service` + `HTTP endpoint`)
  resolves to `"service"` — verified in the probe below.

The multi-file kinds are unaffected: `app`/`tool`/`game` still route to the chunked tree (fixes/148 F1),
which is what §10d pins.

### 10c. The rule, in code

`singleModuleLibraryKind` now returns true for the ABSENCE signal (`undefined`/`null`), `"library"`, and
`"service"`; the two comments it feeds (`liveP6Synthesis`'s chunk trigger and `synthesizeSingleModule`'s
doc) were updated from the stale `"app"|"tool"|"game"` wording to state the single-entry vs multi-file
split. No other kind's routing changed.

### 10d. RED → GREEN (targeted suite, both runtimes)

New tests: **2** (a service unit pin added to the existing `singleModuleLibraryKind` case, plus a
`fixes/342-1 follow-up: a service brief stays on the single-module lane` suite with 2 cases: the real
classifier, and the end-to-end lane).

**RED (pre-fix, real output):**
```
not ok 1 - singleModuleLibraryKind: … (library, service) …
  expected: true   actual: false            # kind:"service" was not accepted
not ok 22 - fixes/342-1 follow-up: a service brief stays on the single-module lane
  # "the stored service kind routes to the single-module lane" → false !== true
  # e2e: expected ["expand","complete","verify"]  actual ["expand","complete","complete","complete"]
# tests 215  # pass 212  # fail 3
```

**GREEN (post-fix):**
```
                         v24.15.0        v22.23.2
codegen.server.test.ts   215 / 215 / 0   215 / 215 / 0   (# tests / # pass / # fail)
```
The 213 pre-existing pins did not move (the follow-up adds 2 tests to 342-1's 213 → 215).

### 10e. End-to-end proof with the REAL brief (keyless, injected seams)

`%TEMP%\rt342_1\probe.mjs` reads `research/eval-corpus/order-webhook-service.md`, extracts the real brief,
and drives the real `engine.withDeliveryKind`/`deliveryKindOf` + real `liveP6Synthesis` with injected
completion/verify seams (0 keyed calls; no network):

```
classifier kind: service      stored kind: service      single-entry?: true
  route kind=undefined -> true   library -> true   service -> true
  route kind=app/tool/game      -> false (chunked tree preserved)
calls: ["expand","complete","verify"]   lastTest.label: tested   sealed?: true
tree paths: ["src/generated.ts","src/generated/chunk-0.ts"]   chunked log?: false
```
Both runtimes produced identical output. A real service brief reaches the single-module lane end-to-end:
one synthesis call, machine verify mints `tested`, no `Chunked synthesis` log.

### 10f. What I did not do

- Did not touch `engine.ts`, `types.ts`, `scripts/run-eval.mjs`, `scaffold.ts`, or any other file — the
  fix is confined to the two owned files (the eval driver's "service stays absent" mapping is now backed by
  the router instead of being silently overridden by the 342-4 stamp).
- Did not change `app`/`tool`/`game` routing (still tree-only) or the `>8-signature ⇒ tree` rule.
- Did not run a full gate or any keyed call. No tracked file deleted; no secret printed.
- Did not re-measure the eval scorecard; this is a routing correction, not a convergence measurement.


---

## 11. Resume (verifier-A follow-up): the TS2440 detector's residual declaration forms

**Lane:** engineer 342-1 (P6 convergence), resumed on verifier A (342-7 §1c). **Root:**
`C:\Users\mnril\Desktop\RapidTool Main` (git `main`, HEAD `686d7b6` + the uncommitted 342 wave). **Runtimes:**
host `node` v24.15.0 and pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2. **Owned files touched:**
`src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts` (+ this section). **Scratch:** `%TEMP%\rt342_1\`.
**Keyed calls: 0** (injected seams + the real detector + the real compiler). **No full gate** — only
`src/lib/codegen.server.test.ts` on BOTH runtimes. No tracked file deleted; no secret printed.

Verifier A found the widened detector closed the measured `type`/`interface`/`declare function` class but still
missed five real TS2440 emitters (`enum`, `const enum`, `export enum`, `declare class`, `abstract class`) and
named a stale taxonomy comment. Both are closed here; each new form is RED-first pinned and verified against the
**real** `tsc`.

### 11a. Real-compiler ground truth (per form, and the negative controls)

Harness = a crafted two-chunk module: `a.ts` exports the name; `b.ts` is `import { X } from "./a";` + a local
redeclaration; run `node node_modules/typescript/bin/tsc --noEmit --strict --moduleResolution node --module commonjs
--target es2020 b.ts`. Prior export is a **type** (`export type X`) — verifier A's harness. All forms below were
run through the real compiler in ONE pass per prior-kind (`%TEMP%\rt342_1\tsc-probe2.mjs`), not narrated:

| local form in `b.ts` | real `tsc` | now flagged |
|---|---|---|
| `enum X { … }` | **TS2440** | yes |
| `export enum X { … }` | **TS2440** (+TS2395) | yes |
| `const enum X { … }` | **TS2440** | yes |
| `export const enum X { … }` | **TS2440** (+TS2395) | yes |
| `declare enum X { … }` | **TS2440** | yes |
| `declare const enum X { … }` | **TS2440** | yes |
| `export declare const enum X { … }` | **TS2440** (+TS2395) | yes |
| `declare class X {}` | **TS2440** | yes |
| `abstract class X {}` | **TS2440** | yes |
| `export abstract class X {}` | **TS2440** (+TS2395) | yes |
| `declare abstract class X {}` | **TS2440** | yes |
| `export declare class X {}` | **TS2440** (+TS2395) | yes |
| `export default class X {}` | **TS2440** (+TS2652) | yes |
| `export default function X() {}` | **TS2440** | yes |
| `namespace X { … }` / `declare namespace X { … }` / `declare module X { … }` | no error | **no** (control) |
| `declare const/let/var X` | no error | **no** (control) |

Real output (excerpt):
```
enum X { A, B }          exit=2 TS2440=YES codes=TS2440
    b.ts(1,10): error TS2440: Import declaration conflicts with local declaration of 'X'.
declare class X {}       exit=2 TS2440=YES codes=TS2440
abstract class X {}      exit=2 TS2440=YES codes=TS2440
namespace X { const y = 1; }   (type prior) exit=0 TS2440=no codes=-
declare module X { const y: number; }          exit=0 TS2440=no codes=-
declare const X: number;                       exit=0 TS2440=no codes=-
```

### 11b. The fix (`src/lib/codegen.server.ts`, `localBindingLines`)

Two regexes widened (and the `declare function` arm folded into the function arm), no new refusal class, no
gate weakened, and **no namespace/module arm added** (so the controls stay unflagged):

- function: `^(?:export\s+(?:default\s+)?)?(?:declare\s+)?(?:async\s+)?function\s*\*?\s*(NAME)\s*\(`
  (adds `export default function`, `declare function`).
- class: `^(?:export\s+(?:default\s+)?)?(?:(?:declare|abstract)\s+)*class\s+(NAME)`
  (adds `declare class`, `abstract class`, `export abstract class`, `export default class`, `export declare class`).
- enum (new arm): `^(?:export\s+(?:default\s+)?)?(?:(?:declare|const)\s+)*enum\s+(NAME)`
  (covers `enum` / `const enum` / `export enum` / `declare enum` / `declare const enum` / `export declare const enum`).

`crossChunkDuplicateDeclarations` reads this map, so a later chunk re-declaring a prior export in any of these
forms is refused before materialization and routed into the EXISTING bounded duplicate-declaration repair (the
same route as the original `function` class). The doc block on `localBindingLines` now names the enum/class
forms and states the namespace/module exclusion explicitly.

### 11c. RED → GREEN (real output)

RED (pre-fix, host v24.15.0; the control test was already green):
```
    not ok 1 - W56/342-1 (resume): enum / declare class / abstract class also collide (TS2440)
      error: |-
        declaration is duplicate evidence: enum InvoiceRow { Draft, Sent }
        + actual - expected
        + undefined
        - [ 1 ]
    ok 2 - W56/342-1 (resume): namespace / declare namespace / declare module stay unflagged (real tsc is silent)
# tests 2
# pass 1
# fail 1
```

GREEN (post-fix, both runtimes; 2 new tests pinned):
```
                         v24.15.0        v22.23.2
codegen.server.test.ts   217 / 217 / 0   217 / 217 / 0   (# tests / # pass / # fail)
```
The 215 pre-existing pins did not move (+2 = the resume's two tests). The new tests assert, per form: the
declaration line is reported, `crossChunkDuplicateDeclarations` names it, and `validateSynthesisModule` refuses
with the `cross-chunk duplicate declaration` error (routed into the repair). The control test asserts
`namespace` / `declare namespace` / `declare module` (identifier and string) / `declare const|let|var` produce no
binding and no refusal.

Re-derived against the real functions on both runtimes (`%TEMP%\rt342_1\probe.mjs`): all 19 positive forms FLAG;
all 8 negatives (incl. `const enumerate`, `const enumeration`, `function enumerate`) stay unflagged.

### 11d. The stale taxonomy comment

`codegen.server.ts:4110-4136` (the `singleModuleLibraryKind` doc block) was already at the 5-way bytes by the
342-1b follow-up (`Project.kind` = OPTIONAL 5-way `DeliveryKind`, with the single-entry vs multi-file split) — no
change needed there. The remaining coarse-3-way wording was the **module header** at old `:26-30`, which still
said *"every DECLARED delivery kind (`"app"` = webapp / `"tool"` / `"game"`) … routes to the chunked tree"* —
false since 342-4 made `library`/`service` declared single-entry kinds. Corrected to the bytes (now `:27-31`):
"every MULTI-FILE delivery kind (`app` = webapp / `tool` = CLI-agent / `game` = playable; `library` and `service`
are single-entry) and every >8-signature spec routes to the chunked tree".

### 11e. What remains (honest residuals)

1. **Namespace/module vs a prior VALUE export is harness-dependent.** My real-compiler ground truth (11a) used a
   type-space prior export, where `namespace`/`declare namespace`/`declare module` are silent (hence unflagged,
   as the task requires). Under a prior **value** export, a namespace/module that carries a value member
   (`namespace X { export const y = 1; }`) **does** emit TS2440 and is still missed. The task fixed the control as
   "does not emit TS2440", so I left it unflagged; a namespace-with-value-members arm is the one residual hole the
   wave owner may choose to close (it needs the prior export's space, which the current `exports: string[]`
   contract does not carry).
2. **The mirror case is a pre-existing over-refusal.** `type X`/`interface X` against a prior **value** export is
   legal (real tsc silent) but the detector flags it — this is 342-1's original superset behavior, unchanged here.
3. A **full keyed `eval` scorecard** remains the convergence metric (§7); no keyed call was made in this resume.
4. Unchanged from §7: TS2322's model-quality source; `service` routing decision is closed (§10).

### 11f. Mock / fake census (this resume's added lines)

`as any` 0 · `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` 0 · `eslint-disable` 0 · `TODO`/`FIXME` 0 · empty
`catch {}` 0 · `.only(`/`.skip(` 0 · hardcoded pass/fail fakes 0. The RED/GREEN evidence is real `node --test`
output and real `tsc` output; the tests drive the real `localBindingLines` / `crossChunkDuplicateDeclarations` /
`validateSynthesisModule`. No doubles, no placeholder bodies. Comments state only what the bytes do.
