# 319 · F3 · FIXER — T9.3 promotion: green run's emitted artifact carries `label:"tested"` + evidence hash

Lane F3 (fixer 3) of six W44 Phase-2 lanes. Repo: `C:\Users\mnril\Desktop\RapidTool Main`.
HEAD at entry: `cdf2510` + `a3ebcdf` (tree clean except sibling logs: `fixes/318_parent_complete.md` M, `fixes/319_t1_operator.md` ??).
Box (one writer, only when applying): `src/lib/codegen.server.ts` · `src/lib/codegen.server.test.ts` · `fixes/319_f3_promote.md`.
**FREEZE honored**: T1/T2/T3 keyed trial is live RIGHT NOW; this file is the ONLY write until `C:/Users/mnril/w44_trial/fix_go.md` exists.
Phase A = READ-ONLY analysis + prepared patch text (this log). No repo source file was touched. Keyless only; foreground legs; no `$()` inline.

Status: PHASE A + B COMPLETE — **PARTIAL** (proposal path: the promotion is not contained in the lane box; zero repo product files touched by F3; no stamp fabricated anywhere).

---

## A. Phase A findings (read at HEAD `cdf2510`, exact lines cited)

### A1 · The mint is landed, self-guarded, and honest — and NOT the gap

- `src/lib/codegen.server.ts:3772` `export function mintTreeRunTested(project, outcome): Project`.
  Gates (all enforced today):
  - `outcome.ok !== true` → returns the SAME project reference (red never mints; `:3773`);
  - already `lastTest.label === "tested"` → same reference (`:3775`, idempotent);
  - `treeRunTestedEvidence(o)` (`:3728`) requires ≥1 spec with `run:"pass"` **and** ≥1 executed assertion (`executed`, `:3752`) — else an ok run only logs the coded `p6.tree.tested.skipped` warn (`:3779-3794`) and mints nothing;
  - on mint: `lastTest = testedLastTestStamp("tree-run green: " + ev.summary, evidenceHash)` (`:3799`), `evidenceHash = String(fnv1a(ev.summary))` (`:3796`), plus a `p6.tree.tested` info log row.
- `testedLastTestStamp` shape (`:2739-2746`): `{ ok:true, detail, label:"tested", evidenceHash }` — the exact E-07 shape `dod.ts` p6-verified reads (label + non-empty evidenceHash, `dod.ts:592-602`).
- Callers of the mint are ONLY in `src/lib/headless.ts`: private `applyTreeRunTestedMint` (`:2406-2416`) invoked at `driveP6Journey` `:2544` + `:2586` and `repairTreeDir`'s `recordGreen` `:3146`/`:3158`. No `scripts/*` caller (grep 0).
- ⇒ The mint itself needs NO change for T9.3. The keyless no-mint probes (`fixes/317_j2_preflight.md` §3b) already proved CASE-A no-mint / CASE-B control mints / CASE-C red none.

### A2 · `treeVerdictHash` (the keyless slice) is landed and rides every outcome

- `src/lib/compile-check.server.ts:663` `export function treeVerdictHash(outcome)`: FNV-1a over DECISIVE fields (ok, compile census, spec run labels, entry run, project scripts, substance; `behavior` only when present).
- Set on every runnable verdict at `compile-check.server.ts:1560` (`outcome.verdictHash = treeVerdictHash(outcome)`).
- Consumers: `run-eval.mjs:578` (`treeRunToEvidence` carries `verdictHash`), `maker-score.ts:69`. This is the "hashed verdict" half of T9.3 — LANDED (`de7deae`), re-affirmed in `fixes/318_a4_hygiene.md`.

### A3 · The emit path: WHERE the emitted record comes from (and the exact gap)

