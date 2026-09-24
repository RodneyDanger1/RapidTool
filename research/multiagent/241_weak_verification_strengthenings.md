# 241 · W15 LANE 4 — strengthened verification commands for the 13 WEAK-graded rows (per 235 §2)

**Written:** 2026-09-24 by W15-L4 (flash lane). **Read-only everywhere except this file.**
**Sources:** `235_execution_readiness_audit.md` §2 (PROVES/WEAK/MISSING table — 13 of 17 placed rows WEAK) cross-checked against each row's block in `230_task_execution_playbook.md`; `wave_plans/W15/lanes.md` LANE 4. **Zero corpus edits by this lane** — the parent folds these into the corpus at merge.
**Entrypoint rule:** every path, flag and line anchor below was checked on disk (`ls`/`grep`/`sed`) in this session; today's RED/GREEN output for each runnable check is recorded in the Appendix. Where 230's anchors have drifted, the verified anchor is cited.

## BOTTOM LINE

```text
rows covered: 13/13 · placeholder commands: 0 · entrypoints cited: all verified on disk (Appendix A)
done-when CHANGES: 11 (C-1, C-2, OV-35, TASK-01, T5.3, OV-2, T5.2-A, OV-13, OV-15, OV-4, OV-5)
done-when PROOF-ONLY: 2 (DF-18, DF-26 — same claim, sharper pin)
already-satisfiable today: C-2(a), OV-5(a), OV-4(red path), OV-15(flag greps) — landed in this tree; commands below run NOW
definition step required first: OV-35 (export classifier+marker seam; main() unexported), OV-13 engine/store sites (keyless-unreachable fault seams), T5.2-A UI half (no console test target — declare UNVERIFIABLE-NOW), OV-15 probe fixture (a red-trail project)
writer discipline: node --experimental-strip-types --test ... for .ts/.mjs suites; `--test-name-pattern=` verified supported on this Node (v22.23.2)
path discipline: inside node (`-e`, script args, readFileSync/require), MSYS `/c/…` paths FAIL (ENOENT / C:\c\…); use the `C:/…` form — verified this session, see Appendix B
trap carried forward: `--test-name-pattern` with zero matching tests exits 0 — every name-filtered command below is paired with a presence grep so it cannot silently no-op
```

