# RapidTool

A **deterministic, governed workbench for building software with AI agents**. RapidTool compiles
a client brief into an audited, phase-by-phase build: research → architecture → interface →
synthesis → verification → a paste-ready **Agent Packet** — all behind evidence-hashed DoD
gates, an append-only decision ledger, and a hard no-fabrication **honesty contract**.

**Two surfaces, one engine:** a browser app (TanStack Start + React 19, `http://localhost:8080`)
and a file-based headless CLI (`scripts/rapidtool-cli.mjs`, **39 verbs** — re-derived:
`grep -c 'case "' scripts/rapidtool-cli.mjs` = 39) that drives the same
pure engine with no browser and no server.

> **Status (2026-09-26 — the W12 boundary gate is the latest full gate of record, `fixes/218` §5; the W29–W38 era is uncommitted):**
> `bash scripts/gate.sh` → **`ok:true`** (typecheck 0 · lint 0 · assertion-gap lint 0 ·
> scripts **261/261** + src **1957/1957** tests (1 by-design skip) · build 0). All of that is re-runnable by you:
> the gate script emits a single JSON verdict. Everything since HEAD `0f85c32` — the W29–W37 audit/coder/shell
> era — is **uncommitted working tree**; the next full boundary (re-run the gates on the current tree, then
> commit the era) is scheduled in `wave_plans/W38/NEW-SESSION-PROMPT.md` Phase 1. RapidTool is **not yet** an
> autonomous software factory that beats Codex/OpenHands/Claude Code — and it **tells you that itself**:
> `doctor` reports `autonomousSoftwareFactory: false` with named `gaps[]`. The remaining
> code-level work is catalogued wave-by-wave in **[`remainingwaves.md`](remainingwaves.md)** and
> shell-by-shell in `finalsprint.md` (working tree).

---

## Table of contents

