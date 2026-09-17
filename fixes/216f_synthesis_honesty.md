# 216f — Lane 3: Wave E synthesis honesty (T-09, T-10, T-15)

**Lane:** 3 of the RESUME.md §3.3 wave · **Status: ✅ COMPLETE** — closed 2026-09-16/17 by
W6 · L5 (W1 detectors → W2 wiring + prompts + `:342` closure → W3+ test-load fix → W6 · L5
verification pass: live suite re-runs, TA-1 truth table, TA-21 record).
**Material:** 216f W1 + W2 lane summaries (`subagent-summary-2-20260916_193930_138058.txt`,
`subagent-summary-2-20260916_200339_578951.txt`) + W3-L1's recorded open item
(`subagent-summary-0-20260916_203741_059957.txt`) + W6 · L5 live runs. ⚠ `wave_plans/W6/lane-5.md`
names the "R3 + W3-L1" summaries by file; those two files are the **216i/216k** lanes' — the 216f
material is the three listed here (all real; nothing invented).
**Owned files:** `src/lib/codegen.server.ts` (+ `.test.ts`), `src/lib/prompt-engine.ts` (+ `.test.ts`), this log
**Spec:** `research/multiagent/106_rapidtool_deep_analysis.md` §6 Wave B — T-09, T-10, T-15
**Baselines at handoff:** codegen 72/72, prompt-engine 28/28 (both re-verified on disk before any W2 edit).

## Task status

| Task | Status | Notes |
|---|---|---|
| T-09 — reject prose-in-code at synthesis | ✅ done (W1 detect → W2 wire) | `proseLineHits` (:259) refuses via `validateSynthesisModule` (:1437-1445, `RT_E_VALIDATION`); bounded prose repair prompt (:544) dispatched in single + chunk paths (:2067-2068 / :2313-2314); real leaked blob **11/11** (residual `:342` closed). Suite green — see Verification. |
| T-10 — resolve the synthesis prompt contradiction | ✅ done (W2) | system rule 1 scopes the export ceiling **per file** + forbids hiding logic behind unexported helpers; rules 2/8 advertise the `Math.random` + prose bans; chunk REQUIREMENTS duty scoped to THIS file's signatures. `prompt-engine.ts` intentionally unchanged (upstream rule already pinned). |
| T-15 — ban `Math.random()` in generated code | ✅ done (W1 detect → W2 wire) | `nondeterministicPrimitiveHit` (:206) refuses masked-source `Math.random` (:1417-1429); determinism repair prompt (:528); real `compute-rent-roll.ts:35,40,55` case caught; masked-literal control pinned (e2e). |

## Tier re-confirmation note (T-09/T-10)

T-09 (F-04 prose leak) and T-10 (F-08 prompt contradiction) were observed on the
**pro-tier** keyed run. The default tier is **flash** (T0.1). This lane runs with
**no `DEEPSEEK_API_KEY`** in the sandbox, so a live keyed flash run cannot be executed
here. **Verdict: T-09/T-10 are CARRIED FORWARD UN-REPRODUCED under flash** — what this
lane re-confirms deterministically is that the on-disk pro-tier artifact
(`research/eval-out/coffeehouse2home-property-ledger/src/generated/chunk-0.ts:340-362`)
contains the leaked prose and the model's own statement of the contradiction, and that
the wired gate refuses exactly that artifact shape. Never fabricated.

**W6 · L5 close-out (2026-09-16/17):** unchanged — still no key in the sandbox (`key set: false`),
so the flash-tier runtime re-production of T-09/T-10 remains CARRIED FORWARD; every claim this
lane adds is deterministic (on-disk artifact + wired refusal + executed suites).

## What changed (work log)

**W1 — detectors authored, UNWIRED** (`subagent-summary-2-20260916_193930_138058.txt`):
`proseLineHits()` + exported `ProseLineHit` + constants (`PROSE_MIN_WORDS` etc.) and
`nondeterministicPrimitiveHit()` + `NONDETERMINISTIC_PRIMITIVE` added to `codegen.server.ts`
(pure, exported, dead at W1 exit — the gate refused nothing yet). Baselines measured first:
codegen 72/72, prompt-engine 28/28.

