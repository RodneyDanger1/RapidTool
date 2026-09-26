# fixes/267_lane8_audit_mission.md — W27 R8 · THE MISSION-GAP ANALYST

**Slice:** whole-repo reading with the mission lens + the run evidence (`research/eval-out/**`) + the canon plan rows (F1–F4, OV-38/39/40, T-107.7, T5.x). **Status: IN PROGRESS — skeleton first; register filled (final append = §R8 in `thoroughanalysis.md`).**
**HEAD at lane start:** `e3d3fe4` ("W24-W26: spring-clean + deep audit + bug hunters — gates green on fused bytes"). **Tree re-checked at read time; line numbers as-read today.**
**Mission lens:** a truly autonomous software factory / best AI harness: keyed model → GOOD code, any kind of software, continuously improving, perfect emitted UI/UX, professional quality everywhere. A defect = anything (code, wiring, process, missing capability) between RapidTool and that standard.
**Rules honored:** audit only (no product edits), NO keyed calls (account unfunded — all calls 402), no full-gate runs; every claim carries file:line (read time) or a real command output.

## Read-first log (all done, this session)

- [x] `wave_plans/W27/mass-investigation.md` (full) — mission, R8 box, append protocol, lane-log name.
- [x] `research/multiagent/thoroughanalysis.md` (full, 371 lines) — THE MISSION preamble + protocol (END-OF-FILE-MARKER-W25 at L371 = last line) + A1–A4, C1–C6 findings.
- [x] `research/multiagent/thoroughaction.md` (polls 1–7, 498 lines) — W24–W26 watchdog ledger (all lanes' closures, box checks, parent actions).
- [x] `research/multiagent/263_state_of_play.md` (full) — done/run-arc/fundedness-wire/left-open.
- [x] Run evidence: `research/eval-out/_keyed-run.log` (2026-09-10: 4/9, 756.2s, exit 0), `results.json` (2026-09-25T00:03:43Z: mean 0.3333, all synthesis refused, stall `p6-verified, p6-brief-fit`, stopCode `RT_E_GATE_PENDING`, emitError foreign files, M5 "nothing to hide"), `history.json` tail (best 2026-09-24 ~19:49 = 6/9 · 0.6667; last = 3/9 wallet run).
- [x] Canon rows: `research/multiagent/220_tasklist_canonical.md:85-188` (OV-6, DF-04, T-107.7 :93, F1 :185, F2 :186, F3 :187, F4 :188, OV-38/39/40 :174-176) + `fixes/228_ledger_and_risk_register.md` §3 (#24 F1, #25 F2, #27 F4) + `fixes/247_lane1_corpus_fold.md:26,34`.
- [x] Design specs: `research/multiagent/221_feature_designs.md` §F1 (:54-155), §F2 (:158+), §F4 (:335+); `fixes/217c_phase5_spec_and_decision_register.md` (§T5.1 :66-68; §T5.7 :381-390, :619-659); `research/multiagent/222_codebase_integration_map.md` row 11 (T-107.7).
- [x] Landing logs: `fixes/252_lane2_f4.md` (F4 core + console; engine consult explicitly out-of-box), `252_lane6_t57.md` (cassette module; wiring explicitly out-of-box), `252_lane3_t51.md` + `scripts/chat-stream.test.mjs` (transport + scripts test; no CLI surface), `252_lane5_f2.md` + `258_lane2_f2_finish.md` + `255_lane4_t51_f2.md` (xai candidate; live mint + failover remain), `255_lane1_tree_green.md` (CJS crash class; W21-L1 fix).
- [x] THE BYTES (read today, HEAD e3d3fe4): `engine.ts` (wildStep :3820-4033, upgradeP6Keyed :2869-2905, liveLayer :2907+, runPhaseAsync :3400, wildApproveGate :3641, hard paths :3713/:3771, emptyProject default :1902-1903, keyedDeepSeekConfigured :1814-1826, stamp :3191) · `headless.ts` (runPhase :350, advanceOnce :511, runUntilGate :597, emit refuse :1600-1607/:1647, applyTreeRunTestedMint :1962, mint sites :2100/:2142/:2687/:2699, driveP6Journey :2001, repairTreeDir :2624, wildStartRun :3759) · `codegen.server.ts` (materializeImportableTree :1924, refuse :2348-2363, partialTreeRefuse :3289-3309, treeUpgraded :3323-3399 lastTest:null :3383, mintTreeRunTested :3450) · `dod.ts` (p6-test :556, p6-verified :583-601, p6-brief-fit :610-632, p6-arch :650-657, recordGateInto :865) · `store.ts` (runPhaseAsync wire :557-580, runP6Journey :925-966, create :1164-1173, demo seed :1755, approve :1525-1560, wild driver :startWildRun) · `scaffold.ts` (projectKindOf :453-470, game shell :914-935, cli/service stubs :937-952, ReferenceError guard :1613) · `policy.ts` (readPolicyOverlay :377, applyPolicyOverlay :489, isVerifiedHumanSeatToken :170-181) · `cassette.ts` (:66-89, :514, :654) · `chat.ts` (chatStreamNdjson :410) · `llm/providers/registry.ts` (PROVIDERS :184-205, resolveEnvProvider :249, resolveEnvSelectedRoute :303-365) · `llm/providers/openai-compatible.ts` (402→RT_E_LLM_REJECTED ~:494) · `rapidtool-cli.mjs` (run/gate :467-537, approve :566-620, fixtures :955-1000, emit :804, wild :2834-2911, chat :2913+, edit seat :1425-1426) · `types.ts` (ArtifactKind :23-39, kind :323) · `console.tsx` (:309 policyAllowListsOf, :322 wildPolicy read, :591+ fixtures panel) · `research/eval-out/coffeehouse2home-property-ledger/src/ui/console.tsx` (name-dump UI).

## The register (also appended to `research/multiagent/thoroughanalysis.md` §R8)

Ordered by mission unlock value: Tier 0 = the spine that makes "a keyed run completes with LLM-authored, machine-verified code" true at all; Tier 1 = flow completion (checkpoint, streaming, cassette, allow-lists, seat, universality); Tier 2 = breadth + acceptance + honesty residuals.

| ID | Tier | Sev | One-liner | Today (file:line) |
|---|---|---|---|---|
| R8-f01 | 0 | P0 | ONE keyed journey: wildStep never touches the model; console journey mirror unwired; console never enforceDod | engine.ts:3986 (applyPhaseResult only), :2869+:2920 (upgradeP6Keyed sole caller), :2853-2856 (drift comment); store.ts:925-966 (runP6Journey, 0 UI callers), :1164-1173; engine.ts:1902-1903 + :1814-1826 |
| R8-f02 | 0 | P0 | "tested" mint unreachable from run/gate/wild/console (eval+repair only) | codegen.server.ts:3383 + :3450; headless.ts:1962/:2100/:2142/:2687/:2699; runUntilGate :597; rapidtool-cli.mjs:467-537 |
| R8-f03 | 0 | P1 | Mint earned by load+presence, not behaviour; brief-fit over-blocks | codegen.server.ts:3416-3431; scaffold.ts:1613; dod.ts:583-601, :610-632, :650-657 |
| R8-f04 | 0 | P1 | "enforce-DoD on when keyed" caption false in the app | engine.ts:1902-1903/:1826; store.ts:1164-1173; console caption (W25 anchor :6264-6284) |
| R8-f05 | 1 | P1 | No checkpoint / `resume` verb / stateHash (T-107.7) | grep 0 hits; verbs=37; wild --resume only (cli :2842); keyed journey = 756.2s (_keyed-run.log:6) |
| R8-f06 | 1 | P1 | Streaming transport exists; no user surface (T5.1) | chat.ts:410; chat-stream.test.mjs; deepseek.ts:397 stream:false; cli chat arm :2913 (no --stream); no SSE in src/ |
| R8-f07 | 1 | P1 | Cassette built, mounted on nothing (T5.7) | cassette.ts (:70/:73/:89/:514/:654); 0 consumers (grep); run-eval no --record/--replay |
| R8-f08 | 1 | P1 | F4 overlay exists; no engine consult; no Project.wildPolicy; no wild.paused_policy | policy.ts:377/:489; 0 consumers (grep); engine.ts:3641 wildApproveGate; types.ts:323 region |
| R8-f09 | 1 | P1 | Seat degenerate (same env both sides); fixtures approve seatless; console approve tokenless | cli :604-605, :1425-1426; policy.ts:170-181; cli :977-1000; brief-fixtures.ts:588; store.ts:1549-1556 |
| R8-f10 | 1 | P1 | Universality unmeasured: 7/7 fixtures webapp; cli/service emitters are stubs; emitted UI = names dump | scaffold.ts:453-470, :914-935, :937-952; grep ^kind: = 7×webapp; emitted src/ui/console.tsx:14-21 |
| R8-f11 | 2 | P2 | MCP runtime client absent (contract artifact only) | types.ts:23-39 ("mcp"); dod.ts:428-430; phases.ts:33; engine.ts:922; no src/lib/mcp* |
| R8-f12 | 2 | P2 | Second family live-verification + failover + error parity missing | registry.ts:184-205, :329-338; openai-compatible.ts ~:494 (402→RT_E_LLM_REJECTED); no fallback; probe never ran with key |
| R8-f13 | 2 | P2 | OV-38/39/40 acceptance chain unrowed-in-practice (TODO) | 220_tasklist:174-176; taskuniverselog 0 hits; gated on R8-f02 + funded run |
| R8-f14 | 2 | P2 | Hard-DoD stall writes no gate record; M5 reads clean | dod.ts:865; engine.ts:3713/:3771; headless.ts:490/:556; results.json M5 vs notes.stall |
| R8-f15 | 2 | P2 | emit refuses over foreign files; --force keeps them; no --clean-target | headless.ts:1600-1607/:1647; run-eval.mjs:783/:1793 (eval-only) |
| R8-f16 | 2 | P2 | partialTreeRefuse keeps stale green lastTest | codegen.server.ts:3289-3309; refuse() :2348-2363; contrast :3383 |
| R8-f17 | 2 | P2 | Graders don't grade the product; emitted UI can't reach "perfect" | A3-f05/f07 + emitted ui dump (:14-21) |
| R8-f18 | 2 | P2 | model_route names a model that did not serve (pro requested, flash stamped) | llm-tasks.ts:127/:157/:188; engine.ts:3191 (+ comment :2835) |

## Diff vs W25 (the four items that MOVED)

1. **T5.7 cassette** — module + test landed (W19-L6) but wiring explicitly left out-of-box (`fixes/252_lane6_t57.md` "NOT in box": registry.ts callModel wrapper, run-eval flags, CLI flags, README note). Grep today: 0 consumers. → R8-f07 (half-landed).
2. **F4 allow-lists** — overlay core + console render path landed (W19-L2) but the engine consult (`Project.wildPolicy` + `wildApproveGate` + `wild.paused_policy`) explicitly out-of-box (`fixes/252_lane2_f4.md` §4.1). Grep: `paused_policy` 0 hits; `applyPolicyOverlay` 0 consumers. → R8-f08 (half-landed).
3. **F2 second family** — xai candidate + probe + env selection + provider-scoped refusals landed (W19-L5/W21-L2); live verification mint + failover remain. → R8-f12 (half-landed).
4. **T5.1 streaming** — lib leg + scripts transport test landed (W19-L3); no CLI/console surface. → R8-f06 (half-landed).

**Standing (re-verified at HEAD):** A1-f01, A1-f02, A1-f03, A1-f05, A1-f06, A1-f07, A1-f09, A2-f01, A3-f06, C1-f03, C2-f02. **Line refreshes:** p6-verified dod.ts:583-601; p6-brief-fit :610-632; p6-arch :650-657; mint sites headless.ts:2100/:2142/:2687/:2699; wildStep engine.ts:3820 (body :3986); hard paths engine.ts:3713/:3771.

## Commands run (all read-only; representative)

`git log --oneline -3` (HEAD e3d3fe4) · `grep -c 'case "' scripts/rapidtool-cli.mjs` = 37 · `grep -rn "stateHash|checkpoint"` (0) · `grep -rn "selectCassette|createCassette"` (0 consumers) · `grep -rn "applyPolicyOverlay"` (0 consumers) · `grep -rn "paused_policy"` (0) · `grep -rn "RT_E_PROVIDER_MODEL_UNVERIFIED"` (0; the candidate refusal is `RT_E_VALIDATION` naming the probe path, registry.ts:329-338) · `grep -rn "mintTreeRunTested|applyTreeRunTestedMint"` (call sites as listed) · `grep -rn "runP6Journey" src/components src/routes` (empty) · `grep -h "^kind:" research/eval-corpus/*.md | sort | uniq -c` (7 webapp) · `grep -rn "chatStreamNdjson"` (chat.test.ts only) · `grep -rn "stream" src/lib/chat.ts` · `ls src/lib | grep -i mcp` (empty).

## Trace limits

- **No keyed calls made** (account unfunded per the wave brief). The latest committed keyed evidence: `history.json` 2026-09-25T00:03:43Z (mean 0.3333, `synthesisSucceeded:false` — the wallet run) and 2026-09-24 ~19:49 (6/9 · 0.6667). The 756.2s keyed journey in `_keyed-run.log` is the runtime scale figure behind R8-f05.
- `console.tsx` has been edited across W24–W26; its anchors above are mechanism-anchors (W25 read-time + fresh greps today for `policyAllowListsOf` :309 / `wildPolicy` :322 / fixtures :591); re-grep before patching.
- R8-f03's `treeRunTestedEvidence` line (codegen.server.ts:3416-3431) is a W25 anchor not re-read byte-for-byte today (the file was re-read around it: refuse/partial/treeUpgraded/mint all verified today).

## Completion block (appended after the §R8 append)

- **§R8 LANDED** in `research/multiagent/thoroughanalysis.md` via the end-marker protocol: `### §R8 — THE MISSION-GAP REGISTER` at **line 671** of 741; 18 rows **R8-f01…R8-f18** + §R8-UPDATES + §R8-CORRECTIONS + trace limits; END-OF-FILE-MARKER-W25 intact (grep count 1) and still the file's **last line**, so all sibling sections (§A1–§A4, §C1–§C6, §R1, §R2, §R13 — appended concurrently) are untouched by this lane's write.
- **Concurrency note:** the patch tool warned the shared file had been modified by a sibling (`sa-4-f3704ba8`, 16:18:31) since my last read; the append still matched the unique marker line and the post-write verification (marker count/last-line/section census) confirmed no clobber — recorded per protocol.
- **Deliverables:** this log + §R8. **No product edits** (only `fixes/` + `research/multiagent/` writes); no keyed calls; no full-gate runs.
- **Ordering recap for the coder wave (mission value → first):** T0 spine = R8-f01 (ONE keyed journey: wildStep + console), R8-f02 (mint at every run-path P6 edge), R8-f03 (behaviour-backed mint), R8-f04 (console keyed honesty); T1 = R8-f05 (checkpoint/resume) · R8-f06 (streaming surface) · R8-f07 (cassette wiring) · R8-f08 (allow-list engine consult) · R8-f09 (human-seat chain) · R8-f10 (universality kinds+fixtures); T2 = R8-f11 (MCP) · R8-f12 (second family finish) · R8-f13 (OV-38/39/40 acceptance) · R8-f14…f18 (honesty/loop/quality residuals).