**The one rule these all implement (235's own):** never let a green check stand if the mechanism the row exists for could be absent. Every block below states the *observable* the command must pin, not just the command.

## SUMMARY TABLE

| row | weak because | strengthened command | changes done-when? |
|---|---|---|---|
| C-1 | journey-only: `repairTreeDir.recordGreen` can stay deadlocked while the suite stays green | `grep -cE 'it\(".*repair' src/lib/headless.test.ts` ≥1 **+** suite run with `--test-name-pattern 'repair\|C-1'` **+** full `headless.test.ts` ≥92 green | **yes** — adds the repair-seam case + the gate-reflection assertion |
| C-2 | predicate export optional; drain wiring + one-round proof lived in a scratch probe | `grep -n 'isTerminalDrainOutcome(res.outcome)' scripts/run-eval.mjs` (wiring) **+** `--test-name-pattern 'drain' scripts/run-eval.test.mjs` (committed cases) | **yes** — scratch probe → committed test |
| OV-35 | ordering / per-class codes / keyless-identity clauses unasserted; byte-diff is a manual skip | `grep -cE 'test\("OV-35' scripts/run-eval.test.mjs` ≥3 **+** `--test-name-pattern 'OV-35'` run | **yes** — 4 committed pins; definition step first |
| TASK-01 | grep passes on a comment; arms can collapse; "two independent computations" unasserted | `grep -cE 'it\(".*nextAction' src/lib/headless.test.ts` ≥8 **+** name-filtered run **+** CLI `create`→`summary` probe **+** `git diff --name-only` scope check | **yes** — per-arm cases + independence check |
| T5.3 | probe proves "one object + exit 0", not the payload/refusal/purity | stdout → `JSON.parse` + M1–M9 key check; empty-corpus refusal (`EVAL_CORPUS_DIR=`); committed `scripts/rapidtool-cli-eval.test.mjs` | **yes** — payload + coded refusal + purity |
| OV-2 | guard fixable at only the exercised call site; a white PNG passes | `browser-guard.test.mjs` 4 cases **+** literal smoke **+** verdict-JSON rendered-page gate **+** PNG size | **yes** — rendered-page evidence + all call sites |
| DF-18 | grep can hit a comment / another component / a never-rendered branch | awk-scoped `ScorecardBlock` body (comments stripped) `grep -c` | **no** — proof only |
| DF-26 | importing/naming `TRUNC` without rendering it; banner behind an unopened affordance | proximity grep ±25 lines of the packet render (comments stripped) **+** `14_000` recompute check = 0 | **no** — proof only |
| T5.2-A | backend halves green while the UI half (the row's actual claim) never lands | `approveFixtureCases` in `store.ts` ≥1 **+** store/brief-fixtures suites **+** CLI probe; UI half declared UNVERIFIABLE-NOW | **yes** — action pinned to the single flip path; UI half registered |
| OV-13 | 2 engine sites + store site can land unasserted; degraded-keyed≠keyless unproven | `--test-name-pattern 'unparseable' verify.server.test.ts`; engine pins mirror the G2 recipe; wiring pins registered where keyless-unreachable | **yes** — per-site assertion or explicit definition step + registration |
| OV-15 | flag can be wired to the wrong policy; scratch probe unread | flag grep **+** advice-text grep **+** banner probe (README carries `RED TREE-RUN`; `--red-tree=probe` refused) | **yes** — behaviour pin replaces the scratch probe |
| OV-4 | green case lacks the gate assertion; repair seam untested; red path | `--test-name-pattern 'C-1\|repair'` with `gate.passed` assertions **+** keep the real-recorder red case | **yes** — gate reflection + repair seam added |
| OV-5 | (a) C-2 wiring gap; (b) keyless `--trials=2` is not two keyed runs | (a) as C-2; (b) M7 unit pins + `results.json` prior-citation check **post-Step-0 only** | **yes** — M7 half gated on Step 0; keyless substitute struck |

---

## C-1 · gate-before-mint deadlock — the repair seam has no test

**The failure the weak command could hide (one line):** the named test exercises only the journey seam (`headless.ts` green branch), so a lane can leave `repairTreeDir`'s `recordGreen` (`headless.ts:2503-2516`) minting *after* the gate record — `repair` on an already-green chunked dir still returns FAILED — while `headless.test.ts` stays green.

**Strengthened command (copy-paste, run from the repo root):**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
# (1) presence — the repair-region case must EXIST as a test, not a comment (0 today; the only "repair" hit is a comment at :776)
grep -cE 'it\(".*repair' src/lib/headless.test.ts                                   # must be ≥ 1 (today: 0 = RED)
# (2) behaviour — the repair case + the journey C-1 case, name-filtered
node --experimental-strip-types --test --test-concurrency=2 --test-name-pattern 'repair|C-1' src/lib/headless.test.ts
# (3) the whole suite stays green and the count moved (91 today → ≥ 92; W15-LANE 1's done-when)
node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts
```

**The observable it must pin.** In the repair case, with the **default** `recordGate` (no `deps.recordGate` injection): `lastTest.label === "tested"`, `evidenceHash` non-empty, **and the returned `gate` reflects the mint** — either `gate.passed === true`, or (if brief-fit legitimately stays red on the fixture) the gate's `unmet` explicitly excludes the `p6-verified` criterion. Assert one of the two; a case asserting only the label is exactly the WEAK shape. The journey case at `headless.test.ts:513` must gain the same gate assertion it lacks today.

**Done-when:** **changes.** Old: "suite green, count ≥ 92". New: "suite green, count ≥ 92 **and** the +1 is the named repair-seam case **and** both C-1 cases assert the gate reflects the mint (not just the label)". The count alone can be padded by an unrelated test — the name presence grep closes that.

**Verified today:** presence grep = 0; `grep -cE 'it\(".*C-1'` = 2; suite = 91 tests (file on disk: `src/lib/headless.test.ts`, 5.5k+ lines region verified at :489/:513/:549).

---

## C-2 · hard-DoD → coded terminal stop — drain wiring

**The failure the weak command could hide (one line):** a lane exports + unit-tests `isTerminalDrainOutcome` while `drainPipeline`'s real terminal set never calls it — suite green, the drain still spins its ~80-round guard, M9 still 0 — and the one-round proof lived in a scratch dir, so the regression re-opens silently.

**Strengthened command:**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
# (1) WIRING, not just export: the drain must consume the predicate (1 hit today: run-eval.mjs:707)
grep -n 'isTerminalDrainOutcome(res.outcome)' scripts/run-eval.mjs                  # must be ≥ 1
# (2) the committed pins (landed W15-W0, fixes/237; present today at :480 and :493)
node --experimental-strip-types --test --test-concurrency=2 --test-name-pattern 'drain' scripts/run-eval.test.mjs
# (3) no regressions elsewhere in the driver suite
node --experimental-strip-types --test --test-concurrency=2 scripts/run-eval.test.mjs
```

**The observable it must pin.** (i) All seven `RunOutcome` values pinned: terminal = {`complete`,`blocked`,`error`,`dod`}, looping = {`hitl`,`progress`,`cap`}; (ii) the one-round case: exactly ONE `dod.blocked` row (`rowsAfter === 1`; was ~80), `drain.position === "dod"`, `drain.onTime === true`, `drain.code === "RT_E_GATE_PENDING"` (a registry code — `errors.ts:26`), cursor unmoved, no gate approved.

**Done-when:** **changes.** Old: "predicate/terminal-set pin in `run-eval.test.mjs` + scratch probe". New: the one-round drain assertion is a **committed test** (scratch probes are struck); the wiring grep is an additional acceptance line.

**Verified today:** wiring grep = 1; the two drain cases exist and are named `(d) drain terminality pins all seven RunOutcome values` and `(d) the drain exits on the FIRST dod round with a coded stop (WB-2 → M9)`.

---

## OV-35 · kill-safety run-start marker + preflight/failure-class triage

**The failure the weak command could hide (one line):** (a) a marker written *after* the first entry (or at the end) passes an existence check but re-opens WB-6 — a killed run leaves the stale keyless `results.json` readable as current; (b) collapsing {401, 402, 400, not-configured} into one message passes "coded output" while the triage the row exists for is gone; (c) the keyless byte-identity diff is a manual step a busy lane skips.

**Definition step required FIRST (state this in the lane brief):** the code does not exist yet and `main()` is unexported (`run-eval.mjs:1214`; key check is presence-only at `:83`). Before any command can pin it, export:
- a pure preflight classifier — one distinct result/code for each of {not-configured, 401, 402, 400 model-id, wire-ok} (stub the wire; no network in tests);
- a run-start marker seam — a writer invoked before the first corpus entry (marker file carrying `mode` + `startedAt`) and a predicate the keyless path uses to prove it writes nothing new.

**Strengthened command (after the definition step lands):**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
# (1) presence — the committed OV-35 cases must exist (0 today = RED); guards against the name-filter no-op
grep -cE 'test\("OV-35' scripts/run-eval.test.mjs                                   # must be ≥ 3 (today: 0)
# (2) the pins
node --experimental-strip-types --test --test-concurrency=2 --test-name-pattern 'OV-35' scripts/run-eval.test.mjs
# (3) whole file stays green
node --experimental-strip-types --test --test-concurrency=2 scripts/run-eval.test.mjs
```

**The observable it must pin (four cases, exact names to commit).**
1. `OV-35: the run-start marker is written before the first corpus entry` — stub the entry runner; assert the marker (file or row) exists with `mode`+`startedAt` at the moment entry 1 begins (ordering, not existence).
2. `OV-35: preflight maps not-configured/401/402/400 to distinct coded output` — four DISTINCT results; no network.
3. `OV-35: a keyless run writes no run-start marker and adds no fields to results.json` — replaces the manual pre/post diff with a durable pin (keyless paths must stay byte-identical per `run-eval.mjs:41`'s contract).
4. `OV-35: a ≤4/9 outcome is routed to the named branch` — via the already-exported `buildSummary` (re-trace vs re-run wording asserted).

**Done-when:** **changes.** Old: "`run-eval.test.mjs` green; keyless `npm run eval` byte-identical (manual diff)". New: four named committed cases green + the presence grep ≥ 3. The manual diff is struck as an acceptance line (kept only as an optional confirmation).

**Verified today:** `grep -cE 'test\("OV-35'` = 0 (RED); `run-eval.test.mjs` exists; `buildSummary` is exported and imported by the suite; `EVAL_CORPUS_DIR` seam exists at `run-eval.mjs:67`.

---

## TASK-01 · `nextAction` wire contract

**The failure the weak command could hide (one line):** `grep -c nextAction headless.ts` passes on a **comment**; if the seven arms are not each their own case, collapsing (`fix-gate`→`retry`, `done`≡`unknown`) passes a one-arm test while breaking the wire contract (`taskuniverselog.md:533-539`); and a lane refactoring `uiNextAction` to consume the wire field changes UI behaviour invisibly (the "two computations independent" clause is unasserted).

**Strengthened command:**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
# (1) presence: per-arm cases exist — 7 arms + empty-phases (0 today = RED)
grep -cE 'it\(".*nextAction' src/lib/headless.test.ts                              # must be ≥ 8
# (2) behaviour: the arm cases
node --experimental-strip-types --test --test-concurrency=2 --test-name-pattern 'nextAction' src/lib/headless.test.ts
# (3) structural: the field is SET in summary()'s return (not only a type/comment)
grep -n -A8 'export function summary' src/lib/headless.ts | grep -c 'nextAction'    # must be ≥ 1
# (4) end-to-end CLI probe — node needs the C:/ path form (MSYS /c/… fails with ENOENT inside node; see Appendix B)
#     flags verified: create --brief/--name/--out :2928, summary --project :2942; ran this session (probe.json created, summary ok:true, nextAction absent = the row's RED)
cd /c/Users/mnril/w15l4_scratch && CLI="C:/Users/mnril/Desktop/RapidTool Main/scripts/rapidtool-cli.mjs" && \
node --experimental-strip-types "$CLI" create --brief "probe: a task board for a two-person HVAC shop" --name probe --out probe.json && \
node --experimental-strip-types "$CLI" summary --project probe.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);const n=o.summary&&o.summary.nextAction;if(!['unknown','running','approve','retry','done','fix-gate','run'].includes(n))throw new Error('summary.nextAction missing/illegal: '+JSON.stringify(n));console.log('nextAction ok:',n)})"
# (5) independence: this lane's diff must not touch the console computation
cd "/c/Users/mnril/Desktop/RapidTool Main" && git diff --name-only | grep -c 'console.tsx'   # must be 0
```

**The observable it must pin.** (i) Each of the seven arms is asserted distinguishable from `unknown` (own case; the vocabulary `unknown/running/approve/retry/done/fix-gate/run`); (ii) `phases: []` → `unknown` (console parity); (iii) the CLI `summary` JSON carries `summary.nextAction` with a legal value; (iv) `console.tsx` untouched in the handoff diff.

**Done-when:** **changes.** Old: "suite green + `grep -c nextAction` > 0 + CLI probe". New: presence ≥ 8 arm cases, the structural grep, the CLI probe, and the zero-diff on `console.tsx` — the comment-passable grep is struck.

**Verified today:** `grep -c nextAction headless.ts` = 0 (RED); `ProjectSummary` :960, `summary()` :985; CLI arm `case "summary"` :1464 responds `{ok:true, summary: h.summary(project)}`.

---

## T5.3 · `eval` verb exposing the M1–M9 scorecard

**The failure the weak command could hide (one line):** the probe proves "one JSON object + exit 0" but witnesses no payload — a thin stub-shaped verb passes while the nine M-criteria never ride the object, the corpus-missing refusal is absent, and the one-equality-form `--limit=` regression is silently ignored (AUD-2: only `--limit=1` parses — `run-eval.mjs:85-86`).

**Strengthened command:**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
# (1) payload: one object AND the nine criteria keys AND the envelope — a stubbed verb fails this
node --experimental-strip-types scripts/rapidtool-cli.mjs eval --limit=1 > /c/Users/mnril/w15l4_scratch/eval-verb.json; echo "exit=$?"
node -e "const s=require('fs').readFileSync('C:/Users/mnril/w15l4_scratch/eval-verb.json','utf8');const o=JSON.parse(s);if(o.schema_version!==1||o.cmd!=='eval'||typeof o.exit_code!=='number')throw new Error('envelope contract broken');const miss=['M1','M2','M3','M4','M5','M6','M7','M8','M9'].filter(k=>!s.includes('\"'+k+'\"'));if(miss.length)throw new Error('criteria missing: '+miss);console.log('payload ok: single object, 9 criteria, envelope present')"
# (2) empty corpus → coded refusal (EVAL_CORPUS_DIR seam verified at run-eval.mjs:67)
mkdir -p /c/Users/mnril/w15l4_scratch/empty-corpus && EVAL_CORPUS_DIR=/c/Users/mnril/w15l4_scratch/empty-corpus node --experimental-strip-types scripts/rapidtool-cli.mjs eval --limit=1; echo "empty-corpus exit=$?"
# (3) doc-contract stays green; verb count re-derived (35→36 at K5)
node --test scripts/README-cli.test.mjs
```

**Durable home:** a committed behaviour test — `scripts/rapidtool-cli-eval.test.mjs` (NEW; sibling convention = `scripts/rapidtool-cli-lesson.test.mjs` — real `spawnSync` child + temp dirs, verified at its :1-45). It must assert the same payload keys, the refusal code, and that stdout is parseable as exactly one object (which the `JSON.parse` in (1) enforces — a leaked driver human line breaks it).

**The observable it must pin.** (i) One JSON object: `schema_version:1` + `cmd:"eval"` + `exit_code`, **and** all nine M-criteria present in the payload (today the driver's own results carry them — `run-eval.mjs:1016`, `:1157`, `:1245-1253`); (ii) empty corpus → `ok:false` + a code **from `src/lib/errors.ts`'s registry** + exit ≠ 0 (today's driver instead exits 0 with "nothing to evaluate" — `run-eval.mjs:1291`; the verb must add the coded refusal, and `RT_EVAL_STALL`/`RT_EVAL_REFUSED` at `run-eval.mjs:943-946` are driver-internal, **not** registry codes — W15-LANE 2 owns that decision); (iii) the space-form `--limit 1` is either coded-refused or documented equals-only — silently ignoring it is the AUD-2 defect.

**Done-when:** **changes.** Old: "one JSON object, exit 0; README-cli test green". New: payload criterion keys + envelope asserted, empty-corpus coded refusal asserted, stdout purity pinned in a committed scripts-leg test.

**Verified today:** `case "eval"` = 0 hits in the CLI (RED — `Unknown subcommand: eval`); `EVAL_CORPUS_DIR` seam :67; empty-corpus branch :1290-1295; README-cli count guard `realCount` at `README-cli.test.mjs:74`.

---

## OV-2 · first browser pass — output-path guard + rendered-page evidence

**The failure the weak command could hide (one line):** the guard can be fixed at only the call path the smoke walks (four call sites hardcode `["/workspace"]` — `browser-smoke.mjs:30/:32/:33/:41`), and a blank/erroring page renders "fine" and writes a PNG — `ok:true` with a white screenshot inspected nothing.

**Strengthened command:**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
# (1) durable guard pin: a case per call-site shape (accept C:/workspace/...; refuse ..-escape, outside-dir, the strict dir itself)
ls scripts/browser-guard.test.mjs && node --test scripts/browser-guard.test.mjs     # W15-LANE 1 creates this file; fallback until it lands: node --test scripts/browser-smoke-verdict.test.mjs (40/40 today)
# (2) the literal smoke, with npm run dev up on 0.0.0.0:8080
node scripts/browser-smoke.mjs http://localhost:8080/ C:/workspace/screenshots/w15-l4.png
# (3) rendered-page evidence gate (the PNG being written is NOT evidence)
node -e "const v=require('C:/workspace/screenshots/w15-l4.json');for(const n of ['desktop','mobile']){const x=v.viewports[n];if(x.status!==200||!x.title||x.bodyTextLen<=500)throw new Error(n+' rendered-page evidence weak: '+JSON.stringify({status:x.status,title:x.title,len:x.bodyTextLen}));if(x.consoleErrors.length||x.pageErrors.length)throw new Error(n+' console/page errors')}console.log('rendered-page evidence ok')"
# (4) a floor for the artifact (blank captures are far smaller than a real 1280x800 UI)
stat -c %s /c/workspace/screenshots/w15-l4.png                                     # require ≥ 20000 bytes
```

**The observable it must pin.** Verdict JSON at `C:/workspace/screenshots/w15-l4.json` (derived: png minus `.png` plus `.json` — `browser-smoke-verdict.mjs:42-45`) with `status:200`, non-empty `title`, `bodyTextLen > 500` per viewport, zero console/page errors; the four guard cases green in the **new** `scripts/browser-guard.test.mjs`; the findings register (fixed / registered) must **cite** the PNG + verdict JSON paths.

**Done-when:** **changes.** Old: "`{ok:true}` + PNG written". New: `{ok:true}` + the rendered-page evidence gate + the per-call-site guard cases. "No findings with no evidence of a rendered page" stops being a pass (230's own wording).

**Verified today:** guard fix landed (resolve-both-sides, `browser-guard.mjs:34-48`); four call sites confirmed at :30/:32/:33/:41; verdict test file 40/40 green; `derivedPaths` confirmed.

---

## DF-18 · scorecard's template-estimate caveat dropped in UI

**The failure the weak command could hide (one line):** the caveat string can land in a comment, another component, or a never-rendered branch — grep green while the scorecard headline still reads as researched.

**Strengthened command:**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
# scoped to the ScorecardBlock function body, comment lines excluded
awk 'f&&/^}/{exit} /^function ScorecardBlock/{f=1} f&&!/^[[:space:]]*(\/\/|\*)/' src/components/console.tsx \
  | grep -c 'template-derived\|not live research\|feasibility'                       # must be ≥ 1 (today: 0 = RED)
```

**The observable it must pin.** The string appears inside `ScorecardBlock` (`console.tsx:3303` → its closing top-level `}`), on a non-comment line — i.e. in the JSX the block returns. Do not paraphrase away `template-derived` / `not live research` (the force of `packet.ts:498`'s sentence).

**Done-when:** **no — proof only.** The claim is unchanged ("the caveat renders in the scorecard block"); the pin is region-scoped and comment-proof. The optional post-OV-2 browser confirmation stays as registered belt-and-braces, not acceptance.

**Verified today:** awk-scoped grep = 0 (RED); whole-file grep would have been 0 too, but the scope is the point; block boundary confirmed :3303 to the next top-level `}`.

---

## DF-26 · packet truncation invisible in the console

**The failure the weak command could hide (one line):** importing or naming `TRUNC_MARKER` without rendering anything (or a banner behind an affordance nobody opens) keeps the packet tail silently lost while `grep -c TRUNC` is green.

**Strengthened command:**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
# (1) proximity: the truncation reference must sit at the packet RENDER site (±25 lines around it), comments excluded
grep -n -B5 -A25 'MarkdownBody text={project.packet}' src/components/console.tsx \
  | grep -vE '^[0-9]+[-:][[:space:]]*(//|\*)' | grep -cE 'TRUNC|truncat|sections cut'   # must be ≥ 1 (today: 0 = RED)
# (2) anti-recompute: the console must NOT rebuild the cap client-side
grep -c '14_000\|14000' src/components/console.tsx                                  # must be 0
# (3) the seam it reads from
grep -n 'TRUNC_MARKER\|PACKET_MAX_CHARS' src/lib/packet.ts                          # :16, :17 — note TRUNC_MARKER is NOT exported today
```

**The observable it must pin.** A truncation notice renders at the packet display (`console.tsx:2903-2920` region: `{project.packet ? (` … `<MarkdownBody text={project.packet} />`), reading the packet's own bytes/accounting — either an exported `TRUNC_MARKER`/accounting from `packet.ts` (the lane's small decision: export it) or detecting the marker substring in `project.packet` — never recomputing `14_000`. 

