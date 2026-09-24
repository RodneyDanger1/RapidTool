# 249 · W18 LANE 6 — DEFINE-FIRST SPECS: DF-09 · T4.3 · G4 (executable checks, spec only)

> **W18 · LANE 6 deliverable.** Turns the three `UNVERIFIABLE-NOW` rows (`240_missing_tasks_audit.md` §4)
> into **executable checks** — the failure mode each must catch, the exact entrypoint, the input fixture,
> the observable and the pass/fail rule, with every cited path verified on disk **today (2026-09-24)** by a
> command whose output is pasted inline. **ZERO code edits in this lane** (proof in §5).
>
> Sources read: `wave_plans/W18/lanes-and-watchdogs.md` §LANE 6 · `240_missing_tasks_audit.md` §4 ·
> `220_tasklist_canonical.md` §1 C (T4.3 `:94`), §1 E (DF-09 `:115`, G4 `:125`) + the AUD-2 / FOLD markers ·
> `230_task_execution_playbook.md` Part 4 (DF-09 `:1135`, T4.3 `:1164`, G4 `:1188`).

## BOTTOM LINE

**All three rows are now executable-as-written.** Each spec below names one check (entrypoint + fixture +
observable + pass/fail), the concrete failure mode it must catch (grounded in code read today), and the
implementing lane's done-when command. Two design choices made deliberately to keep the implementing lanes
collision-free with the live W16/W17 uncommitted boxes:

| row | check host (status today) | turns RED on today's tree? | evidence run by this lane |
|---|---|---|---|
| **DF-09** | extend `src/lib/honesty-guards.test.ts` (**M**, W16-hot) | **YES** — override-without-note currently succeeds | host baseline 9/9 green (pasted §1) |
| **T4.3** | `src/lib/patch.test.ts` (**clean**) + NEW `src/lib/patch-preservation.test.ts` | pin of an existing guarantee; **teeth proven by one scratch mutation** | full probe **executed live** (pasted §2) |
| **G4** | NEW `src/lib/error-scan.server.ts` + test; runner = NEW CLI `scan` arm | new surface; fixture tree with one known swallow | scan words in `compile-check.server.ts` = **0** (pasted §3) |

**Host-artifact note (EXT-FAIL, logged and moved on):** `emit --project … --out …` on today's interleaved
tree exits 1 `RT_E_INTERNAL "Expected ',', got 'ident'"` — the W17 mid-edit emit path the wave already
attributes the 9 `headless.test.ts` failures to; **not** a T4.3 finding. The T4.3 probe therefore builds its
tree+ledger fixture by hand (real `fnv1a` hashes) and never needs `emit`.

---

## §0 · VERIFIED-ON-DISK INDEX (every path this file cites)

```
$ cd "/c/Users/mnril/Desktop/RapidTool Main" && ls -la \
  src/lib/honesty-guards.test.ts src/lib/patch.test.ts src/lib/testing/fixtures.ts \
  scripts/check-assertion-gaps.mjs scripts/check-assertion-gaps.test.mjs \
  src/lib/compile-check.server.ts src/lib/write-set.ts src/lib/emitted-honesty.test.ts src/lib/policy.ts
scripts/check-assertion-gaps.mjs
scripts/check-assertion-gaps.test.mjs
src/lib/compile-check.server.ts
src/lib/emitted-honesty.test.ts
src/lib/honesty-guards.test.ts
src/lib/patch.test.ts
src/lib/policy.ts
src/lib/testing/fixtures.ts
src/lib/write-set.ts
```

Anchors (all re-grepped today; **disk wins — the audit/playbook line numbers have drifted** because
`engine.ts`/`store.ts`/`console.tsx` carry the uncommitted W16/W17 edits):

