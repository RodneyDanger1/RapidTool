# 323 — FIX-2b register (window #4) — scripts + fixtures lane, continuation of FIX-2

Lane: FIX-2b (continues lane FIX-2, which recon'd everything but landed ZERO edits and no log).
Window #4 OPEN per `C:/Users/mnril/w44_trial/fix_go4.md` (read 2026-09-30 ~18:40 CDT, 22 lines).
HEAD at open: `20802b1` + uncommitted windows 1–4 edits (all landed; no keyed runs in flight).
Predecessor recon: `C:/Users/mnril/AppData/Local/hermes/cache/delegation/subagent-summary-1-20260930_184040_643744.txt` (authoritative, byte-anchored).
Don't-touch list honored: FIX-1's files (packet.ts, wild-mode.server.ts, policy.ts + their tests) and X3b's
files (codegen.server.ts, knowledge.ts, dod.ts + their tests) — read-only at most; NO edits by this lane.
**Real code only — no mocks/stubs/placeholders. One writer per file. Re-read each region immediately before editing. Patch-only minimal diffs. Pins never weaken; every deliberate pin change is recorded below. Scoped proofs only — never npm test/build/gate.sh.**

## Work queue (from fix_go4.md §FIX-2 + parent brief)
1. Arcade-breakout fixture: rewrite `research/eval-corpus/arcade-breakout.md` brief LEX-hitting + leak-safe; keyless create+P0 probe → `outcome:"advanced"`, no reframe; additive pin.
2. Checkpoint staleness: comparison (phase/state/hash) + ignore-with-notice in `rapidtool-cli.mjs` (+ small `headless.ts` helper); pin.
3. F-3 honest parks: exit-2 rows → honest level + park tag; `diagnose.ts` verdict language for honest parks; pin updates recorded.
4. T9.3 repair-arm promotion: wire `promoteEmittedTreeTested` in the CLI `repair` arm; pin.

## Status log

- [~] Opened (log-first, before any edit — precondition honored). Recon state:
  - Fixture brief (:3) scores **0 LEX hits** → `lattice.vague:true` → scorecard `reframe:true` → P0 forceHuman park
    (chain: `fixes/321_d3_keyed_eval.md:159-176`). Model brief that PASSED keyless P0: `fixes/319_keyed_trial.md:14`.
    LEX register `src/lib/algorithms.ts:43-321`; `vague ⇔ jobs.length===0 && entities.length===0` (`:442`).
    Leak constraint `run-eval.mjs:1194-1207` (`briefLeakScan` reads `entry.brief` + `entry.name` only; markers =
    grader acceptanceBar + `arcade-breakout.grader.json` / `eval-corpus/graders/arcade-breakout.grader.json`).
  - Checkpoint: `unattended` (`rapidtool-cli.mjs:875-925`) prefers any admitted checkpoint over the named file;
    `resume` (`:829-866`) same read shape; `headless.loadResumableCheckpoint` (`:855-899`) admits via
    `checkpoint.server.ts:358-409` — identity + mode + integer phase/step ONLY, **no freshness/state comparison anywhere**.
    X2b OBS source: `fixes/319_keyed_trial.md:97` ("fresh dirs — a stale checkpoint can silently resume old state").
  - F-3 parks: row producer `rapidtool-cli.mjs:181-209` (`level: exitCode===0 ? "info" : "error"`, `code: out.code` null
    on clean parks); live old-row bytes `{"level":"error",…,"message":"gate exit 2",…,"code":null,"payload":{"cmd":"gate","exitCode":2}}`;
    exit-2 sites `:588-592` (respondDriveOutcome) + `:753-818` (run/gate arm, untouched by design); exit 2 = parked
    (`awaiting_hitl`/`blocked`), never a failure (README-cli §Agent contract). Diagnose errors filter CLI `:3965`
    `level==="error"||"critical"`; verdict home `src/lib/diagnose.ts:357-367` (`unclassified-errors`, "not a clean bill
    of health") + `:129-134` NONE_DETECTED. `RtLevel` union `rt-events.ts:26` already carries `warn` — no catalogue change needed.
  - T9.3 repair arm `rapidtool-cli.mjs:1939-2030`: `if (res.ok)` saves only the LEDGER (`h.saveProject(path, res.project)`);
    the emitted DIR's own `.rapidtool/project.json` never earns the tested stamp (gap per `fixes/319_f3_promote.md:52` + §C4).
    The emit-arm precedent: `rapidtool-cli.mjs:1547` → `h.promoteEmittedTreeTested(project, res.dir, outcome)` (`headless.ts:2438`).
    NOTE (adjudication, recorded): §C4's literal sketch passes `res.project` — but `repairTreeDir`'s `recordGreen` mints
    the tested label BEFORE the CLI sees it, and `promoteEmittedTreeTested` early-returns when `before === "tested"`
    ("an already-tested project writes nothing"). So the helper needs an explicit caller attestation (below, item 4).

### Item 1 — arcade-breakout fixture LEX-clean — IN PROGRESS

(to fill: new brief bytes, probe output, pin, proofs)

### Item 2 — checkpoint staleness — PENDING

### Item 3 — F-3 honest parks — PENDING

### Item 4 — T9.3 repair-arm promotion — PENDING

### Proofs ledger (scoped only)

(pending)

=== END 323_f2_register — IN PROGRESS ===
