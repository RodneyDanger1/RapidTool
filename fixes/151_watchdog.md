# fixes/151 — Wave Watchdog Log (deleg_883d9e9c, fixes/150 5-lane 10X wave)

Wave watchdog + aider run. **Date:** 2026-09-08 ~19:00–19:12. **Tree:** 1360/1360 green at
dispatch (18:58). Wave now: **mostly completed with PARTIAL landings** (4/5 lanes hit their
tool-iteration caps; G2 still running as of 19:10:30). Repo is **NOT gate-green mid-wave** —
G3's own summary says "repository is mid-edit and NOT gate-green … one edited file carries
unused-import churn". Do NOT run the four gates until integration fixes land.

## 1. Per-lane snapshot (transcripts + file mtimes)

| Lane | Goal (fixes/150) | Status @ log time | Files written (mtime 09-08) | Left undone (per lane summaries) |
|---|---|---|---|---|
| G1 (task-0) | tree-run --dir + repair --dir seam | **completed 19:09:31 — PARTIAL** | headless.ts 19:06:42 (+518-line backend after driveP6Journey, import GeneratedTreeFile), rapidtool-cli.mjs 19:09:09, scratch-g1-probe.ts | tests, gates, fixes/150_g1.md, README-cli section |
| G2 (task-1) | capability-oracle rows + capabilityCoverage-gated convergence | **STILL RUNNING** (last action 19:10:27 patch scaffold.ts) | scaffold.ts 19:10:30 | in flight |
| G3 (task-2) | --verify-kind scratch-copy install/build | **completed 19:09:29 — PARTIAL, RED state** | scaffold.ts 19:08:05, maker-score.ts 19:08:05, compile-check.server.ts 19:08:50 (3 patch edits) | feature body, tests, gates, fixes/150_g3.md; **unused-import churn left in one edited file** |
| G4 (task-3) | wild-mode keyed P6 parity + E2 trio | **completed 19:08:05 — PARTIAL** | engine.ts 19:07:26 (first patch only — "extract shared keyed-P6 helper") | wildStep wiring, reviewer ctx, E2 trio, gates, fixes/150_g4.md |
| G5 (task-4) | declare-or-strike doc pass | **completed 19:06:16 — PARTIAL** | README.md 19:05:04 (8 patches, verb count 30→31), scripts/README-cli.md 19:05:54 | console.tsx + AGENTS.md passes never started (both untouched, mt Sep-07/17:47) |

No `fixes/150_g*.md` logs exist yet (all 5 lanes). No lane edited `errors.ts` (my 19:04 edit
stands alone — see §2).

## 2. Collision radar (adjudicate at integration — no git, so diffs live only in transcripts)

1. **scaffold.ts — G3 wrote 19:08:05, G2 is writing 19:10:30 (still running). DOUBLE-WRITE on
   same file, same feature area (capability rows / emitted-spec oracle).** Highest-priority
   adjudication. G2 owns scaffold.ts; G3's brief allowed "scaffold.ts(comment)" but G3 landed a
   real edit there (its 3 patches incl. scaffold.ts 19:08:05). G2's 19:10:30 patch may land on
   G3's intermediate state (which G3 itself flags as carrying unused-import churn). Parent MUST
   reconcile both lanes' scaffold.ts hunks.
2. **maker-score.ts — G2-owned, G3 wrote it 19:08:05.** G2's remaining work (capability
   presence oracle) plausibly targets maker-score.ts too. Check G2's final state against G3's
   edit when G2 completes.
