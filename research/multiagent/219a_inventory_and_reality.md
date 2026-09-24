# 219a · What RapidTool actually IS today — inventory + claim-vs-evidence

*Lane 1 of 5 · W13 state-of-the-factory inquest · written 2026-09-24 · READ-ONLY except this file.*

**Evidence rules (owner's standard):** every claim below is (a) a `file:line` read today,
(b) a command run today with real output pasted, or (c) explicitly labelled UNVERIFIED /
taken-from-dossier. Where I could not verify, I say so. Nothing is invented; counts that
came from a document instead of a command are marked.

---

## 0. Provenance: exactly what I read and ran today (2026-09-24)

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash `/c/Users/mnril/Desktop/RapidTool Main`).
`git rev-parse --short HEAD` → **aa12c6c**; the working tree is **dirty** — `git status --porcelain`
shows ~20+ modified files (` M scripts/rapidtool-cli.mjs`, ` M src/lib/engine.ts`,
` M src/components/console.tsx`, ` M src/lib/codegen.server.ts`, …). Everything I measured below
is the on-disk working tree at that state, not a clean checkout.

> [WD-A · 2026-09-24] CORRECTED: "`git rev-parse --short HEAD` → **aa12c6c**; the working tree is **dirty**" → true when measured (11:14:58, transcript `task-0.log`), but at **11:15:16** the parent committed that same W10–W12 working tree as **`7582771`** ("W12 close…"); HEAD now reads `7582771` and `git status --short` (WD-A, 11:19–11:29) shows no modified src/scripts files — the dirty-tree snapshot is stale now (the measurements below were taken from the same bytes, which the commit contains). — evidence: transcript task-0.log 11:14:58 (`aa12c6c` + ` M …` snapshot); `git reflog` HEAD@{0} = commit `7582771` @ 2026-09-24 11:15:16; `git log -1` + `git status --short` read by WD-A. (verified by WD-A, not by the lane)

**Commands I actually ran** (all outputs pasted somewhere in this file):
- `grep -c 'case "' scripts/rapidtool-cli.mjs` → 35; indent audit of every `case` line; USAGE-object audit (34 keys).
- `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor` (keyless) — full JSON in §2.
- `doctor --tree` three times: on the shipped reference tree, on a fresh emit of the W1 project,
  on a fresh banner-policy emit of the C2H project (§5).
- `emit` twice via the CLI: one **refused** (C2H project, red trail), one **landed** (W1 project, 18 files).
  One `emitProject(..., {redTree:"banner"})` call via a `node -e` one-off (scratch probe) — landed, 20 files.
- One keyless journey: `create` + `gate` + one `approve` refusal probe, all under
  `C:/Users/mnril/w13l1_scratch/keyless/` (§4).
- Read-only greps + `node -e` one-offs; `import("./src/lib/phases.ts")` to count phases (13).
- **Did NOT run:** `npm test`, `npm run typecheck`, `npm run build`, `bash scripts/gate.sh`,
  `npm run eval`, any keyed (LLM) run, any browser session, `tree-run` on any tree. Where test
  numbers appear below they are **taken-from `fixes/218_w12_close_record.md` §5** (read today,
  lines 125–137) and labelled as such.

**Scratch (outside the repo):** `C:/Users/mnril/w13l1_scratch/` — `c2h-project.json` (copy of the
reference project), `emit-w1/`, `emit-c2h-banner/`, `keyless/w13l1-keyless-probe.json`,
`emit-c2h/` (the refused emit left nothing there). The repo was not written to.

---

## 1. The product surface, measured

**Phases — 13, defined once.** `src/lib/phases.ts:3` `export const PHASES: PhaseDef[] = [`.
`node --experimental-strip-types -e "import('./src/lib/phases.ts').then(...)"` printed
`PHASES.length = 13` (P0–P12). Names (read from the phase rail the engine emitted today,
`emit-c2h-banner/README.md:55–67`; the same strings are the `title:` fields in `phases.ts`,
e.g. P0 at `phases.ts:7`): P0 Deep Research & Feasibility · P1 Core Orchestration &
State Graph · P2 Memory & Context Consolidation · P3 Tool Integration & Interoperability ·
P4 Security, Isolation & Authorization · P5 Validation, HITL & Self-Learning · P6 Code Generation,
Testing & Deployment · P7 Domain & Market Research · P8 Dynamic UI/UX Prototyping · P9 CI/CD &
Cloud Deployment Routing · P10 Local Agent & Edge Inference · P11 Real-Time Web & Tool
Augmentation · P12 Documentation & Technical Specs. HITL gates: `phases.ts` sets `hitl: true` for
the entries at lines 42/50/74/82 → **P4, P5, P8, P9** (confirmed live: a keyless run parks at P4, §4).

