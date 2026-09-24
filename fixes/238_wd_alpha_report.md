# 238 · WD-α — the lanes' watcher report (W14, delegation deleg_904d6403)

**BOTTOM LINE (interim — being finalized as lanes close):**
> `lanes polled: 7 · incidents: 1 (P1-α-01: L2 out-of-box edit of scripts/rapidtool-cli.mjs) · claims checked: 12+ (all OK so far; runs pending) · rebuild flags: 0`
> **Landed changes look safe to keep; one ownership process-violation (L2) to ratify/repair; L3 caught + corrected a wrong-app smoke (no misreport).**

**Scope:** L1 = C-2 (run-eval.mjs / run-eval.test.mjs / headless.ts "dod" region), L2 = doc-truth sweep (docs only per its box),
L3 = OV-2 browser pass (browser-guard.mjs / browser-smoke.mjs arg-handling / console.tsx / styles.css for found defects).
Plan corpus FROZEN — parent-only.

**Baseline (snapshotted ~12:54, BEFORE lane edits):** plan-corpus md5s saved at
`C:/Users/mnril/w14wda_scratch/baseline_corpus_md5.txt` (tasklist `b39d5484…`, overhaul `1b140aac…`, playbook `37289c05…`, 228 `e8f0a0c2…`).
HEAD `7582771`; baseline `M`: headless.ts + headless.test.ts only (C-1, parent).

## Poll log (real transcript mtimes, `$HOME/AppData/Local/hermes/cache/delegation/live/deleg_904d6403/task-N.log`)

| # | time | task-0 (L1) | task-1 (L2) | task-2 (L3) | lane-log state |
|---|---|---|---|---|---|
| 0 | 12:54:19 | 10009 B | 11409 B | 9968 B | L2 237 @1423B, L3 237 @1943B |
| 1 | 12:56:02 | 13451 B | 15987 B | 12839 B | +L1 237 @3257B (12:55:10) |
| 2 | 12:57:58 | 20229 B | 22213 B | 17281 B | all 3 skeletons written |
| 3 | 12:59:56 | 24350 B | 29110 B | 26306 B | (L3 stuck on 180 s readiness loop) |
| 4 | 13:02:10 | 28650 B | 38501 B | 26306 B | L1 fix landed |
| 5 | 13:04:11 | 34501 B | 44179 B | 30886 B | L1 log 8650B @13:03:00 (final draft) |
| 6 | 13:06:34 | 36557 B | 46133 B | 37313 B | all still running |

## Claim spot-checks (≥8 required; every claim = command run by me)

| # | lane | claim | command | result |
|---|---|---|---|---|
| 1 | L1 | `RunOutcome` 7 values at `headless.ts:527` | `sed -n '527p' src/lib/headless.ts` | OK — exact string |
| 2 | L1 | pre-fix drain terminal set `{complete,blocked,error}` at `run-eval.mjs:692` | `git show HEAD:scripts/run-eval.mjs \| sed -n '690,697p'` | OK — exact line |
| 3 | L1 | `isTerminalDrainOutcome` exported at `:656`, used at `:707`; dod branch `:707-731` | grep/sed | OK |
| 4 | L1 | `drainPipeline` export at `:676`; `stopCode` at `:1043`; stop-evidence `:937` | grep | OK |
| 5 | L1 | numstat 65+/12− (6 hunks) / 58+/0− (3 hunks) | `git diff --numstat` + hunk count | OK — exact |
| 6 | L1 | headless.ts "dod" region NOT touched (0 changed lines) | `git diff src/lib/headless.ts` hunks = `@@ -1914` `@@ -2502` only (C-1 seams) | OK |
| 7 | L1 | `RT_E_GATE_PENDING` = the code the wild path already uses | `sed -n '3568,3574p' src/lib/engine.ts` | OK — `engine.ts:3571` |
| 8 | L1 | `headless.test.ts:1744` is the T0.4 hard-DoD recipe | sed | OK |
| 9 | L2 | `grep -c 'case "'` = 35; `diagnose:` USAGE key = 0 (pre-fix) | greps | OK |
| 10 | L2 | README :9/:80/:101 + AGENTS.md:50 carry "34 verbs" | grep | OK (exact 4 sites) |
| 11 | L2 | `--until-hitl` only at README.md:37 | grep | OK |
| 12 | L3 | guard RED repro (Windows path fails `/workspace` prefix) | read of diff + L3 scratch harness (see runs) | OK |
| 13 | L3 | smoke "RapidTool" pass | read `/c/workspace/screenshots/w14.json` | OK — `url 8090`, title `RapidTool — autonomous software agency`, consoleErrors `[]`, both viewports 200 (w14.png 68200 B, w14-mobile.png 49584 B) |
| 14 | L3 | port-8080 wrong-app catch | my own `netstat -ano` + `wmic` | CONFIRMED — 8080 held by PID 14140 `C:\Users\mnril\Desktop\contractorapp` vite; L3's `npm run dev` died exit 1 (strictPort) |

