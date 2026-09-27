# fixes/290_k7_tinyfixes.md — W40 · LANE K7 · THE TINY-FIXES PAYOUT (Z3 + Z5)

**Lane:** W40 K7. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell grep only).
**Mission:** land Z3's 10-item tiny-fix list + Z5's G1 5-item list + the 2 README minors (Z5 Part 4) —
all sites pre-located by Z3/Z5 (recon complete, **patches NOT landed** — Z3 tx: "patches NOT landed";
Z5 tx: "log file created; zero product patches"). Sources: `fixes/287_z3_tinyfixes.md`,
`fixes/287_z5_runtime_tail.md`, `fixes/284_wiring_guarantee.md`, `fixes/285_g2_agent_visibility.md`,
`fixes/285_g4_operator_visibility.md` (all [t0] skeletons — the site matrix lives in the lane briefs;
**code = truth**, every site re-read fresh before patching).
**Contract:** CODE-ONLY — no test runs, no typecheck, no builds, no gates, no keyed calls.
Smallest honest patch per item; additive only; `node --check` (or tsc-free equivalent) on every edited file.
**Baseline HEAD:** `2fa3cd9` (clean tree at lane start). Sibling lanes K1–K9 LIVE → read fresh, log `for <lane>`.

## Item ledger (append-only — one evidence line per item: file:line → before → after)

### Z3's 10 (from `287_z3_tinyfixes.md` + K7 brief)
1. `packet.ts` systemJson decision rows — `decided_via` key — PENDING
2. `packet.ts:642` — P6 self-test label de-hardcode (`lastTest.label` + `evidenceHash`) — PENDING
3. `packet.ts` — `project.acceptance` label surfaced honestly — PENDING
4. `io.ts:511` — notes block duplicate render de-dupe — PENDING
5. `rt-client.ts:693` — `projectFile: 0`/`logDirBytes: 0` → `null` + not-measured — PENDING
6. `console.tsx:4426-4429` — `growth.counts` real producer wired (additive) — PENDING
7. `headless.ts:3455-3479` + `:3644-3653` — `spend` on `DoctorStatus`, copy `claim.spend` — PENDING
8. `rapidtool-cli.mjs:3417` — `: undefined` → `: null` — PENDING
9. `rapidtool-cli.mjs` diagnose arm — `checkpoint: {present, path, savedAt}` — PENDING
10. `AGENT_GUIDE.md` §4 — wording per G2 — PENDING

### Z5's G1 5 (from `287_z5_runtime_tail.md` Part 1) + README minors (Part 4)
11. `console.tsx:1183-1189` — heartbeat `scope:"wild-driver"` → `"sys"` (coalescing fix) — PENDING
12a. `error-component.tsx` — `ui.boundary_crash` unregistered vs twin `boundary.crash` — PENDING
12b. `PaneBoundary` wraps HomeScreen only — RunScreen unwrapped (R6-f12) — PENDING
12c. W-38 — `store.runP6Journey` zero console callers (dead edge) — PENDING
12d. R14-f04 — `DEEPEN_ACTION_NAMES` string lookup degrades silently on rename — PENDING
12e. README §10.6 heading split (78 direct + 32 subdir = 110) — PENDING
12f. README 'root 35' wording note — PENDING

## Log (append-only)

### [t0] log opened — HEAD 2fa3cd9 clean; source logs read; site reads begin

- Read: `287_z3_tinyfixes.md` (27 lines, ledger all PENDING), `287_z5_runtime_tail.md` (43 lines, Parts 1–4 PENDING),
  `284_wiring_guarantee.md` (48 lines, [t0] only), `285_g2_agent_visibility.md` (47 lines, [t0] only),
  `285_g4_operator_visibility.md` (28 lines, [t0] only). WD-1 sweep 2 confirms: Z3/Z5 patches NOT landed.
- K-lane briefs read from delegation manifest (`deleg_e1758fce`): K1 = console/routes (B1 debt), K2 = persistence,
  K3 = scripts, K4 = backends, K5 = chat UI, K6 = deepseek, K8 = records, K9 = output-truth. Console.tsx items
  (6, 11) are shared with K1's live box → surgical minimal hunks; re-read fresh immediately before patching.