**CLI verbs — 35 dispatched, 34 in the CLI's own usage text.** `grep -c 'case "'
scripts/rapidtool-cli.mjs` → **35**; all 35 `case "` lines sit at the dispatcher indent (6 spaces)
under the single `switch (cmd)` at line 420 (`run` and `gate` share one code block,
lines 444–445, but are two case labels). The 35: create, run, gate, approve, reject, retry,
ingest, packet, export, emit, fixtures, tree-run, repair, edit, summary, vault, search, crew,
verify, check, design, diagram, artifacts, harvest, swarm, prompt, bench, mine, knowledge, lesson,
wild, chat, deepen, doctor, diagnose. **However**, the CLI's own `USAGE` object
(rapidtool-cli.mjs:2898–2936) contains **34** keys — `diagnose` is dispatched (case at :2783) but
has no USAGE entry (`grep -n "diagnose:" scripts/rapidtool-cli.mjs` → no hits). This is almost
certainly where the docs' "34" came from. Current doc status: `scripts/README-cli.md:10` says
**35** ("verified on disk: `grep -c 'case "'` = 35") and lists all 35; `README.md` says **34** at
lines 9, 80 and 101; `AGENTS.md` says "34 verbs dispatched today". So README.md and AGENTS.md are
**stale by one**; README-cli.md is current. (Not run: `doctor`'s sibling verb `diagnose`.)

**UI — 10 console tabs + 4 components.** `src/components/console.tsx:132`:
`type RunTab = "artifacts" | "packet" | "spec" | "crew" | "oracle" | "design" | "diagram" | "chat" | "vault" | "runtime";`
→ 10 tabs (AGENTS.md's "9+ tabs incl. Runtime log" holds). Components dir: `console.tsx`,
`cmd-palette.tsx`, `runtime-timeline-pane.tsx`, `preview-host-bridge.tsx`. The command-palette
shortcut claim ("⌘K") is real: `console.tsx:1285` registers `{ keys: ["Ctrl","K"], … }` and the
global handler at `:1675` computes `mod = e.ctrlKey || e.metaKey`, opening the palette at `:1697`
(`e.key.toLowerCase() === "k"`). Other chords in the same handler: mod+Enter = run / run-until
(`:1676–1685`), mod+shift+C = copy packet (`:1686–1690`). UI *visual* behaviour was NOT exercised
(no browser session today).

**Test suite — last green gate (taken-from `fixes/218_w12_close_record.md` §5, lines 129–137,
not run today):** `{"ok":true,"flake":[],"hardFails":[],"skips":1,"wallMs":160942, typecheck ok
exit 0, lint ok exit 0, assertionGaps ok exit 0, build ok exit 0, testsScripts pass 261 fail 0,
testsLib pass 1957 fail 0 skipped 1}` (third attempt, 11:08; the 1 skip is the by-design
`RT_VERIFYKIND_INSTALL` opt-in gate). README.md's numbers are older snapshots: "scripts 220/220 +
src 1803/1803" at :12–14 and "scripts 235/235 + src 1811/1811" at :136–137 — both **superseded**
by W12's 261/1957. AGENTS.md's "scripts 195/195; src ~1179 tests" is older still.

**Module inventory (one paragraph).** `ls src/lib/*.ts` = **137** top-level files — 69 non-test
modules + 68 colocated `*.test.ts` — plus subdirs `app-data/ auth/ llm/ multiplayer/ og/ testing/`.
By role: **engine core** (engine.ts, phases.ts, store.ts, dod.ts, packet.ts, io.ts, types.ts,
errors.ts, algorithms.ts, knowledge.ts, vault.ts, harvest.ts, report-intake.ts, prompt-engine.ts,
handoff.ts, judgment.ts, planning.ts, compaction.ts, gate-stats.ts); **builder/verification**
(codegen.server.ts — P6 synthesis+repair, scaffold.ts — tree writer, compile-check.server.ts —
compile-check/treeRun, node-runner.server.ts — the bounded (not sandboxed) runner, verify.ts +
verify.server.ts, patch.ts, write-set.ts, maker-score.ts); **LLM/provider layer**
(deepseek.server.ts, llm.ts, llm-tasks.ts, algo-tools.ts, `llm/providers/`); **research/tools**
(websearch.server.ts, tavily.server.ts, vector.ts, ast-mine.ts, bench.ts, swarm.ts, design.ts,
diagram.ts, arch-tools.ts, templates.ts, brief-fixtures.ts); **telemetry/diagnosis** (rt-events.ts,
rt-ring.ts, rt-client.ts, rt-timeline.ts, runtime-log.server.ts, tracing.ts, watchdog.ts,
diagnose.ts); **policy/limits** (policy.ts, sandbox.ts, sandbox-policy.ts, token-ledger.ts,
exec.ts); **chat** (chat.ts, chat.server.ts); **product surfaces** (headless.ts — the CLI's
backend, doctor.ts, subagent.ts, crew.ts, crew.server.ts, wild-mode.server.ts). Full list taken
from the live `ls` today; role grouping is my reading of the files' own headers, not a doc.

---

## 2. `doctor` — the factory's own verdict on itself

### 2.1 The keyless run, raw (pasted verbatim)

`node --experimental-strip-types scripts/rapidtool-cli.mjs doctor` → exit 0:

```json
{
  "schema_version": 1,
  "cmd": "doctor",
  "ok": true,
  "llm": { "configured": false, "label": "not configured (set DEEPSEEK_API_KEY)" },
  "research": { "configured": true, "probed": true, "label": "free search (duckduckgo/searxng/wikipedia)" },
  "runner": { "available": true, "sandbox": false },
  "node": "v22.23.2",
  "factory": {
    "autonomousSoftwareFactory": false,
    "leftoverJobsAreReexportsOrStubs": true,
    "chatHasSlashToolsOnly": true,
    "runnerIsSandbox": false,
    "isolation": { "sandbox": false, "kind": "none", "docker": false, "bwrap": false,
      "note": "RapidTool's node-runner is a bounded timeout + env allowlist. It is NOT Docker, bwrap, or a security sandbox." },
    "tokenCap": null,
    "gaps": [
      "leftover jobs are reexports or TODO(E-15) stubs — not a multi-job product",
      "no human-approved fixtures (decidedBy:\"human\")",
      "no real multi-job product",
      "product-complete bar not met (skip≠green; stubs≠complete)"
    ],
    "inventory": null
  },
  "exit_code": 0
}
```

### 2.2 What each `gaps[]` entry means — and where it comes from

The envelope is assembled in `src/lib/headless.ts:3132–3231` (`doctorStatus`): the `llm` label at
:3133–3142, `research` at :3144–3161 (a **real 3-second probe** of the free search stack — it
reported `configured: true` today), `runner` at :3162–3167, and `factory` at :3183–3222. The four
gap strings are the constants `FACTORY_GAP` in `src/lib/doctor.ts:183–188`; they are pushed by
`gapsOf()` at `doctor.ts:190–201` whenever the corresponding evidence field fails.

Plain words for each — with the code that decides it:

1. **"leftover jobs are reexports or TODO(E-15) stubs — not a multi-job product"**
   (`FACTORY_GAP.leftover`, doctor.ts:184). Meaning: the emitted product's job modules are not
   real per-job code — they are either `TODO(E-15)` stubs or thin `export *` re-exports of one
   hosted module. Evidence rule: `leftover = stubs + reexports > 0 || real === 0`
   (`doctor.ts:161`). **With no `--tree`, this is not a measurement at all**: the module-level
   evidence constant `RAPIDTOOL_FACTORY_EVIDENCE` is frozen at `doctor.ts:175–181` with
   `leftoverJobsAreReexportsOrStubs: true` — a deliberate "field-truth latch" (module header,
   doctor.ts:4–14: the factory flag "can never become true without evidence"). **With `--tree`,**
   the census replaces the constant (`headless.ts:3204–3209` → `evidenceFromJobInventory`,
   doctor.ts:157–172).

2. **"no human-approved fixtures (decidedBy:\"human\")"** (`FACTORY_GAP.fixtures`, doctor.ts:185).
   Meaning: no acceptance fixture in any project has been approved by a recorded human seat. The
   tree-scan path never mints this either — `evidenceFromJobInventory` hardcodes
   `humanFixtures: extra?.humanFixtures === true` with no `extra` supplied by the CLI
   (doctor.ts:166), so it stays false. The `fixtures` verb exists and drafts brief-derived
   fixtures but "never auto-approves" (`rapidtool-cli.mjs:2911`, USAGE).

3. **"no real multi-job product"** (`FACTORY_GAP.product`, doctor.ts:186). Meaning: no emitted
   tree yet shows ≥2 real job modules with zero stubs/reexports.
   `realMulti = real >= 2 && stubs === 0 && reexports === 0` (doctor.ts:162). My census runs
   (§5) show exactly why: today's trees score `{0,5,0}`, `{0,2,1}` or `{0,0,0}`.

4. **"product-complete bar not met (skip≠green; stubs≠complete)"** (`FACTORY_GAP.complete`,
   doctor.ts:187). Meaning: even a green-looking product isn't "complete" if its tests skip
   instead of asserting (the emitted scaffold's oracle rows start as visibly-marked
   `test.skip("… NOT IMPLEMENTED")`, scaffold README line 96) — for the tree path,
   `productComplete` is forced false unless supplied with real multi-job evidence
   (doctor.ts:167: `extra?.productComplete === true && realMulti && !leftover`).

The latch itself: `autonomousSoftwareFactory` is true only when **all** of
`leftover === false && humanFixtures === true && realMultiJobProduct === true &&
productComplete === true && isolation.sandbox === false && gaps.length === 0`
(`factoryClaim`, doctor.ts:218–224) — and `runnerIsSandbox: false` is hardwired
(doctor.ts:230; `headless.ts:3214`). A hostile blob claiming `sandbox:true` is coerced away
(`coerceFactoryClaim`, doctor.ts:243–257). So `autonomousSoftwareFactory: false` is not a mood —
it is a six-condition AND that nothing on disk satisfies today, and the code path that could
satisfy conditions 2–4 is not reachable from the CLI's `doctor` (no `--fixtures`/`--complete`
flags exist; the tree scan only feeds 1 and 3).

### 2.3 `doctor --tree` — what changes

`doctor --tree <dir>` scans `<dir>/src/jobs/*.{ts,js,mjs}` and `<dir>/jobs/*` only
(`collectJobSources`, `headless.ts:3094–3118`), classifies each file stub/reexport/real
(`classifyJobSource`, doctor.ts:65–83: empty/`TODO(E-15)` → stub; comment-stripped and
semicolon-split, all statements matching an `export * from`/`import … from` shape → reexport;
anything else → real), builds the census (`inventoryFromJobSources`, doctor.ts:85–101) and swaps
it into the factory evidence. Consequence measured in §5: a tree with **no** `src/jobs/` directory
at all reports `files: []`, which then reads as `real === 0` → the "leftover" and "product" gaps
stay — an honest but blunt signal (see finding F2 in §5).

---

## 3. Claim-vs-evidence matrix (`README.md` + `AGENT_GUIDE.md`)

Verdicts: **WORKS** = behaviour matched by code/live run today · **PARTIAL** = some of it true,
some not · **STALE** = was true, numbers/instructions now behind the bytes · **BROKEN** = the
command as written does not work · **DECLARED-LIMIT** = the doc itself already admits it (listed
so the owner can see the honest-limits section is itself accurate).

| # | Claim (quoted/short) | Where | What the code/disk actually does (file:line, or run today) | Verdict |
|---|---|---|---|---|
| 1 | "deterministic, governed workbench … compiles a client brief into an audited, phase-by-phase build" | README.md:3–6 | `create` on a fresh brief produced a project with `"modelRoute": "deterministic"`, phases P0–P12 in `phases.ts:3`, gates + a full artifact trail on disk (live §4: `scorecard@P0 … packet@P4`). | WORKS |
| 2 | "**34 verbs**" (headless CLI) | README.md:9, :80, :101; AGENTS.md | `grep -c 'case "'` = **35** today; `README-cli.md:10` (the doc-contract) already says 35 and lists them; the CLI's `USAGE` object has **34** keys — `diagnose` (case at :2783) is missing from USAGE. | STALE (README/AGENTS off by one) |
| 3 | "13-phase engine, resumable state, append-only ledger ✅" | README.md:88 | `PHASES.length = 13` (measured); the live keyless run advanced 5 steps with the project JSON persisted after each (re-read from disk); artifacts recorded `scorecard@P0, algorithm@P0, gate@P0, graph@P1, gate@P1, memory@P2, gate@P2, mcp@P3, gate@P3, security@P4, packet@P4`. The append-only ledger was **not** exercised (my probe parked at P4 before any approval — `decisions: 0`). | WORKS (partially exercised) |
| 4 | Status block: gate `ok:true`, "scripts 220/220 + src 1803/1803" | README.md:12–14 | Superseded: W12 close record §5 (fixes/218:129–137) = scripts **261/261**, lib **1957/1957** +1 by-design skip, all 6 gates ok (taken-from, not re-run). | STALE (historical snapshot) |
| 5 | "Progress so far … test counts now scripts 235/235 + src 1811/1811" | README.md:136–137 | Same: outdated by W12 (261/1957). | STALE |
| 6 | Quickstart `… rapidtool-cli.mjs new "your brief here"` | README.md:36 | Run today: `{"ok":false,"error":"Unknown subcommand: new", code:RT_E_VALIDATION}`, exit 1. No `new` case/alias exists anywhere (`grep` found none). The real verb is `create --brief <text>`. | **BROKEN** |
| 7 | Quickstart `… run --until-hitl  # run to the next human gate` | README.md:37 | `--until-hitl` appears **nowhere** in the repo except this README line (grep across md/mjs/ts). `run` advances exactly **one** phase (`maxSteps = cmd === "run" ? 1 : undefined`, rapidtool-cli.mjs:450); the "until parked" verb is `gate` (:2900 USAGE). | **BROKEN/STALE** |
| 8 | Quickstart `approve --i-am-human  # pass the HITL seat` | README.md:38 | Real: non-TTY approve without the flag refuses with `RT_E_VALIDATION` (ran today, §4.3); with `--i-am-human` the seat is `human-cli-i-am-human` (rapidtool-cli.mjs:543, :578–580, :595; out-of-band token via `RT_HUMAN_SEAT_TOKEN`). | WORKS |
| 9 | `doctor` = "environment truth" incl. `autonomousSoftwareFactory` | README.md:35, :151 | Ran; full JSON in §2. Keyless `llm.configured:false`; `runner.sandbox:false`; factory false with 4 named gaps. | WORKS |
| 10 | `doctor --tree <dir>` = "job-file census for an emitted tree" | README.md:39 | Ran 3×; census returned with per-file kinds (§5). | WORKS |
| 11 | Limit 1 example: reference tree census `{stubs: 0, reexports: 5, real: 0}` | README.md:108–110 | Re-ran today on `research/eval-out/coffeehouse2home-property-ledger`: **exact match** `{stubs:0, reexports:5, real:0}`, files flip/publish/record/show/track all `kind:"reexport"`. The five files literally `export * from "./dispatch.ts"` / `../generated/check-reorder-flags.ts` (read). | WORKS (as an honest limit) |
| 12 | Limit 1 mechanism text: "…the rewire is fully designed (Wave 4) and lands in W6 (W5 shipped orderTreeChunks + the design; the caller rewire is W6-L1) — until then…" | README.md:106–112 | The *forward-looking* text is stale: the current scaffold **removed** job bridging entirely for tree-covered projects (fixes/216k D3, scaffold.ts:2534–2544 — an uncovered job node gets **no file**, counted as "NOT materialised" in the shipped README). Fresh emits today produce `{0,2,1}` (w1) or no `src/jobs` at all (c2h) — see §5. The limit ("does not emit a real multi-job product") is still TRUE; the mechanism/how-it-lands paragraph no longer describes today. | PARTIAL/STALE |
| 13 | "Chunked LLM synthesis with gates + bounded repair ✅ `codegen.server.test.ts` (86 tests)" | README.md:90 | File exists; validation/repair machinery exists in `codegen.server.ts` (nondeterministic-primitive detection :213, :843; repair prompt :1009–1012; validator-refusal repair :1068). Today `grep -cE '^\s*it\('` on that test file counts **112** `it(` rows (grep, not a run) — the "(86 tests)" figure is behind. Synthesis behaviour itself NOT re-run (needs a key). | PARTIAL (stale count; not re-run) |
| 14 | "tree-run = the product builds and tests … runs the tree's own `npm run typecheck`+`npm test`; a failing tree can never be `ok:true`" | README.md:93 | Code does this: `compile-check.server.ts` executes each spec via `node --test` inside the bounded runner (:245–255, :441) and the tree's declared scripts via `npm run <script>` in a temp copy (:513–524, :304, :368), and *refuses to fabricate* when the tool isn't installed ("…was NOT executed; the tree's own <script> is UNVERIFIED … not a fabricated pass", :840–841). I did not execute `tree-run`; I did see the red-trail side live: the C2H project's trail records 3 failed tree-runs and emit refused (§5.2). | PARTIAL (code verified; execution not re-run) |
| 15 | "Honest emission: refuse/banner on an uncleared red tree ✅ — refusal leaves nothing on disk" | README.md:94 | **Verified live.** `emit` on the red-trail project refused: exit 1, `RT_E_TREE_RUN_FAILED`, *nothing* written; the banner policy (via one-off) emitted 20 files with the `[!CAUTION] RED TREE-RUN — THIS ARTIFACT IS NOT VERIFIED` block stamped at the top of README.md. `headless.ts:1397–1410` / :1417–1421. | WORKS |
| 16 | "HITL seats: no machine path can mint `decidedBy:"human"` ✅" | README.md:95 | Ran the refusal: non-TTY `approve` → exit 1, `RT_E_VALIDATION`, "approve from a non-TTY requires --i-am-human (never mint decidedBy:human from an agent…)" (rapidtool-cli.mjs:543–550). The P4 seat prompt itself declares what may NOT be approved as fact (`hitl` payload, §4.2). | WORKS |
| 17 | "Assertion-gap lint … wired into gate.sh; 0 findings ✅" | README.md:97 | `scripts/gate.sh:87` runs `node scripts/check-assertion-gaps.mjs`; "0 findings" taken-from 218 §5 (`assertionGaps ok:true`). Not re-run (forbidden). | WORKS (taken-from for the count) |
| 18 | "`str_replace` patch primitive … (21 tests)" | README.md:98 | `grep -cE '^\s*it\(' src/lib/patch.test.ts` → **21**. Also flags honestly: "Not yet wired into P6/repair". | WORKS |
| 19 | "One-seam policy engine (default-deny approvals) … `src/lib/policy.ts` (27 tests)" | README.md:99 | grep → **27** `it(` rows; the seam is consulted in the CLI approve (:560–595) and edit (:1232–1235) paths I read. | WORKS |
| 20 | "UI: console, phase rail, HITL dock, runtime log, command palette (⌘K), typed timeline ✅" | README.md:100 | Components exist: `console.tsx`, `cmd-palette.tsx`, `runtime-timeline-pane.tsx`; RunTab union 10 tabs incl. `runtime` (console.tsx:132); Ctrl/⌘+K binding at :1285/:1675/:1697. Pixels not exercised today (no browser). | WORKS (code) |
| 21 | "Headless CLI: 34 verbs, JSON output, doctor, eval harness ✅" | README.md:101 | JSON output verified on every verb I ran; `doctor` ✓; `npm run eval` exists in package.json (`scripts/run-eval.mjs`); verb count 35 not 34 (row 2). | PARTIAL (stale count) |
| 22 | "Stability gate with flake detection ✅ (`bash scripts/gate.sh [--double]`)" | README.md:102 | `gate.sh` header lists 6 gates (typecheck/lint/assertion-gaps/scripts-tests/lib-tests/build) + JSON verdict + `--double`; matches the 218 §5 verdict shape. Not re-run. | WORKS (code; taken-from run) |
| 23 | "Nothing in this README is a promise — each row is pinned by a test or a command you can re-run" | README.md:155–156 | Mostly true for the capability rows I could cheaply re-run (doctor, census, emit-refusal, HITL refusal, counts). Exception: the Quickstart block (rows 6–7 above) is not pinned by anything and does not work. | PARTIAL |
| 24 | Limits 2–7 (P7–P12 patchy; no sandbox; no git landing; key needed; chat one-shot; local verification) | README.md:113–128 | All still consistent with what I saw: banner-tree rail shows P7–P12 `locked` (:62–67); `doctor` `sandbox:false` live; no `git` spawn found in `src/lib/*.ts` (grep); keyless probe stopped at P4 with 0 bytes of generatedSource; chat keyless refusal codes exist (`chat.server.ts:525,595`). Not each individually re-proven. | DECLARED-LIMIT (stands) |
| 25 | "`research/multiagent/*.md` (36 dossiers)" ×2 | README.md:143, :168 | `ls research/multiagent/*.md | wc -l` → **78** files today. | STALE |
| 26 | "RapidTool is a deterministic, governed **pre-flight compiler**: it does not build software itself." | AGENT_GUIDE.md:3–7 | Framing tension with README.md:3 ("compiles a brief into an audited build") and with what emit actually writes: a runnable scaffold whose first job hosts the P6 module verbatim + `tests/oracle.spec.ts` that executes it (w1 emit, §5.1). AGENT_GUIDE itself later says P6 is "a bounded template self-test … The real code is yours to write" (:52–54). So both stories coexist in the docs; the "does not build software itself" line understates what the P6 path emits today (one machine-verified module + chunks), and README's "build" overstates the multi-job product (one module / no jobs, §5). | PARTIAL (framing) |
| 27 | "DoD gates advisory when keyless … enforced by default keyed" | AGENT_GUIDE.md:12–16 | Code: `enforceDod` default = `keyedDeepSeekConfigured()` (engine.ts:1802–1808, :1884–1885); live keyless `create` printed `"enforceDod": false`; `--advisory` forces false (rapidtool-cli.mjs:428). | WORKS |
| 28 | "with no key, every phase is the deterministic scaffold. It never fabricates model output." | AGENT_GUIDE.md:81 | Live keyless `gate` completed P0–P3 as deterministic scaffolds and parked at P4 with `generatedSource` 0 bytes (nothing at P6 yet); the keyless-refusal code path exists (`RT_E_LLM_NOT_CONFIGURED` at `algo-tools.ts:109,125,233,250`, `chat.server.ts:525,595`). | WORKS (for what I ran) |
| 29 | "The code runner is a bounded local runner, **not a security sandbox**" | AGENT_GUIDE.md:83 | `doctor.runner.sandbox=false` live; isolation note string in the doctor JSON; `runnerIsSandbox` hardwired false (doctor.ts:230). | DECLARED-LIMIT (stands) |

**Honest limits the docs already state — confirmed accurate, not re-reported as lies:** rows 11,
24, 29 above. The README's "what it does not do" section is the most truthful part of the
document set: both of its headline claims I could test (single-module emission, no sandbox) are
still true today.

---

## 4. What a keyless run can and cannot do — traced live + in code

**Setup:** no `DEEPSEEK_API_KEY` in the environment (doctor: `llm.configured:false`). Scratch dir
`C:/Users/mnril/w13l1_scratch/keyless/`, brief: "Build a small CLI tool for tracking reading
lists: books, progress notes, and a focus timer." — NOT a corpus brief, a probe brief; stated so.

### 4.1 `create` (ran)

```json
{"ok":true,"path":"C:\\Users\\mnril\\w13l1_scratch\\keyless\\w13l1-keyless-probe.json",
 "summary":{"name":"W13L1 Keyless Probe","currentPhase":0,"status":"intake",
            "phaseCounts":{"ready":1,"locked":12}, …,"memoryCount":3,"failedGates":[],
            "sealedWithFailures":false},
 "enforceDod":false,"exit_code":0}
```

`enforceDod:false` is the live keyless default (engine.ts:1884–1885 via
`keyedDeepSeekConfigured()`, engine.ts:1802–1808). The CLI surfaces the *effective* value so a
caller never guesses it (rapidtool-cli.mjs:435–438).

### 4.2 `gate` (ran) — the deterministic floor

5 steps; result: `{"ok":true,"summary":{"currentPhase":4,"status":"awaiting_hitl",
"phaseCounts":{"complete":4,"awaiting_hitl":1,"locked":8},"failedGates":[]},"steps":5,
"stopped":true}`, **exit 2** (parked at a HITL seat). Project state after: `modelRoute:
"deterministic"`, `generatedSource` **0 bytes**, phases `P0–P3 complete` (each with a
`gate.verdict … PASS · 0 unmet` log row), `P4:awaiting_hitl`. Artifacts recorded before parking:
`scorecard@P0, algorithm@P0, gate@P0, graph@P1, gate@P1, memory@P2, gate@P2, mcp@P3, gate@P3,
security@P4, packet@P4`. The P4 seat payload is itself honest about what is *not* implemented:

> "Confirm the implemented execution boundary: Engine-template runner (bounded, engine-authored
> code only) (timeout 30s, ramMb unset), non-isolated flag … **Declared-not-implemented (do NOT
> approve as fact): 256 MB cgroups/gVisor/WASM isolates, OAuth-scoped tool calls, worker sandbox.**"

So, keyless: P0–P3 (research→architecture→memory→tools) really run and produce artifacts; P4
stops for a human seat; nothing model-authored exists yet.

### 4.3 `approve` without the seat (ran) — the guard

```json
{"ok":false,"error":"approve from a non-TTY requires --i-am-human (never mint decidedBy:human
 from an agent; use the autopilot gate for machine approval)","code":"RT_E_VALIDATION","exit_code":1}
```

### 4.4 What a keyed run would add (code-cited; **NOT run** — no key present)

- P6 `liveP6Synthesis(project)` "upgrades a deterministic P6 result (the honest floor) to a
  model-built module" (codegen.server.ts:5); every failure step "degrades to the deterministic
  floor — a run never strands and never fabricates a pass" (:13–16, :52, :72). The C2H project I
  emitted is the keyed shape: `modelRoute: "deepseek-pro"` in its emitted README (line 21) and
  1243 lines of generated chunks on disk (§5.2).
- `doctor`'s `llm.label` flips to `deepseek (<model ids>)` (headless.ts:3136–3138) — unverified live.
- DoD gates enforce by default (keyed) — `enforceDod` true unless `--advisory` (engine.ts:1884–1885).
- Keyless refusals that exist in code and would appear in model-needing paths:
  `RT_E_LLM_NOT_CONFIGURED` (algo-tools.ts:109/125/233/250; chat.server.ts:525/595); the P6
  expand-failure path is pinned by a test asserting "deterministic floor stands +
  RT_E_LLM_NOT_CONFIGURED refusal log" (codegen.server.test.ts:627 — test name read, test **not run**).

**Explicitly NOT run:** any keyed run, any `--live` research run, `wild`, `crew`, `prompt`,
`deepen`, `harvest`, `swarm`, `bench`, `eval`. Everything keyed above is code-read + the one
keyed artifact (C2H) that the repo already ships.

---

## 5. The emitted product, re-measured today (scratch emits + census)

All emits wrote to `C:/Users/mnril/w13l1_scratch/` (outside the repo). Three attempts, and the
refusal is itself a result:

### 5.1 CLI emit of the W1 project (the clean path) → census `{0,2,1}`

`emit --project "…/w1-source-project.json" --out "…/emit-w1"` → **ok:true, 18 files,
`moduleEmbedded:true`**, exit 0 ("kind webapp · packet w1-probe"). Census
(`doctor --tree C:/Users/mnril/w13l1_scratch/emit-w1`):

```json
"inventory": { "scanned":"C:\\Users\\mnril\\w13l1_scratch\\emit-w1",
  "stubs":0, "reexports":2, "real":1,
  "files":[ {"path":"src/jobs/dispatch.ts","kind":"real"},
            {"path":"src/jobs/reroute.ts","kind":"reexport"},
            {"path":"src/jobs/scan.ts","kind":"reexport"} ] }
```

`dispatch.ts` hosts `project.generatedSource` verbatim ("This file hosts the machine-verified P6
synthesis module … verbatim below") and is classified **real** because it contains the module
body; `reroute.ts`/`scan.ts` are `export * from "./dispatch.ts"` bridges (fixes/144 M2 path,
scaffold.ts:2573–2588 — the *non-tree* branch). So: today's emit does produce **one** real job
module when the project carries a single generated module — but not a multi-job product.

### 5.2 CLI emit of the reference corpus project (C2H) → **REFUSED** (finding)

`emit --project "…/c2h-project.json" --out "…/emit-c2h"` → exit 1:

```json
{"ok":false,"error":"emit refused: the project's tree-run trail is RED (3 failed tree-runs,
 no green run since) — reach a green tree-run (rapidtool tree-run) or emit with redTree:\"banner\" …
 Last failure: tests/oracle.spec.ts: fail — test \"…\\rt-treerun-OIBoAy\\tests\\oracle.spec.ts\" failed",
 "code":"RT_E_TREE_RUN_FAILED","exit_code":1}
```

Nothing was written (the refusal happens before scaffold compile / lock / writes —
headless.ts:1393–1410), and `doctor --tree .../emit-c2h` reports `{stubs:0,reexports:0,real:0,
files:[]}`. **F1:** the error text instructs "emit with `redTree:"banner"`" but **no CLI flag can
do that** — `grep "redTree\|red-tree" scripts/rapidtool-cli.mjs` → nothing; the CLI emit case
passes only `{force}` to `emitProject` (rapidtool-cli.mjs:807); banner is reachable only
programmatically or via the eval driver (`run-eval.mjs:805` uses `emitProject(…,{redTree:"banner"})`).
An operator following the error message's advice from the CLI alone cannot.

### 5.3 Banner-policy emit (one-off out of band) → census `{0,0,0}`, files:[]

Via one `node --experimental-strip-types -e` call: `emitProject(project, "…/emit-c2h-banner",
{redTree:"banner"})` → **ok:true, 20 files, `redTreeBanner:true`**. Census:

```json
"inventory": { "scanned":"C:\\Users\\mnril\\w13l1_scratch\\emit-c2h-banner",
  "stubs":0, "reexports":0, "real":0, "files":[] }
```

The tree is real code — `src/generated/chunk-0.ts` (863 lines), `create-flip-project.ts` (262),
`compute-rent-roll.ts` (68), `check-reorder-flags.ts` (46, plus 4-line `src/generated.ts` barrel) —
but **there is no `src/jobs/` directory at all**, so the doctor scanner finds nothing. The RED
banner is stamped on README.md exactly as designed ("3 failed tree-runs … no green tree-run
since … do not treat this tree as a verified deliverable"). The emitted README's own honest
boundaries (lines 93–101, read in full) say: "5 declared spec-graph job node(s) were NOT
materialised by the generated tree (never bridged…): src/jobs/track.ts, record.ts, flip.ts,
show.ts, publish.ts"; "3 non-job module(s) are thin bridges to the tree entry:
src/domain/real_estate.ts, src/api/routes.ts, src/state/store.ts"; "Oracle rows: 0 of 6 pinned …
6 are NOT IMPLEMENTED — emitted as visibly-marked test.skip … (never green)".

**F2 (scanner blind spot):** the census only reads `src/jobs|jobs`, so a tree whose job paths were
deliberately *not* materialised (216k's design) reports `{0,0,0}` — the factory latch then stays
false for the right reason but with no visible cause; the *shipped README* discloses the cause
(line 97) while the *doctor JSON* does not (it has no "unmaterialised" field). 

**F3 (declared-vs-materialised drop, visible in this artifact):** the brief declares **10** jobs
(`project.lattice.jobs = [track,record,flip,show,publish,sync,lease,stage,rent,bid]` — read from
the project JSON today) but the spec graph materialises **5** (`job-0…job-4` →
`src/jobs/track|record|flip|show|publish.ts`; the 5-node cap is `lattice.jobs.slice(0, 5)` at
`algorithms.ts:700`, also :815 for oracle rows). The emitted README's line 97 names those 5
spec-graph nodes as unmaterialised — but the other **5 declared jobs (sync, lease, stage, rent,
bid) appear nowhere in the emitted tree/README**, and this project's log trail contains **no
`p6.jobs.shortfall` row** (`node -e` filter → 0 rows), the row the engine is supposed to persist
for exactly this shortfall (engine.ts:1336–1364; doctor.ts:103–113). So on this bundled artifact
the 10→5 drop is silent (the mechanism exists in code; the artifact predates or bypasses it — I
report the artifact as found).

**F4 (internal tension in the emitted README):** the "What ships in this scaffold" table lists
`src/jobs/track.ts` … `src/jobs/publish.ts` (lines 40–44) under that heading even though those
files do **not** exist on disk and line 97 of the same README says they were never materialised
(table generated from the scaffold's declared layout, scaffold.ts:2061–2065; the same document
then discloses the absence). Readers who stop at the table are misled; readers who reach line 97
are not.

**Bottom line of the census re-measure:** today's emitted product is *either* (non-tree projects)
one real module + N thin bridges *or* (tree projects) real generated chunk files but no job
modules at all; in every case measured today `real` job modules ≥2 with zero leftovers does not
occur, so `doctor`'s factory latch stays false — truthfully.

---

## 6. Plain-language bottom line

RapidTool today is a real, deterministic, 13-phase pipeline that genuinely runs end-to-end
without a browser **and without an API key**: it takes a brief, walks P0–P3 producing recorded
artifacts, stops at a human seat (P4) with an honest prompt, and refuses to fake anything — DoD
gates are advisory keyless and enforced when keyed, and failures come back as coded `RT_E_*`
envelopes rather than silent passes. Its honesty machinery is the strongest part of the product,
and I verified it live: `doctor` reports `autonomousSoftwareFactory: false` with four named gaps
it will not let anyone fake away; emit **refuses** to ship a tree whose own tests are red unless a
banner-policy path stamps the RED banner on the artifact; a non-TTY `approve` is refused so no
machine can mint a "human" decision. What is *not* there yet, measured today rather than told:
the emitted product is still not a real multi-job software product — the fresh trees I emitted and
censused scored one-real-module-plus-bridges (W1) or zero job modules at all (C2H), the C2H
project declares 10 jobs of which the spec graph materialises 5, and its red tree-run trail means
the shipped artifact is explicitly unverified; also, the README's headline Quickstart is broken
(`new` is not a verb; `run --until-hitl` is not a flag) and several doc counts (34 verbs, test
numbers, "36 dossiers") sit behind the bytes. So: a solid, honest governance harness and P6
module pipeline — **not yet** an autonomous software factory, and the one artifact that best
represents "the factory's output" (the reference corpus tree) fails its own tests and is emitted
with a red banner rather than silently. That is the state of the factory on 2026-09-24: the
honesty layer is built and working; the multi-job build layer is not, and the product says so
itself.

---

*Lane 1 ends here. Fix proposals are lane 5's; defect status is lane 2's. Every number above is
reproducible from the commands in §0.*