```
$ grep -n "export function approveHitl" src/lib/engine.ts            → 1628   (audit said 1625)
$ grep -n "note?: string" src/lib/engine.ts                          → 1632   (AUD-2 said 1629)
$ grep -n "note: opts?.note" src/lib/engine.ts                       → 1666   (audit said 1663)
$ grep -n "forcedOverride" src/lib/engine.ts                         → 1659, 1672, 1683
$ grep -n "note: decision.feedback.slice" src/lib/engine.ts          → 3553   (audit said 3550)
$ grep -n "note.trim().length < 12" src/lib/store.ts                 → 1547   (exact)
$ grep -n "approve: (id, opts" src/lib/store.ts                      → 1507   (exact)
$ grep -n "approve(projectId, { force })" src/components/console.tsx → 1860   (audit said 1841 — console.tsx is W16-M)
$ grep -n "export function maskLiteralsAndComments" src/lib/sandbox.ts → 30
$ grep -n 'case "tree-run"\|case "repair"\|case "edit"\|case "emit"' scripts/rapidtool-cli.mjs → 986 / 1057 / 1162 / 781
$ grep -c 'case "' scripts/rapidtool-cli.mjs                          → 35
$ grep -n 'case "scan"' scripts/rapidtool-cli.mjs                     → (no output — the verb name is FREE)
$ ls src/lib/tree-error-scan.server.ts src/lib/error-scan.server.ts   → No such file (the module names are FREE)
```

Probe/runner caveats verified: `src/lib/honesty-guards.test.ts` = **M** (W16), `scripts/rapidtool-cli.mjs`
and `scripts/README-cli.md`+`.test.mjs` = **M** (W16) — the two hosts that need the post-W16-merge window are
called out in each spec's sequencing note. `src/lib/patch.test.ts` and `scripts/check-assertion-gaps.mjs`
are clean.

---

# SPEC 1 — DF-09 · approval over a failed/overridden gate must carry a rationale

**(1) What is being verified.** RapidTool's HITL override path lets a human approve a P6 gate whose sandbox
FAILED. Today that approval is minted with **no rationale**: `approveHitl` accepts `note?: string`
(`engine.ts:1632`) and writes `note: opts?.note` (`:1666`), but the only caller that ever supplies a note
is the autopilot self-approval (`:3553`). The store's `approve` action (`store.ts:1507`) passes
`{ decidedBy:"human", force, requestedAt }` — no note; the console's override button calls
`approve(projectId, { force })` (`console.tsx:1860`); the CLI's approve path auto-generates a *seat tag*
note (`headless.ts:842`: `[seat …] out-of-band RT_HUMAN_SEAT_TOKEN verified`) which is provenance, not a
rationale. So the decision ledger can record "a red gate was overridden" with **nothing** that says why —
the override is indistinguishable from a rubber stamp. The check verifies: an approval over the
failed/overridden-gate path **refuses** without a caller-supplied rationale (mirroring the rejection guard's
≥12-char floor, `store.ts:1547`) and **records** the rationale when supplied.

**(2) The check's DESIGN.**

- **Entrypoint:** extend **`src/lib/honesty-guards.test.ts`** (exists; **M** uncommitted W16 — sequence after
  the W16 merge / `fixes/246`, or the parent may authorise the edit; this is the same host class the audit
  named in `240` §4). New block: `describe("W18 L6 honesty guards — DF-09 approval rationale")`, 4 `it`s:
  - **A1 store seat** — `import { useRapid } from "./store.ts"` (import proven working today:
    `node --experimental-strip-types -e "import('./src/lib/store.ts')…"` → `STORE-IMPORT-OK keys:
    convergeRealRun,persistStorageHealth,useRapid`). `useRapid.setState({ projects: [gated] })` then
    `useRapid.getState().approve(gated.id, { force: true })`.
  - **A2 engine seat** — `approveHitl(gated, { decidedBy: "human", force: true })`.
  - **A3 controls (over-broad guard must fail here)** — a non-failed parked gate approves without a note;
    the autopilot note-carrying path still records; reject's 12-char floor unchanged.
  - **A4 RED-today / mutation teeth** — the block as a whole is required to be RED on today's tree
    (A1 returns `{ok:true}` today; A2 does not throw today), and GREEN after the engine+store guard.
