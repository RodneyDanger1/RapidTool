# 233 · IMPROVER GUARDIAN report (W13) — snapshot, watch, verify, guidelines

**Status:** FINAL (2026-09-24 ~12:46). **Author:** IMPROVER GUARDIAN subagent — read-only on plan files.
**Writes:** this report + `C:/Users/mnril/w13guard2_backup/` only. 0 test runs used (0 of ≤2); no typecheck/test/build; no git mutations.
**Subject:** PLAN-IMPROVER (brief `wave_plans/W13/improver-c.md`; deliverable `research/multiagent/232_plan_improvements.md`), watched 12:20:23 → 12:42:43 against a 12:20:23 baseline.

> **BOTTOM LINE:** `files snapshotted: 90 (baseline, whole dir) + 96 (final) · polls: 6 (P1–P6) · insertions verified: 19 (safe 17 / imprecise 2 / bad-info 0 / unsafe 0) · P1 incidents: 0 · restore-ready: 10/10 (8 targets + 232 + 227)`
>
> **VERDICT: the plan corpus is INTACT — yes-with-corrections.** Every target is byte-for-byte additive vs baseline (**0 deleted lines, 0 reorders across all 8 targets**), no forbidden file was touched, no audited fact was contradicted, and all 16 of the improver's insertion points are on disk exactly where its ledger says. **No restore is needed.** Two citations are IMPRECISE and should be corrected at merge: IMP-01's `status` "CLI verb" (no such verb exists — §5.1) and IMP-08's codex line numbers (off by 4–6 lines — §5.2). Recommended correction text is in §8.

---

## 1 · SNAPSHOT (step 1, taken BEFORE the improver's first byte)

**Backup dir:** `C:/Users/mnril/w13guard2_backup/20260924-122023/` — a copy of **every `research/multiagent/*.md` that existed at 12:20:23 (90 files)** + `MANIFEST.txt` (path, bytes, md5, mtime). Taken 12:20:28; the improver's file `232` did not exist yet (created 12:20:37.92) and its first *insertion* landed 12:25:53 — the baseline is genuinely pre-write.
**Final snapshot (post-run, quiescent):** `C:/Users/mnril/w13guard2_backup/_polls/final/` — all 96 files + `MANIFEST-final.txt`. Per-poll copies live in `_polls/P1…P6/` (intermediate states, forensics value).
Whole-dir (not just the 8 targets) because the targets are **UNTRACKED in git** (`git ls-files --error-unmatch` → UNTRACKED for all 8) — a clobber would be unrecoverable except by backup; whole-dir also covers the hot neighbours (227, 230-adjacent) that changed during the window.

Baseline manifest head (the 9 watched files):

```text
31229 | 4753ea6f4aba86b8debd46f867679ee3 | 2026-09-24 12:05:57 | research/multiagent/220_external_verification.md
26409 | e9fc933e38c4a15b23adf769deb0a86e | 2026-09-24 12:20:19 | research/multiagent/220_overhaul_plan.md
52367 | 00d3b29be4fde6e518e9c06534d417f6 | 2026-09-24 12:14:09 | research/multiagent/220_tasklist_canonical.md
42565 | bd16e1b43f148873b019cef9f9ded40c | 2026-09-24 12:06:47 | research/multiagent/221_feature_designs.md
45752 | 0cc8dea5ea2e6daf266acc8070f8a9c7 | 2026-09-24 12:07:12 | research/multiagent/222_codebase_integration_map.md
22802 | d290b806f1fc0a1d336b128b0cb686e9 | 2026-09-24 12:11:46 | research/multiagent/223_critical_path_premortem.md
31125 | dfe5758036527221cf9188669221d4e6 | 2026-09-24 12:14:34 | research/multiagent/224_advantage_gap_and_plan_audit.md
31123 | 6d5eb46ba88d230569f07145e27003d4 | 2026-09-24 12:20:08 | research/multiagent/227_plan_gaps_adversarial.md
9042  | 8689f817108d2686e831572ed1d4b2c3 | 2026-09-24 12:17:25 | research/multiagent/229_steering_and_goal_alignment.md
```

The earlier guardian's independent backup (`C:/Users/mnril/w13guard_backup/20260924-121907/`) exists and is intact — two independent restore points.

## 2 · COLLISION MAP (mtimes at snapshot time, 12:20:23; "hot" = younger than ~3 min)

