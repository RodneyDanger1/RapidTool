# 263 · Lane B3 — organization: stray files, .gitignore gaps, cross-module wiring audit, wave index

**Lane:** W24 spring-clean B3 (`wave_plans/W24/spring-clean.md` §B3). **HEAD:** `b721f9c`. **Written early, appended as work lands** (append-only; this file is new this wave).
**Box:** repo root, `.gitignore`, untracked/stray files, `wave_plans/**`, new files elsewhere. Did NOT touch: console/routes (U1/U2), `src/lib` core (B1), `src/lib/llm/**`+`scripts/**` (B2), `AGENTS.md`.

## 0. Baseline

```
$ cd "/c/Users/mnril/Desktop/RapidTool Main" && git status --porcelain
 M scripts/run-eval.mjs          <- sibling/prior lane (W23-L1 eval wires), not mine
 M src/components/console.tsx    <- U1's pane / parent T5.2-A wire, not mine
?? src/lib/fixtures.review.ts    <- new fixtures layer (parent/T5.2-A), not mine
?? wave_plans/W24/               <- this wave's plans, my box
```

## 1. Stray-file inventory (repo root)

`git status --porcelain --ignored=matching` shows only the 4 entries above as live git state; the
root clutter below is either **tracked** (committed earlier, so it shows no status) or **ignored**
(`*.log`). Inventory taken from `ls -la` at root + `git ls-files | grep -v /`:

### 1a. Ignored, untracked junk at root (disk clutter, invisible to git)

| File | Size/date | Refs | Action |
|---|---|---|---|
| `rt_lib2.log` | 488,549B · Sep 24 | **0** anywhere (git + working tree) | **DELETED** |
| `_tc217g.log` (+`_run2/_run3/_run4`) | 53–713B · Sep 24 | fixes/217g:178,215-221 (cited as run evidence) | KEPT → proposal (evidence chain) |
| `_el217g.log` | 68B · Sep 24 | fixes/217g:179 (cited as run evidence) | KEPT → proposal (evidence chain) |
| `debug.log` | 132B · Sep 5 | 96:101/324 (`§1.3` debris; step-11 acceptance = removed) | **DELETED** |

### 1b. Tracked root-level scratch/artifacts (deletion = commit; proposals below)

`probe2.test.ts`, `probe3.test.ts`, `probe4.test.ts`, `probe-b2-before.ts`, `probe-b2-runspec.ts`,
`probe-b2-tree.ts`, `probe-r5-misc.ts`, `probe-r5-vector.ts`, `arch-e2e.svg`, `flow-e2e.svg`,
`phases-e2e.svg`, `design-e2e.html`, `packet-e2e.md`, `build.json`, `w1-source-project.json`,
`agentnotes.md` (612KB), `.node_modules.lock`, dirs `artifacts/ attachments/ audit/ audit-bugs/
builds/ proposals/ review/ screenshots/ vault-e2e/ .audit-g2/ server/`.

## 2. `.gitignore` audit

Current `.gitignore` covers `node_modules/`, `dist/`, `.env` (+`.env.local`/`.env.*.local`/`.env.bak-*`),
`*.log`, `.rapidtool/logs/`, `.hermes/`, `.probe-tmp/`, `logs/trajectory.db*`. Verified by
`git check-ignore -v` — pending eval-out/run-artifact gap analysis (findings below).

## 3. Wiring audit (static grep-level)

*(in progress — findings land below with exact file:line)*

## 4. `fixes/263_index.md`

*(in progress)*

---

# FINAL REPORT (appended; supersedes the "in progress"/"pending" markers above)

## §1 — Stray-file inventory + actions (complete)

**Deletions performed (5; each with its evidence):**

| # | File | Git state | Size | Evidence for "clearly junk" |
|---|---|---|---|---|
| 1 | `rt_lib2.log` | untracked + ignored (`*.log`) | 488,549 B | zero references anywhere (`git grep` 0; working-tree grep 0); transient harness log dated Sep 24 |
| 2 | `debug.log` | untracked + ignored | 132 B | `research/multiagent/96_engineering_completion.md:101` lists it under "Root debris (cleanup candidates, verified present)"; §8 step 11's acceptance is "probes/`debug.log` removed" |
| 3 | `probe2.test.ts` | tracked | 4,047 B | **zero `test(` calls** (`grep -c "test(" → 0` — 96:100 "the three probeN.test.ts contain **zero** tests"); not in any test glob (`package.json:19` = `scripts/**/*.test.mjs` + `src/lib/*.test.ts`); zero importers (the only `probe2` hit in `scripts/run-eval.test.mjs:805` is a local variable, verified) |
| 4 | `probe3.test.ts` | tracked | 1,058 B | same as #3 |
| 5 | `probe4.test.ts` | tracked | 920 B | same as #3 |