- **Fixture — `gated` (built from the repo's own precedents):**
  ```ts
  const p6 = runToGate(seedProject(), 6);                      // fixtures.ts:99 — parked at the P6 mouth
  const gated: Project = {
    ...p6, status: "awaiting_hitl" as const,
    hitl: { ...(p6.hitl ?? { phase: 6, title: "Sandbox failed — review", prompt: "broken", stakes: "high" }),
            phase: 6 as PhaseId, forceHuman: true },
    lastTest: { ok: false, detail: "fixture: failing sandbox output" },
  };
  // precondition trio — fail HERE, never pass vacuously (honesty-guards.test.ts's own doctrine):
  assert.equal(gated.currentPhase, 6); assert.equal(gated.hitl?.forceHuman, true); assert.equal(gated.lastTest?.ok, false);
  ```
  Precedents for the fabricated gate state: `codegen.server.test.ts:615-620` (identical `hitl` literal,
  `forceHuman: true`), `headless.test.ts:1522-1525` (`{...base, hitl: {...base.hitl!, phase: 6, forceHuman: true}}`).
  This fixture is *exactly* the engine's override condition `forcedOverride = Boolean(opts?.force) && phase === 6
  && project.lastTest !== null && !project.lastTest.ok` (`engine.ts:1659`).
- **Observable:** the return value of the store action (`ApproveResult`, `store.ts:37`), the thrown error of
  the engine call, and the minted decision row (`project.decisions.at(-1)`: `note`, `decidedBy`).
- **Pass/fail rule:**
  1. A1 without note → `{ ok: false }` and `error` matches `/rationale|note/i`; **today: `{ok:true}` → RED.**
  2. A2 without note → throws; the error carries `code === "RT_E_VALIDATION"` (the coded-throw precedent is
     `headless.ts:828-834`: `const err = new Error(…); err.code = "RT_E_VALIDATION"; throw err`), so the CLI
     leg classifies it as a coded refusal (exit 1) instead of `RT_E_INTERNAL` (exit 4).
  3. A1/A2 *with* `note` (≥12 trimmed chars) → recorded; `decisions.at(-1).note === note`.
  4. A3 controls stay green: no-note approval of a NON-failed gate succeeds; `store.ts:1547` reject floor intact.
  5. The lane's log must paste the RED-before/GREEN-after pair for the same command.
- **Guard semantics (stated once, so the lane doesn't guess):** trigger = `forcedOverride` (force ⇒ failed
  P6 sandbox) OR the pending phase's recorded gate has `passed === false` when the lane can read it cheaply;
  floor = **12 trimmed chars, mirroring the reject guard**; store pre-checks and returns
  `{ok:false,error}` (_mirrors_ `store.ts:1547`), engine throws coded `RT_E_VALIDATION` (defense in depth
  for every non-store caller, incl. the CLI); **the autopilot path must keep working** (`engine.ts:3553`
  already passes its own note — never require a *human* rationale there).
- **Console half (honest boundary):** `console.tsx` has no DOM test infra (node:test suites only) — the
  console wiring (pass the existing `note` state on the override path, `console.tsx:1860`; the override
  checkbox text at `:1756`) is verified by `npm run typecheck` = 0 plus a pasted
  `grep -n "approve(projectId" src/components/console.tsx` in the lane log, **not** by a test.

**(3) The failure mode the check must catch.** Thought example on today's bytes: P6's sandbox fails
(`lastTest.ok === false`); the operator ticks "I reviewed the failing sandbox output and approve anyway"
(`console.tsx:1756`) and hits Approve → `onApprove(force=true)` → `approve(projectId, { force })`
(`:1860`) → `store.approve` passes its force check (`store.ts:1516-1530`) → `approveHitl` sets
`forcedOverride` (`engine.ts:1659`), logs `hitl.approved_override`, and records
`note: opts?.note === undefined` (`:1666`). The packet's audit trail now shows a red gate overridden with
no reason; the CLI path is no better — its "note" is the auto-generated seat tag (`headless.ts:842`),
which would be recorded even if the human never read the failure. A future reader (or the owner) cannot
answer "why was the red gate overridden?" — and nothing on disk can turn that into a failing test until the
guard AND this check exist.

**(4) Implementing lane done-when + command.**
> **Done-when:** the DF-09 block in `src/lib/honesty-guards.test.ts` is RED on the pre-guard tree and GREEN
> after the store+engine guard (rationale required, coded refusal, autopilot/reject controls intact), with
> the RED-before/GREEN-after pair pasted in the lane log.
> **Command:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/honesty-guards.test.ts`
> (baseline today: **9 pass / 0 fail**, run by this lane — see §5).

---

# SPEC 2 — T4.3 · patch preservation on user-edited trees

**(1) What is being verified.** An emitted tree is the artifact the *user* owns; they hand-edit files in it,
then the tool's edit/repair cycle runs. The guarantee to verify (the row's done-when, unchanged): **the
cycle either preserves the user edit or refuses loudly — never silently overwrites.** Grounded today:
`repairTreeDir`'s contract says "NEVER re-emits over the dir — emitProject is not part of this seam"
(`headless.ts:2546-2575`, `NEVER re-emits` at `:2574`), it re-imports the dir **hash-checked** first (`:2622`, `importTreeDir` `:2236` —
"a hash that differs from the ledger row's is a REAL edit"), and applies only rows whose source differs
from disk, refusing non-parsing rows with a coded warning (`applySynthesizedTreeToDir`, `:2486-2562`). The
check verifies that contract on a real user-modified tree, and that the loud-refusal branch appears in the
result envelope (coded, naming the edited file) rather than a silent clobber.

