# 262 · PROPOSAL — AGENTS.md doctrine: the `--test-name-pattern` no-op trap + its companion (ledger #50's doc half)

**Status: PROPOSAL — NOT APPLIED. Owner action required (deliberate).**
**Prepared by:** W23 · LANE 7 (recorder) · **read/build date:** 2026-09-26 · **Box:** this doc only — AGENTS.md
was NOT touched by this lane.
**Why this file exists:** W22-L1's attempt to write this doctrine into `AGENTS.md` was **correctly BLOCKED** —
`AGENTS.md` is a protected agent-instruction file; the approval prompt timed out (300.2 s) and the block
message is explicit: *"Silence is not consent. The user has NOT consented to this write. Do NOT retry it or
attempt the same edit via another path."* The lane did not retry (compliant), finished the executable half of
#50 (`scripts/test-name-pattern-guard.test.mjs`, 3/3 green), and flagged the owner. This document reconstructs
the intended text so the owner can apply it in one deliberate act.

---

## 1 · The evidence behind the doctrine (all measured, foreground, on this host — Node v22.23.2)

From the blocked lane's own captures (`C:/Users/mnril/w22l1_scratch/`) and its transcript
(`C:/Users/mnril/AppData/Local/hermes/cache/delegation/live/deleg_514bf450/task-0.log`, 18:47–18:54):

- **THE TRAP:** `node --test --test-name-pattern=<x> file.test.mjs` where `<x>` matches **zero** tests exits
  **0** and prints `1..0` (zero subtests ran) — yet the summary still reads `# tests 1 / # pass 1`, because it
  counts the FILE wrapper. Captures: `noop_nomatch.txt` (exit 0 · `1..0` · `# pass 1`).
- **It can mask a real red:** over a fixture containing a genuinely FAILING test, the no-match filter exits
  **0** (`mask_nomatch.txt`) while the same file unfiltered exits **1** (`mask_full.txt`). A filtered run's
  exit code is blind.
- **THE RECIPE:** a match runs the test and prints its own TAP line (`ok 1 - alpha case runs`,
  `noop_match.txt`) — so *requiring the expected test's own `ok N - <name>` line in the SAME output*
  discriminates exactly where the bare exit code lies (pinned as case 2 of the guard).
- **Companion trap (found while building the pin):** a child `node --test` spawned from inside a parent test
  runner inherits `NODE_TEST_CONTEXT`; the grandchild runner refuses — *"run() is being called recursively
  within a test file. skipping running files."* — and exits **0 having run NOTHING**. Same trap class; the
  guard scrubs the var in its spawn (`delete env.NODE_TEST_CONTEXT`).
- **The guard of record:** `scripts/test-name-pattern-guard.test.mjs` (5,041 B, mtime 2026-09-24 18:54) — its
  header states the intent verbatim: *"this is that codification: executable pin + recipe (doc note in
  AGENTS.md)"* and *"update this pin + the AGENTS.md note together."*

## 2 · The doctrine (what the blocked patch wanted to say — reconstructed)

Two working rules to sit with the test-running conventions in `AGENTS.md`:

1. **Filtered test runs must prove they RAN the test.** A pattern matching zero tests exits 0 and prints
   `1..0` while the summary still reads `# pass 1` (the file wrapper) — a no-match filter can mask a
   genuinely red file. Never read a filtered run as green from its exit code: require the expected test's own
   `ok N - <name>` line in the same output.
2. **Scrub `NODE_TEST_CONTEXT` in nested test-runner spawns.** A child `node --test` started from inside a
   parent test runner inherits the var, refuses ("run() is being called recursively within a test file"), and
   exits 0 having run NOTHING — same trap class as the filter above.

## 3 · The exact patch (ready to apply)

**Target:** `AGENTS.md`, `## Working rules` section, immediately after the `npm test` scripts-leg cwd rule
(anchor read 2026-09-26 — the rule is the last bullet before `## Legacy scaffolding`, at lines 107–108).