| file | mtime @ snapshot | risk read |
|---|---|---|
| `220_overhaul_plan.md` | **12:20:19** (4 s before my cp) | collision-risk: written seconds before baseline (a pre-improver writer); later written by parent's merge §4.9/§4.10 @12:32:13 and by the improver @12:25:53/12:32:13-ish — 2 writers interleaved, 0 loss |
| `227_plan_gaps_adversarial.md` | **12:20:08** | collision-risk (X-3 lane finishing); md5 UNCHANGED through the whole window |
| `229_steering_and_goal_alignment.md` | 12:17:25 (~3 min) | borderline hot; improver wrote @12:25:54 |
| `220_tasklist_canonical.md` | 12:14:09 | re-heated **during** the run: WD-Z wrote @12:25:17 + 12:25:37 (+1.4 KB) — my poll caught it mid-write (two distinct byte-states 7 s apart: 53 202 b/313 L → 53 844 b/315 L) — the improver deferred canonical to the post-cooldown pass (12:29:14, 12:33:58) as its ledger says |
| the other 5 targets | 12:05–12:14 | cold at baseline; improver-only writers |
| `230_task_execution_playbook.md`, `232_plan_improvements.md` | absent at baseline | created during the window (230 by PLAYBOOK-A @~12:22–12:26; 232 by the improver @12:20:37) |

**Multi-writer files this window (P1-risk class):** `220_tasklist_canonical.md` carried **4 distinct writers** (AUD-2 ×5 pre-existing markers preserved + WD-Z ×2 + PLAYBOOK-A ×1 + IMPROVER ×5 — all coexist in the final file); `220_overhaul_plan.md` carried improver + parent. **Both survived only because every writer was additive.**

## 3 · POLLS (6, with line-count tracking)

Line counts (baseline → final): canonical **309→322** · overhaul **306→367** · ext-ver **363→365** · 221 **504→508** · 222 **204→206** · 223 **193→196** · 224 **335→337** · 229 **115→117** · 232 **absent→311**. **Every file grew; none shrank.**

| poll | time | key observations |
|---|---|---|
| P1 | 12:25:30 | canonical CHANGED mid-poll (WD-Z blocks landing; 309→315 L); improver's 232 still skeleton (42 L); **no IMPROVER markers anywhere yet** |
| P2 | 12:28:53 | **first insertion burst**: 7 targets written 12:25:53–55 (markers appear in all but canonical); 232 → 22 589 b/294 L; new files 225/226/230 appear |
| P3 | 12:32:27 | canonical +2 blocks (12:29:14); 221 +F4 (12:29:14); overhaul big write @12:32:13 (parent §4.9/§4.10 + WB-6); new 234, 235; 232 frozen @12:27:03 |
| P4 | 12:36:45 | canonical completed to **5 markers** (12:33:58); overhaul +CI addendum (12:35:28); 232 updated (12:36:03) — **all 16 points now on disk** |
| P5 | 12:40:02 | **no changes** — improver quiescent since 12:36:03 |
| P6 | 12:42:43 | **still no changes** → quiescence confirmed; final snapshot + final md5s taken |

Deletion/insertion audit vs baseline re-run at P3, P4, P6: `deleted=0` for all 8 targets at every check (additions: canonical +9 L, overhaul +59 L, ext-ver +2, 221 +4, 222 +2, 223 +3, 224 +2, 229 +2 — includes the parent's, not only the improver's, additions).

## 4 · INSERTION VERIFICATION — 19 verified (16 IMPROVER + 3 sibling-writer)

Method: every marker read from the bytes; every cited `file:line`/clone path re-opened by me today; counts re-derived with the same grep. All 16 improver insertions are attributable (`> [IMPROVER · 2026-09-24] … (by PLAN-IMPROVER)`), additive, and placed at the section the ledger names. Independent marker count == ledger's self-report exactly: **canonical 5 · overhaul 3 · external 1 · 221 2 · 222 1 · 223 2 · 224 1 · 229 1 = 16.**

