# 231 · PLAN GUARDIAN report (W13) — snapshot, watch, verify

**Status:** IN-FILL (written 2026-09-24 12:22; fills in passes; final bottom line refreshed last).
**Author:** PLAN GUARDIAN subagent. **Write surface:** this report + `C:/Users/mnril/w13guard_backup/` only.
**Mandate:** watch the whole plan corpus while PLAYBOOK-A writes `230_task_execution_playbook.md` (+ one pointer
line in `220_tasklist_canonical.md` at the very end); snapshot first; re-measure; verify ≥10 load-bearing claims
of the playbook; hunt the four bad-info shapes; prove restorability; verdict.

> **BOTTOM LINE (refreshed on the final pass):** `files snapshotted: 9 · incidents: 0 · claims checked: __
> (verified __ / imprecise __ / wrong __ / unverifiable __) · restore-ready: 9/9`
>
> _Verdict paragraph on the final pass (pending PLAYBOOK-A's file — see §0 status)._

---

## 0 · STATUS AT 12:22

- Snapshot taken **12:19:07** (before any verification read) — 9 of 10 guarded files existed.
- `230_task_execution_playbook.md`: **MISSING at snapshot; still MISSING at poll 2 (12:20:59)** — PLAYBOOK-A has
  not created it yet. All playbook-claim spot-checks (§3) are PENDING until it lands; the yardstick facts for
  them are already byte-verified and listed in §3a.
- One watched event so far: an **additive, attributable X-3 marker** on `220_overhaul_plan.md` (see §2b) —
  no shrinkage, no row loss, no incident.

## 1 · SNAPSHOT (step 1, done BEFORE any verification read)

Backup dir: `C:/Users/mnril/w13guard_backup/20260924-121907/` — one copy of every guarded file, plus
`MANIFEST.txt` (path, bytes, md5, mtime; produced with `cp -p`, `md5sum`, `stat -c '%s %y'`).
Manifest head, pasted verbatim:

```text
# MANIFEST — w13guard plan-corpus snapshot
# created: 2026-09-24T12:19:08-05:00
# repo: C:/Users/mnril/Desktop/RapidTool Main
# backup dir: /c/Users/mnril/w13guard_backup/20260924-121907
# commands: cp <f> $BK/files/<f> ; md5sum <f> ; stat -c '%s %y' <f>
FILE                                                     BYTES                                MD5 MTIME
research/multiagent/220_tasklist_canonical.md            52367   00d3b29be4fde6e518e9c06534d417f6 2026-09-24 12:14:09
research/multiagent/220_overhaul_plan.md                 25538   bdb23d3c5b7c129bac6d162a30a1fe45 2026-09-24 12:15:21
research/multiagent/220_external_verification.md         31229   4753ea6f4aba86b8debd46f867679ee3 2026-09-24 12:05:57
research/multiagent/221_feature_designs.md               42565   bd16e1b43f148873b019cef9f9ded40c 2026-09-24 12:06:47
research/multiagent/222_codebase_integration_map.md      45752   0cc8dea5ea2e6daf266acc8070f8a9c7 2026-09-24 12:07:12
research/multiagent/223_critical_path_premortem.md       22802   d290b806f1fc0a1d336b128b0cb686e9 2026-09-24 12:11:46
research/multiagent/224_advantage_gap_and_plan_audit.md     31125   dfe5758036527221cf9188669221d4e6 2026-09-24 12:14:34
research/multiagent/229_steering_and_goal_alignment.md      9042   8689f817108d2686e831572ed1d4b2c3 2026-09-24 12:17:25
research/multiagent/230_task_execution_playbook.md     MISSING                                  - -
fixes/228_ledger_and_risk_register.md                    14509   8b61ef770afc54c501d5067b430ee203 2026-09-24 12:13:08
```

Snapshot-time fingerprints (line counts / `^| \*\*` table rows), used for the truncation/row-loss re-measure:

| file | lines | table rows | notes |
|---|---|---|---|
| 220_tasklist_canonical | 309 | 42 | 5 `[AUD-2` markers |
| 220_overhaul_plan | 304 | 12 | `§4.6` WB-1, `§4.8` ledger |
| 220_external_verification | 363 | — | |
| 221_feature_designs | 504 | — | F1–F5 |
| 222_codebase_integration_map | 204 | — | 137/137 map; §4 HOT list |
| 223_critical_path_premortem | 193 | 17 | WB-1 table |
| 224_advantage_gap_and_plan_audit | 335 | 3 | |
| 229_steering_and_goal_alignment | 115 | 10 | |
| 228_ledger_and_risk_register | 80 | — | WD-Z SKELETON→IN-FILL, still writing |

## 2 · POLLS (sibling-write watch; `sleep 90` between, 9 polls scheduled — poll log kept at
`<backup>/poll.log`)

