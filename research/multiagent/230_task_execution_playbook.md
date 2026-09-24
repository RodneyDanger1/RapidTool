# 230 · TASK EXECUTION PLAYBOOK — how to do each of the 42 rows, best

**Written:** 2026-09-24 by PLAYBOOK-A (W13). READ-ONLY on `src/`, `scripts/`, `fixes/` and every plan file.
**Only writes:** this file, plus one attributable pointer line at the end of `research/multiagent/220_tasklist_canonical.md`.
**What this is:** the 42-row task list (`220_tasklist_canonical.md`) says WHAT; this file says HOW — the order of
operations, the seam, the reuse, the traps, the exact verification, and the honest partial shape when blocked.
**Read with:** `220_tasklist_canonical.md` (what/why/status — its AUD-2 markers supersede the text they annotate) and
`222_codebase_integration_map.md` (the seam table, invariants, HOT map, landmines).

## §0 · Provenance — what was read and run for this file (2026-09-24, this session)

- **Read in full:** `wave_plans/W13/playbook-a.md`; `220_tasklist_canonical.md`; `222_codebase_integration_map.md`;
  `221_feature_designs.md` (F1–F5); `220_overhaul_plan.md`; `223_critical_path_premortem.md` §1–§4;
  `taskuniverselog.md:530–540`; `scripts/README-cli.md:1–40`; `research/eval-out/_keyed-run.log`.
- **Opened in the live tree** (the §1 table below): every anchor in it was re-read today with `grep -n`/`sed -n`
  after `cd "/c/Users/mnril/Desktop/RapidTool Main"` (the space-in-path landmine, L1).
- **Ran:** read-only `grep`/`sed`/`ls` only, plus **2 targeted test runs** of the wave's ≤3 allowance:
  `node --experimental-strip-types --test --test-concurrency=2 src/lib/lesson-writers.test.ts` → **18/18 pass**
  (confirms the AUD-2 correction, supersedes the stale "15"), and the same form on
  `src/lib/llm/providers/registry.test.ts` → **21/21 pass**. Zero `npm run typecheck|test|build`; no keys, no
  browser, no writes to any file but this one.
- **Marking convention:** facts I opened today are written bare (`file:line`). Facts taken from a dossier/WD report
  are marked `[cited: <file> §…]`. Anything neither — I did not write.

## §1 · SEAM ANCHORS RE-READ TODAY (the lookup table; each entry is a `file:line` I opened on 2026-09-24)

| anchor | what it is |
|---|---|
| `src/lib/headless.ts:985` | `export function summary(project: Project): ProjectSummary` — the row-TASK-01 seam; `nextAction` = **0 hits** in the file |
| `src/lib/headless.ts:960` | `export type ProjectSummary` — the shape to extend |
| `src/components/console.tsx:311` | `uiNextAction(project, running)` — the UI-side vocabulary to mirror (called :1806) |
| `scripts/rapidtool-cli.mjs:1437` | `case "summary":`; `case "eval"` = **0 hits**; `case "doctor"` :2763; `case "create"` :421, `case "gate"` :445, `case "approve"` :516; `case "new"` = **0 hits**; `until-hitl` = **0 hits**; `USAGE` object :2898 (no `diagnose:` key — **0 hits**); total `case "` arms = **35** |
| `scripts/run-eval.mjs:82` | `const KEYED = process.argv.includes("--keyed")` |
| `scripts/run-eval.mjs:85–86` | `LIMIT_ARG` parses **only the `--limit=` equals form** (AUD-2 correction) |
| `scripts/run-eval.mjs:92–93` | `--trials=N` parse (default 1) |
| `scripts/run-eval.mjs:72` | `HISTORY_PATH = join(OUT_DIR, "history.json")` (M7 priors); `priorFor` :371; `scoreMaker({` call :898; `graderFileFor` :260, `loadGrader` :318, `graderLeakScan` :608 |
| `src/lib/token-ledger.ts:294/:320/:339` | `createTokenBudget` / `assertBudgetHeadroom` / `recordBudgetSpend` — **zero non-test callers today** (grep: only `token-ledger.test.ts`); also `recordSpend` :163, `estimateCostUsd` :237, `wouldExceed` :365, `recordSpendWithinCap` :389 |
| `src/lib/codegen.server.ts:2111/:2118` | `p6TokenCapFromEnv` / `accountSynthUsage` (the landed record-then-signal pattern; 222 cited `:2120` — today the def is `:2118`); `applyStrReplace` import :97, call :906 |
| `src/lib/verify.server.ts:800/:810/:838/:1020` | the four `callModel` sites (weak tier + retries + fix call); unparseable-case-list path :272–275 (`JSON.parse` → `return null`) |
| `src/lib/chat.server.ts:561` | `callModel("main", userMessage, {…})` |
| `src/lib/crew.server.ts:885` | `callModel(crewRoleForModel(opts?.model), prompt, opts)` (222 cited `:895/:1042`; today the call is `:885`) |
| `src/lib/llm/providers/registry.ts:35–38/:143/:184/:350/:359/:396` | deferred list / `PROVIDERS` / `resolveExplicitProvider` / unknown-id message / `KNOWN_MODEL_IDS` / `callModel`; `registry.test.ts:281` asserts the two ids |
| `src/lib/doctor.ts:360` | `line: \`providerTeam: ${label} — ${segments}\``; `productComplete` field :167; `FACTORY_GAP` :183; latch conjunction :218–224 |
| `scripts/browser-guard.mjs:13/:34–44` | `checkedUrl` / `checkedOutputPath` (the Windows-unsatisfiable resolve+prefix check) + `fail` |
| `scripts/browser-smoke.mjs:23/:29–33/:41` | `parseSmokeArgs` call; callers hardcode `["/workspace"]` at :30/:32/:33 and :41 |
| `scripts/browser-smoke-verdict.mjs:17/:31/:38` | `parseSmokeArgs` (positional args; unknown `--flag` → error `:31`; default `outPng` = `/workspace/…` `:38`) |
| `vite.config.ts:145/:149–151/:155–156` | the `0.0.0.0:8080` live-preview contract (comment :145) / `server` block / preview `127.0.0.1:8081` |
| `README.md:9/:80/:101` | the three stale "34 verbs" claims; the Quickstart block around :28–40 contains `new "…"` :36, `run --until-hitl` :37, `approve --i-am-human` :38; `AGENTS.md:50` also "34 verbs"; `scripts/README-cli.md:10` already says **35 subcommands** |
| `scripts/README-cli.test.mjs:76–85/:132–141` | the count claim pin and the stale-count guard (the doc-contract to extend) |
| `src/components/console.tsx:3303` | `ScorecardBlock` (renders no caveat); the caveat string lives at `src/lib/packet.ts:498`; console caveat grep = **0** |
| `src/lib/packet.ts:16/:17/:538/:561/:564–569` | `PACKET_MAX_CHARS = 14_000` / `TRUNC_MARKER` / truncation branch; console `TRUNC` grep = **0** |
| `src/lib/brief-fixtures.ts:588/:594–615/:102–105` | `approveFixtureCases` + its impl (strips forged `decidedBy`; "never mint `decidedBy:\"human\"`") + doctrine; CLI call `rapidtool-cli.mjs:939`; console `fixture` grep = **0** |
| `src/lib/engine.ts:3011–3012` / `:3029–3030` | the two silent catches (narrative / constraints "unavailable → deterministic result stands"); the G2 precedent `liveLayerFailureRow` :3232 iface / :3266 call |
| `src/lib/store.ts:575–576` | UI-path fallback catch (comment-only); the approve call without a note :1530–1534; the ≥12-char rejection guard :1547 |
| `src/lib/engine.ts:1625/:1629/:1663` | `approveHitl` / `note?: string` field / `note: opts?.note` write; the autopilot note pattern :3550 |
| `src/lib/engine.ts:922` | the P7 "MCP/A2A" prose claim (**1 hit** in the file) |
| `src/lib/dod.ts:232/:500–517` | `archProductComplete` (consumers: `gates.test.ts` only) / `p6-verified` probe; `p3-mcp` :426–430; `types.ts:27` `"mcp"`; `phases.ts:33` B-18 declaration |
| `src/lib/compile-check.server.ts:939` | `export async function treeRun(dir, opts?)`; the exact strings at :841 and :917–918 ("NOT executed … UNVERIFIED … not a fabricated pass") |
| `src/lib/headless.ts:1790/:1916–1917/:1958/:2491–2510` | `applyTreeRunTestedMint` / journey records gate then mints (WB-1 ordering) / repair's `recordGreen` (same order) |
| `src/lib/node-runner.server.ts:74/:91/:314` | `RUNNER_OUTPUT_MAX_CHARS = 48_000` / `clampRunnerOutput` / `stdio: ["ignore","pipe","pipe"]` — **no stdin** (221 cited `:310`; today `:314`) |
| `src/lib/sandbox-policy.ts:13–17/:21/:33/:41` | `IsolationClaim` / `RUNNER_IS_NOT_A_SANDBOX` / `runnerIsolationClaim` / `coerceIsolationClaim` |
| `src/lib/engine.ts:63–67/:68/:1452–1463/:1466` | the lazy-import rationale / `type LessonSurface` / the T-11 GREEN-SEAL GATE comment + `sealLogs` / the `if (!r.pass) {` branch |
| `src/lib/headless.ts:1366–1373/:1397/:1405` | `redTree` option type / `"refuse"` default / the refusal text advising `redTree:"banner"` (CLI `redTree` = **0 hits**) |
| `src/lib/patch.ts:43/:117/:279` | `PatchKind` / `PATCH_MAX_LISTED = 50` / `applyStrReplace` |
| `src/lib/maker-score.ts:567/:604/:623` | `m7Learning` / `m9OnTime` / `scoreMaker` |
| `src/lib/doctor.test.ts:81–92` | the latch semantics the OV-9 producer must satisfy |
| `src/lib/scaffold.ts:2037–2040/:2061` | the unmaterialised-jobs line / "## What ships in this scaffold" README table |
| `fixes/217c_phase5_spec_and_decision_register.md:19/:592–595` | the two stale "UNKNOWN" slots (OV-12) |

Also verified today: `src/lib/git.server.ts` **absent**; `src/lib/cassette.ts` **absent**; `stateHash` **0 hits**
repo-wide; `engine.test.ts` **does not exist** (test pins live in `gates.test.ts` /
`lesson-writers.test.ts` / `headless.test.ts`); `patch.test.ts`, `store.test.ts`, `gates.test.ts`, `io.test.ts`,
`packet.test.ts`, `codegen.server.test.ts`, `verify.server.test.ts`, `maker-score.test.ts`, `brief-fixtures.test.ts`,
`policy.test.ts`, `wild-step.test.ts`, `knowledge.test.ts`, `report-intake.test.ts`, `sandbox-policy.test.ts`,
`scaffold.test.ts`, `doctor.test.ts`, `headless.test.ts`, `token-ledger.test.ts`, `node-runner.server.test.ts`,
`chat.test.ts`, `crew.test.ts`, `honesty-guards.test.ts`, `lesson-writers.test.ts` all **exist on disk**;
`node_modules/.bin/playwright` **present**.

## §2 · GLOBAL LANE RULES (apply to every row below)

**L1–L7 landmines (all re-verified in `222` §5; treat as live):**
- **L1** — space in the repo path breaks `search_files`/ripgrep: always `cd "/c/Users/mnril/Desktop/RapidTool Main"` first, then grep relative paths.
- **L2** — MSYS `/tmp` is invisible to Node (Node resolves it to `C:\tmp`). Scratch goes to `C:/Users/mnril/w13m_scratch/` in Windows form.
- **L3** — MSYS `/c/x` handed to Node creates `C:\c\x`. CLI args (`--out`, `--project`, screenshot paths) must use `C:/…` Windows-style paths.
- **L4** — `.hermes/environment.json` line 16 runs `npm run format` (`prettier --write .`) inside the **test** recipe. Never run repo-wide formatters/verifiers while lanes are mid-write; never run `hermes verify` as-is.
- **L5** — `browser-smoke.mjs` takes positional args; `browser-guard.mjs` cannot pass on Windows until fixed (the OV-2 row).
- **L6** — oversized/nested-substitution one-liners get hard-blocked by the command parser; write a `.sh` to scratch and run `bash <file>`.
- **L7** — 35-vs-34 verb drift (the TA-3 row).

**Forbidden in this overhaul's lanes:** `npm run typecheck`, `npm test`, `npm run build`. Targeted runs only:
`node --experimental-strip-types --test --test-concurrency=2 <file>` for `src/lib` suites;
`node --test --test-concurrency=2 <file>` for `scripts/*.test.mjs`. Script tests that touch platform chrome use
temp-dir `cwd` isolation — never run them from the repo root (`AGENTS.md`).

