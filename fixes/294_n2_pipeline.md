# fixes/294_n2_pipeline.md — N2 · THE PIPELINE PASS (W40 §3-D)

**Lane:** N2 (= K13/M2 continuation; source: `fixes/291_k13_pipeline.md` + `fixes/291_k12_agents.md` + W40 §3-D `wave_plans/W40/CONTINUE-PROMPT.md:21`). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → shell grep only; one-liners SHORT).
**Contract:** PATCH-FIRST — land the smallest honest patch per item, then its check; `node --check` each edited file; no gates/keyed calls/full runs; additive only; `TODO(<id>)` at the exact line when window-limited; log `for <lane>` handoffs.
**Box:** `store.ts` · `engine.ts` · `packet.ts` · `crew.ts` · `crew.server.ts` (NOT cli — N5's). Sibling lanes N1/N3–N6 LIVE → read fresh before each patch.
**Baseline HEAD on entry:** `d98643f` (N1 `fixes/294_n1_throws.md` + N6 `fixes/294_n6_sweeps.md` present, untracked; tree otherwise clean).

## Ledger (append-only — evidence per item: file:line → before → after)

### [t0] open — sources read; ordered plan
Sources read in full: `fixes/293_m2_pipeline.md` (M2 t0 skeleton only — zero landings), `fixes/291_k13_pipeline.md` (t0 only), `subagent-summary-3-20260927_013043_540391.txt` (K13's byte-verification), `fixes/291_k12_agents.md` (t0 only), `subagent-summary-2-20260927_013043_538398.txt` (K12's byte-check), F3 cards (`subagent-summary-2-20260926_195114_772471.txt`), F2 cards (`subagent-summary-1-20260926_195114_767464.txt`), W40 §3-D.
Order: 1 F3-10 · 2 F3-16 · 3 F2-03 · 4 F2-04 · 5 F2-07 · 6 F2-09 · 7 F2-10.
