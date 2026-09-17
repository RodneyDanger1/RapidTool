# W8 · LANE 5 — patch-integration TESTS + `fixes/216r` body

**Mission.** W7-L1 wired `applyStrReplace` into the repair path and held every baseline — but
wrote NO tests. Pin the new behavior; complete the log.

**Done-when:** `codegen.server.test.ts` gains (grow from 86): (a) unique-match delta applies via
`applyStrReplace` AND the result revalidates; (b) ambiguous/no-match deltas REFUSE with the coded
reason and the legacy full-rewrite path stays byte-identical; (c) no-patch repairs keep the
existing prompt/diff bytes. `fixes/216r` sections 1-3 complete with real output. Suites green;
typecheck 0.

**Owned:** `src/lib/codegen.server.test.ts`, `fixes/216r_patch_integration.md`.
NOT: codegen.server.ts (read-only — the wiring is L1-W7's, verified; if a genuine defect is
found, REPORT with repro, don't fix), headless (L1-W8), scripts (L3).

**Recon first:** read the W7-L1 landing (grep `216r`/`applyStrReplace`/`repairPatchRecords` in
`src/lib/codegen.server.ts` + `headless.ts`), read `fixes/216r` skeleton, then the W7-L1 summary
(`subagent-summary-0-20260917_083223_106744.txt`) for exactly what landed and what the lane said
about the test seams ("a test that wants a landed delta through repairTreeDir must inject a fake
synthesize seam that stamps a p6.repair.delta record — repairPatchRecords is exported for
exactly that").
**Verify:** `npm run typecheck`; `node --experimental-strip-types --test src/lib/codegen.server.test.ts src/lib/headless.test.ts`
(headless must stay ≥90; you don't edit it — just prove no regression). Budget death ⇒ plain state.
