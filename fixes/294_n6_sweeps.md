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
- Recon: `src/lib/rt-events.ts` = 395 L, 55 registered names in `RT_EVENT_NAMES` (**corrected by P4
  — was 56; full re-census in `fixes/295_p4_sweeps.md`**)
  (`grep -c '": "' `, catalogue lines 124-198). `src/lib/errors.ts` = 538 L. `errors.test.ts` = 485 L,
  `rt-events.test.ts` = 197 L.
- Q1 scratch dir `~/w39q1_scratch/` intact (6 scripts + 2 exports dumps) — will be re-run/verified, not trusted blind.

### [P4] tail landed (`fixes/295_p4_sweeps.md`) — census re-run + TODOs written + naming/docs swept

- **Census re-run on `ac6b151` bytes: 55 registered / 17 emitted / 38 never.** The count MOVED since
  N6's read: N5's OPS-4 landed `event: "cli.invocation"` (`rapidtool-cli.mjs:163`, payload
  `{cmd, exitCode}`), so the never-set is **38**, not 39. The rest of N6's verdict stands
  (0 server/CLI-emitted under their exact names; the 38 read-side-only refs re-verified).
- **W3 landed:** grouped `TODO(N6-W3)` block under the catalogue in `rt-events.ts` (38 names, census
  + row id named). **W6 landed:** dead-export TODOs beside `RtScope` / `WILD_STEP_AUTOPAUSE_MS` /
  `LONGTASK_*` (all P4-recounted at 0 external refs). **W8 landed:** `deployNotes` alias in
  `scaffold.ts` (pin untouched — `deplyNotes` NOT renamed).
- **W4/W5/W7 re-verified — no renames:** RT_E grammar clean; the 11 test-name outliers are
  false positives (N6's byte verdict stands); `scripts/README-cli.test.mjs` rename **refused** —
  referenced by **55** `.md` files (pure churn, zero functional gain).
- K3/Q1 caveat N6 recorded stands: dead-code detection still owes the "refs outside
  errors.ts + README" variant.