**(2) The check's DESIGN — three hosts, all executable today.**

- **Host 1 — `src/lib/patch.test.ts` (exists, clean, 21/21 green; run by this lane).** Pure, no fs (0 hits
  for `node:fs` — kept pure). New `describe("patch — user-edited trees (T4.3)")` with string-level cases
  framed on the *user edit*, not on generic refusals:
  1. the needle targets the user-edited region → coded refusal (`RT_E_VALIDATION`, `kind:"none"`,
     `matches: 0`, nothing applied);
  2. the needle targets a DIFFERENT region of the same edited file → lands exactly, and the edited region's
     bytes are still present **verbatim** in the result text (surgical-replace proof);
  3. the user's edit DUPLICATED the needle's block → `>1` matches → refusal **naming the count** (never
     first-match downgrade), `lines` capped at `PATCH_MAX_LISTED` (`patch.ts:117`);
  4. with `fuzzy` opted in, a window that would land ON the edited region (score below threshold) still
     refuses, and any fuzzy result that does land self-reports `kind:"fuzzy"` + `score` + `threshold` and
     its `diff.removed` is the ACTUAL matched window (`patch.ts:60` — the honesty field).
- **Host 2 — NEW `src/lib/patch-preservation.test.ts` (does not exist today; `ls` = "No such file").** The
  row's "scratch edit-cycle probe" as a *committed, CI-able* temp-dir test (tmpdir isolation IS the scratch;
  precedent for temp-dir tests: `honesty-guards.test.ts:26-28`, `headless.test.ts` `mkdtempSync` usage).
  It calls the **real** `repairTreeDir` in-process, no mocks:
  ```
  const dir = mkdtempSync(join(tmpdir(), "t43-")); build:
    dir/package.json                                  {"name":"t43-fixture","private":true,"type":"module"}
    dir/src/domain/app.ts                             clean module (the user's file)
    dir/src/domain/broken.ts                          "export function broken( {\n"   ← tree-run goes RED (real compile seam)
  project = seedProject() + generatedTree rows [{path:"src/domain/app.ts",source:appSrc,hash:String(fnv1a(appSrc)),attempt:0},
                                                {path:"src/domain/broken.ts",…,hash:String(fnv1a(brokenSrc)),attempt:0}]
  then THE USER EDIT: append "\n// USER-EDIT-MARKER-249\n" to app.ts (ledger hash now drifts — a REAL edit)
  const res = await repairTreeDir(project, dir, { budget: 1 });      // keyless → defaultRepairSynthesize refuses
  ```
  Pass/fail asserts (each verified live by this lane — see the pasted envelope below):
  `res.ok === false`, `res.outcome === "failed"`, `res.cycles === 1`,
  `res.import.changed` deep-equals `["src/domain/app.ts"]`, `res.applied.written` deep-equals `[]`,
  the marker is byte-present in `app.ts` after the cycle, and `res.events` contains
  `"budget exhausted … — repair FAILED, the edited dir stands as-is"`.
  Keyless precondition: save/delete/restore `DEEPSEEK_API_KEY` around the test (pattern:
  `headless.test.ts:1527-1537` `withoutToken`). Path discipline for the fixture: allowed tree roots are
  exactly `src/api/ src/domain/ src/jobs/ src/state/ src/ui/ src/generated/ tests/` (`headless.ts:2169-2177`)
  — a path outside them is refused loudly (`repairTreePathRefusal`, `:2191`), which is itself the reason the
  fixture MUST use `src/domain/…`.
