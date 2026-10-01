# fixes/330_4_cartographer — Agent 4/6: Learning-Loop Engineer (330 wave)

**Status: complete.** Two owned fixes + one docblock strike + one re-proven invariant, plus the
per-function wiring verdicts (both (b) — needs its own spec) and one cross-file owed change (L4 fork).
**Tree:** `main`, HEAD `c024503`, clean at start. **Runtime:** pinned Node 22.23.2
(`C:\Users\mnril\AppData\Local\hermes\node\node.exe`).
**Spec:** `research/multiagent/112_code_judgment_and_learning.md` (T1/T2/T3/T4), re-verified against disk.
**Owned files (only these):** `knowledge.ts`, `knowledge.test.ts`, `harvest.ts`, `harvest.test.ts`,
`judgment.ts`, `judgment.test.ts`. **Only writer of this log.**

## 0. Method + disk state (disk wins)

Rebuilt every claim from bytes with a command, not from the dossier's (drifted) line numbers. Ran the
three owned suites first to freeze baselines, then probed the candidate defects with three throwaway
read-only probes at `C:\Users\mnril\_p5_probe.mjs` / `_p5_probe2.mjs` / `_p5_teeth.mjs` (outside the
repo; imported the real `.ts` via `file://` URL so nested bare imports resolve from the repo's
`node_modules`; removed after their output was captured below).

Baselines at arrival (before any edit):

| Suite | tests | pass | fail | skipped |
|---|---|---|---|---|
| `knowledge.test.ts` | 43 | 43 | 0 | 0 |
| `harvest.test.ts` | 45 | 44 | 0 | 1 |
| `judgment.test.ts` | 7 | 7 | 0 | 0 |

Caller census (command: `Select-String` over `src`,`scripts` for each symbol):

- `judgePhase` — non-test callers: **none** (only `judgment.test.ts`). Confirmed again post-edit.
- `harvestEvidenceLesson` / `harvestResultLesson` — non-test callers: **none** (only `harvest.test.ts`).
  The only production harvest caller is `headless.ts:4174` `harvest()` → `harvestForPacket`, wired to
  the read-only CLI `harvest` verb (`scripts/rapidtool-cli.mjs:2840-2868`).
- `lessonLog` — non-test callers: **none** either (a third dead path; see §2.1).

---

## 1. Per-unwired-function verdict

### 1.1 `judgePhase` (`judgment.ts:149`) → **(b) design decision; needs its own spec. NOT wired.**

Evidence (all on disk):

- The module is pure and correct on its own terms; `judgment.test.ts` **7/7** drives every rung.
- There is **no seam in the tree** that (i) holds a recorded `Project`, (ii) is advisory-only, and
  (iii) does not change a user-visible contract:
  - `packet.ts` already renders per-phase rows (`phases: [{ id, status, gate_passed, … }]`, `:210-215`)
    and `packetInputHash` (`:333`) hashes them — adding a `judgment` field **changes the packet's
    input hash and its agent-facing bytes**, i.e. a packet-version/product decision, not additive.
  - `diagnose.ts` is a pure ranking over `DiagnosisInput`; its input type carries **no `Project`** — a
    verdict ladder cannot be dropped in without widening that contract.
  - the engine's phase application is exactly the surface the module forbids: its header says
    "**never a gate input**", so the consumer must be a surface that CANNOT feed back into the engine.
- This matches the parent's own 329 note ("which rung applies at which phase … needs its own wave spec").

**No strike owed:** `judgment.ts`'s docblock never claims a caller. Grep for `caller|wired|production`
in `judgment.ts` → 0 hits. Declare-or-strike is satisfied as-is.

