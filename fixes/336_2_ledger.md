# 336-2 "Ledger" — W50: resume wiring, state integrity, no silent loss

Lane log (append-only). Repo `C:\Users\mnril\Desktop\RapidTool Main` (the path HAS A SPACE).
HEAD at open **`fac37d4`**, tree clean except `?? wave_plans/W50/`. Pinned Node **22.23.2**
(`%LOCALAPPDATA%\hermes\node\node.exe`); host Node **24.15.0**; every parsed `node --test` run used
`--test-reporter=tap`. Owned files (STRICT): `src/lib/headless.ts`, `src/lib/io.ts`,
`src/lib/doctor.ts`, `src/lib/token-ledger.ts`, `src/lib/checkpoint.server.ts` + their tests. Scratch
under `%TEMP%\rt336_2*`. No keyed calls, no `npm run eval`, no full gate (five siblings mid-edit).
`engine.ts` (336-1), `types.ts` (unowned), `scripts/**` (336-4) were **not edited**.

---

## 0. Step 0 — claimed / on disk / still open

### Read first
`fixes/332_2_ledger.md`, `fixes/334_2_ledger.md`, `fixes/335_2_ledger.md`, `fixes/335_0_parent.md`,
`fixes/335_7_guardian.md`, `wave_plans/W50/README.md`, `fixes/281_n2_ckpt.md` (the checkpoint's origin).

### Claimed (prior lanes) → on disk at HEAD (re-verified today)
- `token-ledger.ts`: `SpendSlice`, `normalizeLedger`, `accumulateSpend`, `spendDelta` — present.
- `headless.ts`: `runUntilGate` spend fold; `RunResult.code` (:822); `keyedTrailOutcome`;
  `foldInvocationEvidence`; `resolveDoctorSpendSource`; `resolveDoctorKeyState`; `commitRunCheckpoint`
  (:850); `loadResumableCheckpoint` (:888); `checkpointSupersededBy` (:969); `repairTreeDir` (:3591).
- `doctor.ts`: `doctorSpend`, `isKeyUnusableCode`, `readLastKeyedOutcome`, `doctorLlmKey`.
- `io.ts`: `importProject` `opts.maxChars`; `loadProject` passes `+Infinity`.
- **Claim-vs-bytes divergence: none.** Every falsifiable claim reproduced.

### Baseline (real `node --test`, Node 22.23.2)
`headless.test.ts` 138 · `io.test.ts` 61 · `doctor.test.ts` 31 · `token-ledger.test.ts` 39 ·
**`checkpoint.server.test.ts` 18** (the register asked for its count → **18**).
`npx tsc --noEmit` 0 in my files; `npx eslint` on all owned files exit 0.

### Still open at HEAD (`file:line`) — this pass's work
1. **(a) no automated test reached the resume seam.** `headless.ts:888 loadResumableCheckpoint`
   (read→admit→hydrate→re-entry) had **zero test coverage**; only CLI probes from W36. TODO this pass.
2. **(d) retry drops the gate record.** `headless.ts:969 checkpointSupersededBy` handled a REJECTED
   file (blocked / edge `rejected`) but not a RETRIED edge — `retry` (`scripts/rapidtool-cli.mjs:1739`)
   unlocks the edge to `ready` and KEEPS `rejectionHistory`, while the snapshot predates both. Resume
   then rewound the file and dropped the rejection + its decision. FIX.
3. **(d) non-drive mutation drops artifacts.** `ingest` (`scripts/rapidtool-cli.mjs:1757`) appends
   artifacts at the current edge without refreshing the snapshot; `resume` rewound them away. FIX.
4. **(c) atomic-write `fsync`** (`checkpoint.server.ts:11`, `headless.ts:237 saveProject`) — the named
   limit from W49; decide land-or-report this pass.
5. **(d) `repair` never writes/clears the checkpoint** (`headless.ts:3591 repairTreeDir` has no
   `checkpointDir`; the CLI saves the ledger at `scripts/rapidtool-cli.mjs:2600-2610`). Named, not
   probed (keyless floor carries no `generatedTree` — see §5).

_Work log continues below (appended, never rewritten)._

---

## 1. (a) The resume path — wired and proven from a fresh process

The path is real and was already wired by W36 (`commitRunCheckpoint` on every moved loop iteration +
the CLI `resume`/`unattended` arms at `scripts/rapidtool-cli.mjs:1272`/`:1361`). This pass **proves**
it end to end with real CLI probes (each verb a fresh process) and **pins it** with new tests.

Probe recipe (keyless: run the CLI from a scratch cwd so the repo `.env` is not loaded):
`create --brief … --advisory` → `gate` (parks at the stock P4 HITL gate, exit 2) → `resume`.

### Happy path — re-entry at the recorded phase (fresh process)
```
gate   exit=2   checkpoint: run={"phase":4,"step":0,"mode":"keyed"} artifacts=11
file   phase=4 status=awaiting_hitl artifacts=11
resume exit=2   envelope: ok=true resumed=true resumedFrom={"phase":4,"step":0} ageMs=1996
file   phase=4 status=awaiting_hitl artifacts=11
```

### Crash-recovery — decisive (the file was rewound; the snapshot is the truth)
A file rewound to `phase=2` with a SENTINEL artifact set, same id, snapshot at P4:
```
resumed=True resumedFrom={"phase":4,"step":0}
after resume: phase=4 sealed=4 artifacts=11
sentinel still present: False
```
The file's P2 state and its sentinel are GONE and the snapshot's 4 sealed phases + 11 artifacts are
restored — so the drive re-entered at the **recorded P4**, not at the file's P2.

### Refusal paths (all coded, never silent, exit 1)
| Probe | Result |
|---|---|
| keyless process resumes a `keyed` snapshot | `RT_E_VALIDATION · checkpoint: mode mismatch (saved keyed, asked keyless)` |
| a different-id file in the snapshot's dir | `RT_E_VALIDATION · checkpoint: project mismatch (<snapshot id>)` |
| corrupt `checkpoint.json` (`{not json`) | `RT_E_VALIDATION · checkpoint: not JSON (…)` |
| no checkpoint at a real path | `RT_E_CHECKPOINT_MISSING · checkpoint: none at <path>` |
| file already advanced past the snapshot (approve → P5) | `resumed:false ignored:true superseded:true` + reason naming P5>P4 — drives from the FILE (ignore-with-notice), never rewinds |
| snapshot with no phase record for the recorded phase | unit-pinned A20 `RT_E_VALIDATION` (§3) |

### Tests added (§3) — `checkpoint.server.test.ts`, `describe("336-2 — the resume seam…")`
Six pins: happy (re-entry phase + hydrated `_v:2` + `savedAt`), identity mismatch, mode mismatch,
A20 (no phase record), missing, junk bytes. These run in-process; the CLI probes above carry the
fresh-process half.

---

## 2. (b) No state is lost in the record — byte-identical save→load→re-save

### Real driven record, real CLI
Drove an advisory run to **P12 complete** (approving each stock HITL park; no keyed call):
`currentPhase=12 status=complete artifacts=32 logs=51 decisions=5 memory=18 phases=13 openapi=true`.
Round-trip probe (`loadProject` → `exportProjectJson` → `saveProject` → `loadProject` → export):
```
original===load1 : true
load1===load2    : true
keys DROPPED by load : []
keys added by load   : ["generatedTree"]   (a key whose value is undefined — JSON omits it, bytes equal)
artifacts : array[32]  logs : array[51]  decisions : array[5]  memory : array[18]  phases : array[13]
```
No top-level field the pipeline wrote is dropped, and the record re-serializes **byte-identically**
(`exportProjectJson` is `JSON.stringify(project, null, 2)`).

### Fields recent waves added + legacy migration
Already pinned by W49 in `headless.test.ts:3750` (a driven record + injected
`tokenUsage = {…calls:12,cachedPromptTokens:5}` and `lastKeyedOutcome` round-trip lossless/byte-equal)
and `:3782` (a legacy record with both fields DELETED still loads, both stay **absent** — never
fabricated — and `_v` migrates 1→2 in place). This pass re-confirmed the mechanism on the full P12
record above; the two fields persist through `hydrateProject`'s `...raw` spread. No new defect found
here — a clean result.

### Checkpoint snapshot round-trip (new pin, §3)
The snapshot is bounded by design (`CHECKPOINT_CAPS`, `checkpoint.server.ts:57`); for a project below
the caps the phase records, their gate verdicts, and the artifacts survive
`writeCheckpoint → loadResumableCheckpoint` unchanged (pinned).

---

## 3. (d) No park / retry / repair path drops a phase's artifacts or its gate record

### PARK — preserved
Measured after a normal park (P4 and P8): checkpoint and file array counts are EQUAL
(P8: `cp=20 artifacts/32 logs/13 memory/2 decisions` == `file=20/32/13/2`). `resume` restores the
snapshot's phase records (with `gate` verdicts) and artifacts — the crash-recovery sentinel probe
(§1) is the decisive evidence. Pinned by the new "snapshot round-trip keeps every phase record, its
gate verdict, and the artifacts" test.

### RETRY — a real defect, FIXED
**Root cause (bytes).** `reject` flips the file edge to `rejected`/`blocked` (caught by axis 6);
`retry` (`scripts/rapidtool-cli.mjs:1739` → `headless.retry`) unlocks it to `ready`/`running` and
KEEPS `rejectionHistory`, and **neither verb updates the per-phase snapshot**. The pre-fix
`checkpointSupersededBy` read the retried shape as equal on every axis, so `resume` re-drove from the
stale pre-rejection snapshot.

**Live keyless repro (before):**
```
BEFORE resume: status=running edge=ready rejHist=1 decisions=1
resume exit=2  envelope resumed=True
AFTER  resume: status=awaiting_hitl edge=awaiting_hitl rejHist=0 decisions=0   ← LOST
```

**Fix** (`headless.ts`, `checkpointSupersededBy` axis 7): if the file's re-entry-edge
`rejectionHistory` is longer than the snapshot's, the file holds human history the snapshot cannot
describe → superseded. **After:**
```
resume export: resumed=False ignored=True superseded=True
reason=the project file records 1 rejection(s) at P4 the snapshot predates — resuming would drop the rejection record
AFTER resume: status=awaiting_hitl edge=awaiting_hitl rejHist=1 decisions=1   ← preserved
```

### NON-DRIVE MUTATION (`ingest`) — a real defect, FIXED
**Root cause.** `ingest` appends artifacts/logs/memory at the current edge
(`headless.ingestResult`), never touching the snapshot. Pre-fix verdict `superseded:false`; `resume`
rewrote the file from the snapshot.

**Live keyless repro (before):**
```
park P4, 11 artifacts → ingest (status partial, 1 artifact) → 12 artifacts, hasIngest=True
resume → resumed=True → 11 artifacts, hasIngest=False   ← the ingested row LOST
```

**Fix** (`headless.ts`, axis 8): when the snapshot is below its bound, any of
`artifacts`/`logs`/`decisions`/`memory` carrying MORE rows than the snapshot means the file holds work
the snapshot does not → superseded. (The axis is skipped once the snapshot is AT its bound: a trimmed
snapshot is a suffix, so counts are not comparable — stated in the docblock.) **After:**
```
resume → resumed=False ignored=True superseded=True
reason=the project file carries 12 artifacts row(s) — more than the snapshot's 11; the file holds work the snapshot does not
AFTER resume: 12 artifacts, hasIngest=True   ← preserved
```
`retry`/`ingest` are CLI arms that save the ledger directly; the fix lives entirely in my
`headless.ts` — **no `scripts/**` edit required**.

### REPAIR — named, not probed (STOP-and-REPORT, §6)
`repairTreeDir` (`headless.ts:3591`) never writes or clears a checkpoint, and the keyless floor does
not produce `generatedTree` (the P6 synthesis that writes it is keyed), so the repair→resume clobber
could not be reproduced without a keyed call. The new growth axis (axis 8) will catch a repair that
GROWS the bounded arrays (repair mints a gate record + logs), but a repair that only rewrites
`generatedTree`/`lastTest` at unchanged array sizes, on a project already at a cap, is not provably
covered. Reported with the proposed wiring.

---

## 4. (c) The atomic-write `fsync` question — named limit, not landed

Both atomic writers (`checkpoint.server.ts:228 writeFileSync(staging)` → `renameSync`, and
`headless.ts:237 saveProject`) write a temp and rename; **neither fsyncs**. A process kill is already
safe (the rename is the atomic step; the interrupted-save pins in `headless.test.ts:291` prove a
half-written temp is inert and the original survives). A **power loss between the write and the
rename** can still lose the newest bytes; that is the named limit, already stated at
`checkpoint.server.ts:11`.

**Decision: do NOT land an fsync.** It cannot be made observable by a test or a probe:
- durability across a power cut is not observable in-process, and there is no seam to inject a crash
  at the power boundary;
- Node does offer `fs.writeFileSync(file, data, { flush: true })` (fsync-on-write), but a test that
  asserts the option/`fsyncSync` was CALLED is a mock asserting a call, not durability — forbidden by
  the no-mock rule and unable to fail on the real property;
- the only honest verification is an OS-level power-cut harness, which this box cannot provide.

Per the RED-first law ("land it only if you can make it observable"), the change stays unlanded; the
limit is stated, not over-claimed. `saveProject` shares the same shape and the same limit.

---

## 5. Mock / fake / placeholder census over owned files

Regex counts on the five production files (2026-10-02):
```
headless.ts: as-any=0 ts-ignore=0 catch-empty=0 todo=3 skip=0
io.ts:       as-any=0 ts-ignore=0 catch-empty=0 todo=2 skip=0
doctor.ts:   as-any=0 ts-ignore=0 catch-empty=0 todo=5 skip=0
token-ledger.ts: as-any=0 ts-ignore=0 catch-empty=0 todo=0 skip=0
checkpoint.server.ts: as-any=0 ts-ignore=0 catch-empty=0 todo=1 skip=0
```
Test files: zero `as any`, zero `@ts-ignore`/`@ts-expect-error`, zero skipped tests.

**Every hit is honest, none is code.** The `TODO` rows are documented open gaps or references to the
emitted-stub vocabulary, not placeholder bodies: `TODO(R13-f02)` (headless wild-classifier review),
`TODO(A1-25)` (io's too-large message code, docblock), and `doctor.ts`'s `stub` hits are the
JOB-KIND vocabulary that DETECTS emitted `TODO(E-15)` stubs (`isStubJob`). No `catch {}` is empty —
every catch carries an explicit best-effort comment or a coded refusal (`checkpoint.server.ts` staging
sweeps are bounded to `checkpoint.json*`). **Census clean; no finding.**

---

## 6. Tests added — real results on both runtimes

`npx eslint` on all owned files → exit 0 / 0 warnings. `npx tsc --noEmit` → 0 diagnostics in my files
(the one transient error was `src/lib/phases.test.ts` — sibling 336-1 mid-edit).

| suite | baseline | after | Node 22.23.2 | Node 24.15.0 |
|---|---|---|---|---|
| `src/lib/checkpoint.server.test.ts` | 18 | **27** (+9) | 27 pass / 0 fail / 3 suites | 27 pass / 0 fail / 3 suites |
| `src/lib/headless.test.ts` | 138 | 138 (unchanged) | 138 pass / 0 fail / 40 suites | 138 pass / 0 fail / 40 suites |
| `src/lib/io.test.ts` | 61 | 61 | 61 pass / 0 fail | included in 158 |
| `src/lib/doctor.test.ts` | 31 | 31 | 31 pass / 0 fail | included in 158 |
| `src/lib/token-ledger.test.ts` | 39 | 39 | 39 pass / 0 fail | included in 158 |

checkpoint + io + doctor + token-ledger together: **158 pass / 0 fail** on both runtimes.

Added (+9), all in `checkpoint.server.test.ts`:
1. **336-2 retry** — a retried edge carrying `rejectionHistory` is superseded (RED-first: pre-fix
   `superseded:false`, post-fix `true`). A never-rejected `ready` edge stays resumable.
2. **336-2 growth** — a file that gained artifacts since the snapshot is superseded (RED-first).
3. **resume happy path** — re-entry at the recorded phase, project hydrated (`_v:2`), `savedAt` > 0.
4. **resume preservation** — the snapshot keeps every phase record, its gate verdict, and the
   artifacts.
5. **resume identity mismatch**, 6. **mode mismatch**, 7. **A20 no phase record**,
   8. **no checkpoint → MISSING**, 9. **junk bytes → VALIDATION**.

RED-first, shown both ways: the two fix tests failed `1/19` and `1/27` respectively against the
pre-fix `headless.ts` (verified by running before the fix) and pass after. Both fixes were also
re-verified end to end by the live CLI probes in §1/§3.

---

## 7. STOP-and-REPORT (cross-boundary)

1. **`repair`/checkpoint staleness** (`headless.ts:3591 repairTreeDir` writes no checkpoint). The
   full repair path needs a keyed P6 (`generatedTree`), which this wave forbids. Proposed fix, owner
   of `scripts/**` (336-4) + me: add `checkpointDir?: string` to `repairTreeDir`'s opts and a
   `commitRunCheckpoint(dir, res.project)` at its boundary; the CLI `repair` arm passes
   `dirname(resolve(path))` (one line, next to the existing `h.saveProject(path, res.project)` at
   `scripts/rapidtool-cli.mjs:2610`). Reported, not landed (unverifiable keyless).
2. **Snapshot bound is a hard ceiling.** A project already AT a `CHECKPOINT_CAPS` bound (e.g. ≥120
   artifacts) cannot use the growth axis; a mutation on such a project is not provably preserved.
   Named limit, not hidden.
3. **`scripts/**` untouched.** No CLI edit was needed for the two fixes (they live in
   `checkpointSupersededBy`). No request needed.
4. **`engine.ts` / `types.ts` untouched** (336-1 / unowned).

## 8. What I did NOT do, and why
- **Did not edit `engine.ts` (336-1), `types.ts` (unowned), `scripts/**` (336-4)** — the fixes are in
  my files; the repair wiring is requested above.
- **Did not `fsync`** — unobservable; the named limit is stated (§4).
- **Did not run the full gate, `npm test`, `npm run build`, `npm run eval`** — targeted suites only,
  five siblings mid-edit; the parent runs the boundary gates.
- **Did not make a keyed call, and no secrets printed** — every probe ran keyless (scratch cwd, no
  `.env`); only `resumed`/`resumedFrom`/counts and tail-only labels were inspected.

---

# Follow-up (same lane) — 336-3's chain defect: the record's OWN Agent Packet was stale after the P6 mint

Granted for this pass: `src/lib/codegen.server.ts` (surgical only). `scripts/**` stays 336-4.
Scratch `%TEMP%\rt336_2b\`. No keyed call; no full gate; existing tests stay green.

## F1. Recon + reproduction (my own probe, not cited)

`%TEMP%\rt336_2b\probe-packet.ts` — keyless; `driveP6Journey` entered with the documented
`deps.synthesize`/`deps.runTree` seams injected, the MINT (`codegen.mintTreeRunTested`) and the GATE
(`dod.recordGateInto`) are the REAL functions. Path A (raw mint→gate link) and Path B (the journey):

```
BEFORE (HEAD bytes)
A stale===fresh            : false
A stale has evidenceHash   : false      ← the record's own packet lacks its minted hash
A stale has machine-verified: false
A fresh has evidenceHash   : true
B outcome                  : converged
B record packet has hash   : false      ← the persisted record's packet predates its own mint
B record packet == fresh?  : false
```

**Root cause (bytes).** `mintTreeRunTested` (`codegen.server.ts`) and `recordGateInto` (`dod.ts`)
return a project with new `lastTest`/gate state but never recompile `project.packet`;
`driveP6Journey`, `repairTreeDir(recordGreen)`, `promoteEmittedTreeTested` and `store.runP6Journey`
propagated it unchanged, so the shipped record's `.rapidtool/project.json` carried a packet whose P6
line and DoD section predated the `tested` stamp written beside it.

## F2. The fix (item 1 — recompile on every verification-state path)

- **`headless.ts` `driveP6Journey`**: after the mint + the real gate record, `stampPacket(finalProject)`
  (the SAME builder every other stamp site uses — no second builder); and a final `stampPacket` after
  the `p6.journey.converged` log so the returned record's packet is byte-identical to a fresh compile.
- **`headless.ts` `repairTreeDir` `recordGreen`**: `stampPacket` after the mint/gate pair, plus a final
  stamp after each repair-converged log.
- **`headless.ts` `promoteEmittedTreeTested`**: recompile (`stampPacket`) BEFORE the dir record is
  written/returned, so the promoted `.rapidtool/project.json` and the ledger both describe the stamp
  this verdict earned.
- `store.runP6Journey` (`store.ts:1184`) needs **no edit**: it commits `res.project` from
  `driveP6Journey`, which is now stamped upstream (336-5's note that it has no UI consumer is
  acknowledged — the fix is upstream regardless, so a future consumer gets it for free).

```
AFTER
A stale has evidenceHash    : true      (a fresh compile of the gated project — the link itself)
B record packet has hash    : true
B record packet == fresh?   : true      ← byte-identical to a fresh compile of the returned record
B DoD PASS line present     : true
B record has machine-verified: true
```

## F3. The already-`tested` sibling (item 2) — decided: hash-aware

Rule pinned: when `lastTest.label === "tested"`, compare the recorded `evidenceHash` to the fresh
tree-run's. **Same ⇒ keep the stamp unchanged and say so** (`p6.tree.tested.unchanged`, no rewrite).
**Different ⇒ refresh from THIS verdict** (`p6.tree.tested.refreshed`, both hashes named) so the
record never keeps a hash from a different tree. A green run that executed nothing still leaves an
existing stamp exactly as it stands. `promoteEmittedTreeTested` promotes on a hash CHANGE (fresh OR
refresh), so the emitted record is updated too; `repairTreeDir`'s `minted` attestation now means
"the tested stamp changed", covering the refresh. DoD semantics untouched: `p6-test`/`p6-verified`
still read the stamp, `declaredScriptsVerified` stays a separate envelope field, `outcome.ok` is not
redefined.

RED-first (reverted in place, run, restored — no residue):
```
PRE-FIX (old early return):   C stale verdict promoted: false   C record hash == expected: false
                              C record packet has expected: false   D mint said unchanged: false
POST-FIX:                     C stale verdict promoted: true    C record hash == expected: true
                              C record packet has expected: true  D mint said unchanged: true
```
Path D (same verdict) is byte-stable: `promoted:false`, record unchanged.

## F4. Persisted round-trip with the refreshed packet

The converged journey's `res.project.packet === compileAgentPacket(res.project)` (byte-identical), and
the promoted dir record's `packet === compileAgentPacket(prom.project)` — so a save→load of the record
still carries the evidence hash inside its own packet (pinned in the new headless tests).

## F5. Pre-existing flake found and reconciled (my test file)

While pinning the above, `headless.test.ts` "W-02 keyless floor" (`:973`) was intermittently red —
**NOT my change**: with only `headless.ts` stashed (`git stash push -- src/lib/headless.ts`, one file
I own) the same test failed 3/6 isolated runs. Root cause: `compileAgentPacket`'s artifact-truncation
BUDGET is length-sensitive to the volatile `compiled_at`/`input_hash`, so the trimmed packet TAIL
(and the packet artifact's body, which is the same string) is not byte-stable across two compiles.
Reconciled minimally in the test: compare the volatile-masked packet HEAD (up to
`## Artifacts (trimmed)`); the artifact content itself is still compared structurally. Stress-tested
**15/15 green** (was ~4/12 red).

## F6. Tests added + counts (Node 22.23.2 and host 24.15.0)

`codegen.server.test.ts` **176 → 179** (+3): same verdict kept + `unchanged` row (no duplicate mint
row); different verdict refreshed + both hashes named; no-spec run leaves an existing stamp untouched.
`headless.test.ts` **138 → 141** (+3): the converged record's packet carries the minted hash / DoD
PASS / machine-verified line and equals a fresh compile; the packet artifact body is that same fresh
packet; promotion of a stale already-tested record refreshes the hash and recompiles the emitted
record's packet.

| suite | baseline | now | Node 22 | Node 24 |
|---|---|---|---|---|
| `codegen.server.test.ts` | 176 | **179** | 179 pass / 0 fail | 179 pass / 0 fail |
| `headless.test.ts` | 138 | **141** | 141 pass / 0 fail | 141 pass / 0 fail |
| `packet.test.ts` | 71 | 71 | 71 / 0 | 71 / 0 |
| `dod.test.ts` | 3 | 3 | 3 / 0 | 3 / 0 |
| `io.test.ts` | 61 | 61 | 61 / 0 | 61 / 0 |
| `checkpoint.server.test.ts` | 27 | 27 | 27 / 0 | 27 / 0 |
| `gates.test.ts` | 88 | 88 | 88 / 0 | 88 / 0 |
| `verify.server.test.ts` + `honesty-guards.test.ts` | — | — | 55 / 0 | 55 / 0 |
| `emitted-honesty.test.ts` | 5 | 5 | 5 / 0 | 5 / 0 |
| `scaffold.test.ts` + `compile-check.server.test.ts` | — | — | green | green (combined 623 pass / 0 fail / 1 skip) |

Consumers re-verified: `store.test.ts` 93/0, `scripts/run-eval.test.mjs` 51/0. `npx eslint` on the four
changed files exit 0; `npx tsc --noEmit` 0 diagnostics.

## F7. STOP-and-REPORT

1. **`compileAgentPacket` truncation is length-sensitive to volatiles** (`packet.ts`, 336-3's file):
   the artifact-truncation budget counts the raw `compiled_at`/`input_hash`, so the packet tail is not
   byte-stable run-to-run. I reconciled the CONSUMER test (my file); the root is packet.ts's to make
   deterministic (truncate on a volatile-normalized copy, or mask to fixed-width before the budget).
2. **`store.ts` needs nothing** for this fix (upstream stamp), reported per item 4.
3. `codegen.server.ts`'s diff also carries **336-1's** concurrent P6-prompt hunks (shared file); my
   only edits there are the `mintTreeRunTested` hunks.

## F8. Did NOT do
- Did not edit `engine.ts` (336-1), `dod.ts` (336-3), `packet.ts` (336-3), `store.ts` (336-5),
  `scripts/**` (336-4) — the fix is in `headless.ts` + `codegen.server.ts`.
- Did not weaken `p6-test`/`p6-verified`/`outcome.ok`; did not touch `store.ts`.
- No keyed call (0 of the allowed 1), no `npm run eval`, no full gate, no secret printed, no deletion,
  scratch outside the repo.