| # | id | target / where | evidence re-checked (by me) | verdict |
|---|---|---|---|---|
| 1 | IMP-01 | canonical §A (TASK-01) | `console.tsx:382` record + 7 keys exactly `run/approve/fix-gate/retry/done/running/unknown` ✓, `:311` ✓; CLI verbs gate `:445`/approve `:516`/retry `:639`/emit `:781` ✓ — **but `status` is not a CLI verb** | **IMPRECISE** (§5.1) |
| 2 | IMP-02a | canonical §A (OV-2) | `browser-smoke-verdict.test.mjs:375-383` 4 source-pins (`:380-383`) ✓; callers `browser-smoke.mjs:30,:32,:33,:41` ✓ | SAFE |
| 3 | IMP-02b | overhaul §4.2 item 3 | same evidence ✓ | SAFE |
| 4 | IMP-02c ≡ IMP-11 | 222 row 4 (W14) | same evidence ✓ | SAFE |
| 5 | IMP-03 | canonical §E (OV-13) | `engine.ts:3011`+`:3029` catches, comment-only bodies `:3012`/`:3030` ✓; `store.ts:574` catch, comment `:575` ✓; `liveLayerFailureRow` `:3232`, `LIVE_FAILURE_MESSAGE_BUDGET = 160` `:3230` ✓ | SAFE |
| 6 | IMP-04 | canonical §E (OV-15) | `headless.ts:1399-1408` refusal block, `:1405` carries `redTree:"banner"` ✓; `grep redTree`/`banner` in CLI = **0** ✓; `:1746-1747` banner note ✓ | SAFE |
| 7 | IMP-05 | canonical §E (OV-16) | `args.tree` single hit `rapidtool-cli.mjs:2767` inside `case "doctor"` ✓ | SAFE |
| 8 | IMP-06a | overhaul §4.6 (WB-6) | `run-eval.mjs` results `:1177` then history `:1206` ✓; `priorFor` `:371` ✓ | SAFE |
| 9 | IMP-06b | 223 WB table area | same evidence ✓ (deliberate re-anchor; a different lane reads this artifact) | SAFE |
| 10 | IMP-07 | overhaul §4.8 (CI) | `git remote -v` → `origin git@github.com:RodneyDanger1/RapidTool.git` (fetch+push) ✓; aider `ubuntu-tests.yml:25`/`windows-tests.yml:25` ✓ — inserted directly under the stale "no GitHub remote" line it corrects | SAFE |
| 11 | IMP-08 | 221 F1 | clone file exists, `MAX_MCP_STDIO_LINE_BYTES = 8 * 1024 * 1024` ✓ — **but line numbers off** (`:26`→`:22`; `:31`→`:27`/use `:72`; `:56-63`→`:63-69`) | **IMPRECISE** (§5.2) |
| 12 | IMP-09 | 221 F4 | `protocol.rs:986` `pub enum AskForApproval` ✓ with `Granular(GranularApprovalConfig)` `:1004`/fields `:1012+`; `#[experimental("askForApproval.granular")]` verified in mirror `shared.rs:181` (enum `:176`) ✓ | SAFE (footnote §5.3) |
| 13 | IMP-10 | 223 (WB-1/WB-5) | `headless.ts:1908-1912` comment, `:1917` recordGate, `:1958` mint, `:2491` recordGreen, `:2493` comment, `:2498` recordGateInto, `:2509` mint ✓ — all agree with the audited WB-1 anchors | SAFE |
| 14 | IMP-12 | 224 §7 (CI) | aider per-OS legs ✓ (`:25` runs-on both files); `ls` shows two separate workflow files ✓ | SAFE |
| 15 | IMP-13 | 229 §4 (steer-2) | `knowledge.ts:1340` `failureLessonFromRecord`, `:1353-1354` `refuse:no-proof`, `:952` probe tags ✓; `engine.ts:68` type, `:95` state, `:63-67` node:fs rule comment ✓ | SAFE |
| 16 | IMP-14 | ext-ver §2.3 | scratch artifact `C:/Users/mnril/w13n_scratch/ds_pricing_recheck.html` = **23 982 B @12:25** exactly as claimed ✓ (page content not re-fetched by me — curl allowed but not repeated on the memory-tight host; artifact-on-disk check only) | SAFE (evidence-on-disk) |
| 17 | WD-Z | canonical §A (:53) | claim `grep -nE "TokenBudget|usage|spend" node-runner.server.ts` = 0 → **re-ran: 0** ✓ | SAFE (sibling) |
| 18 | WD-Z | canonical §A (:58) | claim `README.md:14` carries stale "scripts 220/220 + src 1803/1803" → **verified: exact** ✓ | SAFE (sibling) |
| 19 | PLAYBOOK-A | canonical tail (:322) | pointer to `230_task_execution_playbook.md` → file exists (98 773 b) ✓ | SAFE (sibling) |

