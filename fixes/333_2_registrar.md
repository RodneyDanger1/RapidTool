# fixes/333_2_registrar — W47 · 333-2 "Registrar" — continuity & record-accuracy audit

**Lane:** 333-2, persona "Registrar". **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (folder name has a
space). **Audited HEAD:** `6575669` (tree clean at audit start; only `wave_plans/W47/` untracked).
**Runtime:** pinned Node `%LOCALAPPDATA%\hermes\node\node.exe` = **v22.23.2**; host Node **v24.15.0**;
every parsed `node --test` run passed `--test-reporter=tap`. Scratch: `%TEMP%\rt333_record\`.
**Rules obeyed:** documentation/record edits only (no `src/**`, `scripts/**`, `package.json`,
`tsconfig*.json`, `fixes/331_*`, `fixes/332_*`, `wave_plans/W45|W46`); **no commits**; no keyed calls;
no `npm run eval`; no secret printed. **This log is append-only.**

---

## 0. Verdict in one line

**No work is lost and nothing changed is unrecorded** (all four commits' files are on disk and committed;
every changed file traces to a lane log, the boundary reports, or a register row). **The record lied in
three places a resuming session reads**: the register body's "account unfunded → 402 / no keyed calls"
premise (P0), several drifted test/verb/file counts (P1), and the flat "emitted product is still ONE
module wearing several filenames" claim (P1). All were corrected additively/dated today, or reported where
the file is outside this lane's edit scope.

---

## 1. Nothing is lost — commit vs bytes

Command: `git log --oneline -6`, `git status --porcelain`, `git diff-tree --no-commit-id --name-only -r <c>`.

- `6575669` (HEAD) · `3ecd48e` · `6cd5123` · `4810e1b` are all on `main`; `03a6d0b` (330 wave) is the
  pre-existing base. Working tree clean except untracked `wave_plans/W47/`.
- For each of the four commits, **every changed path exists on disk** (a `Test-Path` sweep printed no
  `MISSING:` lines).
- `git fsck --no-reflogs --unreachable` reports only two unreachable commits, both dated **2026-09-29**
  ("309 A6 …") — old, unrelated to these waves. **No last-two-year wave commit is dangling.**

| Commit | Files changed | Bytes present | Committed |
|---|---|---|---|
| `4810e1b` (331 wave) | 56 | yes | yes |
| `6cd5123` (331 follow-up) | 3 | yes | yes |
| `3ecd48e` (332 wave) | 43 | yes | yes |
| `6575669` (332 addendum) | 2 | yes | yes |

---

## 2. Claim → bytes trace (both waves)

Every symbol below was re-read on the current bytes (`Select-String`), not trusted from the log.

### 331 wave (`4810e1b`, `6cd5123`)

| Lane log claim | Byte(s) found | Verdict |
|---|---|---|
| 331-1: new `key-resolution.ts` (`parseEnvFile`/`resolveApiKey`/`tailOf`/`describeKeySource`/provenance) | `src/lib/llm/providers/key-resolution.ts` (all present) | verified |
| 331-1: `RT_E_LLM_KEY_REJECTED` + `RT_E_LLM_KEY_SHADOWED` in registry | `src/lib/errors.ts:108-109`, `:464`, `:470` | verified |
| 331-1: `one-shot-fetch.server.ts`, `key-source.server.ts` | both on disk | verified |
| 331-1: `with-app-env.mjs` sets `RAPIDTOOL_LLM_ENV_FILE` | `scripts/with-app-env.mjs:41` | verified |
| 331-2: `LessonSignatureKind`, `verifiedProcedureLesson`, `verifyOutcomeLesson`; pass arm passes anchors | `knowledge.ts:833`, `:1331`, `:2056`; **`verify.server.ts:1217`** `verifyOutcomeLesson("passed", 6, evidence, i + 1, cases.map((c) => c.id))` | verified |
| 331-2: `wildLog` no-logs guard | `engine.ts:3907`, guard `:3912` `Array.isArray(p?.logs) ? p.logs : []` | verified |
| 331-2: `driftLesson` false-caller claim struck | `engine.ts:3504` `verifyPriorPhases` present | verified |
| 331-3: `materializeEmitTree` no longer early-returns; `treeRunFailureFiles`; `REPAIR_TREE_ALLOWED_FILES` | `headless.ts:2107`, `:2572`, `:3098` | verified |
| 331-3 (6cd5123): oracle probe **awaits** its call | `src/lib/scaffold.ts` diff `6cd5123`: `await (jm.slug[first] …)({ payment: 1 })` | verified |
| 331-4: `treeChunkPlanCensus`, `p6.tree.shortfall`, `crossChunkDuplicateDeclarations`, `localBindingLines`, `p6SynthesisDuplicateDeclRepairPrompt` | `codegen.server.ts:2003`, `:4025-4034`, `:2342`, `:2308`, `:1285` | verified |
| 331-5: **zero edits** to owned files | `git show --stat 4810e1b` lists **no** `console.tsx` / `routes/**` | verified |
| 331-6: `tsconfig.scripts.json` + ratchet test + `check-module-coverage.mjs` + `check-assertion-gaps.mjs` | `scripts/typecheck-scripts.test.mjs`, `scripts/check-module-coverage.mjs` on disk; allowlist entries removed (`check-module-coverage.mjs:45-46` comment) | verified |

### 332 wave (`3ecd48e`, `6575669`)

| Lane log claim | Byte(s) found | Verdict |
|---|---|---|
| 332-1: async refusal `unawaitedAsyncValueUses` + `p6SynthesisAsyncAwaitRepairPrompt` wired into both repair chains | `codegen.server.ts:2452`, `:2967` (refusal msg `:2974`), `:1311`, `:3821`, `:4263` | verified |
| 332-1: `ChunkPriorFile.asyncExports`, `treePlanCensusReconciles` | `codegen.server.ts:1493`, `:2038` | verified |
| 332-2: `SpendSlice`/`normalizeLedger`/`accumulateSpend`/`spendDelta`/`isMeasuredSpend`; `runUntilGate` fold; `resolveDoctorSpendSource` | `token-ledger.ts:158/175/195/218/245`; `headless.ts:1228`, `:1680-1686` | verified |
| 332-3: `resolveHeadlessEntry` skips browser `main` under `index.html`; `verified`/`unverified`; no silent cleanup swallows | `compile-check.server.ts:1260-1264`, `TreeRunOutcome:404`; `grep "/\* ignore \*/"` = **0** | verified |
| 332-4: `readBriefSource`, `VALUELESS_VALUE_FLAGS`, `refuseValuelessFlag`, `isReadableFile` | `rapidtool-cli.mjs:706`, `:167`, `:190`, `:671` | verified |
| 332-5: chip keys on outcome class (`KEY_UNUSABLE_CODES`), `lastChatKeyedOutcome`/`laterKeyedOutcome`; store `staleEmitStep`/`readLastKeyed`; `llm.ts captureKeyedOutcomes` | `console.tsx:5927-5955`, `:2243-2273`; `store.ts:350`, `:95`; `llm.ts:125`, `:154` | verified |
| 332-6: W1/W3/V4 pins only, **no source change** | `git show --stat 3ecd48e` lists only `rt-ring.test.ts`, `runtime-log.server.test.ts`, `watchdog.test.ts`; `rt-events.ts:274/279` already derived | verified |

