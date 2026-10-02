# W46 / 332-6 — "Watchdog" — runtime telemetry and robustness

Read `wave_plans/W46/README.md` first. Your evidence base is register `R12-f04…f07` (in
`research/multiagent/thoroughanalysis.md`, section `§R12`). Your log: `fixes/332_6_watchdog.md`.

## Owned files (STRICT)

`src/lib/rt-events.ts` · `src/lib/rt-ring.ts` · `src/lib/rt-client.ts` · `src/lib/watchdog.ts` ·
`src/lib/diagnose.ts` · `src/lib/runtime-log.server.ts` + their `*.test.ts`

## Findings you are fixing

**W1 — `R12-f04`, P1: the watchdog step budget is SMALLER than a legal keyed step.**
`WILD_STEP_BUDGET_MS = 90_000` (in `rt-events.ts`, consumed by `diagnose.ts:249/260`) versus
`P6_SYNTH_TIMEOUT_MS = P6_PHASE_MAX_MS = 240_000` (in `codegen.server.ts`, not yours). A legitimate
keyed P6 synthesis can therefore exceed the stall budget and the run auto-pauses as "frozen". Derive
the step budget from the phase's own maximum (or the largest configured timeout) so a legal step cannot
trip the stall latch, and keep a genuinely frozen run detectable. Add a test with a step longer than
the old budget and shorter than the phase max.

**W2 — `R12-f07`, P2: `diagnose`'s growth surface is hardcoded zeros**, so the detector is inert.
The register records `projectFile: 0` always, with a measured 158,302-byte counter-example. Read the
real sizes with `statSync` and surface real counts; keep the JSON shape backward-compatible or version
it, and pin the counter-example.

**W3 — `R12-f06`, P2: `readRtTail` reads the WHOLE file to keep the last 256 KB**
(`readFileSync` then slice — ~3× allocation per dir), on an 8 GB box where this is called repeatedly.
Implement a true tail read (open, `stat`, read the last N bytes, handle a short file, handle a
multi-byte character boundary honestly — a split UTF-8 sequence must not corrupt the JSON row).
Pin the boundary cases.

**W4 — `R12-f05`, P2: stale-run telemetry defeats its own coalescer.**
The message hash includes the changing `stale Ns` value, so the coalescer emits a fresh
localStorage write roughly every 11 s for a run that is merely stale. Put the seconds in the payload
and keep the message stable. Pin that two consecutive stale ticks coalesce to one write.

**W5 — sweep your six files** for the telemetry contract's own rules (`AGENTS.md` §7): telemetry code
MUST NEVER change engine behavior (purity-tested), MUST never throw into the code it observes, and the
ring MUST stay bounded and corrupt-safe. Also check `runtime-log.server.ts`'s NDJSON appends for
unbounded growth, and `rt-client.ts`'s install for idempotence.

## Rules

The purity guarantee is load-bearing — if a fix needs the engine to change, stop and report instead.
Node 22 + host Node 24, `--test-reporter=tap`. Targeted suites:
`node --experimental-strip-types --test --test-reporter=tap src/lib/rt-ring.test.ts`
(and `rt-client.test.ts`, `watchdog.test.ts`, `diagnose.test.ts`, `rt-events.test.ts` — run the ones
that exist for your files and report the real counts). No full gate, no `npm run eval`, no keyed calls,
no secrets.

## Report back

Verdict per finding · the before/after numbers (real output: the stall decision, the growth figures,
the allocation/tail behaviour, the coalescer's write count) · tests added with real results on both
runtimes · any purity or behavior change you deliberately avoided and why.