**Done-when:** **no — proof only.** Same claim ("the truncation is loud where the packet is shown"), sharper pin: proximity + comment exclusion + the anti-recompute line.

**Verified today:** all three greps run: (1) = 0 (RED), (2) = 0 (contract already clean), (3) = hits at `packet.ts:16/:17`; packet render region confirmed at :2903-2920.

---

## T5.2-A · fixtures review UI + store actions

**The failure the weak command could hide (one line):** both runnable halves prove the **backend**; the row's done-when is a **UI** claim ("approving one case in the UI flips …"), so a lane can land the store action + tests, skip the surface, and every command is green.

**Strengthened command:**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
# (1) the store action must call the SINGLE flip path (0 today = RED)
grep -c 'approveFixtureCases' src/lib/store.ts                                     # must be ≥ 1
# (2) behaviour: the new store-action case(s) + the existing gate pin
node --experimental-strip-types --test --test-concurrency=2 --test-name-pattern 'fixture' src/lib/store.test.ts
node --experimental-strip-types --test --test-concurrency=2 src/lib/brief-fixtures.test.ts
# (3) CLI reference semantics — fixture built by the REAL CLI verbs (this exact chain RAN this session:
#     draft → pending 1 (id orc-1) → approve --ids orc-1 → pending 0 / approved 1 on disk)
cd /c/Users/mnril/w15l4_scratch && CLI="C:/Users/mnril/Desktop/RapidTool Main/scripts/rapidtool-cli.mjs" && \
node --experimental-strip-types "$CLI" create --brief "probe: a task board for a two-person HVAC shop" --name t52probe --out t52.json && \
node --experimental-strip-types "$CLI" fixtures --project t52.json --draft && \
ID=$(node -e "const p=require('C:/Users/mnril/w15l4_scratch/t52.json');const c=(p.acceptanceFixtures||[]).find(x=>x.approval==='pending');process.stdout.write(c?c.id:'')") && \
node --experimental-strip-types "$CLI" fixtures --project t52.json --approve --ids "$ID" && \
node -e "const p=require('C:/Users/mnril/w15l4_scratch/t52.json');const pend=(p.acceptanceFixtures||[]).filter(x=>x.approval==='pending').length;if(pend!==0)throw new Error('approval did not land: '+pend+' still pending');console.log('CLI fixture approval ok')"
```

**The observable it must pin.** (i) The store action flips approval **through `approveFixtureCases`** (`brief-fixtures.ts:588`) — a case with a forged `decidedBy` must come out stripped (never minted `"human"` by the action); (ii) the brief-hash gate still refuses on a mismatched hash (the pin at `brief-fixtures.test.ts:433` region); (iii) the UI half — **declare it UNVERIFIABLE-NOW in the lane handoff** (no `console.tsx` test target exists) and register it at the post-OV-2 browser pass. The row must not be claimed complete on the backend halves alone.

**Done-when:** **changes.** Old: "brief-fixtures suite + new store tests + CLI probe". New: additionally `approveFixtureCases` must be the store action's path (grep + behavioural case) and the UI half's UNVERIFIABLE-NOW declaration must be in the handoff (235's own cheapest strengthening).

**Verified today:** `approveFixtureCases` in `store.ts`/`console.tsx` = 0/0 (RED); `store.test.ts` (1681 lines) and `brief-fixtures.test.ts` exist; CLI `fixtures --approve --ids …` path verified at `rapidtool-cli.mjs:954-975`.

---

## OV-13 · silent degrades → visible record rows

**The failure the weak command could hide (one line):** the engine sites (`engine.ts` narrative catch `:3010-3012`, constraints catch `:3028-3030`) and the store catch (`store.ts:575-576`) can land **unasserted** (230's "If blocked" path legitimizes a grep-marker) — then a degraded keyed pass still reads byte-identical to a keyless one while both suites are green, exactly the class the row exists to kill.

**Strengthened command:**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
# (1) verify.server.ts site (:272-275 `return null` for unparseable) — directly testable
node --experimental-strip-types --test --test-concurrency=2 --test-name-pattern 'unparseable' src/lib/verify.server.test.ts
# (2) the row-factory pin pattern that EXISTS today (G2 recipe: lesson-writers.test.ts:327-408, incl. the throwingMeta fault injector)
node --experimental-strip-types --test --test-concurrency=2 --test-name-pattern 'live.failed' src/lib/lesson-writers.test.ts
# (3) marker check for any site that cannot be behaviourally reached (see definition steps)
grep -n 'fallback' src/lib/store.ts | head                                            # the :575-576 catch region
```

