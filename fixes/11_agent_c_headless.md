# Headless agent driver + CLI (build agent #3, mission C) — LIVE-VERIFIED

## What shipped

- **`src/lib/headless.ts`** — file-based headless driver (no browser, no store, no
  localStorage). Imports the existing pure engine/io/phases/report-intake exports
  **read-only** (no existing file was modified).
  - `loadProject(path)` / `saveProject(path, project)` — atomic write-then-rename.
  - `createProject({brief, name?})` — `emptyProject` + `inferName`.
  - `runPhase(project, phase, {live?})` — deterministic `applyPhaseResult`, or a
    best-effort live research/narrative layer on top of it. **Never throws**;
    every failure (invalid phase, network, unconfigured backend) degrades to the
    deterministic floor.
  - `runUntilGate(project, {autopilot, live?, maxSteps?})` — `advanceOnce`-like
    loop (store parity: `priorsSealed` + `canEnter` + `applyPhaseResult` +
    `approveHitl`-when-autopilot, honoring `forceHuman` and the stock-HITL /
    tightness rules) until `awaiting_hitl` / `complete` / `blocked`.
  - `approve(project, {force?})`, `reject(project, note)`, `retry(project)`,
    `ingest(project, rawReport)`, `packet(project)`, `exportJson(project)`.
  - `summary(project)` — JSON-safe `{name, currentPhase, status, phaseCounts, lastGate}`.
- **`scripts/rapidtool-cli.mjs`** — thin argv wrapper over `headless.ts`
  (`create` / `run` / `gate` / `approve` / `reject` / `ingest` / `packet` /
  `export` / `summary`). Prints one JSON object to stdout; non-zero exit on error.
- **`src/lib/headless.test.ts`** — 23 tests: create / save-load / run / gate /
  autopilot (positive + forceHuman-refusal) / approve / reject / retry / ingest /
  packet / export / summary / full round-trip. Deterministic only (no network).
- **`scripts/README-cli.md`** — usage + the exact Windows invocation.

## The exact CLI invocation that works on Windows (Node 22)

```
node --experimental-strip-types scripts/rapidtool-cli.mjs <command> ...
```

`--experimental-strip-types` is required (Node 22 strips types only behind the
flag). The CLI resolves `../src/lib/headless.ts` via `import.meta.url`, so it is
**cwd-independent**.

## Live end-to-end proof (run in this session)

1. `create --brief "<HVAC dispatch>" --name "HVAC Dispatch" --out build.json` →
   `ok:true`, `status:"intake"`, phaseCounts `{ready:1, locked:12}`.
2. `run` (one phase) → P0 complete, `currentPhase:1`, `steps:1`.
3. `gate --autopilot` → runs P1–P3, **parks at P4** (`awaiting_hitl`, stock HITL
   not auto-approved) — `steps:4`.
4. `approve` → P4 complete, `currentPhase:5`, decision ledger shows
   `{phase:4, decision:"approve", decidedBy:"human"}`.
5. `reject --note "<12 chars>"` on a parked gate → `ok:false`, exit 1, message
   "Rejection requires at least 12 characters of qualitative feedback."
6. `reject --note "<valid 12+ char note>"` → `status:"blocked"`, P4 `rejected`,
   ledger `decision:"reject"`.
7. `ingest --report '{...}'` → `[agent report]` artifact + `agent.report` log.
8. `packet` (stdout) and `packet --out packet.md` (11003 bytes) → compiled Agent Packet.
9. `export --out out.json` → full project JSON round-trips via `importProject`.
10. **`--live` run** → real keyless web research (DuckDuckGo/Wikipedia) layered
    **5 real "research" artifacts** (e.g. "The Global Logistics Architecture of
    2026", "Best Fleet Management Technology for Logistics 2026") on top of the
    deterministic scorecard — **zero API keys, zero browser**. No DeepSeek
    narrative because `DEEPSEEK_API_KEY` was not in `process.env` (honest fallback).
11. **Full drain to completion** via `gate --autopilot` + `approve` loop → all
    **13/13 phases complete**, `status:"complete"`, `currentPhase:12`, packet
    10941 bytes; HITL gates P4/P5/P8/P9 (+ P11 for the marketplace domain) all
    decided in the ledger.

## Honest notes / boundaries

- **Live mode** reads keys from `process.env` only (no `.env` auto-load). Free
  keyless search always works; Tavily/DeepSeek need their keys exported.
- **P6 real exec** (`node-runner.server.ts`) is available but intentionally not
  wired into the default live path — `runPhase` layers research/narrative only,
  matching `engine.runPhaseAsync`. Wire `runNodeBounded` into the P6 case if you
  want bounded real module execution through the driver.
- **Autopilot governance preserved**: `forceHuman` gates and stock HITL phases
  (P4/P5/P8/P9) are never auto-approved; use `approve` (with `--force` only for a
  failing P6 sandbox override).
- **Pre-existing typecheck error unrelated to this work**: `src/components/console.tsx`
  references a not-yet-defined component (another in-flight agent's area; outside
  this agent's ownership). `headless.ts` / `headless.test.ts` typecheck clean.

## Final gate

- TS suites: **headless.test.ts 23/23 passing**.
- `tsc --noEmit`: only the pre-existing `console.tsx` error (not from this work).
- CLI end-to-end verified on Windows Node v22.23.2 (`--experimental-strip-types`).
