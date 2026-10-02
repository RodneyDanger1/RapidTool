# 335 wave (W49) — parent / boundary record

**Boundary owner:** parent. **Opened** 2026-10-02 at HEAD `9cff073`, tree clean. **Six lanes + a guardian
watchdog.** Contract: `wave_plans/W49/README.md`; guardrails published by the guardian:
`wave_plans/W49/GUARDRAILS.md`; guardian's record: `fixes/335_7_guardian.md`. Lane logs:
`fixes/335_1…335_6_*.md`.

## 1. The guardian's verdict — no destruction, no work lost

**No destruction observed.** Across 15 monitor checks over ~43 minutes: zero tracked files deleted, zero
do-not-touch paths changed, `git stash list` empty at every check, and the reflog recorded no
`reset`/`rebase`/`checkout`/`stash`/`branch`/`merge`/`revert`. HEAD stayed `9cff073` throughout and no
lane's uncommitted work was dropped. No rescue was needed or executed.

Its baseline was a manifest of **2022 tracked files** (path + index blob hash + working-tree size,
34,278,529 bytes) with a **419-path do-not-touch list**, kept outside the repo. Its end audit found:
**all 27 changed files inside an owning lane's set**; **no deletions**; **no mass rewrites** (the largest
proportional edit is 10% of a file); every lane's falsifiable claim present on disk **and every reported
test delta matching exactly**, counted independently at HEAD vs the working tree; the new in-repo files
being only the seven logs, the guardrails, and one UI test. Targeted `tsc --noEmit`, `npm run typecheck`
(both legs) and `npm run lint` were clean under its own hand.

Two divergences it recorded, neither hiding a defect: lane 335-6's log says `GUARDRAILS.md` was absent
(the bytes show it present from 16:14:20, before that log line) — **the bytes win; recorded here as the
correction** rather than rewriting an append-only log; and two lanes saw a transient `TS7006` in 335-5's
brand-new test, which 335-5 fixed within the wave (the final tree is clean — see §3).

## 2. Boundary gates (after every writer stopped)

| Gate | Result |
|---|---|
| typecheck | **exit 0** (both legs; `scripts` ratchet 6/6, `ERROR_BUDGET` still `{}`) |
| lint | **exit 0**, 0 warnings |
| assertions | **exit 0** |
| tests | **scripts 408 / lib 2797 / 0 fail / 2 skipped**, exit 0 |
| build | **exit 0** |
| `gate.sh` | **`ok:true`, exit 0**, `flakes: []`, `hardFails: []` |

Baseline at wave open: 405 scripts + 2771 lib → **+29 tests, all green**.

## 3. What each lane found and fixed

**335-1 Prompter — the pipeline's later phases are real.** It settled the register's long-standing
"P7–P12 often produce no artifacts" claim with a **driven run reaching P12 complete (13/13)**: every tail
phase has a writer and writes its artifact (P7 research matrix, P8 ui contract, P9 cicd ×2, P10 edge,
P11 tools, P12 docs ×2 + `project.adr`/`project.openapi`). The "no artifacts" signature was a run **stopped
at a red P6**, which the `phaseCoverage` census now states explicitly rather than silently. It also fixed a
real synthesis gap (**the async guard missed the optional-call tail** — `getProperty?.(id).ok` and its
bound/destructure/`this` forms were accepted where `.ok` is refused), scoped a system-prompt rule that
over-claimed enforcement the validator lacks, **named three phase-table deliverables with no producer**
(P8 component code, P9 GPU scripts, P12 DB schemas/parity) as honest gaps instead of promises, and added
elision markers where `prompt-engine.ts` promised "a silent slice would hide evidence" but dropped the
13th policy / 11th lesson silently. `codegen.server.test.ts` 170 → **172**, `phases.test.ts` 10 → **13**.

**335-2 Ledger — a real loss bug.** `saveProject` wrote a project record unbounded, but `loadProject` →
`importProject` refused anything over the 5 MB hostile-paste cap — **a record the tool wrote was unreadable
by its own reader** (reproduced at 5,020,499 chars). Fixed minimally: `importProject` gained
`opts.maxChars` (default unchanged) and `loadProject` passes `Infinity`, its `readFileSync` having already
bounded memory. It also proved **all 13 phases advance and record** through `runUntilGate` (each enters,
records `phase.enter`+`algo.run`, and on completion a gate artifact + verdict), proved the record round-trip
is lossless and byte-identical for the fields recent waves added (`tokenUsage`, `lastKeyedOutcome`) and
that a legacy record still loads with them **absent, never fabricated**, and reported the atomic write's
missing `fsync` as an honest limit it deliberately did not change (unobservable ⇒ against the RED-first
rule). `headless.test.ts` 134 → **138**, `io.test.ts` 60 → **61**.

**335-3 Transit — the agent's own instructions were incomplete.** The **Agent Packet** — the factory's
agent-facing deliverable — was missing the current edge's **DoD exit criteria**: it gave an agent the rules
and the output schema but never the definition of "done" for the phase it was told to work. Now rendered
(`## Exit criteria (DoD)` with the machine-checked gate). It also corrected `report_schema`, which claimed
to be the "exact shape" while omitting three real seam rules (phase must equal `current_phase.id`; at most
12 artifacts; each body ≤ 50,000 chars), fixed a scorecard fallback that instructed an out-of-scope phase
("run Phase 0 first" at P4), made a red kind entry set `outcome.error` (it was `null` while the tail named
the failure), and closed a **false green** where a `cli-tool` tree declared no `main` so corrupting the
declared entry still read clean. `packet.test.ts` 66 → **69**, `handoff` 15 → **16**, `scaffold` 50 → **51**,
`compile-check` 79 → **81**.