**Definition steps that MUST be named before the command can carry the row (say these in the lane brief):**
- **verify.server:** commit a case where an **unparseable** oracle payload yields an outcome **distinguishable from "no cases"** (a coded detail/row, not a bare `null`) — testable directly against `parseOracleJson` today.
- **store.ts `:575-576`:** the catch wraps a dynamic engine import and `runPhaseAsync` swallows its own throws (G2) — **unreachable from a keyless test**. Either expose a small row-factory seam, or declare the site unasserted with the missing pin registered as its own follow-up (declare-or-strike). A bare grep-marker alone does **not** close the site.
- **engine `:3010-3012` / `:3028-3030`:** both catches sit behind `if ((await llmStatus()).configured)` — the keyless suite cannot reach them (the `throwingMeta` detonator only reaches the research branch). Pin the exported degrade-row factories' shape (mirroring `liveLayerFailureRow` at `engine.ts:3232`, called `:3266`), and **register the wiring pin as a keyed follow-up**: after Step 0, any degrade in the keyed log must show its `p<n>.live.failed`-style row.

**The observable it must pin.** Each failure row carries phase + code + detail naming **which** failure happened; the deterministic floor's output shape is untouched (byte-identity preserved); the degraded keyed path is distinguishable from a keyless one (a keyed property — registered against Step 0's log, not claimable keyless).

