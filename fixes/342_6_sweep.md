# 342-6 · housekeeping + adversarial sweep — the `.t4scratch` verdict, doc truth pass, and the hunt table

**Lane:** 342-6 (housekeeping + adversarial hunt). **Opened** 2026-10-03 at HEAD `686d7b6`.
**Owned (STRICT):** `.t4scratch/**` · root docs (`README.md`, `AGENTS.md`, `START-HERE.md`, `RESUME.md`,
`docs-FOLDER-MAP.md`, `finalsprint.md`) · `scripts/README-cli.md` · `scripts/docs-module-parity.mjs` ·
proven-zero-reference dead code/comments in `src/lib/**` + `src/components/**` not owned by another
lane. **Reserved (touched read-only):** `codegen.server.ts`, `run-eval.mjs`, `headless.ts`, `engine.ts`,
`types.ts`, `scaffold.ts`, `maker-score.ts`, `doctor.ts`, `mcp.server.ts`, `llm/providers/registry.ts`,
`scripts/rapidtool-cli.mjs`, `research/eval-corpus/**`.
**Runtimes:** host `node` v24.15.0; pinned `& "$env:LOCALAPPDATA\hermes\node\node.exe"` v22.23.2.
Every `node --test` run passes `--test-reporter=tap`. **Scratch:** `%TEMP%\rt342_6\`.
**Keyed LLM calls: 0.**

> **Environment note (honesty).** The tree was **clean at lane open** (`git status --short` = empty) but
> **was NOT clean during the lane**: a concurrent 342 wave landed mid-sweep (32 modified tracked files,
> incl. `src/lib/engine.test.ts`, `types.ts`, `codegen.server.ts`, `maker-score.ts`, `mcp.server.ts`,
> `scripts/run-eval.mjs`, `research/eval-corpus/graders/*.json` — all sibling-owned/reserved). My edits
> are confined to six owned docs + one comment-only `scorecard.ts` hunk. `git diff --diff-filter=DR`
> (unstaged + staged) is **empty**: 0 tracked deletions, 0 renames (`.t4scratch` was NOT removed — §0).

---

## 0. `.t4scratch` — **STOP-and-REPORT** (not removed)

**Verdict: NOT removed. Check 1 (untracked) FAILS on bytes, and check 3 (absent from live lane logs)
also fails literally → per the mission's own rule ("If any check fails, STOP-and-REPORT instead") the
deletion is withheld; the tracked-file deletion needs explicit parent sign-off, which the repo's own
precedent has left owed since W48.**

| # | Check | Byte evidence | Result |
|---|---|---|---|
| 1 | **untracked** | `git ls-files ".t4scratch"` → **192 files**; `git status --porcelain` shows no `??`/`A`; `.gitignore:23-26` itself documents "`.t4scratch/` (192 tracked files, added 2fa3cd9)". It is **tracked**, not untracked. | **FAIL** |
| 2 | zero-referenced | `git grep -n -i t4scratch -- . ":(exclude).t4scratch/*"` → hits ONLY in `.gitignore`, `README.md`, `finalsprint.md`, `fixes/**`, `wave_plans/**`. **Zero** hits in `src/**`, `scripts/**`, any `*.test.*`, `package.json`, `gate.sh`, CI. | PASS |
| 3 | absent from every live lane log | named as an owed cleanup in the wave-parent log `fixes/341_0_parent.md:133` and `fixes/341_5_governance.md:196`; **0** current-wave (`fixes/342_*.md`) logs exist yet. No live lane **depends** on it, but it is **named** in live lane logs. | **FAIL (literal)** |

**Prior art (why this is a sign-off, not a defect):** `fixes/334_6_warden.md` §G3 proved it (192 tracked,
4.3 MB, 87 byte-identical / 105 drifted vs `src/lib`, from single commit `2fa3cd9`) and **proposed**
`git rm -r .t4scratch` while explicitly deleting nothing; `334_0_parent.md:61-63`, `333_0_parent.md` F-6,
`336_0_parent.md:146`, `340_0_parent.md:105` and `341_0_parent.md:133` all carry it as owed. Two
side-effects confirmed today: it pollutes repo-wide `git grep` (it roughly doubled the raw hit counts in
my dead-export census) and it is the only reason a stale `src/lib` copy still lints.

**Exact recommended action (owner-signed, one commit, fully recoverable from `2fa3cd9`):**
```
git rm -r .t4scratch      # 192 tracked files, ~4.3 MB
```
The `.gitignore` entry already prevents re-tracking. **STOP-and-REPORT** — I did not run it.

---

## 1. Doc / claim truth pass (before → after, verbatim)

### D1 — `README.md` patch row (capabilities matrix) — **FIXED**
The row claimed the patch primitive was not wired; bytes wire it in both P6 repair and `edit`.
- **Before:** `` | `str_replace` patch primitive (unique-match + graded fuzzy) | ✅ core | `src/lib/patch.ts` (25 test blocks today). **Not yet wired into P6/repair — carried past W6 (see `remainingwaves.md`)** | ``
- **After:** `` | `str_replace` patch primitive (unique-match + graded fuzzy) | ✅ wired | `src/lib/patch.ts` (25 test blocks today). **Wired into P6 synthesis repair** (`codegen.server.ts:127` imports `applyStrReplace`, applied at `:1083`) **and the CLI `edit` verb** (`rapidtool-cli.mjs:2860`) | ``
- **Evidence:** `codegen.server.ts:127,1083`; `rapidtool-cli.mjs:2860-2861`.

### D2 — `README.md` §7 "Shelled / in progress" list — **FIXED (inline)**
Four items the list called shelled are landed (or honestly re-classified). Before → after of the changed
clause:
- **Before:** `` · wild supervisor Node-side completer (R14-f01) · unattended run (W-47) · plan-before-execute (R13-f02) · checkpoint+`resume` (T-107.7) · 4 kind emitters + real graders + emitted UI seam (S2 — note the W30 S2 lane closed recon-only; recovery owed) · cassette replay (T5.7) · streaming surface (T5.1) · MCP client (F1) · ``
- **After:** `` · wild supervisor Node-side completer (R14-f01) · **unattended run (W-47 — REAL, W36; self-sufficient since 341-6: stock gates auto-clear, only `forceHuman`/red-DoD parks)** · plan-before-execute (R13-f02 — real: `stageWildPlan`/`engine.ts:4398` is the one staging site, `store.ts:1357`) · **checkpoint+`resume` (T-107.7 — REAL, W36)** · **4 kind emitters (S2 — landed by 341-1); real graders + emitted UI seam (S2 — recovery owed)** · **cassette replay (T5.7 — wired at the provider seam, 340-4)** · streaming surface (T5.1) · MCP client (F1) · ``
- **Evidence:** `engine.ts:4398`, `store.ts:1357`, `headless.ts:5365/5592` (`stageWildPlan`); `fixes/341_0_parent.md` §3.1 (unattended), §3 (checkpoint/resume), §2 (kind emitters); `fixes/341_8_verifier-b.md` Claim 3 (cassette provider-seam wiring).

### D3 — `README.md` §10 census staleness — **DECLARED (appended block)**
Added a dated "Corrections in force — appended 2026-10-03 (342-6 sweep)" block recording the live
`git ls-files` counts (src 246 · src/lib 235 · scripts 49 · fixes 719 · wave_plans 139 · total 2,096) and
the still-owed `.t4scratch` removal. The §10 table itself is left in place (it self-dates "re-derived
2026-09-30").

### D4 — `START-HERE.md` snapshot counts — **DECLARED (appended correction)**
The W47 correction's counts (222/49/654/123) had themselves drifted. Appended a new dated section before
the end marker:
> "**src 246 · src/lib 235 · scripts 49 · fixes 719 · wave_plans 139 · total 2,096**" + the `unattended`
> self-sufficient note (341-6).

### D5 — `docs-FOLDER-MAP.md` re-count block — **DECLARED (appended)**
Appended: "**Re-counted 2026-10-03 (342-6 sweep, HEAD `686d7b6`): `src/` 246 · `src/lib/` 235 ·
`scripts/` 49 · `fixes/` 719 · `wave_plans/` 139 · `research/` 476 · total tracked **2,096** (includes
the 192 tracked `.t4scratch/` files)."

### D6 — `scripts/README-cli.md` §"Resume and unattended" — **FIXED**
The doc's own §34 (line 299-303) said 341-6 makes stock gates clear, but its §"Resume and unattended"
paragraph still said the opposite.
- **Before:** `(it resumes instead of restarting). Stock HITL gates (P4/P5/P8/P9) still park for a human BY DESIGN: a parked exit (2) is the honest outcome, never a fake completion.`
- **After:** `(it resumes instead of restarting). 341-6: it passes \`machineGates\`, so a stock HITL gate (P4/P5/P8/P9) whose DoD passes is cleared through the ledgered machine actor (\`approve --seat autopilot\`); only a \`forceHuman\` gate, or any red DoD gate, still parks (exit 2) — never a fake completion.`
- **Evidence:** `headless.ts:689-694,1175-1202`; `rapidtool-cli.mjs:1141,1162,1357-1362`; `fixes/341_0_parent.md` §3.1.

### D7 — `scripts/README-cli.md` "Honest follow-ups" — **FIXED**
- **Before:** `plan-before-first-mutation classifier review (\`TODO(R13-f02)\`), and the shared \`HISTORY_CAPS\` …`
- **After:** the R13-f02 entry is retired (stageWildPlan is the one staging site and parks at `wild.plan_review`; browser reviewer is null/honest), `HISTORY_CAPS` remains.

### D8 — `finalsprint.md` master-table rows — **DECLARED (appended §W342-6)**
Appended above the end marker: R13-f01/W-47, T-107.7, R13-f02, A3-f06/R3-f06, T5.7 now REAL; R14-f01
still shell; F1 no live consumer; F2 resolved-but-unarmed. Master table untouched (append-only doctrine).

### D9 — `src/lib/scorecard.ts` `DEFAULT_EVAL_OUT_DIR` comment — **FIXED (comment)**
See §2 H1.

### Reported, not fixed (out of safe edit scope)
- `src/lib/errors.ts:79,555` `RT_E_UNATTENDED_UNSUPPORTED` — the meaning still says the W-01/W-02
  blockers "are not landed keyed" and there is no host, but the `unattended` verb is now REAL (341-6) and
  the code has **zero live emitters** (grep: only `errors.ts` registry + the `README-cli.md` mirror + a
  `console.tsx` comment). Obsolete registry entry. `scripts/README-cli.md:1137` is a faithful mirror of
  the stale source, so it was left alone rather than diverged.

---

## 2. Adversarial hunt — the full table

Method: a Node probe (`%TEMP%\rt342_6\dead-exports2.mjs`) over `src/lib/**` + `src/components/**` +
`src/routes/**` collected every exported name and counted whole-word references across `src/**` +
`scripts/**` (incl. `.test.*`, excl. `.t4scratch`); candidates were re-verified with
`git grep -w <name> -- . ":(exclude).t4scratch/*"`. Classes searched: dead export / dead field /
check-that-cannot-fail / comment-vs-bytes / stale `TODO(<row>)`.

| # | Class | Finding — `file:line` | Fixed / Reported |
|---|---|---|---|
| H1 | comment contradicts bytes | `src/lib/scorecard.ts:39-41` — comment claimed "**The CLI resolves it** [DEFAULT_EVAL_OUT_DIR] against its own module location"; the CLI never imports the symbol (it defines its own `EVAL_OUT_DIR`, `rapidtool-cli.mjs:539`) | **FIXED** — comment now names the mirror and records zero importers |
| H2 | export with zero callers | `src/lib/scorecard.ts:42` `DEFAULT_EVAL_OUT_DIR` — 0 importers repo-wide (was previously cited only by `fixes/262`) | REPORTED (KEEP-as-anchor; H1 comment now states it) |
| H3 | dead export / over-export | `src/lib/git.server.ts:108` `GitLandSeat` — exported but referenced only in-file (`checkGitLandSeat` `:150`, used `:875`) | REPORTED |
| H4 | export with zero callers | `src/lib/app-data/client.server.ts:79` `resolveGateAppDataBase` · `:83` `getConnectorAccessToken` — 0 code consumers | REPORTED |
| H5 | dead export + stale landing-log claim | `src/lib/watchdog.ts:109` `overdueRowSeed` · `:128` `timeoutRowSeed` — 0 consumers, yet `fixes/171_composer_gapfill.md:17` states they were **removed** ("Removed unused … `overdueRowSeed`, `timeoutRowSeed`") — the bytes refute the log | REPORTED (claim-vs-bytes in a historical log; append-only) |
| H6 | dead export (known) | `src/lib/auth/gates.tsx` `SignedIn`/`SignedOut`/`SignInGate`/`SignInButtons` — 0 consumers (already: `fixes/336_0_parent.md:149`, `fixes/336_6_warden.md:98`) | RE-CONFIRMED |
| H7 | dead exports (known over-exported substrate) | `harvest.ts:56-60` `HARVEST_QUERY/BOUNDS/SOURCE_LABEL` · `vector.ts:65-66` `LOGO_VIEWBOX`/`ICON_VIEWBOX` · `crew.server.ts:465` `nextRole` + `:1469` `crewToReport` (own `TODO(F2-09)` `:1465`) · `dod.ts` `b18Tail` · `patch.ts:43` `PatchKind` · `rt-events.ts:285,301,302` `WILD_STEP_AUTOPAUSE_MS`/`LONGTASK_REPORT_MS`/`LONGTASK_COALESCE_MS` (+ `RtScope`, own `TODO(N6-W6)`) · `auth/server.ts` `readSessionToken` | RE-CONFIRMED (prior: `fixes/124_unwired_seams.md:58`, `fixes/295_p4_sweeps.md:18`, `fixes/307_b4_sweep.md:66`, `fixes/308_bugmap.md:13`) |
| H8 | dead exports (reserved files — read-only) | `doctor.ts:328`-class `doctorProviderTeam` · `headless.ts` `buildVault`/`designModuleAvailable`/`diagramModuleAvailable`/`vaultFileFor` — 0 external refs | REPORTED (reserved; not editable) |
| H9 | `TODO(<row>)` whose gap the bytes closed | **none found.** Inspected every non-`TODO(E-15)` marker: `subagent.ts:49` `R13-f14` (blocked on unlanded R13-f11), `wild-review.ts:35,95` `R14-f01` (keyed run owed), `console.tsx:7349` `N2` (no console checkpoint read seam), `io.ts:39` `A1-25` (explicitly still open), `store.ts:863` `A1-17` (open), `types.ts:521` `R13-f02` (UI/packet surfacing still owed per 341-3/341-4), `packet.ts:1321` `F2-07` (KEEP, zero consumers by design) — each gap is genuinely still open | NONE |
| H10 | check that cannot fail | **none found** in the sampled scope (guards spot-checked; the junk-`cases`/hollow-M4 vacuous mints were closed by 341-3/341-5) | NONE |
| H11 | declared field no consumer reads | **none new** (the known produced-but-unread fields were closed by 341-3 §2 / 341-5) | NONE |

**Notable non-src finding:** H5 — a landing log (`fixes/171`) claiming a removal that never happened.
This is the class "claim contradicts bytes" living in the ledger itself; logged here since `fixes/**` is
append-only and not mine to edit.

---

## 3. Targeted suites (both runtimes)

| Suite | Node 24.15.0 | Node 22.23.2 |
|---|---|---|
| `scripts/README-cli.test.mjs` (pins my edited `README-cli.md`) | **12 / 12 / 0** | **12 / 12 / 0** |
| `src/lib/scorecard.test.ts` (my edited file) | not re-run | **6 / 6 / 0** |
| `scripts/docs-module-parity.mjs --self-check` | — | **ok:true**, fixtures `missingDetected:true`, `existingNotFlagged:true` |
| `scripts/docs-module-parity.mjs` (real scan) | — | **ok:true**, 1 missing — the known false-positive `src/generated.ts` (emitted-tree entry, not a repo file) |
| `npm run typecheck` | **RED** — `src/lib/engine.test.ts(381,31) TS2345` | — |

**Typecheck attribution (not mine):** the sole error is a sibling 342-4 in-flight edit to
`src/lib/engine.test.ts` (`emptyProject({ brief })` missing the now-required `name`) landed by the
concurrent "kind resolution single source of truth" lane. My only `src/` change is a **comment-only**
hunk in `scorecard.ts` (verified via `git diff`); it cannot produce that error. No full gate, no
`npm test`, no build, no keyed call.

---

## 4. Honest verdict — what is still unclean or unwired

1. **`.t4scratch/` remains (192 tracked files, ~4.3 MB).** The mission's own precondition fails (it is
   tracked, and named in live lane logs), so I withheld the deletion and STOP-and-REPORT the exact
   `git rm -r .t4scratch` one-commit action. Until a parent signs it, the repo carries a drifted,
   lint-visible duplicate of `src/lib` that pollutes every repo-wide grep. **This is the single biggest
   piece of "left lying around".**
2. **Documentation is corrected-by-declaration, not by history-rewrite.** README/START-HERE/
   docs-FOLDER-MAP now carry a 2026-10-03 re-count, but the underlying snapshot tables are still stale by
   construction; a future lane should either regenerate them or retire them in favour of `git ls-files`.
3. **`RT_E_UNATTENDED_UNSUPPORTED` is an obsolete registry entry** (no live emitter; its precondition —
   W-01/W-02 unlanded keyed — is false since the 331/332 keyed runs and 341-6's unattended verb). The
   `errors.ts` source was not edited (out of safe scope); `README-cli.md` mirrors it faithfully.
4. **Dead/over-exported seams persist** (H2–H8). Most are documented KEEP-seams; the genuinely
   unaccounted ones are `DEFAULT_EVAL_OUT_DIR`, the `app-data` connector readers, and the two `watchdog`
   row-seed builders (whose removal a prior log falsely claimed).
5. **Still-unwired (unchanged, real):** MCP has no live consumer; the second provider is
   resolved-but-unarmed; R14-f01's keyed wild-reviewer evidence run is owed; the console has no
   checkpoint read seam (TODO(N2)). None of these is mine to wire.
6. **The tree was mid-flight.** A concurrent 342 wave was editing 32 tracked files during this lane; the
   typecheck red is entirely theirs. Any boundary gate must be re-run after they stop.

## 5. STOP-and-REPORT

- **`.t4scratch/` deletion** — withheld; check 1 (untracked) and check 3 (absent from live lane logs)
  fail on bytes. Exact action when the parent signs: `git rm -r .t4scratch` (recoverable from `2fa3cd9`).
- **`src/lib/errors.ts` `RT_E_UNATTENDED_UNSUPPORTED`** — obsolete doc/registry entry; not edited
  (source file, cross-module contract).

## 6. What I did NOT do

- Did not delete, rename, or move any tracked file (`.t4scratch` included); `git diff --diff-filter=DR`
  empty. Did not touch any reserved file or any sibling-owned file.
- Did not run the full gate, `npm test`, `npm run build`, or `gate.sh`.
- Did not make keyed/network calls; did not print a secret.
- Did not remove any dead export (all removals are cross-module contract changes; reported with exact
  shape instead).

---

## 7. Resume 342-6 (sweep and hunt) — Items 1 & 2 LANDED (2026-10-03, HEAD `686d7b6`)

The parent signed off on the two Reported items from §1/§2. Both landed patch-only; **0 tracked-file
deletions** (`git diff --diff-filter=DR` empty, staged + unstaged), 0 keyed calls, no full gate.
Runtimes: host `node` v24.15.0 · pinned `$env:LOCALAPPDATA\hermes\node\node.exe` v22.23.2. Scratch
`%TEMP%\rt342_6\`.

### Item 1 — `RT_E_UNATTENDED_UNSUPPORTED` — **REMOVED** (obsolete; zero emitters, false premise)

Grep evidence (whole repo, excl. `node_modules`): the string appeared only in the registry
(`src/lib/errors.ts:79` code + `:555` doc row), the doc mirror (`scripts/README-cli.md:1141`), one
`console.tsx:7274` comment, and historical logs (`fixes/**`, `wave_plans/**`, `finalsprint.md`).
**No `throw` / `codeError` / envelope site anywhere** — registered-but-unthrown, and its premise
(W-01/W-02 unlanded keyed) is false since 341-6 made the `unattended` verb real and self-sufficient.

Action (patch-only):
- `src/lib/errors.ts` — removed `"RT_E_UNATTENDED_UNSUPPORTED"` from `ERROR_CODES`, its
  `ERROR_CODE_DOC` row, and its comment bullet; left a removal note where it stood.
- `scripts/README-cli.md` — removed the mirroring table row (the table is one-row-per-registry-code).

Suites (both runtimes): `src/lib/errors.test.ts` **39/39/0** · `scripts/README-cli.test.mjs`
**12/12/0** · `scripts/cli-exit-taxonomy.test.mjs` (scans the `ERROR_CODE_DOC` block + CLI literals)
**42/42/0** host24.

**Residual, out of ownership:** `src/components/console.tsx:7274` still says the code "is registered
(errors.ts:79/:533)" — now stale. `console.tsx` is not in this resume's ownership, so it was left
untouched and is flagged here.

### Item 2 — proven-dead exports — **REMOVED** (each verified 0 references repo-wide)

Word-boundary greps over `src/**`, `scripts/**`, tests, `docs`, `research/` (excl. `.t4scratch`,
which is not a consumer):

| # | Export | Grep evidence | Action |
|---|---|---|---|
| 2a | `src/lib/scorecard.ts:42` `DEFAULT_EVAL_OUT_DIR` | only the definition + historical `fixes/262`, this log — no importer; the CLI defines its own `EVAL_OUT_DIR` (`rapidtool-cli.mjs:539`), run-eval its own literal | **REMOVED** the const + its comment block |
| 2b | `src/lib/git.server.ts:108` `GitLandSeat` | `\bGitLandSeat\b` matched **only the definition** — `checkGitLandSeat`'s param is typed `unknown`; the prior "in-file only" note conflated the type with the function name | **REMOVED** the type + the now-unused `type PolicySeat` import |
| 2c | `src/lib/app-data/client.server.ts:79,83` `resolveGateAppDataBase` / `getConnectorAccessToken` | only the definitions; `app-data/index.ts` does not re-export `client.server.ts`; `app-data.test.ts` imports only `callTool`/`failureMemoSize` | **REMOVED** both functions (no imports orphaned) |
| 2d | `src/lib/watchdog.ts:109,128` `overdueRowSeed` / `timeoutRowSeed` | only the definitions; `watchdog.test.ts` imports only the five decision/watch symbols | **REMOVED** both builders + the now-unused `type RtEventSeed` import |

Suites after each removal (both runtimes): `scorecard.test.ts` **6/6/0** · `git.server.test.ts`
**37/37/0** · `app-data.test.ts` **23/23/0** · `watchdog.test.ts` **8/8/0**. Combined owning src set
**113/113/0** on host24 and pinned22. `tsc --noEmit` (whole repo): **0 errors**.

**Drift note (H5, corrected):** `fixes/171_composer_gapfill.md:17` claims `overdueRowSeed` /
`timeoutRowSeed` were "Removed unused"; the bytes refuted that until this resume actually removed
them. `fixes/**` is append-only and not owned here, so the stale line is left as history and is
corrected by this record.

### Pins moved
None. No pin referenced any removed symbol (`errors.test.ts`'s two-way `ERROR_CODES` ⟷
`ERROR_CODE_DOC` completeness pins stayed green by construction; no test imported the removed
exports).

### What I did NOT do
- Did not touch `.t4scratch/**` (still the parent's separate decision) or delete/rename any tracked
  file — `git diff --diff-filter=DR` empty.
- Did not edit `console.tsx` (out of ownership) — its stale `RT_E_UNATTENDED_UNSUPPORTED` comment is
  flagged above, not fixed.
- Did not edit any reserved/sibling file (`codegen.server.ts`, `run-eval.mjs`, `headless.ts`,
  `engine.ts`, `types.ts`, `scaffold.ts`, `maker-score.ts`, `doctor.ts`, `mcp.server.ts`,
  `llm/providers/**`, `scripts/rapidtool-cli.mjs`, `research/eval-corpus/**`, `fixes/171`,
  historical logs).
- Did not run the full gate (`gate.sh`), `npm test`, or `npm run build`; targeted suites + one
  `tsc --noEmit` only, both runtimes. No keyed/network calls.
