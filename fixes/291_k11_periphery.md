# fixes/291_k11_periphery.md — W40 · LANE K11 · §A2'S PERIPHERY + THE CONTRACTS THAT LIE + DOC-PARITY

**Lane:** W40 K11. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell `grep` only; keep one-liners SHORT).
**Mission:** (1) land §A2's periphery findings whose box is scripts/docs/configs/tests (skip files K3/K4 own);
(2) the **'contracts that lie'** class — comments/docs asserting behavior the code doesn't have, fixed to the truth
(or the code to the doc) per the honest-state rule, each itemized; (3) the doc-parity items
(`docs-module-parity.mjs`'s finding + any doc claim a grep disproves); pinned-doc lies → note + TODO.
**Contract:** CODE + `node --check` on every edited file; NO gates / keyed calls. Log written EARLY; append-only.
**Baseline HEAD:** `2fa3cd9` (W29–W39 era uncommitted). Sibling lanes K1–K9 (deleg_e1758fce) + K10/K12–K15 (deleg_2879dda4) LIVE.

## Sources read at lane start (byte state)

- §A2 findings inventory: `~/AppData/Local/hermes/cache/delegation/subagent-summary-1-20260926_195032_506645.txt` (64 lines, 28 items, byte-checked 2026-09-26 ~19:30–20:00). §A2 was **never appended** to `wave_plans/W34/code-notes.md` (still §A1-only, 651 lines) → the summary is the source.
- `fixes/287_z5_runtime_tail.md` Part 4 (README minors = **K7's**, `fixes/290_k7_tinyfixes.md` items 12e/12f) + `fixes/286_readme_catalog.md` + its summary (`-0-20260926_204219_515388.txt`).
- K-lane boxes (delegation manifests `deleg_e1758fce` + `deleg_2879dda4`) + fresh lane logs:
  **K2** = `migrations/**` + planner + store persistence + **atomic writes** (`fixes/290_k2_persist.md`);
  **K3** = guard scripts in `scripts/**` EXCEPT `rapidtool-cli.mjs` and `*.test.mjs` — incl. **gate.sh, docs-module-parity.mjs, write-atomic.mjs, browser-guard.mjs, with-app-env.mjs, preview** (`fixes/290_k3_scripts.md`);
  **K4** = `src/lib` backends + Q2 syntax (`fixes/290_k4_backends.md`);
  **K7** = cli.mjs :3417 + diagnose arm + console.tsx hunks + AGENT_GUIDE.md §4 + README 12e/12f (`fixes/290_k7_tinyfixes.md`);
  **L3** = run-eval schemas/acceptance (deleg_1eb6fe2b task-2); **K15** = §A1 test-quality.

## Item ledger (append-only — one evidence line per item)

| # | item (§A2 ref) | target | status |
|---|---|---|---|
| M1 | contract-lie §A2-1: dev server "binds `0.0.0.0:8080`" | `AGENTS.md:18` | PENDING |
| M2 | contract-lie §A2-2: "35 verbs" vs 39 | `AGENTS.md:50` | PENDING |
| M3 | contract-lie §A2-3: cli.mjs cites `cli-exit-taxonomy.test.mjs` | `rapidtool-cli.mjs:602/:1567` | PENDING |
| M4 | doc-parity: `src/generated.ts` missing (3 docs) | RESUME.md · remainingwaves.md · taskuniverselog.md | PENDING |
| M5 | §A2-28: README-cli.md "## Tests" stale (2 suites vs npm test's 2 legs) | `scripts/README-cli.md:1042` | PENDING |
| M6 | §A2-26: package.json — no `format:check`, no `--test-reporter` pin, `sideEffects:false` | `package.json` | PENDING |
| M7 | §A2-27: tsconfig `include:[src,server]` — scripts untypechecked | `tsconfig.json` | PENDING |
| M8 | §A2-4: `respond()` stdout truncation (process.exit vs pending write) | `rapidtool-cli.mjs:165` | PENDING |
| M9 | §A2-22: hardcoded `budgetsMs` vs imported constants | `rapidtool-cli.mjs:3308` | PENDING |

**Not mine (handoff, one line each):** §A2-5/6 run-eval (K2/L3) · §A2-7/8 migration-plan.test (K2) · §A2-9/10 gate.sh (K3) ·
§A2-11/12 migrations (K2) · §A2-13…19 console/UI (K1/K5/K7) · §A2-20 parseArgs + §A2-21 am-I-main ×5 + §A2-23 write-atomic +
§A2-24 browser-guard + §A2-25 docs-module-parity self-check (K3's `scripts/**` box) · §A2-26 sideEffects assessment to note.

## Log (append-only)

### [t0] log opened — sources read, collision map fixed, byte-verifications begin

- Confirmed §A2's high-value claims against today's bytes before patching (details land per item below as they're fixed).
- `git status --short` at start: `?? fixes/290_k8_records.md` only (other K-logs landed during recon: 290_k3/k4/k7).
