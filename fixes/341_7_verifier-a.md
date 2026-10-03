# fixes/341_7_verifier-a.md — wave 341 verifier A (round 2)

**Scope:** the three blocker fixes just landed + the parent's repair-target edit — 341-6
`unattended` self-sufficiency (`headless.ts`/`engine.ts`/`store.ts` + `rapidtool-cli.mjs`),
341-1 P6 pre-seal self-typecheck (`codegen.server.ts`/`compile-check.server.ts`), and the
`treeRunFailureFiles` repair-target parse (`headless.ts`).
**Root:** `C:\Users\mnril\Desktop\RapidTool Main`, git `main`, HEAD `2d5ee35` + uncommitted wave.
**Runtimes:** host `node` v24.15.0 and pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
**Scratch:** `%TEMP%\rt341_va\` (all probes/scripts live there; pre-fix copies extracted from
`git archive HEAD` into `%TEMP%\rt341_va\prefix\`). **Working tree not modified.**
**No full gate.** Targeted suites only, both runtimes. **Keyed calls: 0** (every claim here is
decidable keyless/by direct seam injection; no keyed call was needed).

---

## CLAIM 1 — `unattended` self-sufficiency (341-6): **CONFIRMED**

Independent drive probe `%TEMP%\rt341_va\drive.mjs` (own script, real CLI spawn, scrubbed env,
temp project). Node 24 **and** Node 22 produced byte-identical output:

```
{"step":"create","exit":0,"enforceDod":false}
{"step":"unattended#1","exit":1,"status":"complete","phase":12,"steps":13,"code":"RT_E_GATES_FAILED","sealedWithFailures":true,"stack":false}
{"step":"unattended#2","exit":1,"status":"complete","phase":12,"steps":0,"code":"RT_E_GATES_FAILED"}
{"step":"ledger","stockRows":[{"phase":4,... "decidedBy":"autopilot","label":"autopilot/harness","via":"hitl.approve","tokenPath":false,"note":"[seat harness] autopilot seat — no human decision claimed"}, P5, P8, P9 ...]}
{"step":"ledger","humanStamps":0,"totalDecisions":4}
{"step":"checkpointPresentAfterComplete","present":false}
{"step":"gate --autopilot","exit":2,"status":"awaiting_hitl","phase":4,"decisions":0}
```

- ONE `unattended --project x.json` drives P0→P12 `complete`, `steps:13`, exit **1**
  `RT_E_GATES_FAILED` (honest keyless floor; `sealedWithFailures:true`), zero human stamps,
  every stock row `decidedBy:"autopilot"` / `label:"autopilot/harness"` / `via:"hitl.approve"`
  / `tokenPath:false`. Re-invocation idempotent (`steps:0`, complete). No Node stack printed.
- Default `gate --autopilot` still parks at P4 (exit 2, 0 decisions) — machineGates is
  unattended-only.

**Defeat probes** (`%TEMP%\rt341_va\defeat.mjs`, direct `runUntilGate`, both runtimes):

```
{"case":"control-stock","status":"running","phase":5,"decisions":1,"last":"autopilot"}
{"case":"forceHuman","prePhase":4,"status":"awaiting_hitl","phase":4,"decisions":0,"minted":0,"hitlOpen":true}
{"case":"redDoD","prePhase":4,"status":"awaiting_hitl","phase":4,"decisions":0,"minted":0,"hitlOpen":true}
{"case":"forceHuman-P6","status":"awaiting_hitl","decisions":0}
```

forceHuman does NOT clear; a red P4 DoD (security artifact stripped) does NOT clear; the stock
control DOES clear through `autopilot`. Confirmed on both runtimes.

**Byte-identity (pre-fix copy projection).** Extracted HEAD to `%TEMP%\rt341_va\prefix\`
(`git archive`, read-only) and ran `%TEMP%\rt341_va\bytenproof.mjs <root>` against both roots —
`create` + `gate --project <p> --autopilot`, projecting exit/summary/decisions/phases/artifacts/
generated-source length (timestamps + UUIDs excluded):

```
--- CURRENT ---       {"exit":2,"status":"awaiting_hitl","currentPhase":4,"steps":5,"decisions":[],"phases":[...P0-P3 complete, P4 awaiting_hitl, P5-P12 locked],"artifacts":["0:algorithm:Intent Lattice (A1)", ... "4:security:Security & authorization policy"],"generatedSourceLen":0,"generatedTree":[]}
--- PREFIX (HEAD) ---  (identical string)
```

Byte-identical. `git diff -- src/lib/headless.ts` confirms the machineGates additions are all
`default = false` threading; `machineApproveGate` returns null unless `autopilot && machineGates`.
The default `gate --autopilot` never sets `machineGates` (spread is `...(unattended ? {machineGates:true}:{})`).

**Suites:** `headless.test.ts` `--test-name-pattern="341-6"` → **4/4 both runtimes**;
`scripts/cli-exit-taxonomy.test.mjs` pattern `341-6` → **1/1 both runtimes**.

**Defects / holes in claim 1 scope (claim 4 material):**
1. **Stale false strings** (claim-not-matching-bytes). The `unattended` help text and the file
   header still assert the pre-fix behaviour:
   - `scripts/rapidtool-cli.mjs:4935` (`usage.commands.unattended`): "…; stock HITL gates still
     park for a human by design (exit 2); …". Live `node scripts/rapidtool-cli.mjs --help unattended`
     prints it.
   - `scripts/rapidtool-cli.mjs:20` (header usage example): "… autopilot + live until parked
     (stock HITL gates still park; exit 2)".
   Doc §10.2 says the false comments at `:1141`/`:1357` were corrected (they were — those two are
   now correct), but these two usage strings were missed. Functionally inert, factually false.
2. `machineApproveGate` (`headless.ts:678-691`) does not consult `schedule.tightness`, unlike
   `canAutopilot` (`:627` `< 7.2`). With `machineGates` on, a stock gate clears even when the
   tight-schedule autopilot guard would refuse. Likely intentional for unattended shipping, but
   the guard is silently bypassed for stock gates — flag for the parent, not asserted as a bug.

---

## CLAIM 2 — P6 pre-seal self-typecheck (341-1): **CONFIRMED on the model-authored red; PARTIAL on the defeat list (skip seals; a scaffold-owned offender false-reds)**

Independent probe `%TEMP%\rt341_va\p6probe.mjs` (real `tsc` via `defaultTreeTypecheck`; only the
LLM seam injected; keyless). Node 24 output (Node 22 identical for the suite; behavior same):

```
{"label":"chunked-typedred","completes":2,"refused":true,"refusalDetail":"RT_E_VALIDATION · tree 1/1 chunks accepted · emitted tree still fails its OWN declared `typecheck` after one bounded repair round — src/generated/chunk-0.ts(10,14): error TS2749: '","skipped":false,"sealed":false}
{"label":"chunked-skip","completes":1,"refused":false,"skipped":true,"sealed":true}
{"label":"chunked-nonfile","completes":1,"refused":true,"refusalDetail":"... but no synthesized chunk maps to the compiler-named file(s) — tests/oracle.spec.ts(1,1)"}
{"label":"chunked-BEFORE-legacy","completes":1,"refused":false,"sealed":true}   <-- legacy deps (no typecheckTree) seals the type-red tree
{"label":"single-typedred","completes":1,"refused":true,"refusalDetail":"... the emitted module fails its OWN declared `typecheck` — refusing to seal a machine-run-green but type-red artifact: src/ui/console.tsx(16,7): error TS2345: ..."}
{"label":"single-skip","completes":1,"refused":false,"skipped":true,"lastTest":"tested"}
{"label":"single-BEFORE-legacy","completes":1,"refused":false,"lastTest":"tested"}
```

- **Chunked path:** a typed-red module (real TS2749) is REFUSED, the bounded repair re-synthesis
  runs (`complete`×2), no sealed artifact — the measured defect is closed. The BEFORE (legacy
  injected deps ⇒ gate null) still seals the same type-red tree, proving the RED/GREEN is real
  and not a tautology.
- **Single-module path:** any `run:"fail"` refuses outright (no offender routing). The
  single-module red I reproduced named `src/ui/console.tsx(16,7) TS2345` (see below) rather than
  the module's own error in one fixture, and the module's own error in another — both refuse.
- **Non-file-scoped error (no offender path):** chunked → refused "no synthesized chunk maps …";
  single-module → refused. No guessing.
- **`skip`:** the task's defeat bar is "must not seal". **It seals on both paths** (chunked:
  sealed + `p6.tree.typecheck.skipped`; single: sealed + skip log, and single additionally carries
  `lastTest:"tested"` from the injected runtime harness). This matches doc §R2/§R4 verbatim
  ("SKIP seals … and logs … unverified, not a pass"), so the implementation and its doc agree —
  but it does not meet the literal "must not seal" defeat. **Reported as a documented deviation,
  not a silent one.**
- **A real keyed-shape tree that passes:** a fully typed, DOM-free module with only primitive
  wired params passes on both the library single-module path and the chunked path. A typed module
  with a non-primitive wired param passes chunked but **false-reds the webapp-scaffolded
  single-module path** (below).

**New hole (production-routable false-red, scaffold-owned offender).** `%TEMP%\rt341_va\p6mix.mjs`:

```
brief = "A kanban board library with columns, cards and drag."
routing: projectKindOf = "webapp"; engine.uiKindOf = "library"  => kind stays ABSENT
         => codegen single-module path + scaffoldProject(webapp)  (production routing)
{"case":"board-library-single","refused":true,
 "detail":"RT_E_VALIDATION · the emitted module fails its OWN declared `typecheck` — refusing to seal a machine-run-green but type-red artifact: src/ui/console.tsx(16,7): error TS2345: Argument of type 'string' is not assignable to parameter of type 'Board'.",
 "genLen":1030}
