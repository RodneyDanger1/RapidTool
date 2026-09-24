# W10 · LANE 3 — verify-kind install leg (T4.1 / TA-16)

**Mission.** `verifyKindDir` (`src/lib/compile-check.server.ts:748`) is the flag behind
`emit --verify-kind` (`scripts/rapidtool-cli.mjs:768` rides it). Its scratch-copy + install leg
is the LAST open half (TA-16; dossier 104 §T4.1 :605; dossier 149 P1-2). **W9-L5's spike PROVED
the mechanism works on this host: scratch `npm install --no-audit --no-fund` exit 0 in 31s**
(scratch @ `C:\Users\mnril\w9l5_scratch\w9l5_run`; install log there; tree-run exit 0 in 25.5s —
envelope NOT read, so nothing beyond this is claimed).

**Done-when:** the flag performs: fresh scratch copy of the emitted dir → `npm ci` (or `npm
install` when no lockfile — say which, honestly) → the declared build/test scripts → a REAL
per-kind verdict in the envelope (upgraded from the current honest-skip where implementation
allows; where a step can't run (offline, no script declared), the envelope says exactly why —
never a silent pass). Install/script failure = coded verdict (pick the honest RT_E_* code,
document it). Timing guard: the lane's own suite must not exceed sane runtime (the spike was
~31s; keep the test on a fixture that installs fast or a mocked install seam — DO NOT hit the
network in the default suite; gate the real-install leg behind an explicit test that skips
without `RT_VERIFYKIND_INSTALL=1`).

**Owned:** `src/lib/compile-check.server.ts` + its test; `scripts/rapidtool-cli.mjs` (the
`--verify-kind` wiring ONLY — keep every existing arm byte-identical) + README-cli.md's
verify-kind status paragraph (update: no longer "in flight"); NEW `fixes/216z_verifykind_install.md`.
**NOT:** engine/knowledge (L1), token-ledger/seams (L2).
**Anchors:** compile-check.server.ts:748; CLI :768; dossier 149 (read it first).
**Verify:** typecheck 0; scripts leg 261→grow; compile-check suite green (grow). Budget death ⇒ PLAIN state.