Post-state: `git status --porcelain` shows ` D probe2.test.ts` / ` D probe3.test.ts` / ` D probe4.test.ts` (unstaged deletions — the parent commits). The two `.log` deletions are disk-only (ignored, invisible to git). 96's §1.3 debris set listed 8 names; the other 3 (`probe-f6.ts` already absent; `probe-r5-*`, `build.json`) are below.

**Proposals — deliberately NOT deleted (with the reason):**

| File(s) | Why kept |
|---|---|
| `probe-r5-misc.ts`, `probe-r5-vector.ts` | 96:99 debris-list, but `research/multiagent/103_feature_gaps.md:94` cites them as the *only* consumers/exercise path of `vector.ts:693+` and `90_LEAPFROG.md:991` cites them as culture artifacts — deleting breaks live doc references. Owner call (B4/docs), not a zero-ref clean. |
| `probe-b2-before.ts`, `probe-b2-runspec.ts`, `probe-b2-tree.ts` | re-runnable before/after evidence for `fixes/144_m2_b2` (self-documented headers) — evidence chain, not junk. |
| `build.json` (55 KB) | 96:345 calls it "the fresh E2E artifact" (22 refs) — evidence, not junk; regenerated per run. |
| `w1-source-project.json` (67 KB) | cited as a CLI input in `research/multiagent/219a_inventory_and_reality.md:323`. |
| `agentnotes.md` (612 KB) | heavily referenced working doc (10 refs), not scratch. |
| `arch-e2e.svg`, `flow-e2e.svg`, `phases-e2e.svg`, `design-e2e.html`, `packet-e2e.md` | committed E2E artifacts; `96:322` cites `packet-e2e.md 09-06` as the P0→P12 artifact set. |
| `_el217g.log`, `_tc217g.log` + `_run2/_run3/_run4` (ignored) | cited as run-evidence in `fixes/217g_console_s1_bugs_and_compaction.md:178-221` — deleting breaks an evidence chain. |
| `.node_modules.lock` (0 B, tracked) | referenced in `fixes/247_lane5_infra.md` — leave to infra lane. |
| Root dirs `artifacts/ attachments/ audit/ audit-bugs/ builds/ proposals/ review/ screenshots/ vault-e2e/ .audit-g2/` | organized historical wave outputs (1–50 tracked files each), not stray; no renames/moves per wave rules. |
| **PROTECTED** `.grok/`, `server/`, `scripts/grok-pwa-*`, `AGENTS.project.md`, `startup.sh` | `AGENTS.md` §"Legacy scaffolding — do not build on it": *"Do not delete or extend them until that lands"* → untouched. |
| `tsconfig.w24u1.json` (untracked, repo root) | **sibling U1's live scoped-tsconfig scratch** (appeared mid-wave, `git status`). Not mine to delete while U1 is using it — flagging so the wave-end sweep removes it. |
| `C:/Users/mnril/{w9l5,w10l5,w11l2}_scratch` refs (`fixes/216x:25,218`, `216y:8,15`, `217b:28-29`) | historical evidence paths **outside** the repo, by design ("Probes live OUTSIDE the repo", `217b:28`). No action. My own probes for this lane live in `C:/Users/mnril/w24b3_scratch/` per that convention. |

## §2 — `.gitignore` audit (complete)

**Covered & verified** (`git check-ignore -v` per path; line numbers as of the post-append file): `.env` (`.gitignore:9`, unanchored → any depth), `*.log` (`:15`), `node_modules/` (`:2`, no middle separator → any depth), `.rapidtool/logs/` (`:20`, root only — see gap), `.hermes/`, `.probe-tmp/`, `logs/trajectory.db*`, `RapidTool Software/` (`:29`).

**GAP FOUND + FIXED (the one real ignore gap):** `.rapidtool/logs/` has a **middle separator**, so per gitignore spec it is anchored to the repo root — per-project logs at depth escaped it:
```
$ git check-ignore -v research/eval-out/newslug/.rapidtool/logs/run.ndjson      # BEFORE → (no output = NOT ignored)
```
Appended (append-only; existing line untouched — appended block occupies `.gitignore:21-23`):
```
# Per-project runtime logs at ANY depth: `.rapidtool/logs/` alone is root-anchored (middle separator),
# so emitted trees (research/eval-out/<slug>/.rapidtool/logs/*.ndjson) escaped it — B3 W24 gap-fill:
**/.rapidtool/logs/
```
Verified AFTER: both `research/eval-out/newslug/.rapidtool/logs/run.ndjson` and `.rapidtool/logs/rapidtool.ndjson` now match `.gitignore:23`.

