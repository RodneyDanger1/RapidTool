# 351 - CLI / headless Wild Mode + research-key + relevance-filter wiring

Lane: CLI / headless (owner of `src/lib/headless.ts`, `src/lib/store.ts`,
`src/lib/io.ts`, `scripts/**`). Append-only landing log. Base: the working tree
over HEAD `30bce78`, with sibling lanes editing `engine.ts` / `scaffold.ts` /
`codegen.server.ts` / `wild-*` concurrently (RUNLOCK makes the CLI drive verbs
refuse a mid-edit tree; the harness drives `headless.ts` in-process).

Everything below is a captured command output or a `file:line` read from disk
this session. Keyed spend is real and reported in section 4.

## 1. What was broken (verified)

1. **`TAVILY_API_KEY` never reached the research layer from `.env`.** The CLI's
   `.env` loader installed only `DEEPSEEK_API_KEY`, so a configured
   `TAVILY_API_KEY` in the repo `.env` was dead weight on the bare-Node path
   (`tavily.server.ts` reads `process.env.TAVILY_API_KEY` directly).
2. **The engine's relevance filter was not applied on the headless path that
   actually writes artifacts.** `src/lib/headless.ts` built research artifacts
   and the `project.research` corpus from `bareNodeLiveOverlay`'s raw findings
   verbatim, while `engine.fetchResearch` dropped off-intent pages via
   `filterRelevantResearch` / `isOffIntentResearch`. The two paths disagreed.
3. **Two Wild-Mode CLI incoherences.**
   - `wild --pause --agent-seal` / `wild --stop --agent-seal`: the lifecycle
     controls silently ignored the governance flag (they never drive the loop),
     the exact "governance flag is never silently ignored" class 330 Switchboard
     was built to kill.
   - `wild --resume` only cleared `pause` and did **not** continue the run,
     contradicting `scripts/README-cli.md` ("`wild --resume` continues the run")
     and the console's `startWildRun` PA-01 resume (which re-enters the loop).
4. **The acceptance harness did not report the new additive product-quality
   reading** (`src/lib/product-quality.ts`, landed by a sibling lane this wave).

The console driver's `startWildRun` was verified intact (it passes
`agentSeal: true` and the keyed edges `p6Edge`/`liveEdge`/`livePhaseEdge` -
kept, no change).

## 2. Changes (file:line)

### `src/lib/headless.ts`
- Import the engine's newly exported filter: `filterRelevantResearch`
  (`src/lib/headless.ts:33`).
- Apply it in `bareNodeLiveOverlay` where research artifacts are built
  (`:579-596`): accepted findings become `items`; `cited` is true only when at
  least one relevant finding landed. A non-zero drop emits a warn row
  `p<phase>.live.research.filtered` (`:583-596`) so a filtered result is visible,
  never a silent exclusion. `droppedOffIntent` declared at `:558`.

### `scripts/rapidtool-cli.mjs`
- `installRepoEnvKey` now resolves and installs **both** keys under the same
  documented precedence (`.env` wins; present-but-blank process value is an
  intentional disable) with the same loud, coded, tail-only conflict signal
  (`:740-803`; Tavily arm `:796-803`). The DeepSeek arm keeps
  `setActiveKeySource` for the provider's 401 provenance; Tavily needs no source
  record (its provider reads `process.env` at call time). No key value is ever
  printed or stored.
- `wild --agent-seal` beside `--pause`/`--stop` is now refused coded
  (`RT_E_VALIDATION`, exit 1, remedy names the doors that carry the seal)
  (`:5047-5063`) - these two actions can never thread the seal.
- `wild --resume` now continues a paused run: `wildResumeRun` clears the pause,
  then one bounded macro-run follows through the same `wildStartHeadless` seam
  bare `wild` uses (`:5105-5122`), threading `--steps` and `--agent-seal`. A run
  that was not paused stays the byte-identical idempotent no-op.

### `scripts/acceptance-run.mjs`
- The harness's `.env` loader installs `TAVILY_API_KEY` too, same precedence /
  tail-only conflict discipline (`:115-166`); the returned key info carries a
  `research` source.
- New optional, lazily imported additive reading: `PRODUCT_QUALITY_MODULE =
  "src/lib/product-quality.ts"` and `readProductQuality(project, emittedFiles)`
  (`:288-332`) - reports `{ available, module, reader, reading }`, never fatal,
  never fed to `evaluateAcceptance`.