**W2 — wired + prompts + `:342` + tests** (`subagent-summary-2-20260916_200339_578951.txt`):
- `validateSynthesisModule` refuses in order: empty → char bound → markdown fences → forbidden
  primitive (hard/soft) → **`Math.random` (T-15)** → **prose-in-code (T-09)** → unbound exports →
  missing signatures. Today at `codegen.server.ts:1393-1465`; the two 216f refusals at
  :1417-1429 / :1437-1445 (both `RT_E_VALIDATION`).
- Two bounded repair classes + prompts: `p6SynthesisNondeterministicRepairPrompt` (:528),
  `p6SynthesisProseRepairPrompt` (:544) — one re-prompt naming the exact defect, then refuse.
  Dispatched in the single-module path (:2067-2068) and `synthesizeChunkEnvelope` (:2313-2314).
  Repair dispatch priority: unbound → forbidden → missing-signature → nondeterministic → prose.
- `:342` residual closed: a slash-only code-char line now falls through to a STRICTER sentence
  branch (shape on slash-stripped text + ≥6 words / ≥30 letters + sentence terminal — today
  `codegen.server.ts:380-405`). Real leaked blob: **11/11** (W1 was 10/11).
- T-10 contract: system rule 1 scopes the export ceiling per file + forbids hiding logic behind
  non-exported helpers; rule 2 advertises the `Math.random` ban; rule 8 advertises the prose
  refusal; chunk REQUIREMENTS header scopes duty to "every one its TYPE SIGNATURES below cover";
  TYPE SIGNATURES header says "THIS file's share of the project" (literal marker
  `TYPE SIGNATURES (must export` deliberately preserved — load-bearing for the test-internal
  detector + `chunkedDeps`).
- Scope decision: the chunk gate is **LLM-only by construction** (callers = the two synthesis
  drivers + repair re-checks; scope note :1432-1436); scaffold-authored `src/main.tsx` never
  reaches it; pinned by the `chunk-gate scope` test.

**W3+ — test-load fix:** `codegen.server.test.ts` had been left not-loadable by the W2 test
append (JSDoc `*/` closed by the glob path — `ERR_INVALID_TYPESCRIPT_SYNTAX` at :1478; recorded
still-open at W3 in `subagent-summary-0-20260916_203741_059957.txt`). On disk now: the quoted
path is `research/eval-out/<app>/src/main.tsx:11` (:1476) and the 216f block
(:1458 "216f (W2 · R3)" — describes at :1566 / :1612 / :1669 / :1779) loads and passes.

**W6 · L5 — completion pass:** live suite re-runs, TA-1 truth table, TA-21 record (all below);
this body filled from the summaries above.

### old→new

| Surface | Old | New (on disk) |
|---|---|---|
| `validateSynthesisModule` | no prose / nondeterminism checks | refuses both (T-15 :1417-1429, T-09 :1437-1445) |
| `proseLineHits` on the real blob | 10/11 — `chunk-0.ts:342` evaded (`/` in `flip/rental/field ops` bypassed the sentence branch) | **11/11** — slash-only lines hit the stricter branch (:380-405) |
| p6 system prompt rule 1 | "Export EXACTLY the functions … nothing more, nothing less" vs chunk "implement every one" (unsatisfiable) | export ceiling scoped per file; hiding logic behind unexported names forbidden; bans advertised |
| chunk prompt | duty unscoped | REQUIREMENTS duty = this file's signatures; header "THIS file's share of the project" |
| repair | none | 2 bounded repair prompts (:528/:544), one attempt then refuse |
| `codegen.server.test.ts` | 72 tests; then load break at :1478 | 86 tests / 19 suites green (W6 · L5) |

## Evidence (commands + real observed output)

Historical (from the lane summaries — recorded observations, unchanged):

```text
# W1 pre-edit baselines
node --experimental-strip-types --test src/lib/codegen.server.test.ts  → # tests 72 # pass 72 # fail 0
node --experimental-strip-types --test src/lib/prompt-engine.test.ts   → # tests 28 # pass 28 # fail 0

# W1 probe (outside repo, _probe_216f7/8/9.mjs)
blob hits: 10 lines: 344,346,348,350,352,354,356,358,360,362    ← :342 evaded
false-positive battery (kanban, jsdocNoStar, templateProse, stringArray, …) → 0 hits each
T-15: nondet plain: "Math.random"; rent roll: "Math.random" (real compute-rent-roll.ts)

# W2 probe (_probe_216f_w2.mjs, outside repo)
blob hits: 11 lines: 342,344,346,…,362                          ← residual CLOSED
whole-tree scan: only chunk-0.ts (the leak) + main.tsx:11 ×5 (scaffold-authored, out of scope)
validator: legal control → OK
  leaked blob  → RT_E_VALIDATION :: prose-in-code in generated module (11 prose lines; first at line 4: "Given the constraints, …")
  Math.random  → RT_E_VALIDATION :: non-deterministic primitive … (Math.random)

# W2 post-code-edit regression (before the test append)
codegen 72/72 fail 0; prompt-engine 28/28 — no drops
# W2 after the test append (the recorded break)
# tests 1 / # pass 0 / # fail 1 → SyntaxError [ERR_INVALID_TYPESCRIPT_SYNTAX] at line 1478
```

