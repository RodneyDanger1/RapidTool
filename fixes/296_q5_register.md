# fixes/296_q5_register.md — W41 · LANE Q5 · THE REGISTER'S LAST WORD (row-by-row close)

**Lane:** W41 Q5 (`deleg_24919d27` task-4). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell `grep` only; keep one-liners SHORT).
**Contract:** verify vs CURRENT BYTES; land the smallest fix if safely fixable; else defer with the precise reason + TODO. Log `for <lane>` on any sibling-owned file. Log EARLY (this file), append after every batch. No gates, no keyed calls, no full runs.
**Baseline HEAD:** `ac6b151` (clean at lane open 04:0x; **went DIRTY mid-lane 04:24–04:26** — P1–P4 (`deleg_0f4ca363`) + Q1–Q8 (`deleg_24919d27`) LIVE, editing `console.tsx` · `engine.ts` · `io.ts` · `packet.ts` · `rt-events.ts` · `scaffold.ts` · `llm/providers/deepseek.ts` · `scripts/migration-plan.test.mjs`. **Q5 therefore landed ZERO code: every still-open row's target file is held by a live box or is owner/host-gated.** The table below is the final word on all 54 rows.)

## Sources read

- `research/multiagent/thoroughanalysis.md` §W27-WORKLIST (:1113-1305) — **the 54 rows W-01…W-54** (§A 4 · §B 25 · §C 15 · §D 10).
- `fixes/292_l1_register.md` (wave-coverage map + verdict — base; its W-26/W-35 verdicts not redone) · `fixes/273_t5_board.md` (T5's 24-row board) · `fixes/278_p1_remainders.md` (the 35-open list @W34).
- Post-P1 waves: `fixes/283_final_ledger.md` · `290_k1..k9` · `291_k10/k13/k14/k15` · `292_l1/l2/l3/w1–w5` · `293_m1–m3` · `294_n1–n6` · `wave_plans/W40/CONTINUE-PROMPT.md`.
- Live boxes at 04:06+ (manifests): **P1** F2 tail (packet/codegen/store/crew) · **P2** chat/UI tail (console/chat) · **P3** grader v2 + 4 kind fixtures + L3 items (run-eval/eval-corpus/fixtures*) · **P4** sweeps/docs (rt-events/K11 docs) · **Q1** §A1 five + clamp residue · **Q2** §A2 inventory · **Q3** W3 findings · **Q4** acceptance-truth (passesAcceptance/verification label) · **Q6** micro (io de-dupe/AGENT_GUIDE/README minors) · **Q7** model visibility (stamps/tap/registry/cache) · **Q8** OPS + exit-taxonomy.

## Legend

**LANDED** = verified vs bytes at `ac6b151` (or by L1/T5/K/L/M/N with bytes agreeing) · **PARTIAL** = named half landed, named residual open · **for <lane>** = residual sits in a LIVE sibling box (handoff, do not double-land) · **DEFER** = not safely fixable now: exact reason + TODO · **OWNER** = needs the funded key / host capability / owner ruling.

---

## THE FINAL CLOSURE TABLE — all 54 rows

### §W27-A · P0 (4)

| Row | Disposition | Evidence / reason + TODO |
|---|---|---|
| **W-01** | **LANDED** ✓ | `engine.ts:3935 wildP6Edge` + consumed `:4131` (`wildP6Edge` / injected `opts.p6Edge`); `wild-step.test.ts:233` — injected seam called exactly once, edge named. (E1b/W33, banked.) |
| **W-02** | **LANDED** ✓ | `headless.ts:2424 runP6Edge` + phase-6 call `:386`; mint pins `headless.test.ts:539-600` ("the lastTest the mint produces"; red gate must NOT mint tested `:491`). |
| **W-03** | **LANDED** ✓ | Emit-time materialization `headless.ts:1731` (`materializeImportableTree` at emit; non-idempotence guard documented `:1702-1711`). CJS→ESM resurrection closed. |
| **W-47** | **PARTIAL → OWNER** | `unattended` verb landed (CLI `:740`, usage `:18` "autopilot + live until parked"); policy seam consulted on approve (`:828/:851-856`). Residual: `wild --until` allow-list routing waits on W-43; the funded non-stock-gate E2E = **OWNER** (run#4). TODO: record the unattended E2E row after W-43 + funded run. |

### §W27-B · P1 (25)

| Row | Disposition | Evidence / reason + TODO |
|---|---|---|
| **W-04** | **PARTIAL → DEFER** | Landed: export-surface + call probe emitted (`scaffold.ts:1742-1750`, 216k D2). Open: probe still swallows non-ReferenceError throws ("any other throw is the real function behaving" — a throwing stub passes that call); no `p6-behavior` DoD row (`grep` 0); no capability tagging / "mint requires ≥1 executed capability assertion"; `p6-brief-fit` split absent. TODO(§R8-f03+A1-f03/04): assert call-does-not-throw + capability-tagged rows + `p6-behavior` row. codegen/scaffold held (P1/P3/Q4) → defer to the acceptance lane. |
| **W-05** | **LANDED** ✓ | `codegen.server.ts:3609` — `partialTreeRefuse` now sets `lastTest: null` ("Invalidate EXACTLY as treeUpgraded … only re-mint path stays mintTreeRunTested()"); pin lives in codegen suite. |
| **W-06** | **PARTIAL → DEFER** | Landed: honest partials — prior chunks' real files stay; `p6.synthesis.refused` names the refused chunk index (`codegen.server.ts:3282-3293` doc + `:2580`). Open: later chunks still abandoned on refusal (`return partialTreeRefuse` early-returns `:3385/:3410`); no "not-yet-attempted" capability state / refused-vs-never-reached census. TODO(§R3·A3-f03): continue later chunks w/ per-chunk refusal records + capability state + census. codegen held (P1). |
| **W-07** | **PARTIAL** | Route (2) chosen + landed: prompt keeps CJS ("Assign module.exports" `:521`); the materializer renders type-clean ESM at synthesis + emit (W-03). Residual: the §R3 doc-drift pin (prompt↔emitted contract) + keyed fresh-emit `npm run typecheck` evidence = **OWNER**. TODO: pin the prompt↔materializer contract; keyed emit typecheck at the funded boundary. |
| **W-08** | **LANDED** ✓ | `headless.ts:1802-1851`: driver-owned ghosts wiped + recorded (`wiped`), foreign → `RT_E_FOREIGN_FILES` refusal carrying the file list (`--force` keeps, list in payload). Emit-twice done-when met (second emit cleans its own ghosts; foreign never silent-deleted). Residual note: no `--clean-target` flag (the register's alternative; refusal carries names, not actions). |
| **W-09** | **LANDED** ✓ | `gate.sh:186-200` exit condition now includes `gates.testsScripts.ok && gates.testsLib.ok` + hardFails>0→1; no-TAP annotation `:164-178`; `scripts/gate-verdict.test.mjs` exists. CI file inherits (never executed — no push; noted, blocked-by-design). |
| **W-10** | **LANDED** ✓ | CLI fixtures approve routed through `evaluatePolicy("fixtures.approve")` (`:1312`), non-TTY refusal text `:821`, `decidedBy` provenance `:865`; approve/edit seat = `humanSeatClaim` two-channel + static guard `scripts/cli-exit-taxonomy.test.mjs`. Pins: cli-fixtures 4 + cli-edit 10 (283 ledger). |
| **W-11** | **LANDED** ✓ | `grep -rn "autonomous software agency" src/` → only rule comments (console.tsx:267, index.tsx:7); og/site.json + __root.tsx clean. (R6-f02.) |
| **W-12** | **LANDED** ✓ (docs) | README:183-196 re-derived census with dates + re-runnable commands: trial-1 `{0,4,1}` @2026-09-16 · fresh keyless emit `{0,4,1}` host `schedule.ts` @2026-09-26 · `{0,5,0}` vintage named. Residual: remainingwaves/taskuniverselog dated rows → **for p4** (K11 docs box live). |
| **W-13** | **PARTIAL → for q6/p4** | Landed: README .env/CLI honesty (`:117-119` "Headless CLI does not read .env"); N5 reworded AGENT_GUIDE §4/§5; guide:52 frames P6 as bounded template self-test. Open: guide has 0 "keyed" hits (keyed-synthesis story), README-cli knowledge examples, counts → Q6 (AGENT_GUIDE §4) + P4 (K11 docs) live. |
| **W-14** | **for p3 (LIVE)** | Machinery landed: `expectedKind` validation (`run-eval.mjs:349-357`), `capabilityCoverage` report `:2232`, N4 comment "behavioral + kind halves ride the same acceptance record" `:841`. Residual = grader v2 + kind-correct bars + behavioral supply — **P3 landing now** ("grader v2 + the 4 kind fixtures"). Do not double-land. |
| **W-15** | **for p3 (LIVE)** | Kind wiring landed (N1/K9): per-kind `package.json main/bin/exports/files` (`scaffold.ts:668-687`), `emitKindEntry :2142` + `emitBinLauncher :2232` + `emitViteConfig(kind) :1999`; TODO-stub replaced by real bridge (`:930+`, fixes/144 M2). Residual = the 4 missing-kind fixtures (game/cli/library/service) — **P3 landing now**. |
| **W-16** | **LANDED** ✓ | `handoff.ts:110 text()` + `vault.ts` junk-row skip; pins vault/handoff tests (P1 C1 + bytes agree). |
| **W-17** | **LANDED** ✓ | `openai-compatible.ts:499` — `noBalance = res.status === 402 \|\| /insufficient balance/i.test(refusalText)` → `RT_E_LLM_NO_BALANCE` `:504` (R4-f01 exact). |
| **W-18** | **LANDED** ✓ (store half) | `store.ts:1295` — `...(get().llmStatus.configured ? { enforceDod: true } : {})` on the commit path. Caption audited in the R6 copy pass. |
| **W-23** | **LANDED** ✓ | `packet.ts:192-194 isoFromMs` total render + clamp `:233/:519`; `store.ts:298 keepLiveWildRun` + call sites `:982/:1014/:1063/:1411/:1427`. |
| **W-24** | **PARTIAL → for q6** | Landed: io scorecard drop-to-null + `scorecard:dropped` notes (`io.ts:264-280`), coverage list `:503`; engine normalize research rows + item-level junk (`engine.ts:2312+`). Open: ONE shared `scorecardUsable` predicate + import≡hydrate parity pins (grep = 0). **Q6 (io de-dupe) live** → handoff. |
| **W-38** | **DEFER** | `store.runP6Journey` still has ZERO console callers (`store.ts:138/:1031` only; `grep Journey console.tsx` = 0). TODO(R1-f05+R6): wire "Run P6 journey" on the P6 card/RunScreen (honest keyless-refusal verbatim; budget label). console.tsx held (P2) — defer. |
| **W-40** | **LANDED** ✓ | Module + verbs + surface: `checkpoint.server.ts` (9,105 B, versioned/atomic/bounded), CLI `resume :697` + `unattended :740`, diagnose checkpoint `{present,path,savedAt}` (N5 item 2, banked `ac6b151`). K14 C1–C4 verified. |
| **W-41** | **PARTIAL → DEFER** | Lib leg + pins (`chatStreamNdjson`, chat.test.ts:1353+); console tooltip is HONEST ("provider transport is one-shot (stream:false) … no console stream pane … not yet incremental" :6824). Open: `chat --stream` (CLI grep 0) + incremental pane. TODO(§R8-f06/§R13-f07). |
| **W-42** | **PARTIAL → DEFER** | Cassette module + `producer:"replay"` provenance kind (`io.ts:64-66`) + copyUsage (N4 F6, banked); ZERO transport wrap + no run-eval `--record/--replay` (grep 0). TODO(§R8-f07): wrap `callModel` transport; record→replay byte-identity pair. |
| **W-43** | **DEFER** | `wildPolicy` / `applyPolicyOverlay` consumers / `paused_policy` = 0 (grep); overlay core + console render only (`fixes/267` :48 "engine consult explicitly out-of-box"). TODO(R8-f08/R13-f08): `Project.wildPolicy` + ONE narrow-only consult in `wildApproveGate` + `wild.paused_policy` row. |
| **W-48** | **PARTIAL-SHELL → DEFER** | `readWildPlan` (`engine.ts:3597`) + types (`types.ts:155-167`, honest "planner NOT wired, returns EMPTY plan") + store read path `:1604`. Open: real planning pass + classifier review + pause-unless-autoPlan + the "plan before phase-1 mutation" pin. TODO(§R13-f02). |
| **W-49** | **DEFER (host + OWNER)** | No isolator on this host; runner envelopes carry honest `sandbox:false`; claim frozen = correct honesty. TODO(§R13-f04): executor swap behind `node-runner.server.ts`, claim flips only when a probe proves it. |
| **W-50** | **PARTIAL → DEFER** | (c) DEPLOY.md emitted per-kind w/ E-27 stamp (`scaffold.ts:180`) + readmeBody row `:2349`; treeRun executes the emitted toolchain (leads the field). Open: (a) console preview pane (only design-token preview :5234/:5245); (b) isolation-gated E2E leg. TODO(§R13-f05/f13). |

### §W27-C · P2 (15)

| Row | Disposition | Evidence / reason + TODO |
|---|---|---|
| **W-19** | **PARTIAL → for p4** | Artifact half landed: `hardDodBlockInto` (`dod.ts:1024+`) stamps a "Hard DoD block" docs artifact carrying unmet ids + evidenceHash (dedupe on re-block `:1064-1069`) + pause. The register's exact `gate.blocked` rt-events row: NOT present (grep 0). **P4 (rt-events settlement) live** → handoff: register+emit it there, or record the artifact surface as the accepted shape. |
| **W-20** | **PARTIAL → for q7** | Served-model provenance landed for codegen artifacts (`modelRouteForServed :2758`, `modelProvenance :2681`; pins codegen.server.test.ts:2888/:2902 "unnamed served model yields NO stamp — fail closed") + provider call tap records served ids (`providers/deepseek.ts:613+`). Open: `llm-tasks.ts:127/:157/:188` still request `deepseek-v4-pro`; engine live stamp `:3021-3028` branch. **Q7 (stamps/tap/model visibility) live** → handoff: thread served id into the live stamp + fake-seam pin. |
| **W-21** | **LANDED-CORE** ✓ | `sessionTokenBudget()` singleton + defaults (`codegen.server.ts:2515/:2537`) + verify budget supply (`headless.ts:3268`); codegen.server.test.ts:1726. Records: node-runner seam scoped OUT (WD-Z), chat/crew seams → **for p1** (F2-10 crew budget seam = P1's live box). |
| **W-22** | **LANDED** ✓ | `busyAction` union carries `"module"` + latches wired (console.tsx:2863 spinner/disabled; 283 ledger). |
| **W-25** | **PARTIAL (bundle)** → split by item | (a) ✓ liveDegradeRow rows `engine.ts:3095-3126`; (b) ✓ `thinking` typed `llm.ts:93/:97/:121/:126`; (c) ✓ pre-wire refusal `providers/deepseek.ts:362-368`; (f) ✓ `kind===null` guard `:2943`. **Open:** (d) `POLICY_REASON_SEPARATOR` absent (`dod.ts:114` inline " — ") → DEFER (const + pin across writer/checker; needs the §R2-f04 shape); (e) packet loose `lastTest.ok` "pass" `packet.ts:652` + no `str()/rows()` helpers → **for q1** (packet live); (g)(h) silent catches (`upgradeP6Keyed :2964`, `runP6Real`) → **for q1** (engine live); (i) store live-degrade rows absent + no R2-f07 pins → **for p1**. |
| **W-26** | **LANDED** ✓ | L1-verified + banked (`be12c59`): streaming byte counter + tree-kill + coded bomb detail in `node-runner.server.ts`. |
| **W-27** | **PARTIAL → for q8/q6** | Landed: (a) guard EXISTS — `scripts/cli-exit-taxonomy.test.mjs` (N5/OPS-3, cites §R5-f03) + `respond` exit stamp (K13-verified); (e) README verifyKind posture REWRITTEN honestly — "flag rides inside `emit` (:1149) over `verifyKindDir` (:1566); 39 arms, none is verify-kind" (`README-cli.md:27-34`); (i) browser-guard win32 fail-closed (B11). Open: (b) eval "no writes" not narrowed (`:201`); (c) `balance-exhausted` resolver (grep 0); (d) `measurement:false` envelope arm verify (`:2540`); (f) `## Fixtures`/`## Eval` sections; (g) `--draft` predicate recompute; (h) valueless `--out` guards. **Q8 (exit-taxonomy completeness) + Q6 (README minors) live** → handoff. |
| **W-28** | **PARTIAL → DEFER** | `readmeBody` seam landed + rendered (`scaffold.ts:2338` / `:3130` w/ treeRows/oracleCensus/treeRefusals/jobScope; DEPLOY.md row included). Open: (a) host/bridge/unmaterialised row annotation; (b) emitted-UI min bar (A3-f07 TODO comment in bytes). scaffold held (P3/Q4) → defer. |
| **W-29** | **MOSTLY LANDED → (g) for p3** | (a) ✓ LOAD_LABEL rewritten ×3 (`fixtures.ts/server/review.ts`); (b) ✓ "bounded-runner" reword ×3 (`console.tsx:1523/:2087/:3931`); (c) ✓ "How it works" `:1744`; (e) ✓ autopilot caption "auto-approve eligible gates"; (f) ✓ `wildPaused` tone (`:1293`); (h) ✓ `PHASE_BY_ID` (`:2156/:3657`; N3 recorded the non-render derivation decision); (d) manifest recorded (N3). **(g) fixtures README fake row STILL MINTS** (`fixtures.ts:186-206` maps !ok fixtures to rows; loader `fixtures.server.ts:64-71` doesn't skip) → **for p3 (fixtures live)** — log per N3's standing "for n1/n2/n5" chain. |
| **W-30** | **LANDED** ✓ | `console.tsx:1481-1488` — `applyTheme` updates `meta[name=theme-color]` in-session (`#edf3f0`/`#0a0c0b`). |
| **W-33** | **DEFER** | `decideTransition`/`stopReasonFor`/`runIterationCeiling` absent (grep 0); ladder still 4 copies; `store.recordGate` twin unchanged. §R2-f06 = 3-step mechanical refactor + parity pins — too large for a closing lane. TODO: one lane owns the consolidation. |
| **W-39** | **MOSTLY LANDED → DEFER (2 residues)** | (a) ✓ rt-client finite guard `:274` (K4-verified); (d) ✓ `probe.ts` hostile-clock fixed (`safeNow :110-137`, `MAX_ECMA_TIME_VALUE`); **(b) OPEN** — caps apply at push only (`rt-ring.ts:115/:137-141`); `rtHydrate` builds rows without trimming to cap; **(c) OPEN** — import-boundary headers + guard test absent (`knowledge/write-set/ast-mine`; grep 0). Both low-reachability (P3). TODO: slice on hydrate; add the guard test. |
| **W-44** | **DEFER (OWNER execution)** | No `*mcp*` files (grep); contract artifact + hub precedents only. TODO(§R8-f11/§R13-f06): `mcp.client.server.ts` discovery-first + `mcp --discover` + coded refusals; say "discovery", never "support". |
| **W-45** | **PARTIAL-CLOSED → OWNER** | Failover chain landed (`registry.ts:293-303 FALLBACK_PROVIDERS_ENV_VAR` + `resolveFallbackChain`, T3/R8-f12; failover tests 7/7); probed-models machinery + per-provider `requestModelIds` validation. Residual = live verification (funded probe → verified descriptor; `RAPIDTOOL_PROVIDER=xai` + key evidence) = **OWNER**. |
| **W-46** | **DEFER (OWNER + keyed)** | Acceptance chain unrowed-in-practice; doctor pins keep `autonomousSoftwareFactory:false` (`doctor.test.ts:28-30`) — honest. TODO(§R8-f13): one acceptance lane after the funded run: two commands on the real artifact + hand-over kit + board rows quoting outputs. |

### §W27-D · P3 (10)

| Row | Disposition | Evidence / reason + TODO |
|---|---|---|
| **W-31** | **LANDED** ✓ | `countClaimOffenders` helper + fixtures (`README-cli.test.mjs:80` fn, `:171-176` stale-phrasing pins). |
| **W-32** | **DEFER (owner pick)** | `scripts/write-atomic.mjs` + its `.grok/skills/**` refs still on disk; descope-vs-realpath-fix is an explicit OWNER decision to record in 94§B1/AGENTS.md. TODO: owner ruling, then remove-or-harden together with its test. |
| **W-34** | **PARTIAL → DEFER** | Landed (N1): `vault.backlinksFor` 5 remaining cases (`vault.test.ts:845/:858`) + `minutesForPhase` null-id (`bench.test.ts:285`) + `stripStringsAndComments` pins (`:298+`). Residual (not located in bytes): async-tap regression pin (R4-f02 — `grep Promise.reject run-eval.test.mjs` = 0), H2 truncated-marker pins (`grep unfinished src/lib/*.test.ts` = 0), console test target. TODO: pin them at the next test lane. |
| **W-35** | **LANDED** ✓ | token-ledger guards: M1 landed, N1 re-verified — H1 probe `cases=73 throws=2` (both write-set by-design + now pinned); `tl.totalTokens-junk`/`recordSpend-junk` clean. |
| **W-36** | **DEFER (superseded)** | Root still carries 13 probe files incl. `probe_n2_f316.mjs` (committed `ac6b151`) + `probe_h1_libcrash.ts` — but those are now the H1/N2 **probes of record** (N1 log uses them; 294_n2 shipped one). The register's delete-list is superseded by live use; deletion would break rechecks. TODO(parent): boundary-time sweep once no lane references them; keep h3 vehicles. |
| **W-37** | **PARTIAL → DEFER** | Records LARGELY landed (finalsprint §T1–§T5/§WDX-2/3/§MASTER-CORRECTIONS; recorder ledger `292_w1` 52 KB). Register-named debts remain: `fixes/266_lane1..4_bugs.md` never created; §R3/§R6 never folded (`thoroughanalysis.md:1116` caveat intact). TODO: one recorder pass for 266 + the §R3/§R6 fold. |
| **W-51** | **DEFER** | eval lessons-injected vs modes-recurred per slug: absent (`run-eval.mjs` lesson mentions = lesson #5 text only). TODO(§R13-f10): per-slug lessons-injected/recurred + kill criterion in the eval output. |
| **W-52** | **PARTIAL → DEFER** | `HitlDock` exists (`console.tsx:3834`): prompt + evidence rows + override tick (`:3931`). Open: artifact cards per phase + diff vs prior + evidence tree (probe→hash→output). TODO(§R13-f12). |
| **W-53** | **DEFERRED-RECORDED** ✓ | `subagent.ts:38-49` — "STATUS: DE-SCOPED FOR THIS WAVE, explicitly" + `TODO(R13-f14)` wire sequenced AFTER W-01/W-21. The register's wire-or-de-scope = the de-scope half, recorded. |
| **W-54** | **DEFERRED-RECORDED** ✓ | Lexical-only by design; `221 §F5` NOT-RECOMMENDED; revisit trigger recorded (>500-file briefs or T4.3/TA-18 residual promotion). No action — correct shape. |

---

## Counts (each row counted exactly once, by its primary disposition)

- **LANDED — verified: 21** — W-01, W-02, W-03, W-05, W-08, W-09, W-10, W-11, W-12, W-16, W-17, W-18, W-22, W-23, W-26, W-30, W-31, W-35, W-40, W-53, W-54 (W-53/W-54 = the recorded-defer shape, their own correct closure).
- **HANDOFF to a LIVE box (do not double-land): 7** — W-13→q6/p4, W-14→p3, W-15→p3, W-19→p4, W-20→q7, W-24→q6, W-27→q8(+q6 minors).
- **MOSTLY LANDED / partial with named residue: 5** — W-21 (crew seam→p1), W-25 (e/g/h→q1, i→p1, d→defer), W-29 (g→p3), W-39 (2 P3 residues), W-45 (live evidence→OWNER).
- **DEFER with precise TODO: 16** — W-04, W-06, W-07, W-28, W-33, W-34, W-36(superseded), W-37, W-38, W-41, W-42, W-43, W-48, W-50, W-51, W-52.
- **OWNER-gated (funded run / host / ruling): 5** — W-32 (owner pick), W-44 (execution), W-46 (keyed), W-47 (E2E after W-43), W-49 (host).
- Total: 21+7+5+16+5 = **54** ✓

## Handoffs ('for <lane>' — residuals owned by LIVE boxes)

- **for p3:** W-14, W-15, W-29(g) — grader v2 + 4 kind fixtures + fixtures README-row skip.
- **for p4:** W-19 (`gate.blocked` settlement), W-12/W-13 remainingwaves/K11 docs.
- **for q6:** W-24 (single scorecard predicate + parity pins), W-13 AGENT_GUIDE §4.
- **for q1:** W-25(e) packet strict-ok + helpers, W-25(g)(h) coded catches.
- **for q7:** W-20 served→stamp thread + fake-seam pin.
- **for p1:** W-25(i) store degrade rows, W-21 crew seam (F2-10).
- **for q8:** W-27(b)(c)(d)(f)(g)(h); **for q6:** W-27 README minors (e-narrowed already).

## [EXT-FAIL] / deviations

- **The tree went dirty mid-lane (04:24–04:26).** At open (04:0x) `git status` was clean at `ac6b151`; by 04:26 eight product files were modified by live P1–P4/Q1–Q8 lanes. **Q5 landed zero code** — verdicts were pinned to bytes as read; every open row's fix target is held by a live box or is owner/host-gated. No writes outside this log.
- Register row IDs cross-checked: W-01…W-54 = 54 rows (§A 4 + §B 25 + §C 15 + §D 10); WA-01…WA-04 / O-1…O-6 are OUTSIDE this task's 54 (they stay with their rows in the wave logs).
- `fixes/292_l1_register.md`'s "Counts" section was never filled (written at close, capped); this table supersedes it as the register's last word.
