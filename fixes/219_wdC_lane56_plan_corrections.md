# fixes/219 · WATCHDOG C — lanes 5 & 6 (gap answer + plan; competitor codebases): verification + corrections

**WD-C** · 2026-09-24 · watch window 11:19 → 11:45 · read `wave_plans/W13/wd-c.md` first, followed it in order.
**Watched artifacts:**
- lane 5 → `research/multiagent/219e_gap_to_best_and_plan.md` (delegation `deleg_b77255e7` task-4; **completed 11:23:28**,
  326 lines, 38 585 B, md5 `17284c7e…` pre-correction)
- lane 6 → `research/multiagent/219f_competitor_codebases_vs_rapidtool.md` (delegation `deleg_0f1252a3` task-0;
  **completed 11:32:27**, 560 lines, 45 256 B, md5 `0d256c96…` pre-correction)

**Integrity of my own watch:** nothing was executed from any clone (reading + grepping only); no `src/` or `scripts/`
file was modified by anyone during the watch (`git status -s` sampled at every poll — the only tracked-file
modification all window is lane 1's own dossier `219a`, a research write wdA owns); **no git mutations by me
anywhere**; 1 of 2 permitted RapidTool test runs used (`src/lib/llm/providers/registry.test.ts` → **21/21 pass,
349 ms**, proving the wave's verify-command pattern is live-runnable).

---

## BOTTOM LINE (read this first)

> **VERDICT: NEEDS-CORRECTION → corrected in place (8 attributable markers: 5 in 219f, 3 in 219e);
> after reading those markers, both dossiers are citable and the plan is executable — with two flagged steps
> (W14-L4 re-scope; W16-L2/L3 missing verify commands).**
>
> - **Competitor claims independently re-verified by me in the same clone files: 30 checks — 0 fabricated,
>   0 struck, 4 contradicted-as-written (now corrected in place), 1 scope-addendum.** Every competitor claim
>   in 219f has a clone path behind it — no unsupported claim, nothing invented, nothing to strike.
> - **The single most important correction:** plan step **W14-L4 (“the first real browser pass”) cannot
>   succeed as written on this host** — (a) its command uses flags `browser-smoke.mjs` rejects
>   (`--url`/`--out-png`; the args are positional — `parseSmokeArgs` rejects any unknown `--` arg), and
>   (b) more fundamentally the script's output-path guard is **unsatisfiable on Windows**:
>   `checkedOutputPath` compares a resolved `C:\…` path against the literal `/workspace\` prefix, so every
>   path fails (“screenshot path must be under /workspace, got C:\workspace\…” — reproduced by calling the
>   real module). “Returns ok” is unreachable until `scripts/browser-guard.mjs` is fixed (resolve each
>   allowed dir) or the run happens in Linux/CI. Everything else about L4 is sound (chromium IS installed;
>   `mkdirSync` creates the output dir).
> - **Plan-step check:** every file named in W14/W15/W16 **exists** (the two “new” files are correctly flagged
>   as new); every verification command is real and by repo convention runnable — **live-proven** for
>   W14-L3's exact command; **W16-L2 and W16-L3 lack a verification command** (flagged in §3). The plan's
>   factual base otherwise reproduces exactly (keyed 4/9; keyless 6/9 with the stated zeros; 35-vs-34 verb
>   drift; all load-bearing `file:line` anchors read today).
> - **Cross-dossier number check:** one real *bar-number* conflict fixed (**bolt.diy 21 → 22**), one bar
>   under-reported by lane 6 fixed (**Dyad DOES run Playwright against the running app** — 219e's bar was
>   the accurate one), one bar unverifiable from the clones flagged (**OpenHands replay** — agent runtime
>   not on this disk), one counting-convention pair explained (aider “~15 vs 20” → both reproduce against
>   a 38-file dir). No plan step depends on a struck number; the one plan step that depended on a
>   contradicted command is W14-L4 (re-scoped above).

---

## §0 Baseline (raw output)

```
2026-09-24 11:20:15  HEAD=7582771 (W12 close; committed 2026-09-24 11:15:16 -0500, "W12 close: bug hunt + UI
  simplification + W11 verification (boundary gate GREEN)") — matches wd-c.md + fixes/218 §5.
git status -s 11:19 → only ?? items (219b, W13 briefs). 11:20 → + wdA/wdB reports. No ` M` entries on
  src/scripts all window; the only tracked modification = research/multiagent/219a (lane 1's own dossier;
  its skeleton was swept into commit 7582771 at 11:15:16 — hence it went ` M` when lane 1 kept writing).
fixes/218 §5 gate (baseline of record): typecheck 0 · lint 0 · assertionGaps 0 · build 0 · scripts 261/261 ·
  lib 1957/1957 +1 by-design skip → {"ok":true} (11:08).
dossier mtimes at first sight: 219a 11:15 (1016 B) · 219b 11:16 (1842 B) · 219e: not yet · 219f: not yet
transcripts: deleg_b77255e7/task-4.log (lane 5) · deleg_0f1252a3/task-0.log (lane 6, the newest live dir
  whose manifest names the competitor-clone lane — verified by reading its manifest.json).
```
Precision note (recorded, NOT a lane error): the “aa12c6c + dirty tree” headers in 219a/219b were measured
~11:14:58 — true then; the parent's 11:15:16 commit made them stale. Lane 5 copied a variant of that phrase
and its own version is contradicted as written → corrected in 219e (§5/C6; wdA corrected 219a/219b).

---

## §1 Poll log (real timestamps; sleep-90 polls ≥3)

| # | time | lane 5 (task-4.log) | lane 6 (task-0.log) | 219e | 219f | src/scripts ` M`? |
|---|---|---|---|---|---|---|
| 0 | 11:19:20 | 30 006 B — reading 219a/219b, evidence greps | 5 621 B — license sweep across 17 clones | — | — | none |
| 1 | 11:22:18 | 30 162 B @11:20 — spot-verifying its own line numbers (“3 corrections needed”) | 8 524 B @11:20 — aider edit-formats, cline, codex-rs | **38 440 B @11:21** | — | none |
| 2 | 11:24:26 | **final: completed 11:23:28** (519.5 s) | 9 000+ B — cline checkpoints, auto-approval, aider io.py | 38 585 B @11:23 | — | none |
| 3 | 11:26:56 | — | cline SDK / Dyad / MetaGPT / codex-rs | — | — | none |
| 4 | 11:29:23 | — | emit-path (RapidTool recon), codex | — | — | none |
| 5 | 11:31:26 | — | aider io.py autonomy row | — | — | none |
| 6 | 11:33:31 | — | **final: completed 11:32:27** (816.5 s); 219f 45 256 B @11:32 | — | 45 256 B | none |
| end | 11:36–11:45 | — | — | my verification + corrections | my verification + corrections | none |

Both lanes reported honest completion via their transcripts; lane 5 used 0 of its 2 test runs, lane 6 none.

---

## §2 Independent verification — lane 6's competitor claims (same clone files opened by me)

Method: `/c/Users/mnril/rt-competitors/` read-only; commands shown per row; revisions re-pinned with
`git -C <clone> log -1 --format='%h %cs'`. **Nothing executed from any clone.** VERIFIED = claim reproduced;
CORRECTED = contradicted-as-written → marker now in 219f §5.

| # | claim as written (219f) | my check → observed | verdict |
|---|---|---|---|
| 1 | Devika `src/sandbox/` = 0-byte `code_runner.py`, `firejail.py` (§2.2) | `ls -la Devika/src/sandbox/` → both **0 bytes** | VERIFIED |
| 2 | bolt.diy 22 provider modules, exact list (§2.10) | `ls bolt.diy/app/lib/modules/llm/providers/ \| wc -l` → **22**; list matches incl. `z-ai`, `xai` | VERIFIED |
| 3 | Roo Qdrant default `http://localhost:6333` at config-manager:25 (§2.3) | `grep -n 6333 …/config-manager.ts` → line **25** exact | VERIFIED |
| 4 | Roo 8 embedders (§2.3) | `ls …/code-index/embedders/` → bedrock, gemini, mistral, ollama, openai, openai-compatible, openrouter, vercel-ai-gateway = **8** | VERIFIED |
| 5 | Roo “25 tool modules” (§2.1) | `ls src/core/tools/*.ts \| wc -l` → 26 files; excluding `BaseTool.ts` → **25** (29 `ls` entries incl. 3 dirs) | VERIFIED (counts reproduce) |
| 6 | Roo 17 locales (§2.12) | `ls src/package.nls.*.json \| wc -l` → **17** | VERIFIED |
| 7 | `CodebaseSearchTool` imports `CodeIndexManager` + `VectorStoreSearchResult` (§2.3) | head of file → both imports present | VERIFIED |
| 8 | aider `auto_lint=True`/`auto_test=False`/`test_cmd=None` at base_coder.py:105–107 + `--lint` args.py:528 (§2.5) | `sed -n 100,110p` → exactly :105/:106/:107; args.py:528 `"--lint"` | VERIFIED |
| 9 | aider “20 coder/edit-format modules” (§2.1/§2.4/§6) | `ls aider/aider/coders/` → **38 files**; non-prompt non-init (.py) → **20**; `_coder.py` → 16 | VERIFIED (the 20 reproduces; no correction) |
| 10 | cline “`+ 5 colocated McpHub.*.test.ts`” (§2.11) | `ls …/services/mcp/__tests__/` → **7** `McpHub.*.test.ts` (callTool, connectFailure, deleteServerRPC, listChangedRefresh, timeoutReconnect, toggleServerDisabledRPC, toolListChange); **not colocated** (subdir) | **CORRECTED** (219f C3) |
| 11 | cline loop `while … maxIterations` ~:760 + transient retry (§2.1) | `grep -n` → :761–762 condition, :926 exceeded msg, :57 retry doc | VERIFIED |
| 12 | cline “vendors/ = 12 adapters” incl. list (§2.10) | 23 entries incl. tests; **12** non-test .ts exactly as listed | VERIFIED |
| 13 | cline `agentic-compaction.ts` (findCutIndex, getCompactionSummaryMetadata) (§2.9) | both symbols present (:129/:142); `context/` has both compaction strategies | VERIFIED |
| 14 | cline 739 test files (§2.14) | `find cline -name '*.test.ts' -not -path '*/node_modules/*' \| wc -l` → **739** | VERIFIED |
| 15 | codex sandbox crates: `linux-sandbox/`, `mxc-sandbox/`, `bwrap/`, `core/src/sandboxing/`, seatbelt, windows_sandbox_processor (§2.2) | `find`/`ls` → all present (bwrap ✓; `core/src/sandboxing/` ✓; `cli/src/debug_sandbox/seatbelt.rs` + `sandboxing/src/seatbelt.rs` ✓; app-server windows processor ✓) | VERIFIED |
| 16 | SWE-agent “`step()` / `run()` (lines 328/339 …)” (§2.1) | `grep -n 'def step\|def run'` → 237/239 (abstract), **328** (step), **390** (run); :339 = cost-limit autosubmit text | **CORRECTED** (219f C1; symbols stand, :339→:390) |
| 17 | SWE-agent tools.py `ToolConfig`, `ToolHandler`, parsers (§2.1) | :75 ToolConfig; :227 `class ToolHandler`; parsers imported/used | VERIFIED |
| 18 | opencode `evaluate(permission, pattern, ...rulesets)` :28 (§2.7) | function at line **28**; Wildcard.match logic | VERIFIED |
| 19 | opencode `packages/opencode/src/permission/subagent-permissions.ts` (§2.7) | `find` → the file is at **`packages/opencode/src/agent/subagent-permissions.ts`**; `src/permission/` = arity.ts, evaluate.ts, index.ts only | **CORRECTED** (219f C2) |
| 20 | opencode `mcp/{auth,browser}.ts`, `tool/mcp-websearch.ts`, `ModelsDev` import provider.ts:13 (§2.10/§2.11) | all present; provider.ts:13 import exact | VERIFIED |
| 21 | Dyad LICENSE carve-out “line 3” + `src/pro/LICENSE` = FSL-1.1-ALv2 (§1) | read both files → carve-out at **line 3**; pro license header “FSL-1.1-ALv2” | VERIFIED (I read these LICENSE files myself) |
| 22 | Dyad `tsc.ts` `runTypeScriptCheck` :495, `parseTypeScriptDiagnostics` :299 (§2.5) | both lines exact | VERIFIED |
| 23 | gpt-pilot FSL-1.1-MIT + Competing Use lines 30–38 (§1); `executor.py` run_command :107 + proc/process_manager (§2.5) | LICENSE read → header + Competing-Use text as quoted; executor.py:107 `await self.process_manager.run_command(...)` | VERIFIED (license read myself) |
| 24 | MetaGPT `RunCode.run` :120, `_install_dependencies` :171, pytest :165 (§2.5); memory stack + learn/ (§2.8) | grep → :120 run, :171 def, :165 `_install_pytest`; memory files (brain/longterm/role_zero/storage) + learn/ present | VERIFIED |
| 25 | ChatDev `workflow/graph_manager.py`, `topology_builder.py`, `runtime/node/executor/` (§2.6/§7) | all present | VERIFIED |
| 26 | bolt.diy `mcpService.ts` + `stores/mcp.ts` (§2.11) | both present | VERIFIED |
| 27 | pr-agent `tests/{unittest,e2e_tests,health_test}` (§2.14) | dirs present (+packaging) | VERIFIED |
| 28 | `continue` = 0 code files; OpenHands = 1 977 ts/tsx + 10 py, “Agent Canvas” README (§0/§2.12) | `find … \| wc -l` → 0; 1977; 10; README title read | VERIFIED |
| 29 | Revisions table (9 re-pinned) | aider `5dc9490 2026-05-22` · cline `025baa8 09-16` · opencode `88c6c7a 09-16` · Dyad `43bdd75 09-16` · Roo `b867ec9 05-15` · SWE-agent `3ea751c 07-16` · MetaGPT `11cdf46 01-21` · Devika `80bb343 2025-09-25` · bolt.diy `2e254ac 02-07` — **all 9 exact** | VERIFIED |
| 30 | Test-count row: Roo 460 · bolt.diy 3 · aider 41 (spot re-run) (§2.14) | `find` counts → **460 / 3 / 41** exact | VERIFIED |

**RapidTool-side anchors of lane 6 re-checked too (all exact):** `treeRun` :939, `outcome.ok` formula :1036,
`installToolFor` :1145, `verifyKindDir` :1270; token-ledger `SessionBudgetExceeded` :44 / `NoMoneyException` :57 /
`assertBudgetHeadroom` :320 / `wouldExceed` :365; `HITL_PHASES` phases.ts:150; types.ts:27 `"mcp"`; dod.ts:430
probe; phases.ts:33 B-18 declaration; console.tsx:132 ten-tab union; counts 68 lib-tests / 137 lib-ts /
14 script-tests / 32 script-mjs; subagent.ts:49/:58; crew.ts:94 `"cost-limit"`; knowledge.ts:19 self-declaration;
patch.ts :43/:93/:117/:140/:279. (Anchors also cross-checked against lane 5's — no conflicts.)

**License check (my own reads, ≥1 required):** Dyad (`LICENSE` + `src/pro/LICENSE`), gpt-pilot (`LICENSE`),
aider (`LICENSE.txt` = Apache-2.0) — lane 6's license table reproduces on all three; the two carve-out flags
(gpt-pilot FSL source-available; Dyad `src/pro/` FSL) are real and correctly reported.

---

## §3 Lane 5's plan-step verification (real file? observable done-when? runnable command?)

Evidence base: every file below exists on disk today (`ls`), the verb/flag grammar was read from
`scripts/rapidtool-cli.mjs` (55 emitted lines), and `package.json` scripts were read; 1 live test run:
`node --experimental-strip-types --test --test-concurrency=2 src/lib/llm/providers/registry.test.ts` → **21/21
pass (349 ms)**.

| step | files exist? | done-when observable? | verify command runnable? | verdict |
|---|---|---|---|---|
| **Step 0** (owner keyed run) | n/a — `research/eval-out/` + `npm run eval` (package.json:21) real; `--keyed` parsed by run-eval.mjs:82 | yes (keyed row with 9 criteria scored) | `npm run eval -- --keyed` — real (in `_keyed-run.log:2`); keyless fallback notice exists (run-eval.mjs:632) | SOUND |
| **W14-L1** nextAction + eval verb | `headless.ts` ✓, `headless.test.ts` ✓, CLI ✓, `README-cli.md` ✓ | yes (distinguishable cases; JSON scorecard) | test file exists; `rapidtool-cli.mjs eval` is the step's new verb (post-landing) | SOUND (premise verified: `grep -c nextAction headless.ts` → **0**, TASK-01 truly absent) |
| **W14-L2** token-ledger seams | all 5 source files ✓; tests: `verify.server.test.ts` ✓, `node-runner.server.test.ts` ✓, `token-ledger.test.ts` ✓; **`chat.server.test.ts` / `crew.server.test.ts` DO NOT EXIST** (tests are `chat.test.ts` / `crew.test.ts`) | yes (over-cap refuses before the wire) | “**the four seam test files**” is imprecise: only 3 exist under those names; two must be created or the existing `chat.test.ts`/`crew.test.ts` named | **FLAG** (verify column needs exact file names; no false file claim in Files cell — “+ their tests” is honest) |
| **W14-L3** provider breadth step 1 | `registry.ts` ✓, `doctor.ts` ✓, `registry.test.ts` ✓, `doctor.test.ts` ✓ | yes (`RT_E_VALIDATION` refusal) | **RUN LIVE: 21/21 pass** | SOUND (strongest row) |
| **W14-L4** first browser pass | `console.tsx` ✓, `styles.css` ✓, `browser-smoke.mjs` ✓, `browser-smoke-verdict.mjs` ✓ (exists — conditional clause fine) | “returns ok” — **unreachable as written on this host** | **NOT runnable as written** → see correction C7 in §5: flags rejected (positional args required) AND the Windows path guard fails for every path (reproduced). Fix `scripts/browser-guard.mjs` (not the verdict module), then: `node scripts/browser-smoke.mjs http://localhost:8080/ C:/workspace/screenshots/l4.png` (chromium installed ✓; mkdirSync ✓; needs `npm run dev`) | **NEEDS-CORRECTION** (C7) |
| **W14-L5** doc-truth sweep | README/AGENTS/board/README-cli ✓ | yes | `grep -c 'case "' scripts/rapidtool-cli.mjs` → **35** (README.md:9/:80/:101 and AGENTS.md:50 still say 34 — drift is real) | SOUND |
| **W15-L1** M2 leg | `compile-check.server.ts` (+test ✓), `scaffold.ts` ✓, `codegen.server.ts` (+test ✓) | yes (three distinct outcomes) | `node … --test … compile-check.server.test.ts` — file exists | SOUND |
| **W15-L2** M3/M4 leg | `verify.server.ts` (+test ✓), `dod.ts` (+test — `dod.test.ts` present) | yes (`lastTest.label==="tested"` + hash) | file exists | SOUND |
| **W15-L3** M9/M7 leg | `run-eval.mjs` ✓, `maker-score.ts` ✓, `headless.ts` ✓ | yes | `npm run eval -- --trials=2` — real flag (run-eval.mjs:89-93; “heavy — owner-window” honest) | SOUND |
| **W15-L4** git landing tail | new `git.server.ts` **correctly flagged new** (absent today ✓); `scaffold.ts` ✓, CLI ✓ | yes (scratch tree only) | “new module test + scratch-dir CLI probe” — semi-concrete (no exact command); acceptable, noted | SOUND (minor: suggest naming the probe command at dispatch) |
| **W15-L5** interop spike | memo path new by design | yes (handshake trace or explicit couldn't-run) | n/a (memo) | SOUND |
| **W16-L1** checkpoint+resume | `engine.ts` ✓, `types.ts` ✓, `headless.ts` ✓, CLI ✓ | yes (kill mid-P6 → same state hash) | “targeted resume probe + lib tests” — semi-concrete | SOUND (minor) |
| **W16-L2** patch preservation | `patch.ts` ✓, `io.ts` ✓, `codegen.server.ts` ✓ | yes (“never silently overwrites”) | **NO verification command stated** | **FLAG** (add e.g. a `patch.test.ts` targeted run + scratch edit-cycle probe) |
| **W16-L3** corpus expansion | `research/eval-corpus/` ✓, `run-eval.mjs` ✓ | **no done-when stated** | **NO verification command stated** | **FLAG** (add done-when: M7 measurable across ≥2 domains; verify: `npm run eval -- --trials=2` + grader-freeze check) |
| **W16-L4/L5** owner run + buffer | n/a | n/a | n/a | SOUND by design |

**Where lane 5 leans on lane 6** (dependency check): **it does not** — 219e was written 11:23, 219f completed
11:32, and 219e's §4 explicitly hands the plan to dossier-sourced bars only. So no plan step consumes 219f;
the cross-check below is therefore about *the owner's combined picture*, not a broken dependency.

**Factual base of 219e re-derived today (selection, all exact):** keyed `4/9`, M1/M5/M6/M8=1,
M2/M3/M4/M7/M9=0, 756.2 s (`_keyed-run.log`, mtime Sep 10 01:05); keyless 6/9, 6 entries, `generatedAt
2026-09-17T02:49:36.070Z`, M1/M3/M4=0, `graderDir` + `trials` present (`results.json`); corpus artifact
trial-2: 4 of 5 job files are `export * from "./track.ts"` (flip/lease/record/show 10 lines each; `track.ts`
36 lines with JOBS + self-tests); `P6_SYNTH_MODEL`/`WILD_CLASSIFIER_MODEL` both flash (codegen.server.ts:145,
wild-mode.server.ts:32); `stream:false` deepseek.ts:377; `RUNNER_OUTPUT_MAX_CHARS = 48_000`
node-runner.server.ts:74; wild cap message store.ts:1124; `forceHuman` engine.ts:1646; CLI 35 verbs,
`edit` header :27; `verifyKindDir` mechanism at compile-check (:1051–1080 contract header + def :1270 —
219e's “:1058-1096” points at the header block, 219f's “:1270” at the def; same mechanism, no conflict —
precision note only); Playwright dep package.json:93 + chromium installed.

---

## §4 Cross-check: 219e's “the field's bar” vs what 219f actually found in the clones

| # | 219e bar claim | 219f clone finding | my adjudication |
|---|---|---|---|
| 1 | bolt.diy **21** providers (108:273-277) | **22** (`ls … \| wc -l`) | **lane 5 stale by one — clone says 22 (I counted 22 too).** → 219e corrected (C5). 108 holds the older count. |
| 2 | Dyad “runs the emitted app (Playwright) … grounded against a running app” (108:456-475, 468-475) | §2.5 “typechecks the generated app … **stops at tsc**” (§3-L1) | **lane 5's bar CONFIRMED by the clone** (`tests_handlers.ts` :126/:215/:252 + `test_recorder/assertion_*` + `playwright_bootstrap`); **lane 6 under-reported** → 219f addendum (C4). The honest RapidTool-vs-Dyad distinction is *artifact's-own-toolchain (headless) vs browser-E2E-needs-a-running-app*, not “Dyad stops at tsc”. |
| 3 | aider “~15 edit formats + graded fuzzy chain” (107:73) | “20 coder/edit-format modules” (§2.4) | both reproduce on a **38-file** dir (20 non-prompt modules; 16 `_coder.py`). No correction; cite “20 non-prompt modules (16 `_coder.py`)” when a number is needed. |
| 4 | OpenHands “runs replay step-by-step” (90:75-77) | §0: the OpenHands clone = **Agent Canvas frontend only** (1 977 ts/tsx, 10 py; agent runtime not on disk) | **not clone-verifiable — keep the dossier-90 citation, do not attribute it to the clone.** Flagged (UNVERIFIED-from-clones; nothing struck — 90 is a real dossier study). |
| 5 | SWE-agent $ caps + autosubmit (107:58) | §2.9 didn't cover it | clone confirms the mechanism: `agents.py` ~:337-339 “Total instance cost exceeded cost limit … Triggering autosubmit” + `models.py` limits per 107:58. Consistent. |
| 6 | MetaGPT `max_budget=10.0` + `invest()` (108:334-339) | not covered | clone: `cost_manager.py:31 max_budget: float = 10.0`; `team.py:93-100 invest()` raises `NoMoneyException` on breach. 219e's cite accurate. |
| 7 | Cline eval pyramid + flakiness score (107:89) | consistent (§2.14 739 tests; §2.1 loop; checkpoints) | no conflict. |
| 8 | Cline `registerHandler(providerId, factory)` + generated catalog (107:90) | §2.10 “12 vendor adapters … factory” | consistent (219f's own adapter count verified by me = 12). |
| 9 | (numbers both cite) test-density / suite sizes | 219f 82 test files (68+14) / 169 source (137+32) | reproduces exactly (`ls \| wc -l`); **689** — no conflict with 218 §5's 261/1957 (different metric: test *cases* vs test *files*). |
| 10 | compile-check line pair (§3 note above) | header vs def | no conflict (precision note only). |

**Net:** exactly **one** real bar-number error on lane 5's side (bolt 21→22), **one** under-report on lane 6's
side (Dyad), one unverifiable-from-clones bar (OpenHands), one counting-convention to standardize (aider).
The owner's decision numbers (keyed 4/9, keyless 6/9, 35 verbs, gate counts) are real.

---

## §5 Corrections issued (attributable markers now in the dossiers)

Marker protocol per `wave_plans/W13/wd-c.md`; every marker says “verified by WD-C, not by the lane”.

**In `219f_competitor_codebases_vs_rapidtool.md` (5 markers):**
1. **C1 · §2.1 (SWE-agent)** — CORRECTED: `run()` is at **:390** (not :339); `step()` :328 stands (grep re-run
   returns 237/239/328/390; :339 is cost-limit autosubmit text).
2. **C2 · §2.7 (opencode)** — CORRECTED: `subagent-permissions.ts` lives at
   **`packages/opencode/src/agent/`**, not `…/permission/` (`find` evidence; `src/permission/` = arity/evaluate/index).
3. **C3 · §2.11 (cline)** — CORRECTED: **7** `McpHub.*.test.ts` in a **`__tests__/`** subdirectory (not “5 colocated”).
4. **C4a · §2.5 (Dyad)** — ADDENDUM: Dyad also runs **Playwright assertions against a running preview**
   (`tests_handlers.ts` :126/:215/:252; assertion machinery; matches 219e's bar row 2).
5. **C4b · §3-L1** — CORRECTED (scope): “Dyad stops at tsc” is narrowed — see C4a; RapidTool's lead on this
   axis is *artifact-own-toolchain headless* vs *browser-E2E-needs-a-running-app*.

**In `219e_gap_to_best_and_plan.md` (3 markers):**
6. **C5 · §2 table (row 9)** — CORRECTED: bolt.diy **21 → 22** providers (`ls … \| wc -l` → 22; 108 stale).
7. **C6 · header (tree state)** — CORRECTED: “HEAD 7582771 (W12 close) + **uncommitted** W10/W11/W12 work” →
   the tree was **committed clean at 7582771** (11:15:16 -0500; contains the W10–W12 work); no uncommitted
   tracked work at writing (`git status -s`); the “aa12c6c + dirty” phrasing died with the 11:15:16 commit.
8. **C7 · W14-L4 (plan step)** — CORRECTED: the verify command is not runnable as written: positional args
   required (no `--url`/`--out-png` flags) AND the output-path guard is unsatisfiable on Windows
   (`browser-guard.mjs:34-42` needs `resolve(dir)` per allowed dir, or a Linux/CI run). Closest-runnable
   command + fix target (`scripts/browser-guard.mjs`, not the verdict module) recorded in the marker.
   **The parent should re-scope L4 with that guard fix as its first task.**

**Struck: 0.** Nothing in either dossier was unsupported enough to strike: every competitor claim in 219f has a
clone path; every 219e RapidTool claim reproduced. (Nothing was deleted or prose-rewritten — markers only.)

---

## §6 Honest limits of this verification

- I re-ran ~30 of lane 6's checks + all of 219e's plan-file/command checks; I did **not** re-verify all 17
  clones to lane-6 depth (rows for developer/gpt-engineer/SWE-agent-deep were not re-derived beyond the
  items tabled). Where I did not check, I say so rather than implying coverage.
- I did not run `npm run typecheck`/`npm test`/`npm run build` (forbidden on this memory-tight host with
  9 agents); gate numbers are taken-from `fixes/218` §5 (as both lanes did) and are not re-run by me.
- The W14-L4 guard finding was reproduced by calling the real `browser-guard.mjs` functions (a read-only
  import; no browser launched, no dev server started). A full smoke run was not possible — no dev server
  and it is not one of the ≤2 permitted test runs.
- wd-c.md asked for ≥8 competitor rows re-opened; **30 tabled** (all rows in §2), ~all of the 219f claims
  that carry a number or a path, plus license files read directly by me (Dyad, gpt-pilot, aider).