1. [For AI agents — read this repo in this order](#for-ai-agents--read-this-repo-in-this-order)
2. [Quickstart](#quickstart)
3. [Environment](#environment)
4. [What RapidTool is (and its architecture in one screen)](#what-rapidtool-is-and-its-architecture-in-one-screen)
5. [What it does today — capabilities that pass tests right now](#what-it-does-today--capabilities-that-pass-tests-right-now)
6. [What it does **not** do yet — the honest limits](#what-it-does-not-do-yet--the-honest-limits)
7. [Current state — 2026-09-26 (works / shelled / blocked)](#current-state--2026-09-26-works--shelled--blocked)
8. [Progress so far (the paper trail)](#progress-so-far-the-paper-trail)
9. [Verification — how to check every claim above](#verification--how-to-check-every-claim-above)
10. [**THE CATALOG — every tracked file**](#the-catalog--every-tracked-file-1391-today)
11. [Docs index](#docs-index)
12. [License](#license)

---

## For AI agents — read this repo in this order

This repository is worked by AI agents, so the reading order is part of the contract. Read top to
bottom, and mind the **trust order**: bytes on disk beat every document; where documents disagree,
the newest byte-read and the finding register's corrections win.

1. **`README.md`** (this file) — what RapidTool is, the honest state, and **the catalog of every
   tracked file** (§10). Start here so you know what exists before you touch anything.
2. **`START-HERE.md`** (tracked; written as a working-tree file 2026-09-26) — the cold-start map: the 10-line
   tour, the read order, the run commands (each verified or explicitly marked why not), the
   never-do hard rules.
3. **`AGENTS.md`** — the repo working contract: source layout, commands, the honesty contract
   (non-negotiable), strict file-ownership rules.
4. **`research/multiagent/thoroughanalysis.md`** — **the register**: the deep audit's mission
   preamble + every finding (`A*`/`C*`/`W-*`/`R*`/`T*`) with `file:line` evidence. Read its header
   PROTOCOL before appending anything — it is append-only via its end-marker.
5. **`finalsprint.md`** (tracked) — the W30 shell-sprint master table: every
   remaining capability, its shell status, and what it needs to become real. Its publisher-listed
   `§MASTER-CORRECTIONS` append is **owed, not yet landed** — until it lands, treat the master
   table plus the RS-01…RS-04 correction rows in `fixes/274_wdx2.md` as the audited record, and
   never trust a lane log's "landed" list over the bytes.
6. **The current-wave dispatch** — `wave_plans/W37/master-pack.md` (the X1–X6 lane packs naming
   every remaining task) and `wave_plans/W38/NEW-SESSION-PROMPT.md` (the finish-RapidTool task
   list; both tracked).
7. **The live lane logs** — `fixes/` (newest number = current wave; `fixes/271–286` are the W29–W38
   era). Each log is a claim + evidence; verify before building on it (the audits found lanes that
   overstated — e.g. `finalsprint.md`'s CF-1/CF-2 rows).
8. **`RESUME.md`** → **`taskuniverselog.md`** → **`remainingwaves.md`** — the session-start set
   named by `AGENTS.md`; then `docs-FOLDER-MAP.md` (working tree) for a depth-2 navigation map.

**What to trust, in order:** (1) bytes you read today / commands you ran today; (2) the register's
corrections and the audit rows in `fixes/265–282` + `finalsprint.md`'s byte-census notes;
(3) dated status blocks (they are snapshots, not promises); (4) prose anywhere — the honesty
contract (`AGENTS.md` §Honesty) makes a stale claim a defect, so when you find one, fix it and log
the before/after in your `fixes/NN_*.md` lane log.

**Path gotcha:** the repo folder has a space — `cd "/c/Users/mnril/Desktop/RapidTool Main"`; ripgrep-style
tools fail on it, use terminal `grep`. Node **22** required (verified v22.23.2).

---

## Quickstart

```bash
# Requirements: Node 22 (verified on v22.23.2), npm
npm install

# Browser app → http://127.0.0.1:8080 (loopback by default, R11-f01; port + strictPort stay a fixed contract in vite.config.ts)
# Live-preview panel/iframe cases need the LAN bind — opt in explicitly:
#   RAPIDTOOL_BIND_ALL=1 npm run dev   → http://0.0.0.0:8080
npm run dev

# Full stability gate (6 checks + JSON verdict; --double adds a flake detector)
bash scripts/gate.sh

# Headless CLI — the same engine without a browser (one JSON object per call; full contract: scripts/README-cli.md)
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor                     # environment truth
node --experimental-strip-types scripts/rapidtool-cli.mjs create --brief "your brief here" --out build.json  # intake → project file
node --experimental-strip-types scripts/rapidtool-cli.mjs gate --project build.json  # advance until parked (awaiting_hitl → exit 2)
export RT_HUMAN_SEAT_TOKEN="$(head -c 24 /dev/urandom | base64)"                     # the human seat's out-of-band token (TA-2)
node --experimental-strip-types scripts/rapidtool-cli.mjs approve --project build.json --i-am-human  # pass the parked HITL seat
node --experimental-strip-types scripts/rapidtool-cli.mjs emit --project build.json --out emitted/   # write the runnable scaffold
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --tree emitted/     # job-file census for an emitted tree
```

### The truthful smoke — reading the verdict, not trusting it

The quickstart above is the whole keyless path; what makes it a *smoke* rather than a demo is that every
step prints one machine-checkable JSON envelope, and the emitted tree can be re-verified at any time
without re-emitting:

```bash
# Re-run the emitted tree AS-IS (read-only oracle — never re-emits, never clobbers edits):
node --experimental-strip-types scripts/rapidtool-cli.mjs tree-run --dir emitted/
```

Read what comes back truthfully:

- **Green (exit 0) `emit --run` / `tree-run`** means the emitted **files parse, the emitted tests
  pass as emitted, and the entry loads** — never that the brief's jobs work.
- Every runnable verdict carries a **`substance` census** (`stubs:N reexports:N real:N`). When the
  tree ships stub or reexport-only job modules, a loud **`SUBSTANCE MARKING`** note rides the
  envelope and `greenWhileStubbed: true` says it plainly: **exit 0 here is not product quality**
  (K3). `doctor --tree` shows the same census in the same classifier vocabulary.
- **Implementing a stubbed seam reddens the emitted `tests/oracle.spec.ts`** until its assertion is
  replaced — the K4 oracle trap; the same note says so, never silently.
- **Red is never a fake 0:** a red `--run` exits 1 with `RT_E_TREE_RUN_FAILED` plus the first not-ok
  tail on the envelope, and `treeRun.verdictHash` (FNV-1a over the decisive verdict fields —
  integrity, not cryptography) lets a re-run prove whether the machine verdict changed: same hash,
  same verdict.
The CLI's full verb reference — all **39 verbs**, the exit-code taxonomy (0/1/2/3/4), the `RT_E_*`
registry, and the Hermes-style agent loop — lives in **`scripts/README-cli.md`** (doc-contract
tested by `scripts/README-cli.test.mjs`: the count, the verb list, and the `edit`/`emit` sections
are pinned to the dispatcher's bytes). Read it there; it is not duplicated here.

### Environment

**Browser app:** `DEEPSEEK_API_KEY` in `.env` enables LLM-backed phases (P6
synthesis, Chat, expansion); the app's dev/build tooling loads `.env` for you. **Headless CLI:**
it does **not** read `.env` — export the variable in the shell
(`DEEPSEEK_API_KEY=… node --experimental-strip-types scripts/rapidtool-cli.mjs …`, see
`scripts/README-cli.md` §Live mode). Without a key the engine still runs and is honest about
skips. Research probes use free keyless sources (duckduckgo/searxng/wikipedia) and report what
they could not reach. `.env.example` documents every knob (model pins, `RAPIDTOOL_TOKEN_CAP`,
`RT_HUMAN_SEAT_TOKEN`, pricing, log dirs, eval dirs, timeouts) — `.env` itself is gitignored and
**never printed**.

---

## What RapidTool is (and its architecture in one screen)

```
brief ──► intake ──► P0..P12 phase engine (pure, deterministic, headless-capable)
                        │
                        ├─ P0-P6  research → architecture → interface → SYNTHESIS (the build)
                        │           · chunked LLM synthesis, validated + bounded repair
                        │           · compile-check, oracle rows (A7), tree-run verdicts
                        ├─ P7-P12 packet/tail artifacts (see "limits" — candidly partial)
                        │
                        └─► DoD gates (evidence-hashed) · decision ledger (append-only)
                            · verify-fix loop (machine) · Agent Packet (paste-ready)
                            · knowledge vault (Obsidian-style) · self-learning store
```

- **Engine:** pure TypeScript modules in `src/lib/*.server.ts`, driven by
  `headless.ts` (journey/runHeadless) and `engine.ts` (phase state machine). The browser and
  CLI are both thin surfaces over it.
- **Governance:** every approval carries a **seat** (`autopilot` vs a human seat that requires
  an out-of-band token), every phase transition needs evidence, and refusals are **coded**
  (`RT_E_*`) rather than silent.
- **Synthesis:** P6 asks a model for module code in **signature-bound chunks**, then
  compile-checks and runs each job module's own oracle. Prose-in-code, `Math.random`, and
  forbidden primitives are **refused** (with one bounded repair attempt each, then a coded
  refusal — never a fabricated pass).
- **Trust model:** byte-level. If the product's own `npm test` fails, `tree-run` can never
  report `ok: true`; a red verdict survives in the durable trail and `emit` refuses (or
  banners, on the eval path) — it cannot be shipped quietly.

Key files: `src/lib/engine.ts` · `headless.ts` · `codegen.server.ts` (P6 + chunk planning) ·
`scaffold.ts` (tree writer) · `compile-check.server.ts` + `node-runner.server.ts` (bounded
runner — **not a sandbox**) · `verify.server.ts` + `dod.ts` (oracles) · `doctor.ts` (environment
truth) · `packet.ts` + `phases.ts` · `console.tsx` (UI) · `scripts/rapidtool-cli.mjs` (39 verbs).

---

## What it does today — capabilities that pass tests right now

| Capability | State | Proof |
|---|---|---|
| 13-phase engine, resumable state, append-only ledger | ✅ | `src/lib/engine.ts` + suite; `runHeadless` tests |
| Brief → plan → architecture → interface artifacts | ✅ | P0–P5 module suites |
| Chunked LLM synthesis with gates + bounded repair | ✅ | `codegen.server.test.ts` (119 tests; counted `it(`/`test(` today) incl. refusal e2e |
| Prose-in-code / `Math.random` / forbidden-primitive refusal | ✅ | T-09/T-15 wiring + e2e pins (Wave 2–3) |
| Oracle rows: each job module must pass its OWN behavioral test | ✅ (engine) | `verify.server.ts`; tree-run executes them |
| **tree-run = the product builds and tests** | ✅ | T-18 (Wave 3): runs the tree's own `npm run typecheck`+`npm test`; a failing tree can never be `ok:true` |
| Honest emission: refuse/banner on an uncleared red tree | ✅ | T-07 (Wave 2): `redTree` policy; refusal leaves nothing on disk |
| HITL seats: no machine path can mint `decidedBy:"human"` | ✅ | TA-2 (Wave 2): `ApproveActor` + out-of-band token |
| Lesson loop: failure signatures, refusal rows, accrual | ✅ wired+pinned | 112 T1/T2 (Waves 3–4); `knowledge.ts`/`engine.ts`/`verify.server.ts` |
| Assertion-gap lint (tautology detection repo-wide) | ✅ | `scripts/check-assertion-gaps.mjs`; wired into `gate.sh`; 0 findings |
| `str_replace` patch primitive (unique-match + graded fuzzy) | ✅ wired | `src/lib/patch.ts` (25 test blocks today). **Wired into P6 synthesis repair** (`codegen.server.ts:127` imports `applyStrReplace`, applied at `:1083`) **and the CLI `edit` verb** (`rapidtool-cli.mjs:2860`) |
| One-seam policy engine (default-deny approvals) | ✅ core | `src/lib/policy.ts` (33 test blocks today). **Routing wired in W5** (all 3 sites, seats byte-identical; bypass pins → W6-L2) |
| UI: console, phase rail, HITL dock, runtime log, **command palette (⌘K)**, typed timeline | ✅ | `console.tsx` + `cmd-palette.tsx` + `runtime-timeline-pane.tsx` |
| Headless CLI: 39 verbs, JSON output, doctor, eval harness + the read-only `eval` scorecard verb | ✅ | `scripts/rapidtool-cli.mjs`; `README-cli.md` (doc-contract tested) |
| Stability gate with flake detection | ✅ | `bash scripts/gate.sh [--double]` (first green run 2026-09-16) |

## What it does **not** do yet — the honest limits

1. **The emitted product is still ONE module wearing several filenames — on the KEYLESS floor.**
   *(Qualifier added 2026-10-02 by the W47 record audit: the flat claim is superseded — a keyed run emits a
   real multi-job product, see "Corrections in force" below.)*
   The headline open item (TA-15). On the reference corpus trials (2026-09-16):
   `doctor --tree research/eval-out/coffeehouse2home-property-ledger--trial-1` →
   `{stubs: 0, reexports: 4, real: 1}` — of the 5 declared job paths ONE hosts the P6 module
   (`track.ts`) and four re-export it; a fresh keyless emit (2026-09-26) reads the same shape
   (`{0,4,1}`, host `schedule.ts`). The all-reexport vintage `{0,5,0}` lives in
   `…run-2026-09-10`. Until a run covers the other job paths with real modules, RapidTool
   does **not** emit a real multi-job product, and it must not be claimed to.
2. **P7–P12 phases often produce no artifacts.** The engine reports this honestly now
   ("Phase coverage: N of 13 / M artifacts from P7–P12" in every packet). Unblocking them is
   roadmap, not reality.
3. **No real isolation.** The bounded runner executes with timeouts + scrubbed env but it is
   **not** a sandbox — no Docker/bwrap. Doctor says `sandbox: false`, and nothing may claim
   otherwise.
4. **No git landing / checkpoint-resume yet** (T4.x, T-107.7): the factory emits trees; it
   does not commit them or snapshot/resume mid-run. (Checkpoint code now exists in the working
   tree — see §7 — but is not yet a shipped, pinned capability.)
5. **LLM work needs a key.** Without `DEEPSEEK_API_KEY` the phases that call a model skip
   honestly; a *keyed* full run also costs tokens — budgets/ledger unification is roadmap
   (T-107.6).
6. **Chat is grounded tools + one-shot model text.** No shell, no disk patch, no agents from
   chat.
7. **Verification is deep but local.** 2000+ tests run on this machine; CI wiring, cross-machine
   reproducibility, and *keyed* eval evidence are roadmap (the run-side graders + trials/pass@k
   harness shipped in W5; a keyed run still needs a live `DEEPSEEK_API_KEY` — T0.10; the tracked
   scorecard `research/eval-out/results.json` shows the last keyed attempt).
8. **English-only.** The console UI and every app the factory emits are hardcoded en-US strings —
   there is no i18n library, no locale tables, and no `Intl` usage; brief-level locale support is
   future work (R15-f11).

## Current state — 2026-09-26 (works / shelled / blocked)

_Sources: `START-HERE.md` §"Honest state" (verified on this machine the same day), `finalsprint.md`
(master table + §WDX polls + §S5), and byte-checks performed while writing this README
(`git ls-files`, `grep -c 'case "'`, file heads; log: `fixes/286_readme_catalog.md`)._

**Works today** (pinned by tests/commands you can re-run): the 13-phase deterministic engine with
resumable state + append-only ledger · brief→plan→architecture→interface artifacts · chunked LLM
synthesis with gates + bounded repair (keyless = honest floors + `RT_E_LLM_NOT_CONFIGURED`, never
fake text) · banned-primitive refusals (prose-in-code / `Math.random`) · oracle rows + `tree-run`
(the emitted product must pass its OWN `npm run typecheck`+`npm test`; a red tree can never be
`ok:true`) · honest emission (redTree refuse/banner) · HITL two-channel seats (no machine path
mints `decidedBy:"human"`) · CLI 39 verbs incl. `doctor`/`diagnose`/read-only `eval` scorecard ·
the console UI (9+ tabs, ⌘K palette, runtime log) · `gate.sh` with flake detection (first green
run 2026-09-16; W12 boundary gate = latest full green).

**Shelled / in progress** (per `finalsprint.md`; shells only — no fake behavior, each has
`TODO(<row-id>)` at its gap): the autonomy spine (wild keyed seam W-01 · mint reachability W-02 ·
emit materialization W-03, landed-by-E1b per the RS-01 correction) · wild supervisor Node-side
completer (R14-f01) · **unattended run (W-47 — REAL, W36; self-sufficient since 341-6: stock gates
auto-clear, only `forceHuman`/red-DoD parks)** · plan-before-execute (R13-f02 — real:
`stageWildPlan`/`engine.ts:4398` is the one staging site, `store.ts:1357`) · **checkpoint+`resume`
(T-107.7 — REAL, W36)** · **4 kind emitters (S2 — landed by 341-1); real graders + emitted UI seam (S2 —
recovery owed)** · **cassette replay (T5.7 — wired at the provider seam, 340-4)** · streaming surface (T5.1) · MCP client (F1) ·
second provider (F2 — registry entry already on disk per RS-02) · per-action allow-lists (F4) ·
per-run token ledger · dev-server bind hardening (R11-f01 — loopback default now in
`vite.config.ts`) · `--force` quarantine (R11-f08 — CLI wire landed W42; in-engine lift owed) · pane error boundary (R6-f12, partially
landed) · human-seat console surface.

**Blocked / known limits** (honest, not bugs to paper over): no isolation boundary — the bounded
node-runner is **NOT a sandbox** (R13-f04 = honest refusal; needs a host isolator that does not
exist here) · **CORRECTED 2026-10-02: keyed runs are NOT funding-blocked** — the account is funded and
the repo `.env` key works; the earlier 401/402 reports came from a stale Windows User-scope
`DEEPSEEK_API_KEY` shadowing it while nothing loaded `.env` (see `START-HERE.md` §CORRECTION and
`wave_plans/W45/parent-keyed-findings.md`). A keyed run now emits a **real multi-job product**
(`treeRun.substance {stubs:0, reexports:0, real:3}`, `p6-arch` PASS); the remaining gap is a
generated-code async defect recorded in `fixes/331_0_parent.md` §6.8 ·
the emitted product is still ONE module wearing several filenames on the KEYLESS floor (TA-15) · P7–P12 phases often
produce no artifacts · no git landing / no cross-machine reproducibility · Chat = grounded tools +
one-shot text, no shell/agents.

**Corrections in force:** `finalsprint.md`'s §S1 board over-claimed (3 of 4 items not in the
bytes — CF-1) and its `§MASTER-CORRECTIONS` self-append is still owed; the RS-01…RS-04 audited
corrections live in `fixes/274_wdx2.md`. Where any doc and the bytes disagree, the bytes win.

**Corrections in force — appended 2026-10-02 (W47 record audit; HEAD `6575669`):** the status banner
and "Current state" block above are dated 2026-09-26 and their counts have drifted — the current tree
measures **scripts 398/398 · src 2736 tests / 2726 pass / 10 skipped**, `npm run typecheck` exit 0
(both legs, `scripts/**` now covered as a per-file ratchet), `npm run lint` exit 0 / **0 warnings**,
CLI **39** verbs (`grep -c 'case "'`). W29–W46 are **committed** (no longer "uncommitted working
tree"), and limit #1 above holds only on the **keyless floor**: a keyed run emits a real multi-job
product (`treeRun.substance {stubs:0, reexports:0, real:3}` in `fixes/331_0_parent.md` §2;
`{stubs:0, reexports:0, real:2}` in `fixes/332_0_parent.md` §4).

**Corrections in force — appended 2026-10-03 (342-6 sweep; HEAD `686d7b6`):** the §10 census below is a
2026-09-30 snapshot and has drifted — live `git ls-files` reads **src 246 · src/lib 235 · scripts 49 ·
fixes 719 · wave_plans 139 · total 2,096**. `.t4scratch/` is still **192 tracked files** and still owes a
parent-signed `git rm` (it fails its own cleanup precondition — tracked, and named in live lane logs; see
`fixes/342_6_sweep.md`).

## Progress so far (the paper trail)

Five multi-agent waves ran 2026-09-16 (25 flash subagents, every wave closed with `gate.sh`-class
green): W1 corruption-class fixes → W2 repair/consolidation (T-07/TA-2, gates wired) → W3
tree-run builds+tests (T-18), lesson-loop wiring, UI wave → W4 Wave-H cores + UI finish + T-14
pins + gate.sh's first green run → W5 policy routing through the approval seam, provider registry
+ role tiers, run-side eval graders with trials/pass@k — test counts at W5 close: scripts
**235/235** + src **1811/1811** (current counts: the dated Status block above). Second `gate.sh`
green. Since then: W6–W24 landing waves (logs `fixes/216*`–`fixes/247*`) → the **W25–W28 deep
audit** (`research/multiagent/thoroughanalysis.md`, ~230 finding IDs; HEAD commit `0f85c32`) →
**W29–W30** coder + shell sprints (`fixes/271*`, `fixes/272*`; the shell master table is
`finalsprint.md`) → **W31–W37** completion lanes (`fixes/273*`–`fixes/282*`; the current packs
are `wave_plans/W34/prep.md`, `W35/factory-notes.md`, `W36/completion.md`, `W37/master-pack.md`).
**Every landing is verified against bytes and logged:** the lane-log "landed" lists are claims —
the audits (CF-1/CF-2 rows, `fixes/274_wdx1.md`) byte-check them, and the register's corrections
win. The trail:

- `taskuniverselog.md` — the live board: every task, status, and what remains, per dossier.
- `fixes/` — append-only per-lane landing logs (convention + key numbers in §10.9).
- `wave_plans/` — the per-lane dispatch plans the agents actually followed (§10.10).
- `RESUME.md` — full session handoff + hard rules + settled decisions.
- `research/multiagent/` (103 files today — `git ls-files research/multiagent/ | wc -l` = 103) — the analysis program behind all of it (§10.8).
- **`remainingwaves.md` — every remaining wave, task by task, with the files each touches,
  estimates, likely bugs, and the tests each needs.** ← start there for "what's left".
- `finalsprint.md` + `wave_plans/W37/master-pack.md` + `wave_plans/W38/NEW-SESSION-PROMPT.md` —
  the current finish-line set (all tracked).

## Verification — how to check every claim above

```bash
bash scripts/gate.sh          # the one command: 6 gates, JSON verdict, exit 0 required
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor   # env/factory truth incl. autonomousSoftwareFactory
node --experimental-strip-types scripts/run-eval.mjs --out <dir>   # acceptance harness (fixtures) into YOUR dir
```

*(Corrected 2026-10-02 by the W50 boundary owner, from the W49 lane-336-4 work: the bare
`npm run eval` line used to be shown unqualified. A bare run now **refuses with exit 2** —
it would rewrite the tracked `research/eval-out/**`, which is why no wave had dared run it.
Pass `--out <dir>` (or `EVAL_OUT_DIR`) to write the scorecard into a scratch directory; an
explicit `--out research/eval-out` still regenerates the tracked copy on purpose. Keyless runs
are the deterministic floor; `--keyed` needs a funded key.)*

Nothing in this README is a promise — each row above is pinned by a test or a command you can
re-run. Where reality is behind, the docs say so, the packets say so, and `doctor` says so.

---

# THE CATALOG — every tracked file (1,908 today)

**What this is:** the literal catalog of the repository's tracked universe. Counts re-derived
2026-09-30: `git ls-files | wc -l` = **1,908**. Every **root file, every script, every route,
every migration, every config** is named below; mass-produced classes (tests, wave plans, fix
logs, vault notes, eval trees, vault/E2E outputs) are described **by convention with their full
membership derivable from one command** — stated inline — because each member's purpose is its
category's purpose. Descriptions are evidence-based (file heads/comments read on 2026-09-26); a
genuinely unclear file says so. Re-count any directory with
`git ls-files <dir> | wc -l`; counts read the tracked index at HEAD `091b389` + the W44 wave's
staged changes (re-derived 2026-09-30 by the W44 wave — the W44 commit moved `fixes/`, `src/`,
`wave_plans/`, `scripts/` and root + Total together: 7 lane logs, 5 probe relocations, and the
eval/telemetry + MAX_FILES + store + seal/nit files. Re-count for the live truth).

## 10.1 Census (tracked, re-derived 2026-09-30 at `091b389` + the W44 wave)

| Area | Files | What it is |
|---|---:|---|
| `research/` | 476 | Analysis program + eval corpus + eval outputs (`multiagent/` 103 · `eval-corpus/` 23 · `eval-out/` 345 · 5 top-level research docs) |
| `fixes/` | 587 | Append-only per-lane landing logs (§10.9) |
| `src/` | 224 | The product: engine + UI (§10.6) |
| `wave_plans/` | 108 | Per-lane dispatch plans, W4–W24 · W26–W38 · W40 · W42 · W43 + the convention README (§10.10) |
| `.grok/` | 89 | Legacy platform chrome — **do not build on it** (§10.12) |
| `builds/` | 50 | Legacy sample build outputs (vault export + sample project) (§10.11) |
| `vault-e2e/` | 47 | Vault export of the HVAC Dispatch E2E project (§10.11) |
| `scripts/` | 46 | CLI + gates + guards + tooling + their tests (§10.7) |
| root | 41 | Every root file named in §10.2 |
| `screenshots/` | 16 | QA/app screenshots (§10.11) |
| `public/` | 10 | Static assets served as-is (§10.4) |
| `audit-bugs/` | 5 | Bug-audit reports (§10.12) |
| `audit/` · `review/` · `proposals/` | 3 + 3 + 3 | Audits, deep reviews, enhancement proposals (§10.12) |
| `server/` | 2 | Deployed-app PWA middleware + OG types (§10.4) |
| `migrations/` | 2 | Deploy SQL (§10.3) |
| `.github/` | 1 | CI workflow (§10.3) |
| `attachments/` · `artifacts/` · `.audit-g2/` | 1 + 1 + 1 | Historical artifact + stored image + G2 probe (§10.12) |
| `.t4scratch/` | 192 | Committed lane-scratch tree (was working-tree scratch; tracked at `ac6b151`) |
| **Total** | **1,908** | `git ls-files \| wc -l` |

## 10.2 Root files (all 41 tracked — named)

| File | Purpose (evidence: head/comments read 2026-09-26/27) |
|---|---|
| `README.md` | This file — the catalog + honest state. |
| `AGENTS.md` | Repo-level agent working contract: layout, commands, honesty contract, ownership rules. |
| `AGENT_GUIDE.md` | Product-level guide: how an AI agent consumes a RapidTool project + the honesty contract in full. |
| `START-HERE.md` | The cold-start map (10-line tour, read order, verified commands, hard rules). |
| `RESUME.md` | Session handoff: gate contract, hard rules, settled decisions (written 2026-09-16). |
| `taskuniverselog.md` | Live task-status board: every dossier task, status, next wave. |
| `remainingwaves.md` | The execution catalogue: every remaining wave with tasks/files/estimates/tests. |
| `finalsprint.md` | W30 shell-sprint master table + lane polls + §S5; §MASTER-CORRECTIONS owed. |
| `docs-FOLDER-MAP.md` | Depth-2 map, one line per node, generated from `git ls-files` (W32). |
| `agentnotes.md` | Historical master working doc (pre-W5); banner says do not read as current. |
| `AGENTS.project.md` | Stale scaffolding: a Grok-project mount note ("files at /workspace/artifacts"). Ignore. |
| `LICENSE` | MIT (Copyright 2026 RapidTool contributors). |
| `package.json` | npm scripts + deps; name `app-builder-workspace`; engines node ≥22; scripts route through `with-app-env.mjs`; `test` runs both legs. |
| `package-lock.json` | npm lockfile (carries the linux optional bindings the CI `npm ci` resolves). |
| `.env.example` | Env template: `DEEPSEEK_API_KEY`, `TAVILY_API_KEY` + every advanced knob (documented inline). |
| `.gitignore` | Ignore rules: node_modules/dist, secrets (`.env*`), `*.log`, `.hermes/`, `**/.rapidtool/logs/`. |
| `.prettierrc` | Prettier config (`semi: true`, `singleQuote: false`, …). |
| `.prettierignore` | Prettier ignores (R15-f05). |
| `.node_modules.lock` | An **empty** marker file (0 bytes) — platform tooling sentinel. |
| `eslint.config.mjs` | ESLint flat config (js + prettier + react-hooks plugins). |
| `tsconfig.json` | TS config: strict, ES2022, bundler resolution, `allowJs`/`checkJs` for the migration-plan import. |
| `tsconfig.scripts.json` | Scripts-program TS config (R15-f04 staged; its error census = 1030 pre-existing, see `finalsprint.md`). |
| `vite.config.ts` | Vite + TanStack Start + Nitro + Tailwind config: port 8080 + `strictPort` fixed contract; dev bind loopback by default (R11-f01), `RAPIDTOOL_BIND_ALL=1` opts out; PGLite bootstrap; serverDir `./server`. |
| `build.json` | Sample project file: "HVAC Dispatch" (the CLI quickstart's output, tracked as a fixture). |
| `w1-source-project.json` | Sample project file: "W1 Boot Probe" (used by W1-era probes). |
| `packet-e2e.md` | Sample **Agent Packet v2** ("HVAC Dispatch") — an E2E artifact kept as reference. |
| `design-e2e.html` | Sample design-system preview output ("HVAC Dispatch · Design system") from the `design` verb. |
| `phases-e2e.svg` | Sample `diagram` output: "HVAC Dispatch — phase pipeline". |
| `arch-e2e.svg` | Sample `diagram` output: "HVAC Dispatch — architecture". |
| `flow-e2e.svg` | Sample `diagram` output: "HVAC Dispatch — gate flow". |
| `startup.sh` | Legacy platform boot script (`cd /workspace` — this repo's root is elsewhere; ignore per AGENTS.md). |
| `probe-b2-before.ts` | Probe: legacy scaffold-emission baseline (fixes/144 M2/B2 before-evidence). |
| `probe-b2-runspec.ts` | Probe: materialize tree-mode scaffold + run the emitted oracle spec under `node --test`. |
| `probe-b2-tree.ts` | Probe: exercise tree-mode assembly (fixes/144 M2/B2). |
| `probe-h3-tap.ts` | W26 probe: does an async LLM call-tap escape its try/catch containment? |
| `probe-h3-tap-crash.ts` | W26 probe: same tap without an unhandledRejection listener (process-death path). |
| `probe-h3-balance.ts` | W26 probe: error class for HTTP 402 (the `RT_E_LLM_NO_BALANCE` doctrine). |
| `probe-r5-misc.ts` | Probe: tracing validation + render/vector fuzz. |
| `probe-r5-vector.ts` | Probe: `vector.ts` sanitizeSvg fuzz hypotheses. |
| `probe_h1_libcrash.ts` | W26 temp probe (hostile-input sweep); its own header says "deleted after the run" — it wasn't; kept for the record. |
| `err2.txt` | **Empty** (0-byte) stray — named like an stderr capture, never written to; tracked since `70108c6`; nothing references it (kept for the record). |
(2026-09-30: the W41/W44 `probe*.mjs` scratch probes now live under `fixes/` — `318_probe_*` from the W44 relocation; removed rows: `probe-k9-kinds.mjs` · `probe_n2_f316.mjs` · `probe_311_shots.mjs` · `probe_c1_arith.mjs` — see `fixes/318_a4_hygiene.md`)

## 10.3 `.github/` · `migrations/`

- `.github/workflows/gate.yml` — the ONE CI workflow: runs `scripts/gate.sh` unchanged, keyless by
  design. **Honest limit (in-file):** it has never executed (landed without a push run), and the
  ubuntu leg cannot catch this repo's Windows-path bug class; a commented windows leg exists but
  is deliberately not enabled.
- `migrations/auth/0001_auth.sql` — Better Auth schema (identity + sessions), generated by the
  Better Auth CLI; applied by `scripts/migrate.mjs` in `npm run build`, or by PGLite in dev.
  - `migrations/auth/0002_account_unique.sql` — the account-uniqueness migration (tracked).

## 10.4 `public/` · `server/`

- `public/favicon.svg`, `public/og.jpg` — site icon + OpenGraph image.
- `public/__grok/icon-180.png`, `public/__grok/install/styles.css`,
  `public/__grok/install/assets/homescreen/{glass-puzzle.svg, glass-share.svg, logo-grok.svg,
  ob-ipad.png, ob-phone.png, plus.svg}` — legacy platform PWA chrome assets (install page +
  home-screen tutorial imagery). Not product logic.
- `server/middleware/grok-pwa.ts` — deployed-app (Nitro) half of the platform PWA chrome
  (auto-registered because `vite.config.ts` sets `serverDir: "./server"`).
- `server/virtual-grok-og-identity.d.ts` — type declarations for the `virtual:grok-og-identity`
  module.

## 10.5 `src/` — top level

- `src/router.tsx` — the TanStack router factory (error components + telemetry client install).
- `src/routeTree.gen.ts` — **generated** by the TanStack router plugin; never hand-edit.
- `src/styles.css` — Tailwind v4 entry (`@import "tailwindcss"` + `@theme` tokens).
- `src/components/` (5): `console.tsx` (the main console surface — ~6.8k lines),
  `cmd-palette.tsx` (⌘K command palette over run actions), `runtime-timeline-pane.tsx` (typed
  timeline sibling of the Runtime log tab), `pipeline-rail.tsx` (the pipeline-visibility rail —
  P0→P12 rows from `project.phases`, the Now-line from the newest real event, and per-phase
  detail incl. the wild/park record), `preview-host-bridge.tsx` (mounts once in `__root` so the
  preview chrome can drive navigation; noops when not embedded).
- `src/routes/` (3): `__root.tsx` (root layout + auth provider), `index.tsx` (HomeScreen from
  `console.tsx`), `run.$id.tsx` (RunScreen from `console.tsx`).

## 10.6 `src/lib/` — the engine (213 files = 120 modules + 93 colocated tests; the tracked stray temp was removed in the W40 era — re-derived live 2026-09-30)

**88 direct modules** (one line each; the module's comments read 2026-09-26/27; re-counted 2026-09-30):

- **Core:** `engine.ts` (13-phase state machine: applies phase results, gates, repairs, sealing) ·
  `phases.ts` (phase graph defs + coverage/transition helpers) · `store.ts` (zustand store — the
  console's state driver) · `types.ts` (core project/phase types) · `errors.ts` (the `RT_E_*`
  registry; `ERROR_CODE_DOC` is canonical) · `dod.ts` (machine-checkable DoD gate registry) ·
  `io.ts` (project import/export + packet export; shape validation + repair) · `packet.ts` (Agent
  Packet v3 compiler) · `headless.ts` (file-based headless driver; the CLI backend) ·
  `judgment.ts` (phase verdict ladder) · `scorecard.ts` (read-only eval scorecard) ·
  `gate-stats.ts` (approval-health gate).
- **Synthesis / emit / run:** `codegen.server.ts` (keyed P6 synthesis, chunked + bounded repair) ·
  `scaffold.ts` (the emitted-tree writer; E-15 emitter + kind entry wiring) ·
  `compile-check.server.ts` (per-file compile verdicts + dir tree-run) · `node-runner.server.ts`
  (bounded local code runner — NOT a sandbox) · `sandbox.ts` (banned-primitive denylist scan) ·
  `sandbox-policy.ts` (runner isolation-claim text) · `exec.ts` (client-facing bounded-runner
  contract) · `write-set.ts` (SSSF-style write-set rollback) · `patch.ts` (`str_replace`
  primitive) · `verify.server.ts` (machine verify-fix loop) · `verify.ts` (its client-safe seam) ·
  `maker-score.ts` (pure M1..M9 rubric) · `token-ledger.ts` (spend vs hard cap) · `compaction.ts`
  (compaction constants + summary template) · `checkpoint.server.ts` (versioned atomic run
  checkpoint — resume after a crash/kill, T-107.7) · `quarantine.ts` (the forced-emit quarantine-move
  seam — module + test landed; **CLI wire landed** (W42: `emit --force` moves survivors aside +
  reports `quarantined`/`quarantineDir`); the in-engine lift for every forced caller owed, R11-f08).
- **LLM / providers / research:** `llm.ts` + `llm-tasks.ts` (client-facing LLM contract +
  helpers) · `deepseek.server.ts` (thin re-export of the provider) · `tavily.server.ts` (Tavily
  search) · `websearch.server.ts` (keyless free web search) · `bounded-int.ts` (the one bounded-
  integer knob sanitizer shared by both search providers, W40 N4) · `research.ts` (client web-research
  contract) · `harvest.ts` (bounded live-source harvester) · `cassette.ts` (deterministic LLM
  record/replay) · `chat.ts` + `chat.server.ts` (copilot chat contract + grounded server core) ·
  `prompt-engine.ts` (hyper-prompt expansion + policy constraints).
- **Governance / learning / advisory:** `policy.ts` (the ONE approval seam, default-deny) ·
  `knowledge.ts` (cross-project pattern store) · `planning.ts` (plan-then-act scaffold) ·
  `subagent.ts` (bounded delegation contract) · `crew.ts` + `crew.server.ts` (multi-agent crew
  contract + orchestrator) · `swarm.ts` (advisory swarm layer) · `bench.ts` (synthetic dry-run
  estimates) · `ast-mine.ts` (structural codebase map) · `arch-tools.ts` (architecture surface) ·
  `algo-tools.ts` (algorithm workbench) · `vector.ts` (vector/logo generation) · `design.ts`
  (design tokens + preview HTML) · `diagram.ts` (standalone SVG diagrams) · `tracing.ts` (trace
  model) · `watchdog.ts` (wild-loop freeze decisions) · `diagnose.ts` (diagnosis builder) ·
  `doctor.ts` (environment/factory truth incl. `autonomousSoftwareFactory`) ·
  `wild-mode.server.ts` (wild auto-review supervisor classifier) · `wild-review.ts` (node-side wild
  supervisor completer seam, R14-f01).
- **Telemetry:** `rt-events.ts` (types) → `rt-ring.ts` (bounded ring) → `rt-client.ts` (browser
  glue) → `rt-timeline.ts` (NDJSON→timerows) · `runtime-log.server.ts` (NDJSON disk appender) ·
  `error-scan.server.ts` (error scan).
- **Plumbing / features:** `report-intake.ts` (external report validate/apply) · `handoff.ts`
  (per-phase handoff prompts) · `vault.ts` (Obsidian-style vault export) · `render.ts` (XSS-safe
  markdown blocks) · `templates.ts` (brief templates) · `brief-fixtures.ts` (fixture core) ·
  `fixtures.ts` + `fixtures.server.ts` + `fixtures.review.ts` (fixtures review data/server/client)
  · `git.server.ts` (git landing tail, W18) · `plugin.ts` (hook registry v1) ·
  `server-spec.ts` (the ONE runtime-assembled `*.server.*` specifier helper, A1-12) ·
  `algorithms.ts` (fusionRank/stemming/tokenizer) · `db.ts` (PGLite/Postgres bridge; applies
  migrations) · `error-component.tsx` (route error UI) · `preview-embedder-origin.ts` +
  `preview-host-bridge.ts` (preview postMessage trust model + guest side).

**32 subdirectory modules** (the flagged `auth/.hermes-tmp.*` stray temp is no longer tracked —
`git ls-files src/lib | grep -i tmp` is empty): `app-data/` (6: `index.ts` barrel, `server-only.ts` guard,
`client.server.ts` connector client, `errors.ts`, `login.ts`, `types.ts` — platform app-data
bridge) · `auth/` (17: `client.ts`, `server.ts` (self-hosted Better Auth), `gates.tsx`,
`middleware.ts`, `provider.tsx`, `providers.ts` (upstream IdPs), `email-password.ts`,
`gate-identity.server.ts` + `gate-session.server.ts` + `gate-session-marker.ts`,
`isolation.server.ts`, `pglite-dialect.ts`, `popup.server.ts`, `preview.ts`, `sign-in-gate.ts`,
`use-current-user.ts`, `verify.server.ts` — the whole sign-in/gate stack) · `llm/providers/`
(5: `registry.ts` — provider registry + role tiers; `deepseek.ts`; `openai-compatible.ts`;
`probe.ts`; `mock.ts` — deterministic zero-network mock) · `multiplayer/` (`index.ts`, `p2p.ts` —
WebRTC full-mesh room client; staged, no live coturn) · `og/site.json` (OG metadata) ·
`testing/fixtures.ts` (shared deterministic engine fixtures for tests).

**93 colocated test suites** (the "how it's verified" map — each test file pins its
subject-named contract; count today: `git ls-files src/lib | grep -c '\.test\.'` = 93 — 87 top-level + 6 subdir):
`algo-tools` · `algorithms` · `arch-tools` · `ast-mine` · `bench` · `bounded-int` · `brief-fixtures` ·
`cassette` · `chat` · `checkpoint.server` · `codegen.server` · `compaction` · `compile-check.server` ·
`crew` · `deepseek.server` ·
`design` · `determinism-guard` · `diagnose` · `diagram` · `doctor` · `emitted-honesty` ·
`error-scan.server` · `errors` · `exec` · `fixtures` · `gate-stats` · `gates` · `git.server` ·
`handoff` · `harvest` · `headless` · `honesty-guards` · `io` · `judgment` · `knowledge` ·
`lesson-writers` · `llm` · `llm-tasks` · `maker-score` · `node-runner.server` · `packet` · `patch`
· `patch-preservation` · `phases` · `planning` · `plugin` · `policy` · `policy-overlay` ·
`preview-host-bridge` · `prompt-engine` · `quarantine` · `render` · `report-intake` · `research` · `rt-client` ·
`rt-events` · `rt-ring` · `rt-timeline` · `runtime-log.server` · `sandbox` · `sandbox-policy` ·
`scaffold` · `scorecard` · `store` · `subagent` · `swarm` · `sweep73-fuzz` · `token-ledger` · `tracing` ·
`typed-failures` · `vault` · `vector` · `verify` · `verify.server` · `watchdog` · `websearch` ·
`wild-mode.server` · `wild-step` · `write-set` · `zero-byte-guard` (each `.test.ts`); subdir
suites: `app-data/app-data.test.ts`, `auth/gate-identity.test.ts`, `auth/sign-in-gate.test.ts`,
`llm/providers/mock.test.ts`, `llm/providers/registry.test.ts`,
`llm/providers/registry-failover.test.ts`. Note: a few modules are pinned
from sibling suites rather than a same-named file (e.g. there is **no** `engine.test.ts` — the
engine's contracts are pinned from `headless.test.ts`, `gates.test.ts`, `judgment.test.ts` and
others).

## 10.7 `scripts/` — CLI, gates, guards, tooling (46 tracked = 24 tools + 22 tests)

- **CLI:** `rapidtool-cli.mjs` — the headless driver, **39 verbs** (count source of truth:
  `grep -c 'case "'`), one JSON object per call, exit taxonomy 0/1/2/3/4.
  `README-cli.md` — its agent-facing machine contract (verbs, exits, `RT_E_*`, the `edit`/`emit`
  sections; doc-contract tested). `README-cli.test.mjs` — that doc-contract test: binds the
  README-cli headline count + verb list + USAGE parity + edit/emit sections to the dispatcher's
  bytes (do not edit either file without re-running it).
- **Gate:** `gate.sh` — the stability gate: typecheck → lint → assertion-gap lint → both test
  legs → build; one JSON verdict on stdout; `--double` = flake detector (exit 3).
- **Eval:** `run-eval.mjs` — the maker-loop eval driver (keyless deterministic floor; `--keyed`
  for real runs; grades corpus fixtures, writes `results.json` + `history.json` into `--out`
  (or `EVAL_OUT_DIR`); a bare run against the tracked `research/eval-out` is **refused with
  exit 2** unless you name it explicitly — W49 lane 336-4, corrected 2026-10-02).
- **DB:** `migrate.mjs` (deploy-time migrator, `pg`; runs inside `npm run build`) ·
  `migration-plan.mjs` (bookkeeping shared by migrate.mjs + `src/lib/db.ts`; pure).
- **Env/tooling:** `with-app-env.mjs` (merges `.grok/app-env.json` into npm script envs) ·
  `app-env-plugin.mjs` (dev-only `/__app-env` endpoint) · `write-atomic.mjs` (stage→rename file
  handover for agents) · `sign-out-plan.mjs` (pure sign-out sequence used by
  `auth/client.ts`) · `path-safety.mjs` (physical-containment helper R11-f07) ·
  `docs-module-parity.mjs` (advisory doc-vs-disk scanner — never a gate).
- **Preview/browser:** `preview.mjs` (owns :8081 built-output QA preview; restart/stop) ·
  `preview-thumbnail.mjs` (1280×800 preview PNG capture) · `browser-smoke.mjs` (Playwright smoke) ·
  `browser-smoke-verdict.mjs` (verdict normalization seam) · `browser-guard.mjs` (target checks
  shared by the capture scripts; loopback-only guard) · `brand-check.mjs` (brand-asset gate for
  canvas apps).
- **Platform PWA (legacy chrome):** `grok-pwa-plugin.mjs` (Vite half — `?install=1` tutorial +
  manifest) · `grok-pwa-shared.mjs` (shared head-chrome source) · `grok-pwa-shared.d.mts` (types)
  · `install-page.html` (the Home-Screen install tutorial page).
- **Guards:** `check-assertion-gaps.mjs` (T-17 tautology/zero-assertion lint, wired into
  gate.sh) · `check-auth-invariant.mjs` (dev-vs-build `VITE_AUTH_ENABLED` agreement: fail loudly).
- **Test suites (22):** `README-cli.test.mjs` (CLI doc-contract) · `rapidtool-cli-edit.test.mjs` +
  `rapidtool-cli-lesson.test.mjs` (verb contracts) · `rapidtool-cli-fixtures.test.mjs` (fixtures
  verb contract) · `cli-exit-taxonomy.test.mjs` (exit-code class guard, OPS-3) ·
  `cli-run-busy.test.mjs` (busy-flag exits + the crew `--max-steps` key leg, H7/317) ·
  `gate-verdict.test.mjs` (a red leg can never produce a green verdict) · `chat-stream.test.mjs`
  (chat streaming) · `next-action-arm-parity.test.mjs` (next-action ↔ dispatcher parity) ·
  `test-name-pattern-guard.test.mjs` (the `--test-name-pattern` no-op trap) ·
  `run-eval.test.mjs` · `migration-plan.test.mjs` · `brand-check.test.mjs` ·
  `browser-guard.test.mjs` · `browser-smoke-verdict.test.mjs` · `check-assertion-gaps.test.mjs` ·
  `check-auth-invariant.test.mjs` · `grok-pwa-plugin.test.mjs` · `preview.test.mjs` ·
  `sign-out-plan.test.mjs` · `with-app-env.test.mjs` · `write-atomic.test.mjs`.

## 10.8 `research/` (476)

- **`research/multiagent/` (103)** — the analysis program. The register/ledger trio:
  `thoroughanalysis.md` (**the finding register** — mission preamble + append-only protocol;
  read it before writing), `thoroughaction.md` (live action ledger of the W25 watchdogs),
  `vault-notes-sample.md` (sample vault output). The dossier sets, newest goals first:
  **factory upgrade (100–112)** — `100_factory_blockers`, `101_provider_integration`,
  `102_code_quality_signals`, `103_feature_gaps`, `104_factory_upgrade_plan` (the master plan),
  `105_plan_critique`, `106_rapidtool_deep_analysis`, `107_competitors_agentic`,
  `108_competitors_app_generators`, `109_bughunt_core`, `110_ui_audit_vs_competitors`,
  `111_ui_design_research`, `112_code_judgment_and_learning`; **overhaul/audit era (219–263)** —
  `219a…219f` (inventory→reality→defects→autonomy blockers→self-improvement→competitor codebases),
  `220_overhaul_plan` + `220_tasklist_canonical` + `220_external_verification`, `221_feature_designs`,
  `222_codebase_integration_map`, `223_critical_path_premortem`,
  `224_advantage_gap_and_plan_audit`, `225_field_failures_forensics`,
  `226_shortcomings_and_plan_stress`, `227_plan_gaps_adversarial`,
  `229_steering_and_goal_alignment`, `230_task_execution_playbook`, `232_plan_improvements`,
  `234_engineering_depth_audit`, `235_execution_readiness_audit`, `240_missing_tasks_audit`,
  `241_weak_verification_strengthenings`, `249_define_first_specs`,
  `262_agents_md_proposal` (the unlanded AGENTS.md doctrine patch), `263_state_of_play`;
  **competitor/type studies (86–99)** — `86_kanban_analysis`, `87_renamepro_analysis`,
  `88_statkit_analysis`, `89_self_learning_research`, `90_LEAPFROG`, `91`/`92_software_types`,
  `93_design_flaws` (DF ledger), `94_readiness_plan`, `95_leapfrog_continuation`,
  `96_engineering_completion`, `97`/`99_coffeehouse2home*` (the mission app),
  `98_make_1…98_make_5` + `98_readiness_exec`, `99_engineering_exec`; **early waves (01–43)** —
  the origin dossiers (`01_open_source_harnesses`, `02_capability_audit`, `03_crew_design`,
  `04_verification_design`, `05_guide_research`, `05_live_guidance`, `06_competitor_survey`,
  `07_opensource_steal_catalog`, `08_enhancement_register`, `09_agent_perfection_audit`,
  `10_production_readiness`, `11_agency_plan`, `11_live_fixes`, `13_top20_gaps`,
  `14_agi_aggregation`, `15_feasibility_review`, `16_utility_review`, `17_agent_ux_review`,
  `18_chat_ux_research`, `19_chat_integration_plan`, `20_wave3_verification`,
  `21_plain_english_guide`, `23_debug_lead`…`34_cli_anchors` (the debug/hunt series),
  `37_production_proof`…`43_hunt_pipeline_memory`). Full list: `git ls-files research/multiagent | sort`.
- **`research/eval-corpus/` (23)** — the acceptance corpus: `README.md` (contract) + **11 brief
  fixtures** (`arcade-breakout.md`, `coffeehouse2home-property-ledger.md`, `date-rrule-library.md`,
  `field-ops-suite.md`, `house-flip-manager.md`, `invoice-csv-cli.md`, `order-webhook-service.md`,
  `permit-inspection-tracker.md`, `real-estate-crm.md`, `rental-portfolio.md`,
  `showing-booking.md`) + **11 frozen graders** (`graders/<slug>.grader.json`).
- **`research/eval-out/` (345)** — tracked trial outputs. Top level: `results.json` (the
  acceptance scorecard — last written 2026-09-25 in keyed mode), `history.json` (run history),
  `run-in-progress.json`, `_keyed-launcher.sh` (the keyed-run launcher). The other 341 files are
  19 emitted trees — 6 corpus slugs × {base, `--trial-1`, `--trial-2`} plus
  `coffeehouse2home-property-ledger.run-2026-09-10` (the `{0,5,0}` vintage) — each tree carrying
  the emitted scaffold's standard set: `package.json`, `tsconfig.json`, `vite.config.ts`,
  `index.html`, `README.md`, `DEPLOY.md`, `.env.example`, `.rapidtool/project.json`, `src/**`,
  `tests/oracle.spec.ts`. (`permit-inspection-tracker` has a brief + grader but no tracked trial
  output yet.)
- **Research top level (5):** `01_parallel_repos_research.md`, `02_industry_sdlc_grading_research.md`,
  `03_tech_deep_dives_research.md` (the origin research set, 2026-09-04) · `deepseek-api.md`
  (live-verified API spec) · `runtime-integration.md` (runtime/hosting research).

## 10.9 `fixes/` — the append-only landing-log ledger (587 tracked)

**Convention:** one `fixes/NN_<lane>.md` per lane per wave; append-only; each log carries
what/why + `file:line` evidence + before/after. The numbering is chronological: the newest number
is the current wave. Tracked today: the `01`–`99` early series, the **`216a`–`216t` Wave-4/5 set**
(incl. `216j_honesty_tooling.md`, `216n_wave_h_primitives.md`, `216s_cli_wave.md`), the
`100`–`270` era (233 three-digit logs; **`218_*` §5 = the W12 boundary gate of record**), and
`pro1`–`pro4_*.md`. The **W29–W41 set (`271`–`294`)** is tracked too: `271_lane*`, `272_s1…s5`
shell lanes, `273_t1…t5`, `274_wdx1/wdx2/wdx3` watchdogs, `275_organizer`, `276`–`283` completion
lanes + `283_final_ledger.md`, `284_wiring_guarantee`, `285_g2…g4`, `286_readme_catalog.md`,
`287_z5_runtime_tail.md`, `288`–`289` pickups, `290`–`294` per-lane wave-41 logs; the `295`–`304`
tail set (wave-41/42 logs + probes + the eng-review pair + the C/D-wave lane logs) is tracked too —
the `305_*` round-3 lane logs arrive untracked from the live W42 tail).
**How to search them:** `git ls-files fixes | sort | tail -30` (newest); `grep -l "<term>"
fixes/*.md`; or grep the register's fix references (`R*`/`A*` IDs cite their fix logs).

## 10.10 `wave_plans/` — dispatch plans (108 tracked; W4–W24 · W26–W38 · W40 · W42 · W43)

**Convention:** `wave_plans/README.md` owns it — every wave dispatch ships ONE notes file per lane
(`wave_plans/W<N>/lane-<K>.md` or a named lane doc), ordered for speed: mission → owned files →
numbered mini-task plan → parent findings/traps → verification commands → logging rules. Tracked
waves: **W4–W24 + W26–W38 + W40 + W42 + W43** (108 files incl. `README.md`; W4–W10 five lane files each, W11 7,
W12 8, **W13 25** (its audit/design/eng/guard/improver/playbook/wd/x lanes), W14 3, W15 2, W16–W28
one file each; then the former working-tree set, now tracked): `W29/coders.md`,
`W30/shell-sprint.md`, `W31/gap-finshers.md`, `W32/organizer.md`, `W33/unlanded-block.md`,
`W34/{prep,code-notes}.md`, `W35/factory-notes.md`, `W36/completion.md`, `W37/master-pack.md`,
`W38/NEW-SESSION-PROMPT.md` · `W42/SPEC.md` · `W43/COMPLETION-TASKS.md`.

## 10.11 `builds/` · `vault-e2e/` · `screenshots/`

- **`builds/` (50)** — legacy sample build outputs: `recipe-box.json` (a sample project file for
  the "recipe box" brief — its first 103 keys are a character-indexed dump of the brief string, an
  early-serializer artifact, followed by the normal project fields), `recipe-box.svg` (its phase
  pipeline diagram), and `vault.md/` — **48 markdown notes** (a full vault export: index, P0–P12
  notes, gate-decision notes, ADR/context notes). Note: several vault filenames contain `·`/`–`
  (unicode) and spaces — quote paths in every command.
- **`vault-e2e/` (47)** — the same vault shape, exported for the **"HVAC Dispatch"** E2E project
  (`HVAC Dispatch · Vault Index.md` + P0–P12 + gate notes). All `.md`; unicode filenames as above.
- **`screenshots/` (16)** — QA capture set: `app-builder-built.png` + `-mobile` + `.json` and
  `app-builder-preview.png` + `-mobile` + `.json` (builder screens + capture metadata),
  `clinic-p4.png`, `console-algos.png`, `console-run.png`, `crew.png`, `crew-active.png`,
  `oracle.png`, `packet.png`, `sandbox-pass.png`, `spec.png`, plus `.gitkeep`.

## 10.12 audits, proposals, legacy, misc

- `audit/` (3): `01_core_engine_algorithms_audit.md`, `02_ui_console_multiplayer_audit.md`,
  `03_auth_appdata_platform_audit.md` — the 2026-09-04-era module audits.
- `audit-bugs/` (5): `01_core.md`, `02_ui_store.md`, `03_server_hosting.md`,
  `04_scripts_integration.md`, `05_multiagent.md` — per-area bug lists.
- `review/` (3): `01_deep_audit_current.md`, `02_purpose_walkdown_gap.md`,
  `03_competitor_usefulness_agentinputs.md` — deep-review records.
- `proposals/` (3): `01_ux_product_enhancements.md` (E-101…E-118), `02_algo_engine_repairs.md`,
  `03_arch_quality_enhancements.md` — evidence-cited enhancement candidates.
- `attachments/RapidTool_Complete_Master.md` — a historical persona/prompt artifact; its banner
  says do NOT load it as this product's behavior (it asserts capabilities RapidTool lacks).
- `artifacts/imagine_images/a825da57-…jpg` — one stored image artifact from an early
  image-generation experiment.
- `.audit-g2/probe.mjs` — the G2 auditor's probe (deterministic refused-P6 journey + lesson
  read-back, keyless).
- **`.grok/` (89) — legacy platform chrome; per `AGENTS.md` do not build on it:** `app-env.json`
  (shipped `VITE_AUTH_ENABLED: "false"` + deploy block), `status` (workspace-server READY JSON),
  `references/` (6 integration references: `browser-qa.md`, `data-and-auth.md`,
  `deploy-target.md`, `generated-art.md`, `hibernate-revive.md`, `scaffold.md`), `skills/`
  (18 skill packs: `auth`, `building-games`, `controls`, `design-ui`, `game-animation-frames`,
  `game-asset-core`, `game-character-consistency`, `game-tilesets`, `game-ui-icons`,
  `generate2dmap`, `generate2dsprite`, `imagine`, `multiplayer-p2p`, `neon`, `og`, `threejs`,
  `video2dsprite`, `xai-api` — each a `SKILL.md` + references (+ 5 `.py` helper scripts under
  `generate2dmap`/`generate2dsprite`/`video2dsprite`)). Keep-or-descope is decided in
  `research/multiagent/94` §B1 / `96`; do not delete or extend until that lands.

## 10.13 Working-tree state — the former "not yet tracked" set (superseded 2026-09-27)

The W29–W41 era was committed at HEAD `ac6b151` and the formerly-untracked set is now **tracked**:
the docs (`START-HERE.md`, `finalsprint.md`, `docs-FOLDER-MAP.md`, `tsconfig.scripts.json`,
`.prettierignore`), the `src/lib/` set (`checkpoint.server.ts` + test, `quarantine.ts` + test,
`wild-review.ts`, `llm/providers/registry-failover.test.ts`), the scripts guards
(`cli-exit-taxonomy.test.mjs`, `gate-verdict.test.mjs`, `rapidtool-cli-fixtures.test.mjs`,
`path-safety.mjs`, `docs-module-parity.mjs`), `migrations/auth/0002_account_unique.sql`,
`wave_plans/W29…W38/*`, `fixes/271…286` (50 logs) and `.t4scratch/` (192 — it has its own §10.1 row
now). Gitignored and never printed: `.env` (secrets), `.env.bak-*`, `_*.log` scratch captures
(kept on purpose — `docs-FOLDER-MAP.md`), `.hermes/`.

---

## Docs index

| Doc | Purpose |
|---|---|
| `README.md` | This file — quickstart + honest state + **the full tracked-file catalog** (§10). |
| `START-HERE.md` | Cold-start map + verified run commands + hard rules. |
| `RESUME.md` | Session handoff: gates contract, hard rules, settled decisions. |
| `AGENTS.md` | Agent contract: mandatory reads, working rules, honesty contract. |
| `AGENT_GUIDE.md` | How an agent consumes a RapidTool project (product-level). |
| `remainingwaves.md` | **Every remaining wave** with tasks/files/estimates/bugs/tests. |
| `taskuniverselog.md` | Live task board (status of every task from every dossier). |
| `finalsprint.md` | W30 shell-sprint master table (what's REAL vs shelled) + lane polls. |
| `docs-FOLDER-MAP.md` | Depth-2 folder map, one line per node. |
| `research/multiagent/thoroughanalysis.md` | **The register** — mission preamble + all findings (read the protocol first). |
| `research/multiagent/94_readiness_plan.md` · `93_design_flaws.md` · `90_LEAPFROG.md` · `96_engineering_completion.md` | The plan/defects/strategy/scorecard set `AGENTS.md` sends feature work through. |
| `research/multiagent/104_factory_upgrade_plan.md` | The factory-upgrade master plan (`RESUME.md` indexes it). |
| `scripts/README-cli.md` | CLI verb reference + exit taxonomy + `RT_E_*` (doc-contract tested). |
| `packet-e2e.md` · `design-e2e.html` · `*-e2e.svg` | Sample outputs (packet / design system / diagrams). |
| `fixes/` | Append-only landing logs (newest number = current wave). |
| `wave_plans/` | Per-lane dispatch plans (convention in `wave_plans/README.md`). |

## License

MIT (see `LICENSE`).
