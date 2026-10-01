# 325 — A6 BUG-HUNTER lane (src/lib long-tail box) — W44 six-professional wave

Lane: A6 (bug-hunter, long-tail src/lib box) → A6b (FINISHER: lands the 5 hunted records). Repo: `C:\Users\mnril\Desktop\RapidTool Main`
(git-bash `/c/Users/mnril/Desktop/RapidTool Main`). Base: commit `e2fbd9d` (boundary GREEN:
scripts 365/365, lib 2513 pass) + the wave's UNCOMMITTED sibling edits. Scratch: `C:/Users/mnril/a6_scratch/`.
**KEYLESS ONLY — no keyed runs. Real code only, no mocks/stubs. Patch-only, minimal diffs.
Pins additive; never weaken. Scoped proofs only: `node --check` (Windows-style),
`node --experimental-strip-types --test <file>`, `npx eslint <files>` — never npm test/build/gate.sh.**
Sibling lanes edit their own boxes in parallel; this lane touches ONLY its box files + this log.

Box: `src/lib/knowledge.ts`, `src/lib/packet.ts`, `src/lib/prompt-engine.ts`, `src/lib/rt-events.ts`,
`src/lib/errors.ts`, `src/lib/algorithms.ts` + their tests + `src/lib` modules unclaimed by A1–A4.

Already-fixed register (do NOT re-report; map in fixes/319/322/323): lesson clips 600 + `clipLessonText`
+ truthful census + payload-survive pins, packet budget scope label, policy typo, evidenceHash docstring,
errors/rt-events touches from F-3.

## Status

- [x] A6 hunt (2026-09-30, 509 s): 5 findings byte-anchored + keyless-repro'd; ZERO fixes landed (iteration cap).
- [x] A6b log-first: full record below written BEFORE any src edit.
- [ ] A fix + pin
- [ ] B fix + pin
- [ ] C fix + pin
- [x] D re-verification: **NOT REPRODUCED — false positive; no code change needed** (evidence §D)
- [ ] E adjudication + pin
- [ ] Scoped proofs (`node --check` × files, strip-types suites, eslint)
- [ ] Close + END marker

## Bug records

### BUG A — compileAgentPacket/packetInputHash crash on junk COLLECTION containers — HIGH
**id/severity**: A · HIGH (crash on foreign payloads; the throw exits through the store's
`seedIfEmpty` → rehydrate catch → `recoverFromCorruptPersistence` (store.ts:973/:982) — the W29
R2-f01 whole-store-wipe class, now reachable from a hand-edited/imported junk collection).
**evidence (byte anchors, packet.ts @ e2fbd9d+wave)**: `researchHash` :61 (`project.research ?? []`),
`compiledAtFor` :257/:262 (logs/decisions), `packetInputHash` :306/:307/:309/:316 (logs/decisions/
artifacts/memory), `compileAgentPacket`: :595 (`memoryRows` → countIdCollisions :82 via :640),
:772 crew, :776-779 contracts entities/endpoints, :781 oracle, :826-828 specGraph order/nodes,
:694-695 researchSources, :924-926 scorecard axes/bottlenecks/attackVectors.
**repro (fresh at fix time, `a6b_sites.ts`)**: 12 throwing compile shapes — `memory:{}`, `memory:42`,
`crew:{}`, `research:{}`, `oracle:{}`, `contracts:{entities:{},endpoints:{}}`,
`specGraph:{order:{},nodes:{}}`, `specGraph:{order:["a"],nodes:{}}`, `logs:{}`, `decisions:{}`,
`artifacts:{}`, `scorecard:{axes:{},bottlenecks:{},attackVectors:{}}` (headline "11" = its 11 rows;
specGraph had two anchored variants) — plus 4 `packetInputHash` shapes (memory/logs/decisions/
artifacts `{}`), plus 2 fix-time extensions (`lattice:{jobs:{}}` throws at :632; the same container
also shadows :812-814). Exact frames recorded in the A6 transcript (`task-5.log:90`) and re-sampled
live: `countIdCollisions :82 ← :640` · `compiledAtFor :257/:262 ← :745` · `packetInputHash :306-316`
· `crew :772` · `researchSources :695` · `contracts :776` · `oracle :781` · `specGraph :827/:828`
· `scorecard :924`.
**fix**: Array.isArray coercion at every site, mirroring the M3-14 idiom already 10 lines above each
(existing `decisionRows`/`phaseRows`/`artifactRows` guards); junk reads as the empty form → honest
placeholders (crew/contracts/oracle/spec-graph/memory lines already exist). Extensions: `lattice.jobs/
entities/constraints` joins (:632, :812-814) + `profileScopeFiles` :1057-1058 (same `?? []` class,
fix-time discovery).
**pin**: packet.test.ts M3 block extension (M3-18).
**proof**: packet suite + `node --check`. (fill after landing)

