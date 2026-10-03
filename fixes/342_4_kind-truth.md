# 342-4 — kind resolution single source of truth

**Lane:** engineer 342-4 (kind resolution single source of truth). **Root:** `C:\Users\mnril\Desktop\RapidTool Main`
(git `main`, HEAD `686d7b6`; my five owned files were clean at start). **Runtimes:** host `node` v24.15.0 and
pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2. **Scratch:** `$env:TEMP\rt342_4\`.
**Keyed calls: 0.** **No full gate** — targeted suites only, both runtimes. No tracked file deleted.
**Files touched:** `src/lib/types.ts`, `src/lib/engine.ts`, `src/lib/scaffold.ts`, `src/lib/engine.test.ts`,
`src/lib/scaffold.test.ts` (+ this log). `src/lib/codegen.server.ts` was read only — its cross-lane contract
(§S6 of `fixes/341_1_kinds.md`) had already landed in the working tree by its own lane (§5).

The question: *kind resolution is decided twice, by hand-kept reflexes — what is the honest single source of
truth?* Answer: the STORED `Project.kind`, widened to a 5-way `DeliveryKind`, decided ONCE by
`engine.deliveryKindOf`, stamped ONCE by `engine.withDeliveryKind` at the keyed P6 seam, and READ BACK by both
resolvers (`engine.uiKindOf`, `scaffold.projectKindOf`) — neither re-infers from brief nouns any more.

---

## 1. The single source of truth (`file:line`)

| Piece | Where | What it does |
|---|---|---|
| the taxonomy | `types.ts:31-32` | `export const DELIVERY_KINDS = ["app","tool","game","library","service"] as const; export type DeliveryKind = …` |
| the stored field | `types.ts:454` | `Project.kind?: DeliveryKind` — widened from `"app"\|"tool"\|"game"` so `"library"` is expressible instead of overloading kind-absence |
| the ONE decision | `engine.ts:210` | `deliveryKindOf(project)`: returns the STORED kind when legal, else infers once from brief/domain/jobs (library-first precedence) |
| the ONE stamp | `engine.ts:231` | `withDeliveryKind(project)`: stores that value; an already-decided project is returned as the SAME reference (never re-derived) |
| the stamp site | `engine.ts:3258` | `upgradeP6Keyed` (the keyed `upgradeP6Keyed`-class seam) calls `withDeliveryKind(p)` BEFORE codegen, so the routing signal and the emitted shape share one value |
| engine resolver | `engine.ts:243` | `uiKindOf` is now a 3-way projection of `deliveryKindOf` (library→library, tool→cli-tool, else ui) — it never reads the brief |
| scaffold resolver | `scaffold.ts:526` | `projectKindOf` MAPS `deliveryKindOf` onto the 5-way scaffold names; its private `KIND_ORDER`/`KIND_KEYWORDS` inference is DELETED |
| persistence | `engine.ts:2753` | `hydrateProject` clamp widened to the 5-way set (a stored `"library"` survives the export→import→export hop) |

`scaffold.ts:81` imports `deliveryKindOf` from the engine. That edge is acyclic: the engine never imports the
scaffold, and the scaffold already reached the engine transitively (`scaffold → io.ts → engine.ts`), so no new
dependency class was introduced. Preserved exported shapes: `scaffold.projectKindOf(project): ProjectKind` (5-way
names unchanged), `engine.uiKindOf` stays private 3-way, `Project.kind` stays optional/additive.

---

## 2. RED-first (real before/after, both runtimes)

Two tests were added against the pre-change bytes and run BEFORE the implementation.

```
v24.15.0 / v22.23.2   (identical)
not ok 1 - hydrateProject preserves a stored library kind (it must be expressible)
    expected: 'library'   actual: undefined          # 3-way union + clamp dropped it as junk
not ok 1 - 342-4: a STORED kind is the single source of truth — projectKindOf never re-infers against it
    expected: 'library'   actual: 'webapp'           # declared-kind branch had no library row → fell through to inference
# tests 2  # pass 0  # fail 2
```

RED surfaces the exact remaining defect: the engine could DECIDE `"library"` but `Project.kind` could not
EXPRESS it, so the decision was never stored and the scaffold had to re-infer — the same-by-luck agreement the
341-1 lane hand-pinned, one vocabulary drift away from diverging again (`"libraries"`).

## 3. GREEN + the consistency proof (both runtimes)

`%TEMP%\rt342_4\probe.mjs` (real engine + real scaffold emitter + real `compile-check.server.ts treeRun`; no key):

```
stored kind (create)          = undefined
engine.deliveryKindOf         = library
engine.withDeliveryKind.kind  = "library"
scaffold.projectKindOf        = library
floor.kind                    = "library"
scaffold.projectKindOf(floor) = library
scaffold.ok                   = true
emitted files                 = README.md, DEPLOY.md, .env.example, .gitignore, package.json, tsconfig.json,
                                .rapidtool/project.json, src/main.ts, src/domain/logistics.ts, src/api/routes.ts,
                                src/state/store.ts, src/jobs/deliver_core_workflow.ts, src/ui/console.tsx,
                                tests/oracle.spec.ts
