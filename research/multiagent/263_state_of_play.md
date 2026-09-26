# 263 — STATE OF PLAY (W24 · one page, sourced)

**Written by:** W24 lane B4 (docs/organization), on tree `4b7031b` — the parent's
"T5.2-A wired end-to-end + run-eval fundedness wire" commit (one above the wave plan's stated
`b721f9c`). **Rule of this page:** every number names the file it came from; nothing here was
re-run unless a command is shown — re-derive any row by reading its source.

## 1 · Done (committed)

**Engine + surfaces (W18–W23, `b721f9c`; per-file claims in `README.md` §"What it does today"):**
- 13-phase deterministic engine, evidence-hashed DoD gates, append-only decision ledger, Agent Packet.
- **37 CLI verbs on disk** — `grep -c 'case "' scripts/rapidtool-cli.mjs` = 37 (count of record also in
  the `b721f9c` commit message: "the 37-arm count"). Includes `tree-run`/`repair`/`edit`, the `lesson`
  family, `fixtures`, `scan`, and the new read-only `eval` scorecard.
- **Single-chunk ESM fix, certified** (W21-L1; W22-L2 certification): emitted trees materialize as real
  ESM; suite **119/119**; `TREE_IMPORT_OK` + `BARREL_IMPORT_OK` — `fixes/257_error_ledger_v3.md` §v4 CLOSE-OUT B,
  `fixes/260_lane2_certify_fix.md`.
- **T5.3 `eval` verb** (read-only M1–M9 scorecard over `research/eval-out/`) — `fixes/262_lane5_eval_ui.md`
  §1; verified live by this lane: `node --experimental-strip-types scripts/rapidtool-cli.mjs eval` →
  `ok:true`, `mode:"keyed"`, `generatedAt 2026-09-25T00:03:43.504Z`.
- **T5.2-A fixtures review surface** (parent, `4b7031b`): `src/lib/fixtures*.ts` data layer + the console
  `FixturesPanel` (commit message of `4b7031b`; corpus smoke `rows:8 problems:0`).
- **W23 lane landings** (each with its log): keyed-run infra (`fixes/262_lane1_keyed_infra.md`), emitter
  template fixes (`262_lane2`), P6 probes in `dod.ts` (`262_lane3`), doctor provider-env + spend
  telemetry (`262_lane4`), defined checks / `scan` (`262_lane6`), recorder — log-debt zeroed, ledger v4
  (`262_lane7`).
- **Gates:** static gates green on `4b7031b` — typecheck 0 + lint 0 (full scope; both commit messages).
  Test suites + build intentionally deferred to the next boundary (owner's coding-wave rule).

## 2 · The run arc — one keyed benchmark, three states

**Source of record:** `fixes/257_error_ledger_v3.md` §v4 CLOSE-OUT A (the ledger block) + the artifacts under
`research/eval-out/` (`history.json`, `results.json`, `run-in-progress.json`).

| run | recorded | score | what happened |
|---|---|---|---|
| **#1** | 2026-09-24 ~14:45 | **5/9 · 0.5556** | emit refused over the Sep-10 leftover tree → m6=0 (`RT_E_FOREIGN_FILES` by design; `fixes/257_error_ledger_v3.md` #65) |
| **#2** | 2026-09-24 14:49 | **6/9 · 0.6667** | fresh clean-dir emit; **m6 0→1**; `pass:false` only on the mean bar — the grader demands all nine bands (`fixes/257_error_ledger_v3.md` #66) |
| **#3** | 2026-09-24 19:03:40 | **3/9 · 0.3333** | **unfunded account, NOT a regression**: every keyed call hit HTTP 402 → all bands on the deterministic floor; marker `preflightClass:"balance-exhausted"`, `meanOfNine:2.9997`, duration **2.6 s** (`research/eval-out/run-in-progress.json`; `fixes/257_error_ledger_v3.md` §v4 CLOSE-OUT A) |

**Arc rule:** run #3 carries **zero tree signal** — never cite it as tree evidence. The tree evidence of
record is the certified crash half (119/119) + the open coverage half: run #2's bytes still fail **28 of
36** capability rows (8/36 present) — `fixes/257_error_ledger_v3.md` #69 / §v4 CLOSE-OUT B, `fixes/262_lane2_emit_templates.md` §0.

## 3 · The fundedness wire (W23-L1 + parent)

Problem it kills: a broke wallet being scored as a trial. Chain now on disk:
- `RT_E_LLM_NO_BALANCE` registered + documented (`src/lib/errors.ts:69`, `:403`); HTTP 402 / "Insufficient
  Balance" classified to it in `src/lib/llm/providers/deepseek.ts` (`fixes/262_lane1_keyed_infra.md` §1).
- `probeFundedness()` — a 1-token probe through the same P6 provider (`scripts/run-eval.mjs:1338`);
  `funded:false` only on 402; `null` when unanswerable — never guessed into pass or fail.
- The STOP: `funded:false` ⇒ loud FUNDEDNESS STOP, **no scored trial** (`scripts/run-eval.mjs:2581-2583`).
- Mid-run wallet death ⇒ the trial ends `no-balance`, excluded from pass@k / flakiness accounting
  (`scripts/run-eval.mjs:1889-1899`; `fixes/262_lane1_keyed_infra.md` §3).
- Per-trial clean emit target so a stale tree is neither refused nor judged as mixed evidence
  (`fixes/262_lane1_keyed_infra.md` §5).
- The probe's call-site in `main()` landed with the parent's `4b7031b` (its message names it "THE
  FUNDEDNESS WIRE"; `b721f9c` still listed "L1 main() probe call" as remaining).

## 4 · What's left (named, not hidden)

**From the W23 close commit `b721f9c` — "Named remaining wires (inventoried, not hidden)":**
- L1 main() probe call → landed (`4b7031b`).
- L5 console panel + README-cli `eval` row → panel landed (`4b7031b`); the README-cli row landed with
  W24-B4 (this lane, rides the W24 commit).
- L2 log §1–4 · L6 log §5 + the 37-arm count → docs debt owned by those lanes/parent; W24-B4 corrected
  the remaining stale counts in `README.md` (35→37 verbs; dossier count) — `AGENTS.md:50` still says
  "35 verbs" and is **blocked on owner consent** (protected file; `fixes/262_lane7_recorder.md` §3).
- AGENTS.md doctrine proposal (`research/multiagent/262_agents_md_proposal.md`) → **AWAITING OWNER
  CONSENT**.
- then suites + commit-2 — the deferred boundary.

**Open engineering residuals (with records):**
- Coverage half open: green needs run #4's synthesis to cover the capabilities run #2's bytes miss
  (28/36 red — `fixes/260_lane3_ledger_corrections.md` §3).
- `pass` additionally needs the mean bar (all nine bands; run #2 measured 0.6667 —
  `fixes/257_error_ledger_v3.md` #66), and a real keyed measurement needs a **funded** account.
- W24 (this wave) is mid-flight: `wave_plans/W24/spring-clean.md` (6 lanes: 4 bug-hunt/organize + 2 UI).
  Nothing in this page claims its outcomes.

## 5 · Bottom line

Honest harness, real benchmark history: funded runs read 5/9 → 6/9, an unfunded run reads 3/9 and is
ruled "the account, not the code", and the wire that prevents that mis-scoring is now on disk. The next
true reading is a **funded keyed run (#4)** — the code can't fake it by design. RapidTool is still
**not** an autonomous software factory and says so itself (`doctor` → `autonomousSoftwareFactory:false`,
`README.md` §Status).
