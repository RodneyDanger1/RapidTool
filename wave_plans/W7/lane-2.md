# W7 · LANE 2 — landing logs (216o + 216p) + T-107.9 compaction constants

**Mission.** Two W6 lanes landed code+tests but no log bodies; and Wave H's T-107.9 (compaction
constants) is small and self-contained. Close all three.

**Done-when:** `fixes/216o` + `fixes/216p` bodies COMPLETE (work log, commands + real results,
old→new, not-done) sourced from the W6 summaries + a fresh re-run of the owned suites; T-107.9
constants landed as a small pure module + tests (+ the one engine wiring point the dossier
names); typecheck 0; suites green (grow).

**Owned:** `fixes/216o_policy_integration.md`, `fixes/216p_provider_registry.md`,
`src/lib/engine.ts`, NEW `src/lib/compaction.ts` (?) + its test, `fixes/216r`? NO — 216r is L1's.
(If dossier 107 T-107.9 prefers a different file NAME, follow the dossier; record it.)
NOT yours: codegen/headless (L1), cli (L3), llm (L4), verification (L5).

**MINI-TASK PLAN:**
1. `216o` body from: `subagent-summary-1-20260916_220208_508348.txt` (W6-L2) — decidedVia shape
   (:180-207 types.ts), stampDecidedVia (headless :737-765, mint :837-853), provenanceConsistent
   (dod :97-112, wired :129), 6 headless pins (:1423-1552). Re-run headless + gates suites and
   paste REAL numbers (headless 90/90, gates 85/85).
2. `216p` body from: `subagent-summary-2-20260916_220208_508348.txt` (W6-L3) — registry symbols,
   the 21 tests, the three seam switches, doctor surfacing + the PARENT'S type-only import fix
   (doctor.ts :26-28) and the gate.sh glob fix that made the registry suite visible. Deferred
   hops list (codegen seam — now free but do NOT edit codegen; list it for W8).
3. T-107.9: read dossier 107 T-107.9 row; implement the compaction constants (thresholds +
   pure helpers) as the dossier specifies; wire the engine point (or explicitly defer the wiring
   with the dossier's reason); tests.
4. Verify: `npm run typecheck`; `node --experimental-strip-types --test src/lib/engine.test.ts src/lib/doctor.test.ts src/lib/headless.test.ts src/lib/gates.test.ts` (+ your new test file).
**TRAPS:** engine.ts is hot (P6/P7 phases) — additive-only changes; keep every existing log
byte identical. Docs bodies must use REAL command output only.
Budget death ⇒ plain statement of which of (1)/(2)/(3) landed.
