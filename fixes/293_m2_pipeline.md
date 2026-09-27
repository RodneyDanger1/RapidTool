# fixes/293_m2_pipeline.md — W40 · LANE M2 · K13'S ORDERED PATCH LIST + K12'S IN-BOX SITES

**Lane:** W40 M2 (follow-up to K13 task-3 + K12 task-2 of batch `deleg_2879dda4`). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → shell grep only).
**Mission (patch-first, ordered):** K13's list — (1) F3-10 `store.ts:1360`-class raw commit → wrap; (2) OPS-4 `cli.invocation` emit; (3) OPS-9/10 diagnose ordering/watchdog/budgets; (4) F3-16 evidence digest (spec file names). Then K12's in-box — F2-03 (compiledAtFor inputs), F2-07 (`exportProfiles` honest), F2-09 (`crewToReport` honest), F2-04 (budget boundary per card), F2-10 (crew spend seam — land or log exact seam).
**Contract:** patch-first (land item → its check); CODE + `node --check` per edited file; no gates/keyed/full runs; additive only; `TODO(<id>)` at the exact line when window-limited; log `for <lane>`.
**Baseline HEAD:** `2fa3cd9`. **Sources:** K13 log `fixes/291_k13_pipeline.md` + summary `subagent-summary-3-20260927_013043_540391.txt`; K12 log `fixes/291_k12_agents.md` + summary `subagent-summary-2-20260927_013043_538398.txt`; cards §F3/§F5 (`subagent-summary-2/4-20260926_195114_772471/775540.txt`), §F2 (`subagent-summary-1-20260926_195114_767464.txt`). Sibling lanes LIVE → read fresh before each patch.

## Ledger (append-only — evidence per item: file:line → before → after)

### [t0] open — sources + cards read; ordered plan fixed
1. F3-10 wrap · 2. OPS-4 emit · 3. OPS-9/10 diagnose · 4. F3-16 digest · 5. F2-03 · 6. F2-07 · 7. F2-09 · 8. F2-04 · 9. F2-10.