Also confirmed intact: the canonical's **5 pre-existing AUD-2 markers** (lines 60/75/103/172/306) — no earlier content was lost to the multi-writer window.

## 5 · BAD-INFO / INVARIANT / COLLISION HUNT

**0 BAD-INFO · 0 UNSAFE · 0 P1 incidents.** Two IMPRECISE items, one footnote:

**5.1 — IMP-01 (`status` is not a CLI verb).** The CLI dispatcher has **35** `case "…"` verbs (`grep -c 'case "'` = 35); there is **no `case "status"`** and no `status` verb documented in `README-cli.md`. `status` exists only as a chat **slash tool** (`/status`, USAGE text `:2933`). The nearest real read verb is `summary` (compact snapshot). The rest of IMP-01 (record `:382`, keys, `:311`, gate/approve/retry/emit) is exact. → correct the token at merge (§8 R-1).

**5.2 — IMP-08 (clone line numbers drift).** In `codex/codex-rs/rmcp-client/src/bounded_stdio_transport.rs`: the const is at **:22** (claimed `:26`), `pending_line` field **:27** with accumulation at **:72** (claimed `:31`), and the oversize block is **:63-69** — `if` `:63`, warn `:64-67`, `pending_line.clear()` `:68`, `return None` `:69` (claimed `:56-63`). Symbol, value (8 MiB), and close-the-transport behavior all correct. → line-number correction at merge (§8 R-2).

**5.3 — IMP-09 footnote.** The insertion shorthand quotes `Granular { sandbox_approval, rules, skill_approval, request_permissions }`; the code holds `Granular(GranularApprovalConfig)` whose struct has those four **plus `mcp_elicitations`**. Not misleading for the lesson (concern-granularity); the `experimental` attribute and the `shared.rs:176` mirror are exact. No correction needed unless the parent wants maximal precision.

**Audited-fact cross-check (all hold):** MCP clients = 7 — not restated/recomputed by any insertion; AUD-2's 7-clones marker retained intact. lesson-writers = 18 — untouched. DF-09 = `engine.ts:1629` — AUD-2's DF-09 marker intact; no new `:1631` text. Gate 261/1957 — no insertion restates counters; WD-Z's addition flags the *stale README numbers* correctly. WB-1 parent-verified — IMP-10 confirms the exact audited anchors (`headless.ts:1917`/`:1958`, `dod.ts` untouched); nothing contradicts. Known-broken set — IMP-02 treats `browser-smoke`/`browser-guard` as broken-but-fixable with a *test-pin trap* (consistent, adds no false "it works"); `eval --limit=N` untouched; `hermes verify` untouched.

**Governing invariants:** node:fs lazy-seam rule cited correctly (IMP-13, `engine.ts:63-67`); declare-or-strike respected — every insertion is marked, dated, evidence-cited, and each ledger entry carries a self-rejection; no insertion rewrites a row's meaning (the one meaning-changing candidate — `store.ts:574` "silent" vs "fallback" — was deferred to the parent by design, verified in 232 §Deferred).

**HOT-file collision check (222 §4):** no insertion creates a new lane, so no new HOT collision; IMP-03 explicitly flags `engine.ts` as HOT where its anchors live; the plan-level finding that four HOT files carry 4+ rows is X-2's/parent's §4.10 text, not something the insertions worsen. **Forbidden-touch check:** zero `[IMPROVER` markers in `230`/`228`/`231`/`233`/`234`/`235`/`227`/`wave_plans/**`; `git status --porcelain src scripts` = empty at 12:40:19 (post-improver). The `src/lib/headless.ts` + `headless.test.ts` modifications visible at 12:44 are the **C-1 (WB-1 defusal) lane** (its own comment says so; mtimes 12:41:30/12:43:23 — after the improver finished) — not the improver. `fixes/218` + `219a` tracked-modifications predate the baseline (11:40/11:30, uncommitted from earlier lanes).