### BUG B — intentLattice leaks the RAW `domain` onto the lattice — MED
**id/severity**: B · MED (junk domain propagates: `bootstrapMemory` (:967) prints `Domain null;`
into memory text; consumers reading `lattice.domain` get null/42 instead of the coerced default).
**evidence**: `algorithms.ts:379-383` coerces `dom` internally, `:443 return { domain, … }` returns
the raw param — the last raw-domain site of the class (W40 N1 fixed planSpecGraph/scheduleConstraints,
:703/:638).
**repro (`p1_hostile.ts`)**: `intentLattice("scan barcode", null)` → `lattice.domain === null`;
`("", 42)` → `42`; `runAlgorithms({brief, domain:null})` → `out.lattice.domain === null`.
**fix**: `domain: dom` (one line).
**pin**: algorithms.test.ts beside the M3-17/H1 probe (:765-776).
**proof**: algorithms suite + `node --check`. (fill after landing)

### BUG C — acceptedLessonEntry class resolver misses the `probe:` skip — MED
**id/severity**: C · MED (learning-integrity: a probe-tagged row titles as `Lesson L2
probe:p6-brief-fit` and the accepted store row LOSES its real class tag → unclassed in
`lessonOutcomeReport`; the exact on-disk W16 bug lessonClassTag's docstring (:1569-1582) documents).
**evidence**: `knowledge.ts:1882-1884` re-implements the class-tag resolver WITHOUT
`lessonClassTag`'s `probe:`/`actor:` skips; the shared classifier :1569-1582 exists right above.
**repro (`p4_accept.ts`)**: `templateEmissionLesson(p, 6, ["p6-brief-fit"], [], "abc12345", "engine")`
→ tags `[L2, lesson, probe:p6-brief-fit, template-emission]`; `lessonClassTag` → `template-emission`
(correct); `acceptedLessonEntry` → title `Lesson L2 probe:p6-brief-fit`, tags lose
`template-emission`, carry `probe:`; a plain row titles correctly (`Lesson L2 template-emission`).
**fix**: use `lessonClassTag(rowTags)` (one classifier, `lesson --list` parity) + docstring note.
**pin**: knowledge.test.ts inside "M-tier lesson surface" describe beside the accept-core :750 block.
**proof**: knowledge suite + `node --check`. (fill after landing)

### BUG D — rt-events census comment (REPORTED "23 emitted / 37 dead") — RE-VERIFIED: NOT REPRODUCED
**id/severity**: D (as reported, LOW) · **falsified at fix time — no defect, no edit.**
**re-verification (A6b, live tree)**: the in-file census (:217-259) claims catalogue 60 · emitted 22 ·
dead 38 with a 38-name dead list. Two independent implementations of the comment's own method
(non-test `event: "<name>"` literal emits under src/ + scripts/, read-side matches excluded):
(a) skill script `event_emitter_sweep.py --census` → `NEVER-EMITTED: 38 of 60`, list byte-equal to
the comment; (b) the exact prior re-count script `~/a5_census.py` → `catalogue=60 emitted=22 dead=38`,
dead list name-for-name identical. `wild.driver_error` / `boot.start` / `boot.ready` have ZERO
non-test emitters (only registry lines + TEST fixtures: `rt-timeline.test.ts:130` `eventLine({event:
"wild.driver_error"…})`, `:93` boot fixtures — test fixtures do NOT count per the comment's own
criterion). The A6 "23/37" most likely counted those test fixtures (`task-5.log:109-110` shows an
unfiltered scan with test-file hits like `llm.timeout ×8`).
**fix**: none — comment is accurate; silently "correcting" it would have corrupted a truthful record.
**pin**: none needed (no behavior change). Method + output recorded here as the disposition.
(The A6 skill reference `hostile-shape-throw-triage.md §8` repeated the wrong claim and was patched
with this falsification.)

### BUG E — EXPAND_LESSON_MAX_CHARS=240 vs the 600-char record cap — LOW (adjudication)
**id/severity**: E · LOW (advisory prompt path only; cut is marked; record keeps the payload).
**evidence**: `prompt-engine.ts:69-73` — lesson rows are ≤ `LESSON_TEXT_MAX` (600, raised by 322 X3)
by construction, yet the per-line prompt re-cap is 240 (:173-174) → a legal 500-char row reaches the
expansion model cut, re-severing the tail X3 preserved for the RECORD. Behavior pinned
(`prompt-engine.test.ts:361-381`).
**adjudication (owner decision on record)**: KEEP 240. 322 X3's own coupling sweep already ruled it:
"the per-line prompt re-cap stays at 240 WITH its explicit `[TRUNCATED]` marker … **No prompt-cap
change (record vs prompt are different budgets)**" (`fixes/322_x3_fixes.md` §Coupling sweep,
:231-234 — same wave era, exact tension). Reversing a documented decision without cause would be
worse than keeping it; the cut is honest (marker) and the record keeps the full payload. The remaining
gap was that the rationale never reached the code site → fix = comment parity.
**fix**: rationale comment at `EXPAND_LESSON_MAX_CHARS` + a pin making the deliberate differential
explicit (a 500-char row — legal in-record — is still cut at the prompt cap WITH its marker).
**pin**: prompt-engine.test.ts beside :361.
**proof**: prompt-engine suite + `node --check`. (fill after landing)

