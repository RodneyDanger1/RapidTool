# W355 · lane `reviewer-surfaces` — review 3 of 3: the two thin surfaces

**Wave:** W355 (audit/freeze). **Kind:** read-only code review. **Lane:** `reviewer-surfaces`.
**Subject:** the browser console (TanStack Start + React 19) and the headless CLI
(`scripts/rapidtool-cli.mjs`, 39 verbs), plus preview/export and the contracts binding them.
**HEAD:** `30bce78` on `main` + **98 modified / 32 untracked** uncommitted files (the un-boundary-verified
"354 wave"). Tree is RED: `npx tsc --noEmit` exits 2 (5 errors); `npm test` exits 1 (scripts leg
622/607/15, src leg never ran) — both given as baseline, not re-litigated.
**Where a doc and the bytes disagree, the bytes win.** Every finding below carries `file:line` **and**
the command/read that produced it.

---

## 1. Method

**Reads (whole-file or ranged `read_file`):** `wave_plans/W355/reviewer-surfaces.md`, `AGENTS.md`,
`START-HERE.md`, `RUNBOOK.md`, `docs-FOLDER-MAP.md`, `package.json`, `.grok/app-env.json`,
`src/components/console.tsx` (ranged: 150–279, 985–1114, 1800–1939, 2386–2482, 3028–3097, 3775–4160,
5350–5409, 5954–6013, 6261–6315, 6753–6832, 7855–7914), `src/components/software-preview.tsx`,
`src/components/preview-sandbox.worker.ts`, `src/components/preview-host-bridge.tsx`,
`src/components/console.guards.test.ts`, `src/lib/software-export.ts` + its test,
`src/lib/{zip,preview-compile,preview-compile.server,preview-render,preview-host-bridge,wild-review,
wild-bridge,wild-bridge.server,error-component}.ts(x)`, `src/lib/auth/{account,account-default.test,
account.test,middleware,gates,client}.ts(x)`, `src/lib/{store,headless,scaffold,packet,repo-map}.ts`
(ranged), `src/routes/{__root,index,run.$id,login}.tsx`, `src/router.tsx`, `src/routeTree.gen.ts`,
`scripts/README-cli.md` (ranged 477–690, 1309–1450), `scripts/README-cli.test.mjs`,
`scripts/check-auth-invariant.mjs`, `scripts/{launch-rapidtool,browser-smoke,run-shot,preview-thumbnail,
browser-guard}.mjs` (heads).

**Commands (all read-only w.r.t. the repo; the two spawns that mutate wrote only under `%TEMP%`):**

```powershell
Set-Location "C:\Users\mnril\Desktop\RapidTool Main"
git log -1 --format="%H %s"; git status --porcelain          # HEAD + 98/32 dirty
(Select-String -Path scripts\rapidtool-cli.mjs -Pattern '^\s*case "').Count          # 39
Select-String -Path scripts\rapidtool-cli.mjs -Pattern '^\s*case "' | % { $_.LineNumber }
Select-String -Path src\components\console.tsx -Pattern 'RUN_TABS|Tabs\.Content|PaneBoundary'   # tab + boundary map
Select-String -Path src\components\console.tsx -Pattern 'Tabs\.Content|<Tabs\.|Tabs\.Root'      # 12 content blocks
Select-String -Path src\lib\scaffold.ts -Pattern 'allowUnderProduced|underProduced|BELOW-FLOOR'
Select-String -Path src\lib\headless.ts -Pattern 'underProducedPolicy|underProduced'
Select-String -Path src\lib\headless.ts -Pattern 'createNodeWildReviewer|reviewer'
Select-String -Path src\**\*.ts, src\**\*.tsx, scripts\*.mjs -Pattern 'createHostWildReviewer|createNodeWildReviewer|wildEdgeBridge'
git diff -- src/lib/scaffold.ts | Select-String -Pattern 'underProduced|assert\.fail|orc-phase'
git show HEAD:src/lib/scaffold.ts | Select-String -Pattern 'orc-phase'      # 0 hits -> the assert.fail is NEW
git diff -- package.json                                     # src/components/**/*.test.ts added to `npm test`
node --test --test-reporter=tap scripts/README-cli.test.mjs                    # 12 pass / 0 fail
node --experimental-strip-types --test --test-reporter=tap src/components/console.guards.test.ts src/components/preview-sandbox.test.ts   # 10 pass / 0 fail
node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs             # 62 tests, 57 pass, 5 FAIL
node --test --test-reporter=tap --test-name-pattern='withholds a commit on a RED run verdict' scripts/cli-exit-taxonomy.test.mjs   # fail at :3352
node --test --test-reporter=tap --test-name-pattern='a SINGLE keyless' scripts/cli-exit-taxonomy.test.mjs                          # fail at :3050
```

