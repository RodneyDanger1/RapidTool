# 320 · G3 · FIXER — T9.3 promotion: apply F3's §C (a green emitted tree-run stamps the dir's OWN record)

Lane G3 (T9.3 promotion fixer) of W44 Phase-2 wave-2. Repo: `C:\Users\mnril\Desktop\RapidTool Main`.
HEAD at entry: `c1049ba` (one doc-record commit past the context's `21c4731`; tree CLEAN — `git status --porcelain` empty).
Box (one writer): `src/lib/headless.ts` · `scripts/rapidtool-cli.mjs` · `scripts/run-eval.mjs` · `src/lib/headless.test.ts` · `scripts/run-eval.test.mjs` · this log.
Applying: `fixes/319_f3_promote.md` §C literal patch text — `promoteEmittedTreeTested` helper + CLI `emit --run` wire + run-eval post-emit wire (+ optional C4 repair parity).
Keyless only; scoped proofs; patch-only; anchors re-read immediately before each edit.

Status: **COMPLETE** — F3 §C applied (5 files, 144 insertions / 1 deletion); keyless green + red e2e proven with quoted bytes; scoped legs 107/107 · 46/46 · 24/24; eslint 0; no stamp fabricated anywhere.

---

## A. Pre-flight (at open)

- `git status --porcelain` → EMPTY (clean tree; no sibling writes in flight).
- `git log -1` → `c1049ba W44 Phase 2 record: wave-1 closure (boundary gate.sh ok:true at 21c4731; fixer proofs re-run) + wave-2 queue`.
- Anchor greps (line numbers confirmed at this HEAD):
  - `src/lib/headless.ts:2406` `async function applyTreeRunTestedMint(...)`; `:2544`/`:2586` journey callers; `:3146`/`:3158` repair callers; `exportProjectJson` import `:48`; `node:fs` import `:62` (existsSync/writeFileSync present).
  - `scripts/rapidtool-cli.mjs:1415` `if (flag(args, "run")) {`; `:1454` `RT_E_TREE_RUN_FAILED`; `:1875` `h.saveProject(path, res.project); // the ledger absorbs the dir edits`.
  - `scripts/run-eval.mjs:89-90` headless imports (`driveP6Journey,` / `emitProject,`); `:2045` emit; `:2075` `runOutcome = await treeRun(emitDir);`.

(append as the lane proceeds)

---

## B. Application (F3 §C applied, in order; anchors re-read at each edit)

Deviations from §C (all logged, minimal, honesty-driven):
1. **§C1 helper doc comment**: code body applied VERBATIM; the doc sentence "A red run, … returns the SAME project reference and writes NOTHING" was made precise — the ok-but-no-spec mint path returns a NEW ref (logs appended, `codegen.server.ts:3782-3794`) and the recordless path returns the minted ref without a write. Landed text says: "…writes NOTHING into the dir (absence is honest; …)" — behavior claim now exact for all four branches; code untouched.
2. **§C5a pin**: applied + one extra assert `existsSync(join(bare, ".rapidtool", "project.json")) === false` ("no record is fabricated into existence") — strengthens the never-fabricate claim.
3. **§C4 (OPTIONAL repair parity) NOT applied** — analysis: `repairTreeDir`'s `recordGreen` (`headless.ts:3134-3163`) already runs the SAME self-guarded mint with the SAME verdict before returning `res.project`, so at the CLI's `res.ok` branch `res.project.lastTest.label === "tested"` whenever the mint could fire ⇒ §C1's fresh-mint guard (`before === "tested"` ⇒ `promoted:false`) makes the §C4 call structurally unable to promote the dir record (inert in every branch: mint fired ⇒ before===tested; mint not fired ⇒ after!==tested). Applying it would add a no-op edit to a big central file. A REAL repair-dir promotion needs a record-reading variant (different semantics, beyond T9.3's done-when) → left to the parent as a note, not forced.

