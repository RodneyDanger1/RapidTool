# W356 · lane `ratchet` — build the quality ratchet, and make each metric unmovable by editing a reader

**Wave:** W356 (green recovery + ratchet). **Persona:** `conduit`. **Author:** the wave parent.
**You are 1 of 6 lanes.** Read this FIRST — it is your authoritative plan.

## Mission

Build the mechanism that turns "the software improves each wave" from a claim into a **pinned floor
that may only rise**, and encode the audit wave's measurement-integrity findings as hard invariants so
the failure mode cannot recur.

This lane is why the campaign is safe to run: without it, a reader edit looks like progress. The audit
wave proved that is not hypothetical — a single uncommitted change doubled the substantive-tree rate
from 6/13 to 13/13 **with zero product change** and simultaneously disarmed prevention guard C-06
(`fixes/355_0_audit_wave.md` §2.1).

## Owned files (yours alone — all NEW, plus one additive gate stage)

- **NEW** `scripts/quality-ratchet.mjs`
- **NEW** `scripts/quality-ratchet.test.mjs`
- **NEW** `scripts/quality-ratchet.floors.json` (the pinned floors — a small, readable data file)
- `scripts/gate.sh` — **additive stage only**: a new stage that runs the ratchet. Do not alter, reorder,
  or relax any existing stage. If a lane's red tree would make the new stage fail, the stage must report
  honestly and not mask another stage's verdict.

## MINI-TASK PLAN

1. **Define the metric set and pin it.** The ratchet reads each metric from its **existing** producer
   (read-only) and compares against a pinned floor from `quality-ratchet.floors.json`. Start with:

   | metric | producer |
   |---|---|
   | `gate.sh ok` | `scripts/gate.sh` verdict JSON |
   | typecheck / lint problems | `tsc`, `eslint` |
   | scripts + src test pass/fail | `npm test` legs |
   | prevention `missed` / `pending` / guard count | `scripts/prevention/verify-prevention.mjs` |
   | acceptance `ok` rate | `scripts/acceptance-run.mjs` verdicts (`research/eval-out/**`, bounded samples) |
   | tree-own-`tsc` pass rate | `compile-check.server.ts` `treeRun` |
   | substantive-tree rate | the census — **read the job-scoped reading only** |
   | `productQuality.quality` rate | `src/lib/product-quality.ts` |
   | doc-claim mismatches | the doc-parity reader |
   | **real-product rate** (see item 4) | the census + emitted-tree inspection |
   | **kind-fit rate** (see item 5) | the emitted artifact vs the requested kind |

2. **Floors may only rise; a regression is a HARD failure.** A metric that cannot be produced must
   report `unavailable` with a coded reason from `src/lib/errors.ts` (add the code to `ERROR_CODE_DOC`
   if it does not exist) — never a silent pass, never a fabricated number. `estimatedCostUsd` stays
   `null`; never invent a cost.
3. **Reader canaries (the anti-regression core).** For each metric that comes from a **code reader**,
   record a **canary**: a structural assertion about the reader itself, e.g. the census must still expose
   a field on which the shell-detection signal is reachable, and the named readers must still exist.
   If a reader's shape changes, the ratchet must FAIL loudly with a named reason. This is the fix for
   the C-06 failure mode: a guard (or a metric) that can be disarmed by renaming the field it reads is
   not a guard.
4. **`realProductOnly` — the owner's explicit rule.** Encode as a failing invariant: **no mock, stub,
   fake, demo, or placeholder code on any production path.** Evidence, from real bytes: the emitted
   tree's census (`stubs` / `reexports` must be 0 for a "real" reading) and a scan for the documented
   stub markers. Test doubles are legitimate **in test seams only** — name the seam's marker
   (e.g. a `*.test.ts` / `__mocks__` / provider-`mock` import confined to tests) and fail if such a
   symbol is imported from a production module. Keep this reader honest: a false positive here is as bad
   as a miss.
5. **`kindFit` — the owner's other explicit rule.** The factory must take the requested **kind**
   (app / game / tool / service / library) into account and deliver the best version of it. Encode a
   reading that compares the emitted artifact against the requested kind (entry shape, declared
   scripts, and the kind's required surface) and pins it per kind. If a kind has no corpus case, report
   it as `uncovered` — never as `pass`.
6. **Wire the gate stage additively** and test the ratchet itself with a **planted regression**: prove it
   FAILS when a floor is beaten downward, and that it does not cry wolf on the real tree.
7. **Report the current values as the initial floors** in your log, with the exact command that produced
   each. Where a metric is currently `unavailable` because the tree is red, pin the floor as
   `pending-first-green` and say so.

## Verification (exact commands)

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
node --test --test-reporter=tap scripts/quality-ratchet.test.mjs
node scripts/quality-ratchet.mjs --all          # the real reading (expect honest unavailable/pending on a red tree)
node scripts/quality-ratchet.mjs --selftest     # planted-regression teeth
```

## Logging

`fixes/356_ratchet.md` — skeleton first, then append. Record: the metric table with each initial floor
and its producing command, every canary, the two owner-rule readers, and every metric you judged
**gameable** and how you blocked it.

## Do not

- Do not edit any existing script's logic, any `src/**` module, any doc, the register, or another lane's
  log. `gate.sh` gets an **additive stage only**.
- Do not invent or estimate a metric value; do not make an unavailable metric read as pass.
- Do not run a keyed LLM call. Do not run the full gate (the parent runs the boundary). No git writes.
- **Do not weaken `product-quality.ts` or the census to reach a floor** — and do not accept a floor that
  was set by a reader you just changed.