Two **targeted CLI spawns** in `%TEMP%` (never in the repo; `--out` under `%TEMP%`; the CLI's NDJSON
telemetry landed in the temp cwd). Both are the repo's own test idiom (`mkdtempSync` + `spawnSync`):

```powershell
# (A) fresh keyless project -> emit --run     (the "green path")
$tmp = "$env:TEMP\rt355-green"; ... cd $tmp
node --experimental-strip-types "<repo>\scripts\rapidtool-cli.mjs" create --brief "…tiny keyless project…" --name "L1 Green Pin" --out "$tmp\green.json"
node --experimental-strip-types "<repo>\scripts\rapidtool-cli.mjs" emit --project "$tmp\green.json" --out "$tmp\out" --run
# -> EXIT=1, ok:false, code RT_E_TREE_RUN_FAILED, treeRun.ok=false, "the emitted project's own `npm run test` fail"
#    failing spec: tests/oracle.spec.ts:92  assert.fail("orc-phase is NOT IMPLEMENTED …")

# (B) below-floor project (copied from the tracked testruns fixture, all p6.tree.failure rows removed)
node --experimental-strip-types "<repo>\scripts\rapidtool-cli.mjs" emit --project "$tmp\build.json" --out "$tmp\out"
# -> EXIT=1, ok:false, code RT_E_PLAN_UNDERPRODUCED — and 20 files WERE written; README leads with "> [!CAUTION]"
```

**Not run (out of lane):** `npm test`, `npm run build`, `bash scripts/gate.sh`, any dev server, any
browser, Playwright. Live browser claims are Wave 1 `aperture-ui`'s.

---

## 2. Surface inventory

### 2.1 Run-console tabs — **re-derived count = 12** (docs' latest correction is correct)

Source: `src/components/console.tsx:196-211` (`RUN_TABS`); type union `src/components/console.tsx:176`.
Tier split re-derived from the same array: **4 primary + 8 advanced** (`advancedTabCount`,
`console.tsx:2178`), *not* the 3/7 written in the in-file comment at `:3777-3778` (F-08).

| # | id | label | tier | renders for a real P6-parked / below-floor project | state class |
|---|---|---|---|---|---|
| 1 | `artifacts` | Artifacts | primary | `project.artifacts` (real, filtered by phase/query); honest first-run empty + Run CTA (`:3885-3903`) | **real** |
| 2 | `preview` | Preview | primary | the emitted tree from the pure scaffold — see §2.3; never dead-ends | **real (static)** |
| 3 | `packet` | Agent packet | primary | `project.packet` + the ranked repo map; "Execute a phase to compile the packet." (`:4000-4002`) before P3 | **real** |
| 4 | `chat` | Chat | primary | grounded chat; keyless = read-only with an explicit reason (`:6960-6966`) | **real (keyless read-only)** |
| 5 | `spec` | Spec graph | advanced | `project.specGraph.order/nodes`; empty → "Lattice empty — open a brief first." (`:4022-4024`) | **real** |
| 6 | `crew` | Crew | advanced | `project.crew`; empty → honest empty state (`:4036-4041`) | **real** |
| 7 | `oracle` | Oracle | advanced | `project.oracle` prose + `OracleVerifyBlock`; empty → honest (`:4072-4076`) | **real** |
| 8 | `vault` | Vault | advanced | `buildVaultNotes(project)` client-side index (`:5351`) | **real** |
| 9 | `design` | Design | advanced | `loadDesignView(project)`; empty palette → honest (`:6068-6071`) | **real** |
| 10 | `diagram` | Diagram | advanced | `buildDiagram(project, kind)`, throws are caught → pane stays alive (`:6268-6274`) | **real** |
| 11 | `runtime` | Runtime log | advanced | runtime ring + timeline (`:4119-4128`) | **real** |
| 12 | `fixtures` | Eval fixtures | advanced | corpus-wide server fn `fixturesReview()`; read-only, "no approve/reject control is wired yet" (`:535-539`) | **real but human-dead-ended** |