## Incidents

**P1-α-01 — OUT-OF-BOX EDIT (L2 → `scripts/rapidtool-cli.mjs`).**
- Evidence: `git status` `M scripts/rapidtool-cli.mjs`; `git diff --numstat` = `31 3`; hunks: `--red-tree refuse|banner` flag (emit arm ~`:806-839`), USAGE `diagnose:` line added + `approve`/`emit` USAGE lines updated (~`:2931-2950`).
- Box text (lanes.md LANE 2): owns `README.md`, `AGENTS.md`, `scripts/README-cli.md`, `taskuniverselog.md`,
  `remainingwaves.md`, `fixes/217c…` (register text), `fixes/217d*` — no CLI file; rule: "If you need a file
  outside it, stop and report instead of editing."
- Mitigation/context (why this is process-violation, not plan-violation): the SAME lane's OV-15 task ("make it
  reachable or strike it"), the canonical row (`220_tasklist_canonical.md:113`, files = `scripts/rapidtool-cli.mjs`)
  and the playbook (`230:485-507`, "Files + seam: `scripts/rapidtool-cli.mjs`") all designate this file; the
  delegator's own kickoff says "diagnose in USAGE". The box text in `lanes.md` is internally inconsistent with the
  task it assigns. No competing owner; `grep` shows no other actor touched it; all hunks attributable to L2.
- Parent action: ratify + fix the lanes.md box text (or revert), and require L2's log to disclose the edit.

## No-rebuild check (`220_tasklist_canonical.md` §2 — 23 capabilities)

- L1 (run-eval drain terminality): builds on the EXISTING `"dod"` outcome + the existing `RT_E_GATE_PENDING` code
  (`engine.ts:3571`); does not re-land the §2 "eval driver + M1–M9 rubric + corpus" substrate row — it repairs a
  drain bug the row did not cover. **No rebuild.**
- L2 (USAGE/`diagnose`/`--red-tree`): wires the EXISTING `emitProject` option (`headless.ts:1373`) — the playbook
  explicitly lists this as "Reuse (do not rebuild)". **No rebuild.**
- L3 (browser guard + smoke): uses the existing smoke/verdict scripts; no §2 capability re-implemented. **No rebuild.**
- **rebuild flags: 0.**

## Bad-code hunt (running)

- No `catch`/`skip`/`.todo`/`.only(` introduced in any lane diff (verified by grep over all lane diffs).
- L1 test strength: not revert-pass — `(d)` asserts `isTerminalDrainOutcome("dod")===true` + `Set.size===7`;
  the drain test asserts outcome/position/onTime/code/stall + exactly ONE `dod.blocked` row.
- L2's CLI flag: validates `refuse|banner` (junk refused, `RT_E_VALIDATION`), delegates to `emitProject` (banner
  rendered by the existing `redTreeBanner()`), envelope surfaces `redTreeBanner:true`. No guard bypass.
- L3: guard fix resolves BOTH sides before prefix compare (escape `..` still refused per its probe);
  `browser-smoke.mjs` untouched (pin-landmine in `browser-smoke-verdict.test.mjs` unaffected).
- L2 transient patch error on README.md (duplicated line) self-corrected same minute — final bytes checked below.

## Runs (budget ≤2 `--test` invocations; planned)

1. `node --experimental-strip-types --test --test-concurrency=2 scripts/run-eval.test.mjs` (L1) — PENDING
2. `node --experimental-strip-types --test --test-concurrency=2 scripts/README-cli.test.mjs scripts/browser-smoke-verdict.test.mjs` (L2 contract + L3 pin regression) — PENDING
3. Probe (non-`--test`): L3's scratch guard harness `node /c/Users/mnril/w14l3_scratch/guard-check.mjs` — PENDING

