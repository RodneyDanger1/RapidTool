# 340-6 (A3-f07 / W-14) — real default emitted-UI generator

Repo: `C:\Users\mnril\Desktop\RapidTool Main` · branch `main` · lane HEAD `a097fa8`
(persona: emitted-ui). Owned files touched: `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`, this log.
Runtimes: host `node` v24.15.0 and Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`).

## Reconciliation

On disk at `a097fa8`, `scaffold.ts:1258-1295` was explicit: the DEFAULT emitted webapp shell was a
name-dump — `generated exports (N): a, b, c` with two `TODO(A3-f07)` markers — behind the `UiGenerationHook`
seam (fixes/277). The surrounding wrapper (imports + `export function Console()` / `export default Console`)
and the `UiGenerationHook`/`UiGenerationRequest` types were scaffold-owned and correct; only the default
body, its docs, and the bar it is held to were owed.

Change: replaced `defaultUiGeneration`'s module-branch body with a real, deterministic generator and added
its private helpers (`uiParamParts`, `uiParseParam`, `uiObjectLiteralKeys`, `uiReadParen`,
`uiExportedCallables`, `uiGeneratedEntrySource`, `uiDomainFields`, types `UiField`/`UiCallable`). The
`UiGenerationHook` type, `UiGenerationRequest`, `emitUi`'s imports/export wrapper and the hook call site are
byte-unchanged. The null-`generatedNamespace` (no generated module) branch is byte-identical to the
pre-340-6 shell. All edits are targeted patches; no reformat.

## Generator inputs → emitted-value mapping

Inputs read (nothing invented):

| Input | Used for |
|---|---|
| the generated ENTRY source (`uiGeneratedEntrySource`) | the module the shell's `generated` namespace really imports |
| `project.implementationSpec.typeSignatures` | recorded parameter names/types → field fallback |
| `project.contracts.entities[].fields` | A6 domain fields (`Entity · field`) → field fallback |
| `project.lattice.entities` | brief nouns → last-resort field labels |
| the entry's exported function surface | the interaction's call target |

Entry resolution mirrors `scaffoldProject` exactly (same rule the oracle spec + shell import use):
tree mode ⇒ first job node's sanitized path, else `src/generated.ts`, else the alphabetically first accepted
tree file; legacy ⇒ the `generatedSource` host, plus `TEMPLATE_EXPORT_TAIL` when the source is the P6
template. This is what guarantees the call target is a name the imported module actually exports.

Export scan (`uiExportedCallables`) recognises only bindings tied to a function declaration:
`export [async] function f(…)`, `export const f = (…) =>` / `= function…`, and declared functions re-exported
via `export { f }`. Object-literal parameter defaults (`spec = { name: "", phase: 0, job: "" }`) contribute
their **real** key names (and inferred scalar types) as fields. No binding that cannot be tied to a function
is ever callable, so a call to a non-exported name is impossible by construction.

Call shape (deterministic): object-literal default ⇒ `generated.f({ k: … })`; ≥2 params ⇒ positional
`generated.f(a, b)` with `Number(...)`/`String(...)`/`=== "true"` coercion by recorded type; a single
non-primitive param ⇒ one object of the fields; zero params ⇒ `generated.f()` and the fields come from the
spec/contract/lattice fallbacks (still real values). The W-14 bar: `fields.length >= 2` AND a real callable,
else the honest panel.

## Proof

### before → after (real engine fixture, `fullRun()`; legacy hosted-module path)

Before (`a097fa8`):

```tsx
export function Console() {
  const exported = Object.keys(generated);
  return (
    <main>
      <h1>{"Fixture"}</h1>
      <p>generated exports ({exported.length}): {exported.join(", ") || "(none)"}</p>
    </main>
  );
}
```

After (entry = `src/jobs/dispatch.ts`; `synthesize` is in the entry's real export surface):

```tsx
export function Console() {
  const onSubmit = (event: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = generated.synthesize({
      name: String(data.get("name") ?? ""),
      phase: Number(data.get("phase") ?? ""),
      job: String(data.get("job") ?? ""),
    });
    const output = event.currentTarget.querySelector("output");
    if (output) output.textContent = String(JSON.stringify(result));
  };
  return (
    <main>
      <h1>{"Fixture"}</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="rt-name">{"name"}</label>
        <input id="rt-name" name="name" defaultValue="" />
        <label htmlFor="rt-phase">{"phase"}</label>
        <input id="rt-phase" name="phase" defaultValue="" />
        <label htmlFor="rt-job">{"job"}</label>
        <input id="rt-job" name="job" defaultValue="" />
        <button type="submit">{"Run synthesize"}</button>
        <output />
      </form>
    </main>
  );
}
```

3 fields (`name`/`phase`/`job` — the generated function's own parameter-default keys), 1 form interaction
calling `generated.synthesize`. `dispatch.ts` carries `export { JOBS, REJECTION, synthesize };`.

Spec-derived case (`implementationSpec.typeSignatures = ["createRequest(customerId: string, priority:
number): …"]`, `generatedSource` exporting `createRequest`): emits inputs `name="customerId"`,
`name="priority"` and calls `generated.createRequest(String(...), Number(...))` — the fields are exactly the
recorded spec parameters and the called name is the emitted entry's real `export function createRequest`.
Tree-mode case: a `generatedTree` row `src/jobs/plan.ts` exporting `planRoute(origin, destination)` yields
`import * as generated from "../jobs/plan.ts"` + `generated.planRoute(...)` with `origin`/`destination`
inputs — the tree ENTRY's real surface.