3. **compile-check.server.ts — G1+G3 both own; single write at 19:08:50 (inside G3's window,
   after G1's last green tsc 19:07:41).** Verify G1's tree-run/repair changes to
   compile-check.server.ts (if any) didn't get clobbered — G1's summary only claims headless +
   rapidtool-cli + green tsc, so likely G3-only write; still confirm.
4. **rapidtool-cli.mjs — G1 wrote 19:09:09 (after G1's tsc? no — 19:09:09 is ~28 min after
   tsc 19:07:41; verb tables landed post-tsc, i.e. UNTYPECHECKED region).** G3 owns this file
   too but its 3 patches were elsewhere. G1's cli edit came after its own green tsc → the new
   verb dispatch code was never typechecked. Flag for integration tsc.
5. **headless.ts — G1 wrote +518 lines 19:06:42; G2 also owns headless.ts and is STILL
   RUNNING.** No G2 headless.ts write observed yet (G2 read headless.test.ts/compile-check
   tests pre-implementation), but any G2 headless.ts insert must avoid G1's post-driveP6Journey
   region (~L1378+). Watch G2's final transcript.
6. **engine.ts (G4 only, 19:07:26, partial)** and **wild-mode.server.ts (untouched)** — no
   cross-lane risk. headless.test.ts untouched (G4 never reached the E2 trio) — G4's brief
   tests are OWED, file is G4-owned only.
7. Cross-cutting: several lanes ran `tsc --noEmit` mid-wave while others were mid-edit (G1's
   green 19:07:41 overlapped G4's engine.ts patch started 19:07:21). Green tsc results from
   mid-wave are NOT evidence of an integration-green tree. Re-run typecheck + full suite after
   reconciliation.

## 3. RT_E pre-registrations (src/lib/errors.ts — MY additive edit, 19:04:11)

Registered 3 codes, appended at end of `ERROR_CODES` + `ERROR_CODE_DOC` (additive-only rule
respected; classifyError's thrown-`.code` passthrough means lanes can throw/return these today):

- **`RT_E_TREE_RUN_FAILED`** — dir tree-run verdict red (compile/spec/entry). agentAction: read
  tree-run outcome, fix generator, re-emit, re-run before claiming P6 verified.
- **`RT_E_REPAIR_FAILED`** — repair cycle exhausted/refused, tree still red. agentAction: read
  last tree-failure tail + repair evidence, adjust directive, re-run; never mint green on red.
- **`RT_E_VERIFY_KIND_FAILED`** — --verify-kind scratch install/declared build red. agentAction:
  read install/build evidence from scratch copy, fix emitted package/builder, re-run.

**Adoption targets:** G1's repair --dir envelope (`RT_E_REPAIR_FAILED` on budget-exhaust,
`RT_E_TREE_RUN_FAILED` on red tree-run) and G3's --verify-kind (`RT_E_VERIFY_KIND_FAILED`) —
their briefs said "RT_E_RUNNER_FAILED-class"; these are the precise codes. Adopting is their
choice; presence is harmless if unused. **Verified:** `node --experimental-strip-types --test
src/lib/errors.test.ts` → **21/21 pass** (data-driven parity: doc entry per code, no orphans,
one-line meaning/agentAction, RT_E_* unique — 19 codes now). README-cli RT_E registry (G5's
file) not updated by me; G5's doc pass is partial anyway.

## 4. Store-side journey mirror (src/lib/store.ts + store.test.ts — MY additive edits, 19:06)

- **`useRapid.runP6Journey(id, opts?)`** action added (type + impl). Async-drives
  `headless.driveP6Journey` on the project: lazy `await import("./headless.ts")` inside the
  action (same idiom as `refreshStatuses`' dynamic imports; headless is server-only node:fs so
  it never enters the client bundle's static graph). Keyless runs commit nothing (driveP6Journey
  returns the same reference); converged/failed commit via `rebaseUserFields` so user fields
  survive. `opts.budget` passthrough; `opts.deps` DI mirrors `runVerifyAsync`'s opts.server
  pattern (deterministic tests, no key/fs/network). Return envelope:
  `{ok:true, outcome:"keyless"|"converged"|"failed", cycles, budget, gate} | {ok:false, error}`.
- Structural `P6JourneySurface` type deliberately NOT a type-import of headless.ts (server-only
  + under lane edit).
- **Tests (store.test.ts):** unknown-id guard + honest budget-exhausted commit via injected
  fakes (asserts `p6.journey.exhausted` lands on the committed store record). Full suite →
  **67/67 pass**.
- Caveats for the console face: (a) in a pure browser bundle the headless chunk cannot load
  (node:fs) — the honest "backend unavailable" error path returns; a later server-fn seam
  (verify.ts ↔ verify.server.ts pattern) is the upgrade path if the console needs it in-browser;
  (b) not serialized per project (mirrors runVerifyAsync precedent) — add a single-flight latch
  if double-click cost matters.

## 5. Web research (real fetches; Firecrawl web_search/web_extract were NOT configured — used curl)

### (a) Tree-edit-loop formats (for G1's repair re-import semantics)
1. **aider edit formats** (aider.chat/docs/more/edit-formats.html, fetched):
   `whole` (full-file rewrite), `diff`/`diff-fenced` (SEARCH/REPLACE blocks fenced after a file
   path — git-merge-marker style `<<<<<<< SEARCH … ======= … >>>>>>> REPLACE`), `udiff`
   (simplified unified diff with `@@ ... @@` hunks; adopted for GPT-4-Turbo to stop "elide
   unchanged code" laziness). Field practice: LLM edit output is anchored by *file path +
   replaceable block*, not line numbers — re-import must match blocks, tolerate drift, and
   refuse ambiguous matches.
2. **Codex `apply_patch`** (openai/codex repo, codex-rs/apply-patch/src/*.rs, fetched):
   patch = ordered hunks; each `UpdateFileChunk` = optional single-line `change_context` anchor
   (usually a class/method/function definition) + `old_lines` (must occur strictly after the
   anchor) + `new_lines` + `is_end_of_file` flag. Matching (`seek_sequence`) tries decreasing
   strictness: exact → ignore trailing whitespace → ignore leading+trailing whitespace; EOF
   patterns try end-of-file first. Replacements applied bottom-up so earlier hunks don't shift
   later positions. Parser has strict/lenient modes (lenient retained for gpt-4.1 quirks). The
   applied result carries `unified_diff + original_content + content` (self-checkable output).
3. **Claude Code Edit/Write** (docs.anthropic.com/en/docs/claude-code/tools, fetched):
   Write = full-file create/overwrite (existing files require read-before-write on many models;
   new files don't); **Edit = targeted string replacement, preferred for partial changes**.
   Implication for repair re-import: the field's dominant shapes are (i) search/replace blocks,
   (ii) anchored unified-diff hunks, (iii) whole-file rewrite — a hash-checked tree re-import
   (G1's design) is *stronger* than all three because it can verify the applied file equals the
   intended edit, which none of these tools do natively.

### (b) Bounded npm-install for sandboxed build verification (for G3's --verify-kind)
4. **`npm ci`** (docs.npmjs.com/cli/v10/commands/npm-ci, fetched): clean install for CI —
   deletes node_modules, installs strictly from package-lock.json, errors if lockfile out of
   sync with package.json; the deterministic base for scratch-copy verification. Config surface:
   `ignore-scripts` (default false — set true to skip lifecycle scripts in a scratch copy),
   `audit` (default TRUE — submits audit requests to the registry; disable with `--no-audit` to
   keep a sandbox offline/silent), `fund` similar.
5. **`--offline` / `--prefer-offline` / cache** (docs.npmjs.com/cli/v10/using-npm/config,
   fetched): `offline` default false — "Force offline mode: no network requests … to allow the
   CLI to fill in missing cache data, see --prefer-offline"; `prefer-offline` bypasses staleness
   checks but still fetches missing data; `prefer-online` forces staleness re-checks.
   `cache` default `~/.npm` (Windows `%LocalAppData%\npm-cache`) — a warm cache makes
   `--prefer-offline` fast and network-free for already-seen deps; `cache-min`/`cache-max`
   control staleness windows. Strategy for --verify-kind: scratch `npm ci --no-audit --no-fund
   --ignore-scripts` first; on network failure retry `--prefer-offline` (honest degraded), and
   treat `--offline` misses as a hard "cannot verify" (never a pass).
6. **Bounded network for sandboxed installs** (same config source): `fetch-timeout` default
   300000 ms (5 min) per HTTP request, `fetch-retries` default 2 (idempotent reads retried on
   network failure/5xx), `fetch-retry-factor` 10 — set tighter timeouts/retries in a scratch
   verify context so a hung registry never stalls the verify loop; combine with an outer wall
   clock per install attempt. Honest failure taxonomy: registry unreachable vs lockfile
   mismatch vs build script failure are distinguishable from npm's stderr/exit codes.

## 6. My file changes this run (all additive; NO G-owned file touched)

| File | Change | Evidence |
|---|---|---|
| src/lib/errors.ts | +3 RT_E codes (list + ERROR_CODE_DOC) | errors.test.ts 21/21 |
| src/lib/store.ts | `runP6Journey` action + `P6JourneySurface` type | store.test.ts 67/67 |
| src/lib/store.test.ts | 2 regression tests (guard + injected-deps commit) | store.test.ts 67/67 |
| fixes/151_watchdog.md | this log | — |

## 7. Integration checklist for the parent
1. Reconcile scaffold.ts (G3 19:08:05 ↔ G2 19:10:30, G2 may still write) and maker-score.ts
   (G3 wrote, G2 owns) from BOTH transcripts' patch diffs.
2. Clear G3's flagged unused-import churn + confirm which file (G3 summary truncated).
3. Typecheck the whole tree once G2 lands (G1's cli verb code at 19:09:09 was never
   typechecked; several mid-wave tsc greens are not integration evidence).
4. Check G1's repair/tree-run CLI verbs actually exit with the pre-registered RT_E codes
   (optional adoption), then run errors.test.ts again.
5. G4 owes the wild-mode keyed-P6 parity + E2 trio (only 1 engine.ts patch landed).
6. G5 owes console.tsx + AGENTS.md passes (never started).
7. All 5 lanes owe fixes/150_gN.md logs.