**`research/eval-out/*` run artifacts — verified, NO pattern added (deliberate):** they are **tracked by design**, not junk: `results.json`, `history.json`, `run-in-progress.json` + 345 emitted-tree files are committed evidence read by `README.md:110`, `RESUME.md:582`, `taskuniverselog.md:171`, and `fixes/145_m7_proof.md:6`. Ignoring them would hide the repo's own run evidence (declare-or-strike). The transient per-run log there is already ignored (`!! research/eval-out/_keyed-run.log` via `*.log`), and the new `**/.rapidtool/logs/` glob now covers per-project NDJSON inside emitted trees.

## §3 — Cross-module wiring audit (complete) — **1 real drift found; everything else clean**

**Method (re-runnable, outside the repo):** `node C:/Users/mnril/w24b3_scratch/audit-wiring.mjs` — resolves every static import *and* destructured dynamic import (`const { x } = await import("…")`) in 14 key files, builds each target's export set (incl. `export {a as b}`, `export const {a,b} = …`, one level of `export * from`), reports imported names that do not exist. **Self-test proves detection works** (`phases.ts` → 11 export names found, has(PHASES)✓ has(phaseDef)✓, bogus name correctly absent).

```
$ cd /c/Users/mnril/w24b3_scratch && node audit-wiring.mjs
TOTAL: files=14 named-imports-checked=249 namespace-skipped=0 PROBLEMS=1
SELFTEST: phases.ts export-names-found=11 has(PHASES)=true has(phaseDef)=true bogusAbsent=true
```
The 1 scanner hit is `src/routes/__root.tsx:6` `../styles.css?url` — Vite's `?url` bundler suffix, **not drift** (verified by reading the line).

**The 15 key calls walked** (console→store→engine; CLI→lib; run-eval→lib), each verified:
1. `console.tsx:35` → `@/lib/phases` `PHASES, phaseDef` ✓ · 2. `console.tsx:37` → `@/lib/store` `useRapid, persistStorageHealth` ✓ · 3. `console.tsx:46` → `@/lib/io` (4 names) ✓ · 4. `console.tsx:70` → `@/lib/fixtures.review` `fixturesReview` (exported `fixtures.review.ts:27`) ✓ + `console.tsx:73` `type FixtureReviewRow` from `@/lib/fixtures` (interface at `fixtures.ts:58`) ✓ — **the parent's T5.2-A wire is coherent both directions** · 5. remaining console imports (design/diagram/render/handoff/policy/gate-stats/templates/algorithms/dod/crew/types) ✓ all in the 0-finding scan · 6. `store.ts:19-24` → engine/phases/dod/io/report-intake/llm-tasks/verify/rt-client ✓ · 7. `store.ts:567` dynamic engine → member `runPhaseAsync` ✓ (exported `engine.ts:3400`) · 8. `store.ts:1467` dynamic `./llm.ts` → `llmStatus` ✓ · 9. `engine.ts:35-50` (llm/research/exec/llm-tasks/brief-fixtures…) ✓ · 10. `engine.ts:2907` `liveLayer` export ↔ `run-eval.mjs:1237` `typeof engine.liveLayer === "function"` ✓ · 11. CLI dynamic lib imports (`errors.ts:180`, `headless.ts:227`, `compile-check.server.ts:242`, `scorecard.ts:263`, `policy.ts:596,1418`, `patch.ts:1444`, `algorithms.ts:950,1470,2651`, `error-scan.server.ts:1794`, `brief-fixtures.ts:949`) ✓ all names exist · 12. CLI `eval` verb → `sc.buildScorecard` (`scorecard.ts:609`) + `sc.buildTrends` (`:729`) ✓ · 13. `run-eval.mjs:92-97` → `compile-check.server` (`treeRun`), `maker-score` (`scoreMaker, capabilityCoverage, treeFilesOf`), `algorithms` (`fnv1a`), `token-ledger` (4 names) ✓ · 14. `run-eval.mjs:741` → **DRIFT F1 below** · 15. `headless.ts` 25+ dynamic destructured imports ✓ + routes `__root.tsx`/`index.tsx`/`run.$id.tsx` ✓ (0 findings).

### F1 — DRIFT (owner: B1 for option a / B2 for option b): the call-tap wire is dead

