# RESUME.md — RapidTool factory upgrade handoff

**Written:** 2026-09-16 (end of the session that ran the triple-parallel analysis + kicked off Phase 0
/ Wave D enactment). **Read this first, then `taskuniverselog.md` (the live task-status board — every
dossier's tasks, statuses, and the next-wave plan) and
`research/multiagent/104_factory_upgrade_plan.md` (§1–§11), the master plan this file indexes.**

---

## 0. How to use this file

> **⚠️ MANDATORY READ ORDER every session: `AGENTS.md` → this file (`RESUME.md`) →
> `taskuniverselog.md` (repo root) → `remainingwaves.md` (repo root). `taskuniverselog.md` is the
> live task-status board — every task from every dossier with status, size, evidence, and the
> next-wave plan. `remainingwaves.md` is the per-wave execution catalogue (W5→W12: lanes, tasks,
> files, done-when, estimates, risks). Read both before acting, verify statuses against disk, and
> update them at every wave boundary — they are how the next session resumes accurately (§14).**

1. **Read §1 (state) and §2 (the gate contract).** Reproduce the four gates *before* changing
   anything — if they are not green on a frozen tree, stop and find out why first.
2. **Read §5 (hard rules).** These are not style preferences; every one of them was learned by
   breaking something in this repo. They are the highest-value content in this document.
3. **For a 5-agent wave, copy the briefs in §3 verbatim.** They encode disjoint file ownership, and
   the guardrails that made three parallel coder lanes report honestly (including the one that failed).
4. **§4 is the prioritized backlog.** Do not invent work — everything is already specified in the
   dossiers with `file:line` and a done-when.
5. **If you are a NEW session picking this up cold, jump to §9** — it has a paste-ready resume
   prompt, the literal first commands, and how to orient with the CLI before reading any code.
6. **§10 is the decision log.** Several choices look wrong if you don't know why they were made
   (e.g. why a parse gate deliberately fails *open*). Read it before "fixing" them.
7. **§1.4 has per-suite baselines.** Before you change anything, note the count of the suite you're
   about to touch — that is how you detect what YOU broke, in one command.

---

## 1. Current state (verified, frozen tree)

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` — git repo, branch `main`, Node v22.23.2.
MSYS/git-bash paths: `/c/Users/mnril/Desktop/RapidTool Main` (**note the space** — see §5.1).

### 1.0 The mission and the acceptance bar (read before judging any "done")

**What this is.** RapidTool is a governed, phase-based AI software factory: a brief goes in, a
migrated application comes out, through **13 phases** with human-in-the-loop gates, a decision
**ledger**, a **packet** for the agent, and gates that are supposed to refuse to lie. It is the
user's bid to beat the open-source app-builder field (Codex, OpenHands, bolt.diy, Lovable-class
tools) with a *governance and honesty* edge rather than a raw-generation edge. That edge is the
product — **"LEAPFROG" means determinism + governance + honesty**, not "generates more code".

**The acceptance bar — what "green" means here.** A function is only green when it passes
**human-approved, brief-derived input→output fixtures executed by the harness**. A module that
merely *compiles*, a spec that merely *exists*, and a suite that merely *passes tautologies* are all
explicitly NOT green. **Field truth as of this handoff: `doctor` reports
`autonomousSoftwareFactory: false`** — the factory is not yet autonomous, and no claim in this repo
should imply otherwise.

**The maker test that matters most.** The user is building RapidTool's **Coffeehouse2Home / Property
Ledger real-estate suite** for a house-flipper/realtor friend. That suite is the **10/10 maker
test**: if the factory can produce a real, working real-estate app the friend can use, the thesis is
proven. Judge task priority against that, not against test counts.

**The core product failure still open (P0-04) — understand this before touching scaffold/engine.**
All **five** jobs of a generated product re-export **one** file:

```
flip/publish/record/show/track.ts:10 → export * from "../generated/check-reorder-flags.ts"
doctor --tree → { stubs: 0, reexports: 5, real: 0 }
```

i.e. the factory currently emits a *single-module* product wearing five filenames. **T-04/T-05
(Lane 1) and TA-15 are the tasks that address this.** Any work that makes the emitted product look
more complete without making those five jobs real is cosmetic — say so rather than reporting it as
progress.

### Gate state — all four GREEN, verified after every writer stopped

| Gate | Exact command | Observed |
|---|---|---|
| test | `npm test` | **scripts 195/195 + src 1662/1662, 0 fail** |
| typecheck | `npm run typecheck` | **exit 0** |
| lint | `npm run lint` | **exit 0** |
| build | `npm run build` | **exit 0** (vite build + `db:migrate`; prints the honest *"DATABASE_URL not set — skipping (the PGLite fallback migrates itself)"*) |

Total suite: **1857 tests** (195 + 1662). At session start it was 1634; the session added **+223**
tests, all green.

### Scale of the session

- **62 files** modified under `src/` + `scripts/`.
- **13 dossiers** produced under `research/multiagent/` (8 analysis lanes, ~460KB) + the master plan
  `104_factory_upgrade_plan.md` grown to **§1–§11**.
- **5 delegation waves** dispatched: `deleg_9272975b` (4 lanes), `deleg_cc524faa` (4), `deleg_910b18c2`
  (4), `deleg_ce83401c` (3 coder lanes). All closed.
- **17 competitor repos** cloned read-only to `C:\Users\mnril\rt-competitors` (1.7GB).

### Reproduce the state

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
npm run typecheck && npm run lint && npm test      # expect 0 / 0 / 1857 pass
git status --short -- src scripts                  # 62 modified — see §6 for attribution
```

### 1.4 Per-suite baselines — use these to find out what YOU broke

Run a single suite (fast, ~1–2s for most):

```bash
node --experimental-strip-types --test src/lib/<name>.test.ts 2>&1 | grep -E "^not ok|^# (tests|pass|fail)"
```

**Before you edit a file, note its suite's count. If it drops, you caused it.** Baseline counts at
handoff (all `fail 0`):

| Suite | Tests | Suite | Tests |
|---|---|---|---|
| `codegen.server.test.ts` | **72** | `algorithms.test.ts` | **75** |
| `headless.test.ts` | **74** | `algo-tools.test.ts` | **24** |
| `compile-check.server.test.ts` | **28** | `typed-failures.test.ts` | **4** |
| `verify.server.test.ts` | **15** | `gates.test.ts` | **83** |
| `scaffold.test.ts` | **32** | `maker-score.test.ts` | **74** |
| `deepseek.server.test.ts` | **21** | `llm.test.ts` | **14** |

Leg totals: **scripts 195** + **src 1662** = **1857**. Adding *N* tests should raise the total by
exactly *N* — if a total is unchanged after you added tests, something silently lost them (this
exact failure mode is why T-16 exists).

---

## 2. What landed (with the evidence that matters)

### 2.1 Phase 0 — governance + honesty (parent)

| Task | Change | Evidence |
|---|---|---|
| **T0.1** | P6 synthesis tier **pro → flash** (12 sites: the `P6_SYNTH_MODEL` constant + header comments + 3 `modelRoute` stamps) | 69/69 codegen, typecheck 0. Rationale: V4.1-Flash beats Pro on **every** agentic/coding bench (DeepSWE 74.2 vs 62.7) |
| **T0.2** | Stale model-id claims corrected (`dod.ts`, `phases.ts`) | precision fix, no behaviour change |
| **T0.3 / T0.9** | Doc drift: `AGENTS.md` "NOT a git repo", verb counts, README "1632/1632" → measured | re-grepped against disk |
| **T0.5** | `llm.ts` facade now forwards the `thinking` opt | 14/14 |
| **T0.6** | `deepseek.server.ts` success-path `res.json()` guard → HTTP-200 non-JSON becomes `RT_E_INTERNAL` with a bounded excerpt | 21/21 |
| **T0.7** | **CLI `approve` now requires `--i-am-human` for ANY non-TTY call** (the guard previously covered only `--force`, so an agent could silently mint `decidedBy:"human"`) + a regression test | headless **74/74**, incl. `ok 11 - 216 T0.7: a non-TTY approve cannot mint decidedBy:human` |
| **T0.8** | `dod.ts` criteria now probe the **decision ledger actor**, not a phase-record proxy (declare-or-strike: the unfounded "HITL/human" wording was struck, the check made strictly stronger) | gates 83/83, maker-score 74/74 |

**T0.7 reproduced before it was fixed:** a non-interactive `approve` gave exit 0 with ledger
`P4 approve | decidedBy: human` and no note.

### 2.2 Wave D — stop the emitted-tree corruption (parent)

The headline defect, found by lane 106: **`stripCjsExportAssignments` corrupted every generated
module (431 tsc errors traced to it)** and the green 1634-test suite was *structurally incapable* of
noticing, because the test only fed the single-line CJS form.

| Task | Change | Evidence |
|---|---|---|
| **T-01** | The construct is now removed **WHOLE**: new `bracketDelta()` (string/comment-aware) tracks the depth the assign opens and skims to its matching close | **Empirical before/after**: PRE-fix **2 of 4** realistic CJS shapes produced unparseable output (`SyntaxError: Unexpected token '}'`, and a second one *not in the audit report*: a `}` inside a string literal); POST-fix **0 of 4** |
| **T-16** | 3 regression tests that **assert on parse, not text shape**, incl. a **teeth check** pinning the pre-216 output as invalid | codegen **72/72** |
| **T-02** | The parse gate now sits **on the write path**: exported `parseVerdictForSource` (compile-check) + `parseGateTreeRows` (headless) + `applySynthesizedTreeToDir(..., refuseNonParsing)` | compile-check **28/28** (+5 new) |
| **T-03** | Tree writes are **atomic** (tmp + `renameSync`), so a crash cannot leave a truncated artifact | headless 74/74 |
| **T-06** | `treeUpgraded` sets `lastTest: null` — a stamp can no longer outlive the artifact it described (F-02: packet said `ok:true` while the shipped test exited 1) | codegen **72/72**, one test assertion deliberately updated (old → new recorded in plan §10) |

### 2.3 Coder wave `deleg_ce83401c` — 3 parallel lanes (+19 tests)

| Lane | Files | What landed | Lane's own evidence |
|---|---|---|---|
| **A** | `verify.server.ts` + test | 109's **T-01** (`HARNESS_EXPORTS` inventory → *"module exports no callable names — machine verification is vacuous"*, last-inventory-line-wins), **T-02** (`identifierHits` over `stripStringsAndComments` + must hit a *called* identifier), **T-03** (`>>=`/`<<=`/`>>>=` now rejected; dead arrow branch deleted), **T-04** (`constructor`/`prototype`/`__proto__` blocklisted; the false "can never break out" docblock replaced with an honest-scope note), **T-05** (`__mod.exports` folded onto `__exports`), **T-12** (6-assertion regression block) | 15/15 pass. **Revert-check**: reverted to HEAD in a temp tree → **8 of 9 fix assertions went RED** while the `exports.add` control stayed green |
| **B** | `scaffold.ts` (+ test) | 106's **T-08**: the tautological acceptance floor killed — an unimplemented row no longer emits `"<id>".length > 0` but a **visibly-marked `test.skip("<id> — NOT IMPLEMENTED")`**; new single-source-of-truth census seam (`OracleRowKind`, `OracleRowSurface`, `oracleRowSurface`, `oracleRowKind`, `censusOracleRows`) | ⚠️ **left the tree non-typechecking — see §2.4** |
| **C** | `algorithms.ts`, `algo-tools.ts` + tests | 112's **T7** (token cache keyed on the **text**, not `fnv1a` — a real collision was reproduced: `fnv1a("rjmr") === fnv1a("lasipzafzrmsnlpmtfnstxtvfmtmnet")`, making the estimate **call-order dependent**, 16 vs 3), **T8** (`contiguousRun` → one KMP pass, exported; `fusionRank` tokenizes once per row — **score-preserving, golden frozen**), **T10** (masker template-content vs code modes; `lineOf` → `linesOfIndices` single pass), 109's **T-06** (halving probe is **header-only**; body-level shape → an `extras` note) | 75 + 24 + 4 pass; golden `r1 0.624 → s1 0.549 → … → e2 0.209` byte-identical |

**Cross-lane attribution worked exactly as designed:** lane A's typecheck found lane B's breakage and
correctly attributed it (`scaffold.ts(1882,8) … a sibling agent's file, not mine`), and lane C reported
its own `sweep73-fuzz.test.ts` could not even **load** because of lane B's duplicate declaration.

### 2.4 Parent repair of lane B (the tree was RED on wave exit)

Lane B reported honestly — *"INCOMPLETE — the file does not currently typecheck; verification was NOT
run"* — instead of claiming green. The parent then fixed **5 type errors → 0**:

1. **TS2554** `scaffold.ts:1896` — `commandBlock` gained a 3rd parameter (`census: OracleRowCensus |
   null`); its one call site inside `readmeBody` was not updated. Lane B *had* already threaded
   `oracleCensus` into `readmeBody` (5th param, passed at the `:2255` call site) and missed the last
   hop. **⚠️ The tempting shortcut — passing `null` — would have introduced a NEW honesty bug**:
   `notImplemented` would read `0` while the emitted spec skips rows. Pass the census, never default it.
2. **TS2451 ×4** `scaffold.ts:2210/:2214` vs `:2288/:2293` — a duplicated `jobLabelOf` + `generated`
   pair in the **same function scope** (the census block inserted ahead of the originals). Bodies were
   byte-identical → deleted the later pair.
3. **`scaffold.test.ts:443`** counted lines starting with `test(` (the pre-T-08 tautology count).
   Recorded **old → new**: now counts **both** `test(` and `test.skip(` (the test's stated intent is
   that rows materialise as single-line entries, not that every row is executable) **and** pins the
   new contract — every `test.skip(` line must contain `NOT IMPLEMENTED`.

### 2.5 Recovered deliverables

- `fixes/216a_verify_lane_216.md` and `fixes/216c_algorithms.md` — lanes A and C hit their iteration
  cap **after** finishing code but **before** writing their landing logs. Both were **recovered by the
  parent** from their final summaries (the documented recovery pattern), each stating plainly that it
  is a parent recovery.
- ⚠️ **`fixes/216b_oracle_floor.md` was never written** — lane B never reached it. **Open item:** write
  it from lane B's summary (`subagent-summary-1-20260916_185726_439609.txt`) or from the repair above.

---

## 3. The 5-agent wave (copy these briefs verbatim)

### 3.0 The guardrail block — include this in EVERY lane brief

This block is the reason three concurrent lanes produced honest reports and zero collisions. Do not
trim it.

```text
REPO: C:\Users\mnril\Desktop\RapidTool Main (Node v22.23.2). HOST QUIRK: the path contains a SPACE,
so search_files/ripgrep FAIL — use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
Read `AGENTS.md` at the repo root FIRST (the repo's own contract).
Read `RESUME.md` at the repo root (session handoff: gate contract + hard rules), `taskuniverselog.md`
(the live task-status board — check YOUR task's current status there), and the research dossier
named in your task (each fix is already specified with file:line and a done-when — your job is to
ENACT it, not re-derive it).

MANDATORY WORKING RULES — the parent will reject violations:
1. PATCH-ONLY on existing files. Use the `patch` tool with small targeted old_string/new_string edits.
   NEVER use write_file to rewrite an existing file. Re-read the exact region immediately before
   patching (line numbers drift as siblings edit).
2. NO mock, demo, stub, placeholder or TODO code. Production quality only, real working logic, same
   code style as the file (explicit `.ts` import extensions; TSDoc comments carrying the finding id).
3. NEVER run `git checkout`, `git stash`, `git reset`, `git clean`, or `git commit`. Another agent's
   work may be in the tree; reverting is the parent's call, not yours.
4. Do NOT run the full `npm test` or `npm run build` — siblings are mid-edit and the repo rule is
   never to run the full gate while agents are editing. Verify with:
     npm run typecheck
     node --experimental-strip-types --test <your test file(s)>
   Both must pass before you claim done.
5. Stay strictly inside your owned files. If a fix needs a change elsewhere, STOP and REPORT it —
   do not make it.
6. Every claim in your report must be backed by a command you actually ran and its real output.
   NEVER invent test counts or results. If you run out of budget mid-edit, SAY SO PLAINLY and describe
   the real state — an honest "incomplete, does not typecheck" is far more valuable than a claimed
   green. (A lane in the previous wave did exactly this and it is the reason a broken tree was caught
   immediately.)
7. If an existing test pins the OLD (buggy) behaviour, you may update it deliberately — but record
   old → new in your log with the reason, and NEVER weaken an assertion or delete a test to get green.
8. Write your landing log at the path given in your task (you are its ONLY writer). Record: task id,
   what changed, file:line, the command you ran, the observed result.
```

### 3.1 Lane 1 — finish Wave D in the scaffold (T-04 + T-05)

- **Owned files (only these):** `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`
- **Spec:** `research/multiagent/106_rapidtool_deep_analysis.md` §6, tasks **T-04** and **T-05**
  (also 106 §3 findings F-03 and F-07's scaffold half).
- **T-04 (✅ landed W2 — `taskuniverselog.md` §2.1):** the declared tree entry `src/generated.ts`
  (the *emitted* tree's entry path — `TREE_ENTRY_PATH`, `codegen.server.ts:1514`; not a file in this
  repo) was refused by the scaffold's own `TREE_ALLOWED_ROOTS` (refs as issued: `scaffold.ts:188-195`,
  `:227`; silent drop `:1975`). Landed: exact-match allow-list (`scaffold.ts:296`) + loud coded
  refusals (`warnings[]`) — never a silent drop.
- **T-05:** the emitted UI imports a **literal** path (`scaffold.ts:790-793`) that the tree pass never
  writes, instead of the computed `treeEntryPath` (`:1996-2005`).
- **Owed from the previous lane:** write `fixes/216b_oracle_floor.md` (lane B's T-08 work) if §2.5
  above has not already covered it — you are the natural owner of that scaffolding context.
- **⚠️ Highest risk for you:** emitted scaffold text is pinned by tests asserting exact generated
  bytes. Expect failures; handle each deliberately and record old → new. If a pinned expectation
  cannot be satisfied without editing a file you do not own, stop and report.
- **Done-when:** `npm run typecheck` 0; `node --experimental-strip-types --test src/lib/scaffold.test.ts`
  green; plus report which *other* suites import scaffold (`headless.test.ts`,
  `compile-check.server.test.ts`, `sweep73-fuzz.test.ts`) so the parent can run them.
- **Log:** `fixes/216d_scaffold_waveD.md`

### 3.2 Lane 2 — F-07 red-tree emit + the remaining half of P0-01

- **Owned files (only these):** `src/lib/headless.ts`, `src/lib/headless.test.ts`,
  `scripts/run-eval.mjs`
- **Spec:** `research/multiagent/106_rapidtool_deep_analysis.md` §6 **T-07** (finding F-07) and
  `research/multiagent/105_plan_critique.md` **TA-2** (contradiction **C3**).
- **T-07 (P0):** the engine logged a **red tree three times and shipped it anyway**, with the phase
  rail claiming P6 `complete`. `emit` after a `p6.tree.failure` with no subsequent green tree-run must
  either **fail with a coded error** or stamp an **unmissable banner** into the emitted `README.md`.
  Pin **both** branches in a test.
- **TA-2 (P0-01's other half):** `headless.ts` `approve()` (`:~725-734`) **still hardcodes
  `decidedBy: "human"`**, and `scripts/run-eval.mjs:42,295` calls it directly (`p = approve(p)`), so the
  benchmark's "human seat" is still a **machine stamp**. T0.7 closed only the **CLI** path. Give the
  harness a real, **labelled** seat (never the bare default `"human"`) with the out-of-band token path
  documented.
- **Done-when:** `npm run typecheck` 0; `node --experimental-strip-types --test src/lib/headless.test.ts`
  green; both T-07 branches pinned; a keyed run's HITL ledger rows carry a distinguishable actor.
  (**Note:** a keyed run needs a valid `DEEPSEEK_API_KEY` — the user has said they will update it
  later. Pin the behaviour with an injected seam instead of blocking on the key, and say so.)
- **Log:** `fixes/216e_red_tree_emit_and_seat.md`

### 3.3 Lane 3 — Wave E honesty in synthesis (T-09, T-10, T-15)

- **Owned files (only these):** `src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts`,
  `src/lib/prompt-engine.ts`, `src/lib/prompt-engine.test.ts`
- **Spec:** `research/multiagent/106_rapidtool_deep_analysis.md` §6 Wave B — **T-09**, **T-10**, **T-15**.
- **T-09:** **reject prose-in-code at synthesis** — 23 lines of LLM deliberation
  (`chunk-0.ts:340-362`) were shipped inside a module body. Detect and refuse (or strip with a coded
  log) prose that is not code.
- **T-10:** resolve the **prompt contradiction** — "export exactly these signatures, nothing more" +
  "implement every requirement" is **unsatisfiable**; *the model itself said so* at `chunk-0.ts:350`.
- **T-15:** **ban `Math.random()` in generated code** — the emitted `compute-rent-roll.ts:40,55` mints
  random ids in a nominally deterministic system.
- **⚠️ Note:** T-09/T-10 were observed on the **pro-tier** run. The default is now the **flash** tier
  (T0.1), so re-check whether the behaviour still reproduces before attributing it to the model tier —
  and say explicitly in your log whether you re-confirmed or are carrying the finding forward.
- **Done-when:** `npm run typecheck` 0; codegen **72/72** + prompt-engine suite green (both had 0
  failures at handoff — if either drops, you caused it).
- **Log:** `fixes/216f_synthesis_honesty.md`

### 3.4 Lane 4 — judgment + durable learning (112's T1–T4)

- **Owned files (only these):** `src/lib/knowledge.ts`, `src/lib/knowledge.test.ts`, **new**
  `src/lib/judgment.ts` + `src/lib/judgment.test.ts`
- **Spec:** `research/multiagent/112_code_judgment_and_learning.md` §6 — tasks **T1, T2, T3, T4**
  (skip T9 — see the warning below).
- **T1** failure-signature ids (today the id hashes free text, so **the same failure forks a new
  lesson row every run**, and the 80-row FIFO evicts real lessons).
- **T2** *counterexample-or-nothing* — no anchor ⇒ `refuse:no-proof`, no lesson written.
- **T3** a **pure** `judgePhase(project, phase)` verdict ladder in a new `judgment.ts` (**no LLM in the
  module**).
- **T4** thread `KnowledgeStore` rows into the expansion prompt (`opts.proven` already exists at
  `knowledge.ts:93`; only the plumbing is missing).
- **⚠️ Two hard warnings:** (a) do **NOT** touch the stemmer (`112`'s T9, `-ies → y`) — it is a
  behaviour change with **MED-HIGH test risk and must land alone**; (b) the permanent
  `KnowledgeStore` is **append-only and no machine path may write it** (only human
  `lesson --accept`, `rapidtool-cli.mjs:1681-1683`) — keep that invariant.
- **Done-when:** `npm run typecheck` 0; `node --experimental-strip-types --test src/lib/knowledge.test.ts`
  (and your new judgment test) green.
- **Log:** `fixes/216g_judgment_learning.md`

### 3.5 Lane 5 — the UI wave (what the owner cares about most)

- **Owned files (only these):** `src/components/console.tsx` + any new UI component files you add;
  **plus** the two dossier files you may append to: `research/multiagent/110_ui_audit_vs_competitors.md`
  and `research/multiagent/111_ui_design_research.md`.
- **Spec:** `research/multiagent/111_ui_design_research.md` — 11 tasks (TASK-01…TASK-11), each with
  why / file / done-when / size / test-risk. **Start with the lane's own "three small changes with the
  largest effect"** and its stated landing order.
- **ALSO (mandatory, cheap):** `110`'s **§5 "TASKS THIS IMPLIES" is `_(pending)_` — the task list was
  LOST** when the lane died mid-section. **Derive it from 110's own §1–§4** (verdict, tab inventory,
  usability findings, competitor-pattern comparison — all intact, 22KB) and append it in place of
  `_(pending)_`. **Do not invent findings** — derive only tasks the existing sections already justify.
- **The owner's actual complaint, in their words:** *"IT IS VERY COMPLICATED FOR A UI / A LOT OF INFO /
  LOTS OF JARGON"*, and they want it compact, not spread all over, readable, usable by **a beginner AND
  an agent**, not information-dense. `111`'s fetched NN/g *progressive disclosure* quote names the fix:
  *"Initially, show users only a few of the most important options… Disclose these secondary features
  only if a user asks for them."*
- **Prior art to copy:** Codex's **one `EventProcessor` trait, two impls**
  (`event_processor_with_jsonl_output.rs` + `event_processor_with_human_output.rs`) = one event stream
  rendered twice — the structural model for the **human-vs-agent surface split**. And OpenHands'
  `isServerFallbackSummary` regex guard, which **refuses a server "summary" that is actually raw JSON**.
- **⚠️ Risk control:** the console is the most user-visible surface. Prefer **additive** changes
  (new detail panes, collapsed-by-default sections, plain-language labels) over restructuring, and
  never break an existing interaction. If a change needs a new dependency, stop and report.
- **Done-when:** `npm run typecheck` 0; `npm run lint` 0; a browser check is not available in your
  sandbox — so keep changes type-safe and report exactly which interactive paths you could **not**
  exercise. State that limit plainly.
- **Log:** `fixes/216h_ui_wave.md`

---

## 4. Prioritized backlog (do not invent work — it is all specified)

Ordered by the plan's own leverage ranking. **Bold = P0.**

| # | Task | Where | Owner |
|---|---|---|---|
| 1 | **T-07** — `emit` must refuse/banner on an uncleared red tree-run (F-07) | `headless.ts`, `phases[6]` | Lane 2 |
| 2 | **TA-2** — the eval harness must not stamp bare `decidedBy:"human"` (P0-01's other half) | `headless.ts:~734`, `run-eval.mjs` | Lane 2 |
| 3 | **T-04 / T-05** — scaffold entry silently dropped; emitted UI imports a path never written | `scaffold.ts` | Lane 1 |
| 4 | **TA-15** — multi-job emission (P0-04: all five jobs re-export ONE file; `doctor --tree` → `{stubs:0, reexports:5, real:0}`) | engine/scaffold | next wave |
| 5 | T-09 / T-10 / T-15 — prose-in-code, unsatisfiable prompt, `Math.random` in emitted code | codegen, prompt-engine | Lane 3 |
| 6 | T-11 — gate lesson capture on the green seal | engine/knowledge | Lane 4 |
| 7 | T-13 — reconcile **declared 10 jobs vs materialised 5** | engine/packet | next wave |
| 8 | T-14 — **P7–P12 produced 0 artifacts**; `canEnter` is strictly linear, so a red P6 makes **6 of 13 phases unreachable**. Either report *"7 of 13 executed"* honestly or unblock them | `phases.ts:126-132` | next wave |
| 9 | T-17 — **assertion-gap lint** (flags `assert.ok(x.length >= 0)`, `assert.ok(true)`, zero-assertion tests) — the meta-fix for the F-12 class | new lint | next wave |
| 10 | T-18 — `tree-run` must go from *"parses"* to *"the product builds and tests"* | `compile-check.server.ts` | next wave |
| 11 | **T0.4** — add `reasoningEffort` for P6 and **assert it** (105's C5: the card's flash numbers are measured at effort ~100, the module's flash shape is *disabled*; T0.1 landed first with no effort assertion) | `codegen.server.ts`, `deepseek.server.ts` | next wave |
| 12 | TA-3 — extend T0.9 to **every** published count **and make the check executable** (`README.md:15` "1632/1632", `AGENTS.md:59` "src ~1179", `README-cli.md:10` 33 verbs, and `fixtures` is dispatched at `rapidtool-cli.mjs:825` with **zero** mentions in `README-cli.md`) | docs + a test | next wave |
| 13 | TA-21 — P9 deploy-artifact honesty (canned GitHub-Actions YAML must be marked *template — not executed* or actually run) | `engine.ts` P9 writers | next wave |
| 14 | TA-1 — verify the four `[lane-reported]` blockers before tasking them | `100:37-41` | next wave |
| 15 | 111's remaining UI tasks + 110's derived list | console | Lane 5 → follow-on |
| 16 | 107/108 competitor steals: `str_replace` patch primitive, provider registry + role tiers, policy engine, run-side fixtures, in-place edit verb with ledger attribution | see dossiers | later waves |
| 17 | 112's remaining: T5 (`lesson --advise/--verify` verbs), T11 (contradiction ⇒ mandatory supersede), T12 (document the judgment contract), **T9 (stemmer — LAND ALONE)** | knowledge | later waves |
| 18 | 109's remaining: C-02 phantom export, C-06 stemmer asymmetry, C-08 harvest cap, C-09 `KnowledgeStore.entries()` returns its live cache array, C-10 three stemmers feeding "FusionRank" | verify/harvest/knowledge | later waves |
| 19 | **T0.10** — keyed eval re-run — **owner: the user** (needs a valid RapidTool key; last keyed run was 6/9 at 99s vs run #2's 4/9, and keyless also scores 6/9, so keyed ≈ keyless is unproven) | — | user |

**Also open (housekeeping):** write `fixes/216b_oracle_floor.md` (lane B's T-08 log — never written);
`110`'s task list derivation (Lane 5); and the two unattributed one-line diffs in §6.3.

---

## 5. Hard rules and pitfalls (highest-value section)

### 5.1 Environment / tooling

1. **The repo path contains a space** → `search_files`/ripgrep fail; use
   `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep -n ...`.
2. **`$(...)` command substitution inline gets the terminal call BLOCKED** by the parser guard.
   Write a `.sh` file with `write_file` and run `bash /c/Users/mnril/_x.sh`. (This bit twice in one
   session — do not relearn it.)
3. **`node /c/Users/...` becomes `C:\c\...`** — always pass `node "C:/Users/..."` (forward slashes).
4. **`node --experimental-strip-types`** is how tests run. `npm test` = scripts leg
   (`scripts/**/*.test.mjs`) + src leg (`src/lib/*.test.ts` + `app-data` + `auth`).
5. The `patch` tool's auto-lint prints a **spurious `TS6053: File … not found`** for any file whose
   path has a space. It is noise — ignore it and run `npm run typecheck` for the real answer.

### 5.2 ⚠️ `hermes verify` will REFORMAT YOUR REPO — do not run it as-is

Its detected recipe puts **`npm run format` in the test phase**, and that script is
**`prettier --write .`** — **write mode**. Running `hermes verify` silently reformats the **entire
repository** as a side effect of a "verification". **Run the four gates by hand (§1) instead.** (Filed
as T3.6: add `format:check` = `prettier --check .` and wire *that* into verification.)

### 5.3 ⚠️ `typescript` is a **devDependency** — never import it statically into `headless.ts`

`package.json` has `typescript` in **devDependencies** (verified). `headless.ts` reaches
`compile-check.server.ts` only through a **string-computed dynamic import**
(`"./compile-check." + "server.ts"`) for exactly this reason — a static import would break the CLI in a
production install. Any new parse/compile check on that path must ride the same seam. Read the
fail-open rationale in `parseGateTreeRows`' docstring before changing it.

### 5.4 Honesty invariants (the repo's contract — violations are the worst possible failure)

- **Skip ≠ green. Stubs ≠ complete.** A clean "complete" must never hide a red gate.
- **Never fabricate a pass.** No tautological assertions (`assert.ok(x.length >= 0)`), no
  `assert.equal(true, true)`, ever. (This is exactly what T-08 deleted.)
- **Never mint `decidedBy:"human"` from a machine path**, and never mint `tested` before
  `gate.passed`.
- A **stale** verification stamp is as dishonest as a fake one — that is what T-06 fixed.
- **Strike rather than ship:** if a task can't be verified, strike it and record the exact command
  that showed it unsupported (T2.3 was struck this way).
- **Never claim Docker/bwrap** — isolation is honestly `sandbox:false`.

### 5.5 Concurrency discipline (learned the hard way)

- **Disjoint file ownership per lane, enforced in the brief.**
- **Never run the full gate while agents are mid-edit.** A full-suite run during a sibling's write
  produced one false failure (a test read a module being rewritten). It was correctly attributed by
  comparing **mtimes against the run window** — do that rather than guessing.
- **Brief lanes to write the deliverable skeleton FIRST, then extend.** Two of four lanes in an
  earlier wave died pre-write and lost everything; skeleton-first fixed it in every later wave.
- **Judge lane liveness by transcript mtime**, not tool-call count — the nominal ~50-call cap is
  unreliable (lanes ran to 60+ while still alive).
- **A lane that runs out of budget must say so.** Both failure modes happened this session and the
  honest report is what made immediate repair possible.

### 5.6 Delegation config

`delegation.model = deepseek-v4-flash`, `delegation.provider = deepseek`. **Never pin Pro** — the
user's standing instruction is that V4.1-Flash beats Pro on all agentic/coding work. Restore flash
after any temporary pin. The chat model is `deepseek-v4-flash` / `deepseek`.

---

## 6. Open items, unverified claims, and review-before-commit

### 6.1 Unverified / flagged by the lanes themselves (do not cite as fact)

- **109's C-01 reproduction gap:** with a live key it could **not** observe a model actually emitting
  the permissive case list C-01 needs. The flaw is **probe-verified mintable in principle**, not
  observed occurring in a real run.
- **106's model-behaviour caveats:** F-04 (prose-in-code) and F-05 (tautological floor) were observed
  on the **pro-tier** run; re-confirm against the new **flash** default before attributing them to the
  tier. **F-01 was deterministic code and model-independent** — which is why it was fixed first.
- **Lane A did not execute** `codegen.server.test.ts`, `verify.test.ts`, `sweep73-fuzz.test.ts` (it
  argued them safe). **Resolved by the parent**: the full frozen-tree suite is green, so all three pass.
- **Lane C's T7 numbers** were produced in `%TEMP%` probes, not in-repo; the in-repo assertions are
  the durable evidence.
- **108's security note:** gpt-pilot shipped a **credential-stealer worm** (`core/telemetry/`) from
  2025-08 → 2026-06. **Verified clean here**: the clone's HEAD is the removal commit, neither carrier
  (`_hooks.py`, `_runtime.bin`) exists, the surviving `telemetry/__init__.py` has no loader/exec
  primitives, and it was **never installed or run** (`no venv/node_modules`). **Keep
  `rt-competitors` read-only reference — never vendor or execute competitor code.**

### 6.2 Documentation gaps this session created

- `fixes/216b_oracle_floor.md` — **not written** (lane B never reached it).
- `110_ui_audit_vs_competitors.md` §5 — **still `_(pending)_`** (derivation owed; see Lane 5).
- Plan §8 Wave G heading carries a **withdrawn "16 tasks"** claim, corrected in place to the lane's
  real **10 findings (P1×1, P2×6, P3×3)**. Do not re-introduce "16".

### 6.3 ⚠️ Review before any commit

- **`src/components/console.tsx` — `1 insertion(+)`, unattributed.** Not made by this session's
  parent; independently noticed by lane 111 as a pre-existing diff from another lane. **Its content
  has not been inspected.** Read it before committing.
- **`scripts/run-eval.mjs` — modified before this session began** (also a small diff, likewise
  unattributed). Review alongside console.tsx.
- **Nothing was committed all session.** All 62 modified files are in the working tree. Review the
  full diff before the first commit.

---

## 7. Provenance map

### 7.1 The master plan

**`research/multiagent/104_factory_upgrade_plan.md`** — §1 (evidence base), §2 (product reality), §3
(code quality), §4 (capabilities), §5 (phases/tasks), §6 (limits), §7 (Phase-0 enactment log),
**§8 (task waves from the 8-lane analysis)**, **§9 (T-01/T-16 landing + empirical proof)**, **§10
(T-02/T-03 landing)**, **§11 (the 3-lane coder wave + parent repair)**.

### 7.2 Dossiers (all in `research/multiagent/`)

| File | Size | Content |
|---|---|---|
| `100_factory_blockers.md` | 13KB | 6×P0 / 7×P1 / 2×P2 blockers |
| `101_provider_integration.md` | 80KB | provider/model layer + honesty gates |
| `102_code_quality_signals.md` | 15KB | the 12-signal ranked set |
| `103_feature_gaps.md` | 29KB | A-series feature gaps |
| `105_plan_critique.md` | 58KB | **12 contradictions C1–C12 + 23 tasks TA-1…TA-23** |
| `106_rapidtool_deep_analysis.md` | 57KB | **13 findings F-01…F-13 + Waves A/B/C tasks** |
| `107_competitors_agentic.md` | 80KB | SWE-agent, aider, cline, OpenHands, codex, pr-agent, opencode |
| `108_competitors_app_generators.md` | 60KB | MetaGPT, ChatDev, bolt.diy, gpt-engineer, gpt-pilot, Devika, Dyad |
| `109_bughunt_core.md` | 47KB | **10 findings** (P1×1, P2×6, P3×3) + tasks |
| `110_ui_audit_vs_competitors.md` | 22KB | findings §1–§4 complete; **§5 lost** |
| `111_ui_design_research.md` | 79KB | **11 UI tasks** + fetched NN/g principles |
| `112_code_judgment_and_learning.md` | 56KB | **12 tasks T1–T12** |

### 7.3 Landing logs

`fixes/216a_verify_lane_216.md` (lane A) · `fixes/216c_algorithms.md` (lane C) · `216b` **missing**.

### 7.4 Delegation waves (this session)

`deleg_9272975b` (4 lanes → dossiers 100–103) · `deleg_cc524faa` (4 → 105–108) · `deleg_910b18c2`
(4 → 109–112) · `deleg_ce83401c` (3 coder lanes). Live transcripts:
`%LOCALAPPDATA%\hermes\cache\delegation\live\<id>\task-N.log`; summaries:
`%LOCALAPPDATA%\hermes\cache\delegation\subagent-summary-*.txt`.

### 7.5 Competitor clones

`C:\Users\mnril\rt-competitors` — 17 repos, **read-only reference, never executable** (see §6.1).

---

## 8. The one-paragraph version

RapidTool's P6 pipeline was **corrupting every generated module** (431 tsc errors) and a green
1634-test suite could not see it. This session ran an 8-lane triple-parallel analysis (plan critique,
codebase deep-dive, competitor teardown × 2, bug hunt, UI audit, UI research, learning research),
turned it into **~90 specified tasks** in `104_factory_upgrade_plan.md` §8, and then enacted the
highest-leverage slice: **Phase 0 (10 governance/honesty tasks), Wave D (T-01/T-02/T-03/T-06/T-16 —
fixing the corruption, making the class unshippable, and stopping stale green stamps from outliving
their artifact), and a 3-lane coder wave (13 fixes across verify/scaffold/algorithms)**. The tree is
**frozen and green: 1857 tests, four gates at 0**, with one lane's mid-edit breakage repaired by the
parent and every test assertion change recorded old → new. **The single most important habit to carry
forward: a lane that runs out of budget must report the real state — one did, and that is why a broken
tree was caught within minutes.**

---

## 9. Quick-start for a cold session (paste-ready)

### 9.1 The resume prompt

Paste this to start a new session, then work §4's backlog or dispatch §3's five lanes:

```text
Read `AGENTS.md`, then `RESUME.md`, then `taskuniverselog.md` (the live task-status board), then
research/multiagent/104_factory_upgrade_plan.md (§1-§11) — all at the root of
`C:\Users\mnril\Desktop\RapidTool Main`. RESUME.md is the session handoff: current gate state, the
mission + acceptance bar, a decision log, per-suite test baselines, and five copy-paste lane briefs.
`taskuniverselog.md` maps the remaining work across ALL dossiers — verify its statuses against disk,
and keep it current at every wave boundary. 104 is the master plan with ~90 specified tasks; every
task already has a file:line and a done-when, so do not invent work.

Constraints that are not negotiable: honesty over completeness (skip != green, stubs != complete,
never fabricate a pass, never mint decidedBy:"human" from a machine path); patch-only edits on
existing files; never run `git checkout/stash/reset/commit`; never run the full gate while agents are
mid-edit; never pin the Pro model tier (flash-first). Keep `taskuniverselog.md` updated at every wave
boundary (flip statuses with evidence + a changelog line).

First: reproduce the four gates on the frozen tree (RESUME.md §1) and report the real counts. Then
read §10 (decision log) before changing anything that looks odd. Then proceed with §4's highest
leverage item or the next wave in `taskuniverselog.md` §4, or dispatch lanes with the §3.0 guardrail
block included verbatim in every brief.
```

### 9.2 Orient with the CLI before reading 62 files

These verbs tell you the *actual* state faster than any amount of grep:

```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
node scripts/rapidtool-cli.mjs doctor                 # capability pre-flight; look for autonomousSoftwareFactory
node scripts/rapidtool-cli.mjs doctor --tree research/eval-out/coffeehouse2home-property-ledger   # THE product reality: { stubs, reexports, real } (the flag needs a DIR) — see §1.0 P0-04
node scripts/rapidtool-cli.mjs packet --help          # the agent-facing contract
node scripts/rapidtool-cli.mjs lesson --help          # the learning loop (append-only store; human --accept only)
```

`doctor --tree` is the single most honest signal in the repo: it distinguishes **stubs**,
**re-exports** (the fake-completeness failure) and **real** files. Check it before *and* after any
scaffold/engine change.

### 9.3 If you need more context than this file

Read in this order — each answers a different question:

| Question | Read |
|---|---|
| What should I do next, and why? | `104` §4 (capabilities) + §8 (waves) + §4 of this file |
| Why is this codebase like this? | `106_rapidtool_deep_analysis.md` (13 findings, file:line each) |
| What's wrong with the plan itself? | `105_plan_critique.md` (12 contradictions + TA-1…TA-23) |
| How do rivals solve this? | `107` (agentic harnesses) / `108` (brief→app generators) |
| Is this a real bug or a smell? | `109_bughunt_core.md` (every finding has a probe) |
| How should the UI feel? | `111_ui_design_research.md` (11 tasks, fetched principles) |
| How should the agent learn? | `112_code_judgment_and_learning.md` (12 tasks, loop gaps G1–G5) |

**Load the project skill first.** The `rapidtool-development` skill (and its
`references/provider-model-layer-and-honesty-gates.md`) is the curated entry point for editing this
codebase — load it before reading source. For QA work, `browser-automation-qa` is the owner's
preferred approach. For auditing, `codebase-audit`. Skills carry the conventions this file only
summarises.

---

## 10. Decision log — settled calls, do NOT relitigate

Each of these looks wrong from the outside. Each was deliberate. If you want to reverse one, say what
new evidence changed, don't just "fix" it.

| Decision | Why | If you're tempted to revert |
|---|---|---|
| **P6 synthesis runs the `flash` tier, not `pro`** | V4.1-Flash beats Pro on **every** agentic/coding bench (DeepSWE 74.2 vs 62.7; Terminal-Bench 90.6 vs 87.9; ProgramBench 20.3 vs 15.5). Pro only wins GPQA/HLE. | **No.** The user's standing rule is never to pin Pro for this work. |
| **The parse gate (`parseGateTreeRows`) fails OPEN when the seam is unavailable** | `typescript` is a **devDependency**; in exactly that case the tree-run *verdict* is unavailable too, so no cycle can reach green by bypassing the gate — there is no false pass to protect against. Fail-closed would break runs the tree lane already reports honestly as unverifiable. | Only with a way to take the tree verdict *without* `typescript`. Read the docstring first. |
| **`treeUpgraded` drops `lastTest` even on an identical-tree synthesis** | Over-conservative on purpose: never claim "tested" when unsure. A stale stamp is as dishonest as a fake one (that was F-02). | No — the asymmetry is the point. |
| **A skipped row is preferred to a tautological one (T-08)** | `test.skip("<id> — NOT IMPLEMENTED")` is honest and visible; `assert.ok(x.length >= 0)` is a lie shaped like evidence. The skip name keeps the pinned id so nothing gets silently dropped. | No. Deleting a skip to "raise coverage" is exactly the failure the repo forbids. |
| **`stripCjsExportAssignments` removes the *whole* CJS construct** | The old code dropped one line and left the body → unparseable modules → 431 tsc errors. It now tracks brace depth to the matching close. | Do not "simplify" it back to a `startsWith` check. |
| **Count-verified, fail-closed edit scripts for multi-site changes** | Nothing is written unless *every* occurrence count matches exactly, so a partial write is impossible. | Fine to use `patch` for single edits; use the script pattern for N-site sweeps. |
| **Skeleton-first delegation** | Two of four lanes in an early wave died pre-write and lost everything. With skeleton-first, **8 of 8** later lanes delivered. | Not negotiable for write-heavy lanes. |
| **The `110` dossier's task list must be DERIVED, not invented** | Its §5 was lost mid-write; only its findings survive. Inventing tasks from thin air would fabricate evidence. | Derive from its own §1–§4 only. |
| **`rt-competitors` is read-only reference** | gpt-pilot carried a credential-stealer (2025-08 → 2026-06). Our clone is at the removal commit and was never run, but the class of risk is real. | Never vendor or execute competitor code. |
| **This session committed nothing** | All 62 modified files sit in the working tree for review, deliberately. | Review before the first commit (§6.3). |

---

## 11. How the owner wants work done

Working against these wastes their time; each is a standing instruction, not a preference:

1. **100% honesty, zero hallucination.** Report the real state even when it is bad. An honest
   "incomplete, does not typecheck" is worth more than a claimed green — the owner will find out.
2. **Extreme detail per fix: what / why / where / wiring / bugs.** Not "fixed the bug" — *what*
   changed, *why*, the *file:line*, how it *wires* into the rest, and what it could *break*.
3. **Plans are exhaustive, self-analyzed, fact-checked documents handed to ANOTHER model to run.**
   The plan is the deliverable. That is why every task carries `file:line` + a done-when.
4. **"Planning only" means DO NOT START.** Conversely a plan-gated wave that they then say
   "spawn" means *now*.
5. **Researcher + thinker vet before fixers touch code.** Understand, then design, then execute.
6. **Never pin Pro; flash-first; ≤4-lane flash waves; no re-confirmation needed.** If a wave says
   "have them continue", show transcript/mtime evidence — **never re-dispatch the same files**.
7. **They check agent activity mid-wave and get anxious about idle or obliterating agents.** Show
   timestamped live-transcript + file-mtime evidence, proactively.
8. **UI taste: Codex + Hermes Desktop** — dark, terminal-style, live agent feed. They **hate
   jargon and information-dense UIs**: compact, plain-language, not spread all over, usable by **a
   beginner AND an agent**. See the §3.5 brief.
9. **GitHub push must never block factory work.** The repo was not pushed this session; do not gate
   progress on it until they ask.

---

## 12. Wave design guide (how to spawn N agents without a collision)

**Sizing.** Up to 30 concurrent are allowed; the practical sweet spot is **3–5 for code** (wider
waves add collision risk faster than throughput) and **≤4 for analysis**. Lanes can exceed the
nominal ~50-call cap and stay alive — **judge liveness by transcript mtime, not call count.**

**Non-negotiable design rules, learned by breaking them:**

1. **Disjoint file ownership, written into every brief.** Name the *only* files a lane may touch, and
   list the other lanes' files so it knows what to avoid. Also assign a **distinct landing-log path
   per lane** (`fixes/216d_*.md` etc.) so logs can't collide.
2. **Every lane gets the §3.0 guardrail block verbatim.** Do not paraphrase it.
3. **Write-heavy lanes write their deliverable skeleton FIRST.** A lane that verifies before writing
   can die with nothing on disk.
4. **Never run the full gate while lanes are mid-edit.** If you must (e.g. to get evidence), then
   **attribute any failure by comparing file mtimes against the run window** before believing it.
5. **Expect iteration-cap deaths and plan recovery.** Content is recoverable from
   `%LOCALAPPDATA%\hermes\cache\delegation\live\<wave-id>\task-N.log` (live transcript) and
   `subagent-summary-*.txt`. The parent writes the missing deliverable and **marks it as a parent
   recovery** — never silently.
6. **Re-verify lane claims against bytes.** A child's summary is a self-report. This session the
   parent independently confirmed a lane's typecheck finding, reproduced another's bug, and caught
   its own count error. Trust but verify — always.

**When a lane fails, triage in this order:** (1) `npm run typecheck` for the real error list;
(2) is the defect *mechanical* (arity mismatch, duplicate block, stale assertion) or *semantic*?
(3) repair mechanical defects; (4) **revert only as a last resort and only with the owner's view** —
a semantic failure may still contain correct work.

**⚠️ Never pass a default/null to satisfy an arity change.** Lane B's `commandBlock` gained a census
parameter; passing `null` would have typechecked and introduced a *new* honesty bug (under-reported
skips). Fix the wiring, not the compiler.

---

## 13. Operational workflows that actually worked

### 13.1 Handling a "verification is stale" flag

The system flags changed paths as stale when they lack a matching fresh passing run. Workflow:

1. Run the **four gates** (§1) fresh.
2. If a gate is red, **attribute it before believing it** — compare the failing file's mtime against
   the run window (see §12, rule 4). A mid-write race produces a failure that is not a defect.
3. If the run is green, the flag is satisfied. If it *cannot* be run (concurrent writers), **say so
   plainly with the reason** — do not claim verification you don't have.
4. Scratch files you deleted still appear in the flag. That is noise; say they're gone.

### 13.2 Proving a fix is real (the empirical before/after)

Do not rely on a green suite as proof. Write a throwaway probe that runs the **old and new logic side
by side** on the same inputs and prints both verdicts:

```bash
# write a .mjs probe (never inline a giant one-liner — see §5.1, item 2)
node "C:/Users/mnril/_probe.mjs"
```

This session that technique showed the CJS bug broke **2 of 4** shapes — including one the audit had
**not** found (a `}` inside a string literal). A suite can only prove what it asserts; a probe can
find what nobody thought to assert.

### 13.3 Proving your test has TEETH (do this for every regression test)

A test that passes is not evidence. Prove it **fails against the old code** — lane A's method, which
is the standard to copy:

1. Copy the module to a temp tree **outside the repo**.
2. Revert **only that file** to `git HEAD` there (`git show HEAD:path > tmp/path`).
3. Point the new tests at the reverted copy and run.
4. **Expect the fix assertions to go RED** while the control assertion stays green.

Result from this session: **8 of 9** fix assertions red on the reverted file, **9/9** green on the
new one. That converts "I wrote a test" into "this test detects the bug", which is the difference
between T-16 and the assertion gap it was written to close.

### 13.4 Verifying a claim about the codebase

```
1. grep -n <symbol> <file>            # locate, don't trust remembered line numbers (they drift)
2. read the region ±20 lines          # understand the call site, not just the line
3. check the callers                  # grep -rn "<fn>(" src scripts | grep -v test
4. probe it                           # run the real function in %TEMP% and print the verdict
5. only then write it down as fact — with the command that showed it
```

Line numbers quoted in the dossiers were captured **before** this session's edits; they have drifted
(e.g. `codegen.server.ts` grew ~46 lines from T-01 alone). **Always re-grep; never patch by line
number.**

---

## 14. The task universe + next-wave board (`taskuniverselog.md`)

**`taskuniverselog.md` (repo root) is the live task-status board** — the single merged list of every
task from every dossier (`105`/`106`/`109`/`112` + `104`'s phases + Wave H `107`/`108` + UI
`110`/`111`), each with status (✅ landed / 🔄 in flight / ❌ open / ⚠️ partial), size, evidence path,
and the recommended next wave. Created 2026-09-16; updated at every wave boundary.

Rules:

- **Read it before acting on any task, and verify its statuses against disk** (landing logs
  `fixes/216*`, `git status`, `grep` the cited anchors) — disk wins, then correct the file.
- **Update it at every wave boundary**: flip statuses with evidence + append a §7 changelog line.
- **The per-wave catalogue lives in `remainingwaves.md`** (repo root): every remaining wave
  (W5→W12) with its lanes, tasks, files, done-when, estimates, and risks — keep it in sync with
  this board at every boundary.
- Next wave at last update (post-W4, 2026-09-16): **W5 = TA-15 rewire (THE product blocker) ·
  test-tails + landing-log bodies · policy integration (T-107.3) · provider registry (T-107.2) ·
  run-side eval fixtures (T-107.5).** Maker-test path: TA-15 rewire → fresh keyed run.
  User-owned: **T0.10** (fresh keyed eval).