- `.rapidtool/project.json` inside an emitted tree is written by `scaffold.ts:2993` (`push(".rapidtool/project.json", exportProjectJson(project))`) inside `scaffoldProject`, called from `headless.ts:1988` `emitProject` (`:1958`). `exportProjectJson` = `JSON.stringify(project, null, 2)` (`io.ts:46`) — the FULL project record, so whatever `lastTest` is in the ledger at emit time rides into the artifact verbatim (nothing in `io.ts`/`hydrateProject` strips it — verified).
- The CLI `emit` arm (`scripts/rapidtool-cli.mjs`): loads ledger (`:1278`), `emitProject` (`:1330`), then `--run` (`:1415-1456`) runs `cc.treeRun(res.dir)` over the JUST-EMITTED dir and only reports the outcome (payload.treeRun / exit 1 on red). **It never mints and never writes anything back** — neither the dir record nor the ledger.
- `tree-run` verb (`:1753-1828`): explicitly read-only ("nothing is ever persisted by this verb", `:1763-1764`).
- `repair` verb (`:1830-1933`): green → `repairTreeDir` mints + CLI `h.saveProject(path, res.project)` (`:1875`) persists the **LEDGER** — but never rewrites the dir's own `.rapidtool/project.json` ("the dir is the artifact", `:1843-1845`). `applySynthesizedTreeToDir` writes only generated-tree rows (`headless.ts:2992-3050`), never the record.
- `run-eval.mjs`: emits at `:2045` (`emitProject(finalProject, emitDir)`) then tree-runs the emitted dir at `:2075` (`runOutcome = await treeRun(emitDir)`) for M2 evidence — no promotion of the emitted record either.
- Evidence that the promotion is genuinely OWED: **no emitted artifact anywhere carries the stamp**. `grep -l '"label": "tested"' research/eval-out/*/.rapidtool/project.json` → 0 hits; samples (`house-flip-manager`, `--trial-2`, `showing-booking`) all carry only the floor stamp `"lastTest": { "ok": true, "detail": "tests.pass" }`.

### A4 · The flows, mapped