- **Host 3 — the CLI replay on a scratch tree (the user-facing path; run once and paste into the lane log).**
  ```
  node --experimental-strip-types scripts/rapidtool-cli.mjs repair \
    --dir "C:/Users/mnril/w18l6_scratch/t43/tree" \
    --project "C:/Users/mnril/w18l6_scratch/t43/build.json" --budget 1
  ```
  (Fixture builder used by this lane: `C:/Users/mnril/w18l6_scratch/build-t43-fixture.mjs` — hand-builds the
  tree + a real Project ledger whose `generatedTree` hashes come from `src/lib/algorithms.ts` `fnv1a`, then
  applies the user edit. `emit` was avoided deliberately — see the EXT-FAIL note in BOTTOM LINE.)
- **Observable:** the user-edited file's bytes after the cycle; `import.changed` / `applied.written` /
  `applied.patchRefusals` / `events` in the result envelope; the CLI exit code + `code`.
- **Pass/fail rule (the dual rule, stated exactly):**
  - **PASS-A (preserve):** the edited file's bytes are unchanged after the cycle, AND `applied.written`
    does not name it (or names only paths whose write is accounted for by a landed `deltas` row / refusal
    record for that path).
  - **PASS-B (refuse loudly):** the cycle aborts on the edited path with a coded refusal
    (`RT_E_REPAIR_FAILED`, or a `patchRefusalLogEntry` + `applied.patchRefusals` entry) and exit ≠ 0 —
    nothing written over the edit.
  - **FAIL:** any byte change to the user-edited file that the envelope does not explain as a deltas-row for
    that path, or an exit 0 whose `applied.written` names the edited file. Silent overwrite = RED.
  - **Teeth proof (required in the lane log):** one deliberate mutation in the lane's scratch copy (e.g.
    drop the `disk === row.source → unchanged` guard in `applySynthesizedTreeToDir`, or make
    `importTreeDir` keep the stale ledger source) must turn Host 2 RED; then revert. A pin that cannot fail
    is not evidence.

**(3) The failure mode the check must catch.** Grounded in code read today: the repair seam's delta path
re-synthesizes from `input.previous.module` — the *re-imported edited* content (`codegen.server.ts:906`,
`applyStrReplace(input.previous.module, request)`) — so a landed delta is surgical and preserves the rest of
the user's file. But when the delta cannot land, `codegen.server.ts:900` (`if (delta === null) return null;
// the delta reply did not land — the legacy full-rewrite repair takes over, byte-identical`) hands off to
the **legacy whole-module rewrite** path. A whole-module row whose source differs from disk is written
wholesale by `applySynthesizedTreeToDir` (tmp+rename, `headless.ts:2536-2546`). The only thing standing
between that path and a silent clobber of the user's edits **in that file** is the refusal *record*
(`p6.repair.patch.refused` + `applied.patchRefusals`) — if a future edit drops or misroutes that record, the
cycle replaces the user's work with no signal and the suite stays green today (patch.test.ts pins the
primitive, nothing pins the cycle). That is precisely the class this check converts into a failing test.

