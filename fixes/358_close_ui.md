# 358 · lane `close-ui` — the emitted-UI merge (R-UI-1) and the Preview's false banner sentence (R-10)

**Wave:** W358 (closure). **Lane:** `close-ui`. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`
(path contains a space). **Host:** Node v24.15.0, Windows PowerShell 5.1. **Tree:** dirty (no commit
since HEAD `30bce78`), three sibling lanes (`close-taxonomy`, `close-kindjsx`, `cartographer`) editing
other files concurrently — one transient red is attributed in §5.

**Owned files (mine alone):** `src/lib/scaffold.ts` · `src/lib/scaffold.test.ts` ·
`src/components/software-preview.tsx`. **No other file was edited**; in particular
`src/lib/codegen.server.ts`, `src/lib/compile-check.server.ts` and `src/lib/software-export.ts` were
**read only**.

**Decision applied:** **merge, not replace** — no residual was needed (§2). Both pins (`A3-f07 / W-14`
and `A2-F5`) are green on the bytes as they now stand, and **no existing test expectation was changed**
(§4).

---

## 1. The precedence rule I found, and why one site replaced the other

The 351/353 site emission and the ui node's own emitter are the **same node**; the site wins by an
early `continue`:

| where | bytes | effect |
|---|---|---|
| `scaffold.ts:9143` | `const marketingSite = options.uiGeneration === undefined ? webMarketingSiteFiles({…}) : null;` | 351 (web-marketing domain) |
| `scaffold.ts:9168` | `const briefedSite = options.uiGeneration === undefined && marketingSite === null ? briefedSiteFiles({…}) : null;` | 353 (spec/brief-derived page set) — only when 351 did not fire |
| `scaffold.ts:9180` | `const uiSite = marketingSite ?? briefedSite;` | the ONE site this emit chose; comment at `:9179` states the precedence `web-marketing site → briefed site → shell` |
| `scaffold.ts:9414` (tree mode) and `scaffold.ts:9498` (legacy mode) | `if (node.id === "ui" && uiSite !== null) { for (const file of uiSite) push(file.path, file.body); continue; }` | the ui node's file is written by the **site** emitter and `continue` skips `emitUi` entirely |

`emitUi` is the only call point of the A3-f07/W-14 generator (`defaultUiGeneration`, hooked at
`emitUi` → `uiGeneration(uiRequest) ?? defaultUiGeneration(uiRequest)`), so for any input class with a
derived page set the console file became `genericConsoleModule` (`scaffold.ts:5058`, pushed by the 353
branch at `:5133`) — a bare router mount:

```
// src/ui/console.tsx — Console — mounts the site router
import { SiteRouter } from "./router.tsx";
export function Console() { return <SiteRouter />; }
```

Pre-fix probe of the exact A3-f07 fixture (`primed()` + a one-signature `implementationSpec` +
`generatedSource`): 3 derived pages, and `src/ui/console.tsx` carried **no** `name="customerId"`.
That is why `scaffold.test.ts`'s A3-f07 case was the one red (132/133) while A2-F5 was green: the two
capabilities were pinned on **one emission**, and the site path let only one of them exist.

## 2. THE DECISION — merge, applied; **no residual**

The two are **not** mutually exclusive by construction, so the merge was implemented (no named
residual, nothing discarded):

1. **One producer stays the producer of the body.** `uiOperatorFormBody(project, kind)`
   (`scaffold.ts:2515`) returns `defaultUiGeneration`'s body **only when that body is its real bound
   form** (detected on the generator's own `onSubmit={onSubmit}` handler line, `UI_BOUND_FORM_MARKER`,
   `:2505`), and only for `kind === "webapp"` (the only kind whose `emitUi` branch calls that
   generator). A render shell or the honest "nothing to bind" panel returns `null`.
2. **The node keeps both surfaces.** `siteOperatorConsole(…)` (`scaffold.ts:2529`) emits the console as
   the derived router **plus** the operator surface, as two components in one file:
   `Console() → <><SiteRouter /><OperatorConsole /></>`; the operator body is the generator's bytes
   verbatim inside `function OperatorConsole()`.
3. **Both site call sites use it**: 351 `siteConsoleModule` (`:3717`) and 353 `genericConsoleModule`
   (`:5058`). `BriefedSiteCtx`/`briefedSiteFiles` now carry the resolved `kind` (caller at `:9170`)
   so the merge is gated exactly where `emitUi` would have called the generator.

**Evidence (real emissions, `%TEMP%\rt358_ui_probe.mjs` / `rt358_ui_probe2.mjs`):**

- A3-f07 fixture → `src/ui/router.tsx` + 3 `src/ui/pages/*.tsx` **and**
  `src/ui/console.tsx` = `import * as generated from "../jobs/dispatch.ts";` +
  `import { SiteRouter } from "./router.tsx";` + `<SiteRouter />` + `OperatorConsole` with
  `name="customerId"` / `name="priority"` / `onSubmit={onSubmit}` / `generated.createRequest(…)`.
- A2-F5 `proseBakery()` fixture → the derived page set unchanged (router, 4 pages, `site-data.ts`
  reading `generated.getMenuItems()` / `getOpenStatus()`) **and** the console keeps
  `name="productId"` / `name="quantity"` / `generated.addToCart(…)`. The derived Order page binds the
  **same** real mutator (`pageSubmitOrderPage` → `generated.addToCart(…)`), so the field binding is
  applied **to the spec-derived pages** as well, not only kept beside them.
- Any emission where the generator produced a render shell or the honest panel (the measured marketing
  bakery, the 352 parameterised-renderer shape) → `siteOperatorConsole` returns `null` and the site
  console's bytes are **byte-identical to pre-358**. That is the generator's own signed precedence
  (a ≥2-render multi-page shell outranks a bindable form, `scaffold.ts:2389-2413`): the richer source
  still wins per node, so nothing was reduced.

**Nothing was loosened:** the emitted product binds strictly more than before (the same page set plus
the same real-field interaction), no test was deleted, skipped, or weakened, and no emitted field,
call, or page was removed.

## 3. R-10 — the Preview told a below-floor operator a false sentence

**Cause.** `src/components/software-preview.tsx` decided its copy by matching **one branch's** banner
literal (`f.body.includes("RED TREE — surfaced below the build's own completion bar")`). A below-floor
run's README carries the **scaffold's** banner instead, so the predicate was `false` and the alert
rendered *"The archive's README does not carry the caution banner for this withheld reason."* — while
the README **did** lead with `> [!CAUTION]` / `BELOW-FLOOR PLAN`, for exactly the withheld reason the
alert named.

**Fix (at the cause, single-sourced).** The copy now comes from ONE producer in the file that owns both
banners (`scaffold.ts`):

- `CAUTION_ALERT_LEAD = "> [!CAUTION]"` (`:8738`) — the opener every withheld-tree banner leads with;
  `belowFloorBanner` (`:8748`) now builds from that constant, so the two cannot drift.
- `readmeLeadsWithCautionBanner(body)` (`:8777`) — true iff the emitted README **leads** with it.
- `withheldTreeReadmeNote(readmeBody)` (`:8786`) — the sentence, from the bytes.
- `software-preview.tsx:250` computes `const readmeCautionNote = withheldTreeReadmeNote(<README body>)`
  and `:309` renders `{readmeCautionNote}`. The component holds **no** banner literal and **no** sentence
  literal any more (pinned in the test, §4).

**Both branches proved on real emitted bytes** (`%TEMP%\rt358_banner_probe.mjs`):

| branch | README line 1–2 | `readmeLeadsWithCautionBanner` | rendered sentence |
|---|---|---|---|
| **below-floor** (`scaffoldProject(p, {underProduced:"partial"})`, p carrying the recorded `RT_E_PLAN_UNDERPRODUCED` refusal) | `> [!CAUTION]` / `> ## BELOW-FLOOR PLAN — THIS ARTIFACT IS NOT A COMPLETE BUILD (RapidTool A2-F4)` | **true** | **"The archive's README carries the same caution banner."** (was the false sentence before) |
| **red trail** (`emitSoftware(p)` with an uncleared `p6.tree.failure`, `redTree.code = RT_E_TREE_RUN_FAILED`) | `> [!CAUTION]` / `> **RED TREE — surfaced below the build's own completion bar.**` | **true** | **"The archive's README carries the same caution banner."** |
| control: clean emit | `> [!WARNING]` / `> ## DECLARED SCRIPTS NOT RUN …` | **false** | "The archive's README does not carry the caution banner for this withheld reason." |

The control also shows the predicate is not "any alert": a `> [!WARNING]` lead does **not** count.
The alert's title (`Red tree — below the build's completion bar`) and the ZIP behaviour are unchanged —
they were already honest; only that one sentence was false.

## 4. Test expectations — changed: **none**; added: **6**

**No existing expectation was changed, deleted, skipped, or loosened.** The only edit inside an existing
case is a mechanical fixture hoist: the A3-f07 fixture (same `primed()` + `recordedSpec([sig])` +
`generatedSource`) moved into a describe-scope `specBoundProject()` helper so the new merge pin shares
one fixture source; the case's assertions are untouched.

Added to `src/lib/scaffold.test.ts` (133 → 139 tests):

1. `:1814` (A3-f07 describe) — *"358 merge: the spec-derived page set no longer REPLACES the ui node's
   binding"*: the derived router + ≥2 pages **and** the console's real fields / interaction / resolving
   generated import, plus a TSX parse. This is the pin that a later "re-fix" cannot re-replace.
2. `:2820` (A2-F5 describe) — *"358 merge: the derived page set and the ui node's own W-14 binding ride
   the SAME emission"*: router + pages kept, console keeps `productId`/`quantity` + `onSubmit` +
   `generated.addToCart(`, and a derived page submits through the same real mutator.
3. `:3493` (new describe `358 (R-10) …`) — 4 cases:
   - below-floor README (scaffold banner, no `RED TREE` line) ⇒ `readmeLeadsWithCautionBanner` true and
     the rendered sentence is the "carries the same caution banner" one — the branch that was **false**
     before 358;
   - red-trail README (seam banner) ⇒ the same true sentence;
   - clean README (no withheld banner) ⇒ the honest fallback sentence (predicate discriminates);
   - source pin on `src/components/software-preview.tsx`: it imports and renders the one producer and
     contains no `redTreeReadmeBannered`, no `surfaced below the build's own completion bar`, no
     `.body.includes(`/`.body.startsWith(`, and no `The archive's README` sentence literal.

## 5. Verification (all commands from the plan, run on the bytes as they stand)

```
npx tsc --noEmit                                   → TSC_EXIT=0 at 16:0x (see the attributed red below)
node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts
                                                   → # tests 139 · # pass 139 · # fail 0  (was 133/132/1)
node --experimental-strip-types --test --test-reporter=tap src/lib/software-export.test.ts
                                                   → # tests 13 · # pass 13 · # fail 0
node --experimental-strip-types --test --test-reporter=tap src/lib/product-quality.test.ts
                                                   → # tests 34 · # pass 34 · # fail 0
```

**Transient red — attributed by file, NOT mine.** A re-run of `npx tsc --noEmit` at 16:13 read
`TSC_EXIT=2` with **29 errors, all of them `TS18048 's.jobScoped' / 'census.jobScoped' is possibly
'undefined'` in exactly one file: `src/lib/compile-check.server.test.ts`** (mtime **16:11:04**, landing
while I measured; `src/lib/compile-check.server.ts` **16:12:35**). That file belongs to the sibling lane
`close-kindjsx`, which is mid-edit. **Zero errors mention `scaffold.ts`, `scaffold.test.ts` or
`software-preview.tsx`** — my earlier same-command reading (16:0x, before that lane's land) was
`TSC_EXIT=0`. I did not touch, judge, or "fix" that file.

Extra legs run because `scaffoldProject`'s emitted console changed shape for site emissions — each
file green, run one file per process so the exit code is the suite's own:

`preview-render.test.ts` 4/4 · `emitted-honesty.test.ts` 5/5 · `ui-surface-guards.test.ts` 7/7 ·
`ui-shell-guards.test.ts` 7/7 · `dod.test.ts` 65/65 · `components/console.guards.test.ts` 7/7 ·
`sweep73-fuzz.test.ts` 52/52 · `packet.test.ts` 94/94 · `acceptance.test.ts` 44/44 ·
`entry-oracle.test.ts` 18/18 · `honesty-guards.test.ts` 13/13 ·
`npx eslint src/lib/scaffold.ts src/lib/scaffold.test.ts src/components/software-preview.tsx` →
`LINT_EXIT=0` (0 problems).

**Transient reds attributed by file:** one — the whole-project `tsc` red in
`src/lib/compile-check.server.test.ts` (sibling lane `close-kindjsx`, mtime inside my window; attributed
above). Every other red I saw was inside a file I own and was mine (one R-10 source pin that matched my
own comment's prose — fixed by narrowing the assertion to the banner's distinctive line, not by
weakening it). No sibling-lane file was touched or judged.

## 6. What I did NOT verify (stated plainly)

1. **The JSX is not executed.** This repo has no React render harness; every component test
   (`console.guards.test.ts`, `ui-surface-guards.test.ts`, `ui-shell-guards.test.ts`) is a source pin
   that reads the file as text. So "both branches' rendered text" is proved as: **real emitted README
   bytes → the ONE producer's return value**, asserted for both branches plus a negative control, **plus
   a source pin that the component renders exactly that value** (it contains no sentence and no banner
   literal of its own). The final string→DOM step is a single `{readmeCautionNote}` expression; I read
   it, I did not execute it.
2. **The emitted product's own `tsc` was not run over the merged console.** No fixture tree carries
   `node_modules` (the emitted `typecheck` script is the `emit --verify-kind` opt-in, out of my scope),
   and the pre-seal self-typecheck seam belongs to `codegen.server.ts`/`compile-check.server.ts` —
   another lane's files. Syntax-level proof only: `ts.transpileModule(…, { jsx: ReactJSX })` with zero
   diagnostics in both new merge pins. The operator body wrapped is byte-for-byte the body the
   single-file shell already emits and pins.
3. **The full gate, `npm test`, `npm run build`, any keyed call, any git write — not run** (instruction).
   No whole-leg verdict is claimed; the boundary run is the first frozen measurement.
4. **A scoped, disclosed limitation (not a residual I chose):** where the generator's own precedence
   returns a render shell (≥2 render exports; the measured marketing/renderer shapes), the site console
   mounts the router and no operator form — the pre-358 bytes. That is the generator's signed decision
   (`scaffold.ts:2389-2413`: the multi-page shell outranks the bindable form) applied unchanged, not a
   capability the merge dropped.
