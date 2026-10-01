# 326 — F2 · STANDBY FIXER B — watch log (scripts/CLI/eval/fixture lane)

Run: W44 FINAL RUN (keyed). Repo frozen at HEAD `6924dde` during keyed builds. **This lane makes NO repo edits beyond this log; NO keyed calls; NO dep installs.**
Trial dir: `C:/Users/mnril/w44_trial`. Scratch: `C:/Users/mnril/f2_scratch/`.
Watching: `fixes/326_t1_run.md` (operator), `326_t2_monitor.md`, `326_t3_backend.md`, exp2 states, and the keyed eval leg (`run-eval.mjs --keyed --limit=1`).
Box (what I may prep patches for): `scripts/**` (CLI verbs/doors, exit codes/envelopes, gate.sh), `scripts/run-eval.mjs` scoring, `research/eval-corpus/**` fixture, `scripts/*.test.mjs` pin homes — **patch TEXT only this wave; parent applies post-run**.

Pin homes (additive): `scripts/cli-exit-taxonomy.test.mjs` · `scripts/cli-run-busy.test.mjs` · `scripts/run-eval.test.mjs`.

## Status

- [x] Log opened (log-first, before any watcher action) 2026-09-30 ~20:25 CDT. At open: no `326_t*` logs existed; HEAD `6924dde`; tree clean; no keyed runs.
- [x] Recon (keyless, scratch-only):
  - Keyless-safety verified: `rapidtool-cli.mjs` does **not** self-load `.env`; my shell has `DEEPSEEK_API_KEY` UNSET → plain `node scripts/rapidtool-cli.mjs …` legs are keyless by construction. All my spawns use `cwd = f2_scratch/<mkdtemp>` (never repo cwd).
  - **Fixture keyless baseline (my own bytes, `f2_scratch/repro_fixture_lex.mjs`):** `arcade-breakout` brief (279B, extracted via the repo's own `listCorpusEntries`) → `create` exit 0; `wild --start --steps 1` exit 0, `outcome: "advanced"` (phase 0 → 1), P0 artifacts carry `"vague": false` — same signature as the model `lexgame` brief that passed P0. So the D3 stall chain (0 LEX hits → vague → reframe → forceHuman) is NOT reachable on the rewritten fixture brief. Evidence: `f2_scratch/lexbase_*.raw.txt`, `lexbase_wild.pretty.json`.
  - Standard `gate` path on the fixture brief (keyless): exit 2 park at P4 `awaiting_hitl` (stock); no P0 forceHuman/reframe in envelope. Evidence: `f2_scratch/lexgate_oNlc/`.
  - Grader read: `research/eval-corpus/graders/arcade-breakout.grader.json` v2, `passWhen.meanAtLeast: 1`, requiredIdentifiers 10, expectedFiles 5, expectedBehavior 6 — run-side only; leak scans present (`briefLeakScan` :1194-1207, `graderLeakScan` :1122).
  - Prior keyed-eval failure mode (for watch context): `fixes/321_d3_keyed_eval.md:159-176` — old brief → forceHuman P0 → autopilot stall (`llmCalls:0`, `stopCode RT_E_GATE_PENDING`), 2/9 mean 0.2222.
- [ ] Watch cycles (scan logs + exp2 states + keyed eval leg)

## Poll log

| # | time | exp2 state | node | notes |
|---|------|------------|------|-------|
| P0 | 20:25 | absent | 0 | baseline; all lanes opening; repo clean @6924dde |
| P1 | 20:26 | absent | 0 | all 326 logs now present (T1/T2/T3/F1/F2) |
| P2 | 20:27 | `exp2/01_website` up | 1 | T1 driving: create+gate_c0 done; drive_exp.py = 13.7KB driver (legs: create → gate/approve loop → emit --run → npm test → doctor → diagnose) |

## Findings (per [NEW-BUG] flag, in order seen)

_(none yet)_

## PREPPED PATCHES (index — filled as patches are prepared)

| # | file | bug | anchor | pin home | state |
|---|------|-----|--------|----------|-------|
| C1 | `scripts/rapidtool-cli.mjs` | approve/reject no-pending-gate refusal ships the registry remedy claiming an "open HITL prompt" that cannot exist in the branch (hitl=null) — E2-era OBS-5 class; fixed for `gate`, not for these guards | approve guard :1028-1034 · reject guard :1197-1203 | `scripts/cli-exit-taxonomy.test.mjs` (new behavioral leg, spawn-based) | **APPLIED (F2c · window #5)** — both sites; explicit remedy; post-apply anchors :1037/:1219 (remedies :1050/:1228); pin #13; taxonomy 20/20 at F2d close |
| C2 | `scripts/rapidtool-cli.mjs` | `create` exit NDJSON row lands in the invoker's cwd log, not the created project's log dir (monitors' OBS-T3-1; adjudication-pending) | create arm (`h.saveProject(out, project)` → `respond`) :712-720 | `scripts/cli-exit-taxonomy.test.mjs` (extend) | **APPLIED (F2c · window #5, adjudicated A)** — `CLI_PROJECT = out;` at :713; pin #18; positive row under `<outdir>/.rapidtool/logs` + negative cwd row |
| D1 | `scripts/rapidtool-cli.mjs` | `doctor --tree` path honesty (T3 [NEW-BUG], HIGH class): (1) non-existent path → false-clean `ok:true / exit 0 / stubs:0`; (2) MSYS `/c/...` silently mangled to `C:\c\...` → false-empty scan | doctor arm :3992 (`case "doctor"` guard block) | `scripts/cli-exit-taxonomy.test.mjs` (new spawn legs #19/#20) | **APPLIED (F2d · window #5)** — coded `RT_E_VALIDATION` refusals + MSYS drive-form translation; evidence `t3_scratch/f2d_repro/` (pre/post) |

---

# CONTINUATION — F2b (second fixer watch; resumed after the overnight suspension)

Resumed **2026-10-01 10:04 CDT**. Host was suspended Sep 30 ~20:32 → Oct 1 ~10:01 (monitors' OBS-326-3 / T3 ENV-T3-1); `exp2/02_game` closed STOP_RED during the resume minute. `fix_go5.md` absent at every poll (10:04 / 10:07 / 10:10 / 10:13) ⇒ **apply-gate stays closed — PREP ONLY honored. No keyed calls made; only repo write is this log.**

## Poll log (continuation)

| # | time | exp2 state | node | notes |
|---|------|------------|------|-------|
| P3 | 10:04 | `02_game` closed 10:01:37–10:01:43 (legs 06–08 + diagnose + summary); no exp03 dir | 0 | T3 log updated 10:04:56 (full reads of 01+02); T1 log still stale (mtime 20:31); drivers idle |
| P4 | 10:07 | same; T1 idle ~6 min | 0 | T2 exp02 QA appended 10:07 (OBS-326-3/4 suspension notes); my keyless repros A+B run |
| P5 | 10:11 | same; no exp03 | 0 | T2 touched 10:11:11; eval-out snapshot taken (below) |
| P6 | 10:13 | same; T1 still idle (no new legs, no fix_go5) | 0 | log block 1 written |

## EXP 02 `02_game` — my lane readings (read-only; replicated with the repo's own probes, keyless)

**Exit-code vs envelope — all 8 legs CONSISTENT (scanned every .out, both exps):**

| leg | cmd | envelope exit_code | driver EXIT | ok | code | notes |
|-----|-----|-----|-----|-----|------|-------|
| 01 | create | 0 | 0 | true | — | intake |
| 02 | gate | 2 | 2 | true | — | parked awaiting_hitl P4 (stock) |
| 03/05 | approve | 0 | 0 | true | — | autopilot seat rows (no human claimed) |
| 04 | gate | 2 | 2 | true | — | parked P5 |
| 06 | gate | 1 | 1 | false | RT_E_GATE_PENDING | outcome=dod, stopped, fg=[P6:2un] |
| 07 | approve | 1 | 1 | false | RT_E_GATE_PENDING | refusal (→ C1) |
| 08 | diagnose | 0 | 0 | true | — | ok |

No exit 0 that should be coded; no envelope shape drift; `summary.failedGates` carries the 2 unmet (the driver's `unmet=None` VERDICT line is T1's harness read-bug — monitors' OBS-326-1, not product).

**P6 probes replicated independently (keyless, repo imports only; no keyed calls):**
- **p6-brief-fit** (`exp2/check_fit.mjs` — repo's own `briefNounHits`/`identifierHits` @0.35): requiredN=18, need=7, **hits=6 → FAIL by ONE** (`game, blocks, clear, board, score, high`). Same stochastic near-miss class as exp01 (7/8). Not a checker artifact.
- **p6-arch** (`f2_scratch/exp02_arch_probe.mjs` — repo's own `archTrace`): tree(2 files), rows 0, **missing=[track, drag, drop, persist]**, stubFiles=[] → honest FAIL. Note: final-record `implementationSpec` is `{}`, so capabilities fall back to `lattice.jobs` = those 4 tokens; the tree carries none of them. Engine's own reqTrace artifact agrees ('p6-arch: FAIL · tree (2 files) · missing capabilities: track, drag, drop, persist'). Tree = `src/generated.ts` (52B barrel, in-tree target → exempt) + `src/generated/create-initial-game.ts` (3,446B; fns createInitialGame/applyClears/computeClearScore/updateScore; **0 `export` statements**; req-1..9 JSDoc annotations). Thin keyed tree + genuine cap gaps ⇒ **engine-lane observation (F1 box), not an F2b patch target; recorded for completeness.**
- Journey (build.json logs, matches T2): cycle1 refusal `typeSignature functions not exported: createGame, renderBoard, clearLines, startGame, restartGame, updateScore, getScore, loadHighScore`; cycle2 refusal `… initGame, saveHighScore, handleKeyDown, render, isGameOver`; cycle3 chunk2 refused `RT_E_INTERNAL · non-JSON 200` (post-resume, OBS-326-4) → `p6.tree.tested` (compile 9/9, fnv1a 14863388) → `p6.journey.failed · tree-run ok after 3/3 cycle(s) but P6 gate FAIL · 2 unmet`.

## FINDINGS (F2b — in order seen)

### C1 · remedy text points at a non-door (approve/reject) — **CONFIRMED keyless; PATCH PREPPED**
- **What:** `approve`/`reject` on a project that is NOT parked (`status !== "awaiting_hitl" || !project.hitl`) refuses exit 1 `RT_E_GATE_PENDING` and — because the guard passes no explicit remedy — `respond()` attaches the **registry** remedy from `src/lib/errors.ts:406`: *"Route the project through the open HITL prompt (approve/reject with feedback); do not auto-advance and never fabricate a decision."* The branch fires **exactly when no HITL prompt/door is open** (hitl=null) — the remedy promises a door that cannot exist. Same class as the E2-era OBS-5 that was fixed for the `gate` verb (`repaired, not approved`); the approve/reject guards were never swept.
- **Live evidence:** `exp2/01_website/07_approve_on_red.out` (Sep30 20:28) and `exp2/02_game/07_approve_on_red.out` (Oct1 10:01) — both carry the phantom-door remedy with `error="No pending gate to approve (status: running)."`, `hitl=None` on disk.
- **Keyless repro (mine):** `f2_scratch/repro_approve_remedy.sh` → EXIT 1 + phantom-door remedy for `approve` (bare AND `--seat autopilot`) and `reject` (confirmed) against `f2_scratch/lexbase_xbpvDI/proj.json` (status=running, hitl=null). Raw outputs: `f2_scratch/repAPP_G48Z7r/{appr_bare.out,appr_seat.out,rej_bare.out}`. Env verified keyless (`KEYSET=unset`).
- **Mechanism:** explicit `remedy` on the refusal object wins (`respond()`, rapidtool-cli.mjs :190-192 only default-attaches when `remedy` is undefined) — same pattern the gate/run dod sites already use (:577-578, :797-798).
- **README:** untouched — `scripts/README-cli.md:972` documents the REGISTRY agentAction (code-level), and the E2 gate override was likewise not mirrored in the table ⇒ no doc change needed for consistency.
- **PATCH TEXT (LF; two sites; error/code bytes unchanged so recorded envelopes stay diffable):**

```diff
--- a/scripts/rapidtool-cli.mjs
+++ b/scripts/rapidtool-cli.mjs
@@ (approve guard — around :1028)
         const project = loadProjectFor("approve");
         if (project.status !== "awaiting_hitl" || !project.hitl) {
+          // 326 F2b (C1 · E2-OBS-5 class): the RT_E_GATE_PENDING registry
+          // remedy ("Route the project through the open HITL prompt …") points
+          // at a door that CANNOT exist in this branch — it fires exactly when
+          // hitl is null (no park, no prompt). Keep the code + error bytes
+          // (recorded envelopes depend on them); ship the honest context
+          // remedy (an explicit `remedy` bypasses respond()'s registry
+          // default-attach, :190-192).
           return respond(
-            { ok: false, error: `No pending gate to approve (status: ${project.status}).`, code: "RT_E_GATE_PENDING" },
+            {
+              ok: false,
+              error: `No pending gate to approve (status: ${project.status}).`,
+              code: "RT_E_GATE_PENDING",
+              remedy:
+                "No HITL accept door is open (approve needs status=awaiting_hitl with a pending gate): read the latest verdict (`diagnose`; summary.failedGates / summary.lastGate) and drive the run forward with `gate` — a red DoD gate is repaired, not approved; never fabricate a decision.",
+            },
             1,
           );
         }
@@ (reject guard — around :1197)
         const project = loadProjectFor("reject");
         if (project.status !== "awaiting_hitl" || !project.hitl) {
+          // 326 F2b (C1 · E2-OBS-5 class): same phantom-door remedy as approve
+          // — no HITL reject door exists when hitl is null; ship the honest
+          // context remedy instead of the registry default.
           return respond(
-            { ok: false, error: `No pending gate to reject (status: ${project.status}).`, code: "RT_E_GATE_PENDING" },
+            {
+              ok: false,
+              error: `No pending gate to reject (status: ${project.status}).`,
+              code: "RT_E_GATE_PENDING",
+              remedy:
+                "No HITL reject door is open (reject needs status=awaiting_hitl with a pending gate): read the latest verdict (`diagnose`; summary.failedGates / summary.lastGate) and drive the run forward with `gate` — a red DoD gate is repaired, not approved; never fabricate a decision.",
+            },
             1,
           );
         }
```

- **ADDITIVE PIN PLAN** (`scripts/cli-exit-taxonomy.test.mjs`, appended after the T8.2 seat leg; mirrors its spawn harness — mkdtemp cwd, env minus keys — and its proven keyless brief):

```js
// ---------------------------------------------------------------------------
// 326 F2b (C1) — approve/reject refusals on a NON-parked project must ship a
// remedy that points at a REAL next step: the guard fires exactly when no
// HITL door is open (hitl = null), so the registry's generic "route through
// the open HITL prompt" reads as a phantom door (E2-OBS-5 class; fixed for
// `gate`, pinned here for the approve/reject guards).
// ---------------------------------------------------------------------------
test("326 F2b C1 — approve/reject on a non-parked project refuse CODED with a real next step, never a phantom HITL door", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-nodoor-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) delete env[key];
  try {
    const proj = join(cwd, "nodoor-pin.json");
    const created = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "create",
        "--brief",
        "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.",
        "--name",
        "NoDoorPin",
        "--out",
        proj,
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);
    for (const verb of ["approve", "reject"]) {
      const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, verb, "--project", proj], {
        cwd,
        env,
        encoding: "utf8",
        timeout: 120_000,
      });
      assert.ok(!/(^|\n)\s+at\s/.test(res.stderr ?? ""), `${verb}: refusal must never print a Node stack`);
      assert.equal(res.status, 1, `${verb} on a non-parked project is a coded refusal (exit 1).\nstdout: ${res.stdout}`);
      const json = JSON.parse(res.stdout);
      assert.equal(json.cmd, verb);
      assert.equal(json.ok, false);
      assert.equal(json.code, "RT_E_GATE_PENDING");
      assert.match(String(json.error), new RegExp(`No pending gate to ${verb} \\(status: intake\\)`));
      assert.ok(
        !String(json.remedy).includes("Route the project through the open HITL prompt"),
        `${verb}: remedy must NOT point at a HITL prompt that cannot exist (hitl = null) — the phantom door.`,
      );
      assert.match(String(json.remedy), /`gate`/, `${verb}: remedy names the real next step`);
      assert.match(String(json.remedy), /repaired, not approved/, `${verb}: keeps the red-gate honesty clause`);
      assert.match(String(json.remedy), /never fabricate a decision/, `${verb}: keeps the anti-fabrication clause`);
      assert.equal(json.exit_code, res.status, `${verb}: the envelope's exit_code must equal the process exit`);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
```

- **State: PREPPED. Apply only when `fix_go5.md` lists C1** (patch + pin together; then `npm test` scripts leg).

### C2 · `create` NDJSON row scoping (monitors' OBS-T3-1) — **REPRODUCED keyless; ADJUDICATION-PENDING**
- **What:** `create --out <new>/proj.json` stamps its `cli.invocation` row into `<cwd>/.rapidtool/logs/rapidtool.ndjson`, never the created project's log dir. Live: T1 ran with cwd=repo ⇒ the repo log holds the trial's `create exit 0` rows; each project's own log starts at `gate_c0`.
- **Keyless repro (mine):** `f2_scratch/repro_create_scope.sh` (run `repSCOPE2_uFxSGi`): create EXIT 0, `sub/proj.json` written; create row present in `W/.rapidtool/logs` (1 row, `payload.cmd="create"`), `W/sub/.rapidtool/logs` **absent**. (An earlier run also proved the row follows cwd, not `--out`.)
- **Mechanic:** `CLI_PROJECT` is set only from `--project` (:628); `create` carries its target in `--out`; `resolveLogDir(null)` → `cwd/.rapidtool/logs` (`src/lib/runtime-log.server.ts:47-57`). The doc's split ("project command logs next to its project; global commands use cwd") does not name `create`.
- **Adjudication:** both readings are defensible — (A) stamp into the new project on success (complete lifecycle log; invoker's log un-polluted); (B) keep cwd (operator-scope invocation; the project doesn't exist until it does). T3 marked it "product/T1 — should create seed the new project's log? Monitor does not fix." **Not a [NEW-BUG]; do NOT apply blind.**
- **IF adjudicated (A) — minimal patch sketch (LF):** in the create arm, after `h.saveProject(out, project);` and before `respond(…, 0)` (~:714-718): `CLI_PROJECT = out;` (comment: "326 F2b C2 — the exit row belongs next to the project this command CREATED; failure paths above still stamp cwd because no project exists"). Pin sketch (same test style): after create, assert an `event:"cli.invocation"` row with `payload.cmd==="create"` exists under `<outdir>/.rapidtool/logs`, and (optionally) that the cwd log holds none.

## Keyed eval-leg watch — snapshot + rules (prep)

- Default out dir: `research/eval-out` (`run-eval.mjs:149`; `EVAL_OUT_DIR` overrides). Writes `results.json` + `history.json` at END of a run; kill-safety marker `run-in-progress.json` (`RUN_MARKER_NAME` @:2782).
- **Current (pre-leg) state:** `results.json` mtime **2026-09-29 16:46:03**, `mode:"keyed"`, entries 1 (`coffeehouse2home-property-ledger`, mean **0.3333**, status "dod", passAtK passed 0/1, skipped 1). `history.json` mtime **2026-09-24 19:03:43** (40 rows; last keyed rows 0.5556 / 0.6667 / 0.3333). Any NEW mtime / new history row = a new leg landed.
- **On the leg landing** (T1 runs `node scripts/run-eval.mjs --keyed --limit=1`): read output READ-ONLY — mode banner, per-entry scoring, whether the graded run advances past P0 (the fixture fix's whole point; pre-fix failure mode was forceHuman P0 → autopilot stall, 2/9 mean 0.2222 per `fixes/321_d3_keyed_eval.md:159-176`). If scoring stalls on fixture/grader (not product) → prep fixture/grader patch text with evidence. If clean → record the numbers.

=== END 326_f2_watch — IN PROGRESS (F2b continuation; next poll ~10:18) ===

---

# CONTINUATION — F2d (APPLIER · window #5 close-out; 2026-10-01 10:49 CDT)

Window #5 applied its prepped patches with the campaign QUIESCED (`fix_go5.md` present; 0 keyed runs in flight). F2c (apply lane) hit its turn cap after landing C1 + C2 + PREP-3; F2d — this lane — reproduced and fixed the T3 `doctor --tree` [NEW-BUG], ran the scoped proofs, and CLOSES this log. Every spawn keyless (`DEEPSEEK_API_KEY` unset — verified per run), spawn cwd = mkdtemp dirs; never the repo cwd, never rt.sh.

## Predecessor APPLIED states (F2c — verified; pasted per handoff)

- **C1 APPLIED both sites** (approve ~:1029 / reject ~:1198; explicit remedy; pin #13 in taxonomy). Post-apply anchors in the working copy: guard comments :1037 / :1219, remedy strings :1050 / :1228. Error/code bytes unchanged (`No pending gate to {approve,reject} (status: …).` · `RT_E_GATE_PENDING` · exit 1); the remedy now names the real next step (`diagnose` → `gate`; "repaired, not approved"; "never fabricate a decision").
- **C2 APPLIED** (`CLI_PROJECT = out;` in the create arm at :713 + pin #18; positive row under `<outdir>/.rapidtool/logs` + negative cwd row).
- **PREP-3 APPLIED** (`drive_exp.py:145` reads `summary.failedGates` first w/ legacy top-level fallback; `py_compile` OK — re-verified this lane: `PY_COMPILE_OK`).
- **Counts (F2c handoff, before F2d legs):** taxonomy 18/18 · run-eval 48/48 · busy 6/6 · eslint clean · `node --check` SYNTAX_OK · LF preserved (0 CR bytes).

## F2d — T3 [NEW-BUG] `doctor --tree` path honesty — REPRODUCED + FIXED

**Keyless repro matrix** (script `t3_scratch/f2d_repro/repro.sh pre|post`; tree = mkdtemp with `src/jobs/deliver_core_workflow.ts` TODO(E-15) stub; KEY=UNSET; cwd=run mkdtemp). Raw: `pre_*.out` / `post_*.out` (stderr 0 bytes on every leg — no stacks):

| leg | `--tree` arg | PRE-fix | POST-fix |
|-----|--------------|---------|----------|
| nopath (msys base) | `/c/…/tree/NOPE_XYZ` | exit 0 · ok:true · scanned `C:\c\…\NOPE_XYZ` · stubs 0 | exit 1 · `RT_E_VALIDATION` · "does not exist — nothing to scan." |
| win_nopath | `C:\…\tree\NOPE_XYZ` | exit 0 · ok:true · stubs 0 (**false-clean**, no mangling needed) | exit 1 · `RT_E_VALIDATION` |
| msys | `/c/…/tree` | exit 0 · ok:true · scanned `C:\c\Users\…\tree` (**mangled**) · stubs 0 | exit 0 · scanned `C:\Users\…\tree` · **stubs 1** (= win census) |
| win | `C:\…\tree` | exit 0 · stubs 1 (control) | unchanged · stubs 1 |
| posix | `/tmp/f2d-not-a-mapped-drive` | exit 0 · ok:true · scanned `C:\tmp\…` (mangled) · stubs 0 | exit 1 · `RT_E_VALIDATION` · POSIX-style refusal |

Matches T3's dryrun bytes (`dryrun_doctor_nopath/msys/win.txt`) exactly. Bare `doctor` (no `--tree`) still exit 0 (`post_bare.out`).

**Adjudications (both decisions + why):**

1. **Non-existent / non-directory `--tree` → `RT_E_VALIDATION`, exit 1.** Sibling precedent: `edit --dir`'s missing-dir guard (:2208 — nonexistent dir → `RT_E_VALIDATION` exit 1) and the `pathFlagRefusalError` family (create/emit/packet/export/vault/design/diagram flag refusals) — all `RT_E_VALIDATION` exit 1. `RT_E_PATH_KIND_MISMATCH` exists only as a classifyError (errno) mapping; no CLI verb authors it, so introducing it just for the file-as-tree sub-case would be a new authored class with zero sibling precedent. One code for both sub-cases: both are "the `--tree` you named is not a scan-able directory".
2. **MSYS drive form `/c/...` (single letter + `/` or end) → TRANSLATED to `C:\...`** before `resolve()`, win32-gated; **any other POSIX literal → coded refusal** naming the problem + both passing forms. Why translate: git-bash is the repo's documented shell (AGENTS.md) — `/c/…` is what that audience actually types, and the mapping is unambiguous. Why refuse the rest: a non-drive POSIX literal (`/tmp/…`, `/foo`) has no unambiguous win32 meaning; `resolve()` maps it onto a drive root the caller never named (browser-guard.mjs R11-f06 fail-closed class). NEVER silent: a translated scan reports the real path in `scanned`; refusals carry `tree:null`.

**Fix:** `scripts/rapidtool-cli.mjs` doctor arm (:3992, LF) — translation/refusal + `statSync` validation before `h.doctorStatus`; no other verb touched. `scripts/README-cli.md` untouched (its §Doctor makes no `--tree` claim to contradict — the C1 precedent).

**Pins (additive, spawn-based; existing legs untouched):** `scripts/cli-exit-taxonomy.test.mjs` — leg **#19** (non-existent + non-directory refusals + win-form scan control, all platforms) · leg **#20** (win32-gated: MSYS scan inventory `deepEqual` the win-form inventory; non-drive POSIX refusal).

**F2d verified counts (this lane, actual):** taxonomy **20/20** (18 pre-existing + 2 new; 0 fail / 0 skip) · run-eval **48/48** · busy **6/6** · eslint clean (exit 0) on both edited files · `node --check` SYNTAX_OK on both · LF preserved (CR bytes 0 / 0) · `git diff --check` clean · `KEY=UNSET` on every repro leg. Scoped proofs only — no npm test / build / gate.sh, no keyed calls, no repo edits outside `scripts/**` + this log.

=== END 326_f2_watch — COMPLETE ===