Dead-end walk (Q2), for the state a real project is actually in (parked at P6 / below-floor):
**no tab renders nothing at all.** Mount gating (`paneMounted`, `console.tsx:2171`) only skips *unvisited*
panes, which are hidden by their own `Tabs.Content`. The surfaces that show a **coded refusal / disabled
control with no in-console way forward** are exactly three, and all three say so in words:
`fixtures` (decisions are CLI-only, `:535-539`), `chat` (keyless composer disabled, `:6960-6966`), and
`preview` for a non-webapp kind ("This CLI tool has no HTML entry document — the emitted file tree is
shown instead.", `software-preview.tsx:345-350`). None of them is a silent dead end.

### 2.2 CLI verbs — **re-derived count = 39** (matches `AGENTS.md:52` and the README headline)

`(Select-String -Path scripts\rapidtool-cli.mjs -Pattern '^\s*case "').Count` → **39**; the README's own
list is machine-bound both ways by `scripts/README-cli.test.mjs` (12 pass / 0 fail, run above), and the
`USAGE.commands` table has one key per arm (`README-cli.test.mjs:260-276`).

All 39 dispatch to **live seams** — none is a stub: no `RT_E_NOT_IMPLEMENTED` literal exists anywhere in
the CLI (`Select-String -Path scripts\rapidtool-cli.mjs -Pattern 'RT_E_NOT_IMPLEMENTED|NOT_IMPLEMENTED'`
→ 0 hits), every arm calls a `src/lib/headless.ts`/`vault.ts`/… export, and the smallest arms
(`summary:4058`, `artifacts:4406`, `export:2559`, `bench:4508`, `swarm:4450`) are 4–20-line delegations.
Exit codes: `run`/`gate`/`resume`/`unattended` route through the one `respondDriveOutcome`
(`rapidtool-cli.mjs:1127-1250`) → 2 = park, 1 = red seal / hard-DoD, 4 = internal; `crew`/`prompt`/
`verify` map not-configured → 3 (`:4160`, `:4210-4218`); `emit`/`tree-run` carry the opt-in 5
(`:6140`); `scan`/`check` → 1 + `RT_E_CHECK_FAILED` on findings (`:4240-4272`, `:4285+`). The
machine-checked table (`cli-exit-taxonomy.test.mjs:263` "EXIT_BY_CODE is exactly the README error table
(both directions)") **passes**. The 5 verb-level failures at this HEAD are F-01's blast radius, not an
exit-taxonomy drift.

### 2.3 Preview / export branches (Q3) — the documented behavior, per branch

`emitSoftware` (`src/lib/software-export.ts:92-146`) returns `ok:true` in every branch I could reach, and
sets `redTree` from the run's own trail. `scaffoldProject` **now defaults to `underProduced:"partial"`**
(`src/lib/scaffold.ts:8535-8536`, uncommitted 354 change), so a below-floor project lands a bannered tree.

| branch | `emitSoftware` | Preview tab | ZIP |
|---|---|---|---|
| below-floor (`RT_E_PLAN_UNDERPRODUCED`) | `ok:true`, `redTree:{code,detail}`, README already bannered by the scaffold | warn alert + file tree / snapshot; **download works** | **produced** (verified: repro B wrote 20 files and a bannered README) |
| red tree trail (`p6.tree.failure`, no green since) | `ok:true`, `redTree:{RT_E_TREE_RUN_FAILED,…}`, `redTreeBannerText` prepended (`software-export.ts:127-132`) | warn alert; download works | produced |
| partial synthesis refusal with real substance | `ok:true`, `redTree:{last refused code}` | warn alert; download works | produced |
| scaffold refusal (`validProject` failure / explicit `underProduced:"refuse"`) | `ok:false` | the coded refusal card, `software-preview.tsx:222-241` ("No archive is produced for a refused emission") | none — correct |

So **README-cli/RUNBOOK §6a's "the Preview tab and the ZIP work for a below-floor run" is CONFIRMED** —
with two corrections. (i) `RUNBOOK.md:172` says `emitSoftware` "re-runs `scaffoldProject` with
`allowUnderProduced: true`": it passes **no options at all** (`software-export.ts:95`); the behavior comes
from the flipped default (F-03). (ii) The `RUNBOOK.md:325-332` phrase "no longer inert" means *not a
dead end*, not *runs the product*.

**The iframe is inert as an application.** `software-preview.tsx:365-367` mounts
`<iframe sandbox="" srcDoc={previewDoc} />`; `sandbox=""` grants no `allow-scripts`, so **no emitted
JavaScript can execute in the frame**, by construction. What is shown is a *pre-rendered static snapshot*:
the emitted TSX is transpiled server-side (`preview-compile.server.ts:32-62`), evaluated with
`new Function` inside a DedicatedWorker (`preview-sandbox.worker.ts:41-55` hard-stubs
`fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource`/`importScripts`), rendered with the app's own
`react-dom/server` (`preview-render.ts:60-115`), and `previewDocumentFor` strips the emitted
`<script type="module">` tags and inlines the CSS (`software-export.ts:189-206`). Consequences by kind:
a webapp/game with an HTML entry → real (non-interactive) markup in the frame; a webapp whose UI module
exports no React component → honest `renderNote` + the raw entry document
(`software-preview.tsx:139-161`); cli-tool/library/service → the file list, never the frame
(`software-preview.tsx:345-350`); a game → explicitly "this static view is empty" (`:371-376`).

### 2.4 Routes / surfaces

`src/routeTree.gen.ts:13,21-23,50-53` registers exactly `'/'`, `'/login'`, `'/run/$id'`.
`/` → `HomeScreen` (`src/routes/index.tsx`); `/run/$id` → `RunScreen key={id}` (`src/routes/run.$id.tsx`);
`/login` → the real sign-in card (`src/routes/login.tsx:20-40`). Router-level error/404 backstops:
`src/router.tsx:16-18` (`defaultErrorComponent`/`defaultNotFoundComponent`).

---

## 3. Findings

`id | severity | title | file:line | evidence | why it matters`

---

**F-01 · P0 · The emitted oracle's new `assert.fail` rows make every emitted tree RED by construction, so
the whole delivery path (`emit --run`, `emit --git`, `factory-watch`, `unattended` clean seal) is dead.**
`src/lib/scaffold.ts` (uncommitted 354 diff; emitted row text at the working-tree line cited by the
generated spec), `scripts/cli-exit-taxonomy.test.mjs:3261-3366`.

Evidence — the uncommitted wave added deliberate failing assertions to *emitted* test files:

```text
git diff -- src/lib/scaffold.ts | Select-String 'orc-phase|assert\.fail|A2-F2'
+ // fixes/216b (106 T-08 / F-05) + fixes/354 A2-F2 (D4): no emitted assertion may …
+ /** ids emitted as REAL failing tests (`<id>` with `assert.fail`) — fixes/354 …
+ "// fixes/354 A2-F2 (D4): this oracle has NOT IMPLEMENTED row(s), so each is",
+ `  // fixes/354 A2-F2: the row is a REAL failing test — never a skip.`,
git show HEAD:src/lib/scaffold.ts | Select-String 'orc-phase'      # 0 hits at HEAD
```

The emitted bytes (`%TEMP%\rt355-green\out\tests\oracle.spec.ts:84-92`, produced by repro A):

```ts
test("orc-phase", () => {
  // fixes/354 A2-F2: the row is a REAL failing test — never a skip.
  assert.fail("orc-phase is NOT IMPLEMENTED — replace this failing row with the row's real acceptance assertion");
});
```

Consequences I reproduced or observed:

- **`emit --run` on a fresh keyless project exits 1** (`ok:false`, `RT_E_TREE_RUN_FAILED`,
  `treeRun.ok=false`, `declaredScriptsVerified=false`), because "the emitted project's own `npm run test`
  fail … spec tests/oracle.spec.ts: fail — test `orc-phase` failed" (repro A, full envelope in §1).
- **`unattended` no longer seals clean keyless:** `ok 44` → `not ok`, `expected 'complete'`,
  `actual 'complete_with_failures'` (`cli-exit-taxonomy.test.mjs:3027`, failing at `:3050`).
- **5 of the CLI's own 62 contract tests fail** (`node --test scripts/cli-exit-taxonomy.test.mjs` →
  `# pass 57 / # fail 5`): `ok 40` (fresh tree verified), `ok 44`, `ok 52`/`53`/`54`
  (`emit --run|--check|--substance --git` withholding) — `ok 52` fails at `:3352` on the **green**
  fixture's `--run` leg, i.e. the test's own "GREEN + `--run --git` must still commit" pin.
- Blast radius outside the tests: `factory-watch.mjs` requires `treeRun.ok === true` before
  `emit --git` (`AGENTS.md:211-215`), and `emit --git` re-verifies before landing
  (`scripts/README-cli.md:583-588`), so **no keyless delivery can be committed at all**.

Why it matters: the wave changed the *product's own green path* to be unreachable on the keyless floor
(and on any run with an unwired oracle row), and five contract tests that exist to protect exactly that
path are red. This is the binding blocker for the 354 wave and for the W352-era "delivery truth"
guarantees; the intent (an unwired row should not be a vacuous pass) is legitimate, but the mechanism
(assert inside the emitted tree that the tree must run green) breaks the contract it protects.

---

**F-02 · P1 · The CLI contract docs still promise a green keyless `emit --run` / `--git`, and a
"fresh tree is verified" claim, that F-01 refutes.**
`scripts/README-cli.md:490-503`, `scripts/README-cli.md:583-588`, `START-HERE.md:89-90`,
`RUNBOOK.md:187-198`, `scripts/rapidtool-cli.mjs:6140` (USAGE `emit`).

Evidence: `README-cli.md:502-503` — "All files parse → exit 0 with `{ "ok": true, "dir": … }`";
`RUNBOOK.md:190-191` — "`emit … --run` … exit 1 on red" (true, but the *only* reachable verdict is now
red); `START-HERE.md:89-90` — "oracle rows + `tree-run` (the emitted product must pass its OWN `npm run
typecheck`+`npm test`; a red tree can never be `ok:true`)". Repro A shows `ok:false`/exit 1 on a tree
that is a correct deterministic-floor emission.

Why it matters: an agent driver told to branch on this contract will read a **correct** keyless
delivery as a failure and loop on it; and `--require-verified`'s exit-5 semantics
(`README-cli.md:1336-1350`) are now unreachable, since 5 requires a *green* tree.

---

**F-03 · P2 · The below-floor default emit no longer refuses pre-write; it materializes the partial and
seals post-write — the README and the CLI's own comment say the opposite.**
`src/lib/scaffold.ts:8535-8536`, `src/lib/headless.ts:2832-2839`, `src/lib/headless.ts:2803-2808`,
`scripts/rapidtool-cli.mjs:2657-2662`, `scripts/rapidtool-cli.mjs:2931-2947`,
`scripts/README-cli.md:509-517` and `:572-576`.

Evidence (repro B, below-floor fixture with every `p6.tree.failure` row removed so the red-trail path
cannot mask it):

```text
EXIT=1  ok=False  code=RT_E_PLAN_UNDERPRODUCED
error="emit refused at delivery: … the emitted tree is kept on disk — synthesize the missing module(s)…"
files written: 20        README head: "> [!CAUTION]" / "> ## BELOW-FLOOR PLAN — THIS ARTIFACT IS NOT A COMPLETE BUILD (RapidTool A2-F4)"
```

The reads that explain it: `scaffold.ts:8535-8536` — `underProducedPolicy = options.underProduced === "refuse"
|| options.allowUnderProduced === false ? "refuse" : "partial"`, so **`undefined` now means `partial`**
(the diff shows the old code was `if (options.allowUnderProduced !== true) { …refuse… }`);
`headless.ts:2836-2839` passes `{ allowUnderProduced: true }` only for the `banner` policy and
`undefined` otherwise — i.e. it relies on the default that just flipped. `headless.ts:2803-2808`'s
comment ("a refused emit cannot leave a partial tree") and `rapidtool-cli.mjs:2933-2944`'s ("the scaffold
already refuses it pre-write regardless of any flag (R2-01)") are therefore **false at this HEAD**, as are
`README-cli.md:511-513` ("before anything is written … no partial tree, not even an empty emit dir") and
`:572-576` ("with no partial materialized at all").

Why it matters: the *behavior* is still honest (bannered partial + `ok:false` + exit 1 + the CLI's
post-write floor seal `rapidtool-cli.mjs:2945-2964` catches it), but the docs and two code comments now
describe a pre-write guard that no longer runs — and any caller of `scaffoldProject`/`headless.emitProject`
that reads only `ok` sees a below-floor tree as a **success** (`software-export.emitSoftware` is exactly
such a caller, by design; a future third caller would be wrong by accident).

---

**F-04 · P2 · The Preview tab tells the user the archive's README does *not* carry the caution banner for
the below-floor branch, while it does.**
`src/components/software-preview.tsx:246-251` + `:305-311` vs `src/lib/software-export.ts:67-75` + `:127-132`.

Evidence: the component decides with the *red-tree* banner literal only —

```ts
const redTreeReadmeBannered =
  emitted.redTree !== undefined &&
  emitted.files.some((f) => f.path === "README.md" &&
    f.body.includes("RED TREE — surfaced below the build's own completion bar"));
```

but `software-export.ts:127-132` prepends that text **only when `result.underProduced === undefined`**, and
the below-floor branch's README carries the *scaffold's* banner instead (`scaffold.ts:9361-9375`,
`belowFloorBanner` → `> [!CAUTION]` / `## BELOW-FLOOR PLAN`). Repro B's README head confirms which banner
is actually present. So for the exact branch the RUNBOOK advertises, the UI renders the false sentence
"The archive's README does not carry the caution banner for this withheld reason." The sibling test pins
the truth the component misses: `src/lib/software-export.test.ts:93-96` ("the caution banner leads the
README" / `/BELOW-FLOOR PLAN/`).

Why it matters: it is a face-value falsehood about the artifact's own safety labelling on the surface a
downloading user reads, in the one branch this wave touched hardest — declare-or-strike on the copy, and
the cheapest possible fix (match the scaffold's banner string, or read `redTree.code`).

---

**F-05 · P2 · R6-f12's pane boundary is *landed and complete over the panes*, but the RunScreen body and
every non-render throw are still unbounded — and nothing pins any of it.**
`src/components/console.tsx:1821-1875` (class + `ui.pane_crash`), `:3028-4302` (boundary map),
`:2388-2421` (derivations outside every boundary), `src/router.tsx:16`.

Evidence: `Select-String -Path src\components\console.tsx -Pattern 'PaneBoundary'` → the 12 run tabs are
each wrapped (`:3846, :3916, :3922, :4008, :4031, :4060, :4106, :4112, :4118, :4134, :4140, :4146`) plus
`Home header :1915`, `Home screen :1943`, `Run header :3041`, `Phase rail :3225`, `Run screen :3235`,
`Run sidebar :4173`, `Dialogs and command palette :4285`. **So there is no unwrapped run pane.** What is
*not* covered: (a) `RunScreen`'s own render body before the JSX — the hooks and derivations at
`:2388-2421` (`artifacts`, `visibleArtifacts`, `activeArt`, `phaseCounts`, `tokenEst`,
`repoMapForProject(project, {budget:6000})`) execute *above* the first boundary, so a throw there still
routes to `AppErrorComponent` (`router.tsx:16`; user sees the full-screen "Something went wrong" card
with Reload / Back to home, `error-component.tsx:50-104`) — the whole console, rail, sidebar and tabs
gone; (b) React error boundaries do not catch event-handler or async-callback throws (e.g. the
`window.setInterval` polling inside `WildConsole`, `console.tsx:1108+`).
I could not produce a live throw from the current bytes: the guard test's whole regression class
(`console.guards.test.ts:118-144`, a foreign/partial `gate` record) is guarded, and
`repo-map.ts:560-580` is explicitly defensive ("Never throws on junk"). The record is also stale in both
directions: `START-HERE.md:106` still lists "pane error boundary (R6-f12, partial)" as a residual, and
`research/multiagent/thoroughanalysis.md:1382` / `:1406` still assert *no* boundary exists and
`ui.pane_crash` has "no emitter" — the bytes show `console.tsx:1839-1850` emitting it, deduped by
`markBoundaryError`.

Why it matters: the honest residual is now "the boundary does not cover `RunScreen`'s own body or
non-render throws", not "there is no boundary" — and the register/START-HERE text must be corrected so a
later lane does not re-implement what landed or under-estimate what remains.

---

**F-06 · P2 · No test pins the console/preview surface contracts a later wave could silently break.**
`Select-String -Path src\**\*.test.ts, src\components\*.test.ts, scripts\*.test.mjs -Pattern 'sandbox=""|RUN_TABS|PaneBoundary|ui\.pane_crash'`
→ only `rt-client.test.ts:613` / `rt-events.test.ts:93,192` (the *event name* is registered) and a comment
in `console.guards.test.ts:122`. Specifically unpinned:

- the **12-tab inventory and its 4/8 tier split** (`console.tsx:196-211`) — a dropped tab or a tier
  re-shuffle changes both aria-labels (`:215-221`) and the "More panels (N)" count (`:2178`) silently;
- the **`PaneBoundary` wraps** (F-05) — a new `Tabs.Content` added without a boundary, or a boundary
  deleted, is invisible to CI;
- the **`sandbox=""` attribute** and the worker-realm denials (`software-preview.tsx:365-367`,
  `preview-sandbox.worker.ts:41-49`) — the only in-repo test (`preview-sandbox.test.ts`, 10/10 standalone)
  exercises `renderEmittedComponent` in a `node:worker_threads` realm, **not** the iframe attribute;
- the **Preview's banner honesty** (F-04) — the lib test pins the README, the component's own predicate is
  untested;
- the **below-floor CLI default** (F-03) — both `cli-exit-taxonomy` below-floor tests use fixtures that
  *also* carry a red trail, so they pass by the pre-write trail refusal and cannot see the flipped
  scaffold default (`cli-exit-taxonomy.test.mjs:3815-3924`, tests 59/60 pass).

---

**F-07 · P3 · `AGENTS.md`'s 354 correction claims the in-file console comments were fixed to "twelve";
`:3774`-style comments still say three primary / seven advanced.**
`AGENTS.md:491` ("the in-file comments at `:183/:187/:3774` are corrected in the same 354-wave edit") vs
`src/components/console.tsx:3777-3778` ("three primary panels on the strip, the remaining seven behind
`More panels`"). The bytes say 4 + 8 (`RUN_TABS`, `:196-211`; `advancedTabCount`, `:2178`). `:187` was
indeed corrected ("twelve peer tabs").

**F-08 · P3 · `console.guards.test.ts`'s header comment about the test glob is stale.**
`src/components/console.guards.test.ts:5-7` — "The repo test glob only discovers `src/lib/**/*.test.ts`,
so this file runs with …" — while the uncommitted `package.json:25` adds `"src/components/**/*.test.ts"`
to the src leg (`git diff -- package.json`). Both component suites pass standalone (10/10), so the
assertion is only about discoverability; it is nevertheless the kind of comment that lets a suite be
"kept green" by never running.

**F-09 · P3 · RUNBOOK §4's line-number citations have drifted.**
`RUNBOOK.md:77` cites `console.tsx:191-207` for the tabbed workspace (now `:196-211`), `RUNBOOK.md:107`
cites `WildToggle, console.tsx:987` (now `:992`), and the keyboard block is cited at `:89`
(`console.tsx:1641-1656`) while the live run-screen handler is at `console.tsx:2259-2375`. Byte-verified
by `Select-String`. Same class as F-07: line-number citations in docs rot silently.

---

### Findings count

| severity | count | ids |
|---|---|---|
| P0 | 1 | F-01 |
| P1 | 1 | F-02 |
| P2 | 4 | F-03, F-04, F-05, F-06 |
| P3 | 3 | F-07, F-08, F-09 |

---

## 4. What is genuinely sound (required)

1. **The tab inventory is exactly 12, from one source, with derived aria-labels.** `RUN_TABS`
   (`console.tsx:196-211`) is the only list; both `Tabs.List`s (`:3784`, `:3818`) and both labels
   (`tabListLabel`, `:215-221`) are `filter`ed from it, so announced order cannot diverge from DOM order;
   `RunTabTrigger` (`:254-262`) renders label + purpose from the same row. The 354 correction's "TWELVE,
   not eleven" is **confirmed** — `AGENTS.md:490-491`'s verbatim list matches the array exactly.
2. **Every one of the 39 CLI verbs is real, and the doc↔dispatcher binding is machine-enforced.**
   `README-cli.test.mjs` (12/12 pass standalone) binds the headline count, the README verb list both
   directions, the "one arm per line" invariant that makes `grep -c 'case "'` truthful, the
   `USAGE.commands` parity, and the `emit --red-tree` flags; `cli-exit-taxonomy.test.mjs:263`
   bidirectional-binds `EXIT_BY_CODE` to the README error table. No stub verb exists (0
   `NOT_IMPLEMENTED` hits).
3. **The pane error boundary landed and reports honestly.** `PaneBoundary` (`console.tsx:1821-1875`)
   wraps all 12 panes plus header/rail/sidebar/dialogs, emits exactly one `ui.pane_crash` row via
   `reportRt` with a dev re-bubble dedupe (`:1832-1850`), never throws into the observed code
   (`AGENTS.md` §7), and renders a labelled fallback with a "Try again" reset (`:1856-1871`).
4. **The emitted code never runs in the host page realm.** The Preview evaluates untrusted emitted TSX in
   a DedicatedWorker with no `window`/`document`/storage and hard-stubbed network globals
   (`preview-sandbox.worker.ts:1-55`), and the frame that displays the result is `sandbox=""`
   (`software-preview.tsx:365-367`). `preview-sandbox.test.ts` proves the realm boundary in-process
   (10 pass / 0 fail, run above).
5. **The Preview/ZIP path is non-inert for a below-floor run, exactly as RUNBOOK §6a says.** Repro B
   produced a real 20-file archive-able tree with a `> [!CAUTION]` / `## BELOW-FLOOR PLAN` README, the
   envelope refuses (`ok:false`, `RT_E_PLAN_UNDERPRODUCED`, exit 1), and `buildSoftwareArchive` returns a
   real ZIP (`software-export.ts:166-187`; ZIP header walker pinned by
   `software-export.test.ts:114-135`).
6. **Wild Mode's classifier bridge is real on both hosts, and the honest keyless park is intact.**
   Bare Node: `headless.ts:6741` / `:6970` resolve `createNodeWildReviewer()`; the CLI installs the
   resolved `.env` key into `process.env` (`rapidtool-cli.mjs:887`), so `isDeepSeekConfigured()` sees it
   and the classifier can verdict. Browser: `store.startWildRun` resolves `createHostWildReviewer()`
   (`store.ts:1848`), probes the SERVER's key (`:1853-1857`), injects the server-side P6/P7/every-phase
   execution edges (`:1865-1872`, `wild-bridge.ts:89-119`), attaches a real planner plan
   (`wild-bridge.ts:30-45` → `headless.generateWildPlan`), and stages the review under the console
   consent (`:1917`, `stageWildPlan(cur, reviewer, { agentSeal: true })`). **Hosts that can drive a
   zero-human run:** the CLI on a host whose key resolves (`wild --start --agent-seal`, the only door
   that accepts the seal, `rapidtool-cli.mjs:5426-5447`) and the console against a server-configured key.
   **Hosts that cannot:** any keyless host — the reviewer is `null`, and the engine keeps the honest
   `not-configured` park (RUNBOOK §5c/§9.8). No host drives zero-human through a browser without a
   server key.
7. **Auth's shipped default does not demand a login, and the enabled path is real.**
   `.grok/app-env.json` ships `VITE_AUTH_ENABLED: "false"`; `authEnabled = … !== "false"`
   (`src/lib/auth/client.ts:44`); `routes/__root.tsx:126-131` renders the bare `<Outlet />` when disabled
   and mounts `AuthGate`/`SignInGate`/`RedirectToSignIn` only when enabled (`:36-53`); `/login` is a real
   registered route (`routeTree.gen.ts:13,21-23,50-53`, `gates.tsx:22`). The enabled path is a real
   server function through a real guard (`account.ts:27-32` → `middleware.ts:31-52` →
   `requireUserId`), and both states are pinned (`account.test.ts:22-31` = 401 reject;
   `account-default.test.ts:16-21` = shared `dev-user`, no login). I could not byte-compare the two
   renders without a browser (§5).
8. **Honest empty/refusal states everywhere I could reach.** Artifacts (`:3885-3903`), Crew
   (`:4036-4041`), Oracle (`:4072-4076`), Spec (`:4022-4024`), Design (`:6068-6071`), Packet
   (`:4000-4002`), Fixtures (four distinct states incl. a transport-failure vs unreadable-corpus
   distinction, `:554-569`), Chat keyless (`:6960-6966`). I found no pane that renders nothing at all.

---

## 5. What I could not verify

1. **Anything that needs a running browser.** Not started (lane boundary). Therefore unverified:
   the console's rendered bytes under `VITE_AUTH_ENABLED=false` vs unset ("byte-identical" is verified
   only as *control flow*: `__root.tsx:126-131` renders `<Outlet />` in both the disabled branch and,
   under an authenticated session, the enabled branch — I did not diff DOM); the `sandbox=""` iframe's
   visual output; the worker's `renderToStaticMarkup` result on a real keyed tree (I verified the module
   exports `Console` for the below-floor fixture, `rt355-floor\out\src\ui\console.tsx`, but never executed
   the render in a browser realm); the wild strip's live polling.
2. **`npm test` (both legs) as a whole.** Forbidden by the brief. I ran three suites individually
   (`README-cli`, `cli-exit-taxonomy`, both `src/components` suites) and reused the given baseline
   (622/607/15; src leg never ran). The **other 10 scripts-leg failures** are not attributable by me.
3. **Whether F-01 alone explains the `unattended` `complete_with_failures` failure (test 44).** The
   coincidence is strong (a red P6 is the recorded-failure class) but I did not read that run's
   `failedGates` census — treat the causal link as inferred, not proven.
4. **`scripts/browser-smoke.mjs` / `run-shot.mjs` / `preview-thumbnail.mjs` behaviour.** Playwright-bound;
   I read their headers only (`browser-smoke.mjs` = the auth-invariant + brand comparison on a live dev
   server; `run-shot.mjs` = bounded `vite build` of a temp copy then a real screenshot; `preview-thumbnail.mjs`
   = the 1280×800 dev-server PNG contract). Their exit contracts are asserted by
   `browser-smoke-verdict.test.mjs` / `run-shot.test.mjs`, which I did not run.
5. **A live reproduction of the F-05 boundary hole.** I established the *structure* (what is inside vs
   outside the boundaries) but could not induce a throw in `RunScreen`'s own body from the current bytes.
6. **The exact P6-parked render of the artifact corpus.** I read the code paths, not a real parked
   project's DOM; the "no permanent empty state" judgement for the 12 tabs is a code-path judgement.
7. **Keyed behavior.** No keyed calls were made (none permitted); every below-floor/keyless statement uses
   the keyless floor or the tracked fixtures.

---

## 6. Recommended owners

| finding | severity | owner (Wave 1 / Wave 3 lane) |
|---|---|---|
| F-01 | P0 | **The 354-emitter lane / whoever owns `src/lib/scaffold.ts`'s oracle emitter** — decide the D4 mechanism (the row must not be a vacuous pass *and* must not force the delivered tree red: e.g. `skip` + a coded ledger row, or fail only under an explicit strict flag), then re-run `cli-exit-taxonomy` to green. |
| F-02 | P1 | **docs-truth lane** (`scripts/README-cli.md` §Emit, `RUNBOOK.md` §6b, `START-HERE.md` §honest state) — but only *after* F-01's decision, since the fix direction sets the wording. |
| F-03 | P2 | **`src/lib/headless.ts` owner** (pass `underProduced: "refuse"` explicitly on the default path, or delete the dead policy and strike the docs) + the docs-truth lane for `README-cli.md:511-576`, `RUNBOOK.md:172`. |
| F-04 | P2 | **Console lane (`software-preview.tsx`)** — read the banner from `redTree.code`/`belowFloorBanner` text instead of one hard-coded literal; add the missing component assertion to F-06's suite. |
| F-05 | P2 | **Console lane (`console.tsx`)** — move the `RunScreen` derivations under the "Run screen" boundary (or add a top-of-`RunScreen` boundary), then correct `START-HERE.md:106` and `thoroughanalysis.md:1382/:1406`. |
| F-06 | P2 | **Wave 3 UI/CLI pin lane** — a `console-surface.test.ts` pinning 12 tabs + 4/8 tiers + the 12 `PaneBoundary` wraps + `sandbox=""`; extend `cli-exit-taxonomy`'s below-floor fixture (tests 59/60) with a **non-red-trail** case (`cli-exit-taxonomy.test.mjs:3815-3924`). |
| F-07, F-08, F-09 | P3 | **docs-truth lane** — one sweep of the in-file comments and RUNBOOK line citations. |

---

*Lane `reviewer-surfaces` · W355 · read-only review; the only file written by this lane is this one.
Scratch repro dirs under `%TEMP%\rt355-green` / `%TEMP%\rt355-floor` were created outside the repo and
removed after the runs. Where a doc and the bytes disagree, the bytes win.*