**Claims with no bytes: none.** Every falsifiable claim in the twelve lane logs reproduced on the current
tree (line numbers drift within a few lines, as the logs themselves warn).

**One documented lane-vs-boundary divergence (not an error):** `fixes/332_4_switchboard.md` §S1b states
`package.json`'s `typecheck` was made `tsc --noEmit && tsc -p tsconfig.scripts.json --noEmit` and that
`npm run typecheck` was left **red (exit 2)**. The committed bytes (`package.json:21`) are instead
`tsc --noEmit && node --test --test-reporter=tap scripts/typecheck-scripts.test.mjs` — the **parent's**
boundary correction (`fixes/332_0_parent.md` §3.1). The lane log is a point-in-time record; the committed
bytes (green, verified below) are authoritative.

---

## 3. Orphan list (changed code with no record)

**Empty.** Every file in all four commits traces to a lane log, a boundary report, or a register row. In
particular the edits made by **no** lane are explicitly owned by the boundary reports:

- `fixes/331_0_parent.md` §5 records the 331 boundary edits to `src/lib/lesson-writers.test.ts:579`,
  `src/lib/codegen.server.test.ts`, `src/lib/node-runner.server.test.ts`, `scripts/typecheck-scripts.test.mjs`,
  and `scripts/gate.sh` (the `--test-reporter=tap` fix). All five are in `4810e1b` and accounted for.
