# fixes/307_b1_pipeline.md — B1 · BACKEND/PIPELINE WIRING SWEEP I

> Wave 307 · B-lane. HEAD `84784b5` (F-wave rewrite landed). Box (sole writer): `src/lib/engine.ts` ·
> `src/lib/store.ts` · `src/lib/headless.ts` (+ colocated tests). U2 owns rt-* · B2 owns packet ·
> B3 owns rt-events. Mandate: bugs/non-wired/partial only — no new features. No keyed calls.
> Legs foreground. Evidence per fix. (Log opened pre-edit per wave brief — 2026-09-29, B1.)

## 0 — Status board

| Item | Status |
|---|---|
| Early log | DONE (this file) |
| §1 Study F5's 306 spec + HEAD diff (WildStepSummary surfaces) | IN PROGRESS |
| §2 Consume-check: store commit / headless surface / packet | TODO |
| §3 Non-wired seams: grep new engine fields (summary/action) for consumers | TODO |
| §4 Park/resume: why+unlock+re-entry end-to-end | TODO |
| §5 wild.step_* events fire on real paths (emit guard) | TODO |
| §6 Red/regression fixes at cause | TODO |
| §7 Evidence ledger | TODO |