- **Call site:** `scripts/run-eval.mjs:737-748` `installLlmCallTap()` — `const ds = await import(pathToFileURL(join(LIB_DIR, P6_DS_SPEC)).href)` where `P6_DS_SPEC = "./deepseek.server.ts"` (`run-eval.mjs:998`) and `LIB_DIR = src/lib` (`:996`); the very next line is `if (typeof ds.setLlmCallTap !== "function") return false;` (`:741`).
- **Why it can never succeed:** `src/lib/deepseek.server.ts:22-35` re-exports exactly 11 values from `./llm/providers/deepseek.ts` (`DEEPSEEK_BASE_URL, DEEPSEEK_LONG_TIMEOUT_MS, DEEPSEEK_MODEL_IDS, DEEPSEEK_MODELS, RETRY_BASE_MS, RETRY_MAX_JITTER_MS, completeDeepSeek, cutMarked, deepSeekModelIds, deepseekApiKey, isDeepSeekConfigured`) + 2 types (`:36-39`). **`setLlmCallTap` (defined `src/lib/llm/providers/deepseek.ts:576`) is not among them.**
- **Impact:** `installLlmCallTap()` always returns `false` → `run-eval.mjs:1889` passes `null` into `llmEvidenceFromCallRecords` → every keyed trial's served-model/usage/cost evidence is recorded as null (honest — no fabricated zeros) but the W23-L1/W24-B2 per-trial evidence wire never observes a single call. B2's W24 install-site fix (`run-eval.mjs:2607-2615`, "THE TAP MUST BE INSTALLED") is right in intent — this re-export gap defeats it. No test covers `installLlmCallTap` (repo-wide grep: only `run-eval.mjs` refs).
- **Re-runnable check (evidence):** `node --experimental-strip-types C:/Users/mnril/w24b3_scratch/probe_tap.mjs` →
  `A. deepseek.server.ts setLlmCallTap = undefined` / `B. llm/providers/deepseek.ts setLlmCallTap = function` / `C. same module instance? true` / `D. run-eval.mjs:741 predicate → "false (install DEAD)"`.
- **Smallest honest fixes (pick one, owning lane):** (a) add `setLlmCallTap` (+ `clearLlmCallTap` / `LlmCallTapRecord` if wanted) to the `deepseek.server.ts:22-39` re-export list — module identity is confirmed identical (probe C), so the engine's own path observes the same tap; or (b) have `installLlmCallTap` import `./llm/providers/deepseek.ts` directly. Verified-after check for either: probe D must print `true (install OK)`.

## §4 — `fixes/263_index.md` (complete)

New file `fixes/263_index.md` generated (links only, nothing summarized/rewritten): `fixes/` newest-first by leading number (**299 links** at generation, incl. this wave's sibling logs 263/264/265 as they landed), then `wave_plans/` newest wave first (**21 wave dirs**, W24→W4, all 90 files + `wave_plans/README.md`). Regeneration script (outside repo): `C:/Users/mnril/w24b3_scratch/gen-index.mjs` — re-run at wave end to pick up late landings.

## §5 — What I did NOT touch / observations for the parent

- **Not touched (per lane rules):** `AGENTS.md` (protected; no edit proposed — the one doc fix I'd propose is `96`'s stale row-10 "gone" claim, now *true* after my deletions, so B4 may simply verify); `src/lib/**` core (B1), `src/lib/llm/**` + `scripts/**` (B2 — F1 is theirs to fix, I did not edit `run-eval.mjs`), console/routes/styles (U1/U2).
- **Sibling activity observed while writing this** (`git status` at completion): `M README.md`, `M scripts/README-cli.md`, `M src/styles.css`, `M src/components/preview-host-bridge.tsx`, `M src/components/runtime-timeline-pane.tsx`, `M src/lib/doctor.test.ts`, `M scripts/run-eval.test.mjs` + new logs `fixes/263_lane1_lib_bughunt.md`, `263_lane2_periphery_bughunt.md`, `263_lane4_docs.md`, `264_*`, `265_*`, `research/multiagent/thorough{analysis,action}.md`. My only deletions are the 3 tracked probes (` D`) + 2 ignored logs; everything else in the tree is siblings' live work.
- **Proof commands used (all foreground, no repo-scope gate):** `git status --porcelain [--ignored=matching]`, `git ls-files`, `git check-ignore -v`, `grep -rn/-c`, `node audit-wiring.mjs`, `node --experimental-strip-types probe_tap.mjs`, `node gen-index.mjs`. No `npm run typecheck|test|build|lint` anywhere.

