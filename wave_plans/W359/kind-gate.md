# W359 · lane `kind-gate` — the emitted source must compile under the emitted tsconfig, for every kind

**Wave:** W359 (kind fidelity). **Persona:** `quill`. **Author:** the wave parent. Read FIRST.

## Mission

Close the last `.ts`-compile failure class in the emitter. Measured truth
(`research/multiagent/358_cartographer.md` §1.2, re-derived by the cartographer, not read from a lane):
**three of five kinds emit source their own declared toolchain cannot compile.**

| kind | emits `.tsx` | emitted `jsx` |
|---|---|---|
| `app` | `src/main.tsx`, `src/ui/console.tsx` | `react-jsx` |
| `game` | `src/ui/console.tsx` | `preserve` |
| **`tool`** | `src/ui/console.tsx` | **absent** |
| **`service`** | `src/ui/console.tsx` | **absent** |
| **`library`** | `src/ui/console.tsx` | **absent** |

It becomes visible when the 353 briefed-site emitter also writes real JSX
(`src/ui/pages/*.tsx`, `view.tsx`, `layout.tsx`, `router.tsx`): the tree's own `tsc` then reds with
**TS17004 / TS6142**. That is the `codegen.server.test.ts` "fixes/341-1 pre-seal self-typecheck gate" red —
one of the last three failures in the whole boundary.

## Where the cause is (both in the file you own)

- `src/lib/scaffold.ts:5092-5136` `briefedSiteFiles` — **no kind gate**: it destructures `kind` (`:5098`),
  puts it in the ctx (`:5115`), and gates only on page count / a mountable export / an entry path
  (`:5099-5112`). Its sibling `rendererFiles` **is** gated (`scaffold.ts:4278`:
  `if (kind !== "webapp" || …) return null;`).
- `src/lib/scaffold.ts:984` `tsconfigJson(kind, hasTests)` — the `jsx` decision is
  `kind === "webapp" ? "react-jsx" : kind === "game" ? "preserve" : {}` (`:1006-1010`).

## Owned files (yours alone)

`src/lib/scaffold.ts` · `src/lib/scaffold.test.ts`

## MINI-TASK PLAN

1. Establish the invariant **as a test**: for every kind, every emitted source file must compile under the
   emitted `tsconfig.json`'s options. Choose the honest direction and justify it in your log:
   (a) gate the 353 emitter on the kind so a non-web kind does not emit `.tsx` at all, or
   (b) derive `jsx` from the **actual emitted file set** (if the tree contains any `.tsx`, the emitted
   tsconfig must enable an appropriate `jsx`) rather than from a hard-coded kind list.
   Prefer whichever keeps the emitted product **most capable** while self-consistent. Note that (b) is the
   more robust shape: it cannot drift from the emitter again, whereas a kind list is a second source of
   truth. If you choose (a), say why a non-web kind should have no UI surface.
2. Keep the two currently-green capabilities green: the W358 merge (`uiOperatorFormBody` /
   `siteOperatorConsole`, `scaffold.ts:2515`/`:2529`) and both `scaffold.test.ts` capabilities
   (139/139 today). Do not regress `src/ui/console.tsx`'s real-field binding for `webapp`.
3. **Also check the emitted script/entry surface per kind.** `tool`/`service`/`library` declare
   `typecheck`+`test` and only `service` adds `start`; if the kind cannot run its own declared scripts,
   that is the same class of defect and belongs in your log (and in a test).
4. Prove it per kind, keyless: emit each kind and record the emitted extensions against the emitted
   tsconfig options, then run the tree's own `tsc` if it can resolve a toolchain. If it cannot (no
   `node_modules`), prove consistency from the bytes AND say so.

## Verification

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts
node --experimental-strip-types --test --test-reporter=tap src/lib/codegen.server.test.ts
```
(`codegen.server.test.ts` owns the pre-seal red; it is `inject-kind`'s file — if the red clears from your
scaffold fix with no expectation change, say so; if an expectation must change, report it in your log and
let that lane do it.)

## Logging

`fixes/359_kind_gate.md`. Record: the per-kind before/after table, the direction chosen and why, the new
test that pins the invariant, and every kind whose declared scripts the emitter cannot honour.

## Do not

- Do not edit `src/lib/engine.ts`/`types.ts` (`resolve-kind`), `src/lib/codegen.server.ts` /
  `prompt-engine.ts` (`inject-kind`), `scripts/**` (`thread-kind`, `kind-corpus`), the register, or
  another lane's log.
- Do not fix this by disabling a compiler check, emitting an unchecked page, or loosening a test.
- No keyed LLM call. Do not run the full gate. No git writes.
- **100% working production code only: no mock, stub, fake, demo, or placeholder code on any production
  path.** A test double may live only in a test seam.
