# 146 — RESEARCHER-C (CODEBASE): wave landing verification + Wave-E gap list

(Transcribed by the parent from the researcher's capped summary — all anchors verified on disk
by the researcher this session; suite 1343/1343 green at transcribe time.)

## 1. LANDED / PARTIAL / MISSING — verification against disk

### M1 — findable output + truth-in-docs
| Item | Verdict | Evidence |
|---|---|---|
| emit/vault default → `<home>/RapidTool Software/<slug>/` | LANDED | `defaultOutputDir` helper + overwrite warning in rapidtool-cli.mjs; probe in fixes/144_m1_l1.md |
| Docs drift: packet v3 / 30 verbs / gate authority / P5 line | LANDED | fixes/144_m1_l2.md; 30 case arms confirmed; phases.ts:49 |
| Console UI: EnforceDodToggle, Export-software, Resume→startWildRun, Run-machine-verify | LANDED | fixes/144_m1_l3.md (console.tsx only); store seams store.ts:817-863, 900-945 |
| Store regressions | LANDED | store.test.ts 65/65 |

### M2 — multi-file generation (tree)
| Item | Verdict | Evidence |
|---|---|---|
| generatedTree type + hydrate/io repair | LANDED | types.ts:324; engine.ts:2133-2187; io.ts:224-254 |
| Chunked synthesis driver | LANDED | codegen.server.ts:415/430/471/499/525/1203/1267 (fake-caller 44/44) |
| Tree→scaffold assembly | LANDED | scaffold.ts:176-215 (TREE_ALLOWED_ROOTS/TREE_RESERVED/treePathRefusal), assembly 1650-1717 |
| p6-arch probe + reqTrace stamp | LANDED | dod.ts:173 archTrace; p6-arch ~:380-392; engine.ts:1428 stampP6ReqTrace, wired 2643-2649; gates.test.ts:774+ |
| Keyed live proof + master log | MISSING | No fixes/144_m2.md; no live keyed-generatedTree proof |

### M3 — run the tree in loop
| Item | Verdict | Evidence |
|---|---|---|
| treeRun mechanics | LANDED | compile-check.server.ts:241-281 types; probe-validated |
| CLI emit --run, exit-1 on red | LANDED | rapidtool-cli.mjs:656-659; headless E-25 test :766+; compile-check.server.test.ts 11/11 |
| Failure channel into repair prompts | LANDED (code) | codegen.server.ts:166-180 repairTreeFailureTail; 5 builders take treeFailure? |
| Failure channel threaded by the DEFAULT journey seam | PARTIAL — seam gap | driveP6Journey's defaultP6Synthesize (headless.ts:1156-1170) stamps p6.tree.failure logs but calls liveLayer(p,6) → liveP6Synthesis(done) with NO deps.treeFailure → codegen (reads only deps?.treeFailure) never sees the tail |
| E-15 paren mismatch (scaffold) | OPEN | scaffold.ts:642 throws `TODO(E-15 stub): implement…` while :1102 asserts /TODO\(E-15\) stub/ — orc-* oracle rows can never pass; seen live (10 pass / 3-5 fail) |
| NODE_TEST_CONTEXT robust fix | NOT LANDED | only test-side scrub |
| TreeRunOutcome in repair loop | MISSING in run-eval | run-eval calls treeRun once after emit only |

### M4 — journey driver + completion gate
| Item | Verdict | Evidence |
|---|---|---|
| RT_E_GATES_FAILED + sealedWithFailures + CLI exit-1 red-seal | LANDED | errors.ts:38/261; headless.ts:466/625; rapidtool-cli.mjs:389-406; README-cli rows |
| driveP6Journey (budget :1099) fake-deps tests | LANDED | headless.test.ts:369+ converge/exhaust/keyless |
| Seal honesty + content-rich L2 | LANDED | engine.ts:1183 sealHonesty; P12 census :1056-1082; L2 mint :1300-1387 |
| Driver verb run --fix / store async mirror | MISSING | no --fix flag; no driveP6Journey in store.ts |
| Wild-mode keyed P6 parity | PARTIAL / NO LOG | engine wildStep :3383+; generatedTree-on-wild not verified |

### M5 — learning
| Item | Verdict | Evidence |
|---|---|---|
| L2 content richness (unmet/class/tail ≤240) | LANDED | C3 probes + lesson-writers/gates/knowledge tests |
| knowledge.ts lessonEvidenceDetail (:670) + lessonLinesForBrief (:127) + selectLessons (:694) | LANDED | C4; engine still inlines a duplicate format (convergence contract noted) |
| Tier-2 P6 expansion injection | LANDED (pre-existing) | codegen.server.ts:988-997 + test :468-506 |
| D2 P0-reframe seam (lesson lines in reframe prompt) | LANDED code / UNTESTED branch | engine.ts:600-625; no unit test exercises the lesson-bearing reframe prompt |
| Tier-1 packet Ranked-memory seed via injectProven | MISSING | packet.ts ranks only in-project memory; injectProven still ZERO consumers |
| lesson verb family + human-gated accept | MISSING | no lesson case arm; buildSupersedeEntry/manualLesson/dismissLessonRows/proposeLessonFallback orphaned |
| Decay/falsification counters | LANDED (store level) | knowledge.test.ts:238-327 |

