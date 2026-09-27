# fixes/287_z3_tinyfixes.md — W39 · LANE Z3 · THE TINY-FIXES CODER

**Lane:** W39 Z3. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell grep only).
**Mission:** land the 10 tiny fixes mapped from G2/G4 (each pre-located). CODE-ONLY — no tests, no gates, no keyed calls.
Additive-only in `console.tsx` (never remove a control).
**Baseline HEAD:** `0f85c32` + the W29–W39 uncommitted era.

## Item ledger (append-only — one evidence line per fix, file:line → before → after)

1. `packet.ts` systemJson decision rows — `decided_via` key (machine block drops seat provenance prose carries) — PENDING
2. `packet.ts:642` — P6 self-test label de-hardcode (`lastTest.label` branch + evidenceHash) — PENDING
3. `packet.ts` — `project.acceptance` label surfaced honestly — PENDING
4. `io.ts:511` — notes block duplicate render de-dupe — PENDING
5. `rt-client.ts:693` — `projectFile: 0`/`logDirBytes: 0` → `null` + "not measured" — PENDING
6. `console.tsx:4426-4429` — `growth.counts` producer wired from store lengths (additive) — PENDING
7. `headless.ts:3455-3479` + `:3644-3653` — `spend` on `DoctorStatus`, copy `claim.spend` — PENDING
8. `rapidtool-cli.mjs:3417` — `: undefined` → `: null` — PENDING
9. `rapidtool-cli.mjs` diagnose arm — `checkpoint: {present, path, savedAt}` surface — PENDING
10. `AGENT_GUIDE.md` §4 — wording per G2's note — PENDING

## Log (append-only)

### [t0] log opened — byte-state + site reads begin

- G2/G4 logs (`fixes/285_g2_agent_visibility.md`, `285_g4_operator_visibility.md`) read: both are [t0] skeletons
  (the items were pre-located in the Z3 brief — working from code as truth).
- Reading each site before patching; `node --check` on all edited files at the end.
