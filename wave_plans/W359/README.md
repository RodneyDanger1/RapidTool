# wave_plans/W359 — the kind-fidelity wave (parent index + amendments)

**Wave W359.** Five coding lanes + the standing `cartographer`. Zero keyed spend.
**Author:** the wave parent. **Source plan:** `research/multiagent/358_cartographer.md` §3.5 (the cartographer's
sequenced lane plan), which this index adopts and reconciles with the parent's earlier drafts.

**Owner directive in force this wave (verbatim):** *100% working, high-quality, functional code only — no
mock, stub, demo, fake, or placeholder code may be written by any subagent or by the parent, on any
production path. Test doubles are permitted only inside a test seam.*

## Why this wave exists

The factory cannot deliver the best version of the **requested** kind because the kind itself is wrong or
absent at every stage. Measured (cartographer, re-derived from the bytes):

| finding | evidence |
|---|---|
| The resolver **mis-resolves 3 of 10** corpus briefs, including the only game brief | `engine.ts:219-241` is an ordered **first-hit** keyword table; `arcade-breakout` → `app` via `screen/screens`, `showing-booking` → `tool` via `agent`, `coffeehouse2home` → `service` |
| The kind decision is **replicated four times**, so there is no single truth | `engine.ts:219-241` · `dod.ts:868-926` · `scaffold.ts:649` · `run-eval.mjs:2082` |
| **No synthesis prompt contains the kind** | `codegen.server.ts` / `prompt-engine.ts` mention it only in comments and routing checks |
| Kind reaches consumers through **four holes** | `rapidtool-cli.mjs:1632` (inert `--kind`), `engine.ts:4074` (stamp only on the keyed path), `headless.ts:6602` (`(kind: undefined)`), `run-eval.mjs:2092/2122` (the mapper routes `service`/`library` to `undefined`, masking the defect) |
| **3 of 5 kinds emit source their own toolchain cannot compile** | `app` exit 0; `game` exit 2 with **97** errors (incl. `TS2614 …'./ui/console' has no exported member 'bootGame'`); `tool`/`service`/`library` exit 2 with **180** each. Cause: `briefedSiteFiles:5092` has **no kind gate**, and `tsconfigJson:984`'s `jsx` is decided by a hard-coded kind list |
| The gate seam that folds the **emitted** surface into the row the DoD gate reads is **dead in production** | `headless.ts:5855 stampEmittedSurfaceForGate` → 1 hit = its own definition ⇒ the gate reads the **synthesized** surface, so a mismatch can produce a **false refusal** |
| The corpus cannot measure kind at all | every non-`app` `kindFit` unit is a **mis-stamp**: a bakery website stamped `game`, a mobile app stamped `library`; `tool`/`service` are `uncovered` |

## Lanes (disjoint ownership)

| # | lane | files it alone owns | mandate |
|---|---|---|---|
| 1 | `resolve-kind` | `src/lib/engine.ts`, `engine.test.ts`, `src/lib/types.ts`, `src/lib/dod.ts`, `dod.test.ts`, `scripts/run-eval.mjs`, `run-eval.test.mjs` | **One truth + scored resolution.** Replace the first-hit table with a scored, evidence-recording resolution (`kindResolution{kind,confidence,evidence}`); **delete the replicated resolvers** in `dod.ts:868-926` and `run-eval.mjs:2082` so one decision is the only one; stamp the kind on the **keyless** path too (`engine.ts:4074` sits behind `:4059`/`:4063`); stop the eval mapper masking kind (`:2092`, `:2122-2123`). Must flip `arcade-breakout`→`game`, `coffeehouse2home`→`app`, `showing-booking`→`app`, and keep the other 8. |
| 2 | `kind-gate` | `src/lib/scaffold.ts`, `scaffold.test.ts` | **The P0.** Gate `briefedSiteFiles:5092` on the kind (its sibling `rendererFiles:4278` already is) **and** derive `jsx` from the emitted file set rather than a hard-coded list; delete `scaffold.ts:649`'s replicated resolver (lane 1's single truth); **apply the ready 3-edit patch in `fixes/358_close_kindjsx.md` §2.3**. Done-when: every kind's emitted source compiles under its emitted `tsconfig.json`, and the W358 merge (`siteOperatorConsole`/`uiOperatorFormBody`) plus `scaffold.test.ts` 139/139 stay green. |
| 3 | `inject-kind` | `src/lib/codegen.server.ts`, `codegen.server.test.ts`, `src/lib/prompt-engine.ts`, `prompt-engine.test.ts` | Put the kind in the prompts: a project-stable `DELIVERY KIND` block at `codegen.server.ts:2286` (measured ~537 chars, 54,574 chars of headroom), pushed **into `lines`** so `budgetLeft` counts it; make `prompt-engine.ts:262`/`:419`'s six-key envelope kind-correct **as prompt text**, never as a seventh key. |
| 4 | `thread-kind` | `scripts/rapidtool-cli.mjs`, `src/lib/headless.ts` | Close the CLI/headless holes: `--kind` on `create` (`:1632`); print the resolved kind at `:6602`; pass it at `:6427`; and **revive or honestly report** the dead `stampEmittedSurfaceForGate` seam (`:5855`) — a dead seam that makes the gate read the synthesized surface is a false-refusal source, so either wire it or record it as a named defect; do not silently leave it. |
| 5 | `kind-corpus` | `scripts/quality-ratchet.mjs`, `quality-ratchet.test.mjs`, `quality-ratchet.floors.json`, per-kind fixture stamping under `testruns/` | Re-stamp the two mis-stamps against the trees' own bytes, give every kind an honest case (or a named, justified gap), give `game`/`library`/`tool`/`service` the `app` kind's leg-pins so the pins can actually fire, and **re-verify `realProductOnly` over `src/**` = 0 violations** (the owner's no-mock rule). |
| 6 | `cartographer` | findings only | Verify all five adversarially, map regressions, and re-measure the wall that remains (which clause of the P6 DoD gate fails most, the honest floor the next wave should move, and whether a keyed run is now worth buying). |

## Amendments applied to the parent's earlier drafts (why the files differ)

1. **`one-truth` is folded into lane 1.** The cartographer's separate `w359-one-truth` lane is adopted as a
   *job* of `resolve-kind` because the wave keeps to ≤5 coding lanes; the file sets are disjoint either way.
2. **Lane 2 carries `close-kindjsx`'s ready patch.** `close-kindjsx` (W358) was chartered against
   `codegen.server.ts`/`compile-check.server.ts`, but the cause lives in `scaffold.ts` (R-12: the parent's
   dispatch error, acknowledged). It measured the per-kind table, chose direction (a) with evidence that
   (b) is insufficient (flipping `jsx` alone takes a tool tree from 83 to 6 errors; making it compile would
   require DOM lib, react, `index.html` and vite scripts for a CLI, i.e. turning every kind into a webapp),
   and wrote the complete 3-edit patch. Lane 2 applies and verifies it. **No lane may edit another lane's
   files to work around a charter error.**
3. **Lane 4 owns the dead gate seam.** `stampEmittedSurfaceForGate` is in `headless.ts`, which lane 4 owns.
4. **Lane 5's pins must be able to fire.** An `atLeast: 0` pin on a reading of 0 has no producible
   `floor − 1`; where the honest reading cannot reach 1, the pin is `status: "pending-first-green"` per the
   floors file's own contract and is disclosed, never dressed up as teeth.
