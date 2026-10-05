# fixes/347 — LANE C: pipeline safeguards (factory-watch driver)

Branch `rt347-safeguards`, base `841383d`. Scope: `scripts/factory-watch.mjs` + its test only.
No gate touched, no keyed call, no `src/lib/**` change.

## Gap found (read-only)

- **CAMPAIGN2 §3 + §9 / IMPROVEMENTS.html**: a campaign burns real keyed spend
  (616,329 tok across 109 calls) driving the CLI over the checkout's live `src/**`.
  Nothing in the driver distinguishes "the reviewed revision" from a mid-edit tree:
  a run started while `src/**` is dirty is unattributable to a commit yet still
  spends tokens. `factory-watch.mjs` had no preflight before its first CLI verb.
- **CAMPAIGN2 §4.3**: the tick's honest per-item verdict (action/status/
  code/reason/phase/delivery) lives only in the tick's stdout and in
  `state/factory-state.json`; the per-project run artifact dir carried no
  structured trace file, so a single run's verdict was not durably readable
  beside the artifact it describes.

## Changes

1. **Dirty-`src` preflight** (`scripts/factory-watch.mjs`):
   - pure `assessSrcDirty(porcelain)` — `:173` (porcelain → `{dirty, files}`).
   - `readSrcStatus(srcRoot)` — `:469` (runs `git status --porcelain -- src`;
     a non-repo / missing git returns `null` = "cannot verify", never a silent block).
   - wiring — `:769` (after state validation, before the item loop and before any
     CLI verb): a dirty reading refuses `RT_E_SRC_DIRTY` (exit 1) with the file
     list, so no keyed spend happens. `--allow-dirty-src` is the conscious
     override; `--src-root <dir>` retargets the checked checkout (default this repo);
     a bare `--src-root` is refused `RT_E_VALIDATION` (`:727`). Dry-run invokes no
     CLI, so it is never blocked.
2. **Per-run structured trace** (`scripts/factory-watch.mjs`):
   - `persistRunTrace(work, slug, trace)` — `:491` writes
     `<work>/<slug>/run-trace.json` (schema_version/cmd/at + the exact result row)
     atomically, best-effort (never fails a run).
   - called on all four entry outcomes: create-failed `:870`, drive-* `:892`,
     deliver-failed `:910`, delivered `:931`. Dry-run reaches none → writes nothing.

Behavior is byte-identical when a safeguard is not triggered: with a clean `src/**`
and no trace outcome the envelope/plan is unchanged; the trace is an additive side
file and the preflight is a no-op.

## Tests (all in `scripts/factory-watch.test.mjs`)

- `assessSrcDirty` pure contract (clean empty/whitespace; dirty rows + paths).
- `dirty-src preflight REFUSES coded before any spend; a clean src root proceeds`
  — refuse-on-trigger (temp dirty git repo → `RT_E_SRC_DIRTY`, no `build.json`,
  no state) + allow-on-clean control (temp clean repo → keyless `drive-stalled`,
  never the refusal).
- Trace assertions added to the keyless end-to-end (`run-trace.json` = stalled /
  `RT_E_GATES_FAILED`) and the dry-run leg (no trace written).
- Existing behavioral helpers append `--allow-dirty-src` (they run against the live
  dev checkout mid-edit); the dedicated test passes `allowDirtySrc:false`.

Commands / results:
- `node --test --test-reporter=tap scripts/factory-watch.test.mjs` → **18 pass / 0 fail**.
- `node --check scripts/factory-watch.mjs` → clean.

## Residuals

- The check is `git status` on `<srcRoot>/src`; when git is unavailable it fails
  open (cannot verify) rather than blocking. A host hook that wants a hard stop can
  gate on `RT_E_SRC_DIRTY` never appearing, but a fail-closed mode was not added.
- Trace is per-item only; no tick-level aggregate trace file was added.