**Done-when:** **changes.** Old: "extend store/verify suites; engine side with the sealed-log pattern". New: per-site asserting case **or** an explicitly named definition step + registered follow-up; an unasserted grep-marker is not sufficient for a site once so declared.

**Verified today:** engine catch sites at :3010-3012/:3028-3030 (comment-only, confirmed); `liveLayerFailureRow` :3232/:3266; store catch :575-576; `parseOracleJson` returns null at :275; the G2 pin recipe with injector at `lesson-writers.test.ts:327-408`; `llmStatus` reads `DEEPSEEK_API_KEY` only (`deepseek.server.ts:17`).

---

## OV-15 · redTree banner unreachable from the CLI

**The failure the weak command could hide (one line):** a flag wired to the wrong policy (`redTree:"probe"` instead of `"banner"`, or bypassing the banner contract) is grep-green to both greps; the behaviour probe that would catch it was scratch and read only if actually run.

**Strengthened command:**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
# (1) flag exists (landed W14-L2 at :806-826 — verified)
grep -n 'red-tree' scripts/rapidtool-cli.mjs | head
# (2) both sides agree in ONE check: the refusal's advice text still names the now-reachable option
sed -n '1400,1410p' src/lib/headless.ts | grep -c 'redTree:"banner"'               # must be ≥ 1 (verified: :1405)
# (3) behaviour probe — input requirement: a project whose logs carry an UNCLEARED p6.tree.failure
cd /c/Users/mnril/w15l4_scratch && rm -rf ov15 && mkdir ov15 && cd ov15 && CLI="C:/Users/mnril/Desktop/RapidTool Main/scripts/rapidtool-cli.mjs"
node --experimental-strip-types "$CLI" create --brief "probe: an ov15 red-trail fixture" --name ov15 --out p.json
node --experimental-strip-types "$CLI" repair --dir ./red-tree --project ./p.json    # stamps p6.tree.failure on the ledger (a red dir; budget exhausted → exit 1 is expected)
node --experimental-strip-types "$CLI" emit --project ./p.json --out ./out-default;                echo "default exit=$?"   # refuse: exit 1 + RT_E_TREE_RUN_FAILED
node --experimental-strip-types "$CLI" emit --project ./p.json --red-tree=banner --out ./out-banner; echo "banner exit=$?"    # ok:true + redTreeBanner:true
grep -c 'RED TREE-RUN' ./out-banner/README.md                                       # must be ≥ 1 — the banner is really ON the README
node --experimental-strip-types "$CLI" emit --project ./p.json --red-tree=probe --out ./out-bad;     echo "probe exit=$?"     # RT_E_VALIDATION — `probe` stays unexposed
```

**The observable it must pin.** `--red-tree=banner` → `ok:true`, `redTreeBanner:true`, and the emitted `README.md` carries the banner (`redTreeBanner()` text starts `> ## RED TREE-RUN …` — `headless.ts:1343-1360`); invalid value (incl. `probe`) → `RT_E_VALIDATION` (the deliberate non-exposure at :807-815); the refusal advice (`headless.ts:1405`) unchanged. Durable home: a committed CLI behaviour test — NEW `scripts/rapidtool-cli-emit.test.mjs` (spawnSync convention per `rapidtool-cli-lesson.test.mjs`) — whose fixture builds the red trail via the REAL `repair` verb (the journey path that stamps `p6.tree.failure`, `headless.ts:1712`/`:2600`), never hand-rolled JSON.