package main/exports/files    = {"main":"./src/main.ts","exports":{".":"./src/main.ts"},"files":["src"],"private":false}
has index.html                = false
treeRun.ok                    = true
treeRun.project.typecheck     = {"script":"typecheck","run":"pass","command":"tsc --noEmit","executed":true,"exitCode":0}
treeRun.project.test          = {"script":"test","run":"pass","command":"node --experimental-strip-types --test tests/oracle.spec.ts","executed":true,"exitCode":0}
treeRun.declaredScriptsVerified = true
treeRun.run                   = {"kind":"headless","entry":"src/main.ts","run":"pass"}
treeRun.tests                 = [{"file":"tests/oracle.spec.ts","compile":"pass","tests":{"pass":11,"fail":0},"run":"pass"}]
```

The `"A kanban board library exposing a typed board client"` brief resolves to ONE kind end-to-end — engine
decision (`library`) == stored value (`"library"`) == scaffold decision (`library`) == emitted shape (a real
library PACKAGE: `main`/`exports`/`files`, `private:false`, no `index.html`) — and that tree passes its OWN
declared `typecheck` and `test` (`declaredScriptsVerified: true`) on both runtimes.

## 4. Teeth (unchanged, re-measured)

`%TEMP%\rt342_4\teeth.mjs` (real classifier + emitter + treeRun):

```
webapp deliveryKindOf = app   | scaffold kind = webapp | has index.html = true | React shell = true
game   deliveryKindOf = game  | scaffold kind = game   | manifest = true     | bootGame canvas = true
type-red treeRun.ok   = false
type-red project.typecheck = {"script":"typecheck","run":"fail","exitCode":2,
  "detail":"src/domain/logistics.ts(62,7): error TS2322: Type 'string' is not assignable to type 'number'."}
type-red outcome.error = "the emitted project's own `npm run typecheck` fail (exit 2) — …TS2322…"
```

A webapp brief still emits the webapp UI, a game brief the canvas shell, and a genuinely type-red tree is still
refused by the real compiler seam — no green-but-type-red seal.

## 5. Suites (targeted, both runtimes)

```
                                  v24.15.0        v22.23.2
engine.test.ts                    20/20/0         20/20/0        (was 17; +3 new)
scaffold.test.ts                  75/75/0         75/75/0        (was 73; +2 new)
scaffold+engine (combined)        95/95/0         95/95/0        (baseline 90/90/0)
codegen.server.test.ts (read-only) 212/212/0       212/212/0      regression: 0 fail
gates.test.ts + io.test.ts +
  emitted-honesty.test.ts +
  sweep73-fuzz.test.ts + chat.test.ts   288/288/0   288/288/0     (extra read-only regression)
tsc --noEmit -p tsconfig.json     exit 0 (whole repo)
eslint (5 owned files)            exit 0
```

The codegen file is a read-only regression only. Its RED assertion at `codegen.server.test.ts:2662`
(`singleModuleLibraryKind({kind:"library"}) === true`) was failing against the HEAD bytes I started from; it
now passes because the OWNING lane landed the pre-specified contract in the working tree while this lane worked
(`codegen.server.ts:4122-4128`: `kind === undefined || kind === null || kind === "library"`). I did not edit
that file. With it, my stamped `kind:"library"` still routes to the honest single-module library path.

## 6. Mock / fake census (this diff only)

`git diff` over the five files: `as any` 0 · `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` 0 · `eslint-disable` 0 ·
`TODO`/`FIXME` 0 · empty `catch {}` 0 · `.only(`/`.skip(` 0 · hardcoded-return fakes 0. The RED/GREEN evidence uses
the real engine, the real emitter and the real `tsc`; no doubles. No placeholder bodies; comments state only what
the bytes do.

## 7. STOP-and-REPORT / residuals

- **No STOP outstanding.** The one out-of-slice change needed (accept `kind === "library"` in
  `singleModuleLibraryKind`) is already landed by its owning lane (observed, read-only; §5). This lane made no
  change outside its five files.
- **Doc staleness in a peer file (not mine):** `codegen.server.ts:4103` still describes `Project.kind` as the
  coarse `"app"|"tool"|"game"` set; the paragraph above its new `library` arm is now stale. Reporting only.
- **Labeling gap in a peer file (not mine):** `compile-check.server.ts:576` `COARSE_KIND_LABEL` has no
  `library`/`service` rows, so a library tree-run record's coarse label falls back. Pre-existing (library was
  previously absence-signaled, so it fell back before too) — no regression, reporting only.
- **Keyed end-to-end stamp not exercised live:** keyed budget 0. The stamp seam is a pure function
  (`withDeliveryKind`) unit-tested directly, and the wiring is the single call at `engine.ts:3258`; a live keyed
  run proving the stamp on the wire was not measured. Reported, not overrun.

## 8. Verdict

**The decision is now made once.** `Project.kind` (widened to the 5-way `DeliveryKind`) is the single source of
truth; the engine decides it in one function, stamps it once at the keyed P6 seam, and both resolvers read the
same value back with no brief-noun re-inference left in the scaffold. The `"A kanban board library…"` brief
resolves to `library` at every layer and emits a real, self-typechecking, self-testing library package; a
genuinely type-red tree still refuses; webapp and game briefs still emit their UI and canvas shells. The two
hand-kept classifiers that could drift are gone — the remaining inference site is a single engine function used
only when a project carries no stored kind (legacy/keyless), and both resolvers route through it.
