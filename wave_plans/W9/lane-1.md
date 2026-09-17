# W9 · LANE 1 — §3 shortfall log + T-11 (lesson-capture gating)

**Mission.** Two engine-truth items. (A) §3: the production `p6.jobs.shortfall` log — the
`doctor.jobScopeShortfall()` caller the board named `⚠️` since W6. (B) T-11
(106:459): gate lesson capture on a green seal + tag each lesson with its target probe id.

**(A) done-when:** an engine run on a corpus-shaped brief (declared lattice.jobs > materialised
job nodes) appends `{phase: 6, level: "warn", event: "p6.jobs.shortfall", detail}` naming the
counts + missing labels (design: W8-L1 recon — applyPhaseResult P6 branch, engine.ts ~:1489-1493;
**engine must NOT import codegen.server.ts** — mirror the pure label derivation locally or lift a
pure helper). Zero-shortfall runs stay byte-identical. test: engine.test.ts? (no such file —
engine coverage lives in store/wild-step/packet/handoff suites + gates; add pins where the P6
branch is exercised — packet.test.ts or a new engine-shortfall.test.ts).
**(B) done-when:** a lesson is NEVER recorded from a red seal (the F-08 class: "P6 sealed with
unmet DoD" must not become a lesson); every recorded lesson carries the probe id it targets.
Locate the lesson-capture site (grep `lesson.capture` events / the `L2 template-emission lesson-`
producer in knowledge.ts/engine.ts). Tests pin both behaviors.

**Owned:** `src/lib/engine.ts` + tests (`src/lib/knowledge.ts` only if (B) lives there — check
first; W9-L4 owns token-ledger.ts + its seams; NO codegen.server.ts (L2)).
**Verify:** `npm run typecheck`; `node --experimental-strip-types --test src/lib/packet.test.ts src/lib/gates.test.ts src/lib/knowledge.test.ts`
(baselines: packet 47, gates 85, knowledge 35 — grow). Budget death ⇒ plain state.
