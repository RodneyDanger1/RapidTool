# W27 · MASS INVESTIGATION — 8 codebase-wide auditors + 2 watchdogs (CODERS COME ONLY AFTER THIS)

**All readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`).
```text
THE MISSION (from research/multiagent/thoroughanalysis.md — you MUST read its preamble): RapidTool = a truly
autonomous software factory / the best AI agent harness in the world; GOOD code not bad; any kind of software
(games, websites, programs, applications, tools, way more); continuously improves its output; perfect UI/UX for
the software it makes; and the CODE ITSELF must be professional quality — THE BEST POSSIBLE, everywhere.
You are the AUDIT half. The coder wave comes after you, armed with YOUR worklist. Precision > breadth, but
breadth matters: find EVERYTHING the coders must do.

READ FIRST (all of it): the two shared logs in full — `research/multiagent/thoroughanalysis.md` (mission +
protocol + A1–A4, C1–C6 findings) and `research/multiagent/thoroughaction.md` (the watchdogs' ledger: what
every lane did, why, and the W24/W26 overlap findings) — plus `fixes/263_index.md` (the index), AGENTS.md,
and the prior waves' logs your slice touches. THEN READ THE CODEBASE ITSELF in your slice (the watchdogs'
ledger is testimony; the bytes are the truth).

APPEND PROTOCOL (thoroughanalysis.md): append-only via the end-marker (`<!-- END-OF-FILE-MARKER-W25 … -->`);
patch(old = marker line exactly, new = your block + the unchanged marker); RE-READ before every append
(10 writers share the file); sections R1–R8 are yours; corrections cite IDs; nothing invented, every claim
has file:line (read time) or a command's real output. NO keyed calls (account unfunded). No full-gate runs
(coders will follow; suites are the post-wave boundary). Lane logs: `fixes/267_lane<N>_audit_<slice>.md`.
WRITE EARLY (skeleton within ~8 calls).
```

## R1 — the phase engine core
**Box:** `src/lib/engine.ts`, `phases.ts` (+ their tests). **Hunt:** every unwired/incomplete path; A1-f01's P0 (wildStep never calls keyed synthesis — design the exact fix: where `upgradeP6Keyed` must be invoked from `wildStep`, what guard, what pin); dead branches; silent catches vs the OV-13 invariant; the modelRoute-vs-requested-model honesty leak (C1-f03). Output: findings + a coder-ready fix spec per item (file:line → the change → done-when).

## R2 — state, persistence, gates, packet
**Box:** `store.ts`, `io.ts`, `packet.ts`, `dod.ts`, `gates`-adjacent. **Hunt:** C1-f01 (unguarded date render → whole-store-wipe class), C1-f02 (missing 174-1 guard), C1-f04/f05/f06, the four duplicated transition implementations (drift risk — spec a consolidation), every validator divergence between io↔hydrate↔dod.

## R3 — the factory output path (the P0 home)
**Box:** `codegen.server.ts`, `scaffold.ts`, `compile-check.server.ts` (+ tests). **Hunt:** A3-f01's P0 (emit writes stored bytes VERBATIM → CJS resurrection; spec the emit-time materialization + import-smoke), A3-f02 (the CJS-teaching prompt vs the strict tsconfig), A3-f03 (partial synthesis = total failure), A3-f06 (kind coverage: what EXACTLY the game/cli/library/service emitters need to stop being throwing stubs), A3-f09, DV-04/TA-21 legacy. This slice feeds the wave-2 coders the most.

## R4 — provider layer + server seams + telemetry
**Box:** `src/lib/llm/**`, `*.server.ts`, `rt-*.ts`, `watchdog.ts`, `diagnose.ts`, `errors.ts`. **Hunt:** B3-f02 (xAI 402 mislabel — spec the fix), the tap's async containment (B3-f01's re-check), A2-f07 (the budget ledger threading: spec the process-scoped ledger), model-id validation (C1-f09), every client/server import-boundary risk (grep `node:` in client-safe modules).

## R5 — the harness: CLI + scripts + guards
**Box:** `scripts/**`, `package.json`, `migrations/**`. **Hunt:** A2-f02's P1 (gate.sh green-with-red-leg — spec the exit-condition fix + the fixture), A2-f01 (fixtures --approve without a seat — spec the policy route), A2-f03 (exit-code taxonomy drift), A2-f04/f05/f06/f08/f09/f10/f11/f12, C2-f02 (the degenerate human-seat token), C2-f03 (35-vs-37 drift + widen the doc test), C2-f05 (write-atomic legacy). Every item: exact patch shape + verify command.

## R6 — UI/UX (the "perfect UI/UX" half of the mission)
**Box:** `src/components/**`, `src/routes/**`, `src/styles.css`. **Hunt:** C2-f04 (missing busy latch → double-spawn), A4's 11 findings (the autonomy overclaim f01: decide the honest label per surface; f04's doc contradictions), every render-path crash risk, every unwired control, the FixturesPanel's honest state, tab-order logic. Design the UI worklist the coders implement — additive/re-worded/re-ranked ONLY (never remove a control).

## R7 — docs + corpus + eval truth
**Box:** `README.md`, `AGENT_GUIDE.md`, `scripts/README-cli.md`, `research/multiagent/**` (263_state_of_play), `research/eval-corpus/**`. **Hunt:** C2-f01/B4-f01 (the non-reproducible census — settle it with one real command and spec the README fix + the census's "no job modules" note), A3-f05 (graders don't grade the product — spec what the graders SHOULD assert per the mission), A3-f06 (add fixtures for the missing kinds — spec their briefs), A3-f08 (the README table overclaim), A2-f08/f09 (contract gaps + the eval/fixtures sections).

## R8 — THE MISSION-GAP ANALYST (what's missing to be "the best")
**Box:** whole-repo reading with the mission lens + the run evidence (`research/eval-out/**`). **Deliver:** the definitive list of CAPABILITIES and end-to-end flows still missing or broken for RapidTool to truly be an autonomous software factory — e.g. the wild/live/console/eval paths' convergence on ONE keyed journey (A1-f02's mint reachability), the T-107.7 checkpoint/resume, F1 MCP, the second provider, streaming, the cassette, per-action allow-lists — each with: what exists today (file:line), what's missing (exact), the smallest complete design, and the done-when. This is the coders' roadmap: make it exhaustive and ordered.

---

## WD-α · live watch + codebase cross-read (`fixes/268_wd_alpha.md` + `thoroughaction.md` §WD-5)
WATCH the 8 auditors (poll ≥5×, timestamped; claims-vs-bytes; box enforcement; the marker protocol).
AND — per the owner's explicit instruction — **read the CODEBASE ITSELF** in the highest-risk slices
(engine/codegen/scripts): you are the second pair of eyes hunting what the auditors miss; every catch gets a
row (auditor ID + the counter-finding with file:line). Bottom line at top.

## WD-β · THE CONSOLIDATOR (`fixes/268_wd_beta.md` + `thoroughanalysis.md` §W27-WORKLIST)
READ: all prior findings (A1–A4, C1–C6, B*/H* in their summaries) + the auditors' R1–R8 appends as they land
+ the codebase itself for spot-checks. **DELIVER: §W27-WORKLIST appended to thoroughanalysis.md** — THE ONE
consolidated, prioritized (P0→P3), deduplicated register of every fix/wire/build item the coder wave must
execute, each with: ID · what · files (file:line) · the fix shape · done-when · source finding(s).
Mark: READY (unblocked) / BLOCKED (on what) / OWNER-ONLY. Dedupe ruthlessly (many findings overlap); never
drop one silently — merged items list their source IDs. This table IS the bridge to wave 2.