**(4) Implementing lane done-when + command.**
> **Done-when:** the user-edit cases in `src/lib/patch.test.ts` are green; the temp-dir cycle test in
> `src/lib/patch-preservation.test.ts` is green with the six asserts above; the CLI replay's envelope is
> pasted in the lane log (exit 1, `RT_E_REPAIR_FAILED`, `import.changed` naming the edited file,
> `applied.written: []`, marker intact); the one-mutation teeth proof is logged.
> **Commands:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/patch.test.ts`
> (baseline today: **21 pass / 0 fail**, run by this lane) · the same for the new file ·
> the `repair` CLI line above.

---

# SPEC 3 — G4 · emitted-tree error-signal scan (OV-21 folds here, advisory)

**(1) What is being verified.** No scan exists that reads an *emitted* tree and reports its error-handling
signals: a scan-shaped grep over the dir-verdict module returns 0 (`grep -nci "empty catch\|unchecked\|
unhandled\|swallow" src/lib/compile-check.server.ts` → **0**, re-run today). G4 verifies: a tree can be
scanned, offline and read-only, for the TA-12-class signal — **empty catch**, **swallowed error**, and
(OV-21's fold) **a neutral-empty return adjacent to an "unimplemented"-family comment** — and the findings
are reported. Posture, per `230` §G4 + `220`'s FOLD marker: **advisory finding surface, never a gate** —
it never blocks an emit, never enters `scripts/gate.sh`, and every finding is labelled advisory because the
rules are lexer-level heuristics that can false-positive.

**(2) The check's DESIGN.**

- **Module (NEW, collision-free): `src/lib/error-scan.server.ts`** (name verified absent today; server-side
  because it reads fs — `*.server.ts` is the repo's own contract for that, `codegen.server.ts` header).
  Exports:
  ```ts
  export type ErrorScanRule = "catch-empty" | "catch-swallowed" | "neutral-return-unimplemented";
  export type ErrorScanFinding = { path: string; line: number; rule: ErrorScanRule; snippet: string; advisory: true };
  export type ErrorScanResult =
    | { ok: true; dir: string; scanned: { files: number; lines: number }; findings: ErrorScanFinding[] }
    | { ok: false; dir: string; code: ErrorCode; error: string };          // the scanner is never swallowed itself
  export function scanTreeErrorSignals(dir: string): ErrorScanResult;
  ```
  - Walk `*.ts`/`*.tsx`/`*.js`/`*.mjs`, skipping the walk-skip set of the gate-3 scanner
    (`check-assertion-gaps.mjs:53`: `node_modules .git .vercel dist build coverage .output`).
  - **Reuse the in-tree masker:** `maskLiteralsAndComments` from `src/lib/sandbox.ts:30` (already the
    repo's masking seam, imported by `codegen.server.ts`) for R1/R2 structure — comments/strings blanked,
    line numbers preserved. R3 reads the RAW line (comments must stay visible) with strings blanked only.
  - **Rules (precise, deterministic):**
    - **R1 `catch-empty`** — a `catch` clause whose body (masked) holds no statement (only blanks/comments).
    - **R2 `catch-swallowed`** — a `catch` clause with ≥1 statement, none of which is: `throw`, an `RT_E_`
      mention, `console.`, `.warn(`, `.error(`, or `report(`. (Allowlist is deliberate; a finding is a
      prompt to look, not a verdict — advisory: true.)
    - **R3 `neutral-return-unimplemented`** (OV-21) — a standalone `return "";` / `return '';` /
      `return [];` / `return -1;` whose 5 preceding raw lines contain an unimplemented-family marker
      (`/unimplemented|not implemented|todo|stub|placeholder|not yet/i`) → the OV-21 intent: a silent
      neutral return next to an "unimplemented" comment must require an `RT_E_*` code (or the marker's
      removal). Advisory-only by construction.
  - **Refusals:** unreadable/absent dir or zero-resolvable files → `ok:false` + `RT_E_VALIDATION` + a message
    (mirrors `verifyKindDir`'s non-package refusal class in `compile-check.server.ts`); the function never
    throws and never writes. A scan error must never be silently empty (the "scanner not swallowed" rule).
- **Test (NEW): `src/lib/error-scan.server.test.ts`** — planted fixture trees under tmpdir (the playbook's
  "a tree with one known swallow"), each case asserted by exact finding set (rule + path + line):
  - `fixture/swallow.ts` → `catch { /* ignored */ }` ⇒ exactly 1 × `catch-empty`; and
    `try { return Number(raw); } catch (err) { return 0; }` ⇒ exactly 1 × `catch-swallowed`.
  - `fixture/unimplemented.ts` → `// NOT IMPLEMENTED: …` + `return "";` ⇒ 1 × `neutral-return-unimplemented`;
    the SAME return without the marker ⇒ 0 (adjacency control — kills the false-positive class).
  - `fixture/clean.ts` → `catch (err) { throw new Error("RT_E_VALIDATION: " + …); }` ⇒ 0 findings.
  - `fixture/masked.ts` → `export const DOC = "try { risky(); } catch { /* sample */ }";` ⇒ 0 findings
    (masking control).
  - absent dir ⇒ `ok:false` + `RT_E_VALIDATION`, no throw.
- **Runner: NEW CLI verb `scan` in `scripts/rapidtool-cli.mjs`** (host is W16-**M**; same post-merge window
  as LANE 2's lesson arm). Structure **mirrors the `tree-run` arm (`:986-1055`) exactly**: `requireArg(args,
  "dir", "scan")` → `resolve` → dynamic `await import("../src/lib/error-scan.server.ts")` → read-only, no
  policy seam, no writes → payload → `respond(payload, payload.ok ? 0 : 1)` → catch-all exit 4.
  ```
  node --experimental-strip-types scripts/rapidtool-cli.mjs scan --dir <emitted-tree-dir> [--json]
  ```
  Envelope: `{ ok: findings.length === 0 && scan.ok, cmd:"scan", dir, scanned, findings, advisory: true,
  note: "advisory finding surface — never blocks an emit (218 §3.4 / OV-21)", exit_code }`; exit **0** clean,
  **1** findings (the `check-assertion-gaps.mjs` exit idiom), **1** + `RT_E_VALIDATION` for an unreadable dir.
  **Parity duties that ship in the same commit** (bound mechanically by `scripts/README-cli.test.mjs`
  `:24-40` + `:199-234`): the README-cli.md headline count `35 → 36`, the verb list + a command example, and
  the `USAGE.commands.scan` key — every arm needs a USAGE key and vice versa.
  **Explicit do-nots:** not in `scripts/gate.sh`, not called by `emit`, no CI-blocking wiring, no new gate
  (218 §3.4: a finding surface; OV-21: advisory-only).
- **Observable:** the finding set (rule + path + line + snippet) on the fixture tree; exit code and envelope
  on the CLI; the clean tree's zero findings.
- **Pass/fail rule:** fixture tree with one known swallow → the finding is reported (exact rule+line);
  clean tree → zero findings; masked string → zero findings; the marker-adjacency control → zero findings;
  unreadable dir → coded refusal, never a throw, never a silent empty result. A run that reports nothing on
  the fixture OR throws on the bad dir = FAIL.

**(3) The failure mode the check must catch.** Grounded in emitted code the scaffold writes TODAY:
`scaffold.ts:1679-1682` emits `try { text = readFileSync(…) } catch { return false; }` inside the emitted
oracle's `__capCarries` — an emitted file in which "file missing" and "capability carries nothing" collapse
into the same `false` (a real, shippable swallow-signal with no surfacing today); `scaffold.ts:1610-1613`
emits `try { … } catch (e) { if (e instanceof ReferenceError) throw e; }` — a *conditional* swallow (every
non-ReferenceError throw vanishes). A regression that broadens these classes — or a future emitter that
starts emitting `// TODO` + `return ""` stubs — ships inside the product artifact with **zero** signal: the
tree compiles, the tests can pass, and nothing reads the error-handling shape. `compile-check.server.ts`
answers "does it compile / do the tests pass", never "is the failure handling silent". That is the G4 gap.

**(4) Implementing lane done-when + command.**
> **Done-when:** `scanTreeErrorSignals` exists with the three rules and the coded-refusal path; the colocated
> test's five cases are green (exact finding sets); the CLI `scan` arm returns exit 1 with exactly the
> expected findings on the swallow fixture and exit 0 on the clean tree; `scripts/README-cli.test.mjs` stays
> green with the new verb; the lane log states the scan is NOT wired into any gate.
> **Commands:** `node --experimental-strip-types --test --test-concurrency=2 src/lib/error-scan.server.test.ts`
> · `node --experimental-strip-types scripts/rapidtool-cli.mjs scan --dir <fixture>` ·
> `node --test "scripts/**/*.test.mjs"` (README-cli parity leg).

---

## §4 · SEQUENCING / COLLISION NOTES FOR THE DISPATCHER

| host | state today | why it matters |
|---|---|---|
| `src/lib/honesty-guards.test.ts` | **M** (W16) | DF-09's host — land after the W16 merge (`fixes/246`) or via parent authorisation |
| `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md`, `scripts/README-cli.test.mjs` | **M** (W16) | G4's runner + parity duties — post-merge window (same as LANE 2's lesson arm) |
| `src/lib/patch.test.ts`, NEW `patch-preservation.test.ts` | clean / new | T4.3 is landable immediately |
| NEW `src/lib/error-scan.server.ts` (+test) | new | deliberately avoids `compile-check.server.ts` (**M**, W17) and `headless.ts` (**M**, W16) |
| `emit --… --out` | broken mid-edit (`RT_E_INTERNAL "Expected ',', got 'ident'"`) | EXT-FAIL of the W17 emit path; nothing in these three checks depends on it |

## §5 · LANE-CLOSE EVIDENCE (commands this lane ran, foreground only)

- **Baselines (both hosts executable today):**
  `node --experimental-strip-types --test --test-concurrency=2 src/lib/honesty-guards.test.ts`
  → `# tests 9 · # pass 9 · # fail 0` · same for `src/lib/patch.test.ts` → `# tests 21 · # pass 21 · # fail 0`.
- **T4.3 probe executed live** (fixture `C:/Users/mnril/w18l6_scratch/t43/`, builder script in the same dir) —
  the `repair` envelope verbatim (`EXIT=1`):
  `ok:false · outcome:"failed" · code:"RT_E_REPAIR_FAILED" · import:{imported:2, changed:["src/domain/app.ts"], unchanged:1, missing:[], refused:[]} · applied_written:[] · cycles:1`
  `events: ["import: 2 file(s) re-read … (1 changed, 1 unchanged)", "tree-run fail (pre-cycle): tree-run not ok", "cycle 1: tree-run fail — tree-run not ok", "budget exhausted after 1 repair cycle(s) — repair FAILED, the edited dir stands as-is"]`
  `grep -c "USER-EDIT-MARKER-249" …/tree/src/domain/app.ts` → **1** (the user edit byte-survived).
- **G4 zero-hit proof:** `grep -nci "empty catch\|unchecked\|unhandled\|swallow" src/lib/compile-check.server.ts` → `0`.
- **Store importability proof (DF-09 host feasibility):** `STORE-IMPORT-OK keys: convergeRealRun,persistStorageHealth,useRapid`.
- **Zero code edits:** `git status --short` re-run at lane close shows exactly one new entry attributable to
  this lane — `?? research/multiagent/249_define_first_specs.md` — everything else is the pre-existing
  W16/W17 boxes plus other W18 lanes' concurrent landings (doctor.ts, io.ts, knowledge.ts, git.server.ts,
  plugin.ts, 249_lane*.md …); scratch lives outside the repo at `C:/Users/mnril/w18l6_scratch/`.
- **One runtime-log append (declared):** the CLI runs appended lines to the pre-existing, git-ignored
  telemetry file `.rapidtool/logs/rapidtool.ndjson` (`.gitignore:20` ignores `.rapidtool/logs/`; every CLI
  exit stamps an NDJSON event by design). No tracked file was touched; nothing was deleted from it.