**Exact change if the parent later decides to surface it (do NOT blind-wire):** pick ONE advisory
surface and add a read-only projection, e.g. in `packet.ts`'s machine envelope next to `phases`
(`:210`): `judgment: judgePhase(project, phase.id)` — but that changes `packetInputHash`
(`packet.ts:333`) and therefore `PACKET_VERSION` (`packet.ts:37`), and it must be labelled advisory so
no consumer reads `pass:machine-evidenced` as a gate. That is a spec, not a call site.

### 1.2 `harvestEvidenceLesson` (`harvest.ts:714`) / `harvestResultLesson` (`:761`) → **(b). NOT wired.**

Evidence (all on disk):

- The sole production harvest seam is the **read-only** CLI `harvest` verb (`rapidtool-cli.mjs:2840`);
  it `loadProjectFor("harvest")` → `h.harvest(project)` → `harvestForPacket`, then `respond(...)`.
  **It never writes the project** (every "pillar" verb — harvest/swarm/prompt/bench/mine — is
  consult-only by contract). So there is no persisted `Project` at any harvest seam.
- `harvest` is **not part of the journey**: `engine.ts` contains **zero** `harvest` references, and
  `phases.ts`/`packet.ts`/`store.ts`/`report-intake.ts` likewise (grep → 0). The phase-completion
  lesson paths in `headless.ts` (`:1085-1185`, where `templateEmissionLesson`/`runSummaryLesson` are
  appended to `finalProject.memory`) never observe a harvest result.