1. **Trial flow (T1's live mission)**: `create → wild --start --agent-seal → emit --out <dir> --run → npm test → doctor --tree → diagnose`.
   - `wild` drives P6 through `runPhase(6)` → `runP6Edge` (`headless.ts:558-561`) → `driveP6Journey` → mint MAY land in the project record BEFORE emit (only when the journey's tree-run crossed the executed-specs gate). If it did, the emitted record already carries tested+hash today (that is the ONLY accidental path).
   - `emit --run` is the trial's real green run over the emitted artifact — and its verdict is stamped NOWHERE.
2. **Eval flow (run-eval.mjs)**: journey mint may land pre-emit; the post-emit `treeRun(emitDir)` (the artifact's own verdict) is not promoted.
3. **Repair flow**: mint lands in the LEDGER only; the dir record stays floor-stamped.

### A5 · What "promotion onto the emitted artifact" must mean (the precise definition)

The minimal honest change: **after a genuinely green tree-run over an EMITTED dir, rewrite that dir's own `.rapidtool/project.json` record with the minted stamp** — `lastTest:{label:"tested", evidenceHash}` + the `p6.tree.tested` log row — where the stamp comes from THIS verdict via the existing self-guarded `mintTreeRunTested` (never fabricated: red → no write; ok-with-no-executed-spec → no write; already-tested → no rewrite). Ledger persistence is the optional companion (repair parity) so a later re-emit never downgrades the record.

## B. Containment verdict — **NOT contained in my box** (proposal path chosen)

The write needs (a) the mint (already exists), (b) the dir path + fs write + the project record export — the homes for this are `src/lib/headless.ts` (a new exported helper next to `applyTreeRunTestedMint`) and the call sites in `scripts/rapidtool-cli.mjs` / `scripts/run-eval.mjs` — ALL OUTSIDE my box (`codegen.server.ts` + its test). No codegen-only change can make an *emitted dir record* change after a run (the mint returns an in-memory project; nothing in my box knows the dir; no existing caller invokes a post-run dir write). Per the brief: **apply NOTHING; bank the exact patch text for the parent.** (Nothing in `codegen.server.ts`/`codegen.server.test.ts` is even needed for the minimal fix — `mintTreeRunTested` is consumed as-is.)

---

## C. [FOR-PARENT] PROPOSAL — exact, ready-to-apply patch text

All anchors re-read at plan time (line numbers as of `cdf2510`). Discipline for whoever applies: re-read each anchor before the edit; patch-only; keyless scoped proofs; NEVER while a keyed run is in flight (same freeze this lane honored).

### C1 · `src/lib/headless.ts` — new exported helper (insert after `applyTreeRunTestedMint`, which ends at `:2416`)

Anchor (current bytes, `:2406-2418`):
```ts
async function applyTreeRunTestedMint(project: Project, verdict: TreeRunOutcome): Promise<Project> {
  try {
    const codegen = (await import("./codegen.server.ts")) as {
      mintTreeRunTested?: (p: Project, o: TreeRunOutcome) => Project;
    };
    if (typeof codegen.mintTreeRunTested === "function") return codegen.mintTreeRunTested(project, verdict);
  } catch {
    /* deterministic floor stands — the honest gate record still runs */
  }
  return project;
}

/**
 * fixes/144 (M4-2): bounded produce→run→repair journey for keyed P6.
```
Insert BETWEEN the two blocks (new code):
```ts
/**
 * T9.3 promotion (W44 · F3 · [FOR-PARENT]): a genuinely GREEN tree-run over an
 * EMITTED dir promotes the dir's OWN `.rapidtool/project.json` record to the
 * tested stamp + evidence hash the run just earned — the same self-guarded
 * mint the journeys use (mintTreeRunTested: outcome.ok AND ≥1 executed
 * assertion). A red run, an ok run that executed no spec, an already-tested
 * project, or a dir that carries no record returns the SAME project reference
 * and writes NOTHING (absence is honest; a stamp is never fabricated,
 * downgraded, or repaired into existence).
 */
export async function promoteEmittedTreeTested(
  project: Project,
  dir: string,
  outcome: TreeRunOutcome,
): Promise<{ project: Project; promoted: boolean }> {
  const before = (project.lastTest as { label?: string } | null | undefined)?.label ?? null;
  const minted = await applyTreeRunTestedMint(project, outcome);
  const after = (minted.lastTest as { label?: string } | null | undefined)?.label ?? null;
  // Fresh mint only: `tested` earned by THIS verdict (idempotent with the
  // mint's own early return; an existing stamp is never rewritten).
  if (after !== "tested" || before === "tested") return { project: minted, promoted: false };
  const recordPath = resolve(dir, ".rapidtool", "project.json");
  if (!existsSync(recordPath)) return { project: minted, promoted: false };
  try {
    writeFileSync(recordPath, exportProjectJson(minted), "utf8");
    return { project: minted, promoted: true };
  } catch {
    // best-effort: the minted LEDGER still returns to the caller; the artifact
    // record is left exactly as emitted (never half-promoted).
    return { project: minted, promoted: false };
  }
}
```
Import availability: `resolve` (node:path) already used (`:3088`); `existsSync`/`writeFileSync` (node:fs) already used (`:3123`/`:237`); `exportProjectJson` imported at `:48`; `Project`/`TreeRunOutcome` types in scope (`:2406`). **Zero new imports.**

### C2 · `scripts/rapidtool-cli.mjs` — emit `--run` arm wire (the trial's exact command)

Anchor (current bytes, `:1452-1457`):
```js
              payload.error = bits.length > 0 ? bits.join("; ") : "tree-run failed";
              payload.code = "RT_E_TREE_RUN_FAILED";
            }
          }
          respond(payload, payload.ok ? 0 : 1);
```
Insert between the `}` closing `if (!outcome.ok)` (`:1455`) and the `}` closing `if (flag(args, "run"))` (`:1456`) — i.e. append inside the run block:
```js
            // T9.3 promotion (W44 · F3 · [FOR-PARENT]): a GREEN --run earns the
            // tested stamp onto the emitted artifact ITSELF — the dir's own
            // `.rapidtool/project.json` now carries label:"tested" +
            // evidenceHash from THIS verdict. The mint self-guards (red /
            // ok-but-no-spec runs promote nothing; an existing stamp is never
            // rewritten). The ledger absorbs the promotion (repair parity:
            // `:1843-1845`), so a future re-emit never downgrades the record.
            if (outcome.ok === true) {
              const prom = await h.promoteEmittedTreeTested(project, res.dir, outcome);
              if (prom.promoted) {
                const lt = prom.project.lastTest;
                payload.tested = {
                  promoted: true,
                  label: "tested",
                  evidenceHash: lt && typeof lt.evidenceHash === "string" ? lt.evidenceHash : null,
                };
                if (typeof args.project === "string" && args.project.trim()) {
                  try {
                    h.saveProject(args.project, prom.project);
                    payload.tested.ledgerSaved = true;
                  } catch {
                    payload.tested.ledgerSaved = false;
                  }
                }
              }
            }
```
Notes: `project` (`:1278`) and `res.dir` are in scope; `--project` is guaranteed by the `makeLoader` require (`:612-632`); a green run's `payload.ok` stays true. The ledger save is separable if the parent prefers a strictly dir-record-only minimal (one hunk).

### C3 · `scripts/run-eval.mjs` — post-emit M2 run wire (the handover artifact)

Import anchor (`:86-92`):
```js
import {
  createProject,
  runUntilGate,
  approve,
  driveP6Journey,
  emitProject,
} from "../src/lib/headless.ts";
```
→ add `promoteEmittedTreeTested,` after `driveP6Journey,`.

Insert anchor (`:2074-2076`):
```js
    // 3) Tree-run the emitted dir (M2 evidence) — ONCE, at the end.
    runOutcome = await treeRun(emitDir);
    treeEv = treeRunToEvidence(runOutcome);
```
→ append after `:2076`:
```js
    // T9.3 promotion (W44 · F3 · [FOR-PARENT]): a green M2 run promotes the
    // emitted artifact's OWN record to the tested stamp + evidence hash — the
    // handover artifact then carries the machine verdict it earned. Additive
    // evidence only (`treeRunToEvidence` pins assert fields, never a frozen
    // key set — `run-eval.test.mjs:171-191`), best-effort: the M2 verdict
    // itself stands regardless.
    if (runOutcome && runOutcome.ok === true && treeEv) {
      try {
        const prom = await promoteEmittedTreeTested(finalProject, emitDir, runOutcome);
        if (prom.promoted) treeEv.minted = true;
      } catch {
        /* promotion is best-effort evidence; the M2 verdict stands */
      }
    }
```

### C4 · `scripts/rapidtool-cli.mjs` — OPTIONAL repair parity (dir record gets the same promotion)

Anchor (`:1874-1875`):
```js
          if (res.ok) {
            h.saveProject(path, res.project); // the ledger absorbs the dir edits
```
→ replace with:
```js
          if (res.ok) {
            // T9.3 promotion parity: the dir's own record earns the stamp too
            // (res.treeRun is the dir's genuinely green verdict; red-exhausted
            // paths reach the other branch and promote nothing).
            const prom =
              res.treeRun && typeof res.treeRun === "object"
                ? await h.promoteEmittedTreeTested(res.project, res.dir, res.treeRun)
                : { project: res.project, promoted: false };
            h.saveProject(path, prom.project); // the ledger absorbs the dir edits + promotion
```
(and the following `respond({… minted: res.minted …})` may add `tested: prom.promoted` — optional). The FAILED branch (`:1903`) stays a pure ledger save (a red run promotes nothing by construction).

### C5 · Pins (NOT in my box — for the parent/next lane)

**C5a · `src/lib/headless.test.ts`** — append next to the C-1 pin (block at `:695-729`; helpers available: `tempDir()` `:51`, `createProject`, `FIXTURE_BRIEF`, `TreeRunOutcome` literal style copied from C-1, fs imports at `:9`):
```ts
it("T9.3 (W44 F3): a green tree-run promotes the emitted dir's OWN project.json to tested + evidenceHash — red/no-spec/recordless dirs write nothing", async () => {
  const dir = tempDir();
  mkdirSync(join(dir, ".rapidtool"), { recursive: true });
  const recordPath = join(dir, ".rapidtool", "project.json");
  const base = createProject({ brief: FIXTURE_BRIEF });
  writeFileSync(recordPath, JSON.stringify(base, null, 2), "utf8");
  const executedVerdict: TreeRunOutcome = {
    ok: true,
    dir: "",
    compile: { ok: true, dir: "", checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [] },
    tests: [
      { file: "tests/oracle.spec.ts", compile: "pass", run: "pass", tests: { pass: 1, fail: 0 }, detail: "1 passed" },
    ],
    run: { kind: "library", run: "skip", detail: "no entry to smoke" },
  };
  const prom = await promoteEmittedTreeTested(base, dir, executedVerdict);
  assert.equal(prom.promoted, true, "fresh mint over a green executed run ⇒ the artifact record is promoted");
  const record = JSON.parse(readFileSync(recordPath, "utf8")) as Project;
  const lt = record.lastTest as { label?: string; evidenceHash?: string } | null | undefined;
  assert.equal(lt?.label, "tested", "the emitted record carries the tested stamp");
  assert.ok((lt?.evidenceHash ?? "").length > 0, "and its evidence hash");
  const promotedBytes = readFileSync(recordPath, "utf8");
  const red = await promoteEmittedTreeTested(base, dir, { ...executedVerdict, ok: false });
  assert.equal(red.promoted, false);
  assert.equal(readFileSync(recordPath, "utf8"), promotedBytes, "a red run writes nothing");
  const noSpec = await promoteEmittedTreeTested(base, dir, { ...executedVerdict, tests: [] });
  assert.equal(noSpec.promoted, false);
  assert.equal(readFileSync(recordPath, "utf8"), promotedBytes, "an ok run that executed no spec writes nothing");
  const bare = tempDir();
  const miss = await promoteEmittedTreeTested(base, bare, executedVerdict);
  assert.equal(miss.promoted, false, "a dir with no record is never stamped");
});
```
(Project type + `promoteEmittedTreeTested` must be added to that file's headless import; `mkdirSync` already imported at `:9`.)

**C5b · `scripts/run-eval.test.mjs`** — extend the `:171` pin (or add a sibling) asserting `treeEv.minted === true` when the promotion fired (the driver self-executes only as CLI entry; keep it a field assertion like `:184`).

### C6 · OPTIONAL, my box, WITHHELD — hash-source upgrade for the stamp (parent's call, do-not-apply by default)

`codegen.server.ts:3796` `const evidenceHash = String(fnv1a(ev.summary));` could prefer the re-derivable verdict hash so the stamp ties to `treeVerdictHash` (the T9.3 "hashed verdict" flagship):
```ts
  const evidenceHash =
    typeof outcome.verdictHash === "string" && outcome.verdictHash.length > 0
      ? outcome.verdictHash
      : String(fnv1a(ev.summary));
```
**Why withheld**: it changes the `evidenceHash` VALUE for every future mint (all flows), on a landed+probed seam; T9.3's done-when does not require it; existing pins only assert "length > 0" (safe) but `fixes/317_j2_preflight.md` §3b cites a probe value (`3655235467`) that would no longer reproduce (probe is outside the repo). If adopted: add a pin in `codegen.server.test.ts` (mint with `verdictHash:"x"` ⇒ evidenceHash `"x"`; without ⇒ fnv1a(summary)) and note the probe drift in the applying lane's log. Decision belongs to the parent.

### C7 · Verification plan for the applier

1. Scoped (keyless, foreground): `node --experimental-strip-types --test src/lib/headless.test.ts` · `node --test scripts/run-eval.test.mjs` (scripts-suite style) · `npx eslint src/lib/headless.ts scripts/rapidtool-cli.mjs scripts/run-eval.mjs`.
2. End-to-end recurrence (keyless, no keyed run needed): a real `emit --run` whose tree executes ≥1 spec ⇒ `grep -A4 '"lastTest"' <outdir>/.rapidtool/project.json` shows `"label": "tested"` + `"evidenceHash"`; a red tree emits exit 1 and the record stays byte-identical.
3. Trial evidence (T1's live dirs): after a green `emit --run` on `C:/Users/mnril/w44_trial/{website,game,program}`, the emitted `.rapidtool/project.json` must carry the stamp — that IS T9.3's done-when.
4. Boundary stays green: `bash scripts/gate.sh` (parent, after apply).

---

## D. Poll log (GO marker `C:/Users/mnril/w44_trial/fix_go.md`, max 5×sleep-300)

- T+0 (log open): marker ABSENT (`ls /c/Users/mnril/w44_trial/` = game/ program/ rt.sh website/, no fix_go.md). Tree CLEAN; T1 preflight only (no keyed call yet per `319_t1_operator.md`).
- **Poll 1 (T+~4 min): `GO`** — marker present at the first `sleep 300; test -f …` check. Read immediately:

  > `# GO-FIXERS — W44 Phase 2 fixer window (2026-09-30 11:05)` · **"The keyed run window is CLOSED. All three trial builds parked (no wild/emit run in flight). Window OPEN for Phase B."** · constraints: apply ONLY in your box; re-read before every edit; scoped proofs; do NOT touch `C:/Users/mnril/w44_trial/**` or sibling logs; parent runs the boundary + commit; "today's trial found two fresh-build P0 parks (reframe + review) — see `fixes/319_keyed_trial.md`. Do NOT attempt those (ticketed for a later wave)."

## E. Phase B (window open) — actions + verdicts

**Preconditions verified before any action:** marker exists (read, quoted above); `tasklist | grep -i node` → **EMPTY** (no node process of any kind; no wild/emit run in flight). The "P0 parks" ticket warning honored: neither park class was attempted (both are `algorithms.ts`/`engine.ts`, outside this lane's box anyway).

**Decision: [FOR-PARENT] PROPOSAL path — ZERO repo product files edited by F3.**
The promotion (writing the earned stamp onto the emitted dir's record after a genuinely green run over that dir) is NOT contained in `codegen.server.ts`(+test): the write needs the dir path + fs write + the record export, whose homes are `src/lib/headless.ts` (new helper) + `scripts/rapidtool-cli.mjs` / `scripts/run-eval.mjs` (call sites) — all outside the lane box. §B; §C carries the literal patches + pins. Nothing was applied; nothing fabricated.

**Live trial evidence (read-only; strengthens the OWED claim with the wave's own fresh bytes).** T1's trial is COMPLETE (its log END marker): all three builds parked at P0 by design (2 park classes), BUT all three `emit --run` legs ran **green, exit 0** (oracle spec 5/5 · 5/5 · 6/6 pass; `verdictHash` 890750497 · 2594549026 · 986786724). The emitted records — the exact artifact class T9.3's done-when names — read:

| emitted artifact (fresh, 10:54–10:59) | `lastTest` bytes |
|---|---|
| `C:/Users/mnril/w44_trial/website/emitted/.rapidtool/project.json:602` | `"lastTest": null` |
| `C:/Users/mnril/w44_trial/game/emitted/.rapidtool/project.json:590` | `"lastTest": null` |
| `C:/Users/mnril/w44_trial/program/emitted/.rapidtool/project.json:700` | `"lastTest": null` |

Plus the archive sweep: `grep -l '"label": "tested"' research/eval-out/*/.rapidtool/project.json` → **0/20**; sampled floors carry only `{ok:true, detail:"tests.pass"}`. ⇒ **a real green run's emitted artifact carries NO tested stamp + NO evidence hash today** — T9.3's promotion is genuinely OWED, now provable on the wave's own artifacts.

**[BUG] ticket sweep in my box:** T1's register — [F-A] LEX gap (`algorithms.ts`) · [F-B] classifier-vs-floor (`engine.ts`) · [F-C] reject-text truncation (`engine.ts`/CLI) · [F-D] diagnose derived-view (`engine.ts`/headless) · [OBS-E/F] cosmetic; T2's [BUG-1] = same LEX gap (`algorithms.ts`/`engine.ts`). **None target `codegen.server.ts` / `codegen.server.test.ts`** → no in-box fix to apply; the two P0 parks are explicitly ticketed elsewhere by the GO marker. (F2's PIN B imports `mintTreeRunTested` read-only — no source change to my box.)

**Honesty note for the parent (promotion semantics, no decision taken):** the proposed promotion inherits EXACTLY the mint's existing gates — green `ok:true` + ≥1 spec `run:"pass"` + ≥1 executed assertion; nothing stricter, nothing looser. Consequence: the trial's stub-skeleton trees (oracle spec passing, `stubs:1-2 real:0`) WOULD promote once the proposal lands — consistent with the accepted CASE-B/J2 "control mints" semantics, while the C6 census (`greenWhileStubbed`, `oracleStubTrap`) remains the separate loud counter-signal. If the parent wants a stricter promotion bar (e.g. no promotion on stub-skeleton), that is a NEW semantic decision beyond T9.3's text — not taken here.

**Anchor stability:** F1's box (`io.ts`/`store.ts`/tests) and F2's box (`cli-exit-taxonomy.test.mjs`/`wild-seal.test.ts`/`wild-step.test.ts`) do NOT overlap the proposal's files (`headless.ts`, `rapidtool-cli.mjs`, `run-eval.mjs`, `headless.test.ts`, `run-eval.test.mjs`). `git status` at close: only `fixes/319_*.md` additions — no product files modified by any fixer yet at this lane's close. Re-read anchors anyway at apply time.

### Verdict table (Phase B)

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| P0 | Phase A recon + containment judgment landed | **PASS** | §A/§B (exact file:line reads; all cited lines re-read at plan time) |
| P1 | Literal patch + pin text prepared (ready-to-apply) | **PASS** | §C1–C5 (headless helper · CLI emit --run wire · run-eval wire · repair parity · pins); §C6 optional hash-source upgrade withheld; §C7 proof plan |
| P2 | T9.3 promotion applied | **NOT-APPLICABLE IN BOX** (proposal-only; honest analysis beats a risky edit) | §B; zero edits to `codegen.server.ts`/`.test.ts`; `git status` clean of product files |
| P3 | [BUG] sweep in box | **PASS (none)** | §E sweep — all trial tickets sit in `algorithms.ts`/`engine.ts`/CLI |
| P4 | Freeze honored (log-only until GO); no fabrication | **PASS** | pre-GO writes = this log only; post-GO = this log only; no stamp minted anywhere by F3 |
| P5 | OWED claim re-proven on live wave artifacts | **PASS** | 3× `"lastTest": null` + 0/20 archive sweep (§E table) |

**Parent action requested:** route §C to a lane whose box holds `src/lib/headless.ts` + `scripts/rapidtool-cli.mjs` + `scripts/run-eval.mjs` (+ `headless.test.ts` pin); its done-when is §C7.2.C3: a green `emit --run` ⇒ `<dir>/.rapidtool/project.json` carries `label:"tested"` + `evidenceHash`; red ⇒ byte-identical.

=== END 319_f3_promote — PARTIAL (Phase A+B complete per brief: recon + containment verdict + literal [FOR-PARENT] proposal §C; promotion NOT applied — not contained in lane box (needs headless.ts + scripts); zero repo product files edited by F3; no stamp fabricated anywhere) ===