- Wired into `main` (`:456-468`): the emitted tree files are read back from disk
  (with source) and passed as `emittedFiles`; the result rides the payload as the
  extra `productQuality` field. The honest verdict rule is unchanged.

### `scripts/README-cli.md`
- Wild table `--resume` row now states it continues the run (one bounded loop),
  and a paragraph documents the `--agent-seal` refusal on `--pause`/`--stop`.

### Tests
- `src/lib/headless.test.ts`: new suite "W61 C9 parity - the headless research
  overlay filters off-intent findings" - a Tavily-shaped fetch stub returns one
  engineering-intent finding and one rental-listing page; asserts the listing is
  absent from artifacts + corpus and the `p7.live.research.filtered` row exists.
- `scripts/cli-exit-taxonomy.test.mjs`:
  - W45 source test extended to pin the Tavily arm of `installRepoEnvKey`.
  - New behavioral test: `wild --pause/--stop --agent-seal` refuse coded and do
    not STACK; `wild --start` then `--pause` then `--resume --steps 1` reports
    `action:"resume"`, `changed:true`, and `steps >= 1` (it CONTINUES).
  - New behavioral test: a temp-cwd `.env` with `TAVILY_API_KEY=<sentinel>` flips
    `doctor`'s research branch to the Tavily label, proving the loader wired the
    key; the sentinel never appears in stdout or stderr.
- `scripts/acceptance-run.test.mjs`: the keyless behavioral leg now asserts the
  `productQuality` field is present, available, `reader:"readProductQuality"`,
  `reading.quality === false` for the floor, and that `ok` still equals the AND
  of the assertions.

## 3. Verification - commands and raw results

```
> npx tsc --noEmit
exit 0 (no diagnostics)

> npx tsc -p tsconfig.scripts.json --noEmit
exit 0 (no diagnostics)

> node --test --test-reporter=tap "scripts/acceptance-run.test.mjs"
# tests 9
# pass 9
# fail 0
# duration_ms 25750.8225

> node --experimental-strip-types --test --test-reporter=tap --test-name-pattern "filters off-intent findings" src/lib/headless.test.ts
ok 1 - W61 C9 parity - the headless research overlay filters off-intent findings
  ok 1 - drops a rental-listing page from the corpus and artifacts; records the drop
# pass 1
# fail 0

> node --test --test-reporter=tap --test-name-pattern "installs TAVILY_API_KEY|wild lifecycle" "scripts/cli-exit-taxonomy.test.mjs"
ok 1 - wild lifecycle - --agent-seal refused on --pause/--stop; --resume continues a paused run
ok 2 - 2026-10-05 - the CLI .env loader installs TAVILY_API_KEY for the research layer (same precedence)
# pass 2
# fail 0

> node --test --test-reporter=tap --test-name-pattern "Switchboard|316 H3" "scripts/cli-exit-taxonomy.test.mjs"
# pass 4
# fail 0   (existing agent-seal guard tests unaffected)
```

`doctor` (single JSON object; process exit 0):

```
> node --experimental-strip-types scripts/rapidtool-cli.mjs doctor
process exit: 0
envelope cmd=doctor schema=1 ok=True exit_code=0
```

Note: the process exit reported by the PowerShell wrapper can read 1 on a
`NativeCommandError` from stderr noise; the envelope's own `exit_code:0` and the
`$LASTEXITCODE` probe above are authoritative.

`.env` key presence on this box (names/lengths only - never values):
`DEEPSEEK_API_KEY` non-blank (len 35); `TAVILY_API_KEY=` present but **blank**.
So on this machine `doctor` stays on the keyless free-search branch
(`research.label: "free search (duckduckgo/searxng/wikipedia)"`, `probed:true`).
The Tavily wiring is proven by the temp-`.env` behavioral test above.

## 4. Bounded keyed end-to-end run

```
node --experimental-strip-types scripts/acceptance-run.mjs \
  --brief "C:\Users\mnril\AppData\Local\Temp\bloedow-brief.md" \
  --out "C:\Users\mnril\AppData\Local\Temp\rt-acceptance-348" \
  --max-steps 18 --p6-retries 1
```

Full verdict: `C:\Users\mnril\AppData\Local\Temp\rt-acceptance-348.verdict.json`
(16,824 bytes). Decisive fields:

```json
{ "ok": false, "keyed": true, "keySource": "repo-env-file", "exit_code": 1,
  "project": { "name": "Bloedow Bakery", "status": "running", "currentPhase": 6,
    "sealedWithFailures": true, "steps": 0, "outcome": "dod", "p6Retries": 1,
    "failedGates": [ { "phase": 6, "unmet": [
      "Last template self-test run passed",
      "Machine verification promoted a tested verdict (lastTest.label === \"tested\" with evidenceHash)",
      "Brief-conformance: ... keyed tree synthesis ran (2 file(s)) but its union dropped the brief's required nouns ...",
      "Tree architecture: every expanded-spec capability maps to a real generatedTree file ..." ] } ] },
  "tree": { "dir": "C:\\Users\\mnril\\AppData\\Local\\Temp\\rt-acceptance-348\\emitted",
    "exists": false, "fileCount": 0,
    "emit": { "ok": false, "code": "RT_E_PLAN_UNDERPRODUCED",
      "error": "RT_E_PLAN_UNDERPRODUCED · artifact refused (below-floor plan): chunk 2/14 refused · accepted tree has 1 module(s) but the brief demands >= 11 ..." } },
  "treeRun": { "ok": false, "typecheck": "not run", "test": "not run" },
  "productQuality": { "available": true, "module": "src/lib/product-quality.ts", "reader": "readProductQuality",
    "reading": { "quality": false, "tree": { "present": true, "fileCount": 2 },
      "reasons": [ "no web entry - index.html missing ...", "no router - nothing navigates between pages",
        "0 distinct page files", "no styled layout (no CSS/Tailwind/className evidence)",
        "ordering flow incomplete: no order-named callable referenced by another tree file; no form element with a wired submit handler" ] } },
  "failureReasons": [ "tree.exists: no tree ...", "tree.nonEmpty: 0 file(s)", "tree.webEntry: no tree ...",
    "tree.declaredScripts: missing declared script(s): no package.json", "treeRun.ok: tree-run red: unknown",
    "tree.typecheck.pass: typecheck: not run", "tree.test.pass: npm test: not run",
    "tree.declaredScriptsVerified: declared scripts UNVERIFIED", "tree.substantive: substance stubs:0 reexports:0 real:0",
    "run.cleanSeal: status running · phase 6 · sealedWithFailures true" ],
  "spend": { "tokens": 467571, "calls": 54, "estimatedCostUsd": null } }
```

Emitted tree path list: **empty** - `emit` refused pre-write
(`RT_E_PLAN_UNDERPRODUCED`), so the emitted dir
`C:\Users\mnril\AppData\Local\Temp\rt-acceptance-348\emitted` does not exist and
zero files were written. This is the honest, expected outcome for the current
keyed P6 productivity wall (the same wall the campaign dossiers record).

The `productQuality` reading is available and reports `quality:false` with its
reasons; `tree.present:true / fileCount:2` comes from the persisted
`project.generatedTree` (the module unions `generatedTree` with the emitted
files), while the emitted dir itself is absent. The reading never changed `ok`.

## 5. Honest limits / unverified

- **No green keyed end-to-end run on this tree.** The measured verdict is red
  (P6 below-floor refusal); the binding wall is owned by `scaffold.ts` /
  `codegen.server.ts` (not this lane). Spend this run: 467,571 tokens / 54 calls
  (`estimatedCostUsd:null`). One bounded sample only - variance is the dominant
  factor per the campaign dossiers.
- **The console/server dev path does not install `TAVILY_API_KEY` from `.env`.**
  `scripts/with-app-env.mjs` only declares `RAPIDTOOL_LLM_ENV_FILE` (a path) for
  the server-side DeepSeek resolver; `tavily.server.ts` reads `process.env`
  directly and `src/lib/llm/providers/key-source.server.ts` is not this lane's
  file. So the browser console's server-side research still uses free search
  unless the key is set in the process environment. Needs a key-source.server.ts
  change (reported, not made).
- **The full scripts/src suites were not run** (`npm test` is forbidden while
  sibling lanes are mid-edit). Only the owned files' tests were run, as above.
  `node --test` also loads sibling modules; the transient
  `src/lib/product-quality.ts` syntax error observed mid-write resolved before
  the final runs.
- **The `--resume` behavior change is CLI-verified** (behavioral spawn), not
  browser-verified. The console's own resume path was read, not exercised in a
  browser this session.
