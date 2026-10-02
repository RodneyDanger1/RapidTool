# W49 (the 335 wave) — six lanes + a guardian watchog

**Opened:** 2026-10-02. **HEAD at open:** `9cff073`, tree clean.
Predecessors: 331 (W45), 332 (W46), 333 audit (W47), 334 (W48).
**Baseline gates:** typecheck 0 (both legs; `scripts/**` debt fully retired, `ERROR_BUDGET = {}`) · lint 0
warnings · assertion-gaps 0 · **405 scripts + 2771 lib tests / 0 fail / 2 skipped** · build 0 ·
`gate.sh ok:true`. Node 22.23.2 at `%LOCALAPPDATA%\hermes\node\node.exe`; host Node **v24.15.0**.
Always pass `--test-reporter=tap` when parsing `node --test` output. For `gate.sh` use
`& "C:\Program Files\Git\bin\bash.exe"` (bash on PATH is the WSL stub).

## What the owner asked for this wave (read twice)

1. **Find bugs/issues and fix them** — with the best professional engineering judgement, not the
   smallest diff.
2. **Fix and polish the UI** so nothing is missing and it looks professional and is **easy to use for AI
   agents and humans alike**.
3. **Every pipeline piece wired and fully functional**; no broken or poorly written algorithms.
4. **Use patches** where a patch is the right instrument.
5. **A 7th watchdog** to guide the lanes, track progress, and **prevent the obliteration of good code and
   loss of work**.

## Step 0 — every lane does this FIRST

Read your own lane logs from the previous four passes (`fixes/331_<n>_*`, `fixes/332_<n>_*`), whatever the
333/334 audits said about your files (`fixes/333_1_verifier.md`, `fixes/333_2_registrar.md`,
`fixes/334_0_parent.md`), and your owned files on disk. Open your log with **claimed / on disk / still
open** (`file:line` for the last), then work.

## Ownership (STRICT) and the do-not-touch register

| Lane | Persona | Owned files |
|---|---|---|
| 335-1 | **Prompter** — synthesis + the phase pipeline | `src/lib/codegen.server.ts`, `src/lib/phases.ts`, `src/lib/prompt-engine.ts` + their tests |
| 335-2 | **Ledger** — journey driver + state integrity | `src/lib/headless.ts`, `src/lib/doctor.ts`, `src/lib/token-ledger.ts`, `src/lib/io.ts` + their tests |
| 335-3 | **Transit** — emitted product + the agent-facing packet | `src/lib/scaffold.ts`, `src/lib/compile-check.server.ts`, `src/lib/dod.ts`, `src/lib/packet.ts`, `src/lib/handoff.ts` + their tests |
| 335-4 | **Switchboard** — CLI + toolchain, agent-facing UX | `scripts/**` (all of it), `tsconfig*.json`, `package.json` |
| 335-5 | **Chrome** — UI polish, a11y, honesty | `src/components/**`, `src/routes/**`, `src/lib/fixtures*.ts`, `src/lib/store.ts`, `src/lib/llm.ts` + tests |
| 335-6 | **Warden** — algorithms quality + guards | `src/lib/algorithms.ts`, `algo-tools.ts`, `arch-tools.ts`, `ast-mine.ts`, `entry-oracle.ts`, `iterate.ts`, `judgment.ts`, `planning.ts`, `maker-score.ts`, `vector.ts`, `swarm.ts`, `design.ts`, `diagram.ts`, `bench.ts` + their tests; plus `scripts/check-*.mjs` + tests |

**Do-not-touch register (the guardian enforces it):**
- `src/lib/engine.ts`, `src/lib/types.ts`, `src/lib/errors.ts`, `src/lib/knowledge.ts`,
  `src/lib/harvest.ts`, `src/lib/verify.server.ts`, `src/lib/verify.ts`, `src/lib/node-runner.server.ts`,
  `src/lib/rt-*.ts`, `src/lib/watchdog.ts`, `src/lib/diagnose.ts` — **unowned**; request a change in your
  log with the exact shape and the parent lands it at the boundary.
- `fixes/**` — **append-only**. Never rewrite another lane's log; never rewrite your own (append).
- `research/eval-out/**`, `research/multiagent/thoroughanalysis.md` body, `migrations/**`,
  `research/eval-corpus/**` — **frozen**.
- `fixes/331_*` … `fixes/334_*` — frozen history.
- Any file you do not own: **STOP-and-REPORT**.

## Hard rules

1. **Patch discipline.** Prefer a minimal, targeted patch. Never rewrite a whole file to change a few
   lines; never reformat a file you are not otherwise changing; never "clean up" code you were not asked
   about — that is exactly the obliteration the guardian exists to catch. Re-read a file before patching it.
2. **No fabrication.** Evidence is a command's real output or bytes read today. A skip is never a pass. A
   UI claim needs a browser observation; an algorithm claim needs a test or a probe.
3. **RED-first.** Every fix ships a test that fails before it and passes after — show both. Where a test
   is impossible (UI layout), show the before/after artifact and say what is not covered.
4. **No full gate while siblings are mid-edit.** Targeted suites only. The **parent** runs typecheck, lint,
   both test legs, build and `gate.sh` at the boundary.
