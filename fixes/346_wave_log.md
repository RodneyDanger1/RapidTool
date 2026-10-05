# fixes/346_wave_log.md — the 346 wave (W60), batches 1–10, append-only summary

**Scope.** This is the append-only session summary of the 346 wave from the pause point
(`9a8e5a3`, 2026-10-03) through batch 10 (`2f0e3d7`, 2026-10-05). It records, per batch: what
landed, its commit, and the gate result that the bytes actually support. Nothing here is a
capability claim the artifacts do not show. Keyed LLM calls made by *this* docs lane: **0**;
no `src/**` / `scripts/**` edit; no git write.

**Note on numbering.** The commits at `7db4d7d` and `100504c` do **not** carry a "batch N" label;
they are the resume-completion and follow-up commits that precede the explicitly-labelled
batches 3–10. They are listed here as batches 1–2 so the ten batch slots map to ten commits. The
mapping is: batch N = the Nth commit in the ordered list below (newest first at `2f0e3d7`).

**Frozen boundary at close:** HEAD `2f0e3d7`, tree **clean**, `git status --porcelain` empty.
**Tracked files (`git ls-files`):** total **2,014** · `src` 256 · `src/lib` 244 (129 non-test +
115 test suites) · `scripts` 107 (33 `*.test.mjs`) · `fixes` 761 · `wave_plans` 139 ·
`research/multiagent` 103.

---

## Commit list (newest → oldest)

| Batch | Commit | Subject |
|---|---|---|
| 10 | `2f0e3d7` | campaign-1 residual fixes — floor reachability, UI wiring, skip-vacuity, CLI, classifier, 20-guard proof layer |
| 9 | `b3baef8` | six-lane execution — P6 synthesis integrity, delivery truth, proof layer, machine acceptance |
| 8 | `886f155` | live keyed acceptance-run fixes — classifiers, deepen guard, entity decode, UI busy latch |
| 7 | `91f47f2` | continuation wave — adversarial audit of batch 6 + ~15 more real fixes |
| 6 | `136b1dd` | six-lane bug hunt — 22 real defects fixed across engine, providers, state, UI, CLI, trust |
| 5 | `f4eb883` | strict runner coverage, console run honesty, machine-verified acceptance, offline gate truth, event census, docs truth |
| 4 | `c16220b` | six-lane completion — CLI emit guard, console spend, seat provenance, isolation, bounded steps, honest tail |
| 3 | `128a539` | cross-lane parity, cross-tab deletes, hash-collision honesty, verified delivery |
| 2 | `100504c` | follow-up — oracle-lane numeric parity, verified delivery, watchdog resume gate |
| 1 | `7db4d7d` | resumed and completed — SB-1/SB-2 trust fixes, V2 validation, and an agent bug-fix sweep |

Prior: `9a8e5a3` (pause point, 2026-10-03) · `988b158` (345 wave).

---

## Per-batch landing + gate

Gate results are quoted **only** where a boundary gate was actually recorded in the bytes; where a
batch had no separately captured frozen-tree gate, that is stated plainly rather than inferred.

### Batch 1 — `7db4d7d` (resume completion)
- **Landed:** SB-2 tree-lane behavioural floor parity (`compile-check.server.ts`); SB-1 injective
  knowledge fingerprint (`knowledge.ts`); V2 validation (orchestrator adversarial probe 12/12, browser
  checks 6/6, census + destruction audit with 0 tracked deletions); agent sweep (factory-watch
  cross-process state lock + dirty-slug commit, coded refusal for a configured-but-missing knowledge
  store, cross-tab operator toggles, empty-array shape as a real assertion, one-shot guard evasions,
  stale DORMANT comment). 19 files, +891/−65.
- **Gate:** GREEN frozen-tree boundary recorded in `fixes/346_0_parent.md` §6 — typecheck 0 · lint 0 ·
  assertion-gaps 0 · scripts **446/0** · lib **3370/0/2** · build 0; `flakes:[]`, `hardFails:[]`.

### Batch 2 — `100504c` (follow-up)
- **Landed:** oracle-lane numeric-literal parity (`verify.server.ts`), verified delivery, watchdog
  resume gate; `scripts/README-cli.md` + `factory-watch` semantics. 8 files, +380/−31.
