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

The frozen evidence lives at `C:\Users\mnril\Desktop\testruns\` (the repo's sibling),
not inside the repo. Resolution order, first hit wins:

1. `$env:RAPIDTOOL_TESTRUNS`
2. `<repo>/testruns`
3. `<repo>/../testruns`  ← the real run root this wave produced
4. `C:/Users/mnril/Desktop/testruns`

A missing run root is a named failure (`<run-root-missing>`), never a silent skip.

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

At the time of writing, **C-04** (monotonic repair / no-progress abort) is the one
guard that cannot fire. Lane B landed the best-tree metric *internally* in
`headless.ts` (`bestTreeMetricOf` / `isBetterTree` / `keepBestTree`), but the names
P-B's registry and this harness both consume — `headless.treeVerdictScore` and
`headless.failureSignature` — are **not exported**, so neither P-B's
`repair-monotonic.test.mjs` pin nor this driver can call the real comparator. The
historical defect is still on disk (`bakery-florist-orders/repair.json`: 3/3 cycles,
`RT_E_REPAIR_FAILED`, cycle 2 repeats cycle 1's failure signature — the exact
non-monotonic signal C-04 must abort on).

This is reported, not hidden: the command exits `1` naming `C-04`, and
`replay-harness.test.mjs` pins the miss to the pending B2 export. Once lane B
exports the comparator, the driver calls it on the real captured cycle sequence and
the command exits `0` with no other change.

## Cassettes

`cassettes/<slug>.json` — one per historical project (7), derived from the real
artifacts, not hand-written: the full brief text, the persisted vs corrected
`{name, domain, kind}`, the tree set, the incident ids, and the normalised
`{file, ok, exit_code, code, error, unmet}` failure signatures from the run
envelopes. `cassettes/trees.json` lists the 13 emitted trees;
`cassettes/runlock-bl010.json` carries the BL-010 timestamp set.

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
