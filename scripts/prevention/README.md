# Prevention — regression & replay harness (P-A)

The evidence engine for the W346 prevention wave. It re-runs the **real** persisted
artifacts under `testruns/` and proves every named guard fires on the exact
historical defect — it never re-implements the thing it measures and never fakes a
fixture.

## The single command

```
node scripts/prevention/verify-prevention.mjs --all --selftest
```

Exit `0` prints exactly one JSON line:

```
{"ok":true,"guards":N,"historical":N,"fired":[...],"missed":[],"skipped":0,...}
```

Exit `1` names every guard that did **not** fire on its historical fixture, every
guard whose repaired control is not clean, and any skip. A skip is a hard failure:
a skipped guard is a guard that cannot fail. Keyless by default; `--keyed` /
`--budget N` are opt-in and are never required for acceptance.

Supporting commands:

```
node --test --test-reporter=tap scripts/prevention/replay-harness.test.mjs
npx tsc -p tsconfig.scripts.json --noEmit     # this file is inside the scripts program
```

## Run root

The frozen evidence is **tracked in the repo** at `<repo>/testruns/` — a MINIMAL
fixture subset (the 7 historical projects' 13 emitted trees, their `brief.md` /
`build.json` / `packet.md`, the repair/approve records and the campaign2
below-floor projects the CLI legs consume). It was vendored from the developer
box's larger run root (B1-F1); the absolute `C:/Users/mnril/Desktop/testruns`
fallback is gone, so the harness is green on a clean checkout. Resolution order,
first hit wins:

1. `$env:RAPIDTOOL_TESTRUNS`  ← the highest-priority override (a host with a
   larger run root)
2. `<repo>/testruns`  ← the tracked fixture subset this repo ships
3. `<repo>/../testruns`  ← a sibling run root, when one exists

A missing run root is a named failure (`<run-root-missing>`), never a silent skip.

### Vendoring rule — strip the emitted trees' nested git metadata

Most fixture trees were produced by `emit --git`, so each carried its own `.git`
directory. Committing a nested repository records a **gitlink**, not the tree's
files, so a clone would silently not contain the fixture the guard reads. The
vendoring step therefore removes that metadata; every consumer already skips it
(`replay-harness.mjs:187` and the campaign invariants both exclude `.git` when
walking a tree). The rule `testruns/**/.git/` in `.gitignore` is the guard so a
future re-vendor cannot silently reintroduce the hazard.

**CORRECTION — 2026-10-15 (W355 audit → W357).** The paragraph above was **false
when written**: `git ls-files testruns` returned **0** while `testruns/` held 325
files on disk, and the guard-count floor at
`scripts/prevention/cassettes/guard-floor.json` was likewise untracked — so a
clean checkout could neither run the harness nor read its floor. The W355 audit
recorded it (`fixes/355_0_audit_wave.md` §2.3 L8/L9, register `AW355-f05`), the
fixtures and the floor were then tracked, and the nested `.git` directories were
stripped as described above. The "green on a clean checkout" claim is now
supported by the tracked corpus + floor; it was **not** re-verified in a fresh
clone on this host, and that remains the honest residual.

## What is real (and the one thing that may be cassetted)

The harness imports and exercises the **real seams**, read-only:

| Seam | Import | Used by |
|---|---|---|
| `inferDomain`, `deliveryKindOf`, `inferName` | `src/lib/engine.ts` | C-12, C-16 |
| `specSourceHasBehaviouralAssert` | `src/lib/compile-check.server.ts` | C-05 |
| `treeSubstanceOf` | `src/lib/compile-check.server.ts` | C-06 |
| `archTrace`, `archProductComplete` | `src/lib/dod.ts` | C-14 |
| `treeVerdictScore`, `failureSignature` (probed) | `src/lib/headless.ts` | C-04 |
| P-B guard tools | `scripts/guards/*.mjs` (spawned) | C-01/02/03/13, C-09, C-11 |

The **only** boundary that may be cassetted is the network / LLM. Nothing here makes
a model call or a socket call: the whole suite is deterministic and keyless.

### Guard → historical fixture → fired?

The guard list is read from P-B's `scripts/guards/guard-registry.json`. Where P-B
ships a runnable tool, the harness **spawns it** (`tree-invariants.mjs`,
`readme-parity.mjs`, `runlock-preflight.mjs`) and reads its machine output; P-A's
own lexical scans are the fallback only when that file is absent. For the `test`
guards, P-A drives the real seam directly.