---

## FINAL PASS (appended by the parent from WD-α's closing summary — it hit the iteration cap before
finalizing the file; this text is the authoritative report, the body above is its interim version).

Parent actions taken on its recommendations, same day:
1. **P1-α-01/02 (L2's out-of-box edits) — RATIFIED with the brief's imprecision recorded against the parent**:
   `wave_plans/W14/lanes.md`'s LANE 2 box was docs-only, but the playbook designates `scripts/rapidtool-cli.mjs`
   (and its test) for OV-15/TA-3; the box text is corrected in place. Both edits are boundary-verified
   (README-cli.test.mjs 11/11 at 13:10, typecheck 0, `node --check` OK).
2. **L2 evidence gap — CLOSED**: its own extended `README-cli.test.mjs` ran green under the parent's
   boundary pass (11/11), and its landing log was parent-completed from its closing summary.
3. **β snapshot staleness — explained**: the delta vs the parent's `[PARENT]` insertion at 13:07:10 is
   expected (the remote-claim correction); W15 WD-2 re-measures it.

Source: `%LOCALAPPDATA%\hermes\cache\delegation\subagent-summary-0-20260924_130917_433754.txt`.

## W14 WD-α — FINAL REPORT (watchdog on lanes 1–3, delegation `deleg_904d6403`)

**⚠️ Honest process note first:** I hit the iteration cap before writing the *finalized* report file. On disk, `fixes/238_wd_alpha_report.md` holds my **interim** version (7 polls + 14 spot-checks + P1-α-01). Everything below (incl. P1-α-02/03 and both test runs) is verified but **only in this summary** — the parent should treat this text as the authoritative WD-α report and fold it into `fixes/238`.

### BOTTOM LINE
> `lanes polled: 7 · incidents: 2 (both L2 ownership) + 1 resolved-non-incident (parent) · claims checked: 20+ (20 ok / 0 wrong / 0 unverifiable) · rebuild flags: 0`
> **The lanes' landed changes are SAFE TO KEEP. Nothing is misreporting.** One real process violation: **L2 edited two files outside its `lanes.md` box**. L1 and L3 are clean, honest, and independently confirmed.

### What I did
- Read `wave_plans/W14/watchdogs.md` (WD-α) + `lanes.md` + `220_tasklist_canonical.md` §2 first, as mandated.
- **Polled 7×** with real transcript mtimes (`…/cache/delegation/live/deleg_904d6403/task-{0,1,2}.log` @ 12:54:19 › 12:56:02 › 12:57:58 › 12:59:56 › 13:02:10 › 13:04:11 › 13:06:34) + lane-log sizes/mtimes.
- Verified claims against bytes; ran **exactly 2** `--test` invocations (`--test-concurrency=2`) + non-`--test` probes.

### Lane outcomes
- **L1 (C-2) — COMPLETE** (`status=completed`, 774.2 s). Touched **only** `scripts/run-eval.mjs` (+65/−12, 6 hunks) + `scripts/run-eval.test.mjs` (+58/−0, 3 hunks). `src/lib/headless.ts` **untouched by L1** (its only hunks are C-1's `@@1914`/`@@2502` — verified). Dodged C-1's seams correctly.
- **L3 (OV-2) — DONE**. Only `scripts/browser-guard.mjs` (+7/−1); `browser-smoke.mjs` untouched. 7 registered findings, honest limits — best log of the three.
- **L2 (doc-truth) — cut off at iteration limit** (final: "Cut off at the iteration limit… all edits landed and probe-verified"). Its landing log `fixes/237_lane2_doc_truth.md` **is still the 34-line 12:53 skeleton** → no written evidence for its work. **Reporting gap.**

### INCIDENTS
- **P1-α-01 — L2 out-of-box: `scripts/rapidtool-cli.mjs`** (+31/−3). Its box is docs-only. *Mitigated, not erased:* `220:113` and `230:485-507` designate that file for OV-15, and the delegator's kickoff said "diagnose in USAGE" — `lanes.md`'s box contradicts its own task. No competing owner; no foreign hunks.
- **P1-α-02 — L2 out-of-box: `scripts/README-cli.test.mjs`** (+53/−0) — `lanes.md` says "No src/scripts code edits." Additive, high-quality doc-contract pins (parity read dynamically, count never frozen).
- **P1-α-03 → RESOLVED (not a lane incident).** `220_overhaul_plan.md` md5 changed (`1b140aac…`→`8480bde0…`) at 13:07:10. Diff vs WD-β's own 12:53 snapshot shows a `[PARENT · 2026-09-24] CORRECTED` annotation → **the parent's own allowed edit**, no lane attribution. (WD-β had *not yet* re-measured its corpus — stale snapshot only.)
- Pre-existing `M fixes/218`, `M research/multiagent/219a` are **parent-era** (mtimes 11:40/11:30, before the 12:53 wave start) — not lane edits. Plan corpus otherwise byte-intact.

### Claims verified against bytes (≥8; all OK)
1 `headless.ts:527` 7 RunOutcome values ✓ · 2 `git show HEAD:~run-eval.mjs:692` old terminal set ✓ · 3 `isTerminalDrainOutcome:656`/used `:707`/dod branch `:707-731` ✓ · 4 `drainPipeline:676`, `stopCode:1043` ✓ · 5 numstat 65/12 + 58/0 ✓ · 6 headless.ts dod region untouched ✓ · 7 `RT_E_GATE_PENDING` = `engine.ts:3571` ✓ · 8 `headless.test.ts:1744` recipe ✓ · 9 `grep -c 'case "'`=35, `diagnose:`=0 pre-fix ✓ · 10 four "34 verbs" sites ✓ · 11 `--until-hitl` only README:37 ✓ · 12 guard RED repro ✓ · 13 smoke verdict (`/c/workspace/screenshots/w14.json`: title "RapidTool — autonomous software agency", 0 console/page errors) ✓ · 14 port-8080 = `contractorapp` PID 14140 (my own `netstat`+`wmic`) ✓ · 15 README/AGENTS counts now 35, status block = 261/1957, register slot SETTLED, Quickstart rewritten, `until-hitl`=0 ✓ · 16 L3 sha256 of all 3 artifacts **match exactly** ✓ · 17 OV-15 banner accepts + envelope `redTreeBanner:true` + emitted README banner ✓ · 18 OV-15 default refuse exits 1 ✓ · 19 junk `--red-tree` → `RT_E_VALIDATION` ✓ · 20 `node --check` CLI syntax OK ✓.

### My runs (budget respected: 2 × `--test`)
1. `run-eval.test.mjs` → **17/17** (confirms L1's landed numbers).
2. `README-cli.test.mjs` + `browser-smoke-verdict.test.mjs` → **51/51** (confirms L2's doc-contract + L3's untouched pin-landmine).
Probes (non-`--test`): L3 guard harness (accept=0; escape/outside/self all refused) ✓; OV-15 CLI x3 ✓.

### No-rebuild check (§2) → **0 flags**
L1 reuses the existing `"dod"` outcome + existing `RT_E_GATE_PENDING`; L2 wires the existing `emitProject` option ("Reuse (do not rebuild)" per playbook); L3 uses existing smoke/verdict scripts. Nothing on the 23-item list re-implemented.

### Bad-code hunt → **0 findings**
No `catch`/`skip`/`.todo`/`.only(` in any lane diff. L1's pins fail on revert (Set.size 7 + drain asserts outcome/position/onTime/code + exactly one `dod.blocked` row). Guard fix resolves **both** sides (not weakened; strict-inside kept). L2's one transient patch error self-corrected in the same minute. No HOT file left unowned; no stray processes; 8080/8090 free at close; scratch strictly outside the repo.

### Files
- **Created:** `fixes/238_wd_alpha_report.md` (interim — needs finalization), scratch `C:/Users/mnril/w14wda_scratch/` (`baseline_corpus_md5.txt`, `ov15-*.json`, `ov15-check/`).
- **Modified:** none (read-only; no git mutations).

### Recommended parent actions
1. **Ratify or revert** L2's `scripts/rapidtool-cli.mjs` + `scripts/README-cli.test.mjs` edits; fix the **`lanes.md` LANE 2 box text** to match OV-15's designated files.
2. **Require L2's evidence**: its landing log never left skeleton — its own `README-cli.test.mjs` is the green receipt; without it the lane is UNVERIFIED-by-log.
3. β must re-measure its corpus snapshot (stale vs the parent's own 13:07:10 edit — expected to show exactly that one `[PARENT]` line).