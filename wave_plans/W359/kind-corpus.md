# W359 · lane `kind-corpus` — an honest per-kind corpus, so the kind pins can actually fire

**Wave:** W359 (kind fidelity). **Persona:** `ledger`. **Author:** the wave parent. Read FIRST.

## Mission

The ratchet's kind readings are pinned against a corpus that **measures the wrong thing**, and two of them
have no pin at all. Until this is fixed, "the factory delivers the right kind" cannot be measured — which
is the campaign's main claim.

Measured (`research/multiagent/358_cartographer.md` §1.4 and §3.3):
- `kindFit.game.surfaceOk = 0` and `kindFit.library.surfaceOk = 0`, with **no pin at all**; and an
  `atLeast: 0` pin on a reading of 0 **can never fire** (`floor − 1 = −1` is not a producible count).
  `canary.floors.atleast-zero-pins-are-accounted` (`quality-ratchet.mjs:806`) forces the honesty here: an
  `atLeast`-0 pin must name a moving sub-leg floor > 0 or a `nonRegressible` reason > 20 chars. The `app`
  kind shows the working pattern: a zero `.fit` pin plus four separately-pinned legs
  (`kindFit.app.entryOk/scriptsOk/surfaceOk/demandedMatch` = 29/29/10/20), with `surfaceOk` binding.
- **Neither non-`app` `kindFit` unit is an honest case**: `bakery-website/emitted` is a bakery website
  stamped **`game`**, and `mobile-companion/emitted` is a mobile app stamped **`library`** (both mis-stamps
  trace to the old bare noun `level`).
- `kindFit.tool.*` and `kindFit.service.*` are **`uncovered`** — they honestly report that rather than
  passing, which is correct, and it is also a measurement gap.

## Owned files (yours alone)

`scripts/quality-ratchet.mjs` · `scripts/quality-ratchet.test.mjs` · `scripts/quality-ratchet.floors.json` ·
the per-kind fixture **front-matter / stamping data** you need (the pinned corpus lives under `testruns/`;
if you add a fixture, add it there and record it)

## MINI-TASK PLAN

1. **Re-stamp honestly.** For every kindFit unit, establish what kind the tree actually IS, from its own
   bytes — not from the front-matter that mis-stamped it. Where a unit is a mis-stamp, correct the stamp so
   the reading means what its name says. Record each unit's verdict (`honest` / `mis-stamp fixed` /
   `dropped with reason`).
2. **Give every kind an honest case** (app, game, tool, service, library), so `uncovered` shrinks to
   nothing or to a named, justified gap. Coordinate: `resolve-kind` is fixing mis-resolution and
   `kind-gate` is fixing what each kind emits; re-stamp against **their** landed behaviour, and if a kind
   cannot yet produce an honest case, say exactly what blocks it.
3. **Make the pins able to fire.** For `game` and `library` (and `tool`/`service` once covered), add the
   legs the `app` kind uses (`entryOk` / `scriptsOk` / `surfaceOk` / `demandedMatch`) with floors **≥ 1**
   where the honest reading supports it, or `status: "pending-first-green"` per the floors file's own
   contract. Prove each new pin fails at `floor − 1` when planted.
4. **Keep `realProductOnly` at zero violations, and re-verify it over `src/**`.** The owner's rule is
   absolute: no mock/stub/fake/demo code on a production path. `fix-gates` (W357) extended the reader to
   RapidTool's own `src/**` (`repoTestDoubleImports` atMost 0, `repoModulesScanned` atLeast 153). Re-run it
   after the other W359 lanes land and record the reading — this is the wave's evidence that the no-mock
   rule held.
5. Keep every floor honest: a floor may only rise; no metric may read `pass` while `unavailable`.

## Verification

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
node scripts/quality-ratchet.mjs --all
node scripts/quality-ratchet.mjs --selftest
node --test --test-reporter=tap scripts/quality-ratchet.test.mjs
npx tsc -p tsconfig.scripts.json --noEmit
```

## Logging

`fixes/359_kind_corpus.md`. Record: the per-unit honest/mis-stamp verdict table, the per-kind coverage
matrix, each new pin with its planted proof, and the `realProductOnly` reading over `src/**`.

## Do not

- Do not edit `src/**` at all (`kind-gate`, `resolve-kind`, `inject-kind` own the source),
  `scripts/rapidtool-cli.mjs` / `src/lib/headless.ts` / `scripts/run-eval.mjs` (`thread-kind`), the
  register, or another lane's log.
- Do not lower a floor, delete a guard or a test, satisfy a pin by editing a fixture's bytes to look
  honest, or report `pass` for an `uncovered` reading.
- No keyed LLM call. Do not run the full gate. No git writes.
- **100% working production code only: no mock, stub, fake, demo, or placeholder code on any production
  path.**