**HOT-file rule (222 §4):** a wave assigns each HOT file to at most one lane. HOT source files (touched W10–W12):
`algorithms.ts`+test, `codegen.server.ts`+test, `compile-check.server.ts`+test, `engine.ts`, `errors.ts`+test,
`honesty-guards.test.ts`, `knowledge.ts`, `lesson-writers.test.ts`, `node-runner.server.ts`, `scaffold.ts`+test,
`token-ledger.ts`+test, `console.tsx`, `cmd-palette.tsx`, `__root.tsx`, `styles.css`, `rapidtool-cli.mjs`
(+`auth/popup.server.ts`). `engine.ts` alone is a seam for rows OV-3-ish/OV-4/OV-11/DF-09/OV-13/T-107.7 — sequence
them, never two concurrent writers. COLD files are the default ownership pool (that is where most of this list lands).

**House style that decides whether a row closes:** declare-or-strike (`AGENTS.md` #3) — a claim that does not match
disk is struck in the same commit, never softened; `ok:true` never carries `error`, every `ok:false` carries a
registered `RT_E_*` code (`errors.ts:72`, `typed-failures.test.ts`); never mint `decidedBy:"human"` from a machine
path (`policy.ts` doctrine, `brief-fixtures.ts:102–105`); never mint `tested` before `gate.passed` (`headless.ts:2492–2510`);
skip ≠ green; telemetry never changes engine behaviour; the decision ledger is append-only (actor + ISO timestamp).
No new `eslint-disable` (I14 is a convention, not a hard rule — the tree contains one documented suppression at
`src/lib/auth/use-current-user.ts:59`; do not add more). Imports in the `src` chain use explicit `.ts` extensions;
never statically import `node:fs` into a client-safe module (use the `engine.ts:63–67` lazy seam).

**CLI contract (any row that adds/changes a verb):** one JSON object on stdout, `schema_version: 1` + `cmd` +
`exit_code`; exit taxonomy 0/1/2/3/4 (`scripts/README-cli.md`); the doc contract
`scripts/README-cli.test.mjs` pins the verb-count claim (`:76–85`) and rejects stale counts (`:132–141`) — the README
count claim and the `case "` arm must move in one commit.

## §3 · HOW TO USE THIS FILE + ROW INDEX

Each row block has the seven fields the wave plan requires: *Do it best by · Files + seam · Reuse · Know before you
start · Traps · Verify · If blocked*. Blocks are ordered by execution priority: **Part 1** = the first-48-hours rows
(dispatch first, key-free, decision-free) → **Part 2** = the `BLOCKED-KEY` rows (they unblock the keyed run) →
**Part 3** = `TODO` rows by leverage → **Part 4** = `UNVERIFIABLE-NOW` rows (their "how" is what must be defined
first) → **Part 5** = `OWNER-*` rows (short: the decision + the cheapest evidence that makes it cheap).

| part | rows |
|---|---|
| 1 — first 48 h | TASK-01 · T5.3 · OV-2 · TA-3 · OV-17 · DF-18 · DF-26 · T5.2 (half A) · OV-13 · OV-12 · OV-15 |
| 2 — blocked-key | OV-3 · OV-4 · OV-5 · T0.10 · OV-8 |
| 3 — todo by leverage | T-107.6 · OV-1 · T-107.7 · T4.2 · OV-9 · OV-14 · OV-16 · OV-7 · G5 · TA-21 · DF-04 · OV-18 · T5.4 · T5.7 · T5.1 · T5.5 · OV-6 |
| 4 — unverifiable-now | DF-09 · T4.3 · G4 |
| 5 — owner | T-107.8 · OV-10 · OV-11 · D-1 (T5.6) · D-2 (T5.8) · T3.6 |

Cross-references: TA-3 and OV-17 share `README.md` — sequence them, one lane owns the file at a time. DF-18 and
DF-26 share `console.tsx` — one lane, one commit, or DF-26 follows DF-18. OV-3/OV-4/OV-5 all read T0.10's log first.
OV-4 and OV-5 carry the C-1/C-2 pre-Step-0 fix shapes (WB-1 refutation below).

---

# PART 1 · THE FIRST 48 HOURS (dispatch these first; key-free, decision-free, one lane each)

## ### TASK-01 · nextAction on the summary envelope   [M · lane (W14-L1) · TODO]

**Do it best by:** Extend the ONE summary producer — do not add a second derivation. Read `console.tsx:311`
`uiNextAction` end-to-end first and transcribe its *branch order* (most urgent fact wins: running → hitl →
blocked → …) and its mandatory `unknown` arm into a wire-side pure function in `headless.ts`; then add the field to
the return object of `summary()` (`headless.ts:985`, return object at `:1008`). Vocabulary is 111's action
vocabulary (`unknown/running/approve/retry/done/fix-gate/run`) with the brief's 7 arms as distinguishable cases —
this is the parent decision recorded at `taskuniverselog.md:534–538` ("implement 111's action vocabulary as the
wire contract … keep the two computations independent this wave"). The one choice that matters: keep the console
computation untouched; this row adds the wire side only.

**Files + seam:** `src/lib/headless.ts` (`ProjectSummary` :960, `summary()` :985 — `nextAction` = 0 hits today);
`src/lib/headless.test.ts`; `scripts/rapidtool-cli.mjs` (`case "summary":` :1437 already serialises the whole object —
no second wiring needed); `scripts/README-cli.md` (document the field).

**Reuse (do not rebuild):** `uiNextAction` `console.tsx:311` (branch order + `cmd` names `gate/approve/retry/emit/status`);
`UiNextAction`'s kind union as the vocabulary spec; the existing `respond()`/envelope machinery
(`rapidtool-cli.mjs:122`).

**Know before you start:** (1) Invariant I1 — `ok:true` never carries `error` (`errors.ts:72`); the `unknown` arm is
mandatory so the field can never fabricate a specific claim (`console.tsx:311` doc-comment region). (2) HOT rule:
`rapidtool-cli.mjs` is HOT — one lane; `headless.ts` is COLD (free). (3) Declare-or-strike: the field is documented
in `README-cli.md` in the same commit. (4) Never import the `.tsx` component into `headless.ts`; the wire type is
defined lib-side (`ProjectSummary` is at `headless.ts:960`).

**Traps:** A `status`-only derivation mislabels a parked HITL gate — copy the console's branch order, not just its
output. Do not refactor `uiNextAction` to consume the new wire field (the parent decision keeps two independent
computations this wave; a UI regression would be invisible to `headless.test.ts`). Watch the empty-phases case: the
console returns `unknown` for `phases: []` — the wire must too. Silent-failure surface: a returned kind that no
consumer can distinguish from `unknown` (e.g. collapsing `fix-gate` into `retry`) passes the unit test but breaks
the contract — pin each of the seven arms as its own case in `headless.test.ts`.

**Verify:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` → all pass
(suite exists on disk; 90/90 as of 223 §5's run today) **and** `grep -c nextAction src/lib/headless.ts` > 0
(0 today). Then one CLI probe against a scratch project file (the `summary` arm's usage line at
`rapidtool-cli.mjs:1437` names the flag) — the returned JSON object carries `nextAction`. RED = grep stays 0, or an
arm-case assertion fails.

**If blocked:** land the pure derivation + its unit tests only; do NOT half-wire the CLI, and record "README-cli
field doc + CLI probe pending" in the wave log — the grep/verify pair above is the partial's honest stopping point.

## ### T5.3 · eval verb exposing the M1–M9 scorecard   [S · lane (W14-L1) · TODO]

**Do it best by:** The substrate is landed (driver + rubric + corpus + results — 217c "DONE-today" #2); write only a
thin verb. First read `scripts/run-eval.mjs`'s tail: its `main()` (:1214) is **not exported** (no `export {` in the
file; entry guarded by an `isMainModule` check) — so the verb must either (a) spawn `node --experimental-strip-types
scripts/run-eval.mjs` as a child and repackage its stdout, or (b) add a deliberate export to the driver and call it
in-process. There is **no `child_process` use anywhere in `rapidtool-cli.mjs` today** (grep = 0 hits) — whichever
shape you pick, choose it deliberately and record it at dispatch. Whatever runs must end in ONE JSON object per the
CLI contract (`schema_version: 1` + `cmd` + `exit_code`, `respond()` :122); the driver's human lines
(`rapidtool eval · mode=…` — seen in `research/eval-out/_keyed-run.log:3`) must not leak into stdout.

**Files + seam:** `scripts/rapidtool-cli.mjs` (new `case "eval":` — `case "eval"` = 0 hits today; dispatch table
arms span :421–:2783, `USAGE` :2898); `scripts/run-eval.mjs` (driver, main :1214, `KEYED` :82, `--limit=` :85–86,
`--trials=` :92–93); `scripts/README-cli.md` (doc row + count claim `:10`); `scripts/*.test.mjs` (new verb test;
doc contract `scripts/README-cli.test.mjs`).

**Reuse (do not rebuild):** the whole driver (corpus → trials → graders → `results.json`); `graderFileFor` :260,
`loadGrader` :318, `graderLeakScan` :608; exit taxonomy from `scripts/README-cli.md`; the `lesson`-family
one-action-flag guard pattern (`rapidtool-cli.mjs:1869–1893`) if the verb gains flags beyond `--limit=`.

**Know before you start:** (1) AUD-2 correction: the driver parses **only the equals form** (`--limit=1`) — a
space-form `--limit 1` is silently ignored (`run-eval.mjs:85–86`); define the new verb's grammar deliberately.
(2) Invariant I11/doc-truth: adding a verb moves the count 35→36; the README-cli claim + the `README-cli.test.mjs`
count pin (`:76–85`, stale-count guard `:132–141`) move in the same commit. (3) Red scores are data — exit 0 when
the run completed; a coded refusal only when the corpus is missing. (4) `rapidtool-cli.mjs` is HOT — one lane.

**Traps:** Leaking the driver's console output breaks "single JSON object" (a driving agent's `JSON.parse` fails);
routes to check: spawn with captured stdio, or a driver quiet-mode is not defined today — do not invent one, add the
minimum. Do not default to keyed: keyless must stay byte-identical (M7 priors read `history.json`, `run-eval.mjs:72`
/`priorFor` :371; a stray keyed run rewrites `results.json`). Do not turn the verb into a pass/fail gate — it
reports the scorecard as data. Watch the `--keyed`-without-key fallback notice (`run-eval.mjs:632`): the verb must
surface the same honest notice, not hide the fallback.

**Verify:** post-landing: `node --experimental-strip-types scripts/rapidtool-cli.mjs eval --limit=1` → one JSON
object, exit 0 (red scores allowed as data); `node --test scripts/README-cli.test.mjs` → green. RED =
`Unknown subcommand: eval` (the current state, exit 1).

**If blocked:** if the driver integration cannot be finished honestly (child-process shape unresolved), ship
**nothing** in the CLI and write the memo naming the two shapes + the blocker; a stubbed verb is worse than absence
(it would satisfy the grep while lying about capability — declare-or-strike).

## ### OV-2 · first browser pass — fix the output-path guard first   [M · lane (W14-L4) · TODO]

**Do it best by:** Two-step lane, strictly in order: (1) fix `scripts/browser-guard.mjs:34–44` `checkedOutputPath` —
it resolves `target` then compares against the raw allowed dirs (callers pass the literal `"/workspace"`,
`browser-smoke.mjs:30/:32/:33/:41`), so a resolved `C:\…` path can never pass on Windows. Resolve each allowed dir
the same way the target is resolved before the prefix test (and keep the `..`-escape protection intact); the WD-C
repro (`C:/workspace/screenshots/…` against `["/workspace"]` → refusal) is the RED. (2) Run the smoke against
`npm run dev` and fix/register every finding (declare-or-strike). Keep args positional — `parseSmokeArgs`
(`browser-smoke-verdict.mjs:17–38`) rejects unknown `--flags` (`:31`) and defaults `outPng` to a `/workspace/…`
path (`:38`); do not "fix" the CLI shape, fix the guard and pass `C:/workspace/...` style paths.

**Files + seam:** `scripts/browser-guard.mjs` (`checkedUrl` :13, `checkedOutputPath` :34, `fail` :44 — fix target
:34–44); `scripts/browser-smoke.mjs` (:23 args parse, :29–33 checked calls, :41 baseline);
`scripts/browser-smoke-verdict.mjs` (:17–38); `src/components/console.tsx`, `src/styles.css` (findings only).

**Reuse (do not rebuild):** `checkedUrl`'s loopback rule (:13–31, `BROWSER_ALLOW_EXTERNAL_HOST=1` override);
`parseSmokeArgs`/`derivedPaths`/`exitCodeFor` in the verdict module; `scripts/browser-smoke-verdict.test.mjs` as
the pin site pattern; Playwright is installed (`node_modules/.bin/playwright` present — verified today).

**Know before you start:** (1) Invariant: runs must be real; every finding is fixed or registered in the same lane
(`222` §2 row 4) — "nobody has looked at these pixels" (`fixes/218` §4) ends only with a smoke that returns `ok`.
(2) The guard protects against screenshotting arbitrary files into a PNG — do not weaken it into "accept any path";
the fix is resolve-both-sides, not pass-through. (3) Dev server contract: `0.0.0.0:8080`, fixed (`vite.config.ts`
:145/:149–151) — do not change host/port.

**Traps:** Fixing only the first call site (`:30`) leaves `:32/:33/:41` broken — all four hardcode
`["/workspace"]`. Running the smoke before the guard fix exits 1 with the WD-C message ("screenshot path must be
under /workspace, got C:\\workspace\\…") — that is expected RED, not a new bug. The smoke writes a PNG + verdict
JSON; write them into a scratch dir you own (`C:/workspace/screenshots/` per the recorded call shape, or a dir you
create) — never into the repo. A findings pass with "no findings" and no evidence of a rendered page is not a pass
(capture the PNG + verdict JSON and cite them).

**Verify:** `node scripts/browser-smoke.mjs http://localhost:8080/ C:/workspace/screenshots/w13-l4.png` with
`npm run dev` up → `{ok: true, …}` and the PNG written (WD-C's closest-runnable post-guard-fix form). RED = the
current guard refusal (exit 1) — the fix's own acceptance is exactly that message disappearing on the same input.

**If blocked:** if the dev server cannot stay up on this memory-tight host, block on the guard fix alone: unit-level
guard checks (the WD-C repro now passing) + a written note that the pixel pass did not run; register, do not claim
a browser pass.

## ### TA-3 · doc-truth sweep: verbs, counts, USAGE   [S · lane (W14-L5) · TODO]

**Do it best by:** One lane, one commit, every count re-derived by a command run in that commit. Today's facts:
`grep -c 'case "' scripts/rapidtool-cli.mjs` = **35**; `README.md:9/:80/:101` and `AGENTS.md:50` say **34**;
`scripts/README-cli.md:10` already says **35 subcommands** (untouched, it is the pattern to copy); the CLI's `USAGE`
object (`:2898`) has **no `diagnose:` key** (`grep -c 'diagnose:'` = 0) although `diagnose` is a real arm (it is in
the README-cli verb list). Strike, don't soften: replace the stale numbers, add the missing USAGE key, and extend
the doc-contract test if a claim lacks a pin.

**Files + seam:** `README.md` (:9, :80, :101), `AGENTS.md` (:50), `scripts/README-cli.md` (verb list + claim :10),
`taskuniverselog.md` / `remainingwaves.md` (count claims if any); test seam `scripts/README-cli.test.mjs`
(count pin :76–85, stale-count guard :132–141).

**Reuse (do not rebuild):** `scripts/README-cli.test.mjs` IS the doc-contract pattern — extend it to the `eval` verb
(after T5.3 lands, if it lands first) rather than writing a second checker; the deriving command already lives in
`README-cli.md:10`.

**Know before you start:** (1) Invariant I11/doc-truth: "every count re-derived by a command in the same commit".
(2) `TA-3` and `OV-17` share `README.md` — one lane owns the file at a time; sequence (OV-17 is the Quickstart
probes; both are edit-only, but disjoint-file discipline still applies per wave). (3) HOT: `rapidtool-cli.mjs` if
USAGE is touched — one lane.

**Traps:** Re-running `grep -c 'case "'` gives the count but not the *list* — transcribe verb names from the file,
not memory (the README-cli list is the copy pattern; verify each name exists as an arm). If T5.3 lands in the same
window, the count becomes 36 in one of the two commits — do not pin 35 in a test in the other commit; make the test
read the count (the pattern at `README-cli.test.mjs:76–85` already computes `realCount`). Silent trap: fixing
`README.md` but leaving the same claim in `AGENTS.md:50` (or vice versa).

**Verify:** `grep -c 'case "' scripts/rapidtool-cli.mjs` (prints the real count; every doc claim must equal it) and
`node --test scripts/README-cli.test.mjs` → green; plus `grep -c 'diagnose:' scripts/rapidtool-cli.mjs` > 0 after
the USAGE fix (0 today). RED = the doc-contract test fails on a stale count (its `:132–141` guard is designed to
catch exactly that).

**If blocked:** land the two independent halves that are verifiable (README/AGENTS counts; USAGE `diagnose`) and
record the other in the wave log — this row has no cross-dependency that justifies shipping zero.

## ### OV-17 · README Quickstart commands are broken   [S · lane · TODO]

**Do it best by:** Probe, then strike or fix. Today's bytes: the Quickstart block (README.md region :28–40) tells a
user to run `node scripts/rapidtool-cli.mjs new "your brief here"` (:36) — `case "new"` = **0 hits** in the CLI (the
verb is `case "create":` :421); `run --until-hitl` (:37) — `until-hitl` = **0 hits** in the CLI (the park verb is
`gate` :445 / `approve` :516); `approve --i-am-human` (:38) — verify the flag at dispatch (the arm exists, :516).
Either make the block work as written (least code: correct the commands to `create --brief "…"` / `run` + `gate` /
`approve`) or strike the block — declare-or-strike; the probes are cheap and decisive.

**Files + seam:** `README.md` (Quickstart block :28–40; `219a` §3 rows 6–7 are the recorded probes: `new` →
`Unknown subcommand`, exit 1; `--until-hitl` exists only at README.md:37).

**Reuse (do not rebuild):** the CLI's own usage lines (each `case` arm above the `case "create":` :421 /
`case "gate":` :445 / `case "approve":` :516 documents its real flags — copy from those, do not invent); the
`doctor --tree` line (:39) is real and already correct (`case "doctor"` :2763).

**Know before you start:** (1) Same-file rule with TA-3. (2) House style: a doc that tells a user to run a command
that exits 1 is a lie by contract — fix or strike, never leave. (3) The Quickstart is also the first thing a
consumer agent reads — the corrected block must run clean from a scratch dir in one pass.

**Traps:** Fixing the command text without probing leaves a different wrong flag (`--until-hitl` has no analogue
name — the real `gate` verb parks at the next gate; check its actual flags at dispatch, `:445`). Probing against
the repo root instead of a scratch dir can write project files into the tree — run the probe in
`C:/Users/mnril/w13m_scratch/`. L2/L3: pass Windows-form paths to Node.

**Verify:** run the corrected block's commands against a scratch dir, in order, each exits per the taxonomy
(`create` → 0; `run` → 0/2 parked; `approve` → 0/2) — `219a`'s probes are the reference for what RED looked like.
Cheap first check: `grep -c 'case "new"' scripts/rapidtool-cli.mjs` = 0 today (proves the break); after the fix the
block contains no verb the CLI does not have.

**If blocked:** strike the block's broken lines with the probe transcript recorded in the commit message (the
strike precedent is `fixes/218` §2.4) — the README must not carry commands that fail.

## ### DF-18 · scorecard's template-estimate caveat dropped in UI   [S · lane (next wave) · TODO]

**Do it best by:** One-line honesty restore into `ScorecardBlock` (`console.tsx:3303`): the packet already carries
the caveat string at `packet.ts:498` — "(deterministic feasibility estimate — template-derived, not live
research)" — the UI renders none of it (grep = 0). Render the same string (or the short form) inside the scorecard
block, next to the headline number. Do it in the same lane/commit as DF-26 (same file).

**Files + seam:** `src/components/console.tsx` (`ScorecardBlock` :3303–:3362 region; caveat grep today = 0);
`src/lib/packet.ts:498` (the string to mirror — do not invent new wording).

**Reuse (do not rebuild):** `packet.ts:498`'s exact sentence; the existing block styling in `console.tsx`; no new
component.

**Know before you start:** (1) Invariant: "the headline number must not look researched when it is template-derived"
(`222` §2 row 22). (2) `console.tsx` is HOT — this row and DF-26 are the SAME lane (one writer). (3) There is **no
`console.tsx` test file** (222 §6 UNMAPPED cell 3; `ls src/components/*.test.*` → none) — the register says: verify
by grep now, browser pass after OV-2.

**Traps:** Editing a neighbouring render block by accident (the file is 3 300+ lines; the block boundary is
`:3303`; the second grep below is the guard). Don't paraphrase the caveat into something softer ("estimate" alone) —
the string's force is that it is template-derived and not live research.

**Verify:** `grep -cE 'feasibility|template-derived|not live research' src/components/console.tsx` → ≥ 1 (0 today).
RED = still 0. Optional post-OV-2: the browser pass confirms it renders.

**If blocked:** if the block's exact insertion point can't be reached (unlikely), land the grep-visible string in
the nearest honest surface inside the block and state the deviation in the wave log — never silently skip.

## ### DF-26 · packet truncation invisible in the console   [S · lane (next wave) · TODO]

**Do it best by:** Make truncation loud in the same console surface. Facts: `PACKET_MAX_CHARS = 14_000`
(`packet.ts:16`), `TRUNC_MARKER` :17, the assembly truncates at :538/:561/:564–569; console `TRUNC` = 0 hits. The
packet's own section accounting exists at compile time — surface either the marker presence (read the assembled
packet) or the account ("sections cut") in the console; prefer reading the real packet output, not recomputing.

**Files + seam:** `src/components/console.tsx` (+ sections-cut accounting where the packet is displayed);
`src/lib/packet.ts:16/:17/:538/:561/:564–569` (the truncation seam to read from).

**Reuse (do not rebuild):** `TRUNC_MARKER` (`packet.ts:17`) as the detection token; the packet's compile-time
section accounting (222 §2 row 21) — the packet tests already exist (`src/lib/packet.test.ts`).

**Know before you start:** (1) Invariant: "downstream agent must never silently lose sections" (`222` §2 row 21).
(2) Same lane/file rule with DF-18 — one writer on `console.tsx`. (3) No console test file (as DF-18).

**Traps:** Reconstructing truncation client-side from `PACKET_MAX_CHARS` duplicates logic and silently drifts if
the cap changes — read the marker/accounting from the packet itself. A banner that only appears when the user opens
the packet defeats "silently loses the tail" — put it where the packet/download affordance is.

**Verify:** `grep -c TRUNC src/components/console.tsx` → ≥ 1 (0 today). RED = 0. Post-OV-2 browser pass is the
belt-and-braces.

**If blocked:** as DF-18 — the grep is the honest stopping point; register the partially-realised version.

## ### T5.2 (half A) · fixtures review UI + store actions   [M · lane (Phase 5) · TODO]

**Do it best by:** Wire the UI onto the ALREADY-LANDED approval path — `brief-fixtures.ts:588 approveFixtureCases`
(strips forged `decidedBy`, never mints `"human"` — doctrine :102–105) is called today only by the CLI
(`rapidtool-cli.mjs:939`), and the console has **0** fixture hits. Add a store action that calls the same helper
(never a second path), and a review surface that lists pending cases and flips `acceptanceFixtures[i].approval`
through it. Prefer extracting pure logic from the component for the testable half — console-component testing is
UNKNOWN (217c).

**Files + seam:** `src/components/console.tsx`; `src/lib/store.ts` (new action beside the approve/reject actions);
`src/lib/brief-fixtures.ts` (only if a helper is genuinely needed — `approveFixtureCases` :588 must stay the single
flip path); tests: `src/lib/brief-fixtures.test.ts` (exists, pins the gate at :433+) + new store-action tests.

**Reuse (do not rebuild):** `approveFixtureCases` (:588) + `approveAllFixtureCases`; `BRIEF_FIXTURE_DECIDED_BY`
vocabulary; the CLI's `fixtures --approve` behaviour as the reference semantics (`rapidtool-cli.mjs:939–945`).

**Know before you start:** (1) Invariant I2 — a machine path must not mint `decidedBy:"human"`; the UI click is a
human seat, and the existing helper already handles the stamping rules — do not bypass it. (2) Brief-hash revert
rule: approving fixtures interacts with the brief hash ("brief-hash revert rule holds" — row's done-when) — check
the existing gate (`fixtureApprovalGate`, pinned at `brief-fixtures.test.ts:433`) before touching store wiring.
(3) `console.tsx` + `store.ts`: store is COLD, console is HOT — one lane.

**Traps:** A second approval path (e.g. setting `approval:"approved"` inline in the component) silently loses the
forged-`decidedBy` stripping and the gate checks — the row's done-when specifically forbids it. A UI review surface
that approves *drafts* rather than *pending human decisions* would mint human approval from a machine-timed flow —
keep it a human click on pending cases only. Watch for the pending banner's truth condition (recompute from the
project, don't cache).

**Verify:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/brief-fixtures.test.ts` (exists)
+ new store-action tests; CLI probe `fixtures --project <file> --approve --ids <id>` still reports the approval
(`rapidtool-cli.mjs:939` path unchanged). If a console DOM assertion is impossible (no console test file), say so
and register a post-OV-2 browser check.

**If blocked:** land the store action + tests (pure, verifiable) and register the UI surface as pending — the
"functional" claim needs the human click, so do not claim the row complete without the surface.

## ### OV-13 · silent degrades → visible record rows   [M · lane · TODO]

**Do it best by:** Four sites, one pattern: emit a warn/coded row where a degrade is currently silent. Today's
bytes: `engine.ts:3011–3012` (keyed narrative failure → deterministic stand-in, comment only) and `:3029–3030`
(constraints likewise); `store.ts:575–576` (UI-path fallback catch, comment only); `verify.server.ts:272–275`
(unparseable case list → `return null`, indistinguishable from "no cases"). Copy the landed G2 precedent:
`liveLayerFailureRow` (`engine.ts:3232` interface, called :3266). Preserve behaviour; add the row.

**Files + seam:** `src/lib/engine.ts` (:3011–3012, :3029–3030; precedent :3232/:3266); `src/lib/store.ts`
(:575–576); `src/lib/verify.server.ts` (:272–275); tests `src/lib/store.test.ts` + `src/lib/verify.server.test.ts`
(both exist) + the engine side mirrors the sealed-log pin pattern (engine pins live in `gates.test.ts` /
`lesson-writers.test.ts` / `headless.test.ts` — `engine.test.ts` does not exist).

**Reuse (do not rebuild):** `liveLayerFailureRow` as the row factory; the sealed-log pin pattern in existing
engine-adjacent suites; `RT_E_*` codes from `errors.ts` (pick the registered code that matches the failure class —
do not invent one).

**Know before you start:** (1) Invariant: telemetry must never change engine behaviour (AGENTS.md #7) — the row
adds evidence, it must not alter control flow or outputs (the keyed/keyless byte-identity depends on it).
(2) `engine.ts` is the collision magnet — this row takes the HOT file alone or sequences with other engine rows
(OV-11, DF-09). (3) The row's own bar: a degraded keyed pass must be distinguishable from a deliberate keyless one
(today it is byte-identical).

**Traps:** Adding the row *inside* the catch in a way that can itself throw (telemetry never throws into observed
code) — wrap as the precedent does. Distinguishing "no cases" from "unparseable cases" in `verify.server.ts` means
the row must carry which one happened (a code + detail), not just "warn". Don't change the deterministic fallback's
output shape — old projects and byte-identity tests read it.

**Verify:** extend `store.test.ts` + `verify.server.test.ts` with failure-row assertions, engine side with the
sealed-log pin pattern; run each extended suite targeted
(`node --experimental-strip-types --test --test-concurrency=2 src/lib/store.test.ts` and `… verify.server.test.ts`).
RED = the new assertions fail on today's tree (they should: the rows don't exist yet).

**If blocked:** land the sites whose tests you can run; for the engine-side rows without a runnable pin, land the
row + a `grep`-visible marker and register the missing pin as its own follow-up — an unasserted row is a partial,
say so.

## ### OV-12 · register still says isolation outcome "UNKNOWN"   [S · lane · TODO]

**Do it best by:** Doc-truth fix, no code. `fixes/217c_phase5_spec_and_decision_register.md:19` still reads
"outcome UNKNOWN, awaiting W11-L2 host probe" and the drop-in slot at `:592–595` still reads "[W11-L2 PROBE RESULT —
UNKNOWN at write time…]" — but 217b §2 settled it (no isolator on this host; docker/bwrap → 127; WSL 0 distros).
Replace the slot text with the settled Outcome-2 record (claim stays frozen), citing 217b §2's raw capture.

**Files + seam:** `fixes/217c_phase5_spec_and_decision_register.md` (:19, :592–595).

**Reuse (do not rebuild):** 217b §2's probe record as the citation; the register's own slot format (fill the
drop-in slot as designed, do not restructure).

**Know before you start:** (1) `fixes/` is append-only per `AGENTS.md` — but this is a documented drop-in slot the
file itself declares; edit the slot, do not append a contradicting later section. If in doubt, append a dated
`[SETTLED 2026-09-24]` line inside the slot. (2) This is a decision-adjacent doc: the settled result is "no
isolator" — do not turn it into a claim of isolation.

**Traps:** Updating one slot and not the other (`:19` and `:592–595` are both stale). Re-stating the probe's
"UNKNOWN" as "T-107.8 confirmed" would pre-empt the owner's T-107.8 decision — the register records the *probe
result*, the owner records the *decision* (see Part 5).

**Verify:** `grep -n 'PROBE RESULT\|UNKNOWN at write time' fixes/217c_phase5_spec_and_decision_register.md` — the
stale strings are gone / replaced by the settled text (they read today at :19 and :592). RED = the grep still
prints the stale lines.

**If blocked:** n/a — this is a text edit with a mechanical check; if the wording is contested, write the settled
text + the 217b citation and flag the wording in the wave log.

## ### OV-15 · redTree banner unreachable from the CLI   [S · lane · TODO]

**Do it best by:** Decide one of two honest closures: (a) expose the policy — a real flag/verb that reaches emit's
`redTree: "banner"` path (`headless.ts:1366–1373` option type, `:1397` default `"refuse"`, `:1405` the refusal text
that advises `redTree:"banner"`), or (b) strike the refusal text's advice so it stops pointing at an unreachable
option. `grep redTree scripts/rapidtool-cli.mjs` = **0** today; the CLI's emit passes only `{force}` (`219a` §5.2
F1; CLI `case "emit"` :781). Cheapest correct: (a) if `emitProject` already accepts the option (it does —
`headless.ts` signature region), wire one flag through the existing arm; otherwise (b).

**Files + seam:** `scripts/rapidtool-cli.mjs` (emit arm :781; `redTree` = 0 hits);
`src/lib/headless.ts:1366–1373/:1397/:1405` (the option + the advice text).

**Reuse (do not rebuild):** `redTreeBanner()` (`headless.ts:1343`) already renders the banner; `redTreeBanner:
true` stamping exists (`:1367`); `exitCodeFor`-style semantics not needed — the emit arm's exit behaviour already
exists.

**Know before you start:** (1) HOT: `rapidtool-cli.mjs`. (2) House style: if you expose the flag, the refusal text
stays true and unchanged; if you strike, the refusal offers only reachable options. Either way a doc/help line
moves in the same commit. (3) `redTree:"probe"` exists too — do not accidentally expose only one of the two
non-default policies without saying so.

**Traps:** The refusal text is a string in `headless.ts:1405` — grepping only the CLI will miss it; both sides must
agree after the change. Adding a flag that bypasses the guard without the banner-prefixed README would ship a red
tree with no warning — the `banner` policy's contract is the banner ON the emitted README (`:1366–1367`); don't
re-implement it in the CLI.

**Verify:** `grep -n 'redTree' scripts/rapidtool-cli.mjs` shows the new flag (today: no output) **and** either the
refusal text unchanged (option a) or updated (option b); plus a scratch-dir emit probe on a red-trail project (the
one `219a` used) showing the chosen behaviour. RED = grep still empty and the advice string unchanged.

**If blocked:** do (b) alone — striking the advice is strictly better than an unreachable instruction and needs no
new plumbing; record the flag as a follow-up.

---

# PART 2 · BLOCKED-KEY — the three zero-legs (they unblock the keyed run)

**Read this first (all three rows):** each lane starts by reading T0.10's log (`research/eval-out/_keyed-run.log`
+ `results.json`). Without it, the row's done-when degrades to a **diagnosis memo** — do not patch blind
(`219e`'s rule, kept). The pre-mortem (`223` §2 WB-1/WB-2) already predicts the shape: for every chunked keyed
synthesis the P6 gate is recorded before the tree-run can promote `lastTest:"tested"` — a verified circular
deadlock (`headless.ts:1916–1917` then `:1958`; the repair seam `:2493–2510` repeats the order). **The plan's own
sequencing consequence (`220` §4.6): land C-1 (OV-4's fix) + C-2 (OV-5's fix) BEFORE T0.10, so the keyed number is
informative instead of measuring a deadlocked program.** If the parent has not pulled those forward, OV-4/OV-5 are
the rows that make T0.10 worth running.

## ### OV-3 · M2 leg: emitted tree's own tests run honestly   [M · lane (W15-L1) · BLOCKED-KEY]

**Do it best by:** Read T0.10's log first; then make `treeRun` (`compile-check.server.ts:939`) actually execute the
emitted tree's own typecheck+test on a **corpus-shaped fixture**, with three distinct outcomes (pass / fail /
unverified). The C-3 fix shape (`223` §4): reproduce the 2026-09-10 artifact shape — `src/generated/*.ts` +
`src/jobs/*.ts` bridges + `tests/oracle.spec.ts` + `tsconfig.json` + `package.json` — as a checked-in fixture and
make `treeRun` return `ok:true` with `testsPass>0` on it **without installing anything**. Register the honest
"unverified ≠ fabricated" wording for any leg that still cannot run.

**Files + seam:** `src/lib/compile-check.server.ts` (`treeRun` :939; the exact strings at :841 and :917–918 must
stay byte-identical: "was NOT executed … UNVERIFIED … not a fabricated pass"); `src/lib/scaffold.ts` (census
emission — `censusOracleRows` `:1093` / README census `:2014–2021` [cited 222 §2 row 6]); `codegen.server.ts`
(`treeFailure` field `:2054` [cited 222]); tests `src/lib/compile-check.server.test.ts` (exists), `scaffold.test.ts`,
`codegen.server.test.ts`.

**Reuse (do not rebuild):** the three-outcome verdict machinery already in `treeRun`; `installToolFor` :1145 /
`verifyKindDir` :1270 [cited 222]; the `scaffold.ts` README census lines (`test.skip("<id> — NOT IMPLEMENTED")`);
the fixture technique from `223` §C-3 (the fixture IS the diagnosis).

**Know before you start:** (1) Invariant I6 — never fabricate a pass; the three outcome strings are pins, not
comments. (2) Invariant I5 — skip ≠ green; a red tree can never be `ok:true`. (3) HOT: `compile-check.server.ts`
and `scaffold.ts` are both HOT — this lane owns them; sequence with any other row touching them. (4) The memory-tight
host: do not add an install step to the test run.

**Traps:** Making the fixture pass by weakening the verdict (e.g. treating "could not install" as green) is the
exact failure the strings exist to prevent. The fixture must be checked in (else the lane becomes an environment
test). A green fixture tree that only passes because its spec is `test.skip` is a skip dressed as a pass — assert
`testsPass ≥ 1` on a really-executed test, not on the runner's exit code alone.

**Verify:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/compile-check.server.test.ts`
(exists; WD-C §3 SOUND) with the new case asserting `treeRun(dir).ok === true` and the executed-test count ≥ 1, plus
one case where a red tree stays `ok:false`. RED on today's tree = the fixture case fails (that failure is the
diagnosis, per `223` §C-3).

**If blocked:** write the diagnosis memo naming which leg cannot run and why (install? toolchain? tree shape?) — the
memo is the honest deliverable; the row does not close on prose, so leave it open. Never mark it done with an
unasserted fixture.

## ### OV-4 · M3/M4 leg: promote a machine-verified verdict   [M · lane (W15-L2) · BLOCKED-KEY]

**Do it best by:** Break the gate-before-mint deadlock (C-1, `223` §4) in the SINGLE shared place both seams can
call. Today's ordering: journey records the P6 gate at `headless.ts:1916–1917` and only mints after
(`:1958`); `repairTreeDir`'s `recordGreen` does the same (`:2493–2510`). Fix shape: on a **green tree-run verdict**
— which the journey already holds — apply `applyTreeRunTestedMint` (def `:1790`, delegating to codegen's
`mintTreeRunTested`) **first**, then `recordGateInto(…, 6)`; keep "no mint on red" untouched; one shared helper for
both seams so the ordering cannot drift apart again.

**Files + seam:** `src/lib/headless.ts` (`applyTreeRunTestedMint` :1790; journey green branch :1916–1958; repair
`recordGreen` :2491–2510); `src/lib/codegen.server.ts` (`lastTest: null` for chunked at :3142 and the mint
:3209–3248 [cited 223 §2]); `src/lib/dod.ts` (`p6-verified` probe :500–517 reads `lastTest.label === "tested"` +
non-empty evidenceHash; `p6-test` :473–480 [cited 222]); tests `src/lib/headless.test.ts` (exists).

**Reuse (do not rebuild):** `mintTreeRunTested` (the only legal chunked-tree mint — do not write a second one);
`recordGateInto`; the existing `p6.tree.tested.skipped` log path (`headless.ts:1289` region) for green-but-unsure
runs; `gatedFailureMint` (`verify.server.ts:899`, call :1012 [cited 223]) for failure rows.

**Know before you start:** (1) Invariant I8 — never mint `tested` before `gate.passed`; this fix must preserve the
T0.6 intent ("never mint on unsure evidence") while treating a genuine green tree-run as the evidence it is. (2) The
test that proves it must use the **default** `recordGate` — today's `headless.test.ts:492` injects a fake green
gate, which is why the suite misses the deadlock (`223` §4). (3) HOT: `headless.ts`/`codegen.server.ts` — one lane,
and `codegen.server.ts` is also a seam for T5.4/T5.7 — sequence. (4) `dod.test.ts` does not exist; pins live in
`gates.test.ts` / `lesson-writers.test.ts` / `headless.test.ts` — extend one of those or create `dod.test.ts`
deliberately.

**Traps:** Minting from a green-but-unverified path (a UI-shell verdict, no spec) would make `p6-verified` pass
vacuously — the mint's own condition (really-executed tests) is the guard; do not widen it. Re-ordering only the
journey seam leaves `repairTreeDir` deadlocked — the row says both. A fix that mints first and records a FAILED
gate afterwards flips the invariant — the mint may not be used to argue the gate green; the tree-run verdict does
that. Watch `verify.server.ts:1015` ("it NEVER declares the pass") [cited 222 §2 row 7] — keep it that way.

**Verify:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` with the new
case: synthesized project, green tree-run, brief-fit passing, **default** `recordGate` → assert
`outcome==="converged"`, `gate.passed===true`, `lastTest.label==="tested"` + non-empty `evidenceHash`. RED on
today's tree (`failed` with `gate.passed:false` — `223` §4 ran the shape); GREEN after.

**If blocked:** if T0.10's log (the key is owner-side) is unavailable, deliver the C-1 fix + its RED→GREEN test
anyway — this fix is code-verifiable without the key — and leave the M3/M4 *score* leg open; say the score is not
measured.

## ### OV-5 · M9/M7 leg: journey stop + learning baseline read   [M · lane (W15-L3) · BLOCKED-KEY]

**Do it best by:** Two halves. (a) M9 — make the hard-DoD stop terminal in the driver: `run-eval.mjs`'s drain
treats only `{complete, blocked, error}` as terminal (`:692–696` [cited 223 §2 WB-2]) while `headless.ts:587–600`
returns `outcome:"dod"` with `stopped:true` — so a real hard stop reads as progress and spins the 80-round guard.
C-2 fix shape: treat `"dod"` as terminal, set `position:"dod"`, `stall = <hardDodMessage>`, and map it to a code
(`RT_E_GATE_PENDING` is the wild path's own code — reuse, do not invent). Optionally export a pure predicate
(`isTerminalDrainOutcome`) for direct unit testing. (b) M7 — after run #1 exists, a second same-domain run must
report M7=1 **citing run #1's row**: priors come from `history.json` (`run-eval.mjs:72`, `priorFor` :371) and M7 is
`maker-score.ts:567` `m7Learning`.

**Files + seam:** `scripts/run-eval.mjs` (:692–704 drain, :908–913 stop block, :1214 main); `src/lib/headless.ts`
(:587–606 `"dod"` outcome); `src/lib/maker-score.ts` (`m7Learning` :567, `m9OnTime` :604, `scoreMaker` :623);
tests `scripts/run-eval.test.mjs` (exists) + `src/lib/maker-score.test.ts` (exists).

**Reuse (do not rebuild):** pass@k helpers (`run-eval.mjs:427–458` [cited 222]); the `"dod"` outcome message
already produced by `headless.ts`; `history.json` writer.

**Know before you start:** (1) The driver must keep its "results are data, exit 0" contract — a coded stop changes
`position`/`stall`, not the exit semantics. (2) `npm run eval -- --trials=2` is the row's recorded flag form
(`--trials=N`, `:92–93`); the keyless run works today, so M7's *mechanics* are testable now even without the key.
(3) HOT: none of these three files is HOT — free lane. (4) Flaky ≠ averaged (217c): do not average away a flaky
trial.

**Traps:** Adding a new outcome string instead of `"dod"` breaks the one-value contract with `headless.ts:587–606` —
reuse the existing value. A terminal `"dod"` that also advances the cursor silently changes run semantics — a
hard stop stops, nothing advances. M7 with one run must say "insufficient runs — baseline only" (the honest floor
is already in the criterion, `maker-score.ts:567` region) — do not let the fix fake a trend.

**Verify:** pin the predicate/terminal set in `scripts/run-eval.test.mjs` (a case per `RunOutcome` value) +
a scratch probe asserting exactly ONE drain round returns `dod` (the `223` §C-2 test shape); M7:
`npm run eval -- --trials=2` — keyless, **heavy — owner window** — then a second same-domain run's row cites run
#1's (`history.json` diff). RED = today's stall (`position:"stalled"`, `onTime:false`, ~80 no-op rounds).

**If blocked:** land (a) — the terminal-stop fix is code-verifiable now; gate (b) on T0.10 (+OV-3/OV-4) and say the
M7 number is unmeasured.

## ### T0.10 · fresh keyed run #1 — Step 0 (gates everything after it)   [S · OWNER-RUN]

**Do it best by:** The owner (or an agent with the key present) runs exactly the recorded command —
`npm run eval -- --keyed` (recorded at `research/eval-out/_keyed-run.log:2`, WD-C §3 SOUND) — after C-1/C-2 (OV-4/
OV-5 fixes) land if the parent pulls them forward. Then paste the resulting score into `taskuniverselog.md` §5 as
the new T0.10 evidence, and publish it as-is.

**Files + seam:** `research/eval-out/` (regenerated `results.json`, `_keyed-run.log`, per-trial dirs);
`scripts/run-eval.mjs:82` `--keyed`; `package.json:21` the `eval` script.

**Reuse (do not rebuild):** the existing driver; the 09-10 run's artifacts as the shape reference; the
`_keyed-launcher.sh` from 09-10.

**Know before you start:** (1) WB-6 — the driver never marks a run in-progress; if the process is killed mid-run
(the keyed leg needs many minutes of model wall-clock on this 8 GB host), the **stale 2026-09-17 keyless
`results.json` (6/9) stays in place and can be misread as the keyed result**. Cheapest truthful guard: a run-start
marker (touch/rename or a `startedAt` field) before the first entry. (2) No crash-and-no-number point exists —
per-entry throws become 0/9 `status:"error"` rows, exit 0. (3) The keyed leg takes real minutes — do not run it
while five agents share the host.

**Traps:** Reading `results.json` without checking its `mode`/timestamp — the misread WB-6 describes. Treating a
below-keyless score as a model problem: on the current tree it is the WB-1 deadlock's shape (fix first).

**Verify:** the run exists: `_keyed-run.log` shows a fresh timestamp + `mode=keyed`; `results.json` carries a keyed
row with all nine criteria scored; the score is pasted into `taskuniverselog.md` §5. RED = no fresh artifacts.

**If blocked:** do not run it with agents mid-edit; if it cannot run at all, write the run-start marker note so the
stale file cannot be misattributed, and leave the row OWNER-RUN.

## ### OV-8 · keyed run #2 (same domain) + publish + claim flips   [M · OWNER-RUN]

**Do it best by:** Same path as T0.10, same domain (so M7 has a comparable prior). Publish the honest score;
change README/doctor wording **only in the same commit as the evidence that justifies it** (declare-or-strike).

**Files + seam:** `research/eval-out/**`; `README.md`; `taskuniverselog.md`; `history.json` (M7's prior store
`run-eval.mjs:72`).

**Reuse (do not rebuild):** run #1's row as the baseline; `priorFor` :371.

**Know before you start:** (1) Deps: T0.10, OV-3, OV-4, OV-5 — the zeros must close first, else M7 reads noise.
(2) A claim flip without the evidence in the same commit is the one move the honesty contract forbids.

**Traps:** Changing a doc claim to match a hoped-for score before the run lands; running a different domain (breaks
the M7 comparison); editing `results.json` by hand (never).

**Verify:** `npm run eval -- --keyed` output on disk + a `diff` of README claims against `results.json` — each changed
claim traces to a line in the results. RED = a claim changed with no results line.

**If blocked:** leave claims untouched and the row open; publishing late is honest, publishing early is not.

---

# PART 3 · TODO ROWS BY LEVERAGE (key-free unless marked; one lane each)

## ### T-107.6 · token ledger records measured spend at the four free seams   [M · lane (W14-L2) · TODO]

**Do it best by:** Thread ONE `TokenBudget` through the real LLM call sites — the seam exists and has **zero
production callers today** (verified: `token-ledger.ts:294/:320/:339`, and the only hits for
`createTokenBudget|assertBudgetHeadroom|recordBudgetSpend` in `src/lib/*.ts` are in `token-ledger.test.ts`). Insert
at `verify.server.ts:800` (+ retries `:810/:838`, fix call `:1020`), `chat.server.ts:561`, `crew.server.ts:885`.
Copy the landed record-then-signal pattern: `p6TokenCapFromEnv` `codegen.server.ts:2111` / `accountSynthUsage` `:2118`.

**Files + seam:** `src/lib/token-ledger.ts`(+test), `verify.server.ts`(+test), `chat.server.ts`, `crew.server.ts`,
`node-runner.server.ts`(+test), `fixes/216w_token_ledger_seams.md` (body).

**Reuse (do not rebuild):** `recordSpend` :163 / `wouldExceed` :365 / `estimateCostUsd` :237 /
`recordSpendWithinCap` :389; the P6 cap pattern above; the existing ledger shape (byte-identity pinned by 23/23
tests).

**Know before you start:** (1) Invariant: **over-cap refuses BEFORE the wire**; unset cap = no-op; keyless path
byte-identical (216z L2 contract). (2) `recordBudgetSpend` throws **after** recording — spend kept, never clamped
(`token-ledger.test.ts:263`) — call sites must translate that throw into a coded refusal, not a crash. (3) WD-C
flag: only three of the named seam test files exist (`verify.server.test.ts`, `node-runner.server.test.ts`,
`token-ledger.test.ts`); the chat/crew suites are `chat.test.ts` / `crew.test.ts` (both exist — verified today), and
`chat.server.test.ts` / `crew.server.test.ts` are **phantoms**. (4) **node-runner has no budget seam** — no wire
call, no token usage in the file (only the 48 000-char clamp `:74`/`:91`); resolve at dispatch or explicitly strike
it from the row; do not invent a site (222 §6 UNMAPPED cell 1).

**Traps:** Do not add a second budget system or a global singleton — the seam takes the budget as a parameter
(mirror `accountSynthUsage`'s signature). A seam that records spend only on success silently under-counts retries —
place the record where every wire response lands. Byte-identity tests will catch a changed default shape, but only
if you run them.

**Verify:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/token-ledger.test.ts src/lib/verify.server.test.ts src/lib/node-runner.server.test.ts` plus targeted runs of `src/lib/chat.test.ts` and
`src/lib/crew.test.ts` (existing names; WD-C-corrected).

**If blocked:** land the ledger-core + the seams you can prove with runnable suites; for the node-runner cell, write
the finding (no site exists) instead of a fake seam.

## ### OV-1 · provider breadth step 1: env selection + doctor surfacing   [M · lane (W14-L3) · TODO]

**Do it best by:** Implement the deferred list's first item in `registry.ts` — `RAPIDTOOL_PROVIDER` env selection —
which exists **only in comments today** (`registry.ts:36`, `mock.ts:31`; no parser), and surface the provider team in
`doctor` through the existing line (`doctor.ts:360` `line: \`providerTeam: ${label} — ${segments}\``). Unknown
provider id → `RT_E_VALIDATION` refusal; default path byte-identical; keyless ⇒ not-configured (never fabricated).

**Files + seam:** `src/lib/llm/providers/registry.ts`(+test), `src/lib/doctor.ts`(+test).

**Reuse (do not rebuild):** `resolveExplicitProvider` :184 (per-provider namespaces already validate); `PROVIDERS`
:143; `KNOWN_MODEL_IDS` :359 (stays DeepSeek-scoped); `ROLE_TIERS` :240; the descriptor array as the multi-provider
extension point (`registry.ts:141–143` [cited 221]).

**Know before you start:** (1) WD-C §3 SOUND; `registry.test.ts` ran live **21/21** (I re-ran it today — 21/21).
(2) Spec = `101_provider_integration.md` §4. (3) The honesty core for this whole axis: never hardcode an unprobed
vendor's model ids; refusal ≠ substitution (`registry.ts:20–21`, `:29–31` header doctrine).

**Traps:** A silent fallback to DeepSeek when `RAPIDTOOL_PROVIDER` names something unknown is exactly the lie the
header forbids — refuse, don't default. Doctor's label must print what is configured, not what is possible. Don't
widen `KNOWN_MODEL_IDS` to make a second provider "work" — that is step 2's problem, with a probe.

**Verify:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/llm/providers/registry.test.ts src/lib/doctor.test.ts` — both green (both exist; registry 21/21 today).

**If blocked:** ship the doctor surfacing alone (its test is independent) and register the env-selection half.

## ### T-107.7 · checkpoint + `resume` verb   [M · lane (W16-L1) · TODO]

**Do it best by:** Design first — nothing exists to extend: `grep -c 'stateHash\|checkpoint' src/lib/engine.ts` = 0;
`stateHash` = **0 hits repo-wide**; `case "resume"` = 0 hits in the CLI. Closest landed seams: `headless.ts`
`loadProject` :66 / `saveProject` :75 (atomic tmp-write :93, lock :85 [cited 222]), `engine.ts:2089`
`hydrateProject` [cited 222], `io.ts:329 importProject` [cited 222]. The mechanism itself is un-designed (222 §6
UNMAPPED cell 2) — the lane owns the design, then the checkpoint write, then the verb.

**Files + seam:** `src/lib/engine.ts`, `src/lib/types.ts` (persisted shape), `src/lib/headless.ts`,
`scripts/rapidtool-cli.mjs`; test target `src/lib/headless.test.ts` + the targeted kill-mid-P6 → resume probe (name
it at dispatch — WD-C minor).

**Reuse (do not rebuild):** the save/load pair + atomic write; `exportProjectJson` (`io.ts:35` [cited 222]);
deterministic hashing precedent = FNV-1a evidence hashes (integrity, not crypto — AGENTS.md #6).

**Know before you start:** (1) Done-when: kill mid-P6 → resume → **same state hash, same next phase, same
verdict**; a restore is itself a **ledgered event** (`90` Axis 3 item 2). (2) `wild --resume` (`rapidtool-cli.mjs`
:2577 [cited 222]) is wild-mode, NOT run resume — do not rename, reuse, or confuse them. (3) HOT: `engine.ts` and
`rapidtool-cli.mjs` — one lane, sequence with other engine rows.

**Traps:** A hash that includes wall-clock/`Date.now()` never reproduces — pin the exact field set before writing
tests. Resuming by replaying side effects (re-writing artifacts/ledger rows) doubles the paper trail — restore must
be state-only + one new event row. If the kill lands mid-atomic-write, the lock/tmp files decide recovery — test
that case, it is the one a naive implementation misses.

**Verify:** the targeted probe above (kill mid-P6, resume, compare state hash + next phase + verdict) + the lib
targeted run; RED = no verb / no hash. If no probe can be defined in-lane, the row stays open with the design memo
— do not claim resume by prose.

**If blocked:** land design + the deterministic-hash helper + tests; the verb only when the probe passes.

## ### T4.2 · git landing tail: init + commit behind a seat   [M · lane (W15-L4) · TODO]

**Do it best by:** Today there is **no git surface at all**: `src/lib/git.server.ts` absent; `grep -rn 'git
init' src/lib scripts` = 0 hits. Build the module at dispatch-named path (the row says the name is decided at
dispatch), then wire the CLI probe, then `scaffold.ts`(+test). The `.gitignore` half already landed (scaffold.ts:2480
push, :493 content [cited 222]) — extend, don't redo.

**Files + seam:** **new** server module (`src/lib/git.server.ts` absent today — name at dispatch),
`scripts/rapidtool-cli.mjs`, `src/lib/scaffold.ts`(+test).

**Reuse (do not rebuild):** the `scaffold.ts` push pattern (`:2480` block); `write-set.ts` for safe scratch writes;
the policy-seat pattern the CLI's `edit` arm already uses (`rapidtool-cli.mjs:1232–1245` [cited 221]) for the seat
check.

**Know before you start:** (1) Rule: **never write to the user's repo without a seat; scratch-tree only** — the
host repo is itself a git repo (`AGENTS.md`), so an accidental `git init/commit` in the wrong cwd is a real
mutation. (2) Node child-process precedent: the CLI has none (grep = 0) — pick spawn-vs-import deliberately. (3)
Scripts tests that touch platform chrome need temp-dir `cwd` isolation (`AGENTS.md`).

**Traps:** Passing the host repo path through by default; committing with global git config identity differences
(seeds flakiness across machines — set an explicit identity for the scratch repo); ignoring the exit code of git
(the taxonomy's job is to surface it, coded). L2/L3: all paths passed to Node must be Windows-form.

**Verify:** new module test + scratch-dir CLI probe (exact probe named at dispatch — WD-C §3 minor: the record gave
no command; name one, e.g. a `git log --oneline` read-back on a scratch tree, and pin it in the test).

**If blocked:** land the module + unit tests against a temp dir; the CLI arm waits — do not expose a verb that can
touch the host repo before the seat check is tested.

## ### OV-9 · `productComplete` has no producer   [S · lane (next wave) · TODO]

**Do it best by:** Give a real path the ability to mint `productComplete` evidence. Today:
`doctor.ts:167` `productComplete: extra?.productComplete === true && realMulti && !leftover`; the sole caller passes
no `extra` (`headless.ts:3203/:3208` two-arg call [cited 222]); only the unit test sets it (`doctor.test.ts:81–92` —
read today: the all-true conjunction yields `autonomousSoftwareFactory: true`, `gaps: []`). Build the producer from
the evidence the machine actually has, and let `doctor --tree` reflect it honestly.

**Files + seam:** `src/lib/doctor.ts`, `src/lib/headless.ts` (+`doctor.test.ts`); latch machinery `FACTORY_GAP`
:183, conjunction :218–224, `gapsOf` :190+.

**Reuse (do not rebuild):** the factory-claim/latch semantics (pinned at `doctor.test.ts:81–92`); `dod.ts:232`
`archProductComplete` is computed-but-unconsumed (OV-14) — if the producer needs a "product-complete" judgement,
that function is the existing shape, but check OV-14's row first to avoid two surfaces of the same fact.

**Know before you start:** (1) Autoclamation is evidence-latched: all four fields machine-checkable or
human-seat-only ("no soften" — 222 §2 row 26). `productComplete`'s bar as declared includes `humanFixtures` —
a machine path must not mint it (see OV-10). (2) Never mint `decidedBy:"human"` from a machine path.

**Traps:** A producer that sets the field from `realMulti && !leftover` alone widens the latch silently — the
conjunction is the contract. A side effect inside `doctorFactory` (read path) would make a read command write state —
build the producer where evidence is *gathered*, not in the reporter.

**Verify:** extend `src/lib/doctor.test.ts` (latch semantics already proven at :81–92) + targeted run; then a real
path probe (`doctor --tree` on a qualifying tree). If no qualifying tree exists yet, say the producer is unexercised
— that is the honest state.

**If blocked:** land the producer behind the existing conditions + tests; leave the claim side (README/doctor
wording) untouched until a real path exercises it.

## ### OV-14 · `archProductComplete` computed but never surfaced   [S · lane · TODO]

**Do it best by:** Surface the skip≠complete distinction where a consumer can see it (packet and/or CLI). Today:
`dod.ts:232` defines it; the only consumers are `gates.test.ts` (`:11` import, assertions `:932/:939/:1000/:1014/:1028`
— "skip ≠ product-complete"); `dod.ts:546`'s comment notes the vacuum. The distinction is invisible outside tests —
carry it into `packet` (and/or a CLI field) as an explicit value.

**Files + seam:** `src/lib/dod.ts`, `src/lib/packet.ts` (+tests `gates.test.ts`, `packet.test.ts` — both exist).

**Reuse (do not rebuild):** `archProductComplete` itself; the packet's existing block/facts plumbing.

**Know before you start:** (1) HOT: `dod.ts` is not on the W10–W12 list (COLD); `packet.ts` COLD. (2) Declare-or-
strike: a vacuous keyless pass must not read clean once surfaced — that is the point of the change.

**Traps:** Do not recompute the predicate in the packet (call the function); do not make the surfaced value a
pass/fail gate (it is a fact, not a new gate).

**Verify:** extend `gates.test.ts` + `packet.test.ts`; targeted runs of both.

**If blocked:** land the packet surface with its test; the CLI surface, if any, registered separately.

## ### OV-16 · unmaterialised-job truth: doctor scan + emitted README   [S · lane · TODO]

**Do it best by:** Two truth surfaces. (a) `doctor --tree` must surface the *cause* for a non-materialised job
(census `{0,0,0}`, `files:[]` with no visible cause — 219a §5.3 F2); the CLI arm exists (`case "doctor"` :2763, and
its comment at :2765 says the scan "never invents bodies"). (b) the emitted README must not list files that do not
exist unflagged: `scaffold.ts:2037–2040` already emits the unmaterialised-jobs line under the honest-boundaries
section, and `:2061` "## What ships in this scaffold" renders a file table from `files` — the F4 finding is that the
table lists non-existent files while the boundary line says they were never materialised.

**Files + seam:** `src/lib/headless.ts` (doctor scan path — the factory block read today at :3195–3208;
`collectJobSources` :3205), `src/lib/scaffold.ts` (README generation :2035–2075 region); test `src/lib/scaffold.test.ts` (exists).

**Reuse (do not rebuild):** `unmaterialisedJobs` plumbing (`scaffold.ts:1959`, filled :2470/:2540 [read at
:2037–2040 today]); `doctor.inventoryFromJobSources` / `evidenceFromJobInventory` (`headless.ts:3205–3207`).

**Know before you start:** (1) 214's rule in the CLI comment: the scan "never invents bodies". (2) `scaffold.ts` is
HOT — one lane. (3) A fresh emit is needed to see the artifact; do it in scratch.

**Traps:** "Fixing" the README table by removing rows copies the other lie (files that do exist vanish) — mark the
non-existent ones or point the table at the boundary line. Doctor output that says "0 jobs" without the cause
repeats F2.

**Verify:** `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --tree <scratch tree>` (real) + re-emit
+ `node --experimental-strip-types --test --test-concurrency=2 src/lib/scaffold.test.ts` targeted.

**If blocked:** land the README half (self-contained, test-covered) and register the doctor half.

## ### OV-7 · eval-corpus expansion + grader-freeze audit   [M · lane (W16-L3) · TODO]

**Do it best by:** Expand the corpus so M7 is measurable across ≥2 domains, and audit the freeze: graders live in
`research/eval-corpus/graders/` (6 JSON graders on disk today) and load via `run-eval.mjs:260 graderFileFor` /
`:318 loadGrader`; the leak scan `:608 graderLeakScan` is pinned by `scripts/run-eval.test.mjs`.

**Files + seam:** `research/eval-corpus/**`, `scripts/run-eval.mjs`; tests `scripts/run-eval.test.mjs`.

**Reuse (do not rebuild):** the existing 6 brief+grader pairs as the format template; `graderLeakScan`; pass@k
helpers `:427–458` [cited 222].

**Know before you start:** (1) Rule: graders freeze **outside** the agent (107 lesson 5) — a grader written after
seeing the run it grades is not a grader. (2) M7 reads `history.json` by slug — a new domain starts with no prior;
that is honest, but say so. (3) Flaky ≠ averaged.

**Traps:** Editing a grader to make a run pass (never); adding a domain whose brief duplicates an existing one
(defeats "≥2 domains"); a leak scan that only checks the emitted tree misses grader text baked into the *brief*.

**Verify:** `npm run eval -- --trials=2` (real flag; keyless — heavy, owner window) + the grader-freeze check (its
form is to be fixed at dispatch — WD-C's done-when addition).

**If blocked:** land the freeze audit (a read + a test) without corpus expansion; both halves are separable.

## ### G5 · emitted product carries zero RT_E codes   [S · lane (W13 carry) · TODO]

**Do it best by:** Make a fresh emit's generated code surface coded `RT_E_*` failures where it fails. Today:
`scaffold.ts` contains **0** `RT_E` occurrences (grep verified); the emitted-tree count was 0 on the W9 probe tree
(219b-carried; **not re-verified today** — that is why the verify below re-emits).

**Files + seam:** `src/lib/scaffold.ts`, `src/lib/codegen.server.ts` (emitted spec/README templates); probe: fresh
emit via the CLI (`case "emit"` :781).

**Reuse (do not rebuild):** the templates that emit `tests/oracle.spec.ts` / error surfaces; the `errors.ts`
registry as the code source.

**Know before you start:** (1) Invariant I13 — every surfaced failure carries a registered code. (2) Hot files both
— one lane. (3) Emit into scratch, never the repo.

**Traps:** Stamping codes on every file (noise) or on none (status quo); the honest target is *where it fails* —
mirror how the harness's own failure rows carry codes. The emitted tree's tests may be `test.skip` in places
(census lines) — a skipped test is not a failure surface.

**Verify:** fresh emit (CLI `emit`), then `grep -rc "RT_E" <tree>/src <tree>/tests` → > 0 (the pattern from 219b
G5), plus scaffold/codegen targeted runs.

**If blocked:** land the emission change + a scratch emit showing the count > 0; register any template you could
not reach.

## ### TA-21 · P9 deploy artifacts unlabeled   [S · lane · TODO]

**Do it best by:** Label the P9 artifacts as templates. Today: `engine.ts:1027` (`"GitHub Actions workflow"`) and
`:1048` (`"IaC sketch"`) emit canned content with no "template — not executed" marker (219b §1.5 r13; the HITL text
already says "templates").

**Files + seam:** `src/lib/engine.ts` (:1026–1055 region).

**Reuse (do not rebuild):** the B-18-style label pattern (`phases.ts:33`); the artifact `body` strings themselves.

**Know before you start:** (1) HOT: `engine.ts` — sequence with other engine rows. (2) Declare-or-strike: the fix is
a marker in the body (strings), not a new artifact.

**Traps:** Labeling the workflow file's YAML in a way YAML readers treat as a comment-only change may still read as
executable — put the marker where a reader of the artifact sees it, matching the P7/B-18 style.

**Verify:** read the emitted P9 artifact text (a scratch run or the artifact-builder test) + `grep -n 'IaC sketch\|GitHub Actions workflow' src/lib/engine.ts` shows the marker nearby (`:1027`/`:1048` today).

**If blocked:** land the body-marker change; a rendered read-back is the evidence.

## ### DF-04 (residual) · P7 artifact still claims MCP/A2A with no disclaimer   [S · lane · TODO]

**Do it best by:** Strike or label the single claim: `engine.ts:922` (1 hit today, read) still says
"Architectural advantage: deterministic 0–12 graph with HITL, MCP/A2A, and ADRs…" while no MCP module exists
(`find`/grep → none [cited 222]). Pattern for the label: `phases.ts:33` B-18 declaration.

**Files + seam:** `src/lib/engine.ts:922`.

**Reuse (do not rebuild):** the B-18 label wording in `phases.ts:33`; the `dod.ts:426–430` `p3-mcp` probe stays
untouched (contract artifact — do not make a keyless deterministic gate depend on a live server).

**Know before you start:** (1) HOT `engine.ts`; F1/OV-6 touches the same neighbourhood conceptually — keep them
separate lanes. (2) Declare-or-strike: strike reads better than a softened claim if the artifact cannot demo it.

**Traps:** Removing the artifact/making the probe fail would break P3's keyless gate — the fix is text.

**Verify:** `grep -c 'MCP/A2A' src/lib/engine.ts` → 0, or a nearby labeled form (today = 1).

**If blocked:** n/a — text edit with a grep.

## ### OV-18 · clamp marker truncates at custom caps ≈64–118   [S · lane · TODO]

**Do it best by:** Pin the clamp window. `node-runner.server.ts:74` `RUNNER_OUTPUT_MAX_CHARS = 48_000`;
`clampRunnerOutput` `:91`; the registered defect: at custom caps in the ~64–118 window the marked middle elision
degrades (217b §1.4 E1; registered not fixed; no production impact at the real cap).

**Files + seam:** `src/lib/node-runner.server.ts` (:74/:91), `src/lib/honesty-guards.test.ts` (exists).

**Reuse (do not rebuild):** honesty-guards' existing clamp pins (the 48 000 identity is already pinned there);
`elidedChars` accounting on the envelope.

**Know before you start:** (1) The window is **deliberately unpinned** — pinning it is the deliverable. (2) Small
caps must still elide with a **marked** cut + honest count (never silent).

**Traps:** Changing the 48 000 behaviour to fix the small-cap case (the identity is pinned and production-read);
a plateau fix that drops the marker.

**Verify:** extend `src/lib/honesty-guards.test.ts`; `node --experimental-strip-types --test --test-concurrency=2 src/lib/honesty-guards.test.ts`.

**If blocked:** land the test that documents current small-cap behaviour + the finding, mark the row partial.

## ### T5.4 · artifact provenance fields   [S · lane (Phase 5) · TODO]

**Do it best by:** Add a provenance stamp to `Artifact` (`types.ts:41–47` — `{id, phase, kind, title, body,
language?}` today) naming the REAL producer: the model id actually served, or `"deterministic"`. Deterministic
artifacts are never model-stamped; packet + vault render the stamp; old projects load with **no fabricated
provenance** (the `types.ts:187` law: fail closed on contradiction, never invent provenance for old rows).

**Files + seam:** `src/lib/types.ts`, `engine.ts`, `codegen.server.ts`, `packet.ts`, `vault.ts`, `io.ts`; tests
`io.test.ts` + `packet.test.ts` + `codegen.server.test.ts` (all exist).

**Reuse (do not rebuild):** the `route vocabulary` (`types.ts:21` [cited row]); the provenance cross-check pattern
at `types.ts:185–190`; FNV-1a hashing for any evidence stamp.

**Know before you start:** (1) HOT: `engine.ts`, `codegen.server.ts`, `console.tsx`-adjacent files — one lane,
sequence. (2) Deps: nothing blocks it; it blocks T5.7 (replay labels need provenance). (3) Declare-or-strike: a
stamp that guesses the producer is worse than no stamp.

**Traps:** Stamping the *requested* model id instead of the served one; stamping deterministic artifacts with a
model (the row's whole point); breaking legacy parse (the old-projects case is the regression to test).

**Verify:** targeted runs of the three suites above; the legacy-load case asserted in `io.test.ts`.

**If blocked:** land the type + engine/codegen stamping + tests; the vault/packet rendering halves are separable.

## ### T5.7 · deterministic LLM cassette (record/replay)   [M · lane (Phase 5) · TODO]

**Do it best by:** Wrap the single chokepoint — `registry.ts:396 callModel` — with an optional record/replay tape.
No `cassette.ts` exists today; the mock provider is the *injection* half only (do not grow it into a cassette). Tape
key = the deterministic request hash; replay is byte-identical with no network; a miss is a coded refusal (never
fabricated text); OFF by default — existing suites and keyless `npm run eval` stay byte-identical.

**Files + seam:** `src/lib/llm/providers/registry.ts` (seam :396) or **new** `src/lib/cassette.ts`; `scripts/run-eval.mjs`;
CLI flags + tests.

**Reuse (do not rebuild):** the mock provider's boundaries (never in `PROVIDERS` — `registry.ts:143`); FNV-1a for
tape integrity; the keyless floor envelope shape.

**Know before you start:** (1) Deps: T5.4 (replay labels need provenance). (2) The tape must never be consulted on
the default path (off by default is a contract, not a preference). (3) HOT: `registry.ts` also serves OV-1/F2 —
sequence lanes on that file.

**Traps:** A replay that "falls through" to the network on a miss (the exact cheat the coded-refusal rule forbids);
a tape key that includes timestamps/randomness (never replays); recording into the repo by default (scratch/flag).

**Verify:** new unit round-trip + hash-key + miss-refusal tests; keyless `npm run eval` output stays byte-identical
(diff the results).

**If blocked:** land the tape primitive + refusal semantics + tests; wiring into run-eval waits.

## ### T5.1 · streaming output (transport spike first)   [M · lane (Phase 5) · TODO]

**Do it best by:** Spike before building: the transport question is UNKNOWN (217c §2.1) and the provider currently
sends `stream: false` (`deepseek.ts:377` — read today). The spike answers whether incremental tokens can ride the
existing provider contract; only then implement 217c §2.1's done-when 1–4 (incremental tokens; Stop aborts; abort
persists as a coded display row; keyless byte-unchanged; opt-in NDJSON CLI mode; README-cli test green).

**Files + seam:** `src/lib/chat.ts`, `chat.server.ts`, `llm/providers/deepseek.ts:377`, `src/components/console.tsx`
(ChatPane), `rapidtool-cli.mjs`, `README-cli.md` + new tests.

**Reuse (do not rebuild):** the existing chat turn machinery (`chat.server.ts:486` `chatOnceServer` [cited 222]);
the mock provider for keyless tests.

**Know before you start:** (1) Test target is `src/lib/chat.test.ts` — **not** `chat.server.test.ts`, which does
not exist (the phantom-name trap; verified today). (2) Keyless byte-unchanged is a hard done-when. (3) `console.tsx`
is HOT and owned with DF-18/DF-26 — sequence.

**Traps:** A streaming path that changes the non-streaming envelope (byte-diff tests catch it); an abort that
leaves a half-row without a code; shipping streaming without the opt-in CLI mode (217c's done-when 4).

**Verify:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/chat.test.ts` (existing suite) +
the new scripts-leg NDJSON test.

**If blocked:** the spike memo is the deliverable; do not half-wire streaming into the UI.

## ### T5.5 · plugin / hook registry v1 (in-process only)   [M · lane (Phase 5) · TODO]

**Do it best by:** New `src/lib/plugin.ts` (+test) with **explicit registration only**, deterministic hook order,
state-writing hooks routed through the ONE policy seam (`evaluatePolicy`, `policy.ts:170`), and no dynamic loading.
Gated by the isolation outcome being settled (T-107.8 → in-process only). Seam call-sites: `engine.ts`,
`codegen.server.ts`.

**Files + seam:** **new** `src/lib/plugin.ts`(+test); `src/lib/engine.ts`, `src/lib/codegen.server.ts` (call sites).

**Reuse (do not rebuild):** `policy.ts`'s seat model + `PolicyAction` :49; the mock-provider doctrine (explicit
selection only) as the precedent for explicit registration.

**Know before you start:** (1) The word "sandboxed plugin" must appear nowhere (I4/no-isolation claim). (2) HOT:
`engine.ts`/`codegen.server.ts` — sequence. (3) Deps: isolation outcome recorded (T-107.8 settled).

**Traps:** A hook order that depends on Map/object insertion accidents (pin it with a test); a state-writing hook
that bypasses `evaluatePolicy` (the one-seam doctrine); dynamic `import()` of plugin files (out of scope until the
trust question is reconciled).

**Verify:** new `src/lib/plugin.test.ts` (the repo's pure-suite pattern); targeted run.

**If blocked:** land the pure registry + ordering tests; call-site wiring is the separable second half.

## ### OV-6 · interop spike: 35-verb surface as MCP tools?   [M · lane (W15-L5) · RESEARCH-ONLY]

**Do it best by:** A memo, not code: new `research/multiagent/219g_interop_spike.md` (absent today) + a scratch
server outside the repo. The contract artifact exists (`types.ts:27` `"mcp"`, `dod.ts:426–430` `p3-mcp`,
`phases.ts:33` B-18 declaration); the runtime is absent (`find`/grep → none). The memo answers feasibility/cost/
risks with a **real handshake trace or an explicit "could not run X because Y"**; no core edits.

**Files + seam: NO-SEAM-FOUND by design** (222 §2 row 10) — that is the memo's subject.

**Reuse (do not rebuild):** the F1 design's transport finding (`runNodeBounded` cannot host a session — no stdin at
`node-runner.server.ts:314`); the `p3-mcp` probe model for any future probe.

**Know before you start:** (1) RESEARCH-ONLY: the row never closes by prose alone — the trace is the evidence.
(2) Correction to inherit: the count is **7 clones carrying MCP client code** (AUD-2's corrected form), and
ChatDev's `mcp_example/` is a server example *for that client seam*.

**Traps:** Writing capability claims ("RapidTool supports MCP tools") — discovery ≠ capability; a trace that ran
nothing and says "works".

**Verify:** the memo's own trace (a recorded handshake) is the evidence; the file's existence + no core diff.

**If blocked:** the explicit "could not run X because Y" line **is** the honest deliverable.

---

# PART 4 · `UNVERIFIABLE-NOW` ROWS — what must be defined before they can be dispatched

**These rows are honest, not dead.** Each names exactly what is missing; their "how" is *define that first*, then
the row becomes dispatchable. The definition work itself is small and is the deliverable of a first pass.

## ### DF-09 · approval needs no note — even over a failed gate   [S · lane (next wave) · UNVERIFIABLE-NOW]

**What must be defined first (its "how"):** a **defined check** for the guard. Candidate (held back as a suggestion,
not a decision): extend `src/lib/honesty-guards.test.ts` with a case that approves over a failed/overridden gate
without a note → refused, with a note → recorded; defect-proof command is already available:
`grep -n "note:" src/lib/engine.ts`. Name the test and the command in the lane brief before dispatch.

**The defect, on today's bytes:** `approveHitl` (`engine.ts:1625`) takes `note?: string` (`:1629`) and writes it
(`:1663`), but no caller passes one — `store.ts:1530–1534` approves with no note; `console.tsx:1841`
`approve(projectId, { force })`. Rejection alone carries a ≥12-char guard (`store.ts:1547`). The note pattern to
mirror: the autopilot path, `engine.ts:3550`
(`approveHitl(next, { decidedBy: "autopilot", note: decision.feedback.slice(0, 400) })`). Corroborated by
`fixes/123` CG-16.

**Files + seam:** `src/lib/engine.ts` (:1625/:1629/:1663), `src/lib/store.ts` (:1530–1534, :1547),
`src/components/console.tsx` (:1841); test target to be chosen at dispatch (suggestion: `honesty-guards.test.ts`).

**Traps when the lane starts:** the guard must apply to the **failed/overridden-gate** approval path, not to every
approval (an over-broad guard breaks normal HITL flow and the autopilot path that legitimately passes its own note);
`engine.ts:1637` requires an explicit `decidedBy` — never default `"human"`; the UI's `force` path is exactly the
case the guard exists for, so the console must surface the note input rather than the store silently defaulting one.

**Verify (complete once the check is defined):** the chosen test file targeted-run turns RED on today's tree
(approval without a note over a red gate currently succeeds) and GREEN after the guard; plus
`grep -n "note:" src/lib/engine.ts` shows the guard call site.

**If blocked:** the row is blocked *at definition*, not at code — the honest partial is the written check +
dispatch brief; do not patch the guard without it (WD-D's judgement, kept).

## ### T4.3 (+ TA-18) · patch preservation / conflict on user-edited trees   [M · lane (W16-L2) · UNVERIFIABLE-NOW]

**What must be defined first (its "how"):** **a preservation probe** — the record supplies no verification command
(WD-C §3). Suggested shape (fix at dispatch): a scratch tree, a user edit to one emitted file, then the edit/repair
cycle; assert the user edit survives **or** the cycle refuses loudly with a code. Host it as new cases in
`src/lib/patch.test.ts` (exists) plus the CLI probe; name the exact commands in the lane brief.

**The seams, on today's bytes:** `patch.ts:279` `applyStrReplace` (typed refusal `:93`, `PatchKind` `:43`,
`PATCH_MAX_LISTED` `:117`); repair's call site `codegen.server.ts:906`
(`applyStrReplace(input.previous.module, request)`, import `:97`); the edited-dir re-import path
`headless.ts:2486` "Hash-checked re-import of the EDITED dir" + parse-gate `:2630` [cited 222].

**Done-when (unchanged):** an edit cycle over a user-modified tree **either preserves the user edit or refuses
loudly — never silently overwrites**.

**Traps when the lane starts:** `patch.test.ts` today pins only existing behaviour (21 `it(` per 219a r18) —
extending it is necessary but the *probe* is what proves preservation; a `fuzzy` match that lands on a user-edited
region is the silent-overwrite path most likely to slip (the patch primitive re-validates at apply time —
`codegen.server.ts:622` region [cited 222]); `write-set.ts` rollback exists for partial writes — use it.

**Verify (complete once defined):** `node --experimental-strip-types --test --test-concurrency=2 src/lib/patch.test.ts` + the scratch edit-cycle probe (both named at dispatch).

**If blocked:** the definition IS the first half of this row; land it, then dispatch the probe.

## ### G4 · no emitted-tree error scan exists   [S · lane (W13 carry) · UNVERIFIABLE-NOW]

**What must be defined first (its "how"):** the **scan itself and its runner** — they do not exist, and `218` §3.4
owns the definition. Suggested host: `compile-check.server.ts` (or a new scan module), with the pattern from
`scripts/check-assertion-gaps.mjs` (the gate-3 scanner) [cited 222 §2 row 23]. Define: what signal counts (empty
catch / unchecked result / swallowed error), where it runs (on an emitted tree), and its test fixture (a tree with
one known swallow).

**The gap, on today's bytes:** a scan-shaped grep over `compile-check.server.ts` for
`empty catch|unchecked|unhandled|swallow` = **0** (222 re-verified today); "no emitted-tree error scan exists"
(219b §1.2).

**Traps when the lane starts:** the scanner must not be swallowed itself (a scan that errors silently is worse than
none); do not make it a gate that blocks emits (218's carry is a *finding surface*, the TA-12-class signal) unless
the parent says so; grade by signal, not by volume.

**Verify (complete once defined):** a targeted run of the new/extended suite on a fixture tree containing a known
swallow → the finding reported; a clean tree → zero findings.

**If blocked:** the definition memo (scan shape + fixture + runner) is the deliverable; no code lands first.

---

# PART 5 · OWNER ROWS (short blocks — the decision + the evidence that makes it cheap)

**No lane may proceed past these** (`220` §4.4 / §4.7). Each block states what the owner decides and the cheapest
evidence that closes it. These are decisions, not dispatchable work.

## ### T-107.8 · isolation executor: confirm Outcome 2 (claim stays frozen)   [OWNER-DECISION]

**The decision:** confirm Outcome 2 — keep the frozen no-isolator claim; narrate un-isolated runs plainly wherever
execution is narrated. Outcome 1 requires a host change (Docker/VM), not engineering.
**Evidence that makes it cheap (all on disk):** `fixes/217b` §2's raw capture — docker/bwrap → 127, WSL 0 distros →
**NO isolator**; `fixes/217c` §4: Outcome 2 is the only available branch; the frozen claim is
`src/lib/sandbox-policy.ts:13–17/:21/:33/:41` (read today: `sandbox:false`, `docker:false`, `bwrap:false`).
**What flows from it:** OV-12 records the settled probe (Part 1); T5.5's scope settles to in-process only (Part 3).

## ### OV-10 · is "human-approved fixtures" the right bar for "autonomous"?   [OWNER-DECISION]

**The decision:** decide the intended bar for the factory latch; if human-fixtures stays the bar, say so where the
claim lives (`doctor.ts`).
**Evidence:** the latch conjunction at `doctor.ts:218–224` requires `evidence.humanFixtures === true` alongside
`realMultiJobProduct` and `productComplete`; the gap string is `FACTORY_GAP.fixtures` (`:183`); the fixture path
deliberately never mints `decidedBy:"human"` (`brief-fixtures.ts:102–105`), which is why the human click (T5.2-A)
is the only producer of that field's input. (`219c` §6 rank 6.)

## ### OV-11 · make the red seal teach (smallest loop closure)   [OWNER-DECISION]

**The decision:** sign off or decline. T-11 ("a red seal mints no lesson") was a deliberate, owner-signed decision —
the pin at `lesson-writers.test.ts` (:66/:283) must be **deliberately** updated, never "fixed".
**Scope if approved (≈6 call-site lines + ≈4 seam lines):** branch `engine.ts:1452–1497` (the GREEN-SEAL GATE
comment + `sealLogs` :1463, the `if (!r.pass) {` branch :1466); the `LessonSurface` seam `engine.ts:63–67`
(static import forbidden — node:fs) + type `:68`; the lesson builder `knowledge.ts:1340`
`failureLessonFromRecord` (its refuse floor stays); a red seal mints **ONE** `gate-unmet` lesson row carrying
`probe:<id>` tags; `selectLessons` (`knowledge.ts:1012`) returns it.
**Cheapest check today:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/lesson-writers.test.ts` → **18/18 pass today** (I ran it) — the suite whose pins change; plus a `selectLessons` probe.
**Why it matters:** today a red seal's log is not lesson-tagged, so `selectLessons` cannot see it — the loop's
teacher is muted (`219d`, hop 6).

## ### D-1 (T5.6) · TS-only boundary: declare it, or build multi-language?   [OWNER-DECISION]

**The decision:** Option A (recommended, S) — a posture line states the TS-only boundary (optionally with a
doc-contract test); Option B (L) — a language registry, which multiplies the isolation surface.
**Evidence:** README has **0** hits for `multi-language|Python|tenant` (I re-ran the grep today); behaviour is
TS-only (`scaffold.ts:76` `ProjectKind` + the tsconfig emitter [cited 222]); "the boundary is NOT stated anywhere"
(217c §3).

## ### D-2 (T5.8) · local-first posture statement (auth stays latent)   [OWNER-DECISION]

**The decision:** Option A (S) — the README states the local-first single-tenant posture honestly; Option B (L) —
accounts/storage. Auth stays latent either way until decided.
**Evidence:** 10 auth modules + a migration exist (`src/lib/auth/`, `migrations/auth/0001_auth.sql` [cited 222]);
the README says nothing about auth/tenant (my grep for `auth` in README = **0** lines today); the `94:201`
acceptance item is unmet [cited].

## ### T3.6 · `format:check` + verification wiring (needs user consent)   [OWNER-DECISION]

**The decision:** approve adding a `format:check` script and using it in the verification recipe (needs **user
consent** — `.hermes/environment.json` is the user's environment config).
**Evidence / the hazard:** `package.json:22` `"format": "prettier --write ."`; `.hermes/environment.json`'s **`test`**
recipe includes `"npm run format"` (read today, lines 10–20) — the destructive write-mode command. Rule: **do not run
`hermes verify` as-is**, and never run repo-wide format while lanes are mid-write (L4).
**Verify (post-approval):** `npm run format:check` exists and passes; the recipe references the check, not the write.

---

# THE THREE ROWS A FIRST-TIME LANE SHOULD TAKE (the gentlest real on-ramp)

1. **OV-12 — the register's stale UNKNOWN slots.** Text-only, one file (`fixes/217c…md`), zero code risk, and a
   mechanical verification (`grep` for the stale strings). It teaches the two house disciplines cheaply:
   the settled-vs-unknown distinction and how to edit a declared slot without breaking append-only history.
2. **OV-14 — surface `archProductComplete`.** Both files (`dod.ts`, `packet.ts`) are **COLD** (no HOT contention),
   the predicate already exists, both test targets (`gates.test.ts`, `packet.test.ts`) already exist and already
   pin the semantics — the lane adds a consumer, not a mechanism. Its verification is a targeted run.
3. **TASK-01 — `nextAction` on the summary envelope.** The first real code row: a pure addition to ONE producer
   (`headless.ts:985`), a mirror to transcribe (`console.tsx:311`), a suite that exists (`headless.test.ts`), and a
   grep + targeted-run verification with no key, no browser, no UI. It is also the highest-leverage W14 row (the plan
   ranks it #1), so the on-ramp is real work, not a warm-up.

*(Fine alternates if the three above are taken: DF-04 or TA-21 — both are one-string truth edits — but both live in
`engine.ts`, a HOT file; take them only when `engine.ts` is free.)*

# COVERAGE & HONEST LIMITS OF THIS PLAYBOOK

- **All 42 rows have a block.** Depth is deliberately uneven: the first-48-hours rows and the `BLOCKED-KEY` rows
  carry the deepest treatment (they are dispatched first); `OWNER-*` rows are short by design (a decision plus its
  cheapest evidence); `UNVERIFIABLE-NOW` rows state the definition that unblocks them.
- **What I opened vs what I cite:** every `file:line` in §1 was read in this session; anchors marked `[cited: …]`
  come from `222`/`223` (both written today by agents with their own live-read provenance) and were **not** re-opened
  by me — the executing lane should open them before building on them (the repo's own habit: "re-read at dispatch
  rather than trust any dossier, including this one" — 222 §6).
- **I did not run the Verify commands** — they are the executing lanes' proof; what I ran is in §0 (two suites,
  18/18 and 21/21, plus read-only greps). No keyed, browser, or npm-script command was executed.
- **Known live drift to expect at dispatch** (this is why lanes re-read): the 222/223 citations were right at their
  write time; today's re-read already corrected `codegen.server.ts` `accountSynthUsage` `:2120`→`:2118`,
  `crew.server.ts` `callModel` `:895`→`:885`, and `node-runner.server.ts` stdio `:310`→`:314`.
- **Ordering note:** the wave plan asks for first-48-hours rows first; this file groups by priority (48 h → keyed →
  TODO → unverifiable → owner) rather than strict id order, and the index in §3 makes the mapping explicit.

*End of PLAYBOOK-A deliverable (230_task_execution_playbook.md).*
