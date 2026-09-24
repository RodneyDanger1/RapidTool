# 220 · THE CANONICAL TASK LIST — RapidTool overhaul (WATCHDOG D output)

**Written:** 2026-09-24 by WATCHDOG D (W13), read-only on `src/`, `scripts/` and all other documents.
**This file is the only write.** Rules followed: `wave_plans/W13/wd-d.md` (read first, in full).
**Tree state of record:** `7582771` (W12 close, committed 2026-09-24 11:15:16 -0500). Boundary gate
taken-from `fixes/218` §5 (not re-run — forbidden): typecheck 0 · lint 0 · assertionGaps 0 · scripts
261/261 · lib 1957/1957 (+1 by-design skip) · build 0.

**What this document is.** The one task list produced by the 9-agent W13 inquest: six dossiers
(`219a`–`219f`), three watchdog reports (`219_wdA/B/C`), four wave records (`218`, `216z`, `217b`,
`217c`) and the standing boards (`taskuniverselog.md`, `remainingwaves.md`, `RESUME.md` §4/§6.1,
`AGENTS.md`), canonicalised into 42 status-honest, evidence-traceable, dependency-ordered rows.

**The audited-truth rule (applied throughout).** Where a dossier line contradicts a watchdog marker,
the **WD version wins** (WD-A corrected 219a/219b headers + the DF-09 anchor; WD-B corrected 219c/219d
anchors and falsified "edit --write is human-gated"; WD-C corrected five 219f competitor facts, the
bolt.diy count, the 219e header, and re-scoped plan step W14-L4). The **corrected** W14/W15/W16 steps
in `fixes/219_wdC_lane56_plan_corrections.md` are used here — never the uncorrected table.

**Status vocabulary (strict).** `TODO` · `DONE-VERIFIED` (cited in §2, not listed as work) ·
`BLOCKED-KEY` · `OWNER-DECISION` · `OWNER-RUN` · `UNVERIFIABLE-NOW` (what is missing is stated) ·
`RESEARCH-ONLY`.

**Verification-column convention (stated so it can be audited).** Each command is either (a) run or
recorded in the inquest record (dossier / WD report / board shows it real and runnable —
`fixes/219_wdC` §3 audited this for every plan step), or (b) the repo's canonical targeted-run form
`node --experimental-strip-types --test --test-concurrency=2 <file>` applied to a suite file that
**exists on disk today** and is explicitly named by the record for that work. Where neither holds,
the cell says **MISSING** and the row status is `UNVERIFIABLE-NOW` with exactly what is missing. No
command is invented. Every `files` path was checked on disk 2026-09-24 (`ls`/`test -e`). Commands I
re-ran myself today are marked **[me]**. I ran **zero** test runs (budget unused; only read-only
greps/ls).

**Read order if you are the parent:** §5 (first 48 h) → §3 (sequencing) → §1 (the table) → §2
(do-not-rebuild) → §4 (reconciliation) → §6 (coverage).

---

## §1 · THE TASK LIST (42 rows, stable ids)

Existing ids are reused verbatim (`TASK-01`, `T-107.6`, `T-107.7`, `T-107.8`, `T4.2`, `T4.3`+`TA-18`,
`TA-3`, `TA-21`, `T0.10`, `T3.6`, `T5.1`–`T5.7`, `DF-09`, `DF-18`, `DF-26`, `DF-04`, `G4`, `G5`,
`D-1`, `D-2`). New items are `OV-1`…`OV-18` (OV = overhaul). Nothing renumbered.

### A. W14 — "backlog + eyes on the UI" (all files free; independent of Step 0 — 219e §4)

| id | title (≤12 words) | why (evidence: dossier + file:line) | files | done-when (observable) | verification command (exact) | size | deps | owner | status |
|---|---|---|---|---|---|---|---|---|---|
| **TASK-01** | nextAction on the summary envelope | 219b §1.4 r1: `grep nextAction headless.ts` → 0 **[me: 0 today]**; carried twice (218 §3.1); parent decision recorded (taskuniverselog:533-539): 111's action vocabulary = the wire contract, brief's 7 arms as distinguishable cases, keep console `uiNextAction` (console.tsx:311) independent | `src/lib/headless.ts`, `src/lib/headless.test.ts`, `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md` | summary envelope carries 111 action vocabulary as distinguishable cases (unknown/running/approve/retry/done/fix-gate/run); two computations independent | `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts`; then `grep -c nextAction src/lib/headless.ts` > 0 | M | — | lane (W14-L1) | TODO |
| **T5.3** | eval verb exposing the M1–M9 scorecard | 217c §2.3 (driver+rubric+corpus+results exist; no CLI verb — 217c cmd 16); 104:613; 103 A18 (size S) | `scripts/rapidtool-cli.mjs`, `scripts/run-eval.mjs`, `scripts/README-cli.md`, `scripts/*.test.mjs` | one JSON object per CLI contract (mode/generatedAt/per-criterion); exit 0 when run completed (red scores = data); coded refusal when corpus missing; README-cli doc-contract green | post-landing: `node --experimental-strip-types scripts/rapidtool-cli.mjs eval --limit 1`; `node --test scripts/README-cli.test.mjs` (both real; WD-C §3) | S | — | lane (W14-L1) | TODO |
| **T-107.6** | token ledger records measured spend at the four free seams | 219e W14-L2; WD-C §3 FLAG: only 3 of the named seam test files exist — `verify.server.test.ts`, `node-runner.server.test.ts`, `token-ledger.test.ts`; the chat/crew suites are `chat.test.ts`/`crew.test.ts` (checked on disk **[me]**) | `src/lib/token-ledger.ts`(+test), `src/lib/verify.server.ts`(+test), `src/lib/chat.server.ts`, `src/lib/crew.server.ts`, `src/lib/node-runner.server.ts`(+test), `fixes/216w_token_ledger_seams.md` (body) | each seam threads ONE `TokenBudget` (token-ledger.ts:269-339) and records real usage; over-cap refuses before the wire with a coded message; keyless path byte-identical (216z L2 contract) | `node --experimental-strip-types --test --test-concurrency=2 src/lib/token-ledger.test.ts src/lib/verify.server.test.ts src/lib/node-runner.server.test.ts` + `src/lib/chat.test.ts` / `src/lib/crew.test.ts` (existing names; WD-C-corrected) | M | — | lane (W14-L2) | TODO |

> [WD-Z · 2026-09-24] CORRECTED (seam observability): "each seam threads ONE `TokenBudget`" applied to `src/lib/node-runner.server.ts` → that seam has no token/usage surface to thread: `grep -nE "TokenBudget|usage|spend" src/lib/node-runner.server.ts` → **0 hits** today (only the 48 000-char output clamp `:74/:91`; 222 §2 row 2 already flags it "UNMAPPED"; 226 A7 same) — the done-when is unobservable for this seam as written. Either scope this seam out of T-107.6 explicitly, or define the observable probe at dispatch. — evidence: grep + reads by WD-Z 2026-09-24; `research/multiagent/222_codebase_integration_map.md` §2 row 2; `research/multiagent/226_shortcomings_and_plan_stress.md` A7. (by WD-Z)
| **OV-1** | provider breadth step 1: env selection + doctor surfacing | 219e W14-L3; registry's own deferred list (registry.ts:35-38); spec 101 §4; WD-C §3 SOUND — registry.test.ts **ran live 21/21** | `src/lib/llm/providers/registry.ts`(+test), `src/lib/doctor.ts`(+test) | unknown provider id → `RT_E_VALIDATION` refusal; default path byte-identical; doctor prints provider/model team honestly (keyless ⇒ not-configured) | `node --experimental-strip-types --test --test-concurrency=2 src/lib/llm/providers/registry.test.ts` + `src/lib/doctor.test.ts` | M | — | lane (W14-L3) | TODO |
| **OV-2** | first browser pass — fix the output-path guard first | 219e W14-L4 **as corrected by WD-C C7**: `browser-smoke.mjs` takes POSITIONAL args, and `checkedOutputPath` compares a resolved `C:\…` path against the literal `/workspace\` prefix — every path fails on Windows (reproduced by WD-C); 218 §4: "nobody has looked at these pixels" | `scripts/browser-guard.mjs` (fix target; guard at :34-42), `scripts/browser-smoke.mjs`, `scripts/browser-smoke-verdict.mjs`, `src/components/console.tsx`, `src/styles.css` | guard resolves each allowed dir (WD-C's repro passes); smoke returns ok and writes the PNG against `npm run dev`; every finding fixed or registered (declare-or-strike) | `node scripts/browser-smoke.mjs http://localhost:8080/ C:/workspace/screenshots/w13-l4.png` (closest-runnable post-guard-fix; chromium installed per WD-C) | M | dev server on :8080 | lane (W14-L4) | TODO |
| **TA-3** | doc-truth sweep: verbs, counts, USAGE | 219a §1 + §3 r2: `grep -c 'case "'` = **35** **[me: 35]**; README.md:9/:80/:101 and AGENTS.md say 34; USAGE object 34 keys — `diagnose` missing [me: `grep -c 'diagnose:'` = 0]; 219e W14-L5 | `README.md`, `AGENTS.md`, `scripts/README-cli.md`, `taskuniverselog.md`, `remainingwaves.md` | every count re-derived by a command in the same commit; USAGE gains `diagnose`; README-cli doc-contract test extended to the `eval` verb | `grep -c 'case "' scripts/rapidtool-cli.mjs` = 35; `node --test scripts/README-cli.test.mjs` | S | shares README.md with OV-17 | lane (W14-L5) | TODO |