### M6 — eval harness
| Item | Verdict | Evidence |
|---|---|---|
| Corpus fixtures (6 + README) | LANDED | research/eval-corpus/* |
| maker-score.ts M1..M9 + tests | LANDED | maker-score.ts 479 lines; test 482 lines GREEN; npm run eval wired |
| run-eval keyless baseline | LANDED | eval-out/results.json: 6 entries all 4/9 (M1-M4=0, M5/M6/M8/M9=1), mean .444 |
| p6-maker advisory probe | MISSING | not in dod.ts |
| Live keyed corpus entry | MISSING | results.json mode=keyless |

## 2. Junction findings (maker-score expectations walked back to code)
- **Divergence #1 — M1 ungated**: driveP6Journey converges on treeRun.ok only (no capability coverage); p6-arch maps expandBrief requirements, not corpus expectedCapabilities → a journey can CONVERGE while M1=0 silently.
- **Divergence #2 — chunked trees never mint lastTest**: treeUpgraded (codegen :1363-1420) skips verifyAndFixServer (only the ≤8-sig path mints label:"tested") → derived M3=0 and M4=0 by construction for trees >8 sigs.
- **Divergence #3 — keyed hard-stall landmine**: with a real key enforceDod defaults ON → p6-verified unmet for every chunked tree → hard-DoD park at P6 (engine :2713-2721/:2948/:3006) → the eval drain may stall on the first keyed entry. MUST resolve before M7.
- **Divergence #4 — run-eval double synthesis**: keyed drain (live:true) synthesizes P6, then driveP6Journey re-synthesizes on the drained project (run-eval.mjs:285-291) — a second expensive pro synthesis whose verdict actually scores M3/M8. Rework to one synthesis.
- M2 blocked by the E-15 paren mismatch for every webapp entry with A6 endpoints.
- M7 learning: keyless history rows exist → first keyed run scores M7=1 once M1+M2+M3 ≥ 1.

## 3. Wave-E (M7) gap list (anchored)
1. E-15 paren mismatch — scaffold.ts:642 vs :1102. Blocks M2. Highest-leverage fix.
2. treeFailure never reaches repair prompts in the default seam — headless.ts:1156-1170 → engine.ts:2634 liveP6Synthesis(done) without deps.treeFailure.
3. Tree projects never mint tested lastTest — codegen.ts:1363-1420 vs :870-912 → p6-verified/M4 unsatisfiable + keyed hard-stall risk. Decision: tested-equivalent stamp after green treeRun, or re-scope M4 honestly.
4. M1 capability coverage ungated — add a scored-coverage report to run-eval.
5. run-eval double-synthesis ordering — one synthesis drives emit + journey scoring.
6. M5 missing surfaces — lesson verb family + human gate; packet tier-1 injectProven; orphaned helpers.
7. M4 ms4 driver verb — no run --fix, no store mirror.
8. D2 reframe-lessons branch untested — add a test that warms the lazy knowledge seam.
9. Wild-mode keyed P6 parity unverified.
10. NODE_TEST_CONTEXT robust scrub in runNodeBounded child env.

## 4. Declare-or-strike sweep
- AGENTS.md still "27-verb CLI" + "exit taxonomy (0/1/3/4)" + "gates advisory… never block" — never swept (M1-L2 flagged it).
- No fixes/144 m2/m4/m5/m6 master logs; m3_b3's gate-verdict section never filled.
- scaffold.ts:1847 summary wart "…write them to disk with the emit command" in the tree-mode line.
- Corpus expectedNouns vs briefNounHits are two different "truths" — document explicitly.
- Re-run the full gate before M7 (suite grew past logged counts).

## 5. Recommended lane split (≤4, disjoint — adopted as Wave E)
- **E1 — scaffold/oracle correctness**: scaffold.ts paren/E-15 fix + scaffold.test.ts + re-probe emit --run. Files: src/lib/scaffold.ts, scaffold.test.ts.
- **E2 — journey verification + tested-stamp (M3/M4 spine)**: thread treeFailure through the default seam (headless.ts:1156-1190 / engine liveLayer deps passthrough); decide + implement the tested-equivalent stamp for a green treeRun (codegen treeUpgraded / verify.ts); verify approve/enforceDod at P6 under keyed defaults. Files: headless.ts, codegen.server.ts, engine.ts, verify.ts + tests.
- **E3 — eval runner + scoring truth**: rework run-eval ordering (single synthesis), M1 capability-coverage loud report, one bounded keyed PL entry, adjudicate M4 semantics with E2. Files: scripts/run-eval.mjs, maker-score.ts, maker-score.test.ts, fixes/145_m7.md.
- **E4 — M5 completion + honesty sweep**: lesson verb family + human gate + packet tier-1 injectProven (or strike); D2 reframe-lessons test; AGENTS.md/console stale copy; master logs. Files: rapidtool-cli.mjs, knowledge.ts, packet.ts, gates.test.ts, docs, fixes/.
- Contract: E2 exposes the tested-stamp/treeFailure seams E3 consumes; E4's doc claims match E2/E3's decisions.