- `fixes/332_0_parent.md` §3 records the 332 boundary edits to `package.json`, `src/lib/types.ts`,
  `scripts/rapidtool-cli.mjs`, `scripts/check-module-coverage.mjs`, `START-HERE.md`, `README.md`, and the
  register. All are in `3ecd48e` and accounted for.
- `6cd5123` (scaffold oracle-probe `await` + pin) is recorded in `fixes/331_0_parent.md` §6.8.

No silent boundary edit, no untraced file.

---

## 4. Triage — record-truthfulness findings (most severe first)

Measured current state (commands in §5): HEAD `6575669`; `npm test` → **scripts 398/398 · src 2736 tests /
2726 pass / 10 skipped / 0 fail**, exit 0 (identical on Node 22.23.2 and Node 24.15.0); `npm run typecheck`
exit 0 (both legs); `npm run lint` exit 0, 0 warnings; CLI verbs `grep -c 'case "'` = **39**.

### R-1 · P0 · `research/multiagent/thoroughanalysis.md:22` (+ `:1116`) · register body says the keyed path is funding-blocked
- **Evidence:** line 22 `NO KEYED CALLS (the DeepSeek account is unfunded — all calls 402)`; line 1116
  `The DeepSeek account is UNFUNDED — every "keyed evidence" done-when is OWNER-gated (O-1)`. The 331 wave
  proved these false (`AW45-c01`; the `.env` key returns 200; a keyed run completes P6).
- **Cost to a resuming session:** it re-defers every keyed done-when against a non-existent funding block
  and may report keyed evidence as impossible — the exact false map this audit exists to remove.
- **Correction:** **applied** — register append `AW47-c01` above the end-marker (the body is left in place
  per the file's append-only protocol). Parent already corrected `START-HERE.md`/`README.md`.

### R-2 · P1 · `AGENTS.md:50` · the verb count says 35 while it claims to be the count source of truth
- **Evidence:** `AGENTS.md:50` "`rapidtool-cli.mjs` (35 verbs dispatched today — `grep -c 'case "'` is the
  count source of truth …)"; actual `grep -c 'case "' scripts/rapidtool-cli.mjs` = **39**
  (`README.md:9`, `docs-FOLDER-MAP.md:24`, `START-HERE.md:26`, `README-cli.md:10` all say 39).
- **Cost:** an agent trusting `AGENTS.md` undercounts the CLI by four verbs.
- **Correction:** **applied** — `AGENTS.md:50` now reads **39** with a dated note.

### R-3 · P1 · `AGENTS.md:62`, `START-HERE.md:66-67`, `README.md:15`+`:290` · stale test counts
- **Evidence:** docs say "scripts 261/261; src ~1957" (AGENTS), "scripts 261/261, src 1957/1957"
  (START-HERE), and the README banner "scripts 261/261 + src 1957/1957". Measured today: scripts **398/398**,
  src **2736 / 2726 pass / 10 skipped**.
- **Cost:** a session judges a red/green baseline against numbers two eras old and mis-attributes a change.
- **Correction:** **applied** — AGENTS (`:62`), START-HERE (new dated correction block), and README
  (new dated "Corrections in force" paragraph) all carry the current counts.