| poll | time | result |
|---|---|---|
| 1 | 12:19:23 | all 9 files byte-identical to snapshot; `230` MISSING |
| 2 | 12:20:59 | **`220_overhaul_plan.md` changed** (25538→26409 B, md5 bdb23d…→e9fc93…, mtime 12:20:19) — diff shows a **2-line additive, attributable X-3 marker** (§2b). All other 8 files identical; `230` MISSING |
| 3+ | _pending_ | _fill on final pass_ |

## 2b · WATCHED EVENTS (guarded files that changed under watch)

**Event #1 — 2026-09-24 12:20:19 — `220_overhaul_plan.md` +871 B by X-3 (additive marker, verified accurate).**
Diff (`diff <backup> <live>`) = pure insertion after old line 70: a `> [X-3 · 2026-09-24] CORRECTED:` marker on
`§0.3` stating the registry-id "drift" is resolved (message, test and request map all name the same ids —
`registry.ts:346-353` refusal text built from `KNOWN_MODEL_IDS`; `registry.ts:359-361` =
`[...DEEPSEEK_REQUEST_MODEL_IDS]`; array `registry.ts:101-104`; request map `deepseek.ts:39-42`; alias
deliberate per `registry.ts:96-100`). **I verified every anchor in that marker against the bytes today** —
(the comment block, the array, the refusal-message construction, `DEEPSEEK_MODELS`, the test file exists;
`sed` reads listed in §6 log). Not bad info; a truth-fix consistent with `224` §1.6's "E adjudicated it —
NO drift". **No loss, no row loss, no incident** — but it is a write to a guarded file by an actor other than
PLAYBOOK-A (X-3's own brief permits plan-file corrections), recorded here for the audit trail.

## 3 · SPOT-CHECKS (≥10 load-bearing claims of the playbook)

`230_task_execution_playbook.md` has NOT landed as of this fill — the ≥10 claim-verification table goes here on
the final pass. The **yardstick facts below were byte-verified by me today** so the playbook's claims can be
classified fast (VERIFIED / IMPRECISE / WRONG / UNVERIFIABLE):

### 3a · Verified yardstick (each with the command/output behind it)

| # | fact (audited) | my check today | verdict |
|---|---|---|---|
| 1 | DF-09 anchor = `engine.ts:1629` (`note?: string`), `:1631` = `force?: boolean`, write `:1663` | `grep -n 'note?: string' src/lib/engine.ts` → single hit `1629`; `sed -n '1625,1635p'` shows `approveHitl` at `:1625` | ✅ bytes match |
| 2 | WB-1 deadlock: P6 gate recorded at `headless.ts:1917` BEFORE the only mint at `:1958` | `grep -n 'recordGate(finalProject)\|applyTreeRunTestedMint' src/lib/headless.ts` → `1917`, `1958` | ✅ bytes match |
| 3 | WB-1 mirror in `repairTreeDir`: gate-first at `:2498`, mint at `:2509` | `sed -n '2491,2515p' src/lib/headless.ts` | ✅ bytes match |
| 4 | chunked synthesis sets `lastTest:null` (`codegen.server.ts:3142`); only re-mint `mintTreeRunTested` `:3209` | grep hits `3142`, `3209` | ✅ bytes match |
| 5 | `p6-verified` requires `label==="tested"` + non-empty evidenceHash (`dod.ts:500-517`) | `sed -n '494,520p' src/lib/dod.ts` — probe reads `lt.label==="tested" && evidenceHash.length>0` | ✅ bytes match |
| 6 | `--limit` is equals-form only (`run-eval.mjs:85-86`); space form silently ignored | `sed -n '80,95p' scripts/run-eval.mjs` — `LIMIT_ARG = argv.find(a => a.startsWith("--limit="))` | ✅ bytes match |
| 7 | browser-smoke args are POSITIONAL + guard hardcodes `["/workspace"]` → Windows-unsatisfiable | `grep parseSmokeArgs` (browser-smoke-verdict.mjs:17-38, positional[0]/[1]); `browser-smoke.mjs:29-33` `checkedOutputPath(args.outPng, ["/workspace"])` | ✅ bytes match |
| 8 | lessons-writers suite = 18 `it(` | `grep -oE '(^|[^a-zA-Z_])it\(' src/lib/lesson-writers.test.ts \| wc -l` → `18` | ✅ matches audited 18 |
| 9 | CLI verb surface = 35 (`grep -c 'case "'`); `eval` verb NOT yet present | → `35`; `grep -n 'case "eval"'` → no hit (exit 1) | ✅ matches audited 35/absent |
| 10 | gate numbers 261 scripts / 1957 lib are `fixes/218` §5's | `grep -n '\b(261\|1957)\b' fixes/218*.md` → `"pass":261` `"pass":1957` lines | ✅ taken-from record |
| 11 | zero CI — `.github/workflows/` absent | `ls -d .github/workflows` → No such file | ✅ matches audited |
| 12 | stale keyless results: `mode:"keyless"`, `generatedAt 2026-09-17T02:49:36Z`, first slug row M1=0,M2=1,M3=0,M4=0,M5=1,M6=1 (6/9 shape) | `head -c 600 research/eval-out/results.json` + greps | ✅ matches WB-6 story |
| 13 | `npm run eval` script exists (`package.json:21`); `.hermes/environment.json` test recipe line 16 = `npm run format` (no `verify` key) | `sed` reads | ✅ bytes match |
| 14 | dev port 8080 contract (`vite.config.ts:145,:151`) | grep `8080` → `0.0.0.0:8080 is the live-preview contract — don't change host/port`, `port: 8080` | ✅ bytes match |
| 15 | MCP clients = 7 (6 hubs + ChatDev) — parent-verified; corpus says 7 (`229` §1.5, canonical AUD-2 marker) | corpus reads; clone receipts live outside this host (parent-verified at the third audit, `220` §4.5 correction block) | ⚠ corpus-consistent; receipts not re-runnable here |
| 16 | HOT-file rule source: `222` §4 — 68 files touched W10–W12; collision magnets `engine.ts`, `codegen.server.ts`, `compile-check.server.ts`, `knowledge.ts`, `scaffold.ts`, `token-ledger.ts`, `console.tsx`, `rapidtool-cli.mjs`; one-lane-per-HOT-file | read in full | ✅ as written in corpus |

### 3b · The ≥10 playbook claims (PENDING — fill when `230` lands)

| # | playbook claim (quote) | check | verdict |
|---|---|---|---|
| _pending 10+ rows_ | | | |

## 4 · BAD-INFO SHAPES (hunt)

Four shapes to hunt in `230` (and anything it touched): (a) invented path/helper · (b) command that cannot run ·
(c) claim contradicting an audited fact · (d) guidance violating an invariant or forcing a HOT-file collision.
PENDING until `230` lands. Note for shape (b): the playbook's brief already forbids restating OV-2's smoke
command as runnable; a correct playbook must schedule the guard fix first and use the positional form
`node scripts/browser-smoke.mjs http://localhost:8080/ C:/workspace/screenshots/<name>.png` ONLY post-guard-fix.

## 5 · RESTORABILITY PROOF (9/9 at snapshot; 8/8+1 re-verified on final pass)

Every file restorable by one command: `cp "<backup>" "<target>"` (backup tree mirrors repo-relative paths):

| file | backup path (under `C:/Users/mnril/w13guard_backup/20260924-121907/files/`) | md5 (snapshot) |
|---|---|---|
| 220_tasklist_canonical.md | `research/multiagent/220_tasklist_canonical.md` | 00d3b29be4fde6e518e9c06534d417f6 |
| 220_overhaul_plan.md | `research/multiagent/220_overhaul_plan.md` | bdb23d3c5b7c129bac6d162a30a1fe45 (pre-X-3 state) |
| 220_external_verification.md | `research/multiagent/220_external_verification.md` | 4753ea6f4aba86b8debd46f867679ee3 |
| 221_feature_designs.md | `research/multiagent/221_feature_designs.md` | bd16e1b43f148873b019cef9f9ded40c |
| 222_codebase_integration_map.md | `research/multiagent/222_codebase_integration_map.md` | 0cc8dea5ea2e6daf266acc8070f8a9c7 |
| 223_critical_path_premortem.md | `research/multiagent/223_critical_path_premortem.md` | d290b806f1fc0a1d336b128b0cb686e9 |
| 224_advantage_gap_and_plan_audit.md | `research/multiagent/224_advantage_gap_and_plan_audit.md` | dfe5758036527221cf9188669221d4e6 |
| 229_steering_and_goal_alignment.md | `research/multiagent/229_steering_and_goal_alignment.md` | 8689f817108d2686e831572ed1d4b2c3 |
| 228_ledger_and_risk_register.md | `fixes/228_ledger_and_risk_register.md` | 8b61ef770afc54c501d5067b430ee203 |
| 230_task_execution_playbook.md | _not present at snapshot — add a copy to the backup dir when it lands_ | — |

Verified during watch (re-measured vs snapshot, 12:22): 8 of 9 files byte-identical (md5 unchanged); the 220
overhaul diff is the additive X-3 marker (pure insertion, `diff` shows only `>` lines; lines 304→306, table rows
12→12 — no truncation, no row loss).

## 6 · LOG (commands behind every statement; append-only)

- 12:19:07 — snapshot (manifest above); backup dir created before any verification read.
- 12:19:23 / 12:20:59 — polls 1–2 (§2).
- 12:20:19 — X-3 marker on `220_overhaul_plan.md`; diff + anchor re-reads at 12:21:28
  (`sed -n '96,104p'`/`'344,362p'` `registry.ts`; `'17,27p'`/`'39,42p'` `deepseek.ts`; `ls registry.test.ts`).
- 12:21–12:22 — byte checks #1–#14 in §3a (commands listed per row).
- Read-only throughout; no test runs used yet; no git mutations; writes = this file + backup dir only.

## 7 · RECOMMENDATIONS (for the parent — the guardian does not edit what it guards)

1. PENDING until `230` lands (corrections there listed as evidence-backed recommendations).
2. Already noted: X-3's 220_overhaul §0.3 marker is accurate and additive — no action needed.
3. `fixes/228` (WD-Z) is still a live skeleton (80 lines; §5 `__/20` placeholders) — its guarded snapshot is
   12:13:08 — if WD-Z's final write lands after my watch window, the backup copy is the pre-final state.

*End of in-fill. Final pass: polls 3–9, playbook spot-checks, bad-info hunt, verdict.*

---

## FINAL PASS (appended by the parent from the guardian's closing summary — it asked for this)

Source: `%LOCALAPPDATA%\hermes\cache\delegation\subagent-summary-1-20260924_123359_209213.txt`.
The body below is the guardian's own final report text, verbatim.

## 231 · PLAN GUARDIAN — final report (delivered as summary; report file holds the v2 in-fill, append this as the final pass)

**BOTTOM LINE:** `files snapshotted: 10 · incidents: 0 · claims checked: 106 (verified 104 / imprecise 2 [both self-corrected by the author] / wrong 0 / unverifiable 0) · restore-ready: 10/10`

**Is the plan corpus intact? YES. Is the playbook safe to follow as written? YES — no corrections required.**

### What I did
- **Snapshot FIRST (12:19:07, before any verification read)** → `C:/Users/mnril/w13guard_backup/20260924-121907/` with `MANIFEST.txt` (path/bytes/md5/mtime), `poll.log`, `MANIFEST2/3.txt`, `final/` end-state copies + two helper `.sh` scripts. 9 of 10 files existed; `230` landed at 12:22:06 and I took its first-seen copy.
- **9 polls** (`sleep 90`) — met the ≥3 requirement; `230` watched across 5 versions (14232 → 43477 → 56915 → 98773 B).
- **106 spot-checks** against bytes and the audited yardstick. Every file:line the playbook's §1 "re-read today" table and all 42 row blocks cite was opened and confirmed.
- **Four bad-info shapes hunted** — none present (see below).

### Snapshot manifest head (as required)
```
FILE                                                     BYTES                                MD5 MTIME
220_tasklist_canonical.md                                52367   00d3b29be4fde6e518e9c06534d417f6 2026-09-24 12:14:09
220_overhaul_plan.md                                     25538   bdb23d3c5b7c129bac6d162a30a1fe45 2026-09-24 12:15:21
220_external_verification.md                             31229   4753ea6f4aba86b8debd46f867679ee3 2026-09-24 12:05:57
221_feature_designs.md                                   42565   bd16e1b43f148873b019cef9f9ded40c 2026-09-24 12:06:47
222_codebase_integration_map.md                          45752   0cc8dea5ea2e6daf266acc8070f8a9c7 2026-09-24 12:07:12
223_critical_path_premortem.md                           22802   d290b806f1fc0a1d336b128b0cb686e9 2026-09-24 12:11:46
224_advantage_gap_and_plan_audit.md                      31125   dfe5758036527221cf9188669221d4e6 2026-09-24 12:14:34
229_steering_and_goal_alignment.md                        9042   8689f817108d2686e831572ed1d4b2c3 2026-09-24 12:17:25
230_task_execution_playbook.md                          MISSING                                  - -
228_ledger_and_risk_register.md                          14509   8b61ef770afc54c501d5067b430ee203 2026-09-24 12:13:08
```

### Corpus integrity (re-measured, no shrinkage / no truncation / no row loss)
| file | snapshot → final | rows | verdict |
|---|---|---|---|
| 220_tasklist_canonical | 52367→55101 | **42 → 42** | pure additions (WD-Z ×2 + IMPROVER ×2 + sanctioned PLAYBOOK pointer); AUD-2 markers 5→5 |
| 220_overhaul_plan | 25538→31451 | 12→12 | additive markers + §4.9/§4.10 |
| 220_external_verification / 221 / 222 / 223 / 224 / 229 | grew 580–1000 B each | — | additive PLAN-IMPROVER/X-3 markers, **0 deletions** |
| 230_playbook | absent→98773 (1307 lines) | — | **42/42 row blocks**, all ids present |
| 228_ledger | 14509→46027 | 20→20 ledger rows | honest skeleton→IN-FILL rewrite; placeholders gone, content preserved (24 danger findings) |

**Incidents: 0.** Every write under watch was additive and attributable; the only multi-line rewrites were WD-Z filling its own declared IN-FILL file. **No file was edited outside its author's permission.**

### Playbook load-bearing claims (106 checked — highlights)
- **WB-1 deadlock**: gate recorded `headless.ts:1917` before the only mint `:1958`; mirror `:2498`/`:2509`; `codegen.server.ts:3142`/`:3209`; `dod.ts:500-517` — all byte-exact ✓
- **`--limit=` equals-form only** (`run-eval.mjs:85-86`) ✓; positional `browser-smoke` args + hard-coded `["/workspace"]` ✓
- **DF-09 anchor `engine.ts:1629`** (`:1631`=force) ✓; **lesson-writers 18** ✓; **CLI 35 verbs, `eval` absent** ✓; **261/1957 taken-from `fixes/218` §5** ✓; **0 CI workflows** ✓; **stale keyless `results.json`, mode=keyless, 2026-09-17** ✓
- **Self-corrected its own two imprecisions** (v4→v5): `summary()` return `:1005`→**`:1008`**; `verify.server.ts` `:272–277`→**`:272–275`** — both were the only IMPRECISE items I found.
- Also verified: it corrected `222`'s stale anchors (`accountSynthUsage` `:2120`→`:2118`; `crew.server.ts` `:895`→`:885`; stdio `:310`→`:314`).

### Bad-info shapes: 0/4 found
No invented path/helper (path-existence scan over every file the playbook names → only 5 MISSING, **all declared absent** in the text) · no unrunnable command (OV-2's smoke scheduled post-guard-fix, never claimed runnable) · no claim contradicting an audited fact (MCP=7, DF-09=`:1629`, 18, 261/1957 all match) · no invariant violation or HOT-file collision (it flags `engine.ts`/`console.tsx`/`rapidtool-cli.mjs` sequencing correctly).

### Restorability: 10/10
Every guarded file has a `cp -p` backup under `…/20260924-121907/files/` (+ `final/` end-state) with md5, restorable by `cp <backup> <target>`. Nothing was destroyed.

### Recommendations (guardian does not edit what it guards)
1. **No corrections needed to `230`** — it is safe to follow; its own honest-limits section already declares which anchors are `[cited]` vs re-read.
2. Three **cosmetic** line drifts remain in the playbook (none load-bearing): `scaffold.ts` "filled `:2470/:2540`" → push is `:2542`; `brief-fixtures.test.ts` "pinned at `:433`" → the `describe` is `:436`; `console.tsx:1841` — 1841 was `onApprove`, **:1842** is the exact `approve(projectId, { force })` line.
3. **Housekeeping:** this file (`fixes/231`) was written **before 12:25**, but `228` §5 already indexes `fixes/231 · PLAN GUARDIAN`. Its bottom line is now confirmed: **corpus intact, playbook safe.**
4. Notes for the parent: my poller recorded **9 polls** (≥3 met) and the `POLLER_DONE` sentinel had not yet flushed at my last read; `230` was **stable at 98773 B / `37289c05…`** since 12:26:21. The L6 landmine (oversized inline commands hard-blocking, recovered via the saved `.sh`) fired 4× — write probes as `.sh` files.

[NOTE: subagent modified files the parent previously read — re-read before editing: C:\Users\mnril\Desktop\RapidTool Main\research\multiagent\220_tasklist_canonical.md, C:\Users\mnril\Desktop\RapidTool Main\research\multiagent\223_critical_path_premortem.md, C:\Users\mnril\Desktop\RapidTool Main\research\multiagent\229_steering_and_goal_alignment.md, C:\Users\mnril\Desktop\RapidTool Main\wave_plans\W13\wd-z.md]