| Guard | Historical fixture | Fired on |
|---|---|---|
| C-01 plan under-production | `.rapidtool/project.json` of the 2-file trees | 8 fixtures (office-scheduler, flower-shop, office-stock, office-invoice, mobile v2) |
| C-02 duplicate export | `bakery-florist-orders/emitted` | `getDailyRevenueByCategory`, `getTopSellingProducts`, `getTotalWaste`, `reconstructStockCount`, `transitionOrderStatus` re-exported twice |
| C-03 use-before-declaration (TDZ) | `mobile-companion/emitted` | `suggest-reorder-quantity.ts:69` reads `globalThisStore` before its L70 declaration |
| C-05 behavioural-spec | `office-invoice-tracker/emitted/tests/oracle.spec.ts` | real `specSourceHasBehaviouralAssert` → `false` (shape-only assert + skipped `assert.fail`) |
| C-06 substance gate | `office-scheduler/emitted` (+`v2`) | real `treeSubstanceOf(...).verdict === "empty"` (control: bakery-website → `real`) |
| C-09 README parity | the 8 non-parity trees | README `\| \`src/jobs/…\` \|` rows absent on disk |
| C-11 RUNLOCK preflight | BL-010 (`runlock-bl010.json`) | P-B `runlock-preflight --selftest` refuses the src-edit-during-run window |
| C-12 classifier contract | the 6 mislabelled `build.json`s | persisted `real-estate`/`analytics`/`game`/`library` vs corrected recomputed label |
| C-13 money semantics | `mobile-companion/emitted` | `computeCartTotalPence` accumulates quantity, reads no price |
| C-14 `p6-arch` fail-closed | `office-stock-tracker/emitted` | real `archProductComplete(archTrace(project)) === false` on the attempted 2-file tree |
| C-16 `inferName` leak | the 7 persisted names | `# Golden Crust Bakery`, `# Wildstem Florist —`, … |
| C-17 numeric entities | `bakery-website/build.json` | `&#x27;` etc. leaked into the artifact |
| C-18 packet sections | the truncated `packet.md`s | `…[TRUNCATED…]` with DoD/Research dropped |

`--selftest` additionally proves each scan guard has teeth: it builds a **clean
control scratch tree** (must stay silent) and an **injected-defect scratch tree**
(must fire). No permanent test is skipped; `skipped` is pinned to `0`.

## Red pin

**There is no red pin on the landed tree today.** Two pins were RED while their
fixer lane was open and both flipped green when the fixer landed:

- **C-04** (monotonic repair / no-progress abort): the names P-B's registry and
  this harness consume — `headless.treeVerdictScore` and
  `headless.failureSignature` — were exported when lane D landed PR-07, so the
  driver calls the real comparator on the captured cycle sequence.
- **S4-04** (accepted-chunk reuse): the codegen consumer (`resumeByPath` /
  `p6.synthesis.reused`) landed first, and the pin stayed RED (`status:"pending"`,
  owner lane D5, naming `src/lib/headless.ts#driveP6Journey -> ctx.resumeAccepted`)
  until lane D5 landed the producer (`resumeAcceptedFromTree(synthesized)` →
  `ctx.resumeAccepted`, headless.ts:3568/3597). It now reads green (0 synthesis
  prompts on a resumed/accepted path).

A pin that goes red again (a fixer revert) is reported by name, not hidden: the
command exits `1` naming the guard, and the guard's own `*.test.mjs` pins the
interface so the state is legible.

## Cassettes

`cassettes/<slug>.json` — one per historical project (7), derived from the real
artifacts, not hand-written: the full brief text, the persisted vs corrected
`{name, domain, kind}`, the tree set, the incident ids, and the normalised
`{file, ok, exit_code, code, error, unmet}` failure signatures from the run
envelopes. `cassettes/trees.json` lists the 13 emitted trees;
`cassettes/runlock-bl010.json` carries the BL-010 timestamp set;
`cassettes/default-check/{sample1,sample2}.json` carry the two default-check
campaign samples (workingApp 0/4 and 3/4 — sample1 is artifact-incomplete, and
says so), whose scores are pinned in `cassettes/rubric-baselines.json#defaultCheck`
(both samples, so the variance is recorded) and guarded by **S4-05**.

To refresh after new evidence lands (keyless, writes only `cassettes/`):

```
node -e "…"   # see PREVENTION.md §3; the generator reads testruns/ and rewrites the cassettes
```

## Adding a guard

Add an entry to P-B's `guard-registry.json` (the authoritative list) with an `id`
and either a `file` that resolves to a P-B tool, or a `driver` matching a P-A
driver. P-A's `resolveDriver` maps `C-xx` ids and registry keywords to drivers; an
entry with neither is reported as a miss (never silently dropped). A guard without
a fired-on-historical proof fails the command.

## Boundaries

- Read-only over `testruns/`; the only write is a temp scratch tree under the OS
  temp dir, removed after each control/mutation proof.
- Never edits `scripts/guards/**` or any `src/lib/**` seam it consumes.
- No mock replaces the object under test; only the network/LLM boundary may be
  cassetted, and this suite uses none.