### R-4 · P1 · `fixes/332_0_parent.md:18-20` · the boundary report misrecords its own test accounting
- **Evidence:** §1 attributes "+6 tests to `cli-exit-taxonomy.test.mjs`, 2 to `typecheck-scripts.test.mjs`,
  6 to `check-module-coverage.test.mjs`". Committed bytes: cli-exit-taxonomy 28→**30** (+2),
  typecheck-scripts 4→**6** (+2); `scripts/check-module-coverage.test.mjs` was **not changed** by
  `3ecd48e` (`git show --stat 3ecd48e` lists only `check-module-coverage.mjs`). Measured now (Node 22):
  30 + 6 + 6 = **42**, and the scripts leg's real delta is **+4** (394→398), matching the report's own
  "+66 tests" — the +6/+2/+6 breakdown sums to 14. Also §1 says "2734 lib / 2 skipped"; the suites measure
  **2736 / 2726 pass / 10 skipped** (and §1's own baseline note says "+10 skipped").
- **Cost:** a resuming session can't reconcile the boundary gates; the report contradicts itself.
- **Correction:** **reported** (file is `fixes/332_*`, outside edit scope) + register append `AW47-c03`.

### R-5 · P1 · flat "still ONE module wearing several filenames" in four session-start docs
- **Evidence:** `RESUME.md:70-72` ("the factory currently emits a single-module product wearing five
  filenames" as current state), `remainingwaves.md:11`+`:225` ("the truth until …"), `README.md:210`
  (limit #1, unqualified), `START-HERE.md:105`. Disproved for keyed runs: 7 real job modules in
  `fixes/331_0_parent.md` §2; `{stubs:0, reexports:0, real:2}` + `leftoverJobsAreReexportsOrStubs:false`
  in `fixes/332_0_parent.md` §4.
- **Cost:** a session reports the flagship capability as unbuilt and prioritizes already-done work.
- **Correction:** **applied** — keyless-floor qualifiers + dated notes in `remainingwaves.md` (new block),
  `RESUME.md` (new block), `README.md` (limit #1 + Corrections-in-force), `START-HERE.md` (new block).

### R-6 · P2 · `remainingwaves.md` / `taskuniverselog.md` / `finalsprint.md` · 2026-09-16-era plans read as current
- **Evidence:** `remainingwaves.md:9-12` "Current state (2026-09-16, post-Wave-5)"; its whole catalogue is
  W6→W12 while the repo is at **W47**; `taskuniverselog.md:24-26` expects "scripts 195/195 + src 1662/1662";
  `finalsprint.md` RS-01/RS-02 say the keyed run is "still owed / owner-gated".
- **Cost:** the mandated read order (`AGENTS → RESUME → taskuniverselog → remainingwaves`) yields a
  six-wave-old map.
- **Correction:** **applied** — dated correction blocks in all three (plus `finalsprint.md` keyed-run
  supersession of RS-01/RS-02).

### R-7 · P2 · `START-HERE.md:22/29/30/31` + `docs-FOLDER-MAP.md` · tracked-file counts drifted
- **Evidence:** START-HERE says `src/lib` 213, `scripts` 46, `fixes` 587, `wave_plans` 108; tracked today
  (`git ls-files`) are **222 / 49 / 654 / 123**. docs-FOLDER-MAP says `src/` 211, `src/lib` 201,
  `scripts` 45, `fixes` 460, `wave_plans` 106 → **233 / 222 / 49 / 654 / 123**.
- **Cost:** orientation numbers mislead; low impact.
- **Correction:** **applied** — dated re-count notes in both files.

### R-8 · P2 · `START-HERE.md:62` · "lint … 1 warning (scaffold.ts 'kindHandoff' unused)"
- **Evidence:** `npm run lint` today → exit 0, **no warnings** (332 boundary also recorded 0 warnings).
- **Correction:** **applied** — noted in START-HERE's new correction block.

### R-9 · P2 · register body `R15-f04` (`thoroughanalysis.md:1416`) · "all 40 `scripts/**` … are unchecked"
- **Evidence:** `scripts/**` is now inside `npm run typecheck` as a per-file ratchet (`package.json:21`),
  and `rapidtool-cli.mjs` reads **0** errors (`typecheck` leg reproduces, exit 0).
- **Correction:** **reported** (register body is append-only) + register append `AW47-c05`.

### R-10 · P3 · `fixes/331_0_parent.md:105-106` · "`rapidtool-cli.mjs` carries 38 of the 173 errors"
- **Evidence:** the 332 wave retired those (AW46-c07): CLI = 0. File is `fixes/331_*`, outside edit scope.
- **Correction:** **reported** (already superseded by `AW46-c07`).

### R-11 · P3 · `fixes/332_0_parent.md` §5 · not every owed item names an owner/decision-maker
- **Evidence:** items 5 and 7 name the owner; item 1 names a product decision; items 3, 4, 6, 8 name none.
- **Correction:** **reported** + register append `AW47-c06`.

---

## 5. Cold-session read order — what I would now believe, and where it is wrong

Following the mandated order `AGENTS.md → RESUME.md → taskuniverselog.md → remainingwaves.md`
(plus `START-HERE.md`/`README.md`):

1. **`AGENTS.md`** — now correct on the CLI verb count (39) and the suite counts (398 / 2736). *Before this
   audit it said 35 verbs and 261/1957,* which would have made me distrust every test statement.
2. **`RESUME.md`** — the top now carries a dated correction: keyed runs work, the key is funded, counts are
   398/2736, and the "single-module product" claim is keyless-only. *The 2026-09-16 body below still reads
   as if `{0,5,0}` is the live truth*, but the correction block is unmissable. A session that read only the
   body would wrongly believe the flagship product is unbuilt and that `T0.10` is blocked on the user's key.
3. **`taskuniverselog.md`** — the new block flags the board as a 2026-09-16 snapshot and gives the current
   counts; *without it* the §0.2 "expected baseline" (195/1662) and the "Doctor truth … `{0,5,0}`" line
   would mislead.
4. **`remainingwaves.md`** — the new block states the catalogue is superseded and that TA-15 landed and a
   keyed run emits a real multi-job product; *without it* the doc's entire premise ("~6 waves remain
   (W6→W11)"; "Never claim multi-job emission before TA-15 lands") is a false map — the repo is at W47.
5. **The register** — a cold session reading top-down hits the false "account unfunded → 402" premise at
   line 22 (protocol block) and line 1116 (W27 register) *before* the `AW45` append that corrects it. The
   `AW47-c01` append now names both locations explicitly.

**Beliefs that would have been wrong without corrections:** (a) the DeepSeek account is unfunded and keyed
evidence is impossible; (b) the emitted product is still one module wearing several filenames; (c) the CLI
has 35 verbs; (d) the suite is ~1957 tests; (e) lint has 1 warning; (f) the plan is ~6 waves from done.
All six are now contradicted in place by dated corrections.

---

## 6. Hygiene

- **No leaked probe/scratch file.** `git status --porcelain` → only `?? wave_plans/W47/` (this wave's own
  briefs). The four commits contain no `probe*`/scratch/test-output file (the `probe` token in the
  `6cd5123` subject is prose, not a path). All harness/probe work in the lane logs lives under `%TEMP%`.
- **No staged secret.** `git diff --cached --name-only` is empty. `.env` is **not tracked**
  (`git ls-files .env` empty), is in `.gitignore`, and contains **0** `VITE_*KEY*` entries.
- **Append-only protocol respected.** No lane rewrote another's log: `3ecd48e` touches only `fixes/332_*`
  (and not the `331` logs); `6575669` touches only the parent's own `fixes/332_0_parent.md` + the W46
  README. The register end-marker
  (`<!-- END-OF-FILE-MARKER-W25 · every lane appends ABOVE this line · never edit or delete this line -->`)
  and the `finalsprint.md` marker are both intact, and all appends sit above them.
- **`.gitignore` still covers build/test output** — `node_modules/`, `dist/`, `.vercel/`, `.tanstack/`,
  `*.log`, `.env*` (except `.env.example`), `.rapidtool/logs/` (`**/.rapidtool/logs/` covers nested
  emitted trees), `.hermes/`.

---

## 7. Corrections applied (exact edits)

1. **`research/multiagent/thoroughanalysis.md`** — appended `AW47-c01 … AW47-c06` **above** the unchanged
   end-marker (the register's documented protocol). `AW47-c01` (register body funding premise falsified),
   `AW47-c02` (measured counts), `AW47-c03` (boundary-report test accounting), `AW47-c04` ("ONE module"
   keyless-only), `AW47-c05` (register-body rows superseded), `AW47-c06` (§5 owner coverage).
2. **`AGENTS.md`** — line 50: `(35 verbs dispatched today —` → `(**39** verbs dispatched today —` plus a
   dated note `*(Corrected 2026-10-02 by the W47 record audit: this line said 35; \`grep -c 'case "'\`
   re-derived = 39.)*`. Line 62: `(scripts 261/261; src ~1957 tests …)` →
   `(re-measured 2026-10-02 on \`6575669\`: **scripts 398/398; src 2736 tests / 2726 pass / 10 skipped**, exit 0;
   the older W12 gate-of-record numbers were 261/261 + ~1957)`.
3. **`START-HERE.md`** — appended a new section `## CORRECTION — 2026-10-02 (W47 record audit): the
   "ONE module" qualifier + drifted snapshot counts` above the unchanged
   `<!-- END START-HERE … -->` marker (keyless-only qualifier for line 105; tracked-file counts
   222/49/654/123; `npm test` 398/2736; lint 0 warnings; `scripts/**` now typechecked; CLI 0 errors).
4. **`README.md`** — limit #1 heading qualified to `… — on the KEYLESS floor.` with a dated note; and a new
   dated paragraph `**Corrections in force — appended 2026-10-02 (W47 record audit; HEAD \`6575669\`):**`
   giving the current counts, the "W29–W46 are committed" correction, and the keyed multi-job product.
5. **`RESUME.md`** — inserted `## CORRECTION — 2026-10-02 (W47 record audit) — §1 below is a 2026-09-16
   snapshot; the disk wins` before `## 0.`, covering the single-module-claim scope, the gate-table counts,
   and the funded-key/`T0.10` supersession.
6. **`remainingwaves.md`** — inserted a dated `> **CORRECTION — 2026-10-02 (W47 record audit).**` block
   after the "Current state (2026-09-16…)" paragraph (TA-15 closed; keyed multi-job product real; the
   `{0,5,0}` census and the "Never claim multi-job emission" rule historical; current counts).
7. **`taskuniverselog.md`** — inserted a dated correction block after the
   `**⚠️ STATUSES BELOW ARE SNAPSHOT VALUES …**` line (superseded §0.2 baseline; current counts; TA-15 +
   funded key).
8. **`finalsprint.md`** — appended `## §W47-RECORD-AUDIT — appended 2026-10-02 (333-2 Registrar) …` above
   the unchanged `<!-- END-OF-FILE-MARKER-SPRINT … -->` (RS-01/RS-02 keyed-run supersession; current
   verb/test counts).
9. **`docs-FOLDER-MAP.md`** — inserted a dated `> **Re-counted 2026-10-02 …**` note after the header
   blockquote (233/222/49/654/123 tracked).

No history was deleted; every edit is additive or a dated in-place correction.

---

## 8. What I did NOT do, and why

- **No commits** (boundary owner's job) and **no edits** to `src/**`, `scripts/**`, `package.json`,
  `tsconfig*.json`, `fixes/331_*`, `fixes/332_*`, or `wave_plans/W45|W46`.
- **No keyed call, no `npm run eval`** — no secret beyond the existing tail-only notices was printed;
  `.env` was never read into output beyond checking it is untracked and holds no `VITE_*KEY*`.
- **Did not "fix" the register body in place** — the file's protocol is end-marker append (done).
- **Did not run `bash scripts/gate.sh`** — `npm test`, `npm run typecheck`, `npm run lint` were run
  individually on a frozen, clean tree, which reproduces the parent's boundary claims without the
  combined-verdict machinery.

## Verdict

**DONE.** Nothing is lost or unrecorded (empty orphan list; all claim→bytes traces reproduce). The record
lied in three high-traffic places; all are now corrected additively/dated, or reported with a register row
where the file is outside scope. The handoff's mandated read order now yields the true state: the keyed
path is funded and proven, the emitted keyed product is a real multi-job app, the CLI has 39 verbs, and the
suite is `scripts 398/398 · src 2736 / 2726 pass / 10 skipped` with typecheck and lint at 0.
