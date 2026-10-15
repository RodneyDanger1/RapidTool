# 358 · lane `close-kindjsx` — the emitted tsconfig must admit the emitted file set, for every kind

**Lane:** W358 `close-kindjsx`. **Wave:** W358 (final closure). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`
(path contains a space). **Host:** Node **v24.15.0**, Windows PowerShell 5.1.

**Pinned revision:** HEAD `30bce78` + the uncommitted W357/W358 lanes (dirty tree). Bytes read
15:5x–16:2x, 2026-10-15. **Measured while `close-ui` was mid-write in `src/lib/scaffold.ts` (mtime
16:05:41)** — see §5, which is why this lane did not land the fix at the cause.

**Constraints honoured:** no product file outside my four (`scaffold.ts` read-only; the one forced fixture
edit in `headless.test.ts` is disclosed in §4.4); no keyed LLM call; no `bash scripts/gate.sh`; no git
write; no mock/stub/fake/demo code. Probes live in `%TEMP%` only
(`rt358_emit.mts`, `rt358_replay.mts`, `rt358_bodies.mts`, `rt358_nosite.mts`, `rt358_console.mts`,
`rt358_owntsc.mts`, `rt358_dirb.mts`, `rt358_declared.mts`).

---

## 1. JOB 1 — the exact mismatch, per kind, at `file:line`

### 1.1 The two writers

| what | where | what it decides |
|---|---|---|
| the emitted tsconfig builder | **`src/lib/scaffold.ts:984-1015` `tsconfigJson(kind, hasTests)`**, pushed at **`:9158`** | `jsx` is granted at `:1004-1010` to **`webapp` (`react-jsx`) and `game` (`preserve`)** and to **nothing else**; `lib` is DOM-only for those two (`:986-987`); `types` is `["vite/client","node"]` for webapp, `["node"]` otherwise (`:997`) |
| the multi-page JSX site | **`src/lib/scaffold.ts:4995-5036` `briefedSiteFiles` (353)**, called at **`:9035-9038`**; the 351 site at **`:9010-9019`** | for **any** kind, when the project's spec/brief names ≥2 pages and a page can mount a real export, it emits `src/ui/view.tsx`, `layout.tsx`, `router.tsx`, `pages/*.tsx` **and replaces the ui node** with `genericConsoleModule` |
| the site's runtime assumptions | `genericViewModule:4689` · `genericSiteDataModule:4793` · `genericLayoutModule:4851` · `genericRouterModule:4894` · `genericPageModule:4936` · `genericConsoleModule:5058` | every module **imports `react`** (`useEffect/useState/ReactNode`) and `router.tsx` uses **`window`** |
| the declared renderer | **`src/lib/scaffold.ts:812-814` `PKG_DEPS`** (*only* `webapp: react + react-dom`) and **`:816-835` `PKG_DEV_DEPS`** (only webapp declares `@types/react`; game/tool/service/library declare none) | a non-webapp sort has **no react and no DOM types** to compile what the site writes |
| who runs the emitted tree's own tsc | `src/lib/codegen.server.ts:6280-6319` `defaultTreeTypecheck` (materializes the candidate via `scaffoldProject`), `src/lib/compile-check.server.ts:1929` `typecheckDir` → the tree's declared `tsc --noEmit` | the verdict detail is a bounded **1500-char TAIL** (`compile-check.server.ts:656 VERDICT_TAIL_MAX`) |

### 1.2 The measured combination per kind (the fixture that reds the pin: `kind` × the site-firing spec)

Method: `liveP6Synthesis` (injected keyless deps) → `scaffoldProject` → write the tree to a temp dir →
**run the emitted tree's own declared `tsc --noEmit`**, full output (`%TEMP%\rt358_owntsc.mts`).

| kind | emitted `tsconfigJson.jsx` | other compiler options | declared deps | emitted `.tsx` | tree's OWN tsc (full output) |
|---|---|---|---|---|---|
| **app** (webapp) | `"react-jsx"` | `lib: ES2022,DOM,DOM.Iterable` · `types: vite/client,node` | react, react-dom, @types/react, vite, … | 11 | **exit 0 · 0 errors** — consistent |
| **game** | `"preserve"` | DOM lib · `types: node` | `{}` (devDeps: @types/node, typescript, vite) | 10 | **exit 2 · 1 error**: `src/main.ts(7,10) TS2614: Module '"./ui/console"' has no exported member 'bootGame'` — the site **replaced** the canvas shell the game entry imports |
| **tool** (cli-tool) | **absent (`null`)** | `lib: ES2022` · `types: node` | `{}` (devDeps: @types/node, typescript) | 10 | **exit 2 · 83 errors** `{TS17004:63, TS6142:14, TS2304:4, TS2554:1, TS2749:1}` |
| **service** | **absent** | as tool | as tool | 10 | **exit 2 · 83 errors** (same census) |
| **library** | **absent** | as tool | as tool | 10 | **exit 2 · 83 errors** (same census) |

With a **declared-deps-only** `node_modules` (only the packages the emitted `package.json` names; no repo
package can stand in) the same four reds grow, because the site's `react` import resolves nowhere
(`%TEMP%\rt358_declared.mts`): game **97** errors (`TS7026:87, TS2307:7, TS2614:1, …`) and
tool/service/library **180** each (`TS17004:63, TS7026:87, TS6142:14, TS2307:7, TS2304:5, TS2749:1, …`).
app stays exit 0 · 0 errors.

**The pin's exact sentence.** `codegen.server.test.ts:3195-3215` asserts that the sealed tree's real
typecheck verdict is the *fixture's* class (`/TS2749|TextDecoder/`). At the current bytes the tree fails for
83 reasons and the verdict's 1500-char **tail** carries only the page rows (its first bytes are mid-word:
`'is provided.\r\n…/pages/Export_function_addColumn_board_Page.tsx(36,11): TS17004…'`), so the chunk's
`src/generated/chunk-0.ts(10,14) TS2749` is truncated away. **The premise is false because the emitted tree
is red, not because the tail is wrong** — which is why this is a kind-fidelity defect, not a test drift.

### 1.3 The mismatch stated as an invariant

> For every kind, the emitted `tsconfigJson` must admit every module the emitter writes for that kind, and
> the emitted `package.json` must declare every runtime the emitted source imports.

Today `kind ∈ {cli-tool, service, library}` violates the compiler half (`.tsx` written, no `jsx`) **and** the
dependency half (react imported, react undeclared); `game` violates the dependency half and, when the site
fires, its own entry contract (`bootGame`).

---

## 2. JOB 2 — the direction: (a) scope the JSX site to the kind that declares its renderer, and derive
`jsx` from the emitted file set

### 2.1 (b) is measured *insufficient*, not merely less capable

Flipping `jsx` alone on the emitted `tool` tree and re-running its own tsc (`%TEMP%\rt358_dirb.mts`):

```
tool as emitted (jsx=null)                    : exit=2 errors=83 {TS17004:63,TS6142:14,TS2304:4,TS2554:1,TS2749:1}
tool with jsx="preserve" ONLY (deps untouched): exit=2 errors=6  {TS2304:4,TS2554:1,TS2749:1}
tool with jsx="react-jsx" ONLY (deps untouched): exit=2 errors=6  {TS2304:4,TS2554:1,TS2749:1}
    src/ui/router.tsx(27,22): error TS2304: Cannot find name 'window'.   (×4)
    src/ui/pages/Export_function_addColumn_board_Page.tsx(18,31): error TS2554: Expected 0 arguments, but got 1.
game: unchanged by any jsx value (its one error is TS2614 — the console replacement)
```

So "enable `jsx`" buys 77 of 83 rows and leaves the tree red: the site also needs the **DOM lib**
(`lib: ["ES2022"]` for the non-web kinds), `types: vite/client`, the site's **react/react-dom +
@types/react** declarations, a browser entry (`index.html` + `src/main.tsx`) and the vite scripts. That is
not a tsconfig reconciliation — it is **turning a `tool`/`service`/`library` into a webapp**, which is the
opposite of kind fidelity, and it would still leave `game` red (TS2614: the site deletes the shell the game
entry imports).

### 2.2 (a), precisely scoped, is the honest and *more capable* direction

**Chosen direction: the 351/353 multi-page React site is emitted only for a kind whose emitted package
declares the renderer that site imports (`PKG_DEPS[kind].react`, i.e. webapp today) — and `jsx` is then
derived from the emitted file set rather than from a hard-coded kind list.**

Why this keeps the product most capable (all measured):

1. **Nothing runnable is dropped.** For a `tool`/`service`/`library` the site cannot run: no `vite`
   dev/build script, no `index.html`, no react, and `pkg.main`/`pkg.bin` point at the CLI/server/public
   module — the entry does not even import `src/ui/console.tsx` (measured: tool's `src/main.ts` imports only
   node builtins). The site is unreachable dead weight that reds the tree's own gate.
2. **Every kind keeps its own surface**: the CLI entry + `bin/` launcher (tool), the `start` server
   (service), the importable public API (library), the canvas loop (game), and for all four the plain-TS
   operator shell `src/ui/console.tsx` (a typed stub; JSX-free — measured, §3).
3. **It restores the pin's premise exactly.** With no site the same trees run their own tsc green except the
   synthesized chunk's planted class (`%TEMP%\rt358_declared.mts`, declared-deps-only toolchain):

   ```
   app: exit 0 errors=0 | game: exit 0 errors=0
   tool/service/library: exit 2 errors=1 {"TS2749":1}   src/generated/chunk-0.ts(10,14) TS2749
   ```

   i.e. the emitted tree's **only** failure is the class `codegen.server.test.ts:3214` pins — which is
   exactly the invariant the campaign wants (`the emitted tsconfig makes the emitted source compile`).
4. The webapp is untouched and already green end-to-end (exit 0 with declared deps only), so no web
   capability regresses.

### 2.3 The exact patch (NOT landed by this lane — see §5)

`src/lib/scaffold.ts`, three edits, all derived from bytes the emitter already has in scope:

```ts
// 1. :984  — derive `jsx` from the emitted file set, not from a kind list.
   function tsconfigJson(kind: ProjectKind, hasTests: boolean, emittedJsx: boolean): string {
     ...
-    ...(kind === "webapp" ? { jsx: "react-jsx" } : kind === "game" ? { jsx: "preserve" } : {}),
+    ...(emittedJsx ? { jsx: PKG_DEPS[kind]?.react !== undefined ? "react-jsx" : "preserve" } : {}),

// 2. :9158 — pass the emitted JSX set (uiSite is decided at :9010-9047, BEFORE this push).
-  push("tsconfig.json", tsconfigJson(kind, proj.oracle.length > 0));
+  const emittedJsx = [uiPath, ...(uiSite?.map((f) => f.path) ?? [])].some((p) => p !== null && /\.(tsx|jsx)$/.test(p));
+  push("tsconfig.json", tsconfigJson(kind, proj.oracle.length > 0, emittedJsx));

// 3. :9010 / :9035 — the JSX site only where the emitted package declares its renderer.
+  const declaresRenderer = PKG_DEPS[kind]?.react !== undefined;   // webapp (react) — never a kind list
-  const marketingSite = options.uiGeneration === undefined ? webMarketingSiteFiles({...}) : null;
+  const marketingSite = options.uiGeneration === undefined && declaresRenderer ? webMarketingSiteFiles({...}) : null;
-  const briefedSite = options.uiGeneration === undefined && marketingSite === null ? briefedSiteFiles({...}) : null;
+  const briefedSite = options.uiGeneration === undefined && marketingSite === null && declaresRenderer ? briefedSiteFiles({...}) : null;
```

### 2.4 Before / after — the emitted `tsconfig.json` for `kind:"tool"` (the pin's own emission)

**Before (measured bytes):**
```json
{"compilerOptions":{"target":"ES2022","lib":["ES2022"],"module":"ESNext","moduleResolution":"bundler",
 "allowImportingTsExtensions":true,"isolatedModules":true,"strict":true,"noEmit":true,"skipLibCheck":true,
 "types":["node"]},"include":["src","tests"]}
```
**After (the patch above, with the site scoped out):** the only delta is the derived `jsx` key, because the
ui node's plain-TS operator shell is still a `.tsx`:
```json
{"compilerOptions":{ …same…,"types":["node"],"jsx":"preserve"},"include":["src","tests"]}
```
and the emitted file set loses the 9 site modules (`view/layout/router/pages/*`) from 10 `.tsx` to 1.
For `app`/`game` the emitted tsconfig is **byte-identical** to today (`react-jsx` / `preserve`).

---

## 3. JOB 4 — the per-kind proof, from the bytes

* **Toolchain provenance (stated honestly).** No emitted tree carries `node_modules`. The seam that ran the
  trees above is `typecheckDir` → `sharedToolchainRoot()` (`compile-check.server.ts:2037-2044`): it junctions
  the **repo's own installed root**, so `react`, `@types/react` and `vite` resolve even where the emitted
  package declares none. That masks the dependency half — so §1.2 also reports a **declared-deps-only**
  toolchain (junctions of exactly the packages the emitted `package.json` names), where the masking is gone:
  app 0 errors; game 97; tool/service/library 180 each.
* **The extension-vs-compiler-option table is re-derived, not asserted**: for each kind the emitter's file
  set and the emitted `compilerOptions` were read from the same `scaffoldProject` result (§1.2).
* **The no-site baseline** (§2.2 item 3) is the byte-level positive control: with the site absent, the four
  non-web kinds' emitted trees fail their own declared typecheck for exactly one reason — the synthesized
  chunk's `TS2749` — and app/game are clean.
* A real delivered tree agrees with the shape: `testruns/bakery-website/emitted/tsconfig.json` (kind `game`)
  carries `"jsx":"preserve"` + 1 `.tsx` (the JSX-free canvas shell) and typechecks; `testruns/mobile-companion/emitted`
  (kind `library`) carries no `jsx` + 1 `.tsx` (the plain-TS stub) and typechecks. Neither delivered tree
  fired the site, so neither is red today — the corpus simply has no site-firing sample.

---

## 4. JOB 3 — R-8's type-level half (landed, with its planted proof)

### 4.1 The change — `src/lib/compile-check.server.ts`

`TreeSubstance`'s two scoped readings were **optional** (`jobScoped?`, `wholeTree?`), so a producer could
publish a census with no scope at all and still typecheck; only the runtime `censusShape` guard
(`scripts/quality-ratchet.mjs`, `fix-gates`' W357 half) caught it. They are now **required**:

```ts
  jobScoped: TreeSubstanceReading;   // was: jobScoped?
  wholeTree: TreeSubstanceReading;   // was: wholeTree?
```

and `treeSubstanceOf`'s return annotation collapsed from the now-redundant
`TreeSubstance & { jobScoped: …; wholeTree: … }` to `TreeSubstance` (the shape is the single source of the
requirement). The doc comments on the type and on `treeSubstanceOf` state the contract and name both
enforcers (this type + `censusShape`).

### 4.2 The plant — `src/lib/compile-check.server.test.ts` (the repo's own `tsc` is the prover)

```ts
      // @ts-expect-error R-8 plant: `jobScoped` and `wholeTree` are both REQUIRED on TreeSubstance
      const omitted: TreeSubstance = unscoped;
```

with a runtime companion in the same test (`treeSubstanceOf` always sets both, so the required shape is
satisfiable).

### 4.3 The planted proof, both directions (measured)

| state of the type | `npx tsc --noEmit` |
|---|---|
| **as landed (both required)** | **`TSC_EXIT=0`**, zero errors — the directive is consumed, i.e. the omission is a compile error |
| **plant: both reverted to optional** | `src/lib/compile-check.server.test.ts(2054,7): error TS2578: Unused '@ts-expect-error' directive.` **plus** 20+ `TS18048: 's.jobScoped' is possibly 'undefined'` in the *existing* census tests (1851, 1855, 1883, 1913, 2009–2026 …) — the whole suite's census reads depend on the pair being present |

The plant was landed in place, measured, and reverted within the same minute; the final tree is the required
version (`TSC_EXIT=0`). A producer cannot omit a scope and compile.

### 4.4 The one forced cross-file consequence (disclosed)

Making the pair required breaks exactly one hand-built producer elsewhere in the repo:
`src/lib/headless.test.ts:843` (`W2 · 348`, a `TreeRunOutcome` literal whose `substance` carried only the
bare counters). That file is in **no** W358 lane's scope, and the alternative was a red `npx tsc --noEmit`
for the whole wave, so the fixture was repaired minimally and honestly — one typed reading published under
both scopes (`substance: { ...census, greenWhileStubbed: false, oracleStubTrap: false, jobScoped: census,
wholeTree: census }`), which is the W356 contract's own shape (the bare fields *are* the job-scoped
reading). Nothing else in that file changed; `treeVerdictHash` reads only the bare counters
(`compile-check.server.ts:941-944`), so the fixture's hash and every assertion in the test are unchanged.
**Files touched outside my four: `src/lib/headless.test.ts` (only this fixture).**

---

## 5. Why the fix in §2.3 is NOT in these bytes (the blocker, stated plainly)

The tsconfig builder is `tsconfigJson` in **`src/lib/scaffold.ts`**, and the site emitter
(`briefedSiteFiles` / `webMarketingSiteFiles`) is in the same file. My scope (`wave_plans/W358/close-kindjsx.md`
and the lane dispatch) says: *"read `src/lib/scaffold.ts`; do NOT edit it — `close-ui` owns it"*, and
`close-ui` was **actively writing that file while I measured** (mtime 16:05:41, +5,722 bytes during this
lane's window). Everything else was tried and rejected, with the measurement that rejects it:

| in-scope candidate | verdict |
|---|---|
| reconcile the candidate tree's tsconfig inside `defaultTreeTypecheck` (`codegen.server.ts:6287`) | **rejected — gate-only.** The delivered tree is written by `headless.emitSoftware` → `scaffoldProject` (`headless.ts:2843`), which would still carry the inconsistent tsconfig. Reconciling only the scratch copy makes the pre-seal gate blind to exactly the defect it must refuse (today it refuses it, correctly). |
| pass a `uiGeneration` hook from codegen to suppress the site | **rejected — same gate-only asymmetry**, and it would make the candidate tree differ from the bytes the tree-run later judges. |
| inject a `tsconfig.json` row into `project.generatedTree` so the emitter's tree row wins | **rejected.** `TREE_RESERVED` (`scaffold.ts:386`) does not cover it, so it would "work" — by duplicating the emitter's own root document, putting a scaffold config into the *synthesized tree* record (`.rapidtool/project.json`, the README table, the artifact text), i.e. two writers for one file. |
| widen the verdict's diagnostic tail so the bounded detail keeps `TS2749` | **rejected — loosening.** The tree is genuinely red for 83 reasons; making the assertion read green while the emitted tree stays red is precisely "fix the test, not the product". |
| emit the page set as `.ts` for non-web kinds by suppressing the spec the pages derive from | **rejected — data contortion**, and the site is not the requested kind's surface either way. |

**Therefore: `codegen.server.test.ts`'s `fixes/341-1 pre-seal self-typecheck gate` case is still RED on this
lane's bytes**, and it will stay red until §2.3 lands in `scaffold.ts`. That is one edit by the lane that
already owns the file (`close-ui`) or by the wave parent — the patch is complete and self-contained above.

---

## 6. Commands run and their results

```powershell
npx tsc --noEmit
# TSC_EXIT=0 (the R-8 required pair + the plant are clean; the plant's TS2578 appears only when reverted)

node --experimental-strip-types --test --test-reporter=tap src/lib/compile-check.server.test.ts
# # tests 111 · # pass 110 · # fail 0 · # skipped 1  (the registered deep-verify skip)

node --experimental-strip-types --test --test-reporter=tap src/lib/codegen.server.test.ts
# # tests 325 · # pass 324 · # fail 1
#   not ok 1 - BEFORE (the measured defect): with the gate absent the same type-red tree IS sealed
#   → the §5 blocker (unchanged by this lane; no new red)

node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="a converged tree-run persists" src/lib/headless.test.ts
# ok 1 - W2 · 348: a converged tree-run persists treeRun {ok, verdictHash, verdict} + substance {verdict}
```

## 6a. Re-verification against `close-ui`'s landed bytes

`close-ui` wrote `src/lib/scaffold.ts` at **16:05:41** (and their log at 16:14:32). Every number in §1/§2
was **re-measured against those bytes**: the per-kind declared-deps table reproduces exactly
(app 0 · game 97 · tool/service/library 180 each; no-site baseline 0 · 0 · 1×TS2749 ×3), `tsconfigJson`
(`scaffold.ts:984-1015`) is **byte-unchanged** — still the `webapp`/`game` kind list — and the pin
(`codegen.server.test.ts` "BEFORE (the measured defect)") still fails on the same page rows. So the §2.3
patch applies to the current file, not to a stale revision.

## 7. What I could not determine

1. **Whether the emitted trees pass a *clean* `npm install`** — `emit --verify-kind` is the opt-in and needs
   the network; my declared-deps-only toolchain is a faithful offline stand-in (junctions of exactly the
   emitted `package.json`'s packages), not an install.
2. **The site-firing emission for `kind:"app"` under a below-floor/red-tree policy**, and any interaction
   with `close-ui`'s in-flight merge — their bytes moved under me and their decision may change the emitted
   page set (the tsconfig half is unchanged by it either way).
3. **Whether `scripts/quality-ratchet.mjs`'s census canaries still behave** — that file is `close-taxonomy`'s
   this wave; I did not run the ratchet. The type change is additive for every JS caller (`.mjs` is not
   typed against `TreeSubstance`).

## 8. One-line state

The mismatch is `briefedSiteFiles` (`scaffold.ts:4995`, fired for **any** kind at `:9037`) writing
react-importing JSX `.tsx` modules into trees whose `tsconfigJson` (`scaffold.ts:984-1015`) grants `jsx` only
to webapp/game and whose `package.json` declares react only for webapp — measured at **83 / 97 / 180 errors**
(declared-deps-only: 180) against **0 for the webapp**; direction **(a) + a file-set-derived `jsx`** is
chosen and measured sufficient (§2), the exact patch is §2.3, and it is **not in these bytes** because the
builder lives in `close-ui`'s actively-edited `scaffold.ts` — so the pin stays red until that one edit lands.
R-8's **type-level half is landed** (`compile-check.server.ts`, pair required) with its planted proof
(TS2578 the moment either scope goes optional) and one disclosed fixture repair in `headless.test.ts`.