5. **No keyed calls in a loop.** At most one bounded keyed call per lane, with its measured usage reported.
   **Never run `npm run eval`.**
6. **Never print a secret.** Diagnose keys by last-4 tail only.
7. **Append-only logs** at `fixes/335_<n>_<persona>.md`: reconciliation, per-fix before/after, tests added
   with real results on **both** runtimes, then what you did NOT do and why.
8. **Scratch outside the repo** (`%TEMP%\rt335_<lane>\…`). The repo gains no probe file.
9. **Checkpoint before you refactor.** If a change touches more than a couple of hunks, write your
   intended patch into your log first, so a lost process costs minutes, not the work.
10. **The guardian may ask you to justify a large diff.** Answer in your log with the reason and the
    evidence. It is not a blocker; it is a second pair of eyes on irreversibility.

## Lane missions (detailed)

### 335-1 Prompter — is every pipeline phase real?
The register's old finding stands unverified: **P7–P12 often produce no artifacts.** Take the phase table
(`phases.ts`) and the P6–P12 synthesis path and answer with evidence, for **each** of P7, P8, P9, P10, P11,
P12: what artifact does it produce, who writes it, and does a real run show it on disk? Where a phase
produces nothing, decide honestly: implement it (if the brief/spec carries the input it needs) or make the
emptiness an explicit, reasoned `gaps` entry — never a silent nothing. Then: the P6 residuals
(`p6SynthesisSystemPrompt` rules, the async guard's documented limits, chunk planning bounds) and any
sweep you find. Proven shape to reproduce: the keyed run in `fixes/332_0_parent.md` §4.

### 335-2 Ledger — the journey driver and state integrity
(a) **Every phase of the journey actually advances and records** through `headless.ts` — prove it for a
driven run (13 phases, or the honest park reasons), and fix any phase that silently no-ops. (b) **No work
is lost:** `io.ts`'s save/load round-trip, the atomic-write path, and the project-record migration must be
lossless and crash-safe; prove the round-trip for a real project record including the fields the recent
waves added (`tokenUsage`, `lastKeyedOutcome`) and prove that a record lacking them still loads. (c) The
spend/doctor truth and `RunResult.code` residuals.

### 335-3 Transit — the emitted product and the **agent packet**
(a) The tree-run/DoD residuals (`verified` semantics, the mint evidence hash, the unverified banner — all
landed; verify and fix what remains). (b) **The Agent Packet is the factory's agent-facing deliverable**:
audit `packet.ts` + `handoff.ts` for completeness, correctness and usability by an AI agent — every field
the packet promises must be present and true, the instructions must be actionable, nothing stale, no claim
the bytes do not support. Fix what is missing or misleading, with a probe of the real packet body.

### 335-4 Switchboard — CLI + toolchain, agent-facing UX
(a) Any remaining errors (the scripts typecheck is at 0; keep it at 0). (b) **Agent-facing usability**: the
USAGE text, `--help` behaviour, JSON envelopes, and remedies must be correct and immediately actionable for
an agent driving RapidTool blind; every documented verb/flag must exist and behave as documented, and the
exit taxonomy must match the bytes. (c) The `emit --run` exit-5 decision from `fixes/334_0_parent.md` §5.1
— if the default is wrong for operators, land the opt-in strict flag with docs and tests.

### 335-5 Chrome — polish the UI for humans and agents
This is the owner's headline ask. Audit **every** surface — `console.tsx`, `routes/**`,
`pipeline-rail.tsx`, `runtime-timeline-pane.tsx`, `cmd-palette.tsx` — for: missing states (empty, loading,
error, long-content), unclear labels, inconsistent spacing/typography/colour against the repo's design
tokens, unreachable actions, missing keyboard affordances, a11y gaps (focus, roles, aria, contrast),
mobile layout, and anything that reads as unfinished. Land the polish that is real, with browser proof on
desktop **and** mobile; keep the honesty rules (no label may promise more than it measures). Do not
"restyle the world": propose large changes in your log and land the targeted ones. **Zero non-null
assertions in `console.tsx`** stays true.

### 335-6 Warden — are the algorithms broken or poorly written?
Audit the pure algorithm/logic modules for **correctness first, quality second**: `algorithms.ts` (the
intent lattice, oracles, phase math), `algo-tools.ts`, `arch-tools.ts`, `ast-mine.ts`, `entry-oracle.ts`,
`iterate.ts`, `judgment.ts`, `planning.ts`, `maker-score.ts`, `vector.ts`, `swarm.ts`, `design.ts`,
`diagram.ts`, `bench.ts`. For each: read the real code, probe the real behaviour, and report/fix genuine
defects — off-by-one, wrong complexity, unstable ordering, a hash that ignores an input, a clamp that
clips, an assertion that cannot fail, dead branches, duplicated logic that has drifted. Add tests for
every fix. Also keep the guard suites green and extend a guard only if it has genuine teeth.

## 335-7 Guardian — the watchdog (see `wave_plans/W49/watchdog-7-guardian.md`)

Its charter: publish the guardrails, monitor the working tree for destruction during the wave, track each
lane's progress against its brief, and audit the wave at the end. It is **read-only on code** except for a
narrow rescue power described in its brief.
