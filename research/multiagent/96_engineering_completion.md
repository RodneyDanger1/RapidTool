# 96 — ENGINEERING COMPLETION CHECKLIST (finish-the-job plan)

- **File:** `research/multiagent/96_engineering_completion.md`
- **Author:** Flash planner A3 — engineering-completion lane · 2026-09-06
- **Mode:** STRICTLY READ-ONLY on all source. Every claim below was verified on disk this pass
  (`C:/Users/mnril/Desktop/RapidTool Main`). This file is the only output.
- **Wave-aware baseline:** three Pro fixers (`deleg_ee964d63`) are STILL EDITING `src/lib`
  (lanes: P0 pipeline / self-learning loop / UX). Their gates may be transiently red.
  This checklist baselines on the **LAST KNOWN GREEN** and treats current readings as
  evidence, not as final numbers:

  | Gate | Last known green (parent-provided) | Read this pass (transient, wave mid-flight) |
  |---|---|---|
  | Tests (src leg) | **1061 tests / 1060 pass / 1 skip** | not re-run (wave editing) |
  | Typecheck | **0 errors** | not re-run |
  | Lint | **0 errors** | 0 errors / **9 warnings** (see §3 — 7 of 9 are wave-transient or debris) |
  | Build (`vite build` + `db:migrate`) | **exit 0** | not re-run |
  | Scripts leg (Windows) | **10 known failures** (parent) | **verified: exactly 10 red** (§2) |

  **All counts in §7/§8 are `TBD-post-wave`** — the final scorecard numbers must be
  re-read after the fixer wave lands. Nothing here is a promise of a current count.

---

## 0. The four gates as they actually run (verified `package.json`)

| Gate | Command | What "green" means |
|---|---|---|
| Test leg 1 (scripts) | `node --test "scripts/**/*.test.mjs"` | 0 fail (9 files, 197 test cases) |
| Test leg 2 (src) | `node --experimental-strip-types --test "src/lib/*.test.ts" "src/lib/app-data/app-data.test.ts" "src/lib/auth/*.test.ts"` | 0 fail, ≤2 documented skips |
| Typecheck | `tsc --noEmit` | 0 errors |
| Lint | `eslint .` | 0 errors, **target 0 warnings** (§3) |
| Build | `vite build && npm run db:migrate` | exit 0, bundle produced |

**Structural fact:** `npm test` runs the scripts leg FIRST and `&&`-chains the src leg.
On this Windows box the scripts leg currently fails (10 red), so **`npm test` never
reaches the src leg today**. Fixing §2 is therefore the first item of any completion
order, not a parallel nice-to-have.

---

## 1. Test-suite inventory + coverage map (verified per-file this pass)

### 1.1 Scripts leg — `scripts/*.test.mjs` (9 files, 197 `test()` occurrences)

| File | tests | Status (this pass, Windows) |
|---|---|---|
| `brand-check.test.mjs` | 31 | pass |
| `browser-smoke-verdict.test.mjs` | 40 | pass |
| `check-auth-invariant.test.mjs` | 11 | **1 fail** (symlink EPERM, test 11) |
| `grok-pwa-plugin.test.mjs` | 47 | **8 fail** (identity-leak, tests 9/21/25/26/27/29/30/33) |
| `migration-plan.test.mjs` | 7 | pass |
| `preview.test.mjs` | 20 | pass |
| `sign-out-plan.test.mjs` | 18 | pass |
| `with-app-env.test.mjs` | 12 | **1 fail** (symlink EPERM, test 23) |
| `write-atomic.test.mjs` | 11 | pass |

### 1.2 Src leg — `src/lib/*.test.ts` (48 files) + `app-data` + `auth`

