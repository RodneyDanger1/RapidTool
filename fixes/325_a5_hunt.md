# 325 — A5 BUG-HUNTER lane (scripts/**) — W44 six-professional wave

Lane: A5 (bug-hunter) → A5b (finisher, same scripts box). Repo: `C:\Users\mnril\Desktop\RapidTool Main`
(git-bash `/c/Users/mnril/Desktop/RapidTool Main`). Base: commit `e2fbd9d` (boundary GREEN:
scripts 365/365, lib 2513 pass). Scratch: `C:/Users/mnril/a5_scratch/` (A5 repros `p1`/`p2`;
A5b re-verification under `p3/`).
**KEYLESS ONLY — no DEEPSEEK_API_KEY in spawn env; no keyed runs. Real code only, no mocks.
Patch-only, minimal diffs; LF for .mjs/.sh, CRLF for README-cli.md. Pins additive; never weaken.
Scoped proofs only: `node --check`, `node --test <file>`, `npx eslint <files>` — never npm test/build/gate.sh.**
Sibling lanes edit their own boxes in parallel; this lane touches ONLY `scripts/**` + this log file.

Already-fixed register (do NOT re-report; map in fixes/319/322/323): CLI coded forceHuman refusal,
taxonomy Legs 13/14, reject seat discipline, OBS-5-S remedy, checkpoint ignore-with-notice wiring,
honest park row level/parked:true, T9.3 repair wiring, fixture LEX-clean.

## Status

- [x] A5: opened, log-first; 3 real bugs found, keyless-reproduced; B1+B2 fixed to disk (patch-only, LF).
- [x] A5b: all 3 bug records written here first (before A5b edits); B3 finished; additive pins landed
      (taxonomy Leg 16 + run-eval A5 writer leg); fixes re-verified with fresh keyless spawns.
- [x] A5b closed: proofs GREEN — taxonomy 16/16, run-eval 48/48, busy 6/6, `node --check` ×4,
      eslint 0; LF preserved; README-cli.md untouched; END marker below.

### Hunt areas

- CLI verbs/doors: arg parsing, flag conflicts, seat logic, envelope shapes, exit codes, remedy texts.
- Eval harness (`run-eval.mjs`): corpus loading, drain, scoring, leak-scan, results/history writing.
- `gate.sh`: timeouts, signal handling, partial output, temp handling.
- Doc/behavior drift (README-cli.md vs behavior), test-suite holes.

## Bug records

### B1 (MED-HIGH) — empty-value path flags melt into the CWD (exit 0/4, writes outside the named target)

**Bytes.** `scripts/rapidtool-cli.mjs`: the R5-f10 guard only refused the VALUELESS spelling
(`args.out === true` / `args.html === true`). The EMPTY-VALUE spelling (`--out=`, `--out ""`) stores
`""`, which passes every `typeof args.out === "string"` read, and `resolve("")` resolves to the
process CWD — so the write target silently became the CWD. Seven sites: `create` (l.680 pre-fix),
`packet` (1370), `export` (1412), `emit` (1440), `vault` (2487), `design --html` (2683), `diagram --out` (2728).

**Repro (A5, real keyless spawns, scratch `p1`, cwd = fresh empty dir).**
- `emit --out=` → exit 0, envelope `"dir": "…\fresh2"`, **15 files emitted INTO the cwd**.
- `vault --out=` → exit 0, **17 vault files in the cwd**.
- `packet --out=` → exit 4 `RT_E_PATH_KIND_MISMATCH` (EISDIR opening the cwd dir as a file).
- `create --out=` → exit 4 `RT_E_PERMISSION_DENIED` (rename onto the cwd dir) + a **`.tmp-<pid>` leak** beside it.

**Fix (landed A5; re-verified A5b).** Added `pathFlagMissing()` + `pathFlagRefusalError()` beside `flag()`;
converted all 7 sites from `=== true` to `pathFlagMissing(...)`. Valueless message byte-identical;
empty value ⇒ `"<verb> --<flag> requires a path (got an empty value)"`, exit 1, `RT_E_VALIDATION`,
nothing written. A5b post-fix spawns (fresh melt dirs): all four repro'd verbs exit 1 + coded + cwd untouched.