**Ledger honesty:** the final 232 (12:36:03) quotes its own read-back grep and its numbers **match disk exactly** (16/16). Process note: an intermediate revision (12:27:03) claimed "all insertions applied" while only 12/16 were on disk; the last four landed 12:29:14–12:35:28 and the ledger was corrected 12:36:03. No standing falsehood; see guideline 10.

## 6 · EDITING GUIDELINES — “How to edit the plan corpus safely” (copyable)

```markdown
## How to edit the plan corpus safely (W13 observed rules)

1. ADDITIVE-ONLY, always. Insert blocks; never delete, reorder, or rewrite an existing line,
   table row, or paragraph — not even to "fix" one. [Justified: this run — 8/8 targets, ~28 added
   lines, 0 deleted lines; multi-writer files survived only because every writer obeyed this.]
2. EVERY insertion carries its attribution on the line itself:
   `> [AUTHOR · YYYY-MM-DD] <what + why> — evidence: <file:line / path / command>. (by AUTHOR)`.
   [Justified: all 16 improver + 3 sibling insertions attributable; made the audit a single grep.]
3. NEVER write a file younger than ~3 minutes; re-check mtime immediately before each write; if hot,
   defer a cycle and say so. [Justified: canonical was hot at 12:25:17/12:25:37 (WD-Z mid-write);
   the improver deferred to 12:29:14+ — zero loss. A poll 7 s apart saw two different byte-states.]
4. SNAPSHOT before a batch: full-directory copy + md5/size/mtime manifest, outside the repo.
   [Justified: targets are UNTRACKED in git — the backup is the only loss protection; baseline taken
   4 s before the first insertion.]
5. Batch small, space re-writes ≥3 minutes apart per file. [Justified: the improver's second writes
   (221, overhaul) each waited ≥3 min; interleaving with the parent's 12:32:13 merge cost nothing.]
6. ONE writer per file per wave is the rule; if you must share a file, anchor insertions on heading
   text (not line numbers), keep them additive, and expect to defer while the other writes.
   [Justified: canonical had 3 concurrent writers and only survived via rules 1+3; 222 §4's standing
   "never two concurrent writers" rule exists for the same reason.]
7. RE-DERIVE every count/anchor with a command in the same pass and quote the command in the
   insertion. [Justified: the improver's greps/seds re-ran clean from my side; where it trusted
   line numbers without re-quoting (IMP-08), 4–6-line drift slipped in.]
8. Cite the SYMBOL + nearest grep-able anchor; treat bare line numbers as perishable. [Justified:
   the C-1 lane began editing `headless.ts` at 12:41–12:43, minutes after WB anchors at :1908–:2509
   were verified — line numbers drift, symbols/greps do not.]
9. Correct by inserting a correction UNDER the claim, never by rewriting the claim; leave the stale
   line standing with its correction attached. [Justified: the "no GitHub remote" line was left in
   place with the improver's CORRECTED block directly below it — the stale+correction pair is the
   audit trail.]
10. A completion claim is only true AFTER the read-back command: quote `grep -c "<marker>"`
    per-file results in the ledger; write "COMPLETE" only when they match. [Justified: an
    intermediate 232 revision claimed completion ~8 min before the last 4 insertions landed; the
    final revision quotes the read-back and matches disk exactly.]
11. NEVER edit a watchdog's/guardian's report, another lane's deliverable, or anything outside your
    named targets; keep your own work in exactly your deliverable + append-only logs. [Convention,
    from AGENTS.md strict disjoint file ownership; observed: the improver wrote only its 8 targets +
    232; the guardian wrote only this report + its backup dir.]
12. Scratch outside the repo; verify citations against TODAY's bytes; when something cannot be
    verified, strike it rather than soften it. [Convention, from AGENTS.md declare-or-strike /
    honesty contract; observed: 232's §Deferred (6 items incl. the wanted-but-not-made cline lesson)
    and the curl artifact under `C:/Users/mnril/w13n_scratch/`.]
```

## 7 · RESTORABILITY PROOF (every target file)

Baseline = `C:/Users/mnril/w13guard2_backup/20260924-122023/` (pre-improver). Final = `C:/Users/mnril/w13guard2_backup/_polls/final/` (post-run). Both hold copies of all targets; per-file restore is one `cp`.