```

`engine.liveLayer` (`engine.ts:3204-3210`) stamps kind only for `uiKindOf` "ui"/"cli-tool";
a brief containing a webapp keyword (`board`/`ui`/`dashboard`/`desk`/`portal`) **and** a library
token (`library`/`package`/`sdk`/`npm`/`module`/`statistics`) stays kind-absent ⇒ single-module,
while `projectKindOf` (`scaffold.ts:528`) returns `webapp` (webapp keywords checked first) ⇒ the
340-6 UI generator emits `src/ui/console.tsx`, whose `onSubmit` calls
`generated.addColumn(String(...), String(...))` (`scaffold.ts:1626-1646`). When the chosen
callable has a non-primitive parameter (`addColumn(board: Board, …)`), the scaffold-owned file is
type-red; the gate then refuses the whole synthesis. The single-module path has no offender
routing and the offender is not a synthesized chunk, so the bounded repair cannot converge on it.
Pre-wave the same tree was sealed and later red the tree-run (never minted `tested`), so this is
not a false green — it is an unrepairable refusal caused by a scaffold-owned file, effectively
disabling that lane for realistic typed modules. Matches the task's defeat "a real keyed-shape
tree that passes" failing on one reachable shape.

**Suites (targeted, both runtimes):** `codegen.server.test.ts` pattern `341-1` → **7/7 both**;
`compile-check.server.test.ts` pattern `341-1` (`typecheckDir`, real tsc) → **4/4 both**.

**Silent gate opt-out (design note).** `codegen.server.ts:4135`:
`deps?.typecheckTree ?? (deps?.complete === undefined && deps?.verify === undefined ? defaultTreeTypecheck : null)`.
Any caller that supplies *either* `complete` or `verify` silently gets `typecheck === null` — no
gate, no log. Production (`engine.liveLayer`) forwards neither, so production always gates; but
the opt-out is implicit (not an explicit `typecheckTree:false`), so a future caller forwarding a
seam loses the gate with no signal.

---

## CLAIM 3 — `treeRunFailureFiles` repair-target parse: **CONFIRMED for the canonical case; PARTIAL on the "does not admit reserved/absolute" sub-claim**

Direct probe `%TEMP%\rt341_va\c3probe.mjs` (imports the exported function):

```
{"case":"A-posix","files":["src/generated/read-csv-file.ts","src/jobs/convert.ts"]}          <-- the edit works
{"case":"B-reserved-posix","files":[]}                                                        <-- tests/oracle.spec.ts filtered
{"case":"C-reserved-windows","files":["oracle.spec.ts"]}                                      <-- reserved path ADMITTED (basename)
{"case":"D-absolute-unix","files":["etc/secret.ts"]}                                          <-- absolute ADMITTED (root stripped)
{"case":"E-absolute-win-backslash","files":["x.ts"]}                                          <-- absolute ADMITTED (root stripped)
{"case":"F-absolute-win-fwdslash","files":["tmp/x.ts"]}                                       <-- absolute ADMITTED (root stripped)
{"case":"G-traversal","files":["src/../../secret.ts"]}                                        <-- `..` traversal ADMITTED
{"case":"H-regression","files":["src/generated.ts","src/a.ts","src/main.ts"]}
```

- A typecheck-only red now names the compiler-blamed files (pre-fix: `[]`, re-derived from the
  HEAD copy — `%TEMP%\rt341_va\c3pre2.mjs` → `{"case":"PREFIX-typecheck-only-clean","files":[]}`).
  Post-fix → the two POSIX files. **CONFIRMED.**
- Original core/compile/entry/spec behaviour unchanged: the H-regression projection equals the
  HEAD copy's exactly (`%TEMP%\rt341_va\c3pre.mjs` → same three files).
- **Parser gaps** (the task asks specifically whether it admits a reserved/absolute path):
  `add()` (`headless.ts:2771-2779`) rejects `\\`, leading `/`, and `^[A-Za-z]:` **on the captured
  token**, but the regex `([A-Za-z0-9_@][A-Za-z0-9_@./-]*\.(?:ts|…))` cannot capture a leading
  separator and anchors on the first alnum, so:
  - a Windows-separated reserved row (`tests\oracle.spec.ts`) yields basename `oracle.spec.ts`,
    which is **not** in `REPAIR_TREE_RESERVED` (`{"tests/oracle.spec.ts"}`) → admitted;
  - `/etc/secret.ts`, `C:\tmp\x.ts`, `C:/tmp/x.ts` are admitted as `etc/secret.ts` / `x.ts` /
    `tmp/x.ts` (the absolute-prefix filter never sees the prefix);
  - `src/../../secret.ts` is admitted (no `..` segment filter).
  These are only reachable if the declared-script tail carries such a path (tsc normally emits
  POSIX-relative diagnostics; the declared script can be arbitrary), so severity is low, but the
  docstring's "`add` still filters reserved/absolute" is stronger than the bytes.

---

## CLAIM 4 — new holes across the scoped files

1. **Stale false usage strings** — `rapidtool-cli.mjs:20` and `:4935` (claim 1 above). The `:4935`
   one is printed by `--help unattended`.
2. **`treeRunFailureFiles` edge forms** — reserved-Windows / absolute / `..` admitted (claim 3).
3. **Single-module gate refuses a scaffold-owned offender it cannot repair** —
   `src/ui/console.tsx` TS2345 on a production-routable (board+library) brief (claim 2). No
   offender→chunk routing exists on the single-module path; the refusal is honest about the tree
   being red but the model has no route to fix the scaffold-owned file.
4. **Silent typecheck opt-out** — supplying `complete` *or* `verify` disables the gate with no
   signal (`codegen.server.ts:4135`; claim 2). Production is unaffected today.
5. **`machineApproveGate` ignores `schedule.tightness`** while `canAutopilot` enforces it
   (claim 1) — possible policy bypass for stock gates; flagged, not asserted.
6. `store.ts:12/1357` `stageWildPlan` wiring matches doc §3 (staged ⇒ commit + return
   `{ok:true, ran:0, stoppedReason:"paused", note:"RT_E_GATE_PENDING"}`); `headless.ts` imports it
   from `engine.ts` and the local copy/dynamic import are gone (diff verified). No hole there.

---

## Mock / fake census (added lines, six scoped files)

`git diff -U0 -- <6 files>` → **582 added lines** across
`headless.ts`/`engine.ts`/`store.ts`/`rapidtool-cli.mjs`/`codegen.server.ts`/`compile-check.server.ts`.
Counts over added lines: `as any` 0 · `@ts-ignore` 0 · `@ts-expect-error` 0 · `@ts-nocheck` 0 ·
`eslint-disable` 0 · `TODO` 0 · `FIXME` 0 · empty `catch {}` 0 · `mock` 0 · `stub` 0 ·
`placeholder` 0 · `return true` 0 · `return false` 0. The product code paths run the real `tsc`
(`typecheckDir`) and the real CLI/engine; my probes injected only the LLM seam.

## Could not verify / open items

- **Live-keyed end-to-end `defaultTreeTypecheck`** (341-1 §R6 residual): not exercised — no keyed
  call made (budget 0; every claim here was decidable keyless). The gate is proven by the real
  compiler RED/GREEN/BEFORE cases plus my independent probes.
- **`schedule.tightness` intent** for `machineApproveGate` (hole 5) — needs parent/owner reading.
- **Reachability of the parser edge forms** (claim 3) in genuine `tsc` output — not observed; tsc
  emits POSIX-relative rows in the paths I exercised.

## Verdicts

- Claim 1: **CONFIRMED** (single keyless `unattended` → P12 complete, exit 1, 4 machine gates,
  0 human; forceHuman/red-DoD parks; default path byte-identical). Two stale usage strings noted.
- Claim 2: **CONFIRMED** for the model-authored typed-red on both paths + skip-is-not-a-pass log +
  non-file-scoped refusal; **PARTIAL** because `skip` still seals (matches its doc but not the
  defeat bar) and a production-routable single-module shape is false-red by a scaffold-owned file.
- Claim 3: **CONFIRMED** for the typecheck-only repair target and unchanged core/compile/entry/spec;
  **PARTIAL** on the reserved/absolute sub-claim (Windows-separated reserved, absolute, and `..`
  paths are admitted after root-stripping).
- Claim 4: four findings above (2 stale-string, 1 parser-edge, 1 false-red, plus 2 design notes).