Counts (verified `test(`/`it(` occurrences per file): algo-tools 17 · algorithms 46 ·
arch-tools 13 · ast-mine 8 · bench 22 · chat 31 · crew 38 · design 21 · diagram 34 ·
errors 23 · exec 20 · fixtures 5 · gate-stats 13 · gates 56 · handoff 13 · harvest 33 ·
headless 46 · io 26 · knowledge 17 · llm-tasks 17 · llm 14 · packet 40 · phases 10 ·
planning 16 · preview-host-bridge 13 · prompt-engine 22 · render 34 · report-intake 22 ·
research 11 · sandbox 25 · scaffold 31 · store 54 · swarm 32 · sweep73-fuzz 52 ·
tracing 23 · vault 31 · vector 36 · verify 25 · watcher 7 · websearch 11 · wild-step 6 ·
app-data 23 · auth/gate-identity 26 · auth/sign-in-gate 3. Sum ≈ the 1061 baseline.

### 1.3 Coverage map — who imports whom (verified import-graph this pass)

**Well covered (dedicated suite + cross-suite fuzz):**
algorithms, arch-tools, algo-tools, ast-mine, bench, chat (+chat.server), crew
(+crew.server), deepseek.server (llm + llm-tasks), design, diagram, dod (gates +
headless), engine (7 suites: arch-tools, chat, gates, io, packet, store, wild-step —
integration-heavy, no dedicated engine suite), errors, exec (+node-runner.server), gates,
handoff, harvest, headless, io, knowledge, llm, llm-tasks, packet, phases, planning,
preview-host-bridge (+preview-embedder-origin), prompt-engine (+templates), render,
report-intake, research (+tavily.server), sandbox, scaffold, store, swarm, sweep73-fuzz
(+wild-mode.server), tracing, vault, vector, verify (+verify.server), watcher, websearch
(+websearch.server), wild-step, app-data/client.server+types+login+errors.

**Zero direct test coverage (no test file imports them — verified):**

| Module | Risk note |
|---|---|
| `src/lib/db.ts` | DB layer — exercised only indirectly via store/headless |
| `src/lib/multiplayer/index.ts`, `multiplayer/p2p.ts` | entire multiplayer feature untested |
| `src/lib/error-component.tsx` | error UI component |
| `src/lib/app-data/server-only.ts`, `app-data/index.ts` | partial only |
| `src/lib/auth/*` — 15+ files: client, email-password, gate-session-marker, gate-session.server, gates.tsx, isolation.server, middleware, pglite-dialect, popup.server, preview, provider(s).tsx, server, use-current-user, verify.server | only `gate-identity.server` + `sign-in-gate.ts` have suites; the auth server stack + React gates are untested |
| `server/middleware/grok-pwa.ts` | deployed-app half of the PWA chrome; the dev half IS tested (scripts leg) — deployed half has no test anywhere |
| `src/components/console.tsx`, `src/components/preview-host-bridge.tsx`, `src/routes/*` | all React UI untested (only the lib-side bridge logic is tested) |

**Thin suites (fragile surface / low assertion density):**
watcher 7 · wild-step 6 · fixtures 5 · ast-mine 8 · phases 10 · sign-in-gate 3 ·
research 11 · websearch 11.

**Root debris (cleanup candidates, verified present):**
`probe-f6.ts`, `probe-r5-misc.ts`, `probe-r5-vector.ts`, `probe2.test.ts`,
`probe3.test.ts`, `probe4.test.ts` (the three `probeN.test.ts` contain **zero** tests),
`debug.log`, `build.json` (E2E artifact, not source).

---

## 2. The 10 scripts-leg failures — root causes verified + fix plan

### 2.1 Eight `grok-pwa-plugin.test.mjs` failures — identity leak via default cwd

**Verified root cause (not Windows-specific, but red on this Windows box):**
`scripts/grok-pwa-shared.mjs` defaults every identity probe to
`cwd = process.cwd()` (`readOgSite` :245, `ogCardPublicPath` :256, `snapshotOgIdentity`
:269, `resolveOgCardAsset` :325). The repo root itself **is a RapidTool project**:
`src/lib/og/site.json` = `{"title":"RapidTool","description":"autonomous software
agency",...}` and `public/og.jpg` exists (both verified on disk). The 8 failing tests
call `injectGrokPwaHead(...)` **without an isolated `cwd`**, so the repo's own identity
"RapidTool" and its `public/og.jpg` leak in and beat the expected document-title /
host-slug / placeholder output:

