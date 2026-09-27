# fixes/294_n6_sweeps.md — N6 · THE NAMING + REGISTRY FINISH (K3/Q1 + K12 leftovers)

**Lane:** N6 (W40). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell `grep` only,
keep one-liners SHORT). **HEAD on entry:** `d98643f` (N1–N5 LIVE — read fresh; log `for <lane>`).
**Contract:** CODE-ONLY — no test runs, no typecheck/lint/build, no keyed calls; reads fresh. Additive only;
**never rename a pinned symbol** (`errors.test.ts` pins RT_E codes; `scaffold.test.ts` pins `deplyNotes`).
Evidence per item = `file:line` → before → after + `grep -c` reference counts before/after every rename.

**Sources:**
- `fixes/291_k12_agents.md` §B — the events settlement Z5 never landed (registered `rt-events.ts` names with no
  client emitter → classify server/CLI-emitted vs never-emitted).
- `fixes/290_k3_scripts.md` §Box/§8 — K3's naming sweep (Q1 died early; scratch at `~/w39q1_scratch/`:
  `naming-survey.mjs`, `dead-exports.mjs`, `dead-fns.mjs`, `refs.mjs`, `test-name-scan.mjs`, `sweep-rt-e.mjs`).

**Box:** `errors.ts` · `rt-events.ts` · file naming · dead-code · test-name outliers. Grep-first everywhere.

## Worklist
| # | Item | Status |
|---|---|---|
| W1 | rt-events settlement: classify all registered names vs real emitters (client/server/CLI) | PENDING |
| W2 | server-emitted names → ✓ record in this log | PENDING |
| W3 | never-emitted names → additive `TODO(<row>)` in `rt-events.ts` | PENDING |
| W4 | RT_E grammar pass: read `errors.test.ts` pins FIRST → code-shaped tokens outside registry | PENDING |
| W5 | kebab-case file-naming outliers (verify dominant convention first) | PENDING |
| W6 | dead/unused exports (zero-refs → TODO or delete-with-note) | PENDING |
| W7 | test-name outliers | PENDING |
| W8 | `deplyNotes` — pinned; alias-only if touched | PENDING |
| W9 | reference counts before/after every rename; final ledger | PENDING |

## Log (append-only)

### [t0] log opened — HEAD d98643f; both source logs are header-only (K12 logged only `[t0]`; K3's findings table had 1 row and no fixes landed)
- Recon: `src/lib/rt-events.ts` = 395 L, 56 registered names in `RT_EVENT_NAMES`
  (`grep -c '": "' `, catalogue lines 124-198). `src/lib/errors.ts` = 538 L. `errors.test.ts` = 485 L,
  `rt-events.test.ts` = 197 L.
- Q1 scratch dir `~/w39q1_scratch/` intact (6 scripts + 2 exports dumps) — will be re-run/verified, not trusted blind.
