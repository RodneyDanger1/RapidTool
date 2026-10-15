# 359 · lane `kind-gate` — the emitted tsconfig must admit the emitted file set, for every kind

**Lane:** W359 `kind-gate` (the wave's P0). **Wave:** W359 (kind fidelity). **Repo:**
`C:\Users\mnril\Desktop\RapidTool Main` (path contains a space). **Host:** Node **v24.15.0**, Windows PowerShell 5.1.

**Bytes judged:** the dirty W359 tree on disk, verification window **16:50–17:30, 2026-10-15**; five sibling
lanes were writing concurrently the whole time (file mtimes in §6 attribute every transient red).
**Files this lane owns and wrote:** `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`, this log.
**Constraints honoured:** no keyed LLM call; no `bash scripts/gate.sh` / no full gate; no git write; no
mock/stub/fake/demo code anywhere; no other lane's file edited. Probes live in `%TEMP%` only
(`rt359_kg_emit.mts`, `rt359_kg_tsc.mts`) plus the byte-exact backup `rt359_scaffold_patched.bak`.

## 0. One-line state

`briefedSiteFiles` is now gated on the kind whose emitted package **declares the renderer the site
imports**, `jsx` is derived from the **actual emitted file set**, and the emitted trees of all five kinds
run their own declared `tsc --noEmit` **green (exit 0, 0 errors)** where three of them were red (94 / 167 /
167 / 167) and the fourth was red for its own entry contract (`game`, TS2614 `bootGame`). `scaffold.test.ts`
is **144/144** (139 pre-existing + 5 new) and the P0 pin in `codegen.server.test.ts` is **green**
(331/331, `fixes/341-1 pre-seal self-typecheck gate` 9/9 — was 8/9 with `not ok 1`). Job (2) of the lane
brief — delete `scaffold.ts`'s replicated kind resolver — is **NOT done and is not doable from this lane**;
the evidence and the exact coordination item are in §5. Nothing else is outstanding.

## 1. The defect, at file:line

| writer | where (current bytes) | what it decided before this lane |
|---|---|---|
| the emitted tsconfig | **`src/lib/scaffold.ts:1002` `tsconfigJson(kind, hasTests)`**, pushed at `push("tsconfig.json", …)` | `jsx` was granted by a **hard-coded kind list**: `kind === "webapp" ? "react-jsx" : kind === "game" ? "preserve" : {}` |
| the multi-page JSX site | **`src/lib/scaffold.ts:5101` `briefedSiteFiles`**, called at `:9195` | **no kind gate at all**: it destructured `kind`, put it in the ctx, and gated only on page count / a mountable export / an entry path — so it fired for every kind |
| the site's runtime needs | `genericViewModule` / `genericLayoutModule` / `genericRouterModule` / `genericPageModule` / `genericConsoleModule` | every module imports **react**; `router.tsx` uses **window** |
| the declared renderer | **`PKG_DEPS` (scaffold.ts:812)** — only `webapp` declares `react`/`react-dom`; `PKG_DEV_DEPS` declares `@types/react` only for webapp | a non-web kind has no react and no DOM types for what the site writes |

**Measured, per kind** (my instrument, before the fix — full tables in §3): `app` was green end-to-end;
`game` failed its own entry contract (`TS2614 './ui/console' has no exported member 'bootGame'` — the site
**replaced** the canvas shell `src/main.ts` imports); `tool`/`service`/`library` failed with 167 errors each
(`TS6142:10, TS17004:58, TS7026:84, TS2307:7, …` — JSX without a `jsx` setting, plus `react` imported but
never declared).

## 2. Direction chosen, and why (jobs 1)

**(a) gate the JSX site on the kind whose emitted package declares its renderer — and (b) derive `jsx`
from the emitted file set.**

- **(b) alone is measured insufficient**, not merely less capable (re-derived from the W358 lane's probe
  and consistent with mine): flipping `jsx` on a `tool` tree with the site present still reds, because the
  site also needs the DOM lib, `@types/react`, a browser entry and vite scripts — i.e. it needs the tree to
  *be a webapp*, which is the opposite of kind fidelity. And `game` is unchanged by any `jsx` value: its
  one error is the site deleting the shell its entry imports.
- **(a) drops nothing runnable.** For `tool`/`service`/`library` the site cannot run at all: no vite
  script, no `index.html`, no react, and the entry does not import `src/ui/console.tsx` (the CLI entry
  imports `node:` builtins only). Every kind keeps its own surface — CLI + bin launcher (`tool`), the
  `start` server (`service`), the importable public module (`library`), the canvas loop (`game`) — plus the
  JSX-free operator shell; the webapp keeps the whole derived site (asserted in §4, test 5).
- **(b) as the *shape* of the tsconfig rule** matters beyond this defect: a kind list is a **second source
  of truth** for "does this tree carry JSX source", so it drifts the next time an emitter writes a `.tsx`
  for a kind the list does not name. The emitted `jsx` is therefore read from the file set this emit
  **actually writes** (`files.some((f) => JSX_SOURCE_EXT_RE.test(f.path))`), and the transform follows the
  **declared renderer** (`PKG_DEPS[kind]?.react !== undefined ? "react-jsx" : "preserve"`).

## 3. Per-kind proof (same instrument, keyless)

**Fixture:** the A2-F5 prose-bakery shape, parameterised by kind (a brief + spec naming ≥2 pages over a
mountable generated tree) — the shape that **fires** the 353 site, so each kind's JSX population is
maximal. Numbers are therefore **not** comparable to the W358 lane's 83/97/180 (different fixture); the
direction and the zero are what matter, and both are reproduced by two independent instruments.

**Instrument A — the repo's own TypeScript, in memory, over the emitted bytes with the emitted
`compilerOptions`** (the production-relevant root: `typecheckDir` junctions the repo's installed tree):

| kind | emitted files | emitted `.tsx` | emitted `jsx` | diagnostics before | diagnostics after |
|---|---|---|---|---|---|
| `app` (webapp) | 26 → 26 | 9 → 9 | `react-jsx` → `react-jsx` | **0** | **0** |
| `game` | 26 → 17 | 8 → 1 | `preserve` → `preserve` | 1 (`TS2614` `bootGame`) | **0** |
| `tool` (cli-tool) | 24 → 15 | 8 → 1 | **absent** → `preserve` | 73 (`TS6142`/`TS17004`/`TS7026`/…) | **0** |
| `service` | 23 → 14 | 8 → 1 | **absent** → `preserve` | 73 (same census) | **0** |
| `library` | 23 → 14 | 8 → 1 | **absent** → `preserve` | 73 (same census) | **0** |

**Instrument B — the emitted tree's OWN declared `tsc --noEmit`, on disk**, written to
`%TEMP%\rt359trees\<kind>` with `node_modules` holding **junctions of exactly the packages its
`package.json` declares** (a faithful offline stand-in for that tree's own `npm install`; no repo package
stands in for an undeclared one):

| kind | before | after |
|---|---|---|
| `app` | **exit 0 · 0 errors** | **exit 0 · 0 errors** |
| `game` | exit 2 · **94** `{TS2614:1, TS2307:7, TS7026:84, TS7006:1, TS2741:1}` | **exit 0 · 0 errors** |
| `tool` | exit 2 · **167** `{TS6142:10, TS17004:58, TS2307:7, TS7026:84, TS2304:5, TS2554:1, TS7006:1, TS2741:1}` | **exit 0 · 0 errors** |
| `service` | exit 2 · **167** (same census) | **exit 0 · 0 errors** |
| `library` | exit 2 · **167** (same census) | **exit 0 · 0 errors** |

The declared-deps-only reading is the honest one for the **dependency half** of the invariant: with the
repo's shared toolchain the site's `react` import resolves even for kinds that declare none, which is
exactly the masking §1.3 of `fixes/358_close_kindjsx.md` names — hence the junction-only-declared toolchain
above, where `TS2307 Cannot find module 'react'` appears for every undeclared site consumer.

The two commands the lane brief asks for:

```powershell
node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts
# # tests 144 · # pass 144 · # fail 0 · # skipped 0   (139 pre-existing + 5 new; duration ~39 s)
node --experimental-strip-types --test --test-reporter=tap src/lib/codegen.server.test.ts
# # tests 331 · # pass 331 · # fail 0 · # skipped 0
npx tsc --noEmit
# TSC_EXIT=0 · 0 error TS lines (run after the sibling lanes settled; see §6 for the attribution)
```