W6 · L5 live (2026-09-17T02:52Z, repo root):

```text
node --experimental-strip-types --test src/lib/codegen.server.test.ts
  → # tests 86  # suites 19  # pass 86  # fail 0  # skipped 0
node --experimental-strip-types --test src/lib/prompt-engine.test.ts
  → # tests 28  # suites 6   # pass 28  # fail 0  # skipped 0
grep -n "proseLineHits\|nondeterministicPrimitiveHit\|ProseLineHit\|RepairPrompt"
  → proseLineHits :259 · nondeterministicPrimitiveHit :206 · ProseLineHit :212 ·
    p6SynthesisNondeterministicRepairPrompt :528 · p6SynthesisProseRepairPrompt :544
  → refusal :1443 · dispatches :2067-2068 / :2313-2314
```

## The chunk-0.ts:342 residual gap — CLOSED (tightened, not documented)

W1 missed exactly one line of the real leak — `chunk-0.ts:342` ("Given the constraints, … trigger
`flip/rental/field ops` …"): the `/` is in `PROSE_CODE_CHARS` and the line has no parens, so it
bypassed the old sentence branch (W1 probe v9 diagnosis: `342 hits: 0`, `342 non-ascii: "/"`).
W2 tightened `proseLineHits` so a slash-only code-char line falls through to a STRICTER sentence
branch (shape on slash-stripped text + ≥6 words / ≥30 letters + a sentence terminal — today
`codegen.server.ts:380-405`; the code comments name the `:342` evader). Re-proof: outside-repo
probe against the real blob → **11/11 (342,344,…,362)**.

## The src/main.tsx:11 false-positive + the chunk-gate scope decision

The only other prose-detector hits in all emitted trees are `src/main.tsx:11` (all five apps):
`import Console from "./ui/console";` — its string literal blanks to a semicolon tail. It can
never be the operative refusal: `import` is FORBIDDEN_HARD and is checked BEFORE the prose rule
(:1411-1416 runs before :1437), and the `chunk-gate scope` test pins exactly this layering
(the main.tsx-shaped fixture is refused for `import`, never for prose; the UI body minus imports
= 0 prose hits). Deliberately not loosened — a length/import-keyword exemption would weaken the
gate for real prose.

**Scope decision:** the chunk gate is LLM-chunk-only by construction — its only callers are the
two synthesis drivers + their repair re-checks (scope note at :1432-1436). Scaffold-authored
files never pass through it; do not "fix" the detector to accommodate them.

## Verification

- **W6 · L5 live (2026-09-17T02:52Z):** codegen.server **86/86 pass, 0 fail, 19 suites**;
  prompt-engine **28/28 pass, 0 fail, 6 suites** — the 216f block loads and passes; baseline
  72 → 86, growth with no drops.
- Historical: W2 post-code-edit regression green before the test append (72/72 + 28/28);
  the recorded load break was then fixed (bytes at :1476 + the green run above).
- `npm run typecheck`: was NEVER run by the 216f lanes (W1/W2/W3 each recorded this as an open
  item), and W6 · L5 did not run it either — this is a verification lane that touched no code
  (wave rule 4: typecheck only if code was touched). Mitigation: both suites execute the module
  through strip-types green, and the wave-boundary `gate.sh` runs include typecheck
  (`README.md:102` — first green run 2026-09-16).

## TA-1 truth table — the four `[lane-reported]` blockers (`research/multiagent/100_factory_blockers.md:37-41`)

Verified 2026-09-16/17 by W6 · L5 against live bytes (commands from repo root; every row names
file:line + the falsification attempt). Note: :40 (P1-05) is ✅ **PV** in the dossier and is NOT
one of the four lane-reported rows — the four are :37 P1-02, :38 P1-03, :39 P1-04, :41 P1-06.

| ID | Lead (as reported) | Verdict | Evidence (file:line + command output) |
|---|---|---|---|
| **P1-02** | No unattended scheduling — "no cron/daemon/queue surface; nothing can run the factory on its own" | ✅ **VERIFIED** (still true) | `grep -rniE "node-cron\|cron\|bullmq\|ioredis\|agenda\|node-schedule\|daemon\|nohup\|systemd\|launchd\|worker_threads\|child_process" src/ scripts/ package.json` → only `child_process` imports (`node-runner.server.ts:22`, `compile-check.server.ts:23`, `scripts/preview.mjs:12`, `scripts/with-app-env.mjs:22`) — all caller-driven. `setInterval` grep → client-only polling (`console.tsx:903,908,3797,5263`, `runtime-timeline-pane.tsx:91`, `rt-client.ts:475`, `p2p.ts:133`, `auth/client.ts:202`). `package.json` read → no scheduler/queue dep. No `.github/` at repo root → no scheduled workflow. **Falsification:** searched for any loop that runs the pipeline without a human/CLI caller — none; `research/eval-out/_keyed-launcher.sh` is a manual launcher (`npm run eval -- --keyed` typed by a person). |
| **P1-03** | `acceptanceFixtures` absent in the keyed project; `humanFixtures` has no writer anywhere | ✅ **VERIFIED** (with a precision note) | `grep -o "acceptanceFixtures\|humanFixtures" research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json` → **zero hits** (also zero across all of `research/eval-out/`). `humanFixtures` repo-wide grep (src/scripts, non-test) → **reader-only**: `doctor.ts:30,152-163,174,189,217,247`; `RAPIDTOOL_FACTORY_EVIDENCE` frozen with `humanFixtures:false` (:174); the factory latch itself REQUIRES `evidence.humanFixtures === true` (:217) ⇒ the human bar cannot be met by any code path. **Precision note:** `acceptanceFixtures` DOES have a human-driven writer today — CLI `fixtures --draft/--approve/--approve-all` (`scripts/rapidtool-cli.mjs:865-916`; `approveFixtureCases` strips forged actors) + engine coercion (`engine.ts:2302-2321`) — but the keyed artifact never used them and nothing auto-produces either field. **Falsification:** searched for a producer that mints `humanFixtures:true` or auto-writes `acceptanceFixtures` — none exists (only the human-run `fixtures` verb). |
| **P1-04** | The benchmark's "human seat" is performed by the harness stamping `human` (`run-eval.mjs:273,295`) — *"high impact if true; verify before publishing"* | ⛔ **STALE** — fixed since the dossier (216 TA-2, landed W2) | `run-eval.mjs` is now 1349 lines; `:273` is grader JSON parsing (old anchor no longer describes approve code); the ONLY `approve(` call is `:673 p = approve(p)`. Today it takes the default actor `HARNESS_APPROVE_ACTOR = { decidedBy:"autopilot", seat:"harness" }` (`headless.ts:735`), routed through the policy seam (`headless.ts:758-806`) — a machine path **cannot** mint `decidedBy:"human"`. The file records it: `run-eval.mjs:647-653` ("216 TA-2: `approve()` never mints `decidedBy:"human"` for a machine path; a forceHuman gate therefore STALLS the drain honestly"). Pinned: `headless.test.ts:1319` ("the default approve records the harness autopilot seat, never a human actor"); `README-cli.md:930-958` documents the human seat + `RT_HUMAN_SEAT_TOKEN`. `grep -n "human" scripts/run-eval.mjs` → only the pass@k "human-eval reading" naming (:435) + that TA-2 comment. **Falsification:** hunted for any remaining harness path stamping `human` — none. ⇒ the "verify before publishing" warning can be retired. |
| **P1-06** | P9 emits canned `rapidtool-gate` GitHub-Actions YAML + a GCP/Firebase sketch — templates, not executed pipelines | ✅ **VERIFIED** (TA-21 residual below) | `src/lib/engine.ts:1030-1074` (P9 case): canned YAML `name: rapidtool-gate` (:1038) + "IaC sketch" (`# GCP + Firebase hosting`, :1057-1062). They reach disk as recorded artifacts rendered verbatim into DEPLOY.md — `scaffold.ts:1979-1993` (`recordedArtifacts`) under `scaffold.ts:2081-2091` ("Verbatim from the project artifacts — recorded, never executed:"); real emitted sample `research/eval-out/field-ops-suite/DEPLOY.md:58-85`. Nothing executes them: **no `.github` / workflow file is emitted anywhere** (repo root has no `.github`; no yml/yaml in any emitted tree); only copies live in `.rapidtool/project.json` + DEPLOY.md. Honesty framing already landed (E-27): `DEPLOY_HONESTY_STAMP` (`scaffold.ts:115-117`) pinned verbatim by `scaffold.test.ts:526`; DEPLOY.md "The pipeline **recorded** … it never executed or validated them". `grep -rn "template — not executed" src/ scripts/ README.md AGENT_GUIDE.md` → **0 hits** (the TA-21 residual). **Falsification:** searched for the exact marker + for any executed pipeline — marker absent, pipeline non-existent. |

## TA-21 record — P9 deploy-artifact honesty (`template — not executed` marker)

Board done-when (`taskuniverselog.md:178`; `105_plan_critique.md:488-496`): *each emitted deploy
artifact either runs (asserted by a scratch run) or its body/filename carries an explicit
`template — not executed` marker, with a test pinning the marker; the README claim matches.*

| TA-21 item | State | Record |
|---|---|---|
| Per-artifact `template — not executed` marker | ⏸ **DEFERRED** (not fixed — ownership) | The marker surface is `engine.ts` artifact bodies/titles or `scaffold.ts` render labels — both **owned by W6 · L1** this wave (`wave_plans/W6/lane-1.md` ownership line; mid-flight edits observed: `scaffold.ts` 19:32, `engine.ts` 19:57, `codegen.server.ts` 21:39). W6 · L5 edits only disjoint files; "when in doubt, REPORT don't edit". **Minimal fix recipe for the owner:** (a) append the phrase to each P9 artifact body in `engine.ts:1030-1074` and/or the `recordedArtifacts` label (`scaffold.ts:1984`), and/or (b) to the caption at `scaffold.ts:2083`. |
| Test pinning the marker | ⏸ **DEFERRED** (same ownership) | Home is `src/lib/scaffold.test.ts:524-539` (the `DEPLOY_HONESTY_STAMP` pin at :526 is the existing pattern — it pins the stamp verbatim, not the TA-21 phrase). W6 · L1 owns `scaffold.test.ts`. |
| README claim matches | ✅ **NO CHANGE OWED** | `grep -ni "deploy\|ci/cd\|iac\|github actions" README.md` → **0 hits** — README makes no deploy-artifact claim to match or strike; the only adjacent text is the honest P7–P12 limits bullet (`README.md:112-114`). (README "Progress so far" is W6 · L4-owned anyway.) |
| "runs OR is marked" (structural half) | ✅ **TRUE today** | Nothing is emitted as a runnable pipeline (zero workflow files anywhere); the artifacts are recorded + captioned "recorded, never executed" (`scaffold.ts:2083` → emitted `DEPLOY.md:58`) and the file carries the pinned honesty stamp. Only the literal marker phrase + its pin remain. |

**Verdict line:** P1-06 VERIFIED; TA-21's intent is largely already on disk (the E-27 stamp,
the "recorded, never executed" caption, and the stamp pin); the strict-literal residual
(exact marker + pin) is DEFERRED to the file owners (W6 · L1) with the exact patch recipe above.

## Not done / deferred

- **Flash-tier keyed re-production of T-09/T-10:** still un-reproduced (no `DEEPSEEK_API_KEY`;
  unchanged from W1). All evidence above is deterministic-artifact + executed-suite evidence.
- **`npm run typecheck`:** not run by any 216f lane, nor by W6 · L5 (verification lane, no code
  touched; wave rule 4). Wave-boundary `gate.sh` runs cover it (README.md:102).
- **prompt-engine bridge assertion** (expand→chunk hand-off): planned, not written — W2
  concluded the upstream rule is already pinned (`prompt-engine.test.ts:155-162`).
- **TA-21 residual items:** deferred per ownership (`engine.ts` / `scaffold.ts` / `scaffold.test.ts`
  = W6 · L1) — recipe above.
- **Scratch probe files outside the repo** (`C:\Users\mnril\_probe_216f*.mjs`, `_216f_*.txt/mjs`):
  outside the tree; deletion is cosmetic and owed to nobody in-repo.