Edits landed (quoted anchor → insertion; all verified by the patch tool's exact-match):
- **E1 `src/lib/headless.ts`** — inserted `export async function promoteEmittedTreeTested(project, dir, outcome)` between `applyTreeRunTestedMint` (ends :2416) and the fixes/144 doc comment. Zero new imports (resolve :63 · existsSync/writeFileSync :62 · exportProjectJson :48 · Project/TreeRunOutcome in scope).
- **E2 `scripts/rapidtool-cli.mjs`** — emit `--run` arm: after the `if (!outcome.ok){…RT_E_TREE_RUN_FAILED}` close, added `if (outcome.ok === true) { const prom = await h.promoteEmittedTreeTested(project, res.dir, outcome); … ledger save + payload.tested }`. Anchor pinned uniquely via the emit arm's exact indent + `case "fixtures" {` tail (the identical `bits.join` text exists at :1813 in the tree-run verb — NOT touched).
- **E3 `scripts/run-eval.mjs`** — headless import adds `promoteEmittedTreeTested,`; post-`treeRunToEvidence` wire `if (runOutcome && runOutcome.ok === true && treeEv) { … treeEv.minted = true }` (best-effort try/catch).
- **E4 `src/lib/headless.test.ts`** — import adds `promoteEmittedTreeTested,`; C5a pin inserted after the C-1 pin (green→promote+stamp+hash; red→false+byte-identical; no-spec→false+byte-identical; no-record→false+no file).
- **E5 `scripts/run-eval.test.mjs`** — headless import adds `promoteEmittedTreeTested`; C5b sibling pin inserted after the F4 pin (:191): evidence object accepts additive `minted`; green promotes + `"label": "tested"` bytes; red byte-identical.

## C. Proofs (all keyless, foreground, at HEAD `c1049ba` + the box edits above)

### C1 · GREEN e2e — keyless scratch `C:/Users/mnril/w44_g3_scratch/green`
- `node --experimental-strip-types <repo>/scripts/rapidtool-cli.mjs create --brief "A static marketing website for a coffee shop: visitors browse a menu page, read the story, check opening hours and the address, and see the daily specials." --out proj.json` → `"ok": true`, `exit_code:0`.
- `… emit --project proj.json --out emitted --run` → **exit 0**; `treeRun.ok:true`; `"tests":[{ "file":"tests/oracle.spec.ts","compile":"pass","tests":{"pass":5,"fail":0},"run":"pass" }]`; `"verdictHash":"890750497"` (== F3's trial website hash — deterministic); envelope gained:
```json
  "tested": {
    "promoted": true,
    "label": "tested",
    "evidenceHash": "3488319203",
    "ledgerSaved": true
  },
```
- **THE done-when bytes** `emitted/.rapidtool/project.json:450-455`:
```
  "lastTest": {
    "ok": true,
    "detail": "tree-run green: compile 8/8 file(s) · 1 spec file(s) pass · 5 assertion(s) · specs [tests/oracle.spec.ts] · entry ui-shell skip",
    "label": "tested",
    "evidenceHash": "3488319203"
  },
```
- Ledger absorbed the promotion (repair parity): `proj.json` carries `"label": "tested"` + the `p6.tree.tested` log row (`"tested-equivalent minted after green tree-run · … fnv1a 34883192"`); the emitted record also carries that row (count 1).

### C2 · RED e2e — byte-identical requirement (scratch only)
Setup (`red_probe.mjs`): copy of the green `proj.json` → `lastTest:null`, tested logs stripped, `generatedSource:"export const broken = ;"` (compile-red emission).
- `emit --out emitted_red_norun` (no `--run`) → exit 0; `emit --out emitted_red --run` → **exit 1** (`"failed": 1` in compile, `"error":"tree-run failed"`, `"code":"RT_E_TREE_RUN_FAILED"`).
- Byte-compare (sha1sum, quoted):
```
5af281f51ea71fae602a12dd5ec41cfb00f09e19 *emitted_red_norun/.rapidtool/project.json
5af281f51ea71fae602a12dd5ec41cfb00f09e19 *emitted_red/.rapidtool/project.json
```
⇒ the red run wrote **nothing**; red record `emitted_red/.rapidtool/project.json:443` = `"lastTest": null`; `"label": "tested"` count = 0 on both records AND the ledger; ledger byte-identical before/after both emits (`cmp` → `LEDGER_IDENTICAL=yes`); the red envelope carries NO `tested` key.

### C3 · Scoped legs + eslint (foreground)
- `node --experimental-strip-types --test src/lib/headless.test.ts` → **# tests 107 / # pass 107 / # fail 0**, exit 0, 45.0s; new pin RAN: `ok 4 - T9.3 (W44 · G3/320 · from 319_f3_promote §C): a green tree-run promotes the emitted dir's OWN project.json …`.
- `node --test scripts/run-eval.test.mjs` → **46/46 pass**, exit 0, 2.7s; new pin RAN: `ok 4 - T9.3 (W44 · G3/320 …): the promotion run-eval wires … red leaves it byte-identical`.
- Neighbor CLI legs `scripts/README-cli.test.mjs` + `scripts/cli-exit-taxonomy.test.mjs` → **24/24 pass**, exit 0.
- `npx eslint src/lib/headless.ts scripts/rapidtool-cli.mjs scripts/run-eval.mjs src/lib/headless.test.ts scripts/run-eval.test.mjs` → **exit 0**, no output.
- `node --check` (cli, run-eval) + `node --experimental-strip-types --check` (headless.ts) → all OK.

### C4 · Hygiene / git status
- `git diff --numstat` (my box): `27/0` cli · `15/0` run-eval · `34/1` run-eval.test · `35/0` headless.test · `33/0` headless → **144 insertions, 1 deletion total** (the 1 deletion = the replaced one-line import in run-eval.test.mjs). No renames; **zero new imports**.
- `git diff --check` → exit 0 (no whitespace errors); `file` → all 5 files uniform LF UTF-8 (same as untouched `src/lib/io.ts`).
- `git status --porcelain` — MY writes are EXACTLY the box + this log: `M scripts/rapidtool-cli.mjs` · `M scripts/run-eval.mjs` · `M scripts/run-eval.test.mjs` · `M src/lib/headless.test.ts` · `M src/lib/headless.ts` · `?? fixes/320_g3_promote.md`. Sibling entries also on the tree (`M src/lib/diagnose.test.ts` · `M src/lib/diagnose.ts` · `?? fixes/320_g2_diagnose.md`) are **lane G2's box** (concurrent wave-mate), untouched by this lane.
- Keyless discipline: no `DEEPSEEK_API_KEY` read or keyed call anywhere; every proof was local/deterministic (create/emit/treeRun are keyless-capable). No stamp fabricated: the only two stamps that exist were earned by real green verdicts (the scratch green emit + the ledger copy of it).

## D. Notes for the parent (honesty)
1. **§C4 not applied** (inert — see §B.3): repair's `recordGreen` mints with the same verdict before the CLI sees `res.project`, so the §C1 fresh-mint guard makes the drafted §C4 call structurally unable to promote the dir record. A real repair-dir promotion needs a record-reading variant — a NEW semantic beyond T9.3's done-when; not taken.
2. **run-eval wire coverage**: `runTrial` is not exported and the driver self-executes as CLI, so the scoped suite proves (a) the import seam resolves (suite leg green), (b) the helper contract end-to-end on temp records, and (c) the wire's names are in scope by construction (`finalProject`/`emitDir` are the exact args of the `emitProject` call 30 lines above). The next real eval run will exercise the wire; its `treeEv.minted` flag records whether a promotion fired. Not overclaimed.
3. Scratch artifacts live OUTSIDE the repo at `C:/Users/mnril/w44_g3_scratch/` (safe to keep for V or delete).

=== END 320_g3_promote — COMPLETE (F3 §C applied: headless helper + CLI emit --run wire + run-eval M2 wire + 2 pins in-box; keyless green emit --run ⇒ emitted record carries label:"tested" + evidenceHash 3488319203; red compile-red emit ⇒ record byte-identical, no stamp; scoped legs 107/107 + 46/46 + 24/24, eslint 0; §C4 withheld as inert with analysis; no keyed run, no fabrication) ===