**Done-when:** **changes.** Old: "grep shows the flag + scratch probe". New: the banner-on-README assertion + invalid-value refusal + the advice-text agreement, as committed test assertions.

**Verified today:** flag + validation at `rapidtool-cli.mjs:800-826`; advice text at `headless.ts:1405`; banner text at `:1343-1360`; the `repair`/`emit` flag forms per their USAGE lines (:2940, emit arm :781+). The keyless `repair`→`emit` probe chain was NOT executed by this lane — its fixture path must be exercised and recorded at lane time; if the keyless repair cannot stamp the trail on this host, fall back to the red-trail project the `219a` probe used and register whichever ran.

---

## OV-4 · M3/M4 leg: promote a machine-verified verdict

**The failure the weak command could hide (one line):** (a) the green case passes while the **red path** is untested — a reorder minting on a red/unsure tree-run violates T0.6/I8; (b) the **repair seam** (C-1's twin) stays deadlocked; (c) the green case asserts the label but not that the real gate flips green **because of** the mint.

**Strengthened command:**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
# (1) the case set exists (2 hits today: the journey C-1 case + a "no mint on red" assertion; ≥ 3 after the repair case)
grep -cE 'it\(".*C-1' src/lib/headless.test.ts                                       # must be ≥ 3
# (2) behaviour: green-with-default-recorder + repair + red, all together
node --experimental-strip-types --test --test-concurrency=2 --test-name-pattern 'C-1|repair' src/lib/headless.test.ts
# (3) the whole suite (≥ 92, green; shares the count with C-1's done-when)
node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts
```

**The observable it must pin.** (i) Green journey case and repair case both assert `gate.passed === true` (or the gate `unmet` excludes the `p6-verified`/`p6-test` criterion) with the **default** `recordGate` — the mint is what makes the real gate green (today the C-1 case asserts only `label`+`hash`); (ii) the red path stays asserted against the **real** recorder — it already exists (`headless.test.ts:433-490`; comment: "the red-gate path above uses the REAL default recorder" — asserts `gate.passed === false`, no `"tested"` mint); extend it only if an assertion is missing; (iii) `dod.ts`'s `p6-verified` probe (`:500-517`) reads `lastTest.label === "tested"` + non-empty `evidenceHash` — the same shape the cases assert.

**Done-when:** **changes.** Old: "new case: converged + gate.passed + tested + hash". New: adds the gate-reflection assertion on the green path **and** the repair-seam case; the red path's existing real-recorder case becomes an explicit acceptance line.

**Verified today:** `grep -cE 'it\(".*C-1'` = 2; red-path case at :433-490 uses the default recorder; `applyTreeRunTestedMint` :1790; `mintTreeRunTested` in `codegen.server.ts`; `dod.ts` probe :500-517.

---

## OV-5 · M9/M7 leg: journey stop + learning baseline read

**The failure the weak command could hide (one line):** (a) inherits C-2's wiring gap; (b) a keyless `npm run eval -- --trials=2` invocation is **two trials of one entry — not two runs**, and produces no **keyed** baseline, so a lane can run it keyless, see a prior displayed, and claim M7 while the keyed citation path stays untested.

**Strengthened command:**

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
# (a) M9 drain stop — same pin set as C-2 (committed, present today)
node --experimental-strip-types --test --test-concurrency=2 --test-name-pattern 'drain' scripts/run-eval.test.mjs
# (b) M7 unit mechanics — the four prior cases exist today (:569-590)
node --experimental-strip-types --test --test-concurrency=2 --test-name-pattern 'prior' src/lib/maker-score.test.ts
# (c) M7 CITATION — POST-STEP-0 ONLY (after T0.10's keyed run #1 + run #2 same domain):
node -e "const r=require('C:/Users/mnril/Desktop/RapidTool Main/research/eval-out/results.json');const e=(r.entries||[]).map(x=>x.criteria&&x.criteria.M7&&x.criteria.M7.evidence).filter(s=>s&&/prior same-domain/.test(s));if(!e.length)throw new Error('M7 evidence does not cite a prior same-domain run — baseline not cited');console.log(e.join(String.fromCharCode(10)))"
```

**The observable it must pin.** (a) as C-2; (b) `m7Learning` (`maker-score.ts:567`) scores 0 without a prior ("no prior same-domain run scores 0 — no claim without data"), 1 at/above prior, 0 on regression; (c) after Step 0, run #2's entry carries an M7 evidence string matching `M1+M2+M3 <n> ≥ prior same-domain <n>` citing run #1's row (`maker-score.ts:577` evidence format; `history.json`/`priorFor` at `run-eval.mjs:72`/`:371`).

**Done-when:** **changes.** Old: "(b) M7: keyless `npm run eval -- --trials=2` then a second run cites run #1's". New: the keyless substitute is **struck**; the M7 half completes only after Step 0's keyed run #1, and its acceptance is the prior-citation check on the real keyed row. Until then the half is reported "unmeasured", not done.

**Verified today:** drain cases present; maker-score prior cases at :569-590; `history.json` exists at `research/eval-out/`; `priorFor` :371; M7 unit mechanics green-able now.

---

## Appendix A · entrypoint existence checks (raw output, this session)

```text
files confirmed on disk (ls): src/lib/{headless.ts,headless.test.ts,engine.ts,store.ts,store.test.ts,
  verify.server.ts,verify.server.test.ts,packet.ts,maker-score.ts,maker-score.test.ts,brief-fixtures.ts,
  brief-fixtures.test.ts,errors.ts,errors.test.ts,gates.test.ts,lesson-writers.test.ts,codegen.server.ts,dod.ts}
  scripts/{run-eval.mjs,run-eval.test.mjs,rapidtool-cli.mjs,README-cli.test.mjs,browser-guard.mjs,
  browser-smoke.mjs,browser-smoke-verdict.mjs,browser-smoke-verdict.test.mjs,rapidtool-cli-lesson.test.mjs}
  src/components/console.tsx · research/eval-out/{results.json,history.json} · wave_plans/W15/lanes.md
files NOT yet on disk (deliberate, named in the rows): scripts/browser-guard.test.mjs (W15-LANE 1 creates it),
  scripts/rapidtool-cli-eval.test.mjs + scripts/rapidtool-cli-emit.test.mjs (the T5.3/OV-15 lanes create them)
anchors re-verified by grep/sed (230's anchor drifts corrected where found):
  headless.ts: summary() :985 · ProjectSummary :960 · applyTreeRunTestedMint :1790 · journey green branch
    :1916-1958 · repairTreeDir :2452 · recordGreen :2503-2516 · redTreeBanner :1343-1360 · redTree option
    :1373 · default :1397 · refusal :1405 · "dod" outcome :585-606
  codegen.server.ts: mintTreeRunTested region (mint :3209-3248 per 223) · treeFailure field :874
  dod.ts: p6-test :473-480 · p6-verified :500-517
  engine.ts: narrative catch :3010-3012 · constraints catch :3028-3030 · liveLayerFailureRow :3232 · call :3266
  run-eval.mjs: KEYED :83 · --limit= :85-86 · --trials= :92-93 · CORPUS_DIR :67 · HISTORY_PATH :72 ·
    priorFor :371 · isTerminalDrainOutcome :656 · drain consumes it :707 · empty-corpus branch :1290-1295 ·
    RT_EVAL_* internal codes :943-946 · results persist :1177 region · criteria :1016/:1157/:1245-1253
  run-eval.test.mjs: drain terminality case :480 · one-round dod case :493
  rapidtool-cli.mjs: emit :781 (red-tree :806-826) · fixtures :923 (approve path :954-975) · tree-run :986 ·
    repair :1057 · summary :1464 · USAGE create :2928 / repair :2940 / summary :2942
  console.tsx: uiNextAction :311 · ScorecardBlock :3303 · packet render :2903-2920 · downloadPacket :2037
  packet.ts: PACKET_MAX_CHARS :16 · TRUNC_MARKER :17 (NOT exported today) · caveat string :498 · truncation :538/:561/:564-569
  store.ts: fallback catch :575-576 · verify.server.ts: parseOracleJson null :275
  browser-smoke.mjs: call sites :30/:32/:33/:41 (all hardcode ["/workspace"]) · guard fix :34-48
  lesson-writers.test.ts: G2 pin recipe :327-408 (throwingMeta injector :336-346)
today's RED/GREEN outputs (the checks in the blocks above, run now):
  nextAction in headless.ts = 0 · it(".*repair in headless.test.ts = 0 · it(".*C-1 = 2
  ScorecardBlock-scoped caveat grep = 0 · TRUNC in console.tsx = 0 · packet-proximity grep = 0
  store/console approveFixtureCases = 0/0 · isTerminalDrainOutcome(res.outcome) in run-eval.mjs = 1
  node --test scripts/browser-smoke-verdict.test.mjs = 40 pass / 0 fail
  node v22.23.2 supports --test-name-pattern and --test-concurrency
  TASK-01 CLI probe chain RUN (scratch): create ok:true → summary ok:true with nextAction ABSENT (= the row's RED)
  T5.2-A CLI chain RUN (scratch): create → fixtures --draft (pending 1) → fixtures --approve --ids orc-1 (approved) → on disk pending 0 / approved 1
  path form: node -e fs.readFileSync('/c/Users/…') = ENOENT; the same file via 'C:/Users/…' = OK (16737 bytes)
```

## Appendix B · process notes

- **Zero corpus edits by this lane** — the only file written is this one (`git status` verified before and after; no other path touched).
- Scratch dir used: `C:/Users/mnril/w15l4_scratch/` (created; only referenced in commands above, no repo artifacts).
- **Path-form correction (found by running the probes, not by reading):** bash-side commands may use `/c/…` (git-bash converts cd/grep/awk/stat), but **node never receives that conversion** — `node "…/scripts/rapidtool-cli.mjs"` or `require('/c/…')` resolves to `C:\c\…` and fails (ENOENT; observed this session). Every node command above uses the `C:/…` form or a relative path from the repo root. The first draft of this file used the `/c/…` form in three blocks; corrected after the probe run.
- **Honest limits:** (1) no strengthened command in this file was *executed* by this lane where the mechanism does not exist yet (OV-35's cases, TASK-01's arm cases, T5.3's verb, T5.2-A's action, DF-18/DF-26's UI edits, OV-15's probe chain) — the RED state for each was established by the presence/scope greps recorded in Appendix A; **exception: the TASK-01 and T5.2-A CLI probe chains WERE executed on scratch data this session (outputs in Appendix A)** — their commands are runner-verified, only the row-level GREEN is pending the implementation; (2) OV-15's `repair`→`emit` probe chain is a recipe whose fixture must be exercised at lane time and recorded (either the keyless repair trail or the 219a red-trail project); (3) OV-13's engine-wiring pins are keyless-unreachable by construction (`llmStatus` gate) — the row's keyed distinguishability claim is registered against Step 0's log, not simulated.

*End of W15-LANE 4 deliverable.*