**335-4 Switchboard — an agent driving blind could not ask for help.** `--help` did not exist: a help
request was a **coded failure** (exit 1, `RT_E_VALIDATION`). Now `--help`/`-h`/`help` return exit 0 with the
usage envelope, and `--help <verb>` narrows to that verb. Remedies were engine-voiced and non-actionable
("Reject the payload…") — the CLI's own guard grammar now translates to `Re-run with --brief: `create
--brief <value>``. Five documented numeric flags silently ignored non-numeric values (`search --limit abc`
exited 0); they now refuse coded. It also settled the `emit --run` exit collision by making the strict
signal **opt-in** (`--require-verified` → exit 5) so a green fresh tree exits 0 again while the envelope
keeps `unverified:true` and the note. A machine flag/verb audit found 39 verbs 1:1 with 39 arms and no
phantom flags. `cli-exit-taxonomy.test.mjs` 31 → **34**.

**335-5 Chrome — two real layout bugs and a11y gaps.** A brief with no whitespace makes `inferName`
return a ~400-character name; the console did not clamp it, so the page laid out at **`scrollWidth 2404`
on the run screen and 2562 on Home** at a 1440px viewport. Both are now clamped (2404/2562 → 1440) with
the full name in `title`, proved in the browser. It also added the missing **`<main>` landmark** on the run
screen, a **"Skip to main content"** first-stop keyboard link, fixed **four `aria-label`s that were silently
dropped** because they sat on generic-role elements, removed **three visible `TODO(...)` engineering
markers that were leaking to the operator** (the honest limitation sentences stay; ids move to `title`),
and fixed dialog wrapping for long names. A contrast scan found 0 sub-AA pairings across 16
surface×theme combinations. New `src/lib/ui-surface-guards.test.ts` (7 pins; RED 2/5 → GREEN 7/7 — see
§5). Owned suites 123 → **130**.

**335-6 Warden — two real algorithm defects.** Audited 14 pure logic modules by reading and probing them,
with a verdict per module: two genuine defects found and fixed — `bench.ts` counted `?.` as a ternary
(`a?.b?.c?.d` inflated the count to 3), and `ast-mine.ts` dropped export aliases
(`export { local as public }` returned the local name). It reported two residuals it deliberately did not
change, with reasons: a dead branch in `vector.ts:704` (no falsifiable test) and a `while`-method false
loop in `algo-tools.ts:929` (a fix needs class-scope tracking and risks over-refusal). The remaining
modules are **SOUND**, each with the probe that shows it — including `algorithms.ts`, whose lattice/oracle
invariants it verified across 7 briefs × 7 domains. `bench.test.ts` 23 → **24**, `ast-mine.test.ts` 9 → **10**.

## 4. Boundary-owner work

1. **Surfaced the run's coded refusal to the CLI envelope** (`scripts/rapidtool-cli.mjs`,
   `respondDriveOutcome`) — the guardian's open STOP item. `RunResult.code` names the newest P6 synthesis
   refusal an invocation recorded (a keyed 401 → `RT_E_LLM_KEY_REJECTED`) while the run still advanced on
   the deterministic floor; the drive envelope now carries it as **`refusalCode`**, deliberately not `code`
   (which the taxonomy reserves for a failed command), so an agent cannot mistake `ok:true` for a failure.
   Additive and conditional, documented in `README-cli.md` §"Driving to completion".
2. **Blessed `src/lib/ui-surface-guards.test.ts`** as lane 335-5's file. It is a UI test placed in
   `src/lib/` because that is the only glob `package.json` discovers; it imports nothing from `src/lib`, so
   module coverage is unaffected. Relocating it would break test discovery, so the placement stands.
3. **Recorded the guardian's two divergences** in §1 rather than rewriting an append-only lane log.

## 5. Still open (with owners)

1. **P8/P9/P12 producer gaps** — the phase table named three deliverables with no producer (component code
   with a live key, GPU allocation scripts, DB schemas + frontend/backend parity). The P12 DB schema is
   derivable from `project.contracts.entities`, but the producer lives in the **unowned** `engine.ts` /
   `scaffold.ts`. Owner: the next wave that takes an engine grant.
2. **Two algorithm residuals** — `src/lib/vector.ts:704` (unreachable branch), `src/lib/algo-tools.ts:929`
   (`while` used as a method name counted as a loop). Owner: 335-6 next pass.
3. **Atomic-write `fsync`** — the temp file is not fsync'd, so a power loss (not a process kill) could lose
   the newest bytes. Owner: someone who can observe it (no test can).
4. **`npm run eval` still not run** — it rewrites tracked `research/eval-out/**`.
5. **`R11-f01`** — the dev server binds `0.0.0.0` with no auth middleware; a documented host/port contract,
   so it is the product owner's decision.
6. **The stale User-scope `DEEPSEEK_API_KEY`** on this machine; the repo wins over it and prints the coded
   signal. Owner: the machine owner.
7. **UI proposals lane 335-5 did not land** (recorded in its log §5): mobile header density (about ten chrome
   rows before content; a status popover would reclaim ~40% of the first screen), moving ticket-id suffixes
   out of visible labels, a global skip link in `__root.tsx` (the 404 screen's `<main>` lives in the unowned
   `error-component.tsx`, so a global target would dangle), and a state-aware `<title>` for `/run/<bad-id>`.
8. **The owner's two standing proposals from the 334 wave remain** — deleting `.t4scratch/` (192 tracked
   duplicates) and the three dead modules (`db.ts`, `app-data/index.ts`, `multiplayer/index.ts`).