## Applies

(pending — filled per bug as landed: bytes → repro → fix → pin → proof)

## Closure (parent-appended 2026-09-30; lane A6c capped after landing ALL fixes + pins + proofs; log close owed)

**Applies (all on disk, all proven):**
- **BUG A — `packet.ts` 14-site `Array.isArray` guard set** (11 hunks, M3-14 idiom): `researchHash` (list + each `entry.items`), `compiledAtFor` (logs/decisions), `packetInputHash` (logs/decisions/artifacts/memory), `memoryRows`, `lattice.jobs` (fusionRank string), `researchSources`, crew, `contracts.entities`/`endpoints`, `oracle`, lattice jobs/entities/constraints render, `specGraph.order`/`nodes`, `scorecard.axes`/`bottlenecks`/`attackVectors`, and `profileScopeFiles` order/nodes (fix-time discovery).
- **BUG B — `algorithms.ts`:** coerced-domain return (landed by A6b).
- **BUG C — `knowledge.ts`:** `cls` one-liner `const cls = lessonClassTag(rowTags);` — docstring/code mismatch closed.
- **BUG E — `prompt-engine.ts`:** comment states the deliberate differential (prompt re-cap stays 240 vs record 600; cut marked; `fixes/322_x3_fixes.md` §Coupling sweep cited). No cap change.
- **BUG D — FALSIFIED; no code change** (two independent re-counts; comment truthful).
- **Pins:** `packet.test.ts` M3-18 (14 shapes + empty-form honesty + exportProfiles wrap + inputHash byte-equality) · `algorithms.test.ts` (coerced-domain) · `knowledge.test.ts` M-tier (probe-tag class) · `prompt-engine.test.ts` (500-char legal row cut WITH marker).

**Fresh proofs (A6c-run + parent gate):** `node --check` 7/7 edited files OK; junk-shape compile verified post-fix (`a6b_sites_post.txt`); suites green — packet/algorithms/knowledge/prompt-engine (counts in the final gate: testsScripts 367/367 · testsLib **2548 pass** · typecheck 0 · lint 0 · build 0, `v7_gate.log`).
**Noted leftover:** one second-order `contracts` shape remains unguarded (recorded; non-crashing class). Scratch backup `a6_scratch/packet_a6c_fixed.bak` = harmless.

=== END 325_a6_hunt — COMPLETE (parent-completed; hunter A6 + finishers A6b/A6c edits; proofs A6c-run + parent-gate) ===
