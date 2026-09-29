# W42 · SPEC — THE DEFINITIVE REMAINING-WORK SPECIFICATION

> **Body COMPLETE** — ENGINEER (`fixes/302_eng_review.md`), every item byte-verified against HEAD `424f9e5` **+ working tree**, 2026-09-28. Appendices A–C below: ENG-HELP (`fixes/302_eng_help.md`) — Appendix A = raw owed-items inventory (A-1…A-154, provenance-tagged), Appendix B = helper's byte-verification rows, Appendix C = file-box collision map.
> **Baseline:** HEAD `424f9e5`; tree dirty only with `fixes/300_v1_sixpins.md` (+4-line append) + untracked `fixes/302_eng_help.md` / `fixes/302_eng_review.md` / `wave_plans/W42/`. Suite: src **2251/2250/0** (1 legit skip) · scripts **328/328** · build **0** · boot **200** · `npx eslint src/lib/packet.ts` → **4 warnings** (the only lint blemish; one lane kills them, L2-P1).
> **Contract for EVERY lane:** verify each anchor against bytes before editing (re-read the region — lines below are today's, expect ±5 drift; anchors marked *read-fresh*) · PATCH-FIRST, additive-only · `node --check` (or `--experimental-strip-types --check`) per edited file · legs **FOREGROUND** only · **NO keyed calls** · NO full gates mid-fleet · declare-or-strike (every claim = bytes read / command run) · one evidence line per item (`file:line · before → after · proof`) appended to the lane's own log `fixes/303_L{n}.md` (open EARLY, append-only) · sizes: **S ≤ ~15 min · M ≤ ~45 min · L ≤ ~2 h** per card.

---

## §0 · How this spec was built (method + trust order)

All owed-item lists were read in full (Appendix A is the raw inventory): `fixes/301_x1_pipeline.md` + X1/X2/X3/X4 summaries (`~/AppData/Local/hermes/cache/delegation/subagent-summary-*-20260928_2249*.txt`) · `fixes/296_q5_register.md` (54 rows; 16 DEFER + partials) · `fixes/296_q8_ops.md` + `wave_plans/W35/factory-notes.md` OPS-1…21 · the q2_a2-era ledger (`subagent-summary-1-20260927_043617_513416.txt`; `fixes/296_q2_a2.md` was never written — this spec + Appendix A supersede it) · `fixes/283_final_ledger.md` + `wave_plans/W40/CONTINUE-PROMPT.md` §3 · the 295_* / 296_* / 301_* lane logs · `fixes/298_t2_pins.md` + `fixes/300_v1_sixpins.md` (both CLOSED).
Each candidate was re-verified against the bytes on disk today (shell `grep`/reads — ripgrep fails on the space in the path). Finished items are **struck in §1 with proof**; the real remainder became **coder cards in §2**, cut into 4 disjoint lanes (**partition in §2.0**); **§3** is the boundary plan; **§4** is what remains after this spec (owner items + wave-sized deferrals with reasons). Trust order: bytes > this spec > the lane logs' prose > Appendix A (raw, provenance-tagged, some rows already landed — §1/§2 rule).

---

## §1 · STRIKE-LIST — verified done; do NOT re-edit (proof = today's bytes/commands)

| # | Item (sources) | Proof (today, `424f9e5` + working tree) |
|---|---|---|
| ST-1 | **F3-10 product half** (X1 A-5; W40 §3-D) | `store.ts:1407-1413` + `:1425-1429` = `keepLiveWildRun(rebaseUserFields(next.project, live), live)`; helpers `:268/:299`; 8 twins wrapped. Residual = regression pin → **card L2-P8**. |
| ST-2 | **X3 build/boot/e2e lane** (301_x3) | All three legs green; **no product items owed**; pitfall recorded (taskkill `//F` rejected — use `MSYS2_ARG_CONV_EXCL='*' taskkill /F /T /PID <pid>`). |
| ST-3 | **U1 `entry-runs` product half** (299_u) | `run-eval.mjs:2578-2586` `passesAcceptance` ANDs `behaviorOk === false`; `evaluateEntryRunsRow` `:795-864` real bounded spawn; graders all v2 (11/11 `"graderVersion": 2`, 12 corpus md — ENG-HELP B-16). Residual = **pins missing** (`run-eval.test.mjs` 0 hits on `entry-runs|evaluateEntryRunsRow|checkExpectedBehavior`) → **card L1-E3**. |
| ST-4 | **Q4-b coded reason** (X2) | Landed in `424f9e5`: `run-eval.mjs:2602-2625` failed behavior-row detail rides `acceptanceFailReason` (120-char bound); `node --check scripts/run-eval.mjs` → syntax OK today. Residual = pins (L1-E3). |
| ST-5 | **Q4-c history half** (X2) | `historyEndClass` `run-eval.mjs:2849-2855` + history row `endClass` `:2893`. Residual = `entries` rows + crash row → **card L1-E1**; scorecard reader → **L1-E2**. |
| ST-6 | **X4 probe consolidation** (A-16) | 12 `git mv` root→`fixes/` landed in `424f9e5`; root tracked = **42** live (`git ls-files \| grep -v / \| wc -l`); §10.2 header "(all 42 tracked — named)" correct. Residual = README §10.1 cells → **card L3-D1**. |
| ST-7 | **fixes/298 T2** — six contract-collision reds | CLOSED — all six landed (`fixes/300_v1_sixpins.md`), every file re-run green. No action. |
| ST-8 | **fixes/300 V1** — six pinned reds | CLOSED — landed; `npm test` both legs green on retry. No action. |
| ST-9 | **W-40 `resume`/`unattended` verbs** (OPS-14) | `rapidtool-cli.mjs:711` (`case "resume"`), `:754` (`case "unattended"`); README-cli.md:11 lists both. Strike. |
| ST-10 | **OPS-9 diagnose ordering** | `rapidtool-cli.mjs:3504-3506` — newest-first read + explicit chronological re-order comment ("OPS-9 (K13, W40 N5)"). Strike. (OPS-10 budget constants: cited landed by Q8 t0 + A-22; re-grep at lane start if touched.) |
| ST-11 | **OPS-15 standing-red list** | Re-pointed: `scripts/rapidtool-cli-edit.test.mjs:307/:340/:433` titles carry "W36-N6 re-point, R5-f12"; refusal assertions replace the pre-Track-1 `policy.decision==="deny"` expectations; suite 328/328. Strike. |
| ST-12 | **A-84 `respond()` stdout truncation** (§A2 row 4) | Landed: `rapidtool-cli.mjs:176-182` — `writeSync(1, payload)` drain before the in-tick exit (`fixes/297` R1 comment). Strike. |
| ST-13 | **K7 rows 1/2/5/11** (+ W-12/W-13 honesty rows) | Verified today: `packet.ts:146-148` `decided_via`; `:707-714` P6 label branches on `lastTest.label` + `evidenceHash`; `rt-client.ts:701-702` nulls; `console.tsx:1185` `scope:"sys"`. Strike. (K7#8/#9 `cli.mjs` nulls + diagnose checkpoint: #9 LIVE-run verified (Appendix B-14); strike on that basis.) |
| ST-14 | **W-14/W-15** (grader v2 + 4 kind fixtures) | On disk: corpus 12 md / 11 graders, all `"graderVersion": 2` incl. `expectedKind`/`expectedBehavior` (Appendix B-16; `research/eval-corpus/graders/`). Residual = pins (L1-E3). |
| ST-15 | **R1-era claims** (`fixes/297`: exit-taxonomy regex widened; README counts `476/429/44`) | The census moved AGAIN after R1: fixes 429→**450**, total 1,715→**1,754** (live today) — the current drift is handled by **card L3-D1** (full re-derive), not a re-strike. |
| ST-16 | **H1 throws pass / W-35** | token-ledger guards landed + pinned (W-35 LANDED; H1 probe 73c/2t both by-design). Strike. |
| ST-17 | **tracked temp strays** (P4 hygiene note) | `git ls-files \| grep hermes-tmp` → **empty** (removed in the W40 era; §10.6 note is accurate). Strike. |
| ST-18 | **`fixes/296_q2_a2.md` + the X1/X2/X4 per-item ledgers** | Process debt only: the x4 disposition table (= this spec + Appendices) and the q2_a2 ledger (= Appendix A §A.9.1 + §2 cards) are **superseded**; do not create them. Lanes log to `fixes/303_L*.md`. |

**Verified-true, deliberate no-change** (recorded so nobody "fixes" them): (a) `run-eval.mjs:3337-3348` driver-crash stub + `exit 0` — deliberate, self-documented ("results-are-data contract"); (b) `buildSummary` key set is PINNED to exactly 7 keys (`run-eval.test.mjs:692-696`) — the class census goes in the scorecard `derived`, never here; (c) `packetSpendSummary` exported with zero external consumers — keep (packet.ts owns it); (d) `parseArgs` bare `--flag` rule is deliberate (the `--key=value` form exists; refusal text at `:1785` teaches it — extend wording only if it doesn't, L4-G12).

---

## §2 · THE FOUR CODER LANES (disjoint file-boxes · zero collisions)

### §2.0 · Partition + dispatch

| Lane | Theme | File box (sole writer per file) | Cards | Load |
|---|---|---|---|---|
| **L1** | **Acceptance/eval truth tail** | `scripts/run-eval.mjs` · `scripts/run-eval.test.mjs` · `src/lib/scorecard.ts` (+ NEW `src/lib/scorecard.test.ts`) · `src/lib/fixtures.ts` · `src/lib/fixtures.server.ts` · `src/lib/fixtures.test.ts` | E-1…E-6 | M-M (biggest single value) |
| **L2** | **Packet/crew budget + lint-0** | `src/lib/packet.ts` · `src/lib/crew.server.ts` · `src/lib/planning.ts` · `src/lib/io.ts` · `src/lib/packet.test.ts` · `src/lib/crew.test.ts` · `src/lib/io.test.ts` · `src/lib/planning.test.ts` · `src/lib/store.test.ts` (READ-ONLY: `token-ledger.ts`, `verify.server.ts` as pattern) | P-1…P-8 | S-M (fastest wins + lint 0) |
| **L3** | **Docs census + doc-truth** | `README.md` · `START-HERE.md` · `docs-FOLDER-MAP.md` · `scripts/README-cli.md` · `AGENT_GUIDE.md` · `scripts/docs-module-parity.mjs` | D-1…D-6 | S |
| **L4** | **Scripts/guards/CLI hygiene** | `scripts/gate.sh` · `scripts/gate-verdict.test.mjs` · `scripts/migration-plan.mjs` · `scripts/migration-plan.test.mjs` · `scripts/write-atomic.mjs` · `scripts/write-atomic.test.mjs` · `scripts/browser-guard.mjs` · `scripts/browser-guard.test.mjs` · `scripts/brand-check.mjs` · `scripts/preview.mjs` · `scripts/rapidtool-cli.mjs` · `scripts/cli-exit-taxonomy.test.mjs` · `src/lib/runtime-log.server.ts` · `src/lib/runtime-log.server.test.ts` · `src/lib/headless.ts` · `package.json` | G-1…G-13 | S each, ~9 items |

**Disjointness (collision map = Appendix C; its ⚠ rows honored):** one writer per file; where Appendix C's suggested partition differs, THIS body rules: `headless.ts` → **L4 only** (its other listed item — the acceptance read — is already landed; the only remaining headless item is G-9) · `store.test.ts` → **L2 only** (P-7 pin) · `gate-verdict.test.mjs` → **L4** · `docs-module-parity.mjs` → **L3** · `token-ledger.ts` / `verify.server.ts` = **READ-ONLY** pattern sources for L2 (edit neither).
**Ordering (smallest-highest-value first):** dispatch **L2 + L3 first** (fast, visible wins: lint-0, census truth), **L1 next** (largest single value; no dependency), **L4 alongside** (micro-hygiene, all S). Lanes are mutually independent — run concurrently; they must NOT run the full gate (see §3).
**Per-lane rules:** open `fixes/303_L{n}.md` EARLY; land item → its check → evidence line; `node --check` every edited file; legs foreground; no keyed calls; if a card's anchor drifted, re-read and adjust — never patch blind.

---

### L1 · ACCEPTANCE/EVAL TRUTH TAIL — `scripts/run-eval.mjs` · `scripts/run-eval.test.mjs` · `src/lib/scorecard.ts` (+new `src/lib/scorecard.test.ts`) · `src/lib/fixtures*.ts`

**Gate for this lane (run at lane close, foreground):** `node --check scripts/run-eval.mjs` · `node --test scripts/run-eval.test.mjs` (baseline **35/35** green) · `node --experimental-strip-types --test src/lib/scorecard.test.ts` (new) · `node --experimental-strip-types --test src/lib/fixtures.test.ts` · keyless scratch smoke: run `run-eval.mjs` with `EVAL_OUT_DIR` pointed at a **scratch dir outside the repo** (read `run-eval.mjs`'s env reads first) → inspect `results.json`.

- **L1-E1 · `endClass` on results.json `entries` rows + the crash row** [S]
  - *What:* every results.json entry (and the crash-fallback row) carries `endClass: "funded" | "unfunded" | "unmeasured"`, matching the classifier history rows already use.
  - *Where (re-verified today):* entryRow literal `run-eval.mjs:2488-2565` (add after the literal, or compute inline from the same inputs); crash-fallback row `:3240-3256`; classifier `historyEndClass` `:2849-2855` (`notes.noBalance===true` → unfunded; `acceptance.pass` boolean && `mode==="keyed"` → funded; else unmeasured); history already calls it `:2893`.
  - *Why:* Q4-c/X2 tail: history rows carry the class since `ac6b151`; results rows don't (verified 0 hits on `endClass` beyond `:2849/:2892/:2893`).
  - *HOW:* entry rows: `const entryRow = {...}; entryRow.endClass = historyEndClass(entryRow, mode);` (the object already carries `acceptance` + `notes.noBalance` — `:2536-2556` confirms both). Crash row: `endClass: "unmeasured"` with a comment citing the classifier's own doc ("a crashed/skipped trial … unmeasured", `:2845-2847`).
  - *Done-when:* keyless scratch run's `results.json` entries each carry `endClass` ∈ the 3 values; `history.json` rows byte-compatible; `run-eval.test.mjs` gains the historical-classifier pin (E-3).
  - *Traps:* `entries` are `rows[].entryRow` (`persist :2873` maps `r.entryRow`) — patch the literal, not the reader; never invent a class for legacy rows (`reader tolerates absence`, E-2); keep `noBalance` handling (`status:"no-balance"` + `notes.noBalance`) as-is.
- **L1-E2 · scorecard READER: verification label + endClass + class census** [M]
  - *What:* `scorecard.ts` reads and surfaces: `verification` on acceptance; `behaviorOk`/`kindOk`/`endClass` on entries; `endClass` on history rows; an acceptance/class census in `derived` + honest notes lines. The CLI `eval` verb responds the scorecard **verbatim** (`rapidtool-cli.mjs:1523`-era — verify) ⇒ this renders free; **no `cli.mjs` edits.**
  - *Where:* `EvalAcceptance` `scorecard.ts:107-115` · `readAcceptance` `:167-184` (drops `verification` today) · `EvalEntry` `:122-155` · `readEntry` `:199-245` · `EvalHistoryRow` `:291-302` · `parseEvalHistory` `:304-330` · `derived` `:447-457` + `:696-709` · notes array `:613` · flattened `entryRows` mapping `:613-690`.
  - *Why:* L3's render tail (X2): the label exists in results but is invisible to the operator; legacy artifacts (`research/eval-out/`) lack the keys — the reader must tolerate absence, never invent (grep `endClass history.json` on legacy = 0).
  - *HOW:* add `verification: string | null` to `EvalAcceptance` + `verification: str(raw.verification)` in `readAcceptance`; add `behaviorOk: boolean | null; kindOk: boolean | null; endClass: string | null;` to `EvalEntry` + read them; add `endClass: string | null` to `EvalHistoryRow` + `endClass: str(raw.endClass)` in `parseEvalHistory`; `derived` gains `endClass: { funded, unfunded, unmeasured, absent }` (count over entries; a row without the key counts `absent` — never fabricated into "unmeasured") and `acceptance: { pass, fail, unscored }` (from `acceptance.pass === true|false|else`); push notes lines naming the census; thread `endClass` onto the flattened display rows if they carry per-entry fields (read `:613-690`).
  - *Done-when:* new `src/lib/scorecard.test.ts` green — cases: legacy row w/o keys → nulls + `absent` counted; populated row → fields ride; hostile shapes don't throw; census arithmetic. Keyless smoke: `eval` (scorecard verb) response carries `derived.endClass`.
  - *Traps:* do NOT put the census in `buildSummary` (pinned, `run-eval.test.mjs:692-696`); `str()`/`bool()`/`num()` helpers are the house style — reuse; keep additive-order stability for any JSON deep-equal pins in the scorecard tests (write new pins asserting MORE, never weakening).
- **L1-E3 · the missing pins (U1 + Q4-b/c)** [M]
  - *What:* `run-eval.test.mjs` pins for: (1) `evaluateEntryRunsRow` REAL evaluation (temp entry script: exit-0-within-budget → pass; exit-1 → `behaviorOk:false` + the row's `detail` carries the exit code); (2) `acceptanceFailReason` coded detail (failed behavior row w/ detail → reason contains it, ≤120 chars); (3) `historyEndClass` tri-state (unfunded/funded/unmeasured); (4) entries `endClass` (via E-1's seam — pin `historyEndClass` + a synthetic row if `persist` isn't importable; the scratch smoke covers end-to-end).
  - *Where:* `run-eval.test.mjs` (imports already expose `acceptanceFailReason`, `checkAcceptance`, `historyEndClass`? — check the import block `:1-60`; add what's missing).
  - *Why:* `git show 4af061a --stat` carries **no** test-file pin; `grep entry-runs|evaluateEntryRunsRow|checkExpectedBehavior scripts/run-eval.test.mjs` → **0 today** — the entire U1 claim rides unpinned (the campaign's biggest pin gap).
  - *Done-when:* `node --test scripts/run-eval.test.mjs` → 35 + N green, 0 fail; new tests fail if the coded detail is removed (prove by reverting mentally — assert exact substrings).
  - *Traps:* **never weaken** existing 35; `meanAtLeast:1` unreachability on a first keyless run (A-14/F4#3) is PRE-EXISTING — if it fires in the smoke, record it, do not "fix" by loosening a pin; keep spawns bounded (use `ENTRY_RUN_TIMEOUT_MS` helpers)
- **L1-E4 · fixtures: no fake review rows** [S]
  - *What:* a fixture whose frontmatter failed to parse (`f.ok === false`) must never surface as `reviewState: "awaiting-decision"`; the row must name the parse failure.
  - *Where:* `fixtures.ts:186-206` (`fixtureReviewRows`: `reviewState: graderOk ? "awaiting-decision" : "bar-missing"` — no `f.ok` gate; `graderProblem` only names the grader side); loader `fixtures.server.ts:58-75`.
  - *Why:* W-29(g): "fixtures README fake row STILL MINTS" (handoff chain p3→; still live today).
  - *HOW:* `reviewState: f.ok && graderOk ? "awaiting-decision" : "bar-missing"`; when `!f.ok`, set `graderProblem` (or a `fixtureProblem`) to the fixture's parse failure text (read `parseFixtureFrontmatter`'s return for the message field) — honest, not "no grader file for this slug".
  - *Done-when:* `fixtures.test.ts` pin: unparseable fixture + valid grader → state ≠ `awaiting-decision` + problem names the parse failure; leg green.
- **L1-E5 · dead fixture-decision exports — disposition** [S]
  - *What:* `FixtureVerdict` / `FixtureDecisionEntry` / `fixtureDecisionEntry` — zero consumers; they cannot be appended to `project.decisions` (`HitlDecision` requires phase/title/requestedAt/decidedAt; the engine's `wellFormedDecisionRow` would drop a mismatched row).
  - *Where:* definitions + `fixtures.review.ts`/`fixtures.ts` (grep `FixtureDecisionEntry|fixtureDecisionEntry|FixtureVerdict`).
  - *HOW (declare-or-strike, smallest):* add an `@de-scoped — no consumer; cannot ride project.decisions (HitlDecision shape; see fixes/295_p3_eval.md t0)` comment block above them. Removal ONLY if a fresh repo-wide grep (incl. tests + console) returns 0 hits — then `git rm`-scope stays inside this lane's box; the console W24 comment (P3's note) is NOT edited here (console is parked, §4).
  - *Done-when:* comment landed or exports removed + typecheck/lint still 0/0 on touched files; grep evidence in the lane log.
- **L1-E6 · run-eval hygiene cluster** [S-M]
  - *What:* (a) atomic `results.json`/`history.json` writes; (b) bounded history growth; (c) adopt the robust main-module check.
  - *Where:* `persist()` `run-eval.mjs:2874` (`writeFileSync(RESULTS_PATH,…)`), `:2908` (`writeFileSync(HISTORY_PATH,…)`); the atomic precedent already in-file: marker write `:2930-2942` (tmp + `renameSync`); main-check `:3330-3334` vs the correct idiom `scripts/with-app-env.mjs:97-105`.
  - *How:* (a) add a local `writeJsonAtomic(target, obj)` (mkdir + tmp + rename, styled after `:2930-2942`) and use it for both persists; (b) `MAX_HISTORY_ROWS = 200` const; after appending, `history = history.slice(-MAX_HISTORY_ROWS)` before the write + one comment line; (c) `isMainModule` = `resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()` guarded by try/catch (mirror with-app-env).
  - *Done-when:* `run-eval.test.mjs` pins: history capped (write >200 synthetic rows through the append path — or unit the slice if persist isn't importable; else pin `MAX_HISTORY_ROWS` export); atomic helper unit (injectable rename failure keeps the old file — only if a seam exists, else declare); keyless smoke green.
  - *Traps:* don't change file formats/shapes (scorecard + gate consume them); keep `finishRunMarker` semantics; Windows rename-over-existing works (renameSync replaces) — but keep tmp in the same dir.

### L2 · PACKET/CREW BUDGET + VISIBILITY (the F2 tail; kills the 4 lint warnings)

**Gate:** `node --experimental-strip-types --check src/lib/packet.ts` (owed by X1, never run) → then `npx eslint src/lib/packet.ts` (**target 0 warnings**) → `node --experimental-strip-types --test src/lib/packet.test.ts src/lib/crew.test.ts src/lib/io.test.ts src/lib/planning.test.ts` → lane-close `npm run lint` scoped + `npx tsc --noEmit` full (the boundary re-runs anyway).

- **L2-P1 · F2-04 completion — packet budget boundary (the centerpiece; kills lint) [M]**
  - *What:* implement `packetBudgetBoundary()`; add the always-present envelope `budget` key `{spent, cap, stop_reason}`; thread `opts.budget` (default `sessionTokenBudget()`); add the additivity + boundary test. This consumes the 4 orphaned imports (`budgetCap`, `isBudgetExhausted`, `sessionTokenBudget`, type `TokenBudget`) → `packet.ts` lint 4→0.
  - *Where (today):* imports `packet.ts:9-18` (widened, unused — the 4 warnings at `:12/:14/:15/:18`); header note `:32-34` already names `packetBudgetBoundary`; `systemJson` `:108-195` (`spend: spendBlock(spend)` at `:189`; `spendBlock` `:411`; `PacketSpend` `:314`); `compileAgentPacket` `:442-470` (opts + `const spend = …` `:469`); `systemJson(...)` call `:611-616`; ledger helpers `token-ledger.ts:286-373` — `TokenBudget = {ledger, cap: number|undefined}`, `budgetCap()` (`:297`), `sessionTokenBudget()` (`:340`), `isBudgetExhausted()` (`:361`, `totalTokens > cap`, never for unmetered).
  - *Why:* register F2-04 + W-21 spec: "the packet shows measured `{spent, cap, stopReason}`"; stop fires only when spend actually crossed the cap; never an optimistic "ok"; cap omitted(→null) when unmetered (`RAPIDTOOL_TOKEN_CAP` unset). Byte-verified unlanded: `grep stop_reason|stopReason src scripts` → 0 (repo-wide; only the header-note reference).
  - *HOW:*
    1. `export type PacketBudget = { spent: number; cap: number | null; stop_reason: "budget_exhausted" | null };` near `PacketSpend` (`:314`).
    2. `export function packetBudgetBoundary(budget: TokenBudget | null | undefined): PacketBudget | null` beside `packetSpendSummary` (`:359`): return `null` unless a budget object is present AND (spent > 0 || cap !== undefined || exhausted); else `{ spent: totalTokens(budget.ledger), cap: budgetCap(budget) ?? null, stop_reason: isBudgetExhausted(budget) ? "budget_exhausted" : null }`. (`totalTokens` is already imported; guard `budget.ledger` with the module's own tolerant style.)
    3. `systemJson` gains a `budget: TokenBudget | null` param; add `budget: packetBudgetBoundary(budget),` **right after** `spend:` (`:189`) with an F2-04 comment mirroring the OV-41 style. `PACKET_VERSION` stays 3.
    4. `compileAgentPacket` opts gains `budget?: TokenBudget | null`; `const budget = opts?.budget ?? sessionTokenBudget();` next to the `spend` line; pass into the `systemJson(...)` call (`:611-616`).
  - *Done-when:* `npx eslint src/lib/packet.ts` → **0 problems**; `packet.test.ts` new cases: (a) default/empty session budget → `"budget": null` (byte-additive: existing envelope pins unchanged); (b) spend recorded, no cap → `{spent>0, cap:null, stop_reason:null}`; (c) `createTokenBudget(10)` + spend crossing → `stop_reason:"budget_exhausted"`; packet leg green; full `npm run lint` → 0 warnings.
  - *Traps:* `sessionTokenBudget()` lazily reads env ONCE per process — in tests call `resetSessionBudget()` or pass an explicit budget; never spend/record anything in this lane (keyless); the envelope is a JSON string — ordering/`JSON.stringify` stability matters for pins (add key LAST, like `spend:`); `stop_reason` fires ONLY via `isBudgetExhausted` (strict `>`; landing exactly on the cap = still ok).
- **L2-P2 · F2-07 TODO** [S] — comment on `exportProfiles` (`packet.ts:943`): `// TODO(F2-07): zero non-test consumers — KEEP; packet.test.ts pins the key set (:676 deepEqual + 8 more). Wire the six coding tools or remove at the next surface audit.` Done-when: grep `TODO(F2-07)` → 1; packet leg green.
- **L2-P3 · F2-09 TODO** [S] — comment on `crewToReport` (`crew.server.ts:1406`): `// TODO(F2-09): zero code consumers; cited only by the planned ingest path (research/multiagent/03_crew_design.md:267-606, box unchecked :606) — wire or de-scope at the next ingest pass; KEEP until then.` Done-when: grep → 1; crew leg green.
- **L2-P4 · `project.acceptance` machine key** [S] — in `systemJson`, add `acceptance: project.acceptance ?? null,` (near `verdict:`). Field exists (`types.ts:472`), written by `runAcceptance` (`headless.ts:140`), sole non-test caller = SIGTERM abort (`rapidtool-cli.mjs:564`); packet.ts grep = 0 today (invisible to downstream agents — G2 edge-1 GAP). Done-when: packet.test.ts pin (null when absent; object rides when present); leg green.
- **L2-P5 · F2-10 crew budget seam** [M]
  - *What:* the crew wire calls run through the ledger — pre-dispatch gate + spend recording + coded `RT_E_BUDGET_EXHAUSTED` on stop (never an escaping throw, never mislabeled `RT_E_INTERNAL`).
  - *Where:* `crew.server.ts` — completer seams `completeCrewTurn(deps.complete…)` `:1042`, plan-act `deps.complete` `:1238`, `createPlanning(deps.complete)` `:1139`; registry completer `:885`; plan-refusal literal `code:"RT_E_INTERNAL"` at `:~1150`; `planning.ts:79` `PlanStepsResult` ok:false arm. Production pattern to copy: `verify.server.ts:42` import + `:814/:827/:858` `await runBudgetedCall(budget, () => callModel(...))`; wrapper `token-ledger.ts:483`; bank `RT_E_BUDGET_EXHAUSTED`.
  - *HOW:* (1) `planning.ts`: add `code?: ErrorCode` to the `{ ok:false … }` arm (+ type-only import from `./errors.ts`). (2) `crew.server.ts`: at the run entry that owns the seams, `const budget = opts.budget ?? sessionTokenBudget();` then wrap ONCE: `const budgetedComplete = (prompt, o) => runBudgetedCall(budget, () => deps.complete(prompt, o));` and pass `budgetedComplete` to `createPlanning` / `completeCrewTurn` / the plan-act call (read the run function fresh — do NOT wrap per-call; record every usage exactly once). (3) Refusals: where `res.ok === false` maps to a run result, detect `isBudgetStopRefusal` → `{ ok:false, reason:"error", code:"RT_E_BUDGET_EXHAUSTED", error: <refusal message> }`; plan call: `code: planRes.code ?? "RT_E_INTERNAL"` at the `:~1150` return. (4) opts type: add `budget?: TokenBudget | null` additively where the run options live. **`crew.ts` untouched** (server singleton owns the ledger; the client cannot).
  - *Done-when:* `crew.test.ts` pins: (a) completer that would exceed the cap → refusal with `RT_E_BUDGET_EXHAUSTED` (not `RT_E_INTERNAL`, not thrown); (b) unmetered → completer called exactly once, result unchanged; (c) plan-call budget stop → `planRes.code` rides through. Legs green.
  - *Traps:* `runBudgetedCall` records usage itself — do not double-record; keep the in-memory `maxTotalTokens` guards (`:983/:1035/:1178/:1232`) as-is; a budget stop must not corrupt `session.status` semantics (`stopped-no-key` vs `error` — follow the existing mapping, extend only the code).
- **L2-P6 · io operator-notes de-dupe (F2-23 io half + K7#4/W-24 io)** [S]
  - *What:* `exportPacketText` must not append a SECOND `## Operator notes` block when the packet body already embeds one (`packet.ts:595-602` "## Operator notes (human steering)" vs `io.ts:518-523` append — read fresh).
  - *HOW:* detect the heading in the incoming text; append only when absent (one-line guard + comment naming both renderers); if the two headings' exact strings differ, normalize the CHECK to the existing emitted heading (match `packet.ts`'). Done-when: `io.test.ts` pin: exactly ONE `## Operator notes` heading in exported text for a notes-carrying project; leg green.
  - *Traps:* never re-render packet content (exportPacketText reads the persisted packet — keep verbatim); the console path is out of scope.
- **L2-P7 · F3-10 regression pin** [S] — `store.test.ts`: pin that a live wild run's user fields survive a stale committed copy (the `keepLiveWildRun(rebaseUserFields(...), live)` semantics at `store.ts:1407-1413/:1425-1429`, helper `:268/:299`). Done-when: store leg green; pin fails if the helper is removed. (Residual closes A-5 / X1's note.)
- **L2-P8 · stale-packet re-stamp check (F2-03b, quick verify)** [S] — verify `store.ts` `setNotes`/`ingestReport` re-stamp path against K12's F2-03b claim (notes/ingest never `stampPacket`). If REAL and small (one `stampPacket` call at the noted sites), land it; else record precisely for §4's engine wave. Evidence line either way.

### L3 · DOCS CENSUS + DOC-TRUTH (single writer)

**Gate:** `node scripts/docs-module-parity.mjs` before/after the DOCS edit; every number re-derived by its own command at edit time; `node --test scripts/README-cli.test.mjs` if README-cli pins are touched (its stale-phrasing pins `:171-176` must be UPDATED to assert the new bytes — asserting MORE, never weakened).

- **L3-D1 · README census re-derive** [S] — §10.1 table `README.md:304-327`: re-run every cell's own command; **today's anchors: root 44→42, fixes 429→450, total 1,715→1,754**, research 476 ✓, src 210 ✓, wave_plans 105→re-derive-after-W42 (this file adds ≥2), scripts 45 ✓, others re-derive (`git ls-files <dir> | wc -l`). Update the "re-derived … at ac6b151" date/HEAD line (`:302-304`) to the W42 close. §10.9 header `(429 tracked)` `:588` → live. §10.6 `:410` "200 files = 111 modules + 89" → live **115 modules + 85 tests** (`git ls-files src/lib | grep -c '\.test\.ts$'` → 85 today; `-vc` → 115 — verify at edit time). §10.2 set-diff: `git ls-files | grep -v /` vs the named rows; ensure `probe-k9-kinds.mjs` + `probe_n2_f316.mjs` are named (post-X4 they remain — W-36 keeps). Done-when: every §10 number equals a command run at edit time; §10.2 covers all 42; no "1,715"/"429"/"44"-for-root cells left.
- **L3-D2 · START-HERE counts** [S] — `:26` "191 files" → **200**; `:29` "(40)" → **45**; `:28`+`:91` "37 verbs" → **39** (`grep -c 'case "' scripts/rapidtool-cli.mjs`). Done-when: grep for `191|37 verbs|(40)` → 0; spots match live commands.
- **L3-D3 · docs-FOLDER-MAP re-derive** [S] — patch its per-node numbers (former deltas: 201→210 · 191→200 · 40→45 · 1→2 · ~342→419 · 93→105 · 28→35 dirs · 37→39 verbs; W25 dir absent — re-derive live, do not trust the deltas). Done-when: numbers match `git ls-files` counts at edit time; spot-check 3 nodes.
- **L3-D4 · README-cli.md fidelity pass** [M]
  1. §Tests `:1042-1046` (two-suite snippet) → the REAL list (`ls scripts/*.test.mjs` + `src/lib/**/*.test.ts` suite + both canonical commands).
  2. Wild example `:837-840` shows `ok:true` **and** `error:"…"` — the file's own rule (`:185`-era H1) forbids the dual shape; split into success (no `error`) vs failure shapes.
  3. Missing-module claims (Vault/Design/Agent-contract sections: "exit 1") vs bytes (**exit 4**, outer catch) — correct to exit 4 after verifying the named arms.
  4. verifyKind: `:495` "no case arm and no `verifyKind` seam on disk" + `:955` table row are FALSE (seam `compile-check.server.ts:~1566`; CLI calls it `:~938`; flag rides `emit` `:1149`); rewrite honestly; fix the stale `:770` pointers (`:33`/`:390`) to the live lines.
  5. Approve-seat section (`:1049+`): document Channel B (TTY re-entry) alongside Channel A (env token) — post-Track-1 both exist.
  6. `reject` 12-char minimum + `emit --verify-kind`/`--force`: document (README half only; USAGE string = L4-G11).
  Done-when: every edited claim byte-checked against the arm; `README-cli.test.mjs` pins updated asserting MORE (never weakened); `docs-module-parity` run clean-or-recorded.
- **L3-D5 · docs-module-parity** [S] — `DOCS` (`scripts/docs-module-parity.mjs:33-41`) += `"START-HERE.md"`; run; fix REAL findings in START-HERE (same lane) or record honestly; `--self-check` (`:96-104`): the `fixtures` block computes unconditionally today — include it only when `selfCheck` is passed (and make the `selfCheck` label honest). Done-when: with/without flag → outputs differ; missingCount for START-HERE = 0 or recorded with the exact rows.
- **L3-D6 · AGENT_GUIDE §4 honest reword** [S] — §4 ("How to feed results back") claims results come back only "manually"; the structured `ingest` seam exists (CLI `ingest` verb; `report-intake.ts` validates/applies an agent report). Additive: name it as a third channel + one example line; keep the manual/principles intact; cite `report-intake.ts`'s real validation/refusals in the lane log. Done-when: `grep -n "ingest" AGENT_GUIDE.md` shows the new line; no claim exceeds bytes.

### L4 · SCRIPTS/GUARDS HYGIENE (all S unless noted)

**Gate:** `bash -n scripts/gate.sh` · `node --check` each edited `.mjs` · `node --test scripts/gate-verdict.test.mjs scripts/migration-plan.test.mjs scripts/write-atomic.test.mjs scripts/browser-guard.test.mjs scripts/cli-exit-taxonomy.test.mjs` · `node --experimental-strip-types --test src/lib/runtime-log.server.test.ts` · keyless scratch smokes for `tree-run`/`doctor` (use the X3 scratch dir pattern; **never** point verbs at the repo root as their subject).

- **L4-G1 · gate.sh: zero-pass guard + double-mode tails** [S] — (a) verdict program: after each test leg's `run1 = legStats(log1)` (`gate.sh:150-186`), if `exitOf(id) === 0 && run1.pass === 0 && run1.skipped === 0` → `hardFails.push(\`${id} (exit 0 but zero '# pass' lines — no tests actually ran; read the gate log tail)\`)`. (b) stderr tail loop `:221` — tail `testsScripts2`/`testsLib2` too, only when their `.exit` keys exist (double mode). (c) `gate-verdict.test.mjs` (extracts the `<<'NODE'`…`NODE` heredoc — **keep those markers byte-stable**): add Case E (exit-0 + zero-pass leg → verdict `ok:false`, exit 1). Done-when: `node --test scripts/gate-verdict.test.mjs` green incl. new case; `bash -n` clean; no change to `EXIT_BY_CODE` or case A–D semantics.
- **L4-G2 · migration-plan de-dupe + anti-vacuity** [S] — (a) move the test's local `authSchemaCopies(root)` (`migration-plan.test.mjs:34-43`) into `scripts/migration-plan.mjs` as exported `authSchemaCopyState(root)`; test imports it; delete the local copy. (b) `:98 if (copied.length === 0) return;` → `t.diagnostic("no copy-ups exist in this workspace (sign-in off) — the fixture cases below carry the assertions"); return;`. Done-when: leg green; `grep -c "function authSchemaCopies" scripts/migration-plan.test.mjs` → 0; diagnostic visible with `--test-reporter=tap` verbose.
- **L4-G3 · write-atomic mkdir** [S] — `handOver` (`write-atomic.mjs:63-80`): move `mkdirSync(dirname(target), {recursive:true})` INSIDE the try (before `rename`); keep EXDEV message verbatim. Done-when: `write-atomic.test.mjs` pins: injected-rename-failure → throws + `target` absent; EXDEV message unchanged; leg green.
- **L4-G4 · browser-guard dead loopback entry** [S] — `LOOPBACK_HOSTNAMES` (`browser-guard.mjs:19`): drop bare `"::1"` (WHATWG `URL.hostname` yields `"[::1]"` — the bare form is unreachable); win32 fail-closed (`:46-58`) is ALREADY LANDED — do not touch. Pin in `browser-guard.test.mjs`: `new URL("http://[::1]:8080/").hostname` matches the set. Done-when: leg green.
- **L4-G5 · "am I main?" idiom** [S] — `brand-check.mjs:196`, `preview.mjs:332`, `write-atomic.mjs:81`: adopt the `scripts/with-app-env.mjs:97-105` resolve+lowercase compare (read it first). Done-when: each touched script runs its own smoke without behavior change; naive `pathToFileURL`-compare gone from those sites.
- **L4-G6 · readRtTail bounded read** [S] — `runtime-log.server.ts:133-165`: replace whole-file `readFileSync(file).subarray(start)` with a bounded fd read (`openSync`/`readSync(fd, buf, 0, size-start, start)`/`closeSync`), preserving newest-first `slice(-n).reverse()`, torn/junk skip, `[]` on missing dir. Extend `runtime-log.server.test.ts`: a >256 KB file → correct tail; keep the 4 existing tests green. Done-when: leg green; the function no longer reads the whole file (grep-visible).
- **L4-G7 · tree-run dirDirty note** [S] — `rapidtool-cli.mjs:1567-1571` catch: set `payload.dirDirtyNote = "ledger read failed — divergence report skipped: " + (e instanceof Error ? e.message : String(e)).slice(0,200);` (keep exit semantics). Done-when: keyless scratch: broken ledger + `--project` → envelope carries the note, exit unchanged; happy path unchanged.
- **L4-G8 · envelope code doc-guard (OPS-13)** [S] — in `ensureErrorCodes`' `safe()` (`rapidtool-cli.mjs:217-226`): when the dynamically imported module exposes `ERROR_CODE_DOC`, accept a code only if shape-valid AND (`code in doc`); else fall back to shape-only (module-absent case unchanged). Extend `scripts/cli-exit-taxonomy.test.mjs` with a STATIC leg: every `code: "RT_E_…"` literal in `rapidtool-cli.mjs` ∈ `ERROR_CODE_DOC` (follow the file's existing static-read style; A-66's regex widening is allowed — widening ONLY). Done-when: leg green; a synthetic unregistered passthrough yields an envelope without `code`.
- **L4-G9 · doctor spend surfacing** [S] — `headless.ts`: `DoctorStatus` factory block (`:3455-3481`) += `spend: DoctorSpend`; the try-block literal (`:3644-3653`) += `spend: claim.spend`; the pre-try floor (`:3619-3632`) += the honest null shape (mirror `doctorSpend(null)` from `doctor.ts:272-302`); `doctorStatus(opts?: { treeDir?: string; spend?: TokenSpend | TokenLedger | null })`; call `doctor.doctorFactory(process.env, opts?.spend ?? sessionTokenBudget().ledger)` at `:3637`. Done-when: keyless `doctor` smoke → `factory.spend` present (honest nulls / session ledger); `doctor.test.ts` + headless leg green. (K7#7 / OPS-8.)
- **L4-G10 · package.json test-reporter pin** [S] — `test` script: append `--test-reporter=tap` to BOTH legs (gate.sh parses `# pass` summaries — pin the format the gate consumes). Do NOT add `format:check` (no formatting baseline — recorded in §4). Done-when: both legs green foreground; `node --test --test-reporter=tap "scripts/**/*.test.mjs" | tail` shows the TAP summary lines legStats expects.
- **L4-G11 · USAGE emit line** [S] — the USAGE string's `emit` row (~`rapidtool-cli.mjs:3759-3762`): add `[--verify-kind] [--force]` (flags verified in the arm `:1094-1145`). Done-when: help output lists them; no test pins on the old string (grep first).
- **L4-G12 · parseArgs refusal remedy** [S] — verify the `:1785`-era refusal for a `--`-leading value names the `--key=value` remedy; if not, add one clause to the message (additive, in-file). No parseArgs behavior change. Done-when: message verified/updated; cli-exit-taxonomy leg green.
- **L4-G13 · envelope field-check sweep (X4 item 4, never run)** [S] — on the X3 scratch project (or a fresh one), run keyless `doctor`, `diagnose`, `fixtures --draft`; diff the envelopes against README-cli's documented fields + the schema (`schema_version/cmd/ok/exit_code`; diagnose `checkpoint/growth`); RECORD every mismatch in the lane log; fix in-file mismatches (this box) or hand doc-side ones to L3's log pointer. Done-when: the three runs' real outputs captured verbatim in `fixes/303_L4.md`, mismatches either fixed or recorded with file:line.

---

## §3 · BOUNDARY PLAN (run ONLY when all four lanes report done — nobody mid-edit)

1. **Freeze:** all lanes stopped; `git status` = only expected adds (lane logs `fixes/303_L*.md` (4), SPEC.md, maybe new test files `src/lib/scorecard.test.ts`).
2. **Static gates (unpiped, foreground):** `npm run typecheck` → **exit 0** · `npm run lint` → **0 errors / 0 warnings** (L2-P1 must kill the 4 packet warnings — if any warning remains, that lane is not done).
3. **Legs:** `node --test "scripts/**/*.test.mjs"` → **328 + N green** · `node --experimental-strip-types --test "src/lib/**/*.test.ts"` → **2251/2250/0 + N, 1 legit skip** (the `exec.test.ts` scratch-dir timing flake may fire under load — re-run standalone before calling it red).
4. **Build:** `npm run build` → exit 0. **Full gate:** `bash scripts/gate.sh` → exit 0 (six legs; expect the new zero-pass guard green).
5. **Boot smoke:** `npm run preview` + bounded curl → HTTP 200; kill via `MSYS2_ARG_CONV_EXCL='*' taskkill /F /T /PID <pid>`; re-verify the port (X3 pitfall).
6. **Commit** on frozen green (message: what the wave landed), tree clean.
7. **Traps (all burned this campaign):** never pipe a gate/leg (`| tail` masks exit codes) · legs foreground (backgrounded = phantom `stdin is not a tty`) · keep terminal one-liners short (parser blocks long compounds) · quote the space in the path · `read_file` binary-detects some logs → `grep -a` · `node "C:/…"` form when invoking from outside the repo · secrets never printed; never judge syntax from redacted bytes — `node --check` instead.

---

## §4 · WHAT REMAINS AFTER THIS SPEC

**OWNER-gated (not coder-lane material):**
- **The funded keyed run** — the campaign's last proof: `DEEPSEEK_API_KEY` in `.env` (funded) → `node --experimental-strip-types scripts/run-eval.mjs --keyed`; record the result honestly (red = a finding, not a failure); then the emitted-app suite frontier, W-46's acceptance lane, W-45's provider probe, W-47's E2E, W-7's keyed fresh-emit typecheck.
- **AGENTS.md doctrine patch** — consent text in `research/multiagent/262_agents_md_proposal.md`; includes OPS-5 (four-gate → six-leg) + OPS-6 (35 → 39 verbs) + F2-26/F2-27 language; blocked-consent until the owner rules.
- **R13-f04 isolation** (host has no isolator; the coded `sandbox:false` refusal is correct), **O-2/O-3** standing decisions, **W-32** write-atomic/grok descope pick, **W-44** mcp discovery scope, **W-49** executor swap (needs a proving probe).

**Wave-sized deferrals (verified still-open; reasons in one line):**
- **W43-ENGINE**: F2-14 P0 (store `approveHitl` mints `decidedBy:"human"` without `evaluatePolicy` — `store.ts:1698-1703`, `evaluatePolicy` 0 refs in store.ts → needs a policy-semantics read of `policy.ts` + engine parity pins) · F2-15/W-43 (`applyPolicyOverlay` zero prod consumers — overlay consult design) · W-33 ladder consolidation (4 copies; parity pins) · F3-19 positional indexing · A1-45 sync/async advanceOnce divergence + pins · W-25(g)(h) silent catches · W-20 served-id stamp + K6 pins · W-48 wild planner · F2-13/F2-30 packet-vs-live crew census. *Reason: engine.ts/store.ts are the two biggest files; every change needs fresh reads + heavy parity pins — one dedicated lane.*
- **W43-CONSOLE**: P2 residuals (A-92 HitlDock key · A-93 forceMount pollers · A-94 UTC clock · A-95 revokeObjectURL timers · A-96 keydown/Radix · A-97 busy latch · heartbeat-scope verify) · W-38/F3-09 journey wire · W-52 HitlDock cards · K5-2 reject latch · W-50(a) preview pane · W-41 stream pane · R6-f06 guide one-liner · W-34 console test target · DEEPEN_ACTION_NAMES. *Reason: additive-UI discipline + needs a live console pass; keep console edits in ONE dedicated lane.*
- **W43-CODEGEN**: W-04 probe strictness + `p6-behavior` DoD row + capability tagging · W-06 chunk continuation + refused-vs-never-reached census · W-28 readmeBody annotations + emitted-UI min bar · W-07 prompt↔materializer drift pin · A-110(6) `modelRouteForServed` `id.includes("pro")`. *Reason: synthesis semantics need a full codegen read; W-06 is a behavior change.*
- **W43-CHAT/LLM**: W-41 `chat --stream` + incremental pane · W-42 cassette transport wrap + `--record/--replay` byte-pair · A-110(1)(2)(3)(4) llm cache/registry/task-model · K5-3/K5-4/K5-6 chat.server items · W-51 eval lessons census + kill criterion. *Reason: feature-sized; streaming/transport changes need their own cassette pins.*
- **RECORDS/OPS tail**: W-37 recorder pass (create `fixes/266_lane1..4_bugs.md`; fold §R3/§R6 into `thoroughanalysis.md`) · W-19 `gate.blocked` settlement (register+emit the rt-events row, or accept the hard-DoD-block artifact surface as the shape — rt-events is this box) · W-36 boundary sweep of the two root probes once K9/W-36 references drop · K3 naming sweep (`deplyNotes` deprecate-alias; clear `errors.test.ts` pins first) · A-116 rt-events settlement (34 never-emitted names + `ui.boundary_crash` twin + inert `wildStep` emitters) · `format:check`: NOT added (no formatting baseline; a check would red the repo — owner pick if wanted) · tsconfig scripts-scope typing: deferred by design (`tsconfig.scripts.json` documents 1030 staged errors) · `parseArgs` behavior: deliberate (refusal teaches `--key=value`; L4-G12).
- **Recorded findings, no action owed**: F4 #3 `meanAtLeast:1` unreachability on first keyless runs (pre-existing; a red is a finding) · `real-estate-crm` mis-kinded `cli-tool` (on-disk data condition; v2 graders designed to catch it) · `packetSpendSummary` export kept (no consumers) · `LONGTASK_*` constant-vs-behavior note (`rt-client.ts:463/:467` — 250 vs `RT_COALESCE_MS` 5000 vs promised 10 s).

---

> **Appendices A–C below** (raw inventory · byte-verifications · collision map) — ENG-HELP `fixes/302_eng_help.md`. Trust order for conflicts: this body > Appendix A raw rows (some are marked STALE in Appendix B); Appendix C's partition is superseded by §2.0 where they differ (this body keeps `headless.ts` in L4 and `store.test.ts` in L2).

---

## Appendix A — RAW OWED-ITEMS INVENTORY (helper · 302)

> **Snapshot:** HEAD `424f9e5` + working tree, 2026-09-28 (helper session). Every item below is a SOURCE's own owed/residual text, condensed to one line: IDs, paths, line refs, codes and quoted fragments are verbatim; prose is compressed. An item is *raw* — some may already be landed since its source was written (Appendix B spot-verifies; the engineer's coder cards are the ruling). Tag `[src: …]` = provenance pointer.
> **Sources mined:** §A.1 `fixes/301_x1_pipeline.md` + X1 summary `subagent-summary-0-20260928_224909_368803.txt` · §A.2 `fixes/301_x2_accept.md` + X2 summary `-1-…369800` · §A.3 `fixes/301_x3_build.md` + X3 summary `-2-…370797` · §A.4 `fixes/301_x4_hygiene.md` + X4 summary `-3-…371795` · §A.5 `fixes/296_q5_register.md` · §A.6 `fixes/296_q8_ops.md` · §A.7 `fixes/283_final_ledger.md` · §A.8 `wave_plans/W40/CONTINUE-PROMPT.md` §3 · §A.9 delegation-cache summaries (q2_a2-era `-1-20260927_043617_513416.txt` + adjacent P/Q/K-L batches).

### §A.1 — X1 lane: the F2/F3 pipeline tail (`fixes/301_x1_pipeline.md` + X1 summary)

- **A-1** · F2-04 budget boundary — remaining: `packetBudgetBoundary` + `budgetBlock` + always-present envelope key (mirror `spend:` precedent `packet.ts:177`) + `opts.budget?` on `compileAgentPacket` + additivity test; `stop_reason` fires only via `isBudgetExhausted` (spend actually crossed cap — never optimistic "ok"); cap omitted when unmetered (`RAPIDTOOL_TOKEN_CAP` unset). **Partial landed** (header note + widened token-ledger import); `node --check` owed. [src: 301_x1:14,17; X1s:5-10]
- **A-2** · F2-07 — KEEP `exportProfiles` (`packet.ts:931`; consumers = `packet.test.ts` ONLY; pinned `:675-676 deepEqual(Object.keys(exportProfiles), PROFILE_IDS)`) + write `TODO(F2-07)`; no test update. [src: 301_x1:15; X1s:12-13]
- **A-3** · F2-09 — KEEP `crewToReport` (`crew.server.ts:1406`; zero code consumers; cited only by design doc `03_crew_design.md:267-606`, unchecked box `:606`) + write `TODO(F2-09)` (NOT removal). [src: 301_x1:16; X1s:14]
- **A-4** · F2-10 crew-budget seam — wrap the run's completer ONCE with `runBudgetedCall` (gate before wire + record every usage; refusal = coded `RT_E_BUDGET_EXHAUSTED`, never an escaping throw); `budget = sessionTokenBudget()` default + `opts.budget` override; **`crew.ts` untouched** (server process singleton owns the ledger). Sites: `completeCrewTurn(deps.complete…)` `crew.server.ts:1042` · plan-act `deps.complete` `:1238` · `createPlanning` `:1139` · `crewRegistryCompleter` `:885`. Needs **additive `code?: ErrorCode`** on `PlanStepsResult` (`planning.ts:79`) else a budget stop mislabels `RT_E_INTERNAL` at `crew.server.ts:~1150`. [src: 301_x1:17; X1s:16-19]
- **A-5** · F3-10 residual — product half VERIFIED LANDED (`store.ts:1407-1413` + `:1425-1429` + 8 twins wrapped); **no dedicated regression pin** (grep `F3-10|keepLiveWildRun` in tests → 0). Pin owed. [src: 301_x1:18; X1s:21-23]
- **A-6** · residual found — `packetSpendSummary` (`packet.ts:347`) exported with ZERO consumers outside packet.ts; disposition owed. [src: X1s:10]
- **A-7** · X1 process — run `node --experimental-strip-types --check src/lib/packet.ts` first; append per-item ledger rows to `fixes/301_x1_pipeline.md`. [src: X1s:30-32]

### §A.2 — X2 lane: acceptance-truth tail (`fixes/301_x2_accept.md` + X2 summary)

- **A-8** · Q4-b tail — coded `acceptanceFailReason` (failed row's own coded detail: exit code / missing pin / spawn error, bounded 120 chars). **Landed in `424f9e5`**; `node --check scripts/run-eval.mjs` + pins owed. [src: 301_x2:11; X2s:5-10]
- **A-9** · Q4-c — results.json `entries` rows carry NO `endClass` (entryRow literal `run-eval.mjs:2488-2565`; crash-fallback row neither). Add both. [src: 301_x2:12; X2s:11]
- **A-10** · L3 render (reader side; renders free via CLI verbatim response) — `src/lib/scorecard.ts`: `verification` on `EvalAcceptance` + `readAcceptance` (`:167-184` drops it today); `EvalEntry` + behaviorOk/kindOk/endClass; `EvalHistoryRow` endClass; acceptance/class census in `derived` + a notes line. **NOT in `buildSummary`** (pinned to exactly 7 keys, `run-eval.test.mjs:692-696`). [src: 301_x2:13-14; X2s:12-13,18]
- **A-11** · pins owed — `historyEndClass` + a real `evaluateEntryRunsRow` case + the coded reason; then run `run-eval.test.mjs` + `gate-verdict.test.mjs` FOREGROUND + keyless scratch-`EVAL_OUT_DIR` smoke. (`git show 4af061a --stat` carries no test-file pin — U1 landed product code only.) [src: X2s:14,18,20]
- **A-12** · append the t0/ledger rows to `fixes/301_x2_accept.md`. [src: X2s:20]
- **A-13** · decision note owed — "CLI `eval`/**`gate`**" disagreement: `gate` renders `ProjectSummary` (different vocabulary; a gate render belongs to `gate.sh`, no eval arm) — log it, do not invent a render. [src: X2s:15]
- **A-14** · pre-existing red (NOT X2's): F4 #3 `meanAtLeast:1` unreachability on a first keyless run — very likely why "35/35" would fail today. [src: X2s:21]

### §A.3 — X3 lane: build/boot/CLI e2e (`fixes/301_x3_build.md` + X3 summary) — **NO owed product items**

- **A-15** · RECORD ONLY: all three legs GREEN (build exit 0 · preview `HTTP/1.1 200` real shell · keyless create/run/emit 0/0/0, 16 files). Pitfalls for future lanes: `taskkill //F` rejected on this host → `MSYS2_ARG_CONV_EXCL='*' taskkill /F /T /PID <pid>` then re-verify port; killed npm wrappers don't cascade to vite children. Scratch artifacts remain at `…\Temp\x3_cli_smoke` (`build.json`, `emitted/`, `.rapidtool/`). [src: 301_x3:62-64,186-189; X3s:20]

### §A.4 — X4 lane: hygiene + wiring (`fixes/301_x4_hygiene.md` + X4 summary)

- **A-16** · README drift (one-cell fix, NOT 12 new rows): §10.1 `| root | 44 |` → **42** (live count, post-move); `total` 1,715 → **1,749**; `fixes` 429 → **445**. (§10.2 "all 42 tracked — named" is correct post-move.) [src: X4s:22-23]
- **A-17** · Q6 leftovers — README §10.2 rows for root files that REMAIN at root: `probe-k9-kinds.mjs`, `probe_n2_f316.mjs` (both under W-36 defer). [src: 301_x4:5; X4s:13]
- **A-18** · `project.acceptance` — do NOT strike: field EXISTS (`types.ts:472`), written by `runAcceptance` (`headless.ts:140`), sole non-test caller = SIGTERM abort path (`rapidtool-cli.mjs:564`); packet.ts = 0 hits ⇒ land additively `acceptance: project.acceptance ?? null` in `systemJson` (edit is in X1's live file). [src: X4s:26; 296_q6]
- **A-19** · `src/lib/packet.ts` carries 4 unused-import lint warnings from X1's landed edit (`budgetCap`, `isBudgetExhausted`, `sessionTokenBudget`, type `TokenBudget`) — wired only when F2-04 completes; lint → 0. [src: X4s:24]
- **A-20** · X4 item 4 NEVER RUN — doctor/diagnose/fixtures `--draft` envelope field-check (record anything off, except X3's territory). [src: 301_x4:6; X4s:30]
- **A-21** · `fixes/301_x4_hygiene.md` per-item ledger + final disposition table NOT written. [src: X4s:29-31]
- **A-22** · record — `real-estate-crm` keyless tree mis-kinded `cli-tool` (pre-existing on-disk data condition; P3's v2 graders are designed to catch it; not an edit regression). [src: X4s:18]

### §A.5 — Q5 register: the 54-row closure table (`fixes/296_q5_register.md`) — all non-LANDED rows, as-stated @ `ac6b151`

- **A-23** W-04 PARTIAL→DEFER — probe swallows non-ReferenceError throws ("any other throw is the real function behaving"); no `p6-behavior` DoD row; no capability tagging; `p6-brief-fit` split absent. TODO: assert call-does-not-throw + capability-tagged rows + `p6-behavior` row. [301_x1-era; src: 296_q5:35]
- **A-24** W-06 PARTIAL→DEFER — later chunks still abandoned on refusal (`return partialTreeRefuse` early-returns `codegen.server.ts:3385/:3410`); no "not-yet-attempted" capability state / refused-vs-never-reached census. TODO: continue later chunks + per-chunk refusal records + census. [src: 296_q5:37]
- **A-25** W-07 PARTIAL — §R3 doc-drift pin (prompt↔emitted contract) + keyed fresh-emit `npm run typecheck` evidence = OWNER boundary. [src: 296_q5:38]
- **A-26** W-13 PARTIAL→q6/p4 — guide has 0 "keyed" hits; README-cli knowledge examples; counts. [src: 296_q5:44]
- **A-27** W-14 →p3 — grader v2 + kind-correct bars + behavioral supply (P3 landing). [src: 296_q5:45]
- **A-28** W-15 →p3 — 4 missing-kind fixtures (game/cli/library/service). [src: 296_q5:46]
- **A-29** W-19 PARTIAL→p4 — register+emit the exact `gate.blocked` rt-events row, OR record the hard-DoD-block artifact surface as the accepted shape. [src: 296_q5:65]
- **A-30** W-20 PARTIAL→q7 — thread served id into the live stamp (`engine.ts:3021-3028`) + fake-seam pin; `llm-tasks.ts:127/:157/:188` still request `deepseek-v4-pro`. [src: 296_q5:66]
- **A-31** W-21 residue — crew seam (F2-10) → p1. [src: 296_q5:67]
- **A-32** W-24 PARTIAL→q6 — ONE shared `scorecardUsable` predicate + import≡hydrate parity pins (grep = 0). [src: 296_q5:51]
- **A-33** W-25 residue — (d) `POLICY_REASON_SEPARATOR` absent (`dod.ts:114` inline " — ") → DEFER (const + pin across writer/checker); (e) packet loose `lastTest.ok` "pass" (`packet.ts:652`) + no `str()/rows()` helpers → q1; (g)(h) silent catches `engine.ts:2964` + `runP6Real` → q1; (i) store live-degrade rows + R2-f07 pins → p1. [src: 296_q5:69]
- **A-34** W-27 open →q8/q6 — (b) eval "no writes" not narrowed (`:201`); (c) `balance-exhausted` resolver (grep 0); (d) `measurement:false` envelope arm verify (`:2540`); (f) `## Fixtures`/`## Eval` sections; (g) `--draft` predicate recompute; (h) valueless `--out` guards. [src: 296_q5:71]
- **A-35** W-28 PARTIAL→DEFER — (a) host/bridge/unmaterialised row annotation; (b) emitted-UI min bar. [src: 296_q5:72]
- **A-36** W-29(g)→p3 — fixtures README fake row STILL MINTS (`fixtures.ts:186-206` maps !ok fixtures to rows; loader `fixtures.server.ts:64-71` doesn't skip). [src: 296_q5:73]
- **A-37** W-33 DEFER — `decideTransition`/`stopReasonFor`/`runIterationCeiling` absent (grep 0); ladder still 4 copies; store.recordGate twin unchanged. One lane owes the consolidation + parity pins. [src: 296_q5:75]
- **A-38** W-34 PARTIAL→DEFER — async-tap regression pin (grep `Promise.reject run-eval.test.mjs` = 0); H2 truncated-marker pins (grep `unfinished src/lib/*.test.ts` = 0); console test target. [src: 296_q5:87]
- **A-39** W-36 DEFER (superseded) — root still carries `probe_n2_f316.mjs` + `probe_h1_libcrash.ts` (now probes-of-record; N1 uses them). Boundary-time sweep once unreferenced; keep h3 vehicles. [src: 296_q5:89]
- **A-40** W-37 PARTIAL→DEFER — `fixes/266_lane1..4_bugs.md` never created; §R3/§R6 never folded (`thoroughanalysis.md:1116` caveat intact). Recorder pass owed. [src: 296_q5:90]
- **A-41** W-38 DEFER — `store.runP6Journey` still ZERO console callers (`store.ts:138/:1031` only; `grep Journey console.tsx` = 0). Wire "Run P6 journey" on the P6 card/RunScreen (honest keyless refusal verbatim; budget label). [src: 296_q5:52]
- **A-42** W-39 residues — (b) caps apply at push only (`rt-ring.ts:115/:137-141`); `rtHydrate` builds rows without trimming to cap; (c) import-boundary headers + guard test absent (`knowledge/write-set/ast-mine`; grep 0). [src: 296_q5:76]
- **A-43** W-41 PARTIAL→DEFER — `chat --stream` (CLI grep 0) + incremental console pane. [src: 296_q5:54]
- **A-44** W-42 PARTIAL→DEFER — ZERO transport wrap + no run-eval `--record/--replay` (grep 0). TODO: wrap `callModel` transport; record→replay byte-identity pair. [src: 296_q5:55]
- **A-45** W-43 DEFER — `wildPolicy`/`applyPolicyOverlay` consumers/`paused_policy` = 0 (grep). TODO: `Project.wildPolicy` + ONE narrow-only consult in `wildApproveGate` + `wild.paused_policy` row. [src: 296_q5:56]
- **A-46** W-44 DEFER (OWNER execution) — `mcp.client.server.ts` discovery-first + `mcp --discover` + coded refusals; say "discovery", never "support". [src: 296_q5:77]
- **A-47** W-45 PARTIAL→OWNER — live verification: funded probe → verified descriptor; `RAPIDTOOL_PROVIDER=xai` + key evidence. [src: 296_q5:78]
- **A-48** W-46 DEFER (OWNER + keyed) — one acceptance lane after the funded run: two commands on the real artifact + hand-over kit + board rows quoting outputs. [src: 296_q5:79]
- **A-49** W-47 PARTIAL→OWNER — `wild --until` allow-list routing waits on W-43; the funded non-stock-gate E2E (run#4). [src: 296_q5:29]
- **A-50** W-48 PARTIAL-SHELL→DEFER — real planning pass + classifier review + pause-unless-autoPlan + the "plan before phase-1 mutation" pin. [src: 296_q5:57]
- **A-51** W-49 DEFER (host + OWNER) — no isolator on this host; executor swap behind `node-runner.server.ts`; claim flips only when a probe proves it. [src: 296_q5:58]
- **A-52** W-50 PARTIAL→DEFER — (a) console preview pane (only design-token preview `:5234/:5245`); (b) isolation-gated E2E leg. [src: 296_q5:59]
- **A-53** W-51 DEFER — per-slug lessons-injected/recurred + kill criterion in the eval output (`run-eval.mjs` lesson mentions = lesson #5 text only). [src: 296_q5:91]
- **A-54** W-52 PARTIAL→DEFER — HitlDock artifact cards per phase + diff vs prior + evidence tree (probe→hash→output). [src: 296_q5:92]
- **A-55** W-32 DEFER (owner pick) — `scripts/write-atomic.mjs` + `.grok/skills/**` refs; descope-vs-realpath-fix = OWNER decision in 94§B1/AGENTS.md. [src: 296_q5:86]

### §A.6 — Q8: OPS tail + telemetry + guards (`fixes/296_q8_ops.md`) — as-stated @ `ac6b151`

- **A-56** OPS-8 — `doctor` computes+discards `spend` (`headless.ts:3644-3653` drops `claim.spend`; `DoctorStatus` `:3455-3479` has no `spend`; `doctorSpend` exists). Add `spend: DoctorSpend` + thread optional `Project.tokenUsage`. [src: 296_q8:19,30]
- **A-57** OPS-11 — `readRtTail` claims a 256 KB window, reads the WHOLE file (`runtime-log.server.ts:144` whole-file `readFileSync`). Bounded read owed. [src: 296_q8:22,31]
- **A-58** OPS-12 — `tree-run --project` swallows `importTreeDir` errors (`rapidtool-cli.mjs:1555` `/* advisory only */`); add `payload.dirDirtyNote`. [src: 296_q8:23,32]
- **A-59** OPS-13 — envelope codes can escape `ERROR_CODE_DOC` (shape-only `safe()`); optional envelope-side guard leg (currently safe; no live break). [src: 296_q8:22-23]
- **A-60** OPS-5/6/7 (owner-gated: AGENTS.md write blocked-consent) — AGENTS.md:53 "four-gate" vs six-leg gate.sh; AGENTS.md:50 "35 verbs" → real 39; START-HERE.md:26 "191 files"/:28 "37 verbs"/:29 "(40)". [src: 296_q8:16-18,33]
- **A-61** OPS-15/16 — standing-red list stale (E-25 pins re-pointed); README-cli wild envelope dual-channel (`ok:true`+`error`) doc row. [src: 296_q8:26-27]
- **A-62** OPS-17 — README-cli claims missing module → exit 1 (bytes: exit 4). [src: 296_q8:28]
- **A-63** OPS-18 — README-cli "no `verifyKind` seam" FALSE; `verifyKindDir` at `compile-check.server.ts:1566`; `README-cli.md:495` stale. [src: 296_q8:29,12]
- **A-64** OPS-19/20 — README-cli approve-seat docs = Channel A only; `reject` 12-char min undocumented; USAGE emit line. [src: 296_q8:30-31]
- **A-65** OPS-21 — `docs-module-parity.mjs:33` `DOCS` omits `START-HERE.md`. [src: 296_q8:31,12]
- **A-66** guard extension — widen `cli-exit-taxonomy.test.mjs` leg-1 regex to `errCode\(\s*[A-Za-z_$][\w$.]*\s*,\s*"CODE"\)` (widening ONLY; `:993` `errCode(saveErr, …)` is invisible today; do NOT change `EXIT_BY_CODE`). Leg-1 dry-run: 28 errCode sites, 0 offenders. [src: 296_q8:20-21,34]
- **A-67** Q8 process — finish `fixes/296_q8_ops.md` ledger with landed evidence per item; delete throwaway probes `~/q8dry*.mjs`; an OPS-1 arity leg needs a proper matcher (crude one = 9 false positives). [src: 296_q8:26,34-35]

### §A.7 — 283 final ledger: OWED + OWNER-GATED (`fixes/283_final_ledger.md`)

- **A-68** · the funded keyed run — the campaign's last unbought proof (`npm run eval -- --keyed`; wallet topped up 2026-09-27). [283:12]
- **A-69** · K7's 12 tiny fixes NOT landed (byte-located): packet `decided_via` (`:142-149`) · P6-label de-hardcode (`:642` — branch on `lastTest.label` + evidenceHash) · acceptance label · io de-dupe (`:511`) · rt-client nulls (`:693`) · growth.counts producer (console `:4426-4429`) · doctor `spend` (`headless :3455-3479/:3644-3653`) · CLI `:3417` undefined→null · diagnose checkpoint surface · AGENT_GUIDE §4 · heartbeat scope `wild-driver`→`sys` (console `:1183-1189`) · README minors. [283:13; W40§3-B]
- **A-70** · the throws pass (K15/M1) — `token-ledger.ts:114/464/480` null-guard (mirror `:328`) · `ast-mine.ts:572` shape guard · `algorithms.ts:705` coercion · `verify.ts:121/:158` typeof guards · `write-set` ×2 verify-by-design · `vault.backlinksFor` remaining · `minutesForPhase` assertion. Then only those legs + re-run H1 probe (73 cases / 7 throws). [283:14; W40§3-C]
- **A-71** · the pipeline pass (K13/M2) — F3-10 · OPS-4 · OPS-9/10 · F3-16 · F2-03/04/07/09 · **F2-10 (crew spend escapes the ledger)**. [283:15; W40§3-D]
- **A-72** · stragglers — K5 chat items · K12's registry settlement · L2's UI 7-step (`fixes/292_l2_uiux.md`) · L3's eval items · K11 docs (AGENTS.md blocked-consent) · K3 naming sweep (`deplyNotes` needs a deprecate-alias; clear `errors.test.ts` pins first) · README/counts pass. [283:16; W40§3-E]
- **A-73** · the node-runner pin for W-26 (2MB writer → `ok:false` + bomb message). [283:17]
- **A-74** · OWNER-gated: O-1 funding → O-4 keyed run · AGENTS.md doctrine patch (consent text in `research/multiagent/262_agents_md_proposal.md`) · R13-f04 isolation (host has no isolator — coded refusal stands) · O-2/O-3 standing decisions. [283:20]

### §A.8 — W40 CONTINUE-PROMPT §3: THE REMAINING WORK (`wave_plans/W40/CONTINUE-PROMPT.md`)

- **A-75** §3-A · run the legs for the fresh landings (cassette/knowledge/git.server → their suites; deepseek.server.test; node-runner.server.test; migration-plan; store; write-set); fix any true red at the cause. Then COMMIT. [W40:18]
- **A-76** §3-B · K7's 12 tiny fixes — see A-69 (additive only; `node --check` each file). [W40:19]
- **A-77** §3-C · the throws pass — see A-70. [W40:20]
- **A-78** §3-D · the pipeline pass — see A-71 + F2-03 (`compiledAtFor` `packet.ts:210-232` include notes/artifacts — LANDED since, per P1 `fixes/295_p1_f2tail.md`; verify) · F2-04 · F2-07/09 · F2-10. [W40:21]
- **A-79** §3-E · the stragglers — see A-72; do NOT weaken `chat.test.ts`'s caps. [W40:22]
- **A-80** §3-F · THE FUNDED KEYED RUN (the proof): `DEEPSEEK_API_KEY` in `.env` (funded); `node --experimental-strip-types scripts/run-eval.mjs --keyed` → tree-run should green → P6 mint fires → M2/M3/M4 measurable; record honestly (a red is a finding); the emitted-app's suite reds become the next frontier. [W40:23]
- **A-81** §3-G · OWNER-ONLY — AGENTS.md doctrine patch · R13-f04 isolation · O-2/O-3 decisions. [W40:24]

### §A.9 — subagent summaries (delegation cache): residuals + card lists

#### §A.9.1 — q2_a2-era summary (`subagent-summary-1-20260927_043617_513416.txt`; log `fixes/296_q2_a2.md` NEVER written) — 28 §A2 rows

- **A-82** (1) AGENTS.md:18 `0.0.0.0:8080` vs `vite.config.ts:160` loopback — NOT landed; owner-gated (AGENTS.md blocked-consent).
- **A-83** (2) AGENTS.md:50 "35 verbs" → real 39 — NOT landed; same owner gate.
- **A-84** (4) `respond()` stdout write + `process.exit` truncation (`rapidtool-cli.mjs:176`) — NOT landed; for P4/N5.
- **A-85** (5) run-eval `main().catch()` writes crash stub + exit 0 (`run-eval.mjs:3100-3110`) — NOT landed; for P3.
- **A-86** (6) run-eval non-atomic results/history + unbounded history (`:2637/:2671`; zero `MAX_HISTORY`) — NOT landed; for P3.
- **A-87** (7) `migration-plan.test.mjs:29-43` re-implements `authSchemaCopy`; `migration-plan.mjs:111` `authCopyUpGaps` unused by it — MINE (q2's).
- **A-88** (8) migration-plan byte-identity test vacuous (`:98 if (copied.length === 0) return`) — MINE.
- **A-89** (9) `gate.sh` green with zero `# pass` lines (`gate.sh:173`) — MINE (scripts guard).
- **A-90** (10) `gate.sh` stderr tail misses `testsScripts2`/`testsLib2` (`:221` 6 ids) — MINE.
- **A-91** (12) `migrate.mjs:102-106` simple-query multi-statement in BEGIN/COMMIT — for K2/P4.
- **A-92** (13) HitlDock `forceOverride` not keyed by phase (`console.tsx:3851` state; `<HitlDock>` `:3213` no `key`) — for P2.
- **A-93** (15) 10 `forceMount` tabs keep pollers alive (`:3277/:3340/:3379/:3400/:3427/:3464`) — for P2.
- **A-94** (16) timeline pane UTC vs console local clock (`runtime-timeline-pane.tsx:39` vs `console.tsx:759-762`) — for P2.
- **A-95** (17) 5× `revokeObjectURL` fixed 1000 ms timeout (`:2417/:2430/:4646/:5189/:5464`) — for P2.
- **A-96** (18) keydown guard blind to Radix popovers (`:2013`) — for P2.
- **A-97** (19) HomeScreen `busy` latch vacuous + magic 80 ms seed (`:1703-1725`) — for P2.
- **A-98** (20) `parseArgs` treats `--`-leading value as boolean (`rapidtool-cli.mjs:74-97`; refusal `:1785`) — for P4/N5.
- **A-99** (21) three "am I main?" predicates — `run-eval.mjs:3091` (P3) + naive `pathToFileURL` at `brand-check.mjs:196`, `preview.mjs:332`, `write-atomic.mjs:81` — MINE (three guards).
- **A-100** (23) `write-atomic.mjs:68-71` `mkdirSync` before rename try (test passes only via earlier ENOENT) — MINE.
- **A-101** (24) `browser-guard.mjs:49-58` win32 POSIX-literal blanks the check + dead `"::1"` (`:19`) — MINE.
- **A-102** (25) `docs-module-parity.mjs --self-check` decorative (`:96` label only; `:98-101` fixtures unconditional) — MINE.
- **A-103** (26) package.json: no `format:check`, no `--test-reporter` pin, `sideEffects:false` (`:5/:23/:26`) — MINE.
- **A-104** (27) tsconfig `include:["src","server"]` — scripts untypechecked (`tsconfig.json:32-35`); defer-by-design (`tsconfig.scripts.json` documents 1030 staged errors) — MINE.
- **A-105** (28) `scripts/README-cli.md:1042-1046` "## Tests" stale (2 suites only) — MINE.
- **A-106** · q2 summary issues: tool-call ceiling meant the log + ~9 smallest patches never ran; long compound one-liners parser-blocked 3× — retry with ONE pipe max. [q2s:41-43]

#### §A.9.2 — adjacent P/Q/K/L batch residuals (cited by the lanes above)

- **A-107** Q1 residual — `engine.ts:2215` `sealedEdge` still bare `12` (patch dropped); `node --check` on `engine.ts`/`store.ts`/`server-spec.ts` owed; store leg foreground; CLI-arm catch sites should adopt `clientSafeServerSpecifier`; **A1-45 real divergence**: sync `advanceOnce` `:486-488` has the P10 hard-DoD guard, async `:689` lacks it; `store.test.ts` parity pins for the async branch owed; append ledger to `fixes/296_q1_a1tail.md`. [043617-0]
- **A-108** Q4 residual F4 cards — (#12) installed tap observing 0 calls records `usage:{0,0,0}` + `estimatedCostUsd:0` (`run-eval.mjs:971-979/:1904-1906`); (#13) crash handler overwrites results.json + exit 0 (`:3100-3111`); (#15) `priorFor` returns last trial row, not case mean (`:504-510`, unpinned — pin at `run-eval.test.mjs:986-1022`); (#11) `treeTextFiles`/`graderLeakScan` bounds w/o "not scanned" discriminator (`:1085-1125`); (#14) `deliveryKindOf` maps library/service → `undefined` (`:1962-1974`; needs honest enabler). [043617-3]
- **A-109** Q6 residual — `io.ts` patch `node --check` + `exportPacketText` de-dupe pin owed; additive `acceptance` key in packet.ts (P1 coord → X1's box); AGENT_GUIDE §4 reword; README §10.1/§10.2/§10.6 count corrections; `ui.boundary_crash` registry entry. [043617-5]
- **A-110** Q7 not-landed — (1) deepseek tap dispatch `:684-694` cache fields (currently TYPE-ONLY) + fold into `llmEvidenceFromCallRecords` (Q4's run-eval); (2) openai-compatible `:365` body type + `:542-556` cache parse + swap `:499` regex for the shared helper (+ `LlmUsage` widening); (3) `llm.ts:18` derive `LlmModel` from `DEEPSEEK_MODELS`; (4) llm-tasks conditional `model` + 4 pins (`llm-tasks.test.ts:85/:103/:126`); (5) `engine.ts:2991/3020-3023` served-route stamp (Q1 owns file); (6) `codegen.server.ts:2760` `modelRouteForServed` `id.includes("pro")`; (7) cache-discipline reorder needs ≥2 edits + no byte-exact snapshot test (`codegen.server.test.ts:2118/:951/:963/:974/:417` structural only) — K6 "Variant A" NOT free. [043617-6]
- **A-111** P1 residual — append per-item evidence rows to `fixes/295_p1_f2tail.md` (t0+F2-03 only). [043438-0]
- **A-112** P2 residual — verification NOT run (scoped eslint + parse check owed); log not appended; additive default-deny pin test (`label` cast "drifted" → caveat present) owed; `git status` re-check. [043438-1]
- **A-113** P3 residual — `run-eval.test.mjs` pins for grader v2 + endClass + marker-finalize-after-persist + corpus (≥11 entries); `scorecard.ts` reader (+ colocated `scorecard.test.ts` — none exists); strike dead fixture-decision exports (`FixtureVerdict`/`FixtureDecisionEntry`/`fixtureDecisionEntry` — zero consumers; CANNOT append to `project.decisions` per `HitlDecision` shape; edit console.tsx W24 comment to match); run `run-eval.test.mjs` foreground (baseline 35/35). [043438-2]
- **A-114** P4 residual — `docs-FOLDER-MAP.md` + `START-HERE.md` patch deltas computed but NOT landed (201→210 · 191→200 · 40→45 · 1→2 · ~342→419 · 93→105 · 28→35 dirs · 37→39 verbs · W25 absent); `scripts/README-cli.md` §Tests stale (M5); `respond()` truncation (K11 M8) still open; M1/M2 AGENTS.md skipped (blocked-consent). [043438-3]
- **A-115** K12 residual — in-box unlanded: F2-03b (store setNotes/ingestReport never `stampPacket`), F2-04, F2-07, F2-09, F2-10, F2-13/30 (packet crew ≠ live crew), F2-24/25 (AGENT_GUIDE wording); out-of-box: **F2-14 P0 console ungoverned** (`store.ts:1644-1649` mints `decidedBy:"human"` w/o `evaluatePolicy`), F2-15, F2-17/18/19, F2-27 (four-surface "no machine path can mint decidedBy:human" lie → K11). [013043-2]
- **A-116** K12 events settlement — 34 never-emitted names owe `TODO(N6-W3)`/register-or-emit settlement (list incl. `boot.start/ready`, `sys.memory`, `boundary.crash`, `ui.action_error`, `store.action_error`, `engine.phase_fallback/error`, all 6 `wild.driver_*`, all 6 `llm.*`, `chat.send_error`, `verify.*`, `crew.turn_*`, `runner.*`, `cli.error`, `hydrate.*`, `persist.*`, `watcher.*`, `harvest.error`, `search.unavailable`, `diagnose.ran`); 2 structural defects: `wildStep` emitters INERT in production (no production `onEvent`; `overdueRowSeed`/`timeoutRowSeed`/`boundedStepWatch` zero call sites); `error-component.tsx:60` emits unregistered `ui.boundary_crash` (twin `boundary.crash`) + counterfeit names `runner.real`/`llm.degrade`/`llm.guidance` ride the non-`reportRt` channel. Pin: `rt-events.test.ts:39-99` pins all 55 names sorted — additive TODO comments only. [013043-2]
- **A-117** L3 residual — (a) marker only after persistence AND print; surface `previousUnfinished`; (b) end-class `funded|unfunded|unmeasured` → history.json rows + `scorecard.ts`/`eval` render; (c) acceptance `verification` label render AFTER K9 lands population; (d) wire or honestly strike `FixtureDecisionEntry`/`FixtureVerdict`; keyed proof (funded vs unfunded) → say so, do not run. [013947-2]
- **A-118** K5 residual — all findings now consumed by P2 except: `AGENT_GUIDE §4:69` reword (→ n5 handoff in P2's log); `fixes/290_k5_chat.md` was never created (next agent opens it first). [013856-4]
- **A-119** T2 — CLOSED: all six reds landed in fixes/300 (stale pins re-pointed asserting MORE + engine `fitLessonEvidence` fix; every file re-run green; `npm test` 2250/0/1-skip on retry). **STRKE candidate for the spec.** [223236-1; fixes/300]
- **A-120** N2 residual (superseded/dup) — F2-03/04/07/10 as quoted by X1 (ledger rows never appended to `294_n2_pipeline.md`); F3-16 landed (spec-paths folded into the digest). [021012-1]
- **A-121** N6 residual (superseded) — *one number wrong*: its log says 56 names; the truth is **55** (P4 later corrected + landed the TODO block). Dead-constant TODOs (`RtScope`, `WILD_STEP_AUTOPAUSE_MS`, `LONGTASK_*`, `newSessionId`, `overdueRowSeed`/`timeoutRowSeed`) landed by P4; `LONGTASK_*` constant vs behavior disagreement (`rt-client.ts:463` hardcodes 250; `:467` uses `RT_COALESCE_MS` 5000 vs promised 10 s) recorded. [021012-5; 043438-3]

#### §A.9.3 — the F2 card list (W35 §F2, `subagent-summary-1-20260926_195114_767464.txt`) — 31 byte-checked findings

- **A-122** F2-01 packet machine block lacks `decided_via` (`packet.ts:142-149`). · **A-123** F2-02 loose truthiness `lastTest.ok ? "pass":"FAIL"` (`:622`). · **A-124** F2-03 stale-packet three ways (a `compiledAtFor` `:210-232`; b `setNotes:1708`/`ingestReport:1447-1490` never re-stamp; c no revision/input-hash). · **A-125** F2-04 no budget boundary. · **A-126** F2-06 no verification label (tests_run[] unverifiable). · **A-127** F2-07 dead handoff surface. · **A-128** F2-09 two shapes of one conversion (console `:2320` hand-builds, `files:[]`, never tests_run). · **A-129** F2-10 crew spend escapes ledger. · **A-130** F2-12 subagent landed-orphaned (de-scope TODO recorded — correct shape). · **A-131** F2-13/F2-30 packet crew (4 seats 900–4800) ≠ live crew (6 roles 2048–8192); packet never states superset/map. · **A-132** F2-14 P0 console ungoverned (`store.ts:1580` approveHitl direct). · **A-133** F2-15 F4 governs nothing (`applyPolicyOverlay` zero consumers; `console.tsx:327` cast on untyped field; no consult `engine.ts:3680`). · **A-134** F2-17 cited guard not on disk (`rapidtool-cli.mjs:~600`). · **A-135** F2-18 two-channel seat CLI-only (`headless.ts:942` env self-verify). · **A-136** F2-19 DoD teeth on note substring (`dod.ts:70/:136-142`). · **A-137** F2-20 phase handoff no provenance (`Gate P4: PASS` bare). · **A-138** F2-21 agent blocks masquerade as human rejections (`report-intake.ts:413-419`) + store `gateUnmet` read-snapshot vs applied `live` (`:1461/:1469`). · **A-139** F2-22 closed loop broken (AGENT_GUIDE:72-73 vs no re-stamp). · **A-140** F2-23 three packet byte strings + doubled `## Operator notes` (`io.ts:495-499` vs `packet.ts:572-579`). · **A-141** F2-24 `AGENT_GUIDE:69` stale channel claim. · **A-142** F2-25 `AGENT_GUIDE:4-7/:52-54` "does not build software itself" vs P6 reality. · **A-143** F2-26 AGENTS.md:50 "35 verbs"/START-HERE drift. · **A-144** F2-27 four-surface honesty lie (README:107, START-HERE:91, AGENTS onboarding). · **A-145** F2-29 `263_state_of_play.md` orphaned (keep-or-archive). [cards: F2 s/n]
- (Card-list note: F2-05/08/11/16/28/31 not owed/not in the summary's owed set; F2-31 = model_route stamps wrong model — see A-30.)

#### §A.9.4 — the F3 card list (W35 §F3, `subagent-summary-2-20260926_195114_772471.txt`) — 20 findings

- **A-146** F3-03 registry lie `RT_E_CHECKPOINT_MISSING` (`errors.ts:514-519` wrong path + phantom env-guard). · **A-147** F3-07 CLI `wild` arm flattens every failure to `RT_E_PHASE_ILLEGAL` exit 1 (erases codes; never 2/3). · **A-148** F3-09 `runP6Journey` zero console callers (= W-38). · **A-149** F3-10 pin owed (see A-5). · **A-150** F3-16 hollow-mint reachability residual (digest now folds spec paths — verify executed-ness). · **A-151** F3-17 `runPhase` phase-6 bypasses `liveLayer`'s P6 work (parity by construction; comment or funnel). · **A-152** F3-18 journey-gate vs finishPhase-gate verdict divergence (two evidence hashes one phase — note/decide). · **A-153** F3-19 positional phase indexing survives at `store.ts:436/:626` (`.find(p => p.id === phase)` owed). · **A-154** F3-20 `PHASES[coverage.tailStart]` index==id assumption + `HITL_PHASES` consumption unverified.
- (Landed set per K13/283: F3-01/02/04/05/06/08/11–15 verified landed; F3-12/13/14 residuals may already be closed — re-check at coder-card time.)

---

## Appendix B — HELPER'S VERIFICATIONS (byte-truth rows, run 2026-09-28 @ `424f9e5`)

> Run by ENG-HELP (`fixes/302_eng_help.md`). All grep rows were run as `cd "/c/Users/mnril/Desktop/RapidTool Main" && <cmd>` (ripgrep/search tools fail on the space — shell `grep` only). **VERDICT: VERIFIED** = the source's byte-claim still matches today's bytes · **STALE** = bytes moved since (the raw item is done/superseded — strike or re-anchor) · **LIVE-RUN** = observed by executing a verb. Outputs verbatim (trimmed).

| # | Claim under test | Command (as run) | Observed (verbatim, trimmed) | Verdict |
|---|---|---|---|---|
| B-1 | Baseline HEAD is `424f9e5` | `git log --oneline -1` | `424f9e5 X-wave: build+boot+e2e ALL GREEN (first build run), probes consolidated, acceptance reason coded` | VERIFIED |
| B-2 | A-1 F2-04: `stopReason`/`stop_reason` = 0 hits repo-wide | `grep -rn "stopReason" src scripts` | *(no output — 0 hits)* | VERIFIED |
| B-3 | A-2 F2-07: `exportProfiles` consumers = its test only | `grep -rln "exportProfiles" src` | `src/lib/packet.test.ts` · `src/lib/packet.ts` | VERIFIED |
| B-4 | A-3 F2-09: `crewToReport` dead (definition file only) | `grep -rln "crewToReport" src` | `src/lib/crew.server.ts` | VERIFIED |
| B-5 | A-4 F2-10: no budget thread in `crew.server.ts` (while the ledger exports it) | `grep -n "sessionTokenBudget" src/lib/crew.server.ts` · `grep -n "sessionTokenBudget" src/lib/token-ledger.ts` | *(empty)* · `340:export function sessionTokenBudget(): TokenBudget {` | VERIFIED |
| B-6 | A-1 partial: X1's packet.ts header+import landed in `424f9e5` | `grep -n "budgetCap" src/lib/packet.ts` | `9:// adds the session-budget boundary helpers (budgetCap / isBudgetExhausted /…` · `12:  budgetCap,` | VERIFIED |
| B-7 | A-19: packet.ts carries 4 lint warnings from the landed import | `npx eslint src/lib/packet.ts` | `✖ 4 problems (0 errors, 4 warnings)` — `budgetCap` :12, `isBudgetExhausted` :14, `sessionTokenBudget` :15, `TokenBudget` :18 | VERIFIED |
| B-8 | A-10 L3 render: scorecard reader drops `verification` + has no `endClass` anywhere | `grep -n "endClass" src/lib/scorecard.ts` · `grep -n "verification" src/lib/scorecard.ts` | *(empty)* · *(empty)* | VERIFIED |
| B-9 | A-9 Q4-c: run-eval has endClass for the HISTORY row only | `grep -n "endClass" scripts/run-eval.mjs` | `2893:        endClass: historyEndClass(t, mode),` (single hit) | VERIFIED |
| B-10 | A-10: CLI renders no `verification` | `grep -n "verification" scripts/rapidtool-cli.mjs` | *(empty)* | VERIFIED |
| B-11 | A-60 OPS-6: real verb count is 39 (AGENTS.md says 35) | `grep -c 'case "' scripts/rapidtool-cli.mjs` | `39` | VERIFIED |
| B-12 | A-16: root tracked files = 42 live (README §10.1 says 44) | `git ls-files \| grep -v / \| wc -l` | `42` | VERIFIED |
| B-13 | A-16: the drift cell is on disk | `grep -n "\| root" README.md` | `317:\| root \| 44 \| Every root file named in §10.2 \|` | VERIFIED |
| B-14 | A-18/W-40: `diagnose` envelope carries the checkpoint surface — LIVE | `node --experimental-strip-types "C:/…/scripts/rapidtool-cli.mjs" diagnose --project build.json` (cwd `…/Temp/x3_cli_smoke`) | exit **0**; `"checkpoint": {"present": true, "path": "C:\\…\\x3_cli_smoke\\.rapidtool\\checkpoint.json", "savedAt": 1790653340168}`; `"growth": {… "counts": {}}`; timeline carries the 3 real `cli.invocation` rows | LIVE-RUN |
| B-15 | A-57 OPS-11: `readRtTail` still reads the WHOLE file | `grep -n "readFileSync\|openSync\|readSync" src/lib/runtime-log.server.ts` | `144:    const buf = readFileSync(file).subarray(start).toString("utf8");` | VERIFIED |
| B-16 | A-27/A-28 P3 legacy: 4 new-kind fixtures + all graders v2 are on disk (raw rows now done) | `ls research/eval-corpus/*.md \| wc -l` · `ls research/eval-corpus/graders/ \| wc -l` · `grep -l '"graderVersion": 2' research/eval-corpus/graders/*.json \| wc -l` | `12` · `11` · `11` | **STALE** (landed since; remaining = pins A-113) |
| B-17 | A-33(e)/F2-02: packet's loose `lastTest.ok ? "pass":"FAIL"` still live | `grep -n "lastTest.ok" src/lib/packet.ts` | `712:        } (last run): ${project.lastTest.ok ? "pass" : "FAIL"} — …` (card's `:622` → today `:712`) | VERIFIED |
| B-18 | A-45 W-43/F2-15: `applyPolicyOverlay` has ZERO production consumers | `grep -rn "applyPolicyOverlay" src` | only `src/lib/policy-overlay.test.ts:5/:61/:103/:112/:119` | VERIFIED |
| B-19 | A-146 F3-01 P0: `readWildPlan` missing — now landed | `grep -n "readWildPlan" src/lib/engine.ts` | `3604:export function readWildPlan(project: Project): WildPlan {` | **STALE** (done; strike) |
| B-20 | A.9.1: `fixes/296_q2_a2.md` was never written | `ls fixes/296_q2_a2.md` | `ls: cannot access 'fixes/296_q2_a2.md': No such file or directory` | VERIFIED |
| B-21 | A-132 F2-14 class: store mints `decidedBy:"human"` directly, and the store has NO policy seam | `grep -n "decidedBy" src/lib/store.ts` · `grep -n "evaluatePolicy" src/lib/store.ts` | `1699:          decidedBy: "human",` (inside `approveHitl(project, {` @:1698-1703; autopilot paths :470/:576/:674) · *(empty — 0 refs)* | VERIFIED |
| B-22 | A-8: `424f9e5` carries X1's packet partial + X2's coded reason + X4's 12 probe renames | `git show 424f9e5 --stat` | `27 files changed, 489 insertions(+), 55 deletions(-)` incl. `scripts/run-eval.mjs \| 11 +-`, `src/lib/packet.ts \| 18 +-`, 12 `=> fixes/…probe…` renames, 4 X logs, `fixes/300_v1_sixpins.md \| 86 +` | VERIFIED |
| B-23 | A-69: P2's `growth.counts` producer is in the console (was `{}`) | `grep -n "buildClientDiagnosis" src/components/console.tsx` | `75:import { buildClientDiagnosis, … } from "@/lib/rt-client";` · `4489:      const d = buildClientDiagnosis({` | VERIFIED |
| B-24 | A-14 F4 #3: the `meanAtLeast` machinery is live (unreachability stands) | `grep -n "meanAtLeast" scripts/run-eval.mjs` | `336:`, `484:`, `2580:`, `2602:` (all four sites) | VERIFIED |

**Not verified / not run (honest gaps):** full suite + gates + build were NOT re-run mid-fleet (engineer baseline stands: suite 2251/2250/0 + scripts 328/328; build 0; boot 200). No keyed calls. F2-04's unwired helper behavior can't be exercised until it lands. The `fixtures --draft` envelope check (X4 item 4) was out of this sweep's scope — only `diagnose` was run per brief. Traps seen: MSYS mangles a leading-`/c/` node script path arg to `C:\c\…` (use `C:/…`); `read_file` binary-detects `296_q8_ops.md` and the X4 summary (terminal `grep -a`).

---

## Appendix C — FILE-BOX COLLISION MAP (helper · 302)

> Purpose: the lane cut must keep **every file that hosts more than one item in ONE lane**. Census (`git ls-files src | wc -l` → **210** · `git ls-files scripts | wc -l` → **45**); item IDs refer to Appendix A. ⚠ = collision (2+ items from 2+ source groups share the file). Files the remaining items touch, only.

### C.1 — File → items map

**Packet / budget / crew** — `src/lib/packet.ts` ⚠ — A-1, A-2, A-6, A-18, A-19, A-33(e), A-69(packet half), A-122, A-123, A-124, A-126, A-127, A-139, A-140 (X1·K7·q6/X4·W-25·F2 cards = 5 groups) · `src/lib/token-ledger.ts` ⚠ — A-4, A-70 · `src/lib/crew.server.ts` ⚠ — A-3, A-4, A-128, A-129 · `src/lib/crew.ts` — A-4 (READ-ONLY, no change) · `src/lib/planning.ts` — A-4 (additive `code?: ErrorCode` `:79`) · `src/lib/io.ts` ⚠ — A-69 (de-dupe + pin), A-140 · `src/lib/headless.ts` ⚠ — A-18, A-56, A-69 (doctor spend).

**Eval / acceptance** — `scripts/run-eval.mjs` ⚠ — A-8, A-9, A-14, A-85, A-86, A-108, A-110(1), A-113 (X2·P3·F4·Q7) · `scripts/run-eval.test.mjs` ⚠ — A-11, A-38, A-108(#15), A-113 · `src/lib/scorecard.ts` ⚠ — A-10, A-113, A-117(b) (+ NEW `scorecard.test.ts` owed) · `research/eval-corpus/**` — A-113 (pins ≥11 entries), A-22.

**Engine / store / codegen** — `src/lib/engine.ts` ⚠ — A-30, A-33(g/h), A-107, A-133, A-151, A-152 · `src/lib/store.ts` ⚠ — A-5, A-31, A-33(i), A-132, A-136(b), A-149, A-153 · `src/lib/store.test.ts` — A-5, A-107 · `src/lib/codegen.server.ts` ⚠ — A-24, A-110(6), A-150.

**CLI / guards** — `scripts/rapidtool-cli.mjs` ⚠ — A-56…A-67 (OPS), A-69 (K7 `:3417` + diagnose), A-84, A-98 (Q8·K7·q2·W-27) · `scripts/gate.sh` — A-89, A-90 · `scripts/migration-plan.mjs` + `scripts/migration-plan.test.mjs` — A-87, A-88 · `scripts/migrate.mjs` — A-91 · `scripts/write-atomic.mjs` — A-100, A-55 · `scripts/browser-guard.mjs` — A-101 · `scripts/docs-module-parity.mjs` — A-65, A-102 · `scripts/brand-check.mjs`, `scripts/preview.mjs` — A-99 · `package.json` — A-103 · `tsconfig.json` — A-104.

**Telemetry / console** — `src/components/console.tsx` ⚠ — A-69 (heartbeat scope), A-92…A-97, A-128, A-133 · `src/lib/rt-events.ts` ⚠ — A-116, A-121 · `src/lib/rt-client.ts` — A-69 (nulls), A-121 · `src/lib/rt-ring.ts` — A-42, A-121 · `src/lib/watchdog.ts` — A-121 · `src/lib/error-component.tsx` — A-116 (`ui.boundary_crash` `:60`) · `src/lib/runtime-log.server.ts` — A-57 · `src/components/runtime-timeline-pane.tsx` — A-94 · `src/lib/rt-timeline.ts` — A-116 (`known:false`).

**Fixtures / LLM / throws / policy** — `src/lib/fixtures.ts` — A-36, A-117(d) · `src/lib/fixtures.server.ts` — A-36 · `src/lib/llm.ts` — A-110(3) · `src/lib/llm-tasks.ts` — A-30, A-110(4) · `src/lib/llm/providers/deepseek.ts` — A-110(1) · `src/lib/llm/providers/openai-compatible.ts` — A-110(2) · `src/lib/ast-mine.ts`, `src/lib/algorithms.ts`, `src/lib/verify.ts`, `src/lib/vault.ts`, `src/lib/bench.ts`, `src/lib/write-set.ts`, `src/lib/subagent.ts` — A-70 (throws pass; +A-130) · `src/lib/policy.ts` + `src/lib/policy-overlay.test.ts` — A-133.

**Docs (single writer)** — `README.md` ⚠ — A-16, A-17, A-72, A-109, A-114 (X4·P4·Q6·K7) · `START-HERE.md` — A-61, A-114 · `docs-FOLDER-MAP.md` — A-114 · `scripts/README-cli.md` — A-64, A-105, A-114 · `AGENT_GUIDE.md` — A-118, A-141, A-142 · `AGENTS.md` — A-60, A-74, A-143 — **OWNER-consent blocked; NOT a coder lane.**

**Process / ledger files (not code)** — `fixes/301_x1_pipeline.md` A-7 · `fixes/301_x2_accept.md` A-12 · `fixes/301_x4_hygiene.md` A-21 · `fixes/296_q8_ops.md` A-67 · `fixes/296_q2_a2.md` (never created) A-106 · `fixes/295_p1_f2tail.md` A-111 · `fixes/266_lane1..4_bugs.md` (never created) A-40.

### C.2 — ⚠ COLLISION FLAGS (two+ items sharing a file — the disjointness cut must honor EVERY row)

1. ⚠ `packet.ts` — 13 items / 5 groups (F2-04 + K7×3 + q6 acceptance key + W-25e + F2-01/02/06/23) → ONE writer.
2. ⚠ `run-eval.mjs` — 8 items / 4 groups (X2 + P3 + F4 + Q7) → ONE writer, together with `run-eval.test.mjs` + `scorecard.ts`.
3. ⚠ `rapidtool-cli.mjs` — OPS cluster (12+) + K7×2 + q2×2 + W-27 → ONE writer.
4. ⚠ `console.tsx` — P2 residuals ×6 + K7 heartbeat ×1 + F2-09/F2-15 anchors → ONE writer.
5. ⚠ `store.ts` + `store.test.ts` — F3-10 pin + F2-14 + F3-19 + W-25i + A1-45 pins → ONE writer.
6. ⚠ `engine.ts` — W-20 stamp + W-25g/h catches + A1-45 (+`sealedEdge` :2215) + F3-17/18 → ONE writer.
7. ⚠ `README.md` — X4×2 + P4×2 + Q6×1 + K7 minors → ONE writer (docs).
8. ⚠ `token-ledger.ts` — A-4 (consumer) vs A-70 (guards) → assign to the same lane deliberately.
9. ⚠ `io.ts` — A-69 (de-dupe) vs A-140 (F2-23) → same writer.
10. ⚠ `codegen.server.ts` — W-06 + `modelRouteForServed` + F3-16 → one writer.
11. ⚠ `headless.ts` — A-18 (acceptance read) vs A-56/A-69 (doctor spend) → one writer.
12. ⚠ `AGENTS.md` — every item owner-consent-blocked → keep OUT of the 4 boxes.

### C.3 — Suggested disjoint partition (honoring C.2; engineer's call)

- **L1 · packet/budget/crew**: `packet.ts` · `token-ledger.ts` · `crew.server.ts` · `planning.ts` · `io.ts` · `headless.ts`.
- **L2 · eval/acceptance**: `run-eval.mjs` · `run-eval.test.mjs` · `scorecard.ts` (+new `scorecard.test.ts`) · `research/eval-corpus/**`.
- **L3 · engine/store/telemetry/console**: `engine.ts` · `store.ts` · `store.test.ts` · `codegen.server.ts` · rt-* / watchdog / runtime-* / console / error-component.
- **L4 · CLI/guards/docs**: `rapidtool-cli.mjs` · `gate.sh` · `migrate*.mjs` · `write-atomic.mjs` · `browser-guard.mjs` · `docs-module-parity.mjs` · `brand-check.mjs` · `preview.mjs` · `package.json` · `tsconfig.json` · README/START-HERE/docs-FOLDER-MAP/README-cli.
- If a 5th box is allowed, split L3 → (3a engine/store/codegen; 3b telemetry/console). `AGENTS.md` + keyed-run + host-gated rows stay with the ENGINEER/OWNER, never a coder lane.
