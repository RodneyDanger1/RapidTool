# W30 · THE SHELL SPRINT — code the SHELL of every remaining capability, fast.
**All readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`).
**READ FIRST:** `finalsprint.md` (the repo root — your master table + your §S<n> section) + your rows' specs in `research/multiagent/thoroughanalysis.md` (§W27-WORKLIST: §W27-B/C/D + §R8 + §R13 hold the designs). AGENTS.md for the repo contract.

## THE SHELL CONTRACT (what "coded the shell" means here — do exactly this, nothing more, nothing less)
1. **The seam exists and compiles**: types/interfaces/exports in place, `node --experimental-strip-types --check` (or a scoped tsc) green.
2. **Wired to ≥1 real call site** — the path that will use it actually calls it — OR it returns an **honest coded refusal** (`RT_E_*`-registered or an existing code) where the real capability genuinely cannot exist yet (e.g. no host isolator).
3. **`TODO(<row-id>)` markers at the exact line** where the full logic goes, one per unfinished behavior — searchable, honest, never a fake implementation.
4. **No fabrication**: a shell that pretends to do the thing (e.g. returns fake data) is WORSE than no shell. Refusals must be loud, typed, labelled.
5. **No removals**: additive only; never delete a control/tab/pane/export. Keep every existing behavior byte-compatible where the row says so (keyless parity etc.).
6. Write your lane log (`fixes/272_s<n>_*.md`) EARLY; then APPEND your section to `finalsprint.md` (§S<n>, above the END-OF-FILE-MARKER-SPRINT) with: per item → files+lines · the seam's shape · its call site (or refusal) · the TODO markers you placed · what's needed after (1-2 lines each). Append-only, re-read before the append.
7. Targeted checks only; NO full-gate runs; NO keyed calls; log-and-continue ([EXT-FAIL] + keep going).

## S1 — AUTONOMY SHELLS (`fixes/272_s1_autonomy.md`)
- **R14-f01**: the supervisor completer seam — a Node-side reviewer binding at `store.ts:1105` + the headless wild macros (`headless.ts:3624/3805`), built from `deepseek.server.ts`'s `completeDeepSeek` (parity with `engine.ts:2871-2873`'s direct-env probe); or split the classifier to a non-`.server` module taking an injected `WildCompleter`. Shell = the injection seam + the call sites passing it; full policy logic TODO. Done-when for later: a bare-Node keyed wild run logs `wild.review (classifier)`.
- **W-47/R13-f01 unattended run**: a `rapidtool-cli.mjs` command shell (e.g. `run --unattended` / a `daemon` verb stub) + a `scripts/unattended-shell.mjs` that frames the host requirement (Task Scheduler/cron line in a comment) and REFUSES with a coded reason until W-01/02 land keyed. Refusal must name the blockers.
- **R13-f02 plan**: `wild.plan` shell — a store field + type + the engine read-point (before phase-1 mutation) returning an empty plan honestly; UI/print TODO.
- **T-107.7 checkpoint/resume**: a `checkpoint.server.ts` shell (write/read a checkpoint file beside `.rapidtool/`) + a `resume` verb shell in the CLI (parses, validates, then refuses with "no checkpoint" coded reason until the writer is wired); the engine's per-phase commit gains a single checkpoint-write call site (guarded, TODO for the full state set).

## S2 — UNIVERSALITY + QUALITY SHELLS (`fixes/272_s2_universality.md`)
- **The 4 kinds**: in `scaffold.ts`, per-kind entry wiring + package.json fields — game gets `vite.config.ts` + a real `main`; cli-tool gets `bin` + a runnable entry; library gets `exports`/`files`/`main`; service gets PORT wiring + a start script. The throwing `main()` becomes a STRUCTURED honest stub (importable, exports the declared surface, throws only when actually run, message names the TODO row).
- **Graders**: `run-eval.mjs`'s grader shape gains per-kind `expectedBehavior` entries (entry runs / exports resolve / bin exists) as a checked STRUCTURE with the assertion logic TODO-marked; add the `verification` label field to the acceptance/packet output (carried through, populated honestly as "files+content only" until the graders land).
- **Emitted UI seam (A3-f07)**: a `uiGeneration` hook type in the emit envelope + the scaffold's single call point (no-op returning the current name-dump, TODO-marked) so the stage has a home.
- **R3-f02/R3-f03**: reword the prompt's CJS rule to ESM named exports (text edit, no behavior change); add `redTree`/`partial` to the emit envelope + `capability.N` skip-with-reason rows in `capScan` output (structure + one skip path, TODO for the full mapping).

## S3 — DEPTH SHELLS (`fixes/272_s3_depth.md`)
- **T5.7 cassette**: `cassette.server.ts` shell — record/replay types + a provider-seam wrapper that REFUSES with a coded reason when a miss occurs (no silent passthrough); wire the wrapper point only (guarded by an env flag default-off).
- **T5.1 streaming**: a `stream` flag on the CLI's `chat`/`run` (parsed, carried, then the honest "streaming surface not yet wired" refusal) + the type on the provider seam (`onToken?`) so the transport spike has its home.
- **F1 MCP**: `mcp.server.ts` shell — client-type + a read-only `tools/list` round-trip function behind the owner gate (default disabled, coded refusal), zero network calls in the shell.
- **F2 provider step-2**: registry entry shape for a second provider + the key env name + a `probe()` shell (refuses until OV-1's decision).
- **F4 allow-lists**: the engine consult point at the policy seam (the overlay read + `wild.paused_policy` event emission on a deny), with the actual rule-matching TODO-marked.
- **ledger**: complete Lane P's partial per-run ledger threading if incomplete (verify first: `grep -n "sessionTokenBudget\|createTokenBudget" src`).

## S4 — FLOOR + GOVERNANCE SHELLS (`fixes/272_s4_floor.md`)
- **R11-f01 dev-server bind**: `vite.config.ts` host handling — loopback default + an explicit opt-in env (`RAPIDTOOL_BIND_ALL=1`) for the panel/iframe cases, and the doc line. If other lanes mid-edit vite.config, coordinate in your log.
- **R11-f08 quarantine**: `headless.ts`'s `--force` path — the quarantine-move seam (move foreign files aside to `.rapidtool-quarantine/<ts>/`, return the list) with the move TODO-marked if risky mid-wave.
- **R6-f12 pane boundary**: a small class boundary component + wrap HomeScreen/RunScreen (this one can be FULLY implemented — it's small) emitting `ui.pane_crash` via `reportRt`.
- **seat surface**: a console hook shape for the approve action (calls the CLI's two-channel seam pattern / a server-fn shell that refuses until wired) — do NOT invent a store action; the seam + refusal is the shell.
- **R13-f04 isolation**: a documented refusal — `isolation.server.ts`-class seam returning a coded "no isolator on host" with the exact requirement in the message/comment; NEVER a fake sandbox.

<!-- END-OF-BRIEF -->