| file | baseline md5 (pre) | final md5 (post) | restore (pre→disk) / (post→disk) |
|---|---|---|---|
| `220_tasklist_canonical.md` | `00d3b29be4fde6e518e9c06534d417f6` | `b39d5484d242539cea9b1159b3ab71d8` | `cp "/c/Users/mnril/w13guard2_backup/20260924-122023/220_tasklist_canonical.md" "research/multiagent/"` / `cp "/c/Users/mnril/w13guard2_backup/_polls/final/220_tasklist_canonical.md" "research/multiagent/"` |
| `220_overhaul_plan.md` | `e9fc933e38c4a15b23adf769deb0a86e` | `1b140aacd5d034b3cabf040361399246` | same two-command shape |
| `220_external_verification.md` | `4753ea6f4aba86b8debd46f867679ee3` | `f28d0b114e82fa6198d706f59389477b` | ″ |
| `221_feature_designs.md` | `bd16e1b43f148873b019cef9f9ded40c` | `0bbd3d8711a5f47869f069c9ee9690b1` | ″ |
| `222_codebase_integration_map.md` | `0cc8dea5ea2e6daf266acc8070f8a9c7` | `9e7e3358fd3ecb4847b5fe66ceae054d` | ″ |
| `223_critical_path_premortem.md` | `d290b806f1fc0a1d336b128b0cb686e9` | `cffac5b94485c5bc81e1c7a4e8d586e0` | ″ |
| `224_advantage_gap_and_plan_audit.md` | `dfe5758036527221cf9188669221d4e6` | `85028d3dd1a430fd51be9545ee9b92c7` | ″ |
| `229_steering_and_goal_alignment.md` | `8689f817108d2686e831572ed1d4b2c3` | `bed3555c7df3e5ec5d3bd7e873e8b837` | ″ |
| `232_plan_improvements.md` | (absent at baseline) | `c3fbbcf210bce436477a13cb7a64ccb2` | ″ (final copy only) |
| `227_plan_gaps_adversarial.md` | `6d5eb46ba88d230569f07145e27003d4` | `6d5eb46ba88d230569f07145e27003d4` (unchanged) | ″ |

Verification: final copies were re-read from the backup dir and `cmp`-clean against the disk bytes at snapshot time (P6); sizes/line counts monotonic; the 8 targets' current on-disk md5s were re-measured 12:44 and equal the final manifest. Intermediate states for forensics: `_polls/P1…P6/`, plus P1b/P1c captures of the canonical mid-write race.

## 8 · RECOMMENDATIONS (for the parent — the guardian does not edit what it guards)

- **R-1 (IMP-01, fix the one wrong token).** Replace ``its per-arm CLI verbs are `status` (unknown) / `gate` (running, fix-gate, run) / `approve` / `retry` / `emit` (done)`` with ``the read verb is `summary` (chat `/status` is a slash-tool; there is no `status` CLI verb — 35-verb dispatcher)`` — or equivalent. Evidence: `grep -c 'case "' scripts/rapidtool-cli.mjs` = 35, no `case "status"`; USAGE :2933 lists `/status` as a chat slash tool.
- **R-2 (IMP-08, fix line numbers).** Correct to: const `:22`, `pending_line` `:27` (accumulation `:72`), oversize close `:63-69` (warn `:64-67`, clear `:68`, `return None` `:69`). Symbol + 8 MiB value + behavior are already right.
- **R-3 (optional precision)** IMP-09 shorthand: `Granular(GranularApprovalConfig)` (5 fields; `mcp_elicitations` not named). Cosmetic.
- **R-4 (anchor-drift warning for merge).** The C-1 lane is now editing `headless.ts` (12:41+); the WB-1/WB-5 citations in `223` + IMP-10 use line numbers that will shift. Re-derive from the quoted greps at merge; that is expected drift, not corruption.
- **R-5 (232 cosmetic).** Its §Files-skipped line says "the two insertion blocks" for canonical; there are 5 blocks (IMP-01..05). Cosmetic; the per-file index it added (canonical 5 · … = 16) is correct.
- **R-6 (keep the backups).** The 8 targets are untracked; do NOT prune `w13guard2_backup/` or `w13guard_backup/` until the corpus is committed or superseded.
- **No restore needed. No P1 incident. The corpus is intact and the insertions are safe to merge as-is** (R-1/R-2 are the only corrections worth making).

---
*End of IMPROVER GUARDIAN deliverable. Read-only on the plan files; this report + the backup dir are the only writes.*
