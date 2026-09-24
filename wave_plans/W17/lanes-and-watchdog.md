# W17 · LANES 1–5 + WATCHDOG — continue the task list on top of `4328d20` (6 agents)

**All readers share this file.** Read your own section. Repo: `C:\Users\mnril\Desktop\RapidTool Main`
(Node v22.23.2; git-bash `/c/Users/mnril/Desktop/RapidTool Main`; SPACE in path → ripgrep FAILS, use `grep`).

```text
TREE: committed at 4328d20 (clean base). A W16 wave is IN FLIGHT on top and owns these files — DO NOT TOUCH
THEM: run-eval.mjs + doctor.ts + their tests (W16-L1, OV-35) · headless.ts summary-envelope region + CLI
summary arm (W16-L2, TASK-01) · console.tsx ScorecardBlock/packet panels + styles.css (W16-L3, DF-18/26) ·
honesty-guards.test.ts + gates.test.ts + packet.test.ts (W16-L4, OV-18/14). Your boxes below are disjoint.

⚠️ HOST ARTIFACT: node under Hermes's BACKGROUND harness dies `stdin is not a tty`, exit 1, zero output.
Run all node tests FOREGROUND; that message is never your bug (ledger: C:/Users/mnril/w15_parent_evidence.txt).

RULES: no fake code / no hallucinations / no bad code / no problem causers. "Do not rebuild before all
tasks are done" — the do-not-rebuild list (220_tasklist_canonical.md §2) is BINDING. WRITE EARLY: skeleton
+ bottom line within ~10 calls, then fill (`fixes/247_lane<N>_<slug>.md`). Every claim = the command that
produced it. FORBIDDEN: `npm run typecheck`, `npm test`, `npm run build` (parent/boundary only). Scratch
outside the repo (`C:/Users/mnril/w17l<N>_scratch/`). Playbook row blocks: research/multiagent/230_task_execution_playbook.md.
```

## LANE 1 — THE CORPUS FOLD (you are the authorized editor of the canonical list this once)
**Owns:** `research/multiagent/220_tasklist_canonical.md` — **ADDITIVE ONLY, attributable, never delete a row**.
The parent's `merge` step, remaining half: (a) add the accepted new rows from `fixes/228_ledger_and_risk_register.md`
§3's ACCEPT/MODIFY verdicts (~19 rows: OV-19/20/21, OV-27(folded→OV-35), OV-28…OV-43, CI-workflow, F3, F1–F4
where accepted) into the §1 table in the canonical schema, marked `> [FOLD-2026-09-24] …(by W17-L1)`; (b) apply
`research/multiagent/241_weak_verification_strengthenings.md`'s strengthened commands to the named rows —
in place, marked `(verification strengthened per 241, by W17-L1)`, keeping the old command struck-through only
if you replace it; (c) add a short §-appendix noting what was folded and what deliberately was NOT (F5 stays
REJECTED; OV-6 folded into F1; OV-TBD stays a research note).
**Done-when:** the file grows only (no row deleted, no prose rewritten); every insertion attributable;
`grep -c "FOLD-2026-09-24"` ≥ your row count; a final `wc -c` + diff summary in your log.

## LANE 2 — T-107.6 · token ledger records measured spend at the four seams (with the A3 catch wrapper)
**Owns:** `src/lib/token-ledger.ts` (+ `.test.ts`), `src/lib/verify.server.ts` (+ `.test.ts`),
`src/lib/node-runner.server.ts` (+ `.test.ts` — read-only if the seam must be scoped OUT, see below).
Read `220_tasklist_canonical.md`'s T-107.6 row + WD-Z's marker first: the **node-runner seam is unobservable
as written** — either scope it out (state why, one line in the log) or define its probe. X-2's A3:
`SessionBudgetExceeded` is thrown but **nothing catches it** → adopting the threading without a catch wrapper
turns a controlled budget stop into `RT_E_INTERNAL`. Keep the default cap **unset** until after Step 0 (D2.3).
**Done-when:** the ledger records measured spend at the in-scope seams; a test pins the catch wrapper's coded
outcome (not RT_E_INTERNAL) for a budget stop; the out-of-scope seam is named with its reason; targeted
suites green (foreground).