**Pin.** `scripts/cli-exit-taxonomy.test.mjs` Leg 16 (W44 A5): all seven guard sites statically
content-anchored + no `=== true` path-flag regressions + behavioral empty-value spawns
(`create`, `packet`, `emit`, `vault` — the four repro'd verbs; plus `export`/`design --html`/`diagram`)
each into a fresh melt dir, asserting nothing lands but telemetry.

**Proof.** A5b re-spawns (below) + taxonomy suite 16/16 + eslint.

### B2 (MED) — eval empty-corpus `results.json` non-atomic + shape-inconsistent

**Bytes.** `scripts/run-eval.mjs:2975` (pre-fix) wrote the empty-corpus `results.json` with a bare
`writeFileSync` — contradicting `writeJsonAtomic`'s own doc-block (`:2693-2703`: "no bare writeFileSync
of results/history remains") — and the object OMITTED the documented `corpusDir` key that `persist()`
always writes and the scorecard reader reads (`src/lib/scorecard.ts:284`; the "recording writer"
contract in `run-eval.test.mjs:557-560`).

**Repro (A5).** `EVAL_CORPUS_DIR=<empty dir> node scripts/run-eval.mjs` → results.json keys
`[generatedAt, mode, graderDir, entries, summary]` — **no `corpusDir`**.

**Fix (landed A5; re-verified A5b).** Empty-corpus writer → `writeJsonAtomic(RESULTS_PATH, {… ,
corpusDir: CORPUS_DIR, …})`; the crash tombstone (`:3236` pre-fix) also routed through `writeJsonAtomic`.
`writeFileSync` remains only inside `writeJsonAtomic`/`writeMarkerAtomic` (intended).
A5b post-fix spawn: results.json carries `corpusDir` + legacy shape, no tmp residue.

**Pin.** `scripts/run-eval.test.mjs` — W44 A5 leg: source slice (writeJsonAtomic + `corpusDir` +
no bare `writeFileSync` in the empty-corpus block) + behavioral spawn asserting the written shape,
keyless mode, and no tmp residue.

**Proof.** A5b spawn (below) + run-eval suite 48/48 + eslint.

### B3 (LOW-MED, doc/behavior drift) — `USAGE.reject` omits the seat requirement

**Bytes.** `scripts/rapidtool-cli.mjs` USAGE (`:4269`): `reject: "reject --project <file.json> --note <text>"` —
but the 322/F-1 fix makes a bare non-TTY reject refuse `RT_E_VALIDATION` ("no claimable seat"), and every
other seat-disciplined verb (`approve`, `fixtures`) documents its seats in USAGE. README-cli.md §4
documents the seat rule; the USAGE/help payload did not. (A5's last command — the one that would have
checked this — was blocked by the command-parser guard; A5b finished it.)

**Fix (landed A5b).** USAGE.reject now names both seats:
`reject: "reject --project <file.json> --note <text> (--i-am-human | --seat autopilot)   # the seat is
never guessed, name exactly one: --seat autopilot = explicit MACHINE attribution (the documented agent
door, works non-TTY); --i-am-human = human-seat claim — needs a TTY re-entry of the out-of-band
RT_HUMAN_SEAT_TOKEN (refused on non-TTY)"`.

**Pin.** taxonomy Leg 16 also asserts the USAGE.reject line names both seats (`--seat autopilot`,
`--i-am-human`) — this drift class cannot come back silently.

**Proof.** taxonomy suite 16/16 + eslint + README-cli USAGE-parity test (unchanged, key parity intact).

## Fixes landed

- `scripts/rapidtool-cli.mjs` — `pathFlagMissing`/`pathFlagRefusalError` helpers + 7 guard-site
  conversions (B1); USAGE.reject seat text (B3). LF preserved (0 CR bytes on disk).
- `scripts/run-eval.mjs` — empty-corpus + crash-tombstone results writers routed through
  `writeJsonAtomic`; `corpusDir` added to the empty-corpus shape (B2). LF preserved.
- No edits outside `scripts/**` (this log excepted — named by the task).

## Pins (additive; no existing leg weakened)

- `scripts/cli-exit-taxonomy.test.mjs` — Leg 16: header comment leg entry + behavioral/source test
  "W44 A5 — an empty-value path flag refuses CODED…". 15 → 16 tests.
- `scripts/run-eval.test.mjs` — "W44 A5 — the empty-corpus results.json writer is atomic + keeps the
  legacy corpusDir key". 47 → 48 tests.

## Proofs (A5b, live)

All scoped proofs run keyless (no `DEEPSEEK_API_KEY` in env) from the repo root against the working
tree; edited files stay LF (`git ls-files --eol` → `w/lf`); `scripts/README-cli.md` untouched
(`w/crlf` preserved). Evidence captured: `C:/Users/mnril/a5_scratch/recheck_a5b.sh` →
`C:/Users/mnril/a5_scratch/p3/res/` + `p3/suites-*.` runs.

- `node --check` ×4 (`rapidtool-cli.mjs`, `run-eval.mjs`, `cli-exit-taxonomy.test.mjs`,
  `run-eval.test.mjs`) → ALL OK.
- `node --test scripts/cli-exit-taxonomy.test.mjs` → **16/16 pass, 0 fail** (15 pre-existing + new
  Leg 16; 74.7s).
- `node --test scripts/run-eval.test.mjs` → **48/48 pass, 0 fail** (47 pre-existing + new writer leg;
  12.1s).
- `node --test scripts/cli-run-busy.test.mjs` → **6/6 pass, 0 fail** (15.6s; no leg added there — no
  busy-relevant behavior changed in this hunt; the empty-value refusals are exit-taxonomy pins).
- `npx eslint scripts/rapidtool-cli.mjs scripts/run-eval.mjs scripts/cli-exit-taxonomy.test.mjs
  scripts/run-eval.test.mjs` → exit 0, no findings.
- A5b re-verification spawns (real keyless children, fresh melt cwds):
  - `create --out=`, `packet --out=`, `emit --out=`, `vault --out=`, `export --out=`, `design --html=`,
    `diagram --out=` → each **process exit 1 + envelope `RT_E_VALIDATION` + "(got an empty value)"**,
    stderr stack-free, melt cwd left **empty** (pre-fix: emit 15 files / vault 17 files INTO the cwd;
    packet/create exit 4 + a `.tmp` leak).
  - `create --out` (valueless) → exit 1 + "(got a flag with no value)" — R5-f10 bytes unchanged.
  - `EVAL_CORPUS_DIR=<empty> EVAL_OUT_DIR=<mkdtemp> node --experimental-strip-types scripts/run-eval.mjs`
    → exit 0; `results.json` = `{generatedAt, mode:"keyless", corpusDir, graderDir, entries:[], summary}`
    with **only** results.json in the out dir (no tmp residue — the atomic rename consumed it).
- Process note (honesty): a first suite launch via the background runner aborted instantly with the
  runner's "stdin is not a tty" note (all three, exit 1, no test output) — an execution-harness
  artifact, not a code result; the foreground runs above are the counts of record.

=== END 325_a5_hunt — COMPLETE (A5b finisher) · proofs: taxonomy 16/16 · run-eval 48/48 · busy 6/6 · node --check ×4 · eslint 0 · LF preserved ===
