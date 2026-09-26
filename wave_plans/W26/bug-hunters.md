# W26 · 4 CODE BUG HUNTERS — comb the repo, CONFIRM each bug, FIX on sight, record everything

**All readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep
FAILS; `grep`). Owner instruction: *there are TONS — simple-to-stupid crash errors, work-prevention errors,
handoff/delegation/agent-action errors. Fix them on sight after analyzing/confirming they are bugs.*

```text
HARD RULES (every hunter)
- CONFIRM BEFORE FIXING: a suspicion is not a bug. Prove it: a failing targeted foreground run, a real
  command's output, or a byte-level read that shows the impossibility (e.g. a var used before init, an
  import that cannot resolve, a guard that can never fire). Then fix. NEVER "fix" unconfirmed behavior.
- SMALLEST HONEST PATCH, RED→GREEN where a check exists (write the failing pin first if none exists).
- ONE BUG = ONE ENTRY in your log (`fixes/266_lane<N>_bugs.md`): ID (B<N>-fNN) · file:line (read today) ·
  the PROOF (command + exact output, or the byte fact) · the fix (before→after) · re-check result.
  Also append the finding to `research/multiagent/thoroughanalysis.md` §C<N+2> via the END-MARKER protocol
  (patch: old = marker line exactly; new = your rows + the unchanged marker; re-read before each append).
- ⚠️ LIVE FLEET: 16 agents are editing this repo RIGHT NOW (W24 cleanup lanes own src/lib core, llm/scripts,
  console, routes; W25 auditors + cleaners are reading the same files; watchdogs log everything).
  → Record each finding's READ TIME. If the owner-lane is mid-edit in that file, VERIFY the bug against the
  CURRENT bytes first — several "tons of bugs" may already be fixed by the time you arrive; if so, record
  "already-fixed, verified" instead of re-fixing.
  → Prefer files NO live lane owns: scripts/*.test.mjs, src/lib/*.test.ts internals, teardown/mocks, guards,
  docs' examples, the CLI's edge verbs, migration/build scripts.
- HOST ARTIFACT: node under Hermes's BACKGROUND harness dies `stdin is not a tty`, exit 1, zero output —
  that is NEVER a product bug. Tests run FOREGROUND only. Do not "fix" it (it is already registered).
- NO keyed DeepSeek calls (account unfunded — every call 402s). No full-gate runs (siblings mid-edit).
- No stubs/mocks/eslint-disable/TODO. AGENTS.md protected. fixes/** append-only.
```

## HUNTER H1 — crash-class + "work prevention" in the runtime chain
**Box:** `src/lib/**` EXCEPT `src/lib/llm/**` (H3's); prefer `.test.ts` internals + non-core modules
(knowledge, vault, harvest, bench, swarm, ast-mine, verify, node-runner, chat*, report-intake, algorithms).
**Look for the day's proven classes:** uninitialized/undefined reads, missing null guards on real shapes,
throws inside catch paths, `process.exit` in library code, file/dir assumptions that crash on first use,
loop bounds, async-without-await on write paths, ordering (read-before-write) violations, silent catch
blocks that swallow a coded failure. Every fix pinned with the smallest foreground run.

## HUNTER H2 — crash-class + wiring in the HARNESS + handoff/delegation ergonomics
**Box:** `scripts/**` (rapidtool-cli.mjs edge verbs, run-eval.mjs, gate.sh, guards) + `migrations/**` +
`vite.config.ts`/`package.json` scripts. **This is where "prevention of all work" + "handoff/delegation"
bugs live:** a verb that crashes on an unreadable file instead of emitting a coded refusal; a guard that
blocks legit work; an exit-code path that reports success on failure; a watcher/marker left in a state that
poisons later runs (e.g. `run-in-progress.json` semantics); the CLI's stdout contract violated on error
paths; spawn/env handling that loses NODE_TEST_CONTEXT (the registered trap — verify the fix is still in
place and applied everywhere). Trace 10+ real CLI runs' code paths by reading + minimal safe invocations
(read-only verbs only — e.g. `--help`, `doctor`, `diagnose`; nothing that writes).

## HUNTER H3 — crash-class in provider/LLM + telemetry + any `*.server.ts` seam
**Box:** `src/lib/llm/**`, `*.server.ts` modules (codegen.server, verify.server, node-runner.server,
runtime-log.server, deepseek.server, chat.server), `rt-*.ts`, `watchdog.ts`, `diagnose.ts`, `errors.ts`.
**Look for:** the H2 crash class (top-level `node:` imports into client-safe modules — grep for it), unhandled
provider shapes (response without `choices[0]`, usage absent, stream frame malformed), telemetry that can
throw into its observed code, error-class mislabels (a 4xx ≠ a 5xx ≠ no-balance), the call-tap's throwing-tap
containment, timeout/abort paths that leak handles.

## HUNTER H4 — crash-class in UI/routes + the doc-example reality gap
**Box:** `src/components/**`, `src/routes/**`, `src/styles.css`-adjacent, and every code snippet in
`README.md`, `AGENT_GUIDE.md`, `scripts/README-cli.md`, `research/multiagent/263_*`.
**Look for:** render-path crashes (non-null assertions on possibly-undefined state, `.map` on possibly-
undefined arrays, missing loading/error branches that white-screen), event handlers calling undefined,
route loaders referencing missing modules, and DOC EXAMPLES THAT CANNOT RUN (each is a handoff bug: an
agent or the friend copy-pastes a command/snippet that fails). Fix UI crashes; fix doc examples to the
verbatim working form (verify each command's existence in the CLI's USAGE first).