**With the patch tool (replace mode):**

- `old_string`:
```
- **`npm test` scripts-leg cwd rule**: script tests that touch the platform chrome use
  temp-dir `cwd` isolation — never run them from the repo root as their subject.
```

- `new_string`:
```
- **`npm test` scripts-leg cwd rule**: script tests that touch the platform chrome use
  temp-dir `cwd` isolation — never run them from the repo root as their subject.
- **Filtered test runs must prove they RAN the test** (`--test-name-pattern` no-op trap): a pattern matching
  zero tests exits **0** and prints `1..0` while the summary still reads `# pass 1` (the file wrapper) — a
  no-match filter can mask a genuinely red file. Never read a filtered run as green from its exit code:
  require the expected test's own `ok N - <name>` line in the same output. Pin:
  `scripts/test-name-pattern-guard.test.mjs` (ledger #50). If a future runtime turns a zero-match filter into
  a non-zero exit, that pin goes red on first run — update the pin and this note together.
- **Scrub `NODE_TEST_CONTEXT` in nested test-runner spawns**: a child `node --test` started from inside a
  parent test runner inherits the var, refuses ("run() is being called recursively within a test file"), and
  exits **0 having run NOTHING** — same trap class as the filter above. Spawn fixtures with
  `const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;`.
```
*(Equivalent manual step: insert the two bullets above directly after line 108 of `AGENTS.md`.)*

## 4 · After applying — verify + close the ledger item

1. `grep -c "test-name-pattern" AGENTS.md` → ≥ 1 (the note is present); `grep -c "NODE_TEST_CONTEXT" AGENTS.md` → 1.
2. `node --test scripts/test-name-pattern-guard.test.mjs` (foreground) → **3/3, exit 0** (the guard is untouched
   by this proposal).
3. Append to `fixes/257_error_ledger_v3.md` (append-only) the marker W22-L1 owed — suggested text:
   `> [W23-L7] **#50 → FIXED-APPLIED (doc half via owner application of research/multiagent/262_agents_md_proposal.md; guard half by W22-L1, 3/3).**`
   (Only if applied.)

## 5 · Provenance & honesty limits (read before applying)

- **The blocked patch's exact payload was not preserved** in the delegation transcript (the tool-call line is
  summarized without arguments: `→ patch(...\AGENTS.md)`, result = the BLOCKED message). The text in §3 is a
  **reconstruction** from (a) the lane's measured outputs (transcript lines 148–164, 176–181), (b) the guard
  test's header comment — written by the same author as the intended "doc note in AGENTS.md", (c) the author's
  final summary: *"The recipe now lives in the guard's header comment; the owner must add the AGENTS.md note."*
  Intent and content are faithful; wording may differ from the draft the author would have written. The owner
  may trim freely.
- **Why it was blocked (and why that was correct):** `AGENTS.md` is agent-instruction configuration; edits to
  it require explicit user consent. The mechanism worked as designed — a silent timeout must never be read as
  approval. This proposal keeps the change out of the wave and puts it in front of the owner as one deliberate
  action.
- **No test/typecheck/build/lint was run in preparing this document** (docs-only; the verify commands in §4
  are FOR THE APPLIER, foreground).

## 6 · Cross-references

- Guard: `scripts/test-name-pattern-guard.test.mjs` (+ scratch captures `noop_nomatch.txt`, `mask_nomatch.txt`,
  `mask_full.txt`, `noop_match.txt`, `guard50_run.txt`).
- Ledger: v1 row **#50** (`fixes/251_error_ledger.md`) + v3 §READY-TO-FIX-NOW #5 (`fixes/257_error_ledger_v3.md`)
  + the v4 close-out block §C (§v4).
- Lane logs: `fixes/260_lane1_ready_queue.md` (recorder-filled — FLAGS #1/#2) · `fixes/257` §W22-L1 markers ·
  transcript `deleg_514bf450/task-0.log:172-173` (the block itself).
- Wave: `wave_plans/W23/code-all.md` LANE 7.