### ≥2-field + interaction proof

New pins in `src/lib/scaffold.test.ts` (8 subtests, `A3-f07 / W-14 — default emitted-UI generator`):
1. spec-derived fields + interaction bound to a real generated export (asserts each emitted `name="…"`
   maps to a recorded spec parameter; asserts the called name is an actual `export function` of the
   resolved entry);
2. real engine fixture: name-dump gone, `generated.synthesize(` present, ≥2 inputs, every called name
   proven exported by the imported entry;
3. tree mode: binds the tree ENTRY's real exports;
4. no generated module ⇒ honest "no generated module yet" panel, no `<input>`/`onSubmit`;
5. module with no callable, and callable with no real fields ⇒ honest panels, never a fake call;
6. byte-determinism across two builds (`deepEqual` + UI body equality);
7. parse pin with teeth;
8. caller `UiGenerationHook` still overrides the default (and `null` keeps it).

RED-first evidence: before the `scaffold.ts` edit the same suite read
`# tests 67 / # pass 64 / # fail 3` (failing: spec-derived binding, real-fixture binding, nothing-bindable
panel). After: `# tests 69 / # pass 69 / # fail 0` on BOTH v22.23.2 and v24.15.0.

### Determinism pin

`it("is byte-deterministic across two builds (UI included)")` runs two `scaffoldProject` calls and asserts
`deepEqual(resultA, resultB)` plus equal `src/ui/console.tsx` bodies. Every list the generator consumes
(`callables`, `objectKeys`, `fields`) is project-ordered; no `Date`, no `Math.random`, no model call, no new
dependency.

### Parse pin

`assertParsesTsx` uses the repo's existing TS parse helper (`ts.transpileModule` with
`reportDiagnostics: true`, `fileName: "console.tsx"`, `jsx: ReactJSX` — the same API as
`src/lib/compile-check.server.ts`; `typescript` is already a devDependency and `sandbox.test.ts` imports it
under strip-types). Applied to the spec-derived, real-fixture and tree-mode UI bodies. A teeth subtest feeds
a malformed shell and asserts a diagnostic is produced.

### Real emitted-tree verification (keyless floor, runtime)

Wrote a full keyless emit of `fullRun()` (19 files) to `%TEMP%\rt340_6\emitted`, then dynamically imported
`src/jobs/dispatch.ts` under Node 22 strip-types:

```
entry runtime exports: JOBS, REJECTION, synthesize
synthesize typeof: function
runtime call result: {"ok":true,"name":"Fixture","job":"dispatch","addressed":false}
```

So the UI's call target is a genuine runtime export and the call executes — not a regex-only claim.

## Marker removal

`TODO(A3-f07)` is gone from both owned files (grep = 0). Docs updated to describe the real default and its
bar: the `UiGenerationRequest` block comment, `ScaffoldOptions.uiGeneration`, the `ScaffoldResult.uiGeneration`
record, `emitUi`'s doc, the tree-mode node-loop comment, and the hook/wrapper comments. The
`ScaffoldResult.uiGeneration.hook` union literal was renamed `"default-name-dump"` → `"default-generator"`
(it is no longer a name-dump; declare-or-strike). No consumer referenced the old literal (repo-wide grep over
`*.ts`/`*.mjs`), and a new test pins both `"caller"` and `"default-generator"`.

## Mock / fake / placeholder census

None introduced. No `as any`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, silent `catch {}`, hardcoded
returns faking a computation, TODO bodies, or dead/false comments (grep over the diff). Every emitted field
traces to a recorded spec/contract/lattice value or a generated function's own parameter/parameter-default
key; every emitted `generated.<name>(` call traces to an export the resolved entry module really has. Tests
run the real engine fixtures and the real emitter; the parse pin has a teeth subtest.

## STOP-and-REPORT, not done elsewhere

- **One deliberate, in-file decision to confirm: the real UI branch is hook-free.** The webapp wrapper
  imports `useState` only when there is NO generated module (`...(genEntry ? [] : [import { useState }])`).
  The mission forbids touching the surrounding wrapper, so the module-present body uses a plain
  `onSubmit` form handler (`FormData` + an `<output>` node) instead of `useState` — no new dependency, no
  hook required, and the no-module branch keeps `useState` exactly as today. If the intent was `useState`
  in the real branch too, that requires making that import unconditional (a wrapper change) — flagged, not
  done.
- The `ScaffoldResult.uiGeneration.hook` literal rename above is inside the owned file; called out for
  review because it is technically beyond "default body only", but leaving `"default-name-dump"` would be a
  false claim under the repo's declare-or-strike rule.
- No change was needed in any other file; `scripts/**` and the CLI have no consumer of the renamed record
  (grep = 0).

## Not verified (and why)

- Did not run `npm run lint` / `npm run typecheck` / the full gate — the lane brief restricts execution to
  `src/lib/scaffold.test.ts` on both runtimes. The added code was written to be type- and lint-clean by
  construction (no suppressions, no `any`, no unused bindings), but a typecheck pass is owed at the wave
  boundary.
- The emitted project's own `tsc --noEmit` / `vite build` was not run (that is the full gate's `build` leg).
  The UI file is proven to parse (transpileModule) and the called entry export is proven to import and run.
- The game / cli-tool / library / service shells are untouched by design and unchanged; only the webapp
  branch was reworked.