> [WD-Z · 2026-09-24] CORRECTED (TA-3 scope addition): the drift list "README.md:9/:80/:101 and AGENTS.md say 34" is incomplete → `README.md:14` **also** carries a stale boundary-gate snapshot: "scripts **220/220** + src **1803/1803** tests · build 0" against today's 261 scripts / 1957 lib (`fixes/218` §5, the gate of record; older README numbers are strictly superseded). Flagged by 222 (W14-L5 row) and re-read by WD-Z — fold `README.md:14` into this row's sweep with the rest of the counts. — evidence: `sed -n '14p' README.md` + `fixes/218` §5 read by WD-Z 2026-09-24; `222_codebase_integration_map.md` §2 W14-L5. (by WD-Z)

> [AUD-2 · 2026-09-24] CORRECTED (T5.3 verify cell): "post-landing: `… eval --limit 1`" → `run-eval.mjs` parses **only the equals form** (`LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="))`, `scripts/run-eval.mjs:85-86`), so a space-form `--limit 1` would be silently ignored even after the verb lands. Use `eval --limit=1` (or define the new verb's grammar deliberately at dispatch). Every other element of the row verified real today (files, `README-cli.test.mjs`, 35-verb surface). — evidence: `scripts/run-eval.mjs:85-86` read by AUD-2 2026-09-24. (by AUD-2)

> [IMPROVER · 2026-09-24] EVIDENCE-ADD (TASK-01): the seven-arm vocabulary is already pinned in code — `const NEXT_ACTION_BUTTON: Record<UiNextAction["kind"], string | null>` at `console.tsx:382` with keys exactly `run · approve · fix-gate · retry · done · running · unknown`; `uiNextAction` is `:311` and its per-arm CLI verbs are `status` (unknown) / `gate` (running, fix-gate, run) / `approve` / `retry` / `emit` (done). The wire contract mirrors this list; it must not re-derive the arms. — evidence: `sed -n '311,400p' src/components/console.tsx` + `grep -n NEXT_ACTION_BUTTON` (read today). (by PLAN-IMPROVER)
> [IMPROVER · 2026-09-24] TRAP (OV-2): the guard fix has a test-pin landmine — `scripts/browser-smoke-verdict.test.mjs:375-383` `assert.match`es the SOURCE of `browser-smoke.mjs`, pinning the four literals `checkedOutputPath(…, ["/workspace"])` (`:380-:383`); smoke callers are `browser-smoke.mjs:30,:32,:33,:41`. Either fix inside `checkedOutputPath` (resolve each allowed dir — callers keep the literals, pins stay green) or update those four assertions in the same commit. — evidence: `sed -n '368,392p' scripts/browser-smoke-verdict.test.mjs` + `grep -rn checkedOutputPath scripts/` (read today). (by PLAN-IMPROVER)

### B. W15 — "the zeros" (lanes read T0.10's log; without it, done-when degrades to a diagnosis memo — do not patch blind; 219e §4)

| id | title (≤12 words) | why (evidence) | files | done-when | verification command (exact) | size | deps | owner | status |
|---|---|---|---|---|---|---|---|---|---|
| **OV-3** | M2 leg: emitted tree's own tests run honestly | 219e W15-L1; M2=0 keyed (results.json; `_keyed-run.log`); compile-check "UNVERIFIED (not a pass)" strings :841/:918 stay exact | `src/lib/compile-check.server.ts`(+test), `src/lib/scaffold.ts`(+test), `src/lib/codegen.server.ts`(+test) | on a corpus-shaped fixture, tree-run executes the tree's own typecheck+test; pass/fail/unverified = three distinct outcomes; red tree keeps `ok:false` | `node --experimental-strip-types --test --test-concurrency=2 src/lib/compile-check.server.test.ts` (file exists; WD-C §3 SOUND) | M | T0.10 log | lane (W15-L1) | BLOCKED-KEY |
| **OV-4** | M3/M4 leg: promote a machine-verified verdict | 219e W15-L2; M4 evidence string: `lastTest label="unlabeled" + NO evidenceHash` | `src/lib/verify.server.ts`(+test), `src/lib/dod.ts` | passing verification records `lastTest.label === "tested"` WITH evidenceHash; P6 probes read the promoted verdict; failures carry unmet probe + hash | `node --experimental-strip-types --test --test-concurrency=2 src/lib/verify.server.test.ts` (exists; WD-C SOUND) | M | T0.10 log | lane (W15-L2) | BLOCKED-KEY |
| **OV-5** | M9/M7 leg: journey stop + learning baseline read | 219e W15-L3; M9=0; M7 = baseline row only | `scripts/run-eval.mjs`, `src/lib/maker-score.ts`, `src/lib/headless.ts` (stop paths only) | journey terminates within budget with a clean stop reason; a second same-domain run reports M7=1 citing run #1's row | `npm run eval -- --trials=2` (real flag, run-eval.mjs:89-93 per WD-C) + targeted lib tests | M | T0.10 log | lane (W15-L3) | BLOCKED-KEY |
| **T4.2** | git landing tail: init + commit behind a seat | 219e W15-L4; remainingwaves:195 (T4.2/TA-17); the `.gitignore` half already landed (W11-L5) | **NEW** `src/lib/git.server.ts` (absent today **[me]**; name at dispatch), `scripts/rapidtool-cli.mjs`, `src/lib/scaffold.ts`(+test) | `git init` + one commit per cycle available on a scratch tree; never touches the host repo without a seat | new module test + scratch-dir CLI probe (exact probe to name at dispatch — WD-C §3 minor) | M | — | lane (W15-L4) | TODO |
| **OV-6** | interop spike: 35-verb surface as MCP tools? | 219e W15-L5; 219f B2 (7 clones ship live MCP clients; RapidTool ships the contract artifact only — types.ts:27, dod.ts:428-430, phases.ts:33) | **NEW** `research/multiagent/219g_interop_spike.md` (absent today **[me]**; + scratch server outside the repo) | memo answers feasibility/cost/risks with a real handshake trace or an explicit "could not run X because Y"; no core edits | — (memo; its own trace is the evidence) | M | — | lane (W15-L5) | RESEARCH-ONLY |

> [AUD-2 · 2026-09-24] CORRECTED (OV-6 `why` count precision): "7 clones ship live MCP clients" — verified with receipts as **7 clones carrying MCP client code**: 6 first-party client hubs (cline `apps/vscode/src/services/mcp/McpHub.ts` · Roo `src/core/tools/UseMcpToolTool.ts` · opencode `packages/opencode/src/mcp/` (6 modules) · codex `codex-rs/codex-mcp/` + `rmcp-client/` · Dyad `src/mcp_oauth/` · bolt.diy `app/lib/services/mcpService.ts`) **plus ChatDev** (`runtime/node/agent/tool/tool_manager.py:15` `from fastmcp import Client`, stdio + StreamableHTTP transports; imported by `runtime/node/executor/agent_executor.py` and `workflow/graph.py`). The parent's §4.5 P1 note ("6 clients + 1 server example") **undercounts ChatDev** — its `mcp_example/mcp_server.py` is the example server *for that client seam*. — evidence: clone `ls`/`grep`/`sed` reads by AUD-2 2026-09-24 (read-only; nothing executed). (by AUD-2)

### C. W16 — "continuity + re-take"

| id | title (≤12 words) | why (evidence) | files | done-when | verification command (exact) | size | deps | owner | status |
|---|---|---|---|---|---|---|---|---|---|
| **T-107.7** | checkpoint + `resume` verb | 219e W16-L1; pushed twice (remainingwaves:202,:219); 90 Axis 2 item 1 / Axis 3 item 2 | `src/lib/engine.ts`, `src/lib/types.ts`, `src/lib/headless.ts`, `scripts/rapidtool-cli.mjs` | kill mid-P6 → resume → same state hash, same next phase, same verdict; a restore is itself a ledgered event | targeted resume probe + lib tests (exact probe to name at dispatch — WD-C §3 minor) | M | — | lane (W16-L1) | TODO |
| **T4.3** (+**TA-18**) | patch preservation / conflict on user-edited trees | 219e W16-L2 (row-15 residual); WD-C §3 FLAG: **no verification command stated** for this step | `src/lib/patch.ts`, `src/lib/io.ts`, `src/lib/codegen.server.ts` | an edit cycle over a user-modified tree either preserves the user edit or refuses loudly — never silently overwrites | **MISSING** — the record supplies no command; what's missing: a defined check (WD-C suggests adding a `src/lib/patch.test.ts` targeted run + a scratch edit-cycle probe; `patch.test.ts` exists but today pins only existing behaviour) | M | — | lane (W16-L2) | UNVERIFIABLE-NOW |
| **OV-7** | eval-corpus expansion + grader-freeze audit | 219e W16-L3; WD-C §3: "no done-when stated" → added below; grader-freeze = 107 lesson 5 (frozen outside the agent) | `research/eval-corpus/**`, `scripts/run-eval.mjs` | M7 measurable across ≥2 domains; graders frozen and leak-scanned | `npm run eval -- --trials=2` (real) + grader-freeze check (form of the check to be fixed at dispatch) | M | — | lane (W16-L3) | TODO |
| **T0.10** | fresh keyed run #1 — Step 0 (gates everything after it) | 219e Step 0; 103 G8 (doctor checks env presence only); 219c rank 1 ("zero engineering, one env var"); last keyed run 4/9 predates W5–W12 fixes | `research/eval-out/results.json`, `research/eval-out/_keyed-run.log`, per-trial dirs (regenerated) | a keyed row with all nine criteria scored; the project log names the unmet probes; score pasted into `taskuniverselog.md` §5 as the new T0.10 evidence | `npm run eval -- --keyed` (exactly as recorded in `_keyed-run.log:2`; WD-C §3 SOUND) | S | live `DEEPSEEK_API_KEY` | **OWNER-RUN** | OWNER-RUN |
| **OV-8** | keyed run #2 (same domain) + publish + claim flips | 219e W16-L4; this is what makes M7 real; flips only per the new evidence (declare-or-strike) | `research/eval-out/**`, `README.md`, `taskuniverselog.md` | same-domain run #2; honest score published; README/doctor wording changed only in the same commit as the evidence | `npm run eval -- --keyed` + diff README claims against `results.json` | M | T0.10, OV-3, OV-4, OV-5 | **OWNER-RUN** | OWNER-RUN |

### D. Phase 5 (T5.x — post-W16 program; spec = `fixes/217c` §1/§2; T5.6/T5.8 are decisions → §1 F below)

| id | title (≤12 words) | why (evidence) | files | done-when | verification command (exact) | size | deps | owner | status |
|---|---|---|---|---|---|---|---|---|---|
| **T5.1** | streaming output (transport spike first) | 217c §2.1; 90:166; `stream: false` at `llm/providers/deepseek.ts:377`; transport question UNKNOWN — needs a spike first | `src/lib/chat.ts`, `src/lib/chat.server.ts`, `src/lib/llm/providers/deepseek.ts`, `src/components/console.tsx` (ChatPane), `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md` + new tests | per 217c §2.1 done-when 1–4: incremental tokens; Stop aborts; abort persists as coded display row; keyless byte-unchanged; opt-in NDJSON CLI mode; README-cli test green | `node --experimental-strip-types --test --test-concurrency=2 src/lib/chat.test.ts` (existing suite — **not** `chat.server.test.ts`, which does not exist on disk **[me]** — 217c's name for it is a phantom, same class WD-C flagged for W14-L2); new scripts-leg NDJSON test | M | transport spike; console.tsx ownership | lane (Phase 5) | TODO |
| **T5.2** (half A) | fixtures review UI + store actions | 217c §2.2; 219c rank 3 — no shipped path stamps `decidedBy:"human"` on a fixture (brief-fixtures.ts:594,:608); console has zero fixture hits (217c cmd 13) | `src/components/console.tsx`, `src/lib/store.ts`, `src/lib/brief-fixtures.ts` (only if a helper is needed), new tests | approving one case in the UI flips `acceptanceFixtures[i].approval` via the SAME `approveFixtureCases` helper (never a second path); CLI `fixtures` reports it; brief-hash revert rule holds; pending-fixtures banner | `node --experimental-strip-types --test --test-concurrency=2 src/lib/brief-fixtures.test.ts` (exists) + new store-action tests; console.js testing = UNKNOWN (217c — prefer extracting pure logic) | M | — | lane (Phase 5) | TODO |
| **T5.4** | artifact provenance fields | 217c §2.4; 103 A15; `Artifact = {id,phase,kind,title,body,language?}` (types.ts:41-47) — no provenance; route vocabulary exists (types.ts:21) | `src/lib/types.ts`, `src/lib/engine.ts`, `src/lib/codegen.server.ts`, `src/lib/packet.ts`, `src/lib/vault.ts`, `src/lib/io.ts` | keyed artifacts name the real producer (model id actually served, or "deterministic"); deterministic never model-stamped; packet+vault render the stamp; old projects load with no fabricated provenance (types.ts:187 law) | extend `src/lib/io.test.ts` + `src/lib/packet.test.ts` + `src/lib/codegen.server.test.ts` (all exist); targeted runs | S | — | lane (Phase 5) | TODO |
| **T5.5** | plugin / hook registry v1 (in-process only) | 217c §2.5; 103 A16; mock-provider doctrine (explicit selection only) is the precedent; dynamic loading = UNKNOWN until the trust question is reconciled | **NEW** `src/lib/plugin.ts`(+test), seam call-sites in `src/lib/engine.ts`, `src/lib/codegen.server.ts` | explicit registration only; deterministic hook order; state-writing hooks route through `evaluatePolicy`; no "sandboxed plugin" language anywhere | new `src/lib/plugin.test.ts` (new module; repo's pure-suite pattern) | M | isolation outcome recorded (T-107.8 settled) | lane (Phase 5) | TODO |
| **T5.7** | deterministic LLM cassette (record/replay) | 217c §2.6; 103 A8; chokepoint exists (`registry.ts:396 callModel`); mock = injection half only | `src/lib/llm/providers/registry.ts` (seam) or **NEW** `src/lib/cassette.ts` (absent today **[me]**), `scripts/run-eval.mjs`, CLI flags + tests | recorded tape replays byte-identically with no network, identical maker scores; a miss = coded refusal (never fabricated text); off by default — existing suites and keyless `npm run eval` byte-identical | new unit round-trip + hash-key + miss-refusal tests; `npm run eval` keyless run stays byte-identical | M | T5.4 (replay labels need provenance) | lane (Phase 5) | TODO |

### E. Loud defects + truth fixes (verified open; each row's evidence names the audit that proved it)

| id | title (≤12 words) | why (evidence) | files | done-when | verification command (exact) | size | deps | owner | status |
|---|---|---|---|---|---|---|---|---|---|
| **DF-09** | approval needs no note — even over a failed gate | 219b §1.1 (DF-09, loud) **with WD-A C3/C4 applied**: note field `engine.ts:1631`, write `engine.ts:1663`; no caller passes one (store.ts:1529-1534; console.tsx:1838-1841); rejection alone carries the ≥12-char guard (store.ts:1547); corroborated by fixes/123 CG-16 | `src/lib/engine.ts`, `src/lib/store.ts`, `src/components/console.tsx` | an approval over a failed/overridden gate cannot be recorded without a rationale (mirror the rejection guard; the autopilot path at engine.ts:3550 shows the existing note pattern) | **MISSING** — no probe/test for this guard exists in the record; what's missing: a defined check before dispatch (candidate held back as suggestion: extend `src/lib/honesty-guards.test.ts`; defect proof command: `grep -n "note:" src/lib/engine.ts`) | S | — | lane (next wave) | UNVERIFIABLE-NOW |

> [AUD-2 · 2026-09-24] CORRECTED (DF-09 `why` anchor): "note field `engine.ts:1631`" → the `note?: string` field is at **`engine.ts:1629`**; `engine.ts:1631` is `force?: boolean;` (both inside `approveHitl`, defined at `:1625`; the write `note: opts?.note` at `:1663` is exact). The misanchor originated in WD-A's C3 marker and propagated here; every other DF-09 reference verified exact today (`store.ts:1529-1534`, `:1547`; `console.tsx:1838-1841`). — evidence: `awk 'NR>=1628 && NR<=1633' src/lib/engine.ts` + `grep -n 'note?: string' src/lib/engine.ts` (single hit, :1629), read by AUD-2 2026-09-24. (by AUD-2)
| **DF-18** | scorecard's template-estimate caveat dropped in UI | 219b §1.1 (DF-18, loud); packet carries the caveat (`packet.ts:498`); `ScorecardBlock` renders none (console.tsx:3303-3362); grep = 0 **[me: 0 today]**, WD-A L2-6 | `src/components/console.tsx` | `ScorecardBlock` renders the caveat ("deterministic feasibility estimate — template-derived, not live research") | `grep -cE 'feasibility\|template-derived\|not live research' src/components/console.tsx` → ≥ 1 (0 today) | S | — | lane (next wave) | TODO |
| **DF-26** | packet truncation invisible in the console | 219b §1.1 (DF-26, loud); hard truncate 14 000 + `TRUNC_MARKER` (`packet.ts:17,545-569`); console grep TRUNC = 0 **[me: 0 today]**, WD-A L2-5 | `src/components/console.tsx` (+ sections-cut accounting) | console banners/accounts for truncation; no downstream agent silently loses the packet tail | `grep -c TRUNC src/components/console.tsx` → ≥ 1 (0 today) | S | — | lane (next wave) | TODO |
| **DF-04** (residual) | P7 artifact still claims MCP/A2A with no disclaimer | 219b §1.1 DF-04 residual; `engine.ts:922`; no MCP module exists (`ls`/grep → 0); grep **[me: 1 hit today]** | `src/lib/engine.ts` | the P7 line is struck or carries the B-18-style label (pattern: `phases.ts:33`) | `grep -c 'MCP/A2A' src/lib/engine.ts` → 0 (or read check that the claim is labeled) | S | — | lane (next wave) | TODO |
| **G4** | no emitted-tree error scan exists | 218 §3.4 assigned G4/G5 → W13; 219b §1.2 G4 (0 hits; "no emitted-tree error scan exists") | `src/lib/compile-check.server.ts` (or new scan module) | an emitted tree is scanned for error-handling signals and findings are reported (the TA-12-class signal) | **MISSING** — the scan itself + its test do not exist; what's missing: define the scan and its command/test at dispatch (218 §3.4 owns this) | S | — | lane (W13 carry) | UNVERIFIABLE-NOW |
| **G5** | emitted product carries zero RT_E codes | 219b §1.2 G5 (re-grep today by lane: every file 0) | `src/lib/codegen.server.ts`, `src/lib/scaffold.ts` | a fresh emit's generated code surfaces coded `RT_E_*` failures where it fails | fresh emit (CLI `emit`) then `grep -rc "RT_E" <tree>/src <tree>/tests` → > 0 (pattern from 219b G5) | S | fresh emit | lane (W13 carry) | TODO |
| **OV-9** | `productComplete` has no producer | 219c §2 gap 4 + rank 4 (`doctor.ts:167`; sole caller `headless.ts:3207` passes no `extra`; only a unit test can set the field — doctor.test.ts:81-92) | `src/lib/doctor.ts`, `src/lib/headless.ts` (+`doctor.test.ts`) | a real path can mint `productComplete` evidence; `doctor --tree` reflects it honestly | extend `src/lib/doctor.test.ts` (exists; latch semantics already proven at :81-92) + targeted run | S | — | lane (next wave) | TODO |
| **OV-12** | register still says isolation outcome "UNKNOWN" | 219c §5: `fixes/217c:592-595` drop-in slot still `[UNKNOWN at write time]` and `:19` still "awaiting W11-L2 host probe" — but 217b §2 settled it (no isolator) | `fixes/217c_phase5_spec_and_decision_register.md` | the drop-in slot records the settled result (ABSENT → Outcome 2 branch) | re-read the slot (`grep -n "PROBE RESULT" fixes/217c_...md`) shows the settled text | S | — | lane | TODO |
| **OV-13** | silent degrades → visible record rows | 219b §2 ranks 3/5/6: engine.ts:3012/:3030 (keyed narrative/constraint failures leave NO row — byte-identical to a deliberate keyless run); store.ts:573-578 (UI-path fallback catch comment-only); verify.server.ts:271-276 (unparseable case list indistinguishable from "no cases") | `src/lib/engine.ts`, `src/lib/store.ts`, `src/lib/verify.server.ts` | each site emits a warn/coded row like the G2 precedent (`engine.ts:3230-3246` `liveLayerFailureRow`); a degraded keyed pass is distinguishable from a keyless one | extend `src/lib/store.test.ts` + `src/lib/verify.server.test.ts` (both exist) with failure-row assertions; engine side mirrors the sealed-log pin pattern; targeted runs | M | — | lane | TODO |
| **OV-14** | `archProductComplete` computed but never surfaced | 219b §2 rank 4 (`dod.ts:232,:546`; consumers = `gates.test.ts` only — the "skip≠complete" distinction is invisible outside tests) | `src/lib/dod.ts`, `src/lib/packet.ts` (+tests) | the skip≠complete distinction is surfaced (packet and/or CLI) so a vacuous keyless pass cannot read clean | extend `src/lib/gates.test.ts` + `src/lib/packet.test.ts` (both exist); targeted runs | S | — | lane | TODO |
| **OV-15** | redTree banner unreachable from the CLI | 219a §5.2 finding F1: refusal text advises `redTree:"banner"` but no CLI flag can do it (`grep redTree` cli → 0; CLI passes only `{force}` :807; banner reachable only programmatically/run-eval) | `scripts/rapidtool-cli.mjs` | either a real flag/verb exposes banner-policy emit, or the refusal text stops advising an unreachable option | CLI probe on the red-trail project (219a's emit probe) + `grep -n "redTree" scripts/rapidtool-cli.mjs` | S | — | lane | TODO |
| **OV-16** | unmaterialised-job truth: doctor scan + emitted README | 219a §5.3 F2 (census `{0,0,0}` `files:[]` with no visible cause for non-materialised jobs) + §5.2 F4 (emitted README's "What ships" table lists files that do not exist while line 97 says they were never materialised) | `src/lib/headless.ts` (doctor scan path), `src/lib/scaffold.ts` (README generation) | `doctor --tree` surfaces the unmaterialised cause; the emitted README cannot list non-existent files unflagged | `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --tree <tree>` (real) + re-emit + `src/lib/scaffold.test.ts` targeted | S | — | lane | TODO |
| **OV-17** | README Quickstart commands are BROKEN | 219a §3 rows 6–7: `new` → `Unknown subcommand` (exit 1); `--until-hitl` exists only at README.md:37; real verb is `create --brief`; the park verb is `gate` | `README.md` | the Quickstart block's commands work as written (probe them) | run the Quickstart block's commands against a scratch dir (219a's probes are the reference) | S | shares README.md with TA-3 | lane | TODO |
| **TA-21** | P9 deploy artifacts unlabeled | 219b §1.5 r13: P9 emits canned GitHub-Actions YAML + GCP/Firebase sketch (`engine.ts:1026-1055`) with no "template — not executed" label; HITL text says "templates" | `src/lib/engine.ts` | P9 artifact bodies carry the template/not-executed marker | read the emitted P9 artifact text + `grep -n 'IaC sketch\|GitHub Actions workflow' src/lib/engine.ts` | S | — | lane | TODO |
| **OV-18** | clamp marker truncates at custom caps ≈64–118 | 217b §1.4 E1 + 218 §3.3 (registered, not fixed; no production impact at the real 48 000 cap; window deliberately unpinned) | `src/lib/node-runner.server.ts`, `src/lib/honesty-guards.test.ts` | caps in the window elide with an intact marker + honest `elidedChars`; the window is pinned | extend `src/lib/honesty-guards.test.ts`; `node --experimental-strip-types --test --test-concurrency=2 src/lib/honesty-guards.test.ts` | S | — | lane | TODO |

> [IMPROVER · 2026-09-24] EVIDENCE-ADD (OV-13): the catch sites read today are `engine.ts:3011` and `:3029` (comment-only bodies `:3012`/`:3030`), `store.ts:574` (comment `:575`), plus `verify.server.ts`; the row shape to copy is `liveLayerFailureRow` at `engine.ts:3232` with its `LIVE_FAILURE_MESSAGE_BUDGET = 160` clip at `:3230` — a warn row, never a throw. — evidence: `grep -n "narrative unavailable|constraints unavailable|liveLayerFailureRow" src/lib/engine.ts` + `sed -n '565,585p' src/lib/store.ts` (read today). (by PLAN-IMPROVER)
> [IMPROVER · 2026-09-24] EVIDENCE-ADD (OV-15): the unreachable advice is a hard-coded refusal string at `headless.ts:1399-1408` (message `:1405` "…or emit with redTree:\"banner\"…"); today `grep -n 'redTree' scripts/rapidtool-cli.mjs` = 0 **and** `grep -n 'banner' scripts/rapidtool-cli.mjs` = 0; the banner policy is reachable only through the driver (`headless.ts:1746-1747` notes run-eval passes "banner"). Both fixes (amend the message, or add the flag) now have exact anchors. — evidence: `grep -n "redTree|banner" src/lib/headless.ts` + the two CLI greps (read today). (by PLAN-IMPROVER)
> [IMPROVER · 2026-09-24] VERIFY-ADD (OV-16): `doctor --tree` is a real flag — the `args.tree` branch sits at `scripts/rapidtool-cli.mjs:2767` inside `case "doctor":`, so the row's probe command needs no change; cite `:2767` in the lane brief. — evidence: `grep -n "args.tree" scripts/rapidtool-cli.mjs` (read today). (by PLAN-IMPROVER)

### F. Owner decisions (stated, not taken — these are DECISIONS, not dispatchable work)

| id | title (≤12 words) | why (evidence) | files | done-when | verification command (exact) | size | deps | owner | status |
|---|---|---|---|---|---|---|---|---|---|
| **T-107.8** | isolation executor: confirm Outcome 2 (claim stays frozen) | 217b §2 settled the host probe: docker/bwrap → 127, WSL 0 distros → **NO isolator**; 217c §4: Outcome 2 is the only available branch; `sandbox-policy.ts` frozen claim stays | `src/lib/sandbox-policy.ts` (unchanged), `src/lib/node-runner.server.ts` | decision: confirm Outcome 2 (keep the frozen claim; narrate un-isolated runs plainly where execution is narrated) | — until decided; probe record: `fixes/217b` §2 raw capture | — | host change (Docker/VM) for Outcome 1 | OWNER-DECISION | OWNER-DECISION |
| **OV-10** | is "human-approved fixtures" the right bar for "autonomous"? | 219c §6 rank 6 (the latch certifies "autonomous" via `humanFixtures` — a human artifact; doctor.ts:220,:185) | `src/lib/doctor.ts` | owner decides the intended bar; if human-fixtures stays, say so where the claim lives | — until decided | — | doctor.ts semantics | OWNER-DECISION | OWNER-DECISION |
| **OV-11** | make the red seal teach (smallest loop closure) | 219d smallest upgrade + WD-B scope correction: ~6 call-site lines PLUS ≈4 `LessonSurface` seam lines (engine.ts:63-67/68-108); T-11 was a deliberate decision → needs owner sign-off | `src/lib/engine.ts` (:1464-1495 branch; seam :68-108), `src/lib/knowledge.ts`, `src/lib/lesson-writers.test.ts` | a red seal mints ONE `gate-unmet` lesson row carrying `probe:<id>` tags; `selectLessons` returns it; the T-11 "0 lesson rows" pin is deliberately updated | `node --experimental-strip-types --test --test-concurrency=2 src/lib/lesson-writers.test.ts` (updated) + a `selectLessons` probe | M | owner sign-off | OWNER-DECISION | OWNER-DECISION |
| **D-1** (**T5.6**) | TS-only boundary: declare it, or build multi-language? | 217c §3 D-1 (the boundary "is NOT stated anywhere"; README grep for multi-language/Python/tenant → 0) | `README.md`, `AGENT_GUIDE.md` | Option A (recommended, S): a posture line states the TS-only boundary (+ optional doc-contract test); Option B (L) = language registry — multiplies the isolation surface | — until decided; 217c §3 names the Option-A shape | S | owner decision | OWNER-DECISION | OWNER-DECISION |
| **D-2** (**T5.8**) | local-first posture statement (auth stays latent) | 217c §3 D-2 (10 auth modules + a migration exist; README auth/tenant posture absent; 94:201 acceptance unmet) | `README.md` | Option A (S): README states the local-first single-tenant posture honestly; Option B (L) = accounts/storage | — until decided | S | owner decision | OWNER-DECISION | OWNER-DECISION |
| **T3.6** | `format:check` + verification wiring (needs user consent) | remainingwaves rule 4 + board §6 rule 7: `.hermes/environment.json` puts write-mode `npm run format` in the test phase — do NOT run `hermes verify` as-is | `package.json`, `.hermes/environment.json` (needs user consent) | a `format:check` script exists and verification uses it (never `prettier --write .`) | post-approval: `npm run format:check`; **do not run the current recipe as-is** | S | user consent | OWNER-DECISION | OWNER-DECISION |

**Row count: 42 (24 existing-id rows + 18 OV rows).** Statuses used: TODO ×27 · BLOCKED-KEY ×3 ·
OWNER-RUN ×2 · OWNER-DECISION ×6 · UNVERIFIABLE-NOW ×3 (DF-09, T4.3, G4 — each states what's missing) ·
RESEARCH-ONLY ×1. No row rests on a claim a watchdog contradicted unless its `why` cites the
correction (the corrected fact).

---

## §2 · DO-NOT-REBUILD LIST (DONE-VERIFIED — never re-implement; proof cited)

A future wave must not burn budget re-landing these. Each line: capability → proof (record + anchor).

| capability / fix | DONE-VERIFIED proof |
|---|---|
| `patch.ts` `str_replace` primitive + `edit` verb (dry-run default, policy seam, ledger row) | 219e row 15; `patch.test.ts` 21 `it(` (219a r18); CLI `edit` :1135; wired as opt-in repair level `codegen.server.ts:2055` — 219b §1.5 r16 |
| one-seam policy engine (default-deny, type-enforced fallback) | `policy.ts` 245 lines; `policy.test.ts` 27 `it(` (219a r19); every approval routed — W6 badge (headless 90/90) |
| run-side graders + trials/pass@k + leak scan (T-107.5) | 216q COMPLETE; 6 grader JSONs under `research/eval-corpus/graders/` **[me]** |
| compaction constants (T-107.9) | 216v written; `compaction.test.ts` green in suite (W7: 19/19 repaired by parent) |
| verify-kind real install leg (T4.1/TA-16) | 216z L3; W11-L1's install-leg tests; honesty-guards pins `install.mocked===true` |
| emitted `.gitignore` (T4.2 half / TA-17 half) | W11-L5 landed; `scaffold.ts:491,2480` (219e) |
| 48 000-char runner output clamp, redact-then-clamp, envelope-only-on-clamp | 216z L2; `node-runner.server.test.ts` 12/12 (217b E5); honesty-guards pins the identity |
| T-11 half 1 (red seal mints no lesson; `p<phase>.seal.unmet` warn) | 216z L1; 217b §1.1 re-ran the probe byte-identically; `lesson-writers.test.ts` (15 after repair) |
| T-11 half 2 (`probe:<id>` tags wired) | F1 FIXED — spread at `knowledge.ts:952`; `honesty-guards.test.ts` **5/5 green** (219b §1.3; WD-A) |
| T-107.6 ledger core (cache fields, `TokenBudget` seam, `estimateCostUsd`, byte-identity of legacy shape) | 216z L2; `token-ledger.test.ts` 23/23 (217b E4) |
| T-18 `tree-run` = the tree's own typecheck+test+build; fail-closed `ok` | 216l; `compile-check.server.ts:939,:1036`; README.md:93 verified true (219b §3) |
| TA-15 multi-job emission through the real scaffold path | W8 acceptance: census `{stubs:0, reexports:0, real:3}`; 216k; job-bridging removed for tree-covered projects (`scaffold.ts:2534-2544`) |
| G1, G3, G6 fixes + G2 engine half + G7 documented | 217b §4 → W12 lanes A/B; G1 re-probed by parent (stderr 0 B); `errors.test.ts` 34/34 |
| F1/F3/F4 fixes (probe tags; 216z strike; W11 README citation) | 219b §1.3; all three FIXED with commands |
| T-04/T-05/T-06/T-07/TA-2/T-13/T-14/T-17 | 219b §1.4–1.5: landed; `scaffold.test.ts:756/803/887` pins; `phaseCoverage` live; assertion-gap lint in gate.sh |
| DF-01/02/03/05/06/13/15/16/36 (FIXED rows) | 219b §1.1 — each with today's bytes read; do not reopen |
| eval driver + M1–M9 rubric + corpus + results (T5.3 substrate) | 217c "DONE-today" #2; `maker-score.ts:2`; 6 fixtures + 6 graders **[me]** |
| fixtures draft/approve backend + human-only doctrine (T5.2 substrate) | 217c "DONE-today" #1; `brief-fixtures.ts` doctrine; CLI `fixtures` :879 |
| mock provider = deterministic injection half of T5.7 | 217c "DONE-today" #3; `mock.ts` 189 lines; never in `PROVIDERS` |
| HITL seat machinery (actor seats + `RT_HUMAN_SEAT_TOKEN`, never bare `decidedBy:"human"`) | TA-2/216e; headless.ts:736,:730; run-eval comment; CLI probe matrix |
| W11/W12 UI landings (RUN_TABS tiers, Export menu, focus ring, `PROJECT_STATUS_LABEL`, `uiNextAction`) | 218 §1/§2; console.tsx:103-119,:1501,:2488; styles.css:133 |
| MCP/A2A as *contract artifact* + DoD probe (runtime client is the gap — T5.5/OV-6) | `types.ts:27`; `dod.ts:428-430`; `phases.ts:33` declaration |
| six handoff profiles (`exportProfiles` exists; wiring is the open gap DF-25) | `packet.ts:660`; test-only importer — 219e row 10 |
| legacy scaffolding is NOT the contract (`.grok/`, `server/`, `scripts/grok-pwa-*`, `startup.sh`) | AGENTS.md "Legacy scaffolding — do not build on it" |

> [AUD-2 · 2026-09-24] CORRECTED (this §2 table, T-11 half-1 row): "`lesson-writers.test.ts` (15 after repair)" → the suite is **18 tests, 18/18 pass** today; the "15" figure is stale (later waves added cases). — evidence: AUD-2 ran `node --experimental-strip-types --test --test-concurrency=2 src/lib/lesson-writers.test.ts` 2026-09-24 → `# tests 18 / # pass 18 / # fail 0`; strict count `grep -oE '(^|[^a-zA-Z_])it\(' src/lib/lesson-writers.test.ts | wc -l` = 18. (by AUD-2)

---

## §3 · SEQUENCING GRAPH (text; every arrow names its dependency; cycles flagged, none found)

**The spine (219e §4's shortest path to the 10/10 maker test):**

```text
T0.10 keyed run #1 (OWNER-RUN, needs key)
  └─▶ unblocks { OV-3 (M2), OV-4 (M3/M4), OV-5 (M9/M7) }        [why: W15 lanes read Step 0's log; without it they degrade to a diagnosis memo]
        └─▶ { OV-3, OV-4, OV-5 } all → unblock OV-8 (keyed run #2)   [M7 needs run #1's row as baseline; zeros must close first]
              └─▶ OV-8 → unblocks the evidence-gated claim flips (README/doctor wording only in the same commit as results.json)
                    └─▶ then the M-A acceptance on the artifact: emit C2H → `doctor --tree` = {stubs:0, reexports:0, real≥3} → `tree-run` ≥3 job oracle rows → hand over (remainingwaves:25)
```

**Independent spines (no Step 0, no key, no decision required — 219e: "W14 all files free; independent of Step 0"):**

```text
OV-2a fix scripts/browser-guard.mjs → OV-2b first smoke run → fix/register findings   [guard blocks the run; WD-C C7]
T5.4 → T5.7                    [replay labels depend on artifact provenance — 217c §2.6 item 3]
OV-1 → (later, out of scope) cross-family judge TA-14   [needs ≥2 provider families — 219e blocker 5]
T5.2-A + OV-9 → M-B latch      [plus a human click, the keyed multi-job artifact, and the OV-10 answer]
TASK-01, T5.3, TA-3/OV-17, T-107.6, DF-18, DF-26, OV-13, OV-14, OV-15, OV-16, OV-18, OV-12: no deps — free lanes
T-107.7, T4.2, T4.3, OV-6, OV-7, TA-21, DF-04, G5: no deps — free lanes
```

**Decision-gated (each gates only what it says; no downstream fan-out):**

```text
T-107.8 → Outcome-2 confirmation → OV-12 records it → T5.5 v1 scope is thereby settled (in-process only)
OV-11 (red-seal sign-off) → its ~6+≈4-line change + updated pin
D-1 → its S doc line;  D-2 → its S README posture;  OV-10 → latch wording;  T3.6 → format:check wiring
```

**Cycles:** none found. Near-cycles checked and cleared: T5.7 ⇄ T5.4 (labels) is one-way only;
G5's re-emit does not depend on the keyed run (keyless emit works — 219a §5.1); OV-2's smoke needs
only `npm run dev`, not any key.

**Boundary discipline (unchanged, cited):** any wave closing any of these rows must end at a parent-only
`bash scripts/gate.sh` → `{"ok":true}` (218 §5 baseline), with the board's §7 changelog appended
(taskuniverselog §6 rule 2).

---

## §4 · RECONCILIATION TABLE (every disagreement found; winner + why; unresolved said so)

| # | claim A (source) | claim B (source) | winner | why |
|---|---|---|---|---|
| 1 | "HEAD aa12c6c, tree dirty" (219a §0; 219b header; 219e §0 variant) | committed clean at `7582771` (11:15:16) | **B** | WD-A C1/C2 + WD-C C6: true-when-measured (11:14:58), stale-when-written; `git reflog` HEAD@{0} = that commit; no ` M` on src/scripts after |
| 2 | "`note: opts?.note` at engine.ts:1650" (219b ×2) | field :1631, write :1663 (WD-A C3/C4) | **B** | WD-A read the bytes; :1650 is `const next = Math.min(12, …)`; I re-checked :1663 today **[me]** |
| 3 | runner anchors `:60`/`:78`/`:66-68` (219c §5) | `:57`/`:74`/`:49`,`:53` (WD-B) | **B** | WD-B read `node-runner.server.ts`; values/substance unchanged |
| 4 | `grep STOCK_HITL` "hits only headless.ts:346,370 + phases.test.ts" (219c §4) | full set includes `phases.ts:151` + `store.ts:20,382,399`; zero in `engine.ts` (WD-B) | **B** | WD-B re-ran the grep; the load-bearing point (no STOCK_HITL check in `wildApproveGate`) stands; I re-verified 0 in engine.ts **[me]** |
| 5 | `edit --write` is "policy/human-gated" (219d repair loop + bottom line) | policy-gated but NOT human-gated (`policy.ts:98`, `:223-225` allow autopilot seat) (WD-B) | **B** | WD-B read policy.ts + CLI; machine repair reach is LARGER than 219d stated |
| 6 | smallest upgrade "~6 lines" (219d) | ≈+4 `LessonSurface` seam lines beyond the ~6 (WD-B) | **B** | `engine.ts:63-67` forbids the static import; seam addition required — carried in OV-11 |
| 7 | bolt.diy 21 providers (219e §2 row 9; dossier 108) | 22 on the clone (219f + WD-C C5) | **B** | `ls …/providers \| wc -l` → 22, counted twice |
| 8 | W14-L4 verify `--url/--out-png` (219e plan table) | positional args + Windows path guard unsatisfiable (WD-C C7) | **B** | WD-C reproduced by calling the real module; L4 re-scoped in OV-2 (guard fix first) |
| 9 | SWE-agent `run()` :339 (219f §2.1) | :390 (WD-C C1) | **B** | grep re-run: 237/239 abstract, 328 step, 390 run; :339 is the cost-limit text |
| 10 | opencode `subagent-permissions.ts` under `src/permission/` (219f §2.7) | under `src/agent/` (WD-C C2) | **B** | `find` shows the file in `agent/`; `permission/` holds arity/evaluate/index only |
| 11 | cline "5 colocated `McpHub.*.test.ts`" (219f §2.11) | 7, in `__tests__/` (WD-C C3) | **B** | `ls` of the subdirectory; parent dir has none |
| 12 | "Dyad stops at tsc" (219f §2.5/§3-L1) | Dyad ALSO runs Playwright against a running preview (WD-C C4 addendum) | **B (scope-narrowed)** | `tests_handlers.ts` :126/:215/:252; RapidTool's lead = artifact-own-toolchain headless vs browser-E2E-needs-running-app |
| 13 | fixes/217c §4 drop-in slot: isolation probe "UNKNOWN at write time"; §0 "awaiting W11-L2 probe" | 217b §2: NO isolator on this host (settled) | **B (settled)** | 217b ran the probes (docker/bwrap 127; WSL 0 distros); the register was never updated → OV-12 fixes the doc |
| 14 | 218 §3.5 "still owes 5 anchor spot-checks" | 218 §2.6 "DONE by the parent" | **§2.6** | 218 §3.5 item says it was corrected in place; 219b §1.4 r5 re-verified 2 anchors ("internally inconsistent doc", resolved) |
| 15 | residual "JSON-parse → RT_E_UNKNOWN" as a G3 defect (old probe) | all 7 G3 families genuinely fixed for real error objects (WD-A §0) | **B — do not chase** | WD-A's direct classifier test: the legacy probe passes strings (no `.name`); string-input artifact, not a defect |
| 16 | README.md:9/:80/:101 + AGENTS.md "34 verbs"; CLI USAGE 34 keys | 35 case labels on disk; README-cli.md:10 already says 35 | **disk (35)** | `grep -c 'case "'` = 35 **[me]**; USAGE missing `diagnose` is a second, separate drift → TA-3 |
| 17 | 217c T5.1 test instruction "beside `chat.server.test.ts`" | `chat.server.test.ts` does not exist; the suite is `chat.test.ts` | **disk** | checked on disk **[me]**; same phantom-name class WD-C flagged for W14-L2 (chat/crew `.server` test names) → T5.1 verify cell uses `chat.test.ts` |
| 18 | 219a F3 "the bundled artifact has no `p6.jobs.shortfall` row" | T-13 mechanism landed (`engine.ts:1336-1364`, caller :1497-1499) | **both true — reconciled** | the artifact predates the mechanism; re-materialisation happens only via a fresh keyed run (216k:186) → covered by T0.10/OV-8, not a code defect |
| 19 | 219e "OpenHands runs replay step-by-step" (from dossier 90) | not verifiable from the clone (Agent Canvas frontend only) (WD-C §4 r4) | **cannot settle from clones — dossier-90 citation stands** | do not attribute the claim to the clone; flagged, nothing struck |
| 20 | RESUME §4 housekeeping: "write `fixes/216b_oracle_floor.md` (lane B's T-08 log — **never written**)" | board §2.8: "✅ WRITTEN (W2-R1, 85 lines)"; file exists | **board** | `fixes/216b_oracle_floor.md` is present on disk **[me]**; RESUME's note predates W2-R1 — no work item here |

---

## §5 · THE FIRST 48 HOURS (unblocked now; no key, no owner decision; verifiable per lane; ordered by leverage)

1. **TASK-01 — `nextAction` wire contract** (M; 219b, 218 §3.1). Carried twice; the only named piece of
   the machine-side contract still absent. Verify: headless.test.ts + grep (both real).
2. **T5.3 — `eval` verb** (S; 217c §6 ranks it #1 of Phase 5: the corpus IS the maker-test fixture
   family). Cheapest step that puts the M1–M9 score in a driving agent's hands.
3. **OV-2 — first browser pass (guard fix first)** (M; retires 218 §4's "nobody has looked at these
   pixels"). Needs only `npm run dev` + the guard fix WD-C already reproduced and located.
4. **TA-3 + OV-17 — README/doc truth** (S+S; same files). 35 verbs, USAGE `diagnose`, AGENTS counts,
   and the broken Quickstart — all grep/probe-verifiable in one lane.
5. **DF-18 + DF-26 — console honesty bundle** (S+S; same file `console.tsx`). Two "loud" mislabels
   with flip-greps as checks (both 0 today, re-run by me).
6. **T5.2 half A — fixtures review UI** (M; reuses the landed `approveFixtureCases`; the human seat is
   what makes a "functional" claim honest — 219c rank 3).
7. **OV-13 — silent-degrade rows** (M; the class the owner treats as the worst failure: a keyed model
   failure currently reads byte-identical to a deliberate keyless run).
8. **OV-12 + OV-15 — quick truth fixes** (S+S; register drop-in slot; the unreachable `redTree:"banner"`
   advice). Both tiny, both declare-or-strike-shaped, both verifiable immediately.

**Excluded on purpose:** anything needing the key (T0.10 → OV-3/4/5/8 — `BLOCKED-KEY`), anything
needing an owner decision (the §1 F rows), and **DF-09** (real and loud, but its verification must be
defined before it can be dispatched — see the row).

---

## §6 · COVERAGE PROOF (every input document accounted for) + CUTS + HONEST LIMITS

### (a) Coverage — what was taken from each input

| input | what this list took from it |
|---|---|
| `wave_plans/W13/wd-d.md` | the schema, status vocabulary, six-section shape, the do-not-rebuild / sequencing / reconciliation / 48-h / coverage requirements, and the no-invention rules — followed throughout |
| `219a` (inventory) | 35-vs-34 verbs + USAGE drift (TA-3); Quickstart broken (OV-17); emit censuses `{0,2,1}`/`{0,0,0}`/`{0,5,0}` (context for OV-16 + do-not-rebuild); findings F1 (OV-15), F2+F4 (OV-16); module inventory (used for do-not-rebuild) |
| `219b` (defects) | the DF ledger (DF-09/18/26 carried; DF-04 residual carried; the fixed set → do-not-rebuild); G1–G7 (G4/G5 carried); F1–F4 statuses; §2 silent hits (OV-13/OV-14); §1.4 r1 (TASK-01); §1.5 statuses (program cross-check + cuts) |
| `219c` (autonomy) | the latch decode + the two unminted gaps (T5.2-A, OV-9); ranks 1/5/6 (T0.10 rationale, T-107.8, OV-10); the register-staleness finding (OV-12); the run trace (why BLOCKED-KEY semantics for OV-3/4/5) |
| `219d` (self-improvement) | the loop's hop-6 gap (limits + rationale for not listing it as work); the repair-loop reality (offsets OV-11's scope); the smallest upgrade → OV-11 (with WD-B's seam correction) |
| `219e` (gap + plan) | the entire program structure: Step 0 (T0.10), W14 (TASK-01, T5.3, T-107.6, OV-1, OV-2, TA-3), W15 (OV-3…OV-6, T4.2), W16 (T-107.7, T4.3, OV-7, OV-8); §5 "what not to do" → do-not-rebuild + cuts; the shortest-path spine (§3) |
| `219f` (competitors) | B1 → OV-1 context; B2 → OV-6; licence flags (gpt-pilot FSL, Dyad `src/pro/` FSL) → cut-list hard rule; leads confirmed (treeRun, hard budgets, honesty) → do-not-rebuild |
| `fixes/219_wdA` | corrections C1–C4 (recon rows 1/2); the RT_E_UNKNOWN caution (recon 15); re-verified anchors used for rows' `why` |
| `fixes/219_wdB` | corrections (recon 3/4/5/6); upgraded flags (219c §7-iii emit verified; 219d nuance); OV-11's scope correction |
| `fixes/219_wdC` | 30 independent competitor checks + C1–C7 (recon 7–12, 17); the plan-step verdict table (every W14–W16 row's verification cell leans on it); the W14-L4 re-scope → OV-2 |
| `fixes/218` (W12 close) | §3 carries (TASK-01; F2 → OV-18; G4/G5 → rows); §4 "nobody has looked at these pixels" (OV-2); §5 gate numbers (baseline of record) |
| `fixes/216z` (W10) | T-107.6/T4.1/T-11 landing proof → do-not-rebuild; §4.3 no-dedicated-test debt → resolved-status noted; F2 origin (OV-18) |
| `fixes/217b` (W11 watchdog) | F1–F4 (all closed → do-not-rebuild pins); the isolation probe (§2 → T-107.8 evidence); E1 clamp window (OV-18); G-ledger + guard suite (pins cited) |
| `fixes/217c` (Phase-5 spec) | T5.1–T5.7 rows (specs, sizes, done-whens); D-1/D-2 rows; §4 isolation input (T-107.8); §6 priority ranking (48-h ordering); "DONE-today" #1–3 → do-not-rebuild |
| `taskuniverselog.md` | §2.x board statuses (cross-check); §5 owner items (T0.10); §6 rules (maintenance, `hermes verify` landmine → T3.6); §7 changelog (W10/W11 annotations; the TASK-01 decision record) |
| `remainingwaves.md` | milestones M-A/B/C (spine + latch logic); W10–W12 catalogue (T4.2/T-107.7/T4.3 provenance); the 8 standing rules (cited; rule 4 → T3.6) |
| `RESUME.md` §4 + §6.1 | backlog rows 1–19 cross-mapped (see cuts); §6.1 caveats (C-01, F-04/F-05, gpt-pilot worm note) → limits/cut-rule sources |
| `AGENTS.md` | honesty contract, 4-gate discipline, legacy-scaffolding rule (do-not-rebuild line), source layout (path facts) |

### (b) Deliberate cuts (reviewed, real, NOT carried here — and why)

| cut | why |
|---|---|
| Remaining open DFs: DF-10, DF-17, DF-19, DF-22, DF-23, DF-25, DF-27, DF-28, DF-30–DF-35, DF-38, DF-39 (+DF-29 unverified) | verified open in 219b §1.1 but **not in the W14–W16 program** and not owner-named; re-triage after the maker test; they remain one grep away in 219b. (DF-38's `eval`/`restore`/`plan` verbs partially overlap T5.3/T-107.7 — carried there.) |
| Old-board residuals: 109 family, 112 T5/T9/T11/T12, TA-5–TA-14, TA-19/TA-20/TA-22/TA-23, TA-17's `.gitignore` half (landed), 106 T-12 latency clause | not re-verified by this inquest (219b marks several stale/falsified); keep them on `taskuniverselog` §2.x rather than double-track here. TA-9/TA-10 (budget surfaces / unattended invocation) are product-decision-shaped → fold into the §1-F family when wanted. |
| T0.4 (P6 `reasoningEffort` assert) | 219b §1.5 r11: PARTIAL/UNVERIFIED — "the task's 'assert it for P6' is not evidenced"; needs clarification before it can be real work |
| T3.1/T3.2 judge rungs | blocked on a second provider family (OV-1 is step 1 only) — 219e blocker 5 |
| W16-L5 (wave buffer) | not a task (219e design) |
| Depth-2 doc debt: fold the `217h`/`217i` bodies in | no observable acceptance beyond the edit itself (218 §3.6); note: `fixes/216b` **exists** (board §2.8; recon row 20) — RESUME's older "never written" housekeeping note is stale |
| 219f B3/B4 (repo index; IDE surface; per-action allow-lists), competitor verbatim-copy | product-decision/distribution-shaped (219f §4) or forbidden-by-licence (gpt-pilot `**`, Dyad `src/pro/**`); noted, not tasked |

> [AUD-2 · 2026-09-24] CORRECTED (coverage — §6(b) as written is incomplete): three findings from the six dossiers have **no row and no cut line** in this file — (1) **no scheduler / daemon / queue** (219e axis 6, "OPEN-CLOSEABLE for scheduling"; 100 P1-02; `grep -ic 'scheduler\|daemon\|cron'` in this file = 0); (2) **outcome-attributed lesson ranking** (219d "what self-improving would require" item 5: `selectLessons` ranks on static `score`; `reproducedCount` recorded but never read — `grep -c reproducedCount` here = 0; note `221` F3 (12:06, after this file) now designs this, so a cross-reference may suffice instead of a duplicate row); (3) **patch-format breadth** (219f §6 handoff row — aider's 20 formats vs one typed primitive, "(a) engineering, low priority"; `grep -ic 'format breadth\|edit formats'` here = 0). Either add rows (OV-19+) or explicit cut lines. — evidence: dossier reads + the three greps, AUD-2 2026-09-24. (by AUD-2)

### (c) Honest limits of this canonicalisation

- Gate/test numbers are **taken-from** `fixes/218` §5 (never re-run; forbidden on this host).
- I ran **no** test runs and no keyed/browser/network commands — only read-only greps/ls/sed-class
  reads. Every `[me]` count above was produced today; everything else is traceable to the named
  dossier/WD/board line.
- Statuses are as of 2026-09-24, late morning; the board's rule holds — **if disk disagrees with this
  file, disk wins, and correct this file in the same pass.**
- The three `UNVERIFIABLE-NOW` rows are honest, not dead: each names exactly what would make it
  verifiable (DF-09: a defined check; T4.3: a defined preservation probe; G4: the scan + its runner).
- No competitor claim was re-verified here beyond the WD-C audit (219f's own §7 limits stand).

*End of WATCHDOG D deliverable. Read-only inquest; this file is the only write.*

> [PLAYBOOK · 2026-09-24] Execution guidance for every row lives in 230_task_execution_playbook.md (by PLAYBOOK-A).