## LANE 3 — the thinking/provider contract trio: OV-36 + OV-28 (test-pin half) + OV-37
**Owns:** `src/lib/llm-tasks.ts`, `src/lib/llm/providers/registry.ts` (+ `registry.test.ts`), `src/lib/llm/providers/deepseek.ts`.
Read the playbook's OV-36/28/37 blocks + X-3's Q2b trace first (thinking-mode default ON; `deepseek.ts:372`
disables thinking for NON-pro only — so passing a pro model at a `json:true` site re-arms the fixes/156
`content:""` failure). (a) **OV-36**: pin the thinking decision at the three pro-tier sites
(`llm-tasks.ts:119/144/168`) — a per-site, explicit decision in the request body, not a blind disable.
(b) **OV-28**: land ONLY the test-pin half (body-shape pin at the registry boundary); no behaviour change.
(c) **OV-37**: alias-death handling — a refusal that NAMES the requested id + a refresh path (no prose parsing).
**Done-when:** `registry.test.ts` green (foreground) with the new pins; the body-shape pin would FAIL if the
thinking field flipped; the alias-death refusal names the id; every site's decision stated in your log.

## LANE 4 — the emitted-artifact honesty trio: G5 + DF-04 + TA-21
**Owns:** `src/lib/engine.ts`, `src/lib/phases.ts`, `src/lib/scaffold.ts` (+ their tests).
(a) **G5**: a fresh emit must surface coded failures where it fails — the generated tree carries zero `RT_E`
codes today. (b) **DF-04**: the P7 artifact still claims MCP/A2A with no disclaimer (`engine.ts:922`) — label
it (pattern: `phases.ts:33`). (c) **TA-21**: P9 deploy artifacts (GH-Actions YAML + cloud sketches) ship with
no "template — not executed" marker — add it. Read each site before editing; do NOT reword beyond the claim.
**Done-when:** a fresh keyless emit shows the labels/codes (paste the evidence); `grep -c 'MCP/A2A' engine.ts`
is 0 or the claim is provably labeled; targeted tests green.

## LANE 5 — the infrastructure trio: CI-workflow + OV-19 + OV-43
**Owns:** `.github/workflows/gate.yml` (NEW), a new guard test file `src/lib/zero-byte-guard.test.ts` (or
wherever OV-19's shape belongs — read the playbook), `src/lib/compile-check.server.ts` (+ `.test.ts`) — the
latter ONLY for OV-43's report-only surface; nothing else.
(a) **CI-workflow**: one workflow running `scripts/gate.sh` with a node pin; the runner choice is DELIBERATE —
an ubuntu leg cannot catch this repo's Windows-path bug class. Start with an ubuntu leg + document the gap,
OR propose a Windows leg in the log (runner inventory first: read 2 competitor workflows in `~/rt-competitors`).
Never put a key in CI. (b) **OV-19**: a zero-byte-source guard, scoped to source+test extensions with an
explicit allowlist (field evidence: 12 files/6 clones — `225` hunt 2). (c) **OV-43**: report-only supply-chain
floor (the install leg runs `--no-audit` at `compile-check.server.ts:1149-1156`; emitted deps are caret-pinned
with no lockfile) — a report surface, S first, never a gate.
**Done-when:** the workflow file is valid YAML (`node -e` parse check) and documented; the guard runs on this
repo → 0 offenders or allowlisted, with its own test; OV-43's surface emits a report in a targeted test run.

---

## WATCHDOG — monitor + log all five lanes + the W16 tail (`fixes/248_w17_watchdog_report.md`)
READ-ONLY (your report + scratch `C:/Users/mnril/w17wd_scratch/`; never edit src/scripts/corpus/lane logs; no
git mutations; ≤2 targeted FOREGROUND test runs). Poll all five lanes ≥4 times (`sleep 90`) into a timestamped
action log; verify ≥10 claims against bytes (boxes respected — L1 is the ONE authorized corpus editor, every
other corpus touch = P1 with git evidence); re-run ONE named test per lane (≤2 runs total); then the
help-the-delegator verdict: per lane on-track/at-risk/stuck + next-dispatch guidance + collisions spotted
before they happen. Bottom line at top: `lanes polled · incidents · claims ok/wrong/unverifiable · at-risk`.