| # | test name (line) | expected | actual (leaked) |
|---|---|---|---|
| 9 | share-card overwrite keeps og:title (105) | `og:title="Hello World"` | `og:title="RapidTool"` |
| 21 | grok.me slug title fallback (246) | `Wild Race` | `RapidTool` |
| 25 | og:image public-host/custom-card (305) | `og.grok.me/v1/card.png?...` placeholder | repo's `public/og.jpg` URL |
| 26 | placeholder appends 6-digit color (326) | `...&color=FF4D2E` | repo's `public/og.jpg` URL |
| 27 | title entities not double-escaped (349) | `Cats &amp; Dogs` | `RapidTool` |
| 29 | injects into documents with no head (365) | `og:title="Solo"` | `RapidTool` |
| 30 | streaming injector case-insensitive `</HEAD>` (—) | (case-insensitive match) | identity leak corrupts expected string |
| 33 | uses app name in injected title tag (—) | app-name title | `RapidTool` beats it |

**The 39 passing tests prove the intended pattern:** identity-sensitive tests already
pass `cwd: mkdtempSync(join(tmpdir(), ...))` (e.g. the "baked site.image" / "public card
wins" / `resolveOgCardAsset` tests at :141-:210). The 8 failing tests simply **omit the
isolation** that their siblings use. This is a test bug, not a product bug — product
precedence (site.json title > document title; disk card > placeholder) is intended and
is separately asserted by the passing tests.

**Fix plan (test-only, ~8 one-line changes):**
1. Add `cwd: mkdtempSync(join(tmpdir(), "<name>-"))` to the context object in tests
   9, 21, 25, 26, 27, 29, 30, 33 — matching the passing siblings' pattern verbatim.
2. **Do not** change `grok-pwa-shared.mjs` defaults — real apps rely on `process.cwd()`
   resolution; isolating the default would break `server/middleware/grok-pwa.ts` behavior.
3. Re-run `node --test scripts/grok-pwa-plugin.test.mjs` → expect 47/47 pass.
   **Acceptance:** 47 pass / 0 fail on Windows AND Linux (cwd-default behavior is
   OS-independent; a Linux CI run would have failed these 8 identically).

**Honest-gate alternative (only if the wave forbids touching scripts/):** add a
`README-cli.md`-style note + `scripts/grok-pwa-plugin.test.mjs` top-comment documenting
the 8 known failures with the root cause; leave the leg red. **Not recommended** — the
fix is mechanical and low-risk.

### 2.2 Two symlink EPERM failures — Windows privileges

**Verified:** `check-auth-invariant.test.mjs:102` and `with-app-env.test.mjs:120` call
`symlinkSync(join(projectRoot(), "scripts"), link)` into `%TEMP%`. On Windows without
Developer Mode/admin, `symlinkSync` (even directory→directory) throws
`EPERM: operation not permitted` (verified: both fail with exactly this error).

**These two tests encode real bugs they guard against** (the no-op-through-symlink exit
0 regression) — do NOT delete them; make them runnable:

1. **Preferred fix:** use a junction — `symlinkSync(target, link, "junction")` for the
   directory links. Junctions need no privilege on Windows and still exercise
   `process.argv[1]`-via-reparse-point. Wrap: `try { symlinkSync(t, l, process.platform === "win32" ? "junction" : undefined) } catch ...` — one line per file.
2. **Fallback gate:** on `EPERM`, `t.skip("symlink test needs Developer Mode on Windows")`
   — counts as a documented skip, never a silent pass.
3. **Acceptance:** both tests pass on Windows (junction) or skip with the exact reason
   string; `check-auth-invariant.test.mjs` = 11/11, `with-app-env.test.mjs` = 12/12.

**Note:** on Linux these two already pass (real symlinks are unprivileged) — this pair
is the only genuinely Windows-only failure of the 10.

---

## 3. Lint warnings — the 9 known, triaged (verified `eslint .` this pass)

`✖ 9 problems (0 errors, 9 warnings)` — all `@typescript-eslint/no-unused-vars`:

| # | file:line | symbol | Attribution |
|---|---|---|---|
| 1-3 | `probe-f6.ts:2,2,7` | `writeFileSync`, `readFileSync`, `traceSpan` | **root debris** — delete file (§1.3) |
| 4 | `src/lib/engine.ts:15` | `b18Tail` | **P0 lane mid-flight** — the P-A fixer added the capability-ledger export (`fixes/100_profix_P0.md` P0-04) and hasn't consumed it yet; wave-transient |
| 5 | `src/lib/store.test.ts:12` | `hydrateProject` | wave-transient (store lane edits) |
| 6-9 | `src/lib/vault.ts:117,127,133,140` | `strField`, `tsField`, `row`, `rowsOf` | **P-B loop lane mid-flight** — `vault.ts` is P-B-owned (`fixes/101_profix_loop.md`); helpers added, consumers pending; wave-transient |

**Clear plan:** (a) wave lanes consume their own exports → 4+5+6-9 resolve to 0;
(b) delete `probe-f6.ts` → 1-3 resolve; (c) final sweep: `npm run lint` must print
**0 errors AND 0 warnings** for "done" — the scorecard is stricter than the current
config default (warnings allowed today).

---

## 4. fixes/ docs (100-108) + research dossiers inventory (verified file listing)

### 4.1 fixes/ — 48 files on disk; the 100-series state

| File | Status (verified this pass) |
|---|---|
| `fixes/97_leap_analysis_P0.md` | **on disk, live** — ANALYZER H-A P0 specs (append-only, §0 truth table populated) |
| `fixes/98_leap_analysis_loop.md` | on disk — ANALYZER H-B loop specs |
| `fixes/99_leap_analysis_ux.md` | on disk — ANALYZER H-C UX specs |
| `fixes/100_profix_P0.md` | **on disk, live** — P-A application log: spec map + 5 corrections written; `<!-- FIXES -->` section still empty at read time (fixes landing) |
| `fixes/101_profix_loop.md` | **on disk, live** — P-B: baseline recorded (105 lane tests green), Applied-specs table empty (`waiting on 98`) |
| `fixes/102…108` | **NOT on disk** at read time — the "partially written" series: these are the remaining lane logs (P-ux, convergence, docs, scripts-leg, warnings, etc.). They must be created by their fixers as work lands, matching the 100/101 format (ownership, baseline, applied-specs table, corrections, fix log with file:line). |
| `fixes/109_*` | **NOT on disk** — runtime-log system, in design (§5). |

**Completion criteria for the series:** every landed fix has a file:line entry in its
lane doc; every consumed analyzer spec (97/98/99) has a corresponding applied row in
100-108; no doc claims a fix without a test name (§4.2 guardrail below).

**Guardrail idea worth adding (from 90 §13.6, verified pattern exists as
`scripts/check-auth-invariant.mjs`):** `scripts/check-fix-register.mjs` — fails CI when a
`fixes/*.md` entry lacks a `regression-test:` field naming a real test case. Converts the
postmortem→guardrail rule from prose to a gate.

### 4.2 research/ dossiers inventory (verified)

- `research/`: `01_parallel_repos_research.md`, `02_industry_sdlc_grading_research.md`,
  `03_tech_deep_dives_research.md`, `deepseek-api.md`, `runtime-integration.md` — all on
  disk.
- `research/multiagent/`: **50 files** — numbered series 01-43 (with gaps), 86-93
  (86 kanban · 87 renamepro · 88 statkit · 89 self-learning · 90 LEAPFROG · 91/92
  software-types · 93 design-flaws), + `vault-notes-sample.md`. **94 and 95 are absent
  at read time** (in-flight by sibling Flash planners); **96 = this file**.
- **E2E evidence on disk (scorecard inputs):** `packet-e2e.md` (2026-09-06T00:32),
  `arch-e2e.svg` / `design-e2e.html` / `flow-e2e.svg` (00:49), `vault-e2e/` (ADR-style
  notes from a full P0→P12 CLI run), `screenshots/*.json` verdict files (browser smoke:
  200s, zero console errors, built/preview body-text hash parity, `brandWarnings: []`,
  `authWarnings: []` — all previously green, per `agentnotes.md` PART 0).

---

## 5. Runtime-log system (fixes/109) — status + completion path

**Status:** design-only. No `fixes/109*` file, no `runtime-log*` module on disk
(verified). The design anchors exist in `research/multiagent/90_LEAPFROG.md` §13.5
(verified lines 972-980), constrained by C-1: **no server-side fs** — a hosted
RapidTool cannot append to a log file.

**Assets already on disk that the system must reuse (verified):**
- `errors.ts` — additive-only machine codes `RT_E_*` with test-enforced doc sync.
- `tracing.ts` — frozen v1 span-tree schema, pure/in-memory, redacted-by-construction;
  recorder NOT wired at the three real call sites (engine phase step, crew turn,
  verify pass) per 90 §10.1 P1-2.
- `gate-stats.ts` — GateHealth `ok|fast|rubber` SLI from the HITL journal.
- `headless.ts` approve/reject + the CLI JSON envelope (`schema_version`, `cmd`,
  `exit_code`, `code`) — the natural log carrier.

**Completion path (phased, each phase = a gate-green increment):**
1. **fixes/109 spec doc** — SLI list + error budget (0 unmet-gate advances/window per
   90 §13.5 #1), log schema frozen in the doc before code.
2. **Pure module** `src/lib/runtime-log.ts` — ring buffer (bounded, e.g. 2k events),
   `append({span | code | gate | decision})`, `snapshot()`, `since(ts)` — pure,
   no fs, fully unit-tested. Mirrors `tracing.ts` style.
3. **Wire the three call sites** — engine phase step, crew turn, verify pass → feed
   `tracing.ts` recorder + runtime-log. 1 test per call site asserting an event lands.
4. **CLI surface** — `rapidtool-cli.mjs log --project x [--tail N] [--json]` reads the
   project's ledger + runtime-log and prints the JSON envelope (agent-parseable).
5. **UI surface** (optional, P2) — console.tsx diagnostics row/panel.
6. **Budgets as a gate** — `scripts/check-error-budget.mjs` (pattern:
   `check-auth-invariant.mjs`) fails when unmet-gate-advance rate > 0 in a run's log.

**Acceptance for "109 done":** module + wiring tested (≥15 new tests), CLI subcommand
smoke-tested in the CLI matrix, budget script has a red and a green test, 0 new lint
warnings.

---

## 6. Flakiness risks + the stability CI-equivalent

### 6.1 Known flaky surface (verified reads)

| Suite | Risk | Evidence |
|---|---|---|
| `watcher.test.ts` (7) | real fs watcher + 60ms debounce + 15ms `until()` polling, 2.5-4s timeouts | header + `FAST = {debounceMs: 60}`; delivery order of fs events explicitly unpromised (test 1 comment) |
| `exec.test.ts` (20) | real node child spawns: kill timing, pipe-holding grandchild, KILL_GRACE settle, 1MB stdout cap | `{skip: !runnerAvailable()}` gates (9 tests); Windows child-kill needs `taskkill /T /F` (node-runner.server.ts:70 comment) |
| `harvest.test.ts:227` | real 15ms timer "burn past the 1ms budget deterministically" | timing assertion |
| `store.test.ts:43` | real 10ms timer | timing assertion |
| `headless.test.ts:464` | spawns the real CLI (`scripts/rapidtool-cli.mjs` via `node --experimental-strip-types`) — slowest suite, machine-load sensitive | CLI_ENTRY verified |
| `verify.test.ts` | runner-gated real case runs | `{skip: !available}` :47 |
| Whole-leg | `node --test` runs test FILES concurrently by default — CPU contention on Windows | standard runner behavior |

### 6.2 Stability gate — new script spec: `scripts/stability-gate.mjs`

The repo has **no** stability/orchestration script today (verified: scripts/ contains
only the 9 tested tools + cli/smoke/migrate/preview infra). Spec for the completion
wave (new file, scripts-leg tested like its siblings):

1. **Run the four gates in order:** scripts leg → src leg → `tsc --noEmit` → `eslint .`
   → `vite build && npm run db:migrate` (build last: it is the slowest and the least
   diagnostic on failure).
2. **Double-run:** re-run both test legs a second time in the same invocation; fail on
   any test that passes run 1 and fails run 2 (flake detector) — exit 3 with the
   failing test names, distinct from a hard-fail exit 1.
3. **Retry policy:** a *named, allow-listed* flaky suite (watcher, exec) may auto-retry
   once on timeout-only failure; the retry is logged in the verdict JSON.
4. **Repeat mode:** `--repeat N` runs the whole gate N times (CI nightly); the parent
   gate runs it with `--repeat 3` before signing "done".
5. **Verdict:** single JSON to stdout — `{ok, gates: {tests1, tests2, typecheck, lint,
   build}, flakes: [], skips: n, wallMs}` — parseable by the orchestrator.
6. **Script-leg test for itself:** `stability-gate.test.mjs` (a fake four-gate fixture
   that fails/flakes) — the gate must itself be tested, matching repo convention.

**Acceptance:** 3 consecutive `--repeat 3` runs with `ok:true`, `flakes:[]` and
skip count ≤ 2 (documented reasons only).

---

## 7. Final quality scorecard — every row must be green for "done"

> Numbers marked **[wave]** must be re-read after the fixer wave lands; the parent's
> last-known-green is the floor, not the target (the wave adds tests, so counts rise).

| # | Gate | Done = | Last known | Post-wave target |
|---|---|---|---|---|
| 1 | Scripts leg | 9/9 files green | 10 fail | **0 fail, 0 skip** (§2) |
| 2 | Src leg | 0 fail | 1061/1060/1 | **0 fail, ≤2 documented skips** [wave] |
| 3 | Typecheck | `tsc --noEmit` clean | 0 | **0** [wave] |
| 4 | Lint | 0 errors **and 0 warnings** | 0 err / 9 warn | **0/0** (§3) |
| 5 | Build | `vite build` + `db:migrate` exit 0 | 0 | **0** |
| 6 | Browser smoke | `scripts/browser-smoke.mjs` on built (8081) + preview (8080): HTTP 200, 0 console errors, 0 page errors, no horizontal overflow, `brandWarnings: []`, `authWarnings: []`, built/preview `bodyTextHash` parity, `divergesFromBaseline:false` | previously green (agentnotes PART 0) | **green re-run** |
| 7 | CLI matrix | 27 subcommands (`create run gate approve reject retry ingest packet export summary vault search crew verify design diagram artifacts doctor harvest swarm prompt bench mine knowledge wild chat deepen`) each smoke-invoked ≥1× via `node --experimental-strip-types scripts/rapidtool-cli.mjs`, JSON envelope valid, exit-code taxonomy correct | full P0→P12 E2E artifacts on disk (packet-e2e.md 09-06) | **fresh E2E run + matrix table in fixes doc** |
| 8 | Stability | `scripts/stability-gate.mjs --repeat 3` ×3 consecutive clean | n/a | **ok:true, flakes:[]** (§6.2) |
| 9 | Coverage floor | no module with zero importers except explicitly-declared P2 list | — | **db.ts + multiplayer + auth stack either tested or listed as accepted-debt in fixes/10x** (§1.3) |
| 10 | Debris | root probes + `probeN.test.ts` + `debug.log` removed | present | **gone** |

---

## 8. Ordered completion checklist (single order, acceptance per item)

> Order is dependency-driven: items 1-3 unblock `npm test` on Windows; 4-6 land with
> the wave; 7-10 are the finishing pass; 11 is the final sign-off.

| Step | Item | Acceptance criteria |
|---|---|---|
| **1** | Fix the 8 grok-pwa test identity leaks (test-only `cwd` isolation, §2.1) | `grok-pwa-plugin.test.mjs` 47/47 on Windows; zero product-code changes |
| **2** | Fix the 2 symlink tests (junction / documented skip, §2.2) | both files green or skip-with-reason on Windows; pass on Linux |
| **3** | Verify scripts leg | `node --test "scripts/**/*.test.mjs"` → 9/9 files, 0 fail |
| **4** | Let the fixer wave land; re-baseline src leg | each lane doc (100/101/…) records file:line fix log + test names; full src leg 0 fail / ≤2 skips [wave count] |
| **5** | Clear all 9 lint warnings (§3) | delete `probe-f6.ts`; wave consumes `b18Tail`, `hydrateProject`, vault helpers; `eslint .` → 0 errors / 0 warnings |
| **6** | Close coverage gaps or formally defer (§1.3) | every zero-importer module either gains a suite (min: db.ts smoke, multiplayer/p2p, one auth gate path, `server/middleware/grok-pwa.ts` parity test vs the dev half) or is listed in a fixes doc as accepted debt with a reason |
| **7** | Write `fixes/109` + land runtime-log phases 1-4 (§5) | spec doc + pure module + 3 wired call sites + CLI `log` subcommand, ≥15 new tests |
| **8** | Build the stability gate + its test (§6.2) | `stability-gate.mjs` + `.test.mjs` green; 3× `--repeat 3` clean |
| **9** | Finish fixes/102-108 lane docs (§4.1) | every landed fix has file:line + regression-test name; 97/98/99 specs fully mapped to applied rows |
| **10** | Full scorecard run (§7 rows 1-10) | one fresh invocation of the four gates + browser smoke + CLI matrix E2E + stability triple-run, results pasted into the fixes doc that closes the series |
| **11** | Debris sweep (§1.3) + final sign-off | probes/`debug.log` removed; `git`-less repo: `build.json` regenerated as the fresh E2E artifact; this checklist's rows ticked with real numbers |

---

## Appendix — verification log (everything re-checked on disk this pass)

- `package.json` scripts (test/typecheck/lint/build) — read verbatim.
- 10 scripts-leg failures reproduced: `grok-pwa-plugin.test.mjs` 39/47 (fails 9, 21, 25,
  26, 27, 29, 30, 33 with leaked "RapidTool" identity); `check-auth-invariant` +1 EPERM
  (test 11); `with-app-env` +1 EPERM (test 23).
- `src/lib/og/site.json` (`RapidTool` / `autonomous software agency`) + `public/og.jpg`
  exist at repo root — the leak source. `grok-pwa-shared.mjs` defaults cwd →
  `process.cwd()` (:245, :256, :269, :325).
- `eslint .` → exactly 9 warnings, file:line listed in §3.
- Coverage import-graph computed programmatically over all 56 test files (patterns with
  and without `.ts` extension).
- fixes/ = 48 files; 97/98/99/100/101 live (100/101 fix-log/applied sections still
  empty — wave mid-flight); 102-109 absent.
- research/ = 5 dossiers; multiagent = 50 files; 94/95 absent (siblings in flight).
- E2E artifacts dated 2026-09-06 (packet-e2e 00:32Z, e2e svg/html 00:49Z);
  screenshots/*.json browser-smoke verdicts green per agentnotes PART 0.
- Flaky-surface reads: watcher FAST debounce + `until()` poll, exec skip-gates +
  Windows taskkill comment, harvest:227 15ms burn, store:43 10ms, headless:464 real
  CLI spawn. No existing stability/gate orchestrator script on disk.