- **Gate:** no separately captured frozen-tree gate; validated by the lane suites and folded into the
  batch-3/4 boundaries below. **Declared, not a green claim.**

### Batch 3 — `128a539`
- **Landed:** cross-lane parity, cross-tab deletes, hash-collision honesty, verified delivery;
  `factory-watch.mjs` hardened. 11 files, +949/−98.
- **Gate:** no separately captured frozen-tree gate (folded into batch 4's boundary). **Declared.**

### Batch 4 — `c16220b` (six-lane completion)
- **Landed:** CLI `emit --run --git` red-tree commit guard (`RT_E_TREE_RUN_FAILED`), console spend
  chip, console seat provenance, the real Permission-Model isolation bound (`isolation:"strict"`),
  bounded steps, honest P7–P12 tail naming. 27 files, +1729/−128.
- **Gate:** GREEN frozen-tree boundary recorded in `fixes/346_batch5_notes.md` §7 (and mirrored in
  `AGENTS.md`): `ok:true`, scripts **452/0**, lib **3507/0/2**, `flakes:[]`, `hardFails:[]`.

### Batch 5 — `f4eb883`
- **Landed:** strict runner coverage, console run honesty, **machine-verified acceptance**
  (`machineVerifiedAcceptance`, the seed of the PR-31 machine reading), offline gate truth, event
  census, docs truth (the 2026-10-04 corrections blocks in README/AGENTS/RESUME). 23 files,
  +2054/−149.
- **Gate:** the one full gate run of that docs lane was **mid-wave** and returned `ok:false` on the
  documented load-sensitive child-spawn `compile-check.server` test (passes standalone) while sibling
  lanes edited `src/**` (`fixes/346_batch5_notes.md` §1); the frozen-tree reconciliation later in the
  same wave returned GREEN. Recorded as the flake class, not a defect.

### Batch 6 — `136b1dd` (bug hunt)
- **Landed:** 22 real defects fixed across engine, providers, state, UI, CLI, trust; `gate-verdict`
  pins added. 31 files, +704/−66.
- **Gate:** no separately captured frozen-tree gate; validated by the lane suites. **Declared.**

### Batch 7 — `91f47f2` (continuation + adversarial audit of batch 6)
- **Landed:** adversarial audit of batch 6 plus ~15 more real fixes (incl. `brand-check`).
  57 files, +1759/−182.
- **Gate:** no separately captured frozen-tree gate. **Declared.**

### Batch 8 — `886f155` (live keyed acceptance-run fixes)
- **Landed:** classifier fixes, `deepenResearch` guard, HTML-entity decode, UI busy latch, console
  guards test. 10 files, +257/−23.
- **Gate:** no separately captured frozen-tree gate in this lane's record. **Declared.**

### Batch 9 — `b3baef8` (six-lane execution)
- **Landed:** P6 synthesis integrity, delivery truth, the keyless proof layer, machine acceptance;
  **added `fixes/346_masterplan.md`** (the frozen design plan, 824 lines) and the campaign-1 cassettes
  under `scripts/prevention/cassettes/campaign1/`. 70 files, +11839/−238. The masterplan's own header
  records its base as `HEAD 886f155 + one uncommitted six-lane wave`; batch 9 is the commit that lands
  that wave (and the masterplan file). Campaign #1 ran at this HEAD `b3baef8`.
- **Gate:** no separately captured frozen-tree gate at this exact commit; the next boundary gate is
  batch 10's (below). **Declared.**

### Batch 10 — `2f0e3d7` (campaign-1 residual fixes; HEAD at close)
- **Landed:** floor reachability, UI wiring, skip-vacuity, CLI, classifier fixes, and the **20-guard
  proof layer** (`scripts/prevention/**` harness rework + `scripts/guards/campaign-invariants.mjs` /
  `campaign-pins.test.mjs`). 52 files, +4961/−147. Docs truth (PR-33) landed in this lane.
- **Gate:** GREEN frozen-tree boundary run this session — exact JSON:
  ```json
  {"ok":true,"double":false,"flakes":[],"hardFails":[],"quarantined":[],"quarantineCandidates":[],"skips":2,"wallMs":535223,"gates":{"typecheck":{"ok":true,"exit":0,"ms":54129},"lint":{"ok":true,"exit":0,"ms":20283,"problems":5},"assertionGaps":{"ok":true,"exit":0,"ms":1059},"build":{"ok":true,"exit":0,"ms":14581},"prevention":{"ok":true,"exit":0,"ms":3901,"missed":[],"pending":[],"skipped":[],"count":20,"countFloor":20},"testsScripts":{"ok":true,"exit":0,"ms":249046,"pass":513,"fail":0,"skipped":0},"testsLib":{"ok":true,"exit":0,"ms":191241,"pass":3712,"fail":0,"skipped":2}}}
  ```
  (cmd: `& 'C:\Program Files\Git\bin\bash.exe' scripts/gate.sh`; the JSON is authoritative — a
  PowerShell wrapper's exit 1 is a stderr `NativeCommandError` artifact.)

---

## The keyless proof layer (gate of record)

Command: `node scripts/prevention/verify-prevention.mjs --all --selftest`. At `2f0e3d7` it returns:

- `ok:true`, `guards:20`, `count:20`, `countFloor:20`, `historical:20`.
- **Two orthogonal signals, both clean:** `fixtureIntegrity.missed:[]` (every guard's detector still
  fires on the artifact it was written for) ∧ `fixPresence.pending:[]` (every live fixer seam is
  present and wired). `skipped:[]`. `rubricBaselines` 13/13 covered; the held-out cassette
  (`held-out-community-tool-library`) is present and disjoint.
- Wired as an additive `gate.sh` stage: the gate fails if a guard stops firing, a seam stays
  `pending`, a guard is `skipped`, or `count < countFloor`.

---

## Campaign #1 verdict (keyed, 2026-10-05)

Source: `C:\Users\mnril\Desktop\testruns\_report\CAMPAIGN1.md` (+ `CAMPAIGN1.json`,
`campaign1-score.json`). Run at HEAD `b3baef8` (batch 9). This docs lane made **0 keyed calls** and
does not reproduce the run; it quotes the campaign's own scorecard.

- **Product axis: FAIL.** `workingApp` **0 of 8** trees (target ≥5/8). 6/8 stall at the P6 DoD gate
  (`RT_E_GATE_PENDING`); only flower-shop-website and mobile-companion reached P12. The decisive
  failing clause is that **no emitted console mounts a real generated export** (0/8).
- **Delivery-honesty axis: PASS.** **0 empty-substance commits** and **0 red-tree commits** (historical:
  6 empty + 5 red). Every hollow tree is withheld with `RT_E_SUBSTANCE_EMPTY` and no `.git` is created;
  every non-`(a)` project carries a coded abort.
- **What worked:** substance gate, red-tree refusal, P6 monotonic repair (`p6.synthesis.monotonic`),
  and the no-progress abort (`p6.journey.no-progress`, cycle 3 reproduced cycle 2's signature).
- **What did not:** BF-1 minimum-file-set refusal was not observably effective (`RT_E_PLAN_UNDERPRODUCED`
  in 0 artifacts); the UI is never wired to a real generated export; several hollow trees' `npm test`
  exits 0 with most oracle cases `# SKIP` (a skip is never a pass).
- **Spend:** 615,533 tokens (prompt 352,939 / completion 262,594) · ~US$0.38 label-only
  (`estimatedCostUsd:null`) · 1,505 s across 8 projects. Campaign ledger KD-8 was **unlanded at
  `b3baef8`** (the manual bound was used); the cross-process ledger (`--token-ledger` /
  `RAPIDTOOL_LEDGER_FILE` + `RAPIDTOOL_CAMPAIGN_TOKEN_CAP`) is present in the bytes at `2f0e3d7`.

---

## Close

Ten batches landed; the tree is committed and clean at `2f0e3d7`, the boundary gate is GREEN, and the
20-guard keyless proof layer is part of the gate. The wave traded honest delivery for productivity: it
will no longer emit or commit junk and it aborts instead of burning budget, but the keyed P6 synthesis
wall is unbroken (campaign-1 `workingApp` 0/8). See `README.md` / `AGENTS.md` / `RESUME.md` /
`remainingwaves.md` §"Corrections in force — 2026-10-05" for the gate, counts, the Option-A autonomy
decision, and the rollout-flag defaults/rollback.