- Therefore wiring the builder requires a **product decision**: either make the read-only `harvest`
  verb a writer (append the row to `project.memory` and persist the project — a contract change), or
  surface the row only in the response payload (which does NOT satisfy the stated goal — "so the next
  run knows"; the payload is ephemeral). Choosing the seam is a design call (329 recorded the same).

**Strike owed and landed (declare-or-strike):** the section header at `harvest.ts:680-688` claimed the
harvest failure "**earns a lesson row so the next run knows …**" — a wire that does not exist. Struck
and replaced with the honest statement that `harvestResultLesson` **derives** the row but no production
seam calls it yet. See `harvest.ts:680-690`.

**Exact 3-line change if the parent decides the `harvest` verb should capture (proposed, not made):**

```ts
// headless.ts — next to the existing `harvest` wrapper (:4174)
export async function harvestLesson(project: Project, outcome: unknown): Promise<MemoryEntry | null> {
  const { harvestResultLesson } = await import("./harvest.ts");
  return harvestResultLesson(project, outcome as { hits?: readonly unknown[]; notes?: readonly string[] });
}
```
then in `scripts/rapidtool-cli.mjs` (harvest arm, after `res.ok`, `:2846`) append the lesson to
`project.memory` + persist + log `lesson.capture` — **only if** the parent rules that a consult verb
may write. Without that rule the honest outcome is the strike above.

---

## 2. Defects fixed (production code, all inside owned files)

### 2.1 `lessonLog` threw into the caller it observes (`knowledge.ts:1536`) — telemetry-throw class

Pre-fix `const logs = [...p.logs];` raised `TypeError: p.logs is not iterable` on any project whose
`logs` is absent/non-array (probe output in §4). The module is otherwise junk-tolerant everywhere
(see the `R2-f05`/`M3-*` hardening comments throughout), and a lesson-capture path calling `lessonLog`
must never throw into the code it observes (AGENTS.md telemetry invariant).

Fix: `const logs = [...(Array.isArray(p?.logs) ? p.logs : [])];`.

### 2.2 `templateEmissionLesson` sliced anchors BEFORE the signature (`knowledge.ts:1208`,`:1244`) — signature/id instability

The identity rule (§4.2 rule 1) is "the sorted, deduped anchor SET". The builder did
`.slice(0, 6)` and then fed the **display** list to `failureSignature`, so once **>6** unmet ids
arrived the row id depended on **input order** — the same unmet gate forked a row (probe: forward
`…205e6449` vs reverse `…2e1f7e46`).

Fix: `allIds` (the full filtered set) feeds the signature; `ids = allIds.slice(0, 6)` still bounds the
display TEXT. For ≤6 ids nothing changes (the signature sorts → identical id); the >6 id churns only
for inputs no current caller produces (P6's DOD has exactly 6 criteria; `report-intake.ts` and
`headless.ts` pass `gate.unmet`, ≤6). It is a latent fork closed by construction, not a live regression.

### 2.3 `failureLessonFromRecord` made a FALSE claim for kind `drift` (`knowledge.ts:1500-1515`) — declare-or-strike

The terminal refusal read `no builder registered in knowledge.ts for kind 'drift'` — but
`driftLesson()` **is in `knowledge.ts`** (`:1353`). The message asserted a non-existent gap and hid the
real one (a `FailureRecord` carries no earlier-phase / hash refs, so the record path cannot reconstruct
`driftLesson`). `harvest.test.ts`/`knowledge.test.ts` never pinned the drift wording, so this is a pure
honesty repair with no test churn.

Fix: a `drift` branch (before the generic refusal) that names `driftLesson()` and the actual
reconstructability gap. The generic message is unchanged for `harvest-degraded`/`synthesis-refused`/
`rejected`, so the existing assertion at `knowledge.test.ts:1020` ("no builder registered") stays green.

### 2.4 Struck docblock claim — `harvest.ts:680-690` (see §1.2).

**Not fixed, reported as owed (cross-file):** §3.1 below.

**Checked and clean (no change):** `judgment.ts` (pure, rung order documented; no caller claim);
`failureSignature`/`canonicalAnchor`/`canonicalText` (deterministic, junk-tolerant); `provenRowsFromStore`
(catches, returns `{degraded}` — never throws); `rankBriefLessons`/`selectLessons`/`lessonOutcomeReport`/
`topLessonRows`/`lessonClassTag` all return honest floors on junk (probe §4). No `TODO(row)` shells exist
in any owned file (grep for `TODO(` → 0 hits).

---

## 3. Owed / not attempted (outside owned files)

### 3.1 L4 `verifiedProcedureLesson` id instability — the same verified procedure forks (`knowledge.ts:1303`)

**Probe (real ids):**
```
iter1 id        lesson-verified-procedure-6720963c
iter2 id        lesson-verified-procedure-a8a6d5e1   SAME? false
iter2+lint id   lesson-verified-procedure-d595c979   SAME? false
```
`verify.server.ts:1131` passes `evidence = "N/N machine-run cases passed on iteration I[; lint …]"`; the
L4 row id hashes that whole string, so the iteration count (process noise, §4.2 rule 3) forks the row.
The adjacent comment (`verify.server.ts:1130`) asserts a "**stable evidence-derived id**" — the probe
shows it is not stable across recurrences.

**Why not fixed in-lane:** the correct identity per §4.3 is the **machine-case ids** (the anchor), which
only the caller holds. I verified that the alternative in-lane fix (normalize the evidence tail) is
WRONG — it over-collapses `3/3` and `5/5` into one row (probe: both → `…7edeacad`). So L4 needs a spec +
a caller change, not a blind builder edit.

**Exact owed change (two parts):**
1. `knowledge.ts`: `verifiedProcedureLesson(project, phase, evidence, proof?: { anchors?: readonly
   string[] } | null)` — when `proof.anchors` is non-empty, hash a stable signature over
   `(phase, sorted case ids)` instead of the evidence text (this needs a `verified-procedure` signature
   kind — extend `FailureKind` or add a dedicated format string).
2. `verify.server.ts:1131`: pass the anchors — `verifyOutcomeLesson("passed", 6, evidence, i + 1,
   cases.map((c) => c.id))` (and widen `verifyOutcomeLesson` `:1986` to forward them).

### 3.2 T4 synthesis-prompt half, judgePhase seam, harvest capture seam — see §1.

### 3.3 `driftLesson` itself has no production caller either (not in my brief; noted for the board)

`driftLesson` (`knowledge.ts:1353`) is called only by `knowledge.test.ts`. E-19 drift detection mints
nothing. Same dead-wire class; needs an `engine.ts`/`verify` seam, out of lane.

---

## 4. Evidence (commands + REAL output)

**Teeth — old vs new logic side by side** (`node "C:/Users/mnril/_p5_teeth.mjs"`, read-only, outside the repo):
```
### TEETH 1 — templateEmissionLesson 12-anchor order fork ###
OLD forward id: lesson-template-emission-205e6449
OLD reverse id: lesson-template-emission-2e1f7e46
OLD forks?       true
NEW forward id: lesson-template-emission-9b0e75af
NEW reverse id: lesson-template-emission-9b0e75af
NEW forks?       false

### TEETH 2 — failureLessonFromRecord 'drift' false message ###
OLD claims no builder? true
NEW reason: drift rows are minted by driftLesson() in this module, which needs the earlier phase and both evidence-hash refs a FailureRecord does not carry — its owning writer must call driftLesson directly
NEW claims no builder? false

### TEETH 3 — lessonLog throw on a project with no logs ###
OLD `[...p.logs]` threw: bare.logs is not iterable
NEW lessonLog logs.length: 1 event: lesson.capture
```
Each new assertion detects the pre-fix behaviour: the L2 test's forward≠reverse pair goes RED on the old
formula, the drift test's `!includes("no builder registered")` goes RED on the old message, and the
`lessonLog` test throws on the old one-liner.

**Append-only invariant re-proof** (same probe — SHA-256 of the store FILE across read-only runs):
```
store bytes before: f441076b0ed38173ed285004677722046a8b55eae784aa539aca5a6dd292257d
store bytes after : f441076b0ed38173ed285004677722046a8b55eae784aa539aca5a6dd292257d
BYTE-IDENTICAL across read-only runs: true  degraded: false
```
The reads exercised: `provenRowsFromStore` + `lessonLinesForBrief` + `findPatterns` + `injectProven`.
No edit in this lane touches `savePattern`/`writeStore` — the human `lesson --accept` path remains the
store's only writer (the pre-existing `knowledge.test.ts:1044` invariant test is still green).

**Post-edit suites** (pinned Node 22.23.2):
```
knowledge.test.ts  # tests 46  pass 46  fail 0  skipped 0   (43 → 46, +3 = exactly the tests added)
harvest.test.ts    # tests 45  pass 44  fail 0  skipped 1   (unchanged — docblock-only edit)
judgment.test.ts   # tests 7   pass 7   fail 0  skipped 0   (unchanged)
```

**Typecheck:** `npm run typecheck` → `exit=0 ; TS error lines=0`.

New tests (all additive; none weakened or deleted):
- `knowledge.test.ts:724` "330 P4: lessonLog never throws into the caller …"
- `knowledge.test.ts:985` "330 P4: the L2 signature hashes the FULL anchor set …"
- `knowledge.test.ts:1040` "330 P4: a 'drift' record refuses with the TRUE reason …"

## 5. Invariants respected

- **No machine writer to the permanent `KnowledgeStore`.** No append seam added; re-proven byte-neutral
  above.
- **Telemetry never throws into observed code** — improved (`lessonLog` guard), not weakened.
- **No stemmer change** (112 T9): `git status` lists only `src/lib/harvest.ts`, `src/lib/knowledge.ts`,
  `src/lib/knowledge.test.ts` from this lane.
- **Patch-only**, no `git checkout/stash/reset/clean/commit`, no full gate run.
- **Honest limits:** the L2 >6-anchor fork is latent (no current caller passes >6 — P6 has exactly 6
  criteria); the `lessonLog` throw is unreachable through the typed `Project` but reachable for a
  hand-built/foreign payload, which is the repo's stated threat model (cf. `packet.ts` R2-f05). Stated
  plainly rather than claimed as live regressions.
